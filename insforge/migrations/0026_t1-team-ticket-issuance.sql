-- =====================================================================
-- 0026_t1-team-ticket-issuance.sql
-- Purpose: Enable ticket issuance for T1 teams (full roster at checkout,
--          no invitation flow). After payment, T1 teams transition
--          directly to ELIGIBLE and receive their ticket.
-- Predecessor: 0025_checkout-team-roster-capture.sql (T1 roster model)
--              0008_ticket_issuance_credentials.sql (ticket issuance)
--              0007_team_roster_invitations.sql (team_apply_payment_outcome)
-- Authority: Project Owner 2026-08-31 (America/Merida)
--
-- Changes:
--  A) team_apply_payment_outcome: T1 teams (no INVITED members) → ELIGIBLE
--  B) ticket_issue_after_payment: issue ticket when roster_state = ELIGIBLE
--  C) ticket_issue_one_registration: NO CHANGE (already handles ELIGIBLE)
--
-- T1 discriminator: NOT EXISTS team_members WHERE state = 'INVITED'
--   - If zero INVITED members → T1 (roster complete from checkout)
--   - If any INVITED members → legacy invitation path (unchanged)
--
-- Ticket content: The ticket row links to registration_id. The email
-- worker resolves team member names at PDF generation time via:
--   SELECT p.name FROM team_members tm
--   JOIN participants p ON p.id = tm.participant_id
--   WHERE tm.team_id = (SELECT team_id FROM registrations WHERE id = ?)
--   ORDER BY tm.position
-- Names are NOT duplicated in the ticket row.
--
-- Individual path (team_size <= 1): UNCHANGED. The discriminator
-- `v_product.team_size > 1` explicitly separates team vs individual.
--
-- Explicitly out of scope:
--  · Apply to Main / sandbox (not authorized by this unit)
--  · Email worker implementation (deferred OD-017)
--  · Legacy invitation path changes
--  · ticket_issue_one_registration body changes
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   rejects explicit transaction-control statements and wraps each
--   migration in its own transactional context.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A) team_apply_payment_outcome: T1 teams → ELIGIBLE on payment
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.team_apply_payment_outcome(
  p_order_id uuid,
  p_outcome text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_team public.teams%ROWTYPE;
  v_has_invited boolean;
BEGIN
  SELECT t.* INTO v_team
  FROM public.teams t
  JOIN public.registrations r ON r.team_id = t.id
  WHERE r.order_id = p_order_id
  LIMIT 1
  FOR UPDATE OF t;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_outcome IN ('PAID', 'ALREADY_PAID') THEN
    -- Check if any team members are in INVITED state (legacy invitation path)
    SELECT EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = v_team.id AND state = 'INVITED'
    ) INTO v_has_invited;

    UPDATE public.teams
    SET payment_state = 'PAID',
        roster_state = CASE
          -- Preserve existing ELIGIBLE (idempotent)
          WHEN roster_state = 'ELIGIBLE' THEN 'ELIGIBLE'
          -- T1: full roster at checkout, no pending invitations → ELIGIBLE
          WHEN slots_complete >= required_size AND NOT v_has_invited THEN 'ELIGIBLE'
          -- Legacy invitation path: complete but has/had invitations
          WHEN slots_complete >= required_size THEN 'PAID_ROSTER_COMPLETE'
          -- Incomplete
          ELSE 'PAID_ROSTER_INCOMPLETE'
        END,
        eligibility_state = CASE
          WHEN roster_state = 'ELIGIBLE' THEN 'ELIGIBLE'
          WHEN slots_complete >= required_size AND NOT v_has_invited THEN 'ELIGIBLE'
          ELSE eligibility_state
        END,
        updated_at = now()
    WHERE id = v_team.id
      AND roster_state IN ('PROVISIONAL', 'PAYMENT_PENDING', 'PAID_ROSTER_INCOMPLETE', 'PAID_ROSTER_COMPLETE');
  ELSIF p_outcome IN ('REJECTED', 'CANCELLED') THEN
    UPDATE public.teams
    SET payment_state = p_outcome,
        roster_state = 'CANCELLED',
        updated_at = now()
    WHERE id = v_team.id
      AND roster_state IN ('PROVISIONAL', 'PAYMENT_PENDING', 'PAID_ROSTER_INCOMPLETE');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.team_apply_payment_outcome(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_apply_payment_outcome(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_apply_payment_outcome(uuid, text) TO project_admin;

COMMENT ON FUNCTION public.team_apply_payment_outcome(uuid, text) IS
  'IMPL-10 + T1: sync team roster_state from payment outcome. T1 teams (no INVITED members) transition directly to ELIGIBLE on payment; legacy invitation path unchanged.';

-- ---------------------------------------------------------------------
-- B) ticket_issue_after_payment: issue for ELIGIBLE teams, skip others
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_issue_after_payment(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_reg record;
  v_product public.products%ROWTYPE;
  v_team public.teams%ROWTYPE;
  v_results jsonb := '[]'::jsonb;
  v_one jsonb;
  v_issued integer := 0;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  FOR v_reg IN
    SELECT r.*
    FROM public.registrations r
    WHERE r.order_id = p_order_id
    FOR UPDATE OF r
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_reg.product_id;

    -- Team products: check roster_state before issuing
    IF FOUND AND v_product.team_size > 1 THEN
      -- Fetch team to check ELIGIBLE status
      SELECT * INTO v_team FROM public.teams WHERE id = v_reg.team_id;
      IF NOT FOUND OR v_team.roster_state IS DISTINCT FROM 'ELIGIBLE' THEN
        -- Not yet ELIGIBLE → skip (legacy behavior preserved)
        v_results := v_results || jsonb_build_array(
          jsonb_build_object(
            'registration_id', v_reg.id,
            'skipped', true,
            'error_code', 'ROSTER_NOT_ELIGIBLE'
          )
        );
        CONTINUE;
      END IF;
      -- ELIGIBLE → proceed to ticket_issue_one_registration
    END IF;

    -- Individual (team_size <= 1 or NULL) or ELIGIBLE team: issue ticket
    v_one := public.ticket_issue_one_registration(v_reg.id);
    v_results := v_results || jsonb_build_array(v_one);
    IF COALESCE((v_one->>'ok')::boolean, false) AND COALESCE((v_one->>'replay')::boolean, false) IS DISTINCT FROM true
       AND v_one->>'raw_token' IS NOT NULL THEN
      v_issued := v_issued + 1;
    ELSIF COALESCE((v_one->>'ok')::boolean, false) THEN
      v_issued := v_issued; -- replay counts as present, not newly issued
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'issued_or_present', v_issued, 'results', v_results);
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_issue_after_payment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ticket_issue_after_payment(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_issue_after_payment(uuid) TO project_admin;

COMMENT ON FUNCTION public.ticket_issue_after_payment(uuid) IS
  'IMPL-11 + T1: after TX-2 PAID, issue tickets for eligible registrations. Team products (team_size > 1) require roster_state = ELIGIBLE; individual products (team_size <= 1) issue immediately. Team ticket links to registration_id; email worker resolves member names via: SELECT p.name FROM team_members tm JOIN participants p ON p.id = tm.participant_id WHERE tm.team_id = (SELECT team_id FROM registrations WHERE id = ticket.registration_id) ORDER BY tm.position.';

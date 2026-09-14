-- =====================================================================
-- 0027_ticket-revoke-tx.sql
-- Purpose: Recover public.ticket_revoke_tx into the repo. The function
--          is already live on Main and was applied outside the local
--          migration tree (no 0027* in any git branch).
-- Source: pg_get_functiondef(public.ticket_revoke_tx(jsonb)) on Main
--         (read-only, 2026-09-14). Body copied as recovered.
-- GRANT/REVOKE: same pattern as 0025:487-489
--          (REVOKE PUBLIC + anon/authenticated; GRANT EXECUTE project_admin).
--
-- This file does NOT authorize a re-apply to Main. Re-running CREATE OR
-- REPLACE would be idempotent with the live body; do not apply without
-- Owner authorization.
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   rejects explicit transaction-control statements and wraps each
--   migration in its own transactional context.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ticket_revoke_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_ticket_id uuid := NULLIF(p->>'ticket_id', '')::uuid;
  v_ticket public.tickets%ROWTYPE;
  v_replay boolean := false;
  v_revoked_generations integer := 0;
  v_revoked_capabilities integer := 0;
  v_revoked_entitlements integer := 0;
BEGIN
  IF v_ticket_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = v_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'TICKET_NOT_FOUND');
  END IF;

  IF v_ticket.state IN ('REVOKED', 'CANCELLED') THEN
    v_replay := true;
  ELSIF v_ticket.state NOT IN ('ISSUED', 'REISSUED') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'TICKET_NOT_REVOCABLE',
      'ticket_id', v_ticket.id,
      'ticket_state', v_ticket.state
    );
  ELSE
    UPDATE public.tickets
    SET state = 'REVOKED',
        revoked_at = now(),
        updated_at = now()
    WHERE id = v_ticket.id
      AND state IN ('ISSUED', 'REISSUED');
  END IF;

  -- Heal leftover ACTIVE generations even on replay (partial prior revoke).
  UPDATE public.ticket_credential_generations
  SET state = 'REVOKED',
      revoked_at = now(),
      updated_at = now()
  WHERE ticket_id = v_ticket.id
    AND state = 'ACTIVE';
  GET DIAGNOSTICS v_revoked_generations = ROW_COUNT;

  UPDATE public.capability_credentials
  SET state = 'REVOKED',
      revoked_at = now(),
      updated_at = now()
  WHERE ticket_id = v_ticket.id
    AND kind = 'TICKET_ACCESS'
    AND state = 'ISSUED';
  GET DIAGNOSTICS v_revoked_capabilities = ROW_COUNT;

  -- access_entitlements CHECK: AVAILABLE | USED | REVOKED. Only AVAILABLE
  -- is hygiene-revoked; USED stays USED (already consumed at the door).
  UPDATE public.access_entitlements
  SET state = 'REVOKED',
      revoked_at = now(),
      updated_at = now()
  WHERE ticket_id = v_ticket.id
    AND state = 'AVAILABLE';
  GET DIAGNOSTICS v_revoked_entitlements = ROW_COUNT;

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, sanitized_metadata
  ) VALUES (
    'rpc:ticket_revoke',
    'TICKET_REVOKED',
    'ticket',
    v_ticket.id::text,
    CASE WHEN v_replay THEN 'ALREADY_REVOKED' ELSE 'REVOKED' END,
    jsonb_build_object(
      'replay', v_replay,
      'prior_ticket_state', v_ticket.state,
      'revoked_generations', v_revoked_generations,
      'revoked_capabilities', v_revoked_capabilities,
      'revoked_entitlements', v_revoked_entitlements
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'replay', v_replay,
    'ticket_id', v_ticket.id,
    'folio', v_ticket.folio,
    'ticket_state', CASE WHEN v_replay THEN v_ticket.state ELSE 'REVOKED' END,
    'revoked_generations', v_revoked_generations,
    'revoked_capabilities', v_revoked_capabilities,
    'revoked_entitlements', v_revoked_entitlements
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_revoke_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ticket_revoke_tx(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_revoke_tx(jsonb) TO project_admin;

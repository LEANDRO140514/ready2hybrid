-- =====================================================================
-- 0008_ticket_issuance_credentials.sql
-- Purpose: IMPL-11 idempotent ticket + opaque QR credential issuance.
-- Authority: Explicit Project Owner authorization for IMPL-11.
-- =====================================================================

-- =====================================================================
-- 0008_ticket_issuance_credentials.sql (helpers + protected RPCs)
-- Purpose: IMPL-11 idempotent ticket + opaque QR credential issuance.
-- Authority: Explicit Project Owner authorization for IMPL-11.
--
-- Limits:
--  · Does NOT create tables/columns/triggers/policies/extensions.
--  · Does NOT alter catalog/event/prices/cupos.
--  · Does NOT GRANT EXECUTE to PUBLIC/anon/authenticated.
--  · Does NOT persist raw QR tokens.
--  · Does NOT send email / check-in / consume entitlements.
--  · Folio: engineering opaque namespace+token (OD-019 commercial format OPEN).
--  · PUB-3D / FOT-3D: fail-closed MULTIDAY_ENTITLEMENT_BLOCKED (OD-020 OPEN).
--  · Refund/chargeback auto-revoke: NOT implemented (OD-007 OPEN).
-- =====================================================================

-- Note: no BEGIN/COMMIT — InsForge migration runner forbids transaction control.

CREATE OR REPLACE FUNCTION public.ticket_new_opaque_token(p_prefix text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN p_prefix || replace(gen_random_uuid()::text, '-', '');
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_new_opaque_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ticket_new_opaque_token(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_new_opaque_token(text) TO project_admin;

CREATE OR REPLACE FUNCTION public.ticket_hash_token(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(sha256(p_raw::bytea), 'hex');
$$;

REVOKE ALL ON FUNCTION public.ticket_hash_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ticket_hash_token(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_hash_token(text) TO project_admin;

-- Issue one ticket + active credential + single-day entitlement for a registration.
-- Idempotent via uq_tickets_registration. Returns jsonb; never raises for policy skips.
CREATE OR REPLACE FUNCTION public.ticket_issue_one_registration(p_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_reg public.registrations%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_team public.teams%ROWTYPE;
  v_member public.team_members%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
  v_gen public.ticket_credential_generations%ROWTYPE;
  v_raw text;
  v_hash text;
  v_folio text;
  v_waiver_ok boolean := false;
  v_ent_date date;
  v_created boolean := false;
BEGIN
  IF p_registration_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  SELECT * INTO v_reg
  FROM public.registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'REGISTRATION_NOT_FOUND');
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_reg.order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.state IS DISTINCT FROM 'PAID' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ORDER_NOT_PAID');
  END IF;

  IF v_reg.state IS DISTINCT FROM 'PAYMENT_CONFIRMED' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'REGISTRATION_NOT_ELIGIBLE');
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = v_reg.product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PRODUCT_NOT_FOUND');
  END IF;

  -- OD-020 OPEN: multi-day products fail-closed (no invented entitlement model).
  IF v_product.code IN ('PUB-3D', 'FOT-3D') OR (v_product.kind IN ('spectator', 'press') AND v_product.day IS NULL) THEN
    INSERT INTO public.outbox_delivery_jobs (
      communication_type, template, destination_ref, domain_event_ref, minimal_payload, state
    ) VALUES (
      'INTERNAL_ALERT',
      'MULTIDAY_ENTITLEMENT_BLOCKED',
      'ops:tickets',
      'registration:' || v_reg.id::text,
      jsonb_build_object(
        'registration_id', v_reg.id,
        'product_code', v_product.code,
        'reason', 'OD-020_OPEN'
      ),
      'PENDING'
    );
    RETURN jsonb_build_object('ok', false, 'error_code', 'MULTIDAY_ENTITLEMENT_BLOCKED', 'skipped', true);
  END IF;

  -- Team journeys: only when roster ELIGIBLE and member COMPLETE.
  IF v_product.team_size > 1 THEN
    IF v_reg.team_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'TEAM_REQUIRED');
    END IF;
    SELECT * INTO v_team FROM public.teams WHERE id = v_reg.team_id FOR UPDATE;
    IF NOT FOUND OR v_team.roster_state IS DISTINCT FROM 'ELIGIBLE' THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'ROSTER_NOT_ELIGIBLE', 'skipped', true);
    END IF;
    IF v_reg.team_member_id IS NOT NULL THEN
      SELECT * INTO v_member FROM public.team_members WHERE id = v_reg.team_member_id FOR UPDATE;
      IF NOT FOUND OR v_member.state IS DISTINCT FROM 'COMPLETE' THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'MEMBER_NOT_COMPLETE', 'skipped', true);
      END IF;
    END IF;
  END IF;

  -- Individual competitor (J1): require waiver acceptance. Workout/spectator/press: no competition waiver.
  IF v_product.kind = 'competitor' AND v_product.team_size = 1 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.waiver_acceptances wa
      WHERE wa.participant_id = v_reg.participant_id
    ) INTO v_waiver_ok;
    IF NOT v_waiver_ok THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'WAIVER_REQUIRED', 'skipped', true);
    END IF;
  END IF;

  -- Idempotent: existing ticket wins.
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE registration_id = v_reg.id
  FOR UPDATE;

  IF FOUND THEN
    SELECT * INTO v_gen
    FROM public.ticket_credential_generations
    WHERE ticket_id = v_ticket.id
      AND state = 'ACTIVE'
    ORDER BY generation DESC
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true,
      'replay', true,
      'ticket_id', v_ticket.id,
      'folio_namespace', v_ticket.folio_namespace,
      'folio', v_ticket.folio,
      'state', v_ticket.state,
      'credential_generation_id', v_gen.id,
      'raw_token', NULL
    );
  END IF;

  v_folio := public.ticket_new_opaque_token('tkt_');
  v_raw := public.ticket_new_opaque_token('qr_');
  v_hash := public.ticket_hash_token(v_raw);

  INSERT INTO public.tickets (
    registration_id,
    access_holder_id,
    participant_id,
    product_id,
    product_code,
    folio_namespace,
    folio,
    state,
    issued_at
  ) VALUES (
    v_reg.id,
    v_reg.access_holder_id,
    v_reg.participant_id,
    v_product.id,
    v_product.code,
    'ticket',
    v_folio,
    'ISSUED',
    now()
  )
  RETURNING * INTO v_ticket;
  v_created := true;

  INSERT INTO public.ticket_credential_generations (
    ticket_id,
    generation,
    token_hash,
    state,
    issued_at,
    expires_at
  ) VALUES (
    v_ticket.id,
    1,
    v_hash,
    'ACTIVE',
    now(),
    NULL
  )
  RETURNING * INTO v_gen;

  -- Single-day entitlement from product schedule (NULL session allowed).
  v_ent_date := v_product.day;
  IF v_ent_date IS NOT NULL THEN
    INSERT INTO public.access_entitlements (
      ticket_id, entitlement_date, session, state
    ) VALUES (
      v_ticket.id, v_ent_date, v_product.session, 'AVAILABLE'
    );
  END IF;

  -- TICKET_ACCESS capability (hash only; no raw token).
  INSERT INTO public.capability_credentials (
    kind, token_hash, least_scope, subject_ref, resource_ref,
    ticket_id, order_id, state, generation
  ) VALUES (
    'TICKET_ACCESS',
    encode(sha256(('ticket-access:' || v_ticket.id::text || ':' || v_gen.id::text)::bytea), 'hex'),
    'ticket:access',
    COALESCE(v_reg.participant_id::text, v_reg.access_holder_id::text),
    v_ticket.id::text,
    v_ticket.id,
    v_order.id,
    'ISSUED',
    1
  );

  -- Outbox without raw QR token / PII (delivery deferred OD-017).
  INSERT INTO public.outbox_delivery_jobs (
    communication_type, template, destination_ref, domain_event_ref, minimal_payload, state
  ) VALUES (
    'TICKET_READY',
    'TICKET_READY',
    'deferred:email',
    'ticket:' || v_ticket.id::text,
    jsonb_build_object(
      'ticket_id', v_ticket.id,
      'folio_namespace', v_ticket.folio_namespace,
      'product_code', v_ticket.product_code,
      'credential_generation', v_gen.generation
    ),
    'PENDING'
  );

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, sanitized_metadata
  ) VALUES (
    'rpc:ticket_issue',
    'TICKET_ISSUED',
    'ticket',
    v_ticket.id::text,
    'ISSUED',
    jsonb_build_object(
      'registration_id', v_reg.id,
      'product_code', v_product.code,
      'folio_namespace', 'ticket',
      'created', v_created,
      'raw_token_persisted', false,
      'email_sent', false
    )
  );

  -- Raw token returned only to SECURITY DEFINER caller; never persisted.
  RETURN jsonb_build_object(
    'ok', true,
    'replay', false,
    'ticket_id', v_ticket.id,
    'folio_namespace', v_ticket.folio_namespace,
    'folio', v_ticket.folio,
    'state', v_ticket.state,
    'credential_generation_id', v_gen.id,
    'raw_token', v_raw
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Concurrent issuer: return existing ticket without raw token.
    SELECT * INTO v_ticket FROM public.tickets WHERE registration_id = p_registration_id;
    RETURN jsonb_build_object(
      'ok', true,
      'replay', true,
      'ticket_id', v_ticket.id,
      'folio_namespace', v_ticket.folio_namespace,
      'folio', v_ticket.folio,
      'state', v_ticket.state,
      'raw_token', NULL,
      'concurrent', true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_issue_one_registration(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ticket_issue_one_registration(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_issue_one_registration(uuid) TO project_admin;

COMMENT ON FUNCTION public.ticket_issue_one_registration(uuid) IS
  'IMPL-11: idempotent issue of one ticket + hashed QR generation + single-day entitlement.';

-- After payment: issue for non-team registrations; teams wait for ELIGIBLE.
CREATE OR REPLACE FUNCTION public.ticket_issue_after_payment(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_reg record;
  v_product public.products%ROWTYPE;
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
    IF FOUND AND v_product.team_size > 1 THEN
      -- Team tickets only after roster ELIGIBLE (TX-3 / accept path).
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'registration_id', v_reg.id,
          'skipped', true,
          'error_code', 'ROSTER_NOT_ELIGIBLE'
        )
      );
      CONTINUE;
    END IF;

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

CREATE OR REPLACE FUNCTION public.ticket_issue_after_team_eligible(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_team public.teams%ROWTYPE;
  v_reg record;
  v_results jsonb := '[]'::jsonb;
  v_one jsonb;
  v_count integer := 0;
BEGIN
  IF p_team_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND OR v_team.roster_state IS DISTINCT FROM 'ELIGIBLE' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ROSTER_NOT_ELIGIBLE');
  END IF;

  FOR v_reg IN
    SELECT r.*
    FROM public.registrations r
    WHERE r.team_id = p_team_id
      AND r.state = 'PAYMENT_CONFIRMED'
    FOR UPDATE OF r
  LOOP
    v_one := public.ticket_issue_one_registration(v_reg.id);
    v_results := v_results || jsonb_build_array(v_one);
    IF COALESCE((v_one->>'ok')::boolean, false) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'ticket_count', v_count, 'results', v_results);
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_issue_after_team_eligible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ticket_issue_after_team_eligible(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_issue_after_team_eligible(uuid) TO project_admin;

-- Protected reissue: revoke active generation, mint replacement. No anon access.
CREATE OR REPLACE FUNCTION public.ticket_credential_reissue_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_ticket_id uuid := NULLIF(p->>'ticket_id', '')::uuid;
  v_key_hash text := p->>'idempotency_key_hash';
  v_fingerprint text := p->>'request_fingerprint';
  v_ttl integer := COALESCE((p->>'idempotency_ttl_seconds')::integer, 0);
  v_scope text := 'TICKET_REISSUE';
  v_existing public.idempotency_records%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
  v_active public.ticket_credential_generations%ROWTYPE;
  v_new public.ticket_credential_generations%ROWTYPE;
  v_raw text;
  v_hash text;
  v_next integer;
  v_response jsonb;
BEGIN
  IF v_ticket_id IS NULL OR v_key_hash IS NULL OR v_fingerprint IS NULL OR v_ttl <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  SELECT * INTO v_existing
  FROM public.idempotency_records
  WHERE scope = v_scope
    AND actor_context IS NULL
    AND key_hash = v_key_hash
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.request_fingerprint = v_fingerprint AND v_existing.response_ref IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'replay', true, 'prior_response', v_existing.response_ref::jsonb);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error_code', 'CONFLICT');
  END IF;

  SELECT * INTO v_ticket FROM public.tickets WHERE id = v_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'TICKET_NOT_FOUND');
  END IF;

  IF v_ticket.state IN ('REVOKED', 'CANCELLED') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'TICKET_REVOKED');
  END IF;

  SELECT * INTO v_active
  FROM public.ticket_credential_generations
  WHERE ticket_id = v_ticket.id
    AND state = 'ACTIVE'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_ACTIVE_CREDENTIAL');
  END IF;

  v_next := v_active.generation + 1;
  v_raw := public.ticket_new_opaque_token('qr_');
  v_hash := public.ticket_hash_token(v_raw);

  UPDATE public.ticket_credential_generations
  SET state = 'REVOKED',
      revoked_at = now(),
      updated_at = now()
  WHERE id = v_active.id;

  INSERT INTO public.ticket_credential_generations (
    ticket_id, generation, token_hash, state, issued_at, prior_generation_id, expires_at
  ) VALUES (
    v_ticket.id, v_next, v_hash, 'ACTIVE', now(), v_active.id, NULL
  )
  RETURNING * INTO v_new;

  UPDATE public.ticket_credential_generations
  SET replacement_generation_id = v_new.id,
      updated_at = now()
  WHERE id = v_active.id;

  UPDATE public.tickets
  SET state = 'REISSUED',
      reissued_at = now(),
      updated_at = now()
  WHERE id = v_ticket.id;

  -- Rotate TICKET_ACCESS capability: revoke prior active, mint new.
  UPDATE public.capability_credentials
  SET state = 'REVOKED',
      revoked_at = now(),
      updated_at = now()
  WHERE ticket_id = v_ticket.id
    AND kind = 'TICKET_ACCESS'
    AND state = 'ISSUED';

  INSERT INTO public.capability_credentials (
    kind, token_hash, least_scope, subject_ref, resource_ref,
    ticket_id, state, generation
  ) VALUES (
    'TICKET_ACCESS',
    encode(sha256(('ticket-access:' || v_ticket.id::text || ':' || v_new.id::text)::bytea), 'hex'),
    'ticket:access',
    COALESCE(v_ticket.participant_id::text, v_ticket.access_holder_id::text),
    v_ticket.id::text,
    v_ticket.id,
    'ISSUED',
    v_next
  );

  v_response := jsonb_build_object(
    'ticket_id', v_ticket.id,
    'folio_namespace', v_ticket.folio_namespace,
    'folio', v_ticket.folio,
    'generation', v_new.generation,
    'prior_generation', v_active.generation,
    'raw_token', v_raw
  );

  INSERT INTO public.idempotency_records (
    scope, actor_context, key_hash, request_fingerprint, state, response_ref, expires_at
  ) VALUES (
    v_scope, NULL, v_key_hash, v_fingerprint, 'COMPLETED',
    -- Never store raw token in idempotency response_ref.
    (v_response - 'raw_token')::text,
    now() + make_interval(secs => v_ttl)
  );

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, sanitized_metadata
  ) VALUES (
    'rpc:ticket_reissue',
    'TICKET_CREDENTIAL_REISSUED',
    'ticket',
    v_ticket.id::text,
    'REISSUED',
    jsonb_build_object(
      'generation', v_new.generation,
      'prior_generation', v_active.generation,
      'raw_token_persisted', false
    )
  );

  RETURN jsonb_build_object('ok', true, 'replay', false, 'response', v_response);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CONFLICT');
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_credential_reissue_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ticket_credential_reissue_tx(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_credential_reissue_tx(jsonb) TO project_admin;

-- Server-side verify (hash lookup). No PII. For protected test / future check-in authority.
CREATE OR REPLACE FUNCTION public.ticket_credential_verify_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_raw text := NULLIF(p->>'token', '');
  v_hash text;
  v_gen public.ticket_credential_generations%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
BEGIN
  IF v_raw IS NULL OR v_raw !~ '^qr_[0-9a-f]{32}$' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_TOKEN');
  END IF;

  v_hash := public.ticket_hash_token(v_raw);

  SELECT * INTO v_gen
  FROM public.ticket_credential_generations
  WHERE token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CREDENTIAL_NOT_FOUND');
  END IF;

  SELECT * INTO v_ticket FROM public.tickets WHERE id = v_gen.ticket_id;

  RETURN jsonb_build_object(
    'ok', true,
    'valid', v_gen.state = 'ACTIVE' AND v_ticket.state IN ('ISSUED', 'REISSUED'),
    'credential_state', v_gen.state,
    'ticket_state', v_ticket.state,
    'folio_namespace', v_ticket.folio_namespace,
    'folio', v_ticket.folio,
    'product_code', v_ticket.product_code,
    'generation', v_gen.generation
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_credential_verify_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ticket_credential_verify_tx(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_credential_verify_tx(jsonb) TO project_admin;

-- Minimal projection for protected operators (no raw token, no PII).
CREATE OR REPLACE FUNCTION public.ticket_get_projection_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_ticket_id uuid := NULLIF(p->>'ticket_id', '')::uuid;
  v_ticket public.tickets%ROWTYPE;
  v_gen public.ticket_credential_generations%ROWTYPE;
BEGIN
  IF v_ticket_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  SELECT * INTO v_ticket FROM public.tickets WHERE id = v_ticket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'TICKET_NOT_FOUND');
  END IF;

  SELECT * INTO v_gen
  FROM public.ticket_credential_generations
  WHERE ticket_id = v_ticket.id
    AND state = 'ACTIVE'
  ORDER BY generation DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'projection', jsonb_build_object(
      'ticket_id', v_ticket.id,
      'folio_namespace', v_ticket.folio_namespace,
      'folio', v_ticket.folio,
      'state', v_ticket.state,
      'product_code', v_ticket.product_code,
      'active_generation', v_gen.generation,
      'issued_at', v_ticket.issued_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_get_projection_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ticket_get_projection_tx(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_get_projection_tx(jsonb) TO project_admin;

COMMENT ON FUNCTION public.ticket_issue_after_payment(uuid) IS
  'IMPL-11: after TX-2 PAID, issue tickets for non-team eligible registrations.';
COMMENT ON FUNCTION public.ticket_issue_after_team_eligible(uuid) IS
  'IMPL-11: after team ELIGIBLE, issue full personal ticket set idempotently.';
COMMENT ON FUNCTION public.ticket_credential_reissue_tx(jsonb) IS
  'IMPL-11: protected reissue; revokes prior ACTIVE generation; returns raw token once.';
COMMENT ON FUNCTION public.ticket_credential_verify_tx(jsonb) IS
  'IMPL-11: protected hash verify; no check-in / used_at mutation.';


CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_provider text := 'MERCADOPAGO';
  v_notification_id text := p->>'provider_notification_id';
  v_notification_type text := COALESCE(p->>'notification_type', 'payment');
  v_canonical_hash text := p->>'canonical_input_hash';
  v_headers jsonb := COALESCE(p->'sanitized_headers', '{}'::jsonb);
  v_provider_payment_id text := p->>'provider_payment_id';
  v_external_state text := p->>'external_state';
  v_normalized text := p->>'normalized_state';
  v_amount_cents bigint := COALESCE((p->>'amount_cents')::bigint, -1);
  v_currency text := upper(COALESCE(p->>'currency', ''));
  v_external_reference text := COALESCE(p->>'external_reference', '');
  v_merchant_ok boolean := COALESCE((p->>'merchant_ownership_ok')::boolean, false);
  v_ref_ok boolean := COALESCE((p->>'external_reference_ok')::boolean, false);
  v_amount_pre_ok boolean := COALESCE((p->>'amount_ok')::boolean, false);
  v_currency_ok boolean := COALESCE((p->>'currency_ok')::boolean, false);
  v_provider_created timestamptz := NULLIF(p->>'provider_created_at', '')::timestamptz;
  v_provider_updated timestamptz := NULLIF(p->>'provider_updated_at', '')::timestamptz;
  v_correlation text := p->>'correlation_id';

  v_existing_wh public.webhook_events%ROWTYPE;
  v_webhook_id uuid;
  v_order public.orders%ROWTYPE;
  v_order_found boolean := false;
  v_payment public.payments%ROWTYPE;
  v_payment_found boolean := false;
  v_hold public.capacity_holds%ROWTYPE;
  v_hold_found boolean := false;
  v_verification_id uuid;
  v_amount_ok boolean;
  v_all_ok boolean;
  v_outcome text;
  v_order_target text;
  v_hold_target text;
  v_reg_target text;
  v_payment_target text;
  v_create_outbox boolean := false;
  v_rank_new integer;
  v_rank_old integer;
BEGIN
  IF v_notification_id IS NULL OR v_provider_payment_id IS NULL OR v_normalized IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  IF v_normalized NOT IN ('UNKNOWN', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  -- Idempotent receipt by provider notification id (delivery identity).
  SELECT * INTO v_existing_wh
  FROM public.webhook_events
  WHERE provider = v_provider
    AND provider_notification_id = v_notification_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_wh.processing_state IN ('PROCESSED', 'IGNORED') THEN
      RETURN jsonb_build_object(
        'ok', true,
        'replay', true,
        'outcome', 'DUPLICATE'
      );
    END IF;
    v_webhook_id := v_existing_wh.id;
  ELSE
    INSERT INTO public.webhook_events (
      provider,
      provider_notification_id,
      notification_type,
      signature_result,
      canonical_input_hash,
      sanitized_headers,
      processing_state,
      attempts,
      result,
      received_at
    ) VALUES (
      v_provider,
      v_notification_id,
      v_notification_type,
      'VALID',
      v_canonical_hash,
      v_headers,
      'RECEIVED',
      1,
      NULL,
      now()
    )
    RETURNING id INTO v_webhook_id;
  END IF;

  -- Resolve order by external_reference (= order_id text from IMPL-7).
  SELECT * INTO v_order
  FROM public.orders
  WHERE external_reference = v_external_reference
     OR id::text = v_external_reference
  FOR UPDATE;
  v_order_found := FOUND;

  v_amount_ok := v_amount_pre_ok AND v_order_found AND v_amount_cents = v_order.total_cents;
  v_ref_ok := v_ref_ok AND v_order_found;
  v_all_ok := v_merchant_ok AND v_ref_ok AND v_amount_ok AND v_currency_ok AND v_order_found;

  INSERT INTO public.payment_verification_records (
    order_id,
    sanitized_provider_evidence_ref,
    merchant_ownership_ok,
    external_reference_ok,
    amount_ok,
    currency_ok,
    normalized_result,
    verified_at,
    correlation_id,
    reconciliation_state
  ) VALUES (
    CASE WHEN v_order_found THEN v_order.id ELSE NULL END,
    'mp_payment:' || v_provider_payment_id,
    v_merchant_ok,
    v_ref_ok,
    v_amount_ok,
    v_currency_ok,
    CASE WHEN v_all_ok THEN v_normalized ELSE 'VERIFICATION_FAILED' END,
    now(),
    v_correlation,
    CASE WHEN v_all_ok THEN 'VERIFIED' ELSE 'MISMATCH' END
  )
  RETURNING id INTO v_verification_id;

  IF NOT v_order_found OR NOT v_all_ok THEN
    UPDATE public.webhook_events
    SET processing_state = 'PROCESSED',
        result = 'VERIFICATION_REJECTED',
        sanitized_error = CASE
          WHEN NOT v_order_found THEN 'ORDER_NOT_FOUND'
          WHEN NOT v_merchant_ok THEN 'MERCHANT_MISMATCH'
          WHEN NOT v_ref_ok THEN 'REFERENCE_MISMATCH'
          WHEN NOT v_amount_ok THEN 'AMOUNT_MISMATCH'
          WHEN NOT v_currency_ok THEN 'CURRENCY_MISMATCH'
          ELSE 'VERIFICATION_FAILED'
        END,
        processed_at = now(),
        updated_at = now()
    WHERE id = v_webhook_id;

    INSERT INTO public.activity_log (
      actor_ref, named_action, entity_type, entity_ref, result, failure_class, correlation_id, sanitized_metadata
    ) VALUES (
      'mp-webhook',
      'WEBHOOK_VERIFICATION_REJECTED',
      'payment',
      v_provider_payment_id,
      'REJECTED',
      'VERIFICATION',
      v_correlation,
      jsonb_build_object(
        'verification_id', v_verification_id,
        'merchant_ok', v_merchant_ok,
        'ref_ok', v_ref_ok,
        'amount_ok', v_amount_ok,
        'currency_ok', v_currency_ok
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'VERIFICATION_REJECTED',
      'verification_id', v_verification_id
    );
  END IF;

  -- Upsert payment by provider payment id.
  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider = v_provider
    AND provider_payment_id = v_provider_payment_id
  FOR UPDATE;
  v_payment_found := FOUND;

  v_rank_new := CASE v_normalized
    WHEN 'UNKNOWN' THEN 0
    WHEN 'PENDING' THEN 1
    WHEN 'REJECTED' THEN 2
    WHEN 'CANCELLED' THEN 2
    WHEN 'APPROVED' THEN 3
    WHEN 'REFUNDED' THEN 4
    WHEN 'CHARGED_BACK' THEN 4
    ELSE 0
  END;

  IF v_payment_found THEN
    v_rank_old := CASE v_payment.normalized_state
      WHEN 'UNKNOWN' THEN 0
      WHEN 'PENDING' THEN 1
      WHEN 'REJECTED' THEN 2
      WHEN 'CANCELLED' THEN 2
      WHEN 'APPROVED' THEN 3
      WHEN 'REFUNDED' THEN 4
      WHEN 'CHARGED_BACK' THEN 4
      ELSE 0
    END;

    IF v_rank_new < v_rank_old THEN
      -- Out-of-order: do not regress canonical payment state.
      v_payment_target := v_payment.normalized_state;
    ELSE
      v_payment_target := v_normalized;
    END IF;

    UPDATE public.payments
    SET order_id = v_order.id,
        external_state = v_external_state,
        normalized_state = v_payment_target,
        amount_cents = v_amount_cents,
        currency = v_currency,
        external_reference = v_external_reference,
        provider_created_at = COALESCE(v_provider_created, provider_created_at),
        provider_updated_at = COALESCE(v_provider_updated, provider_updated_at),
        last_verified_at = now(),
        sanitized_evidence_ref = 'mp_payment:' || v_provider_payment_id,
        reconciliation_state = 'VERIFIED',
        updated_at = now()
    WHERE id = v_payment.id;
  ELSE
    v_payment_target := v_normalized;
    INSERT INTO public.payments (
      provider,
      provider_payment_id,
      order_id,
      external_state,
      normalized_state,
      amount_cents,
      currency,
      external_reference,
      provider_created_at,
      provider_updated_at,
      last_verified_at,
      sanitized_evidence_ref,
      reconciliation_state
    ) VALUES (
      v_provider,
      v_provider_payment_id,
      v_order.id,
      v_external_state,
      v_payment_target,
      v_amount_cents,
      v_currency,
      v_external_reference,
      v_provider_created,
      v_provider_updated,
      now(),
      'mp_payment:' || v_provider_payment_id,
      'VERIFIED'
    )
    RETURNING * INTO v_payment;
  END IF;

  UPDATE public.payment_verification_records
  SET payment_id = v_payment.id
  WHERE id = v_verification_id;

  UPDATE public.webhook_events
  SET payment_id = v_payment.id
  WHERE id = v_webhook_id;

  -- Select hold for order.
  SELECT * INTO v_hold
  FROM public.capacity_holds
  WHERE order_id = v_order.id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;
  v_hold_found := FOUND;

  v_order_target := v_order.state;
  v_hold_target := CASE WHEN v_hold_found THEN v_hold.state ELSE NULL END;
  v_reg_target := NULL;
  v_outcome := 'APPLIED';

  IF v_payment_target = 'APPROVED' THEN
    IF v_hold_found AND (v_hold.state = 'EXPIRED' OR (v_hold.state = 'ACTIVE' AND v_hold.expires_at IS NOT NULL AND v_hold.expires_at < now()) OR v_hold.state = 'RELEASED') THEN
      -- SPEC-032-R042 late/expired hold: preserve APPROVED payment; review/conflict; no tickets.
      v_order_target := 'REQUIRES_REVIEW';
      IF v_hold.state IN ('EXPIRED', 'RELEASED', 'ACTIVE') THEN
        v_hold_target := 'CONFLICT';
      END IF;
      v_create_outbox := true;
      v_outcome := 'REQUIRES_REVIEW';
    ELSIF v_order.state IN ('PAYMENT_PENDING', 'PREFERENCE_PENDING', 'CREATED') THEN
      v_order_target := 'PAID';
      IF v_hold_found AND v_hold.state = 'ACTIVE' THEN
        v_hold_target := 'CONVERTED';
      END IF;
      v_reg_target := 'PAYMENT_CONFIRMED';
      v_outcome := 'PAID';
    ELSIF v_order.state = 'PAID' THEN
      v_outcome := 'ALREADY_PAID';
    ELSIF v_order.state = 'REQUIRES_REVIEW' THEN
      v_outcome := 'ALREADY_REVIEW';
    END IF;
  ELSIF v_payment_target = 'PENDING' THEN
    IF v_order.state IN ('PREFERENCE_PENDING', 'CREATED') THEN
      v_order_target := 'PAYMENT_PENDING';
    END IF;
    IF v_hold_found AND v_hold.state = 'ACTIVE' THEN
      v_hold_target := 'ACTIVE'; -- retain hold
    END IF;
    v_outcome := 'PENDING';
  ELSIF v_payment_target IN ('REJECTED', 'CANCELLED') THEN
    IF v_order.state IN ('CREATED', 'PREFERENCE_PENDING', 'PAYMENT_PENDING') THEN
      v_order_target := CASE WHEN v_payment_target = 'REJECTED' THEN 'REJECTED' ELSE 'CANCELLED' END;
    END IF;
    IF v_hold_found AND v_hold.state = 'ACTIVE' THEN
      v_hold_target := 'RELEASED';
    END IF;
    v_reg_target := 'CANCELLED';
    v_outcome := v_payment_target;
  ELSIF v_payment_target IN ('REFUNDED', 'CHARGED_BACK') THEN
    IF v_order.state IN ('PAID', 'REQUIRES_REVIEW') THEN
      v_order_target := v_payment_target;
    END IF;
    v_create_outbox := true;
    v_outcome := v_payment_target;
  END IF;

  -- Apply order transition (never regress PAID to pending/rejected via stale webhook).
  IF v_order_target IS DISTINCT FROM v_order.state THEN
    IF v_order.state = 'PAID' AND v_order_target IN ('PAYMENT_PENDING', 'REJECTED', 'CANCELLED', 'CREATED', 'PREFERENCE_PENDING') THEN
      NULL; -- ignore regressive order transition
    ELSE
      UPDATE public.orders
      SET state = v_order_target,
          updated_at = now()
      WHERE id = v_order.id;
    END IF;
  END IF;

  IF v_hold_target IS NOT NULL AND v_hold_found AND v_hold_target IS DISTINCT FROM v_hold.state THEN
    UPDATE public.capacity_holds
    SET state = v_hold_target,
        converted_at = CASE WHEN v_hold_target = 'CONVERTED' THEN now() ELSE converted_at END,
        released_at = CASE WHEN v_hold_target IN ('RELEASED', 'CONFLICT') THEN COALESCE(released_at, now()) ELSE released_at END,
        updated_at = now()
    WHERE id = v_hold.id;
  END IF;

  IF v_reg_target IS NOT NULL THEN
    UPDATE public.registrations
    SET state = CASE
          WHEN state IN ('STARTED', 'PENDING_PAYMENT') AND v_reg_target = 'PAYMENT_CONFIRMED' THEN 'PAYMENT_CONFIRMED'
          WHEN state IN ('STARTED', 'PENDING_PAYMENT') AND v_reg_target = 'CANCELLED' THEN 'CANCELLED'
          ELSE state
        END,
        updated_at = now()
    WHERE order_id = v_order.id;
  END IF;

  IF v_create_outbox THEN
    INSERT INTO public.outbox_delivery_jobs (
      communication_type,
      template,
      destination_ref,
      domain_event_ref,
      minimal_payload,
      state
    ) VALUES (
      'INTERNAL_ALERT',
      CASE
        WHEN v_outcome = 'REQUIRES_REVIEW' THEN 'PAYMENT_REQUIRES_REVIEW'
        ELSE 'PAYMENT_CORRECTIVE_STATE'
      END,
      'ops:payments',
      'order:' || v_order.id::text,
      jsonb_build_object(
        'order_id', v_order.id,
        'payment_id', v_payment.id,
        'outcome', v_outcome,
        'normalized_state', v_payment_target
      ),
      'PENDING'
    );
  END IF;

  -- IMPL-10: sync team roster_state from payment outcome.
  IF v_order_found THEN
    PERFORM public.team_apply_payment_outcome(v_order.id, v_outcome);
  END IF;

  -- IMPL-11: idempotent ticket issuance before audit metadata snapshot.
  IF v_order_found AND v_outcome IN ('PAID', 'ALREADY_PAID') THEN
    PERFORM public.ticket_issue_after_payment(v_order.id);
  END IF;

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, correlation_id, sanitized_metadata
  ) VALUES (
    'mp-webhook',
    'WEBHOOK_PAYMENT_APPLIED',
    'order',
    v_order.id::text,
    v_outcome,
    v_correlation,
    jsonb_build_object(
      'provider_payment_id', v_provider_payment_id,
      'normalized_state', v_payment_target,
      'order_state', v_order_target,
      'hold_state', v_hold_target,
      'tickets_emitted', EXISTS (
        SELECT 1
        FROM public.tickets t
        JOIN public.registrations r ON r.id = t.registration_id
        WHERE r.order_id = v_order.id
      ),
      'qr_created', EXISTS (
        SELECT 1
        FROM public.ticket_credential_generations g
        JOIN public.tickets t ON t.id = g.ticket_id
        JOIN public.registrations r ON r.id = t.registration_id
        WHERE r.order_id = v_order.id
          AND g.state = 'ACTIVE'
      ),
      'email_sent', false
    )
  );

  UPDATE public.webhook_events
  SET processing_state = 'PROCESSED',
      result = v_outcome,
      processed_at = now(),
      updated_at = now(),
      attempts = attempts + CASE WHEN processing_state = 'RECEIVED' THEN 0 ELSE 1 END
  WHERE id = v_webhook_id;

  RETURN jsonb_build_object(
    'ok', true,
    'outcome', v_outcome,
    'webhook_event_id', v_webhook_id,
    'payment_id', v_payment.id,
    'order_id', v_order.id,
    'verification_id', v_verification_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_apply_payment_tx(jsonb) TO project_admin;



COMMENT ON FUNCTION public.webhook_apply_payment_tx(jsonb) IS
  'IMPL-11 TX-2: apply verified Mercado Pago payment effects atomically; issues eligible tickets/QR hashes; no email delivery.';

CREATE OR REPLACE FUNCTION public.team_roster_accept_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_hash text := p->>'token_hash';
  v_key_hash text := p->>'idempotency_key_hash';
  v_fingerprint text := p->>'request_fingerprint';
  v_ttl integer := COALESCE((p->>'idempotency_ttl_seconds')::integer, 0);
  v_scope text := 'OP-PUB-07';
  v_existing public.idempotency_records%ROWTYPE;
  v_cap public.capability_credentials%ROWTYPE;
  v_team public.teams%ROWTYPE;
  v_member public.team_members%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_event_id uuid;
  v_event_code text;
  v_journey text;
  v_participant_id uuid;
  v_registration_id uuid;
  v_waiver_doc_id uuid;
  v_waiver_acc_id uuid;
  v_waiver_type text := NULLIF(p->>'waiver_document_type', '');
  v_waiver_version text := NULLIF(p->>'waiver_document_version', '');
  v_waiver_accepted boolean := COALESCE((p->>'waiver_accepted')::boolean, false);
  v_participant_ref text := COALESCE(NULLIF(p->>'participant_public_ref', ''), 'part_' || replace(gen_random_uuid()::text, '-', ''));
  v_completed integer;
  v_roster_state text;
  v_response jsonb;
BEGIN
  IF v_hash IS NULL OR v_key_hash IS NULL OR v_fingerprint IS NULL OR v_ttl <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  IF NOT v_waiver_accepted OR v_waiver_type IS NULL OR v_waiver_version IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'WAIVER_REQUIRED');
  END IF;

  SELECT * INTO v_existing
  FROM public.idempotency_records
  WHERE scope = v_scope
    AND actor_context IS NULL
    AND key_hash = v_key_hash
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.request_fingerprint = v_fingerprint AND v_existing.response_ref IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'replay', true, 'prior_response', v_existing.response_ref::jsonb);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error_code', 'CONFLICT');
  END IF;

  SELECT * INTO v_cap
  FROM public.capability_credentials
  WHERE token_hash = v_hash
    AND kind = 'INVITATION_EXCHANGE_CODE'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVITATION_NOT_FOUND');
  END IF;

  IF v_cap.state IN ('REVOKED', 'EXPIRED', 'REPLACED', 'CONSUMED')
     OR (v_cap.expires_at IS NOT NULL AND v_cap.expires_at < now()) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVITATION_INACTIVE');
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = v_cap.team_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVITATION_NOT_FOUND');
  END IF;

  SELECT * INTO v_member
  FROM public.team_members
  WHERE id = v_cap.team_member_id
  FOR UPDATE;

  IF NOT FOUND OR v_member.state IS DISTINCT FROM 'INVITED' OR v_member.participant_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ROSTER_FULL');
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders o
  JOIN public.registrations r ON r.order_id = o.id
  WHERE r.team_id = v_team.id
  ORDER BY o.created_at ASC
  LIMIT 1
  FOR UPDATE OF o;

  IF NOT FOUND OR v_order.state IS DISTINCT FROM 'PAID' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PAYMENT_REQUIRED');
  END IF;

  IF v_team.roster_state NOT IN ('PAID_ROSTER_INCOMPLETE', 'PAID_ROSTER_COMPLETE') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVITATION_INACTIVE');
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = v_team.product_id;
  SELECT r.event_id, r.event_code, r.journey
    INTO v_event_id, v_event_code, v_journey
  FROM public.registrations r
  WHERE r.team_id = v_team.id
    AND r.team_member_id = v_team.captain_team_member_id
  LIMIT 1;

  INSERT INTO public.waiver_documents (document_type, version, state, valid_from)
  VALUES (v_waiver_type, v_waiver_version, 'ACTIVE', now())
  ON CONFLICT (document_type, version) DO NOTHING;

  SELECT id INTO v_waiver_doc_id
  FROM public.waiver_documents
  WHERE document_type = v_waiver_type
    AND version = v_waiver_version
    AND state = 'ACTIVE';

  IF v_waiver_doc_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'WAIVER_CONFIGURATION_REQUIRED');
  END IF;

  BEGIN
    INSERT INTO public.participants (public_ref, participation_type, state)
    VALUES (v_participant_ref, 'COMPETITOR', 'ACTIVE')
    RETURNING id INTO v_participant_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'DUPLICATE_PARTICIPANT');
  END;

  INSERT INTO public.registrations (
    event_id, event_code, product_id, product_code, participant_id,
    team_id, team_member_id, order_id, journey, state
  ) VALUES (
    v_event_id,
    COALESCE(v_event_code, v_product.event_code),
    v_product.id,
    v_product.code,
    v_participant_id,
    v_team.id,
    v_member.id,
    v_order.id,
    COALESCE(v_journey, v_product.journey),
    'PAYMENT_CONFIRMED'
  )
  RETURNING id INTO v_registration_id;

  INSERT INTO public.waiver_acceptances (
    waiver_document_id, document_type, document_version, participant_id,
    actor_ref, context, authorized_evidence, accepted_at
  ) VALUES (
    v_waiver_doc_id, v_waiver_type, v_waiver_version, v_participant_id,
    'edge:team-roster', 'INVITEE_SELF',
    jsonb_build_object('source', 'team_roster_accept'),
    now()
  )
  RETURNING id INTO v_waiver_acc_id;

  UPDATE public.team_members
  SET participant_id = v_participant_id,
      registration_id = v_registration_id,
      waiver_acceptance_id = v_waiver_acc_id,
      state = 'COMPLETE',
      updated_at = now()
  WHERE id = v_member.id;

  UPDATE public.capability_credentials
  SET state = 'CONSUMED',
      consumed_at = now(),
      updated_at = now()
  WHERE id = v_cap.id;

  SELECT COUNT(*)::integer INTO v_completed
  FROM public.team_members
  WHERE team_id = v_team.id
    AND state = 'COMPLETE';

  IF v_completed >= v_team.required_size THEN
    v_roster_state := 'ELIGIBLE';
  ELSE
    v_roster_state := 'PAID_ROSTER_INCOMPLETE';
  END IF;

  UPDATE public.teams
  SET slots_complete = v_completed,
      roster_state = v_roster_state,
      eligibility_state = CASE WHEN v_roster_state = 'ELIGIBLE' THEN 'ELIGIBLE' ELSE 'NOT_ELIGIBLE' END,
      updated_at = now()
  WHERE id = v_team.id;

  INSERT INTO public.idempotency_records (
    scope, actor_context, key_hash, request_fingerprint, state, response_ref, expires_at
  ) VALUES (
    v_scope, NULL, v_key_hash, v_fingerprint, 'COMPLETED', NULL,
    now() + make_interval(secs => v_ttl)
  );

  v_response := jsonb_build_object(
    'status', CASE WHEN v_roster_state = 'ELIGIBLE' THEN 'TEAM_ELIGIBLE' ELSE 'MEMBER_ACCEPTED' END,
    'required_members', v_team.required_size,
    'completed_members', v_completed,
    'remaining_members', GREATEST(v_team.required_size - v_completed, 0),
    'terminal', v_roster_state = 'ELIGIBLE'
  );

  UPDATE public.idempotency_records
  SET response_ref = v_response::text,
      updated_at = now()
  WHERE scope = v_scope AND actor_context IS NULL AND key_hash = v_key_hash;

  -- IMPL-11: when roster becomes ELIGIBLE, emit full ticket set idempotently.
  IF v_roster_state = 'ELIGIBLE' THEN
    PERFORM public.ticket_issue_after_team_eligible(v_team.id);
  END IF;

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, sanitized_metadata
  ) VALUES (
    'edge:team-roster',
    'TEAM_ROSTER_ACCEPT',
    'team',
    v_team.id::text,
    v_roster_state,
    jsonb_build_object(
      'completed_members', v_completed,
      'required_members', v_team.required_size,
      'tickets_emitted', EXISTS (
        SELECT 1
        FROM public.tickets t
        JOIN public.registrations r ON r.id = t.registration_id
        WHERE r.team_id = v_team.id
      ),
      'qr_created', EXISTS (
        SELECT 1
        FROM public.ticket_credential_generations g
        JOIN public.tickets t ON t.id = g.ticket_id
        JOIN public.registrations r ON r.id = t.registration_id
        WHERE r.team_id = v_team.id
          AND g.state = 'ACTIVE'
      ),
      'email_sent', false
    )
  );

  RETURN jsonb_build_object('ok', true, 'replay', false, 'response', v_response);
END;
$$;

REVOKE ALL ON FUNCTION public.team_roster_accept_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_roster_accept_tx(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_roster_accept_tx(jsonb) TO project_admin;


COMMENT ON FUNCTION public.team_roster_accept_tx(jsonb) IS
  'IMPL-11 TX-3 accept: complete invitee slot; on ELIGIBLE issue personal tickets/QR hashes; no email delivery.';

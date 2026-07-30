-- =====================================================================
-- Ready2Hybrid — IMPL-14A-3C durable scheduled-run lease.
--
-- D3C-1:
--   scope = payment_pending_expiry_run
--   key = global
--   owner = run_id
--   TTL = 90 seconds
--   expired leases are reclaimable; live overlap is skipped.
--
-- D3C-2 SANDBOX:
--   project_admin is a temporary compensating integration control.
--   True least privilege is NOT ACHIEVED; Main and production remain blocked.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.acquire_payment_pending_expiry_run_lease_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_run_id uuid;
  v_actor_ref text := NULLIF(p->>'actor_ref', '');
  v_requested_ttl integer;
  v_now timestamptz := clock_timestamp();
  v_owner text;
  v_expires_at timestamptz;
BEGIN
  BEGIN
    v_run_id := NULLIF(p->>'run_id', '')::uuid;
    v_requested_ttl := NULLIF(p->>'ttl_seconds', '')::integer;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RETURN jsonb_build_object(
        'ok', false,
        'outcome', 'invalid_input',
        'error_code', 'INVALID_INPUT'
      );
  END;

  IF v_run_id IS NULL
     OR v_actor_ref IS DISTINCT FROM 'system:payment-pending-expiry'
     OR v_requested_ttl IS DISTINCT FROM 90 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'outcome', 'invalid_input',
      'error_code', 'INVALID_INPUT'
    );
  END IF;

  INSERT INTO public.idempotency_records (
    scope,
    actor_context,
    key_hash,
    request_fingerprint,
    state,
    response_ref,
    expires_at
  ) VALUES (
    'payment_pending_expiry_run',
    'system:payment-pending-expiry',
    'global',
    'payment_pending_expiry_run:global:v1',
    'IN_PROGRESS',
    v_run_id::text,
    v_now + make_interval(secs => 90)
  )
  ON CONFLICT (scope, actor_context, key_hash)
    WHERE actor_context IS NOT NULL
  DO UPDATE
  SET request_fingerprint = 'payment_pending_expiry_run:global:v1',
      state = 'IN_PROGRESS',
      response_ref = v_run_id::text,
      expires_at = v_now + make_interval(secs => 90),
      updated_at = v_now
  WHERE idempotency_records.expires_at <= v_now
  RETURNING response_ref, expires_at
  INTO v_owner, v_expires_at;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'acquired',
      'run_id', v_run_id,
      'expires_at', v_expires_at
    );
  END IF;

  SELECT response_ref, expires_at
  INTO v_owner, v_expires_at
  FROM public.idempotency_records
  WHERE scope = 'payment_pending_expiry_run'
    AND actor_context = 'system:payment-pending-expiry'
    AND key_hash = 'global';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'outcome', 'error',
      'error_code', 'LEASE_STATE_UNAVAILABLE'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'outcome', 'overlap_skipped',
    'owner_run_id', v_owner,
    'expires_at', v_expires_at
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.release_payment_pending_expiry_run_lease_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_run_id uuid;
  v_actor_ref text := NULLIF(p->>'actor_ref', '');
  v_now timestamptz := clock_timestamp();
  v_lease public.idempotency_records%ROWTYPE;
BEGIN
  BEGIN
    v_run_id := NULLIF(p->>'run_id', '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('ok', false, 'outcome', 'invalid_input');
  END;

  IF v_run_id IS NULL
     OR v_actor_ref IS DISTINCT FROM 'system:payment-pending-expiry' THEN
    RETURN jsonb_build_object('ok', false, 'outcome', 'invalid_input');
  END IF;

  SELECT * INTO v_lease
  FROM public.idempotency_records
  WHERE scope = 'payment_pending_expiry_run'
    AND actor_context = 'system:payment-pending-expiry'
    AND key_hash = 'global'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'outcome', 'not_found');
  END IF;

  IF v_lease.response_ref IS DISTINCT FROM v_run_id::text THEN
    RETURN jsonb_build_object('ok', true, 'outcome', 'not_owner');
  END IF;

  IF v_lease.expires_at IS NULL OR v_lease.expires_at <= v_now THEN
    RETURN jsonb_build_object('ok', true, 'outcome', 'already_expired');
  END IF;

  UPDATE public.idempotency_records
  SET state = 'COMPLETED',
      expires_at = v_now,
      updated_at = v_now
  WHERE id = v_lease.id
    AND response_ref = v_run_id::text;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'outcome', 'not_owner');
  END IF;

  RETURN jsonb_build_object('ok', true, 'outcome', 'released');
END;
$$;


REVOKE EXECUTE ON FUNCTION public.acquire_payment_pending_expiry_run_lease_tx(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.acquire_payment_pending_expiry_run_lease_tx(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.acquire_payment_pending_expiry_run_lease_tx(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_payment_pending_expiry_run_lease_tx(jsonb) TO project_admin;

REVOKE EXECUTE ON FUNCTION public.release_payment_pending_expiry_run_lease_tx(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_payment_pending_expiry_run_lease_tx(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_payment_pending_expiry_run_lease_tx(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_payment_pending_expiry_run_lease_tx(jsonb) TO project_admin;

COMMENT ON FUNCTION public.acquire_payment_pending_expiry_run_lease_tx(jsonb) IS
  'IMPL-14A-3C D3C-1: atomically acquires or reclaims the fixed global payment-pending-expiry lease for a validated run_id. TTL is fixed at 90 seconds. Every live lease returns overlap_skipped, including a replay with the same run_id, so caller-controlled run IDs cannot bypass single-flight. project_admin is a sandbox compensating control only; true least privilege is not achieved and Main/production remain blocked.';

COMMENT ON FUNCTION public.release_payment_pending_expiry_run_lease_tx(jsonb) IS
  'IMPL-14A-3C D3C-1: releases the fixed global payment-pending-expiry lease only when run_id matches the durable owner. No caller-selected scope or lease key. project_admin is a sandbox compensating control only; true least privilege is not achieved and Main/production remain blocked.';

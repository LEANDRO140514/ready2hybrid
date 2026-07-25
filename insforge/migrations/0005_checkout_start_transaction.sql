-- =====================================================================
-- 0005_checkout_start_transaction.sql
-- Purpose: Atomic TX-1 reservation helper for mp-create-checkout (IMPL-7).
-- Authority: Explicit Project Owner authorization for IMPL-7.
--
-- Limits:
--  · Creates ONLY the SECURITY DEFINER RPC checkout_start_tx(jsonb)
--    and checkout_attach_preference / checkout_compensate_preference helpers.
--  · Does NOT create tables, columns, triggers, extensions, or policies.
--  · Does NOT alter catalog data.
--  · Does NOT GRANT EXECUTE to PUBLIC or anon.
--  · EXECUTE granted only to project_admin (edge admin client).
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.checkout_start_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_key_hash text := p->>'idempotency_key_hash';
  v_fingerprint text := p->>'request_fingerprint';
  v_scope text := 'OP-PUB-04';
  v_existing public.idempotency_records%ROWTYPE;
  v_active_holds integer;
  v_buyer_id uuid;
  v_participant_id uuid;
  v_registration_id uuid;
  v_order_id uuid;
  v_item_id uuid;
  v_hold_id uuid;
  v_tracking text;
  v_expires_at timestamptz;
  v_hold_seconds integer := COALESCE((p->>'hold_duration_seconds')::integer, 0);
  v_ttl_seconds integer := COALESCE((p->>'idempotency_ttl_seconds')::integer, 0);
  v_qty integer := COALESCE((p->>'quantity')::integer, 1);
  v_units integer := COALESCE((p->>'capacity_units')::integer, 1);
  v_token_hash text;
BEGIN
  IF v_key_hash IS NULL OR v_fingerprint IS NULL OR v_hold_seconds <= 0 OR v_ttl_seconds <= 0 THEN
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
      RETURN jsonb_build_object(
        'ok', true,
        'replay', true,
        'prior_response', v_existing.response_ref::jsonb
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error_code', 'CONFLICT');
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE code = p->>'product_code'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PRODUCT_NOT_FOUND');
  END IF;

  SELECT * INTO v_event
  FROM public.events
  WHERE code = v_product.event_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PRODUCT_NOT_FOUND');
  END IF;

  IF v_event.status = 'CONFIGURADO'
     OR v_event.sales_open_at IS NULL
     OR now() < v_event.sales_open_at
     OR v_event.status NOT IN ('EN_VENTA', 'AVAILABLE', 'OPEN') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SALES_NOT_OPEN');
  END IF;

  IF v_event.sales_close_at IS NOT NULL AND now() > v_event.sales_close_at THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SALES_CLOSED');
  END IF;

  SELECT COALESCE(SUM(capacity_units), 0)::integer INTO v_active_holds
  FROM public.capacity_holds
  WHERE product_id = v_product.id
    AND state = 'ACTIVE';

  IF v_active_holds + v_units > v_product.cupo THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SOLD_OUT');
  END IF;

  v_expires_at := now() + make_interval(secs => v_hold_seconds);
  v_tracking := 'trk_' || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := encode(sha256(('order-holder:' || v_tracking)::bytea), 'hex');

  INSERT INTO public.buyer_contacts (public_ref, state)
  VALUES (COALESCE(p->>'buyer_public_ref', 'buyer_' || replace(gen_random_uuid()::text, '-', '')), 'ACTIVE')
  RETURNING id INTO v_buyer_id;

  INSERT INTO public.participants (public_ref, buyer_contact_id, participation_type, state)
  VALUES (
    COALESCE(p->>'participant_public_ref', 'part_' || replace(gen_random_uuid()::text, '-', '')),
    v_buyer_id,
    'COMPETITOR',
    'ACTIVE'
  )
  RETURNING id INTO v_participant_id;

  INSERT INTO public.orders (
    buyer_contact_id, state, currency, subtotal_cents, total_cents,
    tracking_ref, external_reference, idempotency_key_hash, idempotency_scope,
    expires_at, commercial_snapshot
  ) VALUES (
    v_buyer_id,
    'PREFERENCE_PENDING',
    'MXN',
    (p->>'total_cents')::bigint,
    (p->>'total_cents')::bigint,
    v_tracking,
    NULL,
    v_key_hash,
    v_scope,
    v_expires_at,
    COALESCE(p->'commercial_snapshot', '{}'::jsonb)
  )
  RETURNING id INTO v_order_id;

  -- Bind external_reference to order id (SPEC / IMPL-7).
  UPDATE public.orders
  SET external_reference = v_order_id::text,
      updated_at = now()
  WHERE id = v_order_id;

  INSERT INTO public.order_items (
    order_id, product_id, product_code, quantity, unit_price_cents, item_total_cents,
    currency, journey, capacity_unit, commercial_snapshot
  ) VALUES (
    v_order_id,
    v_product.id,
    v_product.code,
    v_qty,
    (p->>'unit_price_cents')::bigint,
    (p->>'item_total_cents')::bigint,
    'MXN',
    p->>'journey',
    p->>'capacity_unit',
    COALESCE(p->'commercial_snapshot', '{}'::jsonb)
  )
  RETURNING id INTO v_item_id;

  INSERT INTO public.registrations (
    event_id, event_code, product_id, product_code, participant_id, order_id, journey, state
  ) VALUES (
    v_event.id, v_event.code, v_product.id, v_product.code, v_participant_id, v_order_id, p->>'journey', 'STARTED'
  )
  RETURNING id INTO v_registration_id;

  INSERT INTO public.capacity_holds (
    product_id, product_code, order_id, order_item_id, capacity_units, state, expires_at, reason
  ) VALUES (
    v_product.id, v_product.code, v_order_id, v_item_id, v_units, 'ACTIVE', v_expires_at, 'CHECKOUT_HOLD'
  )
  RETURNING id INTO v_hold_id;

  INSERT INTO public.capability_credentials (
    kind, token_hash, least_scope, subject_ref, resource_ref, order_id, state, generation, expires_at
  ) VALUES (
    'ORDER_HOLDER',
    v_token_hash,
    'order:continue',
    v_buyer_id::text,
    v_order_id::text,
    v_order_id,
    'ISSUED',
    1,
    v_expires_at
  );

  INSERT INTO public.idempotency_records (
    scope, actor_context, key_hash, request_fingerprint, state, response_ref, expires_at
  ) VALUES (
    v_scope,
    NULL,
    v_key_hash,
    v_fingerprint,
    'IN_PROGRESS',
    NULL,
    now() + make_interval(secs => v_ttl_seconds)
  );

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, correlation_id, sanitized_metadata
  ) VALUES (
    'edge:mp-create-checkout',
    'CHECKOUT_START',
    'order',
    v_order_id::text,
    'PREFERENCE_PENDING',
    p->>'correlation_id',
    jsonb_build_object('product_code', v_product.code, 'journey', p->>'journey')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'replay', false,
    'order_id', v_order_id,
    'tracking_ref', v_tracking,
    'order_item_id', v_item_id,
    'hold_id', v_hold_id,
    'registration_id', v_registration_id,
    'expires_at', v_expires_at,
    'external_reference', v_order_id::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_attach_preference(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order_id uuid := (p->>'order_id')::uuid;
  v_tracking text;
  v_expires timestamptz;
  v_key_hash text;
  v_body jsonb;
BEGIN
  UPDATE public.orders
  SET state = 'PAYMENT_PENDING',
      commercial_snapshot = COALESCE(commercial_snapshot, '{}'::jsonb) || jsonb_build_object(
        'provider', 'mercadopago',
        'preference_id', p->>'preference_id'
      ),
      updated_at = now()
  WHERE id = v_order_id
  RETURNING tracking_ref, expires_at, idempotency_key_hash
  INTO v_tracking, v_expires, v_key_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INTERNAL_ERROR');
  END IF;

  v_body := jsonb_build_object(
    'checkout_url', p->>'init_point',
    'public_order_reference', v_tracking,
    'expires_at', v_expires
  );

  UPDATE public.idempotency_records
  SET state = 'COMPLETED',
      response_ref = v_body::text,
      updated_at = now()
  WHERE scope = 'OP-PUB-04'
    AND actor_context IS NULL
    AND key_hash = v_key_hash;

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, sanitized_metadata
  ) VALUES (
    'edge:mp-create-checkout',
    'CHECKOUT_PREFERENCE_ATTACHED',
    'order',
    v_order_id::text,
    'PAYMENT_PENDING',
    jsonb_build_object('preference_id', p->>'preference_id')
  );

  RETURN jsonb_build_object('ok', true, 'response', v_body);
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_compensate_preference(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order_id uuid := (p->>'order_id')::uuid;
  v_hold_id uuid := (p->>'hold_id')::uuid;
BEGIN
  UPDATE public.capacity_holds
  SET state = 'RELEASED',
      released_at = now(),
      reason = COALESCE(p->>'reason', 'PREFERENCE_FAILED'),
      updated_at = now()
  WHERE id = v_hold_id
    AND state = 'ACTIVE';

  UPDATE public.orders
  SET state = 'CANCELLED',
      cancellation_reason = COALESCE(p->>'reason', 'PREFERENCE_FAILED'),
      updated_at = now()
  WHERE id = v_order_id
    AND state IN ('CREATED', 'PREFERENCE_PENDING');

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, failure_class, sanitized_metadata
  ) VALUES (
    'edge:mp-create-checkout',
    'CHECKOUT_PREFERENCE_FAILED',
    'order',
    v_order_id::text,
    'CANCELLED',
    'PROVIDER_FAILURE',
    jsonb_build_object('hold_id', v_hold_id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_start_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkout_attach_preference(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkout_compensate_preference(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkout_start_tx(jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_attach_preference(jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_compensate_preference(jsonb) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.checkout_start_tx(jsonb) TO project_admin;
GRANT EXECUTE ON FUNCTION public.checkout_attach_preference(jsonb) TO project_admin;
GRANT EXECUTE ON FUNCTION public.checkout_compensate_preference(jsonb) TO project_admin;

COMMIT;

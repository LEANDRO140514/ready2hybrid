-- Columns for an Openpay business rejection, plus the checkout response
-- that lets a buyer reserve an order without a Mercado Pago preference.
-- Apply this file alone after 0037. Do not run migrations up --all or --to.
-- Do not apply 0032. Do not replace webhook_apply_payment_tx.

ALTER TABLE public.openpay_payment_attempts
  ADD COLUMN IF NOT EXISTS provider_error_code text,
  ADD COLUMN IF NOT EXISTS provider_error_detail text,
  ADD COLUMN IF NOT EXISTS rejected_charge_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_openpay_attempts_error_code'
  ) THEN
    ALTER TABLE public.openpay_payment_attempts
      ADD CONSTRAINT ck_openpay_attempts_error_code
      CHECK (provider_error_code IS NULL OR provider_error_code ~ '^[0-9]{1,6}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_openpay_attempts_error_detail'
  ) THEN
    ALTER TABLE public.openpay_payment_attempts
      ADD CONSTRAINT ck_openpay_attempts_error_detail
      CHECK (provider_error_detail IS NULL OR char_length(provider_error_detail) <= 180);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_openpay_attempts_rejected_charge'
  ) THEN
    ALTER TABLE public.openpay_payment_attempts
      ADD CONSTRAINT ck_openpay_attempts_rejected_charge
      CHECK (rejected_charge_id IS NULL OR rejected_charge_id ~ '^[A-Za-z0-9_-]{1,64}$');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.openpay_store_checkout_response(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order_id uuid := (p->>'order_id')::uuid;
  v_order public.orders%ROWTYPE;
  v_body jsonb;
BEGIN
  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ORDER_NOT_FOUND');
  END IF;
  IF v_order.state <> 'PREFERENCE_PENDING' OR v_order.currency <> 'MXN' OR v_order.total_cents IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ORDER_NOT_PAYABLE');
  END IF;

  v_body := jsonb_build_object(
    'provider', 'OPENPAY',
    'order_id', v_order.id,
    'public_order_reference', v_order.tracking_ref,
    'expires_at', v_order.expires_at,
    'amount_cents', v_order.total_cents,
    'currency', 'MXN'
  );

  UPDATE public.idempotency_records
  SET state = 'COMPLETED',
      response_ref = v_body::text,
      updated_at = now()
  WHERE scope = 'OP-PUB-04'
    AND actor_context IS NULL
    AND key_hash = v_order.idempotency_key_hash
    AND response_ref IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CONFLICT');
  END IF;

  UPDATE public.orders
  SET commercial_snapshot = COALESCE(commercial_snapshot, '{}'::jsonb) || jsonb_build_object('provider', 'openpay'),
      updated_at = now()
  WHERE id = v_order.id
    AND state = 'PREFERENCE_PENDING';

  RETURN jsonb_build_object('ok', true, 'response', v_body);
END;
$$;

REVOKE ALL ON FUNCTION public.openpay_store_checkout_response(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.openpay_store_checkout_response(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.openpay_store_checkout_response(jsonb) TO project_admin;

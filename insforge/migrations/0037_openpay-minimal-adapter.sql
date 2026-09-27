-- =====================================================================
-- 0037_openpay-minimal-adapter.sql
--
-- Minimum persistence for a server-verified Openpay charge to become a
-- normal Ready2Hybrid sale. Sale truth remains orders.state = PAID.
--
-- openpay_payment_attempts is technical lifecycle only. It is not a sale
-- and it is not a second payments ledger.
--
-- Apply this file alone, as SQL, on the sandbox that already has the
-- production schema baseline. Do not run the migration runner. Do not use
-- --all or --to. Do not write system.custom_migrations. Do not apply 0032
-- or 0033. Do not replace webhook_apply_payment_tx.
-- =====================================================================

CREATE TABLE public.openpay_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  openpay_order_ref text NOT NULL,
  openpay_charge_id text,
  mode text NOT NULL,
  initial_status text,
  last_verified_status text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_openpay_payment_attempts_order UNIQUE (order_id),
  CONSTRAINT uq_openpay_payment_attempts_order_ref UNIQUE (openpay_order_ref),
  CONSTRAINT ck_openpay_payment_attempts_mode
    CHECK (mode IN ('ONE_TIME', 'THREE_MSI')),
  CONSTRAINT ck_openpay_payment_attempts_order_ref_nonempty
    CHECK (btrim(openpay_order_ref) <> ''),
  CONSTRAINT fk_openpay_payment_attempts_order
    FOREIGN KEY (order_id) REFERENCES public.orders (id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_openpay_payment_attempts_charge_id
  ON public.openpay_payment_attempts (openpay_charge_id)
  WHERE openpay_charge_id IS NOT NULL;

COMMENT ON TABLE public.openpay_payment_attempts IS
  'Technical Openpay charge lifecycle for one order. Not sale truth. Sale truth is orders.state = PAID.';

ALTER TABLE public.openpay_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openpay_payment_attempts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.openpay_payment_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.openpay_payment_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.openpay_apply_verified_charge(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_ref text := NULLIF(btrim(p->>'openpay_order_ref'), '');
  v_charge_id text := NULLIF(btrim(p->>'openpay_charge_id'), '');
  v_order_text text := NULLIF(btrim(p->>'order_id'), '');
  v_status text := NULLIF(btrim(p->>'normalized_state'), '');
  v_amount_text text := NULLIF(btrim(p->>'amount_cents'), '');
  v_currency text := upper(NULLIF(btrim(p->>'currency'), ''));
  v_amount_cents bigint;
  v_verified_at timestamptz;
  v_order_id uuid;
  v_attempt public.openpay_payment_attempts%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_hold public.capacity_holds%ROWTYPE;
  v_same_payment_id uuid;
  v_other_provider boolean := false;
  v_other_charge boolean := false;
  v_hold_blocked boolean := false;
  v_outcome text;
  v_payment_id uuid;
  v_external_state text := NULLIF(btrim(p->>'external_state'), '');
  v_initial_status text := NULLIF(btrim(p->>'initial_status'), '');
  v_correlation text := NULLIF(btrim(p->>'correlation_id'), '');
BEGIN
  IF p ? 'card_number' OR p ? 'cvv' OR p ? 'cvv2' OR p ? 'pan'
     OR p ? 'private_key' OR p ? 'authorization' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  IF v_ref IS NULL OR v_charge_id IS NULL OR v_order_text IS NULL
     OR v_status IS NULL OR v_amount_text IS NULL OR v_currency IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  IF v_ref !~ '^[A-Za-z0-9_-]{8,64}$' OR v_charge_id !~ '^[A-Za-z0-9_-]{1,64}$' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  IF v_order_text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;
  v_order_id := v_order_text::uuid;

  IF v_amount_text !~ '^[0-9]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;
  v_amount_cents := v_amount_text::bigint;

  IF v_status IS DISTINCT FROM 'APPROVED' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_VERIFIED_APPROVED');
  END IF;

  IF v_currency IS DISTINCT FROM 'MXN' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CURRENCY_MISMATCH');
  END IF;

  IF p ? 'verified_at' AND NULLIF(btrim(p->>'verified_at'), '') IS NOT NULL THEN
    BEGIN
      v_verified_at := (p->>'verified_at')::timestamptz;
    EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format OR data_exception THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
    END;
  ELSE
    v_verified_at := now();
  END IF;

  IF v_external_state IS NOT NULL AND char_length(v_external_state) > 64 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;
  IF v_initial_status IS NOT NULL AND char_length(v_initial_status) > 64 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;
  IF v_correlation IS NOT NULL AND char_length(v_correlation) > 64 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  SELECT * INTO v_attempt
  FROM public.openpay_payment_attempts
  WHERE openpay_order_ref = v_ref
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ATTEMPT_NOT_FOUND');
  END IF;

  IF v_attempt.order_id IS DISTINCT FROM v_order_id THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ATTEMPT_NOT_FOUND');
  END IF;

  IF v_attempt.openpay_charge_id IS NOT NULL
     AND v_attempt.openpay_charge_id IS DISTINCT FROM v_charge_id THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CHARGE_ID_MISMATCH');
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ORDER_NOT_FOUND');
  END IF;

  IF v_order.currency IS DISTINCT FROM 'MXN' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CURRENCY_MISMATCH');
  END IF;

  IF v_amount_cents IS DISTINCT FROM v_order.total_cents THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ORDER_AMOUNT_MISMATCH');
  END IF;

  FOR v_payment IN
    SELECT * FROM public.payments
    WHERE order_id = v_order.id
    FOR UPDATE
  LOOP
    IF v_payment.provider IS DISTINCT FROM 'OPENPAY' THEN
      v_other_provider := true;
    ELSIF v_payment.provider_payment_id IS DISTINCT FROM v_charge_id THEN
      v_other_charge := true;
    ELSE
      v_same_payment_id := v_payment.id;
    END IF;
  END LOOP;

  IF v_other_provider THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PROVIDER_CONFLICT');
  END IF;

  IF v_other_charge THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ORDER_ALREADY_PAID_OTHER_PAYMENT');
  END IF;

  IF v_order.state = 'PAID' THEN
    IF v_same_payment_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'ORDER_ALREADY_PAID_OTHER_PAYMENT');
    END IF;
    v_outcome := 'ALREADY_PAID';
  ELSIF v_order.state IN ('CREATED', 'PREFERENCE_PENDING', 'PAYMENT_PENDING') THEN
    FOR v_hold IN
      SELECT * FROM public.capacity_holds
      WHERE order_id = v_order.id
      FOR UPDATE
    LOOP
      IF v_hold.state = 'CONVERTED' THEN
        NULL;
      ELSIF v_hold.state = 'ACTIVE'
            AND (v_hold.expires_at IS NULL OR v_hold.expires_at >= now()) THEN
        NULL;
      ELSE
        v_hold_blocked := true;
      END IF;
    END LOOP;

    IF v_hold_blocked THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'HOLD_NOT_CONVERTIBLE');
    END IF;
    v_outcome := 'PAID';
  ELSE
    RETURN jsonb_build_object('ok', false, 'error_code', 'ORDER_STATE_NOT_PAYABLE');
  END IF;

  IF v_same_payment_id IS NULL THEN
    INSERT INTO public.payments (
      provider,
      provider_payment_id,
      order_id,
      external_state,
      normalized_state,
      amount_cents,
      currency,
      external_reference,
      last_verified_at,
      sanitized_evidence_ref,
      reconciliation_state
    ) VALUES (
      'OPENPAY',
      v_charge_id,
      v_order.id,
      COALESCE(v_external_state, 'completed'),
      'APPROVED',
      v_order.total_cents,
      'MXN',
      v_order.id::text,
      v_verified_at,
      'openpay_charge:' || v_charge_id,
      'VERIFIED'
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO public.payment_verification_records (
      payment_id,
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
      v_payment_id,
      v_order.id,
      'openpay_charge:' || v_charge_id,
      true,
      true,
      true,
      true,
      'APPROVED',
      v_verified_at,
      v_correlation,
      'VERIFIED'
    );
  ELSE
    v_payment_id := v_same_payment_id;
  END IF;

  UPDATE public.openpay_payment_attempts
  SET openpay_charge_id = v_charge_id,
      last_verified_status = 'APPROVED',
      verified_at = v_verified_at,
      updated_at = now(),
      initial_status = COALESCE(initial_status, v_initial_status)
  WHERE id = v_attempt.id;

  IF v_outcome = 'PAID' THEN
    UPDATE public.orders
    SET state = 'PAID',
        updated_at = now()
    WHERE id = v_order.id;

    UPDATE public.capacity_holds
    SET state = 'CONVERTED',
        converted_at = COALESCE(converted_at, now()),
        updated_at = now()
    WHERE order_id = v_order.id
      AND state = 'ACTIVE'
      AND (expires_at IS NULL OR expires_at >= now());

    UPDATE public.registrations
    SET state = 'PAYMENT_CONFIRMED',
        updated_at = now()
    WHERE order_id = v_order.id
      AND state IN ('STARTED', 'PENDING_PAYMENT');
  END IF;

  PERFORM public.team_apply_payment_outcome(v_order.id, v_outcome);
  PERFORM public.ticket_issue_after_payment(v_order.id);

  RETURN jsonb_build_object(
    'ok', true,
    'outcome', v_outcome,
    'order_id', v_order.id,
    'payment_id', v_payment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.openpay_apply_verified_charge(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.openpay_apply_verified_charge(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.openpay_apply_verified_charge(jsonb) TO project_admin;

COMMENT ON FUNCTION public.openpay_apply_verified_charge(jsonb) IS
  'Apply one server-verified Openpay charge onto the existing PAID, registration, hold, team, and ticket path. Does not call Openpay and does not send email.';

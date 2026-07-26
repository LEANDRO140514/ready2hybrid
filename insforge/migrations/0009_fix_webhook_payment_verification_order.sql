-- =============================================================================
-- Ready2Hybrid — IMPL-12-R3
-- Migration: 0009_fix_webhook_payment_verification_order.sql
--
-- Forward-only REPLACE of webhook_apply_payment_tx:
-- create/upsert canonical payment BEFORE inserting payment_verification_records
-- so payment_id NOT NULL is satisfied. No table/column changes.
-- =============================================================================

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

  -- IMPL-12-R3: order_id and payment_id are NOT NULL on payment_verification_records.
  -- Without a resolved order we cannot create a payment or verification row.
  IF NOT v_order_found THEN
    UPDATE public.webhook_events
    SET processing_state = 'PROCESSED',
        result = 'VERIFICATION_REJECTED',
        sanitized_error = 'ORDER_NOT_FOUND',
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
        'merchant_ok', v_merchant_ok,
        'ref_ok', v_ref_ok,
        'amount_ok', v_amount_ok,
        'currency_ok', v_currency_ok,
        'order_found', false
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'VERIFICATION_REJECTED',
      'error_detail', 'ORDER_NOT_FOUND'
    );
  END IF;

  -- Upsert payment by provider payment id BEFORE verification insert.
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
        reconciliation_state = CASE WHEN v_all_ok THEN 'VERIFIED' ELSE 'MISMATCH' END,
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
      CASE WHEN v_all_ok THEN 'VERIFIED' ELSE 'MISMATCH' END
    )
    RETURNING * INTO v_payment;
  END IF;

  UPDATE public.webhook_events
  SET payment_id = v_payment.id
  WHERE id = v_webhook_id;

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
    v_payment.id,
    v_order.id,
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

  IF NOT v_all_ok THEN
    UPDATE public.webhook_events
    SET processing_state = 'PROCESSED',
        result = 'VERIFICATION_REJECTED',
        sanitized_error = CASE
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
        'payment_id', v_payment.id,
        'merchant_ok', v_merchant_ok,
        'ref_ok', v_ref_ok,
        'amount_ok', v_amount_ok,
        'currency_ok', v_currency_ok
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'VERIFICATION_REJECTED',
      'verification_id', v_verification_id,
      'payment_id', v_payment.id
    );
  END IF;
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
  'IMPL-12-R3 TX-2: apply verified Mercado Pago payment effects atomically; payment upsert precedes verification insert; issues eligible tickets/QR hashes; no email delivery.';

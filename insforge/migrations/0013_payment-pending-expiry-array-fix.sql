-- =====================================================================
-- 0013_payment-pending-expiry-array-fix.sql
-- Ready2Hybrid — IMPL-14A-3B-FIX-2: unambiguous text[]/uuid[] scalar appends.
--
-- Authority:
--  · SPEC-040 v0.1.1 APPROVED
--  · IMPL-14A-3B local implementation + FIX-1 (dry-run statement_timestamp)
--  · Sandbox runtime evidence: B-ARRAY CONFIRMED (PL/pgSQL text[] || text)
--  · Project Owner authorization IMPL-14A-3B-FIX-2 (local migration only)
--
-- Scope:
--  · CREATE OR REPLACE expire_payment_pending_aggregate_tx
--  · CREATE OR REPLACE expire_payment_pending_dry_run_tx
--  · REVOKE/GRANT reaffirmation for those two functions
--  · COMMENT ON FUNCTION describing the array_append fix
--
-- Deliberately absent:
--  · expire_payment_pending_batch_tx (unchanged; still defined by 0012)
--  · indexes, tables, constraints, triggers, schedules, Edge Functions
--  · any change to 0012 bytes (0012 remains immutable)
--
-- Fix: replace ambiguous PL/pgSQL forms
--   text_array || 'literal' / text_array || text_scalar / uuid_array || uuid_scalar
-- with array_append(...). jsonb || jsonb and text || text are preserved.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.expire_payment_pending_aggregate_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order_id uuid;
  v_correlation text := NULLIF(p->>'correlation_id', '');
  v_actor text := COALESCE(NULLIF(p->>'actor_ref', ''), 'system:expiry-reconciler');
  v_fingerprint text := NULLIF(p->>'idempotency_fingerprint', '');
  v_order public.orders%ROWTYPE;
  v_expiry_now timestamptz;
  v_findings text[] := ARRAY[]::text[];
  v_hold public.capacity_holds%ROWTYPE;
  v_hold_ids uuid[] := ARRAY[]::uuid[];
  v_hold_states text[] := ARRAY[]::text[];
  v_hold_total integer := 0;
  v_hold_active integer := 0;
  v_hold_converted integer := 0;
  v_active_hold_id uuid;
  v_active_hold_expires timestamptz;
  v_reg record;
  v_reg_ids uuid[] := ARRAY[]::uuid[];
  v_reg_states text[] := ARRAY[]::text[];
  v_reg_total integer := 0;
  v_reg_provisional integer := 0;
  v_cred record;
  v_holder_ids uuid[] := ARRAY[]::uuid[];
  v_holder_states text[] := ARRAY[]::text[];
  v_holder_active integer := 0;
  v_holder_expires timestamptz;
  v_pay_approved integer := 0;
  v_pay_terminal integer := 0;
  v_access_artifacts integer := 0;
  v_holds_expired integer := 0;
  v_regs_cancelled integer := 0;
  v_holders_expired integer := 0;
  v_metadata jsonb;
BEGIN
  BEGIN
    v_order_id := NULLIF(p->>'order_id', '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_order_id := NULL;
  END;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'outcome', 'error',
      'error_code', 'INVALID_REQUEST',
      'correlation_id', v_correlation
    );
  END IF;

  -- Lock order first. webhook_apply_payment_tx (0009) locks orders before
  -- payments and before capacity_holds, so the order row is the single
  -- serialization point against the payment path; no lock-order inversion is
  -- possible while this is the first domain lock taken here.
  -- NOWAIT keeps a contended aggregate observable as skipped_locked instead of
  -- parking a sweep behind another worker.
  BEGIN
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = v_order_id
    FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'ok', true,
        'outcome', 'skipped_locked',
        'order_id', v_order_id,
        'reason', 'ORDER_ROW_LOCKED',
        'correlation_id', v_correlation
      );
  END;

  -- skipped_locked, order_not_found and noop stay three distinct outcomes.
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'order_not_found',
      'order_id', v_order_id,
      'reason', 'ORDER_NOT_FOUND',
      'correlation_id', v_correlation
    );
  END IF;

  v_expiry_now := clock_timestamp();

  -- SPEC-040-R024 / R001: anything other than PAYMENT_PENDING is immune here.
  IF v_order.state <> 'PAYMENT_PENDING' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'noop',
      'order_id', v_order.id,
      'order_state', v_order.state,
      'reason', 'ORDER_STATE_NOT_ELIGIBLE',
      'expiry_instant', v_expiry_now,
      'correlation_id', v_correlation
    );
  END IF;

  IF v_order.expires_at IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'noop',
      'order_id', v_order.id,
      'order_state', v_order.state,
      'reason', 'NOT_ELIGIBLE_EXPIRY_UNKNOWN',
      'expiry_instant', v_expiry_now,
      'correlation_id', v_correlation
    );
  END IF;

  IF v_order.expires_at > v_expiry_now THEN
    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'noop',
      'order_id', v_order.id,
      'order_state', v_order.state,
      'reason', 'NOT_ELIGIBLE_NOT_YET_EXPIRED',
      'order_expires_at', v_order.expires_at,
      'expiry_instant', v_expiry_now,
      'correlation_id', v_correlation
    );
  END IF;

  -- Canonical payment truth lives in payments, not in orders.state.
  -- Read under the order lock: 0009 cannot reach payments while we hold it,
  -- so no explicit row lock is taken here and no lock after capacity_holds.
  SELECT
    count(*) FILTER (WHERE normalized_state = 'APPROVED'),
    count(*) FILTER (WHERE normalized_state IN ('REFUNDED', 'CHARGED_BACK'))
  INTO v_pay_approved, v_pay_terminal
  FROM public.payments
  WHERE order_id = v_order.id;

  FOR v_hold IN
    SELECT *
    FROM public.capacity_holds
    WHERE order_id = v_order.id
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  LOOP
    v_hold_total := v_hold_total + 1;
    v_hold_ids := array_append(v_hold_ids, v_hold.id);
    v_hold_states := array_append(v_hold_states, v_hold.state);
    IF v_hold.state = 'ACTIVE' THEN
      v_hold_active := v_hold_active + 1;
      v_active_hold_id := v_hold.id;
      v_active_hold_expires := v_hold.expires_at;
    ELSIF v_hold.state = 'CONVERTED' THEN
      v_hold_converted := v_hold_converted + 1;
    END IF;
  END LOOP;

  -- registrations.state has no CHECK constraint in this schema; the provisional
  -- vocabulary is the one written by checkout_start_tx and webhook_apply_payment_tx.
  FOR v_reg IN
    SELECT id, state
    FROM public.registrations
    WHERE order_id = v_order.id
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  LOOP
    v_reg_total := v_reg_total + 1;
    v_reg_ids := array_append(v_reg_ids, v_reg.id);
    v_reg_states := array_append(v_reg_states, v_reg.state);
    IF v_reg.state IN ('STARTED', 'PENDING_PAYMENT') THEN
      v_reg_provisional := v_reg_provisional + 1;
    END IF;
  END LOOP;

  -- SPEC-040-R007 / I006: ORDER_HOLDER only. checkout_start_tx also stamps
  -- order_id on CAPTAIN and INVITATION_EXCHANGE_CODE credentials, so the kind
  -- filter is what keeps those (and TICKET_ACCESS) untouched.
  FOR v_cred IN
    SELECT id, state, expires_at
    FROM public.capability_credentials
    WHERE order_id = v_order.id
      AND kind = 'ORDER_HOLDER'
    ORDER BY generation ASC, id ASC
    FOR UPDATE
  LOOP
    v_holder_ids := array_append(v_holder_ids, v_cred.id);
    v_holder_states := array_append(v_holder_states, v_cred.state);
    IF v_cred.state IN ('ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE') THEN
      v_holder_active := v_holder_active + 1;
      v_holder_expires := v_cred.expires_at;
    END IF;
  END LOOP;

  -- Read-only probe: an access artifact means this aggregate was already
  -- fulfilled. tickets are never locked and never written by this path.
  SELECT count(*) INTO v_access_artifacts
  FROM public.tickets t
  JOIN public.registrations r ON r.id = t.registration_id
  WHERE r.order_id = v_order.id;

  -- SPEC-040-R012 / R023 structural gate. Every branch is fail-closed: a
  -- finding blocks the whole aggregate instead of completing it partially.
  IF v_pay_approved > 0 THEN
    v_findings := array_append(v_findings, 'APPROVED_PAYMENT_ORDER_NOT_PAID');
  END IF;
  IF v_pay_terminal > 0 THEN
    v_findings := array_append(v_findings, 'PAYMENT_TERMINAL_MISMATCH');
  END IF;
  IF v_hold_total = 0 THEN
    v_findings := array_append(v_findings, 'HOLD_MISSING');
  ELSIF v_hold_active = 0 THEN
    v_findings := array_append(v_findings, 'HOLD_NO_ACTIVE');
  ELSIF v_hold_active > 1 THEN
    v_findings := array_append(v_findings, 'HOLD_MULTIPLE_ACTIVE');
  END IF;
  IF v_hold_active = 1 AND v_active_hold_expires IS NULL THEN
    v_findings := array_append(v_findings, 'HOLD_EXPIRY_UNKNOWN');
  ELSIF v_hold_active = 1 AND v_active_hold_expires > v_expiry_now THEN
    v_findings := array_append(v_findings, 'HOLD_NOT_TIME_EXPIRED');
  END IF;
  IF v_hold_converted > 0 OR v_access_artifacts > 0 THEN
    v_findings := array_append(v_findings, 'PARTIAL_CONVERSION');
  END IF;
  IF v_reg_total = 0 THEN
    v_findings := array_append(v_findings, 'REGISTRATIONS_MISSING');
  ELSIF v_reg_provisional <> v_reg_total THEN
    v_findings := array_append(v_findings, 'REGISTRATION_NON_PROVISIONAL');
  END IF;
  IF v_holder_active = 0 THEN
    v_findings := array_append(v_findings, 'ORDER_HOLDER_MISSING');
  ELSIF v_holder_active > 1 THEN
    v_findings := array_append(v_findings, 'ORDER_HOLDER_MULTIPLE');
  END IF;
  -- SPEC-040-I004: checkout writes one identical instant on the three rows.
  IF v_hold_active = 1
     AND v_holder_active = 1
     AND (
       v_active_hold_expires IS DISTINCT FROM v_order.expires_at
       OR v_holder_expires IS DISTINCT FROM v_order.expires_at
     ) THEN
    v_findings := array_append(v_findings, 'EXPIRES_AT_DIVERGENCE');
  END IF;

  IF COALESCE(array_length(v_findings, 1), 0) > 0 THEN
    -- D-2: review routing for a temporally eligible PAYMENT_PENDING order with
    -- an inconsistent aggregate. No timestamp is invented or repaired, no
    -- component is created, and holds/registrations/credentials/payments/
    -- tickets/teams keep their state.
    UPDATE public.orders
    SET state = 'REQUIRES_REVIEW',
        updated_at = v_expiry_now
    WHERE id = v_order.id
      AND state = 'PAYMENT_PENDING';

    v_metadata := jsonb_build_object(
      'reason', 'AGGREGATE_INCONSISTENT',
      'findings', to_jsonb(v_findings),
      'expiry_instant', v_expiry_now,
      'observed', jsonb_build_object(
        'order_expires_at', v_order.expires_at,
        'hold_expires_at', v_active_hold_expires,
        'order_holder_expires_at', v_holder_expires
      ),
      'previous', jsonb_build_object(
        'order', v_order.state,
        'holds', to_jsonb(v_hold_states),
        'registrations', to_jsonb(v_reg_states),
        'order_holder', to_jsonb(v_holder_states)
      ),
      'resulting', jsonb_build_object(
        'order', 'REQUIRES_REVIEW',
        'holds', to_jsonb(v_hold_states),
        'registrations', to_jsonb(v_reg_states),
        'order_holder', to_jsonb(v_holder_states)
      ),
      'refs', jsonb_build_object(
        'hold_ids', to_jsonb(v_hold_ids),
        'registration_ids', to_jsonb(v_reg_ids),
        'order_holder_ids', to_jsonb(v_holder_ids)
      ),
      'counts', jsonb_build_object(
        'holds_total', v_hold_total,
        'holds_active', v_hold_active,
        'registrations_total', v_reg_total,
        'registrations_provisional', v_reg_provisional,
        'order_holder_active', v_holder_active,
        'payments_approved', v_pay_approved,
        'payments_terminal', v_pay_terminal,
        'access_artifacts', v_access_artifacts,
        'holds_expired', 0,
        'registrations_cancelled', 0,
        'order_holder_expired', 0,
        'tickets_issued', 0,
        'payments_mutated', 0,
        'refunds', 0
      )
    );

    INSERT INTO public.activity_log (
      actor_ref, named_action, entity_type, entity_ref, result, failure_class,
      correlation_id, idempotency_fingerprint, sanitized_metadata
    ) VALUES (
      v_actor,
      'ORDER_EXPIRY_INCONSISTENT',
      'order',
      v_order.id::text,
      'INCONSISTENT',
      'AGGREGATE_CONSISTENCY',
      v_correlation,
      v_fingerprint,
      v_metadata
    );

    INSERT INTO public.outbox_delivery_jobs (
      communication_type, template, destination_ref, domain_event_ref,
      minimal_payload, state
    ) VALUES (
      'INTERNAL_ALERT',
      'ORDER_EXPIRY_INCONSISTENT',
      'ops:payments',
      'order:' || v_order.id::text,
      jsonb_build_object(
        'order_id', v_order.id,
        'outcome', 'inconsistent',
        'findings', to_jsonb(v_findings),
        'correlation_id', v_correlation
      ),
      'PENDING'
    );

    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'inconsistent',
      'order_id', v_order.id,
      'order_state', 'REQUIRES_REVIEW',
      'findings', to_jsonb(v_findings),
      'expiry_instant', v_expiry_now,
      'correlation_id', v_correlation
    );
  END IF;

  -- Effective reconciliation. Compare-and-set on the source state is the
  -- idempotency guarantee (SPEC-040-R009): a replay finds EXPIRED and stops at
  -- the eligibility gate above, so no second audit row and no second alert.
  UPDATE public.orders
  SET state = 'EXPIRED',
      updated_at = v_expiry_now
  WHERE id = v_order.id
    AND state = 'PAYMENT_PENDING';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'noop',
      'order_id', v_order.id,
      'reason', 'ORDER_STATE_CHANGED',
      'expiry_instant', v_expiry_now,
      'correlation_id', v_correlation
    );
  END IF;

  -- capacity_holds has no expired_at column; reason keeps the creation reason
  -- and released_at stays untouched because expiry is not a release event.
  UPDATE public.capacity_holds
  SET state = 'EXPIRED',
      updated_at = v_expiry_now
  WHERE id = v_active_hold_id
    AND state = 'ACTIVE';
  GET DIAGNOSTICS v_holds_expired = ROW_COUNT;

  -- registrations has no cancellation reason column; ORDER_EXPIRED is retained
  -- in the audit row and registration_snapshot is never rewritten.
  UPDATE public.registrations
  SET state = 'CANCELLED',
      updated_at = v_expiry_now
  WHERE order_id = v_order.id
    AND state IN ('STARTED', 'PENDING_PAYMENT');
  GET DIAGNOSTICS v_regs_cancelled = ROW_COUNT;

  UPDATE public.capability_credentials
  SET state = 'EXPIRED',
      updated_at = v_expiry_now
  WHERE order_id = v_order.id
    AND kind = 'ORDER_HOLDER'
    AND state IN ('ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE');
  GET DIAGNOSTICS v_holders_expired = ROW_COUNT;

  v_metadata := jsonb_build_object(
    'reason', 'ORDER_EXPIRED',
    'expiry_instant', v_expiry_now,
    'observed', jsonb_build_object(
      'order_expires_at', v_order.expires_at,
      'hold_expires_at', v_active_hold_expires,
      'order_holder_expires_at', v_holder_expires
    ),
    'previous', jsonb_build_object(
      'order', 'PAYMENT_PENDING',
      'holds', to_jsonb(v_hold_states),
      'registrations', to_jsonb(v_reg_states),
      'order_holder', to_jsonb(v_holder_states)
    ),
    'resulting', jsonb_build_object(
      'order', 'EXPIRED',
      'holds', 'EXPIRED',
      'registrations', 'CANCELLED',
      'order_holder', 'EXPIRED'
    ),
    'refs', jsonb_build_object(
      'hold_ids', to_jsonb(v_hold_ids),
      'registration_ids', to_jsonb(v_reg_ids),
      'order_holder_ids', to_jsonb(v_holder_ids)
    ),
    'counts', jsonb_build_object(
      'holds_expired', v_holds_expired,
      'registrations_cancelled', v_regs_cancelled,
      'order_holder_expired', v_holders_expired,
      'tickets_issued', 0,
      'payments_mutated', 0,
      'refunds', 0,
      'outbox_created', 0
    )
  );

  -- SPEC-040-I009 / R015: audit belongs to the same transaction. A failure here
  -- aborts every transition above, so the reconciliation is not "completed".
  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, failure_class,
    correlation_id, idempotency_fingerprint, sanitized_metadata
  ) VALUES (
    v_actor,
    'ORDER_EXPIRY_APPLIED',
    'order',
    v_order.id::text,
    'EXPIRED',
    NULL,
    v_correlation,
    v_fingerprint,
    v_metadata
  );

  RETURN jsonb_build_object(
    'ok', true,
    'outcome', 'expired',
    'order_id', v_order.id,
    'order_state', 'EXPIRED',
    'expiry_instant', v_expiry_now,
    'counts', jsonb_build_object(
      'holds_expired', v_holds_expired,
      'registrations_cancelled', v_regs_cancelled,
      'order_holder_expired', v_holders_expired
    ),
    'correlation_id', v_correlation
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_payment_pending_dry_run_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE((p->>'limit')::integer, 25), 1), 50);
  v_correlation text := NULLIF(p->>'correlation_id', '');
  v_order_id uuid;
  v_now timestamptz;
  v_candidates jsonb := '[]'::jsonb;
  v_deferred jsonb := '[]'::jsonb;
  v_eligible integer := 0;
  v_noop integer := 0;
  v_inconsistent integer := 0;
  v_findings text[];
  v_classification text;
  r record;
  d record;
BEGIN
  BEGIN
    v_order_id := NULLIF(p->>'order_id', '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_order_id := NULL;
  END;

  v_now := statement_timestamp();

  FOR r IN
    SELECT
      o.id,
      o.state,
      o.expires_at,
      (SELECT count(*) FROM public.capacity_holds h
        WHERE h.order_id = o.id) AS holds_total,
      (SELECT count(*) FROM public.capacity_holds h
        WHERE h.order_id = o.id AND h.state = 'ACTIVE') AS holds_active,
      (SELECT count(*) FROM public.capacity_holds h
        WHERE h.order_id = o.id AND h.state = 'CONVERTED') AS holds_converted,
      (SELECT h.expires_at FROM public.capacity_holds h
        WHERE h.order_id = o.id AND h.state = 'ACTIVE'
        ORDER BY h.created_at ASC, h.id ASC LIMIT 1) AS hold_expires_at,
      (SELECT count(*) FROM public.registrations rg
        WHERE rg.order_id = o.id) AS regs_total,
      (SELECT count(*) FROM public.registrations rg
        WHERE rg.order_id = o.id
          AND rg.state IN ('STARTED', 'PENDING_PAYMENT')) AS regs_provisional,
      (SELECT count(*) FROM public.capability_credentials c
        WHERE c.order_id = o.id AND c.kind = 'ORDER_HOLDER'
          AND c.state IN ('ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE')) AS holder_active,
      (SELECT c.expires_at FROM public.capability_credentials c
        WHERE c.order_id = o.id AND c.kind = 'ORDER_HOLDER'
          AND c.state IN ('ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE')
        ORDER BY c.generation ASC, c.id ASC LIMIT 1) AS holder_expires_at,
      (SELECT count(*) FROM public.payments pay
        WHERE pay.order_id = o.id
          AND pay.normalized_state = 'APPROVED') AS pay_approved,
      (SELECT count(*) FROM public.payments pay
        WHERE pay.order_id = o.id
          AND pay.normalized_state IN ('REFUNDED', 'CHARGED_BACK')) AS pay_terminal,
      (SELECT count(*) FROM public.tickets t
        JOIN public.registrations r2 ON r2.id = t.registration_id
        WHERE r2.order_id = o.id) AS access_artifacts
    FROM public.orders o
    WHERE o.state = 'PAYMENT_PENDING'
      AND (v_order_id IS NULL OR o.id = v_order_id)
      AND (o.expires_at IS NULL OR o.expires_at <= v_now)
    ORDER BY o.expires_at ASC NULLS LAST, o.id ASC
    LIMIT v_limit
  LOOP
    v_findings := ARRAY[]::text[];

    IF r.expires_at IS NULL THEN
      v_classification := 'noop';
      v_findings := array_append(v_findings, 'NOT_ELIGIBLE_EXPIRY_UNKNOWN');
    ELSE
      IF r.pay_approved > 0 THEN
        v_findings := array_append(v_findings, 'APPROVED_PAYMENT_ORDER_NOT_PAID');
      END IF;
      IF r.pay_terminal > 0 THEN
        v_findings := array_append(v_findings, 'PAYMENT_TERMINAL_MISMATCH');
      END IF;
      IF r.holds_total = 0 THEN
        v_findings := array_append(v_findings, 'HOLD_MISSING');
      ELSIF r.holds_active = 0 THEN
        v_findings := array_append(v_findings, 'HOLD_NO_ACTIVE');
      ELSIF r.holds_active > 1 THEN
        v_findings := array_append(v_findings, 'HOLD_MULTIPLE_ACTIVE');
      END IF;
      IF r.holds_active = 1 AND r.hold_expires_at IS NULL THEN
        v_findings := array_append(v_findings, 'HOLD_EXPIRY_UNKNOWN');
      ELSIF r.holds_active = 1 AND r.hold_expires_at > v_now THEN
        v_findings := array_append(v_findings, 'HOLD_NOT_TIME_EXPIRED');
      END IF;
      IF r.holds_converted > 0 OR r.access_artifacts > 0 THEN
        v_findings := array_append(v_findings, 'PARTIAL_CONVERSION');
      END IF;
      IF r.regs_total = 0 THEN
        v_findings := array_append(v_findings, 'REGISTRATIONS_MISSING');
      ELSIF r.regs_provisional <> r.regs_total THEN
        v_findings := array_append(v_findings, 'REGISTRATION_NON_PROVISIONAL');
      END IF;
      IF r.holder_active = 0 THEN
        v_findings := array_append(v_findings, 'ORDER_HOLDER_MISSING');
      ELSIF r.holder_active > 1 THEN
        v_findings := array_append(v_findings, 'ORDER_HOLDER_MULTIPLE');
      END IF;
      IF r.holds_active = 1
         AND r.holder_active = 1
         AND (
           r.hold_expires_at IS DISTINCT FROM r.expires_at
           OR r.holder_expires_at IS DISTINCT FROM r.expires_at
         ) THEN
        v_findings := array_append(v_findings, 'EXPIRES_AT_DIVERGENCE');
      END IF;

      IF COALESCE(array_length(v_findings, 1), 0) > 0 THEN
        v_classification := 'inconsistent';
      ELSE
        v_classification := 'eligible';
      END IF;
    END IF;

    IF v_classification = 'eligible' THEN
      v_eligible := v_eligible + 1;
    ELSIF v_classification = 'inconsistent' THEN
      v_inconsistent := v_inconsistent + 1;
    ELSE
      v_noop := v_noop + 1;
    END IF;

    v_candidates := v_candidates || jsonb_build_array(
      jsonb_build_object(
        'order_id', r.id,
        'order_state', r.state,
        'order_expires_at', r.expires_at,
        'would_be', v_classification,
        'findings', to_jsonb(v_findings),
        'observed', jsonb_build_object(
          'hold_expires_at', r.hold_expires_at,
          'order_holder_expires_at', r.holder_expires_at
        ),
        'counts', jsonb_build_object(
          'holds_total', r.holds_total,
          'holds_active', r.holds_active,
          'registrations_total', r.regs_total,
          'registrations_provisional', r.regs_provisional,
          'order_holder_active', r.holder_active,
          'payments_approved', r.pay_approved,
          'payments_terminal', r.pay_terminal,
          'access_artifacts', r.access_artifacts
        )
      )
    );
  END LOOP;

  -- D-1: a time-expired ACTIVE hold whose order is PREFERENCE_PENDING is
  -- reported and deferred to a separate unit. IMPL-14A-3B never mutates it and
  -- never repairs it opportunistically; cupo is already protected logically by
  -- SPEC-040-R004 / I007 in checkout_start_tx (0011).
  FOR d IN
    SELECT h.id AS hold_id, h.order_id, h.expires_at, o.state AS order_state
    FROM public.capacity_holds h
    JOIN public.orders o ON o.id = h.order_id
    WHERE h.state = 'ACTIVE'
      AND h.expires_at IS NOT NULL
      AND h.expires_at <= v_now
      AND o.state = 'PREFERENCE_PENDING'
      AND (v_order_id IS NULL OR o.id = v_order_id)
    ORDER BY h.expires_at ASC, h.id ASC
    LIMIT v_limit
  LOOP
    v_deferred := v_deferred || jsonb_build_array(
      jsonb_build_object(
        'hold_id', d.hold_id,
        'order_id', d.order_id,
        'order_state', d.order_state,
        'hold_expires_at', d.expires_at,
        'classification', 'PREFERENCE_PENDING_HOLD_PERSISTENCE',
        'action', 'deferred_to_separate_unit'
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'mode', 'dry_run',
    'applied', false,
    'evaluated_at', v_now,
    'correlation_id', v_correlation,
    'requested', v_limit,
    'counts', jsonb_build_object(
      'eligible', v_eligible,
      'noop', v_noop,
      'inconsistent', v_inconsistent,
      'deferred_preference_pending_holds', jsonb_array_length(v_deferred)
    ),
    'candidates', v_candidates,
    'deferred', v_deferred
  );
END;
$$;

REVOKE ALL ON FUNCTION public.expire_payment_pending_aggregate_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_payment_pending_aggregate_tx(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.expire_payment_pending_aggregate_tx(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_payment_pending_aggregate_tx(jsonb) TO project_admin;

REVOKE ALL ON FUNCTION public.expire_payment_pending_dry_run_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_payment_pending_dry_run_tx(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.expire_payment_pending_dry_run_tx(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_payment_pending_dry_run_tx(jsonb) TO project_admin;

COMMENT ON FUNCTION public.expire_payment_pending_aggregate_tx(jsonb) IS
  'IMPL-14A-3B / FIX-2: atomic natural expiry of one PAYMENT_PENDING checkout aggregate. Findings and UUID/state list appends use array_append (B-ARRAY). Canonical clock is clock_timestamp() after the lock. Execute granted to project_admin only; not a least-privilege claim: OD-040-002 remains OPEN.';

COMMENT ON FUNCTION public.expire_payment_pending_dry_run_tx(jsonb) IS
  'IMPL-14A-3B / FIX-2: STABLE inspection of expiry candidates. Evaluation instant is one statement_timestamp() per SQL statement. Findings appends use array_append (B-ARRAY). Zero writes; never an applied reconciliation.';


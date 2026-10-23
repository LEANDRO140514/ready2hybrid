-- =====================================================================
-- 0048_meta-capi-outbox.sql
-- Purpose: Outbox for server-side Meta Conversions API Purchase events.
--          One row per (order, event, delivery mode) so a retry, an
--          overlapping run or a test pass can never send the same purchase
--          twice. Read-only with respect to payments: this file does not
--          create, replace or alter webhook_apply_payment_tx or any other
--          payment function, and it does not touch checkout.
--
-- Numbering: 0046 is reserved for the Openpay migration (docs/openpay);
--            0047 is remove-stale-team-members. Not applied by this commit.
-- Rollback:  docs/meta-capi/0048-rollback.sql
-- =====================================================================

CREATE TABLE public.meta_capi_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id),
  event_name text NOT NULL CHECK (event_name IN ('Purchase')),
  delivery_mode text NOT NULL CHECK (delivery_mode IN ('test', 'live')),
  -- orders.tracking_ref: the same value the browser Pixel sends as eventID,
  -- so Meta can deduplicate the browser and server copies of one purchase.
  event_id text NOT NULL CHECK (length(event_id) > 0),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RETRY', 'SENT', 'FAILED', 'SKIPPED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_until timestamptz,
  sent_at timestamptz,
  fbtrace_id text,
  skip_reason text,
  -- Sanitized, truncated Meta error text. Never a token, never PII.
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_capi_outbox_one_per_order_mode
    UNIQUE (order_id, event_name, delivery_mode)
);

COMMENT ON TABLE public.meta_capi_outbox IS
  'Server-side Meta Conversions API queue. delivery_mode test rows are sent with a test_event_code and never count for ads; live rows are independent of them.';

CREATE INDEX meta_capi_outbox_due
  ON public.meta_capi_outbox (delivery_mode, status, next_attempt_at);

ALTER TABLE public.meta_capi_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.meta_capi_outbox FROM PUBLIC;
REVOKE ALL ON TABLE public.meta_capi_outbox FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- meta_capi_enqueue_tx(p jsonb): p = { "since": <timestamptz>, "mode": "test"|"live" }
-- Queues approved, paid, non-zero orders approved at or after "since".
-- "since" is what keeps history out: nothing before it is ever queued.
-- Returns { "enqueued": <n> }.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.meta_capi_enqueue_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_since timestamptz;
  v_mode text;
  v_count integer;
BEGIN
  v_mode := p ->> 'mode';
  IF v_mode IS NULL OR v_mode NOT IN ('test', 'live') THEN
    RAISE EXCEPTION 'invalid mode';
  END IF;
  BEGIN
    v_since := (p ->> 'since')::timestamptz;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid since';
  END;
  IF v_since IS NULL THEN
    RAISE EXCEPTION 'since is required';
  END IF;

  INSERT INTO public.meta_capi_outbox (order_id, event_name, delivery_mode, event_id)
  SELECT o.id, 'Purchase', v_mode, o.tracking_ref
  FROM public.orders o
  JOIN LATERAL (
    SELECT max(pay.provider_updated_at) AS approved_at
    FROM public.payments pay
    WHERE pay.order_id = o.id
      AND pay.normalized_state = 'APPROVED'
  ) a ON a.approved_at IS NOT NULL
  WHERE o.state = 'PAID'
    AND o.total_cents > 0
    AND o.tracking_ref IS NOT NULL
    AND length(o.tracking_ref) > 0
    AND a.approved_at >= v_since
  ON CONFLICT (order_id, event_name, delivery_mode) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('enqueued', v_count);
END;
$fn$;

-- ---------------------------------------------------------------------
-- meta_capi_claim_batch_tx(p jsonb): p = { "limit": 1..50, "mode": "test"|"live" }
-- Claims due rows for two minutes (SKIP LOCKED, so overlapping runs never
-- take the same row) and counts the attempt. Returns a jsonb array of
-- { id, order_id, event_id, attempts, approved_at }.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.meta_capi_claim_batch_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_limit integer;
  v_mode text;
  v_rows jsonb;
BEGIN
  v_mode := p ->> 'mode';
  IF v_mode IS NULL OR v_mode NOT IN ('test', 'live') THEN
    RAISE EXCEPTION 'invalid mode';
  END IF;
  v_limit := least(greatest(coalesce((p ->> 'limit')::integer, 25), 1), 50);

  WITH due AS (
    SELECT id
    FROM public.meta_capi_outbox
    WHERE delivery_mode = v_mode
      AND status IN ('PENDING', 'RETRY')
      AND next_attempt_at <= now()
      AND (claimed_until IS NULL OR claimed_until < now())
    ORDER BY created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.meta_capi_outbox o
    SET claimed_until = now() + interval '2 minutes',
        attempts = o.attempts + 1,
        updated_at = now()
    FROM due
    WHERE o.id = due.id
    RETURNING o.id, o.order_id, o.event_id, o.attempts
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'order_id', c.order_id,
           'event_id', c.event_id,
           'attempts', c.attempts,
           'approved_at', (
             SELECT max(pay.provider_updated_at)
             FROM public.payments pay
             WHERE pay.order_id = c.order_id AND pay.normalized_state = 'APPROVED'
           )
         )), '[]'::jsonb)
  INTO v_rows
  FROM claimed c;

  RETURN v_rows;
END;
$fn$;

REVOKE ALL ON FUNCTION public.meta_capi_enqueue_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.meta_capi_enqueue_tx(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.meta_capi_enqueue_tx(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.meta_capi_enqueue_tx(jsonb) TO project_admin;

REVOKE ALL ON FUNCTION public.meta_capi_claim_batch_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.meta_capi_claim_batch_tx(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.meta_capi_claim_batch_tx(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.meta_capi_claim_batch_tx(jsonb) TO project_admin;

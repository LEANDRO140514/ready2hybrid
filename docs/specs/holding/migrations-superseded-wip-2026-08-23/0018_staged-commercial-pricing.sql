-- =====================================================================
-- 0018_staged-commercial-pricing.sql
-- Purpose: Local foundation for SPEC-030/031/032 v0.2.0 staged pricing,
--          per-SKU quota metadata, immutable commercial snapshot fields,
--          monotonic stage high-water mark, hold_expires_at stamp, and
--          webhook amount authority vs commercial snapshot (FIX-1).
-- Authority: SALES-GO-LIVE-0C-PRICING-A + SALES-GO-LIVE-0C-PRICING-A-FIX-1
--
-- Limits:
--  · Forward-only local migration. NOT applied to Main or remote sandbox.
--  · Does NOT change GRANT/REVOKE beyond EXECUTE for new helpers to
--    project_admin (same pattern as checkout RPCs).
--  · Does NOT open SALES_STATUS / EN_VENTA.
--  · Does NOT touch Mercado Pago panel, landing, or secrets.
--  · Does NOT use BYPASSRLS.
--
-- 0018 application status (FIX-1 preflight): never applied in any
-- environment — may be corrected in place (local untracked only).
--
-- Rollback (documented; exercised by local harness):
--  · Restore checkout_start_tx / webhook_apply_payment_tx from 0011 / 0009.
--  · DROP TRIGGER trg_order_items_commercial_immutable;
--  · DROP TRIGGER trg_orders_commercial_immutable;
--  · DROP TRIGGER trg_order_items_stamp_commercial;
--  · DROP FUNCTION order_items_commercial_immutable / orders_commercial_immutable
--    / order_items_stamp_commercial_from_snapshot;
--  · DROP FUNCTION order_canonical_total_cents / order_canonical_currency;
--  · DROP FUNCTION commercial_resolve / commercial_allocate_quota /
--    commercial_calendar_stage;
--  · DROP TABLE commercial_stage_advances;
--  · ALTER TABLE order_items DROP commercial_* / hold_expires_at columns;
--  · ALTER TABLE products DROP staged price / HWM columns;
-- =====================================================================

-- Note: no BEGIN/COMMIT — InsForge migration runner forbids transaction control
-- (same convention as 0011). Local harness may wrap in a transaction.

-- ---------------------------------------------------------------------
-- Product staged commercial columns + monotonic high-water mark
-- ---------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS launch_price_cents bigint,
  ADD COLUMN IF NOT EXISTS presale_price_cents bigint,
  ADD COLUMN IF NOT EXISTS regular_price_cents bigint,
  ADD COLUMN IF NOT EXISTS msi_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_rules_version text NOT NULL DEFAULT 'r2h-commercial-2026.1',
  ADD COLUMN IF NOT EXISTS checkout_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS multiday_fail_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commercial_stage_high_water text NOT NULL DEFAULT 'LAUNCH';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_commercial_stage_high_water_chk'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_commercial_stage_high_water_chk
      CHECK (commercial_stage_high_water IN ('LAUNCH', 'PRESALE', 'REGULAR'));
  END IF;
END $$;

COMMENT ON COLUMN public.products.launch_price_cents IS 'SPEC-030 staged LAUNCH price MXN cents (full sale unit).';
COMMENT ON COLUMN public.products.presale_price_cents IS 'SPEC-030 staged PRESALE price MXN cents.';
COMMENT ON COLUMN public.products.regular_price_cents IS 'SPEC-030 staged REGULAR price MXN cents.';
COMMENT ON COLUMN public.products.msi_eligible IS 'SPEC-030 commercial MSI eligibility; provider capability separate.';
COMMENT ON COLUMN public.products.pricing_rules_version IS 'Commercial rules version frozen into order snapshots.';
COMMENT ON COLUMN public.products.checkout_enabled IS 'When false, checkout fail-closed as PRODUCT_DISABLED.';
COMMENT ON COLUMN public.products.multiday_fail_closed IS 'OD-020: PUB-3D/FOT-3D remain fail-closed when true.';
COMMENT ON COLUMN public.products.commercial_stage_high_water IS
  'Monotonic per-SKU commercial stage high-water; never regresses on hold expiry.';

-- Order item denormalized commercial snapshot (immutable after insert).
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS commercial_stage text,
  ADD COLUMN IF NOT EXISTS msi_eligible boolean,
  ADD COLUMN IF NOT EXISTS pricing_rules_version text,
  ADD COLUMN IF NOT EXISTS stage_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_commercial_stage_chk'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_commercial_stage_chk
      CHECK (commercial_stage IS NULL OR commercial_stage IN ('LAUNCH', 'PRESALE', 'REGULAR'));
  END IF;
END $$;

COMMENT ON COLUMN public.order_items.commercial_stage IS 'Immutable commercial stage at order creation (LAUNCH|PRESALE|REGULAR).';
COMMENT ON COLUMN public.order_items.msi_eligible IS 'Immutable MSI eligibility snapshot.';
COMMENT ON COLUMN public.order_items.pricing_rules_version IS 'Immutable commercial rules version.';
COMMENT ON COLUMN public.order_items.stage_resolved_at IS 'Instant used for stage/price resolution.';
COMMENT ON COLUMN public.order_items.hold_expires_at IS 'Aligned hold/order expiry captured at creation.';

-- Audit of stage advances (TIME or QUOTA). No public regress path.
CREATE TABLE IF NOT EXISTS public.commercial_stage_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_code text NOT NULL,
  prior_stage text NOT NULL CHECK (prior_stage IN ('LAUNCH', 'PRESALE', 'REGULAR')),
  new_stage text NOT NULL CHECK (new_stage IN ('LAUNCH', 'PRESALE', 'REGULAR')),
  cause text NOT NULL CHECK (cause IN ('TIME', 'QUOTA')),
  pricing_rules_version text NOT NULL,
  consumed_units integer,
  correlation_id text,
  advanced_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (prior_stage = 'LAUNCH' AND new_stage IN ('PRESALE', 'REGULAR'))
    OR (prior_stage = 'PRESALE' AND new_stage = 'REGULAR')
  )
);

CREATE INDEX IF NOT EXISTS idx_commercial_stage_advances_product_advanced
  ON public.commercial_stage_advances (product_id, advanced_at DESC);

COMMENT ON TABLE public.commercial_stage_advances IS
  'Audit of monotonic commercial stage advances per SKU (TIME or QUOTA).';

-- ---------------------------------------------------------------------
-- Seed staged matrix (canonical codes). price_cents mirrored to regular.
-- ---------------------------------------------------------------------
UPDATE public.products SET
  launch_price_cents = v.launch,
  presale_price_cents = v.presale,
  regular_price_cents = v.regular,
  price_cents = v.regular,
  msi_eligible = v.msi,
  pricing_rules_version = 'r2h-commercial-2026.1',
  checkout_enabled = v.enabled,
  multiday_fail_closed = v.multiday,
  commercial_stage_high_water = COALESCE(commercial_stage_high_water, 'LAUNCH'),
  updated_at = now()
FROM (VALUES
  ('DOB-VIE-MM', 250000, 275000, 300000, true,  true,  false),
  ('DOB-VIE-HH', 250000, 275000, 300000, true,  true,  false),
  ('DOB-VIE-MH', 250000, 275000, 300000, true,  true,  false),
  ('DOB-SAB-MM', 250000, 275000, 300000, true,  true,  false),
  ('DOB-SAB-HH', 250000, 275000, 300000, true,  true,  false),
  ('DOB-SAB-MH', 250000, 275000, 300000, true,  true,  false),
  ('REL-4H',     320000, 350000, 380000, true,  true,  false),
  ('REL-4M',     320000, 350000, 380000, true,  true,  false),
  ('REL-2H2M',   320000, 350000, 380000, true,  true,  false),
  ('IND-H',      150000, 165000, 180000, true,  true,  false),
  ('IND-M',      150000, 165000, 180000, true,  true,  false),
  ('IND-PRO-H',  150000, 165000, 180000, true,  true,  false),
  ('IND-PRO-M',  150000, 165000, 180000, true,  true,  false),
  ('HALF-IND-M',  80000,  90000, 100000, true,  true,  false),
  ('HALF-IND-H',  80000,  90000, 100000, true,  true,  false),
  ('HALF-DOB-MM',160000, 180000, 200000, true,  true,  false),
  ('HALF-DOB-HH',160000, 180000, 200000, true,  true,  false),
  ('HALF-DOB-MH',160000, 180000, 200000, true,  true,  false),
  ('WOD-M',       35000,  35000,  35000, false, true,  false),
  ('WOD-H',       35000,  35000,  35000, false, true,  false),
  ('PUB-VIE',     25000,  25000,  25000, false, true,  false),
  ('PUB-SAB',     25000,  25000,  25000, false, true,  false),
  ('PUB-DOM',     25000,  25000,  25000, false, true,  false),
  ('PUB-3D',      60000,  60000,  60000, false, false, true),
  ('FOT-VIE',     35000,  35000,  35000, false, true,  false),
  ('FOT-SAB',     35000,  35000,  35000, false, true,  false),
  ('FOT-DOM',     35000,  35000,  35000, false, true,  false),
  ('FOT-3D',      80000,  80000,  80000, false, false, true)
) AS v(code, launch, presale, regular, msi, enabled, multiday)
WHERE public.products.code = v.code;

-- ---------------------------------------------------------------------
-- Helpers: America/Merida as fixed UTC-6 (no DST). Half-open [start,end).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commercial_calendar_stage(p_now timestamptz)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_now < TIMESTAMPTZ '2026-08-10 06:00:00+00' THEN NULL
    WHEN p_now >= TIMESTAMPTZ '2026-10-03 06:00:00+00' THEN NULL
    WHEN p_now < TIMESTAMPTZ '2026-08-24 06:00:00+00' THEN 'LAUNCH'
    WHEN p_now < TIMESTAMPTZ '2026-09-14 06:00:00+00' THEN 'PRESALE'
    ELSE 'REGULAR'
  END;
$$;

CREATE OR REPLACE FUNCTION public.commercial_allocate_quota(p_total integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_launch integer;
  v_presale integer;
  v_regular integer;
BEGIN
  IF p_total IS NULL OR p_total < 0 THEN
    RAISE EXCEPTION 'INVALID_CUPO';
  END IF;
  v_launch := floor(p_total * 0.30);
  v_presale := floor(p_total * 0.45);
  v_regular := p_total - v_launch - v_presale;
  RETURN jsonb_build_object(
    'total', p_total,
    'launch', v_launch,
    'presale', v_presale,
    'regular', v_regular,
    'launch_threshold', v_launch,
    'presale_cumulative_threshold', v_launch + v_presale
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.commercial_resolve(
  p_product_code text,
  p_now timestamptz,
  p_consumed integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_cal text;
  v_threshold text;
  v_hwm text;
  v_stage text;
  v_quota jsonb;
  v_price bigint;
  v_launch_th integer;
  v_presale_th integer;
BEGIN
  SELECT * INTO v_product FROM public.products WHERE code = p_product_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PRODUCT_NOT_FOUND');
  END IF;

  IF COALESCE(v_product.multiday_fail_closed, false) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'MULTIDAY_FAIL_CLOSED');
  END IF;
  IF NOT COALESCE(v_product.checkout_enabled, true) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PRODUCT_DISABLED');
  END IF;
  IF v_product.launch_price_cents IS NULL
     OR v_product.presale_price_cents IS NULL
     OR v_product.regular_price_cents IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CONFIGURATION_ERROR');
  END IF;

  IF p_now >= TIMESTAMPTZ '2026-10-03 06:00:00+00' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SALES_CLOSED');
  END IF;

  v_cal := public.commercial_calendar_stage(p_now);
  IF v_cal IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SALES_NOT_OPEN');
  END IF;

  v_quota := public.commercial_allocate_quota(v_product.cupo);
  v_launch_th := (v_quota->>'launch_threshold')::integer;
  v_presale_th := (v_quota->>'presale_cumulative_threshold')::integer;

  IF COALESCE(p_consumed, 0) >= v_presale_th THEN
    v_threshold := 'REGULAR';
  ELSIF COALESCE(p_consumed, 0) >= v_launch_th THEN
    v_threshold := 'PRESALE';
  ELSE
    v_threshold := 'LAUNCH';
  END IF;

  v_hwm := COALESCE(NULLIF(v_product.commercial_stage_high_water, ''), 'LAUNCH');
  IF v_hwm NOT IN ('LAUNCH', 'PRESALE', 'REGULAR') THEN
    v_hwm := 'LAUNCH';
  END IF;

  -- max(calendar, persisted high-water, threshold); never retreat
  v_stage := CASE
    WHEN v_cal = 'REGULAR' OR v_threshold = 'REGULAR' OR v_hwm = 'REGULAR' THEN 'REGULAR'
    WHEN v_cal = 'PRESALE' OR v_threshold = 'PRESALE' OR v_hwm = 'PRESALE' THEN 'PRESALE'
    ELSE 'LAUNCH'
  END;

  IF COALESCE(p_consumed, 0) >= v_product.cupo THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SOLD_OUT');
  END IF;

  v_price := CASE v_stage
    WHEN 'LAUNCH' THEN v_product.launch_price_cents
    WHEN 'PRESALE' THEN v_product.presale_price_cents
    ELSE v_product.regular_price_cents
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'product_code', v_product.code,
    'commercial_stage', v_stage,
    'unit_price_cents', v_price,
    'currency', 'MXN',
    'msi_eligible', COALESCE(v_product.msi_eligible, false),
    'pricing_rules_version', COALESCE(v_product.pricing_rules_version, 'r2h-commercial-2026.1'),
    'stage_resolved_at', p_now,
    'quota', v_quota,
    'consumed_units', COALESCE(p_consumed, 0),
    'persisted_stage', v_hwm
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.order_canonical_total_cents(p_order public.orders)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF((p_order.commercial_snapshot->>'total_price_cents')::bigint, NULL),
    p_order.total_cents
  );
$$;

CREATE OR REPLACE FUNCTION public.order_canonical_currency(p_order public.orders)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT upper(COALESCE(
    NULLIF(p_order.commercial_snapshot->>'currency', ''),
    p_order.currency,
    'MXN'
  ));
$$;

REVOKE ALL ON FUNCTION public.commercial_calendar_stage(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commercial_allocate_quota(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commercial_resolve(text, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_canonical_total_cents(public.orders) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_canonical_currency(public.orders) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commercial_calendar_stage(timestamptz) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.commercial_allocate_quota(integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.commercial_resolve(text, timestamptz, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.order_canonical_total_cents(public.orders) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.order_canonical_currency(public.orders) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commercial_calendar_stage(timestamptz) TO project_admin;
GRANT EXECUTE ON FUNCTION public.commercial_allocate_quota(integer) TO project_admin;
GRANT EXECUTE ON FUNCTION public.commercial_resolve(text, timestamptz, integer) TO project_admin;
GRANT EXECUTE ON FUNCTION public.order_canonical_total_cents(public.orders) TO project_admin;
GRANT EXECUTE ON FUNCTION public.order_canonical_currency(public.orders) TO project_admin;

-- Stamp denormalized commercial columns from jsonb snapshot on INSERT only.
CREATE OR REPLACE FUNCTION public.order_items_stamp_commercial_from_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.commercial_snapshot IS NOT NULL THEN
    NEW.commercial_stage := COALESCE(NEW.commercial_stage, NEW.commercial_snapshot->>'commercial_stage');
    IF NEW.msi_eligible IS NULL AND NEW.commercial_snapshot ? 'msi_eligible' THEN
      NEW.msi_eligible := (NEW.commercial_snapshot->>'msi_eligible')::boolean;
    END IF;
    NEW.pricing_rules_version := COALESCE(
      NEW.pricing_rules_version,
      NEW.commercial_snapshot->>'pricing_rules_version'
    );
    IF NEW.stage_resolved_at IS NULL AND NEW.commercial_snapshot ? 'stage_resolved_at' THEN
      NEW.stage_resolved_at := (NEW.commercial_snapshot->>'stage_resolved_at')::timestamptz;
    END IF;
    IF NEW.hold_expires_at IS NULL AND NEW.commercial_snapshot ? 'hold_expires_at'
       AND NULLIF(NEW.commercial_snapshot->>'hold_expires_at', '') IS NOT NULL THEN
      NEW.hold_expires_at := (NEW.commercial_snapshot->>'hold_expires_at')::timestamptz;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.order_items_commercial_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.commercial_snapshot IS DISTINCT FROM NEW.commercial_snapshot
     OR OLD.commercial_stage IS DISTINCT FROM NEW.commercial_stage
     OR OLD.msi_eligible IS DISTINCT FROM NEW.msi_eligible
     OR OLD.pricing_rules_version IS DISTINCT FROM NEW.pricing_rules_version
     OR OLD.stage_resolved_at IS DISTINCT FROM NEW.stage_resolved_at
     OR OLD.hold_expires_at IS DISTINCT FROM NEW.hold_expires_at
     OR OLD.unit_price_cents IS DISTINCT FROM NEW.unit_price_cents
     OR OLD.quantity IS DISTINCT FROM NEW.quantity
     OR OLD.item_total_cents IS DISTINCT FROM NEW.item_total_cents
     OR OLD.product_code IS DISTINCT FROM NEW.product_code
     OR OLD.currency IS DISTINCT FROM NEW.currency
  THEN
    RAISE EXCEPTION 'COMMERCIAL_SNAPSHOT_IMMUTABLE'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_commercial_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.commercial_snapshot IS DISTINCT FROM NEW.commercial_snapshot
     OR OLD.total_cents IS DISTINCT FROM NEW.total_cents
     OR OLD.subtotal_cents IS DISTINCT FROM NEW.subtotal_cents
     OR OLD.currency IS DISTINCT FROM NEW.currency
  THEN
    RAISE EXCEPTION 'COMMERCIAL_SNAPSHOT_IMMUTABLE'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_stamp_commercial ON public.order_items;
CREATE TRIGGER trg_order_items_stamp_commercial
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.order_items_stamp_commercial_from_snapshot();

DROP TRIGGER IF EXISTS trg_order_items_commercial_immutable ON public.order_items;
CREATE TRIGGER trg_order_items_commercial_immutable
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.order_items_commercial_immutable();

DROP TRIGGER IF EXISTS trg_orders_commercial_immutable ON public.orders;
CREATE TRIGGER trg_orders_commercial_immutable
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE PROCEDURE public.orders_commercial_immutable();


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
  v_capacity_now timestamptz;
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
  v_team_id uuid;
  v_team_public text;
  v_captain_member_id uuid;
  v_invite_member_id uuid;
  v_invite_raw text;
  v_invite_hash text;
  v_invite_ttl integer := COALESCE((p->>'invitation_ttl_seconds')::integer, 0);
  v_invite_expires timestamptz;
  v_invitations jsonb := '[]'::jsonb;
  v_pos integer;
  v_waiver_doc_id uuid;
  v_waiver_acc_id uuid;
  v_waiver_type text := NULLIF(p->>'waiver_document_type', '');
  v_waiver_version text := NULLIF(p->>'waiver_document_version', '');
  v_waiver_accepted boolean := COALESCE((p->>'waiver_accepted')::boolean, false);
  v_captain_member_state text := 'STARTED';
  v_i integer;
  v_unit_participant_id uuid;
  v_participation_type text;
  v_snap jsonb;
  v_hwm text;
  v_cal text;
  v_threshold text;
  v_effective text;
  v_edge_stage text;
  v_consumed integer;
  v_quota jsonb;
  v_launch_th integer;
  v_presale_th integer;
  v_cause text;
  v_stage_rank_hwm integer;
  v_stage_rank_eff integer;
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

  -- OD-001 APPROVED: spectator may purchase quantity >= 1 access units.
  -- Competitors, workouts, press, and teams remain quantity = 1.
  IF v_qty IS NULL OR v_qty < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;
  IF v_product.kind = 'spectator' THEN
    v_units := v_qty;
  ELSE
    IF v_qty <> 1 THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
    END IF;
    v_units := 1;
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

  -- SPEC-040-I007 / R004 canonical capacity clock.
  -- now() is transaction start time and would be stale after waiting on the
  -- product/event locks above, so read the wall clock once serialization is
  -- complete. Captured a single time so every row is judged by one instant.
  -- ACTIVE holds with expires_at <= v_capacity_now do not consume cupo; the
  -- clock source is the database only, never client time. expires_at IS NULL
  -- is unknown expiry, not expiry: it keeps reserving cupo (fail-closed) until
  -- a separately approved unit constrains or repairs it.
  v_capacity_now := clock_timestamp();
  SELECT COALESCE(SUM(capacity_units), 0)::integer INTO v_active_holds
  FROM public.capacity_holds
  WHERE product_id = v_product.id
    AND state = 'ACTIVE'
    AND (expires_at IS NULL OR expires_at > v_capacity_now);

  IF v_active_holds + v_units > v_product.cupo THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SOLD_OUT');
  END IF;

  v_expires_at := now() + make_interval(secs => v_hold_seconds);

  -- FIX-01/02: commercial high-water + stamp hold_expires_at once from v_expires_at
  v_hwm := COALESCE(NULLIF(v_product.commercial_stage_high_water, ''), 'LAUNCH');
  IF v_hwm NOT IN ('LAUNCH', 'PRESALE', 'REGULAR') THEN
    v_hwm := 'LAUNCH';
  END IF;

  SELECT COALESCE(SUM(capacity_units), 0)::integer INTO v_consumed
  FROM public.capacity_holds
  WHERE product_id = v_product.id
    AND (
      state = 'CONVERTED'
      OR (state = 'ACTIVE' AND (expires_at IS NULL OR expires_at > v_capacity_now))
    );

  v_quota := public.commercial_allocate_quota(v_product.cupo);
  v_launch_th := (v_quota->>'launch_threshold')::integer;
  v_presale_th := (v_quota->>'presale_cumulative_threshold')::integer;
  IF v_consumed >= v_presale_th THEN
    v_threshold := 'REGULAR';
  ELSIF v_consumed >= v_launch_th THEN
    v_threshold := 'PRESALE';
  ELSE
    v_threshold := 'LAUNCH';
  END IF;

  v_cal := public.commercial_calendar_stage(v_capacity_now);
  IF v_cal IS NULL THEN
    v_cal := 'LAUNCH';
  END IF;

  v_snap := COALESCE(p->'commercial_snapshot', '{}'::jsonb);
  v_edge_stage := COALESCE(NULLIF(v_snap->>'commercial_stage', ''), 'LAUNCH');
  IF v_edge_stage NOT IN ('LAUNCH', 'PRESALE', 'REGULAR') THEN
    v_edge_stage := 'LAUNCH';
  END IF;

  v_effective := CASE
    WHEN v_cal = 'REGULAR' OR v_threshold = 'REGULAR' OR v_hwm = 'REGULAR' OR v_edge_stage = 'REGULAR' THEN 'REGULAR'
    WHEN v_cal = 'PRESALE' OR v_threshold = 'PRESALE' OR v_hwm = 'PRESALE' OR v_edge_stage = 'PRESALE' THEN 'PRESALE'
    ELSE 'LAUNCH'
  END;

  v_stage_rank_hwm := CASE v_hwm WHEN 'REGULAR' THEN 3 WHEN 'PRESALE' THEN 2 ELSE 1 END;
  v_stage_rank_eff := CASE v_effective WHEN 'REGULAR' THEN 3 WHEN 'PRESALE' THEN 2 ELSE 1 END;

  IF v_stage_rank_eff > v_stage_rank_hwm THEN
    v_cause := CASE
      WHEN (CASE v_threshold WHEN 'REGULAR' THEN 3 WHEN 'PRESALE' THEN 2 ELSE 1 END) >= v_stage_rank_eff
        THEN 'QUOTA'
      ELSE 'TIME'
    END;
    UPDATE public.products
    SET commercial_stage_high_water = v_effective,
        updated_at = now()
    WHERE id = v_product.id;
    INSERT INTO public.commercial_stage_advances (
      product_id, product_code, prior_stage, new_stage, cause,
      pricing_rules_version, consumed_units, correlation_id
    ) VALUES (
      v_product.id,
      v_product.code,
      v_hwm,
      v_effective,
      v_cause,
      COALESCE(v_snap->>'pricing_rules_version', v_product.pricing_rules_version, 'r2h-commercial-2026.1'),
      v_consumed,
      p->>'correlation_id'
    );
    v_hwm := v_effective;
  END IF;

  v_snap := v_snap || jsonb_build_object(
    'hold_expires_at', to_char(v_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'commercial_stage', v_effective
  );

  v_tracking := 'trk_' || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := encode(sha256(('order-holder:' || v_tracking)::bytea), 'hex');

  INSERT INTO public.buyer_contacts (public_ref, state)
  VALUES (COALESCE(p->>'buyer_public_ref', 'buyer_' || replace(gen_random_uuid()::text, '-', '')), 'ACTIVE')
  RETURNING id INTO v_buyer_id;

  v_participation_type := CASE
    WHEN v_product.kind = 'spectator' THEN 'SPECTATOR'
    WHEN v_product.kind = 'press' THEN 'PRESS'
    WHEN v_product.kind = 'workout' THEN 'WORKOUT'
    ELSE 'COMPETITOR'
  END;

  INSERT INTO public.participants (public_ref, buyer_contact_id, participation_type, state)
  VALUES (
    COALESCE(p->>'participant_public_ref', 'part_' || replace(gen_random_uuid()::text, '-', '')),
    v_buyer_id,
    v_participation_type,
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
    v_snap
  )
  RETURNING id INTO v_order_id;

  -- Bind external_reference to order id (SPEC / IMPL-10).
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
    v_snap
  )
  RETURNING id INTO v_item_id;

  -- One registration per sold access unit (spectator companions: no PII).
  FOR v_i IN 1..v_qty LOOP
    IF v_i = 1 THEN
      v_unit_participant_id := v_participant_id;
    ELSE
      INSERT INTO public.participants (public_ref, buyer_contact_id, participation_type, state)
      VALUES (
        'access_' || replace(gen_random_uuid()::text, '-', ''),
        v_buyer_id,
        v_participation_type,
        'ACTIVE'
      )
      RETURNING id INTO v_unit_participant_id;
    END IF;

    INSERT INTO public.registrations (
      event_id, event_code, product_id, product_code, participant_id, order_id, journey, state
    ) VALUES (
      v_event.id, v_event.code, v_product.id, v_product.code, v_unit_participant_id, v_order_id, p->>'journey', 'STARTED'
    )
    RETURNING id INTO v_registration_id;
  END LOOP;

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


  -- IMPL-10: J2/J3 team shell when product.team_size > 1 (docs/03 J4 / SPEC J2-J3).
  IF v_product.team_size > 1 THEN
    IF v_invite_ttl <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'CONFIGURATION_ERROR');
    END IF;
    v_invite_expires := now() + make_interval(secs => v_invite_ttl);
    v_team_public := 'team_' || replace(gen_random_uuid()::text, '-', '');

    IF v_waiver_accepted AND v_waiver_type IS NOT NULL AND v_waiver_version IS NOT NULL THEN
      INSERT INTO public.waiver_documents (document_type, version, state, valid_from)
      VALUES (v_waiver_type, v_waiver_version, 'ACTIVE', now())
      ON CONFLICT (document_type, version) DO NOTHING;

      SELECT id INTO v_waiver_doc_id
      FROM public.waiver_documents
      WHERE document_type = v_waiver_type AND version = v_waiver_version;

      INSERT INTO public.waiver_acceptances (
        waiver_document_id, document_type, document_version, participant_id,
        actor_ref, context, authorized_evidence, accepted_at
      ) VALUES (
        v_waiver_doc_id, v_waiver_type, v_waiver_version, v_participant_id,
        'edge:mp-create-checkout', 'CHECKOUT_CAPTAIN',
        jsonb_build_object('source', 'checkout_start'),
        now()
      )
      RETURNING id INTO v_waiver_acc_id;
      v_captain_member_state := 'COMPLETE';
    END IF;

    INSERT INTO public.teams (
      public_ref, product_id, product_code, captain_participant_id,
      required_size, slots_complete, roster_state, payment_state, eligibility_state
    ) VALUES (
      v_team_public, v_product.id, v_product.code, v_participant_id,
      v_product.team_size,
      CASE WHEN v_captain_member_state = 'COMPLETE' THEN 1 ELSE 0 END,
      'PROVISIONAL', 'UNPAID', 'NOT_ELIGIBLE'
    )
    RETURNING id INTO v_team_id;

    INSERT INTO public.team_members (
      team_id, position, role, participant_id, registration_id, state, waiver_acceptance_id
    ) VALUES (
      v_team_id, 1, 'CAPTAIN', v_participant_id, v_registration_id, v_captain_member_state, v_waiver_acc_id
    )
    RETURNING id INTO v_captain_member_id;

    UPDATE public.teams
    SET captain_team_member_id = v_captain_member_id,
        roster_state = 'PAYMENT_PENDING',
        updated_at = now()
    WHERE id = v_team_id;

    UPDATE public.registrations
    SET team_id = v_team_id,
        team_member_id = v_captain_member_id,
        updated_at = now()
    WHERE id = v_registration_id;

    INSERT INTO public.capability_credentials (
      kind, token_hash, least_scope, subject_ref, resource_ref,
      order_id, team_id, state, generation, expires_at
    ) VALUES (
      'CAPTAIN',
      encode(sha256(('captain:' || v_team_public || ':' || v_tracking)::bytea), 'hex'),
      'team:captain',
      v_participant_id::text,
      v_team_id::text,
      v_order_id,
      v_team_id,
      'ISSUED',
      1,
      v_expires_at
    );

    FOR v_pos IN 2..v_product.team_size LOOP
      v_invite_raw := 'inv_' || replace(gen_random_uuid()::text, '-', '');
      v_invite_hash := encode(sha256(v_invite_raw::bytea), 'hex');

      INSERT INTO public.team_members (
        team_id, position, role, state
      ) VALUES (
        v_team_id, v_pos, 'INVITEE', 'INVITED'
      )
      RETURNING id INTO v_invite_member_id;

      INSERT INTO public.capability_credentials (
        kind, token_hash, least_scope, subject_ref, resource_ref, slot_ref,
        order_id, team_id, team_member_id, state, generation, expires_at
      ) VALUES (
        'INVITATION_EXCHANGE_CODE',
        v_invite_hash,
        'team:invite',
        v_team_id::text,
        v_team_id::text,
        v_pos::text,
        v_order_id,
        v_team_id,
        v_invite_member_id,
        'ISSUED',
        1,
        v_invite_expires
      );

      UPDATE public.team_members
      SET invitation_capability_id = (
            SELECT id FROM public.capability_credentials
            WHERE token_hash = v_invite_hash
          ),
          updated_at = now()
      WHERE id = v_invite_member_id;

      v_invitations := v_invitations || jsonb_build_array(
        jsonb_build_object('token', v_invite_raw)
      );
    END LOOP;
  END IF;

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
    jsonb_build_object('product_code', v_product.code, 'journey', p->>'journey', 'quantity', v_qty, 'capacity_units', v_units)
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
    'external_reference', v_order_id::text,
    'team_id', v_team_id,
    'invitation_tokens', v_invitations
  );
END;
$$;


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

  -- FIX-06: snapshot is amount/currency authority (fallback to denormalized columns).
  v_amount_ok := v_amount_pre_ok
    AND v_order_found
    AND v_amount_cents = public.order_canonical_total_cents(v_order);
  v_currency_ok := v_currency_ok
    AND v_order_found
    AND v_currency = public.order_canonical_currency(v_order);
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




REVOKE ALL ON FUNCTION public.checkout_start_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkout_start_tx(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_start_tx(jsonb) TO project_admin;

COMMENT ON FUNCTION public.checkout_start_tx(jsonb) IS
  'TX-1 checkout start; SPEC-040 capacity; FIX-1 HWM + hold_expires_at stamp.';

REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_apply_payment_tx(jsonb) TO project_admin;

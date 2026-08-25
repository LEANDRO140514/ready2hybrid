-- =====================================================================
-- 0019_relaunch-v0-3-commercial-data.sql
-- Purpose: SPEC-030/031/032 v0.3.0 commercial data + staged schema on
--          already-seeded Main v10 catalog (0001–0010). Does NOT apply
--          or rewrite 0018. Does NOT open SALES_STATUS.
-- Authority: RELAUNCH-IMPL-2-COMMERCIAL-DATA
--            OD-RELAUNCH-003 APPROVED: RETIRED_FROM_SALE = checkout_enabled=false
--            OD-RELAUNCH-004 APPROVED: domain FULL_DAY persists as ALL_DAY
--
-- Limits:
--  · No BEGIN/COMMIT (InsForge runner).
--  · No DELETE of events / event_days / products / orders / payments /
--    registrations / tickets.
--  · Does NOT replace checkout_start_tx / webhook_apply_payment_tx
--    (0018 copies those from 0011/0009; 0011 remains NOT authorized on Main).
--  · Does NOT apply 0011–0018.
--  · Does NOT set EN_VENTA or sales_open_at.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Staged commercial columns (0018 concept; required because 0018 is unapplied)
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

COMMENT ON COLUMN public.products.checkout_enabled IS
  'Durable sale gate. false = RETIRED_FROM_SALE / not checkout-eligible. OD-RELAUNCH-003.';
COMMENT ON COLUMN public.products.multiday_fail_closed IS
  'OD-020: PUB-3D/FOT-3D remain fail-closed when true.';
COMMENT ON COLUMN public.products.msi_eligible IS
  'SPEC-030 commercial MSI eligibility; Mercado Pago policy unchanged. Provider capability separate.';

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

-- ---------------------------------------------------------------------
-- Session CHECK: persist ALL_DAY for domain FULL_DAY (OD-RELAUNCH-004)
-- ---------------------------------------------------------------------
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS ck_products_session;
ALTER TABLE public.products
  ADD CONSTRAINT ck_products_session
  CHECK (session IS NULL OR session IN ('AM', 'PM', 'ALL_DAY'));

COMMENT ON CONSTRAINT ck_products_session ON public.products IS
  'AM/PM/ALL_DAY/NULL. Domain FULL_DAY persists as ALL_DAY. FULL_DAY is not a physical token.';

-- ---------------------------------------------------------------------
-- Event dates — HEX-2026 only. Status and sales_open_at untouched.
-- ---------------------------------------------------------------------
UPDATE public.events
SET
  starts_on = DATE '2026-11-13',
  ends_on = DATE '2026-11-15',
  updated_at = now()
WHERE code = 'HEX-2026';

-- Preserve event_day row identities. October dates -> November; session occupancy.
UPDATE public.event_days
SET
  day_date = DATE '2026-11-13',
  session = 'PM',
  label = 'Viernes 13 — Dobles e Individual (PM)',
  updated_at = now()
WHERE event_code = 'HEX-2026'
  AND day_date IN (DATE '2026-10-09', DATE '2026-11-13');

UPDATE public.event_days
SET
  day_date = DATE '2026-11-14',
  session = 'ALL_DAY',
  label = 'Sábado 14 — Día completo',
  updated_at = now()
WHERE event_code = 'HEX-2026'
  AND day_date IN (DATE '2026-10-10', DATE '2026-11-14');

UPDATE public.event_days
SET
  day_date = DATE '2026-11-15',
  session = 'AM',
  label = 'Domingo 15 — Relay (AM)',
  updated_at = now()
WHERE event_code = 'HEX-2026'
  AND day_date IN (DATE '2026-10-11', DATE '2026-11-15');

-- ---------------------------------------------------------------------
-- Product day/session redistribution (vendible). Retired rows kept.
-- ---------------------------------------------------------------------
UPDATE public.products SET day = DATE '2026-11-13', session = 'PM', updated_at = now()
WHERE event_code = 'HEX-2026' AND code IN ('DOB-VIE-MM', 'IND-H', 'IND-M');

UPDATE public.products SET day = DATE '2026-11-14', session = 'ALL_DAY', updated_at = now()
WHERE event_code = 'HEX-2026' AND code IN (
  'DOB-SAB-HH', 'DOB-SAB-MH',
  'HALF-IND-M', 'HALF-IND-H', 'HALF-DOB-MM', 'HALF-DOB-HH', 'HALF-DOB-MH',
  'WOD-M', 'WOD-H'
);

UPDATE public.products SET day = DATE '2026-11-15', session = 'AM', updated_at = now()
WHERE event_code = 'HEX-2026' AND code IN ('REL-4H', 'REL-4M', 'REL-2H2M');

-- ASISTE single-day: dates only; session remains NULL (OD-RELAUNCH-002).
UPDATE public.products SET day = DATE '2026-11-13', updated_at = now()
WHERE event_code = 'HEX-2026' AND code IN ('PUB-VIE', 'FOT-VIE');
UPDATE public.products SET day = DATE '2026-11-14', updated_at = now()
WHERE event_code = 'HEX-2026' AND code IN ('PUB-SAB', 'FOT-SAB');
UPDATE public.products SET day = DATE '2026-11-15', updated_at = now()
WHERE event_code = 'HEX-2026' AND code IN ('PUB-DOM', 'FOT-DOM');

-- Multiday ASISTE: keep day/session NULL.
UPDATE public.products SET day = NULL, session = NULL, updated_at = now()
WHERE event_code = 'HEX-2026' AND code IN ('PUB-3D', 'FOT-3D');

-- Retired: preserve historical session class; move dates onto November event days.
-- Do not map DOB-SAB-MM to ALL_DAY (not a vendible Saturday FULL_DAY SKU).
UPDATE public.products SET day = DATE '2026-11-13', session = 'PM', updated_at = now()
WHERE event_code = 'HEX-2026' AND code IN ('DOB-VIE-HH', 'DOB-VIE-MH');
UPDATE public.products SET day = DATE '2026-11-14', session = 'AM', updated_at = now()
WHERE event_code = 'HEX-2026' AND code = 'DOB-SAB-MM';
UPDATE public.products SET day = DATE '2026-11-15', session = 'AM', updated_at = now()
WHERE event_code = 'HEX-2026' AND code IN ('IND-PRO-H', 'IND-PRO-M');

-- ---------------------------------------------------------------------
-- Staged prices / MSI (PRICING_VALUES_MATCH) + checkout_enabled
-- 23 vendible: checkout_enabled true; PUB-3D/FOT-3D also multiday_fail_closed.
-- 5 retired: checkout_enabled false. No DELETE.
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
  ('DOB-SAB-HH', 250000, 275000, 300000, true,  true,  false),
  ('DOB-SAB-MH', 250000, 275000, 300000, true,  true,  false),
  ('REL-4H',     320000, 350000, 380000, true,  true,  false),
  ('REL-4M',     320000, 350000, 380000, true,  true,  false),
  ('REL-2H2M',   320000, 350000, 380000, true,  true,  false),
  ('IND-H',      150000, 165000, 180000, true,  true,  false),
  ('IND-M',      150000, 165000, 180000, true,  true,  false),
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
  ('PUB-3D',      60000,  60000,  60000, false, true,  true),
  ('FOT-VIE',     35000,  35000,  35000, false, true,  false),
  ('FOT-SAB',     35000,  35000,  35000, false, true,  false),
  ('FOT-DOM',     35000,  35000,  35000, false, true,  false),
  ('FOT-3D',      80000,  80000,  80000, false, true,  true),
  ('IND-PRO-H',  150000, 165000, 180000, true,  false, false),
  ('IND-PRO-M',  150000, 165000, 180000, true,  false, false),
  ('DOB-VIE-HH', 250000, 275000, 300000, true,  false, false),
  ('DOB-VIE-MH', 250000, 275000, 300000, true,  false, false),
  ('DOB-SAB-MM', 250000, 275000, 300000, true,  false, false)
) AS v(code, launch, presale, regular, msi, enabled, multiday)
WHERE public.products.code = v.code
  AND public.products.event_code = 'HEX-2026';

-- ---------------------------------------------------------------------
-- Calendar helpers. America/Merida midnight = UTC−6 (no DST) = 06:00+00.
-- SPEC-030-R201/R202 half-open [start, end).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commercial_calendar_stage(p_now timestamptz)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_now < TIMESTAMPTZ '2026-08-11 06:00:00+00' THEN NULL
    WHEN p_now >= TIMESTAMPTZ '2026-11-08 06:00:00+00' THEN NULL
    WHEN p_now < TIMESTAMPTZ '2026-09-01 06:00:00+00' THEN 'LAUNCH'
    WHEN p_now < TIMESTAMPTZ '2026-10-01 06:00:00+00' THEN 'PRESALE'
    ELSE 'REGULAR'
  END;
$$;

COMMENT ON FUNCTION public.commercial_calendar_stage(timestamptz) IS
  'SPEC-030 v0.3.0 windows in America/Merida. 06:00+00 = local midnight UTC-6.';

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

  IF p_now >= TIMESTAMPTZ '2026-11-08 06:00:00+00' THEN
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

REVOKE ALL ON FUNCTION public.commercial_calendar_stage(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commercial_allocate_quota(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commercial_resolve(text, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_canonical_total_cents(public.orders) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_canonical_currency(public.orders) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commercial_calendar_stage(timestamptz) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.commercial_allocate_quota(integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.commercial_resolve(text, timestamptz, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commercial_calendar_stage(timestamptz) TO project_admin;
GRANT EXECUTE ON FUNCTION public.commercial_allocate_quota(integer) TO project_admin;
GRANT EXECUTE ON FUNCTION public.commercial_resolve(text, timestamptz, integer) TO project_admin;
GRANT EXECUTE ON FUNCTION public.order_canonical_total_cents(public.orders) TO project_admin;
GRANT EXECUTE ON FUNCTION public.order_canonical_currency(public.orders) TO project_admin;

-- =====================================================================
-- 0031_payment-finance-adjustments.sql
-- Purpose: Auditable processor-cost layer for sales reconciliation.
--          Does not change orders, payments, products, prices, or states.
--          Gross revenue stays orders.total_cents. Net is computed, not stored.
-- Predecessor: 0030_dashboard-readers.sql
--
-- One row per order and per payment. Costs may be explicit zeros.
-- A missing row means "not captured", which is different from captured $0.
-- source MANUAL is what the dashboard writes. PROVIDER is reserved for a
-- later processor import and is not written by this unit.
--
-- NOT applied to Main by this unit.
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   wraps each migration in its own transaction.
-- =====================================================================

CREATE TABLE public.payment_finance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  provider text NOT NULL,
  provider_fee_cents bigint NOT NULL,
  provider_fee_tax_cents bigint NOT NULL,
  other_costs_cents bigint NOT NULL,
  notes text,
  source text NOT NULL DEFAULT 'MANUAL',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_finance_adjustments_order UNIQUE (order_id),
  CONSTRAINT uq_payment_finance_adjustments_payment UNIQUE (payment_id),
  CONSTRAINT fk_payment_finance_adjustments_order
    FOREIGN KEY (order_id) REFERENCES public.orders (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payment_finance_adjustments_payment
    FOREIGN KEY (payment_id) REFERENCES public.payments (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_payment_finance_adjustments_provider_nonempty
    CHECK (btrim(provider) <> ''),
  CONSTRAINT ck_payment_finance_adjustments_fee_nonnegative
    CHECK (provider_fee_cents >= 0),
  CONSTRAINT ck_payment_finance_adjustments_fee_tax_nonnegative
    CHECK (provider_fee_tax_cents >= 0),
  CONSTRAINT ck_payment_finance_adjustments_other_nonnegative
    CHECK (other_costs_cents >= 0),
  CONSTRAINT ck_payment_finance_adjustments_notes_len
    CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT ck_payment_finance_adjustments_source
    CHECK (source IN ('MANUAL', 'PROVIDER')),
  CONSTRAINT ck_payment_finance_adjustments_created_by_nonempty
    CHECK (btrim(created_by) <> ''),
  CONSTRAINT ck_payment_finance_adjustments_updated_by_nonempty
    CHECK (btrim(updated_by) <> '')
);

COMMENT ON TABLE public.payment_finance_adjustments IS
  'Processor fees and other finance costs for one paid order. Not a commercial amount and not an affiliate commission.';

CREATE OR REPLACE FUNCTION public.payment_finance_adjustments_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order uuid;
  v_provider text;
BEGIN
  SELECT p.order_id, p.provider
    INTO v_order, v_provider
  FROM public.payments p
  WHERE p.id = NEW.payment_id;

  IF v_order IS NULL OR v_order IS DISTINCT FROM NEW.order_id THEN
    RAISE EXCEPTION 'payment_finance_adjustment payment/order mismatch';
  END IF;
  IF v_provider IS DISTINCT FROM NEW.provider THEN
    RAISE EXCEPTION 'payment_finance_adjustment provider mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_finance_adjustments_guard
  ON public.payment_finance_adjustments;

CREATE TRIGGER trg_payment_finance_adjustments_guard
  BEFORE INSERT OR UPDATE ON public.payment_finance_adjustments
  FOR EACH ROW
  EXECUTE PROCEDURE public.payment_finance_adjustments_guard();

ALTER TABLE public.payment_finance_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_finance_adjustments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_finance_adjustments FROM PUBLIC;
REVOKE ALL ON TABLE public.payment_finance_adjustments FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_finance_adjustments_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payment_finance_adjustments_guard() FROM anon, authenticated;

-- =====================================================================
-- 0040_legacy-reconciliations.sql
-- Purpose: bank reconciliation of LEGACY paid registrations (Clip / Mercado
--          Pago): what the gateway deposited and the fee it kept.
--          Separate from payment_finance_adjustments. Legacy never mixes with
--          native orders/payments (see 0036 header).
-- Predecessor: 0036_legacy-hybrid-registrations.sql
-- Production cannot apply version 40: 42 is already the remote head.
-- The same schema is applied as 0044_legacy-reconciliations.sql.
-- 0041 stays with Openpay. Do not apply this file on 4bg9ufz2.
--
-- Touches no existing table. Creates one table, one guard function and one
-- trigger. Rollback:
--   DROP TABLE public.legacy_reconciliations;
--   DROP FUNCTION public.legacy_reconciliations_guard();
--
-- Courtesy / staff rows (amount 0 or null) are rejected by the guard: there is
-- no bank deposit to match. gross_cents is copied from legacy_registrations by
-- the guard and is never trusted from the client.
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   wraps each migration in its own transaction.
-- =====================================================================

CREATE TABLE public.legacy_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_registration_id uuid NOT NULL,
  origen_datos text NOT NULL DEFAULT 'legacy',
  provider text NOT NULL,
  bank_reference text,
  gross_cents bigint NOT NULL,
  deposited_cents bigint NOT NULL,
  provider_fee_cents bigint GENERATED ALWAYS AS (gross_cents - deposited_cents) STORED,
  notes text,
  reconciled_by text NOT NULL,
  reconciled_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_legacy_reconciliations_registration UNIQUE (legacy_registration_id),
  CONSTRAINT fk_legacy_reconciliations_registration
    FOREIGN KEY (legacy_registration_id) REFERENCES public.legacy_registrations (id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_legacy_reconciliations_origen CHECK (origen_datos = 'legacy'),
  CONSTRAINT ck_legacy_reconciliations_provider
    CHECK (provider IN ('MERCADOPAGO', 'CLIP', 'OTHER')),
  CONSTRAINT ck_legacy_reconciliations_gross_positive CHECK (gross_cents > 0),
  CONSTRAINT ck_legacy_reconciliations_deposit_range
    CHECK (deposited_cents >= 0 AND deposited_cents <= gross_cents),
  CONSTRAINT ck_legacy_reconciliations_bank_reference_len
    CHECK (bank_reference IS NULL OR char_length(bank_reference) <= 200),
  CONSTRAINT ck_legacy_reconciliations_notes_len
    CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT ck_legacy_reconciliations_actor_nonempty
    CHECK (btrim(reconciled_by) <> '' AND btrim(updated_by) <> '')
);

COMMENT ON TABLE public.legacy_reconciliations IS
  'Bank reconciliation of one LEGACY_PAID registration: what the gateway deposited and the fee it kept. Never references orders or payments.';

COMMENT ON COLUMN public.legacy_reconciliations.provider_fee_cents IS
  'Gateway fee = gross_cents - deposited_cents. Includes any tax the gateway withheld; not split.';

CREATE OR REPLACE FUNCTION public.legacy_reconciliations_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
  v_amount bigint;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.legacy_registration_id IS DISTINCT FROM OLD.legacy_registration_id THEN
    RAISE EXCEPTION 'legacy_reconciliation registration is immutable';
  END IF;

  SELECT r.commercial_status, r.amount_cents
    INTO v_status, v_amount
  FROM public.legacy_registrations r
  WHERE r.id = NEW.legacy_registration_id;

  IF v_status IS DISTINCT FROM 'LEGACY_PAID' THEN
    RAISE EXCEPTION 'legacy_reconciliation requires a LEGACY_PAID registration';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'courtesy or staff rows (amount 0) are not bank-reconcilable';
  END IF;

  NEW.gross_cents := v_amount;
  NEW.origen_datos := 'legacy';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legacy_reconciliations_guard
  ON public.legacy_reconciliations;

CREATE TRIGGER trg_legacy_reconciliations_guard
  BEFORE INSERT OR UPDATE ON public.legacy_reconciliations
  FOR EACH ROW
  EXECUTE PROCEDURE public.legacy_reconciliations_guard();

ALTER TABLE public.legacy_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_reconciliations FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.legacy_reconciliations FROM PUBLIC;
REVOKE ALL ON TABLE public.legacy_reconciliations FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_reconciliations_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.legacy_reconciliations_guard() FROM anon, authenticated;

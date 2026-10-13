-- Sandbox-only columns for an Openpay business rejection.
-- Apply this file alone on the sandbox that already has openpay_payment_attempts.
-- Do not run migrations up --all or --to. Do not apply it to production.
-- Do not replace webhook_apply_payment_tx. Do not change Mercado Pago.

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

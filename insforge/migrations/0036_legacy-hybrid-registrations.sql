-- =====================================================================
-- 0036_legacy-hybrid-registrations.sql
-- Historical commercial records from the emergency Hybrid registration
-- landing. Source system: LEGACY_HYBRID_REGISTRO.
--
-- These rows are not Ready2Hybrid orders, payments, tickets, participants,
-- or checkout capacity. LEGACY_PAID is historical evidence. It is not
-- current revenue and must not enter payment_finance_adjustments or the
-- Mercado Pago reconciliation.
--
-- Later Ops reporting can read:
--   current paid     = orders.state = 'PAID'
--   legacy paid      = legacy_registrations.commercial_status = 'LEGACY_PAID'
--   legacy pending   = commercial_status = 'LEGACY_PENDING'
-- and keep those figures separate from reconciled finance.
--
-- Apply this file alone. Do not apply 0032 or 0033 with it.
-- =====================================================================

CREATE TABLE public.legacy_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  source_reference text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  total_source_rows integer NOT NULL,
  inserted_count integer NOT NULL,
  matched_existing_count integer NOT NULL,
  skipped_duplicate_count integer NOT NULL,
  review_required_count integer NOT NULL,
  failed_count integer NOT NULL,
  CONSTRAINT ck_legacy_import_batches_source
    CHECK (source_system = 'LEGACY_HYBRID_REGISTRO')
);

COMMENT ON TABLE public.legacy_import_batches IS
  'One execution of the LEGACY_HYBRID_REGISTRO importer. Counts must add up to total_source_rows.';

CREATE TABLE public.legacy_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  event_code text NOT NULL,
  source_system text NOT NULL,
  original_record_id text NOT NULL,
  original_status text NOT NULL,
  commercial_status text,
  import_disposition text NOT NULL,
  review_reason text,
  original_created_at timestamptz,
  original_updated_at timestamptz,
  buyer_contact_id uuid,
  original_name text,
  original_email text,
  original_phone text,
  category_code_raw text,
  category_name_raw text,
  category_block_raw text,
  team_name_raw text,
  participants_raw text,
  normalized_product_code text,
  amount_cents bigint,
  currency text,
  original_payment_id text,
  notes_raw text,
  raw_source_snapshot jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  import_batch_id uuid NOT NULL,
  CONSTRAINT uq_legacy_registrations_source_record
    UNIQUE (source_system, original_record_id),
  CONSTRAINT ck_legacy_registrations_source
    CHECK (source_system = 'LEGACY_HYBRID_REGISTRO'),
  CONSTRAINT ck_legacy_registrations_commercial_status
    CHECK (commercial_status IS NULL OR commercial_status IN ('LEGACY_PAID', 'LEGACY_PENDING')),
  CONSTRAINT ck_legacy_registrations_disposition
    CHECK (import_disposition IN ('IMPORTED', 'REVIEW_REQUIRED')),
  CONSTRAINT ck_legacy_registrations_amount
    CHECK (amount_cents IS NULL OR amount_cents >= 0),
  CONSTRAINT fk_legacy_registrations_event
    FOREIGN KEY (event_id, event_code)
    REFERENCES public.events (id, code),
  CONSTRAINT fk_legacy_registrations_contact
    FOREIGN KEY (buyer_contact_id)
    REFERENCES public.buyer_contacts (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_legacy_registrations_batch
    FOREIGN KEY (import_batch_id)
    REFERENCES public.legacy_import_batches (id)
);

COMMENT ON TABLE public.legacy_registrations IS
  'One historical registration row from LEGACY_HYBRID_REGISTRO. Not an order, payment, ticket, or participant. Pending is not revenue. Marketing consent is not stored because the source has none.';

COMMENT ON COLUMN public.legacy_registrations.original_payment_id IS
  'Historical Mercado Pago payment id copied from the old landing. Not a row in payments.';

COMMENT ON COLUMN public.legacy_registrations.normalized_product_code IS
  'Current or historical HEX-2026 product code when the source category_code matches the catalog exactly, including categories no longer sold. Null when the mapping is not unambiguous.';

CREATE INDEX legacy_registrations_by_commercial_status
  ON public.legacy_registrations (event_code, commercial_status);

CREATE INDEX legacy_registrations_by_email
  ON public.legacy_registrations (original_email);

CREATE INDEX legacy_registrations_by_product
  ON public.legacy_registrations (normalized_product_code);

CREATE TABLE public.legacy_import_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL REFERENCES public.legacy_import_batches (id),
  original_record_id text,
  disposition text NOT NULL,
  reason text,
  CONSTRAINT ck_legacy_import_outcomes_disposition
    CHECK (disposition IN ('IMPORTED', 'DUPLICATE', 'REVIEW_REQUIRED', 'REJECTED_WITH_REASON'))
);

COMMENT ON TABLE public.legacy_import_outcomes IS
  'Per source row result for one import batch. A repeated CSV records DUPLICATE and does not insert another legacy registration.';

ALTER TABLE public.legacy_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_import_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_import_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_import_outcomes FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.legacy_import_batches FROM PUBLIC;
REVOKE ALL ON TABLE public.legacy_import_batches FROM anon, authenticated;
REVOKE ALL ON TABLE public.legacy_registrations FROM PUBLIC;
REVOKE ALL ON TABLE public.legacy_registrations FROM anon, authenticated;
REVOKE ALL ON TABLE public.legacy_import_outcomes FROM PUBLIC;
REVOKE ALL ON TABLE public.legacy_import_outcomes FROM anon, authenticated;

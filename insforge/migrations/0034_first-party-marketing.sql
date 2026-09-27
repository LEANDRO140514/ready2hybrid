-- =====================================================================
-- 0034_first-party-marketing.sql
-- ENFORMA first-party funnel store. Meta, GA4 and GHL are consumers.
-- Does not change checkout_start_tx, orders, payments, pricing, or affiliates.
-- Does not open sales.
--
-- Authorized for production in the first-party activation phase.
-- Apply this file alone. Do not apply 0032 or 0033 with it.
--
-- event_id is the Ready2Hybrid sporting event (events.id).
-- event_code is the human code, such as HEX-2026.
-- marketing_event_id is the funnel-row idempotency key.
--
-- buyer_contacts stays the identified person. Marketing tables store no
-- email, phone, or name. orders.affiliate_code stays the Community Partner
-- source of truth.
--
-- Consent is one fact. A timestamp requires source and version. A null
-- timestamp requires both of those columns null. The existing checkout insert
-- writes only contact_consent_at. A BEFORE INSERT/UPDATE trigger completes
-- HYBRID_LANDING_2026 / marketing-v1 when that timestamp is set, and clears
-- the pair when it is null. Purchase does not set the timestamp, so it does
-- not create marketing consent.
--
-- Future anonymous capture is an edge function. There is no anon INSERT.
-- That function must allowlist event_type, match (event_id, event_code) to
-- events, validate UUIDs, cap the body at 4 KiB, allowlist metadata keys,
-- reject email/name/phone, and dedupe on marketing_event_id. It must not
-- accept arbitrary event names.
--
-- Future checkout may receive marketing_context
-- { visitor_id, session_id, first_touch, last_touch } with no email, phone,
-- or name. Buyer identity stays on the existing buyer-contact payload.
-- The snapshot insert runs after the order commits. A failure there must
-- not roll back registration or payment.
-- =====================================================================

CREATE TABLE public.marketing_visitors (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marketing_visitors IS
  'Opaque first-party visitor. id is a random UUID, not derived from contact data, not an auth credential.';

CREATE TABLE public.marketing_sessions (
  id uuid PRIMARY KEY,
  visitor_id uuid NOT NULL REFERENCES public.marketing_visitors (id),
  started_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_event_id uuid NOT NULL UNIQUE,
  event_id uuid NOT NULL,
  event_code text NOT NULL,
  visitor_id uuid NOT NULL REFERENCES public.marketing_visitors (id),
  session_id uuid NOT NULL REFERENCES public.marketing_sessions (id),
  event_type text NOT NULL CHECK (event_type IN (
    'LANDING_VIEW',
    'EXPERIENCE_SELECTED',
    'CATEGORY_SELECTED',
    'CHECKOUT_STARTED',
    'LEAD_IDENTIFIED',
    'PAYMENT_PENDING',
    'PURCHASE'
  )),
  occurred_at timestamptz NOT NULL,
  category_code text,
  value_cents bigint,
  currency text,
  first_touch jsonb NOT NULL,
  last_touch jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_marketing_events_event_id_code
    FOREIGN KEY (event_id, event_code)
    REFERENCES public.events (id, code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT marketing_events_metadata_size_ck
    CHECK (pg_column_size(metadata) <= 512)
);

COMMENT ON TABLE public.marketing_events IS
  'Funnel steps scoped to a sporting event. marketing_event_id dedupes retries. No PII.';

COMMENT ON COLUMN public.marketing_events.event_id IS
  'Ready2Hybrid sporting event. Foreign key to events.id. Not a funnel idempotency key.';

COMMENT ON COLUMN public.marketing_events.marketing_event_id IS
  'Opaque UUID for this funnel row. Repeated delivery of the same value is a no-op.';

CREATE INDEX marketing_events_by_sporting_event
  ON public.marketing_events (event_id, occurred_at);

CREATE TABLE public.marketing_identity_links (
  visitor_id uuid PRIMARY KEY REFERENCES public.marketing_visitors (id),
  buyer_contact_id uuid NOT NULL REFERENCES public.buyer_contacts (id),
  linked_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marketing_identity_links IS
  'Joins anonymous history to buyer_contacts. Does not copy PII into marketing_events.';

CREATE TABLE public.order_attribution_snapshots (
  order_id uuid PRIMARY KEY REFERENCES public.orders (id),
  event_id uuid NOT NULL,
  event_code text NOT NULL,
  visitor_id uuid REFERENCES public.marketing_visitors (id),
  first_touch jsonb NOT NULL,
  last_touch jsonb NOT NULL,
  affiliate_code text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_order_attribution_event_id_code
    FOREIGN KEY (event_id, event_code)
    REFERENCES public.events (id, code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

COMMENT ON TABLE public.order_attribution_snapshots IS
  'Immutable ad attribution captured once, after the order commits. affiliate_code is a copy; orders.affiliate_code remains authoritative for Community Partners.';

ALTER TABLE public.buyer_contacts
  ADD COLUMN contact_consent_source text,
  ADD COLUMN contact_consent_version text;

COMMENT ON COLUMN public.buyer_contacts.contact_consent_source IS
  'Where the marketing opt-in was collected, for example HYBRID_LANDING_2026. NULL when contact_consent_at is the only evidence, or when the box was unchecked.';

COMMENT ON COLUMN public.buyer_contacts.contact_consent_version IS
  'Copy version of that opt-in, for example marketing-v1. NULL unless paired with contact_consent_source and contact_consent_at.';

-- Rows that already stored a checkbox timestamp get the landing evidence
-- that produced it. Rows with a null timestamp stay null.
UPDATE public.buyer_contacts
SET contact_consent_source = 'HYBRID_LANDING_2026',
    contact_consent_version = 'marketing-v1'
WHERE contact_consent_at IS NOT NULL
  AND contact_consent_source IS NULL
  AND contact_consent_version IS NULL;

ALTER TABLE public.buyer_contacts
  ADD CONSTRAINT buyer_contacts_consent_evidence_ck
  CHECK (
    (
      contact_consent_at IS NULL
      AND contact_consent_source IS NULL
      AND contact_consent_version IS NULL
    )
    OR (
      contact_consent_at IS NOT NULL
      AND contact_consent_source IS NOT NULL
      AND contact_consent_version IS NOT NULL
      AND char_length(contact_consent_source) BETWEEN 1 AND 64
      AND char_length(contact_consent_version) BETWEEN 1 AND 32
    )
  );

CREATE OR REPLACE FUNCTION public.buyer_contacts_fill_consent_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contact_consent_at IS NULL THEN
    NEW.contact_consent_source := NULL;
    NEW.contact_consent_version := NULL;
  ELSIF NEW.contact_consent_source IS NULL OR NEW.contact_consent_version IS NULL THEN
    NEW.contact_consent_source := 'HYBRID_LANDING_2026';
    NEW.contact_consent_version := 'marketing-v1';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER buyer_contacts_consent_evidence
  BEFORE INSERT OR UPDATE OF contact_consent_at, contact_consent_source, contact_consent_version
  ON public.buyer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.buyer_contacts_fill_consent_evidence();

ALTER TABLE public.marketing_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_attribution_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_visitors FROM PUBLIC;
REVOKE ALL ON TABLE public.marketing_visitors FROM anon, authenticated;
REVOKE ALL ON TABLE public.marketing_sessions FROM PUBLIC;
REVOKE ALL ON TABLE public.marketing_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.marketing_events FROM PUBLIC;
REVOKE ALL ON TABLE public.marketing_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.marketing_identity_links FROM PUBLIC;
REVOKE ALL ON TABLE public.marketing_identity_links FROM anon, authenticated;
REVOKE ALL ON TABLE public.order_attribution_snapshots FROM PUBLIC;
REVOKE ALL ON TABLE public.order_attribution_snapshots FROM anon, authenticated;

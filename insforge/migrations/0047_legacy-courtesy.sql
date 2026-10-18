-- Courtesy seats stay inscriptions. They are not buyers and not revenue.
-- legacy_sync_apply does not write this column, so a later sync keeps the mark.
-- Apply alone. Does not touch orders, payments, tickets, or checkout.

ALTER TABLE public.legacy_registrations
  ADD COLUMN IF NOT EXISTS courtesy boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.legacy_registrations.courtesy IS
  'Staff, judge, or courtesy inscription. Counts as access, not as a sale. Sync does not clear it.';

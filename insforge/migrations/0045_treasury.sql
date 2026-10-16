-- =====================================================================
-- 0045_treasury.sql
-- Approved for review in the repo. Not applied to 4bg9ufz2.
-- Predecessor applied on 4bg9ufz2: 0044_legacy-reconciliations.sql.
-- 0032 stays an Openpay candidate and is not part of this file.
--
-- Treasury does not read or write orders, payments, tickets,
-- payment_finance_adjustments, legacy_registrations, or
-- legacy_reconciliations. There is no Mercado Pago release date.
-- Income is entered by a person. posted = money already in the account.
-- scheduled = expected. cancelled = void. A row is never deleted.
-- A posted row is not corrected in place: cancel it and capture a new one.
--
-- Balance is NOT stored. The application recomputes it on read,
-- in America/Merida:
--   account cash = opening_balance_cents
--                + posted income
--                - posted expense
--                - posted transfers out
--                + posted transfers in
--   Transfers are not income and not expense.
--   Weekly flow, one series for the whole treasury, from today through
--   30 Nov: cash + scheduled income - scheduled expense, cumulative
--   by week. A week below 0 is a deficit.
--   Scheduled transfers are excluded from that series.
--   Overdue = status scheduled AND occurred_on < today.
--   Cancelled rows affect neither cash nor the projection.
--
-- Revisions are written inline by the AFTER UPDATE trigger. There is no
-- helper function. updated_at is stamped by the BEFORE UPDATE trigger and
-- is not itself a revision row. type is immutable and is not revised.
-- The edge admin client (project_admin, BYPASSRLS) writes the tables.
-- anon and authenticated have no grant and no policy.
-- created_by and updated_by are the verified JWT user, never a request body.
--
-- Rollback:
--   DROP TABLE public.treasury_movement_revisions;
--   DROP TABLE public.treasury_movements;
--   DROP TABLE public.treasury_categories;
--   DROP TABLE public.treasury_accounts;
--   DROP FUNCTION public.treasury_movements_guard();
--   DROP FUNCTION public.treasury_movements_touch();
--   DROP FUNCTION public.treasury_movements_revise();
--   DROP FUNCTION public.treasury_movements_no_delete();
--   DROP FUNCTION public.treasury_movement_revisions_append_only();
--   DROP FUNCTION public.treasury_accounts_guard();
--   DROP FUNCTION public.treasury_categories_guard();
--   DROP FUNCTION public.treasury_catalog_no_delete();
--
-- TRANSACTION CONTROL:
--   No executable BEGIN/COMMIT/ROLLBACK. The InsForge migration runner
--   wraps each migration in its own transaction.
-- =====================================================================

CREATE TABLE public.treasury_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  opening_balance_cents bigint NOT NULL,
  opening_date date NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_treasury_accounts_name
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT ck_treasury_accounts_actor
    CHECK (btrim(created_by) <> '' AND btrim(updated_by) <> '')
);

COMMENT ON TABLE public.treasury_accounts IS
  'Cash account or box. opening_balance_cents is the signed starting position on opening_date. It may be negative or zero. It is not a movement and it is not sales revenue. Once any movement names the account, the opening figures are frozen.';

COMMENT ON COLUMN public.treasury_accounts.opening_balance_cents IS
  'Signed cents already in the account at opening_date. Later posted movements are added on read. No stored running balance.';

CREATE UNIQUE INDEX uq_treasury_accounts_name
  ON public.treasury_accounts (lower(btrim(name)));

CREATE TABLE public.treasury_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_treasury_categories_name
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT ck_treasury_categories_kind
    CHECK (kind IN ('income', 'expense')),
  CONSTRAINT ck_treasury_categories_actor
    CHECK (btrim(created_by) <> '' AND btrim(updated_by) <> '')
);

COMMENT ON TABLE public.treasury_categories IS
  'Income or expense label. kind is immutable. A transfer has no category. Deactivate with active=false; do not delete.';

CREATE UNIQUE INDEX uq_treasury_categories_kind_name
  ON public.treasury_categories (kind, lower(btrim(name)));

CREATE TABLE public.treasury_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  status text NOT NULL,
  account_id uuid NOT NULL,
  destination_account_id uuid,
  category_id uuid,
  payment_method text,
  amount_cents bigint NOT NULL,
  occurred_on date NOT NULL,
  concept text NOT NULL,
  counterparty text,
  notes text,
  cancel_reason text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_treasury_movements_account
    FOREIGN KEY (account_id) REFERENCES public.treasury_accounts (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_treasury_movements_destination
    FOREIGN KEY (destination_account_id) REFERENCES public.treasury_accounts (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_treasury_movements_category
    FOREIGN KEY (category_id) REFERENCES public.treasury_categories (id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_treasury_movements_type
    CHECK (type IN ('income', 'expense', 'transfer')),
  CONSTRAINT ck_treasury_movements_status
    CHECK (status IN ('scheduled', 'posted', 'cancelled')),
  CONSTRAINT ck_treasury_movements_method
    CHECK (payment_method IN ('transferencia', 'efectivo', 'tarjeta', 'cheque', 'otro')),
  CONSTRAINT ck_treasury_movements_amount
    CHECK (amount_cents > 0),
  CONSTRAINT ck_treasury_movements_transfer
    CHECK (
      (
        type = 'transfer'
        AND destination_account_id IS NOT NULL
        AND destination_account_id <> account_id
      )
      OR (
        type <> 'transfer'
        AND destination_account_id IS NULL
      )
    ),
  CONSTRAINT ck_treasury_movements_category
    CHECK (
      (type = 'transfer' AND category_id IS NULL)
      OR (type IN ('income', 'expense') AND category_id IS NOT NULL)
    ),
  CONSTRAINT ck_treasury_movements_cancel
    CHECK (
      (
        status = 'cancelled'
        AND cancel_reason IS NOT NULL
        AND btrim(cancel_reason) <> ''
      )
      OR (
        status <> 'cancelled'
        AND cancel_reason IS NULL
      )
    ),
  CONSTRAINT ck_treasury_movements_concept
    CHECK (char_length(btrim(concept)) BETWEEN 1 AND 500),
  CONSTRAINT ck_treasury_movements_counterparty
    CHECK (counterparty IS NULL OR char_length(btrim(counterparty)) BETWEEN 1 AND 200),
  CONSTRAINT ck_treasury_movements_notes
    CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT ck_treasury_movements_cancel_len
    CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 2000),
  CONSTRAINT ck_treasury_movements_actor
    CHECK (btrim(created_by) <> '' AND btrim(updated_by) <> '')
);

COMMENT ON TABLE public.treasury_movements IS
  'Manual treasury lines. No foreign key to orders or payments. type is immutable. cancelled is terminal. A posted row may only change to cancelled. payment_method may be null while scheduled or cancelled; the guard requires it when status is posted. A CHECK treats NULL as passing, so the guard is the posted rule.';

COMMENT ON COLUMN public.treasury_movements.counterparty IS
  'Free-text payer or payee. This cut has no supplier catalog.';

COMMENT ON COLUMN public.treasury_movements.notes IS
  'Free comment. The movement CSV puts this in COMENTARIO and appends cancel_reason when the row is cancelled.';

COMMENT ON COLUMN public.treasury_movements.created_by IS
  'Verified JWT user supplied by the edge function. Never taken from the request body.';

COMMENT ON COLUMN public.treasury_movements.status IS
  'posted counts in cash. scheduled counts only in the projection. cancelled counts in neither. Delete is refused.';

CREATE INDEX ix_treasury_movements_account_date
  ON public.treasury_movements (account_id, occurred_on);

CREATE INDEX ix_treasury_movements_destination_date
  ON public.treasury_movements (destination_account_id, occurred_on);

CREATE TABLE public.treasury_movement_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  field text NOT NULL,
  before_value text,
  after_value text,
  CONSTRAINT fk_treasury_movement_revisions_movement
    FOREIGN KEY (movement_id) REFERENCES public.treasury_movements (id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_treasury_movement_revisions_actor
    CHECK (btrim(actor) <> ''),
  CONSTRAINT ck_treasury_movement_revisions_field
    CHECK (char_length(btrim(field)) BETWEEN 1 AND 80)
);

COMMENT ON TABLE public.treasury_movement_revisions IS
  'Append-only. One row per changed field, written inline by treasury_movements_revise. actor is the movement updated_by. type and updated_at are not recorded here.';

CREATE OR REPLACE FUNCTION public.treasury_accounts_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'treasury account identity is immutable';
  END IF;

  IF NEW.opening_balance_cents IS DISTINCT FROM OLD.opening_balance_cents
     OR NEW.opening_date IS DISTINCT FROM OLD.opening_date THEN
    IF EXISTS (
      SELECT 1
      FROM public.treasury_movements
      WHERE account_id = OLD.id
         OR destination_account_id = OLD.id
    ) THEN
      RAISE EXCEPTION 'opening balance is frozen once the account has movements';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.treasury_categories_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'treasury category identity is immutable';
  END IF;
  IF NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'treasury category kind is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.treasury_movements_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_active boolean;
  v_source_opening date;
  v_dest_active boolean;
  v_dest_opening date;
  v_kind text;
  v_category_active boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'cancelled' THEN
      RAISE EXCEPTION 'cancelled treasury movement is terminal';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'treasury movement identity is immutable';
    END IF;
    IF NEW.type IS DISTINCT FROM OLD.type THEN
      RAISE EXCEPTION 'treasury movement type is immutable';
    END IF;
    IF OLD.status = 'posted' THEN
      IF NEW.status IS DISTINCT FROM 'cancelled' THEN
        RAISE EXCEPTION 'posted treasury movement can only be cancelled';
      END IF;
      IF NEW.account_id IS DISTINCT FROM OLD.account_id
         OR NEW.destination_account_id IS DISTINCT FROM OLD.destination_account_id
         OR NEW.category_id IS DISTINCT FROM OLD.category_id
         OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
         OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
         OR NEW.occurred_on IS DISTINCT FROM OLD.occurred_on
         OR NEW.concept IS DISTINCT FROM OLD.concept
         OR NEW.counterparty IS DISTINCT FROM OLD.counterparty
         OR NEW.notes IS DISTINCT FROM OLD.notes THEN
        RAISE EXCEPTION 'posted treasury movement cannot be corrected in place';
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'posted' AND NEW.payment_method IS NULL THEN
    RAISE EXCEPTION 'posted treasury movement requires a payment method';
  END IF;

  SELECT active, opening_date
    INTO v_source_active, v_source_opening
  FROM public.treasury_accounts
  WHERE id = NEW.account_id;

  IF v_source_opening IS NULL THEN
    RAISE EXCEPTION 'treasury movement account does not exist';
  END IF;
  IF NEW.occurred_on < v_source_opening THEN
    RAISE EXCEPTION 'movement date is before the account opening date';
  END IF;

  IF NEW.type = 'transfer' THEN
    SELECT active, opening_date
      INTO v_dest_active, v_dest_opening
    FROM public.treasury_accounts
    WHERE id = NEW.destination_account_id;
    IF v_dest_opening IS NULL THEN
      RAISE EXCEPTION 'treasury transfer destination does not exist';
    END IF;
    IF NEW.occurred_on < v_dest_opening THEN
      RAISE EXCEPTION 'transfer date is before the destination opening date';
    END IF;
  END IF;

  IF NEW.type IN ('income', 'expense') THEN
    SELECT kind, active
      INTO v_kind, v_category_active
    FROM public.treasury_categories
    WHERE id = NEW.category_id;
    IF v_kind IS NULL THEN
      RAISE EXCEPTION 'treasury category is missing';
    END IF;
    IF v_kind IS DISTINCT FROM NEW.type THEN
      RAISE EXCEPTION 'treasury category kind must match movement type';
    END IF;
    IF v_category_active IS NOT TRUE AND NEW.status IS DISTINCT FROM 'cancelled' THEN
      RAISE EXCEPTION 'treasury category is inactive';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM 'cancelled' THEN
    IF v_source_active IS NOT TRUE THEN
      RAISE EXCEPTION 'treasury account is inactive';
    END IF;
    IF NEW.type = 'transfer' AND v_dest_active IS NOT TRUE THEN
      RAISE EXCEPTION 'treasury destination account is inactive';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.treasury_movements_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.treasury_movements_revise()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'status', OLD.status, NEW.status);
  END IF;
  IF OLD.account_id IS DISTINCT FROM NEW.account_id THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'account_id', OLD.account_id::text, NEW.account_id::text);
  END IF;
  IF OLD.destination_account_id IS DISTINCT FROM NEW.destination_account_id THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'destination_account_id', OLD.destination_account_id::text, NEW.destination_account_id::text);
  END IF;
  IF OLD.category_id IS DISTINCT FROM NEW.category_id THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'category_id', OLD.category_id::text, NEW.category_id::text);
  END IF;
  IF OLD.payment_method IS DISTINCT FROM NEW.payment_method THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'payment_method', OLD.payment_method, NEW.payment_method);
  END IF;
  IF OLD.amount_cents IS DISTINCT FROM NEW.amount_cents THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'amount_cents', OLD.amount_cents::text, NEW.amount_cents::text);
  END IF;
  IF OLD.occurred_on IS DISTINCT FROM NEW.occurred_on THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'occurred_on', OLD.occurred_on::text, NEW.occurred_on::text);
  END IF;
  IF OLD.concept IS DISTINCT FROM NEW.concept THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'concept', OLD.concept, NEW.concept);
  END IF;
  IF OLD.counterparty IS DISTINCT FROM NEW.counterparty THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'counterparty', OLD.counterparty, NEW.counterparty);
  END IF;
  IF OLD.notes IS DISTINCT FROM NEW.notes THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'notes', OLD.notes, NEW.notes);
  END IF;
  IF OLD.cancel_reason IS DISTINCT FROM NEW.cancel_reason THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'cancel_reason', OLD.cancel_reason, NEW.cancel_reason);
  END IF;
  IF OLD.updated_by IS DISTINCT FROM NEW.updated_by THEN
    INSERT INTO public.treasury_movement_revisions (movement_id, actor, field, before_value, after_value)
    VALUES (NEW.id, NEW.updated_by, 'updated_by', OLD.updated_by, NEW.updated_by);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.treasury_movements_no_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'treasury movement is cancelled, not deleted';
END;
$$;

CREATE OR REPLACE FUNCTION public.treasury_movement_revisions_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'treasury movement revisions are append-only';
END;
$$;

CREATE OR REPLACE FUNCTION public.treasury_catalog_no_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'treasury catalog rows are deactivated, not deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_treasury_accounts_guard ON public.treasury_accounts;
CREATE TRIGGER trg_treasury_accounts_guard
  BEFORE UPDATE ON public.treasury_accounts
  FOR EACH ROW
  EXECUTE PROCEDURE public.treasury_accounts_guard();

DROP TRIGGER IF EXISTS trg_treasury_accounts_no_delete ON public.treasury_accounts;
CREATE TRIGGER trg_treasury_accounts_no_delete
  BEFORE DELETE ON public.treasury_accounts
  FOR EACH ROW
  EXECUTE PROCEDURE public.treasury_catalog_no_delete();

DROP TRIGGER IF EXISTS trg_treasury_categories_guard ON public.treasury_categories;
CREATE TRIGGER trg_treasury_categories_guard
  BEFORE UPDATE ON public.treasury_categories
  FOR EACH ROW
  EXECUTE PROCEDURE public.treasury_categories_guard();

DROP TRIGGER IF EXISTS trg_treasury_categories_no_delete ON public.treasury_categories;
CREATE TRIGGER trg_treasury_categories_no_delete
  BEFORE DELETE ON public.treasury_categories
  FOR EACH ROW
  EXECUTE PROCEDURE public.treasury_catalog_no_delete();

DROP TRIGGER IF EXISTS trg_treasury_movements_guard ON public.treasury_movements;
CREATE TRIGGER trg_treasury_movements_guard
  BEFORE INSERT OR UPDATE ON public.treasury_movements
  FOR EACH ROW
  EXECUTE PROCEDURE public.treasury_movements_guard();

DROP TRIGGER IF EXISTS trg_treasury_movements_touch ON public.treasury_movements;
CREATE TRIGGER trg_treasury_movements_touch
  BEFORE UPDATE ON public.treasury_movements
  FOR EACH ROW
  EXECUTE PROCEDURE public.treasury_movements_touch();

DROP TRIGGER IF EXISTS trg_treasury_movements_revise ON public.treasury_movements;
CREATE TRIGGER trg_treasury_movements_revise
  AFTER UPDATE ON public.treasury_movements
  FOR EACH ROW
  EXECUTE PROCEDURE public.treasury_movements_revise();

DROP TRIGGER IF EXISTS trg_treasury_movements_no_delete ON public.treasury_movements;
CREATE TRIGGER trg_treasury_movements_no_delete
  BEFORE DELETE ON public.treasury_movements
  FOR EACH ROW
  EXECUTE PROCEDURE public.treasury_movements_no_delete();

DROP TRIGGER IF EXISTS trg_treasury_movement_revisions_append_only
  ON public.treasury_movement_revisions;
CREATE TRIGGER trg_treasury_movement_revisions_append_only
  BEFORE UPDATE OR DELETE ON public.treasury_movement_revisions
  FOR EACH ROW
  EXECUTE PROCEDURE public.treasury_movement_revisions_append_only();

ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_movements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_movement_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_movement_revisions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.treasury_accounts FROM PUBLIC;
REVOKE ALL ON TABLE public.treasury_accounts FROM anon, authenticated;
REVOKE ALL ON TABLE public.treasury_categories FROM PUBLIC;
REVOKE ALL ON TABLE public.treasury_categories FROM anon, authenticated;
REVOKE ALL ON TABLE public.treasury_movements FROM PUBLIC;
REVOKE ALL ON TABLE public.treasury_movements FROM anon, authenticated;
REVOKE ALL ON TABLE public.treasury_movement_revisions FROM PUBLIC;
REVOKE ALL ON TABLE public.treasury_movement_revisions FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.treasury_accounts_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.treasury_accounts_guard() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.treasury_categories_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.treasury_categories_guard() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.treasury_movements_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.treasury_movements_guard() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.treasury_movements_touch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.treasury_movements_touch() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.treasury_movements_revise() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.treasury_movements_revise() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.treasury_movements_no_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.treasury_movements_no_delete() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.treasury_movement_revisions_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.treasury_movement_revisions_append_only() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.treasury_catalog_no_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.treasury_catalog_no_delete() FROM anon, authenticated;

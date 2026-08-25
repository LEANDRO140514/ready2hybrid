-- =====================================================================
-- 0020_v04-commercial-authority-successor.sql
-- Ready2Hybrid — SPEC-030/031/032 v0.4.0 commercial authority successor.
--
-- Authority:
--  · SPEC-030 / SPEC-031 / SPEC-032 v0.4.0 APPROVED / EFFECTIVE
--  · SPEC-040 v0.1.1 APPROVED (hold/expiry preserve; not rewritten here)
--  · Project Owner: GO-LIVE-IMPLEMENT-3 — author + local validation only
--
-- This migration does NOT:
--  · apply itself to Main or any remote sandbox
--  · open sales / set events.status = EN_VENTA
--  · DELETE historical product identities
--  · modify webhook_apply_payment_tx or Mercado Pago verification
--  · change 0001–0016 source files
--  · consume or move 0017
--
-- Runner: no BEGIN/COMMIT (InsForge wraps each migration).
-- 0016 left project_admin without INSERT on products and without any
-- DML on event_days. This file GRANTs those privileges only for the
-- catalog upsert, then restores the 0016 compensating surface.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. Schema: session ALL_DAY, event sale_state, category sale states
-- ---------------------------------------------------------------------

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS ck_products_session;
ALTER TABLE public.products
  ADD CONSTRAINT ck_products_session
  CHECK (session IS NULL OR session IN ('AM', 'PM', 'ALL_DAY'));

COMMENT ON COLUMN public.products.session IS
  'Persistence vocabulary: AM | PM | ALL_DAY | NULL. Domain FULL_DAY maps to ALL_DAY. Daily PUB/FOT and 3D passes use NULL.';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS sale_state text;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS ck_events_sale_state;
ALTER TABLE public.events
  ADD CONSTRAINT ck_events_sale_state
  CHECK (sale_state IS NULL OR sale_state IN ('AVAILABLE', 'SOLD_OUT'));

COMMENT ON COLUMN public.events.sale_state IS
  'Organizer-controlled event availability. SOLD_OUT blocks all SKUs. Independent of CONFIGURADO / EN_VENTA. NULL is not SOLD_OUT.';

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS ck_products_sale_state;
ALTER TABLE public.products
  ADD CONSTRAINT ck_products_sale_state
  CHECK (
    sale_state IS NULL
    OR sale_state IN (
      'AVAILABLE',
      'SOLD_OUT',
      'SALES_CLOSED',
      'CANCELLED',
      'INACTIVE',
      'HIDDEN',
      'RETIRED_PRODUCT',
      'SUPERSEDED_SCHEDULE_VARIANT'
    )
  );

COMMENT ON COLUMN public.products.price_cents IS
  'Legacy NOT NULL compatibility column. Authoritative checkout price is server-side calendar-stage resolution (Launch/Presale/Regular or fixed). This value is the launch/fixed baseline only — not a second pricing authority.';

COMMENT ON COLUMN public.products.cupo IS
  'Operational/integrity leftover. MUST NOT be commercial SOLD_OUT authority.';

CREATE TABLE IF NOT EXISTS public.event_category_sale_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  block text NOT NULL,
  sale_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_category_sale_states_event_block UNIQUE (event_code, block),
  CONSTRAINT fk_event_category_sale_states_event
    FOREIGN KEY (event_code) REFERENCES public.events(code),
  CONSTRAINT ck_event_category_sale_states_block
    CHECK (block IN ('COMPITE', 'EXPERIENCE', 'ASISTE')),
  CONSTRAINT ck_event_category_sale_states_sale_state
    CHECK (sale_state IS NULL OR sale_state IN ('AVAILABLE', 'SOLD_OUT'))
);

COMMENT ON TABLE public.event_category_sale_states IS
  'Organizer-controlled category/offer SOLD_OUT for products.block. Parent event SOLD_OUT still wins.';

ALTER TABLE public.event_category_sale_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_category_sale_states FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_category_sale_states FROM PUBLIC;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.event_category_sale_states FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- B. Temporary DCL so project_admin can upsert catalog after 0016
-- ---------------------------------------------------------------------

GRANT INSERT ON TABLE public.events TO project_admin;
GRANT INSERT ON TABLE public.products TO project_admin;
GRANT SELECT, INSERT, UPDATE ON TABLE public.event_days TO project_admin;
GRANT SELECT, INSERT, UPDATE ON TABLE public.event_category_sale_states TO project_admin;

-- ---------------------------------------------------------------------
-- C. Event + days: November 2026 current program; sales remain CLOSED
-- ---------------------------------------------------------------------

UPDATE public.events
SET
  name = 'HYBRID EXPERIENCE',
  venue_city = 'Club Cumbres, Mérida, Yucatán',
  timezone = 'America/Merida',
  starts_on = DATE '2026-11-13',
  ends_on = DATE '2026-11-15',
  status = 'CONFIGURADO',
  sales_open_at = NULL,
  sales_close_at = NULL,
  sale_state = 'AVAILABLE',
  updated_at = now()
WHERE code = 'HEX-2026';

INSERT INTO public.events (
  code, name, venue_city, timezone, starts_on, ends_on, status, sale_state
)
SELECT
  'HEX-2026',
  'HYBRID EXPERIENCE',
  'Club Cumbres, Mérida, Yucatán',
  'America/Merida',
  DATE '2026-11-13',
  DATE '2026-11-15',
  'CONFIGURADO',
  'AVAILABLE'
WHERE NOT EXISTS (SELECT 1 FROM public.events WHERE code = 'HEX-2026');

-- Current program days. October leftover rows are marked not-current; not deleted.
INSERT INTO public.event_days (event_code, day_date, label, public_order, session, state)
SELECT 'HEX-2026', DATE '2026-11-13', 'Viernes 13 — Dobles e Individual (PM)', 1, 'PM', 'CURRENT'
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_days
  WHERE event_code = 'HEX-2026' AND day_date = DATE '2026-11-13' AND session IS NOT DISTINCT FROM 'PM'
);

INSERT INTO public.event_days (event_code, day_date, label, public_order, session, state)
SELECT 'HEX-2026', DATE '2026-11-14', 'Sábado 14 — FULL_DAY / Día completo', 2, 'ALL_DAY', 'CURRENT'
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_days
  WHERE event_code = 'HEX-2026' AND day_date = DATE '2026-11-14' AND session IS NOT DISTINCT FROM 'ALL_DAY'
);

INSERT INTO public.event_days (event_code, day_date, label, public_order, session, state)
SELECT 'HEX-2026', DATE '2026-11-15', 'Domingo 15 — Relay (AM)', 3, 'AM', 'CURRENT'
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_days
  WHERE event_code = 'HEX-2026' AND day_date = DATE '2026-11-15' AND session IS NOT DISTINCT FROM 'AM'
);

UPDATE public.event_days
SET
  label = 'Viernes 13 — Dobles e Individual (PM)',
  public_order = 1,
  session = 'PM',
  state = 'CURRENT',
  updated_at = now()
WHERE event_code = 'HEX-2026'
  AND day_date = DATE '2026-11-13'
  AND session IS NOT DISTINCT FROM 'PM';

UPDATE public.event_days
SET
  label = 'Sábado 14 — FULL_DAY / Día completo',
  public_order = 2,
  session = 'ALL_DAY',
  state = 'CURRENT',
  updated_at = now()
WHERE event_code = 'HEX-2026'
  AND day_date = DATE '2026-11-14'
  AND session IS NOT DISTINCT FROM 'ALL_DAY';

UPDATE public.event_days
SET
  label = 'Domingo 15 — Relay (AM)',
  public_order = 3,
  session = 'AM',
  state = 'CURRENT',
  updated_at = now()
WHERE event_code = 'HEX-2026'
  AND day_date = DATE '2026-11-15'
  AND session IS NOT DISTINCT FROM 'AM';

UPDATE public.event_days
SET
  state = 'NOT_CURRENT',
  updated_at = now()
WHERE event_code = 'HEX-2026'
  AND NOT (
    (day_date = DATE '2026-11-13' AND session IS NOT DISTINCT FROM 'PM')
    OR (day_date = DATE '2026-11-14' AND session IS NOT DISTINCT FROM 'ALL_DAY')
    OR (day_date = DATE '2026-11-15' AND session IS NOT DISTINCT FROM 'AM')
  );

-- ---------------------------------------------------------------------
-- D. Category/offer sale states default AVAILABLE (not SOLD_OUT)
-- ---------------------------------------------------------------------

INSERT INTO public.event_category_sale_states (event_code, block, sale_state)
VALUES
  ('HEX-2026', 'COMPITE', 'AVAILABLE'),
  ('HEX-2026', 'EXPERIENCE', 'AVAILABLE'),
  ('HEX-2026', 'ASISTE', 'AVAILABLE')
ON CONFLICT (event_code, block) DO UPDATE
SET
  sale_state = EXCLUDED.sale_state,
  updated_at = now();

-- ---------------------------------------------------------------------
-- E. 23 sellable identities + 5 preserved historical identities
--    price_cents = launch/fixed baseline only
--    cupo preserved on conflict; INSERT uses operational leftover values
-- ---------------------------------------------------------------------

INSERT INTO public.products (
  event_code, code, name, block, kind, journey, team_size, price_cents, cupo,
  day, session, has_chip, has_insurance, sale_state, visibility
) VALUES
  -- COMPITE Friday PM
  ('HEX-2026','DOB-VIE-MM','Dobles Mujeres · Viernes','COMPITE','competitor','J2',2,250000,40,DATE '2026-11-13','PM',true,true,'AVAILABLE',NULL),
  ('HEX-2026','IND-M','Individual Mujer','COMPITE','competitor','J1',1,150000,60,DATE '2026-11-13','PM',true,true,'AVAILABLE',NULL),
  ('HEX-2026','IND-H','Individual Hombre','COMPITE','competitor','J1',1,150000,60,DATE '2026-11-13','PM',true,true,'AVAILABLE',NULL),
  -- COMPITE Saturday ALL_DAY
  ('HEX-2026','DOB-SAB-HH','Dobles Hombres · Sábado','COMPITE','competitor','J2',2,250000,40,DATE '2026-11-14','ALL_DAY',true,true,'AVAILABLE',NULL),
  ('HEX-2026','DOB-SAB-MH','Dobles Mixto · Sábado','COMPITE','competitor','J2',2,250000,40,DATE '2026-11-14','ALL_DAY',true,true,'AVAILABLE',NULL),
  -- COMPITE Sunday AM
  ('HEX-2026','REL-4H','Relay 4 Hombres','COMPITE','competitor','J3',4,320000,20,DATE '2026-11-15','AM',true,true,'AVAILABLE',NULL),
  ('HEX-2026','REL-4M','Relay 4 Mujeres','COMPITE','competitor','J3',4,320000,20,DATE '2026-11-15','AM',true,true,'AVAILABLE',NULL),
  ('HEX-2026','REL-2H2M','Relay Mixto 2H+2M','COMPITE','competitor','J3',4,320000,20,DATE '2026-11-15','AM',true,true,'AVAILABLE',NULL),
  -- EXPERIENCE Saturday ALL_DAY
  ('HEX-2026','HALF-IND-M','½ Hybrid Individual Mujer','EXPERIENCE','competitor','J1',1,80000,50,DATE '2026-11-14','ALL_DAY',true,true,'AVAILABLE',NULL),
  ('HEX-2026','HALF-IND-H','½ Hybrid Individual Hombre','EXPERIENCE','competitor','J1',1,80000,50,DATE '2026-11-14','ALL_DAY',true,true,'AVAILABLE',NULL),
  ('HEX-2026','HALF-DOB-MM','½ Hybrid Dobles Mujeres','EXPERIENCE','competitor','J2',2,160000,30,DATE '2026-11-14','ALL_DAY',true,true,'AVAILABLE',NULL),
  ('HEX-2026','HALF-DOB-HH','½ Hybrid Dobles Hombres','EXPERIENCE','competitor','J2',2,160000,30,DATE '2026-11-14','ALL_DAY',true,true,'AVAILABLE',NULL),
  ('HEX-2026','HALF-DOB-MH','½ Hybrid Dobles Mixto','EXPERIENCE','competitor','J2',2,160000,30,DATE '2026-11-14','ALL_DAY',true,true,'AVAILABLE',NULL),
  ('HEX-2026','WOD-M','Workout Experience Mujer','EXPERIENCE','workout','J4',1,35000,60,DATE '2026-11-14','ALL_DAY',false,false,'AVAILABLE',NULL),
  ('HEX-2026','WOD-H','Workout Experience Hombre','EXPERIENCE','workout','J4',1,35000,60,DATE '2026-11-14','ALL_DAY',false,false,'AVAILABLE',NULL),
  -- ASISTE
  ('HEX-2026','PUB-VIE','Público · Viernes','ASISTE','spectator','J5',1,25000,500,DATE '2026-11-13',NULL,false,false,'AVAILABLE',NULL),
  ('HEX-2026','PUB-SAB','Público · Sábado','ASISTE','spectator','J5',1,25000,500,DATE '2026-11-14',NULL,false,false,'AVAILABLE',NULL),
  ('HEX-2026','PUB-DOM','Público · Domingo','ASISTE','spectator','J5',1,25000,500,DATE '2026-11-15',NULL,false,false,'AVAILABLE',NULL),
  ('HEX-2026','PUB-3D','Público · Pase 3 Días','ASISTE','spectator','J5',1,60000,300,NULL,NULL,false,false,'AVAILABLE',NULL),
  ('HEX-2026','FOT-VIE','Fotógrafo · Viernes','ASISTE','press','J5',1,35000,30,DATE '2026-11-13',NULL,false,false,'AVAILABLE',NULL),
  ('HEX-2026','FOT-SAB','Fotógrafo · Sábado','ASISTE','press','J5',1,35000,30,DATE '2026-11-14',NULL,false,false,'AVAILABLE',NULL),
  ('HEX-2026','FOT-DOM','Fotógrafo · Domingo','ASISTE','press','J5',1,35000,30,DATE '2026-11-15',NULL,false,false,'AVAILABLE',NULL),
  ('HEX-2026','FOT-3D','Fotógrafo · Pase 3 Días','ASISTE','press','J5',1,80000,20,NULL,NULL,false,false,'AVAILABLE',NULL)
ON CONFLICT (event_code, code) DO UPDATE
SET
  name = EXCLUDED.name,
  block = EXCLUDED.block,
  kind = EXCLUDED.kind,
  journey = EXCLUDED.journey,
  team_size = EXCLUDED.team_size,
  price_cents = EXCLUDED.price_cents,
  day = EXCLUDED.day,
  session = EXCLUDED.session,
  has_chip = EXCLUDED.has_chip,
  has_insurance = EXCLUDED.has_insurance,
  sale_state = EXCLUDED.sale_state,
  visibility = EXCLUDED.visibility,
  updated_at = now();

-- Historical identities: preserve existing day/session/price/cupo on conflict.
-- INSERT values are only for a missing-row path. sale_state makes them
-- non-purchasable. Checkout must not remap these codes to current SKUs.
INSERT INTO public.products (
  event_code, code, name, block, kind, journey, team_size, price_cents, cupo,
  day, session, has_chip, has_insurance, sale_state, visibility
) VALUES
  ('HEX-2026','IND-PRO-H','Individual Pro Hombre','COMPITE','competitor',NULL,1,150000,30,DATE '2026-11-15','AM',true,true,'RETIRED_PRODUCT',NULL),
  ('HEX-2026','IND-PRO-M','Individual Pro Mujer','COMPITE','competitor',NULL,1,150000,30,DATE '2026-11-15','AM',true,true,'RETIRED_PRODUCT',NULL),
  ('HEX-2026','DOB-VIE-HH','Dobles Hombres · Viernes (superseded schedule)','COMPITE','competitor',NULL,2,250000,40,DATE '2026-11-13','PM',true,true,'SUPERSEDED_SCHEDULE_VARIANT',NULL),
  ('HEX-2026','DOB-VIE-MH','Dobles Mixto · Viernes (superseded schedule)','COMPITE','competitor',NULL,2,250000,40,DATE '2026-11-13','PM',true,true,'SUPERSEDED_SCHEDULE_VARIANT',NULL),
  ('HEX-2026','DOB-SAB-MM','Dobles Mujeres · Sábado (superseded schedule)','COMPITE','competitor',NULL,2,250000,40,DATE '2026-11-14','ALL_DAY',true,true,'SUPERSEDED_SCHEDULE_VARIANT',NULL)
ON CONFLICT (event_code, code) DO UPDATE
SET
  name = EXCLUDED.name,
  journey = EXCLUDED.journey,
  sale_state = EXCLUDED.sale_state,
  visibility = EXCLUDED.visibility,
  updated_at = now();

-- ---------------------------------------------------------------------
-- F. Restore 0016 compensating DCL (plus new table)
-- ---------------------------------------------------------------------

REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.events FROM project_admin;
GRANT UPDATE ON TABLE public.events TO project_admin;

REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.products FROM project_admin;
GRANT UPDATE ON TABLE public.products TO project_admin;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.event_days FROM project_admin;

GRANT SELECT, UPDATE ON TABLE public.event_category_sale_states TO project_admin;
REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.event_category_sale_states FROM project_admin;

-- ---------------------------------------------------------------------
-- G. checkout_start_tx + ticket_issue_one_registration (bodies follow)
-- ---------------------------------------------------------------------

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
  v_category_sale_state text;
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

  -- v0.4 commercial availability: organizer sale_state only (parent wins).
  -- cupo and ACTIVE holds are transactional integrity, not commercial SOLD_OUT.
  IF v_event.sale_state IS NOT DISTINCT FROM 'SOLD_OUT' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SOLD_OUT');
  END IF;

  SELECT s.sale_state INTO v_category_sale_state
  FROM public.event_category_sale_states s
  WHERE s.event_code = v_event.code
    AND s.block = v_product.block;

  IF v_category_sale_state IS NOT DISTINCT FROM 'SOLD_OUT' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SOLD_OUT');
  END IF;

  IF v_product.sale_state IS NOT DISTINCT FROM 'SOLD_OUT' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SOLD_OUT');
  END IF;

  IF v_product.sale_state IN (
       'RETIRED_PRODUCT',
       'SUPERSEDED_SCHEDULE_VARIANT',
       'SALES_CLOSED',
       'CANCELLED',
       'INACTIVE',
       'HIDDEN'
     )
     OR v_product.visibility = 'HIDDEN' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PRODUCT_NOT_AVAILABLE');
  END IF;

  v_expires_at := now() + make_interval(secs => v_hold_seconds);
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
    COALESCE(p->'commercial_snapshot', '{}'::jsonb)
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
    COALESCE(p->'commercial_snapshot', '{}'::jsonb)
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

REVOKE ALL ON FUNCTION public.checkout_start_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkout_start_tx(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_start_tx(jsonb) TO project_admin;

COMMENT ON FUNCTION public.checkout_start_tx(jsonb) IS
  'TX-1 checkout start; OD-001 spectator multi-quantity; v0.4 organizer sale_state SOLD_OUT (event/category/product, parent wins); cupo/holds are not commercial SOLD_OUT.';

CREATE OR REPLACE FUNCTION public.ticket_issue_one_registration(p_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_reg public.registrations%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_team public.teams%ROWTYPE;
  v_member public.team_members%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
  v_gen public.ticket_credential_generations%ROWTYPE;
  v_raw text;
  v_hash text;
  v_folio text;
  v_waiver_ok boolean := false;
  v_ent_date date;
  v_created boolean := false;
BEGIN
  IF p_registration_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  SELECT * INTO v_reg
  FROM public.registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'REGISTRATION_NOT_FOUND');
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_reg.order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.state IS DISTINCT FROM 'PAID' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ORDER_NOT_PAID');
  END IF;

  IF v_reg.state IS DISTINCT FROM 'PAYMENT_CONFIRMED' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'REGISTRATION_NOT_ELIGIBLE');
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = v_reg.product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PRODUCT_NOT_FOUND');
  END IF;

  -- Unknown null-day spectator/press remains fail-closed.
  -- PUB-3D / FOT-3D are normal 3-day passes (one ticket, three date entitlements).
  IF v_product.kind IN ('spectator', 'press')
     AND v_product.day IS NULL
     AND v_product.code NOT IN ('PUB-3D', 'FOT-3D') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PRODUCT_NOT_AVAILABLE', 'skipped', true);
  END IF;

  -- Team journeys: only when roster ELIGIBLE and member COMPLETE.
  IF v_product.team_size > 1 THEN
    IF v_reg.team_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'TEAM_REQUIRED');
    END IF;
    SELECT * INTO v_team FROM public.teams WHERE id = v_reg.team_id FOR UPDATE;
    IF NOT FOUND OR v_team.roster_state IS DISTINCT FROM 'ELIGIBLE' THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'ROSTER_NOT_ELIGIBLE', 'skipped', true);
    END IF;
    IF v_reg.team_member_id IS NOT NULL THEN
      SELECT * INTO v_member FROM public.team_members WHERE id = v_reg.team_member_id FOR UPDATE;
      IF NOT FOUND OR v_member.state IS DISTINCT FROM 'COMPLETE' THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'MEMBER_NOT_COMPLETE', 'skipped', true);
      END IF;
    END IF;
  END IF;

  -- Individual competitor (J1): require waiver acceptance. Workout/spectator/press: no competition waiver.
  IF v_product.kind = 'competitor' AND v_product.team_size = 1 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.waiver_acceptances wa
      WHERE wa.participant_id = v_reg.participant_id
    ) INTO v_waiver_ok;
    IF NOT v_waiver_ok THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'WAIVER_REQUIRED', 'skipped', true);
    END IF;
  END IF;

  -- Idempotent: existing ticket wins.
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE registration_id = v_reg.id
  FOR UPDATE;

  IF FOUND THEN
    SELECT * INTO v_gen
    FROM public.ticket_credential_generations
    WHERE ticket_id = v_ticket.id
      AND state = 'ACTIVE'
    ORDER BY generation DESC
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true,
      'replay', true,
      'ticket_id', v_ticket.id,
      'folio_namespace', v_ticket.folio_namespace,
      'folio', v_ticket.folio,
      'state', v_ticket.state,
      'credential_generation_id', v_gen.id,
      'raw_token', NULL
    );
  END IF;

  v_folio := public.ticket_new_opaque_token('tkt_');
  v_raw := public.ticket_new_opaque_token('qr_');
  v_hash := public.ticket_hash_token(v_raw);

  INSERT INTO public.tickets (
    registration_id,
    access_holder_id,
    participant_id,
    product_id,
    product_code,
    folio_namespace,
    folio,
    state,
    issued_at
  ) VALUES (
    v_reg.id,
    v_reg.access_holder_id,
    v_reg.participant_id,
    v_product.id,
    v_product.code,
    'ticket',
    v_folio,
    'ISSUED',
    now()
  )
  RETURNING * INTO v_ticket;
  v_created := true;

  INSERT INTO public.ticket_credential_generations (
    ticket_id,
    generation,
    token_hash,
    state,
    issued_at,
    expires_at
  ) VALUES (
    v_ticket.id,
    1,
    v_hash,
    'ACTIVE',
    now(),
    NULL
  )
  RETURNING * INTO v_gen;

  -- Entitlements: one date-scoped row per covered day. Session NULL for
  -- daily PUB/FOT and for each 3D day. Using one day does not revoke others.
  IF v_product.code IN ('PUB-3D', 'FOT-3D') THEN
    INSERT INTO public.access_entitlements (
      ticket_id, entitlement_date, session, state
    ) VALUES
      (v_ticket.id, DATE '2026-11-13', NULL, 'AVAILABLE'),
      (v_ticket.id, DATE '2026-11-14', NULL, 'AVAILABLE'),
      (v_ticket.id, DATE '2026-11-15', NULL, 'AVAILABLE');
  ELSE
    v_ent_date := v_product.day;
    IF v_ent_date IS NOT NULL THEN
      INSERT INTO public.access_entitlements (
        ticket_id, entitlement_date, session, state
      ) VALUES (
        v_ticket.id, v_ent_date, v_product.session, 'AVAILABLE'
      );
    END IF;
  END IF;

  -- TICKET_ACCESS capability (hash only; no raw token).
  INSERT INTO public.capability_credentials (
    kind, token_hash, least_scope, subject_ref, resource_ref,
    ticket_id, order_id, state, generation
  ) VALUES (
    'TICKET_ACCESS',
    encode(sha256(('ticket-access:' || v_ticket.id::text || ':' || v_gen.id::text)::bytea), 'hex'),
    'ticket:access',
    COALESCE(v_reg.participant_id::text, v_reg.access_holder_id::text),
    v_ticket.id::text,
    v_ticket.id,
    v_order.id,
    'ISSUED',
    1
  );

  -- Outbox without raw QR token / PII (delivery deferred OD-017).
  INSERT INTO public.outbox_delivery_jobs (
    communication_type, template, destination_ref, domain_event_ref, minimal_payload, state
  ) VALUES (
    'TICKET_READY',
    'TICKET_READY',
    'deferred:email',
    'ticket:' || v_ticket.id::text,
    jsonb_build_object(
      'ticket_id', v_ticket.id,
      'folio_namespace', v_ticket.folio_namespace,
      'product_code', v_ticket.product_code,
      'credential_generation', v_gen.generation
    ),
    'PENDING'
  );

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, sanitized_metadata
  ) VALUES (
    'rpc:ticket_issue',
    'TICKET_ISSUED',
    'ticket',
    v_ticket.id::text,
    'ISSUED',
    jsonb_build_object(
      'registration_id', v_reg.id,
      'product_code', v_product.code,
      'folio_namespace', 'ticket',
      'created', v_created,
      'raw_token_persisted', false,
      'email_sent', false
    )
  );

  -- Raw token returned only to SECURITY DEFINER caller; never persisted.
  RETURN jsonb_build_object(
    'ok', true,
    'replay', false,
    'ticket_id', v_ticket.id,
    'folio_namespace', v_ticket.folio_namespace,
    'folio', v_ticket.folio,
    'state', v_ticket.state,
    'credential_generation_id', v_gen.id,
    'raw_token', v_raw
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Concurrent issuer: return existing ticket without raw token.
    SELECT * INTO v_ticket FROM public.tickets WHERE registration_id = p_registration_id;
    RETURN jsonb_build_object(
      'ok', true,
      'replay', true,
      'ticket_id', v_ticket.id,
      'folio_namespace', v_ticket.folio_namespace,
      'folio', v_ticket.folio,
      'state', v_ticket.state,
      'raw_token', NULL,
      'concurrent', true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_issue_one_registration(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ticket_issue_one_registration(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_issue_one_registration(uuid) TO project_admin;

COMMENT ON FUNCTION public.ticket_issue_one_registration(uuid) IS
  'IMPL-11 / v0.4: idempotent one ticket + hashed QR; PUB-3D/FOT-3D emit three date-scoped entitlements (session NULL).';

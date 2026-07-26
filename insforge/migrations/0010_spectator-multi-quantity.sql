-- =====================================================================
-- 0010_spectator-multi-quantity.sql
-- Purpose: OD-001 APPROVED — spectator quantity >= 1 access units per order.
-- Authority: Project Owner Leandro Espinosa — AUTHORIZED_FOR_SPECTATOR_QUANTITY_IMPLEMENTATION
--
-- Limits:
--  · CREATE OR REPLACE checkout_start_tx only (no table/column/policy changes).
--  · Does NOT edit migrations v1–v9.
--  · Does NOT alter competitor/team/press quantity rules (remain quantity = 1).
--  · Does NOT invent companion PII; companion units use opaque access_* refs.
--  · Ticket issuance remains one ticket per registration (N regs → N tickets).
-- =====================================================================

-- Note: no BEGIN/COMMIT — InsForge migration runner forbids transaction control.

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

  SELECT COALESCE(SUM(capacity_units), 0)::integer INTO v_active_holds
  FROM public.capacity_holds
  WHERE product_id = v_product.id
    AND state = 'ACTIVE';

  IF v_active_holds + v_units > v_product.cupo THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'SOLD_OUT');
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
  'TX-1 checkout start; OD-001 spectator multi-quantity creates N registrations and holds N capacity units.';

-- =====================================================================
-- 0007_team_roster_invitations.sql
-- Purpose: IMPL-10 team shell in TX-1, payment roster sync in TX-2,
--          and read/accept RPCs for opaque roster invitations.
-- Authority: Explicit Project Owner authorization for IMPL-10.
--
-- Limits:
--  · CREATE OR REPLACE checkout_start_tx / checkout_attach_preference
--    (team bootstrap for team_size > 1 only; J1/J4/J5 unchanged).
--  · CREATE OR REPLACE webhook_apply_payment_tx (+ team sync helper).
--  · CREATE team_roster_get_tx / team_roster_accept_tx.
--  · Does NOT create tables/columns/triggers/policies/extensions.
--  · Does NOT alter catalog/event/prices/cupos.
--  · Does NOT GRANT EXECUTE to PUBLIC/anon/authenticated.
--  · Does NOT create tickets, QR credentials, or send email.
--  · Invitation TTL is server-provided (OD-011 fail-closed via env).
-- =====================================================================

-- =====================================================================
-- 0007_team_roster_invitations.sql (checkout REPLACE from 0005)
-- Purpose: Atomic TX-1 reservation helper for mp-create-checkout (IMPL-10).
-- Authority: Explicit Project Owner authorization for IMPL-10.
--
-- Limits:
--  · Creates ONLY the SECURITY DEFINER RPC checkout_start_tx(jsonb)
--    and checkout_attach_preference / checkout_compensate_preference helpers.
--  · Does NOT create tables, columns, triggers, extensions, or policies.
--  · Does NOT alter catalog data.
--  · Does NOT GRANT EXECUTE to PUBLIC or anon.
--  · EXECUTE granted only to project_admin (edge admin client).
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

  INSERT INTO public.participants (public_ref, buyer_contact_id, participation_type, state)
  VALUES (
    COALESCE(p->>'participant_public_ref', 'part_' || replace(gen_random_uuid()::text, '-', '')),
    v_buyer_id,
    'COMPETITOR',
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

  INSERT INTO public.registrations (
    event_id, event_code, product_id, product_code, participant_id, order_id, journey, state
  ) VALUES (
    v_event.id, v_event.code, v_product.id, v_product.code, v_participant_id, v_order_id, p->>'journey', 'STARTED'
  )
  RETURNING id INTO v_registration_id;

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
    jsonb_build_object('product_code', v_product.code, 'journey', p->>'journey')
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

CREATE OR REPLACE FUNCTION public.checkout_attach_preference(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order_id uuid := (p->>'order_id')::uuid;
  v_tracking text;
  v_expires timestamptz;
  v_key_hash text;
  v_body jsonb;
BEGIN
  UPDATE public.orders
  SET state = 'PAYMENT_PENDING',
      commercial_snapshot = COALESCE(commercial_snapshot, '{}'::jsonb) || jsonb_build_object(
        'provider', 'mercadopago',
        'preference_id', p->>'preference_id'
      ),
      updated_at = now()
  WHERE id = v_order_id
  RETURNING tracking_ref, expires_at, idempotency_key_hash
  INTO v_tracking, v_expires, v_key_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INTERNAL_ERROR');
  END IF;

  v_body := jsonb_build_object(
    'checkout_url', p->>'init_point',
    'public_order_reference', v_tracking,
    'expires_at', v_expires
  );
  IF p ? 'invitation_tokens' AND jsonb_typeof(p->'invitation_tokens') = 'array'
     AND jsonb_array_length(p->'invitation_tokens') > 0 THEN
    v_body := v_body || jsonb_build_object('roster_invitations', p->'invitation_tokens');
  END IF;

  UPDATE public.idempotency_records
  SET state = 'COMPLETED',
      response_ref = v_body::text,
      updated_at = now()
  WHERE scope = 'OP-PUB-04'
    AND actor_context IS NULL
    AND key_hash = v_key_hash;

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, sanitized_metadata
  ) VALUES (
    'edge:mp-create-checkout',
    'CHECKOUT_PREFERENCE_ATTACHED',
    'order',
    v_order_id::text,
    'PAYMENT_PENDING',
    jsonb_build_object('preference_id', p->>'preference_id')
  );

  RETURN jsonb_build_object('ok', true, 'response', v_body);
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_compensate_preference(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_order_id uuid := (p->>'order_id')::uuid;
  v_hold_id uuid := (p->>'hold_id')::uuid;
BEGIN
  UPDATE public.capacity_holds
  SET state = 'RELEASED',
      released_at = now(),
      reason = COALESCE(p->>'reason', 'PREFERENCE_FAILED'),
      updated_at = now()
  WHERE id = v_hold_id
    AND state = 'ACTIVE';

  UPDATE public.orders
  SET state = 'CANCELLED',
      cancellation_reason = COALESCE(p->>'reason', 'PREFERENCE_FAILED'),
      updated_at = now()
  WHERE id = v_order_id
    AND state IN ('CREATED', 'PREFERENCE_PENDING');

  UPDATE public.teams t
  SET roster_state = 'CANCELLED',
      payment_state = 'CANCELLED',
      updated_at = now()
  FROM public.registrations r
  WHERE r.team_id = t.id
    AND r.order_id = v_order_id
    AND t.roster_state IN ('PROVISIONAL', 'PAYMENT_PENDING');

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, failure_class, sanitized_metadata
  ) VALUES (
    'edge:mp-create-checkout',
    'CHECKOUT_PREFERENCE_FAILED',
    'order',
    v_order_id::text,
    'CANCELLED',
    'PROVIDER_FAILURE',
    jsonb_build_object('hold_id', v_hold_id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_start_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkout_attach_preference(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkout_compensate_preference(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkout_start_tx(jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_attach_preference(jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_compensate_preference(jsonb) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.checkout_start_tx(jsonb) TO project_admin;
GRANT EXECUTE ON FUNCTION public.checkout_attach_preference(jsonb) TO project_admin;
GRANT EXECUTE ON FUNCTION public.checkout_compensate_preference(jsonb) TO project_admin;


-- =====================================================================
-- Helper: apply payment outcome to team roster_state (no tickets/QR).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.team_apply_payment_outcome(
  p_order_id uuid,
  p_outcome text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_team public.teams%ROWTYPE;
BEGIN
  SELECT t.* INTO v_team
  FROM public.teams t
  JOIN public.registrations r ON r.team_id = t.id
  WHERE r.order_id = p_order_id
  LIMIT 1
  FOR UPDATE OF t;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_outcome IN ('PAID', 'ALREADY_PAID') THEN
    UPDATE public.teams
    SET payment_state = 'PAID',
        roster_state = CASE
          WHEN slots_complete >= required_size AND roster_state = 'ELIGIBLE' THEN 'ELIGIBLE'
          WHEN slots_complete >= required_size THEN 'PAID_ROSTER_COMPLETE'
          ELSE 'PAID_ROSTER_INCOMPLETE'
        END,
        updated_at = now()
    WHERE id = v_team.id
      AND roster_state IN ('PROVISIONAL', 'PAYMENT_PENDING', 'PAID_ROSTER_INCOMPLETE', 'PAID_ROSTER_COMPLETE');
  ELSIF p_outcome IN ('REJECTED', 'CANCELLED') THEN
    UPDATE public.teams
    SET payment_state = p_outcome,
        roster_state = 'CANCELLED',
        updated_at = now()
    WHERE id = v_team.id
      AND roster_state IN ('PROVISIONAL', 'PAYMENT_PENDING', 'PAID_ROSTER_INCOMPLETE');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.team_apply_payment_outcome(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_apply_payment_outcome(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_apply_payment_outcome(uuid, text) TO project_admin;

-- =====================================================================
-- GET projection by opaque invitation token hash
-- =====================================================================
CREATE OR REPLACE FUNCTION public.team_roster_get_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_hash text := p->>'token_hash';
  v_cap public.capability_credentials%ROWTYPE;
  v_team public.teams%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_member public.team_members%ROWTYPE;
  v_completed integer;
  v_accepting boolean := false;
  v_status text;
  v_waiver_type text := NULLIF(p->>'waiver_document_type', '');
  v_waiver_version text := NULLIF(p->>'waiver_document_version', '');
BEGIN
  IF v_hash IS NULL OR length(v_hash) < 32 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_TOKEN');
  END IF;

  -- Read-only projection: no locks, no state mutations on GET.
  SELECT * INTO v_cap
  FROM public.capability_credentials
  WHERE token_hash = v_hash
    AND kind = 'INVITATION_EXCHANGE_CODE';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVITATION_NOT_FOUND');
  END IF;

  IF v_cap.state IN ('REVOKED', 'EXPIRED', 'REPLACED', 'CONSUMED')
     OR (v_cap.expires_at IS NOT NULL AND v_cap.expires_at < now()) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVITATION_INACTIVE');
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = v_cap.team_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVITATION_NOT_FOUND');
  END IF;

  SELECT * INTO v_member FROM public.team_members WHERE id = v_cap.team_member_id;
  SELECT * INTO v_product FROM public.products WHERE id = v_team.product_id;
  SELECT o.* INTO v_order
  FROM public.orders o
  JOIN public.registrations r ON r.order_id = o.id
  WHERE r.team_id = v_team.id
  ORDER BY o.created_at ASC
  LIMIT 1;

  SELECT COUNT(*)::integer INTO v_completed
  FROM public.team_members
  WHERE team_id = v_team.id
    AND state IN ('COMPLETE', 'WAIVER_ACCEPTED')
    AND role IN ('CAPTAIN', 'INVITEE');

  IF v_order.state = 'PAID'
     AND v_team.roster_state IN ('PAID_ROSTER_INCOMPLETE', 'PAID_ROSTER_COMPLETE', 'ELIGIBLE')
     AND v_member.state = 'INVITED'
     AND v_cap.state IN ('ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE') THEN
    v_accepting := true;
    v_status := 'OPEN';
  ELSIF v_order.state IS DISTINCT FROM 'PAID' THEN
    v_status := 'PAYMENT_REQUIRED';
  ELSIF v_member.state IN ('COMPLETE', 'WAIVER_ACCEPTED', 'DATA_COMPLETE', 'STARTED') THEN
    v_status := 'SLOT_COMPLETE';
  ELSIF v_team.roster_state IN ('CANCELLED', 'BLOCKED') THEN
    v_status := 'CLOSED';
  ELSE
    v_status := 'CLOSED';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'projection', jsonb_build_object(
      'status', v_status,
      'product_name', v_product.name,
      'required_members', v_team.required_size,
      'completed_members', v_completed,
      'remaining_members', GREATEST(v_team.required_size - v_completed, 0),
      'accepting_members', v_accepting,
      'waiver', CASE
        WHEN v_accepting AND v_waiver_type IS NOT NULL AND v_waiver_version IS NOT NULL
        THEN jsonb_build_object('document_type', v_waiver_type, 'version', v_waiver_version)
        ELSE NULL
      END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.team_roster_get_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_roster_get_tx(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_roster_get_tx(jsonb) TO project_admin;


-- =====================================================================
-- 0007_team_roster_invitations.sql (webhook REPLACE from 0006)
-- Purpose: Atomic TX-2 payment-effect helper for mp-webhook (IMPL-10).
-- Authority: Explicit Project Owner authorization for IMPL-10.
--
-- Limits:
--  · Creates ONLY SECURITY DEFINER RPC webhook_apply_payment_tx(jsonb).
--  · Does NOT create tables, columns, triggers, extensions, or policies.
--  · Does NOT alter catalog data.
--  · Does NOT GRANT EXECUTE to PUBLIC or anon.
--  · EXECUTE granted only to project_admin (edge admin client).
--  · Does NOT create tickets, QR credentials, or send email.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.webhook_apply_payment_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_provider text := 'MERCADOPAGO';
  v_notification_id text := p->>'provider_notification_id';
  v_notification_type text := COALESCE(p->>'notification_type', 'payment');
  v_canonical_hash text := p->>'canonical_input_hash';
  v_headers jsonb := COALESCE(p->'sanitized_headers', '{}'::jsonb);
  v_provider_payment_id text := p->>'provider_payment_id';
  v_external_state text := p->>'external_state';
  v_normalized text := p->>'normalized_state';
  v_amount_cents bigint := COALESCE((p->>'amount_cents')::bigint, -1);
  v_currency text := upper(COALESCE(p->>'currency', ''));
  v_external_reference text := COALESCE(p->>'external_reference', '');
  v_merchant_ok boolean := COALESCE((p->>'merchant_ownership_ok')::boolean, false);
  v_ref_ok boolean := COALESCE((p->>'external_reference_ok')::boolean, false);
  v_amount_pre_ok boolean := COALESCE((p->>'amount_ok')::boolean, false);
  v_currency_ok boolean := COALESCE((p->>'currency_ok')::boolean, false);
  v_provider_created timestamptz := NULLIF(p->>'provider_created_at', '')::timestamptz;
  v_provider_updated timestamptz := NULLIF(p->>'provider_updated_at', '')::timestamptz;
  v_correlation text := p->>'correlation_id';

  v_existing_wh public.webhook_events%ROWTYPE;
  v_webhook_id uuid;
  v_order public.orders%ROWTYPE;
  v_order_found boolean := false;
  v_payment public.payments%ROWTYPE;
  v_payment_found boolean := false;
  v_hold public.capacity_holds%ROWTYPE;
  v_hold_found boolean := false;
  v_verification_id uuid;
  v_amount_ok boolean;
  v_all_ok boolean;
  v_outcome text;
  v_order_target text;
  v_hold_target text;
  v_reg_target text;
  v_payment_target text;
  v_create_outbox boolean := false;
  v_rank_new integer;
  v_rank_old integer;
BEGIN
  IF v_notification_id IS NULL OR v_provider_payment_id IS NULL OR v_normalized IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  IF v_normalized NOT IN ('UNKNOWN', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  -- Idempotent receipt by provider notification id (delivery identity).
  SELECT * INTO v_existing_wh
  FROM public.webhook_events
  WHERE provider = v_provider
    AND provider_notification_id = v_notification_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_wh.processing_state IN ('PROCESSED', 'IGNORED') THEN
      RETURN jsonb_build_object(
        'ok', true,
        'replay', true,
        'outcome', 'DUPLICATE'
      );
    END IF;
    v_webhook_id := v_existing_wh.id;
  ELSE
    INSERT INTO public.webhook_events (
      provider,
      provider_notification_id,
      notification_type,
      signature_result,
      canonical_input_hash,
      sanitized_headers,
      processing_state,
      attempts,
      result,
      received_at
    ) VALUES (
      v_provider,
      v_notification_id,
      v_notification_type,
      'VALID',
      v_canonical_hash,
      v_headers,
      'RECEIVED',
      1,
      NULL,
      now()
    )
    RETURNING id INTO v_webhook_id;
  END IF;

  -- Resolve order by external_reference (= order_id text from IMPL-7).
  SELECT * INTO v_order
  FROM public.orders
  WHERE external_reference = v_external_reference
     OR id::text = v_external_reference
  FOR UPDATE;
  v_order_found := FOUND;

  v_amount_ok := v_amount_pre_ok AND v_order_found AND v_amount_cents = v_order.total_cents;
  v_ref_ok := v_ref_ok AND v_order_found;
  v_all_ok := v_merchant_ok AND v_ref_ok AND v_amount_ok AND v_currency_ok AND v_order_found;

  INSERT INTO public.payment_verification_records (
    order_id,
    sanitized_provider_evidence_ref,
    merchant_ownership_ok,
    external_reference_ok,
    amount_ok,
    currency_ok,
    normalized_result,
    verified_at,
    correlation_id,
    reconciliation_state
  ) VALUES (
    CASE WHEN v_order_found THEN v_order.id ELSE NULL END,
    'mp_payment:' || v_provider_payment_id,
    v_merchant_ok,
    v_ref_ok,
    v_amount_ok,
    v_currency_ok,
    CASE WHEN v_all_ok THEN v_normalized ELSE 'VERIFICATION_FAILED' END,
    now(),
    v_correlation,
    CASE WHEN v_all_ok THEN 'VERIFIED' ELSE 'MISMATCH' END
  )
  RETURNING id INTO v_verification_id;

  IF NOT v_order_found OR NOT v_all_ok THEN
    UPDATE public.webhook_events
    SET processing_state = 'PROCESSED',
        result = 'VERIFICATION_REJECTED',
        sanitized_error = CASE
          WHEN NOT v_order_found THEN 'ORDER_NOT_FOUND'
          WHEN NOT v_merchant_ok THEN 'MERCHANT_MISMATCH'
          WHEN NOT v_ref_ok THEN 'REFERENCE_MISMATCH'
          WHEN NOT v_amount_ok THEN 'AMOUNT_MISMATCH'
          WHEN NOT v_currency_ok THEN 'CURRENCY_MISMATCH'
          ELSE 'VERIFICATION_FAILED'
        END,
        processed_at = now(),
        updated_at = now()
    WHERE id = v_webhook_id;

    INSERT INTO public.activity_log (
      actor_ref, named_action, entity_type, entity_ref, result, failure_class, correlation_id, sanitized_metadata
    ) VALUES (
      'mp-webhook',
      'WEBHOOK_VERIFICATION_REJECTED',
      'payment',
      v_provider_payment_id,
      'REJECTED',
      'VERIFICATION',
      v_correlation,
      jsonb_build_object(
        'verification_id', v_verification_id,
        'merchant_ok', v_merchant_ok,
        'ref_ok', v_ref_ok,
        'amount_ok', v_amount_ok,
        'currency_ok', v_currency_ok
      )
    );

    RETURN jsonb_build_object(
      'ok', true,
      'outcome', 'VERIFICATION_REJECTED',
      'verification_id', v_verification_id
    );
  END IF;

  -- Upsert payment by provider payment id.
  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider = v_provider
    AND provider_payment_id = v_provider_payment_id
  FOR UPDATE;
  v_payment_found := FOUND;

  v_rank_new := CASE v_normalized
    WHEN 'UNKNOWN' THEN 0
    WHEN 'PENDING' THEN 1
    WHEN 'REJECTED' THEN 2
    WHEN 'CANCELLED' THEN 2
    WHEN 'APPROVED' THEN 3
    WHEN 'REFUNDED' THEN 4
    WHEN 'CHARGED_BACK' THEN 4
    ELSE 0
  END;

  IF v_payment_found THEN
    v_rank_old := CASE v_payment.normalized_state
      WHEN 'UNKNOWN' THEN 0
      WHEN 'PENDING' THEN 1
      WHEN 'REJECTED' THEN 2
      WHEN 'CANCELLED' THEN 2
      WHEN 'APPROVED' THEN 3
      WHEN 'REFUNDED' THEN 4
      WHEN 'CHARGED_BACK' THEN 4
      ELSE 0
    END;

    IF v_rank_new < v_rank_old THEN
      -- Out-of-order: do not regress canonical payment state.
      v_payment_target := v_payment.normalized_state;
    ELSE
      v_payment_target := v_normalized;
    END IF;

    UPDATE public.payments
    SET order_id = v_order.id,
        external_state = v_external_state,
        normalized_state = v_payment_target,
        amount_cents = v_amount_cents,
        currency = v_currency,
        external_reference = v_external_reference,
        provider_created_at = COALESCE(v_provider_created, provider_created_at),
        provider_updated_at = COALESCE(v_provider_updated, provider_updated_at),
        last_verified_at = now(),
        sanitized_evidence_ref = 'mp_payment:' || v_provider_payment_id,
        reconciliation_state = 'VERIFIED',
        updated_at = now()
    WHERE id = v_payment.id;
  ELSE
    v_payment_target := v_normalized;
    INSERT INTO public.payments (
      provider,
      provider_payment_id,
      order_id,
      external_state,
      normalized_state,
      amount_cents,
      currency,
      external_reference,
      provider_created_at,
      provider_updated_at,
      last_verified_at,
      sanitized_evidence_ref,
      reconciliation_state
    ) VALUES (
      v_provider,
      v_provider_payment_id,
      v_order.id,
      v_external_state,
      v_payment_target,
      v_amount_cents,
      v_currency,
      v_external_reference,
      v_provider_created,
      v_provider_updated,
      now(),
      'mp_payment:' || v_provider_payment_id,
      'VERIFIED'
    )
    RETURNING * INTO v_payment;
  END IF;

  UPDATE public.payment_verification_records
  SET payment_id = v_payment.id
  WHERE id = v_verification_id;

  UPDATE public.webhook_events
  SET payment_id = v_payment.id
  WHERE id = v_webhook_id;

  -- Select hold for order.
  SELECT * INTO v_hold
  FROM public.capacity_holds
  WHERE order_id = v_order.id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;
  v_hold_found := FOUND;

  v_order_target := v_order.state;
  v_hold_target := CASE WHEN v_hold_found THEN v_hold.state ELSE NULL END;
  v_reg_target := NULL;
  v_outcome := 'APPLIED';

  IF v_payment_target = 'APPROVED' THEN
    IF v_hold_found AND (v_hold.state = 'EXPIRED' OR (v_hold.state = 'ACTIVE' AND v_hold.expires_at IS NOT NULL AND v_hold.expires_at < now()) OR v_hold.state = 'RELEASED') THEN
      -- SPEC-032-R042 late/expired hold: preserve APPROVED payment; review/conflict; no tickets.
      v_order_target := 'REQUIRES_REVIEW';
      IF v_hold.state IN ('EXPIRED', 'RELEASED', 'ACTIVE') THEN
        v_hold_target := 'CONFLICT';
      END IF;
      v_create_outbox := true;
      v_outcome := 'REQUIRES_REVIEW';
    ELSIF v_order.state IN ('PAYMENT_PENDING', 'PREFERENCE_PENDING', 'CREATED') THEN
      v_order_target := 'PAID';
      IF v_hold_found AND v_hold.state = 'ACTIVE' THEN
        v_hold_target := 'CONVERTED';
      END IF;
      v_reg_target := 'PAYMENT_CONFIRMED';
      v_outcome := 'PAID';
    ELSIF v_order.state = 'PAID' THEN
      v_outcome := 'ALREADY_PAID';
    ELSIF v_order.state = 'REQUIRES_REVIEW' THEN
      v_outcome := 'ALREADY_REVIEW';
    END IF;
  ELSIF v_payment_target = 'PENDING' THEN
    IF v_order.state IN ('PREFERENCE_PENDING', 'CREATED') THEN
      v_order_target := 'PAYMENT_PENDING';
    END IF;
    IF v_hold_found AND v_hold.state = 'ACTIVE' THEN
      v_hold_target := 'ACTIVE'; -- retain hold
    END IF;
    v_outcome := 'PENDING';
  ELSIF v_payment_target IN ('REJECTED', 'CANCELLED') THEN
    IF v_order.state IN ('CREATED', 'PREFERENCE_PENDING', 'PAYMENT_PENDING') THEN
      v_order_target := CASE WHEN v_payment_target = 'REJECTED' THEN 'REJECTED' ELSE 'CANCELLED' END;
    END IF;
    IF v_hold_found AND v_hold.state = 'ACTIVE' THEN
      v_hold_target := 'RELEASED';
    END IF;
    v_reg_target := 'CANCELLED';
    v_outcome := v_payment_target;
  ELSIF v_payment_target IN ('REFUNDED', 'CHARGED_BACK') THEN
    IF v_order.state IN ('PAID', 'REQUIRES_REVIEW') THEN
      v_order_target := v_payment_target;
    END IF;
    v_create_outbox := true;
    v_outcome := v_payment_target;
  END IF;

  -- Apply order transition (never regress PAID to pending/rejected via stale webhook).
  IF v_order_target IS DISTINCT FROM v_order.state THEN
    IF v_order.state = 'PAID' AND v_order_target IN ('PAYMENT_PENDING', 'REJECTED', 'CANCELLED', 'CREATED', 'PREFERENCE_PENDING') THEN
      NULL; -- ignore regressive order transition
    ELSE
      UPDATE public.orders
      SET state = v_order_target,
          updated_at = now()
      WHERE id = v_order.id;
    END IF;
  END IF;

  IF v_hold_target IS NOT NULL AND v_hold_found AND v_hold_target IS DISTINCT FROM v_hold.state THEN
    UPDATE public.capacity_holds
    SET state = v_hold_target,
        converted_at = CASE WHEN v_hold_target = 'CONVERTED' THEN now() ELSE converted_at END,
        released_at = CASE WHEN v_hold_target IN ('RELEASED', 'CONFLICT') THEN COALESCE(released_at, now()) ELSE released_at END,
        updated_at = now()
    WHERE id = v_hold.id;
  END IF;

  IF v_reg_target IS NOT NULL THEN
    UPDATE public.registrations
    SET state = CASE
          WHEN state IN ('STARTED', 'PENDING_PAYMENT') AND v_reg_target = 'PAYMENT_CONFIRMED' THEN 'PAYMENT_CONFIRMED'
          WHEN state IN ('STARTED', 'PENDING_PAYMENT') AND v_reg_target = 'CANCELLED' THEN 'CANCELLED'
          ELSE state
        END,
        updated_at = now()
    WHERE order_id = v_order.id;
  END IF;

  IF v_create_outbox THEN
    INSERT INTO public.outbox_delivery_jobs (
      communication_type,
      template,
      destination_ref,
      domain_event_ref,
      minimal_payload,
      state
    ) VALUES (
      'INTERNAL_ALERT',
      CASE
        WHEN v_outcome = 'REQUIRES_REVIEW' THEN 'PAYMENT_REQUIRES_REVIEW'
        ELSE 'PAYMENT_CORRECTIVE_STATE'
      END,
      'ops:payments',
      'order:' || v_order.id::text,
      jsonb_build_object(
        'order_id', v_order.id,
        'payment_id', v_payment.id,
        'outcome', v_outcome,
        'normalized_state', v_payment_target
      ),
      'PENDING'
    );
  END IF;

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, correlation_id, sanitized_metadata
  ) VALUES (
    'mp-webhook',
    'WEBHOOK_PAYMENT_APPLIED',
    'order',
    v_order.id::text,
    v_outcome,
    v_correlation,
    jsonb_build_object(
      'provider_payment_id', v_provider_payment_id,
      'normalized_state', v_payment_target,
      'order_state', v_order_target,
      'hold_state', v_hold_target,
      'tickets_emitted', false,
      'qr_created', false,
      'email_sent', false
    )
  );

  UPDATE public.webhook_events
  SET processing_state = 'PROCESSED',
      result = v_outcome,
      processed_at = now(),
      updated_at = now(),
      attempts = attempts + CASE WHEN processing_state = 'RECEIVED' THEN 0 ELSE 1 END
  WHERE id = v_webhook_id;

  -- IMPL-10: sync team roster_state from payment outcome (no tickets/QR).
  IF v_order_found THEN
    PERFORM public.team_apply_payment_outcome(v_order.id, v_outcome);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'outcome', v_outcome,
    'webhook_event_id', v_webhook_id,
    'payment_id', v_payment.id,
    'order_id', v_order.id,
    'verification_id', v_verification_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.webhook_apply_payment_tx(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_apply_payment_tx(jsonb) TO project_admin;

COMMENT ON FUNCTION public.webhook_apply_payment_tx(jsonb) IS
  'IMPL-10 TX-2: apply verified Mercado Pago payment effects atomically; no tickets/QR/email delivery.';


CREATE OR REPLACE FUNCTION public.team_roster_accept_tx(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_hash text := p->>'token_hash';
  v_key_hash text := p->>'idempotency_key_hash';
  v_fingerprint text := p->>'request_fingerprint';
  v_ttl integer := COALESCE((p->>'idempotency_ttl_seconds')::integer, 0);
  v_scope text := 'OP-PUB-07';
  v_existing public.idempotency_records%ROWTYPE;
  v_cap public.capability_credentials%ROWTYPE;
  v_team public.teams%ROWTYPE;
  v_member public.team_members%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_event_id uuid;
  v_event_code text;
  v_journey text;
  v_participant_id uuid;
  v_registration_id uuid;
  v_waiver_doc_id uuid;
  v_waiver_acc_id uuid;
  v_waiver_type text := NULLIF(p->>'waiver_document_type', '');
  v_waiver_version text := NULLIF(p->>'waiver_document_version', '');
  v_waiver_accepted boolean := COALESCE((p->>'waiver_accepted')::boolean, false);
  v_participant_ref text := COALESCE(NULLIF(p->>'participant_public_ref', ''), 'part_' || replace(gen_random_uuid()::text, '-', ''));
  v_completed integer;
  v_roster_state text;
  v_response jsonb;
BEGIN
  IF v_hash IS NULL OR v_key_hash IS NULL OR v_fingerprint IS NULL OR v_ttl <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_REQUEST');
  END IF;

  IF NOT v_waiver_accepted OR v_waiver_type IS NULL OR v_waiver_version IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'WAIVER_REQUIRED');
  END IF;

  SELECT * INTO v_existing
  FROM public.idempotency_records
  WHERE scope = v_scope
    AND actor_context IS NULL
    AND key_hash = v_key_hash
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.request_fingerprint = v_fingerprint AND v_existing.response_ref IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'replay', true, 'prior_response', v_existing.response_ref::jsonb);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error_code', 'CONFLICT');
  END IF;

  SELECT * INTO v_cap
  FROM public.capability_credentials
  WHERE token_hash = v_hash
    AND kind = 'INVITATION_EXCHANGE_CODE'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVITATION_NOT_FOUND');
  END IF;

  IF v_cap.state IN ('REVOKED', 'EXPIRED', 'REPLACED', 'CONSUMED')
     OR (v_cap.expires_at IS NOT NULL AND v_cap.expires_at < now()) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVITATION_INACTIVE');
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = v_cap.team_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVITATION_NOT_FOUND');
  END IF;

  SELECT * INTO v_member
  FROM public.team_members
  WHERE id = v_cap.team_member_id
  FOR UPDATE;

  IF NOT FOUND OR v_member.state IS DISTINCT FROM 'INVITED' OR v_member.participant_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ROSTER_FULL');
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders o
  JOIN public.registrations r ON r.order_id = o.id
  WHERE r.team_id = v_team.id
  ORDER BY o.created_at ASC
  LIMIT 1
  FOR UPDATE OF o;

  IF NOT FOUND OR v_order.state IS DISTINCT FROM 'PAID' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PAYMENT_REQUIRED');
  END IF;

  IF v_team.roster_state NOT IN ('PAID_ROSTER_INCOMPLETE', 'PAID_ROSTER_COMPLETE') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVITATION_INACTIVE');
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = v_team.product_id;
  SELECT r.event_id, r.event_code, r.journey
    INTO v_event_id, v_event_code, v_journey
  FROM public.registrations r
  WHERE r.team_id = v_team.id
    AND r.team_member_id = v_team.captain_team_member_id
  LIMIT 1;

  INSERT INTO public.waiver_documents (document_type, version, state, valid_from)
  VALUES (v_waiver_type, v_waiver_version, 'ACTIVE', now())
  ON CONFLICT (document_type, version) DO NOTHING;

  SELECT id INTO v_waiver_doc_id
  FROM public.waiver_documents
  WHERE document_type = v_waiver_type
    AND version = v_waiver_version
    AND state = 'ACTIVE';

  IF v_waiver_doc_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'WAIVER_CONFIGURATION_REQUIRED');
  END IF;

  BEGIN
    INSERT INTO public.participants (public_ref, participation_type, state)
    VALUES (v_participant_ref, 'COMPETITOR', 'ACTIVE')
    RETURNING id INTO v_participant_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'DUPLICATE_PARTICIPANT');
  END;

  INSERT INTO public.registrations (
    event_id, event_code, product_id, product_code, participant_id,
    team_id, team_member_id, order_id, journey, state
  ) VALUES (
    v_event_id,
    COALESCE(v_event_code, v_product.event_code),
    v_product.id,
    v_product.code,
    v_participant_id,
    v_team.id,
    v_member.id,
    v_order.id,
    COALESCE(v_journey, v_product.journey),
    'PAYMENT_CONFIRMED'
  )
  RETURNING id INTO v_registration_id;

  INSERT INTO public.waiver_acceptances (
    waiver_document_id, document_type, document_version, participant_id,
    actor_ref, context, authorized_evidence, accepted_at
  ) VALUES (
    v_waiver_doc_id, v_waiver_type, v_waiver_version, v_participant_id,
    'edge:team-roster', 'INVITEE_SELF',
    jsonb_build_object('source', 'team_roster_accept'),
    now()
  )
  RETURNING id INTO v_waiver_acc_id;

  UPDATE public.team_members
  SET participant_id = v_participant_id,
      registration_id = v_registration_id,
      waiver_acceptance_id = v_waiver_acc_id,
      state = 'COMPLETE',
      updated_at = now()
  WHERE id = v_member.id;

  UPDATE public.capability_credentials
  SET state = 'CONSUMED',
      consumed_at = now(),
      updated_at = now()
  WHERE id = v_cap.id;

  SELECT COUNT(*)::integer INTO v_completed
  FROM public.team_members
  WHERE team_id = v_team.id
    AND state = 'COMPLETE';

  IF v_completed >= v_team.required_size THEN
    v_roster_state := 'ELIGIBLE';
  ELSE
    v_roster_state := 'PAID_ROSTER_INCOMPLETE';
  END IF;

  UPDATE public.teams
  SET slots_complete = v_completed,
      roster_state = v_roster_state,
      eligibility_state = CASE WHEN v_roster_state = 'ELIGIBLE' THEN 'ELIGIBLE' ELSE 'NOT_ELIGIBLE' END,
      updated_at = now()
  WHERE id = v_team.id;

  INSERT INTO public.idempotency_records (
    scope, actor_context, key_hash, request_fingerprint, state, response_ref, expires_at
  ) VALUES (
    v_scope, NULL, v_key_hash, v_fingerprint, 'COMPLETED', NULL,
    now() + make_interval(secs => v_ttl)
  );

  v_response := jsonb_build_object(
    'status', CASE WHEN v_roster_state = 'ELIGIBLE' THEN 'TEAM_ELIGIBLE' ELSE 'MEMBER_ACCEPTED' END,
    'required_members', v_team.required_size,
    'completed_members', v_completed,
    'remaining_members', GREATEST(v_team.required_size - v_completed, 0),
    'terminal', v_roster_state = 'ELIGIBLE'
  );

  UPDATE public.idempotency_records
  SET response_ref = v_response::text,
      updated_at = now()
  WHERE scope = v_scope AND actor_context IS NULL AND key_hash = v_key_hash;

  INSERT INTO public.activity_log (
    actor_ref, named_action, entity_type, entity_ref, result, sanitized_metadata
  ) VALUES (
    'edge:team-roster',
    'TEAM_ROSTER_ACCEPT',
    'team',
    v_team.id::text,
    v_roster_state,
    jsonb_build_object(
      'completed_members', v_completed,
      'required_members', v_team.required_size,
      'tickets_emitted', false,
      'qr_created', false,
      'email_sent', false
    )
  );

  RETURN jsonb_build_object('ok', true, 'replay', false, 'response', v_response);
END;
$$;

REVOKE ALL ON FUNCTION public.team_roster_accept_tx(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_roster_accept_tx(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_roster_accept_tx(jsonb) TO project_admin;

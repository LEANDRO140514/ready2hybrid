-- =====================================================================
-- 0043_legacy-source-sync.sql
-- Continuous mirror of enforma.hybrid_registro_inscripciones.
--
-- Does not write orders, payments, tickets, participants, or checkout.
-- A manual sale resolution records that a human already settled an order.
-- It does not issue a ticket.
--
-- Apply alone, after 0042. Do not renumber onto an Openpay migration.
-- =====================================================================

ALTER TABLE public.legacy_registrations
  DROP CONSTRAINT ck_legacy_registrations_commercial_status;

ALTER TABLE public.legacy_registrations
  ADD CONSTRAINT ck_legacy_registrations_commercial_status
  CHECK (
    commercial_status IS NULL
    OR commercial_status IN ('LEGACY_PAID', 'LEGACY_PENDING', 'LEGACY_CANCELLED')
  );

ALTER TABLE public.legacy_registrations
  ADD COLUMN source_hash text,
  ADD COLUMN last_synced_at timestamptz,
  ADD COLUMN missing_since timestamptz;

COMMENT ON COLUMN public.legacy_registrations.missing_since IS
  'Set when a later sync no longer sees this record in enforma. The row is kept and shown for review.';

CREATE TABLE public.legacy_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  source_count integer,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  unchanged_count integer NOT NULL DEFAULT 0,
  disappeared_count integer NOT NULL DEFAULT 0,
  reappeared_count integer NOT NULL DEFAULT 0,
  conflict_count integer NOT NULL DEFAULT 0,
  error_message text,
  CONSTRAINT ck_legacy_sync_runs_status
    CHECK (status IN ('RUNNING', 'SUCCESS', 'ERROR'))
);

COMMENT ON TABLE public.legacy_sync_runs IS
  'One attempt to read enforma and update the legacy mirror. The dashboard shows the latest success and the latest error.';

CREATE TABLE public.legacy_registration_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_registration_id uuid,
  original_record_id text NOT NULL,
  sync_run_id uuid NOT NULL REFERENCES public.legacy_sync_runs (id),
  change_type text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_legacy_registration_revisions_change
    CHECK (change_type IN ('INSERTED', 'UPDATED', 'DISAPPEARED', 'REAPPEARED', 'CONFLICT'))
);

COMMENT ON TABLE public.legacy_registration_revisions IS
  'Append-only history of what each sync changed. Rows are not updated or deleted.';

CREATE TABLE public.legacy_field_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_registration_id uuid NOT NULL REFERENCES public.legacy_registrations (id),
  field_name text NOT NULL,
  override_value text NOT NULL,
  source_value_at_override text NOT NULL,
  conflict boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_legacy_field_overrides UNIQUE (legacy_registration_id, field_name),
  CONSTRAINT ck_legacy_field_overrides_field
    CHECK (field_name IN ('amount_cents', 'commercial_status', 'normalized_product_code', 'original_payment_id'))
);

COMMENT ON TABLE public.legacy_field_overrides IS
  'A local correction. Sync updates the mirror but never replaces override_value. If the source value changes, conflict is set and the local value stays.';

CREATE TABLE public.manual_sale_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders (id),
  resolution text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_manual_sale_resolutions_kind
    CHECK (resolution = 'MANUAL_SALE')
);

COMMENT ON TABLE public.manual_sale_resolutions IS
  'Marks an order that was settled by hand, such as Los Toros. Counts as one sale. Does not issue, reissue, or revoke a ticket.';

ALTER TABLE public.legacy_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_sync_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_registration_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_registration_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_field_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_field_overrides FORCE ROW LEVEL SECURITY;
ALTER TABLE public.manual_sale_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_sale_resolutions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.legacy_sync_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.legacy_registration_revisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.legacy_field_overrides FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.manual_sale_resolutions FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.legacy_revisions_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'legacy_registration_revisions is append-only';
END;
$$;

CREATE TRIGGER legacy_revisions_no_mutation
  BEFORE UPDATE OR DELETE ON public.legacy_registration_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.legacy_revisions_append_only();

CREATE FUNCTION public.legacy_sync_apply(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run uuid;
  v_batch uuid;
  v_event_id uuid;
  v_action jsonb;
  v_row jsonb;
  v_registration uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_disappeared integer := 0;
  v_reappeared integer := 0;
  v_conflicts integer := 0;
  v_kind text;
BEGIN
  IF p_payload ? 'error' THEN
    INSERT INTO public.legacy_sync_runs (status, finished_at, error_message, source_count)
    VALUES ('ERROR', now(), left(p_payload->>'error', 500), NULLIF(p_payload->>'sourceCount', '')::integer)
    RETURNING id INTO v_run;
    RETURN jsonb_build_object('ok', false, 'runId', v_run);
  END IF;

  SELECT id INTO v_event_id FROM public.events WHERE code = 'HEX-2026';
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'missing HEX-2026 event';
  END IF;

  INSERT INTO public.legacy_sync_runs (status, source_count)
  VALUES ('RUNNING', COALESCE(jsonb_array_length(p_payload->'actions'), 0))
  RETURNING id INTO v_run;

  INSERT INTO public.legacy_import_batches (
    source_system, source_reference, total_source_rows,
    inserted_count, matched_existing_count, skipped_duplicate_count,
    review_required_count, failed_count
  ) VALUES (
    'LEGACY_HYBRID_REGISTRO', 'enforma-sync', COALESCE((p_payload->>'sourceCount')::integer, 0),
    0, 0, 0, 0, 0
  ) RETURNING id INTO v_batch;

  FOR v_action IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'actions', '[]'::jsonb))
  LOOP
    v_kind := v_action->>'kind';
    v_row := v_action->'row';

    IF v_kind = 'conflict' THEN
      UPDATE public.legacy_field_overrides AS override
      SET conflict = true
      FROM public.legacy_registrations AS registration
      WHERE registration.id = override.legacy_registration_id
        AND registration.source_system = 'LEGACY_HYBRID_REGISTRO'
        AND registration.original_record_id = v_action->>'recordId'
        AND override.field_name = v_action->>'field';
      INSERT INTO public.legacy_registration_revisions (
        original_record_id, sync_run_id, change_type, snapshot
      ) VALUES (
        v_action->>'recordId', v_run, 'CONFLICT', v_action
      );
      v_conflicts := v_conflicts + 1;

    ELSIF v_kind = 'disappear' THEN
      UPDATE public.legacy_registrations
      SET missing_since = now(), last_synced_at = now()
      WHERE source_system = 'LEGACY_HYBRID_REGISTRO'
        AND original_record_id = v_action->>'recordId'
        AND missing_since IS NULL
      RETURNING id INTO v_registration;
      INSERT INTO public.legacy_registration_revisions (
        legacy_registration_id, original_record_id, sync_run_id, change_type, snapshot
      ) VALUES (
        v_registration, v_action->>'recordId', v_run, 'DISAPPEARED', v_action
      );
      v_disappeared := v_disappeared + 1;

    ELSIF v_kind = 'unchanged' THEN
      UPDATE public.legacy_registrations
      SET last_synced_at = now()
      WHERE source_system = 'LEGACY_HYBRID_REGISTRO'
        AND original_record_id = v_action->>'recordId';
      v_unchanged := v_unchanged + 1;

    ELSIF v_kind IN ('insert', 'update', 'reappear') THEN
      IF v_kind = 'insert' THEN
        INSERT INTO public.legacy_registrations (
          event_id, event_code, source_system, original_record_id, original_status,
          commercial_status, import_disposition, review_reason, original_created_at,
          original_updated_at, original_name, original_email, original_phone,
          category_code_raw, category_name_raw, category_block_raw, team_name_raw,
          participants_raw, normalized_product_code, amount_cents, currency,
          original_payment_id, notes_raw, raw_source_snapshot, import_batch_id,
          source_hash, last_synced_at, missing_since
        ) VALUES (
          v_event_id, 'HEX-2026', 'LEGACY_HYBRID_REGISTRO', v_action->>'recordId',
          v_row->>'originalStatus', NULLIF(v_row->>'commercialStatus', ''),
          v_row->>'importDisposition', NULLIF(v_row->>'reviewReason', ''),
          NULLIF(v_row->>'originalCreatedAt', '')::timestamptz,
          NULLIF(v_row->>'originalUpdatedAt', '')::timestamptz,
          NULLIF(v_row->>'originalName', ''), NULLIF(v_row->>'originalEmail', ''),
          NULLIF(v_row->>'originalPhone', ''), NULLIF(v_row->>'categoryCode', ''),
          NULLIF(v_row->>'categoryName', ''), NULLIF(v_row->>'categoryBlock', ''),
          NULLIF(v_row->>'teamName', ''), NULLIF(v_row->>'participants', ''),
          NULLIF(v_row->>'normalizedProductCode', ''),
          NULLIF(v_row->>'amountCents', '')::bigint, NULLIF(v_row->>'currency', ''),
          NULLIF(v_row->>'originalPaymentId', ''), NULLIF(v_row->>'notes', ''),
          COALESCE(v_row->'snapshot', '{}'::jsonb), v_batch,
          v_action->>'nextHash', now(), NULL
        ) RETURNING id INTO v_registration;
        v_inserted := v_inserted + 1;
      ELSE
        UPDATE public.legacy_registrations
        SET original_status = v_row->>'originalStatus',
            commercial_status = NULLIF(v_row->>'commercialStatus', ''),
            import_disposition = v_row->>'importDisposition',
            review_reason = NULLIF(v_row->>'reviewReason', ''),
            original_updated_at = NULLIF(v_row->>'originalUpdatedAt', '')::timestamptz,
            original_name = NULLIF(v_row->>'originalName', ''),
            original_email = NULLIF(v_row->>'originalEmail', ''),
            original_phone = NULLIF(v_row->>'originalPhone', ''),
            category_code_raw = NULLIF(v_row->>'categoryCode', ''),
            category_name_raw = NULLIF(v_row->>'categoryName', ''),
            category_block_raw = NULLIF(v_row->>'categoryBlock', ''),
            team_name_raw = NULLIF(v_row->>'teamName', ''),
            participants_raw = NULLIF(v_row->>'participants', ''),
            normalized_product_code = NULLIF(v_row->>'normalizedProductCode', ''),
            amount_cents = NULLIF(v_row->>'amountCents', '')::bigint,
            currency = NULLIF(v_row->>'currency', ''),
            original_payment_id = NULLIF(v_row->>'originalPaymentId', ''),
            notes_raw = NULLIF(v_row->>'notes', ''),
            raw_source_snapshot = COALESCE(v_row->'snapshot', raw_source_snapshot),
            source_hash = v_action->>'nextHash',
            last_synced_at = now(),
            missing_since = NULL
        WHERE source_system = 'LEGACY_HYBRID_REGISTRO'
          AND original_record_id = v_action->>'recordId'
        RETURNING id INTO v_registration;
        IF v_kind = 'reappear' THEN
          v_reappeared := v_reappeared + 1;
        ELSE
          v_updated := v_updated + 1;
        END IF;
      END IF;

      INSERT INTO public.legacy_registration_revisions (
        legacy_registration_id, original_record_id, sync_run_id, change_type, snapshot
      ) VALUES (
        v_registration,
        v_action->>'recordId',
        v_run,
        CASE v_kind WHEN 'insert' THEN 'INSERTED' WHEN 'reappear' THEN 'REAPPEARED' ELSE 'UPDATED' END,
        v_action
      );
    END IF;
  END LOOP;

  UPDATE public.legacy_sync_runs
  SET status = 'SUCCESS',
      finished_at = now(),
      inserted_count = v_inserted,
      updated_count = v_updated,
      unchanged_count = v_unchanged,
      disappeared_count = v_disappeared,
      reappeared_count = v_reappeared,
      conflict_count = v_conflicts
  WHERE id = v_run;

  UPDATE public.legacy_import_batches
  SET inserted_count = v_inserted,
      matched_existing_count = v_updated + v_reappeared,
      skipped_duplicate_count = v_unchanged,
      review_required_count = v_conflicts + v_disappeared
  WHERE id = v_batch;

  RETURN jsonb_build_object(
    'ok', true,
    'runId', v_run,
    'inserted', v_inserted,
    'updated', v_updated,
    'unchanged', v_unchanged,
    'disappeared', v_disappeared,
    'reappeared', v_reappeared,
    'conflicts', v_conflicts
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.legacy_sync_runs (status, finished_at, error_message)
  VALUES ('ERROR', now(), left(SQLERRM, 500));
  RETURN jsonb_build_object('ok', false, 'error', left(SQLERRM, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.legacy_sync_apply(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.legacy_revisions_append_only() FROM PUBLIC, anon, authenticated;

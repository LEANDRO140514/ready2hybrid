-- Rollback for 0048_meta-capi-outbox.sql. Safe at any time: nothing else
-- depends on these objects. Turn the schedule off first (see RUNBOOK.md).
DROP FUNCTION IF EXISTS public.meta_capi_claim_batch_tx(jsonb);
DROP FUNCTION IF EXISTS public.meta_capi_enqueue_tx(jsonb);
DROP TABLE IF EXISTS public.meta_capi_outbox;

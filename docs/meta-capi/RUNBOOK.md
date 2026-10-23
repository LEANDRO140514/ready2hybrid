# Meta Conversions API (Purchase) — runbook

Status: **prepared, not deployed, not applied.** Nothing here has touched production.

## What it does

`meta-capi-sync` is a new, scheduled edge function. Every run it:

1. queues approved, paid, non-zero orders approved at or after `META_CAPI_SINCE` (`meta_capi_enqueue_tx`);
2. claims up to 25 due rows (`meta_capi_claim_batch_tx`, `SKIP LOCKED`);
3. sends one `Purchase` per request to Meta with `event_id = orders.tracking_ref`, so Meta can deduplicate it against the browser Pixel event that already uses the same value as `eventID`;
4. records `SENT`, `RETRY` (backoff 5 min doubling, capped at 2 h, 6 attempts), `FAILED` or `SKIPPED`.

It never touches checkout, `webhook_apply_payment_tx`, tickets or emails. It only reads `orders`, `payments`, `order_items`, `buyer_contacts` and `order_attribution_snapshots`, and writes only `meta_capi_outbox`.

## What each event carries

- `event_time` = latest approved payment time (Meta rejects events older than 7 days; those are `SKIPPED: TOO_OLD`).
- `custom_data`: `value` in pesos, `currency` MXN, product codes.
- `user_data`: hashed `external_id` (pseudonymous contact id) always; hashed email and phone **only when the buyer gave marketing consent** (`contact_consent_at`); `fbc` when the stored touch has an `fbclid`.
- No raw email, phone, name or roster. Logs carry counts and outbox ids only.

## Open items that must be settled before going live

1. **`action_source`.** Meta requires `client_user_agent` for `website` events and we do not have the buyer's user agent when the payment is approved. The default is therefore `system_generated`. **Validate in Test Events that Meta marks the server event as deduplicated against the browser `Purchase` with the same `event_id`.** If it does not, do not go live: it would double count purchases.
2. **Consent and privacy notice.** The notice does not name advertising or Meta. Decide with legal before sending hashed email/phone.
3. **Graph API version.** Default `v23.0`, overridable with `META_GRAPH_VERSION`. Confirm it is current when deploying.
4. **No backfill.** `META_CAPI_SINCE` is mandatory and nothing before it is queued. Meta deduplicates only within 48 hours, so replaying older purchases would double count the ones the Pixel already saw.

## Configuration (secrets and variables)

Set by the owner. The access token is created in Events Manager (dataset 1274781161363578, Settings, Conversions API, generate access token) and must be loaded by the owner as a secret; it must never be pasted into chat, code, logs or this file.

| Name | Purpose |
|---|---|
| `META_CAPI_ENABLED` | `true` to run. Anything else = no-op. |
| `META_CAPI_DATASET_ID` | Dataset id (digits). |
| `META_CAPI_ACCESS_TOKEN` | Secret. Conversions API token. |
| `META_CAPI_SINCE` | ISO time. Only purchases approved at or after it are queued. |
| `META_CAPI_SCHEDULE_SECRET` | Secret. Bearer the schedule sends; the function rejects anything else. |
| `META_CAPI_TEST_EVENT_CODE` | Optional. While set, the run is in **test** mode: events carry the code, never count for ads, and use their own outbox rows. |
| `META_CAPI_ACTION_SOURCE` | Optional. `system_generated` (default), `website` or `other`. |
| `META_CAPI_EVENT_SOURCE_URL` | Optional. Defaults to the landing URL. |
| `META_GRAPH_VERSION` | Optional. Defaults to `v23.0`. |

## Order of operations (each step needs explicit approval)

1. Record the current deployments for rollback (landing is untouched; this adds a new function and table only).
2. Apply `insforge/migrations/0048_meta-capi-outbox.sql` after a dry run that only checks the objects do not exist yet.
3. Deploy the function from the committed bundle:

   ```bash
   npx -y @insforge/cli functions deploy meta-capi-sync --file insforge/functions/meta-capi-sync/handler.deploy.js
   ```

4. Create the schedule (the function stays a no-op until `META_CAPI_ENABLED=true`):

   ```bash
   npx -y @insforge/cli schedules create --name "meta-capi-sync" --cron "*/5 * * * *" --url "https://4bg9ufz2.us-east.insforge.app/functions/meta-capi-sync" --method POST --headers '{"Authorization": "Bearer ${{secrets.META_CAPI_SCHEDULE_SECRET}}"}'
   ```

5. **Test phase.** Set `META_CAPI_TEST_EVENT_CODE`, `META_CAPI_SINCE` slightly before the next expected real sale, and `META_CAPI_ENABLED=true`. In Events Manager, Test Events, confirm for a real approved order: the server `Purchase` arrives, `event_id` matches, value and currency are right, and Meta shows it as **deduplicated** with the browser event.
6. **Go live.** Remove `META_CAPI_TEST_EVENT_CODE`. Live rows are independent from test rows, so test sends never block real ones.

## Smoke test and monitoring

- Response body of a run: `{status, mode, enqueued, claimed, sent, retry, failed, skipped}`. Check it with `schedules logs <id>`.
- Compare approved sales against `meta_capi_outbox` rows with `status = 'SENT'` and `delivery_mode = 'live'`. They should match once per order.
- `FAILED` rows hold a sanitized, truncated Meta error in `last_error`; a `401/403` means the token is wrong or expired.

## Rollback

Safe at any time; nothing else depends on these objects.

1. Set `META_CAPI_ENABLED` to `false` (immediate, no redeploy) or delete the schedule.
2. Remove the function: `npx -y @insforge/cli functions delete meta-capi-sync`.
3. Optionally drop the objects with `docs/meta-capi/0048-rollback.sql`.

## Phase 2 (not in this change)

- Capture the buyer's user agent and IP at checkout to allow `action_source = website` and better matching.
- `InitiateCheckout` server events.
- Surface outbox health in ops.

# IMPL-8 — Signed Idempotent Webhook Implementation Validation Evidence

```text
Unit: IMPL-8 — Signed idempotent Mercado Pago webhook (mp-webhook)
Mode: SERVER-SIDE TX-2 · NO SALES OPEN · NO PREFERENCES · NO PAYMENTS · NO IMPL-9
Local datetime (America/Merida): 2026-07-25 ~01:35 -06:00
Baseline HEAD: d6ec806
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Deployment slug: enforma
Technical result: TECHNICAL PASS / CONFIGURATION_DEFERRED
Human closure: PENDING
Gate: READY_FOR_IMPL_8_HUMAN_CLOSURE
```

## 1. Baseline Git

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `d6ec806` |
| origin/main | `d6ec806` |
| Divergence | `0 / 0` |
| Working tree (pre-impl) | clean |

## 2. Authority

Governing sources: SPEC-000/001/030/031/032 APPROVED; IMPL-5/6/7 CLOSED;
Project Owner authorization `AUTHORIZED_FOR_IMPL_8_SIGNED_IDEMPOTENT_WEBHOOK`.

Primary operation: implement TX-2 signed, verified, idempotent webhook processing.

## 3. Requirements

| Requirement | Authority | Implementation | Test | Remote | Evidence | State |
|---|---|---|---|---|---|---|
| SPEC-031 R022 signature-before-effects | SPEC-031 | `signature.ts` + orchestrate gate | unit signature/orchestrate | smoke 401 | this file | PASS |
| SPEC-031 R023 provider query authority | SPEC-031 | `payments.ts` GET `/v1/payments/{id}` | unit mock | not exercised (no valid remote sig) | this file | PASS |
| SPEC-031 R024 idempotency / retries | SPEC-031/032 | `webhook_events` unique notification id | unit duplicate + later update | 0 rows | this file | PASS |
| SPEC-031 R025 state coverage | SPEC-031 | normalize + RPC matrix | unit status map | n/a | this file | PASS |
| SPEC-032 R038 TX-2 | SPEC-032 | RPC `webhook_apply_payment_tx` | static + unit apply path | v6 applied | this file | PASS |
| SPEC-032 R042 late/expired hold | SPEC-032 | REQUIRES_REVIEW + CONFLICT + outbox alert | SQL path | not remote-exercised | this file | PASS |
| SPEC-032 R047 audit/outbox | SPEC-032 | activity_log + INTERNAL_ALERT outbox only | SQL static | 0 jobs | this file | PASS |
| SPEC-032 R055 verification record | SPEC-032 | `payment_verification_records` before effects | SQL | 0 rows | this file | PASS |
| Real MP panel webhook URL/secret | Owner panel | deferred | n/a | secret absent | this file | DEFERRED TO IMPL-12 OR SEPARATE AUTHORIZED UNIT |

## 4. Scope / non-goals

In scope: `mp-webhook`, official `x-signature` validation, payment query client, TX-2 RPC, unit/static tests, deploy, negative remote smokes.

Out of scope: open sales, landing, preferences, sandbox/production payments, panel webhook configuration, public order state, tickets/QR/email delivery, IMPL-9+.

## 5. Contradiction scan

- Body payment status/amount are never authority; API query is.
- Registration SQL has no CHECK enum; transitions use SPEC literals safely.
- API-OD-002 exact statuses: chosen matrix documented below (401 signature, 503 config/provider, 200 ack).
- Hold TTL remains env/config from IMPL-7; late approved payment uses R042 review path (not invented confirmation).

## 6. Diagnosis (IMPL-7 / runtime)

| Item | Finding |
|---|---|
| Checkout function | `mp-create-checkout` Deno + bundled `handler.deploy.js` |
| Shared checkout | reused patterns only; **not modified** (no checkout redeploy) |
| MP client prior | preference create only |
| New shared modules | `_shared/mercadopago/*`, `_shared/webhook/*` |
| Bundling | esbuild single-file (`bundle:webhook`) |
| Next migration | **0006** (after remote v5) |
| Secrets | `MERCADOPAGO_ACCESS_TOKEN` present; `MERCADOPAGO_WEBHOOK_SECRET` absent |

## 7. Paths

```text
insforge/functions/_shared/mercadopago/signature.ts
insforge/functions/_shared/mercadopago/payments.ts
insforge/functions/_shared/webhook/errors.ts
insforge/functions/_shared/webhook/config.ts
insforge/functions/_shared/webhook/normalize.ts
insforge/functions/_shared/webhook/orchestrate.ts
insforge/functions/mp-webhook/index.ts
insforge/functions/mp-webhook/handler.deploy.js
insforge/migrations/0006_webhook_payment_transaction.sql
scripts/bundle-mp-webhook.mjs
tests/unit/webhook/*
package.json
docs/implementation/evidence/IMPL-8-SIGNED-IDEMPOTENT-WEBHOOK-IMPLEMENTATION-VALIDATION.md
docs/implementation/IMPL-0-SALES-IMPLEMENTATION-TRACEABILITY.md
WORKSPACE_STATUS.md
```

## 8. HTTP contract

| Case | Status | Body |
|---|---|---|
| Non-POST | 405 | `METHOD_NOT_ALLOWED` |
| Malformed JSON | 400 | `INVALID_REQUEST` |
| Missing/invalid signature | 401 | `UNAUTHORIZED` |
| Secret absent | 503 | `WEBHOOK_NOT_CONFIGURED` |
| Unsupported topic | 200 | `{ ok:true, ignored:true }` (no domain effects) |
| Duplicate processed notification | 200 | `{ ok:true, replay:true, outcome:DUPLICATE }` |
| Applied / verification rejected ack | 200 | `{ ok:true, applied:boolean, outcome }` |
| Provider transient failure | 503 | `PROVIDER_UNAVAILABLE` retry OPTIONAL |

## 9. Signature validation

Official Without-SDK contract (Mercado Pago Webhooks docs):

```text
manifest = id:{data.id_lower};request-id:{x-request-id};ts:{ts};
HMAC-SHA256(secret, manifest) hex == v1
constant-time compare
```

Ready2Hybrid requires `x-signature`, `x-request-id`, and `data.id` (fail closed). Missing signature is rejected before secret/config lookups for smoke safety.

Official source consulted: Mercado Pago Developers — Webhooks / Checkout Pro notifications (México).

## 10. Secret boundary

- Consumes `MERCADOPAGO_WEBHOOK_SECRET` from InsForge Secrets only.
- Never hardcoded, logged, returned, or committed.
- Remote secret currently absent → fail-closed `WEBHOOK_NOT_CONFIGURED`.
- Unit tests use in-memory fake secret only.

## 11. Canonical payment query

After signature: `GET https://api.mercadopago.com/v1/payments/{id}` with server Access Token.

Verified against order: `external_reference`, `amount_cents == order.total_cents`, `currency == MXN`, optional live_mode/collector checks when configured.

## 12. Idempotency / later updates / out-of-order

- Delivery identity: `provider_notification_id = x-request-id` unique per `(provider, notification_id)`.
- Duplicate PROCESSED → replay 200, no second effects.
- Later legitimate update → new notification id → re-query API → monotonic payment rank (no regress APPROVED→PENDING).
- Body cannot roll back canonical state.

## 13. State matrix (internal)

| Provider | normalized_state | Order effect | Hold | Registration | Outbox |
|---|---|---|---|---|---|
| approved (active hold) | APPROVED | PAID | CONVERTED | PAYMENT_CONFIRMED | no |
| approved (expired/released hold) | APPROVED | REQUIRES_REVIEW | CONFLICT | unchanged | INTERNAL_ALERT |
| pending | PENDING | PAYMENT_PENDING if early | retain ACTIVE | no confirm | no |
| rejected/cancelled | REJECTED/CANCELLED | terminal if payable | RELEASED | CANCELLED if early | no |
| refunded/charged_back | REFUNDED/CHARGED_BACK | from PAID/REVIEW | no ticket revoke | no | INTERNAL_ALERT |

Tickets/QR/email delivery: never created in this unit.

## 14. TX-2 design

```text
signature valid
→ query MP payment
→ webhook_apply_payment_tx:
   receipt/dedupe webhook_events
   payment_verification_records (always)
   on mismatch: process webhook, audit, no PAID
   on verify: upsert payments, transition order/hold/registration, activity_log, optional INTERNAL_ALERT outbox
```

## 15. Migration 0006

| Item | Value |
|---|---|
| File | `insforge/migrations/0006_webhook_payment_transaction.sql` |
| Remote | `v6 webhook-payment-transaction` |
| Adapter transform | outer BEGIN/COMMIT stripped only |
| Tables/columns/policies | 0 |
| EXECUTE | `project_admin` only; revoked PUBLIC/anon/authenticated |

## 16. Tests / regression

| Suite | Result |
|---|---|
| Vitest total | 59 passed |
| Webhook unit/static | signature + orchestrate + migration guards |
| lint / typecheck / build | PASS |
| MP in tests | mocked |

## 17. Deploy

| Item | Value |
|---|---|
| Function | `mp-webhook` only |
| Inventory | `mp-create-checkout`, `mp-webhook` (both active) |
| Checkout redeploy | 0 |
| Project | ready2hybrid / `4bg9ufz2.us-east` / `enforma` |

## 18. Remote operations

```text
InsForge writes:
- migration apply = 1 (0006)
- edge function deploy = 1 (mp-webhook)
- other writes = 0

Mercado Pago writes = 0
preferences = 0
payments = 0
refunds = 0
```

## 19. Negative smokes

| Smoke | Result |
|---|---|
| GET | 405 METHOD_NOT_ALLOWED |
| POST without x-signature | 401 UNAUTHORIZED |
| POST with signature shape, secret absent | 503 WEBHOOK_NOT_CONFIGURED |

Counts before/after (all zero transactional; event `CONFIGURADO`; products 28):

```text
orders=0 registrations=0 capacity_holds=0 payments=0
payment_verification_records=0 webhook_events=0 tickets=0
ticket_credential_generations=0 access_entitlements=0
activity_log=0 outbox_delivery_jobs=0
```

## 20. Protected resources

Landing, catalog, event status, prices/cupos, seed, migrations 0001–0005 content, IMPL-5/6/7 evidence, `mp-create-checkout` code, Storage, other InsForge project: intact.

## 21. Limitations / deferred configuration

- Real Mercado Pago webhook URL + secret configuration: **DEFERRED TO IMPL-12 OR SEPARATE AUTHORIZED UNIT**.
- Successful remote signed notification path not exercised (would require secret + real/sandbox payment).
- No public order status endpoint (IMPL-9).

## 22. Rollback (manual, not auto-executed)

1. Delete/disable `mp-webhook`.
2. Drop `webhook_apply_payment_tx` if required.
3. Confirm transactional tables remain empty.
4. Confirm `mp-create-checkout` unchanged.
5. Confirm no Mercado Pago panel changes by this unit.

## 23. Recommended gate

```text
READY_FOR_IMPL_8_HUMAN_CLOSURE
IMPL-8 = TECHNICAL_PASS / PENDING HUMAN CLOSURE
IMPL-9 = NOT_STARTED / NOT AUTHORIZED
```

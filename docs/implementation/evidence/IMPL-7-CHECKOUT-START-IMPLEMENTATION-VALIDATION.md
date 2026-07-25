# IMPL-7 — Checkout Start Implementation Validation Evidence

```text
Unit: IMPL-7 — Implement checkout start (mp-create-checkout)
Mode: SERVER-SIDE TX-1 · NO SALES OPEN · NO WEBHOOK · NO IMPL-8
Local datetime (America/Merida): 2026-07-25 ~01:10 -06:00
Baseline HEAD: 8fd4093
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Deployment slug: enforma
Technical result: TECHNICAL PASS
Human closure: APPROVED 2026-07-25
Final status: VALIDATED / CLOSED
Gate: READY_FOR_IMPL_8_AUTHORIZATION
```

## 1. Baseline Git

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `8fd4093` |
| origin/main | `8fd4093` |
| Divergence | `0 / 0` |
| Working tree (pre-impl) | clean |

## 2. Authority

Governing sources: SPEC-000/001/030/031/032 APPROVED; IMPL-5/IMPL-6 CLOSED;
Project Owner authorization `AUTHORIZED_FOR_IMPL_7_CHECKOUT_START`.

Primary operation: implement TX-1 checkout start only.

## 3. Runtime diagnosis

| Item | Finding |
|---|---|
| Functions convention | Deno edge functions; `export default async (req) => Response` |
| Deploy | `npx @insforge/cli@0.2.1 functions deploy <slug> --file <single-file>` |
| Secrets | CLI `secrets` (metadata only inspected); `MERCADOPAGO_ACCESS_TOKEN` exists |
| DB privilege for mutations | Admin client (`API_KEY` / `project_admin`) bypasses RLS |
| Transaction support | Postgres RPC `SECURITY DEFINER` (migration 0005) |
| Existing MP SDK in repo | none prior; HTTP Checkout Pro client implemented |
| Tests | Vitest unit suite under `tests/unit/checkout` |
| Next migration number | local 0001–0003; remote v4 catalog adapter; **0005** used (no local 0004) |

## 4. Scope / non-goals

In scope: `mp-create-checkout`, TX-1 local durable pending state, MP preference creation path (mocked in tests), fail-closed config, negative remote smoke.

Out of scope: open sales, landing wiring, webhook, payment confirmation, tickets/QR, IMPL-8, real/sandbox preference creation during remote validation.

## 5. Requirements implemented (catalog → commerce start)

| Requirement | Implementation | Validation | State |
|---|---|---|---|
| SPEC-031 OP-PUB-04 / R009-R010 | public checkout command shape + errors | unit + smoke | PASS |
| SPEC-031 R019 sales/price authority | backend product/event/price; reject client money fields | unit | PASS |
| SPEC-032 R037 TX-1 | durable local RPC before MP preference | code + migration | PASS |
| SPEC-032 R023-R025 / R028 / R034 | order/item/hold/idempotency/capacity lock | migration SQL | PASS |
| SPEC-031 `SALES_NOT_OPEN` | CONFIGURADO / missing `sales_open_at` fail-closed | unit + remote smoke | PASS |
| OD-010 / OD-016 / API-OD-003 | env-required hold TTL, return URLs, idempotency TTL → `CONFIGURATION_ERROR` | unit | PASS |

Checkout/commerce is not “open for sale”; event remains `CONFIGURADO`.

## 6. Open decisions (fail-closed, not invented)

| Decision | Handling |
|---|---|
| OD-010 hold duration | `CHECKOUT_HOLD_DURATION_SECONDS` required |
| OD-016 return URLs | `CHECKOUT_BACK_URL_*` + `CHECKOUT_NOTIFICATION_URL` required |
| API-OD-003 idempotency TTL | `CHECKOUT_IDEMPOTENCY_TTL_SECONDS` required |
| OD-023 sales opening | requires `sales_open_at` + status in `{EN_VENTA,AVAILABLE,OPEN}`; CONFIGURADO always `SALES_NOT_OPEN` |
| OD-005 waiver | competitive journeys require configured waiver type/version env |
| OD-001 quantity | only `1` accepted |

## 7. Paths

```text
insforge/functions/_shared/checkout/*
insforge/functions/mp-create-checkout/index.ts
insforge/functions/mp-create-checkout/handler.deploy.js
insforge/migrations/0005_checkout_start_transaction.sql
scripts/bundle-mp-create-checkout.mjs
tests/unit/checkout/checkout-start.test.ts
package.json / package-lock.json (zod)
docs/implementation/evidence/IMPL-7-CHECKOUT-START-IMPLEMENTATION-VALIDATION.md
docs/implementation/IMPL-0-SALES-IMPLEMENTATION-TRACEABILITY.md
WORKSPACE_STATUS.md
```

## 8. TX-1 design

```text
validate payload (Zod, strict; reject client money fields)
→ load product+event via admin client
→ sales gate (CONFIGURADO => SALES_NOT_OPEN)  [no writes]
→ load fail-closed runtime config
→ checkout_start_tx RPC (FOR UPDATE product/event; capacity; atomic inserts)
→ create Checkout Pro preference (server token)
→ checkout_attach_preference
→ return { checkout_url, public_order_reference, expires_at }
```

On MP failure: `checkout_compensate_preference` releases hold and cancels order.

`external_reference = order_id`.

## 9. Contracts

### Input (authorized fields)

```text
product_code, quantity?=1, idempotency_key,
buyer?, participant?, waiver?, correlation_id?
```

Forbidden client fields include `price`, `price_cents`, `amount`, `total`, `currency`, fee fields.

### Output (success)

```text
checkout_url
public_order_reference
expires_at
```

### Public errors

Normalized codes including `SALES_NOT_OPEN`, `CONFIGURATION_ERROR`, `SOLD_OUT`, `CONFLICT`, `CHECKOUT_CREATION_FAILED`.

## 10. Security

| Control | Result |
|---|---|
| No anon table writes | PASS — mutations via SECURITY DEFINER + project_admin only |
| EXECUTE not granted to PUBLIC/anon | PASS |
| Secrets server-side only | PASS — not returned in responses |
| CORS | no permanent wildcard; optional `CHECKOUT_CORS_ORIGIN` |
| RLS/FORCE unchanged | 24/24 after deploy |
| Policies | still 0 |

## 11. Tests

| Suite | Result |
|---|---|
| Vitest checkout unit tests | 19 passed |
| lint / typecheck / build | PASS |
| MP in tests | mocked |
| Remote preference creation | 0 |

## 12. Migration 0005

| Item | Value |
|---|---|
| Canonical file | `insforge/migrations/0005_checkout_start_transaction.sql` |
| Remote version | `v5 checkout-start-transaction` |
| Transformations for CLI adapter | outer BEGIN/COMMIT stripped only |
| Tables/columns/policies added | 0 |
| Catalog data changed | 0 |

Rollback (manual, not auto-executed): drop the three RPCs; redeploy previous function version or delete `mp-create-checkout`.

## 13. Deploy

| Item | Value |
|---|---|
| Function | `mp-create-checkout` only |
| Other functions | 0 before; 1 after (this slug only) |
| Deployable artifact | `handler.deploy.js` (bundled) |
| Project | ready2hybrid / `4bg9ufz2.us-east` / slug `enforma` |

## 14. Remote operations

```text
InsForge reads: migrations list, SELECT counts/security, secrets metadata, function list/invoke/http smoke
InsForge writes:
- migration apply = 1 (0005)
- edge function deploy = 1 (mp-create-checkout)
- other writes = 0

Mercado Pago writes = 0
preferences created during validation = 0
payments = 0
```

## 15. Negative smoke

| Item | Result |
|---|---|
| Request | POST product `IND-H` while event `CONFIGURADO` |
| Response | HTTP 409 `{ error.code: SALES_NOT_OPEN }` |
| orders/order_items/registrations/holds/payments/tickets/webhooks/buyers/participants/idempotency/activity_log | all 0 before and after |
| Event status | remains `CONFIGURADO` |

## 16. Protected resources

Landing, Mercado Pago account config, storage `landings-images`, migrations 0001–0003, seed blob, IMPL-5/6 evidence: unchanged.

## 17. Limitations

- Successful checkout path requires server env configuration (hold TTL, return URLs, waiver, MP token).
- Concurrent last-cup contention is enforced in SQL (`FOR UPDATE` + active-hold sum); not load-tested remotely in this unit because that would create transactional rows.
- No landing integration.
- No webhook / IMPL-8.

## 18. Recommended gate (technical unit)

```text
READY_FOR_IMPL_7_HUMAN_CLOSURE
IMPL-7 = TECHNICAL_PASS / PENDING HUMAN CLOSURE
IMPL-8 = NOT_STARTED / NOT AUTHORIZED
```

Superseded by human closure below.

## 19. Human closure

```text
Human closure authority:
Leandro Espinosa — Project Owner

Human closure date:
2026-07-25

Technical implementation commit:
3f13c16

Human decision:
APPROVED FOR CLOSURE

Final status:
VALIDATED / CLOSED
```

Closure notes:

- Human approval is based on the technical evidence published in this file and commit `3f13c16`.
- Local and remote tests were not repeated during this closure unit.
- InsForge was not consulted or modified during this closure unit (`reads = 0`, `writes = 0`).
- Mercado Pago was not consulted or modified during this closure unit (`reads = 0`, `writes = 0`).
- Technical results, counts, and conclusions were not altered.
- Approval of IMPL-7 does not authorize IMPL-8.
- Event remains `CONFIGURADO`.
- Sales remain closed.

```text
Gate after human closure:
READY_FOR_IMPL_8_AUTHORIZATION
IMPL-7 = VALIDATED / CLOSED
IMPL-8 = NOT_STARTED / NOT AUTHORIZED
```

# IMPL-9 — Public Order Status Implementation Validation Evidence

```text
Unit: IMPL-9 — Secure public order status (get-order-status)
Mode: READ-ONLY · NO MP · NO WRITES · NO LANDING · NO IMPL-10
Local datetime (America/Merida): 2026-07-25 ~01:51 -06:00
Baseline HEAD: 42d267b
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Deployment slug: enforma
Technical result: TECHNICAL PASS
Human closure: PENDING
Gate: READY_FOR_IMPL_9_HUMAN_CLOSURE
```

## 1. Baseline Git

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `42d267b` |
| origin/main | `42d267b` |
| Divergence | `0 / 0` |
| Working tree (pre-impl) | clean |

## 2. Authority

Governing sources: SPEC-000/001/011/030/031/032 APPROVED; IMPL-5..8 CLOSED;
Project Owner authorization `AUTHORIZED_FOR_IMPL_9_PUBLIC_ORDER_STATUS`.

Primary operation: implement read-only public order status via `get-order-status`.

## 3. Requirements

| Requirement | Authority | Implementation | Test | Remote | State |
|---|---|---|---|---|---|
| SPEC-031 OP-PUB-05 | SPEC-031 | GET by opaque `reference` | unit + smoke | 404 unknown | PASS |
| Public projection states | SPEC-031 A.5 | mapping.ts | unit matrix | n/a | PASS |
| No payment confirmation by lookup | SPEC-031 OP-PUB-05 | read-only; no MP | static + unit | 0 writes | PASS |
| Privacy / minimization | SPEC-031/032 | `{status,terminal,next_poll_after_seconds}` | unit | smoke bodies | PASS |
| Anti-enumeration | SPEC-031 R / auth | format gate + exact eq + 404 | unit + smoke | PASS |
| Cache-Control no-store | auth | handler headers | smoke CACHE=no-store | PASS |

## 4. Scope / non-goals

In scope: `get-order-status`, SPEC-031 mapping, anti-enumeration, polling semantics, deploy, negative smokes.

Out of scope: landing/UI, capability token exchange UI, tickets/QR, MP panel config, checkout/webhook changes, IMPL-10+.

## 5. Contradiction scan

- Authorization prompt listed shorthand statuses (`CONFIRMED`…); **SPEC-031 OP-PUB-05** is approved authority → public statuses use `APPROVED` (not `CONFIRMED`), `AWAITING_PAYMENT`, `REQUIRES_ACTION`, etc.
- OP-PUB-05 mentions opaque access token; this unit implements the authorized `reference=` query using IMPL-7 `tracking_ref` / `public_order_reference`. Capability-bound tightening remains open (API-OD-004) and is not required to close IMPL-9 under this authorization.
- No migration 0007: admin SELECT of `state` by `tracking_ref` is sufficient and avoids schema expansion.

## 6. Diagnosis

| Item | Finding |
|---|---|
| Public reference | `orders.tracking_ref` = `trk_` + UUID hex (32), unique index `uq_orders_tracking_ref` |
| Entropy | UUID v4 (~122 bits); non-sequential; no PII |
| Returned at checkout | `public_order_reference` |
| Internal order states | CREATED, PREFERENCE_PENDING, PAYMENT_PENDING, PAID, REJECTED, CANCELLED, EXPIRED, REQUIRES_REVIEW, REFUNDED, CHARGED_BACK |
| Runtime | Deno edge + esbuild bundle |
| Migration | **none** (0007 not required) |

## 7. Paths

```text
insforge/functions/_shared/public-status/*
insforge/functions/get-order-status/index.ts
insforge/functions/get-order-status/handler.deploy.js
scripts/bundle-get-order-status.mjs
tests/unit/order-status/order-status.test.ts
package.json
docs/implementation/evidence/IMPL-9-PUBLIC-ORDER-STATUS-IMPLEMENTATION-VALIDATION.md
docs/implementation/IMPL-0-SALES-IMPLEMENTATION-TRACEABILITY.md
WORKSPACE_STATUS.md
```

## 8. HTTP contract

```text
GET /functions/get-order-status?reference=<trk_…>
OPTIONS → 204 (CORS preflight)
non-GET → 405
missing/malformed reference → 400 INVALID_REFERENCE
unknown reference → 404 ORDER_NOT_FOUND
found → 200 { status, terminal, next_poll_after_seconds }
unavailable → 503
```

Headers: `Content-Type: application/json`, `Cache-Control: no-store`.

## 9. Reference / anti-enumeration

- Pattern: `^trk_[0-9a-f]{32}$`
- Exact equality on `tracking_ref` only
- No partial search, email, phone, or internal IDs
- Homogeneous error taxonomy (400 vs 404 as authorized)

## 10. Internal → public mapping

| Internal (`orders.state`) | Public (SPEC-031) | Terminal (payment UX) |
|---|---|---|
| CREATED | CREATING | false |
| PREFERENCE_PENDING | AWAITING_PAYMENT | false |
| PAYMENT_PENDING | AWAITING_PAYMENT | false |
| PAID | APPROVED | true |
| REJECTED | REJECTED | true |
| CANCELLED | CANCELLED | true |
| EXPIRED | EXPIRED | true |
| REQUIRES_REVIEW | REQUIRES_ACTION | false |
| REFUNDED | REFUNDED | true |
| CHARGED_BACK | CHARGED_BACK | true |
| unknown | REQUIRES_ACTION | false |

`REQUIRES_ACTION` is **not** treated as terminal (per authorization / no approved terminal assumption).

## 11. Response contract

```json
{
  "status": "AWAITING_PAYMENT",
  "terminal": false,
  "next_poll_after_seconds": 3
}
```

Poll interval from `ORDER_STATUS_POLL_SECONDS` (default 3). No PII, IDs, amounts, tickets, QR, or provider payloads.

## 12. Polling / read-only

- Repeated GET: same logical body when state unchanged
- Canonical update visible on next read
- Domain writes = 0; activity_log/outbox not written; Mercado Pago not called

## 13. Tests / regression

| Suite | Result |
|---|---|
| Vitest total | 87 passed |
| lint / typecheck / build | PASS |
| Migration 0007 | not created |

## 14. Deploy

| Item | Value |
|---|---|
| Function | `get-order-status` only |
| Inventory | `mp-create-checkout`, `mp-webhook`, `get-order-status` (all active) |
| Checkout/webhook redeploy | 0 |
| migration apply | 0 |

## 15. Remote operations

```text
InsForge writes:
- migration apply = 0
- edge function deploy = 1 (get-order-status)
- other writes = 0

Mercado Pago reads = 0
Mercado Pago writes = 0
```

## 16. Negative smokes

| Smoke | Result |
|---|---|
| POST | 405 + `Cache-Control: no-store` |
| GET no reference | 400 INVALID_REFERENCE |
| GET malformed | 400 INVALID_REFERENCE |
| GET unknown opaque | 404 ORDER_NOT_FOUND |

Counts before/after: all transactional tables **0**; products **28**; event **CONFIGURADO**.

## 17. Deferred MP panel

```text
Mercado Pago webhook URL/secret = DEFERRED / NOT AUTHORIZED
```

Unchanged by IMPL-9.

## 18. Rollback

Delete/disable `get-order-status`. No migration to reverse. Confirm no domain rows created.

## 19. Recommended gate

```text
READY_FOR_IMPL_9_HUMAN_CLOSURE
IMPL-9 = TECHNICAL_PASS / PENDING HUMAN CLOSURE
IMPL-10 = NOT_STARTED / NOT AUTHORIZED
```

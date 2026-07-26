# IMPL-12 — Remaining Cases B–E Sandbox Validation

```text
Unit: IMPL-12 remaining cases B–E
Mode: VALIDATE ONLY · ISOLATED BRANCH · MP TEST · NO CODE CHANGE · NO MIGRATION · NO SPEC CHANGE · NO FRONTEND
Local datetime (America/Merida): 2026-07-26
Baseline HEAD: 592569e
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Sandbox branch: impl12-remaining-cases-20260726 (appkey 4bg9ufz2-b3i) — DELETED
Result: PARTIAL_RUNTIME_PASS / PENDING_CASE_BLOCKED_BY_PROVIDER_SANDBOX / NOT CLOSED
Gate: READY_FOR_IMPL_12_PENDING_CASE_VALIDATION_DECISION
IMPL-12: PARTIAL_RUNTIME_PASS / PENDING_CASE_BLOCKED_BY_PROVIDER_SANDBOX / NOT CLOSED
IMPL-13: NOT_STARTED / NOT AUTHORIZED
```

## 1. Baseline Git

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD / origin/main | `592569e` |
| Divergence | `0 / 0` |
| Working tree | clean (evidence commit follows) |

## 2. Authority

| Item | Value |
|---|---|
| Human authorization | Leandro Espinosa — Project Owner |
| Gate initial | `AUTHORIZED_FOR_IMPL_12_REMAINING_CASES_EXECUTION` |
| Panel confirm | `MP_PANEL_DISABLED_CONFIRMED` before writes |
| Closure decision | Human — no third CONT attempt; Case E = provider sandbox block |
| Code / migrations / specs | none modified |

## 3. Main snapshot before

| Item | Value |
|---|---|
| Event | CONFIGURADO |
| Products | 28 |
| Migrations | v1–v9 |
| Functions | 5 |
| Transactional rows | 0 |

## 4. Branch isolation

| Item | Value |
|---|---|
| Name | `impl12-remaining-cases-20260726` |
| Appkey | `4bg9ufz2-b3i` |
| Host | `https://4bg9ufz2-b3i.us-east.insforge.app` |
| Isolation probe | PASS (branch-only secret absent on Main) |
| Event for sales | temporarily `EN_VENTA` on branch only |
| MP callback | pointed at branch `mp-webhook` + topic `payment` during runs |

## 5. Case results

### Case B — team_size=2 (HALF-DOB-MM) — PASS

| Step | Observed |
|---|---|
| Product / amount | HALF-DOB-MM · $1,600 MXN |
| Human payment | Operación `#169754941707` · accredited · TEST (`Mercadopago*fake`) |
| Hold at webhook | ACTIVE · ~514 s remaining |
| Webhook | HTTP **200** · outcome **`PAID`** |
| After payment | order `PAID` · team `PAID_ROSTER_INCOMPLETE` · tickets/creds/ents = **0** |
| Roster accept (2nd member) | HTTP 200 · `TEAM_ELIGIBLE` |
| After accept | team `ELIGIBLE` · members = 2 · tickets/creds/ents = **2** |
| Duplicate accept | HTTP 200 · idempotent `TEAM_ELIGIBLE` |
| Raw QR columns | 0 |

### Case C — spectator quantity=2 (PUB-VIE) — BLOCKED_BY_OD_001 / EXPECTED FAIL-CLOSED

| Step | Observed |
|---|---|
| Request | `quantity=2` on spectator product |
| HTTP | **400** |
| Error code | `INVALID_REQUEST` |
| Public message | sanitized (“Invalid checkout request.”) |
| Payments | 0 (fail-closed before preference/payment) |
| Classification | OD-001 fail-closed; not a runtime defect |

### Case D — rejected (WOD-H) — PASS

| Step | Observed |
|---|---|
| Product / amount | WOD-H · $300 MXN |
| Human payment | Operación `#169757578259` · card declined (OTHE) |
| Hold at webhook | ACTIVE · ~446 s remaining |
| Webhook | HTTP **200** · outcome **`REJECTED`** |
| Domain | order `REJECTED` · registration `CANCELLED` · hold `RELEASED` · tickets = 0 |

### Case E — pending (CONT) — NOT VALIDATED / PROVIDER_SANDBOX_CONT_NOT_STABLE

Stable `PENDING` could **not** be reproduced in this Checkout Pro sandbox.

#### Attempt E1

| Field | Value |
|---|---|
| Product | PUB-VIE · $250 MXN |
| Cardholder | CONT (+ document filled) |
| UI | processing / “Estamos procesando tu pago” |
| Payment id | `#170644304526` |
| MP API | `rejected` / `cc_rejected_other_reason` |
| Webhook | HTTP **200** · outcome **`REJECTED`** |
| Domain | order `REJECTED` · hold `RELEASED` · tickets/creds/ents = 0 |

#### Attempt E2 (authorized retry; no third attempt)

| Field | Value |
|---|---|
| Product | PUB-VIE · $250 MXN |
| Cardholder | CONT (document omitted per official table `-`) |
| UI | orange processing screen · **no operation number shown** |
| CTA redirect | `example.com/r2h/pending?...&payment_id=169757165885&status=in_process&collection_status=in_process&external_reference=75d39b2a-…` |
| Redirect status | `in_process` |
| MP API at webhook time | `rejected` / `cc_rejected_other_reason` |
| Webhook | HTTP **200** · outcome **`REJECTED`** |
| Domain | order `REJECTED` · hold `RELEASED` · tickets/creds/ents = 0 |

#### Conclusion (Case E)

```text
redirect/UI = in_process / procesando
API Mercado Pago (authoritative) = rejected / cc_rejected_other_reason
Ready2Hybrid webhook = correctly applied REJECTED
hold released; tickets prevented
stable PENDING not reproducible with CONT in this sandbox
NOT a webhook signature / server-side query / REJECTED-path defect
third CONT attempt NOT AUTHORIZED
```

## 6. Payments API note

Direct Payments API card charges with app `APP_USR` test credentials returned HTTP **401** / code **7** (`Unauthorized use of live credentials`). Cases B/D/E therefore used human Checkout Pro (same path as Case A / R4). Not classified as a Ready2Hybrid defect.

## 7. Security checks

| Check | Result |
|---|---|
| Invalid webhook signature | HTTP **401** · `UNAUTHORIZED` |
| Counts unchanged on invalid sig | PASS |
| No raw QR persistence | PASS (Case B) |

## 8. Cleanup

| Action | Result |
|---|---|
| Branch event → CONFIGURADO | PASS |
| MP `save_webhook` topics `[]` + empty callbacks | MCP still reported topic `payment` + stored sandbox URL; **human must verify panel: topics NONE, callback DISABLED** |
| Production webhook | **NOT CONFIGURED** (MCP) |
| Secret regenerated | No (remained masked) |
| Branch delete | `impl12-remaining-cases-20260726` **DELETED** |
| Branch list after delete | empty |

## 9. Main snapshot after

| Item | Value |
|---|---|
| Project / appkey | ready2hybrid / `4bg9ufz2` |
| Event | CONFIGURADO |
| Products | 28 |
| Migrations | **v1–v9** (latest: `fix-webhook-payment-verification-order`) |
| Functions | 5 (`mp-create-checkout`, `mp-webhook`, `get-order-status`, `team-roster`, `ticket-credentials`) |
| Transactional rows | orders/payments/tickets/webhooks/holds/regs/teams/activity = **0** |
| Canonical differences | **0** (Main not used as payment sandbox) |

## 10. Classification (human-approved)

```text
Caso B = PASS
Caso C = BLOCKED_BY_OD_001 / EXPECTED FAIL-CLOSED
Caso D = PASS
Caso E = NOT VALIDATED / PROVIDER_SANDBOX_CONT_NOT_STABLE

IMPL-12 =
PARTIAL_RUNTIME_PASS /
PENDING_CASE_BLOCKED_BY_PROVIDER_SANDBOX /
NOT CLOSED

NOT TECHNICAL_PASS
NOT IMPL_12_VALIDATION_FAILED (no new code defect evidenced)
```

## 11. Separate next decision (not executed)

Options to validate stable `PENDING` without repeating useless CONT payments:

```text
A. official simulator that preserves pending
B. authorized controlled fixture
C. later validation with a real async test method
D. temporarily accept the provider block
```

No option may run without separate human authorization.

## 12. Gate

```text
READY_FOR_IMPL_12_PENDING_CASE_VALIDATION_DECISION
```

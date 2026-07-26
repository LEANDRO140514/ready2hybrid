# IMPL-12-R2 — Sandbox End-to-End Retry Validation Evidence

```text
Unit: IMPL-12-R2 — Full sandbox E2E matrix retry after IMPL-12-R1
Mode: VALIDATE ONLY · ISOLATED INSFORGE BRANCH · MP TEST ONLY · NO CODE CHANGE · NO IMPL-13
Local datetime (America/Merida): 2026-07-25 / 2026-07-26
Baseline HEAD: de10b39
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Sandbox branch: impl12-r2-e2e-20260725 (appkey 4bg9ufz2-yje) — DELETED
Technical result: IMPL_12_VALIDATION_FAILED
Defect class: SCHEMA_RPC_INCONSISTENCY (payment_verification_records.payment_id NOT NULL)
Human closure: NOT APPLICABLE (technical fail)
Final implementation status: VALIDATION_FAILED / NOT CLOSED
Gate: IMPL_12_VALIDATION_FAILED
IMPL-13: NOT_STARTED / NOT AUTHORIZED
```

## 1. Baseline Git

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD (start) | `de10b39` — test(payments): diagnose Checkout Pro sandbox block |
| origin/main (start) | `de10b39` |
| Divergence (start) | `0 / 0` |
| Working tree (start) | clean (local excludes only) |
| Local regression | lint (preexisting deploy-bundle warnings), typecheck, 159 tests, build — PASS |

## 2. Authority

| Item | Value |
|---|---|
| Human authorization | Leandro Espinosa — Project Owner |
| Gate initial | `AUTHORIZED_FOR_IMPL_12_RETRY_EXECUTION` |
| Prior unit | IMPL-12-R1 — `ROOT_CAUSE_ESTABLISHED: BROWSER_SESSION_CONFLICT` |
| Specs | SPEC-000/001/011/030/031/032 APPROVED |
| Constructor | Cursor |
| Classification | Validate implementation; do not patch closed units inside this unit |

## 3. Primary operation

```text
Retry the full IMPL-12 sandbox E2E matrix (Cases A–E + multiday) on an isolated
InsForge branch using Mercado Pago test credentials and the official signed
webhook path. Stop without code/SQL fixes if a system defect blocks validation.
```

## 4. Requirements applicable

| Requirement | Authority | Scenario | Observed | State |
|---|---|---|---|---|
| Isolated sandbox backend | Auth | Branch `impl12-r2-e2e-20260725` | Distinct appkey/URL; isolation probe PASS | PASS |
| Main remains CONFIGURADO | Auth | Canonical snapshots | HEX-2026 CONFIGURADO; products=28; transactional=0 | PASS |
| Test credentials only | Auth | Branch secrets | Test Access Token / collector `3560835739`; production NOT activated | PASS |
| Checkout preference | Auth Case A | `mp-create-checkout` WOD-H | HTTP 200; `init_point`; tracking `trk_61517ecc…`; order `1deabe6d-…` | PASS |
| Payment sandbox approved | Auth Case A + R1 protocol | Chrome Incognito + test buyer + email OTP | APPROVED / accredited; `payment_id=169718949505`; $300 MXN TEST | PASS |
| Webhook secret on branch | Auth + PO delivery | `MERCADOPAGO_WEBHOOK_SECRET` | Configured on branch only; local secret file deleted; value never logged/versioned | PASS |
| Signed webhook apply effects | Auth Case A Tramo B | Signed POST `mp-webhook` | HTTP 500 `INTERNAL_ERROR`; domain payments/tickets/webhooks = 0 | **FAIL** |
| Cases B–E / multiday / idempotency | Auth | Matrix | NOT_RUN (stopped after Case A webhook defect) | NOT_RUN |
| No code/SQL/spec/frontend patch | Auth | Closed units | No implementation patch in this unit | PASS |

## 5. Official Mercado Pago webhook sandbox limitation

Documented and respected:

```text
Payments created with test credentials do not automatically send Webhook notifications.
Notification leg must use the official Webhooks simulator (or equivalent signed POST
using the panel webhook secret and Without-SDK manifest).
```

Case A Tramo A (approved payment) and Tramo B (signed notification) remain distinct.
Tramo B was exercised with a signed POST using the newly configured branch secret.

## 6. InsForge branching

| Item | Result |
|---|---|
| Branch name | `impl12-r2-e2e-20260725` |
| Appkey | `4bg9ufz2-yje` |
| Public URL | `https://4bg9ufz2-yje.us-east.insforge.app` |
| Isolation probe | PASS |
| Branch config | Checkout secrets; test MP token; waiver fixture; HEX-2026 `EN_VENTA` + sales window; invitation TTL |
| Final branch state | DELETED after fail-stop |

## 7. Case A — payment (PASS)

| Field | Sanitized value |
|---|---|
| Product | WOD-H · Workout Experience Hombre |
| Amount / currency | 300 MXN (`30000` cents) |
| Preference / order external_reference | `1deabe6d-f060-460b-ae3b-558f4819cdad` |
| Tracking ref | `trk_61517ecc14d041aebe72b1ca6ba6e303` |
| Collector | `3560835739` |
| Checkout URL | System `init_point` (`www.mercadopago.com.mx`) |
| Browser protocol | Chrome Incognito + test buyer + email OTP; no seller session |
| Provider payment id | `169718949505` |
| Provider status | `approved` / `accredited` |
| Card label | `Mercadopago*fake` (TEST) |

Domain on branch **before** successful webhook apply:

| Table | Count / state |
|---|---|
| `orders` | 1 · `PAYMENT_PENDING` · 30000 MXN · matching external_reference |
| `payments` | 0 |
| `webhook_events` | 0 |
| `tickets` | 0 |

## 8. Case A — signed webhook (FAIL)

| Attempt | Result |
|---|---|
| First signed POST | HTTP 500 `INTERNAL_ERROR` |
| Duplicate signed POST | HTTP 500 `INTERNAL_ERROR` |

Postgres log (sanitized):

```text
null value in column "payment_id" of relation "payment_verification_records"
violates not-null constraint
Failing row contains (…, null, <order_id>, mp_payment:169718949505, t, t, t, t,
APPROVED, …, VERIFIED, …)
PL/pgSQL function webhook_apply_payment_tx(jsonb) line 105 at SQL statement
```

### Defect diagnosis (read-only; not patched)

| Fact | Evidence |
|---|---|
| Schema constraint | Migration `0002_sales_constraints_and_indexes.sql` sets `payment_verification_records.payment_id` **NOT NULL** |
| Main schema | `information_schema.columns.is_nullable = NO` for `payment_id` |
| RPC order of operations | `webhook_apply_payment_tx` (0006 / replaced by 0007/0008) **INSERT**s verification **without** `payment_id`, then creates/updates `payments`, then **UPDATE**s `payment_id` |
| Failure point | INSERT at verification step fails before payment row exists |
| Edge mapping | RPC failure → edge `mp-webhook` returns `INTERNAL_ERROR` |
| Signature / secret | Secret was configured; failure occurs inside RPC after request acceptance path reaches TX |

Classification:

```text
SYSTEM_DEFECT: SCHEMA_RPC_INCONSISTENCY
payment_verification_records.payment_id NOT NULL
vs webhook_apply_payment_tx insert-before-payment pattern
```

Per unit authority: **do not correct inside IMPL-12-R2**.

## 9. Cases B–E / multiday / security matrix

| Case | State | Note |
|---|---|---|
| B team | NOT_RUN | Stopped after Case A webhook FAIL |
| C spectator qty 2 | NOT_RUN | Would also hit OD-001 (`quantity !== 1` fail-closed) if reached |
| D rejected | NOT_RUN | |
| E pending | NOT_RUN | |
| Multiday PUB-3D/FOT-3D | NOT_RUN | Expected fail-closed (OD-020) if reached |
| Duplicate idempotency after apply | NOT_RUN | Apply never succeeded |
| Security negatives | NOT_RUN | |

## 10. Cleanup

| Step | Result |
|---|---|
| Branch event HEX-2026 | Restored `CONFIGURADO` (sales window cleared) before delete |
| InsForge branch delete | `impl12-r2-e2e-20260725` DELETED; branch list = 0 |
| Current InsForge | Main `4bg9ufz2` |
| Local webhook secret file | Absent (deleted after branch secret config; never versioned) |
| Local signed-POST helper | Removed (`.cursor/impl12-r2-sim-webhook.mjs`) |
| Code / SQL / landing | Unchanged |

### Mercado Pago panel (post-cleanup)

| Item | State |
|---|---|
| Production webhook | NOT CONFIGURED |
| Sandbox URL | Still stored pointing at deleted branch host `4bg9ufz2-yje…/functions/mp-webhook` |
| Subscribed topics after MCP `topics: []` | MCP response still listed `payment` (could not clear via MCP in this unit) |
| Human follow-up | Disable test events / clear sandbox URL in developer panel if required |

## 11. Canonical snapshot final (Main, read-only)

| Item | Value |
|---|---|
| Appkey | `4bg9ufz2` (Main) |
| Event HEX-2026 | `CONFIGURADO` |
| Products | 28 |
| `orders` / `payments` / `webhook_events` / `tickets` | 0 / 0 / 0 / 0 |
| InsForge branches | 0 |
| Main differences from baseline transactional | 0 |

## 12. What was NOT done

- No code, SQL, spec, or frontend patch
- No IMPL-13
- No production Mercado Pago credentials
- No landing connection
- No sales open on Main
- No commit of secrets or `.cursor/*.secret`
- Cases B–E and multiday not executed

## 13. Recommended next unit (not authorized here)

```text
Separate authorized fix unit for webhook_apply_payment_tx vs
payment_verification_records.payment_id NOT NULL, then re-authorize IMPL-12
sandbox E2E. Do not start IMPL-13 until IMPL-12 closes.
```

Candidate fix directions (documentation only; not implemented):

1. Allow nullable `payment_id` until post-payment UPDATE, **or**
2. Create/upsert `payments` before inserting `payment_verification_records`, **or**
3. Include a valid `payment_id` on the verification INSERT

## 14. Gate

```text
IMPL_12_VALIDATION_FAILED
IMPL-12: VALIDATION_FAILED / NOT CLOSED
IMPL-13: NOT_STARTED / NOT AUTHORIZED
```

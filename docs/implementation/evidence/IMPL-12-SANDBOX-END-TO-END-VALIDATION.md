# IMPL-12 — Sandbox End-to-End Sales Lifecycle Validation Evidence

```text
Unit: IMPL-12 — Sandbox end-to-end validation of implemented sales cycle
Mode: VALIDATE ONLY · ISOLATED INSFORGE BRANCH · MP TEST ONLY · NO LANDING · NO IMPL-13
Local datetime (America/Merida): 2026-07-25 / 2026-07-26
Baseline HEAD: 7c1755b
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Deployment slug: enforma
Sandbox branch: impl12-sandbox-20260725 (appkey 4bg9ufz2-jyq) — DELETED
Technical result: PROVIDER_SANDBOX_BLOCKED
Human closure: PENDING
Final implementation status: BLOCKED / NOT CLOSED
Gate: PROVIDER_SANDBOX_BLOCKED
IMPL-13: NOT_STARTED / NOT AUTHORIZED
```

## 1. Baseline Git

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD (start) | `7c1755b` — docs: close IMPL-11 tickets and QR credentials |
| origin/main (start) | `7c1755b` |
| Divergence (start) | `0 / 0` |
| Working tree (start) | clean |

## 2. Authority

| Item | Value |
|---|---|
| Human authorization | Leandro Espinosa — Project Owner |
| Gate initial | `AUTHORIZED_FOR_IMPL_12_SANDBOX_END_TO_END` |
| Specs | SPEC-000/001/011/030/031/032 APPROVED |
| Constructor | Cursor (Kimchi/Forge discarded) |
| Classification | Validate implementation against approved specifications |

## 3. Primary operation

```text
Validate end-to-end the implemented sales cycle using Mercado Pago test
credentials and an isolated InsForge backend branch.
```

## 4. Requirements applicable

| Requirement | Authority | Scenario | Observed | State |
|---|---|---|---|---|
| Isolated sandbox backend | Auth §8–10 | InsForge branch `impl12-sandbox-20260725` | Branch created, distinct URL, Main writes = 0 | PASS |
| Main remains CONFIGURADO | Auth §9/32 | Canonical snapshots | HEX-2026 CONFIGURADO before/after; products=28 | PASS |
| Test credentials only | Auth §11 | MP `get_credentials` | Production credentials NOT activated; test Access Token used on branch only | PASS |
| Webhook signed path | Auth §15/7 | Signed POST nonexistent payment ID | HTTP 404 `PAYMENT_NOT_FOUND`; domain writes = 0 | PASS |
| Checkout preference sandbox | Auth §19 Caso A Tramo A | `mp-create-checkout` WOD-H | Preference created; 30000 MXN; tracking_ref issued | PASS |
| Payment sandbox approved | Auth §19 Caso A | Checkout Pro sandbox UI | Blocked: `ERR_TOO_MANY_REDIRECTS` + disabled **Pagar** | BLOCKED |
| Official webhook simulator for paid id | Auth §7/21 | Tramo B after real sandbox payment | NOT_RUN (no payment id) | NOT_RUN |
| Cases B–E / multiday / idempotency | Auth §19–22 | Matrix | NOT_RUN | NOT_RUN |
| No code changes to closed units | Auth §26/35 | Migrations/functions/landing | No closed implementation patched | PASS |

## 5. Official Mercado Pago webhook sandbox limitation

Documented and respected:

```text
Payments created with test credentials do not automatically send Webhook notifications.
Notification leg must use the official Webhooks simulator (or equivalent signed POST
using the panel webhook secret and Without-SDK manifest).
```

Evidence must not claim automatic sandbox webhook delivery. Tramo A (payment) and
Tramo B (signed notification) remain distinct.

## 6. InsForge branching diagnosis

| Item | Result |
|---|---|
| CLI branching | Available (`create/list/switch/delete`) |
| Mode used | `full` |
| Branch name | `impl12-sandbox-20260725` |
| Public URL | `https://4bg9ufz2-jyq.us-east.insforge.app` (distinct from Main) |
| Isolation probe | Temporary secret on branch absent from Main; Main event unchanged |
| Function runtime on branch | Active; checkout returned preferences |

## 7. Canonical snapshot initial (Main, read-only)

| Item | Value |
|---|---|
| Event HEX-2026 | `CONFIGURADO` |
| Products | 28 |
| Functions | 5 (`mp-create-checkout`, `mp-webhook`, `get-order-status`, `team-roster`, `ticket-credentials`) |
| Transactional tables | all 0 (orders/payments/tickets/webhooks/activity_log/…) |
| Waiver documents (Main) | 0 |

## 8–10. Branch creation / isolation / config

| Step | Result |
|---|---|
| Branch create | PASS — `ready` / serving |
| Isolation | PASS — distinct appkey/URL; probe secret not on Main |
| Checkout config secrets on branch | PASS — hold/TTL/back URLs/notification URL/waiver keys |
| Waiver fixture on branch | PASS — `SANDBOX_WAIVER` / `IMPL12-SANDBOX-V1` only on branch |
| Branch Access Token | PASS — updated to verified **test** token from MP MCP (Main token left unchanged) |
| Branch webhook secret | PASS — loaded from local ignored `.cursor/mcp.env` (prefix `474734a`) |
| Main secret writes | 0 |

## 11–14. Credentials / secret boundary / callback / waiver

| Item | Result |
|---|---|
| Secret values in Git/chat/evidence | Not included |
| Production credentials | Not activated (MP MCP) |
| Real payments | 0 |
| Sandbox webhook callback configured | PASS — topic `payment`; production callback Not configured |
| Waiver sandbox | Technical fixture only; no legal authority; not copied to Main |

## 15. Event branch temporarily EN_VENTA

| Item | Result |
|---|---|
| Branch HEX-2026 | `CONFIGURADO` → `EN_VENTA` (authorized) then restored to `CONFIGURADO` |
| Main HEX-2026 | Remained `CONFIGURADO` throughout |

## 16–22. Matrix A–E / multiday

| Case | State | Notes |
|---|---|---|
| A Individual/Workout approved | BLOCKED | Preferences created (WOD-H, MXN 300). Checkout Pro sandbox UI could not complete payment (`ERR_TOO_MANY_REDIRECTS` on login; **Pagar** disabled on review). MP payments search total = 0. |
| B Team of two | NOT_RUN | Blocked by Case A payment |
| C Spectator qty 2 | NOT_RUN | Also conflict with current `quantity=1` fail-closed (OD-001) — not exercised |
| D Rejected | NOT_RUN | |
| E Pending | NOT_RUN | |
| Multiday PUB-3D/FOT-3D fail-closed | NOT_RUN | |

## 23–26. Simulator / payment query / idempotency / public status

| Item | State |
|---|---|
| Pre-payment signed nonexistent id | PASS — signature accepted → `PAYMENT_NOT_FOUND` → domain 0 |
| Official simulator with real payment id | NOT_RUN |
| Canonical GET /v1/payments/{id} after pay | NOT_RUN |
| Idempotency matrix | NOT_RUN |
| Public status after pay | Partial: `get-order-status?reference=` returned `AWAITING_PAYMENT` for unpaid sandbox orders |

## 27–32. Roster / tickets / credentials / entitlements / security / audit

NOT_RUN for paid lifecycle. Pre-conditions:

- No tickets/credentials issued (payments = 0).
- Pre-webhook produced no domain writes.
- No secrets printed in evidence.

## 33. Regression

Local gates run before sandbox writes (this unit):

| Command | Result |
|---|---|
| typecheck | PASS (prior session) |
| test | PASS — 159 tests (prior session) |
| build | PASS (prior session) |
| lint | Existing deploy-bundle warnings only (prior session) |

No closed implementation code was modified to “fix” the provider UI.

## 34–36. Operations inventory

### InsForge Main

| Op | Count |
|---|---|
| reads | snapshots / metadata |
| writes | 0 |
| deploys | 0 |
| migrations | 0 |
| secret changes | 0 |
| event state changes | 0 |

### InsForge branch

| Op | Count |
|---|---|
| branch create | 1 |
| secret/config writes | checkout + waiver + test token + webhook secret |
| event EN_VENTA open/close | 1 / 1 |
| checkout domain writes | preferences/orders/registrations for unpaid attempts |
| branch delete | 1 |

### Mercado Pago

| Op | Count |
|---|---|
| test webhook configure | 1 |
| test webhook clear attempt | 1 (MCP left sandbox URL pointing at deleted branch — see cleanup) |
| sandbox preferences | multiple (Case A retries) |
| sandbox payments completed | 0 |
| real payments | 0 |

## 37–39. Restore / callback cleanup / branch delete

| Step | Result |
|---|---|
| Branch event restored to CONFIGURADO | PASS |
| Branch deleted | PASS — `deleted: true`; branch list empty |
| Production webhook callback | Not configured (confirmed on save response) |
| Sandbox webhook callback removed | **PENDING MANUAL** — `save_webhook` with empty `callback_sandbox` did not clear URL; last reported sandbox URL still referenced deleted branch host `4bg9ufz2-jyq` |
| Webhook secret invalidation | Branch destroyed (secret only lived on branch). Panel secret may still exist — rotate/disable in panel if desired |

**Human action required:** In MP panel Webhooks for app `2442407257411599`, clear/disable the sandbox callback URL that points to the deleted branch.

## 40–41. Canonical snapshot final / differences

| Item | Initial | Final |
|---|---|---|
| HEX-2026 | CONFIGURADO | CONFIGURADO |
| products | 28 | 28 |
| functions | 5 | 5 |
| orders/payments/tickets/webhooks/activity_log/waivers | 0 | 0 |

```text
canonical differences = 0
CANONICAL_PROJECT_CONTAMINATED = false
```

## 42. Protected resources

Main preserved: event, catalog, prices, cupos, migrations 0001–0008, five functions, landing, frontend, Storage/Realtime/Auth/RLS, closed evidences, other InsForge project, MP production credentials (not activated).

## 43. Open decisions preserved

| Topic | Status |
|---|---|
| OD-019 commercial folio | OPEN |
| OD-020 multiday | OPEN / FAIL-CLOSED |
| PUBLIC_TICKET_RETRIEVAL | DEFERRED |
| TICKET_EMAIL_DELIVERY / EMAIL_PROVIDER | DEFERRED |
| TEAM_ROSTER_REMINDERS | DEFERRED |
| OFFLINE_MANIFEST / CHECK_IN | NOT IMPLEMENTED |
| MP production webhook | NOT CONFIGURED |

## 44. Finding — provider sandbox checkout UI

```text
PROVIDER_SANDBOX_BLOCKED
```

Observed repeatedly across Chrome and Edge InPrivate:

1. `ERR_TOO_MANY_REDIRECTS` on `sandbox.mercadopago.com.mx/.../login/`
2. After clearing cookies, checkout review reachable with test cards, but **Pagar** remained disabled
3. Fatal page “Una de las partes con la que intentas hacer el pago es de prueba” when mixed real buyer session was used earlier
4. Card Payments API with test Access Token returned `Unauthorized use of live credentials` (code 7) — not used as bypass

No silent code patch was applied. Checkout preference creation and signed webhook preflight succeeded.

Secondary observation (not patched in IMPL-12): `mp-create-checkout` returns `init_point`; for test credentials `sandbox_init_point` is required for the sandbox host. Operators used `sandbox_init_point` manually for UI attempts.

## 45. Rollback executed

| Resource | Action |
|---|---|
| InsForge branch | Event closed; branch deleted |
| Mercado Pago | Production callback remains Not configured; sandbox callback needs manual clear in panel |
| Git implementation | No closed code rollback needed (validation-only) |

## 46. Traceability

| Requirement | Authority | Closed impl | Sandbox scenario | Observed | Evidence | State |
|---|---|---|---|---|---|---|
| Isolated E2E env | Auth §8 | Branching | Branch create/isolate/delete | Main intact | this doc | PASS |
| Signed webhook contract | IMPL-8 | `mp-webhook` | Nonexistent payment signed POST | 404 / writes 0 | this doc | PASS |
| Checkout start | IMPL-7 | `mp-create-checkout` | WOD-H preference | 200 + pref | this doc | PASS |
| Paid confirmation cycle | IMPL-8..11 | webhook→tickets | Approved sandbox pay + notify | UI blocked | this doc | BLOCKED |

## 47. Technical result

```text
PROVIDER_SANDBOX_BLOCKED
IMPL-12 ≠ TECHNICAL_PASS
IMPL-12 ≠ VALIDATED / CLOSED
IMPL-13 = NOT_STARTED / NOT AUTHORIZED
```

## 48. Recommended gate

```text
PROVIDER_SANDBOX_BLOCKED
```

Next human action options:

1. Clear leftover sandbox webhook URL in MP panel.
2. Re-authorize a later IMPL-12 retry when Checkout Pro sandbox login/pay UI is usable, or when an alternate approved payment path exists.
3. Do **not** start IMPL-13 from this blocked unit.

# IMPL-11 — Tickets and QR Credentials Implementation Validation Evidence

```text
Unit: IMPL-11 — Idempotent server-side tickets + opaque QR credentials
Mode: BACKEND ONLY · NO LANDING · NO EMAIL · NO CHECK-IN · NO IMPL-12
Local datetime (America/Merida): 2026-07-25 ~09:35 -06:00
Baseline HEAD: b48bef6
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Deployment slug: enforma
Technical result: TECHNICAL PASS
Human closure: APPROVED 2026-07-25
Final implementation status: VALIDATED / CLOSED
TEAM_ROSTER_REMINDERS: DEFERRED / NOT AUTHORIZED
EMAIL_PROVIDER / TICKET_EMAIL_DELIVERY: DEFERRED / NOT AUTHORIZED
PUBLIC_TICKET_RETRIEVAL: DEFERRED / NOT AUTHORIZED
Mercado Pago panel configuration: DEFERRED / NOT AUTHORIZED
OD-019 commercial folio: OPEN (technical opaque folio IMPLEMENTED)
OD-020 multiday: OPEN / FAIL-CLOSED
Gate: READY_FOR_IMPL_12_AUTHORIZATION
```

## 1. Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `b48bef6` |
| origin/main | `b48bef6` |
| Divergence | `0 / 0` |
| Working tree (preflight) | clean |
| Prior unit | IMPL-10 `VALIDATED / CLOSED` |

## 2. Authority

| Item | Value |
|---|---|
| Human authorization | Leandro Espinosa — Project Owner |
| Gate initial | `AUTHORIZED_FOR_IMPL_11_TICKETS_QR` |
| Specs | SPEC-000/001/011/030/031/032 APPROVED |
| Constructor | Cursor (Kimchi/Forge discarded) |

## 3. Requirements

| Requirement | Authority | Implementation | Test | Remote | State |
|---|---|---|---|---|---|
| Ticket after paid + eligible | SPEC-031-R026/R038; SPEC-032-R008 | `ticket_issue_one_registration` | unit/static | RPC present | PASS |
| J2/J3 full set on ELIGIBLE | SPEC-031-R027/R028; SPEC-032-R039 | `ticket_issue_after_team_eligible` in accept TX | static | SQL replace | PASS |
| Opaque QR hash generations | SPEC-032-R054 | `ticket_credential_generations.token_hash` | unit | smoke | PASS |
| One active generation | SPEC-032-R008/R054 | unique active index + reissue | static | n/a | PASS |
| Protected reissue | SPEC-031-R018 | `ticket_credential_reissue_tx` + edge | unit/smoke | 401/404 | PASS |
| Access entitlements single-day | SPEC-032-R030 | insert on issue when `product.day` set | static | n/a | PASS |
| Idempotent issuance | SPEC-031-R033 | unique registration + unique_violation path | static | n/a | PASS |
| No email delivery | OD-017 OPEN | outbox `TICKET_READY` without raw token | static | 0 outbox rows | PASS |
| No check-in / used_at | future units | no consume path | static | PASS | PASS |

## 4. Primary operation

```text
Implement the server-side lifecycle of tickets and QR credentials.
```

## 5. Scope / non-scope

In scope: issuance RPCs, TX-2/TX-3 hooks via `0008`, `ticket-credentials` edge (protected verify/reissue/projection), negative smokes, evidence.

Out of scope: landing, UI, email, check-in, offline manifest, MP panel, sales open, IMPL-12.

## 6–7. Contradiction scan / open decisions

| Topic | Status | Treatment |
|---|---|---|
| Folio commercial format (OD-019) | OPEN | Engineering opaque `ticket` / `tkt_`+32hex (not commercial) |
| Folio namespace uniqueness | RESOLVED | `(folio_namespace, folio)` unique |
| QR TTL (API-OD-004) | OPEN | `expires_at = NULL` |
| QR delivery/recovery | OPEN | `PUBLIC_TICKET_RETRIEVAL` / email DEFERRED; raw token only at protected reissue edge |
| PUB-3D / FOT-3D (OD-020) | OPEN | `MULTIDAY_ENTITLEMENT_BLOCKED` + INTERNAL_ALERT |
| Photographer extras (OD-021) | OPEN | Single-day press tickets only; no invented accreditation |
| Quantity N (OD-001) | OPEN | Checkout still qty=1; issuance is 1 ticket/registration; N = N regs |
| Refund auto-revoke (OD-007) | OPEN | No auto-revoke (alerts-only continues) |
| Team activation timing | RESOLVED | On `ELIGIBLE` only |
| Reissue mechanics | RESOLVED | Revoke prior ACTIVE → new ACTIVE |
| Who can reissue | RESOLVED | Operator bearer only (not anon) |
| Generation count cap | PARTIAL | One ACTIVE enforced; lifetime max OPEN |
| Email provider (OD-017) | OPEN | Deferred; outbox dry payload only |

## 8. Model diagnosis

Tables `tickets`, `ticket_credential_generations`, `access_entitlements` already existed (0001–0002). No issuance RPCs before IMPL-11. TX-2/TX-3 previously set `tickets_emitted=false`.

## 9–10. Emission conditions / cardinality

| Journey | Condition | Cardinality |
|---|---|---|
| Individual (competitor) | PAID + PAYMENT_CONFIRMED + waiver | 1 |
| Workout | PAID + PAYMENT_CONFIRMED | 1 |
| Spectator single-day | PAID + PAYMENT_CONFIRMED | 1 per registration |
| Photographer single-day | PAID + PAYMENT_CONFIRMED | 1 |
| Dobles | PAID + team ELIGIBLE + members COMPLETE | 2 |
| Relay | PAID + team ELIGIBLE + members COMPLETE | 4 |
| PUB-3D / FOT-3D | blocked | 0 + alert |

## 11–15. Ticket / folio / QR / hash

- Ticket links registration, holder/participant, product, folio namespace/value, state, issued_at.
- Folio: namespace `ticket`, value `tkt_`+32 hex (opaque; OD-019 commercial format remains OPEN).
- QR token: `qr_`+32 hex; payload recommendation `{v,t}`; no PII/medical/payment.
- Persist only `token_hash` (SHA-256 hex). Raw token never in tables/logs/outbox/idempotency response_ref.
- Entropy ≈ 122 bits (UUID hex).

## 16–18. Generations / revoke / reissue / entitlements

- Generation 1 ACTIVE on issue.
- Reissue: prior REVOKED, replacement ACTIVE, prior/replacement links, ticket → REISSUED, TICKET_ACCESS rotated.
- Entitlements: one AVAILABLE row for `product.day` (+ session). No `used_at` mutation.
- Refund/chargeback: not auto-revoking (OD-007).

## 19–23. TX-2 / roster / idempotency / concurrency / migration

- `webhook_apply_payment_tx` REPLACE calls `ticket_issue_after_payment` after team sync for PAID/ALREADY_PAID (non-team issues; teams skip until ELIGIBLE).
- `team_roster_accept_tx` REPLACE calls `ticket_issue_after_team_eligible` when roster becomes ELIGIBLE.
- Idempotency: `uq_tickets_registration` + unique_violation handler; reissue uses `idempotency_records` scope `TICKET_REISSUE`.
- Concurrency: FOR UPDATE + unique constraints; concurrent reissue → CONFLICT.
- Migration: `insforge/migrations/0008_ticket_issuance_credentials.sql` → remote v8 `ticket-issuance-credentials`.
- No tables/policies/triggers; no `0004`; prior migrations intact.

## 24. Least privilege

All ticket RPCs: SECURITY DEFINER, secure `search_path`, REVOKE PUBLIC/anon/authenticated, GRANT EXECUTE `project_admin` only.

## 25–26. Tests

| Suite | Result |
|---|---|
| Vitest total | 159 passed |
| New ticket suites | static + orchestrate + policy |
| Prior checkout/webhook/order-status/team-roster | included |

## 27. Regression

| Command | Result |
|---|---|
| `npm run lint` | PASS (existing deploy-bundle warnings only) |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 159 |
| `npm run build` | PASS |
| `npm run bundle:ticket-credentials` | PASS |

## 28–31. Deploy / inventory / ops

```text
InsForge:
- migration apply = 1 (0008 / v8 ticket-issuance-credentials)
- ticket-credentials deploy = 1
- redeploy mp-webhook = 0 (SQL-only integration)
- redeploy team-roster = 0 (SQL-only integration)
- redeploy mp-create-checkout = 0
- other writes = 0 (except operator secrets for protected surface)

Mercado Pago reads/writes = 0
preferences/payments/refunds = 0
```

Inventory (active): `mp-create-checkout`, `mp-webhook`, `get-order-status`, `team-roster`, `ticket-credentials`.

Secrets added (values not recorded): `TICKET_OPERATOR_BEARER`, `TICKET_CREDENTIAL_IDEMPOTENCY_TTL_SECONDS`.

## 32. Smoke tests (negative only)

| Smoke | Result |
|---|---|
| PUT | 405 METHOD_NOT_ALLOWED + `Cache-Control: no-store` |
| GET (no action) | 403 PUBLIC_TICKET_RETRIEVAL_DEFERRED |
| GET verify malformed token (operator) | 400 INVALID_TOKEN |
| GET verify unknown token (operator) | 404 CREDENTIAL_NOT_FOUND |
| GET verify wrong bearer | 401 UNAUTHORIZED |
| POST without auth | 401 UNAUTHORIZED |
| POST reissue unknown ticket (operator) | 404 TICKET_NOT_FOUND |

No orders/payments/teams/tickets/credentials/entitlements/activity/outbox rows created.

## 33–35. Counts / deferred delivery / check-in

Before and after smoke:

```text
buyer_contacts/participants/registrations/teams/team_members/orders/order_items/
capacity_holds/payments/webhook_events/tickets/ticket_credential_generations/
access_entitlements/activity_log/outbox_delivery_jobs = 0
products = 28
HEX-2026 = CONFIGURADO
```

```text
EMAIL_PROVIDER = DEFERRED / NOT AUTHORIZED
TICKET_EMAIL_DELIVERY = DEFERRED / NOT AUTHORIZED
PUBLIC_TICKET_RETRIEVAL = DEFERRED / NOT AUTHORIZED
CHECK_IN / MANIFEST / first-scan-wins = NOT IMPLEMENTED
```

## 36–38. Protected resources / rollback / traceability

Protected intact: landing, frontend, catalog 28, event CONFIGURADO, seed, migrations 0001–0007, closed evidences, bucket `landings-images`, deferred MP panel, deferred reminders.

Rollback (not executed): disable/delete `ticket-credentials`; revert RPCs from 0008; restore prior webhook/accept bodies if needed; verify zero tickets/creds/ents.

Traceability updated in `IMPL-0` and `WORKSPACE_STATUS.md`.

## 39. Technical result / recommended gate

```text
READY_FOR_IMPL_11_HUMAN_CLOSURE
IMPL-11 = TECHNICAL_PASS / PENDING HUMAN CLOSURE
IMPL-12 = NOT_STARTED / NOT AUTHORIZED
```

Superseded by human closure below.

## 40. Human closure

```text
Human closure authority:
Leandro Espinosa — Project Owner

Human closure date:
2026-07-25

Technical implementation commit:
9c9daa4

Human decision:
APPROVED FOR CLOSURE

Final implementation status:
VALIDATED / CLOSED
```

Closure notes:

- Human approval is based on the technical evidence published in this file and commit `9c9daa4`.
- Local and remote tests were not repeated during this closure unit.
- Deployed functions were not invoked during this closure unit.
- InsForge was not consulted or modified during this closure unit (`reads = 0`, `writes = 0`).
- Mercado Pago was not consulted or modified during this closure unit (`reads = 0`, `writes = 0`).
- No remote tickets or credentials were created during this closure unit.
- Technical results, counts, and conclusions were not altered.
- No emails were sent.
- Public QR retrieval was not implemented.
- Offline manifesto was not implemented.
- Check-in was not implemented.
- IMPL-12 remains without authorization.
- Event remains `CONFIGURADO`; sales remain closed.
- OD-019 commercial folio remains OPEN (technical opaque folio remains implemented).
- OD-020 multiday remains OPEN / FAIL-CLOSED for PUB-3D/FOT-3D.
- `PUBLIC_TICKET_RETRIEVAL`, `TICKET_EMAIL_DELIVERY`, `EMAIL_PROVIDER`, `TEAM_ROSTER_REMINDERS`, and Mercado Pago webhook URL/secret remain `DEFERRED / NOT AUTHORIZED`.
- `OFFLINE_MANIFEST` and `CHECK_IN` remain `NOT IMPLEMENTED / NOT AUTHORIZED`.
- OD-007, OD-017, OD-021, API-OD-004, and API-OD-010 retain their documented real status (not declared resolved).

```text
Gate after human closure:
READY_FOR_IMPL_12_AUTHORIZATION
IMPL-11 = VALIDATED / CLOSED
OD-019 commercial folio = OPEN
OD-020 multiday = OPEN / FAIL-CLOSED
ticket delivery / email = DEFERRED / NOT AUTHORIZED
offline manifesto / check-in = NOT IMPLEMENTED / NOT AUTHORIZED
Mercado Pago panel configuration = DEFERRED / NOT AUTHORIZED
IMPL-12 = NOT_STARTED / NOT AUTHORIZED
```

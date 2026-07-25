# IMPL-10 — Team Roster Invitations Implementation Validation Evidence

```text
Unit: IMPL-10 — Teams, roster, opaque invitations (docs/03 J4 = SPEC J2/J3)
Mode: BACKEND ONLY · NO LANDING · NO EMAIL · NO TICKETS/QR · NO IMPL-11
Local datetime (America/Merida): 2026-07-25 ~02:55 -06:00
Baseline HEAD: c325069
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Deployment slug: enforma
Technical result: TECHNICAL PASS
Human closure: PENDING
Gate: READY_FOR_IMPL_10_HUMAN_CLOSURE
```

## 1. Baseline Git

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `c325069` |
| origin/main | `c325069` |
| Divergence | `0 / 0` |
| Working tree (pre-impl) | clean |

## 2. Authority

Governing sources: SPEC-000/001/011/030/031/032 APPROVED; IMPL-7..9 CLOSED;
Project Owner authorization `AUTHORIZED_FOR_IMPL_10_TEAM_ROSTER_INVITATIONS`.

Primary operation: implement backend lifecycle for teams/roster/invitations.

## 3. Requirements

| Requirement | Authority | Implementation | Test | Remote | State |
|---|---|---|---|---|---|
| Team shell for team_size>1 | SPEC-030/032 TX-1 | checkout_start_tx REPLACE | unit + static | migration applied | PASS |
| No team for team_size=1 | SPEC-030 | guarded `team_size > 1` | static | n/a | PASS |
| Opaque invitation | SPEC-030/032 CapabilityCredential | `inv_`+UUID hex, SHA-256 hash | unit | 404 unknown | PASS |
| Individual waiver | SPEC-030/031 | accept TX + env version match | unit | POST fail-closed without waiver env | PASS |
| Paid before accept | SPEC-030 §8.5 | GET/POST checks order PAID | unit SQL | n/a | PASS |
| Eligibility without tickets | SPEC-032 + IMPL-10 auth | ELIGIBLE; tickets_emitted=false | static | tickets=0 | PASS |
| No MP / no email | auth | no MP client; reminders deferred | static | MP=0 | PASS |

## 4. Scope / non-goals

In scope: TX-1 team shell, TX-2 roster payment sync, `team-roster` GET/POST, migration 0007, negative smokes.

Out of scope: landing/UI, email/reminders, substitutions, tickets/QR, MP panel, sales open, IMPL-11+.

## 5. Contradiction scan

| Item | Resolution |
|---|---|
| Authorization says “J4”; SPEC-030 J4 = Workout | **docs/03 J4 = pareja/relevo** maps to **SPEC J2/J3**. Implemented as SPEC J2/J3. |
| Prompt shorthand vs SPEC roster states | Used deployed enums: `PROVISIONAL`, `PAYMENT_PENDING`, `PAID_ROSTER_INCOMPLETE`, `PAID_ROSTER_COMPLETE`, `ELIGIBLE`. |
| SPEC TX-3 ticket issuance on eligibility | Deferred to IMPL-11 by authorization; ELIGIBLE without tickets. |
| Separate `invitations` table | **Not created** — uses approved `capability_credentials` (`INVITATION_EXCHANGE_CODE`). |

## 6. Open decisions (handled)

| Decision | Handling |
|---|---|
| OD-011 invitation duration | Fail-closed env `TEAM_INVITATION_TTL_SECONDS` (IMPL-7 OD-010 pattern) |
| OD-004 exact fields | Shell `participant.public_ref` only (same as checkout) |
| OD-005 waiver content | Env type/version; `WAIVER_CONFIGURATION_REQUIRED` if unset |
| OD-008 / API-OD-008 | Substitutions/resend disabled / out of scope |
| OD-017 email | `TEAM_ROSTER_REMINDERS = DEFERRED / NOT AUTHORIZED` |
| API-OD-004 continuation TTL | Combined TX-3A+3B one-shot accept; no long-lived invitee capability mint |

## 7. Diagnosis

| Item | Finding |
|---|---|
| Public invite token | `inv_` + 32 hex; hashed at rest |
| Captain | Position 1 `CAPTAIN`; counts toward roster |
| Invitees | Positions 2..team_size; per-slot invitation capability |
| Waiver tables | Existing `waiver_documents` / `waiver_acceptances` |
| Prior TX-1/2 | Did not create teams; extended via 0007 REPLACE |

## 8–12. Lifecycle / HTTP / privacy

```text
TX-1 (team_size>1): PROVISIONAL → PAYMENT_PENDING + captain + invite hashes
TX-2 PAID: PAID_ROSTER_INCOMPLETE
GET/POST team-roster?token= / body.token
Accept: lock team/slot → participant + registration + waiver → COMPLETE
Last slot: ELIGIBLE (no tickets/QR)
```

Contract:

```text
GET  /functions/team-roster?token=<inv_…>
POST /functions/team-roster  { token, idempotency_key, participant?, waiver }
```

Projection minimum: `status`, `product_name`, `required_members`, `completed_members`, `remaining_members`, `accepting_members`, optional `waiver` versions.

No PII/IDs/secrets/tickets/QR in responses. `Cache-Control: no-store`.

## 13–19. Idempotency / concurrency / TX / eligibility / TX-1-2

- Accept uses `idempotency_records` scope `OP-PUB-07`.
- Slot lock via `FOR UPDATE` on capability + team_member + team.
- Atomic accept RPC; failure rolls back.
- Checkout redeploy justified: pass invitation TTL/waiver + surface `roster_invitations` once.
- Webhook edge not redeployed (SQL-only sync helper).

## 20–22. Migration / least privilege

| Item | Value |
|---|---|
| File | `insforge/migrations/0007_team_roster_invitations.sql` |
| Remote | v7 `team-roster-invitations` applied |
| Tables/policies/triggers | none created |
| EXECUTE | `project_admin` only; PUBLIC/anon revoked |

## 23–24. Tests / regression

| Suite | Result |
|---|---|
| Vitest total | 113 passed |
| lint / typecheck / build | PASS |
| Checkout/webhook/order-status regression | included in suite |

## 25–28. Deploy / ops

```text
InsForge:
- migration apply = 1 (0007)
- deploy team-roster = 1
- redeploy mp-create-checkout = 1 (J2/J3 invitation surface; justified)
- redeploy mp-webhook = 0
- other writes = 0

Mercado Pago reads/writes = 0
```

Inventory (active): `mp-create-checkout`, `mp-webhook`, `get-order-status`, `team-roster`.

## 29. Smoke tests (negative only)

| Smoke | Result |
|---|---|
| PUT | 405 METHOD_NOT_ALLOWED + `Cache-Control: no-store` |
| GET no token | 400 INVALID_TOKEN |
| GET malformed | 400 INVALID_TOKEN |
| GET unknown opaque | 404 INVITATION_NOT_FOUND |
| POST without waiver env | 503 WAIVER_CONFIGURATION_REQUIRED (fail-closed; no writes) |

Counts after smoke: teams/participants/orders/tickets/activity_log = 0; products = 28; event = CONFIGURADO.

## 30–34. Deferred / protected / rollback

```text
TEAM_ROSTER_REMINDERS = DEFERRED / NOT AUTHORIZED
Mercado Pago webhook URL/secret = DEFERRED / NOT AUTHORIZED
tickets = 0
QR = 0
```

Rollback: disable `team-roster`; revert RPCs from 0007; redeploy prior checkout bundle if needed. Not auto-executed.

## 35. Recommended gate

```text
READY_FOR_IMPL_10_HUMAN_CLOSURE
IMPL-10 = TECHNICAL_PASS / PENDING HUMAN CLOSURE
IMPL-11 = NOT_STARTED / NOT AUTHORIZED
```

# R2H-T2-0 — Event Entry Implementation Traceability

```text
Status: DOCUMENTARY ONLY
Version: 0.1.0
Created: 2026-07-31
Authority: Explicit Project Owner approval of SPEC-060 v0.1.0
Commit/push: NOT AUTHORIZED by this unit
Runtime execution: NOT AUTHORIZED
InsForge writes: NOT AUTHORIZED
Main / production: NOT AUTHORIZED
```

## A. Objective

Translate the approved SPEC-060 Event Entry Operations contract into small,
verifiable, separately authorizable Tramo 2 implementation units without
executing any of them.

This document is planning and traceability only. It does not authorize code,
migrations, Edge Functions, PWA/service-worker work, IndexedDB schemas, role
provisioning, InsForge mutation, Mercado Pago changes, commit, or push.

## B. Authority

| Spec / source | Version | Status |
|---|---|---|
| SPEC-000 Specification Governance | 0.2.0 | APPROVED |
| SPEC-001 System Architecture | 0.1.0 | APPROVED |
| SPEC-011 PWA Foundation | 0.1.0 | APPROVED |
| SPEC-030 / SPEC-031 / SPEC-032 | 0.1.0 | APPROVED |
| SPEC-040 Payment Pending Expiry | 0.1.1 | APPROVED (compatible; not entry authority) |
| SPEC-060 Event Entry Operations | 0.1.0 | APPROVED |
| docs/03_CUSTOMER_JOURNEYS.md J5–J7, P1–P12 | product | APPROVED product authority |

Preserved closed states (not reopened by this document):

```text
R2H-LANDING-SBX-1B = VALIDATED / CLOSED
IMPL-14A-3C = VALIDATED / CLOSED
OD-040-002 compensating hardening = VALIDATED / CLOSED
OD-040-002 = OPEN
TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY
```

## C. Baseline (documentary)

```text
Repository HEAD at SPEC-060 approval documentation: f4c0b6a (main)
Application shell: foundation only (no staff/check-in UI)
F0-E PWA foundation implementation: NOT STARTED / NOT AUTHORIZED
Check-in / offline manifest runtime: NOT IMPLEMENTED / NOT AUTHORIZED
N1 tickets + opaque QR + AccessEntitlement shape: AVAILABLE (IMPL-11)
ticket-credentials check-in mutation: NOT IMPLEMENTED
Staff roles/assignments tables: NOT IMPLEMENTED
```

This document does not re-query InsForge. Claims above are repository and
prior-unit documentary evidence.

## D. Controlled units

Every unit below requires separate human authorization. Current state for all
runtime units is `NOT AUTHORIZED / NOT STARTED` unless noted.

Shared non-goals for all units unless a later SPEC expands scope:

- Protected Solution Desk Action internals (verify MP, on-site pay, refund,
  category change, sensitive correction, reissue, waiver signature contracts)
- Full Staff Management (recruitment, complex calendars, payroll, etc.)
- Tramo 3 heats/timing/results
- Main / production applies
- Claiming true least privilege while platform shared privilege remains

### R2H-T2-1 — PWA shell and operational roles

| Field | Value |
|---|---|
| Related requirements | SPEC-060-R011, R013, R025, R068–R070, R080–R081; SPEC-011 foundation |
| Dependencies | SPEC-060 APPROVED; SPEC-011 APPROVED; F0-E may be paired or prerequisite |
| Anticipated files | PWA/app-shell wiring; auth/session role gates; check-in route shell; role view filters; tests |
| External resources | None required for documentary plan; sandbox later only if separately authorized |
| Blocking open decisions | None for shell skeleton; OD-040-002 remains open for Main least privilege |
| Scope | Installable/offline-capable shell boundaries needed for door app; role-aware entry surfaces; CHECKIN_STAFF one primary screen shell |
| Out of scope | Manifest domain data; sync queue; kit/incident domain; Main |
| Automated tests | Role denial for finance/medical fields; shell offline navigation smoke |
| Manual tests | Role screen presence review |
| Expected evidence | Unit evidence under `docs/implementation/evidence/` when authorized |
| Rollback | Revert shell-only changes; no canonical data mutations |
| Entry gate | Separate human authorization after this traceability review |
| Exit gate | `READY_FOR_T2_2_MIN_STAFF` (or equivalent) after human closure |
| Separate human authorization | Required |
| Current state | `R2H-T2-1B = VALIDATED / CLOSED` (Project Owner 2026-08-01 America/Merida; documentary formalization 2026-08-02; local + automated + manual validation scope) after T2-1C/T2-1D/T2-1E; evidence `docs/implementation/evidence/R2H-T2-1B-PWA-OPERATIONAL-SHELL.md`; gate `READY_FOR_R2H_T2_1B_CLOSURE_COMMIT_REVIEW`; commit/push/Main/production/T2-2 runtime still NOT AUTHORIZED |

### R2H-T2-2 — Minimum staff identity and assignments

| Field | Value |
|---|---|
| Related requirements | R001, R013–R015, R014, R021, R068, R081, AC021, AC020 |
| Dependencies | R2H-T2-1 authorized/closed or explicitly paired |
| Anticipated files | Logical operator/assignment contracts; backend authorization checks; minimal admin assignment UI if in scope of unit authorization |
| External resources | Sandbox only if separately authorized |
| Blocking open decisions | None for minimum binding fields |
| Scope | Who operates / event / day / door-area / role / validity |
| Out of scope | Recruitment, availability calendars, drag-and-drop, payroll, advanced accreditation |
| Automated tests | Fail-closed readiness without assignment; wrong event/day/door |
| Manual tests | Assignment fixture review |
| Expected evidence | TBD under authorized unit |
| Rollback | Drop/disable assignment feature flags; no silent door opens |
| Entry gate | Separate authorization |
| Exit gate | `READY_FOR_T2_3_MANIFEST` |
| Separate human authorization | Required |
| Current state | `NOT AUTHORIZED / NOT STARTED` |

### R2H-T2-3 — Manifest and online check-in

| Field | Value |
|---|---|
| Related requirements | R017–R030, R036, R039, R052, R055, R067, R073, R075, R078, R084 partial online path; AC001–AC003, AC006–AC007, AC011, AC019, AC022–AC023, AC028, AC031 |
| Dependencies | R2H-T2-2; N1 tickets/credentials; OD-060-001 numeric TTL before validation; OD-060-002 skew limit before validation |
| Anticipated files | Manifest generation/download contracts; online check-in path; door UI green/red; printable continuity aid; tests |
| External resources | Authorized sandbox only when unit says so |
| Blocking open decisions | OD-060-001 (TTL number); OD-060-002 (skew number); OD-060-004 label format non-blocking |
| Scope | Manifest properties; local validation against resident manifest; online accept path; paper continuity aid non-authority |
| Out of scope | Full offline queue durability (T2-4); kit delivery (T2-5); desk protected actions |
| Automated tests | Opaque QR; expiry; wrong scope; reissue supersession; rate-limit abuse vs authorized sync |
| Manual tests | Green local+pending wording review |
| Expected evidence | TBD under authorized unit |
| Rollback | Disable manifest/check-in endpoints; revoke client feature |
| Entry gate | Separate authorization; OD-060-001/002 decided or fail-closed defaults accepted |
| Exit gate | `READY_FOR_T2_4_OFFLINE_QUEUE` |
| Separate human authorization | Required |
| Current state | `NOT AUTHORIZED / NOT STARTED` |

### R2H-T2-4 — Offline queue and synchronization

| Field | Value |
|---|---|
| Related requirements | R002, R006–R007, R010, R041–R051, R056, R076, R079, R084–R086; AC004–AC010, AC024–AC026, AC029–AC032 |
| Dependencies | R2H-T2-3; OD-060-003 retention duration before validation |
| Anticipated files | Durable queue; sync client; conflict handling; storage protection; tests |
| External resources | Authorized sandbox only when unit says so |
| Blocking open decisions | OD-060-003 retention duration |
| Scope | PENDING_SYNC durability; idempotency; first-server-wins; revoke-after-manifest; ambiguous response; logout retention |
| Out of scope | Kit/waiver delivery domain completeness; desk internals |
| Automated tests | Two-device conflict; reload persistence; ambiguous response; storage-full no silent drop |
| Manual tests | Offline scan continuity |
| Expected evidence | TBD under authorized unit |
| Rollback | Disable sync writers; preserve queue export path |
| Entry gate | Separate authorization |
| Exit gate | `READY_FOR_T2_5_KITS_WAIVER_INCIDENTS` |
| Separate human authorization | Required |
| Current state | `NOT AUTHORIZED / NOT STARTED` |

### R2H-T2-5 — Kits, waiver and incidents

| Field | Value |
|---|---|
| Related requirements | R005, R008, R009, R058–R066, R071; AC011–AC014, AC017–AC018, AC027 partial |
| Dependencies | R2H-T2-3/T2-4; OD-060-005 product waiver config before validation; OD-060-006 remains default no medical signal |
| Anticipated files | Waiver delivery status consumption; kit/chip delivery record; incident create/classify/close boundary; solution desk receive/close boundary |
| External resources | Authorized sandbox only when unit says so |
| Blocking open decisions | OD-060-005 which products require waiver |
| Scope | Delivery gate; individual team member rules; door incident escalation; desk ownership fields without protected-action internals |
| Out of scope | Verify MP, on-site pay, refund, category change, reissue, waiver-signature command contracts |
| Automated tests | REQUIRED_MISSING blocks delivery; captain cannot cover member; door cannot mutate payments |
| Manual tests | Escalation path walkthrough |
| Expected evidence | TBD under authorized unit |
| Rollback | Disable delivery registration and incident writers |
| Entry gate | Separate authorization |
| Exit gate | `READY_FOR_T2_6_PHYSICAL_REHEARSAL` |
| Separate human authorization | Required |
| Current state | `NOT AUTHORIZED / NOT STARTED` |

### R2H-T2-6 — Physical offline rehearsal

| Field | Value |
|---|---|
| Related requirements | Cross-cutting AC001–AC032 physical evidence subset; R039/AC027 paper degraded mode |
| Dependencies | R2H-T2-4 and R2H-T2-5 functionally available in authorized sandbox/device build |
| Anticipated files | Rehearsal protocol + evidence record only |
| External resources | Physical devices; authorized sandbox; no Main/production |
| Blocking open decisions | None for protocol authorship; runtime blockers inherit from prior units |
| Scope | Human offline drill without wifi; conflict/revoke/paper continuity observation |
| Out of scope | Production go-live; sales open |
| Automated tests | Not primary; prior unit suites must already pass |
| Manual tests | Physical rehearsal checklist |
| Expected evidence | `docs/implementation/evidence/R2H-T2-6-…` when authorized |
| Rollback | N/A documentary / sandbox fixtures only |
| Entry gate | Separate authorization after T2-4/T2-5 |
| Exit gate | `READY_FOR_T2_HUMAN_CLOSE` (or equivalent) |
| Separate human authorization | Required |
| Current state | `NOT AUTHORIZED / NOT STARTED` |

## E. Requirement → unit map (summary)

| SPEC-060 cluster | Primary unit |
|---|---|
| Roles / shell / privacy views | R2H-T2-1 |
| Assignment minimum | R2H-T2-2 |
| Manifest + local/online check-in + paper aid | R2H-T2-3 |
| Queue / sync / conflicts / clock / retention | R2H-T2-4 |
| Kit / waiver / incidents / desk boundary | R2H-T2-5 |
| Physical offline proof | R2H-T2-6 |

Full R→AC→unit detail remains in SPEC-060 §16.

## F. Open decisions affecting units

| Decision | Blocks before | Fallback already in SPEC-060 |
|---|---|---|
| OD-060-001 TTL number | T2-3 validation | No READY without explicit expires-at |
| OD-060-002 skew number | T2-3 validation | Fail-closed new accepts when skew unreliable |
| OD-060-003 retention duration | T2-4 validation | Retain until terminal or audited admin purge |
| OD-060-004 label format | UX freeze T2-3 | Non-blocking; reduced label |
| OD-060-005 waiver by product | T2-5 validation | Delivery fail-closed if status missing/unknown |
| OD-060-006 medical signal | Any medical signal impl | Default: no medical signal |

## G. Future specifications (not authorized here)

```text
Protected Solution Desk Actions specification
Staff Management specification (080-089)
Tramo 3 competition specifications
```

## H. Explicit non-authorizations

This traceability document MUST NOT be cited as authorization for:

```text
git commit
git push
InsForge Main writes
production writes
sandbox schema/function deploys
F0-E / R2H-T2-2…T2-6 runtime work
Mercado Pago changes
opening sales
activating schedules
git commit / git push of the local T2-1B tree (needs separate commit unit)
```

## I. Recommended next human gate

```text
READY_FOR_R2H_T2_1B_CLOSURE_COMMIT_REVIEW
```

`R2H-T2-1B` is `VALIDATED / CLOSED` in local validation scope. The next
authorized documentary step is review of the exact commit inventory. A
separate human unit is required before `git commit` / `git push` and before
starting `R2H-T2-2`. Deferred by closure: R014/R015 → T2-2; manifest/QR/
check-in → T2-3; offline queue / sync / conflicts → T2-4; HTTPS prod and
domain IndexedDB → later units.

## J. Change log

| Version | Date | Notes |
|---|---|---|
| 0.1.0 | 2026-07-31 | Created after Project Owner approval of SPEC-060 v0.1.0. Documentary only. |
| 0.1.1 | 2026-07-31 | Recorded R2H-T2-1B local implementation pending CTO review. |
| 0.1.2 | 2026-07-31 | T2-1C CHANGES_REQUIRED; T2-1D remediation implemented; gate `READY_FOR_R2H_T2_1B_REVALIDATION`. |
| 0.1.3 | 2026-08-01 | Project Owner closed R2H-T2-1B as VALIDATED / CLOSED (local validation scope). |
| 0.1.4 | 2026-08-02 | Formalized closure docs; gate `READY_FOR_R2H_T2_1B_CLOSURE_COMMIT_REVIEW`. |

---
id: SPEC-060
title: Event Entry Operations
subtitle: Staff identity, offline check-in, synchronization and escalation
status: APPROVED
version: 0.1.0
phase: R2H-T2
created_at: 2026-07-31
approved_at: 2026-07-31
approved_by: Leandro Espinosa, Project Owner
approval_basis: Explicit Project Owner approval after R2H-T2-0C READY_FOR_APPROVAL recommendation; authorizes Tramo 2 implementation traceability preparation only; does not by itself authorize runtime implementation, migrations, InsForge writes, commit, or push
supersedes:
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-011 v0.1.0
  - SPEC-030 v0.1.0
  - SPEC-031 v0.1.0
  - SPEC-032 v0.1.0
compatible_with:
  - SPEC-040 v0.1.1
---

# SPEC-060 - Event Entry Operations

## 1. Purpose

Define the normative, reviewable contract for day-of-event entry operations:

```text
identified operational staff
→ authorized offline manifest
→ local QR validation
→ provisional offline check-in
→ durable sync queue
→ InsForge canonical reconciliation
→ conflict and incident handling
→ waiver-gated kit/chip delivery
→ escalation to solution desk
→ audit and printable continuity aid
```

This document is `APPROVED`. It authorizes preparing the Tramo 2
implementation traceability and separately reviewable unit plans. It does
**not** by itself authorize runtime code, migrations, Edge Functions, PWA
implementation, IndexedDB schemas, role provisioning, InsForge writes, Main,
production, commit, or push. Each implementation unit requires separate human
authorization.

Journey identifiers refer to product journeys in
`docs/03_CUSTOMER_JOURNEYS.md` (J5 staff check-in, J6 solution desk, J7 staff
coordinator). They MUST NOT be confused with SPEC-030 public-sales journey
labels that reuse similar numbering for purchase flows.

## 2. Authority sources

Normative authority, in descending force:

1. Explicit Project Owner approval of SPEC-060 v0.1.0 on 2026-07-31
   (America/Merida), after `R2H-T2-0B` / `R2H-T2-0C`.
2. SPEC-000 v0.2.0 `APPROVED`.
3. SPEC-001 v0.1.0 `APPROVED` (InsForge canonical; IndexedDB operational copy;
   opaque QR; offline idempotent queues; role boundaries).
4. SPEC-011 v0.1.0 `APPROVED` (PWA foundation; Cache Storage vs IndexedDB;
   no domain manifest/check-in contract inside SPEC-011).
5. SPEC-030 / SPEC-031 / SPEC-032 v0.1.0 `APPROVED` (tickets, opaque
   credentials, AccessEntitlement, revoke/reissue).
6. Product/architecture authority in `docs/00`–`docs/05`, especially
   `docs/03_CUSTOMER_JOURNEYS.md` J5–J7 and P1–P12, where not contradicted by
   approved specifications.
7. Compatibility: SPEC-040 v0.1.1 `APPROVED`.

This specification MUST NOT reopen or alter:

- `R2H-LANDING-SBX-1B` = VALIDATED / CLOSED
- `IMPL-14A-3C` = VALIDATED / CLOSED
- OD-040-002 compensating hardening = VALIDATED / CLOSED
- OD-040-002 = OPEN
- TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY
- InsForge Main / production authorization state

Approved architecture preserved:

```text
Vite + React 19 + TypeScript strict
SPA/PWA offline-first
InsForge as canonical authority
IndexedDB as operational copy
Opaque QR without PII
```

## 3. Context

As of `R2H-T2-0A` / `R2H-T2-0B`:

- N1 issues opaque ticket credentials and AccessEntitlements.
- Door check-in, offline manifest, staff assignment minimum, sync queue, and
  incidents are not implemented.
- F0-E remains `NOT STARTED` / `NOT AUTHORIZED`.
- Platform shared privileged identities prevent claiming true least privilege
  by database function; this contract requires logical separation of views and
  commands.

## 4. Scope

One coherent contract: **event entry operations**.

Includes:

1. minimum operator identity for door work;
2. authorization for event, event day, and door/area;
3. offline entry manifest generation and download;
4. operational device copy (never canonical truth);
5. local QR reading and validation;
6. provisional offline check-in;
7. durable offline operation queue;
8. synchronization with InsForge;
9. canonical duplicate and conflict resolution;
10. waiver status for kit/chip delivery authorization;
11. minimum kit/chip delivery registration;
12. automatic incident creation for non-happy paths;
13. escalation from door to solution desk boundary;
14. audit of entry actions;
15. printable continuity aid (not a second authority).

Minimum staff identity answers only:

```text
who operates
on which event
on which day
at which door or area
with which role
with what assignment validity
```

## 5. Non-goals

This specification does **not**:

- implement F0-E or select concrete service-worker / IndexedDB / QR libraries;
- define SQL, migrations, physical table names, Edge Function names, or RPCs;
- design final visual UI;
- design full warehouse/kit inventory;
- authorize on-site payments or Mercado Pago verification from the door;
- define category corrections, refunds, or direct ticket column edits;
- define timing, heats, lanes, results, or leaderboards;
- govern Staff Management (recruitment, availability, complex shift calendars,
  assignment email, advanced accreditation, drag-and-drop reassignment,
  payroll, performance evaluation);
- define internal contracts for Protected Solution Desk Actions
  (verify Mercado Pago payment, register on-site payment, refund, category
  change, sensitive data correction, ticket reissue, waiver signature);
- authorize InsForge Main or production changes;
- assert true least-privilege technical enforcement under shared platform
  identity (see §13 Risk limitation RL-060-001).

## 6. Definitions

- **Operator:** Authenticated person acting under an operational role for a
  specific assignment.
- **Assignment:** Binding of operator, role, event, event day, door/area, and
  validity window.
- **Door/area:** Named operational station for entry validation.
- **Offline entry manifest:** Versioned, expirable, integrity-protected
  minimum dataset authorizing local validation for a scoped event/day
  (and door/area when scoped).
- **Operational copy:** Device-local storage of manifest and pending
  operations; temporary; never final authority.
- **Credential fingerprint:** Verifiable opaque credential identifier or hash
  for local matching without reusable raw secrets or unnecessary PII.
- **Provisional check-in:** Locally recorded entry operation awaiting
  canonical reconciliation; sync state `PENDING_SYNC`.
- **Canonical check-in:** Server-accepted use of the applicable
  AccessEntitlement under SPEC-032 rules.
- **Idempotency key:** Client-generated identity making an operation safe under
  retries and duplicates.
- **Incident:** Structured operational exception escalated without silent loss.
- **Solution desk boundary:** Surface that receives entry incidents; protected
  corrective action internals are out of scope.
- **Operational display label:** Minimum door-safe person label sufficient for
  recognition and kit handoff.
- **Kit/chip delivery record:** Minimum audited handoff registration.
- **Printable continuity aid:** Exportable list for degraded continuity; not
  canonical authority and not a silent mutation path.
- **Waiver delivery status (manifest):** Operational result only:
  `REQUIRED_SATISFIED`, `REQUIRED_MISSING`, or `NOT_REQUIRED`.

### Separated state vocabularies

States below are conceptual. Implementations MAY map them to different
physical names if evidence preserves meaning. A single unqualified word MUST
NOT be used for two authorities.

| Vocabulary | Conceptual states | Authority |
|---|---|---|
| Door readiness | `READY`, `NOT_READY` | local, derived from session/assignment/manifest |
| Credential verification (local) | `LOCAL_VALID`, `LOCAL_INVALID` | operational copy |
| Local operation / sync | `PENDING_SYNC`, `SYNC_CONFLICT`, `CANONICALLY_ACCEPTED`, `CANONICALLY_REJECTED`, `MANUAL_REVIEW_REQUIRED` | local mirror of sync; canonical outcome decided by InsForge |
| Canonical check-in | AccessEntitlement used / Ticket exhaustion per SPEC-032 | InsForge |
| Incident | open / in progress / resolved / closed (exact labels free) | InsForge |
| Kit delivery | blocked / delivered / not applicable | InsForge + local provisional mirror |

Retired unqualified sync label `ACCEPTED` from earlier draft wording MUST be
read as `CANONICALLY_ACCEPTED`. `VALID_LOCAL` MUST be read as `LOCAL_VALID`.
`CONFLICT` MUST be read as `SYNC_CONFLICT`. `REJECTED`/`REVOKED` at sync MUST
be read as `CANONICALLY_REJECTED` with a reason class. `MANUAL_REVIEW` MUST be
read as `MANUAL_REVIEW_REQUIRED`.

## 7. Invariants

### SPEC-060-R001

InsForge MUST remain the sole canonical authority for ticket state,
credential revocation/reissue, AccessEntitlement use, operator identity,
assignment validity, conflict outcomes, and audit history.

### SPEC-060-R002

Device storage MUST be an operational copy. A successful local validation
MUST be presented as local validation passed plus check-in pending sync
(`PENDING_SYNC`). It MUST NOT be presented as final server confirmation or
`CANONICALLY_ACCEPTED`.

### SPEC-060-R003

QR credentials MUST remain opaque. QR payloads and door UI MUST NOT embed
payment tokens, medical details, emergency contacts, government ID numbers,
or other unnecessary personal data.

### SPEC-060-R004

Happy-path door check-in MUST complete with 0–2 operator touches. Scanning a
locally valid QR MUST itself create the provisional check-in when the local
result is accepting.

### SPEC-060-R005

Door staff MUST NOT resolve complex exceptions by improvisation. The system
MUST create or link an incident and present an explicit next step toward
solution desk.

### SPEC-060-R006

When two provisional operations compete for the same applicable
AccessEntitlement, the first operation accepted by the server MUST win. The
losing operation MUST become `SYNC_CONFLICT` or `MANUAL_REVIEW_REQUIRED` with
incident linkage and MUST NOT overwrite the winner or erase history.

### SPEC-060-R007

Entry scanning MUST continue without network connectivity when a valid
manifest and authorized session/assignment exist. Synchronization MUST be
automatic on reconnect and MUST NOT be a mandatory manual staff task for
ordinary recovery.

### SPEC-060-R008

Kit or chip delivery MUST NOT be recorded unless the person has an accepting
local or canonical check-in path for that entitlement and every required
waiver condition for that delivery is satisfied according to canonical
waiver delivery status.

### SPEC-060-R009

Sensitive mutations MUST execute as named protected business commands with
authorization, validation, backend mutation, result, and append-only audit.
Direct editing of canonical state columns from UI MUST be prohibited.

### SPEC-060-R010

No conflict, rejection, or sync failure MAY silently drop an operation or
rewrite history without an observable outcome and audit trail.

### SPEC-060-R011

Implementation MUST enforce logical separation of role views and commands for
entry roles. Evidence and documentation MUST NOT claim true least-privilege
technical enforcement by database role while shared privileged platform
identities remain capable of bypassing row-level controls.

### SPEC-060-R012

SPEC-032 remains controlling: using one day entitlement MUST NOT exhaust a
multi-day Ticket while future entitlements remain; daily use MUST mark only
the applicable AccessEntitlement.

## 8. Functional requirements

### 8.1 Operator identity and assignment

### SPEC-060-R013

An operator MUST authenticate before door operation and MUST hold one of the
roles in §9 for the actions attempted.

### SPEC-060-R014

Door operation MUST require a current assignment binding operator, role,
event, event day, and door/area within a validity window.

### SPEC-060-R015

The system MUST deny door readiness (`NOT_READY`) when session is expired,
assignment is absent/expired, event/day/door selection is wrong, or the
manifest is missing, expired, or corrupt. New provisional accepts MUST NOT be
created while `NOT_READY`.

> **Scope note (former R016):** Staff Management topics listed in §5 remain
> non-goals. No requirement ID is needed for that exclusion.

### 8.2 Offline entry manifest

### SPEC-060-R017

InsForge MUST produce a versioned offline entry manifest scoped at minimum by
event and event day, and MAY further scope by door/area when configured.

### SPEC-060-R018

Each manifest MUST expose: event identity, day identity, version,
generated-at, expires-at (positive explicit TTL), integrity proof, scope,
revocation-aware credential status for included entries, and auditability of
generation (who/what generated it and when).

### SPEC-060-R019

A device MUST store at most one effective operational manifest version per
scope. Downloading a newer valid version MUST replace the previous local
version for that scope without deleting pending local operations.

### SPEC-060-R020

Manifest TTL MUST be explicit, positive, bound to the event/day scope, known
to the client, and configurable only by an authorized role. After expiry or
integrity failure the device MUST become `NOT_READY`, MUST block new local
acceptances, and MUST NOT accept indefinitely. Pending operations already
queued MUST remain until reconciled under §8.5.

### SPEC-060-R021

Logout, assignment end, or explicit invalidation MUST render the operational
manifest unusable for new accepts and MUST preserve non-terminal pending
queue items under R048 / R085.

### SPEC-060-R022

Manifest entries MAY include only need-to-know door fields:

```text
ticket or access-entitlement identifier
credential fingerprint / verifiable hash
operational display label (minimum)
category (when applicable)
size/kit indicator (when delivery applies)
waiver delivery status: REQUIRED_SATISFIED | REQUIRED_MISSING | NOT_REQUIRED
ticket/entitlement status
revocation status
manifest version
```

Waiver delivery status MUST reflect canonical product/registration
configuration evaluated server-side. The client MUST NOT invent waiver
obligation.

### SPEC-060-R023

Manifests MUST NOT include financial records, payment tokens, detailed
medical data, full emergency contacts, identity documents, secrets, reusable
raw QR token material when a fingerprint/hash suffices, or any medical signal
unless a later approved privacy decision explicitly authorizes one under
OD-060-006. Default MUST be no medical signal in the check-in manifest.

### SPEC-060-R024

Full legal name MUST NOT be required when a reduced operational display label
satisfies door recognition and safe kit handoff.

### 8.3 Local validation and check-in

### SPEC-060-R025

CHECKIN_STAFF MUST have one primary operating screen for scanning, result
presentation, pending count, and escalation entry points.

### SPEC-060-R026

With a valid manifest and no network, scanning a locally valid active
credential MUST:

1. validate against the operational copy without a mandatory network call
   (`LOCAL_VALID`);
2. present a green semaphore that communicates both
   `LOCAL VALIDATION PASSED` and `CHECK-IN PENDING SYNC` (not canonical
   acceptance);
3. show operational display label and, when applicable, category and size/kit
   indicator;
4. record a provisional check-in as `PENDING_SYNC`;
5. enqueue synchronization.

### SPEC-060-R027

Manual search MUST be available when a QR cannot be used. After at least
three characters, local results MUST appear from the operational copy.
Selecting a person MUST follow the same provisional path with at most two
touches total. Keyboard MUST NOT be required except for that search.

### SPEC-060-R028

Every non-accepting result MUST present reason and next step on the same
screen at semaphore scale suitable for outdoor readability. Generic failures
without an operational next step are prohibited.

### SPEC-060-R029

Local validation MUST reject unknown, revoked, superseded-reissued, wrong
scope, and same-device duplicate local accepts with distinct actionable
reasons.

### SPEC-060-R030

After `CANONICALLY_ACCEPTED`, the applicable AccessEntitlement MUST be used
per SPEC-032. A later scan MUST NOT create a second canonical use.

### SPEC-060-R036

Door UI MUST NOT ask for data already present in the operational copy (size,
category, folio/label).

### SPEC-060-R039

An authorized printable continuity aid derived from the authorized manifest
scope MUST be available before doors open, without prohibited data classes
from R023. The printable aid MUST NOT be treated as canonical authority and
MUST NOT authorize silent later mutations. When paper mode is used, the
system MUST record degraded-mode use; subsequent capture/reconciliation MUST
occur; discrepancies MUST create incident and/or audit entries.

### SPEC-060-R084

If a provisional local accept later becomes `CANONICALLY_REJECTED` or
`SYNC_CONFLICT`, the system MUST preserve evidence, create or link an
incident, notify or queue the case for solution desk, and MUST NOT overwrite
prior local or canonical history.

### 8.4 Offline queue and synchronization

### SPEC-060-R041

Every queued entry operation MUST carry at least:

```text
operation identifier
idempotency key
event identifier
ticket or access-entitlement identifier
operator identifier
device identifier
door/area identifier
captured_at
queued_at
operation type
sync state
attempt count
last error classification
```

Local `captured_at` is evidence. It MUST NOT establish canonical ordering.

### SPEC-060-R042

Queued operations MUST survive browser reload, application restart, and
temporary process termination on the same device profile.

### SPEC-060-R043

The client MUST prevent double submission of the same idempotency key from
the same device. The server MUST enforce idempotency for retries.

### SPEC-060-R044

While online or upon reconnect, the client MUST synchronize automatically
with retry and backoff for recoverable errors.

### SPEC-060-R045

Recoverable sync errors MUST remain queued. Non-recoverable terminal
rejections MUST move to a terminal local mirror state with reason, next step,
and incident linkage when required.

### SPEC-060-R046

Ambiguous server responses MUST leave the operation `PENDING_SYNC`. They MUST
NOT silently accept or discard.

### SPEC-060-R047

The primary door screen MUST show a discreet count of pending sync
operations and enough sync-health visibility to operate without a separate
troubleshooting application.

### SPEC-060-R048

Logout with pending operations MUST warn the operator and MUST NOT delete
non-terminal pending operations. A recoverable path MUST exist for the same
authorized operator/device profile under the retention policy in R085.

### SPEC-060-R049

Application updates MUST NOT discard pending operations without migration or
an explicit recoverable export/import path.

### SPEC-060-R085

Non-terminal queued operations MUST NOT be deleted automatically by ordinary
client lifecycle events. Retention MUST have a documented finite policy.
Purge MUST occur only after a terminal sync state or an audited
administrative action. Local storage exhaustion MUST stop new writes and
escalate; it MUST NOT silently drop existing non-terminal operations.
Cross-device transfer of pending operations is not required by this contract
unless a later decision authorizes it.

### SPEC-060-R086

Device clock MUST NOT establish canonical authority. Detected skew beyond the
configured limit MUST be shown to the operator and MUST force degraded
readiness or `MANUAL_REVIEW_REQUIRED` for new accepts according to
configuration. Local timestamps remain evidentiary. Server acceptance order
determines canonical conflict winners.

### 8.5 Conflict scenarios

### SPEC-060-R050

Same credential accepted offline on two devices: server accepts exactly one
canonical check-in; the other becomes `SYNC_CONFLICT` /
`MANUAL_REVIEW_REQUIRED` with automatic incident; neither history is erased.

### SPEC-060-R051

Credential revoked after manifest download: provisional local accept may
exist, but sync MUST deny canonical acceptance (`CANONICALLY_REJECTED`),
create/link incident, and preserve attempt audit.

### SPEC-060-R052

Credential reissued: previous generation MUST fail validation or sync; active
replacement MAY succeed only if present and authorized; door MUST explain
supersession and next step.

### SPEC-060-R055

Wrong event/day/door: validation MUST reject with corrective next step.

### SPEC-060-R056

Duplicate operation from the same device/idempotency key MUST be idempotent
at server with no second canonical use.

### 8.6 Waiver, kit, and chip

### SPEC-060-R058

When kit/chip delivery applies, delivery registration MUST require an
accepting check-in path for that person/entitlement and waiver delivery
status `REQUIRED_SATISFIED`. Status `NOT_REQUIRED` permits delivery without
waiver. Status `REQUIRED_MISSING` blocks delivery.

### SPEC-060-R059

If waiver delivery status is `REQUIRED_MISSING`, delivery MUST be blocked,
next step MUST be visible, and an incident or escalation path MUST be
created or linked.

### SPEC-060-R060

Team members MUST each have individual check-in and individual waiver
delivery status. A captain MUST NOT satisfy another member's waiver or
check-in.

### SPEC-060-R061

A minimum delivery record MUST capture article type, delivery state,
operator, timestamp, device/station, link to ticket or participant, and
audit.

### SPEC-060-R062

Products that do not require kit/chip MAY complete entry without a delivery
record. Absence of delivery requirement MUST NOT bypass waiver requirements
for products that do require delivery.

### 8.7 Incidents and solution desk boundary

### SPEC-060-R063

Door incidents MUST support creation, classification, severity, responsible
queue (solution desk by default for entry exceptions), state, resolution
summary, closure, and audit.

### SPEC-060-R064

Door MAY identify person/ticket context, show reason, create/link incident,
and channel the person. Door MUST NOT change payments, mutate tickets,
change categories, mark waivers satisfied through unrestricted edits, or
correct sensitive registration fields.

### SPEC-060-R065

Solution desk is the contractual next hop for entry incidents. This
specification requires that any later sensitive desk correction use a
protected business command with authorization, validation, audit, and
result. Internal contracts for verify-payment, on-site payment, refund,
category change, sensitive correction, ticket reissue, and waiver signature
MUST be defined in a later Protected Solution Desk Actions specification and
MUST NOT be implemented from door UI under this contract.

### SPEC-060-R066

Incident closure MUST be auditable. Returning a person to the door after
resolution MUST leave an observable resolved state consumable by door staff.

### SPEC-060-R067

Authorized operations roles MUST be able to export the printable continuity
aid under R039.

## 9. Roles and data limits

### SPEC-060-R068

This contract defines exactly these operational roles for entry:

```text
OWNER
OPERATIONS_MANAGER
CHECKIN_STAFF
SOLUTION_DESK
```

| Role | Allowed views | Allowed actions | Minimum visible data | Prohibited data / actions | Audit |
|---|---|---|---|---|---|
| OWNER | entry readiness oversight | authorize minimum assignments and exceptional overrides defined later | event/day readiness, open incidents summary | MUST NOT use entry UI as finance workstation; no medical detail by default | overrides audited |
| OPERATIONS_MANAGER | readiness, minimum assignments, incident overview | manage minimum door assignments; printable continuity aid | assignment, pending counts, incident queues | MUST NOT expose full financial ledgers at door | assignment/readiness audited |
| CHECKIN_STAFF | one primary check-in screen | scan/search, provisional check-in, kit delivery when allowed, create/link incident, escalate | operational display label, category, size/kit, waiver delivery status, ticket/entitlement status | MUST NOT view complete financial information; MUST NOT receive medical detail | every accept/reject/delivery/incident audited |
| SOLUTION_DESK | incident and needed person context | receive/close entry incidents; later protected commands only | fields needed for the assigned case | only data necessary for the assigned incident | every protected command and closure audited |

### SPEC-060-R069

CHECKIN_STAFF MUST NOT edit payments or view complete financial records.

### SPEC-060-R070

CHECKIN_STAFF MUST NOT receive medical detail. Default check-in manifest and
door UI MUST include no medical signal. Any future binary/categorical
operational signal requires explicit documentary authority, operational
purpose, defined viewers, no diagnosis disclosure, and access audit, and is
governed by OD-060-006.

### SPEC-060-R071

SOLUTION_DESK MAY access only data necessary to resolve the assigned incident
and MUST execute sensitive corrections only through protected business
commands defined in a later specification.

## 10. Non-functional requirements

### SPEC-060-R073

Local validation against a resident manifest MUST avoid mandatory network
round-trips on the happy path.

### SPEC-060-R075

Manifest download and sync interfaces MUST apply abuse/rate controls where
exposed. Under expected multi-device door load, ordinary authorized sync MUST
remain usable. Unauthorized or abusive call floods MUST be limited or denied
observably without granting canonical check-in.

### SPEC-060-R076

Replay of captured credential material MUST NOT create additional canonical
uses beyond idempotent replay of the same operation identity.

### SPEC-060-R079

Operational local data MUST be confined to the application origin and
platform storage controls available to that origin. Secrets, payment tokens,
and raw reusable QR material MUST NOT be stored in the operational copy or
written to client logs. Where the platform provides encryption-at-rest for
origin storage, the implementation MUST not disable it for entry data.
Evidence MUST NOT claim stronger confidentiality than the browser/OS
provides.

## 11. Interfaces and contracts

### 11.1 Canonical vs provisional authority

| Concern | Provisional (device) | Canonical (InsForge) |
|---|---|---|
| QR read / local match | `LOCAL_VALID` / `LOCAL_INVALID` | verified on sync |
| check-in acceptance | `PENDING_SYNC` | `CANONICALLY_ACCEPTED` / entitlement used |
| revoke/reissue truth | snapshot warning | final |
| conflicts | local mirror + keep queue | winner selection |
| operator/assignment | session cache | final authorization |
| timestamps | evidentiary `captured_at` | server order / audit |
| paper list | continuity aid only | never |
| audit | local operation record | append-only server audit |

### 11.2 Reconciliation rules

```text
server accepts
→ CANONICALLY_ACCEPTED
→ AccessEntitlement used per SPEC-032

server detects duplicate
→ first accepted remains canonical
→ second → SYNC_CONFLICT + incident
→ history preserved

server detects revoked/superseded credential
→ CANONICALLY_REJECTED
→ incident
→ history preserved

server cannot decide / ambiguous
→ remains PENDING_SYNC
→ never silent drop
```

### 11.3 Interfaces reserved for Tramo 3

```text
operator/staff identity
event day
venue area / door
participant or entitlement checked-in state
incident escalation envelope
offline operation envelope
device identity
append-only audit convention
```

MUST NOT define heats, lanes, timing, penalties, result states, or
leaderboards.

### 11.4 Future dependencies (not authorized by SPEC-060 alone)

```text
F0-E / R2H-T2-1   PWA shell and operational roles
R2H-T2-2          Minimum staff identity and assignments
R2H-T2-3          Manifest and online check-in
R2H-T2-4          Offline queue and synchronization
R2H-T2-5          Kits, waiver and incidents
R2H-T2-6          Physical offline rehearsal
Protected Solution Desk Actions specification (separate)
Staff Management specification (separate; 080-089 range)
```

## 12. Failure modes

| Failure | Detection | Behavior | Message / next step | Audit | Recovery |
|---|---|---|---|---|---|
| No manifest | readiness | `NOT_READY` | obtain authorized manifest | deny | download |
| Manifest expired/corrupt | TTL/integrity | `NOT_READY`; block new accepts | refresh manifest | expiry/integrity | re-download |
| Local storage full | write failure | stop new writes; keep existing non-terminal ops | free space / escalate | storage error | reclaim; retry |
| Camera denied | permission | offer manual search | enable camera or search | UX event optional | grant/search |
| QR unreadable | decode fail | stay ready; offer search | rescan/search | n/a | retry |
| Unknown ticket | local miss | red reject + incident | solution desk | reject+incident | desk |
| Revoked / superseded | local/server | reject or `CANONICALLY_REJECTED` | supersession guidance | reject+incident | desk/reissue path later |
| Already used / cross-device | local or server | reject or `SYNC_CONFLICT` | desk if dispute | conflict+incident | desk |
| Unauthorized operator | auth/assignment | fail closed | contact coordinator | deny | restore assignment |
| Device clock skew beyond limit | skew check | degraded / block new accepts per config | fix device time / escalate | clock anomaly | correct clock |
| Damaged queue | integrity fail | quarantine; no silent loss | escalate with export | queue damage | repair path |
| App update | update gate | preserve queue | update when safe | update notice | migrate |
| Partial sync | mixed results | keep unsynced pending | automatic retry | per-op | retry |
| Ambiguous server response | non-decisive | keep `PENDING_SYNC` | continue scanning | ambiguity | retry/ops |
| Logout with pendings | logout | warn; preserve non-terminal | sync or confirm defer | logout warning | same profile |
| Post-green canonical reject | sync result | preserve evidence; incident; desk queue | person may need desk | both sides audited | reconciliation |
| Paper continuity used | degraded mode flag | record degraded use; reconcile later | capture/reconcile | degraded-mode audit | resolve discrepancies via incident |

## 13. Security and privacy

### SPEC-060-R077

Door logs MUST NOT record raw secrets, payment tokens, or full sensitive
payloads. QR remains opaque per SPEC-001/SPEC-032.

### SPEC-060-R078

Operational copies MUST be minimized by event, day, role, device, and purpose
and MUST become unusable for new accepts on logout, assignment end, or
manifest expiry.

### SPEC-060-R080

Financial detail MUST NOT appear on CHECKIN_STAFF surfaces.

### SPEC-060-R081

Manifest download, check-in sync, and incident creation MUST require
authenticated authorized operators with valid assignment context.

### SPEC-060-R082

Canonical audit records for accepts, rejects, deliveries, conflicts, and
incidents MUST be append-only and MUST include actor, device, door/area,
timestamps, operation identity, and outcome classification without secrets.

### Risk limitation RL-060-001 (non-normative requirement ID)

Shared `project_admin` and BYPASSRLS platform capabilities mean this contract
demands separation of views and commands (R011) and MUST NOT be cited as proof
of true least privilege by database role. Former draft requirement R083 was
retired into this limitation to avoid a non-testable “caveat requirement.”

## 14. Acceptance criteria

### SPEC-060-AC001

- **Precondition:** Authorized CHECKIN_STAFF; valid assignment; non-expired
  manifest; network disabled.
- **Actor:** CHECKIN_STAFF.
- **Action:** Scan a locally valid active credential.
- **Observable result:** Green result communicates local validation passed and
  check-in pending sync; a `PENDING_SYNC` operation is recorded with no
  mandatory network request.
- **Canonical/local:** Local only; not `CANONICALLY_ACCEPTED`.

### SPEC-060-AC002

- **Precondition:** AC001.
- **Actor:** CHECKIN_STAFF.
- **Action:** Observe green result after scan.
- **Observable result:** Operational display label shown; category and
  size/kit when applicable; 0 additional touches after scan.
- **Canonical/local:** Local presentation of provisional accept.

### SPEC-060-AC003

- **Precondition:** Valid manifest; no usable QR.
- **Actor:** CHECKIN_STAFF.
- **Action:** Type ≥3 characters, select one local match.
- **Observable result:** Provisional check-in enqueued in ≤2 touches.
- **Canonical/local:** `PENDING_SYNC`.

### SPEC-060-AC004

- **Precondition:** Two devices each recorded provisional accept for the same
  AccessEntitlement offline.
- **Actor:** system sync.
- **Action:** Both devices synchronize.
- **Observable result:** Exactly one `CANONICALLY_ACCEPTED`; the other
  `SYNC_CONFLICT`/`MANUAL_REVIEW_REQUIRED` with incident; both auditable.
- **Failure result:** No silent drop; no double canonical use.

### SPEC-060-AC005

- **Precondition:** Credential revoked after manifest generation; provisional
  local accept exists.
- **Actor:** system sync.
- **Action:** Sync the provisional operation.
- **Observable result:** Not `CANONICALLY_ACCEPTED`; `CANONICALLY_REJECTED`;
  incident exists; history preserved.

### SPEC-060-AC006

- **Precondition:** Credential reissued; prior generation presented.
- **Actor:** CHECKIN_STAFF / sync.
- **Action:** Validate or sync prior generation.
- **Observable result:** No new canonical check-in from prior generation;
  supersession reason and next step shown.

### SPEC-060-AC007

- **Precondition:** Manifest expired or corrupt.
- **Actor:** CHECKIN_STAFF.
- **Action:** Attempt door readiness / new accept.
- **Observable result:** `NOT_READY`; refresh/next step shown; no new
  provisional accept.

### SPEC-060-AC008

- **Precondition:** At least one `PENDING_SYNC` operation exists.
- **Actor:** CHECKIN_STAFF / runtime.
- **Action:** Close and reopen the application on the same device profile.
- **Observable result:** Pending operation still present until terminal sync
  outcome.

### SPEC-060-AC009

- **Precondition:** Recoverable connectivity loss during sync.
- **Actor:** system.
- **Action:** Network returns.
- **Observable result:** Operations remain queued and sync automatically
  without requiring a staff “sync now” action as the only path.

### SPEC-060-AC010

- **Precondition:** Ambiguous server response to a sync attempt.
- **Actor:** system.
- **Action:** Process response.
- **Observable result:** Operation remains `PENDING_SYNC`; not silently
  accepted or discarded.

### SPEC-060-AC011

- **Precondition:** Red-path validation (unknown, revoked, already used, wrong
  scope).
- **Actor:** CHECKIN_STAFF.
- **Action:** Scan or select subject.
- **Observable result:** Same screen shows reason and next step; incident
  created/linked when escalation is required.

### SPEC-060-AC012

- **Precondition:** Kit/chip delivery applies; waiver delivery status
  `REQUIRED_MISSING`.
- **Actor:** CHECKIN_STAFF.
- **Action:** Attempt delivery registration.
- **Observable result:** Delivery blocked; next step/escalation visible.

### SPEC-060-AC013

- **Precondition:** Kit/chip delivery applies; waiver `REQUIRED_SATISFIED`;
  accepting check-in path exists.
- **Actor:** CHECKIN_STAFF.
- **Action:** Register delivery.
- **Observable result:** Minimum delivery record written with article type,
  operator, timestamp, device/station, subject link, and audit.

### SPEC-060-AC014

- **Precondition:** Multi-member team.
- **Actor:** CHECKIN_STAFF.
- **Action:** Complete check-in/waiver for member A.
- **Observable result:** Member B remains unchanged for check-in and waiver
  delivery status.

### SPEC-060-AC015

- **Precondition:** CHECKIN_STAFF session.
- **Actor:** CHECKIN_STAFF / API under that session.
- **Action:** Exercise door views/commands.
- **Observable result:** Complete financial records absent.

### SPEC-060-AC016

- **Precondition:** CHECKIN_STAFF session; no approved medical-signal decision.
- **Actor:** CHECKIN_STAFF.
- **Action:** Load manifest / door UI.
- **Observable result:** No medical detail and no medical signal present.

### SPEC-060-AC017

- **Precondition:** Door staff session.
- **Actor:** CHECKIN_STAFF.
- **Action:** Attempt payment/ticket-category/sensitive-field mutation from
  check-in UI.
- **Observable result:** Mutation unavailable; only named entry commands and
  incident create/link available.

### SPEC-060-AC018

- **Precondition:** Open entry incident.
- **Actor:** SOLUTION_DESK.
- **Action:** Open assigned incident.
- **Observable result:** Classification, severity, state, and audit fields
  needed to own the case are visible. This AC does not require Mercado Pago
  verification or on-site payment implementation.

### SPEC-060-AC019

- **Precondition:** Authorized operations role; valid manifest scope.
- **Actor:** OPERATIONS_MANAGER or OWNER as authorized.
- **Action:** Export printable continuity aid.
- **Observable result:** Export produced without prohibited
  financial/medical/secret classes; aid is not treated as canonical mutation
  authority.

### SPEC-060-AC020

- **Precondition:** Active operational manifest.
- **Actor:** CHECKIN_STAFF.
- **Action:** Logout or assignment end.
- **Observable result:** Manifest unusable for new accepts; non-terminal
  pending operations not silently deleted.

### SPEC-060-AC021

- **Precondition:** Operator without valid assignment or wrong event/day/door.
- **Actor:** operator.
- **Action:** Attempt readiness / provisional accept.
- **Observable result:** Fail closed; no new provisional accept.

### SPEC-060-AC022

- **Precondition:** Sync of a winning provisional operation.
- **Actor:** system.
- **Action:** Server accepts.
- **Observable result:** Applicable AccessEntitlement canonically used;
  repeat scan cannot create a second canonical use.

### SPEC-060-AC023

- **Precondition:** Multi-day ticket with remaining future entitlements.
- **Actor:** system.
- **Action:** Canonical accept for one day entitlement.
- **Observable result:** Whole Ticket is not exhausted contrary to SPEC-032.

### SPEC-060-AC024

- **Precondition:** Pending count > 0.
- **Actor:** CHECKIN_STAFF.
- **Action:** View primary door screen.
- **Observable result:** Discreet pending indicator shows the count.

### SPEC-060-AC025

- **Precondition:** Accept, reject, delivery, conflict, and incident paths
  exercised.
- **Actor:** auditor / test harness.
- **Action:** Inspect canonical audit records.
- **Observable result:** Actor, device, door/area, timestamps, operation
  identity, and outcome present; secrets absent.

### SPEC-060-AC026

- **Precondition:** Provisional local accept later rejected or conflicted by
  server.
- **Actor:** system.
- **Action:** Apply canonical sync outcome.
- **Observable result:** Evidence preserved; incident created/linked; solution
  desk receives/owns the case; history not overwritten.

### SPEC-060-AC027

- **Precondition:** Paper continuity aid used during degraded operation.
- **Actor:** OPERATIONS_MANAGER / CHECKIN_STAFF as authorized.
- **Action:** Mark/use paper mode and later reconcile.
- **Observable result:** Degraded-mode use recorded; discrepancies produce
  incident and/or audit; paper list alone does not mutate canonical state.

### SPEC-060-AC028

- **Precondition:** Manifest generated with explicit positive TTL.
- **Actor:** authorized generator role / CHECKIN_STAFF client.
- **Action:** Inspect manifest metadata and wait until after expires-at.
- **Observable result:** Client knows expires-at; after expiry device is
  `NOT_READY` and blocks new accepts; generation is auditable.

### SPEC-060-AC029

- **Precondition:** Device clock skew beyond configured limit.
- **Actor:** CHECKIN_STAFF device.
- **Action:** Attempt new accepts.
- **Observable result:** Skew is shown; new accepts enter degraded block or
  `MANUAL_REVIEW_REQUIRED` per configuration; local timestamps remain
  evidentiary only.

### SPEC-060-AC030

- **Precondition:** Non-terminal pending operations exist; logout attempted.
- **Actor:** CHECKIN_STAFF.
- **Action:** Confirm logout.
- **Observable result:** Warning shown; pendings retained under retention
  policy; no automatic purge of non-terminal ops.

### SPEC-060-AC031

- **Precondition:** Exposed manifest download or sync interface; abusive
  unauthenticated or unauthorized flood fixture.
- **Actor:** test harness.
- **Action:** Flood interface; separately perform ordinary authorized door
  sync under expected multi-device load fixture.
- **Observable result:** Abusive flood limited/denied; ordinary authorized sync
  remains usable; flood does not create canonical check-ins.

### SPEC-060-AC032

- **Precondition:** Operational copy populated for door work.
- **Actor:** test harness.
- **Action:** Inspect stored operational copy and client logs for entry flows.
- **Observable result:** No secrets, payment tokens, or raw reusable QR
  material stored/logged; data confined to application origin storage.

## 15. Validation plan

Validation remains deferred until individually authorized implementation
units execute. Planned evidence: unit tests, sync conflict integration tests,
role/privacy tests, offline persistence, Playwright door paths, and physical
offline rehearsal (`R2H-T2-6`).

## 16. Traceability

| Requirement | Acceptance criteria | Authority source | Planned implementation unit |
|---|---|---|---|
| R001 | AC004, AC005, AC022, AC025 | SPEC-001 | R2H-T2-3, R2H-T2-4 |
| R002 | AC001, AC002, AC026 | SPEC-001; docs/03 J5 | R2H-T2-3, R2H-T2-4 |
| R003 | AC002, AC015, AC016, AC019, AC025, AC032 | SPEC-001; SPEC-032 | R2H-T2-3 |
| R004 | AC001, AC002, AC003 | docs/03 P1/J5 | R2H-T2-3 |
| R005 | AC011 | docs/03 P11/J5 | R2H-T2-5 |
| R006 | AC004 | docs/03 J5; SPEC-001 | R2H-T2-4 |
| R007 | AC001, AC009 | docs/03 P5/J5 | R2H-T2-4 |
| R008 | AC012, AC013 | docs/03 J5 | R2H-T2-5 |
| R009 | AC017, AC018 | docs/03 P7; SPEC-001 | R2H-T2-5 + later desk SPEC |
| R010 | AC004, AC005, AC010, AC026 | SPEC-001 | R2H-T2-4 |
| R011 | AC015, AC016, AC017 | SPEC-001; RL-060-001 | R2H-T2-1 |
| R012 | AC022, AC023 | SPEC-032 | R2H-T2-3, R2H-T2-4 |
| R013 | AC021 | docs/03 J5 | R2H-T2-1, R2H-T2-2 |
| R014 | AC021 | docs/03 J5/J7 min | R2H-T2-2 |
| R015 | AC007, AC020, AC021 | docs/03 J5 | R2H-T2-2, R2H-T2-3 |
| R017 | AC001, AC007, AC028 | docs/03 J5 | R2H-T2-3 |
| R018 | AC007, AC019, AC028 | docs/03 J5 | R2H-T2-3 |
| R019 | AC007, AC008 | docs/03 J5 | R2H-T2-3, R2H-T2-4 |
| R020 | AC007, AC028 | OD-060-001 bounded; docs/03 J5 | R2H-T2-3 |
| R021 | AC020, AC030 | docs/03 J5 | R2H-T2-3, R2H-T2-4 |
| R022 | AC002, AC012, AC016, AC019 | docs/03 J5; OD-060-005 | R2H-T2-3, R2H-T2-5 |
| R023 | AC015, AC016, AC019, AC032 | SPEC-001 | R2H-T2-3 |
| R024 | AC002 | docs/03 J5; OD-060-004 | R2H-T2-3 |
| R025 | AC001, AC024 | docs/03 P2 | R2H-T2-1, R2H-T2-3 |
| R026 | AC001, AC002 | docs/03 J5/P3 | R2H-T2-3, R2H-T2-4 |
| R027 | AC003 | docs/03 J5/P4 | R2H-T2-3 |
| R028 | AC011 | docs/03 P3/P9 | R2H-T2-3, R2H-T2-5 |
| R029 | AC011 | docs/03 J5 | R2H-T2-3 |
| R030 | AC022 | SPEC-032 | R2H-T2-3, R2H-T2-4 |
| R036 | AC002 | docs/03 P8 | R2H-T2-3 |
| R039 | AC019, AC027 | docs/03 P12 | R2H-T2-3, R2H-T2-6 |
| R041 | AC008, AC025, AC029 | SPEC-001 | R2H-T2-4 |
| R042 | AC008 | docs/03 J5 | R2H-T2-4 |
| R043 | AC004, AC022 | SPEC-001 | R2H-T2-4 |
| R044 | AC009 | docs/03 P5 | R2H-T2-4 |
| R045 | AC005, AC009, AC011, AC026 | docs/03 J5 | R2H-T2-4, R2H-T2-5 |
| R046 | AC010 | SPEC-001 | R2H-T2-4 |
| R047 | AC024 | docs/03 J5 | R2H-T2-3, R2H-T2-4 |
| R048 | AC008, AC020, AC030 | OD-060-003 bounded | R2H-T2-4 |
| R049 | AC008 | SPEC-011/domain continuity | R2H-T2-4 |
| R050 | AC004 | docs/03 J5 | R2H-T2-4 |
| R051 | AC005 | docs/03 J5; SPEC-032 | R2H-T2-4 |
| R052 | AC006 | SPEC-032 | R2H-T2-3, R2H-T2-4 |
| R055 | AC011, AC021 | docs/03 J5 | R2H-T2-3 |
| R056 | AC022 | SPEC-001 | R2H-T2-4 |
| R058 | AC012, AC013 | docs/03 J5; OD-060-005 | R2H-T2-5 |
| R059 | AC012 | docs/03 J5 | R2H-T2-5 |
| R060 | AC014 | docs/03 J5 | R2H-T2-5 |
| R061 | AC013 | docs/03 J5 | R2H-T2-5 |
| R062 | AC012, AC013 | docs/03 J5 | R2H-T2-5 |
| R063 | AC011, AC018 | docs/03 J5/J6 | R2H-T2-5 |
| R064 | AC017 | docs/03 J5/J6 | R2H-T2-5 |
| R065 | AC018 | docs/03 J6 | R2H-T2-5 + desk SPEC |
| R066 | AC018 | docs/03 J6 | R2H-T2-5 |
| R067 | AC019, AC027 | docs/03 P12 | R2H-T2-3 |
| R068 | AC015–AC018, AC021 | docs/03; SPEC-001 | R2H-T2-1, R2H-T2-2 |
| R069 | AC015, AC017 | docs/03 J11/J5 | R2H-T2-1 |
| R070 | AC016 | docs/03; OD-060-006 | R2H-T2-3 |
| R071 | AC018 | docs/03 J6 | desk SPEC |
| R073 | AC001 | docs/03 J5 | R2H-T2-3 |
| R075 | AC031 | SPEC-001 abuse boundary | R2H-T2-3, R2H-T2-4 |
| R076 | AC022 | SPEC-001/032 | R2H-T2-4 |
| R077 | AC025, AC032 | SPEC-001/032 | all T2 |
| R078 | AC007, AC020 | SPEC-001 | R2H-T2-3, R2H-T2-4 |
| R079 | AC032 | SPEC-001 | R2H-T2-4 |
| R080 | AC015 | docs/03 | R2H-T2-1 |
| R081 | AC021 | SPEC-001 | R2H-T2-1…T2-4 |
| R082 | AC025 | SPEC-001 | all T2 |
| R084 | AC026 | docs/03 J5 | R2H-T2-4, R2H-T2-5 |
| R085 | AC008, AC030 | OD-060-003 bounded | R2H-T2-4 |
| R086 | AC029 | OD-060-002 bounded | R2H-T2-3, R2H-T2-4 |

Retired IDs (see change log): R016, R031–R035, R037, R038, R040, R053, R054,
R057, R072, R074, R083.

Control counts for the approved v0.1.0 revision:

```text
mandatory requirements without AC = 0
acceptance criteria without requirement = 0
duplicate requirement IDs = 0
duplicate acceptance IDs = 0
```

## 17. Open decisions

### Classification legend

```text
Open but bounded
Resolved by authority
Deferred to later specification
Blocking before implementation unit
Blocking before physical validation
```

### OD-060-001 Manifest TTL and refresh cadence

| Field | Value |
|---|---|
| Decision owner | Project Owner (ops config); CTO reviews defaults |
| Decision deadline | Before R2H-T2-3 validation |
| Blocking stage | `NON_BLOCKING_FOR_SPEC_APPROVAL`; `BLOCKING_BEFORE_T2-3_VALIDATION` for numeric default |
| Safe invariant already fixed | Explicit positive TTL; event/day bound; authorized configurability; client-known expiry; block new accepts on expiry; generation audited; no indefinite silent accept (R018/R020/AC028) |
| Remains configurable | Concrete TTL duration, refresh cadence, whether door/area scope is mandatory for HEX-2026 |
| Fallback if config absent | Implementation MUST fail closed: refuse to mark device `READY` without explicit expires-at |

### OD-060-002 Device clock tolerance

| Field | Value |
|---|---|
| Decision owner | CTO proposes; Project Owner approves numeric limit |
| Decision deadline | Before R2H-T2-3 validation |
| Blocking stage | `NON_BLOCKING_FOR_SPEC_APPROVAL`; `BLOCKING_BEFORE_T2-3_VALIDATION` for numeric skew limit |
| Safe invariant already fixed | Device clock is not canonical; skew shown; local timestamps evidentiary; server orders winners; beyond-limit forces degraded/`MANUAL_REVIEW_REQUIRED` (R086/AC029) |
| Remains configurable | Numeric skew threshold and exact degraded UX copy |
| Fallback if config absent | Treat missing skew policy as fail-closed for new accepts when skew is detected as unreliable |

### OD-060-003 Pending queue retention

| Field | Value |
|---|---|
| Decision owner | CTO proposes retention window; Project Owner approves |
| Decision deadline | Before R2H-T2-4 validation |
| Blocking stage | `NON_BLOCKING_FOR_SPEC_APPROVAL`; `BLOCKING_BEFORE_T2-4_VALIDATION` for retention duration |
| Safe invariant already fixed | Non-terminal ops not auto-deleted; logout preserves pendings; finite documented policy; purge only terminal or audited admin; storage-full no silent loss (R048/R085/AC030) |
| Remains configurable | Exact retention duration; whether any cross-device transfer is ever allowed (default: not required) |
| Fallback if config absent | Retain non-terminal ops until terminal sync or audited admin purge; never silent delete on logout |

### OD-060-004 Operational display label format

| Field | Value |
|---|---|
| Decision owner | Project Owner (product copy/privacy) |
| Decision deadline | Before R2H-T2-3 UX freeze |
| Blocking stage | `NON_BLOCKING` for SPEC approval and core check-in behavior |
| Safe invariant already fixed | Door-safe minimum label required; full legal name not mandatory (R024/AC002) |
| Remains configurable | Exact formatting, truncation, localization |
| Fallback if config absent | Use reduced operational label already present in canonical projection; do not block check-in solely for label style |

### OD-060-005 Waiver obligation by product family

| Field | Value |
|---|---|
| Decision owner | Project Owner (commercial/legal product config) |
| Decision deadline | Before R2H-T2-5 validation |
| Blocking stage | `NON_BLOCKING_FOR_SPEC_APPROVAL`; `BLOCKING_BEFORE_T2-5_VALIDATION` for which products require waiver |
| Safe invariant already fixed | Obligation comes from canonical product/registration config; manifest carries only `REQUIRED_SATISFIED` / `REQUIRED_MISSING` / `NOT_REQUIRED`; client must not invent obligation; delivery gated by status (R022/R058/R059) |
| Remains configurable | Which commercial products require waiver and whether day-of signature is required |
| Fallback if config absent | If delivery applies and status missing/unknown, treat as `REQUIRED_MISSING` (fail closed for delivery) |

### OD-060-006 Minimal medical/emergency signal

| Field | Value |
|---|---|
| Decision owner | Project Owner + privacy authority |
| Decision deadline | Before any medical signal implementation; not required for core check-in |
| Blocking stage | Deferred privacy decision; `NON_BLOCKING` for core check-in SPEC approval |
| Safe invariant already fixed | CHECKIN_STAFF MUST NOT receive medical detail; default = no medical signal in manifest (R023/R070/AC016) |
| Remains configurable | Whether any future binary/categorical non-diagnostic signal is authorized |
| Fallback if config absent | No medical signal in check-in manifest or door UI |

### Resolved by authority (not open)

- InsForge is canonical; IndexedDB is operational copy.
- Opaque QR without PII.
- First server-accepted check-in wins.
- Door escalates via incidents; does not improvise corrections.
- Paper is continuity aid, not authority.
- Protected Solution Desk Action internals deferred to later SPEC.
- Staff Management beyond minimum identity/assignment deferred.

### Deferred to later specification

- Protected Solution Desk Actions.
- Full Staff Management (080–089).
- Competition/timing modules (Tramo 3).

## 18. Change log

| Version | Date | Status | Notes |
|---|---|---|---|
| 0.1.0 | 2026-07-31 | DRAFT | Initial draft (R2H-T2-0B). |
| 0.1.0 | 2026-07-31 | DRAFT | R2H-T2-0C approval-readiness corrections: terminology local/canonical separated; green result is local+pending sync only; paper continuity non-authority; OD-060-001…006 bounded with owner/stage/fallback; R016 retired to scope note; R031–R035/R037/R038/R040/R053/R054/R057 consolidated into surviving requirements; R072/R074 retired; R083 retired to RL-060-001; R075/R079 made AC-covered; added R084–R086 and AC026–AC032. Status remains DRAFT. Not approved. |
| 0.1.0 | 2026-07-31 | APPROVED | Status transition DRAFT → APPROVED by Project Owner (Leandro Espinosa) after R2H-T2-0C `READY_FOR_APPROVAL`. Authorizes Tramo 2 implementation traceability preparation only. Runtime implementation, migrations, InsForge writes, commit, and push remain NOT AUTHORIZED until separate units. Actor: Project Owner. Reason: explicit human approval of Event Entry Operations contract. |

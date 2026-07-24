# IMPL-4 — Access Decision Pack

```text
Status: APPROVED
Mode: DOCUMENTATION-ONLY / DECISION-PREPARATION (closed)
Created: 2026-07-24
Approved_at: 2026-07-24
Approved_by: Project Owner
Approval_basis: Explicit human statement approving ACCESS-DEC-001..008
Authority basis: SPEC-000 v0.2.0, SPEC-001 v0.1.0, SPEC-030 v0.1.0,
                 SPEC-031 v0.1.0, SPEC-032 v0.1.0 APPROVED
Authorized IMPL-4 mode (when separately executed):
  RLS/access-only · local isolated validation · NO InsForge deployment
Does NOT by itself execute: SQL migration 0003, ENABLE RLS, policies,
                            grants, roles, InsForge writes, or seed execution
Gate: READY_FOR_IMPL_4_EXECUTION
```

## 1. Baseline

```text
Repository: C:\vonde\enforma-sys\ready2hybrid
Remote: https://github.com/LEANDRO140514/ready2hybrid.git
Branch: main
HEAD at pack authorship: b122dc3
origin/main at pack authorship: b122dc3

Migration 0001 blob: 99b1964b65b9590ec2f3a909e200d09457559ec5
Migration 0002 blob: 24622ab0787c4952799cde2bd93784627b39ef53
Seed 0002 blob:      f8989b2c10bb04fe258b19bf646dd650940c4944

IMPL-2: VALIDATED
IMPL-3: VALIDATED
IMPL-4: ACCESS DECISIONS APPROVED / SQL UNIT NOT STARTED
RLS enabled tables: 0
Policies: 0
InsForge writes: 0
Seed executions: 0
```

Protected paths remain unchanged by this pack:

```text
insforge/migrations/0001_minimal_sales_schema.sql
insforge/migrations/0002_sales_constraints_and_indexes.sql
insforge/seeds/0002_seeds_hybrid_event.sql
docs/specs/SPEC-032-*.md
WORKSPACE_STATUS.md
docs/implementation/IMPL-0-SALES-IMPLEMENTATION-TRACEABILITY.md
src/ public/ landing .cursor/mcp.env
```

## 2. Authority

| Document | Version / state | Role for this pack |
|---|---|---|
| SPEC-000 Governance | v0.2.0 APPROVED | Approval and documentation discipline |
| SPEC-001 System Architecture | v0.1.0 APPROVED | Backend/service authority over client state |
| SPEC-030 Journeys | v0.1.0 APPROVED | Public sales journeys and catalog identity |
| SPEC-031 API/Backend | v0.1.0 APPROVED | Capability model, abuse profiles, open decisions |
| SPEC-032 Data model | v0.1.0 APPROVED | Appendix E access/classification; IMPL-4 entry gate |
| IMPL-0 Traceability | documentary | IMPL-4 unit definition and blockers |
| IMPL-2 evidence | PASS | Schema skeleton validated |
| IMPL-3 evidence | PASS | Constraints/indexes validated; RLS still zero |

Primary operation of this pack:

```text
Prepare the human-decision and access-control contract required before IMPL-4.
```

Task class:

```text
Prepare implementation traceability and resolve blocking access decisions.
```

This pack does **not** implement IMPL-4.

## 3. Entry-gate analysis

SPEC-032 Appendix H / IMPL-0 require for IMPL-4 entry:

```text
IMPL-3 validated
API-OD-004 / API-OD-005 / API-OD-007 and applicable auth decisions approved
```

Current state:

| Gate item | State |
|---|---|
| IMPL-3 validated | YES |
| Access architecture recommendation | THIS PACK (PROPOSED) |
| ACCESS-DEC-001..008 approved | YES — Project Owner 2026-07-24 |
| API-OD-004 numeric lifetime/transport | Deferred + feature-disabled per ACCESS-DEC-004 |
| API-OD-005 telemetry backend | Narrow APPROVED: backend UUID + activity_log; external product deferred |
| API-OD-007 retention/deletion | Remains PRODUCTION_BLOCKER; no deletion/anonymization in IMPL-4 |
| SQL migration `0003` | NOT authored |
| RLS / policies | NOT implemented |

Entry conclusion:

```text
Access decisions required for deny-by-default IMPL-4 are APPROVED.
IMPL-4 SQL/RLS implementation remains NOT STARTED until a separate
implementation authorization for the RLS/access-only unit is issued.
Authorized mode for that future unit: local isolated validation; no InsForge
deployment; no browser direct table access.
```

## 4. Blocking decisions

| Decision | Classification for IMPL-4 | Rationale |
|---|---|---|
| **API-OD-004** Capability lifetime/transport | `EXPLICITLY_DEFERRED_AND_FEATURE_DISABLED` | Exact TTL/transport not needed to enable deny-by-default RLS. Capability-gated runtime endpoints stay disabled until approved for IMPL-7/10/11. |
| **API-OD-005** Correlation ID / telemetry backend | `REQUIRED_FOR_IMPL_4` (narrow) + deferred external product | Backend opaque UUID correlation and `activity_log` as canonical audit are required for the access contract. External telemetry product remains deferred. |
| **API-OD-007** Retention/deletion/anonymization | `PRODUCTION_BLOCKER` | No automated deletion/anonymization in IMPL-4; no production personal-data launch until approved. |
| Direct browser table access | `REQUIRED_FOR_IMPL_4` via ACCESS-DEC-001 | Core deny-by-default boundary. |
| Public catalog delivery path | `REQUIRED_FOR_IMPL_4` via ACCESS-DEC-002 | Prevents anonymous SELECT drift. |
| Mutation authority | `REQUIRED_FOR_IMPL_4` via ACCESS-DEC-003 | Service-only writes. |
| Capability ≠ PG role | `REQUIRED_FOR_IMPL_4` via ACCESS-DEC-004 | Prevents modeling capabilities as RLS identities. |
| Staff/operator enablement | `REQUIRED_FOR_IMPL_4` via ACCESS-DEC-007 (deny) | No human admin path in IMPL-4. |
| **API-OD-001** Endpoint layout | `NON_BLOCKING_FOR_IMPL_4` | Needed later for public API naming; not for RLS deny-by-default. |
| **API-OD-002** Exact HTTP statuses | `NON_BLOCKING_FOR_IMPL_4` | Semantic error classes suffice for access pack. |
| **API-OD-003** Idempotency TTL/storage | `NON_BLOCKING_FOR_IMPL_4` | Runtime checkout concern (IMPL-7+). |
| **API-OD-010** Buyer access to others' tickets | `EXPLICITLY_DEFERRED_AND_FEATURE_DISABLED` for ticket-read feature; `NON_BLOCKING_FOR_IMPL_4` for deny-by-default | Buyer≠ticket-holder remains; public ticket-read stays disabled until resolved. |
| **OD-003** Buyer ≠ participant | `NON_BLOCKING_FOR_IMPL_4` for RLS shell; remains journey blocker for third-party flows | Access pack forbids inference; feature paths stay later. |
| **OD-017** Email provider | `NON_BLOCKING_FOR_IMPL_4` | Delivery unit later; outbox remains service-only/denied to browsers. |
| **OD-018** Support/escalation | `PRODUCTION_BLOCKER` for production recovery claims; `NON_BLOCKING_FOR_IMPL_4` for deny-by-default | Operator recovery stays disabled. |
| **OD-019** Folio format | `NON_BLOCKING_FOR_IMPL_4` | Uniqueness already constrained; format remains open. |

```text
MODEL_BLOCKER for deny-by-default access architecture: 0
```

Open decisions are not silently closed. Numeric capability lifetimes, retention periods, endpoint paths, and HTTP codes are **not** invented.

## 5. Recommended access architecture

### 5.1 General rule

```text
Ningún navegador, usuario anónimo o usuario autenticado accede directamente
a las tablas canónicas de ventas.
```

All public or user-facing access MUST pass through protected backend services /
InsForge Functions that:

* validate product, price, state, and capacity;
* validate capabilities when a capability-gated operation is enabled later;
* minimize response fields;
* perform transactional mutations;
* write audit evidence;
* return enumeration-safe errors.

IndexedDB, frontend state, and payment redirects are never authority.

### 5.2 Actors (conceptual)

| Actor | Nature | IMPL-4 posture |
|---|---|---|
| `ANON` | Unauthenticated browser/network | No direct table access |
| `AUTHENTICATED_BROWSER` | End-user session in browser | No direct table access |
| `BACKEND_SERVICE` | Protected service / Function identity | Only approved canonical path (future) |
| `ORDER_HOLDER` | Capability context, not a PG role | Backend-validated later; disabled now |
| `CAPTAIN` | Capability context, not a PG role | Backend-validated later; disabled now |
| `INVITED_MEMBER` | Capability context, not a PG role | Backend-validated later; disabled now |
| `TICKET_HOLDER` | Capability context, not a PG role | Backend-validated later; disabled now |
| `FUTURE_OPERATOR` | Human support role | Not enabled in IMPL-4 |
| `FUTURE_ADMIN` | Human admin role | Not enabled in IMPL-4 |

Clarifications:

* `ORDER_HOLDER`, `CAPTAIN`, `INVITED_MEMBER`, and `TICKET_HOLDER` are **not**
  PostgreSQL roles;
* they are opaque capability contexts validated by backend services;
* a capability never grants direct table SELECT/INSERT/UPDATE/DELETE;
* `FUTURE_OPERATOR` / `FUTURE_ADMIN` require a later approved contract.

### 5.3 Default policy recommendation

```text
Enable RLS on all 24 canonical tables.
Deny direct ANON access.
Deny direct AUTHENTICATED_BROWSER access.
Allow canonical operations only through an approved backend service boundary.
```

#### `FORCE ROW LEVEL SECURITY` evaluation (documentary only)

| Option | Effect | Recommendation for future IMPL-4 |
|---|---|---|
| `ENABLE ROW LEVEL SECURITY` | Applies RLS to non-owner/non-bypass roles | Required |
| `FORCE ROW LEVEL SECURITY` | Also applies RLS to table owners | Evaluate against InsForge role model: if the connecting role owns tables or bypasses RLS via ownership, FORCE prevents accidental owner bypass. |

Recommendation: plan to **document and test** InsForge role ownership during
IMPL-4 design; prefer FORCE if the service role would otherwise bypass RLS by
ownership. **Do not implement in this pack.** Final choice remains part of the
authorized IMPL-4 SQL unit after ACCESS-DEC approval.

### 5.4 Public reads

```text
No direct SELECT policy on events, event_days or products for ANON.
```

Future public catalog API MUST return only an allowlisted projection of:

```text
events
event_days
products
availability-derived response
```

Must not expose: internal UUIDs as public authority, commercial snapshots,
mutable internal cupo beyond approved signals, payment data, buyer/participant
data, capability hashes, or audit metadata.

#### Why backend projection beats direct SELECT + RLS

| Criterion | Direct ANON SELECT + RLS | Backend projection |
|---|---|---|
| Contract control | Column/policy drift leaks fields | Explicit DTO owned by API contract |
| Enumeration | Table shape aids probing | Stable public envelope |
| Caching/freshness | Harder to govern | Controlled at service edge |
| Capability/business rules | Weak in SQL alone | Validated in service |
| SPEC-031 alignment | Public ops are protected invocations | Matches Appendix A service boundary |

### 5.5 Mutations

```text
All inserts, updates and deletes are service-only.
```

ANON and authenticated browsers must not write directly to personal, financial,
credential, audit, or domain mutation tables listed in §7 ACCESS-DEC-003.

### 5.6 Sensitive data

```text
participant_sensitive_profiles = backend service only
```

No direct access for participant, buyer, captain, invitee, ticket holder, ANON,
or authenticated browser. Any future human access requires approved role,
explicit purpose, least privilege, audit, and approved retention policy.

## 6. ACCESS-DEC-001 through ACCESS-DEC-008

All items below are **APPROVED** by the Project Owner on 2026-07-24.

### ACCESS-DEC-001 — Acceso directo a tablas

**Status:** `APPROVED`  
**Class:** `REQUIRED_FOR_IMPL_4`

```text
DENY ALL direct browser access to canonical tables.
```

APIs and capabilities operate exclusively through a protected backend.

### ACCESS-DEC-002 — Catálogo público

**Status:** `APPROVED`  
**Class:** `REQUIRED_FOR_IMPL_4`

```text
Public catalog is served through a protected backend endpoint/function with an
explicit response projection. No direct anonymous table SELECT.
```

### ACCESS-DEC-003 — Mutaciones

**Status:** `APPROVED`  
**Class:** `REQUIRED_FOR_IMPL_4`

```text
All domain mutations are backend-service-only.
```

### ACCESS-DEC-004 — Capabilities y transporte

**Status:** `APPROVED`  
**Class:** `REQUIRED_FOR_IMPL_4` (identity model) + `EXPLICITLY_DEFERRED_AND_FEATURE_DISABLED` (TTL/transport)

```text
Capabilities do not become PostgreSQL roles, JWT roles or direct RLS identities.
They are validated by protected backend services.
```

Temporary decision for IMPL-4:

```text
Exact capability transport and numeric lifetime remain deferred to IMPL-7,
IMPL-10 and IMPL-11. Capability-gated runtime endpoints remain disabled until
API-OD-004 is approved.
```

### ACCESS-DEC-005 — Correlation ID y telemetría

**Status:** `APPROVED`  
**Class:** `REQUIRED_FOR_IMPL_4` (narrow)

```text
Correlation IDs are generated by the backend, are opaque UUID values and are
never accepted as authority from the browser.
```

First implementation:

```text
Canonical audit evidence lives in activity_log.
External telemetry backend remains deferred.
```

Must not record: raw tokens, complete payment payloads, medical data, secrets,
or authorization headers.

### ACCESS-DEC-006 — Retención, borrado y anonimización

**Status:** `APPROVED` (as temporary IMPL-4 posture)  
**Class:** `PRODUCTION_BLOCKER` remains for launch; IMPL-4 implements none

```text
No automated deletion or anonymization is implemented in IMPL-4.
No production launch involving personal data is authorized until a retention
and deletion policy is approved.
```

During IMPL-4:

* direct personal-data access remains blocked;
* no deletion endpoints;
* no retention jobs;
* API-OD-007 remains `PRODUCTION_BLOCKER`;
* schema is not expanded for retention mechanics.

### ACCESS-DEC-007 — Personal interno

**Status:** `APPROVED`  
**Class:** `REQUIRED_FOR_IMPL_4`

```text
No staff/operator/admin browser access is enabled in IMPL-4.
```

Human internal access is reserved for a later specification/unit.

### ACCESS-DEC-008 — Buyer y tickets ajenos

**Status:** `APPROVED`  
**Class:** `NON_BLOCKING_FOR_IMPL_4` for deny-by-default; feature remains deferred

```text
A buyer does not automatically obtain access to another participant's ticket.
```

Future access requires an authorized relationship and a specific capability.
API-OD-010 remains blocking for the corresponding public ticket feature, not
for IMPL-4 deny-by-default.

## 7. Table access matrix

Legend for direct columns: `DENY` = no direct SQL access from that actor.
`SVC` = future backend service path only after authorized runtime units.
`N/A` = not enabled in IMPL-4.
Capability-mediated backend = service validates capability, still no direct
browser table access.

| Table | Data classification | ANON direct | Auth browser direct | Backend service | Capability-mediated backend | Future operator | Future admin | Required audit | Retention blocker |
|---|---|---|---|---|---|---|---|---|---|
| `events` | PUBLIC_CONFIG | DENY | DENY | SVC (projection) | N/A | N/A | N/A | catalog reads optional | No |
| `event_days` | PUBLIC_CONFIG | DENY | DENY | SVC (projection) | N/A | N/A | N/A | catalog reads optional | No |
| `products` | PUBLIC_CONFIG | DENY | DENY | SVC (projection) | N/A | N/A | N/A | catalog/checkout | No |
| `buyer_contacts` | PERSONAL | DENY | DENY | SVC | later order-holder via SVC | N/A | N/A | YES | API-OD-007 |
| `participants` | PERSONAL | DENY | DENY | SVC | later holder via SVC | N/A | N/A | YES | API-OD-007 |
| `participant_sensitive_profiles` | SENSITIVE | DENY | DENY | SVC only | DENY even with capability | N/A | N/A | YES strict | API-OD-007 |
| `registrations` | PERSONAL | DENY | DENY | SVC | later via SVC | N/A | N/A | YES | API-OD-007 |
| `teams` | PERSONAL | DENY | DENY | SVC | later captain via SVC | N/A | N/A | YES | API-OD-007 |
| `team_members` | PERSONAL | DENY | DENY | SVC | later invitee/captain via SVC | N/A | N/A | YES | API-OD-007 |
| `capability_credentials` | SECURITY_CREDENTIAL | DENY | DENY | SVC | validated in memory/service, never direct SELECT of hashes to clients | N/A | N/A | YES (fingerprint only) | No schema retention job |
| `waiver_documents` | INTERNAL | DENY | DENY | SVC | N/A | N/A | N/A | version publish | No |
| `waiver_acceptances` | PERSONAL | DENY | DENY | SVC | later holder via SVC | N/A | N/A | YES | API-OD-007 |
| `orders` | FINANCIAL | DENY | DENY | SVC | later order-holder projection via SVC | N/A | N/A | YES | API-OD-007 |
| `order_items` | FINANCIAL | DENY | DENY | SVC | later via SVC | N/A | N/A | YES | API-OD-007 |
| `capacity_holds` | FINANCIAL | DENY | DENY | SVC | N/A | N/A | N/A | YES | No |
| `payments` | FINANCIAL | DENY | DENY | SVC | DENY to browsers | N/A | N/A | YES | API-OD-007 |
| `payment_verification_records` | FINANCIAL | DENY | DENY | SVC | DENY to browsers | N/A | N/A | YES | API-OD-007 |
| `webhook_events` | INTERNAL | DENY | DENY | SVC | DENY to browsers | N/A | N/A | YES | No |
| `idempotency_records` | SECURITY_CREDENTIAL | DENY | DENY | SVC | DENY to browsers | N/A | N/A | YES | No |
| `tickets` | INTERNAL | DENY | DENY | SVC | later ticket-holder via SVC | N/A | N/A | YES | API-OD-007 |
| `ticket_credential_generations` | SECURITY_CREDENTIAL | DENY | DENY | SVC | DENY raw/hash to clients | N/A | N/A | YES (no raw token) | No |
| `access_entitlements` | INTERNAL | DENY | DENY | SVC | later ticket-holder via SVC | N/A | N/A | YES | No |
| `activity_log` | AUDIT | DENY | DENY | SVC | DENY to browsers | N/A | N/A | n/a (is audit) | API-OD-007 |
| `outbox_delivery_jobs` | DELIVERY | DENY | DENY | SVC | DENY to browsers | N/A | N/A | YES | OD-017 / API-OD-007 |

Classification notes aligned to SPEC-032 Appendix E.2:

* PUBLIC_CONFIG maps to Public configuration entities;
* PERSONAL / SENSITIVE map to Personal and Sensitive restricted;
* FINANCIAL maps to Operational financial;
* SECURITY_CREDENTIAL covers capability/idempotency/QR hash stores (prohibited
  secrets remain never stored);
* INTERNAL covers operational domain not directly public;
* AUDIT / DELIVERY are protected operational stores.

## 8. Operation boundary matrix

All runtime operations below remain **disabled / not implemented** after this
pack. IMPL-4, if later authorized, only establishes deny-by-default RLS/access
limits—not these services.

| Operation | Allowed actor (future) | Direct table access? | Required backend boundary | Required capability | Tables touched (logical) | Audit required | Rate/abuse profile | Open decision | Enabled after IMPL-4? |
|---|---|---|---|---|---|---|---|---|---|
| Read public catalog | ANON via backend | No | Public catalog Function | None | events, event_days, products (projection) | Optional | Public reads | API-OD-001 | NO |
| Read order state | ORDER_HOLDER via backend | No | Order read Function | ORDER_HOLDER | orders, order_items | YES | Capability exchange / public reads | API-OD-004 | NO |
| Read team state | CAPTAIN / INVITED_MEMBER via backend | No | Team read Function | CAPTAIN or INVITED_MEMBER | teams, team_members | YES | Capability profiles | API-OD-004 | NO |
| Exchange invitation code | Invited client via backend | No | Exchange Function | one-time code → INVITED_MEMBER | capability_credentials, team_members | YES | Capability exchange | API-OD-004 | NO |
| Complete invited member | INVITED_MEMBER via backend | No | Completion Function | INVITED_MEMBER | participants, registrations, team_members, waiver_acceptances | YES | Invitation use | API-OD-004, OD-003 | NO |
| Read ticket | TICKET_HOLDER via backend | No | Ticket read Function | TICKET_ACCESS | tickets, access_entitlements | YES | Ticket access | API-OD-004, API-OD-010 | NO |
| Reissue ticket | Holder/operator via backend | No | Reissue Function | TICKET_ACCESS (+ policy) | ticket_credential_generations, capability_credentials | YES | Ticket reissue | API-OD-004, OD-019 | NO |
| Create checkout | ANON via backend | No | Checkout Function | none initially; returns ORDER_HOLDER | products, orders, order_items, capacity_holds, registrations/teams, capability_credentials | YES | Checkout | API-OD-001/003/004 | NO |
| Receive webhook | Provider → backend | No | Webhook ingress Function | n/a (signature) | webhook_events | YES | Webhook ingress | API-OD-006 | NO |
| Verify payment | Payment verifier service | No | Verifier Function | service identity | payments, payment_verification_records, orders | YES | INT-PROVIDER | — | NO |
| Write audit event | Trusted domain service | No | Same TX / durable outbox | service identity | activity_log | n/a | INT-AUDIT | API-OD-005 | NO |
| Process outbox | Communication service | No | Outbox worker | service identity | outbox_delivery_jobs | YES | INT-COMMUNICATION | OD-017 | NO |
| Read sensitive profile | Backend only; future approved human role | No | Restricted Function | never browser capability alone | participant_sensitive_profiles | YES strict | INT-OPERATOR later | API-OD-007 | NO |
| Operator recovery | FUTURE_OPERATOR via backend | No | Named recovery commands | named operator auth | incident-scoped tables | YES | Operator recovery | OD-018 | NO |

## 9. Abuse / rate profiles

Imported from SPEC-032 Appendix E.4 / SPEC-031. Exact numeric thresholds remain
**implementation decisions** and are **not** fixed here.

| Profile | Logical rate identity | Resource dimension | Deterministic response needed | Sanitized evidence | Enumeration protection | Retry/concurrency boundary |
|---|---|---|---|---|---|---|
| Public reads | network risk + resource class | event/product/catalog surface | YES (`RATE_LIMITED` class) | request class/result | YES | cache/freshness; bounded polling |
| Checkout | actor/network + product + idempotency scope | product/capacity unit/order | YES | product/unit/result; no PII dump | YES | serialize capacity; bounded concurrent attempts |
| Capability exchange | code fingerprint + slot + network + window | invitation/slot | YES | fingerprint/result only | YES | atomic consume; replay-safe |
| Capability mint/rotate/revoke | service identity + actor/resource/generation | order/team/member/ticket | YES | fingerprint only; no raw token | YES | deterministic generation key |
| Invitation resend/use | actor/team/slot/destination/network/window | team/slot | YES | destination minimized | YES existence-safe | resend window; no oracle |
| Webhook ingress | provider/merchant/network | notification/payment | YES ack class | signature result/fingerprint | n/a (signed) | size/attempt bounds; receipt≠effect |
| Ticket access/reissue | holder/entitlement/generation/network/window | ticket/generation | YES | generation/result; no QR | YES | revoke-before-activate |
| Operator recovery | named operator/entity/command/reason/window | incident command | YES | actor/reason/before-after | YES | strict human-action limit; idempotent command |

## 10. Privacy / error rules

```text
No existence oracle.
No internal IDs in public errors.
No capability hashes in responses.
No raw token logging.
No buyer=participant assumption.
No buyer=ticket-holder assumption.
No captain authority over another adult's waiver.
No payment confirmation from redirects.
No PII in QR.
```

Public responses must be equivalent when revealing existence creates risk.
Exact HTTP status numbers remain open under API-OD-002; this pack uses semantic
classes only (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`/`SAFE_FAILURE`,
`CONFLICT`, `RATE_LIMITED`, `VALIDATION_FAILED`).

## 11. Proposed IMPL-4 SQL scope (not authored)

Future file (proposal only):

```text
insforge/migrations/0003_rls_and_access_limits.sql
```

Proposed future scope after ACCESS-DEC approval and separate IMPL-4
authorization:

1. enable RLS on all 24 canonical tables;
2. revoke/deny direct access for public/browser identities;
3. do **not** create capability-as-role policies;
4. do **not** create end-user table policies;
5. define only the approved backend service boundary;
6. validate deny-by-default;
7. prove public/authenticated cannot read or write;
8. prove sensitive/financial/credential/audit tables stay inaccessible;
9. keep seed execution at zero;
10. keep InsForge deployment at zero during local validation.

Optional evaluation during that unit: `FORCE ROW LEVEL SECURITY` vs role
ownership in InsForge (see §5.3).

**This pack contains no CREATE/ALTER POLICY SQL and no ENABLE RLS statements.**

## 12. Proposed validation plan (future)

Local ephemeral PostgreSQL before any InsForge write:

| ID | Case |
|---|---|
| A01 | ANON cannot SELECT any canonical table |
| A02 | ANON cannot INSERT/UPDATE/DELETE |
| A03 | authenticated browser cannot SELECT canonical tables |
| A04 | authenticated browser cannot mutate |
| A05 | public catalog projection requires backend boundary |
| A06 | `participant_sensitive_profiles` denied to browser identities |
| A07 | payment tables denied |
| A08 | capability hashes denied |
| A09 | `activity_log` denied |
| A10 | outbox denied |
| A11 | backend service path can perform authorized test operation |
| A12 | no public GRANT remains |
| A13 | all 24 tables have RLS enabled |
| A14 | no capability is modeled as a PostgreSQL role |
| A15 | no PII appears in errors or logs |
| A16 | seed remains unexecuted |

## 13. Decisions remaining blocked

| Item | Remains |
|---|---|
| API-OD-004 numeric lifetime + final transport | OPEN; feature-disabled |
| API-OD-005 external telemetry product | OPEN; deferred |
| API-OD-007 retention/deletion/anonymization periods | PRODUCTION_BLOCKER |
| API-OD-001/002/003 endpoint/status/idempotency TTL | OPEN; non-blocking for RLS shell |
| API-OD-010 buyer→other tickets | OPEN; feature-disabled |
| OD-017 email provider | OPEN |
| OD-018 operator escalation | PRODUCTION_BLOCKER for production recovery claims |
| OD-019 folio format | OPEN |
| Exact rate thresholds | OPEN |
| FORCE RLS final choice under InsForge ownership | OPEN pending IMPL-4 design test |

## 14. Exact approval statement

Received and recorded 2026-07-24 from the Project Owner:

```text
Apruebo ACCESS-DEC-001 a ACCESS-DEC-008 del paquete IMPL-4; autorizo el modelo
deny-by-default, sin acceso directo de navegador a tablas canónicas; autorizo
preparar IMPL-4 como unidad RLS/access-only, con validación local aislada y sin
despliegue en InsForge.
```

Effect of this approval:

```text
ACCESS-DEC-001..008 = APPROVED
Deny-by-default model = AUTHORIZED for IMPL-4 design
IMPL-4 SQL/RLS execution = NOT STARTED (requires separate implementation unit)
Authorized future IMPL-4 mode = RLS/access-only + local isolated validation
                               + NO InsForge deployment
```

## 15. Gate

```text
READY_FOR_IMPL_4_EXECUTION
```

### Documentary validation checklist

```text
- no implementation SQL: YES
- no RLS executed: YES
- no policies created: YES
- no grants/roles created: YES
- no capability TTL invented: YES
- no retention period invented: YES
- no personal fields invented: YES
- no definitive endpoints invented: YES
- all ACCESS-DEC marked APPROVED: YES
- API-OD-004/005/007 classified: YES
- 24 tables in matrix: YES
- runtime operations disabled after decisions pack: YES
- protected paths intact: YES
```

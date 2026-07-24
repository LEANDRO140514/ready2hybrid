---
id: SPEC-032
title: Minimal Public Sales Data Model and Transaction Integrity
status: APPROVED
version: 0.1.0
phase: SALE-3
created_at: 2026-07-24
approved_at: 2026-07-24
approved_by: Project Owner
approval_basis: Explicit human authorization after READY_FOR_APPROVAL review
supersedes:
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-030 v0.1.0
  - SPEC-031 v0.1.0
compatible_with:
  - SPEC-011 v0.1.0
---

# SPEC-032 - Minimal Public Sales Data Model and Transaction Integrity

## 1. Purpose

Define the minimal logical data model, relationships, states, invariants,
access boundaries, transactional units, concurrency, idempotency, privacy,
recovery, seed reconciliation, and implementation sequence needed to implement
the public sales contracts approved in SPEC-030 and SPEC-031.

This contract supports 28 configured products and five journeys without
creating SQL, physical table names, migrations, RLS, functions, runtime payment
resources, or landing changes.

## 2. Authority

Normative dependencies:

1. Explicit SALE-3 Project Owner authorization dated 2026-07-24.
2. SPEC-000 v0.2.0 `APPROVED`.
3. SPEC-001 v0.1.0 `APPROVED`.
4. SPEC-030 v0.1.0 `APPROVED`.
5. SPEC-031 v0.1.0 `APPROVED`.

Compatibility dependency:

6. SPEC-011 v0.1.0 `APPROVED`.

SPEC-030 remains authority for catalog, commercial values, journeys,
capacity units, ticket quantities, and product decisions. SPEC-031 remains
authority for public/internal contracts, payment verification, capabilities,
errors, and idempotent effects. SPEC-032 models those contracts without
changing them.

## 3. Context

READ_ONLY InsForge observation on 2026-07-24:

```text
Configured MCP project URL: https://4bg9ufz2.us-east.insforge.app
Tables: 0
Functions: 0
Realtime channels: 0
Bucket: landings-images (public, preserved)
Deployment slug: enforma (preserved)
```

This observation is evidence of current infrastructure state, not permission
to create or alter resources.

## 4. Scope

This specification covers:

- 24 minimum logical entities and their responsibilities, including separate
  payment-verification and ticket-credential-generation boundaries;
- cardinalities and uniqueness boundaries;
- configured product, order, roster, payment, ticket, and access models;
- money, capacity, state, transaction, concurrency, and idempotency invariants;
- access, privacy, audit, outbox, and manual recovery;
- seed inconsistencies and future seed-correction gate;
- an ordered, gated implementation plan without execution authority.

## 5. Non-goals

This specification does not define or authorize:

- SQL, DDL, migrations, final physical names, constraints syntax, indexes,
  policies, RLS, TypeScript, Zod, or Edge Function code;
- seed execution/modification, table/function/bucket/realtime creation, or
  deployment changes;
- real Mercado Pago webhooks, preferences, sandbox/production payments,
  credentials, secrets, or configuration;
- React, forms, CSS, visual design, routes, PWA implementation, IndexedDB,
  check-in, heats, timing, results, staff, CRM, or admin panel;
- exact personal fields, medical fields, waiver content, retention periods,
  invitation/hold durations, or unresolved commercial policies;
- cleanup or reformatting of protected repository files.

## 6. Definitions

- **Logical entity:** A responsibility and invariant boundary independent of
  its eventual physical table layout.
- **Internal ID:** A non-predictable canonical identifier never used as public
  authority.
- **Public reference:** An opaque, non-sequential identifier scoped to an
  authorized public contract.
- **Commercial snapshot:** Product code, journey, unit price, approved
  quantity, total, MXN currency, included benefits, capacity unit, and relevant
  terms frozen for an order item.
- **Capacity unit:** The configured inventory unit consumed by one sale.
- **Capacity hold:** A temporary claim on one or more capacity units.
- **Verified payment:** Mercado Pago state obtained and validated by protected
  backend behavior against merchant, reference, amount, and currency.
- **Sensitive mutation:** Any change to order, payment, capacity, roster,
  waiver, ticket, capability, sensitive profile, or audit state.
- **Outbox:** A durable logical record that commits with a domain transaction
  and drives later communication/retry.
- **Active generation:** The one currently valid invitation/capability/ticket
  generation after rotation or reissue.
- **Invitation exchange code:** A short-lived one-use bootstrap secret whose
  only authority is atomic exchange for one scoped invited-member capability.
- **Scoped capability:** A high-entropy opaque credential for one order-holder,
  captain/team, invited-member/slot, or ticket-holder/entitlement continuation;
  it is distinct from the exchange code and supports revocation/rotation.

## 7. Invariants and requirements

### SPEC-032-R001

InsForge MUST be canonical domain authority. Frontend, redirect, cache,
offline state, and seed text MUST NOT override canonical state.

### SPEC-032-R002

Frontend input MUST NOT be authority for product, price, currency, quantity
approval, capacity, payment, role, ticket, QR, folio, or sensitive transition.

### SPEC-032-R003

Internal IDs MUST be non-predictable. Public references and capabilities MUST
be opaque, scoped, revocable where applicable, and distinct from internal IDs.

### SPEC-032-R004

Money MUST use integer cents, launch currency MUST be `MXN`, and floating-point
money arithmetic MUST NOT be used.

### SPEC-032-R005

Every order item MUST preserve a trusted commercial snapshot where
`unit_price_cents x approved_quantity = item_total_cents`; order total MUST
derive from item totals and match the verified provider amount/currency.

### SPEC-032-R006

Buyer, participant, team member, access holder, captain, and payer contexts
MUST remain logically distinguishable; one person MAY occupy multiple contexts
only through explicit relationships. Order MUST reference its buyer/initiator,
Payment MUST reference its payer identity context when available, and
Registration/Ticket MUST reference their access holder without assuming any of
those roles are equal.

### SPEC-032-R007

One provider payment MAY have multiple webhook notifications. Notification
receipt MUST NOT equal payment verification, and each logical payment effect
MUST be idempotent.

### SPEC-032-R008

Each participant or sold access unit MUST have an independent registration and
one canonical ticket with at most one active credential generation. Team
eligibility MUST create the complete set of two J2 or four J3 member
registrations/tickets rather than only the last completing member. QR data MUST
contain no PII, medical, financial, payment-state, or administrative data.

### SPEC-032-R009

Capacity MUST be checked/reserved atomically, never become negative, never
silently oversell, and use the SPEC-030 capacity unit rather than participant
count for J2/J3.

### SPEC-032-R010

Anonymous clients MUST NOT write logical entities directly. Every sensitive
mutation MUST cross an authorized service boundary and produce audit evidence.

### SPEC-032-R011

The logical `Event` entity MUST own public event identity, timezone, dates,
lifecycle, sales window, and public state.

### SPEC-032-R012

The logical `EventDaySession` entity MUST represent date/session validity,
public label, ordering, and the unresolved Saturday-label correction.

### SPEC-032-R013

The logical `Product` entity MUST configure all 28 unique products with block,
journey, composition, team size, integer price, MXN currency, capacity/unit,
benefits, schedule/validity, sale state, visibility, and public order.

### SPEC-032-R014

The logical `BuyerContact` entity MUST represent the order initiator/contact
without assuming payer, participant, or access-holder identity.

### SPEC-032-R015

The logical `Participant` entity MUST represent the person participating or
holding a personal registration, with optional buyer relation, journey role,
state, eligibility, and minimum approved fields.

### SPEC-032-R016

The optional `ParticipantSensitiveProfile` MUST be separately restricted,
exist only after approved data decisions, and MUST NOT appear in public
responses, catalog, invitation content, QR, or logs.

### SPEC-032-R017

The logical `Registration` entity MUST link event, product, participant/access
holder, optional team, order, journey, state, eligibility, and minimum
snapshot. Every occupied active team slot MUST link exactly one member
registration; the captain registration is created during TX-1 and invitee
registrations are created/linked during TX-3.

### SPEC-032-R018

The logical `Team` entity MUST support J2/J3 captain, configured product,
required team size, roster/payment/eligibility projections, and opaque public
reference.

### SPEC-032-R019

The logical `TeamMember` entity MUST represent one fixed roster position,
captain/invitee role, optional participant, waiver/invitation/substitution
state, optional member registration, and history without exceeding team size
or duplicating an active slot.

### SPEC-032-R020

The logical `CapabilityCredential` entity MUST distinguish one-time invitation
exchange codes from the scoped order-holder, captain, invited-member, and
ticket-access capabilities required by SPEC-031. It MUST store a secure hash
or non-recoverable representation where possible, credential kind, least
scope, subject/resource binding, configurable expiry, consumption where
applicable, active generation, revocation, rotation, and audit. Exchange MUST
atomically consume one one-time code and mint exactly one scoped invited-member
capability; code consumption MUST NOT complete a roster slot.

### SPEC-032-R021

The logical `WaiverDocument` entity MUST identify type, immutable version or
content reference, validity/state, and integrity hash where applicable without
defining legal content.

### SPEC-032-R022

The logical `WaiverAcceptance` entity MUST link one person/access holder to one
exact waiver version, timestamp, actor, context, and authorized evidence. A
captain MUST NOT accept for another adult.

### SPEC-032-R023

The logical `Order` entity MUST own buyer, state, MXN totals, opaque tracking,
unique external reference, idempotency context, expiry/cancellation reason, and
commercial snapshot relationship.

### SPEC-032-R024

The logical `OrderItem` entity MUST own product, approved quantity, unit price,
item total, journey, capacity unit, and immutable product/commercial snapshot.

### SPEC-032-R025

The logical `CapacityHold` entity MUST own product, order, exact order item,
unit quantity, state, creation/expiry/conversion/release times, and reason.

### SPEC-032-R026

The logical `Payment` entity MUST own unique provider payment ID, order,
provider/external/normalized states, amount/currency/reference, provider
timestamps, verification time, sanitized evidence reference, and
reconciliation state plus an explicit payer identity association when the
provider/approved data contract supplies it. Payer identity MUST NOT default to
buyer or participant.

### SPEC-032-R027

The logical `WebhookEvent` boundary MUST preserve bounded untrusted ingress
evidence needed for signature verification, including canonical/raw bytes or
equivalent canonical inputs and required headers without unsafe logging. Only
after signature decision may it own a canonical unique provider notification
receipt, type, signature result, related payment, processing state, attempts,
result, and sanitized error. Invalid/unverifiable signatures MUST produce no
canonical receipt or domain effect; duplicate valid notifications MUST NOT
apply duplicate effects.

### SPEC-032-R028

The logical `IdempotencyRecord` entity MUST own scope, actor context, key hash,
request fingerprint, state, reusable response reference, configurable expiry,
and timestamps; same key with different payload MUST conflict.

### SPEC-032-R029

The logical `Ticket` entity MUST own registration, holder, product, public
folio namespace, state, issuance/revocation/reissue projection, and access
entitlements as the canonical entitlement carrier, separate from immutable QR
credential generations.

### SPEC-032-R030

The logical `AccessEntitlement` entity MUST model date/session rights per
ticket so the proposed `PUB-3D`/`FOT-3D` model remains possible without making
it final authority.

### SPEC-032-R031

The logical `ActivityLog` entity MUST record actor, named action, entity-safe
reference, result, failure class, time, correlation ID, idempotency fingerprint
where applicable, and sanitized metadata without secrets or unnecessary
sensitive data.

### SPEC-032-R032

The logical `OutboxDeliveryJob` entity MUST durably represent communication
type/template, referenced destination, domain event, minimal payload, state,
attempts, next attempt, and result. Delivery failure MUST NOT revert verified
payment, order, registration, or ticket.

### SPEC-032-R033

Relationships and cardinalities in Appendix B MUST be enforced logically,
including valid registration before ticket, exact team-slot limits, versioned
waiver acceptance, and payment/order consistency.

### SPEC-032-R034

Capacity consumption MUST be J1=one registration, J2=one team, J3=one team,
J4=one person, J5 spectator=one sold access unit, and J5 press=one sold
accreditation.

### SPEC-032-R035

Monetary invariants in Appendix C MUST preserve whole-unit prices for doubles
and relay, include chip/insurance without duplicate surcharges, and prevent
later product-price changes from altering snapshots.

### SPEC-032-R036

Order, payment, registration, team, team-member, invitation, hold, and ticket
states MUST follow explicit authorized transitions with preconditions, events,
effects, prohibitions, audit, and recovery.

### SPEC-032-R037

TX-1 checkout MUST make local order/item/registration-or-team/waiver/hold state
durable before provider preference creation and MUST reconcile/compensate an
external-call timeout or lost response.

### SPEC-032-R038

TX-2 webhook processing MUST separate receipt, signature, provider query,
verification, and atomic internal effects. It MUST preserve signature inputs
first, validate before canonical receipt/domain effects, and validate merchant/
reference/amount/currency before payment-dependent effects. Verified provider
evidence MUST be durably staged before the domain-effect transaction.

### SPEC-032-R039

TX-3 invited-member processing MUST first atomically consume a one-time
exchange code and mint one scoped invited-member capability without roster
completion, then separately validate that capability/slot, prevent duplicates,
bind participant/member registration/waiver, and recalculate roster/
eligibility. When the team first becomes eligible, it MUST idempotently issue
the complete two-ticket J2 or four-ticket J3 set, including any not yet issued
captain/earlier-member ticket, in one domain-effect transaction and audit it.

### SPEC-032-R040

TX-4 substitution MUST require approved policy and authority, revoke old
capability/ticket, preserve history/payment, create replacement invitation,
recalculate eligibility, and audit.

### SPEC-032-R041

Concurrent attempts for the last capacity unit MUST yield at most one active
hold; the other attempt receives `SOLD_OUT` or `CONFLICT` without a second
valid reservation.

### SPEC-032-R042

Late verified payment after hold expiration MUST preserve payment truth,
prevent automatic unavailable ticket/overcapacity, enter `REQUIRES_REVIEW`,
and require audited authorized reconciliation.

### SPEC-032-R043

Conceptual uniqueness MUST cover product code, public order reference,
external reference, provider payment ID, webhook notification ID, active team
slot, order-tracking namespace/reference, ticket-folio namespace/reference, all
ticket/invitation/capability token hashes across all generations, waiver
type/version, and idempotency scope/key. CapacityHold MUST identify its exact
OrderItem. Every scoped capability kind MUST have at most one active generation
per normalized `(kind, subject, resource, scope)` tuple.

### SPEC-032-R044

Access boundaries in Appendix E MUST separate anonymous, buyer, captain,
invitee, internal service, and operator authority without defining SQL/RLS.

### SPEC-032-R045

Data classification/minimization MUST separate public, personal, sensitive
restricted, and operational financial data; card data, CVV, access tokens,
webhook secrets, and credentials MUST NOT be stored.

### SPEC-032-R046

Ticket/QR resolution MUST be server-side, high entropy, revocable, reissuable,
auditable, generation-aware, and free of PII/payment/medical/admin data. Daily
use MUST be recorded on AccessEntitlement; a three-day Ticket becomes `USED`
only when all applicable entitlements are exhausted.

### SPEC-032-R047

Audit and outbox MUST commit within or durably couple to sensitive domain
transactions. Audit persistence failure MUST fail closed or retain verified
external truth in a separate durable PaymentVerificationRecord before
downstream effects; domain effects, audit, and outbox MUST roll back together
if their atomic commit fails.

### SPEC-032-R048

SEED-001 through SEED-005 MUST be corrected before seed execution. The current
seed MUST be classified not ready to execute and the next gate prepared as
`READY_FOR_SEED_CORRECTION`.

### SPEC-032-R049

Open decisions MUST retain source status and classification. No
`MODEL_BLOCKER` may remain for this draft to be `READY_FOR_APPROVAL`.

### SPEC-032-R050

The model MUST support 28 configured products through shared entities and J1-J5
relationships and MUST NOT create 28 product-specific structures.

### SPEC-032-R051

The ordered implementation units IMPL-1 through IMPL-12 MUST remain planning
only, each with requirements, anticipated files/resources, tests, rollback,
entry gate, and exit gate.

### SPEC-032-R052

This unit MUST NOT modify the landing, seed, code, SQL, InsForge, Mercado Pago,
secrets, dependencies, deployment, or any external resource.

### SPEC-032-R053

Every public and protected operation MUST have an implementation-neutral abuse
boundary covering actor/resource/network risk, enumeration resistance, request
size, retry/polling frequency, and bounded service/concurrency behavior.
Checkout, capability exchange/mint/rotate/revoke, invitation resend/use,
webhook ingress, ticket access/reissue, and operator recovery MUST use strict
named profiles without exposing existence or sensitive state.

### SPEC-032-R054

The logical `TicketCredentialGeneration` entity MUST own an immutable
high-entropy QR-token hash, generation identity, issue/revoke/expiry state, and
prior/replacement relation for one canonical Ticket. Reissue MUST revoke the
prior active generation before activating exactly one replacement and MUST NOT
replace the canonical Ticket or its unused AccessEntitlements.

### SPEC-032-R055

The logical `PaymentVerificationRecord` entity MUST durably preserve sanitized
provider-query evidence, ownership/reference/amount/currency checks, normalized
result, verification time, correlation, and reconciliation status before the
domain-effect transaction. Domain effects, ActivityLog, and outbox MUST then
commit atomically or roll back together; verification evidence remains
available for retry/reconciliation.

## 8. Functional requirements

Appendices A-H define the normative logical entities, relationships, capacity,
money, state transitions, transactions, concurrency, idempotency, access,
privacy, audit, outbox, seed reconciliation, and implementation preparation.

## 9. Non-functional requirements

- Canonical updates are atomic or explicitly compensatable.
- Concurrent capacity and uniqueness conflicts are deterministic.
- Retried external/internal work produces one logical effect.
- Sensitive data and capabilities are minimized, compartmentalized, and
  excluded from public/cache/log surfaces.
- The model remains extensible for approved open decisions without hidden
  defaults.
- Physical implementation may evolve without losing entity responsibilities or
  invariants.

## 10. Interfaces and contracts

The logical model implements SPEC-031 public/internal operation contracts.
Appendices A-F are logical interfaces, not SQL schemas or final physical names.

## 11. Failure modes and recovery

Appendix D defines transaction/concurrency recovery. Appendix F defines audit
and delivery recovery. Appendix G defines seed blocking. Failures MUST preserve
verified external truth, avoid duplicate effects, and use named audited
recovery rather than arbitrary state mutation.

## 12. Security and privacy

Appendix E defines conceptual access and data classification. Sensitive
profiles are optional/restricted. Public references, capabilities, invitation
and QR tokens are opaque; recoverable raw tokens are avoided where possible.

## 13. Acceptance criteria

Appendix I contains SPEC-032-AC001 through SPEC-032-AC018 with documentary
result rules and separate runtime `NOT_RUN` status.

## 14. Validation plan

Appendix L records documentary counts, source parity, seed hash, Git scope,
READ_ONLY infrastructure evidence, and formal-review result.

## 15. Traceability

Appendix J maps requirements to authority, entity, invariant, transaction,
failure, AC, open decision, and implementation impact.

## 16. Open decisions

Appendix K imports relevant SPEC-030/SPEC-031 decisions. No open decision is
implementation authority and no `MODEL_BLOCKER` may remain.

## 17. Change log

Appendix M contains the draft history.

## Appendix A - Minimum logical entities

| Entity | Responsibility | Minimum logical attributes | Primary prohibitions |
|---|---|---|---|
| Event | Event/public-sales boundary | public code, name, timezone, start/end, lifecycle, sales open/close, public state | No secret/config/private data |
| EventDaySession | Date/session validity | event, date, public label, order, session, validity | Saturday label cannot silently omit approved products |
| Product | Configured sale unit | unique code, block, journey, name, composition, team size, price cents, MXN, capacity/unit, chip/insurance, day/validity, sale state, visibility, public order | No browser-authoritative price/capacity |
| BuyerContact | Order initiator/contact | identity/contact references, communication consent if approved, public refs, timestamps, minimum state | Not automatically payer, participant, access holder, or controller of others |
| Participant | Person participating/holding personal registration | identity ref, optional buyer relation, participation type, approved minimum fields, state, eligibility | Exact personal fields not invented |
| ParticipantSensitiveProfile | Optional restricted extension | participant, approved emergency/medical/private fields, restriction/audit context | Never public/QR/log/catalog/invitation |
| Registration | Person/access enrollment | event, product, explicit access holder/participant association, optional team/member slot, order, journey, state, eligibility, snapshot | No confirmed registration without product/order contract; every occupied active team slot has one |
| Team | J2/J3 roster aggregate | captain, product, optional name, required size, slot completion, roster/payment/eligibility projections, public ref | No team size independent of product |
| TeamMember | Fixed roster slot | team, position, captain/invitee role, optional participant and member registration, state, waiver, invite/substitution refs, timestamps | No duplicate active position, member registration, or overflow |
| CapabilityCredential | Bootstrap and continuation authority | secure token/code hash, kind (`INVITATION_EXCHANGE_CODE`, `ORDER_HOLDER`, `CAPTAIN`, `INVITED_MEMBER`, `TICKET_ACCESS`), least scope, subject/resource/slot binding, state, configurable expiry, consumed/revoked/rotation generation, audit | Avoid recoverable raw token; exchange code cannot authorize roster completion; no internal ID in public URL |
| WaiverDocument | Immutable legal/consent version | type, version, immutable content/ref, validity, state, hash | No legal content invented here |
| WaiverAcceptance | Individual evidence | holder/participant, waiver/version, time, context, actor, authorized evidence | Captain cannot accept for another adult |
| Order | Commercial intent | buyer, state, MXN subtotal/total, tracking ref, external ref, idempotency context, timestamps, expiry/cancel reason | No mutable historical snapshot |
| OrderItem | Priced configured item | order, product, quantity, unit price, item total, snapshot, capacity unit, journey | Quantity does not imply approval of multi-unit sales |
| CapacityHold | Temporary inventory claim | product, order, exact order item, capacity-unit quantity, state, created/expires/converted/released, reason | No negative/over-capacity hold; no hold without order item |
| Payment | Provider payment state | provider, unique payment ID, order, explicit payer identity association when available, external/normalized state, amount, currency, external ref, provider times, last verification, reconciliation | No card/CVV/credential data; payer does not default to buyer/participant |
| PaymentVerificationRecord | Durable pre-effect verification evidence | payment/order refs, sanitized provider evidence ref, merchant ownership/reference/amount/currency check results, normalized result, verified time, correlation, reconciliation state | No domain effect or unsafe full provider payload |
| WebhookEvent | Signed notification boundary | bounded untrusted ingress verification envelope (canonical/raw bytes or canonical inputs plus required headers), provider, post-signature unique notification ID/receipt, type, signature result, related payment, processing state, attempts/result/sanitized error | No canonical receipt/domain effect before valid signature; receipt alone cannot confirm payment |
| IdempotencyRecord | Retry/effect identity | scope, actor context, key hash, request fingerprint, state, reusable response ref, configurable expiry, timestamps | Same key/different payload cannot reuse effect |
| Ticket | Canonical participant/access entitlement carrier | registration, explicit holder association, product, ticket-folio namespace/ref, state, issue/revoke/reissue projection | Does not embed mutable/raw QR credential; one canonical ticket per registration |
| TicketCredentialGeneration | Immutable QR credential generation | ticket, generation identity, high-entropy token hash, state, issued/revoked/expires, prior/replacement refs | Token hash never reused; at most one active generation |
| AccessEntitlement | Date/session right | ticket, date/session, state, individual use/revocation/audit context | Daily use does not exhaust a multi-day Ticket while future entitlements remain |
| ActivityLog | Sensitive action evidence | actor, action, entity-safe ref, result, failure class, time, correlation, idempotency fingerprint, sanitized metadata | No secrets/medical/full payloads |
| OutboxDeliveryJob | Durable communication work | type/template, referenced destination, event, minimal payload, state, attempts, next attempt, result | Delivery failure cannot revert domain truth |

Sensitive profile, multiple quantities, medical data, three-day mechanics, and
other open features are optional extensions; the minimum core remains valid
when they are disabled.

## Appendix B - Relationships, cardinalities, and capacity

### B.1 Cardinalities

| Relationship | Cardinality | Constraint |
|---|---|---|
| Event -> Product | 1:N | Product belongs to one event; public code unique in its governed scope |
| Event -> EventDaySession | 1:N | Date/session belongs to event and has deterministic public order |
| BuyerContact -> Order | 1:N | Order has one buyer context; buyer need not participate |
| Order -> OrderItem | 1:N | At least one item; totals derive from items |
| Order -> Payment | 1:N | Multiple attempts/records allowed; provider payment ID globally unique in provider scope |
| Order -> CapacityHold | 1:N | Historical holds allowed; active quantity bounded |
| Order -> CapabilityCredential | 1:N historical | `ORDER_HOLDER` kind; at most one active generation per holder/order/scope |
| OrderItem -> CapacityHold | 1:N historical | Every hold identifies the exact item/capacity unit it reserves |
| Product -> Registration | 1:N | Registration references exactly one configured product |
| Product -> CapacityHold | 1:N | Hold consumes configured capacity unit |
| Team -> TeamMember | 1:N fixed maximum | Active slots equal product team size at completion |
| Team -> Captain | N:1 participant/slot | Exactly one active captain role |
| Team -> CapabilityCredential | 1:N historical | `CAPTAIN` kind; at most one active generation per captain/team/scope |
| TeamMember -> Participant | 0..1:1 | Empty invited slot permitted; completed active slot has one participant |
| TeamMember -> Registration | 0..1:1 | Empty slot has none; every occupied active captain/invitee slot has exactly one unique member registration |
| TeamMember -> CapabilityCredential | 0:N historical | Captain needs no invitation code; invited slot has at most one active exchange-code generation and one applicable invited-member capability generation; exchange atomically links both generations |
| Participant -> Registration | 1:N | Duplicate active registration policy remains governed |
| Participant -> WaiverAcceptance | 1:N | Acceptance references exact version |
| Registration -> Ticket | 1:0..1 | One canonical ticket after eligibility; history belongs to credential generations |
| Ticket -> TicketCredentialGeneration | 1:N historical | Exactly one active generation when ticket is active; every token hash globally unique across generations |
| Ticket -> AccessEntitlement | 1:N | Single-day may have one; proposed three-day may have three |
| Ticket/access holder -> CapabilityCredential | 1:N historical | `TICKET_ACCESS` kind; at most one active generation per holder/authorized entitlement set/scope |
| Payment -> WebhookEvent | 1:N | Notification receipts do not duplicate payment effect |
| Payment -> PaymentVerificationRecord | 1:N | Verification attempts/evidence are immutable enough for retry/reconciliation; latest valid result is explicit |

Forbidden logical states:

- ticket without valid registration;
- team active slots above configured team size;
- two active members in one position;
- complete roster with missing/invalid active slots;
- waiver acceptance without exact waiver version;
- confirmed registration without configured product;
- applied approved payment with unresolved amount/currency/reference mismatch;
- two orders consuming one provider payment;
- two active ticket credential generations for one registration/access;
- occupied team slot without exactly one member registration;
- reused token hash in any revoked, expired, replaced, or active generation;
- capacity hold without an exact order item;
- payer or access-holder authority inferred only from buyer identity.

### B.2 Capacity units

| Journey | Capacity unit | Participants/access holders | Ticket outcome |
|---|---|---:|---:|
| J1 Individual | one registration | 1 | 1 |
| J2 Doubles | one team | 2 | 2 |
| J3 Relay | one team | 4 | 4 |
| J4 Workout | one person | 1 | 1 |
| J5 Spectator | one sold access unit | 1 per unit | 1 per unit |
| J5 Photographer | one sold accreditation | 1 per unit | 1 per unit |

```text
1 doubles order item quantity 1
= 1 capacity unit
= 2 participants
= 2 registrations/tickets

1 relay order item quantity 1
= 1 capacity unit
= 4 participants
= 4 registrations/tickets
```

### B.3 Approved catalog identity check

SPEC-030 remains authority for every commercial value. This inventory verifies
that the shared Product responsibility covers all unique approved codes:

| Block | Count | Approved unique codes |
|---|---:|---|
| COMPITE | 13 | `DOB-VIE-MM`, `DOB-VIE-HH`, `DOB-VIE-MH`, `DOB-SAB-MM`, `DOB-SAB-HH`, `DOB-SAB-MH`, `REL-4H`, `REL-4M`, `REL-2H2M`, `IND-H`, `IND-M`, `IND-PRO-H`, `IND-PRO-M` |
| EXPERIENCE | 7 | `HALF-IND-M`, `HALF-IND-H`, `HALF-DOB-MM`, `HALF-DOB-HH`, `HALF-DOB-MH`, `WOD-M`, `WOD-H` |
| ASISTE | 8 | `PUB-VIE`, `PUB-SAB`, `PUB-DOM`, `PUB-3D`, `FOT-VIE`, `FOT-SAB`, `FOT-DOM`, `FOT-3D` |
| **Total** | **28** | **`13 + 7 + 8 = 28`; 28 distinct codes** |

## Appendix C - Money and state transitions

### C.1 Monetary invariants

- all stored/computed amounts are integer cents;
- launch currency is exactly `MXN`;
- authoritative unit price comes from configured product;
- snapshot freezes product/journey/unit price/quantity/total/currency/benefits;
- `unit_price_cents * quantity = item_total_cents`;
- `sum(item_total_cents) = order_total_cents`;
- verified Mercado Pago amount/currency equal order snapshot;
- chip and insurance are included according to product, never re-added;
- doubles unit price is the full pair;
- relay unit price is the full four-person team;
- discounts/coupons/MSI/cash remain disabled until approved;
- later product-price changes do not alter existing snapshots.

### C.2 Transition contract

Every transition row requires authorized service/operator identity, canonical
precondition, named event, listed effects, audit, and safe recovery. Frontend
and redirect cannot invoke sensitive transitions.

Uniform audit for every row records actor, from/to state, named event, entity
reference, result, timestamp, correlation ID, idempotency fingerprint when
applicable, and sanitized reason. The final column defines transition-specific
prohibition/recovery; omitted arbitrary reverse transitions are forbidden.

#### Order transitions

| From | To | Actor/event | Preconditions/effects | Prohibited/recovery |
|---|---|---|---|---|
| none | `CREATED` | TX-1 checkout service | Valid idempotency/product; create order/item snapshot | No provider-approved claim |
| `CREATED` | `PREFERENCE_PENDING` | TX-1 local commit | Registration/team/hold durable | Retry same logical checkout |
| `PREFERENCE_PENDING` | `PAYMENT_PENDING` | Provider preference linked | Exact snapshot amount/currency/reference | Lost response reconciles before recreation |
| `CREATED`/`PREFERENCE_PENDING` | `CANCELLED`/`EXPIRED` | Authorized timeout/cancel policy | No verified approved payment | Release hold idempotently |
| `PAYMENT_PENDING` | `PAID` | TX-2 verified approved payment | Merchant/reference/amount/currency valid | Effectively-once effects |
| `PAYMENT_PENDING` | `REJECTED`/`CANCELLED`/`EXPIRED` | TX-2 verified state/policy | No approved payment | Release hold per policy |
| any payable state | `REQUIRES_REVIEW` | Reconciliation service | Ambiguous/late/mismatch incident | No unavailable ticket/overcapacity |
| `REQUIRES_REVIEW` | `PAID`/`REFUNDED`/`CANCELLED` | Authorized reconciliation command | Provider truth plus capacity/refund decision verified | No direct arbitrary assignment; preserve incident history |
| `PAID` | `REFUNDED`/`CHARGED_BACK` | TX-2 verified corrective state | Approved policy governs downstream effects | Preserve financial truth/audit |

#### Payment transitions

| From | To | Actor/event | Preconditions/effects | Prohibited/recovery |
|---|---|---|---|---|
| none/`UNKNOWN` | `PENDING`/`APPROVED`/`REJECTED`/`CANCELLED` | Payment verifier | Signed ingress/reconciliation and provider query | Notification payload alone insufficient |
| `PENDING` | `APPROVED`/`REJECTED`/`CANCELLED` | Payment verifier | Fresh canonical provider state | No browser transition |
| `APPROVED` | `REFUNDED`/`CHARGED_BACK` | Payment verifier | Fresh provider corrective state | No rollback to pending |
| none | `UNKNOWN` | First verification unavailable | No prior verified normalized state exists; record failed attempt/reconciliation separately | Retry/reconcile; no effects |

After any verified state exists, provider unavailability MUST NOT transition
Payment to `UNKNOWN` or erase/regress the last verified state. It creates a
separate failed PaymentVerificationRecord/reconciliation attempt.

#### Registration transitions

| From | To | Actor/event | Preconditions/effects | Prohibited/recovery |
|---|---|---|---|---|
| none | `STARTED` | TX-1 | Configured product/order holder context | No ticket |
| `STARTED` | `PENDING_PAYMENT` | TX-1 local commit | Order/hold durable | Recover from checkout retry |
| `PENDING_PAYMENT` | `PAYMENT_CONFIRMED` | TX-2 | Verified approved payment | Idempotent |
| `PAYMENT_CONFIRMED` | `DATA_INCOMPLETE`/`COMPLETE` | Registration service | Evaluate required data/waiver | Missing data cannot be eligible |
| `DATA_INCOMPLETE` | `COMPLETE` | Participant/registration service | Missing approved fields/waiver supplied | Re-evaluate canonical data; no frontend state assignment |
| `COMPLETE` | `ELIGIBLE` | Eligibility service | All applicable rules pass | Ticket emitible idempotently |
| active | `BLOCKED`/`CANCELLED` | Named policy/recovery | Authorized reason | Audit and ticket review |
| `BLOCKED` | `DATA_INCOMPLETE`/`COMPLETE`/`ELIGIBLE` | Authorized incident resolution | Blocking cause resolved and rules re-evaluated | Preserve blocked interval/reason |

#### Team transitions

| From | To | Actor/event | Preconditions/effects | Prohibited/recovery |
|---|---|---|---|---|
| none | `PROVISIONAL` | TX-1 J2/J3 | Captain/product/fixed slots created | No extra slots |
| `PROVISIONAL` | `PAYMENT_PENDING` | TX-1 local commit | Order/hold durable | No active tickets |
| `PAYMENT_PENDING` | `PAID_ROSTER_INCOMPLETE` | TX-2 | Approved payment; missing slots/data/waivers | Preserve paid truth |
| `PAID_ROSTER_INCOMPLETE` | `PAID_ROSTER_COMPLETE` | TX-3/member service | All slots linked, personal requirements evaluated | No captain acceptance for adults |
| `PAID_ROSTER_COMPLETE` | `ELIGIBLE` | Eligibility service | Composition/waivers/rules pass; all occupied slots have registrations | Atomically issue/reconcile complete J2 two-ticket or J3 four-ticket set once |
| active | `BLOCKED`/`CANCELLED` | Named authorized policy | Reason and downstream effects defined | Audit/recovery |
| `BLOCKED` | `PAID_ROSTER_INCOMPLETE`/`PAID_ROSTER_COMPLETE`/`ELIGIBLE` | Authorized incident resolution | Blocking cause resolved; payment/roster/rules re-evaluated | No skipped roster/waiver validation |

#### Team-member transitions

| From | To | Actor/event | Preconditions/effects | Prohibited/recovery |
|---|---|---|---|---|
| none | `INVITED` | Captain/service | Empty slot and active invite generation | No duplicate slot |
| none | `STARTED`/`DATA_COMPLETE`/`WAIVER_ACCEPTED`/`COMPLETE` | TX-1 captain initialization | Captain owns designated empty slot and supplies each applicable prerequisite | No implicit waiver; persist only reached state |
| `INVITED` | `STARTED` | TX-3B invited-member capability | Valid scoped invited-member capability after TX-3A code exchange | Code is one-use; capability is scoped/rotatable and must not complete the slot alone |
| `STARTED` | `DATA_COMPLETE` | Invited member | Approved minimum fields pass | No other-member mutation |
| `DATA_COMPLETE` | `WAIVER_ACCEPTED` | Invited adult | Exact version accepted personally | No delegated adult waiver |
| `WAIVER_ACCEPTED` | `COMPLETE` | TX-3 | Slot/participant/member registration valid | Recalculate roster; if team becomes eligible issue all missing roster tickets atomically |
| active | `REMOVED`/`REPLACED` | TX-4 | Approved policy/authority | Preserve history; revoke old access |

#### Invitation exchange-code transitions

| From | To | Actor/event | Preconditions/effects | Prohibited/recovery |
|---|---|---|---|---|
| none | `ISSUED` | Team/capability service | Empty slot and authorized requester | Hash only where possible |
| `ISSUED` | `DELIVERED`/`OPENED` | Delivery/exchange evidence | Valid active generation | No PII enumeration |
| `DELIVERED` | `OPENED` | Capability exchange evidence | Valid unconsumed active generation | No authorization from telemetry alone |
| `ISSUED`/`DELIVERED`/`OPENED` | `CONSUMED` | TX-3A exchange service | Atomic unused code; mint one scoped invited-member capability; roster unchanged | Same code/key returns same exchange; another-key replay fails safely |
| active | `EXPIRED`/`REVOKED`/`REPLACED` | Time/policy/TX-4 | Named reason | Old generation cannot authorize |

#### Scoped capability transitions

These transitions apply independently to `ORDER_HOLDER`, `CAPTAIN`,
`INVITED_MEMBER`, and `TICKET_ACCESS` kinds.

| From | To | Actor/event | Preconditions/effects | Prohibited/recovery |
|---|---|---|---|---|
| none | `ACTIVE` | Authorized capability service mint | Canonical order/team/slot/holder/entitlement exists; least scope and active generation fixed | No authority inferred from internal ID or provider redirect |
| `ACTIVE` | `ROTATED` | Holder/service security event | Mint replacement generation and atomically invalidate prior raw authority | Repeated rotation key returns same replacement |
| `ACTIVE`/`ROTATED` | `REVOKED` | Authorized cancellation/substitution/security event | Invalidate specified generation without changing payment truth | Replay remains revoked |
| `ACTIVE` | `EXPIRED` | Configured expiry | Time boundary reached | New authority requires authorized mint/rotation |

Order-holder and captain capabilities originate in TX-1, invited-member
capability originates only from successful one-time-code exchange, and
ticket-access capability originates from secure holder binding/entitlement
issuance. Ticket reissue rotates/revokes the corresponding ticket-access
generation.

#### Capacity-hold transitions

| From | To | Actor/event | Preconditions/effects | Prohibited/recovery |
|---|---|---|---|---|
| none | `ACTIVE` | TX-1 | Atomic capacity available | No over-capacity |
| `ACTIVE` | `CONVERTED` | TX-2 | Verified payment and available hold | Idempotent conversion |
| `ACTIVE` | `RELEASED`/`EXPIRED` | Policy/timeout/failure | No valid conversion | Idempotent release |
| released/expired | `CONFLICT` | Late verified payment | Payment truth preserved | `REQUIRES_REVIEW`; no automatic ticket |

#### Ticket transitions

| From | To | Actor/event | Preconditions/effects | Prohibited/recovery |
|---|---|---|---|---|
| none | `PENDING` | Entitlement service | Verified payment, canonical registration exists | No active QR generation |
| `PENDING` | `ISSUED` | Entitlement service | Holder/eligibility valid; activate first credential generation | One canonical Ticket and one active generation |
| `ISSUED`/`REISSUED` | `USED` | Future check-in contract | All applicable AccessEntitlements are used/exhausted | A first daily use cannot exhaust a three-day Ticket |
| `ISSUED`/`REISSUED`/`USED` | `REVOKED`/`CANCELLED` | Named authorized event | Substitution/refund/security policy | Revoke active credential; preserve canonical history |
| `ISSUED`/`REVOKED` | `REISSUED` | Reissue service | Valid canonical entitlement/reason | Revoke old credential generation; activate linked replacement |

#### Access-entitlement transitions

| From | To | Actor/event | Preconditions/effects | Prohibited/recovery |
|---|---|---|---|---|
| `AVAILABLE` | `USED` | Future check-in service | Ticket/credential active and entitlement valid for date/session | Other future entitlements remain available |
| `AVAILABLE` | `REVOKED` | Authorized ticket/policy event | Named reason | Does not mutate unrelated entitlement |
| `USED` | `REVOKED` | Authorized corrective event | Named incident/policy | Preserve use evidence; no silent reset |

## Appendix D - Transactions, concurrency, and idempotency

### D.1 TX-1 - Checkout initiation

Local durable unit:

1. validate idempotency;
2. resolve configured product and approved quantity;
3. verify sale state and trusted price;
4. calculate capacity unit;
5. create/resolve buyer;
6. create order and item snapshot;
7. create a single registration for J1/J4/J5, or for J2/J3 create the
   provisional team/fixed slots plus the captain's participant, member slot,
   and member registration;
8. record applicable personal waiver acceptance;
9. atomically create capacity hold;
10. mint/return one order-holder capability and, for J2/J3, one separate
    captain capability under deterministic generation identities;
11. persist `PREFERENCE_PENDING` and outbox/audit evidence.

External phase:

12. call Mercado Pago outside the local database transaction;
13. use exact snapshot total/currency and unique external reference;
14. persist preference reference and `PAYMENT_PENDING`;
15. return opaque continuation.

If the provider call fails, local state remains named/non-payable and the hold
is released or bounded by approved policy. If preference creation may have
succeeded but response was lost, retry reconciles existing provider/order
identity before creating anything new.

### D.2 TX-2 - Webhook/payment effect

1. preserve a bounded untrusted ingress verification envelope containing
   canonical/raw bytes or equivalent canonical inputs plus required headers,
   without unsafe logging or canonical domain receipt;
2. validate `x-signature` against the preserved inputs;
3. reject invalid/unverifiable signatures with sanitized security audit and no
   canonical receipt, provider query, payment, order, capacity, registration,
   ticket, or outbox effect;
4. after a valid signature, persist/deduplicate the canonical notification
   receipt by provider notification identity;
5. query Mercado Pago;
6. verify merchant ownership;
7. verify external reference and order relation;
8. verify amount and currency against snapshot;
9. durably persist a PaymentVerificationRecord/reconciliation inbox entry with
   sanitized verified provider evidence and check results;
10. in a new atomic domain-effect transaction, upsert/transition payment;
11. transition order;
12. convert or route capacity hold;
13. confirm registrations/team payment projection;
14. create the complete eligible ticket/credential/capability set
    idempotently;
15. append ActivityLog and create outbox jobs in the same transaction.

Provider query and durable verification staging occur before the internal
domain-effect transaction. Steps 10-15 commit atomically; if ActivityLog or
outbox persistence fails, all domain effects in that transaction roll back.
The separately committed PaymentVerificationRecord preserves verified external
truth for bounded retry/reconciliation without asserting the domain effects
were completed.

### D.3 TX-3 - Invited member

TX-3A bootstrap exchange:

1. validate high-entropy one-time code, expiry/revocation, slot, strict
   abuse/rate profile, and exchange idempotency;
2. atomically consume the code and mint exactly one scoped invited-member
   capability;
3. return minimum safe context without completing the slot;
4. same code/key returns the same exchange result; another-key replay fails;
5. audit only code/capability fingerprints and safe references.

TX-3B member completion:

6. validate scoped invited-member capability and completion idempotency;
7. verify one slot and active capability generation;
8. reject duplicate/already-active participant conflict;
9. create/link participant and exactly one member Registration for the slot;
10. persist only approved data;
11. record personal waiver acceptance;
12. complete slot without treating reusable capability as a one-time code;
13. rotate/revoke continuation authority according to API-OD-004;
14. recalculate roster and eligibility;
15. if the team first becomes eligible, atomically issue/reconcile the complete
    set of two J2 or four J3 canonical Tickets, credential generations, and
    holder capabilities, including captain/earlier members;
16. append audit/outbox in the same domain-effect transaction.

### D.4 TX-4 - Substitution

1. validate captain/operator authority and approved policy;
2. lock/validate target active slot;
3. revoke old invitation code and invited-member capability generations;
4. mark prior member replaced while preserving history;
5. revoke prior ticket credential and ticket-access capability generations
   while preserving the canonical Ticket/history;
6. create replacement invitation generation;
7. recalculate roster/eligibility;
8. preserve payment/order truth;
9. append audit/outbox.

### D.5 Last-capacity concurrency

For two attempts against one remaining unit:

```text
Attempt A and B read/compete through one atomic reservation boundary.
Exactly one creates ACTIVE hold.
The other receives SOLD_OUT or CONFLICT.
No second valid hold, negative capacity, or silent oversale exists.
```

No SQL primitive is selected here. Implementation must prove atomic
check-and-reserve and idempotent conversion/release.

### D.6 Late approved payment

When payment is verified after hold release/expiration:

- preserve `Payment.APPROVED`;
- transition order/hold reconciliation to `REQUIRES_REVIEW`/`CONFLICT`;
- issue no unavailable ticket and do not silently exceed capacity;
- create audit and buyer-communication outbox;
- permit only named authorized refund or capacity-expansion/recovery command;
- preserve original amount and provider truth.

Final commercial policy remains open.

### D.7 Idempotency and uniqueness

| Unique/logical key | Required behavior |
|---|---|
| Product public code | One configured product per governed event scope |
| Public order-tracking namespace + reference | One order; never reused as ticket folio |
| External reference | One order/provider checkout identity |
| Provider + payment ID | One payment record/order relation |
| Provider + notification ID | One webhook receipt |
| Team + active position | One active member slot |
| Ticket-folio namespace + public folio | One canonical Ticket; never reused as order reference |
| Ticket token hash | Globally unique across all active/revoked/expired/replaced generations |
| Any exchange-code or order-holder/captain/invited-member/ticket-access capability token hash | Globally unique across all active/consumed/revoked/expired/replaced generations and credential kinds |
| Capability `(kind, subject, resource, scope)` | At most one active generation; rotation atomically invalidates the prior generation |
| Order item + hold identity | Every hold reserves one exact item/capacity unit; repeated logical hold reconciles |
| Waiver type + version | One immutable version |
| Idempotency scope + key hash | Same fingerprint returns prior result; different fingerprint conflicts |

## Appendix E - Access, security, and data classification

### E.1 Access boundaries

| Actor | Allowed logical access | Forbidden |
|---|---|---|
| Anonymous | Public event/product reads; invoke protected checkout command | Direct writes, order/participant/ticket lists, private data |
| Buyer with capability | Own order projection and policy-authorized tickets/team progress | Other buyers/participants; payment mutation |
| Captain | Own team progress, invitation management, approved substitution request | Other adults' waivers/medical data/payment state changes |
| Invited member | One slot completion, own waiver/progress/ticket | Other slots, captain authority, price/order mutation |
| Internal service | Named checkout/webhook/ticket/audit/reconciliation operations by service role | Unbounded generic state mutation |
| Operator | Named support/recovery commands under least privilege | Direct arbitrary state assignment or secret access beyond role |

Capabilities never expand these actor boundaries:

- order-holder capability: one order and allowlisted buyer continuations;
- captain capability: one team and captain-only roster actions;
- invited-member capability: one slot and that member's own continuation;
- ticket-access capability: one holder and authorized entitlement set;
- one-time invitation exchange code: only atomic exchange for the
  invited-member capability; no roster, waiver, payment, or ticket authority.

### E.2 Data classification

| Class | Examples | Boundary |
|---|---|---|
| Public | event, products, approved prices, public availability, dates/descriptions | Public read; cache only under freshness policy |
| Personal | name, email, phone, participant identity, team relation | Authorized journey/holder/operator only |
| Sensitive restricted | approved medical data, emergency contact, private notes, special legal evidence | Separate optional profile; strict purpose/role/audit |
| Operational financial | order, integer amount, state, payment identifier, reconciliation | Buyer-safe projection or protected service/operator |
| Prohibited | card data, CVV, MP access token, webhook secret, credentials | Never stored in domain model |

Retention, deletion, anonymization, and exact personal/sensitive fields remain
implementation/production decisions.

### E.3 Ticket and QR

- random high-entropy opaque token;
- immutable credential generation with secure hash/non-recoverable
  representation where practical;
- server-side resolution;
- revocation/reissue/prior-generation relation;
- one canonical Ticket and at most one active credential generation;
- no PII, medical, payment, financial, or admin data;
- audit without raw token.

Proposed, not final:

```text
PUB-3D/FOT-3D
1 ticket -> 3 date-specific AccessEntitlement records
```

Ticket reissue preserves the canonical Ticket and unused AccessEntitlements,
revokes/rotates both the QR credential generation and applicable ticket-access
capability generation, links the replacement to its prior generation, and only
then activates the replacement.

### E.4 Abuse and rate profiles

| Profile | Conceptual boundary |
|---|---|
| Public reads | Network risk, resource, polling frequency, cache/freshness, enumeration-safe errors |
| Checkout | Actor/network/product/idempotency scope, request size, concurrent attempts |
| Capability exchange | Code fingerprint/invitation/slot/network/time window; strict replay control |
| Capability mint/rotate/revoke | Service identity, actor/resource/generation/network risk |
| Invitation resend/use | Actor/team/slot/destination/network/time window; existence-safe response |
| Webhook ingress | Provider/merchant/network, body size, verification attempts, bounded acknowledgement |
| Ticket access/reissue | Holder/entitlement/generation/network/time window |
| Operator recovery | Named operator/entity/command/reason/time window with strict human-action limit |

Exact thresholds remain implementation decisions, but no implementation unit
may omit a named profile, sanitized evidence, deterministic rate outcome, and
bounded retry/concurrency behavior.

## Appendix F - Audit and outbox

Minimum named audit events:

- checkout initiated;
- hold created/converted/released/expired/conflicted;
- preference requested/linked/reconciled;
- webhook received and signature accepted/rejected;
- payment queried/verified/mismatched;
- order transition;
- registration/team/eligibility transition;
- invitation issued/exchanged/consumed/revoked/replaced;
- member completed/substituted;
- waiver accepted;
- ticket issued/revoked/reissued;
- manual named intervention.

ActivityLog records actor/action/entity-safe reference/result/failure class/
time/correlation/idempotency fingerprint/sanitized metadata.

Outbox jobs commit with domain effects. Communication delivery runs later with
bounded retries. Email failure:

- does not revert payment, order, registration, or ticket;
- records attempt/result/next attempt;
- supports authorized audited resend.

## Appendix G - Seed reconciliation

The seed remains unmodified and unexecuted.

| ID | Location | Current value | Approved value | Correction type | Blocks schema migration | Blocks seed execution |
|---|---|---|---|---|---|---|
| SEED-001 | Footer product total | 29 products | 28 products | Editorial count | No | Yes |
| SEED-002 | Footer ASISTE count | ASISTE 9 | ASISTE 8 | Editorial count | No | Yes |
| SEED-003 | Saturday `event_days` label | ½ Hybrid/Workout AM; Relay PM | Must also represent approved Saturday doubles AM or await owner wording | Public schedule decision | No | Yes |
| SEED-004 | Header filename | `0002_seeds_hybrid_experience.sql` | Actual governed filename `0002_seeds_hybrid_event.sql` | Editorial filename | No | Yes |
| SEED-005 | Header chip/insurance rule | All include; only Workout exception | Flags govern: Workout and ASISTE have no chip/insurance; no extra charge | Rule-scope clarification | No | Yes |

```text
Seed status: NOT_READY_FOR_EXECUTION
Future gate: READY_FOR_SEED_CORRECTION
```

## Appendix H - Implementation preparation

This sequence is planning only.

| Unit | Related requirements | Anticipated files | External resources | Tests/evidence | Rollback | Entry gate | Exit gate |
|---|---|---|---|---|---|---|---|
| IMPL-1 Correct/version seed | R013, R048, R050 | `insforge/seeds/0002_seeds_hybrid_event.sql`, seed review evidence | None | 28 unique rows; 13+7+8; labels/comments match | Revert seed-only commit before execution | `READY_FOR_SEED_CORRECTION` + human authorization | `SEED_CORRECTED_READY_FOR_SCHEMA` |
| IMPL-2 Minimal schema migration | R011-R032, R054-R055 | future `insforge/migrations/<version>_minimal_sales_schema.sql` | InsForge database | clean apply/rollback in isolated environment; 24-entity inventory | Approved down/replacement migration before data | SPEC-032 approved; IMPL-1 closed | `SCHEMA_MIGRATION_READY_FOR_CONSTRAINTS` |
| IMPL-3 Constraints/indexes | R033-R043, R054-R055 | same/follow-up migration files | InsForge database | uniqueness, FK/cardinality, team-member registration, token-generation, money/capacity concurrency tests | Replacement migration; no destructive production rollback | IMPL-2 validated | `CONSTRAINTS_READY_FOR_ACCESS` |
| IMPL-4 RLS/access limits | R010, R020, R044-R047, R053 | future access-policy migration/tests | InsForge auth/database | anonymous denial; role/capability/service matrix; enumeration-safe errors and named abuse/rate profiles | Disable affected release; revoke affected capabilities; corrective policy migration | IMPL-3 validated; API-OD-004/005/007 and applicable auth decisions approved | `ACCESS_READY_FOR_SEED` |
| IMPL-5 Apply catalog seed | R013, R034-R035, R048/R050 | corrected seed and execution evidence | InsForge database | exact 28 products and event/session checks | Controlled delete/reversal only in non-production or approved corrective migration | IMPL-1/4 closed; execution authorization | `CATALOG_SEEDED` |
| IMPL-6 Validate 28 products | R013, R034-R035, R050 | validators/test reports | Read-only InsForge | codes, counts, prices, flags, schedule, journeys, capacity | Correct seed/migration through new authorized unit | IMPL-5 | `CATALOG_VALIDATED` |
| IMPL-7 Checkout | R004-R006, R020, R023-R025, R028, R034-R037, R053 | future protected functions/services/tests | InsForge functions; Mercado Pago sandbox only after authorization | idempotency/TTL, snapshot, hold, order/captain capability mint, rate/size/concurrency, timeout/lost response/return URL | Disable checkout; revoke affected capabilities; reconcile non-payable orders/holds | Schema/access/catalog validated; MP sandbox authorization; OD-001/003-006/010/014-016/023 and API-OD-001/002/003/004/009 resolved or explicitly disabled for launch scope | `CHECKOUT_READY_FOR_WEBHOOK` |
| IMPL-8 Webhook | R007, R026-R028, R038, R047, R053, R055 | future webhook/payment functions/tests | InsForge functions; Mercado Pago sandbox webhook | canonical signature inputs before receipt, durable verification staging, atomic effects/audit/outbox rollback, ownership, duplicate/out-of-order/mismatch, async retry, audit/telemetry/retention and ingress rate/size | Disable ingress effects; reconciliation/replay from valid durable verification records | IMPL-7; webhook authorization; API-OD-001/002/003/005/006/007 resolved | `PAYMENT_EFFECTS_VALIDATED` |
| IMPL-9 Orders/public state | R020, R023-R028, R036, R044-R045, R053 | future order-state service/tests | InsForge database/functions | order-capability bootstrap/rotation, state projections, no-store/privacy, ticket access policy, polling/enumeration/rate | Disable public read; revoke affected capabilities; preserve canonical data | IMPL-8; API-OD-001/002/003/004/005/007/010 resolved; OD-018/019 resolved where public support/folio is enabled | `ORDER_STATE_READY` |
| IMPL-10 Teams/invitations | R017-R022, R039-R040, R043-R045, R053-R054 | future roster/capability services/tests | InsForge database/functions; email provider after decision | fixed slots, captain/invitee registrations, code-to-capability atomic exchange/replay, mint/rotate/revoke, strict rate/enumeration, personal waivers, complete 2/4 ticket-set issuance, delivery retry, substitution history | Disable new invites/substitutions; revoke affected code/capability generations | OD-003-006/008/009/011/017/021 and API-OD-001/002/003/004/005/007/008 resolved or relevant optional path disabled | `ROSTER_READY_FOR_TICKETS` |
| IMPL-11 Tickets/QR | R008, R020, R029-R030, R046, R053-R054 | future entitlement/capability services/tests | InsForge database/functions | counts J1-J5, one canonical ticket/active credential and capability generation, daily entitlement use, opaque QR, revoke/reissue/rotation, holder privacy/rate, authorized buyer access | Revoke affected credential/capability generation; disable issuance; preserve canonical ticket/unused entitlements | IMPL-8/9/10 as applicable; OD-019/020 and API-OD-001/002/003/004/005/007/010 resolved for enabled behavior | `TICKETS_READY_FOR_E2E` |
| IMPL-12 Sandbox E2E | All implemented requirements | test fixtures/reports only | InsForge test environment; Mercado Pago sandbox | J1-J5 checkout/webhook/roster/ticket; concurrency/recovery | Stop release; clean test data through approved process | IMPL-1-11 validated; explicit sandbox authorization | `SANDBOX_E2E_VALIDATED` |

No row authorizes execution. Each unit requires a separate human-approved
instruction and validation evidence.

## Appendix I - Acceptance criteria

Each criterion records documentary result separately from runtime result.

### SPEC-032-AC001

- **Precondition:** Authority specs and Appendix A are available.
- **Artifact:** Entity inventory and R011-R032/R054-R055.
- **Action:** Verify all 24 entities have one responsibility, minimum logical
  attributes, prohibitions, and source contract.
- **Expected result:** No required responsibility is missing or merged into an
  ambiguous generic record.
- **Evidence:** Entity-to-requirement matrix.
- **Requirements:** R011-R032, R054-R055.
- **Result rule:** `PASS` on 24 complete entities; `FAIL` on missing/ambiguous
  responsibility; `BLOCKED` if parent specs unavailable; otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC002

- **Precondition:** Appendices A/B are complete.
- **Artifact:** Cardinality table and forbidden-state list.
- **Action:** Inspect each relation, minimum/maximum, ownership, and forbidden
  state.
- **Expected result:** Ticket requires registration, teams respect product
  size, each occupied team slot has one member registration, holds identify
  order items, ticket credentials have immutable history, waivers are
  versioned, and payment/order/payer relations are explicit.
- **Evidence:** Relationship/cardinality review.
- **Requirements:** R006, R033, R043, R054-R055.
- **Result rule:** `PASS` when every listed relation and prohibition is
  deterministic; `FAIL` otherwise; `BLOCKED` if entities unavailable;
  otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC003

- **Precondition:** SPEC-030 catalog and Product entity exist.
- **Artifact:** Product fields, seed text, and catalog authority.
- **Action:** Count unique configured codes by block and verify shared Product
  model/J1-J5 mapping.
- **Expected result:** `13 + 7 + 8 = 28`, unique codes, no 28 structures.
- **Evidence:** Catalog count/configuration matrix.
- **Requirements:** R013, R050.
- **Result rule:** `PASS` on exact count/uniqueness/shared model; `FAIL` on any
  mismatch; `BLOCKED` without catalog authority; otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC004

- **Precondition:** Money/order/item/payment contracts are available.
- **Artifact:** R004-R005/R023-R026/R035 and Appendix C.1.
- **Action:** Verify integer cents, MXN, snapshot multiplication/sums, full
  doubles/relay units, included benefits, provider comparison, price history.
- **Expected result:** No float or duplicated surcharge; snapshot and provider
  total/currency agree contractually.
- **Evidence:** Monetary invariant matrix.
- **Requirements:** R004-R005, R023-R024, R026, R035.
- **Result rule:** `PASS` when every equation/boundary is explicit; `FAIL` on
  ambiguous amount/currency; `BLOCKED` if price authority unavailable;
  otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC005

- **Precondition:** Capacity and ticket mappings exist.
- **Artifact:** Appendix B.2.
- **Action:** Walk one sale for J1-J5, including captain/invitee registrations
  and team eligibility completion.
- **Expected result:** J1 capacity1/registration1/ticket1; J2
  team1/member-registrations2/tickets2 issued as one complete set; J3
  team1/member-registrations4/tickets4 issued as one complete set; J4
  person1/registration1/ticket1; J5 one registration/ticket per sold unit.
- **Evidence:** Journey capacity/ticket matrix.
- **Requirements:** R008-R009, R034, R050.
- **Result rule:** `PASS` on exact mapping; `FAIL` if J2/J3 capacity multiplies
  by participants or ticket count differs; `BLOCKED` without SPEC-030;
  otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC006

- **Precondition:** Appendix C.2 is complete.
- **Artifact:** All Appendix C.2 matrices for order, payment, registration,
  team, team member, invitation exchange code, scoped capability, capacity
  hold, ticket, and access entitlement.
- **Action:** Verify actor, precondition/event, effects, prohibited path,
  audit, and recovery for every transition.
- **Expected result:** Frontend/redirect cannot transition sensitive state; all
  required states and corrective states are reachable safely.
- **Evidence:** State-transition coverage matrix.
- **Requirements:** R036, R044, R047.
- **Result rule:** `PASS` when every state/transition has complete semantics;
  `FAIL` on missing/unsafe transition; `BLOCKED` if source contract missing;
  otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC007

- **Precondition:** TX-1 and related entities are available.
- **Artifact:** Appendix D.1.
- **Action:** Walk success, same-key retry, provider timeout, and lost
  preference response.
- **Expected result:** Local state/hold/snapshot are durable before provider
  call; no duplicate order/preference; compensation/reconciliation named.
- **Evidence:** TX-1 boundary/failure matrix.
- **Requirements:** R005, R023-R025, R028, R037, R047.
- **Result rule:** `PASS` on deterministic durable/external phases; `FAIL` on
  partial uncontrolled state; `BLOCKED` if checkout contract unavailable;
  otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC008

- **Precondition:** TX-2 and payment/webhook entities are available.
- **Artifact:** Appendix D.2.
- **Action:** Walk valid approved, duplicate notification, invalid signature,
  out-of-order, ownership/reference/amount/currency mismatch.
- **Expected result:** Required signature inputs are preserved safely before
  validation; invalid signature produces no canonical receipt/provider/domain
  effect; valid duplicates produce one receipt identity and one payment effect;
  verified evidence is durably staged before an atomic domain/audit/outbox
  transaction; receipt/verification/effect stages remain distinct.
- **Evidence:** TX-2 webhook/effect matrix.
- **Requirements:** R007, R026-R027, R038, R043, R047, R055.
- **Result rule:** `PASS` on signature-before-receipt/domain ordering, exactly
  one logical effect, and all validations; `FAIL` on pre-validation canonical
  receipt/effect, duplicate, or skipped invariant; `BLOCKED` if provider
  contract unavailable; otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC009

- **Precondition:** TX-3 and team/invitation/waiver entities are available.
- **Artifact:** Appendix D.3 and C.2 member/invitation transitions.
- **Action:** Walk one-time code exchange, same code/key retry, another-key
  replay, separate invited-capability completion, duplicate participant,
  personal waiver, member-registration creation, and complete team
  eligibility/ticket-access capability outcome.
- **Expected result:** Code exchange consumes one code and mints one scoped
  capability without roster completion; completion creates one
  slot/member/registration/acceptance; replay safe; first team eligibility
  atomically reconciles all two/four tickets and holder capabilities.
- **Evidence:** TX-3 invitation lifecycle matrix.
- **Requirements:** R008, R017-R022, R028-R029, R039, R043-R047, R054.
- **Result rule:** `PASS` on distinct exchange/completion, all four continuation
  capability families, one-use/personal/atomic semantics; `FAIL` on conflated
  code/capability, replay, duplicate, or delegated waiver; `BLOCKED` if team
  contract unavailable; otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC010

- **Precondition:** TX-4 and substitution policy gating are documented.
- **Artifact:** Appendix D.4 and open decisions.
- **Action:** Verify unapproved substitution is blocked; walk authorized
  conceptual substitution without selecting final policy.
- **Expected result:** Old capability/ticket revoked, history/payment
  preserved, replacement process created, audit durable.
- **Evidence:** TX-4 substitution matrix.
- **Requirements:** R019-R020, R029, R040, R043, R047, R049.
- **Result rule:** `PASS` when open policy is explicitly gated and authorized
  path preserves invariants; `FAIL` on hidden default or lost history/payment;
  `BLOCKED` only if parent roster authority unavailable; otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC011

- **Precondition:** Capacity values and D.5 exist.
- **Artifact:** Last-unit scenario and capacity model.
- **Action:** Simulate two conceptual buyers for one remaining unit.
- **Expected result:** Exactly one ACTIVE hold; other `SOLD_OUT`/`CONFLICT`; no
  negative or duplicate capacity.
- **Evidence:** Concurrency decision matrix.
- **Requirements:** R009, R025, R034, R041.
- **Result rule:** `PASS` on one-winner invariant without SQL invention;
  `FAIL` if two valid holds possible; `BLOCKED` without capacity authority;
  otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC012

- **Precondition:** D.6 and reconciliation states exist.
- **Artifact:** Late-payment flow.
- **Action:** Verify payment approved after hold expiration.
- **Expected result:** Payment preserved; order/hold `REQUIRES_REVIEW`/
  `CONFLICT`; no unavailable ticket/overcapacity; named audited recovery.
- **Evidence:** Late-payment reconciliation matrix.
- **Requirements:** R025-R026, R036, R042, R047.
- **Result rule:** `PASS` on preserved financial truth and blocked unavailable
  effect; `FAIL` on ignored payment/oversale/ticket; `BLOCKED` without payment
  authority; otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC013

- **Precondition:** D.7 and idempotency entities exist.
- **Artifact:** Uniqueness/idempotency table.
- **Action:** Verify every required unique key plus same-key/same-fingerprint
  and same-key/different-fingerprint outcomes.
- **Expected result:** Prior logical response reused only for matching
  fingerprint; incompatible payload conflicts; no duplicate payment/webhook/
  canonical ticket/credential/token/slot effect; revoked hashes cannot be
  reused; order and ticket public-reference namespaces remain separate.
- **Evidence:** Uniqueness/idempotency coverage matrix.
- **Requirements:** R007-R008, R019-R020, R026-R029, R043, R054.
- **Result rule:** `PASS` on complete deterministic coverage; `FAIL` on missing
  key/effect; `BLOCKED` if entity identity unavailable; otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC014

- **Precondition:** Waiver, access, privacy, ticket/QR contracts exist.
- **Artifact:** R016/R021-R022/R029-R030/R044-R046 and Appendix E.
- **Action:** Inspect personal waiver authority, sensitive profile isolation,
  actor permissions, all capability families, QR payload, token storage,
  canonical-ticket/credential separation, per-day entitlement use, three-day
  proposal status, and named abuse/rate profiles.
- **Expected result:** Personal acceptance only; sensitive profile restricted;
  capabilities remain least-scope/revocable/rotatable; QR has no PII;
  abuse/rate/enumeration boundaries cover public/protected operations;
  three-day entitlements remain proposed.
- **Evidence:** Privacy/waiver/QR checklist.
- **Requirements:** R003, R016, R020-R022, R029-R030, R044-R046, R053-R054.
- **Result rule:** `PASS` when all boundaries/profiles are explicit and no open
  choice is finalized; `FAIL` on exposure, authority expansion, missing abuse
  boundary, delegated waiver, or hidden design; `BLOCKED` if source privacy
  contract unavailable; otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC015

- **Precondition:** Audit/outbox contracts and sensitive transactions exist.
- **Artifact:** Appendices D/F.
- **Action:** Verify all named events, transaction coupling, audit failure,
  durable provider-verification staging, domain/audit/outbox atomic rollback,
  delivery retry, and email failure effects.
- **Expected result:** Audit/outbox durable; email failure never reverts
  payment/order/ticket; prohibited data excluded.
- **Evidence:** Audit/outbox event and failure matrix.
- **Requirements:** R031-R032, R037-R040, R047, R055.
- **Result rule:** `PASS` on complete durable evidence/retry boundaries; `FAIL`
  on unaudited mutation or delivery rollback of domain truth; `BLOCKED` if
  transaction missing; otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC016

- **Precondition:** Seed text and Appendix G are available.
- **Artifact:** SEED-001 through SEED-005.
- **Action:** Verify each current/approved value, correction type, and blocker;
  compare seed blob to baseline and operation record for execution.
- **Expected result:** Five findings documented; seed unchanged/unexecuted;
  status `NOT_READY_FOR_EXECUTION`; gate `READY_FOR_SEED_CORRECTION`.
- **Evidence:** Seed reconciliation matrix and Git/blob evidence.
- **Requirements:** R012-R013, R048.
- **Result rule:** `PASS` on all five findings and intact seed; `FAIL` on
  missing finding/modification/execution; `BLOCKED` if seed unavailable;
  otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC017

- **Precondition:** Open decisions and implementation plan are available.
- **Artifact:** Appendices H/K.
- **Action:** Verify imported status/classification, absence of MODEL_BLOCKER,
  and each IMPL row's requirements/files/resources/tests/rollback/gates.
- **Expected result:** No hidden approved choice; 12 gated planning units
  complete and non-authorizing.
- **Evidence:** Decision parity and implementation-readiness matrix.
- **Requirements:** R049-R051.
- **Result rule:** `PASS` on complete parity/plan and zero MODEL_BLOCKER;
  `FAIL` on hidden default/missing gate; `BLOCKED` if parent decisions
  unavailable; otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

### SPEC-032-AC018

- **Precondition:** SALE-3 Phase B Git/MCP operation evidence is available.
- **Artifact:** Scoped diff, protected-path comparison, seed hash, READ_ONLY
  InsForge metadata/buckets, and controlled-action attestation.
- **Action:** Verify only SPEC-032/README/WORKSPACE changed and no landing,
  seed, SQL, InsForge, Mercado Pago, secret, payment, or deployment write ran.
- **Expected result:** Protected files/resources unchanged; InsForge remains
  0 tables/functions/realtime with preserved bucket/slug; SPEC-032 DRAFT.
- **Evidence:** Appendix L.
- **Requirements:** R001, R010, R052.
- **Result rule:** `PASS` only with Git/blob evidence plus scoped operation
  attestation; `FAIL` on mutation/write; `BLOCKED` if evidence unavailable;
  otherwise `NOT_RUN`.
- **Documentary result:** PASS.
- **Runtime result:** NOT_RUN.

## Appendix J - Traceability

All SPEC-032 requirements are now under an `APPROVED` specification.
`Source status` describes parent or originating authority status only.

| Requirement | Authority | Entity | Invariant | Transaction | Failure mode | AC | Open decision | Implementation impact | Source status |
|---|---|---|---|---|---|---|---|---|---|
| R001-R003 | SPEC-001/031 | All/public refs | Canonical/opaque authority | All | Client/internal-ID authority | AC001-AC002, AC014, AC018 | Capability details | Canonical identity/access | APPROVED |
| R004-R005 | SPEC-030/031 | Product/OrderItem/Order/Payment | Integer MXN snapshot totals | TX-1/TX-2 | Amount/currency mismatch | AC004, AC007-AC008 | Discounts/MSI/cash | Monetary schema/validation | APPROVED |
| R006 | SPEC-030/031 | Buyer/Payment/Registration/Ticket/Participant/TeamMember | Buyer/payer/access-holder separation | TX-1-3 | Unauthorized inferred identity control | AC001-AC002, AC009, AC014 | Buyer distinct/fields | Explicit role associations | APPROVED |
| R007 | SPEC-001/031 | Payment/Webhook/Idempotency | Receipt != verification; one effect | TX-2 | Duplicate/out-of-order | AC008, AC013 | Retry storage | Payment processing | APPROVED |
| R008-R010 | SPEC-001/030/031 | Registration/Ticket/Credential/Capacity/Audit | Member registrations, complete ticket sets, capacity/service boundary | All | Missing team ticket/duplicate/oversale/anonymous write | AC005-AC006, AC009, AC011, AC014-AC015, AC018 | Three-day/access | Entitlement/security | APPROVED |
| R011-R032 | SALE-3 SPEC-032 entity decisions | Appendix A entities | Responsibility separation | TX-1-4 | Missing/merged responsibility | AC001-AC002, AC007-AC010, AC012-AC016 | Exact fields/medical/retention | Minimal schema model | APPROVED |
| R033 | SALE-3 SPEC-032; parent contracts | All related | Cardinality/forbidden states | TX-1-4 | Orphan/overflow/mismatch | AC002 | Duplicate registration policy | Constraints/FKs | APPROVED |
| R034 | SPEC-030 | Product/Hold/Registration/Team | Capacity unit by journey | TX-1/TX-2 | Participant multiplier/oversale | AC005, AC011 | Multi-unit | Capacity constraints | APPROVED |
| R035 | SPEC-030/031 | Product/Item/Order/Payment | Money snapshot/history | TX-1/TX-2 | Stale/duplicate charge | AC004, AC007-AC008 | Promotions | Money constraints | APPROVED |
| R036 | SPEC-030/031 | Stateful entities | Authorized transitions | TX-1-4 | Invalid transition | AC006, AC010, AC012 | Refund/substitution policies | State constraints/services | APPROVED |
| R037 | SPEC-031 | Order/Item/Hold/Outbox | Durable-before-provider | TX-1 | Timeout/lost preference | AC007, AC015 | Hold failure policy | Checkout transaction | APPROVED |
| R038 | SPEC-001/031 | Webhook/PaymentVerification/Payment/Order/Hold/Ticket | Signature then receipt; durable verification before atomic effects | TX-2 | Invalid/duplicate/mismatch/audit rollback | AC008, AC015 | Async mechanism | Webhook transaction/inbox | APPROVED |
| R039 | SPEC-030/031 | Invitation/Member/Registration/Participant/Waiver/Ticket | One-use exchange, personal completion, complete team ticket set | TX-3 | Replay/duplicate/delegated waiver/missing team ticket | AC005, AC009, AC015 | Invitation duration/fields | Roster transaction | APPROVED |
| R040 | SPEC-030/031 | TeamMember/Invitation/Ticket | Preserve history/payment | TX-4 | Stale access/lost history | AC010, AC015 | Substitution policy/deadline | Substitution transaction | APPROVED |
| R041-R042 | SPEC-030/031 | Hold/Order/Payment | One last hold; late review | TX-1/TX-2 | Concurrent/late payment | AC011-AC012 | Hold duration/recovery | Concurrency/reconciliation | APPROVED |
| R043 | SPEC-031/SALE-3 | Identity-generating entities | Cross-generation token and namespace uniqueness | All | Duplicate/reused identity | AC002, AC008-AC009, AC013 | Idempotency TTL/folio format | Unique constraints/indexes | APPROVED |
| R044-R045 | SPEC-001/031 | Access/data entities | Least privilege/classification | All | Data/authority exposure | AC014, AC018 | Fields/retention | RLS/service design later | APPROVED |
| R046-R047 | SPEC-001/031 | Ticket/Credential/Entitlement/Verification/Audit/Outbox | Opaque generation/daily use/durable staged evidence | TX-1-4 | Token/audit/delivery/domain-rollback failure | AC008, AC014-AC015 | Folio/email/three-day | Entitlement/audit/outbox | APPROVED |
| R048 | SPEC-030/seed | EventDay/Product | Seed parity before execution | Future IMPL-1/5 | Wrong count/label/comment | AC003, AC016 | Saturday label | Seed correction | APPROVED |
| R049 | SPEC-000/030/031 | Decisions | No hidden default/MODEL_BLOCKER | Planning | Open choice treated approved | AC017 | Appendix K | Governance gate | APPROVED |
| R050 | SPEC-030/031 | Product/Journey relations | Shared model for 28/J1-J5 | All | Product-specific structures | AC003, AC005 | None | Config-driven schema | APPROVED |
| R051 | SALE-3 SPEC-032 | Implementation plan | Separate gates/non-authorization | IMPL-1-12 | Premature execution | AC017 | All applicable | Delivery roadmap | APPROVED |
| R052 | SALE-3 SPEC-032 protection | Documentation only | No external/runtime mutation | None | Protected modification | AC018 | None | No implementation | APPROVED |
| R053 | SPEC-031 R014/R017/R037/R046 | Access/capability/webhook/audit boundaries | Named abuse/rate/enumeration/size/concurrency profiles | TX-1-4 | Enumeration, flooding, retry/polling abuse | AC014 | API-OD-004/005 | Rate/abuse controls in IMPL-4/7-11 | APPROVED |
| R054 | SALE-3 SPEC-032; SPEC-031 R047 | TicketCredentialGeneration | Immutable generation, one active, global hash uniqueness | TX-2-4 | Reuse/stale QR/multi-day exhaustion | AC001-AC002, AC005, AC009-AC010, AC013-AC014 | OD-019/020; API-OD-004/010 | Credential schema/service | APPROVED |
| R055 | SALE-3 SPEC-032; SPEC-031 R022-R025/R049 | PaymentVerificationRecord | Durable verification before atomic effects/audit/outbox | TX-2 | Lost provider truth or partial domain effect | AC001-AC002, AC008, AC015 | API-OD-005/006/007 | Verification inbox/reconciliation | APPROVED |

## Appendix K - Open decisions

| Source | Decision | Source status | Classification here | Model impact | Blocks model | Blocks implementation | Blocks production | Responsible |
|---|---|---|---|---|---|---|---|---|
| SPEC-030 OD-001 | Multiple units | OPEN | IMPLEMENTATION_BLOCKER | OrderItem quantity already supports it | No | Yes for multi-unit | Yes if enabled | Project Owner |
| OD-002 | Mixed cart | OPEN | IMPLEMENTATION_BLOCKER | Order has N items | No | Yes for cart | No if disabled | Project Owner |
| OD-003 | Buyer different participant | OPEN | IMPLEMENTATION_BLOCKER | Optional buyer-participant relation | No | Yes for path | No if disabled | Project Owner |
| OD-004 | Exact fields by journey | OPEN | IMPLEMENTATION_BLOCKER | Extensible minimum fields/profile | No | Yes | Yes | Project Owner |
| OD-005 | Waiver content/version | OPEN | PRODUCTION_BLOCKER | Versioned document model ready | No | No for model | Yes | Owner/Legal |
| OD-006 | Minors | OPEN | PRODUCTION_BLOCKER | Guardian relation extension possible | No | Yes for minors | Yes | Owner/Legal |
| OD-007 | Refund policy | OPEN | PRODUCTION_BLOCKER | Corrective states modeled | No | No for base | Yes | Project Owner |
| OD-008 | Substitution policy | OPEN | IMPLEMENTATION_BLOCKER | TX-4 gated, history supported | No | Yes | Yes if enabled | Project Owner |
| OD-009 | Roster-change deadline | OPEN | PRODUCTION_BLOCKER | Deadline remains policy/configuration; history supported | No | No for base roster | Yes | Project Owner |
| OD-010 | Hold duration/late policy | OPEN | IMPLEMENTATION_BLOCKER | Configurable expiry/review modeled | No | Yes | Yes | Project Owner |
| OD-011 | Invitation duration | OPEN | IMPLEMENTATION_BLOCKER | Configurable expiry modeled | No | Yes | Yes | Project Owner |
| OD-012/013 | Discounts/coupons | OPEN | NON_BLOCKING | No modifier entity required for launch; extension possible | No | No if disabled | No | Project Owner |
| OD-014 | MSI | OPEN | PRODUCTION_BLOCKER | Payment remains provider-agnostic | No | No base | Yes for MSI | Project Owner |
| OD-015 | Cash | OPEN | PRODUCTION_BLOCKER | Alternate payment extension possible | No | Yes for cash | Yes | Project Owner |
| OD-016 | Return domain and URLs | OPEN | IMPLEMENTATION_BLOCKER | No persisted business authority; checkout configuration only | No | Yes | Yes | Project Owner |
| OD-017 | Email provider | OPEN | IMPLEMENTATION_BLOCKER | Outbox provider-neutral | No | Yes delivery | Yes | Project Owner |
| OD-018 | Support/escalation | OPEN | PRODUCTION_BLOCKER | Named operator recovery modeled | No | No model | Yes | Project Owner |
| OD-019 | Folio format | OPEN | IMPLEMENTATION_BLOCKER | Opaque unique public folio responsibility | No | Yes | Yes | Project Owner |
| OD-020 | Three-day mechanics | PROPOSED | IMPLEMENTATION_BLOCKER | Ticket->entitlements supports proposal | No | Yes | Yes | Project Owner |
| OD-021 | Photographer requirements | OPEN | IMPLEMENTATION_BLOCKER | Registration/profile extension | No | Yes | Yes | Project Owner |
| OD-022 | Saturday label | OPEN | PRODUCTION_BLOCKER | SEED-003 blocks seed execution | No | No schema | Yes | Project Owner |
| OD-023 | Sales opening | OPEN | PRODUCTION_BLOCKER | Event sales window fields | No | No model | Yes | Project Owner |
| OD-024 | Low availability threshold | OPEN | IMPLEMENTATION_BLOCKER | Derived/configurable projection | No | Yes signal | No if disabled | Project Owner |
| SPEC-031 API-OD-001 | Final endpoint names and transport layout | OPEN | IMPLEMENTATION_BLOCKER | No logical entity impact; service boundaries remain conceptual | No | Yes routing | No for model | Engineering |
| API-OD-002 | Exact HTTP statuses where recommendations remain | OPEN | IMPLEMENTATION_BLOCKER | No state-machine impact; error contract remains SPEC-031 authority | No | Yes client handling | No for model | Engineering |
| SPEC-031 API-OD-003 | Idempotency TTL/storage | OPEN | IMPLEMENTATION_BLOCKER | Configurable expiry, logical entity | No | Yes | Yes | Project Owner/Engineering |
| API-OD-004 | Capability lifetime/transport | OPEN | IMPLEMENTATION_BLOCKER | Capability entity supports generations | No | Yes | Yes | Project Owner/Engineering |
| API-OD-005 | Correlation ID format and telemetry backend | OPEN | IMPLEMENTATION_BLOCKER | ActivityLog remains backend-neutral | No | Yes | No for documentary model | Project Owner/Engineering |
| API-OD-007 | Retention, deletion, and anonymization | OPEN | PRODUCTION_BLOCKER | Classification/minimization ready | No | Yes configuration | Yes | Project Owner |
| API-OD-006 | Async webhook mechanism | OPEN | IMPLEMENTATION_BLOCKER | Webhook/outbox model neutral | No | Yes | Yes | Engineering |
| API-OD-008 | Invite rotate/reuse | OPEN | IMPLEMENTATION_BLOCKER | Historical generations supported | No | Yes | Yes | Project Owner |
| API-OD-009 | Hold after provider failure | OPEN | IMPLEMENTATION_BLOCKER | Named states/compensation supported | No | Yes | Yes | Project Owner |
| API-OD-010 | Buyer access to others' tickets | OPEN | IMPLEMENTATION_BLOCKER | Authorization relation remains policy-gated | No | Yes | Yes | Project Owner |

```text
MODEL_BLOCKER: none
```

## Appendix L - Validation evidence

```text
Phase B baseline: 4e85409 (SPEC-031 approval)
Seed baseline hash: 20d73e626981604da65e1ea34dc1a03b37f0845f
Seed current hash: 20d73e626981604da65e1ea34dc1a03b37f0845f
Allowed changed paths:
docs/specs/SPEC-032-MINIMAL-SALES-DATA-MODEL-AND-TRANSACTION-INTEGRITY.md
docs/specs/README.md
WORKSPACE_STATUS.md
InsForge READ_ONLY observation: section 3
Protected-path comparison: PROTECTED_PATHS_UNCHANGED
```

SALE-3 used only InsForge `get-backend-metadata` and `list-buckets` read
operations. The observed state was 0 tables, 0 functions, 0 Realtime channels,
preserved `landings-images`, and preserved deployment slug `enforma`. No
InsForge mutation tool, SQL, deployment write, Mercado Pago tool, payment,
secret read, seed execution, formatter, codemod, or landing command was used.

Document inventory checks:

```text
Logical entities: 24
Requirements: SPEC-032-R001 through SPEC-032-R055 (55)
Acceptance criteria: SPEC-032-AC001 through SPEC-032-AC018 (18)
Catalog identity: 13 COMPITE + 7 EXPERIENCE + 8 ASISTE = 28 unique codes
Implementation units: IMPL-1 through IMPL-12 (12)
Open MODEL_BLOCKER: 0
Documentary AC results: 18 PASS
Runtime AC results: 18 NOT_RUN
Formal review result: READY_FOR_APPROVAL
```

Formal documentary review against SPEC-000, SPEC-001, SPEC-011, SPEC-030,
SPEC-031, the 28-product catalog, journeys, privacy, payments, capacity,
concurrency, idempotency, tickets, seed, open decisions, requirements, AC,
traceability, implementability, and landing isolation found 0 blockers and
0 major findings after remediation. SPEC-032 was subsequently approved
explicitly by the Project Owner on 2026-07-24. Approval authorizes
implementation planning and gated unit authorization; it does not by itself
authorize seed correction, SQL, InsForge mutation, Mercado Pago runtime,
landing changes, or F0-E execution.

## Appendix M - Change log

| Version | Date | Status | Actor | Reason |
|---|---|---|---|---|
| 0.1.0 | 2026-07-24 | DRAFT | Cursor, authorized by Project Owner | Define minimum logical sales entities, transactional integrity, concurrency, idempotency, privacy, seed reconciliation, and gated implementation preparation without SQL or external changes. |
| 0.1.0 | 2026-07-24 | DRAFT | Cursor, authorized by Project Owner | Formal documentary review completed `READY_FOR_APPROVAL`: 0 blockers, 0 major findings after remediation; 18 documentary AC PASS; runtime AC remain `NOT_RUN`; SPEC-032 remains unapproved and has no implementation authority. |
| 0.1.0 | 2026-07-24 | IN_REVIEW | Project Owner | Accepted the formal review record: `READY_FOR_APPROVAL`, 0 blockers. |
| 0.1.0 | 2026-07-24 | APPROVED | Project Owner | Approved explicitly by the Project Owner; no normative requirement changed. |

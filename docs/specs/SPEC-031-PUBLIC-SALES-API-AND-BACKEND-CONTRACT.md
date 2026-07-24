---
id: SPEC-031
title: Public Sales API and Backend Contract
status: DRAFT
version: 0.1.0
phase: SALE-2
created_at: 2026-07-23
approved_at:
approved_by:
supersedes:
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-030 v0.1.0
compatible_with:
  - SPEC-011 v0.1.0
---

# SPEC-031 - Public Sales API and Backend Contract

## 1. Purpose

Define a stable, implementation-ready conceptual contract between any public
landing client and the canonical Ready2Hybrid backend for catalog discovery,
checkout, public order state, teams, invitations, tickets, payment
verification, capacity, errors, authorization, privacy, and audit.

The contract supports the 28 products and five reusable journeys approved by
SPEC-030 while remaining independent of visual design, React components,
physical database schema, final table names, exact Edge Function boundaries,
and the email provider.

## 2. Authority

Normative dependencies:

1. Explicit SALE-2 Project Owner authorization dated 2026-07-23.
2. `docs/specs/SPEC-000-GOVERNANCE.md` v0.2.0 `APPROVED`.
3. `docs/specs/SPEC-001-SYSTEM-ARCHITECTURE.md` v0.1.0 `APPROVED`.
4. `docs/specs/SPEC-030-PUBLIC-SALES-CATALOG-AND-REGISTRATION-JOURNEYS.md`
   v0.1.0 `APPROVED`.

Compatibility dependency:

5. `docs/specs/SPEC-011-PWA-FOUNDATION.md` v0.1.0 `APPROVED`.

SPEC-030 remains authority for the catalog, commercial values, journey
outcomes, ticket quantities, product composition, and open product decisions.
This specification references those decisions and defines interfaces around
them; it does not duplicate or alter the approved catalog.

## 3. Context

The landing may change its layout, components, copy, and visual flow without
changing this contract. It is one possible client of protected backend
operations.

The backend must support:

```text
28 configured products
J1 Individual competitor
J2 Doubles team
J3 Relay team
J4 Workout Experience
J5 Spectator and photographer
```

The backend must not create one API family per product code. Product
configuration selects one of the five journeys and supplies authoritative
commercial behavior.

## 4. Scope

This specification covers:

- public read contracts for event, catalog, product, order, team, and tickets;
- protected public commands for checkout, invitation completion/resend, and
  substitution;
- protected internal payment, registration, roster, ticket, communication,
  audit, and recovery operations;
- checkout and Mercado Pago notification verification boundaries;
- structured public state and error taxonomies;
- idempotency, capacity reservations, invitations, authorization, privacy, and
  observability;
- documentary request/response structures without physical schemas.

## 5. Non-goals

This specification does not define or authorize:

- visual components, forms, CSS, layout, copy, routes, images, or landing
  changes;
- SQL, migrations, table names, RLS policies, TypeScript, JSON Schema, Zod,
  Edge Function code, or exact function boundaries;
- real Mercado Pago preferences, webhooks, sandbox/production payments,
  credentials, secrets, or account configuration;
- deployments, executable tests, PWA implementation, IndexedDB, check-in,
  staff, timing, results, CRM, or an administrative panel;
- final authentication system, email provider, storage technology, retention
  implementation, or physical idempotency store;
- execution or modification of the event seed;
- resolution of decisions that remain open in SPEC-030.

## 6. Definitions

- **Landing:** An untrusted public client of backend contracts.
- **Canonical backend:** Trusted Ready2Hybrid behavior backed by InsForge,
  which is final authority for domain state.
- **Provider authority:** Mercado Pago API state after authenticated backend
  verification; redirects and browser state are not provider authority.
- **Public identifier:** An opaque, non-sequential identifier safe for an
  authorized client context.
- **Internal identifier:** A database or infrastructure identifier that is not
  exposed publicly.
- **Order access token:** A revocable opaque capability limited to the
  authorized public order context.
- **Invitation token:** A high-entropy opaque capability limited to one roster
  slot and approved actions.
- **Idempotency key:** A scoped request identifier used to return or reconcile
  one logical effect across retries.
- **Commercial snapshot:** Trusted product code, unit price, approved quantity,
  calculated total, currency, included benefits, journey, capacity unit, and
  relevant terms recorded for the order. The invariant is
  `unit price x approved quantity = snapshot total`.
- **Public state:** A deliberately simplified state safe for display; it need
  not equal an internal state name.
- **Sensitive transition:** Any payment, order, roster, eligibility, ticket,
  capacity, invitation, or administrative state change.

## 7. Invariants and requirements

### SPEC-031-R001

The landing MUST be treated as a client, not as authority for product, price,
currency, capacity, payment, ticket, folio, QR, role, or sensitive state.

### SPEC-031-R002

InsForge-backed trusted behavior MUST be canonical domain authority. Browser,
redirect, cache, and offline state MUST NOT override canonical state.

### SPEC-031-R003

Mercado Pago API state MUST be external payment authority. The backend MUST
verify that state before applying payment-dependent effects.

### SPEC-031-R004

The contract MUST support all 28 SPEC-030 products through configuration and
J1-J5. It MUST NOT define 28 product-specific endpoints or flows.

### SPEC-031-R005

Public contracts MUST use opaque identifiers, MUST NOT expose internal IDs or
secrets, and MUST remain stable when the landing design changes.

### SPEC-031-R006

The public event operation MUST return only public identity, dates, venue,
timezone, sales state, and necessary general information.

### SPEC-031-R007

The public catalog operation MUST return publicly visible configured products
with SPEC-030 presentation and availability fields, without personal,
reservation-owner, fraud, audit, or internal data.

### SPEC-031-R008

The product-detail operation MUST resolve journey, requirements, required-data
categories, roster behavior, applicable terms, and public availability without
inventing values that remain open.

### SPEC-031-R009

Checkout initiation MUST accept only permitted buyer, participant/captain,
invitee-minimum, waiver-reference, product-code, and idempotency input. The
backend MUST independently resolve all server-authoritative fields.

### SPEC-031-R010

A successful checkout-initiation response MUST contain only an opaque tracking
identifier, initial public state, Checkout Pro destination, applicable
expiration, and minimal continuation data.

### SPEC-031-R011

Public order-state lookup MUST be read-only and MUST NOT confirm payment, emit
tickets, mutate state, or expose unauthorized buyer data.

### SPEC-031-R012

Captain team-state lookup MUST expose required slots, completion, personal
waiver status, eligibility, pending invitations, and safe blockers while
minimizing member data.

### SPEC-031-R013

Invitation acceptance MUST bind one valid token to one roster slot, permit only
the invited person's data/waiver completion, and MUST NOT transfer captain or
payment authority.

### SPEC-031-R014

Invitation resend MUST require captain or protected operator authority, rate
limiting, enumeration-safe responses, idempotency where effects repeat, and
audit evidence.

### SPEC-031-R015

Member substitution MUST verify authority and applicable policy, preserve
audit, revoke replaced access, require replacement consent/waiver, preserve
confirmed payment truth, and remain blocked where SPEC-030 policy is open.

### SPEC-031-R016

Ticket lookup MUST return only the authorized person's or access-holder's
public folio, ticket state, secure QR/link, product, validity, and public
instructions.

### SPEC-031-R017

Every public operation family OP-PUB-01 through OP-PUB-10, including
OP-PUB-07A, MUST document actor, authentication context,
preconditions, request fields, server-authoritative fields, validation,
successful response, public errors, side effects, idempotency, audit, privacy,
and rate limiting.

### SPEC-031-R018

Preference creation, webhook processing, provider payment queries, order and
registration confirmation, team creation, eligibility, ticket issuance,
ticket revocation/reissue, communications, audit, and manual recovery MUST be
protected internal operations and MUST NOT be anonymous direct writes.

### SPEC-031-R019

Checkout MUST validate configured product, journey, allowed input, applicable
acceptance, sales state, and capacity; create one internal order with a
commercial snapshot; and bind `external_reference` before redirect.

### SPEC-031-R020

Checkout retries MUST be idempotent. Provider timeout or lost response MUST
lead to safe lookup/reconciliation rather than uncontrolled duplicate orders
or preferences.

### SPEC-031-R021

If authoritative price changes before order creation, checkout MUST NOT charge
the stale browser value and MUST return `PRICE_CHANGED` or a fresh explicit
confirmation path. Exhausted or expired capacity MUST prevent silent sale.

### SPEC-031-R022

Webhook handling MUST preserve required headers, validate `x-signature`, reject
invalid signatures without effects, and avoid direct trust in notification
payload state.

### SPEC-031-R023

After valid notification authentication, the backend MUST query
`/v1/payments/{id}` and validate payment/order relation, `external_reference`,
amount, currency, and every ownership/application/account field present in the
provider response. At least one configured merchant or collector identity MUST
match; if expected ownership cannot be established, no payment-dependent
effect may be applied.

### SPEC-031-R024

Webhook processing MUST be idempotent, tolerate retries and out-of-order
events, respond quickly, separate receipt from processing, and apply each
logical domain effect effectively once.

### SPEC-031-R025

The payment contract MUST distinguish notification received, payment queried,
payment verified, and effect applied for `approved`, `pending`, `rejected`,
`cancelled`, `refunded`, and `charged_back`.

### SPEC-031-R026

J1 checkout MUST resolve one approved individual product and one participant
context and produce the SPEC-030 J1 registration/ticket outcome only after
payment and applicable waiver validation.

### SPEC-031-R027

J2 checkout MUST establish a captain and pair-priced order, support one invited
slot and incomplete paid roster, and activate two personal tickets only when
the approved eligibility conditions are complete.

### SPEC-031-R028

J3 checkout MUST establish a captain and team-priced order, support three
invited slots and incomplete paid roster, preserve the `REL-2H2M` conceptual
2H+2M rule, and activate four personal tickets only when eligible.

### SPEC-031-R029

J4 MUST produce one registered workout entitlement without inheriting chip,
insurance, or a competition waiver; other approved terms or consent MAY still
apply.

### SPEC-031-R030

J5 MUST distinguish spectator/press and single-day/three-day validity. Multiple
units and cart behavior MUST remain disabled until the corresponding SPEC-030
decisions are approved. The contract MUST nevertheless represent quantity and
produce one entitlement per approved sold unit without assuming that an order
can contain only one unit.

### SPEC-031-R031

Public failures MUST use the stable taxonomy in Appendix A.8 and MUST NOT return
raw database, Mercado Pago, stack, secret, or infrastructure messages.

### SPEC-031-R032

Public errors MUST include a safe code, safe message or display key,
correlation identifier, retry/support indication when applicable, and only
allowlisted details.

### SPEC-031-R033

Checkout, webhook, invitation-code exchange, invitation completion,
substitution, ticket issuance, effectful invitation resend, and ticket reissue
MUST have scoped idempotency contracts.

### SPEC-031-R034

Repeating an idempotency key with the same normalized payload MUST return or
reconcile the original logical result; the same key with a different payload
MUST return `CONFLICT` and create audit evidence. Key lifetime is an
implementation decision.

### SPEC-031-R035

Capacity MUST use the SPEC-030 consumption unit, expose only safe public
availability, reserve temporarily before provider checkout, confirm on valid
payment, release on expiration/failure, and serialize the last unit without
silent overselling.

### SPEC-031-R036

A payment verified after reservation release MUST preserve payment truth, MUST
NOT issue an unavailable ticket or silently oversell, and MUST enter audited
reconciliation under the open recovery policy.

### SPEC-031-R037

Invitations MUST use opaque high-entropy revocable tokens with configurable
expiration, one-slot scope, limited use, enumeration protection, rate limiting,
privacy, and audit; public URLs MUST NOT contain internal team IDs.

### SPEC-031-R038

Ticket issuance MUST require verified payment plus valid registration and an
identified participant/access; it MUST be idempotent, one per participant or
access, opaque, revocable, reissuable, auditable, and QR-safe under SPEC-030.

### SPEC-031-R039

Authorization MUST distinguish anonymous, secure order-holder, captain,
invited member, future authenticated user, operator, administrator, internal
service, and Mercado Pago contexts.

### SPEC-031-R040

Anonymous clients MAY read public event/catalog/product contracts and invoke
explicitly protected public commands, but MUST NOT write canonical tables
directly or invoke internal/administrative transitions.

### SPEC-031-R041

Every operation MUST minimize data, enforce purpose limitation, protect
medical data, and avoid sensitive data in logs/QR/URLs. Operations that collect
or mutate buyer/participant data MUST separate those identities and require
the applicable person's consent/waiver. Retention/deletion decisions remain
open.

### SPEC-031-R042

Sensitive operations MUST record actor, action, public-safe entity reference,
result, time, correlation ID, applicable idempotency key, and failure class
without recording prohibited secrets or sensitive payloads.

### SPEC-031-R043

SPEC-030 open decisions and Appendix E technical decisions MUST remain
classified. No `OPEN` or `PROPOSED` item MAY be presented as approved contract
behavior.

### SPEC-031-R044

This unit MUST NOT modify the landing, seed, code, SQL, InsForge resources,
Mercado Pago resources, secrets, deployment, or runtime configuration.

### SPEC-031-R045

Public contracts SHOULD remain compatible with future SPEC-011 offline-capable
clients while preserving server authority. Public read responses MAY be cached
only under explicit freshness rules; protected order, team, invitation, and
capability, and ticket responses MUST use a conceptual private `no-store`
policy and MUST be excluded from service-worker/runtime caches by default.
Offline state MUST NOT confirm payment, capacity, eligibility, or ticket
validity. This unit MUST NOT require PWA implementation.

### SPEC-031-R046

Every protected internal operation MUST identify its authorized actor/service,
authentication context, preconditions/input, canonical validation/effect,
errors/recovery, idempotency, audit, privacy, and abuse/rate boundary.

### SPEC-031-R047

The backend MUST create, scope, deliver, revoke, and rotate opaque order,
captain, invited-member, and ticket-access capabilities sufficient to invoke
the authorized continuation operations. Capability transport and lifetime
remain implementation decisions, but no capability may silently expand actor
authority.

### SPEC-031-R048

Reservation and order-snapshot creation MUST be atomic or compensatable before
provider preference creation. The provider preference amount and currency MUST
exactly equal the trusted snapshot total and currency, where
`trusted unit price x approved quantity = snapshot total`, with no separate
chip or insurance surcharge. Partial failure MUST leave a named recoverable
state and MUST NOT create an uncontrolled payable preference.

### SPEC-031-R049

Protected manual recovery MUST use named, allowlisted business commands rather
than a generic state mutation. Each command MUST validate current state,
authority, reason category, allowed transition, idempotency, and audit.

## 8. Functional requirements

### 8.1 Public operation contract template

The following fields are mandatory for each operation:

| Contract field | Meaning |
|---|---|
| Actor | Party allowed to invoke the operation |
| Authentication context | Anonymous, order token, captain token, invitation token, user session, or protected service |
| Preconditions | Canonical conditions before evaluation |
| Request fields | Client-provided conceptual categories |
| Server-authoritative fields | Values never accepted as client authority |
| Validation | Input, auth, state, privacy, and domain checks |
| Successful response | Minimum public result |
| Public errors | Stable codes from Appendix A.8 |
| Side effects | Canonical effects or explicit none |
| Idempotency | Required scope or not applicable |
| Audit | Evidence produced |
| Privacy | Data minimization and exclusions |
| Rate limiting | Public abuse boundary |

No field name in this section fixes a physical JSON, TypeScript, Zod, SQL, or
endpoint implementation.

## 9. Non-functional requirements

- Public contracts remain stable across landing redesigns.
- Canonical state is deterministic and server-authoritative.
- Sensitive effects are idempotent, auditable, and recoverable.
- Public responses are minimal, structured, and safe for different frontend
  implementations.
- Protected responses are not stored in shared caches.
- Provider and communication failures do not corrupt verified payment truth.
- No runtime technology beyond approved architecture is selected here.

## 10. Interfaces and contracts

Detailed public, internal, checkout, webhook, state, idempotency, capacity,
error, invitation, and ticket contracts are normative in Appendix A.

## 11. Failure modes and recovery

Appendix D is the persistent failure inventory. Every listed failure resolves
to a safe public state/error, a protected recovery path, or an explicitly
blocked open decision without inventing payment, capacity, roster, or ticket
truth.

## 12. Security and privacy

Appendix B defines authentication, authorization, capability, minimization,
consent, medical-data, URL, QR, cache, secret, and log boundaries. Appendix C
defines the corresponding audit evidence.

## 13. Acceptance criteria

Appendix F contains SPEC-031-AC001 through SPEC-031-AC016. Each criterion has
precondition, artifact/input, action, expected result, evidence, mapped
requirements, binary result rule, and result.

## 14. Validation plan

Appendix H defines documentary review, coverage, source parity, protected-path,
seed-identity, and controlled-operation evidence.

## 15. Traceability

Appendix G maps every requirement to source authority, journey, operation,
failure, acceptance criteria, open decision, and implementation impact while
keeping SPEC-031 itself `DRAFT`.

## 16. Open decisions

Appendix E preserves SPEC-030 OD-001 through OD-024 and classifies the
additional API-OD decisions. No open or proposed decision is implementation
authority.

## 17. Change log

Appendix I contains the versioned actor/reason history for this draft.

## Appendix A - Detailed interfaces and contracts

The ten public operation families below are conceptual contracts, not physical
endpoint names. Invitation acceptance contains an explicit one-time-code
exchange sub-operation, OP-PUB-07A, before OP-PUB-07 completion.

Every public operation may return `INTERNAL_ERROR` with correlation-only safe
detail and every rate-limited public operation may return `RATE_LIMITED`,
whether or not those cross-cutting codes are repeated in its operation row.

### OP-PUB-01 - Consult public event

| Contract field | Conceptual contract |
|---|---|
| Actor | Any public client |
| Authentication context | Anonymous |
| Preconditions | Event is publicly discoverable |
| Request fields | Public event code or canonical public route context |
| Server-authoritative fields | Identity, dates, venue, timezone, sales state |
| Validation | Event exists and is public |
| Successful response | Public identity, dates, venue, timezone, sales state, general information |
| Public errors | `INVALID_REQUEST`, `EVENT_NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR` |
| Side effects | None |
| Idempotency | Not applicable; read-only |
| Audit | Aggregate request telemetry only when permitted |
| Privacy | No participant, audit, configuration, secret, or internal ID |
| Rate limiting | Public read limit and abuse protection |

### OP-PUB-02 - Consult catalog

| Contract field | Conceptual contract |
|---|---|
| Actor | Any public client |
| Authentication context | Anonymous |
| Preconditions | Public event exists |
| Request fields | Public event code; optional allowlisted public filters |
| Server-authoritative fields | Visible products, journey, price, currency, capacity-derived availability, sale state |
| Validation | Filters allowlisted; visibility resolved by backend |
| Successful response | 28 products or publicly visible subset with SPEC-030 presentation fields |
| Public errors | `INVALID_REQUEST`, `EVENT_NOT_FOUND`, `PRODUCT_NOT_AVAILABLE`, `RATE_LIMITED`, `INTERNAL_ERROR` |
| Side effects | None |
| Idempotency | Not applicable; read-only |
| Audit | Sanitized access telemetry |
| Privacy | No buyer reservations, fraud rules, people, or internal IDs |
| Rate limiting | Public read limit and cache-safe controls |

### OP-PUB-03 - Consult product detail

| Contract field | Conceptual contract |
|---|---|
| Actor | Any public client |
| Authentication context | Anonymous |
| Preconditions | Product code is public and belongs to event |
| Request fields | Public product code |
| Server-authoritative fields | Journey, requirements, required-data categories, roster behavior, terms version, availability |
| Validation | Product exists, visible, and configured |
| Successful response | Public product detail sufficient to begin its journey |
| Public errors | `PRODUCT_NOT_FOUND`, `PRODUCT_NOT_AVAILABLE`, `SALES_NOT_OPEN`, `SALES_CLOSED`, `RATE_LIMITED` |
| Side effects | None |
| Idempotency | Not applicable; read-only |
| Audit | Sanitized product access telemetry |
| Privacy | No reservations, internal rules, or personal data |
| Rate limiting | Public read limit |

### OP-PUB-04 - Initiate checkout

| Contract field | Conceptual contract |
|---|---|
| Actor | Buyer; captain for J2/J3 |
| Authentication context | Anonymous protected invocation with validated input, idempotency, rate limiting, and no direct data access; optional future authorized user session |
| Preconditions | Product exists, sales allow checkout, capacity available, journey input permitted |
| Request fields | Product code; requested quantity (absent means `1`, and only `1` is accepted while OD-001 remains open); permitted buyer data; participant/captain data; minimum invitee data; server-recognized waiver version/acceptance; public idempotency key |
| Server-authoritative fields | Product, journey, price, currency, discount authority, capacity, order state, folio, payment state, tickets, QR, roles |
| Validation | Input shape/categories, product/journey compatibility, applicable acceptance, price snapshot, sale state, capacity, idempotency |
| Successful response | Opaque tracking ID, scoped order capability, J2/J3 captain capability when applicable, initial public order state, Checkout Pro destination, applicable expiration, minimal continuation data |
| Public errors | `INVALID_REQUEST`, `PRODUCT_NOT_FOUND`, `PRODUCT_NOT_AVAILABLE`, `SALES_NOT_OPEN`, `SALES_CLOSED`, `SOLD_OUT`, `PRICE_CHANGED`, `WAIVER_REQUIRED`, `CHECKOUT_CREATION_FAILED`, `CONFLICT`, `RATE_LIMITED` |
| Side effects | Capacity reservation, internal order/snapshot, order/captain capability issuance, protected provider preference attempt, team shell for approved team orchestration |
| Idempotency | Required; buyer/public-command scope |
| Audit | Checkout attempt, product, result, correlation ID, idempotency evidence |
| Privacy | Store/return minimum approved data; no provider/internal errors |
| Rate limiting | Required by actor, product, network risk, and idempotency scope |

### OP-PUB-05 - Consult public order state

| Contract field | Conceptual contract |
|---|---|
| Actor | Authorized buyer/order holder |
| Authentication context | Opaque order access token or authorized future user session |
| Preconditions | Order exists and token is valid for that order |
| Request fields | Opaque tracking context |
| Server-authoritative fields | Public order/payment projection, next safe action, ticket readiness |
| Validation | Token scope, order visibility, response minimization |
| Successful response | Public state, safe summary, next action, recoverable ticket link when authorized |
| Public errors | `ORDER_NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED` |
| Side effects | None; lookup cannot confirm payment or issue tickets |
| Idempotency | Not applicable; read-only |
| Audit | Sensitive lookup result and correlation ID |
| Privacy | Only buyer-authorized projection; no internal/provider IDs |
| Rate limiting | Required to prevent enumeration and polling abuse |

Public order states:

```text
CREATING
AWAITING_PAYMENT
CONFIRMING
APPROVED
PENDING
REJECTED
CANCELLED
EXPIRED
REQUIRES_ACTION
REFUNDED
CHARGED_BACK
```

`APPROVED` means the trusted backend verified the approved payment outcome; it
does not imply team eligibility when roster/waiver work remains. Refund or
chargeback projects explicitly as `REFUNDED` or `CHARGED_BACK`; any unresolved
business consequence additionally exposes a safe `requires_action` indicator.
`CANCELLED` includes an allowlisted safe category
`ORDER_CANCELLED`, `PAYMENT_CANCELLED`, or `PRODUCT_CANCELLED` without raw
provider/internal reasons.

### OP-PUB-06 - Consult team state

| Contract field | Conceptual contract |
|---|---|
| Actor | Captain; protected operator |
| Authentication context | Captain/team capability, authorized session, or protected operator context |
| Preconditions | Team belongs to a J2/J3 order and actor has authority |
| Request fields | Opaque team/order context |
| Server-authoritative fields | Payment projection, slot count, completion, waiver status, eligibility, invitation state, safe blockers |
| Validation | Actor/team scope and field-level privacy |
| Successful response | Minimum roster progress and next allowed captain actions |
| Public errors | `TEAM_NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED` |
| Side effects | None |
| Idempotency | Not applicable; read-only |
| Audit | Captain/operator lookup and result |
| Privacy | No medical data; member details limited to roster coordination need |
| Rate limiting | Required for public captain context |

### OP-PUB-07A - Exchange one-time invitation code

| Contract field | Conceptual contract |
|---|---|
| Actor | Invited member opening an authorized invitation route |
| Authentication context | Short-lived one-time exchange code; no roster authority before successful exchange |
| Preconditions | Code exists, unexpired, unrevoked, unconsumed, and bound to one invitation/slot |
| Request fields | One-time code and public idempotency key |
| Server-authoritative fields | Invitation, team, slot, expiry, consumption state, capability scope |
| Validation | High-entropy code, atomic unused-to-consumed transition, slot/invitation validity, replay and rate checks |
| Successful response | Short-lived scoped invitation capability plus minimum safe event/product/captain context |
| Public errors | `INVITATION_INVALID`, `INVITATION_EXPIRED`, `ROSTER_COMPLETE`, `CONFLICT`, `RATE_LIMITED` |
| Side effects | Atomically consume one-time code and mint one invitation capability; no roster completion |
| Idempotency | Required; same code/key returns the same exchange result, while replay under another key fails safely |
| Audit | Code fingerprint, invitation/slot-safe reference, result, replay class, correlation ID |
| Privacy | No raw code/capability in logs, referrers, analytics, or unrelated responses |
| Rate limiting | Strict per code fingerprint, invitation, network risk, and time window |

### OP-PUB-07 - Accept invitation

| Contract field | Conceptual contract |
|---|---|
| Actor | Invited member |
| Authentication context | Scoped invitation capability produced by OP-PUB-07A; optional authorized future user session bound to the same slot |
| Preconditions | Capability valid, unrevoked, unexpired, and slot available |
| Request fields | Capability context; invited member data categories; recognized waiver version and personal acceptance; public idempotency key |
| Server-authoritative fields | Event, team, captain public identity, product, slot, price/order/payment, role authority |
| Validation | Token/slot scope, duplicate identity, existing registration, eligibility, consent, idempotency |
| Successful response | Safe team/product context, confirmed membership progress, scoped invited-member continuation capability or authorized session binding, own next action |
| Public errors | `INVITATION_INVALID`, `INVITATION_EXPIRED`, `ROSTER_COMPLETE`, `MEMBER_ALREADY_REGISTERED`, `MEMBER_NOT_ELIGIBLE`, `WAIVER_REQUIRED`, `CONFLICT`, `RATE_LIMITED` |
| Side effects | Complete one member slot; update roster/eligibility projection; ticket remains governed by eligibility |
| Idempotency | Required for completion |
| Audit | Token-safe reference, member action, result, correlation |
| Privacy | Invitee sees only necessary event/team/captain/product data |
| Rate limiting | Required per token/network risk |

### OP-PUB-08 - Resend invitation

| Contract field | Conceptual contract |
|---|---|
| Actor | Captain; authorized operator |
| Authentication context | Captain capability/session or protected operator context |
| Preconditions | Team/slot exists; resend permitted; destination category approved |
| Request fields | Opaque team/slot context; permitted destination data; public idempotency key |
| Server-authoritative fields | Token, expiry, resend limits, delivery/audit state |
| Validation | Authority, slot, policy, rate, enumeration resistance |
| Successful response | Generic accepted/limited result without destination disclosure |
| Public errors | `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `ROSTER_COMPLETE`, `CONFLICT` |
| Side effects | Reuse or rotate invitation under approved policy; communication queued |
| Idempotency | Required when repeat would create additional delivery/token effects |
| Audit | Actor, slot-safe reference, result, delivery request |
| Privacy | Response cannot confirm unrelated member or destination existence |
| Rate limiting | Strict per actor, team, slot, destination, and network risk |

### OP-PUB-09 - Substitute member

| Contract field | Conceptual contract |
|---|---|
| Actor | Captain or authorized operator under approved policy |
| Authentication context | Captain capability/session or protected operator context |
| Preconditions | Substitution policy approved and currently allows change |
| Request fields | Opaque team/slot context; minimum replacement invite data; idempotency key |
| Server-authoritative fields | Policy, deadline, payment, prior ticket, eligibility, token, audit |
| Validation | Authority, policy/deadline, slot, replacement conflict, roster composition |
| Successful response | Safe substitution-pending result and replacement invitation state |
| Public errors | `SUBSTITUTION_NOT_ALLOWED`, `FORBIDDEN`, `ROSTER_COMPLETE`, `MEMBER_ALREADY_REGISTERED`, `MEMBER_NOT_ELIGIBLE`, `CONFLICT`, `RATE_LIMITED` |
| Side effects | Revoke prior invitation/ticket as applicable; create replacement path; preserve payment |
| Idempotency | Required |
| Audit | Before/after member-safe references, actor, reason category, ticket effects |
| Privacy | No prior member sensitive data in response or new URL |
| Rate limiting | Required |

### OP-PUB-10 - Consult tickets

| Contract field | Conceptual contract |
|---|---|
| Actor | Authorized participant/access holder; buyer only after API-OD-010 is resolved to grant access; operator |
| Authentication context | Scoped participant/ticket capability, authorized session, buyer order capability only under approved API-OD-010 policy, or protected operator context |
| Preconditions | Verified payment and applicable registration/eligibility produced an entitlement |
| Request fields | Opaque authorized context |
| Server-authoritative fields | Ticket ownership, folio, state, QR/link, product, validity, revocation |
| Validation | Authority, entitlement state, privacy, revocation |
| Successful response | Own authorized ticket(s), public folio/state, secure QR/link, product, validity, instructions |
| Public errors | `TICKET_NOT_FOUND`, `TICKET_REVOKED`, `PAYMENT_PENDING`, `PAYMENT_REJECTED`, `ROSTER_INCOMPLETE`, `MEMBER_NOT_ELIGIBLE`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED` |
| Side effects | None for lookup; protected reissue is separate |
| Idempotency | Not applicable; read-only |
| Audit | Sensitive ticket retrieval |
| Privacy | No medical/financial/internal data or other person's ticket |
| Rate limiting | Required |

### Capability bootstrap and continuation

| Capability | Created/delivered | Scope | Rotation/revocation | Authorized continuation |
|---|---|---|---|---|
| Order holder | After protected order creation; returned only in checkout initiation response | One public order and allowlisted buyer reads/actions | Revoked on compromise/cancellation; rotation preserves order scope | OP-PUB-05 and policy-authorized own ticket continuation |
| Captain | With J2/J3 team shell; delivered to initiating captain | One team; captain-only roster actions | Rotatable/revocable without changing payment truth | OP-PUB-06, OP-PUB-08, and OP-PUB-09 when policy permits |
| Invited member | OP-PUB-07A atomically exchanges a one-time code for a scoped invitation capability; completion may bind an authorized future session | One participant slot and own continuation | Code consumption prevents replay; invitation use/revocation invalidates bootstrap authority; member capability may rotate | OP-PUB-07, own roster progress, and OP-PUB-10 after eligibility |
| Ticket/access holder | On entitlement issuance or secure holder binding | One holder and authorized entitlement set | Reissue revokes prior token/capability | OP-PUB-10 for own tickets |

Capabilities are generated by the backend, high entropy, opaque, least-scope,
and never derived from internal IDs. They are not forwarded through Mercado
Pago. API-OD-004 keeps final lifetime and transport open, but implementation
must deliver the initial capability over a protected response, must not place
long-lived raw capabilities in query strings or logs, and must support
revocation and rotation.

### A.1 Protected internal operations

All rows inherit least privilege, sanitized errors, protected audit, no public
secret/internal-ID exposure, and bounded service/concurrency limits.

Internal abuse/rate profiles:

| Profile | Boundary |
|---|---|
| `INT-CAPACITY` | Per product/capacity unit/order; serialized mutation and bounded retries |
| `INT-PROVIDER` | Per merchant/payment/order; bounded provider queries, retries, timeout, and circuit protection |
| `INT-DOMAIN` | Per service identity and canonical entity; conflict/concurrency limit |
| `INT-CAPABILITY` | Per actor/entity/network risk; strict mint/rotate/revoke and lookup limits |
| `INT-COMMUNICATION` | Per template/destination/entity/time window |
| `INT-AUDIT` | Per source operation/correlation; ingestion size and throughput bounds |
| `INT-OPERATOR` | Per named operator/entity/command/reason; strict human-action limit |

| Internal operation | Actor/auth | Preconditions and input | Validation and canonical effect | Error/recovery and idempotency | Audit/privacy/rate |
|---|---|---|---|---|---|
| Reserve capacity | Checkout service identity | Valid product/journey and requested SPEC-030 capacity unit | Serialize availability and create one temporary reservation | `SOLD_OUT`/conflict; logical checkout key prevents duplicate hold | Product/unit/result; no buyer reservation exposure; concurrency limit |
| Confirm capacity | Payment-effect service identity | Verified approved payment and live/reconcilable reservation | Convert one reservation to confirmed consumption | Idempotent by order/payment effect; late cases route to named reconciliation | Order-safe ref/result; no provider payload |
| Release capacity | Checkout/payment service identity | Expired/failed/cancelled reservation under policy | Release exactly one unconfirmed hold | Idempotent by reservation/release generation | Reason category/result; bounded retries |
| Create Mercado Pago preference | Checkout service with provider credential | Valid order snapshot and reservation | Send snapshot amount/currency and link `external_reference` | Same logical key reconciles existing preference; provider failure leaves named non-payable state | Provider ref fingerprint/result; no credential/raw error |
| Receive webhook | Signed Mercado Pago ingress | Preserved verification inputs | Record notification receipt only after signature decision | Duplicate receipt acknowledged idempotently; invalid signature has no effect | Signature result/event fingerprint; ingress rate/size limits |
| Query Mercado Pago payment | Payment verifier with provider credential | Valid provider payment reference from trusted ingress/reconciliation | Obtain canonical provider state | Bounded retry; no domain effect on unavailable/unverified response | Query/result metadata; no credential/full payload |
| Verify and confirm order | Payment-effect service identity | Provider response and expected order snapshot | Validate ownership/reference/amount/currency and apply allowed transition | Effect key makes transition effectively once; mismatch creates protected incident | Verification checks/result/failure class |
| Confirm registration | Registration service identity | Valid order, participant, waiver/terms state | Apply allowed registration transition | Deterministic entitlement/participant key prevents duplicate registration | Participant-safe ref/result; sensitive fields excluded |
| Create team | Team service identity | J2/J3 order and captain context | Create one fixed-slot shell and captain binding | Idempotent by order/journey; conflict cannot create second team | Team-safe ref/result |
| Complete eligibility | Team service identity | Required members and personal waivers complete | Apply eligibility transition | Idempotent state evaluation; failed rule returns named blocker | Rule categories/result; no medical details |
| Mint/rotate/revoke capabilities | Capability service identity | Authorized order/team/member/ticket context and reason | Issue least-scope capability or revoke/rotate prior generation | Deterministic generation/rotation key; compromise uses named rotation/revocation | Capability fingerprint only; strict rate and no raw token logs |
| Issue tickets | Entitlement service identity | Verified payment, registration, identity, and eligibility | Create/activate one ticket per approved entitlement | Deterministic entitlement/generation identity returns existing ticket on retry | Entitlement-safe ref/result; QR token excluded |
| Revoke tickets | Entitlement service or authorized operator | Named substitution/refund/chargeback/security reason | Revoke specified active generation | Idempotent by ticket/generation/reason category | Before/after state and actor; no QR token |
| Reissue tickets | Authorized holder flow or operator | Valid entitlement and authorized reason | Revoke old generation before activating replacement | Reissue key/generation returns same replacement on retry | Actor/reason/generation result; strict rate |
| Send communications | Communication service identity | Canonical domain event and approved destination category | Queue one allowlisted template/delivery request | Delivery idempotency key avoids uncontrolled duplicates; failure does not alter payment | Template/category/result; destination minimized; rate limits |
| Register audit | Trusted domain service | Sensitive operation evaluation | Append protected evidence within the mutation transaction or durable outbox boundary | If append/outbox persistence fails, the sensitive mutation does not commit; verified external payment truth is preserved in a durable reconciliation state and downstream effects remain blocked until audit persistence recovers; correlation/effect identity deduplicates repeats | `INT-AUDIT`; audit store excludes prohibited data |
| Reconcile late verified payment | Authorized operator plus payment service verification | Verified payment after capacity release and approved recovery policy | Apply only named refund or authorized capacity-recovery command | Idempotent incident command; no generic state assignment | Actor/reason/before-after/provider verification |
| Restore or release reservation | Authorized operator under approved capacity policy | Named incident and current reservation/capacity state | Execute one allowlisted capacity correction | Conflict if current state changed; command key prevents repetition | Actor/reason/unit/before-after |
| Correct roster membership | Authorized operator under approved roster policy | Named duplicate/identity/support incident | Execute allowlisted unlink/reinvite/substitute action only | No direct eligibility/ticket override; command idempotent | Actor/reason/member-safe refs/before-after |

Profile assignment:

```text
Reserve/confirm/release capacity                  -> INT-CAPACITY
Create preference/query payment/confirm order     -> INT-PROVIDER
Receive webhook                                  -> INT-PROVIDER + INT-AUDIT
Confirm registration/create team/eligibility     -> INT-DOMAIN
Mint/rotate/revoke capabilities                   -> INT-CAPABILITY
Issue/revoke/reissue tickets                      -> INT-DOMAIN + INT-CAPABILITY
Send communications                              -> INT-COMMUNICATION
Register audit                                   -> INT-AUDIT
Late-payment/reservation/roster recovery commands -> INT-OPERATOR
```

Each row's profile is part of its conceptual rate/abuse and privacy boundary;
the final numeric limits remain implementation configuration.

Exact grouping into Edge Functions is deferred to implementation.

### A.2 Checkout contract

Sequence:

```text
public product code
-> resolve configured product and J1-J5
-> validate allowed input and applicable acceptance
-> validate sales state and trusted capacity
-> create temporary reservation
-> create internal order and commercial snapshot
-> bind external_reference
-> create Checkout Pro preference
-> return opaque tracking state and provider destination
```

Commercial snapshot includes only trusted values needed to verify later:
product code, journey, unit semantics, unit price, approved quantity, calculated
total, currency, included benefits, terms/waiver reference when applicable,
and capacity reservation context. While OD-001 remains open, approved quantity
is `1`; the model still preserves the multiplication invariant for a future
authorized multi-unit path.

Reservation and order/snapshot creation form one atomic domain unit where the
approved implementation supports transactions; otherwise explicit
compensation must remove or expire any orphan hold and mark the order
non-payable. Provider preference creation occurs only after that unit succeeds.
The amount and currency sent to Checkout Pro equal the snapshot total and
currency exactly.
Insurance and chip are already included when declared by the product and never
appear as separate checkout surcharges.

Failure behavior:

| Condition | Required outcome |
|---|---|
| Mercado Pago unavailable before preference | Mark the order non-payable/retryable; create no destination; handle reservation only under API-OD-009 |
| Preference created but response lost | Reconcile by idempotency/order/provider reference before any new preference |
| Client retries same request/key | Return or reconcile original logical checkout |
| Same key, different normalized payload | `CONFLICT`; no second uncontrolled effect |
| Capacity exhausted before reservation | `SOLD_OUT`; no order/preference with payable authority |
| Reservation expires | `RESERVATION_EXPIRED`; no stale checkout continuation |
| Price changes before snapshot | `PRICE_CHANGED`; require fresh server value/confirmation |
| Browser sends amount/price/payment | Ignore as authority; validate allowlisted input only |

### A.3 Webhook and payment verification contract

Stages:

```text
NOTIFICATION_RECEIVED
PAYMENT_QUERIED
PAYMENT_VERIFIED
EFFECT_APPLIED
```

1. Receive notification over protected provider ingress.
2. Preserve the raw bytes or canonical inputs and required headers needed for
   signature verification without unsafe logging.
3. Validate `x-signature` according to current Mercado Pago documentation.
4. Reject invalid or unverifiable signatures with no payment/order/ticket
   effect.
5. Deduplicate notification/event receipt.
6. Respond quickly while deferring bounded safe work when architecture allows.
7. Query `/v1/payments/{id}` using backend credentials.
8. Validate every ownership/application/account field present in the provider
   response plus `external_reference`, order relation, amount, and currency.
   At least one configured merchant or collector identity must match; failure
   to establish ownership fails closed with no payment-dependent effect.
9. Apply only allowed monotonic or corrective transitions.
10. Apply each logical domain effect effectively once and record audit.

Provider-state behavior:

| Provider state | Canonical treatment |
|---|---|
| `approved` | Verify all invariants, confirm payment/order, then apply capacity/registration/ticket effects |
| `pending` | Preserve pending truth; issue no valid payment-dependent ticket |
| `rejected` | Preserve rejection; release capacity according to approved policy |
| `cancelled` | Preserve cancellation; no approved effect |
| `refunded` | Preserve refund truth; route order/ticket consequences through approved policy and audit |
| `charged_back` | Preserve chargeback truth; require protected risk/recovery handling and ticket review/revocation |

Out-of-order events never override a newer verified provider state merely
because a notification arrived later. A fresh authenticated provider query
resolves ambiguity.

### A.4 Journey behavior mapping

| Journey | Checkout context | Paid but incomplete | Complete outcome |
|---|---|---|---|
| J1 | Buyer/participant, individual product, applicable waiver | Registration pending if personal conditions incomplete | 1 registration, participant, ticket, QR |
| J2 | Captain, doubles product, minimum invitee data, captain waiver | Team created; roster may remain incomplete; no active competition tickets until eligible | 2 participants, waivers, tickets, QR; eligible |
| J3 | Captain, relay product, minimum data for 3 invitees, captain waiver | Team created; roster may remain incomplete; 2H+2M rule preserved for mixed | 4 participants, waivers, tickets, QR; eligible |
| J4 | Buyer/attendee, workout product, applicable non-competition terms | Registration may require remaining approved data | 1 registration, ticket, QR; no chip/insurance/competition waiver |
| J5 | Buyer/access holder, spectator or press, single/three-day product | Entitlement pending until valid payment/required registration | Ticket/accreditation QR with approved validity |

J5 order projections represent an item quantity and an entitlement list with
one entitlement per sold unit. Until OD-001 is approved, public checkout
accepts only quantity `1` and rejects larger quantities as unsupported; this
temporary command restriction does not make one unit a permanent order-model
assumption. Mixed-product cart input remains disabled under OD-002.

The proposed three-day model remains:

```text
1 ticket
1 opaque QR
3 daily access rights
```

It is not final implementation authority until SPEC-030 OD-020 is approved.

### A.5 Public order and team state

Allowed public order projection transitions:

```text
CREATING -> AWAITING_PAYMENT | REQUIRES_ACTION | CANCELLED
AWAITING_PAYMENT -> CONFIRMING | PENDING | EXPIRED | CANCELLED
CONFIRMING -> APPROVED | PENDING | REJECTED | REQUIRES_ACTION
PENDING -> CONFIRMING | APPROVED | REJECTED | CANCELLED | EXPIRED
APPROVED -> REFUNDED | CHARGED_BACK | REQUIRES_ACTION
```

Team projections remain separate:

```text
TEAM_PROVISIONAL_UNPAID
PAID_ROSTER_INCOMPLETE
PAID_ROSTER_COMPLETE
ELIGIBLE
```

Public projections are informational views over canonical state. Clients
cannot submit these values as transitions.

### A.6 Idempotency contract

| Operation | Key actor/source | Scope | Repeat with same payload | Different payload |
|---|---|---|---|---|
| Checkout initiation | Public client generates a high-entropy key before first attempt | Checkout namespace + key + event/product/journey + normalized payload fingerprint; no buyer account required | Return/reconcile original order and destination | `CONFLICT` |
| Webhook | Provider notification identifier plus verified payment identifier | Receipt namespace and separate payment/effect namespace | Acknowledge without duplicate effect | Security/audit conflict |
| Invitation code exchange | Invited client generates a high-entropy key; route supplies one-time code | Exchange namespace + code fingerprint + invitation/slot | Return same capability result only to the same logical exchange; replay under another key fails safely | `CONFLICT` or invitation-safe failure |
| Invitation completion | Invited client generates a high-entropy key; invitation capability supplies context | Completion namespace + capability fingerprint + roster slot + normalized payload | Return completed/current member result | `CONFLICT` |
| Substitution | Captain/operator client generates key | Substitution namespace + team/slot + normalized replacement payload | Return/reconcile original substitution | `CONFLICT` |
| Ticket issuance | Internal deterministic entitlement and issuance-generation identity | Issuance namespace + entitlement + generation | Return existing active/pending ticket | Protected conflict |
| Invitation resend | Captain/operator client generates key | Resend namespace + team/slot + destination fingerprint + resend policy window | Return accepted/current delivery result without uncontrolled duplicates | `CONFLICT` |
| Ticket reissue | Holder/operator client generates key; service binds current generation | Reissue namespace + ticket/current generation + reason category | Return same reissue result | Protected conflict |

Key expiration, normalized-payload algorithm, and storage technology are
implementation decisions. Audit evidence includes safe key fingerprint/scope,
actor, normalized-payload equivalence result, outcome, and correlation ID;
raw secrets or capability tokens are not logged.

### A.7 Capacity and reservation contract

Capacity units are inherited from SPEC-030:

```text
J1 individual: 1 registration
J2 doubles: 1 team
J3 relay: 1 team
J4 workout: 1 attendee
J5 spectator: 1 access per approved unit
J5 photographer: 1 accreditation per approved unit
```

Public availability is a safe projection and never reveals other buyers'
reservations. Checkout rechecks capacity and creates a temporary reservation
before provider redirect. Verified payment confirms the capacity effect.
Expiration or failed checkout releases it under policy.

Concurrent last-unit attempts must be serialized by trusted backend behavior.
At most one reservation receives the final unit. A late approved payment after
release preserves payment truth but issues no unavailable ticket and enters
audited reconciliation/refund or authorized capacity recovery. Reservation
duration and final late-payment policy remain open.

### A.8 Stable public error taxonomy

Recommended HTTP values guide implementation but do not define physical
framework behavior. `Retry` uses `NEVER`, `AFTER_INPUT`,
`AFTER_STATE_CHANGE`, `BACKOFF`, `SAME_KEY`, or `FRESH_ATTEMPT`. `Support`
uses `NO`, `OPTIONAL`, or `REQUIRED`. Every response uses an allowlisted safe
code/message or display key and correlation ID. Provider/database/stack
messages are never forwarded.

| Code | Meaning | Suggested HTTP | Retry | Support | Safe details |
|---|---|---:|---|---|---|
| `INVALID_REQUEST` | Input fails public contract | 400 | AFTER_INPUT | NO | Invalid field categories only |
| `EVENT_NOT_FOUND` | Public event context does not resolve | 404 | NEVER | NO | No internal event ID |
| `PRODUCT_NOT_FOUND` | Public code does not resolve | 404 | NEVER | NO | Public code |
| `PRODUCT_NOT_AVAILABLE` | Product hidden/inactive/cancelled | 409 | AFTER_STATE_CHANGE | OPTIONAL | Public product/state |
| `SALES_NOT_OPEN` | Sales have not opened | 409 | AFTER_STATE_CHANGE | NO | Public opening message/date if approved |
| `SALES_CLOSED` | Sales window closed | 409 | NEVER | OPTIONAL | Public state |
| `SOLD_OUT` | No trusted capacity | 409 | AFTER_STATE_CHANGE | NO | Public availability |
| `PRICE_CHANGED` | Trusted price differs from prior display | 409 | AFTER_INPUT | NO | New public price/currency |
| `RESERVATION_EXPIRED` | Temporary hold no longer valid | 409 | FRESH_ATTEMPT | NO | Safe expiration |
| `WAIVER_REQUIRED` | Applicable personal acceptance missing | 422 | AFTER_INPUT | NO | Required terms version/key |
| `CHECKOUT_CREATION_FAILED` | Safe provider/order initialization failed | 503 | SAME_KEY | OPTIONAL | Retry/support flags |
| `PAYMENT_PENDING` | A command is gated because verified payment is not final; normal lookup uses a success-state projection | 409 | BACKOFF | NO | Public state |
| `PAYMENT_REJECTED` | Verified provider payment rejected | 402 | FRESH_ATTEMPT | OPTIONAL | Public state; no provider raw reason |
| `ORDER_NOT_FOUND` | Authorized public order cannot be resolved | 404 | NEVER | OPTIONAL | No existence leak |
| `TEAM_NOT_FOUND` | Authorized team context cannot be resolved | 404 | NEVER | OPTIONAL | No existence leak |
| `INVITATION_INVALID` | Token invalid/revoked/wrong scope | 404 | NEVER | OPTIONAL | Generic invite state |
| `INVITATION_EXPIRED` | Token expired | 410 | AFTER_STATE_CHANGE | OPTIONAL | Generic expiry |
| `ROSTER_COMPLETE` | No roster slot available | 409 | NEVER | OPTIONAL | Safe team state |
| `ROSTER_INCOMPLETE` | Team requires member/waiver work | 409 | AFTER_STATE_CHANGE | NO | Counts, not private details |
| `MEMBER_ALREADY_REGISTERED` | Identity conflicts with existing membership | 409 | AFTER_STATE_CHANGE | REQUIRED | Generic conflict |
| `MEMBER_NOT_ELIGIBLE` | Approved eligibility rule not met | 422 | AFTER_INPUT | OPTIONAL | Allowlisted rule category |
| `SUBSTITUTION_NOT_ALLOWED` | Approved substitution policy/deadline does not permit action | 409 | AFTER_STATE_CHANGE | OPTIONAL | Safe policy category |
| `TICKET_NOT_FOUND` | Authorized ticket context does not resolve | 404 | NEVER | OPTIONAL | No existence leak |
| `TICKET_REVOKED` | Ticket exists but current generation is invalid | 410 | AFTER_STATE_CHANGE | OPTIONAL | Safe ticket state |
| `UNAUTHORIZED` | Authentication/capability absent or invalid | 401 | AFTER_INPUT | NO | None |
| `FORBIDDEN` | Authenticated actor lacks authority | 403 | NEVER | OPTIONAL | Generic action |
| `RATE_LIMITED` | Abuse threshold exceeded | 429 | BACKOFF | NO | Retry timing if safe |
| `CONFLICT` | State or idempotency payload conflicts | 409 | AFTER_STATE_CHANGE | OPTIONAL | Conflict category |
| `INTERNAL_ERROR` | Unexpected protected failure | 500 | BACKOFF | REQUIRED | Correlation ID only; commands preserve their original key when retried |

No error exposes capability tokens, internal IDs, SQL/provider payloads,
medical/financial data, fraud rules, stack traces, or secrets.

### A.9 Invitation contract

- Token is opaque, high entropy, revocable, configurable in lifetime, and
  limited to one roster slot.
- A public invitation route MAY carry a short-lived one-time exchange code,
  never a long-lived raw capability. OP-PUB-07A atomically exchanges it,
  rejects replay, and returns a scoped invitation capability. The client
  removes the code from navigable history where supported and prevents
  referrer/cache/log propagation. Final transport remains API-OD-004.
- No route contains internal team/member IDs or PII.
- Valid use reveals only event, product, safe team/captain context, and the
  invited person's required actions.
- Completion is idempotent and cannot occupy multiple slots.
- Resend token reuse versus rotation remains API-OD-008; either implementation
  revokes stale authority when appropriate and never reveals whether an
  unrelated identity exists.
- Substitution revokes the prior invitation and ticket/access as applicable
  before replacement eligibility.
- Validation, resend, and completion are rate-limited and audited without
  logging raw tokens.

### A.10 Ticket and QR contract

Emitability:

```text
verified payment
+ valid registration
+ identified participant/access
+ applicable team eligibility
-> ticket emitible
```

Each participant or approved access receives one canonical entitlement. Ticket
issuance and reissue are idempotent. A QR resolves through an opaque,
high-entropy revocable token and contains no PII, medical data, financial data,
payment state, or internal ID.

Reissue invalidates the previous token before the replacement is active.
Substitution revokes the replaced member's ticket. Refund/chargeback
consequences follow approved policy and cannot be invented by the public
client.

## Appendix B - Detailed security and privacy

### B.1 Authentication and authorization

| Context | Permitted conceptual operations |
|---|---|
| Anonymous | OP-PUB-01/02/03; protected invocation of OP-PUB-04 with validation/rate limit |
| One-time invitation code | OP-PUB-07A only; no roster/member authority before atomic exchange |
| Secure order holder | OP-PUB-05 and authorized ticket continuation |
| Captain | Own team OP-PUB-06, resend, and substitution when policy allows |
| Invited member | OP-PUB-07 and own progress/ticket context |
| Future authenticated user | Same rights after explicit identity/ownership resolution; no automatic expansion |
| Operator | Protected support/recovery within least privilege and audit |
| Administrator | Explicit administrative policy only; not defined as public API |
| Internal service | Protected internal operations with service identity |
| Mercado Pago | Signed notification ingress only; no general domain authority |

Anonymous clients never write tables directly. Order, captain, invitation, and
ticket capabilities are scoped, opaque, revocable, and rate-limited.

### B.2 Privacy

- Collect only categories required by the selected journey and approved open
  decisions.
- Use data only for stated registration, payment, access, support, safety, and
  legal purposes.
- Keep buyer and participant identities distinct.
- Require each adult's personal consent and waiver.
- Restrict medical/emergency data to authorized purpose and roles.
- Return minimum public projections.
- Sanitize logs, errors, analytics, provider evidence, and audit details.
- Put no PII, medical data, email, phone, internal ID, or raw order/invitation
  capability in public URLs or QR payloads. A ticket QR may contain only its
  approved opaque ticket token under Appendix A.10.
- Define retention, deletion, and anonymization in a later approved decision.

## Appendix C - Observability and audit

Sensitive-operation evidence:

```text
actor context
action
public-safe entity reference
result
timestamp
correlation ID
idempotency key fingerprint/scope when applicable
failure class
protected provider reference when required
```

Never record access tokens, API keys, webhook secrets, raw invitation/order/QR
capabilities, medical data, full unnecessary payloads, card data, or provider
credentials.

## Appendix D - Failure catalog

| Failure | Safe outcome |
|---|---|
| Unknown/inactive product | Structured public error; no order |
| Sales closed/not open | Structured state; no payable order |
| Stale price | Fresh server price; explicit retry/confirmation |
| Capacity lost concurrently | One winner; others `SOLD_OUT` |
| Reservation expired | No stale provider continuation; fresh checkout |
| Provider timeout | Reconcile same logical attempt |
| Preference response lost | Lookup/reconcile before recreation |
| Browser return lost | Order lookup/webhook/provider query recovers state |
| Invalid webhook signature | No effects; sanitized security audit |
| Duplicate webhook | Idempotent acknowledgement; no duplicate effects |
| Out-of-order event | Fresh provider query and allowed transition |
| Amount/currency/reference mismatch | No approval effect; protected incident |
| Late approved payment | Preserve payment; no unavailable ticket; audited recovery |
| Invitation invalid/expired | Enumeration-safe failure and authorized resend |
| Duplicate/already registered member | Conflict and protected resolution |
| Roster incomplete | Paid capacity preserved; no active competition tickets |
| Ticket duplicate/reissue retry | Return canonical result; one active token |
| Communication failure | Preserve payment/ticket; auditable resend |
| Audit append/outbox failure | Do not commit the sensitive mutation; preserve verified external payment truth in durable reconciliation and block downstream effects until audit persistence recovers |
| Manual recovery | Authorized actor, reason, before/after, audit |

## Appendix E - Imported and technical open decisions

### E.1 SPEC-030 decisions

| Source ID | Decision | Source status | Classification | Contract impact | Blocks spec | Blocks implementation | Blocks production | Responsible |
|---|---|---|---|---|---|---|---|---|
| OD-001 | Multiple spectator/press units | OPEN | IMPLEMENTATION_BLOCKER | Quantity, entitlement list, capacity | No | Yes for multi-unit | Yes if enabled | Project Owner |
| OD-002 | Mixed-product cart | OPEN | IMPLEMENTATION_BLOCKER | Order composition and checkout | No | Yes for cart | No if disabled | Project Owner |
| OD-003 | Buyer different from participant | OPEN | IMPLEMENTATION_BLOCKER | Identity, consent, ticket access | No | Yes for third-party path | No if disabled | Project Owner |
| OD-004 | Exact minimum data per journey | OPEN | IMPLEMENTATION_BLOCKER | Request fields and validation | No | Yes | Yes | Project Owner |
| OD-005 | Waiver text/version | OPEN | PRODUCTION_BLOCKER | Terms reference and eligibility | No | No for contract shell | Yes | Project Owner / Legal |
| OD-006 | Minors | OPEN | PRODUCTION_BLOCKER | Guardian auth/consent | No | Yes for minors | Yes for minors | Project Owner / Legal |
| OD-007 | Refund policy | OPEN | PRODUCTION_BLOCKER | Corrective payment/ticket state | No | No for base flow | Yes | Project Owner |
| OD-008 | Substitution policy | OPEN | IMPLEMENTATION_BLOCKER | OP-PUB-09 availability | No | Yes | Yes if enabled | Project Owner |
| OD-009 | Roster-change deadline | OPEN | PRODUCTION_BLOCKER | Substitution validation | No | No for base roster | Yes | Project Owner |
| OD-010 | Reservation duration/late-payment policy | OPEN | IMPLEMENTATION_BLOCKER | Expiry and reconciliation | No | Yes | Yes | Project Owner |
| OD-011 | Invitation duration | OPEN | IMPLEMENTATION_BLOCKER | Token expiry | No | Yes | Yes | Project Owner |
| OD-012 | Discounts | OPEN | NON_BLOCKING | Price modifiers | No | No if disabled | No if disabled | Project Owner |
| OD-013 | Coupons | OPEN | NON_BLOCKING | Promotion input | No | No if disabled | No if disabled | Project Owner |
| OD-014 | MSI | OPEN | PRODUCTION_BLOCKER | Provider configuration/disclosure | No | No for base flow | Yes for MSI | Project Owner |
| OD-015 | Cash | OPEN | PRODUCTION_BLOCKER | Alternate payment/reservation | No | Yes for cash | Yes for cash | Project Owner |
| OD-016 | Return domain/URLs | OPEN | IMPLEMENTATION_BLOCKER | Checkout destination config | No | Yes | Yes | Project Owner |
| OD-017 | Email provider | OPEN | IMPLEMENTATION_BLOCKER | Delivery implementation | No | Yes for delivery | Yes | Project Owner |
| OD-018 | Support/escalation model | OPEN | PRODUCTION_BLOCKER | Manual recovery routing | No | No for contract | Yes | Project Owner |
| OD-019 | Folio format | OPEN | IMPLEMENTATION_BLOCKER | Public ticket/order references | No | Yes | Yes | Project Owner |
| OD-020 | Three-day QR/daily/re-entry policy | PROPOSED | IMPLEMENTATION_BLOCKER | Multi-day ticket behavior | No | Yes | Yes | Project Owner |
| OD-021 | Photographer accreditation requirements | OPEN | IMPLEMENTATION_BLOCKER | J5 press input/terms | No | Yes | Yes | Project Owner |
| OD-022 | Saturday public schedule label | OPEN | PRODUCTION_BLOCKER | Public event/catalog content | No | No for API shell | Yes | Project Owner |
| OD-023 | Sales opening date/time | OPEN | PRODUCTION_BLOCKER | `SALES_NOT_OPEN` transition | No | No for API shell | Yes | Project Owner |
| OD-024 | Low-availability threshold | OPEN | IMPLEMENTATION_BLOCKER | Availability projection | No | Yes for signal | No if disabled | Project Owner |

### E.2 SPEC-031 technical decisions

| ID | Decision | Classification | Impact | Blocks spec |
|---|---|---|---|---|
| API-OD-001 | Final endpoint names and transport layout | IMPLEMENTATION_BLOCKER | Routing | No |
| API-OD-002 | Exact HTTP statuses where recommendations remain | IMPLEMENTATION_BLOCKER | Client handling | No |
| API-OD-003 | Idempotency-key lifetime/storage | IMPLEMENTATION_BLOCKER | Retry persistence | No |
| API-OD-004 | Order, captain, invited-member, and ticket-access capability lifetime and transport | IMPLEMENTATION_BLOCKER | Authorization | No |
| API-OD-005 | Correlation ID format and telemetry backend | IMPLEMENTATION_BLOCKER | Observability | No |
| API-OD-006 | Async webhook work/retry mechanism | IMPLEMENTATION_BLOCKER | Processing reliability | No |
| API-OD-007 | Retention, deletion, and anonymization policy | PRODUCTION_BLOCKER | Privacy lifecycle | No |
| API-OD-008 | Invitation resend token reuse versus rotation | IMPLEMENTATION_BLOCKER | Invitation revocation and delivery | No |
| API-OD-009 | Reservation release versus bounded preservation after provider preference failure | IMPLEMENTATION_BLOCKER | Checkout compensation | No |
| API-OD-010 | Buyer access to tickets belonging to distinct participants | IMPLEMENTATION_BLOCKER | Ticket authorization and delivery | No |

No `CONTRACT_BLOCKER` remains. These decisions gate the affected implementation
or production behavior and do not authorize defaults.

## Appendix F - Acceptance criteria

Each result is `PASS`, `FAIL`, `BLOCKED`, or `NOT_RUN`.

### SPEC-031-AC001

- **Precondition:** SPEC-030 approved catalog and this contract are available.
- **Artifact:** Sections 2, 3, 7, and 16 plus Appendix A.4/A.7.
- **Action:** Verify all 28 products resolve through configuration to J1-J5 and
  search for product-specific endpoint contracts.
- **Expected result:** Five reusable journey contracts cover 28 products; no 28
  endpoint/API families exist.
- **Evidence:** Configuration/journey traceability review.
- **Requirements:** R004, R026-R030.
- **Result rule:** `PASS` only when all 28 configured products map to exactly
  one of J1-J5 and no product-specific contract exists; `FAIL` on any missing,
  duplicate, or product-specific flow; `BLOCKED` if SPEC-030 is unavailable;
  otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC002

- **Precondition:** OP-PUB-01 through OP-PUB-10 are complete.
- **Artifact:** Section 8 and Appendix A public operation families.
- **Action:** Check every operation for all 13 contract-template fields and
  walk one success plus every mapped public failure to test semantic content.
- **Expected result:** Every operation specifies actor, auth, preconditions,
  request/server fields, validation, response, errors, side effects,
  idempotency, audit, privacy, and rate limiting.
- **Evidence:** Public-operation completeness matrix.
- **Requirements:** R006-R017.
- **Result rule:** `PASS` only when every field contains actor-specific,
  state-specific behavior sufficient to determine success/failure without
  hidden authority; `FAIL` for missing or merely nominal content; `BLOCKED` if
  an authority contract is unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC003

- **Precondition:** Public and internal operation boundaries are documented.
- **Artifact:** R001-R005 plus Appendices A and B.
- **Action:** Inspect price, capacity, payment, ticket, identifier, role, and
  secret authority for every public operation.
- **Expected result:** No frontend field controls a sensitive value; no public
  response exposes internal IDs or secrets; InsForge/provider authority is
  explicit.
- **Evidence:** Authority-boundary checklist.
- **Requirements:** R001-R005, R018, R039-R040, R046-R049.
- **Result rule:** `PASS` when every authoritative value and sensitive command
  resolves to backend/provider authority and no public exposure path remains;
  `FAIL` on client authority, internal ID, or secret exposure; `BLOCKED` if
  interfaces are incomplete; otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC004

- **Precondition:** Checkout contracts and five journeys are documented.
- **Artifact:** OP-PUB-04 and Appendices A.2/A.4.
- **Action:** Walk checkout initiation for J1-J5 plus provider timeout, lost
  response, retry, sold-out, expired-reservation, and changed-price cases.
- **Expected result:** Trusted snapshot/order/reservation precede redirect;
  retries do not create uncontrolled duplicates; all failures are structured.
- **Evidence:** Journey-checkout and failure matrix.
- **Requirements:** R009-R010, R019-R021, R026-R030, R033-R036, R047-R048.
- **Result rule:** `PASS` when every journey and listed failure produces one
  deterministic, compensatable, idempotent outcome with exact snapshot amount;
  `FAIL` on duplicate/uncontrolled preference or stale authority; `BLOCKED`
  when an imported decision prevents the base path; otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC005

- **Precondition:** Public order/team projections exist.
- **Artifact:** OP-PUB-05/06 and Appendix A.5.
- **Action:** Verify read-only behavior, state coverage, team counts, waiver
  progress, eligibility, privacy, and no client transition authority.
- **Expected result:** Public states are safe projections; J2 supports 2 slots
  and J3 supports 4; lookup cannot confirm payment or activate tickets.
- **Evidence:** Public-state transition and role matrix.
- **Requirements:** R011-R012, R027-R028, R039-R041.
- **Result rule:** `PASS` when all order, corrective, provisional, paid roster,
  and eligibility projections are unambiguous and read-only; `FAIL` on missing
  projection or client mutation; `BLOCKED` if source states are unavailable;
  otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC006

- **Precondition:** Webhook/payment contract is complete.
- **Artifact:** Appendices A.3 and D.
- **Action:** Walk valid/invalid signature, duplicate, retry, out-of-order,
  amount/currency/reference mismatch and all six provider states.
- **Expected result:** Redirect never confirms; provider API is queried;
  verification stages are distinct; each domain effect is applied effectively
  once.
- **Evidence:** Notification/payment/effect state matrix.
- **Requirements:** R003, R022-R025, R031-R034, R042.
- **Result rule:** `PASS` when every scenario performs signature, provider
  query, ownership/reference/amount/currency verification, ordered transition,
  and one logical effect; `FAIL` on skipped invariant or duplicate effect;
  `BLOCKED` if provider contract evidence is unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC007

- **Precondition:** Effectful operation and idempotency tables are available.
- **Artifact:** Appendices A.6 and C.
- **Action:** Verify key source, scope, same-payload repeat, different-payload
  conflict, expiry decision, and auditable evidence for every required
  operation.
- **Expected result:** Checkout, webhook, invitation-code exchange,
  invitation completion/substitution, ticket issuance/reissue, and effectful
  resend are covered without selecting a storage technology.
- **Evidence:** Idempotency coverage matrix.
- **Requirements:** R020, R024, R033-R034, R042.
- **Result rule:** `PASS` when each operation has a key source, namespace,
  scope, same-payload response, different-payload conflict, and audit evidence;
  `FAIL` on any uncovered effectful operation; `BLOCKED` if an operation is
  undefined; otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC008

- **Precondition:** SPEC-030 capacity units and Appendix A.7 exist.
- **Artifact:** Capacity/reservation contract and failure rows.
- **Action:** Walk availability, reservation, confirmation, expiration,
  late-payment, and two concurrent final-unit attempts for J1-J5.
- **Expected result:** Correct unit is consumed; at most one final reservation
  wins; no silent oversale; late payment preserves payment but not unavailable
  ticket authority.
- **Evidence:** Capacity/concurrency/reconciliation matrix.
- **Requirements:** R021, R035-R036.
- **Result rule:** `PASS` when every journey uses the SPEC-030 unit, one final
  attempt wins, and expiry/late payment cannot oversell or invent payment
  truth; `FAIL` otherwise; `BLOCKED` if capacity authority is unavailable;
  otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC009

- **Precondition:** Team/invitation/substitution contracts are available.
- **Artifact:** OP-PUB-06-09 plus Appendices A.4/A.9 and B.
- **Action:** Inspect one-time-code exchange, atomic consumption, replay,
  invitation capability, one-slot scope, expiry, duplicate member, completion,
  resend, substitution, revocation, privacy, rate, and authority.
- **Expected result:** Invitee cannot affect other slots/payment/captain role;
  replacement requires personal waiver and old access revocation.
- **Evidence:** Roster invitation lifecycle matrix.
- **Requirements:** R012-R015, R027-R028, R037, R039-R041, R047, R049.
- **Result rule:** `PASS` when every capability/slot transition preserves
  authority, one-slot scope, personal consent, revocation, idempotency, and
  privacy, and when unavailable substitution is explicitly blocked with
  `SUBSTITUTION_NOT_ALLOWED`; `FAIL` on privilege transfer, stale access, or a
  hidden policy default; `BLOCKED` only if the governing SPEC-030 team contract
  is unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC010

- **Precondition:** Ticket and journey contracts are complete.
- **Artifact:** OP-PUB-10 and Appendices A.4/A.10.
- **Action:** Verify J1=1, J2=2, J3=4, J4=1, J5=1 per approved access; inspect
  issuance conditions, retry, revocation, reissue, and QR payload limits.
- **Expected result:** One ticket per participant/access, no duplicate issuance,
  opaque QR without PII, and approved validity preserved.
- **Evidence:** Journey-ticket and QR privacy matrix.
- **Requirements:** R016, R026-R030, R038, R041.
- **Result rule:** `PASS` when ticket count equals one per approved
  participant/access unit, eligibility gates activation, retries return one
  generation, and QR contains only allowed opaque data; `FAIL` otherwise;
  `BLOCKED` for only the unresolved three-day mechanism, not base entitlement;
  otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC011

- **Precondition:** Authorization and privacy sections are complete.
- **Artifact:** Appendices B/C and all operation auth/privacy rows.
- **Action:** Map every context to permitted operations and inspect public
  responses/log/audit/URL/QR data.
- **Expected result:** The contract explicitly prohibits anonymous direct table
  writes and unauthorized internal operations; secrets, medical data, internal
  IDs, and raw capabilities are excluded except the approved opaque ticket QR
  token.
- **Evidence:** Authorization/privacy/secret checklist.
- **Requirements:** R005, R018, R039-R042, R046-R047.
- **Result rule:** `PASS` when every actor maps only to allowlisted operations
  and every response/log/URL/QR boundary names permitted and prohibited data;
  `FAIL` on ambiguity or exposure; `BLOCKED` if an operation lacks auth/privacy
  fields; otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC012

- **Precondition:** Error taxonomy and operation error mappings are complete.
- **Artifact:** Appendix A.8 and OP-PUB-01-10.
- **Action:** Verify every required error exists with meaning, suggested HTTP,
  retry/support behavior, safe details, and prohibited disclosure.
- **Expected result:** Structured errors cover required public failures and no
  provider/database message reaches the browser.
- **Evidence:** Error-to-operation coverage matrix.
- **Requirements:** R031-R032.
- **Result rule:** `PASS` when every operation maps all reachable failures to a
  defined code with deterministic retry/support enums and safe details;
  `FAIL` on missing/misleading code or raw error forwarding; `BLOCKED` if an
  operation is incomplete; otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC013

- **Precondition:** Sensitive operations and audit contract are available.
- **Artifact:** Appendices A.1/A.6/A.9/A.10, C, and D.
- **Action:** Verify actor/action/entity/result/time/correlation/idempotency/
  failure evidence and prohibited log values.
- **Expected result:** Every sensitive path is auditable without secrets,
  medical/card data, raw capabilities, or unnecessary payloads.
- **Evidence:** Sensitive-operation audit matrix.
- **Requirements:** R014-R015, R018, R022-R025, R033-R034, R037-R042, R046-R049.
- **Result rule:** `PASS` when every sensitive public/internal operation records
  required evidence and excludes every prohibited value; `FAIL` on missing
  evidence or sensitive logging; `BLOCKED` if operation inventory is
  incomplete; otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC014

- **Precondition:** SALE-2 controlled-unit baseline and Git evidence are
  available.
- **Artifact:** Git name-status from baseline `d30a77a`, protected-path
  comparison, seed blob identity, and the self-contained SALE-2 Phase B
  evidence record in Appendix H.
- **Action:** Verify only SPEC-031, registry, and workspace status changed;
  verify no landing/code/seed/resource operation occurred.
- **Expected result:** No landing/code/protected-path diff is attributable to
  this unit; seed blob remains identical; the controlled operation record
  contains no seed execution, SQL, InsForge/Mercado Pago write, secret,
  payment, or deployment action.
- **Evidence:** Appendix H scoped Git/blob results and controlled-action
  attestation.
- **Requirements:** R044.
- **Result rule:** `PASS` only when both Git/blob evidence and the named
  controlled operation record support the scoped claim; `FAIL` on any
  protected mutation or prohibited operation; `BLOCKED` if either evidence
  source is unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC015

- **Precondition:** SPEC-030 and SPEC-031 decision tables are available.
- **Artifact:** Appendix E and R043.
- **Action:** Compare OD-001-024 status, classification, responsible actor, and
  blocker columns with SPEC-030; inspect API-OD-001-010 and search normative
  text for hidden defaults.
- **Expected result:** Imported decisions are preserved; every new technical
  choice is classified; no `CONTRACT_BLOCKER` or silently approved open choice
  remains.
- **Evidence:** Open-decision parity and normative-language matrix.
- **Requirements:** R043.
- **Result rule:** `PASS` on exact imported parity and complete classification;
  `FAIL` on missing status/responsible/blocker or hidden default; `BLOCKED` if
  SPEC-030 is unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.

### SPEC-031-AC016

- **Precondition:** SPEC-011 and public/protected response contracts are
  available.
- **Artifact:** R002, R045, section 9, Appendix A.5, and Appendix B.
- **Action:** Inspect server-authority preservation, read freshness, protected
  response caching, offline mutation, conflict, payment, capacity,
  eligibility, and ticket-validity behavior.
- **Expected result:** Public reads can support later controlled caching;
  protected order/team/invitation/capability/ticket responses use conceptual
  private `no-store` and service-worker/runtime-cache exclusion; offline/client
  state never becomes final authority; no PWA implementation is required.
- **Evidence:** SPEC-011 compatibility and cache/authority matrix.
- **Requirements:** R002, R045.
- **Result rule:** `PASS` when every compatibility boundary is explicit and
  non-implementing; `FAIL` on offline authority or sensitive shared caching;
  `BLOCKED` if SPEC-011 is unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.

## Appendix G - Traceability

All SPEC-031 requirements remain `DRAFT`. The final column describes only the
status of the cited source authority, not approval of this specification.

| Requirement | Authority | SPEC-030 journey | Conceptual operation | Failure mode | AC | Open decision | Implementation impact | Source authority status |
|---|---|---|---|---|---|---|---|---|
| R001-R005 | SPEC-001; SPEC-030; SALE-2 | J1-J5 | All | Client manipulation/exposure | AC001, AC003, AC011 | API-OD-001/004 | Trust boundaries | APPROVED |
| R006 | SALE-2 | J1-J5 | OP-PUB-01 | Event unavailable | AC002 | OD-022/023 | Public event read | APPROVED |
| R007 | SPEC-030; SALE-2 | J1-J5 | OP-PUB-02 | Hidden/inactive/sold out | AC001-AC003 | OD-024 | Catalog read | APPROVED |
| R008 | SPEC-030 | J1-J5 | OP-PUB-03 | Product unavailable | AC002 | OD-004/005/021 | Product detail | APPROVED |
| R009-R010 | SALE-2; SPEC-030 | J1-J5 | OP-PUB-04 | Invalid/sold out/price/provider | AC002-AC004 | OD-003-005, OD-016 | Checkout command | APPROVED |
| R011-R012 | SALE-2; SPEC-030 | J1-J3 | OP-PUB-05/06 | Unauthorized/pending/incomplete | AC002, AC005 | OD-004/009/019 | Public state projections | APPROVED |
| R013-R015 | SPEC-030 team rules | J2-J3 | OP-PUB-07A/07/08/09 | Invite/member/policy conflict | AC002, AC009, AC013 | OD-008/009/011 | Roster commands | APPROVED |
| R016-R017 | SALE-2 | J1-J5 | OP-PUB-01-10 | Incomplete/unauthorized ticket | AC002, AC010 | OD-019/020 | Stable operation contract | APPROVED |
| R018 | SPEC-001 security | J1-J5 | Internal operations | Anonymous sensitive write | AC003, AC011, AC013 | API-OD-001/006 | Protected orchestration | APPROVED |
| R019-R021 | SPEC-030 checkout/capacity | J1-J5 | OP-PUB-04 | Timeout/retry/soldout/price | AC004, AC008 | OD-010/012-016 | Order/preference orchestration | APPROVED |
| R022-R025 | SPEC-001 payment invariants | J1-J5 | Webhook/internal payment | Invalid/duplicate/out-of-order/mismatch | AC006-AC007, AC013 | API-OD-006 | Payment verification | APPROVED |
| R026 | SPEC-030 J1 | J1 | OP-PUB-04/05/10 | Waiver/payment pending | AC001, AC004, AC010 | OD-003-006 | Individual flow | APPROVED |
| R027 | SPEC-030 J2 | J2 | OP-PUB-04/06-10 | Roster incomplete | AC001, AC004-AC005, AC009-AC010 | OD-008-011 | Doubles flow | APPROVED |
| R028 | SPEC-030 J3 | J3 | OP-PUB-04/06-10 | Roster/composition incomplete | AC001, AC004-AC005, AC009-AC010 | OD-008-011 | Relay flow | APPROVED |
| R029 | SPEC-030 J4 | J4 | OP-PUB-04/05/10 | Registration incomplete | AC001, AC004, AC010 | OD-004/005 | Workout flow | APPROVED |
| R030 | SPEC-030 J5 | J5 | OP-PUB-02-05/10 | Validity/quantity open | AC001, AC004, AC010 | OD-001/002/020/021 | Access/press flow | APPROVED |
| R031-R032 | SALE-2 | J1-J5 | All public | Structured taxonomy | AC004, AC006, AC012 | API-OD-002 | Error handling | APPROVED |
| R033-R034 | SPEC-001 audit; SALE-2 | J1-J5 | Effectful operations | Retry/payload conflict | AC004, AC006-AC007, AC013 | API-OD-003 | Idempotency | APPROVED |
| R035-R036 | SPEC-030 capacity | J1-J5 | Checkout/internal recovery | Expiry/concurrency/late payment | AC004, AC008 | OD-010 | Reservation/reconciliation | APPROVED |
| R037 | SPEC-030 invitations | J2-J3 | OP-PUB-07A/07-09 | Invalid/expired/enumeration | AC009, AC013 | OD-011; API-OD-004 | Invite lifecycle | APPROVED |
| R038 | SPEC-030 tickets/QR | J1-J5 | OP-PUB-10/internal ticket | Duplicate/revoked/ineligible | AC010, AC013 | OD-019/020 | Entitlement lifecycle | APPROVED |
| R039-R040 | SPEC-001 auth boundary | J1-J5 | All | Unauthorized/forbidden | AC003, AC005, AC009, AC011 | API-OD-004 | Authorization | APPROVED |
| R041-R042 | SPEC-001 privacy/audit | J1-J5 | All | Data/log exposure | AC003, AC011, AC013 | API-OD-005/007 | Privacy/observability | APPROVED |
| R043 | SPEC-000/030 governance | J1-J5 | All | Open decision silently resolved | AC015 | All OD/API-OD | Gating | APPROVED |
| R044 | SALE-2 protection | J1-J5 | Documentation only | Protected file/resource mutation | AC014 | None | No runtime implementation | APPROVED |
| R045 | SPEC-011; SALE-2 | J1-J5 | Public/protected responses | Offline authority or sensitive caching | AC016 | None | Future client compatibility | APPROVED |
| R046 | SPEC-001 protected actions; SALE-2 | J1-J5 | Internal operation inventory | Anonymous/generic sensitive transition | AC003, AC011, AC013 | API-OD-001/006 | Protected orchestration contract | APPROVED |
| R047 | SALE-2 continuation/auth | J1-J5 | OP-PUB-04-10; capability service | Missing/expanded/stale capability | AC003-AC005, AC009-AC011 | API-OD-004/010 | Capability lifecycle | APPROVED |
| R048 | SPEC-030 pricing; SALE-2 checkout | J1-J5 | Checkout/preference | Partial failure or amount mismatch | AC004, AC006, AC008 | OD-010; API-OD-009 | Atomicity/compensation | APPROVED |
| R049 | SPEC-001 named actions; SALE-2 | J1-J5 | Named recovery commands | Generic state mutation | AC003, AC009, AC013 | OD-007/008/010/018 | Manual recovery | APPROVED |

## Appendix H - Validation plan

Evidence identity:

```text
Phase B baseline commit: d30a77a
Seed baseline/current blob: 20d73e626981604da65e1ea34dc1a03b37f0845f
Pre-commit scope status:
M WORKSPACE_STATUS.md
M docs/specs/README.md
?? docs/specs/SPEC-031-PUBLIC-SALES-API-AND-BACKEND-CONTRACT.md
Protected-path comparison from d30a77a: PASS (no diff)
git diff --check: PASS
```

Controlled-action attestation for SALE-2 Phase B:

- The seed was read as documentation only and was not executed.
- No SQL, migration, formatter, codemod, build, deploy, or test executable ran.
- No InsForge or Mercado Pago write tool was called.
- No preference, webhook, payment, table, function, bucket, secret, or external
  resource was created, modified, or deleted.
- No landing, frontend, code, protected specification, configuration, or
  dependency file was edited.
- Writes were limited to SPEC-031, `docs/specs/README.md`, and
  `WORKSPACE_STATUS.md`.

1. Verify metadata, dependencies, and DRAFT status.
2. Verify R001-R049 unique and mapped.
3. Verify AC001-AC016 contain all required fields.
4. Complete each documentary evidence matrix and replace `NOT_RUN` with the
   observed result.
5. Verify OP-PUB-01-10 contain every contract-template field.
6. Verify the stable error taxonomy covers all requested codes.
7. Verify all effectful operations have idempotency and audit.
8. Verify SPEC-030 OD-001-024 remain open/classified.
9. Verify no contract blocker remains.
10. Verify compatibility with SPEC-001 and SPEC-011.
11. Verify Git scope and protected paths.
12. Verify the seed blob is unchanged and no seed execution occurred.
13. Verify no landing, code, external-resource, or secret operation occurred.

### Documentary review evidence

`PASS` below means the draft contract itself satisfies the documentary
criterion. Runtime, browser, provider, database, and physical tests remain
`NOT_RUN` and require later approved implementation/validation units.

| AC | Evidence inspected | Documentary result |
|---|---|---|
| AC001 | R004, Appendix A.4/A.7, SPEC-030 product/journey mappings | PASS |
| AC002 | OP-PUB-01-10 plus OP-PUB-07A; all 13 contract fields and mapped failures | PASS |
| AC003 | R001-R005/R046-R049, Appendices A/B authority and exposure boundaries | PASS |
| AC004 | OP-PUB-04, Appendix A.2/A.4, atomic snapshot and failure outcomes | PASS |
| AC005 | OP-PUB-05/06 and Appendix A.5 order/team projections | PASS |
| AC006 | Appendix A.3 signature, provider ownership, states, ordering, effects | PASS |
| AC007 | Appendix A.6 key source/namespace/scope/repeat/conflict coverage | PASS |
| AC008 | Appendix A.7 capacity units, concurrency, expiry, late payment | PASS |
| AC009 | OP-PUB-06-09/07A, capability bootstrap, Appendix A.9/B | PASS |
| AC010 | OP-PUB-10, Appendix A.4/A.10 ticket counts and QR privacy | PASS |
| AC011 | Appendix B actor/capability/privacy matrix and internal protection | PASS |
| AC012 | Appendix A.8 taxonomy and every OP-PUB public-error row | PASS |
| AC013 | Appendix A.1/A.6/A.9/A.10, C/D internal/audit profiles | PASS |
| AC014 | Baseline `d30a77a`, unchanged seed blob, scoped Git/operation record | PASS |
| AC015 | SPEC-030 OD-001-024 parity and API-OD-001-010 classification | PASS |
| AC016 | R002/R045, section 9 and Appendix A.5/B cache/server-authority rules | PASS |

## Appendix I - Change log

| Version | Date | Status | Actor | Reason |
|---|---|---|---|---|
| 0.1.0 | 2026-07-23 | DRAFT | Cursor, authorized by Project Owner | Define the public sales API and backend contract for 28 configured products and five journeys without implementing code, SQL, payment resources, or landing changes. |
| 0.1.0 | 2026-07-23 | DRAFT | Cursor, authorized by Project Owner | Formal documentary review completed `READY_FOR_APPROVAL`: 0 blockers, 0 major findings after corrections; SPEC-031 remains unapproved and has no implementation authority. |

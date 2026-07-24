---
id: SPEC-030
title: Public Sales Catalog and Registration Journeys
status: DRAFT
version: 0.1.0
phase: SALE-1
created_at: 2026-07-23
approved_at:
approved_by:
supersedes:
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-011 v0.1.0
---

# SPEC-030 - Public Sales Catalog and Registration Journeys

## 1. Purpose

Define the approved launch catalog, public actors, reusable registration and
purchase journeys, capacity semantics, payment boundaries, ticket outcomes,
privacy requirements, failure handling, and open decisions for selling Hybrid
Experience 2026.

This contract defines what the public sales experience must accomplish without
selecting the final visual design, database schema, endpoint names, payment
implementation, or landing components.

## 2. Authority sources

1. Explicit Project Owner decisions in SALE-1, dated 2026-07-23.
2. `CURSOR_START_PROMPT.md`.
3. `MANIFEST.md`.
4. `WORKSPACE_STATUS.md`.
5. `docs/00_CICLO_DEL_EVENTO.md`.
6. `docs/01_R2R_A_R2H_PRACTICO.md`.
7. `docs/02_PLAN_DESARROLLO_CON_CURSOR.md`.
8. `docs/03_CUSTOMER_JOURNEYS.md`.
9. `docs/04_REVISION_FINAL.md`.
10. `docs/05_ANEXO_PLAN_TECNICO.md`.
11. `docs/specs/SPEC-000-GOVERNANCE.md` v0.2.0.
12. `docs/specs/SPEC-001-SYSTEM-ARCHITECTURE.md` v0.1.0.
13. `docs/specs/SPEC-011-PWA-FOUNDATION.md` v0.1.0.
14. `insforge/seeds/0002_seeds_hybrid_event.sql`, as a read-only comparison
    artifact rather than authority over the owner's catalog decision.

When the seed and the SALE-1 catalog differ, the explicit current owner
decision governs this specification. The seed remains unmodified and
unexecuted.

Transition note: `MANIFEST.md` and the authority-source lists inside SPEC-001
and SPEC-011 still preserve pre-approval references to SPEC-000 v0.1.0. The
explicit SALE-1 owner approval, SPEC-000 v0.2.0 metadata, and the current
specification registry establish v0.2.0 as the effective contract. Updating
those protected historical references requires a separate authorized
documentation unit and is tracked in `WORKSPACE_STATUS.md`; this draft does not
modify them.

## 3. Context

Hybrid Experience 2026 is represented by:

```text
Code: HEX-2026
Name: Hybrid Experience 2026
City: Mérida, Yucatán
Timezone: America/Merida
Starts: 2026-10-09
Ends: 2026-10-11
Seed lifecycle status: CONFIGURADO
```

The launch catalog contains 28 products:

```text
COMPITE:     13
EXPERIENCE:   7
ASISTE:       8
TOTAL:       28
```

All 28 products are approved for initial sales availability, subject to the
effective opening of sales, available capacity, correct configuration,
technical validation, and a separate production authorization.

## 4. Scope

This specification covers:

- the official 28-product launch catalog;
- product-to-journey mapping;
- public catalog data and conceptual sale states;
- buyer, participant, captain, invitee, attendee, spectator, and press roles;
- individual, doubles, relay, workout, spectator, and photographer outcomes;
- conceptual checkout and Mercado Pago authority boundaries;
- team creation, invitations, roster completion, eligibility, and substitution;
- capacity consumption, reservation, release, and concurrency;
- tickets, QR, three-day access, privacy, security, audit, and recovery;
- documented seed inconsistencies;
- decisions that remain open for implementation or production.

## 5. Non-goals

This specification does not define or authorize:

- visual design, copy, React, CSS, components, images, assets, layout,
  responsive behavior, or public route changes;
- SQL schema, table names, migrations, seeds, RLS, Edge Functions, final
  endpoints, or webhook implementation;
- secrets, deployments, production payments, production webhooks, or resource
  creation;
- PWA implementation, IndexedDB, operational check-in, heats, timing, results,
  staff, CRM, or an administrative panel;
- final invitation token format or lifetime;
- final roster-change deadline;
- final capacity-reservation duration;
- final three-day QR mechanism;
- execution or modification of `insforge/seeds/0002_seeds_hybrid_event.sql`;
- cleanup, formatting, or reorganization of the landing repository or files.

## 6. Definitions

- **Product:** A catalog entry selected for purchase and the authority for
  journey, unit price, team size, included benefits, capacity unit, and sale
  state.
- **Unit of sale:** The complete item represented by one `price_cents` value,
  such as one person, one pair, one relay team, one access, or one
  accreditation.
- **Buyer:** The person who initiates and pays for an order.
- **Participant:** A person registered to perform an activity or competition.
- **Captain:** The participant responsible for initiating and managing an
  authorized team roster.
- **Invited member:** A participant who completes their own identity, required
  data, and waiver through a secure invitation.
- **Roster:** The fixed set of participant slots required by a team product.
- **Eligibility:** The state reached after required roster and personal
  conditions are complete.
- **Access:** One spectator admission right.
- **Accreditation:** One photographer/press admission right.
- **Ticket:** The canonical access entitlement issued after valid payment and
  applicable registration conditions.
- **QR:** A visual representation of an opaque ticket or accreditation token.
- **Initial capacity:** The owner-approved starting configuration, changeable
  before production only through an authorized unit.
- **Sale state:** A public conceptual state: `COMING_SOON`, `AVAILABLE`,
  `LOW_AVAILABILITY`, `SOLD_OUT`, `SALES_CLOSED`, or `CANCELLED`.
- **PAID_ROSTER_INCOMPLETE:** Payment is valid but required team members have
  not completed the roster.
- **PAID_ROSTER_COMPLETE:** Payment is valid and all roster slots are filled.
- **ELIGIBLE:** All roster, waiver, and applicable participation conditions are
  satisfied.

## 7. Invariants and requirements

### SPEC-030-R001

The launch catalog MUST contain exactly 28 unique product codes: 13 `COMPITE`,
7 `EXPERIENCE`, and 8 `ASISTE`.

### SPEC-030-R002

All 28 products MUST be represented as launch products, subject to sales
opening, capacity, configuration, technical validation, and separate production
authorization.

### SPEC-030-R003

The public landing MUST derive product name, classification, schedule,
composition, price, included benefits, availability, requirements, journey,
CTA eligibility, and sale state from catalog data rather than independently
hard-coding those values as authority.

### SPEC-030-R004

Every price MUST use integer MXN cents. `price_cents` MUST represent the full
unit of sale: one person for individual/workout products, one complete pair for
doubles, one complete four-person team for relay, and one access or
accreditation for spectator/press products.

### SPEC-030-R005

The published price MUST equal the charged price. Checkout MUST NOT add
separate insurance or chip charges; those benefits are included when the
product declares them.

### SPEC-030-R006

Initial capacities MUST match the approved catalog and MUST NOT change silently
during this specification. A later authorized unit MAY change them before
production.

### SPEC-030-R007

The 28 products MUST use the five reusable journey templates J1-J5. The system
MUST NOT create a separate business flow for each product code.

### SPEC-030-R008

The system MUST distinguish buyer, participant, captain, invited member,
workout attendee, spectator, photographer, authorized operator, Ready2Hybrid,
and Mercado Pago responsibilities.

### SPEC-030-R009

A buyer MUST NOT automatically gain authority over another adult's identity,
private data, waiver, or consent. Each adult participant MUST provide their own
required data and accept their own waiver.

### SPEC-030-R010

J1 individual purchases MUST produce one buyer context, one participant, one
registration, one personal waiver, one order, one payment, one ticket, and one
QR. Third-party purchase remains disabled unless OD-003 is approved.

### SPEC-030-R011

J2 doubles purchases MUST produce one captain, one invited member, one team,
two participants, two personal waivers, one pair-priced order, one payment, two
tickets, and two QR codes.

### SPEC-030-R012

J2 MUST represent `PAID_ROSTER_INCOMPLETE`, `PAID_ROSTER_COMPLETE`, and
`ELIGIBLE` without treating payment alone as proof of roster eligibility.

### SPEC-030-R013

J3 relay purchases MUST produce one captain, three invited members, one team,
four participants, four personal waivers, one team-priced order, one payment,
four tickets, and four QR codes.

### SPEC-030-R014

The `REL-2H2M` contract MUST preserve the conceptual composition of two men and
two women while leaving the technical validation mechanism to an approved
implementation specification.

### SPEC-030-R015

J4 workout purchases MUST produce one buyer, one registered workout attendee,
one order, one payment, one ticket QR, no chip, no insurance, and no
competition waiver. The attendee MUST still complete the registration required
for activity participation.

### SPEC-030-R016

J5 spectator and photographer purchases MUST distinguish `spectator` from
`press`, single-day from three-day access, and one entitlement per unit sold.
The contract MUST NOT assume that an order contains only one unit.

### SPEC-030-R017

The public catalog MUST expose, where applicable, block, name, day, session,
modality, composition, total price, inclusions, availability, requirements,
CTA eligibility, and sale state.

### SPEC-030-R018

The checkout journey MUST follow: product selection, initial registration,
validation, applicable acceptance, trusted order creation, Mercado Pago
Checkout Pro, a non-authoritative confirming return, trusted backend payment
verification, confirmation, and ticket issuance.

### SPEC-030-R019

Price, currency, capacity, composition, and final order amount MUST be resolved
by trusted backend behavior. Browser-supplied price or capacity values MUST NOT
be authoritative.

### SPEC-030-R020

Mercado Pago Checkout Pro MUST be the payment provider. `external_reference`
MUST link the provider operation to the canonical order. Redirects and frontend
state MUST NOT confirm payment.

### SPEC-030-R021

Payment notification handling MUST verify the webhook signature, query the
Mercado Pago API for canonical payment state, enforce idempotency, reject
amount or currency mismatches, and prevent duplicate registration, payment,
ticket, QR, or communication effects.

### SPEC-030-R022

Tickets MUST be issued only after valid trusted payment confirmation and
applicable registration conditions. Pending or rejected payment MUST NOT issue
valid tickets.

### SPEC-030-R023

Doubles and relay flows MUST support a provisional team, fixed roster slots,
secure invitations, incomplete and complete roster states, eligibility,
reminders, invitation resend, substitution, expiration handling, duplicate
member detection, already-registered member handling, individual waivers,
individual tickets, revoked substituted tickets, and audit history.

### SPEC-030-R024

A captain MUST NOT accept another adult member's waiver. Each invited adult
MUST complete their own waiver before eligibility.

### SPEC-030-R025

Substitution MUST revoke the replaced member's ticket before any replacement
ticket becomes valid and MUST leave an audit record.

### SPEC-030-R026

`PUB-3D` and `FOT-3D` MUST represent one three-day entitlement covering
2026-10-09, 2026-10-10, and 2026-10-11. Regardless of the selected mechanism,
access on one covered date MUST NOT invalidate access on later covered dates.
The credential, QR, date-association, same-day re-entry, and duplicate-use
mechanisms remain proposed or open in OD-020 and are not final authority.

### SPEC-030-R027

Capacity MUST be consumed as follows: one registration for individual, one
team for doubles, one team for relay, one person for workout, one access per
spectator unit, and one accreditation per photographer unit.

### SPEC-030-R028

Trusted backend behavior MUST check capacity before checkout, reserve capacity
temporarily, release expired or failed reservations, resolve late payment, and
serialize concurrent attempts for the final capacity unit without silent
overselling. A payment confirmed after its reservation was released MUST NOT
silently consume unavailable capacity or issue a valid ticket; it requires
audited reconciliation under the late-payment policy in OD-010.

### SPEC-030-R029

Ticket quantities MUST be: one for J1, two for J2, four for J3, one for J4,
one per spectator unit, and one per photographer unit.

### SPEC-030-R030

Every QR MUST contain only an opaque, high-entropy token. It MUST NOT contain
personal, medical, financial, internal identifier, or payment-state data and
MUST remain revocable, reissuable, and auditable.

### SPEC-030-R031

Public registration MUST minimize collected data, separate buyer from
participant identity, obtain personal consent and waiver acceptance, restrict
medical information, return minimal public responses, sanitize logs, enforce
least privilege, rate-limit abuse-sensitive operations, and prohibit anonymous
direct writes to canonical domain tables.

### SPEC-030-R032

Secrets and payment credentials MUST remain in trusted backend configuration
and MUST NOT appear in frontend code, public responses, QR payloads, logs, or
this specification.

### SPEC-030-R033

Each failure mode in section 12 MUST have a safe outcome and an observable
recovery or escalation path without inventing payment, roster, capacity, or
ticket state.

### SPEC-030-R034

A communication failure MUST NOT revert or invalidate an otherwise confirmed
payment. Failed delivery MUST remain recoverable and auditable.

### SPEC-030-R035

Open decisions MUST remain explicitly classified and MUST NOT be silently
implemented as approved behavior.

### SPEC-030-R036

CAT-SEED-001, CAT-SEED-002, and CAT-SEED-003 MUST be corrected or resolved
before seed execution and public schedule publication as applicable, without
removing the approved Saturday doubles products.

### SPEC-030-R037

This documentation unit MUST NOT modify the landing, execute or modify the
seed, implement code, create SQL, or change external resources.

### SPEC-030-R038

Seed comparison findings MUST distinguish owner-approved catalog values from
editorial seed commentary so that seed execution cannot silently override the
current catalog authority.

## 8. Functional requirements

### 8.1 Official catalog

#### COMPITE - 13 products

| Code | Product | Members | Price cents | Initial capacity | Day/session | Chip | Insurance | Journey |
|---|---|---:|---:|---:|---|---|---|---|
| DOB-VIE-MM | Dobles Mujeres · Viernes | 2 | 240000 | 40 teams | 2026-10-09 PM | Yes | Yes | J2 |
| DOB-VIE-HH | Dobles Hombres · Viernes | 2 | 240000 | 40 teams | 2026-10-09 PM | Yes | Yes | J2 |
| DOB-VIE-MH | Dobles Mixto · Viernes | 2 | 240000 | 40 teams | 2026-10-09 PM | Yes | Yes | J2 |
| DOB-SAB-MM | Dobles Mujeres · Sábado | 2 | 240000 | 40 teams | 2026-10-10 AM | Yes | Yes | J2 |
| DOB-SAB-HH | Dobles Hombres · Sábado | 2 | 240000 | 40 teams | 2026-10-10 AM | Yes | Yes | J2 |
| DOB-SAB-MH | Dobles Mixto · Sábado | 2 | 240000 | 40 teams | 2026-10-10 AM | Yes | Yes | J2 |
| REL-4H | Relay 4 Hombres | 4 | 320000 | 20 teams | 2026-10-10 PM | Yes | Yes | J3 |
| REL-4M | Relay 4 Mujeres | 4 | 320000 | 20 teams | 2026-10-10 PM | Yes | Yes | J3 |
| REL-2H2M | Relay Mixto 2H+2M | 4 | 320000 | 20 teams | 2026-10-10 PM | Yes | Yes | J3 |
| IND-H | Individual Hombre Open | 1 | 140000 | 60 | 2026-10-11 AM | Yes | Yes | J1 |
| IND-M | Individual Mujer Open | 1 | 140000 | 60 | 2026-10-11 AM | Yes | Yes | J1 |
| IND-PRO-H | Individual Pro Hombre | 1 | 140000 | 30 | 2026-10-11 AM | Yes | Yes | J1 |
| IND-PRO-M | Individual Pro Mujer | 1 | 140000 | 30 | 2026-10-11 AM | Yes | Yes | J1 |

#### EXPERIENCE - 7 products

| Code | Product | Members | Price cents | Initial capacity | Day/session | Chip | Insurance | Journey |
|---|---|---:|---:|---:|---|---|---|---|
| HALF-IND-M | ½ Hybrid Individual Mujer | 1 | 80000 | 50 | 2026-10-10 AM | Yes | Yes | J1 |
| HALF-IND-H | ½ Hybrid Individual Hombre | 1 | 80000 | 50 | 2026-10-10 AM | Yes | Yes | J1 |
| HALF-DOB-MM | ½ Hybrid Dobles Mujeres | 2 | 160000 | 30 teams | 2026-10-10 AM | Yes | Yes | J2 |
| HALF-DOB-HH | ½ Hybrid Dobles Hombres | 2 | 160000 | 30 teams | 2026-10-10 AM | Yes | Yes | J2 |
| HALF-DOB-MH | ½ Hybrid Dobles Mixto | 2 | 160000 | 30 teams | 2026-10-10 AM | Yes | Yes | J2 |
| WOD-M | Workout Experience Mujer | 1 | 30000 | 60 | 2026-10-10 AM | No | No | J4 |
| WOD-H | Workout Experience Hombre | 1 | 30000 | 60 | 2026-10-10 AM | No | No | J4 |

#### ASISTE - 8 products

| Code | Product | Kind | Unit size | Price cents | Initial capacity | Validity | Session | Chip | Insurance | Journey |
|---|---|---|---:|---:|---:|---|---|---|---|---|
| PUB-VIE | Público · Viernes 9 | spectator | 1 | 25000 | 500 | 2026-10-09 | None | No | No | J5 |
| PUB-SAB | Público · Sábado 10 | spectator | 1 | 25000 | 500 | 2026-10-10 | None | No | No | J5 |
| PUB-DOM | Público · Domingo 11 | spectator | 1 | 25000 | 500 | 2026-10-11 | None | No | No | J5 |
| PUB-3D | Público · Pase 3 Días | spectator | 1 | 60000 | 300 | 2026-10-09 through 2026-10-11 | None | No | No | J5 |
| FOT-VIE | Fotógrafo · Viernes 9 | press | 1 | 35000 | 30 | 2026-10-09 | None | No | No | J5 |
| FOT-SAB | Fotógrafo · Sábado 10 | press | 1 | 35000 | 30 | 2026-10-10 | None | No | No | J5 |
| FOT-DOM | Fotógrafo · Domingo 11 | press | 1 | 35000 | 30 | 2026-10-11 | None | No | No | J5 |
| FOT-3D | Fotógrafo · Pase 3 Días | press | 1 | 80000 | 20 | 2026-10-09 through 2026-10-11 | None | No | No | J5 |

### 8.2 Public presentation derivation

Every catalog response derives the following fields from the product plus
trusted current availability:

```text
block
kind
modality
composition
name
day or validity
session
journey
price_cents and currency
included chip and insurance flags
initial capacity and trusted current availability
requirements derived from the journey
sale state
CTA eligibility
```

Modality and composition are structured as follows:

| Journey | Modality | Composition | Requirements source |
|---|---|---|---|
| J1 | individual competitor | 1 participant | Registration and personal waiver |
| J2 | doubles competitor | 2 participants; category constraints from product | Team roster and two personal waivers |
| J3 | relay competitor | 4 participants; `REL-2H2M` preserves 2H+2M | Team roster and four personal waivers |
| J4 | workout | 1 attendee | Workout registration; no competition waiver |
| J5 spectator | spectator access | 1 access per sold unit | Access registration selected by approved data decision |
| J5 press | photographer accreditation | 1 accreditation per sold unit | Press registration selected by approved data decision |

Sale state and CTA behavior:

| Sale state | Availability meaning | CTA eligibility |
|---|---|---|
| `COMING_SOON` | Sales have not opened | Disabled |
| `AVAILABLE` | Sales open and trusted capacity available | Enabled |
| `LOW_AVAILABILITY` | Sales open and capacity is below a configured threshold | Enabled |
| `SOLD_OUT` | No trusted capacity available | Disabled |
| `SALES_CLOSED` | Sales window closed | Disabled |
| `CANCELLED` | Product withdrawn by authorized decision | Disabled |

The low-availability threshold is an implementation configuration recorded in
OD-024. Final visual labels and copy remain outside scope.

### 8.3 Journey templates

#### J1 - Individual competitor

Applies to `IND-H`, `IND-M`, `IND-PRO-H`, `IND-PRO-M`, `HALF-IND-M`, and
`HALF-IND-H`.

```text
1 buyer
1 participant
1 registration
1 personal waiver
1 order
1 payment
1 ticket
1 QR
```

The default contract treats the buyer as the participant. A distinct buyer is
an open extension under OD-003.

#### J2 - Doubles team

Applies to `DOB-VIE-MM`, `DOB-VIE-HH`, `DOB-VIE-MH`, `DOB-SAB-MM`,
`DOB-SAB-HH`, `DOB-SAB-MH`, `HALF-DOB-MM`, `HALF-DOB-HH`, and
`HALF-DOB-MH`.

```text
1 captain
1 invited member
1 team
2 participants
2 personal waivers
1 full-pair order
1 payment
2 tickets
2 QR
```

#### J3 - Relay team

Applies to `REL-4H`, `REL-4M`, and `REL-2H2M`.

```text
1 captain
3 invited members
1 team
4 participants
4 personal waivers
1 full-team order
1 payment
4 tickets
4 QR
```

#### J4 - Workout Experience

Applies to `WOD-M` and `WOD-H`.

```text
1 buyer
1 registered workout attendee
1 order
1 payment
1 ticket QR
no chip
no insurance
no competition waiver
```

#### J5 - Spectator and photographer

Applies to `PUB-VIE`, `PUB-SAB`, `PUB-DOM`, `PUB-3D`, `FOT-VIE`,
`FOT-SAB`, `FOT-DOM`, and `FOT-3D`.

```text
1 buyer
1 access or accreditation per sold unit
1 order
1 payment
1 ticket or accreditation QR per sold unit
```

J5 distinguishes spectator/press and single-day/three-day entitlements.
Multiple units and cart behavior remain open in OD-001 and OD-002.

### 8.4 Actors and responsibility

| Actor | Pays | Participates | Accepts waiver | Receives entitlement | May modify roster |
|---|---|---|---|---|---|
| Buyer | Yes | Only when also participant | Only their own | Purchase communication; own ticket when applicable | No, unless also captain |
| Individual participant | Possibly | Yes | Their own | Their ticket | Not applicable |
| Captain | Yes or initiates team order | Yes | Their own | Their ticket | Team roster within approved rules |
| Invited member | No by default | Yes | Their own | Their ticket | Their own profile only |
| Workout attendee | Possibly | Yes | Applicable activity acceptance, not competition waiver | Their ticket | Not applicable |
| Spectator | Possibly | No | No competition waiver | Access ticket | Not applicable |
| Photographer | Possibly | No competition participation | Required accreditation acceptance when defined | Accreditation QR | Not applicable |
| Authorized operator | No | No | No | Operational access only | Protected audited actions |
| Ready2Hybrid | No | No | No | Issues canonical entitlements | Enforces rules |
| Mercado Pago | Processes payment | No | No | No Ready2Hybrid ticket authority | No |

### 8.5 Team roster and ticket lifecycle

| Team condition | Roster/eligibility outcome | Ticket outcome |
|---|---|---|
| Provisional, unpaid | Fixed slots exist; invitations may be prepared under approved rules | No valid ticket |
| Payment confirmed, roster incomplete | `PAID_ROSTER_INCOMPLETE`; missing members continue secure completion | Required entitlement count is reserved, but no competition ticket or QR is active |
| Payment confirmed, roster complete, waiver pending | `PAID_ROSTER_COMPLETE`; team remains ineligible | Member ticket records may remain pending; no affected ticket or QR is active |
| Payment confirmed, roster and personal waivers complete | `ELIGIBLE` | Two J2 or four J3 individual tickets and QR codes are issued or activated |
| Authorized substitution | Team returns to the applicable incomplete/ineligible state | Replaced member ticket is revoked; replacement remains pending until personal requirements pass |

Ticket validity is therefore distinct from paid capacity. Payment secures the
approved unit subject to capacity rules; each team member receives an active
competition ticket only after the team and that member satisfy applicable
registration and waiver requirements.

Invitation mechanisms MUST use unguessable, revocable references; concrete
token formats, invitation duration, and roster-change deadlines remain open.

### 8.6 Three-day entitlement behavior

`PUB-3D` and `FOT-3D` each grant one entitlement covering all three event
dates. Canonical validation must preserve the approved outcome: a successful
use on 2026-10-09 leaves access on 2026-10-10 and 2026-10-11 available, and
use on 2026-10-10 leaves access on 2026-10-11 available.

The proposed, non-authoritative design uses one credential and one opaque QR
that resolves to three date-specific rights. The association and recording
mechanism, same-day re-entry policy, and distinction between a valid second use
and abuse remain open under OD-020. No final token, scan, or check-in
implementation is defined here.

## 9. Non-functional requirements

- Catalog and journey contracts are deterministic from product code and
  approved catalog data.
- Public responses minimize data and reveal no secret or internal identifier.
- Payment and entitlement effects are idempotent and auditable.
- Capacity concurrency never depends on browser state.
- A communication failure is recoverable without corrupting canonical payment.
- The landing remains visually and structurally untouched by this unit.
- Open implementation and production decisions remain explicit rather than
  encoded as hidden defaults.

## 10. Interfaces and contracts

These are conceptual boundaries, not final endpoint or type definitions.

```text
Public landing
  -> reads catalog presentation and availability
  -> submits product selection and required registration input
  -> never determines final price, capacity, payment, or ticket validity

Ready2Hybrid orchestration with canonical InsForge backend behavior
  -> resolves product, price, currency, capacity, order, registration, roster
  -> creates Checkout Pro preference through protected behavior
  -> verifies Mercado Pago state and emits canonical tickets
  -> treats InsForge, never browser or offline state, as final domain authority

Mercado Pago Checkout Pro
  -> executes payment
  -> returns non-authoritative browser redirects
  -> sends signed notifications
  -> exposes canonical payment state through its API
```

Conceptual product contract:

```text
code
block
kind
modality
composition
name
day or validity
session
journey
team size or entitlement quantity
price_cents
currency = MXN
initial capacity
trusted current availability
chip included
insurance included
requirements
sale state
CTA eligibility
```

Conceptual team contract:

```text
product
captain
fixed roster size
member slots
invitation states
waiver state per member
payment state
roster state
eligibility state
ticket state per member
audit history
```

## 11. Seed comparison and known inconsistencies

The seed was inspected as text only. It was not executed or modified.

### CAT-SEED-001

```text
Seed footer: 29 products; COMPITE 13 · EXPERIENCE 7 · ASISTE 9
Actual rows: 28 products; COMPITE 13 · EXPERIENCE 7 · ASISTE 8
```

Classification:

```text
EDITORIAL
NON_BLOCKING_FOR_SPEC
MUST_BE_CORRECTED_BEFORE_SEED_EXECUTION
```

### CAT-SEED-002

```text
Saturday label:
½ Hybrid y Workout AM · Relay PM

Approved Saturday AM catalog also contains:
DOB-SAB-MM
DOB-SAB-HH
DOB-SAB-MH
```

Classification:

```text
SCHEDULE_LABEL_INCONSISTENCY
NON_BLOCKING_FOR_CATALOG
MUST_BE_RESOLVED_BEFORE_PUBLIC_SCHEDULE
```

The Saturday doubles products remain approved. This specification does not
change their schedule or the seed label.

### CAT-SEED-003

The seed header names `0002_seeds_hybrid_experience.sql` while the repository
path is `0002_seeds_hybrid_event.sql`. It also states that all prices include
chip and insurance and names Workout as the exception, while all eight
`ASISTE` rows correctly set both flags to `false`.

Classification:

```text
EDITORIAL_RULE_SCOPE_INCONSISTENCY
NON_BLOCKING_FOR_SPEC
MUST_BE_CORRECTED_BEFORE_SEED_EXECUTION
```

The owner-approved display names normalize punctuation for `REL-2H2M`,
`IND-H`, and `IND-M` compared with the seed. Codes and business meaning are
unchanged; these are approved display-name normalizations, not independent
seed authority.

Apart from the registered findings and display-name normalization, the seed
rows semantically match the approved codes, block counts, prices, team sizes,
capacities, dates, sessions, and chip/insurance flags in this contract.

## 12. Failure modes

| Failure | Safe outcome and recovery |
|---|---|
| Product does not exist | Reject selection; return minimal not-found response; create no order. |
| Product inactive | Reject checkout; preserve submitted data only under approved privacy rules. |
| Sales not open | Return `COMING_SOON`; create no payable order. |
| Sales closed | Return `SALES_CLOSED`; create no new preference. |
| Capacity exhausted | Return `SOLD_OUT`; create no reservation or preference. |
| Concurrent final capacity | Trusted backend serializes the decision; at most one attempt receives the unit. |
| Manipulated price | Ignore browser value, resolve catalog price, reject any amount mismatch, and audit. |
| Incomplete payload | Return field-level validation without exposing internals. |
| Missing applicable waiver | Keep registration or roster ineligible; do not claim eligibility. |
| Checkout creation failure | Preserve recoverable order context without claiming payment. |
| Payment pending | Keep payment and entitlement pending; do not issue valid ticket. |
| Payment rejected | Record provider outcome; release capacity according to approved reservation policy. |
| Browser return lost | Recover from canonical order/payment query; do not depend on redirect. |
| Invalid webhook signature | Reject notification effects, record sanitized security evidence, and verify state only through an authenticated provider API query or authorized reconciliation. |
| Duplicate webhook | Return idempotent success without duplicate effects. |
| Out-of-order webhook | Resolve current state from Mercado Pago API and apply allowed monotonic transition. |
| Incorrect amount | Reject confirmation, hold entitlement, and create auditable finance incident. |
| Incorrect currency | Reject confirmation, hold entitlement, and create auditable finance incident. |
| Reservation expires before payment confirmation | Release the reservation according to policy; do not claim payment failure without provider evidence. |
| Late confirmed payment after capacity release | Preserve confirmed payment, issue no valid ticket against unavailable capacity, prevent over-sale, and route to audited reconciliation/refund or authorized capacity recovery under OD-010. |
| Team incomplete | Keep `PAID_ROSTER_INCOMPLETE`; send approved reminders; no eligibility claim. |
| Invalid invitation | Reveal no roster data; offer safe resend/escalation path. |
| Expired invitation | Reject use and allow authorized captain/operator recovery. |
| Duplicate member | Reject duplicate roster identity and preserve existing membership. |
| Member already registered | Stop automatic merge and route to audited resolution. |
| Duplicate ticket attempt | Preserve one canonical entitlement and audit the duplicate attempt. |
| Email failure | Preserve confirmed payment and ticket; queue or expose audited resend. |
| Manual recovery | Permit only named, authorized, audited business actions. |

## 13. Security and privacy

- Collect only data required by the applicable journey and approved decisions.
- Keep buyer identity distinct from participant identity.
- Require personal waiver or consent from the affected adult.
- Restrict medical and emergency information to authorized roles and purposes.
- Keep Mercado Pago credentials and application secrets in trusted backend
  configuration.
- Return minimal public error and status responses.
- Use opaque, high-entropy invitation and QR tokens.
- Apply rate limits to catalog abuse, checkout creation, status lookup,
  invitation use, and resend operations.
- Sanitize logs and exclude credentials, tokens, medical data, payment
  details, and unnecessary personal data.
- Audit protected roster, payment, capacity, substitution, ticket, and recovery
  actions.
- Enforce least privilege and prohibit anonymous direct writes to canonical
  domain tables.
- Do not expose canonical internal database identifiers in public contracts.
- Define RLS and SQL only in a later approved implementation specification.

## 14. Acceptance criteria

Each criterion records one of `PASS`, `FAIL`, `BLOCKED`, or `NOT_RUN`.

### SPEC-030-AC001

- **Precondition:** Owner catalog and seed text are available.
- **Artifact:** Section 8.1 catalog tables and read-only seed comparison.
- **Action:** Count products by block; verify unique codes, prices, team sizes,
  capacities, dates, sessions, chip flags, insurance flags, and journey values.
- **Expected result:** `13 + 7 + 8 = 28`; all 28 codes are unique; every value
  matches the owner-approved matrix; seed is not executed.
- **Evidence:** Catalog validation matrix and seed text diff.
- **Result rule:** `PASS` on complete exact match; `FAIL` on any catalog
  mismatch or duplicate; `BLOCKED` if an authority artifact is unavailable;
  otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R001-R006, R035-R038.

### SPEC-030-AC002

- **Precondition:** All catalog rows and J1-J5 definitions are available.
- **Artifact:** Product-to-journey column and journey outcome blocks.
- **Action:** Map every code to exactly one reusable journey and compare the
  expected participant, waiver, order, payment, ticket, and QR counts.
- **Expected result:** All 28 products map once; there are five business
  journeys rather than 28 implementations; outcome counts match R010-R016 and
  R029.
- **Evidence:** Product-to-journey and journey-to-entitlement matrices.
- **Result rule:** `PASS` on complete one-to-one mapping and five templates;
  `FAIL` on missing, multiple, or per-product flow; `BLOCKED` if inputs are
  unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R007, R010-R016, R029.

### SPEC-030-AC003

- **Precondition:** Actor and journey sections are complete.
- **Artifact:** Actor responsibility matrix, J1-J5, and team waiver rules.
- **Action:** Inspect who pays, participates, accepts waiver, receives tickets,
  and modifies roster for each journey.
- **Expected result:** Buyer and participant are separable; captain accepts only
  their waiver; doubles require two personal waivers; relay requires four;
  workout has no competition waiver.
- **Evidence:** Actor-to-journey responsibility matrix.
- **Result rule:** `PASS` when every responsibility is explicit and personal
  consent is preserved; `FAIL` on delegated adult waiver or implicit data
  authority; `BLOCKED` if artifacts are unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R008-R015, R023-R025, R031.

### SPEC-030-AC004

- **Precondition:** Catalog presentation contract and landing protection scope
  are available.
- **Artifact:** R003, R017, conceptual product contract, and Git diff.
- **Action:** Verify all required public fields, presentation derivation, and
  conceptual sale states; inspect scoped operation evidence for landing, React,
  CSS, copy, form, route, or asset changes attributable to SALE-1.
- **Expected result:** Catalog data can drive presentation and journey
  selection; availability and CTA derive from trusted state; landing has no
  independent price/capacity authority; this unit performed no landing write.
- **Evidence:** Field/state checklist, repository name-status, and controlled
  SALE-1 operation record. Pre-existing or external landing work is not
  attributed to this unit.
- **Result rule:** `PASS` when fields are complete and no landing operation or
  attributable diff exists; `FAIL` otherwise; `BLOCKED` if evidence or contract
  is unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R003, R017, R037.

### SPEC-030-AC005

- **Precondition:** Checkout, payment, and failure contracts are complete.
- **Artifact:** R018-R022, interfaces, and payment-related failure rows.
- **Action:** Verify full-unit price semantics and no chip/insurance surcharge;
  then walk approved, pending, rejected, invalid-signature, duplicate,
  out-of-order, incorrect-amount, incorrect-currency, and lost-return scenarios.
- **Expected result:** Backend owns price and status; published and charged
  unit prices match without extra chip/insurance fees; redirects never confirm;
  webhook signature/API verification/idempotency apply; valid tickets appear
  only after trusted confirmation and applicable registration; duplicate
  effects are absent.
- **Evidence:** Payment state and effect matrix.
- **Result rule:** `PASS` when every scenario reaches the required canonical
  outcome; `FAIL` on browser authority or duplicate effect; `BLOCKED` if a
  contract is missing; otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R004-R005, R018-R022, R028, R033-R034.

### SPEC-030-AC006

- **Precondition:** J2/J3 and roster contracts are available.
- **Artifact:** Team requirements, actor matrix, and roster failure modes.
- **Action:** Inspect provisional creation, fixed slots, invitations, incomplete
  and complete states, eligibility, resend, substitution, duplicate member,
  existing registration, waiver, ticket revocation, and audit.
- **Expected result:** All listed team cases have a state and safe recovery;
  doubles have two slots/waivers/tickets; relay has four; `REL-2H2M` preserves
  2H+2M conceptually; incomplete or waiver-pending teams have no active
  competition ticket; tickets activate only at `ELIGIBLE`.
- **Evidence:** Team lifecycle and exception matrix.
- **Result rule:** `PASS` when every case is covered without technical invention;
  `FAIL` on missing case or invalid waiver/ticket authority; `BLOCKED` when
  artifacts are unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R011-R014, R023-R025, R033.

### SPEC-030-AC007

- **Precondition:** Capacity values and capacity contract are available.
- **Artifact:** Catalog capacities, R006, R027-R028, and capacity failures.
- **Action:** Verify consumption unit by journey; inspect pre-check,
  reservation, expiration, release, late-payment, and concurrent-final-unit
  outcomes.
- **Expected result:** Initial values match the catalog; each journey consumes
  the correct unit; no silent over-sale is possible; a late confirmed payment
  preserves payment truth but issues no unavailable ticket and enters audited
  reconciliation; duration and final recovery policy remain open.
- **Evidence:** Capacity-unit and concurrency decision matrix.
- **Result rule:** `PASS` on complete deterministic coverage; `FAIL` on browser
  authority, hidden duration, or over-sale path; `BLOCKED` if inputs are
  unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R006, R027-R028, R033, R035.

### SPEC-030-AC008

- **Precondition:** Journey outcomes and ticket/QR requirements are available.
- **Artifact:** R022, R025-R030 and the journey ticket matrix.
- **Action:** Verify ticket quantity, issuance condition, opaque QR content,
  revocation, reissue, substitution, and audit for each journey.
- **Expected result:** J1=1, J2=2, J3=4, J4=1, spectator=1/unit,
  photographer=1/unit; QR contains no prohibited data.
- **Evidence:** Journey-to-ticket matrix and QR privacy checklist.
- **Result rule:** `PASS` when every quantity and QR boundary matches; `FAIL`
  otherwise; `BLOCKED` if artifacts are unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R022, R025-R030.

### SPEC-030-AC009

- **Precondition:** Three-day products and OD-020 are available.
- **Artifact:** `PUB-3D`, `FOT-3D`, R026, and open-decision table.
- **Action:** Verify three covered dates, preservation of future-date rights
  after an earlier-date use, and proposed QR status; confirm same-day re-entry
  and duplicate-use behavior remains open.
- **Expected result:** Both products cover all three dates; one credential,
  one QR, three daily rights remains `PROPOSED`; earlier use cannot invalidate
  later dates; same-day behavior and implementation are blocked pending OD-020
  without blocking this draft.
- **Evidence:** Three-day entitlement decision matrix.
- **Result rule:** `PASS` when coverage and proposal status are explicit;
  `FAIL` on future-date invalidation or hidden final design; `BLOCKED` if
  artifacts are unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R016, R026, R029-R030, R035.

### SPEC-030-AC010

- **Precondition:** Security/privacy contract and public interfaces are
  available.
- **Artifact:** R009, R024, R030-R032, interfaces, and security section.
- **Action:** Inspect data minimization, actor separation, waiver authority,
  medical access, secrets, public responses, token entropy, rate limits, logs,
  audit, least privilege, anonymous writes, and internal IDs.
- **Expected result:** Every boundary is explicit; no secret, token, medical,
  financial, internal ID, or unnecessary personal value is exposed.
- **Evidence:** Privacy/security checklist and documentation secret scan.
- **Result rule:** `PASS` when all controls are present and scans are clean;
  `FAIL` on exposure or authority violation; `BLOCKED` when artifacts are
  unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R008-R009, R024, R030-R032, R037.

### SPEC-030-AC011

- **Precondition:** All section 12 failure rows are available.
- **Artifact:** Section 12 persistent failure inventory and related
  requirements.
- **Action:** Map every required failure from SALE-1 to a safe outcome,
  canonical-state rule, recovery/escalation, and audit expectation.
- **Expected result:** Every required failure appears exactly once with no
  invented payment/ticket state; email failure preserves confirmed payment;
  manual recovery is authorized and audited.
- **Evidence:** Failure-to-recovery matrix.
- **Result rule:** `PASS` with complete safe mappings; `FAIL` for a missing or
  unsafe path; `BLOCKED` if authority is missing; otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R021-R025, R028, R033-R034.

### SPEC-030-AC012

- **Precondition:** Seed findings, open decisions, non-goals, and Git diff are
  available.
- **Artifact:** CAT-SEED-001/002/003, section 17, section 5, and repository
  diff.
- **Action:** Verify all three seed findings and every required open decision;
  inspect classification and blocker columns; verify seed, landing, code, and
  external resources were untouched by this controlled unit.
- **Expected result:** 29-vs-28, Saturday-label, and seed-header scope issues
  are recorded; no open decision is silently resolved; only the spec index,
  workspace status, and this draft change; seed remains byte-identical and no
  seed-execution command occurred in the SALE-1 operation record.
- **Evidence:** Decision inventory, seed comparison, seed blob identity,
  scoped Git diff, and controlled SALE-1 operation record. Git alone is not
  treated as historical proof of non-execution.
- **Result rule:** `PASS` when inventory and scope are complete; `FAIL` on a
  missing decision, seed execution/modification, or protected-file change;
  `BLOCKED` if evidence is unavailable; otherwise `NOT_RUN`.
- **Result:** PASS.
- **Requirements:** R001-R002, R006, R035-R038.

## 15. Validation plan

Documentary validation:

1. Count catalog rows and unique codes.
2. Compare every row with the owner-approved matrix and the read-only seed.
3. Verify prices in cents, unit-of-sale semantics, capacities, dates, sessions,
   chip, insurance, kind, and journey.
4. Verify every code maps to exactly one of J1-J5.
5. Verify actor, waiver, roster, ticket, QR, capacity, payment, privacy, and
   failure matrices.
6. Verify every requirement maps to one or more acceptance criteria.
7. Verify every acceptance criterion has precondition, artifact, action,
   expected result, evidence, result rule, and requirements.
8. Verify decisions remain classified and no implementation/production choice
   is invented.
9. Verify compatibility with SPEC-001 and SPEC-011.
10. Verify Git scope, seed blob identity, and that SALE-1 introduced no landing
    operation or attributable landing diff.
11. Verify no SQL, seed, build, deployment, MCP write, or external-resource
    action occurred.

Runtime, browser, payment, and physical tests are `NOT_RUN` because this unit
creates documentation only.

### 15.1 Documentary evidence record

Phase B started from commit `0765365`. The seed blob at that baseline and at
documentary review is
`20d73e626981604da65e1ea34dc1a03b37f0845f`. The controlled unit used the seed
only as a read-only text source and issued no seed-execution command.

| AC | Reproducible evidence | Documentary result |
|---|---|---|
| AC001 | Section 8.1 contains 13 COMPITE, 7 EXPERIENCE, 8 ASISTE rows; section 11 compares the seed | PASS |
| AC002 | Sections 8.1 and 8.3 map every product to J1-J5; no sixth or product-specific journey exists | PASS |
| AC003 | Sections 8.4 and 8.5 separate payer, participant, waiver, ticket, and roster authority | PASS |
| AC004 | Sections 8.2 and 10 define all fields/states; Phase B scoped paths contain no landing file | PASS |
| AC005 | R004-R005 and R018-R022 plus section 12 cover trusted unit price, no surcharge, signature, API, idempotency, and payment outcomes | PASS |
| AC006 | Sections 8.3 and 8.5 define J2/J3 slots, waivers, states, substitutions, and ticket activation | PASS |
| AC007 | R006 and R027-R028 plus section 12 define capacity unit, reservation, expiry, concurrency, and late payment | PASS |
| AC008 | R022 and R025-R030 plus sections 8.3/8.5 define quantities, activation, revocation, and opaque QR | PASS |
| AC009 | R026 and section 8.6 separate approved future-date preservation from the OD-020 proposal | PASS |
| AC010 | R031-R032 and section 13 define the privacy/security checklist | PASS |
| AC011 | Section 12 is the persistent failure-to-recovery inventory | PASS |
| AC012 | Sections 5, 11, and 17; baseline `0765365`; unchanged seed blob; scoped Phase B path inventory | PASS |

The final commit validation must reproduce exactly these Phase B paths:

```text
docs/specs/SPEC-030-PUBLIC-SALES-CATALOG-AND-REGISTRATION-JOURNEYS.md
docs/specs/README.md
WORKSPACE_STATUS.md
```

## 16. Traceability

Status vocabulary:

- `APPROVED`: Explicit owner decision or approved parent contract.
- `PROPOSED`: Documented design awaiting owner approval.
- `OPEN`: Decision not yet selected.
- `CONTRADICTORY`: Source artifact conflicts with current authority.

| Requirement | Authority source | Product codes | Journey | AC | Open decision | Implementation impact | Status |
|---|---|---|---|---|---|---|---|
| R001-R002 | SALE-1 catalog decision | All 28 | J1-J5 | AC001, AC012 | None | Catalog loading and launch gating | APPROVED |
| R003 | SALE-1 public catalog rule; docs/01-03 | All 28 | J1-J5 | AC004 | Visual copy outside scope; low-stock threshold OD-024 | Data-driven presentation | APPROVED |
| R004-R005 | SALE-1 price decision | All 28 | J1-J5 | AC001, AC005 | Discounts/coupons/MSI OD-012-014 | Trusted pricing | APPROVED |
| R006 | SALE-1 capacity decision | All 28 | J1-J5 | AC001, AC007, AC012 | Reservation duration OD-010 | Initial configuration | APPROVED |
| R007 | SALE-1 reusable journey decision | All 28 | J1-J5 | AC002 | None | Five reusable orchestration paths | APPROVED |
| R008-R009 | SALE-1 actors; docs/03 J1-J4 | All 28 | J1-J5 | AC003, AC010 | Buyer distinction OD-003; minors OD-006 | Identity and authorization | APPROVED |
| R010 | SALE-1 J1 | IND-*, HALF-IND-* | J1 | AC002-AC003 | OD-003-006 | Individual registration | APPROVED |
| R011-R012 | SALE-1 J2; docs/03 J4 | DOB-*, HALF-DOB-* | J2 | AC002-AC003, AC006 | OD-008-009, OD-011 | Pair roster | APPROVED |
| R013-R014 | SALE-1 J3 | REL-* | J3 | AC002-AC003, AC006 | Technical composition validation | Relay roster | APPROVED |
| R015 | SALE-1 J4; seed | WOD-* | J4 | AC002-AC003 | Minimum data OD-004 | Workout registration | APPROVED |
| R016 | SALE-1 J5 | PUB-*, FOT-* | J5 | AC002, AC009 | OD-001-002, OD-020-021 | Access/accreditation | APPROVED |
| R017 | SALE-1 public experience | All 28 | J1-J5 | AC004 | Final copy/design outside scope | Catalog query contract | APPROVED |
| R018-R022 | SALE-1 checkout; SPEC-001 R013-R014 | All 28 | J1-J5 | AC005, AC008 | OD-014-017, OD-023 | Checkout/payment/ticket orchestration | APPROVED |
| R023-R025 | SALE-1 team roster | DOB-*, HALF-DOB-*, REL-* | J2-J3 | AC003, AC006, AC008, AC011 | OD-008-011 | Invitations/substitution/audit | APPROVED |
| R026 | SALE-1 three-day access | PUB-3D, FOT-3D | J5 | AC009 | OD-020 | Preserve all covered dates and future-date access | APPROVED |
| Three-day design proposal (non-requirement) | SALE-1 recommended proposal | PUB-3D, FOT-3D | J5 | AC009 | OD-020 | One credential/QR and date-specific-right mechanism | PROPOSED |
| R027-R028 | SALE-1 capacity contract; docs/04 | All 28 | J1-J5 | AC005, AC007, AC011 | OD-010 | Reservation/concurrency | APPROVED |
| R029-R030 | SALE-1 tickets/QR; SPEC-001 R010-R016 | All 28 | J1-J5 | AC002, AC008-AC010 | OD-020 | Ticket issuance and QR | APPROVED |
| R031-R032 | SALE-1 privacy/security; SPEC-001 | All 28 | J1-J5 | AC010 | Data minima OD-004 | Privacy/security design | APPROVED |
| R033-R034 | SALE-1 failure list; SPEC-000 R024 | All 28 | J1-J5 | AC005-AC006, AC011 | Support OD-018 | Recovery/audit | APPROVED |
| R035 | SALE-1 open-decision rule | All 28 | J1-J5 | AC009-AC010, AC012 | OD-001-024 | Gated implementation/production | APPROVED |
| R036, R038 | SALE-1 seed findings; seed text | DOB-SAB-* and all rows | J2/all | AC001, AC012 | Saturday schedule OD-022 | Seed/public schedule correction | CONTRADICTORY |
| R037 | SALE-1 absolute protection | All 28 | J1-J5 | AC004, AC010, AC012 | None | Documentation-only unit | APPROVED |

## 17. Open decisions

| ID | Decision | Status | Classification | Impact | Blocks spec | Blocks implementation | Blocks production | Responsible |
|---|---|---|---|---|---|---|---|---|
| OD-001 | Purchase of multiple spectator/press units | OPEN | IMPLEMENTATION_BLOCKER | Order quantity and entitlement issuance | No | Yes for multi-unit | Yes if enabled | Project Owner |
| OD-002 | Mixed-product cart | OPEN | IMPLEMENTATION_BLOCKER | Order composition and checkout UX | No | Yes for cart | No if disabled | Project Owner |
| OD-003 | Buyer different from participant | OPEN | IMPLEMENTATION_BLOCKER | Consent, invitation, communication | No | Yes for third-party path | No if disabled | Project Owner |
| OD-004 | Minimum data per journey | OPEN | IMPLEMENTATION_BLOCKER | Forms, privacy, validation | No | Yes | Yes | Project Owner |
| OD-005 | Waiver text and version | OPEN | PRODUCTION_BLOCKER | Legal acceptance and eligibility | No | No for shell | Yes | Project Owner / Legal |
| OD-006 | Minor participants | OPEN | PRODUCTION_BLOCKER | Guardian consent and eligibility | No | Yes for minors | Yes for minors | Project Owner / Legal |
| OD-007 | Refund policy | OPEN | PRODUCTION_BLOCKER | Checkout disclosure and finance actions | No | No for catalog | Yes | Project Owner |
| OD-008 | Substitution policy | OPEN | IMPLEMENTATION_BLOCKER | Roster and ticket revocation | No | Yes | Yes for substitutions | Project Owner |
| OD-009 | Roster-change deadline | OPEN | PRODUCTION_BLOCKER | Team operations | No | No for base roster | Yes | Project Owner |
| OD-010 | Capacity reservation duration and final late-payment recovery policy | OPEN | IMPLEMENTATION_BLOCKER | Expiration, reconciliation, refund, and authorized capacity recovery | No | Yes | Yes | Project Owner |
| OD-011 | Invitation duration | OPEN | IMPLEMENTATION_BLOCKER | Invite expiration and resend | No | Yes | Yes | Project Owner |
| OD-012 | Discounts | OPEN | NON_BLOCKING | Price adjustment policy | No | No if disabled | No if disabled | Project Owner |
| OD-013 | Coupons | OPEN | NON_BLOCKING | Promotion validation | No | No if disabled | No if disabled | Project Owner |
| OD-014 | MSI | OPEN | PRODUCTION_BLOCKER | Mercado Pago configuration/disclosure | No | No for catalog | Yes for MSI | Project Owner |
| OD-015 | Cash payments | OPEN | PRODUCTION_BLOCKER | Voucher lifecycle and capacity | No | Yes for cash path | Yes for cash | Project Owner |
| OD-016 | Return domain and URLs | OPEN | IMPLEMENTATION_BLOCKER | Checkout Pro return configuration | No | Yes | Yes | Project Owner |
| OD-017 | Transactional email provider | OPEN | IMPLEMENTATION_BLOCKER | Invitations, tickets, recovery | No | Yes for delivery | Yes | Project Owner |
| OD-018 | Customer support and escalation model | OPEN | PRODUCTION_BLOCKER | Manual recovery ownership | No | No for core contracts | Yes | Project Owner |
| OD-019 | Folio format | OPEN | IMPLEMENTATION_BLOCKER | Public reference and search | No | Yes | Yes | Project Owner |
| OD-020 | Three-day pass QR, daily-right mechanism, same-day re-entry, and duplicate-use policy | PROPOSED | IMPLEMENTATION_BLOCKER | Multi-day validation and duplication | No | Yes | Yes | Project Owner |
| OD-021 | Photographer accreditation requirements | OPEN | IMPLEMENTATION_BLOCKER | Press validation and badge behavior | No | Yes | Yes | Project Owner |
| OD-022 | Final public Saturday schedule label | OPEN | PRODUCTION_BLOCKER | Public schedule and seed label | No | No for catalog | Yes | Project Owner |
| OD-023 | Sales opening date and time | OPEN | PRODUCTION_BLOCKER | Sale state transition | No | No for catalog | Yes | Project Owner |
| OD-024 | Low-availability threshold | OPEN | IMPLEMENTATION_BLOCKER | Transition to `LOW_AVAILABILITY` | No | Yes for low-stock signal | No if state is disabled | Project Owner |

No open decision blocks review of this specification. Implementation and
production MUST remain gated by the applicable decisions above.

## 18. Change log

| Version | Date | Status | Actor | Reason |
|---|---|---|---|---|
| 0.1.0 | 2026-07-23 | DRAFT | Cursor, authorized by Project Owner | Define the approved 28-product public sales catalog, reusable registration journeys, actors, capacity, payment boundaries, tickets, QR, privacy, failures, seed inconsistencies, and open decisions without implementing code or modifying the landing or seed. |
| 0.1.0 | 2026-07-23 | DRAFT | Cursor, authorized by Project Owner | Formal post-draft review result `READY_FOR_APPROVAL`; no automatic approval and no implementation or production authority. |

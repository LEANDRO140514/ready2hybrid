---
id: SPEC-032
title: Minimal Public Sales Data Model and Transaction Integrity
status: APPROVED
version: 0.4.0
phase: RELAUNCH-V0-4-COMMERCIAL-CONTRACT
created_at: 2026-08-22
approved_at: 2026-08-23
approved_by: Project Owner
approval_basis: Explicit human approval ("APRUEBO SPEC-030, SPEC-031 Y SPEC-032 v0.4.0")
supersedes:
  - SPEC-032 v0.3.0
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-030 v0.4.0
  - SPEC-031 v0.4.0
compatible_with:
  - SPEC-011 v0.1.0
  - SPEC-040 v0.1.1
---

# SPEC-032 v0.4.0 — Minimal Public Sales Data Model and Transaction Integrity

```text
STATUS: APPROVED — Effective logical sales-model contract
Approved: 2026-08-23 by Project Owner
Effective: YES
Supersedes: SPEC-032 v0.3.0
Does NOT authorize SQL, migrations, seeds, CHECK-constraint edits, or
SALES_STATUS=OPEN.
Physical DDL is out of scope.
SALES_STATUS remains CLOSED / PRÓXIMAMENTE.
```

## 1. Purpose

Adjust the logical sales model so it can represent SPEC-030 v0.4.0:

- public identity HYBRID EXPERIENCE and venue Club Cumbres;
- event 13–15 November 2026;
- 23 sellable products plus 2 `RETIRED_PRODUCT` plus 3
  `SUPERSEDED_SCHEDULE_VARIANT` identities (no DELETE);
- Saturday `FULL_DAY` persisted as `ALL_DAY`;
- PUB/FOT session NULL / NOT_APPLICABLE;
- three-day sellable entitlements;
- calendar-only price;
- no fixed commercial category cap as sales authority;
- organizer `SOLD_OUT`;
- payment-lifecycle holds distinct from commercial caps;
- prize **policy** without requiring prize tables in this unit.

## 2. Authority sources

1. Project Owner authorization `RELAUNCH v0.4.0 DRAFT` (2026-08-22).
2. SPEC-030 v0.4.0 APPROVED and SPEC-031 v0.4.0 APPROVED.
3. SPEC-032 v0.3.0 (now SUPERSEDED by this version; archived).
4. SPEC-000 v0.2.0, SPEC-001 v0.1.0.
5. SPEC-040 v0.1.1 (payment-pending expiry / holds).

Applied migrations `0001`–`0010` and historical seeds remain physical facts.
This specification MUST NOT rewrite them.

## 3. Context

Main catalog is still a 28-row October seed at runtime. The logical
contract is 23 sellable + 2 retired + 3 superseded, November dates, ALL_DAY /
NULL sessions, and calendar-only price. Bridging those facts requires a
**future new migration**, not a seed rewrite, and not this unit.

Current physical CHECK (historical fact, not modified here):

```text
session IS NULL OR session IN ('AM', 'PM')
```

v0.4.0 logical contract requires NULL, AM, PM, and ALL_DAY. Aligning the
CHECK is a later implementation/migration unit.

## 4. Scope

- `Event` public identity, venue, dates, closed sales;
- `EventDaySession` commercial occupancy versus operational schedule;
- `Product` sellable / retired / superseded;
- session tokens ALL_DAY and NULL;
- commercial vs operational capacity concepts;
- payment-lifecycle reservation vs commercial cap;
- integrity of orders, registrations, payments, tickets/QR, audit;
- compatibility strategy: historical columns MAY remain.

## 5. Non-goals

No ALTER statements; no edit of `0018`, `0019`, or `0017`; no destructive
DELETE of product, order, payment, registration, or ticket rows; no prize or
results tables required; no Simulacro Pro entity; no `SALES_STATUS=OPEN`;
no heat-schedule schema.

## 6. Definitions

Carry-forward of SPEC-032 v0.3.0 plus SPEC-030 v0.4.0 terms.

- **Historical storage:** A column or row kept for compatibility/audit that
  MUST NOT control commercial price or published caps.
- **Commercial availability state:** Organizer-controlled sellability,
  including `SOLD_OUT`, distinct from payment hold state. MAY apply at
  product/SKU, category or commercial offer, or event.
- **CONFIRMED SALES / REGISTRATION COUNT:** Server-authoritative paid /
  completed registrations only. Distinct from `PAYMENT_PENDING` and payment-
  lifecycle holds.
- **PENDING CHECKOUT / PAYMENT EXPOSURE:** Optional operational count of
  pending checkouts, `PAYMENT_PENDING` orders, and/or payment-lifecycle
  holds. MUST NOT be added to the confirmed registration count before
  server-side confirmation.

## 7. Invariants and requirements

Carry-forward: R001–R010, R014–R050 except where replaced below, including
money, snapshot immutability, concurrency fail-closed, RLS-deny-by-default,
and audit invariants.

**Explicitly NOT carried forward as commercial authority:** R201–R207 quota /
cupo-SOLD_OUT rules from v0.2.0 Sales Go-Live overlay (holding evidence).
Those identifiers, if referenced, MUST be read as REPLACED by R401–R404
below.

### SPEC-032-R011 (REPLACED overlay)

The logical `Event` entity MUST own:

- public display name **HYBRID EXPERIENCE**;
- internal code MAY be `HEX-2026`;
- timezone `America/Merida`;
- `starts_on = 2026-11-13`, `ends_on = 2026-11-15`;
- public venue **Club Cumbres, Mérida, Yucatán** without a fabricated street
  address;
- lifecycle and sales window per SPEC-030 v0.4.0;
- public state remaining CLOSED / PRÓXIMAMENTE.

`SALES_STATUS` is not opened by this spec. An internal database name MAY
remain if it is not presented as the public commercial name.

### SPEC-032-R012 (REPLACED)

The logical `EventDaySession` entity MUST represent date/session validity,
public label, ordering, and **commercial program** occupancy for:

| Date | Session class | Occupying sellable competitive/experience products |
|---|---|---|
| 2026-11-13 | PM | `DOB-VIE-MM`, `IND-H`, `IND-M` |
| 2026-11-14 | FULL_DAY (persist ALL_DAY) | `DOB-SAB-HH`, `DOB-SAB-MH`, HALF-*, WOD-* |
| 2026-11-15 | AM | `REL-4H`, `REL-4M`, `REL-2H2M` |

ASISTE daily rows bind to the same dates with session NULL. Three-day products
span all three dates with session NULL.

`FULL_DAY` MUST NOT be stored or interpreted as `AM` or `PM`. Persistence
token MUST be `ALL_DAY` (OD-RELAUNCH-004 RESOLVED).

This occupancy is COMMERCIAL PROGRAM. The model MUST NOT require final heat
counts, heat times, lanes, stations, or award-ceremony timestamps as sales
preconditions (SPEC-030-R405).

### SPEC-032-R013 (REPLACED)

The logical `Product` entity MUST configure all 23 sellable unique products
with block, journey, composition, team size, staged integer prices, MXN,
benefits, schedule/validity, sale state, visibility, and public order.

It MUST retain:

- `IND-PRO-H`, `IND-PRO-M` as `RETIRED_PRODUCT`;
- `DOB-VIE-HH`, `DOB-VIE-MH`, `DOB-SAB-MM` as
  `SUPERSEDED_SCHEDULE_VARIANT`.

It MUST NOT require physical DELETE of those five rows. It MUST NOT assign
them an active purchase journey. A single undifferentiated
`RETIRED_FROM_SALE` business meaning for all five is forbidden.

The product model MAY store operational or historical numeric fields
(`cupo`, quota shares, high-water). Those fields MUST NOT be commercial
price authority or automatic `SOLD_OUT` authority (R401–R403).

### SPEC-032-R301 (REPLACED)

Physical session tokens MUST accept `NULL`, `AM`, `PM`, and `ALL_DAY`.
Domain `FULL_DAY` MUST persist as `ALL_DAY`. UI `DIA` MUST NOT persist.
Adding `ALL_DAY` to the historical CHECK requires a later approved
migration. This specification MUST NOT execute it.

### SPEC-032-R302 (UNCHANGED)

A future implementation MUST apply catalog/date/session changes through a
**new** migration on already-seeded Main. Historical applied artifacts
(`0002` seed text, `0004` remote catalog, applied 0002 CHECK) MUST remain
byte-historical. `0018` remains unapplied and MUST NOT be silently rewritten
in this spec unit. Unapplied `0019` WIP MUST be re-reviewed against v0.4.0
before any apply because it still encodes quota helpers.

### SPEC-032-R401 (NEW)

The logical model MUST distinguish:

| Concept | Role |
|---|---|
| CONFIRMED SALES / REGISTRATION COUNT | MUST exist. Derived only from server-authoritative payment / registration state. Client redirect MUST NOT count. `PAYMENT_PENDING` MUST NOT count. Expired or abandoned checkout MUST NOT count. |
| PENDING CHECKOUT / PAYMENT EXPOSURE | MAY exist (`PAYMENT_PENDING`, payment-lifecycle holds, pending checkout). MUST NOT inflate the confirmed registration count before server-side confirmation. |
| DEMAND VISIBILITY | SHOULD exist by product/category/day/format. MUST be able to distinguish confirmed demand from pending payment exposure, at least conceptually. |
| OPERATIONAL CAPACITY | MAY exist and MAY be adjusted |
| COMMERCIAL CAP | MUST NOT be sales authority at sales open |
| PAYMENT LIFECYCLE HOLD | MAY exist for checkout/payment expiry |
| COMMERCIAL AVAILABILITY / SOLD_OUT | Organizer-controlled; resolvable for a requested SKU |

The model MUST NOT treat “capacity does not exist”. It MUST NOT publish a
fixed category cap as a commercial promise at sales open. This requirement
does not prescribe a specific table or column.

### SPEC-032-R402 (NEW)

Stage quota 30/45/25, quantity-driven stage progression, and high-water-mark
price advancement MUST NOT be normative commercial authority. Existing
columns implementing those ideas MAY remain as HISTORICAL_STORAGE until an
implementation plan removes or ignores them.

### SPEC-032-R403 (NEW)

`SOLD_OUT` MUST be an explicit organizer-controlled commercial availability
state. The logical model MUST be able to represent or resolve explicit
commercial unavailability applicable at:

- product / SKU;
- category or commercial offer;
- event.

Exact physical representation is not decided here. It MAY later use direct
state, parent-level state, resolved/inherited availability, or another
approved implementation, provided the API can determine whether an explicit
organizer `SOLD_OUT` applies to the requested SKU.

Reaching a historical `cupo` MUST NOT by itself force `SOLD_OUT`. Quota
30/45/25, HWM, number sold, payment-lifecycle holds, and `PAYMENT_PENDING`
counts MUST NOT independently create that state. This requirement does not
prescribe SQL.

### SPEC-032-R404 (NEW)

Order, payment, registration, ticket, and QR lifecycle integrity from v0.3.0
/ v0.2.0 MUST remain: integer MXN cents, immutable commercial snapshots once
stamped, concurrency fail-closed, auditability, and server-authoritative
payment state. Client redirect MUST NOT persist `PAID`.

### SPEC-032-R405 (NEW)

This specification MUST NOT require prize, podium, or results tables in order
for SPEC-030 prize **policy** to be contractual. A later authorized spec in
the 070 range MAY model results. Historical identity rows MUST remain
joinable to past orders.

### SPEC-032-R406 (NEW)

Daily PUB/FOT products MUST store day date and session NULL. Three-day
products MUST store a three-day entitlement spanning 13–15 November with
session NULL. Access on an earlier covered date MUST NOT invalidate later
covered dates.

## 8. Functional requirements

Logical entities and TX boundaries of v0.3.0 remain except commercial-cap
overlays replaced above.

Saturday `FULL_DAY` products MUST be associated to 2026-11-14 without forcing
AM-only or PM-only occupancy.

Visible-by-day listing MUST NOT hide other Saturday commercial-program
products solely because persistence historically used AM.

## 9. Non-functional requirements

Integer cents, MXN, snapshot immutability, and concurrency fail-closed carry
forward. Demand visibility SHOULD be queryable by organizers. Prize schema
quality attributes are not added.

## 10. Interfaces and contracts

Logical entity map unchanged except Event identity/venue/dates, EventDaySession
ALL_DAY/NULL, Product classification split, and commercial-cap demotion.

## 11. Failure modes

| Failure | Response |
|---|---|
| Persist FULL_DAY as AM or PM | Forbidden |
| DELETE of retired or superseded identifiers to “match 23” | Forbidden |
| Rewrite applied 0004 / seed 0002 in place | Forbidden |
| Use cupo/HWM/quota columns as price or auto-SOLD_OUT authority | Forbidden |
| Treat payment hold as published commercial cap | Forbidden |
| Add `PAYMENT_PENDING`, holds, redirects, or abandoned checkouts to confirmed registration count | Forbidden |
| Require prize tables to document prize policy | Forbidden by this specification |
| Open sales via model default | Forbidden |

## 12. Security and privacy

Carry-forward. Retirement or supersession MUST NOT erase audit or historical
order rows. No new PII categories.

## 13. Acceptance criteria

Defined, not executed; no SQL:

### SPEC-032-AC301 (CARRIED overlay)

Logical event days = three dates 13–15 Nov 2026 (R011, R012). Public name
HYBRID EXPERIENCE; venue Club Cumbres, Mérida, Yucatán (R011).

### SPEC-032-AC302 (REPLACED)

Vendible product identity = 8 COMPITE + 7 EXPERIENCE + 8 ASISTE; two
`RETIRED_PRODUCT` and three `SUPERSEDED_SCHEDULE_VARIANT` named and not
sellable (R013, SPEC-030-R401/R402).

### SPEC-032-AC303 (overlay)

Saturday FULL_DAY occupancy includes listed COMPITE/EXPERIENCE products;
persistence token ALL_DAY; FULL_DAY ≠ AM and ≠ PM (R012, R301).

### SPEC-032-AC304 (REPLACED)

No prize tables and no Simulacro Pro entity are required by this specification
(R405, SPEC-030-R302). Prize **policy** still exists in SPEC-030.

### SPEC-032-AC401 (NEW)

**Purpose:** PUB/FOT session NULL; 3-day span sellable.

**Requirements:** R012, R406.

**Pass (contract):** Daily ASISTE session NULL; 3-day covers 13–15 Nov;
session NULL.

### SPEC-032-AC402 (NEW)

**Purpose:** Capacity concepts split; confirmed vs pending; availability scope.

**Requirements:** R401–R404.

**Pass (contract):** CONFIRMED SALES / REGISTRATION COUNT required and
distinct from `PAYMENT_PENDING` / payment-lifecycle holds / pending
checkout; commercial cap not sales authority; organizer `SOLD_OUT`
resolvable at SKU, category/offer, or event; payment holds allowed;
order/payment/ticket integrity preserved.

## 14. Validation plan

Documentary. No SQL execution. No migration apply.

## 15. Traceability

| Requirement | Source | This unit | State |
|---|---|---|---|
| R011–R013, R301–R302, R401–R406 | SPEC-030 v0.4.0 | none | APPROVED |
| Other R001–R050 money/audit/concurrency | v0.3.0 / v0.2.0 | none | CARRIED_FORWARD |
| v0.2.0 R201–R207 quota overlay | holding 0C | REPLACED by R401–R403 | SUPERSEDED_OVERLAY |

## 16. Open decisions

Operational TBDs from SPEC-030 v0.4.0 (heats, ceremony, Relay sponsor
prize, operational capacity plan) remain open and non-blocking.

Physical representation of `RETIRED_PRODUCT` vs
`SUPERSEDED_SCHEDULE_VARIANT` (flag, state, table) is an implementation
choice, provided checkout ineligibility and no DELETE hold.

## 17. Change log

| Version | Date | Status | Actor | Reason |
|---|---|---|---|---|
| 0.4.0 | 2026-08-22 | DRAFT | Cursor, authorized by Project Owner | Logical model: identity/venue, ALL_DAY closed, PUB/FOT NULL, 3-day sellable, retired vs superseded, demote commercial cap/quota/HWM, manual SOLD_OUT, hold vs cap, prize policy without prize tables. |
| 0.4.0 | 2026-08-23 | DRAFT | Cursor, R1 independent-review correction | Confirmed vs pending counts; organizer SOLD_OUT scope at SKU / category-offer / event. Product authority unchanged. Still DRAFT. |
| 0.4.0 | 2026-08-23 | APPROVED | Project Owner | Explicit human approval: "APRUEBO SPEC-030, SPEC-031 Y SPEC-032 v0.4.0". Effective logical sales-model contract. Does not authorize SQL, migrations, or SALES_STATUS=OPEN. |

### Change impact (SPEC-000)

- **Reason:** Logical model still treats quota/cupo/HWM and five-code
  retirement as commercial truth.
- **Affected specs:** SPEC-032; depends on SPEC-030/031 v0.4.0.
- **Implementation/migration impact:** A later authorized unit MAY add a new
  migration to extend session CHECK, update dates/sessions, set eligibility
  flags, and ignore quota columns. Historical columns MAY remain. Not
  executed here.
- **Security/privacy:** Snapshot immutability and audit retained.
- **Rollback:** SPEC-032 v0.3.0 is SUPERSEDED and preserved byte-identical at
  `docs/specs/archive/SPEC-032-MINIMAL-SALES-DATA-MODEL-AND-TRANSACTION-INTEGRITY-v0.3.0.md`.
  Restoring v0.3.0 as effective would require a new human-authorized
  governance unit. This approval does not authorize SQL, migrations, or
  `SALES_STATUS=OPEN`.

## Appendix B.3 replacement (logical identity)

| Block | Sellable count | Sellable codes |
|---|---:|---|
| COMPITE | 8 | `DOB-VIE-MM`, `DOB-SAB-HH`, `DOB-SAB-MH`, `REL-4H`, `REL-4M`, `REL-2H2M`, `IND-H`, `IND-M` |
| EXPERIENCE | 7 | `HALF-IND-M`, `HALF-IND-H`, `HALF-DOB-MM`, `HALF-DOB-HH`, `HALF-DOB-MH`, `WOD-M`, `WOD-H` |
| ASISTE | 8 | `PUB-VIE`, `PUB-SAB`, `PUB-DOM`, `PUB-3D`, `FOT-VIE`, `FOT-SAB`, `FOT-DOM`, `FOT-3D` |
| **Sellable total** | **23** | **`8 + 7 + 8`** |

`RETIRED_PRODUCT` (not in sellable total): `IND-PRO-H`, `IND-PRO-M`.

`SUPERSEDED_SCHEDULE_VARIANT` (not in sellable total): `DOB-VIE-HH`,
`DOB-VIE-MH`, `DOB-SAB-MM`.

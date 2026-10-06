---
id: SPEC-030
title: Public Sales Catalog and Registration Journeys
status: APPROVED
version: 0.4.0
phase: RELAUNCH-V0-4-COMMERCIAL-CONTRACT
created_at: 2026-08-22
approved_at: 2026-08-23
approved_by: Project Owner
approval_basis: Explicit human approval ("APRUEBO SPEC-030, SPEC-031 Y SPEC-032 v0.4.0")
supersedes:
  - SPEC-030 v0.3.0
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-011 v0.1.0
compatible_with:
  - SPEC-040 v0.1.1
  - SPEC-031 v0.4.0
  - SPEC-032 v0.4.0
---

# SPEC-030 v0.4.0 — Public Sales Catalog and Registration Journeys

```text
STATUS: APPROVED — Effective commercial contract
Approved: 2026-08-23 by Project Owner
Effective: YES
Supersedes: SPEC-030 v0.3.0
This approval does NOT authorize code, SQL, migrations, seeds, bundle regen,
Main, landing writes, InsForge, Mercado Pago, Clip, Openpay, PayPal,
secrets, deploy, payments, commit, push, or SALES_STATUS=OPEN.
SALES_STATUS remains CLOSED / PRÓXIMAMENTE.
```

## 1. Purpose

Propose a material correction of the public-sales commercial contract so it
matches current Project Owner authority for **HYBRID EXPERIENCE** at Club
Cumbres, Mérida, Yucatán, 13–15 November 2026.

This version reconciles:

1. two genuinely retired products versus three superseded schedule variants;
2. public display name and venue;
3. PUB/FOT day-access and three-day pass enablement;
4. published prize policy;
5. calendar-only price stages;
6. no fixed published category cap as sales authority;
7. organizer-controlled `SOLD_OUT`;
8. commercial program versus operational heat schedule.

Unchanged payment, QR, privacy, webhook, and InsForge-authority obligations
from prior approved versions are carried forward by identifier
(SPEC-000-R026).

## 2. Authority sources

1. Explicit Project Owner authorization of unit
   `RELAUNCH v0.4.0 DRAFT` dated 2026-08-22 America/Merida (this document’s
   product instruction).
2. Landing Master `hybrid-event-landing` `main` @ `5fc0acb` (read-only
   commercial source; not Ready2Hybrid implementation authority). Landing
   implementation drift is follow-up, not this contract’s authority.
3. SPEC-030 v0.3.0 `APPROVED` (now SUPERSEDED by this version; archived).
4. SPEC-000 v0.2.0, SPEC-001 v0.1.0, SPEC-011 v0.1.0.
5. `CURSOR_START_PROMPT.md`, `MANIFEST.md`, `WORKSPACE_STATUS.md`.
6. `docs/00_CICLO_DEL_EVENTO.md` through `docs/05_ANEXO_PLAN_TECNICO.md`.

### Authority conflict recorded, not silently resolved

`docs/02` and `WORKSPACE_STATUS.md` may still narrate October 2026. Those
files are **not** modified by this unit. Explicit current Project Owner
decisions in this specification’s instruction supersede stale documentary calendars
for the public-sales contract (SPEC-000 hierarchy: human project authority
may change product). A later documentary unit MUST migrate stale `docs/02`.
This specification is **not** `BLOCKED_BY_AUTHORITY_CONFLICT`.

`docs/04` row 6 (“48 h before event”) remains stale for this edition.
R201/R202 remain the sales-close authority. This unit does not modify
`docs/04`.

## 3. Context

```text
Internal code: HEX-2026
Public display name: HYBRID EXPERIENCE
Venue (public): Club Cumbres, Mérida, Yucatán
Timezone: America/Merida
Starts: 2026-11-13
Ends: 2026-11-15
SALES_STATUS: CLOSED / PRÓXIMAMENTE
This specification MUST NOT open sales.
```

Catalog:

```text
COMPITE:     8
EXPERIENCE:  7
ASISTE:      8
SELLABLE:   23
RETIRED_PRODUCT: 2 (IND-PRO-H, IND-PRO-M)
SUPERSEDED_SCHEDULE_VARIANT: 3 (DOB-VIE-HH, DOB-VIE-MH, DOB-SAB-MM)
HISTORICAL CODE SET: 28
```

`SALES-GO-LIVE-0C-*` evidence remains valid only for the October / 28-SKU
contract. It MUST NOT be reused as validation of this version.

## 4. Scope

- public event identity, venue, dates;
- sellable catalog of 23 identities;
- historical identity classification (retired vs superseded);
- commercial/general program and its boundary versus operational schedule;
- Saturday `FULL_DAY` / persistence `ALL_DAY` / UI `DÍA`;
- PUB/FOT day access and three-day entitlements;
- price matrix and MSI eligibility;
- sales windows;
- commercial availability / manual `SOLD_OUT`;
- contract-level capacity policy (counting vs published cap);
- prize policy (cash, experience, Relay TBD);
- explicit operational TBDs.

## 5. Non-goals

This specification MUST NOT:

- reopen or rewrite archived SPEC-030/031/032 v0.3.0 bodies;
- modify `docs/00–05`, landing, SQL, migrations, seeds, RLS, bundles, or tests;
- open `SALES_STATUS`;
- invent a street address;
- freeze heats, heat times, lanes, stations, award-ceremony day/time,
  Relay sponsor prize amounts, staffing, or judges;
- require a prize/results database in this unit;
- create a Simulacro Pro product or backend;
- redesign multi-provider payments (Lane B);
- claim runtime validation.

## 6. Definitions

Carry-forward of SPEC-030 v0.3.0 definitions except where replaced below.

- **Public display name:** The commercial name shown to buyers and in public
  metadata: `HYBRID EXPERIENCE`. Distinct from internal code `HEX-2026`.
- **Sellable catalog / SELLABLE_IDENTITY:** The 23 product codes that are
  structurally part of the commercial offer. Cardinality is exactly 23. This
  is distinct from CURRENTLY_PAYABLE_CHECKOUT_ELIGIBLE.
- **CURRENTLY_PAYABLE_CHECKOUT_ELIGIBLE:** Runtime payable-checkout state for
  a sellable identity. Requires explicit `SALES_STATUS` OPEN, identity among
  the 23, not `RETIRED_PRODUCT`, not `SUPERSEDED_SCHEDULE_VARIANT`, no
  applicable explicit organizer `SOLD_OUT` or equivalent unavailability, and
  other existing security/payment/validation gates. While `SALES_STATUS` is
  CLOSED / PRÓXIMAMENTE, this set is empty for new payable checkouts.
- **RETIRED_PRODUCT:** A product removed from the current offer. Not a live
  category. MUST NOT be checkout-eligible. Identifier and history MUST remain.
- **SUPERSEDED_SCHEDULE_VARIANT:** A historical product code for a category
  that remains active under a **different** live code/day/session. MUST NOT
  be checkout-eligible. MUST NOT be described as a removed category.
- **COMMERCIAL PROGRAM:** Intended public structure of the event (day +
  general session occupancy by format). Not the final operational heat sheet.
- **TBD_OPERATIONAL_SCHEDULE:** Heat counts, exact heat times, lane/station
  allocation, award-ceremony day/time, and similar operations items deferred
  until demand is known.
- **FULL_DAY:** Domain session “día completo” for Saturday commercial program.
- **ALL_DAY:** Canonical persistence token for domain `FULL_DAY`.
- **DIA / Día completo:** UI labels only. Not persistence tokens.
- **COMMERCIAL CAP:** A fixed, published numeric category/SKU limit used as
  sales authority. This edition MUST NOT establish one at sales open.
- **OPERATIONAL CAPACITY:** Adjustable operational constraint (venue, heats,
  staffing). MAY exist. MUST NOT silently become a published commercial cap.
- **CONFIRMED SALES / REGISTRATION COUNT:** Count of only
  server-authoritatively confirmed paid/completed commercial orders that
  qualify as registrations according to the existing payment and
  registration lifecycle. A client redirect MUST NOT count. A
  `PAYMENT_PENDING` order MUST NOT count. An expired or abandoned checkout
  MUST NOT count.
- **PENDING CHECKOUT / PAYMENT EXPOSURE:** Separate operational metric that
  MAY include payment-lifecycle holds and `PAYMENT_PENDING` orders. MUST NOT
  inflate CONFIRMED SALES / REGISTRATION COUNT.
- **PAYMENT LIFECYCLE HOLD:** Temporary reservation tied to checkout/payment
  expiry (SPEC-040). Not a published category cap. Not a confirmed sale.
- **MANUAL SOLD_OUT:** Organizer-controlled commercial unavailability.
- **SPONSOR_PRIZE_TBD:** Relay prize benefit not yet a fixed cash amount.

Sale states used by this contract: `COMING_SOON`, `AVAILABLE`, `SOLD_OUT`,
`SALES_CLOSED`, `CANCELLED`. `LOW_AVAILABILITY` MUST NOT be derived from a
fixed commercial cupo. A later authorized unit MAY define an organizer
signal; this specification does not invent that threshold (OD-024 remains open and
non-blocking for this commercial correction).

## 7. Invariants and requirements

### Carry-forward (unchanged meaning)

The following v0.3.0 / v0.2.0 identifiers KEEP their meaning except where a
REPLACED row below applies:

R003–R006, R008–R025, R027–R038, R201–R202, R204, R209–R213, R218–R230,
R231–R235, R302, R305, R307.

Payment, QR, privacy, webhook, and InsForge-authority invariants
(R018–R022, R030–R032) MUST remain unchanged (SPEC-000-R026).

**Explicitly NOT carried forward as commercial authority:** R203, R205,
R207, R208, R214, R215, R216, R217, R001/R002/R007/R026 overlays as written
in v0.3.0, R301, R303 occupancy wording for ASISTE, R304 physical-token
openness, R306 awards-deferred.

### SPEC-030-R001 (REPLACED)

The **sellable** launch catalog MUST contain exactly 23 unique product codes:
8 `COMPITE`, 7 `EXPERIENCE`, and 8 `ASISTE` as listed in section 8.1.

Two additional codes MUST exist as `RETIRED_PRODUCT` (R401).
Three additional codes MUST exist as `SUPERSEDED_SCHEDULE_VARIANT` (R402).
Those five MUST NOT be counted in the 23.

### SPEC-030-R002 (REPLACED)

All 23 sellable products MUST be represented as launch products, subject to
sales opening, technical validation, and separate production authorization.
`RETIRED_PRODUCT` and `SUPERSEDED_SCHEDULE_VARIANT` codes MUST NOT be
represented as sellable launch products.

### SPEC-030-R007 (REPLACED)

The 23 sellable products MUST use journeys J1–J5. The system MUST NOT create
a separate business flow per product code. `RETIRED_PRODUCT` and
`SUPERSEDED_SCHEDULE_VARIANT` codes MUST NOT be assigned an active purchase
journey.

### SPEC-030-R026 (REPLACED)

`PUB-3D` and `FOT-3D` MUST represent one three-day access entitlement covering
`2026-11-13`, `2026-11-14`, and `2026-11-15`. Access on one covered date MUST
NOT invalidate access on later covered dates. They MUST be sellable members
of the 23-SKU catalog (OD-020 RESOLVED). They MUST NOT remain checkout
fail-closed merely because a prior contract left multi-day entitlement
unresolved. Exact entitlement persistence MAY be designed in a later
implementation unit.

### SPEC-030-R201 (UNCHANGED windows; overlay)

Sales MUST use exactly three ordered stages evaluated in `America/Merida`.
Normative intervals are half-open `[start, end)`. `23:59:59` is not
authority.

| Stage | Inclusive commercial reading | Half-open `[start, end)` |
|---|---|---|
| LANZAMIENTO | 2026-08-11 00:00 through 2026-08-31 | `[2026-08-11 00:00:00, 2026-09-01 00:00:00)` |
| PREVENTA | 2026-09-01 00:00 through 2026-09-30 | `[2026-09-01 00:00:00, 2026-10-01 00:00:00)` |
| REGULAR | 2026-10-01 00:00 through 2026-11-07 | `[2026-10-01 00:00:00, 2026-11-08 00:00:00)` |

### SPEC-030-R202 (UNCHANGED close)

Online sales MUST be `SALES_CLOSED` for new checkouts when
`now >= 2026-11-08 00:00:00 America/Merida`. Commercial close date is
**2026-11-07**. This spec MUST NOT set `SALES_STATUS=OPEN`.

### SPEC-030-R203 (REPLACED)

A commercial price stage for a SKU MUST be determined **only** by calendar
time in `America/Merida` under R201/R202. Stage MUST NOT end or advance
because a percentage or quantity of inventory has sold.

### SPEC-030-R205 (REPLACED)

When a calendar stage ends, new checkouts MUST use the next calendar stage’s
price (or remain at the flat price for flat SKUs) until sales close or the
organizer sets explicit unavailability. This MUST NOT depend on remaining
cupo.

### SPEC-030-R207 (REPLACED)

Initial enableable SKUs for sales opening are the **23** sellable codes in
section 8.1, including `PUB-3D` and `FOT-3D`. `RETIRED_PRODUCT` and
`SUPERSEDED_SCHEDULE_VARIANT` codes are not enableable.

### SPEC-030-R208 (REPLACED)

`PUB-3D` and `FOT-3D` MUST NOT remain checkout fail-closed for lack of OD-020.
OD-020 is RESOLVED: sellable three-day day-span access, session
NULL / NOT_APPLICABLE.

### SPEC-030-R214 (REPLACED)

Ready2Hybrid MUST NOT establish a fixed/published category or SKU numeric cap
as a commercial promise at sales open. No shared or per-SKU commercial
inventory pool is sales authority for this edition.

### SPEC-030-R215 (REPLACED)

Stage shares 30% / 45% / 25% of cupo MUST NOT control price. Quantity-driven
stage progression is forbidden as commercial authority.

### SPEC-030-R216 (REPLACED)

High-water-mark or similar persisted stage advancement MUST NOT change price.
Historical columns MAY remain for migration compatibility (SPEC-032) but MUST
NOT control commercial price.

### SPEC-030-R217 (REPLACED)

`SOLD_OUT` MUST NOT be inferred solely because a configured `cupo` number was
reached. See R410.

### SPEC-030-R301 (REPLACED)

The following codes MUST be classified `RETIRED_PRODUCT` for this edition:

```text
IND-PRO-H
IND-PRO-M
```

They MUST NOT be offered, MUST NOT start checkout, and MUST NOT count as
commercially active. Identifiers and historical records MUST remain
preservable. Silent DELETE is forbidden.

This requirement MUST NOT be applied to `DOB-VIE-HH`, `DOB-VIE-MH`, or
`DOB-SAB-MM`.

### SPEC-030-R303 (REPLACED overlay)

HEX-2026 MUST have exactly three event days. The **commercial program**
occupancy is:

| Date | Public day | Commercial session | Occupying sellable competitive/experience products |
|---|---|---|---|
| 2026-11-13 | Viernes 13 | PM (vespertino) | `DOB-VIE-MM`, `IND-H`, `IND-M` |
| 2026-11-14 | Sábado 14 | FULL_DAY | `DOB-SAB-HH`, `DOB-SAB-MH`, `HALF-IND-M`, `HALF-IND-H`, `HALF-DOB-MM`, `HALF-DOB-HH`, `HALF-DOB-MH`, `WOD-M`, `WOD-H` |
| 2026-11-15 | Domingo 15 | AM (matutino) | `REL-4H`, `REL-4M`, `REL-2H2M` |

ASISTE daily products bind to the same calendar dates with session NULL
(R407). Three-day products span all three dates (R026).

This table is COMMERCIAL PROGRAM, not TBD_OPERATIONAL_SCHEDULE. Future catalog
date changes MUST use a new migration; applied seeds MUST NOT be rewritten.

### SPEC-030-R304 (REPLACED)

Saturday sellable competitive and experience products in R303 MUST use domain
session `FULL_DAY`. Persistence MUST use `ALL_DAY` (OD-RELAUNCH-004 RESOLVED).
`FULL_DAY` MUST NOT be stored or interpreted as `AM` or `PM`. UI MAY display
`DÍA` / “Día completo”. `DIA` is not a persistence token.

A later authorized migration MUST align CHECK/persistence. This specification MUST
NOT execute that migration.

### SPEC-030-R306 (REPLACED)

This specification MUST document the commercial prize policy in section 8.4.
It MUST NOT classify that policy as `DEFERRED / NOT_IMPLEMENTED_YET` in a way
that erases published cash or recognition rules. Prize/results persistence
MAY be implemented later and is not required by this specification.

### SPEC-030-R401 (NEW)

`IND-PRO-H` and `IND-PRO-M` are `RETIRED_PRODUCT`. Individual Pro is not a
vendible product of the current event. Simulacro Pro remains
`FUTURE / DORMANT / OUT OF CURRENT SALES CONTRACT` (R302 unchanged).

### SPEC-030-R402 (NEW)

The following codes MUST be classified `SUPERSEDED_SCHEDULE_VARIANT`:

| Historical code | Live replacement | Live commercial occupancy |
|---|---|---|
| DOB-VIE-HH | DOB-SAB-HH | Saturday FULL_DAY |
| DOB-VIE-MH | DOB-SAB-MH | Saturday FULL_DAY |
| DOB-SAB-MM | DOB-VIE-MM | Friday PM |

Underlying categories (Dobles Hombres, Dobles Mixto, Dobles Mujeres) remain
active. These three codes MUST NOT be described as removed categories. They
MUST NOT be checkout-eligible. They MUST remain historically traceable. Silent
DELETE is forbidden. Checkout MUST NOT silently remap a historical code to its
replacement.

### SPEC-030-R403 (NEW)

Public-facing contract copy and public metadata MUST use display name
**HYBRID EXPERIENCE**. Internal identifier `HEX-2026` MAY remain. An internal
database event name MAY remain for compatibility if it is not presented as
the public commercial name.

### SPEC-030-R404 (NEW)

Public venue MUST be **Club Cumbres, Mérida, Yucatán**. This specification
MUST NOT invent a street address.

### SPEC-030-R405 (NEW)

Ready2Hybrid MUST distinguish COMMERCIAL PROGRAM (R303) from
TBD_OPERATIONAL_SCHEDULE. The contract MUST NOT require final heat counts,
heat start times, lane/station assignments, or award-ceremony day/time at
ticket-sale launch.

Purchased product identity, paid price, athlete category, prize entitlement,
and registration rights MUST NOT change solely because operational heats are
later reallocated.

### SPEC-030-R406 (NEW)

The organizer MAY reconfigure operational heat allocation as actual
registration demand becomes known. That MAY include using operational space
differently than first projected. Such reallocation MUST remain
TBD_OPERATIONAL_SCHEDULE and MUST NOT rewrite sellable product codes.

### SPEC-030-R407 (NEW)

Daily Público and Fotógrafo products are day-access tickets. They are NOT
AM-only or PM-only.

| Code | Day | Session |
|---|---|---|
| PUB-VIE | 2026-11-13 | NULL / NOT_APPLICABLE |
| PUB-SAB | 2026-11-14 | NULL / NOT_APPLICABLE |
| PUB-DOM | 2026-11-15 | NULL / NOT_APPLICABLE |
| FOT-VIE | 2026-11-13 | NULL / NOT_APPLICABLE |
| FOT-SAB | 2026-11-14 | NULL / NOT_APPLICABLE |
| FOT-DOM | 2026-11-15 | NULL / NOT_APPLICABLE |

Landing internal `session: AM` is an implementation mismatch, not authority.

### SPEC-030-R408 (NEW)

`PUB-3D` and `FOT-3D` session MUST be NULL / NOT_APPLICABLE. Day span is all
three event days (R026).

### SPEC-030-R409 (NEW)

The system MUST maintain a CONFIRMED SALES / REGISTRATION COUNT of only
server-authoritatively confirmed paid/completed commercial orders that
qualify as registrations. A client redirect MUST NOT count as a confirmed
sale. A `PAYMENT_PENDING` order MUST NOT count as a confirmed sale. An
expired or abandoned checkout MUST NOT count as a confirmed sale.

PENDING CHECKOUT / PAYMENT EXPOSURE MAY be tracked separately for
operational visibility. Payment-lifecycle holds and `PAYMENT_PENDING` orders
MAY contribute to that pending metric. They MUST NOT inflate the confirmed
count.

Demand visibility SHOULD be available by product, category, day, and format.
It MAY show both confirmed and pending values, but MUST label them
distinctly. Example semantic shape only: `confirmed registrations = 150`,
`payment pending = 7`. MUST NOT report `confirmed registrations = 157`
unless all 157 became server-authoritatively confirmed.

Operational capacity MAY exist and MAY be adjusted. Counting and visibility
MUST NOT create a published commercial cap or quantity-driven price
(R214–R216). This requirement does not prescribe database schema.

### SPEC-030-R410 (NEW)

`SOLD_OUT` is an explicit commercial availability state controlled by the
organizer. The organizer MAY place a product, a category, a commercial offer,
or the event into `SOLD_OUT` when operational or business reality requires
it. Administration UX/API is out of scope of this specification. Treating a
`RETIRED_PRODUCT` or `SUPERSEDED_SCHEDULE_VARIANT` as `SOLD_OUT` of a live
product is forbidden.

### SPEC-030-R411 (NEW)

A payment-pending hold / order-expiry reservation MAY remain for payment
transaction integrity (SPEC-040). It MUST NOT be treated as a published
category cap.

### SPEC-030-R412 (NEW)

Fixed cash prize entitlement currently defined (MXN):

| Category | 1st | 2nd | 3rd |
|---|---:|---:|---:|
| Individual Mujeres Open | 5000 | 3000 | 2000 |
| Individual Hombres Open | 5000 | 3000 | 2000 |
| Dobles Mujeres Open | 7000 | 5000 | 3000 |
| Dobles Hombres Open | 7000 | 5000 | 3000 |
| Dobles Mixto Open | 7000 | 5000 | 3000 |

Total fixed cash currently defined: **65000 MXN**. Public copy
“Más de $60,000 MXN en premios en efectivo” is consistent with that total.

Cash entitlement is guaranteed independently of award-ceremony scheduling
(R414).

### SPEC-030-R413 (NEW)

½ Hybrid and Workout participants MUST receive recognition plus participant
kit. This specification MUST NOT invent cash podiums for those products.

### SPEC-030-R414 (NEW)

`AWARD_CEREMONY_DAY` and `AWARD_CEREMONY_TIME` are TBD_OPERATIONAL_SCHEDULE.
Landing presentation such as a Saturday prizes section MUST NOT be read as
fixing ceremony schedule.

### SPEC-030-R415 (NEW)

Relay Hombres, Relay Mujeres, and Relay Mixto prize policy is RECOGNITION +
`SPONSOR_PRIZE_TBD`. The later prize MAY be cash, in-kind, or both. No fixed
monetary amount is currently guaranteed. Relay prizes MUST NOT be counted
inside the 65000 MXN total until a later Project Owner decision. This MUST
NOT block approval of the public-sales contract.

## 8. Functional requirements

### 8.1 Official sellable catalog

Prices are MXN integer cents for the full sale unit, resolved by **calendar**
stage under R201–R203 and R305. Landing MUST NOT treat any single column as
static backend authority.

MSI “Yes” means 3-month eligibility messaging as in R218–R221. Provider
capability remains a later runtime revalidation.

#### COMPITE — 8 sellable products

| Code | Product | Members | Lanzamiento | Preventa | Regular | MSI | Commercial occupancy | Chip | Insurance | Journey |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| DOB-VIE-MM | Dobles Mujeres Open | 2 | 250000 | 275000 | 300000 | Yes | 2026-11-13 PM | Yes | Yes | J2 |
| DOB-SAB-HH | Dobles Hombres Open | 2 | 250000 | 275000 | 300000 | Yes | 2026-11-14 FULL_DAY | Yes | Yes | J2 |
| DOB-SAB-MH | Dobles Mixto Open | 2 | 250000 | 275000 | 300000 | Yes | 2026-11-14 FULL_DAY | Yes | Yes | J2 |
| REL-4H | Relay 4 Hombres | 4 | 320000 | 350000 | 380000 | Yes | 2026-11-15 AM | Yes | Yes | J3 |
| REL-4M | Relay 4 Mujeres | 4 | 320000 | 350000 | 380000 | Yes | 2026-11-15 AM | Yes | Yes | J3 |
| REL-2H2M | Relay Mixto 2H+2M | 4 | 320000 | 350000 | 380000 | Yes | 2026-11-15 AM | Yes | Yes | J3 |
| IND-H | Individual Hombre Open | 1 | 150000 | 165000 | 180000 | Yes | 2026-11-13 PM | Yes | Yes | J1 |
| IND-M | Individual Mujer Open | 1 | 150000 | 165000 | 180000 | Yes | 2026-11-13 PM | Yes | Yes | J1 |

#### EXPERIENCE — 7 sellable products

| Code | Product | Members | Lanzamiento | Preventa | Regular | MSI | Commercial occupancy | Chip | Insurance | Journey |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| HALF-IND-M | ½ Hybrid Individual Mujer | 1 | 80000 | 90000 | 100000 | Yes | 2026-11-14 FULL_DAY | Yes | Yes | J1 |
| HALF-IND-H | ½ Hybrid Individual Hombre | 1 | 80000 | 90000 | 100000 | Yes | 2026-11-14 FULL_DAY | Yes | Yes | J1 |
| HALF-DOB-MM | ½ Hybrid Dobles Mujeres | 2 | 160000 | 180000 | 200000 | Yes | 2026-11-14 FULL_DAY | Yes | Yes | J2 |
| HALF-DOB-HH | ½ Hybrid Dobles Hombres | 2 | 160000 | 180000 | 200000 | Yes | 2026-11-14 FULL_DAY | Yes | Yes | J2 |
| HALF-DOB-MH | ½ Hybrid Dobles Mixto | 2 | 160000 | 180000 | 200000 | Yes | 2026-11-14 FULL_DAY | Yes | Yes | J2 |
| WOD-M | Workout Experience Mujer | 1 | 35000 | 35000 | 35000 | No | 2026-11-14 FULL_DAY | No | No | J4 |
| WOD-H | Workout Experience Hombre | 1 | 35000 | 35000 | 35000 | No | 2026-11-14 FULL_DAY | No | No | J4 |

#### ASISTE — 8 sellable products

| Code | Product | Kind | Lanzamiento | Preventa | Regular | MSI | Validity | Session | Journey | Enablement |
|---|---|---|---:|---:|---:|---|---|---|---|---|
| PUB-VIE | Público · Viernes 13 | spectator | 25000 | 25000 | 25000 | No | 2026-11-13 | NULL | J5 | Sellable |
| PUB-SAB | Público · Sábado 14 | spectator | 25000 | 25000 | 25000 | No | 2026-11-14 | NULL | J5 | Sellable |
| PUB-DOM | Público · Domingo 15 | spectator | 25000 | 25000 | 25000 | No | 2026-11-15 | NULL | J5 | Sellable |
| PUB-3D | Público · Pase 3 Días | spectator | 60000 | 60000 | 60000 | No | 2026-11-13 through 2026-11-15 | NULL | J5 | Sellable |
| FOT-VIE | Fotógrafo · Viernes 13 | press | 35000 | 35000 | 35000 | No | 2026-11-13 | NULL | J5 | Sellable |
| FOT-SAB | Fotógrafo · Sábado 14 | press | 35000 | 35000 | 35000 | No | 2026-11-14 | NULL | J5 | Sellable |
| FOT-DOM | Fotógrafo · Domingo 15 | press | 35000 | 35000 | 35000 | No | 2026-11-15 | NULL | J5 | Sellable |
| FOT-3D | Fotógrafo · Pase 3 Días | press | 80000 | 80000 | 80000 | No | 2026-11-13 through 2026-11-15 | NULL | J5 | Sellable |

Equivalent MXN display: Individual 1500/1650/1800; Dobles 2500/2750/3000;
Relay 3200/3500/3800; ½ Hybrid individual 800/900/1000; ½ Hybrid dobles
1600/1800/2000; Workout 350; Público daily 250; Público 3D 600; Fotógrafo
daily 350; Fotógrafo 3D 800.

#### Historical identities (not sellable)

| Code | Classification | Current meaning | Replacement |
|---|---|---|---|
| IND-PRO-H | RETIRED_PRODUCT | Individual Pro Hombre removed | none |
| IND-PRO-M | RETIRED_PRODUCT | Individual Pro Mujer removed | none |
| DOB-VIE-HH | SUPERSEDED_SCHEDULE_VARIANT | Friday HH slot not offered | DOB-SAB-HH |
| DOB-VIE-MH | SUPERSEDED_SCHEDULE_VARIANT | Friday MH slot not offered | DOB-SAB-MH |
| DOB-SAB-MM | SUPERSEDED_SCHEDULE_VARIANT | Saturday AM MM slot not offered | DOB-VIE-MM |

### 8.2 Journey membership

Outcome shapes R010–R016 are unchanged.

#### J1

`IND-H`, `IND-M`, `HALF-IND-M`, `HALF-IND-H`.
Does **not** apply to `IND-PRO-H` / `IND-PRO-M`.

#### J2

`DOB-VIE-MM`, `DOB-SAB-HH`, `DOB-SAB-MH`, `HALF-DOB-MM`, `HALF-DOB-HH`,
`HALF-DOB-MH`.
Does **not** apply to `DOB-VIE-HH`, `DOB-VIE-MH`, or `DOB-SAB-MM`.

#### J3 / J4 / J5

Unchanged among sellable SKUs (`REL-*`, `WOD-*`, `PUB-*`, `FOT-*`).

### 8.3 Commercial vs operational schedule

R405–R406. Public program copy MAY describe Friday vespertino, Saturday día
completo, Sunday matutino. Exact heats remain TBD_OPERATIONAL_SCHEDULE.

### 8.4 Prize policy

R412–R415. Ceremony schedule is not part of the cash guarantee.

## 9. Non-functional requirements

Carry-forward of timezone `America/Merida` (no DST), integer cents, fail-closed
checkout for ineligible codes, and audit qualities. Half-open windows in R201
are the normative implementation shape.

Demand visibility SHOULD be available to the organizer. If shown, it MUST
label CONFIRMED SALES / REGISTRATION COUNT distinctly from PENDING CHECKOUT
/ PAYMENT EXPOSURE. It MUST NOT become a public commercial cap.

## 10. Interfaces and contracts

Unchanged conceptual public catalog / checkout / webhook boundaries from
v0.3.0, except:

- catalog cardinality and historical-code exclusion as specified in
  SPEC-031 v0.4.0;
- calendar-only price authority;
- manual `SOLD_OUT`;
- 23 enableable SKUs including three-day passes.

Landing remains a client, not price authority (R003, R209).

## 11. Failure modes

Carry-forward of v0.3.0 payment/roster failures, plus:

| Failure | Required response |
|---|---|
| Checkout of `RETIRED_PRODUCT` | Fail closed before preference / hold; no new commercial order |
| Checkout of `SUPERSEDED_SCHEDULE_VARIANT` | Fail closed; no silent remap to replacement SKU; MUST NOT present as `SOLD_OUT` of the live replacement |
| Mapping `FULL_DAY` to `AM` or `PM` | Forbidden |
| PUB/FOT treated as AM-only or PM-only | Forbidden |
| Quantity-driven price stage or 30/45/25 quota as sales authority | Forbidden |
| Auto `SOLD_OUT` solely from historical `cupo` | Forbidden |
| Mixing `PAYMENT_PENDING`, holds, redirects, or abandoned checkouts into CONFIRMED SALES / REGISTRATION COUNT | Forbidden |
| Treating Simulacro Pro as a SKU | Forbidden |
| Reusing October/28-SKU or v0.3.0 quota evidence as v0.4.0 validation | Forbidden |
| Accidental apply of `0018` as written | Same as v0.3.0: stale / incompatible; MUST NOT become commercial authority |
| Frozen 0C MSI bundle as v0.4.0 proof | Forbidden |
| Inventing award-ceremony day from landing layout | Forbidden |

## 12. Security and privacy

Carry-forward of SPEC-030 v0.3.0 / v0.2.0 section 13. No new personal-data
categories. Historical identifiers MUST NOT resurrect checkout or leak extra
PII.

## 13. Acceptance criteria

Historical AC001–AC012, AC201–AC204, AC301–AC305 remain in prior records.
This specification **does not re-run** them and **does not claim runtime evidence**.

Contract-correctness criteria for v0.4.0 (defined, not executed):

### SPEC-030-AC201 (REPLACED expected result)

**Purpose:** Commercial stage windows, calendar-only, online close.

**Requirements:** R201, R202, R203, R215, R216, R307.

**Pass (contract):** Half-open windows as in R201; close at
`2026-11-08 00:00 America/Merida`; no 23:59:59 authority; no quantity-driven
stage. This specification MUST NOT set `SALES_STATUS=OPEN`.

### SPEC-030-AC301 (CARRIED)

Event starts 2026-11-13 and ends 2026-11-15; three event days only (R303).

### SPEC-030-AC401 (NEW)

**Purpose:** Catalog cardinality and historical split.

**Requirements:** R001, R002, R301, R401, R402.

**Pass (contract):** 23 named sellable codes; two `RETIRED_PRODUCT`; three
`SUPERSEDED_SCHEDULE_VARIANT` with the mappings in R402; no undifferentiated
five-code `RETIRED_FROM_SALE` meaning; no DELETE requirement.

### SPEC-030-AC402 (NEW)

**Purpose:** Public identity.

**Requirements:** R403, R404.

**Pass (contract):** Public display name HYBRID EXPERIENCE; venue Club
Cumbres, Mérida, Yucatán; no invented street address; `HEX-2026` allowed as
internal code.

### SPEC-030-AC403 (NEW)

**Purpose:** PUB/FOT day access and three-day enablement.

**Requirements:** R026, R207, R208, R407, R408.

**Pass (contract):** Daily PUB/FOT session NULL; 3-day span all three days;
all eight ASISTE codes sellable; not fail-closed for OD-020.

### SPEC-030-AC404 (NEW)

**Purpose:** Saturday FULL_DAY / ALL_DAY.

**Requirements:** R304, R303.

**Pass (contract):** Listed Saturday products domain FULL_DAY; persistence
token ALL_DAY; not AM/PM.

### SPEC-030-AC405 (NEW)

**Purpose:** Capacity and SOLD_OUT semantics.

**Requirements:** R214–R217, R409, R410, R411.

**Pass (contract):** No published commercial cap at sales open; CONFIRMED
SALES / REGISTRATION COUNT required and distinct from PENDING CHECKOUT /
PAYMENT EXPOSURE (`PAYMENT_PENDING`, payment-lifecycle holds); operational
capacity MAY exist; `SOLD_OUT` organizer-controlled; payment holds distinct
from commercial cap.

### SPEC-030-AC406 (NEW)

**Purpose:** Prize policy without ceremony freeze.

**Requirements:** R306, R412–R415.

**Pass (contract):** Cash table and 65000 MXN total present; experience
recognition+kit; Relay SPONSOR_PRIZE_TBD not inside 65000; ceremony
TBD_OPERATIONAL_SCHEDULE; no prize DB required by this specification.

### SPEC-030-AC407 (NEW)

**Purpose:** Commercial program vs operational schedule.

**Requirements:** R405, R406.

**Pass (contract):** R303 occupancy is commercial program; heats/ceremony
times explicitly TBD; product identity not rewritten by later heat changes.

### SPEC-030-AC304 (REPLACED expected result)

**Purpose:** Prices/MSI; Simulacro Pro out of scope; sales not opened.

**Requirements:** R305, R302, R307.

**Pass (contract):** 23 survivor amounts/MSI match section 8.1; no Pro SKU;
`SALES_STATUS` not opened.

## 14. Validation plan

Documentary review of this specification against the Project Owner v0.4.0 instruction,
SPEC-030 v0.3.0 APPROVED, and landing `5fc0acb` as read-only source. No
runtime, SQL, or bundle tests in this unit.

Landing follow-ups (out of scope to fix here): internal PUB/FOT `session: AM`;
windows encoded as 23:59:59; PWA October leftover; “cupos limitados” copy;
JSON-LD name/venue; display-name variants.

## 15. Traceability

| Requirement | Source | v0.3.0 | v0.4.0 | Implementation (this unit) | State |
|---|---|---|---|---|---|
| R001, R002, R007, R207 | PO catalog | 23 + 5 RETIRED_FROM_SALE; 21 enableable | 23 sellable; 2 retired + 3 superseded; 23 enableable | none | APPROVED |
| R026, R208 | OD-020 | fail-closed 3-day | 3-day sellable | none | APPROVED |
| R203, R205, R214–R217 | PO capacity/pricing | quota 30/45/25; cupo SOLD_OUT | calendar-only price; no commercial cap; manual SOLD_OUT | none | APPROVED |
| R301, R401, R402 | PO history split | five RETIRED_FROM_SALE | split classes | none | APPROVED |
| R303–R304, R407–R408 | program / FULL_DAY / PUB-FOT | ALL_DAY open; OD-002 open | ALL_DAY closed; session NULL | none | APPROVED |
| R306, R412–R415 | published prizes | AWARDS DEFERRED | documented policy; no DB required | none | APPROVED |
| R403, R404 | display name / venue | OD-001 open | HYBRID EXPERIENCE; Club Cumbres | none | APPROVED |
| R405, R406 | program vs ops | heats unspecified | explicit TBD_OPERATIONAL_SCHEDULE | none | APPROVED |
| R201, R202, R231, R305, R307 | v0.3.0 | unchanged windows/D-14/prices/closed sales | carried | none | CARRIED_FORWARD |
| R018–R022, R030 | security/payment | unchanged | unchanged | none | CARRIED_FORWARD |
| AC401–AC407 | this specification | n/a | defined, not run | none | NOT_RUN |

## 16. Open decisions

| ID | Decision | Status | Blocks this specification | Notes |
|---|---|---|---|---|
| OD-023 | Sales opening / EN_VENTA | OPEN | No | Separate later authorization. Calendar windows exist; technical OPEN is not this specification |
| OD-024 | LOW_AVAILABILITY threshold | OPEN | No | MUST NOT derive from commercial cupo |
| OD-022 | Saturday public wording | RESOLVED for domain | No | UI DÍA / Día completo; persistence ALL_DAY |
| OD-RELAUNCH-001 | Event display name | RESOLVED | No | HYBRID EXPERIENCE |
| OD-RELAUNCH-002 | PUB/FOT session | RESOLVED | No | NULL / NOT_APPLICABLE |
| OD-RELAUNCH-003 | Persistence of non-sellable identities | RESOLVED for meaning | No | No DELETE; checkout ineligible; physical flag is implementation |
| OD-RELAUNCH-004 | ALL_DAY token | RESOLVED | No | Persistence ALL_DAY |
| OD-020 | Three-day entitlement | RESOLVED | No | Sellable; mechanism later |
| OD-V04-OPS-001 | Final heat counts/times | TBD_OPERATIONAL_SCHEDULE | No | Intentional |
| OD-V04-OPS-002 | Lane/station allocation | TBD_OPERATIONAL_SCHEDULE | No | Intentional |
| OD-V04-OPS-003 | Award ceremony day/time | TBD_OPERATIONAL_SCHEDULE | No | Cash entitlement still guaranteed |
| OD-V04-OPS-004 | Relay sponsor prize amount/type | SPONSOR_PRIZE_TBD | No | Intentional |
| OD-V04-OPS-005 | Final operational capacity plan / staffing / judges | TBD_OPERATIONAL_SCHEDULE | No | Intentional |

## 17. Deferred items

| Item | Classification |
|---|---|
| Prize/results persistence schema | FUTURE IMPLEMENTATION; commercial policy is in R412–R415 |
| Simulacro Pro backend | FUTURE / DORMANT |
| `docs/02` October calendar migration | DEFERRED documentary unit |
| Physical ALL_DAY CHECK migration | Later implementation unit |
| Landing metadata/PWA/quota-copy fixes | Landing follow-up, out of this repo unit |
| Main/seed October runtime repair | Later implementation after approval |
| MSI revalidation on v0.4 runtime | Later validation unit |
| Frozen BUNDLE-REGEN evidence reuse | Forbidden for this contract |

## 18. Change log

| Version | Date | Status | Actor | Reason |
|---|---|---|---|---|
| 0.4.0 | 2026-08-22 | DRAFT | Cursor, authorized by Project Owner | Material commercial correction: identity/venue, retired vs superseded, PUB/FOT day access, 3-day sellable, calendar-only pricing, no commercial cap, manual SOLD_OUT, prize policy, program vs operational schedule. No implementation. |
| 0.4.0 | 2026-08-23 | DRAFT | Cursor, R1 independent-review correction | Normative precision only: separate confirmed sales from pending checkout/PAYMENT_PENDING; distinguish SELLABLE_IDENTITY from CURRENTLY_PAYABLE_CHECKOUT_ELIGIBLE. Product authority unchanged. Still DRAFT. |
| 0.4.0 | 2026-08-23 | APPROVED | Project Owner | Explicit human approval: "APRUEBO SPEC-030, SPEC-031 Y SPEC-032 v0.4.0". Effective commercial contract. Does not authorize implementation or SALES_STATUS=OPEN. |

### Change impact (SPEC-000)

- **Reason:** Approved v0.3.0 does not match current Product Owner authority
  identified in the Landing Master ↔ Ready2Hybrid reconciliation.
- **Affected specs:** SPEC-030, SPEC-031, SPEC-032 (v0.4.0). SPEC-040
  payment-expiry remains compatible. SPEC-001/011 unchanged.
- **Affected requirements:** R001, R002, R007, R026, R203, R205, R207, R208,
  R214–R217, R301, R303, R304, R306; NEW R401–R415; AC overlays AC201,
  AC304, AC401–AC407.
- **Compatibility:** Breaking vs v0.3.0 commercial rules (quota, 21-enableable,
  five-code RETIRED_FROM_SALE, awards deferred, OD-001/002/004/020 open).
  Intended. Payment verification and QR opacity unchanged.
- **Implementation impact:** After approval only: catalog wiring, checkout
  eligibility, staged-pricing calendar-only, disable quantity HWM, 3-day
  enablement, session ALL_DAY/NULL, public name/venue, journeys excluding
  historical codes. Not executed here.
- **Migration impact:** Future new migration on seeded Main; do not rewrite
  applied seeds; do not apply `0018` as written; `0019` is unapplied WIP and
  MUST be re-reviewed against v0.4.0 before any apply (it still contains
  quota helpers). This specification does not edit `0018`/`0019`.
- **Security/privacy:** No new PII categories. Historical codes remain
  non-checkout. Redirect still MUST NOT mark PAID (SPEC-031).
- **Validation impact:** Prior 0C and v0.3.0 quota/28-SKU evidence MUST NOT
  validate v0.4.0. New acceptance criteria are defined, not run.
- **Rollback:** SPEC-030 v0.3.0 is SUPERSEDED and preserved byte-identical at
  `docs/specs/archive/SPEC-030-PUBLIC-SALES-CATALOG-AND-REGISTRATION-JOURNEYS-v0.3.0.md`.
  Restoring v0.3.0 as effective would require a new human-authorized
  governance unit. This approval does not authorize implementation or
  `SALES_STATUS=OPEN`.

## Appendix CF — v0.3.0 → v0.4.0

| Requirement | Disposition | Compatibility |
|---|---|---|
| R001, R002, R007, R026, R203, R205, R207, R208, R214–R217, R301, R303, R304, R306 | REPLACED_BY same ID + new text | Breaking vs v0.3.0 commercial rules; intended |
| R401–R415 | NEW | Additive |
| R201, R202, R231, R302, R305, R307, R003–R006, R008–R025, R209–R213, R218–R230 | CARRIED_FORWARD | Compatible |
| R214–R217 v0.3.0 quota/cupo SOLD_OUT | REPLACED | Must not remain commercial authority |
| AC201, AC304 | REPLACED expected result | Breaking vs quota/awards-deferred |
| AC401–AC407 | NEW | Additive; NOT_RUN |

## Appendix IMP — future implementation impact (NOT executed)

| Layer | Impact |
|---|---|
| Public copy / metadata | HYBRID EXPERIENCE; Club Cumbres; no October PWA |
| Schema | Event dates/name display; venue; session ALL_DAY + NULL; checkout eligibility flags; no requirement to delete cupo columns |
| Migration | New migration after approval; do not rewrite 0002/0004; do not treat 0018/0019 as v0.4.0 without review |
| Checkout | Reject retired and superseded codes; calendar-only price; 3-day eligible; manual SOLD_OUT |
| Staged pricing | Windows unchanged; remove quantity/HWM as price authority |
| Tests | Fixtures that assume 30/45/25, cupo SOLD_OUT, 21 enableable, five RETIRED_FROM_SALE, fail-closed 3-day, AM Saturday |

Protected WIP (`handler.deploy.js`, `staged-pricing.ts`, `0018`, `0019`,
journeys, payment code, T2 `0017`) MUST remain untouched until a later
authorized implementation unit.

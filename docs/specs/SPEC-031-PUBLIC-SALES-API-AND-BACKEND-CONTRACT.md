---
id: SPEC-031
title: Public Sales API and Backend Contract
status: APPROVED
version: 0.4.0
phase: RELAUNCH-V0-4-COMMERCIAL-CONTRACT
created_at: 2026-08-22
approved_at: 2026-08-23
approved_by: Project Owner
approval_basis: Explicit human approval ("APRUEBO SPEC-030, SPEC-031 Y SPEC-032 v0.4.0")
supersedes:
  - SPEC-031 v0.3.0
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-030 v0.4.0
compatible_with:
  - SPEC-011 v0.1.0
  - SPEC-032 v0.4.0
  - SPEC-040 v0.1.1
---

# SPEC-031 v0.4.0 — Public Sales API and Backend Contract

```text
STATUS: APPROVED — Effective public API / backend contract
Approved: 2026-08-23 by Project Owner
Effective: YES
Supersedes: SPEC-031 v0.3.0
Does NOT authorize code, SQL, bundle, InsForge, Mercado Pago, Clip, Openpay,
PayPal, or SALES_STATUS=OPEN.
Does NOT duplicate SPEC-030 v0.4.0 catalog values.
Does NOT redesign Lane B multi-provider payments.
SALES_STATUS remains CLOSED / PRÓXIMAMENTE.
```

## 1. Purpose

Adjust the public landing–backend contract so it follows SPEC-030 v0.4.0:

- 23 sellable SKUs including three-day passes;
- fail-closed checkout for `RETIRED_PRODUCT` and
  `SUPERSEDED_SCHEDULE_VARIANT`;
- calendar-only price authority;
- organizer-controlled `SOLD_OUT`;
- day-access PUB/FOT semantics;
- payment lifecycle holds distinct from commercial category caps;
- sales remain closed until explicitly opened.

Unchanged operations, capability model, webhook, privacy, and
redirect-non-authority rules from SPEC-031 v0.3.0 / v0.2.0 are carried
forward.

## 2. Authority sources

1. Project Owner authorization `RELAUNCH v0.4.0 DRAFT` (2026-08-22).
2. SPEC-030 v0.4.0 APPROVED (catalog/commercial authority).
3. SPEC-031 v0.3.0 (now SUPERSEDED by this version; archived).
4. SPEC-000 v0.2.0, SPEC-001 v0.1.0, SPEC-011 v0.1.0.
5. SPEC-040 v0.1.1 (payment-pending expiry; compatible).

SPEC-030 remains authority for catalog values, journeys, prices, MSI, prizes,
and capacity policy. This specification does not alter those values.

## 3. Context

```text
Sellable products: 23 (including PUB-3D, FOT-3D)
RETIRED_PRODUCT: 2
SUPERSEDED_SCHEDULE_VARIANT: 3
Journeys: J1–J5 (unchanged shapes)
Public event dates: 2026-11-13 .. 2026-11-15
Public display name: HYBRID EXPERIENCE
SALES_STATUS: CLOSED / PRÓXIMAMENTE
```

## 4. Scope

- public event identity/date/venue fields;
- catalog listing cardinality and visibility of historical codes;
- checkout eligibility / fail-closed for retired and superseded codes;
- three-day pass eligibility;
- day-access session representation;
- calendar-only stage resolution;
- manual `SOLD_OUT` versus payment-lifecycle holds;
- preservation of server-authoritative payment verification.

## 5. Non-goals

No new endpoints, no 23 product-specific flows, no MSI redesign, no awards
API, no Simulacro Pro API, no SQL, no bundle regen, no `SALES_STATUS=OPEN`,
no multi-provider payment redesign, no heat-scheduling API.

## 6. Definitions

Carry-forward of SPEC-031 v0.3.0 plus SPEC-030 v0.4.0 terms:
`RETIRED_PRODUCT`, `SUPERSEDED_SCHEDULE_VARIANT`, `COMMERCIAL CAP`,
`PAYMENT LIFECYCLE HOLD`, `MANUAL SOLD_OUT`, `SELLABLE_IDENTITY`,
`CURRENTLY_PAYABLE_CHECKOUT_ELIGIBLE`, `CONFIRMED SALES / REGISTRATION COUNT`,
`PENDING CHECKOUT / PAYMENT EXPOSURE`.

## 7. Invariants and requirements

Carry-forward: R001–R003, R005–R049 except where replaced below; R201–R202,
R204–R207, R209–R217 except where replaced.

Payment, webhook, redirect-non-authority, and opaque-ID invariants MUST remain
unchanged (SPEC-000-R026).

### SPEC-031-R004 (REPLACED)

The contract MUST support the 23 sellable products and five reusable journeys
defined by SPEC-030 v0.4.0. It MUST NOT define 23 (or 28)
product-specific endpoints or flows.

### SPEC-031-R006 (REPLACED overlay)

OP-PUB-01 successful response MUST expose:

- public display name **HYBRID EXPERIENCE** (not internal code as commercial
  name);
- starts/ends `2026-11-13` / `2026-11-15`;
- timezone `America/Merida`;
- venue **Club Cumbres, Mérida, Yucatán** without inventing a street address.

This specification does not implement that payload.

### SPEC-031-R203 (REPLACED)

Stage for a SKU MUST be the calendar stage defined in SPEC-030 v0.4.0
(R201 / R202 / R203). Stage MUST NOT be the earlier of calendar versus
cumulative threshold exhaustion. Quantity-driven stage MUST NOT be API
authority.

### SPEC-031-R208 (REPLACED)

`SOLD_OUT` MUST mean organizer-controlled commercial unavailability
(SPEC-030-R410). Checkout MUST resolve all explicit organizer-controlled
commercial availability applicable to the requested SKU at these authorized
scopes:

- product / SKU;
- category or commercial offer;
- event.

If any applicable explicit availability state resolves to `SOLD_OUT`,
checkout MUST create no payable preference.

Examples: SKU explicitly `SOLD_OUT` => that SKU cannot checkout. Commercial
category/offer explicitly `SOLD_OUT` => affected SKUs cannot checkout. Whole
event explicitly `SOLD_OUT` => no affected event SKU can checkout.

The API MUST NOT emit or infer `SOLD_OUT` solely from historical `cupo`,
quota 30/45/25, HWM, number sold, payment holds, or `PAYMENT_PENDING` count.
Exact persistence and administrative UI remain implementation work. No new
endpoint is required by this specification.

### SPEC-031-R301 (REPLACED)

The default public catalog (OP-PUB-02) MUST list the 23 `SELLABLE_IDENTITY`
products or an authorized visible subset of them. `RETIRED_PRODUCT` and
`SUPERSEDED_SCHEDULE_VARIANT` codes MUST NOT appear as purchasable items.

`SELLABLE_IDENTITY` cardinality is 23. That count MUST NOT be read as an
unconditional `CURRENTLY_PAYABLE_CHECKOUT_ELIGIBLE` count.

A sellable identity is `CURRENTLY_PAYABLE_CHECKOUT_ELIGIBLE` only when all
of the following hold:

- `SALES_STATUS` is explicitly OPEN (not CLOSED / PRÓXIMAMENTE);
- the SKU is one of the 23 sellable identities;
- it is not `RETIRED_PRODUCT`;
- it is not `SUPERSEDED_SCHEDULE_VARIANT`;
- no applicable explicit organizer commercial availability resolves to
  `SOLD_OUT` or another explicit organizer unavailability (SKU, category or
  commercial offer, or event);
- other existing security/payment/validation gates pass.

While `SALES_STATUS` is CLOSED / PRÓXIMAMENTE, new payable checkout
eligibility is NONE.

### SPEC-031-R302 (REPLACED)

OP-PUB-03 / OP-PUB-04 for a `RETIRED_PRODUCT` or
`SUPERSEDED_SCHEDULE_VARIANT` code MUST fail closed before payment-lifecycle
hold or Mercado Pago preference. Public error MUST be an explicit stable class
such as `PRODUCT_NOT_AVAILABLE` or a later-approved `PRODUCT_RETIRED` /
`PRODUCT_SUPERSEDED` alias. Silent success, silent remap to the live
replacement SKU, or treating the historical code as `SOLD_OUT` of the live
replacement is forbidden.

### SPEC-031-R303 (UNCHANGED intent; overlay)

Catalog and checkout responses MUST NOT treat landing `DIA` as a backend
session enum. Saturday `FULL_DAY` MUST persist as `ALL_DAY` once implemented
(SPEC-032). Daily PUB/FOT and three-day passes MUST represent session as
NULL / NOT_APPLICABLE.

### SPEC-031-R304 (NEW)

OP-PUB-04 for `PUB-3D` and `FOT-3D` MUST treat those codes as
`SELLABLE_IDENTITY` members of the 23. They MAY become
`CURRENTLY_PAYABLE_CHECKOUT_ELIGIBLE` only when sales are explicitly OPEN
and the organizer has not set applicable explicit unavailability. They MUST
NOT remain fail-closed for unresolved multi-day entitlement (OD-020
RESOLVED). Entitlement covering Friday+Saturday+Sunday MUST be represented
without invalidating later covered dates after use of an earlier date.

### SPEC-031-R305 (NEW)

Checkout and catalog MUST treat daily PUB/FOT as day-access products. They
MUST NOT require or imply AM-only or PM-only validity.

### SPEC-031-R306 (NEW)

A payment-lifecycle hold / order expiry reservation MAY be created for
transaction integrity (SPEC-040). The API MUST NOT present that hold as a
published commercial category cap, MUST NOT advance price from hold counts,
and MUST NOT auto-`SOLD_OUT` from hold+sold versus historical cupo.

### SPEC-031-R307 (NEW)

Client redirect, return URL, query parameters, or browser success screens
MUST NOT mark an order `PAID`. Payment confirmation remains
server-authoritative webhook/verification (unchanged from v0.3.0 / SPEC-001).

### SPEC-031-R308 (NEW)

This specification MUST NOT open sales. Public operations MUST continue to
fail closed for new payable checkouts while `SALES_STATUS` is CLOSED /
PRÓXIMAMENTE, independent of calendar windows existing in SPEC-030.

## 8. Functional requirements

OP-PUB-01..10 remain the operation set. Changed rows only:

| Operation | v0.3.0 | v0.4.0 |
|---|---|---|
| OP-PUB-01 | Dates from SPEC-030 v0.3.0 | Dates, **HYBRID EXPERIENCE**, Club Cumbres from SPEC-030 v0.4.0 |
| OP-PUB-02 | 23 vendible; five RETIRED_FROM_SALE excluded | 23 sellable including 3-day; retired and superseded excluded from purchasable list |
| OP-PUB-04 | Not RETIRED_FROM_SALE | SELLABLE_IDENTITY among the 23; not RETIRED_PRODUCT; not SUPERSEDED_SCHEDULE_VARIANT; no applicable organizer SOLD_OUT at SKU / category-offer / event; SALES_STATUS OPEN; other gates pass |
| Stage/price | Earlier of calendar vs threshold | Calendar only |
| SOLD_OUT | Capacity exhausted | Organizer-controlled state |

`PRODUCT_NOT_AVAILABLE` remains valid for hidden/inactive/retired/superseded.
`SOLD_OUT` remains in the public error taxonomy for organizer unavailability,
not as a synonym for historical identity.

## 9. Non-functional requirements

Carry-forward: rate limiting still required before production; client clock
MUST NOT set stage (R202). Demand counts SHOULD be available internally and,
if shown, MUST label confirmed sales distinctly from pending checkout /
`PAYMENT_PENDING`. They MUST NOT be required as public commercial caps.

## 10. Interfaces and contracts

Unchanged capability / error / audit shapes except eligibility, stage
authority, `SOLD_OUT` meaning, and public identity fields above.

## 11. Failure modes

| Failure | Response |
|---|---|
| Retired or superseded SKU checkout | R302 fail-closed; zero preference |
| 3-day treated as OD-020 fail-closed | Forbidden under R304 |
| Client-supplied dates/name | Ignored; server event identity wins |
| Redirect treated as PAID | Forbidden (R307) |
| Cupo-derived SOLD_OUT | Forbidden (R208) |
| Using frozen MSI bundle as v0.4.0 proof | Forbidden |
| Quantity/HWM price in API | Forbidden (R203) |

## 12. Security and privacy

Carry-forward of SPEC-031 v0.3.0. Historical codes MUST NOT leak extra PII.
Least-privilege and webhook authenticity rules unchanged.

## 13. Acceptance criteria

v0.3.0 AC004, AC201, AC301, AC302 remain historical. New/replaced (defined,
not executed; no runtime claim):

### SPEC-031-AC004 (overlay)

Journey coverage is 23 sellable SKUs / five templates, not 28 product flows.

### SPEC-031-AC201 (REPLACED)

Stage/price authority uses SPEC-030 v0.4.0 windows and calendar-only R203.
No threshold-driven stage in API.

### SPEC-031-AC301 (REPLACED)

`SELLABLE_IDENTITY` count = 23 including PUB-3D/FOT-3D. Two retired and
three superseded codes are not sellable and not checkout-eligible
(R301–R302, R304). `CURRENTLY_PAYABLE_CHECKOUT_ELIGIBLE` is not
unconditionally 23. While `SALES_STATUS` is CLOSED / PRÓXIMAMENTE, new
payable checkout eligibility is NONE (R308).

### SPEC-031-AC302 (overlay)

OP-PUB-01 dates 13–15 Nov, display name HYBRID EXPERIENCE, venue Club Cumbres
after implementation; this specification performs no runtime check.

### SPEC-031-AC401 (NEW)

**Purpose:** Manual SOLD_OUT scope vs payment hold vs historical cupo.

**Requirements:** R208, R306.

**Pass (contract):** `SOLD_OUT` is organizer-controlled and resolved for the
requested SKU at product/SKU, category or commercial offer, and event
scopes; any applicable explicit `SOLD_OUT` blocks payable preference;
payment holds exist without implying commercial cap; auto-`SOLD_OUT` from
`cupo`, quota, HWM, number sold, holds, or `PAYMENT_PENDING` is forbidden.

### SPEC-031-AC402 (NEW)

**Purpose:** Day-access and redirect-non-authority.

**Requirements:** R305, R307, R308.

**Pass (contract):** Daily PUB/FOT are not AM/PM tickets; redirect MUST NOT
mark PAID; sales remain closed until explicit OPEN.

## 14. Validation plan

Documentary only. No tests executed. No endpoints implemented.

## 15. Traceability

| Requirement | Source | Implementation this unit | State |
|---|---|---|---|
| R004, R006, R203, R208, R301–R308 | SPEC-030 v0.4.0 | none | APPROVED |
| R001–R003, R201–R202, R204–R207, R209–R217 (except replaced) | v0.3.0 / v0.2.0 | none | CARRIED_FORWARD |
| R307 redirect-non-authority | SPEC-001 / v0.3.0 | none | CARRIED_FORWARD (restated) |

## 16. Open decisions

Same operational TBDs as SPEC-030 v0.4.0 (heats, ceremony, Relay
sponsor prize, operational capacity). No additional API decision is required
for this specification. Sales OPEN remains OD-023.

## 17. Change log

| Version | Date | Status | Actor | Reason |
|---|---|---|---|---|
| 0.4.0 | 2026-08-22 | DRAFT | Cursor, authorized by Project Owner | Align API contract to 23 enableable SKUs, retired vs superseded fail-closed, calendar-only price, manual SOLD_OUT, day-access, 3-day eligibility, hold vs cap. |
| 0.4.0 | 2026-08-23 | DRAFT | Cursor, R1 independent-review correction | Draft-authority wording; SELLABLE_IDENTITY vs CURRENTLY_PAYABLE_CHECKOUT_ELIGIBLE; SOLD_OUT scope resolution. Product authority unchanged. Still DRAFT. |
| 0.4.0 | 2026-08-23 | APPROVED | Project Owner | Explicit human approval: "APRUEBO SPEC-030, SPEC-031 Y SPEC-032 v0.4.0". Effective public API/backend contract. Does not authorize implementation or SALES_STATUS=OPEN. |

### Change impact (SPEC-000)

- **Reason:** Backend/API still encodes v0.3.0 quota, fail-closed 3-day, and
  undifferentiated retirement.
- **Affected specs:** SPEC-031; depends on SPEC-030 v0.4.0; SPEC-032
  v0.4.0 for session/eligibility persistence.
- **Implementation impact:** After this approval: checkout eligibility, catalog
  listing, stage resolver, SOLD_OUT source, public event payload. Not now.
- **Migration impact:** None in this unit. Later implementation MUST NOT
  apply 0018/0019 as v0.4.0 without re-review.
- **Security/privacy:** Redirect-non-authority restated; unchanged webhook
  authenticity.
- **Rollback:** SPEC-031 v0.3.0 is SUPERSEDED and preserved byte-identical at
  `docs/specs/archive/SPEC-031-PUBLIC-SALES-API-AND-BACKEND-CONTRACT-v0.3.0.md`.
  Restoring v0.3.0 as effective would require a new human-authorized
  governance unit. This approval does not authorize implementation or
  `SALES_STATUS=OPEN`.

## Appendix CF

| Requirement | Disposition |
|---|---|
| R004, R006 overlay, R203, R208, R301, R302 | REPLACED |
| R304–R308 | NEW |
| Remaining R001–R049 / R201–R217 | CARRIED_FORWARD except replaced IDs |

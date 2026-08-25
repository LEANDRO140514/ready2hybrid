---
id: SPEC-031
title: Public Sales API and Backend Contract
status: APPROVED
version: 0.3.0
phase: RELAUNCH-DELTA-SPEC-DRAFT
created_at: 2026-08-21
approved_at: 2026-08-21
approved_by: Leandro Espinosa, CEO / Project Owner
approval_basis: Explicit human authorization after independent review READY_FOR_APPROVAL; Option 3 governance exception (v0.2.0 operational APPROVED never committed as a clean artifact)
supersedes:
  - SPEC-031 v0.2.0
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-030 v0.3.0
compatible_with:
  - SPEC-011 v0.1.0
  - SPEC-032 v0.3.0
  - SPEC-040 v0.1.1
---

# SPEC-031 v0.3.0 — Public Sales API and Backend Contract

```text
STATUS: APPROVED — Effective public API / backend contract
Approved: 2026-08-21 by Leandro Espinosa, CEO / Project Owner
Effective: YES
Supersedes: operational SPEC-031 v0.2.0 (APPROVED in Sales Go-Live 0C; never
committed as a clean standalone artifact; evidence in
docs/specs/holding/SALES-GO-LIVE-0C-WIP-2026-08-21/ — NON_AUTHORITATIVE)
Last clean committed historical baseline: SPEC-031 v0.1.0
  (docs/specs/archive/SPEC-031-PUBLIC-SALES-API-AND-BACKEND-CONTRACT-v0.1.0.md)
Does NOT authorize code, SQL, bundle, InsForge, Mercado Pago, or SALES_STATUS=OPEN.
Does NOT duplicate SPEC-030 v0.3.0 catalog values.
```

## 1. Purpose

Adjust the public landing–backend contract so it follows SPEC-030 v0.3.0:
23 vendible SKUs, retired-code exclusion from checkout, November event
dates in public event payloads, and commercial windows owned by the backend.

Unchanged operations, error classes, capability model, webhook, and privacy
rules from SPEC-031 v0.2.0 are carried forward.

## 2. Authority sources

1. Project Owner authorization `RELAUNCH-DELTA-SPEC-DRAFT` (2026-08-21).
2. SPEC-030 v0.3.0 APPROVED (catalog/commercial authority).
3. SPEC-031 v0.2.0 was operationally APPROVED in Sales Go-Live 0C but never
   committed as a clean standalone artifact; evidence is in the 0C holding
   (NON_AUTHORITATIVE). Last clean committed baseline is v0.1.0 in archive.
4. SPEC-000 v0.2.0, SPEC-001 v0.1.0, SPEC-011 v0.1.0.

SPEC-030 remains authority for catalog values, journeys, prices, and MSI.
This specification does not alter those values.

## 3. Context

```text
Vendible products: 23
Retired from sale (not checkout-eligible): 5
Journeys: J1–J5 (unchanged shapes)
Public event dates: 2026-11-13 .. 2026-11-15
SALES_STATUS: CLOSED
```

## 4. Scope

- public event date fields;
- catalog listing cardinality and visibility of retired codes;
- checkout eligibility / fail-closed for retired codes;
- dependency of stage resolution on SPEC-030 v0.3.0 windows.

## 5. Non-goals

No new endpoints, no 23 product-specific flows, no MSI redesign, no awards
API, no Simulacro Pro API, no SQL, no bundle regen, no `SALES_STATUS=OPEN`.

## 6. Definitions

Carry-forward of SPEC-031 v0.2.0. `RETIRED_FROM_SALE` as defined in SPEC-030
v0.3.0 DRAFT.

## 7. Invariants and requirements

Carry-forward: R001–R003, R005–R049 except where replaced below; R201–R202,
R204–R217.

Payment, webhook, redirect-non-authority, and opaque-ID invariants MUST remain
unchanged.

### SPEC-031-R004 (REPLACED)

**v0.2.0:** support the 28 products and J1–J5; MUST NOT define 28
product-specific endpoints.

**v0.3.0:** The contract MUST support the 23 vendible products and five
reusable journeys approved by SPEC-030 v0.3.0. It MUST NOT define 23 (or 28)
product-specific endpoints or flows.

### SPEC-031-R006 (REPLACED overlay)

OP-PUB-01 successful response MUST expose event starts/ends as
`2026-11-13` / `2026-11-15` and timezone `America/Merida` once the approved
catalog is implemented. This draft does not implement that payload.

### SPEC-031-R203 (REPLACED)

**v0.2.0:** stage earlier-of calendar vs threshold “as defined in SPEC-030
v0.2.0”.

**v0.3.0:** Stage for a SKU MUST be the earlier of calendar stage end versus
cumulative threshold exhaustion as defined in SPEC-030 v0.3.0 (windows R201 /
close R202).

### SPEC-031-R301 (NEW)

The default public catalog (OP-PUB-02) MUST list the 23 vendible products or
an authorized visible subset of them. Codes in `RETIRED_FROM_SALE` MUST NOT
appear as purchasable/checkout-eligible items.

### SPEC-031-R302 (NEW)

OP-PUB-03 / OP-PUB-04 for a `RETIRED_FROM_SALE` code MUST fail closed before
capacity hold or Mercado Pago preference. Public error MUST be an explicit
stable class such as `PRODUCT_NOT_AVAILABLE` (existing) or a later-approved
`PRODUCT_RETIRED` alias. Silent success, silent remap to another SKU, or
treating retired as `SOLD_OUT` of an active product is forbidden.

### SPEC-031-R303 (NEW)

Catalog and checkout responses MUST NOT treat landing `DIA` as a backend
session enum. Saturday `FULL_DAY` MUST be represented distinctly from `AM` /
`PM` once the session token is implemented (SPEC-032). Until the CHECK
constraint changes, this remains a contract requirement, not a schema change.

## 8. Functional requirements

OP-PUB-01..10 remain the operation set. Changed rows only:

| Operation | v0.2.0 | v0.3.0 DRAFT |
|---|---|---|
| OP-PUB-01 | Event dates from SPEC-030 v0.2.0 | Dates from SPEC-030 v0.3.0 (13–15 Nov) |
| OP-PUB-02 | “28 products or publicly visible subset” | “23 vendible products or publicly visible subset”; retired excluded from purchasable list |
| OP-PUB-04 | Product exists and sales allow checkout | Also: product MUST be vendible (not `RETIRED_FROM_SALE`) |

`PRODUCT_NOT_AVAILABLE` remains valid for hidden/inactive/retired-from-sale.

## 9. Non-functional requirements

Carry-forward: rate limiting still required before production; client clock
MUST NOT set stage (R202).

## 10. Interfaces and contracts

Unchanged capability / error / audit shapes except cardinality and retirement
eligibility above.

## 11. Failure modes

| Failure | Response |
|---|---|
| Retired SKU checkout | R302 fail-closed; zero preference |
| Client-supplied November vs October dates | Ignored; server event identity wins |
| Using frozen MSI bundle as v0.3.0 proof | Forbidden |

## 12. Security and privacy

Carry-forward of SPEC-031 v0.2.0. Retired codes MUST NOT leak extra PII.

## 13. Acceptance criteria

v0.2.0 AC001–AC204 remain historical. New/replaced (defined, not executed):

### SPEC-031-AC004 (overlay)

Journey coverage is 23 vendible SKUs / five templates, not 28 product flows.

### SPEC-031-AC201 (overlay)

Stage/price authority uses SPEC-030 v0.3.0 windows (close 7 Nov).

### SPEC-031-AC301 (NEW)

Public catalog count of checkout-eligible SKUs = 23; five retired codes are
not checkout-eligible (R301–R302).

### SPEC-031-AC302 (NEW)

OP-PUB-01 dates 13–15 Nov after implementation; this draft performs no runtime
check.

## 14. Validation plan

Documentary only. No tests executed.

## 15. Traceability

| Requirement | Source | Implementation this unit | State |
|---|---|---|---|
| R004, R203, R301–R303 | SPEC-030 v0.3.0 DRAFT | none | DRAFT |
| R001–R003, R201–R202, R204–R217 | v0.2.0 | none | CARRIED_FORWARD |

## 16. Open decisions

Same as SPEC-030 v0.3.0 DRAFT for OD-RELAUNCH-001..004. No additional API
decision is required to review this draft.

## 17. Change log

| Version | Date | Status | Actor | Reason |
|---|---|---|---|---|
| 0.3.0 | 2026-08-21 | DRAFT | Cursor, authorized by Project Owner | Align public API contract to 23 vendible SKUs, retired fail-closed, November dates. |
| 0.3.0 | 2026-08-21 | APPROVED | Leandro Espinosa, CEO / Project Owner | Explicit human approval after READY_FOR_APPROVAL. Supersedes operational v0.2.0 (never committed as a clean artifact; evidence in 0C holding). Last clean committed baseline remains v0.1.0 in archive. No implementation or SALES_STATUS=OPEN. |

## Appendix CF

| Requirement | Disposition |
|---|---|
| R004, R006 overlay, R203 | REPLACED |
| R301–R303 | NEW |
| Remaining R001–R049 / R201–R217 | CARRIED_FORWARD |

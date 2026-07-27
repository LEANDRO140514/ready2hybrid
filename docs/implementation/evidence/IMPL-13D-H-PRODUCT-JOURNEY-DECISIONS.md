# IMPL-13D-H — Product, Price, and Journey Decisions (Human Approval)

```text
Unit: IMPL-13D-H — Human product / price / journey decision pack
Mode: HUMAN APPROVAL · DOCUMENTARY ONLY · NO CODE · NO DEPLOY · NO MP · NO MAIN WRITES · NO PRICE MUTATION
Local datetime (America/Merida): 2026-07-26
Prior unit: IMPL-13D — Remaining journeys and product decision preflight (READ_ONLY)
Ready2Hybrid HEAD at approval packaging: bcea91c
Landing HEAD at approval packaging: 9b9cf48
Human decision: APPROVED
Final status: APPROVED / CLOSED
Gate: READY_FOR_IMPL_13E_PUBLIC_PRESS_SANDBOX_PREPARATION
```

## 1. Authority

```text
Human approval authority: Leandro Espinosa — Project Owner
Human approval date: 2026-07-26
```

## 2. Status of related units

| Unit | Status |
|---|---|
| IMPL-13C | `VALIDATED / CLOSED` (unchanged; payment not repeated) |
| IMPL-13D | Read-only preflight completed; input to this pack |
| IMPL-13D-H | `APPROVED / CLOSED` |
| IMPL-13E | Prepared / awaiting separate execution authorization |

## 3. Price decision (OPCIÓN B)

For currently misaligned families:

```text
WOD-*
IND-*
HALF-IND-*
DOB-*
HALF-DOB-*
REL-*
```

```text
OPCIÓN B — APPROVED
```

Commercial decision:

```text
Landing visible prices = commercial target prices.
Ready2Hybrid Main canonical prices MUST be updated later
in a separate, controlled, validated, and audited unit.
```

Target prices (MXN):

| Family | Target unit price (MXN) |
|---|---:|
| WOD-* | 350 |
| IND-* | 1,500 |
| HALF-IND-* | 850 |
| DOB-* | 2,500 |
| HALF-DOB-* | 1,700 |
| REL-* | 3,400 |

Explicit non-authorizations of this decision:

```text
Does NOT authorize modifying Main prices in this unit
Does NOT authorize modifying historical orders
Landing MUST NEVER send price, subtotal, total, or amount to the backend
Ready2Hybrid remains canonical authority for:
  product · price · capacity · allowed quantity · total ·
  payment state · tickets · credentials · entitlements
```

## 4. Next implementation unit — IMPL-13E

```text
IMPL-13E — Public and press single-day sandbox expansion
Status: PREPARED / AWAITING_EXECUTION_AUTHORIZATION
```

Included products (prices already aligned landing ↔ Main):

```text
PUB-SAB
PUB-DOM
FOT-VIE
FOT-SAB
FOT-DOM
```

Rules:

| Product codes | Quantity | Waiver | Roster | Extra personal data |
|---|---|---|---|---|
| PUB-SAB / PUB-DOM | ≥ 1 | not required | not required | not required |
| FOT-VIE / FOT-SAB / FOT-DOM | = 1 | not required | not required | not required |

Must reuse (no redesign):

```text
createCheckout
get-order-status
public_order_reference
sessionStorage
idempotency
submit lock
/checkout/confirmando
authoritative polling
Origin guard fail-closed
feature flags
productive host protection
```

```text
Do not repeat PUB-VIE payment unless a concrete, justified,
and separately authorized regression need exists.
```

## 5. Multiday — remain fail-closed

```text
PUB-3D
FOT-3D
```

```text
FAIL-CLOSED
NOT AVAILABLE FOR CHECKOUT
Pending formal OD-020 resolution
Price alignment does NOT authorize opening
Not in IMPL-13E scope
```

## 6. Journeys outside IMPL-13E (not cancelled)

Still in overall Ready2Hybrid approved scope; **out of IMPL-13E only**:

```text
WOD-*
IND-*
HALF-IND-*
DOB-*
HALF-DOB-*
REL-*
```

Recommended later technical sequence (not an execution authorization):

1. **Workout** — after canonical price update/validation; qty=1; no competitive waiver; no roster.
2. **Individual competitor** — IND-* / HALF-IND-*; qty=1; participant form; mandatory waiver UX (reusable base).
3. **Teams** — DOB-* / HALF-DOB-* / REL-*; captain checkout; full payment; roster_invitations; individual member waivers; team-roster; `PAID_ROSTER_INCOMPLETE` → `ELIGIBLE`; per-member tickets. Captain must never accept another member's waiver.

Implementing individuals before teams is a **technical reuse sequence**, not a reduction of team scope.

## 7. Abuse / rate-limiting gate

```text
PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING = OPEN
REQUIRED BEFORE PRODUCTION / NOT CLOSED
```

Must close before:

```text
Main EN_VENTA
productive landing checkout
public sales
```

Minimum coverage required (still to be designed/implemented in a later unit):

```text
effective rate limiting
observability
alerts
bots
idempotency-key flooding
mass preference creation
IP or equivalent signal limits
Mercado Pago degradation / unavailability
operational response to abuse
```

```text
Does NOT block IMPL-13E in a controlled sandbox.
Must NOT be implemented inside IMPL-13E.
```

## 8. Payment methods (unchanged)

```text
In scope: immediate card · approved · rejected
Out of scope: pending · OXXO · Paycash · vouchers · async methods · new CONT tests
```

## 9. Continuing restrictions

This approval does **not** authorize:

```text
Main EN_VENTA
public sales
real (non-test) payments
productive credentials / webhook / topics
OXXO / Paycash / vouchers
multiday products
waiver inside IMPL-13E
roster inside IMPL-13E
general redesign / brand / media changes
price mutation of Main in this documentary unit
```

## 10. Distinctions recorded for operators

```text
Commercial target prices          = APPROVED (landing-visible targets)
Main canonical price update       = PENDING separate approved unit
IMPL-13E                          = single-day public/press sandbox products only
WOD / individual / teams          = later journeys; NOT cancelled
Multiday PUB-3D / FOT-3D          = fail-closed pending OD-020
Production                        = blocked by abuse/rate limiting
```

## 11. Documentary packaging scope

Authorized files for this unit (documentary only):

```text
docs/implementation/evidence/IMPL-13D-H-PRODUCT-JOURNEY-DECISIONS.md
docs/implementation/IMPL-0-SALES-IMPLEMENTATION-TRACEABILITY.md
WORKSPACE_STATUS.md
```

```text
Git: documentary commit only
InsForge writes: 0
Mercado Pago reads/writes: 0
Main price rows: unchanged
IMPL-13E implementation: NOT STARTED in this unit
```

## 12. Gate

```text
IMPL-13D-H = APPROVED / CLOSED
READY_FOR_IMPL_13E_PUBLIC_PRESS_SANDBOX_PREPARATION
PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING = REQUIRED BEFORE PRODUCTION / NOT CLOSED
```

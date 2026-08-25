---
id: SPEC-030
title: Public Sales Catalog and Registration Journeys
status: APPROVED
version: 0.3.0
phase: RELAUNCH-DELTA-SPEC-DRAFT
created_at: 2026-08-21
approved_at: 2026-08-21
approved_by: Leandro Espinosa, CEO / Project Owner
approval_basis: Explicit human authorization after independent review READY_FOR_APPROVAL; Option 3 governance exception (v0.2.0 operational APPROVED never committed as a clean artifact)
supersedes:
  - SPEC-030 v0.2.0
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-011 v0.1.0
compatible_with:
  - SPEC-040 v0.1.1
  - SPEC-031 v0.3.0
  - SPEC-032 v0.3.0
---

# SPEC-030 v0.3.0 — Public Sales Catalog and Registration Journeys

```text
STATUS: APPROVED — Effective commercial/API/integrity contract
Approved: 2026-08-21 by Leandro Espinosa, CEO / Project Owner
Effective: YES
Supersedes: operational SPEC-030 v0.2.0 (APPROVED in Sales Go-Live 0C; never
committed as a clean standalone artifact; evidence in
docs/specs/holding/SALES-GO-LIVE-0C-WIP-2026-08-21/ — NON_AUTHORITATIVE)
Last clean committed historical baseline: SPEC-030 v0.1.0
  (docs/specs/archive/SPEC-030-PUBLIC-SALES-CATALOG-AND-REGISTRATION-JOURNEYS-v0.1.0.md)
This approval does NOT authorize code, SQL, migrations, seeds, bundle regen,
Main, landing writes, InsForge, Mercado Pago, secrets, deploy, payments,
commit, push, or SALES_STATUS=OPEN.
```

## 1. Purpose

Propose the relaunch commercial contract for Hybrid Experience 2026 after the
landing-master delta at `hybrid-event-landing@5fc0acb`:

- event dates 13–15 November 2026;
- 23 vendible SKUs;
- five historical codes `RETIRED_FROM_SALE` without destructive delete;
- commercial windows through 7 November 2026;
- day/session redistribution including Saturday `FULL_DAY`;
- transfer rule as D-14 with derived date 2026-10-30 for this edition.

Unchanged obligations from SPEC-030 v0.2.0 are carried forward by identifier.
This draft does not redesign prices, MSI eligibility, journeys J1–J5 shapes,
payment authority, QR opacity, or `SALES_STATUS`.

## 2. Authority sources

1. Explicit Project Owner authorization of unit `RELAUNCH-DELTA-SPEC-DRAFT`
   dated 2026-08-21 America/Merida (this document’s product instruction).
2. External commercial source of the delta: `hybrid-event-landing` `main`
   @ `5fc0acb` (read-only; not a Ready2Hybrid implementation authority).
3. SPEC-030 v0.2.0 `APPROVED` (effective until this draft is approved).
4. Sales Go-Live 0B-2 staged pricing and MSI (prices/MSI of surviving SKUs).
5. Sales Go-Live 0B-3 policies; transfer relative rule in `docs/04_REVISION_FINAL.md`
   (“transferencia de lugar hasta 14 días antes”).
6. `CURSOR_START_PROMPT.md`, `MANIFEST.md`, `WORKSPACE_STATUS.md`.
7. `docs/00_CICLO_DEL_EVENTO.md` through `docs/05_ANEXO_PLAN_TECNICO.md`.
8. SPEC-000 v0.2.0, SPEC-001 v0.1.0, SPEC-011 v0.1.0.

### Authority conflict recorded, not silently resolved

`docs/02_PLAN_DESARROLLO_CON_CURSOR.md` §3 still states “viernes 9 de octubre
de 2026”. `WORKSPACE_STATUS.md` still records “Evento: viernes 9 de octubre
de 2026”. Those files are **not** modified by this unit.

SPEC-000-R002 forbids silent resolution. SPEC-000 also states that explicit
current decisions of the human project authority may change product. This
version is APPROVED and effective. v0.2.0 was operationally APPROVED in
Sales Go-Live 0C but was never committed as a clean standalone artifact;
evidence is preserved in
`docs/specs/holding/SALES-GO-LIVE-0C-WIP-2026-08-21/` (NON_AUTHORITATIVE).
Last clean committed baseline is v0.1.0 in `docs/specs/archive/`. A later
documentary unit MUST migrate stale `docs/02`. This specification is **not**
`BLOCKED_BY_AUTHORITY_CONFLICT`.

0B-3 froze competitive transfer as calendar date `2026-09-25` for the October
edition. That date is D-14 relative to `2026-10-09`. `docs/04` states the
relative 14-day rule. This draft restores the relative rule (D-14) and records
the derived date for the November edition. It does not invent a new transfer
policy.

`docs/04_REVISION_FINAL.md` review table row 6 still states online close as
“48 h antes del evento”. Sales Go-Live 0B-3 already replaced that relative
rule with an edition calendar close; this draft continues that calendar
pattern as R201/R202 (`SALES_CLOSED` at `2026-11-08 00:00 America/Merida`).
Row 6 is **stale** for this edition and MUST NOT be treated as competing
close policy. This unit does not modify `docs/04`.

## 3. Context

```text
Code: HEX-2026
Display name (SPEC-030 historical): Hybrid Experience 2026
Landing eventConfig.name: The Hybrid Experience  (OD-RELAUNCH-001, non-blocking)
City: Mérida, Yucatán
Timezone: America/Merida
Starts: 2026-11-13
Ends: 2026-11-15
Seed / Main lifecycle status: CONFIGURADO
SALES_STATUS: CLOSED (this spec MUST NOT open sales)
```

Vendible catalog:

```text
COMPITE:     8
EXPERIENCE:  7
ASISTE:      8
VENDIBLE:   23
RETIRED_FROM_SALE (identifiers preserved): 5
HISTORICAL CODE SET: 28
```

`SALES-GO-LIVE-0C-*` evidence (Pricing-A, MSI-A, BUNDLE-REGEN frozen) remains
valid only for the October / 28-SKU contract. It MUST NOT be reused as
validation of this draft.

## 4. Scope

- event dates and three event days;
- commercial stage windows and online close;
- vendible catalog of 23 SKUs and non-destructive retirement of five codes;
- day/session mapping including `FULL_DAY`;
- surviving staged prices and MSI matrix (unchanged amounts);
- journey membership lists;
- transfer deadline as D-14;
- future implementation impact (migration, pricing, bundle, tests);
- open/deferred items that this relaunch does not close.

## 5. Non-goals

This draft does not:

- approve itself;
- modify SPEC-030/031/032 v0.2.0 files;
- modify `docs/00–05`;
- write SQL, migrations, seeds, RLS, Edge Functions, or bundles;
- apply or rewrite `0018_staged-commercial-pricing.sql`;
- change `handler.deploy.js`, `staged-pricing.ts`, `journeys.ts`, or tests;
- open `SALES_STATUS`;
- persist or model landing awards/prizes;
- create a Ready2Hybrid product or backend for Simulacro Pro;
- change MSI policy, price amounts, or quota 30/45/25 shares;
- alter payment, webhook, QR-opacity, or InsForge-authority invariants;
- modify the current `session IN ('AM','PM')` CHECK constraint;
- invent heats or clock times beyond day + general session;
- resolve pre-existing PUB/FOT `AM` vs `NULL` session mismatch;
- resolve the event display-name mismatch.

## 6. Definitions

Carry-forward of SPEC-030 v0.2.0 definitions, plus:

- **Vendible catalog:** SKUs offered to buyers and eligible for checkout when
  sales are otherwise open, capacity exists, and enablement rules pass.
- **RETIRED_FROM_SALE:** A historical product code that MUST NOT be offered,
  MUST NOT start checkout, and MUST NOT count as commercially active, while
  its identifier and any historical records remain preservable. Physical
  persistence mechanism is out of scope.
- **FULL_DAY:** Domain session meaning “día completo” for Saturday competitive
  and experience products in this edition.
- **ALL_DAY:** Recommended implementation candidate for persisting domain
  `FULL_DAY`. Distinct from `AM` and `PM`. Subject to `OD-RELAUNCH-004`
  (`OPEN`). This draft MUST NOT treat `ALL_DAY` as a closed physical token.
- **DIA:** Spanish UI label only. MUST NOT be treated as a Ready2Hybrid
  session enum value in this draft.

Sale states remain: `COMING_SOON`, `AVAILABLE`, `LOW_AVAILABILITY`,
`SOLD_OUT`, `SALES_CLOSED`, `CANCELLED`. Retired SKUs are not `CANCELLED` by
default unless a later authorized unit maps them that way; commercially they
are `RETIRED_FROM_SALE`.

## 7. Invariants and requirements

### Carry-forward (unchanged meaning)

The following v0.2.0 requirements KEEP their identifiers and normative
meaning, except where a later R301+ overlay or a REPLACED_BY row in the change
matrix applies: R003–R006, R008–R025, R027–R038, R203–R205, R208–R230,
R232–R235.

Payment, QR, privacy, webhook, and InsForge-authority invariants (R018–R022,
R030–R032) MUST remain unchanged (SPEC-000-R026).

### SPEC-030-R001 (REPLACED)

**v0.2.0:** launch catalog exactly 28 unique codes (13+7+8).

**v0.3.0:** The **vendible** launch catalog MUST contain exactly 23 unique
product codes: 8 `COMPITE`, 7 `EXPERIENCE`, and 8 `ASISTE`. Five additional
historical codes listed in R301 MUST exist as `RETIRED_FROM_SALE` identifiers
and MUST NOT be counted in the 23.

### SPEC-030-R002 (REPLACED)

**v0.2.0:** all 28 products represented as launch products.

**v0.3.0:** All 23 vendible products MUST be represented as launch products,
subject to sales opening, capacity, configuration, technical validation, and
separate production authorization. Retired codes MUST NOT be represented as
vendible launch products.

### SPEC-030-R007 (REPLACED)

**v0.2.0:** the 28 products MUST use J1–J5.

**v0.3.0:** The 23 vendible products MUST use the five reusable journey
templates J1–J5. The system MUST NOT create a separate business flow per
product code. Retired codes MUST NOT be assigned an active purchase journey.

### SPEC-030-R026 (REPLACED)

**v0.2.0:** `PUB-3D` / `FOT-3D` cover 2026-10-09 through 2026-10-11.

**v0.3.0:** `PUB-3D` and `FOT-3D` MUST represent one three-day entitlement
covering `2026-11-13`, `2026-11-14`, and `2026-11-15`. Access on one covered
date MUST NOT invalidate access on later covered dates. Mechanism remains
open in OD-020; checkout remains fail-closed until OD-020 (R208 unchanged).

### SPEC-030-R201 (REPLACED)

**v0.2.0:** inclusive windows 10–23 Aug / 24 Aug–13 Sep / 14 Sep–2 Oct.

**v0.3.0:** Sales MUST use exactly three ordered stages evaluated in
`America/Merida`. Implementation SHOULD use half-open intervals `[start, end)`
so contracts are not defined on `23:59:59.999`.

| Stage | Inclusive commercial reading | Half-open instant `[start, end)` |
|---|---|---|
| LANZAMIENTO | 2026-08-11 00:00 through 2026-08-31 | `[2026-08-11 00:00:00, 2026-09-01 00:00:00)` |
| PREVENTA | 2026-09-01 00:00 through 2026-09-30 | `[2026-09-01 00:00:00, 2026-10-01 00:00:00)` |
| REGULAR | 2026-10-01 00:00 through 2026-11-07 | `[2026-10-01 00:00:00, 2026-11-08 00:00:00)` |

This draft MUST NOT encode SQL timestamps. Future implementation MUST pick
one representation and keep it equivalent to the table above.

### SPEC-030-R202 (REPLACED)

**v0.2.0:** `SALES_CLOSED` at and after 2026-10-02 23:59:59 America/Merida.

**v0.3.0:** Online sales MUST be `SALES_CLOSED` for new checkouts at and after
the Regular window end in R201 (half-open: `now >= 2026-11-08 00:00:00
America/Merida`), regardless of remaining inventory. Commercial close date is
**2026-11-07**. This spec MUST NOT set `SALES_STATUS=OPEN`.

### SPEC-030-R206 (REPLACED)

**v0.2.0:** canonical catalog remains 28 SKUs unchanged from v0.1.0.

**v0.3.0:** The vendible catalog MUST be the 23 codes in section 8.1.
Historical identifiers of the five retired codes MUST remain in the Ready2Hybrid
code vocabulary (R301). Codes of surviving SKUs MUST NOT be renamed.

### SPEC-030-R207 (REPLACED)

**v0.2.0:** 26 enableable SKUs excluding `PUB-3D` and `FOT-3D`.

**v0.3.0:** Initial enableable SKUs for sales opening are the 21 vendible
codes that exclude `PUB-3D` and `FOT-3D`. Retired codes are not enableable.

### SPEC-030-R231 (REPLACED)

**v0.2.0:** competitive transfer until 2026-09-25 23:59 America/Merida.

**v0.3.0:** Competitive transfer: at most one per inscription until **14
calendar days before event start** (D-14); substitute completes data/docs;
same category.

The sole normative close boundary is half-open. Transfer is allowed while
`now` is strictly before the local midnight that starts the calendar day
after the derived deadline day. `23:59:59` is not a contractual instant.

For this edition (`starts_on = 2026-11-13`) the derived deadline **day** is
**2026-10-30** `America/Merida`. The exclusive temporal authority is:

```text
transfer allowed while:  now <  2026-10-31 00:00:00 America/Merida
transfer closed when:    now >= 2026-10-31 00:00:00 America/Merida
```

`2026-10-30` is an edition-derived calendar value of D-14, not an independent
policy. Authority: `docs/04` relative 14-day rule; 0B-3 `2026-09-25` was the
derived date of the October edition, not a competing relative policy.

### SPEC-030-R301 (NEW)

The following codes MUST be `RETIRED_FROM_SALE` for this edition:

```text
IND-PRO-H
IND-PRO-M
DOB-VIE-HH
DOB-VIE-MH
DOB-SAB-MM
```

They MUST NOT be offered to buyers, MUST NOT start checkout, and MUST NOT
count as commercially active. Their identifiers MUST remain preservable.
Historical records linked to them MUST NOT be destroyed by this contract.
This requirement MUST NOT be implemented as a silent DELETE of rows. Physical
persistence (flag, sale_state, separate table, or other) is a later
implementation decision.

### SPEC-030-R302 (NEW)

Individual Pro is not a vendible product of the current event. Landing flag
`SIMULACRO_PRO_ACTIVE = false` MUST NOT create a Ready2Hybrid product, SKU,
journey, cupo, or checkout path. Classify as
`FUTURE / DORMANT / OUT OF CURRENT SALES CONTRACT`. No Simulacro Pro backend
is in scope.

### SPEC-030-R303 (NEW)

HEX-2026 MUST have exactly three event days:

| Date | Public day | General session occupancy |
|---|---|---|
| 2026-11-13 | Viernes 13 | PM: `DOB-VIE-MM`, `IND-H`, `IND-M` |
| 2026-11-14 | Sábado 14 | FULL_DAY: `DOB-SAB-HH`, `DOB-SAB-MH`, `HALF-*`, `WOD-*` |
| 2026-11-15 | Domingo 15 | AM: `REL-4H`, `REL-4M`, `REL-2H2M` |

ASISTE single-day products follow the same calendar dates (PUB/FOT Vie/Sáb/Dom
and 3-day). No heats or clock times are specified. Future data change MUST
use a **new** migration on already-seeded Main; historical applied seeds
`0002` / `0004` MUST NOT be rewritten.

### SPEC-030-R304 (NEW)

Saturday vendible competitive and experience products listed in R303 MUST use
domain session `FULL_DAY` (día completo). Saturday 14 MUST represent a
full-day session. `FULL_DAY` MUST NOT silently degrade to `AM`. `FULL_DAY`
MUST NOT silently degrade to `PM`. Any future persistence of that Saturday
occupancy MUST preserve `FULL_DAY` semantics.

UI MAY display Spanish label `DIA` / “Día completo”. `DIA` is not a
Ready2Hybrid session enum value.

`ALL_DAY` is a recommended implementation candidate and SHOULD be considered
when a later authorized migration extends the session CHECK. That candidate
remains subject to `OD-RELAUNCH-004` (`OPEN` / implementation-blocking, not
approval-blocking). This requirement MUST NOT close `ALL_DAY` as the
mandatory physical token. A later authorized migration MAY add `ALL_DAY` or
an equivalent approved token only after `OD-RELAUNCH-004` is resolved. The
current database CHECK (`session IS NULL OR session IN ('AM','PM')`) MUST
NOT be modified by this specification.

### SPEC-030-R305 (NEW)

Staged price amounts and MSI eligibility of the 23 surviving SKUs MUST remain
those approved in SPEC-030 v0.2.0 / 0B-2 (`PRICING_VALUES_MATCH` vs landing
`5fc0acb`). This relaunch MUST NOT redesign prices or MSI policy. MSI MUST be
revalidated later against an implemented v0.3.0; frozen bundle evidence MUST
NOT be reused as that validation.

### SPEC-030-R306 (NEW)

Landing awards/prizes copy is `DEFERRED / NOT_IMPLEMENTED_YET`. This
specification MUST NOT add persistence, journeys, or results/podium
requirements for prizes.

### SPEC-030-R307 (NEW)

This specification MUST NOT open sales. `SALES_STATUS` remains closed until a
separate production authorization.

## 8. Functional requirements

### 8.1 Official vendible catalog

Prices are MXN integer cents for the full sale unit, resolved by commercial
stage under R201–R216 and R305. Landing MUST NOT treat any single column as
static backend authority.

#### COMPITE — 8 vendible products

| Code | Product | Members | Lanzamiento | Preventa | Regular | MSI | Initial capacity | Day/session | Chip | Insurance | Journey |
|---|---|---:|---:|---:|---:|---|---:|---|---|---|---|
| DOB-VIE-MM | Dobles Mujeres · Viernes | 2 | 250000 | 275000 | 300000 | Yes | 40 teams | 2026-11-13 PM | Yes | Yes | J2 |
| DOB-SAB-HH | Dobles Hombres · Sábado | 2 | 250000 | 275000 | 300000 | Yes | 40 teams | 2026-11-14 FULL_DAY | Yes | Yes | J2 |
| DOB-SAB-MH | Dobles Mixto · Sábado | 2 | 250000 | 275000 | 300000 | Yes | 40 teams | 2026-11-14 FULL_DAY | Yes | Yes | J2 |
| REL-4H | Relay 4 Hombres | 4 | 320000 | 350000 | 380000 | Yes | 20 teams | 2026-11-15 AM | Yes | Yes | J3 |
| REL-4M | Relay 4 Mujeres | 4 | 320000 | 350000 | 380000 | Yes | 20 teams | 2026-11-15 AM | Yes | Yes | J3 |
| REL-2H2M | Relay Mixto 2H+2M | 4 | 320000 | 350000 | 380000 | Yes | 20 teams | 2026-11-15 AM | Yes | Yes | J3 |
| IND-H | Individual Hombre Open | 1 | 150000 | 165000 | 180000 | Yes | 60 | 2026-11-13 PM | Yes | Yes | J1 |
| IND-M | Individual Mujer Open | 1 | 150000 | 165000 | 180000 | Yes | 60 | 2026-11-13 PM | Yes | Yes | J1 |

#### EXPERIENCE — 7 vendible products

| Code | Product | Members | Lanzamiento | Preventa | Regular | MSI | Initial capacity | Day/session | Chip | Insurance | Journey |
|---|---|---:|---:|---:|---:|---|---:|---|---|---|---|
| HALF-IND-M | ½ Hybrid Individual Mujer | 1 | 80000 | 90000 | 100000 | Yes | 50 | 2026-11-14 FULL_DAY | Yes | Yes | J1 |
| HALF-IND-H | ½ Hybrid Individual Hombre | 1 | 80000 | 90000 | 100000 | Yes | 50 | 2026-11-14 FULL_DAY | Yes | Yes | J1 |
| HALF-DOB-MM | ½ Hybrid Dobles Mujeres | 2 | 160000 | 180000 | 200000 | Yes | 30 teams | 2026-11-14 FULL_DAY | Yes | Yes | J2 |
| HALF-DOB-HH | ½ Hybrid Dobles Hombres | 2 | 160000 | 180000 | 200000 | Yes | 30 teams | 2026-11-14 FULL_DAY | Yes | Yes | J2 |
| HALF-DOB-MH | ½ Hybrid Dobles Mixto | 2 | 160000 | 180000 | 200000 | Yes | 30 teams | 2026-11-14 FULL_DAY | Yes | Yes | J2 |
| WOD-M | Workout Experience Mujer | 1 | 35000 | 35000 | 35000 | No | 60 | 2026-11-14 FULL_DAY | No | No | J4 |
| WOD-H | Workout Experience Hombre | 1 | 35000 | 35000 | 35000 | No | 60 | 2026-11-14 FULL_DAY | No | No | J4 |

#### ASISTE — 8 vendible products

| Code | Product | Kind | Unit size | Lanzamiento | Preventa | Regular | MSI | Initial capacity | Validity | Session | Chip | Insurance | Journey | Initial enablement |
|---|---|---|---:|---:|---:|---:|---|---:|---|---|---|---|---|---|
| PUB-VIE | Público · Viernes 13 | spectator | 1 | 25000 | 25000 | 25000 | No | 500 | 2026-11-13 | See OD-RELAUNCH-002 | No | No | J5 | Enableable |
| PUB-SAB | Público · Sábado 14 | spectator | 1 | 25000 | 25000 | 25000 | No | 500 | 2026-11-14 | See OD-RELAUNCH-002 | No | No | J5 | Enableable |
| PUB-DOM | Público · Domingo 15 | spectator | 1 | 25000 | 25000 | 25000 | No | 500 | 2026-11-15 | See OD-RELAUNCH-002 | No | No | J5 | Enableable |
| PUB-3D | Público · Pase 3 Días | spectator | 1 | 60000 | 60000 | 60000 | No | 300 | 2026-11-13 through 2026-11-15 | None | No | No | J5 | Fail-closed until OD-020 |
| FOT-VIE | Fotógrafo · Viernes 13 | press | 1 | 35000 | 35000 | 35000 | No | 30 | 2026-11-13 | See OD-RELAUNCH-002 | No | No | J5 | Enableable |
| FOT-SAB | Fotógrafo · Sábado 14 | press | 1 | 35000 | 35000 | 35000 | No | 30 | 2026-11-14 | See OD-RELAUNCH-002 | No | No | J5 | Enableable |
| FOT-DOM | Fotógrafo · Domingo 15 | press | 1 | 35000 | 35000 | 35000 | No | 30 | 2026-11-15 | See OD-RELAUNCH-002 | No | No | J5 | Enableable |
| FOT-3D | Fotógrafo · Pase 3 Días | press | 1 | 80000 | 80000 | 80000 | No | 20 | 2026-11-13 through 2026-11-15 | None | No | No | J5 | Fail-closed until OD-020 |

No price-amount exception vs landing `5fc0acb` / staged-pricing WIP was found
for these 23 SKUs.

#### Retired identifiers (not vendible)

| Code | Prior v0.2.0 role | v0.3.0 commercial state |
|---|---|---|
| IND-PRO-H | J1 Individual Pro Hombre · Domingo AM | RETIRED_FROM_SALE |
| IND-PRO-M | J1 Individual Pro Mujer · Domingo AM | RETIRED_FROM_SALE |
| DOB-VIE-HH | J2 Dobles Hombres · Viernes PM | RETIRED_FROM_SALE |
| DOB-VIE-MH | J2 Dobles Mixto · Viernes PM | RETIRED_FROM_SALE |
| DOB-SAB-MM | J2 Dobles Mujeres · Sábado AM | RETIRED_FROM_SALE |

### 8.2 Journey membership (updated lists only)

Outcome shapes R010–R016 are unchanged.

#### J1

Applies to `IND-H`, `IND-M`, `HALF-IND-M`, and `HALF-IND-H`.
Does **not** apply to `IND-PRO-H` / `IND-PRO-M`.

#### J2

Applies to `DOB-VIE-MM`, `DOB-SAB-HH`, `DOB-SAB-MH`, `HALF-DOB-MM`,
`HALF-DOB-HH`, and `HALF-DOB-MH`.
Does **not** apply to `DOB-VIE-HH`, `DOB-VIE-MH`, or `DOB-SAB-MM`.

#### J3 / J4 / J5

Unchanged code sets among vendible SKUs (`REL-*`, `WOD-*`, `PUB-*`, `FOT-*`).

## 9. Non-functional requirements

Carry-forward of v0.2.0 timezone, integer-cents, fail-closed, and audit
qualities. Stage evaluation remains `America/Merida` (no DST). Half-open
windows in R201 are the preferred implementation shape.

## 10. Interfaces and contracts

Unchanged conceptual public catalog / checkout / webhook boundaries from
v0.2.0, except catalog cardinality and retired-code exclusion as specified in
SPEC-031 v0.3.0 DRAFT. Landing remains a client, not price authority (R003,
R209).

## 11. Failure modes

Carry-forward of v0.2.0 payment/capacity/roster failures, plus:

| Failure | Required response |
|---|---|
| Checkout of a `RETIRED_FROM_SALE` code | Fail closed before preference / hold; no new commercial order |
| Mapping `FULL_DAY` to `AM` or `PM` without approval | Forbidden; treat as spec violation |
| Treating Simulacro Pro as a SKU | Forbidden |
| Reusing October/28-SKU validation evidence for this contract | Forbidden |
| Accidental apply of historical `insforge/migrations/0018_staged-commercial-pricing.sql` after APPROVED v0.3.0, without reconciling it to this contract | Artifact is October / 28-SKU, remains unapplied, and is `STALE / INCOMPATIBLE` with v0.3.0. MUST NOT silently become commercial authority. MUST NOT enable go-live progression. Progression MUST stay blocked until an authorized migration strategy is executed. This spec does not decide whether `0018` is replaced, superseded, or avoided by a later new migration. |
| Frozen `SALES-GO-LIVE-0C-MP-MSI-BUNDLE-REGEN` bundle (`FROZEN_BY_RELAUNCH_CONTRACT_CHANGE`) is deployed, used as runtime, or presented as v0.3.0 validation evidence | MUST NOT constitute valid v0.3.0 evidence. MUST NOT authorize SALES GO-LIVE. MUST NOT be treated as compatible solely because it passed prior-contract validation. Later regeneration MUST use v0.3.0-aligned sources and MUST be revalidated against the then-effective specs before go-live. This spec does not regenerate, test, or deploy the bundle. |

## 12. Security and privacy

Carry-forward of section 13 of SPEC-030 v0.2.0. No new personal-data
categories. Retired identifiers MUST NOT be used to resurrect checkout.

## 13. Acceptance criteria

Historical AC001–AC012 and AC201–AC204 remain in the v0.2.0 record. This
draft **does not re-run** them. New/replaced criteria for v0.3.0:

### SPEC-030-AC001 (REPLACED expected result)

Count vendible products by block; verify unique codes, staged prices, team
sizes, capacities, November dates, sessions, flags, journeys.

**Expected:** `8 + 7 + 8 = 23` vendible; five retired codes listed and not
checkout-eligible; prices of survivors match v0.2.0 / landing; seed not
executed.

### SPEC-030-AC201 (REPLACED method)

**Purpose:** Commercial stage windows and online close.

**Requirements:** R201, R202, R226, R307.

**Pass:** Stage resolution in `America/Merida` uses exactly these half-open
windows:

```text
LANZAMIENTO  [2026-08-11 00:00, 2026-09-01 00:00)
PREVENTA     [2026-09-01 00:00, 2026-10-01 00:00)
REGULAR      [2026-10-01 00:00, 2026-11-08 00:00)
```

Last visible commercial day is `2026-11-07`. New checkouts MUST be
`SALES_CLOSED` at and after `2026-11-08 00:00:00 America/Merida`. This
specification MUST NOT set `SALES_STATUS=OPEN`.

### SPEC-030-AC301 (NEW)

**Purpose:** Event dates.

**Requirements:** R303, context starts/ends.

**Pass:** Event starts 2026-11-13 and ends 2026-11-15; three event days only.

### SPEC-030-AC302 (NEW)

**Purpose:** Retired codes not checkout-eligible; identifiers preservable.

**Requirements:** R301, R001, R002, R207.

**Pass:** None of the five codes can start checkout; no requirement to DELETE
rows; historical identifiers remain named.

### SPEC-030-AC303 (NEW)

**Purpose:** Day/session redistribution.

**Requirements:** R303, R304, R007.

**Pass:** Individual Open Friday PM; Relay Sunday AM; Saturday listed products
`FULL_DAY`; `FULL_DAY` not equivalent to `AM` or `PM`.

### SPEC-030-AC304 (NEW)

**Purpose:** Surviving prices and MSI unchanged; awards and Simulacro Pro out
of scope; sales not opened.

**Requirements:** R305, R302, R306, R307.

**Pass:** 23 survivor amounts/MSI match v0.2.0; no prize persistence
requirement; no Pro SKU; `SALES_STATUS` not opened by this spec.

### SPEC-030-AC305 (NEW)

**Purpose:** Competitive transfer deadline is a relative D-14 rule, not a
frozen calendar date.

**Requirements:** SPEC-030-R231.

**Pass:** All of the following are observable from the contract:

1. The normative transfer rule is D-14 (14 calendar days before event start,
   `America/Merida`). The close boundary is half-open, not a `23:59:59`
   instant.
2. For event start `2026-11-13`, the derived deadline **day** is
   `2026-10-30`. The exclusive temporal authority is:

```text
transfer allowed while:  now <  2026-10-31 00:00:00 America/Merida
transfer closed when:    now >= 2026-10-31 00:00:00 America/Merida
```
3. `2026-10-30` is a derived value of this edition, not an independent
   policy.
4. A historical derived date such as `2026-09-25` (October edition / 0B-3)
   MUST NOT be treated as the universal transfer policy.
5. If event start changes, the deadline MUST be recalculated using D-14; a
   previous derived date MUST NOT be carried forward as-is.

These criteria are **defined only**. This unit MUST NOT execute them.

## 14. Validation plan

Documentary review of this DRAFT against landing `5fc0acb`, SPEC-030 v0.2.0,
and the Project Owner instruction. No runtime, SQL, or bundle tests.

## 15. Traceability

| Requirement | Source | v0.2.0 | v0.3.0 DRAFT | Implementation (this unit) | State |
|---|---|---|---|---|---|
| R001, R002, R007, R206, R207 | PO relaunch + landing catalog | 28 / 26 enableable | 23 vendible / 21 enableable | none | DRAFT |
| R201, R202 | landing `pricingStage.ts` | Oct close | Nov 7 close; Aug 11 start | none | DRAFT |
| R026 | landing dates | Oct 9–11 | Nov 13–15 | none | DRAFT |
| R231 | docs/04 D-14; 0B-3 derived Sep 25 | 2026-09-25 | D-14 → 2026-10-30 | none | DRAFT |
| R301–R307 | PO instruction | n/a | NEW | none | DRAFT |
| R018–R022, R030, R209–R222 | v0.2.0 / 0B-2 | unchanged | unchanged | none | CARRIED_FORWARD |
| AC301–AC305 | this draft | n/a | defined, not run | none | NOT_RUN |

## 16. Open decisions

Carry-forward of OD-001–OD-024 from v0.2.0 unless noted.

| ID | Decision | Status | Blocks this DRAFT | Notes |
|---|---|---|---|---|
| OD-023 | Sales opening / EN_VENTA | TARGET_SET_RELAUNCH | No | Calendar LANZAMIENTO now 2026-08-11; technical OPEN still separate |
| OD-022 | Saturday public label | OPEN | No | Now also FULL_DAY wording |
| OD-RELAUNCH-001 | Event display name | OPEN / NON-BLOCKING | No | Landing `The Hybrid Experience` vs SPEC `Hybrid Experience 2026` |
| OD-RELAUNCH-002 | PUB/FOT session AM vs NULL | OPEN / PREEXISTING | No | Not introduced by relaunch |
| OD-RELAUNCH-003 | Physical persistence of RETIRED_FROM_SALE | OPEN | No for draft; yes for impl | Flag vs state vs other; no DELETE |
| OD-RELAUNCH-004 | Canonical session token `ALL_DAY` vs other | OPEN / IMPLEMENTATION-BLOCKING, NOT APPROVAL-BLOCKING | No | Domain `FULL_DAY` is closed; physical token remains open. MUST NOT coerce `FULL_DAY` to AM/PM |

## 17. Deferred items

| Item | Classification |
|---|---|
| Landing awards / prize tables | DEFERRED / NOT_IMPLEMENTED_YET |
| Simulacro Pro backend | FUTURE / DORMANT / OUT OF CURRENT SALES CONTRACT |
| `docs/02` October calendar migration | DEFERRED documentary unit after APPROVED |
| CHECK constraint / ALL_DAY migration | Later implementation unit |
| MSI revalidation on v0.3.0 runtime | Later validation unit |
| Frozen BUNDLE-REGEN evidence reuse | Forbidden for this contract |

## 18. Change log

| Version | Date | Status | Actor | Reason |
|---|---|---|---|---|
| 0.3.0 | 2026-08-21 | DRAFT | Cursor, authorized by Project Owner | Formalize landing relaunch `5fc0acb`: Nov 13–15, 23 vendible SKUs, retired five codes, new windows, FULL_DAY, D-14 transfer. No implementation. |
| 0.3.0 | 2026-08-21 | DRAFT | Cursor, authorized correction pass | Independent review `CHANGES_REQUIRED`: decouple MUST from `ALL_DAY` (R304 / OD-RELAUNCH-004); name AC201 half-open windows and `2026-11-08 00:00` close; record `docs/04` row 6 as stale. Contract unchanged. |
| 0.3.0 | 2026-08-21 | DRAFT | Cursor, authorized correction completion | AC305 observable Pass for R231 (D-14; derived 2026-10-30; 2026-09-25 not universal; recalculate on date change). Failure modes: stale `0018` apply; frozen BUNDLE-REGEN vs v0.3.0. Contract unchanged. |
| 0.3.0 | 2026-08-21 | DRAFT | Cursor, authorized R2 boundary correction | R231/AC305: sole half-open close `now >= 2026-10-31 00:00:00 America/Merida`. Remove dual `23:59:59` authority. D-14 and derived day `2026-10-30` unchanged. |
| 0.3.0 | 2026-08-21 | APPROVED | Leandro Espinosa, CEO / Project Owner | Explicit human approval after READY_FOR_APPROVAL. Supersedes operational v0.2.0 (never committed as a clean artifact; evidence in 0C holding). Last clean committed baseline remains v0.1.0 in archive. No implementation or SALES_STATUS=OPEN. |

## Appendix CF — v0.2.0 → v0.3.0

| Requirement | Disposition | Compatibility |
|---|---|---|
| R001, R002, R007, R026, R201, R202, R206, R207, R231 | REPLACED_BY same ID + new text | Breaking vs October/28 contract; intended |
| R003–R006, R008–R025, R027–R038, R203–R205, R208–R230, R232–R235 | CARRIED_FORWARD | Compatible |
| R301–R307 | NEW | Additive |
| AC001, AC201 | REPLACED expected result/method | Breaking vs 28/Oct fixtures |
| AC301–AC305 | NEW | Additive; NOT_RUN |

## Appendix IMP — future implementation impact (NOT executed)

After APPROVED only, a separate unit would likely touch:

| Layer | Impact |
|---|---|
| Schema | Event dates; event_days; product day/session; retirement flag/state; session persistence of `FULL_DAY` (token candidate `ALL_DAY` or equivalent, `OD-RELAUNCH-004`) |
| Migration | **New** migration on Main (v10 catalog). Do not rewrite applied `0002`/`0004`. Do not modify 0002 CHECK in this spec. |
| Seed/data | Corrective data via new migration, not seed rewrite |
| Checkout | Reject retired codes; journey maps; entitlement dates |
| Staged pricing | `staged-pricing.ts` windows + 23-SKU matrix (later) |
| `0018` | Unapplied. **Recommend A:** leave `0018` frozen as Pricing-A artifact; author a new migration after approval covering windows + vendible catalog rather than silently editing `0018`. Option B (replace `0018` before any apply) remains available only with explicit PO authorization because it blurs Pricing-A hash evidence. **Do not apply `0018` as written** (October walls + 28 SKUs). |
| Bundle | Later regen of `handler.deploy.js`; frozen bundle MUST NOT validate v0.3.0 |
| Tests | Fixtures with 28 products, October dates, old walls, old journey lists, AM/PM-only sessions |

Protected WIP (`handler.deploy.js`, `staged-pricing.ts`, `0018`, tests, specs
v0.2.0, T2 `0017`) MUST remain untouched until a later authorized unit.

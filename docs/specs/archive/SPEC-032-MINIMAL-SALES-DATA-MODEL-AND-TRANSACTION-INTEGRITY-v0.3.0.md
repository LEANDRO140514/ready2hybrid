---
id: SPEC-032
title: Minimal Public Sales Data Model and Transaction Integrity
status: APPROVED
version: 0.3.0
phase: RELAUNCH-DELTA-SPEC-DRAFT
created_at: 2026-08-21
approved_at: 2026-08-21
approved_by: Leandro Espinosa, CEO / Project Owner
approval_basis: Explicit human authorization after independent review READY_FOR_APPROVAL; Option 3 governance exception (v0.2.0 operational APPROVED never committed as a clean artifact)
supersedes:
  - SPEC-032 v0.2.0
depends_on:
  - SPEC-000 v0.2.0
  - SPEC-001 v0.1.0
  - SPEC-030 v0.3.0
  - SPEC-031 v0.3.0
compatible_with:
  - SPEC-011 v0.1.0
  - SPEC-040 v0.1.1
---

# SPEC-032 v0.3.0 — Minimal Public Sales Data Model and Transaction Integrity

```text
STATUS: APPROVED — Effective logical sales-model contract
Approved: 2026-08-21 by Leandro Espinosa, CEO / Project Owner
Effective: YES
Supersedes: operational SPEC-032 v0.2.0 (APPROVED in Sales Go-Live 0C; never
committed as a clean standalone artifact; evidence in
docs/specs/holding/SALES-GO-LIVE-0C-WIP-2026-08-21/ — NON_AUTHORITATIVE)
Last clean committed historical baseline: SPEC-032 v0.1.0
  (docs/specs/archive/SPEC-032-MINIMAL-SALES-DATA-MODEL-AND-TRANSACTION-INTEGRITY-v0.1.0.md)
Does NOT authorize SQL, migrations, seeds, CHECK-constraint edits, or
SALES_STATUS=OPEN.
```

## 1. Purpose

Adjust the logical sales model so it can represent the relaunch catalog:

- event starts/ends 13–15 November 2026;
- three event days;
- 23 vendible products plus five `RETIRED_FROM_SALE` identifiers;
- Saturday `FULL_DAY` / recommended internal `ALL_DAY`;
- no silent coercion of `FULL_DAY` to `AM` or `PM`.

This is a logical-model delta. Physical DDL is out of scope.

## 2. Authority sources

1. Project Owner authorization `RELAUNCH-DELTA-SPEC-DRAFT` (2026-08-21).
2. SPEC-030 v0.3.0 APPROVED and SPEC-031 v0.3.0 APPROVED.
3. SPEC-032 v0.2.0 was operationally APPROVED in Sales Go-Live 0C but never
   committed as a clean standalone artifact; evidence is in the 0C holding
   (NON_AUTHORITATIVE). Last clean committed baseline is v0.1.0 in archive.
4. SPEC-000 v0.2.0, SPEC-001 v0.1.0.

Applied migrations `0001`–`0010` and seed `0004` remain historical physical
facts. This draft MUST NOT rewrite them.

## 3. Context

Main catalog is 28 seeded rows with October dates. The proposed logical
contract is 23 vendible + 5 retired identifiers, November dates, and
`FULL_DAY`. Bridging those facts requires a **future new migration**, not a
seed rewrite.

Current physical CHECK (historical, not modified here):

```text
session IS NULL OR session IN ('AM', 'PM')
```

## 4. Scope

- `Event` dates;
- `EventDaySession` occupancy and `FULL_DAY`;
- `Product` vendible vs retired;
- catalog identity appendix for COMPITE 8 + retired 5.

## 5. Non-goals

No tables for prizes/results; no Simulacro Pro entity; no actual ALTER; no
edit of `0018` or `0017`; no destructive DELETE of product rows; no
`SALES_STATUS=OPEN`.

## 6. Definitions

Carry-forward of SPEC-032 v0.2.0 plus SPEC-030 v0.3.0 `RETIRED_FROM_SALE`,
`FULL_DAY`, and `ALL_DAY`.

## 7. Invariants and requirements

Carry-forward: R001–R010, R014–R050 except where replaced below, including
money, snapshot, concurrency, RLS-deny-by-default, and audit invariants.

### SPEC-032-R011 (REPLACED overlay)

The logical `Event` entity MUST own public identity, timezone
`America/Merida`, `starts_on = 2026-11-13`, `ends_on = 2026-11-15`,
lifecycle, sales window per SPEC-030 v0.3.0, and public state.
`SALES_STATUS` is not opened by this spec.

### SPEC-032-R012 (REPLACED)

**v0.2.0:** EventDaySession represents date/session validity and the
unresolved Saturday-label correction.

**v0.3.0:** The logical `EventDaySession` entity MUST represent date/session
validity, public label, ordering, and occupancy for:

| Date | Session class | Occupying vendible products (SPEC-030) |
|---|---|---|
| 2026-11-13 | PM | `DOB-VIE-MM`, `IND-H`, `IND-M` |
| 2026-11-14 | FULL_DAY | `DOB-SAB-HH`, `DOB-SAB-MH`, `HALF-*`, `WOD-*` |
| 2026-11-15 | AM | `REL-4H`, `REL-4M`, `REL-2H2M` |

ASISTE single-day rows bind to the same dates. Saturday MUST NOT omit
approved Saturday products. `FULL_DAY` MUST NOT be stored or interpreted as
`AM` or `PM`.

OD-022 (public Saturday wording) remains open. OD-RELAUNCH-002 (PUB/FOT
session AM vs NULL) remains preexisting and unresolved.

### SPEC-032-R013 (REPLACED)

**v0.2.0:** Product entity configures all 28 unique products.

**v0.3.0:** The logical `Product` entity MUST configure all 23 vendible unique
products with block, journey, composition, team size, staged integer prices,
MXN, capacity/unit, benefits, schedule/validity, sale state, visibility, and
public order. It MUST also retain the five historical codes as
`RETIRED_FROM_SALE` (not vendible). It MUST NOT require physical DELETE of
those five rows.

### SPEC-032-R301 (NEW)

Future physical session tokens SHOULD use canonical `ALL_DAY` for domain
`FULL_DAY` if `OD-RELAUNCH-004` selects that candidate. UI label `DIA` is
not a persistence value. Adding any new session token to the CHECK
constraint requires a later approved migration. Until then, this
requirement is a recommendation only (`SHOULD`) and MUST NOT be read as
closing the physical token. The MUST prohibition on storing or interpreting
`FULL_DAY` as `AM` or `PM` lives in R012 and SPEC-030-R304, not here.

### SPEC-032-R302 (NEW)

A future implementation MUST apply catalog/date/session changes through a
**new** migration on already-seeded Main. Historical applied artifacts
(`0002` seed text, `0004` remote catalog, 0002 CHECK as applied) MUST remain
byte-historical. `0018` remains unapplied and MUST NOT be silently rewritten
in the spec unit; see SPEC-030 appendix IMP.

## 8. Functional requirements

Logical entities and TX boundaries of v0.2.0 remain. Visible-by-day rule:
Saturday `FULL_DAY` products MUST be associated to 2026-11-14 without forcing
an AM-only or PM-only occupancy that hides the other Saturday products.

## 9. Non-functional requirements

Integer cents, MXN, snapshot immutability, and concurrency fail-closed
carry forward. No prize or podium schema quality attribute is added.

## 10. Interfaces and contracts

Logical entity map unchanged except Event dates, EventDaySession `FULL_DAY`,
and Product retirement.

## 11. Failure modes

| Failure | Response |
|---|---|
| Persist FULL_DAY as AM or PM | Forbidden |
| DELETE of retired product identifiers to “match 23” | Forbidden by SPEC-030-R301 |
| Rewrite applied 0004 in place | Forbidden |

## 12. Security and privacy

Carry-forward. Retirement MUST NOT erase audit or historical order rows.

## 13. Acceptance criteria

Defined, not executed:

### SPEC-032-AC301 (NEW)

Logical event days = three dates 13–15 Nov 2026 (R011, R012).

### SPEC-032-AC302 (NEW)

Vendible product identity = 8 COMPITE + 7 EXPERIENCE + 8 ASISTE; five retired
codes named and not vendible (R013, R301 of SPEC-030).

### SPEC-032-AC303 (NEW)

**Purpose:** Saturday `FULL_DAY` occupancy; no silent degrade to `AM` or `PM`.

**Requirements:** R012; cross-spec SPEC-030-R304.

**Pass:** `FULL_DAY` occupancy on Saturday includes listed COMPITE/EXPERIENCE
products; `FULL_DAY` ≠ `AM` and ≠ `PM`. This criterion proves domain
semantics, not the choice of physical token `ALL_DAY`. SPEC-032-R301 is
not the authority for this criterion.

### SPEC-032-AC304 (NEW)

No prize tables and no Simulacro Pro entity are required (SPEC-030 R302,
R306).

## 14. Validation plan

Documentary. No SQL execution.

## 15. Traceability

| Requirement | Source | This unit | State |
|---|---|---|---|
| R011–R013, R301–R302 | SPEC-030 v0.3.0 DRAFT | none | DRAFT |
| Other R001–R050 | v0.2.0 | none | CARRIED_FORWARD |

## 16. Open decisions

OD-RELAUNCH-002, OD-RELAUNCH-003, OD-RELAUNCH-004 from SPEC-030 v0.3.0 DRAFT.
`OD-RELAUNCH-004` remains `OPEN` / implementation-blocking, not
approval-blocking. No additional model decision blocks this DRAFT review.

## 17. Change log

| Version | Date | Status | Actor | Reason |
|---|---|---|---|---|
| 0.3.0 | 2026-08-21 | DRAFT | Cursor, authorized by Project Owner | Logical model for November dates, 23 vendible + 5 retired, FULL_DAY. |
| 0.3.0 | 2026-08-21 | DRAFT | Cursor, authorized correction pass | Independent review `CHANGES_REQUIRED`: AC303 traces to R012 / SPEC-030-R304, not R301; R301 remains SHOULD/`OD-RELAUNCH-004`. Contract unchanged. |
| 0.3.0 | 2026-08-21 | APPROVED | Leandro Espinosa, CEO / Project Owner | Explicit human approval after READY_FOR_APPROVAL. Supersedes operational v0.2.0 (never committed as a clean artifact; evidence in 0C holding). Last clean committed baseline remains v0.1.0 in archive. No implementation or SALES_STATUS=OPEN. |

## Appendix B.3 replacement (logical identity)

| Block | Vendible count | Vendible codes |
|---|---:|---|
| COMPITE | 8 | `DOB-VIE-MM`, `DOB-SAB-HH`, `DOB-SAB-MH`, `REL-4H`, `REL-4M`, `REL-2H2M`, `IND-H`, `IND-M` |
| EXPERIENCE | 7 | `HALF-IND-M`, `HALF-IND-H`, `HALF-DOB-MM`, `HALF-DOB-HH`, `HALF-DOB-MH`, `WOD-M`, `WOD-H` |
| ASISTE | 8 | `PUB-VIE`, `PUB-SAB`, `PUB-DOM`, `PUB-3D`, `FOT-VIE`, `FOT-SAB`, `FOT-DOM`, `FOT-3D` |
| **Vendible total** | **23** | **`8 + 7 + 8`** |

Retired (not in vendible total): `DOB-VIE-HH`, `DOB-VIE-MH`, `DOB-SAB-MM`,
`IND-PRO-H`, `IND-PRO-M`.

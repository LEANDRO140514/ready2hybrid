# Ready2Hybrid specifications

This directory contains the formal, reviewable contracts that translate the
approved Ready2Hybrid product and architecture documents into requirements that
can be implemented and validated.

A specification does not replace the source documents. It is subordinate to
those documents and must preserve traceability back to them.

## Authority order

Read project authority in this order before drafting, reviewing, or validating a
specification:

1. `CURSOR_START_PROMPT.md`
2. `MANIFEST.md`
3. `WORKSPACE_STATUS.md`
4. `docs/00_CICLO_DEL_EVENTO.md` through
   `docs/05_ANEXO_PLAN_TECNICO.md`, in numeric order
5. `docs/specs/README.md`
6. The SPEC-000 version marked `APPROVED` in the registry; a newer `DRAFT` is
   read only as the subject of its review
7. Related specifications in dependency order

For product and architecture conflicts, the lower numbered file in `docs/00-05`
has priority. A specification must not silently resolve a material conflict.
Record it as an open decision and stop the affected implementation.

## Specification registry

| ID | Title | Status | Version | Phase | Depends on | Path |
|---|---|---|---|---|---|---|
| SPEC-000 | Specification Governance | SUPERSEDED | 0.1.0 | F0-B3 | None | `archive/SPEC-000-GOVERNANCE-v0.1.0.md` |
| SPEC-000 | Specification Governance | APPROVED | 0.2.0 | R1 | None | `SPEC-000-GOVERNANCE.md` |
| SPEC-001 | System Architecture | APPROVED | 0.1.0 | F0-B3 | SPEC-000 v0.2.0 | `SPEC-001-SYSTEM-ARCHITECTURE.md` |
| SPEC-011 | PWA Foundation | APPROVED | 0.1.0 | F0-B3 | SPEC-000 v0.2.0, SPEC-001 | `SPEC-011-PWA-FOUNDATION.md` |
| SPEC-030 | Public Sales Catalog and Registration Journeys | APPROVED | 0.1.0 | SALE-1 | SPEC-000 v0.2.0, SPEC-001, SPEC-011 | `SPEC-030-PUBLIC-SALES-CATALOG-AND-REGISTRATION-JOURNEYS.md` |
| SPEC-031 | Public Sales API and Backend Contract | APPROVED | 0.1.0 | SALE-2 | SPEC-000 v0.2.0, SPEC-001, SPEC-030; compatible with SPEC-011 | `SPEC-031-PUBLIC-SALES-API-AND-BACKEND-CONTRACT.md` |
| SPEC-032 | Minimal Public Sales Data Model and Transaction Integrity | APPROVED | 0.1.0 | SALE-3 | SPEC-000 v0.2.0, SPEC-001, SPEC-030, SPEC-031; compatible with SPEC-011 | `SPEC-032-MINIMAL-SALES-DATA-MODEL-AND-TRANSACTION-INTEGRITY.md` |
| SPEC-040 | Payment Pending Expiry Reconciliation | APPROVED | 0.1.1 | IMPL-14A | SPEC-000 v0.2.0, SPEC-001, SPEC-030, SPEC-031, SPEC-032; compatible with SPEC-011 | `SPEC-040-PAYMENT-PENDING-EXPIRY-RECONCILIATION.md` |
| SPEC-060 | Event Entry Operations | APPROVED | 0.1.0 | R2H-T2 | SPEC-000 v0.2.0, SPEC-001, SPEC-011, SPEC-030, SPEC-031, SPEC-032; compatible with SPEC-040 | `SPEC-060-EVENT-ENTRY-OPERATIONS.md` |

Future specifications are created only when their implementation phase is near.
Do not create the full functional catalog in advance.

SPEC-060 v0.1.0 is `APPROVED` by the Project Owner on 2026-07-31. It authorizes
Tramo 2 implementation traceability preparation. It does not by itself
authorize runtime implementation, migrations, InsForge writes, Main,
production, commit, or push. Each Tramo 2 unit requires separate authorization.

SPEC-000 v0.2.0 is the approved and effective governance contract after
explicit human authorization on 2026-07-23. Version 0.1.0 is historically
approved, now `SUPERSEDED` by v0.2.0, and preserved unchanged in the archive.
SPEC-001 and SPEC-011 retain their versions, requirements, acceptance criteria,
and approval states; their governance authority reference now resolves to
SPEC-000 v0.2.0.

## Current review gate

`READY_FOR_R2H_T2_1B_CLOSURE_COMMIT_REVIEW`

SPEC-060 v0.1.0 Event Entry Operations is `APPROVED` (Project Owner
2026-07-31). Tramo 2 implementation traceability is prepared in
`docs/implementation/R2H-T2-0-EVENT-ENTRY-IMPLEMENTATION-TRACEABILITY.md`.
`R2H-T2-1B` (PWA operational shell + access guards) is
`VALIDATED / CLOSED` for local implementation + automated and manual
validation scope (Project Owner 2026-08-01 America/Merida; documentary
formalization 2026-08-02) after T2-1C → T2-1D → T2-1E. Evidence
`docs/implementation/evidence/R2H-T2-1B-PWA-OPERATIONAL-SHELL.md`.
Deferred by closure: R014/R015 → T2-2; R003 HTTPS prod → deploy; AC005
domain IndexedDB → later; manifest/QR/check-in → T2-3; offline queue /
sync / conflicts → T2-4.
T2-2…T2-6 execution, F0-E, migrations, InsForge Main writes, production,
commit, and push remain **NOT AUTHORIZED** until separate human unit
authorization. The immediate next documentary step is review of the exact
local commit inventory for T2-1B closure.

Historical payment-expiry authority remains unchanged:

- SPEC-040 v0.1.1 remains `APPROVED`.
- IMPL-14A-2 plan v0.2.0 remains `PLAN / APPROVED` (Project Owner 2026-07-27
  after CTO `READY_FOR_APPROVAL` and IMPL-14A-2V). Approved plan content
  SHA-256:
  `04BAC5D62D6E3A75F0826AEAE0839D31340369D0156AC1DA09EB9D565D56EC0D`.
- IMPL-14A-3C remains `VALIDATED / CLOSED` in its documented sandbox scope.
- OD-040-002 remains `OPEN`; TRUE LEAST PRIVILEGE remains
  `BLOCKED_BY_PLATFORM_CAPABILITY`.
- F0-E remains unauthorized until separately approved.
- InsForge Main and production remain `NOT AUTHORIZED`.

## Lifecycle

```text
DRAFT -> IN_REVIEW
IN_REVIEW -> DRAFT
IN_REVIEW -> APPROVED
IN_REVIEW -> REJECTED
APPROVED -> IMPLEMENTING
IMPLEMENTING -> IMPLEMENTED
IMPLEMENTED -> VALIDATING
VALIDATING -> IMPLEMENTED
VALIDATING -> VALIDATED
APPROVED -> SUPERSEDED
VALIDATED -> SUPERSEDED
```

Only a human project authority may move a specification to `APPROVED`. A
specification may move to `VALIDATED` only when every acceptance criterion has
linked evidence. An agent may recommend `READY_FOR_APPROVAL` but may not apply
`APPROVED`. A review result of `CHANGES_REQUIRED` returns the proposal to
`DRAFT`. `SUPERSEDED` requires an identified approved replacement; a
replacement draft has no supersession effect. `REJECTED` does not invalidate a
previously approved version.

## Required workflow

```text
Authority review
  -> contradiction scan
  -> specification draft
  -> human review
  -> explicit approval
  -> implementation plan
  -> implementation
  -> automated and manual validation
  -> evidence-linked closure
```

No schema, RLS, payment, webhook, QR authority, production, or secret-related
implementation may rely on an unapproved specification.

## Requirement identifiers

Requirements use stable identifiers:

```text
SPEC-<number>-R<number>
```

Example: `SPEC-011-R004`.

Acceptance criteria use:

```text
SPEC-<number>-AC<number>
```

Do not renumber existing identifiers after review has started. Deprecate or
supersede them explicitly.

## Normative words

- `MUST`: mandatory.
- `MUST NOT`: prohibited.
- `SHOULD`: expected unless a written exception is approved.
- `MAY`: optional.

## Change rule

Approved specifications are frozen contracts. Material behavior changes require
one of these actions:

1. A new reviewed version with a change log and impact analysis.
2. A new specification that explicitly supersedes the previous one.

Never edit an approved contract silently.

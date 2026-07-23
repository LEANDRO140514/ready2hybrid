---
id: SPEC-000
title: Specification Governance
status: APPROVED
version: 0.1.0
phase: F0-B3
created_at: 2026-07-21
approved_at: 2026-07-21
approved_by: Project Owner
supersedes:
depends_on: []
---

# SPEC-000 - Specification Governance

## 1. Purpose

Define how Ready2Hybrid specifications are created, reviewed, approved,
implemented, validated, changed, and superseded.

This document is the control contract for `docs/specs/`. It does not define
product behavior by itself.

## 2. Authority sources

This specification derives from:

- `KIMCHI_START_PROMPT.md`
- `MANIFEST.md`
- `WORKSPACE_STATUS.md`
- `docs/00_CICLO_DEL_EVENTO.md`
- `docs/01_R2R_A_R2H_PRACTICO.md`
- `docs/02_PLAN_DESARROLLO_CON_KIMCHI.md`
- `docs/03_CUSTOMER_JOURNEYS.md`
- `docs/04_REVISION_FINAL.md`
- `docs/05_ANEXO_PLAN_TECNICO.md`

The source order and conflict rules are defined in `docs/specs/README.md`.

## 3. Scope

This specification governs:

- specification identifiers and numbering;
- required document structure;
- requirement identifiers and normative language;
- lifecycle states and transitions;
- human approval boundaries;
- traceability from authority to code and evidence;
- contradiction handling;
- change control and supersession;
- implementation and validation closure.

## 4. Non-goals

This specification does not:

- approve product prices, capacity, refund policy, waiver text, or payment
  methods;
- define database tables, RLS, edge functions, or webhooks;
- define UI design;
- authorize production changes;
- replace `docs/00-05`;
- approve another specification automatically.

## 5. Definitions

- **Authority source:** A project document that constrains a specification.
- **Specification:** A versioned, testable contract for one coherent area.
- **Requirement:** A normative statement with a stable identifier.
- **Acceptance criterion:** An observable condition proving one or more
  requirements.
- **Evidence:** A reproducible test result, review artifact, command output, or
  manual verification linked to a criterion.
- **Material change:** A change to behavior, data authority, security,
  interfaces, failure handling, or acceptance criteria.
- **Project authority:** The human owner authorized to approve a specification.

## 6. Invariants

### SPEC-000-R001

Every specification MUST be subordinate to the authority sources and MUST list
its sources explicitly.

### SPEC-000-R002

A specification MUST NOT silently resolve a material contradiction between
authority sources.

### SPEC-000-R003

Only the human project authority MAY transition a specification to `APPROVED`.

### SPEC-000-R004

A specification MUST NOT transition to `VALIDATED` without linked evidence for
every acceptance criterion.

### SPEC-000-R005

An approved specification MUST NOT be materially edited without versioning,
impact analysis, and renewed review.

### SPEC-000-R006

Implementation of schema, RLS, payments, webhooks, secrets, QR authority, or
production behavior MUST have an approved governing specification.

### SPEC-000-R007

The specification process MUST preserve stable requirement identifiers after a
document enters `IN_REVIEW`.

### SPEC-000-R008

A specification MUST separate product requirements from implementation choices
unless an implementation choice is already an approved architectural decision.

### SPEC-000-R009

A specification MUST include explicit non-goals to prevent scope growth.

### SPEC-000-R010

A specification MUST define failure modes and security or privacy implications
when the covered behavior can affect payments, personal data, access, offline
state, audit history, or public results.

## 7. Numbering

Use these ranges:

```text
000        Specification governance
001-009    System architecture
010-019    Platform and frontend foundation
020-029    Identity, authentication, and roles
030-039    Events, contacts, and registrations
040-049    Orders and payments
050-059    Tickets and QR
060-069    Offline manifests, check-in, and synchronization
070-079    Competition, timing, and results
080-089    Staff and operations
090-099    Audit, security, and compliance
```

Numbers MAY be reserved, but a reserved number does not create an approved
scope commitment.

## 8. Required structure

Every specification MUST contain these sections, using `Not applicable` with a
reason when needed:

1. Metadata
2. Purpose
3. Authority sources
4. Context
5. Scope
6. Non-goals
7. Definitions
8. Invariants
9. Functional requirements
10. Non-functional requirements
11. Interfaces and contracts
12. Failure modes
13. Security and privacy
14. Acceptance criteria
15. Validation plan
16. Traceability
17. Open decisions
18. Change log

## 9. Lifecycle

### DRAFT

The document is incomplete or still being shaped. It is not an implementation
authority.

### IN_REVIEW

The document is structurally complete and ready for contradiction, scope,
security, and testability review.

### APPROVED

The human project authority has explicitly approved the version. Implementation
may begin within its scope.

### IMPLEMENTING

Work has started and is linked to the approved requirements.

### IMPLEMENTED

The implementation is complete, but the validation evidence is not yet closed.

### VALIDATED

Every acceptance criterion has evidence and all mandatory gates pass.

### SUPERSEDED

A later approved specification or version replaces this contract.

### REJECTED

The proposal was reviewed and intentionally declined.

## 10. Transition rules

### SPEC-000-R011

Every status transition MUST be recorded in the change log with date, actor,
and reason.

### SPEC-000-R012

`DRAFT -> IN_REVIEW` requires all mandatory sections and no undocumented
material contradiction.

### SPEC-000-R013

`IN_REVIEW -> APPROVED` requires explicit human approval and resolution or
formal deferral of every blocking open decision.

### SPEC-000-R014

`APPROVED -> IMPLEMENTING` requires a scoped file plan and validation plan.

### SPEC-000-R015

`IMPLEMENTED -> VALIDATED` requires requirement-to-evidence traceability and no
failed mandatory gate.

### SPEC-000-R016

`APPROVED` or later documents MAY move to `SUPERSEDED` only when the replacing
contract is identified.

## 11. Review gates

A review MUST check:

- authority consistency;
- scope and non-goals;
- testability;
- architecture consistency;
- security and privacy;
- offline and conflict behavior when relevant;
- audit requirements;
- backward compatibility or migration impact;
- unresolved business or legal decisions.

A reviewer MUST stop the affected scope when a missing business, legal,
security, or data authority decision would otherwise be invented.

## 12. Traceability contract

Each requirement MUST be traceable through this chain:

```text
Authority source
  -> specification requirement
  -> implementation file or component
  -> automated or manual validation
  -> closure evidence
```

The implementation traceability table MUST use these columns:

| Requirement | Source | Implementation | Validation | Evidence | State |
|---|---|---|---|---|---|

## 13. Change control

A proposed material change MUST include:

- reason for change;
- affected requirements;
- affected specs;
- implementation impact;
- migration or compatibility impact;
- security and privacy impact;
- validation impact;
- rollback or recovery implications when applicable.

Typos and formatting fixes MAY be applied without a version increment only when
they do not alter meaning. Record them in the change log after `APPROVED`.

## 14. Acceptance criteria

### SPEC-000-AC001

`docs/specs/README.md` defines authority order, lifecycle, identifiers,
normative language, and change rules.

Validates: R001, R003, R004, R005, R007.

### SPEC-000-AC002

A sample specification can be reviewed using the mandatory structure without
inventing a product decision.

Validates: R002, R008, R009, R010.

### SPEC-000-AC003

The lifecycle rules prevent autonomous approval and prevent validation without
evidence.

Validates: R003, R004, R011-R016.

### SPEC-000-AC004

The traceability table can link every requirement in SPEC-001 and SPEC-011 to
its authority source and future evidence.

Validates: R001, R004, R014, R015.

## 15. Validation plan

- Review all required sections for completeness.
- Verify every requirement identifier is unique.
- Verify every acceptance criterion maps to one or more requirements.
- Verify no text grants autonomous approval.
- Verify no text authorizes schema, RLS, payments, webhooks, secrets, or
  production without a separate approved spec.
- Run Markdown link and formatting checks when available.

## 16. Traceability

| Requirement | Source |
|---|---|
| R001-R002 | Project authority hierarchy and controlled workflow |
| R003-R005 | Human approval, controlled closure, no silent edits |
| R006 | Sensitive change restrictions in the Kimchi plan |
| R007-R016 | Formal Spec -> approval -> implementation -> validation workflow |

Implementation and evidence remain pending while this document is `DRAFT`.

## 17. Open decisions

None for the governance foundation. Product decisions belong in their domain
specifications.

## 18. Change log

| Version | Date | Status | Change |
|---|---|---|---|
| 0.1.0 | 2026-07-21 | DRAFT | Initial governance foundation |
| 0.1.0 | 2026-07-21 | APPROVED | Status transition DRAFT → APPROVED by Project Owner after F0-B3 review |

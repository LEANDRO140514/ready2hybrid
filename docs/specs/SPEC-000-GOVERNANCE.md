---
id: SPEC-000
title: Specification Governance
status: DRAFT
version: 0.2.0
phase: R1
created_at: 2026-07-23
approved_at:
approved_by:
supersedes:
proposed_supersedes: SPEC-000 v0.1.0
depends_on: []
---

# SPEC-000 - Specification Governance

## 1. Purpose

Define how Ready2Hybrid specifications are created, reviewed, approved,
implemented, validated, changed, and superseded.

This document is the control contract for `docs/specs/`. It does not define
product behavior by itself.

## 2. Authority sources

Read authority in this order:

1. `CURSOR_START_PROMPT.md`
2. `MANIFEST.md`
3. `WORKSPACE_STATUS.md`
4. `docs/00_CICLO_DEL_EVENTO.md` through
   `docs/05_ANEXO_PLAN_TECNICO.md`, in numeric order
5. `docs/specs/README.md`
6. The SPEC-000 version identified as `APPROVED` in the registry; while a new
   version is under review, read its `DRAFT` only as the review subject
7. Related specifications in dependency order

For product and architecture conflicts inside `docs/00-05`, the lower numbered
document has priority unless resolution requires a human product, legal,
security, privacy, or business decision. The current user instruction and
physical Git state remain controlling evidence for the active unit.

Version resolution is atomic: SPEC-000 v0.1.0 remains the effective approved
contract until the owner explicitly approves v0.2.0. Approval of v0.2.0 must,
in the same controlled unit, set its status and approval metadata, record the
transition actor and reason, replace `proposed_supersedes` with
`supersedes: SPEC-000 v0.1.0`, mark v0.1.0 as superseded in the registry, and
update dependent authority references. A draft never participates in
implementation authority.

## 3. Context

Cursor is the operational construction environment for Ready2Hybrid. The best
available LLM is selected for each task type, including architecture,
planning, implementation, debugging, adversarial review, security,
documentation, and validation. Cursor, models, MCP servers, and other tools do
not become product or approval authorities.

## 4. Scope

This specification governs:

- operational construction authority and task-specific model selection;
- specification identifiers and numbering;
- required document structure;
- requirement identifiers and normative language;
- lifecycle states and transitions;
- human approval boundaries;
- traceability from authority to code and evidence;
- contradiction handling;
- change control and supersession;
- implementation and validation closure.

## 5. Non-goals

This specification does not:

- change runtime code, dependencies, architecture, data, migrations, security,
  privacy, offline behavior, payment behavior, QR behavior, or audit behavior;
- approve product prices, capacity, refund policy, waiver text, or payment
  methods;
- define database tables, RLS, edge functions, or webhooks;
- define UI design;
- authorize production changes;
- replace `docs/00-05`;
- approve another specification automatically.

## 6. Definitions

- **Authority source:** A project document that constrains a specification.
- **Cursor:** The approved operational environment for repository work.
- **Task-specific model:** The best available LLM selected for the current task;
  it remains subordinate to project authority and scope.
- **Specification:** A versioned, testable contract for one coherent area.
- **Requirement:** A normative statement with a stable identifier.
- **Acceptance criterion:** An observable condition proving one or more
  requirements.
- **Evidence:** A reproducible test result, review artifact, command output, or
  manual verification linked to a criterion.
- **Material change:** A change to behavior, data authority, security,
  interfaces, failure handling, or acceptance criteria.
- **Project authority:** The human owner authorized to approve a specification.

## 7. Invariants

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

### SPEC-000-R017

Ready2Hybrid repository work MUST use Cursor as the operational environment and
MUST select the best available LLM for the task without transferring product,
architecture, approval, or scope authority to that model.

### SPEC-000-R018

No agent, model, MCP, library, or historical constructor instruction MAY
silently replace Cursor, Vite, React 19, TypeScript strict, the SPA/PWA
architecture, InsForge authority, Mercado Pago Checkout Pro, or the approved
event lifecycle.

### SPEC-000-R019

Every model selection MUST identify the task type, available eligible models,
relevant restrictions, selected model, and reason for selection in the unit
evidence. Model selection MUST NOT weaken validation or human approval
requirements.

## 8. Functional requirements

- Every unit MUST identify its operation, governing sources, scope, protected
  paths, validation, rollback, and closing gate before implementation.
- Cursor MAY select different models for different tasks, but every result MUST
  be checked against the same repository authority and approval boundaries.
- Every model selection MUST leave the evidence required by R019.
- Material changes to approved specifications MUST preserve the approved
  version and prepare a separately reviewable replacement.

## 9. Non-functional requirements

- Governance documents MUST remain reviewable without access to secret values
  or external runtime state.
- Authority paths, versions, statuses, requirements, and gates MUST be
  deterministic and auditable in Git.
- Documentation-only governance changes MUST NOT create runtime, data, build,
  deployment, or dependency side effects.

## 10. Interfaces and contracts

```text
Human project authority
  -> approves product, architecture, security, data, and specification states

Cursor + selected LLM
  -> analyzes, proposes, implements within authorization, validates, evidences

MCP and other tools
  -> execute bounded operations; never establish authority or expand scope
```

The specification registry MUST distinguish approved versions from drafts and
MUST identify the approved version that remains effective during review.

## 11. Failure modes

- **Conflicting authorities:** Stop affected work, report the conflict, and
  request a human decision when hierarchy alone cannot resolve it.
- **Model or tool overreach:** Reject scope, architecture, or resource changes
  not authorized by project authority.
- **Draft treated as approved:** Block implementation and use the last approved
  version until explicit human approval.
- **Stale constructor or path reference:** Treat it as historical or migrate it
  in an authorized documentation unit; do not execute obsolete instructions.
- **Missing evidence:** Do not transition to `VALIDATED`.

## 12. Security and privacy

- Governance work MUST NOT expose, copy, log, or version secret values.
- A draft MUST NOT authorize SQL, RLS, payments, webhooks, QR authority,
  production operations, or access to personal data.
- Security, privacy, offline authority, payment verification, QR opacity, and
  audit requirements from approved product and architecture sources MUST remain
  unchanged unless a separately authorized specification changes them.

## 13. Numbering

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

## 14. Required structure

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

## 15. Lifecycle

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

## 16. Transition rules

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

## 17. Review gates

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

## 18. Traceability contract

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

## 19. Change control

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

### Proposed v0.2.0 change impact

- **Reason:** Replace the discarded constructor-specific operating authority
  with Cursor and task-specific model selection.
- **Affected requirements:** R001-R002 gain updated authority sources; R017-R018
  add explicit operational boundaries. R003-R016 retain their intent.
- **Documentation impact:** Startup prompt, development plan, manifest,
  workspace status, spec index, governance skill, and direct constructor
  references are migrated.
- **Documentation migration status:** The authorized R1 path and authority
  updates are implemented in Git; specification review and approval remain
  pending.
- **Runtime implementation impact:** None.
- **Runtime and compatibility impact:** None.
- **Data and migration impact:** None.
- **Security and privacy impact:** None; existing secret and least-privilege
  boundaries are preserved.
- **Offline, payment, QR, and audit impact:** None.
- **Validation impact:** Documentation, metadata, links, authority order, and
  stale constructor references must be reviewed.
- **Pre-approval rollback:** If v0.2.0 is not approved, no authority transition
  occurs: retain `docs/specs/archive/SPEC-000-GOVERNANCE-v0.1.0.md` as the
  approved governance contract and revise or discard this draft. The R1
  operational documents remain aligned with the owner's current Cursor
  decision; historical Kimchi text in the archive is not reactivated as
  operational authority. A corrected replacement draft remains required.
- **Post-approval rollback:** Do not silently reactivate v0.1.0. Prepare a new
  reviewed governance version that supersedes v0.2.0, or perform an explicit
  owner-authorized reactivation unit that atomically updates status, registry,
  dependent references, change log, and compatibility evidence.
- **Dependent specifications:** SPEC-001 and SPEC-011 remain bound to approved
  v0.1.0 during review. If v0.2.0 is approved, their authority references move
  to v0.2.0 in the same approval unit; their requirements, versions, and
  approval states remain unchanged because this governance migration has no
  architecture or runtime impact.

## 20. Acceptance criteria

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

### SPEC-000-AC005

The authority documents consistently identify Cursor as the operational
environment, require task-specific model selection, preserve human approval,
and contain no active constructor authority for Kimchi or Forge.

Validates: R001, R002, R003, R017, R018.

### SPEC-000-AC006

A governance review demonstrates that an unapproved draft cannot authorize
implementation, tools cannot expand scope, approved versions remain available,
and documentation-only changes introduce no runtime or data effects.

Validates: R003-R006, R017, R018.

### SPEC-000-AC007

For each model-selection example, the review evidence records task type,
eligible alternatives, restrictions, selection, and rationale without changing
authority, validation, or approval boundaries.

Validates: R017, R019.

## 21. Validation plan

- Review all required sections for completeness.
- Verify the archived v0.1.0 is byte-identical to the previously approved file.
- Verify every requirement identifier is unique.
- Verify every acceptance criterion maps to one or more requirements.
- Verify no text grants autonomous approval.
- Verify no text authorizes schema, RLS, payments, webhooks, secrets, or
  production without a separate approved spec.
- Verify related approved specs retain their version, status, requirements,
  acceptance criteria, architecture, and open decisions.
- Search for stale constructor references and obsolete file paths.
- Run Markdown link and formatting checks when available.

## 22. Traceability

| Requirement | Source |
|---|---|
| R001-R002 | Project authority hierarchy and controlled workflow |
| R003-R005 | Human approval, controlled closure, no silent edits |
| R006 | Sensitive change restrictions in the Cursor plan |
| R007-R016 | Formal Spec -> approval -> implementation -> validation workflow |
| R017-R018 | Owner decision: Cursor + best available LLM per task |
| R019 | Traceable task-specific model selection |

The R1 documentation migration is implemented. Review and approval evidence for
this governance draft remain pending; no runtime implementation is implied.

## 23. Open decisions

Human review and approval of v0.2.0 remain pending. Product decisions continue
to belong in their domain specifications and are not resolved by this draft.

## 24. Change log

| Version | Date | Status | Actor | Reason |
|---|---|---|---|---|
| 0.1.0 | 2026-07-21 | DRAFT | Project Owner | Initial governance foundation |
| 0.1.0 | 2026-07-21 | APPROVED | Project Owner | Approved after F0-B3 review |
| 0.2.0 | 2026-07-23 | DRAFT | Cursor, authorized by Project Owner | Propose migration of operational governance from Kimchi to Cursor with traceable task-specific LLM selection; no runtime or normative product change |

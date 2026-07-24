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
security, privacy, or business decision. Explicit current decisions from the
human project authority may define or change product, architecture, security,
governance, priorities, and approval within the controlled repository workflow.

R027 classifies physical Git state as operational evidence rather than product,
architecture, security, business, or approval authority. Git establishes
observable repository facts such as present files, commits, branch, divergence,
working tree, and diffs. Cursor, selected models, MCP servers, and other tools
remain subordinate to the human project authority and the documented hierarchy.

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

The former draft requirement R019 was removed before `IN_REVIEW` because the
owner did not authorize mandatory evidence for each model selection. The number
remains intentionally unused so the review history is explicit.

### SPEC-000-R020

Before implementation, every controlled unit MUST identify its operation,
governing sources, scope, protected paths, validation, rollback, and closing
gate.

### SPEC-000-R021

Governance work MUST NOT expose, copy, log, or version secret values and MUST
remain reviewable without access to secrets.

### SPEC-000-R022

A documentation-only governance change MUST NOT create runtime, data, build,
deployment, dependency, or external-resource side effects.

### SPEC-000-R023

The specification registry MUST distinguish approved versions from drafts and
MUST identify the approved version that remains effective during review.

### SPEC-000-R024

Governance failure modes MUST produce an explicit stop, rejection, recovery, or
human-decision path without silently expanding scope or authority.

### SPEC-000-R025

An unapproved specification MUST NOT authorize SQL, schema, RLS, payments,
webhooks, secrets, QR authority, production operations, or access to personal
data.

### SPEC-000-R026

Security, privacy, offline authority, payment verification, QR opacity, audit,
and approved architecture requirements MUST remain unchanged unless a
separately authorized and approved specification changes them.

### SPEC-000-R027

Physical Git state MUST be used only as operational evidence and MUST NOT be
treated as product, architecture, security, business, or approval authority.

## 8. Functional requirements

| Governance behavior | Governing requirements |
|---|---|
| Controlled-unit preparation | R020 |
| Human approval and draft boundaries | R003, R006, R013, R025 |
| Preservation and review of material changes | R005, R016, R023 |
| Tool and model authority boundaries | R017, R018, R027 |

Cursor may select a suitable available model for each task. Recording material
limitations or model-specific risks is useful when they affect scope,
validation, security, or acceptance evidence. This note creates no
per-selection record, approval gate, or acceptance obligation.

## 9. Non-functional requirements

| Quality attribute | Governing requirements |
|---|---|
| Reviewability without secret values | R021 |
| Deterministic, auditable versions, states, and transitions | R005, R007, R011, R023 |
| No runtime or external side effects from documentation-only work | R022 |
| Traceable authority and operational evidence | R001, R004, R027 |

## 10. Interfaces and contracts

```text
Human project authority
  -> approves product, architecture, security, data, and specification states

Cursor + selected LLM
  -> analyzes, proposes, implements within authorization, validates, evidences

MCP and other tools
  -> execute bounded operations; never establish authority or expand scope

Physical Git state
  -> records observable repository facts; never establishes product authority
```

R003, R017, R018, R023, and R027 govern these boundaries.

## 11. Failure modes

R002, R004, R006, R018, R024, R025, and R027 govern these responses:

| Failure mode | Required response |
|---|---|
| Conflicting authorities | Stop the affected work and request a human decision when hierarchy cannot resolve it. |
| Model or tool overreach | Reject unauthorized scope, architecture, or resource changes. |
| Draft treated as approved | Block implementation and retain the last approved version as the effective contract. |
| Stale constructor or path reference | Treat the reference as historical or migrate it in an authorized documentation unit. |
| Missing validation evidence | Keep the specification below `VALIDATED`. |
| Git state treated as authority | Correct the classification and use Git only as operational evidence. |

## 12. Security and privacy

| Boundary | Governing requirements |
|---|---|
| Secret handling | R021 |
| Draft restrictions for sensitive operations | R006, R025 |
| Preservation of security, privacy, offline, payment, QR, audit, and architecture | R010, R018, R026 |
| Human authority and operational evidence | R003, R027 |

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

### VALIDATING

Validation is running against the approved requirements and acceptance
criteria. Failed or incomplete validation returns the document to
`IMPLEMENTED`.

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

The lifecycle permits only these transitions:

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

`DRAFT -> IN_REVIEW` requires all mandatory sections and no undocumented
material contradiction. A review result of `CHANGES_REQUIRED` returns the
proposal to `DRAFT`.

### SPEC-000-R013

`IN_REVIEW -> APPROVED` requires explicit human approval and resolution or
formal deferral of every blocking open decision. An agent MAY recommend
`READY_FOR_APPROVAL` but MUST NOT apply `APPROVED`.

### SPEC-000-R014

`APPROVED -> IMPLEMENTING` requires a scoped file plan and validation plan.
`IMPLEMENTING -> IMPLEMENTED` requires completion of the authorized
implementation scope.

### SPEC-000-R015

`IMPLEMENTED -> VALIDATING` starts evidence collection.
`VALIDATING -> IMPLEMENTED` records failed or incomplete validation.
`VALIDATING -> VALIDATED` requires requirement-to-evidence traceability and no
failed mandatory gate.

### SPEC-000-R016

Only `APPROVED` or `VALIDATED` documents MAY move to `SUPERSEDED`, and only
after the replacing contract is identified and approved. A replacement draft
does not supersede an approved version. `REJECTED` does not replace or
invalidate the previously approved contract.

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
  with Cursor and non-binding task-specific model selection.
- **Governance impact:** Authority hierarchy, operational evidence boundaries,
  lifecycle, review criteria, rollback, and supersession are clarified.
- **Affected requirements:** R001-R002 gain updated authority sources; R011-R016
  gain an explicit lifecycle; R017-R018 add operational boundaries; R020-R027
  formalize already-authorized unit planning, secrets, documentation-only
  isolation, registry, failure handling, draft restrictions, preservation, and
  Git-evidence rules. R003-R010 retain their intent.
- **Documentation impact:** Startup prompt, development plan, manifest,
  workspace status, spec index, governance skill, and direct constructor
  references are migrated.
- **Documentation migration status:** The authorized R1 path and authority
  updates are implemented in Git; specification review and approval remain
  pending.
- **Task-specific model impact:** Cursor may select a suitable available model;
  no per-selection log, file, approval gate, or acceptance obligation is
  created.
- **No impact:** Runtime, frontend, implemented PWA, database, migrations, RLS,
  Edge Functions, InsForge, Mercado Pago, payments, QR, secrets, personal data,
  infrastructure, and open N0 decisions remain unchanged.
- **Security and privacy impact:** Existing secret, least-privilege, payment,
  QR, offline-authority, and audit boundaries are preserved.
- **Validation impact:** Documentation, metadata, links, authority order,
  lifecycle, rollback, and stale constructor references are reviewed.
- **Dependent specifications:** SPEC-001 and SPEC-011 remain bound to approved
  v0.1.0 during review. If v0.2.0 is approved, their authority references move
  to v0.2.0 in the same approval unit; their requirements, versions, and
  approval states remain unchanged because this governance migration has no
  architecture or runtime impact.

### Rollback and replacement procedure

#### Scenario A - v0.2.0 is not approved

- **Responsible actor:** The human project authority decides whether the draft
  remains `DRAFT`, returns for correction, or transitions from `IN_REVIEW` to
  `REJECTED`. Cursor may prepare only the authorized documentation correction.
- **Initial state:** v0.1.0 is `APPROVED` at
  `docs/specs/archive/SPEC-000-GOVERNANCE-v0.1.0.md`; v0.2.0 is `DRAFT` or
  `IN_REVIEW` at `docs/specs/SPEC-000-GOVERNANCE.md`.
- **Affected files:** The draft, `docs/specs/README.md`, and
  `WORKSPACE_STATUS.md` only when an authorized correction or status record
  requires them.
- **Protected paths:** The archived v0.1.0, code, SQL, InsForge, Mercado Pago,
  secrets, and current Cursor authority documents remain intact. Obsolete
  Kimchi files and paths are not reintroduced.
- **Final state:** v0.1.0 remains the latest approved governance contract;
  v0.2.0 remains `DRAFT` or becomes `REJECTED` only through the human-authorized
  transition. No implementation relies on v0.2.0.
- **Operational authority:** This specification rollback does not reactivate
  Kimchi. The owner's current Cursor + suitable available LLM decision remains
  the higher operational authority while governance formalization is corrected.
- **Validation:** Compare metadata, registry, changelog, authority paths, and
  Git diff; confirm the archive blob is unchanged and no implementation or
  external-resource diff exists.
- **Evidence:** Version and status metadata, link to v0.1.0, changelog, Git
  comparison, review result, and human approval or rejection record.
- **Gate:** A corrected draft may return to `READY_FOR_SPEC_REVIEW`; an
  unresolved human choice produces `BLOCKED_BY_DECISION`.

#### Scenario B - an approved v0.2.0 later needs replacement

- **Responsible actor:** The human project authority authorizes the change
  proposal and approves any replacement.
- **Initial state:** v0.2.0 is `APPROVED` or `VALIDATED`.
- **Procedure:** Open a change proposal, prepare a new version, review
  authority and impact, obtain human approval, and only then transition v0.2.0
  to `SUPERSEDED` in the same controlled approval unit.
- **Affected files:** The new governance version, registry, workspace status,
  dependent authority references, and changelog identified by the approved
  change proposal.
- **Protected paths:** Code, SQL, InsForge, Mercado Pago, secrets, and unrelated
  specifications remain intact unless a separate approved unit explicitly
  governs them.
- **Final state:** The approved replacement is identified; v0.2.0 becomes
  `SUPERSEDED`. v0.1.0 is not silently restored.
- **Validation:** Compare versions and statuses, verify approval metadata and
  atomic registry/dependency updates, and confirm compatibility and protected
  paths.
- **Evidence:** Change proposal, impact review, requirement and acceptance
  matrices, Git comparison, review gate, and explicit human approval.
- **Gate:** The reviewed replacement reaches `READY_FOR_APPROVAL` before the
  human-controlled approval transition.

## 20. Acceptance criteria

### SPEC-000-AC001

- **Precondition:** Authority documents and the specification registry are
  available at one Git revision.
- **Input:** `CURSOR_START_PROMPT.md`, `MANIFEST.md`, `WORKSPACE_STATUS.md`,
  `docs/00-05`, `docs/specs/README.md`, and SPEC-000 versions.
- **Action:** Compare authority order, version/status registry, requirement-ID
  rules, human approval boundary, and the Git-evidence classification.
- **Expected result:** One ordered hierarchy is present; v0.1.0 is the effective
  approved contract; v0.2.0 is a draft; IDs remain stable after `IN_REVIEW`;
  only the human owner approves; Git is operational evidence only.
- **Evidence:** Review checklist plus path/status and requirement-ID search
  output.
- **Pass/fail rule:** `PASS` when every expected condition matches; `FAIL` on
  any mismatch; `BLOCKED` when an input is unavailable; otherwise `NOT_RUN`.
- **Validates:** R001, R003, R005, R007, R023, R027.

### SPEC-000-AC002

- **Precondition:** SPEC-001 and SPEC-011 remain available as approved sample
  specifications.
- **Input:** The mandatory structure in SPEC-000 plus SPEC-001 and SPEC-011.
- **Action:** Inspect each required section and compare product requirements,
  implementation choices, failure modes, security, privacy, offline, payment,
  QR, and audit boundaries with their cited authorities.
- **Expected result:** Every required section is present or explicitly not
  applicable; no product decision is invented; relevant failure, security, and
  privacy implications are present and preserve approved boundaries.
- **Evidence:** Section checklist and contradiction matrix for both sample
  specifications.
- **Pass/fail rule:** `PASS` when both samples satisfy every expected condition;
  `FAIL` on any missing section, invented decision, or boundary conflict;
  `BLOCKED` when an artifact is unavailable; otherwise `NOT_RUN`.
- **Validates:** R002, R008, R009, R010, R024, R026.

### SPEC-000-AC003

- **Precondition:** Lifecycle states, transition rules, and changelog are
  available in SPEC-000 and the index.
- **Input:** The complete transition list in R012 and the lifecycle in
  `docs/specs/README.md`.
- **Action:** Compare both transition sets; inspect each transition for actor,
  entry condition, reversal/failure path, evidence requirement, and
  supersession rule.
- **Expected result:** The sets match; `DRAFT -> IN_REVIEW` is explicit;
  `CHANGES_REQUIRED` returns to `DRAFT`; only a human authorizes approval;
  validation uses `VALIDATING`; rejection preserves the prior approved version;
  supersession occurs only after replacement approval.
- **Evidence:** Transition matrix and changelog inspection.
- **Pass/fail rule:** `PASS` when every allowed transition and restriction
  matches; `FAIL` on an omitted, extra, or unauthorized transition; `BLOCKED`
  when an artifact is unavailable; otherwise `NOT_RUN`.
- **Validates:** R003, R004, R011-R016.

### SPEC-000-AC004

- **Precondition:** Requirement and acceptance-criterion sections are complete.
- **Input:** R001-R018, R020-R027, AC001-AC010, SPEC-001, and SPEC-011.
- **Action:** Build the requirement matrix and verify one or more concrete
  authority sources and acceptance criteria for every requirement; verify that
  no ID changed after `IN_REVIEW`.
- **Expected result:** Every requirement has a source and observable criterion;
  no duplicate or orphan ID exists; SPEC-001 and SPEC-011 remain traceable to
  their unchanged approved requirements and future evidence.
- **Evidence:** Requirement-to-source-to-criterion matrix and duplicate search.
- **Pass/fail rule:** `PASS` with complete unique mappings; `FAIL` for any
  missing, partial, duplicate, or orphan mapping; `BLOCKED` when an input is
  unavailable; otherwise `NOT_RUN`.
- **Validates:** R001, R004, R007, R014, R015, R020-R027.

### SPEC-000-AC005

- **Precondition:** Current authority files and archived governance are
  distinguishable.
- **Input:** Active authority paths, archive path, and constructor references.
- **Action:** Search current documents for Cursor, Kimchi, Forge, and obsolete
  paths; classify each match as active, historical, or prohibited.
- **Expected result:** Cursor is the active operational environment; model and
  MCP roles remain subordinate; human approval is preserved; Kimchi and Forge
  appear only in historical or explicit-discard context; active obsolete paths
  are absent.
- **Evidence:** Classified reference-search output.
- **Pass/fail rule:** `PASS` when all matches have the expected classification;
  `FAIL` for active obsolete authority or tool overreach; `BLOCKED` when search
  scope is unavailable; otherwise `NOT_RUN`.
- **Validates:** R001-R003, R017, R018.

### SPEC-000-AC006

- **Precondition:** The draft, approved archive, Git diff, and related specs are
  available.
- **Input:** SPEC-000 v0.1.0/v0.2.0, registry, related specs, and the correction
  diff.
- **Action:** Inspect status and supersession metadata; classify every changed
  file and asserted impact; search for sensitive-operation authorization.
- **Expected result:** The draft grants no implementation authority; tools do
  not expand scope; the archive remains available and unchanged; only
  authorized documentation files change; no runtime, data, payment, QR,
  security, privacy, infrastructure, or external-resource effect appears.
- **Evidence:** Blob comparison, scoped Git diff, impact matrix, and sensitive
  authorization search.
- **Pass/fail rule:** `PASS` when all expected boundaries hold; `FAIL` on any
  unauthorized effect or approval implication; `BLOCKED` when evidence is
  unavailable; otherwise `NOT_RUN`.
- **Validates:** R003-R006, R017, R018, R021-R026.

### SPEC-000-AC007

- **Precondition:** Model-selection language is available in active authority
  and governance documents.
- **Input:** `CURSOR_START_PROMPT.md`, `docs/02`, R017-R018, and section 8.
- **Action:** Inspect model-selection language and search for mandatory
  per-selection logs, files, dossiers, approval gates, or acceptance evidence.
- **Expected result:** Cursor can select a suitable available model by task;
  models remain subordinate; no obligation records every model selection.
- **Evidence:** Model-language comparison and normative-term search.
- **Pass/fail rule:** `PASS` when no per-selection obligation exists and
  authority boundaries remain intact; `FAIL` otherwise; `BLOCKED` when an input
  is unavailable; otherwise `NOT_RUN`.
- **Validates:** R017, R018.

### SPEC-000-AC008

- **Precondition:** Both rollback scenarios and the approved archive are
  available.
- **Input:** Scenario A, Scenario B, registry, workspace status, and archive
  blob identity.
- **Action:** Simulate each scenario as a document-state transition; verify
  actor, files, initial/final states, validations, evidence, gate, impact, and
  protected paths.
- **Expected result:** Scenario A retains v0.1.0 as approved without reactivating
  Kimchi; Scenario B requires a new reviewed and human-approved replacement
  before supersession; neither scenario changes protected resources.
- **Evidence:** Rollback checklist, state-transition matrix, Git comparison, and
  archive blob hash.
- **Pass/fail rule:** `PASS` when both scenarios satisfy every field; `FAIL` on
  any silent reactivation, missing field, or protected-path effect; `BLOCKED`
  when evidence is unavailable; otherwise `NOT_RUN`.
- **Validates:** R003, R005, R011, R016, R022, R023, R027.

### SPEC-000-AC009

- **Precondition:** A proposed controlled implementation unit is available for
  inspection; no execution is required.
- **Input:** The unit header and its declared files, resources, validation,
  rollback, and gate.
- **Action:** Compare the unit declaration with every field in R020.
- **Expected result:** Operation, sources, scope, protected paths, validation,
  rollback, and closing gate are all explicit before implementation.
- **Evidence:** Completed R020 checklist linked to the proposed unit.
- **Pass/fail rule:** `PASS` when every field is present; `FAIL` when any field
  is absent; `BLOCKED` when no unit is available; otherwise `NOT_RUN`.
- **Validates:** R020.

### SPEC-000-AC010

- **Precondition:** Current product/architecture authorities, related specs, and
  the governance change diff are available.
- **Input:** Security, privacy, offline, payment, QR, audit, architecture, and
  secret-handling clauses.
- **Action:** Compare the draft and diff against SPEC-001, SPEC-011, and
  `docs/00-05`; search the diff for secrets, credentials, personal data, and
  sensitive implementation authorization.
- **Expected result:** Approved boundaries are unchanged; no secret or personal
  value appears; no draft authorizes protected implementation.
- **Evidence:** Boundary comparison, scoped secret scan, and related-spec diff.
- **Pass/fail rule:** `PASS` when all boundaries and scans are clean; `FAIL` on
  any exposure, authorization, or normative conflict; `BLOCKED` when required
  evidence is unavailable; otherwise `NOT_RUN`.
- **Validates:** R006, R010, R018, R021, R025, R026.

## 21. Validation plan

- Review all required sections for completeness.
- Verify the archived v0.1.0 is byte-identical to the previously approved file.
- Verify every requirement identifier is unique.
- Verify every acceptance criterion maps to one or more requirements.
- Build the requirement matrix with statement, source, criterion, duplicate,
  observability, and result fields.
- Build the acceptance matrix with precondition, evidence, expected result,
  coverage, and `PASS`, `FAIL`, `BLOCKED`, or `NOT_RUN`.
- Verify no text grants autonomous approval.
- Verify no text authorizes schema, RLS, payments, webhooks, secrets, or
  production without a separate approved spec.
- Verify related approved specs retain their version, status, requirements,
  acceptance criteria, architecture, and open decisions.
- Verify section 8 creates no mandatory record for each model selection.
- Exercise both rollback scenarios as document-state transitions.
- Search for stale constructor references and obsolete file paths.
- Run Markdown link and formatting checks when available.

## 22. Traceability

| Requirement | Authority source | Rationale | Acceptance criteria |
|---|---|---|---|
| R001 | `CURSOR_START_PROMPT.md`; `docs/specs/README.md` | Specifications remain subordinate and traceable. | AC001, AC004, AC005 |
| R002 | SPEC-000 v0.1.0 R002; `docs/specs/README.md` | Material contradictions require explicit handling. | AC002, AC005 |
| R003 | SPEC-000 v0.1.0 R003; `MANIFEST.md` | Approval belongs only to the human owner. | AC001, AC003, AC005, AC006, AC008 |
| R004 | SPEC-000 v0.1.0 R004 | Validation requires criterion-linked evidence. | AC003, AC004 |
| R005 | SPEC-000 v0.1.0 R005 | Approved contracts cannot change silently. | AC001, AC006, AC008 |
| R006 | SPEC-000 v0.1.0 R006; `CURSOR_START_PROMPT.md` | Sensitive implementation needs approved governance. | AC006, AC010 |
| R007 | SPEC-000 v0.1.0 R007; `docs/specs/README.md` | Reviewed identifiers remain stable. | AC001, AC004 |
| R008 | SPEC-000 v0.1.0 R008 | Product requirements and implementation choices remain distinct. | AC002 |
| R009 | SPEC-000 v0.1.0 R009 | Explicit non-goals prevent scope growth. | AC002 |
| R010 | SPEC-000 v0.1.0 R010; SPEC-001; SPEC-011 | Relevant failure, security, and privacy effects remain explicit. | AC002, AC010 |
| R011 | SPEC-000 v0.1.0 R011 | Status changes need auditable actor and reason. | AC003, AC008 |
| R012 | SPEC-000 v0.1.0 R012; owner-authorized R3 lifecycle | The complete transition set removes review ambiguity. | AC003 |
| R013 | SPEC-000 v0.1.0 R013; owner-authorized R3 lifecycle | Human approval remains mandatory. | AC003 |
| R014 | SPEC-000 v0.1.0 R014; owner-authorized R3 lifecycle | Implementation states remain scoped and explicit. | AC003, AC004 |
| R015 | SPEC-000 v0.1.0 R015; owner-authorized R3 lifecycle | Validation has explicit entry, failure, and success paths. | AC003, AC004 |
| R016 | SPEC-000 v0.1.0 R016; owner-authorized R3 lifecycle | Supersession follows approval of the replacement. | AC003, AC008 |
| R017 | `CURSOR_START_PROMPT.md`; `docs/02_PLAN_DESARROLLO_CON_CURSOR.md` | Cursor and suitable task-specific models are the operational choice. | AC005, AC006, AC007 |
| R018 | `CURSOR_START_PROMPT.md`; SPEC-001 | Tools cannot replace approved authority or architecture. | AC005-AC007, AC010 |
| R020 | `CURSOR_START_PROMPT.md` start and close workflow | A controlled unit declares scope and evidence before implementation. | AC004, AC009 |
| R021 | `CURSOR_START_PROMPT.md` security boundaries; SPEC-001 R016 | Governance evidence excludes secret values. | AC004, AC006, AC010 |
| R022 | Owner-authorized R1/R3 documentation-only scope | Documentation migration cannot create runtime or external effects. | AC004, AC006, AC008 |
| R023 | `docs/specs/README.md`; owner-authorized atomic version rule | Review must preserve the effective approved version. | AC001, AC004, AC006, AC008 |
| R024 | SPEC-000 v0.1.0 review gates and contradiction handling | Failures end in an explicit controlled response. | AC002, AC004 |
| R025 | `CURSOR_START_PROMPT.md`; SPEC-000 v0.1.0 R006 | Drafts do not authorize protected implementation. | AC004, AC006, AC010 |
| R026 | `docs/00-05`; SPEC-001; SPEC-011 | Governance migration preserves approved system boundaries. | AC002, AC004, AC006, AC010 |
| R027 | Owner-authorized R3 authority clarification | Repository state proves facts but grants no authority. | AC001, AC004, AC008 |

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
| 0.2.0 | 2026-07-23 | DRAFT | Cursor, authorized by Project Owner | Propose migration of operational governance from Kimchi to Cursor with non-binding task-specific LLM selection; no runtime or normative product change |
| 0.2.0 | 2026-07-23 | DRAFT | Cursor, authorized by Project Owner | Resolved R2 findings: removed the unsupported per-model evidence obligation; clarified human authority versus Git evidence; added explicit review and validation transitions; made acceptance criteria observable; added verifiable rollback; aligned the index and workspace status. No runtime, architecture, data, payment, QR, privacy, or infrastructure change. |

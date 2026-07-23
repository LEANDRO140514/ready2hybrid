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
| SPEC-000 | Specification Governance | APPROVED | 0.1.0 | F0-B3 | None | `archive/SPEC-000-GOVERNANCE-v0.1.0.md` |
| SPEC-000 | Specification Governance | DRAFT | 0.2.0 | R1 | None | `SPEC-000-GOVERNANCE.md` |
| SPEC-001 | System Architecture | APPROVED | 0.1.0 | F0-B3 | SPEC-000 v0.1.0 | `SPEC-001-SYSTEM-ARCHITECTURE.md` |
| SPEC-011 | PWA Foundation | APPROVED | 0.1.0 | F0-B3 | SPEC-000 v0.1.0, SPEC-001 | `SPEC-011-PWA-FOUNDATION.md` |

Future specifications are created only when their implementation phase is near.
Do not create the full functional catalog in advance.

SPEC-000 v0.1.0 remains the approved governance contract. Version 0.2.0 is a
proposed replacement and has no implementation authority until explicit human
approval. If approved, status, approval metadata, registry supersession, and
dependent authority references must be updated atomically in that approval
unit, including replacing `proposed_supersedes` with `supersedes`.

## Current review gate

`READY_FOR_SPEC_REVIEW`

The next permitted action is human review of SPEC-000 v0.2.0. Do not approve it
automatically and do not begin F0-E from this draft.

## Lifecycle

```text
DRAFT -> IN_REVIEW -> APPROVED -> IMPLEMENTING -> IMPLEMENTED -> VALIDATED
                                                               -> SUPERSEDED
IN_REVIEW -> REJECTED
```

Only a human project authority may move a specification to `APPROVED`. A
specification may move to `VALIDATED` only when every acceptance criterion has
linked evidence.

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

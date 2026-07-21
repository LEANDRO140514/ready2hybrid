# Ready2Hybrid specifications

This directory contains the formal, reviewable contracts that translate the
approved Ready2Hybrid product and architecture documents into requirements that
can be implemented and validated.

A specification does not replace the source documents. It is subordinate to
those documents and must preserve traceability back to them.

## Authority order

Read project authority in this order before drafting, reviewing, or validating a
specification:

1. `KIMCHI_START_PROMPT.md`
2. `MANIFEST.md`
3. `WORKSPACE_STATUS.md`
4. `docs/00_CICLO_DEL_EVENTO.md`
5. `docs/01_R2R_A_R2H_PRACTICO.md`
6. `docs/02_PLAN_DESARROLLO_CON_KIMCHI.md`
7. `docs/03_CUSTOMER_JOURNEYS.md`
8. `docs/04_REVISION_FINAL.md`
9. `docs/05_ANEXO_PLAN_TECNICO.md`
10. Approved specifications in this directory

For product and architecture conflicts, the lower numbered file in `docs/00-05`
has priority. A specification must not silently resolve a material conflict.
Record it as an open decision and stop the affected implementation.

## Specification registry

| ID | Title | Status | Version | Phase | Depends on |
|---|---|---|---|---|---|
| SPEC-000 | Specification Governance | APPROVED | 0.1.0 | F0-B3 | None |
| SPEC-001 | System Architecture | APPROVED | 0.1.0 | F0-B3 | SPEC-000 |
| SPEC-011 | PWA Foundation | APPROVED | 0.1.0 | F0-B3 | SPEC-000, SPEC-001 |

Future specifications are created only when their implementation phase is near.
Do not create the full functional catalog in advance.

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

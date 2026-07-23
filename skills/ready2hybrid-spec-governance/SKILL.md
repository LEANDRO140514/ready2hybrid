---
name: ready2hybrid-spec-governance
description: Govern Ready2Hybrid specifications from source-authority review through drafting, contradiction analysis, approval preparation, implementation traceability, and evidence-based validation. Use when creating, reviewing, updating, superseding, or checking compliance with files under docs/specs, or when a Ready2Hybrid implementation proposal needs a formal specification-to-approval-to-implementation-to-validation contract. Do not use for ordinary coding tasks that already have an approved governing specification.
---

# Ready2Hybrid Spec Governance

Apply the Ready2Hybrid authority hierarchy and produce small, testable,
traceable specifications without inventing product decisions or approving work
autonomously.

## 1. Start with read-only preflight

1. Confirm the repository, branch, HEAD, remote, and working tree when Git is
   available.
2. Read these files in order:
   - `CURSOR_START_PROMPT.md`
   - `MANIFEST.md`
   - `WORKSPACE_STATUS.md`
   - `docs/00_CICLO_DEL_EVENTO.md`
   - `docs/01_R2R_A_R2H_PRACTICO.md`
   - `docs/02_PLAN_DESARROLLO_CON_CURSOR.md`
   - `docs/03_CUSTOMER_JOURNEYS.md`
   - `docs/04_REVISION_FINAL.md`
   - `docs/05_ANEXO_PLAN_TECNICO.md`
   - `docs/specs/README.md`
   - the SPEC-000 version marked `APPROVED` in the registry
   - a newer SPEC-000 `DRAFT` only when it is the review subject
   - related specifications by dependency order
3. Treat `docs/00-05` as product and architecture authority. When they conflict,
   prefer the lower numbered file unless the conflict requires a human business,
   legal, security, or product decision.
4. Do not write during preflight.

## 2. Classify the requested operation

Choose exactly one primary operation:

- Draft a new specification.
- Review a draft for approval.
- Propose a change to an approved specification.
- Prepare implementation traceability.
- Validate implementation against an approved specification.
- Propose supersession or rejection.

State the operation, governing sources, related specs, planned files, and
forbidden paths before writing.

## 3. Run contradiction and decision scan

Before drafting:

1. Compare the requested behavior against every higher authority source.
2. Identify stack, data-authority, offline, security, payment, QR, event-cycle,
   and role-boundary conflicts.
3. Separate:
   - resolved facts from authority;
   - implementation choices allowed by authority;
   - missing human decisions;
   - prohibited behavior.
4. Stop the affected scope when a missing decision would otherwise be invented.
5. Record non-blocking uncertainty in `Open decisions`.

Cursor is the operational environment and the best available LLM is selected
for each task. Neither the selected model nor an MCP gains product,
architecture, approval, or scope authority.

Never silently replace Cursor, Vite, React 19, TypeScript strict, SPA/PWA,
InsForge authority, Mercado Pago Checkout Pro, or the approved event lifecycle.

## 4. Draft specifications

Follow `SPEC-000` exactly.

- Keep one coherent contract per spec.
- Use the assigned number range.
- Start new documents as `DRAFT`.
- Use stable requirement identifiers: `SPEC-XXX-RNNN`.
- Use stable acceptance identifiers: `SPEC-XXX-ACNNN`.
- Use `MUST`, `MUST NOT`, `SHOULD`, and `MAY` consistently.
- Cite authority files in `Authority sources` and `Traceability`.
- Define explicit scope and non-goals.
- Define failure modes, security, privacy, offline behavior, and audit when
  relevant.
- Make every acceptance criterion observable and map it to requirements.
- Avoid code, SQL, secrets, production changes, and speculative table designs
  unless the approved spec request explicitly covers those artifacts.

Do not duplicate full source documents. Translate them into testable contracts.

## 5. Review for approval

Check and report:

1. Authority consistency.
2. Scope discipline and non-goals.
3. Missing product, legal, security, or operational decisions.
4. Requirement uniqueness and normative clarity.
5. Acceptance-criterion coverage.
6. Failure and recovery behavior.
7. Security, privacy, least privilege, and audit.
8. Offline authority and synchronization boundaries.
9. Compatibility with related specs.
10. Change and migration impact.

Return one result:

- `READY_FOR_APPROVAL`
- `CHANGES_REQUIRED`
- `BLOCKED_BY_DECISION`
- `REJECT_RECOMMENDED`

Never set `APPROVED`. Only the human project authority can approve.

## 6. Prepare implementation

After explicit approval:

1. Confirm the approved version and requirement set.
2. Produce a scoped implementation file plan.
3. Map every planned file to requirements.
4. Define automated and manual validation before code changes.
5. Identify protected paths and sensitive actions requiring a separate approval.
6. Propose `APPROVED -> IMPLEMENTING`; do not apply the status transition without
   project authority or the repository workflow explicitly authorizing it.

Do not expand scope because an implementation tool suggests extra features.

## 7. Validate implementation

Validate only against an approved version.

1. Confirm the implementation diff is within scope.
2. Execute the defined automated gates.
3. Execute or document required manual checks.
4. Build the traceability table:

   `Requirement -> source -> implementation -> validation -> evidence -> state`

5. Mark each criterion pass, fail, blocked, or not run.
6. Report security, privacy, offline, audit, and regression findings separately.
7. Recommend `VALIDATED` only when all mandatory criteria have evidence and no
   mandatory gate fails.

Never claim validation from code inspection alone when the spec requires runtime
or physical evidence.

## 8. Change approved specifications safely

For a material change:

1. Keep the approved version intact until the replacement is approved.
2. Prepare a new version or a superseding specification.
3. Include reason, affected requirements, implementation impact, migration or
   compatibility impact, security and privacy impact, validation impact, and
   rollback or recovery implications.
4. Re-run full review.
5. Link the replacement in `supersedes` and the change log after approval.

Allow typo or formatting fixes without a version increment only when meaning is
unchanged; record them after approval.

SPEC-000 v0.2.0 remains a `DRAFT` until explicit human approval. While that
review is pending, use the archived SPEC-000 v0.1.0 as the approved governance
contract and do not infer implementation authority from the draft.

## 9. Enforce hard boundaries

Do not:

- modify `docs/00-05` silently;
- approve or validate on behalf of the user;
- create SQL, RLS, payments, webhooks, secrets, or production changes from a
  draft spec;
- treat browser caches or IndexedDB as canonical authority;
- trust Mercado Pago redirects as payment confirmation;
- put personal, payment, or medical data in QR payloads;
- turn recommendations into mandatory requirements without authority;
- create all future specs in advance;
- commit or push unless explicitly requested and allowed by the active workflow.

## 10. Close with a gate

End every governance task with one explicit gate, such as:

- `READY_FOR_SPEC_DRAFT`
- `READY_FOR_SPEC_REVIEW`
- `READY_FOR_APPROVAL`
- `BLOCKED_BY_DECISION`
- `READY_FOR_IMPLEMENTATION_PLAN`
- `READY_FOR_VALIDATION`
- `VALIDATION_FAILED`
- `READY_FOR_HUMAN_VALIDATION_APPROVAL`

Include changed files, protected paths confirmed intact, validation results,
open decisions, and the exact next allowed action.

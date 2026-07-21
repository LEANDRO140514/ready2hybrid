---
id: SPEC-001
title: System Architecture
status: APPROVED
version: 0.1.0
phase: F0-B3
created_at: 2026-07-21
approved_at: 2026-07-21
approved_by: Project Owner
supersedes:
depends_on:
  - SPEC-000
---

# SPEC-001 - System Architecture

## 1. Purpose

Freeze the approved Ready2Hybrid system boundaries and technical invariants so
later specifications cannot reintroduce conflicting stacks or data authority.

## 2. Authority sources

- `KIMCHI_START_PROMPT.md`
- `docs/00_CICLO_DEL_EVENTO.md`
- `docs/01_R2R_A_R2H_PRACTICO.md`
- `docs/02_PLAN_DESARROLLO_CON_KIMCHI.md`
- `docs/03_CUSTOMER_JOURNEYS.md`
- `docs/04_REVISION_FINAL.md`
- `docs/05_ANEXO_PLAN_TECNICO.md`
- `docs/specs/SPEC-000-GOVERNANCE.md`

## 3. Context

Ready2Hybrid is the operational system for ENFORMA events. It supports the
complete event lifecycle, including sales supervision, event preparation,
offline day-of-event operations, results, financial closure, and audit.

The public Hybrid Event landing is a separate frontend. Ready2Hybrid is a
single role-aware SPA/PWA used on mobile, tablet, and desktop.

## 4. Scope

This specification defines:

- canonical frontend stack;
- backend and payment boundaries;
- canonical data authority;
- online and offline responsibility boundaries;
- high-level module boundaries;
- security, secret, and audit invariants;
- testing foundations;
- prohibited architecture substitutions.

## 5. Non-goals

This specification does not define:

- database schema or RLS policies;
- payment implementation or webhook payloads;
- ticket token format;
- check-in conflict algorithm details;
- domain table names beyond approved conceptual boundaries;
- UI component design;
- deployment provider;
- production credentials;
- exact functional module implementation order beyond the approved plan.

## 6. Definitions

- **Ready2Hybrid PWA:** The role-aware operational SPA installed or opened in a
  browser.
- **Hybrid Event landing:** The separate public experience for discovery,
  registration, and purchase initiation.
- **InsForge:** Backend platform and canonical authority for event data.
- **Local copy:** Expirable browser data used for offline continuity, never the
  canonical record.
- **Sensitive action:** A state-changing operation involving payments, access,
  waiver, registration, results, or audit history.

## 7. Invariants

### SPEC-001-R001

The frontend MUST use Vite, React 19, and TypeScript strict mode.

### SPEC-001-R002

Ready2Hybrid MUST be a client-side SPA and an offline-first PWA.

### SPEC-001-R003

Ready2Hybrid MUST use TanStack Router for application routing.

### SPEC-001-R004

Ready2Hybrid MUST use TanStack Query for server-state retrieval, caching, and
mutation orchestration.

### SPEC-001-R005

Ready2Hybrid MUST use TanStack Table for data-heavy operational tables.

### SPEC-001-R006

Ready2Hybrid MUST use Zustand for local application state that is not canonical
server state.

### SPEC-001-R007

Ready2Hybrid MUST use Zod at untrusted input and boundary validation points.

### SPEC-001-R008

The project MUST use Vitest for unit and integration-level frontend tests and
Playwright for browser-level critical flows.

### SPEC-001-R009

The application MUST NOT use Next.js, App Router, React Server Components, or
Next.js API Routes.

### SPEC-001-R010

InsForge MUST be the canonical authority for registrations, payments, tickets,
QR lifecycle, check-ins, synchronization outcomes, results, and audit history.

### SPEC-001-R011

IndexedDB and browser caches MUST be treated as temporary, scoped, revocable,
and expirable copies.

### SPEC-001-R012

The browser MUST NOT independently finalize payment, ticket validity, canonical
check-in state, result publication, or audit history.

### SPEC-001-R013

Mercado Pago Checkout Pro MUST be the first payment provider and MUST be
integrated through InsForge-side trusted behavior, not trusted browser logic.

### SPEC-001-R014

Payment redirects and success pages MUST NOT be treated as payment approval.
Canonical payment state MUST be resolved by trusted backend verification.

### SPEC-001-R015

Sensitive actions MUST be exposed as named business actions and MUST be
audited. Operators MUST NOT edit canonical state fields directly.

### SPEC-001-R016

Secrets MUST remain outside the repository, browser bundle, client logs, and
user-visible diagnostics.

### SPEC-001-R017

Anonymous clients MUST NOT receive direct write authority to canonical domain
tables.

### SPEC-001-R018

Check-in, timing, staff operations, and incidents MUST be designed to continue
during temporary loss of connectivity. Financial actions and other sensitive
server-authoritative actions MAY require connectivity.

### SPEC-001-R019

Every offline mutation MUST have an idempotent synchronization identity and
sufficient operator and device context for server resolution and audit.

### SPEC-001-R020

Role boundaries MUST be enforced by the system. FINANCE MUST NOT receive
medical or emergency data by default, and CHECKIN_STAFF MUST NOT edit payments.

### SPEC-001-R021

The application MUST preserve the event lifecycle and MUST enable or block
behavior according to the canonical event state.

### SPEC-001-R022

The architecture SHOULD use feature or module boundaries that preserve a stable
core and prevent direct cross-module state mutation.

### SPEC-001-R023

Activation of optional event capabilities SHOULD be data-driven rather than
requiring a separate application deployment.

### SPEC-001-R024

Every canonical state transition affecting access, money, results, waivers, or
operator responsibility MUST be auditable.

## 8. Functional requirements

The system architecture MUST support these six operational areas without
splitting them into separate applications:

1. Event
2. People
3. Check-in
4. Competition
5. Staff
6. Cash and finance

Views MAY differ by role, but they share the same canonical backend and event
lifecycle.

## 9. Non-functional requirements

### SPEC-001-R025

The application MUST remain type-safe under TypeScript strict mode with no
ignored foundation-level errors.

### SPEC-001-R026

The production PWA MUST be served over HTTPS.

### SPEC-001-R027

Day-of-event critical flows SHOULD minimize navigation and keyboard input and
MUST preserve the customer journey principles relevant to each role.

### SPEC-001-R028

Build, typecheck, lint, unit tests, and applicable browser tests MUST be part of
phase validation before closure.

### SPEC-001-R029

The architecture MUST permit backup, export, and recovery procedures for
canonical InsForge data and event documents.

## 10. Interfaces and contracts

High-level responsibility split:

```text
Hybrid Event landing
  - public discovery and purchase initiation
  - no canonical payment approval

Ready2Hybrid PWA
  - operational views and offline continuity
  - no independent canonical authority

InsForge
  - Auth, PostgreSQL, RLS, Functions, Storage, Realtime
  - canonical state, authorization, conflict resolution, and audit

Mercado Pago
  - Checkout Pro payment execution
  - provider state verified by trusted backend behavior
```

Detailed contracts require separate approved specifications.

## 11. Failure modes

- **No network:** Offline-capable workflows continue against authorized local
  data and queue idempotent operations.
- **Stale local data:** The PWA blocks or degrades actions when freshness,
  version, role, event, or expiration constraints fail.
- **Duplicate operation:** The trusted backend resolves idempotently and records
  any operational conflict.
- **Provider redirect without approval:** The UI remains pending until trusted
  payment resolution.
- **Role mismatch:** Access is denied and no sensitive data is returned.
- **Backend unavailable:** Financial and server-authoritative actions remain
  unavailable; the UI provides an explicit next step.

## 12. Security and privacy

- Keep personal and medical data out of QR payloads and public interfaces.
- Keep secrets out of the frontend and repository.
- Minimize offline datasets by event, role, device, and purpose.
- Expire and delete offline sensitive data at logout, event closure, or manifest
  invalidation.
- Audit operator and device context for sensitive mutations.
- Treat InsForge policies and trusted functions as enforcement, not UI hiding.

## 13. Acceptance criteria

### SPEC-001-AC001

A repository review confirms Vite + React 19 + TypeScript strict and confirms no
Next.js runtime or routing architecture.

Validates: R001, R002, R009, R025.

### SPEC-001-AC002

An architecture review maps routing, server state, tables, local state,
validation, and tests to the approved libraries.

Validates: R003-R008, R028.

### SPEC-001-AC003

A boundary review demonstrates that canonical payment, ticket, check-in,
result, and audit decisions remain in InsForge-side trusted behavior.

Validates: R010-R017, R024.

### SPEC-001-AC004

An offline architecture review demonstrates expirable local data, idempotent
queued mutations, and server conflict resolution.

Validates: R011, R018, R019.

### SPEC-001-AC005

A role and privacy review demonstrates least-privilege data exposure and no
secrets or sensitive QR payloads.

Validates: R016, R017, R020.

### SPEC-001-AC006

The event lifecycle can govern availability of operational actions across all
six areas.

Validates: R021-R024.

## 14. Validation plan

- Inspect package and TypeScript configuration.
- Run typecheck, lint, tests, and build.
- Search for prohibited Next.js files and dependencies.
- Review data-flow diagrams for browser, InsForge, and Mercado Pago.
- Review offline storage scope and deletion behavior when implemented.
- Review role test evidence when authentication and policies exist.
- Review requirement-to-code traceability before `VALIDATED`.

## 15. Traceability

| Requirements | Source |
|---|---|
| R001-R009, R025-R028 | `docs/01`, `docs/02`, `docs/04`, `docs/05` |
| R010-R019, R024 | `docs/00`, `docs/01`, `docs/02`, `docs/05` |
| R020 | `docs/03`, `docs/02` |
| R021 | `docs/00` event lifecycle rules |
| R022-R023 | `docs/05` modular architecture, subordinate to `docs/01-02` |
| R029 | `docs/00`, `docs/02`, `docs/05` closure and backup requirements |

Implementation and evidence remain pending while this document is `DRAFT`.

## 16. Open decisions

- Exact module folder contract and runtime manifest mechanism remain subject to
  a later approved implementation specification.
- Deployment provider remains open; HTTPS is mandatory.
- Exact InsForge SDK initialization and auth session strategy remain for later
  foundation specs.

## 17. Change log

| Version | Date | Status | Change |
|---|---|---|---|
| 0.1.0 | 2026-07-21 | DRAFT | Initial architecture contract |
| 0.1.0 | 2026-07-21 | APPROVED | Status transition DRAFT → APPROVED by Project Owner after F0-B3 review |

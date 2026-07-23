---
id: SPEC-011
title: PWA Foundation
status: APPROVED
version: 0.1.0
phase: F0-B3
created_at: 2026-07-21
approved_at: 2026-07-21
approved_by: Project Owner
supersedes:
depends_on:
  - SPEC-000
  - SPEC-001
---

# SPEC-011 - PWA Foundation

## 1. Purpose

Define the installability, service worker, update, app-shell, caching, and
foundation-level offline behavior required before functional offline modules are
implemented.

## 2. Authority sources

- `docs/00_CICLO_DEL_EVENTO.md`
- `docs/01_R2R_A_R2H_PRACTICO.md`
- `docs/02_PLAN_DESARROLLO_CON_CURSOR.md`
- `docs/03_CUSTOMER_JOURNEYS.md`
- `docs/04_REVISION_FINAL.md`
- `docs/05_ANEXO_PLAN_TECNICO.md`
- `docs/specs/archive/SPEC-000-GOVERNANCE-v0.1.0.md`
- `docs/specs/SPEC-001-SYSTEM-ARCHITECTURE.md`

## 3. Context

Ready2Hybrid must operate on mobile, tablet, and desktop, including temporary
loss of connectivity during event operations. The foundation must be safe and
predictable before ticket manifests, check-ins, timing, or other domain queues
are added.

## 4. Scope

This specification covers:

- web app manifest;
- installability;
- service worker registration;
- app-shell caching;
- static asset caching;
- update detection and activation UX;
- offline navigation fallback;
- cache versioning and cleanup;
- foundation diagnostics;
- boundaries between Cache Storage and IndexedDB;
- baseline PWA tests.

## 5. Non-goals

This specification does not implement or define:

- ticket or QR issuance;
- check-in manifests;
- QR scanning;
- check-in queues;
- first-scan-wins conflict resolution;
- timing capture;
- staff assignment data;
- payment or financial offline behavior;
- production push notifications;
- background sync as a required dependency;
- canonical domain records in browser storage.

Those behaviors require later domain specifications.

## 6. Definitions

- **App shell:** Minimal HTML, JavaScript, CSS, icons, and route fallback needed
  to open the application UI.
- **Precache:** Versioned static assets known at build time.
- **Runtime cache:** Resources cached after a request according to an explicit
  strategy.
- **Update waiting:** A newly downloaded service worker that has not yet taken
  control.
- **Offline fallback:** A controlled screen or shell response used when a route
  cannot reach the network.

## 7. Invariants

### SPEC-011-R001

The PWA MUST be built with the Vite-compatible PWA and Workbox foundation
approved by SPEC-001.

### SPEC-011-R002

The application MUST provide a valid web app manifest with stable identity,
name, short name, start URL, display mode, theme metadata, and required install
icons.

### SPEC-011-R003

The production deployment MUST use HTTPS. Localhost MAY be used for development
and test installability.

### SPEC-011-R004

The service worker MUST precache only versioned build assets and the minimum app
shell required for controlled startup.

### SPEC-011-R005

The service worker MUST NOT cache authenticated API responses or sensitive
domain payloads by default.

### SPEC-011-R006

Cache Storage MUST be used for static or explicitly approved network resources.
IndexedDB MUST be reserved for structured application data governed by a
separate domain specification.

### SPEC-011-R007

The foundation MUST provide an explicit offline navigation fallback instead of
a browser network error page.

### SPEC-011-R008

The app shell MUST open after one successful online load when the network is
unavailable, provided the installed cache version is valid.

### SPEC-011-R009

The PWA MUST expose connectivity and update state without implying that local
state is canonical or synchronized.

### SPEC-011-R010

A newly available application version MUST be detected and communicated to the
operator with a controlled update action.

### SPEC-011-R011

The application MUST NOT force an update in the middle of an active critical
operation. The update policy MUST allow safe activation at an explicit point.

### SPEC-011-R012

On update activation, obsolete caches MUST be removed without deleting
domain-owned IndexedDB data unless a separate approved migration requires it.

### SPEC-011-R013

A cache or application version incompatibility MUST produce a recoverable state
with an explicit next step.

### SPEC-011-R014

The foundation MUST record only non-sensitive diagnostics needed to identify
service worker version, install state, cache state, and update state.

### SPEC-011-R015

The PWA MUST NOT store secrets, payment credentials, access tokens in cache
keys, personal data in static caches, or sensitive query strings in diagnostic
logs.

### SPEC-011-R016

The foundation SHOULD remain usable in current evergreen mobile and desktop
browsers supported by the project test matrix.

### SPEC-011-R017

The foundation MUST support mobile viewport, standalone display, and responsive
startup without requiring a separate native application.

### SPEC-011-R018

A failed service worker registration MUST not prevent online use of the SPA. It
MUST produce a diagnosable degraded state.

## 8. Functional requirements

The foundation MUST provide these operator-visible states:

1. Online and current.
2. Offline with valid app shell.
3. Update available.
4. Update activation pending a safe point.
5. PWA unavailable or registration failed, with online fallback.
6. Incompatible or corrupted cache requiring controlled recovery.

The UI wording MUST distinguish:

- application shell available offline;
- domain data downloaded for offline use;
- queued mutations pending synchronization;
- canonical synchronization complete.

The PWA foundation MUST NOT display `ready for offline operation` merely because
the app shell is cached. Domain modules own that readiness declaration.

## 9. Non-functional requirements

### SPEC-011-R019

Service worker and manifest code MUST pass typecheck, lint, build, and applicable
unit tests.

### SPEC-011-R020

Installability and offline-shell behavior MUST be verified with Playwright or a
controlled browser test plus a documented manual install check.

### SPEC-011-R021

The foundation SHOULD avoid unbounded runtime caches and MUST define expiration
or bounded entry behavior for every runtime cache.

### SPEC-011-R022

The update flow MUST be deterministic and reproducible in preview or local test
conditions.

### SPEC-011-R023

Foundation logging MUST avoid noisy repeated messages during normal online or
offline transitions.

## 10. Interfaces and contracts

### Application interface

The application layer receives normalized PWA state, such as:

```text
registration: unsupported | failed | active
connectivity: online | offline
update: none | available | activating | failed
shell: unavailable | available | incompatible
```

This is a conceptual contract. Exact TypeScript types require an implementation
plan after approval.

### Cache boundary

```text
Cache Storage
  - versioned app shell
  - versioned static assets
  - explicitly approved public resources

IndexedDB
  - no foundation domain records
  - later specs own schemas, expiration, authorization, and migrations
```

### Backend boundary

The service worker MUST NOT intercept or transform sensitive mutations in a way
that bypasses TanStack Query, approved domain queues, InsForge authorization, or
server-side idempotency.

## 11. Failure modes

- **Registration unsupported:** Run online SPA and show a non-blocking degraded
  diagnostic.
- **Registration failed:** Continue online when possible and expose recovery.
- **Offline before first successful load:** Show a controlled unavailable state.
- **Corrupted or incompatible cache:** Offer reload or cache recovery without
  claiming domain data safety.
- **Update download failed:** Keep current working version and retry later.
- **Update waiting during critical flow:** Defer activation until explicit safe
  confirmation.
- **Missing icon or invalid manifest:** Fail installability validation.
- **Sensitive response accidentally matched by cache rule:** Test must fail and
  the rule must be removed before approval.

## 12. Security and privacy

- Default-deny runtime caching for authenticated and sensitive API traffic.
- Do not cache payment, waiver, emergency, medical, ticket authority, or audit
  responses in the foundation.
- Do not log access tokens, authorization headers, QR tokens, payment IDs, or
  personal data.
- Keep service worker scope limited to the application scope.
- Treat service worker updates as application code changes requiring the same
  release validation as the SPA bundle.

## 13. Acceptance criteria

### SPEC-011-AC001

The generated manifest passes browser installability checks and references all
required icon assets.

Validates: R002, R003, R017.

### SPEC-011-AC002

After one successful load, the app shell opens with network disabled and shows
a controlled offline state.

Validates: R004, R007, R008, R009.

### SPEC-011-AC003

Authenticated and sensitive API responses are absent from Cache Storage after
representative application use.

Validates: R005, R006, R015.

### SPEC-011-AC004

A new build is detected as an available update, is not forced during an active
critical-flow test, and activates after explicit confirmation.

Validates: R010-R012, R022.

### SPEC-011-AC005

Activating a new build removes obsolete static caches and preserves domain-owned
IndexedDB stores.

Validates: R006, R012.

### SPEC-011-AC006

Registration failure and first-load-offline scenarios show controlled recovery
states while online SPA use remains possible when the network is available.

Validates: R013, R018.

### SPEC-011-AC007

Runtime caches are bounded and diagnostics contain no secrets or personal data.

Validates: R014, R015, R021, R023.

### SPEC-011-AC008

Typecheck, lint, build, unit tests, browser tests, and manual installation check
pass with recorded evidence.

Validates: R016, R019, R020.

## 14. Validation plan

Automated:

- typecheck;
- lint;
- production build;
- manifest validation;
- service worker registration test;
- offline navigation test;
- update-available and activation test;
- cache-content inspection;
- obsolete-cache cleanup test;
- registration-failure degradation test.

Manual:

- install on one mobile-class browser and one desktop browser;
- open in standalone display;
- disable network after initial load;
- verify operator-visible states;
- verify update is deferred during a simulated critical operation;
- inspect application storage for sensitive cached responses.

## 15. Traceability

| Requirements | Source |
|---|---|
| R001-R004, R017-R020 | `docs/01`, `docs/02`, `docs/04`, `docs/05` |
| R005-R015, R021-R023 | InsForge authority and offline boundaries in `docs/00-05` |
| Operator state distinctions | `docs/03` P5 and check-in readiness behavior |

Implementation and validation evidence remain pending for this `APPROVED`
specification.

## 16. Open decisions

- Final manifest identity strings and production start URL.
- Final icon assets and maskable icon treatment.
- Exact safe-update coordination API between critical domain modules and the
  service worker controller.
- Browser support matrix for the first event.

These decisions do not authorize check-in or ticket manifest implementation.

## 17. Change log

| Version | Date | Status | Change |
|---|---|---|---|
| 0.1.0 | 2026-07-21 | DRAFT | Initial PWA foundation contract |
| 0.1.0 | 2026-07-21 | APPROVED | Status transition DRAFT → APPROVED by Project Owner after F0-B3 review |
| 0.1.0 | 2026-07-23 | APPROVED | Editorial consistency correction; no normative change. Updated renamed authority path and corrected residual DRAFT wording. |

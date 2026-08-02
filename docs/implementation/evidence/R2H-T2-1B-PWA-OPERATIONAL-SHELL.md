# R2H-T2-1B — PWA operational shell and access guards

```text
Unit:
R2H-T2-1B (+ remediación R2H-T2-1D; revalidación R2H-T2-1E)

Title:
Implement PWA operational shell and access guards

Date:
2026-07-31 (implementation / remediation / CTO revalidation)
Human closure:
2026-08-01 (America/Merida); documentary gate formalized 2026-08-02

Governance timezone:
America/Merida

Status:
VALIDATED / CLOSED
LOCAL IMPLEMENTATION + AUTOMATED AND MANUAL VALIDATION SCOPE

Scope:
LOCAL FRONTEND ONLY
(no InsForge schema, no Main, no production, no commit, no push)
```

## 1. Authorization

Project Owner authorized `R2H-T2-1B` and later remediation `R2H-T2-1D` for
findings from CTO validation `R2H-T2-1C` (`CHANGES_REQUIRED`).
CTO revalidation `R2H-T2-1E` recommended
`READY_FOR_HUMAN_VALIDATION_APPROVAL`.

On 2026-08-01 (America/Merida) the Project Owner declared expressly:

```text
APRUEBO LA VALIDACIÓN DE R2H-T2-1B
R2H-T2-1B = VALIDATED / CLOSED
LOCAL IMPLEMENTATION + AUTOMATED AND MANUAL VALIDATION SCOPE
```

Authorized for this closure documentation: update evidence, traceability,
registry, and `WORKSPACE_STATUS` only.

Still not authorized: commit, push, R2H-T2-2, SQL/migrations/RLS, InsForge
writes, Main, production.

Authorized implementation scope remains: SPEC-011 foundation, operational
shell, InsForge Auth (public), roles, assignment contract, deny-by-default
guards, connectivity/update, tests, evidence.

## 2. Baseline Git

| Field | Value |
|---|---|
| Branch | `main` |
| HEAD (governance) | `a2e3cc8a99084a8ea13ad92818de8d2d988bdae0` |
| origin/main | same (`0 0`) |
| Commit / push | **NOT PERFORMED** (still NOT AUTHORIZED after closure) |

Working tree holds local T2-1B/T2-1D implementation + this documentary
closure. Protected noise: `.cursor/*`, `.claude/*` (untouched).

## 3. Inventory (primary)

```text
package.json / package-lock.json
vite.config.ts
playwright.config.ts
.env.example
public/offline.html
public/icons/icon-192.png
public/icons/icon-512.png
scripts/generate-pwa-icons.mjs
src/main.tsx
src/main.e2e.tsx
src/App.tsx
src/App.test.tsx
src/index.css
src/vite-env.d.ts
src/auth/ports.ts
src/auth/fixture-ports.ts
src/auth/AuthContext.tsx
src/auth/assignment.ts
src/auth/guards.ts
src/auth/roles.ts
src/auth/types.ts
src/pwa/*
src/routes/*
src/components/shell/*
src/stores/shell-store.ts
src/lib/insforge/client.ts
src/test/pwa-register-stub.ts
tests/unit/auth/*
tests/unit/pwa/*
tests/unit/shell/*
tests/e2e/app.smoke.spec.ts
tests/e2e/pwa-production.spec.ts
tests/e2e/pwa-update.spec.ts
docs/implementation/evidence/R2H-T2-1B-PWA-OPERATIONAL-SHELL.md
WORKSPACE_STATUS.md
docs/specs/README.md
docs/implementation/R2H-T2-0-EVENT-ENTRY-IMPLEMENTATION-TRACEABILITY.md
```

## 4. Dependencies

| Package | Role |
|---|---|
| `vite-plugin-pwa` | Manifest + Workbox SW |
| `@insforge/sdk` | Public auth session |
| `@tanstack/react-router` | Routes |
| `@tanstack/react-query` | Provider |
| `zustand` | Shell connectivity/update |

No QR/camera/domain-sync direct dependencies. No new deps in T2-1D.

## 5. Fixture hard-disable (T2-1D / FINDING-1)

| Control | Result |
|---|---|
| Fixture adapters only in `src/auth/fixture-ports.ts` | PASS |
| Production entry `main.tsx` / `ports.ts` never import harness | PASS |
| Playwright harness = `vite --mode e2e` → `main.e2e.tsx` | PASS |
| Production build + `VITE_AUTH_MODE=fixture` | **build fails** |
| Production bundle strings `r2h.e2e.session` / `createFixtureAuthPort` | **absent** |
| localStorage fixture grants on prod preview | → `/login` |

```text
production authorization bypass = 0
misconfigured production rebuild bypass = 0
```

## 6. ErrorBoundary (FINDING-5)

`ShellErrorBoundary` wraps shell routes. Distinguishes RENDER_FAILURE UI from
UNAUTHORIZED / SESSION_ERROR routes. No stack/tokens shown. Unit tested.

## 7. Automated gates (post-remediation)

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS — **28 files / 434 tests** |
| scoped `oxlint` (T2-1 paths) | PASS (Fast Refresh warning `AuthContext.tsx:145`) |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — **10/10** |

### E2E projects

| Project | Coverage |
|---|---|
| `harness` (`--mode e2e`) | shell smoke, unauth deny, fixture deny, logout revoke, offline banner |
| `pwa-prod` (build + preview `:4175`) | installability, SW control, offline reload, fixture ignored, bundle scan |
| `pwa-update` (`:4176`) | build A→B, update waiting, explicit activate |

Preview teardown: **EXPECTED TEST CLEANUP** (intentional kill; impact NONE).

## 8. Production Service Worker validation

```text
command: npm run build && vite preview :4175
browser: Chromium (Playwright Desktop Chrome)
```

Observed:

1. Initial online load — PASS  
2. SW controlling document (after reload if needed) — PASS  
3. Offline reload — shell visible — PASS  
4. Offline banner — PASS  
5. `not-ready-operate` — PASS  
6. No “CHECK-IN AVAILABLE” / “LISTO PARA OPERAR SIN INTERNET” — PASS  
7. Shell does not require InsForge for render — PASS  
8. Connectivity recovery — PASS  

## 9. Installability (SPEC-011 AC001)

```text
browser: Chromium (Playwright)
preview URL: http://127.0.0.1:4175/
build: production generateSW
```

| Check | Result |
|---|---|
| manifest accessible | PASS |
| name / short_name / start_url / scope / display | PASS |
| icons 192 & 512 reachable PNG with correct IHDR size | PASS |
| SW active + controlling | PASS |
| secure/loopback context | PASS |
| manifest console errors | 0 |
| `beforeinstallprompt` | NOT exposed in automation (documented) |

Installability observation: valid manifest + icons + SW-controlled document on
loopback satisfies AC001 runtime checks available to Playwright. Native install
UI not asserted (browser limitation).

## 10. Update flow A→B (SPEC-011 AC004)

```text
build A (VITE_SHELL_BUILD_ID=update-a) → preview :4176 → SW controlling
→ build B (update-b) → registration.update()
→ update-available banner visible; still showing update-a
→ click “Actualizar cuando sea seguro”
→ shell shows update-b; not-ready-operate retained
```

Result: **PASS** (automated `tests/e2e/pwa-update.spec.ts`).

## 11. Logout

Harness + unit: authenticated with assignment → logout → localStorage cleared →
`/ops/checkin` → `/login`. Zustand holds no tokens. **PASS**.

## 12. SPEC-011 matrix

| ID | State | Notes |
|---|---|---|
| R001–R002 | PASS | VitePWA + manifest/icons |
| R003 | DEFERRED_BY_TRACEABILITY | HTTPS prod deploy |
| R004–R011 | PASS | precache, no API cache, offline fallback, connectivity/update prompt |
| R012 | PASS | cleanupOutdatedCaches |
| R013 | PARTIAL_BY_DESIGN | recovery messaging minimal |
| R014–R015 | PASS | no secrets in caches/logs |
| R016–R019 | PASS | evergreen Chromium + gates |
| R020 | PASS | Playwright prod SW + installability checks |
| R021 | PASS | empty runtimeCaching |
| R022 | PASS | A→B update test |
| R023 | PASS | quiet console in smoke |
| AC001 | PASS | runtime manifest/icons/SW (see §9) |
| AC002 | PASS | prod SW offline reload |
| AC003 | PASS | no auth API runtime cache |
| AC004 | PASS | A→B explicit activate |
| AC005 | DEFERRED_BY_TRACEABILITY | no domain IndexedDB |
| AC006 | PARTIAL_BY_DESIGN | failed-reg + offline.html paths |
| AC007 | PASS | bounded caches |
| AC008 | PASS | gates + evidence this document |

## 13. SPEC-060 matrix (T2-1 assigned)

| ID | State |
|---|---|
| R011 | PARTIAL_BY_DESIGN |
| R013 | PASS |
| R014 | PARTIAL_BY_DESIGN / DEFERRED_TO_T2_2 |
| R015 | PARTIAL_BY_DESIGN / DEFERRED_TO_T2_2 |
| R025 | PARTIAL_BY_DESIGN (shell only) |
| R068 | PASS |
| R069 / R070 / R080 | PARTIAL_BY_DESIGN |
| R081 | PARTIAL_BY_DESIGN |

## 14. Security and privacy

| Check | Result |
|---|---|
| frontend secrets | 0 |
| admin keys | 0 |
| hardcoded tokens | 0 |
| production fixture grants | 0 |
| query-param bypasses | 0 |
| localStorage authorization (prod) | 0 |
| authenticated != authorized | enforced |
| auth API runtime cache | 0 |
| PII in offline.html | 0 |
| financial/medical exposure | 0 |
| project_admin / BYPASSRLS | OPEN (platform; unrelated) |
| true least privilege | **not claimed** |

## 15. Findings from T2-1C

| Finding | Status |
|---|---|
| FINDING-1 fixture rebuild bypass | **RESOLVED** |
| FINDING-2 evidence incomplete | **RESOLVED** (this doc) |
| FINDING-3 AC001 installability | **RESOLVED** |
| FINDING-4 AC004 update | **RESOLVED** |
| FINDING-5 ErrorBoundary | **RESOLVED** |
| FINDING-6 logout + prod SW automation | **RESOLVED** |

Remaining low: Fast Refresh warning in `AuthContext.tsx` (non-blocking).

## 16. Limitations / deferred (explicit human closure)

| Item | Deferred to |
|---|---|
| SPEC-060 R014 / R015 canonical assignments | `R2H-T2-2` |
| SPEC-011 R003 HTTPS production | later deploy unit |
| SPEC-011 AC005 domain IndexedDB preservation | later domain unit |
| Ticket manifest, QR, check-in | `R2H-T2-3` |
| Offline queue, synchronization, conflicts | `R2H-T2-4` |
| Native `beforeinstallprompt` CI assertion | optional polish (non-blocking) |
| Fast Refresh warning `AuthContext.tsx:145` | low debt (non-blocking) |

## 17. Scope confirmation

```text
scope violations = 0
Main / production writes = 0
staged / commit / push = 0
```

## 18. Human closure and next gate

```text
R2H-T2-1B = VALIDATED / CLOSED
LOCAL IMPLEMENTATION + AUTOMATED AND MANUAL VALIDATION SCOPE
(Project Owner approval 2026-08-01 America/Merida;
 documentary closure formalized 2026-08-02)
```

CTO path: T2-1C `CHANGES_REQUIRED` → T2-1D remediation → T2-1E
`READY_FOR_HUMAN_VALIDATION_APPROVAL` → human closure.

```text
READY_FOR_R2H_T2_1B_CLOSURE_COMMIT_REVIEW
```

A separate human unit must review and authorize the exact commit inventory
for the local T2-1B/T2-1D tree. This closure does **not** authorize commit,
push, R2H-T2-2 execution, new dependencies, SQL/migrations/RLS, InsForge,
Main, or production.

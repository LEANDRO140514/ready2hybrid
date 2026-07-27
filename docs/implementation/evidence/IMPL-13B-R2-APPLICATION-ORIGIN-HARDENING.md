# IMPL-13B-R2 — Application Origin Hardening + Atomic Submit Guard

```text
Unit: IMPL-13B-R2 — Application Origin Enforcement + Atomic Submit Guard
Mode: VALIDATE AND CORRECT · SANDBOX ONLY · NO IMPL-13C · NO MAIN DEPLOY
Local datetime (America/Merida): 2026-07-26
Ready2Hybrid baseline HEAD: 48ffc90
Landing baseline HEAD: 5cb5848
Sandbox: impl-13b-spectator-wiring / 4bg9ufz2-rug
Host: https://4bg9ufz2-rug.us-east.insforge.app
Result: APPLICATION_ORIGIN_ENFORCEMENT = PASS
        STRICT_CORS_CONTRACT = ACCEPTED_AS_GATEWAY_LIMITATION_FOR_SANDBOX
          (human closure 2026-07-26 — see IMPL-13B-HUMAN-CLOSURE.md)
        FRONTEND_ATOMIC_SUBMIT = PASS (sync lock + zero-dep script)
Gate after human closure: READY_FOR_IMPL_13C_SPECTATOR_SANDBOX_E2E
IMPL-13B: VALIDATED / CLOSED
IMPL-13C: PREPARED / AWAITING_EXECUTION_AUTHORIZATION
```

## 1. Root cause (confirmed from IMPL-13B-R1)

| Layer | Defect |
|---|---|
| Application | `mp-create-checkout` / `get-order-status` set CORS headers from env but never compared/rejected request `Origin` before business logic |
| Landing | `submitting` React state alone allowed multiple POSTs on rapid clicks |
| Gateway | OPTIONS reflects any Origin; POST/GET observe `Access-Control-Allow-Origin: *` |

Classification: `D. MIXED_APPLICATION_AND_GATEWAY_DEFECT` — this unit fixes only A/B/C under application control.

## 2. Files modified

### Ready2Hybrid

| Path | Change |
|---|---|
| `insforge/functions/_shared/http/origin-guard.ts` | New exact Origin gate helper (no wildcard) |
| `insforge/functions/mp-create-checkout/index.ts` | Origin gate after method, before JSON/catalog/MP |
| `insforge/functions/get-order-status/index.ts` | Origin gate after method, before orchestrate/DB |
| `insforge/functions/_shared/checkout/errors.ts` | `ORIGIN_NOT_ALLOWED` |
| `insforge/functions/_shared/public-status/errors.ts` | `ORIGIN_NOT_ALLOWED` |
| `insforge/functions/*/handler.deploy.js` | Regenerated deploy bundles |
| `tests/unit/http/origin-guard.test.ts` | Unit + spy + source-order coverage |
| `docs/implementation/evidence/IMPL-13B-R2-APPLICATION-ORIGIN-HARDENING.md` | This evidence |

### Landing (`hybrid-event-landing`)

| Path | Change |
|---|---|
| `src/lib/submitLock.ts` | Synchronous submit lock |
| `src/pages/LandingPage.tsx` | `useRef` lock before checkout POST |
| `scripts/verify-submit-lock.mjs` | Zero-dep lock contract check |

Untouched: migrations, products/prices, webhook, team-roster, ticket-credentials, package.json/lockfile, Main InsForge.

## 3. Origin contract

| Item | Rule |
|---|---|
| Env | `CHECKOUT_CORS_ORIGIN` / `ORDER_STATUS_CORS_ORIGIN` (order-status may fall back to checkout) |
| Sandbox value | `http://localhost:3000` (exact) |
| Match | Exact string equality after trim of configured value |
| Forbidden | wildcards, startsWith/endsWith/includes, regex, hostname-only, Referer |
| Missing config | fail-closed → `CONFIGURATION_ERROR` (503) |
| Bad / null / absent Origin | HTTP 403 `ORIGIN_NOT_ALLOWED` — `Request origin is not allowed.` |
| Allowed response headers | exact ACAO + `Vary: Origin` (application); never `*` from app code |

## 4. Validation order

```text
request → method check → Origin gate → (403/503 if fail)
       → only then payload/reference → catalog/DB → business writes / MP
```

## 5. Tests (Ready2Hybrid)

```text
vitest: tests/unit/http/origin-guard.test.ts — 13 passed
full suite: 193 passed / 14 files
```

Coverage includes authorized/unauthorized/null/absent/missing-config, no wildcard, Vary, reject-before-business spies, handler source order.

## 6. Landing atomic submit

```text
Mechanism: createSubmitLock() held in useRef; tryAcquire() before any await/setState
Release: only on validation failure / API error (retry allowed); not on successful navigation start
Idempotency: getOrCreateCheckoutAttempt reuses key for same product/qty without public ref
Gate script: node scripts/verify-submit-lock.mjs → PASS (3 sync calls → 1 post; retry same key)
Deps added: 0
```

## 7. Sandbox deploy

```text
CLI: @insforge/cli@0.2.1 · project impl-13b-spectator-wiring (4bg9ufz2-rug)
Deployed only: mp-create-checkout, get-order-status
Not deployed: mp-webhook, team-roster, ticket-credentials
Main: not modified
```

## 8. Runtime matrices (sandbox host)

Payload checkout: `PUB-VIE` / qty 1 / `impl13b-r2-origin-check-0001`  
Status ref: `trk_00000000000000000000000000000000`

### POST `mp-create-checkout`

| Origin | App status/body | Observed ACAO |
|---|---|---|
| `http://localhost:3000` | 409 `SALES_NOT_OPEN` | `*` (gateway) |
| `https://example.invalid` | 403 `ORIGIN_NOT_ALLOWED` | `*` (gateway) |
| `null` | 403 `ORIGIN_NOT_ALLOWED` | `*` (gateway) |
| absent | 403 `ORIGIN_NOT_ALLOWED` | `*` (gateway) |

### GET `get-order-status`

| Origin | App status/body | Observed ACAO |
|---|---|---|
| `http://localhost:3000` | 404 `ORDER_NOT_FOUND` | `*` (gateway) |
| `https://example.invalid` | 403 `ORIGIN_NOT_ALLOWED` | `*` (gateway) |
| `null` | 403 `ORIGIN_NOT_ALLOWED` | `*` (gateway) |
| absent | 403 `ORIGIN_NOT_ALLOWED` | `*` (gateway) |

### OPTIONS

| Origin | Observed | Interpretation |
|---|---|---|
| authorized | 204, ACAO=`http://localhost:3000` | Gateway preflight (may not reach function) |
| unauthorized / null | 204, ACAO reflects request Origin | Gateway reflects Origin; not app 403 |
| absent | 204, empty ACAO | Gateway preflight |

## 9. Gateway residual

```text
OPTIONS continues reflecting Origin = YES
POST/GET continue receiving ACAO * from gateway = YES
Unauthorized body is ORIGIN_NOT_ALLOWED = YES
Unauthorized Origin reaches business logic = NO
```

## 10. Transactional state (sandbox post-test)

```text
HEX-2026 = CONFIGURADO
orders/payments/registrations/tickets/credentials/entitlements = 0
idempotency_records/capacity_holds = 0
MP preferences/checkouts/payments created by this unit = 0
```

## 11. Security interpretation

```text
APPLICATION_ORIGIN_ENFORCEMENT = PASS
STRICT_CORS_CONTRACT = NOT PASS (gateway wildcard residual; pending human decision)
```

Origin enforcement is not a defense against curl/scripts/forged Origin from non-browser clients.

## 12. Rollback

```text
Ready2Hybrid: revert this hardening commit; redeploy prior handler.deploy.js to sandbox only
Landing: revert atomic submit commit
Feature flag remains off by default
```

## 13. Gates

| Gate | Result |
|---|---|
| Ready2Hybrid lint/typecheck/test/build | PASS (193 tests) |
| Landing lint/build | PASS |
| Landing package.json / lockfile | intact |
| New dependencies | 0 |

## 14. Human decision (post-R2)

```text
2026-07-26 — Project Owner accepted gateway CORS limitation for sandbox.
IMPL-13B-R3 not required as a separate technical unit.
Closure evidence: IMPL-13B-HUMAN-CLOSURE.md
Next: IMPL-13C — Single spectator sandbox E2E (preparation ready)
```

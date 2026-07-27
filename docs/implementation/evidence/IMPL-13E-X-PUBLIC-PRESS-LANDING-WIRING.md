# IMPL-13E-X — Public and Press Single-Day Landing Wiring

```text
Unit: IMPL-13E-X — Public and press single-day landing wiring
Mode: PREPARE AND IMPLEMENT · LANDING SCOPE · NO PAYMENTS · NO EN_VENTA
Local datetime (America/Merida): 2026-07-27
Ready2Hybrid baseline: 4ba27ab
Landing baseline: 9b9cf48 → wiring commit (see §15)
Sandbox: impl-13e-public-press / 4bg9ufz2-6mq
Host: https://4bg9ufz2-6mq.us-east.insforge.app
Result: IMPLEMENTED / TECHNICALLY VALIDATED
Gate: READY_FOR_IMPL_13E_Y_PUBLIC_PRESS_SANDBOX_E2E_APPROVAL
```

## 1. Baseline and sandbox

| Item | Value |
|---|---|
| Ready2Hybrid | `main` @ `4ba27ab` (pre-docs commit) |
| Landing start | `main` @ `9b9cf48` |
| Sandbox | `impl-13e-public-press` / `4bg9ufz2-6mq` |
| Event | `HEX-2026` = `CONFIGURADO` |
| E-0 hardening | `PUB-3D` → `PRODUCT_NOT_AVAILABLE` confirmed on sandbox |
| Initial TX | all zeros (orders/payments/regs/tickets/creds/ents/holds/idem) |

## 2. Scope

Enabled sandbox products:

```text
PUB-VIE, PUB-SAB, PUB-DOM  (spectator, qty editable ≥ 1)
FOT-VIE, FOT-SAB, FOT-DOM  (press, qty fixed = 1)
```

Excluded:

```text
PUB-3D, FOT-3D (no frontend allowlist; backend PRODUCT_NOT_AVAILABLE)
WOD-*, IND-*, HALF-IND-*, DOB-*, HALF-DOB-*, REL-*
```

No waiver, roster, participant forms, payments, or Main deploy.

## 3. Landing files modified

| Path | Change |
|---|---|
| `src/config/checkoutConfig.ts` | Allowlist + `getSandboxCheckoutProductConfig` / `isSandboxCheckoutProduct` |
| `src/pages/LandingPage.tsx` | Six-product sandbox UX; shared page lock; FOT without qty input |
| `src/lib/checkoutSession.ts` | Namespace `v2:<PRODUCT_CODE>`; legacy PUB-VIE v1 migrate; last-ref for confirmando |
| `src/lib/submitLock.ts` | Page-wide lock on `globalThis` + active product UI store |
| `src/api/checkout.ts` | Map `PRODUCT_NOT_AVAILABLE` / `ORIGIN_NOT_ALLOWED` messages |
| `src/pages/CheckoutConfirmPage.tsx` | `clearCheckoutAttempt(reference)` |
| `scripts/verify-submit-lock.mjs` | Shared lock + idempotency namespace cases |

Untouched: `package.json`, lockfile, `catalogo.ts`, theme, media, brand, routes.

## 4. Product config (non-monetary)

```text
PUB-*: family=spectator · quantityMode=editable · minimumQuantity=1
FOT-*: family=press · quantityMode=fixed · minimumQuantity=1
```

Checkout body never sends price/amount.

## 5. Submit lock

One shared page lock (`getSandboxCheckoutPageLock`) held on `globalThis` so Vite HMR cannot fork instances. While locked, all sandbox checkout buttons disable; active product shows “Iniciando…”.

Browser evidence (`http://localhost:3000`, Origin authorized):

```text
3× PUB-SAB click → 1 POST (product_code PUB-SAB)
PUB-SAB + immediate FOT → 1 POST (first product wins)
After SALES_NOT_OPEN → lock released; other product may attempt
UI: 6× Probar checkout; 3× Cantidad (PUB only); no Probar on *3D*
```

## 6. Idempotency

```text
hybrid.checkout.attempt.v2:<PRODUCT_CODE>
legacy hybrid.checkout.attempt.v1 readable only for PUB-VIE → migrated to v2
```

Observed session keys after sandbox attempts:

```text
hybrid.checkout.attempt.v2:PUB-SAB
hybrid.checkout.attempt.v2:FOT-VIE
```

Same product+qty reuse confirmed (truncated keys in Network/session). Different product → different key.

## 7. Feature flag off / on

| Mode | Result |
|---|---|
| No `.env.local` (flags default off) | `Probar checkout = 0`; public “Ventas abren…” intact |
| Sandbox `.env.local` → `4bg9ufz2-6mq` | 6 checkout cards; ASISTE *3D* visible without sandbox controls |

Production host `hybrid-experience.enforma.mx` remains hard-blocked in `isSandboxCheckoutActive`.

## 8. Runtime matrix (sandbox CONFIGURADO)

| Case | HTTP | Code |
|---|---:|---|
| PUB-VIE/SAB/DOM qty 1–2 | 409 | SALES_NOT_OPEN |
| FOT-* qty 1 | 409 | SALES_NOT_OPEN |
| PUB-3D / FOT-3D | 409 | PRODUCT_NOT_AVAILABLE |
| Bad Origin | 403 | ORIGIN_NOT_ALLOWED |
| FOT qty 2 (direct API) | 409 | SALES_NOT_OPEN† |

† With event `CONFIGURADO`, sales gate runs before quantity validation; frontend never sends FOT qty ≠ 1. `INVALID_REQUEST` for FOT qty 2 requires `EN_VENTA` (out of this unit).

Local invalid PUB qty (0 / text / empty): fetch = 0 (UI parse).

## 9. Transactional state

After all tests:

```text
Sandbox 6mq: orders/payments/regs/tickets/creds/ents/holds/idem = 0
Main: CONFIGURADO · transactional rows = 0
MP preferences/payments = 0
```

## 10. Automated gates (landing)

```text
npm run lint = PASS
npm run build = PASS (PWA generateSW PASS)
node scripts/verify-submit-lock.mjs = PASS
new dependencies = 0
```

## 11. QA

| Check | Result |
|---|---|
| Flag off UI unchanged | PASS |
| Sandbox 6 controls | PASS |
| Keyboard / focus-visible styles retained | PASS (existing button styles) |
| Console (sandbox) | Vite + React DevTools only; no app errors |
| Responsive smoke | Page loads; ASISTE section usable |

## 12. CORS / security

Application Origin fail-closed retained (IMPL-13E-0/13B). Gateway ACAO* residual accepted for sandbox only. Abuse/rate-limit gate remains OPEN for production. Frontend never sends price.

## 13. Limitations

- Browser Origin must be exactly `http://localhost:3000` (not `127.0.0.1`) to match sandbox CORS secret.
- Direct API FOT qty 2 under `CONFIGURADO` surfaces `SALES_NOT_OPEN` before quantity error.
- No E2E payments in this unit.

## 14. Rollback

```text
Landing: revert IMPL-13E-X commit (flags remain off by default)
Ready2Hybrid: revert documentary evidence commit only
Do not delete InsForge sandbox or IMPL-13E-0 evidence
```

## 15. Gate

```text
Landing commit: b4f50c0 feat(checkout): expand public and press sandbox wiring
IMPL-13E-X = IMPLEMENTED / TECHNICALLY VALIDATED
READY_FOR_IMPL_13E_Y_PUBLIC_PRESS_SANDBOX_E2E_APPROVAL
```

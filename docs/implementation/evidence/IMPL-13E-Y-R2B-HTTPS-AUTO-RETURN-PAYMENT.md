# IMPL-13E-Y-R2B — Single HTTPS Auto-Return Sandbox Payment

```text
Unit: IMPL-13E-Y-R2B — Single HTTPS Auto-Return Sandbox Payment
Mode: ONE SANDBOX PAYMENT · HTTPS PREVIEW RETURN · NO CODE CHANGE
Local datetime (America/Merida): 2026-07-27
Ready2Hybrid HEAD at start: c1536fd
Landing HEAD: b4f50c0 (unchanged)
Sandbox: impl-13e-public-press / 4bg9ufz2-6mq
Preview: https://3e9sriq7.insforge.site
Result: AUTO_RETURN HTTPS REACHABILITY PROVEN / PUBLIC REF BINDING GAP RECORDED
Gate: READY_FOR_IMPL_13E_Y_HUMAN_CLOSURE_REVIEW
```

## 1. Baseline

| Repo | Branch | HEAD | Tree |
|---|---|---|---|
| Ready2Hybrid | `main` | `c1536fd` | tracked clean; `?? .cursor/*` |
| Landing | `main` | `b4f50c0` | clean · commits = 0 |

Preview CORS/back URLs already set in R2A:

```text
CHECKOUT_CORS_ORIGIN = https://3e9sriq7.insforge.site
ORDER_STATUS_CORS_ORIGIN = https://3e9sriq7.insforge.site
CHECKOUT_BACK_URL_* = https://3e9sriq7.insforge.site/checkout/confirmando
```

## 2. External preflight

```text
Main HEX-2026 = CONFIGURADO · orders/payments = 0
Sandbox HEX-2026 = CONFIGURADO → EN_VENTA (temporary) → CONFIGURADO
```

## 3. Preference (FOT-SAB × 1)

Authorized payment product: **FOT-SAB** · qty **1** · **$350 MXN**.

Successful paid preference:

| Field | Value |
|---|---|
| preference_id suffix | `21a8a1fbf2d5` |
| `auto_return` | `approved` |
| `back_urls.*` | `https://3e9sriq7.insforge.site/checkout/confirmando` |
| `public_order_reference` | `trk_6f542e126fbf42179a69293ab4ba74fd` |
| order_id | `1b45c164-b2c6-4b0b-a471-93d3a10dab09` |
| amount | 35000 cents |

Prior unpaid attempt retained (no payment): `trk_0b2ad679e2ad4b16979ebbd96daa76a5` (browser/session failures before card).

## 4. Browser / Mercado Pago friction (recorded)

| Issue | Outcome |
|---|---|
| agent-browser Checkout Pro | blocked (`Hubo un error…`) |
| `sandbox.mercadopago.com.mx` | `ERR_TOO_MANY_REDIRECTS` |
| Guest / wrong card / OTP confusion | “No pudimos procesar tu pago”; payments = 0 |
| Test-buyer verification code | **not email OTP** — 6-digit code from MP panel / last 6 of User ID |
| Working card | Visa `4075 5957 1648 3764` · titular `APRO` |

Human PO completed payment in a clean browser session.

## 5. Payment evidence

| Field | Value |
|---|---|
| `payment_id` | `170723724364` |
| amount | $350 MXN |
| method | Visa · Banamex ****3764 |
| descriptor | `Mercadopago*fake` |
| `live_mode` | `true` (same provider discrepancy class as Y) |
| MP UI | “¡Listo! Tu pago ya se acreditó” |
| MP redirect copy | “En 3 segundos te llevaremos a .” (empty site label) |

## 6. Auto-return observation

```text
MP success → HTTPS preview /checkout/confirmando = REACHED
```

Return URL from MP **did not** include `?ref=trk_…`.

Because checkout was opened via **direct preference URL** (not landing), `sessionStorage` had no last public ref.

Confirming UI correctly showed:

```text
No encontramos una referencia de orden válida.
```

Classification:

| Claim | Status |
|---|---|
| HTTPS preview accepts MP return | **PROVEN** |
| `auto_return=approved` fires to configured back_url | **PROVEN** (human) |
| Return binds public `trk_` without landing session | **NOT PROVEN / GAP** |
| Confirming authority via `?ref=` + `get-order-status` | **PROVEN** after webhook |

## 7. Server authority

Signed webhook simulator (sandbox secret):

| Call | Result |
|---|---|
| first | HTTP 200 · `PAID` |
| duplicate | HTTP 200 · `ALREADY_PAID` |
| bad signature | HTTP 401 |

```text
order state: PAYMENT_PENDING → PAID
get-order-status?reference=trk_6f542e126fbf42179a69293ab4ba74fd → APPROVED
artifacts on paid order: payments=1 · registrations=1 · tickets=1
```

## 8. Confirming HTTPS with correct ref

Correct URL (human-validated screenshot):

```text
https://3e9sriq7.insforge.site/checkout/confirmando?ref=trk_6f542e126fbf42179a69293ab4ba74fd
UI = Pago confirmado
aria-live present
ENTORNO DE PRUEBA visible
```

Note: an earlier shared URL used typo `…79a80293…` (should be `…79a69293…`) → `ORDER_NOT_FOUND` / consult error. Correct hex ends with `…6136393239…` (`a69293`).

## 9. Product gap (no code change in this unit)

```text
RETURN_PUBLIC_REF_BINDING = OPEN
```

Static `CHECKOUT_BACK_URL_*` points at `/checkout/confirmando` without embedding `?ref=<tracking_ref>`.  
Normal landing path relies on `sessionStorage` (`hybrid.checkout.last_public_ref.v1`).  
Direct preference / MP-only return therefore lands without a resolvable public reference.

Recommended follow-up (not authorized here): preference back_urls include `?ref=<trk_…>` at create time, and/or confirming accepts a safe mapping from MP `external_reference` without exposing internal IDs in UI.

## 10. Rollback / Main

```text
Sandbox HEX-2026 = CONFIGURADO (CLI rollback done)
Main HEX-2026 = CONFIGURADO
Main transactional rows = 0
Landing commits = 0
Backend function deploys = 0
```

## 11. IMPL-13E-Y status

```text
IMPL-13E-Y =
PAYMENTS AND DOMAIN ARTIFACTS VALIDATED /
HTTPS AUTO_RETURN REACHABILITY PROVEN /
RETURN PUBLIC REF BINDING GAP OPEN
```

## 12. Gate

```text
READY_FOR_IMPL_13E_Y_HUMAN_CLOSURE_REVIEW
```

Human may close Y accepting the binding gap as a follow-up unit, or require a minimal return-ref binding fix first.

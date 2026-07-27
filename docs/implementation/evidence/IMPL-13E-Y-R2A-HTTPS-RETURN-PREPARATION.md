# IMPL-13E-Y-R2A — HTTPS Preview and Confirming Page Validation

```text
Unit: IMPL-13E-Y-R2A — HTTPS Preview and Confirming Page Validation
Mode: NO NEW PAYMENT · NO NEW PREFERENCE · NO EVENT OPENING · DOCS ONLY IN R2H
Local datetime (America/Merida): 2026-07-27
Ready2Hybrid baseline HEAD: bb83af4
Landing baseline HEAD: b4f50c0
Sandbox: impl-13e-public-press / 4bg9ufz2-6mq
Preview provider: InsForge Deployments → Vercel
Preview URL: https://3e9sriq7.insforge.site
Gate: READY_FOR_SINGLE_HTTPS_RETURN_PAYMENT_APPROVAL
```

## 1. Baseline / Preflight Git

| Repo | Branch | HEAD | origin/main | Divergencia | Tree |
|---|---|---|---|---|---|
| Ready2Hybrid | `main` | `bb83af4` | `bb83af4` | `0 / 0` | clean tracked; `?? .cursor/*` only |
| Landing | `main` | `b4f50c0` | `b4f50c0` | `0 / 0` | clean |

Landing commit count during unit = **0** (deployed existing `b4f50c0` only).

## 2. Estado externo inicial

### Main (read-only MCP)

```text
HEX-2026 = CONFIGURADO
orders = 0
payments = 0
```

### Sandbox (CLI)

```text
HEX-2026 = CONFIGURADO
orders = 4
payments = 2
registrations = 7
tickets = 3
access_entitlements = 3
capacity_holds = 4
idempotency_records = 4
capability_credentials ORDER_HOLDER = 4
capability_credentials TICKET_ACCESS = 3
```

Global counts are inventory, not correlation claims.

## 3. Local `/checkout/confirmando` (localhost:3000 → sandbox 6mq)

Landing `.env.local` (gitignored) + process override:

```text
VITE_CHECKOUT_MODE = sandbox
VITE_CHECKOUT_ENABLED = true
VITE_INSFORGE_FUNCTIONS_BASE = https://4bg9ufz2-6mq.us-east.insforge.app
```

Note: shell user env previously pointed `VITE_INSFORGE_FUNCTIONS_BASE` at `4bg9ufz2-rug`; Vite prefers process env over `.env.local`. Dev server restarted with explicit `6mq` override. Values not printed beyond public host.

### 3.1 PUB-SAB

```text
URL: /checkout/confirmando?ref=trk_bc94c3d32b9645589f01ffd922079f12
page load = PASS
get-order-status = APPROVED (API + UI)
visible = "Pago confirmado"
aria-live = present
internal UUIDs visible = no
```

### 3.2 FOT-VIE

```text
URL: /checkout/confirmando?ref=trk_fdd04a64b496419b9f2f20f7b81a4e85
get-order-status / UI = APPROVED
```

### 3.3 Fake Mercado Pago query params

```text
?ref=<PUB-SAB>
&collection_status=rejected&status=failure
&payment_id=999999999&merchant_order_id=999999999
UI = still "Pago confirmado" (InsForge authority)
```

### 3.4 Invalid reference

```text
?ref=invalid
local reject = PASS
message = "No encontramos una referencia de orden válida."
no get-order-status network call required (client validation)
```

### 3.5 Valid-format missing reference

```text
?ref=trk_00000000000000000000000000000000
API = 404 (ORDER_NOT_FOUND class)
UI = sanitized retry ("No pudimos consultar…") + "VOLVER A CONSULTAR"
no internal IDs
```

## 4. sessionStorage restore

Key used by landing: `hybrid.checkout.last_public_ref.v1`

| Case | Result |
|---|---|
| Seed last public ref → open `/checkout/confirmando` without `?ref=` | URL has no ref; UI APPROVED |
| Corrupt JSON in last-ref key | missing-ref message; no invalid fetch |
| Empty sessionStorage | missing-ref message; fetch = 0 |

Stored payload shape: `{ reference, productCode, savedAt }` only — no payment_id / internal order_id / price / PII / token.

## 5. QA local

| Check | Result |
|---|---|
| 360 × 740 | PASS — APPROVED + aria-live |
| Desktop 1280 × 800 | PASS — APPROVED + aria-live |
| Keyboard Tab focus | focus moves to interactive control |
| aria-live | present on status text |
| Console | Vite/React DevTools info only; no app errors observed |

## 6. Preview infrastructure (read-only then authorized deploy)

| Finding | Detail |
|---|---|
| Provider in use | InsForge Deployments → Vercel |
| Project | landing InsForge app `3e9sriq7` (distinct from payment sandbox `4bg9ufz2-6mq`) |
| Existing HTTPS surfaces | `https://3e9sriq7.insforge.site`, custom `https://hype.insforge.site` |
| Productive brand domain | `hybrid-experience.enforma.mx` — **not used** |
| Prior env vars | none (empty) before this unit |
| New provider / tunnel / DNS | **not used** |

### Classification

```text
B. EXISTING_PROVIDER_SUPPORTS_PREVIEW
```

Existing InsForge/Vercel surface supports temporary HTTPS deploy of exact landing commit without productive brand domain.

## 7. Preview deployment

| Field | Value |
|---|---|
| URL HTTPS | `https://3e9sriq7.insforge.site` |
| Provider | InsForge → Vercel |
| Deployment id (sanitized) | `527d61fe-…` / provider `dpl_JAN2K…` |
| Commit deployed | `b4f50c0` |
| Timestamp (UTC) | `2026-07-27T08:07:20Z` → READY `08:08:05Z` |
| Public env keys | `VITE_CHECKOUT_MODE=sandbox`, `VITE_CHECKOUT_ENABLED=true`, `VITE_INSFORGE_FUNCTIONS_BASE=https://4bg9ufz2-6mq.us-east.insforge.app` |

Functions path convention confirmed by runtime:

```text
{VITE_INSFORGE_FUNCTIONS_BASE}/functions/get-order-status
```

Hostname guard (code + unit test of predicate):

```text
hostname === hybrid-experience.enforma.mx → isSandboxCheckoutActive = false
preview host 3e9sriq7.insforge.site → sandbox can be active
```

No Main backend connection from preview (functions base = sandbox `6mq` only).

## 8. Sandbox CORS / back URLs (branch only)

Configured on `impl-13e-public-press` / `4bg9ufz2-6mq` (not Main):

```text
CHECKOUT_CORS_ORIGIN = https://3e9sriq7.insforge.site
ORDER_STATUS_CORS_ORIGIN = https://3e9sriq7.insforge.site
CHECKOUT_BACK_URL_SUCCESS = https://3e9sriq7.insforge.site/checkout/confirmando
CHECKOUT_BACK_URL_PENDING = https://3e9sriq7.insforge.site/checkout/confirmando
CHECKOUT_BACK_URL_FAILURE = https://3e9sriq7.insforge.site/checkout/confirmando
```

No `*`, no comma lists, no localhost, no productive brand domain in configured secrets.
`auto_return` code unchanged (`approved` still set by mp-client).
No preferences created in this unit.

Gateway residual ACAO `*` on some GET responses remains the known IMPL-13B sandbox note; application Origin secrets are set to the exact preview origin. Browser fetch from preview → `get-order-status` = **200 APPROVED**.

## 9. HTTPS confirming with existing paid refs

### PUB-SAB

```text
https://3e9sriq7.insforge.site/checkout/confirmando?ref=trk_bc94c3d32b9645589f01ffd922079f12
HTTP/page = PASS
get-order-status Fetch 200 → APPROVED
UI = Pago confirmado
aria-live = present
```

### FOT-VIE

```text
…?ref=trk_fdd04a64b496419b9f2f20f7b81a4e85
UI = Pago confirmado
```

### Fake MP params on HTTPS

```text
UI remains APPROVED (InsForge authority)
```

## 10. Mercado Pago back_url compatibility

| Claim | Class |
|---|---|
| HTTPS absolute URL required; localhost rejected | confirmed by documentation + prior IMPL-13E-Y runtime |
| `auto_return=approved` documented with HTTPS back_urls | confirmed by documentation |
| Preview path `/checkout/confirmando` allowed by docs (absolute URL) | confirmed by documentation |
| Domain allowlist beyond HTTPS/public reachability | not demonstrated |
| Real auto_return redirect to this preview | **not demonstrated** (no new preference) |

```text
PREVIEW_BACK_URL_FORMAT = COMPATIBLE
```

## 11. Additional payment decision

```text
¿Se demostró la pantalla confirmando con refs pagadas? = sí
¿Se demostró polling/consulta UI hasta APPROVED? = sí
¿Se demostró auto_return real desde Mercado Pago? = no
¿Es imprescindible un pago nuevo para demostrar auto_return approved? = sí
```

Recommended (not authorized) next payment:

```text
product = FOT-SAB
quantity = 1
expected amount = $350 MXN
unit = IMPL-13E-Y-R2B — Single HTTPS Auto-Return Sandbox Payment
```

## 12. Gap retained (no fix)

```text
PAYMENT_PENDING_EXPIRY_RECONCILIATION = OPEN / REQUIRED BEFORE PRODUCTION
```

Facts unchanged: PAYMENT_PENDING order with past `expires_at`, ACTIVE hold past expiry, no approved payment / ticket / entitlement / access credential. Not an access security blocker demonstrated here. No row mutation.

## 13. Estado externo final

### Main

```text
HEX-2026 = CONFIGURADO
transactional rows = 0
```

### Sandbox

```text
HEX-2026 = CONFIGURADO
orders = 4
payments = 2
registrations = 7
tickets = 3
access_entitlements = 3
capacity_holds = 4
idempotency_records = 4
capability_credentials ORDER_HOLDER = 4
capability_credentials TICKET_ACCESS = 3
```

Counts identical to initial snapshot. No new preferences / orders / payments / registrations / tickets / credentials / entitlements / holds / idempotency records created by this unit.

## 14. Recursos protegidos

```text
nuevas preferencias = 0
nuevos checkouts = 0
nuevos pagos = 0
Mercado Pago writes = 0
sandbox EN_VENTA = not opened
Main writes = 0
backend function deploys = 0
código landing/R2H = 0 (docs only in R2H)
precios/productos = unchanged
```

## 15. IMPL-13E-Y status retained

```text
IMPL-13E-Y =
PAYMENTS AND DOMAIN ARTIFACTS VALIDATED /
AUTO_RETURN APPROVED NOT YET PROVEN
```

## 16. Gate

```text
READY_FOR_SINGLE_HTTPS_RETURN_PAYMENT_APPROVAL
```

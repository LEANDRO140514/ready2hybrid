# IMPL-13E-Y — Public and Press Sandbox E2E

```text
Unit: IMPL-13E-Y — Public and Press Sandbox E2E
Mode: VALIDATE · SANDBOX ONLY · TEST PAYMENTS ONLY · NO NEW FEATURE CODE
Local datetime (America/Merida): 2026-07-26 / 2026-07-27
Ready2Hybrid HEAD at start: c2df243
Landing HEAD: b4f50c0
Sandbox: impl-13e-public-press / 4bg9ufz2-6mq
Host: https://4bg9ufz2-6mq.us-east.insforge.app
Result: TECHNICALLY VALIDATED / READY_FOR_HUMAN_CLOSURE
Gate: READY_FOR_IMPL_13E_Y_HUMAN_CLOSURE
```

## 1. Preflight Git

| Repo | Branch | HEAD | origin/main | Divergencia | Tree |
|---|---|---|---|---|---|
| Ready2Hybrid | `main` | `c2df243` | `c2df243` | `0 / 0` | clean tracked; `?? .cursor/*` only |
| Landing | `main` | `b4f50c0` | `b4f50c0` | `0 / 0` | clean |

## 2. Preflight Main

```text
HEX-2026 = CONFIGURADO
orders = payments = registrations = tickets = credentials = entitlements = 0
```

Main writes during unit = **0**. Cursor InsForge MCP targets Main; all sandbox opens/closes used **CLI only**.

## 3. Preflight sandbox

```text
branch = impl-13e-public-press
app key = 4bg9ufz2-6mq
HEX-2026 = CONFIGURADO (initial)
orders/payments/registrations/tickets/credentials/entitlements/holds/idempotency = 0
```

## 4. Functions and configuration

Deployed to sandbox only (not Main):

```text
mp-create-checkout
mp-webhook
get-order-status
ticket-credentials
```

Secrets present (values not printed):

| Key | Result |
|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | present (`APP_USR-…`) |
| `MERCADOPAGO_WEBHOOK_SECRET` | added from local ignored `.cursor/mcp.env` (`MERCADOPAGO-WEBHOOK_SECRET`) |
| `CHECKOUT_NOTIFICATION_URL` | sandbox `/functions/mp-webhook` |
| `CHECKOUT_HOLD_DURATION_SECONDS` | `1800` |
| `CHECKOUT_IDEMPOTENCY_TTL_SECONDS` | `86400` |
| `CHECKOUT_CORS_ORIGIN` | `http://localhost:3000` |
| `ORDER_STATUS_CORS_ORIGIN` | `http://localhost:3000` |
| `CHECKOUT_BACK_URL_*` | initially localhost confirmando; **updated to `https://example.com/r2h/{success,failure,pending}`** after MP probe |

Landing `.env.local` (gitignored): `VITE_CHECKOUT_MODE=sandbox`, `VITE_CHECKOUT_ENABLED=true`, base host `4bg9ufz2-6mq` (code appends `/functions/<slug>`).

## 5. Estado cerrado previo

Under `CONFIGURADO`:

| Request | HTTP | Code |
|---|---:|---|
| PUB-SAB qty 2 | 409 | `SALES_NOT_OPEN` |
| FOT-VIE qty 1 | 409 | `SALES_NOT_OPEN` |

TX remained 0 after closed probes.

## 6. Apertura temporal

```text
timestamp ≈ 2026-07-27T06:35:50Z
actor = agent-cli (InsForge CLI on 4bg9ufz2-6mq)
estado anterior = CONFIGURADO
estado nuevo = EN_VENTA
motivo = IMPL-13E-Y controlled sandbox E2E
Main = unchanged CONFIGURADO
```

## 7. Negative gate FOT quantity

```text
FOT-VIE quantity 2 → HTTP 400 INVALID_REQUEST
orders/idempotency/holds/payments = 0 · no preference
```

## 8. Negative gates multiday and Origin

| Case | HTTP | Code |
|---|---:|---|
| PUB-3D qty 1 | 409 | `PRODUCT_NOT_AVAILABLE` |
| FOT-3D qty 1 | 409 | `PRODUCT_NOT_AVAILABLE` |
| Origin `https://example.invalid` + PUB-SAB | 403 | `ORIGIN_NOT_ALLOWED` |

Writes after negatives = 0.

## 9. E2E PUB-SAB × 2

### Failed preference (localhost + auto_return)

First create with localhost back URLs → HTTP **502** `CHECKOUT_CREATION_FAILED`.

Order `trk_1aceaced…` compensated to `CANCELLED` / `PREFERENCE_FAILED`; hold `RELEASED`; **no payment**.

MP probe:

| Variant | Result |
|---|---|
| localhost + `auto_return` | 400 `auto_return invalid. back_url.success must be defined` |
| localhost without auto_return | 201 OK |
| https example.com + auto_return | 201 OK |

Code always sends `auto_return: approved` (no code change authorized) → sandbox back URLs set to `example.com` (same class as IMPL-13C).

### Expired unpaid attempt

Preference `trk_05fbf4f15cd344d6bebf6960a3c651e3` created; guest/test-buyer automation failed; hold expired without MP payment (`payments search count = 0`). Left as `PAYMENT_PENDING` evidence row (not deleted).

### Successful A2

| Field | Value |
|---|---|
| `public_order_reference` | `trk_bc94c3d32b9645589f01ffd922079f12` |
| order id | `9a82e09e-5ddb-4ef2-8554-3759bc1dbce8` |
| amount | **50000 cents / $500 MXN** |
| `payment_id` | `170718270018` |
| status | `approved` / `accredited` |
| method | Mastercard test |
| descriptor | `Mercadopago*fake` |
| `live_mode` | `true` (provider discrepancy; test path) |

## 10. E2E FOT-VIE × 1

One guest attempt failed with “No pudimos procesar tu pago” and **0** MP payments (retry authorized). Visa MX test card then approved.

| Field | Value |
|---|---|
| `public_order_reference` | `trk_fdd04a64b496419b9f2f20f7b81a4e85` |
| order id | `40ba0368-1d6e-400d-a4da-08c4d2a53476` |
| amount | **35000 cents / $350 MXN** |
| `payment_id` | `170719199176` |
| status | `approved` / `accredited` |
| method | Visa test |
| descriptor | `Mercadopago*fake` |
| `live_mode` | `true` |

## 11. Webhooks and server-side authority

For both payments (signed simulator using sandbox webhook secret; MP payment consulted server-side by webhook handler):

| Check | A2 | B |
|---|---|---|
| First signed webhook | 200 · `PAID` · applied | 200 · `PAID` · applied |
| Duplicate | 200 · `ALREADY_PAID` | 200 · `ALREADY_PAID` |
| Bad signature | 401 · `UNAUTHORIZED` | 401 · `UNAUTHORIZED` |
| InsForge order | `PAID` | `PAID` |

Redirect / Checkout Pro UI is **not** authority.

## 12. `get-order-status`

Query param is `reference` (not `public_order_reference`).

Both refs with manipulated MP query noise (`collection_status`, `status`, `payment_id`, `merchant_order_id`) still return:

```text
{"status":"APPROVED","terminal":true,"next_poll_after_seconds":null}
```

## 13. Artifacts by reference

| Ref | payments | registrations | tickets | credentials | entitlements |
|---|---:|---:|---:|---:|---:|
| `trk_bc94c3d32b9645589f01ffd922079f12` (PUB-SAB×2) | 1 | 2 | 2 | 2 | 2 |
| `trk_fdd04a64b496419b9f2f20f7b81a4e85` (FOT-VIE×1) | 1 | 1 | 1 | 1 | 1 |
| **Sum of successful E2Es** | **2** | **3** | **3** | **3** | **3** |

## 14. Idempotency and duplicates

- Distinct idempotency keys for PUB-SAB vs FOT-VIE (hash16 recorded in local packs only).
- Webhook duplicates → `ALREADY_PAID`; no extra payments/artifacts on paid refs.
- Landing submit-lock gate: `verify-submit-lock: PASS` (no code change).

## 15. Página confirmando

Landing confirmando polls `get-order-status?reference=…`. Authority remains InsForge status; MP redirect query params do not change APPROVED (proven via status API with fake MP params). Back URLs used `example.com` due to MP `auto_return` constraint; confirmando validated by reference polling, not redirect trust.

## 16. `live_mode` and test environment

Both payments: `live_mode=true` with `Mercadopago*fake`, test buyer, test cards, sandbox preference host. Recorded as **provider discrepancy**; not treated as productive authorization.

## 17. Estado transaccional final (sandbox)

Correlated successful E2Es: payments=2, tickets=3, entitlements=3, credentials(on paid tickets)=3, registrations(on paid)=3.

Global sandbox inventory also includes non-authoritative leftovers (not deleted):

```text
orders = 4
  PAID = 2 (A2 + B)
  CANCELLED = 1 (PREFERENCE_FAILED localhost attempt)
  PAYMENT_PENDING = 1 (expired unpaid A1; payments=0)
registrations = 7 (includes pre-payment regs on cancelled/pending attempts)
payments = 2
tickets = 3
entitlements = 3
capability_credentials = 7 (3 linked to paid E2E tickets + 4 orphan rows without ticket_id — retained; not correlated to E2E refs)
idempotency_records / holds = present as auxiliaries
```

## 18. Rollback a CONFIGURADO

```text
sandbox HEX-2026: EN_VENTA → CONFIGURADO (CLI)
confirmed sandbox = CONFIGURADO
```

E2E rows retained. Branch retained.

## 19. Main intacto

```text
Main HEX-2026 = CONFIGURADO
Main orders = 0 · payments = 0
```

## 20. Gates automatizados

| Repo | Commands | Result |
|---|---|---|
| Landing | `lint` · `build` · `verify-submit-lock` | PASS |
| Ready2Hybrid | `lint` · `typecheck` · `test` (203) · `build` | PASS |

No tracked technical code changes in this unit.

## 21. Evidencia documental

This file. Status/traceability updates accompany the documentary commit.

## 22. Commit y push

Authorized documentary commit on Ready2Hybrid only:

```text
docs(payments): validate public and press sandbox e2e
```

No landing commit.

## 23. Discrepancias

1. **MP `auto_return` + `http://localhost` back_url** rejected; sandbox used `https://example.com/r2h/*` (same as IMPL-13C). Confirmando authority via polling.
2. **`live_mode=true`** on both test payments with `Mercadopago*fake`.
3. **Failed/expired checkout attempts** left CANCELLED/PAYMENT_PENDING + pre-payment registrations; not deleted.
4. **4 orphan `capability_credentials`** without `ticket_id` in sandbox inventory (not tied to successful E2E refs).
5. Wait-pay helper initially called `get-order-status` with wrong query name; corrected validation uses `reference=`.

## 24. Estado de IMPL-13E-Y

```text
IMPL-13E-Y = TECHNICALLY VALIDATED / READY_FOR_HUMAN_CLOSURE
```

Not declared `VALIDATED / CLOSED` (awaits human closure).

## 25. Gate

```text
READY_FOR_IMPL_13E_Y_HUMAN_CLOSURE
```

# IMPL-13C — Spectator Sandbox E2E Validation

```text
Unit: IMPL-13C — Single spectator sandbox E2E (PUB-VIE)
Mode: EXECUTE · SANDBOX ONLY · NO PRODUCTIVE SALES · NO MAIN EN_VENTA
Local datetime (America/Merida): 2026-07-26
Ready2Hybrid HEAD at start: 84ee1cf
Landing HEAD: 9b9cf48
Sandbox: impl-13b-spectator-wiring / 4bg9ufz2-rug
Host: https://4bg9ufz2-rug.us-east.insforge.app
Result: SPECTATOR_SANDBOX_E2E_PASS
Human closure: APPROVED 2026-07-26 → VALIDATED / CLOSED
  (see IMPL-13C-HUMAN-CLOSURE.md; evidence commit 1de0be2)
Gate after human closure: READY_FOR_NEXT_AUTHORIZED_UNIT
```

## 1. Authority

```text
AUTHORIZED_FOR_IMPL_13C_SPECTATOR_SANDBOX_E2E
Preparation: docs/implementation/evidence/IMPL-13C-SPECTATOR-SANDBOX-E2E-PREPARATION.md
```

## 2. Scope executed

```text
PUB-VIE × 1 → checkout → Checkout Pro test payment → signed webhook
→ get-order-status APPROVED → domain rows → duplicate notification
→ invalid signature → sandbox event rollback to CONFIGURADO
```

Out of scope (respected): Main EN_VENTA persistence, productive credentials/webhook,
real-money intent, OXXO/Paycash/vouchers, non-PUB-VIE products.

## 3. Critical isolation finding

| Client | Target observed |
|---|---|
| InsForge CLI (`current` = rug) | Sandbox DB |
| Cursor MCP `insforge-ready2hybrid` | **Main** DB |

During resume, an early `UPDATE … EN_VENTA` via MCP briefly opened **Main**.
It was reverted immediately to `CONFIGURADO` before the successful sandbox E2E.
Subsequent sales open/close used **CLI only**.

```text
Main after revert + after E2E: HEX-2026 = CONFIGURADO · orders/payments = 0
```

## 4. Sandbox configuration applied for E2E

Missing secrets were absent (fail-closed) and added/updated on sandbox only:

| Secret | Action |
|---|---|
| `CHECKOUT_HOLD_DURATION_SECONDS` | added (`1800`) |
| `CHECKOUT_IDEMPOTENCY_TTL_SECONDS` | added (`86400`) |
| `CHECKOUT_NOTIFICATION_URL` | added (sandbox `/functions/mp-webhook`) |
| `MERCADOPAGO_WEBHOOK_SECRET` | added from local ignored `.cursor/mcp.env` |
| `CHECKOUT_BACK_URL_*` | updated to `https://example.com/r2h/{success,failure,pending}` |

Reason for back_url change: MP rejected `auto_return` with `http://localhost:3000`
(`auto_return invalid. back_url.success must be defined`). Landing return for this
unit is validated via `get-order-status` polling, not redirect trust.

Origin guard remained active (`Origin: http://localhost:3000` on checkout/status).

## 5. Runtime path

### Checkout (landing-equivalent API)

| Field | Value |
|---|---|
| Product | PUB-VIE |
| Quantity | 1 |
| HTTP | **200** |
| `public_order_reference` | `trk_3850ad35bb2a4986a81bd9fe1fb75e3f` |
| Order id | `6e5197b5-c711-4ffd-be90-b6719456f808` |
| Amount | 25000 cents ($250 MXN) |
| Hold at create | ~1796 s |

Direct Payments API card charge with stored `APP_USR` token returned
`401 Unauthorized use of live credentials` (same class as IMPL-12 remaining cases).
Payment completed via Checkout Pro UI (human test buyer), then detected by search API.

### Payment

| Field | Value |
|---|---|
| `payment_id` | `170714344550` |
| status | `approved` / `accredited` |
| amount | 250 MXN |
| `external_reference` | matches order id |
| `live_mode` flag on payment object | `true` (recorded; collector/test path as prior IMPL-12) |

### Webhook / status / security

| Check | Result |
|---|---|
| First signed webhook | HTTP **200** · outcome **`PAID`** · `applied=true` · `replay=false` |
| Duplicate notification | HTTP **200** · outcome **`ALREADY_PAID`** |
| Invalid signature | HTTP **401** · `UNAUTHORIZED` |
| `get-order-status` poll | HTTP **200** · `APPROVED` · `terminal=true` |

### Domain rows (paid order)

| Entity | Count / state |
|---|---|
| order | `PAID` |
| payment | `APPROVED` · provider id matches |
| hold | `CONVERTED` |
| registrations | **1** (`PAYMENT_CONFIRMED`) |
| tickets | **1** |
| credentials | **1** |
| entitlements | **1** |

## 6. Final transactional / event state

### Sandbox (`4bg9ufz2-rug`)

```text
HEX-2026 = CONFIGURADO
paid_orders = 1
payments = 1
tickets = 1
entitlements = 1
```

Residual non-paid rows from earlier failed preference attempt(s) before back_url fix
remain on the sandbox branch (orders total 3 including cancelled). No Main impact.

### Main (MCP-confirmed)

```text
HEX-2026 = CONFIGURADO
orders = 0
payments = 0
```

## 7. Discrepancies

1. **MCP vs CLI project targeting** — MCP InsForge tools write/read Main; CLI was sandbox.
   Documented; Main briefly EN_VENTA then restored; E2E used CLI for sales window.
2. **Direct Payments API** blocked for stored token (`live credentials`); Checkout Pro path used.
3. **Payment `live_mode=true`** on retrieved payment object — recorded; not treated as
   productive cutover authorization.
4. **Localhost back_urls** incompatible with MP `auto_return` — temporary HTTPS example.com
   URLs used for preference creation; return validated by status polling.
5. Landing UI browser click path not re-run; API path matches landing `createCheckout`
   contract with required `Origin`.

## 8. Rollback

```text
Sandbox event → CONFIGURADO · sales_open_at NULL · PASS
Main remained / restored CONFIGURADO · PASS
No productive webhook panel changes
```

## 9. Gates

```text
SPECTATOR_SANDBOX_E2E_PASS
IMPL-13C = VALIDATED / CLOSED (human 2026-07-26)
READY_FOR_NEXT_AUTHORIZED_UNIT
PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING = still REQUIRED before production
```

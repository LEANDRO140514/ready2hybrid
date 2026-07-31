# R2H-LANDING-SBX-1B — Minimal preview checkout E2E

```text
Unit:
R2H-LANDING-SBX-1B

Title:
Minimal preview checkout E2E

Date:
2026-07-31

Governance timezone:
America/Merida

Status:
VALIDATED / CLOSED

Scope:
PREVIEW + SANDBOX FUNCTIONAL
```

## 1. Human approval

Project Owner / CEO Leandro Espinosa declared expressly:

```text
APRUEBO EL CIERRE DE R2H-LANDING-SBX-1B
COMO VALIDATED / CLOSED
EN ALCANCE FUNCIONAL PREVIEW + SANDBOX.
```

This approval authorizes documentary consolidation of the functional
validation already executed. It does not authorize commit, push, Main
writes, production, or privilege/hardening claims.

## 2. Repositories validated during the E2E

| Repository | Branch | HEAD | origin/main |
|---|---|---|---|
| Ready2Hybrid | `main` | `af5e6f483c0b8cbde8fc5de23e7bfd8d73118142` | same SHA (`0 0`) |
| Hybrid Experience Landing | `main` | `b4f50c0f046769065909d0621b3f2c659e6fffee` | same SHA (`0 0`); clean WT |

No tracked code changes were made in either repository during the E2E unit.

## 3. Functional environment

```text
Sandbox:
impl-13e-public-press

Project ID:
4227c38d-f6c9-4ee4-aa6f-d05fb4b19693

Functions target:
4bg9ufz2-6mq

Preview Origin:
https://3e9sriq7.insforge.site
```

Application CORS Origins observed (unchanged by this unit):

```text
CHECKOUT_CORS_ORIGIN = https://3e9sriq7.insforge.site
ORDER_STATUS_CORS_ORIGIN = https://3e9sriq7.insforge.site
```

No tokens, API keys, or secret values are recorded here.

## 4. Synthetic product (sandbox fixture)

```text
event_code = HEX-2026
product_code = PUB-VIE
quantity = 1
price_cents = 25000
currency = MXN
cupo = 500
```

Classification:

```text
SANDBOX_SYNTHETIC_CHECKOUT_FIXTURE
```

This is not an approval of commercial product, public name, productive
price, productive capacity, catalog promotion, or Main sales state.

## 5. Validated flow

```text
Landing preview
→ mp-create-checkout
→ Mercado Pago sandbox redirect
→ /checkout/confirmando
→ get-order-status
→ AWAITING_PAYMENT
→ terminal = false
```

Observed public status response:

```json
{
  "status": "AWAITING_PAYMENT",
  "terminal": false,
  "next_poll_after_seconds": 3
}
```

HTTP 200 with the authorized preview Origin.

## 6. Checkout result (redacted)

```text
public_order_reference =
trk_e069d3cf58d2496cb1b653cbbba0d7d7

order state =
PAYMENT_PENDING

payments =
0

tickets =
0

backend amount =
25000 MXN (qty 1 · PUB-VIE)
```

Checkout URL and sensitive parameters are intentionally omitted.

## 7. Payment authority

```text
El redirect no confirmó el pago.

La landing mostró:
“Esperando confirmación del pago”.

La autoridad canónica permaneció en:
webhook/API de Mercado Pago + estado en InsForge.
```

UI showed waiting confirmation only. No approved-payment or ticket UI was
shown for this synthetic attempt.

## 8. Temporary sales window

Initial event state:

```text
status = CONFIGURADO
sales_open_at = null
sales_close_at = null
```

Temporary controlled open (indispensable for current sales gate):

```text
status = EN_VENTA
sales_open_at = apertura temporal controlada
sales_close_at = null
```

Final restored state:

```text
status = CONFIGURADO
sales_open_at = null
sales_close_at = null
```

Product fields after the unit:

```text
PUB-VIE price_cents = 25000
currency = MXN
cupo = 500
```

No product, price, currency, or cupo mutation was performed.

## 9. Cleanup and residual artifact

```text
hold asociado a la orden =
RELEASED

orden sintética =
retenida en PAYMENT_PENDING

payments =
0

tickets =
0
```

The synthetic order must be treated as:

* sandbox evidence only;
* excluded from commercial metrics;
* not a sale;
* not a payment.

The sandbox is not claimed to be free of all historical artifacts.

## 10. Evidence separation

```text
Este E2E valida únicamente la integración funcional de la landing
contra impl-13e-public-press.

No valida los privilegios ni el hardening compensatorio de
impl-14a-expiry.
```

Standing states kept separate:

```text
Landing E2E funcional:
VALIDATED en impl-13e-public-press

Hardening compensatorio:
VALIDATED independientemente en impl-14a-expiry
```

## 11. Resources not affected

```text
InsForge Main = no interaction
production = no interaction
impl-14a-expiry = no writes
CORS = unchanged
secrets = unchanged
functions = unchanged
migrations = unchanged
repository code = unchanged
```

## 12. Limitations

* No payment was completed.
* Webhook was not exercised in this unit.
* No ticket was issued.
* Email was not tested.
* Expiry reconciliation was not validated here.
* Privilege hardening was not validated on `impl-13e-public-press`.
* Candidate sandbox remains at migration maximum **v10**.
* The synthetic pending order remains as controlled sandbox evidence.

## 13. Final evidence gate

```text
R2H-LANDING-SBX-1B =
VALIDATED / CLOSED
PREVIEW + SANDBOX FUNCTIONAL SCOPE
```

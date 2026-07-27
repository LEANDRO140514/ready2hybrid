# IMPL-13E-0 — Multiday Checkout Fail-Closed Hardening

```text
Unit: IMPL-13E-0 — Multiday Checkout Fail-Closed Hardening
Mode: VALIDATE AND CORRECT · BACKEND ONLY · SANDBOX BRANCH DEPLOY
Local datetime (America/Merida): 2026-07-26 / 2026-07-27
Ready2Hybrid baseline HEAD: b7abc46
Landing baseline HEAD: 9b9cf48 (untouched)
Sandbox branch: impl-13e-public-press
App key: 4bg9ufz2-6mq
Host: https://4bg9ufz2-6mq.us-east.insforge.app
Result: VALIDATED / CLOSED
Gate: READY_FOR_IMPL_13E_X_PUBLIC_PRESS_WIRING_APPROVAL
```

## 1. Root cause

`mp-create-checkout` could resolve catalog-valid `PUB-3D` / `FOT-3D` and, when the
event is `EN_VENTA`, create orders/holds/preferences before ticket issuance
failed closed with `MULTIDAY_ENTITLEMENT_BLOCKED` (OD-020). Commercial
fail-closed must occur at checkout start, before any domain write or Mercado Pago call.

## 2. Human decision applied

```text
PUB-3D = FAIL-CLOSED / PENDING OD-020
FOT-3D = FAIL-CLOSED / PENDING OD-020
(from IMPL-13D-H)
```

OD-020 remains OPEN. Multiday support is not implemented. Ticket-layer
`MULTIDAY_ENTITLEMENT_BLOCKED` is retained as defense-in-depth.

## 3. Guard order

```text
request → method → Origin guard → parse payload
→ journey / catalog product resolution
→ assertCheckoutProductAvailable (multiday fail-closed)
→ assertSalesOpen → sellable → quantity
→ idempotency → order/holds → Mercado Pago
```

Canonical attribute (preferred over `-3D` suffix):

```text
kind IN (spectator, press) AND day IS NULL
```

Matches seed/Main: single-day ASISTE rows have `day`; `PUB-3D` / `FOT-3D` have `day = null`.

## 4. Public taxonomy

Reused existing code `PRODUCT_NOT_AVAILABLE` (SPEC-031 / errors.ts).

Public message clarified to the unit contract:

```text
HTTP 409
PRODUCT_NOT_AVAILABLE
This product is not available for checkout.
```

Not used: `SALES_NOT_OPEN`, `SOLD_OUT`, `MULTIDAY_ENTITLEMENT_BLOCKED`, `PRODUCT_NOT_FOUND`.
Internal OD-020 reason is not exposed to buyers.

## 5. Files modified

| Path | Change |
|---|---|
| `insforge/functions/_shared/checkout/eligibility.ts` | New `isMultidayCheckoutBlocked` / `assertCheckoutProductAvailable` |
| `insforge/functions/_shared/checkout/orchestrate.ts` | Call eligibility after catalog, before sales/idempotency/MP |
| `insforge/functions/_shared/checkout/sales.ts` | `ProductSalesRow.day` |
| `insforge/functions/_shared/checkout/errors.ts` | Public message for `PRODUCT_NOT_AVAILABLE` |
| `insforge/functions/mp-create-checkout/index.ts` | Map `day` from catalog |
| `insforge/functions/mp-create-checkout/handler.deploy.js` | Regenerated bundle |
| `tests/unit/checkout/multiday-checkout-eligibility.test.ts` | New coverage |
| `tests/unit/checkout/checkout-start.test.ts` | Fixture `day` |
| `tests/unit/checkout/spectator-quantity.test.ts` | Fixture `day` |
| `docs/implementation/evidence/IMPL-13E-0-MULTIDAY-CHECKOUT-FAIL-CLOSED.md` | This evidence |
| `WORKSPACE_STATUS.md` / `IMPL-0` | Status registration |

Landing, migrations, seeds, prices, other functions: untouched.

## 6. Tests

```text
New file: multiday-checkout-eligibility.test.ts
Suite: 203 passed / 15 files (prior ~193; +10 new)
npm run lint / typecheck / test / build = PASS
```

Spies demonstrate for `PUB-3D` / `FOT-3D`:

```text
startCheckoutTx calls = 0
attachPreference = 0
createCheckoutProPreference = 0
```

## 7. Sandbox branch

```text
Created from Main: impl-13e-public-press
App key: 4bg9ufz2-6mq
Historical IMPL-13C sandbox retained: impl-13b-spectator-wiring / 4bg9ufz2-rug
```

Preflight TX on new branch: all zeros. Event `HEX-2026` = `CONFIGURADO`.

Public secrets configured (values not logged beyond allowlist):

```text
CHECKOUT_CORS_ORIGIN = http://localhost:3000
CHECKOUT_BACK_URL_SUCCESS/PENDING/FAILURE = http://localhost:3000/checkout/confirmando
```

`MERCADOPAGO_ACCESS_TOKEN` was present via branch inheritance (not printed). No productive credentials created.

## 8. Deploy

```text
functions deploy mp-create-checkout → branch impl-13e-public-press only
Not deployed: mp-webhook, get-order-status, team-roster, ticket-credentials
Main InsForge functions: not redeployed
```

## 9. Runtime matrix

Origin authorized: `http://localhost:3000`

| Case | HTTP | Code |
|---|---:|---|
| PUB-3D qty 1 | 409 | PRODUCT_NOT_AVAILABLE |
| FOT-3D qty 1 | 409 | PRODUCT_NOT_AVAILABLE |
| PUB-SAB qty 1 | 409 | SALES_NOT_OPEN |
| FOT-VIE qty 1 | 409 | SALES_NOT_OPEN |
| Origin `https://example.invalid` + PUB-3D | 403 | ORIGIN_NOT_ALLOWED |

## 10. Zero writes

After matrix on `4bg9ufz2-6mq`:

```text
orders=0 payments=0 registrations=0 tickets=0
credentials=0 entitlements=0 holds=0 idempotency_records=0
preferences/checkouts/payments = 0
```

Main: `CONFIGURADO`; transactional rows remain 0.

## 11. Protected resources

```text
landing · seeds · migrations · prices · OD-020 resolution
mp-webhook · get-order-status · team-roster · ticket-credentials
Main EN_VENTA · productive webhook/credentials
IMPL-13C evidence sandbox · abuse/rate-limit gate
```

## 12. Limitations

- Fail-closed is checkout-path only for ASISTE `day IS NULL`; ticket issuance multiday block remains.
- New sandbox may still need full checkout hold/idempotency/notification secrets before future EN_VENTA E2E (not required for this matrix).
- `PRODUCT_NOT_AVAILABLE` message change applies to all uses of that code (including hidden/inactive products).

## 13. Rollback

```text
Revert IMPL-13E-0 commit on Ready2Hybrid main
Redeploy prior mp-create-checkout bundle only to impl-13e-public-press
Do not modify Main InsForge
Do not delete sandbox branch to hide evidence
```

## 14. Gate

```text
IMPL-13E-0 = VALIDATED / CLOSED
READY_FOR_IMPL_13E_X_PUBLIC_PRESS_WIRING_APPROVAL
```

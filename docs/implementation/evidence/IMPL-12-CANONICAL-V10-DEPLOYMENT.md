# IMPL-12 — Canonical V10 Deployment (Main)

```text
Unit: IMPL-12 CANONICAL V10 DEPLOYMENT
Mode: MAIN APPLY + EDGE DEPLOY · NO PAYMENTS · NO SALES OPEN
Local datetime (America/Merida): 2026-07-26
Baseline HEAD: 37084fc (fix(checkout): support multiple spectator tickets)
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid / appkey 4bg9ufz2 / host 4bg9ufz2.us-east
Result: MAIN_V10_DEPLOYED
Technical gate (superseded by §7): READY_FOR_IMPL_12_HUMAN_CLOSURE
Final status after human closure (§7): VALIDATED / CLOSED
IMPL-13: NOT_STARTED / NOT AUTHORIZED
```

## 1. Authority

| Item | Value |
|---|---|
| Project Owner | Leandro Espinosa |
| Gate | `AUTHORIZED_FOR_IMPL_12_CANONICAL_V10_DEPLOYMENT` |
| Panel | `MP_PANEL_DISABLED_CONFIRMED` before Main writes |
| Scope | Apply `0010` + deploy validated `mp-create-checkout` on Main only |
| Forbidden | Checkouts, orders, payments, sales open, landing connect, secret regen |

### Panel confirmation (human)

```text
Test mode: topics = NONE · Pagos (legacy) unchecked · callback = DISABLED
  (prior URL may remain stored without subscribed events)
Production: URL = NOT CONFIGURED · topics = NONE · callback = DISABLED
Secret: masked · not regenerated
```

## 2. Artifacts deployed (unchanged from validated commit)

| Artifact | Role |
|---|---|
| `insforge/migrations/0010_spectator-multi-quantity.sql` | TX-1 spectator quantity ≥ 1 |
| `insforge/functions/mp-create-checkout/handler.deploy.js` | Bundled edge (SHA-256 `F2224CE9D312506B962731056797D2E66AC600B7990E64B4260F7724E594FCCF`) |
| Prior sandbox evidence | `docs/implementation/evidence/IMPL-12-CASE-C-SPECTATOR-QUANTITY-VALIDATION.md` |

No code, migration, test, or `docs/00–05` edits in this unit.

## 3. Main actions executed

| Step | Result |
|---|---|
| CLI linked project | `ready2hybrid` / `4bg9ufz2` |
| `db migrations up 0010_spectator-multi-quantity.sql` | Applied · remote version **10** / name `spectator-multi-quantity` |
| `functions deploy mp-create-checkout` | `success: true` · slug `mp-create-checkout` · status `active` |
| Event `HEX-2026` | Remains **CONFIGURADO** (not opened) |
| Checkouts / payments / sales | **0** (not performed) |

## 4. Post-deploy Main snapshot

| Item | Value |
|---|---|
| Event | `HEX-2026` = **CONFIGURADO** |
| Catalog | 1 event / 3 days / **28** products |
| Migrations | **v1–v10** (incl. `10=spectator-multi-quantity`) |
| Functions | **5** active: `mp-create-checkout`, `mp-webhook`, `get-order-status`, `team-roster`, `ticket-credentials` |
| Transactional rows | orders / order_items / registrations / capacity_holds / payments / tickets / webhook_events / access_entitlements / capability_credentials / idempotency_records = **0** |
| Sandbox branches | none required for this unit (prior Case C branch already deleted) |
| Mercado Pago production webhook | **NOT CONFIGURED** |
| Mercado Pago test webhook | topics NONE / callback DISABLED (human-confirmed) |

## 5. What this does / does not authorize

```text
DOES: Main runtime now matches OD-001 spectator quantity rules validated in Case C
DOES NOT: close IMPL-12 (human closure still required)
DOES NOT: open sales / EN_VENTA / connect landing
DOES NOT: configure production webhooks or regenerate secrets
DOES NOT: validate async methods (OD-PENDING D remains deferred)
DOES NOT: start IMPL-13
```

## 6. Technical gate (pre-closure)

```text
READY_FOR_IMPL_12_HUMAN_CLOSURE
```

Superseded by human closure below.

## 7. Human closure

```text
Human closure authority:
Leandro Espinosa — Project Owner

Human closure date:
2026-07-26

Technical evidence commit accepted:
9cca6b4

Human decision:
APPROVED FOR CLOSURE

Final implementation status:
VALIDATED / CLOSED

Human gate:
IMPL_12_HUMAN_CLOSED
```

Accepted initial-launch scope (immediate card / Checkout Pro):

```text
Case A competitor individual approved = PASS
Case B team of two = PASS
Case C two spectator accesses in one order = PASS
Case D rejected payment = PASS
Signed webhook / MP server-side verify / canonical payment /
order PAID / registration confirmed / tickets / credentials /
entitlements / idempotency / invalid signature no effects = PASS
```

Deferred (not validated for initial launch):

```text
Case E async PENDING / OXXO / Paycash / voucher
= DEFERRED_FROM_INITIAL_LAUNCH
```

Canonical Main accepted at closure:

```text
HEX-2026 = CONFIGURADO
products = 28
migrations = v1–v10
functions = 5
transactional rows = 0
```

Continuing restrictions:

```text
productive sales = NOT AUTHORIZED
productive credentials = NOT CONFIGURED
productive webhook = NOT CONFIGURED
landing connected to real sales = NO
IMPL-13 = NOT_STARTED
```

Closure notes:

- Human approval is based on published technical evidence through commit `9cca6b4`.
- No code, migrations, functions, Mercado Pago, or InsForge changes in this closure unit.
- Local/remote runtime tests were not repeated during this closure unit.
- Case E / async methods remain deferred and must not be offered as validated.

```text
Gate after human closure:
READY_FOR_IMPL_13_INTEGRATION_PREFLIGHT
IMPL-12 = VALIDATED / CLOSED
IMPL_12_HUMAN_CLOSED
Case E / async methods = DEFERRED_FROM_INITIAL_LAUNCH
productive sales / webhook / landing = NOT AUTHORIZED
IMPL-13 = NOT_STARTED / NOT AUTHORIZED
```

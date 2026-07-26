# IMPL-12-R4 — Case A TTL Revalidation after Main v9 Deploy

```text
Unit: IMPL-12-R4 — Deploy v9 on Main + Case A revalidation within active hold
Mode: VALIDATE ONLY · MAIN V9 DEPLOY · ISOLATED BRANCH · MP TEST · NO CODE CHANGE · NO B–E · NO IMPL-13
Local datetime (America/Merida): 2026-07-26
Baseline HEAD: ab9f4e2
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Sandbox branch: impl12-r4-casea-20260727 (appkey 4bg9ufz2-gzv) — DELETED
Result: CASE_A_CORRECTIVE_PASS
Gate: READY_FOR_IMPL_12_REMAINING_CASES_EXECUTION
IMPL-12: CASE_A_CORRECTIVE_PASS / NOT CLOSED
IMPL-13: NOT_STARTED / NOT AUTHORIZED
```

## 1. Baseline Git

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD / origin/main | `ab9f4e2` |
| Divergence | `0 / 0` |
| Working tree | clean |

## 2. Authority

| Item | Value |
|---|---|
| Human authorization | Leandro Espinosa — Project Owner |
| Gate initial | `AUTHORIZED_FOR_MAIN_V9_DEPLOYMENT_AND_CASE_A_REVALIDATION` |
| Panel confirm | `MP_PANEL_DISABLED_CONFIRMED` (test topics unmarked; production NOT CONFIGURED) |
| Specs | SPEC-000/001/011/030/031/032 APPROVED |
| Code changes | none (0009 already in repo from R3) |

## 3. v9 inspection

```text
V9_READY_FOR_MAIN_DEPLOYMENT
```

Blob `cff8a029…` unchanged from `ab9f4e2`. Payment upsert precedes verification insert with non-null `payment_id`; no table/column changes.

## 4. Main v9 deployment

### Snapshot before

| Item | Value |
|---|---|
| Migrations | v1–v8 |
| Event | CONFIGURADO |
| Products | 28 |
| Transactional | 0 |
| Functions | 5 |

### Apply

| Item | Value |
|---|---|
| Target | Main only |
| Adapter | `0009_fix-webhook-payment-verification-order.sql` |
| Result | version **9** applied (6 statements) |
| RPC comment | IMPL-12-R3 TX-2 payment-before-verification |

### Snapshot after

| Item | Value |
|---|---|
| Migrations | **v1–v9** |
| Event | CONFIGURADO |
| Products | 28 |
| Orders/payments/tickets | 0 |
| Functions | 5 |
| Main domain writes | 0 |

## 5. Branch R4

| Item | Value |
|---|---|
| Name | `impl12-r4-casea-20260727` |
| Appkey / host | `4bg9ufz2-gzv` |
| Migrations | v1–v9 |
| Isolation probe | PASS (branch-only secret absent on Main) |
| Main during work | CONFIGURADO / orders=0 / v9 |

### Pre-checkout order (mandatory)

1. Branch created  
2. Test Access Token configured  
3. Webhook secret loaded from `.cursor/impl12-r4.webhook.secret`  
4. `has_webhook_secret=true` confirmed **before** local delete  
5. Local secret file deleted (`Test-Path` = False)  
6. MP sandbox callback → `https://4bg9ufz2-gzv.us-east.insforge.app/functions/mp-webhook`  
7. Topic `payment` selected  
8. Event → `EN_VENTA`  
9. Checkout created  

## 6. Case A checkout

| Field | Value |
|---|---|
| Product | WOD-H · $300 MXN |
| Order / external_reference | `f441158f-3667-43c9-abb3-3bb7143c8349` |
| Tracking | `trk_f15a6377087949c180ea8f33cfc5cd23` |
| Checkout host | `www.mercadopago.com.mx` (`init_point`) |
| Hold expires (UTC) | `2026-07-26 16:30:38` |
| TTL at delivery | ~1792 s (~29 min) ≥ 10 min → deliver URL |

## 7. Human payment

| Field | Value |
|---|---|
| Result | APPROVED / accredited |
| Amount | $300 MXN |
| Operation | `170637083512` |
| Environment | TEST (`Mercadopago*fake`) |
| Attempts | 1 |
| API external_reference | matches order |
| Collector | `3560835739` |

## 8. Webhook apply (hold still active)

| Item | Value |
|---|---|
| Auto webhook at inspect | none (payments/webhooks still 0) |
| Hold seconds remaining at apply | **1538** (ACTIVE) |
| First signed POST | HTTP **200** · outcome **`PAID`** |
| Duplicate | HTTP **200** · outcome **`DUPLICATE`** |
| Invalid signature | HTTP **401** · `UNAUTHORIZED` |

## 9. Domain effects

| Check | Required | Observed | State |
|---|---|---|---|
| payments | 1 APPROVED | 1 · 30000 · VERIFIED | PASS |
| verification.payment_id | NOT NULL | present | PASS |
| order | PAID | PAID | PASS |
| registration | PAYMENT_CONFIRMED | PAYMENT_CONFIRMED | PASS |
| hold | converted | CONVERTED | PASS |
| tickets | 1 | 1 | PASS |
| credential ACTIVE | 1 | 1 (token_hash len 64) | PASS |
| entitlements | 1 | 1 | PASS |
| get-order-status | APPROVED | `reference=` → status APPROVED, terminal true | PASS |
| raw QR token persisted | no | no raw-token columns; hash only | PASS |
| Idempotency extras | 0 | counts unchanged after duplicate | PASS |
| Invalid sig writes | 0 | 401 | PASS |

## 10. Cleanup

| Step | Result |
|---|---|
| Branch event | CONFIGURADO |
| Branch delete | DELETED; branches = 0 |
| Local secret | absent |
| MP MCP `topics: []` | response still listed `payment` (panel may retain topic; human verify NONE) |
| Sandbox URL stored | may remain pointing at deleted R4 host (allowed without topics) |
| Production webhook | NOT CONFIGURED |

## 11. Final Main snapshot

| Item | Value |
|---|---|
| Appkey | `4bg9ufz2` |
| Event | CONFIGURADO |
| Products | 28 |
| Migrations | **v1–v9** |
| Functions | 5 |
| orders / payments / webhook_events / tickets | 0 |
| Canonical differences | 0 |

## 12. Paths modified (docs only)

```text
docs/implementation/evidence/IMPL-12-R4-CASE-A-TTL-REVALIDATION.md
docs/implementation/IMPL-0-SALES-IMPLEMENTATION-TRACEABILITY.md
WORKSPACE_STATUS.md
```

## 13. Gate

```text
IMPL-12 = CASE_A_CORRECTIVE_PASS / NOT CLOSED
Gate = READY_FOR_IMPL_12_REMAINING_CASES_EXECUTION
IMPL-13 = NOT_STARTED / NOT AUTHORIZED
```

# IMPL-12 — Case C Spectator Quantity Validation

```text
Unit: IMPL-12 Case C — spectator quantity ≥ 1 (OD-001 APPROVED)
Mode: IMPLEMENT + VALIDATE · ISOLATED BRANCH · MP TEST · NO IMPL-13
Local datetime (America/Merida): 2026-07-26
Baseline HEAD: 709a4df
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Sandbox branch: impl12-case-c-quantity-20260726 (appkey 4bg9ufz2-rdp) — DELETED
Result: CASE_C_PASS
Gate: READY_FOR_IMPL_12_HUMAN_CLOSURE
IMPL-12: TECHNICAL_PASS_FOR_INITIAL_CARD_LAUNCH / PENDING_METHODS_DEFERRED / PENDING HUMAN CLOSURE
IMPL-13: NOT_STARTED / NOT AUTHORIZED
```

## 1. Authority

| Item | Value |
|---|---|
| Project Owner | Leandro Espinosa |
| Gate | `AUTHORIZED_FOR_SPECTATOR_QUANTITY_IMPLEMENTATION` + `AUTHORIZED_FOR_CASE_C_SANDBOX_VALIDATION` |
| Panel | `MP_PANEL_DISABLED_CONFIRMED` before sandbox writes |
| OD-PENDING | **Option D** — async methods deferred from initial launch |
| OD-001 | **APPROVED** — spectator `quantity >= 1` |

### OD-PENDING (D)

```text
immediate card payments = INCLUDED (approved / rejected supported)
async methods that remain pending for hours/days = DEFERRED FROM INITIAL LAUNCH
reason = provider sandbox CONT did not preserve stable pending state
includes temporarily: OXXO, Paycash, vouchers, other non-immediate methods
PENDING behavior remains implemented; runtime provider validation deferred
no further CONT attempts
```

### OD-001 rules validated

```text
spectator quantity >= 1
competitor / team / press / workout quantity > 1 = REJECT
total = unit_price_snapshot × quantity (server-side)
N tickets / N ACTIVE credentials / N entitlements
no companion PII required
no shared QR
```

## 2. Implementation artifacts

| Artifact | Role |
|---|---|
| `insforge/functions/_shared/checkout/quantity.ts` | Product-kind quantity + capacity units |
| `insforge/functions/_shared/checkout/validate.ts` | Drop global qty=1 hard reject |
| `insforge/functions/_shared/checkout/orchestrate.ts` | Enforce OD-001; pass capacity_units = quantity |
| `insforge/functions/mp-create-checkout/handler.deploy.js` | Bundled deployable |
| `insforge/migrations/0010_spectator-multi-quantity.sql` | TX-1: N registrations + hold N units for spectator |
| `tests/unit/checkout/spectator-quantity.test.ts` | Unit + SQL contract tests |

Local regression before InsForge: lint / typecheck / test (**180**) / build = PASS.

Schema note: no new tables/columns; `order_items.quantity` already existed. Ticket issuance remains one ticket per registration → N regs for N units.

Main migrations remain **v1–v9** (0010 applied only on the deleted sandbox branch). Code is ready for a separate Main v10 deploy authorization.

## 3. Sandbox branch

| Item | Value |
|---|---|
| Name | `impl12-case-c-quantity-20260726` |
| Appkey | `4bg9ufz2-rdp` |
| Host | `https://4bg9ufz2-rdp.us-east.insforge.app` |
| Migrations on branch | v1–**v10** (`spectator-multi-quantity`) |
| Functions | 5 |
| Isolation probe | PASS (branch-only secret absent on Main) |
| Main transactional during run | 0 |

## 4. Case C runtime

### Checkout (before payment)

| Check | Observed |
|---|---|
| Product | PUB-VIE |
| HTTP | **200** |
| Quantity | **2** |
| Unit / total | 25000 / **50000** cents ($500 MXN) |
| Capacity held | **2** ACTIVE |
| Registrations | **2** |
| checkout_url | init_point present |
| Hold remaining at delivery | ~1796 s |

### Human payment

| Field | Value |
|---|---|
| Result | APPROVED / accredited |
| Amount | $500 MXN |
| Operation | `#170655081654` |
| Environment | TEST (`Mercadopago*fake`) |
| Attempts | 1 |

### Webhook (hold still active)

| Item | Value |
|---|---|
| Hold remaining at apply | **1409** s ACTIVE |
| First signed POST | HTTP **200** · outcome **`PAID`** |
| Domain | payment APPROVED · order PAID · hold CONVERTED · regs 2 confirmed |
| Tickets / ACTIVE credentials / entitlements | **2 / 2 / 2** |
| Duplicate notification | HTTP **200** · `ALREADY_PAID` · tickets/creds/ents unchanged (=2) |
| get-order-status | HTTP **200** · `APPROVED` · terminal |
| Invalid signature | HTTP **401** · `UNAUTHORIZED` |

## 5. Classification matrix (IMPL-12)

```text
Caso A = PASS
Caso B = PASS
Caso C = PASS
Caso D = PASS
Caso E = DEFERRED_FROM_INITIAL_LAUNCH
```

```text
IMPL-12 =
TECHNICAL_PASS_FOR_INITIAL_CARD_LAUNCH /
PENDING_METHODS_DEFERRED /
PENDING HUMAN CLOSURE
```

Not declared: OXXO / vouchers / other async methods validated.

## 6. Cleanup

| Action | Result |
|---|---|
| Branch event → CONFIGURADO | PASS |
| Branch delete | **DELETED** · branch list empty |
| MP `save_webhook` topics `[]` | MCP may still list `payment` + stored sandbox URL → **human verify panel: topics NONE, callback DISABLED** |
| Production webhook | **NOT CONFIGURED** |
| Secret regenerated | No |

## 7. Main after cleanup

| Item | Value |
|---|---|
| Event | CONFIGURADO |
| Products | 28 |
| Migrations | **v1–v9** |
| Functions | 5 |
| Transactional | orders/payments/tickets/webhooks = **0** |
| Canonical differences | **0** |

## 8. Spec note

Approved SPEC-030/031 still list OD-001 as historically OPEN in appendix tables. Runtime behavior now follows the Project Owner OD-001 approval. A controlled SPEC OD-status update is recommended separately (not performed silently in `docs/00–05`).

Pending/async launch deferral (OD-PENDING D) does not contradict a mandatory OXXO launch requirement in `docs/00–05` → no `SPEC_CHANGE_REQUIRED` for this unit.

## 9. Gate

```text
READY_FOR_IMPL_12_HUMAN_CLOSURE
```

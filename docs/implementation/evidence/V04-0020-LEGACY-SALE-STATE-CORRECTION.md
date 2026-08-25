# V0.4 0020 — legacy sale_state compatibility (blocked)

```text
Unit: GO-LIVE-IMPLEMENT-5
Mode: LOCAL CORRECTION ONLY — NO REMOTE APPLY
Date: 2026-08-24 America/Merida
Lane: LANE A
Prior: V04_0020_SANDBOX_ENGINE_APPLY_FAILED
Gate out: BLOCKED_BY_LEGACY_SALE_STATE_SEMANTICS
0020 was NOT edited. 0020 was NOT applied.
```

## A. Preflight

| Check | Result |
|---|---|
| Repo | `C:\vonde\enforma-sys\ready2hybrid` |
| Branch | `main` |
| HEAD | `c5068a4820cd912cca5f28060cb50b14319a6f0e` |
| Working tree | DIRTY — protected WIP preserved |
| Canonical 0020 SHA-256 | `bf425217d9e432c252a4d427428f2db81138f3d1ac55782a3c3a72ea1907d5ff` (unchanged) |

## B. Engine failure root cause

Sandbox apply of 0020 failed with:

```text
check constraint "ck_products_sale_state" of relation "products" is violated by some row
```

0020 added that CHECK before any `ON_SALE` normalization. Live sandbox rows at failure time:

| `products.sale_state` | n |
|---|---|
| `ON_SALE` | 27 |
| NULL | 14 |

Main catalog (read-only, prior unit + this unit): 28 products, all `sale_state` NULL.

## C. ON_SALE semantic proof

```text
ON_SALE_SEMANTICS_AMBIGUOUS
```

Searched (read-only):

- `insforge/migrations/0001`–`0016` and `0020`
- `insforge/seeds/`
- checkout/sales TypeScript (`sales.ts`, `staged-pricing.ts`, orchestrate, mp-create-checkout)
- tests (unit, integration local-db, tickets)
- approved SPEC-030/032 v0.4.0
- IMPL-14A evidence
- `git log -S ON_SALE --all` and `git log -G ON_SALE --all` — **no commits**
- workspace-wide literal search — **only** `docs/implementation/evidence/V04-0020-SANDBOX-ENGINE-VALIDATION.md` (observational, this program)

`ON_SALE` is **not** defined in migrations, seeds, specs, or application code.

Checkout `assertProductSellable` rejects only `CLOSED_PRODUCT_STATES` (`SOLD_OUT`, `SALES_CLOSED`, `CANCELLED`, `INACTIVE`, `HIDDEN`, `RETIRED_PRODUCT`, `SUPERSEDED_SCHEDULE_VARIANT`). Any other non-null string, including `ON_SALE` **or an invented token**, would currently pass that gate. That is unknown-value pass-through, not a documented synonym `ON_SALE = AVAILABLE`.

Per unit rule: do not infer from English; do not silently map unseen/unknown legacy values. **0020 was not edited.**

## D. Sale_state vocabulary inventory

| value | source | meaning | current v0.4 equivalent | migration handling |
|---|---|---|---|---|
| NULL | 0001 column; seed omits it; Main 28/28; sandbox 14 rows | Unspecified. Checkout treats as not-closed (sellable if sales open). | Leave unspecified; 23 HEX-2026 sellable rows are set `AVAILABLE` by 0020 DML | Allow in CHECK; do **not** bulk-convert to AVAILABLE |
| `AVAILABLE` | IMPLEMENT-1 `sales.ts` / staged-pricing / 0020 | Organizer commercially available (not SOLD_OUT) | canonical | Keep |
| `SOLD_OUT` | SPEC-032 v0.4; `isOrganizerSoldOutState`; 0020 CHECK | Explicit organizer sold-out | canonical | Keep |
| `SALES_CLOSED` | `CLOSED_PRODUCT_STATES` | Product not purchasable | canonical closed | Keep |
| `CANCELLED` | `CLOSED_PRODUCT_STATES`; orchestrate | Product not purchasable | canonical closed | Keep |
| `INACTIVE` | `CLOSED_PRODUCT_STATES`; checkout-start test | Product not purchasable | canonical closed | Keep |
| `HIDDEN` | `CLOSED_PRODUCT_STATES` (+ visibility HIDDEN) | Product not purchasable | canonical closed | Keep |
| `RETIRED_PRODUCT` | SPEC-030 v0.4; `CLOSED_PRODUCT_STATES`; 0020 historical DML | IND-PRO-* historical | canonical historical | Keep; 0020 sets two HEX-2026 rows |
| `SUPERSEDED_SCHEDULE_VARIANT` | SPEC-030 v0.4; `CLOSED_PRODUCT_STATES`; 0020 historical DML | DOB-VIE-HH/MH, DOB-SAB-MM | canonical historical | Keep; 0020 sets three HEX-2026 rows |
| `ON_SALE` | **Sandbox live rows only** (27). Absent from git history, 0001–0016, seeds, specs, app code | **Unproven** | **not mapped** | **No translation in this unit** |
| `PRODUCT_DISABLED` / `MULTIDAY_FAIL_CLOSED` / `SALES_NOT_OPEN` | `CommercialSaleState` in staged-pricing (resolution/error union, not `products.sale_state`) | Checkout/price error codes | not product persistence | Do not add to CHECK |
| `EN_VENTA` / `CONFIGURADO` / `OPEN` | `events.status`, not `products.sale_state` | Sales window | n/a | Unchanged |

No handling invented for unknown values other than `ON_SALE` observation.

## E. Sandbox failed-apply rollback result

Read-only `db query` on `impl-14a-expiry` (no apply, no DML). Then CLI relinked to Main via `link --project-id` (not `branch switch --parent`).

```text
SANDBOX_0020_FAILURE_FULL_ROLLBACK_CONFIRMED
```

| Probe | Observed |
|---|---|
| `ck_products_sale_state` | **absent** |
| `ck_events_sale_state` | **absent** |
| `events.sale_state` column | **absent** |
| `event_category_sale_states` | **absent** |
| `ck_products_session` | still `NULL|AM|PM` (0002), not ALL_DAY |
| `checkout_start_tx` | still cupo/hold commercial SOLD_OUT; no `event_category_sale_states` |
| `ticket_issue_one_registration` | still `MULTIDAY_ENTITLEMENT_BLOCKED`; no 2026-11-13 entitlements |
| HEX-2026 | **absent** (sandbox synthetic `SBX14A-*` / `SBX14B-*` unchanged) |
| product sale_state mix | still `ON_SALE` 27 / NULL 14 |
| sandbox migration list | highest **0016**; 0020 not recorded |

No remote cleanup was performed.

## F. 0020 correction summary

**None.** Canonical 0020 was not modified because `ON_SALE` cannot be proven equivalent to `AVAILABLE`.

A later authorized unit may map `ON_SALE → AVAILABLE` only after Project Owner or source-file proof of that synonym.

## G. Old hash

```text
bf425217d9e432c252a4d427428f2db81138f3d1ac55782a3c3a72ea1907d5ff
```

## H. New hash

Same as old (file not rewritten):

```text
bf425217d9e432c252a4d427428f2db81138f3d1ac55782a3c3a72ea1907d5ff
```

## I–N. Contract regression

Not applicable to a byte change. 0020 source on disk still contains the previously reviewed v0.4 contracts (23+5, ALL_DAY, checkout/ticket, no webhook rewrite). Ordering still installs CHECK **before** any `ON_SALE` UPDATE — that is the engine failure and was **not** rearranged because the map is unproven.

## O. V0.4 test result

```text
npx vitest run tests/unit/v04-relaunch
8 files / 55 passed / 0 failed
```

(Included in the combined 13-file / 112-pass run.)

## P. Payment / ticket test result

```text
webhook-payment-verification-order + mp-client-payment-methods + tests/unit/tickets
5 files / 57 passed / 0 failed
```

No tests modified.

## Q. 0017 confirmation

```text
0017 UNTOUCHED / NOT APPLIED
SHA-256 f259b5abba55b27dd4ccb16d815e99a3c2b57e6007979f6a3a89ae7859684eb2
```

## R. Main confirmation

```text
HIGHEST_APPLIED_MAIN = 0016
0020 NOT APPLIED TO MAIN
```

Final CLI context: Main `ready2hybrid` / `91fa34b1-e3b5-44c0-9806-b092c1dd7144`.

## S. Files modified

| Path | Action |
|---|---|
| `docs/implementation/evidence/V04-0020-LEGACY-SALE-STATE-CORRECTION.md` | Created (this file) |
| `insforge/migrations/0020_v04-commercial-authority-successor.sql` | **Unchanged** |

## T. Mutation confirmation

```text
NO MIGRATION APPLIED TO SANDBOX
NO MIGRATION APPLIED TO MAIN
NO REMOTE DATA WRITE
NO SALES STATUS CHANGE
NO SECRET CREATED/ROTATED
NO MERCADO PAGO CALL
NO PAYMENT EXECUTED
NO LANDING WRITE
NO LANE B WRITE
NO DEPLOY
NO COMMIT
NO PUSH
0017 UNTOUCHED
```

Read-only sandbox SELECT after `branch switch`; no `db migrations up`. Relink to Main was CLI context only.

## Final gate

```text
BLOCKED_BY_LEGACY_SALE_STATE_SEMANTICS
```

# V0.4 0020 — controlled Main apply

```text
Unit: GO-LIVE-IMPLEMENT-7
Mode: AUTHORIZED PRODUCTION MUTATION — MAIN APPLY OF 0020 ONLY
Date: 2026-08-24 America/Merida
Lane: LANE A
Authorization: Project Owner — "APRUEBO APLICAR 0020 A MAIN EN READY2HYBRID"
Prior gate: READY_FOR_V04_0020_MAIN_APPLY_APPROVAL
Gate out: READY_FOR_BACKEND_DEPLOY_AND_MP_CONFIG_PREP
This unit does NOT deploy functions, configure Mercado Pago, edit Landing,
execute checkout/payment, open sales, apply 0017/0018/0019, delete the temp
sandbox, commit, or push.
```

## A. Preflight

| Check | Result |
|---|---|
| Repo | `C:\vonde\enforma-sys\ready2hybrid` |
| Branch | `main` |
| HEAD | `c5068a4820cd912cca5f28060cb50b14319a6f0e` |
| Working tree | DIRTY — protected WIP preserved (no stash/reset/clean/restore/rebase/merge/add/commit/push) |

## B. Main identity

| Field | Value |
|---|---|
| Project name | `ready2hybrid` |
| Project id | `91fa34b1-e3b5-44c0-9806-b092c1dd7144` |
| Region | `us-east` |
| Environment | Main / Production (`current` has no `branched_from`) |
| App Key | not printed |

## C. Pre-apply migration state

Live `db migrations list --json` immediately before apply:

| Field | Value |
|---|---|
| HIGHEST_APPLIED_MAIN | **0016** |
| Applied count | 16 |
| 0011–0016 | APPLIED |
| 0017 / 0018 / 0019 / 0020 | NOT APPLIED |

## D. Pre-apply sale_state compatibility

| Check | Result |
|---|---|
| HEX-2026 | present; Hybrid Experience 2026; CONFIGURADO; 2026-10-09..11 |
| product count | 28 |
| `sale_state` NULL | 28 |
| non-NULL `sale_state` | 0 |
| ON_SALE | 0 |

Main did not contain the non-representative `ON_SALE` fixture that blocked `impl-14a-expiry`.

## E. Canonical / staged 0020 hash

Canonical: `insforge/migrations/0020_v04-commercial-authority-successor.sql`

| Copy | SHA-256 |
|---|---|
| Canonical | `bf425217d9e432c252a4d427428f2db81138f3d1ac55782a3c3a72ea1907d5ff` |
| Staging `migrations/0020_v04-commercial-authority-successor.sql` | `bf425217d9e432c252a4d427428f2db81138f3d1ac55782a3c3a72ea1907d5ff` |

Root discovery after staging contained exactly that one SQL file. 0017/0018/0019 were not staged.

0017 canonical hash (untouched): `f259b5abba55b27dd4ccb16d815e99a3c2b57e6007979f6a3a89ae7859684eb2`

## F. 0020 Main apply result

Command (CLI linked to Main):

```text
npx -y @insforge/cli db migrations up 0020_v04-commercial-authority-successor.sql --json
```

Not used: `up --all`, `up --to`.

Result: **success**. `"message": "Migration executed successfully"`. Recorded version `20` / `v04-commercial-authority-successor` at `2026-08-24T19:16:39.538Z`.

Root staging copy removed after apply. Canonical hash unchanged.

## G. Post-apply migration state

| Field | Value |
|---|---|
| HIGHEST_APPLIED_MAIN | **0020** |
| Applied count | 17 (0001–0016 + 0020) |
| 0020 | APPLIED |
| 0017 | NOT APPLIED |
| 0018 | NOT APPLIED |
| 0019 | NOT APPLIED |

## H. 0017 / 0018 / 0019 non-consumption

0017 WAS NOT CONSUMED. 0018 WAS NOT CONSUMED. 0019 WAS NOT CONSUMED.

No further migration command was run after 0020.

## I. Event validation

Persisted HEX-2026 on Main:

| Field | Value |
|---|---|
| name | HYBRID EXPERIENCE |
| venue_city | Club Cumbres, Mérida, Yucatán |
| timezone | America/Merida |
| starts_on | 2026-11-13 |
| ends_on | 2026-11-15 |
| status | CONFIGURADO |
| sales_open_at | NULL |
| sale_state | AVAILABLE |

October 9–11 `event_days` remain `NOT_CURRENT`.

## J. Program / ALL_DAY validation

| Date | session | state |
|---|---|---|
| 2026-11-13 | PM | CURRENT |
| 2026-11-14 | ALL_DAY | CURRENT |
| 2026-11-15 | AM | CURRENT |

Installed `ck_products_session` accepts `AM|PM|ALL_DAY|NULL`. PostgreSQL accepted `ALL_DAY`.

## K. 23 sellable identities

All `AVAILABLE`. Count = 23. Current `SOLD_OUT` count = 0.

COMPITE 8: `IND-H`, `IND-M`, `DOB-VIE-MM`, `DOB-SAB-HH`, `DOB-SAB-MH`, `REL-4H`, `REL-4M`, `REL-2H2M`

EXPERIENCE 7: `HALF-IND-M`, `HALF-IND-H`, `HALF-DOB-MM`, `HALF-DOB-HH`, `HALF-DOB-MH`, `WOD-M`, `WOD-H`

ASISTE 8: `PUB-VIE`, `PUB-SAB`, `PUB-DOM`, `PUB-3D`, `FOT-VIE`, `FOT-SAB`, `FOT-DOM`, `FOT-3D`

## L. Five historical identities

RETIRED_PRODUCT (2): `IND-PRO-H`, `IND-PRO-M`

SUPERSEDED_SCHEDULE_VARIANT (3): `DOB-VIE-HH`, `DOB-VIE-MH`, `DOB-SAB-MM`

Rows preserved. Not deleted. Not remapped. Not all described as retired.

## M. SOLD_OUT / RLS validation

| Object | Result |
|---|---|
| `products.sale_state` | present |
| `events.sale_state` | present; AVAILABLE |
| `event_category_sale_states` | exists; COMPITE/EXPERIENCE/ASISTE = AVAILABLE |
| RLS | ENABLE + FORCE |
| policies | 0 |
| anon/authenticated DML | none |
| current SKU SOLD_OUT | 0 |

Commercial SOLD_OUT is explicit organizer state only.

## N. checkout_start_tx validation

Installed `public.checkout_start_tx(jsonb)` is SECURITY DEFINER.

Live definition contains event `sale_state` enforcement, `event_category_sale_states` enforcement, SKU `sale_state` enforcement, and `INSERT INTO public.capacity_holds`. Comment on the installed function states cupo/holds are not commercial SOLD_OUT. Parent event SOLD_OUT is evaluated first. EXECUTE granted to `project_admin`; revoked from PUBLIC/anon/authenticated.

No checkout was invoked.

## O. Ticket / multiday validation

Installed `public.ticket_issue_one_registration(uuid)` is SECURITY DEFINER.

`PUB-3D` / `FOT-3D` emit entitlements on 2026-11-13, 2026-11-14, 2026-11-15 with session NULL. `MULTIDAY_ENTITLEMENT_BLOCKED` is absent. PAID / PAYMENT_CONFIRMED gates and hashed credentials remain. Inspection only; no production ticket issued.

## P. Price compatibility

Sellable launch/fixed `price_cents`: Individual 150000; Dobles 250000; Relay 320000; Half Individual 80000; Half Dobles 160000; Workout 35000; Public daily 25000; Public 3D 60000; Photographer daily 35000; Photographer 3D 80000.

No quantity/quota/HWM price-stage authority introduced.

## Q. Payment authority regression

0020 source does not replace `webhook_apply_payment_tx`. Function still exists on Main. No Mercado Pago call.

## R. Sales CLOSED validation

`events.status = CONFIGURADO`. `sales_open_at` NULL. No EN_VENTA / OPEN transition. Sales status was not altered by this unit beyond the 0020 catalog/status write that keeps CONFIGURADO / closed.

## S. V0.4 test result

`npx vitest run tests/unit/v04-relaunch` → **55 PASS / 0 FAIL**

## T. Payment/ticket test result

webhook-payment-verification-order + mp-client-payment-methods + `tests/unit/tickets` → **57 PASS / 0 FAIL**

Tests were not modified.

## U. Temp sandbox retention

`v04-0020-main-20260824` / `593ad559-5728-4de3-8aae-24c3d701e376` was **not** deleted and was not mutated further.

## V. Local WIP inventory

Protected dirty tree plus prior `.cursor` fixture/helpers remain uncommitted (including `_load_catalog_fixture.mjs`, `_fixture_products.sql`, and other Lane A/B WIP). This unit did not stash, reset, clean, or commit them.

## W. Files modified in this unit

- `docs/implementation/evidence/V04-0020-MAIN-CONTROLLED-APPLY.md` (created)
- temporary root `migrations/0020_v04-commercial-authority-successor.sql` (created then deleted)

Not modified: canonical 0020, 0017, 0018/0019 holding, specs, application TypeScript, tests, payments shared, SPEC-041, mp-client, handler.deploy.js, Landing.

## X. Final CLI context

Linked to Main `ready2hybrid` / `91fa34b1-e3b5-44c0-9806-b092c1dd7144` / `us-east`.

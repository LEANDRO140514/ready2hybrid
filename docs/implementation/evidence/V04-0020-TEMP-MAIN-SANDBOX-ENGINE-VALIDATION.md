# V0.4 0020 — temporary Main-based sandbox engine validation

```text
Unit: GO-LIVE-IMPLEMENT-6
Mode: AUTHORIZED REMOTE MUTATION — TEMP SANDBOX ONLY
Date: 2026-08-24 America/Merida
Lane: LANE A
Authorization: Project Owner — "APRUEBO CREAR UN SANDBOX TEMPORAL DESDE MAIN PARA VALIDAR 0020"
Gate in: BLOCKED_BY_LEGACY_SALE_STATE_SEMANTICS (impl-14a-expiry not representative)
Gate out: READY_FOR_V04_0020_MAIN_APPLY_APPROVAL
This unit does NOT apply 0020 to Main, edit 0020, create 0021, delete the temp sandbox,
deploy, open sales, configure Mercado Pago, commit, or push.
```

## A. Preflight

| Check | Result |
|---|---|
| Repo | `C:\vonde\enforma-sys\ready2hybrid` |
| Branch | `main` |
| HEAD | `c5068a4820cd912cca5f28060cb50b14319a6f0e` (`c5068a4`) |
| Working tree | DIRTY — protected WIP preserved (no stash/reset/clean/restore/rebase/merge/commit/push) |
| Canonical 0020 | `insforge/migrations/0020_v04-commercial-authority-successor.sql` |
| Canonical 0020 SHA-256 | `bf425217d9e432c252a4d427428f2db81138f3d1ac55782a3c3a72ea1907d5ff` |
| 0017 SHA-256 | `f259b5abba55b27dd4ccb16d815e99a3c2b57e6007979f6a3a89ae7859684eb2` (untouched) |
| Root `migrations/` before staging | no `.sql` files |

## B. Main baseline (read-only, before sandbox create)

| Field | Value |
|---|---|
| Project name | `ready2hybrid` |
| Project id | `91fa34b1-e3b5-44c0-9806-b092c1dd7144` |
| Region | `us-east` |
| HIGHEST_APPLIED_MAIN | **0016** |
| 0017 / 0018 / 0019 / 0020 | NOT APPLIED |
| HEX-2026 | Hybrid Experience 2026; venue_city `Mérida, Yucatán`; timezone `America/Merida`; `2026-10-09`..`2026-10-11`; status `CONFIGURADO`; `sales_open_at` NULL |
| products | **28**; all `sale_state` **NULL**; **0** `ON_SALE` |
| `events.sale_state` | absent |
| `event_category_sale_states` | absent |
| `ck_products_session` | `AM\|PM\|NULL` only |
| App Key | not printed |

## C. Sandbox creation semantics

Documented CLI: `npx -y @insforge/cli branch create <name> [--mode full\|schema-only] [--no-switch]`.

| Mode | Semantics |
|---|---|
| `full` (default) | schema **and** data clone, including `auth.users` / storage |
| `schema-only` | schema clone; user-data tables start empty |

This unit used **`--mode schema-only`** so personal/payment/credential rows were not copied.

`TEMP_SANDBOX_CREATION_PRIVACY_BLOCK` was not triggered.

## D. Temp sandbox creation result

| Field | Value |
|---|---|
| Command | `npx -y @insforge/cli branch create v04-0020-main-20260824 --mode schema-only --no-switch` |
| Name | `v04-0020-main-20260824` |
| Id | `593ad559-5728-4de3-8aae-24c3d701e376` |
| Parent | `ready2hybrid` / `91fa34b1-e3b5-44c0-9806-b092c1dd7144` |
| Mode | `schema-only` |
| State | `ready` / serving |
| Created | `2026-08-24T17:50:32.584Z` |
| Name collision | none — new sandbox, not a reuse of `impl-14a-expiry` |

## E. Temp sandbox identity

Switched with `npx -y @insforge/cli branch switch v04-0020-main-20260824`.

Post-switch `current`: `project_name=v04-0020-main-20260824`, `project_id=593ad559-5728-4de3-8aae-24c3d701e376`, `branched_from.project_id=91fa34b1-e3b5-44c0-9806-b092c1dd7144`.

**Not Main. Not Production. Not `impl-14a-expiry`.**

## F. Temp sandbox migration baseline (pre-0020)

| Field | Value |
|---|---|
| HIGHEST_APPLIED_TEMP_SANDBOX | **0016** |
| 0011–0016 | APPLIED |
| 0017 / 0018 / 0019 / 0020 | NOT APPLIED |

Native create did not forge migration history.

## G. Public-catalog representativeness

Native create copied **schema only**. Catalog tables were empty (0 events, 0 products).

**MINIMAL_PUBLIC_CATALOG_FIXTURE** was used.

Authorized fixture only:

- `events`
- `event_days`
- `products`

Reconstructed from `insforge/seeds/0002_seeds_hybrid_event.sql`, which matches Main’s observed 28 codes, days, sessions, prices, and NULL `sale_state`. Unicode names/venue were loaded via `convert_from(decode(hex),'UTF8')` because `db query` rejected non-ASCII SQL text (`FORBIDDEN` parser). Temporary `GRANT INSERT` was restored to the 0016 DCL surface before apply.

Not copied: buyer_contacts, participants, participant_sensitive_profiles, registrations, teams, team_members, orders, order_items, capacity_holds, payments, payment_verification_records, webhook_events, tickets, ticket/capability credentials, waiver acceptances, or any other personal/payment/credential table.

Pre-apply proof:

| Check | Result |
|---|---|
| product count | 28 |
| code set | exact Main 28-code set |
| `sale_state` | 28 NULL, 0 ON_SALE |
| HEX-2026 | October 9–11 2026, CONFIGURADO, America/Merida, Mérida Yucatán |
| sessions | Friday PM dobles; Saturday AM half/dobles/wod + PM relay; Sunday AM individual; PUB/FOT daily session NULL; PUB-3D/FOT-3D day+session NULL |

## H. 0020 hash / staging

Root discovery isolated: `migrations/` had no SQL, then exactly:

`migrations/0020_v04-commercial-authority-successor.sql`

Source and staging SHA-256 both:

`bf425217d9e432c252a4d427428f2db81138f3d1ac55782a3c3a72ea1907d5ff`

0017/0018/0019 were not copied to root discovery.

## I. 0020 engine apply result

CLI proven on temp sandbox (not Main).

Command:

```text
npx -y @insforge/cli db migrations up 0020_v04-commercial-authority-successor.sql --json
```

Result: **success**. `"message": "Migration executed successfully"`. Version recorded: `20` / `v04-commercial-authority-successor`.

No `up --all`. No `up --to`. Canonical 0020 was not edited.

## J. Post-apply migration state (temp sandbox)

| Field | Value |
|---|---|
| HIGHEST_APPLIED_TEMP_SANDBOX | **0020** |
| 0020 | APPLIED |
| 0017 | NOT APPLIED / NOT CONSUMED |
| 0018 | NOT APPLIED / NOT CONSUMED |
| 0019 | NOT APPLIED / NOT CONSUMED |
| applied count | 17 (0001–0016 + 0020) |

Root staging copy was deleted after apply. Canonical hash unchanged.

## K. Event validation

Persisted HEX-2026 after 0020:

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

October 9–11 rows remain as `event_days.state = NOT_CURRENT`. They are not current program authority. Sales remain closed.

## L. Program / ALL_DAY validation

Current program days:

| Date | session | state |
|---|---|---|
| 2026-11-13 | PM | CURRENT |
| 2026-11-14 | ALL_DAY | CURRENT |
| 2026-11-15 | AM | CURRENT |

PostgreSQL accepted `ALL_DAY` under installed `ck_products_session` and on `event_days.session`.

## M. 23 sellable identities

All `sale_state = AVAILABLE`. Count = 23.

COMPITE 8: `IND-H`, `IND-M`, `DOB-VIE-MM`, `DOB-SAB-HH`, `DOB-SAB-MH`, `REL-4H`, `REL-4M`, `REL-2H2M`

EXPERIENCE 7: `HALF-IND-M`, `HALF-IND-H`, `HALF-DOB-MM`, `HALF-DOB-HH`, `HALF-DOB-MH`, `WOD-M`, `WOD-H`

ASISTE 8: `PUB-VIE`, `PUB-SAB`, `PUB-DOM`, `PUB-3D`, `FOT-VIE`, `FOT-SAB`, `FOT-DOM`, `FOT-3D`

No current identity is `SOLD_OUT`.

## N. Five historical identities

No DELETE. No silent remap.

RETIRED_PRODUCT (exactly 2): `IND-PRO-H`, `IND-PRO-M`

SUPERSEDED_SCHEDULE_VARIANT (exactly 3): `DOB-VIE-HH`, `DOB-VIE-MH`, `DOB-SAB-MM`

The five are not all described as retired.

Historical rows kept pre-0020 day/session/price on conflict (`IND-PRO-*` Sunday AM 140000; superseded dobles October + 240000).

## O. Session assignments (current sellable)

Friday PM: `DOB-VIE-MM`, `IND-M`, `IND-H`

Saturday ALL_DAY: `DOB-SAB-HH`, `DOB-SAB-MH`, `HALF-IND-M`, `HALF-IND-H`, `HALF-DOB-MM`, `HALF-DOB-HH`, `HALF-DOB-MH`, `WOD-M`, `WOD-H`

Sunday AM: `REL-4H`, `REL-4M`, `REL-2H2M`

Daily PUB/FOT: session NULL

`PUB-3D` / `FOT-3D`: day NULL, session NULL

## P. SOLD_OUT schema / RLS

| Object | Result |
|---|---|
| `products.sale_state` | present; CHECK includes AVAILABLE/SOLD_OUT/SALES_CLOSED/CANCELLED/INACTIVE/HIDDEN/RETIRED_PRODUCT/SUPERSEDED_SCHEDULE_VARIANT |
| `events.sale_state` | present; CHECK AVAILABLE/SOLD_OUT/NULL |
| `event_category_sale_states` | exists |
| RLS | ENABLE + FORCE |
| policies | 0 (no broad anon/authenticated DML) |
| `role_table_grants` anon/authenticated | none |
| category defaults | COMPITE/EXPERIENCE/ASISTE = AVAILABLE |
| accidental SOLD_OUT | none on event, categories, or current SKUs |

## Q. checkout_start_tx installed definition

Installed `public.checkout_start_tx(jsonb)` is SECURITY DEFINER.

Commercial `SOLD_OUT` returns only from organizer `sale_state`:

1. event `sale_state = SOLD_OUT`
2. category/offer `event_category_sale_states.sale_state = SOLD_OUT`
3. product `sale_state = SOLD_OUT`

Parent event SOLD_OUT wins first. cupo and ACTIVE hold counts are documented as transactional integrity, not commercial SOLD_OUT. `INSERT INTO public.capacity_holds` is preserved. Sales status/date gates, spectator quantity, and idempotency are preserved. EXECUTE remains granted to `project_admin`; revoked from PUBLIC/anon/authenticated.

No live checkout was executed.

## R. ticket / multiday installed definition

Installed `public.ticket_issue_one_registration(uuid)` is SECURITY DEFINER.

`PUB-3D` / `FOT-3D`: one registration, one ticket, three `access_entitlements` on 2026-11-13, 2026-11-14, 2026-11-15, session NULL.

`MULTIDAY_ENTITLEMENT_BLOCKED` is **absent** from the installed body.

Single-day path preserved. PAID + PAYMENT_CONFIRMED gates preserved. Credential hashing/idempotency preserved.

No payment rows were fabricated. Function inspection only.

## S. Price compatibility

Launch/fixed `price_cents` on the 23 sellable identities:

| Family | price_cents |
|---|---|
| Individual | 150000 |
| Dobles | 250000 |
| Relay | 320000 |
| Half Individual | 80000 |
| Half Dobles | 160000 |
| Workout | 35000 |
| Public daily | 25000 |
| Public 3D | 60000 |
| Photographer daily | 35000 |
| Photographer 3D | 80000 |

0020 introduced no quantity/quota/HWM price-stage authority.

## T. Payment authority regression

0020 source contains no `CREATE OR REPLACE` of `webhook_apply_payment_tx`. Installed function still exists. Mercado Pago signature / server GET / merchant / external-reference / amount / currency / webhook idempotency were not rewritten. Redirect remains non-authoritative for PAID.

No Mercado Pago call in this unit.

## U. Tests

`npx vitest run tests/unit/v04-relaunch`

**55 passed / 0 failed** (8 files).

Focused existing (not modified):

`npx vitest run tests/unit/webhook/webhook-payment-verification-order.test.ts tests/unit/checkout/mp-client-payment-methods.test.ts tests/unit/tickets`

**57 passed / 0 failed** (5 files).

An additional historical file `tests/unit/checkout/multiday-checkout-eligibility.test.ts` still expects PUB-3D/FOT-3D to be blocked at the TypeScript checkout orchestrator (3 failing assertions). That file was **not** modified and is **not** part of the required v0.4 relaunch suite. Engine/SQL validation of 3D entitlements is via the installed ticket function.

## V. Main non-mutation proof

Relink command (not `branch switch --parent`):

```text
npx -y @insforge/cli link --project-id 91fa34b1-e3b5-44c0-9806-b092c1dd7144 --json -y
```

Post-relink `current`: `project_name=ready2hybrid`, `project_id=91fa34b1-e3b5-44c0-9806-b092c1dd7144`, no `branched_from`.

| Check | Result |
|---|---|
| HIGHEST_APPLIED_MAIN | **0016** |
| 0020 on Main | **NOT APPLIED** |
| 0017 / 0018 / 0019 | NOT APPLIED |
| products | 28, all `sale_state` NULL, 0 ON_SALE |
| HEX-2026 | still October 9–11 2026, CONFIGURADO, Mérida Yucatán |
| `events.sale_state` | still absent |
| `event_category_sale_states` | still absent |
| `ck_products_session` | still AM\|PM only |

No migration apply while linked to Main.

## W. 0017 / 0018 / 0019 protection

Canonical 0017 untouched. 0018/0019 remain in holding. None were staged, moved, edited, deleted, or applied.

## X. Final CLI context

Linked to **Main** `ready2hybrid` / `91fa34b1-e3b5-44c0-9806-b092c1dd7144` / `us-east`.

## Y. Temp sandbox retention

| Field | Value |
|---|---|
| Name | `v04-0020-main-20260824` |
| Id | `593ad559-5728-4de3-8aae-24c3d701e376` |
| Deleted in this unit | **NO** |

Left intact for later cleanup under separate authority.

## Z. Files modified

Created/updated in this unit:

- `docs/implementation/evidence/V04-0020-TEMP-MAIN-SANDBOX-ENGINE-VALIDATION.md`
- `.cursor/_load_catalog_fixture.mjs` (local fixture helper; not application code)
- `.cursor/_fixture_products.sql` (local fixture helper)

Not modified: canonical 0020, 0017, 0018/0019 holding, approved specs, application TypeScript, tests, payments shared, SPEC-041, mp-client, handler.deploy.js, Landing.

CLI link rewrote local InsForge project link to Main (no App Key recorded here).

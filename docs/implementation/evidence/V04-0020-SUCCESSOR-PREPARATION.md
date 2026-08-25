# V0.4 successor 0020 — authoring and local validation

```text
Unit: GO-LIVE-IMPLEMENT-3
Mode: LOCAL IMPLEMENTATION / NO MAIN APPLY / SALES CLOSED
Date: 2026-08-24 America/Merida
Lane: LANE A
Gate in: READY_FOR_V04_SUCCESSOR_PREPARATION
Gate out: READY_FOR_V04_0020_APPLY_APPROVAL
This unit does NOT apply 0020, move 0017, deploy, open sales, configure MP secrets, commit, or push.
```

## A. Preflight

| Check | Result |
|---|---|
| Repo | `C:\vonde\enforma-sys\ready2hybrid` |
| Branch | `main` |
| HEAD | `c5068a4820cd912cca5f28060cb50b14319a6f0e` (`c5068a4`) |
| Working tree | DIRTY — protected WIP preserved (no stash/reset/clean/restore/commit/push) |
| Canonical specs | SPEC-030 / SPEC-031 / SPEC-032 v0.4.0 APPROVED / EFFECTIVE; SPEC-040 v0.1.1 preserve. Not edited. |
| CLI discovery directory | repo-root `migrations/` (empty at start and end of this unit) |
| Canonical SQL directory | `insforge/migrations/` |
| 0017 | untracked at `insforge/migrations/0017_operational-identity-assignments.sql`; SHA-256 unchanged |

## B. Main baseline confirmed

InsForge CLI `current` (identity only; no app key) and read-only `db migrations list --json`:

| Field | Value |
|---|---|
| Project name | `ready2hybrid` |
| Project id | `91fa34b1-e3b5-44c0-9806-b092c1dd7144` |
| Region | `us-east` |
| Context | Main / Production parent |

```text
HIGHEST_APPLIED_MAIN = 0016
applied versions = 1..16
0017 = NOT APPLIED
0018 = NOT APPLIED
0019 = NOT APPLIED
0020 = NOT APPLIED
```

Highest remote row: version `16` `compensating-privilege-hardening-checkout-compatibility` at `2026-08-24T08:02:16.169Z`. No remote version 17–20.

## C. Canonical 0020 file

| Field | Value |
|---|---|
| Filename | `0020_v04-commercial-authority-successor.sql` |
| Source location | `insforge/migrations/0020_v04-commercial-authority-successor.sql` |
| SHA-256 | `bf425217d9e432c252a4d427428f2db81138f3d1ac55782a3c3a72ea1907d5ff` |
| Staged at repo-root `migrations/` | **No** (must not live there until an authorized apply) |

Slug follows 0011–0016: `<nnnn>_<lowercase-hyphen-name>.sql`.

## D. Migration content summary

Forward-only successor. No edits to 0001–0016. No TCL (`BEGIN`/`COMMIT`). No `DELETE`/`TRUNCATE` of commercial identities.

1. **Schema:** `products.session` CHECK allows `AM|PM|ALL_DAY|NULL`. `events.sale_state` (`AVAILABLE|SOLD_OUT|NULL`). `products.sale_state` CHECK includes v0.4 closed vocabulary. New `event_category_sale_states` (`event_code`,`block` ∈ COMPITE/EXPERIENCE/ASISTE).
2. **Temporary DCL:** GRANT INSERT on `events`/`products` and mutate on `event_days` so `project_admin` can upsert after 0016; restored to the 0016 surface at the end of the file.
3. **Event/program:** HEX-2026 → HYBRID EXPERIENCE, Club Cumbres, Mérida, Yucatán, America/Merida, 2026-11-13..15, `status=CONFIGURADO`, `sales_open_at=NULL`, `sale_state=AVAILABLE` (not SOLD_OUT; sales remain closed via CONFIGURADO).
4. **Catalog:** UPSERT 23 current sellable identities (launch/fixed `price_cents` compatibility only; `cupo` preserved on conflict). Preserve 5 historical identities (`RETIRED_PRODUCT` / `SUPERSEDED_SCHEDULE_VARIANT`); on conflict, do not rewrite their existing day/session/price/cupo.
5. **`checkout_start_tx`:** CREATE OR REPLACE from 0011. Removes cupo/hold commercial `SOLD_OUT`. Enforces event → category → product organizer `SOLD_OUT` (parent wins), then historical/hidden → `PRODUCT_NOT_AVAILABLE`. Holds still inserted. Spectator quantity, idempotency, sales-open/close gates unchanged.
6. **`ticket_issue_one_registration`:** CREATE OR REPLACE from 0008. PUB-3D/FOT-3D emit three `access_entitlements` (2026-11-13/14/15, `session=NULL`). One ticket, one registration. Unknown null-day spectator/press remains fail-closed. `webhook_apply_payment_tx` not replaced.

## E. Event / program alignment

| Field | 0020 |
|---|---|
| Public name | HYBRID EXPERIENCE |
| Venue | Club Cumbres, Mérida, Yucatán (`events.venue_city`) |
| Timezone | America/Merida |
| Dates | 2026-11-13 Friday PM; 2026-11-14 Saturday ALL_DAY; 2026-11-15 Sunday AM |
| Sales | `CONFIGURADO`, `sales_open_at` NULL → CLOSED / PRÓXIMAMENTE |
| October leftover `event_days` | `state=NOT_CURRENT`; not deleted |

No heats, start times, lanes, or ceremonies invented.

## F. 23 sellable identity alignment

COMPITE 8: IND-H, IND-M, DOB-VIE-MM, DOB-SAB-HH, DOB-SAB-MH, REL-4H, REL-4M, REL-2H2M  
EXPERIENCE 7: HALF-IND-M, HALF-IND-H, HALF-DOB-MM, HALF-DOB-HH, HALF-DOB-MH, WOD-M, WOD-H  
ASISTE 8: PUB-VIE, PUB-SAB, PUB-DOM, PUB-3D, FOT-VIE, FOT-SAB, FOT-DOM, FOT-3D  

All `sale_state=AVAILABLE`, journeys J1–J5 match the IMPLEMENT-1 TypeScript fixture.

## G. 5 historical identity preservation

**2 RETIRED_PRODUCT:** IND-PRO-H, IND-PRO-M  
**3 SUPERSEDED_SCHEDULE_VARIANT:** DOB-VIE-HH → current DOB-SAB-HH; DOB-VIE-MH → current DOB-SAB-MH; DOB-SAB-MM → current DOB-VIE-MM  

Preserved (INSERT … ON CONFLICT updates only name/journey/sale_state/visibility). Non-purchasable via existing `CLOSED_PRODUCT_STATES` / SQL `PRODUCT_NOT_AVAILABLE`. No silent remap (codes unchanged). No DELETE. Not described as a single “retired categories” bucket.

## H. Price authority alignment

`products.price_cents` remains NOT NULL compatibility (launch/fixed baseline: IND 150000, DOB 250000, REL 320000, HALF-IND 80000, HALF-DOB 160000, WOD 35000, PUB daily 25000 / 3D 60000, FOT daily 35000 / 3D 80000). COMMENT states it is not a second pricing authority. Calendar Launch/Presale/Regular remains TypeScript `resolveCommercialOffer`. No quantity/cupo/quota/HWM/hold advancement in SQL.

## I. SOLD_OUT authority alignment

Persistence matches IMPLEMENT-1: `products.sale_state`, `events.sale_state`, `event_category_sale_states`. Cupo COMMENT: not commercial SOLD_OUT. Default category/event sale_state AVAILABLE (organizer can set SOLD_OUT later). Parent wins encoded in checkout SQL order: event, then category/block, then SKU.

## J. checkout_start_tx alignment

Cupo/hold `SOLD_OUT` predicate from 0011 removed. Hold INSERT retained. Sales CONFIGURADO / `sales_open_at` / close gates retained. Spectator quantity retained. Idempotency retained. EXECUTE remains `project_admin` only.

## K. ALL_DAY / session alignment

CHECK allows ALL_DAY. Saturday sellable SKUs persist `ALL_DAY`. Friday PM: DOB-VIE-MM, IND-M, IND-H. Sunday AM: REL-*. Daily PUB/FOT `session=NULL`. PUB-3D/FOT-3D `day=NULL` and `session=NULL`.

## L. PUB/FOT multiday entitlement alignment

Option B: one registration, one ticket, three entitlements on 2026-11-13/14/15 with `session=NULL`. Using one date does not delete the others (separate rows; no cross-day revoke).

## M. Ticket issuance alignment

`ticket_issue_one_registration` only. PAID + PAYMENT_CONFIRMED gates, hashing, opaque folio, idempotency, single-day path preserved. `MULTIDAY_ENTITLEMENT_BLOCKED` removed from this function. `webhook_apply_payment_tx` untouched. 0008 on-disk tests still describe historical 0008 text (not weakened).

## N. Security / RLS alignment

`event_category_sale_states`: ENABLE + FORCE RLS, zero policies (deny-by-default, same as 0003 catalog). REVOKE ALL FROM PUBLIC; REVOKE DML from anon/authenticated. After seed: `project_admin` SELECT+UPDATE; INSERT/DELETE/TRUNCATE revoked (0016 catalog pattern). No GRANT EXECUTE/DML to anon/authenticated. Checkout/ticket EXECUTE remains project_admin.

## O. SQL validation result

| Check | Result |
|---|---|
| Syntax / static contract script | `STATIC_OK` (no TCL, no product DELETE/TRUNCATE, no October literals, no cupo SOLD_OUT, 23+5 identities, ALL_DAY, CONFIGURADO, 3D dates, webhook fn not replaced) |
| Referenced objects after 0016 | Present in 0001–0016 (`events`,`products`,`event_days`, checkout/ticket helpers, holds, tickets, entitlements). New table created in 0020. |
| Disposable local PostgreSQL | Docker CLI present; engine/daemon not running. `embedded-postgres` not in `node_modules`. No `psql` on PATH. Per unit rules, no new engine was installed. |
| Remote apply | **Not executed** |

## P. V0.4 test result

```text
npx vitest run tests/unit/v04-relaunch
8 files / 55 passed / 0 failed
```

No TypeScript production changes. No assertion weakening.

## Q. Payment / ticket regression result

```text
npx vitest run tests/unit/webhook/webhook-payment-verification-order.test.ts
                 tests/unit/checkout/mp-client-payment-methods.test.ts
2 files / 11 passed / 0 failed

npx vitest run tests/unit/tickets
3 files / 46 passed / 0 failed
```

0008 static tests remain the historical 0008 contract (including `MULTIDAY_ENTITLEMENT_BLOCKED` in that file). 0020 supersedes the live function only.

## R. Targeted apply-path result

```text
TARGETED_0020_STAGING_SAFE
```

Proof (read-only; 0020 was not applied):

1. InsForge docs (`insforge-cli` `references/database/migrations.md`): local files live under repo-root `migrations/`. `up <filename>` applies **exactly one** file. That file **must be the next pending local migration after the latest remote version**. `up --all` / `up --to` must not be used for this successor.
2. Controlled Main apply of 0011–0016 proved operationally: CLI does **not** discover `insforge/migrations/`. Byte-identical copies of **only** 0011–0016 were staged at root `migrations/`, applied one-by-one, then deleted. **0017 was never copied into CLI discovery and was not consumed.**
3. Therefore, with `HIGHEST_APPLIED_MAIN=0016`, placing **only** the byte-identical `0020_v04-commercial-authority-successor.sql` into root `migrations/` makes the pending local set `{0020}`. The next pending file is 0020 even though versions 17–19 do not exist locally. 0017 remaining under `insforge/migrations/` is invisible to the CLI.
4. 0018/0019 remain in holding, not in either discovery path.

Authorized later command (not run now), from repo root, after staging the byte-identical copy:

```text
npx -y @insforge/cli db migrations up 0020_v04-commercial-authority-successor.sql --json
```

Then delete the root staging copy. Do **not** copy 0017/0018/0019 into `migrations/`. If those files were present at root, 0020 would no longer be next-pending and this path would become blocked.

No 0017 quarantine is required for this path.

## S. 0017 confirmation

```text
0017 UNTOUCHED / NOT APPLIED
```

Path: `insforge/migrations/0017_operational-identity-assignments.sql`  
SHA-256 (unchanged this unit): `f259b5abba55b27dd4ccb16d815e99a3c2b57e6007979f6a3a89ae7859684eb2`  
Not moved, renamed, edited, deleted, or applied.

## T. Files modified

| Path | Action |
|---|---|
| `insforge/migrations/0020_v04-commercial-authority-successor.sql` | Created (canonical source) |
| `docs/implementation/evidence/V04-0020-SUCCESSOR-PREPARATION.md` | Created (this file) |

No application code, 0017, 0018/0019 holding copies, payments shared modules, SPEC-041, `mp-client.ts`, `handler.deploy.js`, landing, or approved specs modified.

## U. Mutation confirmation

```text
NO MIGRATION APPLIED TO MAIN
NO MIGRATION APPLIED TO REMOTE SANDBOX
NO MAIN DATA WRITE
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

Read-only Main access this unit: `db migrations list --json`, `current --json`. No `db migrations up`, no `db query` writes, no secrets create/rotate.

## Final gate

```text
READY_FOR_V04_0020_APPLY_APPROVAL
```

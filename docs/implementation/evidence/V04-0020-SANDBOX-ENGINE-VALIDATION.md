# V0.4 successor 0020 — sandbox engine validation

```text
Unit: GO-LIVE-IMPLEMENT-4
Mode: AUTHORIZED REMOTE MUTATION — SANDBOX ONLY
Date: 2026-08-24 America/Merida
Lane: LANE A
Authorization: Project Owner — "APRUEBO APLICAR 0020 AL SANDBOX PARA VALIDACIÓN PREVIA A MAIN"
Gate in: READY_FOR_V04_0020_APPLY_APPROVAL
Gate out: V04_0020_SANDBOX_ENGINE_APPLY_FAILED
This unit does NOT apply 0020 to Main, edit 0020, deploy, open sales, configure MP secrets, commit, or push.
```

## A. Preflight

| Check | Result |
|---|---|
| Repo | `C:\vonde\enforma-sys\ready2hybrid` |
| Branch | `main` |
| HEAD | `c5068a4820cd912cca5f28060cb50b14319a6f0e` (`c5068a4`) |
| Working tree | DIRTY — protected WIP preserved (no stash/reset/clean/restore/rebase/merge/commit/push) |

## B. Main pre-safety baseline (read-only, before switch)

CLI `current` then `db migrations list --json` while still linked to Main. No `db migrations up` while on Main.

| Field | Value |
|---|---|
| Project name | `ready2hybrid` |
| Project id | `91fa34b1-e3b5-44c0-9806-b092c1dd7144` |
| Region | `us-east` |
| HIGHEST_APPLIED_MAIN | **0016** (`compensating-privilege-hardening-checkout-compatibility`, `2026-08-24T08:02:16.169Z`) |
| 0020 on Main | NOT APPLIED |
| 0017 / 0018 / 0019 on Main | NOT APPLIED |

## C. Sandbox identity confirmation

`npx -y @insforge/cli branch list --json` then `branch switch impl-14a-expiry --json`.

| Field | Value |
|---|---|
| Name | `impl-14a-expiry` |
| Project / branch id | `2921e092-aed6-4abb-93be-946c42eee82a` |
| Parent project id | `91fa34b1-e3b5-44c0-9806-b092c1dd7144` (`ready2hybrid`) |
| Region | `us-east` |
| Branch state | `ready` |
| Mode | `schema-only` |
| Is Main | **No** |

Post-switch `current`: `project_name=impl-14a-expiry`, `project_id=2921e092-aed6-4abb-93be-946c42eee82a`, `is_main=false`.

## D. Sandbox pre-apply state

Live `db migrations list --json` on `impl-14a-expiry`:

```text
HIGHEST_APPLIED_SANDBOX = 0016
applied versions = 1..16

0011 APPLIED  logical-capacity-expiry-exclusion          2026-07-28T05:53:45.762Z
0012 APPLIED  payment-pending-expiry-transaction         2026-07-29T03:16:42.026Z
0013 APPLIED  payment-pending-expiry-array-fix           2026-07-29T06:26:59.071Z
0014 APPLIED  payment-pending-expiry-run-lease           2026-07-29T19:44:14.312Z
0015 APPLIED  compensating-privilege-hardening           2026-07-30T18:14:33.918Z
0016 APPLIED  compensating-privilege-hardening-checkout-compatibility  2026-07-31T01:49:03.063Z

0017 NOT APPLIED
0018 NOT APPLIED
0019 NOT APPLIED
0020 NOT APPLIED
```

Migration-number baseline matched the required pre-apply state. Catalog content on this sandbox is IMPL-14A synthetic events (no `HEX-2026` row); that did not change the version-baseline gate.

## E. 0020 hash / staging verification

Canonical `insforge/migrations/0020_v04-commercial-authority-successor.sql`

| Copy | SHA-256 |
|---|---|
| Canonical | `bf425217d9e432c252a4d427428f2db81138f3d1ac55782a3c3a72ea1907d5ff` |
| Staging `migrations/0020_v04-commercial-authority-successor.sql` | `bf425217d9e432c252a4d427428f2db81138f3d1ac55782a3c3a72ea1907d5ff` |

Match required digest. Root discovery contained **exactly one** SQL file (0020). 0017/0018/0019 were not staged. 0017 SHA-256 unchanged: `f259b5abba55b27dd4ccb16d815e99a3c2b57e6007979f6a3a89ae7859684eb2`.

Final apply guard: CLI = `impl-14a-expiry` (not Main); sandbox highest = 0016; root SQL = 0020 only.

## F. 0020 sandbox apply result

Command (cwd = repo root, CLI linked to sandbox):

```text
npx -y @insforge/cli db migrations up 0020_v04-commercial-authority-successor.sql --json
```

Not `--all`. Not `--to`.

CLI result (sanitized; no secrets):

```json
{"error":"check constraint \"ck_products_sale_state\" of relation \"products\" is violated by some row","code":"INTERNAL_ERROR"}
```

Exit code 1. **0020 was not recorded as applied.** InsForge wraps each migration in a transaction; post-failure listing still shows highest **0016**.

Immediate read-only diagnosis on the sandbox (no retry, 0020 not edited):

```text
public.products.sale_state:
  ON_SALE  27 rows
  NULL     14 rows
```

0020 adds `ck_products_sale_state` allowing only:

`NULL | AVAILABLE | SOLD_OUT | SALES_CLOSED | CANCELLED | INACTIVE | HIDDEN | RETIRED_PRODUCT | SUPERSEDED_SCHEDULE_VARIANT`

`ON_SALE` is leftover IMPL-14A fixture vocabulary and is **not** in that list, so PostgreSQL rejected `ADD CONSTRAINT`.

This sandbox has no `HEX-2026` event. Events present are synthetic (`SBX14A-*`, `SBX14B-*`). Even a successful apply here would not have proven the 23-identity HEX-2026 catalog; the engine never reached that DML because the CHECK failed first.

No second apply was attempted. Canonical 0020 bytes were not modified.

## G. Sandbox post-apply migration state

```text
HIGHEST_APPLIED_SANDBOX = 0016
0020 NOT APPLIED
0017 NOT APPLIED
0018 NOT APPLIED
0019 NOT APPLIED
0017 WAS NOT CONSUMED
0018 WAS NOT CONSUMED
0019 WAS NOT CONSUMED
```

Temporary root copy deleted after the apply command. Canonical source remains. Root `migrations/` has **no** `.sql` files.

## H–O. Engine validation (not reached)

Event / ALL_DAY / 23 sellable / 5 historical / SOLD_OUT schema / installed `checkout_start_tx` / installed `ticket_issue_one_registration` / price compatibility were **not** engine-validated because 0020 did not install.

Payment-authority objects were not replaced (0020 never executed). Local TypeScript/SQL source of 0020 still does not contain `webhook_apply_payment_tx`.

## P. Payment authority regression (source, not installed)

Canonical 0020 does not `CREATE OR REPLACE` `webhook_apply_payment_tx`. Apply failure left the sandbox webhook function at its pre-0020 definition. No Mercado Pago call. No payment.

## Q. V0.4 test result

```text
npx vitest run tests/unit/v04-relaunch
8 files / 55 passed / 0 failed
```

## R. Payment / ticket regression result

```text
webhook-payment-verification-order + mp-client-payment-methods + tests/unit/tickets
5 files / 57 passed / 0 failed
  = 11 payment-method/webhook tests + 46 ticket tests
```

No test files modified.

## S. Main non-mutation verification

Returned to Main with `npx -y @insforge/cli link --project-id 91fa34b1-e3b5-44c0-9806-b092c1dd7144 --json -y` (not `branch switch --parent`).

Post-relink `current`: `ready2hybrid` / `91fa34b1-e3b5-44c0-9806-b092c1dd7144`.

Live Main `db migrations list --json`:

```text
HIGHEST_APPLIED_MAIN = 0016
0020 NOT APPLIED TO MAIN
```

Highest row timestamp still `2026-08-24T08:02:16.169Z` (unchanged from pre-safety baseline).

Read-only Main catalog probe after relink (SELECT only): all **28** `public.products` rows have `sale_state IS NULL`. That value **is** allowed by 0020’s CHECK. The apply failure is therefore explained by **sandbox fixture `ON_SALE` rows**, not by current Main catalog values. This does **not** authorize a Main apply in this unit.

## T. 0017 / 0018 / 0019 confirmation

```text
0017 NOT APPLIED   (sandbox and Main)
0018 NOT APPLIED
0019 NOT APPLIED
0017 UNTOUCHED
```

0017 path and SHA-256 unchanged. 0018/0019 were not staged and not applied.

## U. Final CLI context

Linked to **Main** `ready2hybrid` / `91fa34b1-e3b5-44c0-9806-b092c1dd7144` (`us-east`).

## V. Files modified

| Path | Action |
|---|---|
| `migrations/0020_v04-commercial-authority-successor.sql` | Temporary staging copy created then **deleted** |
| `docs/implementation/evidence/V04-0020-SANDBOX-ENGINE-VALIDATION.md` | Created (this file) |
| `.insforge/project.json` | CLI link sandbox → Main (local CLI state; not an application change) |

Canonical 0020 **not** modified. No application/test/spec changes.

## W. Mutation confirmation

```text
0020 NOT APPLIED TO SANDBOX (APPLY REJECTED BY POSTGRES)
0020 NOT APPLIED TO MAIN
0017 NOT APPLIED
0018 NOT APPLIED
0019 NOT APPLIED
CANONICAL 0020 HASH UNCHANGED
TEMPORARY ROOT STAGING COPY REMOVED
NO APPLICATION CODE MODIFIED
NO TEST CODE MODIFIED
NO SPEC MODIFIED
NO SECRET VALUE DISPLAYED
NO SECRET CREATED/ROTATED
NO MERCADO PAGO CALL
NO PAYMENT EXECUTED
NO SALES STATUS CHANGE
NO LANDING WRITE
NO LANE B WRITE
NO DEPLOY
NO COMMIT
NO PUSH
```

## Final gate

```text
V04_0020_SANDBOX_ENGINE_APPLY_FAILED
```

Engine reject: `ck_products_sale_state` vs existing `products.sale_state = 'ON_SALE'` on `impl-14a-expiry`. 0020 was not edited or retried in this unit.

# IMPL-5A — Catalog Seed Alignment and Local Validation Evidence

```text
Unit: IMPL-5A — Catalog seed alignment and local validation
Mode: LOCAL EPHEMERAL POSTGRESQL · NO INSFORGE WRITE · NO REMOTE SEED
Date: 2026-07-24
Baseline HEAD: ad0a788
OD-022: APPROVED (2026-07-24)
Approved Saturday label:
Sábado 10 — ½ Hybrid, Dobles y Workout por la mañana; Relay por la tarde.
Result: PASS
Gate: READY_FOR_IMPL_5_SEED_CORRECTION_REVIEW
```

## 1. Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `ad0a788` |
| origin/main | `ad0a788` |
| Divergence | `0 / 0` |
| Canonical backend | `ready2hybrid` / `4bg9ufz2.us-east` |
| Remote schema | 0001–0003 DEPLOYED AND VALIDATED |
| Remote catalog before/after this unit | empty (`events`/`event_days`/`products` recordCount = 0) |

## 2. Human authorization OD-022

| Field | Value |
|---|---|
| Decision | OD-022 / SEED-003 Saturday public label |
| Status | APPROVED |
| Approved at | 2026-07-24 |
| Approved label | `Sábado 10 — ½ Hybrid, Dobles y Workout por la mañana; Relay por la tarde.` |

## 3. Seed blob previous / new

| Artifact | Value |
|---|---|
| Previous Git blob | `f8989b2c10bb04fe258b19bf646dd650940c4944` |
| New Git blob | `530bdde721f636c703cbc13929adda94036b12ee` |
| New SHA-256 | `5f115f8cf112638dce4eba72e3d61825853c373e86d5a85cf8d9bbfd62a688ad` |

Protected migration blobs unchanged:

| File | Blob |
|---|---|
| 0001 | `99b1964b65b9590ec2f3a909e200d09457559ec5` |
| 0002 | `24622ab0787c4952799cde2bd93784627b39ef53` |
| 0003 | `d2c3778364cae4cada03c8a7e3d5b6b6f6365dbd` |

## 4. Four authorized text changes

| # | Target | From | To |
|---|---|---|---|
| 1 | Saturday `event_days.label` | `Sábado — ½ Hybrid, Dobles y Workout por la mañana; Relay por la tarde.` | `Sábado 10 — ½ Hybrid, Dobles y Workout por la mañana; Relay por la tarde.` |
| 2 | `REL-2H2M.name` | `Relay Mixto (2H+2M)` | `Relay Mixto 2H+2M` |
| 3 | `IND-H.name` | `Individual Hombre (Open)` | `Individual Hombre Open` |
| 4 | `IND-M.name` | `Individual Mujer (Open)` | `Individual Mujer Open` |

## 5. Diff-scope validation

| Check | Result |
|---|---|
| Saturday label changes | 1 |
| REL-2H2M name changes | 1 |
| IND-H name changes | 1 |
| IND-M name changes | 1 |
| Other SQL value changes | 0 |
| `git diff --stat` | `8 ++++----` (4 lines replaced) |
| INSERT statement count | unchanged |
| Product row count in seed | unchanged (28) |

## 6. PostgreSQL environment

| Item | Value |
|---|---|
| Engine | Docker Desktop 29.2.0 |
| Image | `postgres:16-alpine` |
| Digest | `postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777` |
| Server version | 16.14 |
| Container | ephemeral `r2h-impl5a-validation` (removed after run) |
| InsForge connection | none |
| Seed identity | local superuser / BYPASSRLS equivalent (harness only) |

Apply order on each clean database:

```text
0001 → 0002 → 0003 → seed (transaction-wrapped)
```

## 7. Results VALIDATION_DB_A / VALIDATION_DB_B

Both databases returned identical PASS reports:

| Control | Expected | A | B | Result |
|---|---|---|---|---|
| events | 1 | 1 | 1 | PASS |
| event_exact HEX-2026 | 1 | 1 | 1 | PASS |
| event_days | 3 | 3 | 3 | PASS |
| day labels exact | 3/3 | 3/3 | 3/3 | PASS |
| products | 28 | 28 | 28 | PASS |
| distinct codes | 28 | 28 | 28 | PASS |
| duplicate codes | 0 | 0 | 0 | PASS |
| COMPITE | 13 | 13 | 13 | PASS |
| EXPERIENCE | 7 | 7 | 7 | PASS |
| ASISTE | 8 | 8 | 8 | PASS |
| J1 / J2 / J3 / J4 / J5 | 6 / 9 / 3 / 2 / 8 | 6/9/3/2/8 | 6/9/3/2/8 | PASS |
| REL-2H2M name | Relay Mixto 2H+2M | match | match | PASS |
| IND-H name | Individual Hombre Open | match | match | PASS |
| IND-M name | Individual Mujer Open | match | match | PASS |
| Economic mismatches vs SPEC-030 | 0 | 0 | 0 | PASS |

## 8. Event / day / product details

### Event

```text
code = HEX-2026
name = Hybrid Experience 2026
venue_city = Mérida, Yucatán
timezone = America/Merida
starts_on = 2026-10-09
ends_on = 2026-10-11
status = CONFIGURADO
```

### Days

```text
Viernes 9 — Dobles (PM)
Sábado 10 — ½ Hybrid, Dobles y Workout por la mañana; Relay por la tarde.
Domingo 11 — Individual (AM)
```

### Row-by-row economic comparison

All 28 products matched SPEC-030 for:

```text
name, block, kind, team_size, price_cents, cupo, day, session, has_chip, has_insurance
```

Journey distribution derived from SPEC-030 product→journey mapping.

## 9. Replay / second execution

| Step | Result |
|---|---|
| First seed in transaction | PASS |
| Second seed in separate transaction | REJECTED (`uq_events_code`, exit code 3) |
| Counts after failed second attempt | events=1, event_days=3, products=28 |
| Partial duplicates | none |

Seed was not converted to UPSERT and remains non-idempotent by design.

## 10. Security after seed

| Control | Expected | Actual | Result |
|---|---|---|---|
| Domain tables | 24 | 24 | PASS |
| RLS enabled | 24 | 24 | PASS |
| FORCE RLS | 24 | 24 | PASS |
| PUBLIC grants | 0 | 0 | PASS |
| Policies | 0 | 0 | PASS |
| Runtime/edge functions (MCP) | 0 | 0 | PASS |

## 11. Unaffected tables

Only `events`, `event_days`, and `products` contain rows.

Sum of rows across the other 21 domain tables = `0`.

## 12. Protected boundaries

| Boundary | State |
|---|---|
| InsForge writes in this unit | 0 |
| Remote seed executed | NO |
| Landing | intact |
| Mercado Pago | intact |
| Canonical migrations 0001–0003 | unchanged |
| MCP remote catalog | still empty |

## 13. Repository regression

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test -- --run` | PASS |
| `npm run build` | PASS |

## 14. Gate

```text
OD-022: APPROVED
Approved at: 2026-07-24
Approved label:
Sábado 10 — ½ Hybrid, Dobles y Workout por la mañana; Relay por la tarde.

Catalog seed: ALIGNED AND LOCALLY VALIDATED
Remote seed execution: NO
IMPL-5 remote execution: NOT AUTHORIZED
Gate: READY_FOR_IMPL_5_SEED_CORRECTION_REVIEW
```

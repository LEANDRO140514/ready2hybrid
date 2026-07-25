# IMPL-5 — Catalog Seed Remote Execution Validation Evidence

```text
Unit: IMPL-5 — Apply approved catalog seed (remote)
Mode: OFFICIAL INSFORGE CLI MIGRATION ENDPOINT · ONE WRITE · NO IMPL-6
Date: 2026-07-24
Baseline HEAD: e1c1522
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Deployment slug: enforma
Result: PASS
Human closure: VALIDATED
Gate at execution: CATALOG_SEEDED
Gate after human closure: READY_FOR_IMPL_6_AUTHORIZATION
```

## 1. Human authorization

Project Owner authorized exactly one remote write:

```text
0004_hybrid-event-catalog
```

Explicitly not authorized: IMPL-6, checkout, Mercado Pago, webhooks, functions,
tickets, QR, dashboard, landing, new policies, RLS changes, manual repairs,
remote delete/correct, documentation Git (until this closure unit), commit/push
(until this closure unit).

## 2. Baseline Git (pre-execution)

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `e1c1522` |
| origin/main | `e1c1522` |
| Divergence | `0 / 0` |
| Working tree | clean |

## 3. Authorized seed identity

| Artifact | Value |
|---|---|
| Canonical file | `insforge/seeds/0002_seeds_hybrid_event.sql` |
| Git blob | `530bdde721f636c703cbc13929adda94036b12ee` |
| SHA-256 | `5f115f8cf112638dce4eba72e3d61825853c373e86d5a85cf8d9bbfd62a688ad` |
| Outer `BEGIN` / `COMMIT` | `0` / `0` |
| Event inserts | `1` |
| Event-day rows | `3` |
| Product rows | `28` |

Protected migration blobs unchanged:

| File | Blob |
|---|---|
| 0001 | `99b1964b65b9590ec2f3a909e200d09457559ec5` |
| 0002 | `24622ab0787c4952799cde2bd93784627b39ef53` |
| 0003 | `d2c3778364cae4cada03c8a7e3d5b6b6f6365dbd` |

## 4. Backend preflight (read-only)

| Signal | Value |
|---|---|
| Account (masked) | `en…@gmail.com` (authorized account match) |
| Project | `ready2hybrid` |
| Host | `4bg9ufz2.us-east` |
| Deployment slug | `enforma` |
| Remote migrations before write | `3` (v1–v3) |
| Domain tables | `24` |
| Catalog before write | `events`/`event_days`/`products` = `0` |
| HEX-2026 | absent |
| Functions | `0` |
| Realtime channels | `0` |
| Bucket `landings-images` | unchanged |
| RLS enabled | `24` |
| FORCE RLS | `24` |
| PUBLIC direct grants | `0` |
| Policies | `0` |

## 5. Temporary migration adapter

| Item | Value |
|---|---|
| Private workspace | `%LOCALAPPDATA%\Ready2Hybrid\InsForgeDeploy` |
| Adapter path | `migrations/0004_hybrid-event-catalog.sql` |
| Source | byte-identical copy of authorized seed |
| Adapter SHA-256 | `5f115f8cf112638dce4eba72e3d61825853c373e86d5a85cf8d9bbfd62a688ad` |
| `ADAPTER_EQUIVALENCE` | PASS |
| `TRANSFORMATIONS` | `0` |
| Canonical repo files modified for apply | no |

No headers, comments, guards, UPSERT, ON CONFLICT, DELETE, TRUNCATE, or UPDATE
were added to the adapter.

## 6. Remote apply result

| Field | Value |
|---|---|
| Command | `npx -y @insforge/cli@0.2.1 db migrations up 0004_hybrid-event-catalog.sql --json` |
| Version | `4` |
| Name | `hybrid-event-catalog` |
| Statements | `5` |
| createdAt | `2026-07-25T02:20:16.220Z` |
| Result | success |
| Total remote writes in unit | `1` |

Post-apply migration history:

```text
v1 minimal-sales-schema
v2 sales-constraints-and-indexes
v3 rls-and-access-limits
v4 hybrid-event-catalog
```

Replay / second `up` was not executed remotely (local replay already covered under
IMPL-5A).

## 7. Remote catalog validation

### Event

| Control | Expected | Actual | Result |
|---|---|---|---|
| events rows | 1 | 1 | PASS |
| code | HEX-2026 | HEX-2026 | PASS |
| name | Hybrid Experience 2026 | Hybrid Experience 2026 | PASS |
| venue_city | Mérida, Yucatán | Mérida, Yucatán | PASS |
| timezone | America/Merida | America/Merida | PASS |
| starts_on | 2026-10-09 | 2026-10-09 | PASS |
| ends_on | 2026-10-11 | 2026-10-11 | PASS |
| status | CONFIGURADO | CONFIGURADO | PASS |

Sales were not opened.

### Event days

| Control | Expected | Actual | Result |
|---|---|---|---|
| event_days rows | 3 | 3 | PASS |
| event_code | HEX-2026 | HEX-2026 (all 3) | PASS |
| 2026-10-09 label | Viernes 9 — Dobles (PM) | match | PASS |
| 2026-10-10 label | Sábado 10 — ½ Hybrid, Dobles y Workout por la mañana; Relay por la tarde. | match | PASS |
| 2026-10-11 label | Domingo 11 — Individual (AM) | match | PASS |

### Products

| Control | Expected | Actual | Result |
|---|---|---|---|
| products rows | 28 | 28 | PASS |
| distinct codes | 28 | 28 | PASS |
| duplicate codes | 0 | 0 | PASS |
| COMPITE | 13 | 13 | PASS |
| EXPERIENCE | 7 | 7 | PASS |
| ASISTE | 8 | 8 | PASS |
| J1 / J2 / J3 / J4 / J5 (SPEC-030 matrix) | 6 / 9 / 3 / 2 / 8 | 6 / 9 / 3 / 2 / 8 | PASS |
| missing vs seed blob | 0 | 0 | PASS |
| unexpected vs seed blob | 0 | 0 | PASS |
| field mismatches (28 × required fields) | 0 | 0 | PASS |

Spot name checks:

| code | name |
|---|---|
| REL-2H2M | Relay Mixto 2H+2M |
| IND-H | Individual Hombre Open |
| IND-M | Individual Mujer Open |

### Economic spot checks (MXN integer cents)

| Product family | Expected cents | Result |
|---|---|---|
| Dobles (pair) | 240000 | PASS |
| Relay (team) | 320000 | PASS |
| Individual | 140000 | PASS |
| ½ Hybrid individual | 80000 | PASS |
| ½ Hybrid dobles | 160000 | PASS |
| Workout | 30000 | PASS |
| Público diario | 25000 | PASS |
| Público 3 días | 60000 | PASS |
| Fotógrafo diario | 35000 | PASS |
| Fotógrafo 3 días | 80000 | PASS |

Currency authority remains MXN. Chip and insurance are flags, not extra charges.
No checkout/orders were created to probe prices.

## 8. Security and non-catalog surfaces after seed

| Control | Expected | Actual | Result |
|---|---|---|---|
| Domain tables | 24 | 24 | PASS |
| RLS enabled | 24 | 24 | PASS |
| FORCE RLS | 24 | 24 | PASS |
| PUBLIC direct grants | 0 | 0 | PASS |
| Policies | 0 | 0 | PASS |
| Runtime functions | 0 | 0 | PASS |
| Realtime channels | 0 | 0 | PASS |
| Bucket `landings-images` | unchanged | unchanged | PASS |
| Landing | unchanged | unchanged | PASS |
| Mercado Pago | unchanged | unchanged | PASS |

Other domain tables remained empty (21 tables at row count 0), including:

```text
buyer_contacts, participants, registrations, teams, orders, order_items,
capacity_holds, payments, webhook_events, tickets, ticket_credential_generations,
access_entitlements, activity_log, outbox_delivery_jobs
```

No policies created. No privileges granted. RLS not disabled.

## 9. Staging cleanup

After successful validation evidence capture:

```text
%LOCALAPPDATA%\Ready2Hybrid\InsForgeDeploy\migrations\0004_hybrid-event-catalog.sql
%LOCALAPPDATA%\Ready2Hybrid\InsForgeDeploy\migrations\
```

deleted. Preserved: `.insforge/`, `AGENTS.md`, global CLI credentials.

## 10. Git after remote execution (pre-documentary closure)

| Item | Value |
|---|---|
| HEAD | `e1c1522` |
| origin/main | `e1c1522` |
| Divergence | `0 / 0` |
| Working tree | clean |
| Repo docs/commit during apply unit | none (forbidden by apply authorization) |

## 11. Closure status

```text
IMPL-5 = VALIDATED
IMPL-6 = NOT AUTHORIZED
CATALOG_SEEDED (execution gate)
READY_FOR_IMPL_6_AUTHORIZATION (human-closure gate)
```

Next permitted action after this documentary closure: human authorization for
IMPL-6 (read-only catalog validation unit) if and when the Project Owner
approves it. No InsForge writes are implied by that next unit's entry state.

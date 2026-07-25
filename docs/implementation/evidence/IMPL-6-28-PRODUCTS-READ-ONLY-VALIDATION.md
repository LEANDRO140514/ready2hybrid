# IMPL-6 — 28 Products Read-Only Validation Evidence

```text
Unit: IMPL-6 — Validate 28 products (read-only)
Mode: READ_ONLY · NO INSFORGE WRITE · NO CATALOG CHANGE · NO IMPL-7
Local datetime (America/Merida): 2026-07-25 00:32:06 -06:00
Baseline HEAD: 1a5f15d
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Deployment slug: enforma
Result: PASS
Technical recommendation: VALIDATED / CLOSED
Human closure: PENDING
Gate: READY_FOR_IMPL_6_HUMAN_CLOSURE
```

## 1. Baseline Git

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `1a5f15d` |
| origin/main | `1a5f15d` |
| Divergence | `0 / 0` |
| Working tree (pre-docs) | clean |

## 2. Documentary authority

Read for this unit (no modifications to `docs/00-05` or approved specs):

```text
CURSOR_START_PROMPT.md
MANIFEST.md
WORKSPACE_STATUS.md
docs/00-05 (historical constructor names do not change Cursor authority)
docs/specs/README.md
SPEC-000 v0.2.0 APPROVED
SPEC-001 v0.1.0 APPROVED
SPEC-011 v0.1.0 APPROVED
SPEC-030 v0.1.0 APPROVED
SPEC-031 v0.1.0 APPROVED
SPEC-032 v0.1.0 APPROVED
IMPL-0
IMPL-5 catalog/schema remote evidence
```

Primary operation classification (ready2hybrid-spec-governance):

```text
Validate implementation against approved specifications.
```

## 3. READ_ONLY declaration

```text
READ_ONLY = true
InsForge writes = 0
Migrations applied = 0
Catalog mutations = 0
```

Authorized remote surfaces used:

| Surface | Operations | Write capable? | Used? |
|---|---|---|---|
| CLI `whoami` | identity | no | yes (masked account) |
| CLI `db migrations list` | history | no | yes |
| CLI `db query` | SQL | only if non-SELECT sent | SELECT only |
| MCP `get-backend-metadata` | metadata | no | yes |

Not used: `db migrations up`, `run-raw-sql` writes, `bulk-upsert`, bucket/function/deployment mutations, `link`.

## 4. Method and resources consulted

Method:

1. Confirm seed blob/SHA-256 locally.
2. Confirm remote migrations v1–v4 via CLI list.
3. `SELECT` event, event_days, products.
4. Field-by-field compare of 28 products vs seed parser.
5. Derive journeys from SPEC-030 matrix (no invented DB column).
6. `SELECT count(*)` on 21 non-catalog domain tables.
7. Catalog security checks via `pg_catalog` / `information_schema` with `--unrestricted` (SELECT only).
8. Confirm functions/realtime/storage via MCP metadata.

Resources:

```text
events, event_days, products
21 other public domain tables (counts only)
pg_class / pg_policies / role_table_grants
migration history
storage bucket landings-images (metadata)
realtime channels (metadata)
functions list (metadata)
```

### Read / write counts

| Counter | Value |
|---|---|
| CLI validation harness reads (`migrations list` + SELECT queries) | 28 |
| Additional read-only surfaces (CLI whoami/preflight SELECT 1 + MCP metadata) | 3 |
| **InsForge writes** | **0** |

## 5. Seed baseline

| Artifact | Value | Result |
|---|---|---|
| Path | `insforge/seeds/0002_seeds_hybrid_event.sql` | present |
| Git blob | `530bdde721f636c703cbc13929adda94036b12ee` | PASS |
| SHA-256 | `5f115f8cf112638dce4eba72e3d61825853c373e86d5a85cf8d9bbfd62a688ad` | PASS |
| Edited in this unit | no | PASS |

## 6. Remote migration history observed

```text
v1 minimal-sales-schema
v2 sales-constraints-and-indexes
v3 rls-and-access-limits
v4 hybrid-event-catalog
```

No migration was applied, repeated, or replaced. No repository `0004` SQL file exists or was created.

## 7. Expected vs observed catalog

### Event

| Field | Expected | Observed | State |
|---|---|---|---|
| rows | 1 | 1 | PASS |
| code | HEX-2026 | HEX-2026 | PASS |
| name | Hybrid Experience 2026 | Hybrid Experience 2026 | PASS |
| venue_city | Mérida, Yucatán | Mérida, Yucatán | PASS |
| timezone | America/Merida | America/Merida | PASS |
| starts_on | 2026-10-09 | 2026-10-09 | PASS |
| ends_on | 2026-10-11 | 2026-10-11 | PASS |
| status | CONFIGURADO | CONFIGURADO | PASS |

Sales were not opened.

### Event days

| day_date | Expected label | State |
|---|---|---|
| 2026-10-09 | Viernes 9 — Dobles (PM) | PASS |
| 2026-10-10 | Sábado 10 — ½ Hybrid, Dobles y Workout por la mañana; Relay por la tarde. | PASS |
| 2026-10-11 | Domingo 11 — Individual (AM) | PASS |

All three rows have `event_code = HEX-2026`. Count = 3.

### Products

| Control | Expected | Observed | State |
|---|---|---|---|
| products | 28 | 28 | PASS |
| distinct codes | 28 | 28 | PASS |
| duplicates | 0 | 0 | PASS |
| missing vs seed | 0 | 0 | PASS |
| unexpected vs seed | 0 | 0 | PASS |
| field mismatches | 0 | 0 | PASS |
| COMPITE | 13 | 13 | PASS |
| EXPERIENCE | 7 | 7 | PASS |
| ASISTE | 8 | 8 | PASS |
| J1 / J2 / J3 / J4 / J5 | 6 / 9 / 3 / 2 / 8 | 6 / 9 / 3 / 2 / 8 | PASS |

Compared fields for each of 28 products:

```text
event_code, code, name, block, kind, team_size, price_cents,
cupo, day, session, has_chip, has_insurance, currency
```

Normalized names:

| code | name | State |
|---|---|---|
| REL-2H2M | Relay Mixto 2H+2M | PASS |
| IND-H | Individual Hombre Open | PASS |
| IND-M | Individual Mujer Open | PASS |

Journey mapping authority: SPEC-030 product→journey matrix (not a remote column).

## 8. Economic validation

Currency authority: MXN (column default + CHECK; all 28 rows `currency = MXN`).
All `price_cents` are integers. Team/pair products use full unit price (no per-participant multiply).

| Family | Expected cents | State |
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

Chip and insurance are boolean inclusions matching the seed; they are not extra charge rows.

## 9. Cupos, units, dates, sessions, chip/insurance

| Control | Method | State |
|---|---|---|
| cupo exact match for 28 codes | seed vs remote field compare | PASS |
| capacity unit semantics | SPEC-030 (teams/persons) derived; cupo numeric match | PASS |
| economic unit semantics | SPEC-030 (pair/team/person); price not re-multiplied | PASS |
| day/session exact match | seed vs remote | PASS |
| has_chip / has_insurance exact match | seed vs remote | PASS |

## 10. Non-catalog tables

All of the following remain at 0 rows (CLI `SELECT count(*)` per table; MCP metadata consistent):

```text
buyer_contacts, participants, participant_sensitive_profiles,
registrations, teams, team_members, capability_credentials,
waiver_documents, waiver_acceptances, orders, order_items,
capacity_holds, payments, payment_verification_records,
webhook_events, idempotency_records, tickets,
ticket_credential_generations, access_entitlements,
activity_log, outbox_delivery_jobs
```

Only populated tables: `events`, `event_days`, `products`.

## 11. Protected resources

| Resource | Expected | Observed | State |
|---|---|---|---|
| Domain tables | 24 | 24 | PASS |
| RLS enabled | 24 | 24 | PASS |
| FORCE RLS | 24 | 24 | PASS |
| PUBLIC direct grants | 0 | 0 | PASS |
| Policies | 0 | 0 | PASS |
| Runtime functions | 0 | 0 | PASS |
| Realtime channels | 0 | 0 | PASS |
| Bucket `landings-images` | unchanged | present, public, objectCount 0 | PASS |
| Deployment slug | enforma | enforma | PASS |
| Landing | unchanged | unchanged | PASS |
| Mercado Pago | unchanged | unchanged | PASS |
| Canonical migrations 0001–0003 | unchanged | not modified | PASS |
| Canonical seed | unchanged | blob match | PASS |
| IMPL-5 evidence files | unchanged | not renamed/edited | PASS |

## 12. Local regression

| Command | Result |
|---|---|
| `npm run lint` | PASS (oxlint, 0 warnings/errors) |
| `npm run typecheck` | PASS |
| `npm test -- --run` | PASS — 1 file / 1 test |
| `npm run build` | PASS |

## 13. Traceability matrix (catalog scope)

| Requirement | Authority | Expected | Observed | Method | Evidence | State |
|---|---|---|---|---|---|---|
| SPEC-030 catalog 28 / 13+7+8 | SPEC-030 | 28; 13/7/8 | 28; 13/7/8 | remote SELECT + count | this file | PASS |
| SPEC-030 J1–J5 mapping | SPEC-030 | 6/9/3/2/8 | 6/9/3/2/8 | matrix derivation | this file | PASS |
| SPEC-030 prices MXN cents | SPEC-030 | family prices | match | field compare | this file | PASS |
| SPEC-030 chip/insurance inclusions | SPEC-030 / seed | flags per product | match | field compare | this file | PASS |
| SPEC-032-R013 event/day/product presence | SPEC-032 / seed | 1/3/28 | 1/3/28 | remote SELECT | this file | PASS |
| SPEC-032-R034 capacity units (catalog) | SPEC-030/032 | cupo per product | match | field compare | this file | PASS |
| SPEC-032-R035 money invariants (catalog) | SPEC-030/032 | integer MXN cents | match | field compare | this file | PASS |
| SPEC-032-R048 seed apply integrity | seed blob + IMPL-5 | remote = seed | match | byte-authoritative compare | this file + IMPL-5 evidence | PASS |
| SPEC-032-R050 shared 28-product config | SPEC-030/032 | 28 unique codes | 28 unique | uniqueness + compare | this file | PASS |

Checkout/runtime capacity reservation, payments, tickets, and API surfaces remain out of scope and are **not** marked complete.

## 14. Conclusion

```text
IMPL-6 technical validation: PASS
InsForge writes: 0
Recommended technical state: VALIDATED / CLOSED
Human closure: PENDING
IMPL-7: NOT AUTHORIZED
```

## 15. Limitations

- Journey and economic/capacity unit labels are derived from SPEC-030; they are not stored as remote columns.
- Product `status`/sale-state beyond event `CONFIGURADO` is not a separate product column in the minimal schema; sales remain closed at event level.
- This unit does not authorize human closure; Project Owner retains final closure approval.
- Read counts include only this validation harness plus declared identity/metadata reads; no secrets were printed.

## 16. Recommended gate

```text
READY_FOR_IMPL_6_HUMAN_CLOSURE
```

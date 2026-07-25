# InsForge Schema Deployment Validation Evidence

```text
Unit: INSFORGE-SCHEMA-DEPLOYMENT
Mode: OFFICIAL INSFORGE CLI MIGRATION ENDPOINT · NO SEED · NO IMPL-5
Date: 2026-07-24
Baseline HEAD (pre-deploy docs): accde0f
CLI: @insforge/cli@0.2.1
Canonical project: ready2hybrid
Host: 4bg9ufz2.us-east
Deployment slug: enforma
Result: PASS
Gate: READY_FOR_IMPL_5_AUTHORIZATION
```

## 1. Baseline Git

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD before deploy | `accde0f` |
| origin/main before deploy | `accde0f` |
| Divergence | `0 / 0` |
| Working tree | clean |

## 2. Blocked prior path

`run-raw-sql` rejected the exact canonical migrations because they contain
outer `BEGIN;` / `COMMIT;` (`Transaction control statements are not allowed`).
Gate previously recorded: `BLOCKED_BY_SAFE_INSFORGE_WRITE_PATH`.

## 3. Why the migration endpoint was used

InsForge CLI `db migrations up` is the official migration path and owns its
transaction boundary. Temporary adapters outside the repository remove only
the outer transaction statements so the CLI can apply the same DDL.

## 4. CLI version

```text
@insforge/cli@0.2.1
```

## 5. Backend verified

| Signal | Value |
|---|---|
| Account (masked) | `en…@gmail.com` (exact match to authorized account) |
| Project | `ready2hybrid` |
| Host | `4bg9ufz2.us-east` |
| Deployment slug (MCP) | `enforma` |
| Pre-deploy remote migrations | `0` |
| Pre-deploy domain tables (MCP) | `0` |
| Pre-deploy functions (MCP) | `0` |
| Pre-deploy catalog | absent |
| Bucket | `landings-images` preserved |

Non-canonical project `landing-images` (`nhr5…`) was not restored and was not
targeted.

## 6. Staging / adapters

| Item | Value |
|---|---|
| Private workspace | `%LOCALAPPDATA%\Ready2Hybrid\InsForgeDeploy` |
| Adapter directory | `migrations/` (temporary; deleted after evidence) |
| Canonical files modified | no |

| Adapter | SHA-256 | Equivalence |
|---|---|---|
| `0001_minimal-sales-schema.sql` | `f494964456329af1e0cb43ab81cf42289ab87d7f2c4ad89e6c4b209ef008ee8e` | PASS |
| `0002_sales-constraints-and-indexes.sql` | `0a8cd1e29bac48dc2a348592eccc9cd924aa9e30f8facd8202d31261996d3b9e` | PASS |
| `0003_rls-and-access-limits.sql` | `e5d69978edd44b76f8a80a2bd527efbde5003eb9e2c2dea75234e04ae48fde3a` | PASS |

Equivalence rule: only one independent outer `BEGIN;` and one independent
outer `COMMIT;` removed; all other bytes preserved; remaining transaction
statements = 0.

## 7. Protected blobs (canonical, unchanged)

| Artifact | Blob |
|---|---|
| `0001_minimal_sales_schema.sql` | `99b1964b65b9590ec2f3a909e200d09457559ec5` |
| `0002_sales_constraints_and_indexes.sql` | `24622ab0787c4952799cde2bd93784627b39ef53` |
| `0003_rls_and_access_limits.sql` | `d2c3778364cae4cada03c8a7e3d5b6b6f6365dbd` |
| `0002_seeds_hybrid_event.sql` | `f8989b2c10bb04fe258b19bf646dd650940c4944` |

## 8. Result of 0001

| Field | Value |
|---|---|
| Command | `db migrations up 0001_minimal-sales-schema.sql` |
| Version | `1` |
| Name | `minimal-sales-schema` |
| Statements | `53` |
| createdAt | `2026-07-25T01:39:57.213Z` |
| Result | success |

### Validation after 0001

| Control | Expected | Actual | Result |
|---|---|---|---|
| Remote migrations | 1 | 1 | PASS |
| Domain tables | 24 | 24 | PASS |
| UUID PK / `id uuid NOT NULL` | 24 | 24 | PASS |
| Foreign keys | 0 | 0 | PASS |
| RLS enabled | 0 | 0 | PASS |
| Policies | 0 | 0 | PASS |
| Edge/runtime functions (MCP) | 0 | 0 | PASS |
| Catalog rows (`events`/`event_days`/`products`) | 0 | 0 | PASS |

## 9. Result of 0002

| Field | Value |
|---|---|
| Command | `db migrations up 0002_sales-constraints-and-indexes.sql` |
| Version | `2` |
| Name | `sales-constraints-and-indexes` |
| Statements | `186` |
| createdAt | `2026-07-25T01:40:24.428Z` |
| Result | success |

### Validation after 0002

| Control | Expected | Actual | Result |
|---|---|---|---|
| Remote migrations | 2 | 2 | PASS |
| Domain tables | 24 | 24 | PASS |
| Foreign keys | 44 | 44 | PASS |
| Unique constraints | 12 | 12 | PASS |
| Check constraints | 45 | 45 | PASS |
| Domain indexes | 110 | 110 | PASS |
| Deferrable foreign keys | 11 | 11 | PASS |
| RLS enabled | 0 | 0 | PASS |
| Policies | 0 | 0 | PASS |
| Non-internal triggers | 0 | 0 | PASS |
| Edge/runtime functions (MCP) | 0 | 0 | PASS |

## 10. Result of 0003

| Field | Value |
|---|---|
| Command | `db migrations up 0003_rls-and-access-limits.sql` |
| Version | `3` |
| Name | `rls-and-access-limits` |
| Statements | `79` |
| createdAt | `2026-07-25T01:40:49.363Z` |
| Result | success |

### Validation after 0003 / final inventory

| Control | Expected | Actual | Result |
|---|---|---|---|
| Remote migrations | 3 | 3 | PASS |
| Domain tables | 24 | 24 | PASS |
| UUID primary keys | 24 | 24 | PASS |
| Foreign keys | 44 | 44 | PASS |
| Unique constraints | 12 | 12 | PASS |
| Check constraints | 45 | 45 | PASS |
| Domain indexes | 110 | 110 | PASS |
| Deferrable foreign keys | 11 | 11 | PASS |
| RLS enabled | 24 | 24 | PASS |
| FORCE RLS enabled | 24 | 24 | PASS |
| PUBLIC table grants | 0 | 0 | PASS |
| End-user / capability policies | 0 | 0 | PASS |
| Edge/runtime functions (MCP) | 0 | 0 | PASS |
| Realtime channels | 0 | 0 | PASS |
| `events` rows | 0 | 0 | PASS |
| `event_days` rows | 0 | 0 | PASS |
| `products` rows | 0 | 0 | PASS |
| `HEX-2026` | absent | absent | PASS |

## 11. Remote migration history

| Version | Name | Statements | createdAt |
|---|---|---|---|
| 1 | `minimal-sales-schema` | 53 | `2026-07-25T01:39:57.213Z` |
| 2 | `sales-constraints-and-indexes` | 186 | `2026-07-25T01:40:24.428Z` |
| 3 | `rls-and-access-limits` | 79 | `2026-07-25T01:40:49.363Z` |

## 12. Protected resources

| Resource | State |
|---|---|
| Bucket `landings-images` | unchanged |
| Realtime | unchanged (0 channels) |
| Landing | unchanged |
| Mercado Pago | unchanged |
| Seed execution | NOT EXECUTED |
| Canonical SQL blobs | unchanged |
| Temporary adapters | BEGIN/COMMIT removal only; deleted after evidence |

## 13. Errors / warnings

None material. Prior `run-raw-sql` transaction-control rejection is historical
context only and was not used for this deployment.

## 14. Gate

```text
Canonical InsForge project: ready2hybrid
Host: 4bg9ufz2.us-east
0001 remote: DEPLOYED AND VALIDATED
0002 remote: DEPLOYED AND VALIDATED
0003 remote: DEPLOYED AND VALIDATED
Migration path: official InsForge migration endpoint
Canonical files: unchanged
Deployment adapters: temporary and deleted
Catalog: empty
Seed: NOT EXECUTED
IMPL-5: PROPOSED / NOT AUTHORIZED
Gate: READY_FOR_IMPL_5_AUTHORIZATION
```

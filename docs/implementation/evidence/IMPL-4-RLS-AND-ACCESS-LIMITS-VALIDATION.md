# IMPL-4 — RLS and Access Limits Validation Evidence

```text
Unit: IMPL-4 — RLS and access limits
Mode: RLS/ACCESS-ONLY · LOCAL EPHEMERAL POSTGRESQL · NO INSFORGE DEPLOY
Date: 2026-07-24
Baseline HEAD (docs ACCESS-DEC): 66cf9ff
SQL commit: cbbeecc
Migration 0001 blob: 99b1964b65b9590ec2f3a909e200d09457559ec5
Migration 0002 blob: 24622ab0787c4952799cde2bd93784627b39ef53
Migration 0003: insforge/migrations/0003_rls_and_access_limits.sql
Migration 0003 blob: d2c3778364cae4cada03c8a7e3d5b6b6f6365dbd
Seed blob preserved: f8989b2c10bb04fe258b19bf646dd650940c4944
Access decisions: ACCESS-DEC-001..008 APPROVED
Result: PASS
Gate: ACCESS_READY_FOR_SEED
```

## 1. Environment

| Item | Value |
|---|---|
| Engine | Docker Desktop 29.2.0 |
| Image | `postgres:16-alpine` |
| Digest | `postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777` |
| Server version | 16.14 |
| Container | `r2h-impl4-validation` |
| InsForge connection | none |
| Seed copied/executed | no |

## 2. Clean applies

| Step | Result |
|---|---|
| Apply `0001` on `r2h_impl4_validate_1` | PASS |
| Apply `0002` | PASS |
| Apply `0003` | PASS |
| Second clean apply chain on `r2h_impl4_validate_2` | PASS |
| Reapply `0003` | IDEMPOTENT_SUCCESS (ENABLE/FORCE/REVOKE are idempotent) |

## 3. Migration inventory

| Control | Count / value | Result |
|---|---|---|
| `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | 24 | PASS |
| `ALTER TABLE ... FORCE ROW LEVEL SECURITY` | 24 | PASS |
| `CREATE POLICY` | 0 | PASS |
| Capability-named PostgreSQL roles | 0 | PASS |
| Policies in `pg_policies` | 0 | PASS |
| PUBLIC table grants on canonical tables | 0 | PASS |

## 4. A01–A16 results

| ID | Case | Result |
|---|---|---|
| A01 | ANON cannot see canonical rows (`events` count=0 under RLS) | PASS |
| A02 | ANON cannot INSERT | PASS (`new row violates row-level security policy`) |
| A03 | authenticated browser cannot see canonical rows | PASS |
| A04 | authenticated browser cannot mutate | PASS |
| A05 | public catalog tables not directly visible to ANON | PASS |
| A06 | `participant_sensitive_profiles` denied to browser identity | PASS |
| A07 | payment tables denied | PASS |
| A08 | capability hashes denied | PASS |
| A09 | `activity_log` denied | PASS |
| A10 | outbox denied | PASS |
| A11 | backend service with `BYPASSRLS` can SELECT/INSERT | PASS |
| A12 | no PUBLIC GRANT remains on canonical tables | PASS |
| A13 | all 24 tables have RLS enabled and forced | PASS |
| A14 | no capability modeled as PostgreSQL role | PASS |
| A15 | no PII/secrets in migration | PASS |
| A16 | seed remains unexecuted | NOT_RUN / PASS (seed not copied) |

Test method notes:

* Browser identities were simulated as `r2h_anon` / `r2h_authenticated` with table GRANTs but **without** `BYPASSRLS`, using `SET SESSION AUTHORIZATION`.
* Under deny-by-default RLS with no policies, SELECT returns zero rows; INSERT fails with RLS policy violation.
* Backend path was simulated as `r2h_backend_service` **with** `BYPASSRLS` (ACCESS-DEC backend boundary). These roles existed only in the ephemeral harness and are **not** created by migration `0003`.

## 5. Regression

| Check | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS |
| `npm run build` | PASS |

## 6. Protected boundaries

```text
0001 unchanged
0002 unchanged
seed unchanged / not executed
landing untouched (LANDING_READY_FOR_READY2HYBRID_MATCH)
InsForge writes: 0
Mercado Pago writes: 0
Runtime deployments: 0
Staff/operator/admin access: not created
Capability TTL / retention periods: not invented
```

## 7. Closure

```text
IMPL-4: VALIDATED
RLS deny-by-default: PASS
Policies for end users/capabilities: 0
InsForge deployment: NO
Seed executed: NO
Ready for production: NO
Next unit: IMPL-5 — Apply catalog seed
Next unit status: PROPOSED / NOT AUTHORIZED
Gate: ACCESS_READY_FOR_SEED
```

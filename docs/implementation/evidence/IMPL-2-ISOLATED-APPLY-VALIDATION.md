# IMPL-2 — Isolated Apply Validation Evidence

```text
Unit: IMPL-2 — Isolated migration validation closure
Mode: VALIDATION-ONLY / LOCAL EPHEMERAL POSTGRESQL
Date: 2026-07-24
Baseline HEAD: ac2be55
Migration: insforge/migrations/0001_minimal_sales_schema.sql
Migration Git blob: 99b1964b65b9590ec2f3a909e200d09457559ec5
Protected seed: insforge/seeds/0002_seeds_hybrid_event.sql
Seed Git blob: f8989b2c10bb04fe258b19bf646dd650940c4944
Result: PASS
Gate: SCHEMA_MIGRATION_READY_FOR_CONSTRAINTS
```

## 1. Environment

| Item | Value |
|---|---|
| Engine | Docker Desktop 29.2.0 |
| Image | `postgres:16-alpine` |
| Image digest | `postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777` |
| Server version | 16.14 |
| Container name | `r2h-impl2-validation` |
| Persistent volumes | none |
| InsForge connection | none |
| Seed copied into container | no |

## 2. Clean apply results

| Check | Database | Result |
|---|---|---|
| First clean apply | `r2h_validate_1` | PASS (`exit code = 0`, BEGIN, 24 CREATE TABLE, COMMIT) |
| Second clean apply | `r2h_validate_2` | PASS (`exit code = 0`, BEGIN, 24 CREATE TABLE, COMMIT) |
| Reapply on existing schema | `r2h_validate_1` | EXPECTED_FAILURE (`relation "events" already exists`, exit code = 3) |

## 3. Table inventory

Both databases reported exactly **24** public base tables:

```text
access_entitlements
activity_log
buyer_contacts
capability_credentials
capacity_holds
event_days
events
idempotency_records
order_items
orders
outbox_delivery_jobs
participant_sensitive_profiles
participants
payment_verification_records
payments
products
registrations
team_members
teams
ticket_credential_generations
tickets
waiver_acceptances
waiver_documents
webhook_events
```

| Database | Table count | Result |
|---|---|---|
| `r2h_validate_1` | 24 | PASS |
| `r2h_validate_2` | 24 | PASS |

## 4. Primary keys and UUID defaults

| Check | `r2h_validate_1` | `r2h_validate_2` | Result |
|---|---|---|---|
| PRIMARY KEY count | 24 | 24 | PASS |
| `id uuid NOT NULL` columns | 24 | 24 | PASS |
| Live `gen_random_uuid()` insert into `buyer_contacts` | `344cffed-0a74-405e-9527-7c64807551ed` | n/a | PASS |
| Ephemeral row cleanup | `buyer_contacts` count = 0 | n/a | PASS |

No personal or real customer data was inserted.

## 5. IMPL-3 / IMPL-4 boundary checks

| Check | `r2h_validate_1` | `r2h_validate_2` | Expected | Result |
|---|---|---|---|---|
| Foreign keys (`contype = 'f'`) | 0 | 0 | 0 | PASS |
| Additional unique constraints (`contype = 'u'`) | 0 | 0 | 0 | PASS |
| Check constraints (`contype = 'c'`) | 0 | 0 | 0 | PASS |
| Indexes in `public` | 24 | 24 | 24 (PK only) | PASS |
| RLS enabled tables | 0 | 0 | 0 | PASS |
| Policies | 0 | 0 | 0 | PASS |
| Non-internal triggers | 0 | 0 | 0 | PASS |
| Functions in `public` | 0 | 0 | 0 | PASS |

## 6. Seed structural compatibility

Runtime column presence was verified against `information_schema.columns` without executing the seed.

### events

```text
code, name, venue_city, timezone, starts_on, ends_on, status
```

### event_days

```text
event_code, day_date, label
```

### products

```text
event_code, code, name, block, kind, team_size, price_cents,
cupo, day, session, has_chip, has_insurance
```

```text
seed structural compatibility = PASS
seed execution = NOT_RUN
```

## 7. Teardown

```text
docker rm -f r2h-impl2-validation
remaining containers named r2h-impl2-validation: none
```

No repository temporary files, passwords, or secret-bearing logs were retained.

## 8. Result matrix

| Control | Result |
|---|---|
| Preflight Git (`ac2be55` / clean) | PASS |
| Migration unchanged during validation | PASS |
| Seed unchanged during validation | PASS |
| Docker/PostgreSQL ephemeral environment | PASS |
| First clean apply | PASS |
| Second clean apply | PASS |
| 24 tables both databases | PASS |
| 24 UUID primary keys | PASS |
| `gen_random_uuid()` live proof | PASS |
| Zero FK / extra UNIQUE / CHECK | PASS |
| 24 PK indexes only | PASS |
| Zero RLS / policies / triggers / public functions | PASS |
| Seed structural compatibility | PASS |
| Seed execution | NOT_RUN |
| Reapply on existing schema | EXPECTED_FAILURE |
| Teardown complete | PASS |
| InsForge writes | 0 / PASS |
| Mercado Pago writes | 0 / PASS |
| Migration mutation | NONE / PASS |
| Constraint/index/RLS implementation | NONE / PASS |

## 9. Closure

```text
IMPL-2: VALIDATED
Isolated PostgreSQL apply: PASS
Migration deployed to InsForge: NO
Seed executed: NO
Constraints implemented: NO
Indexes implemented: NO
RLS implemented: NO
Ready for production: NO
Next unit: IMPL-3 — Constraints and indexes
Next unit status: PROPOSED / NOT AUTHORIZED
Gate: SCHEMA_MIGRATION_READY_FOR_CONSTRAINTS
```

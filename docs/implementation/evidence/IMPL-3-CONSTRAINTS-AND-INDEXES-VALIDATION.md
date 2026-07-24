# IMPL-3 — Constraints and Indexes Validation Evidence

```text
Unit: IMPL-3 — Constraints and indexes
Mode: CONSTRAINTS-AND-INDEXES-ONLY / LOCAL EPHEMERAL POSTGRESQL
Date: 2026-07-24
Baseline HEAD: 3dc6be2
SQL commit: b459e80
Migration 0001: insforge/migrations/0001_minimal_sales_schema.sql
Migration 0001 Git blob: 99b1964b65b9590ec2f3a909e200d09457559ec5
Migration 0002: insforge/migrations/0002_sales_constraints_and_indexes.sql
Migration 0002 Git blob: 24622ab0787c4952799cde2bd93784627b39ef53
Protected seed: insforge/seeds/0002_seeds_hybrid_event.sql
Seed Git blob: f8989b2c10bb04fe258b19bf646dd650940c4944
Result: PASS
Gate: CONSTRAINTS_READY_FOR_ACCESS
```

## 1. Environment

| Item | Value |
|---|---|
| Engine | Docker Desktop 29.2.0 |
| Image | `postgres:16-alpine` |
| Image digest | `postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777` |
| Server version | 16.14 |
| Container | `r2h-impl3-validation` |
| Persistent volumes | none |
| InsForge connection | none |
| Seed copied/executed | no |

## 2. Clean applies

| Step | `r2h_impl3_validate_1` | `r2h_impl3_validate_2` |
|---|---|---|
| Apply `0001` | PASS | PASS |
| Apply `0002` | PASS | PASS |
| COMMIT | PASS | PASS |

## 3. Constraint / index inventory (both databases)

| Class | Count | Result |
|---|---:|---|
| Foreign keys | 44 | PASS |
| Unique table constraints (`contype='u'`) | 12 | PASS |
| Check constraints | 45 | PASS |
| Indexes in `public` (PK + unique + non-unique) | 110 | PASS |
| Deferrable FKs | 11 | PASS |
| RLS enabled tables | 0 | PASS |
| Policies | 0 | PASS |
| Non-internal triggers | 0 | PASS |
| Functions in `public` | 0 | PASS |

### Unique table constraints

```text
uq_events_code
uq_events_id_code
uq_products_event_code_code
uq_products_id_code
uq_products_id_event_code_code
uq_waiver_documents_type_version
uq_waiver_documents_id_type_version
uq_participant_sensitive_profiles_participant
uq_capability_credentials_token_hash
uq_tickets_registration
uq_ticket_credential_generations_token_hash
uq_ticket_credential_generations_ticket_generation
```

### Partial unique indexes (selected)

```text
uq_event_days_event_date_session_not_null
uq_event_days_event_date_session_null
uq_buyer_contacts_public_ref
uq_participants_public_ref
uq_teams_public_ref
uq_orders_tracking_ref
uq_orders_external_reference
uq_tickets_folio_namespace_folio
uq_team_members_active_position
uq_team_members_active_captain
uq_team_members_active_participant
uq_team_members_registration
uq_team_members_invitation_capability
uq_capability_active_* (5 kinds)
uq_capability_*_generation (5 kinds)
uq_payments_provider_payment_id
uq_webhook_events_provider_notification_id
uq_idempotency_records_scope_actor_key
uq_idempotency_records_scope_key_null_actor
uq_ticket_credential_generations_active
uq_access_entitlements_ticket_date_session_not_null
uq_access_entitlements_ticket_date_session_null
```

### Deferrable foreign keys

```text
fk_capability_credentials_replaced_by
fk_capability_credentials_team_member
fk_capability_credentials_ticket
fk_registrations_team_member
fk_team_members_invitation_capability
fk_team_members_registration
fk_team_members_substitution_of_member
fk_team_members_team
fk_teams_captain_team_member
fk_ticket_credential_generations_prior
fk_ticket_credential_generations_replacement
```

### NOT NULL additions

```text
registrations: event_id, event_code, product_id, product_code, order_id, journey
waiver_acceptances: document_type
orders: buyer_contact_id
order_items: product_id, product_code, journey, capacity_unit, commercial_snapshot
capacity_holds: product_id, product_code, order_id, order_item_id
payments: order_id
payment_verification_records: payment_id, order_id
tickets: registration_id, product_id, product_code
```

### Non-unique indexes omitted for redundancy

```text
event_days(event_code) — leftmost of uq_event_days_*
products(event_code) — leftmost of uq_products_event_code_code
```

## 4. Positive fixtures

Synthetic graph inserts (no real PII): event, event_day, product, buyer,
participant, sensitive profile shell, waiver document/acceptance, order/item,
hold, payment/verification, registration, team/members, ticket, active QR
generation, entitlement, webhook, idempotency record, ORDER_HOLDER capability.

```text
positive_fixtures = PASS
```

## 5. Negative fixtures N01–N30

| Case | Expected constraint/index | Result |
|---|---|---|
| N01 duplicate events.code | `uq_events_code` | PASS |
| N02 starts_on > ends_on | `ck_events_date_order` | PASS |
| N03 duplicate product code | `uq_products_event_code_code` | PASS |
| N04 negative price | `ck_products_price_nonnegative` | PASS |
| N05 negative cupo | `ck_products_cupo_nonnegative` | PASS |
| N06 team_size = 0 | `ck_products_team_size_positive` | PASS |
| N07 invalid currency | `ck_products_currency_mxn` | PASS |
| N08 invalid block | `ck_products_block` | PASS |
| N09 registration holder XOR | `ck_registrations_exactly_one_holder` | PASS |
| N10 duplicate active position | `uq_team_members_active_position` | PASS |
| N11 duplicate active captain | `uq_team_members_active_captain` | PASS |
| N12 duplicate active participant | `uq_team_members_active_participant` | PASS |
| N13 duplicate team-member registration | `uq_team_members_registration` | PASS |
| N14 invalid FK | `fk_products_event_code` | PASS |
| N15 duplicate capability token_hash | `uq_capability_credentials_token_hash` | PASS |
| N16 second active capability generation | `uq_capability_active_order_holder` | PASS |
| N17 waiver version mismatch | `fk_waiver_acceptances_document_version` | PASS |
| N18 quantity = 0 | `ck_order_items_quantity_positive` | PASS |
| N19 item total mismatch | `ck_order_items_total_matches_unit_times_qty` | PASS |
| N20 capacity_units = 0 | `ck_capacity_holds_units_positive` | PASS |
| N21 duplicate provider payment ID | `uq_payments_provider_payment_id` | PASS |
| N22 duplicate webhook notification ID | `uq_webhook_events_provider_notification_id` | PASS |
| N23 duplicate idempotency identity | `uq_idempotency_records_scope_actor_key` | PASS |
| N24 duplicate ticket per registration | `uq_tickets_registration` | PASS |
| N25 duplicate credential token_hash | `uq_ticket_credential_generations_token_hash` | PASS |
| N26 second ACTIVE QR generation | `uq_ticket_credential_generations_active` | PASS |
| N27 duplicate ticket/date/session entitlement | `uq_access_entitlements_ticket_date_session_not_null` | PASS |
| N28 credential expires before issue | `ck_ticket_credential_generations_expires_after_issued` | PASS |
| N29 negative webhook attempts | `ck_webhook_events_attempts_nonnegative` | PASS |
| N30 negative outbox attempts | `ck_outbox_delivery_jobs_attempts_nonnegative` | PASS |

## 6. Allowed history fixtures

```text
REPLACED team member position reuse = PASS
REVOKED QR + new ACTIVE generation = PASS
REVOKED capability + new ACTIVE generation = PASS
Multiple payments per order = PASS
Multiple webhooks per/across payments = PASS
Multiple verification records per payment = PASS
Multiple entitlements on different dates = PASS
history_fixtures = PASS
```

## 7. Reapply and teardown

```text
reapply 0002 on existing schema = EXPECTED_FAILURE (already exists)
docker rm -f r2h-impl3-validation
remaining containers = none
```

## 8. Regression

| Check | Result |
|---|---|
| `git diff --check` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS |
| `npm run build` | PASS |

## 9. Deferred runtime invariants (explicitly NOT implemented)

```text
- atomic last-capacity reservation
- current consumed capacity across holds/orders
- sum(order_items) = order total
- maximum active team slots = product.team_size
- full roster completeness
- participant composition rules
- exact J2/J3 ticket set creation
- state transition authorization / ordering
- payment merchant/reference/amount/currency verification
- same idempotency key + different fingerprint error response
- webhook signature validation
- capability expiry durations
- rate limits
- three-day exact entitlement count
- ticket issuance and reissue transaction
- outbox atomicity with domain effects
```

## 10. Closure

```text
IMPL-3: VALIDATED
Constraints/indexes isolated apply: PASS
Migration deployed to InsForge: NO
Seed executed: NO
RLS implemented: NO
Policies implemented: NO
Functions/triggers implemented: NO
Ready for production: NO
Next unit: IMPL-4 — RLS and access limits
Next unit status: PROPOSED / NOT AUTHORIZED
Gate: CONSTRAINTS_READY_FOR_ACCESS
```

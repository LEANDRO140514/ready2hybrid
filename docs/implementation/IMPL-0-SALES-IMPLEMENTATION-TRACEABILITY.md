# IMPL-0 — Sales Implementation Traceability

```text
Status: DOCUMENTARY ONLY
Version: 0.1.0
Created: 2026-07-24
Authority: Explicit Project Owner approval of SPEC-032 v0.1.0
Commit/push: NOT AUTHORIZED by this unit
Runtime execution: NOT AUTHORIZED
```

## A. Objective

Translate the approved SPEC-032 contract into small, verifiable, separately
authorizable implementation units without executing any of them.

This document is planning and traceability only. It does not authorize seed
correction, SQL, InsForge mutation, Mercado Pago runtime, Edge Functions,
webhooks, payments, landing changes, commit, or push.

## B. Authority

Normative dependencies:

| Spec | Version | Status |
|---|---|---|
| SPEC-000 Specification Governance | 0.2.0 | APPROVED |
| SPEC-001 System Architecture | 0.1.0 | APPROVED |
| SPEC-011 PWA Foundation | 0.1.0 | APPROVED (compatibility) |
| SPEC-030 Public Sales Catalog and Registration Journeys | 0.1.0 | APPROVED |
| SPEC-031 Public Sales API and Backend Contract | 0.1.0 | APPROVED |
| SPEC-032 Minimal Public Sales Data Model and Transaction Integrity | 0.1.0 | APPROVED |

SPEC-032 Appendix H is the authoritative implementation sequence. This
document does not invent a second sequence.

## C. Baseline

```text
Repository baseline before IMPL-0 documentation changes: 07471d7
Runtime tables: 0 (last documentary InsForge evidence in SPEC-032 §3)
Runtime functions: 0 (same evidence)
Realtime channels: 0 (same evidence)
Preserved bucket: landings-images
Preserved deployment slug: enforma
Seed path: insforge/seeds/0002_seeds_hybrid_event.sql
Seed hash at baseline: 20d73e626981604da65e1ea34dc1a03b37f0845f
Seed status: unexecuted and NOT_READY_FOR_EXECUTION
```

IMPL-0 does not re-query InsForge MCP. Infrastructure claims above are
documentary evidence already recorded in SPEC-032.

## D. Controlled units

Source: SPEC-032 Appendix H. Every implementation unit requires separate human
authorization. Current states are recorded independently in each unit below;
this document does not authorize any unit by itself.

### IMPL-1 — Correct and version the Hybrid Event seed

| Field | Value |
|---|---|
| Related requirements | SPEC-032-R013, R048, R050 |
| Dependencies | SPEC-032 APPROVED; SEED-001..005 documented; SEED-003 wording resolved by Project Owner |
| Anticipated files | `insforge/seeds/0002_seeds_hybrid_event.sql`; seed review evidence |
| External resources | None |
| Blocking open decisions | OD-022 APPROVED 2026-07-24 |
| Scope | Editorial/catalog seed correction only; preserve commercial values from SPEC-030 |
| Out of scope | Schema, RLS, functions, payments, landing, seed execution against InsForge |
| Automated tests | Documentary/static checks: 28 unique codes; `13+7+8`; comments/labels match |
| Manual tests | Owner review of Saturday label wording before commit |
| Expected evidence | Diff limited to seed; hash change documented; SEED-001..005 closed or residual justified |
| Rollback | Revert seed-only commit before any execution |
| Entry gate | `READY_FOR_SEED_CORRECTION` + separate human authorization |
| Exit gate | `SEED_CORRECTED_READY_FOR_SCHEMA` |
| Separate human authorization | Required |
| Current state | `VALIDATED / CLOSED` — seed aligned and locally validated; later applied remotely under the separately authorized IMPL-5 unit. |

### IMPL-2 — Minimal schema migration

| Field | Value |
|---|---|
| Related requirements | R011-R032, R054-R055 |
| Dependencies | IMPL-1 closed; SPEC-032 APPROVED |
| Anticipated files | `insforge/migrations/0001_minimal_sales_schema.sql` |
| External resources | Local ephemeral PostgreSQL only for validation; InsForge write not authorized |
| Blocking open decisions | None that block model skeleton; exact personal/medical fields remain optional extensions |
| Scope | Logical entity responsibilities as tables/columns without finalizing every open field |
| Out of scope | Seed execution, RLS policies, Edge Functions, payments, landing |
| Automated tests | Clean apply/rollback in isolated environment; 24-entity inventory |
| Manual tests | Schema inventory review against Appendix A |
| Expected evidence | `docs/implementation/evidence/IMPL-2-ISOLATED-APPLY-VALIDATION.md` |
| Rollback | Approved down/replacement migration before data |
| Entry gate | SPEC-032 approved; IMPL-1 closed |
| Exit gate | `SCHEMA_MIGRATION_READY_FOR_CONSTRAINTS` |
| Separate human authorization | Required |
| Current state | `VALIDATED` |

### IMPL-3 — Constraints and indexes

| Field | Value |
|---|---|
| Related requirements | R033-R043, R054-R055 |
| Dependencies | IMPL-2 validated |
| Anticipated files | `insforge/migrations/0002_sales_constraints_and_indexes.sql` |
| External resources | Local ephemeral PostgreSQL only for validation; InsForge write not authorized |
| Blocking open decisions | Folio format (OD-019) may affect public-reference uniqueness shape but not the uniqueness obligation |
| Scope | Cardinality, uniqueness, money/capacity concurrency constraints |
| Out of scope | RLS, functions, seed apply, payments |
| Automated tests | Uniqueness, FK/cardinality, team-member registration, token-generation, money/capacity concurrency |
| Manual tests | Constraint inventory review |
| Expected evidence | `docs/implementation/evidence/IMPL-3-CONSTRAINTS-AND-INDEXES-VALIDATION.md` |
| Rollback | Replacement migration; no destructive production rollback |
| Entry gate | IMPL-2 validated |
| Exit gate | `CONSTRAINTS_READY_FOR_ACCESS` |
| Separate human authorization | Required |
| Current state | `VALIDATED` |

### IMPL-4 — RLS and access limits

| Field | Value |
|---|---|
| Related requirements | R010, R020, R044-R047, R053 |
| Dependencies | IMPL-3 validated; auth decisions for enabled paths |
| Anticipated files | `insforge/migrations/0003_rls_and_access_limits.sql`; `docs/implementation/IMPL-4-ACCESS-DECISION-PACK.md`; evidence |
| External resources | Local ephemeral PostgreSQL for validation; InsForge write not authorized |
| Blocking open decisions | ACCESS-DEC-001..008 APPROVED; API-OD-004 TTL/transport deferred+feature-disabled; API-OD-005 narrow (UUID+activity_log); API-OD-007 remains PRODUCTION_BLOCKER |
| Scope | Anonymous denial; FORCE RLS deny-by-default; backend BYPASSRLS boundary; named abuse/rate profiles (documentary) |
| Out of scope | Checkout, webhook, tickets, landing UI, InsForge deployment, end-user policies |
| Automated tests | A01-A16 local ephemeral suite |
| Manual tests | Actor/permission walkthrough |
| Expected evidence | `docs/implementation/evidence/IMPL-4-RLS-AND-ACCESS-LIMITS-VALIDATION.md` |
| Rollback | Replacement access migration; revoke unintended grants |
| Entry gate | IMPL-3 validated; ACCESS-DEC-001..008 approved |
| Exit gate | `ACCESS_READY_FOR_SEED` |
| Separate human authorization | Required for SQL/RLS execution unit |
| Current state | `VALIDATED` |

### IMPL-5 — Apply catalog seed

| Field | Value |
|---|---|
| Related requirements | R013, R034-R035, R048, R050 |
| Dependencies | IMPL-1 and IMPL-4 closed; explicit execution authorization |
| Anticipated files | corrected seed; execution evidence |
| External resources | InsForge database |
| Blocking open decisions | None. OD-022 was approved and the remote catalog application was completed under the separately authorized IMPL-5 execution unit. |
| Scope | Apply corrected event/day/product catalog only |
| Out of scope | Checkout, payments, tickets, landing |
| Automated tests | Exact 28 products and event/session checks |
| Manual tests | Catalog spot-check against SPEC-030 |
| Expected evidence | `docs/implementation/evidence/IMPL-5-CATALOG-SEED-REMOTE-EXECUTION-VALIDATION.md` |
| Rollback | Controlled delete/reversal only in non-production or approved corrective migration |
| Entry gate | Seed aligned + local validation PASS; separate remote-execution authorization |
| Exit gate | `CATALOG_SEEDED` |
| Separate human authorization | Required for remote apply |
| Remote migration | `v4 hybrid-event-catalog` |
| Human closure | APPROVED 2026-07-24 |
| Canonical repository migration file 0004 | NONE — deployment used a temporary byte-equivalent external adapter. |
| Current state | `VALIDATED` |

### IMPL-6 — Validate 28 products

| Field | Value |
|---|---|
| Related requirements | R013, R034-R035, R050 |
| Dependencies | IMPL-5 |
| Anticipated files | validators/test reports |
| External resources | Read-only InsForge |
| Blocking open decisions | None |
| Scope | Codes, counts, prices, flags, schedule, journeys, capacity units |
| Out of scope | Runtime sales, payments |
| Automated tests | Catalog validators |
| Manual tests | Block totals `13+7+8=28` |
| Expected evidence | `docs/implementation/evidence/IMPL-6-28-PRODUCTS-READ-ONLY-VALIDATION.md` |
| Rollback | Correct seed/migration through new authorized unit |
| Entry gate | IMPL-5 |
| Exit gate | `CATALOG_VALIDATED` |
| Separate human authorization | Required |
| Remote mode | `READ_ONLY` · InsForge writes = 0 |
| Technical result | PASS — 28/28 products match seed + SPEC-030 |
| Technical validation commit | `78d3464` |
| Human closure | APPROVED |
| Human closure date | 2026-07-25 |
| Current state | `VALIDATED / CLOSED` |

### IMPL-7 — Checkout initiation

| Field | Value |
|---|---|
| Related requirements | R004-R006, R020, R023-R025, R028, R034-R037, R053 |
| Dependencies | Schema/access/catalog validated; Mercado Pago sandbox authorization |
| Anticipated files | `insforge/functions/mp-create-checkout/**`; `_shared/checkout/**`; `0005_checkout_start_transaction.sql`; unit tests; evidence |
| External resources | InsForge functions; Mercado Pago Checkout Pro (server-side preference client) |
| Blocking open decisions | Remaining open ODs handled fail-closed via required server env (hold TTL, return URLs, waiver, sales_open_at); sales not opened |
| Scope | TX-1 local durable checkout, hold, order-holder capability mint, preference request |
| Out of scope | Webhook effects, roster completion, ticket issuance, landing redesign, opening sales |
| Automated tests | Vitest checkout suite (payload, sales gate, pricing, config, MP mock, compensation, replay) |
| Manual tests | Remote negative smoke `SALES_NOT_OPEN` with zero transactional rows / zero preferences |
| Expected evidence | `docs/implementation/evidence/IMPL-7-CHECKOUT-START-IMPLEMENTATION-VALIDATION.md` |
| Rollback | Delete/redeploy function; drop RPCs from 0005; catalog untouched |
| Entry gate | Schema/access/catalog validated; separate IMPL-7 authorization |
| Exit gate | `CHECKOUT_READY_FOR_WEBHOOK` |
| Separate human authorization | Required |
| Remote artifacts | function `mp-create-checkout`; migration `v5 checkout-start-transaction` |
| Technical result | PASS — smoke `SALES_NOT_OPEN`; MP preferences created = 0 |
| Current state | `TECHNICAL_PASS / PENDING HUMAN CLOSURE` |

### IMPL-8 — Webhook and payment effects

| Field | Value |
|---|---|
| Related requirements | R007, R026-R028, R038, R047, R053, R055 |
| Dependencies | IMPL-7; webhook authorization |
| Anticipated files | future webhook/payment functions/tests |
| External resources | InsForge functions; Mercado Pago sandbox webhook |
| Blocking open decisions | API-OD-001/002/003/005/006/007 |
| Scope | Signature-before-receipt, durable verification staging, atomic domain/audit/outbox |
| Out of scope | Landing, seed, production credentials |
| Automated tests | Invalid signature, duplicate, out-of-order, mismatch, async retry, ingress rate/size |
| Manual tests | Sandbox webhook delivery review |
| Expected evidence | Payment-effect matrix PASS; one logical effect |
| Rollback | Disable ingress effects; reconcile from durable verification records |
| Entry gate | IMPL-7; webhook authorization; listed API-OD resolved |
| Exit gate | `PAYMENT_EFFECTS_VALIDATED` |
| Separate human authorization | Required |
| Current state | `NOT_STARTED / NOT AUTHORIZED` |

### IMPL-9 — Public order state

| Field | Value |
|---|---|
| Related requirements | R020, R023-R028, R036, R044-R045, R053 |
| Dependencies | IMPL-8 |
| Anticipated files | future order-state service/tests |
| External resources | InsForge database/functions |
| Blocking open decisions | API-OD-001/002/003/004/005/007/010; OD-018/019 where public support/folio enabled |
| Scope | Opaque order capability reads, public projections, no-store/privacy |
| Out of scope | Admin panel, check-in, landing redesign |
| Automated tests | Auth, projections, polling/enumeration/rate, privacy |
| Manual tests | Buyer capability walkthrough |
| Expected evidence | Order-state matrix PASS |
| Rollback | Disable public read; revoke capabilities; preserve canonical data |
| Entry gate | IMPL-8; listed decisions resolved where features enabled |
| Exit gate | `ORDER_STATE_READY` |
| Separate human authorization | Required |
| Current state | `NOT_STARTED` |

### IMPL-10 — Teams and invitations

| Field | Value |
|---|---|
| Related requirements | R017-R022, R039-R040, R043-R045, R053-R054 |
| Dependencies | Catalog/payment foundations; email provider decision when delivery enabled |
| Anticipated files | future roster/capability services/tests |
| External resources | InsForge database/functions; email provider after decision |
| Blocking open decisions | OD-003-006/008/009/011/017/021 and API-OD-001/002/003/004/005/007/008, or optional path disabled |
| Scope | Fixed slots, captain/invitee registrations, code-to-capability exchange, complete 2/4 ticket-set issuance |
| Out of scope | Landing UI polish, production email without provider decision |
| Automated tests | Exchange/replay, rate/enumeration, waivers, substitution history, ticket-set issuance |
| Manual tests | Doubles and Relay invitation walkthrough |
| Expected evidence | Roster lifecycle matrix PASS |
| Rollback | Disable invites/substitutions; revoke affected generations |
| Entry gate | Listed decisions resolved or path disabled |
| Exit gate | `ROSTER_READY_FOR_TICKETS` |
| Separate human authorization | Required |
| Current state | `NOT_STARTED` |

### IMPL-11 — Tickets and QR

| Field | Value |
|---|---|
| Related requirements | R008, R020, R029-R030, R046, R053-R054 |
| Dependencies | IMPL-8/9/10 as applicable |
| Anticipated files | future entitlement/capability services/tests |
| External resources | InsForge database/functions |
| Blocking open decisions | OD-019/020 and API-OD-001/002/003/004/005/007/010 for enabled behavior |
| Scope | Canonical ticket, credential generation, daily entitlement use, opaque QR, revoke/reissue |
| Out of scope | Check-in hardware, results, admin panel |
| Automated tests | J1-J5 counts; one active credential/capability; privacy/rate; buyer access policy |
| Manual tests | QR opacity and reissue walkthrough |
| Expected evidence | Ticket/QR matrix PASS |
| Rollback | Revoke affected credential/capability generation; disable issuance; preserve canonical ticket/unused entitlements |
| Entry gate | IMPL-8/9/10 as applicable; listed decisions resolved for enabled behavior |
| Exit gate | `TICKETS_READY_FOR_E2E` |
| Separate human authorization | Required |
| Current state | `NOT_STARTED` |

### IMPL-12 — Sandbox end-to-end

| Field | Value |
|---|---|
| Related requirements | All implemented requirements for enabled launch scope |
| Dependencies | IMPL-1..11 validated; explicit sandbox authorization |
| Anticipated files | test fixtures/reports only |
| External resources | InsForge test environment; Mercado Pago sandbox |
| Blocking open decisions | Any remaining implementation blockers for enabled paths |
| Scope | J1-J5 checkout/webhook/roster/ticket; concurrency/recovery |
| Out of scope | Production cutover, landing redesign, unpaid invoice/runtime secrets |
| Automated tests | End-to-end sandbox suite |
| Manual tests | Owner sandbox acceptance checklist |
| Expected evidence | Sandbox E2E report PASS |
| Rollback | Stop release; clean test data through approved process |
| Entry gate | IMPL-1-11 validated; explicit sandbox authorization |
| Exit gate | `SANDBOX_E2E_VALIDATED` |
| Separate human authorization | Required |
| Current state | `NOT_STARTED` |

## E. Traceability matrix

Every implementation unit requires separate human authorization.
Current states are recorded independently in each unit above; this document
does not authorize any unit by itself. Requirement-row states below remain
row-local and must not be read as a single global unit status.

| Requirement | Source authority | Implementation unit | Anticipated artifact | Validation | Evidence | Current state |
|---|---|---|---|---|---|---|
| R001-R003 | SPEC-001/031; SPEC-032 | IMPL-2, IMPL-4, IMPL-7..11 | Canonical IDs, opaque refs, service boundaries | Auth/ID matrix | AC001-AC002, AC014, AC018 | NOT_STARTED |
| R004-R005 | SPEC-030/031 | IMPL-2, IMPL-3, IMPL-7, IMPL-8 | Integer MXN columns; snapshot totals | Money invariant tests | AC004, AC007-AC008 | NOT_STARTED |
| R006 | SPEC-030/031 | IMPL-2, IMPL-7, IMPL-10 | Buyer/payer/access-holder associations | Identity relation tests | AC001-AC002, AC009, AC014 | NOT_STARTED |
| R007 | SPEC-001/031 | IMPL-3, IMPL-8 | Webhook/idempotency uniqueness | Duplicate webhook tests | AC008, AC013 | NOT_STARTED |
| R008-R010 | SPEC-001/030/031 | IMPL-3, IMPL-4, IMPL-10, IMPL-11 | Registrations, tickets, service boundary | Ticket-set and anonymous-write tests | AC005-AC006, AC009, AC011, AC014-AC015, AC018 | NOT_STARTED |
| R011-R016 | SPEC-032 | IMPL-2 | Event/day/product/buyer/participant/sensitive-profile schema | Entity inventory | AC001 | NOT_STARTED |
| R017-R022 | SPEC-032 | IMPL-2, IMPL-10 | Registration/team/member/capability/waiver schema and services | Roster/capability/waiver tests | AC001-AC002, AC009-AC010 | NOT_STARTED |
| R023-R028 | SPEC-032 | IMPL-2, IMPL-3, IMPL-7, IMPL-8, IMPL-9 | Order/item/hold/payment/webhook/idempotency | Checkout/webhook/order-state tests | AC004, AC007-AC008, AC012-AC013 | NOT_STARTED |
| R029-R032 | SPEC-032 | IMPL-2, IMPL-8, IMPL-11 | Ticket/entitlement/audit/outbox | Ticket and outbox tests | AC001, AC014-AC015 | NOT_STARTED |
| R033 | SPEC-032 | IMPL-3 | Cardinality/forbidden-state constraints | Constraint suite | AC002 | NOT_STARTED |
| R034-R035 | SPEC-030/031 | IMPL-3, IMPL-5, IMPL-6, IMPL-7 | Capacity units and money invariants | Catalog + checkout money tests | AC003-AC005, AC011 | PARTIAL — IMPL-6 catalog evidence PASS; checkout/runtime pending |
| R036 | SPEC-030/031 | IMPL-7..11 | State machines | Transition coverage | AC006, AC010, AC012 | NOT_STARTED |
| R037 | SPEC-031 | IMPL-7 | TX-1 durable-before-provider | Timeout/lost-response tests | AC007, AC015 | PARTIAL — mp-create-checkout + 0005 RPC + negative smoke PASS; sales not open; webhook pending IMPL-8 |
| R038 | SPEC-001/031 | IMPL-8 | TX-2 signature/verification/effects | Webhook effect matrix | AC008, AC015 | NOT_STARTED |
| R039 | SPEC-030/031 | IMPL-10 | TX-3 exchange + completion + full ticket set | Invitation lifecycle matrix | AC005, AC009, AC015 | NOT_STARTED |
| R040 | SPEC-030/031 | IMPL-10, IMPL-11 | TX-4 substitution | Substitution matrix | AC010, AC015 | NOT_STARTED |
| R041-R042 | SPEC-030/031 | IMPL-3, IMPL-7, IMPL-8 | Last-unit concurrency; late payment review | Concurrency/late-payment tests | AC011-AC012 | NOT_STARTED |
| R043 | SPEC-031/032 | IMPL-3 | Uniqueness across generations/namespaces | Uniqueness suite | AC002, AC008-AC009, AC013 | NOT_STARTED |
| R044-R045 | SPEC-001/031 | IMPL-4, IMPL-9..11 | Access boundaries and data classes | Access/privacy matrix | AC014, AC018 | NOT_STARTED |
| R046-R047 | SPEC-001/031 | IMPL-8, IMPL-11 | Opaque QR; durable audit/outbox | QR and audit/outbox tests | AC008, AC014-AC015 | NOT_STARTED |
| R048 | SPEC-030/seed | IMPL-1, IMPL-5, IMPL-6 | Seed correction and later apply | Seed finding closure; 28-product apply + read-only confirm | AC003, AC016 | PASS — catalog seed path closed under IMPL-5/IMPL-6; commerce runtime still out of scope |
| R049 | SPEC-000/030/031 | IMPL-0 (documentary) | Open-decision parity | Decision matrix review | AC017 | NOT_STARTED (planning complete in this doc; no decision resolved) |
| R050 | SPEC-030/031 | IMPL-1, IMPL-2, IMPL-5, IMPL-6 | Shared 28-product configuration | Catalog validators | AC003, AC005 | PASS — shared 28-product catalog validated read-only; checkout/API still out of scope |
| R051 | SPEC-032 | IMPL-0..12 | Gated unit plan | This document | AC017 | NOT_STARTED for runtime; documentary planning present |
| R052 | SPEC-032 | IMPL-0 | Protected-path discipline | Git/path evidence | AC018 | NOT_STARTED for future units; IMPL-0 scope limited to docs |
| R053 | SPEC-031 | IMPL-4, IMPL-7..11 | Abuse/rate profiles | Rate/enumeration tests | AC014 | NOT_STARTED |
| R054 | SPEC-032/031 | IMPL-2, IMPL-3, IMPL-10, IMPL-11 | TicketCredentialGeneration | Credential generation tests | AC001-AC002, AC005, AC009-AC010, AC013-AC014 | NOT_STARTED |
| R055 | SPEC-032/031 | IMPL-2, IMPL-8 | PaymentVerificationRecord | Verification staging/rollback tests | AC001-AC002, AC008, AC015 | NOT_STARTED |

## F. Open decisions

Imported from SPEC-032 Appendix K. None are resolved by IMPL-0.

```text
MODEL_BLOCKER: 0
```

| Decision | Classification | First blocked unit | Can the path be disabled? | Responsible | Required before |
|---|---|---|---|---|---|
| OD-001 Multiple units | IMPLEMENTATION_BLOCKER | IMPL-7 | Yes; keep quantity=1 | Project Owner | Multi-unit enablement / IMPL-7 if enabled |
| OD-002 Mixed cart | IMPLEMENTATION_BLOCKER | IMPL-7 | Yes; single-item checkout | Project Owner | Cart enablement |
| OD-003 Buyer ≠ participant | IMPLEMENTATION_BLOCKER | IMPL-7 / IMPL-10 | Yes; force same-person path | Project Owner | Third-party purchase path |
| OD-004 Exact fields by journey | IMPLEMENTATION_BLOCKER | IMPL-7 / IMPL-10 | No for any collecting path | Project Owner | First data-collecting runtime unit |
| OD-005 Waiver content/version | PRODUCTION_BLOCKER | IMPL-7 / IMPL-10 | No for journeys requiring waiver | Owner/Legal | Production eligibility |
| OD-006 Minors | PRODUCTION_BLOCKER | IMPL-7 / IMPL-10 | Yes; adults-only launch | Owner/Legal | Minor path / production |
| OD-007 Refund policy | PRODUCTION_BLOCKER | IMPL-8 / IMPL-12 | Base path can omit automated refunds | Project Owner | Production finance actions |
| OD-008 Substitution policy | IMPLEMENTATION_BLOCKER | IMPL-10 | Yes; disable substitutions | Project Owner | Substitution enablement |
| OD-009 Roster-change deadline | PRODUCTION_BLOCKER | IMPL-10 | Base roster can ship without deadline if substitutions disabled | Project Owner | Production substitution ops |
| OD-010 Hold duration/late policy | IMPLEMENTATION_BLOCKER | IMPL-7 | No for checkout holds | Project Owner | IMPL-7 |
| OD-011 Invitation duration | IMPLEMENTATION_BLOCKER | IMPL-10 | No for invitation path | Project Owner | IMPL-10 |
| OD-012/013 Discounts/coupons | NON_BLOCKING | None if disabled | Yes | Project Owner | Promotion enablement |
| OD-014 MSI | PRODUCTION_BLOCKER | IMPL-7 disclosure/config | Yes; disable MSI | Project Owner | MSI production |
| OD-015 Cash | PRODUCTION_BLOCKER | IMPL-7 | Yes; MP-only launch | Project Owner | Cash path |
| OD-016 Return domain/URLs | IMPLEMENTATION_BLOCKER | IMPL-7 | No for Checkout Pro return | Project Owner | IMPL-7 |
| OD-017 Email provider | IMPLEMENTATION_BLOCKER | IMPL-10 delivery | Yes for dry-run; no for real delivery | Project Owner | Delivery-enabled units |
| OD-018 Support/escalation | PRODUCTION_BLOCKER | IMPL-9 where support surfaced | Operator recovery can remain manual | Project Owner | Production support |
| OD-019 Folio format | IMPLEMENTATION_BLOCKER | IMPL-9 / IMPL-11 | No once public folio exposed | Project Owner | Public folio exposure |
| OD-020 Three-day mechanics | IMPLEMENTATION_BLOCKER | IMPL-11 | Single-day products can proceed; 3-day needs decision | Project Owner | PUB-3D/FOT-3D final behavior |
| OD-021 Photographer requirements | IMPLEMENTATION_BLOCKER | IMPL-10 / IMPL-11 | Yes; defer press path | Project Owner | Press path |
| OD-022 Saturday label / SEED-003 | APPROVED 2026-07-24 | IMPL-5A / IMPL-5 | Resolved; approved label includes `Sábado 10`; remote seed applied under IMPL-5 | Project Owner | Closed for catalog seed path |
| OD-023 Sales opening | PRODUCTION_BLOCKER | IMPL-7 sale-state transitions | Model fields exist; opening remains owner decision | Project Owner | Sales open |
| OD-024 Low availability threshold | IMPLEMENTATION_BLOCKER | IMPL-9 signal | Yes; disable LOW_AVAILABILITY | Project Owner | Low-stock signal |
| API-OD-001 Endpoint/transport layout | IMPLEMENTATION_BLOCKER | IMPL-7 | No for public HTTP surface | Engineering | First public API unit |
| API-OD-002 Exact HTTP statuses | IMPLEMENTATION_BLOCKER | IMPL-7 | No for public client contract | Engineering | First public API unit |
| API-OD-003 Idempotency TTL/storage | IMPLEMENTATION_BLOCKER | IMPL-7 | No for effectful public commands | Project Owner/Engineering | IMPL-7 |
| API-OD-004 Capability lifetime/transport | IMPLEMENTATION_BLOCKER | IMPL-4 / IMPL-7 | No for continuation auth | Project Owner/Engineering | Capability-bearing units |
| API-OD-005 Correlation/telemetry backend | IMPLEMENTATION_BLOCKER | IMPL-4 / IMPL-8 | Documentary model neutral; runtime needs choice | Project Owner/Engineering | Observability-bearing units |
| API-OD-006 Async webhook mechanism | IMPLEMENTATION_BLOCKER | IMPL-8 | No for reliable webhook processing | Engineering | IMPL-8 |
| API-OD-007 Retention/deletion/anonymization | PRODUCTION_BLOCKER | IMPL-4 / IMPL-8 | Configuration required before production data retention claims | Project Owner | Production privacy |
| API-OD-008 Invite rotate vs reuse | IMPLEMENTATION_BLOCKER | IMPL-10 | No for resend path | Project Owner | IMPL-10 |
| API-OD-009 Hold after preference failure | IMPLEMENTATION_BLOCKER | IMPL-7 | No for checkout compensation | Project Owner | IMPL-7 |
| API-OD-010 Buyer access to others' tickets | IMPLEMENTATION_BLOCKER | IMPL-9 / IMPL-11 | Yes; holder-only access | Project Owner | Buyer ticket access |

IMPL-1 and IMPL-2 are not blocked by NON_BLOCKING decisions. IMPL-1 is blocked
only by the explicit Saturday-label decision (OD-022 / SEED-003) plus separate
human authorization. IMPL-2 is not blocked by OD-022 once IMPL-1 has closed.

## G. Protected boundaries

The following remain intact under IMPL-0 and must stay untouched unless a later
authorized unit explicitly includes them:

```text
src/
public/
assets/
components/
pages/
routes/
styles/
insforge/seeds/0002_seeds_hybrid_event.sql
insforge/migrations/
.cursor/mcp.env
InsForge resources
Mercado Pago resources
```

Seed existence/hash may be read for evidence. Seed content must not be modified
in IMPL-0.

```text
Seed hash verified during IMPL-0: 20d73e626981604da65e1ea34dc1a03b37f0845f
```

## H. Next recommended unit

```text
IMPL-7 human closure review
Status: AWAITING HUMAN CLOSURE
```

IMPL-7 technical validation is PASS under authorized checkout-start scope.
Do not mark IMPL-7 `VALIDATED / CLOSED` until human closure. Do not start IMPL-8.
Do not open sales or connect the landing.

## I. IMPL-0 change set

Authorized documentary files for this preparation unit:

```text
docs/specs/SPEC-032-MINIMAL-SALES-DATA-MODEL-AND-TRANSACTION-INTEGRITY.md
docs/specs/README.md
WORKSPACE_STATUS.md
docs/implementation/IMPL-0-SALES-IMPLEMENTATION-TRACEABILITY.md
```

Commit and push remain unauthorized until the Project Owner issues a separate
instruction.

## J. Gate

```text
READY_FOR_IMPL_7_HUMAN_CLOSURE
```

IMPL-4 closure evidence (local):

```text
IMPL-4: VALIDATED
ACCESS-DEC-001..008: APPROVED
SQL commit: cbbeecc
Evidence: docs/implementation/evidence/IMPL-4-RLS-AND-ACCESS-LIMITS-VALIDATION.md
Migration 0001 blob: 99b1964b65b9590ec2f3a909e200d09457559ec5
Migration 0002 blob: 24622ab0787c4952799cde2bd93784627b39ef53
Migration 0003 blob: d2c3778364cae4cada03c8a7e3d5b6b6f6365dbd
```

InsForge remote schema deployment evidence:

```text
Canonical InsForge project: ready2hybrid
Host: 4bg9ufz2.us-east
Deployment slug: enforma
0001 remote: DEPLOYED AND VALIDATED
0002 remote: DEPLOYED AND VALIDATED
0003 remote: DEPLOYED AND VALIDATED
Evidence: docs/implementation/evidence/INSFORGE-SCHEMA-DEPLOYMENT-VALIDATION.md
```

IMPL-5A catalog seed alignment evidence:

```text
OD-022: APPROVED
Approved at: 2026-07-24
Approved label:
Sábado 10 — ½ Hybrid, Dobles y Workout por la mañana; Relay por la tarde.
Previous seed blob: f8989b2c10bb04fe258b19bf646dd650940c4944
New seed blob: 530bdde721f636c703cbc13929adda94036b12ee
New seed SHA-256: 5f115f8cf112638dce4eba72e3d61825853c373e86d5a85cf8d9bbfd62a688ad
Catalog seed: ALIGNED AND LOCALLY VALIDATED
Evidence: docs/implementation/evidence/IMPL-5-CATALOG-SEED-PREPARATION-VALIDATION.md
```

IMPL-5 remote catalog seed execution evidence:

```text
IMPL-5: VALIDATED
Remote migration: v4 hybrid-event-catalog
Seed blob applied: 530bdde721f636c703cbc13929adda94036b12ee
Seed SHA-256: 5f115f8cf112638dce4eba72e3d61825853c373e86d5a85cf8d9bbfd62a688ad
Remote catalog: events=1, event_days=3, products=28
Event status: CONFIGURADO
Field mismatches vs seed: 0
Security unchanged: RLS 24 / FORCE 24 / PUBLIC 0 / policies 0
Remote writes in unit: 1
Evidence: docs/implementation/evidence/IMPL-5-CATALOG-SEED-REMOTE-EXECUTION-VALIDATION.md
```

IMPL-6 read-only catalog validation evidence:

```text
IMPL-6: VALIDATED / CLOSED
Technical validation commit: 78d3464
Human closure: APPROVED 2026-07-25
Mode: READ_ONLY
InsForge writes during technical unit: 0
InsForge reads/writes during human closure: 0
Remote catalog: events=1, event_days=3, products=28
Field mismatches vs seed: 0
Blocks: COMPITE 13 / EXPERIENCE 7 / ASISTE 8
Journeys: J1 6 / J2 9 / J3 3 / J4 2 / J5 8
Evidence: docs/implementation/evidence/IMPL-6-28-PRODUCTS-READ-ONLY-VALIDATION.md
```

IMPL-7 checkout start evidence:

```text
IMPL-7: TECHNICAL_PASS / PENDING HUMAN CLOSURE
Function: mp-create-checkout
Remote migration: v5 checkout-start-transaction
Smoke: SALES_NOT_OPEN (event remains CONFIGURADO)
Transactional rows after smoke: 0
Mercado Pago preferences created: 0
Evidence: docs/implementation/evidence/IMPL-7-CHECKOUT-START-IMPLEMENTATION-VALIDATION.md
IMPL-8: NOT_STARTED / NOT AUTHORIZED
Gate: READY_FOR_IMPL_7_HUMAN_CLOSURE
LANDING_READY_FOR_READY2HYBRID_MATCH
```

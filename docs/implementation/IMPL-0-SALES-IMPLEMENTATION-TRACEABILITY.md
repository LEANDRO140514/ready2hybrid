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
| Technical implementation commit | `3f13c16` |
| Human closure | APPROVED |
| Human closure date | 2026-07-25 |
| Blockers | None |
| Current state | `VALIDATED / CLOSED` |

### IMPL-8 — Webhook and payment effects

| Field | Value |
|---|---|
| Related requirements | R007, R026-R028, R038, R047, R053, R055 |
| Dependencies | IMPL-7; webhook authorization |
| Anticipated files | `insforge/functions/mp-webhook/**`; `_shared/mercadopago/**`; `_shared/webhook/**`; `0006_webhook_payment_transaction.sql`; unit tests; evidence |
| External resources | InsForge functions; Mercado Pago payment query (server-side); webhook secret deferred |
| Blocking open decisions | Real panel webhook URL/secret deferred to IMPL-12/separate unit; API-OD-002 matrix chosen and documented |
| Scope | Signature-before-receipt, durable verification staging, atomic domain/audit/outbox alert (no email send) |
| Out of scope | Landing, seed, tickets/QR, public order state, sandbox E2E, production credentials |
| Automated tests | Signature fixtures, orchestrate matrix, migration static guards |
| Manual tests | Remote negative smokes (405/401/503) with zero transactional rows |
| Expected evidence | `docs/implementation/evidence/IMPL-8-SIGNED-IDEMPOTENT-WEBHOOK-IMPLEMENTATION-VALIDATION.md` |
| Rollback | Delete/disable `mp-webhook`; drop TX-2 RPC; catalog untouched |
| Entry gate | IMPL-7 closed; separate IMPL-8 authorization |
| Exit gate | `PAYMENT_EFFECTS_VALIDATED` |
| Separate human authorization | Required |
| Remote artifacts | function `mp-webhook`; migration `v6 webhook-payment-transaction` |
| Technical result | PASS — negative smokes; MP writes = 0; secret configuration deferred |
| Technical implementation commit | `2379a90` |
| Human closure | APPROVED |
| Human closure date | 2026-07-25 |
| Implementation blockers | None |
| Panel configuration | `DEFERRED / NOT AUTHORIZED` |
| Current state | `VALIDATED / CLOSED` |

### IMPL-9 — Public order state

| Field | Value |
|---|---|
| Related requirements | R020, R023-R028, R036, R044-R045, R053 |
| Dependencies | IMPL-8 |
| Anticipated files | `insforge/functions/get-order-status/**`; `_shared/public-status/**`; unit tests; evidence |
| External resources | InsForge functions (read-only); no Mercado Pago |
| Blocking open decisions | Capability-token tightening (API-OD-004) deferred; panel webhook remains deferred; OD-018/019 not required for minimal status |
| Scope | GET by opaque `tracking_ref` / `public_order_reference`; SPEC-031 public projection; no-store/privacy |
| Out of scope | Landing UI, tickets/QR, MP calls, domain writes, IMPL-10 |
| Automated tests | Reference validation, mapping matrix, orchestrate, static read-only guards |
| Manual tests | Remote negative smokes 405/400/404 with zero transactional rows |
| Expected evidence | `docs/implementation/evidence/IMPL-9-PUBLIC-ORDER-STATUS-IMPLEMENTATION-VALIDATION.md` |
| Rollback | Delete/disable `get-order-status`; no migration |
| Entry gate | IMPL-8 closed; separate IMPL-9 authorization |
| Exit gate | `ORDER_STATE_READY` |
| Separate human authorization | Required |
| Remote artifacts | function `get-order-status` |
| Technical result | PASS — negative smokes; domain writes = 0; MP reads/writes = 0 |
| Technical implementation commit | `d6df04c` |
| Human closure | APPROVED |
| Human closure date | 2026-07-25 |
| Implementation blockers | None |
| Migration 0007 | NOT REQUIRED |
| Current state | `VALIDATED / CLOSED` |

### IMPL-10 — Teams and invitations

| Field | Value |
|---|---|
| Related requirements | R017-R022, R039, R043-R045, R053 |
| Dependencies | IMPL-7/8/9 closed |
| Anticipated files | `insforge/functions/team-roster/**`; `_shared/teams/**`; `0007_team_roster_invitations.sql`; unit tests; evidence |
| External resources | InsForge functions/DB; no Mercado Pago; no email |
| Blocking open decisions | OD-011/005 fail-closed via env; OD-008/017/021 deferred/disabled; API-OD-008 resend out of scope |
| Scope | J2/J3 team shell, opaque invitations, individual waiver accept, eligibility without tickets |
| Out of scope | Landing UI, email/reminders, substitutions, tickets/QR, IMPL-11 |
| Automated tests | Token/privacy/waiver/idempotency/static migration guards |
| Manual tests | Remote negative smokes 405/400/404/503 with zero transactional rows |
| Expected evidence | `docs/implementation/evidence/IMPL-10-TEAM-ROSTER-INVITATIONS-IMPLEMENTATION-VALIDATION.md` |
| Rollback | Disable `team-roster`; revert 0007 RPCs; redeploy prior checkout if needed |
| Entry gate | IMPL-9 closed; separate IMPL-10 authorization |
| Exit gate | `ROSTER_READY_FOR_TICKETS` |
| Separate human authorization | Required |
| Remote artifacts | function `team-roster`; migration v7; checkout redeploy for invitation surface |
| Technical result | PASS — negative smokes; domain rows = 0; MP = 0; tickets = 0 |
| Technical implementation commit | `43f633e` |
| Human closure | APPROVED |
| Human closure date | 2026-07-25 |
| Implementation blockers | None |
| Migration | v7 team-roster-invitations |
| Current state | `VALIDATED / CLOSED` |

### IMPL-11 — Tickets and QR

| Field | Value |
|---|---|
| Related requirements | R008, R020, R029-R030, R046, R053-R054 |
| Dependencies | IMPL-8/9/10 as applicable |
| Anticipated files | `ticket-credentials/**`; `_shared/tickets/**`; `0008_ticket_issuance_credentials.sql`; unit tests; evidence |
| External resources | InsForge database/functions; no Mercado Pago; no email |
| Blocking open decisions | OD-019 commercial folio OPEN (opaque engineering used); OD-020/007/017 fail-closed/deferred; API-OD-010 retrieval deferred |
| Scope | Canonical ticket, hashed QR generation, single-day entitlements, protected revoke/reissue |
| Out of scope | Check-in, manifest, email delivery, public QR retrieval, landing UI, IMPL-12 |
| Automated tests | Token/privacy/reissue/static migration/policy guards |
| Manual tests | Remote negative smokes 405/403/400/404/401 with zero transactional rows |
| Expected evidence | `docs/implementation/evidence/IMPL-11-TICKETS-QR-IMPLEMENTATION-VALIDATION.md` |
| Rollback | Disable `ticket-credentials`; revert 0008 RPCs; preserve catalog/event |
| Entry gate | IMPL-10 closed; separate IMPL-11 authorization |
| Exit gate | `TICKETS_READY_FOR_E2E` |
| Separate human authorization | Required |
| Remote artifacts | function `ticket-credentials`; migration v8; SQL REPLACE webhook/accept (no edge redeploy) |
| Technical result | PASS — negative smokes; domain rows = 0; MP = 0 |
| Technical implementation commit | `9c9daa4` |
| Human closure | APPROVED |
| Human closure date | 2026-07-25 |
| Implementation blockers | None for authorized scope |
| Migration | v8 ticket-issuance-credentials |
| Current state | `VALIDATED / CLOSED` |

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
| Current state | `VALIDATED / CLOSED` (A–D PASS; E deferred; OD-001 approved; Main v10; human closure 2026-07-26 on `9cca6b4`) |

### IMPL-13B — Spectator sandbox wiring + Origin hardening

| Field | Value |
|---|---|
| Related requirements | SPEC-031 public checkout/status; browser Origin defense-in-depth |
| Dependencies | IMPL-12 closed; landing spectator wiring; sandbox branch |
| Anticipated files | edge Origin guard; landing submit lock; evidence |
| External resources | InsForge sandbox `4bg9ufz2-rug`; localhost landing |
| Blocking open decisions | Gateway CORS residual accepted for sandbox by PO |
| Scope | Exact Origin gate before business; atomic submit; sandbox wiring |
| Out of scope | Main EN_VENTA; productive webhook/credentials; gateway replacement |
| Automated tests | `tests/unit/http/origin-guard.test.ts`; landing submit-lock script |
| Manual tests | Sandbox Origin matrices POST/GET/OPTIONS |
| Expected evidence | Origin hardening + human closure |
| Rollback | Revert hardening/submit commits; redeploy prior sandbox functions |
| Entry gate | IMPL-12 closed; IMPL-13B authorized |
| Exit gate | `IMPL_13B_HUMAN_CLOSED` |
| Separate human authorization | Required (granted 2026-07-26) |
| Current state | `VALIDATED / CLOSED` (R2H `0cb8b12` / landing `9b9cf48`; gateway CORS accepted for sandbox) |

### IMPL-13C — Single spectator sandbox E2E

| Field | Value |
|---|---|
| Related requirements | End-to-end J5 spectator path (PUB-VIE) |
| Dependencies | IMPL-13B closed; sandbox branch retained |
| Anticipated files | evidence / local env flags only unless execution unit expands |
| External resources | Sandbox InsForge; MP test buyer/credentials |
| Blocking open decisions | Sandbox sales-state handling during E2E; abuse/rate-limit remains prod blocker |
| Scope | One PUB-VIE sandbox purchase through paid + public status |
| Out of scope | Main EN_VENTA; productive sales/webhook/credentials; multi-product matrix |
| Automated tests | As defined by execution unit |
| Manual tests | Single spectator sandbox checklist |
| Expected evidence | IMPL-13C E2E validation report |
| Rollback | Stop sandbox E2E; restore sandbox transactional cleanliness |
| Entry gate | `READY_FOR_IMPL_13C_SPECTATOR_SANDBOX_E2E` + explicit start |
| Exit gate | `SPECTATOR_SANDBOX_E2E_VALIDATED` |
| Separate human authorization | Required (execution + human closure granted 2026-07-26) |
| Current state | `VALIDATED / CLOSED` (evidence `1de0be2`; op `170714344550`; human closure 2026-07-26) |

### IMPL-13D — Remaining journeys and product decision preflight

| Field | Value |
|---|---|
| Related requirements | Product/journey inventory after PUB-VIE; price alignment; abuse gate status |
| Dependencies | IMPL-13C closed |
| Anticipated files | documentary evidence only |
| External resources | Read-only Main/sandbox status; landing catalog compare |
| Blocking open decisions | Human price option A/B/C; next journey selection |
| Scope | READ_ONLY inventory + decision package for PO |
| Out of scope | Code; price mutation; MP; InsForge writes; IMPL-13E implementation |
| Automated tests | N/A (read-only) |
| Manual tests | Git preflight; catalog/price/journey matrix |
| Expected evidence | Preflight report delivered to PO; feeds IMPL-13D-H |
| Rollback | N/A (no mutations) |
| Entry gate | `READY_FOR_NEXT_AUTHORIZED_UNIT` after IMPL-13C |
| Exit gate | `READY_FOR_IMPL_13D_HUMAN_PRODUCT_DECISION` |
| Separate human authorization | Preflight authorized; closed into IMPL-13D-H |
| Current state | `EXECUTED / CLOSED` (read-only; 2026-07-26) |

### IMPL-13D-H — Product, price, and journey human decisions

| Field | Value |
|---|---|
| Related requirements | Commercial price targets; journey sequencing; IMPL-13E scope |
| Dependencies | IMPL-13D preflight |
| Anticipated files | evidence + WORKSPACE_STATUS + this traceability doc |
| External resources | None (documentary) |
| Blocking open decisions | Resolved by PO 2026-07-26 (OPCIÓN B; IMPL-13E next) |
| Scope | Record OPCIÓN B targets; prepare IMPL-13E; sequence later journeys |
| Out of scope | Main price SQL/seed mutation; IMPL-13E runtime; production open |
| Automated tests | N/A |
| Manual tests | Documentary consistency review |
| Expected evidence | `IMPL-13D-H-PRODUCT-JOURNEY-DECISIONS.md` |
| Rollback | Revert documentary commit only |
| Entry gate | `READY_FOR_IMPL_13D_HUMAN_PRODUCT_DECISION` |
| Exit gate | `READY_FOR_IMPL_13E_PUBLIC_PRESS_SANDBOX_PREPARATION` |
| Separate human authorization | Granted 2026-07-26 |
| Current state | `APPROVED / CLOSED` (2026-07-26) |

### IMPL-13E — Public and press single-day sandbox expansion

| Field | Value |
|---|---|
| Related requirements | J5 single-day public/press beyond PUB-VIE |
| Dependencies | IMPL-13D-H approved; IMPL-13E-0 closed; sandbox `4bg9ufz2-6mq` |
| Anticipated files | landing checkout wiring extensions; sandbox evidence |
| External resources | Sandbox InsForge `impl-13e-public-press`; MP test path |
| Blocking open decisions | None for listed single-day products; OD-020 still blocks *3D* |
| Scope | PUB-SAB, PUB-DOM, FOT-VIE, FOT-SAB, FOT-DOM; reuse confirmando/status/Origin/flags |
| Out of scope | PUB-3D/FOT-3D; WOD/IND/teams; Main EN_VENTA; abuse-gate implementation; Main price changes |
| Automated tests | As defined by execution unit |
| Manual tests | Sandbox expansion checklist per product |
| Expected evidence | IMPL-13E preparation + validation reports |
| Rollback | Disable new product flags; restore prior sandbox wiring |
| Entry gate | `READY_FOR_IMPL_13E_X_PUBLIC_PRESS_WIRING_APPROVAL` + explicit start |
| Exit gate | TBD by execution unit |
| Separate human authorization | Required (granted for IMPL-13E-X wiring + IMPL-13E-Y E2E) |
| Current state | `IMPLEMENTED / TECHNICALLY VALIDATED` (landing); E2E see IMPL-13E-Y |

### IMPL-13E-0 — Multiday checkout fail-closed hardening

| Field | Value |
|---|---|
| Related requirements | OD-020 fail-closed at checkout (not only ticket issuance) |
| Dependencies | IMPL-13D-H; catalog `day` null for PUB-3D/FOT-3D |
| Anticipated files | eligibility helper; orchestrate; catalog day map; tests; evidence |
| External resources | New sandbox branch `impl-13e-public-press` |
| Blocking open decisions | OD-020 remains OPEN (no multiday enablement) |
| Scope | Reject PUB-3D/FOT-3D before idempotency/order/MP; PRODUCT_NOT_AVAILABLE |
| Out of scope | Landing; seeds; migrations; Main deploy; OD-020 resolution |
| Automated tests | `tests/unit/checkout/multiday-checkout-eligibility.test.ts` |
| Manual tests | Sandbox runtime matrix CONFIGURADO |
| Expected evidence | `IMPL-13E-0-MULTIDAY-CHECKOUT-FAIL-CLOSED.md` |
| Rollback | Revert commit; redeploy prior checkout bundle to sandbox only |
| Entry gate | `READY_FOR_IMPL_13E_0_MULTIDAY_FAIL_CLOSED_HARDENING` |
| Exit gate | `READY_FOR_IMPL_13E_X_PUBLIC_PRESS_WIRING_APPROVAL` |
| Separate human authorization | Granted (this unit) |
| Current state | `VALIDATED / CLOSED` |

### IMPL-13E-Y — Public and press sandbox E2E

| Field | Value |
|---|---|
| Related requirements | J5 public/press sandbox payment authority end-to-end |
| Dependencies | IMPL-13E-0; IMPL-13E-X; sandbox `4bg9ufz2-6mq` |
| Anticipated files | evidence only (no feature code) |
| External resources | Sandbox InsForge; MP Checkout Pro test; signed webhook |
| Blocking open decisions | Abuse/rate-limit still blocks production EN_VENTA |
| Scope | PUB-SAB×2 + FOT-VIE×1 + FOT-SAB×1 (R2B) sandbox payments; negative gates; HTTPS return; artifacts; rollback |
| Out of scope | Main EN_VENTA; other products; real money; code changes |
| Automated tests | Repo gates PASS without technical diff |
| Manual tests | Three sandbox Checkout Pro approvals (incl. HTTPS auto-return) |
| Expected evidence | `IMPL-13E-Y-PUBLIC-PRESS-SANDBOX-E2E.md`; R2A/R2B evidence; `IMPL-13E-Y-HUMAN-CLOSURE.md` |
| Rollback | Sandbox event → CONFIGURADO (done); retain TX evidence |
| Entry gate | `READY_FOR_IMPL_13E_Y_PUBLIC_PRESS_SANDBOX_E2E_APPROVAL` |
| Exit gate | human closed → `READY_FOR_IMPL_13E_POST_CLOSURE_PRIORITY_DECISION` |
| Separate human authorization | Granted (this unit) · human closure 2026-07-27 |
| Current state | `VALIDATED / CLOSED` |

### IMPL-13E-Y-R2A — HTTPS preview and confirming page validation

| Field | Value |
|---|---|
| Related requirements | Return-flow evidence for IMPL-13E-Y human closure |
| Dependencies | IMPL-13E-Y paid refs; landing `b4f50c0`; sandbox `4bg9ufz2-6mq` |
| Anticipated files | evidence + status/traceability docs only |
| External resources | InsForge landing preview (`3e9sriq7`); sandbox CORS/back URLs |
| Scope | Local+HTTPS confirming with existing APPROVED refs; preview deploy; CORS/back URLs; MP format check |
| Out of scope | New preference/payment; EN_VENTA; code/function changes; productive domain |
| Expected evidence | `IMPL-13E-Y-R2A-HTTPS-RETURN-PREPARATION.md` |
| Entry gate | `READY_FOR_IMPL_13E_Y_R2_RETURN_FLOW_APPROVAL` |
| Exit gate | `READY_FOR_SINGLE_HTTPS_RETURN_PAYMENT_APPROVAL` |
| Separate human authorization | Granted |
| Current state | `EXECUTED / CLOSED INTO R2B` |

### IMPL-13E-Y-R2B — Single HTTPS auto-return sandbox payment

| Field | Value |
|---|---|
| Related requirements | Prove MP `auto_return` to HTTPS preview confirming |
| Dependencies | R2A preview + CORS/back URLs; sandbox `4bg9ufz2-6mq` |
| Scope | One FOT-SAB×1 sandbox payment; webhook; confirming with `?ref=` |
| Out of scope | Code changes; Main EN_VENTA; additional products |
| Expected evidence | `IMPL-13E-Y-R2B-HTTPS-AUTO-RETURN-PAYMENT.md` |
| Entry gate | `READY_FOR_SINGLE_HTTPS_RETURN_PAYMENT_APPROVAL` |
| Exit gate | `READY_FOR_IMPL_13E_Y_HUMAN_CLOSURE_REVIEW` → Y human-closed |
| Separate human authorization | Granted (PO “vamos a hacerlo”) |
| Current state | `EXECUTED / HUMAN-ACCEPTED INTO Y CLOSURE` |
| Open gap retained | `RETURN_REFERENCE_RESILIENCE` (non-blocking for Y closure) |

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
| R038 | SPEC-001/031 | IMPL-8 | TX-2 signature/verification/effects | Webhook effect matrix | AC008, AC015 | PARTIAL — mp-webhook + 0006 RPC + negative smokes PASS; panel secret deferred; tickets/public order pending later units |
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
Next unit: IMPL-13E-Y — Public and press sandbox E2E
Gate: READY_FOR_IMPL_13E_Y_PUBLIC_PRESS_SANDBOX_E2E_APPROVAL
Products: PUB-SAB (+qty) and FOT-VIE suggested for paid E2E
Sandbox: impl-13e-public-press / 4bg9ufz2-6mq
Recommended production blocker remaining:
PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING
```

IMPL-12, IMPL-13B, and IMPL-13C are `VALIDATED / CLOSED` (human 2026-07-26).
IMPL-13D-H is `APPROVED / CLOSED` (human 2026-07-26): OPCIÓN B commercial
target prices (landing-visible); Main canonical price update pending a
separate unit; IMPL-13E prepared for single-day public/press sandbox;
WOD/individual/teams remain later (not cancelled); PUB-3D/FOT-3D fail-closed
pending OD-020. IMPL-13C accepted PUB-VIE sandbox path through op
`170714344550`, signed webhook `PAID`, `get-order-status` `APPROVED`, and
technical evidence `1de0be2`. Visual MP success capture is complementary
only. Provider `live_mode=true` remains a recorded discrepancy, not
productive authorization. Main remains CONFIGURADO / v1–v10 / functions 5.
Do not open productive sales, configure productive webhook/credentials, or
connect the landing to productive sales. Before production, close
`PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING`. Reminders, email, and public QR
retrieval remain deferred. Multiday remains fail-closed. Offline manifesto
and check-in remain not implemented.

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
READY_FOR_IMPL_13E_Y_PUBLIC_PRESS_SANDBOX_E2E_APPROVAL
IMPL_12_HUMAN_CLOSED
IMPL_13B_HUMAN_CLOSED
IMPL_13C_HUMAN_CLOSED
IMPL_13D_H_APPROVED_CLOSED
IMPL_13E_0_VALIDATED_CLOSED
IMPL_13E_X_TECHNICALLY_VALIDATED
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
IMPL-7: VALIDATED / CLOSED
Technical implementation commit: 3f13c16
Human closure: APPROVED 2026-07-25
Function: mp-create-checkout
Remote migration: v5 checkout-start-transaction
Smoke: SALES_NOT_OPEN (event remains CONFIGURADO)
Transactional rows after smoke: 0
Mercado Pago preferences created: 0
Blockers: None
Evidence: docs/implementation/evidence/IMPL-7-CHECKOUT-START-IMPLEMENTATION-VALIDATION.md
```

IMPL-8 signed webhook evidence:

```text
IMPL-8: VALIDATED / CLOSED
Technical implementation commit: 2379a90
Human closure: APPROVED 2026-07-25
Function: mp-webhook
Remote migration: v6 webhook-payment-transaction
Smokes: 405 / 401 / 503 WEBHOOK_NOT_CONFIGURED
Transactional rows after smoke: 0
Mercado Pago writes: 0
Implementation blockers: None
Panel webhook secret/URL: DEFERRED / NOT AUTHORIZED
Evidence: docs/implementation/evidence/IMPL-8-SIGNED-IDEMPOTENT-WEBHOOK-IMPLEMENTATION-VALIDATION.md
IMPL-9: VALIDATED / CLOSED
Technical implementation commit: d6df04c
Human closure: APPROVED
Human closure date: 2026-07-25
Implementation blockers: None
Migration 0007: NOT REQUIRED
Function: get-order-status
Smokes: 405 / 400 / 400 / 404
Transactional rows after smoke: 0
Mercado Pago reads/writes: 0
Evidence: docs/implementation/evidence/IMPL-9-PUBLIC-ORDER-STATUS-IMPLEMENTATION-VALIDATION.md
IMPL-10: VALIDATED / CLOSED
Technical implementation commit: 43f633e
Human closure: APPROVED
Human closure date: 2026-07-25
Implementation blockers: None
Migration: v7 team-roster-invitations
Function: team-roster
Checkout redeploy: justified (invitation TTL + roster_invitations)
Smokes: 405 / 400 / 400 / 404 / 503 WAIVER_CONFIGURATION_REQUIRED
Transactional rows after smoke: 0
Mercado Pago reads/writes: 0
Reminders: DEFERRED / NOT AUTHORIZED
Evidence: docs/implementation/evidence/IMPL-10-TEAM-ROSTER-INVITATIONS-IMPLEMENTATION-VALIDATION.md
IMPL-11: VALIDATED / CLOSED
Technical implementation commit: 9c9daa4
Human closure: APPROVED
Human closure date: 2026-07-25
Implementation blockers: None for authorized scope
Migration: v8 ticket-issuance-credentials
Function: ticket-credentials
Webhook/team-roster edge redeploy: 0 (SQL-only issuance hooks)
Smokes: 405 / 403 / 400 / 404 / 401 / 401 / 404
Transactional rows after smoke: 0
Mercado Pago reads/writes: 0
OD-019 commercial folio: OPEN
OD-020 multiday: OPEN / FAIL-CLOSED
Email/public retrieval: DEFERRED / NOT AUTHORIZED
Check-in/manifest: NOT IMPLEMENTED / NOT AUTHORIZED
Evidence: docs/implementation/evidence/IMPL-11-TICKETS-QR-IMPLEMENTATION-VALIDATION.md
IMPL-12: VALIDATED / CLOSED
IMPL-12 Main migrations: v1–v10 (0010 spectator-multi-quantity applied on Main)
IMPL-12 Case A–D: PASS · Case E: DEFERRED_FROM_INITIAL_LAUNCH
OD-001: APPROVED (spectator quantity ≥ 1)
OD-PENDING: D (async methods deferred; CONT not stable)
Human closure: 2026-07-26 · evidence through 9cca6b4 · IMPL_12_HUMAN_CLOSED
Evidence: docs/implementation/evidence/IMPL-12-CANONICAL-V10-DEPLOYMENT.md
Prior: docs/implementation/evidence/IMPL-12-CASE-C-SPECTATOR-QUANTITY-VALIDATION.md
Prior: docs/implementation/evidence/IMPL-12-REMAINING-CASES-VALIDATION.md
Prior: docs/implementation/evidence/IMPL-12-R4-CASE-A-TTL-REVALIDATION.md
Prior: docs/implementation/evidence/IMPL-12-R3-WEBHOOK-PAYMENT-ORDER-FIX.md
Prior: docs/implementation/evidence/IMPL-12-SANDBOX-END-TO-END-RETRY-VALIDATION.md
Prior: docs/implementation/evidence/IMPL-12-R1-MP-CHECKOUT-DIAGNOSTIC.md
Prior: docs/implementation/evidence/IMPL-12-SANDBOX-END-TO-END-VALIDATION.md
IMPL-13B: VALIDATED / CLOSED
Technical: Ready2Hybrid 0cb8b12 · Landing 9b9cf48
Sandbox: impl-13b-spectator-wiring / 4bg9ufz2-rug
Gateway CORS residual: ACCEPTED FOR SANDBOX
Application Origin gate: RETAINED (fail-closed; ≠ authentication)
Human closure: 2026-07-26 · IMPL_13B_HUMAN_CLOSED
Evidence: docs/implementation/evidence/IMPL-13B-HUMAN-CLOSURE.md
Prior: docs/implementation/evidence/IMPL-13B-R2-APPLICATION-ORIGIN-HARDENING.md
IMPL-13C: VALIDATED / CLOSED
Technical evidence: 1de0be2
Operation: 170714344550 · PUB-VIE · $250 · Mercadopago*fake
Webhook PAID · get-order-status APPROVED · canonical InsForge artifacts validated
Human closure: 2026-07-26 · IMPL_13C_HUMAN_CLOSED
Evidence: docs/implementation/evidence/IMPL-13C-HUMAN-CLOSURE.md
Prior: docs/implementation/evidence/IMPL-13C-SPECTATOR-SANDBOX-E2E-VALIDATION.md
IMPL-13D: EXECUTED / CLOSED (read-only preflight)
IMPL-13D-H: APPROVED / CLOSED
Price decision: OPCIÓN B (landing targets; Main update PENDING separate unit)
Targets MXN: WOD 350 · IND 1500 · HALF-IND 850 · DOB 2500 · HALF-DOB 1700 · REL 3400
Next: IMPL-13E (PUB-SAB, PUB-DOM, FOT-VIE, FOT-SAB, FOT-DOM)
Out of IMPL-13E: WOD/IND/teams (later) · PUB-3D/FOT-3D fail-closed (OD-020)
Evidence: docs/implementation/evidence/IMPL-13D-H-PRODUCT-JOURNEY-DECISIONS.md
IMPL-13E-0: VALIDATED / CLOSED
Policy: spectator/press with day IS NULL → PRODUCT_NOT_AVAILABLE before writes/MP
Sandbox: impl-13e-public-press / 4bg9ufz2-6mq · Main deploy = 0
Evidence: docs/implementation/evidence/IMPL-13E-0-MULTIDAY-CHECKOUT-FAIL-CLOSED.md
IMPL-13E-X: IMPLEMENTED / TECHNICALLY VALIDATED
Landing wiring: PUB-VIE/SAB/DOM + FOT-VIE/SAB/DOM · page lock · session v2
Evidence: docs/implementation/evidence/IMPL-13E-X-PUBLIC-PRESS-LANDING-WIRING.md
IMPL-13E-Y: VALIDATED / CLOSED
Human closure: 2026-07-27 · IMPL_13E_Y_HUMAN_CLOSED
PUB-SAB×2 $500 (170718270018) · FOT-VIE×1 $350 (170719199176) · FOT-SAB×1 $350 (170723724364)
Sandbox 4bg9ufz2-6mq CONFIGURADO · Main intact
Evidence: docs/implementation/evidence/IMPL-13E-Y-PUBLIC-PRESS-SANDBOX-E2E.md
R2A: docs/implementation/evidence/IMPL-13E-Y-R2A-HTTPS-RETURN-PREPARATION.md
R2B: docs/implementation/evidence/IMPL-13E-Y-R2B-HTTPS-AUTO-RETURN-PAYMENT.md (commit 435c9d5 accepted)
Human closure: docs/implementation/evidence/IMPL-13E-Y-HUMAN-CLOSURE.md
ORDER_HOLDER = EXPECTED_NON_TICKET_CREDENTIAL (accepted)
RETURN_REFERENCE_RESILIENCE: OPEN / NON-BLOCKING FOR CURRENT CLOSURE
PAYMENT_PENDING_EXPIRY_RECONCILIATION: OPEN / REQUIRED BEFORE PRODUCTION
PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING: OPEN / REQUIRED BEFORE PRODUCTION
Gate: READY_FOR_IMPL_13E_POST_CLOSURE_PRIORITY_DECISION
```

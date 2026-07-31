# WORKSPACE STATUS - Ready2Hybrid

## Estado

- Fecha de inicio: 2026-07-21
- Constructor operativo: Cursor
- Modelo: mejor LLM disponible para cada tarea
- Stack: Vite + React 19 + TypeScript
- Aplicacion: PWA offline-first
- Backend: InsForge
- Pagos: Mercado Pago Checkout Pro
- Evento: viernes 9 de octubre de 2026
- F0-D: CLOSED - Playwright Foundation implementada, validada y publicada
- R1: CLOSED - migracion documental publicada en `b6e64c2`
- R2: CLOSED - revision formal terminada en `CHANGES_REQUIRED`
- R3: CLOSED - correcciones publicadas en `9d9bbb9`
- SALE-1: CLOSED - SPEC-030 v0.1.0 aprobada por el propietario
- SALE-2: CLOSED - SPEC-031 v0.1.0 aprobada por el propietario
- SALE-3: CLOSED - contrato documental; SPEC-032 v0.1.0 APPROVED
- F0-E: NOT STARTED - sin autorizacion de implementacion
- InsForge schema 0001-0003: DEPLOYED AND VALIDATED on `ready2hybrid` / `4bg9ufz2.us-east`
- Catalog seed: ALIGNED AND LOCALLY VALIDATED (OD-022 APPROVED 2026-07-24)
- InsForge catalog seed remote execution: EXECUTED AND VALIDATED (`0004` / IMPL-5)
- Catalog remote validation IMPL-6: VALIDATED / CLOSED
- Catalog: 1 event / 3 event days / 28 products
- IMPL-7 checkout start: VALIDATED / CLOSED
- Edge function `mp-create-checkout`: DEPLOYED (sales remain closed)
- InsForge migration 0005 / remote v5: APPLIED (TX RPC only)
- IMPL-8 signed webhook: VALIDATED / CLOSED
- Edge function `mp-webhook`: DEPLOYED
- InsForge migration 0006 / remote v6: APPLIED (TX-2 RPC only)
- Mercado Pago webhook URL/secret: DEFERRED / NOT AUTHORIZED
- IMPL-9 public order status: VALIDATED / CLOSED
- Edge function `get-order-status`: DEPLOYED (read-only)
- IMPL-10 team roster invitations: VALIDATED / CLOSED
- Edge function `team-roster`: DEPLOYED
- InsForge migration 0007 / remote v7: APPLIED (team roster RPCs)
- TEAM_ROSTER_REMINDERS: DEFERRED / NOT AUTHORIZED
- IMPL-11 tickets and QR credentials: VALIDATED / CLOSED
- Edge function `ticket-credentials`: DEPLOYED
- InsForge migration 0008 / remote v8: APPLIED (ticket issuance RPCs)
- OD-019 commercial folio: OPEN (technical opaque folio IMPLEMENTED)
- OD-020 multiday: OPEN / FAIL-CLOSED
- EMAIL_PROVIDER / TICKET_EMAIL_DELIVERY: DEFERRED / NOT AUTHORIZED
- PUBLIC_TICKET_RETRIEVAL: DEFERRED / NOT AUTHORIZED
- Check-in / offline manifest: NOT IMPLEMENTED / NOT AUTHORIZED
- IMPL-12 sandbox E2E: VALIDATED / CLOSED
  (A–D PASS; E deferred; OD-001 spectator qty ≥ 1; human closure 2026-07-26 on `9cca6b4`)
- InsForge sandbox branches R1–R4 + remaining-cases + case-c-quantity: DELETED
- InsForge Main migrations: v1–v10 (0010 spectator-multi-quantity applied on Main)
- Mercado Pago test webhook: URL may remain stored; verify topics NONE / callback DISABLED in panel
- Mercado Pago production webhook: NOT CONFIGURED
- IMPL-13A integration preflight: EXECUTED (read-only) during IMPL-13 path
- IMPL-13B spectator sandbox wiring + Origin hardening: VALIDATED / CLOSED
  (human closure 2026-07-26; technical R2H `0cb8b12` / landing `9b9cf48`)
- InsForge sandbox branch `impl-13b-spectator-wiring` / `4bg9ufz2-rug`: RETIRED
  (retired during IMPL-14A-3A-SBX-PROVISION; evidence already captured in docs)
- Gateway CORS residual (OPTIONS reflect / POST-GET ACAO *): ACCEPTED FOR SANDBOX
- Application Origin fail-closed gate: RETAINED (defense-in-depth; ≠ authentication)
- PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING: REQUIRED before production / NOT CLOSED
- IMPL-13C single spectator sandbox E2E: VALIDATED / CLOSED
  (human closure 2026-07-26; evidence `1de0be2`; op `170714344550`; Mercadopago*fake)
- IMPL-13D remaining-journeys preflight: EXECUTED (read-only; no code/price mutation)
- IMPL-13D-H product/price/journey decisions: APPROVED / CLOSED
  (PO 2026-07-26; OPCIÓN B target prices; IMPL-13E next; Main prices NOT updated yet)
- IMPL-13E-0 multiday checkout fail-closed: VALIDATED / CLOSED
  (PUB-3D/FOT-3D → PRODUCT_NOT_AVAILABLE before writes/MP; sandbox `4bg9ufz2-6mq`)
- IMPL-13E-X public/press single-day landing wiring: IMPLEMENTED / TECHNICALLY VALIDATED
  (PUB-VIE/SAB/DOM + FOT-VIE/SAB/DOM sandbox; no payments; flags default off)
- IMPL-13E-Y public/press sandbox E2E: VALIDATED / CLOSED
  (human closure 2026-07-27; PUB-SAB×2 + FOT-VIE×1 + FOT-SAB×1; R2B `435c9d5`; sandbox CONFIGURADO)
- R2H-LANDING-SBX-1B minimal preview checkout E2E: VALIDATED / CLOSED
  PREVIEW + SANDBOX FUNCTIONAL SCOPE (PO closure 2026-07-31 America/Merida;
  sandbox `impl-13e-public-press` / `4bg9ufz2-6mq`; product `PUB-VIE` qty 1;
  `AWAITING_PAYMENT` / `terminal=false`; redirect non-authoritative;
  HEX-2026 restored `CONFIGURADO`; hold `RELEASED`; payments 0; tickets 0;
  synthetic order retained `PAYMENT_PENDING` as sandbox evidence only;
  not hardening evidence; Main/production/`impl-14a-expiry` writes = 0;
  evidence `docs/implementation/evidence/R2H-LANDING-SBX-1B.md`)
- IMPL-13E-Y-R1 residual forensics: VALIDATED / CLOSED (ORDER_HOLDER expected; unpaid invariants PASS)
- IMPL-13E-Y-R2A HTTPS preview + confirming: EXECUTED / CLOSED into R2B
- IMPL-13E-Y-R2B single HTTPS auto-return payment: EXECUTED / HUMAN-ACCEPTED into Y closure
- Commercial target prices (landing-visible): APPROVED — Main canonical update PENDING separate unit
- Multiday PUB-3D / FOT-3D: FAIL-CLOSED pending OD-020 (checkout + ticket layers)
- RETURN_REFERENCE_RESILIENCE: OPEN / NON-BLOCKING FOR CURRENT CLOSURE
- PAYMENT_PENDING_EXPIRY_RECONCILIATION: OPEN / REQUIRED BEFORE PRODUCTION
  - IMPL-14A PO contract decisions D1–D10: APPROVED 2026-07-27
  - SPEC-040 v0.1.1: APPROVED 2026-07-27 by Project Owner
  - IMPL-14A-2 plan: PLAN / APPROVED v0.2.0 (PO 2026-07-27 after CTO READY_FOR_APPROVAL + IMPL-14A-2V)
    (`docs/implementation/IMPL-14A-2-PAYMENT-PENDING-EXPIRY-IMPLEMENTATION-PLAN.md`)
    approved content SHA-256: `04BAC5D62D6E3A75F0826AEAE0839D31340369D0156AC1DA09EB9D565D56EC0D`
  - OD-040-001: cadence/SLA APPROVED (1 min / ≤5 min); anti-overlap APPROVED
    2026-07-29 by Project Owner (D3C-1): durable global lease in
    `idempotency_records`, TTL 90s, atomic acquire, `run_id` owner,
    outcome `overlap_skipped` when busy; NO advisory locks and NO edits to
    0012/0013 batch/aggregate validated in IMPL-14A-3B
  - OD-040-002: PARTIAL for sandbox 3C only (D3C-2 APPROVED 2026-07-29):
    exclusive schedule secret + `actor_ref=system:payment-pending-expiry` +
    strict RPC allowlist + temporary compensating `project_admin` EXECUTE;
    true least privilege remains OPEN and continues to BLOCK Main, production,
    and IMPL-14A-3D admin scope
  - OD-040-003: DEFERRED_TO_OPERATIONAL_RUNBOOK (refund task markers only in IMPL-14A)
  - Gate: IMPL-14A-3B VALIDATED / CLOSED (sandbox scope); D3C-1/D3C-2 decided;
    IMPL-14A-3C = VALIDATED / CLOSED for its local implementation + automated
    tests + sandbox physical runtime scope (human closure 2026-07-29
    America/Merida by Project Owner; FIX-1 sandbox retest executed 2026-07-29
    America/Merida / VALIDATION_FAILED and preserved as evidence; FIX-2 sandbox
    retest executed 2026-07-29 America/Merida = 2026-07-30 UTC / PASS).
    Closure does NOT cover Main apply, production, schedule activation or
    IMPL-14A-3D
  - IMPL-14A-3C runtime shape: max 25 orders/run; successive
    `expire_payment_pending_batch_tx(limit:1)`; sandbox Edge budget = 20s
    measured from `startedMs`; future cadence 1 minute
  - IMPL-14A-3C migration 0014 = APPLIED ONLY TO SANDBOX / actual 64-char SHA
    RATIFIED BY PROJECT OWNER (`MIGRATION-SHA-001`)
  - IMPL-14A-3C Edge = FIX-2 REDEPLOYED ONLY TO SANDBOX
    (bundle SHA-256 F45A0FB4F4C31738B8C50F2C0825262F61FE1B8B2AC73C8ABB2818913E908EEC;
    deployment `sjpyyrc0etaf`; RUN_BUDGET_MS 20_000; environment sandbox)
  - IMPL-14A-3C schedule = VALIDATED 4 FIRES / INACTIVE AFTER TEST
  - IMPL-14A-3C schedule secret = SANDBOX CONFIGURED / VALUE NOT RECORDED
  - IMPL-14A-3C SLA = PASS / 51.152927 seconds
  - IMPL-14A-3C MIGRATION-SHA-001 = RATIFIED BY PROJECT OWNER
  - IMPL-14A-3C BUDGET-GATEWAY-001 = RESOLVED IN SANDBOX SCOPE / CLOSED WITH
    IMPL-14A-3C (Project Owner 2026-07-29 America/Merida; FIX-2 external HTTP
    200 `partial`,
    `budget_exhausted=true`, gateway 504 = 0, client 22098.605 ms,
    internal 21408.765834 ms, margin 8397.4 ms vs the 30496 ms FIX-1 cut)
  - IMPL-14A-3C IN-FLIGHT BATCH RESIDUAL RISK = OPEN
    (worst-case duration of a batch already started is not bounded by the
    deadline; must be re-evaluated before Main apply and production)
  - IMPL-14A-3C FIX-1 sandbox retest = EXECUTED / VALIDATION_FAILED
  - IMPL-14A-3C FIX-1 local automated validation = 348/348 + 144/144 PASS;
    typecheck/lint/diff-check PASS
  - IMPL-14A-3C FIX-2 sandbox retest = EXECUTED / PASS / CTO RUNTIME REVIEW PASS /
    HUMAN VALIDATED 2026-07-29 America/Merida (5 limited remote regressions PASS; fixtures,
    harness, triggers and grants cleaned; schedule INACTIVE; Main writes 0)
  - IMPL-14A-3C FIX-2 local automated validation = 352/352 + 148/148 PASS;
    typecheck/lint/diff-check PASS
  - IMPL-14A-3C SBX-CREDENTIAL-001 = REMEDIATED / recovery metadata PASS /
    new credential disclosure 0
  - IMPL-14A-3C SBX-CREDENTIAL-003 = OPEN / NON-BLOCKING
    (`branch list --json` emits encrypted credential envelopes; values not
    reproduced; no rotation performed)
  - IMPL-14A-3C OBS-3C-CRONVIEW-001 = OPEN / NON-BLOCKING
    (schema `cron` not readable and Main's schedule store not reachable without
    linking/switching the CLI; Main has no `payment-pending-expiry` function)
  - IMPL-14A-3C OBS-3C-ENV-001 = RESOLVED IN SANDBOX /
    response environment `sandbox`
  - IMPL-14A-3C Main = UNTOUCHED / WRITES 0; PRODUCTION = NO-GO
  - IMPL-14A-3C human validation/closure = PERFORMED 2026-07-29 America/Merida
    by Project Owner for the local implementation + automated tests + sandbox
    runtime scope only
  - True least privilege = OPEN; BLOCKS Main, production and IMPL-14A-3D
  - IMPL-14A-3A: logical capacity expiry exclusion (SPEC-040-I007/R004)
    VALIDATED / CLOSED for its implementation + sandbox validation scope
    (human closure 2026-07-28 by Project Owner; traceability commit `a801a14`)
    migration `insforge/migrations/0011_logical-capacity-expiry-exclusion.sql`
    SHA-256 `7C145C0C749CAA7BB27761F03FCC09F727F476C6266148C59B7A51E621F98A22`
    rename similarity 100% / SQL content changes 0
    COMMIT / PUSH `ced7c62` = COMPLETED (origin/main; pre-rename filename)
    CODE REVIEW = PASSED (CTO)
    LOCAL AUTOMATED VALIDATION = PASSED (tests / typecheck / lint)
    SANDBOX RUNTIME VALIDATION = EXECUTED (IMPL-14A-3A-SBX-RUNTIME 2026-07-28)
    CTO RUNTIME REVIEW = PASSED
    ARTIFACT FIX REVIEW = PASSED
    ARTIFACT FILENAME CORRECTION = COMPLETED
    HUMAN CLOSURE = PERFORMED 2026-07-28 (Project Owner)
    CLOSURE SCOPE = implementation + sandbox validation only; the closure does
    not authorize applying 0011 to Main, does not authorize production and does
    not authorize starting IMPL-14A-3B
  - IMPL-14A-3A runtime evidence (redacted capture in
    `docs/implementation/evidence/IMPL-14A-3A-SBX-RUNTIME.md`):
    SPEC-040-I007 = RUNTIME PASS; SPEC-040-R004 = RUNTIME PASS;
    SPEC-040-AC003 = RUNTIME PASS; concurrency = PASS;
    physical discriminating lock-wait = PASS; zero expiry persistence = PASS;
    RPC regression = PASS.
    Sandbox `impl-14a-expiry` / `4bg9ufz2-2w7`; migration v11 applied only there
    (remote name `logical-capacity-expiry-exclusion`). ACTIVE future / past /
    NULL, exact temporal equality, mixed holds and non-ACTIVE states all PASS;
    the discriminating lock-wait proved transaction-start `now()` would still have
    counted a hold that expired during the wait, while `v_capacity_now` did not.
    Effective reserved capacity never exceeded cupo on any synthetic product;
    zero payments, tickets,
    entitlements, TICKET_ACCESS credentials or webhook rows, and no hold/order/
    registration state transition produced by the expiry logic.
    Main remained v1–v10 with 0011 absent, HEX-2026 `CONFIGURADO`, sales closed
    and zero transactional rows.
  - IMPL-14A-3A-ARTIFACT-FIX (CTO CHANGES_REQUIRED): the InsForge migration
    runner rejects filenames whose descriptive segment uses underscores, so the
    versioned artifact was renamed via `git mv` (100% similarity) to
    `insforge/migrations/0011_logical-capacity-expiry-exclusion.sql`. SQL content
    and SHA-256 `7C145C0C749CAA7BB27761F03FCC09F727F476C6266148C59B7A51E621F98A22`
    unchanged, so the sandbox runtime evidence remains applicable. The SQL header
    comment still cites the previous filename on purpose: changing it would alter
    the bytes physically validated in the sandbox. Migrations 0001–0009 keep their
    historical underscore names: already applied remotely, out of scope here and
    pinned by a frozen allowlist so no new migration may use that shape.
  - Main application of 0011: NOT AUTHORIZED (remains NOT AUTHORIZED after the
    filename correction; Main stays at v1–v10 with version 11 absent)
  - IMPL-14A-3A sandbox inventory: `impl-14a-expiry` / `4bg9ufz2-2w7` ACTIVE
    (`schema-only`, migration max 11); `impl-13b-spectator-wiring` / `4bg9ufz2-rug`
    RETIRED during IMPL-14A-3A-SBX-PROVISION to free branch quota. Operational
    inventory corrected in IMPL-14A-3A-FINALIZE (CTO D-4).
  - IMPL-14A-3A-FIX-1 (CTO CHANGES_REQUIRED, applied local-only): cupo predicate is
    null-safe; unknown expiry keeps reserving cupo (fail-closed). No NOT NULL
    constraint, no backfill, no historical repair in 3A.
  - IMPL-14A-3A-FIX-2 (CTO CHANGES_REQUIRED, applied local-only): lock-aware
    canonical capacity clock — `v_capacity_now := clock_timestamp()` captured once
    after the product/event locks; predicate is
    `state='ACTIVE' AND (expires_at IS NULL OR expires_at > v_capacity_now)`.
    `now()` (transaction start) is no longer used for the cupo decision.
  - IMPL-14A-3A runtime observations (OPEN, non-blocking for 3A):
    NB-1: TX-1 creates the order/hold in `PREFERENCE_PENDING` before the Mercado
    Pago preference exists, so a preference failure leaves a hold that only
    expiry reconciliation can clear.
    NB-2: `capacity_holds.updated_at` has no trigger maintenance; it is written
    only by explicit statements, so it is not a reliable change timestamp.
    NB-3: an isolated TX-1 replay depends on `idempotency_records.response_ref`;
    without it the replay path cannot rebuild the original response.
    NB-4: the retained sandbox still holds inherited secrets that are unused
    after `MERCADOPAGO_ACCESS_TOKEN` was neutralised; Main's token is intact.
    NB-5: the validation harness artifacts (synthetic events/days/products and
    seeded holds) did not alter any result; every case was measured against its
    own product and no shared state was reused after the discarded product.
  - OPEN FOR IMPL-14A-3B: boundary asymmetry — `checkout_start_tx` frees cupo at
    `expires_at <= v_capacity_now` while TX-2 (`0009`) treats a hold as expired
    only at `expires_at < now()`. NO CHANGE TO TX-2 IN 3A.
  - TIME-SEMANTICS-AUDIT (OPEN): other `now()` uses in checkout
    (e.g. `v_expires_at := now() + make_interval(...)`, sales gates) and in TX-2
    may need separate analysis. Out of scope for FIX-2; required before integral
    runtime validation / production.
  - IMPL-14A-3B = VALIDATED / CLOSED
    for its implementation + automated tests + sandbox physical validation only
    (human closure 2026-07-29 by Project Owner; published commit `6068d5b`)
    local implementation = COMPLETED
    sandbox runtime = EXECUTED
    CTO runtime review = PASSED
    B-ARRAY = RESOLVED IN SANDBOX
    0012 sandbox apply = EXECUTED
    0013 sandbox apply = EXECUTED
    FIX-2 retest = PASSED (29/29; matrix 13/13)
    suite 316/316 PASS; focused expiry 112/112 PASS
    dry-run zero-write / batch / SKIP LOCKED / idempotency / ROW_COUNT /
    no-emission = PASS
    Main application = NOT AUTHORIZED
    human validation / closure = PERFORMED 2026-07-29 (Project Owner)
    CLOSURE SCOPE = implementation + automated tests + sandbox validation only;
    the closure does not authorize applying 0011/0012/0013 to Main, does not
    authorize production, does not authorize starting IMPL-14A-3C, and does not
    close deferred TX-2 / PREFERENCE_PENDING / least-privilege / rate-limiting /
    outbox findings
    IMPL-14A-3C = NOT AUTHORIZED / NOT STARTED
    PRODUCTION = NO-GO
    decisions D-1 … D-6 = RECORDED (unchanged)
    migration `insforge/migrations/0012_payment-pending-expiry-transaction.sql`
    SHA-256 `E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1`
    = APPLIED / IMMUTABLE on sandbox `impl-14a-expiry` (NOT Main)
    corrective migration
    `insforge/migrations/0013_payment-pending-expiry-array-fix.sql`
    SHA-256 `BCCB2AAC7E73B9CC2A9027E18D397C80A900084519E911148BF03B024663F44A`
    = APPLIED ONLY TO sandbox `impl-14a-expiry` (migration max 13; NOT Main)
    B-1 DRY-RUN VOLATILITY = FIXED LOCALLY (IMPL-14A-3B-FIX-1)
    dry-run clock = statement_timestamp()
    aggregate/batch clock = clock_timestamp()
    evidence: `docs/implementation/evidence/IMPL-14A-3B-SBX-RUNTIME.md`
  - IMPL-14A-3C = VALIDATED / CLOSED (local implementation + automated tests +
    sandbox physical runtime scope only; human closure 2026-07-29
    America/Merida)
    (D3C-1/D3C-2 APPROVED 2026-07-29; 0014 SHA ratified; 0014 applied and Edge
    FIX-2 redeployed only in `impl-14a-expiry`; schedule inactive; FIX-1 30s
    physical retest returned gateway 504 and VALIDATION_FAILED, preserved as
    evidence; FIX-2 20s physical retest returned external HTTP 200 partial with
    gateway 504 = 0; Main writes 0; Main apply, production, schedule activation
    and IMPL-14A-3D remain NOT AUTHORIZED)
  - IMPL-14A-3D…3G: NOT AUTHORIZED / NOT STARTED
  - Main remote apply / cron / edges: NOT AUTHORIZED
- PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING: OPEN / REQUIRED BEFORE PRODUCTION
- PRODUCTION: NO-GO
- Next: CTO review of the IMPL-14A-3C documentary closure; no Main apply of
  0011/0012/0013/0014 / cron / Edge / production until separately authorized;
  no 0012/0013/0014 SQL edits
- InsForge sandbox branches ACTIVE:
  `impl-13e-public-press` / `4bg9ufz2-6mq` — Project ID
  `4227c38d-f6c9-4ee4-aa6f-d05fb4b19693`; mode `full` (IMPL-13E surface)
  `impl-14a-expiry` / `4bg9ufz2-2w7` — Project ID
  `2921e092-aed6-4abb-93be-946c42eee82a`; mode `schema-only`; migration max 14
  (IMPL-14A-3A + 3B validation; IMPL-14A-3C runtime executed; schedule
  inactive; Main untouched)
- InsForge sandbox branches RETIRED:
  `impl-13b-spectator-wiring` / `4bg9ufz2-rug` — Project ID
  `c4719a08-4709-4bee-9dfb-8539df5b715b`; retired during IMPL-14A-3A-SBX-PROVISION
- Landing: spectator sandbox wiring + atomic submit (flags default off; prod host blocked)
- Note: Cursor InsForge MCP targets Main; current sandbox ops must use CLI `4bg9ufz2-2w7`
- `.cursor/settings.json`: local Stripe plugin enablement — IGNORED_LOCAL_CONFIG
  (`.git/info/exclude`; do not version)

## Autoridad

Leer `CURSOR_START_PROMPT.md`, `MANIFEST.md`, este archivo y `docs/` por numero.
Ante contradiccion de producto o arquitectura dentro de `docs/00-05`, manda el
numero menor salvo que la resolucion exija una decision humana.
Las specs traducen la autoridad a contratos verificables; no reemplazan
`docs/00-05`.

## Estado de F0

- F0-A Preflight: PASS
- F0-B1 Scaffold temporal: PASS
- F0-B2 Vite/React/TypeScript foundation: PASS en `e7d926c`
- F0-B3 Spec Foundation: APPROVED v0.1.0, cerrado y publicado en `0d92a97`
- F0-C Vitest Foundation: cerrado y publicado en `be7bfa6`
- F0-D Playwright Foundation: IMPLEMENTED y VALIDATED

## Artefactos F0-B3

- `docs/specs/README.md`
- SPEC-000 v0.1.0 historically `APPROVED`, now `SUPERSEDED`:
  `docs/specs/archive/SPEC-000-GOVERNANCE-v0.1.0.md`
- SPEC-000 v0.2.0 `APPROVED` y vigente:
  `docs/specs/SPEC-000-GOVERNANCE.md`
- `docs/specs/SPEC-001-SYSTEM-ARCHITECTURE.md`
- `docs/specs/SPEC-011-PWA-FOUNDATION.md`
- `docs/specs/SPEC-030-PUBLIC-SALES-CATALOG-AND-REGISTRATION-JOURNEYS.md`
  - v0.1.0 `APPROVED`
  - catalogo: COMPITE 13, EXPERIENCE 7, ASISTE 8, total 28
- `docs/specs/SPEC-031-PUBLIC-SALES-API-AND-BACKEND-CONTRACT.md`
  - v0.1.0 `APPROVED`
  - contrato publico landing-backend para J1-J5
- `docs/specs/SPEC-032-MINIMAL-SALES-DATA-MODEL-AND-TRANSACTION-INTEGRITY.md`
  - v0.1.0 `APPROVED`
  - modelo logico minimo, transacciones, concurrencia y trazabilidad
- `docs/implementation/IMPL-0-SALES-IMPLEMENTATION-TRACEABILITY.md`
  - plan trazable IMPL-1..13E; IMPL-2..12, IMPL-13B/C `VALIDATED / CLOSED`;
    IMPL-13D-H `APPROVED / CLOSED`; IMPL-13E prepared
- `docs/implementation/evidence/IMPL-5-CATALOG-SEED-PREPARATION-VALIDATION.md`
  - OD-022 APPROVED; seed blob `530bdde7…`; local PG16 PASS
- `docs/implementation/evidence/IMPL-5-CATALOG-SEED-REMOTE-EXECUTION-VALIDATION.md`
  - remote `0004_hybrid-event-catalog`; 1/3/28 PASS; IMPL-5 `VALIDATED`
- `docs/implementation/evidence/IMPL-6-28-PRODUCTS-READ-ONLY-VALIDATION.md`
  - read-only 28-product compare PASS; human closure APPROVED 2026-07-25
- `docs/implementation/evidence/IMPL-7-CHECKOUT-START-IMPLEMENTATION-VALIDATION.md`
  - `mp-create-checkout` + 0005; smoke `SALES_NOT_OPEN`; preferences = 0;
    human closure APPROVED 2026-07-25
- `docs/implementation/evidence/IMPL-8-SIGNED-IDEMPOTENT-WEBHOOK-IMPLEMENTATION-VALIDATION.md`
  - `mp-webhook` + 0006; smokes 405/401/503; MP writes = 0;
    human closure APPROVED 2026-07-25; panel config DEFERRED
- `docs/implementation/evidence/IMPL-9-PUBLIC-ORDER-STATUS-IMPLEMENTATION-VALIDATION.md`
  - `get-order-status`; SPEC-031 mapping; smokes 405/400/404; writes = 0;
    human closure APPROVED 2026-07-25; panel config DEFERRED
- `docs/implementation/evidence/IMPL-10-TEAM-ROSTER-INVITATIONS-IMPLEMENTATION-VALIDATION.md`
  - `team-roster` + 0007; smokes 405/400/404/503; writes = 0; reminders deferred;
    human closure APPROVED 2026-07-25
- `docs/implementation/evidence/IMPL-11-TICKETS-QR-IMPLEMENTATION-VALIDATION.md`
  - `ticket-credentials` + 0008; smokes 405/403/400/404/401; writes = 0;
    human closure APPROVED 2026-07-25; email/public retrieval deferred;
    multiday fail-closed; check-in not implemented
- `docs/implementation/evidence/IMPL-12-SANDBOX-END-TO-END-VALIDATION.md`
  - isolated branch + signed pre-webhook + checkout preferences PASS;
    Checkout Pro sandbox payment UI BLOCKED; Main differences = 0;
    branch deleted; IMPL-13 not started
- `docs/implementation/evidence/IMPL-12-R1-MP-CHECKOUT-DIAGNOSTIC.md`
  - root cause `BROWSER_SESSION_CONFLICT`; sandbox payment approved $300 MXN;
    no code change; Main differences = 0; branch deleted
- `docs/implementation/evidence/IMPL-12-SANDBOX-END-TO-END-RETRY-VALIDATION.md`
  - IMPL-12-R2; Case A payment PASS; signed webhook HTTP 500;
    schema/RPC NOT NULL defect; no code patch; branch deleted; Main transactional = 0
- `docs/implementation/evidence/IMPL-12-R3-WEBHOOK-PAYMENT-ORDER-FIX.md`
  - migration 0009; tests +7; branch v9 apply; webhook 200 + payment_id set;
    Case A full FAIL (hold expired → REQUIRES_REVIEW); Main v8 unchanged at R3
- `docs/implementation/evidence/IMPL-12-R4-CASE-A-TTL-REVALIDATION.md`
  - Main v9 deploy; Case A within hold TTL PASS (PAID + ticket/credential/entitlement);
    duplicate DUPLICATE; invalid sig 401; branch deleted
- `docs/implementation/evidence/IMPL-12-REMAINING-CASES-VALIDATION.md`
  - B PASS; C OD-001 fail-closed (pre-fix); D PASS; E PROVIDER_SANDBOX_CONT_NOT_STABLE
- `docs/implementation/evidence/IMPL-12-CASE-C-SPECTATOR-QUANTITY-VALIDATION.md`
  - OD-001 spectator qty=2 PASS (tickets/creds/ents=2); OD-PENDING D;
    branch deleted; Main was v1–v9 at Case C close
- `docs/implementation/evidence/IMPL-12-CANONICAL-V10-DEPLOYMENT.md`
  - Main v10 + `mp-create-checkout` deploy; HEX-2026 CONFIGURADO;
    functions 5; transactional 0; no payments/sales;
    human closure APPROVED 2026-07-26 → IMPL-12 `VALIDATED / CLOSED`
- `docs/implementation/evidence/IMPL-13B-R2-APPLICATION-ORIGIN-HARDENING.md`
  - exact Origin gate before catalog/DB/writes/MP; atomic landing submit;
    sandbox matrices PASS; gateway ACAO * residual measured
- `docs/implementation/evidence/IMPL-13B-HUMAN-CLOSURE.md`
  - PO accepted sandbox gateway CORS limitation; IMPL-13B `VALIDATED / CLOSED`
- `docs/implementation/evidence/IMPL-13C-SPECTATOR-SANDBOX-E2E-PREPARATION.md`
  - single PUB-VIE sandbox E2E prep
- `docs/implementation/evidence/IMPL-13C-SPECTATOR-SANDBOX-E2E-VALIDATION.md`
  - PUB-VIE paid; webhook PAID/ALREADY_PAID; status APPROVED; Main TX 0
- `docs/implementation/evidence/IMPL-13C-HUMAN-CLOSURE.md`
  - PO closure APPROVED 2026-07-26 → IMPL-13C `VALIDATED / CLOSED`
- `docs/implementation/evidence/IMPL-13D-H-PRODUCT-JOURNEY-DECISIONS.md`
  - PO OPCIÓN B prices; IMPL-13E scope; later WOD/IND/teams; multiday fail-closed;
    abuse gate remains OPEN for production
- `docs/implementation/evidence/IMPL-13E-0-MULTIDAY-CHECKOUT-FAIL-CLOSED.md`
  - PUB-3D/FOT-3D checkout fail-closed; sandbox `4bg9ufz2-6mq`; zero writes
- `docs/implementation/evidence/IMPL-13E-X-PUBLIC-PRESS-LANDING-WIRING.md`
  - landing sandbox wiring PUB/FOT single-day; page lock; session v2; no payments
- `insforge/functions/team-roster/`
  - opaque invitation GET/POST edge function (bundled deployable)
- `insforge/migrations/0007_team_roster_invitations.sql`
  - TX-1/TX-2 team sync + roster RPCs (no catalog changes)
- `insforge/functions/mp-create-checkout/`
  - checkout start edge function (bundled deployable)
- `insforge/functions/mp-webhook/`
  - signed idempotent webhook edge function (bundled deployable)
- `insforge/functions/get-order-status/`
  - read-only public order status edge function (bundled deployable)
- `insforge/migrations/0005_checkout_start_transaction.sql`
  - TX RPCs for checkout start (no catalog changes)
- `insforge/migrations/0006_webhook_payment_transaction.sql`
  - TX-2 RPC for verified payment effects (no catalog changes)
- `docs/implementation/IMPL-4-ACCESS-DECISION-PACK.md`
  - ACCESS-DEC-001..008 APPROVED (2026-07-24); deny-by-default autorizado
- `docs/implementation/evidence/IMPL-2-ISOLATED-APPLY-VALIDATION.md`
  - apply aislado PostgreSQL 16 PASS; seed no ejecutado; InsForge write = 0
- `docs/implementation/evidence/IMPL-3-CONSTRAINTS-AND-INDEXES-VALIDATION.md`
  - constraints/indexes aislados PASS; N01-N30 PASS; RLS = 0
- `docs/implementation/evidence/IMPL-4-RLS-AND-ACCESS-LIMITS-VALIDATION.md`
  - RLS deny-by-default PASS; A01-A16 PASS; InsForge write = 0
- `docs/implementation/evidence/INSFORGE-SCHEMA-DEPLOYMENT-VALIDATION.md`
  - remote 0001/0002/0003 DEPLOYED AND VALIDATED via InsForge CLI
- `insforge/migrations/0001_minimal_sales_schema.sql`
  - migracion minima IMPL-2 publicada en `ac2be55`
- `insforge/migrations/0002_sales_constraints_and_indexes.sql`
  - constraints e indices IMPL-3 publicados en `b459e80`
- `insforge/migrations/0003_rls_and_access_limits.sql`
  - RLS deny-by-default IMPL-4 publicado en `cbbeecc`
- `skills/ready2hybrid-spec-governance/SKILL.md`
- `skills/ready2hybrid-spec-governance/agents/openai.yaml`

`SPEC-000` v0.2.0, `SPEC-001` v0.1.0 y `SPEC-011` v0.1.0 estan `APPROVED`.
La version v0.1.0 de `SPEC-000` esta `SUPERSEDED` y se preserva sin cambios en
`docs/specs/archive/SPEC-000-GOVERNANCE-v0.1.0.md`. Ninguna de estas specs
autoriza schema, RLS, pagos, webhooks, secretos, produccion ni modulos
funcionales.

Seguimiento documental no bloqueante: `MANIFEST.md` y las listas historicas de
fuentes dentro de SPEC-001/SPEC-011 conservan referencias previas a SPEC-000
v0.1.0. La aprobacion explicita de SALE-1, la metadata de SPEC-000 v0.2.0 y el
registro vigente resuelven la autoridad actual. Corregir esas referencias
protegidas requiere una unidad documental separada; SALE-1 no las modifica.

## Artefactos F0-C

Archivos modificados:

- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `WORKSPACE_STATUS.md`

Archivos creados:

- `src/test/setup.ts`
- `src/App.test.tsx`

Dependencias instaladas:

- `vitest@4.1.10`
- `jsdom@29.1.1`
- `@testing-library/react@16.3.2`
- `@testing-library/dom@10.4.1`

Scripts agregados:

- `test`: `vitest run`
- `test:watch`: `vitest`

Configuracion:

- Vitest integrado en `vite.config.ts`
- Entorno de prueba: `jsdom`
- Cleanup registrado en `src/test/setup.ts`
- Sin globals de Vitest
- Sin coverage
- Sin `vitest.config.ts`

## Validacion F0-C

- `npm run typecheck`: PASS
- `npm run lint`: PASS, 0 warnings y 0 errors
- `npm run test`: PASS, 1 test file y 1 test
- `npm run build`: PASS
- `git diff --check`: PASS

No se agregaron Playwright, PWA, service workers, IndexedDB, TanStack,
Zustand, Zod, InsForge, Mercado Pago, SQL, deployment ni logica funcional.

## Artefactos F0-D

Archivos modificados:

- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `WORKSPACE_STATUS.md`

Archivos creados:

- `playwright.config.ts`
- `tests/e2e/app.smoke.spec.ts`

Dependencia instalada:

- `@playwright/test@1.61.1`

Configuracion:

- Chromium como unico navegador inicial
- Vite iniciado automaticamente en `127.0.0.1:4173` con `--strictPort`
- Reporter de consola `line`
- Screenshot y trace conservados solo al fallar
- Video desactivado
- Artefactos bajo rutas ignoradas por Git
- Vitest excluye `tests/e2e/**`

## Validacion F0-D

- `npm ci`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS, 0 warnings y 0 errors
- `npm run test`: PASS, 1 test file y 1 test
- `npm run test:e2e`: PASS, 1 test en Chromium
- Cierre automatico del servidor Vite: PASS
- `npm run build`: PASS
- `git diff --check`: PASS

No se agregaron PWA, service workers, manifest, IndexedDB, TanStack, Zustand,
Zod, InsForge, Mercado Pago, SQL, deployment ni logica funcional.

## Unidad R1

- Preflight inicial: branch `main`, working tree limpio, HEAD `8296aee`,
  `origin/main` `8296aee`, divergencia `0/0`.
- Autoridad operativa migrada a Cursor + mejor LLM disponible por tarea.
- Documentos de inicio y plan renombrados.
- `SPEC-000` v0.1.0 preservada sin cambios.
- `SPEC-000` v0.2.0 preparada como revision `DRAFT`.
- F0-E permanece fuera de alcance y no implementada.

## Proximo gate

`READY_FOR_CTO_IMPL_14A_3C_DATE_NORMALIZATION_REVIEW`

Zona horaria canonica de gobierno: `America/Merida`. Las fechas humanas y de
gobierno se expresan en esa zona; los timestamps de ejecucion se conservan en
UTC con sufijo `Z` tal como fueron capturados.

Siguiente accion permitida:

1. IMPL-14A-3C = VALIDATED / CLOSED unicamente para implementacion local,
   pruebas automatizadas y runtime fisico validado en sandbox (cierre humano
   2026-07-29 America/Merida); FIX-1 sandbox retest = EXECUTED /
   VALIDATION_FAILED, conservado como evidencia; FIX-2 sandbox retest =
   EXECUTED / PASS. El cierre no autoriza Main, produccion, schedule
   permanente ni IMPL-14A-3D;
2. `MIGRATION-SHA-001` = RATIFIED BY PROJECT OWNER;
3. `BUDGET-GATEWAY-001` = RESOLVED IN SANDBOX SCOPE / CLOSED con IMPL-14A-3C:
   HTTP externo 200 `partial` / `budget_exhausted=true` / lease liberado a
   21408.765834 ms internos y 22098.605 ms observados por el cliente,
   gateway 504 = 0; queda ABIERTO el riesgo residual del batch en vuelo, cuya
   duracion no esta acotada por el deadline y debe reevaluarse antes de Main y
   produccion;
4. API key sandbox recuperada/verificada; nueva credencial no divulgada;
   `SBX-CREDENTIAL-003` y `OBS-3C-CRONVIEW-001` permanecen ABIERTOS y no
   bloqueantes;
5. schedule sandbox debe permanecer inactivo;
6. no modificar SQL de `0012`/`0013`/`0014` ni anadir advisory locks al batch 3B;
7. no aplicar `0011`/`0012`/`0013`/`0014` en Main; true least privilege sigue bloqueando
   Main, produccion y alcance admin 3D;
8. no crear nuevos schedules/cron, desplegar en Main ni implementar admin recovery;
9. no agregar NOT NULL a `capacity_holds.expires_at` ni reparar filas historicas;
10. no ejecutar pagos/reembolsos ni Main `EN_VENTA`;
11. no versionar `.cursor/*`; prohibido `git add -A`; no commit/push de este
   registro documental hasta autorizacion separada;
12. no cerrar hallazgos diferidos (TX-2, PREFERENCE_PENDING, true least privilege,
   rate limiting, outbox) sin unidad autorizada;
13. no abrir PUB-3D / FOT-3D hasta resolver OD-020;
14. no cerrar produccion sin `PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING`.

## Ultimo cierre

F0-D esta cerrado en `c6f1131`. R1 esta cerrado en `b6e64c2`. R2 termino en
`CHANGES_REQUIRED`. R3 corrigio los nueve hallazgos y cerro en `9d9bbb9`.
SALE-1 aprobo SPEC-000 v0.2.0 en `0765365` y preparo SPEC-030 v0.1.0 como
draft en `4888511`. El propietario aprobo SPEC-030 v0.1.0 en SALE-2. La
aprobacion fue publicada en `d30a77a`. SPEC-031 v0.1.0 fue publicada como
`DRAFT` documental durante SALE-2 en `a7d8c51`; su transicion de aprobacion,
publicada en `4e85409`, abrio SALE-3 Fase A sin cambiar su fase de origen
SALE-2. SPEC-032 v0.1.0 fue publicada como `DRAFT` en `07471d7` y aprobada
explicitamente por el propietario el 2026-07-24. El contrato documental de
SALE-3 queda CLOSED. IMPL-0 preparo trazabilidad. IMPL-1 cerro el seed
corregido en `31c9eb7`. IMPL-2 publico la migracion minima en `ac2be55`.
IMPL-3 publico constraints/indexes en `b459e80`. ACCESS-DEC-001..008 fueron
aprobados en `66cf9ff`. IMPL-4 publico RLS deny-by-default en `cbbeecc` y
cerro la validacion aislada A01-A16 con evidencia en
`docs/implementation/evidence/IMPL-4-RLS-AND-ACCESS-LIMITS-VALIDATION.md`.
El esquema remoto 0001-0003 se registro en `ad0a788`. IMPL-5A alineo el seed
en `e1c1522`. IMPL-5 aplico remotamente `0004_hybrid-event-catalog` y queda
`VALIDATED` con evidencia en
`docs/implementation/evidence/IMPL-5-CATALOG-SEED-REMOTE-EXECUTION-VALIDATION.md`.
IMPL-6 valido read-only los 28 productos en `78d3464` y quedo
`VALIDATED / CLOSED` el 2026-07-25 con evidencia en
`docs/implementation/evidence/IMPL-6-28-PRODUCTS-READ-ONLY-VALIDATION.md`.
IMPL-7 implemento `mp-create-checkout` + migracion `0005` (v5 remota) con
smoke negativo `SALES_NOT_OPEN` en `3f13c16` y quedo `VALIDATED / CLOSED`
el 2026-07-25 con evidencia en
`docs/implementation/evidence/IMPL-7-CHECKOUT-START-IMPLEMENTATION-VALIDATION.md`.
IMPL-8 implemento `mp-webhook` + migracion `0006` (v6 remota) con smokes
negativos 405/401/503 en `2379a90` y quedo `VALIDATED / CLOSED` el 2026-07-25
con evidencia en
`docs/implementation/evidence/IMPL-8-SIGNED-IDEMPOTENT-WEBHOOK-IMPLEMENTATION-VALIDATION.md`.
IMPL-9 implemento `get-order-status` (read-only, mapping SPEC-031) con smokes
405/400/404 en `d6df04c` y quedo `VALIDATED / CLOSED` el 2026-07-25
con evidencia en
`docs/implementation/evidence/IMPL-9-PUBLIC-ORDER-STATUS-IMPLEMENTATION-VALIDATION.md`.
IMPL-10 implemento `team-roster` + migracion `0007` (v7 remota) con smokes
405/400/404/503 en `43f633e` y quedo `VALIDATED / CLOSED` el 2026-07-25
con evidencia en
`docs/implementation/evidence/IMPL-10-TEAM-ROSTER-INVITATIONS-IMPLEMENTATION-VALIDATION.md`.
IMPL-11 implemento `ticket-credentials` + migracion `0008` (v8 remota) con
smokes 405/403/400/404/401 en `9c9daa4` y quedo `VALIDATED / CLOSED` el
2026-07-25 con evidencia en
`docs/implementation/evidence/IMPL-11-TICKETS-QR-IMPLEMENTATION-VALIDATION.md`.
IMPL-12 valido el entorno sandbox aislado, preferencias y pre-webhook firmado,
pero el Checkout Pro sandbox no completo pagos (`PROVIDER_SANDBOX_BLOCKED`).
Evidencia en
`docs/implementation/evidence/IMPL-12-SANDBOX-END-TO-END-VALIDATION.md`.
IMPL-12 Case C implemento OD-001 (spectator quantity) y valido PUB-VIE × 2
con tickets/credentials/entitlements = 2. Evidencia en
`docs/implementation/evidence/IMPL-12-CASE-C-SPECTATOR-QUANTITY-VALIDATION.md`.
IMPL-12 Canonical V10 aplico migracion 0010 y redesplego `mp-create-checkout`
en Main sin pagos ni apertura de ventas. Evidencia en
`docs/implementation/evidence/IMPL-12-CANONICAL-V10-DEPLOYMENT.md`.
El Project Owner cerro humanamente IMPL-12 el 2026-07-26 sobre evidencia
hasta `9cca6b4`. IMPL-12 = `VALIDATED / CLOSED`.
El Project Owner cerro humanamente IMPL-13B el 2026-07-26 aceptando la
limitacion CORS del gateway InsForge para sandbox y reteniendo el gate
server-side de `Origin`. Evidencia en
`docs/implementation/evidence/IMPL-13B-HUMAN-CLOSURE.md`.
El Project Owner cerro humanamente IMPL-13C el 2026-07-26 sobre evidencia
tecnica `1de0be2` y captura complementaria (op `170714344550`,
`Mercadopago*fake`). Evidencia en
`docs/implementation/evidence/IMPL-13C-HUMAN-CLOSURE.md`.
El Project Owner aprobo IMPL-13D-H el 2026-07-26 (OPCIÓN B precios objetivo;
siguiente unidad IMPL-13E; Main sin mutacion de precios). Evidencia en
`docs/implementation/evidence/IMPL-13D-H-PRODUCT-JOURNEY-DECISIONS.md`.
IMPL-13E-0 endurecio fail-closed de checkout para PUB-3D/FOT-3D
(`PRODUCT_NOT_AVAILABLE` antes de writes/MP) en sandbox
`impl-13e-public-press` / `4bg9ufz2-6mq`. Evidencia en
`docs/implementation/evidence/IMPL-13E-0-MULTIDAY-CHECKOUT-FAIL-CLOSED.md`.
IMPL-13E-X cableo landing public/press single-day (flags off; sin pagos).
Evidencia en
`docs/implementation/evidence/IMPL-13E-X-PUBLIC-PRESS-LANDING-WIRING.md`.
El Project Owner cerro humanamente IMPL-13E-Y el 2026-07-27
(PUB-SAB×2 + FOT-VIE×1 + FOT-SAB×1; R2B). Evidencia en
`docs/implementation/evidence/IMPL-13E-Y-HUMAN-CLOSURE.md` y
`docs/implementation/evidence/IMPL-13E-Y-PUBLIC-PRESS-SANDBOX-E2E.md`.
HEAD de cierre Y: `9668dfe`. SPEC-040 v0.1.1 Payment Pending Expiry
Reconciliation fue APPROVED 2026-07-27. IMPL-14A-2 plan v0.2.0 fue
APPROVED 2026-07-27 por el Project Owner (SHA contenido aprobado
`04BAC5D62D6E3A75F0826AEAE0839D31340369D0156AC1DA09EB9D565D56EC0D`)
tras CTO `READY_FOR_APPROVAL` e IMPL-14A-2V. IMPL-14A-2C documentary
consolidation quedo consolidada, commiteada y pusheada (`e6c812b`), e
IMPL-14A-3A quedo commiteada y pusheada (`ced7c62`) con validacion runtime
ejecutada solo en sandbox, y su cierre documental en `dd2873b`. IMPL-14A-3B
quedo implementada localmente, validada en sandbox `impl-14a-expiry` (0012+0013;
B-ARRAY RESOLVED IN SANDBOX; FIX-2 29/29; matriz 13/13) y publicada en
`6068d5b`; el Project Owner la cerro como `VALIDATED / CLOSED` el 2026-07-29
unicamente para implementacion, pruebas automatizadas y validacion fisica en
sandbox. B-1 (dry-run volatility) quedo FIXED LOCALLY via IMPL-14A-3B-FIX-1.
Main permanece sin 0011/0012/0013/0014. D3C-1/D3C-2 quedaron APPROVED el
2026-07-29. IMPL-14A-3C ejecuto runtime solo en `impl-14a-expiry`: 0014
aplicada, Edge desplegada, lease/concurrencia/dry-run/cap/fallos/SLA probados,
schedule observado cuatro fires y desactivado. El token de SHA autorizado para
0014 tenia 63 caracteres por error documental; el Project Owner ratifico el
SHA canonico de 64 caracteres (`MIGRATION-SHA-001` = RATIFIED).
`BUDGET-GATEWAY-001` fallo primero con FIX-1 (budget 30s redeployado solo al
sandbox, gateway HTTP 504 pese al `partial` interno con budget agotado y lease
liberado) y quedo resuelto con FIX-2 (budget 20s medido desde `startedMs` y gate
previo a cada batch: HTTP externo 200 `partial`, gateway 504 = 0). El Project
Owner cerro IMPL-14A-3C como `VALIDATED / CLOSED` el 2026-07-29
(`America/Merida`) unicamente para
implementacion local, pruebas automatizadas y runtime fisico validado en
sandbox; Main apply, produccion, schedule permanente e IMPL-14A-3D siguen NOT
AUTHORIZED, y permanecen abiertos `OD-040-002`, `OBS-3C-CRONVIEW-001`,
`SBX-CREDENTIAL-003` y el riesgo residual del batch en vuelo.
`SBX-CREDENTIAL-001` fue remediado con recuperacion/verificacion humana sin
divulgacion de la nueva key. Main writes = 0.
IMPL-14A-3D…3G permanecen NOT AUTHORIZED. Gate:
`READY_FOR_CTO_IMPL_14A_3C_DATE_NORMALIZATION_REVIEW`.

```text
IMPL-4: VALIDATED
IMPL-5: VALIDATED / CLOSED
IMPL-6: VALIDATED / CLOSED
IMPL-7: VALIDATED / CLOSED
IMPL-8: VALIDATED / CLOSED
IMPL-9: VALIDATED / CLOSED
IMPL-10: VALIDATED / CLOSED
IMPL-11: VALIDATED / CLOSED
IMPL-12: VALIDATED / CLOSED
IMPL-13B: VALIDATED / CLOSED
IMPL-13C: VALIDATED / CLOSED
IMPL-13D-H: APPROVED / CLOSED
IMPL-13E-0: VALIDATED / CLOSED
IMPL-13E-X: IMPLEMENTED / TECHNICALLY VALIDATED
IMPL-13E-Y: VALIDATED / CLOSED
R2H-LANDING-SBX-1B: VALIDATED / CLOSED (PREVIEW + SANDBOX FUNCTIONAL)
IMPL-14A-3A: VALIDATED / CLOSED (sandbox validation scope only)
IMPL-14A-3B: VALIDATED / CLOSED (sandbox validation scope only)
IMPL-14A-3C: VALIDATED / CLOSED (local + automated tests + sandbox runtime only)
SPEC-040 v0.1.1: APPROVED
IMPL-14A-2 plan v0.2.0: PLAN / APPROVED
InsForge schema 0001-0003: DEPLOYED AND VALIDATED
InsForge catalog migration 0004: APPLIED AND VALIDATED
InsForge checkout TX migration 0005 / v5: APPLIED
InsForge webhook TX migration 0006 / v6: APPLIED
InsForge team roster migration 0007 / v7: APPLIED
InsForge ticket issuance migration 0008 / v8: APPLIED
InsForge webhook order fix migration 0009 / v9: APPLIED ON MAIN
InsForge spectator qty migration 0010 / v10: APPLIED ON MAIN
OD-001: APPROVED
OD-PENDING: D (async methods deferred from initial launch)
OD-022: APPROVED
OD-040-001: cadence/SLA APPROVED; anti-overlap APPROVED (D3C-1 2026-07-29; lease)
OD-040-002: OPEN — PARTIAL sandbox 3C (D3C-2 2026-07-29); compensating
  privilege hardening VALIDATED/CLOSED local+sandbox (B4 2026-07-30);
  TRUE LEAST PRIVILEGE = BLOCKED_BY_PLATFORM_CAPABILITY
  (BLOCKS Main + production + IMPL-14A-3D admin);
  OD-040-002-B5 = MIGRATION CHAIN REVIEW COMPLETE / BLOCKED AT 0015 PRE-FIX
  OD-040-002-B5-FIX1 = LOCAL CORRECTION COMPLETE / PENDING CTO REVIEW
  MIGRATION CHAIN = NO KNOWN STATIC RUNNER BLOCKERS / PENDING CTO REVIEW
OD-040-002 COMPENSATING HARDENING: VALIDATED / CLOSED
  LOCAL + SANDBOX SCOPE (human B4 2026-07-30; B5-FIX1 does not reopen)
R2H-LANDING-SBX-1B: VALIDATED / CLOSED
  PREVIEW + SANDBOX FUNCTIONAL SCOPE (2026-07-31 America/Merida)
  sandbox `impl-13e-public-press`; `PUB-VIE` → `AWAITING_PAYMENT`
  (`terminal=false`); redirect non-authoritative; event restored
  `CONFIGURADO`; hold `RELEASED`; payments 0; tickets 0; synthetic
  `PAYMENT_PENDING` order retained as sandbox evidence only; evidence
  separated from compensating hardening / true least privilege;
  evidence `docs/implementation/evidence/R2H-LANDING-SBX-1B.md`
landing productive: NOT AUTHORIZED
OD-040-002-A: ANALYZING / NOT RESOLVED (2026-07-30) — read-only proposal in
  docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md; gate
  READY_FOR_CTO_OD_040_002_DESIGN_REVIEW; no code/SQL/grant/deploy changes;
  OD-040-002 remains OPEN
OD-040-002-B1: ANALYZING / NOT RESOLVED (2026-07-30) — complete read-only
  inventory of all 24 domain tables, 0 sequences, and 20 sensitive
  functions/RPCs on Main + impl-14a-expiry sandbox, R1/R2/R3 revocation
  candidates, T1-T7 re-evaluation, compensating-hardening contract, and
  OD-040-002-B2/B3 implementation plans, appended to
  docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md; gate
  READY_FOR_CTO_OD_040_002_B1_REVIEW; no GRANT/REVOKE/ALTER
  ROLE/migration/code/test/deploy changes; OD-040-002 remains OPEN
OD-040-002-B2: LOCAL IMPLEMENTATION COMPLETE / PENDING CTO REVIEW
  (2026-07-30) — local-only compensating privilege hardening migration
  insforge/migrations/0015_compensating-privilege-hardening.sql
  (Group R1 from B1: anon/authenticated full-DML revoke on 24 tables;
  project_admin revoke on events/products/event_days/
  participant_sensitive_profiles/activity_log) plus static contract
  test tests/unit/security/compensating-privilege-hardening.test.ts
  (16/16 PASS); full suite 368/368 PASS, expiry 148/148 PASS, typecheck
  PASS, lint PASS, git diff --check PASS; evidence appended to
  docs/implementation/evidence/OD-040-002-TRUE-LEAST-PRIVILEGE.md; gate
  READY_FOR_CTO_OD_040_002_B2_LOCAL_REVIEW; ZERO remote application
  (no sandbox apply, no Main apply, no production apply, no deploy, no
  schedule change); TRUE LEAST PRIVILEGE remains
  BLOCKED_BY_PLATFORM_CAPABILITY; OD-040-002 remains OPEN; Main,
  production, IMPL-14A-3D, and landing sandbox integration remain NOT
  AUTHORIZED by this unit; next step OD-040-002-B3 sandbox validation
OD-040-002-B3: VALIDATION_FAILED / PENDING CTO REVIEW (2026-07-30) —
  sandbox-only: 0015 REVOKE DCL re-applied and privilege matrix 336/336
  false confirmed; anon REST SELECT/INSERT/UPDATE/DELETE → 42501;
  project_admin R1 effective; THEN checkout_start_tx FAILED with
  permission denied for table products because SELECT FOR UPDATE on
  products/events requires UPDATE (revoked by R1). Documented GRANT
  rollback executed; privileges restored to pre-hardening baseline;
  migration history still records version 15 (inconsistency). Main
  untouched (max migration 10). Local suites still 368/368 PASS.
  TRUE LEAST PRIVILEGE remains BLOCKED_BY_PLATFORM_CAPABILITY;
  OD-040-002 remains OPEN; Main/production/IMPL-14A-3D/landing NOT
  AUTHORIZED; do not re-apply 0015 as written — R1 must be redesigned
OD-040-002-B2-FIX1: LOCAL IMPLEMENTATION COMPLETE / CTO REVIEW PASS
  (2026-07-30) — local-only correction migration
  insforge/migrations/0016_compensating-privilege-hardening-checkout-
  compatibility.sql; 0015 immutable
  (A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B);
  project_admin UPDATE on events/products reclassified
  REQUIRED_ONLY_BEHIND_RPC (GRANT UPDATE + REVOKE INSERT/DELETE/
  TRUNCATE); anon/authenticated deny-all on 24 tables reasserted;
  event_days / participant_sensitive_profiles / activity_log R1
  retained; security tests 33/33 PASS; checkout 43/43; capacity 24/24;
  expiry 148/148; full suite 385/385; typecheck/lint/diff-check PASS;
  ZERO remote writes; gate
  READY_FOR_CTO_OD_040_002_B2_FIX1_LOCAL_REVIEW (passed); OD-040-002
  remains OPEN; TRUE LEAST PRIVILEGE remains
  BLOCKED_BY_PLATFORM_CAPABILITY; Main/production/IMPL-14A-3D/landing
  NOT AUTHORIZED; next step was sandbox revalidation of 0016
OD-040-002-B3-RETEST: VALIDATION_FAILED / RUNNER TCL INCOMPATIBILITY
  (2026-07-30) — sandbox-only attempt to apply 0016 via
  `npx @insforge/cli db migrations up
  0016_compensating-privilege-hardening-checkout-compatibility.sql`
  failed with: "Transaction control statements are not allowed"
  because pre-FIX2 0016 contained BEGIN/COMMIT (InsForge runner wraps
  each migration in its own transaction). Atomicity confirmed:
  migration max remains 15; privileges remain pre-hardening baseline;
  0016 not registered; Main untouched (max 10). Local suites still
  385/385 PASS at retest time. Per B3-RETEST failure protocol: no
  improvised DCL apply, no new migration in that unit. OD-040-002
  remains OPEN; TRUE LEAST PRIVILEGE remains
  BLOCKED_BY_PLATFORM_CAPABILITY; Main/production/IMPL-14A-3D/landing
  NOT AUTHORIZED
OD-040-002-B2-FIX2: LOCAL CORRECTION COMPLETE / CTO REVIEW PASS
  (2026-07-30) — local-only runner-compatible correction of 0016:
  removed executable BEGIN/COMMIT; DCL GRANT/REVOKE contract unchanged;
  0015 immutable
  (A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B);
  0016 pre-FIX2
  8A407FA5A59FF250FB7C2AC9C36D157DC637A11995FC2753835B8FD4014031B2 →
  post-FIX2
  F81C8021E77270DA915137275738ED741912F8C4F32DB47F8EB4D2BD7A1A346A;
  remote read-only confirmed migration 16 absent (max=15) so 0016 may
  be edited locally (no 0017); RCF1–RCF14 security 47/47; checkout
  43/43; logical-capacity 24/24; expiry 148/148; full suite 399/399;
  typecheck/lint/diff-check PASS; remote writes = 0; gate
  READY_FOR_CTO_OD_040_002_B2_FIX2_LOCAL_REVIEW; OD-040-002 remains
  OPEN; TRUE LEAST PRIVILEGE remains BLOCKED_BY_PLATFORM_CAPABILITY;
  Main/production/IMPL-14A-3D/landing NOT AUTHORIZED; next step is a
  separately authorized sandbox retest of runner-compatible 0016
OD-040-002-B3-RETEST2: PRIVILEGE AND CORE FUNCTIONAL CRITERIA MET
  (2026-07-30) — applied runner-compatible 0016 on impl-14a-expiry via
  normal migrations up (hash
  F81C8021E77270DA915137275738ED741912F8C4F32DB47F8EB4D2BD7A1A346A);
  migration max=16; public_true_336=0; project_admin events/products
  SELECT+UPDATE kept / INSERT DELETE TRUNCATE revoked; other R1 active;
  R2/R3 intact; checkout_start_tx PASS; webhook_apply_payment_tx PASS +
  idempotent replay; expiry batch processed=0 + lease acquire/release
  PASS; activity_log direct UPDATE DENIED; get-order-status Edge then
  deferred to FIX1 (CONFIGURATION_ERROR CORS); transactional
  BEGIN/ROLLBACK probe NOT OBSERVABLE; local 399/399 PASS;
  OD-040-002 remains OPEN; TRUE LEAST PRIVILEGE remains
  BLOCKED_BY_PLATFORM_CAPABILITY; Main/production/IMPL-14A-3D/landing
  NOT AUTHORIZED
OD-040-002-B3-RETEST2-FIX1: SANDBOX FUNCTIONAL CLOSEOUT / CTO REVIEW PASS
  (2026-07-30) — sandbox closeout on impl-14a-expiry only: added secret
  ORDER_STATUS_CORS_ORIGIN = https://3e9sriq7.insforge.site (documented
  landing preview from IMPL-13E-Y-R2A/R2B); no redeploy required;
  get-order-status GET ?reference= → HTTP 200 AWAITING_PAYMENT for
  PREFERENCE_PENDING order; unauthorized Origin → 403 ORIGIN_NOT_ALLOWED;
  RETEST2 participant + orphan event residuals = 0; 0016 hardening still
  active (max=16); schedule inactive; leases=0; local 399/399 +
  origin-guard 13/13 PASS; OD-040-002 remains OPEN; TRUE LEAST PRIVILEGE
  remains BLOCKED_BY_PLATFORM_CAPABILITY; Main/production/IMPL-14A-3D/
  landing NOT AUTHORIZED
OD-040-002-B4: HUMAN VALIDATED / CLOSED LOCAL + SANDBOX SCOPE
  (2026-07-30) — documentation-only human closure of compensating
  privilege hardening track; 0015 historical + 0016 runner/checkout-
  compatible active on sandbox; privileges and functional regressions
  accepted; OD-040-002 remains OPEN; TRUE LEAST PRIVILEGE remains
  BLOCKED_BY_PLATFORM_CAPABILITY; Main apply / production /
  IMPL-14A-3D / landing productiva NOT AUTHORIZED; landing sandbox
  integration ELIGIBLE FOR A SEPARATE AUTHORIZED UNIT only; gate
  READY_FOR_CTO_OD_040_002_COMPENSATING_CLOSURE_REVIEW
OD-040-002-B5: MIGRATION CHAIN REVIEW COMPLETE / BLOCKED AT 0015 PRE-FIX
  (2026-07-30) — analyze+docs: clean Main path 10→16 was
  NO — BLOCKED AT 0015 (executable BEGIN;/COMMIT;). Alt A recommended.
  CTO REVIEW PASS. Hardening closure B4 unchanged.
OD-040-002-B5-FIX1: LOCAL CORRECTION COMPLETE / PENDING CTO REVIEW
  (2026-07-31) — local-only: removed executable BEGIN;/COMMIT; from
  0015; DCL 29 REVOKEs semantically identical (normalized DCL hash
  5E98DBC2…949A unchanged); historical hash
  A0E43B4FA12AD6BD36FD71947FC07142904FD6AA2EDF35F9A544BFA7B3A0C80B
  retained as lineage; canonical
  0F6484819A0DCA8B00C12FD1729BEFA9B45DEBAA8B3F2A61B96578CF50159E4C;
  0011–0014 and 0016 hashes unchanged; chain static
  NO KNOWN STATIC RUNNER BLOCKERS; security MCF suite + full local
  regressions; remote writes = 0; commit/push NOT AUTHORIZED;
  Main/production/IMPL-14A-3D/landing NOT AUTHORIZED; gate
  READY_FOR_CTO_OD_040_002_B5_FIX1_LOCAL_REVIEW
OD-040-003: DEFERRED_TO_OPERATIONAL_RUNBOOK
Catalog: 1 event / 3 days / 28 products
Commercial target prices (landing): APPROVED (OPCIÓN B)
Main canonical price update: PENDING SEPARATE UNIT
Event status (Main): CONFIGURADO
Sandbox branches ACTIVE:
  impl-13e-public-press / 4bg9ufz2-6mq / 4227c38d-f6c9-4ee4-aa6f-d05fb4b19693 (full)
  impl-14a-expiry / 4bg9ufz2-2w7 / 2921e092-aed6-4abb-93be-946c42eee82a (schema-only, v11)
Sandbox branches RETIRED:
  impl-13b-spectator-wiring / 4bg9ufz2-rug / c4719a08-4709-4bee-9dfb-8539df5b715b
  (retired during IMPL-14A-3A-SBX-PROVISION)
Mercado Pago production webhook: NOT CONFIGURED
Mercado Pago test webhook: TOPICS NONE / CALLBACK DISABLED (human-confirmed; URL may remain stored)
TEAM_ROSTER_REMINDERS: DEFERRED / NOT AUTHORIZED
EMAIL_PROVIDER / TICKET_EMAIL_DELIVERY: DEFERRED / NOT AUTHORIZED
PUBLIC_TICKET_RETRIEVAL: DEFERRED / NOT AUTHORIZED
PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING: REQUIRED BEFORE PRODUCTION / NOT CLOSED
PAYMENT_PENDING_EXPIRY_RECONCILIATION: OPEN / REQUIRED BEFORE PRODUCTION
OD-019 commercial folio: OPEN
OD-020 multiday: OPEN / FAIL-CLOSED (checkout + ticket)
check-in / manifest: NOT IMPLEMENTED / NOT AUTHORIZED
IMPL_12_HUMAN_CLOSED
IMPL_13B_HUMAN_CLOSED
IMPL_13C_HUMAN_CLOSED
IMPL_13D_H_APPROVED_CLOSED
IMPL_13E_0_VALIDATED_CLOSED
IMPL_13E_X_TECHNICALLY_VALIDATED
IMPL_13E_Y_HUMAN_CLOSED
R2H_LANDING_SBX_1B_VALIDATED_CLOSED
IMPL_14A_2_PLAN_APPROVED
IMPL_14A_3A_CODE_REVIEW_PASSED
IMPL_14A_3A_SANDBOX_RUNTIME_VALIDATION_EXECUTED
IMPL_14A_3A_COMMIT_PUSH_COMPLETED (ced7c62)
IMPL_14A_3A_CTO_RUNTIME_REVIEW_PASSED
IMPL_14A_3A_ARTIFACT_FIX_REVIEW_PASSED
IMPL_14A_3A_ARTIFACT_FILENAME_CORRECTION_COMPLETED
IMPL_14A_3A_HUMAN_CLOSED (2026-07-28; sandbox validation scope only)
IMPL_14A_3A_MAIN_APPLY: NOT AUTHORIZED
IMPL_14A_3B: VALIDATED / CLOSED
IMPL_14A_3B_LOCAL_IMPLEMENTATION: COMPLETED
IMPL_14A_3B_SANDBOX_RUNTIME: EXECUTED
IMPL_14A_3B_CTO_RUNTIME_REVIEW: PASSED
IMPL_14A_3B_B_ARRAY: RESOLVED IN SANDBOX
IMPL_14A_3B_0012_SANDBOX_APPLY: EXECUTED
IMPL_14A_3B_0013_SANDBOX_APPLY: EXECUTED
IMPL_14A_3B_FIX_2_RETEST: PASSED
IMPL_14A_3B_PUBLISHED_COMMIT: 6068d5b160169eba81719d3f01c366b419fcb77b
IMPL_14A_3B_MAIN_APPLY: NOT AUTHORIZED
IMPL_14A_3B_HUMAN_CLOSED (2026-07-29; sandbox validation scope only)
IMPL_14A_3C: VALIDATED / CLOSED
IMPL_14A_3C_CLOSURE_SCOPE: local implementation + automated tests +
sandbox physical runtime ONLY
IMPL_14A_3C_HUMAN_CLOSED (2026-07-29 America/Merida; sandbox validation scope only)
IMPL_14A_3C_D3C_1: APPROVED (2026-07-29; durable lease; no 0012/0013 edits)
IMPL_14A_3C_D3C_2: APPROVED sandbox compensating controls (2026-07-29)
IMPL_14A_3C_RUNTIME_SHAPE: batch_tx(limit:1); max 25/run; sandbox budget 20s
from startedMs; 1 min
IMPL_14A_3C_0014_SANDBOX_APPLY: EXECUTED / ACTUAL 64-CHAR SHA RECORDED
IMPL_14A_3C_EDGE_SANDBOX_DEPLOY: EXECUTED
IMPL_14A_3C_SCHEDULE: EXECUTED / 4 FIRES / INACTIVE AFTER TEST
IMPL_14A_3C_SECRET: SANDBOX CONFIGURED / VALUE NOT RECORDED
IMPL_14A_3C_SLA: PASS / 51.152927 SECONDS
IMPL_14A_3C_MIGRATION_SHA_001: RATIFIED BY PROJECT OWNER
IMPL_14A_3C_CANONICAL_0014_SHA: 92068A6524DCFDFDCBF6DF6B353E7785D8A55050D0D8275E1B69F8CC169DE000
IMPL_14A_3C_BUDGET_GATEWAY_001: RESOLVED IN SANDBOX SCOPE /
CLOSED 2026-07-29 AMERICA/MERIDA
IMPL_14A_3C_IN_FLIGHT_BATCH_RESIDUAL_RISK: OPEN / RE-EVALUATE BEFORE MAIN
IMPL_14A_3C_FIX_1_RUN_BUDGET_MS: 30000 DEPLOYED ONLY TO SANDBOX
IMPL_14A_3C_FIX_1_SANDBOX_RETEST: EXECUTED / VALIDATION_FAILED
IMPL_14A_3C_FIX_1_INTERNAL_RESULT: PARTIAL / BUDGET_EXHAUSTED / LEASE RELEASED
IMPL_14A_3C_FIX_1_PUBLIC_HTTP: 504 / CLIENT DURATION 30496 MS
IMPL_14A_3C_FIX_1_LOCAL_AUTOMATED_VALIDATION: 348/348 + 144/144 PASS
IMPL_14A_3C_FIX_2_SCOPE_AMENDMENT_1: APPROVED (2026-07-29; scheduler test authorized)
IMPL_14A_3C_FIX_2_RUN_BUDGET_MS: 20000 DEPLOYED ONLY TO SANDBOX
IMPL_14A_3C_FIX_2_DEADLINE_ORIGIN: startedMs (budgetStartedMs REMOVED)
IMPL_14A_3C_FIX_2_PRE_BATCH_GATE: elapsed >= RUN_BUDGET_MS -> NO NEW BATCH
IMPL_14A_3C_FIX_2_LOCAL_AUTOMATED_VALIDATION: 352/352 + 148/148 PASS
IMPL_14A_3C_FIX_2_LOCAL: IMPLEMENTED / CTO REVIEW PASS
IMPL_14A_3C_FIX_2_SANDBOX_RETEST: EXECUTED / PASS / CTO RUNTIME REVIEW PASS
IMPL_14A_3C_FIX_2_SANDBOX_DEPLOY: payment-pending-expiry ONLY / sjpyyrc0etaf
IMPL_14A_3C_FIX_2_EXTERNAL_HTTP: 200 partial / budget_exhausted true /
lease_released true / gateway_504 0 / client 22098.605 ms /
internal 21408.765834 ms / margin 8397.4 ms vs 30496 ms
IMPL_14A_3C_FIX_2_REMOTE_REGRESSIONS: 5/5 PASS (max_items, overlap, fatal batch,
fatal release, no candidates)
IMPL_14A_3C_FIX_2_CLEANUP: fixtures 0 / harness fns 0 / triggers 0 /
grants restored / retained leases 0 / schedule INACTIVE
IMPL_14A_3C_SBX_CREDENTIAL_001: REMEDIATED / METADATA PASS / DISCLOSURE 0
IMPL_14A_3C_SBX_CREDENTIAL_003: OPEN / NON-BLOCKING / DISCLOSURE 0
IMPL_14A_3C_OBS_3C_CRONVIEW_001: OPEN / NON-BLOCKING
IMPL_14A_3C_OBS_3C_ENV_001: RESOLVED IN SANDBOX / ENVIRONMENT SANDBOX
IMPL_14A_3C_LOCAL_AUTOMATED_VALIDATION: PASSED
IMPL_14A_3C_MAIN: UNTOUCHED / WRITES 0 / MIGRATION MAX 10
IMPL_14A_3C_HUMAN_VALIDATION_CLOSURE: PERFORMED 2026-07-29 AMERICA/MERIDA /
SANDBOX SCOPE ONLY
IMPL_14A_3C_GOVERNANCE_TIMEZONE: America/Merida (execution timestamps stay UTC Z)
IMPL_14A_3C_MAIN_APPLY: NOT AUTHORIZED
IMPL_14A_3C_SCHEDULE_ACTIVATION: NOT AUTHORIZED
IMPL_14A_3C_TRUE_LEAST_PRIVILEGE: OPEN / BLOCKS MAIN + PRODUCTION + 3D
IMPL_14A_3C_EVIDENCE: docs/implementation/evidence/IMPL-14A-3C-SBX-RUNTIME.md
PRODUCTION: NO-GO
Next: CTO review of the IMPL-14A-3C closure date normalization
(no Main apply of 0011/0012/0013/0014; no Main deploy/schedule/secret;
IMPL-14A-3D still NOT AUTHORIZED)
Gate: READY_FOR_CTO_IMPL_14A_3C_DATE_NORMALIZATION_REVIEW
LANDING_READY_FOR_READY2HYBRID_MATCH
```

El esquema minimo de ventas, el catalogo Hybrid Event, el inicio de checkout,
el webhook firmado, el estado publico read-only, el roster backend y la
emision server-side de tickets/QR hasheados ya estan en InsForge
(`ready2hybrid` / `4bg9ufz2.us-east`), incluyendo la correccion v9 del orden
payment/verification y la capacidad spectator multi-quantity (v10). El E2E
spectator sandbox PUB-VIE (IMPL-13C) y el E2E public/press sandbox
(IMPL-13E-Y) quedaron validados y cerrados. El Project Owner fijo precios
comerciales objetivo (landing) bajo OPCIÓN B; la actualizacion canonica de
Main queda pendiente de unidad separada. SPEC-040 y el plan IMPL-14A-2
estan APPROVED. IMPL-14A-3A implementa la exclusion logica de cupo con
predicado null-safe (FIX-1) evaluado contra un reloj canonico capturado tras
los locks (FIX-2); su validacion runtime se ejecuto exclusivamente en el
sandbox `impl-14a-expiry` (v11), donde I007/R004/AC003 quedaron PASS con
lock-wait fisico discriminante, y el artefacto se renombro a
`0011_logical-capacity-expiry-exclusion.sql` sin alterar sus bytes ni su
SHA-256. La evidencia saneada quedo en
`docs/implementation/evidence/IMPL-14A-3A-SBX-RUNTIME.md`. El Project Owner
cerro IMPL-14A-3A como `VALIDATED / CLOSED` el 2026-07-28 unicamente para su
alcance de implementacion y validacion en sandbox.
Main permanece en v1–v10 sin 0011 y su aplicacion no esta autorizada.
El Project Owner cerro IMPL-14A-3B como `VALIDATED / CLOSED` el 2026-07-29
unicamente para implementacion, pruebas automatizadas y validacion fisica en
sandbox `impl-14a-expiry` (evidencia en
`docs/implementation/evidence/IMPL-14A-3B-SBX-RUNTIME.md`; commit publicado
`6068d5b`). B-ARRAY = RESOLVED IN SANDBOX; FIX-2 retest 29/29; matriz 13/13.
Main permanece sin 0011/0012/0013/0014. El cierre no autoriza Main apply, produccion,
ni el cierre de hallazgos diferidos (TX-2, PREFERENCE_PENDING, rate limiting,
outbox). El Project Owner aprobo el 2026-07-29 D3C-1 (lease durable global en
`idempotency_records`, TTL 90s, `overlap_skipped`; sin modificar 0012/0013 ni
advisory locks) y D3C-2 sandbox (schedule secret exclusivo, actor_ref
`system:payment-pending-expiry`, allowlist RPC, `project_admin` compensatorio
temporal). True least privilege sigue OPEN y bloquea Main, produccion y 3D.
Forma runtime aprobada: max 25/run, `batch_tx(limit:1)` sucesivo, budget 45s,
cadencia 1 min. La validacion runtime de IMPL-14A-3C se ejecuto unicamente en
`impl-14a-expiry`: 0014 aplicada; su SHA real de 64 caracteres fue registrado,
el Project Owner ratifico ese SHA como canonico y confirmo que el token previo
de 63 caracteres fue un error documental (`MIGRATION-SHA-001` = RATIFIED);
lease L1-L10 PASS con
concurrencia real, Edge desplegada, dry-run zero-write, fatal batch/release 503,
cap 25 y commit por orden probados, schedule observado cuatro fires y desactivado,
y SLA de 51.152927s PASS. El contrato de budget 45s no pudo devolver HTTP 200
antes del 504 del gateway (`BUDGET-GATEWAY-001` = CONFIRMED). FIX-1 cambia
unicamente el budget a 30s y fue redeployado solo en sandbox. El retest fisico
termino internamente `partial`, `budget_exhausted=true`, lease liberado y cuatro
agregados durablemente expirados a 30997.408915 ms, pero el gateway devolvio
HTTP 504 a 30496 ms; `BUDGET-GATEWAY-001` sigue fallando. La API key sandbox
fue recuperada y verificada sin divulgar la nueva credencial; el secret del
schedule no fue revelado. `INSFORGE_ENVIRONMENT=sandbox`. Evidencia:
`docs/implementation/evidence/IMPL-14A-3C-SBX-RUNTIME.md`.
FIX-2 se implemento y valido unicamente en local, bajo Scope Amendment-1: el
deadline operativo baja de 30s a 20s y se mide desde `startedMs` (inicio total
de la ejecucion) en lugar de un reloj posterior al lease, con comprobacion
obligatoria inmediatamente anterior a cada `runBatch`
(`elapsed >= RUN_BUDGET_MS` -> sin nuevo batch, `partial`,
`budget_exhausted=true`, lease liberado, HTTP 200). Contadores, contrato HTTP,
lease TTL 90s, cap 25/50, batch limit 1, cadencia 1 min y dry-run permanecen
intactos; migraciones 0012/0013/0014 no fueron tocadas. Local: 352/352 y
148/148 PASS, typecheck y lint PASS, `git diff --check` PASS, interaccion
remota 0.
El 2026-07-29 (`America/Merida`; 2026-07-30 UTC) se ejecuto el retest fisico de
FIX-2 en `impl-14a-expiry`: se
redesplego unicamente `payment-pending-expiry` (bundle con `RUN_BUDGET_MS`
20_000 y medicion desde `startedMs`), el contrato HTTP volvio a dar
405/401/403/400/200 con `environment=sandbox`, y el harness de cinco agregados
sinteticos con retardo de 7 s por item atraveso el deadline: HTTP externo 200,
`outcome=partial`, `budget_exhausted=true`, `lease_released=true`, gateway 504 =
0, 3 batches iniciados y completados, el cuarto bloqueado por el gate, 3
agregados durablemente expirados con exactamente un audit cada uno, 22098.605 ms
observados por el cliente frente al corte anterior de 30496 ms. Las cinco
regresiones remotas autorizadas pasaron y toda la instrumentacion temporal
(fixtures, funcion y trigger de retardo, grants, leases y bundle) fue eliminada;
el schedule sigue inactivo sin ejecuciones futuras. Main volvio a inspeccionarse
en solo lectura antes y despues: v1-v10, sin 0011-0014, sin funcion, sin
fixtures y con writes 0. Quedan abiertos, sin bloquear, `SBX-CREDENTIAL-003`
(`branch list --json` expone envolturas cifradas de credenciales, no
reproducidas) y `OBS-3C-CRONVIEW-001` (el schedule store de Main no es legible
sin enlazar o cambiar de rama). `BUDGET-GATEWAY-001` = PHYSICALLY SATISFIED IN
SANDBOX. El riesgo residual continua ABIERTO: un batch en vuelo mas lento que
~10 s podria volver a acercarse al corte porque el contrato deja terminar el
batch ya iniciado, y debe reevaluarse antes de Main y produccion.
El 2026-07-29 (`America/Merida`) el propietario humano reviso la recomendacion
CTO y cerro
IMPL-14A-3C como `VALIDATED / CLOSED` exclusivamente para implementacion local,
pruebas automatizadas y runtime fisico validado en sandbox, conservando intactas
las evidencias de FIX-1 y FIX-2. El cierre no autoriza escrituras en Main,
produccion, activacion del schedule, nuevos deploys, migraciones, Mercado Pago,
IMPL-14A-3D, staging, commit ni push, y deja abiertos `OD-040-002`,
`OBS-3C-CRONVIEW-001`, `SBX-CREDENTIAL-003`, el riesgo residual del batch en
vuelo, la aplicacion a Main, produccion, IMPL-14A-3D, rate limiting y los
diferidos documentados (outbox incluido). Las fechas humanas y de gobierno de
IMPL-14A-3C quedaron normalizadas a la zona canonica `America/Merida`
(validacion y cierre humano = 2026-07-29); los timestamps de ejecucion siguen
registrados en UTC con sufijo `Z` en la evidencia, sin alteracion.
Gate `READY_FOR_CTO_IMPL_14A_3C_DATE_NORMALIZATION_REVIEW`.
El evento canonico Main permanece en `CONFIGURADO`. Ventas productivas,
webhook productivo y conexion de landing a ventas reales no estan
autorizados. Casos A–D PASS; Case E y metodos async quedan diferidos del
lanzamiento inicial. Recordatorios, correo y recuperacion publica de QR
permanecen diferidos. Productos multiday permanecen fail-closed. Check-in
y manifiesto no fueron implementados. Antes de produccion permanecen
abiertos `PAYMENT_PENDING_EXPIRY_RECONCILIATION` y
`PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING`.
La landing publica existente permanece protegida (checkout off por defecto):

```text
LANDING_READY_FOR_READY2HYBRID_MATCH
```

La sustitucion de imagenes de template por imagenes propias es una tarea visual
independiente y no bloqueante.

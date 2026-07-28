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
  - OD-040-001: cadence/SLA APPROVED (1 min / ≤5 min); anti-overlap OPEN; BLOCKS 3C
  - OD-040-002: OPEN — separate reconciler vs admin actors; `project_admin` ≠ least privilege; BLOCKS 3C and 3D
  - OD-040-003: DEFERRED_TO_OPERATIONAL_RUNBOOK (refund task markers only in IMPL-14A)
  - Gate: CTO post-push review of IMPL-14A-3A traceability
  - IMPL-14A-3A: logical capacity expiry exclusion (SPEC-040-I007/R004)
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
  - IMPL-14A-3B: NOT AUTHORIZED / NOT STARTED
  - IMPL-14A-3C…3G: NOT AUTHORIZED
  - Main remote apply / cron / edges: NOT AUTHORIZED
- PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING: OPEN / REQUIRED BEFORE PRODUCTION
- PRODUCTION: NO-GO
- Next: CTO post-push review of IMPL-14A-3A traceability;
  no Main apply / IMPL-14A-3B+ / cron until separately authorized
- InsForge sandbox branches ACTIVE:
  `impl-13e-public-press` / `4bg9ufz2-6mq` — Project ID
  `4227c38d-f6c9-4ee4-aa6f-d05fb4b19693`; mode `full` (IMPL-13E surface)
  `impl-14a-expiry` / `4bg9ufz2-2w7` — Project ID
  `2921e092-aed6-4abb-93be-946c42eee82a`; mode `schema-only`; migration max 11
  (IMPL-14A-3A runtime evidence)
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

`READY_FOR_CTO_POST_PUSH_REVIEW`

Siguiente accion permitida:

1. revisar la trazabilidad post-push de IMPL-14A-3A; code review CTO PASSED,
   validacion local automatizada PASSED, runtime/sandbox EXECUTED con revision
   CTO PASSED y correccion del nombre del artefacto COMPLETED; aplicacion en
   Main NOT AUTHORIZED; produccion NO-GO;
2. no iniciar IMPL-14A-3B…3G sin autorizacion humana explicita separada;
3. no aplicar migracion 0011 en Main; v11 permanece solo en el sandbox
   `impl-14a-expiry`;
4. no crear schedules/cron, edge functions, dry-run reconciler ni admin recovery;
5. no persistir EXPIRED de orden/hold/ORDER_HOLDER ni cancelar registrations;
   no agregar NOT NULL a `capacity_holds.expires_at` ni reparar filas historicas;
6. no ejecutar pagos/reembolsos ni Main `EN_VENTA`;
7. no versionar `.cursor/*`; prohibido `git add -A`;
8. no commit ni push hasta autorizacion humana explicita;
9. no abrir PUB-3D / FOT-3D hasta resolver OD-020;
10. no cerrar produccion sin `PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING`.

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
ejecutada solo en sandbox. IMPL-14A-3B…3G permanecen NOT AUTHORIZED.
Siguiente unidad autorizada: revision CTO de la correccion de nombre del
artefacto 0011 (sin commit/push hasta autorizacion).

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
OD-040-001: cadence/SLA APPROVED; anti-overlap OPEN (BLOCKS 3C)
OD-040-002: OPEN (BLOCKS 3C + 3D)
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
IMPL_14A_2_PLAN_APPROVED
IMPL_14A_3A_CODE_REVIEW_PASSED
IMPL_14A_3A_SANDBOX_RUNTIME_VALIDATION_EXECUTED
IMPL_14A_3A_COMMIT_PUSH_COMPLETED (ced7c62)
IMPL_14A_3A_CTO_RUNTIME_REVIEW_PASSED
IMPL_14A_3A_ARTIFACT_FIX_REVIEW_PASSED
IMPL_14A_3A_ARTIFACT_FILENAME_CORRECTION_COMPLETED
IMPL_14A_3A_MAIN_APPLY: NOT AUTHORIZED
IMPL_14A_3B: NOT AUTHORIZED / NOT STARTED
PRODUCTION: NO-GO
Next: CTO post-push review of IMPL-14A-3A traceability (no Main apply until authorized)
Gate: READY_FOR_CTO_POST_PUSH_REVIEW
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
`docs/implementation/evidence/IMPL-14A-3A-SBX-RUNTIME.md`.
Main permanece en v1–v10 sin 0011 y su aplicacion no esta autorizada.
IMPL-14A-3B…3G no estan autorizadas.
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

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
- InsForge sandbox branch retained: `impl-13b-spectator-wiring` / `4bg9ufz2-rug`
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
- IMPL-13E-Y public/press sandbox E2E: PAYMENTS AND DOMAIN ARTIFACTS VALIDATED / HTTPS AUTO_RETURN REACHABILITY PROVEN / RETURN PUBLIC REF BINDING GAP OPEN
  (PUB-SAB×2 + FOT-VIE×1 + FOT-SAB×1 `170723724364`; preview return reached; `?ref=` binding gap recorded)
- IMPL-13E-Y-R1 residual forensics: VALIDATED / CLOSED (ORDER_HOLDER expected; unpaid invariants PASS)
- IMPL-13E-Y-R2A HTTPS preview + confirming: EXECUTED / CLOSED into R2B
  (preview `https://3e9sriq7.insforge.site` @ landing `b4f50c0`)
- IMPL-13E-Y-R2B single HTTPS auto-return payment: EXECUTED / READY_FOR_IMPL_13E_Y_HUMAN_CLOSURE_REVIEW
  (FOT-SAB×1 $350 · payment `170723724364` · confirming APPROVED with correct `trk_…692…`)
- Commercial target prices (landing-visible): APPROVED — Main canonical update PENDING separate unit
- Multiday PUB-3D / FOT-3D: FAIL-CLOSED pending OD-020 (checkout + ticket layers)
- PAYMENT_PENDING_EXPIRY_RECONCILIATION: OPEN / REQUIRED BEFORE PRODUCTION
- RETURN_PUBLIC_REF_BINDING: OPEN (static back_url lacks `?ref=`; landing sessionStorage required today)
- Next: human closure review of IMPL-13E-Y (or authorize return-ref binding fix unit)
- InsForge sandbox branches retained:
  `impl-13b-spectator-wiring` / `4bg9ufz2-rug` (IMPL-13C evidence)
  `impl-13e-public-press` / `4bg9ufz2-6mq` (IMPL-13E surface)
- Landing: spectator sandbox wiring + atomic submit (flags default off; prod host blocked)
- Note: Cursor InsForge MCP targets Main; sandbox ops must use CLI `4bg9ufz2-rug`
- `.cursor/settings.json`: local Stripe plugin enablement — UNTRACKED

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

`READY_FOR_IMPL_13E_Y_PUBLIC_PRESS_SANDBOX_E2E_APPROVAL`

Siguiente accion permitida:

1. preparar/ejecutar IMPL-13E-Y solo con autorizacion humana explicita;
2. no modificar precios canonicos de Main hasta una unidad de precios separada;
3. no declarar OXXO/vouchers validados; metodos async siguen diferidos;
4. no abrir ventas en Main ni cambiar el evento canónico Main de `CONFIGURADO`;
5. no conectar la landing a ventas productivas ni habilitar checkout en el host
   de produccion;
6. no configurar webhook productivo ni credenciales productivas;
7. no versionar `.cursor/settings.json` ni autenticar Stripe sin unidad aparte;
8. mantener webhook de produccion NOT CONFIGURED; prueba solo en sandbox/test;
9. no cerrar produccion sin `PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING`;
10. no abrir PUB-3D / FOT-3D hasta resolver OD-020.

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
Catalog: 1 event / 3 days / 28 products
Commercial target prices (landing): APPROVED (OPCIÓN B)
Main canonical price update: PENDING SEPARATE UNIT
Event status (Main): CONFIGURADO
Sandbox branches:
  impl-13b-spectator-wiring / 4bg9ufz2-rug (IMPL-13C evidence)
  impl-13e-public-press / 4bg9ufz2-6mq (IMPL-13E surface)
Mercado Pago production webhook: NOT CONFIGURED
Mercado Pago test webhook: TOPICS NONE / CALLBACK DISABLED (human-confirmed; URL may remain stored)
TEAM_ROSTER_REMINDERS: DEFERRED / NOT AUTHORIZED
EMAIL_PROVIDER / TICKET_EMAIL_DELIVERY: DEFERRED / NOT AUTHORIZED
PUBLIC_TICKET_RETRIEVAL: DEFERRED / NOT AUTHORIZED
PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING: REQUIRED BEFORE PRODUCTION / NOT CLOSED
OD-019 commercial folio: OPEN
OD-020 multiday: OPEN / FAIL-CLOSED (checkout + ticket)
check-in / manifest: NOT IMPLEMENTED / NOT AUTHORIZED
IMPL_12_HUMAN_CLOSED
IMPL_13B_HUMAN_CLOSED
IMPL_13C_HUMAN_CLOSED
IMPL_13D_H_APPROVED_CLOSED
IMPL_13E_0_VALIDATED_CLOSED
IMPL_13E_X_TECHNICALLY_VALIDATED
Next prepared: IMPL-13E-Y (public/press sandbox E2E)
Gate: READY_FOR_IMPL_13E_Y_PUBLIC_PRESS_SANDBOX_E2E_APPROVAL
LANDING_READY_FOR_READY2HYBRID_MATCH
```

El esquema minimo de ventas, el catalogo Hybrid Event, el inicio de checkout,
el webhook firmado, el estado publico read-only, el roster backend y la
emision server-side de tickets/QR hasheados ya estan en InsForge
(`ready2hybrid` / `4bg9ufz2.us-east`), incluyendo la correccion v9 del orden
payment/verification y la capacidad spectator multi-quantity (v10). El E2E
spectator sandbox PUB-VIE quedo validado y cerrado. El Project Owner fijo
precios comerciales objetivo (landing) bajo OPCIÓN B; la actualizacion
canonica de Main queda pendiente de unidad separada. IMPL-13E queda preparado
para expansion sandbox public/press de un dia (sin multiday). El evento
canonico Main permanece en `CONFIGURADO`. Ventas productivas, webhook
productivo y conexion de landing a ventas reales no estan autorizados. Casos
A–D PASS; Case E y metodos async quedan diferidos del lanzamiento inicial.
Recordatorios, correo y recuperacion publica de QR permanecen diferidos.
Productos multiday permanecen fail-closed. Check-in y manifiesto no fueron
implementados. Antes de produccion permanece abierto
`PUBLIC_ENDPOINT_ABUSE_AND_RATE_LIMITING`.
La landing publica existente permanece protegida (checkout off por defecto):

```text
LANDING_READY_FOR_READY2HYBRID_MATCH
```

La sustitucion de imagenes de template por imagenes propias es una tarea visual
independiente y no bloqueante.

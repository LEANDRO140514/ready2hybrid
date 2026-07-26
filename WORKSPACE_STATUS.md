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
- IMPL-12 sandbox E2E: CORRECTIVE_VALIDATION_FAILED / NOT CLOSED
  (R3: migration 0009 fixes payment-before-verification on branch — HTTP 200 +
  verification.payment_id NOT NULL; Case A full checklist FAIL due to expired hold
  → REQUIRES_REVIEW / no tickets; Main still migrations v1–v8)
- InsForge branches R1/R2/R3 sandbox: DELETED
- Mercado Pago test webhook: URL STORED (may point at deleted R3 host); disable topics in panel
- Mercado Pago production webhook: NOT CONFIGURED
- IMPL-13: NOT_STARTED / NOT AUTHORIZED
- Landing changes: NONE
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
  - plan trazable IMPL-1..12; IMPL-2..11 `VALIDATED / CLOSED`;
    IMPL-12 `CORRECTIVE_VALIDATION_FAILED / NOT CLOSED`
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
    Case A full FAIL (hold expired → REQUIRES_REVIEW); Main v8 unchanged
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

`IMPL_12_CORRECTIVE_VALIDATION_FAILED`

Siguiente accion permitida:

1. esperar autorizacion humana para aplicar v9 en Main y revalidar Caso A con
   webhook firmado inmediato dentro del TTL del hold;
2. no declarar IMPL-12 `TECHNICAL_PASS` ni `VALIDATED / CLOSED` sin esa revalidación;
3. no iniciar IMPL-13;
4. no abrir ventas en Main ni cambiar el evento canónico de `CONFIGURADO`;
5. no conectar la landing;
6. no versionar `.cursor/settings.json` ni autenticar Stripe sin unidad aparte;
7. humano: desactivar topics del webhook de prueba en el panel MP (MCP needsAuth).

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
IMPL-12-R3 publico la migracion `0009` (payment upsert antes de verification)
y la aplico solo en branch: webhook firmado HTTP 200, payment + verification
con `payment_id` NOT NULL. El checklist completo del Caso A fallo por hold
expirado (`REQUIRES_REVIEW`, tickets=0). Evidencia en
`docs/implementation/evidence/IMPL-12-R3-WEBHOOK-PAYMENT-ORDER-FIX.md`.
IMPL-12 permanece `CORRECTIVE_VALIDATION_FAILED / NOT CLOSED`. Main sigue v8.

```text
IMPL-4: VALIDATED
IMPL-5: VALIDATED / CLOSED
IMPL-6: VALIDATED / CLOSED
IMPL-7: VALIDATED / CLOSED
IMPL-8: VALIDATED / CLOSED
IMPL-9: VALIDATED / CLOSED
IMPL-10: VALIDATED / CLOSED
IMPL-11: VALIDATED / CLOSED
IMPL-12: CORRECTIVE_VALIDATION_FAILED / NOT CLOSED
InsForge schema 0001-0003: DEPLOYED AND VALIDATED
InsForge catalog migration 0004: APPLIED AND VALIDATED
InsForge checkout TX migration 0005 / v5: APPLIED
InsForge webhook TX migration 0006 / v6: APPLIED
InsForge team roster migration 0007 / v7: APPLIED
InsForge ticket issuance migration 0008 / v8: APPLIED
InsForge webhook order fix migration 0009: IN REPO / APPLIED ON R3 BRANCH ONLY
OD-022: APPROVED
Catalog: 1 event / 3 days / 28 products
Event status: CONFIGURADO
Mercado Pago production webhook: NOT CONFIGURED
Mercado Pago test webhook: URL STORED / DISABLE TOPICS IN PANEL
TEAM_ROSTER_REMINDERS: DEFERRED / NOT AUTHORIZED
EMAIL_PROVIDER / TICKET_EMAIL_DELIVERY: DEFERRED / NOT AUTHORIZED
PUBLIC_TICKET_RETRIEVAL: DEFERRED / NOT AUTHORIZED
OD-019 commercial folio: OPEN
OD-020 multiday: OPEN / FAIL-CLOSED
check-in / manifest: NOT IMPLEMENTED / NOT AUTHORIZED
Gate: IMPL_12_CORRECTIVE_VALIDATION_FAILED
IMPL-13: NOT_STARTED / NOT AUTHORIZED
LANDING_READY_FOR_READY2HYBRID_MATCH
```

El esquema minimo de ventas, el catalogo Hybrid Event, el inicio de checkout,
el webhook firmado, el estado publico read-only, el roster backend y la
emision server-side de tickets/QR hasheados ya estan en InsForge
(`ready2hybrid` / `4bg9ufz2.us-east`). El evento canónico permanece en
`CONFIGURADO`. Main no fue usado como sandbox. IMPL-12-R3 demostro el arreglo
RPC en branch pero no cerro el Caso A completo por hold expirado. Recordatorios,
correo y recuperacion publica de QR permanecen diferidos. Productos multiday
permanecen fail-closed. Check-in y manifiesto no fueron implementados. IMPL-13
no esta autorizado.
La landing publica existente permanece protegida:

```text
LANDING_READY_FOR_READY2HYBRID_MATCH
```

La sustitucion de imagenes de template por imagenes propias es una tarea visual
independiente y no bloqueante.

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
- IMPL-7: NOT_STARTED / NOT AUTHORIZED
- Mercado Pago runtime changes: NONE
- Landing changes: NONE

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
  - plan trazable IMPL-1..12; IMPL-2/IMPL-3/IMPL-4/IMPL-5/IMPL-6 `VALIDATED`;
    InsForge 0001-0004 remote DEPLOYED/APPLIED AND VALIDATED;
    IMPL-7 `NOT_STARTED / NOT AUTHORIZED`
- `docs/implementation/evidence/IMPL-5-CATALOG-SEED-PREPARATION-VALIDATION.md`
  - OD-022 APPROVED; seed blob `530bdde7…`; local PG16 PASS
- `docs/implementation/evidence/IMPL-5-CATALOG-SEED-REMOTE-EXECUTION-VALIDATION.md`
  - remote `0004_hybrid-event-catalog`; 1/3/28 PASS; IMPL-5 `VALIDATED`
- `docs/implementation/evidence/IMPL-6-28-PRODUCTS-READ-ONLY-VALIDATION.md`
  - read-only 28-product compare PASS; human closure APPROVED 2026-07-25
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

`READY_FOR_IMPL_7_AUTHORIZATION`

Siguiente accion permitida:

1. esperar autorizacion humana separada para IMPL-7;
2. no iniciar IMPL-7 sin esa autorizacion;
3. no realizar nuevas escrituras en InsForge salvo una unidad explicitamente
   autorizada;
4. no iniciar checkout, webhooks, Mercado Pago ni tickets;
5. no modificar la landing.

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

```text
IMPL-4: VALIDATED
IMPL-5: VALIDATED / CLOSED
IMPL-6: VALIDATED / CLOSED
InsForge schema 0001-0003: DEPLOYED AND VALIDATED
InsForge catalog migration 0004: APPLIED AND VALIDATED
OD-022: APPROVED
Catalog: 1 event / 3 days / 28 products
Gate: READY_FOR_IMPL_7_AUTHORIZATION
IMPL-7: NOT_STARTED / NOT AUTHORIZED
LANDING_READY_FOR_READY2HYBRID_MATCH
```

El esquema minimo de ventas y el catalogo Hybrid Event ya estan en InsForge
(`ready2hybrid` / `4bg9ufz2.us-east`): 0001-0003 schema + 0004 catalog seed.
El evento permanece en `CONFIGURADO`. IMPL-6 quedo cerrado. IMPL-7 permanece
sin autorizacion. La validacion del catalogo no autoriza comercio.
Mercado Pago, checkout, webhooks y tickets permanecen fuera de alcance. La
landing publica existente permanece protegida:

```text
LANDING_READY_FOR_READY2HYBRID_MATCH
```

La sustitucion de imagenes de template por imagenes propias es una tarea visual
independiente y no bloqueante.

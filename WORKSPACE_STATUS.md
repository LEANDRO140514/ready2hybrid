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
- SALE-1: STARTED - Fase A aprobacion de gobierno; Fase B catalogo publico
- F0-E: NOT STARTED - sin autorizacion de implementacion

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
- `skills/ready2hybrid-spec-governance/SKILL.md`
- `skills/ready2hybrid-spec-governance/agents/openai.yaml`

`SPEC-000` v0.2.0, `SPEC-001` v0.1.0 y `SPEC-011` v0.1.0 estan `APPROVED`.
La version v0.1.0 de `SPEC-000` esta `SUPERSEDED` y se preserva sin cambios en
`docs/specs/archive/SPEC-000-GOVERNANCE-v0.1.0.md`. Ninguna de estas specs
autoriza schema, RLS, pagos, webhooks, secretos, produccion ni modulos
funcionales.

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

`READY_FOR_SPEC_DRAFT`

Siguiente accion permitida:

1. formalizar el catalogo publico y los journeys de venta de 28 productos;
2. mantener la nueva specification como `DRAFT` hasta aprobacion humana;
3. no iniciar F0-E hasta cerrar el gobierno documental y recibir una
   autorizacion humana separada.

## Ultimo cierre

F0-D esta cerrado en `c6f1131`. R1 esta cerrado en `b6e64c2`. R2 termino en
`CHANGES_REQUIRED`. R3 corrigio los nueve hallazgos y cerro en `9d9bbb9`.
SALE-1 inicia con la aprobacion humana de SPEC-000 v0.2.0 y continua con la
specification documental del catalogo publico.

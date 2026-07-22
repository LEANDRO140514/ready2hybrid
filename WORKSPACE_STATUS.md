# WORKSPACE STATUS - Ready2Hybrid

## Estado

- Fecha de inicio: 2026-07-21
- Constructor: Kimchi
- Stack: Vite + React 19 + TypeScript
- Aplicacion: PWA offline-first
- Backend: InsForge
- Pagos: Mercado Pago Checkout Pro
- Evento: viernes 9 de octubre de 2026
- Fase activa: F0-C - Vitest Foundation
- Estado de fase: VALIDATED LOCALLY - pendiente de cierre controlado

## Autoridad

Leer `docs/` por numero. Ante contradiccion manda el numero menor.
Las specs traducen la autoridad a contratos verificables; no reemplazan
`docs/00-05`.

## Estado de F0

- F0-A Preflight: PASS
- F0-B1 Scaffold temporal: PASS
- F0-B2 Vite/React/TypeScript foundation: PASS en `e7d926c`
- F0-B3 Spec Foundation: APPROVED v0.1.0, cerrado y publicado en `0d92a97`
- F0-C Vitest Foundation: IMPLEMENTED y VALIDATED localmente, pendiente de commit

## Artefactos F0-B3

- `docs/specs/README.md`
- `docs/specs/SPEC-000-GOVERNANCE.md`
- `docs/specs/SPEC-001-SYSTEM-ARCHITECTURE.md`
- `docs/specs/SPEC-011-PWA-FOUNDATION.md`
- `skills/ready2hybrid-spec-governance/SKILL.md`
- `skills/ready2hybrid-spec-governance/agents/openai.yaml`

Las specs `SPEC-000`, `SPEC-001` y `SPEC-011` quedaron APPROVED en v0.1.0.
No autorizan schema, RLS, pagos, webhooks, secretos, produccion ni modulos
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

## Proximo gate

`READY_FOR_F0-C-CLOSE`

Siguiente accion permitida:

1. revisar el diff final de los seis archivos;
2. crear un commit local controlado;
3. no hacer push hasta recibir aprobacion explicita.

## Ultimo cierre

F0-B3 cerrado y publicado en remoto con:

`0d92a97 docs: establish Ready2Hybrid spec governance foundation`

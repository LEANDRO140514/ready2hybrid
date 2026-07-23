# MANIFEST — Ready2Hybrid Cursor baseline

Updated: 2026-07-23

## Autoridad operativa

```text
Constructor operativo: Cursor
Modelo: mejor LLM disponible para cada tarea
```

La autoridad de producto y arquitectura permanece en `docs/00-05`. Las
specifications traducen esa autoridad a contratos verificables y solo el
propietario humano puede aprobarlas.

## Documentos de autoridad

- `CURSOR_START_PROMPT.md`
- `WORKSPACE_STATUS.md`
- `docs/00_CICLO_DEL_EVENTO.md`
- `docs/01_R2R_A_R2H_PRACTICO.md`
- `docs/02_PLAN_DESARROLLO_CON_CURSOR.md`
- `docs/03_CUSTOMER_JOURNEYS.md`
- `docs/04_REVISION_FINAL.md`
- `docs/05_ANEXO_PLAN_TECNICO.md`
- `docs/specs/README.md`

## Specifications

- `docs/specs/archive/SPEC-000-GOVERNANCE-v0.1.0.md` — versión aprobada vigente
- `docs/specs/SPEC-000-GOVERNANCE.md` — revisión v0.2.0 propuesta, `DRAFT`
- `docs/specs/SPEC-001-SYSTEM-ARCHITECTURE.md` — v0.1.0, `APPROVED`
- `docs/specs/SPEC-011-PWA-FOUNDATION.md` — v0.1.0, `APPROVED`
- `skills/ready2hybrid-spec-governance/SKILL.md`

## Artefactos implementados

F0-B2:
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `src/main.tsx`
- `src/App.tsx`

F0-C:
- `src/test/setup.ts`
- `src/App.test.tsx`

F0-D:
- `playwright.config.ts`
- `tests/e2e/app.smoke.spec.ts`

Configuración local versionable:
- `.cursor/mcp.json`
- `.gitignore`

Datos existentes, no ejecutados por esta unidad:
- `insforge/seeds/0002_seeds_hybrid_event.sql`

F0-E no está implementada.

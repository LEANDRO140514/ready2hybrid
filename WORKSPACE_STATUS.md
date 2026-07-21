# WORKSPACE STATUS - Ready2Hybrid

## Estado

- Fecha de inicio: 2026-07-21
- Constructor: Kimchi
- Stack: Vite + React 19 + TypeScript
- Aplicacion: PWA offline-first
- Backend: InsForge
- Pagos: Mercado Pago Checkout Pro
- Evento: viernes 9 de octubre de 2026
- Fase activa: F0-B3 - Spec Foundation

## Autoridad

Leer `docs/` por numero. Ante contradiccion manda el numero menor.
Las specs traducen la autoridad a contratos verificables; no reemplazan
`docs/00-05`.

## Estado de F0

- F0-A Preflight: PASS
- F0-B1 Scaffold temporal: PASS
- F0-B2 Vite/React/TypeScript foundation: PASS en `e7d926c`
- F0-B3 Spec Foundation: APPROVED v0.1.0 por Project Owner

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

## Proximo gate

`READY_FOR_F0-B3-CLOSE`

Las tres specs (`SPEC-000`, `SPEC-001`, `SPEC-011`) fueron revisadas y
aprobadas formalmente en v0.1.0 por Project Owner. Pendiente:

1. registrar el cierre formal de F0-B3;
2. planar la siguiente fundacion tecnica (F0-C en adelante).

No hacer commit ni push automaticamente.

## Ultimo cierre

F0-B2 cerrado en el remoto con:

`e7d926c feat: add Vite React TypeScript foundation`

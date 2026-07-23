# Prompt inicial para Cursor

Estás trabajando en Ready2Hybrid.

## Autoridad operativa

```text
CONSTRUCTOR OPERATIVO: CURSOR
MODELO: EL MEJOR LLM DISPONIBLE PARA CADA TAREA
```

Selecciona el modelo adecuado para arquitectura, planeación, implementación,
debugging, revisión adversarial, seguridad, documentación o validación. Los
modelos y los MCP son herramientas; no sustituyen la autoridad documental ni
las decisiones del propietario.

## Inicio obligatorio

1. Ejecuta un preflight Git de solo lectura: repositorio, branch, HEAD,
   `origin/main`, divergencia y working tree.
2. Lee, en este orden, `MANIFEST.md`, `WORKSPACE_STATUS.md`, `docs/00-05`,
   `docs/specs/README.md`, `SPEC-000` y las specs relacionadas.
3. Localiza contradicciones, decisiones humanas pendientes y el gate vigente.
4. Declara una unidad pequeña con objetivo, alcance, archivos, recursos
   externos, riesgos, pruebas, rollback y criterio de salida.
5. No implementes antes de contar con la autorización requerida.

## Decisiones cerradas

- Vite + React 19 + TypeScript strict.
- Ready2Hybrid es una SPA/PWA offline-first.
- TanStack Router, Query y Table; Zustand; Zod; Vitest; Playwright e IndexedDB.
- InsForge es la autoridad canónica de registros, pagos, tickets, QR,
  check-ins, sincronización, resultados y auditoría.
- Mercado Pago Checkout Pro México es la primera pasarela.
- Los redirects de pago no son autoridad; el backend verifica firma,
  idempotencia y estado real con Mercado Pago.
- Los QR contienen únicamente identificadores o tokens opacos.

## Seguridad y límites

- Nunca muestres, registres ni versiones secretos.
- Nunca coloques claves administrativas ni Access Tokens en el frontend.
- No ejecutes SQL, seeds, migraciones, cambios RLS, funciones, webhooks, pagos
  o acciones productivas sin una unidad y autorización explícitas.
- No concedas escritura anónima directa ni permitas edición directa de estados
  sensibles.
- IndexedDB y las copias offline nunca sustituyen a InsForge.
- No amplíes alcance por iniciativa del agente, modelo, MCP o librería.

## Trabajo y cierre

Trabaja por `PREFLIGHT -> DIAGNÓSTICO -> PROPUESTA -> AUTORIZACIÓN ->
IMPLEMENTACIÓN -> VALIDACIÓN -> EVIDENCIA -> CIERRE`. Termina cada unidad con
un gate inequívoco. Commit y push solo se realizan cuando estén expresamente
autorizados.

Los documentos que presenten a Kimchi o Forge como constructores pertenecen al
historial o requieren migración. Recupera de ellos únicamente decisiones
vigentes de producto, arquitectura, seguridad y pruebas; no ejecutes
instrucciones exclusivas de esos constructores.

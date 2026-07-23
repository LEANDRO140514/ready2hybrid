# Plan de desarrollo Ready2Hybrid — edición Cursor

> Este documento gobierna **cómo y cuándo** se construye Ready2Hybrid.
> Cursor es el entorno operativo y selecciona el mejor LLM disponible para
> cada tarea. Los documentos `00` y `01` mandan sobre cualquier propuesta del
> agente. El trabajo se ejecuta por fases controladas, con aprobación humana
> antes de cambios sensibles.

## 1. Decisiones no negociables

```text
Constructor     Cursor + mejor LLM disponible según la tarea
Frontend        Vite + React 19 + TypeScript strict
Aplicación      SPA/PWA offline-first
Backend         InsForge: Auth, PostgreSQL, RLS, Functions, Storage, Realtime
Pagos           Mercado Pago Checkout Pro + webhook idempotente
QR              representación local; ciclo de vida y autoridad en InsForge
Gobierno        PREFLIGHT → PLAN → APROBAR → EXECUTE → VALIDATE → CLOSE
Autonomía       prohibida para schema, RLS, pagos, webhooks, secretos y producción
```

No se usa Next.js. Cursor, el modelo seleccionado y los MCP no pueden redefinir
stack, alcance, calendario, prioridades ni arquitectura modular.

## 2. MCPs y herramientas obligatorias

Antes de escribir código deben quedar comprobados:

```text
InsForge MCP       conectado al proyecto correcto; lectura y metadata PASS
Mercado Pago MCP   OAuth y documentación Checkout Pro México PASS
Git/GitHub         status, diff, commit y remote operables
Node/npm           versiones compatibles en el entorno operativo vigente
TypeScript         language server, typecheck y strict
Browser            Playwright o equivalente para pruebas reales
Secretos           fuera del repo y fuera de logs
```

Los MCP son herramientas de construcción y diagnóstico; no forman parte del
runtime. Si un MCP falla temporalmente, se documenta el bloqueo y se usa la
CLI/SDK/documentación oficial solo con aprobación.

## 3. Calendario real — evento: viernes 9 de octubre de 2026

> Ya existe venta previa al sistema. Ready2Hybrid debe nacer absorbiendo ese
> historial y convertirse inmediatamente en la fuente de verdad.

```text
Jul 21–22       F0      baseline Git + Cursor + MCPs + plan + Vite/PWA base
Jul 23–Ago 2    S1–2    núcleo + importar ventas + MP + tickets/QR + correo
Ago 3–16        S3–4    Evento / Personas / Caja
Ago 17–23       S5      check-in offline + ensayo sin wifi
Ago 24–Sep 6    S6–7    competencia + staff + simulacro
Sep 7–13        S8      auditoría integral, accesibilidad y endurecimiento
Sep 14–24       colchón, simulacro general, pendientes y manual de operación
Sep 25          CONGELAR: solo correcciones
Oct 7           ensayo en sede con staff real
Oct 9           EVENTO
```

Si una fase se desborda, se recorta de acuerdo con `04_REVISION_FINAL.md`.
Nunca se recorre el congelamiento.

## 4. Venta previa: absorción obligatoria

```text
1. Consolidar todo lo vendido en un CSV único y validado.
2. import-registrations crea contacto, registro CONFIRMED, pago externo,
   folio, ticket en InsForge y correo con QR.
3. Crear captura rápida mínima para nuevas ventas manuales durante la transición.
4. Al habilitar MP, la captura rápida queda solo para pago presencial auditado.
5. Desde ese momento Excel deja de ser fuente operativa.
```

## 5. Fase 0 — Fundación y preflight (21–22 julio)

### Construir

```text
- inicializar Git y registrar el baseline documental;
- conectar Cursor al repo correcto;
- validar MCP de InsForge y MCP de Mercado Pago en modo lectura;
- inicializar Vite + React + TypeScript strict;
- definir arquitectura feature/module-first;
- configurar TanStack Router/Query/Table, Zustand y Zod;
- conectar SDK de InsForge sin escribir schema todavía;
- configurar Vitest y Playwright;
- crear manifest, service worker base y estrategia de actualización PWA;
- crear WORKSPACE_STATUS.md y scripts de validación.
```

### Puerta de salida

```text
✓ Cursor y el modelo seleccionado respetan docs/00–05 y no cambian el stack
✓ ambos MCP visibles y autenticados
✓ npm run typecheck, test y build en verde
✓ PWA instalable en preview HTTPS/localhost
✓ ninguna credencial dentro del repo
✓ plan de F1 presentado como diff/archivos y aprobado
```

## 6. Semanas 1–2 — Vender

### Construir

```text
- insforge/migrations/0001_core.sql + RLS;
- aplicar seeds oficiales después de la migración;
- import-registrations y captura rápida;
- create-checkout y get-order-status;
- mp-webhook con firma, consulta API e idempotencia;
- emisión canónica de tickets y tokens QR en InsForge;
- correo transaccional de confirmación, voucher y QR;
- página “confirmando…” en hybrid-event-landing.
```

### Puerta dura

```text
✓ anon no escribe tablas
✓ compra concurrente del último cupo sin sobreventa
✓ webhook duplicado sin duplicar registro, pago, folio, ticket ni correo
✓ tarjeta aprobada → CONFIRMED + ticket
✓ efectivo pending → aprobado posterior → CONFIRMED
✓ voucher vencido → cupo liberado
✓ firma inválida → rechazo sin efectos
✓ asistente ×3 → tres tickets distintos
✓ reemisión revoca el QR anterior
✓ pago sandbox y diagnóstico MCP limpios
```

La venta productiva solo se activa después de un pago real mínimo, reembolso,
backup/exportación y aprobación humana.

## 7. Semanas 3–4 — Administrar

```text
Construir: Evento, Personas y Caja; precios con snapshot por orden; búsqueda
360; acciones protegidas; conciliación MP; export CSV; permisos por rol.

Puertas:
✓ TypeScript strict, lint, tests y build
✓ RLS probada con usuarios reales de cada rol
✓ FINANCE no ve datos médicos; CHECKIN no edita pagos
✓ operación diaria sin editar tablas ni usar la consola de InsForge
✓ UI alineada con DESIGN.md extraído de la landing
```

## 8. Semana 5 — Entrar

La base PWA ya existe desde F0. Aquí se agrega la operación offline completa:

```text
- get-checkin-manifest desde InsForge;
- IndexedDB limitada a evento, rol, dispositivo y expiración;
- escaneo QR local <1 s;
- búsqueda por tres letras;
- carta responsiva, kits y chip;
- cola idempotente y sync-checkins;
- primer escaneo gana; segundo crea incidencia;
- revocado/reemitido se rechaza;
- borrado local al cerrar sesión o cerrar evento;
- lista imprimible de último respaldo.
```

Puerta física:

```text
✓ 50 check-ins con wifi apagado y tres celulares
✓ QR en pantalla, papel, brillo bajo y daño parcial
✓ mismo QR en dos celulares offline: un ganador y una incidencia
✓ caída y retorno de red sin acción humana
✓ puerta ≥5 personas/minuto
```

## 9. Semanas 6–7 — Competir

```text
- categorías, heats, carriles y asignación automática ajustable;
- lista de salida imprimible;
- captura del juez por toques, offline y deshacer 30 s;
- UNDER_REVIEW → VALIDATED → PUBLISHED;
- leaderboard público en la landing;
- turnos, tareas, incidencias y asignación de staff.
```

Puerta:

```text
✓ simulacro con 2 categorías y 4 heats
✓ penalización y protesta corregida con auditoría
✓ nada público sin VALIDATED
✓ leaderboard visible desde un dispositivo externo
✓ operación del juez sin teclado
```

## 10. Semana 8 — Endurecer y congelar

```text
- revisión independiente de seguridad, race conditions y UX;
- typecheck, lint, unit, integration y E2E;
- auditoría RLS y secretos;
- accesibilidad y rendimiento de landing/leaderboard;
- simulacro general: puerta offline + competencia + caja;
- backup de DB y respaldo separado de Storage;
- rollback documentado;
- congelamiento el 25 de septiembre.
```

No se congela con fallos críticos o sin ensayo físico.

## 11. Flujo controlado de trabajo

```text
ABRIR
1. confirmar pwd y repo;
2. leer WORKSPACE_STATUS.md;
3. leer docs relevantes en orden de autoridad;
4. git status y HEAD;
5. presentar plan y archivos a tocar.

EJECUTAR
6. esperar aprobación en schema, RLS, pagos, webhooks y producción;
7. trabajar solo en la fase activa;
8. no modificar otros repos.

VALIDAR
9. mostrar diff;
10. ejecutar puertas automáticas y pruebas manuales definidas;
11. registrar resultados y riesgos.

CERRAR
12. actualizar WORKSPACE_STATUS.md;
13. commit único de cierre de fase;
14. push solo cuando sea solicitado/aprobado.
```

No usar autonomía total para acciones sensibles. Las tareas visuales o tests
aislados pueden delegarse, pero siempre dentro del alcance aprobado.

## 12. Mapa fase → puerta de calidad

| Fase | Puerta |
|---|---|
| F0 | MCPs + Vite/PWA + toolchain + plan aprobado |
| S1–2 | RLS + concurrencia + webhook/QR idempotentes + pruebas MP |
| S3–4 | permisos por rol + tests + operación sin tocar DB |
| S5 | ensayo físico offline con tres celulares |
| S6–7 | simulacro deportivo + validación/publicación auditada |
| S8 | auditoría sin críticos + backup + simulacro general |

## 13. Post-evento

Cerrar las tres dimensiones del evento, registrar lecciones en
`WORKSPACE_STATUS.md`, emitir reporte ejecutivo y decidir el siguiente módulo
según el segundo evento real. Cursor sigue siendo el entorno operativo; el
repositorio conserva código, configuración y memoria propia del proyecto.

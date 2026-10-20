# AGENTS.md — Ready2Hybrid

Contrato operativo para cualquier agente (Cursor, Claude Code, otros).
Este archivo es autoridad. Debe estar commiteado, no en `.git/info/exclude`.

---

## 1. Contexto del proyecto

Sistema de gestión del evento deportivo **Hybrid Experience**.

- **Evento:** 13–15 de noviembre de 2026 (Mérida, Yucatán)
- **Cierre de ventas de competidores:** viernes 13 de noviembre de 2026, 11:00 (America/Mérida).
- **Cancelados:** `PUB-3D` (pase 3 días) y `PUB-DOM` (público domingo). No se venden.
- **Stack:** Vite + React 19 + TypeScript strict, PWA offline-first
- **Backend:** InsForge (autoridad canónica de órdenes, pagos, tickets, QR, check-in)
- **Pasarela activa:** Mercado Pago Checkout Pro (Clip y Openpay: futuro, aparcados)
- **Propietario / organizador:** Leandro Espinosa (única autoridad de producto)

### El sistema son DOS repos

| Repo | Qué es |
|---|---|
| `ready2hybrid` (este) | Backend InsForge (edge functions, migraciones) + **PWA operativa** para staff: check-in, desk |
| `hybrid-event-landing` | **Landing pública**: catálogo, CTAs, inicio de checkout |

Se comunican por las edge functions (`mp-create-checkout`, `get-order-status`,
`team-roster`, `ticket-credentials`), con Origin fail-closed como defensa en
profundidad. **Un cambio de contrato en una edge function afecta a los dos
repos.** Antes de modificar la firma o la respuesta de una función pública,
verifica qué consume la landing.

Este `AGENTS.md` gobierna `ready2hybrid`. La landing necesita el suyo.

**Fase actual: GO-LIVE.** Prioridad absoluta: abrir ventas.
Todo lo que no acerque la venta va a backlog, no al carril de entrega.

---

## Reglas del proyecto Hybrid Experience (HEX-2026)

Evento: 13–15 nov 2026, Club Cumbres, Mérida. Producción backend: InsForge `4bg9ufz2`.
Origen legacy: proyecto InsForge `enforma` (hybrid-registro), solo lectura desde aquí.

### Qué copia sirve para qué (máquina "algorithmus", C:\Users\algor\dev\)

- Funciones de pago (`mp-*`, `openpay-*`, `send-ticket-email`) y migraciones: SOLO desde `ready2hybrid-prorroga` (main).
- Panel ops (PWA ops.enforma.mx y funciones `ops-*`, `legacy-sync`): SOLO desde `ready2hybrid-ops-sources`.
- Landing pública: SOLO desde `hybrid-event-landing`.
- Nunca desplegar funciones de pago desde `ready2hybrid-ops-sources` (va atrás de main y revierte precios).
- Las demás copias son históricas o experimentales; no despliegues desde ellas.

### Capa de pagos (máxima precaución)

- `webhook_apply_payment_tx` vive en la definición de 0038. No se reemplaza sin plan, diff contra la definición viva, rollback y pase explícito.
- 0046 (Openpay dual-provider) vive en `docs/openpay/`, nunca en una carpeta de migraciones hasta su ventana aprobada.
- Openpay está apagado para clientes (`OPENPAY_ENABLED` falso) hasta certificación.
- Cada redeploy de checkout exige prueba de humo: crear preferencia real sin pagar y confirmar `init_point`, precio vigente y `expiration_date_to`.
- Reenviar un boleto rota el QR y revoca el anterior: nunca reenviar boletos reales para "probar".
- Un número de operación aprobado = una inscripción. Deduplicar siempre por id de pago entre checkout y legacy.

### Reglas de negocio vigentes

- Preventa hasta 19 oct 23:59; regular desde 20 oct 00:00 (America/Merida).
- Venta en línea de competidores cierra el 13 nov 2026 a las 11:00 America/Merida.
- Desde el 13 nov 00:00: solo pago con tarjeta para todos los productos.
- Pases PUB-3D y PUB-DOM: cancelados (apagados en checkout). WOD y FOT no se venden.
- Entrega de kits: Club Cumbres, desde el jueves 12 nov (horario por definir) hasta el viernes 13 nov a las 12:00 h; ENFORMA avisa el horario por redes, correo y WhatsApp.
- Excepcion solo para inscripciones de ultima hora (viernes 13, hasta el cierre de venta en linea a las 11:00 h): recoger el kit al menos 3 h antes de su competencia y escribir al WhatsApp oficial 990 230 2378 (https://wa.me/529902302378). La regla de 3 h NO aplica a todos.
- Toda venta nueva entra por la landing. hybrid-registro solo para cortesías (staff, jueces, invitados) con monto $0.
- Legacy pagado con monto 0 = cortesía: cuenta como inscripción, no como venta.
- No hay reembolsos parciales. Devolución = total desde Mercado Pago + revocar boleto + egreso en Tesorería.

### Antes de publicar

- Build exactamente como el host (respetar `.vercelignore`; `insforge/` no se sube a Vercel; nada en `src/` importa de `insforge/`).
- Tests + typecheck + build. Fallos preexistentes conocidos: dos tests de "0004" y `ticket-pdf-image` (jspdf).
- Anotar el deployment actual para rollback y reportarlo.
- Sincronización legacy: siempre DRY-RUN con diff y conteos antes de aplicar.

### Seguridad

- Nunca leer, imprimir ni manejar secretos/llaves en scripts locales o logs. Si se necesitan, detenerse y pedirlos al humano.
- Tesorería: nada se borra; un movimiento pagado solo se cancela con motivo.

---

## 2. Git — leer completo antes de tocar el repo

Esta sección corrige el fallo histórico más costoso del proyecto.
La regla anterior ("commit y push solo con autorización") produjo semanas de
trabajo sin commitear y producción desplegada desde un bundle temporal.

### Commit local: OBLIGATORIO, sin pedir permiso

- Commitea al cerrar cada unidad de trabajo coherente.
- Nunca dejes el árbol sucio al terminar una sesión.
- Si el trabajo está a medias, commitea en rama `wip/*`. Un commit WIP siempre
  es mejor que trabajo sin versionar.
- Un commit local es reversible y gratis. No es una acción de riesgo.

### Requiere autorización explícita del propietario

| Acción | Por qué |
|---|---|
| `git push` | Sale del control local, repo público |
| Desplegar edge functions | Toca producción |
| Aplicar SQL/migraciones a Main | Irreversible sobre datos reales |
| Cambiar `SALES_STATUS` | Mueve dinero real |
| Rotar o crear secretos | Superficie de seguridad |

### Prohibido siempre

- `git add .` / `git add -A` / `git commit -a`. **Solo rutas explícitas.**
- `git push --force` sobre `main`.
- Reescribir historia publicada.
- Commitear cualquier cosa bajo `.cursor/`.

### Antes de cualquier commit

```bash
git status                 # revisar
npm run typecheck
npm test
npm run build
```

Si un gate falla: reporta el error. **No lo arregles a ciegas.**

---

## 3. Despliegue — la fuente es el repo

**Regla dura: nunca despliegues desde un bundle temporal, un `/tmp`, ni un
archivo generado fuera del árbol.**

Histórico: `mp-create-checkout` se desplegó el 2026-08-24 desde un bundle
temporal. Durante semanas, producción no correspondió a ningún commit y
`handler.deploy.js` del repo habría revertido la lógica viva si alguien
redesplegaba.

Secuencia obligatoria para desplegar:

1. Regenerar el bundle con el script del repo (`npm run bundle:*`)
2. Commitear el bundle regenerado
3. Desplegar **ese** archivo
4. Verificar que lo vivo coincide con el bundle commiteado (hash/diff)
5. Registrar el despliegue en `WORKSPACE_STATUS.md`

Si lo desplegado no coincide con el repo: **es un incidente**. Detente y repórtalo.

---

## 4. Secretos

- `.cursor/` está en `.gitignore` (excepto `mcp.json`). No lo saques de ahí.
- Nunca abras, imprimas ni cites archivos con `token`, `session`, `secret`,
  `.env` o credenciales en el nombre o el contenido.
- Nunca pongas Access Tokens ni claves admin en el frontend ni en el bundle.
- Si detectas un secreto versionado: **detente inmediatamente** y repórtalo.
  El repo es público; una fuga no se deshace borrando el commit.

---

## 5. Invariantes comerciales — no reinterpretar

Estas reglas se invirtieron antes por inferencia del agente y costaron semanas.
Son decisiones del organizador, no supuestos técnicos.

### El cupo NO es autoridad comercial

- `products.cupo` es **dato operativo de planeación**, editable desde panel.
- Las inscripciones son **abiertas**. Cada categoría se ajusta a los inscritos.
- **Prohibido**: `SOLD_OUT` automático por cupo, bloquear checkout por cupo,
  contar holds contra un tope comercial.
- `SOLD_OUT` solo existe como **switch manual del organizador** (`sale_state`).
- Los `capacity_holds` son TTL de checkout e integridad de pago,
  **nunca inventario comercial**.

### El precio cambia por FECHA, nunca por cantidad vendida

- Etapas: `LAUNCH` → `PRESALE` → `REGULAR`, por ventana de calendario
  (America/Mérida), definidas en `staged-pricing.ts`.
- **Prohibido**: reparto 30/45/25, high-water mark, umbrales por unidades
  vendidas, o cualquier avance de etapa disparado por volumen.
- Autoridad: SPEC-030 v0.4.0, R203/R214–R217.

### Si un requisito parece exigir escasez

No lo implementes. **Pregunta.** El organizador ya declaró que no hay escasez.

---

## 5-bis. PWA operativa (`src/`)

App offline-first para staff. No es la landing.

- **Fixtures nunca en producción.** `src/auth/fixture-ports.ts` es solo para
  tests y e2e; prohibido importarlo desde `main.tsx` o `ports.ts`. El build de
  producción debe fallar duro si entra al grafo.
- **Roles deny-by-default.** `ROUTE_ROLE_POLICY` en `src/auth/roles.ts` es la
  autoridad de rutas `/ops/*`. Rol desconocido = sin acceso, sin fallback
  permisivo. `CHECKIN_STAFF` no ve superficies financieras ni médicas completas.
- **Offline es caché, no verdad.** IndexedDB nunca sustituye a InsForge. La
  actualización del service worker no se fuerza a mitad de una operación.
- **Sin secretos en cliente.** Ni Access Tokens ni claves admin en el bundle.
  Precio, cupo y estado los resuelve el backend.
- Stack cerrado: TanStack Router/Query/Table, Zustand, Zod, Vitest, Playwright.
  Librerías nuevas requieren autorización.

## 6. Migraciones

- `insforge/migrations/` contiene **solo migraciones aplicables**.
- Lo bloqueado vive en `docs/specs/holding/migrations-blocked/` con su
  `BLOCKED.md` explicando por qué y qué haría falta para desbloquear.
- Nunca apliques una migración a Main sin autorización explícita.
- Antes de aplicar: verifica que el runtime desplegado sea compatible con
  el nuevo contrato de la función SQL.

### Bloqueadas actualmente

| Migración | Riesgo |
|---|---|
| `0021_multi_provider_canonical_tx_neutralization` | Exige `p->>'provider'`; el `mp-webhook` desplegado no lo envía → `MISSING_PROVIDER` → pagos cobrados sin ticket emitido |
| `0018_staged-commercial-pricing` | Reintroduce precio por cuota y `SOLD_OUT` por cupo; contradice SPEC-030 v0.4.0 |

---

## 7. Preflight — corto por defecto

El preflight anterior obligaba a leer `WORKSPACE_STATUS.md` completo (68 KB,
log append-only) más `docs/00-05` y SPEC-000 en cada sesión. Eso quema el
contexto antes de trabajar.

**Preflight estándar:**

1. Estado git: rama, HEAD, divergencia con `origin/main`, árbol de trabajo
2. Este `AGENTS.md`
3. Solo la sección `## Estado` de `WORKSPACE_STATUS.md` (encabezado, no el log)
4. La spec que gobierna el archivo que vas a tocar — **solo esa**

**Preflight completo** (docs/00-05, SPEC-000, registro de specs) solo cuando:
- se redacta o modifica una spec, o
- el propietario lo pide explícitamente.

---

## 8. Ceremonia proporcional al riesgo

No toda la superficie merece el mismo proceso.

| Capa | Proceso |
|---|---|
| **Dinero** — checkout, webhook, emisión de tickets, migraciones sobre órdenes/pagos | Spec + evidencia + validación humana. Sin atajos. |
| **Operación** — PWA shell, check-in, roster, heats/waves | Unidad declarada + tests. Sin spec formal salvo cambio de contrato. |
| **Interno** — limpieza, tests, docs, `.gitignore`, código muerto | Ejecutar y commitear. Sin ceremonia. |

En fase GO-LIVE, la ceremonia que no protege dinero es deuda de tiempo.

---

## 9. Comandos

```bash
npm run dev
npm test              # vitest run
npm run test:e2e      # playwright
npm run typecheck     # tsc -b
npm run lint          # oxlint
npm run build
npm run bundle:checkout          # regenera handler.deploy.js de mp-create-checkout
npm run bundle:webhook
npm run bundle:order-status
npm run bundle:team-roster
npm run bundle:ticket-credentials
```

---

## 10. Estado del go-live

Bloqueantes reales para abrir ventas:

1. Webhook Mercado Pago de producción — **no configurado**
2. Envío del ticket/QR por email (`EMAIL_PROVIDER`) — **diferido**
3. Rate limiting en endpoints públicos — **abierto**

Degradado a higiene (ya no bloquea): SPEC-040 expiry/reconciliación.
El cupo no es limitante, así que no hay sobreventa que prevenir.

Aparcado en `wip/multi-gateway`: Clip, Openpay, adapters, `0017`, SPEC-041.
`payments/ids.ts` y `payments/errors.ts` se quedan en `main` (los importa
`validate.ts`).

---

## 11. Cuándo detenerte y preguntar
- Un requisito implica escasez de cupo o precio por volumen
- Lo desplegado no coincide con el repo
- Una migración exige un contrato que el runtime desplegado no cumple
- Aparece un secreto versionado
- El trabajo se sale de la unidad declarada
- Una decisión mueve dinero real

Ante la duda: **detente y reporta**. Una pregunta cuesta minutos; un pago
cobrado sin ticket emitido cuesta un cliente.

---

## 12. Guards locales (SlashStack)

Capa local de seguridad en `.agents/guards/`, no versionada.
El manual de SlashStack vive en `.agents/SLASHSTACK.md`.

Obligatorios en este repo:

- `commit-guard` — escanea el diff staged buscando secretos antes de commitear
- `push-guard` — escanea el historial antes de pushear
- `env-guard` — detecta drift entre `.env.local` y `.env.example`

El repositorio es público. Estos guards son red de seguridad; **no** sustituyen
la regla de nunca commitear nada bajo `.cursor/`.

---

## 13. Backend InsForge

> El bloque siguiente lo gestiona el CLI de InsForge entre sus marcadores.
> **No edites dentro de `INSFORGE:START` / `INSFORGE:END`** ni borres los
> marcadores: el CLI los usa para actualizar el bloque en su sitio.

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **ready2hybrid** (API base `https://4bg9ufz2.us-east.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->

### Notas del proyecto sobre lo anterior

- `.env.local` y `.insforge/` están ignorados por git. Verifícalo antes de
  cualquier commit; el repo es público.
- Usa las skills de InsForge antes de improvisar contra el SDK o el CLI.
- El pago corre por **Mercado Pago Checkout Pro**, no por la integración
  Stripe que menciona el bloque genérico.

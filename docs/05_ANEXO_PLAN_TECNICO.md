# Plan de implementación Ready2Hybrid — v2 (modular)

> Punto de partida: `hybrid-event-web` ya existe. Falta la pasarela (Mercado Pago
> vía InsForge) y todo Ready2Hybrid.
> Cambios v2: arquitectura de **núcleo + módulos** con contrato formal para que
> cronometraje, resultados, staff y futuros módulos se acoplen sin fricción;
> **Mercado Pago** reemplaza a Stripe como pasarela; contexto operativo Mérida.

---

## 1. Arquitectura: núcleo + módulos

Ready2Hybrid no es un monolito con features: es un **kernel estable** y módulos
que se enchufan. Las "plantillas" del plan maestro (carrera / hybrid / torneo)
dejan de ser código especial: son **presets de módulos activados por evento**.

```text
NÚCLEO (estable, cambia poco)
├── identidad      contacts
├── eventos        events, event_products
├── comercio       orders, order_items, payments (agnóstico de pasarela), tickets
├── acceso         auth InsForge, staff_profiles, permisos
├── auditoría      activity_log
├── bus            domain_events (outbox) + Realtime
└── registro       modules, event_modules (qué módulo está activo en qué evento)

MÓDULOS v1 (para el primer Hybrid Event)
├── pay-mercadopago   adaptador de pasarela
├── crm               ficha 360, notas, etiquetas, tareas
├── staff             perfiles, turnos, asignaciones, acreditación
├── checkin           QR offline-first, kits, incidencias
├── hybrid            categorías, heats, carriles, estaciones
├── timing            captura de tiempos (manual, CSV, chips después)
└── results           clasificación, validación, publicación

MÓDULOS futuros (mismo contrato, cero refactor del núcleo)
├── comms             chat, plantillas, WhatsApp
├── races             motor de carreras
├── tournaments       motor de torneos
├── pay-stripe        segunda pasarela si algún día conviene
└── sponsors, shop, …
```

### 1.1 Contrato de módulo

Cada módulo es una carpeta autocontenida en backend y frontend:

```text
insforge/modules/<nombre>/
├── manifest.json     nombre, versión, dependencias, permisos que define,
│                     eventos que emite y que consume
├── schema/           migraciones SOLO de sus tablas, con prefijo propio
│                     (stf_, tm_, res_, hyb_, mp_…)
├── functions/        edge functions del módulo
└── policies/         RLS de sus tablas

src/modules/<nombre>/
├── routes.tsx        rutas que exporta
├── nav.ts            entradas de menú y widgets de dashboard
└── …
```

### 1.2 Reglas de armonía (las que hacen que "se unan armónicamente")

1. **Un módulo nunca escribe en tablas de otro módulo.** Punto.
2. Las tablas del núcleo solo se escriben vía funciones del núcleo
   (`confirm_order`, `issue_ticket`, `log_activity`…), que los módulos invocan.
3. La comunicación entre módulos es por **eventos de dominio**: el módulo emisor
   inserta en `domain_events` (patrón outbox, misma transacción que su cambio);
   los consumidores reaccionan vía Realtime o polling de la cola.

   ```text
   pay-mercadopago  emite  payment.approved
   núcleo           emite  registration.confirmed, ticket.issued
   checkin          emite  checkin.completed
   timing           emite  timing.captured, timing.corrected
   results          emite  results.published
   staff            emite  staff.assigned
   ```

4. Dependencias declaradas en el manifest y **solo hacia el núcleo o hacia
   módulos listados**; nunca circulares. Ej.: `results` depende de `timing`;
   `checkin` depende de `staff` (para saber quién escanea).
5. El shell del panel construye navegación, dashboard y permisos leyendo los
   manifests de los módulos activos en el evento. Activar un módulo = fila en
   `event_modules`, no un deploy especial.
6. Toda transición de estado importante, de cualquier módulo, pasa por
   `activity_log` del núcleo.

### 1.3 Ejemplo 1 — cronometraje y resultados como módulos separados

Separar `timing` de `results` es la decisión que hace reutilizable el sistema:

```text
timing   captura tiempos crudos, sin saber de rankings:
         fuente (manual / CSV / chip), participante, marca, split, corrección
         → emite timing.captured

results  consume timing.captured + reglas del motor activo
         (hybrid hoy, races y tournaments mañana)
         → calcula posiciones, aplica penalizaciones, DNS/DNF/DSQ
         → flujo UNDER_REVIEW → VALIDATED → PUBLISHED
         → emite results.published (leaderboard público en vivo vía Realtime)
```

Cuando llegue el motor de carreras, `timing` ya sabe importar CSV de un
cronometrajista externo y `results` ya sabe publicar; solo cambian las reglas.

### 1.4 Ejemplo 2 — módulo staff

```text
stf_profiles      persona (link a contact) + rol operativo
stf_shifts        turnos por día de evento
stf_assignments   asignación a área / heat / cancha / punto de check-in
stf_accreditation gafete, QR de staff, estado
```

Consumido por: `checkin` (quién escaneó), incidencias (responsable),
`timing` (juez asignado al heat). Todo por eventos y lecturas, sin acoplarse.

### 1.5 Contrato PWA + InsForge para tickets y QR

```text
INSFORGE / NÚCLEO
- emite exactamente un ticket por acceso real;
- asigna y protege el token público;
- revoca y reemite;
- autoriza manifiestos offline;
- resuelve sincronizaciones y duplicados;
- conserva activity_log y estado canónico.

MÓDULO CHECKIN
- descarga una vista mínima autorizada;
- lee el QR y registra intentos localmente;
- sincroniza con idempotency_key, operador y dispositivo;
- nunca cambia directamente el estado canónico del ticket.

PWA / INDEXEDDB
- copia temporal limitada a evento, rol y dispositivo;
- incluye expiración y versión de manifiesto;
- se borra al cerrar sesión o cerrar el evento;
- nunca sustituye a InsForge.
```

El QR contiene solo un token opaco. La imagen puede regenerarse; el ticket y
su validez viven en InsForge.

### 1.6 Stack frontend confirmado

```text
Vite + React 19 + TypeScript strict
TanStack Router + Query + Table
Zustand + Zod
vite-plugin-pwa/Workbox
IndexedDB + cola idempotente
Vitest + Playwright
```

Esta decisión ya está elevada a `01` y `02`; este anexo no puede volver a
proponer Next.js ni otra arquitectura de frontend.

---

## 2. Pasarela: Mercado Pago

### 2.1 Por qué encaja mejor que Stripe para Mérida

Público mexicano: tarjetas con **meses sin intereses**, **efectivo**
(OXXO/Paycash) y dinero en cuenta de Mercado Pago — métodos que la audiencia
local usa y que suben conversión. Stripe queda como posible módulo
`pay-stripe` futuro gracias al adaptador; nada del núcleo lo menciona.

### 2.2 El MCP de Mercado Pago: herramienta de construcción, no de runtime

El MCP Server oficial de Mercado Pago se conecta a Kimchi y sirve para
buscar documentación, guiar la integración de Checkout Pro y diagnosticar
notificaciones. **Se usa durante F2 para
construir y depurar**; en producción no interviene: el cobro corre por
Checkout Pro + webhook. Está en beta — útil como acelerador, no como
dependencia.

Acción concreta: conectar el MCP de Mercado Pago a Kimchi desde el preflight
y usar sus herramientas de diagnóstico durante las pruebas del webhook.

### 2.3 Adaptador de pasarela (contrato del núcleo)

```text
PaymentProvider
├── createCheckout(order) → { redirect_url, provider_ref }
├── verifyWebhook(headers, body) → válido / inválido
├── resolvePayment(notification) → { order_id, status, amount, method }
└── refund(payment, amount)
```

`pay-mercadopago` implementa esto; el núcleo solo conoce la interfaz.

### 2.4 Flujo con Checkout Pro

```text
POST /functions/mp-create-checkout        (llamada desde la landing)
 1. valida producto, cupo (lock) y datos mínimos
 2. upsert contact, registration PENDING_PAYMENT, order PAYMENT_PENDING
 3. waiver ACCEPTED (timestamp + versión)
 4. crea preferencia de Checkout Pro:
    - external_reference = order_id
    - notification_url = /functions/mp-webhook
    - back_urls (la página de éxito es cosmética)
    - date_of_expiration para pagos en efectivo
    - excluded_payment_types según decisión de F0
 5. devuelve init_point → redirección

POST /functions/mp-webhook
 1. valida firma x-signature (secret del panel MP)
 2. INSERT webhook_events UNIQUE(provider, provider_event_id)
    → duplicado = responder 200 y salir (MP reintenta notificaciones)
 3. topic payment: consultar /v1/payments/{id} a la API
    (la notificación trae el id; el estado SIEMPRE se lee de la API,
     nunca del cuerpo de la notificación ni del redirect)
 4. approved  → order PAID, registration CONFIRMED, folio, tickets ISSUED
    pending   → efectivo: orden queda PAYMENT_PENDING con cupo reservado
                hasta date_of_expiration
    rejected / cancelled / expirado → liberar cupo
    refunded / charged_back → estados de reembolso + alerta a FINANCE
 5. transacción única + activity_log + domain_event payment.*
 6. responder 200 rápido (MP reintenta si no hay 200 en ~22 s;
    trabajo pesado va después de confirmar recepción)
```

Diferencia clave vs. Stripe: **el pago en efectivo es asíncrono por días**.
La política de cupo reservado para pagos pending y su expiración se decide en
F0 (recomendado: 48–72 h de vigencia del voucher, cupo bloqueado mientras).

---

## 3. Contexto Mérida, Yucatán

- **Zona horaria `America/Merida`** (sin horario de verano) en todo: base de
  datos en UTC, presentación y programación de heats en hora local.
- Moneda MXN; decidir en F0 si se ofrecen MSI y desde qué monto.
- Efectivo habilitado: parte del público local no compra con tarjeta en línea.
- Operación con calor y humedad: heats principales temprano, hidratación y
  sombra como áreas en `venue_areas`, e "incidencia médica por calor" como
  tipo predefinido de incidencia con severidad alta.
- Facturación CFDI sigue fuera del alcance v1 (como en el plan maestro);
  registrar la solicitud de factura como tarea del CRM, no como módulo.

---

## 4. Fases

Gobierno: cada fase = una fase del protocolo `controlled-monorepo-workflow`
(PREFLIGHT → EXECUTE → VALIDATE → CLOSE), con entrada en `WORKSPACE_STATUS.md`.

### F0 — Contrato de producto (días)
Congelar en `docs/spec-v1.md`: productos y precios del Hybrid Event, datos
mínimos, waiver, política de reembolso, **métodos de pago habilitados**
(¿MSI?, ¿efectivo y su vigencia?), estados (los 4 diagramas del plan maestro
tal cual) y los presets de módulos por plantilla.

### F1 — Núcleo en InsForge
El MCP de InsForge debe estar conectado al proyecto correcto desde F0. La
migración sigue siendo la fuente de verdad; no se crean tablas manualmente en
la consola sin reflejo en Git.
Tablas del núcleo + `modules`, `event_modules`, `domain_events`,
`webhook_events`. Policies: anon sin escritura en ninguna tabla; toda
mutación por edge functions. Migraciones numeradas en `insforge/` — el repo
es la fuente de verdad, no la UI de InsForge. Seeds del evento y productos.
**Salida:** kernel operable + prueba explícita de que anon no escribe.

### F2 — Módulo pay-mercadopago  ← desbloquea ventas
Usar el MCP de Mercado Pago conectado a Kimchi. Implementar el adaptador y
las functions del
§2.4. Página de éxito de la landing en modo "confirmando…" con polling a
`get-order-status`. Pruebas de cierre:

```text
✓ pago aprobado con tarjeta de prueba → CONFIRMED + tickets
✓ notificación duplicada → sin efectos dobles
✓ pago en efectivo → pending con cupo reservado → approved días después → CONFIRMED
✓ voucher expirado → cupo liberado
✓ rechazado → sin ticket
✓ firma inválida → 400 sin efectos
✓ compra de asistente ×3 → 3 tickets
✓ diagnóstico de notificaciones del MCP sin fallas de entrega
```

### F3 — Shell del panel + módulo CRM
Auth, roles v1 (OWNER, OPERATIONS_MANAGER, CHECKIN_STAFF, FINANCE), shell que
monta módulos desde manifests, dashboard con widgets aportados por módulos,
CRM (búsqueda, ficha 360, notas, etiquetas), órdenes/registros con acciones
solo vía funciones protegidas, exportación CSV.
Stack canónico: Vite + React 19 + TypeScript strict + SDK InsForge,
TanStack Router/Query/Table, Zustand, Zod y Vitest. Ready2Hybrid es SPA/PWA;
no se usa Next.js.

### F4 — Módulos staff y checkin
`staff` primero (checkin depende de él): perfiles, turnos, asignaciones,
acreditación. `checkin`: PWA offline-first — manifiesto de tickets a
IndexedDB al inicio del día, escaneo contra copia local, cola de
sincronización, primer escaneo gana, búsqueda manual y lista imprimible de
respaldo, kits e incidencias. **Ensayo general con wifi apagado.**

### F5 — Módulos hybrid, timing y results
`hybrid`: categorías, heats, carriles, estaciones, asignación automática +
ajuste manual. `timing`: captura por juez desde celular (inicio, fin, splits
clave, correcciones) e importación CSV. `results`: penalizaciones, flujo de
validación, clasificación por heat/categoría/general, leaderboard público en
la landing vía función de solo lectura (+ Realtime si da tiempo), export CSV.
**Salida: MVP completo (puntos 1–14 del plan maestro).**

### F6+ — Post primer evento
`comms` → `races` → `tournaments` (o `races` antes si el segundo evento real
es una carrera). Cada uno entra como módulo nuevo con su manifest; el núcleo
no se toca.

---

## 5. Riesgos y mitigaciones

1. **Pagos en efectivo asíncronos** → cupo reservado con expiración definida
   en F0; job que libera cupos vencidos; probado en F2.
2. **MCP de MP en beta** → es herramienta de desarrollo; si falla, la doc
   oficial y el SDK siguen siendo el camino. Cero dependencia en runtime.
3. **Límites de Edge Functions de InsForge** (timeout, cold start) →
   verificar antes de F2; plan B: microservicio Node mínimo solo para el
   webhook.
4. **Disciplina modular que se erosiona** → regla mecánica: prefijos de tabla
   por módulo + revisión en el VALIDATE de cada fase de que ningún módulo
   escribe fuera de su prefijo ni salta el bus de eventos.
5. **Internet en sede** → checkin offline-first + ensayo general.
6. **Datos personales** → permisos por rol declarados en manifests y
   verificados en policies desde F1.

## 6. Definición de "listo para abrir ventas"

```text
F2 cerrada con todas las pruebas en sandbox
+ credenciales productivas + un pago real mínimo (tarjeta y efectivo) con reembolso
+ webhook productivo verificado (diagnóstico de notificaciones limpio)
+ respaldo/exportación de la base funcionando
```

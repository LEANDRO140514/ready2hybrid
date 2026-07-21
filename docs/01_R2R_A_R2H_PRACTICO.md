# De Ready2Race a Ready2Hybrid — versión práctica

> Objetivo: obtener la funcionalidad útil de Ready2Race sin copiar su
> complejidad de ingeniería. Partimos de una landing existente, InsForge,
> Mercado Pago y una aplicación operativa propia.
>
> **Decisión canónica:** Ready2Hybrid será una **SPA/PWA offline-first con
> Vite + React 19 + TypeScript**. InsForge será la fuente de verdad de datos,
> tickets, QR, check-ins, sincronización, resultados y auditoría.

## 1. Qué es Ready2Race realmente

```text
CUENTAS       usuarios, roles, clubes, participantes
EVENTO        evento, días, documentos, info pública
COMPETENCIA   categorías, registros, bajas, sustituciones
EJECUCIÓN     rondas, matches, listas de salida, equipos
RESULTADOS    captura, importación, validación y publicación
DINERO        cuotas y facturas; confirmación de pago principalmente manual
OPERACIÓN     QR, check-in, tracking y requisitos
STAFF         turnos, tipos de trabajo y tareas
EXTRAS        certificados, documentos, catering y archivos
```

Conclusión: es un CRUD grande y ordenado. Copiamos el modelo mental, no su
infraestructura ni sus motores complejos.

## 2. Mapeo Ready2Race → Ready2Hybrid

| Ready2Race | Ready2Hybrid práctico | Tecnología | v1 |
|---|---|---|---|
| usuarios, auth, roles | InsForge Auth + perfiles y roles | InsForge | Sí |
| club | campo club/box; tabla futura si crece | Postgres | Sí |
| evento y días | `events`, `event_days`, información pública en landing | InsForge + landing | Sí |
| cuotas y facturas | productos + Checkout Pro + webhook | Mercado Pago + Functions | Sí |
| registros y participantes | `registrations`, `registration_members` | landing + InsForge | Sí |
| requisitos | waiver versionado + emergencia + carta responsiva | InsForge | Sí |
| QR app | PWA con escaneo offline y sincronización | Vite PWA + InsForge | Sí |
| categorías y setup | categorías, heats y presets simples | InsForge | Sí |
| ejecución | heats y carriles para hybrid | InsForge | Sí |
| listas de salida | vista imprimible/exportable | PWA | Sí |
| resultados | captura, revisión, validación y publicación | PWA + Functions | Sí |
| sustitución/baja | acciones protegidas y auditadas | Functions | Sí |
| staff | perfiles, turnos, tareas e incidencias | InsForge + PWA | Sí |
| correo | confirmaciones, QR y recordatorios | servicio transaccional | Sí |
| documentos | archivos del evento | InsForge Storage | Sí |
| certificados | constancias PDF | — | Fase 2 |
| tracking/chips | splits detallados e integración de chips | — | Fase 2 |
| rankings | histórico entre eventos | — | Fase 2 |

## 3. Arquitectura canónica

```text
HYBRID EVENT LANDING
  experiencia pública, registro y CTA de compra
                 │
                 ▼
INSFORGE
  Auth + PostgreSQL + RLS + Functions + Storage + Realtime
  fuente de verdad de registros, pagos, tickets, QR, check-ins y auditoría
                 │
                 ▼
READY2HYBRID PWA
  Vite + React 19 + TypeScript; instalable en celular, tablet y escritorio
                 │
                 ▼
MERCADO PAGO
  Checkout Pro; webhook confirma, nadie concilia pagos a mano
```

### Stack obligatorio

```text
Frontend       Vite + React 19 + TypeScript strict
Routing        TanStack Router
Datos          TanStack Query
Tablas         TanStack Table
Estado local   Zustand
Validación     Zod
Backend        InsForge SDK + Functions + PostgreSQL/RLS
PWA            vite-plugin-pwa/Workbox
Offline        IndexedDB + cola idempotente de sincronización
Testing        Vitest + Playwright
Deploy         hosting HTTPS para SPA/PWA
```

No se usa Next.js, App Router, Server Components ni API Routes. La landing
pública ya vive en otro repo y el backend vive en InsForge.

## 4. Datos mínimos

```text
contacts, events, event_days, products, registrations, registration_members,
orders, order_items, payments, tickets, webhook_events, categories, heats,
heat_entries, results, staff, shifts, tasks, incidents, activity_log
```

El número es orientativo. Se agregan las tablas que exija el comportamiento
real; no se conserva un límite artificial de 15 o 19 tablas.

## 5. Functions mínimas de comercio y operación

```text
create-checkout         valida producto/cupo, crea registro y orden, abre MP
mp-webhook              confirma pago y dispara emisión idempotente de tickets
get-order-status        consulta segura para la pantalla “confirmando…”
import-registrations    absorbe ventas existentes y emite folio/ticket
admin-actions           baja, sustitución, pago en sitio y correcciones auditadas
get-checkin-manifest    entrega copia mínima, autorizada y expirable para offline
sync-checkins           recibe cola idempotente y resuelve conflictos
send-transactional      confirmaciones, voucher, QR, reemisiones y recordatorios
```

Pueden agruparse técnicamente si InsForge lo exige, pero el contrato de
negocio y sus pruebas permanecen separados.

## 6. Ciclo canónico del ticket y QR

```text
payment.approved
→ registration CONFIRMED
→ InsForge emite exactamente un ticket por acceso real
→ asigna token público opaco (sin datos personales)
→ la aplicación genera la representación visual QR
→ correo entrega folio + QR
→ la PWA descarga manifiesto autorizado desde InsForge
→ escanea online u offline
→ encola intento con idempotency_key, operador y dispositivo
→ sincroniza
→ InsForge acepta, rechaza o crea incidencia
```

Reglas duras:

1. InsForge es la fuente de verdad; IndexedDB es una copia temporal.
2. La imagen QR puede regenerarse; el estado canónico vive en `tickets`.
3. Cada integrante y cada acceso de asistente tiene su propio ticket.
4. Un webhook duplicado no crea otro ticket, folio ni correo.
5. Reemitir revoca el token anterior y crea uno nuevo, con auditoría.
6. El QR no contiene nombre, correo, teléfono, pago ni datos médicos.
7. Dos escaneos offline del mismo QR se resuelven en servidor: primero gana,
   el segundo crea incidencia.

## 7. Las seis áreas de trabajo

```text
1. Evento       días, productos, categorías, cupos y estado del ciclo
2. Personas     búsqueda 360 y acciones protegidas
3. Check-in     QR offline, nombre, carta responsiva, kits y sincronización
4. Competencia  heats, salida, captura, revisión y publicación
5. Staff        turnos, tareas e incidencias
6. Caja         ventas, pagos, conciliación MP y exportaciones
```

Ready2Hybrid es una sola PWA con vistas por rol. Check-in, timing, staff e
incidencias deben operar offline; caja y acciones financieras sensibles
requieren conexión.

## 8. Orden práctico

```text
F0            baseline, MCPs, Vite/PWA base, InsForge y contrato aprobado
Semanas 1–2  núcleo + importación histórica + MP + correo + ticket/QR
Semanas 3–4  Evento, Personas y Caja
Semana 5     Check-in offline + ensayo de tres celulares sin wifi
Semanas 6–7 Competencia, resultados y Staff
Semana 8     simulacro general, auditoría y congelamiento
Después      certificados, chips, rankings, carreras y torneos
```

## 9. Regla de simplicidad

Ante cada duda: si Ready2Race lo resuelve con CRUD, copiamos la idea con menos
piezas. Si usa un motor complejo, empezamos con configuración explícita y una
acción manual auditada. Solo automatizamos lo que duela en dos eventos reales.

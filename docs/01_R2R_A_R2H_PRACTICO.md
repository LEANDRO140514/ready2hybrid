# De Ready2Race a Ready2Hybrid — versión práctica

> Objetivo: la funcionalidad de Ready2Race (lambda9), sin su complejidad de
> ingeniería, sobre lo que ya tenemos: landing hecha + InsForge + Mercado Pago.
> Ready2Race = Kotlin/Ktor + jOOQ + Postgres autohospedado + React.
> Nosotros = InsForge nos regala backend, auth, storage y realtime.
> Lo único que hay que construir de verdad son las tablas y las pantallas.

## 1. Qué es Ready2Race realmente (visto en su código)

Sus módulos, agrupados:

```text
CUENTAS       usuarios, roles, clubes, participantes
EVENTO        evento, días, documentos, info pública
COMPETENCIA   setup y plantillas, categorías, registro, bajas, sustituciones
EJECUCIÓN     rondas y matches, listas de salida, equipos por match
RESULTADOS    resultados, importación de resultados, categorías de rating
DINERO        cuotas → FACTURA PDF + cuenta bancaria (¡sin pasarela!)
              alguien marca la factura como pagada
OPERACIÓN     app de QR (check-in), tracking de participantes, requisitos
STAFF         turnos (workShift), tipos de trabajo, tareas
EXTRAS        certificados PDF, plantillas de documentos, catering, webDAV
```

Conclusión: es un CRUD grande y bien ordenado. Nada exótico.

## 2. Mapeo módulo por módulo → nuestra versión práctica

| Ready2Race | Versión práctica R2H | Con qué | Cuándo |
|---|---|---|---|
| appuser, auth, role | Auth de InsForge + tabla de perfiles con rol | InsForge Auth | Ya |
| club | campo "club/box" en el participante (tabla después si crece) | Postgres | Ya |
| event, eventDay, eventInfo | events + event_days; la info pública ya la da la landing | Postgres + landing | Ya |
| fee, invoice, bankAccount | products + Mercado Pago Checkout Pro + webhook. MÁS simple que R2R: nadie marca pagos a mano | MP + Edge Function | Ya |
| eventRegistration, participant, namedParticipant | registrations + members; el formulario ya existe en la landing | landing + Postgres | Ya |
| participantRequirement | waiver aceptado + datos de emergencia (un check, no un motor de requisitos) | Postgres | Ya |
| qrCodeApp, appUserWithQrCode | check-in con QR desde el celular del staff | PWA + InsForge | Ya |
| competitionSetup/Template/Category | categorías + heats/rondas configurables por evento; plantillas = copiar evento anterior | Postgres | Ya |
| competitionExecution (matches, rounds) | heats con carriles (hybrid) / partidos (torneo); mismo esqueleto de tabla | Postgres | Ya (hybrid) |
| startListConfig | lista de salida = vista imprimible de heats asignados | pantalla + export | Ya |
| results, matchResultImportConfig | captura simple de tiempos/marcadores + import CSV + publicar | pantalla + Edge Function | Ya |
| substitution, deregistration | botones "sustituir miembro" y "dar de baja" auditados | acciones protegidas | Ya |
| task, workShift, workType | tareas + turnos de staff (dos tablas y una pantalla) | Postgres | Ya |
| email | correos transaccionales (confirmación, QR, recordatorio) | Edge Function | Ya |
| eventDocument, webDAV | archivos del evento en Storage | InsForge Storage | Ya |
| certificate, documentTemplate | constancias PDF | después | Fase 2 |
| participantTracking, timecode | splits detallados / chips | después | Fase 2 |
| ratingcategory | rankings entre eventos | después | Fase 2 |
| caterer | no aplica | — | Nunca |
| captcha | ya lo resuelve la landing | — | — |

## 3. El sistema completo, en corto

```text
LANDING (hecha)  →  vende y registra
INSFORGE         →  ~15 tablas + 4 edge functions + storage + auth
PANEL R2H        →  6 pantallas de trabajo
MERCADO PAGO     →  cobra solo (webhook confirma, nadie concilia a mano)
```

### Las ~15 tablas

```text
contacts, events, event_days, products, registrations, registration_members,
orders, payments, tickets, webhook_events, categories, heats, heat_entries,
results, staff, shifts, tasks, incidents, activity_log
```
(19 contando auditoría; sin prefijos por módulo ni bus de eventos: eso era
sobre-ingeniería para esta escala. Se agregan tablas cuando un evento real
las pida.)

### Las 4 edge functions

```text
create-checkout    valida cupo, crea registro y orden, abre Mercado Pago
mp-webhook         confirma pago, folio, ticket QR, correo (idempotente)
admin-actions      acciones auditadas: pago en sitio, reenviar QR, baja,
                   sustitución, corrección de resultado
send-email         confirmaciones y recordatorios
```

### Las 6 pantallas del panel

```text
1. Evento       crear/configurar: días, productos, categorías, cupos
2. Personas     buscar a cualquiera y ver todo lo suyo + acciones
3. Check-in     escanear QR (offline), buscar por nombre, kits
4. Competencia  armar heats, lista de salida, capturar y publicar resultados
5. Staff        turnos, tareas, incidencias
6. Caja         ventas, pagos, conciliación con MP, exportaciones
```

## 4. El ciclo (idéntico al documento rector, ahora aterrizado)

```text
CONFIGURAR (pantalla 1) → VENDER (landing+MP, solo) → PREPARAR (3-5)
→ OPERAR día D (3-4-5) → CERRAR (4 publica, 6 concilia y exporta)
```

## 5. Orden de construcción práctico

```text
Semana 1-2   tablas + create-checkout + mp-webhook + correo con QR
             → LA LANDING EMPIEZA A VENDER
Semana 3-4   pantallas 1, 2 y 6 (evento, personas, caja)
Semana 5     pantalla 3 (check-in offline) + ensayo sin wifi
Semana 6-7   pantalla 4 (heats y resultados) + pantalla 5 (staff)
Semana 8     simulacro completo + congelar
Después      certificados PDF, tracking fino, rankings, carreras, torneos
             (todo existe en R2R como referencia de cómo modelarlo)
```

## 6. Regla de simplicidad

Ante cada duda de diseño: **¿cómo lo hace Ready2Race?** Si su solución es un
CRUD, copiamos la idea con menos tablas. Si su solución es un motor complejo
(plantillas de setup, requisitos, rating), lo sustituimos por la versión
manual + un botón, y solo lo automatizamos cuando duela dos eventos seguidos.

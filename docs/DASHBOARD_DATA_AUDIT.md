# Auditoría de datos — Dashboard V1 Control de Ventas

Fecha: 2026-09-23 (America/Mérida).
Alcance: lectura del repo `ready2hybrid` y del proyecto InsForge ya enlazado
(`ready2hybrid`, app `4bg9ufz2`, `us-east`). No se modificó schema, datos,
funciones, checkout, pricing ni landing.

Evidencia viva (agregados, sin PII): 4 órdenes, 2 pagos, 2 tickets, 3 webhooks,
2 jobs de outbox, 1 fila en `affiliates`. Volumen de prueba, no de producción.

Hay cambios locales previos sin commitear en pricing y tests. Esta auditoría
no los incluye ni los revierte. El código citado es el del árbol de trabajo
cuando coincide con `HEAD`; `price_basis` ya está en `HEAD`.

---

## 1. Resumen ejecutivo

La venta confirmada en ready2hybrid es una orden cuyo estado interno es
`orders.state = 'PAID'`. Ese estado lo escribe solo `webhook_apply_payment_tx`,
después de verificar la firma del webhook, consultar el pago en Mercado Pago
y comprobar ownership, monto, moneda y `external_reference`. El redirect del
navegador no marca la orden como pagada.

El revenue autoritativo, una vez aplicada esa verificación, es
`payments.amount_cents` con `payments.currency` (hoy siempre `MXN`) y
`payments.provider = 'MERCADOPAGO'`. El monto cotizado que se compara contra
Mercado Pago es `orders.total_cents`. Si no coinciden, la orden no pasa a `PAID`.

`products.price_cents` es el precio de catálogo. No es el monto cobrado.

Se puede construir hoy el control de ventas: órdenes, revenue aprobado,
funnel por estado de orden, categoría por `products`, participantes por
`team_size * quantity`, y atribución de partner por `orders.affiliate_code`.
No existe una tabla `community_partners`. El objeto real es `affiliates`.

Huecos que cambian el diseño, no lo bloquean:

- No hay columna `paid_at`. La fecha de aprobación sale de
  `payments.provider_updated_at` o de `activity_log`.
- La etapa de calendario sí se persiste, dentro de
  `orders.commercial_snapshot.commercial_stage` (`LAUNCH`, `PRESALE`, `REGULAR`).
  No hay columna `pricing_stage`.
- El motivo del precio (`price_basis`: `CALENDAR` o `AFFILIATE_LAUNCH_LOCK`)
  lo arma el checkout actual, pero las 4 órdenes vivas no lo traen.
- El correo del boleto sí deja rastro en `outbox_delivery_jobs`
  (`communication_type = 'TICKET_READY'`, `state = 'SENT'`). No hay
  `ticket_sent_at`. Un fallo de envío escribe `result` y deja `state` en
  `PENDING`.
- Una firma HMAC inválida no se guarda. El webhook responde y termina.

---

## 2. Arquitectura de ready2hybrid

Dos repos. Este es el backend y la PWA de staff. La landing pública vive en
`hybrid-event-landing` y llama a las edge functions.

Edge functions desplegadas en el proyecto enlazado:

| Slug | Rol en la venta |
|---|---|
| `mp-create-checkout` | Crea la orden y la preferencia de Mercado Pago |
| `mp-webhook` | Recibe el webhook, verifica y aplica el pago |
| `get-order-status` | Lectura pública del estado (proyección, no autoridad) |
| `team-roster` | Roster por invitación (camino legacy) |
| `ticket-credentials` | Verificar / reemitir credencial. No entrega el QR en público |
| `send-ticket-email` | Genera PDF y envía el correo |

`payment-pending-expiry` existe en el repo y tiene RPCs en la base
(`expire_payment_pending_*`). No aparece en la lista de funciones desplegadas.
El estado `EXPIRED` está definido; el worker que lo aplica no está publicado.

RPCs de dominio que importan al dashboard (schema `public`):

- `checkout_start_tx`
- `checkout_attach_preference`
- `checkout_compensate_preference`
- `webhook_apply_payment_tx`
- `team_apply_payment_outcome`
- `ticket_issue_after_payment`
- `ticket_issue_one_registration`
- `ticket_revoke_tx`
- `expire_payment_pending_batch_tx` (y dry-run / lease)

Vista existente: `v_affiliate_sales`. No es la definición de venta del
dashboard (ver sección 11).

No hay enums de Postgres. Los estados son `text` con `CHECK`.

---

## 3. Modelo de datos

Nombres reales. Lo que no está en esta lista no existe como columna.

### orders

Orden comercial. La crea `checkout_start_tx`.

| | |
|---|---|
| PK | `id` uuid |
| FK | `buyer_contact_id` → `buyer_contacts.id`; `affiliate_code` → `affiliates.code` |
| Campos | `state`, `currency`, `subtotal_cents`, `total_cents`, `tracking_ref`, `external_reference`, `expires_at`, `cancellation_reason`, `commercial_snapshot` jsonb, `created_at`, `updated_at`, `idempotency_key_hash`, `idempotency_scope` |
| Escribe | `checkout_start_tx`, `checkout_attach_preference`, `checkout_compensate_preference`, `webhook_apply_payment_tx`, `expire_payment_pending_*` |
| Lee | `get-order-status`, `mp-webhook`, `send-ticket-email`, `v_affiliate_sales` |

`external_reference` se iguala a `orders.id::text` en el mismo `checkout_start_tx`.
Ese es el valor que viaja a Mercado Pago y con el que el webhook resuelve la orden.

No existen: `paid_at`, `pricing_stage`, `pricing_source`, `payment_provider`
como columna, `provider_payment_id` en la orden.

Dentro de `commercial_snapshot` (observado en las 4 órdenes vivas):
`commercial_stage`, `stage_resolved_at`, `pricing_rules_version`,
`unit_price_cents`, `total_price_cents`, `quantity`, `currency`,
`product_code`, `product_name`, `block`, `kind`, `team_size`,
`preference_id`, `provider`, `msi_eligible`, `economic_unit`,
`capacity_unit`. El checkout actual también envía `price_basis`.
Las órdenes vivas no lo tienen (0 de 4).

### order_items

Línea de la orden. Una por checkout en el flujo actual.

| | |
|---|---|
| PK | `id` uuid |
| FK | `order_id` → `orders.id`; `(product_id, product_code)` → `products(id, code)` |
| Campos | `quantity`, `unit_price_cents`, `item_total_cents`, `currency`, `journey`, `capacity_unit`, `commercial_snapshot` |
| Escribe | `checkout_start_tx` |
| Lee | reportes; el webhook cobra contra `orders.total_cents`, no contra esta fila |

`item_total_cents = unit_price_cents * quantity` está forzado por CHECK.

### payments

Pago confirmado contra el proveedor. Una fila por `(provider, provider_payment_id)`.
El estado se actualiza in-place; no hay tabla de historial de estados.
El historial de intentos está en `webhook_events` y `payment_verification_records`.

| | |
|---|---|
| PK | `id` uuid |
| Unique | `(provider, provider_payment_id)` |
| FK | `order_id` → `orders.id` |
| Campos | `provider`, `provider_payment_id`, `external_state`, `normalized_state`, `amount_cents`, `currency`, `external_reference`, `provider_created_at`, `provider_updated_at`, `last_verified_at`, `payer_identity_ref`, `sanitized_evidence_ref`, `reconciliation_state`, `created_at`, `updated_at` |
| Escribe | `webhook_apply_payment_tx` |
| Lee | expiración (detecta pago aprobado con orden no `PAID`), dashboard |

El provider que escribe el webhook es el literal `'MERCADOPAGO'`.
El checkout habla de `MERCADO_PAGO`. El snapshot guarda `provider: 'mercadopago'`.
Son tres grafías del mismo procesador. El dashboard debe leer `payments.provider`,
no hardcodear una sola cadena en la consulta.

No hay `paid_at`. La fecha de Mercado Pago persistida es
`provider_updated_at` (`date_last_updated` del pago) y `provider_created_at`
(`date_created`). `last_verified_at` es cuándo ready2hybrid lo verificó.

### payment_verification_records

Una fila por verificación aplicada (cuando la orden sí se resolvió).

Campos: `payment_id`, `order_id`, `merchant_ownership_ok`, `external_reference_ok`,
`amount_ok`, `currency_ok`, `normalized_result`, `verified_at`, `correlation_id`,
`reconciliation_state`, `sanitized_provider_evidence_ref`.

### webhook_events

Recibo del webhook **después** de una firma válida. Firma inválida: no hay fila.

| | |
|---|---|
| PK | `id` uuid |
| Unique | `(provider, provider_notification_id)` |
| FK | `payment_id` → `payments.id` |
| Campos | `signature_result` (se inserta `'VALID'`), `processing_state`, `result`, `sanitized_error`, `attempts`, `received_at`, `processed_at`, `canonical_input_hash`, `sanitized_headers` |
| Escribe | `webhook_apply_payment_tx` |

### products

Catálogo. `price_cents` no es el precio cobrado de una orden.

| | |
|---|---|
| PK | `id` uuid |
| Unique | `code`; también `(id, code)` |
| FK | `event_code` → `events.code` |
| Campos | `name`, `block`, `kind`, `journey`, `composition`, `team_size`, `price_cents`, `currency`, `cupo`, `day`, `session`, `sale_state`, `visibility`, `has_chip`, `has_insurance`, `capacity_unit`, `public_order` |
| Escribe | seeds y migraciones de catálogo. El checkout no reescribe el precio del producto |
| Lee | `mp-create-checkout`, emisión de tickets, email |

`composition` está vacío en los 28 productos vivos. Sexo y formato viven en
`code` y `name`. `cupo` es planeación, no tope de venta.

`block`: `COMPITE` | `EXPERIENCE` | `ASISTE`.
`kind`: `competitor` | `workout` | `spectator` | `press`.
`journey`: `J1` individual, `J2` dobles, `J3` relay, `J4` workout, `J5` público/prensa.

### events / event_days / event_category_sale_states

Un evento. Días del evento. Switch manual de venta por bloque
(`AVAILABLE` | `SOLD_OUT`). No es inventario.

### buyer_contacts

Pagador / contacto. No es automáticamente el competidor.

Campos: `id`, `public_ref`, `state` (default `ACTIVE`), `email`, `name`,
`phone`, `contact_consent_at`, `created_at`, `updated_at`.

Email con `@` si no es null (`ck_buyer_contacts_email_has_at`).
No hay índice por email, nombre ni teléfono.

### participants

Persona o unidad de acceso.

Campos: `id`, `public_ref`, `buyer_contact_id`, `participation_type`
(`COMPETITOR` | `SPECTATOR` | `PRESS` | `WORKOUT`), `state`, `name`,
`eligibility_state`.

`name` lo escribe el checkout para competidores (capitán y compañeros).
En público y prensa el nombre del participante queda null; el nombre útil
es el del `buyer_contacts`.

### registrations

Inscripción. Une persona, producto y orden.

Campos: `order_id`, `product_id`, `product_code`, `participant_id`,
`team_id`, `team_member_id`, `journey`, `state`, `event_id`, `event_code`.

Estados que el SQL escribe: `STARTED` al crear, `PAYMENT_CONFIRMED` al pagar,
`CANCELLED` al rechazar, cancelar o expirar. No hay CHECK de estado.
Vivo hoy: `STARTED` (2) y `PAYMENT_CONFIRMED` (2).

Checkout crea **una registration por unidad de `quantity`**. En equipos
`quantity` es 1: una registration porta al equipo. En público, `quantity` N
crea N registrations y N participants.

### teams / team_members

Solo productos con `team_size > 1`.

`teams`: `required_size`, `slots_complete`, `roster_state`, `payment_state`,
`eligibility_state`, `product_code`, `name`.

`roster_state`: `PROVISIONAL`, `PAYMENT_PENDING`, `PAID_ROSTER_INCOMPLETE`,
`PAID_ROSTER_COMPLETE`, `ELIGIBLE`, `BLOCKED`, `CANCELLED`.

El checkout actual (0028) inserta capitán y compañeros en `COMPLETE`.
Al pagar, `team_apply_payment_outcome` (0026) pasa un equipo sin miembros
`INVITED` directo a `ELIGIBLE`. Ese es el camino que emite el boleto.

### tickets / ticket_credential_generations / access_entitlements

El boleto no tiene `order_id`. Se llega por `tickets.registration_id` →
`registrations.order_id`.

`tickets`: `id`, `folio`, `folio_namespace`, `state`, `issued_at`,
`revoked_at`, `reissued_at`, `product_code`, `participant_id`.

`state`: `PENDING`, `ISSUED`, `REISSUED`, `USED`, `REVOKED`, `CANCELLED`.

El QR en claro no se guarda. Se guarda `ticket_credential_generations.token_hash`.
El token opaco se genera al emitir y al reemitir para el correo; no es una
columna consultable del dashboard.

### outbox_delivery_jobs

Cola de comunicación.

Campos: `communication_type`, `template`, `destination_ref`,
`domain_event_ref`, `minimal_payload`, `state`, `attempts`, `result`,
`next_attempt_at`, `created_at`, `updated_at`.

El boleto inserta `communication_type = 'TICKET_READY'`,
`domain_event_ref = 'ticket:' || ticket_id`, `state = 'PENDING'`.
`send-ticket-email` pasa esa fila a `SENT` y guarda el id de Resend en
`result`. No hay `sent_at`.

### affiliates

Partner de referencia. No hay `community_partner`, `referral` ni `partner_id`.

| | |
|---|---|
| PK | `code` text `[A-Z0-9]{3,12}` |
| Campos | `name`, `contact_name`, `contact_email`, `contact_phone`, `commission_bps`, `active`, `locks_launch_price`, `created_at` |
| Escribe | alta operativa (no el checkout) |
| Lee | `mp-create-checkout` (`code, active, locks_launch_price`); `checkout_start_tx` copia el code activo a `orders.affiliate_code` |

`locks_launch_price` (0029): si el affiliate está activo y el producto es
`competitor`, el checkout cobra precio de lanzamiento. `commercial_stage`
sigue siendo la etapa de calendario, no se reescribe a `LAUNCH`.

### capacity_holds

TTL de checkout. Estados: `ACTIVE`, `CONVERTED`, `RELEASED`, `EXPIRED`,
`CONFLICT`. No es inventario comercial.

### activity_log

Bitácora append-only. Es el timeline que sí existe.

Acciones vivas: `CHECKOUT_START`, `CHECKOUT_PREFERENCE_ATTACHED`,
`WEBHOOK_PAYMENT_APPLIED`, `WEBHOOK_VERIFICATION_REJECTED`, `TICKET_ISSUED`,
`TICKET_CREDENTIAL_REISSUED`, `TICKET_REVOKED`.

Campos: `named_action`, `entity_type`, `entity_ref`, `result`, `failure_class`,
`correlation_id`, `sanitized_metadata`, `created_at`. Sin PII de tarjeta.

### Otras tablas, fuera del KPI de ventas

`idempotency_records`, `capability_credentials`, `waiver_documents`,
`waiver_acceptances`, `participant_sensitive_profiles`. La última es un
cascarón sin columnas médicas. No entra al dashboard de ventas.

---

## 4. Relaciones

```
events 1—N products
events 1—N event_days
events 1—N event_category_sale_states

buyer_contacts 1—N orders
buyer_contacts 1—N participants
affiliates 1—N orders          (orders.affiliate_code, nullable)

orders 1—N order_items
orders 1—N registrations
orders 1—N payments
orders 1—N capacity_holds
orders 1—N payment_verification_records

products 1—N order_items
products 1—N registrations
products 1—N teams

registrations N—1 participants
registrations 0..1 teams
registrations 1—0..1 tickets

teams 1—N team_members
team_members N—1 participants

tickets 1—N ticket_credential_generations
tickets 1—N access_entitlements
tickets 1—N outbox  (domain_event_ref = 'ticket:' || tickets.id, sin FK)

payments 1—N webhook_events
payments 1—N payment_verification_records
```

---

## 5. Lifecycle de una venta

| Paso | Quién | Qué escribe | IDs y tiempos |
|---|---|---|---|
| 1. Orden | `mp-create-checkout` → `checkout_start_tx` | `buyer_contacts`, `participants`, `orders` en `PREFERENCE_PENDING`, `order_items`, `registrations` en `STARTED`, `capacity_holds` `ACTIVE`, equipo si `team_size > 1`, `activity_log` `CHECKOUT_START` | `orders.id`, `tracking_ref`, `external_reference = id`, `expires_at`, `created_at`. Snapshot con `commercial_stage` y, en el código actual, `price_basis`. `affiliate_code` si el code está activo |
| 2. Preferencia MP | mismo handler, `MercadoPagoClient.createCheckoutProPreference`, luego `checkout_attach_preference` | `orders.state = PAYMENT_PENDING`. Snapshot suma `preference_id` y `provider: mercadopago`. `activity_log` `CHECKOUT_PREFERENCE_ATTACHED` | `preference_id` dentro del jsonb. No hay columna propia. No hay timestamp distinto de `orders.updated_at` y `activity_log.created_at` |
| 3. Fallo al crear preferencia | `checkout_compensate_preference` | orden `CANCELLED` (`cancellation_reason`), hold `RELEASED` | solo si la orden sigue en `CREATED` o `PREFERENCE_PENDING` |
| 4. Webhook entra | `mp-webhook` → `validateMercadoPagoWebhookSignature` | nada si la firma falla | |
| 5. Consulta a MP | `payments.getPayment` | nada todavía | usa el id del webhook, no el body como autoridad de monto |
| 6. Verificación | `webhook_apply_payment_tx` | `webhook_events.signature_result = VALID`, `payments` upsert, `payment_verification_records` | compara `amount_cents` con `orders.total_cents`, currency `MXN`, `external_reference` = id de orden, collector / live_mode |
| 7. Orden pagada | misma RPC, solo si el pago normalizado es `APPROVED` y la verificación pasa, y la orden está en `CREATED`, `PREFERENCE_PENDING` o `PAYMENT_PENDING` | `orders.state = PAID`, `updated_at = now()`, hold `CONVERTED`, registrations `PAYMENT_CONFIRMED`, equipo hacia `ELIGIBLE`, `activity_log` `WEBHOOK_PAYMENT_APPLIED` / `PAID` | no escribe `paid_at`. Conserva `payments.provider_payment_id`, `provider_updated_at`, `last_verified_at` |
| 8. Boleto | `ticket_issue_after_payment` → `ticket_issue_one_registration` | `tickets` (`issued_at`), credencial con hash, `access_entitlements`, outbox `TICKET_READY` / `PENDING`, `activity_log` `TICKET_ISSUED` | folio. El QR en claro no queda en la tabla |
| 9. Correo | `mp-webhook` llama `send-ticket-email` en fire-and-forget si el outcome es `PAID` o `ALREADY_PAID` y existen `INSFORGE_BASE_URL` y `TICKET_OPERATOR_BEARER`. Si faltan, no envía y no deja error | outbox `state = SENT`, `result` = id de Resend, `updated_at` | un fallo deja `result` con el error y `state` en `PENDING` |

Hold vencido con pago aprobado: la orden va a `REQUIRES_REVIEW`, el pago
queda `APPROVED`, no se emite boleto, y se inserta un outbox
`INTERNAL_ALERT` / `PAYMENT_REQUIRES_REVIEW`.

`PAID` no regresa a pending, rejected o cancelled por un webhook viejo.
`REFUNDED` y `CHARGED_BACK` sí pueden salir de `PAID`.

El estado `CREATED` está en el CHECK y en la compensación. El
`checkout_start_tx` vigente inserta directo `PREFERENCE_PENDING`.

---

## 6. Estados

### orders.state

| Estado | Significado | Quién lo escribe | Cuándo | Terminal |
|---|---|---|---|---|
| `CREATED` | Previsto antes de la preferencia. El checkout vigente no lo inserta | compensación lo acepta como origen | no ocurre en el insert actual | no |
| `PREFERENCE_PENDING` | Orden creada; preferencia de MP aún no pegada | `checkout_start_tx` | al crear | no |
| `PAYMENT_PENDING` | Preferencia creada; el comprador puede pagar. También permanece aquí si MP reporta pending | `checkout_attach_preference`; el webhook no lo cambia si ya está aquí | preferencia ok, o pago `pending` / `in_process` | no |
| `PAID` | Pago aprobado y verificado en servidor | `webhook_apply_payment_tx` | MP `approved` + checks ok | sí, hasta reembolso o contracargo |
| `REJECTED` | Pago rechazado | webhook | MP `rejected`, orden aún no pagada | sí |
| `CANCELLED` | Preferencia no se pudo crear, o MP canceló | `checkout_compensate_preference` o webhook | fallo de preferencia, o MP `cancelled` | sí |
| `EXPIRED` | Checkout venció sin pago aprobado | `expire_payment_pending_*` | `expires_at` pasado y orden `PAYMENT_PENDING`, sin pago aprobado. La función edge no está desplegada | sí |
| `REQUIRES_REVIEW` | Pago aprobado pero el hold ya no era convertible | webhook | hold expirado, liberado o en conflicto | no |
| `REFUNDED` | Reembolso sobre una orden pagada o en revisión | webhook | MP `refunded` | sí |
| `CHARGED_BACK` | Contracargo | webhook | MP `charged_back` | sí |

Proyección pública (`get-order-status`), que no es la autoridad del dashboard:
`PAID` → `APPROVED`; `PREFERENCE_PENDING` y `PAYMENT_PENDING` → `AWAITING_PAYMENT`;
`REQUIRES_REVIEW` → `REQUIRES_ACTION`.

### payments.normalized_state

`UNKNOWN`, `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `REFUNDED`,
`CHARGED_BACK`.

Mapa desde Mercado Pago: `approved` → `APPROVED`; `pending`, `in_process`,
`in_mediation`, `authorized` → `PENDING`; `rejected` → `REJECTED`;
`cancelled` / `canceled` → `CANCELLED`. Un status desconocido queda `UNKNOWN`
y no confirma la venta.

`external_state` guarda el status crudo del proveedor.
La fila se actualiza solo hacia un rango igual o mayor
(pending < rejected/cancelled < approved < refunded/charged_back).

### tickets.state

`PENDING`, `ISSUED`, `REISSUED`, `USED`, `REVOKED`, `CANCELLED`.
Las 2 filas vivas están `REVOKED`, con outbox `SENT`. Un boleto revocado
puede haber sido enviado.

### registrations.state

Sin CHECK. Valores que el SQL asigna: `STARTED`, `PAYMENT_CONFIRMED`,
`CANCELLED`. El update también contempla `PENDING_PAYMENT` como origen legado.

---

## 7. Definición de venta

```
venta = orders.state = 'PAID'
```

Condición real, no un alias. Solo la produce `webhook_apply_payment_tx`
cuando `payments.normalized_state` queda en `APPROVED` y
`merchant_ownership_ok`, `external_reference_ok`, `amount_ok`
(`payments.amount_cents = orders.total_cents`) y `currency_ok` (`MXN`)
son verdaderos.

No son venta:

- buyer insertado
- orden en `PREFERENCE_PENDING` o `PAYMENT_PENDING`
- `commercial_snapshot.preference_id` presente
- redirect de Mercado Pago
- `payments.normalized_state = 'PENDING'`
- `REQUIRES_REVIEW` (hay dinero aprobado y la orden no está `PAID`)
- `get-order-status` devolviendo algo distinto de la proyección de `PAID`

`REFUNDED` y `CHARGED_BACK` dejan de ser venta. `PAID` con ticket `REVOKED`
sigue siendo venta: la revocación no deshace el pago.

`v_affiliate_sales` no usa esta definición. Cuenta órdenes `PAID` con
affiliate y al menos un ticket que no esté `REVOKED` ni `CANCELLED`.
Sirve para comisión. No sirve como KPI de ventas.

---

## 8. Definición de revenue

| Dato | Dónde | Nota |
|---|---|---|
| payment id interno | `payments.id` | uuid de ready2hybrid |
| payment id del proveedor | `payments.provider_payment_id` | id de Mercado Pago |
| monto cobrado | `payments.amount_cents` | centavos MXN, confirmado por la consulta server-side |
| monto cotizado | `orders.total_cents` y `order_items.item_total_cents` | deben igualar al pago para llegar a `PAID` |
| moneda | `payments.currency` y `orders.currency` | CHECK `MXN` |
| procesador | `payments.provider` | hoy `MERCADOPAGO` |
| status persistido | `payments.normalized_state` y `payments.external_state` | sí |
| fecha de aprobación | `payments.provider_updated_at` | proxy de `date_last_updated`. Alternativa de auditoría: `activity_log.created_at` donde `named_action = 'WEBHOOK_PAYMENT_APPLIED'` y `result = 'PAID'` |
| verificación | `payments.last_verified_at`, `payment_verification_records.verified_at` | cuándo lo confirmó el servidor |

Historial: `webhook_events` (una fila por notificación) y
`payment_verification_records` (una fila por verificación). El estado del
pago no se versiona; se pisa si llega un rango mayor.

No usar `products.price_cents` ni un monto calculado en el navegador.

Revenue aprobado = suma de `payments.amount_cents` de pagos `APPROVED`
cuya orden está `PAID`. Si en el futuro hubiera dos pagos `APPROVED` por
orden, sumar pagos inflaría el revenue; el modelo único es
`(provider, provider_payment_id)` y la venta es la orden. Para V1, sumar
`orders.total_cents` donde `state = 'PAID'` es equivalente mientras la
verificación exija igualdad de montos. Preferir `orders.total_cents` como
revenue de la orden y mostrar `payments.provider_payment_id` al lado.

---

## 9. Productos

28 filas vivas. `composition` es null. El precio de la tabla es catálogo
(en competidores coincide con lanzamiento, no con preventa ni regular).
El precio cobrado sale de la orden.

Agrupación comercial pedida, más lo que el catálogo tiene y no cabe ahí.

### COMPITE (`block = COMPITE`, `kind = competitor`)

| Grupo | Código | Nombre | Integrantes | Día | Sesión | Catálogo (centavos) | Venta |
|---|---|---|---|---|---|---|---|
| Individual | `IND-H` | Individual Hombre | 1 | 2026-11-13 | PM | 150000 | `AVAILABLE`, J1 |
| Individual | `IND-M` | Individual Mujer | 1 | 2026-11-13 | PM | 150000 | `AVAILABLE`, J1 |
| Dobles | `DOB-VIE-MM` | Dobles Mujeres · Viernes | 2 | 2026-11-13 | PM | 250000 | `AVAILABLE`, J2 |
| Dobles | `DOB-SAB-HH` | Dobles Hombres · Sábado | 2 | 2026-11-14 | ALL_DAY | 250000 | `AVAILABLE`, J2 |
| Dobles | `DOB-SAB-MH` | Dobles Mixto · Sábado | 2 | 2026-11-14 | ALL_DAY | 250000 | `AVAILABLE`, J2 |
| Relay | `REL-4H` | Relay 4 Hombres | 4 | 2026-11-15 | AM | 320000 | `AVAILABLE`, J3 |
| Relay | `REL-4M` | Relay 4 Mujeres | 4 | 2026-11-15 | AM | 320000 | `AVAILABLE`, J3 |
| Relay | `REL-2H2M` | Relay Mixto 2H+2M | 4 | 2026-11-15 | AM | 320000 | `AVAILABLE`, J3 |

Fuera de venta, conservar en histórico y excluir del catálogo activo:
`IND-PRO-H`, `IND-PRO-M` (`RETIRED_PRODUCT`); `DOB-VIE-HH`, `DOB-VIE-MH`,
`DOB-SAB-MM` (`SUPERSEDED_SCHEDULE_VARIANT`, fechas de octubre y `journey` null).

Precios por etapa en código (`PRODUCT_STAGE_PRICES`, centavos), competidores
con checkout abierto: lanzamiento / preventa / regular.
Individual 150000 / 165000 / 180000. Dobles 250000 / 275000 / 300000.
Relay 320000 / 350000 / 380000.

### ½ HYBRID (`block = EXPERIENCE`, `kind = competitor`)

| Grupo | Código | Nombre | Integrantes | Día | Sesión | Catálogo |
|---|---|---|---|---|---|---|
| Individual | `HALF-IND-H` | ½ Hybrid Individual Hombre | 1 | 2026-11-14 | ALL_DAY | 80000 |
| Individual | `HALF-IND-M` | ½ Hybrid Individual Mujer | 1 | 2026-11-14 | ALL_DAY | 80000 |
| Dobles | `HALF-DOB-HH` | ½ Hybrid Dobles Hombres | 2 | 2026-11-14 | ALL_DAY | 160000 |
| Dobles | `HALF-DOB-MM` | ½ Hybrid Dobles Mujeres | 2 | 2026-11-14 | ALL_DAY | 160000 |
| Dobles | `HALF-DOB-MH` | ½ Hybrid Dobles Mixto | 2 | 2026-11-14 | ALL_DAY | 160000 |

Etapas: individual 80000 / 90000 / 100000. Dobles 160000 / 180000 / 200000.

### EXPERIENCE que no es ½ Hybrid

| Código | Nombre | Integrantes | Precio único | Día |
|---|---|---|---|---|
| `WOD-H` | Workout Experience Hombre | 1 | 35000 | 2026-11-14 |
| `WOD-M` | Workout Experience Mujer | 1 | 35000 | 2026-11-14 |

`kind = workout`, journey `J4`. Mostrarlo aparte. No mezclarlo con ½ Hybrid.

### ASISTE

| Grupo | Código | Nombre | Unidad | Precio | Día |
|---|---|---|---|---|---|
| Público | `PUB-VIE` `PUB-SAB` `PUB-DOM` | Público por día | 1 por quantity | 25000 | 13, 14 o 15 nov |
| Público | `PUB-3D` | Público · Pase 3 Días | 1 por quantity | 60000 | null (pase) |
| Prensa | `FOT-VIE` `FOT-SAB` `FOT-DOM` | Fotógrafo por día | 1, quantity forzada a 1 | 35000 | 13, 14 o 15 nov |
| Prensa | `FOT-3D` | Fotógrafo · Pase 3 Días | 1 | 80000 | null |

Público y prensa no cambian de precio entre etapas.

### Inscripciones vendidas vs participantes

```
participantes = order_items.quantity * products.team_size
```

Eso coincide con el modelo real:

- Individual, ½ Hybrid individual, workout, prensa: `quantity = 1` y
  `team_size = 1` → 1 participante. El checkout rechaza otra quantity.
- Dobles: `quantity = 1`, `team_size = 2` → 2. Los nombres están en
  `team_members` / `participants.name`.
- Relay: `quantity = 1`, `team_size = 4` → 4.
- Público: `team_size = 1` y `quantity` puede ser N. Cada unidad crea un
  participant y una registration. 1 compra de 3 boletos = 3 participantes
  de acceso, sin nombre en `participants`.

No contar registrations de un equipo como participantes: un relay pagado
tiene 1 registration y 4 integrantes.

---

## 10. Pricing stages

No hay columna `pricing_stage`, `effective_price`, `pricing_source` ni
`override_reason`.

Lo que sí se guarda en `orders.commercial_snapshot` y en el snapshot del ítem:

| Campo | Valores | En las 4 órdenes vivas |
|---|---|---|
| `commercial_stage` | `LAUNCH`, `PRESALE`, `REGULAR` | sí, las 4 en `LAUNCH` |
| `stage_resolved_at` | ISO del instante de resolución | sí |
| `pricing_rules_version` | `r2h-commercial-2026.1` | sí |
| `unit_price_cents`, `total_price_cents` | precio cobrado | sí |
| `price_basis` | `CALENDAR` o `AFFILIATE_LAUNCH_LOCK` | no (0 de 4) |

`commercial_stage` es la etapa de calendario (America/Mérida), no el motivo
del precio. Un community partner con `locks_launch_price` paga lanzamiento
y la etapa guardada sigue siendo la pública (`PRESALE` o `REGULAR`).
Sin `price_basis` no se debe inferir el lock por el monto.

El lock vive en `affiliates.locks_launch_price` y se aplica en
`orchestrateCheckoutStart` solo si el affiliate está activo y
`products.kind = 'competitor'`. No se copia un motivo a la orden más allá
de `price_basis` en el snapshot del código actual.

`products.commercial_stage_high_water` lo lee el checkout si viniera en la
fila. No es una columna del schema vivo. `resolveEffectiveStage` ignora
cupo y high-water: la etapa efectiva es el calendario.

GAP: `price_basis` no está materializado en las órdenes existentes.
El código de `HEAD` sí lo mete al snapshot de órdenes nuevas, si el
bundle desplegado es ese código. Esta auditoría no comparó el hash del
bundle vivo con el repo. El CLI muestra `mp-create-checkout` con
`deployedAt` 2026-07-27 y `updatedAt` 2026-09-22.

---

## 11. Community Partners

No hay entidad `community_partner`. El soporte real es `affiliates` más
`orders.affiliate_code`.

1. La landing puede mandar `affiliate_code` en el body de checkout.
   El parser lo acepta, lo normaliza a `[A-Z0-9]{3,12}` y descarta un valor
   inválido sin fallar el checkout.
2. `mp-create-checkout` lee `affiliates` por `code`.
3. `checkout_start_tx` persiste el code solo si existe y `active = true`.
   Si no, `orders.affiliate_code` queda null. No bloquea la compra.
4. Queda en la orden, no en `payments`.
5. Una venta aprobada de un partner es
   `orders.state = 'PAID' AND orders.affiliate_code = affiliates.code`.
6. Revenue: `orders.total_cents` de esas órdenes.
   Participantes: `quantity * team_size` de sus ítems.
   Categorías: `products.block` / `code` de sus ítems.

Las 4 órdenes vivas tienen `affiliate_code` null. Hay 1 affiliate en catálogo.
Hoy se puede responder la pregunta; el resultado actual es cero ventas
atribuidas.

`v_affiliate_sales` agrega `orders_paid`, `tickets_valid`, `gross_cents`,
`commission_cents`. Excluye órdenes `PAID` cuyos tickets están todos
revocados o cancelados, y no trae participantes ni desglose por categoría.
Para el dashboard, agregar desde `orders` + `order_items` + `products`.
Usar la vista solo si se quiere la comisión con boleto aún vigente.

Contacto del partner (`contact_email`, `contact_phone`) es PII. No hace
falta en el tablero de ventas. El nombre público del partner es `affiliates.name`.

---

## 12. Payments

Ver secciones 6 y 8. Resumen operativo:

- El id que se busca en soporte es `payments.provider_payment_id`.
- El id interno es `payments.id`.
- El vínculo a la orden es `payments.order_id` y `external_reference`
  (texto del uuid de la orden).
- Estado de negocio del pago: `normalized_state`.
- Estado crudo: `external_state`.
- No hay historial de estados del mismo pago; sí hay N `webhook_events`
  y N `payment_verification_records`.

---

## 13. Tickets

| Pregunta | Respuesta |
|---|---|
| Boleto generado | existe fila en `tickets` con `issued_at` no null, o `activity_log` `TICKET_ISSUED`. El estado actual puede ser `REVOKED` |
| Ticket id | `tickets.id`. Folio visible: `tickets.folio` |
| QR | no se persiste en claro. `token_hash` en `ticket_credential_generations` |
| Enviado | `outbox_delivery_jobs` con `domain_event_ref = 'ticket:' \|\| id`, `communication_type = 'TICKET_READY'`, `state = 'SENT'`. `result` = id de Resend. Tiempo: `updated_at` |
| Fallo | `result` con textos como `RESEND_ERROR:…` o `BUYER_EMAIL_MISSING`, y `state` que sigue en `PENDING`. No hay estado `FAILED` ni `email_status` |
| Sin fila de outbox | el boleto se emitió y el insert del job no ocurrió, o el correo ni siquiera se intentó |

`send-ticket-email` no crea el job. Lo crea `ticket_issue_one_registration`.
El sweep busca `TICKET_READY` + `PENDING`.

Las 2 filas vivas: tickets `REVOKED`, outbox `SENT`. El tablero tiene que
mostrar las dos cosas a la vez.

GAP menor: no hay `ticket_sent_at` ni un estado de error dedicado.
Con `state` + `result` + `updated_at` se puede operar.

---

## 14. Métricas disponibles

`AVAILABLE` = se puede calcular con datos ya persistidos, sin inferir.
`PARTIAL` = se puede aproximar, con una salvedad explícita.
`NOT AVAILABLE` = no hay dato.

| Métrica | Clase | Campo |
|---|---|---|
| Ventas aprobadas | AVAILABLE | `count(*)` de `orders` con `state = 'PAID'` |
| Revenue aprobado | AVAILABLE | `sum(orders.total_cents)` donde `state = 'PAID'`, conciliado con `payments.amount_cents` del pago `APPROVED` |
| Órdenes creadas | AVAILABLE | `count(*)` de `orders` (nacen en `PREFERENCE_PENDING`) |
| Pagos iniciados | PARTIAL | órdenes que llegaron a `PAYMENT_PENDING` o más allá. No hay columna “iniciado”. Proxy: `commercial_snapshot ? 'preference_id'` o `activity_log` `CHECKOUT_PREFERENCE_ATTACHED`. Una orden que luego pasa a `PAID` ya no está en `PAYMENT_PENDING`; hay que contar por el log o por presencia de `preference_id` |
| Pagos pendientes | AVAILABLE | `orders.state = 'PAYMENT_PENDING'`. El pago MP pending no tiene estado de orden distinto |
| Pagos rechazados | AVAILABLE | `orders.state = 'REJECTED'` y/o `payments.normalized_state = 'REJECTED'` |
| Pagos cancelados | AVAILABLE | `orders.state = 'CANCELLED'`. Mezcla fallo de preferencia y cancelación de MP. Separarlos con `cancellation_reason` y `payments.normalized_state` |
| Ticket promedio | AVAILABLE | revenue aprobado / ventas `PAID`. En centavos |
| Ventas por día | PARTIAL | no hay `paid_at`. Usar `payments.provider_updated_at` o `activity_log.created_at` del `WEBHOOK_PAYMENT_APPLIED` / `PAID`. `orders.updated_at` se mueve después y no sirve |
| Revenue por día | PARTIAL | mismo corte de fecha que ventas por día |
| Ventas acumuladas | PARTIAL | running sum sobre esa fecha |
| Revenue acumulado | PARTIAL | igual |
| Ventas por categoría | AVAILABLE | `PAID` join `order_items` join `products` (`block`, `code`, `team_size`) |
| Revenue por categoría | AVAILABLE | `orders.total_cents` o `order_items.item_total_cents` |
| Participantes vendidos | AVAILABLE | `sum(quantity * team_size)` en órdenes `PAID` |
| Ventas por etapa | PARTIAL | `commercial_snapshot->>'commercial_stage'` en órdenes `PAID`. Es etapa de calendario, no el precio de partner |
| Revenue por etapa | PARTIAL | igual |
| Ventas Community Partner | AVAILABLE | `PAID` y `affiliate_code` not null, join `affiliates` |
| Revenue Community Partner | AVAILABLE | `sum(total_cents)` de esas órdenes |
| Ventas por procesador | AVAILABLE | `payments.provider`. Hoy un solo valor, `MERCADOPAGO` |
| Boletos generados | AVAILABLE | `tickets` con `issued_at` no null, vía registration de órdenes `PAID` |
| Boletos enviados | AVAILABLE | outbox `TICKET_READY` y `state = 'SENT'` |
| Boletos con error | PARTIAL | outbox `TICKET_READY`, `state <> 'SENT'` y `result` no null. Un `PENDING` reciente aún no es error |
| Última venta aprobada | PARTIAL | orden `PAID` con max(`payments.provider_updated_at`) o max del `activity_log` |

---

## 15. Gaps

### P0 — hace falta para no mentir en el V1

- `paid_at` no existe. Sin una regla única de fecha, “ventas por día” y
  “última venta” se calculan distinto según quién consulte. Regla V1
  propuesta, sin migración: fecha = `payments.provider_updated_at` del pago
  `APPROVED`; si es null, `activity_log.created_at` de
  `WEBHOOK_PAYMENT_APPLIED` / `PAID`.
- `price_basis` no está en las órdenes vivas. “Etapa” y “precio de partner”
  no son la misma serie. El V1 debe mostrar etapa desde `commercial_stage`
  y partner desde `affiliate_code`, y no reclamar que la etapa explica el
  monto cuando hay lock.
- `v_affiliate_sales` no es el KPI de ventas. Usarla como revenue de partners
  esconde órdenes `PAID` con boleto revocado.

### P1 — muy útil, no bloquea el primer tablero

- Persistir `price_basis` de forma consultable (ya va en el snapshot del
  código actual; falta verlo en órdenes nuevas y, si se quiere histórico,
  no backfillear por monto).
- Firma HMAC inválida no se persiste. “Webhook fallido” solo se ve si la
  firma pasó y la verificación de negocio falló
  (`WEBHOOK_VERIFICATION_REJECTED`, `webhook_events.result`).
- `payment-pending-expiry` no está desplegada. `EXPIRED` puede no ocurrir
  aunque `expires_at` ya pasó. El tablero sí puede listar
  `PAYMENT_PENDING` con `expires_at < now()` como anomalía.
- Fallo de correo no cambia `outbox.state` a un valor de error.
- No hay índice por `buyer_contacts.email`, `name` ni `phone`.
- Tres grafías del mismo proveedor (`MERCADOPAGO`, `MERCADO_PAGO`,
  `mercadopago`). La serie “por procesador” debe normalizar al leer.

### P2 — puede esperar

- Columna `paid_at` dedicada.
- Columna `ticket_sent_at`.
- `email_status` con CHECK.
- Historial inmutable de `payments.normalized_state`.
- `orders.payment_provider` desnormalizado.
- Workout y prensa como bloques de primer nivel en el marketing del
  dashboard. En datos ya están; solo hay que no ocultarlos.
- Openpay. La columna `payments.provider` ya admite otro valor. No hay
  filas ni webhook.

No son gaps: `provider_payment_id`, `tracking_ref`, email, teléfono,
nombre del comprador, `affiliate_code`, `commercial_stage`, folio,
`issued_at`, outbox `SENT`.

---

## 16. Dashboard V1 propuesto

Sin UI en esta unidad. Superficie de staff, no pública. Consulta por una
función de lectura con rol de servicio, no desde el navegador con la llave
admin.

Filtros comunes: rango de fechas (sobre la fecha de aprobación definida en
P0), `products.block`, `products.code`, `orders.state`, `commercial_stage`,
`payments.provider`, `orders.affiliate_code`.

### A. Resumen ejecutivo

KPIs sobre el filtro, con la definición de venta de la sección 7:

- Ventas aprobadas
- Revenue aprobado (centavos → MXN al mostrar)
- Órdenes creadas
- Pending: `PAYMENT_PENDING`
- Rejected: `REJECTED`
- Ticket promedio
- Participantes: `quantity * team_size` de órdenes `PAID`
- Última venta: fecha proxy + `tracking_ref` + producto. Sin más PII en la tarjeta

### B. Funnel operativo

Contar órdenes que **alcanzaron** cada peldaño, no el estado actual solamente.
Si se cuenta el estado actual, una venta `PAID` desaparece de “checkout”.

| Peldaño | Cómo contarlo |
|---|---|
| Orden creada | toda fila de `orders` |
| Preferencia creada | `activity_log` `CHECKOUT_PREFERENCE_ATTACHED`, o snapshot con `preference_id` |
| Pago pendiente | estado actual `PAYMENT_PENDING`, o pago `normalized_state = PENDING` |
| Aprobada | `orders.state = 'PAID'` |
| Rechazada / cancelada / expirada / revisión | estados `REJECTED`, `CANCELLED`, `EXPIRED`, `REQUIRES_REVIEW` como salidas, no como un solo “failed” |

No dibujar un estado `CREATED` como paso real del flujo vigente.

### C. Ventas por categoría

Filas de producto vendible, agrupadas en COMPITE (individual / dobles / relay),
½ HYBRID (individual / dobles), Workout, Público, Prensa.
Columnas: ventas (`PAID`), revenue, participantes, % revenue, % ventas.
Excluir `RETIRED_PRODUCT` y `SUPERSEDED_SCHEDULE_VARIANT` del catálogo activo
y dejarlos en un grupo “histórico” si alguna orden los usó.

### D. Ventas por tiempo

Por día de `provider_updated_at` (o el fallback del log): ventas, revenue,
acumulados. Zona `America/Mérida`.

### E. Etapa comercial

Series separadas:

- Lanzamiento, Preventa, Regular: `commercial_snapshot->>'commercial_stage'`
  en órdenes `PAID`.
- Community Partner: órdenes `PAID` con `affiliate_code` not null.
  No restarlas de la etapa. Una orden puede ser Preventa **y** partner.
  El monto de partner puede ser el de lanzamiento aunque la etapa diga otra cosa.
  Etiquetarlo así hasta que `price_basis` exista en los datos.

### F. Método de pago

Agrupar por `payments.provider`. Hoy una barra: Mercado Pago.
La consulta no filtra `provider = 'MERCADOPAGO'` como única posibilidad.
Openpay entra el día que exista otra fila.

### G. Community Partners

Desde `affiliates` left join órdenes `PAID`:

- partner (`code`, `name`)
- ventas
- revenue
- participantes
- ticket promedio
- categorías (`products.code` o `block`)

No usar `v_affiliate_sales` como fuente de estas cifras.
`commission_bps` puede mostrarse como dato del partner, no como revenue.

### H. Requieren atención

Detectables hoy:

| Anomalía | Comprobación |
|---|---|
| Pending vencido | `orders.state = 'PAYMENT_PENDING'` y `expires_at < now()` |
| Pago aprobado y orden no pagada | `payments.normalized_state = 'APPROVED'` y `orders.state <> 'PAID'` (incluye `REQUIRES_REVIEW`) |
| Pagada sin boleto | `PAID` y no existe `tickets` para sus registrations (equipo no `ELIGIBLE`, o `PUB-3D` / `FOT-3D` bloqueados por el modelo de entitlement) |
| Boleto sin envío | ticket con `issued_at` y no hay outbox `TICKET_READY` en `SENT` |
| Error de envío | outbox `TICKET_READY`, `state <> 'SENT'`, `result` no null |
| Monto inconsistente | `payments.amount_cents` distinto de `orders.total_cents` en una orden `PAID`, o `payment_verification_records.amount_ok = false` |
| Verificación rechazada | `activity_log` `WEBHOOK_VERIFICATION_REJECTED` o `webhook_events.result = 'VERIFICATION_REJECTED'` |
| Rechazado | `orders.state = 'REJECTED'` |
| Webhook no cerrado | `webhook_events.processing_state` distinto de `PROCESSED` e `IGNORED` |

No detectar, porque no hay dato: firma HMAC inválida, pixel, campaña.

---

## 17. Tabla maestra de órdenes

Una fila por orden. Joins: `buyer_contacts`, `order_items`, `products`,
`payments` (el de mayor rango), `affiliates`, tickets vía registrations,
outbox vía tickets.

| Columna de UI | Campo real | Hoy |
|---|---|---|
| Fecha | `orders.created_at` para “creada”; fecha de aprobación según la regla P0 | sí, con la salvedad de `paid_at` |
| Order id | `orders.id` | sí |
| Tracking ref | `orders.tracking_ref` | sí, unique |
| Payment id | `payments.provider_payment_id` | sí, cuando hubo webhook que resolvió la orden |
| Cliente | `buyer_contacts.name` | sí |
| Email | `buyer_contacts.email` | sí |
| Teléfono | `buyer_contacts.phone` | sí, nullable |
| Producto | `products.name` / `order_items.product_code` | sí |
| Categoría | `products.block` + grupo por `team_size` / `kind` | sí, derivada |
| Integrantes | `order_items.quantity * products.team_size` | sí, derivada |
| Monto | `orders.total_cents` | sí |
| Currency | `orders.currency` | sí |
| Estado | `orders.state` | sí |
| Procesador | `payments.provider` | sí si hay pago; si no, null. El snapshot dice `mercadopago` tras la preferencia |
| Etapa | `commercial_snapshot->>'commercial_stage'` | sí en las órdenes actuales |
| Community Partner | `orders.affiliate_code` + `affiliates.name` | sí la columna; null si no hubo code activo |
| Fecha de aprobación | `payments.provider_updated_at` | proxy, no columna de orden |
| Ticket enviado | outbox `TICKET_READY.state = 'SENT'` | sí, por ticket, no por orden. Una orden de público con quantity > 1 tiene varios |

Búsqueda, en servidor, sobre datos ya guardados:

- nombre: `buyer_contacts.name`
- email: `buyer_contacts.email`
- teléfono: `buyer_contacts.phone`
- order id: `orders.id`
- tracking ref: `orders.tracking_ref`
- payment id: `payments.provider_payment_id`

No hay índice para las tres primeras. Con miles de órdenes un `ILIKE` sin
índice se siente; no rompe la corrección.

---

## 18. Detalle de una orden

Timeline posible con lo que sí está persistido. No inventar pasos sin fila.

| Evento de UI | ¿Hay registro? | Dónde |
|---|---|---|
| ORDER CREATED | sí | `orders.created_at`, `activity_log` `CHECKOUT_START` / `PREFERENCE_PENDING` |
| CHECKOUT CREATED | es el mismo paso | no hay tabla checkout aparte |
| PREFERENCE CREATED | sí | `CHECKOUT_PREFERENCE_ATTACHED`, snapshot `preference_id`. No llamar a esto “payment created”: todavía no hay fila en `payments` |
| PAYMENT CREATED | solo si el webhook resolvió la orden | `payments.created_at`, `provider_payment_id` |
| WEBHOOK RECEIVED | sí, si la firma fue válida | `webhook_events.received_at` |
| SIGNATURE VERIFIED | parcial | `signature_result = 'VALID'` en esa fila. Un rechazo de firma no deja rastro |
| PAYMENT VERIFIED | sí | `payment_verification_records.verified_at` y los cuatro booleanos |
| ORDER PAID | sí | `activity_log` `WEBHOOK_PAYMENT_APPLIED` result `PAID`. La orden no tiene `paid_at` |
| TICKET GENERATED | sí | `tickets.issued_at`, `TICKET_ISSUED` |
| EMAIL SENT | sí | outbox `state = 'SENT'`, `updated_at`, `result` |
| EMAIL FAILED | parcial | `outbox.result` con error y `state` todavía `PENDING` |

Orden sugerido del detalle: cabecera comercial (estado, monto, producto,
partner, etapa), timeline de `activity_log` + webhook + outbox, y solo ahí
el contacto.

---

## 19. Seguridad

La PWA ya es deny-by-default. Rutas actuales: `/ops/checkin` y `/ops/desk`.
`CHECKIN_STAFF` no debe ver registros financieros completos. Un dashboard de
ventas no hereda esas rutas.

Roles existentes: `OWNER`, `OPERATIONS_MANAGER`, `CHECKIN_STAFF`,
`SOLUTION_DESK`.

Recomendación, sin implementarla:

- Tablero agregado y revenue: `OWNER` y `OPERATIONS_MANAGER`.
- `SOLUTION_DESK` puede abrir una orden por `tracking_ref` o email, sin
  totales del evento y sin `commission_bps`.
- `CHECKIN_STAFF`: sin este dashboard.

| Clase | Campos | Dónde |
|---|---|---|
| PUBLIC/AGGREGATE | conteos, revenue total, mix por producto, etapa, provider | resumen |
| OPERATIVE | `tracking_ref`, `orders.state`, producto, etapa, `affiliate_code`, folio, estado de boleto | tabla |
| PII | `buyer_contacts.name`, `email`, `phone`, `participants.name`, contacto del affiliate | detalle, no el KPI |
| FINANCIAL | `total_cents`, `amount_cents`, `provider_payment_id`, `commission_bps` | resumen en agregado; en tabla, monto de esa orden para OWNER y OPERATIONS_MANAGER |
| INTERNAL | `idempotency_key_hash`, `token_hash`, `canonical_input_hash`, `sanitized_headers`, `payer_identity_ref`, `commercial_snapshot` crudo | no mostrar. Si hace falta soporte, un bloque colapsado sin hashes de credencial |

No mostrar, porque no deben salir del servidor y varios ni siquiera están
en estas tablas: API keys, access tokens, webhook secret, credenciales de
Resend, PAN o datos de tarjeta. El QR en claro tampoco se lee de la base
para el dashboard; el staff ve folio y estado.

RLS está forzado en las tablas de ventas. El dashboard no puede usar el
cliente anónimo. La lectura pasa por `project_admin` dentro de una función
o de un RPC de solo lectura.

---

## 20. Performance

Con miles de órdenes, leer las tablas directo desde el cliente está mal por
RLS y por PII, no por volumen. Postgres aguanta ese tamaño si la consulta
está acotada.

Índices que ya ayudan: `orders (state, created_at)`,
`orders (affiliate_code)` parcial, `payments (order_id)`,
`payments (normalized_state, updated_at)`, `registrations (order_id)`,
unique de `tracking_ref` y de `(provider, provider_payment_id)`.

Recomendación, sin crearla ahora:

1. Una vista o un RPC de solo lectura `ops_sales_order` que devuelva la
   fila maestra ya unida, con la fecha de aprobación calculada y
   participantes calculados. El dashboard no reimplementa los joins en
   cuatro pantallas.
2. Índices cuando se construya esa lectura, no antes:
   - `payments (provider_updated_at)` donde `normalized_state = 'APPROVED'`
   - expresión `(commercial_snapshot->>'commercial_stage')` en `orders`
   - `buyer_contacts (lower(email))` y, si la búsqueda por nombre es
     frecuente, `pg_trgm` sobre `name`
   - `outbox_delivery_jobs (domain_event_ref)` para el estado del boleto
3. No agregar por la vista `v_affiliate_sales` para los KPI de la sección 7.
4. Filtro de fechas obligatorio en la tabla maestra (default: mes en curso
   o desde apertura). El resumen puede ser “todo el evento”: son miles de
   filas, una sola agregación.
5. Paginación por `created_at, id`. Sin exportar PII a un archivo público.

No hace falta una tabla de hechos separada para el V1.

---

## 21. Próximos pasos

1. Aceptar esta definición de venta y la regla de fecha de la sección 15
   antes de dibujar UI.
2. Confirmar que el `mp-create-checkout` desplegado es el que persiste
   `price_basis`. Hasta entonces, la etapa y el partner van en series distintas.
3. Diseñar el RPC de lectura (aún sin crearlo) con el contrato de la tabla
   maestra y los roles de la sección 19.
4. Dejar fuera de este dashboard: Meta, pixel, GA4, atribución de campañas,
   WhatsApp y la landing.

No autorizado por este documento: UI, SQL nuevo, despliegue, commit, push.

# Día de 0046 — 21 oct 2026, madrugada

Congelado hasta esa ventana. La preventa cierra el 19 oct 2026 a las 23:59
(America/Mérida). Nada de esto se aplica antes, y solo con un pase explícito.
No toca `mp-webhook`. No incluye 0037. No usa `db migrations up --all` ni `--to`.

El archivo que se aplica es el commiteado
`insforge/migrations/0046_dual-provider-payment-core.sql`.
El CLI lee `migrations/` del checkout enlazado a `4bg9ufz2`, no
`insforge/migrations/`. Ese día se copia solo ese archivo al `migrations/`
del checkout cuyo `npx -y @insforge/cli current` muestre el proyecto
`ready2hybrid` / `4bg9ufz2`. No se copian 0032, 0037 ni 0045 en ese pase.

## Preflight, en solo lectura

Las dos consultas tienen que devolver cero filas. Si alguna no, no se aplica.

```sql
SELECT order_id, count(*) AS open_attempts
FROM public.payments
WHERE normalized_state IN ('UNKNOWN', 'PENDING')
  AND order_id IS NOT NULL
GROUP BY order_id
HAVING count(*) > 1;

SELECT id, order_id, normalized_state
FROM public.payments
WHERE normalized_state IN ('UNKNOWN', 'PENDING');
```

La primera es la que la propia migración aborta. La segunda es más estricta:
cero pagos `PENDING` o `UNKNOWN` en vuelo, no solo cero órdenes con dos.

## Aplicar

```bash
npx -y @insforge/cli current
npx -y @insforge/cli db migrations up 0046_dual-provider-payment-core.sql
```

Confirmar el proyecto antes del `up`. Un solo nombre de archivo.

## Pago real chico de Mercado Pago

Un cobro real, del monto más chico que la pasarela permita, con el webhook
de producción como está hoy (sin campo `provider`). Tiene que terminar en
`PAID` y emitir boleto. No se enciende Openpay en este paso.

## Una hora de monitoreo

Revisar `webhook_events` y `activity_log` de esa hora:

```sql
SELECT id, provider, processing_state, result, sanitized_error, received_at, processed_at
FROM public.webhook_events
WHERE received_at > now() - interval '70 minutes'
ORDER BY received_at;

SELECT id, actor_ref, named_action, entity_type, entity_ref, result, created_at
FROM public.activity_log
WHERE named_action IN ('WEBHOOK_PAYMENT_APPLIED', 'WEBHOOK_VERIFICATION_REJECTED')
  AND created_at > now() - interval '70 minutes'
ORDER BY created_at;
```

`activity_log` puede no tener `created_at` en alguna revisión. Si la columna
no existe, usar el timestamp que sí tenga la fila y no inventar otra consulta
de escritura.

## Cuándo ejecutar el rollback

Ejecutar `docs/openpay/0046-rollback-webhook-apply.sql` si ocurre cualquiera
de estas cosas:

- el pago de prueba no llega a `PAID`
- el pago de prueba llega a `PAID` y no emite boleto
- un rechazo con el hold abierto cierra el checkout
- una orden `EXPIRED` vuelve a `PAYMENT_PENDING` o a `PAID`
- una orden `PAID` cambia de estado hacia abajo

El rollback restaura la función viva guardada el 16 oct 2026.
`paid_payment_id`, el guard, el índice de un intento abierto y
`claim_payment_attempt` se quedan. El comentario de ese archivo dice por qué.
No se dropea la columna en el mismo paso.

## Lo que el diff ya muestra, para no descubrirlo de madrugada

La función viva hardcodea `v_provider := 'MERCADOPAGO'`.
0046 usa el provider del payload y, si falta, Mercado Pago.
Eso cubre el webhook actual.

0046 deja de marcar outbox cuando una orden ya `PAID` o `REQUIRES_REVIEW`
recibe un `provider_payment_id` nuevo. El cobro tardío con hold vencido
sigue yendo a revisión, y reembolso o contracargo siguen marcando outbox.
Un rechazo reintentable y el “PAID no baja” se conservan.
El texto completo y el diff están en `docs/openpay/`.

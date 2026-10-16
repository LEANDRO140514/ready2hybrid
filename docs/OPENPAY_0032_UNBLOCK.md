# Plan para destrabar 0032 (Openpay)

Estado: opción A aprobada como plan. B queda de seguimiento. C descartada.
0037 no entra. Congelado hasta el 21 oct 2026 en la madrugada; el runbook es
`docs/OPENPAY_0046_RUNBOOK.md`. 0032 no se aplica: el cuerpo pasó a 0046.
La tesorería no espera este pase. 0045 se aplica solo junto con el deploy
de ops-treasury, en un pase distinto y anterior a esta ventana.

Proyecto: `4bg9ufz2`. Head remoto de migraciones: **44**.
Archivo: `insforge/migrations/0032_dual-provider-payment-core.sql`.
Función viva de pagos: la que dejó `0038_card-rejection-keeps-open-checkout.sql`.
Webhook vivo: `insforge/functions/mp-webhook/index.ts`. El payload de
`webhook_apply_payment_tx` no incluye `provider`.

## Lo que sí es cierto

El webhook de Mercado Pago no envía `provider`.

Eso **no** es lo que rompe 0032. Dentro de 0032, la función de apply hace:

```sql
v_provider text := COALESCE(NULLIF(btrim(p->>'provider'), ''), 'MERCADOPAGO');
```

Si el campo falta o viene vacío, el pago se trata como Mercado Pago.
Un valor distinto de `MERCADOPAGO` u `OPENPAY` responde `UNKNOWN_PROVIDER`
y no mueve la orden.

El archivo que sí rechaza un payload sin provider es
`docs/specs/holding/migrations-blocked/0021_multi_provider_canonical_tx_neutralization.sql`.
Ahí la ausencia devuelve `MISSING_PROVIDER` y no se emite boleto.
**0021 no se aplica.** No se vuelve a meter en `insforge/migrations/`.

## Lo que sí traba 0032

1. El número 32 quedó detrás del head 44. El runner no puede aplicar un
   archivo atrasado. Hace falta un archivo nuevo, con número posterior a 44,
   que lleve el mismo cambio. No se usa `db migrations up --all` ni `--to`.
2. Aplicarlo reemplaza `webhook_apply_payment_tx`, que es la función que
   pasa una orden a `PAID` y llama a `ticket_issue_after_payment`.
3. También agrega `orders.paid_payment_id`, el guard de esa columna,
   `claim_payment_attempt` y el índice único de un intento abierto
   (`UNKNOWN` o `PENDING`) por orden.
4. `0038` se niega a correr si `paid_payment_id` ya existe. El orden correcto
   es aplicar el dual-provider primero y no volver a aplicar 0038.
5. `0037_openpay-minimal-adapter.sql` sigue fuera de este pase.

La rama de rechazo de 0032 ya contiene `REJECTED_RETRYABLE` con el hold
abierto, igual que 0038. Eso no sustituye un diff completo de las dos
funciones antes de aplicar.

## Opción A — archivo nuevo, sin tocar el webhook

Copiar el cuerpo de 0032 a una migración posterior a 44. Dejar el webhook
como está. El default `MERCADOPAGO` cubre el payload actual.

Antes de aplicar, en solo lectura:

- Cero órdenes con dos pagos `UNKNOWN` o `PENDING`. Si hay alguna, la
  migración aborta sola y no cambia el esquema.
- Diff de `webhook_apply_payment_tx` de 0032 contra la definición viva
  (0038): rechazo reintentable, no revivir una orden `EXPIRED`, no bajar
  una orden `PAID`, y `ticket_issue_after_payment` en el camino `PAID`.

Después de aplicar, un pago de prueba de Mercado Pago debe llegar a `PAID`
y emitir boleto. Openpay no se enciende en este paso.

Riesgo: se reemplaza la función que cobra y emite boletos mientras hay
ventas. Si el diff deja fuera un camino de 0038, un pago puede quedar
cobrado sin boleto o un rechazo de tarjeta puede cerrar un checkout que
hoy sigue abierto.

Horas: **6**. Tres de diff y pruebas locales, una del preflight en
producción, dos de aplicar y verificar un pago de Mercado Pago. El apply
sigue pidiendo pase aparte.

## Opción B — primero el webhook, después el SQL

Cambiar `mp-webhook` para enviar `provider: 'MERCADOPAGO'`, desplegar ese
bundle y solo entonces aplicar el archivo nuevo de la opción A.

Riesgo: un despliegue malo del webhook detiene la emisión de boletos
antes de tocar el esquema. El default de 0032 hace que este paso no sea
necesario para destrabar el SQL.

Horas: **9** (las 6 de A más 3 de bundle, despliegue y verificación del
webhook). Recomendada como seguimiento, no como condición.

## Opción C — exigir provider, como 0021

Aplicar una función que responda `MISSING_PROVIDER` si el campo no viene,
después de la opción B.

Riesgo: si el webhook nuevo no está realmente en producción, el siguiente
pago de Mercado Pago no emite boleto. Es el fallo que dejó 0021 bloqueada.

Horas: no se estiman. Esta opción no se usa.

## Opción D — dejarlo parqueado

No aplicar nada hasta después del evento. Mercado Pago sigue en la función
de 0038. Openpay sigue apagado.

Riesgo: ninguno sobre los cobros de hoy. Openpay no queda disponible.

Horas: **0**.

## Recomendación

Opción A, y solo con pase explícito para aplicar el archivo nuevo.
La opción B puede ir después, para que el provider no dependa del default.
No desplegar `openpay-create-charge` ni `openpay-webhook` en el mismo pase.
Ese encendido es otro corte, de unas **6 horas** adicionales, con un cobro
de sandbox después de que el SQL ya esté vivo.

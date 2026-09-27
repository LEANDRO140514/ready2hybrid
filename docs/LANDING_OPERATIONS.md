# Operación de la landing

Landing pública de Hybrid Experience:

https://hybrid-experience.enforma.mx/

Este documento es para operar esa venta. No publica nada y no abre las ventas.

## Propósito

La landing muestra el evento, los productos y el botón de pago. El cobro, la orden, el boleto y el QR no viven en la landing. Los resuelve ready2hybrid en InsForge, con Mercado Pago.

## Relación con ready2hybrid

```text
hybrid-experience.enforma.mx
        → inicio de checkout
InsForge ready2hybrid
        → orden, precio, pago, boleto
Mercado Pago
        → cobro
ops.enforma.mx
        → consulta y conciliación del equipo
```

La landing y el dashboard de operaciones son sitios distintos. El origen de checkout de la landing no se cambia al dominio `ops.enforma.mx`.

## Apertura y cierre de ventas

Hay dos controles distintos. Los dos tienen que permitir la venta.

1. **`SALES_CONFIG` en la landing** (`src/config/salesConfig.ts` del repo de la landing). El campo `status` vale `coming_soon`, `open` o `closed`. Hoy está en `coming_soon` y el botón dice «Próximamente». El checkout de la página solo arranca un pago cuando `status` es `open`. Cambiarlo es una decisión del organizador. Este documento no lo cambia.
2. **Calendario de precio y evento en ready2hybrid.** El calendario decide lanzamiento, preventa o regular. El checkout del backend rechaza la venta si el evento sigue en `CONFIGURADO`, si aún no llega `sales_open_at`, o si ya pasó `sales_close_at`.

El cupo del producto es dato de planeación. No apaga la venta ni marca agotado. Agotado solo existe si el organizador lo pone a mano.

## Calendario comercial

Zona `America/Merida`. Los cortes son a las 00:00. El día indicado entra en esa etapa; el cambio ocurre al empezar el día siguiente.

| Etapa | Vigencia |
|---|---|
| Lanzamiento | Hasta el 24 de septiembre de 2026, inclusive. La ventana en el código abre el 11 de agosto de 2026 |
| Preventa | 25 de septiembre – 16 de octubre de 2026 |
| Regular | 17 de octubre – 12 de noviembre de 2026 |
| Cierre | 13 de noviembre de 2026, 00:00 |

El precio no avanza porque se hayan vendido más lugares.

## Precios

Pesos mexicanos, por persona o por producto según el código. Tres columnas: lanzamiento, preventa, regular. Los productos de un solo precio no cambian de etapa.

| Producto | Lanzamiento | Preventa | Regular |
|---|---:|---:|---:|
| Dobles de competencia en checkout | 2,500 | 2,750 | 3,000 |
| Relevos (4H, 4M, 2H2M) | 3,200 | 3,500 | 3,800 |
| Individual | 1,500 | 1,650 | 1,800 |
| Half individual | 800 | 900 | 1,000 |
| Half dobles | 1,600 | 1,800 | 2,000 |
| WOD | 350 | 350 | 350 |
| Público, un día | 250 | 250 | 250 |
| Foto, un día | 350 | 350 | 350 |

Fuera de checkout, y no se ofrecen en la venta: dobles vie HH y MH, doble sab MM, individuales Pro, público 3 días y foto 3 días.

Algunos productos de competencia permiten meses sin intereses en Mercado Pago. WOD, público y foto no.

## Community Partners

Un partner es un código de referido. Si la compra trae un código activo, la orden guarda ese código. Si ese partner tiene el precio de lanzamiento bloqueado, el checkout cobra el precio de lanzamiento aunque el calendario ya esté en preventa o regular. La etapa del calendario no cambia; solo el precio cobrado.

La lista de nombres y códigos está en InsForge, tabla de affiliates. Este manual no inventa partners. En el dashboard aparecen como Community Partner, o como venta directa si no hubo código.

No hay comisión de partner en el dashboard. La conciliación no calcula un porcentaje de referido.

## Checkout y Mercado Pago

La persona elige producto en la landing y pasa a Mercado Pago Checkout Pro. Al volver, la landing consulta el estado de la orden. El webhook de InsForge es quien aplica el pago y dispara el boleto. Un pago aprobado con la orden todavía pendiente es una anomalía: se ve en **Requieren atención** del dashboard, no se corrige editando la base a mano.

## Boleto y QR

Cuando el pago queda aplicado, el backend emite el boleto. El QR identifica esa credencial. El envío por correo sigue siendo un paso aparte y no está cubierto por el simple hecho de que la orden esté pagada.

## Rollback

Si una publicación de la landing sale mal, se vuelve al deployment anterior de esa landing. No se tocan órdenes ni pagos ya cobrados para «deshacer» el sitio. Cerrar ventas en la página es poner `SALES_CONFIG.status` en `closed`. No se hace borrando productos.

## Checklist de smoke

Cuando el organizador autorice probar, no antes:

1. La landing abre en `https://hybrid-experience.enforma.mx/` con HTTPS.
2. Con `SALES_CONFIG.status` en `coming_soon` o `closed`, el botón no inicia un pago.
3. Con ventas abiertas, un producto de la tabla muestra el precio de la etapa de ese día.
4. Un partner con precio de lanzamiento bloqueado cobra lanzamiento, no el precio del día.
5. Mercado Pago recibe la preferencia y el regreso a la landing muestra el estado de esa orden.
6. Un pago de prueba aprobado deja la orden pagada y el boleto emitido.
7. Esa venta aparece en `https://ops.enforma.mx` como pagada, sin conciliar, hasta que finanzas la capture.

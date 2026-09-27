# Manual del dashboard de ventas

Para quien consulta las ventas de Hybrid Experience: Owner, Financiero, CEO y CTO. No hace falta saber de servidores ni de bases de datos.

La dirección de trabajo es:

https://ops.enforma.mx

## Entrar

1. Abre esa dirección.
2. Si todavía no tienes cuenta, entra a **Crear cuenta**, usa tu correo de trabajo y elige tu propia contraseña.
3. InsForge te manda un código de 6 dígitos. Escríbelo en **Verifica tu correo**.
4. Cuando diga que la cuenta está verificada, inicia sesión con ese correo y esa contraseña.

Nadie del equipo técnico te va a pedir la contraseña ni te la va a mandar por correo.

Si entras y solo ves **Inicio**, sin **Ventas**, la cuenta existe pero todavía no está autorizada para el dashboard. Avisa a Leandro. No es un fallo de tu contraseña.

## Roles

| Persona | Qué ve |
|---|---|
| Leandro (Owner) | Inicio, Ventas, y las pantallas operativas que ya tenía |
| Roberto, Valentina y Silvia | Inicio y Ventas |

Quienes entran como finanzas no ven Check-in ni Mesa. Nadie, desde este dashboard, cambia una orden, un pago, un precio, un producto, un estado ni un reembolso.

## El dashboard

Entra a **Ventas**. Los números de arriba corresponden al periodo que tengas elegido (hoy, 7 días, 30 días o un rango). Si el rango no cubre una venta, esa venta no entra en las cifras ni en la tabla.

### Qué significa cada cifra

**Ventas aprobadas.** Cuántas órdenes quedaron pagadas en el periodo.

**Ingreso bruto aprobado.** Suma de lo que el cliente pagó en esas órdenes, en pesos. Incluye las que ya conciliaste y las que todavía no.

**Costos registrados.** Suma de comisión, IVA de esa comisión y otros costos, solo de las ventas donde alguien ya guardó la conciliación.

**Ingreso neto conciliado.** De las ventas que ya tienen conciliación: su bruto menos sus costos. No resta costos imaginarios de las ventas que aún no se capturan.

**Bruto pendiente de conciliar.** Suma del bruto de las ventas pagadas que todavía no tienen conciliación.

**Pendientes de conciliar.** Cuántas ventas pagadas faltan por capturar.

**Ticket promedio.** Ingreso bruto aprobado dividido entre las ventas aprobadas del periodo.

**Participantes vendidos.** Personas que representan esas ventas, según el tamaño del producto (un individual cuenta uno; un equipo cuenta los integrantes del producto).

Si el neto conciliado es menor que el bruto, lo normal es que todavía haya ventas sin conciliar. Esas siguen en **Bruto pendiente**, no se dan por costo cero.

## Conciliación

Sirve para anotar lo que cobró el procesador y cualquier otro costo, sin tocar el cobro original.

1. En la tabla, abre la venta.
2. Ve a la conciliación financiera.
3. Revisa el bruto. Es el total de la orden. No se edita aquí.
4. Captura, en pesos:
   - comisión del procesador
   - IVA sobre esa comisión
   - otros costos
5. Si hace falta, escribe una nota.
6. Guarda.

Usa cero cuando el costo es cero. `0`, `0` y `0` significa «ya lo revisé y no hay costos». El neto de esa venta queda igual al bruto y el estado pasa a **Conciliado**.

**Pendiente** significa que nadie ha guardado la conciliación. No significa que el costo sea cero. Hasta que exista la fila, el neto de esa venta no entra al neto conciliado.

Al guardar, el sistema anota quién lo hizo y cuándo. En pantalla verás el nombre si Auth lo tiene; si no, el correo. No se muestra un identificador crudo.

Puedes corregir una conciliación ya guardada. La primera persona y la fecha de alta se conservan. La última modificación pasa a ser quien guarda el cambio.

## Tabla y búsqueda

Los filtros recortan la tabla, las cifras y el CSV. Exportar no saca ventas que el filtro ocultó.

- **Hoy, 7 días, 30 días o Rango.** El rango pide desde y hasta.
- **Buscar.** Nombre, correo, teléfono, orden, tracking o id de pago.
- **Producto.** Un código concreto, o todos.
- **Categoría.** COMPITE, EXPERIENCE / ½ HYBRID, ASISTE / Público, u OTROS / HISTÓRICOS.
- **Estado.** Por ejemplo Pagada, Pago pendiente, Rechazada, Requiere revisión.
- **Proveedor.** Quién procesó el pago. Hoy el activo es Mercado Pago.
- **Community Partner.** Venta directa, o el partner que vino en la compra.
- **Conciliación.** Todas, pendientes o conciliadas.

**Exportar CSV** baja las filas visibles. En una venta pendiente, las celdas de comisión, IVA, otros costos y neto van vacías, y el estado dice `PENDING`. En una conciliada con ceros, esos montos van `0.00` y el estado dice `RECONCILED`.

## Requieren atención

Es una lista de ventas que no cuadran solas. No las arregles editando datos a mano. Si una fila aparece aquí, avisa a quien opera el evento para que se revise el pago o el boleto por el flujo normal.

| Aviso | Qué está pasando |
|---|---|
| Checkout vencido sigue en PAYMENT_PENDING | El intento de pago ya venció y la orden sigue pendiente |
| Pago APPROVED y la orden no está PAID | Mercado Pago aprobó, pero la orden no quedó marcada como pagada |
| Orden PAID sin boleto | La venta está pagada y no tiene boleto emitido |
| Boleto generado sin correo SENT | El boleto existe y el correo no figura como enviado |
| Monto de la orden distinto al pago | Lo cobrado no coincide con el total de la orden |
| Verificación de pago rechazada | La comprobación del webhook no aceptó el pago |
| Orden en REQUIRES_REVIEW | La orden quedó marcada para revisión |
| Venta PAID sin fecha de aprobación | Está pagada y no hay fecha del pago aprobado |

Ver ese aviso no te da un botón para cambiar la orden. El dashboard no reembolsa ni corrige estados.

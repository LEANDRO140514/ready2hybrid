# Finance summary

Overrides `MASTER.md` for the Resumen tab inside Ventas.

Cards and KPI surfaces stay neutral (`#2A2A2A` / `#333333`). Brand-lime and brand-pink mark hierarchy or one selected figure, not every card. Conciliada, pendiente de conciliar, and pago pendiente use the semantic colors in MASTER, each with its word.

## Order

1. Page header: Control de ventas y conciliación financiera.
2. Filter bar. Specified default period: 30 días. Hoy remains a chip.
3. If unreconciled count > 0: the sentence and **Conciliar ahora**, which opens Conciliación.
4. Primary KPIs, in this order: ingreso bruto aprobado, bruto pendiente de conciliar, ingreso neto conciliado.
5. Complementary KPIs: ventas aprobadas, costos registrados, pendientes de conciliar.
6. Secondary KPIs: órdenes creadas, pagos pendientes, ticket promedio, participantes.
7. Requieren atención: the existing anomaly list. This is not the reconciliation queue.

## Wording

Pagos pendientes are unpaid orders. Pendientes de conciliar are paid orders without a finance row. The labels stay different.

## Empty period

If the period has no paid sales, the three primary figures show `$0.00` or `0`, and Conciliar ahora is hidden. Do not invent a target.

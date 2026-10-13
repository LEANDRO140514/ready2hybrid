# Sales

Overrides `MASTER.md` for the Ventas tab. This tab is commercial reporting. It does not capture processor costs.

## Blocks, in order

1. Operaciones por día. Count. Labeled bars in the chart palette from MASTER, plus the cumulative table.
2. Ingresos por día. MXN. A separate chart, plus the same table's income columns. Do not reuse success, warning, or danger as the series.
3. Productos. Horizontal bars sorted by income, then the existing product table. One brand color for the bars is enough.
4. Etapa comercial. Table only.
5. Community Partners. Table only. Partner commission is not a processor cost.
6. Proveedor. Table only.
7. Órdenes. Operational table: bruto, comisión, IVA, otros, neto, conciliación, estado, proveedor, pago. Exportar CSV stays here.

## Figures in the order table

No finance row on a paid order: comisión, IVA, otros, and neto are `—`, and the badge is PENDIENTE DE CONCILIAR.

A recorded 0/0/0: neto equals bruto, and the badge is CONCILIADA.

## Mobile

The order table becomes cards. Reconciliation capture is not this tab; the card links to the detail panel or to Conciliación.

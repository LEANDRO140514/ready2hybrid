# Reconciliation

Overrides `MASTER.md` for the Conciliación tab. This is a primary task.

Guardar conciliación is the brand-lime button with black text. PENDIENTE DE CONCILIAR and CONCILIADA keep the semantic warning and success colors. Brand-lime on that button does not mean the row is already reconciled.

## Header figures

Pendientes de conciliar, bruto pendiente, costos registrados, neto conciliado.

## Each paid order without a row

Show, in this order:

1. Fecha, orden, cliente, producto, proveedor, payment id, bruto.
2. Comisión del procesador, IVA de la comisión, otros costos, notas.
3. Neto calculado, updated as the user types.
4. Guardar conciliación.
5. Only after that, and smaller: conciliado por, última modificación, fecha/hora.

Do not put the audit lines above the fields.

## States

PENDIENTE DE CONCILIAR and CONCILIADA. PAGO PENDIENTE is a different badge and does not appear as a reconciliation task.

## Writing

Same `upsert-adjustment` contract. Blank is invalid. An explicit `0` is a captured zero. Do not suggest a Mercado Pago rate. Green is only the CONCILIADA badge, not the amount and not the save button.

## Mobile

One card per sale. Fields are full width. No horizontal reconciliation table. Targets are at least 44px.

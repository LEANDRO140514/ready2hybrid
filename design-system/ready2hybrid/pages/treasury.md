# Tesorería

Overrides `MASTER.md` for the treasury proposal. This is not the Ventas reconciliation lane and not the legacy bank lane.

Visible to OWNER and FINANCE. MARKETING does not open it. The future route is `/ops/finance/treasury`, after Conciliación. This page is the proposal. It does not write orders, payments, tickets, or the two reconciliation tables.

## What Robert does here

1. Maintain four catalogs: expense categories, suppliers, accounts/cash boxes, payment methods. Edit the name. Deactivate an item. Do not delete it. Inactive items stay on old movements and cannot be chosen for a new one.
2. Record additional income, a posted expense, or a scheduled expense. A scheduled expense is labeled PROGRAMADO and is excluded from efectivo realizado.
3. Capture one opening balance per account, with its reference date.
4. Load a CSV (the template also opens in Excel). Show a preview, row errors, and duplicates. Confirm writes only the ready rows.
5. Correct a movement. The panel lists who changed which field, from which value to which value. Registrar pago is the only way a scheduled expense becomes posted.

## Figures

Four figures, in this order: efectivo realizado, programado todavía no pagado, ingresos adicionales realizados, egresos realizados. Amounts stay white. PROGRAMADO uses the warning color together with the word. Brand-lime is the action, not the money.

Under the figures, one sentence: the known commercial amount already shown in Ventas is not added here and cannot be imported as income or as an opening balance.

## Import columns

`fecha,tipo,estado,cuenta,categoria,proveedor,forma_de_pago,concepto,monto,referencia`

`tipo` is `ingreso`, `egreso`, or `saldo_inicial`. `estado` is `programado` or `realizado`. Only an expense may be `programado`.

A row is a duplicate when its reference already exists, or when the same date, account, type, amount, and concept already exist. Duplicates are shown and skipped. They are not imported on confirm.

## Out of this proposal

No general ledger, no tax engine, no QuickBooks, no automatic bank feed, and no change to Mercado Pago or Openpay. Sales income stays in Ventas.

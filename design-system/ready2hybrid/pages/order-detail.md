# Order detail

Overrides `MASTER.md` for the drill-down panel. It is not a fourth Ventas section.

## Order of sections

1. Resumen financiero: bruto, costos if captured, neto or `—`.
2. Estado de pago: proveedor, payment id, estado, fecha del proveedor.
3. Conciliación: the same fields as the queue, still editable for OWNER and FINANCE when the order is PAID and has a payment.
4. Comprador.
5. Producto y participantes.
6. Community Partner, separate from processor cost.
7. Boleto y envío.
8. Timeline.

## Panel behavior

Opens over the current tab. Focus moves inside the panel. Cerrar returns focus to the control that opened it. The scrim is dark enough that the panel text stays on `#333333`, not on the page behind it.

## Permission

The form is present for the same roles that can save today. It does not add edit-order, refund, or state-change actions.

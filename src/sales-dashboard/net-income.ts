/**
 * Unified net-income CSV for both reconciliation lanes.
 * Legacy COMISION is the single gateway fee and already includes VAT.
 * IVA COMISION and OTROS COSTOS stay empty on that lane. They are not zero.
 */
import type { LegacyReconcileRow } from './legacy-reconciliation'
import { LEGACY_PROVIDER_LABEL } from './legacy-reconciliation'
import {
  approvedAt,
  approvedPayment,
  formatCsvDate,
  isSale,
  netRevenueCents,
  type SalesOrder,
} from './model'

export const NET_INCOME_NOTE =
  'COMISION de FUENTE Legacy incluye el IVA. IVA COMISION y OTROS COSTOS quedan vacíos en ese carril, no en cero.'

export type NetIncomeFilter = 'pending' | 'done' | 'all'

function pesos(cents: number): string {
  return (cents / 100).toFixed(2)
}

function money(cents: number | null): string {
  return cents == null ? '' : pesos(cents)
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function netIncomeToCsv(
  orders: SalesOrder[],
  legacy: LegacyReconcileRow[],
  filter: NetIncomeFilter,
): string {
  const header = [
    'FECHA', 'FUENTE', 'PROVEEDOR', 'REFERENCIA', 'BRUTO', 'COMISION',
    'IVA COMISION', 'OTROS COSTOS', 'NETO', 'CONCILIADO',
  ]
  const current = orders.filter(isSale).filter((order) => {
    const reconciled = order.adjustment != null
    if (filter === 'pending') return !reconciled
    if (filter === 'done') return reconciled
    return true
  })
  const historical = legacy.filter((row) => (row.grossCents ?? 0) > 0).filter((row) => {
    const reconciled = row.reconciliation != null
    if (filter === 'pending') return !reconciled
    if (filter === 'done') return reconciled
    return true
  })
  const lines = [
    ...current.map((order) => {
      const payment = approvedPayment(order)
      const adjustment = order.adjustment
      return [
        formatCsvDate(approvedAt(order) ?? order.createdAt),
        'Ready2Hybrid',
        payment?.provider ?? '',
        payment?.providerPaymentId ?? '',
        pesos(order.totalCents),
        money(adjustment ? adjustment.providerFeeCents : null),
        money(adjustment ? adjustment.providerFeeTaxCents : null),
        money(adjustment ? adjustment.otherCostsCents : null),
        money(adjustment ? netRevenueCents(order) : null),
        adjustment ? 'Sí' : 'No',
      ]
    }),
    ...historical.map((row) => {
      const reconciled = row.reconciliation
      return [
        formatCsvDate(row.paidAt),
        'Legacy',
        reconciled ? LEGACY_PROVIDER_LABEL[reconciled.provider] : '',
        row.operationKey ?? row.recordRef,
        pesos(row.grossCents ?? 0),
        money(reconciled ? reconciled.feeCents : null),
        '',
        '',
        money(reconciled ? reconciled.depositedCents : null),
        reconciled ? 'Sí' : 'No',
      ]
    }),
  ]
  const bruto = [...current.map((order) => order.totalCents), ...historical.map((row) => row.grossCents ?? 0)]
    .reduce((sum, cents) => sum + cents, 0)
  const neto = [
    ...current.filter((order) => order.adjustment).map((order) => netRevenueCents(order) ?? 0),
    ...historical.filter((row) => row.reconciliation).map((row) => row.reconciliation?.depositedCents ?? 0),
  ].reduce((sum, cents) => sum + cents, 0)
  const open = [
    ...current.filter((order) => !order.adjustment).map((order) => order.totalCents),
    ...historical.filter((row) => !row.reconciliation).map((row) => row.grossCents ?? 0),
  ].reduce((sum, cents) => sum + cents, 0)
  const body = [
    csvCell(NET_INCOME_NOTE),
    header.join(','),
    ...lines.map((cells) => cells.map(csvCell).join(',')),
    ['TOTAL BRUTO', '', '', '', pesos(bruto), '', '', '', '', ''].map(csvCell).join(','),
    ['NETO CONCILIADO', '', '', '', '', '', '', '', pesos(neto), ''].map(csvCell).join(','),
    ['BRUTO SIN CONCILIAR', '', '', '', pesos(open), '', '', '', '', ''].map(csvCell).join(','),
  ]
  return `\uFEFF${body.join('\n')}\n`
}

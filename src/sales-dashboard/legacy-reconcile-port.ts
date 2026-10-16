import { getInsforgeClient } from '../lib/insforge/client'
import { postProjectFunction } from '../lib/insforge/project-function'
import type {
  LegacyProvider,
  LegacyReconcileRow,
  SaveLegacyReconciliation,
} from './legacy-reconciliation'

export type LegacyReconcilePort = {
  list: () => Promise<LegacyReconcileRow[]>
  save: (input: SaveLegacyReconciliation) => Promise<void>
}

const PROVIDERS: readonly string[] = ['MERCADOPAGO', 'CLIP', 'OTHER']

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function int(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function parseRow(value: unknown): LegacyReconcileRow[] {
  if (!value || typeof value !== 'object') return []
  const row = value as Record<string, unknown>
  const id = text(row.id)
  const recordRef = text(row.recordRef)
  if (!id || !recordRef) return []
  let reconciliation: LegacyReconcileRow['reconciliation'] = null
  const done = row.reconciliation
  if (done && typeof done === 'object') {
    const item = done as Record<string, unknown>
    const deposited = int(item.depositedCents)
    const fee = int(item.feeCents)
    const provider = typeof item.provider === 'string' && PROVIDERS.includes(item.provider)
      ? (item.provider as LegacyProvider)
      : null
    if (provider && deposited != null && fee != null) {
      reconciliation = {
        provider,
        bankReference: text(item.bankReference),
        depositedCents: deposited,
        feeCents: fee,
        reconciledAt: text(item.reconciledAt) ?? '',
        updatedAt: text(item.updatedAt) ?? '',
      }
    }
  }
  return [{
    id,
    recordRef,
    operationKey: text(row.operationKey),
    categoryName: text(row.categoryName),
    paidAt: text(row.paidAt),
    grossCents: int(row.grossCents),
    courtesyTag: row.courtesyTag === true,
    reconciliation,
  }]
}

export function parseLegacyReconcileList(data: unknown): LegacyReconcileRow[] {
  const body = data as { ok?: unknown; rows?: unknown } | null
  if (!body || body.ok !== true || !Array.isArray(body.rows)) {
    throw new Error('No se pudo leer el histórico legacy.')
  }
  return body.rows.flatMap(parseRow)
}

const ERROR_TEXT: Record<string, string> = {
  FORBIDDEN: 'Sin permiso para conciliar.',
  NO_BANK_AMOUNT: 'Este registro no tiene monto: no se concilia contra el banco.',
  NOT_LEGACY_PAID: 'Solo se concilian registros legacy pagados.',
  DEPOSIT_EXCEEDS_GROSS: 'El monto depositado no puede ser mayor al original.',
  REGISTRATION_NOT_FOUND: 'El registro ya no existe.',
}

export function createEdgeLegacyReconcilePort(): LegacyReconcilePort {
  return {
    async list() {
      let data: unknown
      try {
        data = await postProjectFunction(getInsforgeClient(), 'ops-legacy-reconcile', {
          view: 'list',
        })
      } catch {
        throw new Error('No se pudo leer el histórico legacy.')
      }
      return parseLegacyReconcileList(data)
    },
    async save(input) {
      let data: unknown
      try {
        data = await postProjectFunction(getInsforgeClient(), 'ops-legacy-reconcile', {
          view: 'upsert',
          ...input,
        })
      } catch (error) {
        throw new Error(
          error instanceof Error && error.message
            ? error.message
            : 'No se pudo guardar la conciliación.',
        )
      }
      const body = data as { ok?: unknown; error?: unknown } | null
      if (!body || body.ok !== true) {
        const code = typeof body?.error === 'string' ? body.error : ''
        throw new Error(ERROR_TEXT[code] ?? 'No se pudo guardar la conciliación.')
      }
    },
  }
}

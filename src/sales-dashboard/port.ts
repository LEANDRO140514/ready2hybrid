import { createContext, useContext, type ReactNode } from 'react'
import { createElement } from 'react'

import { getInsforgeClient } from '../lib/insforge/client'
import { postProjectFunction } from '../lib/insforge/project-function'
import type { FunnelEvent, LegacyRegistration } from './commercial'
import { ACTIVE_EVENT_CODE } from './commercial'
import type {
  FinanceAdjustment,
  SalesActivity,
  SalesLine,
  SalesOrder,
  SalesPayment,
  SalesRosterMember,
  SalesSnapshot,
  SalesTicket,
  SalesVerification,
  SalesWebhook,
  SaveAdjustmentInput,
} from './model'

export type CommercialPayload = {
  eventCode: string
  legacy: LegacyRegistration[]
  funnel: FunnelEvent[]
  summary?: {
    legacyPaid: number
    legacyPending: number
    legacyGrossCents: number
  } | null
}

export type SalesPort = {
  loadSnapshot: () => Promise<SalesSnapshot>
  loadCommercial?: (view?: 'rows' | 'aggregates') => Promise<CommercialPayload>
  saveAdjustment: (input: SaveAdjustmentInput) => Promise<void>
}

const SalesPortContext = createContext<SalesPort | null>(null)

export function SalesPortProvider({
  port,
  children,
}: {
  port: SalesPort
  children: ReactNode
}) {
  return createElement(SalesPortContext.Provider, { value: port }, children)
}

export function useSalesPort(): SalesPort {
  const port = useContext(SalesPortContext)
  if (!port) throw new Error('useSalesPort requires SalesPortProvider')
  return port
}

function expectObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`La lectura de ventas no trae ${field}.`)
  }
  return value as Record<string, unknown>
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`Campo de ventas inválido: ${field}.`)
  }
  return value
}

function nullableString(value: unknown): string | null {
  if (value == null) return null
  return typeof value === 'string' ? value : null
}

function expectInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Campo de ventas inválido: ${field}.`)
  }
  return value
}

function nullableBool(value: unknown): boolean | null {
  if (value == null) return null
  return typeof value === 'boolean' ? value : null
}

function parseLine(value: unknown): SalesLine {
  const row = expectObject(value, 'línea')
  return {
    productCode: expectString(row.productCode, 'productCode'),
    productName: expectString(row.productName, 'productName'),
    block: expectString(row.block, 'block'),
    kind: expectString(row.kind, 'kind'),
    saleState: nullableString(row.saleState),
    teamSize: expectInt(row.teamSize, 'teamSize'),
    quantity: expectInt(row.quantity, 'quantity'),
  }
}

function parsePayment(value: unknown): SalesPayment {
  const row = expectObject(value, 'pago')
  return {
    id: expectString(row.id, 'payment.id'),
    provider: expectString(row.provider, 'provider'),
    providerPaymentId:
      typeof row.providerPaymentId === 'string' ? row.providerPaymentId : '',
    normalizedState: expectString(row.normalizedState, 'normalizedState'),
    amountCents: row.amountCents == null ? null : expectInt(row.amountCents, 'amountCents'),
    providerUpdatedAt: nullableString(row.providerUpdatedAt),
    createdAt: nullableString(row.createdAt),
  }
}

function parseTicket(value: unknown): SalesTicket {
  const row = expectObject(value, 'boleto')
  return {
    id: expectString(row.id, 'ticket.id'),
    state: expectString(row.state, 'ticket.state'),
    issuedAt: nullableString(row.issuedAt),
    folio: nullableString(row.folio),
    emailState: nullableString(row.emailState),
    emailResult: nullableString(row.emailResult),
    emailUpdatedAt: nullableString(row.emailUpdatedAt),
  }
}

function parseRoster(value: unknown): SalesRosterMember {
  const row = expectObject(value, 'roster')
  return {
    name: nullableString(row.name),
    role: nullableString(row.role),
    position: row.position == null ? null : expectInt(row.position, 'position'),
  }
}

function parseActivity(value: unknown): SalesActivity {
  const row = expectObject(value, 'actividad')
  return {
    at: expectString(row.at, 'activity.at'),
    action: expectString(row.action, 'activity.action'),
    result: nullableString(row.result),
  }
}

function parseWebhook(value: unknown): SalesWebhook {
  const row = expectObject(value, 'webhook')
  return {
    receivedAt: nullableString(row.receivedAt),
    processedAt: nullableString(row.processedAt),
    signatureResult: nullableString(row.signatureResult),
    processingState: nullableString(row.processingState),
    result: nullableString(row.result),
  }
}

function parseVerification(value: unknown): SalesVerification {
  const row = expectObject(value, 'verificación')
  return {
    verifiedAt: nullableString(row.verifiedAt),
    merchantOk: nullableBool(row.merchantOk),
    referenceOk: nullableBool(row.referenceOk),
    amountOk: nullableBool(row.amountOk),
    currencyOk: nullableBool(row.currencyOk),
    normalizedResult: nullableString(row.normalizedResult),
  }
}

function mapList<T>(input: unknown, map: (item: unknown) => T): T[] {
  if (!Array.isArray(input)) return []
  return input.map(map)
}

function parseOrder(value: unknown): SalesOrder {
  const row = expectObject(value, 'orden')
  return {
    id: expectString(row.id, 'id'),
    trackingRef: expectString(row.trackingRef, 'trackingRef'),
    state: expectString(row.state, 'state'),
    currency: expectString(row.currency, 'currency'),
    totalCents: expectInt(row.totalCents, 'totalCents'),
    createdAt: expectString(row.createdAt, 'createdAt'),
    updatedAt: nullableString(row.updatedAt),
    expiresAt: nullableString(row.expiresAt),
    affiliateCode: nullableString(row.affiliateCode),
    affiliateName: nullableString(row.affiliateName),
    commercialStage: nullableString(row.commercialStage),
    buyerName: nullableString(row.buyerName),
    buyerEmail: nullableString(row.buyerEmail),
    buyerPhone: nullableString(row.buyerPhone),
    lines: mapList(row.lines, parseLine),
    payments: mapList(row.payments, parsePayment),
    tickets: mapList(row.tickets, parseTicket),
    roster: mapList(row.roster, parseRoster),
    activity: mapList(row.activity, parseActivity),
    webhooks: mapList(row.webhooks, parseWebhook),
    verifications: mapList(row.verifications, parseVerification),
    adjustment: row.adjustment == null ? null : parseAdjustment(row.adjustment),
  }
}

function parseAdjustment(value: unknown): FinanceAdjustment {
  const row = expectObject(value, 'ajuste')
  const source = expectString(row.source, 'source')
  if (source !== 'MANUAL' && source !== 'PROVIDER') {
    throw new Error('source de conciliación inválido.')
  }
  return {
    id: expectString(row.id, 'adjustment.id'),
    orderId: expectString(row.orderId, 'adjustment.orderId'),
    paymentId: expectString(row.paymentId, 'adjustment.paymentId'),
    provider: expectString(row.provider, 'adjustment.provider'),
    providerFeeCents: expectInt(row.providerFeeCents, 'providerFeeCents'),
    providerFeeTaxCents: expectInt(row.providerFeeTaxCents, 'providerFeeTaxCents'),
    otherCostsCents: expectInt(row.otherCostsCents, 'otherCostsCents'),
    notes: nullableString(row.notes),
    source,
    createdBy: expectString(row.createdBy, 'createdBy'),
    createdAt: expectString(row.createdAt, 'createdAt'),
    updatedBy: expectString(row.updatedBy, 'updatedBy'),
    updatedAt: expectString(row.updatedAt, 'updatedAt'),
    createdByLabel: nullableString(row.createdByLabel),
    updatedByLabel: nullableString(row.updatedByLabel),
  }
}

export function parseSalesSnapshot(value: unknown): SalesSnapshot {
  const row = expectObject(value, 'snapshot')
  if (!Array.isArray(row.orders)) {
    throw new Error('La lectura de ventas no trae órdenes.')
  }
  return {
    generatedAt: expectString(row.generatedAt, 'generatedAt'),
    orders: row.orders.map(parseOrder),
  }
}

export function parseCommercialPayload(value: unknown): CommercialPayload {
  const row = expectObject(value, 'commercial')
  const eventCode = typeof row.eventCode === 'string' && row.eventCode
    ? row.eventCode
    : ACTIVE_EVENT_CODE
  const legacy = Array.isArray(row.legacy) ? row.legacy.flatMap(parseLegacy) : []
  const funnel = Array.isArray(row.funnel) ? row.funnel.flatMap(parseFunnel) : []
  return { eventCode, legacy, funnel }
}

function parseLegacy(value: unknown): LegacyRegistration[] {
  if (!value || typeof value !== 'object') return []
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string') return []
  return [{
    id: row.id,
    eventCode: typeof row.eventCode === 'string' ? row.eventCode : ACTIVE_EVENT_CODE,
    originalStatus: typeof row.originalStatus === 'string' ? row.originalStatus : '',
    commercialStatus: row.commercialStatus === 'LEGACY_PAID' || row.commercialStatus === 'LEGACY_PENDING'
      ? row.commercialStatus
      : null,
    originalCreatedAt: nullableString(row.originalCreatedAt),
    originalUpdatedAt: nullableString(row.originalUpdatedAt),
    buyerContactId: nullableString(row.buyerContactId),
    name: nullableString(row.name),
    email: nullableString(row.email),
    phone: nullableString(row.phone),
    categoryCode: nullableString(row.categoryCode),
    categoryName: nullableString(row.categoryName),
    amountCents: row.amountCents == null ? null : expectInt(row.amountCents, 'amountCents'),
    currency: nullableString(row.currency),
    teamName: nullableString(row.teamName),
    participants: nullableString(row.participants),
    notes: nullableString(row.notes),
    hasPaymentId: row.hasPaymentId === true,
  }]
}

export function stripAggregateIdentity(rows: LegacyRegistration[]): LegacyRegistration[] {
  return rows.map((item) => ({
    ...item,
    name: null,
    email: null,
    phone: null,
    buyerContactId: null,
    teamName: null,
    participants: null,
    notes: null,
    hasPaymentId: false,
  }))
}

function parseFunnel(value: unknown): FunnelEvent[] {
  if (!value || typeof value !== 'object') return []
  const row = value as Record<string, unknown>
  if (typeof row.visitorId !== 'string' || typeof row.eventType !== 'string' || typeof row.occurredAt !== 'string') {
    return []
  }
  return [{
    eventCode: typeof row.eventCode === 'string' ? row.eventCode : ACTIVE_EVENT_CODE,
    visitorId: row.visitorId,
    eventType: row.eventType,
    occurredAt: row.occurredAt,
    orderId: nullableString(row.orderId),
  }]
}

export function createEdgeSalesPort(): SalesPort {
  return {
    async loadSnapshot() {
      let data: unknown
      try {
        data = await postProjectFunction(
          getInsforgeClient(),
          'ops-sales-read',
          { view: 'snapshot' },
        )
      } catch (error) {
        throw new Error(
          error instanceof Error && error.message
            ? error.message
            : 'No se pudo leer el control de ventas.',
        )
      }
      return parseSalesSnapshot(data)
    },
    async loadCommercial(view: 'rows' | 'aggregates' = 'aggregates') {
      try {
        const data = await postProjectFunction<unknown>(
          getInsforgeClient(),
          'ops-commercial-read',
          { view, eventCode: ACTIVE_EVENT_CODE },
        )
        const parsed = parseCommercialPayload(data)
        if (view === 'aggregates') {
          const row = expectObject(data, 'commercial')
          return {
            ...parsed,
            legacy: stripAggregateIdentity(parsed.legacy),
            summary: typeof row.legacyPaid === 'number'
              ? {
                legacyPaid: expectInt(row.legacyPaid, 'legacyPaid'),
                legacyPending: expectInt(row.legacyPending, 'legacyPending'),
                legacyGrossCents: expectInt(row.legacyGrossCents, 'legacyGrossCents'),
              }
              : null,
          }
        }
        return parsed
      } catch {
        return { eventCode: ACTIVE_EVENT_CODE, legacy: [], funnel: [] }
      }
    },
    async saveAdjustment(input) {
      let data: unknown
      try {
        data = await postProjectFunction(
          getInsforgeClient(),
          'ops-sales-read',
          { view: 'upsert-adjustment', ...input },
        )
      } catch (error) {
        throw new Error(
          error instanceof Error && error.message
            ? error.message
            : 'No se pudo guardar la conciliación.',
        )
      }
      const body = data as { ok?: unknown; error?: unknown } | null
      if (!body || body.ok !== true) {
        throw new Error(
          typeof body?.error === 'string'
            ? body.error
            : 'No se pudo guardar la conciliación.',
        )
      }
    },
  }
}

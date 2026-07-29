import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * IMPL-14A-3B — canonical PAYMENT_PENDING expiry transaction.
 *
 * The model below mirrors expire_payment_pending_aggregate_tx so the
 * decision table can be exercised without a database, and the SQL contract
 * suite at the bottom proves the migrations encode the same rules. Effective
 * aggregate/dry-run bodies live in 0013 (FIX-2 array_append); batch remains
 * defined only by 0012. Runtime proof against real rows belongs to a
 * separately authorized sandbox unit.
 *
 * Vocabularies are the real ones: order/hold/credential/payment states come
 * from ck_* constraints in 0002; registrations.state has no constraint, so the
 * provisional vocabulary is the one written by checkout_start_tx (0011) and
 * webhook_apply_payment_tx (0009).
 */
type OrderState =
  | 'CREATED'
  | 'PREFERENCE_PENDING'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REQUIRES_REVIEW'
  | 'REFUNDED'
  | 'CHARGED_BACK'

type HoldState = 'ACTIVE' | 'CONVERTED' | 'RELEASED' | 'EXPIRED' | 'CONFLICT'

type RegistrationState = 'STARTED' | 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMED' | 'CANCELLED'

type CredentialKind =
  | 'ORDER_HOLDER'
  | 'CAPTAIN'
  | 'INVITATION_EXCHANGE_CODE'
  | 'INVITED_MEMBER'
  | 'TICKET_ACCESS'

type CredentialState =
  | 'ISSUED'
  | 'DELIVERED'
  | 'OPENED'
  | 'CONSUMED'
  | 'ACTIVE'
  | 'ROTATED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'REPLACED'

type PaymentState =
  | 'UNKNOWN'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'CHARGED_BACK'

type Outcome = 'expired' | 'noop' | 'inconsistent' | 'skipped_locked' | 'order_not_found' | 'error'

const CREDENTIAL_ACTIVE_STATES: CredentialState[] = ['ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE']
const REGISTRATION_PROVISIONAL_STATES: RegistrationState[] = ['STARTED', 'PENDING_PAYMENT']

type Order = { id: string; state: OrderState; expires_at: string | null }
type Hold = { id: string; state: HoldState; expires_at: string | null; capacity_units: number }
type Registration = { id: string; state: RegistrationState }
type Credential = {
  id: string
  kind: CredentialKind
  state: CredentialState
  expires_at: string | null
}

type Aggregate = {
  order: Order | null
  holds: Hold[]
  registrations: Registration[]
  credentials: Credential[]
  payments: PaymentState[]
  tickets: number
  orderRowLocked?: boolean
}

type AuditRow = {
  named_action: string
  result: string
  failure_class: string | null
  reason: string
  findings: string[]
}

type OutboxRow = { communication_type: string; template: string }

type Writes = {
  orderStateAfter: OrderState | null
  ordersUpdated: number
  holdsExpired: number
  registrationsCancelled: number
  credentialsExpiredByKind: Record<string, number>
  activityLog: AuditRow[]
  outbox: OutboxRow[]
  paymentsWritten: number
  ticketsWritten: number
  teamsWritten: number
  physicalDeletes: number
}

type ExpiryResult = {
  outcome: Outcome
  reason: string | null
  findings: string[]
  expiryInstant: string
  writes: Writes
}

function noWrites(order: Order | null): Writes {
  return {
    orderStateAfter: order ? order.state : null,
    ordersUpdated: 0,
    holdsExpired: 0,
    registrationsCancelled: 0,
    credentialsExpiredByKind: {},
    activityLog: [],
    outbox: [],
    paymentsWritten: 0,
    ticketsWritten: 0,
    teamsWritten: 0,
    physicalDeletes: 0,
  }
}

function isExpiredAt(expires_at: string | null, instant: Date): boolean {
  // Closed frontier, as SPEC-040 R001/R003 state it. NULL is unknown expiry,
  // never expiry, so it can only ever produce noop or a finding.
  if (expires_at == null) return false
  return Date.parse(expires_at) <= instant.getTime()
}

/** Structural gate of SPEC-040-R012 / R023, in the order the SQL evaluates it. */
function structuralFindings(agg: Aggregate, instant: Date): string[] {
  const order = agg.order
  if (order == null) return []
  const findings: string[] = []

  const approved = agg.payments.filter((s) => s === 'APPROVED').length
  const terminal = agg.payments.filter((s) => s === 'REFUNDED' || s === 'CHARGED_BACK').length
  if (approved > 0) findings.push('APPROVED_PAYMENT_ORDER_NOT_PAID')
  if (terminal > 0) findings.push('PAYMENT_TERMINAL_MISMATCH')

  const activeHolds = agg.holds.filter((h) => h.state === 'ACTIVE')
  const convertedHolds = agg.holds.filter((h) => h.state === 'CONVERTED')
  if (agg.holds.length === 0) findings.push('HOLD_MISSING')
  else if (activeHolds.length === 0) findings.push('HOLD_NO_ACTIVE')
  else if (activeHolds.length > 1) findings.push('HOLD_MULTIPLE_ACTIVE')

  const soleHold = activeHolds.length === 1 ? activeHolds[0] : undefined
  if (soleHold && soleHold.expires_at == null) findings.push('HOLD_EXPIRY_UNKNOWN')
  else if (soleHold && !isExpiredAt(soleHold.expires_at, instant)) {
    findings.push('HOLD_NOT_TIME_EXPIRED')
  }

  if (convertedHolds.length > 0 || agg.tickets > 0) findings.push('PARTIAL_CONVERSION')

  const provisional = agg.registrations.filter((r) =>
    REGISTRATION_PROVISIONAL_STATES.includes(r.state),
  )
  if (agg.registrations.length === 0) findings.push('REGISTRATIONS_MISSING')
  else if (provisional.length !== agg.registrations.length) {
    findings.push('REGISTRATION_NON_PROVISIONAL')
  }

  const activeHolders = agg.credentials.filter(
    (c) => c.kind === 'ORDER_HOLDER' && CREDENTIAL_ACTIVE_STATES.includes(c.state),
  )
  if (activeHolders.length === 0) findings.push('ORDER_HOLDER_MISSING')
  else if (activeHolders.length > 1) findings.push('ORDER_HOLDER_MULTIPLE')

  if (soleHold && activeHolders.length === 1) {
    const holder = activeHolders[0]
    if (soleHold.expires_at !== order.expires_at || holder.expires_at !== order.expires_at) {
      findings.push('EXPIRES_AT_DIVERGENCE')
    }
  }

  return findings
}

/**
 * Mirrors expire_payment_pending_aggregate_tx. auditFails simulates the I009
 * coupling: if the mandatory audit cannot be persisted the whole transaction
 * is rolled back and nothing is considered completed.
 */
function expireAggregate(
  agg: Aggregate,
  expiryNow: Date,
  options: { auditFails?: boolean } = {},
): ExpiryResult {
  const instant = expiryNow.toISOString()
  const order = agg.order

  if (agg.orderRowLocked === true) {
    return {
      outcome: 'skipped_locked',
      reason: 'ORDER_ROW_LOCKED',
      findings: [],
      expiryInstant: instant,
      writes: noWrites(order),
    }
  }

  if (order == null) {
    return {
      outcome: 'order_not_found',
      reason: 'ORDER_NOT_FOUND',
      findings: [],
      expiryInstant: instant,
      writes: noWrites(null),
    }
  }

  if (order.state !== 'PAYMENT_PENDING') {
    return {
      outcome: 'noop',
      reason: 'ORDER_STATE_NOT_ELIGIBLE',
      findings: [],
      expiryInstant: instant,
      writes: noWrites(order),
    }
  }

  if (order.expires_at == null) {
    return {
      outcome: 'noop',
      reason: 'NOT_ELIGIBLE_EXPIRY_UNKNOWN',
      findings: [],
      expiryInstant: instant,
      writes: noWrites(order),
    }
  }

  if (!isExpiredAt(order.expires_at, expiryNow)) {
    return {
      outcome: 'noop',
      reason: 'NOT_ELIGIBLE_NOT_YET_EXPIRED',
      findings: [],
      expiryInstant: instant,
      writes: noWrites(order),
    }
  }

  const findings = structuralFindings(agg, expiryNow)

  if (findings.length > 0) {
    if (options.auditFails === true) {
      return {
        outcome: 'error',
        reason: 'AUDIT_NOT_PERSISTED',
        findings,
        expiryInstant: instant,
        writes: noWrites(order),
      }
    }
    const writes = noWrites(order)
    writes.orderStateAfter = 'REQUIRES_REVIEW'
    writes.ordersUpdated = 1
    writes.activityLog = [
      {
        named_action: 'ORDER_EXPIRY_INCONSISTENT',
        result: 'INCONSISTENT',
        failure_class: 'AGGREGATE_CONSISTENCY',
        reason: 'AGGREGATE_INCONSISTENT',
        findings,
      },
    ]
    writes.outbox = [
      { communication_type: 'INTERNAL_ALERT', template: 'ORDER_EXPIRY_INCONSISTENT' },
    ]
    return { outcome: 'inconsistent', reason: null, findings, expiryInstant: instant, writes }
  }

  if (options.auditFails === true) {
    return {
      outcome: 'error',
      reason: 'AUDIT_NOT_PERSISTED',
      findings: [],
      expiryInstant: instant,
      writes: noWrites(order),
    }
  }

  const writes = noWrites(order)
  writes.orderStateAfter = 'EXPIRED'
  writes.ordersUpdated = 1
  writes.holdsExpired = agg.holds.filter((h) => h.state === 'ACTIVE').length
  writes.registrationsCancelled = agg.registrations.filter((r) =>
    REGISTRATION_PROVISIONAL_STATES.includes(r.state),
  ).length
  for (const cred of agg.credentials) {
    if (cred.kind !== 'ORDER_HOLDER') continue
    if (!CREDENTIAL_ACTIVE_STATES.includes(cred.state)) continue
    writes.credentialsExpiredByKind[cred.kind] =
      (writes.credentialsExpiredByKind[cred.kind] ?? 0) + 1
  }
  writes.activityLog = [
    {
      named_action: 'ORDER_EXPIRY_APPLIED',
      result: 'EXPIRED',
      failure_class: null,
      reason: 'ORDER_EXPIRED',
      findings: [],
    },
  ]
  return { outcome: 'expired', reason: null, findings: [], expiryInstant: instant, writes }
}

/** Applies the effective transitions so a replay can be modelled. */
function applyResult(agg: Aggregate, result: ExpiryResult): Aggregate {
  if (result.outcome === 'expired' && agg.order != null) {
    return {
      ...agg,
      order: { ...agg.order, state: 'EXPIRED' },
      holds: agg.holds.map((h) => (h.state === 'ACTIVE' ? { ...h, state: 'EXPIRED' } : h)),
      registrations: agg.registrations.map((r) =>
        REGISTRATION_PROVISIONAL_STATES.includes(r.state) ? { ...r, state: 'CANCELLED' } : r,
      ),
      credentials: agg.credentials.map((c) =>
        c.kind === 'ORDER_HOLDER' && CREDENTIAL_ACTIVE_STATES.includes(c.state)
          ? { ...c, state: 'EXPIRED' }
          : c,
      ),
    }
  }
  if (result.outcome === 'inconsistent' && agg.order != null) {
    return { ...agg, order: { ...agg.order, state: 'REQUIRES_REVIEW' } }
  }
  return agg
}

/** Mirrors the batch candidate query: keyset order, cap, SKIP LOCKED. */
function selectBatchCandidates(
  orders: (Order & { locked?: boolean })[],
  runNow: Date,
  requested = 25,
): string[] {
  const limit = Math.min(Math.max(requested, 1), 50)
  return orders
    .filter((o) => o.state === 'PAYMENT_PENDING')
    .filter((o) => o.expires_at != null && isExpiredAt(o.expires_at, runNow))
    .filter((o) => o.locked !== true)
    .sort((a, b) => {
      const byExpiry = Date.parse(a.expires_at as string) - Date.parse(b.expires_at as string)
      return byExpiry !== 0 ? byExpiry : a.id.localeCompare(b.id)
    })
    .slice(0, limit)
    .map((o) => o.id)
}

/**
 * Mirrors the roster acceptance guard of team_roster_accept_tx (0007): an
 * expired order can never let an invitation become access.
 */
function canConsumeInvitation(
  order: Order,
  rosterState: string,
  credential: Credential,
  now: Date,
): { ok: boolean; error_code?: string } {
  if (
    ['REVOKED', 'EXPIRED', 'REPLACED', 'CONSUMED'].includes(credential.state) ||
    (credential.expires_at != null && Date.parse(credential.expires_at) < now.getTime())
  ) {
    return { ok: false, error_code: 'INVITATION_INACTIVE' }
  }
  if (order.state !== 'PAID') return { ok: false, error_code: 'PAYMENT_REQUIRED' }
  if (!['PAID_ROSTER_INCOMPLETE', 'PAID_ROSTER_COMPLETE'].includes(rosterState)) {
    return { ok: false, error_code: 'INVITATION_INACTIVE' }
  }
  return { ok: true }
}

const EXPIRES = '2026-07-28T12:00:00.000Z'
const EXPIRY_NOW = new Date('2026-07-28T12:05:00.000Z')

function orderHolder(overrides: Partial<Credential> = {}): Credential {
  return {
    id: 'cred-holder-1',
    kind: 'ORDER_HOLDER',
    state: 'ISSUED',
    expires_at: EXPIRES,
    ...overrides,
  }
}

function aggregate(overrides: Partial<Aggregate> = {}): Aggregate {
  return {
    order: { id: 'order-1', state: 'PAYMENT_PENDING', expires_at: EXPIRES },
    holds: [{ id: 'hold-1', state: 'ACTIVE', expires_at: EXPIRES, capacity_units: 1 }],
    registrations: [{ id: 'reg-1', state: 'STARTED' }],
    credentials: [orderHolder()],
    payments: [],
    tickets: 0,
    ...overrides,
  }
}

describe('IMPL-14A-3B aggregate expiry decision table (SPEC-040 R001-R009, R023-R024)', () => {
  it('expires a complete natural-expiry aggregate in one transaction (AC001, AC002)', () => {
    const result = expireAggregate(aggregate(), EXPIRY_NOW)
    expect(result.outcome).toBe('expired')
    expect(result.findings).toEqual([])
    expect(result.writes.orderStateAfter).toBe('EXPIRED')
    expect(result.writes.holdsExpired).toBe(1)
    expect(result.writes.registrationsCancelled).toBe(1)
    expect(result.writes.credentialsExpiredByKind).toEqual({ ORDER_HOLDER: 1 })
    expect(result.writes.activityLog).toHaveLength(1)
    expect(result.writes.activityLog[0].named_action).toBe('ORDER_EXPIRY_APPLIED')
    expect(result.writes.activityLog[0].result).toBe('EXPIRED')
    expect(result.writes.activityLog[0].reason).toBe('ORDER_EXPIRED')
    // R014: no buyer notification and no alert on the healthy path.
    expect(result.writes.outbox).toEqual([])
  })

  it('expires a spectator aggregate with quantity > 1 (one hold, many registrations)', () => {
    const agg = aggregate({
      holds: [{ id: 'hold-1', state: 'ACTIVE', expires_at: EXPIRES, capacity_units: 3 }],
      registrations: [
        { id: 'reg-1', state: 'STARTED' },
        { id: 'reg-2', state: 'STARTED' },
        { id: 'reg-3', state: 'STARTED' },
      ],
    })
    const result = expireAggregate(agg, EXPIRY_NOW)
    expect(result.outcome).toBe('expired')
    expect(result.writes.holdsExpired).toBe(1)
    expect(result.writes.registrationsCancelled).toBe(3)
  })

  it('expires an individual competitor aggregate in PENDING_PAYMENT registration state', () => {
    const result = expireAggregate(
      aggregate({ registrations: [{ id: 'reg-1', state: 'PENDING_PAYMENT' }] }),
      EXPIRY_NOW,
    )
    expect(result.outcome).toBe('expired')
    expect(result.writes.registrationsCancelled).toBe(1)
  })

  it('treats expires_at exactly equal to the canonical clock as expired (closed frontier)', () => {
    const instant = new Date(EXPIRES)
    const result = expireAggregate(aggregate(), instant)
    expect(result.outcome).toBe('expired')
  })

  it('is a noop one microsecond before the frontier', () => {
    const instant = new Date(Date.parse(EXPIRES) - 1)
    const result = expireAggregate(aggregate(), instant)
    expect(result.outcome).toBe('noop')
    expect(result.reason).toBe('NOT_ELIGIBLE_NOT_YET_EXPIRED')
    expect(result.writes.ordersUpdated).toBe(0)
  })

  it('is a noop for a PAYMENT_PENDING order with unknown (NULL) expiry — fail-closed', () => {
    const result = expireAggregate(
      aggregate({ order: { id: 'order-1', state: 'PAYMENT_PENDING', expires_at: null } }),
      EXPIRY_NOW,
    )
    expect(result.outcome).toBe('noop')
    expect(result.reason).toBe('NOT_ELIGIBLE_EXPIRY_UNKNOWN')
    expect(result.writes).toEqual(noWrites({ id: 'order-1', state: 'PAYMENT_PENDING', expires_at: null }))
  })

  it('leaves a PAID aggregate untouched (R024, AC020)', () => {
    const agg = aggregate({
      order: { id: 'order-1', state: 'PAID', expires_at: EXPIRES },
      holds: [{ id: 'hold-1', state: 'CONVERTED', expires_at: EXPIRES, capacity_units: 1 }],
      registrations: [{ id: 'reg-1', state: 'PAYMENT_CONFIRMED' }],
      credentials: [orderHolder({ state: 'CONSUMED' })],
      payments: ['APPROVED'],
      tickets: 1,
    })
    const result = expireAggregate(agg, EXPIRY_NOW)
    expect(result.outcome).toBe('noop')
    expect(result.reason).toBe('ORDER_STATE_NOT_ELIGIBLE')
    expect(result.writes.ordersUpdated).toBe(0)
    expect(result.writes.activityLog).toEqual([])
    expect(result.writes.outbox).toEqual([])
  })

  it.each<[OrderState]>([
    ['CREATED'],
    ['PREFERENCE_PENDING'],
    ['REJECTED'],
    ['CANCELLED'],
    ['EXPIRED'],
    ['REQUIRES_REVIEW'],
    ['REFUNDED'],
    ['CHARGED_BACK'],
  ])('is a zero-write noop for order state %s', (state) => {
    const result = expireAggregate(
      aggregate({ order: { id: 'order-1', state, expires_at: EXPIRES } }),
      EXPIRY_NOW,
    )
    expect(result.outcome).toBe('noop')
    expect(result.reason).toBe('ORDER_STATE_NOT_ELIGIBLE')
    expect(result.writes.ordersUpdated).toBe(0)
    expect(result.writes.outbox).toEqual([])
  })

  it('never collapses skipped_locked, order_not_found and noop', () => {
    const locked = expireAggregate(aggregate({ orderRowLocked: true }), EXPIRY_NOW)
    const missing = expireAggregate(aggregate({ order: null }), EXPIRY_NOW)
    const notEligible = expireAggregate(
      aggregate({ order: { id: 'order-1', state: 'PAID', expires_at: EXPIRES } }),
      EXPIRY_NOW,
    )
    expect([locked.outcome, missing.outcome, notEligible.outcome]).toEqual([
      'skipped_locked',
      'order_not_found',
      'noop',
    ])
    expect(new Set([locked.outcome, missing.outcome, notEligible.outcome]).size).toBe(3)
    expect(locked.writes.ordersUpdated).toBe(0)
    expect(missing.writes.ordersUpdated).toBe(0)
  })
})

describe('IMPL-14A-3B fail-closed inconsistency matrix (SPEC-040 R012, R023, AC016, AC026)', () => {
  const cases: [string, Partial<Aggregate>, string][] = [
    ['a verified APPROVED payment on a non-PAID order', { payments: ['APPROVED'] }, 'APPROVED_PAYMENT_ORDER_NOT_PAID'],
    ['a REFUNDED payment', { payments: ['REFUNDED'] }, 'PAYMENT_TERMINAL_MISMATCH'],
    ['a CHARGED_BACK payment', { payments: ['CHARGED_BACK'] }, 'PAYMENT_TERMINAL_MISMATCH'],
    ['no hold at all', { holds: [] }, 'HOLD_MISSING'],
    [
      'holds present but none ACTIVE',
      { holds: [{ id: 'hold-1', state: 'RELEASED', expires_at: EXPIRES, capacity_units: 1 }] },
      'HOLD_NO_ACTIVE',
    ],
    [
      'more than one ACTIVE hold',
      {
        holds: [
          { id: 'hold-1', state: 'ACTIVE', expires_at: EXPIRES, capacity_units: 1 },
          { id: 'hold-2', state: 'ACTIVE', expires_at: EXPIRES, capacity_units: 1 },
        ],
      },
      'HOLD_MULTIPLE_ACTIVE',
    ],
    [
      'an ACTIVE hold with unknown expiry',
      { holds: [{ id: 'hold-1', state: 'ACTIVE', expires_at: null, capacity_units: 1 }] },
      'HOLD_EXPIRY_UNKNOWN',
    ],
    [
      'an ACTIVE hold that has not lapsed yet',
      {
        holds: [
          {
            id: 'hold-1',
            state: 'ACTIVE',
            expires_at: '2026-07-28T23:00:00.000Z',
            capacity_units: 1,
          },
        ],
      },
      'HOLD_NOT_TIME_EXPIRED',
    ],
    [
      'a partially converted aggregate',
      {
        holds: [
          { id: 'hold-1', state: 'ACTIVE', expires_at: EXPIRES, capacity_units: 1 },
          { id: 'hold-2', state: 'CONVERTED', expires_at: EXPIRES, capacity_units: 1 },
        ],
      },
      'PARTIAL_CONVERSION',
    ],
    ['an already issued access artifact', { tickets: 1 }, 'PARTIAL_CONVERSION'],
    ['no registration', { registrations: [] }, 'REGISTRATIONS_MISSING'],
    [
      'a non-provisional registration on the expiry path',
      {
        registrations: [
          { id: 'reg-1', state: 'STARTED' },
          { id: 'reg-2', state: 'PAYMENT_CONFIRMED' },
        ],
      },
      'REGISTRATION_NON_PROVISIONAL',
    ],
    ['an absent ORDER_HOLDER', { credentials: [] }, 'ORDER_HOLDER_MISSING'],
    [
      'an ORDER_HOLDER already consumed (no active one left)',
      { credentials: [orderHolder({ state: 'CONSUMED' })] },
      'ORDER_HOLDER_MISSING',
    ],
    [
      'more than one active ORDER_HOLDER',
      {
        credentials: [
          orderHolder({ id: 'cred-holder-1' }),
          orderHolder({ id: 'cred-holder-2', state: 'DELIVERED' }),
        ],
      },
      'ORDER_HOLDER_MULTIPLE',
    ],
    [
      'a hold whose expires_at diverges from the order (I004)',
      {
        holds: [
          {
            id: 'hold-1',
            state: 'ACTIVE',
            expires_at: '2026-07-28T11:59:00.000Z',
            capacity_units: 1,
          },
        ],
      },
      'EXPIRES_AT_DIVERGENCE',
    ],
    [
      'an ORDER_HOLDER whose expires_at diverges from the order (I004)',
      { credentials: [orderHolder({ expires_at: '2026-07-28T11:00:00.000Z' })] },
      'EXPIRES_AT_DIVERGENCE',
    ],
  ]

  it.each(cases)('routes %s to review without mutating the components', (_label, patch, finding) => {
    const result = expireAggregate(aggregate(patch), EXPIRY_NOW)
    expect(result.outcome).toBe('inconsistent')
    expect(result.findings).toContain(finding)

    // D-2: only the order moves; every other component keeps its state.
    expect(result.writes.orderStateAfter).toBe('REQUIRES_REVIEW')
    expect(result.writes.holdsExpired).toBe(0)
    expect(result.writes.registrationsCancelled).toBe(0)
    expect(result.writes.credentialsExpiredByKind).toEqual({})
    expect(result.writes.paymentsWritten).toBe(0)
    expect(result.writes.ticketsWritten).toBe(0)
    expect(result.writes.teamsWritten).toBe(0)
    expect(result.writes.physicalDeletes).toBe(0)

    expect(result.writes.activityLog).toHaveLength(1)
    expect(result.writes.activityLog[0].named_action).toBe('ORDER_EXPIRY_INCONSISTENT')
    expect(result.writes.activityLog[0].failure_class).toBe('AGGREGATE_CONSISTENCY')
    expect(result.writes.activityLog[0].findings).toContain(finding)
    expect(result.writes.outbox).toEqual([
      { communication_type: 'INTERNAL_ALERT', template: 'ORDER_EXPIRY_INCONSISTENT' },
    ])
  })

  it('reports every divergence found instead of stopping at the first one', () => {
    const result = expireAggregate(
      aggregate({ holds: [], registrations: [], credentials: [], payments: ['APPROVED'] }),
      EXPIRY_NOW,
    )
    expect(result.outcome).toBe('inconsistent')
    expect(result.findings).toEqual([
      'APPROVED_PAYMENT_ORDER_NOT_PAID',
      'HOLD_MISSING',
      'REGISTRATIONS_MISSING',
      'ORDER_HOLDER_MISSING',
    ])
  })

  it('does not invent timestamps for a divergent aggregate (R012)', () => {
    const divergent = aggregate({
      holds: [
        { id: 'hold-1', state: 'ACTIVE', expires_at: '2026-07-28T11:00:00.000Z', capacity_units: 1 },
      ],
    })
    const before = structuredClone(divergent)
    const result = expireAggregate(divergent, EXPIRY_NOW)
    expect(result.outcome).toBe('inconsistent')
    expect(divergent.holds).toEqual(before.holds)
    expect(divergent.order?.expires_at).toBe(before.order?.expires_at)
  })
})

describe('IMPL-14A-3B idempotency and audit coupling (SPEC-040 R009, I009, AC005, AC024, AC027)', () => {
  it('is a noop on replay, with a single effective audit row and no second alert', () => {
    const agg = aggregate()
    const first = expireAggregate(agg, EXPIRY_NOW)
    const afterFirst = applyResult(agg, first)
    const second = expireAggregate(afterFirst, EXPIRY_NOW)

    expect(first.outcome).toBe('expired')
    expect(second.outcome).toBe('noop')
    expect(second.reason).toBe('ORDER_STATE_NOT_ELIGIBLE')
    expect(first.writes.activityLog).toHaveLength(1)
    expect(second.writes.activityLog).toHaveLength(0)
    expect(second.writes.outbox).toEqual([])
    expect(second.writes.holdsExpired).toBe(0)
  })

  it('is a noop on replay of an inconsistent aggregate, with one alert only', () => {
    const agg = aggregate({ holds: [] })
    const first = expireAggregate(agg, EXPIRY_NOW)
    const second = expireAggregate(applyResult(agg, first), EXPIRY_NOW)
    expect(first.outcome).toBe('inconsistent')
    expect(first.writes.outbox).toHaveLength(1)
    expect(second.outcome).toBe('noop')
    expect(second.writes.outbox).toHaveLength(0)
  })

  it('completes nothing when the mandatory audit cannot be persisted', () => {
    const result = expireAggregate(aggregate(), EXPIRY_NOW, { auditFails: true })
    expect(result.outcome).toBe('error')
    expect(result.writes.ordersUpdated).toBe(0)
    expect(result.writes.holdsExpired).toBe(0)
    expect(result.writes.registrationsCancelled).toBe(0)
    expect(result.writes.credentialsExpiredByKind).toEqual({})
    expect(result.writes.activityLog).toEqual([])
  })

  it('remains retryable after the audit failure is resolved', () => {
    const agg = aggregate()
    expect(expireAggregate(agg, EXPIRY_NOW, { auditFails: true }).outcome).toBe('error')
    expect(expireAggregate(agg, EXPIRY_NOW).outcome).toBe('expired')
  })
})

describe('IMPL-14A-3B non-emission and ORDER_HOLDER scoping (SPEC-040 I003, I006, R011)', () => {
  it('never expires credentials of another kind that also carry order_id', () => {
    const agg = aggregate({
      credentials: [
        orderHolder(),
        { id: 'cred-captain', kind: 'CAPTAIN', state: 'ISSUED', expires_at: EXPIRES },
        {
          id: 'cred-invite',
          kind: 'INVITATION_EXCHANGE_CODE',
          state: 'ISSUED',
          expires_at: '2026-08-05T12:00:00.000Z',
        },
        { id: 'cred-member', kind: 'INVITED_MEMBER', state: 'ISSUED', expires_at: EXPIRES },
        { id: 'cred-access', kind: 'TICKET_ACCESS', state: 'ACTIVE', expires_at: null },
      ],
      tickets: 0,
    })
    const result = expireAggregate(agg, EXPIRY_NOW)
    expect(result.outcome).toBe('expired')
    expect(result.writes.credentialsExpiredByKind).toEqual({ ORDER_HOLDER: 1 })
    expect(Object.keys(result.writes.credentialsExpiredByKind)).not.toContain('CAPTAIN')
    expect(Object.keys(result.writes.credentialsExpiredByKind)).not.toContain(
      'INVITATION_EXCHANGE_CODE',
    )
  })

  it('emits zero tickets, zero payment writes, zero refunds and zero deletes', () => {
    const result = expireAggregate(aggregate(), EXPIRY_NOW)
    expect(result.writes.ticketsWritten).toBe(0)
    expect(result.writes.paymentsWritten).toBe(0)
    expect(result.writes.physicalDeletes).toBe(0)
  })

  it('keeps teams and team_members outside the aggregate (D-4)', () => {
    const result = expireAggregate(aggregate(), EXPIRY_NOW)
    expect(result.writes.teamsWritten).toBe(0)
  })

  it('an EXPIRED order cannot let a live invitation become access (D-4)', () => {
    const invitation: Credential = {
      id: 'cred-invite',
      kind: 'INVITATION_EXCHANGE_CODE',
      state: 'ISSUED',
      expires_at: '2026-08-05T12:00:00.000Z',
    }
    const expired: Order = { id: 'order-1', state: 'EXPIRED', expires_at: EXPIRES }
    // Invitation TTL outlives the checkout hold, so the guard cannot rely on it.
    expect(Date.parse(invitation.expires_at as string)).toBeGreaterThan(EXPIRY_NOW.getTime())
    expect(canConsumeInvitation(expired, 'PAYMENT_PENDING', invitation, EXPIRY_NOW)).toEqual({
      ok: false,
      error_code: 'PAYMENT_REQUIRED',
    })
    expect(canConsumeInvitation(expired, 'PAID_ROSTER_INCOMPLETE', invitation, EXPIRY_NOW)).toEqual({
      ok: false,
      error_code: 'PAYMENT_REQUIRED',
    })
    // Same invitation on a paid roster is the only accepted combination.
    expect(
      canConsumeInvitation(
        { id: 'order-1', state: 'PAID', expires_at: EXPIRES },
        'PAID_ROSTER_INCOMPLETE',
        invitation,
        EXPIRY_NOW,
      ),
    ).toEqual({ ok: true })
  })
})

describe('IMPL-14A-3B batch selection (SPEC-040 R019, plan §11.4)', () => {
  const candidates: (Order & { locked?: boolean })[] = [
    { id: 'order-c', state: 'PAYMENT_PENDING', expires_at: '2026-07-28T11:00:00.000Z' },
    { id: 'order-a', state: 'PAYMENT_PENDING', expires_at: '2026-07-28T11:00:00.000Z' },
    { id: 'order-b', state: 'PAYMENT_PENDING', expires_at: '2026-07-28T10:00:00.000Z' },
    { id: 'order-future', state: 'PAYMENT_PENDING', expires_at: '2026-07-29T10:00:00.000Z' },
    { id: 'order-null', state: 'PAYMENT_PENDING', expires_at: null },
    { id: 'order-paid', state: 'PAID', expires_at: '2026-07-28T10:00:00.000Z' },
    { id: 'order-pref', state: 'PREFERENCE_PENDING', expires_at: '2026-07-28T10:00:00.000Z' },
  ]

  it('orders candidates deterministically by (expires_at, id)', () => {
    expect(selectBatchCandidates(candidates, EXPIRY_NOW)).toEqual([
      'order-b',
      'order-a',
      'order-c',
    ])
  })

  it('excludes non-PAYMENT_PENDING, unexpired and NULL-expiry orders', () => {
    const selected = selectBatchCandidates(candidates, EXPIRY_NOW)
    expect(selected).not.toContain('order-paid')
    expect(selected).not.toContain('order-pref')
    expect(selected).not.toContain('order-future')
    expect(selected).not.toContain('order-null')
  })

  it('skips rows locked by another worker instead of waiting for them', () => {
    const contended = candidates.map((o) => (o.id === 'order-b' ? { ...o, locked: true } : o))
    expect(selectBatchCandidates(contended, EXPIRY_NOW)).toEqual(['order-a', 'order-c'])
  })

  it('caps the batch at 50 items and defaults to 25', () => {
    const many: Order[] = Array.from({ length: 120 }, (_, i) => ({
      id: `order-${String(i).padStart(3, '0')}`,
      state: 'PAYMENT_PENDING',
      expires_at: '2026-07-28T10:00:00.000Z',
    }))
    expect(selectBatchCandidates(many, EXPIRY_NOW)).toHaveLength(25)
    expect(selectBatchCandidates(many, EXPIRY_NOW, 50)).toHaveLength(50)
    expect(selectBatchCandidates(many, EXPIRY_NOW, 500)).toHaveLength(50)
    expect(selectBatchCandidates(many, EXPIRY_NOW, 0)).toHaveLength(1)
  })

  it('produces one item outcome per candidate without cross-item contamination', () => {
    const perOrder: Record<string, Aggregate> = {
      'order-b': aggregate({ order: { id: 'order-b', state: 'PAYMENT_PENDING', expires_at: EXPIRES } }),
      'order-a': aggregate({
        order: { id: 'order-a', state: 'PAYMENT_PENDING', expires_at: EXPIRES },
        holds: [],
      }),
      'order-c': aggregate({ order: { id: 'order-c', state: 'PAID', expires_at: EXPIRES } }),
    }
    const outcomes = selectBatchCandidates(candidates, EXPIRY_NOW).map(
      (id) => expireAggregate(perOrder[id], EXPIRY_NOW).outcome,
    )
    expect(outcomes).toEqual(['expired', 'inconsistent', 'noop'])
  })
})

const migDir = resolve(process.cwd(), 'insforge/migrations')
const MIGRATION_0012 = '0012_payment-pending-expiry-transaction.sql'
const MIGRATION_0013 = '0013_payment-pending-expiry-array-fix.sql'
const AUTHORIZED_0012_SHA =
  'E27EDAD76387F5C73FCC393A1EA2C836E5BA09313C38E1E29B611E37DCF5BBE1'
const CANONICAL_MIGRATION_NAME = /^\d{4}_[a-z0-9]+(?:-[a-z0-9]+)*\.sql$/

/** Ambiguous PL/pgSQL scalar append onto a typed array variable. */
const AMBIGUOUS_ARRAY_SCALAR_APPEND =
  /\bv_(findings|hold_ids|hold_states|reg_ids|reg_states|holder_ids|holder_states)\s*:=\s*v_\1\s*\|\|/

function stripSqlComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

/** Isolates one function definition so assertions cannot pass on a sibling. */
function functionSql(source: string, name: string): string {
  const marker = `CREATE OR REPLACE FUNCTION public.${name}(p jsonb)`
  const start = source.indexOf(marker)
  if (start < 0) return ''
  const end = source.indexOf('\n$$;', start)
  return end < 0 ? source.slice(start) : source.slice(start, end)
}

/** Every statement that mentions a table, so per-statement rules can be checked. */
function statementsMentioning(source: string, table: string): string[] {
  return source
    .split(';')
    .filter((statement) => new RegExp(`\\bpublic\\.${table}\\b`).test(statement))
}

function sha256Upper(fileName: string): string {
  return createHash('sha256')
    .update(readFileSync(resolve(migDir, fileName)))
    .digest('hex')
    .toUpperCase()
}

// Normalized so the contract holds under core.autocrlf worktrees too.
const sql0012 = readFileSync(resolve(migDir, MIGRATION_0012), 'utf8').replace(/\r\n/g, '\n')
const sql0013 = readFileSync(resolve(migDir, MIGRATION_0013), 'utf8').replace(/\r\n/g, '\n')
const code0012 = stripSqlComments(sql0012)
const code0013 = stripSqlComments(sql0013)
// Historical bodies (0012) — still inspected for immutability / original scope.
const historicalAggregateSql = functionSql(code0012, 'expire_payment_pending_aggregate_tx')
const historicalDryRunSql = functionSql(code0012, 'expire_payment_pending_dry_run_tx')
const batchSql = functionSql(code0012, 'expire_payment_pending_batch_tx')
// Effective bodies (0013) — FIX-2 array_append contract.
const aggregateSql = functionSql(code0013, 'expire_payment_pending_aggregate_tx')
const dryRunSql = functionSql(code0013, 'expire_payment_pending_dry_run_tx')
// Combined surface used for “no tickets / no cron” style sweeps across both files.
const codeSql = `${code0012}\n${code0013}`

describe('0012 payment pending expiry SQL contract (historical)', () => {
  it('keeps the authorized SHA and runner-accepted name', () => {
    const names = readdirSync(migDir).filter((n) => n.endsWith('.sql')).sort()
    expect(names).toContain('0011_logical-capacity-expiry-exclusion.sql')
    expect(names).toContain(MIGRATION_0012)
    expect(MIGRATION_0012).toMatch(CANONICAL_MIGRATION_NAME)
    expect(sha256Upper(MIGRATION_0012)).toBe(AUTHORIZED_0012_SHA)
  })

  it('creates the three authorized RPCs and nothing else', () => {
    expect(historicalAggregateSql).not.toBe('')
    expect(batchSql).not.toBe('')
    expect(historicalDryRunSql).not.toBe('')
    expect(code0012.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(3)
    expect(code0012).not.toMatch(/CREATE\s+TABLE/i)
    expect(code0012).not.toMatch(/ALTER\s+TABLE/i)
    expect(code0012).not.toMatch(/DROP\s+/i)
    expect(code0012).not.toMatch(/CREATE\s+POLICY/i)
    expect(code0012).not.toMatch(/CREATE\s+TRIGGER/i)
    // D-5: TX-2 and the checkout TX are untouched by this migration.
    expect(code0012).not.toContain('webhook_apply_payment_tx')
    expect(code0012).not.toContain('checkout_start_tx')
  })

  it('adds only the authorized index and never touches the capacity holds index (D-3)', () => {
    expect(code0012).toContain(
      'CREATE INDEX IF NOT EXISTS idx_orders_state_expires_at_id\n  ON public.orders (state, expires_at, id);',
    )
    expect(code0012.match(/CREATE\s+INDEX/gi)).toHaveLength(1)
    expect(code0012).not.toContain('idx_capacity_holds_product_state_expires')
  })

  it('declares SECURITY DEFINER, a pinned search_path and admin-only execute (D-6)', () => {
    for (const body of [historicalAggregateSql, batchSql, historicalDryRunSql]) {
      expect(body).toContain('SECURITY DEFINER')
      expect(body).toContain('SET search_path = pg_catalog, public, pg_temp')
    }
    for (const fn of [
      'expire_payment_pending_aggregate_tx',
      'expire_payment_pending_batch_tx',
      'expire_payment_pending_dry_run_tx',
    ]) {
      expect(code0012).toContain(`REVOKE ALL ON FUNCTION public.${fn}(jsonb) FROM PUBLIC;`)
      expect(code0012).toContain(`REVOKE ALL ON FUNCTION public.${fn}(jsonb) FROM anon;`)
      expect(code0012).toContain(`REVOKE ALL ON FUNCTION public.${fn}(jsonb) FROM authenticated;`)
      expect(code0012).toContain(
        `GRANT EXECUTE ON FUNCTION public.${fn}(jsonb) TO project_admin;`,
      )
      expect(code0012).toContain(`COMMENT ON FUNCTION public.${fn}(jsonb) IS`)
    }
    expect(sql0012).toContain('project_admin is the current repository integration role;')
    expect(sql0012).toContain('this grant does not claim least privilege;')
    expect(sql0012).toContain('OD-040-002 remains OPEN;')
    expect(sql0012).toContain('IMPL-14A-3C and production remain blocked.')
  })

  it('historically used ambiguous text[] || scalar findings appends (B-ARRAY)', () => {
    expect(historicalAggregateSql).toContain("v_findings || 'APPROVED_PAYMENT_ORDER_NOT_PAID'")
    expect(historicalAggregateSql).toContain("v_findings || 'HOLD_MISSING'")
    expect(historicalDryRunSql).toContain("v_findings || 'HOLD_MISSING'")
  })
})

describe('0013 array-fix effective SQL contract', () => {
  it('is the next cumulative migration with a runner-accepted name', () => {
    const names = readdirSync(migDir).filter((n) => n.endsWith('.sql')).sort()
    expect(names).toContain(MIGRATION_0013)
    expect(MIGRATION_0013).toMatch(CANONICAL_MIGRATION_NAME)
    expect(names[names.length - 1]).toBe(MIGRATION_0013)
  })

  it('replaces only aggregate and dry-run; never batch; no foreign DDL', () => {
    expect(aggregateSql).not.toBe('')
    expect(dryRunSql).not.toBe('')
    expect(functionSql(code0013, 'expire_payment_pending_batch_tx')).toBe('')
    expect(code0013.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(2)
    expect(code0013).not.toMatch(/CREATE\s+TABLE/i)
    expect(code0013).not.toMatch(/ALTER\s+TABLE/i)
    expect(code0013).not.toMatch(/CREATE\s+INDEX/i)
    expect(code0013).not.toMatch(/DROP\s+/i)
    expect(code0013).not.toMatch(/CREATE\s+POLICY/i)
    expect(code0013).not.toMatch(/CREATE\s+TRIGGER/i)
    expect(code0013).not.toContain('webhook_apply_payment_tx')
    expect(code0013).not.toContain('checkout_start_tx')
  })

  it('reaffirms SECURITY DEFINER, search_path and admin-only execute for replaced RPCs', () => {
    for (const body of [aggregateSql, dryRunSql]) {
      expect(body).toContain('SECURITY DEFINER')
      expect(body).toContain('SET search_path = pg_catalog, public, pg_temp')
    }
    for (const fn of [
      'expire_payment_pending_aggregate_tx',
      'expire_payment_pending_dry_run_tx',
    ]) {
      expect(code0013).toContain(`REVOKE ALL ON FUNCTION public.${fn}(jsonb) FROM PUBLIC;`)
      expect(code0013).toContain(`REVOKE ALL ON FUNCTION public.${fn}(jsonb) FROM anon;`)
      expect(code0013).toContain(`REVOKE ALL ON FUNCTION public.${fn}(jsonb) FROM authenticated;`)
      expect(code0013).toContain(
        `GRANT EXECUTE ON FUNCTION public.${fn}(jsonb) TO project_admin;`,
      )
      expect(code0013).toContain(`COMMENT ON FUNCTION public.${fn}(jsonb) IS`)
    }
  })

  it('uses array_append for every scalar findings/list insertion; zero ambiguous ||', () => {
    expect(aggregateSql).toContain(
      "v_findings := array_append(v_findings, 'APPROVED_PAYMENT_ORDER_NOT_PAID')",
    )
    expect(aggregateSql).toContain("v_findings := array_append(v_findings, 'HOLD_MISSING')")
    expect(dryRunSql).toContain("v_findings := array_append(v_findings, 'HOLD_MISSING')")
    expect(aggregateSql).toContain('v_hold_ids := array_append(v_hold_ids, v_hold.id)')
    expect(aggregateSql).toContain('v_hold_states := array_append(v_hold_states, v_hold.state)')
    expect(aggregateSql).toContain('v_reg_ids := array_append(v_reg_ids, v_reg.id)')
    expect(aggregateSql).toContain('v_holder_ids := array_append(v_holder_ids, v_cred.id)')
    expect(aggregateSql.match(/array_append/g)?.length).toBeGreaterThanOrEqual(19)
    expect(dryRunSql.match(/array_append/g)?.length).toBeGreaterThanOrEqual(14)
    expect(aggregateSql).not.toMatch(AMBIGUOUS_ARRAY_SCALAR_APPEND)
    expect(dryRunSql).not.toMatch(AMBIGUOUS_ARRAY_SCALAR_APPEND)
    // Valid jsonb || jsonb concatenations remain allowed.
    expect(dryRunSql).toMatch(/v_candidates := v_candidates \|\| jsonb_build_array/)
    expect(dryRunSql).toMatch(/v_deferred := v_deferred \|\| jsonb_build_array/)
  })

  it('locks orders first, reads payments unlocked and never locks holds before orders', () => {
    const orderLock = aggregateSql.indexOf('FOR UPDATE NOWAIT')
    const paymentsRead = aggregateSql.indexOf('FROM public.payments')
    const holdLock = aggregateSql.indexOf('FROM public.capacity_holds')
    const regLock = aggregateSql.indexOf('FROM public.registrations\n')
    const credLock = aggregateSql.indexOf('FROM public.capability_credentials')

    expect(aggregateSql.slice(0, orderLock)).toContain('FROM public.orders')
    expect(orderLock).toBeGreaterThan(0)
    expect(orderLock).toBeLessThan(paymentsRead)
    expect(paymentsRead).toBeLessThan(holdLock)
    expect(holdLock).toBeLessThan(regLock)
    expect(regLock).toBeLessThan(credLock)

    const paymentStatements = statementsMentioning(aggregateSql, 'payments')
    expect(paymentStatements.length).toBeGreaterThan(0)
    for (const statement of paymentStatements) {
      expect(statement).not.toMatch(/FOR\s+UPDATE/i)
    }
  })

  it('never locks products, events, teams, team_members or tickets', () => {
    expect(statementsMentioning(aggregateSql, 'tickets').length).toBeGreaterThan(0)
    for (const table of ['products', 'events', 'teams', 'team_members', 'tickets']) {
      for (const statement of statementsMentioning(aggregateSql, table)) {
        expect(statement).not.toMatch(/FOR\s+UPDATE/i)
      }
    }
    expect(codeSql).not.toMatch(/\bpublic\.teams\b/)
    expect(codeSql).not.toMatch(/\bpublic\.team_members\b/)
    expect(codeSql).not.toContain('team_apply_payment_outcome')
  })

  it('captures post-lock clock_timestamp once in aggregate and batch; never now()', () => {
    expect(aggregateSql.match(/v_expiry_now := clock_timestamp\(\);/g)).toHaveLength(1)
    expect(aggregateSql.match(/clock_timestamp\(\)/g)).toHaveLength(1)
    expect(aggregateSql).not.toMatch(/statement_timestamp\(\)/)
    expect(aggregateSql).not.toMatch(/transaction_timestamp\(\)/)
    expect(aggregateSql).not.toMatch(/\bnow\(\)/)

    expect(batchSql.match(/v_run_now := clock_timestamp\(\);/g)).toHaveLength(1)
    expect(batchSql.match(/clock_timestamp\(\)/g)).toHaveLength(1)
    expect(batchSql).not.toMatch(/statement_timestamp\(\)/)
    expect(batchSql).not.toMatch(/transaction_timestamp\(\)/)
    expect(batchSql).not.toMatch(/\bnow\(\)/)
  })

  it('encodes the closed frontier and fail-closed NULL expiry', () => {
    expect(aggregateSql).toContain('IF v_order.expires_at IS NULL THEN')
    expect(aggregateSql).toContain("'NOT_ELIGIBLE_EXPIRY_UNKNOWN'")
    expect(aggregateSql).toContain('IF v_order.expires_at > v_expiry_now THEN')
    expect(batchSql).toContain('AND expires_at IS NOT NULL')
    expect(batchSql).toContain('AND expires_at <= v_run_now')
  })

  it('gates eligibility on PAYMENT_PENDING and canonical payment truth', () => {
    expect(aggregateSql).toContain("IF v_order.state <> 'PAYMENT_PENDING' THEN")
    expect(aggregateSql).toContain("count(*) FILTER (WHERE normalized_state = 'APPROVED')")
    expect(aggregateSql).toContain(
      "count(*) FILTER (WHERE normalized_state IN ('REFUNDED', 'CHARGED_BACK'))",
    )
    expect(aggregateSql).toContain(
      "array_append(v_findings, 'APPROVED_PAYMENT_ORDER_NOT_PAID')",
    )
    expect(aggregateSql).toContain("array_append(v_findings, 'PAYMENT_TERMINAL_MISMATCH')")
  })

  it('applies the effective transitions with compare-and-set on the source state', () => {
    expect(aggregateSql).toMatch(
      /UPDATE public\.orders\s+SET state = 'EXPIRED',\s+updated_at = v_expiry_now\s+WHERE id = v_order\.id\s+AND state = 'PAYMENT_PENDING';/,
    )
    expect(aggregateSql).toMatch(
      /UPDATE public\.capacity_holds\s+SET state = 'EXPIRED',\s+updated_at = v_expiry_now\s+WHERE id = v_active_hold_id\s+AND state = 'ACTIVE';/,
    )
    expect(aggregateSql).toMatch(
      /UPDATE public\.registrations\s+SET state = 'CANCELLED',\s+updated_at = v_expiry_now\s+WHERE order_id = v_order\.id\s+AND state IN \('STARTED', 'PENDING_PAYMENT'\);/,
    )
    expect(aggregateSql).not.toContain('expired_at')
    expect(aggregateSql).not.toMatch(/capacity_holds\s+SET[\s\S]*?released_at/)
    expect(aggregateSql).not.toMatch(/capacity_holds\s+SET[\s\S]*?reason =/)
    expect(aggregateSql).not.toContain('registration_snapshot')
    expect(aggregateSql).not.toContain('cancellation_reason')
  })

  it('scopes every capability credential write to ORDER_HOLDER', () => {
    const statements = [
      ...statementsMentioning(aggregateSql, 'capability_credentials'),
      ...statementsMentioning(batchSql, 'capability_credentials'),
      ...statementsMentioning(dryRunSql, 'capability_credentials'),
    ]
    expect(statements.length).toBeGreaterThan(0)
    for (const statement of statements) {
      expect(statement).toContain("kind = 'ORDER_HOLDER'")
    }
    expect(aggregateSql).toMatch(
      /UPDATE public\.capability_credentials\s+SET state = 'EXPIRED',\s+updated_at = v_expiry_now\s+WHERE order_id = v_order\.id\s+AND kind = 'ORDER_HOLDER'\s+AND state IN \('ISSUED', 'DELIVERED', 'OPENED', 'ACTIVE'\);/,
    )
    expect(codeSql).not.toContain("'CAPTAIN'")
    expect(codeSql).not.toContain("'INVITATION_EXCHANGE_CODE'")
    expect(codeSql).not.toContain("'INVITED_MEMBER'")
    expect(codeSql).not.toContain("'TICKET_ACCESS'")
  })

  it('writes the mandatory audit inside the same transaction (R015, I009)', () => {
    expect(aggregateSql.match(/INSERT INTO public\.activity_log/g)).toHaveLength(2)
    expect(aggregateSql).toContain("'ORDER_EXPIRY_APPLIED'")
    expect(aggregateSql).toContain("'ORDER_EXPIRY_INCONSISTENT'")
    expect(aggregateSql).toContain("'reason', 'ORDER_EXPIRED'")
    expect(aggregateSql).toContain("'expiry_instant', v_expiry_now")
    for (const column of [
      'actor_ref',
      'named_action',
      'entity_type',
      'entity_ref',
      'result',
      'failure_class',
      'correlation_id',
      'idempotency_fingerprint',
      'sanitized_metadata',
    ]) {
      expect(aggregateSql).toContain(column)
    }
    for (const forbidden of [
      'token_hash',
      'provider_payment_id',
      'sanitized_headers',
      'public_ref',
      'access_token',
    ]) {
      expect(codeSql).not.toContain(forbidden)
    }
  })

  it('raises exactly one INTERNAL_ALERT and only on the inconsistent path (D-2)', () => {
    expect(aggregateSql.match(/INSERT INTO public\.outbox_delivery_jobs/g)).toHaveLength(1)
    expect(aggregateSql).toContain("'INTERNAL_ALERT'")
    const inconsistentBranch = aggregateSql.slice(
      aggregateSql.indexOf("SET state = 'REQUIRES_REVIEW'"),
      aggregateSql.indexOf("'outcome', 'inconsistent'"),
    )
    expect(inconsistentBranch).toContain('INSERT INTO public.outbox_delivery_jobs')
    const effectiveBranch = aggregateSql.slice(aggregateSql.indexOf("SET state = 'EXPIRED',"))
    expect(effectiveBranch).not.toContain('INSERT INTO public.outbox_delivery_jobs')
  })

  it('writes no tickets, entitlements, payments or physical deletes', () => {
    expect(codeSql).not.toMatch(/INSERT\s+INTO\s+public\.tickets/i)
    expect(codeSql).not.toMatch(/UPDATE\s+public\.tickets/i)
    expect(codeSql).not.toMatch(/ticket_issue_/i)
    expect(codeSql).not.toMatch(/ticket_credential/i)
    expect(codeSql).not.toMatch(/access_entitlements/i)
    expect(codeSql).not.toMatch(/INSERT\s+INTO\s+public\.payments/i)
    expect(codeSql).not.toMatch(/UPDATE\s+public\.payments/i)
    expect(codeSql).not.toMatch(/\bDELETE\b/i)
    expect(codeSql).not.toMatch(/\bTRUNCATE\b/i)
    expect(codeSql).not.toMatch(/idempotency_records/i)
  })

  it('keeps schedule, cron and administrative recovery out of executable SQL', () => {
    // Comments may mention IMPL-14A-3C Edge Function / schedules as out-of-scope;
    // the executable bodies must not install any of those mechanisms.
    for (const body of [aggregateSql, batchSql, dryRunSql]) {
      expect(body.toLowerCase()).not.toContain('cron')
      expect(body.toLowerCase()).not.toMatch(/\bschedule\b/)
      expect(body).not.toMatch(/admin_recover/i)
      expect(body).not.toMatch(/refund_required|refund_pending/i)
      expect(body).not.toMatch(/pg_try_advisory_lock|pg_advisory/i)
      expect(body).not.toContain('webhook_apply_payment_tx')
    }
    expect(code0013).not.toMatch(/CREATE\s+TABLE/i)
    expect(code0013).not.toMatch(/CREATE\s+INDEX/i)
  })

  it('documents the batch transaction boundary and caps the sweep (0012 only)', () => {
    expect(batchSql).toContain('LEAST(GREATEST(COALESCE((p->>\'limit\')::integer, 25), 1), 50)')
    expect(batchSql).toContain('ORDER BY expires_at ASC, id ASC')
    expect(batchSql).toContain('FOR UPDATE SKIP LOCKED')
    expect(batchSql).toContain('EXCEPTION')
    expect(batchSql).toContain('SQLSTATE')
    expect(batchSql).not.toContain('SQLERRM')
    expect(sql0012).toContain('the whole RPC is still a single PostgreSQL transaction;')
    expect(sql0012).toContain('a crashed invocation rolls back the entire batch;')
    expect(sql0012).toContain('per-item commit belongs to the IMPL-14A-3C Edge Function.')
  })

  it('returns the five structured outcomes plus a distinct order_not_found', () => {
    for (const outcome of [
      "'outcome', 'expired'",
      "'outcome', 'noop'",
      "'outcome', 'inconsistent'",
      "'outcome', 'skipped_locked'",
      "'outcome', 'order_not_found'",
      "'outcome', 'error'",
    ]) {
      expect(aggregateSql).toContain(outcome)
    }
    for (const counter of [
      "'expired', v_expired",
      "'noop', v_noop",
      "'inconsistent', v_inconsistent",
      "'skipped_locked', v_skipped_locked",
      "'order_not_found', v_order_not_found",
      "'error', v_error",
    ]) {
      expect(batchSql).toContain(counter)
    }
  })

  it('enumerates identical fail-closed finding vocabulary in aggregate and dry-run', () => {
    for (const finding of [
      'APPROVED_PAYMENT_ORDER_NOT_PAID',
      'PAYMENT_TERMINAL_MISMATCH',
      'HOLD_MISSING',
      'HOLD_NO_ACTIVE',
      'HOLD_MULTIPLE_ACTIVE',
      'HOLD_EXPIRY_UNKNOWN',
      'HOLD_NOT_TIME_EXPIRED',
      'PARTIAL_CONVERSION',
      'REGISTRATIONS_MISSING',
      'REGISTRATION_NON_PROVISIONAL',
      'ORDER_HOLDER_MISSING',
      'ORDER_HOLDER_MULTIPLE',
      'EXPIRES_AT_DIVERGENCE',
    ]) {
      expect(aggregateSql).toContain(`'${finding}'`)
      expect(dryRunSql).toContain(`'${finding}'`)
    }
  })
})

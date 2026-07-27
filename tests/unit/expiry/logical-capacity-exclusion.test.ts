import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Mirrors SPEC-040-I007 / R004 inventory predicate in checkout_start_tx (0011):
 *   state = 'ACTIVE' AND (expires_at IS NULL OR expires_at > v_capacity_now)
 * capacityNow stands for v_capacity_now := clock_timestamp(), captured once after
 * the checkout locks — never transaction start time and never browser time.
 * NULL expiry is unknown, not expired: it keeps reserving cupo (fail-closed).
 */
type HoldState = 'ACTIVE' | 'EXPIRED' | 'RELEASED' | 'CONVERTED' | 'CONFLICT'

type CapacityHold = {
  product_id: string
  capacity_units: number
  state: HoldState
  expires_at: string | null
}

function holdCountsTowardReservedCapacity(
  hold: CapacityHold,
  capacityNow: Date,
): boolean {
  if (hold.state !== 'ACTIVE') return false
  if (hold.expires_at == null) return true
  return Date.parse(hold.expires_at) > capacityNow.getTime()
}

function reservedCapacityUnits(
  holds: CapacityHold[],
  productId: string,
  capacityNow: Date,
): number {
  return holds
    .filter((h) => h.product_id === productId)
    .filter((h) => holdCountsTowardReservedCapacity(h, capacityNow))
    .reduce((sum, h) => sum + h.capacity_units, 0)
}

function canReserveUnits(
  cupo: number,
  holds: CapacityHold[],
  productId: string,
  requestUnits: number,
  capacityNow: Date,
): boolean {
  const reserved = reservedCapacityUnits(holds, productId, capacityNow)
  return reserved + requestUnits <= cupo
}

const PRODUCT = 'product-a'
const NOW = new Date('2026-07-27T12:00:00.000Z')

function hold(
  partial: Partial<CapacityHold> & Pick<CapacityHold, 'capacity_units' | 'state'>,
): CapacityHold {
  return {
    product_id: PRODUCT,
    expires_at: '2026-07-27T13:00:00.000Z',
    ...partial,
  }
}

const migDir = resolve(process.cwd(), 'insforge/migrations')
const migPath = resolve(migDir, '0011_logical_capacity_expiry_exclusion.sql')

function stripSqlComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

/** Isolates the cupo SUM predicate so assertions cannot pass on unrelated SQL. */
function inventoryPredicateOf(source: string): string | undefined {
  return source.match(
    /SELECT COALESCE\(SUM\(capacity_units\), 0\)::integer INTO v_active_holds[\s\S]*?IF v_active_holds/,
  )?.[0]
}

const NULL_SAFE_PREDICATE =
  /\(\s*expires_at IS NULL\s+OR\s+expires_at\s*>\s*v_capacity_now\s*\)/i

const CAPACITY_CLOCK_CAPTURE = /v_capacity_now\s*:=\s*clock_timestamp\(\)\s*;/

const sql = readFileSync(migPath, 'utf8')
const codeSql = stripSqlComments(sql)

describe('logical capacity expiry exclusion (SPEC-040-I007 / R004 / AC003)', () => {
  it('counts an ACTIVE hold that is not yet expired', () => {
    const holds = [hold({ capacity_units: 2, state: 'ACTIVE', expires_at: '2026-07-27T12:00:01.000Z' })]
    expect(reservedCapacityUnits(holds, PRODUCT, NOW)).toBe(2)
    expect(canReserveUnits(5, holds, PRODUCT, 1, NOW)).toBe(true)
  })

  it('does not count an ACTIVE hold with expires_at equal to the capacity clock', () => {
    const holds = [hold({ capacity_units: 3, state: 'ACTIVE', expires_at: NOW.toISOString() })]
    expect(holdCountsTowardReservedCapacity(holds[0], NOW)).toBe(false)
    expect(reservedCapacityUnits(holds, PRODUCT, NOW)).toBe(0)
  })

  it('does not count an ACTIVE hold that is already past expires_at', () => {
    const holds = [hold({ capacity_units: 4, state: 'ACTIVE', expires_at: '2026-07-27T11:59:59.000Z' })]
    expect(reservedCapacityUnits(holds, PRODUCT, NOW)).toBe(0)
    expect(canReserveUnits(4, holds, PRODUCT, 4, NOW)).toBe(true)
  })

  it('counts an ACTIVE hold with unknown (NULL) expiry — unknown is not expired', () => {
    const holds = [hold({ capacity_units: 4, state: 'ACTIVE', expires_at: null })]
    expect(holdCountsTowardReservedCapacity(holds[0], NOW)).toBe(true)
    expect(reservedCapacityUnits(holds, PRODUCT, NOW)).toBe(4)
  })

  it('an ACTIVE hold with NULL expiry can still produce SOLD_OUT', () => {
    const cupo = 4
    const holds = [hold({ capacity_units: 4, state: 'ACTIVE', expires_at: null })]
    expect(canReserveUnits(cupo, holds, PRODUCT, 1, NOW)).toBe(false)
  })

  it('mixes NULL-expiry and time-expired ACTIVE holds without breaching cupo', () => {
    const cupo = 10
    const holds = [
      hold({ capacity_units: 6, state: 'ACTIVE', expires_at: null }),
      hold({ capacity_units: 5, state: 'ACTIVE', expires_at: '2026-07-27T11:00:00.000Z' }),
      hold({ capacity_units: 2, state: 'ACTIVE', expires_at: '2026-07-27T13:00:00.000Z' }),
    ]
    const reserved = reservedCapacityUnits(holds, PRODUCT, NOW)
    expect(reserved).toBe(8)
    expect(reserved).toBeLessThanOrEqual(cupo)
    expect(canReserveUnits(cupo, holds, PRODUCT, 2, NOW)).toBe(true)
    expect(canReserveUnits(cupo, holds, PRODUCT, 3, NOW)).toBe(false)
  })

  it('does not count EXPIRED holds', () => {
    const holds = [hold({ capacity_units: 5, state: 'EXPIRED', expires_at: '2026-07-27T11:00:00.000Z' })]
    expect(reservedCapacityUnits(holds, PRODUCT, NOW)).toBe(0)
  })

  it('does not count CONVERTED holds (paid conversion remains non-ACTIVE)', () => {
    const holds = [hold({ capacity_units: 2, state: 'CONVERTED', expires_at: '2026-07-27T13:00:00.000Z' })]
    expect(reservedCapacityUnits(holds, PRODUCT, NOW)).toBe(0)
  })

  it('recovered availability never exceeds configured cupo', () => {
    const cupo = 10
    const holds = [
      hold({ capacity_units: 6, state: 'ACTIVE', expires_at: '2026-07-27T11:00:00.000Z' }),
      hold({ capacity_units: 3, state: 'ACTIVE', expires_at: '2026-07-27T13:00:00.000Z' }),
    ]
    const reserved = reservedCapacityUnits(holds, PRODUCT, NOW)
    expect(reserved).toBe(3)
    expect(reserved).toBeLessThanOrEqual(cupo)
    expect(canReserveUnits(cupo, holds, PRODUCT, 7, NOW)).toBe(true)
    expect(canReserveUnits(cupo, holds, PRODUCT, 8, NOW)).toBe(false)
  })

  it('concurrent reservation math cannot exceed cupo when unexpired ACTIVE holds remain', () => {
    const cupo = 5
    const existing = [hold({ capacity_units: 4, state: 'ACTIVE', expires_at: '2026-07-27T13:00:00.000Z' })]
    // Two concurrent requests of 1 unit: only one can succeed under sequential apply of the same rule.
    const firstOk = canReserveUnits(cupo, existing, PRODUCT, 1, NOW)
    expect(firstOk).toBe(true)
    const afterFirst = [
      ...existing,
      hold({ capacity_units: 1, state: 'ACTIVE', expires_at: '2026-07-27T13:00:00.000Z' }),
    ]
    const secondOk = canReserveUnits(cupo, afterFirst, PRODUCT, 1, NOW)
    expect(secondOk).toBe(false)
  })

  it('expired ACTIVE hold frees cupo so a concurrent new reservation can succeed', () => {
    const cupo = 5
    const existing = [hold({ capacity_units: 5, state: 'ACTIVE', expires_at: '2026-07-27T11:00:00.000Z' })]
    expect(canReserveUnits(cupo, existing, PRODUCT, 5, NOW)).toBe(true)
  })

  it('judges a hold that expires during the lock wait by the post-lock clock', () => {
    // Transaction start (now()) precedes the lock wait; the hold lapses while
    // this checkout is blocked, so only the post-lock clock frees the cupo.
    const transactionStart = new Date('2026-07-27T12:00:00.000Z')
    const capacityNow = new Date('2026-07-27T12:01:00.000Z')
    const holds = [hold({ capacity_units: 1, state: 'ACTIVE', expires_at: '2026-07-27T12:00:30.000Z' })]

    expect(reservedCapacityUnits(holds, PRODUCT, transactionStart)).toBe(1)
    expect(reservedCapacityUnits(holds, PRODUCT, capacityNow)).toBe(0)
    expect(canReserveUnits(1, holds, PRODUCT, 1, capacityNow)).toBe(true)
  })

  it('applies one single capacity clock instant to every row of the same calculation', () => {
    const capacityNow = new Date('2026-07-27T12:00:00.000Z')
    const holds = [
      hold({ capacity_units: 1, state: 'ACTIVE', expires_at: '2026-07-27T11:59:59.999Z' }),
      hold({ capacity_units: 1, state: 'ACTIVE', expires_at: capacityNow.toISOString() }),
      hold({ capacity_units: 1, state: 'ACTIVE', expires_at: '2026-07-27T12:00:00.001Z' }),
    ]
    // Same instant for all rows: only the strictly-future hold survives.
    expect(reservedCapacityUnits(holds, PRODUCT, capacityNow)).toBe(1)
  })

  it('does not mutate hold rows — predicate is read-only arithmetic', () => {
    const original = hold({ capacity_units: 2, state: 'ACTIVE', expires_at: '2026-07-27T11:00:00.000Z' })
    const snapshot = structuredClone(original)
    void reservedCapacityUnits([original], PRODUCT, NOW)
    expect(original).toEqual(snapshot)
  })
})

describe('0011 logical capacity expiry exclusion SQL contract', () => {
  it('is the next migration after 0010 and does not recreate the capacity index', () => {
    const names = readdirSync(migDir).filter((n) => /^\d{4}_.+\.sql$/.test(n)).sort()
    expect(names).toContain('0010_spectator-multi-quantity.sql')
    expect(names).toContain('0011_logical_capacity_expiry_exclusion.sql')
    expect(existsSync(migPath)).toBe(true)
    expect(codeSql).not.toMatch(/CREATE\s+INDEX/i)
  })

  it('replaces only checkout_start_tx with SECURITY DEFINER and admin execute', () => {
    expect(codeSql).toContain('CREATE OR REPLACE FUNCTION public.checkout_start_tx(p jsonb)')
    expect(codeSql).toContain('SECURITY DEFINER')
    expect(codeSql).toContain('SET search_path = pg_catalog, public, pg_temp')
    expect(codeSql).toContain('GRANT EXECUTE ON FUNCTION public.checkout_start_tx(jsonb) TO project_admin')
    expect(codeSql).not.toMatch(/CREATE\s+TABLE/i)
    expect(codeSql).not.toMatch(/ALTER\s+TABLE/i)
    expect(codeSql).not.toMatch(/CREATE\s+POLICY/i)
    expect(codeSql).not.toMatch(/DROP\s+TABLE/i)
    expect(codeSql).not.toMatch(/UPDATE\s+public\.capacity_holds/i)
    expect(codeSql.match(/UPDATE\s+public\.orders/gi)).toHaveLength(1)
    expect(codeSql).toMatch(
      /UPDATE\s+public\.orders\s+SET\s+external_reference\s*=\s*v_order_id::text/i,
    )
  })

  it('encodes the null-safe ACTIVE inventory predicate against the canonical clock', () => {
    const inventoryBlock = inventoryPredicateOf(codeSql)
    expect(inventoryBlock).toBeTruthy()
    expect(inventoryBlock).toContain("state = 'ACTIVE'")
    expect(inventoryBlock).toMatch(NULL_SAFE_PREDICATE)
    // Transaction-start time would be stale after the lock wait.
    expect(inventoryBlock).not.toMatch(/now\(\)/)
    expect(inventoryBlock).not.toMatch(/statement_timestamp\(\)/)
    // Per-row clock drift: clock_timestamp() must not be inlined in the WHERE.
    expect(inventoryBlock).not.toMatch(/clock_timestamp\(\)/)
    // Unknown expiry keeps reserving cupo; only elapsed expiry frees it.
    expect(inventoryBlock).not.toMatch(/expires_at\s*<=/)
    // The pre-0011 predicate counted every ACTIVE hold with no temporal filter.
    expect(inventoryBlock).not.toMatch(/state = 'ACTIVE';/)
  })

  it('declares v_capacity_now and captures clock_timestamp() exactly once', () => {
    expect(codeSql).toMatch(/^\s*v_capacity_now timestamptz;\s*$/m)
    expect(codeSql.match(CAPACITY_CLOCK_CAPTURE)).toHaveLength(1)
    expect(codeSql.match(/clock_timestamp\(\)/g)).toHaveLength(1)
    expect(codeSql.match(/v_capacity_now/g)).toHaveLength(3)
  })

  it('captures the canonical clock after the locks and before the capacity SUM', () => {
    const productLock = codeSql.indexOf('SELECT * INTO v_product')
    const eventLock = codeSql.indexOf('SELECT * INTO v_event')
    const clockCapture = codeSql.search(CAPACITY_CLOCK_CAPTURE)
    const inventorySum = codeSql.indexOf(
      'SELECT COALESCE(SUM(capacity_units), 0)::integer INTO v_active_holds',
    )

    expect(productLock).toBeGreaterThanOrEqual(0)
    expect(clockCapture).toBeGreaterThan(productLock)
    // events is the second approved lock; serialization must finish first.
    expect(codeSql.slice(eventLock, clockCapture)).toContain('FOR UPDATE')
    expect(clockCapture).toBeGreaterThan(eventLock)
    expect(clockCapture).toBeLessThan(inventorySum)
  })

  it('keeps the canonical checkout_start_tx definition null-safe across migrations', () => {
    const definitions = readdirSync(migDir)
      .filter((n) => /^\d{4}_.+\.sql$/.test(n))
      .sort()
      .filter((n) =>
        readFileSync(resolve(migDir, n), 'utf8').includes(
          'CREATE OR REPLACE FUNCTION public.checkout_start_tx(p jsonb)',
        ),
      )
    expect(definitions.length).toBeGreaterThan(0)

    const canonical = definitions[definitions.length - 1]
    expect(canonical).toBe('0011_logical_capacity_expiry_exclusion.sql')

    const canonicalCode = stripSqlComments(
      readFileSync(resolve(migDir, canonical), 'utf8'),
    )
    expect(inventoryPredicateOf(canonicalCode)).toMatch(NULL_SAFE_PREDICATE)
    expect(canonicalCode).toMatch(CAPACITY_CLOCK_CAPTURE)
  })

  it('serializes checkout capacity decisions on the product row before summing and inserting', () => {
    const productLock = codeSql.indexOf('SELECT * INTO v_product')
    const inventorySum = codeSql.indexOf(
      'SELECT COALESCE(SUM(capacity_units), 0)::integer INTO v_active_holds',
    )
    const soldOutGuard = codeSql.indexOf(
      'IF v_active_holds + v_units > v_product.cupo THEN',
    )
    const holdInsert = codeSql.indexOf('INSERT INTO public.capacity_holds')

    expect(codeSql.slice(productLock, inventorySum)).toContain('FOR UPDATE')
    expect(productLock).toBeGreaterThanOrEqual(0)
    expect(productLock).toBeLessThan(inventorySum)
    expect(inventorySum).toBeLessThan(soldOutGuard)
    expect(soldOutGuard).toBeLessThan(holdInsert)
  })

  it('does not introduce expiry persistence, schedule, or admin recovery', () => {
    expect(codeSql).not.toMatch(/expire_payment_pending/i)
    expect(codeSql).not.toMatch(/admin_recover/i)
    expect(sql.toLowerCase()).not.toContain('cron')
    expect(sql.toLowerCase()).not.toContain('schedule')
    expect(codeSql).not.toMatch(/SET\s+state\s*=\s*'EXPIRED'/i)
  })

  it('preserves OD-001 spectator multi-quantity behavior from 0010', () => {
    expect(sql).toContain("v_product.kind = 'spectator'")
    expect(sql).toContain('v_units := v_qty')
    expect(sql).toContain('FOR v_i IN 1..v_qty LOOP')
  })
})

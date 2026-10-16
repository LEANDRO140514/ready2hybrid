import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConciliationPage } from '../../../src/components/finance/ConciliationPage'
import { roleAllowsPath, routeRequiresAssignment } from '../../../src/auth/roles'
import {
  isBankReconcilable,
  needsTagReview,
  parsePesosToCents,
  type LegacyReconcileRow,
} from '../../../src/sales-dashboard/legacy-reconciliation'
import {
  parseLegacyReconcileList,
  type LegacyReconcilePort,
} from '../../../src/sales-dashboard/legacy-reconcile-port'
import {
  classifyLegacyReconcileRequest,
  hasCourtesyTag,
  legacyRowReconcilable,
  parseLegacyReconcileInput,
  roleMayReconcileLegacy,
} from '../../../insforge/functions/_shared/legacy-reconcile/input'

const ID = '0b8f3f3e-6f0a-4a39-8a55-3a6a1f6f2a01'

function row(partial: Partial<LegacyReconcileRow>): LegacyReconcileRow {
  return {
    id: ID,
    recordRef: '11111111-2222-3333-4444-555555555555',
    operationKey: '123456789',
    categoryName: 'Individual',
    paidAt: null,
    grossCents: 100000,
    courtesyTag: false,
    reconciliation: null,
    ...partial,
  }
}

describe('legacy reconciliation rules', () => {
  it('hides amount 0 or null, keeps money rows', () => {
    expect(isBankReconcilable({ grossCents: 0 })).toBe(false)
    expect(isBankReconcilable({ grossCents: null })).toBe(false)
    expect(isBankReconcilable({ grossCents: 100 })).toBe(true)
  })

  it('warns only when the tag comes with money', () => {
    expect(needsTagReview({ grossCents: 100, courtesyTag: true })).toBe(true)
    expect(needsTagReview({ grossCents: 0, courtesyTag: true })).toBe(false)
    expect(needsTagReview({ grossCents: 100, courtesyTag: false })).toBe(false)
  })

  it('blank is invalid and an explicit 0 is a captured zero', () => {
    expect(parsePesosToCents('')).toBeNull()
    expect(parsePesosToCents(' ')).toBeNull()
    expect(parsePesosToCents('abc')).toBeNull()
    expect(parsePesosToCents('-5')).toBeNull()
    expect(parsePesosToCents('0')).toBe(0)
    expect(parsePesosToCents('1,000')).toBeNull()
    expect(parsePesosToCents('970.5')).toBe(97050)
  })

  it('parses the list and drops malformed rows', () => {
    const rows = parseLegacyReconcileList({
      ok: true,
      rows: [row({}), { nope: true }, row({ id: 'b', reconciliation: null })],
    })
    expect(rows.map((item) => item.id)).toEqual([ID, 'b'])
    expect(() => parseLegacyReconcileList({ ok: false })).toThrow()
  })
})

describe('legacy reconcile edge input', () => {
  it('only list and upsert views are allowed', () => {
    expect(classifyLegacyReconcileRequest('list').ok).toBe(true)
    expect(classifyLegacyReconcileRequest('upsert').ok).toBe(true)
    expect(classifyLegacyReconcileRequest('snapshot').ok).toBe(false)
    expect(classifyLegacyReconcileRequest(undefined).ok).toBe(false)
  })

  it('only OWNER and FINANCE may reconcile', () => {
    expect(roleMayReconcileLegacy('OWNER')).toBe(true)
    expect(roleMayReconcileLegacy('FINANCE')).toBe(true)
    expect(roleMayReconcileLegacy('CHECKIN_STAFF')).toBe(false)
    expect(roleMayReconcileLegacy(null)).toBe(false)
  })

  it('validates the upsert body', () => {
    const ok = parseLegacyReconcileInput({
      legacyRegistrationId: ID,
      provider: 'CLIP',
      depositedCents: 0,
    })
    expect(ok).toMatchObject({ ok: true, input: { depositedCents: 0, bankReference: null } })
    for (const body of [
      null,
      { legacyRegistrationId: 'x', provider: 'CLIP', depositedCents: 1 },
      { legacyRegistrationId: ID, provider: 'STRIPE', depositedCents: 1 },
      { legacyRegistrationId: ID, provider: 'CLIP', depositedCents: -1 },
      { legacyRegistrationId: ID, provider: 'CLIP', depositedCents: 1.5 },
      { legacyRegistrationId: ID, provider: 'CLIP' },
    ]) {
      expect(parseLegacyReconcileInput(body).ok).toBe(false)
    }
  })

  it('mirrors the SQL guard for courtesy and unpaid rows', () => {
    expect(legacyRowReconcilable({ commercialStatus: 'LEGACY_PAID', amountCents: 5000 })).toEqual({
      ok: true,
      grossCents: 5000,
    })
    expect(legacyRowReconcilable({ commercialStatus: 'LEGACY_PAID', amountCents: 0 })).toMatchObject({
      ok: false,
      code: 'NO_BANK_AMOUNT',
    })
    expect(legacyRowReconcilable({ commercialStatus: 'LEGACY_PENDING', amountCents: 5000 })).toMatchObject({
      ok: false,
      code: 'NOT_LEGACY_PAID',
    })
  })

  it('detects the courtesy/staff tag without matching inside other words', () => {
    expect(hasCourtesyTag('Cortesía patrocinador')).toBe(true)
    expect(hasCourtesyTag('cortesia')).toBe(true)
    expect(hasCourtesyTag('STAFF')).toBe(true)
    expect(hasCourtesyTag('pagó en efectivo')).toBe(false)
    expect(hasCourtesyTag(null)).toBe(false)
  })
})

describe('legacy reconciliation storage', () => {
  it('writes only legacy_reconciliations and does not touch orders, payments, or finance adjustments', () => {
    const sql = readFileSync(resolve('insforge/migrations/0040_legacy-reconciliations.sql'), 'utf8')
    const fn = readFileSync(resolve('insforge/functions/ops-legacy-reconcile/index.ts'), 'utf8')
    expect(sql).toContain('CREATE TABLE public.legacy_reconciliations')
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.(orders|payments|tickets|payment_finance_adjustments)\b/i)
    expect(fn).toContain(".from('legacy_reconciliations')")
    expect(fn).not.toContain(".from('orders')")
    expect(fn).not.toContain(".from('payments')")
    expect(fn).not.toContain(".from('payment_finance_adjustments')")
  })
})

describe('route policy', () => {
  it('conciliation is OWNER and FINANCE only and needs no shift', () => {
    const path = '/ops/finance/conciliation'
    expect(roleAllowsPath('OWNER', path)).toBe(true)
    expect(roleAllowsPath('FINANCE', path)).toBe(true)
    expect(roleAllowsPath('CHECKIN_STAFF', path)).toBe(false)
    expect(roleAllowsPath('OPERATIONS_MANAGER', path)).toBe(false)
    expect(roleAllowsPath(null, path)).toBe(false)
    expect(routeRequiresAssignment(path)).toBe(false)
  })
})

describe('ConciliationPage', () => {
  function portWith(rows: LegacyReconcileRow[]): LegacyReconcilePort & {
    save: ReturnType<typeof vi.fn>
  } {
    return {
      list: vi.fn(async () => rows),
      save: vi.fn(async () => {}),
    }
  }

  it('does not list amount 0 rows and flags a tagged row that has money', async () => {
    const port = portWith([
      row({ id: 'paid', operationKey: 'MP-1' }),
      row({ id: 'zero', operationKey: 'MP-ZERO', grossCents: 0, courtesyTag: true }),
      row({ id: 'tagged', operationKey: 'MP-TAG', courtesyTag: true }),
    ])
    render(<ConciliationPage port={port} />)
    await screen.findByTestId('legacy-table')
    expect(screen.getAllByTestId('legacy-row')).toHaveLength(2)
    expect(screen.queryByText('MP-ZERO')).toBeNull()
    expect(screen.getAllByTestId('legacy-tag-warning')).toHaveLength(1)
  })

  it('keeps Conciliar disabled until provider and deposit are valid, then saves', async () => {
    const port = portWith([row({ operationKey: null })])
    render(<ConciliationPage port={port} />)
    const table = await screen.findByTestId('legacy-table')
    const button = within(table).getByRole('button', { name: 'Conciliar' })
    expect((button as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(within(table).getByLabelText('Proveedor'), { target: { value: 'CLIP' } })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(table).getByLabelText('Monto depositado'), { target: { value: '970' } })
    expect(within(table).getByTestId('legacy-fee').textContent).toContain('30')
    expect((button as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(button)
    await waitFor(() => expect(port.save).toHaveBeenCalledTimes(1))
    expect(port.save).toHaveBeenCalledWith({
      legacyRegistrationId: ID,
      provider: 'CLIP',
      depositedCents: 97000,
    })
  })

  it('rejects a deposit above the original amount', async () => {
    const port = portWith([row({})])
    render(<ConciliationPage port={port} />)
    const table = await screen.findByTestId('legacy-table')
    fireEvent.change(within(table).getByLabelText('Monto depositado'), { target: { value: '1500' } })
    expect((within(table).getByRole('button', { name: 'Conciliar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows a read failure instead of an empty table', async () => {
    const port: LegacyReconcilePort = {
      list: async () => {
        throw new Error('No se pudo leer el histórico legacy.')
      },
      save: async () => {},
    }
    render(<ConciliationPage port={port} />)
    expect(await screen.findByTestId('legacy-error')).toBeTruthy()
  })
})

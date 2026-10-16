import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from '../../../src/App'
import { closedAccountAuth } from '../../../src/auth/fixture-ports'
import type { AuthPort, AuthorizationPort, OperationalRole } from '../../../src/auth/types'
import { assembleMarketingContacts } from '../../../insforge/functions/_shared/commercial/contacts'
import {
  classifyCommercialRead,
  roleMayReadCommercialAggregates,
  roleMayReadCommercialDirectory,
  roleMayReadMarketingContacts,
} from '../../../insforge/functions/_shared/commercial/gate'
import {
  classifySalesReadRequest,
  roleMayAskWhoami,
  roleMayReadSales,
} from '../../../insforge/functions/_shared/sales-read/gate'
import { createHarnessSalesPort } from '../../../src/sales-dashboard/harness-snapshot'
import {
  EMPTY_MARKETING_FILTERS,
  filterMarketingContacts,
  marketingContactsToCsv,
  parseMarketingPayload,
  type MarketingContact,
} from '../../../src/sales-dashboard/marketing'
import type { SalesPort } from '../../../src/sales-dashboard/port'
import { roleAllowsPath, routeRequiresAssignment } from '../../../src/auth/roles'

const sources = {
  buyers: [
    { id: 'b-ana', name: 'Ana López', email: 'Ana@Example.com', phone: '9991111111', contact_consent_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z' },
    { id: 'b-pend', name: 'Pedro Pendiente', email: 'pedro@example.com', phone: null, contact_consent_at: null, created_at: '2026-09-05T00:00:00Z' },
    { id: 'b-lead', name: 'Lupe Lead', email: 'lupe@example.com', phone: '9993333333', contact_consent_at: null, created_at: '2026-09-06T00:00:00Z' },
    { id: 'b-exp', name: 'Eva Expirada', email: 'eva@example.com', phone: null, contact_consent_at: null, created_at: '2026-09-07T00:00:00Z' },
  ],
  orders: [
    { id: 'o1', buyer_contact_id: 'b-ana', state: 'PAID', total_cents: 150000, created_at: '2026-09-02T00:00:00Z', updated_at: '2026-09-02T01:00:00Z' },
    { id: 'o2', buyer_contact_id: 'b-ana', state: 'PAYMENT_PENDING', total_cents: 99999, created_at: '2026-09-03T00:00:00Z', updated_at: '2026-09-03T00:00:00Z' },
    { id: 'o3', buyer_contact_id: 'b-pend', state: 'PREFERENCE_PENDING', total_cents: 25000, created_at: '2026-09-05T00:00:00Z', updated_at: '2026-09-05T00:00:00Z' },
    { id: 'o4', buyer_contact_id: 'b-exp', state: 'EXPIRED', total_cents: 25000, created_at: '2026-09-07T00:00:00Z', updated_at: '2026-09-07T00:00:00Z' },
  ],
  items: [
    { order_id: 'o1', product_code: 'IND-H' },
    { order_id: 'o3', product_code: 'PUB-VIE' },
  ],
  products: [
    { code: 'IND-H', name: 'Individual Hombre' },
    { code: 'PUB-VIE', name: 'Público · Viernes' },
  ],
  legacy: [
    { id: 'l1', original_status: 'paid', commercial_status: 'LEGACY_PAID', original_created_at: '2026-07-01T00:00:00Z', original_updated_at: '2026-07-02T00:00:00Z', original_name: 'Ana López', original_email: 'ana@example.com', original_phone: '9991111111', category_code_raw: 'IND-H', category_name_raw: 'Individual Hombre', amount_cents: 100000 },
    { id: 'l2', original_status: 'pending', commercial_status: 'LEGACY_PENDING', original_created_at: '2026-08-01T00:00:00Z', original_updated_at: '2026-08-01T00:00:00Z', original_name: 'Marta Ruiz', original_email: 'marta@example.com', original_phone: null, category_code_raw: 'PUB-SAB', category_name_raw: 'Público Sábado', amount_cents: 25000 },
    { id: 'l3', original_status: 'cancelled', commercial_status: null, original_created_at: null, original_updated_at: null, original_name: 'Cancelado', original_email: 'cancel@example.com', original_phone: null, category_code_raw: null, category_name_raw: null, amount_cents: null },
  ],
}

function byEmail(contacts: MarketingContact[], email: string) {
  return contacts.find((contact) => contact.email === email)
}

describe('assembleMarketingContacts', () => {
  const contacts = assembleMarketingContacts(sources)

  it('lists paid, pending and identified leads, and skips unusable legacy rows', () => {
    expect(byEmail(contacts, 'ana@example.com')?.status).toBe('PAID')
    expect(byEmail(contacts, 'pedro@example.com')?.status).toBe('PENDING')
    expect(byEmail(contacts, 'marta@example.com')?.status).toBe('PENDING')
    expect(byEmail(contacts, 'eva@example.com')?.status).toBe('LEAD')
    expect(byEmail(contacts, 'lupe@example.com')?.status).toBe('LEAD')
    expect(byEmail(contacts, 'cancel@example.com')).toBeUndefined()
  })

  it('merges one person across orders and legacy by normalized email', () => {
    const ana = contacts.filter((contact) => contact.email === 'ana@example.com')
    expect(ana).toHaveLength(1)
    expect(ana[0]?.origin).toBe('current+legacy')
    // current paid 150000 + legacy paid 100000; the pending order adds nothing.
    expect(ana[0]?.paidCents).toBe(250000)
    expect(ana[0]?.categories).toContain('Individual Hombre')
  })

  it('carries consent only from current orders, never from legacy', () => {
    expect(byEmail(contacts, 'ana@example.com')?.consent).toBe('recorded')
    expect(byEmail(contacts, 'pedro@example.com')?.consent).toBe('not-recorded')
    expect(byEmail(contacts, 'marta@example.com')?.consent).toBe('not-recorded')
  })

  it('does not add the amount of a legacy row whose payment is already counted', () => {
    const rows = assembleMarketingContacts({
      ...sources,
      approvedPaymentIds: new Set(['mp-shared']),
      legacy: [
        ...sources.legacy,
        {
          id: 'l-shared',
          original_status: 'paid',
          commercial_status: 'LEGACY_PAID',
          original_created_at: '2026-09-01T00:00:00Z',
          original_updated_at: '2026-09-02T00:00:00Z',
          original_name: 'Otra Persona',
          original_email: 'otra@example.com',
          original_phone: null,
          category_code_raw: 'IND-H',
          category_name_raw: 'Individual Hombre',
          amount_cents: 150000,
          original_payment_id: 'mp-shared',
        },
      ],
    })
    const otra = byEmail(rows, 'otra@example.com')
    expect(otra?.status).toBe('PAID')
    expect(otra?.paidCents).toBe(0)
    expect(otra?.paymentCountedOnCurrent).toBe(true)
  })

  it('exposes no payment, fee, order id, or note fields', () => {
    const keys = new Set(contacts.flatMap((contact) => Object.keys(contact)))
    expect([...keys].sort()).toEqual([
      'categories', 'consent', 'email', 'firstAt', 'importedAt', 'key', 'lastAt', 'name', 'origin', 'paidCents', 'paymentCountedOnCurrent', 'phone', 'registeredAt', 'saleAt', 'status',
    ])
  })
})

describe('MARKETING gate', () => {
  it('reads contacts and nothing else', () => {
    expect(roleMayReadMarketingContacts('MARKETING')).toBe(true)
    expect(roleMayReadMarketingContacts('OWNER')).toBe(true)
    expect(roleMayReadMarketingContacts('FINANCE')).toBe(false)
    expect(roleMayReadMarketingContacts('SOLUTION_DESK')).toBe(false)
    expect(roleMayReadMarketingContacts(null)).toBe(false)

    expect(roleMayReadSales('MARKETING')).toBe(false)
    expect(roleMayReadCommercialAggregates('MARKETING')).toBe(false)
    expect(roleMayReadCommercialDirectory('MARKETING')).toBe(false)
    expect(roleMayAskWhoami('MARKETING')).toBe(true)
    expect(roleMayAskWhoami('SOLUTION_DESK')).toBe(false)
  })

  it('classifies the new view and still rejects unknown ones', () => {
    expect(classifyCommercialRead('contacts')).toEqual({ ok: true, view: 'contacts' })
    expect(classifyCommercialRead('export-all').ok).toBe(false)
    expect(classifySalesReadRequest('snapshot').ok).toBe(true)
  })

  it('checks the role before any data read in both functions', () => {
    const commercial = readFileSync(
      resolve(process.cwd(), 'insforge/functions/ops-commercial-read/index.ts'),
      'utf8',
    )
    const gate = commercial.indexOf('roleMayReadMarketingContacts(role)')
    expect(gate).toBeGreaterThan(0)
    expect(gate).toBeLessThan(commercial.indexOf('await marketingContacts('))
    expect(commercial).not.toMatch(/\.(insert|update|delete|upsert)\(/)

    const sales = readFileSync(
      resolve(process.cwd(), 'insforge/functions/ops-sales-read/index.ts'),
      'utf8',
    )
    const whoami = sales.indexOf('roleMayAskWhoami(role)')
    const readGate = sales.indexOf('!roleMayReadSales(role)')
    expect(whoami).toBeGreaterThan(0)
    expect(readGate).toBeGreaterThan(whoami)
    expect(readGate).toBeLessThan(sales.indexOf("from('orders')"))
  })

  it('migration only widens the role check and seeds no users', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'insforge/migrations/0042_dashboard-readers-marketing.sql'),
      'utf8',
    )
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
    expect(sql).toMatch(/CHECK \(role IN \('OWNER', 'FINANCE', 'MARKETING'\)\)/)
    expect(sql).not.toMatch(/\bINSERT\b/i)
    expect(sql).not.toMatch(/\bDROP TABLE\b/i)
  })
})

describe('MARKETING routes', () => {
  it('opens /ops/marketing only for OWNER and MARKETING, without an assignment', () => {
    expect(roleAllowsPath('MARKETING', '/ops/marketing')).toBe(true)
    expect(roleAllowsPath('OWNER', '/ops/marketing')).toBe(true)
    expect(roleAllowsPath('FINANCE', '/ops/marketing')).toBe(false)
    expect(roleAllowsPath('SOLUTION_DESK', '/ops/marketing')).toBe(false)
    expect(routeRequiresAssignment('/ops/marketing')).toBe(false)
    for (const path of [
      '/ops/finance',
      '/ops/partners',
      '/ops/checkin',
      '/ops/desk',
    ] as const) {
      expect(roleAllowsPath('MARKETING', path)).toBe(false)
    }
  })
})

describe('marketing CSV and filters', () => {
  const contacts = assembleMarketingContacts(sources)

  it('exports every contact with its status and consent', () => {
    const csv = marketingContactsToCsv(contacts)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('name,email,phone,status,categories,paid_amount_mxn,fecha_venta,fecha_registro,fecha_importacion,origin,consent')
    expect(lines).toHaveLength(contacts.length + 1)
    expect(csv).toContain('pedro@example.com')
    expect(csv).toContain('PENDING')
    expect(csv).toContain('2500.00')
  })

  it('neutralizes spreadsheet formulas but keeps phone numbers readable', () => {
    const csv = marketingContactsToCsv([
      {
        key: 'x',
        name: '=HYPERLINK("http://evil")',
        email: '@evil@example.com',
        phone: '+52 999 123 4567',
        status: 'LEAD',
        origin: 'current',
        categories: ['-1+1'],
        paidCents: 0,
        firstAt: null,
        lastAt: null,
        saleAt: null,
        registeredAt: null,
        importedAt: null,
        paymentCountedOnCurrent: false,
        consent: 'not-recorded',
      },
    ])
    const row = csv.split('\n')[1]!
    expect(row).toContain(`"'=HYPERLINK(""http://evil"")"`)
    expect(row).toContain("'@evil@example.com")
    expect(row).toContain(',+52 999 123 4567,')
    expect(row).toContain("'-1+1")
  })

  it('filters by status, consent and search', () => {
    expect(
      filterMarketingContacts(contacts, { ...EMPTY_MARKETING_FILTERS, status: 'PENDING' }).every(
        (contact) => contact.status === 'PENDING',
      ),
    ).toBe(true)
    const consented = filterMarketingContacts(contacts, { ...EMPTY_MARKETING_FILTERS, consent: 'recorded' })
    expect(consented.map((contact) => contact.email)).toEqual(['ana@example.com'])
    expect(
      filterMarketingContacts(contacts, { ...EMPTY_MARKETING_FILTERS, search: 'LUPE' }),
    ).toHaveLength(1)
  })

  it('rejects a payload that is not a contact list', () => {
    expect(() => parseMarketingPayload({ ok: true })).toThrow()
    expect(parseMarketingPayload({ contacts: [{ key: 'k', status: 'NOPE' }] }).contacts).toEqual([])
  })
})

function authz(role: OperationalRole | null): AuthorizationPort {
  return {
    async resolveRole() {
      return role
    },
    async resolveAssignment() {
      return null
    },
  }
}

const session: AuthPort = {
  ...closedAccountAuth(),
  async getSession() {
    return {
      status: 'authenticated',
      user: { id: 'u-marketing', email: 'tonycancmkt@gmail.com' },
      errorMessage: null,
    }
  },
  async signInWithPassword() {
    return { ok: true }
  },
  async signOut() {},
}

function portWithContacts(): SalesPort {
  return {
    ...createHarnessSalesPort(),
    async loadContacts() {
      return {
        eventCode: 'HEX-2026',
        contacts: assembleMarketingContacts(sources),
        visitors: 10,
        identifiedVisitors: 4,
      }
    },
  }
}

describe('marketing page', () => {
  it('shows MARKETING only the contact list and exports it', async () => {
    render(
      <App
        initialPath="/ops/marketing"
        authPort={session}
        authorizationPort={authz('MARKETING')}
        salesPort={portWithContacts()}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('marketing-contacts')).toBeTruthy())
    expect(screen.getAllByTestId('marketing-row').length).toBeGreaterThan(0)
    expect(screen.getByTestId('marketing-visitors').textContent).toContain('6 no dejaron datos')
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getAllByRole('link').map((node) => node.textContent)).toEqual([
      'Inicio',
      'Marketing',
    ])
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'PENDING' } })
    expect(screen.getByTestId('marketing-count').textContent).toBe('2 contactos')
    expect(screen.getByTestId('marketing-export')).toBeTruthy()
  })

  it('keeps FINANCE and MARKETING out of each other\'s pages', async () => {
    const { unmount } = render(
      <App
        initialPath="/ops/marketing"
        authPort={session}
        authorizationPort={authz('FINANCE')}
        salesPort={portWithContacts()}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('unauthorized')).toBeTruthy())
    unmount()

    render(
      <App
        initialPath="/ops/finance"
        authPort={session}
        authorizationPort={authz('MARKETING')}
        salesPort={portWithContacts()}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('unauthorized')).toBeTruthy())
  })
})

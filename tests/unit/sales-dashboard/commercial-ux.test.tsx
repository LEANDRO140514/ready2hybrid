import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CommercialDirectory, HistoricalSales } from '../../../src/components/finance/CommercialLayer'
import type { LegacyRegistration } from '../../../src/sales-dashboard/commercial'
import { EMPTY_FILTERS, type SalesOrder } from '../../../src/sales-dashboard/model'

const now = new Date('2026-09-26T18:00:00.000Z')
const wide = { ...EMPTY_FILTERS, preset: 'custom' as const, customFrom: '2026-07-01', customTo: '2026-09-26' }

function legacy(partial: Partial<LegacyRegistration> & Pick<LegacyRegistration, 'id' | 'originalStatus'>): LegacyRegistration {
  return {
    eventCode: 'HEX-2026',
    commercialStatus: partial.originalStatus === 'paid' ? 'LEGACY_PAID' : 'LEGACY_PENDING',
    originalCreatedAt: '2026-09-01T12:00:00.000Z',
    originalUpdatedAt: '2026-09-01T12:00:00.000Z',
    buyerContactId: null,
    name: 'Persona',
    email: 'persona@example.com',
    phone: '9990000000',
    categoryCode: 'IND-H',
    categoryName: 'Individual Hombre',
    amountCents: 100000,
    currency: 'MXN',
    ...partial,
  }
}

const eric = [
  legacy({
    id: 'eric-relay',
    originalStatus: 'paid',
    name: 'Eric Gibellini',
    email: 'eric@hybrid.example',
    phone: '9991234567',
    categoryCode: 'REL-2H2M',
    categoryName: 'Relay Mixto 2H+2M',
    amountCents: 320000,
    teamName: 'SPOSI Y MORES',
    participants: 'Ana, Beto, Carla, Diego',
    originalCreatedAt: '2026-08-21T15:36:31.325Z',
    originalUpdatedAt: '2026-08-21T17:34:11.562Z',
    hasPaymentId: true,
  }),
  legacy({
    id: 'eric-dobles',
    originalStatus: 'paid',
    name: 'Eric Gibellini',
    email: 'eric@hybrid.example',
    phone: '9991234567',
    categoryCode: 'DOB-SAB-MH',
    categoryName: 'Dobles Mixto',
    amountCents: 250000,
    teamName: 'TEAM 305',
    participants: 'Eric Gibellini, Marta Ruiz',
    originalCreatedAt: '2026-09-22T20:01:59.142Z',
    originalUpdatedAt: '2026-09-23T20:06:49.609Z',
    hasPaymentId: true,
  }),
]

const alan = [
  ...['2026-09-11T00:04:10.035Z', '2026-09-11T00:06:03.621Z', '2026-09-11T00:16:06.424Z'].map((at, index) => legacy({
    id: `alan-${index}`,
    originalStatus: 'pending',
    name: 'Alan Fernando Santillan Alba',
    email: 'alan@hybrid.example',
    phone: '9995555555',
    categoryCode: 'DOB-SAB-HH',
    categoryName: 'Dobles Hombres',
    amountCents: 250000,
    participants: 'Alan Fernando Santillan Alba, Bruno Díaz',
    originalCreatedAt: at,
    originalUpdatedAt: at,
  })),
  legacy({
    id: 'alan-paid',
    originalStatus: 'paid',
    name: 'Bruno Díaz',
    email: 'alan@hybrid.example',
    phone: '9995555555',
    categoryCode: 'DOB-SAB-HH',
    categoryName: 'Dobles Hombres',
    amountCents: 250000,
    participants: 'Bruno Díaz, Carla Méndez',
    notes: 'Pago via referencia',
    hasPaymentId: true,
    originalCreatedAt: '2026-09-11T00:25:59.609Z',
    originalUpdatedAt: '2026-09-11T07:23:17.966Z',
  }),
]

const shared = [
  legacy({ id: 'box-a', originalStatus: 'pending', name: 'Ada López', email: 'box@example.com', categoryName: 'Individual Mujer', categoryCode: 'IND-M' }),
  legacy({ id: 'box-b', originalStatus: 'pending', name: 'Bea López', email: 'box@example.com', categoryName: 'Público Viernes', categoryCode: 'PUB-VIE', originalCreatedAt: '2026-09-02T12:00:00.000Z' }),
]

describe('commercial directory ux', () => {
  it('shows owner contact data without consent or partner columns', () => {
    render(<CommercialDirectory orders={[] as SalesOrder[]} legacy={eric} eventCode="HEX-2026" role="OWNER" />)
    expect(screen.getAllByText('eric@hybrid.example').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/9991234567/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Comprador').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2 inscripciones pagadas').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/5,700/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('columnheader', { name: 'Consentimiento' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Partner' })).toBeNull()
    expect(screen.queryByText('Aquí ves personas')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: /Eric Gibellini/ })[0]!)
    const journey = screen.getByTestId('contact-journey')
    expect(within(journey).getAllByTestId('registration-card')).toHaveLength(2)
    expect(within(journey).getByText(/SPOSI Y MORES/)).toBeTruthy()
    expect(within(journey).getByText(/TEAM 305/)).toBeTruthy()
    expect(within(journey).getByText(/Participantes declarados: Ana, Beto, Carla, Diego/)).toBeTruthy()
  })

  it('flags a shared inbox and keeps Alan as one buyer with four rows', () => {
    render(<CommercialDirectory orders={[] as SalesOrder[]} legacy={[...alan, ...shared]} eventCode="HEX-2026" role="OWNER" />)
    expect(screen.getAllByTestId('shared-inbox').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: /Alan Fernando Santillan Alba/ })[0]!)
    const journey = screen.getByTestId('contact-journey')
    expect(within(journey).getByText('Comprador')).toBeTruthy()
    expect(within(journey).getAllByTestId('registration-card')).toHaveLength(4)
    expect(within(journey).getAllByText(/Pendiente histórico/)).toHaveLength(3)
    expect(within(journey).getByText(/Bruno Díaz, Carla Méndez/)).toBeTruthy()
    expect(screen.getAllByText('Oportunidad').length).toBeGreaterThan(0)
    expect(within(journey).queryByText('Oportunidad')).toBeNull()
  })

  it('explains a category search that the name does not contain', () => {
    render(
      <CommercialDirectory
        orders={[] as SalesOrder[]}
        legacy={[legacy({
          id: 'wod',
          originalStatus: 'pending',
          name: 'Luis Peña',
          email: 'luis@example.com',
          categoryCode: 'WOD-M',
          categoryName: 'Workout Experience Mujer',
        })]}
        eventCode="HEX-2026"
        role="OWNER"
      />,
    )
    fireEvent.change(screen.getByPlaceholderText(/Buscar nombre, correo, teléfono, categoría o equipo/), { target: { value: 'eri' } })
    expect(screen.getAllByText('Luis Peña').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('search-hit').some((node) => node.textContent === 'eri')).toBe(true)
    expect(screen.getByTestId('directory-interest').textContent).toContain('Workout Experience Mujer')
  })

  it('hides contact identity from FINANCE', () => {
    render(<CommercialDirectory orders={[] as SalesOrder[]} legacy={eric} eventCode="HEX-2026" role="FINANCE" />)
    expect(screen.getByTestId('commercial-denied')).toBeTruthy()
    expect(screen.queryByText('eric@hybrid.example')).toBeNull()
    expect(screen.queryByText('9991234567')).toBeNull()
  })
})

describe('historical sales ux', () => {
  it('keeps one source row per registration and opens pair detail without attribution columns', () => {
    render(<HistoricalSales orders={[] as SalesOrder[]} legacy={[...eric, ...alan]} eventCode="HEX-2026" filters={wide} now={now} />)
    expect(screen.queryByRole('columnheader', { name: 'Atribución' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Origen' })).toBeNull()
    expect(screen.queryByText('Sin atribución histórica')).toBeNull()
    expect(screen.getAllByTestId('historical-row').length).toBeGreaterThanOrEqual(6)
    expect(screen.getAllByText('Compró después').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: /Eric Gibellini/ })[0]!)
    const detail = screen.getByTestId('legacy-detail')
    expect(within(detail).getByText('eric@hybrid.example')).toBeTruthy()
    expect(within(detail).getByText('9991234567')).toBeTruthy()
    expect(within(detail).getByText('SPOSI Y MORES')).toBeTruthy()
    expect(within(detail).getByText('Participantes declarados')).toBeTruthy()
    expect(within(detail).getByText('Ana, Beto, Carla, Diego')).toBeTruthy()
  })
})

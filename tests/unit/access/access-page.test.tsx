import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AccessPerson } from '../../../src/access/list'
import { AccessListPage } from '../../../src/components/access/AccessListPage'

function person(over: Partial<AccessPerson> & { name: string }): AccessPerson {
  return {
    email: null,
    phone: null,
    category: 'Dobles Hombres',
    categoryCode: 'DOB-SAB-HH',
    team: 'Águilas',
    session: 'Sábado',
    sessionDate: '2026-11-14',
    origin: 'Legacy',
    reference: `ref-${over.name}`,
    contactNote: null,
    ...over,
  }
}

const people = [
  person({ name: 'Ana Capitana', email: 'ana@example.com', phone: '9991111111' }),
  person({ name: 'Beto Pareja', contactNote: 'Pareja de: Ana Capitana' }),
  person({ name: 'Cai Viernes', session: 'Viernes', sessionDate: '2026-11-13', team: null, category: 'Individual Hombre' }),
]

describe('access list page', () => {
  it('shows N of TOTAL only while searching', () => {
    render(<AccessListPage people={people} />)
    expect(screen.getByTestId('access-count').textContent).toBe('3 personas con acceso')
    fireEvent.change(screen.getByTestId('access-search'), { target: { value: 'beto' } })
    expect(screen.getByTestId('access-count').textContent).toBe('1 de 3 personas')
  })

  it('writes "Pareja de" where a member has no contact', () => {
    render(<AccessListPage people={people} />)
    const row = screen.getAllByTestId('access-row').find((item) => item.textContent?.includes('Beto Pareja'))!
    expect(within(row).getByText('Pareja de: Ana Capitana')).toBeTruthy()
  })

  it('prints grouped by day, then category, then team', () => {
    render(<AccessListPage people={people} />)
    const sheet = screen.getByTestId('access-print-sheet')
    const headings = [...sheet.querySelectorAll('h2, h3, h4')].map((node) => node.textContent)
    expect(headings).toEqual(['Viernes', 'Individual Hombre', 'Sábado', 'Dobles Hombres', 'Águilas'])
    expect(sheet.textContent).toContain('Beto Pareja — Pareja de: Ana Capitana')
  })
})

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../../../src/App'
import { closedAccountAuth } from '../../../src/auth/fixture-ports'
import { FinanceDashboard } from '../../../src/components/finance/FinanceDashboard'
import type { AuthPort, AuthorizationPort } from '../../../src/auth/types'
import {
  HARNESS_NOW,
  HARNESS_SNAPSHOT,
  createHarnessSalesPort,
} from '../../../src/sales-dashboard/harness-snapshot'
import { formatMoney } from '../../../src/sales-dashboard/model'

function authz(
  role: 'FINANCE' | 'CHECKIN_STAFF' | 'OWNER' | 'OPERATIONS_MANAGER' | 'SOLUTION_DESK' | null,
): AuthorizationPort {
  return {
    async resolveRole() {
      return role
    },
    async resolveAssignment() {
      if (role === 'FINANCE' || role === 'OWNER' || role == null) return null
      return {
        operatorId: 'u1',
        role,
        eventId: 'evt',
        eventDayId: 'day1',
        doorOrAreaId: 'gate-a',
        validFrom: '2020-01-01T00:00:00.000Z',
        validTo: '2099-01-01T00:00:00.000Z',
        sourceVersion: 'test',
      }
    },
  }
}

function sessionPort(email: string): AuthPort {
  return {
    ...closedAccountAuth(),
    async getSession() {
      return {
        status: 'authenticated',
        user: { id: 'u1', email },
        errorMessage: null,
      }
    },
    async signInWithPassword() {
      return { ok: true }
    },
    async signOut() {},
  }
}

function linkNames(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Principal' })
  return within(nav)
    .getAllByRole('link')
    .map((node) => node.textContent ?? '')
}

describe('operational navigation', () => {
  it('shows Inicio and Ventas for FINANCE, and labels the role apart from the email', async () => {
    render(
      <App
        initialPath="/"
        authPort={sessionPort('finance@example.com')}
        authorizationPort={authz('FINANCE')}
        salesPort={createHarnessSalesPort()}
      />,
    )
    expect((await screen.findByTestId('session-role')).textContent).toContain('FINANCE')
    expect(screen.getByTestId('session-user').textContent).toContain('finance@example.com')
    expect(linkNames()).toEqual(['Inicio', 'Ventas'])
    expect(screen.queryByRole('link', { name: 'Check-in' })).toBeNull()
    expect(screen.queryByText(/shell operativo|fundación PWA|manifiesto|build:/i)).toBeNull()
    expect(await screen.findByRole('link', { name: 'Ir a ventas' })).toBeTruthy()
    expect((await screen.findByTestId('home-reconcile')).textContent).toMatch(
      /pendientes de conciliar/i,
    )
  })

  it('denies FINANCE on check-in and desk even by direct URL', async () => {
    const checkin = render(
      <App
        initialPath="/ops/checkin"
        authPort={sessionPort('finance@example.com')}
        authorizationPort={authz('FINANCE')}
        salesPort={createHarnessSalesPort()}
      />,
    )
    expect(await screen.findByTestId('unauthorized')).toBeTruthy()
    checkin.unmount()

    render(
      <App
        initialPath="/ops/desk"
        authPort={sessionPort('finance@example.com')}
        authorizationPort={authz('FINANCE')}
        salesPort={createHarnessSalesPort()}
      />,
    )
    expect(await screen.findByTestId('unauthorized')).toBeTruthy()
  })

  it('does not treat the finance email as a role when the role is unresolved', async () => {
    render(
      <App
        initialPath="/"
        authPort={sessionPort('finance@example.com')}
        authorizationPort={authz(null)}
        salesPort={createHarnessSalesPort()}
      />,
    )
    expect((await screen.findByTestId('session-role')).textContent).toContain('sin rol operativo')
    expect(linkNames()).toEqual(['Inicio'])
  })

  it('keeps operational links for the roles that already had them, without Ventas', async () => {
    const owner = render(
      <App
        initialPath="/"
        authPort={sessionPort('owner@example.com')}
        authorizationPort={authz('OWNER')}
        salesPort={createHarnessSalesPort()}
      />,
    )
    expect(await screen.findByRole('link', { name: 'Ventas' })).toBeTruthy()
    expect(linkNames()).toEqual(['Inicio', 'Check-in', 'Mesa', 'Ventas', 'Community Partners'])
    owner.unmount()

    const ops = render(
      <App
        initialPath="/"
        authPort={sessionPort('ops@example.com')}
        authorizationPort={authz('OPERATIONS_MANAGER')}
        salesPort={createHarnessSalesPort()}
      />,
    )
    expect((await screen.findByTestId('session-role')).textContent).toContain(
      'OPERATIONS_MANAGER',
    )
    expect(linkNames()).toEqual(['Inicio', 'Check-in', 'Mesa'])
    ops.unmount()

    const desk = render(
      <App
        initialPath="/"
        authPort={sessionPort('desk@example.com')}
        authorizationPort={authz('SOLUTION_DESK')}
        salesPort={createHarnessSalesPort()}
      />,
    )
    expect((await screen.findByTestId('session-role')).textContent).toContain(
      'SOLUTION_DESK',
    )
    expect(linkNames()).toEqual(['Inicio', 'Mesa'])
    desk.unmount()

    render(
      <App
        initialPath="/"
        authPort={sessionPort('checkin@example.com')}
        authorizationPort={authz('CHECKIN_STAFF')}
        salesPort={createHarnessSalesPort()}
      />,
    )
    expect((await screen.findByTestId('session-role')).textContent).toContain(
      'CHECKIN_STAFF',
    )
    expect(linkNames()).toEqual(['Inicio', 'Check-in'])
  })
})

describe('FinanceDashboard', () => {
  it('shows approved sales and hides full contact data until the detail', async () => {
    render(<FinanceDashboard snapshot={HARNESS_SNAPSHOT} now={HARNESS_NOW} />)
    expect(screen.getByTestId('kpi-paid').textContent).toContain('3')
    expect(screen.getByTestId('kpi-participants').textContent).toContain('4')
    expect(screen.queryByText('ana@example.com')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Ventas' }))
    fireEvent.click(screen.getByRole('button', { name: 'TRK-IND' }))
    const detail = await screen.findByTestId('order-detail')
    expect(detail.textContent).toContain('ana@example.com')
    expect(detail.textContent).toContain('estado del boleto: REVOKED')
    expect(detail.textContent).toContain('Envío: SENT')
  })

  it('exports only the rows that match the active filter', async () => {
    const created: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      created.push(blob as Blob)
      return 'blob:csv'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    render(<FinanceDashboard snapshot={HARNESS_SNAPSHOT} now={HARNESS_NOW} />)
    fireEvent.change(screen.getByLabelText('Producto'), {
      target: { value: 'HALF-IND-M' },
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Ventas' }))
    fireEvent.click(screen.getByTestId('export-csv'))
    const csv = await created[0]?.text()
    expect(csv).toContain('TRK-GAP')
    expect(csv).not.toContain('TRK-IND')
    expect(csv).toContain('gross_amount_mxn')
    expect(csv).toContain('reconciliation_status')
    expect(csv).toContain('payment_provider')
  })

  it('captures, edits, and zeroes a reconciliation without treating blank as zero', async () => {
    const port = createHarnessSalesPort()
    const { rerender } = render(
      <FinanceDashboard
        snapshot={await port.loadSnapshot()}
        now={HARNESS_NOW}
        onSaveAdjustment={async (input) => {
          await port.saveAdjustment(input)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Conciliar ahora' }))
    const card = screen.getByTestId('reconcile-TRK-IND')
    expect(card.textContent).toContain('PENDIENTE DE CONCILIAR')
    expect(card.textContent).toContain('No capturado')

    fireEvent.change(within(card).getByLabelText('Comisión del procesador'), {
      target: { value: '60' },
    })
    fireEvent.change(within(card).getByLabelText('IVA de la comisión'), {
      target: { value: '9.60' },
    })
    fireEvent.change(within(card).getByLabelText('Otros costos'), {
      target: { value: '0' },
    })
    expect(within(card).getByTestId('draft-net').textContent).toContain('1,430.40')
    fireEvent.click(within(card).getByRole('button', { name: 'Guardar conciliación' }))
    await waitFor(async () => {
      const saved = (await port.loadSnapshot()).orders.find((order) => order.trackingRef === 'TRK-IND')
      expect(saved?.adjustment?.providerFeeCents).toBe(6000)
      expect(saved?.adjustment?.providerFeeTaxCents).toBe(960)
      expect(saved?.adjustment?.otherCostsCents).toBe(0)
    })
    const afterFirst = await port.loadSnapshot()
    rerender(
      <FinanceDashboard
        snapshot={afterFirst}
        now={HARNESS_NOW}
        onSaveAdjustment={async (input) => {
          await port.saveAdjustment(input)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Ventas' }))
    fireEvent.click(screen.getByRole('button', { name: 'TRK-IND' }))
    expect(screen.getByTestId('reconciliation').textContent).toContain('CONCILIADA')
    expect(screen.getByTestId('reconciliation').textContent).toContain(formatMoney(143040))
    expect(screen.getByTestId('reconciliation').textContent).toContain('harness-user')

    fireEvent.change(screen.getByLabelText('Comisión del procesador'), {
      target: { value: '70' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar conciliación' }))
    await waitFor(async () => {
      const saved = (await port.loadSnapshot()).orders.find((order) => order.trackingRef === 'TRK-IND')
      expect(saved?.adjustment?.providerFeeCents).toBe(7000)
      expect(saved?.adjustment?.updatedAt).not.toBe(afterFirst.orders.find((order) => order.trackingRef === 'TRK-IND')?.adjustment?.updatedAt)
    })
    const afterEdit = await port.loadSnapshot()
    rerender(
      <FinanceDashboard
        snapshot={afterEdit}
        now={HARNESS_NOW}
        onSaveAdjustment={async (input) => {
          await port.saveAdjustment(input)
        }}
      />,
    )
    expect(screen.getByTestId('reconciliation').textContent).toContain(formatMoney(142040))

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    fireEvent.click(screen.getByRole('button', { name: 'TRK-GAP' }))
    fireEvent.change(screen.getByLabelText('Comisión del procesador'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('IVA de la comisión'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Otros costos'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar conciliación' }))
    await waitFor(async () => {
      const saved = (await port.loadSnapshot()).orders.find((order) => order.trackingRef === 'TRK-GAP')
      expect(saved?.adjustment?.providerFeeCents).toBe(0)
      expect(saved?.adjustment?.providerFeeTaxCents).toBe(0)
      expect(saved?.adjustment?.otherCostsCents).toBe(0)
    })
    rerender(
      <FinanceDashboard snapshot={await port.loadSnapshot()} now={HARNESS_NOW} />,
    )
    expect(screen.getByTestId('reconciliation').textContent).toContain('CONCILIADA')
    expect(screen.getByTestId('reconciliation').textContent).toContain(formatMoney(80000))
  })
})

describe('finance route', () => {
  it('lets FINANCE open the dashboard without a door assignment', async () => {
    render(
      <App
        initialPath="/ops/finance"
        authPort={{
          ...closedAccountAuth(),
          async getSession() {
            return {
              status: 'authenticated',
              user: { id: 'u1', email: 'finance@example.com' },
              errorMessage: null,
            }
          },
          async signInWithPassword() {
            return { ok: true }
          },
          async signOut() {},
        }}
        authorizationPort={authz('FINANCE')}
        salesPort={createHarnessSalesPort()}
      />,
    )
    expect(await screen.findByTestId('kpi-paid')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '30 días' }))
    expect(screen.getByTestId('kpi-paid').textContent).toContain('3')
    expect(screen.queryByRole('tab', { name: 'Base comercial' })).toBeNull()
    expect(screen.queryByRole('button', { name: /reembolso|editar orden|cambiar estado/i })).toBeNull()
  })

  it('keeps CHECKIN_STAFF out and lets OWNER in', async () => {
    const { unmount } = render(
      <App
        initialPath="/ops/finance"
        authPort={{
          ...closedAccountAuth(),
          async getSession() {
            return {
              status: 'authenticated',
              user: { id: 'u1', email: 'staff@example.com' },
              errorMessage: null,
            }
          },
          async signInWithPassword() {
            return { ok: true }
          },
          async signOut() {},
        }}
        authorizationPort={authz('CHECKIN_STAFF')}
        salesPort={createHarnessSalesPort()}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('unauthorized')).toBeTruthy()
    })
    unmount()

    render(
      <App
        initialPath="/ops/finance"
        authPort={{
          ...closedAccountAuth(),
          async getSession() {
            return {
              status: 'authenticated',
              user: { id: 'u1', email: 'owner@example.com' },
              errorMessage: null,
            }
          },
          async signInWithPassword() {
            return { ok: true }
          },
          async signOut() {},
        }}
        authorizationPort={authz('OWNER')}
        salesPort={createHarnessSalesPort()}
      />,
    )
    expect(await screen.findByTestId('kpi-paid')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Base comercial' })).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByTestId('event-legacy-paid').textContent).toContain('1')
    })
    const known = screen.getByTestId('event-known-paid').textContent
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(screen.getByTestId('event-known-paid').textContent).toBe(known)
    fireEvent.click(screen.getByRole('tab', { name: 'Base comercial' }))
    expect(screen.getByTestId('commercial-directory')).toBeTruthy()
  })

  it('does not open the dashboard for OPERATIONS_MANAGER', async () => {
    render(
      <App
        initialPath="/ops/finance"
        authPort={{
          ...closedAccountAuth(),
          async getSession() {
            return {
              status: 'authenticated',
              user: { id: 'u1', email: 'ops@example.com' },
              errorMessage: null,
            }
          },
          async signInWithPassword() {
            return { ok: true }
          },
          async signOut() {},
        }}
        authorizationPort={authz('OPERATIONS_MANAGER')}
        salesPort={createHarnessSalesPort()}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('unauthorized')).toBeTruthy()
    })
  })
})

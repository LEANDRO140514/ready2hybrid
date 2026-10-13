import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from '../../../src/App'
import { closedAccountAuth } from '../../../src/auth/fixture-ports'
import type { AuthPort, AuthorizationPort, OperationalRole } from '../../../src/auth/types'
import { createMemoryPartnersPort } from '../../../src/partners/memory'
import { createHarnessSalesPort } from '../../../src/sales-dashboard/harness-snapshot'

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

function sessionPort(): AuthPort {
  return {
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
  }
}

function renderAt(path: string, role: OperationalRole | null) {
  return render(
    <App
      initialPath={path}
      authPort={sessionPort()}
      authorizationPort={authz(role)}
      salesPort={createHarnessSalesPort()}
      partnersPort={createMemoryPartnersPort([
        {
          code: 'ENFORMA',
          studioName: 'Enforma',
          contactName: 'Responsable',
          phone: '9991111111',
          email: 'studio@example.com',
          active: true,
          createdAt: '2026-09-01T06:00:00.000Z',
          locksLaunchPrice: true,
        },
      ])}
    />,
  )
}

describe('community partners access', () => {
  it('lets OWNER open the admin and keeps FINANCE out', async () => {
    const owner = renderAt('/', 'OWNER')
    const nav = await screen.findByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('link', { name: 'Community Partners' })).toBeTruthy()
    owner.unmount()

    renderAt('/ops/partners', 'OWNER')
    expect(await screen.findByTestId('partners-admin')).toBeTruthy()
    expect((await screen.findAllByText('Enforma')).length).toBeGreaterThan(0)
    expect(screen.getByTestId('partners-admin').textContent).toContain('$2,500.00')
    expect(screen.queryByText('Ciudad')).toBeNull()
  })

  it('denies FINANCE and other roles on the direct route', async () => {
    const finance = renderAt('/ops/partners', 'FINANCE')
    expect(await screen.findByTestId('unauthorized')).toBeTruthy()
    expect(screen.queryByTestId('partners-admin')).toBeNull()
    finance.unmount()

    renderAt('/ops/partners', 'CHECKIN_STAFF')
    expect(await screen.findByTestId('unauthorized')).toBeTruthy()
  })

  it('shows attribution on the sales order and the partner total from total_cents', async () => {
    renderAt('/ops/finance', 'FINANCE')
    expect(await screen.findByTestId('partner-sales-summary')).toBeTruthy()
    expect(screen.getByTestId('partner-sales-summary').textContent).toContain('2,500')
    fireEvent.click(await screen.findByRole('tab', { name: 'Ventas' }))
    fireEvent.click(screen.getByRole('button', { name: 'TRK-DOB' }))
    const attribution = await screen.findByTestId('order-attribution')
    expect(attribution.textContent).toContain('Enforma')
    expect(attribution.textContent).toContain('ENFORMA')
    expect(attribution.textContent).not.toContain('999')
    expect(screen.getByTestId('order-detail').textContent).toContain('2,500')
    expect(screen.getByTestId('order-detail').textContent).not.toContain('2,750')
  })
})

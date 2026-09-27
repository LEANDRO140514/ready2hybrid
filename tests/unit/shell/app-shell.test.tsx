import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import App from '../../../src/App'
import {
  closedAccountAuth,
  createFixtureAuthPort,
  createFixtureAuthorizationPort,
  FIXTURE_ASSIGNMENT_KEY,
  FIXTURE_ROLE_KEY,
  FIXTURE_SESSION_KEY,
} from '../../../src/auth/fixture-ports'
import type {
  AuthPort,
  AuthorizationPort,
  OperationalAssignment,
} from '../../../src/auth/types'

function createAuthPort(
  status: 'authenticated' | 'unauthenticated',
): AuthPort {
  return {
    ...closedAccountAuth(),
    async getSession() {
      if (status === 'authenticated') {
        return {
          status: 'authenticated',
          user: { id: 'u1', email: 'staff@example.com' },
          errorMessage: null,
        }
      }
      return { status: 'unauthenticated', user: null, errorMessage: null }
    },
    async signInWithPassword() {
      return { ok: true }
    },
    async signOut() {},
  }
}

function createAuthzPort(options: {
  role: 'CHECKIN_STAFF' | null
  assignment: OperationalAssignment | null
}): AuthorizationPort {
  return {
    async resolveRole() {
      return options.role
    },
    async resolveAssignment() {
      return options.assignment
    },
  }
}

describe('App shell', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders home without claiming operational readiness', async () => {
    render(
      <App
        authPort={createAuthPort('unauthenticated')}
        authorizationPort={createAuthzPort({ role: null, assignment: null })}
      />,
    )

    expect(
      await screen.findByRole('heading', { name: 'HYBRID EVENT EXPERIENCE 2026' }),
    ).toBeTruthy()
    expect(screen.getAllByText('ENFORMA').length).toBeGreaterThan(0)
    expect(screen.queryByText(/shell operativo/i)).toBeNull()
    expect(screen.queryByText(/manifiesto/i)).toBeNull()
    expect(screen.queryByText(/build:/i)).toBeNull()
    expect(screen.queryByTestId('not-ready-operate')).toBeNull()
    expect(screen.queryByText(/LISTO PARA OPERAR SIN INTERNET/i)).toBeNull()
  })

  it('login states the event without technical copy', async () => {
    render(
      <App
        initialPath="/login"
        authPort={createAuthPort('unauthenticated')}
        authorizationPort={createAuthzPort({ role: null, assignment: null })}
      />,
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Control de ventas y conciliación financiera',
      }),
    ).toBeTruthy()
    expect(screen.getByLabelText('Correo')).toBeTruthy()
    expect(screen.getByLabelText('Contraseña')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(screen.queryByText(/PWA|manifiesto|build:|shell operativo/i)).toBeNull()
  })

  it('denies check-in route when authenticated without assignment', async () => {
    render(
      <App
        initialPath="/ops/checkin"
        authPort={createAuthPort('authenticated')}
        authorizationPort={createAuthzPort({
          role: 'CHECKIN_STAFF',
          assignment: null,
        })}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('unauthorized')).toBeTruthy()
    })
  })

  it('logout clears fixture authz and denies operational routes', async () => {
    localStorage.setItem(
      FIXTURE_SESSION_KEY,
      JSON.stringify({ id: 'u1', email: 'staff@example.com' }),
    )
    localStorage.setItem(FIXTURE_ROLE_KEY, 'CHECKIN_STAFF')
    localStorage.setItem(
      FIXTURE_ASSIGNMENT_KEY,
      JSON.stringify({
        operatorId: 'u1',
        role: 'CHECKIN_STAFF',
        eventId: 'evt',
        eventDayId: 'day1',
        doorOrAreaId: 'gate-a',
        validFrom: '2020-01-01T00:00:00.000Z',
        validTo: '2099-01-01T00:00:00.000Z',
        sourceVersion: 'test',
      } satisfies OperationalAssignment),
    )

    render(
      <App
        initialPath="/ops/checkin"
        authPort={createFixtureAuthPort()}
        authorizationPort={createFixtureAuthorizationPort()}
      />,
    )

    expect(
      await screen.findByTestId('ops-allowed-/ops/checkin'),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    await waitFor(() => {
      expect(localStorage.getItem(FIXTURE_SESSION_KEY)).toBeNull()
      expect(localStorage.getItem(FIXTURE_ROLE_KEY)).toBeNull()
      expect(localStorage.getItem(FIXTURE_ASSIGNMENT_KEY)).toBeNull()
    })
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'
import type { AuthPort, AuthorizationPort } from './auth/types'

const unauthPort: AuthPort = {
  async getSession() {
    return { status: 'unauthenticated', user: null, errorMessage: null }
  },
  async signInWithPassword() {
    return { ok: true }
  },
  async signOut() {},
}

const emptyAuthz: AuthorizationPort = {
  async resolveRole() {
    return null
  },
  async resolveAssignment() {
    return null
  },
}

describe('App', () => {
  it('renders the Ready2Hybrid operational shell', async () => {
    render(<App authPort={unauthPort} authorizationPort={emptyAuthz} />)

    expect(
      await screen.findByRole('heading', { name: 'Ready2Hybrid' }),
    ).toBeTruthy()
  })
})

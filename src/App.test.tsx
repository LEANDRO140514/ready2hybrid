import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('renders the Ready2Hybrid foundation', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Ready2Hybrid' }),
    ).toBeTruthy()

    expect(
      screen.getByText('Foundation initialized'),
    ).toBeTruthy()
  })
})

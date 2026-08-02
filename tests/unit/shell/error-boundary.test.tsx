import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ShellErrorBoundary } from '../../../src/components/shell/ShellErrorBoundary'

function Boom(): never {
  throw new Error('synthetic render failure')
}

describe('ShellErrorBoundary', () => {
  it('captures render failures without exposing stack details', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ShellErrorBoundary>
        <Boom />
      </ShellErrorBoundary>,
    )

    expect(screen.getByTestId('shell-render-failure')).toBeTruthy()
    expect(screen.getByText(/RENDER_FAILURE/i)).toBeTruthy()
    expect(screen.queryByText(/synthetic render failure/i)).toBeNull()
    expect(screen.getByRole('button', { name: /Volver al inicio/i })).toBeTruthy()

    spy.mockRestore()
  })
})

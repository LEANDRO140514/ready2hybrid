import { describe, expect, it } from 'vitest'

import { readConnectivity } from '../../../src/pwa/connectivity'

describe('connectivity', () => {
  it('reads navigator.onLine', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })
    expect(readConnectivity()).toBe('online')

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    })
    expect(readConnectivity()).toBe('offline')
  })
})

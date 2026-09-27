import { createClient } from '@insforge/sdk'
import { describe, expect, it } from 'vitest'

import { postProjectFunction } from '../../../src/lib/insforge/project-function'

const BASE = 'https://project.example'

function clientFor(onRequest: (url: string, init: RequestInit) => void) {
  return createClient({
    baseUrl: BASE,
    anonKey: 'anon-test',
    accessToken: 'user-session-token',
    fetch: async (input, init) => {
      onRequest(String(input), init ?? {})
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
}

describe('ops-sales-read project route', () => {
  it.each(['whoami', 'snapshot', 'upsert-adjustment'] as const)(
    'posts %s to the project functions route',
    async (view) => {
      const seen: { url: string; init: RequestInit }[] = []
      const client = clientFor((url, init) => {
        seen.push({ url, init })
      })
      await postProjectFunction(client, 'ops-sales-read', { view })
      expect(seen).toHaveLength(1)
      expect(seen[0]?.url).toBe(`${BASE}/functions/ops-sales-read`)
      expect(seen[0]?.url).not.toContain('functions.insforge.app')
      expect(seen[0]?.url).not.toContain('function2')
      expect(seen[0]?.init.method).toBe('POST')
      const headers = new Headers(seen[0]?.init.headers)
      expect(headers.get('authorization')).toBe('Bearer user-session-token')
      expect(headers.get('content-type')).toContain('application/json')
      expect(String(seen[0]?.init.body)).toContain(`"view":"${view}"`)
    },
  )
})

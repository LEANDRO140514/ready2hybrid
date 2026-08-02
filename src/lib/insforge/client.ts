import { createClient } from '@insforge/sdk'

type PublicInsforgeClient = ReturnType<typeof createClient>

let client: PublicInsforgeClient | null = null

export function getPublicInsforgeEnv(): {
  baseUrl: string | undefined
  anonKey: string | undefined
} {
  return {
    baseUrl: import.meta.env.VITE_INSFORGE_URL as string | undefined,
    anonKey: import.meta.env.VITE_INSFORGE_ANON_KEY as string | undefined,
  }
}

/** Public anon client only. Never accept admin/service keys here. */
export function getInsforgeClient(): PublicInsforgeClient {
  if (client) return client
  const { baseUrl, anonKey } = getPublicInsforgeEnv()
  if (!baseUrl || !anonKey) {
    throw new Error(
      'Missing VITE_INSFORGE_URL or VITE_INSFORGE_ANON_KEY for InsForge Auth.',
    )
  }
  client = createClient({ baseUrl, anonKey })
  return client
}

export function resetInsforgeClientForTests(): void {
  client = null
}

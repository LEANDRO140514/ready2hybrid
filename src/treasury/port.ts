import { getInsforgeClient } from '../lib/insforge/client'
import { postProjectFunction } from '../lib/insforge/project-function'
import type { TreasuryBooks } from './books'

type TreasuryResponse = { ok: boolean; error?: string; books?: TreasuryBooks }

export async function loadTreasury(): Promise<TreasuryBooks> {
  const data = await postProjectFunction<TreasuryResponse>(getInsforgeClient(), 'ops-treasury', {
    intent: 'snapshot',
  })
  if (!data.ok || !data.books) throw new Error(data.error ?? 'No se pudo leer tesorería.')
  return data.books
}

export async function saveTreasury(body: Record<string, unknown>): Promise<void> {
  const data = await postProjectFunction<TreasuryResponse>(getInsforgeClient(), 'ops-treasury', body)
  if (!data.ok) throw new Error(data.error ?? 'REJECTED')
}

import {
  createPartner,
  setPartnerActive,
  updatePartner,
  type PartnerStore,
} from './admin.ts'
import type { CommunityPartner, PartnerProfile } from './contract.ts'
import type { PartnersPort } from './port.ts'

export function createMemoryPartnersPort(seed: CommunityPartner[] = []): PartnersPort & {
  store: PartnerStore
  logs: { action: string; code: string }[]
} {
  const rows = new Map(seed.map((partner) => [partner.code, { ...partner }]))
  const logs: { action: string; code: string }[] = []
  const store: PartnerStore = {
    async find(code) {
      const row = rows.get(code)
      return row ? { ...row } : null
    },
    async list() {
      return [...rows.values()].map((row) => ({ ...row }))
    },
    async insert(partner) {
      if (rows.has(partner.code)) throw new Error('CODE_TAKEN')
      rows.set(partner.code, { ...partner })
    },
    async updateProfile(code, profile) {
      const current = rows.get(code)
      if (!current) throw new Error('NOT_FOUND')
      rows.set(code, { ...current, ...profile })
    },
    async setActive(code, active) {
      const current = rows.get(code)
      if (!current) throw new Error('NOT_FOUND')
      rows.set(code, { ...current, active })
    },
    async log(entry) {
      logs.push({ action: entry.action, code: entry.code })
    },
  }
  return {
    store,
    logs,
    async list() {
      return store.list()
    },
    async create(profile: PartnerProfile, code: string) {
      const result = await createPartner(store, { ...profile, code }, new Date().toISOString())
      if (!result.ok) throw new Error(result.code)
      return result.value
    },
    async update(code, profile) {
      const result = await updatePartner(store, { ...profile, code })
      if (!result.ok) throw new Error(result.code)
      return result.value
    },
    async setActive(code, active) {
      const result = await setPartnerActive(store, { code, active })
      if (!result.ok) throw new Error(result.code)
      return result.value
    },
  }
}

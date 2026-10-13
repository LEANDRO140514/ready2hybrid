import {
  codeAcceptedOnNewCheckout,
  parseCreatePartner,
  parseSetActive,
  parseUpdatePartner,
  type CommunityPartner,
  type PartnerProfile,
  type PartnerReject,
} from './contract.ts'

export function roleMayAdministerPartners(role: unknown): role is 'OWNER' {
  return role === 'OWNER'
}

export type PartnerLogEntry = {
  action: 'PARTNER_CREATED' | 'PARTNER_UPDATED' | 'PARTNER_ACTIVATED' | 'PARTNER_DEACTIVATED'
  code: string
  metadata: Record<string, unknown>
}

export type PartnerStore = {
  find(code: string): Promise<CommunityPartner | null>
  list(): Promise<CommunityPartner[]>
  insert(partner: CommunityPartner): Promise<void>
  updateProfile(code: string, profile: PartnerProfile): Promise<void>
  setActive(code: string, active: boolean): Promise<void>
  log(entry: PartnerLogEntry): Promise<void>
}

export type PartnerResult<T> = { ok: true; value: T } | PartnerReject

function changedFields(current: PartnerProfile, next: PartnerProfile): string[] {
  const fields: (keyof PartnerProfile)[] = [
    'studioName',
    'contactName',
    'phone',
    'email',
  ]
  return fields.filter((field) => current[field] !== next[field])
}

export async function createPartner(
  store: PartnerStore,
  body: unknown,
  nowIso: string,
): Promise<PartnerResult<CommunityPartner>> {
  const parsed = parseCreatePartner(body)
  if (!parsed.ok) return parsed
  const existing = await store.find(parsed.code)
  if (existing) return { ok: false, status: 409, code: 'CODE_TAKEN' }
  const partner: CommunityPartner = {
    ...parsed.profile,
    code: parsed.code,
    active: true,
    createdAt: nowIso,
    locksLaunchPrice: true,
  }
  try {
    await store.insert(partner)
  } catch (error) {
    if (error instanceof Error && error.message === 'CODE_TAKEN') {
      return { ok: false, status: 409, code: 'CODE_TAKEN' }
    }
    throw error
  }
  await store.log({
    action: 'PARTNER_CREATED',
    code: partner.code,
    metadata: { active: true, locksLaunchPrice: true },
  })
  return { ok: true, value: partner }
}

export async function updatePartner(
  store: PartnerStore,
  body: unknown,
): Promise<PartnerResult<CommunityPartner>> {
  const parsed = parseUpdatePartner(body)
  if (!parsed.ok) return parsed
  const existing = await store.find(parsed.code)
  if (!existing) return { ok: false, status: 404, code: 'NOT_FOUND' }
  await store.updateProfile(parsed.code, parsed.profile)
  await store.log({
    action: 'PARTNER_UPDATED',
    code: parsed.code,
    metadata: { fields: changedFields(existing, parsed.profile) },
  })
  return {
    ok: true,
    value: {
      ...existing,
      ...parsed.profile,
    },
  }
}

/**
 * Active controls new checkouts only. This write does not receive orders,
 * so historical affiliate_code values stay where they are.
 */
export async function setPartnerActive(
  store: PartnerStore,
  body: unknown,
): Promise<PartnerResult<CommunityPartner>> {
  const parsed = parseSetActive(body)
  if (!parsed.ok) return parsed
  const existing = await store.find(parsed.code)
  if (!existing) return { ok: false, status: 404, code: 'NOT_FOUND' }
  await store.setActive(parsed.code, parsed.active)
  await store.log({
    action: parsed.active ? 'PARTNER_ACTIVATED' : 'PARTNER_DEACTIVATED',
    code: parsed.code,
    metadata: { active: parsed.active },
  })
  return { ok: true, value: { ...existing, active: parsed.active } }
}

export { codeAcceptedOnNewCheckout }

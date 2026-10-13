import { createContext, useContext, type ReactNode } from 'react'
import { createElement } from 'react'

import { getInsforgeClient } from '../lib/insforge/client'
import { postProjectFunction } from '../lib/insforge/project-function'
import type { CommunityPartner, PartnerProfile } from './contract.ts'

export type PartnerCommand =
  | { action: 'list' }
  | { action: 'create'; profile: PartnerProfile; code: string }
  | { action: 'update'; code: string; profile: PartnerProfile }
  | { action: 'set-active'; code: string; active: boolean }

export type PartnersPort = {
  list(): Promise<CommunityPartner[]>
  create(profile: PartnerProfile, code: string): Promise<CommunityPartner>
  update(code: string, profile: PartnerProfile): Promise<CommunityPartner>
  setActive(code: string, active: boolean): Promise<CommunityPartner>
}

const PartnersPortContext = createContext<PartnersPort | null>(null)

export function PartnersPortProvider({
  port,
  children,
}: {
  port: PartnersPort
  children: ReactNode
}) {
  return createElement(PartnersPortContext.Provider, { value: port }, children)
}

export function usePartnersPort(): PartnersPort {
  const port = useContext(PartnersPortContext)
  if (!port) throw new Error('usePartnersPort requires PartnersPortProvider')
  return port
}

function expectRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`La respuesta de partners no trae ${field}.`)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Campo de partner inválido: ${field}.`)
  return value
}

function displayText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function parsePartner(value: unknown): CommunityPartner {
  const row = expectRecord(value, 'partner')
  return {
    code: text(row.code, 'code'),
    studioName: text(row.studioName, 'studioName'),
    contactName: displayText(row.contactName),
    phone: displayText(row.phone),
    email: displayText(row.email),
    active: row.active === true,
    createdAt: text(row.createdAt, 'createdAt'),
    locksLaunchPrice: row.locksLaunchPrice !== false,
  }
}

async function post(body: PartnerCommand): Promise<unknown> {
  try {
    return await postProjectFunction(getInsforgeClient(), 'ops-partners', body)
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message
        ? error.message
        : 'No se pudo guardar el Community Partner.',
    )
  }
}

function partnerFromResponse(data: unknown): CommunityPartner {
  const row = expectRecord(data, 'respuesta')
  if (row.ok !== true) {
    throw new Error(typeof row.error === 'string' ? row.error : 'PARTNER_REJECTED')
  }
  return parsePartner(row.partner)
}

export function createEdgePartnersPort(): PartnersPort {
  return {
    async list() {
      const data = await post({ action: 'list' })
      const row = expectRecord(data, 'listado')
      if (!Array.isArray(row.partners)) throw new Error('La lectura de partners no trae el listado.')
      return row.partners.map(parsePartner)
    },
    async create(profile, code) {
      return partnerFromResponse(await post({ action: 'create', profile, code }))
    },
    async update(code, profile) {
      return partnerFromResponse(await post({ action: 'update', code, profile }))
    },
    async setActive(code, active) {
      return partnerFromResponse(await post({ action: 'set-active', code, active }))
    },
  }
}

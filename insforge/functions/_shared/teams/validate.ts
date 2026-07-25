import { z } from 'zod'
import { TeamRosterError } from './errors'

/** Opaque invitation token: inv_ + 32 lowercase hex (UUID entropy). */
export const INVITATION_TOKEN_PATTERN = /^inv_[0-9a-f]{32}$/

export function parseInvitationToken(raw: string | null | undefined): string {
  if (raw == null || raw === '') {
    throw new TeamRosterError('INVALID_TOKEN')
  }
  const token = raw.trim()
  if (!INVITATION_TOKEN_PATTERN.test(token)) {
    throw new TeamRosterError('INVALID_TOKEN')
  }
  return token
}

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1),
    idempotency_key: z.string().min(8).max(128),
    participant: z
      .object({
        public_ref: z.string().min(1).max(128).optional(),
      })
      .strict()
      .optional(),
    waiver: z
      .object({
        document_type: z.string().min(1).max(64),
        version: z.string().min(1).max(64),
        accepted: z.literal(true),
      })
      .strict(),
  })
  .strict()

export type AcceptInvitationRequest = z.infer<typeof acceptInvitationSchema>

const FORBIDDEN_CLIENT_KEYS = [
  'price',
  'price_cents',
  'amount',
  'team_size',
  'order_id',
  'team_id',
  'participant_id',
  'registration_id',
  'status',
  'roster_state',
] as const

export function assertNoClientAuthority(raw: unknown): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TeamRosterError('INVALID_REQUEST')
  }
  const obj = raw as Record<string, unknown>
  for (const key of FORBIDDEN_CLIENT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      throw new TeamRosterError('INVALID_REQUEST')
    }
  }
}

export function parseAcceptInvitationRequest(raw: unknown): AcceptInvitationRequest {
  assertNoClientAuthority(raw)
  const parsed = acceptInvitationSchema.safeParse(raw)
  if (!parsed.success) {
    throw new TeamRosterError('INVALID_REQUEST')
  }
  parseInvitationToken(parsed.data.token)
  return parsed.data
}

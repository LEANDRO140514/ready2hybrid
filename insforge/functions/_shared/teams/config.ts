import { TeamRosterError } from './errors'

export type TeamRosterRuntimeConfig = {
  corsOrigin: string | null
  waiverRequiredDocumentType: string | null
  waiverRequiredVersion: string | null
  idempotencyTtlSeconds: number
}

function requirePositiveInt(env: (k: string) => string | undefined, key: string): number {
  const raw = env(key)?.trim()
  if (!raw) throw new TeamRosterError('CONFIGURATION_ERROR')
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new TeamRosterError('CONFIGURATION_ERROR')
  return n
}

export function loadTeamRosterRuntimeConfig(
  env: (key: string) => string | undefined,
): TeamRosterRuntimeConfig {
  return {
    corsOrigin:
      env('TEAM_ROSTER_CORS_ORIGIN')?.trim() ||
      env('CHECKOUT_CORS_ORIGIN')?.trim() ||
      null,
    waiverRequiredDocumentType:
      env('CHECKOUT_WAIVER_DOCUMENT_TYPE')?.trim() ||
      env('TEAM_WAIVER_DOCUMENT_TYPE')?.trim() ||
      null,
    waiverRequiredVersion:
      env('CHECKOUT_WAIVER_VERSION')?.trim() ||
      env('TEAM_WAIVER_VERSION')?.trim() ||
      null,
    idempotencyTtlSeconds: (() => {
      try {
        return requirePositiveInt(env, 'TEAM_ROSTER_IDEMPOTENCY_TTL_SECONDS')
      } catch {
        try {
          return requirePositiveInt(env, 'CHECKOUT_IDEMPOTENCY_TTL_SECONDS')
        } catch {
          return 86400
        }
      }
    })(),
  }
}

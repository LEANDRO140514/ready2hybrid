export const OPENPAY_SANDBOX_API = 'https://sandbox-api.openpay.mx'
export const OPENPAY_PRODUCTION_API = 'https://api.openpay.mx'

export type OpenpayRuntime = {
  sandbox: boolean
  apiBase: typeof OPENPAY_SANDBOX_API | typeof OPENPAY_PRODUCTION_API
}

/** Sandbox certification stays on the sandbox host only. */
export function openpaySandboxEnabled(env: {
  OPENPAY_ENABLED?: string
  OPENPAY_SANDBOX?: string
}): boolean {
  return env.OPENPAY_ENABLED === 'true' && env.OPENPAY_SANDBOX === 'true'
}

/**
 * Production charges use api.openpay.mx when Openpay is enabled and the
 * sandbox flag is not true. Missing OPENPAY_ENABLED keeps every host closed.
 */
export function openpayRuntime(env: {
  OPENPAY_ENABLED?: string
  OPENPAY_SANDBOX?: string
}): OpenpayRuntime | null {
  if (env.OPENPAY_ENABLED !== 'true') return null
  if (env.OPENPAY_SANDBOX === 'true') {
    return { sandbox: true, apiBase: OPENPAY_SANDBOX_API }
  }
  return { sandbox: false, apiBase: OPENPAY_PRODUCTION_API }
}

export function openpayMsiEnabled(env: { OPENPAY_MSI_ENABLED?: string }): boolean {
  return env.OPENPAY_MSI_ENABLED === 'true'
}

/** New charges stay open unless this flag is explicitly false. The webhook ignores it. */
export function openpayNewChargesOpen(env: { OPENPAY_CHARGES_ENABLED?: string }): boolean {
  return env.OPENPAY_CHARGES_ENABLED !== 'false'
}

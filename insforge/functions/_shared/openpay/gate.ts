/** Both must be true. Production stays closed when either is unset. */
export function openpaySandboxEnabled(env: {
  OPENPAY_ENABLED?: string
  OPENPAY_SANDBOX?: string
}): boolean {
  return env.OPENPAY_ENABLED === 'true' && env.OPENPAY_SANDBOX === 'true'
}

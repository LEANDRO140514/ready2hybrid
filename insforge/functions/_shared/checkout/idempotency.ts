export const CHECKOUT_IDEMPOTENCY_SCOPE = 'OP-PUB-04'

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashIdempotencyKey(key: string): Promise<string> {
  return sha256Hex(`idempotency:${CHECKOUT_IDEMPOTENCY_SCOPE}:${key}`)
}

export async function fingerprintRequest(normalized: unknown): Promise<string> {
  return sha256Hex(JSON.stringify(normalized))
}

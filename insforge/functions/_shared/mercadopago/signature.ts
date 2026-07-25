/**
 * Mercado Pago webhook x-signature validation (official Without-SDK contract).
 * Manifest: id:{data.id};request-id:{x-request-id};ts:{ts};
 * data.id MUST be lowercased when alphanumeric uppercase is present.
 * Source: Mercado Pago Webhooks docs (Your integrations / Checkout Pro).
 */

export type SignatureParts = {
  ts: string
  v1: string
}

export type SignatureValidationInput = {
  xSignature: string | null | undefined
  xRequestId: string | null | undefined
  dataId: string | null | undefined
  secret: string
}

export type SignatureValidationResult =
  | { ok: true; parts: SignatureParts; manifest: string; dataIdNormalized: string }
  | { ok: false; reason: 'MISSING_SIGNATURE' | 'MALFORMED_SIGNATURE' | 'MISSING_REQUEST_ID' | 'MISSING_DATA_ID' | 'MISMATCH' }

export function parseXSignature(header: string | null | undefined): SignatureParts | null {
  if (!header || !header.trim()) return null
  const parts = Object.create(null) as Record<string, string>
  for (const segment of header.split(',')) {
    const idx = segment.indexOf('=')
    if (idx <= 0) continue
    const key = segment.slice(0, idx).trim()
    const value = segment.slice(idx + 1).trim()
    if (!key || !value) continue
    parts[key] = value
  }
  if (!parts.ts || !/^\d+$/.test(parts.ts)) return null
  if (!parts.v1 || !/^[a-fA-F0-9]{64}$/.test(parts.v1)) return null
  return { ts: parts.ts, v1: parts.v1.toLowerCase() }
}

export function normalizeDataId(dataId: string): string {
  return dataId.trim().toLowerCase()
}

export function buildManifest(dataIdNormalized: string, xRequestId: string, ts: string): string {
  return `id:${dataIdNormalized};request-id:${xRequestId};ts:${ts};`
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return out === 0
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function validateMercadoPagoWebhookSignature(
  input: SignatureValidationInput,
): Promise<SignatureValidationResult> {
  if (!input.xSignature?.trim()) {
    return { ok: false, reason: 'MISSING_SIGNATURE' }
  }
  if (!input.xRequestId?.trim()) {
    return { ok: false, reason: 'MISSING_REQUEST_ID' }
  }
  if (!input.dataId?.trim()) {
    return { ok: false, reason: 'MISSING_DATA_ID' }
  }

  const parts = parseXSignature(input.xSignature)
  if (!parts) {
    return { ok: false, reason: 'MALFORMED_SIGNATURE' }
  }

  const dataIdNormalized = normalizeDataId(input.dataId)
  const manifest = buildManifest(dataIdNormalized, input.xRequestId.trim(), parts.ts)
  const expected = await hmacSha256Hex(input.secret, manifest)
  if (!timingSafeEqualHex(expected, parts.v1)) {
    return { ok: false, reason: 'MISMATCH' }
  }

  return { ok: true, parts, manifest, dataIdNormalized }
}

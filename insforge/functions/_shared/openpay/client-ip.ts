const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const IPV6 = /^[0-9a-f:]+$/i

/**
 * InsForge sandbox appends a 3-address suffix to X-Forwarded-For:
 * the client the edge observed, a private hop, then the public edge.
 * A caller-supplied prefix is kept in front, so the leftmost address is not trusted.
 */
const PLATFORM_SUFFIX_LENGTH = 3

function ipv4Class(value: string): 'public' | 'private' | 'loopback' | null {
  if (!IPV4.test(value)) return null
  const [a, b] = value.split('.').map(Number)
  if (a === 0 || a === 127) return 'loopback'
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'private'
  return 'public'
}

function isClientAddress(value: string): boolean {
  if (ipv4Class(value) === 'public') return true
  if (!value.includes(':') || !IPV6.test(value) || value.length > 45) return false
  const lower = value.toLowerCase()
  return lower !== '::' && lower !== '::1'
}

function singleUsableAddress(raw: string | null): string | null {
  const value = raw?.trim() ?? ''
  if (!value || value.includes(',')) return null
  return isClientAddress(value) ? value : null
}

export function trustedForwardedFor(raw: string | null): string | null {
  if (!raw) return null
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length < PLATFORM_SUFFIX_LENGTH) return null
  const client = parts[parts.length - 3]
  const hop = parts[parts.length - 2]
  const edge = parts[parts.length - 1]
  if (ipv4Class(hop) !== 'private') return null
  if (ipv4Class(edge) !== 'public') return null
  if (!isClientAddress(client)) return null
  return client
}

/** Platform-observed client address. A browser body field is never read. */
export function trustedClientIp(headers: Headers): string | null {
  return trustedForwardedFor(headers.get('x-forwarded-for'))
    ?? singleUsableAddress(headers.get('cf-connecting-ip'))
    ?? singleUsableAddress(headers.get('x-real-ip'))
}

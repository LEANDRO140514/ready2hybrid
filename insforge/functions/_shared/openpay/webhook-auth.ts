export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function basicAuthMatches(header: string | null, user: string, password: string): boolean {
  if (!header?.startsWith('Basic ')) return false
  let decoded = ''
  try {
    decoded = atob(header.slice(6))
  } catch {
    return false
  }
  const split = decoded.indexOf(':')
  if (split < 0) return false
  return sameSecret(decoded.slice(0, split), user) && sameSecret(decoded.slice(split + 1), password)
}

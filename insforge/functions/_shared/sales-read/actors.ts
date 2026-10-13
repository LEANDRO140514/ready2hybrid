/** Display names for reconciliation actors. Never returns a raw auth id. */

export function actorLabel(user: Record<string, unknown>): string | null {
  const profile = user.profile
  const profileName =
    profile && typeof profile === 'object' && !Array.isArray(profile)
      ? text((profile as Record<string, unknown>).name)
      : null
  const name = text(user.name) ?? profileName
  const email = text(user.email)
  if (name && email) return `${name} · ${email}`
  return email ?? name
}

export function usersFromAuthList(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body.filter(isRecord)
  if (!isRecord(body)) return []
  for (const key of ['users', 'data', 'items']) {
    const value = body[key]
    if (Array.isArray(value)) return value.filter(isRecord)
  }
  return []
}

export function labelsForActors(
  users: Record<string, unknown>[],
  needed: ReadonlySet<string>,
): { id: string; label: string }[] {
  const labels: { id: string; label: string }[] = []
  for (const user of users) {
    const id = text(user.id)
    if (!id || !needed.has(id)) continue
    const label = actorLabel(user)
    if (label) labels.push({ id, label })
  }
  return labels
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

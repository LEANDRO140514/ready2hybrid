import { OPERATIONAL_ROLES, type OperationalRole } from './types'

const ROLE_SET = new Set<string>(OPERATIONAL_ROLES)

export function isOperationalRole(value: unknown): value is OperationalRole {
  return typeof value === 'string' && ROLE_SET.has(value)
}

/**
 * Routes that require an operational role. Deny-by-default for unknown roles.
 * `/ops/finance` is read-only sales control. FINANCE is not a door assignment:
 * it does not enter check-in, desk, or Community Partners admin.
 * `/ops/partners` is OWNER only. OPERATIONS_MANAGER keeps only the routes
 * it already had.
 */
export const ROUTE_ROLE_POLICY = {
  '/ops/checkin': ['OWNER', 'OPERATIONS_MANAGER', 'CHECKIN_STAFF'] as const,
  '/ops/desk': ['OWNER', 'OPERATIONS_MANAGER', 'SOLUTION_DESK'] as const,
  '/ops/finance': ['OWNER', 'FINANCE'] as const,
  '/ops/partners': ['OWNER'] as const,
} as const

export type ProtectedOpsPath = keyof typeof ROUTE_ROLE_POLICY

/** Finance readers are not tied to a door shift. The server allowlist is the grant. */
export function routeRequiresAssignment(path: ProtectedOpsPath): boolean {
  return path !== '/ops/finance' && path !== '/ops/partners'
}

export function roleAllowsPath(
  role: OperationalRole | null,
  path: ProtectedOpsPath,
): boolean {
  if (!role) return false
  return (ROUTE_ROLE_POLICY[path] as readonly OperationalRole[]).includes(role)
}

/** CHECKIN_STAFF must never see complete financial or medical detail surfaces. */
export function checkinStaffProhibitedDataClasses(): readonly string[] {
  return ['complete_financial_records', 'medical_detail', 'emergency_contact_detail']
}

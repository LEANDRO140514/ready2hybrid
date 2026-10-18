/** Reception list. No amounts. FINANCE stays on Ventas. */
export function roleMayReadAccess(
  role: unknown,
): role is 'OWNER' | 'OPERATIONS_MANAGER' | 'CHECKIN_STAFF' {
  return role === 'OWNER' || role === 'OPERATIONS_MANAGER' || role === 'CHECKIN_STAFF'
}

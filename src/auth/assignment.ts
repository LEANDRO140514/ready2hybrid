import type { OperationalAssignment } from './types'

export function isAssignmentValidAt(
  assignment: OperationalAssignment,
  nowIso: string = new Date().toISOString(),
): boolean {
  const now = Date.parse(nowIso)
  const from = Date.parse(assignment.validFrom)
  const to = Date.parse(assignment.validTo)
  if (Number.isNaN(now) || Number.isNaN(from) || Number.isNaN(to)) return false
  return now >= from && now <= to
}

export type AssignmentMatchInput = {
  eventId?: string
  eventDayId?: string
  doorOrAreaId?: string
}

export function assignmentMatchesScope(
  assignment: OperationalAssignment,
  scope: AssignmentMatchInput,
): boolean {
  if (scope.eventId && assignment.eventId !== scope.eventId) return false
  if (scope.eventDayId && assignment.eventDayId !== scope.eventDayId) return false
  if (scope.doorOrAreaId && assignment.doorOrAreaId !== scope.doorOrAreaId) {
    return false
  }
  return true
}

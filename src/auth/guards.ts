import {
  assignmentMatchesScope,
  isAssignmentValidAt,
  type AssignmentMatchInput,
} from './assignment'
import { roleAllowsPath, type ProtectedOpsPath } from './roles'
import type {
  AuthSession,
  AuthorizationDecision,
  OperationalAssignment,
  OperationalRole,
} from './types'

export type GuardInput = {
  session: AuthSession
  role: OperationalRole | null
  roleResolved: boolean
  assignment: OperationalAssignment | null
  assignmentResolved: boolean
  path: ProtectedOpsPath
  scope?: AssignmentMatchInput
  nowIso?: string
  requireAssignment?: boolean
}

/**
 * Deny-by-default operational access decision.
 * Authentication may succeed while role/assignment remain unresolved (T2-2).
 */
export function evaluateOperationalAccess(
  input: GuardInput,
): AuthorizationDecision {
  if (input.session.status === 'loading') {
    return { outcome: 'deny', reason: 'session_loading' }
  }
  if (input.session.status === 'error') {
    return { outcome: 'deny', reason: 'session_error' }
  }
  if (input.session.status !== 'authenticated' || !input.session.user) {
    return { outcome: 'deny', reason: 'no_session' }
  }
  if (!input.roleResolved || !input.role) {
    return { outcome: 'deny', reason: 'role_unresolved' }
  }
  if (!roleAllowsPath(input.role, input.path)) {
    return { outcome: 'deny', reason: 'role_denied' }
  }

  const requireAssignment = input.requireAssignment ?? true
  if (requireAssignment) {
    if (!input.assignmentResolved || !input.assignment) {
      return { outcome: 'deny', reason: 'assignment_unresolved' }
    }
    if (!isAssignmentValidAt(input.assignment, input.nowIso)) {
      return { outcome: 'deny', reason: 'assignment_expired' }
    }
    if (
      input.scope &&
      !assignmentMatchesScope(input.assignment, input.scope)
    ) {
      return { outcome: 'deny', reason: 'assignment_mismatch' }
    }
  }

  return { outcome: 'allow', reason: 'authorized' }
}

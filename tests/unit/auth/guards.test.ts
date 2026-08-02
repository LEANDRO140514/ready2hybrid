import { describe, expect, it } from 'vitest'

import { evaluateOperationalAccess } from '../../../src/auth/guards'
import type { AuthSession, OperationalAssignment } from '../../../src/auth/types'

const authed: AuthSession = {
  status: 'authenticated',
  user: { id: 'u1', email: 'op@example.com' },
  errorMessage: null,
}

const assignment: OperationalAssignment = {
  operatorId: 'u1',
  role: 'CHECKIN_STAFF',
  eventId: 'evt',
  eventDayId: 'day1',
  doorOrAreaId: 'gate-a',
  validFrom: '2026-01-01T00:00:00.000Z',
  validTo: '2099-01-01T00:00:00.000Z',
  sourceVersion: 'test',
}

describe('evaluateOperationalAccess', () => {
  it('denies when session is absent', () => {
    const decision = evaluateOperationalAccess({
      session: { status: 'unauthenticated', user: null, errorMessage: null },
      role: 'CHECKIN_STAFF',
      roleResolved: true,
      assignment,
      assignmentResolved: true,
      path: '/ops/checkin',
    })
    expect(decision).toEqual({ outcome: 'deny', reason: 'no_session' })
  })

  it('denies when session is loading', () => {
    const decision = evaluateOperationalAccess({
      session: { status: 'loading', user: null, errorMessage: null },
      role: null,
      roleResolved: false,
      assignment: null,
      assignmentResolved: false,
      path: '/ops/checkin',
    })
    expect(decision).toEqual({ outcome: 'deny', reason: 'session_loading' })
  })

  it('denies unknown or unresolved role by default', () => {
    const decision = evaluateOperationalAccess({
      session: authed,
      role: null,
      roleResolved: true,
      assignment,
      assignmentResolved: true,
      path: '/ops/checkin',
    })
    expect(decision).toEqual({ outcome: 'deny', reason: 'role_unresolved' })
  })

  it('denies role that cannot access the path', () => {
    const decision = evaluateOperationalAccess({
      session: authed,
      role: 'SOLUTION_DESK',
      roleResolved: true,
      assignment: { ...assignment, role: 'SOLUTION_DESK' },
      assignmentResolved: true,
      path: '/ops/checkin',
    })
    expect(decision).toEqual({ outcome: 'deny', reason: 'role_denied' })
  })

  it('denies when assignment is unresolved', () => {
    const decision = evaluateOperationalAccess({
      session: authed,
      role: 'CHECKIN_STAFF',
      roleResolved: true,
      assignment: null,
      assignmentResolved: true,
      path: '/ops/checkin',
    })
    expect(decision).toEqual({
      outcome: 'deny',
      reason: 'assignment_unresolved',
    })
  })

  it('denies expired assignment', () => {
    const decision = evaluateOperationalAccess({
      session: authed,
      role: 'CHECKIN_STAFF',
      roleResolved: true,
      assignment: {
        ...assignment,
        validFrom: '2020-01-01T00:00:00.000Z',
        validTo: '2020-01-02T00:00:00.000Z',
      },
      assignmentResolved: true,
      path: '/ops/checkin',
      nowIso: '2026-07-31T12:00:00.000Z',
    })
    expect(decision).toEqual({ outcome: 'deny', reason: 'assignment_expired' })
  })

  it('allows authorized check-in staff with valid assignment', () => {
    const decision = evaluateOperationalAccess({
      session: authed,
      role: 'CHECKIN_STAFF',
      roleResolved: true,
      assignment,
      assignmentResolved: true,
      path: '/ops/checkin',
      nowIso: '2026-07-31T12:00:00.000Z',
    })
    expect(decision).toEqual({ outcome: 'allow', reason: 'authorized' })
  })

  it('denies assignment scope mismatch', () => {
    const decision = evaluateOperationalAccess({
      session: authed,
      role: 'CHECKIN_STAFF',
      roleResolved: true,
      assignment,
      assignmentResolved: true,
      path: '/ops/checkin',
      scope: { eventId: 'other-event' },
      nowIso: '2026-07-31T12:00:00.000Z',
    })
    expect(decision).toEqual({
      outcome: 'deny',
      reason: 'assignment_mismatch',
    })
  })
})

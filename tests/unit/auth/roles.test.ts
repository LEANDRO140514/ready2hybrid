import { describe, expect, it } from 'vitest'

import {
  checkinStaffProhibitedDataClasses,
  isOperationalRole,
  roleAllowsPath,
  routeRequiresAssignment,
} from '../../../src/auth/roles'

describe('roles', () => {
  it('accepts only known operational roles', () => {
    expect(isOperationalRole('CHECKIN_STAFF')).toBe(true)
    expect(isOperationalRole('FINANCE')).toBe(true)
    expect(isOperationalRole('OWNER')).toBe(true)
    expect(isOperationalRole(null)).toBe(false)
  })

  it('applies path role policy', () => {
    expect(roleAllowsPath('CHECKIN_STAFF', '/ops/checkin')).toBe(true)
    expect(roleAllowsPath('CHECKIN_STAFF', '/ops/desk')).toBe(false)
    expect(roleAllowsPath('CHECKIN_STAFF', '/ops/finance')).toBe(false)
    expect(roleAllowsPath('SOLUTION_DESK', '/ops/desk')).toBe(true)
    expect(roleAllowsPath('SOLUTION_DESK', '/ops/finance')).toBe(false)
    expect(roleAllowsPath('OPERATIONS_MANAGER', '/ops/checkin')).toBe(true)
    expect(roleAllowsPath('OPERATIONS_MANAGER', '/ops/finance')).toBe(false)
    expect(roleAllowsPath('FINANCE', '/ops/finance')).toBe(true)
    expect(roleAllowsPath('FINANCE', '/ops/checkin')).toBe(false)
    expect(roleAllowsPath('FINANCE', '/ops/desk')).toBe(false)
    expect(roleAllowsPath('OWNER', '/ops/finance')).toBe(true)
    expect(roleAllowsPath('OWNER', '/ops/partners')).toBe(true)
    expect(roleAllowsPath('FINANCE', '/ops/partners')).toBe(false)
    expect(roleAllowsPath('CHECKIN_STAFF', '/ops/partners')).toBe(false)
    expect(roleAllowsPath('OPERATIONS_MANAGER', '/ops/partners')).toBe(false)
    expect(roleAllowsPath('SOLUTION_DESK', '/ops/partners')).toBe(false)
    expect(routeRequiresAssignment('/ops/finance')).toBe(false)
    expect(routeRequiresAssignment('/ops/partners')).toBe(false)
    expect(routeRequiresAssignment('/ops/checkin')).toBe(true)
  })

  it('lists prohibited data classes for CHECKIN_STAFF', () => {
    expect(checkinStaffProhibitedDataClasses()).toContain(
      'complete_financial_records',
    )
    expect(checkinStaffProhibitedDataClasses()).toContain('medical_detail')
  })
})

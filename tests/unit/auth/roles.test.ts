import { describe, expect, it } from 'vitest'

import {
  checkinStaffProhibitedDataClasses,
  isOperationalRole,
  roleAllowsPath,
} from '../../../src/auth/roles'

describe('roles', () => {
  it('accepts only known operational roles', () => {
    expect(isOperationalRole('CHECKIN_STAFF')).toBe(true)
    expect(isOperationalRole('FINANCE')).toBe(false)
    expect(isOperationalRole(null)).toBe(false)
  })

  it('applies path role policy', () => {
    expect(roleAllowsPath('CHECKIN_STAFF', '/ops/checkin')).toBe(true)
    expect(roleAllowsPath('CHECKIN_STAFF', '/ops/desk')).toBe(false)
    expect(roleAllowsPath('SOLUTION_DESK', '/ops/desk')).toBe(true)
  })

  it('lists prohibited data classes for CHECKIN_STAFF', () => {
    expect(checkinStaffProhibitedDataClasses()).toContain(
      'complete_financial_records',
    )
    expect(checkinStaffProhibitedDataClasses()).toContain('medical_detail')
  })
})

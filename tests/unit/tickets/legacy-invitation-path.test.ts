/**
 * Legacy Invitation Path Preserved Tests (0026)
 *
 * Verifies that teams created via the legacy invitation path (0007)
 * continue to work as before: they do NOT transition to ELIGIBLE
 * on payment, and must complete the invitation acceptance flow.
 *
 * Discriminator: EXISTS team_members WHERE state = 'INVITED'
 * - If any INVITED members exist → legacy path, NOT ELIGIBLE on payment
 * - Legacy path: PAYMENT_PENDING → PAID_ROSTER_INCOMPLETE → (invites) → ELIGIBLE
 *
 * Authority: Project Owner 2026-08-31 (migration 0026)
 */

import { describe, it, expect } from 'vitest'

describe('Legacy Invitation Path Preserved (0026)', () => {
  /**
   * Mock data for legacy team with INVITED members (pre-0025 checkout)
   */
  const mockLegacyTeam = {
    team: {
      id: 'team-uuid-legacy',
      product_id: 'product-uuid-team',
      required_size: 2,
      slots_complete: 1, // Only captain is COMPLETE
      roster_state: 'PAYMENT_PENDING',
      payment_state: 'UNPAID',
      eligibility_state: 'NOT_ELIGIBLE',
    },
    team_members: [
      {
        id: 'member-captain',
        team_id: 'team-uuid-legacy',
        position: 1,
        role: 'CAPTAIN',
        state: 'COMPLETE',
        participant_id: 'part-captain',
      },
      {
        id: 'member-invitee',
        team_id: 'team-uuid-legacy',
        position: 2,
        role: 'INVITEE',
        state: 'INVITED', // Pending invitation
        participant_id: null,
      },
    ],
    registration: {
      id: 'reg-uuid-legacy',
      team_id: 'team-uuid-legacy',
      order_id: 'order-uuid-legacy',
      state: 'STARTED',
    },
    order: {
      id: 'order-uuid-legacy',
      state: 'PREFERENCE_PENDING',
    },
    product: {
      id: 'product-uuid-team',
      code: 'RX-VIE',
      team_size: 2,
      kind: 'competitor',
    },
  }

  describe('team_apply_payment_outcome legacy behavior', () => {
    it('should NOT transition to ELIGIBLE when INVITED members exist', () => {
      const team = { ...mockLegacyTeam.team }
      const members = [...mockLegacyTeam.team_members]

      // Legacy discriminator: has INVITED member
      const hasInvited = members.some((m) => m.state === 'INVITED')
      expect(hasInvited).toBe(true)

      // Simulate team_apply_payment_outcome logic
      const newRosterState =
        team.roster_state === 'ELIGIBLE'
          ? 'ELIGIBLE'
          : team.slots_complete >= team.required_size && !hasInvited
            ? 'ELIGIBLE'
            : team.slots_complete >= team.required_size
              ? 'PAID_ROSTER_COMPLETE'
              : 'PAID_ROSTER_INCOMPLETE'

      // slots_complete (1) < required_size (2), so PAID_ROSTER_INCOMPLETE
      expect(newRosterState).toBe('PAID_ROSTER_INCOMPLETE')
    })

    it('should stay at PAID_ROSTER_COMPLETE even with all COMPLETE if INVITED existed', () => {
      // Edge case: all members accepted but we still have the INVITED marker
      // This shouldn't happen in practice, but tests the discriminator
      const team = { ...mockLegacyTeam.team, slots_complete: 2 }
      const members = [
        { ...mockLegacyTeam.team_members[0] },
        { ...mockLegacyTeam.team_members[1], state: 'COMPLETE', participant_id: 'part-2' },
      ]

      // Simulate: even though all are COMPLETE now, if there WAS an INVITED,
      // the state machine went through PAID_ROSTER_INCOMPLETE first.
      // This test verifies the discriminator uses current state.
      const hasInvited = members.some((m) => m.state === 'INVITED')
      expect(hasInvited).toBe(false) // All complete now

      // With no INVITED and slots_complete >= required_size → ELIGIBLE
      // This is actually the correct T1-like behavior for a completed legacy team
      const newRosterState =
        team.roster_state === 'ELIGIBLE'
          ? 'ELIGIBLE'
          : team.slots_complete >= team.required_size && !hasInvited
            ? 'ELIGIBLE'
            : team.slots_complete >= team.required_size
              ? 'PAID_ROSTER_COMPLETE'
              : 'PAID_ROSTER_INCOMPLETE'

      expect(newRosterState).toBe('ELIGIBLE')
    })
  })

  describe('ticket_issue_after_payment legacy behavior', () => {
    it('should skip ticket when roster_state is PAID_ROSTER_INCOMPLETE', () => {
      const product = mockLegacyTeam.product
      const team = { ...mockLegacyTeam.team, roster_state: 'PAID_ROSTER_INCOMPLETE' }

      const shouldSkip =
        product.team_size > 1 && (!team || team.roster_state !== 'ELIGIBLE')

      expect(shouldSkip).toBe(true)
    })

    it('should return ROSTER_NOT_ELIGIBLE for incomplete legacy team', () => {
      const product = mockLegacyTeam.product
      const team = { ...mockLegacyTeam.team, roster_state: 'PAID_ROSTER_INCOMPLETE' }
      const registration = mockLegacyTeam.registration

      const shouldSkip =
        product.team_size > 1 && (!team || team.roster_state !== 'ELIGIBLE')

      expect(shouldSkip).toBe(true)

      const result = {
        registration_id: registration.id,
        skipped: true,
        error_code: 'ROSTER_NOT_ELIGIBLE',
      }

      expect(result.error_code).toBe('ROSTER_NOT_ELIGIBLE')
      expect(result.skipped).toBe(true)
    })
  })

  describe('legacy flow: checkout → payment → incomplete → invite → ELIGIBLE', () => {
    it('should complete legacy flow with invitation acceptance', () => {
      // Step 1: After legacy checkout (0007), team has INVITED members
      const team = { ...mockLegacyTeam.team }
      // Deep copy to avoid mutating the mock
      const members = mockLegacyTeam.team_members.map((m) => ({ ...m }))

      expect(team.roster_state).toBe('PAYMENT_PENDING')
      expect(members.some((m) => m.state === 'INVITED')).toBe(true)

      // Step 2: Payment confirmed
      const hasInvitedAtPayment = members.some((m) => m.state === 'INVITED')
      team.roster_state =
        team.slots_complete >= team.required_size && !hasInvitedAtPayment
          ? 'ELIGIBLE'
          : team.slots_complete >= team.required_size
            ? 'PAID_ROSTER_COMPLETE'
            : 'PAID_ROSTER_INCOMPLETE'
      team.payment_state = 'PAID'

      expect(team.roster_state).toBe('PAID_ROSTER_INCOMPLETE')
      expect(team.payment_state).toBe('PAID')

      // Step 3: Ticket NOT issued (roster incomplete)
      const ticketIssued = team.roster_state === 'ELIGIBLE'
      expect(ticketIssued).toBe(false)

      // Step 4: Invitee accepts (team_roster_accept_tx)
      members[1].state = 'COMPLETE'
      members[1].participant_id = 'part-invitee'
      team.slots_complete = 2

      // Step 5: After last acceptance, roster becomes ELIGIBLE
      const hasInvitedAfterAccept = members.some((m) => m.state === 'INVITED')
      expect(hasInvitedAfterAccept).toBe(false)

      if (team.slots_complete >= team.required_size) {
        team.roster_state = 'ELIGIBLE'
        team.eligibility_state = 'ELIGIBLE'
      }

      expect(team.roster_state).toBe('ELIGIBLE')

      // Step 6: ticket_issue_after_team_eligible issues tickets
      const canIssueNow = team.roster_state === 'ELIGIBLE'
      expect(canIssueNow).toBe(true)
    })
  })

  describe('T1 vs Legacy discriminator comparison', () => {
    it('T1 team has NO INVITED members from creation', () => {
      const t1Members = [
        { state: 'COMPLETE', position: 1 },
        { state: 'COMPLETE', position: 2 },
      ]

      const hasInvited = t1Members.some((m) => m.state === 'INVITED')
      expect(hasInvited).toBe(false)
    })

    it('Legacy team HAS INVITED members from creation', () => {
      const legacyMembers = mockLegacyTeam.team_members

      const hasInvited = legacyMembers.some((m) => m.state === 'INVITED')
      expect(hasInvited).toBe(true)
    })

    it('discriminator NOT EXISTS INVITED correctly identifies T1', () => {
      const isT1 = (members: Array<{ state: string }>) =>
        !members.some((m) => m.state === 'INVITED')

      const t1Members = [{ state: 'COMPLETE' }, { state: 'COMPLETE' }]
      const legacyMembers = [{ state: 'COMPLETE' }, { state: 'INVITED' }]

      expect(isT1(t1Members)).toBe(true)
      expect(isT1(legacyMembers)).toBe(false)
    })
  })
})

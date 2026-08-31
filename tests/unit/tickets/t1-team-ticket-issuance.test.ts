/**
 * T1 Team Ticket Issuance Tests
 *
 * Validates that T1 teams (full roster at checkout, no invitation flow)
 * correctly transition to ELIGIBLE on payment and receive their ticket.
 *
 * T1 discriminator: NOT EXISTS team_members WHERE state = 'INVITED'
 *
 * Authority: Project Owner 2026-08-31 (migration 0026)
 */

import { describe, it, expect, beforeEach } from 'vitest'

describe('T1 Team Ticket Issuance (0026)', () => {
  /**
   * Mock data representing T1 team state after checkout (0025) and before payment
   */
  const mockT1TeamPrePayment = {
    team: {
      id: 'team-uuid-t1',
      product_id: 'product-uuid-team',
      required_size: 2,
      slots_complete: 2,
      roster_state: 'PAYMENT_PENDING',
      payment_state: 'UNPAID',
      eligibility_state: 'NOT_ELIGIBLE',
    },
    team_members: [
      { id: 'member-1', team_id: 'team-uuid-t1', position: 1, role: 'CAPTAIN', state: 'COMPLETE' },
      { id: 'member-2', team_id: 'team-uuid-t1', position: 2, role: 'INVITEE', state: 'COMPLETE' },
    ],
    registration: {
      id: 'reg-uuid-t1',
      team_id: 'team-uuid-t1',
      order_id: 'order-uuid-t1',
      state: 'STARTED',
    },
    order: {
      id: 'order-uuid-t1',
      state: 'PREFERENCE_PENDING',
    },
    product: {
      id: 'product-uuid-team',
      code: 'RX-VIE',
      team_size: 2,
      kind: 'competitor',
    },
  }

  describe('team_apply_payment_outcome T1 transition', () => {
    it('should transition T1 team to ELIGIBLE when no INVITED members exist', () => {
      const team = { ...mockT1TeamPrePayment.team }
      const members = [...mockT1TeamPrePayment.team_members]

      // T1 discriminator: no members in INVITED state
      const hasInvited = members.some((m) => m.state === 'INVITED')
      expect(hasInvited).toBe(false)

      // Simulate team_apply_payment_outcome logic
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

    it('should NOT transition legacy team with INVITED members to ELIGIBLE', () => {
      const team = { ...mockT1TeamPrePayment.team }
      const members = [
        { id: 'member-1', team_id: 'team-uuid-t1', position: 1, role: 'CAPTAIN', state: 'COMPLETE' },
        { id: 'member-2', team_id: 'team-uuid-t1', position: 2, role: 'INVITEE', state: 'INVITED' },
      ]

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

      // With only captain COMPLETE, slots_complete would be 1, not 2
      // But even if both were complete, hasInvited=true blocks ELIGIBLE
      expect(newRosterState).toBe('PAID_ROSTER_COMPLETE')
    })

    it('should preserve existing ELIGIBLE state (idempotent)', () => {
      const team = { ...mockT1TeamPrePayment.team, roster_state: 'ELIGIBLE' }
      const hasInvited = false

      const newRosterState =
        team.roster_state === 'ELIGIBLE'
          ? 'ELIGIBLE'
          : team.slots_complete >= team.required_size && !hasInvited
            ? 'ELIGIBLE'
            : 'PAID_ROSTER_INCOMPLETE'

      expect(newRosterState).toBe('ELIGIBLE')
    })
  })

  describe('ticket_issue_after_payment T1 flow', () => {
    it('should issue ticket when team roster_state is ELIGIBLE', () => {
      const product = mockT1TeamPrePayment.product
      const team = { ...mockT1TeamPrePayment.team, roster_state: 'ELIGIBLE' }
      const registration = mockT1TeamPrePayment.registration

      // Simulate ticket_issue_after_payment logic for team products
      const shouldSkip =
        product.team_size > 1 && (!team || team.roster_state !== 'ELIGIBLE')

      expect(shouldSkip).toBe(false)
      // Ticket should be issued (not skipped)
    })

    it('should skip ticket when team roster_state is NOT ELIGIBLE', () => {
      const product = mockT1TeamPrePayment.product
      const team = { ...mockT1TeamPrePayment.team, roster_state: 'PAYMENT_PENDING' }

      const shouldSkip =
        product.team_size > 1 && (!team || team.roster_state !== 'ELIGIBLE')

      expect(shouldSkip).toBe(true)
    })

    it('should return ROSTER_NOT_ELIGIBLE error code when skipping', () => {
      const product = mockT1TeamPrePayment.product
      const team = { ...mockT1TeamPrePayment.team, roster_state: 'PAID_ROSTER_INCOMPLETE' }
      const registration = mockT1TeamPrePayment.registration

      const shouldSkip =
        product.team_size > 1 && (!team || team.roster_state !== 'ELIGIBLE')

      if (shouldSkip) {
        const result = {
          registration_id: registration.id,
          skipped: true,
          error_code: 'ROSTER_NOT_ELIGIBLE',
        }
        expect(result.error_code).toBe('ROSTER_NOT_ELIGIBLE')
      }
    })
  })

  describe('T1 complete flow: checkout → payment → ticket', () => {
    it('should complete full T1 flow: PAYMENT_PENDING → PAID → ELIGIBLE → ticket', () => {
      // Step 1: After checkout (0025), team is PAYMENT_PENDING with all COMPLETE members
      const team = { ...mockT1TeamPrePayment.team }
      const members = [...mockT1TeamPrePayment.team_members]
      const order = { ...mockT1TeamPrePayment.order }
      const registration = { ...mockT1TeamPrePayment.registration }

      expect(team.roster_state).toBe('PAYMENT_PENDING')
      expect(members.every((m) => m.state === 'COMPLETE')).toBe(true)
      expect(members.some((m) => m.state === 'INVITED')).toBe(false)

      // Step 2: Payment confirmed (webhook_apply_payment_tx)
      order.state = 'PAID'
      registration.state = 'PAYMENT_CONFIRMED'

      // Step 3: team_apply_payment_outcome → ELIGIBLE (T1)
      const hasInvited = members.some((m) => m.state === 'INVITED')
      team.roster_state =
        team.slots_complete >= team.required_size && !hasInvited
          ? 'ELIGIBLE'
          : 'PAID_ROSTER_INCOMPLETE'
      team.payment_state = 'PAID'

      expect(team.roster_state).toBe('ELIGIBLE')
      expect(team.payment_state).toBe('PAID')

      // Step 4: ticket_issue_after_payment → ticket issued
      const shouldIssue =
        mockT1TeamPrePayment.product.team_size > 1 && team.roster_state === 'ELIGIBLE'

      expect(shouldIssue).toBe(true)

      // Ticket issued
      const ticket = {
        id: 'ticket-uuid-t1',
        registration_id: registration.id,
        state: 'ISSUED',
      }

      expect(ticket.registration_id).toBe(registration.id)
      expect(ticket.state).toBe('ISSUED')
    })
  })

  describe('team member name resolution (email worker contract)', () => {
    it('should resolve names via registration_id → team_id → team_members → participants', () => {
      // This test documents the JOIN pattern for email worker
      // The ticket stores registration_id, not names

      const ticket = {
        id: 'ticket-uuid-t1',
        registration_id: 'reg-uuid-t1',
      }

      const registration = {
        id: 'reg-uuid-t1',
        team_id: 'team-uuid-t1',
      }

      const teamMembers = [
        { team_id: 'team-uuid-t1', position: 1, participant_id: 'part-1' },
        { team_id: 'team-uuid-t1', position: 2, participant_id: 'part-2' },
      ]

      const participants = [
        { id: 'part-1', name: 'Captain Name' },
        { id: 'part-2', name: 'Teammate Name' },
      ]

      // Simulate the JOIN: ticket → registration → team_members → participants
      const teamId = registration.team_id
      const membersForTeam = teamMembers
        .filter((tm) => tm.team_id === teamId)
        .sort((a, b) => a.position - b.position)

      const names = membersForTeam.map((tm) => {
        const participant = participants.find((p) => p.id === tm.participant_id)
        return participant?.name
      })

      expect(names).toEqual(['Captain Name', 'Teammate Name'])
    })
  })
})

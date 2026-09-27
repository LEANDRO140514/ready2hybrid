import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'insforge/migrations/0035_ticket-issuance-without-digital-waiver.sql',
  'utf8',
)
const ticketStart = migration.indexOf(
  'CREATE OR REPLACE FUNCTION public.ticket_issue_one_registration(p_registration_id uuid)',
)
const ticketFn = migration.slice(ticketStart)

describe('ticket issuance does not require a digital waiver', () => {
  it('removes the individual waiver gate from the successor function', () => {
    expect(ticketFn).not.toContain('WAIVER_REQUIRED')
    expect(ticketFn).not.toContain('FROM public.waiver_acceptances')
    expect(ticketFn).toContain("'ORDER_NOT_PAID'")
    expect(ticketFn).toContain("'ROSTER_NOT_ELIGIBLE'")
    expect(ticketFn).toContain("'MEMBER_NOT_COMPLETE'")
    expect(ticketFn).toContain("'TICKET_READY'")
  })

  it('keeps a supplied digital waiver optional and does not use it as the captain slot', () => {
    expect(migration).toContain('INSERT INTO public.waiver_acceptances')
    expect(migration).toContain("v_captain_member_state text := 'COMPLETE'")
    expect(migration).not.toContain("v_captain_member_state := 'COMPLETE'")
  })

  it('states that a ticket is not a waiver acceptance', () => {
    expect(migration).toContain('Ticket issued is not waiver accepted')
    expect(migration).toContain('kit pickup')
  })
})

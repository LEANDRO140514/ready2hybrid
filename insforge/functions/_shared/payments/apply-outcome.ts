/**
 * Applying an approved charge to an order that is already PAID does not
 * emit another ticket, email, or revenue row. A later event cannot move
 * a PAID order back to pending or rejected.
 */

export type ApplyDecision = {
  outcome: 'PAID' | 'ALREADY_PAID' | 'IGNORED'
  issueTicket: boolean
  sendEmail: boolean
  countRevenue: boolean
  regressPaid: boolean
}

export function applyApprovedCharge(orderState: string): ApplyDecision {
  if (orderState === 'PAID') {
    return {
      outcome: 'ALREADY_PAID',
      issueTicket: false,
      sendEmail: false,
      countRevenue: false,
      regressPaid: false,
    }
  }
  return {
    outcome: 'PAID',
    issueTicket: true,
    sendEmail: true,
    countRevenue: true,
    regressPaid: false,
  }
}

export function staleEventKeepsPaid(orderState: string, next: string): boolean {
  return orderState === 'PAID' && next !== 'PAID'
}

export const MAX_ATTEMPTS = 6

const BASE_BACKOFF_MINUTES = 5
const MAX_BACKOFF_MINUTES = 120

export type Outcome = 'SENT' | 'RETRY' | 'FAILED'

/** status 0 means the request never got a response (network error or timeout). */
export function classifyResponse(status: number): Outcome {
  if (status >= 200 && status < 300) return 'SENT'
  if (status === 0 || status === 408 || status === 429 || status >= 500) return 'RETRY'
  return 'FAILED'
}

export function nextAttemptAt(attempt: number, now: Date): Date {
  const minutes = Math.min(BASE_BACKOFF_MINUTES * 2 ** Math.max(attempt - 1, 0), MAX_BACKOFF_MINUTES)
  return new Date(now.getTime() + minutes * 60_000)
}

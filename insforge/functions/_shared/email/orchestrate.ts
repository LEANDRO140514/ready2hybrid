import { loadSendTicketEmailRuntimeConfig } from './config'
import { SendTicketEmailError } from './errors'
import { buildEmailHtml, generateTicketPdf } from './pdf'

type AdminClient = {
  database: {
    rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          single: () => Promise<{ data: unknown; error: unknown }>
          order: (col: string) => Promise<{ data: unknown[]; error: unknown }>
        }
        in: (col: string, vals: unknown[]) => Promise<{ data: unknown[]; error: unknown }>
        limit: (n: number) => Promise<{ data: unknown[]; error: unknown }>
      }
      update: (vals: Record<string, unknown>) => {
        eq: (col: string, val: unknown) => {
          neq: (col: string, val: unknown) => Promise<{ error: unknown }>
        }
      }
    }
  }
}

export type OrchestrateDeps = {
  env: (key: string) => string | undefined
  getAdminClient: () => AdminClient
}

type TicketResult = {
  ticket_id: string
  status: 'SENT' | 'FAILED' | 'SKIPPED'
  detail?: string
}

type SendResult = {
  ok: boolean
  orders?: number
  sent?: number
  failed?: number
  results?: TicketResult[]
  reason?: string
  error?: string
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function requireOperator(req: Request, bearer: string | null): void {
  if (!bearer) throw new SendTicketEmailError('CONFIGURATION_ERROR')
  const header = req.headers.get('authorization') ?? ''
  if (header !== `Bearer ${bearer}`) {
    throw new SendTicketEmailError('UNAUTHORIZED')
  }
}

function parseRequest(raw: unknown): { mode: 'send' | 'sweep' | 'status'; orderId?: string; max?: number } {
  if (!raw || typeof raw !== 'object') {
    throw new SendTicketEmailError('INVALID_REQUEST')
  }
  const obj = raw as Record<string, unknown>

  if (obj.mode === 'sweep') {
    const max = typeof obj.max === 'number' && obj.max > 0 ? Math.min(obj.max, 100) : 25
    return { mode: 'sweep', max }
  }

  if (obj.mode === 'status') {
    if (typeof obj.order_id !== 'string' || !obj.order_id.trim()) {
      throw new SendTicketEmailError('INVALID_REQUEST')
    }
    return { mode: 'status', orderId: obj.order_id.trim() }
  }

  if (typeof obj.order_id === 'string' && obj.order_id.trim()) {
    return { mode: 'send', orderId: obj.order_id.trim() }
  }

  throw new SendTicketEmailError('INVALID_REQUEST')
}

async function sendForOrder(
  orderId: string,
  deps: OrchestrateDeps,
  config: ReturnType<typeof loadSendTicketEmailRuntimeConfig>,
): Promise<SendResult> {
  const admin = deps.getAdminClient()
  const results: TicketResult[] = []

  const { data: ticketsRaw, error: ticketsErr } = await admin.database
    .from('tickets')
    .select(`
      id,
      folio,
      registration_id,
      product_code,
      registrations!inner(order_id, team_id, products!inner(team_size, name))
    `)
    .eq('registrations.order_id', orderId)

  if (ticketsErr || !ticketsRaw) {
    throw new SendTicketEmailError('SERVICE_UNAVAILABLE')
  }

  type TicketRow = {
    id: string
    folio: string
    registration_id: string
    product_code: string
    registrations: {
      order_id: string
      team_id: string | null
      products: { team_size: number | null; name: string }
    }
  }

  const tickets = (ticketsRaw as TicketRow[]).filter(
    (t) => t.registrations?.order_id === orderId,
  )

  if (tickets.length === 0) {
    return { ok: true, sent: 0, reason: 'NO_TICKETS' }
  }

  const { data: orderData, error: orderErr } = await admin.database
    .from('orders')
    .select('buyer_contact_id, buyer_contacts!inner(email, name)')
    .eq('id', orderId)
    .single()

  if (orderErr || !orderData) {
    throw new SendTicketEmailError('ORDER_NOT_FOUND')
  }

  type OrderRow = {
    buyer_contact_id: string
    buyer_contacts: { email: string | null; name: string | null }
  }
  const order = orderData as OrderRow
  const buyerEmail = order.buyer_contacts?.email
  const buyerName = order.buyer_contacts?.name ?? 'Participante'

  if (!buyerEmail) {
    for (const t of tickets) {
      await markOutboxResult(admin, t.id, 'BUYER_EMAIL_MISSING')
      results.push({ ticket_id: t.id, status: 'FAILED', detail: 'BUYER_EMAIL_MISSING' })
    }
    return { ok: false, sent: 0, failed: tickets.length, results, error: 'BUYER_EMAIL_MISSING' }
  }

  if (!config.resendApiKey) {
    throw new SendTicketEmailError('EMAIL_NOT_CONFIGURED')
  }

  const attachments: Array<{ filename: string; content: string }> = []
  let sent = 0
  let failed = 0

  for (const ticket of tickets) {
    const teamSize = ticket.registrations.products?.team_size ?? 1
    const teamId = ticket.registrations.team_id
    const productName = ticket.registrations.products?.name ?? ticket.product_code

    let rosterNames: string[] = [buyerName]
    let teamName: string | null = null

    if (teamSize > 1 && teamId) {
      const { data: teamData } = await admin.database
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single()
      teamName = (teamData as { name?: string })?.name ?? null

      const { data: membersRaw } = await admin.database
        .from('team_members')
        .select('participant_id, position, participants!inner(name)')
        .eq('team_id', teamId)
        .order('position')

      if (membersRaw && Array.isArray(membersRaw)) {
        type MemberRow = { participant_id: string; position: number; participants: { name: string | null } }
        rosterNames = (membersRaw as MemberRow[])
          .map((m) => m.participants?.name)
          .filter((n): n is string => Boolean(n))
        if (rosterNames.length === 0) {
          rosterNames = [buyerName]
        }
      }
    }

    const uniqueSeed = `email:${ticket.id}:${Date.now()}:${crypto.randomUUID()}`
    const idempotencyKeyHash = await sha256Hex(uniqueSeed)
    const requestFingerprint = await sha256Hex(JSON.stringify({ ticket_id: ticket.id, send_ts: Date.now() }))

    const { data: reissueData, error: reissueErr } = await admin.database.rpc(
      'ticket_credential_reissue_tx',
      {
        p: {
          ticket_id: ticket.id,
          idempotency_key_hash: idempotencyKeyHash,
          request_fingerprint: requestFingerprint,
          idempotency_ttl_seconds: config.idempotencyTtlSeconds,
        },
      },
    )

    if (reissueErr) {
      await markOutboxResult(admin, ticket.id, 'REISSUE_RPC_ERROR')
      results.push({ ticket_id: ticket.id, status: 'FAILED', detail: 'REISSUE_RPC_ERROR' })
      failed++
      continue
    }

    const reissue = reissueData as {
      ok?: boolean
      replay?: boolean
      response?: { raw_token?: string }
      error_code?: string
    }

    if (!reissue?.ok) {
      const errCode = reissue?.error_code ?? 'REISSUE_FAILED'
      await markOutboxResult(admin, ticket.id, errCode)
      results.push({ ticket_id: ticket.id, status: 'FAILED', detail: errCode })
      failed++
      continue
    }

    const rawToken = reissue.response?.raw_token
    if (!rawToken) {
      await markOutboxResult(admin, ticket.id, 'NO_RAW_TOKEN')
      results.push({ ticket_id: ticket.id, status: 'FAILED', detail: 'NO_RAW_TOKEN' })
      failed++
      continue
    }

    try {
      const pdfBase64 = await generateTicketPdf({
        ticketFolio: ticket.folio,
        productName,
        teamName,
        rosterNames,
        buyerName,
        rawToken,
      })

      attachments.push({
        filename: tickets.length > 1 ? `boleto-${ticket.folio}.pdf` : 'boleto-hybrid-experience.pdf',
        content: pdfBase64,
      })

      results.push({ ticket_id: ticket.id, status: 'SENT' })
      sent++
    } catch (pdfErr) {
      await markOutboxResult(admin, ticket.id, 'PDF_GENERATION_FAILED')
      results.push({ ticket_id: ticket.id, status: 'FAILED', detail: 'PDF_GENERATION_FAILED' })
      failed++
    }
  }

  if (attachments.length === 0) {
    return { ok: false, sent: 0, failed, results, error: 'NO_ATTACHMENTS_GENERATED' }
  }

  const firstTicket = tickets[0]
  const productName = firstTicket.registrations.products?.name ?? firstTicket.product_code
  const teamSize = firstTicket.registrations.products?.team_size ?? 1
  const teamId = firstTicket.registrations.team_id

  let rosterNames: string[] = [buyerName]
  let teamName: string | null = null

  if (teamSize > 1 && teamId) {
    const { data: teamData } = await admin.database
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()
    teamName = (teamData as { name?: string })?.name ?? null

    const { data: membersRaw } = await admin.database
      .from('team_members')
      .select('participant_id, position, participants!inner(name)')
      .eq('team_id', teamId)
      .order('position')

    if (membersRaw && Array.isArray(membersRaw)) {
      type MemberRow = { participant_id: string; position: number; participants: { name: string | null } }
      rosterNames = (membersRaw as MemberRow[])
        .map((m) => m.participants?.name)
        .filter((n): n is string => Boolean(n))
      if (rosterNames.length === 0) {
        rosterNames = [buyerName]
      }
    }
  }

  const emailHtml = buildEmailHtml({
    buyerName,
    productName,
    teamName,
    rosterNames,
    ticketFolio: firstTicket.folio,
  })

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.resendApiKey}`,
    },
    body: JSON.stringify({
      from: 'HYBRID EXPERIENCE <boletos@mail.hybrid-experience.enforma.mx>',
      to: buyerEmail,
      subject: 'Confirmación de inscripción — Hybrid Experience 2026',
      html: emailHtml,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    }),
  })

  if (!resendResponse.ok) {
    const errText = await resendResponse.text().catch(() => 'unknown')
    for (const ticket of tickets) {
      await markOutboxResult(admin, ticket.id, `RESEND_ERROR:${resendResponse.status}`)
    }
    return {
      ok: false,
      sent: 0,
      failed: tickets.length,
      results: results.map((r) =>
        r.status === 'SENT' ? { ...r, status: 'FAILED' as const, detail: 'RESEND_FAILED' } : r,
      ),
      error: `RESEND_ERROR:${resendResponse.status}:${errText.slice(0, 100)}`,
    }
  }

  const resendResult = (await resendResponse.json()) as { id?: string }
  const resendId = resendResult.id ?? 'ok'

  for (const ticket of tickets) {
    await admin.database
      .from('outbox_delivery_jobs')
      .update({ state: 'SENT', result: resendId, updated_at: new Date().toISOString() })
      .eq('domain_event_ref', `ticket:${ticket.id}`)
      .neq('state', 'SENT')
  }

  return { ok: true, orders: 1, sent, failed, results }
}

async function markOutboxResult(admin: AdminClient, ticketId: string, result: string): Promise<void> {
  await admin.database
    .from('outbox_delivery_jobs')
    .update({ result, updated_at: new Date().toISOString() })
    .eq('domain_event_ref', `ticket:${ticketId}`)
    .neq('state', 'SENT')
}

async function sweepPending(
  max: number,
  deps: OrchestrateDeps,
  config: ReturnType<typeof loadSendTicketEmailRuntimeConfig>,
): Promise<SendResult> {
  const admin = deps.getAdminClient()

  const { data: jobsRaw, error: jobsErr } = await admin.database
    .from('outbox_delivery_jobs')
    .select('domain_event_ref')
    .eq('communication_type', 'TICKET_READY')
    .eq('state', 'PENDING')
    .limit(max * 2)

  if (jobsErr || !jobsRaw) {
    throw new SendTicketEmailError('SERVICE_UNAVAILABLE')
  }

  type JobRow = { domain_event_ref: string }
  const jobs = jobsRaw as JobRow[]

  const ticketIds = jobs
    .map((j) => {
      const match = /^ticket:(.+)$/.exec(j.domain_event_ref)
      return match?.[1]
    })
    .filter((id): id is string => Boolean(id))

  if (ticketIds.length === 0) {
    return { ok: true, orders: 0, sent: 0, failed: 0, results: [] }
  }

  const { data: ticketsRaw } = await admin.database
    .from('tickets')
    .select('registration_id, registrations!inner(order_id)')
    .in('id', ticketIds)

  if (!ticketsRaw) {
    return { ok: true, orders: 0, sent: 0, failed: 0, results: [] }
  }

  type TicketOrderRow = { registration_id: string; registrations: { order_id: string } }
  const orderIds = [...new Set((ticketsRaw as TicketOrderRow[]).map((t) => t.registrations.order_id))]

  const limitedOrderIds = orderIds.slice(0, max)

  let totalSent = 0
  let totalFailed = 0
  const allResults: TicketResult[] = []

  for (const oid of limitedOrderIds) {
    try {
      const result = await sendForOrder(oid, deps, config)
      totalSent += result.sent ?? 0
      totalFailed += result.failed ?? 0
      if (result.results) {
        allResults.push(...result.results)
      }
    } catch {
      totalFailed++
    }
  }

  return {
    ok: true,
    orders: limitedOrderIds.length,
    sent: totalSent,
    failed: totalFailed,
    results: allResults,
  }
}

async function statusForOrder(orderId: string, deps: OrchestrateDeps): Promise<SendResult> {
  const admin = deps.getAdminClient()

  const { data: ticketsRaw, error: ticketsErr } = await admin.database
    .from('tickets')
    .select('id, folio, registration_id, registrations!inner(order_id)')
    .eq('registrations.order_id', orderId)

  if (ticketsErr || !ticketsRaw) {
    throw new SendTicketEmailError('SERVICE_UNAVAILABLE')
  }

  type TicketRow = { id: string; folio: string; registration_id: string; registrations: { order_id: string } }
  const tickets = (ticketsRaw as TicketRow[]).filter((t) => t.registrations?.order_id === orderId)

  if (tickets.length === 0) {
    return { ok: true, sent: 0, reason: 'NO_TICKETS', results: [] }
  }

  const ticketIds = tickets.map((t) => t.id)

  const { data: jobsRaw } = await admin.database
    .from('outbox_delivery_jobs')
    .select('domain_event_ref, state, result')
    .eq('communication_type', 'TICKET_READY')
    .in('domain_event_ref', ticketIds.map((id) => `ticket:${id}`))

  type JobRow = { domain_event_ref: string; state: string; result: string | null }
  const jobs = (jobsRaw ?? []) as JobRow[]
  const jobMap = new Map(jobs.map((j) => [j.domain_event_ref, j]))

  const results: TicketResult[] = tickets.map((t) => {
    const job = jobMap.get(`ticket:${t.id}`)
    if (!job) {
      return { ticket_id: t.id, status: 'SKIPPED' as const, detail: 'NO_OUTBOX_JOB' }
    }
    return {
      ticket_id: t.id,
      status: job.state === 'SENT' ? ('SENT' as const) : ('FAILED' as const),
      detail: job.result ?? job.state,
    }
  })

  const sent = results.filter((r) => r.status === 'SENT').length

  return { ok: true, sent, failed: results.length - sent, results }
}

export async function orchestrateSendTicketEmail(
  req: Request,
  deps: OrchestrateDeps,
): Promise<{ status: number; body: unknown }> {
  if (req.method !== 'POST') {
    throw new SendTicketEmailError('METHOD_NOT_ALLOWED')
  }

  const config = loadSendTicketEmailRuntimeConfig(deps.env)
  requireOperator(req, config.operatorBearer)

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new SendTicketEmailError('INVALID_REQUEST')
  }

  const parsed = parseRequest(raw)

  if (parsed.mode === 'status') {
    const result = await statusForOrder(parsed.orderId!, deps)
    return { status: 200, body: result }
  }

  if (parsed.mode === 'sweep') {
    const result = await sweepPending(parsed.max!, deps, config)
    return { status: 200, body: result }
  }

  const result = await sendForOrder(parsed.orderId!, deps, config)
  return { status: result.ok ? 200 : 422, body: result }
}

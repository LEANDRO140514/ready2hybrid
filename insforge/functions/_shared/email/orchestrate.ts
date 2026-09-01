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
          limit: (n: number) => Promise<{ data: unknown[]; error: unknown }>
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

type TicketData = {
  id: string
  folio: string
  registrationId: string
  productCode: string
  productName: string
  teamSize: number
  teamId: string | null
}

type ResolvedTicket = TicketData & {
  teamName: string | null
  rosterNames: string[]
}

async function sendForOrder(
  orderId: string,
  deps: OrchestrateDeps,
  config: ReturnType<typeof loadSendTicketEmailRuntimeConfig>,
): Promise<SendResult> {
  const admin = deps.getAdminClient()

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Resolve registrations for this order (flat query, no embedding)
  // ─────────────────────────────────────────────────────────────────────────
  const { data: registrationsRaw, error: regErr } = await admin.database
    .from('registrations')
    .select('id, product_id, team_id')
    .eq('order_id', orderId)
    .limit(100)

  if (regErr || !registrationsRaw) {
    throw new SendTicketEmailError('SERVICE_UNAVAILABLE')
  }

  type RegistrationRow = { id: string; product_id: string; team_id: string | null }
  const registrations = registrationsRaw as RegistrationRow[]

  if (registrations.length === 0) {
    return { ok: true, sent: 0, reason: 'NO_REGISTRATIONS' }
  }

  const registrationIds = registrations.map((r) => r.id)

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Resolve tickets for these registrations (flat query)
  // ─────────────────────────────────────────────────────────────────────────
  const { data: ticketsRaw, error: ticketsErr } = await admin.database
    .from('tickets')
    .select('id, folio, registration_id, product_code')
    .in('registration_id', registrationIds)

  if (ticketsErr || !ticketsRaw) {
    throw new SendTicketEmailError('SERVICE_UNAVAILABLE')
  }

  type TicketRow = { id: string; folio: string; registration_id: string; product_code: string }
  const ticketRows = ticketsRaw as TicketRow[]

  if (ticketRows.length === 0) {
    return { ok: true, sent: 0, reason: 'NO_TICKETS' }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Check outbox status — skip tickets already SENT (FIX 6)
  // ─────────────────────────────────────────────────────────────────────────
  const ticketDomainRefs = ticketRows.map((t) => `ticket:${t.id}`)
  const { data: outboxRaw } = await admin.database
    .from('outbox_delivery_jobs')
    .select('domain_event_ref, state')
    .in('domain_event_ref', ticketDomainRefs)

  type OutboxRow = { domain_event_ref: string; state: string }
  const outboxJobs = (outboxRaw ?? []) as OutboxRow[]
  const alreadySentRefs = new Set(
    outboxJobs.filter((j) => j.state === 'SENT').map((j) => j.domain_event_ref),
  )

  const pendingTicketRows = ticketRows.filter((t) => !alreadySentRefs.has(`ticket:${t.id}`))

  if (pendingTicketRows.length === 0) {
    return { ok: true, sent: 0, reason: 'ALL_ALREADY_SENT' }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: Resolve products for team_size and name (flat query)
  // ─────────────────────────────────────────────────────────────────────────
  const productIds = [...new Set(registrations.map((r) => r.product_id))]
  const { data: productsRaw, error: productsErr } = await admin.database
    .from('products')
    .select('id, name, team_size')
    .in('id', productIds)

  if (productsErr || !productsRaw) {
    throw new SendTicketEmailError('SERVICE_UNAVAILABLE')
  }

  type ProductRow = { id: string; name: string; team_size: number | null }
  const products = productsRaw as ProductRow[]
  const productMap = new Map(products.map((p) => [p.id, p]))

  // Build registration → product lookup
  const regToProduct = new Map<string, ProductRow | undefined>()
  for (const reg of registrations) {
    regToProduct.set(reg.id, productMap.get(reg.product_id))
  }

  // Build registration → team_id lookup
  const regToTeamId = new Map<string, string | null>()
  for (const reg of registrations) {
    regToTeamId.set(reg.id, reg.team_id)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: Resolve buyer (order → buyer_contact) — flat queries
  // ─────────────────────────────────────────────────────────────────────────
  const { data: orderData, error: orderErr } = await admin.database
    .from('orders')
    .select('id, buyer_contact_id')
    .eq('id', orderId)
    .single()

  if (orderErr || !orderData) {
    throw new SendTicketEmailError('ORDER_NOT_FOUND')
  }

  type OrderRow = { id: string; buyer_contact_id: string }
  const order = orderData as OrderRow

  const { data: buyerData, error: buyerErr } = await admin.database
    .from('buyer_contacts')
    .select('id, email, name')
    .eq('id', order.buyer_contact_id)
    .single()

  if (buyerErr || !buyerData) {
    throw new SendTicketEmailError('ORDER_NOT_FOUND')
  }

  type BuyerRow = { id: string; email: string | null; name: string | null }
  const buyer = buyerData as BuyerRow
  const buyerEmail = buyer.email
  const buyerName = buyer.name ?? 'Participante'

  if (!buyerEmail) {
    const results: TicketResult[] = []
    for (const t of pendingTicketRows) {
      await markOutboxResult(admin, t.id, 'BUYER_EMAIL_MISSING')
      results.push({ ticket_id: t.id, status: 'FAILED', detail: 'BUYER_EMAIL_MISSING' })
    }
    return { ok: false, sent: 0, failed: pendingTicketRows.length, results, error: 'BUYER_EMAIL_MISSING' }
  }

  if (!config.resendApiKey) {
    throw new SendTicketEmailError('EMAIL_NOT_CONFIGURED')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6: Resolve team rosters (once per unique team_id, flat queries)
  // ─────────────────────────────────────────────────────────────────────────
  const teamIds = [...new Set(registrations.map((r) => r.team_id).filter((id): id is string => id != null))]

  const teamNameMap = new Map<string, string | null>()
  const teamRosterMap = new Map<string, string[]>()

  if (teamIds.length > 0) {
    const { data: teamsRaw } = await admin.database
      .from('teams')
      .select('id, name')
      .in('id', teamIds)

    type TeamRow = { id: string; name: string | null }
    const teams = (teamsRaw ?? []) as TeamRow[]
    for (const t of teams) {
      teamNameMap.set(t.id, t.name)
    }

    const { data: membersRaw } = await admin.database
      .from('team_members')
      .select('team_id, participant_id, position')
      .in('team_id', teamIds)

    type MemberRow = { team_id: string; participant_id: string; position: number }
    const members = (membersRaw ?? []) as MemberRow[]

    const participantIds = [...new Set(members.map((m) => m.participant_id))]
    let participantNameMap = new Map<string, string | null>()

    if (participantIds.length > 0) {
      const { data: participantsRaw } = await admin.database
        .from('participants')
        .select('id, name')
        .in('id', participantIds)

      type ParticipantRow = { id: string; name: string | null }
      const participants = (participantsRaw ?? []) as ParticipantRow[]
      participantNameMap = new Map(participants.map((p) => [p.id, p.name]))
    }

    for (const teamId of teamIds) {
      const teamMembers = members
        .filter((m) => m.team_id === teamId)
        .sort((a, b) => a.position - b.position)
      const names = teamMembers
        .map((m) => participantNameMap.get(m.participant_id))
        .filter((n): n is string => Boolean(n))
      teamRosterMap.set(teamId, names.length > 0 ? names : [buyerName])
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 7: Build resolved ticket data
  // ─────────────────────────────────────────────────────────────────────────
  const resolvedTickets: ResolvedTicket[] = []

  for (const t of pendingTicketRows) {
    const product = regToProduct.get(t.registration_id)
    const teamId = regToTeamId.get(t.registration_id)
    const teamSize = product?.team_size ?? 1
    const productName = product?.name ?? t.product_code

    let teamName: string | null = null
    let rosterNames: string[] = [buyerName]

    if (teamId) {
      teamName = teamNameMap.get(teamId) ?? null
      rosterNames = teamRosterMap.get(teamId) ?? [buyerName]
    }

    resolvedTickets.push({
      id: t.id,
      folio: t.folio,
      registrationId: t.registration_id,
      productCode: t.product_code,
      productName,
      teamSize,
      teamId,
      teamName,
      rosterNames,
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 8: Generate PDFs (reissue + PDF generation)
  // NOTE (FIX 4 - B1 Behavior): We call ticket_credential_reissue_tx BEFORE
  // sending email. This rotates the QR credential. If Resend fails AFTER
  // rotation, the old QR is already revoked. On SWEEP retry, reissue_tx will
  // be called again with a NEW idempotency_key, generating ANOTHER fresh QR.
  // This is the expected B1 behavior: "always rotate, last QR wins". The
  // buyer will receive the email with the FINAL valid QR on successful send.
  // ─────────────────────────────────────────────────────────────────────────
  const attachments: Array<{ ticketId: string; filename: string; content: string }> = []
  const failedResults: TicketResult[] = []

  for (const ticket of resolvedTickets) {
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
      failedResults.push({ ticket_id: ticket.id, status: 'FAILED', detail: 'REISSUE_RPC_ERROR' })
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
      failedResults.push({ ticket_id: ticket.id, status: 'FAILED', detail: errCode })
      continue
    }

    const rawToken = reissue.response?.raw_token
    if (!rawToken) {
      await markOutboxResult(admin, ticket.id, 'NO_RAW_TOKEN')
      failedResults.push({ ticket_id: ticket.id, status: 'FAILED', detail: 'NO_RAW_TOKEN' })
      continue
    }

    try {
      const pdfBase64 = await generateTicketPdf({
        ticketFolio: ticket.folio,
        productName: ticket.productName,
        teamName: ticket.teamName,
        rosterNames: ticket.rosterNames,
        buyerName,
        rawToken,
      })

      const filename =
        resolvedTickets.length > 1 ? `boleto-${ticket.folio}.pdf` : 'boleto-hybrid-experience.pdf'

      attachments.push({ ticketId: ticket.id, filename, content: pdfBase64 })
    } catch {
      await markOutboxResult(admin, ticket.id, 'PDF_GENERATION_FAILED')
      failedResults.push({ ticket_id: ticket.id, status: 'FAILED', detail: 'PDF_GENERATION_FAILED' })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 9: If no attachments generated, return failure without calling Resend
  // ─────────────────────────────────────────────────────────────────────────
  if (attachments.length === 0) {
    return {
      ok: false,
      sent: 0,
      failed: failedResults.length,
      results: failedResults,
      error: 'NO_ATTACHMENTS_GENERATED',
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 10: Build email HTML using first ticket's data
  // ASSUMPTION: one ticket per order (T1 model). The email body describes
  // firstTicket only. If an order ever carries multiple distinct products,
  // buildEmailHtml must be extended to list all of them. PDFs for all tickets
  // are attached regardless; only the HTML body assumes one.
  // ─────────────────────────────────────────────────────────────────────────
  const firstTicket = resolvedTickets.find((t) => attachments.some((a) => a.ticketId === t.id))!
  const emailHtml = buildEmailHtml({
    buyerName,
    productName: firstTicket.productName,
    teamName: firstTicket.teamName,
    rosterNames: firstTicket.rosterNames,
    ticketFolio: firstTicket.folio,
  })

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 11: Send ONE email with all attachments
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 12: Handle Resend response — ONLY mark SENT after confirmed success
  // ─────────────────────────────────────────────────────────────────────────
  if (!resendResponse.ok) {
    const errText = await resendResponse.text().catch(() => 'unknown')
    const errorDetail = `RESEND_ERROR:${resendResponse.status}`

    for (const att of attachments) {
      await markOutboxResult(admin, att.ticketId, errorDetail)
    }

    const allResults: TicketResult[] = [
      ...failedResults,
      ...attachments.map((a) => ({
        ticket_id: a.ticketId,
        status: 'FAILED' as const,
        detail: 'RESEND_FAILED',
      })),
    ]

    return {
      ok: false,
      sent: 0,
      failed: allResults.length,
      results: allResults,
      error: `${errorDetail}:${errText.slice(0, 100)}`,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 13: Success — mark outbox as SENT for attached tickets
  // ─────────────────────────────────────────────────────────────────────────
  const resendResult = (await resendResponse.json()) as { id?: string }
  const resendId = resendResult.id ?? 'ok'

  for (const att of attachments) {
    await admin.database
      .from('outbox_delivery_jobs')
      .update({ state: 'SENT', result: resendId, updated_at: new Date().toISOString() })
      .eq('domain_event_ref', `ticket:${att.ticketId}`)
      .neq('state', 'SENT')
  }

  const successResults: TicketResult[] = attachments.map((a) => ({
    ticket_id: a.ticketId,
    status: 'SENT' as const,
  }))

  return {
    ok: true,
    orders: 1,
    sent: attachments.length,
    failed: failedResults.length,
    results: [...successResults, ...failedResults],
  }
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

  // Query pending outbox jobs (flat query, no embedding)
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

  // Get tickets to find their registration_id (flat query)
  const { data: ticketsRaw } = await admin.database
    .from('tickets')
    .select('id, registration_id')
    .in('id', ticketIds)

  if (!ticketsRaw) {
    return { ok: true, orders: 0, sent: 0, failed: 0, results: [] }
  }

  type TicketRow = { id: string; registration_id: string }
  const tickets = ticketsRaw as TicketRow[]
  const registrationIds = [...new Set(tickets.map((t) => t.registration_id))]

  // Get registrations to find order_id (flat query)
  const { data: regsRaw } = await admin.database
    .from('registrations')
    .select('id, order_id')
    .in('id', registrationIds)

  if (!regsRaw) {
    return { ok: true, orders: 0, sent: 0, failed: 0, results: [] }
  }

  type RegRow = { id: string; order_id: string }
  const regs = regsRaw as RegRow[]
  const orderIds = [...new Set(regs.map((r) => r.order_id))]

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

  // Get registrations for this order (flat query)
  const { data: regsRaw, error: regsErr } = await admin.database
    .from('registrations')
    .select('id')
    .eq('order_id', orderId)
    .limit(100)

  if (regsErr || !regsRaw) {
    throw new SendTicketEmailError('SERVICE_UNAVAILABLE')
  }

  type RegRow = { id: string }
  const regs = regsRaw as RegRow[]

  if (regs.length === 0) {
    return { ok: true, sent: 0, reason: 'NO_REGISTRATIONS', results: [] }
  }

  const registrationIds = regs.map((r) => r.id)

  // Get tickets for these registrations (flat query)
  const { data: ticketsRaw, error: ticketsErr } = await admin.database
    .from('tickets')
    .select('id, folio, registration_id')
    .in('registration_id', registrationIds)

  if (ticketsErr || !ticketsRaw) {
    throw new SendTicketEmailError('SERVICE_UNAVAILABLE')
  }

  type TicketRow = { id: string; folio: string; registration_id: string }
  const tickets = ticketsRaw as TicketRow[]

  if (tickets.length === 0) {
    return { ok: true, sent: 0, reason: 'NO_TICKETS', results: [] }
  }

  const ticketIds = tickets.map((t) => t.id)
  const ticketDomainRefs = ticketIds.map((id) => `ticket:${id}`)

  // Get outbox jobs for these tickets (flat query)
  const { data: jobsRaw } = await admin.database
    .from('outbox_delivery_jobs')
    .select('domain_event_ref, state, result')
    .in('domain_event_ref', ticketDomainRefs)

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

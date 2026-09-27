export const LEGACY_SOURCE_SYSTEM = 'LEGACY_HYBRID_REGISTRO'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') field += char
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  const filled = rows.filter((entry) => entry.some((cell) => cell !== ''))
  const header = filled[0].map((name) => name.replace(/^\uFEFF/, ''))
  return filled.slice(1).map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ''])))
}

export function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase()
  return email
}

export function classifyLegacyRow(source, context) {
  const reasons = []
  const originalRecordId = String(source.id ?? '').trim()
  if (!UUID.test(originalRecordId)) reasons.push('MISSING_STABLE_RECORD_ID')

  const status = String(source.status ?? '').trim()
  let commercialStatus = null
  if (status === 'paid') commercialStatus = 'LEGACY_PAID'
  else if (status === 'pending') commercialStatus = 'LEGACY_PENDING'
  else reasons.push('UNKNOWN_STATUS')

  const categoryCode = String(source.category_code ?? '').trim()
  const mapped = categoryCode !== '' && context.catalogCodes.has(categoryCode)
  if (!mapped) reasons.push('UNMAPPED_CATEGORY')

  const email = normalizeEmail(source.contact_email)
  const contactIds = email ? (context.contactsByEmail.get(email) ?? []) : []
  let buyerContactId = null
  if (contactIds.length === 1) buyerContactId = contactIds[0]
  else if (contactIds.length > 1) reasons.push('AMBIGUOUS_CONTACT')

  const amountRaw = String(source.amount ?? '').trim()
  let amountCents = null
  if (amountRaw !== '') {
    if (/^\d+$/.test(amountRaw)) amountCents = Number(amountRaw) * 100
    else reasons.push('AMOUNT_UNPARSEABLE')
  }

  const createdAt = String(source.created_at ?? '').trim()
  const updatedAt = String(source.updated_at ?? '').trim()
  if (createdAt && Number.isNaN(Date.parse(createdAt))) reasons.push('BAD_CREATED_AT')
  if (updatedAt && Number.isNaN(Date.parse(updatedAt))) reasons.push('BAD_UPDATED_AT')

  const rejected = reasons.includes('MISSING_STABLE_RECORD_ID')
  const disposition = rejected
    ? 'REJECTED_WITH_REASON'
    : reasons.length > 0
      ? 'REVIEW_REQUIRED'
      : 'IMPORTED'

  const paymentId = String(source.mp_payment_id ?? '').trim()

  return {
    sourceSystem: LEGACY_SOURCE_SYSTEM,
    originalRecordId: originalRecordId || null,
    originalStatus: status,
    commercialStatus,
    disposition,
    reviewReason: reasons.length ? reasons.join(',') : null,
    buyerContactId,
    originalName: String(source.contact_name ?? '').trim(),
    originalEmail: email || null,
    originalPhone: String(source.contact_phone ?? '').trim() || null,
    categoryCodeRaw: categoryCode || null,
    categoryNameRaw: String(source.category_name ?? '').trim() || null,
    categoryBlockRaw: String(source.category_bloque ?? '').trim() || null,
    teamNameRaw: String(source.team_name ?? '').trim() || null,
    participantsRaw: String(source.participants ?? '').trim() || null,
    normalizedProductCode: mapped ? categoryCode : null,
    amountCents,
    currency: String(source.currency ?? '').trim() || null,
    originalPaymentId: paymentId || null,
    notesRaw: String(source.notes ?? '').trim() || null,
    originalCreatedAt: createdAt || null,
    originalUpdatedAt: updatedAt || null,
    consent: null,
    attribution: {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      fbclid: null,
      gclid: null,
      visitorId: null,
      sessionId: null,
    },
    createsOperationalRecords: false,
  }
}

export function planImport(rows, context) {
  const seen = new Set()
  const planned = []
  for (const row of rows) {
    const item = classifyLegacyRow(row, context)
    if (item.originalRecordId && seen.has(item.originalRecordId)) {
      planned.push({
        ...item,
        disposition: 'REJECTED_WITH_REASON',
        reviewReason: 'DUPLICATE_RECORD_ID_IN_FILE',
        buyerContactId: null,
      })
      continue
    }
    if (item.originalRecordId) seen.add(item.originalRecordId)
    if (item.disposition !== 'REJECTED_WITH_REASON' && context.alreadyImported.has(item.originalRecordId)) {
      planned.push({
        ...item,
        disposition: 'DUPLICATE',
        reviewReason: 'ALREADY_IMPORTED',
        buyerContactId: item.buyerContactId,
      })
      continue
    }
    planned.push(item)
  }

  const count = (disposition) => planned.filter((item) => item.disposition === disposition).length
  return {
    total: planned.length,
    imported: count('IMPORTED'),
    reviewRequired: count('REVIEW_REQUIRED'),
    duplicates: count('DUPLICATE'),
    rejected: count('REJECTED_WITH_REASON'),
    paid: planned.filter((item) => item.commercialStatus === 'LEGACY_PAID' && item.disposition !== 'DUPLICATE' && item.disposition !== 'REJECTED_WITH_REASON').length,
    pending: planned.filter((item) => item.commercialStatus === 'LEGACY_PENDING' && item.disposition !== 'DUPLICATE' && item.disposition !== 'REJECTED_WITH_REASON').length,
    matchedExisting: planned.filter((item) => item.disposition === 'IMPORTED' && item.buyerContactId).length,
    newContacts: 0,
    rows: planned,
  }
}

/**
 * Contact list for marketing: who bought, who is pending, who left a contact.
 * Built on the server (`ops-commercial-read`, view `contacts`). The client
 * only filters and exports what the server already allowed this role to see.
 */
import { meridaFileStamp } from '../treasury/books'

export type MarketingStatus = 'PAID' | 'PENDING' | 'LEAD'

export type MarketingContact = {
  key: string
  name: string | null
  email: string | null
  phone: string | null
  status: MarketingStatus
  origin: 'current' | 'legacy' | 'current+legacy'
  categories: string[]
  paidCents: number
  firstAt: string | null
  lastAt: string | null
  saleAt: string | null
  registeredAt: string | null
  importedAt: string | null
  paymentCountedOnCurrent: boolean
  /** Counted sales after the payment-id cross. Pending and rejected rows are not included. */
  purchaseCount: number
  /** Products on those counted sales. Pending registrations stay in categories. */
  purchasedProducts: string[]
  consent: 'recorded' | 'not-recorded'
}

export type MarketingPayload = {
  eventCode: string
  contacts: MarketingContact[]
  /** Distinct landing visitors, anonymous included. */
  visitors: number
  /** Visitors who left a contact (a subset of the contacts above). */
  identifiedVisitors: number
}

export type MarketingFilters = {
  status: 'all' | MarketingStatus
  consent: 'all' | 'recorded' | 'not-recorded'
  product: string
  saleFrom: string
  saleTo: string
  search: string
}

export const EMPTY_MARKETING_FILTERS: MarketingFilters = {
  status: 'all',
  consent: 'all',
  product: '',
  saleFrom: '',
  saleTo: '',
  search: '',
}

export const MARKETING_STATUS_LABEL: Record<MarketingStatus, string> = {
  PAID: 'Compró',
  PENDING: 'Pendiente de pago',
  LEAD: 'Dejó sus datos, sin pago',
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function parseContact(value: unknown): MarketingContact[] {
  if (!value || typeof value !== 'object') return []
  const row = value as Record<string, unknown>
  if (typeof row.key !== 'string') return []
  if (row.status !== 'PAID' && row.status !== 'PENDING' && row.status !== 'LEAD') return []
  return [{
    key: row.key,
    name: text(row.name),
    email: text(row.email),
    phone: text(row.phone),
    status: row.status,
    origin: row.origin === 'legacy' || row.origin === 'current+legacy' ? row.origin : 'current',
    categories: Array.isArray(row.categories)
      ? row.categories.filter((item): item is string => typeof item === 'string')
      : [],
    paidCents: typeof row.paidCents === 'number' ? row.paidCents : 0,
    firstAt: text(row.firstAt),
    lastAt: text(row.lastAt),
    saleAt: text(row.saleAt),
    registeredAt: text(row.registeredAt),
    importedAt: text(row.importedAt),
    paymentCountedOnCurrent: row.paymentCountedOnCurrent === true,
    purchaseCount: typeof row.purchaseCount === 'number' && row.purchaseCount > 0 ? row.purchaseCount : 0,
    purchasedProducts: Array.isArray(row.purchasedProducts)
      ? row.purchasedProducts.filter((item): item is string => typeof item === 'string')
      : [],
    consent: row.consent === 'recorded' ? 'recorded' : 'not-recorded',
  }]
}

const INTERNAL_EMAIL = /^enforma\.sports\.society\+/
const TEST_EMAILS = new Set(['leandro.m.espinosa@gmail.com', 'valentina.et2011@gmail.com'])

export function isExcludedMarketingContact(contact: Pick<MarketingContact, 'email'>): boolean {
  const email = contact.email?.trim().toLowerCase() ?? ''
  return email !== '' && (INTERNAL_EMAIL.test(email) || TEST_EMAILS.has(email))
}

const STATUS_RANK: Record<MarketingStatus, number> = { PAID: 3, PENDING: 2, LEAD: 1 }

function minIso(values: (string | null)[]): string | null {
  const dated = values.filter((value): value is string => value != null).sort()
  return dated[0] ?? null
}

function maxIso(values: (string | null)[]): string | null {
  const dated = values.filter((value): value is string => value != null).sort()
  return dated[dated.length - 1] ?? null
}

function mergeContacts(list: MarketingContact[]): MarketingContact {
  const best = [...list].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])[0]!
  if (list.length === 1) return best
  const origins = new Set(list.map((item) => item.origin))
  return {
    ...best,
    name: list.find((item) => item.name)?.name ?? null,
    email: list.find((item) => item.email)?.email ?? null,
    phone: list.find((item) => item.phone)?.phone ?? null,
    origin: origins.size > 1 || origins.has('current+legacy') ? 'current+legacy' : best.origin,
    categories: [...new Set(list.flatMap((item) => item.categories))],
    paidCents: list.reduce((sum, item) => sum + item.paidCents, 0),
    purchaseCount: list.reduce((sum, item) => sum + item.purchaseCount, 0),
    purchasedProducts: [...new Set(list.flatMap((item) => item.purchasedProducts))],
    firstAt: minIso(list.map((item) => item.firstAt)),
    lastAt: maxIso(list.map((item) => item.lastAt)),
    saleAt: maxIso(list.map((item) => item.saleAt)),
    registeredAt: minIso(list.map((item) => item.registeredAt)),
    importedAt: maxIso(list.map((item) => item.importedAt)),
    paymentCountedOnCurrent: list.some((item) => item.paymentCountedOnCurrent),
    consent: list.some((item) => item.consent === 'recorded') ? 'recorded' : 'not-recorded',
  }
}

/**
 * Last line of defence before an export: internal and test contacts out, and
 * rows that share an email collapse into one person. A phone only identifies
 * someone who has no email: two people with different emails who share a phone
 * (a couple, a family) stay two rows, so no row mixes data of two people. The
 * server already does this; running it again is idempotent.
 */
export function prepareMarketingContacts(contacts: MarketingContact[]): MarketingContact[] {
  const kept = contacts.filter((contact) => !isExcludedMarketingContact(contact))
  const parent = kept.map((_, index) => index)
  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) root = parent[root]!
    return root
  }
  const owner = new Map<string, number>()
  kept.forEach((contact, index) => {
    const email = contact.email?.trim().toLowerCase() ?? ''
    const phone = normalizeMxPhone(contact.phone)
    for (const key of [email ? `e:${email}` : null, !email && phone ? `p:${phone}` : null]) {
      if (!key) continue
      const seen = owner.get(key)
      if (seen === undefined) owner.set(key, index)
      else parent[find(index)] = find(seen)
    }
  })
  const groups = new Map<number, MarketingContact[]>()
  kept.forEach((contact, index) => {
    const root = find(index)
    groups.set(root, [...(groups.get(root) ?? []), contact])
  })
  return [...groups.values()].map(mergeContacts)
}

export type MarketingExportStats = {
  rows: number
  withEmail: number
  withPhone: number
}

/** What each download would contain, counted from the rows themselves. */
export function marketingExportStats(contacts: MarketingContact[]): { general: MarketingExportStats; meta: MarketingExportStats } {
  const general = {
    rows: contacts.length,
    withEmail: contacts.filter((contact) => contact.email).length,
    withPhone: contacts.filter((contact) => contact.phone).length,
  }
  const metaLines = marketingContactsToMetaCsv(contacts).split('\n').slice(1).map((line) => line.split(','))
  return {
    general,
    meta: {
      rows: metaLines.length,
      withEmail: metaLines.filter((cells) => cells[0]).length,
      withPhone: metaLines.filter((cells) => cells[1]).length,
    },
  }
}

export function parseMarketingPayload(value: unknown): MarketingPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La lista de contactos no tiene el formato esperado.')
  }
  const row = value as Record<string, unknown>
  if (!Array.isArray(row.contacts)) {
    throw new Error('La lista de contactos no tiene el formato esperado.')
  }
  return {
    eventCode: typeof row.eventCode === 'string' ? row.eventCode : 'HEX-2026',
    contacts: prepareMarketingContacts(row.contacts.flatMap(parseContact)),
    visitors: typeof row.visitors === 'number' ? row.visitors : 0,
    identifiedVisitors: typeof row.identifiedVisitors === 'number' ? row.identifiedVisitors : 0,
  }
}

function inMarketingDate(contact: MarketingContact, filters: MarketingFilters): boolean {
  if (!filters.saleFrom && !filters.saleTo) return true
  const paid = contact.status === 'PAID'
  const iso = paid ? contact.saleAt ?? contact.lastAt : contact.registeredAt ?? contact.firstAt
  if (!iso) return false
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return false
  if (filters.saleFrom && ms < Date.parse(`${filters.saleFrom}T06:00:00.000Z`)) return false
  if (filters.saleTo && ms >= Date.parse(`${filters.saleTo}T06:00:00.000Z`) + 86_400_000) return false
  return true
}

export function filterMarketingContacts(
  contacts: MarketingContact[],
  filters: MarketingFilters,
): MarketingContact[] {
  const query = filters.search.trim().toLowerCase()
  return contacts.filter((contact) => {
    if (filters.status !== 'all' && contact.status !== filters.status) return false
    if (filters.consent !== 'all' && contact.consent !== filters.consent) return false
    if (filters.product && !contact.categories.some((category) => category.toLowerCase().includes(filters.product.toLowerCase()))) {
      return false
    }
    if (!inMarketingDate(contact, filters)) return false
    if (!query) return true
    return [contact.name, contact.email, contact.phone, ...contact.categories]
      .some((field) => field?.toLowerCase().includes(query))
  })
}

export function marketingCounts(contacts: MarketingContact[]): Record<MarketingStatus, number> {
  const counts: Record<MarketingStatus, number> = { PAID: 0, PENDING: 0, LEAD: 0 }
  for (const contact of contacts) counts[contact.status] += 1
  return counts
}

/**
 * Spreadsheet formula injection: a cell that starts with = or @, or with +/-
 * followed by anything but a phone-like number, is prefixed so Excel and
 * Sheets read it as text. Names and categories come from the public landing.
 */
function csvCell(value: string | number | null): string {
  let cell = value == null ? '' : String(value)
  const phoneLike = /^[+-][\d\s().-]+$/.test(cell)
  if (/^[=@\t\r]/.test(cell) || (/^[+-]/.test(cell) && !phoneLike)) cell = `'${cell}`
  if (/[",\n\r]/.test(cell)) return `"${cell.replaceAll('"', '""')}"`
  return cell
}

/** UTF-8 byte order mark so Excel reads accents instead of guessing ANSI. */
export const CSV_BOM = '\uFEFF'

export function csvWithBom(csv: string): string {
  return csv.startsWith(CSV_BOM) ? csv : CSV_BOM + csv
}

/**
 * RFC 4180 field for the Meta file. Besides comma, quote and line breaks, a
 * field with any whitespace is quoted too: a multi-word last name such as
 * "águila aviles" must not be split into two cells by a reader that breaks on
 * spaces, which would push the next value into the wrong column.
 */
function metaCell(value: string): string {
  return /[",\s]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/**
 * Meta customer file. Compatibility is pending an official check or a real
 * import. This exporter does not claim that check.
 *
 * Phone is written only when the number already has a confirmed international
 * calling code. A local number leaves phone empty and keeps email, fn and ln.
 * Country is filled only when that code identifies one country. The general
 * export keeps the original phone.
 */
export const META_CUSTOMER_COLUMNS = ['email', 'phone', 'fn', 'ln', 'country', 'ct', 'st'] as const

/**
 * Known Mexican area codes (lada). Used only to catch a number written as
 * +1 / 1 + 10 digits whose 10 digits start like a Mexican number. It is not an
 * exhaustive numbering plan: a miss only means the number is treated as the +1
 * number it claims to be, which is how it was exported before.
 */
const MX_LADAS_2 = new Set(['33', '55', '56', '81'])
const MX_LADAS_3 = new Set((
  '449 465 496 646 653 658 661 664 665 686 612 613 615 624 981 982 938 961 962 963 964 965 966 967 968 916 919 ' +
  '614 625 626 627 628 635 639 648 656 842 844 861 862 864 866 871 872 877 878 312 313 314 315 618 674 675 676 677 ' +
  '411 412 413 414 415 417 418 419 461 462 463 464 466 468 469 472 473 476 477 479 733 736 741 742 744 745 747 753 ' +
  '754 755 756 757 738 746 748 759 761 771 772 773 774 775 776 317 321 322 341 342 343 344 345 346 347 348 349 372 ' +
  '373 374 375 376 377 378 385 386 387 388 389 391 392 393 395 591 592 593 594 595 596 597 712 713 714 715 716 717 ' +
  '718 719 721 722 723 724 725 726 728 729 351 352 353 354 355 356 357 358 359 421 422 423 424 425 426 429 434 435 ' +
  '436 438 443 447 451 452 453 454 455 456 457 459 731 734 735 737 777 311 319 323 324 325 327 818 821 823 824 825 ' +
  '826 828 829 951 953 954 958 971 972 222 223 224 231 232 233 236 237 238 241 243 244 245 246 247 248 249 427 441 ' +
  '442 983 984 987 988 997 998 444 481 482 485 486 487 488 489 667 668 669 673 687 694 695 696 622 623 631 632 633 ' +
  '634 636 637 638 641 642 643 644 645 647 651 652 913 914 917 923 932 933 934 936 937 993 831 832 833 834 835 836 ' +
  '841 846 867 868 899 226 228 229 235 272 273 274 278 279 281 282 283 284 285 287 288 296 985 986 991 999 437 458 ' +
  '492 493 494 495 498'
).split(/\s+/))

function startsWithMexicanLada(national: string): boolean {
  return MX_LADAS_2.has(national.slice(0, 2)) || MX_LADAS_3.has(national.slice(0, 3))
}

export const META_FORMAT_STATUS = 'pending-official-check' as const

function metaEmail(value: string | null): string {
  const email = value?.trim().toLowerCase() ?? ''
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) ? email : ''
}

/**
 * Mexican mobile/landline for Meta: 10 national digits (also written with
 * +52, 52, 521 or 0052 in front, with spaces, dashes or parentheses) become
 * +52XXXXXXXXXX. Anything else is not valid and returns null.
 */
export function normalizeMxPhone(value: string | null | undefined): string | null {
  let digits = (value ?? '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3)
  else if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2)
  return /^[2-9]\d{9}$/.test(digits) ? `+52${digits}` : null
}

/**
 * `suspicious`: 11 digits that start with 1 followed by a Mexican lada
 * (+1 226 506 6374 is a Veracruz number typed with the wrong country code).
 * It is reported to the page and never exported as +1.
 */
function metaPhone(value: string | null): { phone: string; country: string; suspicious: boolean } {
  const raw = value?.trim() ?? ''
  if (!raw) return { phone: '', country: '', suspicious: false }
  const mexican = normalizeMxPhone(raw)
  if (mexican) return { phone: mexican, country: 'MX', suspicious: false }
  const compact = raw.replace(/[\s().-]/g, '')
  const explicit = compact.startsWith('+') || compact.startsWith('00')
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!digits) return { phone: '', country: '', suspicious: false }
  if (digits.length === 11 && digits.startsWith('1') && startsWithMexicanLada(digits.slice(1))) {
    return { phone: '', country: '', suspicious: true }
  }
  if (digits.startsWith('52')) return { phone: '', country: '', suspicious: false }
  if (explicit && digits.startsWith('44') && digits.length === 12) return { phone: `+${digits}`, country: 'GB', suspicious: false }
  if (explicit && digits.startsWith('34') && digits.length === 11) return { phone: `+${digits}`, country: 'ES', suspicious: false }
  if (explicit && digits.startsWith('33') && digits.length === 11) return { phone: `+${digits}`, country: 'FR', suspicious: false }
  // +1 is shared by the US, Canada and the Caribbean: the code alone does not
  // identify one country, so country stays empty instead of guessing.
  if (explicit && digits.startsWith('1') && digits.length === 11) return { phone: `+${digits}`, country: '', suspicious: false }
  return { phone: '', country: '', suspicious: false }
}

function metaName(value: string | null): { fn: string; ln: string } {
  const letters = (value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  const [fn, ...rest] = letters.split(' ').filter(Boolean)
  return { fn: fn ?? '', ln: rest.join(' ') }
}

/** One row of a Meta file, with the contact it came from. ct and st are not known and stay empty. */
export type MetaEntry = {
  contact: MarketingContact
  email: string
  phone: string
  fn: string
  ln: string
  country: string
  suspiciousPhone: boolean
}

function toMetaEntry(contact: MarketingContact): MetaEntry {
  const { phone, country, suspicious } = metaPhone(contact.phone)
  const { fn, ln } = metaName(contact.name)
  return {
    contact,
    email: metaEmail(contact.email),
    phone,
    fn,
    ln,
    country: phone ? country : '',
    suspiciousPhone: suspicious,
  }
}

/**
 * Rows Meta can match, one per person. The email is the identity. A phone
 * identifies a row only when that row has no valid email, and then only
 * against rows that already have a phone. Two different emails that share a
 * phone stay two rows.
 */
function dedupeMetaEntries(entries: MetaEntry[]): MetaEntry[] {
  const usable = entries.filter((entry) => entry.email || entry.phone)
  const emails = new Set<string>()
  const phones = new Set<string>()
  const kept: MetaEntry[] = []
  for (const entry of usable) {
    if (!entry.email || emails.has(entry.email)) continue
    emails.add(entry.email)
    if (entry.phone) phones.add(entry.phone)
    kept.push(entry)
  }
  for (const entry of usable) {
    if (entry.email) continue
    if (phones.has(entry.phone)) continue
    phones.add(entry.phone)
    kept.push(entry)
  }
  return kept
}

/** A buyer is an order PAID or LEGACY_PAID with an amount, or a sale whose payment is already counted on a current order. */
export function isMarketingBuyer(contact: Pick<MarketingContact, 'status' | 'paidCents' | 'paymentCountedOnCurrent'>): boolean {
  return contact.status === 'PAID' && (contact.paidCents > 0 || contact.paymentCountedOnCurrent)
}

export type MarketingSegmentKey = 'general' | 'lookalike' | 'buyers' | 'retargeting'

export type MarketingSegments = {
  /** Every contact, all fields (internal base). */
  general: MarketingContact[]
  /** Everyone Meta can match: buyers plus people who left data. */
  lookalike: MetaEntry[]
  /** Only buyers: the exclusion audience. */
  buyers: MetaEntry[]
  /** Left data and did not buy. Nobody who is in `buyers`, by email or by phone. */
  retargeting: MetaEntry[]
  /** Phones written as +1 with a Mexican lada. Reported, never exported. */
  suspiciousPhones: MetaEntry[]
}

export function buildMarketingSegments(contacts: MarketingContact[]): MarketingSegments {
  const prepared = prepareMarketingContacts(contacts)
  const entries = prepared.map(toMetaEntry)
  const buyerEntries = entries.filter((entry) => isMarketingBuyer(entry.contact))
  const buyerEmails = new Set(
    buyerEntries.flatMap((entry) => [entry.email, entry.contact.email?.trim().toLowerCase() ?? '']).filter(Boolean),
  )
  const buyerPhones = new Set(buyerEntries.map((entry) => entry.phone).filter(Boolean))
  const retargeting = entries.filter((entry) => {
    if (entry.contact.status === 'PAID') return false
    const rawEmail = entry.contact.email?.trim().toLowerCase() ?? ''
    if (entry.email && buyerEmails.has(entry.email)) return false
    if (rawEmail && buyerEmails.has(rawEmail)) return false
    if (entry.phone && buyerPhones.has(entry.phone)) return false
    return true
  })
  return {
    general: prepared,
    lookalike: dedupeMetaEntries(entries),
    buyers: dedupeMetaEntries(buyerEntries),
    retargeting: dedupeMetaEntries(retargeting),
    suspiciousPhones: entries.filter((entry) => entry.suspiciousPhone),
  }
}

/** How many retargeting rows share an email or a phone with a buyer row. Must be 0. */
export function buyersRetargetingOverlap(segments: Pick<MarketingSegments, 'buyers' | 'retargeting'>): number {
  const emails = new Set(segments.buyers.map((entry) => entry.email).filter(Boolean))
  const phones = new Set(segments.buyers.map((entry) => entry.phone).filter(Boolean))
  return segments.retargeting.filter(
    (entry) => (entry.email && emails.has(entry.email)) || (entry.phone && phones.has(entry.phone)),
  ).length
}

export function metaEntriesToCsv(entries: MetaEntry[]): string {
  const lines = [META_CUSTOMER_COLUMNS.join(',')]
  for (const entry of entries) {
    lines.push([entry.email, entry.phone, entry.fn, entry.ln, entry.country, '', ''].map(metaCell).join(','))
  }
  return lines.join('\n')
}

/** Meta file for every person in the list that Meta can match (the lookalike audience). */
export function marketingContactsToMetaCsv(contacts: MarketingContact[]): string {
  return metaEntriesToCsv(dedupeMetaEntries(contacts.map(toMetaEntry)))
}

export const MARKETING_SEGMENT_LABEL: Record<MarketingSegmentKey, string> = {
  general: 'Base general',
  lookalike: 'Meta · Lookalike',
  buyers: 'Meta · Compradores (exclusión)',
  retargeting: 'Meta · Retargeting',
}

export const MARKETING_SEGMENT_USE: Record<MarketingSegmentKey, string> = {
  general: 'Uso interno: todos los contactos con todos sus campos. No se sube a Meta.',
  lookalike:
    'En Meta crea un público de clientes y úsalo como semilla de un público similar (lookalike): todos los contactos válidos, compradores y leads.',
  buyers:
    'En Meta súbelo como público de exclusión en las campañas de venta para no mostrar anuncios a quien ya compró.',
  retargeting:
    'En Meta úsalo como público de remarketing: dejaron sus datos o abandonaron el pago y no han comprado. Ningún comprador aparece aquí.',
}

const SEGMENT_FILE_SLUG: Record<MarketingSegmentKey, string> = {
  general: 'base-general',
  lookalike: 'meta_lookalike',
  buyers: 'meta_compradores',
  retargeting: 'meta_retargeting',
}

/** hex2026_meta_<segmento>_<AAAAMMDD-HHmm>.csv, time in America/Mérida. */
export function marketingFileName(segment: MarketingSegmentKey, now: Date): string {
  return `hex2026_${SEGMENT_FILE_SLUG[segment]}_${meridaFileStamp(now)}.csv`
}

export function marketingSegmentCsv(segment: MarketingSegmentKey, segments: MarketingSegments): string {
  return segment === 'general'
    ? marketingContactsToCsv(segments.general)
    : metaEntriesToCsv(segments[segment])
}

export type MarketingSegmentCard = {
  key: MarketingSegmentKey
  label: string
  use: string
  rows: number
  withEmail: number
  withPhone: number
  pctEmail: number
  pctPhone: number
}

export type MarketingBoard = {
  cards: MarketingSegmentCard[]
  totalContacts: number
  buyers: number
  /** Buyers as a share of everyone who left data (buyers included). */
  conversionPct: number
  suspiciousPhones: number
  overlap: number
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10
}

export function buildMarketingBoard(segments: MarketingSegments): MarketingBoard {
  const generalEntries = segments.general.map(toMetaEntry)
  const sets: Record<MarketingSegmentKey, { withEmail: number; withPhone: number; rows: number }> = {
    general: {
      rows: segments.general.length,
      withEmail: generalEntries.filter((entry) => entry.email).length,
      withPhone: generalEntries.filter((entry) => entry.phone).length,
    },
    lookalike: countMeta(segments.lookalike),
    buyers: countMeta(segments.buyers),
    retargeting: countMeta(segments.retargeting),
  }
  const keys: MarketingSegmentKey[] = ['general', 'lookalike', 'buyers', 'retargeting']
  const buyers = segments.general.filter(isMarketingBuyer).length
  return {
    cards: keys.map((key) => ({
      key,
      label: MARKETING_SEGMENT_LABEL[key],
      use: MARKETING_SEGMENT_USE[key],
      ...sets[key],
      pctEmail: pct(sets[key].withEmail, sets[key].rows),
      pctPhone: pct(sets[key].withPhone, sets[key].rows),
    })),
    totalContacts: segments.general.length,
    buyers,
    conversionPct: pct(buyers, segments.general.length),
    suspiciousPhones: segments.suspiciousPhones.length,
    overlap: buyersRetargetingOverlap(segments),
  }
}

function countMeta(entries: MetaEntry[]) {
  return {
    rows: entries.length,
    withEmail: entries.filter((entry) => entry.email).length,
    withPhone: entries.filter((entry) => entry.phone).length,
  }
}

export function marketingContactsToCsv(contacts: MarketingContact[]): string {
  const header = [
    'name',
    'email',
    'phone',
    'status',
    'categories',
    'purchase_count',
    'purchased_products',
    'paid_amount_mxn',
    'fecha_venta',
    'fecha_registro',
    'fecha_importacion',
    'origin',
    'consent',
  ]
  const lines = contacts.map((contact) => [
    contact.name,
    contact.email,
    contact.phone,
    contact.status,
    contact.categories.join(' | '),
    contact.purchaseCount ?? 0,
    (contact.purchasedProducts ?? []).join(' | '),
    (contact.paidCents / 100).toFixed(2),
    contact.saleAt,
    contact.registeredAt,
    contact.importedAt,
    contact.origin,
    contact.consent === 'recorded' ? 'recorded' : 'not_recorded',
  ].map(csvCell).join(','))
  return [header.join(','), ...lines].join('\n')
}

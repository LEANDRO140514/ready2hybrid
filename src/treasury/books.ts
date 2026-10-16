/**
 * Treasury proposal for the operations dashboard.
 * Scheduled expenses are not cash. Sales already counted in Ventas are not movements.
 * Catalog rows are deactivated, never deleted, so past movements keep their name.
 */

export type CatalogKind = 'category' | 'supplier' | 'account' | 'method'

export type CatalogItem = {
  id: string
  kind: CatalogKind
  name: string
  active: boolean
}

export type MovementKind = 'income' | 'expense' | 'opening'
export type MovementStatus = 'scheduled' | 'posted'

export type Revision = {
  at: string
  actor: string
  field: string
  before: string
  after: string
}

export type TreasuryMovement = {
  id: string
  kind: MovementKind
  status: MovementStatus
  accountId: string
  categoryId: string | null
  supplierId: string | null
  methodId: string | null
  amountCents: number
  occurredOn: string
  concept: string
  reference: string | null
  createdBy: string
  updatedBy: string
  revisions: Revision[]
}

export type TreasuryBooks = {
  catalogs: CatalogItem[]
  movements: TreasuryMovement[]
}

export const TREASURY_CSV_HEADER =
  'fecha,tipo,estado,cuenta,categoria,proveedor,forma_de_pago,concepto,monto,referencia'

const SALES_ALREADY_INTEGRATED = /venta|boleto|inscrip|checkout|mercado pago/i

export function looksLikeIntegratedSales(category: string, concept: string): boolean {
  return SALES_ALREADY_INTEGRATED.test(`${category} ${concept}`)
}

export function catalogName(books: TreasuryBooks, id: string | null): string {
  if (!id) return ''
  return books.catalogs.find((item) => item.id === id)?.name ?? ''
}

export function activeCatalog(books: TreasuryBooks, kind: CatalogKind): CatalogItem[] {
  return books.catalogs.filter((item) => item.kind === kind && item.active)
}

export function cashCents(books: TreasuryBooks, accountId?: string): number {
  return books.movements.reduce((sum, movement) => {
    if (movement.status !== 'posted') return sum
    if (accountId && movement.accountId !== accountId) return sum
    if (movement.kind === 'expense') return sum - movement.amountCents
    return sum + movement.amountCents
  }, 0)
}

export function scheduledCents(books: TreasuryBooks, accountId?: string): number {
  return books.movements.reduce((sum, movement) => {
    if (movement.kind !== 'expense' || movement.status !== 'scheduled') return sum
    if (accountId && movement.accountId !== accountId) return sum
    return sum + movement.amountCents
  }, 0)
}

export function addCatalog(
  books: TreasuryBooks,
  kind: CatalogKind,
  name: string,
): { ok: true; books: TreasuryBooks } | { ok: false; error: string } {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'El nombre es obligatorio.' }
  const existing = books.catalogs.find(
    (item) => item.kind === kind && item.name.localeCompare(trimmed, 'es', { sensitivity: 'accent' }) === 0,
  )
  if (existing?.active) return { ok: false, error: 'Ese nombre ya está en el catálogo.' }
  if (existing && !existing.active) return { ok: false, error: 'Ese nombre está inactivo. Actívalo en lugar de crear otro.' }
  return {
    ok: true,
    books: {
      ...books,
      catalogs: [...books.catalogs, { id: nextId('cat'), kind, name: trimmed, active: true }],
    },
  }
}

export function renameCatalog(
  books: TreasuryBooks,
  id: string,
  name: string,
): { ok: true; books: TreasuryBooks } | { ok: false; error: string } {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'El nombre es obligatorio.' }
  const current = books.catalogs.find((item) => item.id === id)
  if (!current) return { ok: false, error: 'No está en el catálogo.' }
  const clash = books.catalogs.find(
    (item) => item.id !== id && item.kind === current.kind && item.name.localeCompare(trimmed, 'es', { sensitivity: 'accent' }) === 0,
  )
  if (clash) return { ok: false, error: 'Ese nombre ya está en el catálogo.' }
  return {
    ok: true,
    books: {
      ...books,
      catalogs: books.catalogs.map((item) => (item.id === id ? { ...item, name: trimmed } : item)),
    },
  }
}

export function setCatalogActive(books: TreasuryBooks, id: string, active: boolean): TreasuryBooks {
  return {
    ...books,
    catalogs: books.catalogs.map((item) => (item.id === id ? { ...item, active } : item)),
  }
}

export type MovementDraft = {
  kind: MovementKind
  status: MovementStatus
  accountId: string
  categoryId: string | null
  supplierId: string | null
  methodId: string | null
  amountCents: number
  occurredOn: string
  concept: string
  reference: string | null
}

export function addMovement(
  books: TreasuryBooks,
  draft: MovementDraft,
  actor: string,
  _at: string,
): { ok: true; books: TreasuryBooks } | { ok: false; error: string } {
  const error = validateDraft(books, draft, null)
  if (error) return { ok: false, error }
  if (books.movements.some((movement) => signature(movement) === signature(draft))) {
    return { ok: false, error: 'Ese movimiento ya está cargado.' }
  }
  const movement: TreasuryMovement = {
    ...draft,
    id: nextId('mov'),
    concept: draft.concept.trim(),
    reference: blankToNull(draft.reference),
    createdBy: actor,
    updatedBy: actor,
    revisions: [],
  }
  return { ok: true, books: { ...books, movements: [...books.movements, movement] } }
}

export function correctMovement(
  books: TreasuryBooks,
  id: string,
  draft: MovementDraft,
  actor: string,
  at: string,
): { ok: true; books: TreasuryBooks } | { ok: false; error: string } {
  const current = books.movements.find((movement) => movement.id === id)
  if (!current) return { ok: false, error: 'El movimiento no existe.' }
  const error = validateDraft(books, draft, id)
  if (error) return { ok: false, error }
  if (books.movements.some((movement) => movement.id !== id && signature(movement) === signature(draft))) {
    return { ok: false, error: 'Ese movimiento ya está cargado.' }
  }
  const revisions = diffMovement(current, draft, actor, at)
  return {
    ok: true,
    books: {
      ...books,
      movements: books.movements.map((movement) =>
        movement.id === id
          ? {
            ...movement,
            ...draft,
            concept: draft.concept.trim(),
            reference: blankToNull(draft.reference),
            updatedBy: revisions.length > 0 ? actor : movement.updatedBy,
            revisions: [...movement.revisions, ...revisions],
          }
          : movement,
      ),
    },
  }
}

export type ImportIssue = { line: number; level: 'error' | 'duplicate'; message: string }

export type ImportPlan = {
  issues: ImportIssue[]
  ready: MovementDraft[]
}

export function parseTreasuryCsv(text: string): { ok: true; rows: string[][] } | { ok: false; error: string } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return { ok: false, error: 'El archivo está vacío.' }
  const header = splitCsvLine(lines[0] ?? '')
  const expected = TREASURY_CSV_HEADER.split(',')
  if (header.length !== expected.length || header.some((cell, index) => cell !== expected[index])) {
    return { ok: false, error: `La primera fila debe ser: ${TREASURY_CSV_HEADER}` }
  }
  return { ok: true, rows: lines.slice(1).map(splitCsvLine) }
}

export function planImport(books: TreasuryBooks, text: string): { ok: true; plan: ImportPlan } | { ok: false; error: string } {
  const parsed = parseTreasuryCsv(text)
  if (!parsed.ok) return parsed
  const issues: ImportIssue[] = []
  const ready: MovementDraft[] = []
  const seen = new Set(books.movements.map(signature))
  parsed.rows.forEach((cells, index) => {
    const line = index + 2
    if (cells.length !== 10) {
      issues.push({ line, level: 'error', message: 'La fila no tiene 10 columnas.' })
      return
    }
    const [fecha, tipo, estado, cuenta, categoria, proveedor, forma, concepto, monto, referencia] = cells as [
      string, string, string, string, string, string, string, string, string, string,
    ]
    const draft = draftFromCells({ fecha, tipo, estado, cuenta, categoria, proveedor, forma, concepto, monto, referencia }, books)
    if (!draft.ok) {
      issues.push({ line, level: 'error', message: draft.error })
      return
    }
    const key = signature(draft.draft)
    if (seen.has(key)) {
      issues.push({ line, level: 'duplicate', message: 'Ya existe un movimiento con la misma referencia o la misma fecha, cuenta, tipo, monto y concepto.' })
      return
    }
    seen.add(key)
    ready.push(draft.draft)
  })
  return { ok: true, plan: { issues, ready } }
}

export function confirmImport(
  books: TreasuryBooks,
  ready: MovementDraft[],
  actor: string,
  at: string,
): TreasuryBooks {
  return ready.reduce((next, draft) => {
    const added = addMovement(next, draft, actor, at)
    return added.ok ? added.books : next
  }, books)
}

export function parsePesosToCents(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmed)) return null
  const normalized = trimmed.replace(',', '.')
  const pesos = Number(normalized)
  if (!Number.isFinite(pesos) || pesos <= 0) return null
  return Math.round(pesos * 100)
}

export const EXAMPLE_ACTOR = 'Robert (ejemplo)'

export const EXAMPLE_BOOKS: TreasuryBooks = {
  catalogs: [
    { id: 'acc-caja', kind: 'account', name: 'Caja del evento', active: true },
    { id: 'acc-bbva', kind: 'account', name: 'Cuenta BBVA', active: true },
    { id: 'cat-renta', kind: 'category', name: 'Renta de sede', active: true },
    { id: 'cat-honorarios', kind: 'category', name: 'Honorarios', active: true },
    { id: 'cat-patrocinio', kind: 'category', name: 'Patrocinio', active: true },
    { id: 'sup-audio', kind: 'supplier', name: 'Audio Norte', active: true },
    { id: 'sup-sede', kind: 'supplier', name: 'Municipio', active: true },
    { id: 'met-transfer', kind: 'method', name: 'Transferencia', active: true },
    { id: 'met-efectivo', kind: 'method', name: 'Efectivo', active: true },
  ],
  movements: [
    movement('mov-open', 'opening', 'posted', 'acc-caja', null, null, null, 500000, '2026-08-01', 'Saldo inicial de caja', null),
    movement('mov-sponsor', 'income', 'posted', 'acc-bbva', 'cat-patrocinio', null, 'met-transfer', 2000000, '2026-09-02', 'Patrocinio local', 'PAT-01'),
    movement('mov-rent', 'expense', 'posted', 'acc-bbva', 'cat-renta', 'sup-sede', 'met-transfer', 800000, '2026-09-10', 'Anticipo de sede', 'RENTA-01'),
    movement('mov-audio', 'expense', 'scheduled', 'acc-bbva', 'cat-honorarios', 'sup-audio', 'met-transfer', 300000, '2026-10-20', 'Audio del viernes', 'AUDIO-01'),
  ],
}

function movement(
  id: string,
  kind: MovementKind,
  status: MovementStatus,
  accountId: string,
  categoryId: string | null,
  supplierId: string | null,
  methodId: string | null,
  amountCents: number,
  occurredOn: string,
  concept: string,
  reference: string | null,
): TreasuryMovement {
  return {
    id,
    kind,
    status,
    accountId,
    categoryId,
    supplierId,
    methodId,
    amountCents,
    occurredOn,
    concept,
    reference,
    createdBy: EXAMPLE_ACTOR,
    updatedBy: EXAMPLE_ACTOR,
    revisions: [],
  }
}

function validateDraft(books: TreasuryBooks, draft: MovementDraft, ignoreId: string | null): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.occurredOn)) return 'La fecha debe ser AAAA-MM-DD.'
  if (!Number.isInteger(draft.amountCents) || draft.amountCents <= 0) return 'El monto debe ser mayor que cero.'
  if (!draft.concept.trim()) return 'El concepto es obligatorio.'
  if (looksLikeIntegratedSales(catalogName(books, draft.categoryId), draft.concept)) {
    return 'Ese ingreso ya está en Ventas. No se captura otra vez en tesorería.'
  }
  const account = books.catalogs.find((item) => item.id === draft.accountId && item.kind === 'account')
  if (!account?.active) return 'La cuenta no está activa.'
  if (draft.kind !== 'opening') {
    const category = books.catalogs.find((item) => item.id === draft.categoryId && item.kind === 'category')
    if (!category?.active) return 'La categoría no está activa.'
  }
  if (draft.supplierId) {
    const supplier = books.catalogs.find((item) => item.id === draft.supplierId && item.kind === 'supplier')
    if (!supplier?.active) return 'El proveedor no está activo.'
  }
  if (draft.methodId) {
    const method = books.catalogs.find((item) => item.id === draft.methodId && item.kind === 'method')
    if (!method?.active) return 'La forma de pago no está activa.'
  }
  if (draft.kind !== 'expense' && draft.status === 'scheduled') return 'Solo un egreso puede quedar programado.'
  if (draft.kind === 'opening') {
    const other = books.movements.find((movement) => movement.kind === 'opening' && movement.accountId === draft.accountId && movement.id !== ignoreId)
    if (other) return 'Esa cuenta ya tiene saldo inicial.'
  }
  return null
}

function draftFromCells(
  cells: {
    fecha: string
    tipo: string
    estado: string
    cuenta: string
    categoria: string
    proveedor: string
    forma: string
    concepto: string
    monto: string
    referencia: string
  },
  books: TreasuryBooks,
): { ok: true; draft: MovementDraft } | { ok: false; error: string } {
  const kind = kindFromLabel(cells.tipo)
  if (!kind) return { ok: false, error: 'El tipo debe ser ingreso, egreso o saldo_inicial.' }
  const status = cells.estado.trim().toLowerCase()
  if (status !== 'programado' && status !== 'realizado') return { ok: false, error: 'El estado debe ser programado o realizado.' }
  if (looksLikeIntegratedSales(cells.categoria, cells.concepto)) {
    return { ok: false, error: 'Ese ingreso ya está en Ventas. No se captura otra vez en tesorería.' }
  }
  const amountCents = parsePesosToCents(cells.monto)
  if (amountCents == null) return { ok: false, error: 'El monto debe ser un número mayor que cero, con hasta dos decimales.' }
  const account = findByName(books, 'account', cells.cuenta)
  if (!account) return { ok: false, error: `La cuenta "${cells.cuenta}" no está en el catálogo activo.` }
  const category = cells.categoria.trim() ? findByName(books, 'category', cells.categoria) : null
  if (kind !== 'opening' && !category) return { ok: false, error: `La categoría "${cells.categoria}" no está en el catálogo activo.` }
  if (kind === 'opening' && cells.categoria.trim() && !category) {
    return { ok: false, error: `La categoría "${cells.categoria}" no está en el catálogo activo.` }
  }
  const supplier = cells.proveedor.trim() ? findByName(books, 'supplier', cells.proveedor) : null
  if (cells.proveedor.trim() && !supplier) return { ok: false, error: `El proveedor "${cells.proveedor}" no está en el catálogo activo.` }
  const method = cells.forma.trim() ? findByName(books, 'method', cells.forma) : null
  if (cells.forma.trim() && !method) return { ok: false, error: `La forma de pago "${cells.forma}" no está en el catálogo activo.` }
  const draft: MovementDraft = {
    kind,
    status: status === 'programado' ? 'scheduled' : 'posted',
    accountId: account.id,
    categoryId: category?.id ?? null,
    supplierId: supplier?.id ?? null,
    methodId: method?.id ?? null,
    amountCents,
    occurredOn: cells.fecha.trim(),
    concept: cells.concepto,
    reference: cells.referencia,
  }
  const error = validateDraft(books, draft, null)
  if (error) return { ok: false, error }
  return { ok: true, draft }
}

function findByName(books: TreasuryBooks, kind: CatalogKind, name: string): CatalogItem | null {
  const trimmed = name.trim()
  return books.catalogs.find(
    (item) => item.kind === kind && item.active && item.name.localeCompare(trimmed, 'es', { sensitivity: 'accent' }) === 0,
  ) ?? null
}

function kindFromLabel(value: string): MovementKind | null {
  const label = value.trim().toLowerCase()
  if (label === 'ingreso') return 'income'
  if (label === 'egreso') return 'expense'
  if (label === 'saldo_inicial') return 'opening'
  return null
}

function signature(movement: Pick<TreasuryMovement, 'kind' | 'accountId' | 'amountCents' | 'occurredOn' | 'concept' | 'reference'> | MovementDraft): string {
  const reference = blankToNull(movement.reference)
  if (reference) return `ref:${reference.toLowerCase()}`
  return [
    'fp',
    movement.occurredOn,
    movement.accountId,
    movement.kind,
    String(movement.amountCents),
    movement.concept.trim().toLowerCase(),
  ].join('|')
}

function diffMovement(current: TreasuryMovement, draft: MovementDraft, actor: string, at: string): Revision[] {
  const pairs: [string, string, string][] = [
    ['tipo', current.kind, draft.kind],
    ['estado', current.status, draft.status],
    ['cuenta', current.accountId, draft.accountId],
    ['categoría', current.categoryId ?? '', draft.categoryId ?? ''],
    ['proveedor', current.supplierId ?? '', draft.supplierId ?? ''],
    ['forma de pago', current.methodId ?? '', draft.methodId ?? ''],
    ['monto', String(current.amountCents), String(draft.amountCents)],
    ['fecha', current.occurredOn, draft.occurredOn],
    ['concepto', current.concept, draft.concept.trim()],
    ['referencia', current.reference ?? '', blankToNull(draft.reference) ?? ''],
  ]
  return pairs
    .filter(([, before, after]) => before !== after)
    .map(([field, before, after]) => ({ at, actor, field, before, after }))
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

let sequence = 0
function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-${sequence}`
}

export function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

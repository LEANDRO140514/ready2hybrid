/**
 * Treasury books. Balance is recomputed on read. Sales are not movements.
 * Posted transfers move cash between accounts and are not income or expense.
 * Cancelled rows stay visible and affect neither cash nor the projection.
 */

export type MovementType = 'income' | 'expense' | 'transfer'
export type MovementStatus = 'scheduled' | 'posted' | 'cancelled'
export type PaymentMethod = 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque' | 'otro'
export type CategoryKind = 'income' | 'expense'

export type TreasuryAccount = {
  id: string
  name: string
  active: boolean
  openingBalanceCents: number
  openingDate: string
}

export type TreasuryCategory = {
  id: string
  name: string
  kind: CategoryKind
  active: boolean
}

export type TreasuryMovement = {
  id: string
  type: MovementType
  status: MovementStatus
  accountId: string
  destinationAccountId: string | null
  categoryId: string | null
  paymentMethod: PaymentMethod | null
  amountCents: number
  occurredOn: string
  concept: string
  counterparty: string | null
  notes: string | null
  cancelReason: string | null
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

export type TreasuryBooks = {
  accounts: TreasuryAccount[]
  categories: TreasuryCategory[]
  movements: TreasuryMovement[]
}

export type TreasuryFilters = {
  accountId: string
  categoryId: string
  paymentMethod: string
  type: string
  from: string
  to: string
  status: string
}

export const EMPTY_TREASURY_FILTERS: TreasuryFilters = {
  accountId: '',
  categoryId: '',
  paymentMethod: '',
  type: '',
  from: '',
  to: '',
  status: '',
}

export const FLOW_THROUGH = '2026-11-30'
const MERIDA_SHIFT_MS = 6 * 60 * 60 * 1000

const METHOD_LABEL: Record<PaymentMethod, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
  otro: 'Otro',
}

const TYPE_LABEL: Record<MovementType, string> = {
  income: 'Ingreso',
  expense: 'Egreso',
  transfer: 'Transferencia',
}

const STATUS_LABEL: Record<MovementStatus, string> = {
  posted: 'Realizado',
  scheduled: 'Programado',
  cancelled: 'Cancelado',
}

export function meridaToday(now: Date): string {
  const shifted = new Date(now.getTime() - MERIDA_SHIFT_MS)
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${month}-${day}`
}

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function formatSpanishDate(value: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!match) return ''
  const month = SPANISH_MONTHS[Number(match[2]) - 1]
  const day = Number(match[3])
  if (!month || day < 1 || day > 31) return ''
  return `${day} de ${month} de ${match[1]}`
}

export function formatMeridaDate(value: string | null): string {
  if (!value) return ''
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return ''
  const shifted = new Date(ms - MERIDA_SHIFT_MS)
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${day}/${month}/${shifted.getUTCFullYear()}`
}

export function meridaFileStamp(now: Date): string {
  const shifted = new Date(now.getTime() - MERIDA_SHIFT_MS)
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  const hour = String(shifted.getUTCHours()).padStart(2, '0')
  const minute = String(shifted.getUTCMinutes()).padStart(2, '0')
  return `${shifted.getUTCFullYear()}${month}${day}-${hour}${minute}`
}

export function treasuryFileName(kind: 'movimientos' | 'programacion' | 'flujo', now: Date): string {
  return `hex2026_${kind}_${meridaFileStamp(now)}.csv`
}

function pesos(cents: number): string {
  return (cents / 100).toFixed(2)
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

function csvLine(cells: string[]): string {
  return cells.map(csvCell).join(',')
}

function accountName(books: TreasuryBooks, id: string | null): string {
  if (!id) return ''
  return books.accounts.find((account) => account.id === id)?.name ?? ''
}

function categoryName(books: TreasuryBooks, id: string | null): string {
  if (!id) return ''
  return books.categories.find((category) => category.id === id)?.name ?? ''
}

export function accountCashCents(books: TreasuryBooks, accountId: string): number {
  const account = books.accounts.find((row) => row.id === accountId)
  if (!account) return 0
  return books.movements.reduce((sum, movement) => {
    if (movement.status !== 'posted') return sum
    if (movement.type === 'income' && movement.accountId === accountId) return sum + movement.amountCents
    if (movement.type === 'expense' && movement.accountId === accountId) return sum - movement.amountCents
    if (movement.type === 'transfer' && movement.accountId === accountId) return sum - movement.amountCents
    if (movement.type === 'transfer' && movement.destinationAccountId === accountId) return sum + movement.amountCents
    return sum
  }, account.openingBalanceCents)
}

export function treasuryCashCents(books: TreasuryBooks, accountId = ''): number {
  const accounts = accountId
    ? books.accounts.filter((account) => account.id === accountId)
    : books.accounts
  return accounts.reduce((sum, account) => sum + accountCashCents(books, account.id), 0)
}

export function movementMatches(movement: TreasuryMovement, filters: TreasuryFilters): boolean {
  if (filters.accountId && movement.accountId !== filters.accountId && movement.destinationAccountId !== filters.accountId) {
    return false
  }
  if (filters.categoryId && movement.categoryId !== filters.categoryId) return false
  if (filters.paymentMethod && movement.paymentMethod !== filters.paymentMethod) return false
  if (filters.type && movement.type !== filters.type) return false
  if (filters.from && movement.occurredOn < filters.from) return false
  if (filters.to && movement.occurredOn > filters.to) return false
  if (filters.status && movement.status !== filters.status && movement.status !== 'cancelled') return false
  return true
}

function commentOf(movement: TreasuryMovement): string {
  const notes = movement.notes?.trim() ?? ''
  if (movement.status !== 'cancelled') return notes
  const reason = movement.cancelReason?.trim() ?? ''
  if (notes && reason) return `${notes} | ${reason}`
  return notes || reason
}

export function movementsToCsv(books: TreasuryBooks, filters: TreasuryFilters): string {
  const header = [
    'FECHA', 'PROYECTO', 'PROVEEDOR', 'CONCEPTO', 'CONCEPTO GENERAL', 'MONTO',
    'TIPO DE MOVIMIENTO', 'FORMA DE PAGO', 'CUENTA', 'COMENTARIO', 'ESTATUS',
    'CUENTA DESTINO', 'ID', 'CAPTURADO POR', 'FECHA CAPTURA',
  ]
  const lines = books.movements
    .filter((movement) => movementMatches(movement, filters))
    .map((movement) => csvLine([
      formatMeridaDate(movement.occurredOn),
      'HEX-2026',
      movement.counterparty ?? '',
      movement.concept,
      categoryName(books, movement.categoryId),
      pesos(movement.amountCents),
      TYPE_LABEL[movement.type],
      movement.paymentMethod ? METHOD_LABEL[movement.paymentMethod] : '',
      accountName(books, movement.accountId),
      commentOf(movement),
      STATUS_LABEL[movement.status],
      accountName(books, movement.destinationAccountId),
      movement.id,
      movement.createdBy,
      formatMeridaDate(movement.createdAt),
    ]))
  return `\uFEFF${[header.join(','), ...lines].join('\n')}\n`
}

function mondayOf(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day))
  const weekday = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday))
  return date.toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function scheduleLabel(occurredOn: string, today: string): string {
  if (occurredOn < today) return 'Vencido'
  const thisEnd = addDays(mondayOf(today), 6)
  if (occurredOn <= thisEnd) return 'Esta semana'
  if (occurredOn <= addDays(thisEnd, 7)) return 'Próxima'
  return 'Después'
}

export function scheduleToCsv(
  books: TreasuryBooks,
  filters: TreasuryFilters,
  today: string,
  selectedIds: string[],
): string {
  const header = ['CONCEPTO', 'PROVEEDOR', 'CATEGORÍA', 'FECHA', 'ESTADO', 'IMPORTE', 'CUENTA', 'OBSERVACIÓN']
  const rows = books.movements.filter(
    (movement) => movement.status === 'scheduled' && movementMatches(movement, { ...filters, status: '' }),
  )
  const lines = rows.map((movement) => csvLine([
    movement.concept,
    movement.counterparty ?? '',
    categoryName(books, movement.categoryId),
    formatMeridaDate(movement.occurredOn),
    scheduleLabel(movement.occurredOn, today),
    pesos(movement.amountCents),
    accountName(books, movement.accountId),
    movement.notes ?? '',
  ]))
  const marked = selectedIds.length > 0
  const selected = marked
    ? rows.filter((movement) => selectedIds.includes(movement.id))
    : rows
  const selectedCents = selected.reduce((sum, movement) => sum + movement.amountCents, 0)
  const available = treasuryCashCents(books, filters.accountId)
  const deficit = Math.max(0, selectedCents - available)
  const selectedLabel = marked ? 'Seleccionado (filas marcadas)' : 'Seleccionado (suma exportada)'
  lines.push(
    csvLine(['Disponible', '', '', '', '', pesos(available), '', '']),
    csvLine([selectedLabel, '', '', '', '', pesos(selectedCents), '', '']),
    csvLine(['Déficit', '', '', '', '', pesos(deficit), '', '']),
  )
  return `\uFEFF${[header.join(','), ...lines].join('\n')}\n`
}

export type WeekFlow = {
  week: string
  openingCents: number
  incomeCents: number
  expenseCents: number
  closingCents: number
  deficit: boolean
}

export function weeklyFlow(books: TreasuryBooks, today: string, through = FLOW_THROUGH): WeekFlow[] {
  const scheduled = books.movements.filter(
    (movement) => movement.status === 'scheduled' && (movement.type === 'income' || movement.type === 'expense'),
  )
  const weeks: WeekFlow[] = []
  let opening = treasuryCashCents(books)
  let cursor = mondayOf(today)
  const firstEnd = addDays(cursor, 6)
  while (cursor <= through) {
    const end = addDays(cursor, 6)
    const inWeek = scheduled.filter((movement) => {
      if (cursor === mondayOf(today)) return movement.occurredOn <= firstEnd
      return movement.occurredOn >= cursor && movement.occurredOn <= end
    })
    const incomeCents = inWeek
      .filter((movement) => movement.type === 'income')
      .reduce((sum, movement) => sum + movement.amountCents, 0)
    const expenseCents = inWeek
      .filter((movement) => movement.type === 'expense')
      .reduce((sum, movement) => sum + movement.amountCents, 0)
    const closing = opening + incomeCents - expenseCents
    weeks.push({
      week: formatMeridaDate(cursor),
      openingCents: opening,
      incomeCents,
      expenseCents,
      closingCents: closing,
      deficit: closing < 0,
    })
    opening = closing
    cursor = addDays(end, 1)
  }
  return weeks
}

export function weeklyFlowToCsv(books: TreasuryBooks, today: string): string {
  const header = ['SEMANA', 'SALDO INICIAL', 'INGRESOS ESPERADOS', 'EGRESOS PROGRAMADOS', 'SALDO FINAL', 'DÉFICIT']
  const lines = weeklyFlow(books, today).map((week) => csvLine([
    week.week,
    pesos(week.openingCents),
    pesos(week.incomeCents),
    pesos(week.expenseCents),
    pesos(week.closingCents),
    week.deficit ? 'Sí' : 'No',
  ]))
  return `\uFEFF${[header.join(','), ...lines].join('\n')}\n`
}

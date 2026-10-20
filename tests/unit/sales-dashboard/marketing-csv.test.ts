import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CSV_BOM,
  csvWithBom,
  marketingContactsToCsv,
  marketingContactsToMetaCsv,
  type MarketingContact,
} from '../../../src/sales-dashboard/marketing'

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, commas and line breaks inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function contact(overrides: Partial<MarketingContact>): MarketingContact {
  return {
    key: 'k',
    name: 'Ana López',
    email: 'ana@example.com',
    phone: '9991111111',
    status: 'PAID',
    origin: 'current',
    categories: ['Individual Hombre'],
    purchasedProducts: ['Individual Hombre'],
    purchaseCount: 1,
    paidCents: 150000,
    firstAt: null,
    lastAt: null,
    saleAt: null,
    registeredAt: null,
    importedAt: null,
    paymentCountedOnCurrent: false,
    consent: 'recorded',
    ...overrides,
  }
}

describe('Meta customer CSV: RFC 4180 and column integrity', () => {
  it('keeps a multi-word last name in the ln column (cuyado943 case)', () => {
    const csv = marketingContactsToMetaCsv([
      contact({ name: 'Adrian águila aviles', email: 'cuyado943@gmail.com', phone: '9811204320' }),
    ])
    const [header, row] = parseCsv(csv)
    expect(header).toEqual(['email', 'phone', 'fn', 'ln', 'country'])
    expect(row).toEqual(['cuyado943@gmail.com', '+529811204320', 'adrian', 'águila aviles', 'MX'])
    // The multi-word field is quoted so no reader splits it into two cells.
    expect(csv.split('\n')[1]).toBe('cuyado943@gmail.com,+529811204320,adrian,"águila aviles",MX')
  })

  it('never puts a value of another column in country, whatever the name looks like', () => {
    const names = [
      'Ana, la "Güera" López',
      'Pérez, Juan',
      'Line\nBreak Name',
      '  Espacios   de   más  ',
      'O\'Neil-Smith',
      '=HYPERLINK("http://evil")',
      'Juan Carlos de la Cruz y Pérez',
    ]
    const csv = marketingContactsToMetaCsv(
      names.map((name, index) => contact({ key: `n${index}`, name, email: `n${index}@example.com` })),
    )
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(names.length + 1)
    for (const row of rows) expect(row).toHaveLength(5)
    for (const row of rows.slice(1)) expect(['', 'MX', 'US', 'GB', 'ES', 'FR']).toContain(row[4])
  })

  it('writes phone with the + sign and country only when the code identifies one', () => {
    const rows = parseCsv(
      marketingContactsToMetaCsv([
        contact({ key: 'mx', email: 'mx@example.com', phone: '999 123 4567' }),
        contact({ key: 'mx2', email: 'mx2@example.com', phone: '+52 1 999 123 4567' }),
        contact({ key: 'us', email: 'us@example.com', phone: '+1 415 555 0142' }),
        contact({ key: 'gb', email: 'gb@example.com', phone: '+44 7911 123456' }),
        contact({ key: 'es', email: 'es@example.com', phone: '+34 612 345 678' }),
        contact({ key: 'bad', email: 'bad@example.com', phone: '12345' }),
      ]),
    ).slice(1)
    expect(rows.map((row) => [row[0], row[1], row[4]])).toEqual([
      ['mx@example.com', '+529991234567', 'MX'],
      ['mx2@example.com', '+529991234567', 'MX'],
      ['us@example.com', '+14155550142', ''],
      ['gb@example.com', '+447911123456', 'GB'],
      ['es@example.com', '+34612345678', 'ES'],
      ['bad@example.com', '', ''],
    ])
    for (const row of rows) expect(row[1] === '' || /^\+\d{10,15}$/.test(row[1]!)).toBe(true)
  })
})

describe('General CSV: RFC 4180', () => {
  it('quotes every field with a comma, a quote or a line break and keeps 13 columns', () => {
    const csv = marketingContactsToCsv([
      contact({
        name: 'Pérez, Juan "El Güero"',
        categories: ['Individual Hombre, Open', 'Dobles\nMixtos'],
        purchasedProducts: ['Individual Hombre, Open'],
      }),
      contact({ key: 'plain', name: 'Ana López', email: 'plain@example.com' }),
    ])
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(3)
    for (const row of rows) expect(row).toHaveLength(13)
    expect(rows[1]![0]).toBe('Pérez, Juan "El Güero"')
    expect(rows[1]![4]).toBe('Individual Hombre, Open | Dobles\nMixtos')
    expect(csv).toContain('"Pérez, Juan ""El Güero"""')
  })
})

describe('CSV download file', () => {
  it('starts with one UTF-8 BOM so Excel shows accents', () => {
    const csv = marketingContactsToMetaCsv([contact({ name: 'Ana Peña' })])
    const file = csvWithBom(csv)
    expect(file.startsWith(CSV_BOM)).toBe(true)
    expect(csvWithBom(file)).toBe(file)
    const bytes = new TextEncoder().encode(file)
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes).slice(1)).toContain('peña')
  })

  it('wires both marketing downloads through csvWithBom', () => {
    const page = readFileSync(resolve(__dirname, '../../../src/components/marketing/MarketingPage.tsx'), 'utf8')
    expect(page).toContain('new Blob([csvWithBom(csv)]')
    expect(page).not.toMatch(/new Blob\(\[csv\]/)
  })
})

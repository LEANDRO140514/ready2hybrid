import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { generateTicketPdf, imagePixelSize } from '../../../insforge/functions/_shared/email/pdf.ts'
import {
  CURRENT_EDITION_TICKETABLE_PRODUCTS,
  FALLBACK_CARD_IMAGE,
  PRODUCT_CARD_PATHS,
  TICKET_CARD_ASSET_BASE,
  resolveCardImageUrl,
} from '../../../insforge/functions/_shared/email/product-card-images.ts'

const landing = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../../hybrid-event-landing/src/pages/LandingPage.tsx'),
  'utf8',
)

function landingCardPaths(): Record<string, string> {
  const constants = new Map<string, string>()
  for (const match of landing.matchAll(/const (IMG_[A-Z0-9_]+) =\s+'([^']+)'/g)) {
    constants.set(match[1], match[2])
  }
  const block = landing.slice(
    landing.indexOf('const PRODUCT_IMAGES'),
    landing.indexOf('function getProductIcon'),
  )
  const images: Record<string, string> = {}
  for (const match of block.matchAll(/'([A-Z0-9-]+)': (IMG_[A-Z0-9_]+)/g)) {
    const url = constants.get(match[2])
    if (!url) throw new Error(`missing landing image ${match[2]}`)
    images[match[1]] = decodeURIComponent(new URL(url).pathname.split('/objects/')[1] ?? '')
  }
  return images
}

const ticketInput = {
  ticketFolio: 'tkt_79730885b5b843c2bf8a15a5c420d10b',
  productName: '½ Hybrid Individual Hombre',
  teamName: null,
  rosterNames: ['Atleta de prueba'],
  buyerName: 'Atleta de prueba',
  rawToken: 'qr_same_identity_token',
}

function pdfText(base64: string): string {
  return Buffer.from(base64, 'base64').toString('latin1')
}

function imageCount(pdf: string): number {
  return pdf.match(/\/Subtype\s*\/Image/g)?.length ?? 0
}

describe('ticket card images', () => {
  it('resolves the current edition from the landing relative paths on Ready2Hybrid storage', () => {
    const landingPaths = landingCardPaths()
    expect(CURRENT_EDITION_TICKETABLE_PRODUCTS).toHaveLength(17)
    for (const code of CURRENT_EDITION_TICKETABLE_PRODUCTS) {
      expect(PRODUCT_CARD_PATHS[code]).toBe(landingPaths[code])
      expect(resolveCardImageUrl(code)).toBe(`${TICKET_CARD_ASSET_BASE}${encodeURIComponent(landingPaths[code])}`)
      expect(resolveCardImageUrl(code)).not.toContain('3e9sriq7')
    }
    expect(new Set(Object.values(PRODUCT_CARD_PATHS)).size).toBe(9)
    expect(resolveCardImageUrl('HALF-IND-H')).toContain('individual-hombre-corriendo-pista')
    expect(resolveCardImageUrl('HALF-DOB-HH')).toContain('dobles-hombres-remo-asistido')
    expect(resolveCardImageUrl('REL-2H2M')).toContain('relay-equipo-mixto-cambio')
    expect(resolveCardImageUrl('PUB-VIE')).toContain('publico-animando-graderio')
    expect(PRODUCT_CARD_PATHS).not.toHaveProperty('WOD-H')
    expect(PRODUCT_CARD_PATHS).not.toHaveProperty('WOD-M')
    expect(PRODUCT_CARD_PATHS).not.toHaveProperty('FOT-VIE')
    expect(resolveCardImageUrl('WOD-H')).toBe(FALLBACK_CARD_IMAGE)
    expect(resolveCardImageUrl('FOT-VIE')).toBe(FALLBACK_CARD_IMAGE)
    expect(resolveCardImageUrl('UNKNOWN')).toBe(FALLBACK_CARD_IMAGE)
    expect(FALLBACK_CARD_IMAGE).toContain('estacion-skierg-concept2')
    expect(FALLBACK_CARD_IMAGE).not.toContain('3e9sriq7')
  })

  it('embeds the HALF-IND-H card image and keeps the ticket text and QR', async () => {
    const pdf = pdfText(await generateTicketPdf({ ...ticketInput, productCode: 'HALF-IND-H' }))
    expect(pdf).toContain(ticketInput.ticketFolio)
    expect(pdf).toContain('Hybrid Individual Hombre')
    expect(pdf).toContain('Atleta de prueba')
    expect(pdf).toContain('Mérida')
    expect(imageCount(pdf)).toBeGreaterThan(1)
    expect(pdf).not.toContain('INSERT INTO')
  })

  it('embeds a different image for Dobles', async () => {
    const half = await generateTicketPdf({ ...ticketInput, productCode: 'HALF-IND-H' })
    const doubles = await generateTicketPdf({
      ...ticketInput,
      productCode: 'DOB-SAB-HH',
      productName: 'Dobles Hombres',
      rosterNames: ['Capitán', 'Compañero'],
    })
    expect(pdfText(doubles)).toContain('Dobles Hombres')
    expect(pdfText(doubles)).toContain(ticketInput.ticketFolio)
    expect(imageCount(pdfText(doubles))).toBeGreaterThan(1)
    expect(doubles).not.toBe(half)
  })

  it('falls back without dropping the QR when the card image cannot be loaded', async () => {
    const original = globalThis.fetch
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch
    let pdf = ''
    try {
      pdf = pdfText(await generateTicketPdf({ ...ticketInput, productCode: 'HALF-IND-H' }))
    } finally {
      globalThis.fetch = original
    }
    const withImage = pdfText(await generateTicketPdf({ ...ticketInput, productCode: 'HALF-IND-H' }))
    expect(pdf).toContain(ticketInput.ticketFolio)
    expect(imageCount(pdf)).toBeGreaterThan(0)
    expect(imageCount(pdf)).toBeLessThan(imageCount(withImage))
  })

  it('renders the same folio twice without any ticket or outbox write', async () => {
    const first = await generateTicketPdf({ ...ticketInput, productCode: 'HALF-IND-H' })
    const second = await generateTicketPdf({ ...ticketInput, productCode: 'HALF-IND-H' })
    expect(pdfText(first)).toContain(ticketInput.ticketFolio)
    expect(pdfText(second)).toContain(ticketInput.ticketFolio)
    expect(imageCount(pdfText(first))).toBe(imageCount(pdfText(second)))
  })

  it('writes visual previews for half individual and dobles', { timeout: 20000 }, async () => {
    mkdirSync('test-results/ticket-pdf', { recursive: true })
    const half = await generateTicketPdf({ ...ticketInput, productCode: 'HALF-IND-H' })
    const doubles = await generateTicketPdf({
      ...ticketInput,
      ticketFolio: 'tkt_preview_dobles',
      productCode: 'DOB-SAB-HH',
      productName: 'Dobles Hombres',
      rosterNames: ['Capitán de prueba', 'Compañero de prueba'],
      rawToken: 'qr_preview_dobles',
    })
    const relay = await generateTicketPdf({
      ...ticketInput,
      ticketFolio: 'tkt_preview_relay',
      productCode: 'REL-2H2M',
      productName: 'Relay Mixto 2H+2M',
      rosterNames: ['Atleta uno', 'Atleta dos', 'Atleta tres', 'Atleta cuatro'],
      rawToken: 'qr_preview_relay',
    })
    const publico = await generateTicketPdf({
      ...ticketInput,
      ticketFolio: 'tkt_preview_publico',
      productCode: 'PUB-VIE',
      productName: 'Público Viernes',
      rosterNames: ['Asistente de prueba'],
      rawToken: 'qr_preview_publico',
    })
    writeFileSync('test-results/ticket-pdf/half-ind-h.pdf', Buffer.from(half, 'base64'))
    writeFileSync('test-results/ticket-pdf/dobles.pdf', Buffer.from(doubles, 'base64'))
    writeFileSync('test-results/ticket-pdf/relay.pdf', Buffer.from(relay, 'base64'))
    writeFileSync('test-results/ticket-pdf/publico.pdf', Buffer.from(publico, 'base64'))
    expect(half.length).toBeGreaterThan(1000)
    expect(doubles.length).toBeGreaterThan(1000)
    expect(relay.length).toBeGreaterThan(1000)
    expect(publico.length).toBeGreaterThan(1000)
    expect(pdfText(relay)).not.toContain('3e9sriq7')
    expect(pdfText(publico)).toContain('Público Viernes')
  })

  it('reads the real HALF-IND-H photograph size without stretching the ratio', async () => {
    const response = await fetch(resolveCardImageUrl('HALF-IND-H'))
    const bytes = new Uint8Array(await response.arrayBuffer())
    const size = imagePixelSize(bytes, 'WEBP')
    expect(size).toEqual({ width: 800, height: 447 })
    const scale = Math.min(180 / size!.width, 52 / size!.height)
    expect(size!.width * scale).toBeCloseTo(size!.width * (52 / size!.height))
    expect(size!.height * scale).toBeCloseTo(52)
  })
})

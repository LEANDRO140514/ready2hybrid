import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildEmailHtml, generateTicketPdf } from '../../../insforge/functions/_shared/email/pdf.ts'

const input = {
  ticketFolio: 'tkt_preview_kit_rule',
  productCode: 'HALF-IND-H',
  productName: '½ Hybrid Individual Hombre',
  teamName: null,
  rosterNames: ['Atleta de prueba'],
  buyerName: 'Atleta de prueba',
  rawToken: 'qr_preview_kit_rule',
}

describe('kit delivery rule in ticket email and PDF', () => {
  it('email states the general rule and the last-minute exception', () => {
    const html = buildEmailHtml(input)
    expect(html).toContain('Club Cumbres')
    expect(html).toContain('jueves 12 de noviembre')
    expect(html).toContain('viernes 13 de noviembre a las 12:00 h')
    expect(html).toContain('redes, correo y WhatsApp')
    expect(html).toContain('última hora')
    expect(html).toContain('11:00 h')
    expect(html).toContain('al menos 3 horas antes de tu competencia')
    expect(html).toContain('https://wa.me/529902302378')
    expect(html).not.toContain('preséntate en mesas')
    expect(html).not.toContain('para la entrega de tu kit')
    mkdirSync('test-results/ticket-pdf', { recursive: true })
    writeFileSync('test-results/ticket-pdf/kit-rule-email.html', html)
  })

  it('PDF no longer applies the 3-hour rule to everyone', async () => {
    const pdf = await generateTicketPdf(input)
    const text = Buffer.from(pdf, 'base64').toString('latin1')
    expect(text).not.toContain('preséntate en mesas')
    expect(text).not.toContain('para la entrega de tu kit')
    expect(text).toContain('Club Cumbres')
    expect(text).toContain('viernes 13')
    writeFileSync('test-results/ticket-pdf/kit-rule.pdf', Buffer.from(pdf, 'base64'))
  })
})

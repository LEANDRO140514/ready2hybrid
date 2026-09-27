import { jsPDF } from 'npm:jspdf@3.0.1'
import QRCode from 'npm:qrcode@1.5.4'
import { resolveCardImageUrl } from './product-card-images.ts'

export type TicketPdfInput = {
  ticketFolio: string
  productCode?: string | null
  productName: string
  teamName: string | null
  rosterNames: string[]
  buyerName: string
  rawToken: string
}

type EmbeddedImage = {
  dataUrl: string
  format: 'WEBP' | 'PNG' | 'JPEG'
  width: number
  height: number
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

function imageFormat(bytes: Uint8Array, contentType: string): EmbeddedImage['format'] | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'PNG'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'JPEG'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return 'WEBP'
  if (contentType.includes('png')) return 'PNG'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'JPEG'
  if (contentType.includes('webp')) return 'WEBP'
  return null
}

export function imagePixelSize(bytes: Uint8Array, format: EmbeddedImage['format']): { width: number; height: number } | null {
  if (format === 'PNG' && bytes.length > 24) {
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
    return width > 0 && height > 0 ? { width, height } : null
  }
  if (format === 'WEBP') {
    for (let index = 0; index < Math.min(bytes.length - 7, 64); index += 1) {
      if (bytes[index] === 0x9d && bytes[index + 1] === 0x01 && bytes[index + 2] === 0x2a) {
        const width = (bytes[index + 3] | (bytes[index + 4] << 8)) & 0x3fff
        const height = (bytes[index + 5] | (bytes[index + 6] << 8)) & 0x3fff
        return width > 0 && height > 0 ? { width, height } : null
      }
    }
  }
  return null
}

function fitInside(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(maxWidth / width, maxHeight / height)
  return { width: width * scale, height: height * scale }
}

async function loadImage(url: string): Promise<EmbeddedImage | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    const format = imageFormat(bytes, response.headers.get('content-type') ?? '')
    if (!format) return null
    const size = imagePixelSize(bytes, format)
    if (!size) return null
    return {
      dataUrl: `data:image/${format.toLowerCase()};base64,${bytesToBase64(bytes)}`,
      format,
      width: size.width,
      height: size.height,
    }
  } catch {
    return null
  }
}

async function loadCardImage(productCode: string | null | undefined): Promise<EmbeddedImage | null> {
  const primary = resolveCardImageUrl(productCode)
  const primaryImage = await loadImage(primary)
  if (primaryImage) return primaryImage
  const fallback = resolveCardImageUrl(null)
  if (fallback === primary) return null
  return loadImage(fallback)
}

export async function generateTicketPdf(input: TicketPdfInput): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15

  doc.setFillColor(230, 242, 177)
  doc.rect(0, 0, pageWidth, 35, 'F')

  doc.setTextColor(17, 17, 17)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('HYBRID EXPERIENCE', pageWidth / 2, 18, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('by ENFORMA', pageWidth / 2, 28, { align: 'center' })

  const cardImage = await loadCardImage(input.productCode)
  let y = 42
  if (cardImage) {
    const maxWidth = pageWidth - margin * 2
    const maxHeight = cardImage.height > cardImage.width ? 78 : 52
    const fitted = fitInside(cardImage.width, cardImage.height, maxWidth, maxHeight)
    const imageX = (pageWidth - fitted.width) / 2
    doc.addImage(cardImage.dataUrl, cardImage.format, imageX, y, fitted.width, fitted.height)
    y += fitted.height + 10
  }

  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Boleto de Entrada', margin, y)
  y += 12

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const textWidth = pageWidth - margin * 2

  doc.setFont('helvetica', 'bold')
  doc.text('Categoría:', margin, y)
  doc.setFont('helvetica', 'normal')
  const categoryLines = doc.splitTextToSize(input.productName, textWidth - 32)
  doc.text(categoryLines, margin + 28, y)
  y += categoryLines.length * 6 + 2

  if (input.teamName) {
    doc.setFont('helvetica', 'bold')
    doc.text('Equipo:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(input.teamName, margin + 28, y)
    y += 8
  }

  const participantLabel = input.rosterNames.length > 1 ? 'Participantes:' : 'Participante:'
  doc.setFont('helvetica', 'bold')
  doc.text(participantLabel, margin, y)
  doc.setFont('helvetica', 'normal')

  const namesText = input.rosterNames.join(', ')
  const splitNames = doc.splitTextToSize(namesText, textWidth - 36)
  doc.text(splitNames, margin + 32, y)
  y += splitNames.length * 6 + 4

  doc.setFont('helvetica', 'bold')
  doc.text('Referencia:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(input.ticketFolio, margin + 28, y)
  y += 12

  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  const eventInfo = [
    '13, 14 y 15 de noviembre de 2026',
    'Mérida, Yucatán',
  ]
  for (const line of eventInfo) {
    doc.text(line, margin, y)
    y += 6
  }

  const qrDataUrl = await QRCode.toDataURL(input.rawToken, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 480,
  })
  const qrSize = 48
  y += 4
  doc.addImage(qrDataUrl, 'PNG', (pageWidth - qrSize) / 2, y, qrSize, qrSize)
  y += qrSize + 8
  doc.text('Presenta este código QR en el acceso al evento.', pageWidth / 2, y, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('Este boleto es personal e intransferible.', margin, 280)

  return doc.output('datauristring').split(',')[1]
}

export function buildEmailHtml(input: {
  buyerName: string
  productName: string
  teamName: string | null
  rosterNames: string[]
  ticketFolio: string
}): string {
  const teamLine = input.teamName
    ? `<p><strong>Equipo:</strong> ${escapeHtml(input.teamName)}</p>`
    : ''

  const participantLabel = input.rosterNames.length > 1 ? 'Participantes' : 'Participante'
  const rosterText = input.rosterNames.map(escapeHtml).join(', ')

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Confirmación de inscripción</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Estimado/a ${escapeHtml(input.buyerName)}:</p>

  <p>Confirmamos tu inscripción a Hybrid Experience 2026, que se celebrará los días 13, 14 y 15 de noviembre de 2026 en Mérida, Yucatán.</p>

  <p><strong>Categoría:</strong> ${escapeHtml(input.productName)}</p>
  ${teamLine}
  <p><strong>${participantLabel}:</strong> ${rosterText}</p>
  <p><strong>Referencia:</strong> ${escapeHtml(input.ticketFolio)}</p>

  <p>Adjuntamos tu boleto en formato PDF. En él encontrarás un código QR que deberás presentar en el acceso al evento para validar tu entrada.</p>

  <p>Te recomendamos conservar este correo y llevar el boleto contigo, impreso o en tu dispositivo, el día del evento.</p>

  <p>Para cualquier aclaración, contáctanos por nuestros canales oficiales.</p>

  <p style="margin-top: 30px;">
    <strong>Hybrid Experience</strong><br>
    <em>by ENFORMA</em>
  </p>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

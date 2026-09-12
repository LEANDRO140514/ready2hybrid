import { jsPDF } from 'npm:jspdf@3.0.1'
import QRCode from 'npm:qrcode@1.5.4'

export type TicketPdfInput = {
  ticketFolio: string
  productName: string
  teamName: string | null
  rosterNames: string[]
  buyerName: string
  rawToken: string
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

  const qrDataUrl = await QRCode.toDataURL(input.rawToken, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 480,
  })
  const qrSize = 45
  doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - qrSize, 45, qrSize, qrSize)

  doc.setTextColor(0, 0, 0)
  let y = 55

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Boleto de Entrada', margin, y)
  y += 12

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')

  doc.setFont('helvetica', 'bold')
  doc.text('Categoría:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(input.productName, margin + 28, y)
  y += 8

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
  const maxWidth = pageWidth - margin * 2 - qrSize - 10
  const splitNames = doc.splitTextToSize(namesText, maxWidth)
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
    '',
    'Presenta este código QR en el acceso al evento.',
  ]
  for (const line of eventInfo) {
    doc.text(line, margin, y)
    y += 6
  }

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

import { Ecc, QrCode } from './qrcodegen.ts'

export function partnerQrModules(text: string): boolean[][] {
  const qr = QrCode.encodeText(text, Ecc.MEDIUM)
  const grid: boolean[][] = []
  for (let y = 0; y < qr.size; y += 1) {
    const row: boolean[] = []
    for (let x = 0; x < qr.size; x += 1) row.push(qr.getModule(x, y))
    grid.push(row)
  }
  return grid
}

export function drawPartnerQr(canvas: HTMLCanvasElement, text: string, scale = 8): void {
  const grid = partnerQrModules(text)
  const quiet = 4
  const cells = grid.length + quiet * 2
  canvas.width = cells * scale
  canvas.height = cells * scale
  const context = canvas.getContext('2d')
  if (!context) return
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#000000'
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y] ?? []
    for (let x = 0; x < row.length; x += 1) {
      if (!row[x]) continue
      context.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale)
    }
  }
}

export function downloadPartnerQrPng(text: string, filename: string): void {
  const canvas = document.createElement('canvas')
  drawPartnerQr(canvas, text, 10)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  })
}

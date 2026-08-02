import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('PWA manifest contract in vite config', () => {
  it('declares installable identity and required icons', () => {
    const config = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8')
    expect(config).toContain("name: 'Ready2Hybrid'")
    expect(config).toContain("short_name: 'R2H'")
    expect(config).toContain("display: 'standalone'")
    expect(config).toContain('icons/icon-192.png')
    expect(config).toContain('icons/icon-512.png')
    expect(config).toContain('navigateFallback')
    expect(config).toContain('runtimeCaching: []')
  })

  it('ships icon assets and offline fallback page', () => {
    const icon192 = readFileSync(
      join(process.cwd(), 'public/icons/icon-192.png'),
    )
    const icon512 = readFileSync(
      join(process.cwd(), 'public/icons/icon-512.png'),
    )
    const offline = readFileSync(
      join(process.cwd(), 'public/offline.html'),
      'utf8',
    )
    expect(icon192.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(icon512.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(offline).toMatch(/Shell de aplicación no disponible/i)
    expect(offline).not.toMatch(/LISTO PARA OPERAR SIN INTERNET/i)
  })
})

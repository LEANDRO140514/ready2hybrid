import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

async function waitForServiceWorkerControl(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration()
          if (!reg?.active) return 'no-active'
          if (navigator.serviceWorker.controller) return 'controlling'
          // Claim may need a reload after first install.
          return 'active-not-controlling'
        }),
      { timeout: 30_000 },
    )
    .not.toBe('no-active')

  const state = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    return {
      controlling: !!navigator.serviceWorker.controller,
      active: !!reg?.active,
    }
  })

  if (!state.controlling && state.active) {
    await page.reload({ waitUntil: 'networkidle' })
    await expect
      .poll(
        async () =>
          page.evaluate(() => !!navigator.serviceWorker.controller),
        { timeout: 20_000 },
      )
      .toBe(true)
  }
}

test.describe('production PWA shell', () => {
  test('installability contract on production preview', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await waitForServiceWorkerControl(page)

    const manifestRes = await page.request.get('/manifest.webmanifest')
    expect(manifestRes.ok()).toBe(true)
    const manifest = (await manifestRes.json()) as {
      name: string
      short_name: string
      start_url: string
      scope: string
      display: string
      icons: Array<{ src: string; sizes: string }>
    }

    expect(manifest.name).toBe('Ready2Hybrid')
    expect(manifest.short_name).toBe('R2H')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')

    for (const icon of manifest.icons) {
      const iconRes = await page.request.get(
        icon.src.startsWith('/') ? icon.src : `/${icon.src}`,
      )
      expect(iconRes.ok(), `icon ${icon.src}`).toBe(true)
      const buf = Buffer.from(await iconRes.body())
      expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      const width = buf.readUInt32BE(16)
      const height = buf.readUInt32BE(20)
      const expected = Number(icon.sizes.split('x')[0])
      expect(width).toBe(expected)
      expect(height).toBe(expected)
    }

    const sw = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      return {
        controlling: !!navigator.serviceWorker.controller,
        active: !!reg?.active,
        scope: reg?.scope ?? null,
      }
    })
    expect(sw.controlling).toBe(true)
    expect(sw.active).toBe(true)
    expect(sw.scope).toContain('127.0.0.1:4175')

    const installability = await page.evaluate(async () => {
      const manifestEl = document.querySelector(
        'link[rel="manifest"]',
      ) as HTMLLinkElement | null
      const secure =
        location.protocol === 'https:' ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1'
      return {
        secureContext: secure,
        hasManifestLink: !!manifestEl?.href,
        displayModeStandalone: window.matchMedia('(display-mode: standalone)')
          .matches,
        // Chromium may not expose beforeinstallprompt in automation; record capability.
        serviceWorkerControlled: !!navigator.serviceWorker.controller,
      }
    })

    expect(installability.secureContext).toBe(true)
    expect(installability.hasManifestLink).toBe(true)
    expect(installability.serviceWorkerControlled).toBe(true)
    expect(
      consoleErrors.filter((e) => /manifest/i.test(e)),
    ).toEqual([])

    // Documented observation for evidence (Playwright cannot always fire install UI).
    test.info().annotations.push({
      type: 'installability',
      description: JSON.stringify({
        browser: 'chromium',
        previewURL: 'http://127.0.0.1:4175/',
        manifestChecks: 'PASS',
        serviceWorkerState: sw,
        installabilityObservation: installability,
        note: 'beforeinstallprompt not required; SW-controlled + valid manifest/icons on loopback',
      }),
    })
  })

  test('production SW serves shell offline without readiness claim', async ({
    page,
    context,
  }) => {
    await waitForServiceWorkerControl(page)
    await expect(page.getByTestId('not-ready-operate')).toBeVisible()
    await expect(page.getByTestId('shell-build-id')).toContainText('prod-e2e-a')

    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(
      page.getByRole('heading', { name: 'Ready2Hybrid' }),
    ).toBeVisible()
    await expect(page.getByTestId('connectivity-offline')).toBeVisible()
    await expect(page.getByTestId('not-ready-operate')).toBeVisible()
    await expect(page.getByText(/CHECK-IN AVAILABLE/i)).toHaveCount(0)
    await expect(
      page.getByText('LISTO PARA OPERAR SIN INTERNET'),
    ).toHaveCount(0)

    await context.setOffline(false)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect
      .poll(async () => page.getByTestId('shell-connectivity').innerText(), {
        timeout: 10_000,
      })
      .toMatch(/online|recovering/i)
  })

  test('production build ignores fixture localStorage grants', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'r2h.e2e.session',
        JSON.stringify({ id: 'x', email: 'a@b.c' }),
      )
      localStorage.setItem('r2h.e2e.role', 'CHECKIN_STAFF')
      localStorage.setItem(
        'r2h.e2e.assignment',
        JSON.stringify({
          operatorId: 'x',
          role: 'CHECKIN_STAFF',
          eventId: 'e',
          eventDayId: 'd',
          doorOrAreaId: 'g',
          validFrom: '2020-01-01T00:00:00.000Z',
          validTo: '2099-01-01T00:00:00.000Z',
          sourceVersion: 'probe',
        }),
      )
    })

    await page.goto('/ops/checkin', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByTestId('ops-allowed-/ops/checkin'),
    ).toHaveCount(0)
  })

  test('production bundle excludes fixture auth grants', () => {
    const assetsDir = join(process.cwd(), 'dist/assets')
    const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
    const blob = jsFiles
      .map((f) => readFileSync(join(assetsDir, f), 'utf8'))
      .join('\n')
    expect(blob).not.toMatch(/r2h\.e2e\.session/)
    expect(blob).not.toMatch(/createFixtureAuthPort/)
    expect(blob).not.toMatch(/VITE_AUTH_MODE/)
  })
})


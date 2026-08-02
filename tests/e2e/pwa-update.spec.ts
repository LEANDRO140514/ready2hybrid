import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { expect, test } from '@playwright/test'

const PREVIEW_PORT = 4176
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`
const viteCli = join(process.cwd(), 'node_modules/vite/bin/vite.js')

function runBuild(buildId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [viteCli, 'build', '--mode', 'production'],
      {
        cwd: process.cwd(),
        env: { ...process.env, VITE_SHELL_BUILD_ID: buildId, VITE_AUTH_MODE: 'off' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`build ${buildId} failed (${code}): ${stderr}`))
    })
  })
}

function startPreview(): ChildProcess {
  return spawn(
    process.execPath,
    [
      join(process.cwd(), 'node_modules/vite/bin/vite.js'),
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(PREVIEW_PORT),
      '--strictPort',
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}

async function waitForUrl(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // retry
    }
    await delay(400)
  }
  throw new Error(`Preview not ready at ${url}`)
}

function stopPreview(child: ChildProcess): void {
  if (!child.pid) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      })
    } else {
      child.kill('SIGTERM')
    }
  } catch {
    child.kill('SIGKILL')
  }
}

test.describe.configure({ mode: 'serial' })

test('update A→B waits for explicit operator confirmation', async ({
  browser,
}) => {
  test.setTimeout(240_000)

  await runBuild('update-a')
  const preview = startPreview()
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    stopPreview(preview)
  }

  try {
    await waitForUrl(PREVIEW_URL)

    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' })

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration()
            return !!reg?.active
          }),
        { timeout: 30_000 },
      )
      .toBe(true)

    await page.reload({ waitUntil: 'networkidle' })
    await expect
      .poll(
        async () =>
          page.evaluate(() => !!navigator.serviceWorker.controller),
        { timeout: 20_000 },
      )
      .toBe(true)

    await expect(page.getByTestId('shell-build-id')).toContainText('update-a')
    await expect(page.getByTestId('update-available')).toHaveCount(0)

    await runBuild('update-b')

    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      await reg?.update()
    })

    await expect(page.getByTestId('update-available')).toBeVisible({
      timeout: 90_000,
    })
    await expect(page.getByTestId('shell-build-id')).toContainText('update-a')

    await page
      .getByRole('button', { name: 'Actualizar cuando sea seguro' })
      .click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('shell-build-id')).toContainText(
      'update-b',
      { timeout: 60_000 },
    )
    await expect(page.getByTestId('not-ready-operate')).toBeVisible()

    await context.close()
  } finally {
    cleanup()
    test.info().annotations.push({
      type: 'cleanup',
      description: 'EXPECTED TEST CLEANUP preview :4176',
    })
  }
})

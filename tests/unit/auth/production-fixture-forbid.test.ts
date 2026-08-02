import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const viteCli = join(process.cwd(), 'node_modules/vite/bin/vite.js')

function runViteBuild(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [viteCli, 'build', '--mode', 'production'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
  })
}

describe('production fixture hard-fail', () => {
  it('fails the production Vite build when VITE_AUTH_MODE=fixture', () => {
    const result = runViteBuild({
      ...process.env,
      VITE_AUTH_MODE: 'fixture',
    })

    expect(result.status).not.toBe(0)
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    expect(output).toMatch(/VITE_AUTH_MODE=fixture is forbidden/i)
  }, 120_000)

  it('keeps harness adapters outside the production entry graph', () => {
    const ports = readFileSync(join(process.cwd(), 'src/auth/ports.ts'), 'utf8')
    const main = readFileSync(join(process.cwd(), 'src/main.tsx'), 'utf8')
    expect(ports).not.toMatch(/VITE_AUTH_MODE|r2h\.e2e/)
    expect(ports).not.toContain('fixture-ports')
    expect(main).not.toContain('fixture-ports')
    expect(main).not.toContain('main.e2e')
    expect(
      existsSync(join(process.cwd(), 'src/auth/fixture-ports.ts')),
    ).toBe(true)
    expect(existsSync(join(process.cwd(), 'src/main.e2e.tsx'))).toBe(true)
  })

  it('successful production build omits fixture grant strings from dist', () => {
    const clean = runViteBuild({
      ...process.env,
      VITE_AUTH_MODE: 'off',
      VITE_SHELL_BUILD_ID: 'unit-clean',
    })
    expect(clean.status).toBe(0)

    const assetsDir = join(process.cwd(), 'dist/assets')
    const blob = readdirSync(assetsDir)
      .filter((f) => f.endsWith('.js'))
      .map((f) => readFileSync(join(assetsDir, f), 'utf8'))
      .join('\n')
    expect(blob).not.toMatch(/r2h\.e2e\.session/)
    expect(blob).not.toMatch(/createFixtureAuthPort/)
  }, 120_000)
})

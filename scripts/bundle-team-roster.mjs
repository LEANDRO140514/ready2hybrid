import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = resolve(root, 'insforge/functions/team-roster/handler.deploy.js')
mkdirSync(dirname(outfile), { recursive: true })

const entry = resolve(root, 'insforge/functions/team-roster/index.ts')
const result = spawnSync(
  'npx',
  [
    '-y',
    'esbuild@0.28.1',
    entry,
    '--bundle',
    '--format=esm',
    '--platform=neutral',
    '--target=es2022',
    `--outfile=${outfile}`,
    '--external:npm:@insforge/sdk@1.5.0',
    '--external:npm:@insforge/sdk',
  ],
  { stdio: 'inherit', shell: true, cwd: root },
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
console.log(`bundled -> ${outfile}`)

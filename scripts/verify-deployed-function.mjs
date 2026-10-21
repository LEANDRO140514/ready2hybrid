// Read-only: compares the LIVE code of an edge function with a committed bundle.
// Usage: node scripts/verify-deployed-function.mjs <slug> [bundle-file]
// The InsForge CLI needs a directory with .insforge/project.json: set INSFORGE_CWD when this checkout has none.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const [slug, file = `insforge/functions/${slug}/handler.deploy.js`] = process.argv.slice(2)
if (!slug) {
  console.error('usage: node scripts/verify-deployed-function.mjs <slug> [bundle-file]')
  process.exit(2)
}

const run = spawnSync('npx', ['-y', '@insforge/cli', 'functions', 'code', slug], {
  encoding: 'utf8',
  shell: true,
  cwd: process.env.INSFORGE_CWD ?? process.cwd(),
  maxBuffer: 64 * 1024 * 1024,
})
if (run.status !== 0) {
  console.error('CLI_FAILED')
  process.exit(2)
}
const header = run.stdout.indexOf('\n---')
if (header < 0) {
  console.error('UNEXPECTED_CLI_OUTPUT')
  process.exit(2)
}
const normalize = (text) => text.replace(/\r\n/g, '\n').trim()
const live = normalize(run.stdout.slice(header + 4))
const committed = normalize(readFileSync(file, 'utf8'))
const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12)
const identical = live === committed
console.log(`${slug}: ${identical ? 'IDENTICAL' : 'DIFFERENT'} | live ${live.length} sha ${sha(live)} | file ${committed.length} sha ${sha(committed)}`)
process.exit(identical ? 0 : 1)

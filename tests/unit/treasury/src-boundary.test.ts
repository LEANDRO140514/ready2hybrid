import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path))
    else if (/\.tsx?$/.test(name)) found.push(path)
  }
  return found
}

function specifiers(source: string): string[] {
  const found: string[] = []
  const pattern = /(?:from|import)\s*(?:\(\s*)?['"]([^'"]+)['"]/g
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1]
    if (specifier) found.push(specifier)
  }
  return found
}

describe('src boundary', () => {
  it('does not import the repo insforge tree', () => {
    const root = join(process.cwd(), 'src')
    const insforgeRoot = join(process.cwd(), 'insforge') + sep
    const offenders: string[] = []
    for (const file of sourceFiles(root)) {
      for (const specifier of specifiers(readFileSync(file, 'utf8'))) {
        if (!specifier.startsWith('.')) continue
        const resolved = normalize(join(dirname(file), specifier))
        if (resolved === insforgeRoot.slice(0, -1) || resolved.startsWith(insforgeRoot)) {
          offenders.push(`${relative(process.cwd(), file)} -> ${specifier}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

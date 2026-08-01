#!/usr/bin/env node
/**
 * Contact-sheet CLI.
 *
 *   npm run sheet              # every sheet
 *   npm run sheet gestures     # one of them
 *   npm run sheet -- --open    # and open it
 *
 * Sheets are checked in (tools/sheets/*.mjs); their output is not. HTML goes to
 * a gitignored `out/`, because a 700KB generated page is not a thing to diff.
 * What *is* checked in is the numeric baseline — see tools/baseline.mjs.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(root, 'out')

const args = process.argv.slice(2)
const open = args.includes('--open')
const wanted = args.filter((a) => !a.startsWith('--'))

const available = (await readdir(join(root, 'tools/sheets')))
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => f.replace(/\.mjs$/, ''))

const names = wanted.length > 0 ? wanted : available
const unknown = names.filter((n) => !available.includes(n))
if (unknown.length > 0) {
  console.error(`unknown sheet: ${unknown.join(', ')}\navailable: ${available.join(', ')}`)
  process.exit(1)
}

await mkdir(outDir, { recursive: true })

for (const name of names) {
  const mod = await import(new URL(`./sheets/${name}.mjs`, import.meta.url))
  const started = Date.now()
  const html = mod.build()
  const file = join(outDir, `${name}.html`)
  await writeFile(file, html)
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0)
  console.log(`  ${name.padEnd(12)} ${kb.padStart(5)} KB  ${String(Date.now() - started).padStart(5)} ms  →  ${file}`)
  if (open) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open'
    const a = process.platform === 'win32' ? ['/c', 'start', '', file] : [file]
    try { spawn(opener, a, { stdio: 'ignore', detached: true }).unref() } catch { /* open it yourself */ }
  }
}

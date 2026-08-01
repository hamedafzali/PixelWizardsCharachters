#!/usr/bin/env node
/**
 * The checked-in numeric baseline.
 *
 *   npm run baseline            # show the drift against tools/baselines/
 *   npm run baseline -- --write # accept it
 *
 * The contact sheets are gitignored because a 4MB generated page is not a thing
 * to review. This is the reviewable half: the same measurements as numbers, in
 * git, so an art change arrives in a diff with names on it.
 *
 * There is no image diffing and none is planned. A pixel diff answers "did
 * anything change", which for a sheet of 600 rendered frames is always yes and
 * never useful. A named margin that moved from 3.05 to 1.20 answers a question
 * someone actually has.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { measureAll } from './lib/measure.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const file = join(root, 'tools/baselines/geometry.json')
const write = process.argv.includes('--write')

const now = measureAll()
const json = `${JSON.stringify(now, null, 2)}\n`

let old = null
try {
  old = JSON.parse(await readFile(file, 'utf8'))
} catch {
  old = null
}

if (old === null) {
  await mkdir(join(root, 'tools/baselines'), { recursive: true })
  await writeFile(file, json)
  console.log(`no baseline yet — wrote ${Object.keys(now).length} sections to tools/baselines/geometry.json`)
  process.exit(0)
}

/** Flatten to `a.b.c = value` so a diff can name what moved. */
function flat(o, prefix = '', into = new Map()) {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flat(v, key, into)
    else into.set(key, Array.isArray(v) ? `[${v.join(', ')}]` : String(v))
  }
  return into
}

const a = flat(old)
const b = flat(now)
const changed = []
for (const [k, v] of b) if (!a.has(k)) changed.push([k, '—', v, 'added'])
for (const [k, v] of a) {
  if (!b.has(k)) changed.push([k, v, '—', 'removed'])
  else if (b.get(k) !== v) changed.push([k, v, b.get(k), 'changed'])
}

if (changed.length === 0) {
  console.log(`baseline matches — ${b.size} measurements unchanged`)
  process.exit(0)
}

const w = Math.max(...changed.map(([k]) => k.length))
console.log(`${changed.length} of ${b.size} measurements moved:\n`)
for (const [k, was, is, kind] of changed) {
  const delta = Number.isFinite(Number(was)) && Number.isFinite(Number(is))
    ? `  (${Number(is) - Number(was) > 0 ? '+' : ''}${(Number(is) - Number(was)).toFixed(3)})`
    : ''
  console.log(`  ${k.padEnd(w)}  ${String(was).padStart(10)} → ${String(is).padStart(10)}${delta}${kind === 'changed' ? '' : `  [${kind}]`}`)
}

if (write) {
  await writeFile(file, json)
  console.log(`\naccepted — tools/baselines/geometry.json updated`)
  process.exit(0)
}
console.log(`\nRe-run with --write to accept. Read the list first: these are the numbers the guards
are set against, and a margin that halved is worth understanding before it is committed.`)
process.exit(1)

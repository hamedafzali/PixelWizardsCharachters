#!/usr/bin/env node
/**
 * Mutation-test runner.
 *
 *   npm run mutate            # every mutation in tools/mutations.mjs
 *   npm run mutate M7 M8      # just these
 *
 * A run is only meaningful if the suite is green to begin with, so the clean
 * baseline runs first and a red baseline aborts — otherwise every mutation
 * would "kill" for free.
 *
 * The exit code is non-zero if any mutation **survived** (a real gap in the
 * guards) or failed to apply (a broken mutation, which is a defect in this file
 * rather than in the library, and which must never be read as a pass).
 */

import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { runMutation, runTests, build } from './lib/mutate.mjs'
import catalogue from './mutations.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const wanted = process.argv.slice(2)
const chosen = wanted.length > 0
  ? catalogue.filter((m) => wanted.includes(m.id))
  : catalogue

const unknown = wanted.filter((w) => !catalogue.some((m) => m.id === w))
if (unknown.length > 0) {
  console.error(`unknown mutation: ${unknown.join(', ')}`)
  process.exit(1)
}

// A mutation with no post-condition can only prove that *something* changed,
// which is how a pattern that matched in the wrong place would slip through.
const uncheckable = catalogue.filter((m) => m.expect === undefined && m.absent === undefined)
if (uncheckable.length > 0) {
  console.error(`these mutations declare neither expect nor absent, so they cannot be verified: ` +
    uncheckable.map((m) => m.id).join(', '))
  process.exit(1)
}

const abs = (m) => ({
  ...m,
  file: join(root, m.file),
  tests: m.tests.map((t) => join(root, t)),
})

const allTests = (await readdir(join(root, 'test')))
  .filter((f) => f.endsWith('.test.mjs'))
  .map((f) => join(root, 'test', f))

process.chdir(root)

console.log('building…')
await build()
process.stdout.write('clean baseline… ')
const base = await runTests(allTests)
if (base.crashed || base.fail > 0) {
  console.log(`RED (${base.pass} pass, ${base.fail} fail) — aborting; a mutation run means nothing from here`)
  console.log(base.out.slice(-2000))
  process.exit(1)
}
console.log(`${base.pass} pass, 0 fail\n`)

const ICON = { killed: '✓', survived: '✗ SURVIVED', 'not-applied': '! NOT APPLIED', crashed: '! CRASHED' }
const results = []

for (const m of chosen) {
  process.stdout.write(`${m.id.padEnd(4)} ${m.note.slice(0, 62).padEnd(64)}`)
  const r = await runMutation(abs(m))
  results.push(r)
  console.log(`${(ICON[r.status] ?? r.status).padEnd(14)} ${r.detail}`)
  if (r.status === 'not-applied') console.log(`     ↳ fix the mutation in tools/mutations.mjs — this is not a result`)
  if (r.status === 'crashed') console.log(`     ↳ the mutant broke the module loader, so no guard was exercised`)
}

const tally = (s) => results.filter((r) => r.status === s).length
console.log(`\n${tally('killed')} killed · ${tally('survived')} survived · ` +
  `${tally('not-applied') + tally('crashed')} invalid`)

process.stdout.write('restored baseline… ')
const back = await runTests(allTests)
console.log(back.crashed || back.fail > 0
  ? `DIRTY — the tree did not come back clean (${back.pass} pass, ${back.fail} fail)`
  : `${back.pass} pass, 0 fail`)

const bad = tally('survived') + tally('not-applied') + tally('crashed')
process.exit(bad > 0 || back.fail > 0 || back.crashed ? 1 : 0)

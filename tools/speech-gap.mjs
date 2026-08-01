#!/usr/bin/env node
/**
 * A2 — how far the shipped lip-sync is from the hand-marked corpus.
 *
 *   npm run speech-gap            # the report
 *   npm run speech-gap -- --write # accept the numbers into the baseline
 *
 * Same shape as `npm run baseline`: the readable report goes to the terminal,
 * the numbers go to `tools/baselines/lipsync.json` so a change to the timing
 * model arrives in a diff with names on it rather than as a vibe.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { measureAll, aggregate, SYLLABLE_MS, PER_VISEME_MS } from './lib/speech.mjs'

const file = new URL('baselines/lipsync.json', import.meta.url)
const write = process.argv.includes('--write')

const rows = measureAll()
const agg = aggregate(rows)

const pad = (s, n) => String(s).padEnd(n)
const lpad = (s, n) => String(s).padStart(n)
const pct = (n) => `${n > 0 ? '+' : ''}${n}%`

console.log(`\nlip-sync gap — ${rows.length} corpus items`)
console.log(`shipped model: one viseme per letter, ${PER_VISEME_MS}ms each`)
console.log(`reference:     ${SYLLABLE_MS}ms per hand-marked syllable\n`)

console.log(`${pad('text', 18)}${pad('roman', 18)}${lpad('let', 4)}${lpad('syl', 4)}${lpad('vis', 4)}${lpad('emit', 7)}${lpad('ideal', 7)}${lpad('err', 8)}${lpad('vow', 6)}${lpad('run', 5)}${lpad('dist', 6)}`)
console.log('-'.repeat(96))
for (const r of rows) {
  console.log(
    pad(r.text, 18) + pad(r.roman, 18) +
    lpad(r.letters, 4) + lpad(r.syllables, 4) + lpad(r.emittedCount, 4) +
    lpad(`${r.emittedMs}ms`, 7) + lpad(`${r.idealMs}ms`, 7) + lpad(pct(r.durationErrorPct), 8) +
    lpad(`${r.emittedVowels}/${r.syllables}`, 6) + lpad(r.longestRun, 5) + lpad(r.distance, 6),
  )
}

console.log(`
  let   written letters (what the current model counts)
  syl   hand-marked syllables (what speech actually counts)
  vis   visemes emitted
  err   emitted duration against the reference
  vow   vowel visemes emitted / vowels actually spoken
  run   longest run of one unchanging mouth shape
  dist  normalised edit distance from the ideal sequence (0 = identical)
`)

// The aggregate hides the shape of the error, and the shape is the finding: a
// letter count over-counts a consonant-clustered monosyllable and under-counts
// a polysyllable full of unwritten short vowels, so the two halves of the
// corpus are wrong in opposite directions and partly cancel in the total.
console.log('duration error by length — where the sign changes')
const buckets = new Map()
for (const r of rows) {
  const k = r.syllables >= 5 ? '5+' : String(r.syllables)
  if (!buckets.has(k)) buckets.set(k, [])
  buckets.get(k).push(r)
}
for (const [k, rs] of [...buckets].sort()) {
  const m = rs.reduce((a, r) => a + r.durationErrorPct, 0) / rs.length
  const lpsyl = rs.reduce((a, r) => a + r.letters / r.syllables, 0) / rs.length
  console.log(`  ${lpad(k, 3)} syllable  n=${lpad(rs.length, 2)}   mean err ${lpad(pct(Number(m.toFixed(1))), 8)}   letters/syllable ${lpad(lpsyl.toFixed(2), 5)}`)
}

console.log('\naggregate')
for (const [k, v] of Object.entries(agg)) console.log(`  ${pad(k, 28)}${v}`)

// The reference rate is an assumption, so every duration conclusion gets
// re-run against plausible alternatives. A finding that only survives at
// 200ms/syllable is a finding about 200ms/syllable.
console.log('\nsensitivity to the assumed speech rate')
for (const ms of [170, 200, 240]) {
  const a = aggregate(measureAll(ms))
  console.log(`  ${lpad(ms, 4)}ms/syllable  total ${lpad(pct(a.totalDurationErrorPct), 7)}   mean |err| ${lpad(a.meanAbsDurationErrorPct, 5)}%   worst ${lpad(pct(a.worstDurationErrorPct), 7)}`)
}

const out = {
  $about: 'A2 gap analysis. Regenerate with `npm run speech-gap -- --write`.',
  model: { perVisemeMs: PER_VISEME_MS, referenceSyllableMs: SYLLABLE_MS },
  aggregate: agg,
  items: rows.map(({ emitted, ideal, ...rest }) => ({ ...rest, emitted: emitted.join(' '), ideal: ideal.join(' ') })),
}
const json = `${JSON.stringify(out, null, 2)}\n`

let old = null
try { old = await readFile(file, 'utf8') } catch { old = null }

if (write || old === null) {
  await writeFile(file, json)
  console.log(`\n${old === null ? 'wrote' : 'updated'} tools/baselines/lipsync.json`)
} else if (old !== json) {
  console.log('\ntools/baselines/lipsync.json is out of date — rerun with --write to accept')
  process.exitCode = 1
} else {
  console.log('\ntools/baselines/lipsync.json is current')
}

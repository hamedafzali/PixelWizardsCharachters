/**
 * The baseline, wired into the suite.
 *
 * Without this, `tools/baselines/geometry.json` is a file somebody remembers to
 * regenerate — which is to say, a stale file. The guards elsewhere assert that
 * margins stay above their floors; this asserts that they have not *moved*,
 * which catches the change that is still legal but was not intended.
 *
 * When it fails: run `npm run baseline` to see what moved and by how much, then
 * `npm run baseline -- --write` once the diff has actually been read.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { measureAll } from '../tools/lib/measure.mjs'

const baseline = JSON.parse(
  await readFile(new URL('../tools/baselines/geometry.json', import.meta.url), 'utf8'),
)

test('the measured geometry still matches the checked-in baseline', () => {
  assert.deepEqual(measureAll(), baseline,
    'geometry moved — run `npm run baseline` to see what, then --write to accept')
})

test('the baseline is not empty, and covers every character', () => {
  // A baseline that silently measured nothing would pass the test above
  // forever. This is the same failure mode as a mutation that never applied.
  assert.ok(Object.keys(baseline.gestureRouting).length >= 8)
  assert.ok(Object.keys(baseline.pivots).length > 10)
  for (const k of ['laki', 'tondpa', 'khersi', 'actionShape']) {
    assert.ok(baseline[k] && Object.keys(baseline[k]).length > 0, `${k} section is empty`)
  }
})

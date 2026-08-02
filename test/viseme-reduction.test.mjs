/**
 * Design 3 folded six of the eleven original viseme names (`e`, `i`, `o`,
 * `f`, `sh`, `s`) into the five survivors (`rest`, `aa`, `mbp`, `u`, `l`).
 * `PMAP` in `visemes.ts` is the only place that routing lives, and it is
 * plain data — nothing type-checks that a letter landed on the *measured*
 * target rather than some other survivor. This asserts the routing directly,
 * one representative letter per dropped group, against the merges recorded
 * in the `VISEMES` doc comment.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { PMAP, VISEMES } from '../dist/index.js'

test('the table itself only has the five survivors', () => {
  assert.deepEqual(new Set(Object.keys(VISEMES)), new Set(['rest', 'aa', 'mbp', 'u', 'l']))
})

test('every dropped viseme group routes to its measured merge target', () => {
  const routing = {
    ه: 'l', // was e
    ی: 'l', // was i
    و: 'u', // stays u (unaffected, و was never its own group)
    ف: 'rest', // was f
    ش: 'u', // was sh
    س: 'l', // was s — the judgment call, resolved toward l over rest
  }
  for (const [letter, target] of Object.entries(routing)) {
    assert.equal(PMAP[letter], target, `"${letter}" should route to "${target}"`)
  }
})

test('the surviving groups keep their own letters', () => {
  assert.equal(PMAP['ا'], 'aa')
  assert.equal(PMAP['م'], 'mbp')
  assert.equal(PMAP['ل'], 'l')
})

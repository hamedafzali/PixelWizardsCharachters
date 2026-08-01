/**
 * The reference corpus checks itself.
 *
 * `tools/baselines/speech.json` is hand-marked, which makes it exactly the kind
 * of file that rots: nothing compiles it, nothing imports it at runtime, and a
 * mis-split syllable would sit there being quietly wrong while every conclusion
 * drawn from it inherited the error. So the three levels are marked
 * independently and cross-checked here — the phonemes must rebuild the
 * romanization, the syllables must rebuild the phonemes, and the word count
 * must match the Persian text.
 *
 * The same standard the probes are held to. Data that tests depend on is
 * test-load-bearing whether or not it is code.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { textToVisemes } from '../dist/index.js'

const corpus = JSON.parse(readFileSync(new URL('../tools/baselines/speech.json', import.meta.url), 'utf8'))
const VOWELS = new Set(['â', 'a', 'e', 'i', 'o', 'u'])
const CONSONANTS = new Set(['b', 'p', 't', 's', 'j', 'č', 'h', 'x', 'd', 'z', 'ž', 'r',
  'š', 'ɣ', 'f', 'q', 'k', 'g', 'l', 'm', 'n', 'v', 'y', 'ʔ'])

const syllablesOf = (item) => item.words.flat()
const phonemesOf = (item) => syllablesOf(item).flat()

test('the corpus is not empty and covers a range of lengths', () => {
  assert.ok(corpus.items.length >= 25, 'too few items to say anything about the aggregate')
  const lens = corpus.items.map((i) => syllablesOf(i).length)
  assert.equal(Math.min(...lens), 1, 'no single-syllable items — the shortest utterances are where fixed timing hurts most')
  assert.ok(Math.max(...lens) >= 6, 'no long items — drift and duration error only show up over a phrase')
})

test('phonemes rebuild the romanization exactly', () => {
  for (const item of corpus.items) {
    assert.equal(phonemesOf(item).join(''), item.roman.replace(/\s+/g, ''),
      `${item.text} (${item.roman}): the phoneme marking and the romanization disagree`)
  }
})

test('every syllable has exactly one vowel', () => {
  // True of Persian by construction: a syllable is one vowel nucleus with
  // optional onset and coda. This is what makes syllable count usable as the
  // reference duration later — and what makes "how many vowel visemes should
  // this word have" a question with an exact answer.
  for (const item of corpus.items) {
    for (const syl of syllablesOf(item)) {
      const vs = syl.filter((p) => VOWELS.has(p))
      assert.equal(vs.length, 1, `${item.text}: syllable /${syl.join('')}/ has ${vs.length} vowels`)
    }
  }
})

test('word boundaries match the Persian text', () => {
  for (const item of corpus.items) {
    assert.equal(item.words.length, item.text.trim().split(/\s+/).length,
      `${item.text}: ${item.words.length} marked words against the written text`)
  }
})

test('every phoneme is in the declared inventory', () => {
  for (const item of corpus.items) {
    for (const p of phonemesOf(item)) {
      assert.ok(VOWELS.has(p) || CONSONANTS.has(p), `${item.text}: unknown phoneme "${p}"`)
    }
  }
})

test('every item is something the library will actually try to speak', () => {
  // A corpus entry the shipped mapper drops entirely would measure nothing.
  const seen = new Set()
  for (const item of corpus.items) {
    assert.ok(!seen.has(item.text), `duplicate entry: ${item.text}`)
    seen.add(item.text)
    assert.ok(textToVisemes(item.text).length > 1, `${item.text}: textToVisemes produced nothing usable`)
  }
})

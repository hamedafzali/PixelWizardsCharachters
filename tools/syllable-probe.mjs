#!/usr/bin/env node
/**
 * The falsification test for the rhythm half of Design 1.
 *
 *   npm run syllable-probe
 *
 * The claim under test: **a crude syllable counter — no G2P, no lexicon, no
 * unwritten-vowel insertion, just counting marks on the page — estimates
 * syllables well enough to beat letter count as a timing basis.**
 *
 * If it holds, syllable-derived timing is worth building. If it does not, the
 * rhythm half of Design 1 is empty and the honest choice narrows to Design 2
 * (take timing from outside) or to leaving the timing alone.
 *
 * ## Why each estimator gets its own constant
 *
 * Comparing `letters × 85ms` against `syllables × 200ms` directly would not
 * measure what it looks like it measures: most of the difference would be the
 * two constants, and 85 was picked for letters. Any estimator can be rescaled
 * by one global constant for free, so each is given the constant that matches
 * corpus totals exactly, and only the residual is reported.
 *
 * That residual is the part no constant can remove — the *shape* error. It is
 * governed entirely by how much the ratio (estimate / true syllables) varies
 * from word to word, which is why the spread of that ratio is reported next to
 * it. A perfect estimator has ratio spread zero at any scale.
 *
 * ## What counts as crude
 *
 * Every estimator here reads only the written string. None consults a lexicon,
 * none inserts the unwritten short vowels, and none knows whether a given `و`
 * is /u/ or /v/. That restriction is the point: an estimator that needed those
 * things would be the full Design 1 the falsification test exists to avoid
 * committing to.
 */

import { loadCorpus, syllablesOf } from './lib/speech.mjs'

const ZWNJ = '‌'
/** Letters that can carry a vowel nucleus in Persian orthography. */
const VOWEL_LETTERS = new Set([...'اآأإٱوؤیيئ'])
const isLetter = (c) => c !== ' ' && c !== ZWNJ
const letters = (w) => [...w].filter(isLetter)

/**
 * Estimators, worst to best guess. Each takes one written word and returns a
 * syllable estimate; the harness sums them over an utterance.
 */
const ESTIMATORS = {
  /** The shipped model: one unit per written letter. The thing to beat. */
  letters: (w) => letters(w).length,

  /** Only the vowels you can actually see. Short vowels are unwritten, so this
   *  should undercount badly — included as the naive floor. */
  writtenVowels: (w) => letters(w).filter((c) => VOWEL_LETTERS.has(c)).length,

  /** Written vowels, plus one per run of consonants — a run with no written
   *  vowel in it must be hiding at least one short one. */
  vowelsPlusRuns: (w) => {
    const ls = letters(w)
    let n = ls.filter((c) => VOWEL_LETTERS.has(c)).length
    let run = 0
    for (const c of ls) {
      if (VOWEL_LETTERS.has(c)) { run = 0; continue }
      run++
      if (run === 1) n++
    }
    return n
  },

  /**
   * Onset counting. Persian syllables obligatorily begin with exactly one
   * consonant, so syllable count equals onset count — and in a run of
   * consonants between two nuclei, the first is the previous syllable's coda
   * and the next is the following syllable's onset. Alternating through each
   * run approximates that without knowing where the vowels are.
   *
   * This is the most linguistically motivated of the four and still needs no
   * lexicon, so it is the one the claim really rests on.
   */
  onsets: (w) => {
    const ls = letters(w)
    let n = 0
    let sinceNucleus = 0
    for (let i = 0; i < ls.length; i++) {
      const c = ls[i]
      if (VOWEL_LETTERS.has(c)) {
        if (sinceNucleus === 0 && i === 0) n++ // vowel-initial: glottal onset
        sinceNucleus = 0
        continue
      }
      if (i === 0 || sinceNucleus === 0) { n++; sinceNucleus = 1; continue }
      sinceNucleus++
      if (sinceNucleus % 2 === 1) n++ // coda, onset, coda, onset…
    }
    return Math.max(n, 1)
  },

  /**
   * Proper CV chunking with a closed-syllable bias: walk the word taking one
   * onset consonant, a nucleus (the written vowel if there is one, an assumed
   * short vowel if not), then up to two coda consonants — a coda only being
   * taken when the next letter is another consonant or the word ends, so a
   * consonant sitting before a written vowel is released to be its onset.
   *
   * This is the strongest lexicon-free rule I can construct, and it encodes
   * real Persian phonotactics: obligatory single-consonant onsets, maximum
   * two-consonant codas.
   */
  cvChunk: (w) => {
    const ls = letters(w)
    let i = 0
    let n = 0
    while (i < ls.length) {
      if (!VOWEL_LETTERS.has(ls[i])) i++ // onset
      n++
      if (i < ls.length && VOWEL_LETTERS.has(ls[i])) i++ // written nucleus
      for (let c = 0; c < 2 && i < ls.length; c++) { // coda, at most two
        if (VOWEL_LETTERS.has(ls[i])) break
        if (i + 1 < ls.length && !VOWEL_LETTERS.has(ls[i + 1])) { i++; continue }
        if (i + 1 >= ls.length) { i++; continue }
        break
      }
    }
    return Math.max(n, 1)
  },

  /**
   * The same walk with an open-syllable bias: a consonant is only ever a coda
   * word-finally, so every other consonant opens a new syllable.
   *
   * Included because it is the exact opposite bias to `cvChunk`, and the two
   * fail on opposite words — which is the finding, not a detail. Persian
   * orthography does not say which of them applies.
   */
  cvOpen: (w) => {
    const ls = letters(w)
    let i = 0
    let n = 0
    while (i < ls.length) {
      if (!VOWEL_LETTERS.has(ls[i])) i++
      n++
      if (i < ls.length && VOWEL_LETTERS.has(ls[i])) i++
      if (i === ls.length - 1 && !VOWEL_LETTERS.has(ls[i])) i++ // word-final coda
    }
    return Math.max(n, 1)
  },
}

const corpus = loadCorpus()
const items = corpus.items.map((it) => ({
  text: it.text,
  roman: it.roman,
  true: syllablesOf(it).length,
  words: it.text.trim().split(/\s+/),
}))

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function evaluate(fn) {
  const est = items.map((it) => it.words.reduce((a, w) => a + fn(w), 0))
  // The free constant: match corpus totals exactly, so no estimator is
  // penalised for being on the wrong scale.
  const k = items.reduce((a, it) => a + it.true, 0) / est.reduce((a, e) => a + e, 0)
  const ratios = est.map((e, i) => (e * k) / items[i].true)
  const errs = ratios.map((r) => Math.abs(r - 1) * 100)
  return {
    k,
    est,
    meanErr: mean(errs),
    medianErr: median(errs),
    worstErr: Math.max(...errs),
    within10: errs.filter((e) => e <= 10).length,
    spread: (Math.max(...ratios) - Math.min(...ratios)) / mean(ratios),
    exact: est.filter((e, i) => Math.round(e * k) === items[i].true).length,
  }
}

const pad = (s, n) => String(s).padEnd(n)
const lpad = (s, n) => String(s).padStart(n)

console.log(`\nsyllable estimation — ${items.length} corpus items, ${items.reduce((a, i) => a + i.true, 0)} hand-marked syllables`)
console.log('each estimator rescaled to match corpus totals, so only shape error is shown\n')
console.log(`${pad('estimator', 18)}${lpad('scale', 7)}${lpad('mean|err|', 11)}${lpad('median', 9)}${lpad('worst', 8)}${lpad('<=10%', 7)}${lpad('exact', 7)}`)
console.log('-'.repeat(67))

const results = {}
for (const [name, fn] of Object.entries(ESTIMATORS)) {
  const r = evaluate(fn)
  results[name] = r
  console.log(
    pad(name, 18) + lpad(r.k.toFixed(3), 7) + lpad(`${r.meanErr.toFixed(1)}%`, 11) +
    lpad(`${r.medianErr.toFixed(1)}%`, 9) + lpad(`${r.worstErr.toFixed(0)}%`, 8) +
    lpad(`${r.within10}/${items.length}`, 7) + lpad(`${r.exact}/${items.length}`, 7),
  )
}

const base = results.letters
const best = Object.entries(results).filter(([n]) => n !== 'letters')
  .reduce((a, b) => (b[1].meanErr < a[1].meanErr ? b : a))

console.log(`\nbaseline (letters):  ${base.meanErr.toFixed(1)}% mean shape error`)
console.log(`best crude counter:  ${best[0]} at ${best[1].meanErr.toFixed(1)}%`)
const delta = base.meanErr - best[1].meanErr
console.log(`difference in mean:  ${delta > 0 ? '-' : '+'}${Math.abs(delta).toFixed(1)} points` +
  ` (${Math.abs((delta / base.meanErr) * 100).toFixed(0)}% relative)`)

/**
 * A difference of means over 30 items is not a result. Two things decide
 * whether this is real: does the counter win on *most words* (not just on the
 * average), and would a 30-item corpus with different words have said the same?
 */
function paired(a, b) {
  const ea = a.est.map((e, i) => Math.abs((e * a.k) / items[i].true - 1))
  const eb = b.est.map((e, i) => Math.abs((e * b.k) / items[i].true - 1))
  const diff = ea.map((v, i) => v - eb[i])
  const wins = diff.filter((d) => d > 1e-9).length
  const losses = diff.filter((d) => d < -1e-9).length

  // Bootstrap the difference of mean errors: resample the corpus with
  // replacement 20k times and see how often the sign flips. If a decent
  // fraction of resamples say the opposite, the corpus is too small to have
  // answered the question.
  let flips = 0
  const N = 20000
  for (let t = 0; t < N; t++) {
    let s = 0
    for (let i = 0; i < diff.length; i++) s += diff[Math.floor(Math.random() * diff.length)]
    if (s <= 0) flips++
  }
  return { wins, losses, ties: diff.length - wins - losses, flipRate: flips / N }
}

const p = paired(base, best[1])
console.log(`\npaired comparison (${best[0]} vs letters, per word)`)
console.log(`  ${best[0]} closer on ${p.wins} items, letters closer on ${p.losses}, tied on ${p.ties}`)
console.log(`  bootstrap: ${(p.flipRate * 100).toFixed(1)}% of resampled corpora say letters wins`)
console.log(`  median error favours ${base.medianErr < best[1].medianErr ? 'LETTERS' : best[0]}` +
  ` (${base.medianErr.toFixed(1)}% vs ${best[1].medianErr.toFixed(1)}%)`)
console.log(`  within 10%: letters ${base.within10}/${items.length}, ${best[0]} ${best[1].within10}/${items.length}`)

/**
 * The verdict, stated against the claim rather than against the mean.
 *
 * A lower mean is not the claim. "Beats letter count as a timing basis" means
 * the mouth is closer to right on the words a child actually hears, which is
 * the median and the per-word win rate — and a mean that improves while the
 * median and win rate get worse is an estimator that trades typical words for
 * outliers, not a better one.
 */
const holds = delta > 0 && p.wins > p.losses && p.flipRate < 0.05
console.log(`\n${'='.repeat(67)}`)
console.log(holds
  ? 'FALSIFICATION TEST HOLDS — a crude counter beats letter count.'
  : 'FALSIFICATION TEST FAILS — no crude counter beats letter count.')
if (!holds) {
  const why = []
  if (delta <= 0) why.push('mean error is no better')
  if (p.wins <= p.losses) why.push(`letters is closer on more words (${p.losses} vs ${p.wins})`)
  if (p.flipRate >= 0.05) why.push(`the margin is inside corpus noise (${(p.flipRate * 100).toFixed(0)}% of resamples reverse it)`)
  console.log(`  because: ${why.join('; ')}.`)
  console.log('  The rhythm half of Design 1 rests on this and does not survive it.')
}
console.log('='.repeat(67))

/**
 * The ceiling, and why it is a ceiling rather than a bad day.
 *
 * Reduce each written word to its consonant/vowel skeleton — the only thing an
 * orthographic rule can see. Any two words with the same skeleton MUST receive
 * the same estimate from any such rule, by construction. So a skeleton shared
 * by words of different true syllable counts is a pair no lexicon-free counter
 * can ever get right, however cleverly it is written.
 */
console.log('\nthe orthographic ceiling — same written shape, different syllable count')
const skeletons = new Map()
for (const it of corpus.items) {
  const written = it.text.trim().split(/\s+/)
  it.words.forEach((word, i) => {
    const skel = [...written[i]].filter(isLetter).map((c) => (VOWEL_LETTERS.has(c) ? 'V' : 'C')).join('')
    if (!skeletons.has(skel)) skeletons.set(skel, [])
    skeletons.get(skel).push({ w: written[i], syl: word.length })
  })
}
let ambiguous = 0
for (const [skel, ws] of skeletons) {
  if (new Set(ws.map((x) => x.syl)).size === 1) continue
  ambiguous++
  console.log(`  ${pad(skel, 9)} ${ws.map((x) => `${x.w} = ${x.syl}`).join('   ')}`)
}
console.log(`  ${ambiguous} of ${skeletons.size} distinct skeletons are ambiguous.` +
  ' Every one is a word pair no orthographic rule can separate,\n  because the information is not in the writing —' +
  ' it is in knowing the word, which is a lexicon.')

console.log('\nper-item, best counter against letters')
console.log(`${pad('text', 20)}${pad('roman', 18)}${lpad('true', 5)}${lpad('let', 5)}${lpad('est', 5)}${lpad('let err', 9)}${lpad('est err', 9)}`)
console.log('-'.repeat(71))
for (let i = 0; i < items.length; i++) {
  const le = Math.abs((base.est[i] * base.k) / items[i].true - 1) * 100
  const ee = Math.abs((best[1].est[i] * best[1].k) / items[i].true - 1) * 100
  console.log(
    pad(items[i].text, 20) + pad(items[i].roman, 18) + lpad(items[i].true, 5) +
    lpad(base.est[i], 5) + lpad(best[1].est[i], 5) +
    lpad(`${le.toFixed(0)}%`, 9) + lpad(`${ee.toFixed(0)}%`, 9),
  )
}

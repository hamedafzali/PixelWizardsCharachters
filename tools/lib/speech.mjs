/**
 * The reference model the shipped lip-sync is measured against.
 *
 * Two sequences per corpus item:
 *
 *   **emitted** — what `textToVisemes()` actually produces today, read from
 *   `dist/`, never restated here.
 *
 *   **ideal** — what the hand-marked phonemes say the mouth should do, mapped
 *   through {@link P2V}.
 *
 * The single most important design decision in this file is that **P2V mirrors
 * the library's own consonant buckets exactly**. `ج` goes to the `l` bucket in
 * the ideal sequence because it goes there in `PMAP`, even though a /dʒ/ is
 * visually a protruded `sh` and the bucket is arguably wrong. Same for every
 * other consonant.
 *
 * That is deliberate, and it makes every number here a **lower bound**. Any
 * error in the viseme *table* is excluded by construction, so the measured gap
 * is attributable purely to timing and to phoneme/grapheme mismatch — unwritten
 * short vowels, silent letters, and letters whose sound depends on position.
 * Whether the table itself is any good is a different question, answered by
 * looking at the sheet (A3), not by arithmetic.
 *
 * Three places the ideal deliberately does *not* mirror the library, because
 * these are the mismatches under test rather than table opinions:
 *
 *   - short vowels that are spoken and unwritten get a viseme (کتاب → ke-tâb);
 *   - silent letters get none (خواهم → /xâham/, the و is not rounded);
 *   - `و` is `/u/` or `/v/` by position, so it maps to `u` or to `f`.
 */

import { readFileSync } from 'node:fs'
import { textToVisemes } from '../../dist/index.js'

/** Phoneme → viseme. Consonants transposed from the shipped PMAP; see above. */
export const P2V = {
  â: 'aa', a: 'aa',
  e: 'e', h: 'e',
  i: 'i', y: 'i',
  o: 'o',
  u: 'u',
  m: 'mbp', b: 'mbp', p: 'mbp',
  f: 'f', v: 'f',
  š: 'sh', č: 'sh', ž: 'sh',
  s: 's', z: 's',
  l: 'l', n: 'l', t: 'l', d: 'l', r: 'l',
  k: 'l', g: 'l', q: 'l', ɣ: 'l', x: 'l', j: 'l',
  ʔ: 'e',
}

export const VOWEL_VISEMES = new Set(['aa', 'e', 'i', 'o', 'u'])

/**
 * Reference speech rate, in ms per syllable.
 *
 * Persian conversational speech runs at roughly five syllables a second. 200ms
 * is that, rounded, and it is an *assumption* rather than a measurement — which
 * is why `report()` re-runs everything at 170 and 240 as well. If a conclusion
 * only holds at one rate it is a conclusion about the rate, not about the
 * library.
 */
export const SYLLABLE_MS = 200

/** What `speak()` currently holds each viseme for. */
export const PER_VISEME_MS = 85

export function loadCorpus() {
  return JSON.parse(readFileSync(new URL('../baselines/speech.json', import.meta.url), 'utf8'))
}

export const syllablesOf = (item) => item.words.flat()
export const phonemesOf = (item) => syllablesOf(item).flat()

/** The mouth the hand-marked pronunciation calls for, with a rest between words. */
export function idealVisemes(item) {
  const out = []
  item.words.forEach((word, i) => {
    if (i > 0) out.push('rest')
    for (const syl of word) for (const p of syl) out.push(P2V[p] ?? 'rest')
  })
  return out
}

/** What the library does today. Read from dist/, never re-derived. */
export function emittedVisemes(item) {
  return textToVisemes(item.text)
}

/** Longest run of one unchanging mouth shape — a still mouth, by another name. */
function longestRun(seq) {
  let best = 0
  let run = 0
  let prev = null
  for (const v of seq) {
    run = v === prev ? run + 1 : 1
    prev = v
    if (run > best) best = run
  }
  return best
}

/** Levenshtein, normalised by the longer sequence. 0 = identical, 1 = nothing shared. */
export function seqDistance(a, b) {
  if (a.length === 0 && b.length === 0) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length] / Math.max(a.length, b.length)
}

const round = (n, d = 2) => Number(n.toFixed(d))

/** Every number this analysis has to say about one corpus item. */
export function measure(item, syllableMs = SYLLABLE_MS) {
  const emitted = emittedVisemes(item)
  const ideal = idealVisemes(item)
  const sylls = syllablesOf(item).length
  const letters = [...item.text.trim()].filter((c) => c !== ' ').length

  const emittedMs = emitted.length * PER_VISEME_MS
  const idealMs = sylls * syllableMs

  // Persian syllables carry exactly one vowel each (asserted in
  // test/speech-corpus.test.mjs), so the number of times the mouth *should*
  // open on a vowel is exactly the syllable count. That makes this the one
  // metric here with no modelling in it at all.
  const emittedVowels = emitted.filter((v) => VOWEL_VISEMES.has(v)).length

  return {
    text: item.text,
    roman: item.roman,
    letters,
    syllables: sylls,
    emitted,
    ideal,
    emittedCount: emitted.length,
    idealCount: ideal.length,
    emittedMs,
    idealMs,
    durationErrorPct: round(((emittedMs - idealMs) / idealMs) * 100, 1),
    emittedVowels,
    vowelDeficit: sylls - emittedVowels,
    lShare: round(emitted.filter((v) => v === 'l').length / emitted.length, 3),
    longestRun: longestRun(emitted),
    distinctShapes: new Set(emitted).size,
    distance: round(seqDistance(emitted, ideal), 3),
  }
}

export function measureAll(syllableMs = SYLLABLE_MS) {
  return loadCorpus().items.map((i) => measure(i, syllableMs))
}

/**
 * The mouth as drawn, read off a mounted rig.
 *
 * Read rather than recomputed, for the reason the whole probe library exists:
 * `drawMouth` composes `viseme.o`, `viseme.w`, `viseme.r` and `mouthOpen`
 * through a `Math.max` and two divisions, and a second implementation of that
 * arithmetic here would be measuring my belief about the mouth instead of the
 * mouth. So this parses the markup the rig actually wrote.
 *
 * `aperture` is 0 for the closed shapes — `drawMouth` swaps the ellipse for a
 * stroked smile when the viseme is `closed` or nearly shut, so there is no
 * ellipse to read and the width is the path's own.
 */
export function mouthShape(svg) {
  const g = svg.querySelector('#mouthG')
  const html = g.innerHTML
  const el = g.querySelector('ellipse')
  const flags = {
    tongue: /fill="#ff7a95"/.test(html),
    teeth: /<rect/.test(html),
    closed: el === null,
  }
  // A beak always draws two `<path>`s — a static upper wedge (`#f19100`,
  // invariant to the viseme) and a lower one (`#d97a00`) whose Q-command y
  // carries `open`. Neither is an ellipse, so without this branch every beak
  // shape fell into the lips' closed-mouth parser below, which grabbed the
  // *first* path — the wedge that never changes — and reported aperture 0
  // and a constant width for all eleven visemes. Found while building the
  // reduced-table measurements for Design 3, by the same rule as everything
  // else here: trust the tool's output only after checking the tool.
  const lowerBeak = /<path d="([^"]+)"[^>]*fill="#d97a00"/.exec(html)
  if (lowerBeak) {
    const nums = lowerBeak[1].match(/-?[\d.]+/g).map(Number)
    // M x1 y1 Q qx qy1 x2 y2 Q qx2 qy2 x3 y3 Z
    const [x1, y1, , qy1] = nums
    const cx = x1 + (nums[2] - x1) / 2
    const open = qy1 - 2 - (y1 - 1)
    return { cx, cy: y1 - 1, width: Math.abs(nums[2] - x1), aperture: Math.max(open, 0), ...flags, closed: open <= 0 }
  }
  if (el === null) {
    // `drawMouth` writes "Q " with a space before the coordinate — this
    // regex required "Q" immediately followed by a digit and so never
    // matched, silently falling through to the hardcoded fallback for every
    // closed-mouth shape. That made every closed pair report the same
    // fallback width regardless of their real geometry: harmless by
    // coincidence while rest and mbp genuinely were identical, but a false
    // zero waiting to happen for the next closed shape that wasn't. Found
    // while re-measuring the fixed rest/mbp pair for this exact reason —
    // trust the tool before trusting what it reports.
    const m = /M([\d.-]+) ([\d.-]+) Q\s*([\d.-]+)/.exec(html)
    if (!m) throw new Error(`mouthShape: could not parse closed-mouth path: ${html}`)
    const cx = Number(m[1]) + (Number(m[3]) - Number(m[1]))
    const cy = Number(m[2])
    return { cx, cy, width: Math.abs(cx - Number(m[1])) * 2, aperture: 0, ...flags }
  }
  return {
    cx: Number(el.getAttribute('cx')),
    cy: Number(el.getAttribute('cy')),
    width: Number(el.getAttribute('rx')) * 2,
    aperture: Number(el.getAttribute('ry')) * 2,
    ...flags,
  }
}

/**
 * How far apart two mouth shapes are, in art units.
 *
 * Deliberately just the geometry a viewer reads at a glance — how wide, how
 * open — with the decorations (tongue, teeth) reported separately rather than
 * folded in. A pair that differs *only* by a 3-unit-wide tongue dot is not a
 * pair a child tells apart at 40px, and a distance metric that scored it as
 * distinct would be hiding exactly what this measurement exists to find.
 */
export function shapeDistance(a, b) {
  return Math.hypot(a.width - b.width, a.aperture - b.aperture)
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function aggregate(rows) {
  const totalEmitted = rows.reduce((a, r) => a + r.emittedMs, 0)
  const totalIdeal = rows.reduce((a, r) => a + r.idealMs, 0)
  return {
    items: rows.length,
    // Two different questions, and they do not have the same answer: the first
    // is "is a whole reading the right length", the second is "is each word".
    totalDurationErrorPct: round(((totalEmitted - totalIdeal) / totalIdeal) * 100, 1),
    meanAbsDurationErrorPct: round(mean(rows.map((r) => Math.abs(r.durationErrorPct))), 1),
    medianAbsDurationErrorPct: round(median(rows.map((r) => Math.abs(r.durationErrorPct))), 1),
    worstDurationErrorPct: rows.reduce((w, r) => Math.abs(r.durationErrorPct) > Math.abs(w.durationErrorPct) ? r : w).durationErrorPct,
    vowelsExpected: rows.reduce((a, r) => a + r.syllables, 0),
    vowelsEmitted: rows.reduce((a, r) => a + r.emittedVowels, 0),
    itemsWithVowelDeficit: rows.filter((r) => r.vowelDeficit > 0).length,
    itemsWithVowelSurplus: rows.filter((r) => r.vowelDeficit < 0).length,
    meanLShare: round(mean(rows.map((r) => r.lShare)), 3),
    worstLongestRun: Math.max(...rows.map((r) => r.longestRun)),
    meanDistance: round(mean(rows.map((r) => r.distance)), 3),
    meanDistinctShapes: round(mean(rows.map((r) => r.distinctShapes)), 2),
  }
}

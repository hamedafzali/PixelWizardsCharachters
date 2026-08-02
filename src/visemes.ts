import type { VisemeName, VisemeSpec } from './types.js'

/**
 * Persian viseme table. Each entry is a mouth shape shared by a family of
 * phonemes. This is deliberately a *group* mapping (grapheme → viseme family),
 * which gives readable, kid-friendly lip-sync without a full G2P pass. A backend
 * phonemiser can emit these same names for higher accuracy.
 *
 * Five shapes, reduced from an original eleven (Design 3). The reduction is a
 * legibility choice, not a defect fix — see the note below on what evidence
 * does and doesn't support it.
 *
 * **Method**: max-min dispersion (farthest-point greedy) over the worst-case
 * (min of lips-rig and beak-rig) pairwise distance between every one of the
 * eleven original shapes, with `rest` and `mbp` pinned — the one pair that
 * *was* a rendering defect (see the `drawMouth` beak branch in `render.ts`),
 * independently fixed, and not up for renegotiation by a dispersion run.
 * Vowels and consonants were dispersed separately so a merge never crosses
 * that boundary (an unconstrained run put `l` — the single busiest bucket —
 * into `o`, geometrically fine and phonetically nonsense). The result:
 *
 *   - `e` → `l` (1.33 apart, closest survivor)
 *   - `i` → `l` (3.37)
 *   - `o` → `u` (3.13)
 *   - `sh` → `u` (2.35)
 *   - `f` → `rest` (1.54, next-best `l` at 3.64 — an unambiguous match)
 *   - `s` → `l` (3.54, vs. `rest` at 3.21 — the closer geometric match, but
 *     rejected: routing a real fricative into the silence shape reintroduces
 *     the exact rest/consonant collision this whole table exists to avoid,
 *     just under a higher separation floor, and a side-by-side screenshot on
 *     both a lips and a beak character showed `s`→`rest` reading as the
 *     mouth going still on a beak character in particular, where `s` and
 *     `rest` are the two closest shapes in the whole table)
 *
 * **What corrected measurement does *not* show**: the earlier claim that
 * several shapes collided broadly was measured through a beak-geometry parser
 * that had two live bugs (both in `tools/lib/speech.mjs`, fixed alongside
 * this table) — one silently returned hardcoded defaults for every closed
 * shape, the other never read beak markup at all and reported `aperture: 0`
 * for every beak viseme regardless of which one it was. Re-run against the
 * corrected parser, the full eleven-shape matrix has exactly one pair below
 * 2 units *besides* the already-merged ones (`e`/`l` at 1.33, which is why
 * they're merged) — not the "several near-collisions" the broken tool
 * implied. The case for this table is the l-bucket usage skew and general
 * legibility at small size, not "the old table was broadly unreadable".
 */
export const VISEMES: Record<VisemeName, VisemeSpec> = {
  rest: { o: 0.05, w: 1, label: '— ف' },
  aa: { o: 1, w: 1.12, label: 'آ اَ' }, // آب، دَر، ها
  u: { o: 0.4, w: 0.66, r: 1.45, label: 'او و اُ ش چ ژ' }, // موش؛ absorbs او/اُ and ش‌گروه
  mbp: { o: 0, closed: true, w: 1, label: 'م ب پ' },
  l: { o: 0.42, w: 1, tongue: true, label: 'ل ن ت د ر ه ی س ز' },
}

/** Persian letter → viseme family. */
const PMAP: Record<string, VisemeName> = {}
const put = (letters: string, v: VisemeName) => {
  for (const c of letters) PMAP[c] = v
}
put('اآأإٱ', 'aa')
put('هحعیيئ', 'l') // was e / i
put('وؤ', 'u')
put('مبپ', 'mbp')
put('ف', 'rest') // was its own shape f, merged as measured (1.54 apart, unambiguous)
put('شچژ', 'u') // was sh
put('سزصثذضظ', 'l') // was s
put('لنتدرطكکگقغخج', 'l')

/**
 * Turn a Persian string into a viseme sequence for playback. Spaces become a
 * brief `rest`. Diacritics/unknowns are skipped. Never returns empty.
 *
 * One viseme per *written letter*, not per syllable or phoneme. That is a
 * deliberate, measured choice, not a placeholder waiting for a better model.
 *
 * Persian omits short vowels in writing, so a letter count is not a syllable
 * count — measured against a 30-item hand-marked corpus
 * (`tools/baselines/speech.json`), it carries an 18.4% mean per-word timing
 * error (`npm run speech-gap`). The question is whether any text-only model
 * can do meaningfully better without a lexicon, and the answer is no: six
 * lexicon-free syllable estimators were tried, including proper CV-chunking
 * with Persian's phonotactic rules (obligatory single-consonant onset, max
 * two-consonant coda), and none beat letter count on the metrics that matter
 * — the best won on the mean only by clipping outliers, while letter count
 * stayed closer on 19 of 30 words and had the better median (`npm run
 * syllable-probe`).
 *
 * That is not a fluke of this corpus. Persian orthography drops enough
 * information that no rule reading only the written string can be right:
 * دوست (1 syllable) and دارم (2) share the exact consonant/vowel skeleton
 * CVCC, as do آفتاب (2) / آفرین (3) and اسم (2) / است (1). Separating them
 * requires knowing the word — a lexicon — which is a fundamentally different
 * feature (see the deferred Design 2 note in README.md) and not a tuning
 * knob on this function.
 *
 * So `textToVisemes` stays letter-driven: simple, fast, dependency-free, and
 * measurably near the ceiling of what a text-only model can do.
 */
export function textToVisemes(text: string): VisemeName[] {
  const out: VisemeName[] = []
  for (const ch of text.trim()) {
    if (ch === ' ') {
      out.push('rest')
      continue
    }
    const v = PMAP[ch]
    if (v) out.push(v)
  }
  return out.length ? out : ['aa', 'mbp', 'aa']
}

/** The letter→viseme map, exposed for tooling/tests. */
export { PMAP }

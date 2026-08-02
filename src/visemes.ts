import type { VisemeName, VisemeSpec } from './types.js'

/**
 * Persian viseme table. Each entry is a mouth shape shared by a family of
 * phonemes. This is deliberately a *group* mapping (grapheme → viseme family),
 * which gives readable, kid-friendly lip-sync without a full G2P pass. A backend
 * phonemiser can emit these same names for higher accuracy.
 */
export const VISEMES: Record<VisemeName, VisemeSpec> = {
  rest: { o: 0.05, w: 1, label: '—' },
  aa: { o: 1, w: 1.12, label: 'آ اَ' }, // آب، دَر، ها
  e: { o: 0.5, w: 1.08, label: 'اِ ه' },
  i: { o: 0.32, w: 1.34, label: 'ای ی' }, // سیب، دیو
  o: { o: 0.55, w: 0.82, r: 1.15, label: 'اُ' },
  u: { o: 0.4, w: 0.66, r: 1.45, label: 'او و' }, // موش
  mbp: { o: 0, closed: true, w: 1, label: 'م ب پ' },
  f: { o: 0.16, w: 1, tuck: true, label: 'ف' },
  sh: { o: 0.36, w: 0.85, r: 1.2, label: 'ش چ ژ' },
  s: { o: 0.22, w: 1.24, label: 'س ز ص' },
  l: { o: 0.42, w: 1, tongue: true, label: 'ل ن ت د ر' },
}

/** Persian letter → viseme family. */
const PMAP: Record<string, VisemeName> = {}
const put = (letters: string, v: VisemeName) => {
  for (const c of letters) PMAP[c] = v
}
put('اآأإٱ', 'aa')
put('هحع', 'e')
put('یيئ', 'i')
put('وؤ', 'u')
put('مبپ', 'mbp')
put('ف', 'f')
put('شچژ', 'sh')
put('سزصثذضظ', 's')
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

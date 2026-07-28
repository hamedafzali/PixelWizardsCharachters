/**
 * Persian viseme table. Each entry is a mouth shape shared by a family of
 * phonemes. This is deliberately a *group* mapping (grapheme → viseme family),
 * which gives readable, kid-friendly lip-sync without a full G2P pass. A backend
 * phonemiser can emit these same names for higher accuracy.
 */
export const VISEMES = {
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
};
/** Persian letter → viseme family. */
const PMAP = {};
const put = (letters, v) => {
    for (const c of letters)
        PMAP[c] = v;
};
put('اآأإٱ', 'aa');
put('هحع', 'e');
put('یيئ', 'i');
put('وؤ', 'u');
put('مبپ', 'mbp');
put('ف', 'f');
put('شچژ', 'sh');
put('سزصثذضظ', 's');
put('لنتدرطكکگقغخج', 'l');
/**
 * Turn a Persian string into a viseme sequence for playback. Spaces become a
 * brief `rest`. Diacritics/unknowns are skipped. Never returns empty.
 */
export function textToVisemes(text) {
    const out = [];
    for (const ch of text.trim()) {
        if (ch === ' ') {
            out.push('rest');
            continue;
        }
        const v = PMAP[ch];
        if (v)
            out.push(v);
    }
    return out.length ? out : ['aa', 'mbp', 'aa'];
}
/** The letter→viseme map, exposed for tooling/tests. */
export { PMAP };
//# sourceMappingURL=visemes.js.map
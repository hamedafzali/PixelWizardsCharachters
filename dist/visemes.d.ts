import type { VisemeName, VisemeSpec } from './types.js';
/**
 * Persian viseme table. Each entry is a mouth shape shared by a family of
 * phonemes. This is deliberately a *group* mapping (grapheme → viseme family),
 * which gives readable, kid-friendly lip-sync without a full G2P pass. A backend
 * phonemiser can emit these same names for higher accuracy.
 */
export declare const VISEMES: Record<VisemeName, VisemeSpec>;
/** Persian letter → viseme family. */
declare const PMAP: Record<string, VisemeName>;
/**
 * Turn a Persian string into a viseme sequence for playback. Spaces become a
 * brief `rest`. Diacritics/unknowns are skipped. Never returns empty.
 */
export declare function textToVisemes(text: string): VisemeName[];
/** The letter→viseme map, exposed for tooling/tests. */
export { PMAP };
//# sourceMappingURL=visemes.d.ts.map
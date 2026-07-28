import type { CharacterSpec } from '../types.js';
/**
 * The character roster. Each spec renders illustration-grade "premium flat"
 * art — form gradients + a core-shadow overlay for volume, rim light, sculpted
 * eyes, blush and secondary detail — and exposes the rig hooks
 * (`.iris`, `.browsG`, `#mouthG`). Core-shadow gradient ids are namespaced per
 * character so multiple characters can share one document.
 */
export declare const roozi: CharacterSpec;
export declare const ava: CharacterSpec;
export declare const pashmak: CharacterSpec;
export declare const laki: CharacterSpec;
export declare const tondpa: CharacterSpec;
export declare const boomi: CharacterSpec;
export declare const khersi: CharacterSpec;
/** The built-in roster, keyed by slug. */
export declare const CHARACTERS: Record<string, CharacterSpec>;
export declare const CHARACTER_SLUGS: string[];
//# sourceMappingURL=index.d.ts.map
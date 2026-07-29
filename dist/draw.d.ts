import type { BrowKey } from './types.js';
/**
 * Sculpted eye pair — the single biggest appeal lever. A white sclera + a
 * gradient iris/pupil that the rig can translate (gaze) + fixed corneal
 * catchlights + an upper-lid shadow + a lower lid that rises for a squint.
 *
 * Rig hooks: each eye is a `<g class="eyeG">` the rig scales for widen; inside
 * it each iris is a `<g class="iris" data-r="R">` the rig translates, and the
 * lower lid carries `.lidLo`. `squint`/`wide` are 0..1 (already scaled by
 * emotion intensity by the caller).
 *
 * **All geometry is drawn at the unscaled radius `r`.** Widen is a transform on
 * the wrapper, never baked into the drawn shapes — that is what lets the rig
 * retarget it live from interpolated intensity without a re-render, and keeps
 * the lid and the sclera locked to each other by construction rather than by
 * two formulas that have to be kept in agreement.
 */
export declare function eyes(x1: number, x2: number, y: number, r: number, irisId: string, squint?: number, wide?: number): string;
/**
 * The three bits of eye geometry that depend on intensity, shared by the static
 * renderer and the live rig hook so the two can never disagree.
 */
export declare const eyeWidenScale: (wide: number) => number;
export declare const eyeWidenTransform: (cx: number, cy: number, s: number) => string;
export declare const eyeLidRy: (r: number, squint: number, wide: number) => number;
/**
 * Eyebrow pair, wrapped in a single `<g class="browsG">` the rig can translate
 * for the independent `browRaise` channel. Brows carry most of the readable
 * emotion at a glance, so each mood gets a distinct pose.
 */
export declare function brows(x1: number, x2: number, y: number, browKey: BrowKey, color: string): string;
//# sourceMappingURL=draw.d.ts.map
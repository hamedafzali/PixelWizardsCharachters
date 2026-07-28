import type { BrowKey } from './types.js';
/**
 * Sculpted eye pair — the single biggest appeal lever. A white sclera + a
 * gradient iris/pupil that the rig can translate (gaze) + fixed corneal
 * catchlights + an upper-lid shadow + a lower lid that rises for a squint.
 *
 * Rig hooks: each iris is a `<g class="iris" data-r="R">` the rig translates;
 * lower lids carry `.lidLo`. `squint`/`wide` are 0..1 (already scaled by
 * emotion intensity by the caller).
 */
export declare function eyes(x1: number, x2: number, y: number, r: number, irisId: string, squint?: number, wide?: number): string;
/**
 * Eyebrow pair, wrapped in a single `<g class="browsG">` the rig can translate
 * for the independent `browRaise` channel. Brows carry most of the readable
 * emotion at a glance, so each mood gets a distinct pose.
 */
export declare function brows(x1: number, x2: number, y: number, browKey: BrowKey, color: string): string;
//# sourceMappingURL=draw.d.ts.map
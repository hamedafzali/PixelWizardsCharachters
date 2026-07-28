import type { ActorFrame, CharacterSpec, VisemeSpec } from './types.js';
/**
 * Build the mouth `<path>`/`<g>` markup for a viseme + explicit openness. The
 * rig calls this every frame and swaps it into `#mouthG`, so lip-sync is a
 * cheap innerHTML update rather than a full re-render.
 *
 * `beak` characters (owls) draw a two-tone beak instead of lips.
 */
export declare function drawMouth(mouth: {
    cx: number;
    cy: number;
    color: string;
    beak?: boolean;
}, viseme: VisemeSpec, mouthOpen: number): string;
/**
 * Render a complete, self-contained `<svg>` for one frame. This is the pure /
 * stateless path — handy for SSR, thumbnails and tests. The interactive
 * {@link ActorRig} renders once with this then mutates in place.
 *
 * The SVG uses a 200×200 art space inside a 120×120 viewBox-friendly scale so
 * it composes with the wider studio art; pass `size` for the pixel box.
 */
export declare function renderActorSVG(spec: CharacterSpec, frame: ActorFrame, size?: number): string;
//# sourceMappingURL=render.d.ts.map
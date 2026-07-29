import type { ActorFrame, CharacterSpec, VisemeSpec, EmotionOverrides } from './types.js';
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
 * The art space is 200×200; pass `size` for the pixel box.
 *
 * Three nested transform carriers sit between the flip and the art —
 * `.rig-root` (locomotion), `.rig-body` (gesture + squash/stretch) and
 * `.rig-mood` (emotion idle). They exist so those three channels compose
 * instead of overwriting one shared `transform`, and they are emitted for
 * layered and unlayered characters alike.
 *
 * `emotions` (optional) tunes the emotion presets per character — an editor can
 * override any channel of any emotion.
 */
export declare function renderActorSVG(spec: CharacterSpec, frame: ActorFrame, size?: number, emotions?: EmotionOverrides): string;
//# sourceMappingURL=render.d.ts.map
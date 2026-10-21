import type { ActorFrame, CharacterSpec, VisemeSpec, EmotionOverrides } from './types.js';
import { type MotionOverrides } from './motion.js';
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
 * The pivots of the two outer transform carriers. The rig sets them in its
 * stylesheet; a static SVG has no stylesheet, so it carries them inline
 * wherever it bakes a transform onto either.
 *
 * @internal
 */
export declare const CARRIER_ORIGIN: {
    readonly root: "100px 190px";
    readonly body: "100px 188px";
};
/** Options for {@link renderActorSVG}. */
export interface RenderOptions {
    /**
     * Motion-engine settings, layered over the character's own — pass the rig's
     * `motion` option so a server render matches the client rig that takes over.
     */
    motion?: MotionOverrides;
}
/**
 * Render a complete, self-contained `<svg>` for one frame. This is the pure /
 * stateless path — handy for SSR, thumbnails and tests.
 *
 * The art space is 200×200; pass `size` for the pixel box.
 *
 * Three nested transform carriers sit between the flip and the art —
 * `.rig-root` (locomotion), `.rig-body` (gesture + squash/stretch) and
 * `.rig-mood` (emotion idle). They exist so those three channels compose
 * instead of overwriting one shared `transform`, and they are emitted for
 * layered and unlayered characters alike.
 *
 * The frame's live channels are baked in at rest — gaze (the irises, and the
 * head turning after them), `browRaise`, `yaw`, the emotion's posture and a
 * locomotion's lean — so the SVG matches what a mounted {@link ActorRig} shows
 * once it settles on the same frame. What only exists over time is not: blinks,
 * breathing, the gait cycle, gestures and the emotion's idle loop.
 *
 * `emotions` (optional) tunes the emotion presets per character — an editor can
 * override any channel of any emotion.
 */
export declare function renderActorSVG(spec: CharacterSpec, frame: ActorFrame, size?: number, emotions?: EmotionOverrides, opts?: RenderOptions): string;
/**
 * The bare art, every live channel at its neutral value — what {@link ActorRig}
 * mounts and then drives. Baking the rest pose in there would leave stale
 * transforms on hooks the rig only writes while they move.
 *
 * @internal
 */
export declare function renderArtSVG(spec: CharacterSpec, frame: ActorFrame, size?: number, emotions?: EmotionOverrides): string;
//# sourceMappingURL=render.d.ts.map
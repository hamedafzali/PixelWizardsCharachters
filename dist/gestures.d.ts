import type { Gesture, Locomotion } from './types.js';
import type { TimedAction } from './timing.js';
import { type GaitName, type LocoTarget } from './locomotion.js';
/**
 * The gesture library.
 *
 * A gesture declares only what it *does*. Anticipation (counter-move + load-up
 * squash) and the settle (impact squash → rebound stretch → rest) are derived
 * by `buildAction`, so a gesture added here inherits both without writing an
 * extra keyframe.
 *
 * ## Why gestures have `parts`
 *
 * The original three (wave/jump/spin) each drove one element. A clap or a shrug
 * is two arms moving together, and running them as two separate gestures would
 * let them drift apart by a frame. So a gesture is a *list* of layer/action
 * pairs played as one, and the fallback triggers if **any** required layer is
 * missing rather than just the first.
 *
 * ## The two ways a gesture can be unavailable
 *
 * They are different and are kept apart deliberately:
 *
 *   **Structural** — the character has no such limb (پشمک has no arms, بومی has
 *   no head layer), or the limb is currently owned by a phase-driven gait. Both
 *   are recoverable: the gesture plays its whole-body `fallback`, so a wave
 *   still reads as a wave. Derived, never authored — see {@link gaitDrivenLayers}.
 *
 *   **Semantic** — the action makes no sense in that locomotion state. You
 *   cannot jump while already airborne. Not derivable from geometry, so it is
 *   authored per gesture in `during`, and it *blocks*: no fallback, nothing
 *   plays. See {@link GESTURE_DURING}.
 */
/** One element of a gesture: which layer moves, and how. */
export interface GesturePart {
    layer: string;
    action: TimedAction;
}
export interface GestureDef {
    /** Played together as one gesture. All layers must exist or the fallback runs. */
    parts: GesturePart[];
    /** Whole-body stand-in for a character missing a limb, or one whose limb is busy. */
    fallback?: GesturePart;
    /** Locomotion states this gesture is *semantically* allowed in. */
    during: readonly Locomotion[];
}
export declare const GESTURES: Record<Gesture, GestureDef>;
export declare const GESTURE_NAMES: Gesture[];
/** Which DOM layer a locomotion target writes to. The rig's three transform
 *  carriers are why `root` and `torso` are not `lyr-` groups. */
export declare function locoTargetLayer(t: LocoTarget): string;
/**
 * The layers a gait actually animates — `tracks`, not `requires`.
 *
 * The distinction matters: a walk *requires* only two legs, but it also swings
 * the arms, so a wave during a driven walk would be fighting the arm swing for
 * the same element. `requires` would miss that.
 */
export declare function gaitDrivenLayers(gait: GaitName): Set<string>;
/** Every layer this gesture's parts touch (not counting the fallback). */
export declare function gestureLayers(g: Gesture): string[];
/** Does this gesture want a layer the gait is already driving? */
export declare function conflictsWithGait(g: Gesture, gait: GaitName): boolean;
/**
 * The compatibility table, as data. Semantic only — structural availability is
 * per character and per frame, so it cannot live in a static table. Exported
 * because "can this character do this right now" is a question a UI wants to
 * ask before offering a button.
 */
export declare const GESTURE_DURING: Record<Gesture, readonly Locomotion[]>;
export type GesturePlan = {
    mode: 'parts';
    parts: GesturePart[];
} | {
    mode: 'fallback';
    parts: GesturePart[];
    reason: 'missing-layer' | 'gait-owns-layer' | 'character-opt-out';
} | {
    mode: 'blocked';
    reason: 'semantic';
};
/**
 * Decide how a gesture should play for one character in one frame.
 *
 * Order matters. A semantically-blocked gesture is blocked whatever the
 * character's anatomy — offering a body-shaped stand-in for "jump while flying"
 * would be inventing an action nobody asked for. Structural problems, by
 * contrast, are what the fallback exists for.
 */
export declare function planGesture(g: Gesture, locomotion: Locomotion, drivenGait: GaitName | null, hasLayer: (layer: string) => boolean, optOut?: readonly Gesture[]): GesturePlan;
//# sourceMappingURL=gestures.d.ts.map
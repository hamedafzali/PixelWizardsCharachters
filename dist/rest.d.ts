import type { ActorFrame, EmotionOverrides, LayerName, PostureMap } from './types.js';
import { type Pose } from './timing.js';
import { type MotionSettings, type MotionTarget } from './motion.js';
/**
 * The live channels of one frame, at rest: what a mounted rig shows once every
 * spring has landed and before anything time-based (blinks, breathing, gait,
 * gestures) moves it. The art does not draw any of this — the rig writes it
 * onto the art's hooks — so a static render that skipped it showed every
 * character straight ahead, brows level and spine upright whatever the frame
 * said (PW-08).
 *
 * One function for both paths, so the static SVG and the rig's first settled
 * frame cannot disagree: {@link renderActorSVG} bakes it into the markup, and
 * the rig reads its gaze from {@link lookTarget} here too.
 */
export interface RestState {
    /** each transform target's pose: posture plus the motion engine at rest */
    poses: Partial<Record<MotionTarget, Pose>>;
    /** how far the face slides across its parent, art units */
    faceX: number;
    /** the yaw the shading shows, -1..1 */
    shade: number;
    /** the iris offset, art units */
    iris: {
        x: number;
        y: number;
    };
    /** the brow group's vertical offset, art units */
    browY: number;
}
/**
 * Where the eyes are told to look: the frame's gaze plus the emotion's own
 * bias scaled by intensity, plus `extra` (the rig's idle saccade), clamped to
 * ±1 on the sum.
 */
export declare function lookTarget(frame: ActorFrame, emotions?: EmotionOverrides, extra?: {
    x: number;
    y: number;
}): {
    x: number;
    y: number;
};
/**
 * The target a layer's transform lands on. A character with no torso layer
 * poses its spine on `.rig-body`, exactly as the rig does.
 */
export declare function transformKey(t: MotionTarget, has: (l: LayerName) => boolean): MotionTarget;
/** {@link RestState} for one frame of a character with these layers. */
export declare function restState(frame: ActorFrame, opts: {
    has: (l: LayerName) => boolean;
    eyeRadius: number;
    motion: MotionSettings;
    posture?: PostureMap;
    emotions?: EmotionOverrides;
}): RestState;
//# sourceMappingURL=rest.d.ts.map
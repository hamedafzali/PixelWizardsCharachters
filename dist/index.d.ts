/**
* PixelWizardsCharachters — a framework-agnostic library of animated, "actable"
 * children's characters.
 *
 * A character is a puppet; an {@link ActorFrame} is one moment of performance.
 * A connected AI (or a timeline, or UI controls) emits frames and the rig
 * performs them: emotion, Persian-viseme lip-sync, gaze, brows, gestures and
 * locomotion. See the README for the full contract.
 */
export type { ActorFrame, EmotionName, VisemeName, Locomotion, Gesture, Facing, BrowKey, EmotionSpec, EmotionOverrides, VisemeSpec, CharacterSpec, LayerName, RigLayer, RigLayers, PostureSpec, PostureMap, } from './types.js';
export { defaultFrame, LAYER_ORDER } from './types.js';
export { EMOTIONS, EMOTION_LABELS, resolveEmotion } from './emotions.js';
export { POSTURES, resolvePosture } from './posture.js';
export { buildAction, ensureAction, poseToTransform, composePoses } from './timing.js';
export type { Pose, TimedAction } from './timing.js';
export { FrameInterpolator, EASINGS, DEFAULT_PROFILE } from './interpolate.js';
export type { Easing, EasingName, ChannelName, ChannelSpec, NumericChannel, DiscreteChannel, InterpolationProfile, } from './interpolate.js';
export { IdleMicroMotion, blinkStyle, BLINK_STYLES } from './micro.js';
export type { MicroConfig, MicroOutput, BlinkStyle } from './micro.js';
export { GESTURES, GESTURE_NAMES, GESTURE_DURING, planGesture, gestureLayers, gaitDrivenLayers, conflictsWithGait, locoTargetLayer, } from './gestures.js';
export type { GestureDef, GesturePart, GesturePlan } from './gestures.js';
export { VISEMES, PMAP, textToVisemes } from './visemes.js';
export { eyes, brows, eyeWidenScale, eyeWidenTransform, eyeLidRy } from './draw.js';
export { CHARACTERS, CHARACTER_SLUGS } from './characters/index.js';
export { renderActorSVG, drawMouth } from './render.js';
export { ActorRig, RIG_CSS, artKeyOf } from './rig.js';
export type { RigOptions } from './rig.js';
export { LocomotionDriver, GAITS, LOCO_TARGETS, WALK_PHASES, FLY_PHASES, WING_FOLD_SX, samplePhase, wrapPhase, canDrive, drivesGait, type GaitName, type LocoTarget, type Gait, type PhaseKey, } from './locomotion.js';
//# sourceMappingURL=index.d.ts.map
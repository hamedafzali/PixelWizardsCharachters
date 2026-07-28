/**
* PixelWizardsCharachters — a framework-agnostic library of animated, "actable"
 * children's characters.
 *
 * A character is a puppet; an {@link ActorFrame} is one moment of performance.
 * A connected AI (or a timeline, or UI controls) emits frames and the rig
 * performs them: emotion, Persian-viseme lip-sync, gaze, brows, gestures and
 * locomotion. See the README for the full contract.
 */

export type {
  ActorFrame,
  EmotionName,
  VisemeName,
  Locomotion,
  Gesture,
  Facing,
  BrowKey,
  EmotionSpec,
  EmotionOverrides,
  VisemeSpec,
  CharacterSpec,
} from './types.js'
export { defaultFrame } from './types.js'

export { EMOTIONS, EMOTION_LABELS, resolveEmotion } from './emotions.js'
export { VISEMES, PMAP, textToVisemes } from './visemes.js'
export { eyes, brows } from './draw.js'
export { CHARACTERS, CHARACTER_SLUGS } from './characters/index.js'

export { renderActorSVG, drawMouth } from './render.js'
export { ActorRig, RIG_CSS } from './rig.js'
export type { RigOptions } from './rig.js'

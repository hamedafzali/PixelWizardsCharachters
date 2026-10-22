import type { ActorFrame, EmotionOverrides, LayerName, PostureMap } from './types.js'
import { resolveEmotion } from './emotions.js'
import { resolvePosture, posturePoses } from './posture.js'
import { composePoses, type Pose } from './timing.js'
import { MotionEngine, type MotionSettings, type MotionTarget } from './motion.js'

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
  poses: Partial<Record<MotionTarget, Pose>>
  /** how far the face slides across its parent, art units */
  faceX: number
  /** the yaw the shading shows, -1..1 */
  shade: number
  /** the iris offset, art units */
  iris: { x: number; y: number }
  /** the brow group's vertical offset, art units */
  browY: number
}

const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v)

/**
 * Where the eyes are told to look: the frame's gaze plus the emotion's own
 * bias scaled by intensity, plus `extra` (the rig's idle saccade), clamped to
 * ±1 on the sum.
 */
export function lookTarget(
  frame: ActorFrame,
  emotions?: EmotionOverrides,
  extra: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const bias = resolveEmotion(frame.emotion, emotions).gaze
  const k = frame.intensity
  return {
    x: clamp1(frame.gaze.x + (bias?.x ?? 0) * k + extra.x),
    y: clamp1(frame.gaze.y + (bias?.y ?? 0) * k + extra.y),
  }
}

/**
 * The target a layer's transform lands on. A character with no torso layer
 * poses its spine on `.rig-body`, exactly as the rig does.
 */
export function transformKey(t: MotionTarget, has: (l: LayerName) => boolean): MotionTarget {
  return t === 'torso' && !has('torso') ? 'body' : t
}

/** {@link RestState} for one frame of a character with these layers. */
export function restState(
  frame: ActorFrame,
  opts: {
    has: (l: LayerName) => boolean
    eyeRadius: number
    motion: MotionSettings
    posture?: PostureMap
    emotions?: EmotionOverrides
  },
): RestState {
  const { has } = opts
  const base = new Map<MotionTarget, Pose[]>()
  const put = (t: MotionTarget, p: Pose): void => {
    const key = transformKey(t, has)
    const list = base.get(key)
    if (list) list.push(p)
    else base.set(key, [p])
  }
  const posture = posturePoses(resolvePosture(frame.emotion, frame.intensity, opts.posture))
  for (const l of Object.keys(posture) as LayerName[]) put(l, posture[l]!)

  const gaze = lookTarget(frame, opts.emotions)
  const out = new MotionEngine(opts.motion).tick(0, {
    frame,
    gaze,
    has,
    pose: (t) => composePoses(base.get(transformKey(t, has)) ?? []),
  }, true)
  // One motion pose per target, the last written winning, as the rig keeps
  // them: on a character with no torso layer the engine's torso and body poses
  // share `.rig-body`.
  const motion = new Map<MotionTarget, Pose>()
  for (const t of Object.keys(out.poses) as MotionTarget[]) motion.set(transformKey(t, has), out.poses[t]!)

  const poses: RestState['poses'] = {}
  for (const t of new Set([...base.keys(), ...motion.keys()])) {
    const m = motion.get(t)
    poses[t] = composePoses(m ? [...(base.get(t) ?? []), m] : base.get(t)!)
  }
  const r = opts.eyeRadius
  return {
    poses,
    faceX: out.faceX,
    shade: out.shade,
    iris: { x: gaze.x * r * 0.5, y: gaze.y * r * 0.5 },
    browY: -frame.browRaise * 5,
  }
}

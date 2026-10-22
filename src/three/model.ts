/**
 * The headless half of the three.js renderer: an `ActorFrame` in, a posed
 * object tree out. No renderer, no DOM, no timers — one clock, advanced by
 * {@link ActorModel.tick}, drives everything, so the same model runs inside
 * `ThreeActor`'s animation loop and inside a Node test that steps it by hand.
 *
 * It is the SVG `ActorRig`'s driver loop, reading the same data: the frame
 * interpolator, idle micro-motion, gait tables, posture presets, gesture plans
 * and the motion engine. What changes is only where a pose lands — a group's
 * position, rotation and scale instead of a `transform` string — and that the
 * head and body can turn for real, so the engine's 2D stand-ins for a turn (the
 * head slide, the layer parallax) are switched off and its spring state is read
 * as rotation instead.
 */

import * as THREE from 'three'
import type {
  ActorFrame, CharacterSpec, EmotionName, Gesture, GestureEnd, PlayGestureOptions, EmotionOverrides, LayerName,
} from '../types.js'
import { defaultFrame } from '../types.js'
import { resolveEmotion } from '../emotions.js'
import { eyeWidenScale } from '../draw.js'
import { resolvePosture, posturePoses } from '../posture.js'
import { composePoses, type Pose, type TimedAction } from '../timing.js'
import { sampleAction } from '../sample.js'
import { IdleMicroMotion, blinkStyle, type MicroConfig } from '../micro.js'
import { FrameInterpolator, type InterpolationProfile } from '../interpolate.js'
import {
  LocomotionDriver, LOCO_TARGETS, LOCO_FALLBACK_POSES, LOCO_FALLBACK_DUR, drivesGait, samplePhase, wrapPhase,
  type GaitName, type LocoTarget, type PhaseKey,
} from '../locomotion.js'
import { planGesture, type GesturePlan } from '../gestures.js'
import { VISEMES, textToVisemes } from '../visemes.js'
import { sanitizeFrame, isKnownGesture, knownCharacter, type OnInvalidFrame } from '../validate.js'
import { MotionEngine, resolveMotion, type MotionOutput, type MotionOverrides, type MotionSettings, type MotionTarget } from '../motion.js'
import { BROW_LINES, DEFAULT_TURN3D, type Turn3D } from '../body3d.js'
import { buildModel, type BuiltModel } from './build.js'

const D2R = Math.PI / 180

/**
 * The SVG rig's emotion idle animations (`MOOD_ANIM` + `RIG_CSS`'s
 * `@keyframes`), as phase tables. Read off the keyframe percentages; sampled
 * with `samplePhase`, which eases each segment rather than replaying CSS's
 * `ease-in-out` exactly — the same documented limit as `LOCO_FALLBACK_POSES`.
 */
const BREATHE: PhaseKey[] = [{ at: 0, pose: {} }, { at: 0.5, pose: { sx: 1.02, sy: 1.02 } }]
const FLOATY: PhaseKey[] = [{ at: 0, pose: {} }, { at: 0.5, pose: { y: -5 } }]
const WIGGLE: PhaseKey[] = [{ at: 0, pose: { rot: -3 } }, { at: 0.5, pose: { rot: 3 } }]
const SWAY: PhaseKey[] = [{ at: 0, pose: { rot: -2 } }, { at: 0.5, pose: { rot: 2, y: -2 } }]
const NOD: PhaseKey[] = [{ at: 0, pose: {} }, { at: 0.4, pose: { y: -4 } }, { at: 0.7, pose: { y: 1 } }]
const DROOP: PhaseKey[] = [{ at: 0, pose: {} }, { at: 0.5, pose: { y: 3, rot: -1 } }]
const POP: PhaseKey[] = [{ at: 0, pose: {} }, { at: 0.3, pose: { sx: 1.12, sy: 1.12 } }, { at: 0.6, pose: { sx: 0.97, sy: 0.97 } }]

export const MOOD_POSES: Record<EmotionName, { keys: readonly PhaseKey[]; dur: number; once?: boolean }> = {
  neutral: { keys: BREATHE, dur: 4 },
  happy: { keys: FLOATY, dur: 3 },
  excited: { keys: WIGGLE, dur: 0.5 },
  thinking: { keys: SWAY, dur: 4 },
  encouraging: { keys: NOD, dur: 1.6 },
  sad: { keys: DROOP, dur: 4.5 },
  surprised: { keys: POP, dur: 0.4, once: true },
  sleepy: { keys: DROOP, dur: 6 },
  love: { keys: FLOATY, dur: 2.4 },
  confused: { keys: SWAY, dur: 2.2 },
  proud: { keys: BREATHE, dur: 5 },
  shy: { keys: DROOP, dur: 5.2 },
}

/**
 * What the engine must not do in 3D: its head slide (`attention.turn`,
 * `pitch`) and layer parallax (`depth.travel`) fake a rotation the model
 * performs for real. Layered last, over every other level, so no setting can
 * double the turn.
 */
export const MOTION_3D: MotionOverrides = { depth: { travel: 0 }, attention: { turn: 0, pitch: 0 } }

export interface ActorModelOptions {
  /** disable autonomous blinking */
  blink?: boolean
  emotions?: EmotionOverrides
  micro?: MicroConfig
  interpolation?: InterpolationProfile
  /** motion-engine overrides, as {@link RigOptions.motion} */
  motion?: MotionOverrides
  /** reduced motion: everything lands at once; no micro-motion, gestures or blinks */
  reducedMotion?: boolean
  /** blink timing randomness, for deterministic tests; default Math.random */
  random?: () => number
  onFrame?: (frame: ActorFrame) => void
  onSettled?: (frame: ActorFrame) => void
  onGestureBlocked?: (gesture: Gesture, reason: 'semantic') => void
  onInvalidFrame?: OnInvalidFrame
}

type Target = MotionTarget | 'mood'

interface ActiveGesture {
  gesture: Gesture
  target: MotionTarget
  action: TimedAction
  t: number
}

/** `'lyr-head'` → `'head'`, `'rig-body'` → `'body'`, as the SVG rig reads gesture layers. */
function gestureTarget(cls: string): MotionTarget | null {
  if (cls === 'rig-body') return 'body'
  if (cls === 'rig-root') return 'root'
  return cls.startsWith('lyr-') ? (cls.slice(4) as LayerName) : null
}

const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v)

export class ActorModel {
  private spec: CharacterSpec
  private opts: ActorModelOptions
  private built: BuiltModel
  private frame: ActorFrame
  private interp: FrameInterpolator
  private micro: IdleMicroMotion
  private loco = new LocomotionDriver()
  private engine: MotionEngine
  private motionOverrides: MotionOverrides | undefined
  private contrib = new Map<Target, Map<string, Pose>>()
  private out: MotionOutput | null = null
  private saccade = { x: 0, y: 0 }
  private gestures: ActiveGesture[] = []
  private lastGesture: Gesture | null = null
  /** the gesture the driver last sent; see `ActorRig.apply` (PW-05) */
  private sentGesture: Gesture | null = null
  /** `onEnd` per gesture in flight */
  private ends = new Map<Gesture, (how: GestureEnd) => void>()
  private settledFired = true
  private clock = 0
  private moodKey = ''
  private moodT = 0
  private fallbackPhase = 0
  private blinkIn: number
  /** seconds the lids stay shut; > 0 while blinking */
  private shut = 0
  private pendingBlink: number | null = null
  /** 0 open … 1 shut, eased */
  private lid = 0
  private speech: { seq: string[]; i: number; per: number; left: number } | null = null
  private rand: () => number

  constructor(spec: CharacterSpec, opts: ActorModelOptions = {}) {
    this.spec = spec
    this.opts = { blink: true, ...opts }
    this.rand = opts.random ?? Math.random
    this.built = buildModel(spec)
    this.frame = defaultFrame(spec.slug)
    this.interp = new FrameInterpolator(this.frame, opts.interpolation)
    this.micro = new IdleMicroMotion(opts.micro)
    this.engine = new MotionEngine(this.resolve())
    this.blinkIn = this.nextBlinkGap()
    this.sync()
    this.settle()
  }

  /** The object tree; add it to a scene. The facing mirror is applied to it. */
  get object(): THREE.Group {
    return this.built.object
  }

  /** The joints, face and shadow, for inspection and tests. */
  get parts(): BuiltModel {
    return this.built
  }

  /** The rendered (eased) frame. */
  get current(): ActorFrame {
    return this.frame
  }

  /** The frame as last requested, before easing. */
  get goal(): ActorFrame {
    return this.interp.goal
  }

  get settling(): boolean {
    return this.interp.settling
  }

  get reduced(): boolean {
    return !!this.opts.reducedMotion
  }

  /** Switch reduced motion after construction; turning it on lands everything now. */
  setReducedMotion(on: boolean): void {
    if (on === this.reduced) return
    this.opts = { ...this.opts, reducedMotion: on }
    if (on) this.finish()
  }

  /** The motion-engine settings in effect, including the 3D overrides. */
  get motion(): MotionSettings {
    return this.engine.settings
  }

  private resolve(): MotionSettings {
    return resolveMotion(this.spec.motion, this.opts.motion, this.motionOverrides, MOTION_3D)
  }

  /** Retune the motion engine live, as {@link ActorRig.setMotion}. */
  setMotion(overrides?: MotionOverrides): void {
    this.motionOverrides = overrides
    this.engine.settings = this.resolve()
    if (this.reduced) this.settle()
  }

  /** The turn ranges in effect: the character's, over {@link DEFAULT_TURN3D}. */
  get turn(): Turn3D {
    return { ...DEFAULT_TURN3D, ...this.spec.body3d?.turn }
  }

  /**
   * Request a frame. Sets the goal; {@link tick} eases toward it. Channels with
   * no easing (viseme, emotion, facing) land at once, as in the SVG rig, and
   * under reduced motion everything does.
   */
  apply(frame: Partial<ActorFrame>): void {
    let clean = sanitizeFrame(frame, this.frame, this.opts.onInvalidFrame)
    // Same rule as `ActorRig.apply`: a known character switches, an unknown
    // one is reported and the current one kept.
    if (clean.character !== undefined && clean.character !== this.spec.slug) {
      const spec = knownCharacter(clean.character)
      if (spec) this.setCharacter(spec)
      else {
        this.opts.onInvalidFrame?.({ channel: 'character', value: clean.character, kept: this.spec.slug })
        clean = { ...clean, character: this.spec.slug }
      }
    }
    // Same rule as `ActorRig.apply`: a gesture starts when the driver's value
    // changes, not each time it arrives (PW-05).
    if (clean.gesture !== undefined) {
      if (clean.gesture === this.sentGesture) {
        const { gesture: _, ...rest } = clean
        clean = rest
      } else this.sentGesture = clean.gesture
    }
    this.commit(clean)
  }

  /** Target a sanitized frame. The model's own channel writes come in here, not through `apply`. */
  private commit(clean: Partial<ActorFrame>): void {
    this.interp.target(clean)
    if (this.interp.settling) this.settledFired = false
    if (this.reduced) this.interp.finish()
    this.frame = this.interp.current
    this.sync()
    if (this.reduced) this.settle()
    else this.flush()
  }

  /** Land every channel and every spring on its goal now. */
  finish(): void {
    this.interp.finish()
    this.frame = this.interp.current
    this.sync()
    this.settle()
  }

  /** Swap to a different character: a new body, the same frame and clock. */
  setCharacter(spec: CharacterSpec): void {
    const parent = this.built.object.parent
    this.built.dispose()
    this.spec = spec
    this.built = buildModel(spec)
    parent?.add(this.built.object)
    this.contrib.clear()
    this.gestures = []
    this.endGone('interrupted')
    this.engine.settings = this.resolve()
    this.apply({ character: spec.slug })
    this.finish()
  }

  /**
   * Advance everything by `dt` seconds and pose the tree. The one clock: frame
   * easing, gait, breathing, gestures, mood, blinks, speech and the springs
   * all read it, so nothing drifts against anything else.
   */
  tick(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) return
    dt = Math.min(dt, 0.1)
    this.clock += dt
    this.tickSpeech(dt)
    if (this.interp.settling) {
      this.frame = this.interp.tick(dt * 1000)
      this.sync()
    }
    if (this.reduced) {
      this.settle()
      return
    }
    this.tickLocomotion(dt)
    const m = this.micro.tick(dt, this.frame)
    this.set('torso', 'micro', m.torso)
    this.set('head', 'micro', m.head)
    this.saccade = m.gaze
    this.tickMood(dt)
    this.tickGestures(dt)
    this.tickBlink(dt)
    this.runEngine(dt, false)
    this.flush()
  }

  // ------------------------------------------------------------- channels ---

  /** Everything that follows the frame alone. Runs on every frame change. */
  private sync(): void {
    const posture = posturePoses(resolvePosture(this.frame.emotion, this.frame.intensity, this.spec.posture))
    for (const l of Object.keys(posture) as LayerName[]) this.set(l, 'posture', posture[l]!)
    this.built.object.scale.x = this.frame.facing === 'left' ? -1 : 1
    const g = this.frame.gesture
    if (g && g !== this.lastGesture) this.playGesture(g)
    this.lastGesture = g
    this.opts.onFrame?.(this.frame)
    if (!this.interp.settling && !this.settledFired) {
      this.settledFired = true
      this.opts.onSettled?.(this.frame)
    }
  }

  private set(t: Target, source: string, pose: Pose): void {
    let bucket = this.contrib.get(t)
    if (!bucket) {
      bucket = new Map()
      this.contrib.set(t, bucket)
    }
    bucket.set(source, pose)
  }

  private has = (l: LayerName): boolean => this.built.has(l)

  private drivenGait(): GaitName | null {
    const l = this.frame.locomotion
    if (l !== 'walk' && l !== 'fly' && l !== 'roll') return null
    const has = (t: LocoTarget) => t === 'root' || t === 'torso' || this.has(t)
    return drivesGait(l, has, this.spec.gaits) ? l : null
  }

  private tickLocomotion(dt: number): void {
    const speed = Math.max(0.3, this.frame.speed)
    const gait = this.drivenGait()
    this.loco.advance(dt, gait, speed)
    for (const t of LOCO_TARGETS) {
      if (t !== 'root' && t !== 'torso' && !this.has(t)) continue
      this.set(t, 'loco', this.loco.pose(t))
    }
    // The SVG rig's CSS body bob, for a character no gait table drives.
    const l = this.frame.locomotion
    if (gait === null && (l === 'walk' || l === 'fly')) {
      this.fallbackPhase = wrapPhase(this.fallbackPhase + dt / (LOCO_FALLBACK_DUR[l] / speed))
      this.set('root', 'locoFallback', samplePhase(LOCO_FALLBACK_POSES[l], this.fallbackPhase))
    } else {
      this.fallbackPhase = 0
      this.set('root', 'locoFallback', {})
    }
  }

  private tickMood(dt: number): void {
    const speed = Math.max(0.3, this.frame.speed)
    const m = MOOD_POSES[this.frame.emotion]
    // A change of emotion restarts the cycle, as a new CSS animation would.
    const key = `${this.frame.emotion}|${speed}`
    if (key !== this.moodKey) {
      if (!this.moodKey.startsWith(`${this.frame.emotion}|`)) this.moodT = 0
      this.moodKey = key
    } else {
      this.moodT += dt
    }
    const u = this.moodT / (m.dur / speed)
    this.set('mood', 'mood', m.once && u >= 1 ? {} : samplePhase(m.keys, u))
  }

  /** Start a one-shot gesture, planned exactly as the SVG rig plans it. */
  playGesture(g: Gesture, opts: PlayGestureOptions = {}): void {
    const { onEnd } = opts
    const plan = this.planFor(g)
    if (plan === null) return onEnd?.('skipped')
    if (plan.mode === 'blocked') {
      this.clearGesture(g)
      this.opts.onGestureBlocked?.(g, plan.reason)
      return onEnd?.('blocked')
    }
    if (this.reduced) {
      this.clearGesture(g)
      return onEnd?.('skipped')
    }
    const parts = plan.parts.flatMap((p) => {
      const target = gestureTarget(p.layer)
      return target ? [{ target, action: p.action }] : []
    })
    if (!parts.length) {
      this.clearGesture(g)
      return onEnd?.('skipped')
    }
    // A restart cuts the run in flight short, the same as in the SVG rig.
    this.gestures = this.gestures.filter((a) => a.gesture !== g)
    this.endGone('interrupted')
    for (const { target, action } of parts) {
      this.gestures = this.gestures.filter((a) => a.target !== target)
      this.gestures.push({ gesture: g, target, action, t: 0 })
    }
    // ...and so does taking over every part of another gesture.
    this.endGone('interrupted')
    if (onEnd) this.ends.set(g, onEnd)
  }

  /** Report `how` to every `onEnd` whose gesture has no part left playing. */
  private endGone(how: GestureEnd): void {
    for (const [g, onEnd] of this.ends) {
      if (this.gestures.some((a) => a.gesture === g)) continue
      this.ends.delete(g)
      onEnd(how)
    }
  }

  /** How this gesture would play right now. */
  planFor(g: Gesture): GesturePlan | null {
    if (!isKnownGesture(g)) {
      this.opts.onInvalidFrame?.({ channel: 'gesture', value: g, kept: null })
      return null
    }
    const hasLayer = (cls: string): boolean => {
      const t = gestureTarget(cls)
      return t === 'root' || t === 'body' || (t !== null && this.has(t))
    }
    return planGesture(g, this.frame.locomotion, this.drivenGait(), hasLayer, this.spec.gestureFallback)
  }

  private tickGestures(dt: number): void {
    const done = new Set<Gesture>()
    for (const bucket of this.contrib.values()) bucket.delete('gesture')
    this.gestures = this.gestures.filter((a) => {
      a.t += dt
      if (a.t >= a.action.dur) {
        done.add(a.gesture)
        return false
      }
      // Composed with posture and gait rather than replacing them, unlike a CSS
      // animation, which outranks the element's inline transform.
      this.set(a.target, 'gesture', sampleAction(a.action, a.t / a.action.dur))
      return true
    })
    for (const g of done) if (!this.gestures.some((a) => a.gesture === g)) this.clearGesture(g)
    this.endGone('done')
  }

  private clearGesture(g: Gesture): void {
    if (this.interp.goal.gesture === g) this.commit({ gesture: null })
  }

  // ---------------------------------------------------------- face timing ---

  private nextBlinkGap(): number {
    const s = blinkStyle(this.frame.emotion)
    return s.minGap + this.rand() * (s.maxGap - s.minGap)
  }

  /** One blink, held as long as the current emotion's lids are heavy. */
  blink(): void {
    if (this.reduced) return
    this.shut = blinkStyle(this.frame.emotion).dur
  }

  private tickBlink(dt: number): void {
    if (this.shut > 0) this.shut = Math.max(0, this.shut - dt)
    if (this.pendingBlink !== null) {
      this.pendingBlink -= dt
      if (this.pendingBlink <= 0) {
        this.pendingBlink = null
        this.blink()
      }
    }
    if (this.opts.blink) {
      this.blinkIn -= dt
      if (this.blinkIn <= 0) {
        const s = blinkStyle(this.frame.emotion)
        this.blink()
        if (this.rand() < s.doubleChance) this.pendingBlink = s.dur + 0.09
        this.blinkIn = this.nextBlinkGap()
      }
    }
    // The SVG lid's 90ms transition, as an exponential approach.
    const target = this.shut > 0 ? 1 : 0
    this.lid += (target - this.lid) * (1 - Math.exp(-dt / 0.03))
    if (Math.abs(target - this.lid) < 1e-3) this.lid = target
  }

  /** Speak a Persian string through its viseme sequence, on the model's clock. */
  speak(text: string, perViseme = 85): void {
    const seq = textToVisemes(text)
    this.speech = { seq, i: 0, per: perViseme / 1000, left: 0 }
    this.tickSpeech(0)
  }

  private tickSpeech(dt: number): void {
    const s = this.speech
    if (!s) return
    s.left -= dt
    while (s.left <= 0) {
      if (s.i >= s.seq.length) {
        this.speech = null
        this.apply({ viseme: 'rest', mouthOpen: 0 })
        return
      }
      this.apply({ viseme: s.seq[s.i++] as ActorFrame['viseme'], mouthOpen: 0 })
      s.left += s.per
    }
  }

  // ---------------------------------------------------------------- pose ---

  private intentGaze(): { x: number; y: number } {
    const bias = resolveEmotion(this.frame.emotion, this.opts.emotions).gaze
    const k = this.frame.intensity
    return {
      x: clamp1(this.frame.gaze.x + (bias?.x ?? 0) * k),
      y: clamp1(this.frame.gaze.y + (bias?.y ?? 0) * k),
    }
  }

  private basePose(t: MotionTarget): Pose {
    const parts: Pose[] = []
    const bucket = this.contrib.get(t)
    if (bucket) for (const [src, p] of bucket) if (src !== 'motion') parts.push(p)
    return composePoses(parts)
  }

  private runEngine(dt: number, snap: boolean): void {
    const out = this.engine.tick(dt, {
      frame: this.frame,
      gaze: this.intentGaze(),
      has: this.has,
      pose: (t) => this.basePose(t),
    }, snap)
    for (const bucket of this.contrib.values()) bucket.delete('motion')
    for (const t of Object.keys(out.poses) as MotionTarget[]) this.set(t, 'motion', out.poses[t]!)
    this.out = out
    if (out.blink && this.opts.blink && !this.reduced) this.blink()
  }

  /** Reduced motion and `finish()`: no micro-motion, no gestures, springs at rest. */
  private settle(): void {
    for (const bucket of this.contrib.values()) {
      bucket.delete('micro')
      bucket.delete('gesture')
      bucket.delete('mood')
      bucket.delete('locoFallback')
    }
    if (this.reduced) {
      this.gestures = []
      this.endGone('interrupted')
      this.shut = 0
      this.lid = 0
      this.saccade = { x: 0, y: 0 }
    }
    this.runEngine(0, true)
    this.flush()
  }

  /** Compose every target's sources and write them, then the face. */
  private flush(): void {
    const turn = this.turn
    const look = this.out?.look ?? { x: 0, y: 0 }
    const yaw = this.out?.yaw ?? { body: 0, head: 0 }
    const writePose = (node: THREE.Object3D, base: THREE.Vector3, p: Pose, rx = 0, ry = 0): void => {
      node.position.set(base.x + (p.x ?? 0), base.y - (p.y ?? 0), base.z)
      node.rotation.set(rx, ry + (p.rotY ?? 0) * D2R, -(p.rot ?? 0) * D2R, 'YXZ')
      const sx = p.sx ?? 1
      // Depth follows width: a squash that widens the body thickens it too,
      // which is what keeps the volume reading as constant from the side.
      node.scale.set(sx, p.sy ?? 1, sx)
    }
    for (const [t, joint] of this.built.joints) {
      const p = composePoses(this.contrib.get(t)?.values() ?? [])
      let rx = 0
      let ry = 0
      if (t === 'root') ry = yaw.body * turn.body * D2R
      if (t === 'head') {
        ry = ((yaw.head - yaw.body) * turn.body + look.x * turn.head) * D2R
        rx = look.y * turn.pitch * D2R
      }
      writePose(joint.node, joint.base, p, rx, ry)
    }
    const mood = this.built.mood
    writePose(mood.node, mood.base, composePoses(this.contrib.get('mood')?.values() ?? []))
    const shadow = this.built.shadow
    if (shadow) {
      const root = this.built.joints.get('root')!
      shadow.position.x = root.node.position.x
      // The shadow tightens as the body leaves the ground.
      const lift = Math.max(0, root.node.position.y - root.base.y)
      const k = Math.max(0.6, 1 - lift / 60)
      const r = this.spec.body3d?.shadow ?? 50
      shadow.scale.set(r * k, r * 0.45 * k, 1)
    }
    this.updateFace()
  }

  private updateFace(): void {
    const face = this.built.face
    if (!face) return
    const e = resolveEmotion(this.frame.emotion, this.opts.emotions)
    const k = Math.max(0, Math.min(1, this.frame.intensity))
    const squint = e.squint * k
    const s = eyeWidenScale(e.wide * k)
    const bias = e.gaze
    const gx = clamp1(this.frame.gaze.x + (bias?.x ?? 0) * this.frame.intensity + this.saccade.x)
    const gy = clamp1(this.frame.gaze.y + (bias?.y ?? 0) * this.frame.intensity + this.saccade.y)
    const open = 1 - this.lid * 0.92
    for (const eye of face.eyes) {
      eye.node.scale.set(s, s * (1 - 0.5 * squint) * open, s)
      eye.iris.position.x = gx * eye.travel
      eye.iris.position.y = -gy * eye.travel
    }
    const lines = BROW_LINES[e.brow]
    const raise = this.frame.browRaise * 5
    face.brows.forEach((b, i) => {
      const [l, r] = lines[i] ?? [0, 0]
      // y down in art space: world y is the negated mean, the slope its negated rise.
      b.mesh.position.set(0, -(l + r) / 2 + raise, 0)
      b.mesh.rotation.set(0, 0, Math.PI / 2 - Math.atan2(r - l, 2 * b.half))
    })
    const v = VISEMES[this.frame.viseme]
    const o = Math.max(v.o, this.frame.mouthOpen)
    const w = (v.w ?? 1) / (v.r ?? 1)
    const m = face.mouth
    if (m.beak) {
      // drawMouth's beak: `closed` shuts it, otherwise it opens 1.5 + 14·o.
      const open = v.closed ? 0 : 1.5 + o * 14
      m.smile.visible = m.press.visible = m.open.visible = m.tongue.visible = false
      // As the 2D lower lens, the corners stay and the bottom drops open / 2.
      const b = m.beak
      b.upper.scale.x = w
      b.lower.scale.set(w, 1 + open / (4 * b.half), 1)
      b.lower.position.y = b.rest - open / 4
      b.tongue.visible = !!v.tongue && o > 0.3
      b.tongue.position.y = -1 - open * 0.45
      b.tongue.scale.set(4 * w, Math.max(0.01, open * 0.28), 2)
      return
    }
    const closed = v.closed === true || o < 0.06
    m.smile.visible = closed && !v.closed
    m.press.visible = closed && !!v.closed
    m.smile.scale.x = m.press.scale.x = w
    m.open.visible = !closed
    if (!closed) {
      m.open.scale.set(m.half * w, 2 + o * 7, 1.2)
      m.tongue.visible = !!v.tongue && o > 0.3
      m.tongue.position.set(0, -0.4, 0.35)
      m.tongue.scale.set(0.5, 0.5, 0.6)
    }
  }

  /** Free the geometry and materials and detach the tree. */
  dispose(): void {
    this.gestures = []
    this.ends.clear()
    this.speech = null
    this.contrib.clear()
    this.built.dispose()
  }
}

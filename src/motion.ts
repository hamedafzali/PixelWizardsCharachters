/**
 * The motion engine — procedural secondary motion that every character shares.
 *
 * The rig already knows *where* each part should be: posture, gaits, gestures
 * and micro-motion all compose into one target pose per layer. What it lacked
 * was any notion of how a body *gets* there. Everything arrived on a curve
 * fixed in advance and stopped dead. This module adds the physics in between,
 * in four independent drivers:
 *
 *   1. **secondary** — soft parts (ears, tails, antennae) hang on springs and
 *      lag their parents, so a head turn or a stride makes them follow through
 *      and settle instead of moving rigidly with the skull;
 *   2. **attention** — the head turns toward where the eyes look, behind them,
 *      so the eyes lead and the head follows the way a real look does;
 *   3. **body** — lean into movement, an overshooting settle when stopping,
 *      a squash-and-stretch pop on an emotion change, a landing squash;
 *   4. **depth** — a 2.5D turn: layers slide by their depth as the character
 *      yaws, the face slides across the head, and the shading moves against it.
 *
 * ## Settings, not code
 *
 * The engine contains **no character-specific code**. Everything a character
 * does differently — which layers are soft, how stiff they are, how far the
 * head turns, how deep each layer sits — is a {@link MotionSettings} value,
 * merged from four places, later winning:
 *
 *     DEFAULT_MOTION  <  CharacterSpec.motion  <  RigOptions.motion  <  rig.setMotion()
 *
 * Any driver can be switched off with `false` at any of those levels, and a
 * single soft layer can be switched off the same way. A character file that
 * wants floppier ears says so in data; it never touches the engine.
 *
 * ## No DOM
 *
 * Like the interpolator, this module owns no timer and touches no element. The
 * rig hands it the composed poses each tick and writes back what it returns, so
 * every driver is testable with plain numbers.
 */

import type { ActorFrame, EmotionName, LayerName, Locomotion } from './types.js'
import type { Pose } from './timing.js'

// ------------------------------------------------------------------ springs ---

/**
 * A spring's character, in the two numbers an animator can reason about.
 *
 * `freq` is the natural frequency in Hz — how fast it gets there. `damping` is
 * the damping ratio: 1 arrives without overshoot, below 1 overshoots and
 * wobbles (0.3 is very floppy), above 1 is sluggish. Stiffness/mass/friction
 * would describe the same thing in units nobody tunes by eye.
 */
export interface SpringSpec {
  freq: number
  damping: number
}

/** Largest integration step, seconds. Keeps stiff springs stable at low fps. */
const REST = 1e-4
const MAX_H = 1 / 240

/**
 * One damped spring on one scalar.
 *
 * Integrated with semi-implicit Euler at a fixed maximum substep, so a 100ms
 * frame hitch is eight small steps rather than one large one — the large one
 * is what makes a stiff spring explode.
 */
export class Spring {
  value: number
  velocity = 0
  spec: SpringSpec

  constructor(spec: SpringSpec, value = 0) {
    this.spec = spec
    this.value = value
  }

  /** Advance `dt` seconds toward `target`; returns the new value. */
  step(target: number, dt: number): number {
    if (!(dt > 0) || !Number.isFinite(target)) return this.value
    const w = 2 * Math.PI * Math.max(0.01, this.spec.freq)
    const z = Math.max(0, this.spec.damping)
    const n = Math.max(1, Math.ceil(dt / MAX_H))
    const h = dt / n
    for (let i = 0; i < n; i++) {
      const a = -w * w * (this.value - target) - 2 * z * w * this.velocity
      this.velocity += a * h
      this.value += this.velocity * h
    }
    // An exponential decay never reaches zero; land exactly once it is far
    // below a visible pixel, so a settled rig writes the authored transforms
    // back verbatim instead of `translate(0.000 0)` forever.
    if (Math.abs(this.value - target) < REST && Math.abs(this.velocity) < REST * 10) this.snap(target)
    return this.value
  }

  /** Land on `v` with no velocity — scene cuts, reduced motion, scrubbing. */
  snap(v: number): void {
    this.value = v
    this.velocity = 0
  }

  /** Add an impulse, in value-units per second. */
  kick(v: number): void {
    this.velocity += v
  }

  /** At rest on `target`, within `eps`. */
  settled(target: number, eps = 1e-3): boolean {
    return Math.abs(this.value - target) < eps && Math.abs(this.velocity) < eps
  }
}

// ----------------------------------------------------------------- settings ---

/** One soft layer: how it hangs off its parent. */
export interface SecondaryLayerSettings {
  spring: SpringSpec
  /**
   * How much of the parent's rotation the layer resists, 0..1. 1 means a head
   * turn leaves the ear pointing where it was for an instant; 0 means it turns
   * rigidly with the head and only the other terms move it.
   */
  inertia: number
  /**
   * Degrees of swing per art unit of parent vertical travel. The sign picks the
   * direction, so a left and a right ear take opposite signs to both flop
   * outward on a bounce.
   */
  lift: number
  /** Degrees of swing per art unit of parent horizontal travel. */
  drag: number
  /** Cap on how far the lag may pull the layer off its pose, degrees. */
  limit: number
}

export interface SecondarySettings {
  /** The soft layers. A layer the character does not have is skipped. */
  layers: Partial<Record<LayerName, SecondaryLayerSettings | false>>
}

export interface AttentionSettings {
  /** head slide toward the look at gaze ±1, art units */
  turn: number
  /** head pitch at gaze ±1, degrees; looking up tips the face up */
  pitch: number
  /**
   * head rise at gaze ±1, art units (looking up lifts the chin). **0 by
   * default, and measured to be:** at 1.5 an upward look lifts تندپا's and
   * خرسی's heads below their seam floors and brings لاکی's open mouth within
   * 0.14 of the shell rim. Pitch alone reads as looking up without moving the
   * neck joint off the body. A character whose neck allows it opts in.
   */
  rise: number
  /** head cock toward a sideways look, degrees at gaze.x ±1 */
  tilt: number
  /** fraction of the head's turn the torso joins in on, 0..1 */
  torsoFollow: number
  /** how the head catches up with the eyes */
  spring: SpringSpec
  /**
   * A big gaze shift blinks, the way a real one tends to. Fires when the eyes
   * get this far (gaze units) ahead of the head. `false` disables it; it also
   * respects `RigOptions.blink`.
   */
  blink: { threshold: number; cooldown: number } | false
}

export interface BodySettings {
  /** forward lean at speed 1, degrees, per gait */
  lean: Partial<Record<Exclude<Locomotion, 'idle'>, number>>
  /** the lean's spring; underdamped, so stopping rocks back and settles */
  leanSpring: SpringSpec
  /** squash/stretch on an emotion change at intensity 1, as a scale delta */
  pop: number
  /** squash on landing from flight, as a scale delta */
  land: number
  /** the squash spring */
  popSpring: SpringSpec
  /**
   * Which way an emotion pops: + stretches up (energy), − squashes (deflation).
   * Unlisted emotions don't pop.
   */
  energy: Partial<Record<EmotionName, number>>
}

export interface DepthSettings {
  /** art units a layer at depth 1 slides at yaw ±1 */
  travel: number
  /**
   * Each layer's depth: + toward the viewer, − away, 0 on the body's plane. A
   * yaw slides near layers one way and far layers the other, which is what
   * reads as a turn. Absolute — the engine subtracts the parent's own depth.
   */
  layers: Partial<Record<LayerName, number>>
  /** the face's depth (eyes, brows, mouth); slides across the head on a turn */
  face: number
  /** fraction of `gaze.x` the head yaws toward on its own, on top of `yaw` */
  follow: number
  /** shading shift at yaw ±1, percent of the gradient box; 0 disables */
  shade: number
  spring: SpringSpec
}

/** The engine's full configuration. Any driver may be `false` (off). */
export interface MotionSettings {
  secondary: SecondarySettings | false
  attention: AttentionSettings | false
  body: BodySettings | false
  depth: DepthSettings | false
}

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

/**
 * A sparse override of {@link MotionSettings}: any field at any depth, or
 * `false` to switch a driver (or one soft layer, or the gaze blink) off.
 */
export type MotionOverrides = {
  [K in keyof MotionSettings]?: DeepPartial<Exclude<MotionSettings[K], false>> | false
}

const ear = (side: 1 | -1): SecondaryLayerSettings => ({
  spring: { freq: 3.2, damping: 0.42 },
  inertia: 0.85,
  lift: 1.6 * side,
  drag: 0.6 * side,
  limit: 28,
})

/**
 * The defaults every character starts from. Moderate on purpose: a character
 * with no `motion` block should look alive, not rubbery — floppier is a
 * per-character decision.
 */
export const DEFAULT_MOTION: MotionSettings = {
  secondary: {
    layers: {
      // `ears` posture is mirrored (earL −, earR +), and so is the flop.
      earL: ear(-1),
      earR: ear(1),
      tail: { spring: { freq: 2.2, damping: 0.35 }, inertia: 0.9, lift: 1.4, drag: -0.8, limit: 32 },
    },
  },
  attention: {
    turn: 3,
    pitch: 7,
    rise: 0,
    tilt: 2,
    torsoFollow: 0.2,
    spring: { freq: 2.4, damping: 0.85 },
    blink: { threshold: 0.65, cooldown: 1.2 },
  },
  body: {
    lean: { walk: 4, roll: 6, fly: 3 },
    leanSpring: { freq: 1.6, damping: 0.42 },
    pop: 0.06,
    land: 0.12,
    popSpring: { freq: 4.2, damping: 0.32 },
    energy: {
      happy: 0.6, excited: 1, surprised: 1, love: 0.5, proud: 0.4, encouraging: 0.4,
      sad: -0.7, sleepy: -0.4, shy: -0.4,
    },
  },
  depth: {
    travel: 5,
    layers: {
      accBack: -0.9, tail: -0.8, farArm: -0.6, farLeg: -0.5,
      torso: 0, torsoFront: 0.1,
      nearLeg: 0.5, nearArm: 0.6, head: 0.2,
      earL: 0, earR: 0, accFront: 0.9,
    },
    face: 0.8,
    follow: 0.35,
    shade: 10,
    spring: { freq: 2, damping: 0.9 },
  },
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Merge `over` onto `base`. `false` replaces; an object over a `false` (or a
 * missing value) is merged onto `fallback`, so re-enabling a driver that an
 * earlier level switched off starts from its defaults, not from nothing.
 */
function merge(base: unknown, over: unknown, fallback: unknown): unknown {
  if (over === undefined) return base
  if (over === false || !isObj(over)) return over
  const from = isObj(base) ? base : isObj(fallback) ? fallback : {}
  const out: Record<string, unknown> = { ...from }
  for (const k of Object.keys(over)) {
    const fb = isObj(fallback) ? fallback[k] : undefined
    out[k] = merge(from[k], over[k], fb)
  }
  return out
}

/**
 * Resolve the effective settings from any number of override levels, applied
 * in order onto {@link DEFAULT_MOTION}. Returns a fresh object; the inputs and
 * the defaults are never mutated.
 */
export function resolveMotion(...levels: (MotionOverrides | undefined)[]): MotionSettings {
  let out: unknown = structuredCloneish(DEFAULT_MOTION)
  for (const l of levels) if (l) out = merge(out, l, DEFAULT_MOTION)
  return out as MotionSettings
}

function structuredCloneish<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

// ------------------------------------------------------------------ engine ---

/** Where the engine can write: a layer or one of the two carriers it uses. */
export type MotionTarget = LayerName | 'root' | 'body'

/**
 * The structural parent of each target, as `buildLayers` nests them. This is
 * the tree itself — the same for every character — not anyone's tuning. Ears
 * hang off the head when there is one and off the torso when there is not.
 */
export function parentOf(t: MotionTarget, has: (l: LayerName) => boolean): MotionTarget | null {
  switch (t) {
    case 'root': return null
    case 'body': return 'root'
    case 'torso': case 'accBack': case 'accFront': return 'body'
    case 'earL': case 'earR': return has('head') ? 'head' : 'torso'
    case 'shadow': return null
    default: return 'torso'
  }
}

export interface MotionInput {
  frame: ActorFrame
  /**
   * Where the eyes are being *told* to look — frame gaze plus emotion bias,
   * without the idle saccade. The head follows intent, not jitter.
   */
  gaze: { x: number; y: number }
  has: (l: LayerName) => boolean
  /** each target's composed pose from every source except this engine */
  pose: (t: MotionTarget) => Pose
}

export interface MotionOutput {
  /** one contribution per target, to be composed under its own source */
  poses: Partial<Record<MotionTarget, Pose>>
  /** how far the face slides across its parent, art units */
  faceX: number
  /** the yaw the shading should show, -1..1 */
  shade: number
  /** a gaze-evoked blink is due */
  blink: boolean
  /**
   * Where the head is looking right now, each axis -1..1: the attention
   * springs' own state, before `turn`/`pitch` turn it into a 2D pose. A
   * renderer that can rotate a head for real (the three.js one) reads this
   * instead of the slide. 0 when attention is off.
   */
  look: { x: number; y: number }
  /** The depth springs' yaw, -1..1, for the body and for the head. 0 when depth is off. */
  yaw: { body: number; head: number }
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

/**
 * Runs the four drivers. One instance per rig.
 *
 * `tick(dt, input)` integrates; `tick(0, input, true)` — **snap** — puts every
 * spring on its target with no velocity and returns the at-rest result. The rig
 * snaps whenever motion must be deterministic or must not be seen moving:
 * reduced motion, no animation loop, a pinned gait phase, an active scrub.
 */
export class MotionEngine {
  private s: MotionSettings
  private soft = new Map<LayerName, Spring>()
  private headX: Spring
  private headY: Spring
  private lean: Spring
  private squash: Spring
  private yawBody: Spring
  private yawHead: Spring
  private prevEmotion: EmotionName | null = null
  private prevLoco: Locomotion | null = null
  private blinkCool = 0

  constructor(settings: MotionSettings) {
    this.s = settings
    const a = settings.attention || (DEFAULT_MOTION.attention as AttentionSettings)
    const b = settings.body || (DEFAULT_MOTION.body as BodySettings)
    const d = settings.depth || (DEFAULT_MOTION.depth as DepthSettings)
    this.headX = new Spring(a.spring)
    this.headY = new Spring(a.spring)
    this.lean = new Spring(b.leanSpring)
    this.squash = new Spring(b.popSpring)
    this.yawBody = new Spring(d.spring)
    this.yawHead = new Spring(d.spring)
  }

  get settings(): MotionSettings {
    return this.s
  }

  /** Swap settings live. Spring state carries over, so nothing jumps. */
  set settings(next: MotionSettings) {
    this.s = next
    if (next.attention) this.headX.spec = this.headY.spec = next.attention.spring
    if (next.body) {
      this.lean.spec = next.body.leanSpring
      this.squash.spec = next.body.popSpring
    }
    if (next.depth) this.yawBody.spec = this.yawHead.spec = next.depth.spring
    for (const [l, sp] of this.soft) {
      const cfg = this.softConfig(l)
      if (cfg) sp.spec = cfg.spring
      else this.soft.delete(l)
    }
  }

  /** The soft layers that are active for a character with these layers. */
  softLayers(has: (l: LayerName) => boolean): LayerName[] {
    const sec = this.s.secondary
    if (!sec) return []
    return (Object.keys(sec.layers) as LayerName[]).filter((l) => sec.layers[l] && has(l))
  }

  private softConfig(l: LayerName): SecondaryLayerSettings | null {
    const sec = this.s.secondary
    const c = sec ? sec.layers[l] : false
    return c || null
  }

  tick(dt: number, input: MotionInput, snap = false): MotionOutput {
    const out: MotionOutput = { poses: {}, faceX: 0, shade: 0, blink: false, look: { x: 0, y: 0 }, yaw: { body: 0, head: 0 } }
    const add = (t: MotionTarget, p: Pose): void => {
      const cur = out.poses[t] ?? {}
      out.poses[t] = {
        x: (cur.x ?? 0) + (p.x ?? 0),
        y: (cur.y ?? 0) + (p.y ?? 0),
        rot: (cur.rot ?? 0) + (p.rot ?? 0),
        sx: (cur.sx ?? 1) * (p.sx ?? 1),
        sy: (cur.sy ?? 1) * (p.sy ?? 1),
      }
    }
    const step = (sp: Spring, target: number): number => {
      if (snap) {
        sp.snap(target)
        return target
      }
      return sp.step(target, dt)
    }
    const f = input.frame
    this.blinkCool = Math.max(0, this.blinkCool - (snap ? 0 : dt))

    // --- attention -------------------------------------------------------
    const a = this.s.attention
    if (a) {
      const gx = step(this.headX, input.gaze.x)
      const gy = step(this.headY, input.gaze.y)
      out.look = { x: gx, y: gy }
      const head: Pose = { x: a.turn * gx, y: a.rise * gy, rot: a.pitch * gy + a.tilt * gx }
      if (input.has('head')) add('head', head)
      const k = a.torsoFollow
      if (k) add('torso', { x: (head.x ?? 0) * k, rot: (head.rot ?? 0) * k })
      if (!snap && a.blink && this.blinkCool === 0) {
        const lag = Math.hypot(input.gaze.x - gx, input.gaze.y - gy)
        if (lag > a.blink.threshold) {
          out.blink = true
          this.blinkCool = a.blink.cooldown
        }
      }
    }

    // --- body dynamics ---------------------------------------------------
    const b = this.s.body
    if (b) {
      const loco = f.locomotion
      const lean = loco === 'idle' ? 0 : (b.lean[loco] ?? 0) * Math.max(0.3, f.speed)
      const rot = step(this.lean, lean)
      // An emotion change or a landing *kicks* the squash spring rather than
      // targeting it: the target is always rest, so the pop is pure overshoot.
      if (this.prevEmotion !== null && f.emotion !== this.prevEmotion && !snap) {
        const e = b.energy[f.emotion] ?? 0
        this.squash.kick(e * b.pop * clamp(f.intensity, 0, 1) * 2 * Math.PI * this.squash.spec.freq)
      }
      if (this.prevLoco === 'fly' && loco !== 'fly' && !snap) {
        this.squash.kick(-b.land * 2 * Math.PI * this.squash.spec.freq)
      }
      const s = clamp(step(this.squash, 0), -0.4, 0.4)
      // Stretch up is thin, squash down is wide: area stays roughly constant,
      // which is what keeps it reading as the same body.
      add('body', { rot, sy: 1 + s, sx: 1 / (1 + s) })
    }
    this.prevEmotion = f.emotion
    this.prevLoco = f.locomotion

    // --- depth -----------------------------------------------------------
    const d = this.s.depth
    if (d) {
      const yaw = clamp(f.yaw ?? 0, -1, 1)
      const yb = step(this.yawBody, yaw)
      const yh = step(this.yawHead, clamp(yaw + d.follow * input.gaze.x, -1, 1))
      const headLike = (l: MotionTarget): boolean =>
        l === 'head' || ((l === 'earL' || l === 'earR') && input.has('head'))
      const depthOf = (t: MotionTarget | null): number =>
        t === null || t === 'root' || t === 'body' ? 0 : (d.layers[t as LayerName] ?? 0)
      for (const l of Object.keys(d.layers) as LayerName[]) {
        if (!input.has(l)) continue
        const rel = depthOf(l) - depthOf(parentOf(l, input.has))
        const x = (headLike(l) ? yh : yb) * rel * d.travel
        if (x) add(l, { x })
      }
      const faceParent: LayerName = input.has('head') ? 'head' : 'torso'
      out.faceX = (input.has('head') ? yh : yb) * (d.face - depthOf(faceParent)) * d.travel
      out.shade = yb
      out.yaw = { body: yb, head: yh }
    }

    // --- secondary -------------------------------------------------------
    // Last, because the soft layers lag everything above them — including the
    // head this engine just turned.
    const soft = this.softLayers(input.has)
    for (const l of soft) {
      const cfg = this.softConfig(l)!
      let rotP = 0
      let yP = 0
      let xP = 0
      for (let t = parentOf(l, input.has); t !== null; t = parentOf(t, input.has)) {
        const p = input.pose(t)
        const m = out.poses[t]
        rotP += (p.rot ?? 0) + (m?.rot ?? 0)
        yP += (p.y ?? 0) + (m?.y ?? 0)
        xP += (p.x ?? 0) + (m?.x ?? 0)
      }
      const own = input.pose(l).rot ?? 0
      // The spring lives in world space: it chases where the layer *would* be
      // if rigid, and the difference is the lag. At rest that difference is 0,
      // so the layer's authored pose is untouched.
      const anchor = cfg.inertia * rotP + cfg.lift * yP + cfg.drag * xP
      let sp = this.soft.get(l)
      if (!sp) {
        sp = new Spring(cfg.spring, anchor + own)
        this.soft.set(l, sp)
      }
      const w = step(sp, anchor + own)
      const lag = clamp(w - anchor - own, -cfg.limit, cfg.limit)
      if (lag) add(l, { rot: lag })
    }
    return out
  }
}

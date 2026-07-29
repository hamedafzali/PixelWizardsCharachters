import type { ActorFrame, EmotionName, VisemeName, Locomotion, Facing, Gesture } from './types.js'

/**
 * Frame interpolation — the easing layer between what an AI asks for and what
 * the rig performs.
 *
 * Frames used to be applied directly, so every change snapped. This smooths the
 * continuous channels while leaving the ones that *must* be instant alone: a
 * blended viseme is mush, and speech legibility dies with it.
 *
 * The unit of work is a **channel**, not an `ActorFrame` field, because the two
 * don't correspond. `gaze` is one field but two independent scalars; `emotion`
 * is discrete yet drives continuous output. Channels are flat and each carries
 * its own duration, delay and curve — which is how `browRaise` can lag behind
 * the emotion that triggered it.
 *
 * The module owns no timer. `tick(dt)` is driven by whoever owns the animation
 * loop, so this stays pure, testable and safe under SSR, and the rig runs one
 * loop rather than two.
 */

export type Easing = (t: number) => number

export type EasingName =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'easeOutQuint' | 'easeOutBack' | 'snap'

export const EASINGS: Record<EasingName, Easing> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  // Ballistic: almost all the distance covered early, then a long tail. The
  // shape of a saccade.
  easeOutQuint: (t) => 1 - Math.pow(1 - t, 5),
  // Slight overshoot before settling — organic for brows.
  easeOutBack: (t) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  snap: (t) => (t >= 1 ? 1 : 0),
}

/** Continuous channels — blended. */
export type NumericChannel =
  | 'intensity' | 'mouthOpen' | 'gazeX' | 'gazeY' | 'browRaise' | 'speed'

/** Discrete channels — held, then jumped. Never blended. */
export type DiscreteChannel =
  | 'emotion' | 'viseme' | 'facing' | 'locomotion' | 'character' | 'gesture'

export type ChannelName = NumericChannel | DiscreteChannel

export interface ChannelSpec {
  /** ms to travel from the current value to the target */
  duration: number
  /** ms to wait before starting — this is the lag */
  delay?: number
  easing?: EasingName | Easing
  /** below this delta, snap instead of animating (kills sub-pixel churn) */
  epsilon?: number
}

export type InterpolationProfile = Partial<Record<ChannelName, ChannelSpec>>

/**
 * Default timings. Tuned per channel rather than globally:
 *
 * - `viseme` snaps — speech must not blur.
 * - `gaze` is a fast ballistic saccade with a hair of reaction delay.
 * - `browRaise` deliberately trails the emotion that caused it by 90ms and
 *   overshoots slightly, which is what makes an expression land as a reaction
 *   rather than a state change.
 */
export const DEFAULT_PROFILE: Required<Record<ChannelName, ChannelSpec>> = {
  viseme: { duration: 0, delay: 0, easing: 'snap' },
  mouthOpen: { duration: 40, delay: 0, easing: 'easeOut' },
  gazeX: { duration: 90, delay: 18, easing: 'easeOutQuint' },
  gazeY: { duration: 90, delay: 18, easing: 'easeOutQuint' },
  emotion: { duration: 0, delay: 0, easing: 'snap' },
  intensity: { duration: 260, delay: 20, easing: 'easeInOut' },
  browRaise: { duration: 300, delay: 90, easing: 'easeOutBack' },
  speed: { duration: 400, delay: 0, easing: 'easeInOut' },
  facing: { duration: 0, delay: 0, easing: 'snap' },
  locomotion: { duration: 0, delay: 60, easing: 'snap' },
  gesture: { duration: 0, delay: 0, easing: 'snap' },
  character: { duration: 0, delay: 0, easing: 'snap' },
}

/** Valid ranges, enforced on the goal so interpolation can never leave them. */
const CLAMP: Partial<Record<NumericChannel, [number, number]>> = {
  intensity: [0, 1],
  mouthOpen: [0, 1],
  browRaise: [0, 1],
  gazeX: [-1, 1],
  gazeY: [-1, 1],
}

const NUMERIC: NumericChannel[] = ['intensity', 'mouthOpen', 'gazeX', 'gazeY', 'browRaise', 'speed']
const DISCRETE: DiscreteChannel[] = ['emotion', 'viseme', 'facing', 'locomotion', 'character', 'gesture']

const DEFAULT_EPSILON = 0.001

function clampChannel(c: NumericChannel, v: number): number {
  if (!Number.isFinite(v)) return 0
  const range = CLAMP[c]
  if (!range) return v
  return Math.min(range[1], Math.max(range[0], v))
}

function easingOf(spec: ChannelSpec): Easing {
  const e = spec.easing ?? 'linear'
  return typeof e === 'function' ? e : EASINGS[e]
}

interface NumericState {
  from: number
  to: number
  value: number
  /** ms since the last retarget, including the delay */
  elapsed: number
}

interface DiscreteState<T> {
  value: T
  to: T
  elapsed: number
}

/**
 * Holds a current frame and eases it toward a goal.
 *
 * **Retargeting**: when a new goal arrives mid-transition, each affected
 * channel restarts *from its current interpolated value*, not from the value it
 * originally started at. Without this an AI emitting 10fps of gaze updates
 * would rubber-band, every update yanking motion back toward a stale origin.
 */
export class FrameInterpolator {
  private profile: Required<Record<ChannelName, ChannelSpec>>
  private num = {} as Record<NumericChannel, NumericState>
  private dis = {} as Record<DiscreteChannel, DiscreteState<unknown>>

  constructor(initial: ActorFrame, profile?: InterpolationProfile) {
    this.profile = { ...DEFAULT_PROFILE }
    if (profile) {
      for (const k of Object.keys(profile) as ChannelName[]) {
        const s = profile[k]
        if (s) this.profile[k] = s
      }
    }
    for (const c of NUMERIC) {
      const v = clampChannel(c, readNumeric(initial, c))
      this.num[c] = { from: v, to: v, value: v, elapsed: Infinity }
    }
    for (const c of DISCRETE) {
      const v = readDiscrete(initial, c)
      this.dis[c] = { value: v, to: v, elapsed: Infinity }
    }
  }

  /**
   * Set the goal. Only channels present in `frame` are retargeted, and a
   * channel already aiming at the same value is left alone — so re-sending an
   * unchanged field does not re-arm its delay or restart its curve.
   */
  target(frame: Partial<ActorFrame>): void {
    for (const c of NUMERIC) {
      const raw = readPartialNumeric(frame, c)
      if (raw === undefined) continue
      const to = clampChannel(c, raw)
      const st = this.num[c]
      if (st.to === to) continue
      st.from = st.value
      st.to = to
      st.elapsed = 0
      const spec = this.profile[c]
      // Sub-epsilon moves are noise; land them now rather than animating.
      if (Math.abs(to - st.from) < (spec.epsilon ?? DEFAULT_EPSILON)) {
        st.value = to
        st.elapsed = Infinity
      }
    }
    for (const c of DISCRETE) {
      if (!(c in frame)) continue
      const to = readDiscrete(frame as ActorFrame, c)
      const st = this.dis[c]
      if (st.to === to) continue
      st.to = to
      st.elapsed = 0
      const spec = this.profile[c]
      // No hold time — land immediately so callers that never tick still work.
      if ((spec.delay ?? 0) + spec.duration <= 0) {
        st.value = to
        st.elapsed = Infinity
      }
    }
  }

  /** Advance by `dt` ms and return the frame for this instant. */
  tick(dtMs: number): ActorFrame {
    const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0
    for (const c of NUMERIC) {
      const st = this.num[c]
      if (st.elapsed === Infinity) continue
      st.elapsed += dt
      const spec = this.profile[c]
      const delay = spec.delay ?? 0
      if (st.elapsed < delay) continue
      const p = spec.duration > 0 ? Math.min((st.elapsed - delay) / spec.duration, 1) : 1
      st.value = st.from + (st.to - st.from) * easingOf(spec)(p)
      if (p >= 1) {
        st.value = st.to
        st.elapsed = Infinity
      }
    }
    for (const c of DISCRETE) {
      const st = this.dis[c]
      if (st.elapsed === Infinity) continue
      st.elapsed += dt
      const spec = this.profile[c]
      // Discrete channels hold the old value, then jump. They never blend.
      if (st.elapsed >= (spec.delay ?? 0) + spec.duration) {
        st.value = st.to
        st.elapsed = Infinity
      }
    }
    return this.current
  }

  /** True while any channel is still moving — lets the rig idle its loop. */
  get settling(): boolean {
    for (const c of NUMERIC) if (this.num[c].elapsed !== Infinity) return true
    for (const c of DISCRETE) if (this.dis[c].elapsed !== Infinity) return true
    return false
  }

  /** The resolved frame for right now, without advancing time. */
  get current(): ActorFrame {
    return {
      character: this.dis.character.value as string,
      emotion: this.dis.emotion.value as EmotionName,
      intensity: this.num.intensity.value,
      viseme: this.dis.viseme.value as VisemeName,
      mouthOpen: this.num.mouthOpen.value,
      gaze: { x: this.num.gazeX.value, y: this.num.gazeY.value },
      browRaise: this.num.browRaise.value,
      locomotion: this.dis.locomotion.value as Locomotion,
      speed: this.num.speed.value,
      facing: this.dis.facing.value as Facing,
      gesture: this.dis.gesture.value as Gesture | null,
    }
  }

  /** The goal as last requested — unsmoothed, already clamped. */
  get goal(): ActorFrame {
    return {
      character: this.dis.character.to as string,
      emotion: this.dis.emotion.to as EmotionName,
      intensity: this.num.intensity.to,
      viseme: this.dis.viseme.to as VisemeName,
      mouthOpen: this.num.mouthOpen.to,
      gaze: { x: this.num.gazeX.to, y: this.num.gazeY.to },
      browRaise: this.num.browRaise.to,
      locomotion: this.dis.locomotion.to as Locomotion,
      speed: this.num.speed.to,
      facing: this.dis.facing.to as Facing,
      gesture: this.dis.gesture.to as Gesture | null,
    }
  }

  /**
   * Jump every channel to its goal immediately. The escape hatch for
   * `prefers-reduced-motion`, scene cuts and deterministic tests.
   */
  finish(): void {
    for (const c of NUMERIC) {
      const st = this.num[c]
      st.value = st.from = st.to
      st.elapsed = Infinity
    }
    for (const c of DISCRETE) {
      const st = this.dis[c]
      st.value = st.to
      st.elapsed = Infinity
    }
  }
}

function readNumeric(f: ActorFrame, c: NumericChannel): number {
  switch (c) {
    case 'gazeX': return f.gaze.x
    case 'gazeY': return f.gaze.y
    default: return f[c]
  }
}

function readPartialNumeric(f: Partial<ActorFrame>, c: NumericChannel): number | undefined {
  if (c === 'gazeX' || c === 'gazeY') {
    if (!f.gaze) return undefined
    return c === 'gazeX' ? f.gaze.x : f.gaze.y
  }
  return f[c]
}

function readDiscrete(f: ActorFrame, c: DiscreteChannel): unknown {
  return f[c]
}

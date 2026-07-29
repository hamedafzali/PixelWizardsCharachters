import type { ActorFrame, EmotionName } from './types.js'
import type { Pose } from './timing.js'

/**
 * Idle micro-motion — the "never frozen" layer.
 *
 * Procedural, continuous, and layered *on top of* whatever the current
 * {@link ActorFrame} says. An AI never has to ask for breathing; a character
 * left alone mid-silence keeps living. Three independent sources:
 *
 *   **Breath**  — torso scale oscillation with a small counter-lift on the head.
 *                 Always on; rate comes from the emotion, not from `speed`.
 *   **Sway**    — a slow whole-body drift on an incommensurate period, so the
 *                 combined loop never visibly repeats.
 *   **Weight**  — occasional shifts from one hip to the other during `idle`,
 *                 with a counter-tilt in the head. This is what reads as
 *                 "standing there" rather than "paused".
 *
 * Pure apart from the shift scheduler's RNG: `tick` takes elapsed time and
 * returns contributions, so the rig owns the single animation loop.
 */

/** Breath period in seconds per emotion — excitement pants, sleep is slow. */
const BREATH_PERIOD: Record<EmotionName, number> = {
  neutral: 3.8, happy: 3.2, excited: 1.9, thinking: 4.2, encouraging: 3.0,
  sad: 5.2, surprised: 2.4, sleepy: 6.5, love: 3.4,
  confused: 3.6, proud: 3.0, shy: 4.6,
}

/** Blink behaviour per emotion. `dur` is how long the lid stays shut. */
export interface BlinkStyle {
  minGap: number
  maxGap: number
  dur: number
  /** chance of an immediate second blink */
  doubleChance: number
}

/**
 * Blink behaviour for every emotion.
 *
 * Deliberately **total**, not a sparse map over a default. It used to be sparse,
 * which meant an emotion added later inherited the neutral blink silently and
 * nobody found out — `surprised` sat on the default for its whole life while
 * being the one emotion that should blink fastest. A total record turns that
 * into a compile error, and a test asserts the record stays total.
 *
 * The two ends of the range are the ones that carry the read: `sleepy` has the
 * longest gaps and by far the heaviest lid, `surprised` the shortest gaps and
 * the lightest flick.
 */
const BLINK: Record<EmotionName, BlinkStyle> = {
  neutral: { minGap: 2.4, maxGap: 5.6, dur: 0.11, doubleChance: 0.15 },
  happy: { minGap: 2.2, maxGap: 5.0, dur: 0.10, doubleChance: 0.20 },
  excited: { minGap: 1.4, maxGap: 3.2, dur: 0.09, doubleChance: 0.25 },
  thinking: { minGap: 1.2, maxGap: 3.0, dur: 0.11, doubleChance: 0.35 },
  encouraging: { minGap: 2.0, maxGap: 4.6, dur: 0.10, doubleChance: 0.20 },
  sad: { minGap: 2.8, maxGap: 6.0, dur: 0.20, doubleChance: 0.10 },
  surprised: { minGap: 0.9, maxGap: 2.2, dur: 0.07, doubleChance: 0.40 },
  // Slow, heavy lids — sleepy used to be excluded from blinking entirely,
  // which read as a stare rather than as drowsiness.
  sleepy: { minGap: 2.2, maxGap: 4.0, dur: 0.42, doubleChance: 0.05 },
  love: { minGap: 2.0, maxGap: 4.4, dur: 0.14, doubleChance: 0.30 },
  confused: { minGap: 1.1, maxGap: 2.6, dur: 0.10, doubleChance: 0.40 },
  proud: { minGap: 2.6, maxGap: 5.4, dur: 0.12, doubleChance: 0.10 },
  // Flustered: frequent, and the most likely of any emotion to come in pairs.
  shy: { minGap: 1.6, maxGap: 3.6, dur: 0.16, doubleChance: 0.45 },
}

export function blinkStyle(emotion: EmotionName): BlinkStyle {
  return BLINK[emotion]
}

/** Exposed so the totality of the record can be asserted rather than assumed. */
export const BLINK_STYLES: Readonly<Record<EmotionName, BlinkStyle>> = BLINK

export interface MicroConfig {
  /** master scale, 0 disables everything */
  amount?: number
  /**
   * Saccade amplitude scale, 0 disables darting but keeps the body alive.
   * Separate from `amount` because a caller pinning the eyes for a test or a
   * gaze-tracking demo does not thereby want a frozen body.
   */
  saccade?: number
  /** fraction of `amount` retained while walking/flying, default 0.35 */
  movingAmount?: number
  random?: () => number
}

/** What one tick contributes, keyed by rig target. */
export interface MicroOutput {
  torso: Pose
  head: Pose
  /**
   * Idle saccade — a small gaze offset, each axis in art-space -1..1 units the
   * same way {@link ActorFrame.gaze} is, **added** to whatever the frame says.
   *
   * Eyes are never still. A gaze target held perfectly constant is the single
   * most corpse-like thing a face can do, and it is not something a driver
   * should have to remember to jitter — so it happens here, procedurally,
   * underneath whatever the frame asked for.
   */
  gaze: { x: number; y: number }
}

const TAU = Math.PI * 2
/** Smooth 0→1→0 hump used to ease a weight shift in and back out. */
const hump = (t: number): number => {
  const s = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
  return s
}

export class IdleMicroMotion {
  private t = 0
  private amount: number
  private movingAmount: number
  private saccadeAmount: number
  private rand: () => number
  /** where the eyes are now, where they are darting to, and the dart's progress */
  private gazeFrom = { x: 0, y: 0 }
  private gazeTo = { x: 0, y: 0 }
  private dartT = -1
  private dartDur = 0.05
  /** seconds of fixation left before the next dart */
  private dwell = 0.4
  /** seconds until the next weight shift begins */
  private nextShift: number
  private shiftT = -1
  private shiftDur = 1.1
  private shiftDir = 1

  constructor(cfg: MicroConfig = {}) {
    this.amount = cfg.amount ?? 1
    this.movingAmount = cfg.movingAmount ?? 0.35
    this.saccadeAmount = cfg.saccade ?? 1
    this.rand = cfg.random ?? Math.random
    this.nextShift = 2 + this.rand() * 4
  }

  /** Advance by `dt` seconds and return this instant's contributions. */
  tick(dt: number, frame: ActorFrame): MicroOutput {
    this.t += dt
    const idle = frame.locomotion === 'idle'
    const a = this.amount * (idle ? 1 : this.movingAmount)
    if (a <= 0) return { torso: {}, head: {}, gaze: { x: 0, y: 0 } }

    // --- breath -----------------------------------------------------------
    const period = BREATH_PERIOD[frame.emotion] ?? 3.8
    const b = Math.sin((this.t / period) * TAU)
    const torso: Pose = { sy: 1 + 0.014 * b * a, sx: 1 - 0.008 * b * a }
    const head: Pose = { y: -0.9 * b * a }

    // --- sway: incommensurate with the breath period, so the pair never
    //     lands back in phase and the idle loop stays unpredictable ---------
    const s = Math.sin((this.t / 5.3) * TAU)
    torso.rot = 0.6 * s * a
    head.rot = -0.4 * s * a

    // --- weight shift (idle only) ----------------------------------------
    if (idle) {
      if (this.shiftT >= 0) {
        this.shiftT += dt
        if (this.shiftT >= this.shiftDur) {
          this.shiftT = -1
          this.nextShift = 3.5 + this.rand() * 4.5
        } else {
          const k = hump(this.shiftT / this.shiftDur) * this.shiftDir * a
          torso.x = 2.2 * k
          torso.rot += 1.4 * k
          head.x = -0.8 * k
          head.rot -= 0.9 * k
        }
      } else {
        this.nextShift -= dt
        if (this.nextShift <= 0) {
          this.shiftT = 0
          this.shiftDur = 0.9 + this.rand() * 0.6
          this.shiftDir = this.rand() < 0.5 ? -1 : 1
        }
      }
    } else if (this.shiftT >= 0) {
      this.shiftT = -1
      this.nextShift = 3.5 + this.rand() * 4.5
    }

    return { torso, head, gaze: this.tickGaze(dt, a) }
  }

  /**
   * Saccades: fixate, then dart.
   *
   * Real eyes do not drift smoothly between points — they hold still and then
   * jump in ~50ms, which is why this is a short ramp between two fixation
   * points rather than a sine. Amplitude stays small (±0.16 of the eye's travel)
   * so it reads as aliveness rather than as the character looking at something
   * else; anything larger fights whatever gaze target the driver set.
   *
   * The dwell is drawn per fixation rather than fixed, so the eyes never fall
   * into a rhythm with the breath or the sway.
   */
  private tickGaze(dt: number, a: number): { x: number; y: number } {
    const k = this.saccadeAmount * a
    if (k <= 0) return { x: 0, y: 0 }
    if (this.dartT >= 0) {
      this.dartT += dt
      if (this.dartT >= this.dartDur) {
        this.dartT = -1
        this.gazeFrom = this.gazeTo
        this.dwell = 0.5 + this.rand() * 2.1
      }
    } else {
      this.dwell -= dt
      if (this.dwell <= 0) {
        this.dartT = 0
        this.dartDur = 0.035 + this.rand() * 0.035
        const ang = this.rand() * TAU
        // Biased horizontal: eyes range further side-to-side than up-and-down.
        const rad = 0.05 + this.rand() * 0.11
        this.gazeTo = { x: Math.cos(ang) * rad * 1.6, y: Math.sin(ang) * rad }
      }
    }
    const t = this.dartT >= 0 ? Math.min(1, this.dartT / this.dartDur) : 1
    // ease-out: a saccade decelerates into its target, it does not coast in.
    const e = 1 - (1 - t) * (1 - t)
    return {
      x: (this.gazeFrom.x + (this.gazeTo.x - this.gazeFrom.x) * e) * k,
      y: (this.gazeFrom.y + (this.gazeTo.y - this.gazeFrom.y) * e) * k,
    }
  }
}

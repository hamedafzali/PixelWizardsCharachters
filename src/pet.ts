import type { ActorFrame, CharacterSpec, EmotionName, Gesture } from './types.js'

/**
 * نوازش — being stroked, as a rig capability.
 *
 * A tap is a discrete event and needs no driver. Petting is not a tap: it is a
 * *sustained* input whose meaning is carried by where the hand is, how long it
 * stays and how much it has moved. That accumulation is state, and state that
 * outlives a single event belongs next to the other drivers
 * ({@link IdleMicroMotion}, {@link LocomotionDriver}) rather than in whichever
 * app mounted the character — otherwise every app re-derives "how petted is
 * this character right now", and they disagree.
 *
 * The driver owns three things and deliberately nothing else:
 *
 * 1. **Which zone the hand is in** — a head stroke and a tail grab are not the
 *    same gesture, and the geometry that tells them apart is per character.
 * 2. **How much affection has accumulated**, and its decay once the hand stops.
 * 3. **What that looks like** — an emotion, a gaze, and one-shot gestures.
 *
 * It does *not* own hit-testing against the DOM, pointer capture, sound, or
 * whether petting earns a star. Those are app policy and stay in the app.
 *
 * **Reduced motion.** This driver emits frames from JavaScript, so it is
 * suppressed by the `this.reduced` path, not by `RIG_CSS`'s stylesheet rule —
 * `animation:none!important` cannot stop a driver that never asked CSS for
 * anything. Under {@link PetConfig.reducedMotion} the emotion still changes,
 * because the character reacting to the child is the point of the feature and
 * a still face reads as broken rather than calm; what stops is the *motion*:
 * no gesture is ever emitted, and the intensity snaps to its target instead of
 * ramping. See CONTRIBUTING, "Reduced motion has two independent enforcement
 * paths".
 */

/** Where on the character a hand landed. */
export type PetZoneName = 'head' | 'back' | 'tail'

/** One pettable region: a name and a centre in the 200×200 art space. */
export interface PetZone {
  name: PetZoneName
  cx: number
  cy: number
}

/**
 * How far from a zone centre still counts as that zone, in art units.
 *
 * This is the one authored number here, and it is a design parameter rather
 * than a measurement — the zone *centres* are all read from the shipped spec
 * (see {@link petZones}), so they cannot drift out of sync with the drawing
 * the way a hand-copied coordinate would. 54 is a little over a quarter of the
 * 200-unit art box: generous enough for a four-year-old's aim.
 *
 * Zones *do* overlap at this radius — چرخی's head and back centres are only 44
 * units apart — which is why {@link zoneAt} resolves by nearest centre rather
 * than by first hit. Overlap is expected and handled; what would actually
 * break the feature is two centres collapsing onto each other, so
 * `pet.test.mjs` guards a minimum separation instead of a non-overlap that was
 * never true.
 */
export const PET_REACH = 54

/**
 * The pettable zones for one character, derived from its own shipped geometry.
 *
 * Every centre here is read from the spec rather than written down again:
 *
 * - **head** — the midpoint of `eyes`, which every character has and which is
 *   the actual face. The `head` *layer* origin is the neck pivot, several units
 *   below the face, so using it would put the head zone on the throat.
 * - **back** — the `torso` layer origin (the hip pivot).
 * - **tail** — the `tail` layer origin.
 *
 * A character with no `torso`/`tail` layer at all gets its head zone only —
 * بومی is the roster's example (a torso but no tail). That is the honest
 * answer: without a layer there is no measured hip or tail to point at, and
 * inventing one would be exactly the drift this derivation exists to avoid.
 * (سیمرغ used to be the example here; it is layer-rig converted as of
 * v1.3.0 and now exposes all three zones.)
 */
export function petZones(spec: CharacterSpec): PetZone[] {
  const zones: PetZone[] = [{
    name: 'head',
    cx: (spec.eyes.x[0] + spec.eyes.x[1]) / 2,
    cy: spec.eyes.y,
  }]
  const layers = spec.render({
    emotion: { squint: 0, wide: 0, mouth: 'soft', brow: 'idle' },
    intensity: 0,
  }).layers
  const torso = layers?.torso?.origin
  if (torso) zones.push({ name: 'back', cx: torso[0], cy: torso[1] })
  const tail = layers?.tail?.origin
  if (tail) zones.push({ name: 'tail', cx: tail[0], cy: tail[1] })
  return zones
}

/** The zone a point falls in, or `null` if it is not near any of them. */
export function zoneAt(spec: CharacterSpec, x: number, y: number): PetZoneName | null {
  let best: PetZoneName | null = null
  let bestD = PET_REACH
  for (const z of petZones(spec)) {
    const d = Math.hypot(x - z.cx, y - z.cy)
    if (d < bestD) { bestD = d; best = z.name }
  }
  return best
}

/**
 * What each zone means. Petting a head is affection; grabbing a tail is a
 * surprise that turns into a game. Keeping this a table rather than a branch is
 * what lets a character opt a zone out later without touching the driver.
 */
interface ZoneReaction {
  /** held while the hand is there and affection is past {@link ENGAGE} */
  emotion: EmotionName
  /** fired once, when affection first crosses {@link ENGAGE} */
  greet: Gesture
  /** fired once, when affection first crosses {@link DELIGHT} */
  delight: Gesture
  /** multiplies how fast affection accumulates in this zone */
  gain: number
}

const REACTIONS: Record<PetZoneName, ZoneReaction> = {
  head: { emotion: 'love', greet: 'nuzzle', delight: 'bounce', gain: 1 },
  back: { emotion: 'happy', greet: 'nuzzle', delight: 'bounce', gain: 0.8 },
  // A tail is the one zone where the first beat is not pleasure. `surprised`
  // resolves into `excited` at the delight threshold, so grabbing the tail
  // reads as "hey!" then "again!" — which is how a child plays with a pet.
  tail: { emotion: 'surprised', greet: 'jump', delight: 'spin', gain: 1.25 },
}

/** Affection at which the character acknowledges the hand at all. */
const ENGAGE = 0.18
/** Affection at which it stops being polite about it. */
const DELIGHT = 0.8

export interface PetConfig {
  /** art units of hand travel for a full 0→1 affection ramp (default 260) */
  travelForFull?: number
  /** affection lost per second once the hand stops (default 0.55) */
  decayPerSecond?: number
  /** suppress motion; see the class doc comment (default false) */
  reducedMotion?: boolean
}

export interface PetOutput {
  /** the zone under the hand, or the last one touched while affection remains */
  zone: PetZoneName | null
  /** 0..1 */
  affection: number
  /** null while affection is below {@link ENGAGE} — the app keeps its own emotion */
  emotion: EmotionName | null
  /** 0..1, scales with affection; snapped under reduced motion */
  intensity: number
  /** eyes toward the hand, each axis -1..1; `null` when no hand is down */
  gaze: { x: number; y: number } | null
  /** a one-shot to play this tick, or `null`. Always `null` under reduced motion. */
  gesture: Gesture | null
}

/**
 * Accumulates stroke input and turns it into performance.
 *
 * Usage mirrors {@link IdleMicroMotion}: construct once per mounted character,
 * feed it pointer movement with {@link stroke}, call {@link tick} every frame
 * with the elapsed time, and merge the result onto the frame you were going to
 * send anyway.
 *
 * ```ts
 * const pet = new PetDriver(CHARACTERS.roozi)
 * el.addEventListener('pointermove', (e) => {
 *   const p = toArtSpace(e)      // app's own hit-testing
 *   pet.stroke(p.x, p.y)
 * })
 * el.addEventListener('pointerleave', () => pet.release())
 * // per frame:
 * const out = pet.tick(dt, frame)
 * if (out.emotion) frame = { ...frame, emotion: out.emotion, intensity: out.intensity }
 * if (out.gaze) frame = { ...frame, gaze: out.gaze }
 * if (out.gesture) frame = { ...frame, gesture: out.gesture }
 * ```
 */
export class PetDriver {
  private readonly spec: CharacterSpec
  private readonly travel: number
  private readonly decay: number
  private readonly reduced: boolean

  private affection = 0
  private zone: PetZoneName | null = null
  private last: { x: number; y: number } | null = null
  private hand: { x: number; y: number } | null = null
  private greeted = false
  private delighted = false
  private pending: Gesture | null = null

  constructor(spec: CharacterSpec, cfg: PetConfig = {}) {
    this.spec = spec
    this.travel = cfg.travelForFull ?? 260
    this.decay = cfg.decayPerSecond ?? 0.55
    this.reduced = cfg.reducedMotion ?? false
  }

  /**
   * One sample of the hand, in the 200×200 art space.
   *
   * Affection accrues from *travel*, not from time held: a hand resting
   * motionless on a character is not stroking it, and rewarding the rest would
   * let a child leave a finger down and watch the character adore them
   * forever. The first sample of a new contact only sets the anchor.
   */
  stroke(x: number, y: number): void {
    const zone = zoneAt(this.spec, x, y)
    this.hand = { x, y }
    if (zone === null) { this.last = null; return }
    if (zone !== this.zone) {
      // A hand moving between zones restarts that zone's beats, so crossing
      // from back to head earns a fresh greeting rather than silence.
      this.zone = zone
      this.greeted = false
      this.delighted = false
      this.last = { x, y }
      return
    }
    if (this.last) {
      const moved = Math.hypot(x - this.last.x, y - this.last.y)
      // One stationary jitter should not register, and one flung swipe should
      // not fill the bar; both ends are clamped.
      const step = Math.min(moved, 24) * REACTIONS[zone].gain
      this.affection = Math.min(1, this.affection + step / this.travel)
    }
    this.last = { x, y }
  }

  /** The hand left. Affection stays and decays; the gaze stops tracking. */
  release(): void {
    this.last = null
    this.hand = null
  }

  /** Drop all accumulated affection immediately (e.g. on unmount or screen change). */
  reset(): void {
    this.affection = 0
    this.zone = null
    this.last = null
    this.hand = null
    this.greeted = false
    this.delighted = false
    this.pending = null
  }

  tick(dt: number, _frame?: ActorFrame): PetOutput {
    if (this.last === null && this.affection > 0) {
      this.affection = Math.max(0, this.affection - this.decay * dt)
      if (this.affection === 0) {
        this.zone = null
        this.greeted = false
        this.delighted = false
      }
    }

    const zone = this.zone
    const engaged = zone !== null && this.affection >= ENGAGE

    if (engaged && !this.reduced) {
      if (!this.greeted) { this.greeted = true; this.pending = REACTIONS[zone].greet }
      else if (this.affection >= DELIGHT && !this.delighted) {
        this.delighted = true
        this.pending = REACTIONS[zone].delight
      }
    }

    // `surprised` is a beat, not a mood: once the tail-grab has paid off it
    // becomes `excited`, so the character does not spend the whole interaction
    // looking alarmed.
    let emotion: EmotionName | null = null
    if (engaged && zone) {
      emotion = REACTIONS[zone].emotion
      if (zone === 'tail' && this.affection >= DELIGHT) emotion = 'excited'
    }

    // One enforcement point, deliberately. An earlier draft also nulled the
    // gesture on the way out, which read as defence-in-depth but was dead code:
    // under reduced motion `pending` is never set, so the second guard could
    // not fire and no test could tell whether it worked. Mutation-verifying it
    // is what surfaced that — see CONTRIBUTING, "Mutation-verify new guards".
    // Suppressing at the setter is also the correct place: it keeps a stale
    // gesture from being banked while reduced and replayed later.
    const gesture = this.pending
    this.pending = null

    return {
      zone,
      affection: this.affection,
      emotion,
      // Reduced motion keeps the expression but drops the ramp: the face
      // arrives at its reaction instead of easing into it.
      intensity: !engaged ? 0
        : this.reduced ? 1
        : Math.min(1, 0.45 + this.affection * 0.55),
      gaze: this.hand
        ? {
            x: clamp((this.hand.x - 100) / PET_REACH),
            y: clamp((this.hand.y - 100) / PET_REACH),
          }
        : null,
      gesture,
    }
  }
}

const clamp = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v)

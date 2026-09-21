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
export const PET_REACH = 54;
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
 * A character with no layers at all (سیمرغ, still unconverted) gets its head
 * zone only. That is the honest answer: without layers there is no measured
 * hip or tail to point at, and inventing one would be exactly the drift this
 * derivation exists to avoid.
 */
export function petZones(spec) {
    const zones = [{
            name: 'head',
            cx: (spec.eyes.x[0] + spec.eyes.x[1]) / 2,
            cy: spec.eyes.y,
        }];
    const layers = spec.render({
        emotion: { squint: 0, wide: 0, mouth: 'soft', brow: 'idle' },
        intensity: 0,
    }).layers;
    const torso = layers?.torso?.origin;
    if (torso)
        zones.push({ name: 'back', cx: torso[0], cy: torso[1] });
    const tail = layers?.tail?.origin;
    if (tail)
        zones.push({ name: 'tail', cx: tail[0], cy: tail[1] });
    return zones;
}
/** The zone a point falls in, or `null` if it is not near any of them. */
export function zoneAt(spec, x, y) {
    let best = null;
    let bestD = PET_REACH;
    for (const z of petZones(spec)) {
        const d = Math.hypot(x - z.cx, y - z.cy);
        if (d < bestD) {
            bestD = d;
            best = z.name;
        }
    }
    return best;
}
const REACTIONS = {
    head: { emotion: 'love', greet: 'nuzzle', delight: 'bounce', gain: 1 },
    back: { emotion: 'happy', greet: 'nuzzle', delight: 'bounce', gain: 0.8 },
    // A tail is the one zone where the first beat is not pleasure. `surprised`
    // resolves into `excited` at the delight threshold, so grabbing the tail
    // reads as "hey!" then "again!" — which is how a child plays with a pet.
    tail: { emotion: 'surprised', greet: 'jump', delight: 'spin', gain: 1.25 },
};
/** Affection at which the character acknowledges the hand at all. */
const ENGAGE = 0.18;
/** Affection at which it stops being polite about it. */
const DELIGHT = 0.8;
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
    constructor(spec, cfg = {}) {
        this.affection = 0;
        this.zone = null;
        this.last = null;
        this.hand = null;
        this.greeted = false;
        this.delighted = false;
        this.pending = null;
        this.spec = spec;
        this.travel = cfg.travelForFull ?? 260;
        this.decay = cfg.decayPerSecond ?? 0.55;
        this.reduced = cfg.reducedMotion ?? false;
    }
    /**
     * One sample of the hand, in the 200×200 art space.
     *
     * Affection accrues from *travel*, not from time held: a hand resting
     * motionless on a character is not stroking it, and rewarding the rest would
     * let a child leave a finger down and watch the character adore them
     * forever. The first sample of a new contact only sets the anchor.
     */
    stroke(x, y) {
        const zone = zoneAt(this.spec, x, y);
        this.hand = { x, y };
        if (zone === null) {
            this.last = null;
            return;
        }
        if (zone !== this.zone) {
            // A hand moving between zones restarts that zone's beats, so crossing
            // from back to head earns a fresh greeting rather than silence.
            this.zone = zone;
            this.greeted = false;
            this.delighted = false;
            this.last = { x, y };
            return;
        }
        if (this.last) {
            const moved = Math.hypot(x - this.last.x, y - this.last.y);
            // One stationary jitter should not register, and one flung swipe should
            // not fill the bar; both ends are clamped.
            const step = Math.min(moved, 24) * REACTIONS[zone].gain;
            this.affection = Math.min(1, this.affection + step / this.travel);
        }
        this.last = { x, y };
    }
    /** The hand left. Affection stays and decays; the gaze stops tracking. */
    release() {
        this.last = null;
        this.hand = null;
    }
    /** Drop all accumulated affection immediately (e.g. on unmount or screen change). */
    reset() {
        this.affection = 0;
        this.zone = null;
        this.last = null;
        this.hand = null;
        this.greeted = false;
        this.delighted = false;
        this.pending = null;
    }
    tick(dt, _frame) {
        if (this.last === null && this.affection > 0) {
            this.affection = Math.max(0, this.affection - this.decay * dt);
            if (this.affection === 0) {
                this.zone = null;
                this.greeted = false;
                this.delighted = false;
            }
        }
        const zone = this.zone;
        const engaged = zone !== null && this.affection >= ENGAGE;
        if (engaged && !this.reduced) {
            if (!this.greeted) {
                this.greeted = true;
                this.pending = REACTIONS[zone].greet;
            }
            else if (this.affection >= DELIGHT && !this.delighted) {
                this.delighted = true;
                this.pending = REACTIONS[zone].delight;
            }
        }
        // `surprised` is a beat, not a mood: once the tail-grab has paid off it
        // becomes `excited`, so the character does not spend the whole interaction
        // looking alarmed.
        let emotion = null;
        if (engaged && zone) {
            emotion = REACTIONS[zone].emotion;
            if (zone === 'tail' && this.affection >= DELIGHT)
                emotion = 'excited';
        }
        // One enforcement point, deliberately. An earlier draft also nulled the
        // gesture on the way out, which read as defence-in-depth but was dead code:
        // under reduced motion `pending` is never set, so the second guard could
        // not fire and no test could tell whether it worked. Mutation-verifying it
        // is what surfaced that — see CONTRIBUTING, "Mutation-verify new guards".
        // Suppressing at the setter is also the correct place: it keeps a stale
        // gesture from being banked while reduced and replayed later.
        const gesture = this.pending;
        this.pending = null;
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
        };
    }
}
const clamp = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
//# sourceMappingURL=pet.js.map
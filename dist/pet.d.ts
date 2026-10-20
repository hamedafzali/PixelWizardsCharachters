import type { ActorFrame, CharacterSpec, EmotionName, Gesture } from './types.js';
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
export type PetZoneName = 'head' | 'back' | 'tail';
/** One pettable region: a name and a centre in the 200×200 art space. */
export interface PetZone {
    name: PetZoneName;
    cx: number;
    cy: number;
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
export declare const PET_REACH = 54;
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
export declare function petZones(spec: CharacterSpec): PetZone[];
/** The zone a point falls in, or `null` if it is not near any of them. */
export declare function zoneAt(spec: CharacterSpec, x: number, y: number): PetZoneName | null;
export interface PetConfig {
    /** art units of hand travel for a full 0→1 affection ramp (default 260) */
    travelForFull?: number;
    /** affection lost per second once the hand stops (default 0.55) */
    decayPerSecond?: number;
    /** suppress motion; see the class doc comment (default false) */
    reducedMotion?: boolean;
}
export interface PetOutput {
    /** the zone under the hand, or the last one touched while affection remains */
    zone: PetZoneName | null;
    /** 0..1 */
    affection: number;
    /** null while affection is below {@link ENGAGE} — the app keeps its own emotion */
    emotion: EmotionName | null;
    /** 0..1, scales with affection; snapped under reduced motion */
    intensity: number;
    /** eyes toward the hand, each axis -1..1; `null` when no hand is down */
    gaze: {
        x: number;
        y: number;
    } | null;
    /** a one-shot to play this tick, or `null`. Always `null` under reduced motion. */
    gesture: Gesture | null;
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
 *   // app's own hit-testing, into the 200×200 art space; mirror x when the
 *   // character faces left (the art flips, the zones do not)
 *   const [x, y] = toArtSpace(e, frame.facing)
 *   pet.stroke(x, y)
 * })
 * el.addEventListener('pointerleave', () => pet.release())
 * // per frame:
 * const out = pet.tick(dt)
 * if (out.emotion) frame = { ...frame, emotion: out.emotion, intensity: out.intensity }
 * if (out.gaze) frame = { ...frame, gaze: out.gaze }
 * rig.apply(frame)
 * if (out.gesture) rig.playGesture(out.gesture) // one-shot; not kept in `frame`
 * ```
 */
export declare class PetDriver {
    private readonly spec;
    private readonly travel;
    private readonly decay;
    private readonly reduced;
    private affection;
    private zone;
    private last;
    private hand;
    private greeted;
    private delighted;
    private pending;
    constructor(spec: CharacterSpec, cfg?: PetConfig);
    /**
     * One sample of the hand, in the 200×200 art space.
     *
     * Affection accrues from *travel*, not from time held: a hand resting
     * motionless on a character is not stroking it, and rewarding the rest would
     * let a child leave a finger down and watch the character adore them
     * forever. The first sample of a new contact only sets the anchor.
     */
    stroke(x: number, y: number): void;
    /** The hand left. Affection stays and decays; the gaze stops tracking. */
    release(): void;
    /** Drop all accumulated affection immediately (e.g. on unmount or screen change). */
    reset(): void;
    tick(dt: number, _frame?: ActorFrame): PetOutput;
}
//# sourceMappingURL=pet.d.ts.map
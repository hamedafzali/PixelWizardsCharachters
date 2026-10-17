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
import type { ActorFrame, EmotionName, LayerName, Locomotion } from './types.js';
import type { Pose } from './timing.js';
/**
 * A spring's character, in the two numbers an animator can reason about.
 *
 * `freq` is the natural frequency in Hz — how fast it gets there. `damping` is
 * the damping ratio: 1 arrives without overshoot, below 1 overshoots and
 * wobbles (0.3 is very floppy), above 1 is sluggish. Stiffness/mass/friction
 * would describe the same thing in units nobody tunes by eye.
 */
export interface SpringSpec {
    freq: number;
    damping: number;
}
/**
 * One damped spring on one scalar.
 *
 * Integrated with semi-implicit Euler at a fixed maximum substep, so a 100ms
 * frame hitch is eight small steps rather than one large one — the large one
 * is what makes a stiff spring explode.
 */
export declare class Spring {
    value: number;
    velocity: number;
    spec: SpringSpec;
    constructor(spec: SpringSpec, value?: number);
    /** Advance `dt` seconds toward `target`; returns the new value. */
    step(target: number, dt: number): number;
    /** Land on `v` with no velocity — scene cuts, reduced motion, scrubbing. */
    snap(v: number): void;
    /** Add an impulse, in value-units per second. */
    kick(v: number): void;
    /** At rest on `target`, within `eps`. */
    settled(target: number, eps?: number): boolean;
}
/** One soft layer: how it hangs off its parent. */
export interface SecondaryLayerSettings {
    spring: SpringSpec;
    /**
     * How much of the parent's rotation the layer resists, 0..1. 1 means a head
     * turn leaves the ear pointing where it was for an instant; 0 means it turns
     * rigidly with the head and only the other terms move it.
     */
    inertia: number;
    /**
     * Degrees of swing per art unit of parent vertical travel. The sign picks the
     * direction, so a left and a right ear take opposite signs to both flop
     * outward on a bounce.
     */
    lift: number;
    /** Degrees of swing per art unit of parent horizontal travel. */
    drag: number;
    /** Cap on how far the lag may pull the layer off its pose, degrees. */
    limit: number;
}
export interface SecondarySettings {
    /** The soft layers. A layer the character does not have is skipped. */
    layers: Partial<Record<LayerName, SecondaryLayerSettings | false>>;
}
export interface AttentionSettings {
    /** head slide toward the look at gaze ±1, art units */
    turn: number;
    /** head pitch at gaze ±1, degrees; looking up tips the face up */
    pitch: number;
    /**
     * head rise at gaze ±1, art units (looking up lifts the chin). **0 by
     * default, and measured to be:** at 1.5 an upward look lifts تندپا's and
     * خرسی's heads below their seam floors and brings لاکی's open mouth within
     * 0.14 of the shell rim. Pitch alone reads as looking up without moving the
     * neck joint off the body. A character whose neck allows it opts in.
     */
    rise: number;
    /** head cock toward a sideways look, degrees at gaze.x ±1 */
    tilt: number;
    /** fraction of the head's turn the torso joins in on, 0..1 */
    torsoFollow: number;
    /** how the head catches up with the eyes */
    spring: SpringSpec;
    /**
     * A big gaze shift blinks, the way a real one tends to. Fires when the eyes
     * get this far (gaze units) ahead of the head. `false` disables it; it also
     * respects `RigOptions.blink`.
     */
    blink: {
        threshold: number;
        cooldown: number;
    } | false;
}
export interface BodySettings {
    /** forward lean at speed 1, degrees, per gait */
    lean: Partial<Record<Exclude<Locomotion, 'idle'>, number>>;
    /** the lean's spring; underdamped, so stopping rocks back and settles */
    leanSpring: SpringSpec;
    /** squash/stretch on an emotion change at intensity 1, as a scale delta */
    pop: number;
    /** squash on landing from flight, as a scale delta */
    land: number;
    /** the squash spring */
    popSpring: SpringSpec;
    /**
     * Which way an emotion pops: + stretches up (energy), − squashes (deflation).
     * Unlisted emotions don't pop.
     */
    energy: Partial<Record<EmotionName, number>>;
}
export interface DepthSettings {
    /** art units a layer at depth 1 slides at yaw ±1 */
    travel: number;
    /**
     * Each layer's depth: + toward the viewer, − away, 0 on the body's plane. A
     * yaw slides near layers one way and far layers the other, which is what
     * reads as a turn. Absolute — the engine subtracts the parent's own depth.
     */
    layers: Partial<Record<LayerName, number>>;
    /** the face's depth (eyes, brows, mouth); slides across the head on a turn */
    face: number;
    /** fraction of `gaze.x` the head yaws toward on its own, on top of `yaw` */
    follow: number;
    /** shading shift at yaw ±1, percent of the gradient box; 0 disables */
    shade: number;
    spring: SpringSpec;
}
/** The engine's full configuration. Any driver may be `false` (off). */
export interface MotionSettings {
    secondary: SecondarySettings | false;
    attention: AttentionSettings | false;
    body: BodySettings | false;
    depth: DepthSettings | false;
}
type DeepPartial<T> = T extends object ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : T;
/**
 * A sparse override of {@link MotionSettings}: any field at any depth, or
 * `false` to switch a driver (or one soft layer, or the gaze blink) off.
 */
export type MotionOverrides = {
    [K in keyof MotionSettings]?: DeepPartial<Exclude<MotionSettings[K], false>> | false;
};
/**
 * The defaults every character starts from. Moderate on purpose: a character
 * with no `motion` block should look alive, not rubbery — floppier is a
 * per-character decision.
 */
export declare const DEFAULT_MOTION: MotionSettings;
/**
 * Resolve the effective settings from any number of override levels, applied
 * in order onto {@link DEFAULT_MOTION}. Returns a fresh object; the inputs and
 * the defaults are never mutated.
 */
export declare function resolveMotion(...levels: (MotionOverrides | undefined)[]): MotionSettings;
/** Where the engine can write: a layer or one of the two carriers it uses. */
export type MotionTarget = LayerName | 'root' | 'body';
/**
 * The structural parent of each target, as `buildLayers` nests them. This is
 * the tree itself — the same for every character — not anyone's tuning. Ears
 * hang off the head when there is one and off the torso when there is not.
 */
export declare function parentOf(t: MotionTarget, has: (l: LayerName) => boolean): MotionTarget | null;
export interface MotionInput {
    frame: ActorFrame;
    /**
     * Where the eyes are being *told* to look — frame gaze plus emotion bias,
     * without the idle saccade. The head follows intent, not jitter.
     */
    gaze: {
        x: number;
        y: number;
    };
    has: (l: LayerName) => boolean;
    /** each target's composed pose from every source except this engine */
    pose: (t: MotionTarget) => Pose;
}
export interface MotionOutput {
    /** one contribution per target, to be composed under its own source */
    poses: Partial<Record<MotionTarget, Pose>>;
    /** how far the face slides across its parent, art units */
    faceX: number;
    /** the yaw the shading should show, -1..1 */
    shade: number;
    /** a gaze-evoked blink is due */
    blink: boolean;
}
/**
 * Runs the four drivers. One instance per rig.
 *
 * `tick(dt, input)` integrates; `tick(0, input, true)` — **snap** — puts every
 * spring on its target with no velocity and returns the at-rest result. The rig
 * snaps whenever motion must be deterministic or must not be seen moving:
 * reduced motion, no animation loop, a pinned gait phase, an active scrub.
 */
export declare class MotionEngine {
    private s;
    private soft;
    private headX;
    private headY;
    private lean;
    private squash;
    private yawBody;
    private yawHead;
    private prevEmotion;
    private prevLoco;
    private blinkCool;
    constructor(settings: MotionSettings);
    get settings(): MotionSettings;
    /** Swap settings live. Spring state carries over, so nothing jumps. */
    set settings(next: MotionSettings);
    /** The soft layers that are active for a character with these layers. */
    softLayers(has: (l: LayerName) => boolean): LayerName[];
    private softConfig;
    tick(dt: number, input: MotionInput, snap?: boolean): MotionOutput;
}
export {};
//# sourceMappingURL=motion.d.ts.map
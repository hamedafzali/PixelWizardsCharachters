import type { Pose } from './timing.js';
/**
 * Phase-driven locomotion.
 *
 * A gait is a **phase table**: one cycle, 0..1, with a keyed pose per driven
 * layer. The rig's existing tick loop advances the phase and samples every
 * track, and the result goes through `setContribution` like any other pose
 * source — so locomotion *composes* with posture and gesture instead of
 * overwriting them.
 *
 * This replaces four CSS `@keyframes` rules per gait. The CSS could not do it:
 * a running animation outranks an inline transform, so the moment a character
 * walked, posture stopped reaching the limbs entirely (sad arms sprang back to
 * neutral mid-stride). It also could not share a clock — the limb cycle and the
 * body bob were separate animations that drifted apart, so the feet stopped
 * landing on the bob.
 *
 * Characters that have no limb layers keep the old CSS path; see
 * {@link canDrive}.
 */
export type GaitName = 'walk' | 'fly' | 'roll';
/** Layers a gait may drive. A subset of the rig's transform targets. */
export type LocoTarget = 'root' | 'torso' | 'farArm' | 'nearArm' | 'farLeg' | 'nearLeg';
/** `LocoTarget`'s own members, as a value — for iterating every possible target rather than hand-listing them again. */
export declare const LOCO_TARGETS: readonly LocoTarget[];
/** One keyed pose in a cycle. `at` is a phase in [0, 1). */
export interface PhaseKey {
    at: number;
    pose: Pose;
}
/** One gait's phase tables: which layers it needs, and the keyed pose per layer it drives. */
export interface Gait {
    /** cycles per second at `speed: 1` */
    rate: number;
    /**
     * Layers without which this gait cannot be phase-driven at all. A character
     * missing any of them falls back to the CSS body animation — the roster is
     * mid-conversion and a walk still has to read.
     */
    requires: readonly LocoTarget[];
    tracks: Partial<Record<LocoTarget, readonly PhaseKey[]>>;
}
/**
 * The named points of a walk cycle, as the choreography spec calls them.
 *
 * One cycle is a full stride — two steps — so each name occurs twice, half a
 * cycle apart: the second occurrence is the same event on the other leg. Tests
 * and future gaits reference these rather than magic numbers.
 */
export declare const WALK_PHASES: {
    /** heel down, leg reaching forward */
    readonly contact: 0;
    /** weight accepted, leg loading */
    readonly down: 0.125;
    /** leg vertical under the body, other leg swinging past */
    readonly pass: 0.25;
    /** toe off, leg extended behind */
    readonly up: 0.375;
};
/** The named points of one wingbeat. */
export declare const FLY_PHASES: {
    /** top of the stroke, wing raised */
    readonly top: 0;
    /** bottom of the power stroke */
    readonly bottom: 0.4;
    /** mid-recovery, wing folded in to cut drag */
    readonly fold: 0.7;
};
/** How far the wing folds in on the recovery stroke. */
export declare const WING_FOLD_SX = 0.82;
/**
 * The named points of one roll bounce.
 *
 * This is **not** spinning wheels — چرخی's wheels are static art baked into
 * its `torso` layer (see `charkhi` in `characters/index.ts`), not their own
 * rig layer, so there is nothing here for a rotating-wheel track to drive.
 * Giving it one would mean splitting the wheels out into real layers and
 * re-deriving the paint order that currently sits `torso`'s highlight/shadow
 * gradients over them — a real, separate piece of work, not a locomotion
 * table. See `CHANGELOG.md` for this gait's entry and the deferral.
 *
 * What this drives instead is the chassis: a body that bobs on its
 * suspension as it rolls, the same `root`/`torso` transform-only mechanism
 * `walk`/`fly` already use for the body-mechanic half of their gaits, just
 * bouncier and faster — چرخی fronts loading/progress screens, where a snappy
 * cadence reads as "still working" better than a plodding one would.
 */
export declare const ROLL_PHASES: {
    /** suspension loaded, chassis settled and tipped slightly back */
    readonly compress: 0;
    /** suspension kicks the body up, nosing slightly forward */
    readonly rebound: 0.5;
};
/** The built-in gaits, one `Gait` per `GaitName`. */
export declare const GAITS: Record<GaitName, Gait>;
/**
 * Sample a track at `phase`, wrapping from the last key back to the first.
 *
 * Wraparound is the whole reason this is not a plain lerp: the segment from the
 * last key to the end of the cycle is continuous with the segment starting at
 * key 0, so a two-key table at 0 and 0.5 is a smooth triangle, not a sawtooth
 * that snaps at 1.0.
 */
export declare function samplePhase(keys: readonly PhaseKey[], phase: number): Pose;
/**
 * Fold any real number into [0, 1).
 *
 * `%` alone is not enough: it keeps the sign, so a negative phase (a rewound
 * timeline, a clock that jumped backwards) would index off the front of the
 * table. Non-finite input collapses to 0 rather than poisoning every transform
 * on the character for the rest of the session.
 */
export declare function wrapPhase(phase: number): number;
/**
 * Does the character have the layers this gait needs?
 *
 * Purely structural — it asks what exists, never what is intended. Use
 * {@link drivesGait} to decide whether to actually drive a character.
 */
export declare function canDrive(gait: GaitName, has: (t: LocoTarget) => boolean): boolean;
/**
 * Should this character be phase-driven through this gait?
 *
 * Structural capability **and** declared eligibility. The two are separate
 * because geometry cannot tell a wing from a flipper: لاکی's back flippers map
 * onto the arm slots — correctly, that is what its walk swings — which makes it
 * structurally able to fly. It is not eligible, so it never does.
 *
 * `declared` omitted or empty means no gait is driven and everything takes the
 * CSS fallback, so a character opts in once rather than inheriting a gait by
 * growing a layer.
 */
export declare function drivesGait(gait: GaitName, has: (t: LocoTarget) => boolean, declared: readonly GaitName[] | undefined): boolean;
/**
 * Holds the cycle phase across ticks and turns it into per-layer poses.
 *
 * Stateful on purpose: the phase must survive speed changes (a character
 * speeding up mid-stride keeps its footing rather than snapping to the top of
 * the cycle) but reset on a *gait* change, so a wingbeat always starts at the
 * top of the stroke.
 */
export declare class LocomotionDriver {
    phase: number;
    gait: GaitName | null;
    /**
     * Advance the cycle. `dt` is seconds; `gait` null means idle, which parks the
     * phase at 0 so the next departure starts cleanly.
     */
    advance(dt: number, gait: GaitName | null, speed: number): void;
    /** The pose this target should contribute right now — identity when idle. */
    pose(target: LocoTarget): Pose;
}
/**
 * The rig's `caWalk`/`caFly` CSS body animations, as data instead of CSS text.
 *
 * Used where the CSS animation cannot be: the SVG rig's reduced-motion
 * `pinGaitPhase` branch, and the three.js renderer, which has no stylesheet.
 * In the SVG rig's case: the
 * usual hold pauses the real animation, but under reduced motion the
 * stylesheet's `animation:none!important` cannot tell a paused animation from
 * a running one and kills the hold along with it (see `RIG_CSS`'s `.ca-reduced`
 * rule). Sampling this table with `samplePhase` and writing the pose directly
 * is the one path that rule cannot veto.
 *
 * Read off the `@keyframes` percentages directly: `caWalk`'s `rotate` is only
 * ever authored at 0%/50%/100%, so its value at 25%/75% here is what CSS's
 * missing-property interpolation would already produce there. `samplePhase`
 * eases each segment with a smoothstep rather than `caWalk`'s own `linear`
 * timing function, so this is the intent of the fallback body-mechanic, not a
 * pixel-identical replay of it — the same honest limitation `sampleAction`
 * already documents for gestures.
 */
export declare const LOCO_FALLBACK_POSES: Record<'walk' | 'fly', readonly PhaseKey[]>;
/** One cycle of each fallback body animation, seconds at `speed: 1` — the `caWalk`/`caFly` durations. */
export declare const LOCO_FALLBACK_DUR: Record<'walk' | 'fly', number>;
//# sourceMappingURL=locomotion.d.ts.map
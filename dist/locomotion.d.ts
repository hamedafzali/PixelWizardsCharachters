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
export type GaitName = 'walk' | 'fly';
/** Layers a gait may drive. A subset of the rig's transform targets. */
export type LocoTarget = 'root' | 'torso' | 'farArm' | 'nearArm' | 'farLeg' | 'nearLeg';
export declare const LOCO_TARGETS: readonly LocoTarget[];
/** One keyed pose in a cycle. `at` is a phase in [0, 1). */
export interface PhaseKey {
    at: number;
    pose: Pose;
}
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
//# sourceMappingURL=locomotion.d.ts.map
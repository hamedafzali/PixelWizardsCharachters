import type { ActorFrame } from './types.js';
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
export type Easing = (t: number) => number;
export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'easeOutQuint' | 'easeOutBack' | 'snap';
export declare const EASINGS: Record<EasingName, Easing>;
/** Continuous channels — blended. */
export type NumericChannel = 'intensity' | 'mouthOpen' | 'gazeX' | 'gazeY' | 'browRaise' | 'speed';
/** Discrete channels — held, then jumped. Never blended. */
export type DiscreteChannel = 'emotion' | 'viseme' | 'facing' | 'locomotion' | 'character' | 'gesture';
export type ChannelName = NumericChannel | DiscreteChannel;
export interface ChannelSpec {
    /** ms to travel from the current value to the target */
    duration: number;
    /** ms to wait before starting — this is the lag */
    delay?: number;
    easing?: EasingName | Easing;
    /** below this delta, snap instead of animating (kills sub-pixel churn) */
    epsilon?: number;
}
export type InterpolationProfile = Partial<Record<ChannelName, ChannelSpec>>;
/**
 * Default timings. Tuned per channel rather than globally:
 *
 * - `viseme` snaps — speech must not blur.
 * - `gaze` is a fast ballistic saccade with a hair of reaction delay.
 * - `browRaise` deliberately trails the emotion that caused it by 90ms and
 *   overshoots slightly, which is what makes an expression land as a reaction
 *   rather than a state change.
 */
export declare const DEFAULT_PROFILE: Required<Record<ChannelName, ChannelSpec>>;
/**
 * Holds a current frame and eases it toward a goal.
 *
 * **Retargeting**: when a new goal arrives mid-transition, each affected
 * channel restarts *from its current interpolated value*, not from the value it
 * originally started at. Without this an AI emitting 10fps of gaze updates
 * would rubber-band, every update yanking motion back toward a stale origin.
 */
export declare class FrameInterpolator {
    private profile;
    private num;
    private dis;
    constructor(initial: ActorFrame, profile?: InterpolationProfile);
    /**
     * Set the goal. Only channels present in `frame` are retargeted, and a
     * channel already aiming at the same value is left alone — so re-sending an
     * unchanged field does not re-arm its delay or restart its curve.
     */
    target(frame: Partial<ActorFrame>): void;
    /** Advance by `dt` ms and return the frame for this instant. */
    tick(dtMs: number): ActorFrame;
    /** True while any channel is still moving — lets the rig idle its loop. */
    get settling(): boolean;
    /** The resolved frame for right now, without advancing time. */
    get current(): ActorFrame;
    /** The goal as last requested — unsmoothed, already clamped. */
    get goal(): ActorFrame;
    /**
     * Jump every channel to its goal immediately. The escape hatch for
     * `prefers-reduced-motion`, scene cuts and deterministic tests.
     */
    finish(): void;
}
//# sourceMappingURL=interpolate.d.ts.map
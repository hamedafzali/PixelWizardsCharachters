import type { ActorFrame, EmotionName } from './types.js';
import type { Pose } from './timing.js';
/** Blink behaviour per emotion. `dur` is how long the lid stays shut. */
export interface BlinkStyle {
    minGap: number;
    maxGap: number;
    dur: number;
    /** chance of an immediate second blink */
    doubleChance: number;
}
export declare function blinkStyle(emotion: EmotionName): BlinkStyle;
/** Exposed so the totality of the record can be asserted rather than assumed. */
export declare const BLINK_STYLES: Readonly<Record<EmotionName, BlinkStyle>>;
export interface MicroConfig {
    /** master scale, 0 disables everything */
    amount?: number;
    /**
     * Saccade amplitude scale, 0 disables darting but keeps the body alive.
     * Separate from `amount` because a caller pinning the eyes for a test or a
     * gaze-tracking demo does not thereby want a frozen body.
     */
    saccade?: number;
    /** fraction of `amount` retained while walking/flying, default 0.35 */
    movingAmount?: number;
    random?: () => number;
}
/** What one tick contributes, keyed by rig target. */
export interface MicroOutput {
    torso: Pose;
    head: Pose;
    /**
     * Idle saccade — a small gaze offset, each axis in art-space -1..1 units the
     * same way {@link ActorFrame.gaze} is, **added** to whatever the frame says.
     *
     * Eyes are never still. A gaze target held perfectly constant is the single
     * most corpse-like thing a face can do, and it is not something a driver
     * should have to remember to jitter — so it happens here, procedurally,
     * underneath whatever the frame asked for.
     */
    gaze: {
        x: number;
        y: number;
    };
}
export declare class IdleMicroMotion {
    private t;
    private amount;
    private movingAmount;
    private saccadeAmount;
    private rand;
    /** where the eyes are now, where they are darting to, and the dart's progress */
    private gazeFrom;
    private gazeTo;
    private dartT;
    private dartDur;
    /** seconds of fixation left before the next dart */
    private dwell;
    /** seconds until the next weight shift begins */
    private nextShift;
    private shiftT;
    private shiftDur;
    private shiftDir;
    constructor(cfg?: MicroConfig);
    /** Advance by `dt` seconds and return this instant's contributions. */
    tick(dt: number, frame: ActorFrame): MicroOutput;
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
    private tickGaze;
}
//# sourceMappingURL=micro.d.ts.map
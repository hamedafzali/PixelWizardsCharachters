/**
 * Timing & spacing — the animation-principles layer.
 *
 * Every action the rig plays is described as a list of key {@link Pose}s. This
 * module compiles that into a CSS `@keyframes` rule and, in the process, adds
 * the two principles a raw pose list is missing:
 *
 *   1. **Anticipation** — a brief counter-move + load-up squash before the
 *      action, derived from the action's own peak pose (lean back before you
 *      lunge, crouch before you jump).
 *   2. **Squash & stretch on the settle** — an impact squash, a rebound
 *      stretch, a diminishing counter, then rest.
 *
 * Both are *derived*, not authored, so a new gesture gets them for free: it
 * only declares what it does, never how it loads up or lands.
 */
/** One key pose. All channels optional; omitted channels are identity. */
export interface Pose {
    /** translate X, art units */
    x?: number;
    /** translate Y, art units (negative = up) */
    y?: number;
    /** in-plane rotation, degrees */
    rot?: number;
    /** out-of-plane spin, degrees (a `rotateY` flip) */
    rotY?: number;
    /** horizontal scale, 1 = identity */
    sx?: number;
    /** vertical scale, 1 = identity */
    sy?: number;
}
/** An action described as key poses plus how hard to load up and land. */
export interface TimedAction {
    /** total duration in seconds, including anticipation and settle */
    dur: number;
    /** the action's key poses, spread evenly across the action window */
    poses: Pose[];
    /** anticipation strength 0..1 (0 disables it), default 0.8 */
    anticipation?: number;
    /** settle/overshoot strength 0..1 (0 disables it), default 0.8 */
    settle?: number;
    /** fraction of `dur` spent anticipating, default 0.18 */
    antTime?: number;
    /** fraction of `dur` spent settling, default 0.26 */
    settleTime?: number;
    /** CSS timing function for the whole rule, default `ease-in-out` */
    ease?: string;
}
/** Serialise a pose to a CSS `transform` value. */
export declare function poseToTransform(p: Pose): string;
/**
 * Combine contributions from independent sources onto one element: offsets and
 * angles add, scales multiply. Without this, posture and idle breathing both
 * want `lyr-torso`'s `transform` and the last writer silently wins.
 */
export declare function composePoses(poses: Iterable<Pose>): Pose;
/**
 * Compile a {@link TimedAction} into a `@keyframes` rule body plus the
 * `animation` shorthand that plays it once.
 */
export declare function buildAction(name: string, a: TimedAction): {
    css: string;
    animation: string;
};
export declare function ensureAction(doc: Document, name: string, a: TimedAction): string;
//# sourceMappingURL=timing.d.ts.map
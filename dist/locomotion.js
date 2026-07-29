export const LOCO_TARGETS = ['root', 'torso', 'farArm', 'nearArm', 'farLeg', 'nearLeg'];
const IDENTITY = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 };
/**
 * The named points of a walk cycle, as the choreography spec calls them.
 *
 * One cycle is a full stride — two steps — so each name occurs twice, half a
 * cycle apart: the second occurrence is the same event on the other leg. Tests
 * and future gaits reference these rather than magic numbers.
 */
export const WALK_PHASES = {
    /** heel down, leg reaching forward */
    contact: 0,
    /** weight accepted, leg loading */
    down: 0.125,
    /** leg vertical under the body, other leg swinging past */
    pass: 0.25,
    /** toe off, leg extended behind */
    up: 0.375,
};
/** The named points of one wingbeat. */
export const FLY_PHASES = {
    /** top of the stroke, wing raised */
    top: 0,
    /** bottom of the power stroke */
    bottom: 0.4,
    /** mid-recovery, wing folded in to cut drag */
    fold: 0.7,
};
/** How far the wing folds in on the recovery stroke. */
export const WING_FOLD_SX = 0.82;
export const GAITS = {
    /**
     * Bipedal walk, contralateral: the near arm swings opposite the near leg.
     *
     * One cycle is a full stride (two steps), which is why the body bob has two
     * peaks — it rises at each pass and sits lowest at each contact, so the feet
     * land on the low point rather than floating through it.
     *
     * `farLeg` is `nearLeg` offset by exactly half a cycle. It is written out
     * rather than derived so the table stays readable as a table.
     */
    walk: {
        rate: 2,
        requires: ['farLeg', 'nearLeg'],
        tracks: {
            nearLeg: [
                { at: 0, pose: { rot: 20 } }, // contact
                { at: 0.125, pose: { rot: 12 } }, // down
                { at: 0.25, pose: { rot: 0 } }, // pass
                { at: 0.375, pose: { rot: -12 } }, // up
                { at: 0.5, pose: { rot: -20 } }, // contact, other foot
                { at: 0.625, pose: { rot: -12 } },
                { at: 0.75, pose: { rot: 0 } },
                { at: 0.875, pose: { rot: 12 } },
            ],
            farLeg: [
                { at: 0, pose: { rot: -20 } },
                { at: 0.125, pose: { rot: -12 } },
                { at: 0.25, pose: { rot: 0 } },
                { at: 0.375, pose: { rot: 12 } },
                { at: 0.5, pose: { rot: 20 } },
                { at: 0.625, pose: { rot: 12 } },
                { at: 0.75, pose: { rot: 0 } },
                { at: 0.875, pose: { rot: -12 } },
            ],
            nearArm: [
                { at: 0, pose: { rot: -14 } },
                { at: 0.125, pose: { rot: -8 } },
                { at: 0.25, pose: { rot: 0 } },
                { at: 0.375, pose: { rot: 8 } },
                { at: 0.5, pose: { rot: 14 } },
                { at: 0.625, pose: { rot: 8 } },
                { at: 0.75, pose: { rot: 0 } },
                { at: 0.875, pose: { rot: -8 } },
            ],
            farArm: [
                { at: 0, pose: { rot: 14 } },
                { at: 0.125, pose: { rot: 8 } },
                { at: 0.25, pose: { rot: 0 } },
                { at: 0.375, pose: { rot: -8 } },
                { at: 0.5, pose: { rot: -14 } },
                { at: 0.625, pose: { rot: -8 } },
                { at: 0.75, pose: { rot: 0 } },
                { at: 0.875, pose: { rot: 8 } },
            ],
            // Two rises per stride, one per step. Negative y is up.
            root: [
                { at: 0, pose: { y: 0, rot: -2 } },
                { at: 0.125, pose: { y: -2, rot: -1 } },
                { at: 0.25, pose: { y: -4, rot: 0 } },
                { at: 0.375, pose: { y: -2, rot: 1 } },
                { at: 0.5, pose: { y: 0, rot: 2 } },
                { at: 0.625, pose: { y: -2, rot: 1 } },
                { at: 0.75, pose: { y: -4, rot: 0 } },
                { at: 0.875, pose: { y: -2, rot: -1 } },
            ],
        },
    },
    /**
     * Wingbeat. The keys are deliberately *unevenly* spaced: the downstroke is
     * the power stroke and takes the first 40% of the cycle, the recovery the
     * remaining 60%. Evenly spaced keys give a metronome flap that reads as
     * mechanical.
     *
     * The wing also **folds** on the way back up — `sx` narrows to
     * {@link WING_FOLD_SX} at mid-recovery and is back to 1 by the top. A wing
     * that returns at full span pushes the bird back down and the beat reads as
     * rowing. It is flat at 1 across the whole downstroke, because that is the
     * stroke that has to have area.
     */
    fly: {
        rate: 2.5,
        requires: ['farArm', 'nearArm'],
        tracks: {
            farArm: [
                { at: 0, pose: { rot: -26, sx: 1 } }, // top
                { at: 0.4, pose: { rot: 16, sx: 1 } }, // bottom
                { at: 0.7, pose: { rot: -6, sx: WING_FOLD_SX } }, // fold
            ],
            nearArm: [
                { at: 0, pose: { rot: 26, sx: 1 } },
                { at: 0.4, pose: { rot: -16, sx: 1 } },
                { at: 0.7, pose: { rot: 6, sx: WING_FOLD_SX } },
            ],
            // Lift trails the downstroke: the body rises as the wings push, and sinks
            // back through the recovery.
            root: [
                { at: 0, pose: { y: 2 } },
                { at: 0.4, pose: { y: -4 } },
                { at: 0.7, pose: { y: -1 } },
            ],
            torso: [
                { at: 0, pose: { rot: 1.5 } },
                { at: 0.4, pose: { rot: -1.5 } },
                { at: 0.7, pose: { rot: 0 } },
            ],
        },
    },
};
/** Smoothstep — the ease-in-out the old `@keyframes` had, kept so gaits read the same. */
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
/**
 * Sample a track at `phase`, wrapping from the last key back to the first.
 *
 * Wraparound is the whole reason this is not a plain lerp: the segment from the
 * last key to the end of the cycle is continuous with the segment starting at
 * key 0, so a two-key table at 0 and 0.5 is a smooth triangle, not a sawtooth
 * that snaps at 1.0.
 */
export function samplePhase(keys, phase) {
    const first = keys[0];
    if (!first)
        return { ...IDENTITY };
    if (keys.length === 1)
        return { ...IDENTITY, ...first.pose };
    const p = wrapPhase(phase);
    let i = keys.length - 1;
    for (let k = 0; k < keys.length; k++) {
        const key = keys[k];
        if (key && key.at <= p)
            i = k;
    }
    // The key after the last one is the first key, one cycle later.
    const next = (i + 1) % keys.length;
    const a = keys[i] ?? first;
    const b = keys[next] ?? first;
    const span = (next === 0 ? b.at + 1 : b.at) - a.at;
    const t = span <= 0 ? 0 : smooth((p - a.at) / span);
    return {
        x: lerp(a.pose.x ?? 0, b.pose.x ?? 0, t),
        y: lerp(a.pose.y ?? 0, b.pose.y ?? 0, t),
        rot: lerp(a.pose.rot ?? 0, b.pose.rot ?? 0, t),
        sx: lerp(a.pose.sx ?? 1, b.pose.sx ?? 1, t),
        sy: lerp(a.pose.sy ?? 1, b.pose.sy ?? 1, t),
    };
}
/**
 * Fold any real number into [0, 1).
 *
 * `%` alone is not enough: it keeps the sign, so a negative phase (a rewound
 * timeline, a clock that jumped backwards) would index off the front of the
 * table. Non-finite input collapses to 0 rather than poisoning every transform
 * on the character for the rest of the session.
 */
export function wrapPhase(phase) {
    if (!Number.isFinite(phase))
        return 0;
    const p = phase % 1;
    return p < 0 ? p + 1 : p;
}
/**
 * Does the character have the layers this gait needs?
 *
 * Purely structural — it asks what exists, never what is intended. Use
 * {@link drivesGait} to decide whether to actually drive a character.
 */
export function canDrive(gait, has) {
    return GAITS[gait].requires.every(has);
}
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
export function drivesGait(gait, has, declared) {
    return !!declared?.includes(gait) && canDrive(gait, has);
}
/**
 * Holds the cycle phase across ticks and turns it into per-layer poses.
 *
 * Stateful on purpose: the phase must survive speed changes (a character
 * speeding up mid-stride keeps its footing rather than snapping to the top of
 * the cycle) but reset on a *gait* change, so a wingbeat always starts at the
 * top of the stroke.
 */
export class LocomotionDriver {
    constructor() {
        this.phase = 0;
        this.gait = null;
    }
    /**
     * Advance the cycle. `dt` is seconds; `gait` null means idle, which parks the
     * phase at 0 so the next departure starts cleanly.
     */
    advance(dt, gait, speed) {
        if (gait !== this.gait) {
            this.gait = gait;
            this.phase = 0;
            return;
        }
        if (gait === null)
            return;
        if (!Number.isFinite(dt) || dt <= 0)
            return;
        const rate = GAITS[gait].rate * Math.max(0, speed);
        this.phase = wrapPhase(this.phase + dt * rate);
    }
    /** The pose this target should contribute right now — identity when idle. */
    pose(target) {
        if (this.gait === null)
            return { ...IDENTITY };
        const keys = GAITS[this.gait].tracks[target];
        if (!keys)
            return { ...IDENTITY };
        return samplePhase(keys, this.phase);
    }
}
//# sourceMappingURL=locomotion.js.map
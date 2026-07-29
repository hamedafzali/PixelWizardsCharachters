import { GAITS } from './locomotion.js';
const ALL_LOCO = ['idle', 'walk', 'fly'];
const GROUNDED = ['idle', 'walk'];
/** Mirror an arm action onto the opposite arm: same motion, opposite sign. */
const mirrorRot = (a) => ({
    ...a,
    poses: a.poses.map((p) => (p.rot === undefined ? p : { ...p, rot: -p.rot })),
});
const armWave = {
    dur: 0.95,
    poses: [{ rot: -58 }, { rot: -30 }, { rot: -62 }, { rot: -34 }, { rot: 0 }],
    anticipation: 0.55, settle: 0.3, antTime: 0.14, settleTime: 0.16,
};
// A clap swings both arms in to meet at the centre line, twice.
const armClap = {
    dur: 0.85,
    poses: [{ rot: 40 }, { rot: 18 }, { rot: 40 }, { rot: 18 }, { rot: 0 }],
    anticipation: 0.5, settle: 0.35, antTime: 0.13, settleTime: 0.2,
};
// A shrug lifts both arms outward and holds before dropping them. The repeated
// near-identical poses are the hold: `buildAction` spreads poses evenly, so a
// beat that should last is written as a beat that repeats.
const armShrug = {
    dur: 0.9,
    poses: [{ rot: -26 }, { rot: -30 }, { rot: -29 }, { rot: 0 }],
    anticipation: 0.45, settle: 0.4, antTime: 0.16, settleTime: 0.24,
};
export const GESTURES = {
    jump: {
        parts: [{
                layer: 'rig-body',
                action: { dur: 0.9, poses: [{ y: -26, sx: 0.95, sy: 1.08 }, { y: -21, sx: 0.98, sy: 1.03 }, { y: 0 }] },
            }],
        // You cannot jump off the air. Nothing about the geometry says so, which is
        // exactly why this is authored rather than derived.
        during: GROUNDED,
    },
    spin: {
        parts: [{
                layer: 'rig-body',
                action: { dur: 0.95, poses: [{ rotY: 180 }, { rotY: 360 }], settleTime: 0.2 },
            }],
        during: ALL_LOCO,
    },
    wave: {
        parts: [{ layer: 'lyr-nearArm', action: armWave }],
        fallback: {
            layer: 'rig-body',
            action: { dur: 0.85, poses: [{ rot: -8 }, { rot: 8 }, { rot: -6 }, { rot: 0 }], settle: 0.5 },
        },
        during: ALL_LOCO,
    },
    // ── head gestures ─────────────────────────────────────────────────────────
    //
    // `anticipation` is dialled down on both of these and the counter-move is
    // written as the first pose instead. The derived anticipation always loads
    // *downward* — correct for a jump, which crouches before it leaves the
    // ground, but wrong for a nod, whose peak is itself downward and which should
    // lift first. Rather than re-tune a shipped, tested curve for two new
    // gestures, the lead-in is authored here. See the port report.
    nod: {
        parts: [{
                layer: 'lyr-head',
                action: {
                    dur: 0.8,
                    poses: [{ y: -2.5 }, { y: 6.5 }, { y: -1 }, { y: 5 }, { y: 0 }],
                    anticipation: 0.25, settle: 0.35, antTime: 0.12, settleTime: 0.18,
                },
            }],
        fallback: {
            layer: 'rig-body',
            action: {
                dur: 0.8,
                poses: [{ y: -1.5 }, { y: 4 }, { y: -0.6 }, { y: 3 }, { y: 0 }],
                anticipation: 0.25, settle: 0.4, antTime: 0.12, settleTime: 0.2,
            },
        },
        during: ALL_LOCO,
    },
    shake: {
        parts: [{
                layer: 'lyr-head',
                action: {
                    dur: 0.75,
                    // The counter-rotation is what stops this reading as the whole head
                    // sliding sideways: a real "no" pivots as it travels.
                    poses: [{ x: -4, rot: -2.5 }, { x: 4, rot: 2.5 }, { x: -3.4, rot: -2 }, { x: 3, rot: 1.8 }, { x: 0, rot: 0 }],
                    anticipation: 0.3, settle: 0.3, antTime: 0.12, settleTime: 0.18,
                },
            }],
        fallback: {
            layer: 'rig-body',
            action: {
                dur: 0.75,
                poses: [{ x: -2.6, rot: -1.6 }, { x: 2.6, rot: 1.6 }, { x: -2, rot: -1.2 }, { x: 0, rot: 0 }],
                anticipation: 0.3, settle: 0.4, antTime: 0.12, settleTime: 0.2,
            },
        },
        during: ALL_LOCO,
    },
    // ── two-armed gestures ────────────────────────────────────────────────────
    shrug: {
        parts: [
            { layer: 'lyr-farArm', action: armShrug },
            { layer: 'lyr-nearArm', action: mirrorRot(armShrug) },
        ],
        fallback: {
            layer: 'rig-body',
            action: {
                dur: 0.9,
                poses: [{ y: -4, sy: 0.97, sx: 1.03 }, { y: -4.5, sy: 0.97, sx: 1.03 }, { y: 0 }],
                anticipation: 0.45, settle: 0.5,
            },
        },
        during: ALL_LOCO,
    },
    clap: {
        parts: [
            { layer: 'lyr-farArm', action: armClap },
            { layer: 'lyr-nearArm', action: mirrorRot(armClap) },
        ],
        fallback: {
            layer: 'rig-body',
            action: {
                dur: 0.85,
                poses: [{ sx: 0.94, sy: 1.04 }, { sx: 1.03, sy: 0.98 }, { sx: 0.95, sy: 1.03 }, { sx: 1 }],
                anticipation: 0.4, settle: 0.5,
            },
        },
        during: GROUNDED,
    },
    point: {
        parts: [{
                layer: 'lyr-nearArm',
                action: {
                    // Out and held, rather than a beat: a point is a *held* pose, which is
                    // why the middle two keys barely differ.
                    dur: 1.05,
                    poses: [{ rot: -84 }, { rot: -88 }, { rot: -86 }, { rot: 0 }],
                    anticipation: 0.5, settle: 0.35, antTime: 0.14, settleTime: 0.22,
                },
            }],
        fallback: {
            layer: 'rig-body',
            action: {
                dur: 1.0,
                poses: [{ x: 5, rot: 4 }, { x: 6, rot: 5 }, { x: 5.5, rot: 4.5 }, { x: 0, rot: 0 }],
                anticipation: 0.5, settle: 0.4,
            },
        },
        during: ALL_LOCO,
    },
    bounce: {
        parts: [{
                layer: 'rig-body',
                action: {
                    dur: 1.0,
                    poses: [{ y: -12, sy: 1.05 }, { y: 0, sy: 0.96 }, { y: -9, sy: 1.04 }, { y: 0, sy: 0.97 }, { y: -6 }, { y: 0 }],
                    anticipation: 0.5, settle: 0.6,
                },
            }],
        // Bouncing is repeated jumping, so it inherits the jump's restriction.
        during: GROUNDED,
    },
};
export const GESTURE_NAMES = Object.keys(GESTURES);
/** Which DOM layer a locomotion target writes to. The rig's three transform
 *  carriers are why `root` and `torso` are not `lyr-` groups. */
export function locoTargetLayer(t) {
    return t === 'root' ? 'rig-root' : `lyr-${t}`;
}
/**
 * The layers a gait actually animates — `tracks`, not `requires`.
 *
 * The distinction matters: a walk *requires* only two legs, but it also swings
 * the arms, so a wave during a driven walk would be fighting the arm swing for
 * the same element. `requires` would miss that.
 */
export function gaitDrivenLayers(gait) {
    return new Set(Object.keys(GAITS[gait].tracks).map(locoTargetLayer));
}
/** Every layer this gesture's parts touch (not counting the fallback). */
export function gestureLayers(g) {
    return GESTURES[g].parts.map((p) => p.layer);
}
/** Does this gesture want a layer the gait is already driving? */
export function conflictsWithGait(g, gait) {
    const driven = gaitDrivenLayers(gait);
    return gestureLayers(g).some((l) => driven.has(l));
}
/**
 * The compatibility table, as data. Semantic only — structural availability is
 * per character and per frame, so it cannot live in a static table. Exported
 * because "can this character do this right now" is a question a UI wants to
 * ask before offering a button.
 */
export const GESTURE_DURING = Object.fromEntries(GESTURE_NAMES.map((g) => [g, GESTURES[g].during]));
/**
 * Decide how a gesture should play for one character in one frame.
 *
 * Order matters. A semantically-blocked gesture is blocked whatever the
 * character's anatomy — offering a body-shaped stand-in for "jump while flying"
 * would be inventing an action nobody asked for. Structural problems, by
 * contrast, are what the fallback exists for.
 */
export function planGesture(g, locomotion, drivenGait, hasLayer, optOut) {
    const def = GESTURES[g];
    if (!def.during.includes(locomotion))
        return { mode: 'blocked', reason: 'semantic' };
    const missing = def.parts.some((p) => !hasLayer(p.layer));
    const busy = drivenGait !== null && conflictsWithGait(g, drivenGait);
    const optedOut = !!optOut?.includes(g);
    if (missing || busy || optedOut) {
        if (!def.fallback) {
            // Only the body-only gestures have no fallback, and their layer is always
            // present, so this is reachable solely if `parts` grows a limb layer
            // without a fallback being written for it.
            return { mode: 'blocked', reason: 'semantic' };
        }
        const reason = missing ? 'missing-layer' : busy ? 'gait-owns-layer' : 'character-opt-out';
        return { mode: 'fallback', parts: [def.fallback], reason };
    }
    return { mode: 'parts', parts: def.parts };
}
//# sourceMappingURL=gestures.js.map
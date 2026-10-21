import { resolveEmotion } from './emotions.js';
import { resolvePosture, posturePoses } from './posture.js';
import { composePoses } from './timing.js';
import { MotionEngine } from './motion.js';
const clamp1 = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
/**
 * Where the eyes are told to look: the frame's gaze plus the emotion's own
 * bias scaled by intensity, plus `extra` (the rig's idle saccade), clamped to
 * ±1 on the sum.
 */
export function lookTarget(frame, emotions, extra = { x: 0, y: 0 }) {
    const bias = resolveEmotion(frame.emotion, emotions).gaze;
    const k = frame.intensity;
    return {
        x: clamp1(frame.gaze.x + (bias?.x ?? 0) * k + extra.x),
        y: clamp1(frame.gaze.y + (bias?.y ?? 0) * k + extra.y),
    };
}
/**
 * The target a layer's transform lands on. A character with no torso layer
 * poses its spine on `.rig-body`, exactly as the rig does.
 */
export function transformKey(t, has) {
    return t === 'torso' && !has('torso') ? 'body' : t;
}
/** {@link RestState} for one frame of a character with these layers. */
export function restState(frame, opts) {
    const { has } = opts;
    const base = new Map();
    const put = (t, p) => {
        const key = transformKey(t, has);
        const list = base.get(key);
        if (list)
            list.push(p);
        else
            base.set(key, [p]);
    };
    const posture = posturePoses(resolvePosture(frame.emotion, frame.intensity, opts.posture));
    for (const l of Object.keys(posture))
        put(l, posture[l]);
    const gaze = lookTarget(frame, opts.emotions);
    const out = new MotionEngine(opts.motion).tick(0, {
        frame,
        gaze,
        has,
        pose: (t) => composePoses(base.get(transformKey(t, has)) ?? []),
    }, true);
    // One motion pose per target, the last written winning, as the rig keeps
    // them: on a character with no torso layer the engine's torso and body poses
    // share `.rig-body`.
    const motion = new Map();
    for (const t of Object.keys(out.poses))
        motion.set(transformKey(t, has), out.poses[t]);
    const poses = {};
    for (const t of new Set([...base.keys(), ...motion.keys()])) {
        const m = motion.get(t);
        poses[t] = composePoses(m ? [...(base.get(t) ?? []), m] : base.get(t));
    }
    const r = opts.eyeRadius;
    return {
        poses,
        faceX: out.faceX,
        shade: out.shade,
        iris: { x: gaze.x * r * 0.5, y: gaze.y * r * 0.5 },
        browY: -frame.browRaise * 5,
    };
}
//# sourceMappingURL=rest.js.map
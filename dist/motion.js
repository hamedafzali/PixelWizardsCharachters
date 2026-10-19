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
/** Largest integration step, seconds. Keeps stiff springs stable at low fps. */
const REST = 1e-4;
const MAX_H = 1 / 240;
/**
 * One damped spring on one scalar.
 *
 * Integrated with semi-implicit Euler at a fixed maximum substep, so a 100ms
 * frame hitch is eight small steps rather than one large one — the large one
 * is what makes a stiff spring explode.
 */
export class Spring {
    constructor(spec, value = 0) {
        this.velocity = 0;
        this.spec = spec;
        this.value = value;
    }
    /** Advance `dt` seconds toward `target`; returns the new value. */
    step(target, dt) {
        if (!(dt > 0) || !Number.isFinite(target))
            return this.value;
        const w = 2 * Math.PI * Math.max(0.01, this.spec.freq);
        const z = Math.max(0, this.spec.damping);
        const n = Math.max(1, Math.ceil(dt / MAX_H));
        const h = dt / n;
        for (let i = 0; i < n; i++) {
            const a = -w * w * (this.value - target) - 2 * z * w * this.velocity;
            this.velocity += a * h;
            this.value += this.velocity * h;
        }
        // An exponential decay never reaches zero; land exactly once it is far
        // below a visible pixel, so a settled rig writes the authored transforms
        // back verbatim instead of `translate(0.000 0)` forever.
        if (Math.abs(this.value - target) < REST && Math.abs(this.velocity) < REST * 10)
            this.snap(target);
        return this.value;
    }
    /** Land on `v` with no velocity — scene cuts, reduced motion, scrubbing. */
    snap(v) {
        this.value = v;
        this.velocity = 0;
    }
    /** Add an impulse, in value-units per second. */
    kick(v) {
        this.velocity += v;
    }
    /** At rest on `target`, within `eps`. */
    settled(target, eps = 1e-3) {
        return Math.abs(this.value - target) < eps && Math.abs(this.velocity) < eps;
    }
}
const ear = (side) => ({
    spring: { freq: 3.2, damping: 0.42 },
    inertia: 0.85,
    lift: 1.6 * side,
    drag: 0.6 * side,
    limit: 28,
});
/**
 * The defaults every character starts from. Moderate on purpose: a character
 * with no `motion` block should look alive, not rubbery — floppier is a
 * per-character decision.
 */
export const DEFAULT_MOTION = {
    secondary: {
        layers: {
            // `ears` posture is mirrored (earL −, earR +), and so is the flop.
            earL: ear(-1),
            earR: ear(1),
            tail: { spring: { freq: 2.2, damping: 0.35 }, inertia: 0.9, lift: 1.4, drag: -0.8, limit: 32 },
        },
    },
    attention: {
        turn: 3,
        pitch: 7,
        rise: 0,
        tilt: 2,
        torsoFollow: 0.2,
        spring: { freq: 2.4, damping: 0.85 },
        blink: { threshold: 0.65, cooldown: 1.2 },
    },
    body: {
        lean: { walk: 4, roll: 6, fly: 3 },
        leanSpring: { freq: 1.6, damping: 0.42 },
        pop: 0.06,
        land: 0.12,
        popSpring: { freq: 4.2, damping: 0.32 },
        energy: {
            happy: 0.6, excited: 1, surprised: 1, love: 0.5, proud: 0.4, encouraging: 0.4,
            sad: -0.7, sleepy: -0.4, shy: -0.4,
        },
    },
    depth: {
        travel: 5,
        layers: {
            accBack: -0.9, tail: -0.8, farArm: -0.6, farLeg: -0.5,
            torso: 0, torsoFront: 0.1,
            nearLeg: 0.5, nearArm: 0.6, head: 0.2,
            earL: 0, earR: 0, accFront: 0.9,
        },
        face: 0.8,
        follow: 0.35,
        shade: 10,
        spring: { freq: 2, damping: 0.9 },
    },
};
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/**
 * Merge `over` onto `base`. `false` replaces; an object over a `false` (or a
 * missing value) is merged onto `fallback`, so re-enabling a driver that an
 * earlier level switched off starts from its defaults, not from nothing.
 */
function merge(base, over, fallback) {
    if (over === undefined)
        return base;
    if (over === false || !isObj(over))
        return over;
    const from = isObj(base) ? base : isObj(fallback) ? fallback : {};
    const out = { ...from };
    for (const k of Object.keys(over)) {
        const fb = isObj(fallback) ? fallback[k] : undefined;
        out[k] = merge(from[k], over[k], fb);
    }
    return out;
}
/**
 * Resolve the effective settings from any number of override levels, applied
 * in order onto {@link DEFAULT_MOTION}. Returns a fresh object; the inputs and
 * the defaults are never mutated.
 */
export function resolveMotion(...levels) {
    let out = structuredCloneish(DEFAULT_MOTION);
    for (const l of levels)
        if (l)
            out = merge(out, l, DEFAULT_MOTION);
    return out;
}
function structuredCloneish(v) {
    return JSON.parse(JSON.stringify(v));
}
/**
 * The structural parent of each target, as `buildLayers` nests them. This is
 * the tree itself — the same for every character — not anyone's tuning. Ears
 * hang off the head when there is one and off the torso when there is not.
 */
export function parentOf(t, has) {
    switch (t) {
        case 'root': return null;
        case 'body': return 'root';
        case 'torso':
        case 'accBack':
        case 'accFront': return 'body';
        case 'earL':
        case 'earR': return has('head') ? 'head' : 'torso';
        case 'shadow': return null;
        default: return 'torso';
    }
}
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/**
 * Runs the four drivers. One instance per rig.
 *
 * `tick(dt, input)` integrates; `tick(0, input, true)` — **snap** — puts every
 * spring on its target with no velocity and returns the at-rest result. The rig
 * snaps whenever motion must be deterministic or must not be seen moving:
 * reduced motion, no animation loop, a pinned gait phase, an active scrub.
 */
export class MotionEngine {
    constructor(settings) {
        this.soft = new Map();
        this.prevEmotion = null;
        this.prevLoco = null;
        this.blinkCool = 0;
        this.s = settings;
        const a = settings.attention || DEFAULT_MOTION.attention;
        const b = settings.body || DEFAULT_MOTION.body;
        const d = settings.depth || DEFAULT_MOTION.depth;
        this.headX = new Spring(a.spring);
        this.headY = new Spring(a.spring);
        this.lean = new Spring(b.leanSpring);
        this.squash = new Spring(b.popSpring);
        this.yawBody = new Spring(d.spring);
        this.yawHead = new Spring(d.spring);
    }
    get settings() {
        return this.s;
    }
    /** Swap settings live. Spring state carries over, so nothing jumps. */
    set settings(next) {
        this.s = next;
        if (next.attention)
            this.headX.spec = this.headY.spec = next.attention.spring;
        if (next.body) {
            this.lean.spec = next.body.leanSpring;
            this.squash.spec = next.body.popSpring;
        }
        if (next.depth)
            this.yawBody.spec = this.yawHead.spec = next.depth.spring;
        for (const [l, sp] of this.soft) {
            const cfg = this.softConfig(l);
            if (cfg)
                sp.spec = cfg.spring;
            else
                this.soft.delete(l);
        }
    }
    /** The soft layers that are active for a character with these layers. */
    softLayers(has) {
        const sec = this.s.secondary;
        if (!sec)
            return [];
        return Object.keys(sec.layers).filter((l) => sec.layers[l] && has(l));
    }
    softConfig(l) {
        const sec = this.s.secondary;
        const c = sec ? sec.layers[l] : false;
        return c || null;
    }
    tick(dt, input, snap = false) {
        const out = { poses: {}, faceX: 0, shade: 0, blink: false, look: { x: 0, y: 0 }, yaw: { body: 0, head: 0 } };
        const add = (t, p) => {
            const cur = out.poses[t] ?? {};
            out.poses[t] = {
                x: (cur.x ?? 0) + (p.x ?? 0),
                y: (cur.y ?? 0) + (p.y ?? 0),
                rot: (cur.rot ?? 0) + (p.rot ?? 0),
                sx: (cur.sx ?? 1) * (p.sx ?? 1),
                sy: (cur.sy ?? 1) * (p.sy ?? 1),
            };
        };
        const step = (sp, target) => {
            if (snap) {
                sp.snap(target);
                return target;
            }
            return sp.step(target, dt);
        };
        const f = input.frame;
        this.blinkCool = Math.max(0, this.blinkCool - (snap ? 0 : dt));
        // --- attention -------------------------------------------------------
        const a = this.s.attention;
        if (a) {
            const gx = step(this.headX, input.gaze.x);
            const gy = step(this.headY, input.gaze.y);
            out.look = { x: gx, y: gy };
            const head = { x: a.turn * gx, y: a.rise * gy, rot: a.pitch * gy + a.tilt * gx };
            if (input.has('head'))
                add('head', head);
            const k = a.torsoFollow;
            if (k)
                add('torso', { x: (head.x ?? 0) * k, rot: (head.rot ?? 0) * k });
            if (!snap && a.blink && this.blinkCool === 0) {
                const lag = Math.hypot(input.gaze.x - gx, input.gaze.y - gy);
                if (lag > a.blink.threshold) {
                    out.blink = true;
                    this.blinkCool = a.blink.cooldown;
                }
            }
        }
        // --- body dynamics ---------------------------------------------------
        const b = this.s.body;
        if (b) {
            const loco = f.locomotion;
            const lean = loco === 'idle' ? 0 : (b.lean[loco] ?? 0) * Math.max(0.3, f.speed);
            const rot = step(this.lean, lean);
            // An emotion change or a landing *kicks* the squash spring rather than
            // targeting it: the target is always rest, so the pop is pure overshoot.
            if (this.prevEmotion !== null && f.emotion !== this.prevEmotion && !snap) {
                const e = b.energy[f.emotion] ?? 0;
                this.squash.kick(e * b.pop * clamp(f.intensity, 0, 1) * 2 * Math.PI * this.squash.spec.freq);
            }
            if (this.prevLoco === 'fly' && loco !== 'fly' && !snap) {
                this.squash.kick(-b.land * 2 * Math.PI * this.squash.spec.freq);
            }
            const s = clamp(step(this.squash, 0), -0.4, 0.4);
            // Stretch up is thin, squash down is wide: area stays roughly constant,
            // which is what keeps it reading as the same body.
            add('body', { rot, sy: 1 + s, sx: 1 / (1 + s) });
        }
        this.prevEmotion = f.emotion;
        this.prevLoco = f.locomotion;
        // --- depth -----------------------------------------------------------
        const d = this.s.depth;
        if (d) {
            const yaw = clamp(f.yaw ?? 0, -1, 1);
            const yb = step(this.yawBody, yaw);
            const yh = step(this.yawHead, clamp(yaw + d.follow * input.gaze.x, -1, 1));
            const headLike = (l) => l === 'head' || ((l === 'earL' || l === 'earR') && input.has('head'));
            const depthOf = (t) => t === null || t === 'root' || t === 'body' ? 0 : (d.layers[t] ?? 0);
            for (const l of Object.keys(d.layers)) {
                if (!input.has(l))
                    continue;
                const rel = depthOf(l) - depthOf(parentOf(l, input.has));
                const x = (headLike(l) ? yh : yb) * rel * d.travel;
                if (x)
                    add(l, { x });
            }
            const faceParent = input.has('head') ? 'head' : 'torso';
            out.faceX = (input.has('head') ? yh : yb) * (d.face - depthOf(faceParent)) * d.travel;
            out.shade = yb;
            out.yaw = { body: yb, head: yh };
        }
        // --- secondary -------------------------------------------------------
        // Last, because the soft layers lag everything above them — including the
        // head this engine just turned.
        const soft = this.softLayers(input.has);
        for (const l of soft) {
            const cfg = this.softConfig(l);
            let rotP = 0;
            let yP = 0;
            let xP = 0;
            for (let t = parentOf(l, input.has); t !== null; t = parentOf(t, input.has)) {
                const p = input.pose(t);
                const m = out.poses[t];
                rotP += (p.rot ?? 0) + (m?.rot ?? 0);
                yP += (p.y ?? 0) + (m?.y ?? 0);
                xP += (p.x ?? 0) + (m?.x ?? 0);
            }
            const own = input.pose(l).rot ?? 0;
            // The spring lives in world space: it chases where the layer *would* be
            // if rigid, and the difference is the lag. At rest that difference is 0,
            // so the layer's authored pose is untouched.
            const anchor = cfg.inertia * rotP + cfg.lift * yP + cfg.drag * xP;
            let sp = this.soft.get(l);
            if (!sp) {
                sp = new Spring(cfg.spring, anchor + own);
                this.soft.set(l, sp);
            }
            const w = step(sp, anchor + own);
            const lag = clamp(w - anchor - own, -cfg.limit, cfg.limit);
            if (lag)
                add(l, { rot: lag });
        }
        return out;
    }
}
//# sourceMappingURL=motion.js.map
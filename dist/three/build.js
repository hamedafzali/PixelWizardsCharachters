/**
 * `Body3DSpec` → a three.js object tree.
 *
 * The tree is the SVG rig's carriers and layers, one `Group` per joint, nested
 * exactly as `buildLayers` nests the `<g>`s: `root` › `body` › `torso` › limbs,
 * tail, head › ears. Each group sits at its pivot, so a pose applied to it
 * turns around the same point the 2D layer turns around, and the same posture,
 * gait and gesture numbers mean the same thing in both renderers.
 *
 * Pure construction: no renderer, no DOM. It runs under Node, which is how it
 * is tested.
 */
import * as THREE from 'three';
import { parentOf } from '../motion.js';
import { resolveEmotion } from '../emotions.js';
/** The art-space y of the ground: the SVG shadow's centre line. */
export const GROUND_Y = 188;
/** `.rig-mood`'s transform-origin y in `RIG_CSS`. */
export const MOOD_PIVOT_Y = 150;
const D2R = Math.PI / 180;
/** Art space (y down, origin top-left) → world (y up, origin on the ground under the character). */
export function artToWorld(p) {
    return new THREE.Vector3(p[0] - 100, GROUND_Y - p[1], p[2]);
}
/** A part's `rot` as a three.js rotation. See {@link Part3D.rot} for the convention. */
export function artEuler(rot) {
    const [pitch, yaw, roll] = rot ?? [0, 0, 0];
    // 'YXZ' applies Z first, then X, then Y: roll, pitch, yaw. Roll is negated
    // because the art's y axis points down, so a clockwise SVG turn is a
    // negative turn about +z here.
    return new THREE.Euler(pitch * D2R, yaw * D2R, -roll * D2R, 'YXZ');
}
/**
 * A three-step light ramp: lit, half-lit and shadow, with nothing in between.
 * That banding is what makes the toon material read as illustrated rather than
 * as plastic. Made from data, so it needs no canvas.
 */
export function toonRamp() {
    const tex = new THREE.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
}
const DEFAULT_OUTLINE = { width: 1.4, color: '#2a1a12' };
/** Build the 3D model for a character. Throws if the character has no `body3d`. */
export function buildModel(spec) {
    const b = spec.body3d;
    if (!b)
        throw new Error(`${spec.slug} has no body3d — it is SVG-only`);
    return buildBody(spec, b);
}
function buildBody(spec, b) {
    const owned = [];
    const own = (x) => {
        owned.push(x);
        return x;
    };
    const ramp = own(toonRamp());
    const outline = b.outline === false ? null : { ...DEFAULT_OUTLINE, ...b.outline };
    const mats = new Map();
    const material = (color, flat = false, opacity = 1) => {
        const key = `${color}|${flat}|${opacity}`;
        let m = mats.get(key);
        if (!m) {
            const transparent = opacity < 1;
            m = own(flat
                ? new THREE.MeshBasicMaterial({ color, transparent, opacity, depthWrite: !transparent })
                : new THREE.MeshToonMaterial({ color, gradientMap: ramp, transparent, opacity, depthWrite: !transparent }));
            mats.set(key, m);
        }
        return m;
    };
    const hullMat = outline
        ? own(new THREE.MeshBasicMaterial({ color: outline.color, side: THREE.BackSide }))
        : null;
    const unitSphere = own(new THREE.SphereGeometry(1, 32, 24));
    const unitBox = own(new THREE.BoxGeometry(2, 2, 2));
    const unitCone = own(new THREE.ConeGeometry(1, 1, 28));
    const unitCyl = own(new THREE.CylinderGeometry(1, 1, 1, 28));
    /**
     * A mesh for one part, positioned relative to `origin` (world). The outline
     * is an inverted hull: the same shape drawn back-faces-only in the outline
     * colour, grown by the outline width along each axis, so it shows only
     * where it sticks out past the silhouette.
     */
    const partMesh = (p, origin, outlineScale = 1) => {
        let geo;
        const scale = new THREE.Vector3(1, 1, 1);
        // Extents along x/y/z, for growing the hull by a constant width.
        let ext;
        const [a, c, d] = p.size;
        switch (p.shape) {
            case 'sphere':
                geo = unitSphere;
                scale.set(a, c, d);
                ext = [a, c, d];
                break;
            case 'box':
                geo = unitBox;
                scale.set(a, c, d);
                ext = [a, c, d];
                break;
            case 'cone':
                geo = unitCone;
                scale.set(a, c, d);
                ext = [a, c / 2, d];
                break;
            case 'cylinder':
                geo = unitCyl;
                scale.set(a, c, d);
                ext = [a, c / 2, d];
                break;
            case 'capsule':
                geo = own(new THREE.CapsuleGeometry(a, c, 8, 20));
                scale.set(1, 1, d / a);
                ext = [a, c / 2 + a, d];
                break;
            case 'torus':
                geo = own(new THREE.TorusGeometry(a, c, 12, 40, (d || 360) * D2R));
                ext = [a + c, a + c, c];
                break;
        }
        const mesh = new THREE.Mesh(geo, material(p.color, p.flat, p.opacity ?? 1));
        mesh.position.copy(artToWorld(p.at).sub(origin));
        mesh.setRotationFromEuler(artEuler(p.rot));
        mesh.scale.copy(scale);
        if (hullMat && outline && !p.noOutline && !p.flat && (p.opacity ?? 1) >= 1) {
            const w = outline.width * outlineScale;
            const hull = new THREE.Mesh(geo, hullMat);
            // In the mesh's own (scaled) space, so divide the width back out.
            hull.scale.set(1 + w / ext[0], 1 + w / ext[1], 1 + w / ext[2]);
            hull.renderOrder = -1;
            mesh.add(hull);
        }
        return mesh;
    };
    const has = (l) => !!b.layers[l];
    const object = new THREE.Group();
    object.name = `actor3d-${spec.slug}`;
    const joints = new Map();
    const worldPivot = new Map();
    const ground = artToWorld([100, GROUND_Y, 0]);
    const root = new THREE.Group();
    root.name = 'root';
    object.add(root);
    joints.set('root', { node: root, base: ground.clone() });
    root.position.copy(ground);
    worldPivot.set('root', ground);
    const body = new THREE.Group();
    body.name = 'body';
    root.add(body);
    joints.set('body', { node: body, base: new THREE.Vector3() });
    worldPivot.set('body', ground);
    // Everything inside `body` hangs off the mood carrier, as everything inside
    // `.rig-body` sits in `.rig-mood`. It is not a MotionTarget, so its children
    // are placed relative to its pivot under the name `body`.
    const moodPivot = artToWorld([100, MOOD_PIVOT_Y, 0]);
    const moodNode = new THREE.Group();
    moodNode.name = 'mood';
    const moodBase = moodPivot.clone().sub(ground);
    moodNode.position.copy(moodBase);
    body.add(moodNode);
    const mood = { node: moodNode, base: moodBase };
    // Parents before children: walk until every layer is placed. The nesting
    // comes from the motion engine's `parentOf`, the one statement of the tree
    // both renderers share; a parent this character lacks falls back to `body`.
    const parentFor = (l) => {
        const p = parentOf(l, has);
        return p === null || (p !== 'root' && p !== 'body' && !has(p)) ? 'body' : p;
    };
    const pending = Object.keys(b.layers).filter((l) => l !== 'shadow');
    for (let guard = 0; pending.length && guard < 20; guard++) {
        for (let i = 0; i < pending.length; i++) {
            const l = pending[i];
            const parent = parentFor(l);
            const pj = parent === 'body' ? mood : joints.get(parent);
            const pw = parent === 'body' ? moodPivot : worldPivot.get(parent);
            if (!pj || !pw)
                continue;
            const spec3 = b.layers[l];
            const pivot = artToWorld(spec3.pivot);
            const g = new THREE.Group();
            g.name = l;
            const base = pivot.clone().sub(pw);
            g.position.copy(base);
            for (const part of spec3.parts)
                g.add(partMesh(part, pivot));
            pj.node.add(g);
            joints.set(l, { node: g, base });
            worldPivot.set(l, pivot);
            pending.splice(i--, 1);
        }
    }
    // --- face ---------------------------------------------------------------
    let face = null;
    const f = b.face;
    const faceJoint = joints.get(f.layer);
    const facePivot = worldPivot.get(f.layer);
    if (faceJoint && facePivot) {
        const center = artToWorld(f.center);
        const Z = new THREE.Vector3(0, 0, 1);
        /** A group at `at`, turned so its +z is the surface normal there. */
        const onSurface = (at, name) => {
            const g = new THREE.Group();
            g.name = name;
            const w = artToWorld(at);
            g.position.copy(w.clone().sub(facePivot));
            const n = w.clone().sub(center);
            if (n.lengthSq() > 1e-9)
                g.quaternion.setFromUnitVectors(Z, n.normalize());
            faceJoint.node.add(g);
            return g;
        };
        const r = spec.eyes.r;
        const eyes = spec.eyes.x.map((x, i) => {
            const node = onSurface([x, spec.eyes.y, f.eyes.z], `eye${i}`);
            node.add(partMesh({ shape: 'sphere', at: [100, GROUND_Y, 0], size: [r * 1.1, r * 1.28, r * 0.45], color: f.eyes.sclera ?? '#fdfdff' }, ground, 0.55));
            const iris = new THREE.Group();
            iris.position.z = r * 0.3;
            iris.add(partMesh({ shape: 'sphere', at: [100, GROUND_Y, 0], size: [r * 0.82, r * 0.82, r * 0.2], color: f.eyes.iris, noOutline: true }, ground));
            iris.add(partMesh({ shape: 'sphere', at: [100, GROUND_Y + r * 0.05, r * 0.12], size: [r * 0.48, r * 0.48, r * 0.14], color: '#140c05', noOutline: true }, ground));
            node.add(iris);
            // Catchlights stay put while the iris moves, as in the 2D eye.
            node.add(partMesh({ shape: 'sphere', at: [100 - r * 0.32, GROUND_Y - r * 0.36, r * 0.62], size: [r * 0.3, r * 0.3, r * 0.08], color: '#ffffff', flat: true }, ground));
            node.add(partMesh({ shape: 'sphere', at: [100 + r * 0.28, GROUND_Y + r * 0.3, r * 0.6], size: [r * 0.14, r * 0.14, r * 0.05], color: '#ffffff', flat: true, opacity: 0.85 }, ground));
            return { node, iris, travel: r * 0.4 };
        });
        const half = f.brows.half ?? 8;
        const brows = spec.eyes.x.map((x, i) => {
            const node = onSurface([x, f.brows.y, f.brows.z], `brow${i}`);
            const mesh = partMesh({ shape: 'capsule', at: [100, GROUND_Y, 0], size: [f.brows.thick ?? 1.5, half * 2, f.brows.thick ?? 1.5], color: spec.browColor, noOutline: true }, ground);
            node.add(mesh);
            return { node, mesh, half };
        });
        const mh = f.mouth.half ?? 9;
        const mnode = onSurface([f.mouth.x, f.mouth.y, f.mouth.z], 'mouth');
        const open = partMesh({ shape: 'sphere', at: [100, GROUND_Y, 1], size: [1, 1, 2.5], color: f.mouth.inner ?? '#5c1414', noOutline: true }, ground);
        const tongue = partMesh({ shape: 'sphere', at: [100, GROUND_Y, 0], size: [1, 1, 1.5], color: f.mouth.tongue ?? '#f27b8f', noOutline: true }, ground);
        open.add(tongue);
        // The two closed mouths, along the same quadratic curves `drawMouth` strokes:
        // a relaxed smile (half-width 9, control point 5 below) and a flatter,
        // heavier lip press (7, 0.5). Width is applied by scaling x per viseme.
        const curve = (half, sag, radius, name) => {
            const path = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-half, 0, 0), new THREE.Vector3(0, -sag, 0), new THREE.Vector3(half, 0, 0));
            const m = new THREE.Mesh(own(new THREE.TubeGeometry(path, 24, radius, 8, false)), material(f.mouth.color));
            m.name = name;
            return m;
        };
        const smile = curve(mh, 5 * (mh / 9), 1.5, 'smile');
        const press = curve(mh * 7 / 9, 0.5, 1.8, 'press');
        mnode.add(open, smile, press);
        // Pitched 90°, a cone's apex points out of the face and its depth radius
        // becomes its height on screen.
        let beak = null;
        if (spec.render({ emotion: resolveEmotion('neutral'), intensity: 1 }).mouth?.beak) {
            const jaw = (y, half, length, thick, color) => {
                const g = new THREE.Group();
                g.position.y = y;
                g.add(partMesh({ shape: 'cone', at: [100, GROUND_Y, length / 2], size: [half, length, thick], rot: [90, 0, 0], color }, ground, 0.6));
                mnode.add(g);
                return g;
            };
            // drawMouth's beak: an upper lens 22 wide and a lower one 18 wide under it.
            const upper = jaw(0.5, 11, 12, 2.5, '#f19100');
            const lower = jaw(-1.5, 9, 9, 2, '#d97a00');
            const bt = partMesh({ shape: 'sphere', at: [100, GROUND_Y, 2], size: [1, 1, 2], color: '#ff7a95', noOutline: true }, ground);
            mnode.add(bt);
            beak = { upper, lower, tongue: bt, rest: -1.5, half: 2 };
        }
        face = { eyes, brows, mouth: { node: mnode, open, tongue, smile, press, half: mh, beak } };
    }
    // --- ground shadow ------------------------------------------------------
    let shadow = null;
    const sr = b.shadow ?? 50;
    if (sr > 0) {
        const geo = own(new THREE.CircleGeometry(1, 48));
        shadow = new THREE.Mesh(geo, material('#000000', true, 0.12));
        shadow.name = 'shadow';
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(0, 0.2, 0);
        shadow.scale.set(sr, sr * 0.45, 1);
        shadow.renderOrder = -2;
        object.add(shadow);
    }
    const disposers = [];
    return {
        object,
        joints,
        mood,
        face,
        shadow,
        has,
        disposers,
        dispose: () => {
            for (const o of owned)
                o.dispose();
            for (const d of disposers.splice(0))
                d();
            owned.length = 0;
            object.removeFromParent();
        },
    };
}
//# sourceMappingURL=build.js.map
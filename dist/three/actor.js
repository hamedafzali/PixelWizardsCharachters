/**
 * The browser half of the three.js renderer: a canvas, a camera, lights and an
 * animation loop around one {@link ActorModel}. Everything a character does is
 * in the model; this only shows it.
 *
 * The API mirrors `ActorRig` — `mount`, `apply`, `finish`, `playGesture`,
 * `speak`, `blink`, `setMotion`, `setCharacter`, `destroy` — so a driver can
 * switch renderers without learning a second vocabulary. That is also what
 * makes the no-WebGL fallback possible: when no context can be created, the
 * same calls go to an `ActorRig` in the same host.
 */
import * as THREE from 'three';
import { ActorRig, watchReducedMotion } from '../rig.js';
import { knownCharacter } from '../validate.js';
import { ActorModel } from './model.js';
import { skinModel } from './skin.js';
/** The camera frames the 200×200 art box, as the SVG viewBox does. */
const FRAME = 200;
function prefersReducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export class ThreeActor {
    constructor(spec, opts = {}) {
        this.model = null;
        this.webgl = null;
        this.scene = new THREE.Scene();
        this.host = null;
        /** the SVG stand-in, when mount found no WebGL; see {@link ThreeActorOptions.fallback} */
        this.svgRig = null;
        this.raf = null;
        this.last = 0;
        /** applied before mount, replayed once the model exists */
        this.early = {};
        /** bumped per build, so a skin still loading for a replaced model is dropped */
        this.generation = 0;
        /** stops following the OS reduced-motion setting */
        this.unwatchReduced = null;
        this.spec = spec;
        this.opts = { size: 240, maxPixelRatio: 2, background: null, ...opts };
        // A long lens and a far camera: close to the SVG's flat projection, so the
        // 2D and 3D renders of a character line up, with enough perspective to
        // read as round.
        const fov = 22;
        this.camera = new THREE.PerspectiveCamera(fov, 1, 10, 4000);
        const dist = FRAME / 2 / Math.tan((fov / 2) * Math.PI / 180);
        // Art y 100 (the middle of the box) is world y 88.
        this.camera.position.set(0, 96, dist);
        this.camera.lookAt(0, 88, 0);
        this.scene.add(new THREE.HemisphereLight('#fff6ec', '#7a6a8a', 1.6));
        const key = new THREE.DirectionalLight('#ffffff', 2.2);
        key.position.set(-120, 220, 260);
        this.scene.add(key);
        const rim = new THREE.DirectionalLight('#ffe2c4', 0.9);
        rim.position.set(200, 120, -220);
        this.scene.add(rim);
    }
    /**
     * Create the canvas inside `host` and start the loop — or, with no WebGL,
     * mount the SVG rig there instead (see {@link ThreeActorOptions.fallback}).
     */
    mount(host) {
        // The renderer first: it is the part that can fail, and a failure must
        // leave nothing half-built behind.
        let r;
        try {
            // The stencil is how the face clips each iris to the white of its eye.
            r = new THREE.WebGLRenderer({ antialias: true, stencil: true, alpha: this.opts.background == null });
        }
        catch (error) {
            if (this.opts.fallback === false)
                throw error;
            return this.mountFallback(host, error);
        }
        this.host = host;
        const rm = this.opts.reducedMotion ?? 'auto';
        const reduced = rm === 'auto' ? prefersReducedMotion() : rm;
        this.model = new ActorModel(this.spec, { ...this.opts, reducedMotion: reduced });
        if (rm === 'auto')
            this.unwatchReduced = watchReducedMotion((on) => this.model?.setReducedMotion(on));
        this.scene.add(this.model.object);
        if (Object.keys(this.early).length)
            this.model.apply(this.early);
        this.early = {};
        this.dress();
        r.setPixelRatio(Math.min(this.opts.maxPixelRatio ?? 2, globalThis.devicePixelRatio || 1));
        const size = this.opts.size ?? 240;
        r.setSize(size, size);
        r.outputColorSpace = THREE.SRGBColorSpace;
        if (this.opts.background != null)
            this.scene.background = new THREE.Color(this.opts.background);
        r.domElement.classList.add('ca-three');
        r.domElement.style.display = 'block';
        host.appendChild(r.domElement);
        this.webgl = r;
        this.last = performance.now();
        const step = (now) => {
            const dt = Math.min(now - this.last, 100) / 1000;
            this.last = now;
            this.model?.tick(dt);
            this.webgl?.render(this.scene, this.camera);
            this.raf = requestAnimationFrame(step);
        };
        this.raf = requestAnimationFrame(step);
        return this;
    }
    /** No WebGL: the SVG rig takes the host, the options they share and the frame so far. */
    mountFallback(host, error) {
        if (this.raf !== null)
            cancelAnimationFrame(this.raf);
        this.raf = null;
        const { skin: _skin, background: _bg, maxPixelRatio: _dpr, random: _random, fallback: _fallback, onFallback, ...shared } = this.opts;
        this.host = host;
        this.svgRig = new ActorRig(this.spec, shared).mount(host);
        if (Object.keys(this.early).length)
            this.svgRig.apply(this.early);
        this.early = {};
        onFallback?.(error);
        return this;
    }
    /** What is drawing: `'webgl'`, `'svg'` (the no-WebGL fallback), or `null` before mount. */
    get backend() {
        return this.webgl ? 'webgl' : this.svgRig ? 'svg' : null;
    }
    /** The model, once mounted: joints, face and the current frame. `null` under the SVG fallback. */
    get actor() {
        return this.model;
    }
    get goal() {
        return this.svgRig?.goal ?? this.model?.goal ?? null;
    }
    get settling() {
        return this.svgRig?.settling ?? this.model?.settling ?? false;
    }
    get motion() {
        return this.svgRig?.motion ?? this.model?.motion ?? null;
    }
    apply(frame) {
        // A switch goes through `setCharacter` here, not only in the renderer
        // below, so the 3D model is re-skinned and `spec` stays the one a later
        // fallback mounts. An unknown name passes through and is reported there.
        const spec = frame.character !== this.spec.slug ? knownCharacter(frame.character) : null;
        if (spec)
            this.setCharacter(spec);
        if (this.svgRig)
            this.svgRig.apply(frame);
        else if (this.model)
            this.model.apply(frame);
        else
            Object.assign(this.early, frame);
    }
    finish() {
        this.svgRig?.finish();
        this.model?.finish();
    }
    playGesture(g) {
        this.svgRig?.playGesture(g);
        this.model?.playGesture(g);
    }
    speak(text, perViseme = 85) {
        this.svgRig?.speak(text, perViseme);
        this.model?.speak(text, perViseme);
    }
    blink() {
        this.svgRig?.blink();
        this.model?.blink();
    }
    setMotion(overrides) {
        this.svgRig?.setMotion(overrides);
        this.model?.setMotion(overrides);
    }
    setCharacter(spec) {
        this.spec = spec;
        this.svgRig?.setCharacter(spec);
        this.model?.setCharacter(spec);
        this.dress();
    }
    /** Skin the current model with its 2D art, unless that is switched off. */
    dress() {
        const model = this.model;
        const skin = this.opts.skin ?? true;
        if (!model || skin === false)
            return;
        const gen = ++this.generation;
        // Hidden until dressed: the bare primitives are a stand-in, not a first frame.
        const object = model.object;
        object.visible = false;
        skinModel(model.parts, this.spec, skin === true ? {} : skin, () => gen === this.generation && this.model === model)
            .catch(() => {
            // A skin that fails to load leaves the primitives showing: degraded, not broken.
        })
            .finally(() => {
            if (gen === this.generation && this.model === model)
                object.visible = true;
        });
    }
    /** Resize the canvas, in CSS pixels. The SVG fallback keeps its mount size. */
    resize(size) {
        this.opts.size = size;
        this.webgl?.setSize(size, size);
    }
    /** Stop the loop, free GPU resources and remove the canvas. */
    destroy() {
        this.unwatchReduced?.();
        this.unwatchReduced = null;
        if (this.raf !== null)
            cancelAnimationFrame(this.raf);
        this.raf = null;
        this.generation++;
        this.model?.dispose();
        this.model = null;
        if (this.webgl) {
            this.webgl.dispose();
            this.webgl.domElement.remove();
            this.webgl = null;
        }
        this.svgRig?.destroy();
        this.svgRig = null;
        this.host = null;
    }
}
//# sourceMappingURL=actor.js.map
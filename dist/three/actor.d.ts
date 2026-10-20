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
import type { ActorFrame, CharacterSpec, Gesture } from '../types.js';
import type { MotionOverrides, MotionSettings } from '../motion.js';
import { ActorModel, type ActorModelOptions } from './model.js';
import { type SkinOptions } from './skin.js';
export interface ThreeActorOptions extends Omit<ActorModelOptions, 'reducedMotion'> {
    /** canvas size in CSS pixels, square; default 240 */
    size?: number;
    /** `'auto'` (default) follows `prefers-reduced-motion`, including changes after mount */
    reducedMotion?: boolean | 'auto';
    /** scene background; default transparent */
    background?: string | null;
    /** device-pixel-ratio cap; default 2 */
    maxPixelRatio?: number;
    /**
     * Dress the model in the character's own 2D art, inflated (see `skinModel`).
     * Default on; `false` shows the bare `body3d` primitives.
     */
    skin?: boolean | SkinOptions;
    /**
     * When no WebGL context can be created (old devices, a blocked GPU, headless
     * browsers), mount the SVG `ActorRig` in the same host instead, and send
     * every call to it. Default on. `false` makes `mount` throw the context
     * error, with nothing left in the host, for an app with its own fallback.
     */
    fallback?: boolean;
    /** Called once, with the context error, when `mount` falls back to the SVG rig. */
    onFallback?: (error: unknown) => void;
}
export declare class ThreeActor {
    private spec;
    private opts;
    private model;
    private webgl;
    private scene;
    private camera;
    private host;
    /** the SVG stand-in, when mount found no WebGL; see {@link ThreeActorOptions.fallback} */
    private svgRig;
    private raf;
    private last;
    /** applied before mount, replayed once the model exists */
    private early;
    /** bumped per build, so a skin still loading for a replaced model is dropped */
    private generation;
    /** stops following the OS reduced-motion setting */
    private unwatchReduced;
    constructor(spec: CharacterSpec, opts?: ThreeActorOptions);
    /**
     * Create the canvas inside `host` and start the loop — or, with no WebGL,
     * mount the SVG rig there instead (see {@link ThreeActorOptions.fallback}).
     */
    mount(host: HTMLElement): this;
    /** No WebGL: the SVG rig takes the host, the options they share and the frame so far. */
    private mountFallback;
    /** What is drawing: `'webgl'`, `'svg'` (the no-WebGL fallback), or `null` before mount. */
    get backend(): 'webgl' | 'svg' | null;
    /** The model, once mounted: joints, face and the current frame. `null` under the SVG fallback. */
    get actor(): ActorModel | null;
    get goal(): ActorFrame | null;
    get settling(): boolean;
    get motion(): MotionSettings | null;
    apply(frame: Partial<ActorFrame>): void;
    finish(): void;
    playGesture(g: Gesture): void;
    speak(text: string, perViseme?: number): void;
    blink(): void;
    setMotion(overrides?: MotionOverrides): void;
    setCharacter(spec: CharacterSpec): void;
    /** Skin the current model with its 2D art, unless that is switched off. */
    private dress;
    /** Resize the canvas, in CSS pixels. The SVG fallback keeps its mount size. */
    resize(size: number): void;
    /** Stop the loop, free GPU resources and remove the canvas. */
    destroy(): void;
}
//# sourceMappingURL=actor.d.ts.map
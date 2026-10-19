/**
 * The browser half of the three.js renderer: a canvas, a camera, lights and an
 * animation loop around one {@link ActorModel}. Everything a character does is
 * in the model; this only shows it.
 *
 * The API mirrors `ActorRig` — `mount`, `apply`, `finish`, `playGesture`,
 * `speak`, `blink`, `setMotion`, `setCharacter`, `destroy` — so a driver can
 * switch renderers without learning a second vocabulary.
 */
import type { ActorFrame, CharacterSpec, Gesture } from '../types.js';
import type { MotionOverrides, MotionSettings } from '../motion.js';
import { ActorModel, type ActorModelOptions } from './model.js';
import { type SkinOptions } from './skin.js';
export interface ThreeActorOptions extends Omit<ActorModelOptions, 'reducedMotion'> {
    /** canvas size in CSS pixels, square; default 240 */
    size?: number;
    /** `'auto'` (default) reads `prefers-reduced-motion` at mount */
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
}
export declare class ThreeActor {
    private spec;
    private opts;
    private model;
    private renderer;
    private scene;
    private camera;
    private host;
    private raf;
    private last;
    /** applied before mount, replayed once the model exists */
    private early;
    /** bumped per build, so a skin still loading for a replaced model is dropped */
    private generation;
    constructor(spec: CharacterSpec, opts?: ThreeActorOptions);
    /** Create the canvas inside `host` and start the loop. */
    mount(host: HTMLElement): this;
    /** The model, once mounted: joints, face and the current frame. */
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
    /** Resize the canvas, in CSS pixels. */
    resize(size: number): void;
    /** Stop the loop, free GPU resources and remove the canvas. */
    destroy(): void;
}
//# sourceMappingURL=actor.d.ts.map
/**
 * The headless half of the three.js renderer: an `ActorFrame` in, a posed
 * object tree out. No renderer, no DOM, no timers — one clock, advanced by
 * {@link ActorModel.tick}, drives everything, so the same model runs inside
 * `ThreeActor`'s animation loop and inside a Node test that steps it by hand.
 *
 * It is the SVG `ActorRig`'s driver loop, reading the same data: the frame
 * interpolator, idle micro-motion, gait tables, posture presets, gesture plans
 * and the motion engine. What changes is only where a pose lands — a group's
 * position, rotation and scale instead of a `transform` string — and that the
 * head and body can turn for real, so the engine's 2D stand-ins for a turn (the
 * head slide, the layer parallax) are switched off and its spring state is read
 * as rotation instead.
 */
import * as THREE from 'three';
import type { ActorFrame, CharacterSpec, EmotionName, Gesture, EmotionOverrides } from '../types.js';
import { type MicroConfig } from '../micro.js';
import { type InterpolationProfile } from '../interpolate.js';
import { type PhaseKey } from '../locomotion.js';
import { type GesturePlan } from '../gestures.js';
import { type OnInvalidFrame } from '../validate.js';
import { type MotionOverrides, type MotionSettings } from '../motion.js';
import { type Turn3D } from '../body3d.js';
import { type BuiltModel } from './build.js';
export declare const MOOD_POSES: Record<EmotionName, {
    keys: readonly PhaseKey[];
    dur: number;
    once?: boolean;
}>;
/**
 * What the engine must not do in 3D: its head slide (`attention.turn`,
 * `pitch`) and layer parallax (`depth.travel`) fake a rotation the model
 * performs for real. Layered last, over every other level, so no setting can
 * double the turn.
 */
export declare const MOTION_3D: MotionOverrides;
export interface ActorModelOptions {
    /** disable autonomous blinking */
    blink?: boolean;
    emotions?: EmotionOverrides;
    micro?: MicroConfig;
    interpolation?: InterpolationProfile;
    /** motion-engine overrides, as {@link RigOptions.motion} */
    motion?: MotionOverrides;
    /** reduced motion: everything lands at once; no micro-motion, gestures or blinks */
    reducedMotion?: boolean;
    /** blink timing randomness, for deterministic tests; default Math.random */
    random?: () => number;
    onFrame?: (frame: ActorFrame) => void;
    onSettled?: (frame: ActorFrame) => void;
    onGestureBlocked?: (gesture: Gesture, reason: 'semantic') => void;
    onInvalidFrame?: OnInvalidFrame;
}
export declare class ActorModel {
    private spec;
    private opts;
    private built;
    private frame;
    private interp;
    private micro;
    private loco;
    private engine;
    private motionOverrides;
    private contrib;
    private out;
    private saccade;
    private gestures;
    private lastGesture;
    private settledFired;
    private clock;
    private moodKey;
    private moodT;
    private fallbackPhase;
    private blinkIn;
    /** seconds the lids stay shut; > 0 while blinking */
    private shut;
    private pendingBlink;
    /** 0 open … 1 shut, eased */
    private lid;
    private speech;
    private rand;
    constructor(spec: CharacterSpec, opts?: ActorModelOptions);
    /** The object tree; add it to a scene. The facing mirror is applied to it. */
    get object(): THREE.Group;
    /** The joints, face and shadow, for inspection and tests. */
    get parts(): BuiltModel;
    /** The rendered (eased) frame. */
    get current(): ActorFrame;
    /** The frame as last requested, before easing. */
    get goal(): ActorFrame;
    get settling(): boolean;
    get reduced(): boolean;
    /** The motion-engine settings in effect, including the 3D overrides. */
    get motion(): MotionSettings;
    private resolve;
    /** Retune the motion engine live, as {@link ActorRig.setMotion}. */
    setMotion(overrides?: MotionOverrides): void;
    /** The turn ranges in effect: the character's, over {@link DEFAULT_TURN3D}. */
    get turn(): Turn3D;
    /**
     * Request a frame. Sets the goal; {@link tick} eases toward it. Channels with
     * no easing (viseme, emotion, facing) land at once, as in the SVG rig, and
     * under reduced motion everything does.
     */
    apply(frame: Partial<ActorFrame>): void;
    /** Land every channel and every spring on its goal now. */
    finish(): void;
    /** Swap to a different character: a new body, the same frame and clock. */
    setCharacter(spec: CharacterSpec): void;
    /**
     * Advance everything by `dt` seconds and pose the tree. The one clock: frame
     * easing, gait, breathing, gestures, mood, blinks, speech and the springs
     * all read it, so nothing drifts against anything else.
     */
    tick(dt: number): void;
    /** Everything that follows the frame alone. Runs on every frame change. */
    private sync;
    private set;
    private has;
    private drivenGait;
    private tickLocomotion;
    private tickMood;
    /** Start a one-shot gesture, planned exactly as the SVG rig plans it. */
    playGesture(g: Gesture): void;
    /** How this gesture would play right now. */
    planFor(g: Gesture): GesturePlan | null;
    private tickGestures;
    private clearGesture;
    private nextBlinkGap;
    /** One blink, held as long as the current emotion's lids are heavy. */
    blink(): void;
    private tickBlink;
    /** Speak a Persian string through its viseme sequence, on the model's clock. */
    speak(text: string, perViseme?: number): void;
    private tickSpeech;
    private intentGaze;
    private basePose;
    private runEngine;
    /** Reduced motion and `finish()`: no micro-motion, no gestures, springs at rest. */
    private settle;
    /** Compose every target's sources and write them, then the face. */
    private flush;
    private updateFace;
    /** Free the geometry and materials and detach the tree. */
    dispose(): void;
}
//# sourceMappingURL=model.d.ts.map
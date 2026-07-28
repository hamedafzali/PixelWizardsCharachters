import type { ActorFrame, CharacterSpec, Gesture } from './types.js';
/**
 * CSS the rig needs: body-motion keyframes (one per emotion mood), locomotion
 * cycles, one-shot gestures, blink transition and the owl wing-flap. Injected
 * once per document. Respects `prefers-reduced-motion`.
 */
export declare const RIG_CSS = "\n.ca-svg{display:block;transform-origin:100px 150px;will-change:transform}\n.ca-svg .iris{transition:transform .18s cubic-bezier(.3,.7,.3,1)}\n.ca-svg .browsG{transition:transform .16s ease}\n.ca-svg .blinkLid{transition:transform .09s ease;transform:scaleY(0)}\n.ca-svg .blinkLid.shut{transform:scaleY(1)}\n.ca-svg.loco-fly .wingL{transform-origin:50px 110px;animation:caWingL .4s ease-in-out infinite}\n.ca-svg.loco-fly .wingR{transform-origin:150px 110px;animation:caWingR .4s ease-in-out infinite}\n@keyframes caBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}\n@keyframes caFloaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}\n@keyframes caWiggle{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}\n@keyframes caSway{0%,100%{transform:rotate(-2deg) translateY(0)}50%{transform:rotate(2deg) translateY(-2px)}}\n@keyframes caNod{0%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}70%{transform:translateY(1px)}}\n@keyframes caDroop{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(3px) rotate(-1deg)}}\n@keyframes caPop{0%{transform:scale(1)}30%{transform:scale(1.12)}60%{transform:scale(.97)}100%{transform:scale(1)}}\n@keyframes caWalk{0%,100%{transform:translateY(0) rotate(-2deg)}25%{transform:translateY(-4px)}50%{transform:translateY(0) rotate(2deg)}75%{transform:translateY(-4px)}}\n@keyframes caFly{0%,100%{transform:translateY(-3px)}50%{transform:translateY(3px)}}\n@keyframes caGWave{0%,100%{transform:rotate(0)}20%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}80%{transform:rotate(-6deg)}}\n@keyframes caGJump{0%,100%{transform:translateY(0)}30%{transform:translateY(-22px) scale(1.04)}55%{transform:translateY(0)}70%{transform:translateY(-8px)}}\n@keyframes caGSpin{0%{transform:rotateY(0)}100%{transform:rotateY(360deg)}}\n@keyframes caWingL{0%,100%{transform:rotate(0)}50%{transform:rotate(-24deg)}}\n@keyframes caWingR{0%,100%{transform:rotate(0)}50%{transform:rotate(24deg)}}\n@media (prefers-reduced-motion:reduce){.ca-svg,.ca-svg *{animation:none!important}}\n";
export interface RigOptions {
    size?: number;
    /** disable the random blink loop */
    blink?: boolean;
    /** callback with the frame after each `apply` */
    onFrame?: (frame: ActorFrame) => void;
}
/**
 * A live character puppet bound to a DOM element. Render once, then feed it
 * {@link ActorFrame}s (from an AI, a timeline, or UI controls) and it mutates
 * in place — gaze, brows, mouth, blink, body motion and gestures — only doing a
 * full re-render when the art itself changes (character/emotion/facing).
 */
export declare class ActorRig {
    spec: CharacterSpec;
    frame: ActorFrame;
    private opts;
    private host;
    private svg;
    private mouthG;
    private irises;
    private browsG;
    private lids;
    private blinkTimer;
    private speakTimer;
    private lastArtKey;
    constructor(spec: CharacterSpec, opts?: RigOptions);
    /** Mount into a host element and start the blink loop. */
    mount(host: HTMLElement): this;
    /** Swap to a different character (keeps the current frame's behaviour). */
    setCharacter(spec: CharacterSpec): void;
    /** Full render — only when the drawn art changes. Re-caches rig hooks. */
    private render;
    /** Blink lids over each eye, positioned from the spec's eye anchors. */
    private injectLids;
    private artKey;
    /** Apply a frame. Re-renders only if the art changed; else mutates live. */
    apply(frame: Partial<ActorFrame>): void;
    private updateMouth;
    private updateGaze;
    private updateBrow;
    private updateMotion;
    /** Play a one-shot gesture on top of the current motion, then release it. */
    playGesture(g: Gesture): void;
    /**
     * Speak a Persian string: drive the mouth through its viseme sequence, then
     * return to rest. `perViseme` is the ms each shape holds.
     */
    speak(text: string, perViseme?: number): void;
    private scheduleBlink;
    /** One blink. */
    blink(): void;
    /** Stop timers and detach. */
    destroy(): void;
}
//# sourceMappingURL=rig.d.ts.map
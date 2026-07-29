import type { ActorFrame, CharacterSpec, Gesture, EmotionOverrides } from './types.js';
import { type MicroConfig } from './micro.js';
import { type InterpolationProfile } from './interpolate.js';
/**
 * CSS the rig needs.
 *
 * Transforms are split across three nested carriers so they compose instead of
 * fighting over one `transform` property:
 *
 *   `.rig-root` — locomotion, pivoting at the ground contact
 *   `.rig-body` — gestures and squash/stretch, same ground pivot
 *   `.rig-mood` — emotion idle motion, pivoting at the body centre
 *
 * All pivots are in the 200×200 art space. (They used to sit on the `<svg>`
 * element itself, where `transform-origin:100px 150px` was measured against the
 * rendered pixel box — wrong at every `size` but 200.)
 *
 * Injected once per document. Respects `prefers-reduced-motion`.
 */
export declare const RIG_CSS = "\n.ca-svg{display:block}\n.ca-svg .rig-root{transform-origin:100px 190px;will-change:transform}\n.ca-svg .rig-body{transform-origin:100px 188px;will-change:transform}\n.ca-svg .rig-mood{transform-origin:100px 150px;will-change:transform}\n.ca-svg .iris{transition:transform .18s cubic-bezier(.3,.7,.3,1)}\n.ca-svg .browsG{transition:transform .16s ease}\n.ca-svg .blinkLid{transition:transform .09s ease;transform:scaleY(0)}\n.ca-svg .blinkLid.shut{transform:scaleY(1)}\n/* torso + head are rewritten every frame by the micro-motion loop, so a\n   transition on them would smear rather than ease. The remaining posture-only\n   layers still ease here. */\n.ca-svg .lyr-earL,.ca-svg .lyr-earR,.ca-svg .lyr-tail{transition:transform .35s cubic-bezier(.3,.7,.3,1)}\n/* The arm layers are NOT in that transition list: phase-driven locomotion\n   rewrites them every frame, and a 0.35s transition would smear the swing into\n   mush \u2014 the same reason torso and head are excluded above. */\n/* Only unlayered fliers (simorgh) animate wings in CSS. Converted characters\n   (boomi) are driven by the phase table in locomotion.ts, get no limb rules\n   here, and must never carry .wingL/.wingR \u2014 nested under a driven layer, the\n   CSS animation would outrank the inline transform and win outright. The two\n   conventions are kept apart by canDrive(), and by a test in rig-cache. */\n.ca-svg.loco-fly .wingL{transform-origin:50px 110px;animation:caWingL .4s ease-in-out infinite}\n.ca-svg.loco-fly .wingR{transform-origin:150px 110px;animation:caWingR .4s ease-in-out infinite}\n@keyframes caBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}\n@keyframes caFloaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}\n@keyframes caWiggle{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}\n@keyframes caSway{0%,100%{transform:rotate(-2deg) translateY(0)}50%{transform:rotate(2deg) translateY(-2px)}}\n@keyframes caNod{0%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}70%{transform:translateY(1px)}}\n@keyframes caDroop{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(3px) rotate(-1deg)}}\n@keyframes caPop{0%{transform:scale(1)}30%{transform:scale(1.12)}60%{transform:scale(.97)}100%{transform:scale(1)}}\n@keyframes caWalk{0%,100%{transform:translateY(0) rotate(-2deg)}25%{transform:translateY(-4px)}50%{transform:translateY(0) rotate(2deg)}75%{transform:translateY(-4px)}}\n@keyframes caFly{0%,100%{transform:translateY(-3px)}50%{transform:translateY(3px)}}\n@keyframes caWingL{0%,100%{transform:rotate(0)}50%{transform:rotate(-24deg)}}\n@keyframes caWingR{0%,100%{transform:rotate(0)}50%{transform:rotate(24deg)}}\n@media (prefers-reduced-motion:reduce){.ca-svg,.ca-svg *{animation:none!important;transition:none!important}}\n";
/**
 * The art cache key. A full re-render happens only when this changes.
 *
 * `intensity` is deliberately **absent**: it drives squint and widen, and those
 * are now live rig hooks (`.eyeG` scale and `.lidLo` ry) rather than baked
 * geometry. Including it meant an interpolated intensity sweep re-rendered the
 * whole SVG several times on the way. Exported so that invariant is directly
 * testable.
 */
export declare function artKeyOf(f: ActorFrame): string;
export interface RigOptions {
    size?: number;
    /** disable the random blink loop */
    blink?: boolean;
    /** per-emotion tuning — overrides any channel of any emotion preset */
    emotions?: EmotionOverrides;
    /**
     * Called with the *rendered* frame, once per animation tick.
     *
     * **Per-tick firing is the permanent contract, not an artifact of easing.**
     * The rendered frame genuinely changes every tick of a transition, and a
     * callback that skipped ticks would be lying about what is on screen; the
     * honest rate is the frame rate. Consumers that mirror the frame somewhere
     * cheap (a debug readout, a store write) want exactly this.
     *
     * It is therefore *not* the hook for expensive side effects — network calls,
     * analytics, persistence, React `setState`. At 60fps a 300ms transition fires
     * it ~18 times. Use {@link RigOptions.onSettled} for those: it fires once,
     * when the rig arrives. Read {@link ActorRig.goal} for what was last asked
     * for and {@link ActorRig.settling} for whether it has got there yet.
     */
    onFrame?: (frame: ActorFrame) => void;
    /**
     * Called once with the final frame when every channel has arrived — the
     * debounced companion to {@link RigOptions.onFrame}, for work too expensive
     * to do per tick.
     *
     * Fires on the tick the last channel lands, and on `finish()` / reduced
     * motion / an unmounted rig, where arrival is immediate. An `apply()` that
     * changes nothing does not fire it: there was no transition to settle.
     */
    onSettled?: (frame: ActorFrame) => void;
    /**
     * A gesture was refused rather than played. Only `semantic` refusals reach
     * here — a character that merely lacks the limb plays its whole-body
     * fallback, which is a performance, not a failure. A driver that asks for a
     * jump mid-flight gets nothing, and this is how it finds out.
     */
    onGestureBlocked?: (gesture: Gesture, reason: 'semantic') => void;
    /** idle micro-motion tuning; `{ amount: 0 }` disables it */
    micro?: MicroConfig;
    /** per-channel easing overrides; see {@link DEFAULT_PROFILE} */
    interpolation?: InterpolationProfile;
}
/**
 * A live character puppet bound to a DOM element. Render once, then feed it
 * {@link ActorFrame}s (from an AI, a timeline, or UI controls) and it mutates
 * in place — gaze, brows, mouth, blink, posture, body motion and gestures —
 * only doing a full re-render when the art itself changes.
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
    private lidsLo;
    private eyeGs;
    private root;
    private mood;
    private layers;
    private blinkTimer;
    private speakTimer;
    private lastArtKey;
    /** per target, per source — composed into one transform each tick */
    private contrib;
    /** the current idle-saccade offset, in gaze units; see {@link updateGaze} */
    private saccade;
    private micro;
    private interp;
    private loco;
    /** whether onSettled has already fired for the current goal */
    private settledFired;
    /** the gesture currently playing, so a re-sync doesn't restart it */
    private lastGesture;
    private raf;
    private lastTick;
    private reduced;
    constructor(spec: CharacterSpec, opts?: RigOptions);
    /** The frame as last requested, before easing. */
    get goal(): ActorFrame;
    /** True while any channel is still travelling toward the goal. */
    get settling(): boolean;
    /** Land every channel on its goal immediately — scene cuts, tests. */
    finish(): void;
    /** Mount into a host element and start the idle + blink loops. */
    mount(host: HTMLElement): this;
    /**
     * One animation loop for every procedural channel. Idle micro-motion writes
     * its contribution, then every dirty target is recomposed and written once —
     * so breathing and posture stack instead of overwriting each other.
     */
    private startLoop;
    /**
     * Record one source's contribution to a target. Falls back from `torso` to
     * `body` so characters not yet converted to layers still breathe.
     */
    private setContribution;
    private targetEl;
    /** Compose every target's sources and write the result. */
    private flushTransforms;
    /** Swap to a different character (keeps the current frame's behaviour). */
    setCharacter(spec: CharacterSpec): void;
    /**
     * Retune the emotion presets live. Overrides don't change the art key, so we
     * force a full re-render (the squint/widen/brow are baked into the art), then
     * re-apply the live channels. Used by editor UIs for instant preview.
     */
    setEmotions(emotions?: EmotionOverrides): void;
    /** Full render — only when the drawn art changes. Re-caches rig hooks. */
    private render;
    /**
     * Blink lids over each eye, positioned from the spec's eye anchors. Parented
     * to the head layer (or the flip group) so they mirror with the character —
     * appended to the `<svg>` root they landed on the wrong eyes when facing left.
     */
    private injectLids;
    private artKey;
    /**
     * Live squint / widen, driven straight from the current intensity.
     *
     * Both used to be baked into the drawn eye geometry, which forced
     * `intensity` into the art cache key — so smoothly interpolating it would
     * have triggered a full `innerHTML` re-render at every quantisation step.
     *
     * Now the art is drawn at the unscaled radius and *both* channels are live:
     * widen is a scale on the `.eyeG` wrapper (so sclera, iris, catchlights and
     * lid grow together and cannot drift apart), squint is the lower lid's `ry`.
     * Baking widen while tracking the lid live would have left the eye stuck at
     * whatever intensity happened to be current at the last re-render.
     */
    private updateEyes;
    /**
     * Request a frame. This sets the *goal*; the loop eases toward it, so the DOM
     * does not necessarily match `frame` when this returns.
     *
     * Channels with no delay and no duration (viseme, emotion, facing) still land
     * synchronously inside `target()`, so lip-sync stays tight and a caller can
     * read the result immediately. With no loop running — reduced motion, or no
     * `requestAnimationFrame` at all — everything lands at once instead of
     * silently never arriving.
     */
    apply(frame: Partial<ActorFrame>): void;
    /** Push the current (already eased) frame into the DOM. */
    private syncFrame;
    private updateMouth;
    /**
     * Where the eyes point, from three sources that stack:
     *
     *   1. the frame's `gaze` — what the driver asked for, and always dominant;
     *   2. the emotion's own `gaze`, scaled by intensity — خجالتی looks away
     *      without being told to, so a driver that never touches gaze still gets
     *      eyes that mean something;
     *   3. the idle saccade — the eyes are never perfectly still, even fixated.
     *
     * Clamped to ±1 because past that the iris leaves the sclera and the eye
     * reads as pointing at nothing. The clamp is on the *sum*, so an emphatic
     * driver gaze quietly absorbs the emotion bias rather than fighting it.
     */
    private updateGaze;
    private updateBrow;
    /**
     * The silhouette half of an emotion: spine curve, shoulder sink, head tilt,
     * ear droop, tail carriage, arm hang. Static transforms on the layer groups —
     * this is a held pose, not an animation, so it eases via the CSS transition
     * and costs nothing per frame.
     *
     * A walk cycle animates the limb layers, and a running animation outranks
     * these inline transforms; during `walk` the arms and legs belong to the
     * cycle, while spine/head/ears/tail keep posing. That is the intended split.
     */
    private updatePosture;
    private updateMotion;
    /**
     * Which gait the phase driver is handling this frame, or null if the
     * character has no limb layers for it (fallback) or is idle.
     *
     * Exposed on the instance rather than inlined so the fallback decision has
     * exactly one definition — the render path and the CSS gate must never
     * disagree about it.
     */
    private drivenGait;
    /** Advance the gait cycle and publish one pose per driven layer. */
    private tickLocomotion;
    /**
     * Play a one-shot gesture.
     *
     * The plan — which layers move, or whether the whole body stands in, or
     * whether the gesture is refused outright — is decided by {@link planGesture}
     * from this character's layers and this frame's locomotion. The rig only
     * carries it out.
     *
     * Multi-part gestures (a clap is two arms) start in the same tick and share
     * one timeout, so they cannot drift apart by a frame.
     */
    playGesture(g: Gesture): void;
    /**
     * Release the gesture channel — through the interpolator, which owns it.
     * Writing `this.frame` directly would be undone by the next tick.
     */
    private clearGesture;
    /**
     * Speak a Persian string: drive the mouth through its viseme sequence, then
     * return to rest. `perViseme` is the ms each shape holds.
     */
    speak(text: string, perViseme?: number): void;
    /**
     * Autonomous blinking — rate and lid weight come from the emotion, and a
     * fraction of blinks come in pairs. Both are cheap and both read as alive.
     */
    private scheduleBlink;
    /** One blink, held for as long as the current emotion's lids are heavy. */
    blink(): void;
    /** Stop timers and detach. */
    destroy(): void;
}
//# sourceMappingURL=rig.d.ts.map
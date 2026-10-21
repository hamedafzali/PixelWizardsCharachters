import type { ActorFrame, CharacterSpec, Gesture, EmotionOverrides } from './types.js';
import { type MicroConfig } from './micro.js';
import { type InterpolationProfile } from './interpolate.js';
import { type GesturePlan } from './gestures.js';
import { type OnInvalidFrame } from './validate.js';
import { type MotionOverrides, type MotionSettings } from './motion.js';
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
export declare const RIG_CSS = "\n.ca-svg{display:block}\n.ca-svg .rig-root{transform-origin:100px 190px;will-change:transform}\n.ca-svg .rig-body{transform-origin:100px 188px;will-change:transform}\n.ca-svg .rig-mood{transform-origin:100px 150px;will-change:transform}\n.ca-svg .iris{transition:transform .18s cubic-bezier(.3,.7,.3,1)}\n.ca-svg .browsG{transition:transform .16s ease}\n.ca-svg .blinkLid{transition:transform .09s ease;transform:scaleY(0)}\n.ca-svg .blinkLid.shut{transform:scaleY(1)}\n/* torso + head are rewritten every frame by the micro-motion loop, so a\n   transition on them would smear rather than ease. The remaining posture-only\n   layers still ease here. */\n/* .ca-spring marks a layer the motion engine's secondary springs own: it is\n   rewritten every tick, so it is excluded for the same reason. */\n.ca-svg .lyr-earL:not(.ca-spring),.ca-svg .lyr-earR:not(.ca-spring),.ca-svg .lyr-tail:not(.ca-spring){transition:transform .35s cubic-bezier(.3,.7,.3,1)}\n/* The arm layers are NOT in that transition list: phase-driven locomotion\n   rewrites them every frame, and a 0.35s transition would smear the swing into\n   mush \u2014 the same reason torso and head are excluded above. */\n/* Only unlayered fliers animate wings in CSS \u2014 none currently in the roster\n   (\u0633\u06CC\u0645\u0631\u063A converted in v1.3.0), but the rules stay for whichever character is\n   next added unlayered. Converted characters (boomi, simorgh) are driven by\n   the phase table in locomotion.ts, get no limb rules here, and must never\n   carry .wingL/.wingR \u2014 nested under a driven layer, the CSS animation would\n   outrank the inline transform and win outright. The two conventions are kept\n   apart by canDrive(), and by a test in rig-cache. */\n.ca-svg.loco-fly .wingL{transform-origin:50px 110px;animation:caWingL .4s ease-in-out infinite}\n.ca-svg.loco-fly .wingR{transform-origin:150px 110px;animation:caWingR .4s ease-in-out infinite}\n@keyframes caBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}\n@keyframes caFloaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}\n@keyframes caWiggle{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}\n@keyframes caSway{0%,100%{transform:rotate(-2deg) translateY(0)}50%{transform:rotate(2deg) translateY(-2px)}}\n@keyframes caNod{0%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}70%{transform:translateY(1px)}}\n@keyframes caDroop{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(3px) rotate(-1deg)}}\n@keyframes caPop{0%{transform:scale(1)}30%{transform:scale(1.12)}60%{transform:scale(.97)}100%{transform:scale(1)}}\n@keyframes caWalk{0%,100%{transform:translateY(0) rotate(-2deg)}25%{transform:translateY(-4px)}50%{transform:translateY(0) rotate(2deg)}75%{transform:translateY(-4px)}}\n@keyframes caFly{0%,100%{transform:translateY(-3px)}50%{transform:translateY(3px)}}\n@keyframes caWingL{0%,100%{transform:rotate(0)}50%{transform:rotate(-24deg)}}\n@keyframes caWingR{0%,100%{transform:rotate(0)}50%{transform:rotate(24deg)}}\n/* .ca-reduced is the manual twin of the media query below: render() sets it\n   whenever this.reduced is true, whether that came from the OS or from\n   RigOptions.reducedMotion. Same rule body as the media query on purpose \u2014\n   one policy, two triggers, so a forced override behaves exactly like the OS\n   setting for every CSS-driven animation and transition, not just the ones a\n   JS check happens to gate. */\n.ca-svg.ca-reduced,.ca-svg.ca-reduced *{animation:none!important;transition:none!important}\n@media (prefers-reduced-motion:reduce){.ca-svg,.ca-svg *{animation:none!important;transition:none!important}}\n";
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
    /**
     * A frame named an emotion, viseme or gesture that does not exist. The rig
     * kept what it was already doing (see `src/validate.ts`) instead of throwing;
     * this is how a driver finds out it is sending a name the library cannot use.
     *
     * Fires once per bad channel, per `apply()`. Throwing from inside restores
     * the old fail-fast behaviour, which is a reasonable thing for a test suite
     * to do.
     */
    onInvalidFrame?: OnInvalidFrame;
    /** idle micro-motion tuning; `{ amount: 0 }` disables it */
    micro?: MicroConfig;
    /** per-channel easing overrides; see {@link DEFAULT_PROFILE} */
    interpolation?: InterpolationProfile;
    /**
     * Override `prefers-reduced-motion` instead of reading it from the OS.
     *
     * `'auto'` (the default) is the OS media query, exactly as before. `true`/
     * `false` force the rig into or out of reduced motion regardless of it — for
     * a consuming app's own accessibility setting, or for a test/demo that wants
     * to show reduced motion without depending on the environment's OS state.
     *
     * Read in {@link ActorRig.mount}: changing this option on an already-mounted
     * rig has no effect. Under `'auto'` the rig keeps following the OS setting
     * after mount. See the README's accessibility section for what "reduced"
     * means per feature.
     */
    reducedMotion?: boolean | 'auto';
    /**
     * Motion-engine overrides for this rig, layered over the character's own
     * `CharacterSpec.motion` and `DEFAULT_MOTION`. `false` on any driver turns it
     * off; `{ secondary: false, attention: false, body: false, depth: false }`
     * restores the pre-engine rig exactly. Change it live with
     * {@link ActorRig.setMotion}.
     */
    motion?: MotionOverrides;
}
/**
 * Follow the OS setting after mount. Up to 1.6.0 it was read once, so turning
 * reduced motion on mid-session changed nothing until a remount (PW-15). The
 * CSS half already followed the media query live; this is for the JS half.
 * Returns the unsubscribe, or `null` where there is no `matchMedia`.
 */
export declare function watchReducedMotion(onChange: (reduced: boolean) => void): (() => void) | null;
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
    /**
     * The mouth anchor from the last full render, and the markup last written
     * into `mouthG`. The anchor used to come from a fresh `spec.render()` — the
     * whole art string — on every tick (PW-06); it belongs to the drawn art, so
     * it is read again only when the art is.
     */
    private mouth;
    private mouthMarkup;
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
    /** one-shot timers (gesture end, blink reopen, double blink); see {@link later} */
    private timers;
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
    /** stops following the OS reduced-motion setting; see {@link watchReducedMotion} */
    private unwatchReduced;
    /** a pinned gait phase, or null to let the cycle run; see {@link pinGaitPhase} */
    private pinnedPhase;
    private motionOverrides;
    private engine;
    /** CSS gestures in flight — invisible to JS otherwise; see {@link basePose} */
    private cssGestures;
    /** the CSS loco fallback on `.rig-root`, and when it started */
    private rootLoco;
    private rootAnim;
    /** gestures currently held by {@link scrubGesture} */
    private scrubbing;
    /** how far the face is slid across its parent by depth, art units */
    private faceX;
    private grads;
    private lastShade;
    private readonly uid;
    constructor(spec: CharacterSpec, opts?: RigOptions);
    /** The motion-engine settings in effect, after every override level. */
    get motion(): MotionSettings;
    /**
     * Retune the motion engine live, layered over the character's and the
     * options' settings. `undefined` drops the live level. Spring state carries
     * over, so a change of stiffness mid-wobble does not jump.
     */
    setMotion(overrides?: MotionOverrides): void;
    /** The frame as last requested, before easing. */
    get goal(): ActorFrame;
    /** True while any channel is still travelling toward the goal. */
    get settling(): boolean;
    /** Land every channel on its goal immediately — scene cuts, tests. */
    finish(): void;
    /** Mount into a host element and start the idle + blink loops. */
    mount(host: HTMLElement): this;
    /**
     * The OS setting changed while mounted. Turning reduced motion on lands
     * everything and stops the loop and blinks, leaving the rig as it would be
     * had it been mounted that way; turning it off starts them again.
     */
    private setReduced;
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
    /**
     * Swap to a different character (keeps the current frame's behaviour).
     * `apply({ character: slug })` does the same for a built-in character; this
     * is the way to switch to a custom spec.
     */
    setCharacter(spec: CharacterSpec): void;
    /**
     * Run the motion engine and stage its output as each target's `motion`
     * contribution. Does not flush; the caller does.
     *
     * `snap` — or any state where motion must hold still or cannot be seen:
     * reduced motion, no loop, a pinned gait, a held scrub — lands every spring
     * on its target, so a frozen frame shows the at-rest pose and never a wobble
     * caught mid-swing.
     */
    private tickMotion;
    /** {@link tickMotion} at rest, when nothing else will tick it. */
    private settleMotionIfStill;
    /**
     * A target's pose from every source except the motion engine — what the
     * springs chase. CSS gestures and the CSS gait fallback do not pass through
     * the contribution table, so they are sampled from the same data that built
     * their keyframes; without that a soft ear would sit rigid through a jump.
     */
    private basePose;
    /** Where the eyes are told to look: frame gaze plus emotion bias, no saccade. */
    private intentGaze;
    /** Tag the layers the secondary springs own, so their CSS transition is off. */
    private markSpringLayers;
    /** The mouth rides the face slide; see {@link tickMotion}. */
    private updateFace;
    /**
     * Slide each radial gradient's highlight against the turn: as the body yaws
     * toward the light it catches it on the far side. The authored `cx` is the
     * yaw-0 value and is restored verbatim at 0.
     */
    private updateShade;
    /**
     * Retune the emotion presets live. Overrides don't change the art key, so we
     * force a full re-render (the squint/widen/brow are baked into the art), then
     * re-apply the live channels. Used by editor UIs for instant preview.
     */
    setEmotions(emotions?: EmotionOverrides): void;
    /** Full render — only when the drawn art changes. Re-caches rig hooks. */
    private render;
    /**
     * Blink lids over each eye, positioned from the spec's eye anchors.
     *
     * **Parented to whatever the eyes themselves are drawn into**, so the lids
     * inherit exactly the transforms the eyes do. Anything else desynchronises
     * them the moment something moves:
     *
     *   - Appended to the `<svg>` root, they landed on the wrong eyes when facing
     *     left, because the facing flip mirrors `.rig-flip` and not the root.
     *   - Appended to `.rig-flip`, they sat *outside* all three transform
     *     carriers — `.rig-root` (locomotion), `.rig-body` (gesture and squash)
     *     and `.rig-mood` (emotion idle). For a character with a head layer that
     *     was invisible, since the head layer was used instead. For the two
     *     characters with no head layer (بومی, سیمرغ) it meant a blink during a
     *     walk, a gesture or any non-neutral posture closed the lid over empty
     *     art-space while the eyes had moved away.
     *
     * Reading the parent off `.eyeG` is correct by construction for both cases:
     * a head layer if there is one, the torso or the mood group if there is not.
     * Appending puts the lid after the eye art, which is the paint order an
     * overlay needs.
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
    /**
     * Hold the gait cycle at one phase, or `null` to let it run again.
     *
     * This is a review tool: a walk cycle is eight frames of decision that go by
     * in half a second, and "is the far leg passing through at the right moment"
     * cannot be answered at speed. It exists on the rig rather than in the studio
     * because there is exactly one correct way to freeze a gait and it depends on
     * how the character is driven — a phase-driven character has its pose written
     * inline every tick, while a fallback character is running a CSS animation on
     * `.rig-root`, and pausing one does nothing for the other. Both are handled
     * here so nothing downstream has to know which case it is looking at.
     *
     * Returns how the freeze was achieved, which the caller may want to show:
     * `'phase'`, `'css'`, or `'none'` when the character is not moving at all.
     *
     * The CSS-fallback branch has two implementations. Normally `animation-delay`
     * seeks into the timeline and `animation-play-state:paused` holds it there.
     * Under reduced motion that hold is invisible: `RIG_CSS`'s
     * `animation:none!important` cannot tell a paused animation from a running
     * one, so it kills both, and a reviewer scrubbing a reduced-motion browser
     * would see nothing rather than the requested frame. There, `LOCO_FALLBACK_POSES`
     * is sampled instead and the pose is written straight to `.rig-root`'s
     * `transform` — the one path `!important` cannot veto.
     */
    pinGaitPhase(phase: number | null): 'phase' | 'css' | 'none';
    /** The duration the CSS body-gait rule runs for, read off the rule the rig set. */
    private rootAnimationDuration;
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
     *
     * Under reduced motion the channel resolves at once instead of holding for
     * the action's nominal duration. `RIG_CSS` already prevents the CSS
     * animation this method starts from ever being seen, so waiting out `dur`
     * would only be an invisible hold — the same reason `apply()` snaps every
     * other channel there rather than leaving it to travel unseen.
     */
    playGesture(g: Gesture): void;
    /**
     * How this gesture would play right now — which layers, or why not.
     *
     * Shared by {@link playGesture} and {@link scrubGesture} so the two can never
     * disagree about routing. A studio that resolved the plan itself would be a
     * fourth copy of that decision, and the whole point of scrubbing is to watch
     * the thing that actually ships.
     */
    planFor(g: Gesture): GesturePlan | null;
    /**
     * Hold a gesture at a fraction of its timeline instead of playing it.
     *
     * `t` is 0..1 across the **whole** action, so `t = 0.1` lands inside the
     * derived anticipation and `t = 0.9` inside the settle — the beats that
     * appear in no `poses` array and that nobody had ever actually looked at
     * before this existed. `null` releases the hold.
     *
     * The mechanism is deliberately the real animation, paused: the same
     * `@keyframes` rule {@link playGesture} starts, with a negative
     * `animation-delay` to seek and `animation-play-state: paused` to hold. It
     * would have been easier to compute the pose with `sampleAction` and write it
     * inline — and it would have been a different thing. `sampleAction` is an
     * interpolator written in TypeScript; this is the browser's, which is the one
     * the user sees. Where they disagree (a keyframe list whose transform
     * functions do not match, so CSS falls back to matrix interpolation) the
     * browser is right by definition. `test/sample.test.mjs` binds the two so the
     * batch tooling can keep using the sampler with a known limit.
     *
     * Under reduced motion, the browser is not an option: `RIG_CSS`'s
     * `animation:none!important` cannot distinguish this paused hold from a
     * running animation and kills both, so a reviewer on a reduced-motion
     * browser would see nothing at all. There — and only there — this falls
     * back to `sampleAction`, writing the pose straight to the element's
     * `transform`, accepting the small fidelity gap documented on
     * {@link sampleAction} in exchange for the hold actually being visible.
     */
    scrubGesture(g: Gesture, t: number | null): GesturePlan | null;
    /**
     * Release the gesture channel — through the interpolator, which owns it.
     * Writing `this.frame` directly would be undone by the next tick.
     */
    private clearGesture;
    /**
     * Speak a Persian string: drive the mouth through its viseme sequence, then
     * return to rest. `perViseme` is the ms each shape holds — one letter, one
     * hold, at a fixed duration. See the docstring on `textToVisemes` for why
     * that model is kept rather than replaced with syllable timing: it is
     * measurably near the ceiling for a text-only, lexicon-free approach.
     *
     * For real timing accuracy — matching recorded or synthesized audio rather
     * than approximating from text — drive `apply({ viseme, mouthOpen })`
     * directly from a timed track (TTS phoneme marks, forced alignment) instead
     * of calling `speak()`. That input path is not built; see README.md.
     */
    speak(text: string, perViseme?: number): void;
    /**
     * Autonomous blinking — rate and lid weight come from the emotion, and a
     * fraction of blinks come in pairs. Both are cheap and both read as alive.
     */
    private scheduleBlink;
    /** One blink, held for as long as the current emotion's lids are heavy. */
    blink(): void;
    /**
     * A one-shot timer that `destroy()` cancels. Up to 1.6.0 these three ran on
     * after it (PW-11): harmless to the DOM, but each one kept a destroyed rig
     * alive until it fired.
     */
    private later;
    /** Stop timers and detach. */
    destroy(): void;
}
//# sourceMappingURL=rig.d.ts.map
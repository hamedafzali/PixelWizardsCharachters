import type { ActorFrame, CharacterSpec, Gesture, EmotionOverrides, LayerName } from './types.js'
import { defaultFrame } from './types.js'
import { renderActorSVG, drawMouth } from './render.js'
import { resolveEmotion } from './emotions.js'
import { eyeWidenScale, eyeWidenTransform, eyeLidRy } from './draw.js'
import { resolvePosture } from './posture.js'
import { ensureAction, composePoses, poseToTransform, type Pose, type TimedAction } from './timing.js'
import { sampleAction } from './sample.js'
import { IdleMicroMotion, blinkStyle, type MicroConfig } from './micro.js'
import { FrameInterpolator, type InterpolationProfile } from './interpolate.js'
import {
  LocomotionDriver, LOCO_TARGETS, drivesGait, wrapPhase, samplePhase,
  type GaitName, type LocoTarget, type PhaseKey,
} from './locomotion.js'
import { planGesture, type GesturePart, type GesturePlan } from './gestures.js'
import { VISEMES, textToVisemes } from './visemes.js'
import { sanitizeFrame, isKnownGesture, type OnInvalidFrame } from './validate.js'
import { MotionEngine, resolveMotion, type MotionOverrides, type MotionSettings, type MotionTarget } from './motion.js'

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
export const RIG_CSS = `
.ca-svg{display:block}
.ca-svg .rig-root{transform-origin:100px 190px;will-change:transform}
.ca-svg .rig-body{transform-origin:100px 188px;will-change:transform}
.ca-svg .rig-mood{transform-origin:100px 150px;will-change:transform}
.ca-svg .iris{transition:transform .18s cubic-bezier(.3,.7,.3,1)}
.ca-svg .browsG{transition:transform .16s ease}
.ca-svg .blinkLid{transition:transform .09s ease;transform:scaleY(0)}
.ca-svg .blinkLid.shut{transform:scaleY(1)}
/* torso + head are rewritten every frame by the micro-motion loop, so a
   transition on them would smear rather than ease. The remaining posture-only
   layers still ease here. */
/* .ca-spring marks a layer the motion engine's secondary springs own: it is
   rewritten every tick, so it is excluded for the same reason. */
.ca-svg .lyr-earL:not(.ca-spring),.ca-svg .lyr-earR:not(.ca-spring),.ca-svg .lyr-tail:not(.ca-spring){transition:transform .35s cubic-bezier(.3,.7,.3,1)}
/* The arm layers are NOT in that transition list: phase-driven locomotion
   rewrites them every frame, and a 0.35s transition would smear the swing into
   mush — the same reason torso and head are excluded above. */
/* Only unlayered fliers animate wings in CSS — none currently in the roster
   (سیمرغ converted in v1.3.0), but the rules stay for whichever character is
   next added unlayered. Converted characters (boomi, simorgh) are driven by
   the phase table in locomotion.ts, get no limb rules here, and must never
   carry .wingL/.wingR — nested under a driven layer, the CSS animation would
   outrank the inline transform and win outright. The two conventions are kept
   apart by canDrive(), and by a test in rig-cache. */
.ca-svg.loco-fly .wingL{transform-origin:50px 110px;animation:caWingL .4s ease-in-out infinite}
.ca-svg.loco-fly .wingR{transform-origin:150px 110px;animation:caWingR .4s ease-in-out infinite}
@keyframes caBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
@keyframes caFloaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes caWiggle{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes caSway{0%,100%{transform:rotate(-2deg) translateY(0)}50%{transform:rotate(2deg) translateY(-2px)}}
@keyframes caNod{0%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}70%{transform:translateY(1px)}}
@keyframes caDroop{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(3px) rotate(-1deg)}}
@keyframes caPop{0%{transform:scale(1)}30%{transform:scale(1.12)}60%{transform:scale(.97)}100%{transform:scale(1)}}
@keyframes caWalk{0%,100%{transform:translateY(0) rotate(-2deg)}25%{transform:translateY(-4px)}50%{transform:translateY(0) rotate(2deg)}75%{transform:translateY(-4px)}}
@keyframes caFly{0%,100%{transform:translateY(-3px)}50%{transform:translateY(3px)}}
@keyframes caWingL{0%,100%{transform:rotate(0)}50%{transform:rotate(-24deg)}}
@keyframes caWingR{0%,100%{transform:rotate(0)}50%{transform:rotate(24deg)}}
/* .ca-reduced is the manual twin of the media query below: render() sets it
   whenever this.reduced is true, whether that came from the OS or from
   RigOptions.reducedMotion. Same rule body as the media query on purpose —
   one policy, two triggers, so a forced override behaves exactly like the OS
   setting for every CSS-driven animation and transition, not just the ones a
   JS check happens to gate. */
.ca-svg.ca-reduced,.ca-svg.ca-reduced *{animation:none!important;transition:none!important}
@media (prefers-reduced-motion:reduce){.ca-svg,.ca-svg *{animation:none!important;transition:none!important}}
`

const MOOD_ANIM: Record<string, { name: string; dur: number; once?: boolean }> = {
  neutral: { name: 'caBreathe', dur: 4 },
  happy: { name: 'caFloaty', dur: 3 },
  excited: { name: 'caWiggle', dur: 0.5 },
  thinking: { name: 'caSway', dur: 4 },
  encouraging: { name: 'caNod', dur: 1.6 },
  sad: { name: 'caDroop', dur: 4.5 },
  surprised: { name: 'caPop', dur: 0.4, once: true },
  sleepy: { name: 'caDroop', dur: 6 },
  love: { name: 'caFloaty', dur: 2.4 },
  // گیج tilts and drifts — caSway, faster than thinking's, so the head reads as
  // searching rather than musing. مغرور holds itself still and only breathes,
  // slower and deeper than neutral. خجالتی sways very slightly, like sad's
  // droop but shallower; both use existing keyframes because a new @keyframes
  // per emotion is how the mood layer stops being legible at a glance.
  confused: { name: 'caSway', dur: 2.2 },
  proud: { name: 'caBreathe', dur: 5 },
  shy: { name: 'caDroop', dur: 5.2 },
}

const LOCO_ANIM: Record<string, { name: string; dur: number } | null> = {
  idle: null,
  walk: { name: 'caWalk', dur: 0.5 },
  fly: { name: 'caFly', dur: 1.6 },
  // No CSS keyframes: `root`/`torso` are always structurally present (see
  // `drivenGait`'s `has`), so a character that declares `roll` is always
  // phase-driven and never reaches the CSS-fallback branch this table backs.
  roll: null,
}

/**
 * `caWalk`/`caFly` above, as data instead of CSS text.
 *
 * Only exists for {@link ActorRig.pinGaitPhase}'s reduced-motion branch: the
 * usual hold pauses the real animation, but under reduced motion the
 * stylesheet's `animation:none!important` cannot tell a paused animation from
 * a running one and kills the hold along with it (see `RIG_CSS`'s `.ca-reduced`
 * rule). Sampling this table with `samplePhase` and writing the pose directly
 * is the one path that rule cannot veto.
 *
 * Read off the `@keyframes` percentages directly: `caWalk`'s `rotate` is only
 * ever authored at 0%/50%/100%, so its value at 25%/75% here is what CSS's
 * missing-property interpolation would already produce there. `samplePhase`
 * eases each segment with a smoothstep rather than `caWalk`'s own `linear`
 * timing function, so this is the intent of the fallback body-mechanic, not a
 * pixel-identical replay of it — the same honest limitation `sampleAction`
 * already documents for gestures.
 */
const LOCO_FALLBACK_POSES: Record<'walk' | 'fly', readonly PhaseKey[]> = {
  walk: [
    { at: 0, pose: { y: 0, rot: -2 } },
    { at: 0.25, pose: { y: -4, rot: 0 } },
    { at: 0.5, pose: { y: 0, rot: 2 } },
    { at: 0.75, pose: { y: -4, rot: 0 } },
  ],
  fly: [
    { at: 0, pose: { y: -3 } },
    { at: 0.5, pose: { y: 3 } },
  ],
}

/**
 * The art cache key. A full re-render happens only when this changes.
 *
 * `intensity` is deliberately **absent**: it drives squint and widen, and those
 * are now live rig hooks (`.eyeG` scale and `.lidLo` ry) rather than baked
 * geometry. Including it meant an interpolated intensity sweep re-rendered the
 * whole SVG several times on the way. Exported so that invariant is directly
 * testable.
 */
export function artKeyOf(f: ActorFrame): string {
  return `${f.character}|${f.emotion}|${f.facing}`
}

let cssInjected = false
function ensureCSS(doc: Document): void {
  if (cssInjected) return
  const style = doc.createElement('style')
  style.setAttribute('data-pixel-wizards-charachters', '')
  style.textContent = RIG_CSS
  doc.head.appendChild(style)
  cssInjected = true
}

export interface RigOptions {
  size?: number
  /** disable the random blink loop */
  blink?: boolean
  /** per-emotion tuning — overrides any channel of any emotion preset */
  emotions?: EmotionOverrides
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
  onFrame?: (frame: ActorFrame) => void
  /**
   * Called once with the final frame when every channel has arrived — the
   * debounced companion to {@link RigOptions.onFrame}, for work too expensive
   * to do per tick.
   *
   * Fires on the tick the last channel lands, and on `finish()` / reduced
   * motion / an unmounted rig, where arrival is immediate. An `apply()` that
   * changes nothing does not fire it: there was no transition to settle.
   */
  onSettled?: (frame: ActorFrame) => void
  /**
   * A gesture was refused rather than played. Only `semantic` refusals reach
   * here — a character that merely lacks the limb plays its whole-body
   * fallback, which is a performance, not a failure. A driver that asks for a
   * jump mid-flight gets nothing, and this is how it finds out.
   */
  onGestureBlocked?: (gesture: Gesture, reason: 'semantic') => void
  /**
   * A frame named an emotion, viseme or gesture that does not exist. The rig
   * kept what it was already doing (see `src/validate.ts`) instead of throwing;
   * this is how a driver finds out it is sending a name the library cannot use.
   *
   * Fires once per bad channel, per `apply()`. Throwing from inside restores
   * the old fail-fast behaviour, which is a reasonable thing for a test suite
   * to do.
   */
  onInvalidFrame?: OnInvalidFrame
  /** idle micro-motion tuning; `{ amount: 0 }` disables it */
  micro?: MicroConfig
  /** per-channel easing overrides; see {@link DEFAULT_PROFILE} */
  interpolation?: InterpolationProfile
  /**
   * Override `prefers-reduced-motion` instead of reading it from the OS.
   *
   * `'auto'` (the default) is the OS media query, exactly as before. `true`/
   * `false` force the rig into or out of reduced motion regardless of it — for
   * a consuming app's own accessibility setting, or for a test/demo that wants
   * to show reduced motion without depending on the environment's OS state.
   *
   * Read once, in {@link ActorRig.mount}, the same as the OS query always was:
   * changing this option on an already-mounted rig has no effect. See the
   * README's accessibility section for what "reduced" means per feature.
   */
  reducedMotion?: boolean | 'auto'
  /**
   * Motion-engine overrides for this rig, layered over the character's own
   * `CharacterSpec.motion` and `DEFAULT_MOTION`. `false` on any driver turns it
   * off; `{ secondary: false, attention: false, body: false, depth: false }`
   * restores the pre-engine rig exactly. Change it live with
   * {@link ActorRig.setMotion}.
   */
  motion?: MotionOverrides
}

let rigSeq = 0

/**
 * Give every gradient id this rig's own suffix, and every reference to it.
 *
 * Gradient ids are authored per character (`fxH`, `avS`), so two rigs showing
 * the same character put two identical ids in one document, and `url(#fxH)`
 * resolves to whichever came first — harmless while both were identical, wrong
 * the moment depth shading moves one of them. Only ids declared inside
 * `<defs>` are touched, so `#mouthG` keeps its name.
 */
function namespaceIds(html: string, suffix: string): string {
  const defs = /<defs>([\s\S]*?)<\/defs>/.exec(html)?.[1] ?? ''
  for (const m of defs.matchAll(/\sid="([^"]+)"/g)) {
    const id = m[1]!
    const to = `${id}-${suffix}`
    html = html
      .split(`id="${id}"`).join(`id="${to}"`)
      .split(`url(#${id})`).join(`url(#${to})`)
      .split(`href="#${id}"`).join(`href="#${to}"`)
  }
  return html
}

/** A CSS gesture in flight, kept so the motion engine can see it. */
interface CssGesture {
  target: MotionTarget
  action: TimedAction
  start: number
}

/** `'lyr-head'` → `'head'`, `'rig-body'` → `'body'`. */
function gestureTarget(cls: string): MotionTarget | null {
  if (cls === 'rig-body') return 'body'
  if (cls === 'rig-root') return 'root'
  return cls.startsWith('lyr-') ? (cls.slice(4) as LayerName) : null
}

/** Where a composed transform can be written. */
type TransformTarget = LayerName | 'root' | 'body'

/**
 * `prefers-reduced-motion` is enforced in CSS for keyframe animations, but the
 * micro-motion loop is JS and would sail straight past it.
 */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A live character puppet bound to a DOM element. Render once, then feed it
 * {@link ActorFrame}s (from an AI, a timeline, or UI controls) and it mutates
 * in place — gaze, brows, mouth, blink, posture, body motion and gestures —
 * only doing a full re-render when the art itself changes.
 */
export class ActorRig {
  spec: CharacterSpec
  frame: ActorFrame
  private opts: RigOptions
  private host: HTMLElement | null = null
  private svg: SVGSVGElement | null = null
  private mouthG: SVGElement | null = null
  private irises: SVGElement[] = []
  private browsG: SVGElement | null = null
  private lids: SVGElement[] = []
  private lidsLo: SVGElement[] = []
  private eyeGs: SVGElement[] = []
  private root: SVGElement | null = null
  private mood: SVGElement | null = null
  private layers: Partial<Record<LayerName, SVGElement>> = {}
  private blinkTimer: ReturnType<typeof setTimeout> | null = null
  private speakTimer: ReturnType<typeof setTimeout> | null = null
  private lastArtKey = ''
  /** per target, per source — composed into one transform each tick */
  private contrib = new Map<TransformTarget, Map<string, Pose>>()
  /** the current idle-saccade offset, in gaze units; see {@link updateGaze} */
  private saccade = { x: 0, y: 0 }
  private micro: IdleMicroMotion
  private interp: FrameInterpolator
  private loco = new LocomotionDriver()
  /** whether onSettled has already fired for the current goal */
  private settledFired = true
  /** the gesture currently playing, so a re-sync doesn't restart it */
  private lastGesture: Gesture | null = null
  private raf: number | null = null
  private lastTick = 0
  private reduced = false
  /** a pinned gait phase, or null to let the cycle run; see {@link pinGaitPhase} */
  private pinnedPhase: number | null = null
  private motionOverrides: MotionOverrides | undefined
  private engine: MotionEngine
  /** CSS gestures in flight — invisible to JS otherwise; see {@link basePose} */
  private cssGestures: CssGesture[] = []
  /** the CSS loco fallback on `.rig-root`, and when it started */
  private rootLoco: { loco: 'walk' | 'fly'; dur: number; start: number } | null = null
  private rootAnim = ''
  /** gestures currently held by {@link scrubGesture} */
  private scrubbing = new Set<Gesture>()
  /** how far the face is slid across its parent by depth, art units */
  private faceX = 0
  private grads: { el: Element; base: number; orig: string | null }[] = []
  private lastShade = 0
  private readonly uid = `r${++rigSeq}`

  constructor(spec: CharacterSpec, opts: RigOptions = {}) {
    this.spec = spec
    this.opts = { blink: true, size: 160, ...opts }
    this.frame = defaultFrame(spec.slug)
    this.micro = new IdleMicroMotion(opts.micro)
    this.interp = new FrameInterpolator(this.frame, opts.interpolation)
    this.engine = new MotionEngine(resolveMotion(spec.motion, opts.motion))
  }

  /** The motion-engine settings in effect, after every override level. */
  get motion(): MotionSettings {
    return this.engine.settings
  }

  /**
   * Retune the motion engine live, layered over the character's and the
   * options' settings. `undefined` drops the live level. Spring state carries
   * over, so a change of stiffness mid-wobble does not jump.
   */
  setMotion(overrides?: MotionOverrides): void {
    this.motionOverrides = overrides
    this.engine.settings = resolveMotion(this.spec.motion, this.opts.motion, overrides)
    this.markSpringLayers()
    this.settleMotionIfStill()
  }

  /** The frame as last requested, before easing. */
  get goal(): ActorFrame {
    return this.interp.goal
  }

  /** True while any channel is still travelling toward the goal. */
  get settling(): boolean {
    return this.interp.settling
  }

  /** Land every channel on its goal immediately — scene cuts, tests. */
  finish(): void {
    this.interp.finish()
    this.frame = this.interp.current
    this.syncFrame()
    // "Arrive now" includes the springs, or a finish() mid-wobble would still
    // be wobbling.
    this.tickMotion(0, true)
    this.flushTransforms()
  }

  /** Mount into a host element and start the idle + blink loops. */
  mount(host: HTMLElement): this {
    ensureCSS(host.ownerDocument)
    this.host = host
    const rm = this.opts.reducedMotion ?? 'auto'
    this.reduced = rm === 'auto' ? prefersReducedMotion() : rm
    this.render()
    if (this.opts.blink && !this.reduced) this.scheduleBlink()
    if (!this.reduced) this.startLoop()
    return this
  }

  /**
   * One animation loop for every procedural channel. Idle micro-motion writes
   * its contribution, then every dirty target is recomposed and written once —
   * so breathing and posture stack instead of overwriting each other.
   */
  private startLoop(): void {
    if (this.raf !== null || typeof requestAnimationFrame !== 'function') return
    this.lastTick = performance.now()
    const step = (now: number): void => {
      const dtMs = Math.min(now - this.lastTick, 100)
      this.lastTick = now
      // Checked *before* ticking so the tick that lands the last channel still
      // gets rendered; afterwards `settling` is false and the frame work is
      // skipped entirely rather than recomputed forever on a static pose.
      if (this.interp.settling) {
        this.frame = this.interp.tick(dtMs)
        this.syncFrame()
      }
      // Locomotion and micro-motion run regardless — a settled character still
      // walks and breathes. Both share this one clock, which is the point:
      // under CSS they were separate animations that drifted out of step.
      this.tickLocomotion(dtMs / 1000)
      const m = this.micro.tick(dtMs / 1000, this.frame)
      this.setContribution('torso', 'micro', m.torso)
      this.setContribution('head', 'micro', m.head)
      // Saccades are not a transform target, so they are written here rather
      // than composed: the iris carries a `transform` of its own that gaze owns
      // outright. Held on the instance so `updateGaze` — which also runs from
      // `syncFrame`, off this loop — sees the same value.
      this.saccade = m.gaze
      this.tickMotion(dtMs / 1000)
      this.updateGaze()
      this.flushTransforms()
      this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
  }

  /**
   * Record one source's contribution to a target. Falls back from `torso` to
   * `body` so characters not yet converted to layers still breathe.
   */
  private setContribution(target: TransformTarget, source: string, pose: Pose): void {
    const key = target === 'torso' && !this.layers.torso ? 'body' : target
    let bucket = this.contrib.get(key)
    if (!bucket) {
      bucket = new Map()
      this.contrib.set(key, bucket)
    }
    bucket.set(source, pose)
  }

  private targetEl(t: TransformTarget): SVGElement | null {
    if (t === 'root') return this.root
    if (t === 'body') return this.svg?.querySelector<SVGElement>('.rig-body') ?? null
    return this.layers[t] ?? null
  }

  /** Compose every target's sources and write the result. */
  private flushTransforms(): void {
    for (const [target, sources] of this.contrib) {
      const el = this.targetEl(target)
      if (el) el.style.transform = poseToTransform(composePoses(sources.values()))
    }
  }

  /** Swap to a different character (keeps the current frame's behaviour). */
  setCharacter(spec: CharacterSpec): void {
    this.spec = spec
    this.engine.settings = resolveMotion(spec.motion, this.opts.motion, this.motionOverrides)
    this.apply({ character: spec.slug })
  }

  /**
   * Run the motion engine and stage its output as each target's `motion`
   * contribution. Does not flush; the caller does.
   *
   * `snap` — or any state where motion must hold still or cannot be seen:
   * reduced motion, no loop, a pinned gait, a held scrub — lands every spring
   * on its target, so a frozen frame shows the at-rest pose and never a wobble
   * caught mid-swing.
   */
  private tickMotion(dt: number, snap = false): void {
    if (!this.svg) return
    const still = snap || this.reduced || this.raf === null ||
      this.pinnedPhase !== null || this.scrubbing.size > 0
    const now = this.lastTick
    this.cssGestures = this.cssGestures.filter((g) => now - g.start <= g.action.dur * 1000)
    const out = this.engine.tick(dt, {
      frame: this.frame,
      gaze: this.intentGaze(),
      has: (l) => !!this.layers[l],
      pose: (t) => this.basePose(t),
    }, still)
    for (const bucket of this.contrib.values()) bucket.delete('motion')
    for (const t of Object.keys(out.poses) as MotionTarget[]) {
      this.setContribution(t, 'motion', out.poses[t]!)
    }
    if (out.faceX !== this.faceX) {
      this.faceX = out.faceX
      this.updateEyes()
      this.updateBrow()
      this.updateFace()
    }
    this.updateShade(out.shade)
    if (out.blink && this.opts.blink && !this.reduced) this.blink()
  }

  /** {@link tickMotion} at rest, when nothing else will tick it. */
  private settleMotionIfStill(): void {
    if (this.reduced || this.raf === null) {
      this.tickMotion(0, true)
      this.flushTransforms()
    }
  }

  /**
   * A target's pose from every source except the motion engine — what the
   * springs chase. CSS gestures and the CSS gait fallback do not pass through
   * the contribution table, so they are sampled from the same data that built
   * their keyframes; without that a soft ear would sit rigid through a jump.
   */
  private basePose(t: MotionTarget): Pose {
    const key = t === 'torso' && !this.layers.torso ? 'body' : t
    const parts: Pose[] = []
    const bucket = this.contrib.get(key)
    if (bucket) for (const [src, p] of bucket) if (src !== 'motion') parts.push(p)
    const now = this.lastTick
    for (const g of this.cssGestures) {
      if (g.target !== t) continue
      const u = (now - g.start) / (g.action.dur * 1000)
      if (u >= 0 && u <= 1) parts.push(sampleAction(g.action, u))
    }
    if (t === 'root' && this.rootLoco) {
      const r = this.rootLoco
      parts.push(samplePhase(LOCO_FALLBACK_POSES[r.loco], wrapPhase((now - r.start) / 1000 / r.dur)))
    }
    return composePoses(parts)
  }

  /** Where the eyes are told to look: frame gaze plus emotion bias, no saccade. */
  private intentGaze(): { x: number; y: number } {
    const bias = resolveEmotion(this.frame.emotion, this.opts.emotions).gaze
    const k = this.frame.intensity
    const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v)
    return {
      x: clamp(this.frame.gaze.x + (bias?.x ?? 0) * k),
      y: clamp(this.frame.gaze.y + (bias?.y ?? 0) * k),
    }
  }

  /** Tag the layers the secondary springs own, so their CSS transition is off. */
  private markSpringLayers(): void {
    const live = !this.reduced && typeof requestAnimationFrame === 'function'
    const soft = new Set(live ? this.engine.softLayers((l) => !!this.layers[l]) : [])
    for (const [n, el] of Object.entries(this.layers) as [LayerName, SVGElement][]) {
      el.classList.toggle('ca-spring', soft.has(n))
    }
  }

  /** The mouth rides the face slide; see {@link tickMotion}. */
  private updateFace(): void {
    if (this.mouthG) this.mouthG.style.transform = this.faceX ? `translate(${this.faceX.toFixed(3)}px,0px)` : ''
    for (const lid of this.lids) {
      const cx = Number(lid.getAttribute('data-cx')) + this.faceX
      const cy = lid.getAttribute('cy')
      lid.setAttribute('cx', cx.toFixed(3))
      lid.style.transformOrigin = `${cx.toFixed(3)}px ${cy}px`
    }
  }

  /**
   * Slide each radial gradient's highlight against the turn: as the body yaws
   * toward the light it catches it on the far side. The authored `cx` is the
   * yaw-0 value and is restored verbatim at 0.
   */
  private updateShade(yaw: number): void {
    const d = this.engine.settings.depth
    const amt = d ? d.shade : 0
    const v = Math.round(yaw * amt * 100) / 100
    if (v === this.lastShade) return
    this.lastShade = v
    for (const g of this.grads) {
      if (v === 0) {
        if (g.orig === null) g.el.removeAttribute('cx')
        else g.el.setAttribute('cx', g.orig)
      } else {
        g.el.setAttribute('cx', `${(g.base - v).toFixed(2)}%`)
      }
    }
  }

  /**
   * Retune the emotion presets live. Overrides don't change the art key, so we
   * force a full re-render (the squint/widen/brow are baked into the art), then
   * re-apply the live channels. Used by editor UIs for instant preview.
   */
  setEmotions(emotions?: EmotionOverrides): void {
    this.opts.emotions = emotions
    this.lastArtKey = ''
    this.syncFrame()
  }

  /** Full render — only when the drawn art changes. Re-caches rig hooks. */
  private render(): void {
    if (!this.host) return
    this.host.innerHTML = namespaceIds(
      renderActorSVG(this.spec, this.frame, this.opts.size, this.opts.emotions), this.uid)
    this.svg = this.host.querySelector('svg')
    if (!this.svg) return
    this.svg.classList.add('ca-svg')
    this.svg.classList.toggle('ca-reduced', this.reduced)
    this.mouthG = this.svg.querySelector('#mouthG')
    this.irises = Array.from(this.svg.querySelectorAll('.iris'))
    this.lidsLo = Array.from(this.svg.querySelectorAll('.lidLo'))
    this.eyeGs = Array.from(this.svg.querySelectorAll('.eyeG'))
    this.browsG = this.svg.querySelector('.browsG')
    this.root = this.svg.querySelector('.rig-root')
    this.mood = this.svg.querySelector('.rig-mood')
    this.layers = {}
    for (const n of ['shadow', 'accBack', 'tail', 'farArm', 'farLeg', 'torso',
      'nearLeg', 'nearArm', 'earL', 'earR', 'head', 'torsoFront', 'accFront'] as LayerName[]) {
      const el = this.svg.querySelector<SVGElement>(`.lyr-${n}`)
      if (el) this.layers[n] = el
    }
    // Shading: only percentage (or default 50%) centres can be slid; a
    // userSpaceOnUse gradient in absolute units is left exactly as authored.
    this.grads = []
    for (const el of Array.from(this.svg.querySelectorAll('defs radialGradient'))) {
      const orig = el.getAttribute('cx')
      const m = orig === null ? ['', '50'] : /^(-?[\d.]+)%$/.exec(orig)
      if (m) this.grads.push({ el, base: Number(m[1]), orig })
    }
    this.lastShade = 0
    this.faceX = 0
    this.rootAnim = ''
    this.rootLoco = null
    this.injectLids()
    this.markSpringLayers()
    this.lastArtKey = this.artKey(this.frame)
  }

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
  private injectLids(): void {
    if (!this.svg) return
    const eyeParent = this.eyeGs[0]?.parentNode as SVGElement | null | undefined
    const parent = eyeParent ?? this.layers.head ?? this.svg.querySelector<SVGElement>('.rig-flip') ?? this.svg
    const ns = 'http://www.w3.org/2000/svg'
    const { x, y, r } = this.spec.eyes
    this.lids = x.map((cx) => {
      const el = document.createElementNS(ns, 'ellipse')
      el.setAttribute('class', 'blinkLid')
      el.setAttribute('cx', String(cx))
      el.setAttribute('data-cx', String(cx))
      el.setAttribute('cy', String(y))
      el.setAttribute('rx', String(r * 1.3))
      el.setAttribute('ry', String(r * 1.5))
      el.setAttribute('fill', this.spec.lidColor)
      el.style.transformOrigin = `${cx}px ${y}px`
      parent.appendChild(el)
      return el as unknown as SVGElement
    })
  }

  private artKey(f: ActorFrame): string {
    return artKeyOf(f)
  }

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
  private updateEyes(): void {
    const e = resolveEmotion(this.frame.emotion, this.opts.emotions)
    const k = Math.max(0, Math.min(1, this.frame.intensity))
    const squint = e.squint * k
    const wide = e.wide * k
    const s = eyeWidenScale(wide)
    for (const g of this.eyeGs) {
      const cx = Number(g.getAttribute('data-cx'))
      const cy = Number(g.getAttribute('data-cy'))
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue
      // The face slide goes outside the widen, so the eye scales about its own
      // centre wherever it has slid to. Omitted at 0 to keep the plain form.
      const slide = this.faceX ? `translate(${this.faceX.toFixed(3)} 0) ` : ''
      g.setAttribute('transform', slide + eyeWidenTransform(cx, cy, s))
    }
    for (const lid of this.lidsLo) {
      const r = Number(lid.getAttribute('data-lr'))
      if (!Number.isFinite(r) || r <= 0) continue
      lid.setAttribute('ry', eyeLidRy(r, squint, wide).toFixed(3))
    }
  }

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
  apply(frame: Partial<ActorFrame>): void {
    // Before anything else: a name the library does not have would otherwise
    // reach a lookup deep in render() and throw there, losing the whole
    // performance to one bad word.
    this.interp.target(sanitizeFrame(frame, this.frame, this.opts.onInvalidFrame))
    if (this.interp.settling) this.settledFired = false
    if (this.reduced || this.raf === null) this.interp.finish()
    this.frame = this.interp.current
    this.syncFrame()
  }

  /** Push the current (already eased) frame into the DOM. */
  private syncFrame(): void {
    const key = this.artKey(this.frame)
    if (key !== this.lastArtKey) this.render()
    this.updateMouth()
    this.updateGaze()
    this.updateBrow()
    this.updateEyes()
    this.updatePosture()
    this.updateMotion()
    this.settleMotionIfStill()
    this.opts.onFrame?.(this.frame)
    // Armed by apply(), so arrival fires exactly once per transition — and an
    // apply() that changes nothing never arms it at all.
    if (!this.interp.settling && !this.settledFired) {
      this.settledFired = true
      this.opts.onSettled?.(this.frame)
    }
  }

  private updateMouth(): void {
    if (!this.mouthG) return
    const spec = this.spec.render({
      emotion: resolveEmotion(this.frame.emotion, this.opts.emotions),
      intensity: this.frame.intensity,
    })
    this.mouthG.innerHTML = drawMouth(spec.mouth, VISEMES[this.frame.viseme], this.frame.mouthOpen)
  }

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
  private updateGaze(): void {
    const { r } = this.spec.eyes
    const bias = resolveEmotion(this.frame.emotion, this.opts.emotions).gaze
    const k = this.frame.intensity
    const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v)
    const gx = clamp(this.frame.gaze.x + (bias?.x ?? 0) * k + this.saccade.x)
    const gy = clamp(this.frame.gaze.y + (bias?.y ?? 0) * k + this.saccade.y)
    const dx = gx * r * 0.5
    const dy = gy * r * 0.5
    for (const iris of this.irises) iris.style.transform = `translate(${dx}px,${dy}px)`
  }

  private updateBrow(): void {
    if (!this.browsG) return
    const y = -this.frame.browRaise * 5
    // translateY stays its own function whatever the slide, so the vertical
    // channel keeps one spelling for anything that reads it back.
    const slide = this.faceX ? `translateX(${this.faceX.toFixed(3)}px) ` : ''
    this.browsG.style.transform = `${slide}translateY(${y}px)`
  }

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
  private updatePosture(): void {
    const p = resolvePosture(this.frame.emotion, this.frame.intensity, this.spec.posture)
    this.setContribution('torso', 'posture', { y: p.sink, rot: p.spine })
    this.setContribution('head', 'posture', { y: p.headDrop, rot: p.headTilt })
    // Ears mirror: positive `ears` droops both outward and down.
    this.setContribution('earL', 'posture', { rot: -p.ears })
    this.setContribution('earR', 'posture', { rot: p.ears })
    this.setContribution('tail', 'posture', { rot: p.tail })
    this.setContribution('farArm', 'posture', { rot: p.arms })
    this.setContribution('nearArm', 'posture', { rot: -p.arms })
    // Write immediately: when the loop is off (reduced motion, SSR-ish hosts)
    // posture is still a held pose that must land.
    this.flushTransforms()
  }

  private updateMotion(): void {
    if (!this.svg) return
    const speed = Math.max(0.3, this.frame.speed)
    const mood = MOOD_ANIM[this.frame.emotion]
    if (this.mood) {
      this.mood.style.animation = mood
        ? `${mood.name} ${(mood.dur / speed).toFixed(2)}s ease-in-out ${mood.once ? '1' : 'infinite'}`
        : ''
    }
    const loco = LOCO_ANIM[this.frame.locomotion]
    if (this.root) {
      // The CSS body animation is the *fallback*. A phase-driven character gets
      // its bob from the gait table instead; leaving this on would double it,
      // and a running animation would outrank the driver's inline transform.
      const css = loco && this.drivenGait() === null
      const animation = css ? `${loco.name} ${(loco.dur / speed).toFixed(2)}s linear infinite` : ''
      // Compared against what was last *assigned*, not read back: the style
      // object may normalise the shorthand and would restart the clock.
      if (animation !== this.rootAnim) {
        this.rootAnim = animation
        const l = this.frame.locomotion
        this.rootLoco = css && (l === 'walk' || l === 'fly')
          ? { loco: l, dur: loco.dur / speed, start: this.lastTick }
          : null
      }
      this.root.style.animation = animation
    }
    // The classes stay on for every character: they are the state marker
    // consumers style against, and the hook the unlayered wing rules need.
    this.svg.classList.toggle('loco-fly', this.frame.locomotion === 'fly')
    this.svg.classList.toggle('loco-walk', this.frame.locomotion === 'walk')
    this.svg.classList.toggle('loco-roll', this.frame.locomotion === 'roll')
    // syncFrame runs every tick of a transition, so only a *change* of gesture
    // starts one — otherwise the animation would restart 60 times a second.
    const g = this.frame.gesture
    if (g && g !== this.lastGesture) this.playGesture(g)
    this.lastGesture = g
  }

  /**
   * Which gait the phase driver is handling this frame, or null if the
   * character has no limb layers for it (fallback) or is idle.
   *
   * Exposed on the instance rather than inlined so the fallback decision has
   * exactly one definition — the render path and the CSS gate must never
   * disagree about it.
   */
  private drivenGait(): GaitName | null {
    const l = this.frame.locomotion
    if (l !== 'walk' && l !== 'fly' && l !== 'roll') return null
    // Structural capability *and* declared eligibility — see `drivesGait`.
    const has = (t: LocoTarget) => t === 'root' || t === 'torso' || !!this.layers[t]
    return drivesGait(l, has, this.spec.gaits) ? l : null
  }

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
  pinGaitPhase(phase: number | null): 'phase' | 'css' | 'none' {
    this.pinnedPhase = phase === null ? null : wrapPhase(phase)
    const driven = this.drivenGait()
    if (this.root) {
      if (driven === null && phase !== null && this.frame.locomotion !== 'idle') {
        const loco = this.frame.locomotion
        if (this.reduced && (loco === 'walk' || loco === 'fly')) {
          this.root.style.animationDelay = ''
          this.root.style.animationPlayState = ''
          this.root.style.transform = poseToTransform(samplePhase(LOCO_FALLBACK_POSES[loco], this.pinnedPhase as number))
          return 'css'
        }
        // The CSS-fallback case. `animation-delay` is negative on purpose: it
        // starts the animation that far into its own timeline, which — paused —
        // is exactly "show me this frame".
        const dur = this.rootAnimationDuration()
        this.root.style.transform = ''
        this.root.style.animationDelay = `${-phase * dur}s`
        this.root.style.animationPlayState = 'paused'
        return 'css'
      }
      this.root.style.animationDelay = ''
      this.root.style.animationPlayState = ''
      this.root.style.transform = ''
    }
    if (phase !== null && driven !== null) {
      // Publish immediately: a paused rig may not tick again, and a scrub that
      // only takes effect on the next frame reads as a broken control.
      this.loco.phase = this.pinnedPhase as number
      for (const t of LOCO_TARGETS) {
        if (t !== 'root' && t !== 'torso' && !this.layers[t]) continue
        this.setContribution(t, 'loco', this.loco.pose(t))
      }
      this.tickMotion(0, true)
      this.flushTransforms()
      return 'phase'
    }
    return driven === null && this.frame.locomotion === 'idle' ? 'none' : 'phase'
  }

  /** The duration the CSS body-gait rule runs for, read off the rule the rig set. */
  private rootAnimationDuration(): number {
    const m = /\s([\d.]+)s/.exec(this.root?.style.animation ?? '')
    return m?.[1] ? Number(m[1]) : 1
  }

  /** Advance the gait cycle and publish one pose per driven layer. */
  private tickLocomotion(dt: number): void {
    const gait = this.drivenGait()
    this.loco.advance(dt, gait, Math.max(0.3, this.frame.speed))
    // A pinned phase overrides whatever the advance produced. Advancing first
    // and then overwriting — rather than skipping the advance — keeps the
    // driver's own state consistent, so releasing the pin resumes from where
    // the scrub left off instead of snapping back.
    if (this.pinnedPhase !== null && gait !== null) this.loco.phase = this.pinnedPhase
    // Written every tick including idle, where the driver returns identity:
    // that is what clears the last stride's pose when the character stops.
    for (const t of LOCO_TARGETS) {
      if (t !== 'root' && t !== 'torso' && !this.layers[t]) continue
      this.setContribution(t, 'loco', this.loco.pose(t))
    }
  }

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
  playGesture(g: Gesture): void {
    if (!this.svg) return
    const svg = this.svg
    const plan = this.planFor(g)
    if (plan === null) return
    if (plan.mode === 'blocked') {
      // Refused, not deferred — but the channel must still clear, or the frame
      // holds a gesture that will never play and the next apply() of the same
      // gesture would be a no-op change.
      this.clearGesture(g)
      this.opts.onGestureBlocked?.(g, plan.reason)
      return
    }
    if (this.reduced) {
      this.clearGesture(g)
      return
    }

    const suffix = plan.mode === 'fallback' ? '_fb' : ''
    const started: { el: SVGElement; animation: string }[] = []
    let dur = 0
    for (const part of plan.parts) {
      const el = svg.querySelector<SVGElement>(`.${part.layer}`)
      if (!el) continue
      const name = `caG_${g}_${part.layer}${suffix}`
      const animation = ensureAction(svg.ownerDocument, name, part.action)
      // Restart even if the same gesture is still playing.
      el.style.animation = 'none'
      void el.getBoundingClientRect()
      el.style.animation = animation
      started.push({ el, animation })
      dur = Math.max(dur, part.action.dur)
      const target = gestureTarget(part.layer)
      if (target) {
        this.cssGestures = this.cssGestures.filter((c) => c.target !== target)
        this.cssGestures.push({ target, action: part.action, start: this.lastTick })
      }
    }
    if (!started.length) return

    window.setTimeout(() => {
      for (const { el, animation } of started) {
        if (el.style.animation === animation) el.style.animation = ''
      }
      this.clearGesture(g)
    }, dur * 1000)
  }

  /**
   * How this gesture would play right now — which layers, or why not.
   *
   * Shared by {@link playGesture} and {@link scrubGesture} so the two can never
   * disagree about routing. A studio that resolved the plan itself would be a
   * fourth copy of that decision, and the whole point of scrubbing is to watch
   * the thing that actually ships.
   */
  planFor(g: Gesture): GesturePlan | null {
    const svg = this.svg
    if (!svg) return null
    // `playGesture('dab')` reaches here without passing through `apply()`, so
    // the same courtesy has to be extended here: no plan rather than a throw.
    if (!isKnownGesture(g)) {
      this.opts.onInvalidFrame?.({ channel: 'gesture', value: g, kept: null })
      return null
    }
    return planGesture(
      g,
      this.frame.locomotion,
      this.drivenGait(),
      (layer) => !!svg.querySelector(`.${layer}`),
      this.spec.gestureFallback,
    )
  }

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
  scrubGesture(g: Gesture, t: number | null): GesturePlan | null {
    const svg = this.svg
    if (!svg) return null
    const plan = this.planFor(g)
    if (plan === null || plan.mode === 'blocked') return plan
    if (t === null) this.scrubbing.delete(g)
    else this.scrubbing.add(g)

    const suffix = plan.mode === 'fallback' ? '_fb' : ''
    for (const part of plan.parts) {
      const el = svg.querySelector<SVGElement>(`.${part.layer}`)
      if (!el) continue
      if (t === null) {
        el.style.animation = ''
        el.style.animationDelay = ''
        el.style.animationPlayState = ''
        el.style.transform = ''
        continue
      }
      const clamped = Math.max(0, Math.min(1, t))
      if (this.reduced) {
        el.style.animation = ''
        el.style.animationDelay = ''
        el.style.animationPlayState = ''
        el.style.transform = poseToTransform(sampleAction(part.action, clamped))
        continue
      }
      const name = `caG_${g}_${part.layer}${suffix}`
      el.style.transform = ''
      el.style.animation = ensureAction(svg.ownerDocument, name, part.action)
      el.style.animationDelay = `${-clamped * part.action.dur}s`
      el.style.animationPlayState = 'paused'
    }
    // A held frame shows the springs at rest, not frozen mid-swing. Staged
    // only: a flush here would overwrite the sampled pose written above.
    this.tickMotion(0, true)
    return plan
  }

  /**
   * Release the gesture channel — through the interpolator, which owns it.
   * Writing `this.frame` directly would be undone by the next tick.
   */
  private clearGesture(g: Gesture): void {
    if (this.interp.goal.gesture === g) this.apply({ gesture: null })
  }

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
  speak(text: string, perViseme = 85): void {
    if (this.speakTimer) clearTimeout(this.speakTimer)
    const seq = textToVisemes(text)
    let i = 0
    const step = (): void => {
      if (i >= seq.length) {
        this.apply({ viseme: 'rest', mouthOpen: 0 })
        return
      }
      this.apply({ viseme: seq[i]!, mouthOpen: 0 })
      i++
      this.speakTimer = setTimeout(step, perViseme)
    }
    step()
  }

  /**
   * Autonomous blinking — rate and lid weight come from the emotion, and a
   * fraction of blinks come in pairs. Both are cheap and both read as alive.
   */
  private scheduleBlink(): void {
    const s = blinkStyle(this.frame.emotion)
    const delay = (s.minGap + Math.random() * (s.maxGap - s.minGap)) * 1000
    this.blinkTimer = setTimeout(() => {
      this.blink()
      if (Math.random() < s.doubleChance) {
        window.setTimeout(() => this.blink(), s.dur * 1000 + 90)
      }
      this.scheduleBlink()
    }, delay)
  }

  /** One blink, held for as long as the current emotion's lids are heavy. */
  blink(): void {
    const dur = blinkStyle(this.frame.emotion).dur * 1000
    for (const l of this.lids) l.classList.add('shut')
    window.setTimeout(() => {
      for (const l of this.lids) l.classList.remove('shut')
    }, dur)
  }

  /** Stop timers and detach. */
  destroy(): void {
    if (this.blinkTimer) clearTimeout(this.blinkTimer)
    if (this.speakTimer) clearTimeout(this.speakTimer)
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.raf = null
    this.contrib.clear()
    this.cssGestures = []
    this.scrubbing.clear()
    this.grads = []
    this.lastGesture = null
    if (this.host) this.host.innerHTML = ''
    this.host = this.svg = this.mouthG = this.browsG = null
    this.root = this.mood = null
    this.irises = []
    this.lids = []
    this.lidsLo = []
    this.eyeGs = []
    this.layers = {}
  }
}

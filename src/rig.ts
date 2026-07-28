import type { ActorFrame, CharacterSpec, Gesture } from './types.js'
import { defaultFrame } from './types.js'
import { renderActorSVG, drawMouth } from './render.js'
import { EMOTIONS } from './emotions.js'
import { VISEMES, textToVisemes } from './visemes.js'

/**
 * CSS the rig needs: body-motion keyframes (one per emotion mood), locomotion
 * cycles, one-shot gestures, blink transition and the owl wing-flap. Injected
 * once per document. Respects `prefers-reduced-motion`.
 */
export const RIG_CSS = `
.ca-svg{display:block;transform-origin:100px 150px;will-change:transform}
.ca-svg .iris{transition:transform .18s cubic-bezier(.3,.7,.3,1)}
.ca-svg .browsG{transition:transform .16s ease}
.ca-svg .blinkLid{transition:transform .09s ease;transform:scaleY(0)}
.ca-svg .blinkLid.shut{transform:scaleY(1)}
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
@keyframes caGWave{0%,100%{transform:rotate(0)}20%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}80%{transform:rotate(-6deg)}}
@keyframes caGJump{0%,100%{transform:translateY(0)}30%{transform:translateY(-22px) scale(1.04)}55%{transform:translateY(0)}70%{transform:translateY(-8px)}}
@keyframes caGSpin{0%{transform:rotateY(0)}100%{transform:rotateY(360deg)}}
@keyframes caWingL{0%,100%{transform:rotate(0)}50%{transform:rotate(-24deg)}}
@keyframes caWingR{0%,100%{transform:rotate(0)}50%{transform:rotate(24deg)}}
@media (prefers-reduced-motion:reduce){.ca-svg,.ca-svg *{animation:none!important}}
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
}

const LOCO_ANIM: Record<string, { name: string; dur: number } | null> = {
  idle: null,
  walk: { name: 'caWalk', dur: 0.5 },
  fly: { name: 'caFly', dur: 1.6 },
}

const GESTURE_ANIM: Record<Gesture, { name: string; dur: number }> = {
  wave: { name: 'caGWave', dur: 0.8 },
  jump: { name: 'caGJump', dur: 0.6 },
  spin: { name: 'caGSpin', dur: 0.7 },
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
  /** callback with the frame after each `apply` */
  onFrame?: (frame: ActorFrame) => void
}

/**
 * A live character puppet bound to a DOM element. Render once, then feed it
 * {@link ActorFrame}s (from an AI, a timeline, or UI controls) and it mutates
 * in place — gaze, brows, mouth, blink, body motion and gestures — only doing a
 * full re-render when the art itself changes (character/emotion/facing).
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
  private blinkTimer: ReturnType<typeof setTimeout> | null = null
  private speakTimer: ReturnType<typeof setTimeout> | null = null
  private lastArtKey = ''

  constructor(spec: CharacterSpec, opts: RigOptions = {}) {
    this.spec = spec
    this.opts = { blink: true, size: 160, ...opts }
    this.frame = defaultFrame(spec.slug)
  }

  /** Mount into a host element and start the blink loop. */
  mount(host: HTMLElement): this {
    ensureCSS(host.ownerDocument)
    this.host = host
    this.render()
    if (this.opts.blink) this.scheduleBlink()
    return this
  }

  /** Swap to a different character (keeps the current frame's behaviour). */
  setCharacter(spec: CharacterSpec): void {
    this.spec = spec
    this.frame.character = spec.slug
    this.render()
    this.apply(this.frame)
  }

  /** Full render — only when the drawn art changes. Re-caches rig hooks. */
  private render(): void {
    if (!this.host) return
    this.host.innerHTML = renderActorSVG(this.spec, this.frame, this.opts.size)
    this.svg = this.host.querySelector('svg')
    if (!this.svg) return
    this.svg.classList.add('ca-svg')
    this.mouthG = this.svg.querySelector('#mouthG')
    this.irises = Array.from(this.svg.querySelectorAll('.iris'))
    this.browsG = this.svg.querySelector('.browsG')
    this.injectLids()
    this.lastArtKey = this.artKey(this.frame)
  }

  /** Blink lids over each eye, positioned from the spec's eye anchors. */
  private injectLids(): void {
    if (!this.svg) return
    const ns = 'http://www.w3.org/2000/svg'
    const { x, y, r } = this.spec.eyes
    this.lids = x.map((cx) => {
      const el = document.createElementNS(ns, 'ellipse')
      el.setAttribute('class', 'blinkLid')
      el.setAttribute('cx', String(cx))
      el.setAttribute('cy', String(y))
      el.setAttribute('rx', String(r * 1.3))
      el.setAttribute('ry', String(r * 1.5))
      el.setAttribute('fill', this.spec.lidColor)
      el.style.transformOrigin = `${cx}px ${y}px`
      this.svg!.appendChild(el)
      return el as unknown as SVGElement
    })
  }

  private artKey(f: ActorFrame): string {
    return `${f.character}|${f.emotion}|${Math.round(f.intensity * 4)}|${f.facing}`
  }

  /** Apply a frame. Re-renders only if the art changed; else mutates live. */
  apply(frame: Partial<ActorFrame>): void {
    this.frame = { ...this.frame, ...frame }
    const key = this.artKey(this.frame)
    if (key !== this.lastArtKey) this.render()
    this.updateMouth()
    this.updateGaze()
    this.updateBrow()
    this.updateMotion()
    this.opts.onFrame?.(this.frame)
  }

  private updateMouth(): void {
    if (!this.mouthG) return
    const spec = this.spec.render({
      emotion: EMOTIONS[this.frame.emotion],
      intensity: this.frame.intensity,
    })
    this.mouthG.innerHTML = drawMouth(spec.mouth, VISEMES[this.frame.viseme], this.frame.mouthOpen)
  }

  private updateGaze(): void {
    const { r } = this.spec.eyes
    const dx = this.frame.gaze.x * r * 0.5
    const dy = this.frame.gaze.y * r * 0.5
    for (const iris of this.irises) iris.style.transform = `translate(${dx}px,${dy}px)`
  }

  private updateBrow(): void {
    if (this.browsG) this.browsG.style.transform = `translateY(${-this.frame.browRaise * 5}px)`
  }

  private updateMotion(): void {
    if (!this.svg) return
    const speed = Math.max(0.3, this.frame.speed)
    const anims: string[] = []
    const mood = MOOD_ANIM[this.frame.emotion]
    if (mood) anims.push(`${mood.name} ${(mood.dur / speed).toFixed(2)}s ease-in-out ${mood.once ? '1' : 'infinite'}`)
    const loco = LOCO_ANIM[this.frame.locomotion]
    if (loco) anims.push(`${loco.name} ${(loco.dur / speed).toFixed(2)}s linear infinite`)
    this.svg.style.animation = anims.join(', ')
    this.svg.classList.toggle('loco-fly', this.frame.locomotion === 'fly')
    if (this.frame.gesture) this.playGesture(this.frame.gesture)
  }

  /** Play a one-shot gesture on top of the current motion, then release it. */
  playGesture(g: Gesture): void {
    if (!this.svg) return
    const spec = GESTURE_ANIM[g]
    const base = this.svg.style.animation
    this.svg.style.animation = `${spec.name} ${spec.dur}s ease, ${base}`
    window.setTimeout(() => {
      if (this.svg) this.svg.style.animation = base
      if (this.frame.gesture === g) this.frame.gesture = null
    }, spec.dur * 1000)
  }

  /**
   * Speak a Persian string: drive the mouth through its viseme sequence, then
   * return to rest. `perViseme` is the ms each shape holds.
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

  private scheduleBlink(): void {
    const delay = 1600 + Math.random() * 3600
    this.blinkTimer = setTimeout(() => {
      this.blink()
      this.scheduleBlink()
    }, delay)
  }

  /** One blink. */
  blink(): void {
    if (this.frame.emotion === 'sleepy') return
    for (const l of this.lids) l.classList.add('shut')
    window.setTimeout(() => {
      for (const l of this.lids) l.classList.remove('shut')
    }, 110)
  }

  /** Stop timers and detach. */
  destroy(): void {
    if (this.blinkTimer) clearTimeout(this.blinkTimer)
    if (this.speakTimer) clearTimeout(this.speakTimer)
    if (this.host) this.host.innerHTML = ''
    this.host = this.svg = this.mouthG = this.browsG = null
    this.irises = []
    this.lids = []
  }
}

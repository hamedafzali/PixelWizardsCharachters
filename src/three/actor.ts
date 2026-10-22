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

import * as THREE from 'three'
import type { ActorFrame, CharacterSpec, Gesture, PlayGestureOptions } from '../types.js'
import type { MotionOverrides, MotionSettings } from '../motion.js'
import { ActorRig, watchReducedMotion } from '../rig.js'
import { knownCharacter } from '../validate.js'
import { ActorModel, type ActorModelOptions } from './model.js'
import { skinModel, type SkinOptions } from './skin.js'

export interface ThreeActorOptions extends Omit<ActorModelOptions, 'reducedMotion'> {
  /** canvas size in CSS pixels, square; default 240 */
  size?: number
  /** `'auto'` (default) follows `prefers-reduced-motion`, including changes after mount */
  reducedMotion?: boolean | 'auto'
  /** scene background; default transparent */
  background?: string | null
  /** device-pixel-ratio cap; default 2 */
  maxPixelRatio?: number
  /**
   * Dress the model in the character's own 2D art, inflated (see `skinModel`).
   * Default on; `false` shows the bare `body3d` primitives.
   */
  skin?: boolean | SkinOptions
  /**
   * When no WebGL context can be created (old devices, a blocked GPU, headless
   * browsers), mount the SVG `ActorRig` in the same host instead, and send
   * every call to it. Default on. `false` makes `mount` throw the context
   * error, with nothing left in the host, for an app with its own fallback.
   */
  fallback?: boolean
  /** Called once, with the context error, when `mount` falls back to the SVG rig. */
  onFallback?: (error: unknown) => void
}

/** The camera frames the 200×200 art box, as the SVG viewBox does. */
const FRAME = 200

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export class ThreeActor {
  private spec: CharacterSpec
  private opts: ThreeActorOptions
  private model: ActorModel | null = null
  private webgl: THREE.WebGLRenderer | null = null
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private host: HTMLElement | null = null
  /** the SVG stand-in, when mount found no WebGL; see {@link ThreeActorOptions.fallback} */
  private svgRig: ActorRig | null = null
  private raf: number | null = null
  private last = 0
  /** applied before mount, replayed once the model exists */
  private early: Partial<ActorFrame> = {}
  /** bumped per build, so a skin still loading for a replaced model is dropped */
  private generation = 0
  /** stops following the OS reduced-motion setting */
  private unwatchReduced: (() => void) | null = null

  constructor(spec: CharacterSpec, opts: ThreeActorOptions = {}) {
    this.spec = spec
    this.opts = { size: 240, maxPixelRatio: 2, background: null, ...opts }
    // A long lens and a far camera: close to the SVG's flat projection, so the
    // 2D and 3D renders of a character line up, with enough perspective to
    // read as round.
    const fov = 22
    this.camera = new THREE.PerspectiveCamera(fov, 1, 10, 4000)
    const dist = FRAME / 2 / Math.tan((fov / 2) * Math.PI / 180)
    // Art y 100 (the middle of the box) is world y 88.
    this.camera.position.set(0, 96, dist)
    this.camera.lookAt(0, 88, 0)

    this.scene.add(new THREE.HemisphereLight('#fff6ec', '#7a6a8a', 1.6))
    const key = new THREE.DirectionalLight('#ffffff', 2.2)
    key.position.set(-120, 220, 260)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight('#ffe2c4', 0.9)
    rim.position.set(200, 120, -220)
    this.scene.add(rim)
  }

  /**
   * Create the canvas inside `host` and start the loop — or, with no WebGL,
   * mount the SVG rig there instead (see {@link ThreeActorOptions.fallback}).
   */
  mount(host: HTMLElement): this {
    // The renderer first: it is the part that can fail, and a failure must
    // leave nothing half-built behind.
    let r: THREE.WebGLRenderer
    try {
      // The stencil is how the face clips each iris to the white of its eye.
      r = new THREE.WebGLRenderer({ antialias: true, stencil: true, alpha: this.opts.background == null })
    } catch (error) {
      if (this.opts.fallback === false) throw error
      return this.mountFallback(host, error)
    }

    this.host = host
    const rm = this.opts.reducedMotion ?? 'auto'
    const reduced = rm === 'auto' ? prefersReducedMotion() : rm
    this.model = new ActorModel(this.spec, { ...this.opts, reducedMotion: reduced })
    if (rm === 'auto') this.unwatchReduced = watchReducedMotion((on) => this.model?.setReducedMotion(on))
    this.scene.add(this.model.object)
    if (Object.keys(this.early).length) this.model.apply(this.early)
    this.early = {}
    this.dress()

    r.setPixelRatio(Math.min(this.opts.maxPixelRatio ?? 2, globalThis.devicePixelRatio || 1))
    const size = this.opts.size ?? 240
    r.setSize(size, size)
    r.outputColorSpace = THREE.SRGBColorSpace
    if (this.opts.background != null) this.scene.background = new THREE.Color(this.opts.background)
    r.domElement.classList.add('ca-three')
    r.domElement.style.display = 'block'
    host.appendChild(r.domElement)
    this.webgl = r

    this.last = performance.now()
    const step = (now: number): void => {
      const dt = Math.min(now - this.last, 100) / 1000
      this.last = now
      this.model?.tick(dt)
      this.webgl?.render(this.scene, this.camera)
      this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
    return this
  }

  /** No WebGL: the SVG rig takes the host, the options they share and the frame so far. */
  private mountFallback(host: HTMLElement, error: unknown): this {
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.raf = null
    const { skin: _skin, background: _bg, maxPixelRatio: _dpr, random: _random,
      fallback: _fallback, onFallback, ...shared } = this.opts
    this.host = host
    this.svgRig = new ActorRig(this.spec, shared).mount(host)
    if (Object.keys(this.early).length) this.svgRig.apply(this.early)
    this.early = {}
    onFallback?.(error)
    return this
  }

  /** What is drawing: `'webgl'`, `'svg'` (the no-WebGL fallback), or `null` before mount. */
  get backend(): 'webgl' | 'svg' | null {
    return this.webgl ? 'webgl' : this.svgRig ? 'svg' : null
  }

  /** The model, once mounted: joints, face and the current frame. `null` under the SVG fallback. */
  get actor(): ActorModel | null {
    return this.model
  }

  get goal(): ActorFrame | null {
    return this.svgRig?.goal ?? this.model?.goal ?? null
  }

  get settling(): boolean {
    return this.svgRig?.settling ?? this.model?.settling ?? false
  }

  get motion(): MotionSettings | null {
    return this.svgRig?.motion ?? this.model?.motion ?? null
  }

  apply(frame: Partial<ActorFrame>): void {
    // A switch goes through `setCharacter` here, not only in the renderer
    // below, so the 3D model is re-skinned and `spec` stays the one a later
    // fallback mounts. An unknown name passes through and is reported there.
    const spec = frame.character !== this.spec.slug ? knownCharacter(frame.character) : null
    if (spec) this.setCharacter(spec)
    if (this.svgRig) this.svgRig.apply(frame)
    else if (this.model) this.model.apply(frame)
    else Object.assign(this.early, frame)
  }

  finish(): void {
    this.svgRig?.finish()
    this.model?.finish()
  }

  playGesture(g: Gesture, opts: PlayGestureOptions = {}): void {
    if (this.svgRig) this.svgRig.playGesture(g, opts)
    else if (this.model) this.model.playGesture(g, opts)
    else opts.onEnd?.('skipped')
  }

  speak(text: string, perViseme = 85): void {
    this.svgRig?.speak(text, perViseme)
    this.model?.speak(text, perViseme)
  }

  blink(): void {
    this.svgRig?.blink()
    this.model?.blink()
  }

  setMotion(overrides?: MotionOverrides): void {
    this.svgRig?.setMotion(overrides)
    this.model?.setMotion(overrides)
  }

  setCharacter(spec: CharacterSpec): void {
    this.spec = spec
    this.svgRig?.setCharacter(spec)
    this.model?.setCharacter(spec)
    this.dress()
  }

  /** Skin the current model with its 2D art, unless that is switched off. */
  private dress(): void {
    const model = this.model
    const skin = this.opts.skin ?? true
    if (!model || skin === false) return
    const gen = ++this.generation
    // Hidden until dressed: the bare primitives are a stand-in, not a first frame.
    const object = model.object
    object.visible = false
    skinModel(model.parts, this.spec, skin === true ? {} : skin, () => gen === this.generation && this.model === model)
      .catch(() => {
        // A skin that fails to load leaves the primitives showing: degraded, not broken.
      })
      .finally(() => {
        if (gen === this.generation && this.model === model) object.visible = true
      })
  }

  /** Resize the canvas, in CSS pixels. The SVG fallback keeps its mount size. */
  resize(size: number): void {
    this.opts.size = size
    this.webgl?.setSize(size, size)
  }

  /** Stop the loop, free GPU resources and remove the canvas. */
  destroy(): void {
    this.unwatchReduced?.()
    this.unwatchReduced = null
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.raf = null
    this.generation++
    this.model?.dispose()
    this.model = null
    if (this.webgl) {
      this.webgl.dispose()
      this.webgl.domElement.remove()
      this.webgl = null
    }
    this.svgRig?.destroy()
    this.svgRig = null
    this.host = null
  }
}

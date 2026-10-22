import * as React from 'react'
import type { ActorFrame, EmotionOverrides, Gesture, PlayGestureOptions } from './types.js'
import { defaultFrame } from './types.js'
import { ActorRig, type RigOptions } from './rig.js'
import { renderActorSVG } from './render.js'
import { knownCharacter } from './validate.js'
import { characterRoster, type RosterOptions } from './picker.js'

export interface CharacterActorProps extends Omit<RigOptions, 'size' | 'blink' | 'emotions'> {
  /** character slug from the built-in roster (roozi, ava, …) */
  character: string
  /** the frame to perform; partial frames merge onto the current one */
  frame?: Partial<ActorFrame>
  /** per-emotion tuning — overrides any channel of any emotion preset */
  emotions?: EmotionOverrides
  size?: number
  blink?: boolean
  className?: string
  style?: React.CSSProperties
  /**
   * Render the character as static SVG until the rig mounts — on the server,
   * and on the client's first paint. On by default; `false` renders an empty
   * `<div>` there, as up to 1.7.1.
   *
   * Read on the first render only: the rig owns the markup from mount on, and
   * React must not write over it.
   */
  ssr?: boolean
  /**
   * Receive the underlying rig (for `.speak()`, `.playGesture()`, …): a ref
   * object, a callback ref, or the `rigRef` of {@link useActor}. Set to the rig
   * on mount and back to `null` when it is destroyed.
   */
  rigRef?: React.Ref<ActorRig>
}

/** Option props that only take effect when the rig is built. */
type BuildOptions = Pick<CharacterActorProps, 'micro' | 'interpolation'>

/** The callback props, read through a ref so a new function takes effect without a remount. */
type Callbacks = Pick<CharacterActorProps, 'onFrame' | 'onSettled' | 'onGestureBlocked' | 'onInvalidFrame'>

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value)
  else if (ref) (ref as React.MutableRefObject<T | null>).current = value
}

/**
 * Whether this is a production build. Bundlers replace `process.env.NODE_ENV`
 * textually; in a browser without one, `process` does not exist and the
 * lookup throws — that is a development setup, so it warns.
 */
function isProduction(): boolean {
  try {
    // @ts-ignore -- no Node types here; replaced by the bundler or thrown on.
    return process.env.NODE_ENV === 'production'
  } catch {
    return false
  }
}

const warned = new Set<string>()

/** One console warning per unknown slug, outside production builds. */
function warnUnknown(character: string): void {
  if (warned.has(character) || isProduction()) return
  warned.add(character)
  console.warn(
    `[pixel-wizards-charachters] <CharacterActor character=${JSON.stringify(character)}> ` +
    'is not a built-in character, so nothing is rendered. See CHARACTER_SLUGS for the names.')
}

/**
 * React binding for {@link ActorRig}. The rig owns the DOM and mutates it
 * imperatively; React only feeds it frames, so lip-sync and gaze never trigger
 * a React re-render. Grab `rigRef` (or use {@link useActor}) to call
 * `speak()` / `playGesture()`.
 *
 * Every {@link RigOptions} field is a prop. Callbacks, `emotions` and `motion`
 * change live; `character`, `size`, `blink`, `reducedMotion`, `micro` and
 * `interpolation` rebuild the rig, which keeps performing the current `frame`.
 * `micro` and `interpolation` are compared by value, so an inline object does
 * not rebuild it on every render. `emotions` and `motion` are compared by
 * identity: memoize them, or every render retunes the rig.
 *
 * Until the rig mounts — on the server, and on the client's first paint — the
 * element holds {@link renderActorSVG} of the same frame, which a settled rig
 * matches part for part (PW-08), so the hand-over does not jump.
 */
export function CharacterActor({
  character,
  frame,
  emotions,
  size = 160,
  blink = true,
  className,
  style,
  ssr = true,
  rigRef,
  onFrame,
  onSettled,
  onGestureBlocked,
  onInvalidFrame,
  reducedMotion,
  motion,
  micro,
  interpolation,
}: CharacterActorProps): React.ReactElement {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const rig = React.useRef<ActorRig | null>(null)

  const callbacks = React.useRef<Callbacks>({})
  callbacks.current = { onFrame, onSettled, onGestureBlocked, onInvalidFrame }
  // The latest values, for a rebuild to start from.
  const latest = React.useRef({ frame, emotions, motion, rigRef })
  latest.current = { frame, emotions, motion, rigRef }
  // What the rig in hand was given, so the live effects skip a value it already has.
  const given = React.useRef<{ emotions?: EmotionOverrides; motion?: RigOptions['motion'] }>({})

  const spec = knownCharacter(character)
  if (!spec) warnUnknown(character)

  // The static first paint, frozen: React compares `__html` between renders,
  // and a changed string would overwrite the rig's DOM.
  const [markup] = React.useState(() =>
    ssr && spec
      ? { __html: renderActorSVG(spec, { ...defaultFrame(spec.slug), ...frame }, size, emotions, { motion }) }
      : undefined)

  const build: BuildOptions = { micro, interpolation }
  const buildKey = JSON.stringify(build)
  const buildRef = React.useRef(build)
  buildRef.current = build

  // Build / rebuild when the character or a build-time option changes.
  React.useEffect(() => {
    if (!hostRef.current || !spec) return
    const { frame, emotions, motion, rigRef } = latest.current
    const cb = (): Callbacks => callbacks.current
    const r = new ActorRig(spec, {
      ...buildRef.current,
      size,
      blink,
      reducedMotion,
      emotions,
      onFrame: (f) => cb().onFrame?.(f),
      onSettled: (f) => cb().onSettled?.(f),
      onGestureBlocked: (g, why) => cb().onGestureBlocked?.(g, why),
      onInvalidFrame: (e) => cb().onInvalidFrame?.(e),
    })
    // Live rather than an option, so a later change replaces it outright.
    if (motion) r.setMotion(motion)
    given.current = { emotions, motion }
    // Before mount, so the rig mounts already on the frame: an unmounted rig
    // arrives at once, and the static first paint shows that same frame.
    if (frame) r.apply(frame)
    r.mount(hostRef.current)
    rig.current = r
    assignRef(rigRef, r)
    return () => {
      r.destroy()
      if (rig.current === r) rig.current = null
      assignRef(rigRef, null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, size, blink, reducedMotion, buildKey])

  // Retune emotions live (editor preview / saved overrides).
  React.useEffect(() => {
    if (!rig.current || given.current.emotions === emotions) return
    given.current.emotions = emotions
    rig.current.setEmotions(emotions)
  }, [emotions])

  React.useEffect(() => {
    if (!rig.current || given.current.motion === motion) return
    given.current.motion = motion
    rig.current.setMotion(motion)
  }, [motion])

  // Feed frames on update.
  React.useEffect(() => {
    if (rig.current && frame) rig.current.apply(frame)
  }, [frame])

  return <div ref={hostRef} className={className} style={style} dangerouslySetInnerHTML={markup} />
}

/** What {@link useActor} returns: the rig, and its imperative calls. */
export interface ActorHandle {
  /** pass to `<CharacterActor rigRef={…}>` */
  readonly rigRef: React.RefCallback<ActorRig>
  /** the mounted rig, or `null`; the component re-renders when it changes */
  readonly rig: ActorRig | null
  /** {@link ActorRig.apply}; nothing before mount */
  apply(frame: Partial<ActorFrame>): void
  /** {@link ActorRig.speak}; nothing before mount */
  speak(text: string, perViseme?: number): void
  /**
   * {@link ActorRig.playGesture}. Before mount `onEnd` gets `'skipped'`, as the
   * rig itself reports a gesture it has nowhere to play.
   */
  playGesture(g: Gesture, opts?: PlayGestureOptions): void
  /** {@link ActorRig.blink}; nothing before mount */
  blink(): void
  /** {@link ActorRig.finish}; nothing before mount */
  finish(): void
}

/**
 * A handle on a {@link CharacterActor}'s rig, for speech and gestures:
 *
 * ```tsx
 * const actor = useActor()
 * <CharacterActor character="roozi" rigRef={actor.rigRef} />
 * actor.playGesture('wave', { onEnd: (how) => console.log(how) })
 * ```
 *
 * The calls go to whichever rig is mounted when they are made, so one kept in a
 * timeout or an event handler never reaches a rig that has been rebuilt.
 */
export function useActor(): ActorHandle {
  const [rig, setRig] = React.useState<ActorRig | null>(null)
  const current = React.useRef<ActorRig | null>(null)
  const rigRef = React.useCallback((r: ActorRig | null) => {
    current.current = r
    setRig(r)
  }, [])
  return React.useMemo<ActorHandle>(() => ({
    rigRef,
    rig,
    apply: (frame) => current.current?.apply(frame),
    speak: (text, perViseme) => current.current?.speak(text, perViseme),
    playGesture: (g, opts = {}) => {
      if (current.current) current.current.playGesture(g, opts)
      else opts.onEnd?.('skipped')
    },
    blink: () => current.current?.blink(),
    finish: () => current.current?.finish(),
  }), [rig, rigRef])
}

export interface CharacterPickerProps extends RosterOptions {
  value?: string
  onChange?: (slug: string) => void
  className?: string
}

/**
 * React picker. The DOM twin of `createCharacterPicker` in `picker.ts`.
 *
 * Two implementations, one roster: both read {@link characterRoster} and
 * neither contains a list of characters. `test/picker.test.mjs` enumerates both
 * and asserts they produce the same slugs in the same order, so a character
 * added to the library cannot appear in one picker and not the other.
 *
 * `dangerouslySetInnerHTML` is doing something ordinary here: the thumbnails are
 * SVG produced by this package's own renderer from its own character specs, not
 * anything a caller supplies. The class names match the vanilla picker
 * (`ca-picker`, `ca-picker-item`, `is-selected`) so one stylesheet dresses both.
 */
export function CharacterPicker({
  value,
  onChange,
  className,
  ...roster
}: CharacterPickerProps): React.ReactElement {
  const entries = React.useMemo(
    () => characterRoster(roster),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster.size, roster.emotion, roster.intensity],
  )
  const selected = value ?? entries[0]?.slug

  return (
    <div className={className ? `ca-picker ${className}` : 'ca-picker'} role="radiogroup" aria-label="character">
      {entries.map((e) => (
        <button
          key={e.slug}
          type="button"
          role="radio"
          data-slug={e.slug}
          aria-label={e.name}
          aria-checked={e.slug === selected}
          tabIndex={e.slug === selected ? 0 : -1}
          className={e.slug === selected ? 'ca-picker-item is-selected' : 'ca-picker-item'}
          onClick={() => onChange?.(e.slug)}
        >
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: e.svg }} />
          <span className="ca-picker-name">{e.name}</span>
        </button>
      ))}
    </div>
  )
}

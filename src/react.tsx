import * as React from 'react'
import type { ActorFrame, EmotionOverrides } from './types.js'
import { ActorRig } from './rig.js'
import { CHARACTERS } from './characters/index.js'
import { characterRoster, type RosterOptions } from './picker.js'

export interface CharacterActorProps {
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
  /** fires with the resolved frame after each apply */
  onFrame?: (frame: ActorFrame) => void
  /** receive the underlying rig (for `.speak()`, `.playGesture()`, …) */
  rigRef?: React.MutableRefObject<ActorRig | null>
}

/**
 * React binding for {@link ActorRig}. The rig owns the DOM and mutates it
 * imperatively; React only feeds it frames, so lip-sync and gaze never trigger
 * a React re-render. Grab `rigRef` to call `speak()` / `playGesture()`.
 */
export function CharacterActor({
  character,
  frame,
  emotions,
  size = 160,
  blink = true,
  className,
  style,
  onFrame,
  rigRef,
}: CharacterActorProps): React.ReactElement {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const rig = React.useRef<ActorRig | null>(null)

  // Mount / re-mount when the character changes.
  React.useEffect(() => {
    const spec = CHARACTERS[character]
    if (!hostRef.current || !spec) return
    const r = new ActorRig(spec, { size, blink, emotions, onFrame })
    r.mount(hostRef.current)
    rig.current = r
    if (rigRef) rigRef.current = r
    if (frame) r.apply(frame)
    return () => {
      r.destroy()
      if (rigRef && rigRef.current === r) rigRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, size, blink])

  // Retune emotions live (editor preview / saved overrides).
  React.useEffect(() => {
    rig.current?.setEmotions(emotions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emotions])

  // Feed frames on update.
  React.useEffect(() => {
    if (rig.current && frame) rig.current.apply(frame)
  }, [frame])

  return <div ref={hostRef} className={className} style={style} />
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

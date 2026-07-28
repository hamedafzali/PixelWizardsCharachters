import * as React from 'react'
import type { ActorFrame } from './types.js'
import { ActorRig } from './rig.js'
import { CHARACTERS } from './characters/index.js'

export interface CharacterActorProps {
  /** character slug from the built-in roster (roozi, ava, …) */
  character: string
  /** the frame to perform; partial frames merge onto the current one */
  frame?: Partial<ActorFrame>
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
    const r = new ActorRig(spec, { size, blink, onFrame })
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

  // Feed frames on update.
  React.useEffect(() => {
    if (rig.current && frame) rig.current.apply(frame)
  }, [frame])

  return <div ref={hostRef} className={className} style={style} />
}

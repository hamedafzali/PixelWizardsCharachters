# PixelWizardsCharachters

A framework-agnostic library of animated, **actable** children's characters.

A character is a puppet. An **`ActorFrame`** is one moment of performance. A
connected AI (or a timeline, or UI controls) emits a stream of frames while a
story plays, and the rig performs them — emotion, Persian-viseme lip-sync,
gaze, brows, gestures and locomotion. Every visible behaviour is one field on
the frame, so the whole performance is data.

Built for [KoodakBook](../KoodakBook) but standalone and reusable.

## Install

Published to npm:

```bash
npm install pixel-wizards-charachters
```

The package ships ESM + `.d.ts`. React is an optional peer dependency (only
needed for the `pixel-wizards-charachters/react` binding).

### Local development (before publishing)

To consume an unpublished checkout from another project, pack it and depend on
the tarball — this is byte-identical to what `npm publish` ships and, unlike a
`file:` directory symlink, resolves cleanly under strict bundlers (e.g. Next's
Turbopack) that refuse to follow symlinks outside the project root:

```bash
npm run build && npm pack        # -> pixel-wizards-charachters-<version>.tgz
# in the consumer app's package.json:
#   "pixel-wizards-charachters": "file:/abs/path/to/pixel-wizards-charachters-<version>.tgz"
```

## The roster

`roozi` · `ava` · `pashmak` · `laki` · `tondpa` · `boomi` · `khersi`

```ts
import { CHARACTERS, CHARACTER_SLUGS } from 'pixel-wizards-charachters'
```

## The contract: `ActorFrame`

```ts
interface ActorFrame {
  character: string          // slug, e.g. "roozi"
  emotion: EmotionName       // neutral|happy|excited|thinking|encouraging|sad|surprised|sleepy|love
  intensity: number          // 0..1 — scales brows, squint/widen and body tempo
  viseme: VisemeName         // rest|aa|e|i|o|u|mbp|f|sh|s|l — the mouth shape
  mouthOpen: number          // 0..1 — overrides the viseme's openness when > 0
  gaze: { x: number; y: number } // each -1..1, (0,0) = looking at the child
  browRaise: number          // 0..1 — independent brow lift
  locomotion: 'idle' | 'walk' | 'fly'
  speed: number              // ~0.5..2 motion tempo multiplier
  facing: 'left' | 'right'
  gesture: 'wave' | 'jump' | 'spin' | null // one-shot action
}
```

`defaultFrame(slug)` gives a sensible resting frame. An AI need only emit the
fields it wants to change; partial frames merge onto the current one.

## React

```tsx
import { CharacterActor } from 'pixel-wizards-charachters/react'
import type { ActorRig } from 'pixel-wizards-charachters'

const rig = useRef<ActorRig | null>(null)

<CharacterActor
  character="roozi"
  frame={{ emotion: 'happy', intensity: 0.8, gaze: { x: 0.3, y: -0.2 } }}
  size={180}
  rigRef={rig}
/>

// imperative calls that shouldn't re-render React:
rig.current?.speak('سلام دوست من')   // Persian viseme lip-sync
rig.current?.playGesture('wave')
```

The rig owns the DOM and mutates it imperatively, so lip-sync and gaze never
trigger a React re-render. A full re-render happens only when the drawn art
changes (character / emotion / facing).

## Vanilla DOM

```ts
import { ActorRig, CHARACTERS } from 'pixel-wizards-charachters'

const rig = new ActorRig(CHARACTERS.pashmak, { size: 200 }).mount(el)
rig.apply({ emotion: 'excited', locomotion: 'walk', speed: 1.4 })
rig.speak('پشمک اینجاست')
```

## Static SVG (SSR / thumbnails / tests)

```ts
import { renderActorSVG, CHARACTERS, defaultFrame } from 'pixel-wizards-charachters'

const svg = renderActorSVG(CHARACTERS.laki, defaultFrame('laki'))
```

## Persian lip-sync

`textToVisemes(text)` maps a Persian string to a viseme sequence. It's a
deliberate *group* mapping (grapheme family → mouth shape) — readable,
kid-friendly lip-sync without a full G2P pass. A backend phonemiser can emit the
same viseme names for higher accuracy. `PMAP` exposes the letter→viseme table;
`VISEMES` the shape specs (with Persian labels).

## Notes & scope

- **Walk / fly are stylized body-mechanics** (bob, lean, wing-flap), not
  articulated limb cycles — that would need a larger rig.
- **Visemes are phoneme *groups***, not per-phoneme — see above.
- Motion respects `prefers-reduced-motion`.

## Example

Open [`examples/studio.html`](examples/studio.html) in a browser (after
`npm run build`) for an interactive studio: every parameter as a live control,
Persian-text lip-sync, gaze that follows the pointer, and a live JSON view of
the actor contract.

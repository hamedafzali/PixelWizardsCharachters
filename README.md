# PixelWizardsCharachters

A framework-agnostic library of animated, **actable** children's characters.

A character is a puppet. An `ActorFrame` is one moment of performance — emotion,
Persian lip-sync, gaze, brows, gestures and locomotion. You emit frames; the rig
performs them. Every visible behaviour is one field on the frame, so a whole
performance is just data, whether it comes from an AI, a timeline or UI sliders.

Zero runtime dependencies. Ships ESM + TypeScript types. React is optional.

## Install

```bash
npm install pixel-wizards-charachters
```

## Quick start

### React

```tsx
import { CharacterActor } from 'pixel-wizards-charachters/react'

<CharacterActor
  character="roozi"
  frame={{ emotion: 'happy', intensity: 0.8, gaze: { x: 0.3, y: -0.2 } }}
  size={180}
/>
```

For speech and gestures, grab the rig — these mutate the DOM directly and never
trigger a React re-render:

```tsx
const rig = useRef<ActorRig | null>(null)

<CharacterActor character="roozi" frame={frame} rigRef={rig} />

rig.current?.speak('سلام دوست من')
rig.current?.playGesture('wave')
```

### Vanilla DOM

```ts
import { ActorRig, CHARACTERS } from 'pixel-wizards-charachters'

const rig = new ActorRig(CHARACTERS.pashmak, { size: 200 }).mount(el)
rig.apply({ emotion: 'excited', locomotion: 'walk', speed: 1.4 })
rig.speak('پشمک اینجاست')
```

### Static SVG (SSR, thumbnails, tests)

```ts
import { renderActorSVG, CHARACTERS, defaultFrame } from 'pixel-wizards-charachters'

const svg = renderActorSVG(CHARACTERS.laki, defaultFrame('laki'), 200)
```

## The characters

```ts
import { CHARACTERS, CHARACTER_SLUGS } from 'pixel-wizards-charachters'
```

`roozi` · `ava` · `pashmak` · `laki` · `tondpa` · `boomi` · `khersi` · `simorgh`

## The contract: `ActorFrame`

```ts
interface ActorFrame {
  character: string          // slug, e.g. "roozi"
  emotion: EmotionName
  intensity: number          // 0..1 — scales brows, squint/widen and body tempo
  viseme: VisemeName         // the mouth shape; 'rest' when not speaking
  mouthOpen: number          // 0..1 — overrides the viseme's openness when > 0
  gaze: { x: number; y: number } // each -1..1, (0,0) = looking at the child
  browRaise: number          // 0..1 — independent brow lift
  locomotion: 'idle' | 'walk' | 'fly'
  speed: number              // ~0.5..2 motion tempo multiplier
  facing: 'left' | 'right'
  gesture: Gesture | null    // one-shot action
}
```

`defaultFrame(slug)` gives a sensible resting frame. Partial frames merge onto
the current one, so you only send what changes:

```ts
rig.apply({ emotion: 'sad' })
```

**Emotions** — `neutral` `happy` `excited` `thinking` `encouraging` `sad`
`surprised` `sleepy` `love` `confused` `proud` `shy`

**Gestures** — `wave` `jump` `spin` `nod` `shake` `shrug` `point` `clap`
`bounce`

Each emotion poses the whole body, not just the face — spine, head tilt, ear
droop, tail carriage — so it reads at thumbnail size. Blink rate, gaze bias and
idle eye movement all follow from it too, with no extra work from you.

## Gestures

```ts
rig.playGesture('clap')
// or as part of a frame:
rig.apply({ gesture: 'clap' })
```

Not every gesture fits every situation, and the library resolves that for you in
one of two ways:

- **It substitutes.** A character with no arms still waves — with its whole
  body. Same if a walk cycle currently owns the arms.
- **It refuses.** You cannot jump while flying. Nothing plays, and the optional
  `onGestureBlocked` callback tells you why.

`jump`, `bounce` and `clap` need footing; everything else plays in any
locomotion state. To check before offering a button:

```ts
import { planGesture, GESTURE_DURING } from 'pixel-wizards-charachters'
```

## Persian lip-sync

```ts
rig.speak('سلام دوست من')          // drives the mouth, then returns to rest
rig.speak('سلام', 70)              // ms per shape
```

`textToVisemes(text)` maps a Persian string to a viseme sequence. It is a
deliberate *group* mapping (grapheme family → mouth shape) — readable,
kid-friendly lip-sync without a full G2P pass. A backend phonemiser can emit the
same viseme names for higher accuracy. `PMAP` exposes the letter→viseme table;
`VISEMES` the shape specs with Persian labels.

## Frames are eased, not snapped

`apply()` sets a goal; the rig travels toward it with a per-channel duration,
delay and curve. So the DOM does not necessarily match `frame` the instant
`apply()` returns — which is what makes the motion read as performance rather
than as a state change.

| channel | duration | delay | curve |
|---|---|---|---|
| `viseme` | 0 | 0 | snap — a blended viseme is mush |
| `mouthOpen` | 40ms | 0 | easeOut |
| `gazeX` / `gazeY` | 90ms | 18ms | easeOutQuint — ballistic, like a real saccade |
| `emotion` | 0 | 0 | snap |
| `intensity` | 260ms | 20ms | easeInOut — the emotion arrives, then deepens |
| `browRaise` | 300ms | 90ms | easeOutBack — trails and overshoots, so it reads as a reaction |
| `speed` | 400ms | 0 | easeInOut |
| `locomotion` | 0 | 60ms | snap, after a beat |
| `facing` / `gesture` / `character` | 0 | 0 | snap |

Override any of it:

```ts
new ActorRig(spec, { interpolation: { gazeX: { duration: 200 } } })
```

`rig.goal` is what you last asked for, `rig.frame` is what is on screen, and
`rig.settling` is true while they differ. `rig.finish()` lands everything at
once — as does `prefers-reduced-motion`, automatically.

## Options

```ts
new ActorRig(spec, {
  size: 200,
  blink: true,
  micro: { amount: 1, saccade: 1 },      // idle breathing and eye movement; 0 disables
  emotions: { happy: { squint: 0.5 } },  // retune the presets per character
  interpolation: { gazeX: { duration: 200 } },
  onFrame: (f) => (debugEl.textContent = f.emotion),
  onSettled: (f) => analytics.track('pose', f),
  onGestureBlocked: (g, reason) => console.log(g, reason),
  onInvalidFrame: (i) => console.warn(i),  // named something that does not exist
})
```

**Bad values do not throw, and do not pass silently.** If a frame names an
`emotion`, `viseme`, `gesture`, `locomotion` or `facing` the library does not
have — `emotion: 'joy'` instead of `'happy'`, or `locomotion: 'run'` — the rig
keeps what the character is already doing and reports it through
`onInvalidFrame` (`{ channel, value, kept }`). An unknown *gesture* is dropped
rather than held, since holding it would replay a movement you never asked for.
`rig.frame` therefore never reports a state the character is not actually in.
This is for the
case the types cannot cover: a model producing frames as JSON, where `as
ActorFrame` at the boundary is a promise the caller cannot keep. Throw from
inside the callback if you would rather fail fast, or call the exported
`sanitizeFrame(frame, current?)` yourself before applying.

**`onFrame` fires every tick of a transition** — roughly 18 times for a 300ms
change at 60fps. That is deliberate: the rendered frame really does change each
tick. Use it for cheap mirroring (a debug readout, a store write), and use
**`onSettled`** for anything expensive — network calls, analytics, persistence,
React `setState`. It fires once, when every channel has arrived.

## Notes

- Motion respects `prefers-reduced-motion`.
- The rig owns its DOM and mutates it imperatively, so lip-sync, gaze and
  gestures never re-render React. A full redraw happens only when the drawn art
  changes (character, emotion or facing).
- Walk and fly are phase-driven for characters with limb layers; the rest keep a
  stylized CSS body-mechanic (bob, lean, wing-flap). Either way you just set
  `locomotion`.
- React is an optional peer dependency, needed only for the
  `pixel-wizards-charachters/react` entry point.

## The studio

An interactive studio lives in the repository — every parameter as a live
control, Persian-text lip-sync, gaze that follows the pointer, and a live JSON
view of the actor contract.

Two things in it are worth knowing about:

- **The picker is the library's own**, `createCharacterPicker` — the same roster
  the React `<CharacterPicker>` renders. The studio does not keep a list of
  characters, and neither picker does.
- **The transport scrubs one clip a frame at a time.** Pick a gesture or a gait
  cycle, press ⏸, and step with ◀︎ / ▶︎ or the arrow keys. The ribbon under the
  slider marks the *derived* beats — the anticipation before the action and the
  settle after it, which appear in no `poses` array and are the parts hardest to
  judge at speed. A gesture is held by pausing its real CSS animation on a
  negative delay; a gait is held by pinning the driver's phase. Nothing is
  re-derived for the preview, so what you are stepping through is what ships.
  Gestures a character routes to its whole body, or refuses outright in the
  current locomotion, are labelled as such rather than quietly doing nothing.

The studio is **not** part of the npm package:

```bash
git clone https://github.com/hamedafzali/PixelWizardsCharachters.git
cd PixelWizardsCharachters && npm install && npm run demo
```

## More

- [Design notes](https://github.com/hamedafzali/PixelWizardsCharachters/blob/main/DESIGN.md)
  — the layered rig, phase-driven locomotion, anticipation/settle timing, and
  the authoring rules for adding a character.
- [Changelog](https://github.com/hamedafzali/PixelWizardsCharachters/blob/main/CHANGELOG.md)

MIT

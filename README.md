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

`roozi` · `ava` · `pashmak` · `laki` · `tondpa` · `boomi` · `khersi` · `simorgh` ·
`charkhi`

Four categories: animals (`roozi`, `pashmak`, `laki`, `tondpa`, `boomi`,
`khersi`), a fantasy creature (`simorgh`), a human kid (`ava`), and vehicles
with faces (`charkhi`). See "Roster categories" in `CONTRIBUTING.md` for what
each category needs from the rig, and what — so far — it hasn't.

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

## Petting (نوازش)

A tap is an event; petting is not. Its meaning comes from *where* the hand is,
how long it stays and how far it has travelled, so it needs somewhere to
accumulate — which is what `PetDriver` is.

```ts
import { PetDriver, CHARACTERS } from 'pixel-wizards-charachters'

const pet = new PetDriver(CHARACTERS.roozi)

el.addEventListener('pointermove', (e) => pet.stroke(...toArtSpace(e)))
el.addEventListener('pointerleave', () => pet.release())

// once per frame, merged onto the frame you were sending anyway:
const out = pet.tick(dt)
if (out.emotion) frame = { ...frame, emotion: out.emotion, intensity: out.intensity }
if (out.gaze) frame = { ...frame, gaze: out.gaze }
if (out.gesture) frame = { ...frame, gesture: out.gesture }
```

The driver owns the zone under the hand, the affection accumulated and its
decay, and what that looks like. Hit-testing against the DOM, pointer capture,
sound, and whether petting earns a reward are app policy and stay in the app.

**Affection accrues from travel, not from time held.** A finger parked on a
character is not stroking it. Per-sample travel is clamped at both ends, so a
jitter registers nothing and a flung swipe does not fill the bar.

**Zones come from the drawing.** `petZones(spec)` reads the head centre from
`eyes` and the back/tail centres from the `torso`/`tail` layer origins, so they
cannot drift from the art. A character with no layers gets its head zone only.
`zoneAt(spec, x, y)` resolves by nearest centre within `PET_REACH`, and returns
`null` for a miss.

| zone | reaction |
| --- | --- |
| `head` | `love`, greeting `nuzzle` |
| `back` | `happy`, greeting `nuzzle` |
| `tail` | `surprised`, resolving to `excited` past the delight threshold — a tail grab startles before it plays |

`nuzzle` is a normal gesture and follows the usual rules: characters without a
`head` layer lean with the whole body instead, and لاکی opts out because the
measured travel would press its mouth into its own shell rim.

## Persian lip-sync

```ts
rig.speak('سلام دوست من')          // drives the mouth, then returns to rest
rig.speak('سلام', 70)              // ms per shape
```

`textToVisemes(text)` maps a Persian string to a viseme sequence. It is a
deliberate *group* mapping (grapheme family → mouth shape) — readable,
kid-friendly lip-sync without a full G2P pass. `PMAP` exposes the letter→viseme
table; `VISEMES` the shape specs with Persian labels.

**Five shapes** — `rest` `aa` `mbp` `u` `l` — not more. Cut down from an
original eleven by measuring, on both a lips and a beak character, which
shapes were actually distinguishable at a child's viewing size; the six
dropped (`e` `i` `o` `f` `sh` `s`) each route to their nearest measured
survivor. Full method and distances are in the `VISEMES` doc comment in
`src/visemes.ts`.

**Timing is one viseme per written letter, and that is a measured decision,
not a placeholder.** Persian omits short vowels in writing, so a letter isn't
a syllable — against a 30-item hand-marked corpus
(`tools/baselines/speech.json`, `npm run speech-gap`) this carries an 18.4%
mean per-word timing error. Before building syllable-based timing to fix that,
six lexicon-free syllable estimators were tried against the same corpus
(`npm run syllable-probe`), including proper CV-chunking with Persian's real
phonotactics. None beat letter count where it counts — the best only won on
the mean by clipping outliers, and letter count stayed closer on 19 of 30
words. That isn't bad luck: دوست (1 syllable) and دارم (2) share the identical
consonant/vowel skeleton, as do آفتاب/آفرین and اسم/است, so no rule reading
only the written string can tell them apart. That needs a lexicon, which is a
different feature, not a tuning knob here.

**If you need real accuracy** — matching recorded or synthesized audio rather
than approximating from text — drive `rig.apply({ viseme, mouthOpen })`
directly from a timed track (TTS phoneme marks, forced alignment) instead of
`speak()`. That input path is a documented future option and is not built.

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
  reducedMotion: 'auto',                 // 'auto' | boolean — see Accessibility below
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

## Accessibility: reduced motion

`ActorRig` reads `prefers-reduced-motion` once, in `mount()`. `RigOptions.reducedMotion`
(`'auto'` | `boolean`, default `'auto'`) overrides it — `true`/`false` force the
rig into or out of reduced motion regardless of the OS, for a consumer app's
own accessibility setting or for a test that wants reduced motion without
depending on the environment. Changing the option on an already-mounted rig
has no effect, the same as the OS query always had none.

| under reduced motion | behaviour |
| --- | --- |
| `apply()` transitions | land immediately; `rig.settling` is always `false` |
| blink | never scheduled |
| idle micro-motion (breathing, saccade) | never runs — the tick loop that drives it never starts |
| locomotion (walk/fly) | never animates — phase-driven characters get no per-tick pose, CSS-fallback characters have their body-mechanic animation suppressed by stylesheet. `loco-walk`/`loco-fly` marker classes still toggle, for consumers styling against them |
| mood idle animation, ear/tail/iris/brow CSS transitions | suppressed by stylesheet |
| `playGesture()` | the gesture channel resolves at once, the same as every other channel snapping — no animation plays |
| `PetDriver` | the expression still changes — a character that ignores the child reads as broken, not calm — but no gesture is emitted and `intensity` snaps instead of ramping. Suppressed on the JS path (`PetConfig.reducedMotion`); the stylesheet rule cannot see a driver that never asked CSS for anything |
| `scrubGesture()` / `pinGaitPhase()` | still work: rather than pausing a CSS animation stylesheet rules would otherwise hide, both sample the pose directly and write it to `transform`, so a scrubbed frame stays visible |

Two independent things enforce this, on purpose: `RIG_CSS`'s own
`@media (prefers-reduced-motion: reduce)` rule (plus its manual twin, the
`.ca-reduced` class `render()` toggles whenever `RigOptions.reducedMotion`
forces the rig, so a forced override disables CSS-only motion exactly like the
OS setting does) kills every `animation`/`transition` under `.ca-svg`, and a
JS-side check (`this.reduced`) gates blink scheduling, the tick loop, and
`apply()`'s synchronous finish. Anything driven only by the CSS rule needed no
JS check to begin with; anything driven by the tick loop or a `setTimeout`
needed one, or the stylesheet rule would silently hide it while the JS side
kept believing it was still running — which is exactly what used to happen to
a paused scrub hold and a playing gesture, before both were fixed to check
`this.reduced` directly instead of leaning on the stylesheet alone.

## Notes

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

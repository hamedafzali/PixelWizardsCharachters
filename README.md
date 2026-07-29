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
  emotion: EmotionName       // neutral|happy|excited|thinking|encouraging|sad
                             // |surprised|sleepy|love|confused|proud|shy
  intensity: number          // 0..1 — scales brows, squint/widen and body tempo
  viseme: VisemeName         // rest|aa|e|i|o|u|mbp|f|sh|s|l — the mouth shape
  mouthOpen: number          // 0..1 — overrides the viseme's openness when > 0
  gaze: { x: number; y: number } // each -1..1, (0,0) = looking at the child
  browRaise: number          // 0..1 — independent brow lift
  locomotion: 'idle' | 'walk' | 'fly'
  speed: number              // ~0.5..2 motion tempo multiplier
  facing: 'left' | 'right'
  gesture: Gesture | null    // wave|jump|spin|nod|shake|shrug|point|clap|bounce
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

Frames are **eased, not snapped**. `apply()` sets a goal; the rig's animation
loop travels toward it with a per-channel duration, delay and curve, so the DOM
does not necessarily match `frame` the instant `apply()` returns:

| channel | duration | delay | curve | why |
|---|---|---|---|---|
| `viseme` | 0 | 0 | snap | a blended viseme is mush; speech stops reading |
| `mouthOpen` | 40ms | 0 | easeOut | just enough to take the edge off |
| `gazeX` / `gazeY` | 90ms | 18ms | easeOutQuint | a saccade: ballistic, with a hair of reaction time |
| `emotion` | 0 | 0 | snap | discrete — it changes the drawn art |
| `intensity` | 260ms | 20ms | easeInOut | the emotion arrives, then deepens |
| `browRaise` | 300ms | 90ms | easeOutBack | trails the emotion and overshoots, so it reads as a *reaction* |
| `speed` | 400ms | 0 | easeInOut | gait shouldn't step-change |
| `locomotion` | 0 | 60ms | snap | a beat before the feet commit |
| `facing` / `gesture` / `character` | 0 | 0 | snap | discrete |

Override any of it with `new ActorRig(spec, { interpolation: { gazeX: { duration: 200 } } })`.
`rig.goal` is what was last asked for, `rig.frame` is what is on screen right
now, and `rig.settling` is true while they differ — once false, the rig stops
recomputing frame state entirely (it keeps breathing). `rig.finish()` lands
everything at once; `prefers-reduced-motion` does this automatically, as does
any rig with no `requestAnimationFrame` to tick it.

### `onFrame` fires per tick — by design

Because a transition renders many frames, `onFrame` fires on **every tick** of
one, not once per `apply()`. That is the permanent contract: the rendered frame
really does change each tick, and a callback that skipped ticks would be lying
about what is on screen. A ~300ms transition fires it ~18 times at 60fps.

So `onFrame` is for cheap mirroring (a debug readout, a store write), not for
network calls, analytics, persistence or React `setState`. For those, use
**`onSettled`**, which fires once with the final frame when every channel has
arrived:

```ts
new ActorRig(spec, {
  onFrame: (f) => (debugEl.textContent = f.emotion),   // ~18x per transition
  onSettled: (f) => analytics.track('pose', f),        // once
})
```

`onSettled` also fires on `finish()`, under `prefers-reduced-motion` and on an
unmounted rig, where arrival is immediate. An `apply()` that changes nothing
does not fire it — there was no transition to settle.

Note that `intensity` is **not** on that list. It drives eye squint and widen,
and both are live hooks rather than baked geometry — widen is a `scale` on the
`.eyeG` wrapper, squint is the lower lid's `ry`. Sweeping intensity from 0 to 1
therefore costs two attribute writes per eye and zero re-renders. (Baking either
one would also mean the eye froze at whatever intensity happened to be current
at the last emotion change, since emotion is what triggers the re-render.)

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

## The layered rig

Characters may split their art into transform layers, each with its own pivot,
so the rig rotates limbs instead of redrawing them. `ActorFrame` is unchanged —
this is a rendering upgrade only.

```
<g class="rig-flip">              facing
 ├ .lyr-shadow                    stays on the ground
 └ .rig-root                      locomotion          origin 100 190
    └ .rig-body                   gesture + squash    origin 100 188
       └ .rig-mood                emotion idle        origin 100 150
          └ .lyr-torso            spine curve
             ├ .lyr-tail .lyr-farArm .lyr-farLeg
             │  … torso art …
             ├ .lyr-nearLeg .lyr-nearArm
             └ .lyr-head          neck pivot
                ├ .lyr-earL .lyr-earR
                └ … head art, .browsG, #mouthG …
```

Three transform carriers, not one, so locomotion / gesture / idle-mood compose
instead of overwriting each other's `transform`.

Transform origins for `roozi` (200×200 art space):

| layer | origin | layer | origin |
|---|---|---|---|
| `lyr-torso` | `100 168` (hips) | `lyr-head` | `100 112` (neck) |
| `lyr-tail` | `146 146` | `lyr-earL` / `lyr-earR` | `76 50` / `124 50` |
| `lyr-farArm` / `lyr-nearArm` | `62 126` / `138 126` | `lyr-farLeg` / `lyr-nearLeg` | `84 160` / `116 160` |

`near` is the side toward the viewer at the default `facing: 'right'`; the flip
group mirrors the whole tree, so near/far need no per-character handling.

Transform origins for `boomi` (an owl, deliberately *not* built like the fox):

| layer | origin | layer | origin |
|---|---|---|---|
| `lyr-torso` | `100 172` (hips) | `lyr-head` | *none* |
| `lyr-farArm` / `lyr-nearArm` | `56 108` / `144 108` (wings) | `lyr-farLeg` / `lyr-nearLeg` | `84 176` / `116 176` (talons) |
| `lyr-earL` / `lyr-earR` | `66 58` / `134 58` (tufts) | `lyr-tail` | *none* |

### Authoring rule: a layer exists only if the joint does

Posture and the gait tables send the *same* numbers to every character —
`headDrop: 5`, `ears: 34` — so the pivot is what decides whether those read as a
nod or a bow. Inventing a pivot for a joint the drawing doesn't have makes the
same posture mean something different on every character.

**No visible neck → no `head` layer.** `head` means *the mass that rotates about
the neck*. An owl, a blob or a ball is one form from base to crown: it draws its
face straight onto `torso`, its ears hang off the torso, and `headTilt` /
`headDrop` land on nothing — exactly as tail droop already does for a character
with no tail. That is the correct outcome, not a gap to paper over. The same
test applies to every other layer.

**Status: `roozi` and `boomi`.** The rest of the roster still returns flat `art`
and renders unchanged — `layers` is optional on `CharacterSpec` and the two paths
coexist. Note that six of eight characters were never drawn with arms, so
converting them means *drawing* limbs, not just regrouping paths.

Converting a character also migrates it off the pre-layer hooks. `boomi`'s wings
no longer carry `.wingL` / `.wingR`: nested inside `.lyr-farArm`, both the old
`.loco-fly .wingL` rule and the layer rule matched, flapping the wing twice about
two different pivots. Unconverted fliers keep the old classes and the old rules.

## Locomotion: phase tables, not keyframes

A gait is a **phase table** — one cycle, 0..1, with a keyed pose per driven
layer — sampled by the rig's existing tick loop and fed through the same pose
composer as posture and gesture.

```ts
import { GAITS, LocomotionDriver, samplePhase } from 'pixel-wizards-charachters'

GAITS.walk.rate        // 2 cycles/s at speed 1
GAITS.walk.tracks      // { nearLeg, farLeg, nearArm, farArm, root }
```

`walk` is bipedal and contralateral. One cycle is a full stride — two steps —
so each named point occurs twice, half a cycle apart, and the body bob has two
peaks: it rises at each pass and sits lowest at each contact, so the feet land
on the low point.

| φ | name | near leg | near arm | body y |
|---|---|---|---|---|
| 0 | contact | +20° | −14° | 0 |
| 0.125 | down | +12° | −8° | −2 |
| 0.25 | pass | 0° | 0° | −4 |
| 0.375 | up | −12° | +8° | −2 |

`WALK_PHASES` exports those names. The far leg is the near leg offset by exactly
half a cycle.

`fly` is a wingbeat with deliberately *uneven* keys: the downstroke is the first
40% of the cycle (φ 0 → 0.4, −26° to +16°) and the recovery the remaining 60%.
The wing also **folds** on the way back up — `sx` narrows to `WING_FOLD_SX`
(0.82) at φ 0.7 and is back to full span by the top — because a wing that
returns at full span pushes the bird back down and the beat reads as rowing. It
stays flat at 1 across the whole power stroke.

This replaced four `@keyframes` rules per gait, for two reasons CSS could not
fix:

- A running animation outranks an inline transform, so the moment a character
  walked, posture stopped reaching the limbs — a sad character walked with
  neutral arms. Gait and posture are now two sources that **add**.
- The limb cycle and the body bob were separate animations with separate
  clocks, so they drifted and the feet stopped landing on the bob. Now there is
  one phase.

The phase survives a speed change (a character speeding up mid-stride keeps its
footing) and resets on a *gait* change (a wingbeat starts at the top of the
stroke).

**Fallback.** A gait declares the layers it needs (`walk` needs both legs, `fly`
both arms). A character missing any of them falls back to the old CSS body
animation, and `.loco-walk` / `.loco-fly` stay on the `<svg>` for every character
as a state marker you can style against.

The whole roster is converted, so the fallback is no longer a migration state —
it is where several characters permanently live. `ava`'s legs are under her
dress; `pashmak` is a fluffball with neither legs nor wings; `tondpa` and
`khersi` have foot *pads* with no drawn leg and no hip to pivot about, which is
not a joint. Those three run on the fallback path for both gaits and always will.
Inventing a hip to unlock a gait is exactly what the authoring rule forbids —
see below.
Conformance against `WALK_PHASES` / `FLY_PHASES` is therefore checked per
character, against whichever gaits that character can actually drive.

**Eligibility is declared, not inferred.** Having the layers is not the same as
meaning them. لاکی's back flippers sit in the `farArm` / `nearArm` slots —
correctly, that is what her walk swings — which makes `canDrive('fly')` true for
a tortoise. Nothing in the geometry can tell a wing from a flipper, so each
character lists the gaits it may be driven through:

```ts
gaits: ['walk']   // structural capability AND this list; both must agree
```

Omitted or empty means **no gait is phase-driven** and everything takes the CSS
fallback. That default is the point: a new character opts in once its limbs are
known to swing the way the gait assumes, rather than inheriting a wingbeat the
moment it grows two arms. `canDrive` stays purely structural; `drivesGait` is
the AND, and it is the only thing the rig gates on.

### `torsoFront`: when the head goes behind the body

Paint order runs head-over-torso, which every character wants except a turtle.
`torsoFront` is torso art that paints *after* the head, nested inside `torso` so
it still leans with the spine. لاکی's shell lives there, so her neck disappears
under the rim at every head angle instead of sliding across the shell face.

It is not free: once the head tucks under something, `headDrop` is bounded from
both directions — too much buries the mouth under the rim mid-sentence, too
little lifts the head clear of the body. لاکی's measured window is about
`[-2, 0]`, and both walls have tests.

## Timing: anticipation & settle

A gesture declares only what it does — a list of key poses. `buildAction()`
derives the anticipation (counter-move + load-up squash, scaled from the
action's own peak pose) and the settle (impact squash → rebound stretch →
diminishing counter → rest), then compiles one `@keyframes` rule. New gestures
inherit both for free.

```ts
import { buildAction } from 'pixel-wizards-charachters'

buildAction('myGesture', { dur: 0.9, poses: [{ y: -26, sx: 0.95, sy: 1.08 }, { y: 0 }] })
```

## Gestures: what a character does, and what it can do it with

Nine gestures ship: `wave`, `jump`, `spin`, `nod`, `shake`, `shrug`, `point`,
`clap`, `bounce`. Each declares only its key poses and which layers they move;
anticipation and settle are derived (above), and a two-limbed gesture is a *list*
of parts started in the same tick, so a clap cannot drift a frame apart.

A gesture can be unavailable in two different ways, and the difference matters:

**Structural** — the character has no such limb (پشمک, تندپا and خرسی have no
arm layer; بومی has no head layer), or the limb is currently owned by a
phase-driven gait. Both are recoverable: the gesture plays its whole-body
`fallback`, so a wave still reads as a wave. Derived from what the gait
**tracks**, not what it merely requires — a walk requires only legs but swings
the arms too, so a wave during a driven walk falls back.

**Semantic** — the action makes no sense in that locomotion state. You cannot
jump off the air. Not derivable from geometry, so it is authored per gesture,
and it *blocks*: nothing plays, and `onGestureBlocked` tells the driver.

| gesture | idle | walk | fly | moves |
| --- | :-: | :-: | :-: | --- |
| `wave` | ✓ | ✓ | ✓ | near arm |
| `point` | ✓ | ✓ | ✓ | near arm |
| `shrug` | ✓ | ✓ | ✓ | both arms, mirrored |
| `clap` | ✓ | ✓ | — | both arms, mirrored |
| `nod` | ✓ | ✓ | ✓ | head |
| `shake` | ✓ | ✓ | ✓ | head |
| `jump` | ✓ | ✓ | — | body |
| `bounce` | ✓ | ✓ | — | body |
| `spin` | ✓ | ✓ | ✓ | body |

`planGesture(gesture, locomotion, drivenGait, hasLayer, optOut)` answers "what
would happen if I asked for this right now" without playing it — useful for
greying out a button.

### Declared opt-outs

A character can also send a gesture to the whole body even though it *has* the
limb, via `gestureFallback` on `CharacterSpec`. لاکی is the case: its head tucks
behind its shell, and a nod's 6.5-unit drop would put the mouth under the rim —
the same wall its posture window is measured against, reached through a gesture
instead. Declared rather than inferred, for the reason `gaits` is: nothing in
the geometry separates "cannot travel that far" from "drawn small", and scaling
every gesture down to fit the most constrained character makes one character's
shell everybody's problem. A test re-derives the list from the shipped keyframes
and fails if it drifts in *either* direction.

## Gaze: emotion bias, and eyes that are never still

Where the eyes point is three things stacked, not one:

1. the frame's `gaze` — what the driver asked for, always dominant;
2. the emotion's own bias, scaled by `intensity` — خجالتی looks down and away,
   مغرور lifts past you, گیج looks up and to one side. A driver that never
   touches gaze still gets eyes that mean something;
3. an idle **saccade** — a short dwell, then a ~50ms dart to a nearby point.

All three are clamped as a sum, so an emphatic driver gaze quietly absorbs the
emotion bias instead of fighting it. The saccade is procedural and damps while
walking or flying; `micro: { saccade: 0 }` pins the eyes without freezing the
body.

Blink rate and lid weight also come from the emotion — `surprised` blinks
fastest and lightest, `sleepy` slowest and by far heaviest, `shy` most often in
pairs. The table is **total** over the emotion union rather than sparse over a
default, which is how `surprised` previously sat on the neutral blink unnoticed
for its whole life.

## Posture: emotion in the silhouette

Emotion also poses the body, not just the face — spine curve, shoulder sink,
head tilt, ear droop, tail carriage, arm hang — so `sad` (folds forward, ears
and tail hard down) and `sleepy` (sinks at the knees, head lolled to one side,
everything half) differ in shape at thumbnail size.

This is a per-character **visual-design** concern, so it lives in an optional
`posture` block on `CharacterSpec`, scaled by the frame's existing `intensity`.
It is deliberately *not* on `ActorFrame`: a puppeteer says "be sad", not "droop
the ears 34 degrees".

```ts
posture: { sad: { ears: 34, tail: 42 }, excited: { ears: -22, tail: -34 } }
```

Where a character's art bounds a channel, the override is *measured* and
guarded. لاکی's head sits behind its shell, so its `headDrop` is boxed on both
sides — too far down buries the mouth, too far up detaches the head — and the
shared مغرور/خجالتی presets walked straight out of that window when they landed.
تندپا's مغرور is the same story against the head/body seam. Both have per-
character overrides, and both were found by the seam tests rather than by eye.

## Notes & scope

- **Walk / fly are phase-driven** for layered characters — see below. Characters
  without limb layers keep the stylized CSS body-mechanics (bob, lean,
  wing-flap).
- **Visemes are phoneme *groups***, not per-phoneme — see above.
- Motion respects `prefers-reduced-motion`.

## Example

Open [`examples/studio.html`](examples/studio.html) in a browser (after
`npm run build`) for an interactive studio: every parameter as a live control,
Persian-text lip-sync, gaze that follows the pointer, and a live JSON view of
the actor contract.

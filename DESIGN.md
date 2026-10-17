# Design notes

Internals of the rig, kept out of the README so the package page stays about
*using* the library. Nothing here is required reading to use it.

Every decision below was measured rather than chosen — the pivots come off the
drawings, the windows come off numeric sweeps, and each guard has a mutation
test proving it fails when the thing it guards is broken.

---

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

## The motion engine: settings, not characters

`src/motion.ts` is the one place that moves things on its own over time. It is
pure (no DOM): each tick it gets the frame, the gaze the character *intends*
(before the saccade), which layers exist, and the pose every other source has
already set on each target. It returns one extra `'motion'` contribution per
target, plus a face offset, a shading shift and a blink request. The rig
composes that contribution like any other.

**No character names.** Each driver reads only its settings, and a character
changes them through `CharacterSpec.motion`. A test checks that
`DEFAULT_MOTION` contains no character slug.

**Springs are world-space.** A soft layer's spring chases the place where its
pose would be if its ancestors' rotation had carried it along fully
(`anchor + own`). The output is how far it lags behind that place
(`w − anchor − own`), clamped to `limit`. So a head turn of 10° first shows as
an ear *counter*-rotation that then decays away. The ancestors include the
engine's own head turn, so attention moves the ears too. Rotation is the main
signal (`inertia`); vertical and horizontal motion of the ancestors adds a
smaller swing (`lift`, `drag`), with opposite signs on the two sides so a pair
of ears splays apart instead of swinging together.

**Depth offsets are relative to the parent.** Each layer is offset by
`yaw · (depth − parentDepth) · travel`. Ears inside a head at 0.2 therefore
move back by 0.2 and stay on the body plane, instead of picking up the head's
offset a second time.

**Measured, not guessed:**

- `attention.rise` (lifting the head when the eyes look up) started at 1.5. It
  opened تندپا's neck seam to 113 (the floor is 120) and خرسی's to 188 (the
  floor is 220), and it pushed لاکی's mouth 0.14 into the shell. At 0 the
  numbers are 156.6, 241 and 1.61, so the head shows an upward look by pitch
  alone.
- The default 28° ear lag clips چرخی's antennae within 0.65 of the roof; past
  about 13.9° the stalk dips under 1 unit. Its spec caps the lag at 10° (margin
  1.09) and stiffens the spring.
- Ears and pigtails pass with the defaults: خرسی's penetration is 11.47 and
  آوا's is 16.09, against a floor of 8.

`test/motion.test.mjs` re-runs every one of these probes across the extra
range the engine adds: every emotion × intensity × gaze × yaw, with the lag
at ± its limit. Mutations M48–M56 prove each guard can fail.

**Settled means exact.** An exponential decay never actually reaches zero, so
a spring snaps onto its target once it is within 1e-4. Without that, a rig at
rest would keep writing `translate(0.000 0)` instead of the authored
transform, and a yaw back to 0 would not restore the gradients verbatim.

**Gradient ids are namespaced per rig.** The shading moves a radial gradient's
`cx`. Before 1.5, two rigs of the same character on one page shared gradient
ids, so turning one would have shaded the other.

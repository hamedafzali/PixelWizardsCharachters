# Changelog

## 1.6.0

**A three.js renderer.** `pixel-wizards-charachters/three` draws a character as
a 3D model. It reads the same `ActorFrame`, motion settings, posture, gait
tables and gesture plans as the SVG rig. three.js is an optional peer
dependency, and the core package still has no runtime dependencies.

- `ThreeActor` is the browser part: canvas, camera, lights and the animation
  loop. It has the same methods as `ActorRig`.
- `ActorModel` is the headless part. It needs no DOM or WebGL, and it runs on
  one clock with no timers, so it can be stepped in tests or from your own
  loop.
- `CharacterSpec.body3d` describes a character's 3D shape as data: primitive
  parts per layer, in the SVG's art space and around the SVG's pivots. All
  ten characters have one, and a test checks that each mirrors its 2D layers,
  pivots and face. A layer can also set `depth` (the skin solid's
  half-thickness, for a part deeper than its outline suggests, like لاکی's
  shell) and `back` (art painted on its sides and back only, like آوا's hair
  behind her face).
- `yaw` and gaze turn the body and head for real. The motion engine now
  reports its attention and depth spring state (`MotionOutput.look`, `.yaw`),
  and the 3D model switches off the 2D head slide and parallax (`MOTION_3D`).
- New shared exports: `posturePoses` (the SVG rig now uses it too),
  `LOCO_FALLBACK_POSES`, `LOCO_FALLBACK_DUR`, `BROW_LINES` and
  `DEFAULT_TURN3D`. No SVG behaviour changes.
- **The 3D model wears its 2D art.** `skinModel` rasterises each layer's SVG
  art and inflates it into a closed solid: an ellipse in section, deep where
  the shape is wide, its outline real geometry traced on the art's own edge.
  Each solid sits at its layer's `body3d` depth, so the body holds together
  from the side and the back. The 2D paint order becomes a depth-test bias
  that applies only as much as a layer faces the camera. Sides and back
  show the colour at the layer's outline instead of the projected front art.
  The pure parts are exported: `silhouette`, `solidGeometry` and `paintBias`.
  The face rig is restyled to match the drawing: flat
  colours, the iris clipped to the eye white with a stencil, the 2D lid, shade
  and ring, and arched brows. A character whose 2D mouth is a beak
  (بومی, سیمرغ) gets a 3D beak: two mandibles, the lower one opening as far
  as the 2D lens opens for each viseme, with the tongue when the 2D shows it.
  `ThreeActor` applies it by default, and keeps the model hidden until the
  skin is on, so the bare primitives never flash up first
  (`skin: false` turns it off), and the headless model is unchanged.
- The sides and back are cleaner. Stripes, tufts and eye discs that reach
  a layer's outline are no longer dragged round the back as streaks
  (`dropMarks`, exported). A turned surface darkens toward its silhouette, as
  the drawing darkens toward its outline, so a turned arm stays apart from
  the body behind it.
- The README shows every character turning in 3D (`docs/media/`, linked from
  GitHub, not shipped in the package).
- `npm run demo:3d` opens `examples/three.html`, with the SVG and 3D versions
  side by side and a picker for every character (`?c=<slug>` links to one).
- New tests are in `test/three.test.mjs` (29 tests), and mutations M57–M78
  prove each new guard fails when broken.

## 1.5.0

**A motion engine every character shares, tuned by settings.** The new
`MotionEngine` (`src/motion.ts`) adds four drivers on top of the poses:

- spring-driven ears and tails that lag and settle (`secondary`)
- a head that follows the gaze and blinks on big looks (`attention`)
- lean, stop-rock, emotion pop and landing squash (`body`)
- a 2.5D three-quarter turn through the new `ActorFrame.yaw`, with per-layer
  parallax, a face slide and moving gradient shading (`depth`)

The engine has no per-character code. `DEFAULT_MOTION` is overridden by
`CharacterSpec.motion` and then by `RigOptions.motion`. Any part can be
`false`. `rig.setMotion()` and `rig.motion` change and read the settings at
runtime.

When the character is at rest the engine adds nothing, so existing frames
render as before. Reduced motion, `finish()`, `pinGaitPhase()` and
`scrubGesture()` all land the springs at once.

- چرخی's antennae have a measured lag cap of 10° (the 28° default clips the
  roof), and its roll lean is 2.
- `attention.rise` defaults to 0, because a head that lifts with the gaze was
  measured to open the تندپا/خرسی neck seams and bury لاکی's mouth.
- Gradient ids are now namespaced per rig, so two copies of a character on one
  page no longer share `<defs>`.
- The studio has a yaw slider.
- New tests are in `test/motion.test.mjs`, and mutations M48–M56 prove each
  guard can fail. `tools/baselines/geometry.json` is unchanged.
- Mutations M15 and M26 had stopped matching after earlier refactors, so the
  run marked them invalid. Their patterns are updated, and all 56 now apply
  and are caught.

## 1.4.1

**`pixel-wizards-charachters/react` types now resolve under
`moduleResolution: "node"`.** That setting (the Create React App default)
ignores `exports`, so TypeScript could not find the React entry's types and
the import failed to typecheck even though the bundler loaded it fine. A
`typesVersions` map now points it at `dist/react.d.ts`. No runtime change.

## 1.4.0

**New character: ربو (`robo`)**, a small helper robot and the first member of
a new "robots" category. A boxy head with a glass face screen sits on a drawn
neck, so it has a real `head` layer pivoted at `[100, 102]`, the head box's
bottom edge. Arms are `farArm`/`nearArm` pivoted on the drawn shoulder bolts
(`[60, 122]`, `[140, 122]`), so wave/point/clap/shrug use the arms. Twin
antennas reuse `earL`/`earR`, rooted on the flat top edge of the head
(`[82, 36]`, `[118, 36]`). The wheel housing is static `torso` art, and
`gaits` is `['roll']` only. Its pivots and gesture routing are added to
`tools/baselines/geometry.json`; nothing else in the baseline changed.

## 1.3.1

**`role` reconciled with KoodakBook's actual module hosting.** پشمک
`صداها`→`قصه‌ها`, لاکی `شمارش`→`مرور`, تندپا `رنگ‌ها`→`بازی‌ها`, خرسی
`احساس‌ها`→`ریاضی`. `role` is descriptive metadata with no consumer in the
library itself and, per a repo grep, none in KoodakBook either — the app's
`kit.tsx` module assignment is the fact that actually matters, so `role` now
just states it instead of disagreeing with it. چرخی's `جاده‌ها` is unchanged;
see the docstring above `CHARACTERS` for why it stays unmapped in `kit.tsx`
on purpose.

## 1.3.0

**سیمرغ is layer-rig converted** — the last unlayered character, and the
roster's only remaining CSS-fallback flier. Wings map to `farArm`/`nearArm`
(`bmB`-style pivot at the shoulder line, `cy=132`, measured off the art rather
than the old hardcoded `.wingL`/`.wingR` 50px/150px rule); the three crest
feathers stay inside `head`, painted before the head circle, since there are
three of them and not a mirrored pair; the five tail feathers become their own
`tail` layer, pivoted at `[100, 132]` — not the visual centroid of the fan
(`≈[100, 158]`), which sits inside `pet.test.mjs`'s 40-unit minimum-separation
floor from the torso pivot, but level with the wings, reading the tail as
rooted at the same shoulder line. `gaits: ['fly']` is now declared, so سیمرغ is
phase-driven like بومی instead of running the legacy `caFly` CSS keyframe; it
still has no `farLeg`/`nearLeg`, so `walk` is unchanged and still CSS-fallback.

One real visual change, same as بومی's conversion: `LAYER_ORDER` paints
`nearArm` after `torso`, so the right wing moves from behind the body to in
front of it.

**A side effect worth knowing about:** `pet.ts`'s `petZones()` reads `back` off
`torso.origin` and `tail` off `tail.origin`, so سیمرغ — previously head-only,
the roster's one "no layers at all" case for petting — now exposes all three
pet zones (`head`, `back`, `tail`). بومی is now the roster's example of the
partial case (a torso/back zone, no tail zone) that the old سیمرغ-based test
covered.

`gestureRouting.simorgh.*` moves from `fallback:missing-layer` to native layers
for every gesture (`wave`/`point` → `lyr-nearArm`, `nod`/`shake`/`nuzzle` →
`lyr-head`, `shrug`/`clap` → both arms) — see `tools/baselines/geometry.json`.
No `gestureFallback` was added: the crest feathers move rigidly with the head
layer they're painted inside, so there is no لاکی-style shell-clip risk to opt
around.

Six tests that used سیمرغ as the canonical example of an unlayered/CSS-fallback
character were retargeted to the character that is now the real example of
each case (چرخی for "no arm and no head layer at all", بومی for "a torso zone
with no tail zone") rather than deleted, so each behaviour keeps a real,
passing exerciser. `npm run baseline -- --write` accepted 12 additive changes
(5 new pivots, 7 gesture-routing entries); nothing else moved.

## 1.2.0

**نوازش — petting, as a rig capability.** New `PetDriver` (`src/pet.ts`) plus
one new `Gesture`, `nuzzle`. A tap is a discrete event and needs no driver;
petting is a *sustained* input whose meaning is carried by where the hand is,
how long it stays and how far it has travelled. That accumulation is state, and
state that outlives one event belongs beside `IdleMicroMotion` and
`LocomotionDriver` rather than in whichever app mounted the character —
otherwise every app re-derives "how petted is this character right now", and
they disagree.

The driver owns three things and deliberately nothing else: which zone the hand
is in, how much affection has accumulated and how it decays, and what that
looks like (an emotion, a gaze, one-shot gestures). Hit-testing against the DOM,
pointer capture, sound, and whether petting earns a star are app policy and stay
in the app.

**Zones are derived, not authored.** `petZones(spec)` reads the head centre from
`spec.eyes` and the back/tail centres from the `torso`/`tail` layer origins, so
they cannot drift from the drawing the way a hand-copied coordinate would. The
`head` *layer* origin is the neck pivot, several units below the face, so using
it would have put the head zone on the throat — `eyes` is the measurement that
means "face". A character with no layers (سیمرغ) gets its head zone only, which
is the honest answer: without layers there is no measured hip or tail to point
at. The one authored number is `PET_REACH` (54), a design parameter rather than
a measurement. Zones overlap at that radius — چرخی's head and back centres are
44 apart — so `zoneAt` resolves by nearest centre, and the test guards a
minimum *separation* rather than a non-overlap that was never true.

**Affection accrues from travel, not from time held.** A finger parked on a
character is not stroking it, and rewarding the rest would let a child leave one
down and farm adoration. Per-sample travel is clamped at both ends so a jitter
registers nothing and a flung swipe does not fill the bar.

**Zone reactions are a table.** Head reads as affection (`love`), back as
`happy`, and the tail startles before it plays — `surprised`, resolving to
`excited` once past the delight threshold, which is how a child actually plays
with a pet. Ears and tail come free from the existing `POSTURES` map.

**لاکی opts out of `nuzzle`,** joining `nod`, and for the same measured reason:
the suite reported -0.10 mouth clearance at t=0.421, so a nuzzling لاکی presses
its mouth into its own shell rim. It leans its whole shell into the hand
instead, which is also the better read for a tortoise. Caught by the existing
`rig-cache` guard, not by inspection.

**Reduced motion** is suppressed on the `this.reduced` path, not by `RIG_CSS` —
`animation:none!important` cannot stop a driver that never asked CSS for
anything. The expression still changes, because a character that ignores the
child reads as broken rather than calm; what stops is the motion (no gesture is
emitted, and intensity snaps instead of ramping). Suppression sits at the single
point where `pending` is set: an earlier draft also nulled the gesture on the
way out, which looked like defence-in-depth but was dead code no test could
distinguish — mutation-verifying it is what surfaced that.

Backward compatible: additive `Gesture` value, one new module, one character
opting out of one gesture. No existing `ActorFrame`, `CharacterSpec` or gesture
shape changes.

## 1.1.0

**A `roll` gait for چرخی.** New `GaitName` value `'roll'` and matching
`LOCOMOTIONS` entry, phase-driven like `walk`/`fly` through the same
`Gait`/`PhaseKey` table (`GAITS.roll`, `ROLL_PHASES`). چرخی is the only
character to declare it (`gaits: ['roll']`).

This is a suspension bob — `root`/`torso` rocking as the chassis rolls — not
the wheels spinning. `0.8.0`'s entry below answered "does چرخی need its own
`ActorFrame` field for wheel-spin" with "no, that's a locomotion-table
question," and left it there; this is that locomotion-table question,
answered for the chassis half only. The wheels stay exactly what they were:
two static `<circle>` groups baked into `torso`'s own `art`, painted under
its highlight/shadow gradients, with no independent rotation. Turning those
into a real spinning layer would mean splitting them out of `torso` and
re-deriving that paint order — a separate, larger piece of work, not done
here.

`roll` only requires `root`, which (like `torso`) every character has
structurally — unlike `walk`/`fly`, which need per-character limb layers and
so fall back to a CSS body animation where those are missing. `roll` has no
such fallback (`LOCO_ANIM.roll` is `null`): a character that declares it is
always phase-driven. `rig.ts` gained a `loco-roll` class toggle alongside
the existing `loco-walk`/`loco-fly`, for consumers styling by locomotion.

Backward compatible: additive `GaitName`/`LOCOMOTIONS` values, one character
opting in. No existing `ActorFrame`, `CharacterSpec`, or gait table changes
shape.

## 1.0.0

The registry's published version is `0.4.0`. Everything below shipped since
then — this is a version bump on an already-public package, not a first
release. The `0.4.1` through `0.8.0` entries below have the full detail;
this entry is the summary of that gap.

**Studio tooling.** Three contact-sheet generators (`gestures.mjs`,
`emotions.mjs`, `seams.mjs`) and a numeric baseline file (`geometry.json`,
200 measurements) that render off a real mounted rig rather than restating
its maths, so what's measured is what actually ships. An interactive studio
(`examples/studio.html`) with a shared picker (`characterRoster()` /
`createCharacterPicker()`, plus a React `<CharacterPicker>` twin) and a
frame-by-frame scrubber for gestures and gaits, including the derived
anticipation/settle beats that no `poses` array names.

**Gesture library.** Six new gestures (`nod`, `shake`, `shrug`, `point`,
`clap`, `bounce`), joining the original three, each a list of parts started
in the same tick. Availability now splits into two independent axes —
structural (missing limb, falls back to whole-body) and semantic (makes no
sense in the current locomotion, blocks outright via `onGestureBlocked`) —
with `planGesture()` to ask what would happen before asking for it.

**Emotion depth.** Three new emotions (`confused`, `proud`, `shy`), each
with its own brow shape, gaze bias, blink style and posture, verified for
distinctness against the roster's own closest existing pair rather than a
hand-picked threshold. Per-character emotion overrides (`EmotionOverrides`)
let a character retune a preset without forking it.

**Gaze and eye realism.** Gaze is now three things stacked — driven
`gaze` (always dominant), the emotion's own bias scaled by intensity, and a
procedural idle saccade (damped while walking or flying) — clamped as a
sum. Blink rate and lid weight vary by emotion over the *entire* emotion
set, not a sparse table with a silent default.

**Lip-sync and viseme redesign.** The viseme table shrank from eleven
shapes to five (`rest`, `aa`, `mbp`, `u`, `l`), chosen by measuring
pairwise distinguishability rather than convenience, with every dropped
shape routed to its measured nearest survivor. Letter-per-viseme timing was
tested against six lexicon-free syllable estimators on a hand-marked
corpus and kept — none beat it, because Persian's written form genuinely
cannot distinguish some syllable counts without a lexicon.

**Robustness.** A frame with a bad value (`emotion: 'joy'`, `viseme: 'x'`,
`locomotion: 'run'`) used to either throw from inside a render or fail
silently with no signal at all. It now keeps the character's current state
and reports the rejection via `onInvalidFrame`, with `sanitizeFrame`
exported for callers who want to check first — built for the case a model
is driving the rig directly from generated JSON.

**Accessibility: reduced motion, made actually reduced.** Two features
that held a frame via a paused CSS animation (`scrubGesture()`,
`pinGaitPhase()`'s CSS-fallback branch) were silently defeated by
`RIG_CSS`'s own `prefers-reduced-motion` rule, which cannot tell a
deliberate hold from a running animation — a reviewer on a reduced-motion
browser saw nothing. Both now sample the pose directly and write it to
`transform`, bypassing `animation` entirely. New
`RigOptions.reducedMotion?: boolean | 'auto'` forces the rig independently
of the OS query.

**چرخی and the roster taxonomy.** The roster's first vehicle and first
addition since the original eight, introducing a new collision class (a
feature pinned at its own root, which can only clip inward toward its
parent rather than pull free of it) and confirming — for this character's
feature set specifically, not as a closed claim about every future vehicle
— that no new `ActorFrame` field was needed. See "Roster categories" in
`CONTRIBUTING.md`.

**Also**: `repository`/`homepage`/`bugs` added to `package.json` so the npm
page links back to source; two broken relative README links fixed;
`CHANGELOG.md` now ships in the tarball; a `LICENSE` file added.

## 0.8.0

**New character**: چرخی, the roster's first entry since the original eight
and its first vehicle — a new "vehicles with faces" category alongside
animals, the one fantasy creature (سیمرغ) and the one human kid (آوا). It has
no `head` layer (one continuous moulded body, the mechanical reading of
بومی's headless rule), no leg or arm layers (its wheels are static art, not a
joint — `walk`'s oscillating swing table is the wrong motion for something
that should spin), and `gaits: []`. Its twin roof antennas reuse the
`earL`/`earR` slots, pivoting at literal on-curve vertices of the torso's own
path data rather than a computed chord-midpoint — see "Roster categories" and
"Base-pinned features risk clipping inward, not detaching outward" in
`CONTRIBUTING.md`.

That second addition is a new collision class, not just a new character.
آوا's and خرسی's ear/pigtail guards protect against a feature *pulling free*
of its parent, because their pivot sits outside the parent's own silhouette.
چرخی's antennas are pinned at their own root and cannot detach by
construction — the only failure they can have is the opposite one, the
stalk's curve swinging back far enough to dip *under* the roofline it grows
from. That needed its own probe (`charkhiRoofY`, `charkhiAntennaClip`,
`charkhiAntennaClipOnset` in `tools/lib/probes.mjs`) rather than a reuse of
the existing penetration checks. The clip threshold is measured, not assumed:
swept across the full emotion × intensity grid to a worst-case clearance of
1.302 art units, with the actual clip-onset angle (≈69.7°) found by
bisection rather than guessed, and a mutation (`M47`) that regresses the
guard's own degenerate-sampling floor to confirm the check actually bites.

چرخی also answered a category-level question raised when the roster taxonomy
was first proposed: whether a vehicle needs its own `ActorFrame` field for
headlight-blink or wheel-spin. For this character, no — a headlight reads as
an `eyes` slot at this art scale, and wheel-spin is a locomotion-table
question rather than a frame field. That is scoped to what چرخی's own feature
set actually needed, not a closed claim about every future vehicle; see
"Roster categories" in `CONTRIBUTING.md` for the caveat.

## 0.7.0

Reduced motion, made actually reduced. Two features that scrub or hold a frame
via a paused CSS animation — `scrubGesture()`, and `pinGaitPhase()`'s
CSS-fallback branch for unlayered characters like سیمرغ — were silently
defeated under `prefers-reduced-motion`: `RIG_CSS`'s
`animation:none!important` cannot distinguish a deliberately paused hold from
a running animation, so it killed both, and a reviewer on a reduced-motion
browser saw nothing rather than the requested frame. Both now sample the pose
directly (`sampleAction`/`samplePhase`) and write it straight to `transform`,
bypassing `animation` entirely — the one path the stylesheet rule cannot veto.

`playGesture()` had the mirror problem: the gesture channel used to hold for
the full nominal duration via `setTimeout` even though the animation it was
waiting on was already invisible. It now resolves the channel at once under
reduced motion, the same way `apply()` snaps every other channel.

**New**: `RigOptions.reducedMotion?: boolean | 'auto'`, default `'auto'`.
`'auto'` reads `prefers-reduced-motion` from the OS exactly as before; `true`/
`false` force the rig into or out of reduced motion regardless of it, for a
consumer app's own accessibility setting or for a test that wants reduced
motion without depending on the environment. `render()` toggles a new
`.ca-reduced` class that is `RIG_CSS`'s manual twin of the `@media` rule, so a
forced override disables CSS-only motion identically to the OS setting.

Test coverage closed three gaps the same audit found: blink was never
independently confirmed to stay unscheduled under reduced motion, the rAF
loop that drives idle micro-motion and phase-driven locomotion was never
confirmed to not start, and the CSS-fallback hold above had no test at all —
the previous scrub tests only checked `animation-play-state`/`animation-delay`,
which would keep passing while a reduced-motion viewer saw nothing. See the
new "Accessibility: reduced motion" section in the README for the full
per-feature policy, and `CONTRIBUTING.md` for why reduced-motion tests use
`RigOptions.reducedMotion` rather than stubbing `window.matchMedia` (one test
is deliberately kept on the real OS query, to prove `'auto'` still works).

Also hardened `tools/lib/mutate.mjs`'s `runTests`: two of the new integration
tests initially skipped their `try/finally` cleanup on assertion failure
(unlike every other test in that file), so a killing mutant left a live timer
or rAF loop running after the test threw, hanging the mutation runner
indefinitely with the mutated file never restored. The tests now match the
file's established cleanup convention, and `runTests` now passes
`--test-timeout=10000` to `node --test` so any future stray handle fails the
run instead of hanging it — checked against the slowest legitimately-passing
test in the whole suite (1.74s), which leaves better than 5x headroom.

44 mutations now cover this reduction (M36–M44); 42 killed, 0 survived (one
pre-existing, unrelated invalid mutation not touched this round).

## 0.6.0

**Breaking**: the Persian viseme table shrinks from eleven shapes to five —
`rest`, `aa`, `mbp`, `u`, `l`. `e`, `i`, `o`, `f`, `sh` and `s` are gone;
`textToVisemes`/`PMAP` now route every letter that used to hit one of them to
its measured nearest survivor (`e`/`i` → `l`, `o`/`sh` → `u`, `f` → `rest`,
`s` → `l`). `viseme: 'o'` (etc.) now falls through `onInvalidFrame` like any
other unknown name instead of being accepted.

This is a legibility choice (max-min dispersion over the full pairwise
distance table, vowels and consonants dispersed separately so no merge
crosses that boundary), not a defect fix — the one genuine defect, `rest` and
`mbp` rendering identically on a beak character, was already fixed
independently and is what stayed pinned through every candidate table this
reduction considered. See the doc comment on `VISEMES` in `src/visemes.ts`
for the full measurement, including the one deliberately non-greedy call
(`س` merges into `l`, not the geometrically closer `rest`, because routing a
real consonant into the silence shape is the exact problem being fixed).

Also fixed: `tools/lib/speech.mjs`'s `mouthShape()` never parsed beak markup
at all (it always fell into the closed-mouth branch and read the wrong
`<path>`), so every prior A3 beak measurement reported `aperture: 0`
regardless of viseme. The lips-side numbers were unaffected except for the
`rest`/`mbp` pair itself, which a separate regex bug (a literal space in
`Q ` never matched) had been silently reporting via a hardcoded fallback.

## 0.5.1

An invalid frame value no longer throws. `rig.apply({ emotion: 'joy' })` used to
fail as `Cannot read properties of undefined (reading 'squint')` from inside a
render — a whole performance lost to one bad word, in a stack trace that never
named it. `viseme` and `gesture` had the same hole, on `apply()` and on
`playGesture()`/`scrubGesture()`.

The rig now **keeps what the character is already doing** and reports the
rejection through a new `onInvalidFrame` option (`{ channel, value, kept }`);
throwing from inside it restores fail-fast. Where there is nothing to keep — the
first frame, or a static `renderActorSVG` — the documented default applies. An
unknown *gesture* is the one exception and drops to `null`, since holding the
previous one would replay a movement the caller never asked for. `sanitizeFrame`
is exported for callers who would rather check before applying; a clean frame
comes back by identity, so `speak()` still allocates nothing per viseme.

`locomotion` and `facing` are covered too, for the opposite reason: they never
threw. `locomotion: 'run'` was accepted, stored, and then matched by nothing —
the character stood still, `rig.frame.locomotion` read back `'run'`, and no
signal of any kind reached the caller. A silent no-op is the worse of the two
failures; a crash at least names a line. Neither had a registry to interrogate,
so `types.ts` now exports `LOCOMOTIONS` and `FACINGS` and derives the unions
*from* those arrays, which makes the runtime list and the type one thing rather
than two that agree today. `rig.frame` no longer reports a state the character
is not in.

This is a robustness fix rather than a feature: the intended caller is a model
emitting frames as JSON, which is exactly the consumer whose `as ActorFrame` at
the boundary is a promise it cannot keep. The numeric channels were measured for
the same failure — `intensity: 'high'`, `mouthOpen: null`, `gaze: null` — and
none of them put a `NaN` into the DOM, so none of them are guarded.

Found by the 0.5.0 tarball smoke test, not by a unit test, and found by accident.
Ten new mutations (M17–M26) cover the ways this guard could have been hollow —
including one that corrects the value but tells nobody, and one that adds a
locomotion no gait implements. An eleventh was written and could not be applied:
deleting a value from `LOCOMOTIONS` does not compile, because the union is
derived from it. That is a stronger guarantee than a passing test, and it is
recorded in the catalogue rather than dropped.

## 0.5.0

Tooling and a studio. The library gained the pieces needed to *look* at what it
already did — and looking found real gaps, which are listed here with the rest.

### Sampling an action outside the browser

`sampleAction(action, t)` evaluates the same timeline `buildAction` serialises
into `@keyframes`, including the derived anticipation and settle, so an action
can be measured without a compositor. `sampleActionFrames` and `frameCount`
walk it at a frame rate. `actionStops()` stays the single source of truth: one
equivalence test asserts the sampler and the emitted CSS agree at every stop, so
the two cannot drift into separately-correct answers.

### Contact sheets, and one set of probes underneath them

Three generators — `tools/sheets/gestures.mjs`, `emotions.mjs`, `seams.mjs` —
render every cell off a **real mounted rig** rather than restating the rig's
maths in the tool. That distinction is the whole point: the three per-character
comparison sheets they replace stood up their own renderers and string-injected
recomputed transforms, so they depicted what the author believed the rig wrote.
`tools/lib/probes.mjs` is now the only home for pivot and seam geometry, is
documented as test-load-bearing, and is mutated like `src/`.

### Numeric baselines

`tools/baselines/geometry.json` holds 200 measurements — pivots, seams, rim
solutions, per-gesture worst clearances, gesture routing. `npm run baseline`
names what moved and by how much; `test/baseline.test.mjs` runs the same
comparison so the file cannot go stale. No image diffing: a pixel diff over 600
frames always says "something changed" and never says what.

### The studio: preview, picker, scrub

- `characterRoster()` and `createCharacterPicker()` ship in the package, with a
  React `<CharacterPicker>` twin. Two implementations, one roster, neither
  containing a list of characters — a test enumerates both and asserts they
  agree with `CHARACTER_SLUGS`.
- `rig.scrubGesture(g, t)` holds a gesture at a fraction of its timeline by
  pausing its real animation on a negative delay; `rig.pinGaitPhase(p)` holds a
  gait by pinning the driver's phase (or, for an unlayered character, by pausing
  the CSS cycle). Two mechanisms, because they are not interchangeable, and the
  studio reports which one it used.
- `rig.planFor(g)` is public: ask what would happen before asking for it.
- The studio steps a clip a frame at a time and marks the *derived*
  anticipation and settle windows under the slider — the beats that appear in no
  `poses` array and had never actually been looked at.

### Guards found by the new tooling

Two gaps existed that no threshold test could see, because both stayed inside
their margins while being wrong:

- The seam probe ignored the squash channels. Dropping them moved لاکی's mouth
  by less than half a unit against a one-unit floor.
- Every لاکی measurement sat within 0.2 units of the shell apex, where the rim
  genuinely is `y=76` — so a probe returning a flat 76 passed everything. The
  rim is now solved from the shipped shell path and compared at 40 samples per
  segment.

Also corrected: a doc comment in the probes claiming a "3.00 → 2.05" clearance
that does not reproduce. The real figures are 4.000 authored, 3.046 derived, and
they now live in the baseline rather than in a comment where a stale number can
hide.

### Verification of the verification

Three times, a check had *looked* clean when it had not run. `npm run mutate`
now refuses to report `killed` unless the file bytes actually changed and a
declared `expect`/`absent` post-condition holds; a crashed suite reports
`crashed`, not a kill. 16 mutations are checked in. `test/studio.test.mjs` boots
`examples/studio.html`'s own module script in jsdom, so a renamed export breaks
the suite rather than only the page. See `CONTRIBUTING.md`.

### Docs

README restructured around using the library; the internals moved to
`DESIGN.md`; `CONTRIBUTING.md` added.

## 0.4.1

Packaging and docs only — no runtime change.

- Added `repository`, `homepage` and `bugs` to `package.json`. Without them the
  npm page had no link back to the source at all, which is the root cause of the
  broken links below.
- Fixed two relative README links. npm resolves relative links against
  `npmjs.com`, so `examples/studio.html` became a 404 at
  `npmjs.com/package/examples/studio.html`. Now absolute GitHub URLs, and the
  studio section says plainly that `examples/` is not part of the package.
- The roster line listed seven characters; there are eight. `simorgh` was
  missing, despite being referenced elsewhere in the README as the unlayered
  fallback case.
- `CHANGELOG.md` now ships in the tarball.

## 0.4.0

### Gesture registry

Moved out of `rig.ts` into `src/gestures.ts`. Six new gestures — `nod`,
`shake`, `shrug`, `point`, `clap`, `bounce` — joining `wave`/`jump`/`spin`, all
inheriting derived anticipation and settle rather than authoring it per
keyframe. A gesture is now a *list* of parts started in the same tick, so a
two-armed clap or shrug cannot drift a frame apart.

Availability is two independent axes, kept apart deliberately:

- **Structural** — the limb is missing, the character opted out, or a driven
  gait owns the layer. Recoverable: the whole-body fallback plays. Derived from
  what a gait `tracks`, not what it `requires`, so a wave during a driven walk
  correctly falls back even though a walk needs only legs.
- **Semantic** — the action makes no sense in that locomotion state (you cannot
  jump off the air). Authored per gesture, and it *blocks*: nothing plays, and
  the new `onGestureBlocked` callback tells the driver rather than leaving the
  channel held.

`planGesture()` answers "what would happen if I asked for this now" without
playing it. New `CharacterSpec.gestureFallback` lets a character send a gesture
to its whole body despite having the limb — لاکی's nod would otherwise put its
mouth under the shell rim. Declared rather than inferred, for the same reason
`gaits` is; a test re-derives the list from the shipped keyframes and fails if
it drifts in either direction.

### Emotions: گیج, مغرور, خجالتی

`confused`, `proud` and `shy`, each with its own brow shape, gaze bias, blink
style and posture. گیج is the only asymmetric brow on the roster, which is what
makes it read as confusion rather than surprise.

Distinctness is verified against the shipped roster's **own** minimum pair
separation (happy/love) rather than a threshold picked by hand, so it stays
honest if the existing emotions are retuned.

Two per-character posture overrides were required, and the existing seam guards
found both: لاکی's `proud`/`shy` walked out of its measured headDrop window
(the head sits behind its shell, so the window is bounded on both sides), and
تندپا's `proud` pulled its head off the body seam.

### Gaze and eye realism

Where the eyes point is now three things stacked — the frame's `gaze` (always
dominant), the emotion's own bias scaled by `intensity`, and an idle saccade —
clamped as a sum, so an emphatic driver gaze absorbs the bias instead of
fighting it.

The saccade is procedural: a 0.5–2.6s dwell, then a 35–70ms ease-out dart to a
nearby point, damped while walking or flying. Nothing the driver has to request
per frame. `micro: { saccade: 0 }` pins the eyes without freezing the body.

Blink rate and lid weight vary by emotion — `surprised` fastest and lightest,
`sleepy` slowest and heaviest, `shy` most likely to come in pairs. The table is
now **total** over `EmotionName` rather than sparse over a default, which is how
`surprised` had been silently sitting on the neutral blink since it was added.

### Notes

- `EmotionSpec.mouth` is documented as currently unread — `drawMouth` is driven
  entirely by `viseme` + `mouthOpen`. Wiring it would change the resting face of
  nine shipped emotions, which has not been decided.
- 253 tests (was 216); every new guard mutation-verified.

## 0.3.0

Per-character emotion overrides (`EmotionOverrides`), and the roster conversion
to layered limbs with phase-driven locomotion across all seven layered
characters. Gait eligibility became declared (`CharacterSpec.gaits`) rather than
inferred from limb structure.

## 0.2.0

سیمرغ added as a full actor character; kept deliberately unlayered as the
CSS-fallback case.

## 0.1.0

Initial publishable release.

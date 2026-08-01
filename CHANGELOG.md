# Changelog

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

# Changelog

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

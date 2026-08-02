# Contributing

```
npm install
npm test          # builds, then runs test/*.test.mjs against dist/
npm run sheet     # regenerates the contact sheets into out/ (gitignored)
npm run baseline  # shows what moved against tools/baselines/geometry.json
npm run mutate    # breaks the library on purpose, checks the guards notice
npm run demo      # builds, then serves example/studio on a local port
```

## Verifying the verification

Three separate times, a check has *looked* like it ran clean when it had not
run at all: a grid whose quantization compared a value against itself, a
mutation patch that never applied and was read as a surviving mutant, and four
`grep`/`perl` patterns with regex errors that matched nothing. All three are the
same shape — **absence of evidence rendered as evidence of absence** — and all
three were in the tooling, not the library.

So the two verification tools now refuse to produce a clean-looking result they
have not earned:

- **`npm run mutate`** applies each mutation in `tools/mutations.mjs` to `src/`
  (or to `tools/lib/probes.mjs`), recompiles, and runs the guards. It reports
  `not-applied` — never `killed`, never `survived` — unless the file bytes
  actually changed *and* the declared `expect`/`absent` post-condition holds.
  Every mutation must declare one; the runner refuses to start otherwise. A
  suite that crashes on import reports `crashed` rather than counting as a kill,
  since a broken loader fails every assertion for free. Add a mutation whenever
  you add a guard.
- **`npm run baseline`** compares every measurement to
  `tools/baselines/geometry.json` and names what moved by how much.
  `test/baseline.test.mjs` runs the same comparison, so the file cannot go
  stale. Accept a diff with `npm run baseline -- --write`, after reading it.

Sheets are gitignored, baselines are not, and there is no image diffing: a pixel
diff over 600 rendered frames always says "something changed" and never says
what.

The same rule applies to the example. `examples/studio.html` is the only place
the library is assembled the way a user assembles it, and nothing compiles it —
a renamed export breaks the page and no test notices. So `test/studio.test.mjs`
extracts the page's own module script, points its one import at `dist/`, and
runs it in jsdom: if the studio would throw on load, the suite fails. It drives
the transport too, which is why the picker and scrub mutations (M14–M16) list it
alongside their unit tests.

## Layout

| path | what it is | shipped? |
| --- | --- | --- |
| `src/` | the library | yes |
| `dist/` | `tsc` output; tests run against this, not `src/` | yes |
| `test/` | `node:test`, jsdom with a manual clock | no |
| `tools/` | contact-sheet generators and the geometry probes they share | no |
| `examples/` | the studio, booted for real by `test/studio.test.mjs` | no |

## `tools/lib/probes.mjs` is test-load-bearing, despite living outside `src/`

`tools/` is excluded from the published package and nothing in `src/` imports
it — but `test/rig-cache.test.mjs` imports `tools/lib/probes.mjs`, and so do the
sheet generators in `tools/sheets/`. **Breaking or deleting that module breaks
the test suite.** It is not scratch work.

The placement is deliberate. Those functions describe the *art* — where لاکی's
shell rim runs, where تندپا's head crosses its body — not the library's
behaviour, so they have no business shipping to consumers. But a guard and a
contact sheet have to measure the same geometry with the same function, or a
sheet that looks right and a test that passes stop being the same claim. Before
that module existed the rim solver had three copies and the disc-crossing sweep
had two, and they had already drifted.

If you add geometry that a test asserts on, put it there rather than inline in
the test.

## Rules the test suite is written to

- **Measure, don't invent.** Pivots come from the shipped spec via
  `headPivot()`; silhouettes are measured off the drawing and written down once,
  in `probes.mjs`. A test that keeps its own copy of an origin goes on passing
  after the real one moves.
- **Sweep the derived timeline, not the authored poses.** `buildAction` adds an
  anticipation beat and four settle beats that appear in no `poses` array, and
  the anticipation always loads *downward*. Use `sampleAction` /
  `worstOverAction`, not `action.poses`. A guard written the other way reported
  3.00 units of لاکی mouth clearance where the real timeline has 2.05.
- **Mutation-verify new guards.** Before trusting a new assertion, break the
  thing it protects in `dist/` and confirm the test fails. Always check the
  mutation actually applied — a pattern that silently matched nothing looks
  exactly like a passing suite.
- **`sampleAction` is not a second animation engine.** It and `buildAction` both
  read `actionStops()`. If you change the derivation, change it there;
  `test/sample.test.mjs` asserts the two agree by parsing the stops back out of
  the emitted `@keyframes`.
- **Reduced motion: use `RigOptions.reducedMotion`, not `window.matchMedia`
  stubbing**, except in the one test (`test/rig-integration.test.mjs`,
  `'prefers-reduced-motion snaps instead of easing (real OS query)'`) that
  exists specifically to prove the `'auto'` default still reads the OS query
  for real. Every other reduced-motion test mounts with
  `{ reducedMotion: true }` (or `false`, to prove the override beats a
  reduced-motion OS stub). jsdom does not evaluate CSS `@media` queries or
  `!important` cascading against inline styles, so a reduced-motion assertion
  can only check the *mechanism* — an inline `style.transform`/`style.animation`
  value, a class, a field like `rig.blinkTimer` — never the rendered picture.

## Reduced motion has two independent enforcement paths — cover both

`RIG_CSS`'s stylesheet rule (plus its manual twin, the `.ca-reduced` class)
kills every CSS `animation`/`transition`; `this.reduced` in `rig.ts` separately
gates blink scheduling, the tick loop, and `apply()`'s synchronous finish.
Anything that used to rely on the stylesheet rule *alone* — a paused scrub
hold using `animation-play-state`, a playing gesture waiting out a
`setTimeout` — turned out to be silently defeated under real reduced motion,
because `animation:none!important` cannot tell a paused animation from a
running one. A new feature that adds CSS-driven motion needs to ask which of
the two paths would actually suppress it, not assume the stylesheet rule
covers everything JS starts.

## The wing-hook convention: two ways to animate a wing, never both at once

There are two entirely separate mechanisms for flapping a wing in this
codebase, and a character must use exactly one of them.

**Unlayered fliers** get a CSS-only `.wingL`/`.wingR` class, hardcoded in
`RIG_CSS` (`src/rig.ts`) with a fixed `transform-origin` and a `@keyframes`
animation that runs whenever `.loco-fly` is on the root: `.ca-svg.loco-fly
.wingL{transform-origin:50px 110px;animation:caWingL .4s ease-in-out
infinite}`. سیمرغ is the worked example — it never converted to the layered
rig, so it still carries this pair of classes and nothing else drives its
wings.

**Converted characters** (a character with `farArm`/`nearArm` layers in
`RigLayers`) are driven instead by the phase table in `locomotion.ts`,
writing a per-frame inline `transform` to `.lyr-farArm`/`.lyr-nearArm`.
بومی is the worked example, and its docstring in `characters/index.ts`
records the bug that made this a rule rather than a preference: an earlier
version of بومی nested the legacy `.wingL`/`.wingR` wrapper *inside* the
`lyr-farArm` layer, so a flying بومی matched both `.loco-fly .wingL` (the
CSS keyframe animation) and `.loco-fly .lyr-farArm` (the locomotion table's
inline transform) at once — two different pivots animating the same
element, fighting each other every frame. The fix was not a CSS
specificity tweak; it was deleting the legacy wrapper outright once a
character is converted. There is no valid state where a converted
character keeps the old hook "just in case."

The two conventions are kept apart by `canDrive()` deciding which gait a
character's layer shape actually supports, and guarded by a test in
`rig-cache.test.mjs` (`'no character carries both wing conventions at
once'`) that would catch exactly the بومی regression above — a character
that both has `farArm`/`nearArm` layers *and* still emits a
`.wingL`/`.wingR` class is asserted to not exist.

## The head/torso pivot rule: a layer exists only if the drawing has that joint

Posture and the gait tables send identical numbers to every character —
`headDrop: 5`, `ears: 34` — so whether a given character even has a `head`
layer (and therefore something for those numbers to land on) is not a
stylistic choice; it decides whether the same posture value reads as a nod
on one character and nothing at all on another. The rule, documented on
`RigLayers` in `types.ts`: a `head` layer exists only if there is a
**determinate line where the head meets the body** that can be measured off
the drawing. No such line, no `head` layer — the character's face is drawn
straight onto `torso` instead, and `headTilt`/`headDrop` land on nothing,
the same dead end as `tail` droop on a character with no tail.

بومی is the worked example for the "no" case: an owl is one continuous
barrel from talons to tufts, with no line anywhere that could be called
where the head ends and the body begins. It has no `head` layer at all —
the facial mass (discs, eyes, brows, beak) is drawn straight onto
`lyr-torso`. The nod بومی *does* have is a whole-body lean, because that is
genuinely what an owl does, not a substitute for a head nod it is missing.

آوا is the worked example for the "yes, even without a neck" case: she has
no drawn neck (it is hidden under her hair), which could look like another
"one continuous form" character at a glance. But her head and dress are two
distinct forms meeting on a definite collar line at y≈140 — a real edge in
the art, not an invented one — so she keeps a `head` layer with its pivot
measured off that line, per her docstring in `characters/index.ts`. The
distinction the rule is drawing is specifically *this*: not "does the
character have a visible neck," but "is there a line in the drawing itself
the pivot can be read off," and a collar counts exactly as much as a neck
does.

## Z-order bugs hide from `LAYER_ORDER` when they live inside one art string

`LAYER_ORDER` (in `types.ts`) and the `LAYER_ORDER matches the order
buildLayers actually paints` test guard *layer*-level paint order — `earL`
before `head` before `torso`, and so on. They cannot see anything that
happens inside a single layer's `art` string, because to `buildLayers` that
string is one opaque blob of SVG, painted as a unit whichever layer it
belongs to.

آوا's face/crown collision (fixed in `e2d956d`) is the worked example. Her
`head.art` hand-concatenates several `<path>`/`<circle>` elements — the crown
dome, the face-skin circle, an eye-socket shadow overlay — as one string, in
source order. At one point the crown was written *before* the face circle, so
the face circle's opaque fill painted over almost the entire crown, leaving
only two thin slivers visible at the sides. `LAYER_ORDER` had nothing to say
about this: `head` painted exactly where it was supposed to, relative to every
other layer. The bug was entirely inside `head`'s own art string, in the order
its pieces were concatenated in `characters/index.ts`.

This is a distinct class from a `LAYER_ORDER` mismatch and from a pivot
measured off the wrong point (see "Measure, don't invent" above) — it needs
its own guard because neither of those checks exercises it:

- A `LAYER_ORDER` test would pass unchanged; the layer itself is in the right
  place.
- A pivot/geometry probe would also pass; nothing about rotation or overlap
  changed, only which of two *already-correct-position* shapes paints on top.

The guard that catches it has to read the rendered SVG string directly and
assert the relative order of two specific, identifiable substrings from
*inside* the same layer's art — see `ava's hair crown paints after her face,
not before it` in `test/rig-cache.test.mjs`, which locates the face circle's
fill and the crown path's `d` prefix by content (not by index into
`LAYER_ORDER`, which doesn't reach this far) and asserts one precedes the
other in the emitted markup.

If a character's `art` string grows more than two or three hand-ordered
pieces that visually stack (skin under hair under an overlay shadow, say),
each new stacking relationship that matters needs its own such assertion —
`LAYER_ORDER` will not warn you, and at rest the whole thing can still look
right for one emotion/intensity and wrong for another if any of the pieces
move independently.

## Characters

سیمرغ is deliberately unlayered — it is the CSS-fallback case, and several
cross-character tests exist only because it and بومی have no `head` layer.
Keep at least two headless characters in the roster; `rig-crosschar.test.mjs`
asserts this, because that is the shape that broke blink parenting twice.

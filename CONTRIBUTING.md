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
infinite}`. سیمرغ was the worked example through v1.2.0; it is layer-rig
converted as of v1.3.0 (see CHANGELOG), so as of this version no character in
the roster actually exercises this path — the rules stay in `RIG_CSS` for
whichever future character is added unlayered, and `rig-cache.test.mjs`'s
`'no character carries both wing conventions at once'` test still guards
against a converted character keeping them by mistake.

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

## Base-pinned features risk clipping inward, not detaching outward

آوا's and خرسی's ear/pigtail pivots (see "Measure, don't invent" above) are
chord-midpoints because the drawn feature's own visual centre sits *outside*
the parent silhouette it overlaps — there is no drawn base to read a pivot
from, so the guard that matters is whether rotating it can pull the whole
feature free of the parent disc (`avaPigtailPenetration`,
`khersiEarPenetration` in `tools/lib/probes.mjs`).

Not every feature is built that way. Some are rooted exactly on the parent's
own silhouette — the origin is a literal coordinate that already appears in
the parent's path data, not a computed intersection. A feature like that
*cannot* detach by rotating about a point that already is the parent's own
edge; the failure direction is the opposite one. What it can do is swing back
far enough that its own drawn curve dips back *under* the edge it grows from —
clipping in, never pulling out — and a penetration guard built for the
detach case measures the wrong thing entirely for it.

چرخی is the worked example. Its twin roof antennas reuse the `earL`/`earR`
slots, but their origins — `(58, 80)` and `(142, 80)` — are the exact
endpoints of the roof-shoulder cubics in the torso body's own `art` path
string (see چرخی's docstring in `src/characters/index.ts`), the same
on-curve-vertex convention بومی's headless tuft origins use, not the
two-circle chord-midpoint آوا's and خرسی's pivots use. Because the pivot sits
on the roofline itself, an antenna cannot pull free of the body by
construction — there is nothing for `avaPigtailPenetration`-style overlap
math to ever catch. The real risk is the stalk's own curve swinging low
enough to dip under the roofline it grows from, so it needed a new probe
rather than a reuse of the existing one: `charkhiRoofY` (a real-cubic
evaluator over the painted roofline, the same binary-search-over-Bezier-`t`
technique `lakiRimY` uses) and `charkhiAntennaClip`, which rotates sampled
points along the antenna's own curve about the roofline pivot and measures
clearance against `charkhiRoofY`, in `tools/lib/probes.mjs`.

The threshold itself is measured, not assumed, the same discipline every
other guard margin in this file follows: `charkhiAntennaClip` is swept across
the full emotion × intensity grid in `test/charkhi.test.mjs`
(`"چرخی's antennas never clip into the roofline across the full emotion x
intensity range"`), finding a worst-case clearance of 1.302 art units (sad,
intensity 1), and the rotation at which clipping would actually *begin* is
found by bisection (`charkhiAntennaClipOnset`, asserted in the same file's
`"the clip onset is well clear of what چرخی's own posture map ever asks
for"`) at ≈69.7°, roughly 3.9× چرخی's own largest declared `ears` travel
(18°, at `sad`). `tools/mutations.mjs` (`M47`) regresses
`charkhiAntennaClip`'s own degenerate-sampling floor — reintroducing the
trap caught during development, where sampling starts exactly at the
antenna's pivot and reports a trivially-zero margin against any wall,
swamping the real signal — and is killed by the same test.

## Characters

سیمرغ is deliberately unlayered — it is the CSS-fallback case, and several
cross-character tests exist only because it and بومی have no `head` layer.
Keep at least two headless characters in the roster; `rig-crosschar.test.mjs`
asserts this, because that is the shape that broke blink parenting twice.

### Roster categories

The nine-character roster spans four categories, and the same `ActorFrame`
contract is expected to drive all of them without a character-specific
escape hatch:

- **Animals** — `roozi`, `pashmak`, `laki`, `tondpa`, `boomi`, `khersi`. The
  largest group, and the one the original `ActorFrame` shape (emotion, gaze,
  visemes, `walk`/`fly` gaits) was designed against.
- **Fantasy creature** — `simorgh`. Layer-rig converted as of v1.3.0
  (wings → `farArm`/`nearArm`, crest feathers stay inside `head`, tail
  feathers get their own `tail` layer) — see "The wing-hook convention"
  above and the v1.3.0 CHANGELOG entry for why the tail pivot sits level
  with the wings rather than at the fan's own visual centre.
- **Human kid** — `ava`, the one character with a drawn neck/collar line
  rather than an animal's continuous head-to-body form (see "The head/torso
  pivot rule" above).
- **Vehicles with faces** — `charkhi`, so far the only member. No wheels,
  legs, arms or head layer; antennas standing in for the `earL`/`earR` slots.

چرخی's build confirmed a category-level question raised when the taxonomy
was first proposed: does a vehicle need its own `ActorFrame` field, for
headlight-blink or wheel-spin? For چرخی specifically, no — headlight-blink is
modeled as `eyes` (a headlight reads as an eye at this art scale), and
wheel-spin is a `gaits`/locomotion-table question, not a frame field. `1.1.0`
answered the locomotion-table half of that, partially: `charkhi.gaits` is now
`['roll']`, driving a suspension bob on `root`/`torso` — the same mechanism
`walk`/`fly` already use for their body-mechanic half. The wheels themselves
are still static art baked into `torso`, unchanged; nothing about them
independently rotates. Literal wheel-spin would still mean splitting them out
into their own layer and re-deriving `torso`'s paint order (its highlight/
shadow gradients currently sit over the wheels), which is real, separate
work, not done as part of `roll`. That is a finding about *this* vehicle's
feature set, not a closed claim about the category: a future vehicle with
genuinely novel semantics — turn signals driven as their own distinct
gesture, say, rather than a repurposed blink — could still need a real
extension. Treat "vehicles need no `ActorFrame` extension" as true of one
worked example, not as roster-wide policy, until a second vehicle either
confirms or breaks it.

## Architecture: measured and documented, not acted on

Two questions came up in the architecture review that followed چرخی — skins/
variants, and splitting the character bundle. Both were investigated,
measured, and deliberately left unbuilt. Recorded here so the next person
who wonders about either does not re-derive the same analysis, and knows
what would actually justify picking it back up.

### Skins/variants: not built

Color is not a separable concept anywhere in this codebase today. Every
character's `render()` closes directly over hardcoded hex literals in
gradient `<stop>` definitions and `fill=` attributes, fully interleaved with
the geometry in one template string — لاکی's shell alone has five gradients
and 11 hardcoded colors in `src/characters/index.ts`. `lidColor`/`browColor`
on `CharacterSpec` are the only colors that exist outside an `art` string,
and neither is meant as a palette hook; they're just the two values blink
and brows happen to need at the type level.

A real skin system needs a `palette` field separating color tokens from
shape, every render function in `characters/index.ts` rewritten to consume
palette values instead of closing over literals, and a stable ID scheme for
gradients (currently unique per character — a second palette on the same
character needs either duplicated `<defs>` or dynamically generated IDs).
That is a rewrite of the whole file, not an additive field.

No character has an actual second-look request. This is the same rule
argued everywhere else in this document: don't add a field speculatively.
**Revisit trigger**: a real request for a second look on an *existing*
character (a second livery for چرخی, say). When that happens, build it for
that one character first, as the worked example — the same process every
other pattern here went through — and only generalize the palette shape
once a second case confirms it.

### Bundle splitting: not built

Measured, not assumed: the packed tarball is 130KB (`npm pack --dry-run`),
of which `dist/characters/index.js` — the single object literal holding all
nine `CharacterSpec`s — gzips to about 15KB, roughly 1.5KB marginal per
character. The rig engine a consumer pulls in regardless of roster size
(`rig.js` and its transitive deps) gzips to about 13KB on its own, a fixed
cost unrelated to how many characters exist.

The specific limitation: `CHARACTERS` is assembled as one `const` from all
nine character modules in a single file. Standard bundler tree-shaking
(webpack/esbuild/rollup) does not eliminate unused *properties* of an object
literal, even for a statically-known access like `CHARACTERS.laki` — the
whole object is one escaping binding, so an app that renders exactly one
character still pays for all nine character art strings. That per-character
cost (~1.5KB gzip) is added permanently, for every consumer, with every
future roster addition, whether or not they use it.

This is co-dependent with the picker: `characterRoster()` and
`createCharacterPicker` (`src/picker.ts`) always enumerate the full
`CHARACTER_SLUGS`, with no option to pass a subset. Splitting the character
*data* alone does not help any consumer using the built-in picker — it only
helps an app that embeds one fixed character and never shows the picker. A
real fix has to address both the data (so an unused character's art is
never bundled) and the picker (so it can be asked for a subset instead of
the whole roster).

Three ways to split the data, if it comes to that:

1. **Per-character subpath exports** (`pixel-wizards-charachters/characters/laki`),
   via `package.json`'s `exports` map — real static tree-shaking, additive,
   doesn't touch the existing `CHARACTERS` import.
2. **Runtime `loadCharacter(slug)`** via dynamic `import()` — probably the
   better real-world fit, since most consumers choose a character by a
   runtime string (a user's selection), which a static per-character import
   can't tree-shake away anyway.
3. **Category-level subpath exports** matching the taxonomy above (animals /
   fantasy / human / vehicles) — coarser, less surface area to add, but
   still couples e.g. all six animals together.

**Revisit trigger**: the roster roughly doubling (~18-20 characters, where
the marginal cost compounds to something actually worth avoiding), or an
actual reported bundle-size complaint from a consumer. 15KB gzip for the
entire current roster is not a real problem yet.

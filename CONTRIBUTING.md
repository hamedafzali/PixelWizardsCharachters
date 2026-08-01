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

## Characters

سیمرغ is deliberately unlayered — it is the CSS-fallback case, and several
cross-character tests exist only because it and بومی have no `head` layer.
Keep at least two headless characters in the roster; `rig-crosschar.test.mjs`
asserts this, because that is the shape that broke blink parenting twice.

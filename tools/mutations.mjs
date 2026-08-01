/**
 * The mutation catalogue: one entry per claim the test suite is supposed to be
 * making, written as the smallest edit that would falsify it.
 *
 * These are checked in for the same reason the geometry probes are — a mutation
 * run that only ever existed in somebody's shell history is a claim nobody can
 * re-check. Run them with `npm run mutate`.
 *
 * Every entry states `expect`: literal text that must appear in the mutated
 * file. That is the second lock. `tools/lib/mutate.mjs` already refuses to
 * report a result when the bytes did not change, and `expect` catches the other
 * half — a pattern that changed *something*, but not the thing intended.
 */

import { replace } from './lib/mutate.mjs'

const SAMPLE = ['test/sample.test.mjs']
const CACHE = ['test/rig-cache.test.mjs']
const BOTH = ['test/sample.test.mjs', 'test/rig-cache.test.mjs']
const CROSS = ['test/rig-crosschar.test.mjs']
// The studio example is booted for real by test/studio.test.mjs, so it is a
// live guard on the picker and the transport, not just documentation.
const PICKER = ['test/picker.test.mjs', 'test/studio.test.mjs']
const SCRUB = ['test/scrub.test.mjs', 'test/studio.test.mjs']
const VALIDATE = ['test/validate.test.mjs']

export default [
  // ── blink lids are parented where the eyes are ─────────────────────────────
  {
    id: 'M1',
    note: 'lids are parented to .rig-flip, outside all three transform carriers',
    file: 'src/rig.ts',
    tests: CROSS,
    mutate: replace(
      'const eyeParent = this.eyeGs[0]?.parentNode as SVGElement | null | undefined',
      'const eyeParent = this.svg.querySelector<SVGElement>(\'.rig-flip\')',
    ),
    expect: "const eyeParent = this.svg.querySelector<SVGElement>('.rig-flip')",
  },
  {
    id: 'M2',
    note: 'lids are parented to the svg root — wrong eyes entirely when facing left',
    file: 'src/rig.ts',
    tests: CROSS,
    mutate: replace(
      'const eyeParent = this.eyeGs[0]?.parentNode as SVGElement | null | undefined',
      'const eyeParent = this.svg',
    ),
    expect: 'const eyeParent = this.svg\n',
  },

  // ── the sampler agrees with the animation the browser plays ────────────────
  {
    id: 'M3',
    note: 'sampleAction ignores the easing curve and lerps linearly',
    file: 'src/sample.ts',
    tests: SAMPLE,
    mutate: replace('const eased = curve === null ? local : easeBezier(curve, local)', 'const eased = local'),
    expect: 'const eased = local\n',
  },
  {
    id: 'M4',
    note: 'sampleAction snaps to the nearest stop instead of interpolating',
    file: 'src/sample.ts',
    tests: SAMPLE,
    mutate: replace('return lerpPose(p0, p1, eased)', 'return lerpPose(p0, p1, eased < 0.5 ? 0 : 1)'),
    expect: 'eased < 0.5 ? 0 : 1',
  },
  {
    id: 'M5',
    note: 'sampleAction does not clamp t past the end of the action',
    file: 'src/sample.ts',
    tests: SAMPLE,
    mutate: replace('if (t >= last[0]) return lerpPose(last[1], last[1], 0)', ''),
    absent: 'if (t >= last[0])',
  },
  {
    id: 'M6',
    note: 'parseEasing guesses ease-in-out for input it cannot parse, e.g. steps()',
    file: 'src/sample.ts',
    tests: SAMPLE,
    mutate: replace('if (m === null) return null', "if (m === null) return EASING_KEYWORDS['ease-in-out'] as Bezier"),
    expect: "if (m === null) return EASING_KEYWORDS['ease-in-out'] as Bezier",
  },

  // ── the derivation buildAction and sampleAction share ──────────────────────
  {
    id: 'M7',
    note: 'the derived anticipation stop is dropped from actionStops',
    file: 'src/timing.ts',
    tests: BOTH,
    mutate: replace('if (ant > 0) stops.set(antT, anticipationPose(peakOf(a.poses), ant))', ''),
    expect: '\n\n  const n = a.poses.length',
  },
  {
    id: 'M8',
    note: 'the anticipation loads upward instead of down — inverts the load-up on every action',
    file: 'src/timing.ts',
    tests: BOTH,
    mutate: replace('y: (up * 0.14 + 2.4) * k,', 'y: (up * 0.14 + 2.4) * -k,'),
    expect: '2.4) * -k,',
  },

  // ── the probes the guards are built out of ─────────────────────────────────
  //
  // tools/lib/probes.mjs is test-load-bearing (see CONTRIBUTING.md), so it gets
  // mutated exactly like src/. It is not compiled, so no build step applies.
  {
    id: 'M9',
    note: 'poseAt ignores the squash channels, measuring a pose the rig never holds',
    file: 'tools/lib/probes.mjs',
    tests: CACHE,
    mutate: replace('const u = (x - px) * sx\n  const v = (y - py) * sy', 'const u = (x - px)\n  const v = (y - py)'),
    expect: 'const u = (x - px)\n  const v = (y - py)\n',
  },
  {
    id: 'M10',
    note: 'worstOverAction samples only the endpoints — the pre-tooling behaviour',
    file: 'tools/lib/probes.mjs',
    tests: CACHE,
    mutate: replace('for (let i = 0; i <= steps; i++) {\n    const t = i / steps',
      'for (const t of [0, 1]) {'),
    expect: 'for (const t of [0, 1]) {',
  },
  {
    id: 'M11',
    note: 'lakiRimY returns a flat 76 instead of solving the shell cubics',
    file: 'tools/lib/probes.mjs',
    tests: CACHE,
    mutate: replace('export function lakiRimY(x) {', 'export function lakiRimY(x) {\n  return 76'),
    expect: 'export function lakiRimY(x) {\n  return 76',
  },
  {
    id: 'M12',
    note: 'discBodySeamY returns the disc centre — the pivot error it exists to catch',
    file: 'tools/lib/probes.mjs',
    tests: CACHE,
    mutate: replace('seamY: cross.length === 2 ? (cross[0][1] + cross[1][1]) / 2 : NaN', 'seamY: disc.cy'),
    expect: 'seamY: disc.cy',
  },
  {
    id: 'M13',
    note: 'headPivot restates an origin instead of reading it off the shipped spec',
    file: 'tools/lib/probes.mjs',
    tests: CACHE,
    mutate: replace("export function headPivot(slug, layer = 'head') {",
      "export function headPivot(slug, layer = 'head') {\n  return [100, 78]"),
    expect: 'return [100, 78]',
  },

  // ── the studio surface: picker, scrub, pin ────────────────────────────────
  //
  // These guards are young and their failure modes are quiet — a picker that
  // shows one character, a slider that moves a number and nothing else. Each
  // one below is the shape of the bug the guard was written for.
  {
    id: 'M14',
    note: 'the roster stops at the first character — the drift a hardcoded picker list would have',
    file: 'src/picker.ts',
    tests: PICKER,
    mutate: replace('return CHARACTER_SLUGS.map((slug) => {', 'return CHARACTER_SLUGS.slice(0, 1).map((slug) => {'),
    expect: 'CHARACTER_SLUGS.slice(0, 1).map',
  },
  {
    id: 'M15',
    note: 'a scrubbed gesture always seeks to frame 0 — the slider moves, the rig does not',
    file: 'src/rig.ts',
    tests: SCRUB,
    mutate: replace('el.style.animationDelay = `${-Math.max(0, Math.min(1, t)) * part.action.dur}s`',
      "el.style.animationDelay = '0s'"),
    expect: "el.style.animationDelay = '0s'",
  },
  {
    id: 'M16',
    note: 'the pinned phase is not re-applied after the driver advances, so the cycle runs on under the scrub',
    file: 'src/rig.ts',
    tests: SCRUB,
    mutate: replace('if (this.pinnedPhase !== null && gait !== null) this.loco.phase = this.pinnedPhase', ''),
    absent: 'if (this.pinnedPhase !== null && gait !== null)',
  },

  // ── invalid frame values ──────────────────────────────────────────────────
  // A guard against a crash is the easiest kind of guard to write vacuously:
  // catch everything, do nothing, and the test that only asserts "did not
  // throw" is happy. These six are all the ways this one could be hollow.
  {
    id: 'M17',
    note: 'the frame is validated and then used unvalidated anyway — the original crash, restored',
    file: 'src/validate.ts',
    tests: VALIDATE,
    mutate: replace('  return out ?? frame\n', '  return frame\n'),
    absent: 'return out ?? frame',
  },
  {
    id: 'M18',
    note: 'a bad value is corrected silently — the driver is never told it is sending names the library cannot use',
    file: 'src/validate.ts',
    tests: VALIDATE,
    mutate: replace('    onInvalid?.({ channel, value, kept })\n', ''),
    absent: 'onInvalid?.(',
  },
  {
    id: 'M19',
    note: "policy (b): an unknown emotion resets the face to neutral instead of keeping what the character is wearing",
    file: 'src/validate.ts',
    tests: VALIDATE,
    mutate: replace("fix('emotion', frame.emotion, current?.emotion ?? 'neutral')", "fix('emotion', frame.emotion, 'neutral')"),
    expect: "fix('emotion', frame.emotion, 'neutral')",
  },
  {
    id: 'M20',
    note: 'an unknown gesture holds the previous one, replaying a movement nobody asked for',
    file: 'src/validate.ts',
    tests: VALIDATE,
    mutate: replace("fix('gesture', frame.gesture, null)", "fix('gesture', frame.gesture, current?.gesture ?? null)"),
    expect: "fix('gesture', frame.gesture, current?.gesture ?? null)",
  },
  {
    id: 'M21',
    note: "the membership test walks the prototype chain, so 'toString' is a valid emotion",
    file: 'src/validate.ts',
    tests: VALIDATE,
    mutate: replace(
      "return typeof name === 'string' && Object.prototype.hasOwnProperty.call(table, name)",
      "return typeof name === 'string' && name in table",
    ),
    expect: 'name in table',
  },
  {
    id: 'M22',
    note: 'playGesture/scrubGesture skip the guard, so a direct call still reaches the bare lookup',
    file: 'src/rig.ts',
    tests: VALIDATE,
    mutate: replace(`    if (!isKnownGesture(g)) {
      this.opts.onInvalidFrame?.({ channel: 'gesture', value: g, kept: null })
      return null
    }
`, ''),
    absent: 'if (!isKnownGesture(g))',
  },
  {
    id: 'M23',
    note: 'locomotion goes back to being accepted and ignored — the frame claims a gait the DOM is not in',
    file: 'src/validate.ts',
    tests: VALIDATE,
    mutate: replace(`  if (frame.locomotion !== undefined && !oneOf(LOCOMOTIONS, frame.locomotion)) {
    fix('locomotion', frame.locomotion, current?.locomotion ?? 'idle')
  }
`, ''),
    absent: "fix('locomotion'",
  },
  {
    id: 'M24',
    note: 'facing goes back to being accepted and ignored',
    file: 'src/validate.ts',
    tests: VALIDATE,
    mutate: replace(`  if (frame.facing !== undefined && !oneOf(FACINGS, frame.facing)) {
    fix('facing', frame.facing, current?.facing ?? 'right')
  }
`, ''),
    absent: "fix('facing'",
  },
  {
    id: 'M25',
    note: 'the list check answers true for anything, so every locomotion and facing passes',
    file: 'src/validate.ts',
    tests: VALIDATE,
    mutate: replace(
      "return typeof name === 'string' && values.includes(name)",
      "return typeof name === 'string'",
    ),
    expect: "function oneOf(values: readonly string[], name: unknown): boolean {\n  return typeof name === 'string'\n}",
  },
  {
    // Only one direction of drift is testable, and that is the point. Removing
    // a value ('fly') does not compile — LOCOMOTIONS *is* the union, so the
    // rest of src/ stops building, which is a stronger guard than any test.
    // Adding one compiles fine, silently widens the union, and would make
    // `locomotion: 'run'` accepted again by a rig that cannot run. That is the
    // half the type system cannot catch, so it is the half mutated here.
    id: 'M26',
    note: 'a value is added to LOCOMOTIONS that no gait implements — the silent no-op, reintroduced from the other end',
    file: 'src/types.ts',
    tests: VALIDATE,
    mutate: replace("export const LOCOMOTIONS = ['idle', 'walk', 'fly'] as const", "export const LOCOMOTIONS = ['idle', 'walk', 'fly', 'run'] as const"),
    expect: "'fly', 'run'] as const",
  },
]

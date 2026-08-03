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
const DISTINCT = ['test/viseme-distinct.test.mjs']
const REDUCTION = ['test/viseme-reduction.test.mjs']
const REDUCED = ['test/rig-integration.test.mjs', 'test/scrub.test.mjs']

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
  {
    // The original collision, restored exactly: `press` stops being consulted
    // for the width and both closed mouths draw a 9*w half-width again. This
    // is the mutation that would have caught the bug in the first place.
    id: 'M27',
    note: 'the lip press goes back to being the same width as the rest — rest and mbp collapse',
    file: 'src/render.ts',
    tests: DISTINCT,
    mutate: replace('const half = (press ? 7 : 9) * w', 'const half = 9 * w'),
    expect: 'const half = 9 * w',
  },
  {
    id: 'M28',
    note: 'the press stops being flatter than the rest, leaving only the width to tell them apart',
    file: 'src/render.ts',
    tests: DISTINCT,
    mutate: replace('${cy + (press ? 0.5 : 5)}', '${cy + 5}'),
    absent: 'press ? 0.5 : 5',
  },
  {
    // A closed beak going back to "nearly closed". The mutant still produces a
    // *different string* from rest — it differs by 0.45 art units — so this
    // mutation only dies against a test that measures separation rather than
    // inequality. That asymmetry is why MIN_SEP exists.
    id: 'M29',
    note: 'closed stops shutting the beak, restoring the 0.45-unit rest/mbp difference',
    file: 'src/render.ts',
    tests: DISTINCT,
    mutate: replace('const open = viseme.closed ? 0 : 1.5 + o * 14', 'const open = 1.5 + o * 14'),
    absent: 'viseme.closed ? 0 :',
  },
  // M30 used to live here: narrowing the beak range back to 3-12 and checking
  // that rest/f and i/s collided again. Design 3 dropped both `f` and `s` as
  // shipped viseme names, so that specific collision can no longer happen —
  // the mutation survives, correctly, because the guard it checked is no
  // longer live for the shapes the table actually ships. Retired rather than
  // kept as a permanently-red entry; the range widening itself is still
  // exercised by M29 and M31 above.
  {
    id: 'M31',
    note: 'the beak drops the tongue again, so l and e separate only by a 0.88-unit width',
    file: 'src/render.ts',
    tests: DISTINCT,
    mutate: replace('if (viseme.tongue && o > 0.3) {\n      parts.push(`<ellipse cx="${cx}" cy="${cy + 1 + open * 0.45}" rx="${4 * w}" ry="${open * 0.28}" fill="#ff7a95"/>`)\n    }\n', ''),
    absent: 'open * 0.28',
  },
  // ── Design 3: dropped viseme groups must route to their measured merge ─────
  {
    id: 'M32',
    note: "'ه' (was e) routes to 'aa' instead of the measured target 'l'",
    file: 'src/visemes.ts',
    tests: REDUCTION,
    mutate: replace("put('هحعیيئ', 'l')", "put('هحعیيئ', 'aa')"),
    expect: "put('هحعیيئ', 'aa')",
  },
  {
    id: 'M33',
    note: "'ف' (was f) stops merging into 'rest' and falls back into 'mbp'",
    file: 'src/visemes.ts',
    tests: REDUCTION,
    mutate: replace("put('ف', 'rest')", "put('ف', 'mbp')"),
    expect: "put('ف', 'mbp')",
  },
  {
    id: 'M34',
    note: "'ش' (was sh) routes to 'l' instead of the measured target 'u'",
    file: 'src/visemes.ts',
    tests: REDUCTION,
    mutate: replace("put('شچژ', 'u')", "put('شچژ', 'l')"),
    expect: "put('شچژ', 'l')",
  },
  {
    id: 'M35',
    note: "'س' (was s) reverts to the rejected 'rest' merge instead of the chosen 'l'",
    file: 'src/visemes.ts',
    tests: REDUCTION,
    mutate: replace("put('سزصثذضظ', 'l')", "put('سزصثذضظ', 'rest')"),
    expect: "put('سزصثذضظ', 'rest')",
  },
  // No mutation restores a sixth VISEMES entry: VisemeName is a five-member
  // union now, so an extra key fails `tsc`, not a runtime guard — the type
  // system is the check, and mutate.mjs correctly reports a mutant like that
  // as `not-applied` rather than counting it as covered.

  // ── reduced motion: CSS-only holds cannot be silently defeated ─────────────
  {
    id: 'M36',
    note: 'pinGaitPhase stops taking the direct-sample path under reduced motion, reverting to the pause that RIG_CSS silently defeats',
    file: 'src/rig.ts',
    tests: REDUCED,
    mutate: replace(
      "if (this.reduced && (loco === 'walk' || loco === 'fly')) {",
      "if (!this.reduced && (loco === 'walk' || loco === 'fly')) {",
    ),
    expect: "if (!this.reduced && (loco === 'walk' || loco === 'fly')) {",
  },
  {
    id: 'M37',
    note: 'LOCO_FALLBACK_POSES loses a distinct keyframe (25% collapses onto 0%), so a reduced-motion scrub stops moving between phases',
    file: 'src/rig.ts',
    tests: REDUCED,
    mutate: replace(
      "{ at: 0.25, pose: { y: -4, rot: 0 } },",
      "{ at: 0.25, pose: { y: 0, rot: -2 } },",
    ),
    expect: '{ at: 0.25, pose: { y: 0, rot: -2 } },',
  },
  {
    id: 'M38',
    note: 'scrubGesture stops taking the direct-sample path under reduced motion, falling through to a paused animation RIG_CSS hides',
    file: 'src/rig.ts',
    tests: REDUCED,
    mutate: replace(
      "      const clamped = Math.max(0, Math.min(1, t))\n      if (this.reduced) {",
      "      const clamped = Math.max(0, Math.min(1, t))\n      if (!this.reduced) {",
    ),
    expect: 'const clamped = Math.max(0, Math.min(1, t))\n      if (!this.reduced) {',
  },
  {
    id: 'M39',
    note: 'releasing a reduced-motion scrub stops clearing the direct transform write, leaving the last sampled pose stuck',
    file: 'src/rig.ts',
    tests: REDUCED,
    mutate: replace(
      "        el.style.animationPlayState = ''\n        el.style.transform = ''\n        continue\n      }\n      const clamped",
      "        el.style.animationPlayState = ''\n        continue\n      }\n      const clamped",
    ),
    absent: "el.style.animationPlayState = ''\n        el.style.transform = ''\n        continue",
  },
  {
    id: 'M40',
    note: 'playGesture stops resolving the gesture channel at once under reduced motion, holding it invisibly for the nominal duration again',
    file: 'src/rig.ts',
    tests: REDUCED,
    mutate: replace(
      "    if (this.reduced) {\n      this.clearGesture(g)\n      return\n    }\n\n    const suffix = plan.mode === 'fallback' ? '_fb' : ''",
      "    const suffix = plan.mode === 'fallback' ? '_fb' : ''",
    ),
    absent: 'if (this.reduced) {\n      this.clearGesture(g)\n      return\n    }',
  },
  {
    id: 'M41',
    note: 'mount() stops reading RigOptions.reducedMotion, so the override is silently ignored and only the OS query is ever consulted',
    file: 'src/rig.ts',
    tests: REDUCED,
    mutate: replace(
      "    const rm = this.opts.reducedMotion ?? 'auto'\n    this.reduced = rm === 'auto' ? prefersReducedMotion() : rm",
      "    this.reduced = prefersReducedMotion()",
    ),
    absent: 'this.opts.reducedMotion',
  },
  {
    id: 'M42',
    note: "render() stops toggling .ca-reduced, so a forced override no longer disables CSS-only animations/transitions the way the OS query does",
    file: 'src/rig.ts',
    tests: REDUCED,
    mutate: replace("this.svg.classList.toggle('ca-reduced', this.reduced)", ''),
    absent: "this.svg.classList.toggle('ca-reduced'",
  },
  {
    id: 'M43',
    note: 'mount() schedules a blink even under reduced motion',
    file: 'src/rig.ts',
    tests: REDUCED,
    mutate: replace('if (this.opts.blink && !this.reduced) this.scheduleBlink()', 'if (this.opts.blink) this.scheduleBlink()'),
    expect: 'if (this.opts.blink) this.scheduleBlink()',
  },
  {
    id: 'M44',
    note: 'mount() starts the rAF loop even under reduced motion',
    file: 'src/rig.ts',
    tests: REDUCED,
    mutate: replace('if (!this.reduced) this.startLoop()', 'this.startLoop()'),
    absent: 'if (!this.reduced) this.startLoop()',
  },
  {
    id: 'M45',
    note: "ava's hair crown goes back to painting before her face, vanishing under the face-skin circle",
    file: 'src/characters/index.ts',
    tests: CACHE,
    mutate: replace(
      '<circle cx="100" cy="90" r="45" fill="url(#avS)"/>\n' +
      '      <path d="M55 92c0-30 20-50 45-50s45 20 45 50c0-10-7-17-12-19 2 6 2 11 0 15-4-13-14-22-33-22s-29 9-33 22c-2-4-2-9 0-15-5 2-12 9-12 19z" fill="url(#avHair)"/>',
      '<path d="M55 92c0-30 20-50 45-50s45 20 45 50c0-10-7-17-12-19 2 6 2 11 0 15-4-13-14-22-33-22s-29 9-33 22c-2-4-2-9 0-15-5 2-12 9-12 19z" fill="url(#avHair)"/>\n' +
      '      <circle cx="100" cy="90" r="45" fill="url(#avS)"/>',
    ),
    expect: 'fill="url(#avHair)"/>\n      <circle cx="100" cy="90" r="45" fill="url(#avS)"/>',
  },
  {
    id: 'M46',
    note: "ava's left pigtail pivots at the bunch's own centre (58,89) instead of the measured head/bunch chord midpoint (57,89) — the same 'looks like it would also work' trap as an ear rotated about its own centre",
    file: 'src/characters/index.ts',
    tests: CACHE,
    mutate: replace(
      'earL: {\n          origin: [57, 89],',
      'earL: {\n          origin: [58, 89],',
    ),
    expect: 'earL: {\n          origin: [58, 89],',
  },
  {
    id: 'M47',
    note: "charkhiAntennaClip samples back down to the antenna's own pivot (tMin 0 instead of 0.025) — the exact degenerate-sampling trap caught during development, where t=0 is trivially a 0 margin against any wall and swamps the real signal",
    file: 'tools/lib/probes.mjs',
    tests: ['test/charkhi.test.mjs'],
    mutate: replace(
      'export function charkhiAntennaClip(side, earDeg, steps = 200, tMin = 0.025) {',
      'export function charkhiAntennaClip(side, earDeg, steps = 200, tMin = 0) {',
    ),
    expect: 'export function charkhiAntennaClip(side, earDeg, steps = 200, tMin = 0) {',
  },
]

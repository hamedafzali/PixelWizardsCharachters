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
const THREE = ['test/three.test.mjs']
const MOTION = ['test/motion.test.mjs']

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
    mutate: replace('el.style.animationDelay = `${-clamped * part.action.dur}s`',
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
    mutate: replace("export const LOCOMOTIONS = ['idle', 'walk', 'fly', 'roll'] as const", "export const LOCOMOTIONS = ['idle', 'walk', 'fly', 'roll', 'run'] as const"),
    expect: "'roll', 'run'] as const",
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
    file: 'src/locomotion.ts',
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
  // ── the motion engine ──────────────────────────────────────────────────────
  {
    id: 'M48',
    note: 'attention lifts the head with the gaze again (rise 1.5, the first guess) — measured to open the tondpa/khersi neck seams and sink laki\'s mouth into the shell',
    file: 'src/motion.ts',
    tests: MOTION,
    mutate: replace('    rise: 0,', '    rise: 1.5,'),
    expect: '    rise: 1.5,',
  },
  {
    id: 'M49',
    note: "charkhi's antennae get the default 28° lag limit back — measured to dip the stalk within 0.65 of the roof",
    file: 'src/characters/index.ts',
    tests: MOTION,
    mutate: replace(
      'earL: { spring: { freq: 5, damping: 0.3 }, limit: 10 },',
      'earL: { spring: { freq: 5, damping: 0.3 }, limit: 28 },',
    ),
    expect: 'limit: 28 },',
  },
  {
    id: 'M50',
    note: 'a spring never lands exactly on its target, so a settled rig keeps writing translate(0.000 0) instead of the authored transform',
    file: 'src/motion.ts',
    tests: MOTION,
    mutate: replace(
      'if (Math.abs(this.value - target) < REST && Math.abs(this.velocity) < REST * 10) this.snap(target)',
      'void REST',
    ),
    expect: 'void REST',
  },
  {
    id: 'M51',
    note: 'ears are always parented to the torso, so on a headed character their depth offset is doubled by the head\'s',
    file: 'src/motion.ts',
    tests: MOTION,
    mutate: replace(
      "case 'earL': case 'earR': return has('head') ? 'head' : 'torso'",
      "case 'earL': case 'earR': return 'torso'",
    ),
    expect: "case 'earL': case 'earR': return 'torso'",
  },
  {
    id: 'M52',
    note: 'gradient ids are not namespaced, so two rigs of one character share ids and one rig\'s shading moves the other\'s',
    file: 'src/rig.ts',
    tests: MOTION,
    mutate: replace(
      'this.host.innerHTML = namespaceIds(\n      renderActorSVG(this.spec, this.frame, this.opts.size, this.opts.emotions), this.uid)',
      'this.host.innerHTML = String(\n      renderActorSVG(this.spec, this.frame, this.opts.size, this.opts.emotions))',
    ),
    expect: 'this.host.innerHTML = String(',
  },
  {
    id: 'M53',
    note: 'facing front again writes the cached numeric centre instead of restoring the authored cx attribute verbatim',
    file: 'src/rig.ts',
    tests: MOTION,
    mutate: replace(
      "      if (v === 0) {\n        if (g.orig === null) g.el.removeAttribute('cx')\n        else g.el.setAttribute('cx', g.orig)\n      } else {",
      '      {',
    ),
    expect: "      {\n        g.el.setAttribute('cx', `${(g.base - v).toFixed(2)}%`)",
  },
  {
    id: 'M54',
    note: 'a pinned gait phase no longer freezes the springs, so a "frozen" pose keeps wobbling',
    file: 'src/rig.ts',
    tests: MOTION,
    mutate: replace(
      'this.pinnedPhase !== null || this.scrubbing.size > 0',
      'this.scrubbing.size > 0',
    ),
    expect: 'this.raf === null ||\n      this.scrubbing.size > 0',
  },
  {
    id: 'M55',
    note: 'the emotion pop stretches without narrowing — the squash stops preserving area',
    file: 'src/motion.ts',
    tests: MOTION,
    mutate: replace("add('body', { rot, sy: 1 + s, sx: 1 / (1 + s) })", "add('body', { rot, sy: 1 + s, sx: 1 })"),
    expect: 'sx: 1 })',
  },
  {
    id: 'M56',
    note: 'a gaze-evoked blink ignores blink:false',
    file: 'src/rig.ts',
    tests: MOTION,
    mutate: replace('if (out.blink && this.opts.blink && !this.reduced) this.blink()', 'if (out.blink && !this.reduced) this.blink()'),
    expect: 'if (out.blink && !this.reduced) this.blink()',
  },
  {
    id: 'M57',
    note: '3D: a caller override can bring the 2D head slide back',
    file: 'src/three/model.ts',
    tests: THREE,
    mutate: replace('return resolveMotion(this.spec.motion, this.opts.motion, this.motionOverrides, MOTION_3D)', 'return resolveMotion(this.spec.motion, MOTION_3D, this.opts.motion, this.motionOverrides)'),
    expect: 'return resolveMotion(this.spec.motion, MOTION_3D, this.opts.motion, this.motionOverrides)',
  },
  {
    id: 'M58',
    note: '3D: looking down tips the head up',
    file: 'src/three/model.ts',
    tests: THREE,
    mutate: replace('rx = look.y * turn.pitch * D2R', 'rx = -look.y * turn.pitch * D2R'),
    expect: 'rx = -look.y * turn.pitch * D2R',
  },
  {
    id: 'M59',
    note: '3D: facing mirror inverted',
    file: 'src/three/model.ts',
    tests: THREE,
    mutate: replace("this.frame.facing === 'left' ? -1 : 1", "this.frame.facing === 'right' ? -1 : 1"),
    expect: "this.frame.facing === 'right' ? -1 : 1",
  },
  {
    id: 'M60',
    note: '3D: gestures play under reduced motion',
    file: 'src/three/model.ts',
    tests: THREE,
    mutate: replace('    if (this.reduced) {\n      this.clearGesture(g)\n      return\n    }\n    for (const part', '    for (const part'),
    absent: 'if (this.reduced) {\n      this.clearGesture(g)\n      return\n    }\n    for (const part',
  },
  {
    id: 'M61',
    note: '3D: a one-shot mood (surprised pop) loops forever',
    file: 'src/three/model.ts',
    tests: THREE,
    mutate: replace('m.once && u >= 1 ? {} : samplePhase', 'false ? {} : samplePhase'),
    expect: 'false ? {} : samplePhase',
  },
  {
    id: 'M62',
    note: '3D: rest and mbp draw the same closed mouth',
    file: 'src/three/model.ts',
    tests: THREE,
    mutate: replace('m.smile.visible = closed && !v.closed', 'm.smile.visible = closed'),
    expect: 'm.smile.visible = closed',
  },
  {
    id: 'M63',
    note: '3D: a finished gesture never releases its channel',
    file: 'src/three/model.ts',
    tests: THREE,
    mutate: replace('    for (const g of done) if (!this.gestures.some((a) => a.gesture === g)) this.clearGesture(g)\n', ''),
    absent: 'for (const g of done)',
  },
  {
    id: 'M64',
    note: '3D skin: the section leans at the outline (a rim-slope cap) and turns the body into a lens',
    file: 'src/three/skin.ts',
    tests: THREE,
    mutate: replace("h[i] = dist[i]! > 0 ? H * Math.sqrt(1 - (1 - t) * (1 - t)) : 0", "h[i] = dist[i]! > 0 ? Math.min(H * Math.sqrt(1 - (1 - t) * (1 - t)), 2.5 * dist[i]!) : 0"),
    expect: '2.5 * dist[i]!',
  },
  {
    id: 'M65',
    note: '3D skin: distances measured to the cell centre, not the outline',
    file: 'src/three/skin.ts',
    tests: THREE,
    mutate: replace('(Math.sqrt(sq) - 0.5) / CELL', 'Math.sqrt(sq) / CELL'),
    expect: 'Math.sqrt(sq) / CELL',
  },
  {
    id: 'M66',
    note: '3D skin: runs without a DOM and throws under Node',
    file: 'src/three/skin.ts',
    tests: THREE,
    mutate: replace("if (!b || typeof document === 'undefined') return", 'if (!b) return'),
    absent: "typeof document === 'undefined'",
  },
  {
    id: 'M67',
    note: '3D: dispose skips the cleanups later passes register',
    file: 'src/three/build.ts',
    tests: THREE,
    mutate: replace('      for (const d of disposers.splice(0)) d()\n', ''),
    absent: 'disposers.splice(0)',
  },
  {
    id: 'M68',
    note: '3D skin: the outline is the cell grid\'s estimate, not traced on the art',
    file: 'src/three/skin.ts',
    tests: THREE,
    mutate: replace('  const STEPS = 16\n', '  const STEPS = 0\n'),
    expect: 'const STEPS = 0',
  },
  {
    id: 'M69',
    note: '3D skin: the rim normal leans in z, so the halves meet in a crease',
    file: 'src/three/skin.ts',
    tests: THREE,
    mutate: replace('if (r < 1e-6) n = [-gx / gl, gy / gl, 0]', 'if (r < 1e-6) n = [-gx / gl, gy / gl, 0.5]'),
    expect: '[-gx / gl, gy / gl, 0.5]',
  },
  {
    id: 'M70',
    note: '3D skin: the paint order moves every layer, the anchor too',
    file: 'src/three/skin.ts',
    tests: THREE,
    mutate: replace('const start = Math.max(0, anchor)', 'const start = 0'),
    expect: 'const start = 0',
  },
  {
    id: 'M71',
    note: '3D skin: a windowed distance field is written at the window\'s origin',
    file: 'src/three/skin.ts',
    tests: THREE,
    mutate: replace('d[(wy + y) * N + (wx + x)] =', 'd[y * N + x] ='),
    expect: 'd[y * N + x] =',
  },
  {
    id: 'M72',
    note: '3D: a body3d pivot drifts off its 2D origin',
    file: 'src/characters/index.ts',
    tests: THREE,
    mutate: replace("        pivot: [100, 140, 0],\n        // The back of her head", "        pivot: [100, 138, 0],\n        // The back of her head"),
    expect: 'pivot: [100, 138, 0]',
  },
  {
    id: 'M73',
    note: '3D: the lower beak drops twice as far as the 2D one opens',
    file: 'src/three/model.ts',
    tests: THREE,
    mutate: replace('b.lower.scale.set(w, 1 + open / (4 * b.half), 1)', 'b.lower.scale.set(w, 1 + open / (2 * b.half), 1)'),
    expect: '1 + open / (2 * b.half)',
  },
  {
    id: 'M74',
    note: '3D: the beak ignores the viseme width',
    file: 'src/three/model.ts',
    tests: THREE,
    mutate: replace('      b.upper.scale.x = w\n', '      b.upper.scale.x = 1\n'),
    expect: 'b.upper.scale.x = 1',
  },
  {
    id: 'M75',
    note: '3D: a beak character keeps its lips',
    file: 'src/three/build.ts',
    tests: THREE,
    mutate: replace("intensity: 1 }).mouth?.beak) {", "intensity: 1 }).mouth?.beak && false) {"),
    expect: 'mouth?.beak && false',
  },
  {
    id: 'M76',
    note: '3D skin: outline marks are judged against one colour, not the gradient',
    file: 'src/three/skin.ts',
    tests: THREE,
    mutate: replace('return [1, x, y, x * x, x * y, y * y]', 'return [1, 0 * x, 0 * y, 0, 0, 0]'),
    expect: '[1, 0 * x, 0 * y, 0, 0, 0]',
  },
  {
    id: 'M77',
    note: '3D skin: a two-toned outline is treated as marked',
    file: 'src/three/skin.ts',
    tests: THREE,
    mutate: replace('if (off.length > idx.length / 3) return', 'if (off.length > idx.length) return'),
    expect: 'off.length > idx.length) return',
  },
  {
    id: 'M78',
    note: '3D skin: the fur keeps its marks',
    file: 'src/three/skin.ts',
    tests: THREE,
    mutate: replace('  for (const i of off) filled[i] = 0\n', '  for (const i of off) filled[i] = 1\n'),
    expect: 'filled[i] = 1',
  },
]

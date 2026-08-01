/**
 * Everything the contact sheets show, as numbers.
 *
 * The sheets are for the eye and are not checked in; this is the part that is.
 * A 4MB generated page cannot be diffed, so what goes in git is the measurement
 * underneath it — margins, overlaps, pivots, the gesture routing matrix. A
 * pull request that changes the art then shows up as a handful of changed
 * numbers with names, instead of as "regenerate the sheet and squint".
 *
 * Deliberately *not* a second set of assertions. The guards in `test/` say what
 * must stay true (a margin over 1, a seam over 120); this says what the values
 * currently are, including the ones no guard constrains. The two catch
 * different things: a guard catches a violation, a baseline catches a change.
 *
 * Everything routes through `tools/lib/probes.mjs`, so a baseline and a guard
 * can never be measuring different geometry.
 */

import {
  CHARACTER_SLUGS, CHARACTERS, EMOTIONS, GESTURE_NAMES, GESTURES,
  resolvePosture, sampleAction,
} from '../../dist/index.js'
import {
  LAKI, lakiRimY, lakiClearance, posturePose, worstOverAction,
  TP, tondpaSeamOverlap, KH, khersiSeamOverlap, khersiEarPenetration,
  earChordMidpoint, discBodySeamY, headPivot, MICRO_WORST,
} from './probes.mjs'
import { gesturePlanFor } from './harness.mjs'

/**
 * Round hard, on purpose.
 *
 * These numbers come out of trigonometry and out of area sums over a sampled
 * grid. Three decimals is far finer than any change worth noticing in the art
 * and coarse enough that a different machine's `Math.cos` cannot make the
 * baseline flap. A baseline that produces false diffs gets regenerated without
 * being read, which makes it worse than none.
 */
const r = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)
const rr = (a) => a.map(r)

const EMOS = Object.keys(EMOTIONS)
const STEPS = [0, 0.25, 0.5, 0.75, 1]
const headParts = (slug, g) =>
  CHARACTERS[slug].gestureFallback?.includes(g)
    ? []
    : GESTURES[g].parts.filter((p) => p.layer === 'lyr-head')

/** Worst value of `measure` over the whole emotion × intensity grid. */
function worstPosture(slug, measure) {
  let worst = { v: Infinity }
  for (const emotion of EMOS) {
    for (const intensity of STEPS) {
      const p = resolvePosture(emotion, intensity, CHARACTERS[slug].posture)
      const v = measure(p)
      if (v < worst.v) worst = { v: r(v), emotion, intensity }
    }
  }
  return worst
}

export function measureAll() {
  const out = {}

  // ── how each gesture routes, for every character ───────────────────────────
  //
  // The single most consequential table in the library and the easiest to
  // change by accident: adding a layer to a character silently promotes a
  // gesture from the whole-body fallback onto that limb.
  out.gestureRouting = Object.fromEntries(CHARACTER_SLUGS.map((slug) => [
    slug,
    Object.fromEntries(GESTURE_NAMES.map((g) => {
      const plan = gesturePlanFor(slug, g, 'idle')
      return [g, plan.mode === 'parts'
        ? plan.parts.map((p) => p.layer).join('+')
        : `${plan.mode}:${plan.reason ?? ''}`]
    })),
  ]))

  // ── pivots, as the spec ships them ────────────────────────────────────────
  out.pivots = Object.fromEntries(CHARACTER_SLUGS.flatMap((slug) => {
    const layers = CHARACTERS[slug].render({ emotion: EMOTIONS.neutral, intensity: 1 }).layers ?? {}
    return Object.entries(layers)
      .filter(([, l]) => l?.origin)
      .map(([name, l]) => [`${slug}.${name}`, rr(l.origin)])
  }))

  // ── لاکی: the shell rim ───────────────────────────────────────────────────
  out.laki = {
    rim: Object.fromEntries([38, 60, 80, 100, 120, 140, 162].map((x) => [x, r(lakiRimY(x))])),
    worstPosture: worstPosture('laki', (p) => {
      const c = lakiClearance(posturePose(p))
      return Math.min(c.mouth, c.head)
    }),
    gestures: Object.fromEntries(GESTURE_NAMES.flatMap((g) => {
      const parts = headParts('laki', g)
      if (parts.length === 0) return []
      const w = worstOverAction(parts[0].action, lakiClearance)
      return [[g, { margin: r(w.margin), channel: w.channel, t: r(w.t) }]]
    })),
    // Both directions of the opt-out: what لاکی declares, and what the
    // measurement says it should declare. They must agree.
    optOut: [...(CHARACTERS.laki.gestureFallback ?? [])].sort(),
  }

  // ── تندپا / خرسی: the seams ───────────────────────────────────────────────
  const seam = (slug, overlap, floorLabel) => ({
    seamY: r(discBodySeamY(...(slug === 'tondpa' ? [TP.disc, TP.body] : [KH.head, KH.body])).seamY),
    pivot: rr(headPivot(slug)),
    detachAt: floorLabel,
    worstPosture: worstPosture(slug, (p) =>
      overlap((p.headTilt ?? 0) + MICRO_WORST.rot, (p.headDrop ?? 0) + MICRO_WORST.y)),
    worstGesture: Object.fromEntries(GESTURE_NAMES.flatMap((g) => {
      const parts = headParts(slug, g)
      if (parts.length === 0) return []
      const w = worstOverAction(parts[0].action, (p) => ({
        seam: overlap((p.rot ?? 0) + MICRO_WORST.rot, (p.y ?? 0) + MICRO_WORST.y),
      }))
      return [[g, { overlap: r(w.margin), t: r(w.t) }]]
    })),
  })
  out.tondpa = seam('tondpa', tondpaSeamOverlap, TP.detachAt)
  out.khersi = {
    ...seam('khersi', khersiSeamOverlap, KH.detachAt),
    earPivots: Object.fromEntries(['earL', 'earR'].map((s) => [s, rr(headPivot('khersi', s))])),
    earChord: Object.fromEntries(['earL', 'earR'].map((s) =>
      [s, rr(earChordMidpoint(KH.ears[s], KH.head).point)])),
    worstEar: worstPosture('khersi', (p) => Math.min(...['earL', 'earR'].map((s) =>
      khersiEarPenetration(s, p.ears ?? 0,
        (p.headTilt ?? 0) + MICRO_WORST.rot, (p.headDrop ?? 0) + MICRO_WORST.y)))),
  }

  // ── the derived timeline itself ───────────────────────────────────────────
  //
  // Not geometry, but the thing all of the above is sampled through: if the
  // anticipation or settle derivation moves, every margin above moves with it,
  // and it is worth seeing that in the same diff.
  out.actionShape = Object.fromEntries(GESTURE_NAMES.map((g) => {
    const a = GESTURES[g].parts[0].action
    const at = (t) => {
      const p = sampleAction(a, t)
      return rr([p.x, p.y, p.rot, p.sx, p.sy])
    }
    return [g, { dur: r(a.dur), layers: GESTURES[g].parts.map((p) => p.layer), at: { 0.1: at(0.1), 0.5: at(0.5), 0.9: at(0.9) } }]
  }))

  out.microWorst = MICRO_WORST
  return out
}

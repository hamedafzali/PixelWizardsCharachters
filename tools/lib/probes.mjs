/**
 * Geometry probes — the measurements the roster's seam and rim guards are made
 * of.
 *
 * ## THIS FILE IS TEST-LOAD-BEARING, DESPITE LIVING OUTSIDE `src/`
 *
 * `tools/` is not published (see `files` in package.json) and nothing in
 * `src/` imports it — but `test/rig-cache.test.mjs` does, and so do the contact
 * sheet generators in `tools/sheets/`. Deleting or breaking this module breaks
 * the test suite. It is not scratch work and it is not a demo.
 *
 * That placement is deliberate. These functions describe the *art* — where
 * لاکی's shell rim runs, where تندپا's head crosses its body — not the library's
 * behaviour, so they have no business shipping to consumers. But a guard and a
 * contact sheet must measure the same geometry with the same function, or a
 * sheet that looks right and a test that passes stop being the same claim. This
 * module is that single home; before it existed, the rim solver had three
 * copies (the test, and two throwaway scripts) and the disc-crossing sweep had
 * two.
 *
 * ## What belongs here
 *
 * Pure geometry over numbers. Pivots are **read from the shipped spec** by
 * {@link headPivot} rather than restated, so a test keeping its own copy of an
 * origin cannot go on passing after the real one moves. Everything else — the
 * silhouette circles, the rim path — is measured off the drawing and written
 * down once, here.
 */

import { CHARACTERS, EMOTIONS, sampleAction } from '../../dist/index.js'

// ── shared kinematics ────────────────────────────────────────────────────────

/** Rotate a point about a pivot, then translate. Degrees. */
export function rotateAbout([x, y], [px, py], deg, dx = 0, dy = 0) {
  const a = (deg * Math.PI) / 180
  const u = x - px
  const v = y - py
  return [
    px + dx + u * Math.cos(a) - v * Math.sin(a),
    py + dy + u * Math.sin(a) + v * Math.cos(a),
  ]
}

/** The same, for a circle carried rigidly by the joint. */
export function spin({ cx, cy, r }, pivot, deg, dy = 0) {
  const [x, y] = rotateAbout([cx, cy], pivot, deg, 0, dy)
  return { cx: x, cy: y, r }
}

/**
 * Map a point through a full {@link Pose}, matching the order
 * `poseToTransform` emits: `translate rotate scale`, which CSS applies to the
 * point right-to-left — scale first, then rotation, then the offset.
 *
 * The scale terms matter more than they look. Every derived anticipation and
 * settle beat carries `sx`/`sy`, so a probe that ignores them measures a pose
 * the rig never holds.
 */
export function poseAt(pose, [x, y], [px, py]) {
  const { x: tx = 0, y: ty = 0, rot = 0, sx = 1, sy = 1 } = pose
  const u = (x - px) * sx
  const v = (y - py) * sy
  const a = (rot * Math.PI) / 180
  return [
    px + tx + u * Math.cos(a) - v * Math.sin(a),
    py + ty + u * Math.sin(a) + v * Math.cos(a),
  ]
}

/** A layer's pivot, read off the shipped spec rather than restated. */
export function headPivot(slug, layer = 'head') {
  const layers = CHARACTERS[slug].render({ emotion: EMOTIONS.neutral, intensity: 1 }).layers
  const l = layers?.[layer]
  if (!l?.origin) throw new Error(`${slug} has no ${layer} layer with an origin`)
  return l.origin
}

/** Area of `inside(x,y)` on a grid, in square art units. */
export function areaWhere(inside, { x0 = 40, x1 = 160, y0 = 90, y1 = 195, step = 0.4 } = {}) {
  let a = 0
  const cell = step * step
  for (let x = x0; x <= x1; x += step) {
    for (let y = y0; y <= y1; y += step) if (inside(x, y)) a += cell
  }
  return a
}

const inEllipse = ({ cx, cy, rx, ry }) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
const inDisc = ({ cx, cy, r }) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r

/**
 * Where a head disc crosses a body ellipse — the seam, derived from the art.
 *
 * A pivot placed at the disc's own centre would pass every overlap sweep ever
 * written, because rotating a circle about its centre moves nothing. Only this
 * says where the joint actually is.
 */
export function discBodySeamY(disc, body, samples = 20000) {
  const inside = inEllipse(body)
  const at = (k) => {
    const t = (k / samples) * Math.PI * 2
    return [disc.cx + disc.r * Math.cos(t), disc.cy + disc.r * Math.sin(t)]
  }
  const cross = []
  for (let i = 0; i < samples; i++) {
    const [x, y] = at(i)
    const [x2, y2] = at(i + 1)
    if (inside(x, y) !== inside(x2, y2)) cross.push([x, y])
  }
  return { crossings: cross.length, seamY: cross.length === 2 ? (cross[0][1] + cross[1][1]) / 2 : NaN }
}

/**
 * The worst per-tick push idle micro-motion adds to a head, at `amount: 1` —
 * breath lift, sway and glance all taken in the detaching direction at once.
 * Shared because it is a property of the micro module, not of a character.
 */
export const MICRO_WORST = { y: -0.9, rot: -1.3 }

// ── لاکی: the head behind the shell ──────────────────────────────────────────

/**
 * لاکی's shell rim, drawn as two cubics meeting at the apex. Evaluated from the
 * real path data rather than approximated by a flat y=76, which would quietly
 * stop being true if the shell were redrawn.
 */
const RIM_L = { x: [38, 38, 66, 100], y: [142, 102, 76, 76] }
const RIM_R = { x: [100, 134, 162, 162], y: [76, 76, 102, 142] }
const cubic = (p, t) => {
  const u = 1 - t
  return u * u * u * p[0] + 3 * u * u * t * p[1] + 3 * u * t * t * p[2] + t * t * t * p[3]
}

/** The rim height at a given x. */
export function lakiRimY(x) {
  const seg = x <= 100 ? RIM_L : RIM_R
  let lo = 0
  let hi = 1
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2
    if (cubic(seg.x, m) < x) lo = m
    else hi = m
  }
  return cubic(seg.y, (lo + hi) / 2)
}

/** لاکی's head pivot and the extremes of the art that ride it. */
export const LAKI = { ox: 100, oy: 78, discCx: 100, discCy: 52, discR: 30, mouthCy: 63, mouthReach: 9 }

/**
 * The two walls لاکی's head sits between, for one pose.
 *
 * Returns signed margins in art units, both **positive when safe**:
 *   `mouth` — how far the widest open viseme stays clear of the rim.
 *   `head`  — how far the bottom of the head disc stays tucked under it.
 *
 * A margin of 0 is the wall itself; the guards require ≥ 1 either side, which
 * is where the `- 1` and `+ 1` in the callers come from.
 */
export function lakiClearance(pose) {
  const pivot = [LAKI.ox, LAKI.oy]
  const [mx, my] = poseAt(pose, [LAKI.discCx, LAKI.mouthCy + LAKI.mouthReach], pivot)
  const [bx, by] = poseAt(pose, [LAKI.discCx, LAKI.discCy + LAKI.discR], pivot)
  return { mouth: lakiRimY(mx) - my, head: by - lakiRimY(bx) }
}

/** A posture as a pose: the only channels a posture writes to the head layer. */
export const posturePose = (p) => ({ rot: p.headTilt ?? 0, y: p.headDrop ?? 0 })

/**
 * The worst clearance a head action reaches across its **whole** timeline —
 * derived anticipation and settle included, not just the authored poses.
 *
 * This is the correction that motivated the tooling. Sweeping `action.poses`
 * measures keyframes the rig never holds alone: the anticipation always loads
 * downward (`y` positive, plus a vertical squash), which on لاکی is straight
 * toward the shell rim. On `shake`, the one head gesture لاکی plays, the
 * authored sweep reports 4.00 units of mouth clearance and the real timeline
 * has 3.05 — a quarter of the margin, in frames no `poses` array contains.
 *
 * The current values live in `tools/baselines/geometry.json` rather than in
 * this comment, which is where a stale number would otherwise go to hide.
 */
export function worstOverAction(action, clearance, steps = 240) {
  let worst = null
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const c = clearance(sampleAction(action, t))
    for (const k of Object.keys(c)) {
      if (worst === null || c[k] < worst.margin) worst = { margin: c[k], channel: k, t }
    }
  }
  return worst
}

// ── تندپا: the invisible seam ────────────────────────────────────────────────
//
// The head disc and the body ellipse carry the same `tpB` fill, so the seam
// cannot be seen at rest and an over-wide posture would not be caught by eye.
// What *would* show is the head pulling free of the shoulders. The cheek puffs
// are rigid with the disc — they rotate with it — so no head angle can separate
// them from the head silhouette, which is why there is no cheek bound.

export const TP = {
  disc: { cx: 100, cy: 86, r: 41 },
  cheeks: [{ cx: 66, cy: 96, r: 13 }, { cx: 134, cy: 96, r: 13 }],
  body: { cx: 100, cy: 150, rx: 40, ry: 34 },
  /** headDrop at which the head comes off the shoulders, measured at tilt 0. */
  detachAt: -10.6,
}

/** Head ∩ body area for تندپا, in square art units. */
export function tondpaSeamOverlap(rot, dy, pivot = headPivot('tondpa')) {
  const parts = [TP.disc, ...TP.cheeks].map((c) => spin(c, pivot, rot, dy))
  const body = inEllipse(TP.body)
  return areaWhere((x, y) => body(x, y) && parts.some((p) => inDisc(p)(x, y)), { y1: 190 })
}

// ── خرسی: the one seam you can actually see ─────────────────────────────────
//
// Unlike تندپا, the head (`khHh`) and body (`khB`) are different gradients, so
// the join is a real tonal edge and the eye is a usable check. The ears are
// their own layer with their own pivot, so unlike تندپا's cheeks they are not
// rigid with the head and can in principle walk off it.

export const KH = {
  head: { cx: 100, cy: 86, r: 43 },
  ears: { earL: { cx: 66, cy: 50, r: 18 }, earR: { cx: 134, cy: 50, r: 18 } },
  body: { cx: 100, cy: 150, rx: 44, ry: 36 },
  detachAt: -14.6,
}

/** Head ∩ body area for خرسی. */
export function khersiSeamOverlap(tilt, drop, pivot = headPivot('khersi')) {
  const h = spin(KH.head, pivot, tilt, drop)
  const body = inEllipse(KH.body)
  return areaWhere((x, y) => body(x, y) && inDisc(h)(x, y), { y1: 195, step: 0.5 })
}

/**
 * How deeply an ear still bites into the head disc, in art units. Positive is
 * attached; this is what the chord-midpoint pivot exists to keep positive.
 */
export function khersiEarPenetration(side, earDeg, tilt, drop) {
  const headP = headPivot('khersi')
  const earP = headPivot('khersi', side)
  const sign = side === 'earL' ? 1 : -1
  const e = spin(spin(KH.ears[side], earP, sign * earDeg), headP, tilt, drop)
  const h = spin(KH.head, headP, tilt, drop)
  return h.r - (Math.hypot(e.cx - h.cx, e.cy - h.cy) - e.r)
}

/**
 * Where an ear disc crosses the head disc — the chord midpoint.
 *
 * The ear centre sits *outside* the skull, so there is no drawn base to read a
 * pivot off and it has to come from the two-circle intersection. The ear's own
 * centre would also "work" in the sense that nothing visibly breaks — rotating
 * a circle about its centre is a no-op — which is exactly why this is asserted
 * rather than eyeballed.
 */
export function earChordMidpoint(ear, head) {
  const dx = ear.cx - head.cx
  const dy = ear.cy - head.cy
  const d = Math.hypot(dx, dy)
  const a = (d * d + head.r ** 2 - ear.r ** 2) / (2 * d)
  return { d, point: [head.cx + (a / d) * dx, head.cy + (a / d) * dy] }
}

// ── آوا: pigtails ────────────────────────────────────────────────────────────
//
// The pigtails reuse the earL/earR slots (ava has no drawn ears), so they ride
// the same `posture.ears` channel خرسی's ears do — including the shared
// `POSTURES` default, since ava never overrides `ears` for any emotion. That
// makes them exactly the same "own layer, own pivot, not rigid with the head"
// case, for a reason ava never opted into on purpose: whatever swing the
// shared preset assigns an "ears" channel lands on her hair whether she wrote
// that channel or not.

export const AV = {
  head: { cx: 100, cy: 90, r: 45 },
  pigtails: { earL: { cx: 58, cy: 89, r: 13.5 }, earR: { cx: 142, cy: 89, r: 13.5 } },
}

/** How deeply a pigtail bunch still overlaps the head disc, in art units. */
export function avaPigtailPenetration(side, earDeg, tilt, drop) {
  const headP = headPivot('ava')
  const earP = headPivot('ava', side)
  const sign = side === 'earL' ? 1 : -1
  const e = spin(spin(AV.pigtails[side], earP, sign * earDeg), headP, tilt, drop)
  const h = spin(AV.head, headP, tilt, drop)
  return h.r - (Math.hypot(e.cx - h.cx, e.cy - h.cy) - e.r)
}

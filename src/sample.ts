/**
 * Evaluating an action at a moment, without a browser to run it.
 *
 * The rig plays gestures as real CSS animations — `el.style.animation =
 * ensureAction(...)` — so in a browser the animation engine *is* the source of
 * truth and nothing here is needed. But two things cannot ask a browser:
 *
 *   - **Batch contact sheets.** jsdom has no animation engine at all. A sheet
 *     built without this module has to park the layer at some pose by hand,
 *     which is how every gesture sheet so far ended up depicting an authored
 *     keyframe rather than the animation that ships.
 *   - **Static export.** An SSR thumbnail of a character mid-wave.
 *
 * ## What this is not
 *
 * It is not a second implementation of {@link actionStops}. The keyframe table
 * — authored poses plus derived anticipation and settle — is computed once, in
 * `timing.ts`, and both the CSS compiler and this sampler read it. The only
 * thing owned here is *interpolation between* stops.
 *
 * ## Where it can still disagree with a browser
 *
 * Between stops, this lerps each {@link Pose} channel independently and then
 * serialises. A browser interpolates the CSS `transform` *list*: when two
 * keyframes have matching function lists it does the same thing, but when they
 * differ and neither is a prefix of the other, CSS falls back to interpolating
 * the composed matrices, which takes a different path. `poseToTransform` omits
 * identity functions, so mismatched lists do occur (a `rotate`-only stop next
 * to a `translate` + `rotate` one).
 *
 * At every keyframe stop the two agree exactly, and that is what the
 * equivalence test pins. In between, treat this as *the animator's intent*
 * rather than a pixel-accurate browser prediction — which is precisely why the
 * interactive scrubber drives the real CSS animation with a negative
 * `animation-delay` instead of calling this.
 */

import { actionStops, type Pose, type TimedAction } from './timing.js'

/** A cubic-bezier easing, as CSS defines it: control points (x1,y1) and (x2,y2). */
export type Bezier = readonly [number, number, number, number]

/**
 * The CSS easing keywords, as their bezier equivalents. `ease-in-out` is the
 * default every action inherits, so it is the one that actually matters.
 */
export const EASING_KEYWORDS: Record<string, Bezier> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}

/**
 * Parse a CSS `animation-timing-function` value.
 *
 * Returns `null` for anything not understood — notably the stepping functions,
 * which are not a bezier and cannot be approximated by one. Callers treat that
 * as "interpolate linearly and say so" rather than silently pretending.
 */
export function parseEasing(ease: string | undefined): Bezier | null {
  if (ease === undefined) return EASING_KEYWORDS['ease-in-out'] as Bezier
  const key = ease.trim()
  const kw = EASING_KEYWORDS[key]
  if (kw !== undefined) return kw
  const m = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/.exec(key)
  if (m === null) return null
  const n = m.slice(1, 5).map(Number)
  return n.some(Number.isNaN) ? null : ([n[0], n[1], n[2], n[3]] as unknown as Bezier)
}

const bez = (a: number, b: number, t: number): number => {
  const u = 1 - t
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t
}

/**
 * Evaluate a cubic-bezier easing: given progress along x, return progress along
 * y. Bisection rather than Newton — this runs a few thousand times building a
 * contact sheet, never per animation frame, so the simpler method that cannot
 * diverge is the right trade.
 */
export function easeBezier([x1, y1, x2, y2]: Bezier, t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  let lo = 0
  let hi = 1
  for (let i = 0; i < 32; i++) {
    const m = (lo + hi) / 2
    if (bez(x1, x2, m) < t) lo = m
    else hi = m
  }
  return bez(y1, y2, (lo + hi) / 2)
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Blend two poses. Offsets and angles lerp; scales lerp too, matching CSS. */
function lerpPose(a: Pose, b: Pose, t: number): Required<Pose> {
  return {
    x: lerp(a.x ?? 0, b.x ?? 0, t),
    y: lerp(a.y ?? 0, b.y ?? 0, t),
    rot: lerp(a.rot ?? 0, b.rot ?? 0, t),
    rotY: lerp(a.rotY ?? 0, b.rotY ?? 0, t),
    sx: lerp(a.sx ?? 1, b.sx ?? 1, t),
    sy: lerp(a.sy ?? 1, b.sy ?? 1, t),
  }
}

/**
 * The pose an action holds at normalised time `t ∈ [0,1]`.
 *
 * `t` spans the **whole** action, including the derived anticipation and settle
 * — so `t = 0` is the rest pose, the first authored pose lands somewhere after
 * `antTime`, and the last stretch is the landing rather than anything authored.
 * That is deliberate and is the point of the tool: the anticipation and settle
 * frames are the ones nobody has ever actually looked at.
 *
 * `t` outside [0,1] clamps, because an action plays once (`animation: … 1`) and
 * holds nothing after it ends.
 */
export function sampleAction(a: TimedAction, t: number): Required<Pose> {
  const stops = actionStops(a)
  const first = stops[0]
  const last = stops[stops.length - 1]
  // `actionStops` always emits at least t=0 and t=1, so neither end is ever
  // undefined; the guard is for `noUncheckedIndexedAccess`, not for a real case.
  if (first === undefined || last === undefined) return lerpPose({}, {}, 0)
  if (t <= first[0]) return lerpPose(first[1], first[1], 0)
  if (t >= last[0]) return lerpPose(last[1], last[1], 0)

  let i = 0
  while (i < stops.length - 1 && (stops[i + 1] as [number, Pose])[0] < t) i++
  const [t0, p0] = stops[i] as [number, Pose]
  const [t1, p1] = stops[i + 1] as [number, Pose]
  const span = t1 - t0
  const local = span <= 0 ? 0 : (t - t0) / span

  // The action's `ease` is a single `animation-timing-function`, which CSS
  // applies *between each pair of keyframes* rather than across the whole rule.
  // Easing the local fraction, not the global one, is what matches that.
  const curve = parseEasing(a.ease)
  const eased = curve === null ? local : easeBezier(curve, local)
  return lerpPose(p0, p1, eased)
}

/**
 * Sample an action on an even grid of `steps + 1` points, `t = 0 … 1`.
 *
 * The natural grid for a gesture is real frames — `Math.round(dur * 60)` — so a
 * step of the scrubber is a frame the child would actually see.
 */
export function sampleActionFrames(a: TimedAction, steps: number): Array<[number, Required<Pose>]> {
  const n = Math.max(1, Math.floor(steps))
  const out: Array<[number, Required<Pose>]> = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    out.push([t, sampleAction(a, t)])
  }
  return out
}

/** Frames a `dur`-second action occupies at `fps`. The scrubber's step count. */
export function frameCount(a: TimedAction, fps = 60): number {
  return Math.max(1, Math.round(a.dur * fps))
}

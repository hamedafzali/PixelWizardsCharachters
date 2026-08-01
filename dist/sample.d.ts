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
import { type Pose, type TimedAction } from './timing.js';
/** A cubic-bezier easing, as CSS defines it: control points (x1,y1) and (x2,y2). */
export type Bezier = readonly [number, number, number, number];
/**
 * The CSS easing keywords, as their bezier equivalents. `ease-in-out` is the
 * default every action inherits, so it is the one that actually matters.
 */
export declare const EASING_KEYWORDS: Record<string, Bezier>;
/**
 * Parse a CSS `animation-timing-function` value.
 *
 * Returns `null` for anything not understood — notably the stepping functions,
 * which are not a bezier and cannot be approximated by one. Callers treat that
 * as "interpolate linearly and say so" rather than silently pretending.
 */
export declare function parseEasing(ease: string | undefined): Bezier | null;
/**
 * Evaluate a cubic-bezier easing: given progress along x, return progress along
 * y. Bisection rather than Newton — this runs a few thousand times building a
 * contact sheet, never per animation frame, so the simpler method that cannot
 * diverge is the right trade.
 */
export declare function easeBezier([x1, y1, x2, y2]: Bezier, t: number): number;
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
export declare function sampleAction(a: TimedAction, t: number): Required<Pose>;
/**
 * Sample an action on an even grid of `steps + 1` points, `t = 0 … 1`.
 *
 * The natural grid for a gesture is real frames — `Math.round(dur * 60)` — so a
 * step of the scrubber is a frame the child would actually see.
 */
export declare function sampleActionFrames(a: TimedAction, steps: number): Array<[number, Required<Pose>]>;
/** Frames a `dur`-second action occupies at `fps`. The scrubber's step count. */
export declare function frameCount(a: TimedAction, fps?: number): number;
//# sourceMappingURL=sample.d.ts.map
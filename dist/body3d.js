/**
 * A character's 3D body, as data.
 *
 * This is the three.js renderer's counterpart of `render()`'s SVG layers, and it
 * follows the same rules: one entry per {@link LayerName}, each with a pivot,
 * and a layer exists only if the joint does. Nothing here imports three.js —
 * the core package stays dependency-free, and `pixel-wizards-charachters/three`
 * is what turns this into meshes.
 *
 * ## Coordinates
 *
 * Everything is in the **same 200×200 art space as the SVG**: x to the right,
 * y *down*, and z toward the viewer. So a part is placed by reading it straight
 * off the drawing — `<ellipse cx="100" cy="138" rx="44" ry="38">` becomes
 * `{ shape: 'sphere', at: [100, 138, 0], size: [44, 38, 34] }` — and pivots
 * match the 2D `origin`s, which is what lets posture, gaits and gestures send
 * the same numbers to both renderers.
 *
 * Positions are absolute, not relative to the pivot: the builder does the
 * subtraction, so moving a pivot never moves the art.
 */
export const DEFAULT_TURN3D = { body: 38, head: 18, pitch: 14 };
/**
 * The 2D brows, as lines: for each brow key, the two eyes' `[left end, right
 * end]` y offsets from the brow line, read off `brows()` in `draw.ts`.
 * A brow there is a quadratic stroke from `x - 8` to `x + 8`; here it is the
 * straight segment between the same two ends, which is what reads at the
 * size a 3D brow is drawn.
 */
export const BROW_LINES = {
    idle: [[-1, 1], [1, -1]],
    excited: [[-9, -1], [-1, -9]],
    surprised: [[-9, -1], [-1, -9]],
    happy: [[-5, -1], [-1, -5]],
    encouraging: [[-5, -1], [-1, -5]],
    thinking: [[0, -5], [1, -3]],
    sad: [[2, -4], [2, 4]],
    sleepy: [[4, 2], [2, 4]],
    confused: [[1, -7], [-2, 5]],
    proud: [[-6, -6], [-6, -6]],
    shy: [[-1, 5], [5, -1]],
};
//# sourceMappingURL=body3d.js.map
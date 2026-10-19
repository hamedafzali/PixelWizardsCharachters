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
import type { BrowKey, LayerName } from './types.js';
export type Shape3D = 'sphere' | 'capsule' | 'cone' | 'cylinder' | 'box' | 'torus';
/** One primitive. */
export interface Part3D {
    shape: Shape3D;
    /** centre, in art space */
    at: [number, number, number];
    /**
     * Extents, in art units, per shape:
     *
     * - `sphere`: the three radii — an ellipsoid
     * - `box`: the three half-extents
     * - `capsule`: `[radius, straight length, depth radius]`, along y
     * - `cone`: `[base radius, height, depth radius]`, apex toward −y (up the drawing)
     * - `cylinder`: `[radius, height, depth radius]`, along y
     * - `torus`: `[ring radius, tube radius, arc in degrees]`, in the xy plane
     */
    size: [number, number, number];
    /**
     * Rotation in degrees: `[pitch, yaw, roll]`. Roll is clockwise on screen,
     * like SVG `rotate()`; pitch tips the top toward the viewer; yaw turns the
     * front toward the viewer's right. Applied roll, then pitch, then yaw.
     */
    rot?: [number, number, number];
    color: string;
    /** 0..1, default 1 */
    opacity?: number;
    /** unlit: a flat colour that ignores lighting — catchlights, blush */
    flat?: boolean;
    /** skip the outline on this part (small or flat details) */
    noOutline?: boolean;
}
/** One joint: where it turns, and what turns with it. */
export interface Layer3D {
    /** the pivot, in art space — normally the 2D layer's `origin` plus a depth */
    pivot: [number, number, number];
    parts: Part3D[];
    /**
     * For the 2D skin: the solid's half-thickness at its deepest, in art units.
     * Default `puff` × the silhouette's inner radius, which suits round parts;
     * a wide, low one — a shell — wants more.
     */
    depth?: number;
    /**
     * For the 2D skin: art painted over the layer's own for its sides and back
     * only — hair over the back of a head, say. Default: the colour at the
     * drawing's outline, spread inward. Gradient ids resolve as in the layer.
     */
    back?: string;
}
/**
 * The face. Features are placed on the surface and turned to face outward from
 * `center`, so a face on a ball looks along the ball's normal rather than
 * straight at the camera.
 *
 * Eye x/y/r come from the character's `eyes` and the colours from `lidColor`
 * and `browColor`, so the 3D face agrees with the 2D one by construction; only
 * what 2D has no word for (depth, iris colour) is given here.
 */
export interface Face3D {
    /** the layer the face rides on: `head`, or `torso` for a headless character */
    layer: LayerName;
    /** the centre the face's surface curves around */
    center: [number, number, number];
    eyes: {
        /** depth of the eye centres */
        z: number;
        iris: string;
        sclera?: string;
    };
    brows: {
        y: number;
        z: number;
        /** half-length, default 8 (the 2D brow's) */
        half?: number;
        /** stroke radius, default 1.5 */
        thick?: number;
    };
    mouth: {
        x: number;
        y: number;
        z: number;
        /** half-width at viseme width 1, default 9 (the 2D mouth's) */
        half?: number;
        color: string;
        /** inside of an open mouth, default a dark red */
        inner?: string;
        /** tongue colour for `l`, default pink */
        tongue?: string;
    };
}
/** How far a real rotation goes for the engine's normalised turn signals. */
export interface Turn3D {
    /** body yaw at `ActorFrame.yaw` ±1, degrees */
    body: number;
    /** extra head yaw at the attention spring's full sideways look, degrees */
    head: number;
    /** head pitch at a full up/down look, degrees */
    pitch: number;
}
export interface Body3DSpec {
    layers: Partial<Record<LayerName, Layer3D>>;
    face: Face3D;
    /** cartoon outline; `false` for none. Default `{ width: 1.4, color: '#2a1a12' }` */
    outline?: {
        width: number;
        color: string;
    } | false;
    /** ground shadow radius, art units; default 50 */
    shadow?: number;
    /** default {@link DEFAULT_TURN3D} */
    turn?: Partial<Turn3D>;
}
export declare const DEFAULT_TURN3D: Turn3D;
/**
 * The 2D brows, as lines: for each brow key, the two eyes' `[left end, right
 * end]` y offsets from the brow line, read off `brows()` in `draw.ts`.
 * A brow there is a quadratic stroke from `x - 8` to `x + 8`; here it is the
 * straight segment between the same two ends, which is what reads at the
 * size a 3D brow is drawn.
 */
export declare const BROW_LINES: Record<BrowKey, [[number, number], [number, number]]>;
//# sourceMappingURL=body3d.d.ts.map
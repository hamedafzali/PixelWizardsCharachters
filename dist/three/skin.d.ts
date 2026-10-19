/**
 * The 2D art, inflated: every character's own SVG layers become its 3D surface.
 *
 * The primitives `build.ts` makes from `body3d` are the model's skeleton and
 * stand-in — enough to pose, test and hit-test, but nowhere near the drawing.
 * This replaces each layer's primitives with that layer's **own art**: the SVG
 * `render()` returns is rasterised to a texture (gradients, stripes, tufts,
 * blush and all), and the texture's silhouette is inflated into a closed solid —
 * its thickness at each point grows with the distance from the outline, an
 * ellipse in section, standing vertical at the rim — so the layer is round when
 * it turns but is, face on, exactly the 2D picture. The outline is geometry,
 * traced where the art's alpha crosses half, so the body is watertight from
 * every side; nothing is cut out of it at draw time.
 *
 * Nothing here is per character. It reads the same `render()` output the SVG
 * rig paints, so any character with a `body3d` gets its drawing in 3D for free.
 *
 * Each solid is centred on its layer's `body3d` depth, so the parts keep the
 * body's real proportions from the side and the head turns about its own
 * middle. A drawing is not a consistent 3D object, though: face on, the 2D
 * paint order must win where the solids interpenetrate. So each layer carries a
 * depth *bias* — how far it would have to move for its paint order to hold
 * where it overlaps others — applied to the depth test only, and only as much
 * as the layer faces the camera. Face on, the drawing's order; side on, the
 * plain geometry; from behind, the geometry again.
 *
 * Browser only: rasterising SVG needs `Image` and a canvas. The headless model
 * keeps its primitives, which is what the tests see.
 */
import * as THREE from 'three';
import type { CharacterSpec } from '../types.js';
import { type BuiltModel } from './build.js';
export interface SkinOptions {
    /** texture pixels per art unit; default 5 */
    resolution?: number;
    /** half-thickness as a fraction of a layer's thickest half-width; default 0.85 */
    puff?: number;
    /** gap the paint order keeps between overlapping layers, art units; default 1.5 */
    gap?: number;
}
/** cells per art unit on the grid silhouettes and heights live on */
export declare const SKIN_CELL = 2;
/** side of the square cell grid silhouettes and heights live on */
export declare const SKIN_GRID: number;
/** Pixels with their alpha: an `ImageData`, or anything shaped like one. */
export interface AlphaImage {
    width: number;
    height: number;
    data: ArrayLike<number>;
}
/** A layer's silhouette, measured: what its solid and the stacking need. */
export interface Silhouette {
    /** signed distance to the outline per cell, art units: + inside, − outside */
    sd: Float32Array;
    /** half-thickness per cell, art units; 0 outside */
    h: Float32Array;
    /** half-thickness at the middle, and the largest inside distance */
    H: number;
    R: number;
    /** inclusive cell bounds of the mask: x0, y0, x1, y1 */
    bbox: [number, number, number, number];
    /** the art at full resolution and the art-space rectangle it covers; when
     *  given, the outline is traced on its half-alpha line */
    image?: AlphaImage;
    rect?: [number, number, number, number];
}
/**
 * What the layer looks like where the drawing can't say: its sides and back.
 * The colour on the outline — the fur, as the silhouette shows it — carried
 * smoothly over the whole layer (a membrane fill: relaxed until each pixel is
 * its neighbours' mean) and blurred, so a tuft on the outline doesn't streak
 * round the side. A belly patch or a face, drawn inside the outline, doesn't
 * wrap round to the back; the colour at the edge does. `band` is how many
 * pixels in from the outline count as the edge.
 */
/**
 * Unmark the outline pixels that are not the layer's own colour: a stripe, a
 * tuft or an eye disc that reaches the edge. Kept, each would be dragged round
 * the back as a streak. The layer's own colour is a smooth field, since a
 * body darkens toward its foot and lightens at its highlight: a quadratic in
 * x and y, fitted to the outline robustly (reweighted least squares, so the
 * marks do not pull it). A pixel further than `tolerance` from the fit is a
 * mark. Marks are a minority: a layer that would lose over a third of its
 * outline is two-toned or patterned, not marked, and is left alone: of the
 * bundled characters, سیمرغ's crested head (39%) and چرخی's windscreened
 * body (35%). Every other layer loses at most 30%.
 */
export declare function dropMarks(d: ArrayLike<number>, W: number, filled: Uint8Array, tolerance?: number): void;
/**
 * Exact Euclidean distance from each cell inside `mask` to the nearest cell
 * outside it (the grid's border counts as outside), in art units, measured to
 * the outline between them — so a cell on the rim is half a cell in. Cells
 * outside are 0.
 *
 * `win` (inclusive cell bounds x0, y0, x1, y1) limits the work to a window:
 * cells beyond it count as outside and come back 0. Exact for every cell in
 * the window as long as the window holds everything the mask marks.
 */
export declare function distanceField(mask: Uint8Array, win?: [number, number, number, number]): Float32Array;
/**
 * Half-thickness from a distance field: a quarter ellipse across the rim,
 * flattening to `puff × R` in the middle, where R is the layer's largest
 * distance. Thin parts (an arm stroke) stay thin, fat ones (a head) go deep; a
 * round outline becomes an ellipsoid. It stands vertical at the outline, as a
 * solid's silhouette does, so turned it reads as a body, not a lens.
 */
export declare function pillowHeights(dist: Float32Array, puff: number): Float32Array;
/**
 * Measure a layer's mask (cells on the skin grid): its signed distance field,
 * its half-thickness profile and its bounds. Null for an empty mask.
 */
export declare function silhouette(mask: Uint8Array, puff: number): Silhouette | null;
/**
 * How far each layer's depth must move for the 2D paint order to hold where
 * the layers overlap, face on. `layers` are in paint order, each with its
 * middle plane `z`; `anchor` (usually the torso) stays put. Layers painted
 * after it are raised until their front clears every earlier layer they
 * cover by `gap`; layers painted before it are lowered until every later
 * layer clears them. Cells on a layer's outermost unit don't count, so an
 * anti-aliased rim can't push a whole limb forward.
 */
export declare function paintBias(layers: ReadonlyArray<Pick<Silhouette, 'h' | 'sd'> & {
    z: number;
}>, anchor: number, gap: number): number[];
/**
 * Re-skin a built model with its character's 2D art. Resolves once every layer
 * is swapped; the primitives are hidden, not removed, so the model's joints,
 * poses and face rig are untouched. `isCurrent` lets a caller abandon a skin
 * whose model has since been replaced.
 */
export declare function skinModel(built: BuiltModel, spec: CharacterSpec, opts?: SkinOptions, isCurrent?: () => boolean): Promise<void>;
/**
 * The layer as one closed solid, in art units around the art origin: a front
 * half over the silhouette and its mirror behind, meeting on the outline.
 *
 * The silhouette is the cell grid clipped by the signed distance field
 * (marching triangles), its outline vertices moved onto the art's own
 * half-alpha line — so the edge is the drawing's, face on, and is real
 * geometry, not a cut, from any side. Both halves share those vertices, which
 * makes the solid watertight. Normals are the profile's own: the surface
 * stands vertical at the rim, so the halves meet without a crease.
 */
export declare function solidGeometry(s: Silhouette): THREE.BufferGeometry;
//# sourceMappingURL=skin.d.ts.map
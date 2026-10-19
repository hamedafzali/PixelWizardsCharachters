/**
 * `pixel-wizards-charachters/three` — the three.js renderer.
 *
 * A separate entry so the core package stays dependency-free: only code that
 * imports this path needs `three` installed. A character renders here if its
 * spec has a `body3d`; the frame, motion settings, posture, gaits and gestures
 * are the same ones the SVG rig reads.
 */
export { ThreeActor, type ThreeActorOptions } from './actor.js';
export { skinModel, distanceField, pillowHeights, silhouette, solidGeometry, paintBias, dropMarks, SKIN_GRID, SKIN_CELL, type SkinOptions, type Silhouette, type AlphaImage, } from './skin.js';
export { ActorModel, MOOD_POSES, MOTION_3D, type ActorModelOptions } from './model.js';
export { buildModel, artToWorld, artEuler, toonRamp, GROUND_Y, MOOD_PIVOT_Y, type BuiltModel, type Joint, type EyeRig, type BrowRig, type MouthRig, type FaceRig, } from './build.js';
//# sourceMappingURL=index.d.ts.map
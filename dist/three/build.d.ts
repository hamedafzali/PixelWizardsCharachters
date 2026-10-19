/**
 * `Body3DSpec` → a three.js object tree.
 *
 * The tree is the SVG rig's carriers and layers, one `Group` per joint, nested
 * exactly as `buildLayers` nests the `<g>`s: `root` › `body` › `torso` › limbs,
 * tail, head › ears. Each group sits at its pivot, so a pose applied to it
 * turns around the same point the 2D layer turns around, and the same posture,
 * gait and gesture numbers mean the same thing in both renderers.
 *
 * Pure construction: no renderer, no DOM. It runs under Node, which is how it
 * is tested.
 */
import * as THREE from 'three';
import type { CharacterSpec, LayerName } from '../types.js';
import { type MotionTarget } from '../motion.js';
/** The art-space y of the ground: the SVG shadow's centre line. */
export declare const GROUND_Y = 188;
/** `.rig-mood`'s transform-origin y in `RIG_CSS`. */
export declare const MOOD_PIVOT_Y = 150;
/** Art space (y down, origin top-left) → world (y up, origin on the ground under the character). */
export declare function artToWorld(p: readonly [number, number, number]): THREE.Vector3;
/** A part's `rot` as a three.js rotation. See {@link Part3D.rot} for the convention. */
export declare function artEuler(rot: readonly [number, number, number] | undefined): THREE.Euler;
/** One posable joint: the group, and where it sits at rest. */
export interface Joint {
    node: THREE.Group;
    base: THREE.Vector3;
}
export interface EyeRig {
    /** oriented on the face; scaled for blink, squint and widen */
    node: THREE.Group;
    /** moves in the eye's plane for gaze */
    iris: THREE.Group;
    /** how far the iris travels at gaze ±1 */
    travel: number;
}
export interface BrowRig {
    /** oriented on the face, at the brow line's centre */
    node: THREE.Group;
    /** the stroke itself; positioned and turned per brow key */
    mesh: THREE.Mesh;
    half: number;
}
/**
 * A beak, for characters whose 2D mouth is one (`mouth.beak`): two wedges
 * pointing out of the face, coloured as `drawMouth` colours them. The upper
 * stays put; the lower drops by half the 2D beak's opening.
 */
export interface BeakRig {
    /** scaled in x by the viseme width */
    upper: THREE.Group;
    /** scaled in x by the viseme width; opens by growing down from its top edge */
    lower: THREE.Group;
    tongue: THREE.Mesh;
    /** the lower group's resting y, and its half-height there */
    rest: number;
    half: number;
}
export interface MouthRig {
    node: THREE.Group;
    /** the open mouth: a unit ellipsoid, scaled per viseme */
    open: THREE.Mesh;
    tongue: THREE.Mesh;
    /** the resting smile, at viseme width 1 */
    smile: THREE.Mesh;
    /** the lip press of a closed viseme (م ب پ), at width 1 */
    press: THREE.Mesh;
    half: number;
    /** set when the 2D mouth is a beak; the lip meshes then stay hidden */
    beak: BeakRig | null;
}
export interface FaceRig {
    eyes: EyeRig[];
    brows: BrowRig[];
    mouth: MouthRig;
}
export interface BuiltModel {
    /** add this to a scene; the facing mirror is applied to it */
    object: THREE.Group;
    joints: Map<MotionTarget, Joint>;
    /** the SVG's `.rig-mood` carrier: emotion idle motion, pivoting at the body centre */
    mood: Joint;
    face: FaceRig | null;
    shadow: THREE.Mesh | null;
    has: (l: LayerName) => boolean;
    /** free every geometry, material and texture this build created */
    dispose: () => void;
    /** extra cleanup registered by later passes (the 2D skin); run by `dispose` */
    disposers: Array<() => void>;
}
/**
 * A three-step light ramp: lit, half-lit and shadow, with nothing in between.
 * That banding is what makes the toon material read as illustrated rather than
 * as plastic. Made from data, so it needs no canvas.
 */
export declare function toonRamp(): THREE.DataTexture;
/** Build the 3D model for a character. Throws if the character has no `body3d`. */
export declare function buildModel(spec: CharacterSpec): BuiltModel;
//# sourceMappingURL=build.d.ts.map
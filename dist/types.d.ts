/**
 * character-actor — core types.
 *
 * A character is a puppet. An {@link ActorFrame} is one moment of performance:
 * a connected AI emits a stream of frames while a story plays, and the rig
 * performs them. Every visible behaviour is one field on the frame — nothing
 * is hidden in call sites, so the whole performance is data.
 */
export type EmotionName = 'neutral' | 'happy' | 'excited' | 'thinking' | 'encouraging' | 'sad' | 'surprised' | 'sleepy' | 'love';
/** Persian viseme groups (phoneme families that share a mouth shape). */
export type VisemeName = 'rest' | 'aa' | 'e' | 'i' | 'o' | 'u' | 'mbp' | 'f' | 'sh' | 's' | 'l';
export type Locomotion = 'idle' | 'walk' | 'fly';
export type Gesture = 'wave' | 'jump' | 'spin';
export type Facing = 'left' | 'right';
/** One moment of performance. This is the AI ⇄ rig contract. */
export interface ActorFrame {
    /** character slug, e.g. "roozi" */
    character: string;
    emotion: EmotionName;
    /** emotion strength, 0..1 — scales brows, squint, widen and body tempo */
    intensity: number;
    /** current viseme; `rest` when not speaking */
    viseme: VisemeName;
    /** explicit mouth openness 0..1; when > 0 it overrides the viseme's openness */
    mouthOpen: number;
    /** where the eyes look, each axis -1..1 (0,0 = at the child) */
    gaze: {
        x: number;
        y: number;
    };
    /** independent brow raise, 0..1 */
    browRaise: number;
    locomotion: Locomotion;
    /** motion tempo multiplier, ~0.5..2 */
    speed: number;
    facing: Facing;
    /** one-shot action; null when none is playing */
    gesture: Gesture | null;
}
export declare function defaultFrame(character: string): ActorFrame;
/** Brow shape key — a small vocabulary of eyebrow poses. */
export type BrowKey = 'idle' | 'happy' | 'excited' | 'thinking' | 'encouraging' | 'sad' | 'surprised' | 'sleepy';
export interface EmotionSpec {
    /** lower-lid rise, 0..1 (a happy/sleepy squint) */
    squint: number;
    /** eye widen, 0..1 (surprise/excite) */
    wide: number;
    /** resting mouth when not speaking */
    mouth: 'soft' | 'big' | 'frown' | 'o';
    brow: BrowKey;
}
export interface VisemeSpec {
    /** openness 0..1 */
    o: number;
    /** width multiplier */
    w?: number;
    /** roundness (>1 narrows and rounds, e.g. او) */
    r?: number;
    /** fully closed (م/ب/پ) */
    closed?: boolean;
    /** lower-lip tuck (ف) */
    tuck?: boolean;
    /** show tongue (ل/ن/ت/د/ر) */
    tongue?: boolean;
    /** human-readable label */
    label: string;
}
/** Static description of a character's art + rig anchors. */
export interface CharacterSpec {
    slug: string;
    name: string;
    role?: string;
    /** eye rig anchors — used by blink and gaze */
    eyes: {
        x: [number, number];
        y: number;
        r: number;
    };
    /** eyelid / blink colour (matches the face) */
    lidColor: string;
    /** eyebrow stroke colour */
    browColor: string;
    /**
     * Produce the SVG fragments for a given emotion pose. `art` must expose the
     * rig hooks: `.iris[data-r]` groups, one `.browsG` group, and `#mouthG`.
     */
    render(ctx: {
        emotion: EmotionSpec;
        intensity: number;
    }): {
        grads: string;
        art: string;
        mouth: {
            cx: number;
            cy: number;
            color: string;
            beak?: boolean;
        };
    };
}
//# sourceMappingURL=types.d.ts.map
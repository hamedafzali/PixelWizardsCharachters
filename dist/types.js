/**
* PixelWizardsCharachters — core types.
 *
 * A character is a puppet. An {@link ActorFrame} is one moment of performance:
 * a connected AI emits a stream of frames while a story plays, and the rig
 * performs them. Every visible behaviour is one field on the frame — nothing
 * is hidden in call sites, so the whole performance is data.
 */
export function defaultFrame(character) {
    return {
        character,
        emotion: 'neutral',
        intensity: 0.7,
        viseme: 'rest',
        mouthOpen: 0,
        gaze: { x: 0, y: 0 },
        browRaise: 0,
        locomotion: 'idle',
        speed: 1,
        facing: 'right',
        gesture: null,
    };
}
//# sourceMappingURL=types.js.map
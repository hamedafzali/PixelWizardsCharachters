/**
* PixelWizardsCharachters — core types.
 *
 * A character is a puppet. An {@link ActorFrame} is one moment of performance:
 * a connected AI emits a stream of frames while a story plays, and the rig
 * performs them. Every visible behaviour is one field on the frame — nothing
 * is hidden in call sites, so the whole performance is data.
 */
/**
 * The two channels with no lookup table behind them.
 *
 * Emotions, visemes and gestures each have a registry the runtime can ask "do
 * you have this?". Locomotion and facing had only a type, which is gone by the
 * time a driver's JSON arrives — so an unknown value used to sail through and
 * quietly do nothing, which is worse than a crash: there is no signal at all.
 * These arrays are what `sanitizeFrame` asks instead, and the types are derived
 * *from* them so the list and the union cannot drift apart.
 */
export const LOCOMOTIONS = ['idle', 'walk', 'fly', 'roll'];
/** The valid values for `ActorFrame.facing`. */
export const FACINGS = ['left', 'right'];
/** A sensible resting frame for `character`: neutral, idle, facing right, saying nothing. */
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
/**
 * Paint order for {@link LayerName}.
 *
 * Flat order only — it does not express the *nesting* (`head` inside `torso`,
 * ears inside `head`), which `buildLayers` owns. The two are checked against
 * each other by test rather than derived, because the nesting is what makes
 * transforms compound and a flat list cannot say it.
 */
export const LAYER_ORDER = [
    'shadow', 'accBack', 'tail', 'farArm', 'farLeg', 'torso',
    'nearLeg', 'nearArm', 'earL', 'earR', 'head', 'torsoFront', 'accFront',
];
//# sourceMappingURL=types.js.map
import type { EmotionName, PostureMap, PostureSpec } from './types.js';
/**
 * The shared posture vocabulary — the body-shape half of each emotion.
 *
 * Tuned so the two "low energy" moods are distinguishable in silhouette alone:
 * `sad` folds *forward* (spine bows, ears and tail hard down, symmetric), while
 * `sleepy` *sinks* (knees give, head lolls to one side, everything only half
 * down). At thumbnail size that difference survives when the face does not.
 *
 * Characters override any channel via {@link CharacterSpec.posture} — a rabbit's
 * ears want far more travel than a bear's.
 */
export declare const POSTURES: Record<EmotionName, PostureSpec>;
/**
 * Effective posture for an emotion: the shared preset, overridden per
 * character, then scaled by the frame's `intensity` so the same emotion reads
 * from a faint slouch to a full collapse.
 */
export declare function resolvePosture(name: EmotionName, intensity: number, overrides?: PostureMap): Required<PostureSpec>;
//# sourceMappingURL=posture.d.ts.map
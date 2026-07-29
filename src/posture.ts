import type { EmotionName, PostureMap, PostureSpec } from './types.js'

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
export const POSTURES: Record<EmotionName, PostureSpec> = {
  neutral: {},
  happy: { spine: -2, headDrop: -1, ears: -8, tail: -14, arms: -4 },
  excited: { spine: -5, sink: -2, headDrop: -2, ears: -18, tail: -26, arms: -14 },
  thinking: { spine: 3, headTilt: 14, ears: 4, tail: -2, arms: 4 },
  encouraging: { spine: -3, headDrop: -2, ears: -10, tail: -18, arms: -8 },
  sad: { spine: 9, sink: 3, headDrop: 4, ears: 26, tail: 30, arms: 12 },
  surprised: { spine: -7, sink: -3, headDrop: -4, ears: -22, tail: -20, arms: -18 },
  sleepy: { spine: 4, sink: 6, headDrop: 3, headTilt: 12, ears: 14, tail: 14, arms: 6 },
  love: { spine: -1, headTilt: 9, ears: -6, tail: -18, arms: -2 },
  // `confused` tilts the head the other way from `thinking` on purpose: the two
  // are the closest pair in the face, so the silhouette has to separate them.
  confused: { spine: 1, headTilt: -11, ears: 6, tail: 4, arms: 2 },
  // The only emotion that pulls *up* on every channel at once — drawn tall,
  // chin lifted, tail high. `happy` leans forward; this one leans back.
  proud: { spine: -8, sink: -4, headDrop: -5, ears: -12, tail: -22, arms: -6 },
  // Folds inward rather than down: the arms come in harder than anywhere else
  // on the roster, which is what keeps it out of `sad`'s and `sleepy`'s space.
  shy: { spine: 3, sink: 2, headTilt: 14, headDrop: 4, ears: 10, tail: 6, arms: 20 },
}

const ZERO: Required<PostureSpec> = {
  spine: 0, sink: 0, headTilt: 0, headDrop: 0, ears: 0, tail: 0, arms: 0,
}

/**
 * Effective posture for an emotion: the shared preset, overridden per
 * character, then scaled by the frame's `intensity` so the same emotion reads
 * from a faint slouch to a full collapse.
 */
export function resolvePosture(
  name: EmotionName,
  intensity: number,
  overrides?: PostureMap,
): Required<PostureSpec> {
  const merged = { ...ZERO, ...POSTURES[name], ...overrides?.[name] }
  const k = Math.max(0, Math.min(1, intensity))
  const out = { ...ZERO }
  for (const key of Object.keys(ZERO) as Array<keyof PostureSpec>) out[key] = merged[key] * k
  return out
}

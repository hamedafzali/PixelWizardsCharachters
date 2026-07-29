import type { EmotionName, EmotionSpec, EmotionOverrides } from './types.js'

/**
 * Emotion presets. Each maps to concrete pose channels — a squint, an eye
 * widen, a resting mouth and a brow shape. `intensity` (on the frame) scales
 * squint/widen and the body-motion tempo, so the same emotion reads from a
 * faint smile to a beaming grin.
 */
export const EMOTIONS: Record<EmotionName, EmotionSpec> = {
  neutral: { squint: 0, wide: 0, mouth: 'soft', brow: 'idle' },
  happy: { squint: 0.4, wide: 0, mouth: 'big', brow: 'happy' },
  excited: { squint: 0, wide: 1, mouth: 'big', brow: 'excited' },
  thinking: { squint: 0.1, wide: 0, mouth: 'soft', brow: 'thinking' },
  encouraging: { squint: 0.15, wide: 0.3, mouth: 'big', brow: 'encouraging' },
  sad: { squint: 0, wide: 0, mouth: 'frown', brow: 'sad' },
  surprised: { squint: 0, wide: 1, mouth: 'o', brow: 'surprised' },
  sleepy: { squint: 0.6, wide: 0, mouth: 'soft', brow: 'sleepy' },
  love: { squint: 0.4, wide: 0.2, mouth: 'big', brow: 'happy' },
  // ── added in the emotion-depth pass ─────────────────────────────────────
  // Each is stated as a delta from `neutral` in the port report, and each is
  // held apart from its nearest existing neighbour by a channel that neighbour
  // does not use — see the distinctness test, which fails if any pair drifts
  // together.
  //
  // گیج: the eyes go up and off, which is the single most legible "working it
  // out" cue. Tilts the head the *opposite* way from `thinking`, which is the
  // emotion it would otherwise collide with.
  confused: { squint: 0.05, wide: 0.3, mouth: 'o', brow: 'confused', gaze: { x: 0.28, y: -0.3 } },
  // سربلند: chin up, chest out, a satisfied narrowing rather than a grin.
  // `happy` is the neighbour here, and the separation is carried by posture.
  proud: { squint: 0.3, wide: 0, mouth: 'big', brow: 'proud', gaze: { x: 0, y: -0.18 } },
  // خجالتی: looks down and away. The neighbours are `sad` and `sleepy`, and the
  // thing neither of them does is *avert* — hence the largest gaze offset here.
  shy: { squint: 0.45, wide: 0, mouth: 'soft', brow: 'shy', gaze: { x: -0.36, y: 0.3 } },
}

/**
 * Resolve the effective spec for an emotion, merging any per-character
 * overrides onto the built-in preset. Missing/undefined overrides fall through
 * to the preset, so callers can pass a sparse map (only the changed fields).
 */
export function resolveEmotion(name: EmotionName, overrides?: EmotionOverrides): EmotionSpec {
  const base = EMOTIONS[name]
  const o = overrides?.[name]
  return o ? { ...base, ...o } : base
}

/** Persian display labels for each emotion (for editor UIs). */
export const EMOTION_LABELS: Record<EmotionName, string> = {
  neutral: 'آرام',
  happy: 'خوشحال',
  excited: 'هیجان',
  thinking: 'کنجکاو',
  encouraging: 'تشویق',
  sad: 'ناراحت',
  surprised: 'شگفت',
  sleepy: 'خواب‌آلود',
  love: 'عاشق',
  confused: 'گیج',
  proud: 'سربلند',
  shy: 'خجالتی',
}

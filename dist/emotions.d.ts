import type { EmotionName, EmotionSpec } from './types.js';
/**
 * Emotion presets. Each maps to concrete pose channels — a squint, an eye
 * widen, a resting mouth and a brow shape. `intensity` (on the frame) scales
 * squint/widen and the body-motion tempo, so the same emotion reads from a
 * faint smile to a beaming grin.
 */
export declare const EMOTIONS: Record<EmotionName, EmotionSpec>;
/** Persian display labels for each emotion (for editor UIs). */
export declare const EMOTION_LABELS: Record<EmotionName, string>;
//# sourceMappingURL=emotions.d.ts.map
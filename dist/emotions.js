/**
 * Emotion presets. Each maps to concrete pose channels — a squint, an eye
 * widen, a resting mouth and a brow shape. `intensity` (on the frame) scales
 * squint/widen and the body-motion tempo, so the same emotion reads from a
 * faint smile to a beaming grin.
 */
export const EMOTIONS = {
    neutral: { squint: 0, wide: 0, mouth: 'soft', brow: 'idle' },
    happy: { squint: 0.4, wide: 0, mouth: 'big', brow: 'happy' },
    excited: { squint: 0, wide: 1, mouth: 'big', brow: 'excited' },
    thinking: { squint: 0.1, wide: 0, mouth: 'soft', brow: 'thinking' },
    encouraging: { squint: 0.15, wide: 0.3, mouth: 'big', brow: 'encouraging' },
    sad: { squint: 0, wide: 0, mouth: 'frown', brow: 'sad' },
    surprised: { squint: 0, wide: 1, mouth: 'o', brow: 'surprised' },
    sleepy: { squint: 0.6, wide: 0, mouth: 'soft', brow: 'sleepy' },
    love: { squint: 0.4, wide: 0.2, mouth: 'big', brow: 'happy' },
};
/** Persian display labels for each emotion (for editor UIs). */
export const EMOTION_LABELS = {
    neutral: 'آرام',
    happy: 'خوشحال',
    excited: 'هیجان',
    thinking: 'کنجکاو',
    encouraging: 'تشویق',
    sad: 'ناراحت',
    surprised: 'شگفت',
    sleepy: 'خواب‌آلود',
    love: 'عاشق',
};
//# sourceMappingURL=emotions.js.map
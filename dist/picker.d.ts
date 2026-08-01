/**
 * The character picker — the roster, and one framework-agnostic implementation
 * of choosing from it.
 *
 * There are two pickers in this repo: this one, and `CharacterPicker` in
 * `react.tsx`. That is a deliberate duplication of *markup* and an equally
 * deliberate refusal to duplicate *content*: both call {@link characterRoster}
 * and neither has a list of characters in it. A picker that hardcoded its own
 * roster is how سیمرغ ends up missing from one of them for three releases, so
 * `test/picker.test.mjs` enumerates both and asserts they agree.
 *
 * Each entry carries a real rendered SVG rather than a name, because a picker
 * that shows the characters is worth more than one that lists them — and
 * because it comes free: `renderActorSVG` is the same static renderer the rig
 * mounts, so a thumbnail cannot drift from the thing it stands for.
 */
import type { EmotionName } from './types.js';
export interface RosterEntry {
    slug: string;
    /** the character's own name, in Persian */
    name: string;
    /** a standalone SVG string, ready to drop into a button */
    svg: string;
    /** which gaits this character can be phase-driven through */
    gaits: readonly string[];
    /** gestures this character declines to play on the limb that owns them */
    optsOut: readonly string[];
}
export interface RosterOptions {
    size?: number;
    emotion?: EmotionName;
    intensity?: number;
}
/**
 * The full roster, with a thumbnail per character.
 *
 * Order follows `CHARACTER_SLUGS`, which is the roster's own order — not
 * alphabetical, and not the object key order of `CHARACTERS`, which is an
 * implementation detail that has changed before.
 */
export declare function characterRoster({ size, emotion, intensity }?: RosterOptions): RosterEntry[];
export interface PickerOptions extends RosterOptions {
    /** the initially selected slug; defaults to the first in the roster */
    value?: string;
    onSelect?: (slug: string) => void;
    /** extra class on the container, for host styling */
    className?: string;
}
export interface CharacterPickerHandle {
    /** move the selection without firing `onSelect` */
    setValue(slug: string): void;
    get value(): string;
    destroy(): void;
}
/**
 * Render a picker into `host`.
 *
 * Plain DOM, no framework, no styles beyond the class names — a picker that
 * shipped its own stylesheet would fight every host it is dropped into. The
 * classes are `ca-picker`, `ca-picker-item` and `ca-picker-item.is-selected`.
 */
export declare function createCharacterPicker(host: HTMLElement, { value, onSelect, className, ...roster }?: PickerOptions): CharacterPickerHandle;
//# sourceMappingURL=picker.d.ts.map
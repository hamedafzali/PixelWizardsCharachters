import * as React from 'react';
import type { ActorFrame, EmotionOverrides } from './types.js';
import { ActorRig } from './rig.js';
import { type RosterOptions } from './picker.js';
export interface CharacterActorProps {
    /** character slug from the built-in roster (roozi, ava, …) */
    character: string;
    /** the frame to perform; partial frames merge onto the current one */
    frame?: Partial<ActorFrame>;
    /** per-emotion tuning — overrides any channel of any emotion preset */
    emotions?: EmotionOverrides;
    size?: number;
    blink?: boolean;
    className?: string;
    style?: React.CSSProperties;
    /** fires with the resolved frame after each apply */
    onFrame?: (frame: ActorFrame) => void;
    /** receive the underlying rig (for `.speak()`, `.playGesture()`, …) */
    rigRef?: React.MutableRefObject<ActorRig | null>;
}
/**
 * React binding for {@link ActorRig}. The rig owns the DOM and mutates it
 * imperatively; React only feeds it frames, so lip-sync and gaze never trigger
 * a React re-render. Grab `rigRef` to call `speak()` / `playGesture()`.
 */
export declare function CharacterActor({ character, frame, emotions, size, blink, className, style, onFrame, rigRef, }: CharacterActorProps): React.ReactElement;
export interface CharacterPickerProps extends RosterOptions {
    value?: string;
    onChange?: (slug: string) => void;
    className?: string;
}
/**
 * React picker. The DOM twin of `createCharacterPicker` in `picker.ts`.
 *
 * Two implementations, one roster: both read {@link characterRoster} and
 * neither contains a list of characters. `test/picker.test.mjs` enumerates both
 * and asserts they produce the same slugs in the same order, so a character
 * added to the library cannot appear in one picker and not the other.
 *
 * `dangerouslySetInnerHTML` is doing something ordinary here: the thumbnails are
 * SVG produced by this package's own renderer from its own character specs, not
 * anything a caller supplies. The class names match the vanilla picker
 * (`ca-picker`, `ca-picker-item`, `is-selected`) so one stylesheet dresses both.
 */
export declare function CharacterPicker({ value, onChange, className, ...roster }: CharacterPickerProps): React.ReactElement;
//# sourceMappingURL=react.d.ts.map
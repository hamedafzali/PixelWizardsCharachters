import * as React from 'react';
import type { ActorFrame, EmotionOverrides, Gesture, PlayGestureOptions } from './types.js';
import { ActorRig, type RigOptions } from './rig.js';
import { type RosterOptions } from './picker.js';
export interface CharacterActorProps extends Omit<RigOptions, 'size' | 'blink' | 'emotions'> {
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
    /**
     * Render the character as static SVG until the rig mounts — on the server,
     * and on the client's first paint. On by default; `false` renders an empty
     * `<div>` there, as up to 1.7.1.
     *
     * Read on the first render only: the rig owns the markup from mount on, and
     * React must not write over it.
     */
    ssr?: boolean;
    /**
     * Receive the underlying rig (for `.speak()`, `.playGesture()`, …): a ref
     * object, a callback ref, or the `rigRef` of {@link useActor}. Set to the rig
     * on mount and back to `null` when it is destroyed.
     */
    rigRef?: React.Ref<ActorRig>;
}
/**
 * React binding for {@link ActorRig}. The rig owns the DOM and mutates it
 * imperatively; React only feeds it frames, so lip-sync and gaze never trigger
 * a React re-render. Grab `rigRef` (or use {@link useActor}) to call
 * `speak()` / `playGesture()`.
 *
 * Every {@link RigOptions} field is a prop. Callbacks, `emotions` and `motion`
 * change live; `character`, `size`, `blink`, `reducedMotion`, `micro` and
 * `interpolation` rebuild the rig, which keeps performing the current `frame`.
 * `micro` and `interpolation` are compared by value, so an inline object does
 * not rebuild it on every render. `emotions` and `motion` are compared by
 * identity: memoize them, or every render retunes the rig.
 *
 * Until the rig mounts — on the server, and on the client's first paint — the
 * element holds {@link renderActorSVG} of the same frame, which a settled rig
 * matches part for part (PW-08), so the hand-over does not jump.
 */
export declare function CharacterActor({ character, frame, emotions, size, blink, className, style, ssr, rigRef, onFrame, onSettled, onGestureBlocked, onInvalidFrame, reducedMotion, motion, micro, interpolation, }: CharacterActorProps): React.ReactElement;
/** What {@link useActor} returns: the rig, and its imperative calls. */
export interface ActorHandle {
    /** pass to `<CharacterActor rigRef={…}>` */
    readonly rigRef: React.RefCallback<ActorRig>;
    /** the mounted rig, or `null`; the component re-renders when it changes */
    readonly rig: ActorRig | null;
    /** {@link ActorRig.apply}; nothing before mount */
    apply(frame: Partial<ActorFrame>): void;
    /** {@link ActorRig.speak}; nothing before mount */
    speak(text: string, perViseme?: number): void;
    /**
     * {@link ActorRig.playGesture}. Before mount `onEnd` gets `'skipped'`, as the
     * rig itself reports a gesture it has nowhere to play.
     */
    playGesture(g: Gesture, opts?: PlayGestureOptions): void;
    /** {@link ActorRig.blink}; nothing before mount */
    blink(): void;
    /** {@link ActorRig.finish}; nothing before mount */
    finish(): void;
}
/**
 * A handle on a {@link CharacterActor}'s rig, for speech and gestures:
 *
 * ```tsx
 * const actor = useActor()
 * <CharacterActor character="roozi" rigRef={actor.rigRef} />
 * actor.playGesture('wave', { onEnd: (how) => console.log(how) })
 * ```
 *
 * The calls go to whichever rig is mounted when they are made, so one kept in a
 * timeout or an event handler never reaches a rig that has been rebuilt.
 */
export declare function useActor(): ActorHandle;
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
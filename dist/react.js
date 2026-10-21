import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { defaultFrame } from './types.js';
import { ActorRig } from './rig.js';
import { renderActorSVG } from './render.js';
import { knownCharacter } from './validate.js';
import { characterRoster } from './picker.js';
function assignRef(ref, value) {
    if (typeof ref === 'function')
        ref(value);
    else if (ref)
        ref.current = value;
}
/**
 * Whether this is a production build. Bundlers replace `process.env.NODE_ENV`
 * textually; in a browser without one, `process` does not exist and the
 * lookup throws — that is a development setup, so it warns.
 */
function isProduction() {
    try {
        // @ts-ignore -- no Node types here; replaced by the bundler or thrown on.
        return process.env.NODE_ENV === 'production';
    }
    catch {
        return false;
    }
}
const warned = new Set();
/** One console warning per unknown slug, outside production builds. */
function warnUnknown(character) {
    if (warned.has(character) || isProduction())
        return;
    warned.add(character);
    console.warn(`[pixel-wizards-charachters] <CharacterActor character=${JSON.stringify(character)}> ` +
        'is not a built-in character, so nothing is rendered. See CHARACTER_SLUGS for the names.');
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
export function CharacterActor({ character, frame, emotions, size = 160, blink = true, className, style, ssr = true, rigRef, onFrame, onSettled, onGestureBlocked, onInvalidFrame, reducedMotion, motion, micro, interpolation, }) {
    const hostRef = React.useRef(null);
    const rig = React.useRef(null);
    const callbacks = React.useRef({});
    callbacks.current = { onFrame, onSettled, onGestureBlocked, onInvalidFrame };
    // The latest values, for a rebuild to start from.
    const latest = React.useRef({ frame, emotions, motion, rigRef });
    latest.current = { frame, emotions, motion, rigRef };
    // What the rig in hand was given, so the live effects skip a value it already has.
    const given = React.useRef({});
    const spec = knownCharacter(character);
    if (!spec)
        warnUnknown(character);
    // The static first paint, frozen: React compares `__html` between renders,
    // and a changed string would overwrite the rig's DOM.
    const [markup] = React.useState(() => ssr && spec
        ? { __html: renderActorSVG(spec, { ...defaultFrame(spec.slug), ...frame }, size, emotions, { motion }) }
        : undefined);
    const build = { micro, interpolation };
    const buildKey = JSON.stringify(build);
    const buildRef = React.useRef(build);
    buildRef.current = build;
    // Build / rebuild when the character or a build-time option changes.
    React.useEffect(() => {
        if (!hostRef.current || !spec)
            return;
        const { frame, emotions, motion, rigRef } = latest.current;
        const cb = () => callbacks.current;
        const r = new ActorRig(spec, {
            ...buildRef.current,
            size,
            blink,
            reducedMotion,
            emotions,
            onFrame: (f) => cb().onFrame?.(f),
            onSettled: (f) => cb().onSettled?.(f),
            onGestureBlocked: (g, why) => cb().onGestureBlocked?.(g, why),
            onInvalidFrame: (e) => cb().onInvalidFrame?.(e),
        });
        // Live rather than an option, so a later change replaces it outright.
        if (motion)
            r.setMotion(motion);
        given.current = { emotions, motion };
        // Before mount, so the rig mounts already on the frame: an unmounted rig
        // arrives at once, and the static first paint shows that same frame.
        if (frame)
            r.apply(frame);
        r.mount(hostRef.current);
        rig.current = r;
        assignRef(rigRef, r);
        return () => {
            r.destroy();
            if (rig.current === r)
                rig.current = null;
            assignRef(rigRef, null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spec, size, blink, reducedMotion, buildKey]);
    // Retune emotions live (editor preview / saved overrides).
    React.useEffect(() => {
        if (!rig.current || given.current.emotions === emotions)
            return;
        given.current.emotions = emotions;
        rig.current.setEmotions(emotions);
    }, [emotions]);
    React.useEffect(() => {
        if (!rig.current || given.current.motion === motion)
            return;
        given.current.motion = motion;
        rig.current.setMotion(motion);
    }, [motion]);
    // Feed frames on update.
    React.useEffect(() => {
        if (rig.current && frame)
            rig.current.apply(frame);
    }, [frame]);
    return _jsx("div", { ref: hostRef, className: className, style: style, dangerouslySetInnerHTML: markup });
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
export function useActor() {
    const [rig, setRig] = React.useState(null);
    const current = React.useRef(null);
    const rigRef = React.useCallback((r) => {
        current.current = r;
        setRig(r);
    }, []);
    return React.useMemo(() => ({
        rigRef,
        rig,
        apply: (frame) => current.current?.apply(frame),
        speak: (text, perViseme) => current.current?.speak(text, perViseme),
        playGesture: (g, opts = {}) => {
            if (current.current)
                current.current.playGesture(g, opts);
            else
                opts.onEnd?.('skipped');
        },
        blink: () => current.current?.blink(),
        finish: () => current.current?.finish(),
    }), [rig, rigRef]);
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
export function CharacterPicker({ value, onChange, className, ...roster }) {
    const entries = React.useMemo(() => characterRoster(roster), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster.size, roster.emotion, roster.intensity]);
    const selected = value ?? entries[0]?.slug;
    return (_jsx("div", { className: className ? `ca-picker ${className}` : 'ca-picker', role: "radiogroup", "aria-label": "character", children: entries.map((e) => (_jsxs("button", { type: "button", role: "radio", "data-slug": e.slug, "aria-label": e.name, "aria-checked": e.slug === selected, tabIndex: e.slug === selected ? 0 : -1, className: e.slug === selected ? 'ca-picker-item is-selected' : 'ca-picker-item', onClick: () => onChange?.(e.slug), children: [_jsx("span", { "aria-hidden": "true", dangerouslySetInnerHTML: { __html: e.svg } }), _jsx("span", { className: "ca-picker-name", children: e.name })] }, e.slug))) }));
}
//# sourceMappingURL=react.js.map
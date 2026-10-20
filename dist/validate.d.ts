/**
 * Frame validation — what happens when a driver names something that does not
 * exist.
 *
 * The intended caller of this library is a model deciding, turn by turn, how
 * the character should perform. Models emit a name that is *nearly* right:
 * `joy` for `happy`, `sh` for `ch`, a gesture from a prompt that listed nine
 * and remembered ten. Until 0.5.1 three of those threw a `TypeError` out of a
 * render deep inside the rig — a whole performance lost to one bad word, and
 * lost at the point of drawing rather than at the point of asking.
 *
 * The policy is **keep what the character is already doing**, not "reset to
 * neutral". A driver mid-sentence that fumbles one emotion name should not have
 * the face snap to blank; the last thing it successfully asked for is a much
 * better guess at its intent than a default is. Where there is nothing to keep
 * — a static render, the first frame — the documented default applies, which is
 * exactly what "reset to neutral" would have done anyway. So this is the
 * gentler policy everywhere and an identical one at the boundary.
 *
 * `gesture` is the exception, and deliberately: an unknown gesture drops to
 * `null` rather than holding the previous one, because holding it would replay
 * a movement nobody asked for. Refusing to act is a safe failure; acting
 * differently is not.
 *
 * Nothing is silent. Every rejection reaches {@link OnInvalidFrame} if the
 * caller installed one, and a driver that wants to be strict can throw from
 * inside it.
 *
 * Five named channels are validated. Three of them (`emotion`, `viseme`, `gesture`)
 * are table lookups whose result is dereferenced immediately, and used to
 * throw. The other two (`locomotion`, `facing`) never threw and are here for
 * the opposite reason: an unknown value was **accepted, stored, and then
 * matched by nothing**, so the character simply did not walk and no one was
 * told. A silent no-op is the worse failure of the two — a crash at least names
 * a line. They have no registry to interrogate, so `types.ts` exports the value
 * lists the unions are derived from, and they are checked against those.
 *
 * The numeric channels never threw either, and up to 1.6.0 they were not
 * checked: `intensity: 'high'` or `mouthOpen: NaN` reached the interpolator,
 * which turned anything non-finite into 0, so the character went flat and no
 * one was told (PW-09). They are checked now, by the same policy as the names:
 * a value that is not a finite number is reported and the current one kept. A
 * finite number outside its range is not an error — the interpolator clamps it,
 * as documented on `ActorFrame`.
 *
 * `character` is checked by the renderers rather than here, through
 * {@link knownCharacter}: a rig may be showing a custom spec that is in no
 * registry, and only the rig knows its own slug.
 */
import type { ActorFrame, CharacterSpec } from './types.js';
/**
 * Is this a gesture the library actually has?
 *
 * `rig.playGesture()` is reachable without going through `apply()`, so it needs
 * the same test — and it must be *this* test, not a second one that could drift
 * away from what `sanitizeFrame` accepts.
 */
export declare function isKnownGesture(g: unknown): boolean;
/**
 * The built-in character a frame's `character` names, or `null`.
 *
 * Shared by `ActorRig` and `ActorModel`, which both switch characters when a
 * frame names a different one (PW-01), so the two cannot disagree about which
 * names exist.
 */
export declare function knownCharacter(name: unknown): CharacterSpec | null;
/** One channel of one frame that named something the library does not have. */
export interface FrameIssue {
    channel: 'emotion' | 'viseme' | 'gesture' | 'locomotion' | 'facing' | 'character' | 'intensity' | 'mouthOpen' | 'browRaise' | 'speed' | 'yaw' | 'gaze';
    /** exactly what the caller passed, untouched — including its type */
    value: unknown;
    /** what the rig used instead */
    kept: unknown;
}
/**
 * Notified once per rejected channel, before the frame is applied.
 *
 * Throwing from here turns a soft failure back into a hard one, on purpose: a
 * test suite or a strict driver can install a thrower and find out immediately.
 */
export type OnInvalidFrame = (issue: FrameIssue) => void;
/**
 * Return `frame` with any unknown name or non-numeric number replaced.
 *
 * The input is never mutated, and a clean frame is returned **by identity** —
 * `speak()` applies one frame per viseme, so the common path allocates nothing.
 */
export declare function sanitizeFrame<T extends Partial<ActorFrame>>(frame: T, current?: ActorFrame | null, onInvalid?: OnInvalidFrame): T;
//# sourceMappingURL=validate.d.ts.map
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
 * Five channels are validated. Three of them (`emotion`, `viseme`, `gesture`)
 * are table lookups whose result is dereferenced immediately, and used to
 * throw. The other two (`locomotion`, `facing`) never threw and are here for
 * the opposite reason: an unknown value was **accepted, stored, and then
 * matched by nothing**, so the character simply did not walk and no one was
 * told. A silent no-op is the worse failure of the two — a crash at least names
 * a line. They have no registry to interrogate, so `types.ts` exports the value
 * lists the unions are derived from, and they are checked against those.
 *
 * The numeric channels were measured for the same failure — `intensity:
 * 'high'`, `mouthOpen: null`, `gaze: null`, `speed: 'fast'` — and none of them
 * put a `NaN` into the DOM, so none of them are checked here.
 */

import { EMOTIONS } from './emotions.js'
import { VISEMES } from './visemes.js'
import { GESTURES } from './gestures.js'
import { LOCOMOTIONS, FACINGS } from './types.js'
import type { ActorFrame } from './types.js'

/**
 * Own-key test that does not go through the prototype chain.
 *
 * `name in EMOTIONS` would accept `'toString'` and `'constructor'` — names a
 * confused driver can genuinely produce — and hand a `Function` to code
 * expecting an `EmotionSpec`, which is a stranger crash than the one being
 * fixed. `Object.hasOwn` says this in one call but is ES2022; the package
 * targets ES2020 and a patch release is not where that changes.
 */
function has(table: object, name: unknown): boolean {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(table, name)
}

/**
 * Is this a gesture the library actually has?
 *
 * `rig.playGesture()` is reachable without going through `apply()`, so it needs
 * the same test — and it must be *this* test, not a second one that could drift
 * away from what `sanitizeFrame` accepts.
 */
export function isKnownGesture(g: unknown): boolean {
  return has(GESTURES, g)
}

/** Membership in a list, for the two channels that have no registry. */
function oneOf(values: readonly string[], name: unknown): boolean {
  return typeof name === 'string' && values.includes(name)
}

/** One channel of one frame that named something the library does not have. */
export interface FrameIssue {
  channel: 'emotion' | 'viseme' | 'gesture' | 'locomotion' | 'facing'
  /** exactly what the caller passed, untouched — including its type */
  value: unknown
  /** what the rig used instead */
  kept: unknown
}

/**
 * Notified once per rejected channel, before the frame is applied.
 *
 * Throwing from here turns a soft failure back into a hard one, on purpose: a
 * test suite or a strict driver can install a thrower and find out immediately.
 */
export type OnInvalidFrame = (issue: FrameIssue) => void

/**
 * Return `frame` with any unknown emotion / viseme / gesture replaced.
 *
 * The input is never mutated, and a clean frame is returned **by identity** —
 * `speak()` applies one frame per viseme, so the common path allocates nothing.
 */
export function sanitizeFrame<T extends Partial<ActorFrame>>(
  frame: T,
  current?: ActorFrame | null,
  onInvalid?: OnInvalidFrame,
): T {
  let out: T | null = null
  const fix = (channel: FrameIssue['channel'], value: unknown, kept: unknown): void => {
    out ??= { ...frame }
    ;(out as Record<string, unknown>)[channel] = kept
    onInvalid?.({ channel, value, kept })
  }

  if (frame.emotion !== undefined && !has(EMOTIONS, frame.emotion)) {
    fix('emotion', frame.emotion, current?.emotion ?? 'neutral')
  }
  if (frame.viseme !== undefined && !has(VISEMES, frame.viseme)) {
    fix('viseme', frame.viseme, current?.viseme ?? 'rest')
  }
  // `null` is the documented "no gesture" value and must stay legal.
  if (frame.gesture !== undefined && frame.gesture !== null && !has(GESTURES, frame.gesture)) {
    fix('gesture', frame.gesture, null)
  }
  // These two keep the current value for the same reason emotion does — a
  // driver that mistypes `run` is mid-journey, and stopping the character dead
  // is a louder wrong answer than carrying on walking.
  if (frame.locomotion !== undefined && !oneOf(LOCOMOTIONS, frame.locomotion)) {
    fix('locomotion', frame.locomotion, current?.locomotion ?? 'idle')
  }
  if (frame.facing !== undefined && !oneOf(FACINGS, frame.facing)) {
    fix('facing', frame.facing, current?.facing ?? 'right')
  }

  return out ?? frame
}

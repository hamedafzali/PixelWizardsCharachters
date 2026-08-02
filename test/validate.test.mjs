/**
 * Invalid frame values.
 *
 * The crash these cover was found by a consumer smoke test, not by a unit test,
 * and it was found by accident: `emotion: 'joy'` typed instead of `'happy'`.
 * `resolveEmotion` returned `undefined`, and the failure surfaced several calls
 * later as `Cannot read properties of undefined (reading 'squint')` inside a
 * render — a stack trace with no mention of the word that caused it.
 *
 * Nothing in the type system stops that: the driver is a language model, its
 * output arrives as JSON, and `as ActorFrame` at the boundary is a promise the
 * caller makes and cannot keep. So the runtime has to.
 *
 * The tests below deliberately assert on **both** halves of the guard: that the
 * call does not throw, *and* that the character is left in a specific, named
 * state. A guard that swallowed the value and did nothing else would pass the
 * first half alone, which is why the mutation for this (M17) neuters the check
 * rather than the throw.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { setupDom } from './helpers/dom.mjs'
import {
  ActorRig, CHARACTERS, EMOTIONS, VISEMES, GESTURES, LOCOMOTIONS, FACINGS,
  renderActorSVG, defaultFrame, sanitizeFrame,
} from '../dist/index.js'

function withRig(opts, fn) {
  const dom = setupDom()
  try {
    const rig = new ActorRig(CHARACTERS.roozi, { blink: false, micro: { amount: 0 }, ...opts })
    rig.mount(dom.host)
    rig.finish()
    dom.advance(64)
    return fn({ rig, dom, svg: dom.host.querySelector('svg') })
  } finally {
    dom.restore()
  }
}

// ── the exact reported crash ─────────────────────────────────────────────────

test("rig.apply({ emotion: 'joy' }) does not throw", () => {
  withRig({}, ({ rig }) => {
    assert.doesNotThrow(() => rig.apply({ emotion: 'joy' }))
  })
})

test('an unknown emotion keeps the one the character is already wearing', () => {
  const issues = []
  withRig({ onInvalidFrame: (i) => issues.push(i) }, ({ rig, dom }) => {
    rig.apply({ emotion: 'excited' })
    rig.finish()
    dom.advance(64)
    assert.equal(rig.frame.emotion, 'excited')

    rig.apply({ emotion: 'joy' })
    rig.finish()
    dom.advance(64)

    // Not 'neutral': the last thing the driver successfully asked for is a
    // better guess at its intent than a default is, and snapping the face blank
    // mid-performance is visible to the audience.
    assert.equal(rig.frame.emotion, 'excited',
      'a bad emotion name discarded the emotion the character was wearing')
    assert.deepEqual(issues, [{ channel: 'emotion', value: 'joy', kept: 'excited' }])
  })
})

test('the rest of a frame carrying one bad channel still applies', () => {
  withRig({}, ({ rig, dom }) => {
    rig.apply({ emotion: 'joy', locomotion: 'walk', facing: 'left' })
    rig.finish()
    dom.advance(200)
    // One bad word must not cost the caller the whole frame.
    assert.equal(rig.frame.locomotion, 'walk')
    assert.equal(rig.frame.facing, 'left')
    assert.equal(rig.frame.emotion, 'neutral')
  })
})

// ── the other two channels that could reach a bare lookup ────────────────────

test('an unknown viseme keeps the current mouth shape', () => {
  const issues = []
  withRig({ onInvalidFrame: (i) => issues.push(i) }, ({ rig, dom }) => {
    rig.apply({ viseme: 'aa' })
    rig.finish()
    dom.advance(64)

    // 'th' is not a viseme this library has, and 'o' no longer is either
    // (folded into 'u' by the Design 3 table reduction) — either is a
    // plausible name from a phoneme mapper built against a different table,
    // which is why 'th' below is not a nonsense string.
    assert.doesNotThrow(() => rig.apply({ viseme: 'th' }))
    rig.finish()
    dom.advance(64)
    assert.equal(rig.frame.viseme, 'aa')
    assert.deepEqual(issues, [{ channel: 'viseme', value: 'th', kept: 'aa' }])
  })
})

test('viseme names are case-sensitive, and the wrong case is caught not crashed', () => {
  // The shipped names are lowercase. 'AA' looks like a viseme, is not one, and
  // used to be a crash.
  assert.equal(sanitizeFrame({ viseme: 'AA' }).viseme, 'rest')
  assert.equal(sanitizeFrame({ emotion: 'Happy' }).emotion, 'neutral')
})

test('an unknown gesture is dropped rather than held', () => {
  const issues = []
  withRig({ onInvalidFrame: (i) => issues.push(i) }, ({ rig, dom }) => {
    rig.apply({ gesture: 'wave' })
    rig.finish()
    dom.advance(64)

    assert.doesNotThrow(() => rig.apply({ gesture: 'dab' }))
    rig.finish()
    dom.advance(64)
    // The one channel that does NOT keep its previous value: holding it would
    // replay a movement the caller never asked for. Refusing to act is a safe
    // failure; acting differently is not.
    assert.equal(rig.frame.gesture, null)
    assert.deepEqual(issues, [{ channel: 'gesture', value: 'dab', kept: null }])
  })
})

test('asking to play an unknown gesture directly is refused, not thrown', () => {
  const issues = []
  withRig({ onInvalidFrame: (i) => issues.push(i) }, ({ rig }) => {
    // playGesture() and scrubGesture() reach planGesture() without passing
    // through apply(), so they need the guard on their own path.
    assert.equal(rig.planFor('dab'), null)
    assert.doesNotThrow(() => rig.playGesture('dab'))
    assert.equal(rig.scrubGesture('dab', 0.5), null)
    assert.equal(issues.length, 3)
    assert.ok(issues.every((i) => i.channel === 'gesture' && i.value === 'dab'))
  })
})

// ── the two channels that never threw, and were worse for it ────────────────
//
// `locomotion: 'run'` did not crash. It was accepted, stored in the frame, and
// then matched by nothing — the character stood still, `rig.frame.locomotion`
// read back 'run', and no signal of any kind reached the caller. A crash at
// least names a line.

test('an unknown locomotion is reported instead of silently doing nothing', () => {
  const issues = []
  withRig({ onInvalidFrame: (i) => issues.push(i) }, ({ rig, dom, svg }) => {
    rig.apply({ locomotion: 'walk' })
    rig.finish()
    dom.advance(200)
    assert.ok(svg.classList.contains('loco-walk'))

    rig.apply({ locomotion: 'run' })
    rig.finish()
    dom.advance(200)

    // The frame must not report a locomotion the rig cannot be in. That
    // disagreement between `frame` and the DOM was the whole defect.
    assert.equal(rig.frame.locomotion, 'walk')
    assert.ok(svg.classList.contains('loco-walk'), 'the character stopped moving with nothing said')
    assert.deepEqual(issues, [{ channel: 'locomotion', value: 'run', kept: 'walk' }])
  })
})

test('an unknown facing is reported, and the character does not un-flip', () => {
  const issues = []
  withRig({ onInvalidFrame: (i) => issues.push(i) }, ({ rig, dom, svg }) => {
    rig.apply({ facing: 'left' })
    rig.finish()
    dom.advance(64)
    const flipped = svg.querySelector('.rig-flip').getAttribute('transform')

    rig.apply({ facing: 'west' })
    rig.finish()
    dom.advance(64)
    assert.equal(rig.frame.facing, 'left')
    assert.equal(svg.querySelector('.rig-flip').getAttribute('transform'), flipped)
    assert.deepEqual(issues, [{ channel: 'facing', value: 'west', kept: 'left' }])
  })
})

test('with nothing to keep, these two fall back to their documented defaults', () => {
  assert.equal(sanitizeFrame({ locomotion: 'run' }).locomotion, 'idle')
  assert.equal(sanitizeFrame({ facing: 'west' }).facing, 'right')
  // The same defaults `defaultFrame` ships, not a second opinion about them.
  assert.equal(sanitizeFrame({ locomotion: 'run' }).locomotion, defaultFrame('roozi').locomotion)
  assert.equal(sanitizeFrame({ facing: 'west' }).facing, defaultFrame('roozi').facing)
})

test('the value lists and the types they derive cannot drift apart', () => {
  // LOCOMOTIONS/FACINGS are the runtime half of a union that is otherwise
  // erased before a driver's JSON ever arrives.
  for (const locomotion of LOCOMOTIONS) assert.equal(sanitizeFrame({ locomotion }).locomotion, locomotion)
  for (const facing of FACINGS) assert.equal(sanitizeFrame({ facing }).facing, facing)
  assert.deepEqual([...LOCOMOTIONS], ['idle', 'walk', 'fly'])
  assert.deepEqual([...FACINGS], ['left', 'right'])
})

// ── the static path, which has nothing to keep ───────────────────────────────

test('renderActorSVG survives a bad frame and falls back to the documented default', () => {
  let svg
  assert.doesNotThrow(() => {
    svg = renderActorSVG(CHARACTERS.roozi, { ...defaultFrame('roozi'), emotion: 'joy', viseme: 'th' }, 160)
  })
  assert.ok(svg.startsWith('<svg') && svg.length > 2000, 'the fallback render came out empty')
  // Identical to the frame it degrades to, byte for byte — the fallback is the
  // documented default, not a third rendering path.
  assert.equal(svg, renderActorSVG(CHARACTERS.roozi, defaultFrame('roozi'), 160))
})

// ── the guard's own contract ─────────────────────────────────────────────────

test('a clean frame comes back by identity, so speak() allocates nothing', () => {
  // speak() applies one frame per viseme; a validator that copied every frame
  // would put an allocation on the hottest path in the library.
  const frame = { emotion: 'happy', viseme: 'aa', gesture: 'wave' }
  assert.equal(sanitizeFrame(frame), frame)
  assert.equal(sanitizeFrame({ gesture: null }).gesture, null, 'null is the documented "no gesture"')
})

test('the guard never mutates the frame it was handed', () => {
  const frame = { emotion: 'joy' }
  sanitizeFrame(frame, null)
  assert.equal(frame.emotion, 'joy', 'sanitizeFrame edited the caller’s object')
})

test('every name the library ships passes its own guard', () => {
  // The roster is the source of truth in both directions: nothing valid may be
  // rejected, which is how a newly added emotion would fail here rather than
  // silently becoming un-settable.
  for (const emotion of Object.keys(EMOTIONS)) assert.equal(sanitizeFrame({ emotion }).emotion, emotion)
  for (const viseme of Object.keys(VISEMES)) assert.equal(sanitizeFrame({ viseme }).viseme, viseme)
  for (const gesture of Object.keys(GESTURES)) assert.equal(sanitizeFrame({ gesture }).gesture, gesture)
})

test('inherited property names are not mistaken for library values', () => {
  // `in` would accept these and hand a Function to code expecting an
  // EmotionSpec — a stranger crash than the one being fixed.
  for (const name of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(sanitizeFrame({ emotion: name }).emotion, 'neutral', `${name} was accepted as an emotion`)
  }
})

test('a driver that wants the old fail-fast behaviour can still have it', () => {
  withRig({ onInvalidFrame: (i) => { throw new Error(`bad ${i.channel}: ${i.value}`) } }, ({ rig }) => {
    assert.throws(() => rig.apply({ emotion: 'joy' }), /bad emotion: joy/)
  })
})

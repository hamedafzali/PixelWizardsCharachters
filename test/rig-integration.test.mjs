import test from 'node:test'
import assert from 'node:assert/strict'
import { ActorRig, CHARACTERS, defaultFrame, artKeyOf, DEFAULT_PROFILE } from '../dist/index.js'
import { setupDom, readDom } from './helpers/dom.mjs'

/**
 * End-to-end tests through ActorRig, not through FrameInterpolator directly.
 *
 * The unit tests prove the interpolator is correct in isolation; these prove it
 * is correct once the rig owns the tick loop, the art cache and the DOM. Wiring
 * is exactly where correct pieces start misbehaving together — a channel can be
 * flawless and still never reach the DOM.
 */

/** A rig on a manual clock, with blink and micro-motion off so timings are exact. */
function mountRig(over = {}) {
  const dom = setupDom()
  const seen = []
  const rig = new ActorRig(CHARACTERS.roozi, {
    blink: false,
    micro: { amount: 0 },
    onFrame: (f) => seen.push({ ...f, gaze: { ...f.gaze } }),
    ...over,
  })
  rig.mount(dom.host)
  const renders = () => dom.host.querySelector('svg')
  return { ...dom, rig, seen, dom: () => readDom(dom.host), svgNode: renders }
}

const R = CHARACTERS.roozi.eyes.r

// ------------------------------------------------ a full frame change over time ---

test('a full frame change drives the DOM on the profile\'s schedule', () => {
  const t = mountRig()
  try {
    // Baseline, landed, so the transition below starts from a known pose.
    t.rig.apply({ emotion: 'neutral', intensity: 0.7, gaze: { x: 0, y: 0 }, browRaise: 0 })
    t.rig.finish()

    const before = t.dom()
    assert.equal(before.irisDx, 0)
    assert.equal(before.browY, 0)

    t.rig.apply({ emotion: 'surprised', intensity: 1, gaze: { x: 1, y: 0 }, browRaise: 1 })

    // t=0 — only the zero-duration channels have landed.
    let d = t.dom()
    assert.equal(d.irisDx, 0, 'gaze has an 18ms reaction delay; it cannot have moved yet')
    assert.equal(d.browY, 0, 'browRaise has a 90ms delay')
    assert.ok(t.rig.settling, 'and the rig knows it is mid-transition')

    // t=16 — inside gaze's 18ms delay.
    t.advance(16)
    assert.equal(t.dom().irisDx, 0, `gaze moved before its ${DEFAULT_PROFILE.gazeX.delay}ms delay elapsed`)

    // t=32 — easeOutQuint is ballistic: most of the distance is already covered.
    t.advance(16)
    d = t.dom()
    assert.ok(d.irisDx > 0.5 * R * 0.5, `a saccade should be mostly done by 32ms, got ${d.irisDx}`)
    assert.ok(d.irisDx < R * 0.5, 'but not yet arrived')

    // t=112 — gaze's 18ms delay + 90ms travel.
    t.advance(80)
    assert.equal(t.dom().irisDx, R * 0.5, 'gaze should have landed by 108ms')

    // browRaise is deliberately still lagging while gaze is already done.
    assert.ok(Math.abs(t.dom().browY) < 5, 'browRaise must not have arrived with gaze')

    // t=400 — browRaise's 90ms delay + 300ms travel.
    t.advance(288)
    d = t.dom()
    assert.equal(d.browY, -5, 'browRaise should be fully raised')
    assert.equal(d.eyeScale, 1.12, 'and intensity should have reached full widen')
    assert.ok(!t.rig.settling, 'everything has arrived')
  } finally { t.restore() }
})

test('browRaise stays put through its whole delay, then moves', () => {
  const t = mountRig()
  try {
    t.rig.apply({ browRaise: 0 })
    t.rig.finish()
    t.rig.apply({ browRaise: 1 })

    t.advance(80)
    assert.equal(t.dom().browY, 0, 'still inside the 90ms lag')
    t.advance(16)                                  // t=96
    assert.ok(t.dom().browY < 0, 'and moving just after it')
  } finally { t.restore() }
})

test('the art key changes once, and an intensity glide re-renders nothing', () => {
  const t = mountRig()
  try {
    t.rig.apply({ emotion: 'neutral', intensity: 0 })
    t.rig.finish()

    const before = t.svgNode()
    t.rig.apply({ emotion: 'surprised', intensity: 1 })

    // The emotion swap *must* re-render — brows and mouth are baked art.
    assert.notEqual(t.svgNode(), before, 'an emotion change should redraw')

    // Everything after it is pure intensity, which must not.
    const keys = []
    let node = t.svgNode()
    let rerenders = 0
    for (let i = 0; i < 30; i++) {
      t.advance(16)
      keys.push(artKeyOf(t.rig.frame))
      if (t.svgNode() !== node) { rerenders++; node = t.svgNode() }
    }

    assert.deepEqual([...new Set(keys)], ['roozi|surprised|right'],
      'emotion is discrete: the key jumps at apply() and never takes a third value')
    assert.equal(rerenders, 0,
      `the intensity glide caused ${rerenders} re-renders after the emotion swap`)
    assert.equal(t.dom().eyeScale, 1.12, 'while the eye still reached full widen')
  } finally { t.restore() }
})

test('a pure intensity change never re-renders, end to end', () => {
  const t = mountRig()
  try {
    t.rig.apply({ emotion: 'surprised', intensity: 0.2 })
    t.rig.finish()
    const node = t.svgNode()
    const before = t.dom().eyeScale

    t.rig.apply({ intensity: 0.9 })
    for (let i = 0; i < 30; i++) t.advance(16)

    assert.equal(t.svgNode(), node, 'the SVG node was replaced — that is a full re-render')
    assert.ok(t.dom().eyeScale > before, 'yet the eye actually widened')
    assert.equal(t.dom().eyeScale, Number((1 + 0.9 * 0.12).toFixed(4)))
  } finally { t.restore() }
})

// ------------------------------------------------------------------- settling ---

test('settling goes false on arrival and the rig stops doing frame work', () => {
  const t = mountRig()
  try {
    t.rig.apply({ emotion: 'happy', intensity: 1, gaze: { x: -1, y: 0.5 }, browRaise: 1 })
    assert.ok(t.rig.settling)

    t.advance(600)
    assert.equal(t.rig.settling, false, 'everything should have landed well inside 600ms')

    const frozen = t.dom()
    const calls = t.seen.length

    t.advance(1000)   // the loop keeps running; it just has nothing to do

    assert.equal(t.seen.length, calls,
      'onFrame fired again after settling — the loop is redoing frame work forever')
    const after = t.dom()
    for (const k of ['eyeTransform', 'lidRy', 'irisTransform', 'browY', 'walking']) {
      assert.deepEqual(after[k], frozen[k], `${k} changed after the frame had settled`)
    }
  } finally { t.restore() }
})

test('the last tick of a transition is rendered, not dropped', () => {
  // `settling` is sampled before ticking precisely so the landing frame still
  // reaches the DOM. Sampling it after would strand the final value.
  const t = mountRig()
  try {
    t.rig.apply({ browRaise: 0 })
    t.rig.finish()
    t.rig.apply({ browRaise: 1 })
    t.advance(1000)
    assert.equal(t.rig.settling, false)
    assert.equal(t.dom().browY, -5, 'the final value never made it into the DOM')
  } finally { t.restore() }
})

// ------------------------- the isolated guarantees, re-verified through apply() ---

test('per-channel no-op survives the wiring: gaze traffic does not starve browRaise', () => {
  const t = mountRig()
  try {
    t.rig.apply({ emotion: 'neutral', browRaise: 0, gaze: { x: 0, y: 0 } })
    t.rig.finish()

    // A driver resending the entire frame every tick, gaze moving, as a real
    // performance does. If apply() collapsed to whole-frame equality, browRaise
    // would re-arm its 90ms delay forever and never move at all.
    const held = { ...t.rig.goal, emotion: 'surprised', browRaise: 1 }
    for (let i = 0; i < 30; i++) {
      t.rig.apply({ ...held, gaze: { x: Math.sin(i / 3), y: 0 } })
      t.advance(16)
    }

    assert.equal(t.dom().browY, -5,
      `browRaise was starved by gaze traffic: reached ${t.dom().browY} of -5`)
  } finally { t.restore() }
})

test('a re-sent unchanged frame does not restart anything mid-flight', () => {
  const t = mountRig()
  try {
    t.rig.apply({ browRaise: 0 })
    t.rig.finish()

    const quiet = mountRig()
    quiet.rig.apply({ browRaise: 0 })
    quiet.rig.finish()

    t.rig.apply({ browRaise: 1 })
    quiet.rig.apply({ browRaise: 1 })

    for (let i = 0; i < 20; i++) {
      t.rig.apply({ browRaise: 1 })     // the same goal, over and over
      t.advance(16)
      quiet.advance(16)
      assert.equal(t.dom().browY, quiet.dom().browY, `diverged at tick ${i}`)
    }
    quiet.restore()
  } finally { t.restore() }
})

test('discrete channels never blend once wired to the DOM', () => {
  const t = mountRig()
  try {
    t.rig.apply({ emotion: 'neutral', locomotion: 'idle', facing: 'right' })
    t.rig.finish()

    const keys = new Set()
    const locos = new Set()
    t.rig.apply({ emotion: 'sad', locomotion: 'walk', facing: 'left' })
    for (let i = 0; i < 20; i++) {
      keys.add(artKeyOf(t.rig.frame))
      const d = t.dom()
      locos.add(`${d.walking}|${d.flying}`)
      t.advance(16)
    }

    assert.deepEqual([...keys], ['roozi|sad|left'],
      'emotion and facing must jump straight to the new value, never through a third')
    // locomotion has a 60ms delay, so both endpoints are legal — nothing between.
    assert.deepEqual([...locos].sort(), ['false|false', 'true|false'],
      'locomotion produced a state that is neither idle nor walk')
  } finally { t.restore() }
})

test('locomotion honours its 60ms delay and then commits', () => {
  const t = mountRig()
  try {
    t.rig.apply({ locomotion: 'idle' })
    t.rig.finish()
    t.rig.apply({ locomotion: 'walk' })

    assert.equal(t.dom().walking, false, 'must not start walking on the same tick')
    t.advance(48)
    assert.equal(t.dom().walking, false, 'still inside the 60ms delay')
    t.advance(32)                                   // t=80
    assert.equal(t.dom().walking, true, 'and committed after it')
  } finally { t.restore() }
})

test('visemes still snap synchronously, because speech cannot wait for a tick', () => {
  const t = mountRig()
  try {
    t.rig.apply({ viseme: 'rest' })
    t.rig.finish()
    t.rig.apply({ viseme: 'aa' })
    assert.equal(t.rig.frame.viseme, 'aa', 'a viseme must land inside apply(), with no tick at all')
  } finally { t.restore() }
})

// ------------------------------------------------------------ wiring hazards ---

test('a gesture is not restarted by every tick of an ongoing transition', () => {
  // syncFrame() now runs ~60x/second during a transition, and it is what starts
  // gestures. Without a change-guard the animation would be re-armed each tick
  // and never visibly play.
  const t = mountRig()
  try {
    // Comparing el.style.animation cannot see this: a restart writes 'none' and
    // then the *same* string back, so the end state is identical either way.
    // The forced reflow between those two writes is the observable restart.
    // Intensity-only, so nothing re-renders and the node stays valid — an
    // emotion change would swap the SVG out from under the spy.
    t.rig.apply({ emotion: 'happy', intensity: 0 })
    t.rig.finish()

    const svg = t.svgNode()
    const el = svg.querySelector('.lyr-nearArm') ?? svg.querySelector('.rig-body')
    let reflows = 0
    el.getBoundingClientRect = () => { reflows++; return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 } }

    // Intensity glides for 20+260ms, so syncFrame runs ~18 times while the
    // gesture is live.
    t.rig.apply({ intensity: 1, gesture: 'wave' })
    assert.ok(el.style.animation, 'the gesture should have started')
    assert.equal(reflows, 1, 'exactly one restart at the start')

    t.advance(300)
    assert.ok(t.seen.length > 10, 'the rig really was settling across many ticks')
    assert.equal(reflows, 1, `the gesture was re-armed ${reflows - 1} extra times by the tick loop`)
  } finally { t.restore() }
})

test('with no loop running, apply() lands everything immediately', () => {
  // Reduced motion, SSR-ish hosts and unmounted rigs have no rAF to tick them.
  // Easing there must degrade to snapping, not to never arriving.
  const dom = setupDom()
  const rig = new ActorRig(CHARACTERS.roozi, { blink: false })
  rig.apply({ emotion: 'sad', browRaise: 1, gaze: { x: 1, y: 1 }, locomotion: 'walk' })
  assert.equal(rig.settling, false, 'nothing may be left in flight when nothing will tick')
  assert.deepEqual(rig.frame, rig.goal)
  rig.destroy()
  dom.restore()
})

test('prefers-reduced-motion snaps instead of easing', () => {
  const dom = setupDom()
  dom.window.matchMedia = (q) => ({
    media: q, matches: true, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
  const rig = new ActorRig(CHARACTERS.roozi, { blink: false })
  rig.mount(dom.host)
  rig.apply({ emotion: 'surprised', intensity: 1, browRaise: 1 })
  assert.equal(rig.settling, false, 'reduced motion must not leave channels travelling')
  assert.equal(readDom(dom.host).browY, -5, 'the goal pose must be reached at once')
  rig.destroy()
  dom.restore()
})

test('the rendered frame is what the DOM shows, and goal is what was asked for', () => {
  const t = mountRig()
  try {
    t.rig.apply({ browRaise: 0 })
    t.rig.finish()
    t.rig.apply({ browRaise: 1 })
    t.advance(160)
    assert.equal(t.rig.goal.browRaise, 1, 'goal is the request')
    assert.ok(t.rig.frame.browRaise > 0 && t.rig.frame.browRaise < 1, 'frame is mid-flight')
    assert.equal(t.dom().browY, -5 * t.rig.frame.browRaise, 'and the DOM matches frame, not goal')
  } finally { t.restore() }
})

test('defaultFrame round-trips through a mounted rig unchanged', () => {
  const t = mountRig()
  try {
    t.rig.finish()
    assert.deepEqual(t.rig.frame, defaultFrame('roozi'))
  } finally { t.restore() }
})

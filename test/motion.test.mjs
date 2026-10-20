/**
 * The motion engine: springs, settings resolution, the four drivers, and their
 * wiring through the rig.
 *
 * The engine is pure (no DOM), so most of this drives `MotionEngine` directly
 * with plain poses; the rig tests then check that what it returns reaches the
 * DOM and that every "hold still" state (reduced motion, pinned gait, finish)
 * really does hold still. The geometry guards at the end are the same
 * measured windows the posture sweeps in rig-cache use, re-run with the head
 * turn and the ear lag on top — the engine adds motion to every character, so
 * every character's measured limits have to survive it.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { setupDom } from './helpers/dom.mjs'
import {
  ActorRig, CHARACTERS, CHARACTER_SLUGS, EMOTIONS, defaultFrame, resolvePosture,
  Spring, MotionEngine, DEFAULT_MOTION, resolveMotion, parentOf,
} from '../dist/index.js'
import {
  MICRO_WORST, lakiClearance, tondpaSeamOverlap, khersiSeamOverlap,
  khersiEarPenetration, avaPigtailPenetration, charkhiAntennaClip,
} from '../tools/lib/probes.mjs'

// ── springs ──────────────────────────────────────────────────────────────────

test('a spring converges on its target', () => {
  const s = new Spring({ freq: 3, damping: 0.5 })
  for (let i = 0; i < 300; i++) s.step(10, 1 / 60)
  assert.ok(s.settled(10, 1e-3), `still at ${s.value} after 5s`)
})

test('underdamped overshoots, critically damped does not', () => {
  const peak = (damping) => {
    const s = new Spring({ freq: 3, damping })
    let max = 0
    for (let i = 0; i < 240; i++) max = Math.max(max, s.step(1, 1 / 60))
    return max
  }
  assert.ok(peak(0.3) > 1.2, 'a 0.3 damping ratio must overshoot visibly')
  assert.ok(peak(1) <= 1 + 1e-6, 'a damping ratio of 1 must never pass the target')
})

test('a long frame is substepped, so a stiff spring stays stable', () => {
  const s = new Spring({ freq: 12, damping: 0.4 })
  s.step(1, 0.1)
  assert.ok(Number.isFinite(s.value) && Math.abs(s.value) < 3, `exploded to ${s.value}`)
})

test('snap lands with no velocity; a bad dt or target is ignored', () => {
  const s = new Spring({ freq: 3, damping: 0.5 })
  s.kick(50)
  s.snap(4)
  assert.equal(s.value, 4)
  assert.equal(s.velocity, 0)
  assert.equal(s.step(9, 0), 4)
  assert.equal(s.step(NaN, 1 / 60), 4)
})

// ── settings ─────────────────────────────────────────────────────────────────

test('resolveMotion with nothing is the defaults, as a copy', () => {
  const m = resolveMotion()
  assert.deepEqual(m, DEFAULT_MOTION)
  m.attention.turn = 99
  assert.notEqual(DEFAULT_MOTION.attention.turn, 99, 'resolving must never hand out the defaults themselves')
})

test('an override changes one field and keeps its siblings', () => {
  const m = resolveMotion({ attention: { turn: 9 }, secondary: { layers: { earL: { limit: 4 } } } })
  assert.equal(m.attention.turn, 9)
  assert.equal(m.attention.pitch, DEFAULT_MOTION.attention.pitch)
  assert.equal(m.secondary.layers.earL.limit, 4)
  assert.deepEqual(m.secondary.layers.earL.spring, DEFAULT_MOTION.secondary.layers.earL.spring)
  assert.deepEqual(m.secondary.layers.tail, DEFAULT_MOTION.secondary.layers.tail)
})

test('false switches a driver, a layer or the gaze blink off; later levels win', () => {
  const m = resolveMotion(
    { depth: false, secondary: { layers: { tail: false } }, attention: { blink: false } },
    { body: false },
  )
  assert.equal(m.depth, false)
  assert.equal(m.body, false)
  assert.equal(m.secondary.layers.tail, false)
  assert.equal(m.attention.blink, false)
  assert.ok(m.secondary.layers.earL, 'switching one soft layer off leaves the others')
})

test('re-enabling a driver an earlier level turned off starts from its defaults', () => {
  const m = resolveMotion({ body: false }, { body: { pop: 0.2 } })
  assert.equal(m.body.pop, 0.2)
  assert.deepEqual(m.body.lean, DEFAULT_MOTION.body.lean)
})

test('the engine holds no character names — tuning lives on the spec', () => {
  // The rule this module exists under. A slug in the defaults would mean a
  // character's behaviour is hidden in the engine instead of on its spec.
  const text = JSON.stringify(DEFAULT_MOTION)
  for (const slug of CHARACTER_SLUGS) assert.ok(!text.includes(slug), `DEFAULT_MOTION mentions ${slug}`)
})

// ── the engine, driven directly ──────────────────────────────────────────────

const ALL = new Set(['head', 'torso', 'earL', 'earR', 'tail', 'farArm', 'nearArm', 'farLeg', 'nearLeg'])

function rig({ settings = resolveMotion(), has = ALL, poses = {} } = {}) {
  const engine = new MotionEngine(settings)
  const frame = defaultFrame('test')
  const input = (over = {}) => ({
    frame: { ...frame, ...over.frame },
    gaze: over.gaze ?? { x: 0, y: 0 },
    has: (l) => has.has(l),
    pose: (t) => (over.poses ?? poses)[t] ?? {},
  })
  const run = (secs, over, dt = 1 / 60) => {
    let out
    for (let t = 0; t < secs - 1e-9; t += dt) out = engine.tick(dt, input(over))
    return out
  }
  return { engine, input, run }
}

const isIdentity = (p) =>
  !p || (Math.abs(p.x ?? 0) < 1e-9 && Math.abs(p.y ?? 0) < 1e-9 && Math.abs(p.rot ?? 0) < 1e-9 &&
    Math.abs((p.sx ?? 1) - 1) < 1e-9 && Math.abs((p.sy ?? 1) - 1) < 1e-9)

test('at rest the engine adds nothing to any target', () => {
  const { run } = rig()
  const out = run(1, {})
  for (const [t, p] of Object.entries(out.poses)) assert.ok(isIdentity(p), `${t} moved at rest: ${JSON.stringify(p)}`)
  assert.equal(out.faceX, 0)
  assert.equal(out.shade, 0)
})

test('the tree is structural: ears ride the head, or the torso without one', () => {
  assert.equal(parentOf('earL', (l) => l === 'head'), 'head')
  assert.equal(parentOf('earL', () => false), 'torso')
  assert.equal(parentOf('head', () => true), 'torso')
  assert.equal(parentOf('torso', () => true), 'body')
  assert.equal(parentOf('body', () => true), 'root')
  assert.equal(parentOf('root', () => true), null)
})

test('secondary: an ear lags a head turn, then settles back onto its pose', () => {
  const { run } = rig({ settings: resolveMotion({ attention: false }) })
  run(1, {})
  const turned = { poses: { head: { rot: 10 } } }
  const early = run(2 / 60, turned)
  assert.ok(early.poses.earL.rot < -1, `the ear should resist the turn at first, got ${early.poses.earL.rot}`)
  const late = run(4, turned)
  assert.ok(Math.abs(late.poses.earL?.rot ?? 0) < 0.05, 'and hang straight again once the head holds')
})

test('secondary: the lag is capped by the layer limit', () => {
  const { run } = rig({ settings: resolveMotion({ attention: false, secondary: { layers: { earL: { limit: 3 } } } }) })
  run(1, {})
  const out = run(1 / 60, { poses: { head: { rot: 80 } } })
  assert.ok(Math.abs(out.poses.earL.rot) <= 3 + 1e-9)
})

test('secondary: a posture change eases in through the spring instead of jumping', () => {
  const { run } = rig({ settings: resolveMotion({ attention: false }) })
  run(1, {})
  const droop = run(1 / 60, { poses: { earR: { rot: 20 } } })
  assert.ok(droop.poses.earR.rot < -15, 'on the first tick nearly all of the new pose is still lag')
})

test('secondary: a character without the layer gets no spring for it', () => {
  const { engine } = rig()
  assert.deepEqual(engine.softLayers((l) => l === 'earL'), ['earL'])
})

test('attention: the head follows the gaze, behind it', () => {
  const { run } = rig({ settings: resolveMotion({ depth: false }) })
  const a = DEFAULT_MOTION.attention
  const early = run(3 / 60, { gaze: { x: 1, y: 0 } })
  assert.ok(early.poses.head.x > 0 && early.poses.head.x < a.turn * 0.7, `the head must lag the eyes, got ${early.poses.head.x}`)
  const late = run(3, { gaze: { x: 1, y: 0 } })
  assert.ok(Math.abs(late.poses.head.x - a.turn) < 0.01, 'and arrive')
  const up = run(3, { gaze: { x: 0, y: -1 } })
  assert.ok(up.poses.head.rot < 0, 'looking up tips the face up (counter-clockwise)')
})

test('attention: a headless character turns nothing but its torso share', () => {
  const { run } = rig({ has: new Set(['torso', 'earL', 'earR']) })
  const out = run(3, { gaze: { x: 1, y: 0 } })
  assert.equal(out.poses.head, undefined)
  assert.ok(out.poses.torso.x > 0)
})

test('attention: a big gaze jump blinks once, then waits out the cooldown', () => {
  const { engine, input } = rig()
  let blinks = 0
  for (let i = 0; i < 20; i++) if (engine.tick(1 / 60, input({ gaze: { x: i < 10 ? -1 : 1, y: 0 } })).blink) blinks++
  assert.equal(blinks, 1)
  const quiet = rig()
  let small = 0
  for (let i = 0; i < 20; i++) if (quiet.engine.tick(1 / 60, quiet.input({ gaze: { x: 0.2, y: 0 } })).blink) small++
  assert.equal(small, 0, 'a small glance must not blink')
})

test('body: walking leans forward by speed; stopping rocks back past upright', () => {
  const { run } = rig()
  const walk = run(4, { frame: { locomotion: 'walk', speed: 1.5 } })
  assert.ok(Math.abs(walk.poses.body.rot - DEFAULT_MOTION.body.lean.walk * 1.5) < 0.01)
  let min = Infinity
  for (let i = 0; i < 60; i++) min = Math.min(min, run(1 / 60, { frame: { locomotion: 'idle' } }).poses.body.rot)
  assert.ok(min < -0.5, `an underdamped stop should overshoot upright, min was ${min}`)
})

test('body: an energetic emotion stretches, a deflating one squashes', () => {
  const peak = (emotion) => {
    const { run } = rig()
    run(0.5, {})
    let hi = 1, lo = 1
    for (let i = 0; i < 30; i++) {
      const sy = run(1 / 60, { frame: { emotion, intensity: 1 } }).poses.body.sy
      hi = Math.max(hi, sy)
      lo = Math.min(lo, sy)
    }
    return { hi, lo }
  }
  assert.ok(peak('excited').hi > 1.02, 'excited should stretch up first')
  assert.ok(peak('sad').lo < 0.98, 'sad should squash down first')
  const neutral = peak('thinking')
  assert.ok(neutral.hi === 1 && neutral.lo === 1, 'an emotion with no energy does not pop')
})

test('body: the stretch keeps its area', () => {
  const { run } = rig()
  run(0.5, {})
  const p = run(3 / 60, { frame: { emotion: 'excited', intensity: 1 } }).poses.body
  assert.ok(Math.abs(p.sx * p.sy - 1) < 1e-9)
})

test('body: landing from flight squashes', () => {
  const { run } = rig()
  run(1, { frame: { locomotion: 'fly' } })
  let lo = 1
  for (let i = 0; i < 20; i++) lo = Math.min(lo, run(1 / 60, { frame: { locomotion: 'idle' } }).poses.body.sy)
  assert.ok(lo < 0.95, `no landing squash (min sy ${lo})`)
})

test('depth: a turn slides near layers one way and far layers the other', () => {
  const { run } = rig()
  const out = run(4, { frame: { yaw: 1 } })
  const d = DEFAULT_MOTION.depth
  assert.ok(Math.abs(out.poses.nearArm.x - d.layers.nearArm * d.travel) < 0.01)
  assert.ok(out.poses.farArm.x < 0)
  assert.ok(out.poses.tail.x < 0)
  assert.ok(out.faceX > 0, 'the face slides toward the turn')
  assert.ok(Math.abs(out.shade - 1) < 0.01)
})

test('depth: offsets are relative to the parent, so nesting does not double them', () => {
  // Ears sit at depth 0 inside a head at 0.2: relative to the head they must
  // slide *back* by 0.2, so that in world space they stay on the body plane.
  const { run } = rig({ settings: resolveMotion({ attention: false }) })
  const out = run(4, { frame: { yaw: 1 } })
  const d = DEFAULT_MOTION.depth
  assert.ok(Math.abs(out.poses.earL.x - (0 - d.layers.head) * d.travel) < 0.01)
})

test('depth: the head yaws a little toward a sideways look on its own', () => {
  const { run } = rig({ settings: resolveMotion({ attention: false }) })
  const out = run(4, { gaze: { x: 1, y: 0 } })
  assert.ok(out.poses.head.x > 0)
  assert.ok(!out.poses.nearArm, 'but the body does not turn for a glance')
})

test('snap lands every driver at rest with no wobble left', () => {
  const { engine, input } = rig()
  engine.tick(1 / 60, input({ gaze: { x: 1, y: 0 }, frame: { locomotion: 'walk', yaw: 1 } }))
  const a = engine.tick(0, input({ gaze: { x: 1, y: 0 }, frame: { locomotion: 'walk', yaw: 1 } }), true)
  const b = engine.tick(1 / 60, input({ gaze: { x: 1, y: 0 }, frame: { locomotion: 'walk', yaw: 1 } }))
  // yaw 1 plus the gaze follow clamps the head's yaw at 1.
  assert.equal(a.poses.head.x, DEFAULT_MOTION.attention.turn + DEFAULT_MOTION.depth.layers.head * DEFAULT_MOTION.depth.travel)
  assert.ok(Math.abs(b.poses.head.x - a.poses.head.x) < 1e-6, 'after a snap the next tick must not move')
  assert.equal(a.blink, false, 'a snap never blinks')
})

// ── through the rig ──────────────────────────────────────────────────────────

function mounted(slug, opts = {}) {
  const dom = setupDom()
  const r = new ActorRig(CHARACTERS[slug], { blink: false, micro: { amount: 0 }, ...opts })
  r.mount(dom.host)
  const svg = () => dom.host.querySelector('svg')
  const tx = (sel) => svg().querySelector(sel)?.style.transform ?? ''
  // Destroy before the DOM goes, so no blink timer outlives the test.
  return { ...dom, rig: r, svg, tx, restore: () => { r.destroy(); dom.restore() } }
}

const translateX = (t) => Number(/translate\((-?[\d.]+)px/.exec(t)?.[1] ?? 0)

test('rig: the springs own the soft layers, which lose their CSS transition', () => {
  const t = mounted('roozi')
  try {
    for (const l of ['earL', 'earR', 'tail']) assert.ok(t.svg().querySelector(`.lyr-${l}`).classList.contains('ca-spring'), l)
    assert.ok(!t.svg().querySelector('.lyr-head').classList.contains('ca-spring'))
    t.rig.setMotion({ secondary: false })
    assert.ok(!t.svg().querySelector('.lyr-earL').classList.contains('ca-spring'), 'switched off, the CSS ease is back')
  } finally { t.restore() }
})

test('rig: the head turns toward the gaze in the DOM', () => {
  const t = mounted('roozi')
  try {
    t.rig.apply({ gaze: { x: 1, y: 0 } })
    t.advance(2000)
    assert.ok(translateX(t.tx('.lyr-head')) > 2, `head transform: ${t.tx('.lyr-head')}`)
  } finally { t.restore() }
})

test('rig: a yaw slides the layers, the face and the shading — and 0 restores them exactly', () => {
  const t = mounted('roozi')
  try {
    t.rig.apply({})
    t.advance(100)
    const grad = t.svg().querySelector('defs radialGradient')
    const cx0 = grad.getAttribute('cx')
    const eye0 = t.svg().querySelector('.eyeG').getAttribute('transform')
    t.rig.apply({ yaw: 1 })
    t.advance(3000)
    assert.ok(translateX(t.tx('.lyr-nearArm')) > 1)
    assert.ok(translateX(t.tx('.lyr-farArm')) < -1)
    assert.match(t.svg().querySelector('.eyeG').getAttribute('transform'), /^translate\(\d/)
    assert.match(t.tx('.mouthG'), /^translate\(\d/)
    assert.notEqual(grad.getAttribute('cx'), cx0)
    t.rig.apply({ yaw: 0 })
    t.advance(4000)
    assert.equal(grad.getAttribute('cx'), cx0, 'the authored gradient centre comes back verbatim')
    assert.equal(t.svg().querySelector('.eyeG').getAttribute('transform'), eye0)
  } finally { t.restore() }
})

test('rig: ids are per rig, and every reference resolves', () => {
  const dom = setupDom()
  try {
    const a = document.createElement('div')
    const b = document.createElement('div')
    dom.host.append(a, b)
    new ActorRig(CHARACTERS.roozi, { blink: false }).mount(a)
    new ActorRig(CHARACTERS.roozi, { blink: false }).mount(b)
    // Every id, not only the gradients: the eye clips and the mouth group were
    // duplicated too up to 1.6.0 (PW-16).
    const ids = [...dom.host.querySelectorAll('[id]')].map((e) => e.id)
    assert.ok(ids.some((id) => id.startsWith('cl')), 'the eye clips are in the count')
    assert.equal(new Set(ids).size, ids.length, `two rigs of one character must not share an id: ${ids}`)
    for (const m of dom.host.innerHTML.matchAll(/url\(#([^)]+)\)/g)) {
      assert.ok(dom.host.querySelector(`[id="${m[1]}"]`), `url(#${m[1]}) points at nothing`)
    }
    assert.equal(dom.host.querySelectorAll('.mouthG').length, 2, 'each rig finds its mouth by class')
  } finally { dom.restore() }
})

test('rig: reduced motion lands the engine at rest at once', () => {
  const t = mounted('roozi', { reducedMotion: true })
  try {
    t.rig.apply({ yaw: 1, gaze: { x: 1, y: 0 } })
    const d = DEFAULT_MOTION.depth
    assert.ok(Math.abs(translateX(t.tx('.lyr-nearArm')) - d.layers.nearArm * d.travel) < 0.01,
      `no loop, so the turn must already be there: ${t.tx('.lyr-nearArm')}`)
  } finally { t.restore() }
})

test('rig: a pinned gait holds every layer still, springs included', () => {
  const t = mounted('roozi')
  try {
    t.rig.apply({ locomotion: 'walk' })
    t.advance(300)
    t.rig.pinGaitPhase(0.3)
    const read = () => [...t.svg().querySelectorAll('[class^="lyr-"], .rig-body')].map((e) => e.style.transform)
    const a = read()
    t.advance(500)
    assert.deepEqual(read(), a)
    // Pinning snaps once, so the mutant that matters is a change *while*
    // pinned: a frozen frame shows where things land, never a spring pop.
    t.rig.apply({ emotion: 'excited', intensity: 1 })
    t.advance(100)
    assert.ok(!/scale/.test(t.tx('.rig-body')), `pinned body popped: ${t.tx('.rig-body')}`)
  } finally { t.restore() }
})

test('rig: finish() stops a wobble mid-swing', () => {
  const t = mounted('roozi')
  try {
    t.rig.apply({ locomotion: 'walk' })
    t.advance(1500)
    t.rig.apply({ locomotion: 'idle' })
    t.advance(100)
    t.rig.finish()
    assert.equal(t.tx('.rig-body'), 'none')
  } finally { t.restore() }
})

test('rig: with every driver off the engine writes nothing', () => {
  const off = { secondary: false, attention: false, body: false, depth: false }
  const t = mounted('roozi', { motion: off })
  try {
    t.rig.apply({ gaze: { x: 1, y: 0.5 }, yaw: 1, emotion: 'excited' })
    t.advance(1000)
    // Posture still drops the head on y; nothing may move sideways or lag.
    for (const l of ['head', 'earL', 'nearArm']) assert.equal(translateX(t.tx(`.lyr-${l}`)), 0, `${l}: ${t.tx(`.lyr-${l}`)}`)
    assert.ok(!t.svg().querySelector('.ca-spring'))
    assert.ok(!/scale/.test(t.tx('.rig-body')), `body: ${t.tx('.rig-body')}`)
  } finally { t.restore() }
})

test('rig: a character\'s own motion block reaches its engine, and options override it', () => {
  const t = mounted('charkhi', { motion: { body: { pop: 0.3 } } })
  try {
    assert.equal(t.rig.motion.secondary.layers.earL.limit, CHARACTERS.charkhi.motion.secondary.layers.earL.limit)
    assert.equal(t.rig.motion.body.pop, 0.3)
    t.rig.setCharacter(CHARACTERS.roozi)
    assert.equal(t.rig.motion.secondary.layers.earL.limit, DEFAULT_MOTION.secondary.layers.earL.limit,
      'switching character must drop the old character\'s tuning')
    assert.equal(t.rig.motion.body.pop, 0.3, 'but keep the rig\'s own')
  } finally { t.restore() }
})

test('rig: a big look blinks, and blink:false stops it', () => {
  for (const blink of [true, false]) {
    const t = mounted('roozi', { blink })
    try {
      t.rig.apply({ gaze: { x: -1, y: 0 } })
      t.advance(1500)
      let shut = false
      t.rig.apply({ gaze: { x: 1, y: 0 } })
      for (let i = 0; i < 20; i++) {
        t.advance(16)
        if (t.svg().querySelector('.blinkLid.shut')) shut = true
      }
      assert.equal(shut, blink)
    } finally { t.restore() }
  }
})

// ── measured windows, with the engine's motion on top ────────────────────────
//
// The posture guards in rig-cache sweep every emotion × intensity. The engine
// adds a head turn (attention + depth) and an ear lag (secondary) on top of
// whatever posture is held, so these re-run the same probes over the whole
// extra range: gaze and yaw at their extremes, the lag at ± its limit. The
// floors are the ones those guards already use.

const EMS = Object.keys(EMOTIONS)
const KS = [0, 0.25, 0.5, 0.75, 1]
const G = [-1, -0.5, 0, 0.5, 1]

function sweepHead(slug, measure) {
  const m = resolveMotion(CHARACTERS[slug].motion)
  const a = m.attention || { turn: 0, pitch: 0, rise: 0, tilt: 0 }
  const d = m.depth || { follow: 0, layers: {}, travel: 0 }
  const sec = m.secondary ? m.secondary.layers : {}
  let worst = { v: Infinity }
  for (const emotion of EMS) for (const k of KS) for (const gx of G) for (const gy of G) for (const yaw of [-1, 0, 1]) {
    const p = resolvePosture(emotion, k, CHARACTERS[slug].posture)
    const yh = Math.max(-1, Math.min(1, yaw + d.follow * gx))
    const head = {
      x: a.turn * gx + yh * (d.layers.head ?? 0) * d.travel,
      y: (p.headDrop ?? 0) + a.rise * gy,
      rot: (p.headTilt ?? 0) + a.pitch * gy + a.tilt * gx,
    }
    for (const side of ['earL', 'earR']) {
      const lim = sec[side] ? sec[side].limit : 0
      for (const lag of [-lim, 0, lim]) {
        const v = measure(head, side, (p.ears ?? 0) + lag)
        if (v < worst.v) worst = { v, emotion, k, gx, gy, yaw, side, lag }
      }
    }
  }
  return worst
}
const show = (w) => `${w.v.toFixed(2)} at ${w.emotion}/${w.k} gaze(${w.gx},${w.gy}) yaw ${w.yaw} ${w.side} lag ${w.lag}`

test('laki: a head turn never drops the mouth under the shell or lifts the head off it', () => {
  const mouth = sweepHead('laki', (h) => lakiClearance(h).mouth)
  const head = sweepHead('laki', (h) => lakiClearance(h).head)
  assert.ok(mouth.v > 1, `mouth clearance ${show(mouth)}`)
  assert.ok(head.v > 1, `head clearance ${show(head)}`)
})

test('tondpa and khersi: a head turn never opens the neck seam', () => {
  const tp = sweepHead('tondpa', (h) => tondpaSeamOverlap(h.rot + MICRO_WORST.rot, h.y + MICRO_WORST.y, undefined, h.x))
  const kh = sweepHead('khersi', (h) => khersiSeamOverlap(h.rot + MICRO_WORST.rot, h.y + MICRO_WORST.y, undefined, h.x))
  assert.ok(tp.v > 120, `tondpa seam overlap ${show(tp)}`)
  assert.ok(kh.v > 220, `khersi seam overlap ${show(kh)}`)
})

test('khersi ears and ava pigtails stay on the head through the turn and the swing', () => {
  const at = (h) => [h.rot + MICRO_WORST.rot, h.y + MICRO_WORST.y, h.x]
  const kh = sweepHead('khersi', (h, side, ear) => khersiEarPenetration(side, ear, ...at(h)))
  const av = sweepHead('ava', (h, side, ear) => avaPigtailPenetration(side, ear, ...at(h)))
  assert.ok(kh.v > 8, `khersi ear penetration ${show(kh)}`)
  assert.ok(av.v > 8, `ava pigtail penetration ${show(av)}`)
})

test('charkhi: the antenna swing never dips the stalk into the roof', () => {
  const w = sweepHead('charkhi', (_h, side, ear) => charkhiAntennaClip(side, ear))
  assert.ok(w.v > 1, `antenna margin ${show(w)}`)
})

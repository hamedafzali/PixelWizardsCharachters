import test from 'node:test'
import assert from 'node:assert/strict'
import { ActorRig, CHARACTERS, defaultFrame, resolveEmotion, eyeWidenScale, eyeLidRy } from '../dist/index.js'
import { setupDom, readDom } from './helpers/dom.mjs'

/**
 * The same end-to-end guarantees as `rig-integration`, run against every
 * *layered* character rather than only the one they were written on.
 *
 * `roozi` is the character the rig was built around, so a test suite that only
 * mounts roozi cannot tell a general guarantee from a roozi-shaped coincidence.
 * `boomi` is deliberately structurally different — an owl: wings instead of
 * arms, no tail layer at all, a head that is the whole facial mass rather than
 * a skull on a neck, and eyes half again as large (r=15 vs 11) at a different
 * height. Anything below that assumed roozi's proportions or layer set fails
 * here.
 */

const LAYERED = Object.values(CHARACTERS).filter((c) => {
  const out = c.render({ emotion: { squint: 0, wide: 0, brow: 0 }, intensity: 0, frame: defaultFrame(c.slug) })
  return !!out.layers
})

test('the suite actually covers more than one character', () => {
  // Guards the loops below from silently degenerating as characters convert.
  assert.ok(LAYERED.length >= 2, `expected 2+ layered characters, found ${LAYERED.map((c) => c.slug)}`)
  assert.ok(LAYERED.some((c) => c.slug === 'boomi'), 'boomi should be layered')
})

function mountRig(spec, over = {}) {
  const dom = setupDom()
  const seen = []
  const settled = []
  const rig = new ActorRig(spec, {
    blink: false,
    micro: { amount: 0 },
    onFrame: (f) => seen.push({ ...f, gaze: { ...f.gaze } }),
    onSettled: (f) => settled.push({ ...f, gaze: { ...f.gaze } }),
    ...over,
  })
  rig.mount(dom.host)
  return { ...dom, rig, seen, settled, dom: () => readDom(dom.host), svgNode: () => dom.host.querySelector('svg') }
}

for (const spec of LAYERED) {
  const slug = spec.slug
  const R = spec.eyes.r

  test(`${slug}: the eye hooks the rig writes to exist, in pairs, with pivots`, () => {
    const t = mountRig(spec)
    try {
      const svg = t.svgNode()
      const gs = [...svg.querySelectorAll('.eyeG')]
      const lids = [...svg.querySelectorAll('.lidLo')]
      assert.equal(gs.length, 2, 'two eyes')
      assert.equal(lids.length, 2)
      // The rig reads the pivot off the element rather than off the spec, so a
      // character that draws its eyes anywhere still widens about its own centres.
      assert.deepEqual(gs.map((g) => Number(g.getAttribute('data-cx'))), spec.eyes.x)
      for (const g of gs) assert.equal(Number(g.getAttribute('data-cy')), spec.eyes.y)
      for (const l of lids) assert.equal(Number(l.getAttribute('data-lr')), R)
    } finally { t.restore() }
  })

  test(`${slug}: an intensity glide moves the eyes and re-renders nothing`, () => {
    const t = mountRig(spec)
    try {
      t.rig.apply({ emotion: 'surprised', intensity: 0 })
      t.rig.finish()

      const node = t.svgNode()
      const flat = t.dom()
      assert.equal(flat.eyeScale, 1, 'at intensity 0 the eye is unscaled')

      t.rig.apply({ intensity: 1 })
      t.advance(500)

      const wide = t.dom()
      assert.equal(t.svgNode(), node, 'an intensity sweep must not redraw the art')
      assert.ok(wide.eyeScale > 1, `${slug} surprised should widen, got ${wide.eyeScale}`)
      assert.ok(wide.lidRy < flat.lidRy, 'and retract the lower lid out of the way')
    } finally { t.restore() }
  })

  test(`${slug}: the widen transform holds that character's eye centre fixed`, () => {
    const t = mountRig(spec)
    try {
      t.rig.apply({ emotion: 'surprised', intensity: 1 })
      t.rig.finish()
      const g = t.svgNode().querySelector('.eyeG')
      const m = /translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\) translate\((-?[\d.]+) (-?[\d.]+)\)/
        .exec(g.getAttribute('transform'))
      assert.ok(m, `expected a pivoted scale, got ${g.getAttribute('transform')}`)
      const [tx, ty, s, bx, by] = m.slice(1).map(Number)
      const apply = (x, y) => [tx + s * (bx + x), ty + s * (by + y)]
      const cx = Number(g.getAttribute('data-cx'))
      const cy = Number(g.getAttribute('data-cy'))
      const [fx, fy] = apply(cx, cy)
      assert.ok(Math.abs(fx - cx) < 1e-6 && Math.abs(fy - cy) < 1e-6,
        `the eye centre must be the fixed point, moved to ${fx},${fy}`)
      const [rx] = apply(cx + R, cy)
      assert.ok(Math.abs((rx - cx) - s * R) < 1e-6, 'the rim should scale by exactly s')
    } finally { t.restore() }
  })

  test(`${slug}: the DOM matches the shared helpers at full intensity`, () => {
    const t = mountRig(spec)
    try {
      t.rig.apply({ emotion: 'surprised', intensity: 1 })
      t.rig.finish()
      const d = t.dom()
      const em = resolveEmotion('surprised')
      assert.ok(Math.abs(d.eyeScale - eyeWidenScale(em.wide)) < 1e-4)
      assert.ok(Math.abs(d.lidRy - eyeLidRy(R, em.squint, em.wide)) < 1e-3)
    } finally { t.restore() }
  })

  test(`${slug}: an emotion change redraws exactly once, then never again`, () => {
    const t = mountRig(spec)
    try {
      t.rig.apply({ emotion: 'neutral', intensity: 0.5 })
      t.rig.finish()
      const before = t.svgNode()

      t.rig.apply({ emotion: 'happy', intensity: 1 })
      assert.notEqual(t.svgNode(), before, 'an emotion change should redraw')
      const after = t.svgNode()

      for (let i = 0; i < 30; i++) {
        t.advance(16)
        assert.equal(t.svgNode(), after, `re-rendered on tick ${i} of an intensity glide`)
      }
    } finally { t.restore() }
  })

  test(`${slug}: settling goes false on arrival and onSettled fires exactly once`, () => {
    const t = mountRig(spec)
    try {
      t.rig.apply({ emotion: 'excited', intensity: 1, browRaise: 1, gaze: { x: 1, y: -1 } })
      assert.ok(t.rig.settling)
      assert.equal(t.settled.length, 0, 'onSettled must not fire while travelling')

      t.advance(1000)
      assert.equal(t.rig.settling, false)
      assert.equal(t.settled.length, 1, 'onSettled fires once on arrival')
      assert.equal(t.settled[0].browRaise, 1)

      const frames = t.seen.length
      t.advance(500)
      assert.equal(t.seen.length, frames, 'a settled rig should do no frame work')
      assert.equal(t.settled.length, 1, 'and must not fire onSettled again')
    } finally { t.restore() }
  })

  test(`${slug}: an apply that changes nothing does not fire onSettled`, () => {
    const t = mountRig(spec)
    try {
      t.rig.apply({ emotion: 'happy', intensity: 1 })
      t.advance(1000)
      assert.equal(t.settled.length, 1)

      // Every path that reaches syncFrame with nothing in flight: a re-sent
      // identical frame, a redundant finish(), and quiet ticks. None of them is
      // an arrival, so none of them may fire an arrival callback.
      t.rig.apply({ ...t.rig.goal })
      t.rig.apply({ intensity: 1 })
      t.rig.finish()
      t.advance(200)
      assert.equal(t.settled.length, 1, 'onSettled fired without a transition to settle')

      // ...but a real transition after that still fires, once.
      t.rig.apply({ intensity: 0.2 })
      t.advance(1000)
      assert.equal(t.settled.length, 2)
    } finally { t.restore() }
  })

  test(`${slug}: gaze and browRaise honour their delays end to end`, () => {
    const t = mountRig(spec)
    try {
      t.rig.apply({ gaze: { x: 0, y: 0 }, browRaise: 0 })
      t.rig.finish()

      t.rig.apply({ gaze: { x: 1, y: 0 }, browRaise: 1 })
      assert.equal(t.dom().irisDx, 0, 'gaze has an 18ms reaction delay')
      assert.equal(t.dom().browY, 0, 'browRaise has a 90ms delay')

      t.advance(80)
      assert.ok(t.dom().irisDx > 0, 'the saccade should be well under way by 80ms')
      assert.equal(t.dom().browY, 0, 'but the brow is still waiting')

      t.advance(500)
      assert.ok(t.dom().browY < 0, 'the brow lifts (negative translateY)')
    } finally { t.restore() }
  })

  test(`${slug}: gaze traffic every tick does not starve browRaise`, () => {
    const t = mountRig(spec)
    try {
      t.rig.apply({ browRaise: 0 })
      t.rig.finish()

      // A real AI performance: the whole frame is re-sent every tick with only
      // gaze moving. If the no-op check were whole-frame, browRaise's 90ms delay
      // would re-arm forever and the brow would never lift.
      t.rig.apply({ browRaise: 1 })
      for (let i = 0; i < 40; i++) {
        const g = { ...t.rig.goal, gaze: { x: Math.sin(i / 5), y: 0 } }
        t.rig.apply(g)
        t.advance(16)
      }
      assert.ok(t.dom().browY < -1, `browRaise never arrived under gaze traffic (${t.dom().browY})`)
      assert.equal(t.rig.frame.browRaise, 1)
    } finally { t.restore() }
  })

  test(`${slug}: discrete channels never blend`, () => {
    const t = mountRig(spec)
    try {
      t.rig.apply({ emotion: 'happy', facing: 'right', viseme: 'rest' })
      t.rig.finish()
      t.rig.apply({ emotion: 'sad', facing: 'left', viseme: 'aa' })
      // No tick has run, and none is needed: all three are zero-duration.
      assert.equal(t.rig.frame.emotion, 'sad')
      assert.equal(t.rig.frame.facing, 'left')
      assert.equal(t.rig.frame.viseme, 'aa')
    } finally { t.restore() }
  })

  test(`${slug}: defaultFrame round-trips through a mounted rig`, () => {
    const t = mountRig(spec)
    try {
      const f = defaultFrame(slug)
      t.rig.apply(f)
      t.rig.finish()
      assert.deepEqual(t.rig.frame, f)
      assert.deepEqual(t.rig.goal, f)
    } finally { t.restore() }
  })
}

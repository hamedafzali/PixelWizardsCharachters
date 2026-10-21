import test from 'node:test'
import assert from 'node:assert/strict'
import { ActorRig, CHARACTERS, PetDriver, petZones, zoneAt } from '../dist/index.js'
import { setupDom } from './helpers/dom.mjs'

/**
 * `spec.render()` builds the whole art string. Up to 1.7.0 the rig called it on
 * every tick just to read the mouth anchor, and the pet driver on every stroke
 * just to read two layer origins (PW-06). Both are fixed per drawing, so they
 * are read when the art is drawn and not again.
 */

const quiet = { blink: false, micro: { amount: 0 } }

/** roozi, with every `render()` call counted. */
function counted() {
  const base = CHARACTERS.roozi
  const spec = { ...base, render: (ctx) => { spec.calls++; return base.render(ctx) } }
  spec.calls = 0
  return spec
}

function withRig(spec, fn) {
  const t = setupDom()
  try {
    const rig = new ActorRig(spec, quiet).mount(t.host)
    rig.finish()
    return fn({ rig, t })
  } finally { t.restore() }
}

test('speech does not re-render the art', () => {
  const spec = counted()
  withRig(spec, ({ rig }) => {
    spec.calls = 0
    const visemes = ['aa', 'ee', 'oo', 'mm', 'rest']
    for (let i = 0; i < 50; i++) {
      rig.apply({ viseme: visemes[i % visemes.length], mouthOpen: (i % 10) / 10 })
      rig.finish()
    }
    assert.equal(spec.calls, 0, `${spec.calls} render() calls for 50 mouth-only frames`)
  })
})

test('two seconds of animation loop, walking and settling, do not re-render the art', () => {
  const spec = counted()
  withRig(spec, ({ rig, t }) => {
    rig.apply({ locomotion: 'walk', intensity: 0.2, gaze: { x: 1, y: 0 } })
    spec.calls = 0
    t.advance(2000)
    assert.equal(spec.calls, 0, `${spec.calls} render() calls over 2 s of ticks`)
  })
})

test('the live channels do not re-render the art either', () => {
  const spec = counted()
  withRig(spec, ({ rig }) => {
    spec.calls = 0
    for (let i = 0; i < 20; i++) {
      rig.apply({ gaze: { x: i / 20, y: 0 }, browRaise: i / 20, intensity: i / 20 })
      rig.finish()
    }
    assert.equal(spec.calls, 0)
  })
})

test('an art change reads the mouth again, once', () => {
  const spec = counted()
  withRig(spec, ({ rig }) => {
    spec.calls = 0
    rig.apply({ emotion: 'sad' })
    rig.finish()
    // One for the drawing, one for the mouth anchor that goes with it.
    assert.ok(spec.calls >= 1 && spec.calls <= 2, `${spec.calls} render() calls for one emotion change`)
    const after = spec.calls
    rig.apply({ viseme: 'aa', mouthOpen: 1 })
    rig.finish()
    assert.equal(spec.calls, after)
  })
})

test('the mouth still follows the viseme', () => {
  withRig(CHARACTERS.roozi, ({ rig, t }) => {
    const mouth = () => t.host.querySelector('.mouthG').innerHTML
    rig.apply({ viseme: 'rest', mouthOpen: 0 })
    rig.finish()
    const shut = mouth()
    rig.apply({ viseme: 'aa', mouthOpen: 1 })
    rig.finish()
    assert.notEqual(mouth(), shut)
    rig.apply({ viseme: 'rest', mouthOpen: 0 })
    rig.finish()
    assert.equal(mouth(), shut)
  })
})

test('a tick that moves nothing in the mouth leaves its DOM alone', () => {
  withRig(CHARACTERS.roozi, ({ rig, t }) => {
    rig.apply({ viseme: 'aa', mouthOpen: 1 })
    rig.finish()
    const node = t.host.querySelector('.mouthG').firstChild
    assert.ok(node)
    rig.apply({ gaze: { x: 1, y: 0 } })
    rig.finish()
    assert.equal(t.host.querySelector('.mouthG').firstChild, node, 'the mouth was rewritten')
  })
})

test('setEmotions and setCharacter still redraw the mouth', () => {
  withRig(CHARACTERS.roozi, ({ rig, t }) => {
    rig.apply({ viseme: 'aa', mouthOpen: 1 })
    rig.finish()
    rig.setCharacter(CHARACTERS.simorgh)
    const fresh = new ActorRig(CHARACTERS.simorgh, quiet)
    const host = t.document.createElement('div')
    t.document.body.append(host)
    fresh.mount(host)
    fresh.apply({ viseme: 'aa', mouthOpen: 1 })
    fresh.finish()
    assert.equal(t.host.querySelector('.mouthG').innerHTML, host.querySelector('.mouthG').innerHTML,
      'a switched rig draws the new character\'s mouth')
    fresh.destroy()

    rig.setEmotions({ happy: { mouth: 'open' } })
    assert.ok(t.host.querySelector('.mouthG').innerHTML.length > 0)
  })
})

test('stroking reads the zones once per spec', () => {
  const spec = counted()
  const head = petZones(spec).find((z) => z.name === 'head')
  spec.calls = 0
  const pet = new PetDriver(spec)
  for (let i = 0; i < 100; i++) pet.stroke(head.cx + (i % 2 ? 8 : -8), head.cy)
  for (let i = 0; i < 100; i++) zoneAt(spec, head.cx, head.cy)
  petZones(spec)
  assert.equal(spec.calls, 0, `${spec.calls} render() calls after the zones were first read`)
})

test('petZones hands out copies of the cached zones', () => {
  const spec = CHARACTERS.roozi
  const zones = petZones(spec)
  const head = zones.find((z) => z.name === 'head')
  const { cx, cy } = head
  head.cx = -1000
  zones.length = 0
  assert.equal(zoneAt(spec, cx, cy), 'head')
  assert.equal(petZones(spec).find((z) => z.name === 'head').cx, cx)
})

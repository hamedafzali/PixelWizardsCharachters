import test from 'node:test'
import assert from 'node:assert/strict'
import { CHARACTERS } from '../dist/index.js'
import { ThreeActor } from '../dist/three/index.js'
import { setupDom } from './helpers/dom.mjs'

/**
 * `ThreeActor` without WebGL (PW-14). jsdom has no WebGL either, which makes
 * it the no-GPU device: the context cannot be created, and the actor must land
 * on the SVG rig in the same host rather than throw from a half-built mount.
 */

/** A jsdom page whose canvases refuse every context, quietly. */
function noWebGL() {
  const t = setupDom()
  t.window.HTMLCanvasElement.prototype.getContext = () => null
  return t
}

test('with no WebGL, mount falls back to the SVG rig in the same host', () => {
  const t = noWebGL()
  try {
    const errors = []
    const actor = new ThreeActor(CHARACTERS.roozi, { size: 120, onFallback: (e) => errors.push(e) })
    actor.apply({ emotion: 'happy' }) // before mount: must survive the fallback
    actor.mount(t.host)

    assert.equal(actor.backend, 'svg')
    assert.equal(errors.length, 1, 'onFallback called once')
    assert.ok(errors[0] instanceof Error, `with the context error, got ${errors[0]}`)
    assert.ok(t.host.querySelector('svg.ca-svg'), 'the SVG rig is mounted')
    assert.equal(t.host.querySelector('canvas'), null, 'no dead canvas left behind')
    assert.equal(actor.actor, null, 'no 3D model')
    assert.equal(actor.goal.emotion, 'happy', 'the frame applied before mount reached the rig')

    actor.apply({ emotion: 'sad' })
    assert.equal(actor.goal.emotion, 'sad', 'and later frames do too')
    assert.equal(actor.motion !== null, true)

    actor.destroy()
    assert.equal(actor.backend, null)
    assert.equal(t.host.querySelector('svg'), null, 'destroy removes the rig')
  } finally { t.restore() }
})

test('the fallback rig gets the options both renderers share', () => {
  const t = noWebGL()
  try {
    const actor = new ThreeActor(CHARACTERS.ava, { size: 90, blink: false }).mount(t.host)
    assert.equal(t.host.querySelector('svg').getAttribute('width'), '90')
    actor.destroy()
  } finally { t.restore() }
})

test('fallback: false throws the context error and leaves the host empty', () => {
  const t = noWebGL()
  try {
    const actor = new ThreeActor(CHARACTERS.roozi, { fallback: false })
    assert.throws(() => actor.mount(t.host))
    assert.equal(t.host.childNodes.length, 0)
    assert.equal(actor.backend, null)
    assert.equal(actor.actor, null, 'nothing half-built')
    actor.destroy()
  } finally { t.restore() }
})

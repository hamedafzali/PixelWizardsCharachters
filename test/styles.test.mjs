import test from 'node:test'
import assert from 'node:assert/strict'
import { ActorRig, CHARACTERS, RIG_CSS, ensureAction } from '../dist/index.js'
import { setupDom } from './helpers/dom.mjs'

/**
 * The rig's rules (blink, wings, gait fallbacks) and each gesture's keyframes
 * are injected as `<style>` elements. They must land in every root a rig is
 * mounted in — a second document, a shadow root — and only once per root.
 * Up to 1.6.0 they went to the first document only (PW-03), and a rig
 * anywhere else silently stopped blinking and gesturing.
 */

const rigStyles = (root) => root.querySelectorAll('style[data-pixel-wizards-charachters]')
const actionStyle = (root, name) => root.querySelector(`style[data-pixel-wizards-action="${name}"]`)
const mount = (host) => new ActorRig(CHARACTERS.roozi, { blink: false, micro: { amount: 0 } }).mount(host)

test('each document gets its own rig stylesheet, once', () => {
  const a = setupDom()
  const b = setupDom()
  try {
    mount(a.host)
    mount(b.host)
    mount(b.host.appendChild(b.document.createElement('div')))
    assert.equal(rigStyles(a.document).length, 1, 'first document')
    assert.equal(rigStyles(b.document).length, 1, 'second document, two rigs: one stylesheet')
    assert.equal(rigStyles(b.document)[0].textContent, RIG_CSS)
  } finally { b.restore(); a.restore() }
})

test('a gesture played in a second document gets its keyframes there', () => {
  const a = setupDom()
  const b = setupDom()
  try {
    mount(a.host).playGesture('jump')
    mount(b.host).playGesture('jump')
    const name = [...a.document.querySelectorAll('style[data-pixel-wizards-action]')][0]?.getAttribute('data-pixel-wizards-action')
    assert.ok(name?.startsWith('caG_jump_'), `keyframes in the first document, got ${name}`)
    assert.ok(actionStyle(b.document, name), 'and in the second')
  } finally { b.restore(); a.restore() }
})

test('a rig in a shadow root gets its rules inside the shadow root', () => {
  const t = setupDom()
  try {
    const shadow = t.host.attachShadow({ mode: 'open' })
    const inner = shadow.appendChild(t.document.createElement('div'))
    mount(inner).playGesture('jump')
    assert.equal(rigStyles(shadow).length, 1, 'rig stylesheet in the shadow root')
    assert.ok(shadow.querySelector('style[data-pixel-wizards-action^="caG_jump_"]'), 'gesture keyframes in the shadow root')
    assert.equal(rigStyles(t.document).length, 0, 'none leaked into the document head')
  } finally { t.restore() }
})

test('a removed stylesheet is injected again on the next render', () => {
  const t = setupDom()
  try {
    const rig = mount(t.host)
    rigStyles(t.document)[0].remove()
    rig.apply({ emotion: 'sad' }) // a new art key: a full render
    rig.finish()
    assert.equal(rigStyles(t.document).length, 1)
  } finally { t.restore() }
})

test('ensureAction memoises per root and re-injects a removed rule', () => {
  const t = setupDom()
  try {
    const action = { dur: 0.5, poses: [{}, { y: -10 }, {}] }
    const first = ensureAction(t.document, 'caT_probe', action)
    assert.equal(ensureAction(t.document, 'caT_probe', action), first)
    assert.equal(t.document.querySelectorAll('style[data-pixel-wizards-action="caT_probe"]').length, 1)
    actionStyle(t.document, 'caT_probe').remove()
    ensureAction(t.document, 'caT_probe', action)
    assert.ok(actionStyle(t.document, 'caT_probe'), 're-injected')
  } finally { t.restore() }
})

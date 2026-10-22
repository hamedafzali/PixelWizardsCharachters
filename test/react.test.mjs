import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { renderToString, renderToStaticMarkup } from 'react-dom/server'
import { CHARACTERS, defaultFrame, renderActorSVG, DEFAULT_MOTION } from '../dist/index.js'
import { CharacterActor, useActor } from '../dist/react.js'
import { setupDom, hooks } from './helpers/dom.mjs'

/**
 * `<CharacterActor>` and `useActor()` (PW-07), rendered for real: on the server
 * through `react-dom/server`, on the client through `react-dom/client` into a
 * jsdom host. Up to 1.7.1 the component forwarded three of the rig's options,
 * kept the callbacks it was first rendered with, and server-rendered an empty
 * `<div>`.
 */

const h = React.createElement
const QUIET = { blink: false, micro: { amount: 0 }, reducedMotion: true }

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** A client root in a fresh jsdom host. */
async function client() {
  const t = setupDom()
  // After the DOM globals exist: react-dom reads them when it loads.
  const { createRoot, hydrateRoot } = await import('react-dom/client')
  let root = null
  return {
    ...t,
    render(el) {
      React.act(() => {
        root ??= createRoot(t.host)
        root.render(el)
      })
    },
    hydrate(el) {
      t.host.innerHTML = renderToString(el)
      React.act(() => { root = hydrateRoot(t.host, el) })
    },
    done() {
      if (root) React.act(() => root.unmount())
      t.restore()
    },
  }
}

/** Collect calls to a console method for the length of `fn`. */
function capture(method, fn) {
  const calls = []
  const prev = console[method]
  console[method] = (...a) => calls.push(a.join(' '))
  try { fn() } finally { console[method] = prev }
  return calls
}

test('the server renders the static SVG of the frame, not an empty div', () => {
  const frame = { emotion: 'sad', gaze: { x: 0.6, y: 0 } }
  const html = renderToStaticMarkup(h(CharacterActor, { character: 'roozi', frame, size: 120 }))
  const svg = renderActorSVG(CHARACTERS.roozi, { ...defaultFrame('roozi'), ...frame }, 120)
  assert.equal(html, `<div>${svg}</div>`)
})

test('the static render takes the emotions and motion props too', () => {
  const emotions = { happy: { squint: 0.9 } }
  const motion = { depth: { travel: 9 } }
  const frame = { emotion: 'happy', yaw: 1 }
  const html = renderToStaticMarkup(h(CharacterActor, { character: 'ava', frame, emotions, motion }))
  const svg = renderActorSVG(CHARACTERS.ava, { ...defaultFrame('ava'), ...frame }, 160, emotions, { motion })
  assert.equal(html, `<div>${svg}</div>`)
})

test('ssr={false} keeps the empty div', () => {
  assert.equal(renderToStaticMarkup(h(CharacterActor, { character: 'roozi', ssr: false })), '<div></div>')
})

test('an unknown character renders nothing and warns once, outside production', () => {
  let html
  const warns = capture('warn', () => {
    html = renderToStaticMarkup(h(CharacterActor, { character: 'nobody' }))
    renderToStaticMarkup(h(CharacterActor, { character: 'nobody' }))
  })
  assert.equal(html, '<div></div>')
  assert.equal(warns.length, 1)
  assert.match(warns[0], /"nobody".*not a built-in character/)

  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    assert.deepEqual(capture('warn', () => renderToStaticMarkup(h(CharacterActor, { character: 'nobody2' }))), [])
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prev
  }
})

test('hydrating the server markup is clean, and the rig takes over without a jump', async () => {
  const c = await client()
  try {
    const frame = { emotion: 'shy', intensity: 0.8, gaze: { x: -1, y: 0.5 }, browRaise: 0.4, yaw: -0.6 }
    const el = h(CharacterActor, { character: 'boomi', frame, ...QUIET })
    const errors = capture('error', () => c.hydrate(el))
    assert.deepEqual(errors, [], 'no hydration mismatch')
    assert.ok(c.host.querySelector('svg.ca-svg'), 'the rig is mounted')
    const box = c.document.createElement('div')
    box.innerHTML = renderToStaticMarkup(el)
    assert.deepEqual(hooks(c.host), hooks(box), 'the mounted rig shows what the server sent')
  } finally { c.done() }
})

test('rigRef accepts a ref object or a callback, and is cleared on unmount', async () => {
  const c = await client()
  try {
    const obj = { current: null }
    const seen = []
    c.render(h('div', null,
      h(CharacterActor, { character: 'roozi', rigRef: obj, ...QUIET }),
      h(CharacterActor, { character: 'ava', rigRef: (r) => seen.push(r), ...QUIET })))
    assert.equal(obj.current?.goal.character, 'roozi')
    assert.equal(seen.length, 1)
    assert.equal(seen[0].goal.character, 'ava')
    c.render(h('div'))
    assert.equal(obj.current, null)
    assert.deepEqual(seen.slice(1), [null])
  } finally { c.done() }
})

test('a changed callback prop takes effect without a rebuild', async () => {
  const c = await client()
  try {
    const rig = { current: null }
    const a = []
    const b = []
    c.render(h(CharacterActor, { character: 'roozi', rigRef: rig, onFrame: (f) => a.push(f.emotion), ...QUIET }))
    const first = rig.current
    c.render(h(CharacterActor, { character: 'roozi', rigRef: rig, onFrame: (f) => b.push(f.emotion), ...QUIET }))
    assert.equal(rig.current, first, 'the same rig')
    React.act(() => rig.current.apply({ emotion: 'happy' }))
    assert.ok(b.includes('happy'))
    assert.ok(!a.includes('happy'), 'the old callback is not called')
  } finally { c.done() }
})

test('every rig option is forwarded', async () => {
  const c = await client()
  try {
    const rig = { current: null }
    const invalid = []
    c.render(h(CharacterActor, {
      character: 'roozi', rigRef: rig, ...QUIET,
      motion: { depth: false },
      onInvalidFrame: (e) => invalid.push(e.channel),
    }))
    assert.equal(rig.current.motion.depth, false, 'motion')
    assert.ok(c.host.querySelector('svg.ca-reduced'), 'reducedMotion')
    React.act(() => rig.current.apply({ emotion: 'grumpy' }))
    assert.deepEqual(invalid, ['emotion'], 'onInvalidFrame')
  } finally { c.done() }
})

test('emotions and motion retune the rig live; dropping motion restores the default', async () => {
  const c = await client()
  try {
    const rig = { current: null }
    const props = { character: 'roozi', rigRef: rig, ...QUIET }
    c.render(h(CharacterActor, { ...props, motion: { depth: { travel: 9 } } }))
    const first = rig.current
    assert.equal(first.motion.depth.travel, 9)

    c.render(h(CharacterActor, { ...props }))
    assert.equal(rig.current, first, 'no rebuild')
    assert.deepEqual(first.motion.depth, CHARACTERS.roozi.motion?.depth ?? DEFAULT_MOTION.depth)

    let calls = 0
    const set = first.setEmotions.bind(first)
    first.setEmotions = (e) => { calls++; set(e) }
    const emotions = { happy: { squint: 0.9 } }
    c.render(h(CharacterActor, { ...props, emotions }))
    c.render(h(CharacterActor, { ...props, emotions }))
    assert.equal(calls, 1, 'the same object retunes once')
  } finally { c.done() }
})

test('build-time options compare by value; a real change rebuilds onto the current frame', async () => {
  const c = await client()
  try {
    const rig = { current: null }
    const frame = { emotion: 'excited' }
    const props = { character: 'roozi', rigRef: rig, frame, ...QUIET }
    c.render(h(CharacterActor, { ...props, micro: { amount: 0 } }))
    const first = rig.current
    c.render(h(CharacterActor, { ...props, micro: { amount: 0 } }))
    assert.equal(rig.current, first, 'an equal inline object does not rebuild')

    c.render(h(CharacterActor, { ...props, micro: { amount: 0 }, size: 200 }))
    assert.notEqual(rig.current, first, 'size rebuilds')
    assert.equal(rig.current.goal.emotion, 'excited', 'and the new rig performs the frame')
    assert.equal(c.host.querySelectorAll('svg').length, 1)
  } finally { c.done() }
})

test('useActor reaches the mounted rig and passes onEnd through', async () => {
  const c = await client()
  try {
    let actor
    const ends = []
    function App({ show }) {
      actor = useActor()
      // Moving, not reduced: a reduced-motion rig skips gestures outright.
      return show ? h(CharacterActor, { character: 'roozi', rigRef: actor.rigRef, blink: false, reducedMotion: false }) : null
    }

    c.render(h(App, { show: false }))
    assert.equal(actor.rig, null)
    actor.playGesture('wave', { onEnd: (how) => ends.push(['early', how]) })
    assert.deepEqual(ends, [['early', 'skipped']], 'nothing to play on yet')

    c.render(h(App, { show: true }))
    assert.equal(actor.rig?.goal.character, 'roozi', 'the hook re-rendered with the rig')
    React.act(() => {
      actor.playGesture('wave', { onEnd: (how) => ends.push(['first', how]) })
      actor.playGesture('wave', { onEnd: (how) => ends.push(['second', how]) })
    })
    assert.deepEqual(ends.slice(1), [['first', 'interrupted']], 'the second wave cut the first off')

    React.act(() => actor.apply({ emotion: 'sad' }))
    assert.equal(actor.rig.goal.emotion, 'sad')

    const held = actor
    c.render(h(App, { show: false }))
    assert.equal(actor.rig, null)
    held.apply({ emotion: 'happy' }) // a stale handle reaches no destroyed rig
  } finally { c.done() }
})

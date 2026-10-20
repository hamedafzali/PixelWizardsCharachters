import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ActorRig, CHARACTERS, GESTURE_NAMES, GESTURE_DURING, planGesture, sanitizeFrame, renderActorSVG, defaultFrame,
} from '../dist/index.js'
import { ActorModel, ThreeActor } from '../dist/three/index.js'
import { setupDom } from './helpers/dom.mjs'

/**
 * The frame contract, as a driver that only speaks `ActorFrame` JSON sees it.
 * Each section pins one fix from the 1.7.0 correctness pass; every test here
 * fails on 1.6.0.
 */

const quiet = { blink: false, micro: { amount: 0 } }

function withRig(spec, opts, fn) {
  const t = setupDom()
  try {
    const rig = new ActorRig(spec, { ...quiet, ...opts }).mount(t.host)
    rig.finish()
    return fn({ rig, t })
  } finally { t.restore() }
}

// ── PW-01: frame.character switches the character ────────────────────────────

test("apply({ character: 'ava' }) switches a roozi rig to ava", () => {
  const issues = []
  withRig(CHARACTERS.roozi, { onInvalidFrame: (i) => issues.push(i) }, ({ rig, t }) => {
    const before = t.host.innerHTML
    rig.apply({ character: 'ava', emotion: 'happy' })
    rig.finish()
    assert.equal(rig.spec, CHARACTERS.ava)
    assert.equal(rig.frame.character, 'ava')
    assert.equal(rig.frame.emotion, 'happy', 'the rest of the frame still applies')
    assert.notEqual(t.host.innerHTML, before, 'the drawing changed')
    assert.equal(t.host.querySelector('svg').getAttribute('data-character'), 'ava')
    assert.equal(t.host.querySelectorAll('svg').length, 1)
    assert.deepEqual(issues, [])
  })
})

test('an unknown character is reported and the current one kept', () => {
  const issues = []
  withRig(CHARACTERS.roozi, { onInvalidFrame: (i) => issues.push(i) }, ({ rig }) => {
    rig.apply({ character: 'does-not-exist', emotion: 'sad' })
    rig.apply({ character: 42 })
    rig.finish()
    assert.equal(rig.spec, CHARACTERS.roozi)
    assert.equal(rig.frame.character, 'roozi')
    assert.equal(rig.frame.emotion, 'sad')
    assert.deepEqual(issues, [
      { channel: 'character', value: 'does-not-exist', kept: 'roozi' },
      { channel: 'character', value: 42, kept: 'roozi' },
    ])
  })
})

test("a custom spec is not in the registry, and its own slug is not an error", () => {
  const issues = []
  const mine = { ...CHARACTERS.roozi, slug: 'my-roozi' }
  const other = { ...CHARACTERS.ava, slug: 'my-ava' }
  withRig(mine, { onInvalidFrame: (i) => issues.push(i) }, ({ rig }) => {
    rig.apply({ character: 'my-roozi', emotion: 'happy' })
    rig.setCharacter(other)
    rig.apply({ emotion: 'sad' })
    assert.equal(rig.spec, other)
    assert.equal(rig.frame.character, 'my-ava')
    assert.deepEqual(issues, [])
  })
})

test('ActorModel switches its body when a frame names another character', () => {
  const issues = []
  const m = new ActorModel(CHARACTERS.roozi, { ...quiet, random: () => 0.5, onInvalidFrame: (i) => issues.push(i) })
  const first = m.object
  m.apply({ character: 'ava' })
  assert.equal(m.current.character, 'ava')
  assert.notEqual(m.object, first, 'a new body was built')
  const second = m.object
  m.apply({ character: 'nope' })
  assert.equal(m.current.character, 'ava')
  assert.equal(m.object, second)
  assert.deepEqual(issues, [{ channel: 'character', value: 'nope', kept: 'ava' }])
  m.dispose()
})

test('ThreeActor switches too, before mount and on its SVG fallback', () => {
  const t = setupDom()
  try {
    t.window.HTMLCanvasElement.prototype.getContext = () => null
    const actor = new ThreeActor(CHARACTERS.roozi, quiet)
    actor.apply({ character: 'ava' }) // before mount: the fallback must mount ava
    actor.mount(t.host)
    const drawn = () => t.host.querySelector('svg').getAttribute('data-character')
    assert.equal(actor.backend, 'svg')
    assert.equal(drawn(), 'ava')
    actor.apply({ character: 'roozi' })
    assert.equal(drawn(), 'roozi')
    actor.destroy()
  } finally { t.restore() }
})

// ── PW-02: gestures during roll ──────────────────────────────────────────────

test('during roll, everything plays except the gestures that need footing', () => {
  const blocked = GESTURE_NAMES.filter((g) => planGesture(g, 'roll', null, () => true).mode === 'blocked')
  assert.deepEqual(blocked.sort(), ['bounce', 'clap', 'jump'])
  for (const g of GESTURE_NAMES) {
    assert.equal(GESTURE_DURING[g].includes('roll'), GESTURE_DURING[g].includes('fly'), `${g}: roll follows fly`)
  }
})

test('چرخی and ربو gesture while rolling, in the DOM', () => {
  for (const slug of ['charkhi', 'robo']) {
    const blocked = []
    withRig(CHARACTERS[slug], { onGestureBlocked: (g, r) => blocked.push([g, r]) }, ({ rig, t }) => {
      rig.apply({ locomotion: 'roll' })
      rig.finish() // locomotion lands after a short delay
      assert.equal(rig.frame.locomotion, 'roll')
      for (const g of ['wave', 'nod', 'spin']) {
        rig.playGesture(g)
        const animated = [...t.host.querySelectorAll('g')].some((el) => el.style.animation.includes(`caG_${g}`))
        assert.ok(animated, `${slug}: ${g} animates while rolling`)
      }
      rig.playGesture('jump')
      assert.deepEqual(blocked, [['jump', 'semantic']], `${slug}: only jump was refused`)
    })
  }
})

// ── PW-09: numbers that are not numbers ──────────────────────────────────────

test('a non-numeric number is reported and the current value kept', () => {
  const issues = []
  const current = { ...defaultFrame('roozi'), intensity: 0.4, gaze: { x: 0.5, y: 0 } }
  const out = sanitizeFrame(
    { intensity: 'high', mouthOpen: NaN, speed: 'fast', browRaise: Infinity, yaw: null, gaze: 'left' },
    current, (i) => issues.push(i))
  assert.deepEqual(out, { intensity: 0.4, mouthOpen: 0, speed: 1, browRaise: 0, yaw: 0, gaze: { x: 0.5, y: 0 } })
  assert.deepEqual(issues.map((i) => [i.channel, i.value]), [
    ['intensity', 'high'], ['mouthOpen', NaN], ['browRaise', Infinity], ['speed', 'fast'], ['yaw', null], ['gaze', 'left'],
  ])
})

test('a gaze with a bad axis is reported; a partial or null gaze is not', () => {
  const issues = []
  const on = (i) => issues.push(i)
  sanitizeFrame({ gaze: { x: NaN, y: 0 } }, null, on)
  assert.equal(issues.length, 1)
  assert.deepEqual(issues[0].kept, { x: 0, y: 0 }, 'nothing to keep: the default')
  for (const ok of [{ gaze: { x: 0.5 } }, { gaze: null }]) {
    assert.equal(sanitizeFrame(ok, null, on), ok, 'returned by identity')
  }
  assert.equal(issues.length, 1)
})

test('a finite number out of range is clamped, not reported', () => {
  const issues = []
  withRig(CHARACTERS.roozi, { onInvalidFrame: (i) => issues.push(i) }, ({ rig }) => {
    rig.apply({ intensity: 1.5 })
    rig.finish()
    assert.equal(rig.frame.intensity, 1)
    assert.deepEqual(issues, [])
  })
})

test("the rig keeps the intensity it had when a frame sends 'high'", () => {
  withRig(CHARACTERS.roozi, {}, ({ rig }) => {
    rig.apply({ intensity: 0.9 })
    rig.finish()
    rig.apply({ intensity: 'high' })
    rig.finish()
    assert.equal(rig.frame.intensity, 0.9, 'up to 1.6.0 this was 0')
  })
})

// ── PW-11: timers after destroy ──────────────────────────────────────────────

test('destroy() cancels the gesture-end and blink timers', () => {
  const t = setupDom()
  try {
    const pending = new Set()
    const set = t.window.setTimeout.bind(t.window)
    const clear = t.window.clearTimeout.bind(t.window)
    t.window.setTimeout = (fn, ms, ...args) => {
      const id = set(() => { pending.delete(id); fn(...args) }, ms)
      pending.add(id)
      return id
    }
    t.window.clearTimeout = (id) => { pending.delete(id); clear(id) }

    const rig = new ActorRig(CHARACTERS.roozi, quiet).mount(t.host)
    rig.playGesture('jump')
    rig.blink()
    assert.ok(pending.size >= 2, 'the precondition: timers are running')
    rig.destroy()
    assert.equal(pending.size, 0, `${pending.size} timer(s) outlived destroy()`)
  } finally { t.restore() }
})

// ── PW-15: reduced motion changed after mount ────────────────────────────────

/** A `matchMedia` whose reduced-motion answer the test can flip. */
function controllableReducedMotion(window) {
  const listeners = new Set()
  let matches = false
  window.matchMedia = (media) => ({
    media, get matches() { return matches }, onchange: null,
    addEventListener: (_type, l) => listeners.add(l),
    removeEventListener: (_type, l) => listeners.delete(l),
    addListener: (l) => listeners.add(l), removeListener: (l) => listeners.delete(l),
    dispatchEvent: () => false,
  })
  return {
    listeners,
    set(on) {
      matches = on
      for (const l of [...listeners]) l({ matches: on })
    },
  }
}

test('turning reduced motion on mid-session lands the rig at once, and off starts it again', () => {
  const t = setupDom()
  try {
    const os = controllableReducedMotion(t.window)
    const rig = new ActorRig(CHARACTERS.roozi, quiet).mount(t.host)
    const svg = () => t.host.querySelector('svg')

    rig.apply({ gaze: { x: 1, y: 0 } })
    assert.ok(rig.frame.gaze.x < 1, 'the precondition: with motion, gaze eases')

    os.set(true)
    assert.ok(svg().classList.contains('ca-reduced'))
    assert.equal(rig.frame.gaze.x, 1, 'what was in flight landed')
    rig.apply({ gaze: { x: -1, y: 0 } })
    assert.equal(rig.frame.gaze.x, -1, 'and new frames land at once')

    os.set(false)
    assert.ok(!svg().classList.contains('ca-reduced'))
    rig.apply({ gaze: { x: 1, y: 0 } })
    assert.ok(rig.frame.gaze.x < 1, 'motion is back')

    rig.destroy()
    assert.equal(os.listeners.size, 0, 'destroy() stops listening')
  } finally { t.restore() }
})

test('a forced reducedMotion is not overridden by the OS', () => {
  const t = setupDom()
  try {
    const os = controllableReducedMotion(t.window)
    const rig = new ActorRig(CHARACTERS.roozi, { ...quiet, reducedMotion: false }).mount(t.host)
    assert.equal(os.listeners.size, 0)
    os.set(true)
    assert.ok(!t.host.querySelector('svg').classList.contains('ca-reduced'))
    rig.destroy()
  } finally { t.restore() }
})

test('ActorModel.setReducedMotion lands everything when switched on', () => {
  const m = new ActorModel(CHARACTERS.roozi, { ...quiet, random: () => 0.5 })
  m.apply({ gaze: { x: 1, y: 0 } })
  assert.ok(m.current.gaze.x < 1)
  m.setReducedMotion(true)
  assert.equal(m.reduced, true)
  assert.equal(m.current.gaze.x, 1)
  m.dispose()
})

// ── PW-16: ids ───────────────────────────────────────────────────────────────

test('two different characters on one page share no id either', () => {
  const t = setupDom()
  try {
    for (const slug of ['tondpa', 'tondpa', 'khersi', 'ava']) {
      const host = t.host.appendChild(t.document.createElement('div'))
      new ActorRig(CHARACTERS[slug], quiet).mount(host)
    }
    const ids = [...t.host.querySelectorAll('[id]')].map((e) => e.id)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    assert.deepEqual(dupes, [])
  } finally { t.restore() }
})

test('a static render keeps id="mouthG" for consumers that parse it', () => {
  const svg = renderActorSVG(CHARACTERS.roozi, defaultFrame('roozi'))
  assert.match(svg, /<g id="mouthG" class="mouthG">/)
})

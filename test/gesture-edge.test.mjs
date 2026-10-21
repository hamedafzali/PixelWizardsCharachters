import test from 'node:test'
import assert from 'node:assert/strict'
import { ActorRig, CHARACTERS, GESTURES } from '../dist/index.js'
import { ActorModel } from '../dist/three/index.js'
import { setupDom } from './helpers/dom.mjs'

/**
 * A gesture starts when the driver's value changes, not each time it arrives
 * (PW-05). Up to 1.7.1 the channel cleared itself when a gesture ended, so a
 * driver that kept `gesture: 'wave'` in the frame it sent every tick waved
 * again after every wave. And `playGesture` reports how it ended, through
 * `onEnd`.
 */

const quiet = { blink: false, micro: { amount: 0 } }
const waveDur = Math.max(...GESTURES.wave.parts.map((p) => p.action.dur))
const waveMs = waveDur * 1000

/** A rig on a jsdom window whose timers only move when `wait` says so. */
function withRig(opts, fn) {
  const t = setupDom()
  let now = 0
  let due = []
  t.window.setTimeout = (cb, ms = 0) => {
    const id = Symbol('timer')
    due.push({ id, at: now + ms, cb })
    return id
  }
  t.window.clearTimeout = (id) => { due = due.filter((d) => d.id !== id) }
  const wait = (ms) => {
    const until = now + ms
    for (;;) {
      const next = due.filter((d) => d.at <= until).sort((a, b) => a.at - b.at)[0]
      if (!next) break
      due = due.filter((d) => d !== next)
      now = next.at
      next.cb()
    }
    now = until
  }
  try {
    const rig = new ActorRig(CHARACTERS.roozi, { ...quiet, ...opts }).mount(t.host)
    rig.finish()
    // Every start goes through playGesture, the frame path included.
    const plays = []
    const play = rig.playGesture.bind(rig)
    rig.playGesture = (g, o) => { plays.push(g); return play(g, o) }
    return fn({ rig, t, wait, plays })
  } finally { t.restore() }
}

/** A driver that sends its whole frame every tick, gesture included. */
function drive(rig, wait, frame, ms) {
  for (let left = ms; left > 0; left -= 50) {
    rig.apply(frame)
    wait(50)
  }
}

test('a gesture kept in the frame plays once', () => {
  withRig({}, ({ rig, wait, plays }) => {
    drive(rig, wait, { emotion: 'happy', gesture: 'wave' }, 5000)
    assert.deepEqual(plays, ['wave'], `played ${plays.length} times in 5 s`)
  })
})

test('a new value starts a gesture, and null re-arms the same one', () => {
  withRig({}, ({ rig, wait, plays }) => {
    rig.apply({ gesture: 'wave' })
    wait(waveMs + 100)
    rig.apply({ gesture: 'nod' })
    wait(2000)
    rig.apply({ gesture: null })
    rig.apply({ gesture: 'nod' })
    assert.deepEqual(plays, ['wave', 'nod', 'nod'])
  })
})

test('a frame without a gesture leaves the driver\'s last one alone', () => {
  withRig({}, ({ rig, wait, plays }) => {
    rig.apply({ gesture: 'wave' })
    wait(waveMs + 100)
    rig.apply({ emotion: 'sad' })
    rig.apply({ gesture: 'wave' })
    assert.deepEqual(plays, ['wave'], 'omitting gesture is not a change')
  })
})

test('playGesture still plays every time it is called', () => {
  withRig({}, ({ rig, wait, plays }) => {
    rig.apply({ gesture: 'wave' })
    wait(waveMs + 100)
    rig.playGesture('wave')
    wait(waveMs + 100)
    rig.playGesture('wave')
    assert.deepEqual(plays, ['wave', 'wave', 'wave'])
  })
})

test('the channel still clears when the gesture ends', () => {
  withRig({}, ({ rig, wait }) => {
    rig.apply({ gesture: 'wave' })
    assert.equal(rig.frame.gesture, 'wave')
    wait(waveMs + 100)
    assert.equal(rig.frame.gesture, null)
  })
})

test('onEnd reports done, after the gesture', () => {
  withRig({}, ({ rig, wait }) => {
    const ends = []
    rig.playGesture('wave', { onEnd: (how) => ends.push(how) })
    wait(waveMs - 50)
    assert.deepEqual(ends, [])
    wait(100)
    assert.deepEqual(ends, ['done'])
  })
})

test('onEnd reports blocked and skipped right away', () => {
  const ends = []
  withRig({}, ({ rig }) => {
    rig.apply({ locomotion: 'fly' })
    rig.finish()
    rig.playGesture('jump', { onEnd: (how) => ends.push(['jump', how]) })
    rig.playGesture('nope', { onEnd: (how) => ends.push(['nope', how]) })
  })
  withRig({ reducedMotion: true }, ({ rig }) => {
    rig.playGesture('wave', { onEnd: (how) => ends.push(['reduced', how]) })
  })
  assert.deepEqual(ends, [['jump', 'blocked'], ['nope', 'skipped'], ['reduced', 'skipped']])
})

test('a restart interrupts the first run, and the first timer no longer cuts the second short', () => {
  withRig({}, ({ rig, t, wait }) => {
    const ends = []
    rig.playGesture('wave', { onEnd: (how) => ends.push(['first', how]) })
    wait(waveMs / 2)
    rig.playGesture('wave', { onEnd: (how) => ends.push(['second', how]) })
    assert.deepEqual(ends, [['first', 'interrupted']])
    wait(waveMs / 2 + 50)
    const animated = [...t.host.querySelectorAll('g')].some((el) => el.style.animation.includes('caG_wave'))
    assert.ok(animated, 'the restarted wave is still playing')
    wait(waveMs / 2)
    assert.deepEqual(ends, [['first', 'interrupted'], ['second', 'done']])
  })
})

test('destroy() drops onEnd without calling it', () => {
  withRig({}, ({ rig, wait }) => {
    const ends = []
    rig.playGesture('wave', { onEnd: (how) => ends.push(how) })
    rig.destroy()
    wait(waveMs * 2)
    assert.deepEqual(ends, [])
  })
})

// ── ActorModel, the three.js side, follows the same rules ────────────────────

const model = () => new ActorModel(CHARACTERS.roozi, { ...quiet, random: () => 0.5 })

function counting(m) {
  const plays = []
  const play = m.playGesture.bind(m)
  m.playGesture = (g, o) => { plays.push(g); return play(g, o) }
  return plays
}

test('ActorModel: a gesture kept in the frame plays once', () => {
  const m = model()
  const plays = counting(m)
  for (let i = 0; i < 300; i++) {
    m.apply({ gesture: 'wave' })
    m.tick(1 / 60)
  }
  assert.deepEqual(plays, ['wave'])
  m.dispose()
})

test('ActorModel: onEnd reports done, interrupted, blocked and skipped', () => {
  const m = model()
  const ends = []
  m.playGesture('wave', { onEnd: (how) => ends.push(['a', how]) })
  m.tick(waveDur / 2)
  m.playGesture('wave', { onEnd: (how) => ends.push(['b', how]) })
  for (let t = 0; t < waveDur + 0.1; t += 1 / 60) m.tick(1 / 60)
  m.playGesture('nope', { onEnd: (how) => ends.push(['c', how]) })
  m.apply({ locomotion: 'fly' })
  m.finish()
  m.playGesture('jump', { onEnd: (how) => ends.push(['d', how]) })
  assert.deepEqual(ends, [['a', 'interrupted'], ['b', 'done'], ['c', 'skipped'], ['d', 'blocked']])
  m.dispose()
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHARACTERS, EMOTIONS, GESTURE_NAMES, resolvePosture, canDrive,
} from '../dist/index.js'
import { charkhiAntennaClip, charkhiAntennaClipOnset, headPivot } from '../tools/lib/probes.mjs'
import { gesturePlanFor } from '../tools/lib/harness.mjs'

const layersOf = () =>
  new Set(Object.keys(CHARACTERS.charkhi.render({ emotion: EMOTIONS.neutral, intensity: 1 }).layers ?? {}))

// ------------------------------------------------------- structure -------------

test('چرخی has no head layer: one continuous moulded form, the same rule as بومی applied to a car', () => {
  assert.ok(!layersOf().has('head'))
})

test('چرخی has no leg or arm layers: the wheels are static art, not a joint that swings', () => {
  const l = layersOf()
  for (const layer of ['farLeg', 'nearLeg', 'farArm', 'nearArm']) assert.ok(!l.has(layer), `unexpected ${layer}`)
})

test('چرخی is structurally incapable of walk/fly, and declares only the root/torso roll gait it can actually do', () => {
  assert.deepEqual(CHARACTERS.charkhi.gaits ?? [], ['roll'])
  const has = (t) => t === 'root' || t === 'torso' || layersOf().has(t)
  assert.equal(canDrive('walk', has), false)
  assert.equal(canDrive('fly', has), false)
  // root/torso are structurally universal, so چرخی's leglessness never blocks
  // roll the way it blocks walk/fly -- only the declaration in `gaits` does.
  assert.equal(canDrive('roll', has), true)
})

test('چرخی reuses earL/earR for antennas, and they hang off the torso (no head to hang off)', () => {
  const l = layersOf()
  assert.ok(l.has('earL') && l.has('earR'))
})

// ------------------------------------------------------- gestures --------------

test('the 3-native/6-fallback gesture split predicted for a headless, limbless body', () => {
  const native = []
  const fallback = []
  for (const g of GESTURE_NAMES) {
    const plan = gesturePlanFor('charkhi', g, 'idle')
    ;(plan.mode === 'parts' ? native : fallback).push(g)
  }
  assert.deepEqual(native.sort(), ['bounce', 'jump', 'spin'],
    'only the whole-body-only gestures run natively with zero limb layers')
  assert.deepEqual(fallback.sort(), ['clap', 'nod', 'point', 'shake', 'shrug', 'wave'],
    'every limb/head gesture structurally falls back to rig-body')
})

// ------------------------------------------------------- the clip-in guard -----
//
// آوا's and خرسی's ears/pigtails are guarded against pulling *out* of the head
// (a chord-midpoint pivot, sitting outside the disc it overlaps). چرخی's
// antennas cannot pull free of the body — their pivot IS the body's own edge —
// so the failure this guards against is the opposite: the stalk swinging back
// down far enough to dip *under* the roofline it grows from. See the fourth
// CONTRIBUTING.md pattern and `charkhiAntennaClip` in tools/lib/probes.mjs.

test("چرخی's antennas never clip into the roofline across the full emotion x intensity range", () => {
  let worst = { v: Infinity }
  for (const emotion of Object.keys(EMOTIONS)) {
    for (let i = 0; i <= 20; i++) {
      const intensity = i / 20
      const p = resolvePosture(emotion, intensity, CHARACTERS.charkhi.posture)
      for (const side of ['earL', 'earR']) {
        const v = charkhiAntennaClip(side, p.ears ?? 0)
        if (v < worst.v) worst = { v, emotion, intensity, side }
      }
    }
  }
  // Measured worst case is 1.302 (sad, intensity 1) — see tools/baselines/geometry.json.
  // The floor is 1, the same convention لاکی's mouth/head clearance guards use.
  assert.ok(worst.v > 1,
    `چرخی's ${worst.side} antenna clips toward the roof at ${worst.emotion}/${worst.intensity} (margin ${worst.v.toFixed(2)})`)
})

test("the clip onset is well clear of what چرخی's own posture map ever asks for", () => {
  // Derived by bisection (charkhiAntennaClipOnset), not assumed: clipping only
  // begins around 69.67°, roughly 3.9x this character's declared max travel.
  const maxDeclaredEars = Math.max(
    ...Object.values(CHARACTERS.charkhi.posture ?? {}).map((p) => Math.abs(p.ears ?? 0)),
  )
  for (const side of ['earL', 'earR']) {
    const onset = charkhiAntennaClipOnset(side)
    assert.ok(onset > maxDeclaredEars * 2,
      `${side} clip onset (${onset.toFixed(1)}deg) is too close to the declared max (${maxDeclaredEars}deg)`)
  }
})

test('antenna origins are literal on-curve vertices of the torso path, not chord-midpoints', () => {
  // [58,80] and [142,80] are the endpoints of the roof-shoulder cubics in the
  // torso.art path string itself (see the docstring on `charkhi`) — measured
  // off the drawing the way بومی's tuft origins are, not computed the way
  // آوا's/خرسی's ear pivots are.
  assert.deepEqual(headPivot('charkhi', 'earL'), [58, 80])
  assert.deepEqual(headPivot('charkhi', 'earR'), [142, 80])
})

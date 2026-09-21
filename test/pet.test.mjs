/**
 * نوازش — the pet driver.
 *
 * Two things are worth guarding here and they are not the obvious ones.
 *
 * The zone *centres* are derived from the shipped spec, so the test that
 * matters is not "is the head at (100,74)" — that is the copy-of-a-measurement
 * the CONTRIBUTING rules warn about, and it would pass forever after the real
 * pivot moved. It is "does the derivation still read the spec", which is
 * asserted by recomputing it from `spec.eyes` and the layer origins here.
 *
 * The other is that affection accrues from *travel*, not from time held. A
 * finger parked on a character must earn nothing, or a child can leave one
 * down and farm adoration.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHARACTERS, PetDriver, petZones, zoneAt, PET_REACH,
  GESTURES, GESTURE_NAMES, GESTURE_DURING,
} from '../dist/index.js'

const specs = Object.values(CHARACTERS)
const neutral = { emotion: { squint: 0, wide: 0, mouth: 'soft', brow: 'idle' }, intensity: 0 }

test('zone centres are read from the spec, not copied', () => {
  for (const spec of specs) {
    const zones = petZones(spec)
    const head = zones.find((z) => z.name === 'head')
    assert.ok(head, `${spec.slug} has no head zone`)
    assert.equal(head.cx, (spec.eyes.x[0] + spec.eyes.x[1]) / 2)
    assert.equal(head.cy, spec.eyes.y)

    const layers = spec.render(neutral).layers
    for (const [name, layer] of [['back', layers?.torso], ['tail', layers?.tail]]) {
      const zone = zones.find((z) => z.name === name)
      if (layer?.origin) {
        assert.ok(zone, `${spec.slug} should expose a ${name} zone`)
        assert.deepEqual([zone.cx, zone.cy], layer.origin)
      } else {
        assert.equal(zone, undefined, `${spec.slug} invented a ${name} zone with no layer behind it`)
      }
    }
  }
})

test('a character with no torso/tail layer offers its head only, rather than an invented hip', () => {
  // سیمرغ used to be this example; it is layer-rig converted now (see
  // CHANGELOG) and gained real back/tail zones as a side effect — covered by
  // the derivation test above. بومی has a torso layer but no tail, so it is
  // the roster's example of the remaining case: a real hip with no tail zone
  // behind it, rather than an invented one.
  const boomi = CHARACTERS.boomi ?? specs.find((s) => s.slug === 'boomi')
  const names = petZones(boomi).map((z) => z.name)
  assert.ok(names.includes('head') && names.includes('back'))
  assert.ok(!names.includes('tail'), 'بومی invented a tail zone with no tail layer behind it')
})

test("سیمرغ, now converted, offers head, back and tail zones", () => {
  const simorgh = CHARACTERS.simorgh ?? specs.find((s) => s.slug === 'simorgh')
  assert.deepEqual(petZones(simorgh).map((z) => z.name), ['head', 'back', 'tail'])
})

test('zone centres stay far enough apart to stay distinguishable', () => {
  // Overlap within PET_REACH is expected and resolved by nearest-centre; two
  // centres *collapsing* is what would break zoning. 40 sits just under
  // چرخی's 44, the tightest pair on the roster.
  for (const spec of specs) {
    const z = petZones(spec)
    for (let i = 0; i < z.length; i++) {
      for (let j = i + 1; j < z.length; j++) {
        const d = Math.hypot(z[i].cx - z[j].cx, z[i].cy - z[j].cy)
        assert.ok(d >= 40, `${spec.slug}: ${z[i].name}/${z[j].name} only ${d.toFixed(1)} apart`)
      }
    }
  }
})

test('zoneAt resolves by nearest centre, and misses cleanly', () => {
  const roozi = specs.find((s) => s.slug === 'roozi')
  for (const z of petZones(roozi)) {
    assert.equal(zoneAt(roozi, z.cx, z.cy), z.name)
  }
  assert.equal(zoneAt(roozi, -500, -500), null)
  // A point just past the reach of every centre is a miss, not a nearest-wins.
  const head = petZones(roozi).find((z) => z.name === 'head')
  assert.equal(zoneAt(roozi, head.cx, head.cy - (PET_REACH + 1)), null)
})

test('a motionless finger earns nothing; travel earns', () => {
  const spec = specs.find((s) => s.slug === 'roozi')
  const head = petZones(spec).find((z) => z.name === 'head')

  const parked = new PetDriver(spec)
  for (let i = 0; i < 60; i++) parked.stroke(head.cx, head.cy)
  assert.equal(parked.tick(1 / 60).affection, 0, 'a held finger accrued affection')

  const stroking = new PetDriver(spec)
  for (let i = 0; i < 30; i++) stroking.stroke(head.cx + (i % 2 ? 8 : -8), head.cy)
  assert.ok(stroking.tick(1 / 60).affection > 0.2, 'stroking accrued nothing')
})

test('affection decays once the hand leaves, and clears its beats at zero', () => {
  const spec = specs.find((s) => s.slug === 'roozi')
  const head = petZones(spec).find((z) => z.name === 'head')
  const pet = new PetDriver(spec)
  for (let i = 0; i < 30; i++) pet.stroke(head.cx + (i % 2 ? 8 : -8), head.cy)
  pet.release()
  const before = pet.tick(0).affection
  pet.tick(1)
  assert.ok(pet.tick(0).affection < before, 'affection did not decay')
  for (let i = 0; i < 20; i++) pet.tick(1)
  const out = pet.tick(0)
  assert.equal(out.affection, 0)
  assert.equal(out.zone, null)
  assert.equal(out.emotion, null)
})

test('the greeting fires once per contact, not once per frame', () => {
  const spec = specs.find((s) => s.slug === 'roozi')
  const head = petZones(spec).find((z) => z.name === 'head')
  const pet = new PetDriver(spec)
  let fired = 0
  for (let i = 0; i < 40; i++) {
    pet.stroke(head.cx + (i % 2 ? 8 : -8), head.cy)
    if (pet.tick(1 / 60).gesture === 'nuzzle') fired++
  }
  assert.equal(fired, 1, `nuzzle fired ${fired} times`)
})

test('a tail grab startles first and turns into play', () => {
  const spec = specs.find((s) => s.slug === 'pashmak')
  const tail = petZones(spec).find((z) => z.name === 'tail')
  assert.ok(tail, 'pashmak should have a tail zone')
  const pet = new PetDriver(spec)
  const seen = new Set()
  for (let i = 0; i < 120; i++) {
    pet.stroke(tail.cx + (i % 2 ? 9 : -9), tail.cy)
    const out = pet.tick(1 / 60)
    if (out.emotion) seen.add(out.emotion)
  }
  assert.ok(seen.has('surprised'), 'tail grab never startled')
  assert.ok(seen.has('excited'), 'tail grab never resolved into play')
})

test('reduced motion keeps the reaction but emits no motion', () => {
  const spec = specs.find((s) => s.slug === 'roozi')
  const head = petZones(spec).find((z) => z.name === 'head')
  const pet = new PetDriver(spec, { reducedMotion: true })
  let sawGesture = false
  let intensity = 0
  for (let i = 0; i < 80; i++) {
    pet.stroke(head.cx + (i % 2 ? 8 : -8), head.cy)
    const out = pet.tick(1 / 60)
    if (out.gesture) sawGesture = true
    if (out.emotion) intensity = out.intensity
  }
  assert.equal(sawGesture, false, 'reduced motion emitted a gesture')
  assert.equal(intensity, 1, 'reduced motion should snap intensity, not ramp it')
})

test('nuzzle is a real registry entry that routes to the head with a body fallback', () => {
  assert.ok(GESTURE_NAMES.includes('nuzzle'))
  assert.equal(GESTURES.nuzzle.parts[0].layer, 'lyr-head')
  assert.equal(GESTURES.nuzzle.fallback.layer, 'rig-body')
  // Affection is not grounded — سیمرغ can be stroked mid-flight.
  assert.ok(GESTURE_DURING.nuzzle.includes('fly'))
})

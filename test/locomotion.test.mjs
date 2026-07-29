import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ActorRig, CHARACTERS, GAITS, LOCO_TARGETS, LocomotionDriver,
  WALK_PHASES, FLY_PHASES, WING_FOLD_SX,
  samplePhase, wrapPhase, canDrive, drivesGait,
} from '../dist/index.js'
import { setupDom } from './helpers/dom.mjs'

/**
 * Phase-driven locomotion.
 *
 * Nearly everything here is a *guard*: a wraparound, a reset condition, a
 * fallback branch. Each one below was checked by deleting the guard from the
 * built output and confirming these tests go red — a guard test that passes
 * with the guard removed is worse than no test, because it reads as coverage.
 */

// ------------------------------------------------------------ phase maths ---

test('wrapPhase folds anything into [0, 1)', () => {
  assert.equal(wrapPhase(0), 0)
  assert.equal(wrapPhase(0.4), 0.4)
  assert.equal(wrapPhase(1), 0)
  assert.equal(wrapPhase(2.25), 0.25)
})

test('wrapPhase handles a phase that went backwards', () => {
  // `%` keeps the sign, so -0.25 would stay negative and index off the front of
  // every table — a rewound timeline would produce garbage transforms.
  assert.equal(wrapPhase(-0.25), 0.75)
  assert.equal(wrapPhase(-1.25), 0.75)
  assert.ok(wrapPhase(-1e-9) >= 0 && wrapPhase(-1e-9) < 1)
})

test('wrapPhase refuses to propagate a non-finite clock', () => {
  // One NaN dt would otherwise poison the phase permanently: NaN % 1 is NaN,
  // and every transform on the character stays NaN for the rest of the session.
  assert.equal(wrapPhase(NaN), 0)
  assert.equal(wrapPhase(Infinity), 0)
  assert.equal(wrapPhase(-Infinity), 0)
})

test('a track is continuous across the wrap point', () => {
  const keys = GAITS.walk.tracks.nearLeg
  const before = samplePhase(keys, 0.9999)
  const after = samplePhase(keys, 0.0001)
  assert.ok(Math.abs(before.rot - after.rot) < 0.01,
    `the cycle snaps at the wrap: ${before.rot} -> ${after.rot}`)
})

test('the wrap segment interpolates, it does not hold', () => {
  // The guard is `next === 0 ? b.at + 1 : b.at`. Without it the final segment
  // has a non-positive span, the sampler bails to t=0, and the limb *freezes*
  // at the last key for the whole back half of the cycle.
  const keys = GAITS.walk.tracks.nearLeg   // rot 20 @0, rot -20 @0.5
  const mid = samplePhase(keys, 0.75)
  assert.ok(mid.rot > -19 && mid.rot < 19, `the return stroke never moved: ${mid.rot}`)
  assert.ok(Math.abs(mid.rot - 0) < 1, `0.75 is the midpoint of the return stroke, got ${mid.rot}`)
})

test('keys land exactly on their own poses', () => {
  const keys = GAITS.walk.tracks.nearLeg
  assert.equal(samplePhase(keys, 0).rot, 20)
  assert.equal(samplePhase(keys, 0.5).rot, -20)
})

test('an empty or single-key track is identity-safe', () => {
  assert.deepEqual(samplePhase([], 0.3), { x: 0, y: 0, rot: 0, sx: 1, sy: 1 })
  assert.equal(samplePhase([{ at: 0, pose: { rot: 7 } }], 0.8).rot, 7)
})

test('the walk is contralateral and the legs are exactly out of phase', () => {
  for (const p of [0, 0.1, 0.37, 0.5, 0.83]) {
    const nl = samplePhase(GAITS.walk.tracks.nearLeg, p).rot
    const fl = samplePhase(GAITS.walk.tracks.farLeg, p).rot
    const na = samplePhase(GAITS.walk.tracks.nearArm, p).rot
    assert.ok(Math.abs(nl + fl) < 1e-9, `legs not opposed at ${p}: ${nl} / ${fl}`)
    assert.ok(nl * na <= 0, `near arm swings with its own leg at ${p}`)
  }
})

test('the wingbeat is asymmetric: the downstroke is the short half', () => {
  const keys = GAITS.fly.tracks.farArm
  const down = keys[1].at - keys[0].at
  assert.ok(down < 0.5, `downstroke should be under half the cycle, got ${down}`)
  // And the wings are mirrored, or the character rows sideways.
  for (const p of [0.1, 0.34, 0.7]) {
    const f = samplePhase(GAITS.fly.tracks.farArm, p).rot
    const n = samplePhase(GAITS.fly.tracks.nearArm, p).rot
    assert.ok(Math.abs(f + n) < 1e-9, `wings not mirrored at ${p}`)
  }
})

// ---------------------------------------------------------------- driver ---

test('the driver advances at rate x speed', () => {
  const d = new LocomotionDriver()
  d.advance(0, 'walk', 1)              // arms the gait
  d.advance(0.25, 'walk', 1)
  assert.ok(Math.abs(d.phase - 0.5) < 1e-9, `2 cycles/s for 0.25s is half a cycle, got ${d.phase}`)
  d.advance(0.25, 'walk', 2)
  assert.ok(Math.abs(d.phase - 0.5) < 1e-9, 'double speed covers a full cycle back to 0.5')
})

test('a speed change does not reset the phase mid-stride', () => {
  const d = new LocomotionDriver()
  d.advance(0, 'walk', 1)
  d.advance(0.1, 'walk', 1)
  const mid = d.phase
  assert.ok(mid > 0)
  d.advance(0, 'walk', 3)
  assert.equal(d.phase, mid, 'speeding up must not teleport the feet to the top of the cycle')
})

test('a gait change resets the phase', () => {
  const d = new LocomotionDriver()
  d.advance(0, 'walk', 1)
  d.advance(0.17, 'walk', 1)
  assert.ok(d.phase > 0)
  d.advance(0.016, 'fly', 1)
  assert.equal(d.phase, 0, 'a wingbeat must start at the top of the stroke')
})

test('going idle parks the phase and stops contributing', () => {
  const d = new LocomotionDriver()
  d.advance(0, 'walk', 1)
  d.advance(0.3, 'walk', 1)
  d.advance(0.016, null, 1)
  assert.equal(d.phase, 0)
  for (const t of LOCO_TARGETS) {
    assert.deepEqual(d.pose(t), { x: 0, y: 0, rot: 0, sx: 1, sy: 1 }, `${t} still posed while idle`)
  }
})

test('a bad dt cannot move the phase', () => {
  const d = new LocomotionDriver()
  d.advance(0, 'walk', 1)
  d.advance(0.2, 'walk', 1)
  const before = d.phase
  for (const bad of [NaN, Infinity, -0.5, 0]) d.advance(bad, 'walk', 1)
  assert.equal(d.phase, before, 'a bad frame time moved the cycle')
})

test('a target with no track in this gait contributes identity', () => {
  const d = new LocomotionDriver()
  d.advance(0, 'fly', 1)
  d.advance(0.1, 'fly', 1)
  // Fly has no leg tracks. Without the guard this would throw or emit undefined.
  assert.deepEqual(d.pose('farLeg'), { x: 0, y: 0, rot: 0, sx: 1, sy: 1 })
  assert.ok(d.pose('farArm').rot !== 0, 'but the wings are moving')
})

// -------------------------------------------------------------- fallback ---

test('canDrive requires every listed layer, not just one', () => {
  assert.equal(canDrive('walk', () => true), true)
  assert.equal(canDrive('walk', (t) => t !== 'farLeg'), false, 'one missing leg is still not a walk')
  assert.equal(canDrive('walk', (t) => t !== 'nearLeg'), false)
  assert.equal(canDrive('fly', () => false), false)
  assert.equal(canDrive('fly', (t) => t === 'farArm' || t === 'nearArm'), true)
})

// ----------------------------------------------------- end to end, in DOM ---

function mount(spec) {
  const dom = setupDom()
  const rig = new ActorRig(spec, { blink: false, micro: { amount: 0 } })
  rig.mount(dom.host)
  const el = (sel) => dom.host.querySelector(sel)
  const tf = (sel) => el(sel)?.style.transform ?? ''
  return { ...dom, rig, el, tf, svg: () => dom.host.querySelector('svg') }
}

const rotOf = (transform) => Number(/rotate\((-?[\d.]+)deg\)/.exec(transform)?.[1] ?? 0)

test('roozi walks: the legs move, out of phase, from the shared tick loop', () => {
  const t = mount(CHARACTERS.roozi)
  try {
    t.rig.apply({ locomotion: 'walk', speed: 1 })
    t.advance(200)

    const near = rotOf(t.tf('.lyr-nearLeg'))
    const far = rotOf(t.tf('.lyr-farLeg'))
    assert.ok(near !== 0 || far !== 0, 'the legs never moved')
    assert.ok(Math.abs(near + far) < 0.02, `legs should be opposed, got ${near} / ${far}`)

    // And it keeps going: a second sample at a different phase differs.
    t.advance(112)
    assert.notEqual(rotOf(t.tf('.lyr-nearLeg')), near, 'the cycle stalled after one sample')
  } finally { t.restore() }
})

test('boomi flies: the wings beat, mirrored, with no CSS animation involved', () => {
  const t = mount(CHARACTERS.boomi)
  try {
    t.rig.apply({ locomotion: 'fly', speed: 1 })
    t.advance(200)

    const far = rotOf(t.tf('.lyr-farArm'))
    const near = rotOf(t.tf('.lyr-nearArm'))
    assert.ok(far !== 0, 'the wings never beat')
    assert.ok(Math.abs(far + near) < 0.02, `wings should mirror, got ${far} / ${near}`)
    assert.equal(t.el('.lyr-farArm').style.animation, '', 'a driven wing must not also carry a CSS animation')
    assert.equal(t.svg().querySelectorAll('.wingL, .wingR').length, 0)
  } finally { t.restore() }
})

test('a driven character gets no CSS body animation, only the phase table', () => {
  const t = mount(CHARACTERS.roozi)
  try {
    t.rig.apply({ locomotion: 'walk' })
    t.advance(100)
    // Without the gate this doubles the bob: the root would carry caWalk *and*
    // the driver's inline transform, and the CSS would win outright.
    assert.equal(t.el('.rig-root').style.animation, '', 'the fallback body animation is still running')
    assert.notEqual(t.tf('.rig-root'), '', 'and the driver is producing the bob instead')
    assert.notEqual(t.tf('.rig-root'), 'none')
  } finally { t.restore() }
})

test('simorgh has no limb layers, so it falls back to the CSS body animation', () => {
  const t = mount(CHARACTERS.simorgh)
  try {
    t.rig.apply({ locomotion: 'fly' })
    t.advance(100)
    assert.match(t.el('.rig-root').style.animation, /caFly/, 'the unlayered fallback stopped working')
    assert.ok(t.svg().classList.contains('loco-fly'), 'and it still needs the class for the wing rules')
    assert.ok(t.svg().querySelector('.wingL'), 'simorgh still uses the old wing hooks')
  } finally { t.restore() }
})

test('stopping clears the stride instead of freezing mid-step', () => {
  const t = mount(CHARACTERS.roozi)
  try {
    t.rig.apply({ locomotion: 'walk' })
    t.advance(180)
    assert.notEqual(rotOf(t.tf('.lyr-nearLeg')), 0)

    t.rig.apply({ locomotion: 'idle' })
    t.advance(200)
    assert.equal(rotOf(t.tf('.lyr-nearLeg')), 0, 'the leg stayed mid-stride after stopping')
    assert.equal(rotOf(t.tf('.lyr-farLeg')), 0)
  } finally { t.restore() }
})

test('posture keeps driving the limbs while walking — the whole point', () => {
  // This is the regression the CSS version could not fix: an @keyframes
  // animation outranks the inline transform, so a sad character used to walk
  // with neutral arms. Now gait and posture are two sources that add.
  const t = mount(CHARACTERS.roozi)
  try {
    t.rig.apply({ emotion: 'neutral', intensity: 1, locomotion: 'walk' })
    t.advance(112)
    const neutral = rotOf(t.tf('.lyr-farArm'))

    const s = mount(CHARACTERS.roozi)
    try {
      s.rig.apply({ emotion: 'sad', intensity: 1, locomotion: 'walk' })
      s.advance(112)
      const sad = rotOf(s.tf('.lyr-farArm'))
      // Same phase (same elapsed time, same rate), so any difference is posture.
      assert.notEqual(sad, neutral, 'posture stopped reaching the arm during a walk')
    } finally { s.restore() }
  } finally { t.restore() }
})

test('locomotion still honours its 60ms delay before the feet commit', () => {
  const t = mount(CHARACTERS.roozi)
  try {
    t.rig.apply({ locomotion: 'walk' })
    t.advance(48)
    assert.equal(rotOf(t.tf('.lyr-nearLeg')), 0, 'the feet committed before the 60ms delay elapsed')
    t.advance(64)
    assert.notEqual(rotOf(t.tf('.lyr-nearLeg')), 0, 'and then they must commit')
  } finally { t.restore() }
})

// ---------------------------------------------- the choreography, not just safety ---

/**
 * The tests above prove the driver runs safely; these prove it produces the
 * *spec's* walk and wingbeat. A gait that never crashed and never looked right
 * would pass every one of them and fail every one of these.
 */

// ------------------------------------------- per-character spec conformance ---

/**
 * Spec conformance is checked **per character**, not inherited.
 *
 * A character can run cleanly and still not match the choreography — that is
 * exactly what happened when the shipped fly table quietly used a 0.34
 * downstroke and no wing-fold. Every layered character that a gait can drive is
 * put through the named phase points here, in the DOM, with the real rig.
 */
const LAYERED = Object.values(CHARACTERS).filter(
  (c) => !!c.render({ emotion: { squint: 0, wide: 0, brow: 0 }, intensity: 0 }).layers,
)
const layersOf = (c) => c.render({ emotion: { squint: 0, wide: 0, brow: 0 }, intensity: 0 }).layers ?? {}
const hasTarget = (c) => (t) => t === 'root' || t === 'torso' || !!layersOf(c)[t]

// Eligibility is `drivesGait`, not `canDrive`: structure *and* declaration. A
// character that is structurally capable but undeclared belongs in FALLBACK, so
// deriving these from the same rule the rig uses is what makes the fallback
// loop below actually assert the allowlist rather than assume it.
const drives = (gait) => (c) => drivesGait(gait, hasTarget(c), c.gaits)
const WALKERS = LAYERED.filter(drives('walk'))
const FLIERS = LAYERED.filter(drives('fly'))
const FALLBACK = { walk: LAYERED.filter((c) => !drives('walk')(c)), fly: LAYERED.filter((c) => !drives('fly')(c)) }

const translateY = (tf) => Number(/translate\(-?[\d.]+px,(-?[\d.]+)px\)/.exec(tf)?.[1] ?? 0)
const scaleX = (tf) => Number(/scale\((-?[\d.]+),/.exec(tf)?.[1] ?? 1)

/**
 * Mount a character on a clock where one frame is exactly 1/64 of a cycle, then
 * step to the tick where the gait commits — that tick is phase 0. Returns a
 * `frame()` that advances exactly 1/64 cycle.
 */
function driveGait(spec, gait, watch, steps) {
  // `steps` must divide every named phase of the gait exactly, or the assertions
  // read the curve *between* the keys and miss by a fraction of a degree: 64
  // frames land on the walk's eighths, 40 on the fly's 0.4 and 0.7.
  for (const [name, at] of Object.entries(gait === 'walk' ? WALK_PHASES : FLY_PHASES)) {
    assert.ok(Number.isInteger(at * steps), `${steps} frames cannot land on ${name} (${at})`)
  }
  const cycleMs = 1000 / GAITS[gait].rate            // speed 1
  const dom = setupDom({ frameMs: cycleMs / steps })
  const rig = new ActorRig(spec, { blink: false, micro: { amount: 0 } })
  rig.mount(dom.host)
  const tf = (sel) => dom.host.querySelector(sel)?.style.transform ?? ''
  const frame = () => dom.advance(cycleMs / steps)

  rig.apply({ emotion: 'neutral', intensity: 1, locomotion: gait, speed: 1 })
  // An identity pose serialises to 'none', so "committed" means the watched
  // layer has actually taken a value, not merely that it has a transform.
  let guard = 0
  while (rotOf(tf(watch)) === 0 && guard++ < 60) frame()
  assert.ok(guard < 60, `${spec.slug}: the ${gait} never committed`)
  return { dom, rig, tf, frame, cycleMs, steps }
}

for (const spec of WALKERS) {
  test(`${spec.slug}: walk hits the spec angles at contact, down, pass and up`, () => {
    // Emotion is neutral, whose posture contributes 0 to every limb, so every
    // degree read below comes from the gait and nothing else.
    const t = driveGait(spec, 'walk', '.lyr-nearLeg', 64)
    try {
      const leg = () => rotOf(t.tf('.lyr-nearLeg'))
      const farLeg = () => rotOf(t.tf('.lyr-farLeg'))
      const arm = () => rotOf(t.tf('.lyr-nearArm'))
      const hasArms = !!layersOf(spec).nearArm

      assert.equal(leg(), 20, 'the cycle should begin at contact')
      const at = { contact: 0, down: 8, pass: 16, up: 24 }
      const expect = {
        contact: { leg: 20, arm: -14 },
        down: { leg: 12, arm: -8 },
        pass: { leg: 0, arm: 0 },
        up: { leg: -12, arm: 8 },
      }

      let elapsed = 0
      for (const [name, f] of Object.entries(at)) {
        while (elapsed < f) { t.frame(); elapsed++ }
        assert.equal(WALK_PHASES[name], f / 64, `${name} is φ ${f / 64}`)
        assert.equal(leg(), expect[name].leg, `${spec.slug} nearLeg at ${name} (φ ${f / 64})`)
        assert.equal(farLeg() || 0, -expect[name].leg || 0, `${spec.slug} farLeg at ${name}`)
        if (hasArms) assert.equal(arm(), expect[name].arm, `${spec.slug} nearArm at ${name}`)
      }

      // Half a cycle on the legs have swapped roles: this is the other foot's
      // contact, which is what makes one cycle a stride rather than a step.
      while (elapsed < 32) { t.frame(); elapsed++ }
      assert.equal(leg(), -20, `${spec.slug}: the other foot should strike at φ 0.5`)
      assert.equal(farLeg(), 20)

      // A full period later, everything is exactly back where it started.
      while (elapsed < 64) { t.frame(); elapsed++ }
      assert.equal(leg(), 20, `${spec.slug}: the cycle did not close after one period`)
      assert.equal(farLeg(), -20)
      if (hasArms) assert.equal(arm(), -14)
    } finally { t.dom.restore() }
  })

  test(`${spec.slug}: the body bobs twice per stride, in the DOM`, () => {
    const t = driveGait(spec, 'walk', '.lyr-nearLeg', 64)
    try {
      const ys = []
      for (let i = 0; i < 64; i++) { ys.push(translateY(t.tf('.rig-root'))); t.frame() }
      let peaks = 0
      for (let i = 0; i < 64; i++) {
        const prev = ys[(i - 1 + 64) % 64]
        const next = ys[(i + 1) % 64]
        if (ys[i] < prev && ys[i] <= next) peaks++
      }
      assert.equal(peaks, 2, `${spec.slug}: expected one rise per step, found ${peaks}`)
      assert.equal(ys[16], -4, 'highest at pass')
      assert.equal(ys[0], 0, 'lowest at contact, so the foot lands on the low point')
    } finally { t.dom.restore() }
  })

  test(`${spec.slug}: a speed change mid-stride is continuous`, () => {
    const t = driveGait(spec, 'walk', '.lyr-nearLeg', 64)
    try {
      for (let i = 0; i < 11; i++) t.frame()
      const before = rotOf(t.tf('.lyr-nearLeg'))
      // Land the speed channel instantly, so this is about phase and not about
      // `speed` easing over 400ms.
      t.rig.apply({ speed: 2 })
      t.rig.finish()
      assert.equal(rotOf(t.tf('.lyr-nearLeg')), before,
        `${spec.slug}: the leg jumped the instant the speed changed`)

      t.frame()
      const next = rotOf(t.tf('.lyr-nearLeg'))
      assert.notEqual(next, before, `${spec.slug}: the cycle stalled after the speed change`)
      // A reset would put the leg back at contact (+20). One frame at double
      // rate is 2/64 of a cycle — at most a few degrees.
      assert.ok(Math.abs(next - before) < 6,
        `${spec.slug}: discontinuous jump of ${Math.abs(next - before)} degrees`)
    } finally { t.dom.restore() }
  })
}

for (const spec of FLIERS) {
  test(`${spec.slug}: the wingbeat splits 40/60 and folds on the recovery`, () => {
    // The spec numbers are written out as literals here on purpose. Asserting
    // against FLY_PHASES/WING_FOLD_SX would move the expectation whenever the
    // table moves, so the test would pass on a wing that never folds. The
    // constants are pinned to the literals once, below, and used nowhere else.
    assert.equal(FLY_PHASES.top, 0)
    assert.equal(FLY_PHASES.bottom, 0.4, 'the downstroke is the first 40% of the beat')
    assert.equal(FLY_PHASES.fold, 0.7)
    assert.equal(WING_FOLD_SX, 0.82, 'the recovery folds the wing to 82% span')

    const t = driveGait(spec, 'fly', '.lyr-farArm', 40)
    try {
      const rot = () => rotOf(t.tf('.lyr-farArm'))
      const sx = () => scaleX(t.tf('.lyr-farArm'))

      assert.equal(rot(), -26, `${spec.slug}: the beat should start at the top`)
      assert.equal(sx(), 1, 'and at full span')

      // The power stroke: monotonic down, full span throughout, frames 0..16 of
      // 40 — that is phase 0 to 0.4.
      let prev = rot()
      for (let i = 1; i <= 16; i++) {
        t.frame()
        assert.ok(rot() >= prev - 1e-9, `${spec.slug}: the downstroke reversed at frame ${i}`)
        assert.equal(sx(), 1, `${spec.slug}: the wing folded during the power stroke`)
        prev = rot()
      }
      assert.equal(rot(), 16, `${spec.slug}: wing down at phase 0.4`)

      // The recovery, frames 16..28 — phase 0.4 to 0.7, where the fold is deepest.
      for (let i = 16; i < 28; i++) t.frame()
      assert.equal(rot(), -6, `${spec.slug}: wing angle at the fold`)
      assert.equal(sx(), 0.82, `${spec.slug}: the wing never folded on the recovery`)

      // ...and unfolded again by the top, frames 28..40.
      for (let i = 28; i < 40; i++) t.frame()
      assert.equal(rot(), -26, `${spec.slug}: the beat did not close on itself`)
      assert.equal(sx(), 1, `${spec.slug}: the wing never unfolded`)
    } finally { t.dom.restore() }
  })

  test(`${spec.slug}: both wings beat mirrored, with no CSS animation`, () => {
    const t = driveGait(spec, 'fly', '.lyr-farArm', 40)
    try {
      for (let i = 0; i < 20; i++) {
        t.frame()
        const f = rotOf(t.tf('.lyr-farArm'))
        const n = rotOf(t.tf('.lyr-nearArm'))
        assert.ok(Math.abs(f + n) < 0.02, `${spec.slug}: wings not mirrored (${f} / ${n})`)
      }
      assert.equal(t.dom.host.querySelector('.lyr-farArm').style.animation, '',
        `${spec.slug}: a driven wing must not also carry a CSS animation`)
      assert.equal(t.dom.host.querySelectorAll('.wingL, .wingR').length, 0,
        `${spec.slug}: a converted character must not keep the old wing hooks`)
    } finally { t.dom.restore() }
  })
}

// A character missing the limbs a gait needs keeps the old CSS body animation.
// Both gaits are covered: pashmak has neither legs nor wings, so it is the only
// character that exercises the fly half of this branch.
for (const [gait, specs] of Object.entries(FALLBACK)) {
  const css = gait === 'walk' ? /caWalk/ : /caFly/
  for (const spec of specs) {
    test(`${spec.slug}: cannot drive ${gait}, so it falls back to the CSS body animation`, () => {
      const dom = setupDom()
      const rig = new ActorRig(spec, { blink: false, micro: { amount: 0 } })
      rig.mount(dom.host)
      try {
        rig.apply({ locomotion: gait })
        dom.advance(200)
        assert.match(dom.host.querySelector('.rig-root').style.animation, css,
          `${spec.slug}: the fallback body animation should be running`)
        assert.ok(dom.host.querySelector('svg').classList.contains(`loco-${gait}`),
          `${spec.slug}: the state marker class is still owed to consumers`)
        // The driver must not be writing a bob on top of the CSS one.
        const tf = dom.host.querySelector('.rig-root').style.transform
        assert.ok(tf === '' || tf === 'none',
          `${spec.slug}: driver and CSS are both moving the body (${tf})`)
      } finally { dom.restore() }
    })
  }
}

// Both halves of the AND, on fixtures: no shipped character currently declares
// a gait it cannot structurally perform, so the roster alone cannot show that
// the structural half still bites.
test('drivesGait is structure AND declaration, and each half can veto alone', () => {
  const all = () => true
  const none = () => false
  assert.equal(drivesGait('walk', all, ['walk']), true)
  assert.equal(drivesGait('walk', none, ['walk']), false, 'declaration must not override missing legs')
  assert.equal(drivesGait('walk', all, ['fly']), false, 'a different gait is not a licence')
  assert.equal(drivesGait('walk', all, []), false, 'empty means nothing is driven')
  assert.equal(drivesGait('walk', all, undefined), false, 'omitted means nothing is driven')
})

// The allowlist's whole reason to exist: لاکی's back flippers occupy the arm
// slots, so the wingbeat's structural check passes. Only the declaration stops
// it. Asserted on the real character rather than a fixture, because the thing
// under test is لاکی's config as shipped.
test('laki is structurally able to fly and is still never driven into a wingbeat', () => {
  const laki = CHARACTERS.laki
  assert.equal(canDrive('fly', hasTarget(laki)), true,
    'precondition: if the arm slots ever empty out, this test stops proving anything')
  assert.ok(!laki.gaits.includes('fly'), 'laki must not declare fly')
  assert.equal(drivesGait('fly', hasTarget(laki), laki.gaits), false)

  const dom = setupDom()
  const rig = new ActorRig(laki, { blink: false, micro: { amount: 0 } })
  rig.mount(dom.host)
  try {
    rig.apply({ locomotion: 'fly' })
    dom.advance(600)
    const sx = (sel) => scaleX(dom.host.querySelector(sel).style.transform)
    // A driven wingbeat folds the wings to WING_FOLD_SX; an undriven arm is
    // left at identity for the CSS body animation to move as one piece.
    assert.equal(sx('.lyr-farArm'), 1, 'laki is being wingbeat-driven')
    assert.equal(sx('.lyr-nearArm'), 1, 'laki is being wingbeat-driven')
    assert.match(dom.host.querySelector('.rig-root').style.animation, /caFly/,
      'the CSS fallback should be carrying the float instead')
  } finally { dom.restore() }
})

test('every converted character declares its gaits explicitly', () => {
  // Omitted means "no gait driven", which is the safe default but a silent one.
  // A layered character has been through conversion, so the decision was made.
  for (const c of LAYERED) {
    assert.ok(Array.isArray(c.gaits), `${c.slug}: layered but declares no gaits list`)
  }
})

test('the conformance loops above cover something', () => {
  // Guards against the loops silently degenerating to zero characters.
  assert.ok(WALKERS.length >= 1, 'no walkers')
  assert.ok(FLIERS.length >= 2, 'no fliers')
  assert.ok(FALLBACK.walk.length >= 1, 'nothing exercises the walk fallback')
  assert.ok(FALLBACK.fly.length >= 1, 'nothing exercises the fly fallback')
  assert.ok(LAYERED.length >= 3, `only ${LAYERED.length} layered characters`)
})

test('the far leg is the near leg offset by exactly half a cycle', () => {
  // Not "roughly opposite" — the same curve, shifted. Sampled off the key grid
  // too, so this constrains the interpolation and not just the eight keys.
  const near = GAITS.walk.tracks.nearLeg
  const far = GAITS.walk.tracks.farLeg
  for (let p = 0; p < 1; p += 1 / 64) {
    const a = samplePhase(far, p).rot
    const b = samplePhase(near, p + 0.5).rot
    assert.ok(Math.abs(a - b) < 1e-9, `farLeg(${p.toFixed(4)})=${a} but nearLeg(+0.5)=${b}`)
  }
})

test('the arms swing opposite their own leg for the whole cycle', () => {
  for (let p = 0; p < 1; p += 1 / 64) {
    const nl = samplePhase(GAITS.walk.tracks.nearLeg, p).rot
    const na = samplePhase(GAITS.walk.tracks.nearArm, p).rot
    const fl = samplePhase(GAITS.walk.tracks.farLeg, p).rot
    const fa = samplePhase(GAITS.walk.tracks.farArm, p).rot
    assert.ok(nl * na <= 1e-12, `near arm swings with its own leg at ${p.toFixed(3)}`)
    assert.ok(fl * fa <= 1e-12, `far arm swings with its own leg at ${p.toFixed(3)}`)
  }
})

test('the body bobs twice per stride — once per step, not once per cycle', () => {
  // Sample a whole cycle and count the local minima of y (negative y is up).
  const root = GAITS.walk.tracks.root
  const N = 400
  const ys = []
  for (let i = 0; i < N; i++) ys.push(samplePhase(root, i / N).y)

  let peaks = 0
  for (let i = 0; i < N; i++) {
    const prev = ys[(i - 1 + N) % N]
    const cur = ys[i]
    const next = ys[(i + 1) % N]
    if (cur < prev && cur <= next) peaks++
  }
  assert.equal(peaks, 2, `expected one rise per step (2 per stride), found ${peaks}`)

  // And they are at the pass positions, where the support leg is vertical.
  assert.equal(samplePhase(root, WALK_PHASES.pass).y, -4)
  assert.equal(samplePhase(root, WALK_PHASES.pass + 0.5).y, -4)
  // Lowest at contact, so the foot lands on the low point rather than mid-air.
  assert.equal(samplePhase(root, WALK_PHASES.contact).y, 0)
  assert.equal(samplePhase(root, WALK_PHASES.contact + 0.5).y, 0)
})

test('the wingbeat splits 40/60 into downstroke and recovery, with the spec angles', () => {
  const far = GAITS.fly.tracks.farArm
  assert.equal(samplePhase(far, FLY_PHASES.top).rot, -26, 'wing raised at the top')
  assert.equal(samplePhase(far, FLY_PHASES.bottom).rot, 16, 'wing down at the bottom')
  assert.equal(FLY_PHASES.bottom, 0.4, 'the downstroke is the first 40% of the cycle')

  // The downstroke is monotonic: the power stroke does not hesitate.
  let prev = -Infinity
  for (let p = 0; p <= FLY_PHASES.bottom; p += 0.01) {
    const r = samplePhase(far, p).rot
    assert.ok(r >= prev - 1e-9, `the downstroke reversed at φ ${p.toFixed(2)}`)
    prev = r
  }
  // And the recovery takes the remaining 60%, returning to the top.
  assert.ok(samplePhase(far, 0.999).rot < samplePhase(far, FLY_PHASES.fold).rot,
    'the recovery should still be rising at the end of the cycle')
  assert.ok(Math.abs(samplePhase(far, 0.9999).rot - (-26)) < 0.05,
    'the wing must be back at the top when the cycle wraps')
})

test('the wing folds on the recovery and only on the recovery', () => {
  const far = GAITS.fly.tracks.farArm
  assert.equal(samplePhase(far, FLY_PHASES.fold).sx, WING_FOLD_SX, 'folded at mid-recovery')
  assert.equal(WING_FOLD_SX, 0.82)

  // Flat at full span across the whole power stroke — that is the stroke that
  // needs area. A fold here would push the bird back down.
  for (let p = 0; p <= FLY_PHASES.bottom; p += 0.02) {
    assert.equal(samplePhase(far, p).sx, 1, `the wing folded during the downstroke at φ ${p.toFixed(2)}`)
  }
  // And it is unfolded again by the top, or the next downstroke has no span.
  assert.ok(Math.abs(samplePhase(far, 0.9999).sx - 1) < 0.005, 'the wing never unfolded')
  // Both wings fold together; a one-sided fold reads as an injury.
  assert.equal(samplePhase(GAITS.fly.tracks.nearArm, FLY_PHASES.fold).sx, WING_FOLD_SX)
})

test('boomi actually renders the fold and the beat in the DOM', () => {
  const t = mount(CHARACTERS.boomi)
  try {
    t.rig.apply({ locomotion: 'fly', speed: 1 })
    // 2.5 cycles/s: after the 60ms commit delay, sample across a beat and check
    // the wing both swings and narrows at some point in it.
    const rots = []
    const sxs = []
    for (let i = 0; i < 40; i++) {
      t.advance(16)
      const tf = t.tf('.lyr-farArm')
      rots.push(rotOf(tf))
      sxs.push(Number(/scale\((-?[\d.]+),/.exec(tf)?.[1] ?? 1))
    }
    assert.ok(Math.max(...rots) > 10, `the wing never reached the bottom: max ${Math.max(...rots)}`)
    assert.ok(Math.min(...rots) < -20, `the wing never reached the top: min ${Math.min(...rots)}`)
    assert.ok(Math.min(...sxs) < 0.9, `the wing never folded: min sx ${Math.min(...sxs)}`)
    assert.ok(Math.max(...sxs) > 0.99, `the wing never unfolded: max sx ${Math.max(...sxs)}`)
  } finally { t.restore() }
})

test('a speed change mid-cycle is continuous — no pop, no reset', () => {
  // The whole argument for leaving CSS keyframes: changing animation-duration
  // restarts the animation, so a character that sped up mid-stride snapped both
  // feet back to the top of the cycle.
  const t = mount(CHARACTERS.roozi)
  try {
    t.rig.apply({ locomotion: 'walk', speed: 1 })
    t.advance(200)
    const before = rotOf(t.tf('.lyr-nearLeg'))

    // Land the speed channel instantly so the comparison is about phase, not
    // about `speed` easing over 400ms.
    t.rig.apply({ speed: 2 })
    t.rig.finish()
    const after = rotOf(t.tf('.lyr-nearLeg'))
    assert.equal(after, before, 'the leg jumped the instant the speed changed')

    // One frame later it has moved — faster than before, but from where it was.
    t.advance(16)
    const next = rotOf(t.tf('.lyr-nearLeg'))
    assert.notEqual(next, before, 'the cycle stalled after the speed change')
    // A reset to φ 0 would put the leg at +20 (contact). Anything but that.
    assert.ok(Math.abs(next - 20) > 1e-9 || Math.abs(before - 20) < 1e-9,
      'the leg landed exactly on contact — that is a phase reset, not continuity')
    // The step is bounded by the new rate: 2 cycles/s x2 x 16ms = 0.064 cycle,
    // at most ~10 degrees of leg travel. A reset would be a jump of up to 40.
    assert.ok(Math.abs(next - before) < 12, `discontinuous jump of ${Math.abs(next - before)} degrees`)
  } finally { t.restore() }
})

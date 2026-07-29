import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FrameInterpolator, DEFAULT_PROFILE, EASINGS, defaultFrame,
} from '../dist/index.js'

const base = () => defaultFrame('roozi')
const near = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b} (tol ${tol})`)

// ---------------------------------------------------------------- easing ---

test('easing curves hit their endpoints', () => {
  for (const [name, fn] of Object.entries(EASINGS)) {
    near(fn(0), 0, 1e-9, `${name}(0)`)
    near(fn(1), 1, 1e-9, `${name}(1)`)
  }
})

test('easeOutBack overshoots past 1 before settling', () => {
  const peak = Math.max(...Array.from({ length: 99 }, (_, i) => EASINGS.easeOutBack((i + 1) / 100)))
  assert.ok(peak > 1, `expected overshoot, peak was ${peak}`)
})

test('easeOutQuint is ballistic — most distance covered in the first half', () => {
  assert.ok(EASINGS.easeOutQuint(0.5) > 0.9)
})

test('snap holds at 0 until t reaches 1', () => {
  assert.equal(EASINGS.snap(0.99), 0)
  assert.equal(EASINGS.snap(1), 1)
})

// -------------------------------------------------- continuous channels ---

test('gaze eases over its 90ms duration after an 18ms delay', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ gaze: { x: 1, y: 0 } })

  // Still inside the reaction delay.
  fi.tick(17)
  assert.equal(fi.current.gaze.x, 0, 'must not move during delay')

  fi.tick(1)   // t = 18, delay exactly elapsed
  assert.equal(fi.current.gaze.x, 0)

  fi.tick(45)  // halfway through the 90ms travel
  const mid = fi.current.gaze.x
  assert.ok(mid > 0.9 && mid < 1, `ballistic midpoint, got ${mid}`)

  fi.tick(45)  // complete
  assert.equal(fi.current.gaze.x, 1)
  assert.equal(fi.settling, false)
})

test('browRaise lags emotion by 90ms — the organic-reaction requirement', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ emotion: 'surprised', browRaise: 1 })

  fi.tick(16)
  assert.equal(fi.current.emotion, 'surprised', 'emotion snaps immediately')
  assert.equal(fi.current.browRaise, 0, 'brows have not started yet')

  fi.tick(73)  // t = 89, still one ms short of the delay
  assert.equal(fi.current.browRaise, 0)

  fi.tick(30)  // t = 119, moving now
  assert.ok(fi.current.browRaise > 0, 'brows follow after the emotion')

  fi.tick(400)
  assert.equal(fi.current.browRaise, 1)
})

test('viseme is instant — speech must never blur', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ viseme: 'aa' })
  assert.equal(fi.current.viseme, 'aa', 'lands without any tick at all')
  assert.equal(fi.settling, false)
})

// ------------------------------------------------------------ retargeting ---

test('retargeting mid-transition continues from the current value, not the origin', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ gaze: { x: 1, y: 0 } })
  fi.tick(18 + 45)
  const atRetarget = fi.current.gaze.x
  assert.ok(atRetarget > 0.9)

  fi.target({ gaze: { x: -1, y: 0 } })

  // The very next tick must depart from where we actually were. If the channel
  // had reset to its original `from` (0), the first sample would jump backward
  // past the retarget value discontinuously.
  fi.tick(18 + 1)
  const first = fi.current.gaze.x
  assert.ok(first < atRetarget, 'must head toward the new target')
  assert.ok(first > 0.5, `must not snap back to the stale origin, got ${first}`)

  fi.tick(200)
  assert.equal(fi.current.gaze.x, -1)
})

test('motion stays monotonic across a mid-flight retarget (no rubber-banding)', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ gaze: { x: 1, y: 0 } })
  fi.tick(30)
  const before = fi.current.gaze.x

  // Simulate an AI streaming updates faster than the transition completes.
  let prev = before
  for (let i = 0; i < 20; i++) {
    fi.target({ gaze: { x: 1, y: 0 } })  // same goal, re-sent
    fi.tick(8)
    assert.ok(fi.current.gaze.x >= prev, 're-sending the same goal must not stall or reverse')
    prev = fi.current.gaze.x
  }
  assert.ok(prev > before)
})

test('re-sending an unchanged goal does not re-arm the delay', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ browRaise: 1 })
  fi.tick(89)
  fi.target({ browRaise: 1 })   // identical — must be a no-op
  fi.tick(2)
  assert.ok(fi.current.browRaise > 0, 'delay was restarted, so the brows never move')
})

// --------------------------------------------------------------- epsilon ---

test('sub-epsilon changes snap instead of animating', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ browRaise: 0.0000005 })
  assert.equal(fi.settling, false, 'no animation scheduled')
  assert.equal(fi.current.browRaise, 0.0000005, 'but the value still lands')
})

test('a change just above epsilon does animate', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ browRaise: 0.01 })
  assert.equal(fi.settling, true)
  assert.equal(fi.current.browRaise, 0)
})

test('epsilon is configurable per channel', () => {
  const fi = new FrameInterpolator(base(), { browRaise: { duration: 300, epsilon: 0.5 } })
  fi.target({ browRaise: 0.4 })
  assert.equal(fi.settling, false, 'below the custom epsilon, so it snaps')
  assert.equal(fi.current.browRaise, 0.4)
})

// ------------------------------------------------------ discrete channels ---

test('discrete channels hold the old value then jump — never blend', () => {
  const fi = new FrameInterpolator(base())
  assert.equal(fi.current.locomotion, 'idle')
  fi.target({ locomotion: 'walk' })

  fi.tick(59)
  assert.equal(fi.current.locomotion, 'idle', 'holds through the 60ms delay')

  fi.tick(1)
  assert.equal(fi.current.locomotion, 'walk', 'then jumps outright')
})

test('discrete channels never produce an intermediate value', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ locomotion: 'walk', emotion: 'sad', facing: 'left' })
  const seen = { locomotion: new Set(), emotion: new Set(), facing: new Set() }
  for (let i = 0; i < 40; i++) {
    fi.tick(4)
    seen.locomotion.add(fi.current.locomotion)
    seen.emotion.add(fi.current.emotion)
    seen.facing.add(fi.current.facing)
  }
  for (const [k, s] of Object.entries(seen)) {
    for (const v of s) assert.ok(typeof v === 'string', `${k} produced a non-discrete value: ${v}`)
  }
  assert.ok(seen.locomotion.has('walk'))
})

test('gesture null round-trips as a discrete value', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ gesture: 'wave' })
  assert.equal(fi.current.gesture, 'wave')
  fi.target({ gesture: null })
  assert.equal(fi.current.gesture, null)
})

// -------------------------------------------------------------- clamping ---

test('0..1 channels clamp their goal', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ intensity: 5, mouthOpen: -3, browRaise: 99 })
  assert.equal(fi.goal.intensity, 1)
  assert.equal(fi.goal.mouthOpen, 0)
  assert.equal(fi.goal.browRaise, 1)
})

test('gaze clamps to -1..1 on both axes', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ gaze: { x: -9, y: 9 } })
  assert.equal(fi.goal.gaze.x, -1)
  assert.equal(fi.goal.gaze.y, 1)
})

test('interpolated values never leave the clamped range', () => {
  const fi = new FrameInterpolator(base())
  // easeOutBack overshoots, so browRaise is the channel that could escape.
  fi.target({ browRaise: 1 })
  for (let i = 0; i < 120; i++) {
    fi.tick(4)
    const v = fi.current.browRaise
    assert.ok(v >= 0 && v <= 1.12, `browRaise left a sane range: ${v}`)
  }
  assert.equal(fi.current.browRaise, 1)
})

test('non-finite input is rejected rather than poisoning the channel', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ intensity: NaN })
  assert.ok(Number.isFinite(fi.goal.intensity))
})

// -------------------------------------------------------- partial merging ---

test('a partial frame only retargets the channels it names', () => {
  const start = { ...base(), intensity: 0.5, browRaise: 0.5 }
  const fi = new FrameInterpolator(start)
  fi.target({ emotion: 'happy' })
  fi.tick(500)
  assert.equal(fi.current.intensity, 0.5, 'untouched channel is preserved')
  assert.equal(fi.current.browRaise, 0.5)
  assert.equal(fi.current.emotion, 'happy')
})

test('gaze partials set both axes together', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ gaze: { x: 0.5, y: -0.5 } })
  fi.tick(500)
  assert.equal(fi.current.gaze.x, 0.5)
  assert.equal(fi.current.gaze.y, -0.5)
})

// --------------------------------------------------------------- finish() ---

test('finish() lands every channel immediately', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ intensity: 0.9, gaze: { x: 1, y: 1 }, browRaise: 1, locomotion: 'walk', speed: 2 })
  assert.equal(fi.settling, true)

  fi.finish()

  assert.equal(fi.settling, false)
  const f = fi.current
  assert.equal(f.intensity, 0.9)
  assert.equal(f.gaze.x, 1)
  assert.equal(f.browRaise, 1)
  assert.equal(f.locomotion, 'walk')
  assert.equal(f.speed, 2)
  assert.deepEqual(f, fi.goal, 'current and goal converge exactly')
})

test('finish() mid-transition does not rewind', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ speed: 2 })
  fi.tick(200)
  const mid = fi.current.speed
  assert.ok(mid > 1 && mid < 2)
  fi.finish()
  assert.equal(fi.current.speed, 2)
})

test('ticking after settling is a no-op', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ intensity: 0.9 })
  fi.tick(1000)
  const a = fi.current
  fi.tick(1000)
  assert.deepEqual(fi.current, a)
})

// ---------------------------------------------------------------- profile ---

test('a custom profile overrides only the channels it names', () => {
  const fi = new FrameInterpolator(base(), { gazeX: { duration: 0, delay: 0 } })
  fi.target({ gaze: { x: 1, y: 1 } })
  fi.tick(1)
  assert.equal(fi.current.gaze.x, 1, 'overridden channel is instant')
  assert.equal(fi.current.gaze.y, 0, 'gazeY keeps the default 18ms delay')
})

test('a zero-duration profile makes everything snap (reduced-motion shape)', () => {
  const instant = Object.fromEntries(
    Object.keys(DEFAULT_PROFILE).map((k) => [k, { duration: 0, delay: 0 }]),
  )
  const fi = new FrameInterpolator(base(), instant)
  fi.target({ intensity: 1, gaze: { x: 1, y: 1 }, browRaise: 1, locomotion: 'walk' })
  fi.tick(1)
  assert.equal(fi.settling, false)
  assert.deepEqual(fi.current, fi.goal)
})

test('the documented default profile matches the reviewed spec', () => {
  assert.equal(DEFAULT_PROFILE.viseme.duration, 0)
  assert.equal(DEFAULT_PROFILE.gazeX.duration, 90)
  assert.equal(DEFAULT_PROFILE.gazeX.delay, 18)
  assert.equal(DEFAULT_PROFILE.gazeY.delay, 18)
  assert.equal(DEFAULT_PROFILE.gazeX.easing, 'easeOutQuint')
  assert.equal(DEFAULT_PROFILE.browRaise.duration, 300)
  assert.equal(DEFAULT_PROFILE.browRaise.delay, 90)
  assert.equal(DEFAULT_PROFILE.browRaise.easing, 'easeOutBack')
  assert.equal(DEFAULT_PROFILE.intensity.duration, 260)
  assert.equal(DEFAULT_PROFILE.speed.duration, 400)
  assert.equal(DEFAULT_PROFILE.locomotion.delay, 60)
})

// ------------------------------------------------------------- robustness ---

test('a zero or negative dt does not advance time', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ speed: 2 })
  fi.tick(0)
  fi.tick(-100)
  assert.equal(fi.current.speed, 1)
})

test('one huge dt completes rather than overshooting', () => {
  const fi = new FrameInterpolator(base())
  fi.target({ intensity: 1, browRaise: 1, speed: 2 })
  fi.tick(1e6)
  assert.equal(fi.settling, false)
  assert.deepEqual(fi.current, fi.goal)
})

// ------------------------------------------------- realistic frame traffic ---

test('a constantly-moving gaze does not re-arm the other channels', () => {
  // The failure this guards: if target()'s no-op check were whole-frame rather
  // than per-channel, a real performance — which resends `gaze` on almost every
  // tick while `emotion` holds for seconds — would restart browRaise's 90ms
  // delay every 16ms, and the brows would never move at all.
  const fi = new FrameInterpolator(defaultFrame('roozi'))
  const held = { ...defaultFrame('roozi'), emotion: 'surprised', browRaise: 1 }
  fi.target(held)

  let t = 0
  const dt = 16
  // 390ms is browRaise's full 90ms delay + 300ms travel. Note the driver
  // resends the *whole* frame every tick — emotion and browRaise unchanged,
  // gaze moving — which is what makes this a per-channel question rather than
  // a partial-frame one.
  while (t < 390) {
    fi.target({ ...held, gaze: { x: Math.sin(t / 40), y: Math.cos(t / 55) * 0.5 } })
    fi.tick(dt)
    t += dt
  }

  assert.ok(
    fi.current.browRaise > 0.99,
    `browRaise was starved by gaze traffic: reached only ${fi.current.browRaise.toFixed(3)}`,
  )
})

test('browRaise under gaze traffic tracks the same curve as in isolation', () => {
  // Stronger than "it eventually arrives": the gaze traffic must not perturb
  // the curve at all, at any point along it.
  const quiet = new FrameInterpolator(defaultFrame('roozi'))
  const noisy = new FrameInterpolator(defaultFrame('roozi'))
  const held = { ...defaultFrame('roozi'), browRaise: 1 }
  quiet.target(held)
  noisy.target(held)

  for (let i = 0; i < 30; i++) {
    noisy.target({ ...held, gaze: { x: (i % 7) / 7, y: -(i % 5) / 5 } })
    quiet.tick(16)
    noisy.tick(16)
    assert.equal(
      noisy.current.browRaise, quiet.current.browRaise,
      `browRaise diverged at tick ${i}`,
    )
  }
})

test('holding an emotion while gaze moves never re-triggers the emotion', () => {
  const fi = new FrameInterpolator(defaultFrame('roozi'))
  fi.target({ emotion: 'sad' })
  fi.tick(16)
  assert.equal(fi.current.emotion, 'sad')

  // Resend the full frame every tick, exactly as a naive driver would.
  for (let i = 0; i < 20; i++) {
    fi.target({ ...fi.goal, gaze: { x: i / 20, y: 0 } })
    fi.tick(16)
    assert.equal(fi.current.emotion, 'sad', `emotion flickered at tick ${i}`)
  }
})

test('only the channels named in a partial frame are retargeted', () => {
  // The per-channel guarantee, stated directly.
  const fi = new FrameInterpolator(defaultFrame('roozi'))
  fi.target({ browRaise: 1, intensity: 1 })
  fi.tick(200)
  const mid = fi.current.intensity
  assert.ok(mid > 0 && mid < 1, 'intensity should be mid-flight')

  fi.target({ gaze: { x: 1, y: 1 } })   // touches nothing else
  fi.tick(0)
  assert.equal(fi.current.intensity, mid, 'intensity must not have been disturbed')
  fi.tick(200)
  assert.equal(fi.current.intensity, 1, 'and must still complete on its original schedule')
})

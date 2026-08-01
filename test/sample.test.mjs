import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GESTURES, GESTURE_NAMES, buildAction, actionStops, poseToTransform,
  sampleAction, sampleActionFrames, frameCount, parseEasing, easeBezier, EASING_KEYWORDS,
} from '../dist/index.js'

/**
 * The equivalence guard.
 *
 * `sampleAction` exists because jsdom has no animation engine, so a batch
 * contact sheet cannot ask a browser what a gesture looks like at time t. That
 * makes it a second way to evaluate an action, and a second way to evaluate
 * something is a second thing that can be wrong — quietly, because a contact
 * sheet nobody diffs will happily depict an animation that does not ship.
 *
 * These tests pin the sampler to `buildAction`'s own emitted CSS: not to a
 * hand-written expectation, and not to `actionStops` (which both call, so
 * comparing to it would prove only that a function is deterministic). The CSS
 * string is what the browser is handed, so it is the right thing to agree with.
 */

// ── reading the shipped CSS back ─────────────────────────────────────────────

/** Parse a `transform` value that `poseToTransform` produced, back to a pose. */
function parseTransform(v) {
  const p = { x: 0, y: 0, rot: 0, rotY: 0, sx: 1, sy: 1 }
  if (v === 'none') return p
  const tr = /translate\((-?[\d.]+)px,(-?[\d.]+)px\)/.exec(v)
  if (tr) { p.x = Number(tr[1]); p.y = Number(tr[2]) }
  const rot = /(?:^|\s)rotate\((-?[\d.]+)deg\)/.exec(v)
  if (rot) p.rot = Number(rot[1])
  const rotY = /rotateY\((-?[\d.]+)deg\)/.exec(v)
  if (rotY) p.rotY = Number(rotY[1])
  const sc = /scale\((-?[\d.]+),(-?[\d.]+)\)/.exec(v)
  if (sc) { p.sx = Number(sc[1]); p.sy = Number(sc[2]) }
  return p
}

/** The `[t, pose]` table a browser would actually receive, read out of the CSS. */
function stopsFromCss(name, action) {
  // The rule name goes into a CSS identifier, so the label is sanitised rather
  // than passed through — a name with a `.` in it makes `buildAction` emit a
  // rule no stylesheet would accept.
  const { css } = buildAction(`t_${name.replace(/[^\w-]/g, '_')}`, action)
  const body = /^@keyframes [\w-]+\{(.*)\}$/s.exec(css)
  assert.ok(body, `buildAction produced markup this test cannot read: ${css.slice(0, 80)}`)
  const out = []
  for (const m of body[1].matchAll(/([\d.]+)%\{transform:([^}]*)\}/g)) {
    out.push([Number(m[1]) / 100, parseTransform(m[2])])
  }
  return out
}

/** Every action that ships: each gesture's parts plus its whole-body fallback. */
function shippedActions() {
  const out = []
  for (const g of GESTURE_NAMES) {
    const def = GESTURES[g]
    def.parts.forEach((p, i) => out.push([`${g}.${p.layer}#${i}`, p.action]))
    if (def.fallback) out.push([`${g}.fallback`, def.fallback.action])
  }
  return out
}

const CHANNELS = ['x', 'y', 'rot', 'rotY', 'sx', 'sy']

test('the parser round-trips every stop poseToTransform emits', () => {
  // If this drifts, every assertion below is comparing against a misreading
  // rather than against the CSS, and would keep passing while meaning nothing.
  let checked = 0
  for (const [, action] of shippedActions()) {
    for (const [, pose] of actionStops(action)) {
      const back = parseTransform(poseToTransform(pose))
      for (const c of CHANNELS) {
        const want = pose[c] ?? (c === 'sx' || c === 'sy' ? 1 : 0)
        assert.ok(Math.abs(back[c] - want) < 1e-3,
          `${c}: ${poseToTransform(pose)} read back as ${back[c]}, not ${want}`)
      }
      checked++
    }
  }
  assert.ok(checked > 50, `only ${checked} stops round-tripped — the sweep found almost nothing`)
})

test('sampleAction matches the shipped CSS exactly at every keyframe stop', () => {
  let checked = 0
  for (const [name, action] of shippedActions()) {
    const stops = stopsFromCss(name, action)
    assert.ok(stops.length >= 3, `${name}: only ${stops.length} stops in the emitted CSS`)
    for (const [t, want] of stops) {
      const got = sampleAction(action, t)
      for (const c of CHANNELS) {
        // 1e-3 is the rounding `poseToTransform` applies on the way out; the
        // sampler reads unrounded stops, so that is the whole expected gap.
        assert.ok(Math.abs(got[c] - want[c]) <= 1.1e-3,
          `${name} @${(t * 100).toFixed(1)}%: ${c} sampled ${got[c]}, CSS says ${want[c]}`)
      }
      checked++
    }
  }
  assert.ok(checked > 50, `only ${checked} stops compared`)
})

test('between stops the sampler stays inside the two poses it is blending', () => {
  // Not a browser prediction — CSS may take a matrix path when the transform
  // function lists differ. But a lerp that leaves the interval between its own
  // endpoints is wrong under any interpolation, so this is checkable.
  for (const [name, action] of shippedActions()) {
    const stops = actionStops(action)
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0, p0] = stops[i]
      const [t1, p1] = stops[i + 1]
      for (const f of [0.15, 0.4, 0.6, 0.85]) {
        const got = sampleAction(action, t0 + (t1 - t0) * f)
        for (const c of CHANNELS) {
          const id = c === 'sx' || c === 'sy' ? 1 : 0
          const a = p0[c] ?? id
          const b = p1[c] ?? id
          const lo = Math.min(a, b) - 1e-6
          const hi = Math.max(a, b) + 1e-6
          assert.ok(got[c] >= lo && got[c] <= hi,
            `${name} between ${t0.toFixed(3)} and ${t1.toFixed(3)}: ${c}=${got[c]} outside [${lo},${hi}]`)
        }
      }
    }
  }
})

test('the sampler eases per segment, the way a CSS animation-timing-function does', () => {
  // A single `ease-in-out` on the rule applies between *each* pair of
  // keyframes, not once across the whole animation. Sampling the exact midpoint
  // of a segment must therefore land on the segment's own midpoint — which is
  // 0.5 for a symmetric curve — rather than somewhere along a global ease.
  const action = { dur: 1, poses: [{ y: 10 }, { y: 20 }], anticipation: 0, settle: 0 }
  const stops = actionStops(action)
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, p0] = stops[i]
    const [t1, p1] = stops[i + 1]
    const mid = sampleAction(action, (t0 + t1) / 2)
    const want = ((p0.y ?? 0) + (p1.y ?? 0)) / 2
    assert.ok(Math.abs(mid.y - want) < 1e-6,
      `segment ${i}: midpoint sampled y=${mid.y}, expected the segment midpoint ${want}`)
  }
  // Linear must differ from eased somewhere, or the easing is not being applied
  // at all and the test above would pass on a symmetry coincidence.
  const linear = { ...action, ease: 'linear' }
  const off = [0.2, 0.35, 0.65, 0.8].some((t) =>
    Math.abs(sampleAction(action, t).y - sampleAction(linear, t).y) > 1e-3)
  assert.ok(off, 'ease-in-out and linear sample identically — the curve is being ignored')
})

test('t clamps at both ends: an action plays once and holds nothing after it', () => {
  const [, action] = shippedActions()[0]
  const at0 = sampleAction(action, 0)
  const at1 = sampleAction(action, 1)
  for (const t of [-3, -0.001, 0]) assert.deepEqual(sampleAction(action, t), at0, `t=${t}`)
  for (const t of [1, 1.001, 12]) assert.deepEqual(sampleAction(action, t), at1, `t=${t}`)
  // Both ends are rest — the settle lands on identity and nothing is held.
  for (const c of CHANNELS) {
    const id = c === 'sx' || c === 'sy' ? 1 : 0
    assert.equal(at0[c], id, `t=0 is not the rest pose (${c}=${at0[c]})`)
    assert.equal(at1[c], id, `t=1 is not the rest pose (${c}=${at1[c]})`)
  }
})

test('the derived anticipation and settle are visible to the sampler', () => {
  // The point of the module. If sampling only ever returned authored poses,
  // every contact sheet built on it would be the hand-parked peak all over
  // again — the exact failure this replaces.
  const action = GESTURES.jump.parts[0].action
  const authored = new Set(action.poses.map((p) => JSON.stringify(p)))
  const antT = action.antTime ?? 0.18
  const ant = sampleAction(action, antT)
  assert.ok(ant.y > 0, `anticipation should load downward, sampled y=${ant.y}`)
  assert.ok(ant.sy < 1 && ant.sx > 1, 'anticipation should squash')
  assert.ok(!authored.has(JSON.stringify({ y: ant.y })),
    'the anticipation pose is one of the authored poses — nothing was derived')
})

test('frameCount and sampleActionFrames give a real-frame scrub grid', () => {
  const action = GESTURES.wave.parts[0].action
  const n = frameCount(action, 60)
  assert.equal(n, Math.round(action.dur * 60))
  const frames = sampleActionFrames(action, n)
  assert.equal(frames.length, n + 1, 'a scrub of n frames has n+1 endpoints')
  assert.equal(frames[0][0], 0)
  assert.equal(frames[frames.length - 1][0], 1)
  for (let i = 1; i < frames.length; i++) {
    assert.ok(frames[i][0] > frames[i - 1][0], 'the grid must advance monotonically')
  }
  // Every frame must agree with a direct sample at the same t.
  for (const [t, pose] of frames) assert.deepEqual(pose, sampleAction(action, t))
})

// ── easing ───────────────────────────────────────────────────────────────────

test('parseEasing understands what buildAction can actually emit', () => {
  assert.deepEqual(parseEasing(undefined), EASING_KEYWORDS['ease-in-out'],
    'an action with no `ease` inherits ease-in-out, and the sampler must agree')
  for (const [kw, bez] of Object.entries(EASING_KEYWORDS)) {
    assert.deepEqual(parseEasing(kw), bez)
    assert.deepEqual(parseEasing(`  ${kw} `), bez, 'whitespace should not defeat the lookup')
  }
  assert.deepEqual(parseEasing('cubic-bezier(0.1, 0.2, 0.3, 0.4)'), [0.1, 0.2, 0.3, 0.4])
  // Steps are not a bezier and must not be silently approximated by one.
  assert.equal(parseEasing('steps(4, end)'), null)
  assert.equal(parseEasing('nonsense'), null)
})

test('easeBezier is a well-behaved easing curve', () => {
  const eio = EASING_KEYWORDS['ease-in-out']
  assert.equal(easeBezier(eio, 0), 0)
  assert.equal(easeBezier(eio, 1), 1)
  assert.ok(Math.abs(easeBezier(eio, 0.5) - 0.5) < 1e-6, 'ease-in-out is symmetric about its midpoint')
  assert.ok(easeBezier(eio, 0.25) < 0.25, 'ease-in-out should start slow')
  assert.ok(easeBezier(eio, 0.75) > 0.75, 'ease-in-out should finish fast')
  let prev = -1
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const v = easeBezier(eio, t)
    assert.ok(v >= prev - 1e-9, `easing went backwards at t=${t}`)
    prev = v
  }
  // linear must be the identity, or every "linear differs from eased" check
  // elsewhere is comparing two curves that are both wrong.
  for (const t of [0.1, 0.33, 0.5, 0.9]) {
    assert.ok(Math.abs(easeBezier(EASING_KEYWORDS.linear, t) - t) < 1e-6)
  }
})

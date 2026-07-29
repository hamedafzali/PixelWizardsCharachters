import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GESTURES, GESTURE_NAMES, GESTURE_DURING, planGesture, gestureLayers,
  gaitDrivenLayers, conflictsWithGait, locoTargetLayer,
  EMOTIONS, EMOTION_LABELS, POSTURES, BLINK_STYLES, blinkStyle,
  IdleMicroMotion, brows, buildAction, CHARACTERS, CHARACTER_SLUGS,
  renderActorSVG, resolvePosture, defaultFrame, ActorRig,
} from '../dist/index.js'
import { setupDom } from './helpers/dom.mjs'

const LOCOS = ['idle', 'walk', 'fly']
const EMOTION_NAMES = Object.keys(EMOTIONS)
const NEW_EMOTIONS = ['confused', 'proud', 'shy']

/** The layered roster; سیمرغ is deliberately the unlayered fallback case. */
const LAYERED = CHARACTER_SLUGS.filter(
  (s) => !!CHARACTERS[s].render({ emotion: EMOTIONS.neutral, intensity: 0.7 }).layers,
)

/** Which rig layers a character actually emits, read off its rendered markup. */
function layersOf(slug) {
  const svg = renderActorSVG(CHARACTERS[slug], defaultFrame(slug), 200)
  return new Set([...svg.matchAll(/class="(lyr-[A-Za-z]+|rig-body|rig-root)"/g)].map((m) => m[1]))
}

// ═══════════════════════════════════════════════════ 1. gesture library ═════

test('every gesture in the type union is in the registry, and vice versa', () => {
  // The registry is typed `Record<Gesture, GestureDef>`, so a missing gesture is
  // a compile error — but an *extra* key, or a name that drifted, is not.
  assert.deepEqual(
    [...GESTURE_NAMES].sort(),
    ['bounce', 'clap', 'jump', 'nod', 'point', 'shake', 'shrug', 'spin', 'wave'],
  )
})

test('every gesture has at least one part, and every part has a real duration', () => {
  for (const g of GESTURE_NAMES) {
    const def = GESTURES[g]
    assert.ok(def.parts.length >= 1, `${g} has no parts`)
    for (const p of def.parts) {
      assert.ok(p.action.dur > 0, `${g}/${p.layer} has no duration`)
      assert.ok(p.action.poses.length >= 2, `${g}/${p.layer} is a single pose, not a gesture`)
    }
  }
})

test('every gesture that targets a limb layer has a whole-body fallback', () => {
  // The rule the fallback path depends on: a gesture may only require a limb if
  // there is something for a limbless character to do instead. Without this,
  // planGesture's "no fallback" branch would silently block پشمک's wave.
  for (const g of GESTURE_NAMES) {
    const needsLimb = gestureLayers(g).some((l) => l.startsWith('lyr-'))
    if (needsLimb) assert.ok(GESTURES[g].fallback, `${g} needs a limb but offers no fallback`)
  }
})

test('anticipation and settle are derived for every gesture, not authored per keyframe', () => {
  for (const g of GESTURE_NAMES) {
    for (const p of [...GESTURES[g].parts, GESTURES[g].fallback].filter(Boolean)) {
      const { css } = buildAction(`t_${g}_${p.layer}`, p.action)
      const stops = [...css.matchAll(/(\d+(?:\.\d+)?)%\s*\{/g)].map((m) => Number(m[1]))
      assert.ok(stops.length > p.action.poses.length,
        `${g}/${p.layer}: buildAction added no keyframes, so it inherited neither anticipation nor settle`)
      assert.equal(stops[0], 0, `${g}/${p.layer} must start from rest`)
      assert.equal(stops[stops.length - 1], 100, `${g}/${p.layer} must land back at rest`)
      assert.deepEqual(stops, stops.slice().sort((a, b) => a - b), 'keyframe stops must be monotonic')
    }
  }
})

test('the compatibility table is semantic only: airborne gestures are the exception', () => {
  // Built from the registry, then asserted against the *reasons*, so a change of
  // policy has to be a deliberate edit here rather than a silent table drift.
  const grounded = GESTURE_NAMES.filter((g) => !GESTURE_DURING[g].includes('fly'))
  assert.deepEqual(grounded.sort(), ['bounce', 'clap', 'jump'],
    'only pushing off the ground (jump/bounce) and a two-handed clap need footing')
  for (const g of GESTURE_NAMES) {
    assert.ok(GESTURE_DURING[g].includes('idle'), `${g} must be available at rest`)
  }
})

test('gait conflict is computed from what a gait tracks, not merely what it requires', () => {
  // The walk *requires* only legs, but it swings the arms too — so a wave during
  // a driven walk is a conflict even though no leg is involved.
  const walk = gaitDrivenLayers('walk')
  assert.ok(walk.has('lyr-nearArm'), 'walk tracks the arms; requires alone would miss them')
  assert.ok(!walk.has('lyr-head'), 'walk leaves the head alone, so a nod may play through it')
  assert.ok(conflictsWithGait('wave', 'walk'))
  assert.ok(!conflictsWithGait('nod', 'walk'))
  assert.ok(conflictsWithGait('shrug', 'fly'), 'wings are the arm layers')
  assert.ok(!conflictsWithGait('nod', 'fly'))
})

test('locoTargetLayer maps the two carrier targets away from the lyr- namespace', () => {
  assert.equal(locoTargetLayer('root'), 'rig-root')
  assert.equal(locoTargetLayer('nearArm'), 'lyr-nearArm')
})

test('planGesture separates a refusal from a substitution', () => {
  const all = () => true
  const none = () => false
  // Semantic: refused outright, whatever the anatomy.
  assert.deepEqual(planGesture('jump', 'fly', null, all), { mode: 'blocked', reason: 'semantic' })
  assert.deepEqual(planGesture('jump', 'fly', null, none), { mode: 'blocked', reason: 'semantic' })
  // Structural: substituted, never refused.
  assert.equal(planGesture('wave', 'idle', null, none).mode, 'fallback')
  assert.equal(planGesture('wave', 'idle', null, none).reason, 'missing-layer')
  // Busy: substituted, and distinguishable from missing.
  assert.equal(planGesture('wave', 'walk', 'walk', all).reason, 'gait-owns-layer')
  assert.equal(planGesture('wave', 'walk', null, all).mode, 'parts',
    'an undriven walk leaves the arms free')
})

test('a multi-part gesture falls back if *any* of its layers is missing', () => {
  const onlyFar = (l) => l !== 'lyr-nearArm'
  assert.equal(planGesture('clap', 'idle', null, onlyFar).mode, 'fallback',
    'one arm is not a clap')
  assert.equal(planGesture('clap', 'idle', null, () => true).parts.length, 2)
})

test('the two arms of a clap and a shrug are mirrored, not copied', () => {
  for (const g of ['clap', 'shrug']) {
    const [far, near] = GESTURES[g].parts
    assert.equal(far.parts, undefined)
    for (let i = 0; i < far.action.poses.length; i++) {
      const a = far.action.poses[i].rot, b = near.action.poses[i].rot
      if (a === undefined) continue
      assert.equal(b, -a, `${g} pose ${i}: arms must mirror, or they swing the same way`)
    }
  }
})

test('every gesture resolves on every character in every locomotion state', () => {
  // The full DOM-sampled matrix. Nothing here may throw, and every combination
  // must land in exactly one of: parts / fallback / semantic refusal.
  for (const slug of CHARACTER_SLUGS) {
    const has = (l) => layersOf(slug).has(l)
    for (const loco of LOCOS) {
      for (const g of GESTURE_NAMES) {
        const plan = planGesture(g, loco, null, has)
        assert.ok(['parts', 'fallback', 'blocked'].includes(plan.mode))
        if (plan.mode === 'blocked') {
          assert.ok(!GESTURE_DURING[g].includes(loco),
            `${slug}/${loco}/${g} was refused but is semantically allowed — that is a fallback gap`)
        } else {
          assert.ok(plan.parts.length >= 1)
        }
      }
    }
  }
})

test('a character may opt a gesture out of a limb it does have', () => {
  const all = () => true
  assert.equal(planGesture('nod', 'idle', null, all).mode, 'parts')
  const opted = planGesture('nod', 'idle', null, all, ['nod'])
  assert.equal(opted.mode, 'fallback')
  assert.equal(opted.reason, 'character-opt-out',
    'an opt-out must be distinguishable from a missing limb: they have different causes')
  assert.equal(planGesture('shake', 'idle', null, all, ['nod']).mode, 'parts',
    'the opt-out is per gesture, not per layer')
})

test('the opt-out reaches the DOM: لاکی nods with its body, روزی with its head', () => {
  const animatedLayers = (slug, gesture) => {
    const d = setupDom()
    try {
      const rig = new ActorRig(CHARACTERS[slug], { blink: false, micro: { amount: 0 } })
      rig.mount(d.host)
      rig.finish()
      const svg = d.host.querySelector('svg')
      rig.apply({ gesture })
      rig.finish()
      d.advance(32)
      return [...svg.querySelectorAll('*')]
        .filter((e) => /caG_/.test(e.style.animation || ''))
        .map((e) => e.getAttribute('class'))
    } finally { d.restore() }
  }
  assert.deepEqual(animatedLayers('roozi', 'nod'), ['lyr-head'],
    'a character with room to nod must nod with its head')
  assert.deepEqual(animatedLayers('laki', 'nod'), ['rig-body'],
    'لاکی declares the opt-out, and the rig must honour it')
  assert.deepEqual(animatedLayers('laki', 'shake'), ['lyr-head'],
    'and must not over-apply it to the other head gesture')
})

test('the structural mismatches are exactly the ones the roster predicts', () => {
  // Not a guess: derived from the emitted layers, and pinned so that giving
  // پشمک arms — or taking بومی\'s away — has to update this list on purpose.
  const armless = LAYERED.filter((s) => !layersOf(s).has('lyr-nearArm'))
  const headless = LAYERED.filter((s) => !layersOf(s).has('lyr-head'))
  assert.deepEqual(armless.sort(), ['khersi', 'pashmak', 'tondpa'],
    'the three characters with no arm layer take the fallback for wave/point/clap/shrug')
  assert.deepEqual(headless.sort(), ['boomi'],
    'بومی is one continuous form, so nod/shake fall back to the body')
})

test('the unlayered character takes the body path for every gesture it is allowed', () => {
  const has = (l) => layersOf('simorgh').has(l)
  for (const g of GESTURE_NAMES) {
    const plan = planGesture(g, 'idle', null, has)
    assert.equal(plan.parts[0].layer, 'rig-body', `${g} must reach سیمرغ through the body carrier`)
  }
})

test('a played gesture actually animates the planned layers in the DOM', () => {
  const d = setupDom()
  try {
    const rig = new ActorRig(CHARACTERS.roozi, { blink: false, micro: { amount: 0 } })
    rig.mount(d.host)
    rig.finish()
    const svg = d.host.querySelector('svg')
    rig.apply({ gesture: 'clap' })
    rig.finish()
    d.advance(32)
    const animated = [...svg.querySelectorAll('*')]
      .filter((e) => /caG_/.test(e.style.animation || ''))
      .map((e) => e.getAttribute('class'))
      .sort()
    assert.deepEqual(animated, ['lyr-farArm', 'lyr-nearArm'],
      'both arms must start in the same tick, or they drift a frame apart')
  } finally { d.restore() }
})

test('a semantically blocked gesture animates nothing and releases the channel', () => {
  const d = setupDom()
  try {
    const blocked = []
    const rig = new ActorRig(CHARACTERS.roozi, {
      blink: false, micro: { amount: 0 },
      onGestureBlocked: (g, reason) => blocked.push([g, reason]),
    })
    rig.mount(d.host)
    rig.apply({ locomotion: 'fly' })
    rig.finish()
    const svg = d.host.querySelector('svg')
    rig.apply({ gesture: 'jump' })
    rig.finish()
    d.advance(32)
    assert.equal([...svg.querySelectorAll('*')].filter((e) => /caG_/.test(e.style.animation || '')).length, 0)
    assert.deepEqual(blocked, [['jump', 'semantic']], 'the driver must be told, not left waiting')
    assert.equal(rig.goal.gesture, null, 'a refused gesture must not hold the channel')
  } finally { d.restore() }
})

// ═════════════════════════════════════════════════════ 2. emotion depth ═════

test('the three new emotions are complete: preset, label, posture, blink, brow', () => {
  for (const e of NEW_EMOTIONS) {
    assert.ok(EMOTIONS[e], `${e} has no preset`)
    assert.ok(EMOTION_LABELS[e], `${e} has no Persian label`)
    assert.ok(POSTURES[e], `${e} has no posture — it would read only in the face`)
    assert.ok(BLINK_STYLES[e], `${e} has no blink style`)
  }
})

test('each new emotion is further from every existing one than the closest existing pair', () => {
  // The bar is set by the roster itself rather than by a number chosen here:
  // happy/love are the most similar pair already shipping and are still
  // intentionally distinct, so anything at least that far apart is distinct too.
  const W = { squint: 1, wide: 1, gx: 1, gy: 1, spine: 1 / 12, sink: 1 / 8,
    headTilt: 1 / 14, headDrop: 1 / 6, ears: 1 / 40, tail: 1 / 25, arms: 1 / 22 }
  const vec = (n) => {
    const e = EMOTIONS[n], p = POSTURES[n] ?? {}
    return { squint: e.squint, wide: e.wide, mouth: e.mouth, brow: e.brow,
      gx: e.gaze?.x ?? 0, gy: e.gaze?.y ?? 0, spine: p.spine ?? 0, sink: p.sink ?? 0,
      headTilt: p.headTilt ?? 0, headDrop: p.headDrop ?? 0, ears: p.ears ?? 0,
      tail: p.tail ?? 0, arms: p.arms ?? 0 }
  }
  const dist = (a, b) => {
    let s = 0
    for (const k of Object.keys(W)) s += Math.abs(a[k] - b[k]) * W[k]
    if (a.mouth !== b.mouth) s += 0.6
    if (a.brow !== b.brow) s += 0.9
    return s
  }
  const V = Object.fromEntries(EMOTION_NAMES.map((n) => [n, vec(n)]))
  const OLD = EMOTION_NAMES.filter((n) => !NEW_EMOTIONS.includes(n))
  let bar = Infinity
  for (let i = 0; i < OLD.length; i++)
    for (let j = i + 1; j < OLD.length; j++) bar = Math.min(bar, dist(V[OLD[i]], V[OLD[j]]))
  assert.ok(bar > 0, 'no two shipped emotions are identical')
  for (const n of NEW_EMOTIONS) {
    for (const o of EMOTION_NAMES) {
      if (o === n) continue
      assert.ok(dist(V[n], V[o]) >= bar,
        `${n} is closer to ${o} (${dist(V[n], V[o]).toFixed(2)}) than the closest shipped pair (${bar.toFixed(2)})`)
    }
  }
})

test('each new emotion draws a brow shape no other emotion draws', () => {
  const byMarkup = new Map()
  for (const n of EMOTION_NAMES) {
    const m = brows(70, 100, 30, EMOTIONS[n].brow, '#000', 1)
    if (!byMarkup.has(m)) byMarkup.set(m, [])
    byMarkup.get(m).push(n)
  }
  for (const n of NEW_EMOTIONS) {
    const m = brows(70, 100, 30, EMOTIONS[n].brow, '#000', 1)
    assert.deepEqual(byMarkup.get(m), [n], `${n}'s brow is not its own shape`)
  }
})

test('گیج is the only asymmetric brow, which is what makes it read as گیج', () => {
  // Every other brow is a mirror pair. Confusion is the one that must not be.
  const halves = (n) => {
    const m = brows(70, 130, 30, EMOTIONS[n].brow, '#000', 1)
    return m.split('<path').filter(Boolean)
  }
  const asym = EMOTION_NAMES.filter((n) => {
    const [a, b] = halves(n)
    if (!a || !b) return false
    // Mirror the second half's x coordinates about the eye midpoint and compare
    // the shape of the numbers, not their sign.
    const nums = (s) => (s.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
    const na = nums(a), nb = nums(b)
    if (na.length !== nb.length) return true
    return na.some((v, i) => Math.abs(Math.abs(v - 100) - Math.abs(nb[i] - 100)) > 0.01)
  })
  assert.ok(asym.includes('confused'), 'گیج must have one brow up and one down')
})

test('the emotion gaze bias stays inside the sclera', () => {
  for (const n of EMOTION_NAMES) {
    const g = EMOTIONS[n].gaze
    if (!g) continue
    assert.ok(Math.hypot(g.x, g.y) <= 0.5,
      `${n}'s gaze bias is ${Math.hypot(g.x, g.y).toFixed(2)} — past ~0.5 the iris leaves the eye`)
  }
})

test('the emotion gaze bias is added to the frame gaze, not substituted for it', () => {
  const d = setupDom()
  try {
    const rig = new ActorRig(CHARACTERS.roozi, { blink: false, micro: { amount: 0 } })
    rig.mount(d.host)
    rig.apply({ emotion: 'shy', intensity: 1, gaze: { x: 0, y: 0 } })
    rig.finish()
    const dx = () => Number(/translate\((-?[\d.]+)px/.exec(
      d.host.querySelector('.iris').style.transform)[1])
    const biased = dx()
    assert.ok(biased < -0.1, 'خجالتی must look away without being asked to')
    rig.apply({ gaze: { x: 1, y: 0 } })
    rig.finish()
    assert.ok(dx() > biased, 'an explicit driver gaze must still win')
  } finally { d.restore() }
})

test('intensity scales the emotion gaze bias to nothing at zero', () => {
  const d = setupDom()
  try {
    const rig = new ActorRig(CHARACTERS.roozi, { blink: false, micro: { amount: 0 } })
    rig.mount(d.host)
    rig.apply({ emotion: 'shy', intensity: 0 })
    rig.finish()
    assert.match(d.host.querySelector('.iris').style.transform, /translate\(0px,\s*0px\)/)
  } finally { d.restore() }
})

test('the new postures stay inside every character\'s measured limits', () => {
  // Not a geometry check of its own — the seam/rim guards in rig-cache own that,
  // and they sweep `Object.keys(EMOTIONS)`, so they picked these up the moment
  // the presets landed. This asserts the two overrides those guards forced.
  const laki = CHARACTERS.laki.posture
  const tondpa = CHARACTERS.tondpa.posture
  assert.ok(laki.proud && laki.shy, 'لاکی\'s headDrop window is boxed on both sides')
  assert.ok(tondpa.proud, 'تندپا\'s head lifts off its body at the shared مغرور headDrop')
  for (const [slug, over] of [['laki', laki.proud], ['tondpa', tondpa.proud]]) {
    const p = resolvePosture('proud', 1, CHARACTERS[slug].posture)
    assert.ok(p.headDrop > -5, `${slug} must pull مغرور's headDrop inside its window`)
    assert.ok(over.sink < 0, `${slug} should carry the chin-up read with sink instead`)
  }
})

test('each new emotion carries a silhouette, not only a face', () => {
  // The whole point of PostureSpec: these must read at thumbnail size, where no
  // brow is legible. A face-only emotion would pass every other test here.
  const NEUTRAL = resolvePosture('neutral', 1, undefined)
  for (const e of NEW_EMOTIONS) {
    const channels = Object.entries(POSTURES[e]).filter(([, v]) => v !== 0)
    assert.ok(channels.length >= 3,
      `${e} moves only ${channels.length} posture channel(s) — that is a face, not a pose`)
    const p = resolvePosture(e, 1, undefined)
    const moved = Object.keys(NEUTRAL).filter((k) => Math.abs(p[k] - NEUTRAL[k]) > 0.5)
    assert.ok(moved.length >= 3,
      `${e} resolves to within half a unit of neutral on all but ${moved.length} channel(s)`)
  }
})

test('every character renders every new emotion without losing a rig hook', () => {
  for (const slug of CHARACTER_SLUGS) {
    for (const e of NEW_EMOTIONS) {
      const svg = renderActorSVG(CHARACTERS[slug], { ...defaultFrame(slug), emotion: e }, 200)
      assert.match(svg, /class="browsG"/, `${slug}/${e} lost its brow hook`)
      assert.match(svg, /id="mouthG"/, `${slug}/${e} lost its mouth hook`)
      assert.equal((svg.match(/class="iris"/g) ?? []).length, 2, `${slug}/${e} lost an iris`)
    }
  }
})

// ═══════════════════════════════════════════════ 3. gaze / eye realism ══════

test('the blink table is total over the emotion union', () => {
  // A sparse map is how `surprised` sat on the neutral blink unnoticed.
  assert.deepEqual(Object.keys(BLINK_STYLES).sort(), EMOTION_NAMES.slice().sort())
  for (const e of EMOTION_NAMES) assert.equal(blinkStyle(e), BLINK_STYLES[e])
})

test('blink rate and lid weight vary by emotion, with sleepy and surprised at the ends', () => {
  const gap = (e) => (BLINK_STYLES[e].minGap + BLINK_STYLES[e].maxGap) / 2
  const fastest = EMOTION_NAMES.reduce((a, b) => (gap(b) < gap(a) ? b : a))
  assert.equal(fastest, 'surprised', 'surprise must blink fastest')
  const heaviest = EMOTION_NAMES.reduce((a, b) =>
    (BLINK_STYLES[b].dur > BLINK_STYLES[a].dur ? b : a))
  assert.equal(heaviest, 'sleepy', 'sleepy must have the heaviest lid')
  assert.ok(BLINK_STYLES.sleepy.dur > BLINK_STYLES.surprised.dur * 3,
    'the two ends must be far enough apart to actually read')
  for (const e of EMOTION_NAMES) {
    const s = BLINK_STYLES[e]
    assert.ok(s.minGap > 0 && s.maxGap > s.minGap, `${e} has an impossible blink gap`)
    assert.ok(s.dur > 0 && s.dur < s.minGap, `${e}'s lid stays shut longer than the gap between blinks`)
    assert.ok(s.doubleChance >= 0 && s.doubleChance <= 1)
  }
})

/** Deterministic micro-motion: a fixed LCG, so saccade assertions are not races. */
function microRig(cfg = {}) {
  let seed = 12345
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  return new IdleMicroMotion({ random, ...cfg })
}

test('the eyes are never perfectly still, even with the gaze target unchanged', () => {
  const m = microRig()
  const f = { ...defaultFrame('roozi'), locomotion: 'idle' }
  const seen = new Set()
  for (let i = 0; i < 600; i++) seen.add(m.tick(1 / 60, f).gaze.x.toFixed(4))
  assert.ok(seen.size > 3, `the saccade produced ${seen.size} distinct positions — that is a stare`)
})

test('a saccade is a dart between fixations, not a continuous drift', () => {
  const m = microRig()
  const f = { ...defaultFrame('roozi'), locomotion: 'idle' }
  let moving = 0, still = 0, prev = m.tick(1 / 60, f).gaze
  for (let i = 0; i < 1800; i++) {
    const g = m.tick(1 / 60, f).gaze
    if (Math.hypot(g.x - prev.x, g.y - prev.y) > 1e-6) moving++
    else still++
    prev = g
  }
  assert.ok(still > moving * 3,
    `the eyes moved on ${moving} of ${moving + still} frames — a saccade fixates far more than it travels`)
})

test('the saccade stays small enough to read as aliveness, not as looking elsewhere', () => {
  const m = microRig()
  const f = { ...defaultFrame('roozi'), locomotion: 'idle' }
  let max = 0
  for (let i = 0; i < 6000; i++) {
    const g = m.tick(1 / 60, f).gaze
    max = Math.max(max, Math.hypot(g.x, g.y))
  }
  assert.ok(max > 0.02, 'a saccade too small to see is not a saccade')
  assert.ok(max < 0.3, `saccade reached ${max.toFixed(3)} — that reads as a new gaze target`)
})

test('saccade can be disabled without freezing the body, and vice versa', () => {
  const f = { ...defaultFrame('roozi'), locomotion: 'idle' }
  const noSac = microRig({ saccade: 0 })
  let bodyMoved = false
  for (let i = 0; i < 600; i++) {
    const o = noSac.tick(1 / 60, f)
    assert.equal(o.gaze.x, 0)
    assert.equal(o.gaze.y, 0)
    if ((o.torso.rot ?? 0) !== 0 || (o.torso.y ?? 0) !== 0) bodyMoved = true
  }
  assert.ok(bodyMoved, 'saccade:0 must not stop the character breathing')
  const off = microRig({ amount: 0 })
  for (let i = 0; i < 60; i++) {
    const o = off.tick(1 / 60, f)
    assert.deepEqual(o.gaze, { x: 0, y: 0 }, 'amount:0 must disable everything, gaze included')
  }
})

test('the saccade damps while walking, the same way the body micro-motion does', () => {
  const f = (locomotion) => ({ ...defaultFrame('roozi'), locomotion })
  const peak = (loco) => {
    const m = microRig()
    let max = 0
    for (let i = 0; i < 6000; i++) max = Math.max(max, Math.abs(m.tick(1 / 60, f(loco)).gaze.x))
    return max
  }
  // A bare `<` is not enough: the micro amount already ramps, so an undamped
  // saccade still measures a hair lower on the walk. The damp must be the
  // documented fraction, not an accident of sampling.
  assert.ok(peak('walk') < peak('idle') * 0.6,
    `a walking character has less spare attention to dart around with `
    + `(walk ${peak('walk').toFixed(3)} vs idle ${peak('idle').toFixed(3)})`)
})

test('the saccade reaches the DOM without the driver asking for it', () => {
  const d = setupDom()
  try {
    const rig = new ActorRig(CHARACTERS.roozi, { blink: false })
    rig.mount(d.host)
    rig.finish()
    const iris = d.host.querySelector('.iris')
    const seen = new Set()
    for (let i = 0; i < 200; i++) { d.advance(64); seen.add(iris.style.transform) }
    assert.ok(seen.size > 1,
      'a mounted rig with a static frame must still move its eyes')
  } finally { d.restore() }
})

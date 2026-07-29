import test from 'node:test'
import assert from 'node:assert/strict'
import {
  artKeyOf, defaultFrame, renderActorSVG, resolvePosture, CHARACTERS, RIG_CSS,
  eyeWidenScale, eyeWidenTransform, eyeLidRy, EMOTIONS, LAYER_ORDER,
  GESTURES, GESTURE_NAMES,
} from '../dist/index.js'

const frame = (over = {}) => ({ ...defaultFrame('roozi'), ...over })

// ------------------------------------------- intensity is off the render path ---

test('an intensity-only change from 0.2 to 0.9 does not change the art key', () => {
  // This is the decision-1 requirement: interpolating intensity must not
  // trigger a full innerHTML re-render partway through the sweep.
  assert.equal(artKeyOf(frame({ intensity: 0.2 })), artKeyOf(frame({ intensity: 0.9 })))
})

test('no intensity anywhere in 0..1 changes the art key', () => {
  const keys = new Set()
  for (let i = 0; i <= 100; i++) keys.add(artKeyOf(frame({ intensity: i / 100 })))
  assert.equal(keys.size, 1, `intensity sweep produced ${keys.size} distinct render keys`)
})

test('the art key still changes for the things that really are redrawn', () => {
  const b = artKeyOf(frame())
  assert.notEqual(b, artKeyOf(frame({ emotion: 'sad' })), 'emotion rebakes brows + mouth')
  assert.notEqual(b, artKeyOf(frame({ facing: 'left' })), 'facing flips the tree')
  assert.notEqual(b, artKeyOf(frame({ character: 'ava' })), 'different art entirely')
})

test('the art key ignores the purely live channels', () => {
  const b = artKeyOf(frame())
  for (const over of [
    { gaze: { x: 1, y: -1 } }, { browRaise: 1 }, { viseme: 'aa' },
    { mouthOpen: 1 }, { speed: 2 }, { locomotion: 'walk' }, { gesture: 'wave' },
  ]) {
    assert.equal(artKeyOf(frame(over)), b, `${Object.keys(over)[0]} must not force a re-render`)
  }
})

// ------------------------------------------------------ the live lid hook ---

test('every character exposes data-lr on both lower lids for the live hook', () => {
  for (const [slug, spec] of Object.entries(CHARACTERS)) {
    const svg = renderActorSVG(spec, defaultFrame(slug), 200)
    const lids = [...svg.matchAll(/class="lidLo" data-lr="([\d.]+)"/g)]
    assert.equal(lids.length, 2, `${slug} should expose 2 lidLo hooks, found ${lids.length}`)
    for (const [, r] of lids) {
      assert.ok(Number(r) > 0, `${slug} lidLo data-lr must be the unscaled radius`)
    }
  }
})

test('data-lr is the unscaled eye radius, not the widened one', () => {
  // If it were the widened radius it would differ between a wide emotion at
  // low vs high intensity, and the live hook would drift.
  const low = renderActorSVG(CHARACTERS.roozi, frame({ emotion: 'surprised', intensity: 0.2 }), 200)
  const high = renderActorSVG(CHARACTERS.roozi, frame({ emotion: 'surprised', intensity: 0.9 }), 200)
  const lr = (s) => [...s.matchAll(/data-lr="([\d.]+)"/g)].map((m) => m[1])
  assert.deepEqual(lr(low), lr(high))
  assert.deepEqual(lr(low), [String(CHARACTERS.roozi.eyes.r), String(CHARACTERS.roozi.eyes.r)])
})

// ---------------------------------------- widen is a transform, never baked ---

test('no drawn eye geometry depends on intensity — only the eyeG transform does', () => {
  // The whole point: if widen were baked into the sclera/iris radii, a live
  // intensity change would leave the eye stuck at its last rendered size,
  // because emotion (not intensity) is what triggers the re-render.
  const strip = (s) => s.replace(/ transform="[^"]*"/g, '').replace(/ ry="[\d.]+" fill="var\(--lidfill\)"/g, '')
  const low = renderActorSVG(CHARACTERS.roozi, frame({ emotion: 'surprised', intensity: 0 }), 200)
  const high = renderActorSVG(CHARACTERS.roozi, frame({ emotion: 'surprised', intensity: 1 }), 200)
  assert.notEqual(low, high, 'the two renders should differ *somewhere*')
  assert.equal(strip(low), strip(high), 'they may only differ in the eyeG transform and the lid ry')
})

test('every character exposes the eyeG widen hook with its pivot', () => {
  for (const [slug, spec] of Object.entries(CHARACTERS)) {
    const svg = renderActorSVG(spec, defaultFrame(slug), 200)
    const gs = [...svg.matchAll(/class="eyeG" data-cx="([\d.-]+)" data-cy="([\d.-]+)"/g)]
    assert.equal(gs.length, 2, `${slug} should expose 2 eyeG hooks, found ${gs.length}`)
    assert.deepEqual(gs.map((m) => Number(m[1])), spec.eyes.x, `${slug} eyeG pivot x`)
    for (const m of gs) assert.equal(Number(m[2]), spec.eyes.y, `${slug} eyeG pivot y`)
  }
})

test('a static render still widens, so contact sheets and SSR are correct', () => {
  // The rig overwrites this every tick, but nothing may *depend* on the rig.
  const s = renderActorSVG(CHARACTERS.roozi, frame({ emotion: 'surprised', intensity: 1 }), 200)
  const m = s.match(/class="eyeG"[^>]*transform="translate\([\d.-]+ [\d.-]+\) scale\(([\d.]+)\)/)
  assert.ok(m, 'a fully-widened eye must carry a scale transform')
  assert.equal(Number(m[1]), eyeWidenScale(1))
  const flat = renderActorSVG(CHARACTERS.roozi, frame({ emotion: 'sad', intensity: 1 }), 200)
  assert.ok(!/class="eyeG"[^>]*transform=/.test(flat), 'a non-wide emotion emits no transform')
})

test('the widen transform holds the eye centre fixed', () => {
  // Scaling about the wrong pivot doesn't shrink the eye, it flings it across
  // the canvas — so assert the fixed point, not the string.
  const apply = (tf, px, py) => {
    const m = tf.match(/translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\) translate\((-?[\d.]+) (-?[\d.]+)\)/)
    assert.ok(m, `unparseable transform: ${tf}`)
    const [, tx, ty, s, ux, uy] = m.map(Number)
    return [tx + s * (px + ux), ty + s * (py + uy)]
  }
  for (const s of [1, 1.06, 1.12]) {
    for (const [cx, cy] of [[83, 74], [117, 74], [0, 0]]) {
      const [x, y] = apply(eyeWidenTransform(cx, cy, s), cx, cy)
      assert.ok(Math.abs(x - cx) < 1e-6 && Math.abs(y - cy) < 1e-6,
        `scale ${s} about (${cx},${cy}) moved the centre to (${x},${y})`)
    }
  }
  // And it really does scale: a point one radius out moves out by exactly s.
  const [x] = apply(eyeWidenTransform(83, 74, 1.12), 83 + 11, 74)
  assert.ok(Math.abs((x - 83) - 11 * 1.12) < 1e-6, 'the rim should scale by s')
})

test('the widen scale and lid retraction agree with the shared helpers', () => {
  // rig.updateEyes() and eyes() both call these, which is what stops the lid
  // and the sclera drifting apart. Pin the curve so neither can be tuned alone.
  assert.equal(eyeWidenScale(0), 1)
  assert.equal(eyeWidenScale(1), 1.12)
  assert.equal(eyeLidRy(10, 0, 0), 5, 'resting lid covers half a radius')
  assert.equal(eyeLidRy(10, 1, 0), 15, 'full squint closes it')
  assert.ok(eyeLidRy(10, 0, 1) < eyeLidRy(10, 0, 0), 'widen retracts the lid')
  assert.ok(eyeLidRy(10, 0, 1) >= 0, 'and never goes negative')
})

// --------------------------------- posture during locomotion (regression) ---

test("roozi's sad posture actually droops the arms", () => {
  const p = resolvePosture('sad', 1, CHARACTERS.roozi.posture)
  assert.ok(p.arms > 0, `sad must draw the arms in and down, got ${p.arms}`)
  assert.ok(p.spine > 0, 'and bow the spine forward')
})

test('sad and sleepy are distinguishable in body shape alone', () => {
  const sad = resolvePosture('sad', 1, CHARACTERS.roozi.posture)
  const sleepy = resolvePosture('sleepy', 1, CHARACTERS.roozi.posture)
  assert.ok(sad.spine > sleepy.spine, 'sad folds further forward')
  assert.ok(sleepy.sink > sad.sink, 'sleepy sinks further at the knees')
  assert.ok(sleepy.headTilt > sad.headTilt, 'sleepy lolls the head sideways')
})

test(
  'the walk cycle must not seize the limb layers that posture drives',
  () => {
    // A CSS @keyframes animation outranks the inline transform the composer
    // writes, so while `.loco-walk` owned the arm layers a sad character walked
    // with neutral arms. Phase-driven locomotion routes the cycle through
    // setContribution() instead, where posture and gait add. This test was red
    // and todo for the whole design; it must never go back.
    assert.ok(
      !/loco-(walk|fly)[^{]*lyr-(far|near)(Arm|Leg)/.test(RIG_CSS),
      'locomotion is driving limb layers via CSS again, overriding posture',
    )
    // The keyframes themselves are gone too, not merely unreferenced.
    for (const dead of ['caStepA', 'caStepB', 'caSwingA', 'caSwingB', '--loco-dur']) {
      assert.ok(!RIG_CSS.includes(dead), `${dead} survived the migration to phase tables`)
    }
  },
)

// ------------------------------------------------ the two wing conventions ---

/**
 * `.wingL`/`.wingR` (unlayered fliers, hardcoded pivot) and `.lyr-farArm`/
 * `.lyr-nearArm` (converted characters, per-character pivot) both flap under
 * `.loco-fly`. That is fine as long as no single character carries both — see
 * the comment above the rules in RIG_CSS.
 */
test('no character carries both wing conventions at once', () => {
  for (const spec of Object.values(CHARACTERS)) {
    const out = spec.render({ emotion: EMOTIONS.neutral, intensity: 1, frame: defaultFrame(spec.slug) })
    const markup = out.art + Object.values(out.layers ?? {}).map((l) => l.art).join('')
    const wingHook = /class="wing[LR]"/.test(markup)
    const layered = !!(out.layers?.farArm || out.layers?.nearArm)
    assert.ok(!(wingHook && layered),
      `${spec.slug} has .wingL/.wingR inside an arm layer — both fly rules will match, double-flapping the wing`)
  }
})

test('simorgh still flies under the unlayered convention', () => {
  const out = CHARACTERS.simorgh.render({ emotion: EMOTIONS.neutral, intensity: 1, frame: defaultFrame('simorgh') })
  assert.equal(out.layers, undefined, 'simorgh is not converted yet')
  assert.match(out.art, /class="wingL"/)
  assert.match(out.art, /class="wingR"/)
  // The rules its art depends on must still be present and unlayered.
  assert.match(RIG_CSS, /\.ca-svg\.loco-fly \.wingL\{transform-origin:[^}]*animation:caWingL/)
  assert.match(RIG_CSS, /\.ca-svg\.loco-fly \.wingR\{transform-origin:[^}]*animation:caWingR/)
})

// -------------------------------------------- the no-visible-neck authoring rule ---

/**
 * A layer exists only if the character really has that joint. Posture sends the
 * same `headDrop` degrees to everyone, so an invented pivot makes the same
 * posture mean something different per character. See the authoring rules on
 * {@link RigLayers}.
 */
test('boomi has no head layer, and no implicit one either', () => {
  const svg = renderActorSVG(CHARACTERS.boomi, defaultFrame('boomi'))
  assert.ok(!svg.includes('lyr-head'),
    'an owl has no neck, so it must not carry a head layer — implicit or declared')
  // The face still renders, riding the torso.
  for (const hook of ['eyeG', 'browsG', 'mouthG', 'lidLo']) {
    assert.ok(svg.includes(hook), `${hook} vanished with the head layer`)
  }
  // And the ear tufts survive as their own layers, so they can still droop.
  assert.ok(svg.includes('lyr-earL') && svg.includes('lyr-earR'), 'the tufts lost their layers')
})

test("boomi's ear tufts hang off the torso, not off a headless wrapper", () => {
  const svg = renderActorSVG(CHARACTERS.boomi, defaultFrame('boomi'))
  // The failure this guards is subtle: wrapping the ears in a `.lyr-head` with
  // no origin resurrects the layer, pivoting about its own bounding-box centre,
  // and posture's headDrop lands on it after all.
  const beforeEars = svg.slice(0, svg.indexOf('lyr-earL'))
  assert.ok(beforeEars.includes('lyr-torso'), 'the tufts should be inside the torso group')
  assert.ok(!/<g class="lyr-head"[^>]*>/.test(svg))
})

test("boomi still computes head posture — it simply lands on nothing", () => {
  // Exactly like tail droop on a character with no tail. The values are real;
  // there is no target, and that is the correct outcome rather than a gap.
  const sad = resolvePosture('sad', 1, CHARACTERS.boomi.posture)
  assert.ok(sad.headDrop > 0, 'the shared preset still produces a headDrop')
  assert.ok(sad.tail > 0, 'and a tail droop, for a character with no tail')
  const svg = renderActorSVG(CHARACTERS.boomi, { ...defaultFrame('boomi'), emotion: 'sad' })
  assert.ok(!svg.includes('lyr-head'))
  assert.ok(!svg.includes('lyr-tail'))
})

test('roozi keeps its head layer, because a fox has a neck', () => {
  const svg = renderActorSVG(CHARACTERS.roozi, defaultFrame('roozi'))
  assert.match(svg, /<g class="lyr-head" style="transform-origin:100px 112px"/,
    'the head layer must keep an explicit neck pivot')
})

// ------------------------------------------------- laki: head behind the shell ---

/**
 * لاکی is the only character whose head belongs *behind* its body, and the two
 * walls that makes are narrow enough to be worth pinning numerically.
 *
 * The shell rim is drawn as two cubics meeting at the apex, so the rim height is
 * evaluated from the actual path data rather than approximated by a constant —
 * a flat y=76 would quietly stop being true if the shell were ever redrawn.
 */
const cub = (p, t) => { const u = 1 - t; return u*u*u*p[0] + 3*u*u*t*p[1] + 3*u*t*t*p[2] + t*t*t*p[3] }
const RIM_L = { x: [38, 38, 66, 100], y: [142, 102, 76, 76] }
const RIM_R = { x: [100, 134, 162, 162], y: [76, 76, 102, 142] }
function rimY(x) {
  const seg = x <= 100 ? RIM_L : RIM_R
  let lo = 0, hi = 1
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (cub(seg.x, m) < x) lo = m; else hi = m }
  return cub(seg.y, (lo + hi) / 2)
}

/** Same transform as {@link lakiHead}, but for an explicit pose rather than an emotion. */
function lakiHeadPose(rot, dy, dx) {
  const r = (rot * Math.PI) / 180
  return (x, y) => {
    const px = x - LAKI.ox, py = y - LAKI.oy
    return [
      LAKI.ox + dx + px * Math.cos(r) - py * Math.sin(r),
      LAKI.oy + dy + px * Math.sin(r) + py * Math.cos(r),
    ]
  }
}

// laki's head pivot, and the extremes of the art that ride it.
const LAKI = { ox: 100, oy: 78, discCx: 100, discCy: 52, discR: 30, mouthCy: 63, mouthReach: 9 }

function lakiHead(emotion, intensity) {
  const p = resolvePosture(emotion, intensity, CHARACTERS.laki.posture)
  const r = (p.headTilt * Math.PI) / 180
  return (x, y) => {
    const dx = x - LAKI.ox, dy = y - LAKI.oy
    return [
      LAKI.ox + dx * Math.cos(r) - dy * Math.sin(r),
      LAKI.oy + p.headDrop + dx * Math.sin(r) + dy * Math.cos(r),
    ]
  }
}

test('laki paints the shell after the head, nested inside the torso', () => {
  const svg = renderActorSVG(CHARACTERS.laki, defaultFrame('laki'))
  const head = svg.indexOf('lyr-head')
  const shell = svg.indexOf('lyr-torsoFront')
  assert.ok(head > -1 && shell > -1, 'laki should have both a head and a shell overlay')
  assert.ok(shell > head, 'the shell must paint after the head or the neck rides across it')
  // Nested, not a sibling: an outer sibling would not lean with the spine and
  // would slide off the body the moment posture moved the torso.
  assert.match(svg, /<g class="lyr-torso"[^>]*>[\s\S]*<g class="lyr-torsoFront"[\s\S]*<\/g>\s*<\/g>/)
})

test('laki\'s mouth never drops under the shell rim, in any emotion', () => {
  for (const emotion of Object.keys(EMOTIONS)) {
    for (const intensity of [0.5, 1]) {
      const at = lakiHead(emotion, intensity)
      // The widest open viseme reaches mouthCy + mouthReach.
      const [mx, my] = at(LAKI.discCx, LAKI.mouthCy + LAKI.mouthReach)
      assert.ok(my < rimY(mx) - 1,
        `${emotion}@${intensity}: an open mouth reaches y=${my.toFixed(2)}, at or under the rim (${rimY(mx).toFixed(2)})`)
    }
  }
})

test('laki\'s head never lifts clear of the shell rim', () => {
  for (const emotion of Object.keys(EMOTIONS)) {
    for (const intensity of [0.5, 1]) {
      const at = lakiHead(emotion, intensity)
      const [bx, by] = at(LAKI.discCx, LAKI.discCy + LAKI.discR)
      assert.ok(by > rimY(bx) + 1,
        `${emotion}@${intensity}: the head floats ${(rimY(bx) - by).toFixed(2)} above the rim — a detached head`)
    }
  }
})

test('every head gesture لاکی actually plays stays inside its headDrop window', () => {
  // The posture guards above sweep emotions; a gesture writes the same channel
  // and answers to the same two walls. Read from the shipped registry, so a
  // re-tuned nod is measured against the shell rather than assumed to fit.
  const optOut = CHARACTERS.laki.gestureFallback ?? []
  let checked = 0
  for (const g of GESTURE_NAMES) {
    if (optOut.includes(g)) continue
    for (const part of GESTURES[g].parts) {
      if (part.layer !== 'lyr-head') continue
      for (const pose of part.action.poses) {
        checked++
        const at = lakiHeadPose(pose.rot ?? 0, pose.y ?? 0, pose.x ?? 0)
        const [mx, my] = at(LAKI.discCx, LAKI.mouthCy + LAKI.mouthReach)
        assert.ok(my < rimY(mx) - 1,
          `${g} ${JSON.stringify(pose)}: لاکی's mouth reaches y=${my.toFixed(2)}, under the rim (${rimY(mx).toFixed(2)})`)
        const [bx, by] = at(LAKI.discCx, LAKI.discCy + LAKI.discR)
        assert.ok(by > rimY(bx) + 1,
          `${g} ${JSON.stringify(pose)}: لاکی's head lifts clear of the rim`)
      }
    }
  }
  assert.ok(checked > 0, 'no head-gesture poses were checked — the sweep found nothing to guard')
})

test('لاکی opts out of exactly the head gestures that do not fit, and no more', () => {
  // The opt-out is a declaration, so it can drift from the measurement in both
  // directions: a gesture that no longer fits, or one needlessly demoted to the
  // body. Both are re-derived here from the shipped keyframes.
  const fits = (g) => GESTURES[g].parts.filter((p) => p.layer === 'lyr-head').every((p) =>
    p.action.poses.every((pose) => {
      const at = lakiHeadPose(pose.rot ?? 0, pose.y ?? 0, pose.x ?? 0)
      const [mx, my] = at(LAKI.discCx, LAKI.mouthCy + LAKI.mouthReach)
      const [bx, by] = at(LAKI.discCx, LAKI.discCy + LAKI.discR)
      return my < rimY(mx) - 1 && by > rimY(bx) + 1
    }))
  const headGestures = GESTURE_NAMES.filter((g) => GESTURES[g].parts.some((p) => p.layer === 'lyr-head'))
  assert.ok(headGestures.length > 0)
  assert.deepEqual(
    headGestures.filter((g) => !fits(g)).sort(),
    [...(CHARACTERS.laki.gestureFallback ?? [])].filter((g) => headGestures.includes(g)).sort(),
  )
})

// ------------------------------------------------------ LAYER_ORDER is not fiction ---

test('LAYER_ORDER matches the order buildLayers actually paints', () => {
  // LAYER_ORDER is exported documentation with no runtime consumer, so nothing
  // stopped it drifting from the real paint order until this test.
  const every = Object.fromEntries(LAYER_ORDER.map((n) => [n, { origin: [100, 100], art: `<g id="mark-${n}"/>` }]))
  const spec = {
    ...CHARACTERS.roozi,
    render: () => ({ grads: '', art: '', layers: every, mouth: { cx: 100, cy: 100, color: '#000' } }),
  }
  const svg = renderActorSVG(spec, defaultFrame('roozi'))
  // The marker elements, not the class names: a group's opening tag precedes its
  // own children, so scanning `lyr-*` would report `torso` before the layers
  // nested inside it and say nothing about where the torso's own art paints.
  const painted = [...svg.matchAll(/id="mark-([A-Za-z]+)"/g)].map((m) => m[1])
  assert.deepEqual(painted, LAYER_ORDER,
    'LAYER_ORDER no longer describes what buildLayers emits')
})

// ── تندپا: the invisible seam ────────────────────────────────────────────────
//
// The head disc and the body ellipse carry the same `tpB` fill, so the seam at
// y≈121.1 cannot be seen at rest and an over-wide posture would not be caught by
// looking at it. What *would* show is the head pulling free of the shoulders: a
// band of background across the neck. So the seam is asserted by sweeping the
// whole emotion × intensity grid rather than by eye at neutral.
//
// The cheek puffs at (66,96) and (134,96) are rigid with the disc — they rotate
// with it, so no head angle can separate them from the head silhouette. That is
// why no cheek *bound* exists: the only thing a head pose can move is the
// head-versus-body relationship, which is what this measures. Spine and sink are
// irrelevant here because `head` is nested inside `torso` and rides it.
// The pivot is read off the shipped spec, not restated here: a test that keeps
// its own copy of the origin would go on passing after someone moved the real
// one to the disc centre, which is precisely the error worth catching.
const tondpaLayers = () =>
  CHARACTERS.tondpa.render({ emotion: EMOTIONS.neutral, intensity: 1 }).layers
const TP = {
  get pivot() { return tondpaLayers().head.origin },
  disc: { cx: 100, cy: 86, r: 41 },
  cheeks: [{ cx: 66, cy: 96, r: 13 }, { cx: 134, cy: 96, r: 13 }],
  body: { cx: 100, cy: 150, rx: 40, ry: 34 },
  // micro's worst per-tick push on the head, at amount 1: breath lift + sway +
  // glance, all taken in the detaching direction at once.
  micro: { y: -0.9, rot: -1.3 },
}

function tondpaSeamOverlap(rot, dy) {
  const [px, py] = TP.pivot
  const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a)
  const move = ({ cx, cy, r }) => {
    const u = cx - px, v = cy - py
    return { cx: px + u * c - v * s, cy: py + u * s + v * c + dy, r }
  }
  const parts = [TP.disc, ...TP.cheeks].map(move)
  const inBody = (x, y) =>
    ((x - TP.body.cx) / TP.body.rx) ** 2 + ((y - TP.body.cy) / TP.body.ry) ** 2 <= 1
  let area = 0
  for (let x = 40; x <= 160; x += 0.4) {
    for (let y = 90; y <= 190; y += 0.4) {
      if (inBody(x, y) && parts.some((p) => (x - p.cx) ** 2 + (y - p.cy) ** 2 <= p.r ** 2)) area += 0.16
    }
  }
  return area
}

test('tondpa: the head never pulls free of the body at any emotion x intensity', () => {
  // Pinned from the measurement, not from the code under test: at tilt 0 the
  // head detaches at headDrop ≈ -10.6, and the worst posture on the roster
  // (surprised at intensity 1, plus micro) reaches -3.9. The floor below is set
  // well inside that headroom so it fires on a posture edit long before the
  // seam visibly opens.
  const FLOOR = 120
  assert.ok(tondpaSeamOverlap(0, -10.6) < 1, 'the detach threshold has moved; re-derive FLOOR')

  let worst = { area: Infinity }
  for (const emotion of Object.keys(EMOTIONS)) {
    for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
      const p = resolvePosture(emotion, intensity, CHARACTERS.tondpa.posture)
      const area = tondpaSeamOverlap((p.headTilt ?? 0) + TP.micro.rot, (p.headDrop ?? 0) + TP.micro.y)
      if (area < worst.area) worst = { area, emotion, intensity }
    }
  }
  assert.ok(worst.area > FLOOR,
    `tondpa's head comes off its shoulders at ${worst.emotion}/${worst.intensity} (overlap ${worst.area.toFixed(0)} < ${FLOOR})`)
})

// The seam test above deliberately does *not* cover this: rotating a disc about
// its own centre leaves the disc exactly where it was, so a pivot moved to
// (100,86) opens no gap at all. It would still be wrong — the head would swivel
// in place instead of craning off the shoulders — so the pivot claim needs its
// own assertion, derived from the art rather than restated from the spec.
test('tondpa: the head pivot is the measured head/body crossing, not a chosen point', () => {
  const { disc, body } = TP
  const inBody = (x, y) => ((x - body.cx) / body.rx) ** 2 + ((y - body.cy) / body.ry) ** 2 <= 1
  const cross = []
  for (let i = 0; i < 20000; i++) {
    const at = (k) => {
      const t = (k / 20000) * Math.PI * 2
      return [disc.cx + disc.r * Math.cos(t), disc.cy + disc.r * Math.sin(t)]
    }
    const [x, y] = at(i), [x2, y2] = at(i + 1)
    if (inBody(x, y) !== inBody(x2, y2)) cross.push([x, y])
  }
  assert.equal(cross.length, 2, 'the head and body no longer meet in a single seam')
  const seamY = (cross[0][1] + cross[1][1]) / 2
  const [ox, oy] = TP.pivot
  assert.equal(ox, 100, 'the pivot must sit on the centre line')
  assert.ok(Math.abs(oy - seamY) <= 1,
    `the head pivot (${oy}) is not the measured seam (${seamY.toFixed(2)})`)
})

test('tondpa: the head paints over the torso and the ears behind the head', () => {
  const svg = renderActorSVG(CHARACTERS.tondpa, defaultFrame('tondpa'), 200)
  // No `torsoFront`: unlike لاکی, nothing on this body occludes the head.
  assert.ok(!svg.includes('lyr-torsoFront'), 'tondpa should not have grown a torsoFront')
  assert.ok(svg.indexOf('cy="150"') < svg.indexOf('lyr-head'), 'the head must paint after the body')
  const head = svg.slice(svg.indexOf('lyr-head'))
  assert.ok(head.indexOf('lyr-earL') < head.indexOf('cy="86" r="41"'),
    'the ear bases must stay behind the head disc')
})

// ── خرسی: the one seam you can actually see ─────────────────────────────────
//
// Unlike تندپا and پشمک, the head (`khHh`) and the body (`khB`) are different
// gradients, so the join is a real tonal edge. That makes the eye a usable check
// here — and makes it worth asserting that the two fills stay distinct, since
// the whole visibility argument rests on it.
const KH = {
  head: { cx: 100, cy: 86, r: 43 },
  ears: { earL: { cx: 66, cy: 50, r: 18 }, earR: { cx: 134, cy: 50, r: 18 } },
  body: { cx: 100, cy: 150, rx: 44, ry: 36 },
  micro: { y: -0.9, rot: -1.3 },
}
const khersiLayers = () =>
  CHARACTERS.khersi.render({ emotion: EMOTIONS.neutral, intensity: 1 }).layers

// Rotate a disc about a pivot, then translate. Used for both joints.
function spin({ cx, cy, r }, [px, py], deg, dy = 0) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a)
  const u = cx - px, v = cy - py
  return { cx: px + u * c - v * s, cy: py + u * s + v * c + dy, r }
}

test('khersi: the head pivot is the measured head/body crossing', () => {
  const { head, body } = KH
  const inBody = (x, y) => ((x - body.cx) / body.rx) ** 2 + ((y - body.cy) / body.ry) ** 2 <= 1
  const cross = []
  for (let i = 0; i < 20000; i++) {
    const at = (k) => {
      const t = (k / 20000) * Math.PI * 2
      return [head.cx + head.r * Math.cos(t), head.cy + head.r * Math.sin(t)]
    }
    const [x, y] = at(i), [x2, y2] = at(i + 1)
    if (inBody(x, y) !== inBody(x2, y2)) cross.push([x, y])
  }
  assert.equal(cross.length, 2, 'the head and body no longer meet in a single seam')
  const seamY = (cross[0][1] + cross[1][1]) / 2
  const [ox, oy] = khersiLayers().head.origin
  assert.equal(ox, 100)
  assert.ok(Math.abs(oy - seamY) <= 1, `head pivot ${oy} is not the measured seam ${seamY.toFixed(2)}`)
})

test('khersi: each ear pivots at the head/ear chord midpoint, not at its own centre', () => {
  // The ear disc is centred *outside* the skull, so there is no base to read off
  // and the pivot has to come from the two-circle intersection. Note that the
  // ear's own centre would also "work" — rotating a circle about its centre is a
  // no-op, so nothing would visibly break and no sweep would catch it. Only this
  // assertion does.
  const L = khersiLayers()
  for (const [side, ear] of Object.entries(KH.ears)) {
    const dx = ear.cx - KH.head.cx, dy = ear.cy - KH.head.cy
    const d = Math.hypot(dx, dy)
    assert.ok(d > KH.head.r, `${side}: precondition — the ear centre should sit outside the head disc`)
    const a = (d * d + KH.head.r ** 2 - ear.r ** 2) / (2 * d)
    const want = [KH.head.cx + (a / d) * dx, KH.head.cy + (a / d) * dy]
    const got = L[side].origin
    assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1]) <= 1,
      `${side} pivot ${JSON.stringify(got)} is not the chord midpoint [${want.map((n) => n.toFixed(2))}]`)
  }
})

test('khersi: head and body stay visually distinct, which is what makes the seam checkable', () => {
  const L = khersiLayers()
  assert.match(L.head.art, /circle cx="100" cy="86" r="43" fill="url\(#khHh\)"/,
    'the head must keep its own gradient — sharing khB would erase the visible seam')
  assert.match(L.torso.art, /fill="url\(#khB\)"/)
  assert.ok(!L.head.art.includes('url(#khB)'), 'the head must not be painted in the body gradient')
})

test('khersi: neither the head nor an ear comes loose at any emotion x intensity', () => {
  const L = khersiLayers()
  const HP = L.head.origin
  const inBody = (x, y) =>
    ((x - KH.body.cx) / KH.body.rx) ** 2 + ((y - KH.body.cy) / KH.body.ry) ** 2 <= 1
  const seam = (tilt, drop) => {
    const h = spin(KH.head, HP, tilt, drop)
    let a = 0
    for (let x = 40; x <= 160; x += 0.5) for (let y = 90; y <= 195; y += 0.5)
      if (inBody(x, y) && (x - h.cx) ** 2 + (y - h.cy) ** 2 <= h.r ** 2) a += 0.25
    return a
  }
  // Pinned from the measurement: the head detaches at headDrop ≈ -14.6, and the
  // worst shipped posture (surprised at 1, plus micro) reaches -4.9.
  const SEAM_FLOOR = 220
  assert.ok(seam(0, -14.6) < 1, 'the detach threshold has moved; re-derive SEAM_FLOOR')

  let worstSeam = { a: Infinity }, worstEar = { p: Infinity }
  for (const emotion of Object.keys(EMOTIONS)) {
    for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
      const p = resolvePosture(emotion, intensity, CHARACTERS.khersi.posture)
      const tilt = (p.headTilt ?? 0) + KH.micro.rot, drop = (p.headDrop ?? 0) + KH.micro.y
      const a = seam(tilt, drop)
      if (a < worstSeam.a) worstSeam = { a, emotion, intensity }
      for (const side of ['earL', 'earR']) {
        // Ears are their own layer with their own pivot, so unlike تندپا's
        // cheeks they are *not* rigid with the head and can in principle walk
        // off it. They do not, and the chord-midpoint pivot is why.
        const sign = side === 'earL' ? 1 : -1
        const e = spin(spin(KH.ears[side], L[side].origin, sign * (p.ears ?? 0)), HP, tilt, drop)
        const h = spin(KH.head, HP, tilt, drop)
        const pen = h.r - (Math.hypot(e.cx - h.cx, e.cy - h.cy) - e.r)
        if (pen < worstEar.p) worstEar = { p: pen, emotion, intensity, side }
      }
    }
  }
  assert.ok(worstSeam.a > SEAM_FLOOR,
    `khersi's head comes off at ${worstSeam.emotion}/${worstSeam.intensity} (${worstSeam.a.toFixed(0)} < ${SEAM_FLOOR})`)
  assert.ok(worstEar.p > 8,
    `khersi's ${worstEar?.side} leaves the head at ${worstEar.emotion}/${worstEar.intensity} (penetration ${worstEar.p.toFixed(2)})`)
})

test('khersi: the head paints over the torso and the ears behind the head', () => {
  const svg = renderActorSVG(CHARACTERS.khersi, defaultFrame('khersi'), 200)
  assert.ok(!svg.includes('lyr-torsoFront'))
  assert.ok(svg.indexOf('cy="150"') < svg.indexOf('lyr-head'), 'the head must paint after the body')
  const head = svg.slice(svg.indexOf('lyr-head'))
  assert.ok(head.indexOf('lyr-earL') < head.indexOf('cy="86" r="43"'),
    'the ear discs must stay behind the head')
})

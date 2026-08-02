import test from 'node:test'
import assert from 'node:assert/strict'
import {
  artKeyOf, defaultFrame, renderActorSVG, resolvePosture, CHARACTERS, RIG_CSS,
  eyeWidenScale, eyeWidenTransform, eyeLidRy, EMOTIONS, LAYER_ORDER,
  GESTURES, GESTURE_NAMES,
} from '../dist/index.js'
// The seam and rim geometry lives in tools/, not here: the contact sheets have
// to measure the same walls with the same functions, or a sheet that looks
// right and a guard that passes stop being the same claim. See the header of
// that file — it is test-load-bearing despite sitting outside src/.
import {
  LAKI, lakiRimY, lakiClearance, posturePose, worstOverAction, poseAt,
  TP, tondpaSeamOverlap, KH, khersiSeamOverlap, khersiEarPenetration,
  earChordMidpoint, discBodySeamY, headPivot, MICRO_WORST,
} from '../tools/lib/probes.mjs'
import { poseToTransform, sampleAction } from '../dist/index.js'

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
 * The rim solver, the pose transform and the two clearance measurements all
 * live in tools/lib/probes.mjs. `lakiClearance` returns both margins signed
 * positive-when-safe, so every assertion below reads `> 1` — one art unit of
 * headroom either side of the wall.
 */
const lakiPostureClearance = (emotion, intensity) =>
  lakiClearance(posturePose(resolvePosture(emotion, intensity, CHARACTERS.laki.posture)))

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
      // The widest open viseme reaches mouthCy + mouthReach.
      const { mouth } = lakiPostureClearance(emotion, intensity)
      assert.ok(mouth > 1,
        `${emotion}@${intensity}: an open mouth comes within ${mouth.toFixed(2)} of the shell rim`)
    }
  }
})

test('laki\'s head never lifts clear of the shell rim', () => {
  for (const emotion of Object.keys(EMOTIONS)) {
    for (const intensity of [0.5, 1]) {
      const { head } = lakiPostureClearance(emotion, intensity)
      assert.ok(head > 1,
        `${emotion}@${intensity}: the head floats ${(-head).toFixed(2)} above the rim — a detached head`)
    }
  }
})

/**
 * The full playback of every head action لاکی could be given, sampled across
 * the whole timeline rather than at the authored keyframes.
 *
 * The distinction is not academic. `buildAction` derives an anticipation pose
 * and four settle beats that appear in no `poses` array, and the anticipation
 * always loads *downward* with a vertical squash — on لاکی, straight at the
 * shell rim it is being checked against. Sweeping `action.poses` measures a set
 * of frames the rig passes through but never stops at, and misses every frame
 * it derived. On the one head gesture لاکی plays it is the difference between
 * 3.00 units of mouth clearance and 2.05.
 */
const lakiWorst = (action) => worstOverAction(action, lakiClearance)
const headParts = (g) => GESTURES[g].parts.filter((p) => p.layer === 'lyr-head')
const headGestures = () => GESTURE_NAMES.filter((g) => headParts(g).length > 0)

test('every head gesture لاکی actually plays stays inside its headDrop window', () => {
  // The posture guards above sweep emotions; a gesture writes the same channel
  // and answers to the same two walls. Read from the shipped registry, so a
  // re-tuned nod is measured against the shell rather than assumed to fit.
  const optOut = CHARACTERS.laki.gestureFallback ?? []
  let checked = 0
  for (const g of headGestures()) {
    if (optOut.includes(g)) continue
    for (const part of headParts(g)) {
      checked++
      const worst = lakiWorst(part.action)
      assert.ok(worst.margin > 1,
        `${g}: at t=${worst.t.toFixed(3)} the ${worst.channel} clearance is ${worst.margin.toFixed(2)} — inside the rim`)
    }
  }
  assert.ok(checked > 0, 'no head gestures were checked — the sweep found nothing to guard')
})

test('the derived anticipation and settle are inside the لاکی sweep, not just the authored poses', () => {
  // Guards the guard. If `worstOverAction` ever collapsed to the authored
  // keyframes, the test above would keep passing while measuring a timeline the
  // rig does not play — the exact failure that motivated this module. So: the
  // worst moment of a shipped head action must not coincide with an authored
  // pose, which is only true because the derivation contributes frames.
  const shake = headParts('shake')[0].action
  const worst = lakiWorst(shake)
  const authoredTs = new Set(shake.poses.map((_, i) =>
    ((shake.antTime ?? 0.18) + (1 - (shake.settleTime ?? 0.26) - (shake.antTime ?? 0.18))
      * ((i + 1) / (shake.poses.length + 1))).toFixed(3)))
  assert.ok(!authoredTs.has(worst.t.toFixed(3)),
    `the worst frame (t=${worst.t.toFixed(3)}) is an authored keyframe — nothing derived is being swept`)
  // And it must be strictly tighter than the authored poses alone would report.
  const authoredWorst = Math.min(...shake.poses.map((p) => {
    const c = lakiClearance(p)
    return Math.min(c.mouth, c.head)
  }))
  assert.ok(worst.margin < authoredWorst,
    `the full timeline (${worst.margin.toFixed(2)}) is no tighter than the authored poses (${authoredWorst.toFixed(2)})`)
})

// Both tests below exist because mutation testing found the clearance sweeps
// could not catch a broken probe. They are the probe's own guards.

test('poseAt maps points exactly the way poseToTransform tells the browser to', () => {
  // `poseAt` is a reimplementation of a CSS transform in arithmetic, and every
  // seam and rim margin on the roster is measured through it. Asserting it via
  // a clearance threshold does not work: dropping the squash channels shifts
  // لاکی's mouth by under half a unit, which a 1-unit floor happily absorbs. So
  // it is checked directly, against the *shipped serialiser* — the string the
  // rig actually writes — parsed back into a matrix by an independent path.
  // Read the pose back out of the emitted string, and compare *that* through
  // both paths. `poseToTransform` rounds to three decimals, so feeding the
  // unrounded pose to one side and the string to the other would compare the
  // rounding, not the mapping — and would need a tolerance big enough to hide
  // the very channel drop this is here to catch.
  const poseFromTransform = (s) => {
    const p = {}
    for (const [, fn, args] of s.matchAll(/(\w+)\(([^)]*)\)/g)) {
      const n = args.split(',').map((v) => parseFloat(v))
      if (fn === 'translate') { p.x = n[0]; p.y = n[1] }
      else if (fn === 'rotate') p.rot = n[0]
      else if (fn === 'scale') { p.sx = n[0]; p.sy = n[1] ?? n[0] }
    }
    return p
  }
  const mat = (s) => {
    let m = [1, 0, 0, 1, 0, 0] // a b c d e f
    const mul = (n) => {
      m = [
        m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
      ]
    }
    if (s === 'none') return m
    for (const [, fn, args] of s.matchAll(/(\w+)\(([^)]*)\)/g)) {
      const n = args.split(',').map((v) => parseFloat(v))
      if (fn === 'translate') mul([1, 0, 0, 1, n[0], n[1]])
      else if (fn === 'rotate') {
        const a = (n[0] * Math.PI) / 180
        mul([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0])
      } else if (fn === 'scale') mul([n[0], 0, 0, n[1] ?? n[0], 0, 0])
      else if (fn === 'rotateY') { /* out of plane; poseAt models the 2D shadow */ }
      else assert.fail(`poseToTransform emitted ${fn}(), which this parser does not model`)
    }
    return m
  }
  const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

  const pivot = [100, 78]
  const points = [[100, 72], [100, 82], [70, 120], [138, 51]]
  // Real poses, not invented ones: every frame of every head gesture لاکی and
  // خرسی play, which is where the squash channels actually come from.
  const poses = [{ sx: 1.2, sy: 0.8, rot: 9, x: 2, y: -3 }]
  for (const g of headGestures()) {
    for (let i = 0; i <= 12; i++) poses.push(sampleAction(headParts(g)[0].action, i / 12))
  }
  let sawSquash = false
  for (const authored of poses) {
    const css = poseToTransform(authored)
    const pose = poseFromTransform(css)
    if (Math.abs((pose.sx ?? 1) - 1) > 1e-6 || Math.abs((pose.sy ?? 1) - 1) > 1e-6) sawSquash = true
    const m = mat(css)
    for (const p of points) {
      const want = apply(m, [p[0] - pivot[0], p[1] - pivot[1]])
      const got = poseAt(pose, p, pivot)
      assert.ok(Math.abs(got[0] - (pivot[0] + want[0])) < 1e-9 &&
        Math.abs(got[1] - (pivot[1] + want[1])) < 1e-9,
        `poseAt disagrees with poseToTransform(${css}) at ${p}: ` +
        `${got.map((v) => v.toFixed(4))} vs ${[pivot[0] + want[0], pivot[1] + want[1]].map((v) => v.toFixed(4))}`)
    }
  }
  // Without this the test would still pass on a pose set where every scale is 1,
  // and the squash channels would go unchecked all over again.
  assert.ok(sawSquash, 'no sampled pose carried a squash — the scale channels were never exercised')
})

test('لاکی‏s rim is solved from the shipped shell path, not approximated', () => {
  // The clearance sweeps cannot catch a broken rim solver. Measured: the worst
  // moment of the one head gesture لاکی plays puts the mouth at x≈100.2, and
  // the head bottom sits at x=100 — both within a fifth of a unit of the shell's
  // apex, where the rim genuinely is y=76. So `lakiRimY` could return a flat 76
  // and every margin would come out identical. The solver is only load-bearing
  // if the art changes, which is exactly when nobody is watching it. Hence this:
  // the curve is checked against the path data in the rendered SVG.
  const svg = renderActorSVG(CHARACTERS.laki, defaultFrame('laki'), 200)
  const d = svg.match(/d="(M38 142c[^"]*)"/)?.[1]
  assert.ok(d, 'the shell rim path is no longer in the rendered SVG — re-derive RIM_L/RIM_R')

  // M38 142 c 0 -40 28 -66 62 -66 s 62 26 62 66 z  — one cubic and its smooth
  // continuation, parsed rather than retyped.
  const n = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
  const [sx, sy, a1, b1, a2, b2, a3, b3, c2x, c2y, c3x, c3y] = n
  const left = { x: [sx, sx + a1, sx + a2, sx + a3], y: [sy, sy + b1, sy + b2, sy + b3] }
  const endL = [left.x[3], left.y[3]]
  // `s` reflects the previous control point through the endpoint.
  const right = {
    x: [endL[0], 2 * endL[0] - left.x[2], endL[0] + c2x, endL[0] + c3x],
    y: [endL[1], 2 * endL[1] - left.y[2], endL[1] + c2y, endL[1] + c3y],
  }
  const cubic = (p, t) => {
    const u = 1 - t
    return u * u * u * p[0] + 3 * u * u * t * p[1] + 3 * u * t * t * p[2] + t * t * t * p[3]
  }
  let maxErr = 0
  let spread = { lo: Infinity, hi: -Infinity }
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    for (const seg of [left, right]) {
      const x = cubic(seg.x, t)
      const y = cubic(seg.y, t)
      maxErr = Math.max(maxErr, Math.abs(lakiRimY(x) - y))
      spread = { lo: Math.min(spread.lo, y), hi: Math.max(spread.hi, y) }
    }
  }
  assert.ok(maxErr < 0.05, `lakiRimY is off the drawn shell by up to ${maxErr.toFixed(3)} units`)
  // A flat rim would satisfy the line above only if the shell were flat.
  assert.ok(spread.hi - spread.lo > 20,
    'the shell rim is nearly flat, so this test proves nothing — re-derive it')
})

test('لاکی opts out of exactly the head gestures that do not fit, and no more', () => {
  // The opt-out is a declaration, so it can drift from the measurement in both
  // directions: a gesture that no longer fits, or one needlessly demoted to the
  // body. Both are re-derived here from the shipped keyframes.
  const fits = (g) => headParts(g).every((p) => lakiWorst(p.action).margin > 1)
  const heads = headGestures()
  assert.ok(heads.length > 0)
  assert.deepEqual(
    heads.filter((g) => !fits(g)).sort(),
    [...(CHARACTERS.laki.gestureFallback ?? [])].filter((g) => heads.includes(g)).sort(),
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

// ------------------------------------------------------------- آوا: hair over face ---

test('ava\'s hair crown paints after her face, not before it', () => {
  // The crown is hand-authored inline in head.art, not a LAYER_ORDER entry, so
  // the test above cannot see it: the crown used to be emitted before the
  // face-skin circle, which then painted over nearly the whole thing, leaving
  // only the two side locks visible. The face circle's fill is unique in the
  // string, so its index is unambiguous; avHair's first occurrence is the
  // crown (the side locks, unaffected either way, come later).
  const svg = renderActorSVG(CHARACTERS.ava, defaultFrame('ava'))
  const faceAt = svg.indexOf('r="45" fill="url(#avS)"')
  const hairAt = svg.indexOf('fill="url(#avHair)"')
  assert.ok(faceAt >= 0 && hairAt >= 0, 'both the face circle and the hair fill must be present')
  assert.ok(faceAt < hairAt, 'the face-skin circle must paint before the hair crown, or the crown vanishes under it')
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
// The pivot is read off the shipped spec by `headPivot`, not restated here: a
// test that keeps its own copy of the origin would go on passing after someone
// moved the real one to the disc centre, which is precisely the error worth
// catching. The silhouette geometry and the overlap sweep live in
// tools/lib/probes.mjs alongside the sheet that draws them.

test('tondpa: the head never pulls free of the body at any emotion x intensity', () => {
  // Pinned from the measurement, not from the code under test: at tilt 0 the
  // head detaches at headDrop ≈ -10.6, and the worst posture on the roster
  // (surprised at intensity 1, plus micro) reaches -3.9. The floor below is set
  // well inside that headroom so it fires on a posture edit long before the
  // seam visibly opens.
  const FLOOR = 120
  assert.ok(tondpaSeamOverlap(0, TP.detachAt) < 1, 'the detach threshold has moved; re-derive FLOOR')

  let worst = { area: Infinity }
  for (const emotion of Object.keys(EMOTIONS)) {
    for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
      const p = resolvePosture(emotion, intensity, CHARACTERS.tondpa.posture)
      const area = tondpaSeamOverlap((p.headTilt ?? 0) + MICRO_WORST.rot, (p.headDrop ?? 0) + MICRO_WORST.y)
      if (area < worst.area) worst = { area, emotion, intensity }
    }
  }
  assert.ok(worst.area > FLOOR,
    `tondpa's head comes off its shoulders at ${worst.emotion}/${worst.intensity} (overlap ${worst.area.toFixed(0)} < ${FLOOR})`)
})

// ── head gestures against the same seams ────────────────────────────────────
//
// The posture sweeps above answer "can an emotion pull the head off?". They say
// nothing about "can a gesture?", and both characters natively drive `lyr-head`
// for `nod` and `shake` — so the question is real, and it is the same
// authored-versus-derived gap that was found in the لاکی window.
//
// What a gesture does to the seam is decided by one fact about the rig: a
// gesture plays as a real CSS animation on `.lyr-head`'s `transform`, and the
// posture is an *inline* transform on the same element and the same property.
// CSS puts the animation origin above inline author declarations, so for the
// length of the gesture the head pose is the action's, outright — not the
// action composed onto the posture. (Verified: `playGesture` never touches
// `el.style.transform`, only `el.style.animation`.) That is why the sweep below
// is over the action alone. If that ever changed — if gestures started
// composing — the numbers here would understate the risk badly: the worst
// composed case for تندپا is an overlap of 86, well under its own floor of 120.
const headAction = (slug, g) => {
  const parts = GESTURES[g].parts.filter((p) => p.layer === 'lyr-head')
  return CHARACTERS[slug].gestureFallback?.includes(g) ? [] : parts
}
const headGesturesOf = (slug) => GESTURE_NAMES.filter((g) => headAction(slug, g).length > 0)

test('the head gestures تندپا and خرسی actually play stay inside their seams too', () => {
  // Same shape as the لاکی window guard, and added for the same reason: the
  // posture sweep is not a sweep of the poses the head really reaches.
  const cases = [
    { slug: 'tondpa', floor: 120, overlap: (p) => tondpaSeamOverlap((p.rot ?? 0) + MICRO_WORST.rot, (p.y ?? 0) + MICRO_WORST.y) },
    { slug: 'khersi', floor: 150, overlap: (p) => khersiSeamOverlap((p.rot ?? 0) + MICRO_WORST.rot, (p.y ?? 0) + MICRO_WORST.y) },
  ]
  for (const { slug, floor, overlap } of cases) {
    const gestures = headGesturesOf(slug)
    assert.ok(gestures.length > 0, `${slug} drives no head gesture — this test has stopped measuring anything`)
    for (const g of gestures) {
      const worst = worstOverAction(headAction(slug, g)[0].action, (p) => ({ seam: overlap(p) }))
      assert.ok(worst.margin > floor,
        `${slug}'s head comes off during ${g} at t=${worst.t.toFixed(3)} (overlap ${worst.margin.toFixed(0)} < ${floor})`)
    }
  }
})

test('خرسی‏s ears stay on the head through its head gestures, not just its postures', () => {
  for (const g of headGesturesOf('khersi')) {
    const action = headAction('khersi', g)[0].action
    for (const side of ['earL', 'earR']) {
      const worst = worstOverAction(action, (p) => ({
        ear: khersiEarPenetration(side, 0, (p.rot ?? 0) + MICRO_WORST.rot, (p.y ?? 0) + MICRO_WORST.y),
      }))
      assert.ok(worst.margin > 8,
        `khersi's ${side} leaves the head during ${g} (penetration ${worst.margin.toFixed(2)})`)
    }
  }
})

// The seam test above deliberately does *not* cover this: rotating a disc about
// its own centre leaves the disc exactly where it was, so a pivot moved to
// (100,86) opens no gap at all. It would still be wrong — the head would swivel
// in place instead of craning off the shoulders — so the pivot claim needs its
// own assertion, derived from the art rather than restated from the spec.
test('tondpa: the head pivot is the measured head/body crossing, not a chosen point', () => {
  const { crossings, seamY } = discBodySeamY(TP.disc, TP.body)
  assert.equal(crossings, 2, 'the head and body no longer meet in a single seam')
  const [ox, oy] = headPivot('tondpa')
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
const khersiLayers = () =>
  CHARACTERS.khersi.render({ emotion: EMOTIONS.neutral, intensity: 1 }).layers

test('khersi: the head pivot is the measured head/body crossing', () => {
  const { crossings, seamY } = discBodySeamY(KH.head, KH.body)
  assert.equal(crossings, 2, 'the head and body no longer meet in a single seam')
  const [ox, oy] = headPivot('khersi')
  assert.equal(ox, 100)
  assert.ok(Math.abs(oy - seamY) <= 1, `head pivot ${oy} is not the measured seam ${seamY.toFixed(2)}`)
})

test('khersi: each ear pivots at the head/ear chord midpoint, not at its own centre', () => {
  // The ear disc is centred *outside* the skull, so there is no base to read off
  // and the pivot has to come from the two-circle intersection. Note that the
  // ear's own centre would also "work" — rotating a circle about its centre is a
  // no-op, so nothing would visibly break and no sweep would catch it. Only this
  // assertion does.
  for (const [side, ear] of Object.entries(KH.ears)) {
    const { d, point: want } = earChordMidpoint(ear, KH.head)
    assert.ok(d > KH.head.r, `${side}: precondition — the ear centre should sit outside the head disc`)
    const got = headPivot('khersi', side)
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
  // Pinned from the measurement: the head detaches at headDrop ≈ -14.6, and the
  // worst shipped posture (surprised at 1, plus micro) reaches -4.9.
  const SEAM_FLOOR = 220
  assert.ok(khersiSeamOverlap(0, KH.detachAt) < 1, 'the detach threshold has moved; re-derive SEAM_FLOOR')

  let worstSeam = { a: Infinity }, worstEar = { p: Infinity }
  for (const emotion of Object.keys(EMOTIONS)) {
    for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
      const p = resolvePosture(emotion, intensity, CHARACTERS.khersi.posture)
      const tilt = (p.headTilt ?? 0) + MICRO_WORST.rot, drop = (p.headDrop ?? 0) + MICRO_WORST.y
      const a = khersiSeamOverlap(tilt, drop)
      if (a < worstSeam.a) worstSeam = { a, emotion, intensity }
      for (const side of ['earL', 'earR']) {
        // Ears are their own layer with their own pivot, so unlike تندپا's
        // cheeks they are *not* rigid with the head and can in principle walk
        // off it. They do not, and the chord-midpoint pivot is why.
        const pen = khersiEarPenetration(side, p.ears ?? 0, tilt, drop)
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

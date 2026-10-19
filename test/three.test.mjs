/**
 * The three.js renderer, headless. `ActorModel` needs no DOM and no WebGL —
 * three's scene graph is plain math — so every check here reads the posed
 * object tree directly: where a joint sits, how far it turned, what the face
 * shows. `ThreeActor` (canvas, lights, loop) is the thin browser shell around
 * it and is exercised by the demo page, not here.
 *
 * The point of most of these is agreement with the SVG rig: the same frame and
 * the same data must mean the same pose, so the expected numbers below come
 * from the shared tables (posture, gestures, gaits), not from the 3D code.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  CHARACTERS, resolvePosture, posturePoses, BROW_LINES, DEFAULT_TURN3D, VISEMES, resolveEmotion, drawMouth,
} from '../dist/index.js'
import {
  ActorModel, buildModel, artToWorld, MOTION_3D, MOOD_POSES,
  skinModel, distanceField, pillowHeights, silhouette, solidGeometry, paintBias, dropMarks, SKIN_GRID, SKIN_CELL,
} from '../dist/three/index.js'

const roozi = CHARACTERS.roozi
const D = 180 / Math.PI
const rnd = () => 0.5
const model = (opts = {}) => new ActorModel(roozi, { random: rnd, blink: false, micro: { amount: 0 }, ...opts })
const run = (m, s) => { for (let t = 0; t < s; t += 1 / 60) m.tick(1 / 60) }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps
const world = (o) => o.getWorldPosition(new THREE.Vector3())

test('art space maps onto the ground under the character', () => {
  const v = artToWorld([100, 188, 0])
  assert.deepEqual([v.x, v.y, v.z], [0, 0, 0])
  const h = artToWorld([120, 100, 5])
  assert.deepEqual([h.x, h.y, h.z], [20, 88, 5])
})

test('the tree nests as the SVG layers nest, each joint at its declared pivot', () => {
  const b = buildModel(roozi)
  const parent = (n) => b.joints.get(n).node.parent.name
  assert.equal(parent('body'), 'root')
  assert.equal(parent('torso'), 'mood')
  assert.equal(parent('head'), 'torso')
  assert.equal(parent('earL'), 'head')
  assert.equal(parent('nearArm'), 'torso')
  assert.equal(parent('tail'), 'torso')
  b.object.updateMatrixWorld(true)
  for (const [l, spec] of Object.entries(roozi.body3d.layers)) {
    const w = world(b.joints.get(l).node)
    const want = artToWorld(spec.pivot)
    assert.ok(w.distanceTo(want) < 1e-9, `${l} pivot at ${w.toArray()} not ${want.toArray()}`)
  }
  b.dispose()
})

test('a character without body3d is refused by name, not half-built', () => {
  const svgOnly = { ...roozi, slug: 'flat-fox', body3d: undefined }
  assert.throws(() => buildModel(svgOnly), /flat-fox/)
})

test('every character has a 3D body with its 2D layers, pivots and face', () => {
  for (const spec of Object.values(CHARACTERS)) {
    const b3 = spec.body3d
    assert.ok(b3, `${spec.slug} has a body3d`)
    const layers = spec.render({ emotion: resolveEmotion('neutral'), intensity: 1 }).layers
    const named = Object.keys(layers).filter((l) => l !== 'shadow').sort()
    assert.deepEqual(Object.keys(b3.layers).sort(), named, `${spec.slug}: the same joints as the SVG rig`)
    for (const l of named) {
      const [x, y] = b3.layers[l].pivot
      assert.deepEqual([x, y], layers[l].origin, `${spec.slug} ${l}: the pivot is the 2D origin`)
    }
    assert.ok(named.includes(b3.face.layer), `${spec.slug}: the face rides a layer it has`)
    const b = buildModel(spec)
    assert.ok(b.face, `${spec.slug} builds a face`)
    assert.equal(b.face.eyes.length, spec.eyes.x.length)
    b.dispose()
  }
})

test('posture lands on the same joints with the same numbers as the SVG rig', () => {
  const m = model()
  m.apply({ emotion: 'sad', intensity: 1 })
  m.finish()
  const p = posturePoses(resolvePosture('sad', 1, roozi.posture))
  const j = m.parts.joints
  // rot is clockwise degrees in art space, so it becomes -z here.
  assert.ok(near(-j.get('tail').node.rotation.z * D, p.tail.rot, 1e-9))
  assert.ok(near(-j.get('earL').node.rotation.z * D, p.earL.rot, 1e-9))
  // head drop: art y down is world y down.
  const head = j.get('head')
  assert.ok(near(head.base.y - head.node.position.y, p.head.y, 1e-9))
  m.dispose()
})

test('the engine runs without its 2D turn stand-ins', () => {
  const m = model()
  assert.equal(m.motion.depth.travel, 0)
  assert.equal(m.motion.attention.turn, 0)
  assert.equal(m.motion.attention.pitch, 0)
  // ...and a caller cannot put them back underneath the 3D layer.
  m.setMotion({ depth: { travel: 9 }, attention: { turn: 9 } })
  assert.equal(m.motion.depth.travel, 0)
  assert.equal(m.motion.attention.turn, 0)
  assert.deepEqual(MOTION_3D, { depth: { travel: 0 }, attention: { turn: 0, pitch: 0 } })
  m.dispose()
})

test('yaw turns the body for real, and the head turns on top for gaze', () => {
  const m = model()
  m.apply({ yaw: 1 })
  m.finish()
  const j = m.parts.joints
  assert.ok(near(j.get('root').node.rotation.y * D, DEFAULT_TURN3D.body, 1e-6))
  // Gaze straight ahead: the head follows the body, no extra turn.
  assert.ok(near(j.get('head').node.rotation.y * D, DEFAULT_TURN3D.body * m.motion.depth.follow * 0, 1e-6))
  m.apply({ yaw: 0, gaze: { x: 1, y: 1 } })
  m.finish()
  const head = j.get('head').node
  const follow = m.motion.depth.follow
  // depth spring adds follow·gaze, attention adds the head's own turn.
  assert.ok(near(head.rotation.y * D, follow * DEFAULT_TURN3D.body + DEFAULT_TURN3D.head, 1e-6), `${head.rotation.y * D}`)
  assert.ok(near(head.rotation.x * D, DEFAULT_TURN3D.pitch, 1e-6), 'looking down tips the head down')
  assert.ok(near(j.get('root').node.rotation.y, 0, 1e-9), 'gaze alone does not turn the body')
  m.dispose()
})

test('the turn springs ease rather than jump', () => {
  const m = model()
  // yaw is itself an eased frame channel; the spring then follows it.
  m.apply({ yaw: 1 })
  run(m, 0.15)
  const r = m.parts.joints.get('root').node.rotation.y * D
  assert.ok(r > 0 && r < DEFAULT_TURN3D.body * 0.95, `partway: ${r}`)
  run(m, 2)
  assert.ok(near(m.parts.joints.get('root').node.rotation.y * D, DEFAULT_TURN3D.body, 1e-2))
  m.dispose()
})

test('a character can set its own turn ranges', () => {
  const spec = { ...roozi, body3d: { ...roozi.body3d, turn: { body: 20 } } }
  const m = new ActorModel(spec, { random: rnd, blink: false, micro: { amount: 0 } })
  m.apply({ yaw: -1 })
  m.finish()
  assert.ok(near(m.parts.joints.get('root').node.rotation.y * D, -20, 1e-6))
  m.dispose()
})

test('gaze moves the irises in the eye plane, both eyes together', () => {
  const m = model()
  m.apply({ gaze: { x: 1, y: -1 }, emotion: 'neutral' })
  m.finish()
  for (const e of m.parts.face.eyes) {
    assert.ok(near(e.iris.position.x, e.travel, 1e-9))
    assert.ok(near(e.iris.position.y, e.travel, 1e-9), 'gaze up is +y')
  }
  m.dispose()
})

test('facing left mirrors the whole tree, once', () => {
  const m = model()
  assert.equal(m.object.scale.x, 1)
  m.apply({ facing: 'left' })
  assert.equal(m.object.scale.x, -1)
  m.apply({ facing: 'right' })
  assert.equal(m.object.scale.x, 1)
  m.dispose()
})

test('a blink closes the eyes and opens them again; squint and widen scale them', () => {
  const m = model()
  m.finish()
  const eye = m.parts.face.eyes[0].node
  const open = eye.scale.y
  m.blink()
  run(m, 0.06)
  assert.ok(eye.scale.y < open * 0.2, `shut: ${eye.scale.y}`)
  run(m, 0.6)
  assert.ok(near(eye.scale.y, open, 1e-3), 'reopened')
  m.apply({ emotion: 'surprised', intensity: 1 })
  m.finish()
  assert.ok(eye.scale.x > 1, 'surprise widens')
  m.apply({ emotion: 'happy', intensity: 1 })
  m.finish()
  const e = resolveEmotion('happy')
  assert.ok(eye.scale.y < eye.scale.x || e.squint === 0, 'happy squints')
  m.dispose()
})

test('the brows take the 2D brow lines', () => {
  const m = model()
  for (const key of ['idle', 'sad', 'confused']) {
    const emotion = { idle: 'neutral', sad: 'sad', confused: 'confused' }[key]
    m.apply({ emotion, browRaise: 0 })
    m.finish()
    assert.equal(resolveEmotion(emotion).brow, key)
    m.parts.face.brows.forEach((b, i) => {
      const [l, r] = BROW_LINES[key][i]
      assert.ok(near(b.mesh.position.y, -(l + r) / 2, 1e-9), `${key} brow ${i} height`)
    })
  }
  m.apply({ browRaise: 1 })
  m.finish()
  const b0 = m.parts.face.brows[0].mesh.position.y
  m.apply({ browRaise: 0 })
  m.finish()
  assert.ok(near(b0 - m.parts.face.brows[0].mesh.position.y, 5, 1e-6), 'browRaise lifts 5 units, as in 2D')
  m.dispose()
})

test('every viseme picks one mouth, and the closed ones differ', () => {
  const m = model()
  const shown = (mouth) => ['open', 'smile', 'press'].filter((k) => mouth[k].visible)
  for (const v of Object.keys(VISEMES)) {
    m.apply({ viseme: v, mouthOpen: 0 })
    const s = shown(m.parts.face.mouth)
    assert.equal(s.length, 1, `${v}: ${s}`)
  }
  m.apply({ viseme: 'rest' })
  assert.deepEqual(shown(m.parts.face.mouth), ['smile'])
  m.apply({ viseme: 'mbp' })
  assert.deepEqual(shown(m.parts.face.mouth), ['press'])
  m.apply({ viseme: 'aa' })
  const open = m.parts.face.mouth.open
  assert.ok(near(open.scale.y, 2 + VISEMES.aa.o * 7, 1e-9), 'open height as drawMouth')
  m.apply({ viseme: 'l' })
  assert.ok(m.parts.face.mouth.tongue.visible, 'l shows the tongue')
  m.apply({ viseme: 'rest', mouthOpen: 1 })
  m.finish()
  assert.deepEqual(shown(m.parts.face.mouth), ['open'], 'mouthOpen overrides the viseme')
  m.dispose()
})

test('a beak character opens a beak, as far as the 2D one opens', () => {
  const boomi = CHARACTERS.boomi
  const mouth2d = boomi.render({ emotion: resolveEmotion('neutral'), intensity: 1 }).mouth
  const m = new ActorModel(boomi, { random: rnd, blink: false, micro: { amount: 0 } })
  const beak = m.parts.face.mouth.beak
  assert.ok(beak, 'a beak is built')
  assert.equal(roozi.render({ emotion: resolveEmotion('neutral'), intensity: 1 }).mouth.beak, undefined)
  assert.equal(model().parts.face.mouth.beak, null, 'lips stay lips')
  for (const v of Object.keys(VISEMES)) {
    m.apply({ viseme: v, mouthOpen: 0 })
    const lips = ['open', 'smile', 'press'].filter((k) => m.parts.face.mouth[k].visible)
    assert.deepEqual(lips, [], `${v}: no lips on a beak`)
    // Read the opening and width off the 2D markup: the lower mandible's
    // control point sits at cy + 2 + open, the upper starts at cx − 11·w.
    const svg = drawMouth(mouth2d, VISEMES[v], 0)
    const [, x0] = svg.match(/M([\d.-]+) /)
    const ctl = [...svg.matchAll(/Q [\d.-]+ ([\d.-]+)/g)].map((q) => +q[1])
    const open = ctl[2] - (mouth2d.cy + 2)
    const w = (mouth2d.cx - +x0) / 11
    // The lower mandible's edges in the mouth's frame, from its cone: pitched
    // 90°, the cone's z scale is its half-height.
    const g = beak.lower
    const cone = g.children[0]
    const edge = (sign) => g.position.y + g.scale.y * (cone.position.y + sign * cone.scale.z)
    assert.ok(near(edge(1), beak.rest + beak.half, 1e-9), `${v}: the top edge stays`)
    assert.ok(near(beak.rest - beak.half - edge(-1), open / 2, 1e-9), `${v}: drops ${beak.rest - beak.half - edge(-1)}, 2D opens ${open}`)
    assert.ok(near(beak.upper.scale.x, w, 1e-9) && near(beak.lower.scale.x, w, 1e-9), `${v}: width ${w}`)
    assert.equal(beak.tongue.visible, svg.includes('#ff7a95'), `${v}: tongue as drawn`)
  }
  m.dispose()
})

test('speak runs on the model clock and ends at rest', () => {
  const m = model()
  m.speak('آب', 100)
  assert.equal(m.current.viseme, 'aa')
  run(m, 0.12)
  assert.equal(m.current.viseme, 'mbp')
  run(m, 0.2)
  assert.equal(m.current.viseme, 'rest')
  m.dispose()
})

test('a walk drives the limbs from the gait table and stops cleanly', () => {
  const m = model()
  m.apply({ locomotion: 'walk' })
  run(m, 0.2)
  const leg = m.parts.joints.get('nearLeg').node
  assert.ok(Math.abs(leg.rotation.z) > 0.05, 'the near leg swings')
  m.apply({ locomotion: 'idle' })
  m.finish()
  run(m, 0.05)
  assert.ok(near(leg.rotation.z, 0, 1e-9), `leg back at rest: ${leg.rotation.z}`)
  m.dispose()
})

test('a gesture plays on its layer, then releases the channel', () => {
  const m = model()
  m.apply({ gesture: 'wave' })
  run(m, 0.4)
  const arm = m.parts.joints.get('nearArm').node
  assert.ok(Math.abs(arm.rotation.z * D) > 20, `arm up: ${arm.rotation.z * D}`)
  assert.equal(m.goal.gesture, 'wave')
  run(m, 1)
  assert.equal(m.goal.gesture, null)
  assert.ok(Math.abs(arm.rotation.z * D) < 1, 'arm back down')
  m.dispose()
})

test('a semantically impossible gesture is refused and reported', () => {
  const blocked = []
  const m = model({ onGestureBlocked: (g, r) => blocked.push([g, r]) })
  m.apply({ locomotion: 'fly' })
  m.finish()
  m.apply({ gesture: 'jump' })
  assert.deepEqual(blocked, [['jump', 'semantic']])
  assert.equal(m.goal.gesture, null)
  m.dispose()
})

test('the mood carrier plays the emotion idle and a one-shot pop ends', () => {
  const m = model()
  m.apply({ emotion: 'happy', intensity: 1 })
  m.finish()
  run(m, MOOD_POSES.happy.dur / 2)
  const mood = m.parts.mood
  assert.ok(mood.node.position.y - mood.base.y > 4, 'happy floats up')
  m.apply({ emotion: 'surprised' })
  run(m, MOOD_POSES.surprised.dur + 0.1)
  assert.ok(near(mood.node.scale.x, 1, 1e-9), 'the pop has ended')
  m.dispose()
})

test('reduced motion: everything lands at once, nothing moves on its own', () => {
  const m = model({ reducedMotion: true, blink: true, micro: undefined })
  m.apply({ yaw: 1, emotion: 'happy', gesture: 'wave' })
  assert.ok(near(m.parts.joints.get('root').node.rotation.y * D, DEFAULT_TURN3D.body, 1e-6), 'turn snapped')
  assert.equal(m.goal.gesture, null, 'gesture resolved immediately')
  const snap = () => JSON.stringify([...m.parts.joints.values()].map((j) => [j.node.position.toArray(), j.node.rotation.toArray()])) +
    JSON.stringify(m.parts.mood.node.position.toArray()) + m.parts.face.eyes[0].node.scale.y
  const before = snap()
  run(m, 5)
  assert.equal(snap(), before, 'no breathing, mood, blink or spring motion')
  m.dispose()
})

test('setCharacter swaps the body in place under the same parent', () => {
  const scene = new THREE.Scene()
  const m = model()
  scene.add(m.object)
  const first = m.object
  m.setCharacter(roozi)
  assert.notEqual(m.object, first)
  assert.equal(m.object.parent, scene)
  assert.equal(first.parent, null)
  m.dispose()
  assert.equal(m.object.parent, null)
})

// --- the 2D skin's pure parts ---------------------------------------------

const C = SKIN_CELL
/** A filled disc on the skin grid, centre and radius in art units. */
const disc = (cx, cy, r) => {
  const N = SKIN_GRID
  const m = new Uint8Array(N * N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (((x + 0.5) / C - cx) ** 2 + ((y + 0.5) / C - cy) ** 2 <= r * r) m[y * N + x] = 1
  return m
}
/** The cell at art (x, y). */
const cell = (x, y) => Math.floor(y * C) * SKIN_GRID + Math.floor(x * C)
/** The same disc drawn as art: 5 px per unit, anti-aliased, over `rect`. */
const discArt = (cx, cy, r, rect) => {
  const px = 5
  const width = rect[2] * px
  const height = rect[3] * px
  const data = new Uint8ClampedArray(width * height * 4)
  for (let j = 0; j < height; j++)
    for (let i = 0; i < width; i++) {
      const x = rect[0] + (i + 0.5) / px
      const y = rect[1] + (j + 0.5) / px
      const cover = Math.min(1, Math.max(0, (r - Math.hypot(x - cx, y - cy)) * px + 0.5))
      data[(j * width + i) * 4 + 3] = Math.round(cover * 255)
    }
  return { width, height, data }
}
/** The solid's outline: its vertices on the middle plane, in art units. */
const rimOf = (geo) => {
  const p = geo.getAttribute('position')
  const n = geo.getAttribute('normal')
  const out = []
  for (let i = 0; i < p.count; i++)
    if (p.getZ(i) === 0) out.push({ x: p.getX(i) + 100, y: 188 - p.getY(i), n: [n.getX(i), n.getY(i), n.getZ(i)] })
  return out
}

test('the skin distance field measures inward from the outline, zero outside', () => {
  const d = distanceField(disc(100, 100, 30))
  assert.equal(d[cell(5, 5)], 0, 'outside')
  assert.ok(Math.abs(d[cell(100, 100)] - 30) < 1, `centre ≈ radius, got ${d[cell(100, 100)]}`)
  // Measured to the outline between cells, so the rim cell is half a cell in:
  // with whole cells, every solid would start a cell thick at its edge.
  assert.ok(near(d[cell(70.25, 100)], 0.5 / C), `the rim cell is half a cell in, got ${d[cell(70.25, 100)]}`)
  // A window that holds the mask gives the same field.
  const w = distanceField(disc(100, 100, 30), [65 * C, 65 * C, 135 * C, 135 * C])
  assert.ok(d.every((v, i) => v === w[i]), 'windowed field differs')
})

test('a layer is an ellipse in section: puff × R deep in the middle, standing vertical at its outline', () => {
  const dist = distanceField(disc(100, 100, 30))
  const h = pillowHeights(dist, 0.85)
  let R = 0
  for (const v of dist) if (v > R) R = v
  const H = R * 0.85
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] === 0) { assert.equal(h[i], 0); continue }
    // On the ellipse with semi-axes R (in) and H (deep), measured from the rim.
    const e = (h[i] / H) ** 2 + (1 - dist[i] / R) ** 2
    assert.ok(near(e, 1, 1e-4), `cell ${i}: off the ellipse (${e}) at d=${dist[i]}`)
  }
  // Vertical at the rim: half a cell in, already far higher than it is in.
  assert.ok(h[cell(70.25, 100)] > 4 * dist[cell(70.25, 100)], 'the rim leans like a lens')
})

test('a layer\'s solid is closed, its outline on the drawing\'s, its rim facing straight out', () => {
  const sil = silhouette(disc(100, 100, 30), 0.85)
  const rect = [68, 68, 64, 64]
  const traced = solidGeometry({ ...sil, image: discArt(100, 100, 30, rect), rect })
  // Watertight: every edge is shared by exactly two triangles, once each way.
  const p = traced.getAttribute('position')
  const key = (i) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`
  const idx = traced.getIndex().array
  const edges = new Map()
  for (let t = 0; t < idx.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = key(idx[t + e])
      const b = key(idx[t + ((e + 1) % 3)])
      edges.set(`${a}|${b}`, (edges.get(`${a}|${b}`) ?? 0) + 1)
    }
  for (const [e, n] of edges) {
    const [a, b] = e.split('|')
    assert.equal(n, 1, `edge ${e} used ${n} times one way`)
    assert.equal(edges.get(`${b}|${a}`), 1, `edge ${e} has no twin: the solid is open`)
  }
  // The outline is traced on the art's half-alpha line: on the true circle.
  const rim = rimOf(traced)
  assert.ok(rim.length > 300, `a fine outline, got ${rim.length} vertices`)
  let worst = 0
  for (const v of rim) {
    worst = Math.max(worst, Math.abs(Math.hypot(v.x - 100, v.y - 100) - 30))
    // Facing straight out: horizontal, along the radius.
    const out = [(v.x - 100) / 30, -(v.y - 100) / 30]
    assert.ok(v.n[2] === 0, 'the rim normal leans in z')
    assert.ok(v.n[0] * out[0] + v.n[1] * out[1] > 0.95, `rim normal ${v.n} not outward at ${v.x},${v.y}`)
  }
  assert.ok(worst < 0.03, `traced outline strays ${worst} from the drawing`)
  // Without the art, the cell grid's own estimate is coarser.
  let rough = 0
  for (const v of rimOf(solidGeometry(sil))) rough = Math.max(rough, Math.abs(Math.hypot(v.x - 100, v.y - 100) - 30))
  assert.ok(rough > worst, `tracing gained nothing: ${rough} vs ${worst}`)
})

test('the paint order becomes depth bias, not depth: later layers win face on, earlier ones yield', () => {
  // A torso, a head painted over its top edge, and a tail painted under it.
  const torso = { ...silhouette(disc(100, 130, 30), 0.85), z: 0 }
  const head = { ...silhouette(disc(100, 85, 22), 0.85), z: 0 }
  const tail = { ...silhouette(disc(125, 150, 12), 0.85), z: 0 }
  const [tb, bt, hb] = paintBias([tail, torso, head], 1, 1.5)
  assert.equal(bt, 0, 'the anchor stays put')
  // Raised just enough: the head's front clears the torso's by the gap
  // wherever both are well inside their outlines, and touches it somewhere.
  let least = Infinity
  for (let i = 0; i < head.h.length; i++) {
    if (head.sd[i] < 1 || torso.h[i] <= 0) continue
    least = Math.min(least, head.z + hb + head.h[i] - (torso.z + torso.h[i]))
  }
  assert.ok(near(least, 1.5, 1e-4), `head clears the torso by ${least}, not the gap`)
  assert.ok(tb < 0, 'the tail, painted first, yields')
  assert.deepEqual(paintBias([torso, { ...head, z: 40 }], 0, 1.5), [0, 0], 'already in front: no bias')
})

test('the fur drops the marks on an outline, not its gradient or a second colour', () => {
  // A 60 × 60 ring of outline pixels, dark at the bottom and light at the
  // top, as a body's gradient is: none of it is a mark.
  const W = 60
  const ring = (colour) => {
    const d = new Uint8ClampedArray(W * W * 4)
    const filled = new Uint8Array(W * W)
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const r = Math.hypot(x - 30, y - 30)
        if (r < 26 || r > 28) continue
        const i = y * W + x
        filled[i] = 1
        d.set([...colour(x, y), 255], i * 4)
      }
    return { d, filled }
  }
  const body = (x, y) => [150 + y * 1.5, 70 + y * 1.2, 20 + y * 0.6]
  const g = ring(body)
  const kept = g.filled.slice()
  dropMarks(g.d, W, g.filled)
  assert.deepEqual(g.filled, kept, 'a gradient outline keeps every pixel')

  // A white tuft across the left side is a mark, and only the tuft goes.
  const tuft = (x, y) => (x < 10 && Math.abs(y - 30) < 5 ? [255, 255, 255] : body(x, y))
  const t = ring(tuft)
  dropMarks(t.d, W, t.filled)
  let dropped = 0, wrong = 0
  for (let i = 0; i < W * W; i++) {
    const isTuft = t.d[i * 4] === 255 && t.d[i * 4 + 2] === 255
    if (!t.filled[i] && isTuft) dropped++
    if (!t.filled[i] && !isTuft && t.d[i * 4 + 3]) wrong++
  }
  assert.ok(dropped > 10, `the tuft is dropped (${dropped} pixels)`)
  assert.equal(wrong, 0, 'no body pixel is dropped with it')

  // Half and half is a second colour, not a mark: left alone.
  const cream = [250, 240, 220], blue = [40, 60, 200]
  const two = ring((x) => (x < 30 ? cream : blue))
  const keep2 = two.filled.slice()
  dropMarks(two.d, W, two.filled)
  assert.deepEqual(two.filled, keep2, 'a two-toned outline is not marked')

  // Six alternating bands fit no smooth field: most would go, so none does.
  const bands = ring((x, y) => ((Math.atan2(y - 30, x - 30) / Math.PI * 3 + 3) % 2 < 1 ? cream : blue))
  const keepB = bands.filled.slice()
  dropMarks(bands.d, W, bands.filled)
  assert.deepEqual(bands.filled, keepB, 'a striped outline is a pattern, not marks: left alone')
})

test('without a DOM the skin is a no-op and the primitives stay', async () => {
  const m = model()
  await skinModel(m.parts, roozi)
  const head = m.parts.joints.get('head').node
  assert.ok(head.children.some((c) => c.isMesh && c.visible), 'head primitives still shown')
  assert.ok(!head.children.some((c) => c.name.startsWith('skin-')), 'no skin added')
  m.dispose()
})

test('dispose runs the cleanups later passes register', () => {
  const m = model()
  let ran = 0
  m.parts.disposers.push(() => ran++)
  m.dispose()
  assert.equal(ran, 1)
})

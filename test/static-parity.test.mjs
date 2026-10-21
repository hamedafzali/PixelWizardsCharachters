import test from 'node:test'
import assert from 'node:assert/strict'
import { ActorRig, CHARACTERS, defaultFrame, renderActorSVG } from '../dist/index.js'
import { setupDom } from './helpers/dom.mjs'

/**
 * A static render shows what a mounted rig shows once it settles on the same
 * frame (PW-08). Up to 1.7.1 `renderActorSVG` drew the art and nothing the rig
 * writes onto it, so a server render looked straight ahead with level brows
 * and an upright spine whatever the frame said, and the page jumped when the
 * client rig took over.
 *
 * Compared hook by hook rather than as strings: the rig writes through the
 * style object and namespaces ids, and an identity transform may be spelled
 * `none`, empty, or not at all.
 */

const FRAMES = {
  default: {},
  sad: { emotion: 'sad', intensity: 1 },
  looking: { gaze: { x: 0.8, y: -0.4 }, browRaise: 0.7 },
  turned: { emotion: 'happy', yaw: 0.6 },
  everything: { emotion: 'shy', intensity: 0.8, yaw: -1, gaze: { x: -1, y: 0.5 }, browRaise: -0.5, facing: 'left' },
  wideAndTurned: { emotion: 'surprised', intensity: 1, yaw: 0.8 },
  walking: { locomotion: 'walk', emotion: 'excited' },
}

const SELECTORS = [
  '.rig-root', '.rig-body',
  ...['shadow', 'accBack', 'tail', 'farArm', 'farLeg', 'torso', 'nearLeg', 'nearArm',
    'earL', 'earR', 'head', 'torsoFront', 'accFront'].map((l) => `.lyr-${l}`),
  '.iris', '.browsG', '.mouthG',
]

/** An identity transform, however it is spelled, reads as ''. */
function norm(tf) {
  const t = (tf ?? '').trim()
  if (t === 'none') return ''
  if (/^translate\(0px,\s*0px\)$/.test(t) || /^translateY\(0px\)$/.test(t)) return ''
  // The rig always writes the widen transform; a static eye at scale 1 has none.
  if (/^translate\([\d.-]+ [\d.-]+\) scale\(1\.0000\) translate\([\d.-]+ [\d.-]+\)$/.test(t)) return ''
  return t
}

/** Every hook's transform, and every radial gradient's centre. */
function hooks(root) {
  const out = {}
  for (const sel of SELECTORS) {
    root.querySelectorAll(sel).forEach((el, i) => { out[`${sel}#${i}`] = norm(el.style.transform) })
  }
  root.querySelectorAll('.eyeG').forEach((el, i) => { out[`.eyeG#${i}`] = norm(el.getAttribute('transform')) })
  root.querySelectorAll('defs radialGradient').forEach((el, i) => { out[`radialGradient#${i}`] = el.getAttribute('cx') ?? '' })
  return out
}

function compare(slug, frame, motion) {
  const spec = CHARACTERS[slug]
  const t = setupDom()
  try {
    const rig = new ActorRig(spec, { blink: false, micro: { amount: 0 }, reducedMotion: true, motion }).mount(t.host)
    rig.apply(frame)
    rig.finish()
    const live = hooks(t.host)

    const box = t.document.createElement('div')
    box.innerHTML = renderActorSVG(spec, { ...defaultFrame(slug), ...frame }, 160, undefined, { motion })
    return { live, still: hooks(box) }
  } finally { t.restore() }
}

for (const [name, frame] of Object.entries(FRAMES)) {
  test(`static render matches the settled rig: ${name}, every character`, () => {
    for (const slug of Object.keys(CHARACTERS)) {
      const { live, still } = compare(slug, frame)
      assert.deepEqual(still, live, `${slug}, frame ${name}`)
    }
  })
}

test('the rig\'s motion option reaches the static render too', () => {
  const motion = { depth: { travel: 9 } }
  const { live, still } = compare('roozi', { yaw: 1 }, motion)
  assert.deepEqual(still, live)
  const plain = compare('roozi', { yaw: 1 })
  assert.notDeepEqual(still, plain.still, 'the override changed the render')
})

test('the channels the old renderer dropped are now in the markup', () => {
  const spec = CHARACTERS.roozi
  const at = (f) => renderActorSVG(spec, { ...defaultFrame('roozi'), ...f }, 160)
  const base = at({})
  assert.match(at({ gaze: { x: 1, y: 0 } }), /class="iris" style="transform:translate\(/, 'gaze moves the irises')
  assert.match(at({ browRaise: 1 }), /class="browsG" style="transform:translateY\(-5px\)"/, 'browRaise lifts the brows')
  assert.match(at({ emotion: 'sad', intensity: 1 }), /class="lyr-torso" style="[^"]*transform:/, 'posture bends the spine')
  assert.notEqual(at({ yaw: 1 }), base, 'yaw turns the body')
})

test('a neutral frame renders as bare as it did before', () => {
  // No identity transform clutter on a frame that moves nothing.
  const svg = renderActorSVG(CHARACTERS.roozi, defaultFrame('roozi'), 160)
  assert.doesNotMatch(svg, /transform:none|translate\(0px,0px\)|translateY\(0px\)/)
})

test('a mounted rig starts from the bare art, not a baked pose', () => {
  // Baking the rest pose into what the rig mounts would leave stale transforms
  // on hooks it only writes while they move.
  const t = setupDom()
  try {
    const rig = new ActorRig(CHARACTERS.roozi, { blink: false, reducedMotion: true })
    rig.apply({ gaze: { x: 1, y: 0 }, yaw: 1, emotion: 'sad', intensity: 1 })
    rig.mount(t.host)
    rig.apply({ gaze: { x: 0, y: 0 }, yaw: 0, emotion: 'neutral' })
    rig.finish()
    const { still } = (() => {
      const box = t.document.createElement('div')
      box.innerHTML = renderActorSVG(CHARACTERS.roozi, defaultFrame('roozi'), 160)
      return { still: hooks(box) }
    })()
    assert.deepEqual(hooks(t.host), still)
  } finally { t.restore() }
})

test('a frame applied before mount shows on mount, matching the static render', () => {
  // Up to 1.7.1 the posture of such a frame stuck to `.rig-body` for good, and
  // brows, squint and mood waited for the next change.
  const frame = FRAMES.everything
  for (const slug of ['roozi', 'boomi', 'charkhi']) {
    const t = setupDom()
    try {
      const rig = new ActorRig(CHARACTERS[slug], { blink: false, micro: { amount: 0 }, reducedMotion: true })
      rig.apply(frame)
      rig.mount(t.host)
      const box = t.document.createElement('div')
      box.innerHTML = renderActorSVG(CHARACTERS[slug], { ...defaultFrame(slug), ...frame }, 160)
      assert.deepEqual(hooks(t.host), hooks(box), slug)
    } finally { t.restore() }
  }
})

/**
 * Scrubbing: holding a gesture or a gait cycle at one instant.
 *
 * These tests can only check the *mechanism*, not the picture — jsdom has no
 * animation engine, so nothing here proves what a paused frame looks like. That
 * is the honest division of labour and it is why the scrub exists in the first
 * place: the picture is for a human, in a browser, in the studio. What is
 * checkable is that the studio is looking at the shipped animation rather than
 * a re-derivation of it, and that is exactly what these assert.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { setupDom } from './helpers/dom.mjs'
import {
  ActorRig, CHARACTERS, CHARACTER_SLUGS, GESTURES, GESTURE_NAMES, drivesGait,
  sampleAction, poseToTransform,
} from '../dist/index.js'

function withRig(slug, frame, fn, opts) {
  const dom = setupDom()
  try {
    const rig = new ActorRig(CHARACTERS[slug], { blink: false, micro: { amount: 0 }, ...opts })
    rig.mount(dom.host)
    if (frame) rig.apply(frame)
    rig.finish()
    dom.advance(64)
    return fn({ rig, dom, svg: dom.host.querySelector('svg') })
  } finally {
    dom.restore()
  }
}

// ── gestures ─────────────────────────────────────────────────────────────────

test('a scrubbed gesture is the real animation, paused — not an inline pose', () => {
  withRig('roozi', null, ({ rig, svg }) => {
    const plan = rig.scrubGesture('jump', 0.35)
    assert.equal(plan.mode, 'parts')
    const el = svg.querySelector(`.${plan.parts[0].layer}`)
    // The same @keyframes name playGesture would start.
    assert.match(el.style.animation, /^caG_jump_/,
      'the scrub is not running the shipped keyframes')
    assert.equal(el.style.animationPlayState, 'paused')
    // Negative delay seeks into the timeline; 0.35 of the action's duration.
    const dur = plan.parts[0].action.dur
    assert.equal(Math.abs(parseFloat(el.style.animationDelay) + 0.35 * dur) < 1e-9, true,
      `delay ${el.style.animationDelay} does not seek to 35% of ${dur}s`)
  })
})

test('scrubbing to 0 and to 1 lands at the two ends of the same rule', () => {
  withRig('roozi', null, ({ rig, svg }) => {
    const plan = rig.scrubGesture('wave', 0)
    const el = svg.querySelector(`.${plan.parts[0].layer}`)
    const rule = el.style.animation
    assert.equal(parseFloat(el.style.animationDelay), 0)
    rig.scrubGesture('wave', 1)
    assert.equal(el.style.animation, rule, 'the two ends are not the same animation')
    assert.equal(Math.abs(parseFloat(el.style.animationDelay) + plan.parts[0].action.dur) < 1e-9, true)
  })
})

test('releasing a scrub clears the animation instead of leaving the rig frozen', () => {
  withRig('roozi', null, ({ rig, svg }) => {
    const plan = rig.scrubGesture('spin', 0.5)
    const el = svg.querySelector(`.${plan.parts[0].layer}`)
    assert.notEqual(el.style.animation, '')
    rig.scrubGesture('spin', null)
    assert.equal(el.style.animation, '')
    assert.equal(el.style.animationPlayState, '')
    assert.equal(el.style.animationDelay, '')
  })
})

test('the scrub routes a gesture exactly as playGesture would, fallbacks included', () => {
  // The whole value of scrubbing is watching what ships. A scrub that resolved
  // its own plan could quietly show a gesture on a limb the character does not
  // have — the failure the old contact sheets had.
  for (const slug of CHARACTER_SLUGS) {
    withRig(slug, null, ({ rig, svg }) => {
      for (const g of GESTURE_NAMES) {
        const plan = rig.planFor(g)
        const scrubbed = rig.scrubGesture(g, 0.5)
        assert.deepEqual(scrubbed, plan, `${slug}/${g}: the scrub disagrees with the plan`)
        if (plan.mode === 'blocked') continue
        for (const part of plan.parts) {
          const el = svg.querySelector(`.${part.layer}`)
          assert.ok(el, `${slug}/${g}: planned layer ${part.layer} is not in the DOM`)
          assert.equal(el.style.animationPlayState, 'paused')
        }
      }
    })
  }
})

test('a semantically blocked gesture refuses to scrub rather than showing something', () => {
  // پرواز + a grounded-only gesture. Blocked is a real answer, and a studio
  // that showed a frame anyway would be lying about what the rig does.
  const flyer = CHARACTER_SLUGS.find((s) => (CHARACTERS[s].gaits ?? []).includes('fly'))
  assert.ok(flyer, 'no flying character left in the roster — this test is measuring nothing')
  const grounded = GESTURE_NAMES.filter((g) => !GESTURES[g].during?.includes?.('fly'))
  withRig(flyer, { locomotion: 'fly' }, ({ rig, svg }) => {
    let sawBlocked = false
    for (const g of grounded) {
      const plan = rig.scrubGesture(g, 0.5)
      if (plan.mode !== 'blocked') continue
      sawBlocked = true
      for (const el of svg.querySelectorAll('[class^="lyr-"]')) {
        assert.ok(!el.style.animation.startsWith(`caG_${g}`),
          `${g} is blocked while flying but was scrubbed onto ${el.getAttribute('class')}`)
      }
    }
    assert.ok(sawBlocked, 'nothing was blocked — the precondition for this test has gone')
  })
})

// ── gait cycles ──────────────────────────────────────────────────────────────

const phaseDriven = () =>
  CHARACTER_SLUGS.filter((s) => drivesGait('walk',
    (t) => t === 'root' || t === 'torso' ||
      !!CHARACTERS[s].render({ emotion: { squint: 0, wide: 0, mouth: 'soft', brow: 'idle' }, intensity: 1 }).layers?.[t],
    CHARACTERS[s].gaits))

test('pinning a gait phase writes a different pose at different phases', () => {
  const driven = phaseDriven()
  assert.ok(driven.length > 0, 'no phase-driven walker in the roster')
  for (const slug of driven) {
    withRig(slug, { locomotion: 'walk' }, ({ rig, svg }) => {
      const at = (p) => {
        assert.equal(rig.pinGaitPhase(p), 'phase')
        return [...svg.querySelectorAll('[class^="lyr-"]')]
          .map((el) => `${el.getAttribute('class')}=${el.style.transform}`).join('|')
      }
      const poses = new Set([0, 0.25, 0.5, 0.75].map(at))
      assert.ok(poses.size >= 3,
        `${slug}: four phases of a walk produced ${poses.size} distinct poses`)
    })
  }
})

test('a pinned phase survives ticks, and releasing it lets the cycle run again', () => {
  const slug = phaseDriven()[0]
  withRig(slug, { locomotion: 'walk' }, ({ rig, dom, svg }) => {
    const read = () => [...svg.querySelectorAll('[class^="lyr-"]')].map((el) => el.style.transform).join('|')
    rig.pinGaitPhase(0.3)
    const held = read()
    dom.advance(400)
    assert.equal(read(), held, 'the pinned phase drifted while the rig ticked')
    rig.pinGaitPhase(null)
    // Sampled at several offsets, not one: a walk cycle is periodic, so a
    // single sample can land back on the pinned pose by coincidence and read
    // as "the pin never released". (It does — 200ms after releasing a pin at
    // phase 0.3 is one such moment.)
    const after = [50, 100, 150, 250].map((ms) => {
      dom.advance(ms)
      return read()
    })
    assert.ok(after.some((p) => p !== held), 'releasing the pin did not resume the cycle')
  })
})

test('a CSS-fallback walker is frozen through the animation, since it has no phase to pin', () => {
  // The two mechanisms are not interchangeable: pausing a CSS animation does
  // nothing for a phase-driven character, and pinning a phase does nothing for
  // this one. Getting this wrong would look like a scrub control that works for
  // some characters and silently does nothing for others.
  const css = CHARACTER_SLUGS.filter((s) => !phaseDriven().includes(s))
  assert.ok(css.length > 0, 'every character is phase-driven now — this case is gone')
  for (const slug of css) {
    withRig(slug, { locomotion: 'walk' }, ({ rig, svg }) => {
      const how = rig.pinGaitPhase(0.4)
      assert.equal(how, 'css', `${slug} reported ${how}`)
      const root = svg.querySelector('.rig-root')
      assert.equal(root.style.animationPlayState, 'paused')
      assert.ok(parseFloat(root.style.animationDelay) < 0,
        'the delay must be negative to seek into the timeline')
      rig.pinGaitPhase(null)
      assert.equal(root.style.animationPlayState, '')
    })
  }
})

// ── reduced motion ───────────────────────────────────────────────────────────
//
// The CSS-fallback hold above pauses a real `animation`. Under
// `prefers-reduced-motion`, `RIG_CSS`'s `animation:none!important` cannot tell
// that paused hold apart from a running animation and kills both — so a scrub
// that only checked `animationPlayState`/`animationDelay`, as the tests above
// do, would keep passing while a reduced-motion viewer saw nothing at all.
// These assert the actual fallback: a transform sampled and written directly,
// bypassing `animation` entirely.

test('scrubbing a CSS-fallback walker (سیمرغ) under reduced motion writes a visible, moving pose', () => {
  withRig('simorgh', { locomotion: 'walk' }, ({ rig, svg }) => {
    const root = svg.querySelector('.rig-root')
    const at = (p) => {
      assert.equal(rig.pinGaitPhase(p), 'css')
      // Reduced motion must not lean on the animation mechanism at all — that
      // is exactly the path the OS/stylesheet rule silently defeats.
      assert.equal(root.style.animationPlayState, '',
        'still holding via animation-play-state, which reduced motion cannot show')
      assert.equal(root.style.animationDelay, '')
      return root.style.transform
    }
    const [p0, p25, p50, p75] = [0, 0.25, 0.5, 0.75].map(at)
    assert.ok([p0, p25, p50, p75].every((p) => p !== ''), 'a sampled phase must not be blank')
    assert.notEqual(p0, p25, '0% and 25% of the cycle must not sample the same pose')
    assert.notEqual(p25, p50, '25% and 50% of the cycle must not sample the same pose')
    assert.notEqual(p0, p50, '0% and 50% of the cycle must not sample the same pose')
    rig.pinGaitPhase(null)
    assert.equal(root.style.transform, '', 'releasing the pin must clear the direct write too')
  }, { reducedMotion: true })
})

test('scrubbing a gesture under reduced motion writes the sampled pose, not a paused animation', () => {
  withRig('roozi', null, ({ rig, svg }) => {
    const plan = rig.scrubGesture('wave', 0.35)
    assert.equal(plan.mode, 'parts')
    const part = plan.parts[0]
    const el = svg.querySelector(`.${part.layer}`)
    assert.equal(el.style.animation, '', 'reduced motion must not rely on the CSS animation')
    assert.equal(el.style.animationPlayState, '')
    const expected = poseToTransform(sampleAction(part.action, 0.35))
    assert.equal(el.style.transform, expected,
      'the scrubbed transform must match sampleAction at the same t')
    rig.scrubGesture('wave', null)
    assert.equal(el.style.transform, '', 'releasing the scrub must clear the direct write')
  }, { reducedMotion: true })
})

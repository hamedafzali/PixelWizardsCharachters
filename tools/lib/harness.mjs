/**
 * One way to get a rendered moment out of the library, for both hosts.
 *
 * A contact sheet in Node and the studio in a browser want the same thing —
 * "this character, in this frame, at this instant" — and every throwaway script
 * so far re-answered it slightly differently. Some drove a real {@link ActorRig}
 * through jsdom and read the composed transforms back; others called
 * `renderActorSVG` and then string-injected transforms they had recomputed by
 * hand from `resolvePosture`. The second kind is subtly weaker: it depicts what
 * the author believes the rig would write, not what it wrote.
 *
 * So everything here goes through a real rig on a real (jsdom) DOM.
 */

import { setupDom } from '../../test/helpers/dom.mjs'
import {
  ActorRig, CHARACTERS, RIG_CSS, poseToTransform, sampleAction, frameCount,
  planGesture, GESTURES, drivesGait,
} from '../../dist/index.js'

/**
 * Mount a character, settle it, and hand the live SVG to `fn`.
 *
 * Blink and idle micro-motion are off by default: a contact sheet has to be
 * reproducible, and both of those are driven by a seeded-but-advancing random
 * walk that would make two runs of the same sheet differ.
 */
export function withRig(slug, { frame = {}, rig: rigOpts = {}, settleMs = 64 } = {}, fn) {
  const dom = setupDom()
  try {
    const rig = new ActorRig(CHARACTERS[slug], { blink: false, micro: { amount: 0 }, ...rigOpts })
    rig.mount(dom.host)
    rig.apply(frame)
    rig.finish()
    dom.advance(settleMs)
    const svg = dom.host.querySelector('svg')
    return fn({ svg, rig, dom })
  } finally {
    dom.restore()
  }
}

/** Render one cell: a character in a frame, optionally posed further by `pose`. */
export function shoot(slug, { frame = {}, size = 150, pose, rig: rigOpts, settleMs } = {}) {
  return withRig(slug, { frame, rig: rigOpts, settleMs }, ({ svg }) =>
    snapshot(svg, size, pose))
}

/**
 * Serialise the mounted SVG at a given size, after applying `pose`.
 *
 * Split out from {@link shoot} so a filmstrip can pose-and-shoot the *same*
 * mounted rig many times. Standing up a fresh jsdom per frame costs ~5ms and a
 * gesture sheet wants several hundred of them.
 */
export function snapshot(svg, size = 150, pose) {
  if (pose) pose(svg)
  svg.setAttribute('width', size)
  svg.setAttribute('height', size)
  return svg.outerHTML
}

// No `clear` helper on purpose: a filmstrip writes the *same* set of driven
// layers on every frame, so each one overwrites the last and the posture the
// rig wrote to every other layer must survive untouched.

/**
 * Park a layer at a pose, the way the browser would while an action plays.
 *
 * Replacing rather than composing is deliberate and matches the rig: a gesture
 * runs as a real CSS animation, and a running animation outranks the inline
 * transform the rig wrote, so it wins outright. Composing here would depict a
 * blend the browser never produces.
 */
export function parkLayer(svg, layer, pose) {
  const el = svg.querySelector(`.${layer}`)
  if (!el) return false
  el.style.transform = poseToTransform(pose)
  return true
}

/**
 * How a gesture would actually play for one character in one locomotion state,
 * resolved through the shipped planner rather than re-derived.
 *
 * Returns the plan plus the layer/action pairs to drive. Every sheet asks this
 * question, and asking it any other way is how a sheet ends up depicting a
 * gesture on a limb the character does not have.
 */
export function gesturePlanFor(slug, gesture, locomotion = 'idle') {
  const spec = CHARACTERS[slug]
  const gait = locomotion !== 'idle' && drivesGait(spec, locomotion) ? locomotion : null
  const layers = spec.render({ emotion: { squint: 0, wide: 0, mouth: 'soft', brow: 'idle' }, intensity: 1 }).layers
  const hasLayer = (l) =>
    l === 'rig-body' || l === 'rig-root' || Boolean(layers?.[l.replace(/^lyr-/, '')])
  return planGesture(gesture, locomotion, gait, hasLayer, spec.gestureFallback)
}

/**
 * A gesture as a filmstrip: `cols` evenly-spaced moments across the whole
 * action, each already resolved to the layers it drives.
 *
 * `t` spans the derived anticipation and settle as well as the authored beats,
 * which is the point — those are the frames no sheet has ever shown.
 */
export function gestureStrip(slug, gesture, cols = 9, locomotion = 'idle') {
  const plan = gesturePlanFor(slug, gesture, locomotion)
  const def = GESTURES[gesture]
  const antT = (a) => (a.anticipation ?? 0.8) > 0 ? (a.antTime ?? 0.18) : 0
  const setT = (a) => (a.settle ?? 0.8) > 0 ? (a.settleTime ?? 0.26) : 0

  if (plan.mode === 'blocked') return { plan, frames: [], def }

  const lead = plan.parts[0].action
  const frames = []
  for (let i = 0; i < cols; i++) {
    const t = cols === 1 ? 0 : i / (cols - 1)
    frames.push({
      t,
      phase: t < antT(lead) ? 'anticipation' : t > 1 - setT(lead) ? 'settle' : 'action',
      poses: plan.parts.map((p) => ({ layer: p.layer, pose: sampleAction(p.action, t) })),
    })
  }
  return { plan, frames, def, fps: frameCount(lead, 60) }
}

/** The stylesheet a standalone sheet needs so the rendered SVGs behave. */
export const sheetRigCss = () => RIG_CSS.replace(/\.ca-svg/g, 'svg')

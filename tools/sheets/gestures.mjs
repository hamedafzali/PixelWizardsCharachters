/**
 * Gestures × characters, rendered through the animation that actually ships.
 *
 * Every gesture sheet before this one parked a layer at the largest pose in the
 * gesture's `poses` array and called that the gesture. That was wrong twice
 * over: it never showed a single derived frame — the anticipation and the four
 * settle beats `buildAction` adds appear in no `poses` array — and its idea of
 * "largest" was `Math.abs(rot ?? y ?? x)`, first-defined-wins, while the
 * derivation picks its peak with a weighted magnitude across all six channels.
 * So the sheet routinely parked on a different pose than the one the
 * anticipation was built to counter.
 *
 * Here each row is a real filmstrip: `sampleAction` evaluated on an even grid
 * across the whole action, with the anticipation and settle windows marked.
 */

import { CHARACTER_SLUGS, GESTURE_NAMES, GESTURE_DURING, CHARACTERS } from '../../dist/index.js'
import { shoot, withRig, snapshot, parkLayer, gestureStrip, gesturePlanFor } from '../lib/harness.mjs'
import { page, grid, tagged, esc } from '../lib/sheet.mjs'

export const name = 'gestures'
export const title = 'Gestures — every character, through the shipped animation'

const COLS = 9
const SIZE = 104

const REASON = {
  'missing-layer': 'no such limb',
  'gait-owns-layer': 'the gait owns it',
  'character-opt-out': 'declared opt-out',
}

/**
 * One filmstrip: a character playing one gesture, sampled across the action.
 *
 * The rig is mounted once and re-posed per frame. Every frame writes the same
 * set of driven layers, so each overwrites the last while the posture the rig
 * composed onto every other layer survives — which is what makes these frames
 * the real composed pose rather than the gesture in isolation.
 */
function strip(slug, gesture, locomotion) {
  const { plan, frames } = gestureStrip(slug, gesture, COLS, locomotion)
  if (plan.mode === 'blocked') {
    return `<td class="blocked-cell" colspan="${COLS}">blocked — ${esc(gesture)} makes no sense while ${esc(locomotion)}</td>`
  }
  return withRig(slug, { frame: { locomotion } }, ({ svg }) =>
    frames.map((f) => {
      const html = snapshot(svg, SIZE, (s) => {
        for (const { layer, pose } of f.poses) parkLayer(s, layer, pose)
      })
      const mark = f.phase === 'action' ? '' : f.phase.slice(0, 4)
      return `<td><div class="cell">${html}</div><div class="ph ${f.phase}">${mark} ${(f.t * 100).toFixed(0)}%</div></td>`
    }).join(''))
}

export function build() {
  const parts = []
  parts.push(`<h1>${esc(title)}</h1>`)
  parts.push(`<p class="lede">Each strip is one gesture sampled at ${COLS} even moments across its
    <b>whole</b> action — the derived anticipation and settle included, not only the authored poses.
    This is the first time these frames have been drawn rather than computed. Characters that take the
    whole-body fallback are marked; the reason comes from <code>planGesture</code>, not from guesswork.</p>`)
  parts.push(`<p class="legend">
    <span class="k"><span class="sw" style="background:#ff9f0a"></span><b>anticipation</b> — derived counter-move and load-up</span>
    <span class="k"><span class="sw" style="background:#64d2ff"></span><b>settle</b> — derived impact, rebound, rest</span>
    <span class="k"><span class="sw" style="background:#0a84ff"></span>the gesture's own beats</span>
  </p>`)

  for (const gesture of GESTURE_NAMES) {
    const during = GESTURE_DURING[gesture]
    parts.push(`<h2>${esc(gesture)}</h2>`)
    parts.push(`<p class="note">plays during ${during.map((d) => `<code>${d}</code>`).join(' ')}${
      during.length < 3 ? ' — semantically blocked elsewhere' : ''}</p>`)

    const rows = CHARACTER_SLUGS.map((slug) => {
      const plan = gesturePlanFor(slug, gesture, 'idle')
      const label = plan.mode === 'fallback'
        ? `${slug} <span class="ph">fallback · ${REASON[plan.reason] ?? plan.reason}</span>`
        : slug
      return `<tr><td class="n">${label}</td>${strip(slug, gesture, 'idle')}</tr>`
    }).join('')

    const head = `<tr><th>${esc(gesture)}</th>${
      Array.from({ length: COLS }, (_, i) => `<th>${((i / (COLS - 1)) * 100).toFixed(0)}%</th>`).join('')}</tr>`
    parts.push(`<div class="wrap"><table>${head}${rows}</table></div>`)
  }

  // A gesture restricted to grounded locomotion should refuse while flying —
  // shown rather than asserted, since "nothing plays" is easy to write and easy
  // to get silently wrong.
  parts.push(`<h2>Refusals, in the state that causes them</h2>`)
  parts.push(`<p class="note">A structural problem falls back; a semantic one blocks. These are the
    semantic cases: the character can physically do it, but not from here.</p>`)
  const grounded = GESTURE_NAMES.filter((g) => !GESTURE_DURING[g].includes('fly'))
  const flyers = CHARACTER_SLUGS.filter((s) => (CHARACTERS[s].gaits ?? []).includes('fly'))
  parts.push(grid({
    corner: 'while flying',
    rows: flyers,
    cols: grounded,
    cell: (slug, gesture) => {
      const plan = gesturePlanFor(slug, gesture, 'fly')
      const html = shoot(slug, { frame: { locomotion: 'fly' }, size: 104 })
      return tagged(html, plan.mode === 'blocked' ? 'blocked' : plan.mode, plan.mode === 'blocked' ? 'blocked' : 'fb')
    },
  }))

  return page(title, parts.join('\n'))
}

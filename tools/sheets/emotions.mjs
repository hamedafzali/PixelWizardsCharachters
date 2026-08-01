/**
 * Every character, every emotion, at every intensity the interpolator passes
 * through.
 *
 * This is the sheet the eye is actually good at: twelve emotions side by side
 * make a wrong brow or a mouth that reads as the neighbouring feeling obvious
 * in a way no assertion catches. Nothing here is a correctness claim — the
 * geometry sheets do that. This one exists so that "does سیمرغ look sad" has an
 * answer that is not somebody's memory.
 *
 * Intensity gets its own grid because it is the one channel that is *supposed*
 * to be invisible to the renderer: `artKeyOf` ignores it so a sweep from 0.2 to
 * 0.9 never re-renders. That is asserted in `rig-cache.test.mjs`; here it is
 * shown, which is a different and complementary thing — the art key can be
 * stable while the posture it drives goes somewhere silly.
 */

import { CHARACTER_SLUGS, EMOTIONS, EMOTION_LABELS, CHARACTERS, resolvePosture } from '../../dist/index.js'
import { shoot, withRig, snapshot } from '../lib/harness.mjs'
import { page, grid, esc } from '../lib/sheet.mjs'

export const name = 'emotions'
export const title = 'Emotions — every character, every feeling, every intensity'

const NAMES = Object.keys(EMOTIONS)
const STEPS = [0, 0.25, 0.5, 0.75, 1]

/** One character's full emotion row, from a single mounted rig. */
function emotionRow(slug, intensity) {
  return withRig(slug, {}, ({ svg, rig, dom }) =>
    NAMES.map((emotion) => {
      rig.apply({ emotion, intensity })
      rig.finish()
      dom.advance(32)
      return `<td>${snapshot(svg, 104)}</td>`
    }).join(''))
}

export function build() {
  const parts = [`<h1>${esc(title)}</h1>`]
  parts.push(`<p class="lede">Blink and idle micro-motion are off, so two runs of this sheet are
    identical and a change in it is a change in the art. Everything is at the rig's settled pose —
    the emotion has finished easing in.</p>`)

  parts.push(`<h2>At full intensity</h2>`)
  parts.push(`<p class="note">The comparison that matters most: twelve feelings that have to be
    distinguishable from each other on one face.</p>`)
  const head = `<tr><th>intensity 1</th>${NAMES.map((n) =>
    `<th>${esc(EMOTION_LABELS?.[n] ?? n)}<br><span style="opacity:.55">${esc(n)}</span></th>`).join('')}</tr>`
  parts.push(`<div class="wrap"><table>${head}${
    CHARACTER_SLUGS.map((s) => `<tr><td class="n">${esc(s)}</td>${emotionRow(s, 1)}</tr>`).join('')
  }</table></div>`)

  parts.push(`<h2>Intensity ramps</h2>`)
  parts.push(`<p class="note">Intensity is deliberately off the render path — it drives posture and
    emotion channels but never changes the art key, so a ramp is pure transform. Each block is one
    character across ${STEPS.length} steps of every emotion; the run should read as the same face
    arriving, not as a different face.</p>`)

  for (const slug of CHARACTER_SLUGS) {
    parts.push(`<h2 style="opacity:.8">${esc(slug)}</h2>`)
    parts.push(withRig(slug, {}, ({ svg, rig, dom }) => {
      const rows = NAMES.map((emotion) => {
        const cells = STEPS.map((intensity) => {
          rig.apply({ emotion, intensity })
          rig.finish()
          dom.advance(32)
          // The resolved posture under each cell: the sheet then says what it is
          // showing, so a suspicious frame can be traced without re-deriving it.
          const p = resolvePosture(emotion, intensity, CHARACTERS[slug].posture)
          const label = Object.entries(p)
            .filter(([, v]) => Math.abs(v) > 0.05)
            .map(([k, v]) => `${k[0]}${v.toFixed(0)}`)
            .join(' ')
          return `<td>${snapshot(svg, 92)}<div class="ph">${esc(label || 'rest')}</div></td>`
        }).join('')
        return `<tr><td class="n">${esc(emotion)}</td>${cells}</tr>`
      }).join('')
      const h = `<tr><th>${esc(slug)}</th>${STEPS.map((s) => `<th>${s}</th>`).join('')}</tr>`
      return `<div class="wrap"><table>${h}${rows}</table></div>`
    }))
  }

  parts.push(`<h2>Facing</h2>`)
  parts.push(`<p class="note">The mirror lives on <code>.rig-flip</code>, outside all three transform
    carriers. Both directions are shown because a layer parented above the flip — which is how blink
    lids were wrong twice — looks perfectly fine in one of them.</p>`)
  parts.push(grid({
    corner: 'facing',
    rows: ['left', 'right'],
    cols: CHARACTER_SLUGS,
    cell: (facing, slug) => shoot(slug, { frame: { facing, emotion: 'happy', intensity: 1 }, size: 104 }),
  }))

  return page(title, parts.join('\n'))
}

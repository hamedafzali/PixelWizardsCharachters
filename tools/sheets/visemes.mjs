/**
 * A3 — the lip-sync sheet: what the mouth actually does while it speaks.
 *
 * Two questions, and they are separate. **Are the eleven shapes different from
 * each other?** — a table where two entries draw the same mouth has a hole no
 * amount of timing work can fill, since the timing would be selecting between
 * pictures that look alike. And **what does a real sentence look like?** — the
 * emitted strip against the strip the hand-marked pronunciation calls for, cell
 * by cell, so a claim like "the mouth never opens on a vowel in متشکرم" stops
 * being a number in a table and becomes a row of closed mouths.
 *
 * Everything renders through a real mounted rig; the mouth measurements are
 * parsed back out of the markup the rig wrote, not recomputed. As with the
 * other sheets, nothing here is a correctness assertion — it is the thing you
 * look at before deciding what correct should mean.
 */

import { CHARACTER_SLUGS, VISEMES } from '../../dist/index.js'
import { withRig, snapshot } from '../lib/harness.mjs'
import { page, esc } from '../lib/sheet.mjs'
import {
  loadCorpus, measure, mouthShape, shapeDistance, PER_VISEME_MS, SYLLABLE_MS,
} from '../lib/speech.mjs'

export const name = 'visemes'
export const title = 'Lip-sync — the shapes, and what a sentence does to them'

const NAMES = Object.keys(VISEMES)

/** One rig, driven through a sequence, shot at every step. */
function strip(slug, seq, size = 92) {
  return withRig(slug, {}, ({ svg, rig, dom }) =>
    seq.map((viseme) => {
      rig.apply({ viseme, mouthOpen: 0 })
      rig.finish()
      dom.advance(32)
      return snapshot(svg, size)
    }))
}

/**
 * The same strip, cropped to the mouth.
 *
 * The first version of this sheet showed the whole character at 84px, where the
 * mouth is about seven pixels across and every viseme looks like every other
 * one. That is a fact about the sheet, not about the library — a sheet whose
 * cells cannot answer the question it asks is worse than no sheet, because it
 * answers it wrongly and convincingly. The viewBox is narrowed to the mouth
 * region the rig itself reports, then restored.
 */
function mouthStrip(slug, seq, size = 92) {
  return withRig(slug, {}, ({ svg, rig, dom }) => {
    const box = svg.getAttribute('viewBox')
    const out = seq.map((viseme) => {
      rig.apply({ viseme, mouthOpen: 0 })
      rig.finish()
      dom.advance(32)
      const { cx, cy } = mouthShape(svg)
      svg.setAttribute('viewBox', `${cx - 26} ${cy - 20} 52 40`)
      const html = snapshot(svg, size)
      svg.setAttribute('viewBox', box)
      return html
    })
    return out
  })
}

/** Every shape's measured geometry, from one mounted rig. */
function shapes(slug) {
  return withRig(slug, {}, ({ svg, rig, dom }) => {
    const out = {}
    for (const v of NAMES) {
      rig.apply({ viseme: v, mouthOpen: 0 })
      rig.finish()
      dom.advance(32)
      out[v] = mouthShape(svg)
    }
    return out
  })
}

function cellsRow(label, cells, sub = []) {
  return `<tr><td class="n">${esc(label)}</td>${cells.map((c, i) =>
    `<td>${c}${sub[i] ? `<div class="ph">${esc(sub[i])}</div>` : ''}</td>`).join('')}</tr>`
}

export function build() {
  const corpus = loadCorpus()
  const parts = [`<h1>${esc(title)}</h1>`]
  parts.push(`<p class="lede">The shipped model holds one viseme per written letter for
    ${PER_VISEME_MS}ms. The reference below is ${SYLLABLE_MS}ms per hand-marked syllable, from
    <code>tools/baselines/speech.json</code>. Blink and idle motion are off, so two runs of this
    sheet are identical.</p>`)

  // ── 1. can the shapes be told apart ────────────────────────────────────────
  parts.push(`<h2>The ${NAMES.length} shapes</h2>`)
  parts.push(`<p class="note">Every viseme on every character, at rest otherwise. A viseme table is
    a set of distinctions, so the question this asks is not "is each one nice" but "is each one
    <em>different from the other ${NAMES.length - 1}</em>".</p>`)

  const head = `<tr><th></th>${NAMES.map((n) =>
    `<th>${esc(n)}<br><span style="opacity:.55">${esc(VISEMES[n].label)}</span></th>`).join('')}</tr>`
  const rows = CHARACTER_SLUGS.flatMap((slug) => [
    `<tr><td class="n">${esc(slug)}</td>${strip(slug, NAMES, 84).map((c) => `<td>${c}</td>`).join('')}</tr>`,
    `<tr><td class="n" style="opacity:.6">↑ mouth</td>${mouthStrip(slug, NAMES, 84).map((c) => `<td>${c}</td>`).join('')}</tr>`,
  ]).join('')
  parts.push(`<div class="wrap"><table>${head}${rows}</table></div>`)
  parts.push(`<p class="note">Each character gets two rows: the whole face, and the mouth alone at
    the same cell size. The second row is the one that answers the question — at 84px a mouth is
    seven pixels wide, and ${NAMES.length} different seven-pixel mouths that look alike are one
    mouth.</p>`)

  // measured, on the layered reference character
  const geo = shapes('roozi')
  const pairs = []
  for (let i = 0; i < NAMES.length; i++) {
    for (let j = i + 1; j < NAMES.length; j++) {
      const a = NAMES[i]
      const b = NAMES[j]
      pairs.push({ a, b, d: shapeDistance(geo[a], geo[b]), ga: geo[a], gb: geo[b] })
    }
  }
  pairs.sort((x, y) => x.d - y.d)

  const shown = Math.min(10, pairs.length)
  parts.push(`<h2>Measured separation</h2>`)
  parts.push(`<p class="note">Width and aperture in art units, parsed out of the markup the rig
    wrote — not recomputed from <code>VISEMES</code>. The ${shown} closest pairs${
      shown === pairs.length ? ' (every pair there is)' : ''}; decoration (tongue,
    teeth) is listed rather than scored, because a pair separated only by a 3-unit tongue dot is not
    a pair anyone tells apart at 40px.</p>`)
  const decor = (g) => [g.tongue && 'tongue', g.teeth && 'teeth', g.closed && 'closed'].filter(Boolean).join(' + ') || '—'
  parts.push(`<div class="wrap"><table>
    <tr><th>pair</th><th>distance</th><th>width</th><th>aperture</th><th>decoration</th><th></th></tr>
    ${pairs.slice(0, shown).map(({ a, b, d, ga, gb }) => `<tr>
      <td class="n">${esc(a)} / ${esc(b)}</td>
      <td>${d.toFixed(2)}</td>
      <td>${ga.width.toFixed(1)} / ${gb.width.toFixed(1)}</td>
      <td>${ga.aperture.toFixed(1)} / ${gb.aperture.toFixed(1)}</td>
      <td>${esc(decor(ga))} / ${esc(decor(gb))}</td>
      <td>${d === 0 && decor(ga) === decor(gb) ? '<span class="tag blocked" style="position:static">identical</span>' : ''}</td>
    </tr>`).join('')}
  </table></div>`)

  // ── 2. what a real utterance looks like ────────────────────────────────────
  parts.push(`<h2>Utterances: emitted against the hand-marked reference</h2>`)
  parts.push(`<p class="note">Top row is what <code>speak()</code> plays today, one cell per
    ${PER_VISEME_MS}ms. Bottom row is what the marked phonemes call for. Where the bottom row has a
    vowel and the top does not, that is a syllable the mouth never opens for.</p>`)

  for (const item of corpus.items) {
    const m = measure(item)
    parts.push(`<h2 style="opacity:.85">${esc(item.text)} <span style="opacity:.6;font-weight:400">
      ${esc(item.roman)} — ${esc(item.gloss)}</span></h2>`)
    parts.push(`<p class="note">${m.letters} letters, ${m.syllables} syllables ·
      emitted ${m.emittedMs}ms against ${m.idealMs}ms ·
      ${m.emittedVowels}/${m.syllables} vowel openings ·
      distance ${m.distance}${item.note ? ` · ${esc(item.note)}` : ''}${
        item.colloquial ? ` · colloquially ${esc(item.colloquial)}` : ''}</p>`)
    const em = mouthStrip('roozi', m.emitted, 76)
    const id = mouthStrip('roozi', m.ideal, 76)
    parts.push(`<div class="wrap"><table>
      ${cellsRow('emitted', em, m.emitted)}
      ${cellsRow('reference', id, m.ideal)}
    </table></div>`)
  }

  return page(title, parts.join('\n'))
}

/**
 * Contact-sheet presentation: the page chrome, so a sheet generator only has to
 * describe what it is showing.
 *
 * Kept separate from the geometry (probes.mjs) and from the rendering
 * (harness.mjs) because this is the one part with no claim to correctness — it
 * is styling, and it should never be the reason two sheets disagree.
 */

import { sheetRigCss } from './harness.mjs'

const CSS = `
:root { color-scheme: dark }
body { font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; background: #14161a; color: #e8e8ea;
       margin: 0; padding: 28px }
h1 { font-size: 20px; margin: 0 0 6px }
h2 { font-size: 15px; margin: 34px 0 6px; font-weight: 600 }
p.lede, p.note { color: #9aa0a8; max-width: 76ch; margin: 0 0 20px }
p.note { margin: 6px 0 14px; font-size: 13px }
.wrap { overflow-x: auto; margin-bottom: 10px }
table { border-collapse: collapse; background: #1d2026; border-radius: 10px }
td, th { border: 1px solid #2c313a; padding: 3px; text-align: center; font-weight: 400 }
th { background: #22262e; font-size: 11px; padding: 7px 9px; color: #c9ced6; white-space: nowrap }
td.n { font-size: 12px; color: #c9ced6; padding: 0 10px; white-space: nowrap; text-align: right }
svg { background: #f2f4f8; border-radius: 6px; display: block }
.cell { position: relative }
.tag { position: absolute; left: 3px; top: 3px; font-size: 9px; padding: 1px 4px; border-radius: 4px;
       background: #0a84ff; color: #fff; letter-spacing: .02em }
.tag.fb { background: #ff9f0a; color: #201400 }
.tag.blocked { background: #ff375f }
.blocked-cell { color: #ff8fa3; font-size: 11px; padding: 22px 10px; min-width: 96px }
.ph { font-size: 10px; color: #7d8590; padding-top: 3px }
.ph.anticipation { color: #ff9f0a }
.ph.settle { color: #64d2ff }
.legend { color: #9aa0a8; font-size: 13px; margin: 0 0 18px }
.legend b { color: #e8e8ea }
.k { display: inline-block; margin-right: 18px }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; vertical-align: -1px;
      margin-right: 5px }
code { background: #22262e; padding: 1px 5px; border-radius: 4px; font-size: 12px }
`

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

/** Wrap sheet body HTML in a standalone, self-contained page. */
export function page(title, body) {
  return `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<style>${CSS}</style>
<style>${sheetRigCss()}</style>
${body}`
}

/**
 * A labelled grid. `rows` and `cols` are label arrays; `cell(row, col)` returns
 * the HTML for one cell. Horizontally scrollable, because a 9-gesture ×
 * 9-frame strip is wider than any window.
 */
export function grid({ rows, cols, cell, corner = '' }) {
  const head = `<tr><th>${esc(corner)}</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>`
  const body = rows.map((r) =>
    `<tr><td class="n">${esc(r)}</td>${cols.map((c) => `<td>${cell(r, c)}</td>`).join('')}</tr>`).join('')
  return `<div class="wrap"><table>${head}${body}</table></div>`
}

/** A cell with a corner tag — `fb` for a fallback, `blocked` for a refusal. */
export function tagged(html, tag, kind = '') {
  return `<div class="cell">${html}${tag ? `<span class="tag ${kind}">${esc(tag)}</span>` : ''}</div>`
}

export { esc }

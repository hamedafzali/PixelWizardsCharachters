import type { BrowKey } from './types.js'

/**
 * Sculpted eye pair — the single biggest appeal lever. A white sclera + a
 * gradient iris/pupil that the rig can translate (gaze) + fixed corneal
 * catchlights + an upper-lid shadow + a lower lid that rises for a squint.
 *
 * Rig hooks: each eye is a `<g class="eyeG">` the rig scales for widen; inside
 * it each iris is a `<g class="iris" data-r="R">` the rig translates, and the
 * lower lid carries `.lidLo`. `squint`/`wide` are 0..1 (already scaled by
 * emotion intensity by the caller).
 *
 * **All geometry is drawn at the unscaled radius `r`.** Widen is a transform on
 * the wrapper, never baked into the drawn shapes — that is what lets the rig
 * retarget it live from interpolated intensity without a re-render, and keeps
 * the lid and the sclera locked to each other by construction rather than by
 * two formulas that have to be kept in agreement.
 */
export function eyes(
  x1: number,
  x2: number,
  y: number,
  r: number,
  irisId: string,
  squint = 0,
  wide = 0,
): string {
  const s = eyeWidenScale(wide)
  const one = (cx: number): string => {
    const id = `cl${Math.round(cx)}_${Math.round(y)}`
    // Emitted so a static render (contact sheet, SSR, no rig attached) still
    // shows a widened eye; the rig overwrites it every tick once mounted.
    const tf = s === 1 ? '' : ` transform="${eyeWidenTransform(cx, y, s)}"`
    return (
      `<g class="eyeG" data-cx="${cx}" data-cy="${y}"${tf}>` +
        `<clipPath id="${id}"><ellipse cx="${cx}" cy="${y}" rx="${r * 1.1}" ry="${r * 1.28}"/></clipPath>` +
        `<ellipse cx="${cx}" cy="${y}" rx="${r * 1.1}" ry="${r * 1.28}" fill="#fdfdff"/>` +
        `<g clip-path="url(#${id})">` +
          `<g class="iris" data-r="${r}"><circle cx="${cx}" cy="${y}" r="${r * 0.82}" fill="url(#${irisId})"/>` +
          `<circle cx="${cx}" cy="${y + r * 0.05}" r="${r * 0.48}" fill="#140c05"/></g>` +
          `<ellipse cx="${cx}" cy="${y - r * 1.02}" rx="${r * 1.32}" ry="${r * 0.82}" fill="#2a1e12" opacity="0.15"/>` +
          // `data-lr` carries the unscaled eye radius so the rig can recompute
          // this lid live. Squint closes it; widen *retracts* it, which is what
          // widening an eye physically is.
          `<ellipse class="lidLo" data-lr="${r}" cx="${cx}" cy="${y + r * 1.32}" rx="${r * 1.32}" ry="${eyeLidRy(r, squint, wide)}" fill="var(--lidfill)"/>` +
        `</g>` +
        `<circle cx="${cx - r * 0.32}" cy="${y - r * 0.36}" r="${r * 0.3}" fill="#fff"/>` +
        `<circle cx="${cx + r * 0.28}" cy="${y + r * 0.3}" r="${r * 0.14}" fill="#fff" opacity="0.85"/>` +
        `<ellipse cx="${cx}" cy="${y}" rx="${r * 1.1}" ry="${r * 1.28}" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="1"/>` +
      `</g>`
    )
  }
  return one(x1) + one(x2)
}

/**
 * The three bits of eye geometry that depend on intensity, shared by the static
 * renderer and the live rig hook so the two can never disagree.
 */
export const eyeWidenScale = (wide: number): number => 1 + wide * 0.12

export const eyeWidenTransform = (cx: number, cy: number, s: number): string =>
  `translate(${cx} ${cy}) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})`

export const eyeLidRy = (r: number, squint: number, wide: number): number =>
  Math.max(0, r * (0.5 + squint - wide * 0.35))

/**
 * Eyebrow pair, wrapped in a single `<g class="browsG">` the rig can translate
 * for the independent `browRaise` channel. Brows carry most of the readable
 * emotion at a glance, so each mood gets a distinct pose.
 */
export function brows(
  x1: number,
  x2: number,
  y: number,
  browKey: BrowKey,
  color: string,
): string {
  const w = 8
  const W = 2.6
  const seg = (cx: number, ang: number, dy: number): string =>
    `<path d="M${cx - w} ${y + dy + ang} Q ${cx} ${y + dy - 2} ${cx + w} ${y + dy - ang}" stroke="${color}" stroke-width="${W}" stroke-linecap="round" fill="none"/>`
  const inner = (cx: number, side: number): string =>
    `<path d="M${cx - w} ${y + 2} Q ${cx} ${y - 1} ${cx + w} ${y + (side < 0 ? -4 : 4)}" stroke="${color}" stroke-width="${W}" stroke-linecap="round" fill="none"/>`
  let s: string
  if (browKey === 'excited' || browKey === 'surprised') s = seg(x1, -4, -5) + seg(x2, 4, -5)
  else if (browKey === 'happy' || browKey === 'encouraging') s = seg(x1, -2, -3) + seg(x2, 2, -3)
  else if (browKey === 'thinking')
    s =
      `<path d="M${x1 - w} ${y} Q ${x1} ${y - 6} ${x1 + w} ${y - 5}" stroke="${color}" stroke-width="${W}" stroke-linecap="round" fill="none"/>` +
      seg(x2, 2, -1)
  else if (browKey === 'sad') s = inner(x1, -1) + inner(x2, 1)
  else if (browKey === 'sleepy') s = seg(x1, 1, 3) + seg(x2, -1, 3)
  // One brow high and arched, the other low and slanted. Asymmetry is the whole
  // signal — a symmetric "confused" is indistinguishable from `thinking`, which
  // already arches a single brow but leaves the other neutral.
  else if (browKey === 'confused')
    s =
      `<path d="M${x1 - w} ${y + 1} Q ${x1} ${y - 9} ${x1 + w} ${y - 7}" stroke="${color}" stroke-width="${W}" stroke-linecap="round" fill="none"/>` +
      `<path d="M${x2 - w} ${y - 2} Q ${x2} ${y + 3} ${x2 + w} ${y + 5}" stroke="${color}" stroke-width="${W}" stroke-linecap="round" fill="none"/>`
  // Level and lifted. Flat is the point: every other raised brow here arches,
  // and an arch reads as surprise rather than as composure.
  else if (browKey === 'proud') s = seg(x1, 0, -6) + seg(x2, 0, -6)
  // Lowered and sloped *outward* — the mirror of `sleepy`'s inward droop, so the
  // two do not collapse into each other at thumbnail size.
  else if (browKey === 'shy') s = seg(x1, -3, 2) + seg(x2, 3, 2)
  else s = seg(x1, -1, 0) + seg(x2, 1, 0)
  return `<g class="browsG">${s}</g>`
}

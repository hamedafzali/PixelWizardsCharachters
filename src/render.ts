import type { ActorFrame, CharacterSpec, VisemeSpec, EmotionOverrides } from './types.js'
import { resolveEmotion } from './emotions.js'
import { VISEMES } from './visemes.js'

/**
 * Build the mouth `<path>`/`<g>` markup for a viseme + explicit openness. The
 * rig calls this every frame and swaps it into `#mouthG`, so lip-sync is a
 * cheap innerHTML update rather than a full re-render.
 *
 * `beak` characters (owls) draw a two-tone beak instead of lips.
 */
export function drawMouth(
  mouth: { cx: number; cy: number; color: string; beak?: boolean },
  viseme: VisemeSpec,
  mouthOpen: number,
): string {
  const { cx, cy, color, beak } = mouth
  const o = Math.max(viseme.o, mouthOpen)
  const w = (viseme.w ?? 1) / (viseme.r ?? 1)

  if (beak) {
    const open = 3 + o * 9
    return (
      `<path d="M${cx - 11 * w} ${cy} Q ${cx} ${cy - 6} ${cx + 11 * w} ${cy} Q ${cx} ${cy + 2} ${cx - 11 * w} ${cy} Z" fill="#f19100"/>` +
      `<path d="M${cx - 9 * w} ${cy + 1} Q ${cx} ${cy + 2 + open} ${cx + 9 * w} ${cy + 1} Q ${cx} ${cy + open} ${cx - 9 * w} ${cy + 1} Z" fill="#d97a00"/>`
    )
  }

  if (viseme.closed || o < 0.06) {
    // A gentle closed smile.
    return `<path d="M${cx - 9 * w} ${cy} Q ${cx} ${cy + 5} ${cx + 9 * w} ${cy}" stroke="${color}" stroke-width="3" stroke-linecap="round" fill="none"/>`
  }

  const rx = 9 * w
  const ry = 2 + o * 7
  const parts = [
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}"/>`,
  ]
  if (viseme.tongue && o > 0.3) {
    parts.push(`<ellipse cx="${cx}" cy="${cy + ry * 0.4}" rx="${rx * 0.5}" ry="${ry * 0.5}" fill="#ff7a95"/>`)
  }
  if (viseme.tuck) {
    parts.push(`<rect x="${cx - rx}" y="${cy}" width="${rx * 2}" height="${ry + 1}" rx="1.5" fill="#f4f4f7" opacity=".9"/>`)
  } else if (o > 0.25) {
    // Upper teeth.
    parts.push(`<rect x="${cx - rx * 0.86}" y="${cy - ry}" width="${rx * 1.72}" height="${Math.min(ry * 0.7, 3)}" rx="1.2" fill="#fff"/>`)
  }
  return parts.join('')
}

/**
 * Render a complete, self-contained `<svg>` for one frame. This is the pure /
 * stateless path — handy for SSR, thumbnails and tests. The interactive
 * {@link ActorRig} renders once with this then mutates in place.
 *
 * The SVG uses a 200×200 art space inside a 120×120 viewBox-friendly scale so
 * it composes with the wider studio art; pass `size` for the pixel box.
 *
 * `emotions` (optional) tunes the emotion presets per character — an editor can
 * override any channel of any emotion.
 */
export function renderActorSVG(
  spec: CharacterSpec,
  frame: ActorFrame,
  size = 120,
  emotions?: EmotionOverrides,
): string {
  const emotion = resolveEmotion(frame.emotion, emotions)
  const { grads, art, mouth } = spec.render({ emotion, intensity: frame.intensity })
  const viseme = VISEMES[frame.viseme]
  const mouthMarkup = drawMouth(mouth, viseme, frame.mouthOpen)
  const mounted = art.replace('<g id="mouthG"></g>', `<g id="mouthG">${mouthMarkup}</g>`)
  const flip = frame.facing === 'left' ? ' transform="scale(-1,1) translate(-200,0)"' : ''
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" ` +
    `style="--lidfill:${spec.lidColor}" data-character="${spec.slug}">` +
    `<defs>${grads}</defs>` +
    `<g${flip}>${art ? mounted : ''}</g>` +
    `</svg>`
  )
}

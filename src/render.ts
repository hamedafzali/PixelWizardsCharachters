import type { ActorFrame, CharacterSpec, VisemeSpec, EmotionOverrides, RigLayer, RigLayers } from './types.js'
import { resolveEmotion } from './emotions.js'
import { VISEMES } from './visemes.js'
import { sanitizeFrame } from './validate.js'
import { clampFrame } from './interpolate.js'
import { eyeWidenScale, eyeWidenTransform } from './draw.js'
import { poseToTransform } from './timing.js'
import { resolveMotion, type MotionOverrides, type MotionTarget } from './motion.js'
import { restState, type RestState } from './rest.js'

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
    // The beak used to map all eleven visemes onto one scalar, `3 + o * 9`,
    // dropping `closed`, `tongue` and `tuck` on the floor. Eleven shapes into
    // nine art units collides by arithmetic, and the pair sweep found three:
    // rest/mbp at 0.45 units apart, rest/f at 0.99, e/l at 0.88. Distinct
    // strings, one picture — an owl's mouth carried less information than a
    // fox's while claiming the same table.
    //
    // Three changes, each measured against the full pair sweep rather than
    // picked: `closed` shuts the beak outright, the open range widens from
    // 3–12 to 1.5–15.5, and `tongue` draws, which is what separates `l` from
    // `e` structurally instead of by a 0.88-unit width difference.
    const open = viseme.closed ? 0 : 1.5 + o * 14
    const parts = [
      `<path d="M${cx - 11 * w} ${cy} Q ${cx} ${cy - 6} ${cx + 11 * w} ${cy} Q ${cx} ${cy + 2} ${cx - 11 * w} ${cy} Z" fill="#f19100"/>`,
      `<path d="M${cx - 9 * w} ${cy + 1} Q ${cx} ${cy + 2 + open} ${cx + 9 * w} ${cy + 1} Q ${cx} ${cy + open} ${cx - 9 * w} ${cy + 1} Z" fill="#d97a00"/>`,
    ]
    if (viseme.tongue && o > 0.3) {
      parts.push(`<ellipse cx="${cx}" cy="${cy + 1 + open * 0.45}" rx="${4 * w}" ry="${open * 0.28}" fill="#ff7a95"/>`)
    }
    return parts.join('')
  }

  if (viseme.closed || o < 0.06) {
    // Two closed mouths reach this branch and they must not draw the same
    // line. A rest is a relaxed smile; an /m/ is a lip *press* — flatter,
    // narrower, and heavier where the lips compress.
    //
    // Before the split, `rest` (o 0.05, under the threshold) and `mbp`
    // (closed, same w) produced byte-identical markup: a closure on م and
    // silence were the same picture, and `speak()` pins mouthOpen to 0 so
    // nothing rescued it at playback. A viseme table is a set of
    // distinctions — two entries that render alike are one entry.
    const press = viseme.closed === true
    const half = (press ? 7 : 9) * w
    return `<path d="M${cx - half} ${cy} Q ${cx} ${cy + (press ? 0.5 : 5)} ${cx + half} ${cy}" stroke="${color}" stroke-width="${press ? 3.6 : 3}" stroke-linecap="round" fill="none"/>`
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
 * The pivots of the two outer transform carriers. The rig sets them in its
 * stylesheet; a static SVG has no stylesheet, so it carries them inline
 * wherever it bakes a transform onto either.
 *
 * @internal
 */
export const CARRIER_ORIGIN = { root: '100px 190px', body: '100px 188px' } as const

/** A layer's baked transform, or '' for none. */
type PoseOf = (t: MotionTarget) => string

const noPose: PoseOf = () => ''

/** A `style` attribute from declarations, or '' when there are none. */
function styleAttr(...decls: string[]): string {
  const d = decls.filter(Boolean)
  return d.length ? ` style="${d.join(';')}"` : ''
}

/** One layer group, carrying its own pivot so transforms on it turn correctly. */
function layerG(cls: string, layer: RigLayer | undefined, inner = '', pose = ''): string {
  if (!layer && !inner) return ''
  const o = layer?.origin
  const style = styleAttr(o ? `transform-origin:${o[0]}px ${o[1]}px` : '', pose)
  // `inner` paints *behind* this layer's own art. The only caller that passes it
  // is the head, whose ears must sit behind the skull exactly as they did in the
  // original flat art — painting them after put the base of every ear triangle
  // on top of the forehead.
  return `<g class="${cls}"${style}>${inner}${layer?.art ?? ''}</g>`
}

/**
 * Assemble the articulated tree from a character's layers.
 *
 * Far limbs are painted before the torso art and near limbs after it, so depth
 * reads correctly while every limb stays independently rotatable. The head is a
 * *child* of the torso — bow the spine and the head follows, as it should.
 */
function buildLayers(l: RigLayers, pose: PoseOf = noPose): string {
  // Ears sit behind the head art and ride it: tilt the head, the ears go too.
  const ears = layerG('lyr-earL', l.earL, '', pose('earL')) + layerG('lyr-earR', l.earR, '', pose('earR'))
  // A character with no visible neck declares no head layer, and its face rides
  // the torso. The ears must then hang off the torso directly — wrapping them in
  // an implicit `.lyr-head` would resurrect the layer with *no* origin, so it
  // would pivot about its own bounding-box centre and posture's headDrop would
  // land on it after all. That is exactly the improvised pivot the no-head rule
  // exists to prevent.
  const head = l.head ? layerG('lyr-head', l.head, ears, pose('head')) : ears
  const torsoInner =
    layerG('lyr-tail', l.tail, '', pose('tail')) +
    layerG('lyr-farArm', l.farArm, '', pose('farArm')) +
    layerG('lyr-farLeg', l.farLeg, '', pose('farLeg'))
  // `torsoFront` is torso art that must occlude the head: a shell rim, a collar,
  // a scarf. It is *inside* `.lyr-torso`, so it leans with the spine and stays
  // registered with the rest of the body — an outer sibling would slide off the
  // torso the moment posture moved it. It is the only way a head can tuck
  // *behind* the body without inverting the order for every other character,
  // which needs the head in front.
  const torsoAfter =
    layerG('lyr-nearLeg', l.nearLeg, '', pose('nearLeg')) +
    layerG('lyr-nearArm', l.nearArm, '', pose('nearArm')) +
    head +
    layerG('lyr-torsoFront', l.torsoFront, '', pose('torsoFront'))
  const o = l.torso?.origin
  const torsoStyle = styleAttr(o ? `transform-origin:${o[0]}px ${o[1]}px` : '', pose('torso'))
  const torso =
    `<g class="lyr-torso"${torsoStyle}>` +
    `${torsoInner}${l.torso?.art ?? ''}${torsoAfter}` +
    `</g>`
  return layerG('lyr-accBack', l.accBack, '', pose('accBack')) + torso + layerG('lyr-accFront', l.accFront, '', pose('accFront'))
}

/** Options for {@link renderActorSVG}. */
export interface RenderOptions {
  /**
   * Motion-engine settings, layered over the character's own — pass the rig's
   * `motion` option so a server render matches the client rig that takes over.
   */
  motion?: MotionOverrides
}

/**
 * Render a complete, self-contained `<svg>` for one frame. This is the pure /
 * stateless path — handy for SSR, thumbnails and tests.
 *
 * The art space is 200×200; pass `size` for the pixel box.
 *
 * Three nested transform carriers sit between the flip and the art —
 * `.rig-root` (locomotion), `.rig-body` (gesture + squash/stretch) and
 * `.rig-mood` (emotion idle). They exist so those three channels compose
 * instead of overwriting one shared `transform`, and they are emitted for
 * layered and unlayered characters alike.
 *
 * The frame's live channels are baked in at rest — gaze (the irises, and the
 * head turning after them), `browRaise`, `yaw`, the emotion's posture and a
 * locomotion's lean — so the SVG matches what a mounted {@link ActorRig} shows
 * once it settles on the same frame. What only exists over time is not: blinks,
 * breathing, the gait cycle, gestures and the emotion's idle loop.
 *
 * `emotions` (optional) tunes the emotion presets per character — an editor can
 * override any channel of any emotion.
 */
export function renderActorSVG(
  spec: CharacterSpec,
  frame: ActorFrame,
  size = 120,
  emotions?: EmotionOverrides,
  opts: RenderOptions = {},
): string {
  return buildSVG(spec, frame, size, emotions, opts.motion ?? {})
}

/**
 * The bare art, every live channel at its neutral value — what {@link ActorRig}
 * mounts and then drives. Baking the rest pose in there would leave stale
 * transforms on hooks the rig only writes while they move.
 *
 * @internal
 */
export function renderArtSVG(
  spec: CharacterSpec,
  frame: ActorFrame,
  size = 120,
  emotions?: EmotionOverrides,
): string {
  return buildSVG(spec, frame, size, emotions, null)
}

function buildSVG(
  spec: CharacterSpec,
  frame: ActorFrame,
  size: number,
  emotions: EmotionOverrides | undefined,
  motion: MotionOverrides | null,
): string {
  // The static path has no previous frame to keep, so an unknown name lands on
  // the documented default. There is no hook here either: this function is a
  // pure string builder that a server may call thousands of times, and a
  // callback parameter would be observability nobody asked for. Callers that
  // want to know can validate first — `sanitizeFrame` is exported.
  frame = clampFrame(sanitizeFrame(frame))
  const emotion = resolveEmotion(frame.emotion, emotions)
  const { grads, art, layers, mouth } = spec.render({ emotion, intensity: frame.intensity })
  if (!layers && !art) return ''
  const viseme = VISEMES[frame.viseme]
  const mouthMarkup = drawMouth(mouth, viseme, frame.mouthOpen)

  const settings = motion && resolveMotion(spec.motion, motion)
  const rest = settings && restState(frame, {
    has: (l) => !!layers?.[l],
    eyeRadius: spec.eyes.r,
    motion: settings,
    posture: spec.posture,
    emotions,
  })
  const pose: PoseOf = (t) => {
    const p = rest?.poses[t]
    const tf = p ? poseToTransform(p) : 'none'
    return tf === 'none' ? '' : `transform:${tf}`
  }

  const shadow = layers ? layerG('lyr-shadow', layers.shadow, '', pose('shadow')) : ''
  const inner = layers ? buildLayers(layers, pose) : art
  let body =
    `${shadow}<g class="rig-root"${carrier('root', pose)}><g class="rig-body"${carrier('body', pose)}>` +
    `<g class="rig-mood">${inner}</g></g></g>`
  let defs = grads
  // The class is what a mounted rig finds it by: there the id is made unique.
  let mouthAttr = ' class="mouthG"'
  if (rest) {
    body = bakeFace(body, rest, emotion.wide * Math.max(0, Math.min(1, frame.intensity)))
    defs = bakeShade(grads, rest.shade * (settings.depth ? settings.depth.shade : 0))
    if (rest.faceX) mouthAttr += styleAttr(`transform:translate(${rest.faceX.toFixed(3)}px,0px)`)
  }
  const mounted = body.replace('<g id="mouthG"></g>', `<g id="mouthG"${mouthAttr}>${mouthMarkup}</g>`)
  const flip = frame.facing === 'left' ? ' transform="scale(-1,1) translate(-200,0)"' : ''
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" ` +
    `style="--lidfill:${spec.lidColor}" data-character="${spec.slug}">` +
    `<defs>${defs}</defs>` +
    `<g class="rig-flip"${flip}>${mounted}</g>` +
    `</svg>`
  )
}

/** A posed outer carrier's style, its pivot with it. */
function carrier(t: 'root' | 'body', pose: PoseOf): string {
  const tf = pose(t)
  return tf ? styleAttr(`transform-origin:${CARRIER_ORIGIN[t]}`, tf) : ''
}

/**
 * The face's hooks, as the rig writes them: the irises look, the brows lift,
 * and when the head turns the eyes and brows slide across it with the mouth.
 * `wide` is the eye widen already scaled by intensity, which the slide has to
 * be composed with.
 */
function bakeFace(svg: string, rest: RestState, wide: number): string {
  const { iris, browY, faceX } = rest
  if (iris.x || iris.y) {
    svg = svg.split('<g class="iris"').join(`<g class="iris" style="transform:translate(${iris.x}px,${iris.y}px)"`)
  }
  if (browY || faceX) {
    const slide = faceX ? `translateX(${faceX.toFixed(3)}px) ` : ''
    svg = svg.split('<g class="browsG"').join(`<g class="browsG" style="transform:${slide}translateY(${browY}px)"`)
  }
  if (faceX) {
    const s = eyeWidenScale(wide)
    svg = svg.replace(
      /<g class="eyeG" data-cx="([^"]*)" data-cy="([^"]*)"(?: transform="[^"]*")?>/g,
      (tag, cx: string, cy: string) => {
        const x = Number(cx)
        const y = Number(cy)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return tag
        return `<g class="eyeG" data-cx="${cx}" data-cy="${cy}" transform="translate(${faceX.toFixed(3)} 0) ${eyeWidenTransform(x, y, s)}">`
      })
  }
  return svg
}

/**
 * Slide each radial gradient's highlight against the turn by `v` percent, as
 * the rig does: only a percentage (or default 50%) centre moves.
 */
function bakeShade(defs: string, amount: number): string {
  const v = Math.round(amount * 100) / 100
  if (v === 0) return defs
  return defs.replace(/<radialGradient\b[^>]*>/g, (tag) => {
    const m = /\scx="([^"]*)"/.exec(tag)
    if (!m) return tag.replace('<radialGradient', `<radialGradient cx="${(50 - v).toFixed(2)}%"`)
    const pct = /^(-?[\d.]+)%$/.exec(m[1] ?? '')
    return pct ? tag.replace(m[0], ` cx="${(Number(pct[1]) - v).toFixed(2)}%"`) : tag
  })
}

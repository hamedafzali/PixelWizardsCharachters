/**
 * The browser half of the Flow export (see index.mjs). Everything that has to
 * be measured or drawn runs here, in Chromium, against the built library; the
 * Node half drives it, takes the screenshots and writes the files.
 *
 * Nothing here draws a character. The SVG views are `renderActorSVG` output,
 * only re-framed (a new viewBox); the 3D views are `ThreeActor`, only turned.
 */

import { CHARACTERS, defaultFrame, renderActorSVG } from '/dist/index.js'
import { ThreeActor } from '/dist/three/index.js'

const stage = document.getElementById('stage')
const measureHost = document.getElementById('measure')

/** The art is drawn in a 200×200 box; measuring at 5× keeps the rounding out of it. */
const ART = 200
const MEASURE = 1000

function specOf(slug) {
  const spec = CHARACTERS[slug]
  if (!spec) throw new Error(`unknown character "${slug}"`)
  return spec
}

/** The static SVG for one emotion, at rest, with the ground shadow removed. */
function staticSvg(slug, emotion, size) {
  const spec = specOf(slug)
  const markup = renderActorSVG(spec, { ...defaultFrame(slug), emotion }, size)
  const box = document.createElement('div')
  box.innerHTML = markup
  const svg = box.querySelector('svg')
  if (!svg) throw new Error(`renderActorSVG gave no <svg> for "${slug}"`)
  // The contact shadow is the rig's, not the character's: a reference image of
  // the character on a plain ground should not carry a painted floor patch.
  for (const s of svg.querySelectorAll('.lyr-shadow')) s.remove()
  return svg
}

/** A client rect in art units (0–200), from an svg drawn at MEASURE px. */
function toArt(rect, origin) {
  const k = ART / MEASURE
  return { x: (rect.left - origin.left) * k, y: (rect.top - origin.top) * k, w: rect.width * k, h: rect.height * k }
}

function union(boxes) {
  const list = boxes.filter((b) => b && b.w > 0 && b.h > 0)
  if (list.length === 0) return null
  const x0 = Math.min(...list.map((b) => b.x))
  const y0 = Math.min(...list.map((b) => b.y))
  const x1 = Math.max(...list.map((b) => b.x + b.w))
  const y1 = Math.max(...list.map((b) => b.y + b.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * Measure one emotion's drawing: the whole character, the head layer (when the
 * character has one) and the face features — eyes, brows, mouth.
 */
function measure(slug, emotion) {
  const svg = staticSvg(slug, emotion, MEASURE)
  measureHost.replaceChildren(svg)
  const origin = svg.getBoundingClientRect()
  const rectOf = (sel) => union([...svg.querySelectorAll(sel)].map((e) => toArt(e.getBoundingClientRect(), origin)))
  const body = rectOf('.rig-flip')
  const head = rectOf('.lyr-head')
  const face = rectOf('.eyeG, .browsG, .mouthG')
  const layers = [...svg.querySelectorAll('[class^="lyr-"]')].map((e) => e.getAttribute('class').slice(4))
  measureHost.replaceChildren()
  if (!body) throw new Error(`"${slug}" (${emotion}) drew nothing measurable`)
  if (!face) throw new Error(`"${slug}" (${emotion}) has no eyes, brows or mouth to frame`)
  return { body, head, face, layers }
}

/** A square around `box`, grown so `box` fills `fill` of it, centred. */
function square(box, fill) {
  const side = Math.max(box.w, box.h) / fill
  return { x: box.x + box.w / 2 - side / 2, y: box.y + box.h / 2 - side / 2, w: side, h: side }
}

/**
 * Put the SVG on stage, framed to `view` (art units) and drawn at `px`.
 * Returns the stage element's size for the screenshot.
 */
function show(slug, emotion, view, px) {
  const svg = staticSvg(slug, emotion, px)
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`)
  svg.setAttribute('width', String(px))
  svg.setAttribute('height', String(px))
  stage.replaceChildren(svg)
  return { width: px, height: px, markup: new XMLSerializer().serializeToString(svg) }
}

let actor = null

function clear() {
  actor?.destroy()
  actor = null
  stage.replaceChildren()
  measureHost.replaceChildren()
}

const frames = (n = 2) => new Promise((done) => {
  const step = () => (--n <= 0 ? done() : requestAnimationFrame(step))
  requestAnimationFrame(step)
})

/**
 * Mount the 3D actor, still and with its 2D skin on. Resolves once the skin
 * has loaded (the model is hidden until then), or throws if WebGL is missing:
 * the SVG fallback would quietly hand back a flat drawing as a "turnaround".
 */
async function mount3d(slug, px) {
  clear()
  const spec = specOf(slug)
  let fellBack = null
  actor = new ThreeActor(spec, {
    size: px, background: null, maxPixelRatio: 1, reducedMotion: true,
    blink: false, micro: { amount: 0 }, fallback: true, onFallback: (e) => { fellBack = e },
  })
  actor.mount(stage)
  if (actor.backend !== 'webgl') {
    throw new Error(`WebGL is not available in this browser (${fellBack?.message ?? 'no context'}); cannot render 3D views`)
  }
  actor.apply(defaultFrame(slug))
  actor.finish()
  const model = actor.actor
  if (model.parts.shadow) model.parts.shadow.visible = false
  const deadline = performance.now() + 15000
  while (!model.object.visible) {
    if (performance.now() > deadline) throw new Error(`the 3D skin for "${slug}" did not load within 15s`)
    await frames(1)
  }
  await frames(3)
  return { width: px, height: px }
}

/** Turn the model (not the camera, not the lights) to `deg` about its vertical axis. */
async function turn(deg) {
  if (!actor?.actor) throw new Error('no 3D actor mounted')
  actor.actor.object.rotation.y = (deg * Math.PI) / 180
  await frames(3)
}

// ---------------------------------------------------------------------------
// Composition: PNGs in (as base64), PNGs out. Pixels are only placed, scaled
// uniformly and given a ground colour; never repainted.

function load(b64) {
  return new Promise((done, fail) => {
    const img = new Image()
    img.onload = () => done(img)
    img.onerror = () => fail(new Error('could not decode a captured PNG'))
    img.src = `data:image/png;base64,${b64}`
  })
}

/** The bounding box of every pixel with any alpha, in image pixels. */
function alphaBox(img) {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0)
  const { data } = g.getImageData(0, 0, c.width, c.height)
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

const out = (c) => c.toDataURL('image/png').slice('data:image/png;base64,'.length)

function canvas(w, h, background) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { colorSpace: 'srgb' })
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  if (background) {
    g.fillStyle = background
    g.fillRect(0, 0, w, h)
  }
  return { c, g }
}

/** One image laid over a ground colour, same size. */
async function flatten(b64, background) {
  const img = await load(b64)
  const { c, g } = canvas(img.width, img.height, background)
  g.drawImage(img, 0, 0)
  return out(c)
}

/**
 * Lay several same-sized captures out in a grid. Every capture is cropped to
 * the one box that holds all of them, so they share a scale and a ground line.
 * Returns the sheet and each cropped, centred cell on its own. `crop: false`
 * keeps the captures' own framing (already shared, as the face crops are).
 */
async function grid(list, { cols, cell, margin, gap, background, crop = true }) {
  const imgs = await Promise.all(list.map(load))
  const box = crop ? union(imgs.map(alphaBox)) : { x: 0, y: 0, w: imgs[0].width, h: imgs[0].height }
  if (!box) throw new Error('every view came out empty')
  const rows = Math.ceil(imgs.length / cols)
  const inner = cell - 2 * margin
  const k = Math.min(inner / box.w, inner / box.h)
  const dw = box.w * k
  const dh = box.h * k
  const W = cols * cell + (cols - 1) * gap
  const H = rows * cell + (rows - 1) * gap
  const sheet = canvas(W, H, background)
  const cells = []
  imgs.forEach((img, i) => {
    const cx = (i % cols) * (cell + gap) + (cell - dw) / 2
    const cy = Math.floor(i / cols) * (cell + gap) + (cell - dh) / 2
    sheet.g.drawImage(img, box.x, box.y, box.w, box.h, cx, cy, dw, dh)
    const one = canvas(cell, cell, null)
    one.g.drawImage(img, box.x, box.y, box.w, box.h, (cell - dw) / 2, (cell - dh) / 2, dw, dh)
    cells.push(out(one.c))
  })
  return { sheet: out(sheet.c), cells, width: W, height: H }
}

/**
 * The contact sheet: one row per character, label column on the left, then
 * each image fitted into a square slot. Labels are the only text the pipeline
 * ever draws, and only here — never on a reference image.
 */
async function contact(rows, { slot, gap, label, background, ink }) {
  const decoded = await Promise.all(rows.map(async (r) => ({ ...r, imgs: await Promise.all(r.images.map(load)) })))
  const cols = Math.max(...decoded.map((r) => r.imgs.length))
  const W = label + cols * (slot + gap) + gap
  const H = decoded.length * (slot + gap) + gap
  const { c, g } = canvas(W, H, background)
  g.fillStyle = ink
  g.textBaseline = 'middle'
  decoded.forEach((r, ri) => {
    const y = gap + ri * (slot + gap)
    g.font = `600 ${Math.round(slot / 9)}px system-ui, sans-serif`
    g.fillText(r.title, gap, y + slot / 2 - slot / 14)
    g.font = `${Math.round(slot / 12)}px system-ui, sans-serif`
    g.fillText(r.subtitle, gap, y + slot / 2 + slot / 10)
    r.imgs.forEach((img, i) => {
      const x = label + i * (slot + gap)
      const k = Math.min(slot / img.width, slot / img.height)
      g.drawImage(img, x + (slot - img.width * k) / 2, y + (slot - img.height * k) / 2, img.width * k, img.height * k)
    })
  })
  return { png: out(c), width: W, height: H }
}

/**
 * The colours that actually cover the drawing, by area. Opaque pixels are
 * binned on a 4-bit-per-channel grid, each bin is averaged, and near bins are
 * merged; the result is what the eye sees, gradients and all, not a guess.
 */
async function palette(b64, n) {
  const img = await load(b64)
  const { c, g } = canvas(img.width, img.height, null)
  g.drawImage(img, 0, 0)
  const { data } = g.getImageData(0, 0, c.width, c.height)
  const bins = new Map()
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 250) continue
    total++
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    const b = bins.get(key) ?? bins.set(key, { r: 0, g: 0, b: 0, n: 0 }).get(key)
    b.r += data[i]
    b.g += data[i + 1]
    b.b += data[i + 2]
    b.n++
  }
  const merged = []
  for (const b of [...bins.values()].sort((x, y) => y.n - x.n)) {
    const rgb = [b.r / b.n, b.g / b.n, b.b / b.n]
    const near = merged.find((m) => Math.hypot(m.rgb[0] - rgb[0], m.rgb[1] - rgb[1], m.rgb[2] - rgb[2]) < 40)
    if (near) {
      const w = near.n + b.n
      near.rgb = near.rgb.map((v, k) => (v * near.n + rgb[k] * b.n) / w)
      near.n = w
    } else {
      merged.push({ rgb, n: b.n })
    }
  }
  const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  return merged
    .sort((x, y) => y.n - x.n)
    .slice(0, n)
    .map((m) => ({ hex: hex(m.rgb), share: Math.round((m.n / total) * 1000) / 1000 }))
}

/** Is WebGL there at all, and through what? */
function webglInfo() {
  const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl')
  if (!gl) return null
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) }
}

window.flow = { measure, square, show, mount3d, turn, clear, flatten, grid, contact, palette, webglInfo, ready: true }

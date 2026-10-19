/**
 * The 2D art, inflated: every character's own SVG layers become its 3D surface.
 *
 * The primitives `build.ts` makes from `body3d` are the model's skeleton and
 * stand-in — enough to pose, test and hit-test, but nowhere near the drawing.
 * This replaces each layer's primitives with that layer's **own art**: the SVG
 * `render()` returns is rasterised to a texture (gradients, stripes, tufts,
 * blush and all), and the texture's silhouette is inflated into a closed solid —
 * its thickness at each point grows with the distance from the outline, an
 * ellipse in section, standing vertical at the rim — so the layer is round when
 * it turns but is, face on, exactly the 2D picture. The outline is geometry,
 * traced where the art's alpha crosses half, so the body is watertight from
 * every side; nothing is cut out of it at draw time.
 *
 * Nothing here is per character. It reads the same `render()` output the SVG
 * rig paints, so any character with a `body3d` gets its drawing in 3D for free.
 *
 * Each solid is centred on its layer's `body3d` depth, so the parts keep the
 * body's real proportions from the side and the head turns about its own
 * middle. A drawing is not a consistent 3D object, though: face on, the 2D
 * paint order must win where the solids interpenetrate. So each layer carries a
 * depth *bias* — how far it would have to move for its paint order to hold
 * where it overlaps others — applied to the depth test only, and only as much
 * as the layer faces the camera. Face on, the drawing's order; side on, the
 * plain geometry; from behind, the geometry again.
 *
 * Browser only: rasterising SVG needs `Image` and a canvas. The headless model
 * keeps its primitives, which is what the tests see.
 */

import * as THREE from 'three'
import type { CharacterSpec, LayerName } from '../types.js'
import { resolveEmotion } from '../emotions.js'
import { LAYER_ORDER } from '../types.js'
import { eyeLidRy } from '../draw.js'
import { artToWorld, type BuiltModel } from './build.js'

export interface SkinOptions {
  /** texture pixels per art unit; default 5 */
  resolution?: number
  /** half-thickness as a fraction of a layer's thickest half-width; default 0.85 */
  puff?: number
  /** gap the paint order keeps between overlapping layers, art units; default 1.5 */
  gap?: number
}

/** cells per art unit on the grid silhouettes and heights live on */
export const SKIN_CELL = 2
const CELL = SKIN_CELL
const BOX = 200
/** side of the square cell grid silhouettes and heights live on */
export const SKIN_GRID = BOX * CELL
const N = SKIN_GRID

/** Pixels with their alpha: an `ImageData`, or anything shaped like one. */
export interface AlphaImage {
  width: number
  height: number
  data: ArrayLike<number>
}

/** A layer's silhouette, measured: what its solid and the stacking need. */
export interface Silhouette {
  /** signed distance to the outline per cell, art units: + inside, − outside */
  sd: Float32Array
  /** half-thickness per cell, art units; 0 outside */
  h: Float32Array
  /** half-thickness at the middle, and the largest inside distance */
  H: number
  R: number
  /** inclusive cell bounds of the mask: x0, y0, x1, y1 */
  bbox: [number, number, number, number]
  /** the art at full resolution and the art-space rectangle it covers; when
   *  given, the outline is traced on its half-alpha line */
  image?: AlphaImage
  rect?: [number, number, number, number]
}

interface LayerSkin extends Silhouette {
  name: LayerName
  /** the layer's middle plane (art units): its body3d depth */
  z: number
  /** depth-test bias face on (art units): what the paint order needs */
  bias: number
  image: ImageData
  /** the colour at the layer's outline spread over it: its sides and back */
  fur: ImageData
  rect: [number, number, number, number]
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** The head art without the parts the 3D face rig animates. */
function stripFace(art: string): string {
  const doc = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${art}</svg>`, 'image/svg+xml')
  for (const el of Array.from(doc.querySelectorAll('.eyeG, .browsG, #mouthG, .blinkLid'))) el.remove()
  const root = doc.documentElement
  return Array.from(root.childNodes).map((n) => new XMLSerializer().serializeToString(n)).join('')
}

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('svg rasterise failed'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}

/** Rasterise art over the art-space rectangle `rect` at `px` pixels per unit. */
async function raster(
  defs: string,
  art: string,
  rect: [number, number, number, number],
  px: number,
): Promise<HTMLCanvasElement> {
  const [x, y, w, h] = rect
  const W = Math.max(1, Math.round(w * px))
  const H = Math.max(1, Math.round(h * px))
  const svg =
    `<svg xmlns="${SVG_NS}" viewBox="${x} ${y} ${w} ${h}" width="${W}" height="${H}">` +
    `<defs>${defs}</defs><g style="--lidfill:#000">${art}</g></svg>`
  const img = await loadSvg(svg)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  // Read back, never shown: a CPU canvas, or each readback stalls the GPU.
  c.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, W, H)
  return c
}

/**
 * Grow the `filled` pixels' colours outward, one ring a pass, into the rest:
 * each new pixel takes the mean of its filled 4-neighbours. Alpha is kept.
 * Walks the frontier only, so each pixel is visited once, not once a pass.
 */
function spread(d: Uint8ClampedArray, W: number, H: number, filled: Uint8Array, passes: number): void {
  const queued = filled.slice()
  let front: number[] = []
  const enqueueAround = (i: number, into: number[]): void => {
    const x = i % W
    if (x > 0 && !queued[i - 1]) { queued[i - 1] = 1; into.push(i - 1) }
    if (x < W - 1 && !queued[i + 1]) { queued[i + 1] = 1; into.push(i + 1) }
    if (i >= W && !queued[i - W]) { queued[i - W] = 1; into.push(i - W) }
    if (i < W * (H - 1) && !queued[i + W]) { queued[i + W] = 1; into.push(i + W) }
  }
  for (let i = 0; i < W * H; i++) if (filled[i]) enqueueAround(i, front)
  for (let p = 0; p < passes && front.length; p++) {
    for (const i of front) {
      const x = i % W
      let r = 0, g = 0, b = 0, n = 0
      const take = (j: number): void => {
        if (!filled[j]) return
        r += d[j * 4]!; g += d[j * 4 + 1]!; b += d[j * 4 + 2]!; n++
      }
      if (x > 0) take(i - 1)
      if (x < W - 1) take(i + 1)
      if (i >= W) take(i - W)
      if (i < W * (H - 1)) take(i + W)
      d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n
    }
    // Mark the ring filled only once it is all coloured: a pass reads the
    // previous rings, never its own.
    for (const i of front) filled[i] = 1
    const next: number[] = []
    for (const i of front) enqueueAround(i, next)
    front = next
  }
}

/**
 * Spread each edge pixel's colour into the transparent pixels around it,
 * keeping their alpha. Filtering and mipmapping then mix the art with more of
 * itself at the outline instead of with black.
 */
function bleed(c: HTMLCanvasElement, passes: number): ImageData {
  const img = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
  const filled = new Uint8Array(c.width * c.height)
  for (let i = 0; i < filled.length; i++) filled[i] = img.data[i * 4 + 3]! > 24 ? 1 : 0
  spread(img.data, c.width, c.height, filled, passes)
  // Returned as ImageData, not written back: a canvas stores premultiplied
  // pixels, and colour at alpha 0 would not survive the round trip.
  return img
}

/**
 * What the layer looks like where the drawing can't say: its sides and back.
 * The colour on the outline — the fur, as the silhouette shows it — carried
 * smoothly over the whole layer (a membrane fill: relaxed until each pixel is
 * its neighbours' mean) and blurred, so a tuft on the outline doesn't streak
 * round the side. A belly patch or a face, drawn inside the outline, doesn't
 * wrap round to the back; the colour at the edge does. `band` is how many
 * pixels in from the outline count as the edge.
 */
/**
 * Unmark the outline pixels that are not the layer's own colour: a stripe, a
 * tuft or an eye disc that reaches the edge. Kept, each would be dragged round
 * the back as a streak. The layer's own colour is a smooth field, since a
 * body darkens toward its foot and lightens at its highlight: a quadratic in
 * x and y, fitted to the outline robustly (reweighted least squares, so the
 * marks do not pull it). A pixel further than `tolerance` from the fit is a
 * mark. Marks are a minority: a layer that would lose over a third of its
 * outline is two-toned or patterned, not marked, and is left alone: of the
 * bundled characters, سیمرغ's crested head (39%) and چرخی's windscreened
 * body (35%). Every other layer loses at most 30%.
 */
export function dropMarks(d: ArrayLike<number>, W: number, filled: Uint8Array, tolerance = 45): void {
  const idx: number[] = []
  for (let i = 0; i < filled.length; i++) if (filled[i]) idx.push(i)
  if (idx.length < 12) return
  const H = filled.length / W
  const feat = (i: number): number[] => {
    const x = ((i % W) / W) * 2 - 1
    const y = (((i / W) | 0) / H) * 2 - 1
    return [1, x, y, x * x, x * y, y * y]
  }
  const F = idx.map(feat)
  const w = new Float64Array(idx.length).fill(1)
  let fit: number[][] = []
  const residual = (j: number): number => {
    const f = F[j]!
    let s = 0
    for (let k = 0; k < 3; k++) {
      let v = 0
      for (let t = 0; t < 6; t++) v += fit[k]![t]! * f[t]!
      s += (d[idx[j]! * 4 + k]! - v) ** 2
    }
    return Math.sqrt(s)
  }
  for (let pass = 0; pass < 6; pass++) {
    fit = [0, 1, 2].map((k) => {
      const A = Array.from({ length: 6 }, () => new Float64Array(7))
      for (let j = 0; j < idx.length; j++) {
        const f = F[j]!
        const c = d[idx[j]! * 4 + k]!
        for (let r = 0; r < 6; r++) {
          for (let t = 0; t < 6; t++) A[r]![t]! += w[j]! * f[r]! * f[t]!
          A[r]![6]! += w[j]! * f[r]! * c
        }
      }
      for (let r = 0; r < 6; r++) A[r]![r]! += 1e-6
      return solve(A)
    })
    // Cauchy weights: a pixel a tolerance off counts a fifth.
    for (let j = 0; j < idx.length; j++) w[j] = 1 / (1 + (residual(j) / (tolerance / 2)) ** 2)
  }
  const off = idx.filter((_, j) => residual(j) > tolerance)
  if (off.length > idx.length / 3) return
  for (const i of off) filled[i] = 0
}

/** Solve an n × (n+1) augmented system in place, by Gaussian elimination. */
function solve(A: Float64Array[]): number[] {
  const n = A.length
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[p]![c]!)) p = r
    ;[A[c], A[p]] = [A[p]!, A[c]!]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const k = A[r]![c]! / A[c]![c]!
      for (let t = c; t <= n; t++) A[r]![t]! -= k * A[c]![t]!
    }
  }
  return A.map((row, r) => row[n]! / row[r]!)
}

function furOf(canvas: HTMLCanvasElement, band: number): ImageData {
  const W = canvas.width
  const H = canvas.height
  const img = canvas.getContext('2d')!.getImageData(0, 0, W, H)
  const d = img.data
  // Steps from the outside, by breadth-first search over 4-neighbours.
  const steps = new Int32Array(W * H).fill(-1)
  const queue: number[] = []
  for (let i = 0; i < W * H; i++) if (d[i * 4 + 3]! <= 127) { steps[i] = 0; queue.push(i) }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!
    const x = i % W
    const y = (i / W) | 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx
      const yy = y + dy
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
      const j = yy * W + xx
      if (steps[j]! >= 0) continue
      steps[j] = steps[i]! + 1
      queue.push(j)
    }
  }
  const filled = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) filled[i] = steps[i]! >= 1 && steps[i]! <= band ? 1 : 0
  dropMarks(d, W, filled)
  const edge = filled.slice()
  spread(d, W, H, filled, W + H)
  const c = new Float32Array(W * H * 3)
  for (let i = 0; i < W * H; i++) for (let k = 0; k < 3; k++) c[i * 3 + k] = d[i * 4 + k]!
  const tmp = new Float32Array(W * H * 3)
  // Mean of the in-bounds pixels within `r`, for every pixel, from `c` to `tmp`.
  const mean = (r: number, keep: Uint8Array | null): void => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        if (keep?.[i]) {
          for (let k = 0; k < 3; k++) tmp[i * 3 + k] = c[i * 3 + k]!
          continue
        }
        let r0 = 0, g0 = 0, b0 = 0, n = 0
        for (let yy = Math.max(0, y - r); yy <= Math.min(H - 1, y + r); yy++)
          for (let xx = Math.max(0, x - r); xx <= Math.min(W - 1, x + r); xx++) {
            const j = (yy * W + xx) * 3
            r0 += c[j]!; g0 += c[j + 1]!; b0 += c[j + 2]!; n++
          }
        tmp[i * 3] = r0 / n; tmp[i * 3 + 1] = g0 / n; tmp[i * 3 + 2] = b0 / n
      }
    c.set(tmp)
  }
  // Relax the fill with the edge held, then soften everything, edge included.
  for (let p = 0; p < 60; p++) mean(1, edge)
  for (let p = 0; p < 4; p++) mean(2, null)
  for (let i = 0; i < W * H; i++) for (let k = 0; k < 3; k++) d[i * 4 + k] = c[i * 3 + k]!
  return img
}

/** Squared distance transform of one row or column (Felzenszwalb & Huttenlocher). */
function edt1(f: Float64Array, n: number, out: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  for (let q = 1; q < n; q++) {
    let sx = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!)
    while (sx <= z[k]!) {
      k--
      sx = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!)
    }
    k++
    v[k] = q
    z[k] = sx
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++
    out[q] = (q - v[k]!) ** 2 + f[v[k]!]!
  }
}

/**
 * Exact Euclidean distance from each cell inside `mask` to the nearest cell
 * outside it (the grid's border counts as outside), in art units, measured to
 * the outline between them — so a cell on the rim is half a cell in. Cells
 * outside are 0.
 *
 * `win` (inclusive cell bounds x0, y0, x1, y1) limits the work to a window:
 * cells beyond it count as outside and come back 0. Exact for every cell in
 * the window as long as the window holds everything the mask marks.
 */
export function distanceField(mask: Uint8Array, win: [number, number, number, number] = [0, 0, N - 1, N - 1]): Float32Array {
  const [wx, wy] = [Math.max(0, win[0]), Math.max(0, win[1])]
  const WW = Math.min(N - 1, win[2]) - wx + 1
  const WH = Math.min(N - 1, win[3]) - wy + 1
  // Pad by one so the window's border is outside, then two separable passes.
  const MX = WW + 2
  const MY = WH + 2
  const BIG = 1e12
  const g = new Float64Array(MX * MY)
  for (let y = 1; y <= WH; y++)
    for (let x = 1; x <= WW; x++) if (mask[(wy + y - 1) * N + (wx + x - 1)]) g[y * MX + x] = BIG
  const L = Math.max(MX, MY)
  const f = new Float64Array(L)
  const o = new Float64Array(L)
  const v = new Int32Array(L)
  const z = new Float64Array(L + 1)
  for (let x = 0; x < MX; x++) {
    for (let y = 0; y < MY; y++) f[y] = g[y * MX + x]!
    edt1(f, MY, o, v, z)
    for (let y = 0; y < MY; y++) g[y * MX + x] = o[y]!
  }
  for (let y = 0; y < MY; y++) {
    for (let x = 0; x < MX; x++) f[x] = g[y * MX + x]!
    edt1(f, MX, o, v, z)
    for (let x = 0; x < MX; x++) g[y * MX + x] = o[x]!
  }
  const d = new Float32Array(N * N)
  for (let y = 0; y < WH; y++)
    for (let x = 0; x < WW; x++) {
      const sq = g[(y + 1) * MX + (x + 1)]!
      if (sq > 0) d[(wy + y) * N + (wx + x)] = (Math.sqrt(sq) - 0.5) / CELL
    }
  return d
}

/**
 * Half-thickness from a distance field: a quarter ellipse across the rim,
 * flattening to `puff × R` in the middle, where R is the layer's largest
 * distance. Thin parts (an arm stroke) stay thin, fat ones (a head) go deep; a
 * round outline becomes an ellipsoid. It stands vertical at the outline, as a
 * solid's silhouette does, so turned it reads as a body, not a lens.
 */
export function pillowHeights(dist: Float32Array, puff: number): Float32Array {
  let R = 0
  for (const v of dist) if (v > R) R = v
  const h = new Float32Array(N * N)
  if (R <= 0) return h
  const H = R * puff
  for (let i = 0; i < N * N; i++) {
    const t = Math.min(1, dist[i]! / R)
    h[i] = dist[i]! > 0 ? H * Math.sqrt(1 - (1 - t) * (1 - t)) : 0
  }
  return h
}

/** Bilinear sample of a cell grid at art (x, y). */
function sample(g: Float32Array, x: number, y: number): number {
  const fx = Math.max(0, Math.min(N - 1.001, x * CELL - 0.5))
  const fy = Math.max(0, Math.min(N - 1.001, y * CELL - 0.5))
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const a = g[y0 * N + x0]!
  const b = g[y0 * N + x0 + 1]!
  const c = g[(y0 + 1) * N + x0]!
  const e = g[(y0 + 1) * N + x0 + 1]!
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty
}

/**
 * Measure a layer's mask (cells on the skin grid): its signed distance field,
 * its half-thickness profile and its bounds. Null for an empty mask.
 */
export function silhouette(mask: Uint8Array, puff: number): Silhouette | null {
  let x0 = N, y0 = N, x1 = -1, y1 = -1
  for (let i = 0; i < N * N; i++) {
    if (!mask[i]) continue
    const x = i % N
    const y = (i / N) | 0
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  if (x1 < 0) return null
  // Only the bounds and a margin matter: the solid's grid reaches two cells
  // past them, and nothing reads the distance further out.
  const M = 4
  const win: [number, number, number, number] = [x0 - M, y0 - M, x1 + M, y1 + M]
  const din = distanceField(mask, win)
  const inv = new Uint8Array(N * N)
  for (let i = 0; i < N * N; i++) inv[i] = mask[i] ? 0 : 1
  const dout = distanceField(inv, win)
  const sd = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) sd[i] = mask[i] ? din[i]! : -dout[i]!
  let R = 0
  for (const v of din) if (v > R) R = v
  return { sd, h: pillowHeights(din, puff), H: R * puff, R, bbox: [x0, y0, x1, y1] }
}

/**
 * How far each layer's depth must move for the 2D paint order to hold where
 * the layers overlap, face on. `layers` are in paint order, each with its
 * middle plane `z`; `anchor` (usually the torso) stays put. Layers painted
 * after it are raised until their front clears every earlier layer they
 * cover by `gap`; layers painted before it are lowered until every later
 * layer clears them. Cells on a layer's outermost unit don't count, so an
 * anti-aliased rim can't push a whole limb forward.
 */
export function paintBias(
  layers: ReadonlyArray<Pick<Silhouette, 'h' | 'sd'> & { z: number }>,
  anchor: number,
  gap: number,
): number[] {
  const zs = layers.map((s) => s.z)
  const RIM = 1
  const need = (t: number, u: number): number => {
    const top = layers[t]!
    const under = layers[u]!
    let req = -Infinity
    for (let i = 0; i < N * N; i++) {
      if (top.h[i]! <= 0 || under.h[i]! <= 0) continue
      if (top.sd[i]! < RIM && under.sd[i]! >= RIM) continue
      req = Math.max(req, zs[u]! + under.h[i]! + gap - top.h[i]!)
    }
    return req
  }
  const start = Math.max(0, anchor)
  for (let j = start + 1; j < layers.length; j++)
    for (let k = start; k < j; k++) zs[j] = Math.max(zs[j]!, need(j, k))
  for (let j = start - 1; j >= 0; j--)
    for (let k = j + 1; k < layers.length; k++) {
      const r = need(k, j)
      if (r > zs[k]!) zs[j] = zs[j]! - (r - zs[k]!)
    }
  return zs.map((z, i) => z - layers[i]!.z)
}

/**
 * The paint-order bias, after `gl_Position` is set from `mvPosition`: depth is
 * taken as if the vertex sat `layerBias` art units nearer the camera, scaled by
 * `layerFacing` — the view-space z of the layer's own z axis, so it carries the
 * model's scale and falls to 0 side on. Only depth moves; the picture doesn't.
 */
const BIAS_GLSL = /* glsl */ `
  if (layerBias != 0.0 && layerFacing > 0.0) {
    vec4 lifted = mvPosition;
    lifted.z += layerBias * layerFacing;
    vec4 q = projectionMatrix * lifted;
    gl_Position.z = q.z / q.w * gl_Position.w;
  }
`
const BIAS_UNIFORMS = 'uniform float layerBias;\nuniform float layerFacing;\n'

const VERT = /* glsl */ `
  ${BIAS_UNIFORMS}
  varying vec2 vUv;
  varying vec3 vN;
  varying float vFace;
  varying float vTurn;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    vFace = normal.z;
    vTurn = 1.0 - max(normalize((modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz).z, 0.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vView = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
    ${BIAS_GLSL}
  }
`

/**
 * The art's own colours, lit only as much as it takes to read the turn: a
 * half-Lambert from the upper left, between `shade` and 1.05. The drawing's
 * gradients already carry the shading a flat view needs, so the light adds
 * form without repainting it.
 *
 * The art is projected straight through the layer: exact face on, but seen
 * from the side, the steep parts of the front show it smeared. So the front
 * fades to the fur texture — the outline's own colour, which also covers the
 * whole back — where its normal leans away from z, by as much as the layer is
 * turned from the camera: face on, all art; side on, fur past ~70°. Neither
 * texture's alpha is used: the outline is the mesh's.
 *
 * The drawing darkens toward its outline, and that is in the art, so face on
 * it is right. The fur has no such edge, so it darkens toward the silhouette
 * as the surface turns from the view, by `rim`: a turned body keeps the
 * drawing's dark edge, and an arm stays apart from the body behind it.
 */
const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D fur;
  uniform vec3 light;
  uniform float shade;
  uniform float rim;
  varying vec2 vUv;
  varying vec3 vN;
  varying float vFace;
  varying float vTurn;
  varying vec3 vView;
  void main() {
    vec3 art = texture2D(map, vUv).rgb;
    float keep = vFace > 0.0 ? smoothstep(0.3 * vTurn, 0.8 * vTurn + 1e-3, vFace) : 0.0;
    float edge = smoothstep(0.0, 0.55, abs(dot(normalize(vN), normalize(vView))));
    vec3 rgb = mix(texture2D(fur, vUv).rgb * mix(rim, 1.0, edge), art, keep);
    float l = dot(normalize(vN), normalize(light)) * 0.5 + 0.5;
    gl_FragColor = vec4(rgb * mix(shade, 1.05, l), 1.0);
    #include <colorspace_fragment>
  }
`

/** One layer's bias, shared by every material drawn in that layer's frame. */
interface LayerDepth {
  layerBias: { value: number }
  layerFacing: { value: number }
}

const viewOf = new THREE.Matrix4()

/** Keep `d.layerFacing` current for `node`'s frame as `mesh` is drawn. */
function trackFacing(mesh: THREE.Object3D, node: THREE.Object3D, d: LayerDepth): void {
  mesh.onBeforeRender = (_r, _s, camera) => {
    viewOf.multiplyMatrices(camera.matrixWorldInverse, node.matrixWorld)
    d.layerFacing.value = viewOf.elements[10]!
  }
}

/** Give a stock three.js material the layer's bias. */
function biasMaterial(m: THREE.Material, d: LayerDepth): void {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, d)
    sh.vertexShader =
      BIAS_UNIFORMS + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + BIAS_GLSL)
  }
  m.customProgramCacheKey = () => 'layer-bias'
  m.needsUpdate = true
}

/**
 * Re-skin a built model with its character's 2D art. Resolves once every layer
 * is swapped; the primitives are hidden, not removed, so the model's joints,
 * poses and face rig are untouched. `isCurrent` lets a caller abandon a skin
 * whose model has since been replaced.
 */
export async function skinModel(
  built: BuiltModel,
  spec: CharacterSpec,
  opts: SkinOptions = {},
  isCurrent: () => boolean = () => true,
): Promise<void> {
  const b = spec.body3d
  if (!b || typeof document === 'undefined') return
  const px = opts.resolution ?? 5
  const puff = opts.puff ?? 0.85
  const gap = opts.gap ?? 1.5
  const out = spec.render({ emotion: resolveEmotion('neutral'), intensity: 1 })
  const layersArt = out.layers
  if (!layersArt) return

  // --- 1. rasterise every layer over the whole box, for its silhouette ------
  const order = LAYER_ORDER.filter((l) => l !== 'shadow' && layersArt[l] && built.joints.has(l))
  const skins: LayerSkin[] = []
  for (const name of order) {
    let art = layersArt[name]!.art
    if (name === b.face.layer) art = stripFace(art)
    const full = await raster(out.grads, art, [0, 0, BOX, BOX], CELL)
    const data = full.getContext('2d')!.getImageData(0, 0, N, N).data
    const mask = new Uint8Array(N * N)
    for (let i = 0; i < N * N; i++) mask[i] = data[i * 4 + 3]! >= 128 ? 1 : 0
    const sil = silhouette(mask, puff)
    if (!sil) continue
    const spec3 = b.layers[name]
    if (spec3?.depth) {
      const k = spec3.depth / sil.H
      sil.h = sil.h.map((v) => v * k)
      sil.H = spec3.depth
    }
    // The texture: the layer's bounding box plus a margin, at full resolution.
    const [x0, y0, x1, y1] = sil.bbox
    const rect: [number, number, number, number] = [x0 / CELL - 2, y0 / CELL - 2, (x1 - x0 + 1) / CELL + 4, (y1 - y0 + 1) / CELL + 4]
    const image = bleed(await raster(out.grads, art, rect, px), 6 * px)
    const fur = furOf(await raster(out.grads, art + (spec3?.back ?? ''), rect, 1), 2)
    const hint = spec3?.parts[0]?.at[2] ?? 0
    skins.push({ ...sil, name, z: hint, bias: 0, image, fur, rect })
    if (!isCurrent()) return
  }

  // --- 2. bias: the solids stay at their body3d depths; the paint order
  // only moves their depth test, face on.
  const bias = paintBias(skins, skins.findIndex((s) => s.name === 'torso'), gap)
  skins.forEach((s, i) => (s.bias = bias[i]!))

  // --- 3. meshes ----------------------------------------------------------
  const light = new THREE.Vector3(-0.45, 0.6, 0.75)
  const depths = new Map<LayerName, LayerDepth>()
  for (const s of skins) {
    const joint = built.joints.get(s.name)!
    const pivot = artToWorld(b.layers[s.name]!.pivot)
    const texture = (img: ImageData): THREE.Texture => {
      const t = new THREE.Texture(img)
      t.needsUpdate = true
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 16 // three.js clamps it to what the GPU allows
      return t
    }
    const tex = texture(s.image)
    const furTex = texture(s.fur)
    const depth: LayerDepth = { layerBias: { value: s.bias }, layerFacing: { value: 0 } }
    depths.set(s.name, depth)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: tex },
        fur: { value: furTex },
        light: { value: light },
        shade: { value: 0.72 },
        rim: { value: 0.7 },
        ...depth,
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    })
    const geo = solidGeometry(s)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = `skin-${s.name}`
    trackFacing(mesh, joint.node, depth)
    // Geometry is in world-like art units around the art origin; place it
    // relative to the joint's pivot.
    mesh.position.set(-pivot.x, -pivot.y, s.z - pivot.z)
    for (const c of joint.node.children) if ((c as THREE.Mesh).isMesh) c.visible = false
    joint.node.add(mesh)
    built.disposers.push(() => {
      geo.dispose()
      tex.dispose()
      furTex.dispose()
      mat.dispose()
    })
  }

  // --- 4. sit the face on the new surface -----------------------------------
  const faceSkin = skins.find((s) => s.name === b.face.layer)
  if (faceSkin && built.face) {
    const pivot = artToWorld(b.layers[b.face.layer]!.pivot)
    const Z = new THREE.Vector3(0, 0, 1)
    const place = (node: THREE.Object3D, x: number, y: number, lift: number): void => {
      const z = faceSkin.z + sample(faceSkin.h, x, y)
      const w = artToWorld([x, y, z + lift])
      node.position.copy(w.sub(pivot))
      // Normal from the height gradient, softened so features don't splay.
      const e = 2
      const dx = (sample(faceSkin.h, x + e, y) - sample(faceSkin.h, x - e, y)) / (2 * e)
      const dy = (sample(faceSkin.h, x, y + e) - sample(faceSkin.h, x, y - e)) / (2 * e)
      const n = new THREE.Vector3(-dx * 0.6, dy * 0.6, 1).normalize()
      node.quaternion.setFromUnitVectors(Z, n)
    }
    const f = b.face
    // Lifted a quarter radius: the eye is a flat disc of white, and the head
    // curves away under its rim, so sitting any lower lets the fur clip it.
    built.face.eyes.forEach((eye, i) => place(eye.node, spec.eyes.x[i]!, spec.eyes.y, spec.eyes.r * 0.25))
    built.face.brows.forEach((br, i) => place(br.node, spec.eyes.x[i]!, f.brows.y, 0.4))
    place(built.face.mouth.node, f.mouth.x, f.mouth.y, 0.4)
    restyleFace(built, spec)
    // The face is drawn in the head's frame, so it shares the head's bias:
    // otherwise the biased head would hide its own eyes face on.
    const depth = depths.get(b.face.layer)!
    const head = built.joints.get(b.face.layer)!.node
    const nodes = [...built.face.eyes.map((e) => e.node), ...built.face.brows.map((x) => x.node), built.face.mouth.node]
    for (const n of nodes)
      n.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) biasMaterial(mat, depth)
        trackFacing(m, head, depth)
      })
  }
}

/**
 * The face rig in the drawing's style: unlit flat colours as the SVG paints
 * them, no outline hulls, and the iris clipped to the white of the eye with a
 * stencil, as the SVG clips it with a `clipPath`.
 */
function restyleFace(built: BuiltModel, spec: CharacterSpec): void {
  const face = built.face!
  const r = spec.eyes.r
  const circle = new THREE.CircleGeometry(1, 40)
  // Unit ring, one art unit wide at the eye's size.
  const ringGeo = new THREE.RingGeometry(1 - 0.5 / (r * 1.2), 1 + 0.5 / (r * 1.2), 48)
  built.disposers.push(() => circle.dispose(), () => ringGeo.dispose())
  const flat = (m: THREE.Mesh): void => {
    const old = m.material as THREE.MeshToonMaterial
    if (!old.color) return
    const next = new THREE.MeshBasicMaterial({ color: old.color, transparent: old.transparent, opacity: old.opacity })
    m.material = next
    built.disposers.push(() => next.dispose())
  }
  const hulls = (o: THREE.Object3D): void => {
    o.traverse((c) => {
      const m = c as THREE.Mesh
      if (!m.isMesh) return
      if ((m.material as THREE.Material).side === THREE.BackSide) m.visible = false
      else flat(m)
    })
  }
  face.eyes.forEach((eye, i) => {
    hulls(eye.node)
    const ref = i + 1
    const sclera = eye.node.children.find((c) => c !== eye.iris && (c as THREE.Mesh).isMesh) as THREE.Mesh | undefined
    if (sclera) {
      const m = sclera.material as THREE.MeshBasicMaterial
      Object.assign(m, {
        stencilWrite: true, stencilRef: ref, stencilFunc: THREE.AlwaysStencilFunc,
        stencilZPass: THREE.ReplaceStencilOp,
      })
      sclera.renderOrder = 1
    }
    eye.iris.traverse((c) => {
      const m = c as THREE.Mesh
      if (!m.isMesh) return
      Object.assign(m.material as THREE.Material, {
        stencilWrite: true, stencilRef: ref, stencilFunc: THREE.EqualStencilFunc,
        stencilZPass: THREE.KeepStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp,
      })
      m.renderOrder = 2
    })
    // Clipped, the iris can travel as far as the 2D one: half a radius.
    eye.travel = r * 0.5
    // What the 2D eye paints over the iris inside its clip: the upper shade
    // and the lower lid in the fur colour, which is what makes it read as set
    // into the face rather than stuck on.
    const disc = (cx: number, cy: number, rx: number, ry: number, color: string, opacity: number, z: number): void => {
      const m = new THREE.MeshBasicMaterial({
        color, transparent: opacity < 1, opacity, depthWrite: false,
        stencilWrite: true, stencilRef: ref, stencilFunc: THREE.EqualStencilFunc,
        stencilZPass: THREE.KeepStencilOp,
      })
      const mesh = new THREE.Mesh(circle, m)
      mesh.position.set(cx, cy, z)
      mesh.scale.set(rx, ry, 1)
      mesh.renderOrder = 3
      eye.node.add(mesh)
      built.disposers.push(() => m.dispose())
    }
    disc(0, r * 1.07, r * 1.32, r * 0.82, '#2a1e12', 0.15, r * 0.7)
    // The 2D eye's faint outline: a ring round the white, unclipped.
    const ringMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.12, depthWrite: false })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.scale.set(r * 1.1, r * 1.28, 1)
    ring.position.z = r * 0.12
    ring.renderOrder = 3
    eye.node.add(ring)
    built.disposers.push(() => ringMat.dispose())
    disc(0, -r * 1.32, r * 1.32, eyeLidRy(r, 0, 0), spec.lidColor, 1, r * 0.72)
  })
  // Brows as the 2D strokes them: a quadratic arched two units above its
  // chord, 2.6 wide. Built along y, as the capsule it replaces, so the model's
  // slope rotation still applies; +x there is "up" once that turns it.
  face.brows.forEach((br) => {
    hulls(br.node)
    const path = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, -br.half, 0), new THREE.Vector3(2, 0, 0), new THREE.Vector3(0, br.half, 0))
    const geo = new THREE.TubeGeometry(path, 20, 1.3, 8, false)
    br.mesh.geometry = geo
    br.mesh.scale.set(1, 1, 1)
    built.disposers.push(() => geo.dispose())
  })
  hulls(face.mouth.node)
}

/** Bilinear alpha (0..1) of a layer's art image at art (x, y). */
function alphaAt(s: Required<Pick<Silhouette, 'image' | 'rect'>>, x: number, y: number): number {
  const { width: W, height: H, data } = s.image
  const [rx, ry, rw, rh] = s.rect
  const fx = Math.max(0, Math.min(W - 1.001, ((x - rx) / rw) * W - 0.5))
  const fy = Math.max(0, Math.min(H - 1.001, ((y - ry) / rh) * H - 0.5))
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const at = (i: number, j: number): number => data[(j * W + i) * 4 + 3]!
  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
  const bot = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
  return (top * (1 - ty) + bot * ty) / 255
}

/**
 * Where the outline crosses the segment from `p` (inside) to `q` (outside), as
 * a fraction along it: the full-resolution art's half-alpha line (the one
 * nearest the distance field's estimate, if it crosses more than once), or
 * that estimate when there is no art.
 */
function crossing(s: Silhouette, p: [number, number, number], q: [number, number, number]): number {
  const t0 = Math.min(0.99, Math.max(0.01, p[2] / (p[2] - q[2])))
  const { image, rect } = s
  if (!image || !rect) return t0
  const art = { image, rect }
  const STEPS = 16
  let best = t0
  let gap = Infinity
  let prev = alphaAt(art, p[0], p[1]) - 0.5
  for (let k = 1; k <= STEPS; k++) {
    const t = k / STEPS
    const cur = alphaAt(art, p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t) - 0.5
    if (prev >= 0 && cur < 0) {
      const tc = (k - 1 + prev / (prev - cur)) / STEPS
      if (Math.abs(tc - t0) < gap) {
        gap = Math.abs(tc - t0)
        best = tc
      }
    }
    prev = cur
  }
  // Never on an end: two crossings landing on one grid point would make a
  // sliver of no area there.
  return Math.min(0.99, Math.max(0.01, best))
}

/**
 * The layer as one closed solid, in art units around the art origin: a front
 * half over the silhouette and its mirror behind, meeting on the outline.
 *
 * The silhouette is the cell grid clipped by the signed distance field
 * (marching triangles), its outline vertices moved onto the art's own
 * half-alpha line — so the edge is the drawing's, face on, and is real
 * geometry, not a cut, from any side. Both halves share those vertices, which
 * makes the solid watertight. Normals are the profile's own: the surface
 * stands vertical at the rim, so the halves meet without a crease.
 */
export function solidGeometry(s: Silhouette): THREE.BufferGeometry {
  const [x0, y0, x1, y1] = s.bbox
  const ax0 = x0 / CELL - 1
  const ay0 = y0 / CELL - 1
  const nx = Math.ceil(((x1 + 1) / CELL + 1 - ax0) * CELL)
  const ny = Math.ceil(((y1 + 1) / CELL + 1 - ay0) * CELL)
  const [rx, ry, rw, rh] = s.rect ?? [0, 0, BOX, BOX]
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const grad = (x: number, y: number): [number, number] => {
    const e = 1
    return [
      (sample(s.sd, x + e, y) - sample(s.sd, x - e, y)) / (2 * e),
      (sample(s.sd, x, y + e) - sample(s.sd, x, y - e)) / (2 * e),
    ]
  }
  // A vertex at art (x, y), `d` units inside the outline (0 on it).
  const vertex = (x: number, y: number, d: number): number => {
    const t = Math.min(1, Math.max(0, d) / s.R)
    const r = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)))
    // Height and its slope along d; the slope is unbounded at the rim.
    const z = s.H * r
    const [gx, gy] = grad(x, y)
    const gl = Math.hypot(gx, gy) || 1
    // In world axes art y is flipped. Normal ∝ (−h'·∇d, 1); at the rim, (−∇d, 0).
    let n: [number, number, number]
    if (r < 1e-6) n = [-gx / gl, gy / gl, 0]
    else {
      const slope = t >= 1 ? 0 : (s.H / s.R) * (1 - t) / r
      n = [-slope * gx, slope * gy, 1]
      const l = Math.hypot(...n)
      n = [n[0] / l, n[1] / l, n[2] / l]
    }
    pos.push(x - 100, 188 - y, z)
    nor.push(...n)
    uv.push((x - rx) / rw, 1 - (y - ry) / rh)
    return pos.length / 3 - 1
  }
  // Grid samples: [x, y, signed distance], and their vertex once made.
  const g: Array<[number, number, number]> = []
  const gv = new Int32Array((nx + 1) * (ny + 1)).fill(-1)
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const x = ax0 + i / CELL
      const y = ay0 + j / CELL
      // The art, where given, says which side of the outline a point is on —
      // the cell grid's distance is a little coarser — and the distance only
      // sets how thick the layer is there.
      const d = sample(s.sd, x, y)
      const inside = s.image && s.rect ? alphaAt({ image: s.image, rect: s.rect }, x, y) >= 0.5 : d > 0
      g.push([x, y, inside ? Math.max(d, 0.05) : Math.min(d, -0.05)])
    }
  const inner = (k: number): number => {
    if (gv[k]! < 0) gv[k] = vertex(g[k]![0], g[k]![1], g[k]![2])
    return gv[k]!
  }
  const edges = new Map<number, number>()
  const rim = (a: number, b: number): number => {
    const key = a * g.length + b
    let v = edges.get(key)
    if (v === undefined) {
      const p = g[a]!
      const q = g[b]!
      const t = crossing(s, p, q)
      v = vertex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, 0)
      edges.set(key, v)
    }
    return v
  }
  const idx: number[] = []
  const tri = (a: number, b: number, c: number): void => {
    const ks = [a, b, c]
    const ins = ks.map((k) => g[k]![2] > 0)
    if (!ins.includes(true)) return
    // Clip the triangle to the inside, keeping its winding, then fan it.
    const poly: number[] = []
    for (let e = 0; e < 3; e++) {
      const p = ks[e]!
      const q = ks[(e + 1) % 3]!
      const pin = ins[e]!
      const qin = ins[(e + 1) % 3]!
      if (pin) poly.push(inner(p))
      if (pin !== qin) poly.push(pin ? rim(p, q) : rim(q, p))
    }
    for (let e = 1; e + 1 < poly.length; e++) idx.push(poly[0]!, poly[e]!, poly[e + 1]!)
  }
  const at = (i: number, j: number): number => j * (nx + 1) + i
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = at(i, j)
      const b = a + 1
      const c = at(i, j + 1)
      const d = c + 1
      tri(a, c, b)
      tri(b, c, d)
    }
  // The back is the front mirrored through the middle plane. Mirroring keeps a
  // triangle's on-screen winding, so the back's is reversed to face away.
  const n = pos.length / 3
  const p2 = new Float32Array(n * 6)
  const n2 = new Float32Array(n * 6)
  const uv2 = new Float32Array(n * 4)
  p2.set(pos)
  n2.set(nor)
  uv2.set(uv)
  for (let k = 0; k < n; k++) {
    p2[(n + k) * 3] = pos[k * 3]!
    p2[(n + k) * 3 + 1] = pos[k * 3 + 1]!
    p2[(n + k) * 3 + 2] = -pos[k * 3 + 2]!
    n2[(n + k) * 3] = nor[k * 3]!
    n2[(n + k) * 3 + 1] = nor[k * 3 + 1]!
    n2[(n + k) * 3 + 2] = -nor[k * 3 + 2]!
    uv2[(n + k) * 2] = uv[k * 2]!
    uv2[(n + k) * 2 + 1] = uv[k * 2 + 1]!
  }
  const back: number[] = []
  for (let t = 0; t < idx.length; t += 3) back.push(idx[t]! + n, idx[t + 2]! + n, idx[t + 1]! + n)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(p2, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(n2, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv2, 2))
  geo.setIndex(idx.concat(back))
  return geo
}

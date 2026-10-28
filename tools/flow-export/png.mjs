/**
 * Just enough PNG for the Flow export, with no dependency: decode what
 * Chromium hands back, re-encode it as 8-bit RGB (opaque) or RGBA
 * (transparent) with an explicit `sRGB` chunk, and read a file back to check
 * it. Chromium's screenshots carry no colour-space chunk at all, and a viewer
 * that guesses wrong shifts the palette, which is exactly the thing a
 * character reference must not do.
 */

import { deflateSync, inflateSync } from 'node:zlib'

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 }

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

/** CRC-32 as the PNG spec defines it (zlib.crc32 is Node 20.15+; engines says 18). */
export function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

/** Walk the chunks. Throws on anything that is not a well-formed PNG. */
export function chunks(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG (bad signature)')
  const list = []
  let at = 8
  while (at < buf.length) {
    if (at + 12 > buf.length) throw new Error('truncated PNG chunk')
    const len = buf.readUInt32BE(at)
    const type = buf.toString('latin1', at + 4, at + 8)
    const end = at + 12 + len
    if (end > buf.length) throw new Error(`truncated PNG chunk ${type}`)
    const data = buf.subarray(at + 8, at + 8 + len)
    if (crc32(buf.subarray(at + 4, at + 8 + len)) !== buf.readUInt32BE(at + 8 + len)) throw new Error(`bad CRC in PNG chunk ${type}`)
    list.push({ type, data })
    at = end
    if (type === 'IEND') break
  }
  if (list[0]?.type !== 'IHDR') throw new Error('PNG does not start with IHDR')
  if (list.at(-1)?.type !== 'IEND') throw new Error('PNG has no IEND')
  return list
}

/** Width, height, bit depth, colour type, and which colour-space chunks are present. */
export function info(buf) {
  const list = chunks(buf)
  const h = list[0].data
  return {
    width: h.readUInt32BE(0),
    height: h.readUInt32BE(4),
    bitDepth: h[8],
    colorType: h[9],
    interlace: h[12],
    srgb: list.some((c) => c.type === 'sRGB'),
    iccp: list.some((c) => c.type === 'iCCP'),
  }
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Decode an 8-bit, non-interlaced PNG to raw pixels. */
export function decode(buf) {
  const meta = info(buf)
  const { width, height, bitDepth, colorType, interlace } = meta
  const channels = CHANNELS[colorType]
  if (bitDepth !== 8 || !channels || interlace !== 0) {
    throw new Error(`unsupported PNG (bit depth ${bitDepth}, colour type ${colorType}, interlace ${interlace})`)
  }
  const idat = Buffer.concat(chunks(buf).filter((c) => c.type === 'IDAT').map((c) => c.data))
  const raw = inflateSync(idat)
  const stride = width * channels
  if (raw.length !== height * (stride + 1)) throw new Error('PNG image data has the wrong length')
  const data = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const row = data.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? data.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= channels ? prev[x - channels] : 0
      const v = src[x]
      row[x] = (filter === 0 ? v
        : filter === 1 ? v + a
        : filter === 2 ? v + b
        : filter === 3 ? v + ((a + b) >> 1)
        : filter === 4 ? v + paeth(a, b, c)
        : NaN) & 0xff
      if (filter > 4) throw new Error(`bad PNG filter ${filter}`)
    }
  }
  return { width, height, channels, data }
}

/**
 * Encode raw 8-bit pixels (1, 3 or 4 channels) with an `sRGB` chunk and
 * nothing else beyond the essentials, so the same pixels give the same bytes.
 * Every row is Paeth-filtered: not the smallest file, but a stable one.
 */
export function encode({ width, height, channels, data }) {
  const colorType = { 1: 0, 3: 2, 4: 6 }[channels]
  if (colorType === undefined) throw new Error(`cannot encode ${channels} channels`)
  const stride = width * channels
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 4
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? data[y * stride + x - channels] : 0
      const b = y > 0 ? data[(y - 1) * stride + x] : 0
      const c = y > 0 && x >= channels ? data[(y - 1) * stride + x - channels] : 0
      raw[y * (stride + 1) + 1 + x] = (data[y * stride + x] - paeth(a, b, c)) & 0xff
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = colorType
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    // Rendering intent 0, perceptual: the standard sRGB declaration.
    chunk('sRGB', Buffer.from([0])),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Alpha statistics of decoded RGBA pixels: is it opaque, and are the corners clear? */
export function alphaStats({ width, height, channels, data }) {
  if (channels !== 4 && channels !== 2) return { opaque: true, clearCorners: false, coverage: 1 }
  const a = (x, y) => data[(y * width + x) * channels + channels - 1]
  let opaque = true
  let covered = 0
  for (let i = channels - 1; i < data.length; i += channels) {
    if (data[i] !== 255) opaque = false
    if (data[i] > 8) covered++
  }
  const corners = [a(0, 0), a(width - 1, 0), a(0, height - 1), a(width - 1, height - 1)]
  return { opaque, clearCorners: corners.every((v) => v === 0), coverage: covered / (width * height) }
}

/** Drop the alpha channel of pixels that are fully opaque. Refuses if any are not. */
export function toRgb(img) {
  if (img.channels === 3) return img
  if (img.channels !== 4) throw new Error(`expected RGBA, got ${img.channels} channels`)
  const out = Buffer.alloc(img.width * img.height * 3)
  for (let i = 0, j = 0; i < img.data.length; i += 4, j += 3) {
    if (img.data[i + 3] !== 255) throw new Error('a plain-background image has transparent pixels')
    out[j] = img.data[i]
    out[j + 1] = img.data[i + 1]
    out[j + 2] = img.data[i + 2]
  }
  return { width: img.width, height: img.height, channels: 3, data: out }
}

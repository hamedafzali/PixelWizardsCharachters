/**
 * The pieces of `npm run export:flow` (tools/flow-export) that run without a
 * browser: the PNG writer every image goes through, the curated character
 * table, and the prompt text built from metadata.
 *
 * The PNG writer is ours rather than a dependency, so it gets a round trip:
 * a reference image whose colours drift, or whose `sRGB` chunk goes missing,
 * is exactly what the export exists to prevent. The full render is not run
 * here; the export validates its own output at the end of every run.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { CHARACTER_SLUGS } from '../dist/index.js'
import { crc32, chunks, info, decode, encode, alphaStats, toRgb } from '../tools/flow-export/png.mjs'
import { CURATED } from '../tools/flow-export/characters.mjs'
import { callName, characterBlock, promptMarkdown } from '../tools/flow-export/prompts.mjs'

function pixels(width, height, channels) {
  const data = Buffer.alloc(width * height * channels)
  for (let i = 0; i < data.length; i++) data[i] = (i * 37 + (i >> 5) * 11) & 0xff
  return { width, height, channels, data }
}

test('crc32 matches the PNG spec check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926)
})

for (const channels of [1, 3, 4]) {
  test(`PNG round trip, ${channels} channel(s), declares sRGB`, () => {
    const img = pixels(17, 9, channels)
    const buf = encode(img)
    const meta = info(buf)
    assert.equal(meta.width, 17)
    assert.equal(meta.height, 9)
    assert.equal(meta.bitDepth, 8)
    assert.equal(meta.srgb, true)
    assert.deepEqual(chunks(buf).map((c) => c.type), ['IHDR', 'sRGB', 'IDAT', 'IEND'])
    const back = decode(buf)
    assert.equal(back.channels, channels)
    assert.ok(back.data.equals(img.data), 'pixels survive the round trip unchanged')
  })
}

test('a corrupted PNG is rejected', () => {
  const buf = encode(pixels(4, 4, 3))
  const bad = Buffer.from(buf)
  bad[bad.length - 20] ^= 0xff
  assert.throws(() => chunks(bad), /bad CRC|truncated/)
  assert.throws(() => chunks(Buffer.from('not a png at all')), /signature/)
})

test('toRgb drops alpha from opaque pixels and refuses transparent ones', () => {
  const img = pixels(3, 2, 4)
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255
  const rgb = toRgb(img)
  assert.equal(rgb.channels, 3)
  assert.equal(rgb.data.length, 3 * 2 * 3)
  img.data[7] = 0
  assert.throws(() => toRgb(img), /transparent/)
})

test('alphaStats sees clear corners and coverage', () => {
  const img = { width: 4, height: 4, channels: 4, data: Buffer.alloc(64) }
  img.data[(1 * 4 + 1) * 4 + 3] = 255
  const s = alphaStats(img)
  assert.equal(s.opaque, false)
  assert.equal(s.clearCorners, true)
  assert.equal(s.coverage, 1 / 16)
})

test('every character has a curated entry, and nothing else does', () => {
  assert.deepEqual(Object.keys(CURATED).sort(), [...CHARACTER_SLUGS].sort())
  for (const [slug, c] of Object.entries(CURATED)) {
    assert.ok(c.summary, `${slug} has a summary`)
    assert.ok(Array.isArray(c.features) && c.features.length, `${slug} lists features`)
    assert.ok(c.kind === null || c.kindSource, `${slug}: a kind must say where it comes from`)
  }
})

const fake = {
  id: 'roozi',
  name: 'روزی',
  description: 'A cartoon fox.',
  features: ['orange fur', 'pointed ears'],
  clothing: [],
  accessories: [],
  colorWords: 'orange and cream',
  colors: { dominant: [{ hex: '#e8892f', share: 0.5 }, { hex: '#fbe9d0', share: 0.2 }] },
  proportions: { heightToWidth: 1.1, headShareOfHeight: 0.45 },
  structure: { hasArms: false, hasLegLayers: true, gaits: ['walk'] },
  rendering: { style: '2D vector cartoon' },
  limitations: ['The side view is extrapolated.'],
}

test('the character block is built only from metadata', () => {
  const block = characterBlock(fake)
  assert.equal(callName(fake), 'Roozi')
  assert.match(block, /^Roozi \(روزی\): A cartoon fox\./)
  assert.match(block, /orange fur; pointed ears/)
  assert.match(block, /#e8892f, #fbe9d0/)
  assert.match(block, /about 1\.1 times as tall/)
  assert.match(block, /45% of its total height/)
  assert.doesNotMatch(block, /Clothing:/, 'no clothing line for a character without clothing')
})

test('the prompt keeps the block verbatim and names what the character lacks', () => {
  const md = promptMarkdown(fake)
  assert.ok(md.includes(characterBlock(fake)), 'fixed block appears unchanged')
  assert.match(md, /arms or hands \(the character has none\)/)
  assert.match(md, /Roozi walks slowly/)
  assert.match(md, /The side view is extrapolated\./)
  const noGait = promptMarkdown({ ...fake, structure: { ...fake.structure, hasArms: true, gaits: [] } })
  assert.doesNotMatch(noGait, /walks|rolls/, 'never asks for a gait the character does not have')
  assert.doesNotMatch(noGait, /arms or hands/)
})

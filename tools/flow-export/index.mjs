#!/usr/bin/env node
/**
 * Google Flow character reference export.
 *
 *   npm run export:flow                    # every character, into exports/
 *   npm run export:flow -- roozi ava       # some of them
 *   npm run export:flow -- --out dir       # somewhere else
 *   npm run export:flow -- --background '#ffffff'
 *   npm run export:flow -- --no-3d         # skip the 3D turnaround
 *   npm run export:flow -- --validate      # only re-check an existing export
 *
 * The characters are code, not image files: each is a procedural SVG spec in
 * src/characters/index.ts, with a `body3d` model the three.js renderer builds
 * and skins with the same 2D art. So the export renders them — the SVG through
 * `renderActorSVG`, the turnaround through `ThreeActor` — in headless Chromium
 * (Playwright, already a dev dependency), and never draws anything itself.
 * Source files are only read. Output goes to a gitignored `exports/`; see
 * docs/flow-export.md for what each file is and what it is not.
 */

import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decode, encode, info, toRgb, alphaStats } from './png.mjs'
import { CURATED } from './characters.mjs'
import { promptMarkdown, characterBlock } from './prompts.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const SCHEMA = 'pixel-wizards-charachters/flow-export@1'

/** Sizes, in pixels. Every reference is square, so Flow never crops a character. */
const SIZE = { reference: 1536, face: 1024, view: 1024, turnCell: 512, expression: 1016, allCell: 500, contactSlot: 280 }
/** How much of the square the subject fills: the whole character, or the eyes-brows-mouth box. */
const FILL = { reference: 0.8, face: 0.6 }
/** The expressions the brief asks for, in its order; any the library lacks are reported, not substituted. */
const REQUESTED_EXPRESSIONS = ['neutral', 'happy', 'sad', 'surprised', 'worried']
const VIEWS = [['front', 0], ['threeQuarter', 45], ['side', 90], ['back', 180]]

class ExportError extends Error {}

function parseArgs(argv) {
  const opts = { slugs: [], out: join(root, 'exports'), background: '#ececec', threeD: true, validateOnly: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') opts.out = resolve(argv[++i] ?? '')
    else if (a === '--background') opts.background = argv[++i] ?? ''
    else if (a === '--no-3d') opts.threeD = false
    else if (a === '--validate') opts.validateOnly = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a.startsWith('--')) throw new ExportError(`unknown option ${a} (try --help)`)
    else opts.slugs.push(a)
  }
  if (!/^#[0-9a-f]{6}$/i.test(opts.background)) throw new ExportError(`--background must be a #rrggbb colour, got "${opts.background}"`)
  return opts
}

async function exists(p) {
  try { await stat(p); return true } catch { return false }
}

/** Everything the run depends on, checked up front with an error that says what to do. */
async function preflight(threeD) {
  const need = [
    ['dist/index.js', 'the library is not built: run `npm run build` (npm run export:flow does it for you)'],
    ['tools/flow-export/page.html', 'tools/flow-export/page.html is missing'],
  ]
  if (threeD) {
    need.push(['dist/three/index.js', 'the 3D renderer is not built: run `npm run build`'])
    need.push(['node_modules/three/build/three.module.js', 'three is not installed: run `npm install` (it is a dev dependency)'])
  }
  for (const [p, why] of need) if (!(await exists(join(root, p)))) throw new ExportError(why)
}

async function launch() {
  let chromium
  try {
    ({ chromium } = await import('@playwright/test'))
  } catch {
    throw new ExportError('@playwright/test is not installed: run `npm install`')
  }
  try {
    // SwiftShader: WebGL in headless Chromium without a GPU, the same on every machine.
    return await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  } catch (e) {
    throw new ExportError(`could not start Chromium (${e.message.split('\n')[0]}).\nInstall it with: npx playwright install chromium`)
  }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.map': 'application/json' }

/** A page on a private origin whose files come straight off disk, read-only. */
async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 2048, height: 2048 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('http://flow.local/**', async (route) => {
    const path = normalize(join(root, decodeURIComponent(new URL(route.request().url()).pathname)))
    if (!path.startsWith(root)) return route.fulfill({ status: 403, body: 'outside the package' })
    try {
      await route.fulfill({ body: await readFile(path), contentType: MIME[extname(path)] ?? 'application/octet-stream' })
    } catch {
      await route.fulfill({ status: 404, body: 'not found' })
    }
  })
  await page.goto('http://flow.local/tools/flow-export/page.html')
  try {
    await page.waitForFunction(() => window.flow?.ready, null, { timeout: 15000 })
  } catch {
    throw new ExportError(`the render page did not load${errors.length ? `: ${errors.join('; ')}` : ''}`)
  }
  return page
}

/** Run a page helper; a failure inside the browser comes back as a plain error naming the step. */
async function call(page, step, fn, arg) {
  try {
    return await page.evaluate(fn, arg)
  } catch (e) {
    throw new ExportError(`${step}: ${e.message.split('\n')[0].replace(/^page\.evaluate: (Error: )?/, '')}`)
  }
}

const b64 = (buf) => buf.toString('base64')
const unb64 = (s) => Buffer.from(s, 'base64')

/**
 * Write a PNG, re-encoded: 8-bit RGB for plain-background images (refused if
 * any pixel is not opaque), RGBA for transparent ones, `sRGB` chunk on both.
 */
async function writePng(path, pngBytes, { transparent }) {
  const img = decode(pngBytes)
  const out = encode(transparent ? img : toRgb(img))
  await writeFile(path, out)
  return { width: img.width, height: img.height, colorMode: transparent ? 'RGBA' : 'RGB' }
}

function gitSource() {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    const dirty = execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: root, encoding: 'utf8' }).trim() !== ''
    return { commit, srcDirty: dirty }
  } catch {
    return { commit: null, srcDirty: null }
  }
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const box = (b) => b && { x: round(b.x), y: round(b.y), width: round(b.w), height: round(b.h) }

async function exportCharacter(page, lib, slug, opts, log) {
  const spec = lib.CHARACTERS[slug]
  const curated = CURATED[slug]
  if (!curated) throw new ExportError(`"${slug}" has no entry in tools/flow-export/characters.mjs; add one (see the rule at the top of that file)`)
  const dir = join(opts.out, 'characters', slug)
  await rm(dir, { recursive: true, force: true })
  await mkdir(join(dir, 'views'), { recursive: true })
  const files = {}
  const rel = (p) => relative(opts.out, p).split(sep).join('/')
  const put = async (name, bytes, transparent) => {
    const path = join(dir, name)
    // A whole character with a margin, as opposed to a close crop of the face.
    const framing = name.startsWith('face') || name.startsWith('expressions') ? 'crop' : 'full'
    files[name] = { path: rel(path), ...(await writePng(path, bytes, { transparent })), background: transparent ? 'transparent' : opts.background, framing }
  }

  // A. Reference: the neutral static SVG, re-framed to a centred square.
  const m = await call(page, `${slug}: measure`, ([s]) => flow.measure(s, 'neutral'), [slug])
  const refView = await page.evaluate(([b, f]) => flow.square(b, f), [m.body, FILL.reference])
  const shown = await call(page, `${slug}: draw reference`, ([s, v, px]) => flow.show(s, 'neutral', v, px), [slug, refView, SIZE.reference])
  const refAlpha = await page.locator('#stage').screenshot({ omitBackground: true })
  await put('reference-transparent.png', refAlpha, true)
  await put('reference.png', unb64(await page.evaluate(([b, bg]) => flow.flatten(b, bg), [b64(refAlpha), opts.background])), false)
  await writeFile(join(dir, 'reference.svg'), `<?xml version="1.0" encoding="UTF-8"?>\n${shown.markup}\n`)
  files['reference.svg'] = { path: rel(join(dir, 'reference.svg')), width: SIZE.reference, height: SIZE.reference, colorMode: 'vector', background: 'transparent' }
  const dominant = await page.evaluate(([b]) => flow.palette(b, 8), [b64(refAlpha)])
  log('reference')

  // C. Face, and D. expressions. Posture moves the head between emotions, so
  // each crop follows its own face; all share one size, so the scale matches.
  const faces = {}
  for (const e of lib.EMOTION_NAMES) faces[e] = (await call(page, `${slug}: measure ${e}`, ([s, e]) => flow.measure(s, e), [slug, e])).face
  const side = Math.max(...Object.values(faces).map((f) => Math.max(f.w, f.h))) / FILL.face
  const faceShots = {}
  for (const e of lib.EMOTION_NAMES) {
    const f = faces[e]
    const view = { x: f.x + f.w / 2 - side / 2, y: f.y + f.h / 2 - side / 2, w: side, h: side }
    await call(page, `${slug}: draw face (${e})`, ([s, e, v, px]) => flow.show(s, e, v, px), [slug, e, view, SIZE.face])
    faceShots[e] = await page.locator('#stage').screenshot({ omitBackground: true })
  }
  await put('face-transparent.png', faceShots.neutral, true)
  await put('face.png', unb64(await page.evaluate(([b, bg]) => flow.flatten(b, bg), [b64(faceShots.neutral), opts.background])), false)

  const expressed = REQUESTED_EXPRESSIONS.filter((e) => lib.EMOTION_NAMES.includes(e))
  const missing = REQUESTED_EXPRESSIONS.filter((e) => !lib.EMOTION_NAMES.includes(e))
  // A 16 px gutter between tiles; the cell sizes make each sheet 2048 wide.
  const four = await page.evaluate(([list, cell, bg]) => flow.grid(list, { cols: 2, cell, margin: 0, gap: 16, background: bg, crop: false }),
    [expressed.map((e) => b64(faceShots[e])), SIZE.expression, opts.background])
  await put('expressions.png', unb64(four.sheet), false)
  const all = await page.evaluate(([list, cell, bg]) => flow.grid(list, { cols: 4, cell, margin: 0, gap: 16, background: bg, crop: false }),
    [lib.EMOTION_NAMES.map((e) => b64(faceShots[e])), SIZE.allCell, opts.background])
  await put('expressions-all.png', unb64(all.sheet), false)
  log('face, expressions')

  // B. Turnaround: the 3D model, turned; camera and lights stay put.
  let turnaround = null
  if (opts.threeD) {
    await call(page, `${slug}: mount 3D`, ([s, px]) => flow.mount3d(s, px), [slug, SIZE.view])
    const shots = []
    for (const [, deg] of VIEWS) {
      await page.evaluate((d) => flow.turn(d), deg)
      shots.push(b64(await page.locator('#stage canvas').screenshot({ omitBackground: true })))
    }
    await page.evaluate(() => flow.clear())
    const sheet = await page.evaluate(([l, cell, bg]) => flow.grid(l, { cols: 4, cell, margin: 24, gap: 0, background: bg }), [shots, SIZE.turnCell, opts.background])
    await put('turnaround.png', unb64(sheet.sheet), false)
    const big = await page.evaluate(([l, cell]) => flow.grid(l, { cols: 1, cell, margin: 48, gap: 0, background: null }), [shots, SIZE.view])
    for (const [i, [name]] of VIEWS.entries()) await put(`views/${name}.png`, unb64(big.cells[i]), true)
    turnaround = VIEWS.map(([name, deg]) => ({ view: name, degrees: deg }))
    log('turnaround')
  }

  // Metadata, from the spec and the measurements above.
  const art = spec.render({ emotion: 'neutral', intensity: 0.7 })
  const layers3d = spec.body3d?.layers ?? {}
  const declaredParts = Object.fromEntries(Object.entries(layers3d).map(([l, v]) => [l, [...new Set(v.parts.map((p) => p.color))]]))
  const has = (l) => m.layers.includes(l)
  const structure = {
    layers: m.layers,
    hasHeadLayer: has('head'),
    hasArms: has('farArm') || has('nearArm'),
    hasLegLayers: has('farLeg') || has('nearLeg'),
    hasTail: has('tail'),
    hasEarsOrAntennas: has('earL') || has('earR'),
    gaits: [...(spec.gaits ?? [])],
    has3dModel: !!spec.body3d,
  }
  const limitations = [
    'The ground shadow the rig draws under the character is left out of every image: it is a stage effect, not part of the character.',
    `Expressions come from the library's own emotion set (${lib.EMOTION_NAMES.join(', ')}). They change the eyes, lids, brows, gaze and body posture; the resting mouth shape is the same in every emotion, because the library does not vary it per emotion.`,
    ...missing.map((e) => `"${e}" was requested but is not an emotion this library defines, so it is not exported. Nothing was substituted for it.`),
  ]
  if (turnaround) {
    limitations.push(
      'The turnaround is rendered by the library\'s 3D renderer (`body3d` model skinned with the 2D art), not drawn by an artist. The front view matches the drawing; the three-quarter view is the 3D model\'s reading of it.',
      'The side and back views are extrapolated: the drawing has no side or back, so the renderer fills them with the outline colour and inflated front art, and face features appear as flat discs edge-on. Treat them as approximate. They are not authoritative for details the drawing does not show.',
    )
  } else {
    limitations.push('No turnaround was exported (run without --no-3d to produce one from the 3D renderer).')
  }
  if (!structure.hasHeadLayer) limitations.push('The drawing has no separate head (the face sits on the body), so head proportions are not reported.')
  if (!structure.hasArms) limitations.push('The drawing has no arms.')
  if (slug === 'ava') limitations.push('The drawing ends at the dress hem: there are no legs or feet in the source, so the reference is not a head-to-toe figure.')
  if (curated.kind === null) limitations.push('The source does not name what kind of creature this is; the metadata leaves it unset rather than guessing.')

  const meta = {
    schema: SCHEMA,
    id: slug,
    name: spec.name,
    role: spec.role ?? null,
    roleEnglish: curated.roleEnglish,
    kind: curated.kind,
    kindSource: curated.kindSource,
    description: curated.summary,
    features: curated.features,
    clothing: curated.clothing,
    accessories: curated.accessories,
    colorWords: curated.colorWords,
    colors: {
      dominant,
      dominantMethod: 'opaque pixels of reference-transparent.png, binned and merged; share = fraction of the character\'s area',
      declared: {
        lid: spec.lidColor,
        brow: spec.browColor,
        mouth: art.mouth.color,
        iris: spec.body3d?.face?.eyes?.iris ?? null,
        body3dParts: declaredParts,
      },
    },
    proportions: {
      units: 'art units: every character is drawn in the same 200×200 box, ground near y=188',
      body: box(m.body),
      heightToWidth: round(m.body.h / m.body.w),
      head: box(m.head),
      headShareOfHeight: m.head ? round(m.head.h / m.body.h) : null,
      face: box(m.face),
      eyes: spec.eyes,
    },
    structure,
    rendering: {
      style: 'illustration-grade "premium flat" 2D vector cartoon: smooth form gradients with a core-shadow overlay for volume, rim light, large glossy eyes with highlights, blush, no outlines',
      twoD: 'renderActorSVG(spec, defaultFrame(id)) from the built library, neutral emotion, at rest; re-framed only',
      threeD: turnaround ? 'ThreeActor (three.js) with the 2D skin, reduced motion, transparent background; the model is turned, camera and lights fixed' : null,
    },
    source: {
      file: 'src/characters/index.ts',
      export: slug,
      spec: `CHARACTERS.${slug}`,
    },
    emotions: { available: [...lib.EMOTION_NAMES], expressionsSheet: expressed, unavailable: missing },
    turnaround,
    images: files,
    flow: {
      characterImages: [files['reference.png'].path, files['face.png'].path],
      promptTemplate: rel(join(dir, 'veo-prompt.md')),
    },
    limitations,
  }
  meta.flow.characterBlock = characterBlock(meta)
  await writeFile(join(dir, 'metadata.json'), JSON.stringify(meta, null, 2) + '\n')
  await writeFile(join(dir, 'veo-prompt.md'), promptMarkdown(meta))
  return meta
}

/** The character directories already on disk, in roster order. */
async function exported(out, slugs) {
  const dirs = new Set(await readdir(join(out, 'characters')).catch(() => []))
  const metas = []
  for (const s of slugs) {
    if (!dirs.has(s)) continue
    metas.push(JSON.parse(await readFile(join(out, 'characters', s, 'metadata.json'), 'utf8')))
  }
  return metas
}

async function contactSheet(page, out, metas, background) {
  const rows = []
  for (const m of metas) {
    const pick = ['reference-transparent.png', 'views/front.png', 'views/threeQuarter.png', 'views/side.png', 'views/back.png', 'face-transparent.png']
    const images = []
    for (const f of pick) if (m.images[f]) images.push(b64(await readFile(join(out, m.images[f].path))))
    rows.push({ title: m.id, subtitle: `${m.name} · ${m.roleEnglish}`, images })
  }
  const sheet = await page.evaluate(([rows, o]) => flow.contact(rows, o), [rows, { slot: SIZE.contactSlot, gap: 16, label: 240, background, ink: '#2a2a2a' }])
  return writePng(join(out, 'contact-sheet.png'), unb64(sheet.png), { transparent: false })
}

/**
 * Re-read everything the manifest lists and check it: the file opens as a
 * PNG, the size and colour mode are what metadata says, it carries `sRGB`,
 * plain images are opaque, transparent ones have clear corners, nothing is
 * blank, and ids agree between manifest, metadata and directory.
 */
export async function validate(out, rosterSlugs) {
  const problems = []
  const manifestPath = join(out, 'manifest.json')
  if (!(await exists(manifestPath))) return [`${manifestPath} does not exist; run the export first`]
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (manifest.schema !== SCHEMA) problems.push(`manifest schema is ${manifest.schema}, expected ${SCHEMA}`)
  const ids = manifest.characters.map((c) => c.id)
  if (new Set(ids).size !== ids.length) problems.push('manifest lists a character twice')
  const checkPng = async (path, expect) => {
    let buf
    try { buf = await readFile(join(out, path)) } catch { return problems.push(`${path}: missing`) }
    try {
      const i = info(buf)
      if (expect.width && (i.width !== expect.width || i.height !== expect.height)) problems.push(`${path}: ${i.width}×${i.height}, metadata says ${expect.width}×${expect.height}`)
      if (i.bitDepth !== 8) problems.push(`${path}: bit depth ${i.bitDepth}`)
      if (!i.srgb) problems.push(`${path}: no sRGB chunk`)
      const mode = { 2: 'RGB', 6: 'RGBA' }[i.colorType]
      if (expect.colorMode && mode !== expect.colorMode) problems.push(`${path}: colour mode ${mode}, expected ${expect.colorMode}`)
      const a = alphaStats(decode(buf))
      if (expect.colorMode === 'RGBA' && expect.framing === 'full' && !a.clearCorners) problems.push(`${path}: a full-figure transparent image has opaque corners`)
      if (expect.colorMode === 'RGBA' && a.opaque) problems.push(`${path}: meant to be transparent, but every pixel is opaque`)
      if (expect.colorMode === 'RGBA' && a.coverage < 0.02) problems.push(`${path}: almost empty (${(a.coverage * 100).toFixed(1)}% covered)`)
      if (Math.max(i.width, i.height) > 4096) problems.push(`${path}: larger than 4096 px`)
    } catch (e) {
      problems.push(`${path}: ${e.message}`)
    }
  }
  for (const c of manifest.characters) {
    if (!rosterSlugs.includes(c.id)) problems.push(`manifest lists "${c.id}", which is not in the roster`)
    let meta
    try { meta = JSON.parse(await readFile(join(out, c.metadata), 'utf8')) } catch { problems.push(`${c.metadata}: missing or not JSON`); continue }
    if (meta.id !== c.id) problems.push(`${c.metadata}: id "${meta.id}" does not match manifest "${c.id}"`)
    if (!c.metadata.startsWith(`characters/${c.id}/`)) problems.push(`${c.metadata}: not in the directory named after its id`)
    for (const key of ['id', 'name', 'description', 'colors', 'proportions', 'images', 'limitations', 'source']) {
      if (meta[key] === undefined) problems.push(`${c.metadata}: no "${key}"`)
    }
    for (const [name, img] of Object.entries(meta.images)) {
      if (!img.path.startsWith(`characters/${c.id}/`)) problems.push(`${c.id}: image ${name} is outside its directory`)
      if (name.endsWith('.png')) {
        const plain = name === 'reference.png' && Math.max(img.width, img.height)
        if (plain && (plain < 1024 || plain > 2048)) problems.push(`${img.path}: longest edge ${plain}, outside 1024–2048`)
        await checkPng(img.path, img)
      } else if (!(await exists(join(out, img.path)))) problems.push(`${img.path}: missing`)
    }
    if (!(await exists(join(out, meta.flow.promptTemplate)))) problems.push(`${meta.flow.promptTemplate}: missing`)
  }
  if (manifest.contactSheet) await checkPng(manifest.contactSheet.path, manifest.contactSheet)
  return problems
}

const HELP = `Usage: npm run export:flow -- [slug ...] [--out dir] [--background #rrggbb] [--no-3d] [--validate]
See docs/flow-export.md.`

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) return console.log(HELP)
  const built = await import(join(root, 'dist/index.js')).catch(() => {
    throw new ExportError('the library is not built: run `npm run build` (npm run export:flow does it for you)')
  })
  const lib = { ...built, EMOTION_NAMES: Object.keys(built.EMOTIONS) }
  const roster = lib.CHARACTER_SLUGS
  const unknown = opts.slugs.filter((s) => !roster.includes(s))
  if (unknown.length) throw new ExportError(`unknown character: ${unknown.join(', ')}\navailable: ${roster.join(', ')}`)

  if (opts.validateOnly) return report(await validate(opts.out, roster), opts.out)

  await preflight(opts.threeD)
  const slugs = opts.slugs.length ? opts.slugs : roster
  const browser = await launch()
  try {
    const page = await openPage(browser)
    if (opts.threeD) {
      const gl = await page.evaluate(() => flow.webglInfo())
      if (!gl) throw new ExportError('this Chromium has no WebGL, so the 3D turnaround cannot be rendered; rerun with --no-3d to skip it')
    }
    await mkdir(join(opts.out, 'characters'), { recursive: true })
    for (const slug of slugs) {
      const t0 = Date.now()
      const done = []
      await exportCharacter(page, lib, slug, opts, (step) => done.push(step))
      console.log(`  ${slug.padEnd(8)} ${done.join(', ')} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
    }

    // The manifest and contact sheet cover everything on disk, so exporting
    // one character does not drop the others from them.
    const metas = await exported(opts.out, roster)
    const sheet = await contactSheet(page, opts.out, metas, opts.background)
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    const manifest = {
      schema: SCHEMA,
      generator: 'tools/flow-export/index.mjs',
      command: 'npm run export:flow',
      source: { package: pkg.name, version: pkg.version, ...gitSource() },
      background: opts.background,
      sizes: SIZE,
      characters: metas.map((m) => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        directory: `characters/${m.id}`,
        metadata: `characters/${m.id}/metadata.json`,
        prompt: m.flow.promptTemplate,
        flowCharacterImages: m.flow.characterImages,
        files: Object.values(m.images).map((i) => i.path).sort(),
      })),
      contactSheet: { path: 'contact-sheet.png', ...sheet },
      unavailable: [
        ...REQUESTED_EXPRESSIONS.filter((e) => !lib.EMOTION_NAMES.includes(e)).map((e) => ({ output: `expression "${e}"`, reason: 'not an emotion the library defines; nothing substituted' })),
        ...(opts.threeD ? [] : [{ output: 'turnaround', reason: 'skipped with --no-3d' }]),
      ],
      notes: [
        'reference.png and face.png are the authoritative images: the library\'s own drawing, re-framed only.',
        'turnaround.png side and back views are the 3D renderer\'s extrapolation, not authored art; see each metadata.json limitations.',
        'metadata.json and the sheets are for people and scripts; Google Flow takes images as character or ingredient references, not these files as controls.',
      ],
    }
    await writeFile(join(opts.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  } finally {
    await browser.close()
  }
  report(await validate(opts.out, roster), opts.out)
}

function report(problems, out) {
  if (problems.length) {
    console.error(`\nvalidation failed (${problems.length}):\n${problems.map((p) => `  - ${p}`).join('\n')}`)
    process.exitCode = 1
  } else {
    console.log(`\nvalidated: ${relative(process.cwd(), out) || out}/manifest.json and every file it lists`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof ExportError ? `export:flow: ${e.message}` : e)
    process.exitCode = 1
  })
}

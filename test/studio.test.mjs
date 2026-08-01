/**
 * The studio example, actually booted.
 *
 * `examples/studio.html` is the only place the library is assembled the way a
 * user assembles it, and it is the one file no build step checks — a renamed
 * export or a changed signature breaks it silently and nobody finds out until
 * they open the page. So this loads the real HTML, evaluates its real module
 * script against `dist/`, and drives the transport.
 *
 * What this can and cannot see: jsdom has no animation engine and no layout, so
 * nothing here says the studio *looks* right. It says the studio *runs* — every
 * element it reaches for exists, every library function it calls is still
 * exported with that name, and the two scrub mechanisms are reached through the
 * rig rather than reimplemented in the page. That is the part that rots.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'

const root = new URL('../', import.meta.url)
const htmlPath = fileURLToPath(new URL('examples/studio.html', root))
const distURL = pathToFileURL(fileURLToPath(new URL('dist/index.js', root))).href

/**
 * Boot the studio in jsdom and hand back its document.
 *
 * The page's own `<script type="module">` is extracted and imported as a data
 * URL, with only its import specifier rewritten — the code that runs is byte
 * for byte the code that ships in the example.
 */
async function bootStudio() {
  const html = await readFile(htmlPath, 'utf8')
  const m = /<script type="module">([\s\S]*?)<\/script>/.exec(html)
  assert.ok(m, 'no module script in studio.html — the extraction below is measuring nothing')
  const src = m[1]
  assert.match(src, /from '\.\.\/dist\/index\.js'/, 'the studio no longer imports from ../dist')

  const dom = new JSDOM(html.replace(m[0], ''), { pretendToBeVisual: false })
  const { window } = dom
  let now = 0
  let queue = []
  window.requestAnimationFrame = (cb) => queue.push(cb)
  window.cancelAnimationFrame = () => { queue = [] }
  window.matchMedia = (q) => ({
    media: q, matches: false, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })

  const prev = {}
  const install = (k, v) => { prev[k] = globalThis[k]; globalThis[k] = v }
  install('window', window)
  install('document', window.document)
  install('requestAnimationFrame', window.requestAnimationFrame)
  install('cancelAnimationFrame', window.cancelAnimationFrame)
  install('performance', { now: () => now })
  install('addEventListener', window.addEventListener.bind(window))

  const advance = (ms) => {
    let left = ms
    while (left > 0) {
      const d = Math.min(16, left)
      now += d; left -= d
      const due = queue; queue = []
      for (const cb of due) cb(now)
    }
  }

  const code = src.replace(/'\.\.\/dist\/index\.js'/, JSON.stringify(distURL))
  try {
    await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  } catch (err) {
    // The whole point of this file: say which line of the example broke.
    throw new Error(`the studio script threw while loading: ${err.message}`, { cause: err })
  }

  // Teardown, in this order, for two separate reasons.
  //
  // `rig.destroy()` first: the blink loop reschedules itself with a bare
  // `setTimeout`, which in a browser is `window.setTimeout` but here is Node's
  // own — `window.close()` does not cancel it, so it would reschedule forever
  // and the test process would never exit.
  //
  // Globals last, and only after the timers are gone: restoring
  // `globalThis.window` to undefined while a rig callback is still pending
  // means that callback throws with no test attached to it.
  const restore = () => {
    window.studio?.rig?.destroy()
    window.close()
    for (const k of Object.keys(prev)) globalThis[k] = prev[k]
  }
  return { window, document: window.document, advance, restore }
}

// Each boot re-imports the same data URL, which the module cache would hand
// back already-evaluated. Cheap fix: the studio is booted once and the tests
// read the same page, in order, the way a person would use it.
const studio = await bootStudio()
const $ = (id) => studio.document.getElementById(id)

test.after(() => studio.restore())

test('the studio boots: a rig is mounted and the library picker rendered the whole roster', async () => {
  const { CHARACTER_SLUGS } = await import('../dist/index.js')
  assert.ok($('host').querySelector('svg'), 'no rig mounted into #host')
  const items = $('picker').querySelectorAll('[data-slug]')
  assert.equal(items.length, CHARACTER_SLUGS.length,
    'the studio picker is not the library roster')
  assert.equal($('picker').querySelectorAll('.is-selected').length, 1)
})

test('every gesture in the library has a button and a clip, none hand-listed', async () => {
  const { GESTURE_NAMES } = await import('../dist/index.js')
  const buttons = [...$('actions').querySelectorAll('button')].map((b) => b.dataset.g)
  assert.deepEqual(buttons, [...GESTURE_NAMES],
    'the studio action buttons have drifted from GESTURE_NAMES')
  const clips = [...$('clip').options].map((o) => o.value)
  for (const g of GESTURE_NAMES) assert.ok(clips.includes(`g:${g}`), `${g} has no clip`)
  assert.ok(clips.some((v) => v.startsWith('loco:')), 'no gait cycle to scrub')
})

test('a gesture that is refused mid-flight is shown as refused, not as an ordinary button', async () => {
  // The studio's job is to make the rig legible, and "not from here" is one of
  // the things the rig says. Which gestures those are is read from the library
  // rather than listed here, and the state is restored afterwards.
  const { GESTURES, GESTURE_NAMES } = await import('../dist/index.js')
  const grounded = GESTURE_NAMES.filter((g) => GESTURES[g].during && !GESTURES[g].during.includes('fly'))
  assert.ok(grounded.length > 0, 'no gesture declares a locomotion it needs — this test measures nothing')

  const fly = [...$('loco').children].find((b) => b.dataset.v === 'fly')
  fly.dispatchEvent(new studio.window.MouseEvent('click', { bubbles: true }))
  // Locomotion arrives on a delay, and the studio waits for the rig to be in it
  // before re-asking how anything routes. Asking before the clock moves would
  // read the state being left.
  studio.advance(200)
  const titles = new Map([...$('actions').querySelectorAll('button')].map((b) => [b.dataset.g, b.title]))
  const classes = new Map([...$('actions').querySelectorAll('button')].map((b) => [b.dataset.g, b.className]))
  for (const g of grounded) {
    assert.match(titles.get(g), /ممکن نیست/, `${g} is refused while flying but the studio shows it as playable`)
    // Three routings, three looks. This started as three opacities — 1, 0.8,
    // 0.45 — and in a browser the first two were indistinguishable, which is a
    // thing no test in this file can see. What is checkable is that the studio
    // still marks the distinction at all, so the styling has something to hang
    // off; whether it reads is a question for a person with the page open.
    assert.equal(classes.get(g), 'no', `${g} is refused but carries no marker class`)
  }
  const ok = GESTURE_NAMES.filter((g) => !grounded.includes(g))
  for (const g of ok) assert.doesNotMatch(titles.get(g), /ممکن نیست/, `${g} was marked refused but is not`)

  ;[...$('loco').children].find((b) => b.dataset.v === 'idle')
    .dispatchEvent(new studio.window.MouseEvent('click', { bubbles: true }))
  studio.advance(200)
})

test('scrubbing a gesture clip pauses the shipped keyframes at the slider position', () => {
  $('clip').value = [...$('clip').options].map((o) => o.value).find((v) => v.startsWith('g:'))
  $('clip').dispatchEvent(new studio.window.Event('change'))
  $('scrubOn').dispatchEvent(new studio.window.MouseEvent('click', { bubbles: true }))

  $('scrub').value = '0.4'
  $('scrub').dispatchEvent(new studio.window.Event('input'))

  const svg = $('host').querySelector('svg')
  const held = [...svg.querySelectorAll('[class^="lyr-"], .rig-body, .rig-root')]
    .filter((el) => el.style.animationPlayState === 'paused')
  assert.ok(held.length > 0, 'nothing is paused — the scrub is not reaching the rig')
  assert.ok(held.every((el) => parseFloat(el.style.animationDelay) <= 0),
    'a paused layer without a negative delay is stuck at frame 0, not scrubbed')
  assert.match($('scrubV').textContent, /\d+\/\d+/, 'no frame readout')
})

test('the frame steppers move by exactly one frame of the clip', () => {
  const read = () => Number(/(\d+)\//.exec($('scrubV').textContent)[1])
  const before = read()
  $('next').dispatchEvent(new studio.window.MouseEvent('click', { bubbles: true }))
  assert.equal(read(), before + 1, '▶︎ did not advance one frame')
  $('prev').dispatchEvent(new studio.window.MouseEvent('click', { bubbles: true }))
  assert.equal(read(), before, '◀︎ did not go back one frame')
})

test('leaving scrub mode releases the hold instead of leaving the rig frozen', () => {
  $('scrubOn').dispatchEvent(new studio.window.MouseEvent('click', { bubbles: true }))
  const svg = $('host').querySelector('svg')
  const stuck = [...svg.querySelectorAll('*')].filter((el) => el.style.animationPlayState === 'paused')
  assert.deepEqual(stuck.map((el) => el.getAttribute('class')), [],
    'the rig is still paused after leaving scrub mode')
  assert.equal($('scrub').disabled, true, 'the slider stayed live outside scrub mode')
})

test('scrubbing a gait cycle puts the character into that gait first', () => {
  const gait = [...$('clip').options].map((o) => o.value).find((v) => v.startsWith('loco:'))
  $('clip').value = gait
  $('clip').dispatchEvent(new studio.window.Event('change'))
  $('scrubOn').dispatchEvent(new studio.window.MouseEvent('click', { bubbles: true }))
  $('scrub').value = '0.5'
  $('scrub').dispatchEvent(new studio.window.Event('input'))

  studio.advance(200)
  const name = gait.slice('loco:'.length)
  // Pinning a phase on an idle rig would freeze a pose the character never
  // adopts, so the studio switches the frame as well as the pin.
  assert.match($('json').textContent, new RegExp(name),
    `the frame was not switched into ${name} before pinning`)
  assert.ok([...$('loco').children].some((b) => b.dataset.v === name && b.classList.contains('on')),
    'the locomotion buttons disagree with the frame the studio is showing')

  // And the pin has to bite: two positions on the track must be two poses, or
  // the slider is moving a number and nothing else. (Held across a tick, too —
  // an unpinned cycle would have advanced.)
  const pose = () => [...$('host').querySelectorAll('[class^="lyr-"]')].map((el) => el.style.transform).join('|')
  const at = (v) => { $('scrub').value = v; $('scrub').dispatchEvent(new studio.window.Event('input')); return pose() }
  const a = at('0'), b = at('0.5')
  assert.notEqual(a, b, 'both ends of the gait track produce the same pose — nothing is pinned')

  // Held across ticks — but not frozen solid. The studio leaves idle
  // micro-motion running, which composes onto the same layers and keeps
  // breathing at a fraction of a degree while the gait stands still. So the
  // check is on magnitude: the gait channels swing degrees, micro does not.
  const nums = (s) => [...s.matchAll(/-?\d+\.?\d*/g)].map(Number)
  const spread = (x, y) => Math.max(...nums(x).map((n, i) => Math.abs(n - nums(y)[i])))
  assert.ok(spread(a, b) > 2, `the two ends of the track differ by only ${spread(a, b)} — that is micro-motion, not a gait`)
  studio.advance(200)
  assert.ok(spread(pose(), b) < 0.5,
    `the pinned phase drifted by ${spread(pose(), b)} while the studio ticked`)

  $('scrubOn').dispatchEvent(new studio.window.MouseEvent('click', { bubbles: true }))
})

test('changing character re-asks the rig how each gesture routes rather than reusing the old answer', () => {
  // Routing is per-character (a character with no arm falls back to the whole
  // body), so a cached button list would show one character's routing on
  // another's. Same class of bug as a picker with a hardcoded roster.
  const before = [...$('actions').querySelectorAll('button')].map((b) => b.title).join('|')
  const items = [...$('picker').querySelectorAll('[data-slug]')]
  const other = items.find((el) => !el.classList.contains('is-selected'))
  let changed = false
  for (const el of items) {
    el.dispatchEvent(new studio.window.MouseEvent('click', { bubbles: true }))
    if ([...$('actions').querySelectorAll('button')].map((b) => b.title).join('|') !== before) changed = true
  }
  assert.ok(other, 'only one character in the picker')
  assert.ok(changed, 'no character in the roster routes its gestures differently — is buildActions running at all?')

  // سیمرغ is the deliberately unlayered character, so every limb gesture falls
  // back to its whole body. That is the case the marker class exists for.
  studio.document.querySelector('[data-slug="simorgh"]')
    .dispatchEvent(new studio.window.MouseEvent('click', { bubbles: true }))
  const fb = [...$('actions').querySelectorAll('button.fb')].map((b) => b.dataset.g)
  assert.ok(fb.length > 0, 'سیمرغ falls back on nothing — either the roster or the marker changed')
})

test('the studio never hides a gesture it cannot fit', () => {
  // jsdom has no layout, so this cannot check overflow — and overflow is exactly
  // what went wrong: nine buttons in one non-wrapping row pushed three of them
  // off the panel, unreachable, while every test passed. Caught by opening the
  // page. What is checkable is the invariant underneath: one button per gesture,
  // all of them in the container, none removed to make room.
  const buttons = $('actions').querySelectorAll('button')
  assert.equal(buttons.length, $('clip').querySelectorAll('option[value^="g:"]').length,
    'the button list and the clip list disagree about how many gestures there are')
})

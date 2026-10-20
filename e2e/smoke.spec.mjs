import { test, expect } from '@playwright/test'

/** Load the fixture and fail the test on any uncaught page error. */
async function open(page, path = '/e2e/fixture.html') {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(path)
  return errors
}

/** Open the fixture and wait for the package to load into `window.pw`. */
async function ready(page) {
  const errors = await open(page)
  await page.waitForFunction(() => window.pw)
  return errors
}

test('every character mounts, poses and plays a CSS gesture', async ({ page }, info) => {
  const errors = await ready(page)

  const slugs = await page.evaluate(() => window.pw.CHARACTER_SLUGS)
  expect(slugs.length).toBeGreaterThan(0)

  for (const slug of slugs) {
    const result = await page.evaluate((slug) => {
      const { ActorRig, CHARACTERS } = window.pw
      const host = document.createElement('div')
      host.dataset.slug = slug
      document.body.append(host)
      const rig = new ActorRig(CHARACTERS[slug], { size: 160 }).mount(host)
      rig.apply({ emotion: 'happy', intensity: 0.9 })
      rig.finish()
      // `jump` drives the body carrier, which every character has, so it is
      // the one gesture that must play with its own parts everywhere.
      rig.playGesture('jump')
      const body = host.querySelector('.rig-body')
      return {
        svg: !!host.querySelector('svg'),
        animation: body ? getComputedStyle(body).animationName : null,
        running: body ? body.getAnimations().length : 0,
      }
    }, slug)

    expect(result.svg, `${slug}: <svg> mounted`).toBe(true)
    expect(result.animation, `${slug}: jump keyframes applied`).toMatch(/caG_jump/)
    expect(result.running, `${slug}: jump is running`).toBeGreaterThan(0)
  }

  // Not compared against a baseline (fonts and anti-aliasing differ per OS);
  // attached so a reviewer can look at what each engine drew.
  await info.attach('roster', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  expect(errors).toEqual([])
})

test('the rig stylesheet is injected (blink and gait rules exist)', async ({ page }) => {
  await ready(page)
  const css = await page.evaluate(() => {
    const { ActorRig, CHARACTERS } = window.pw
    const host = document.createElement('div')
    document.body.append(host)
    new ActorRig(CHARACTERS.roozi).mount(host)
    return [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')
  })
  expect(css).toContain('.shut')
})

test('static renderActorSVG output is valid SVG markup', async ({ page }) => {
  await ready(page)
  const parsed = await page.evaluate(() => {
    const { renderActorSVG, CHARACTERS, CHARACTER_SLUGS, defaultFrame } = window.pw
    return CHARACTER_SLUGS.map((slug) => {
      const doc = new DOMParser().parseFromString(
        renderActorSVG(CHARACTERS[slug], defaultFrame(slug), 120), 'image/svg+xml')
      return { slug, error: doc.querySelector('parsererror')?.textContent ?? null }
    })
  })
  for (const { slug, error } of parsed) expect(error, slug).toBeNull()
})

/** Whether this engine, here, can create the WebGL2 context three.js needs. */
async function hasWebGL2(page) {
  await ready(page)
  return page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))
}

test('the three.js example renders a canvas without errors', async ({ page, browserName }) => {
  // Headless engines on a GPU-less CI runner may have no WebGL at all (Firefox
  // on Linux, for one). That case is PW-14's, tested below, not this one's.
  test.skip(!(await hasWebGL2(page)), `${browserName} has no WebGL2 here`)

  const errors = await open(page, '/examples/three.html')
  // Fail on the page's own error as soon as it happens, not on a selector
  // timeout that hides it.
  await Promise.race([
    page.waitForSelector('#three canvas', { timeout: 15_000 }),
    new Promise((_, reject) => page.once('pageerror', reject)),
  ])
  // Let the skin rasterise and a few frames run.
  await page.waitForTimeout(1500)
  expect(errors, `${browserName} page errors`).toEqual([])
})

// ---------------------------------------------------------------- known issues
// Expected to fail until fixed; `test.fail` flips to an error once they pass,
// so the fix cannot land without this marker being removed.

test.fail('PW-03: a rig in a second document (iframe) gets the rig stylesheet', async ({ page }) => {
  await ready(page)
  const css = await page.evaluate(async () => {
    const { ActorRig, CHARACTERS } = window.pw
    const main = document.createElement('div')
    document.body.append(main)
    new ActorRig(CHARACTERS.roozi).mount(main)

    const frame = document.createElement('iframe')
    document.body.append(frame)
    const doc = frame.contentDocument
    const host = doc.createElement('div')
    doc.body.append(host)
    new ActorRig(CHARACTERS.roozi).mount(host)
    return [...doc.querySelectorAll('style')].map((s) => s.textContent).join('\n')
  })
  expect(css).toContain('.shut')
})

test.fail('PW-14: with no WebGL, the three.js example fails without an uncaught error', async ({ page }) => {
  // Every engine, every machine: refuse WebGL contexts before the page runs.
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return /webgl/.test(type) ? null : get.call(this, type, ...rest)
    }
  })
  const errors = await open(page, '/examples/three.html')
  await page.waitForTimeout(1500)
  expect(errors).toEqual([])
})

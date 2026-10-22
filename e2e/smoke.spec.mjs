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
  // on Linux, for one). That case is the SVG fallback's, tested below.
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

test('a rig in a second document (iframe) gets the rig stylesheet', async ({ page }) => {
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

test('a rig in a shadow root gets its styles there, and a gesture animates', async ({ page }) => {
  await ready(page)
  const result = await page.evaluate(() => {
    const { ActorRig, CHARACTERS } = window.pw
    const outer = document.createElement('div')
    document.body.append(outer)
    const shadow = outer.attachShadow({ mode: 'open' })
    const host = document.createElement('div')
    shadow.append(host)
    const rig = new ActorRig(CHARACTERS.roozi).mount(host)
    rig.playGesture('jump')
    const body = host.querySelector('.rig-body')
    return {
      css: [...shadow.querySelectorAll('style')].map((s) => s.textContent).join('\n'),
      running: body.getAnimations().length,
    }
  })
  expect(result.css).toContain('.shut')
  expect(result.running, 'jump keyframes resolve inside the shadow root').toBeGreaterThan(0)
})

test('with no WebGL, the three.js example falls back to the SVG rig', async ({ page }) => {
  // Every engine, every machine: refuse WebGL contexts before the page runs.
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return /webgl/.test(type) ? null : get.call(this, type, ...rest)
    }
  })
  const errors = await open(page, '/examples/three.html')
  await page.waitForSelector('#three svg.ca-svg', { state: 'attached', timeout: 15_000 })
  expect(await page.locator('#three canvas').count()).toBe(0)
  expect(errors).toEqual([])
})

test('a static render lands every part where the settled rig puts it', async ({ page }) => {
  // jsdom can compare the transforms the two write, but not where they put the
  // art: the outer carriers pivot about an origin the rig's stylesheet sets,
  // and a standalone SVG has no stylesheet (PW-08). So compare boxes.
  const errors = await ready(page)
  const frames = [
    { emotion: 'sad', intensity: 1 },
    { emotion: 'shy', intensity: 0.8, yaw: -1, gaze: { x: -1, y: 0.5 }, browRaise: 0.5, facing: 'left' },
    { emotion: 'excited', locomotion: 'walk', gaze: { x: 0.7, y: -0.3 } },
  ]
  const worst = await page.evaluate((frames) => {
    const { ActorRig, CHARACTERS, CHARACTER_SLUGS, renderActorSVG, defaultFrame } = window.pw
    const sel = ['.rig-body', '.lyr-torso', '.lyr-head', '.lyr-earL', '.lyr-earR', '.lyr-tail',
      '.lyr-farArm', '.lyr-nearArm', '.iris', '.browsG', '.mouthG', '.eyeG']
    const boxes = (host) => {
      const svg = host.querySelector('svg').getBoundingClientRect()
      const out = {}
      for (const s of sel) {
        host.querySelectorAll(s).forEach((el, i) => {
          const r = el.getBoundingClientRect()
          out[`${s}#${i}`] = [r.left - svg.left, r.top - svg.top, r.width, r.height]
        })
      }
      return out
    }
    let worst = { d: 0, at: '' }
    for (const slug of CHARACTER_SLUGS) {
      for (const [n, f] of frames.entries()) {
        const live = document.createElement('div')
        const still = document.createElement('div')
        document.body.append(live, still)
        // Locomotion: the rig's gait is time-based; reduced motion holds it.
        const rig = new ActorRig(CHARACTERS[slug], { size: 200, blink: false, reducedMotion: true }).mount(live)
        rig.apply(f)
        rig.finish()
        still.innerHTML = renderActorSVG(CHARACTERS[slug], { ...defaultFrame(slug), ...f }, 200)
        const a = boxes(live)
        const b = boxes(still)
        for (const k of Object.keys(a)) {
          if (!b[k]) return { d: Infinity, at: `${slug} frame ${n}: ${k} missing from the static render` }
          const d = Math.max(...a[k].map((v, i) => Math.abs(v - b[k][i])))
          if (d > worst.d) worst = { d, at: `${slug} frame ${n}: ${k}` }
        }
        rig.destroy()
        live.remove()
        still.remove()
      }
    }
    return worst
  }, frames)
  expect(worst.d, `largest box difference, at ${worst.at}`).toBeLessThan(0.5)
  expect(errors).toEqual([])
})

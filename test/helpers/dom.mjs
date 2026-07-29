import { JSDOM } from 'jsdom'

/**
 * A jsdom host with a *manual* clock and rAF queue.
 *
 * The rig's loop is driven by requestAnimationFrame and performance.now, so
 * leaving either to real time would make every timing assertion a race. Here
 * `advance(ms)` is the only thing that moves time, in fixed steps, exactly as
 * a browser would deliver frames.
 */
export function setupDom({ frameMs = 16 } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>')
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

  /** Run the rAF queue forward by `ms`, in `frameMs` steps. */
  const advance = (ms) => {
    let left = ms
    while (left > 0) {
      const d = Math.min(frameMs, left)
      now += d
      left -= d
      const due = queue
      queue = []
      for (const cb of due) cb(now)
    }
  }

  const restore = () => {
    for (const k of Object.keys(prev)) globalThis[k] = prev[k]
    window.close()
  }

  return { window, document: window.document, host: window.document.getElementById('host'), advance, restore }
}

/** The frame-driven DOM state — everything the interpolator is responsible for. */
export function readDom(host) {
  const svg = host.querySelector('svg')
  if (!svg) return null
  const eyeG = svg.querySelector('.eyeG')
  const lid = svg.querySelector('.lidLo')
  const iris = svg.querySelector('.iris')
  const brows = svg.querySelector('.browsG')
  return {
    svg,
    eyeTransform: eyeG?.getAttribute('transform') ?? '',
    eyeScale: Number(/scale\(([\d.]+)\)/.exec(eyeG?.getAttribute('transform') ?? '')?.[1] ?? 1),
    lidRy: Number(lid?.getAttribute('ry') ?? NaN),
    irisTransform: iris?.style.transform ?? '',
    irisDx: Number(/translate\((-?[\d.]+)px/.exec(iris?.style.transform ?? '')?.[1] ?? 0),
    browY: Number(/translateY\((-?[\d.]+)px\)/.exec(brows?.style.transform ?? '')?.[1] ?? 0),
    walking: svg.classList.contains('loco-walk'),
    flying: svg.classList.contains('loco-fly'),
  }
}

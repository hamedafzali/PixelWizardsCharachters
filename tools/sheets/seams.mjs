/**
 * The three seam and rim arguments, drawn.
 *
 * This sheet replaces `laki-sheet.mjs`, `tp-sheet.mjs` and `kh-sheet.mjs`
 * outright — not just their probe math, which moved to `tools/lib/probes.mjs`
 * earlier, but the sheets themselves. Those three each stood up their own
 * renderer: two of them called `renderActorSVG` and then string-injected
 * transforms they had recomputed by hand from `resolvePosture`, which depicts
 * what the author *believes* the rig writes rather than what it wrote. Here
 * every cell comes off a real mounted rig, and every number under a cell comes
 * from the same probe the test suite asserts on. A cell that looks wrong and a
 * guard that passes are now the same claim, which is the entire point.
 *
 * Each section carries the shipped choice next to the rejected one, because
 * "the pivot is at the seam" is not a visible property until you can see what
 * the alternative did.
 */

import { CHARACTERS, EMOTIONS, resolvePosture, GESTURES, GESTURE_NAMES, sampleAction } from '../../dist/index.js'
import { withRig, snapshot, parkLayer, shoot } from '../lib/harness.mjs'
import {
  LAKI, lakiRimY, lakiClearance, posturePose, worstOverAction,
  TP, tondpaSeamOverlap, KH, khersiSeamOverlap, khersiEarPenetration,
  earChordMidpoint, discBodySeamY, headPivot, MICRO_WORST,
  AV, avaPigtailPenetration,
  CH, charkhiRoofY, charkhiAntennaClip, charkhiAntennaClipOnset,
} from '../lib/probes.mjs'
import { page, esc } from '../lib/sheet.mjs'

export const name = 'seams'
export const title = 'Seams and rims — the geometry arguments, drawn'

const EMOS = Object.keys(EMOTIONS)
const STEPS = [0, 0.5, 1]
const SIZE = 104

/** Colour a margin by how close it is to the wall it is measured against. */
const band = (v, floor) =>
  v < floor ? 'bad' : v < floor * 1.35 ? 'near' : 'ok'

/**
 * Pose a layer *and* move its pivot — the only way to depict a rejected pivot,
 * since the shipped one is baked into the spec.
 */
function parkAt(svg, layer, pose, origin) {
  const el = svg.querySelector(`.${layer}`)
  if (!el) return
  if (origin) el.style.transformOrigin = `${origin[0]}px ${origin[1]}px`
  parkLayer(svg, layer, pose)
}

/** A grid of emotion rows × intensity columns, annotated with a measured margin. */
function postureGrid(slug, measure, floor, unit) {
  return withRig(slug, {}, ({ svg, rig, dom }) => {
    const rows = EMOS.map((emotion) => {
      const cells = STEPS.map((intensity) => {
        rig.apply({ emotion, intensity })
        rig.finish()
        dom.advance(32)
        const p = resolvePosture(emotion, intensity, CHARACTERS[slug].posture)
        const v = measure(p)
        return `<td>${snapshot(svg, SIZE)}<div class="ph ${band(v, floor)}">${v.toFixed(unit)}</div></td>`
      }).join('')
      return `<tr><td class="n">${esc(emotion)}</td>${cells}</tr>`
    }).join('')
    const head = `<tr><th>${esc(slug)}</th>${STEPS.map((s) => `<th>intensity ${s}</th>`).join('')}</tr>`
    return `<div class="wrap"><table>${head}${rows}</table></div>`
  })
}

/** A filmstrip of one head action, annotated with the clearance at each frame. */
function actionStrip(slug, action, measure, floor, unit, cols = 9) {
  return withRig(slug, {}, ({ svg }) =>
    Array.from({ length: cols }, (_, i) => {
      const t = i / (cols - 1)
      const pose = sampleAction(action, t)
      const html = snapshot(svg, SIZE, (s) => parkLayer(s, 'lyr-head', pose))
      const v = measure(pose)
      return `<td>${html}<div class="ph ${band(v, floor)}">${(t * 100).toFixed(0)}% · ${v.toFixed(unit)}</div></td>`
    }).join(''))
}

const headParts = (g) => GESTURES[g].parts.filter((p) => p.layer === 'lyr-head')
const headGestures = () => GESTURE_NAMES.filter((g) => headParts(g).length > 0)

// ── لاکی ─────────────────────────────────────────────────────────────────────

function laki() {
  const out = [`<h2>لاکی — the head behind the shell</h2>`]
  const worstPosture = (p) => {
    const c = lakiClearance(posturePose(p))
    return Math.min(c.mouth, c.head)
  }
  out.push(`<p class="note">Two walls, both measured in art units and both positive when safe: how
    far the widest open viseme stays clear of the shell rim, and how far the bottom of the head disc
    stays tucked under it. The guard requires 1 either side. The number under each cell is the
    tighter of the two — <span class="ph ok" style="display:inline">comfortable</span>,
    <span class="ph near" style="display:inline">close</span>,
    <span class="ph bad" style="display:inline">through the wall</span>.</p>`)
  out.push(postureGrid('laki', worstPosture, 1, 2))

  out.push(`<h2 style="opacity:.8">لاکی — the same walls, through the gestures</h2>`)
  out.push(`<p class="note">A gesture replaces the head pose outright for its duration, and the
    derived anticipation loads <b>downward</b> — which on this character is straight toward the rim.
    Sweeping the authored poses alone reports a margin the rig never holds: on <code>shake</code> it
    claims 4.00 where the real timeline reaches 3.05. Note that the posture grid above is still the
    tighter case overall (1.84 at shy/1) — the point is not that gestures are worse, it is that the
    authored keyframes were never the whole story.</p>`)
  for (const g of headGestures()) {
    const action = headParts(g)[0].action
    const worst = worstOverAction(action, lakiClearance)
    const opted = (CHARACTERS.laki.gestureFallback ?? []).includes(g)
    out.push(`<p class="note"><b>${esc(g)}</b> — worst ${worst.margin.toFixed(2)} on
      <code>${esc(worst.channel)}</code> at t=${worst.t.toFixed(3)}. ${
      opted
        ? '<b>Rejected:</b> لاکی declares this a fallback, so it plays on the whole body instead. This strip is what it would look like if it did not.'
        : 'Shipped: this plays on the head.'}</p>`)
    out.push(`<div class="wrap"><table><tr>${
      actionStrip('laki', action, (p) => {
        const c = lakiClearance(p)
        return Math.min(c.mouth, c.head)
      }, 1, 2)}</tr></table></div>`)
  }

  out.push(`<p class="note">The rim itself is two cubics meeting at the apex — y=76 at x=100, falling
    to y=${lakiRimY(38).toFixed(0)} at the shell's edge. Every gesture frame above sits within a
    fifth of a unit of that apex, which is why the rim solver has its own test rather than being
    covered by these margins: a flat y=76 would produce this exact sheet.</p>`)
  return out.join('\n')
}

// ── تندپا ────────────────────────────────────────────────────────────────────

function tondpa() {
  const [ox, oy] = headPivot('tondpa')
  const { seamY } = discBodySeamY(TP.disc, TP.body)
  const out = [`<h2>تندپا — the seam you cannot see</h2>`]
  out.push(`<p class="note">The head disc and the body ellipse carry the same fill, so the join at
    y≈${seamY.toFixed(1)} is invisible at rest and an over-wide posture would not be caught by
    looking. What <i>would</i> show is the head pulling free: a band of background across the neck.
    The number is head∩body overlap in square art units; the floor is 120 and the head detaches
    entirely at headDrop ${TP.detachAt}.</p>`)
  out.push(postureGrid('tondpa',
    (p) => tondpaSeamOverlap((p.headTilt ?? 0) + MICRO_WORST.rot, (p.headDrop ?? 0) + MICRO_WORST.y), 120, 0))

  out.push(`<h2 style="opacity:.8">تندپا — shipped pivot vs the one that was rejected</h2>`)
  out.push(`<p class="note">The pivot sits at the measured head/body crossing (${ox}, ${oy}), not at
    the disc centre (${TP.disc.cx}, ${TP.disc.cy}). No overlap sweep can tell these apart — rotating a
    circle about its own centre moves nothing, so the rejected pivot passes every area check ever
    written. It is wrong anyway, and only the eye says so: at the disc centre the head swivels in
    place like a dial; at the seam it cranes off the shoulders. Both at headTilt 14°.</p>`)
  out.push(pivotCompare('tondpa', [ox, oy], [TP.disc.cx, TP.disc.cy], { rot: 14 },
    'shipped — the measured seam', 'rejected — the disc centre'))
  return out.join('\n')
}

// ── خرسی ─────────────────────────────────────────────────────────────────────

function khersi() {
  const out = [`<h2>خرسی — the one seam you can actually see</h2>`]
  out.push(`<p class="note">Unlike تندپا, the head and body are different gradients, so this join is a
    real tonal edge and the eye is a usable check. Overlap in square art units; detach at headDrop
    ${KH.detachAt}.</p>`)
  out.push(postureGrid('khersi',
    (p) => khersiSeamOverlap((p.headTilt ?? 0) + MICRO_WORST.rot, (p.headDrop ?? 0) + MICRO_WORST.y), 150, 0))

  out.push(`<h2 style="opacity:.8">خرسی — the ears</h2>`)
  out.push(`<p class="note">The ears are their own layer with their own pivot, so unlike تندپا's
    cheeks they are not rigid with the head and can in principle walk off it. The number is how deeply
    the ear still bites into the skull; positive is attached, and the guard wants more than 8.</p>`)
  out.push(withRig('khersi', {}, ({ svg, rig, dom }) => {
    const rows = EMOS.map((emotion) => {
      const cells = STEPS.map((intensity) => {
        rig.apply({ emotion, intensity })
        rig.finish()
        dom.advance(32)
        const p = resolvePosture(emotion, intensity, CHARACTERS.khersi.posture)
        const v = Math.min(...['earL', 'earR'].map((s) =>
          khersiEarPenetration(s, p.ears ?? 0, (p.headTilt ?? 0) + MICRO_WORST.rot, (p.headDrop ?? 0) + MICRO_WORST.y)))
        return `<td>${snapshot(svg, SIZE)}<div class="ph ${band(v, 8)}">${v.toFixed(2)}</div></td>`
      }).join('')
      return `<tr><td class="n">${esc(emotion)}</td>${cells}</tr>`
    }).join('')
    return `<div class="wrap"><table><tr><th>ear grip</th>${
      STEPS.map((s) => `<th>intensity ${s}</th>`).join('')}</tr>${rows}</table></div>`
  }))

  const [hx, hy] = headPivot('khersi')
  const { point } = earChordMidpoint(KH.ears.earL, KH.head)
  out.push(`<h2 style="opacity:.8">خرسی — shipped ear pivot vs the one that was rejected</h2>`)
  out.push(`<p class="note">An ear's centre sits outside the skull, so there is no drawn base to read
    a pivot off — it comes from the two-circle intersection, the chord midpoint at
    (${point[0].toFixed(1)}, ${point[1].toFixed(1)}). Its own centre would also "work" in the sense
    that nothing visibly breaks at rest, which is exactly why this is drawn. Both at 26° of ear
    rotation.</p>`)
  out.push(withRig('khersi', {}, ({ svg }) => {
    const cell = (origin, label) => {
      const html = snapshot(svg, 150, (s) => {
        parkAt(s, 'lyr-earL', { rot: 26 }, origin)
        parkAt(s, 'lyr-earR', { rot: -26 }, origin && [200 - origin[0], origin[1]])
      })
      return `<td>${html}<div class="ph">${esc(label)}</div></td>`
    }
    return `<div class="wrap"><table><tr>${
      cell(null, 'shipped — the head/ear chord midpoint')}${
      cell([KH.ears.earL.cx, KH.ears.earL.cy], 'rejected — the ear’s own centre')}</tr></table></div>`
  }))

  out.push(`<p class="note">Head pivot for reference: (${hx}, ${hy}), the measured head/body
    crossing.</p>`)
  return out.join('\n')
}

// ── آوا ──────────────────────────────────────────────────────────────────────

function ava() {
  const out = [`<h2>آوا — the pigtails</h2>`]
  out.push(`<p class="note">The bunches reuse the earL/earR slots (آوا has no drawn ears), so they ride
    the shared <code>posture.ears</code> channel — including the default, since آوا never overrides
    <code>ears</code> for any emotion. The number is how deeply a bunch still overlaps the head disc;
    positive is attached, and the guard wants more than 8.</p>`)
  out.push(withRig('ava', {}, ({ svg, rig, dom }) => {
    const rows = EMOS.map((emotion) => {
      const cells = STEPS.map((intensity) => {
        rig.apply({ emotion, intensity })
        rig.finish()
        dom.advance(32)
        const p = resolvePosture(emotion, intensity, CHARACTERS.ava.posture)
        const v = Math.min(...['earL', 'earR'].map((s) =>
          avaPigtailPenetration(s, p.ears ?? 0, (p.headTilt ?? 0) + MICRO_WORST.rot, (p.headDrop ?? 0) + MICRO_WORST.y)))
        return `<td>${snapshot(svg, SIZE)}<div class="ph ${band(v, 8)}">${v.toFixed(2)}</div></td>`
      }).join('')
      return `<tr><td class="n">${esc(emotion)}</td>${cells}</tr>`
    }).join('')
    return `<div class="wrap"><table><tr><th>pigtail grip</th>${
      STEPS.map((s) => `<th>intensity ${s}</th>`).join('')}</tr>${rows}</table></div>`
  }))

  const [hx, hy] = headPivot('ava')
  const { point } = earChordMidpoint(AV.pigtails.earL, AV.head)
  out.push(`<h2 style="opacity:.8">آوا — shipped pivot vs the one that was rejected</h2>`)
  out.push(`<p class="note">Unlike خرسی's ears, a bunch's own centre sits just <i>inside</i> the head
    disc (d ≈ 42 &lt; head.r 45) — but the bunch is big enough that its circle still crosses the
    boundary, so the two-circle intersection is still well defined: the chord midpoint at
    (${point[0].toFixed(1)}, ${point[1].toFixed(1)}). The bunch's own centre is not a true no-op here
    (it is not concentric with the head), but it is still not where the hair actually leaves the skull.
    Both at 26° of pigtail rotation.</p>`)
  out.push(withRig('ava', {}, ({ svg }) => {
    const cell = (origin, label) => {
      const html = snapshot(svg, 150, (s) => {
        parkAt(s, 'lyr-earL', { rot: 26 }, origin)
        parkAt(s, 'lyr-earR', { rot: -26 }, origin && [200 - origin[0], origin[1]])
      })
      return `<td>${html}<div class="ph">${esc(label)}</div></td>`
    }
    return `<div class="wrap"><table><tr>${
      cell(null, 'shipped — the head/bunch chord midpoint')}${
      cell([AV.pigtails.earL.cx, AV.pigtails.earL.cy], 'rejected — the bunch’s own centre')}</tr></table></div>`
  }))

  out.push(`<h2 style="opacity:.8">آوا — the pigtails through nod and shake</h2>`)
  out.push(`<p class="note">آوا natively drives <code>lyr-head</code> for both gestures (no
    <code>gestureFallback</code>, unlike لاکی), so the posture sweep above is not the whole story.</p>`)
  for (const g of headGestures()) {
    const action = headParts(g)[0].action
    const worst = worstOverAction(action, (p) => ({
      earL: avaPigtailPenetration('earL', 0, (p.rot ?? 0) + MICRO_WORST.rot, (p.y ?? 0) + MICRO_WORST.y),
      earR: avaPigtailPenetration('earR', 0, (p.rot ?? 0) + MICRO_WORST.rot, (p.y ?? 0) + MICRO_WORST.y),
    }))
    out.push(`<p class="note"><b>${esc(g)}</b> — worst ${worst.margin.toFixed(2)} on
      <code>${esc(worst.channel)}</code> at t=${worst.t.toFixed(3)}.</p>`)
    out.push(`<div class="wrap"><table><tr>${
      actionStrip('ava', action, (p) => Math.min(
        avaPigtailPenetration('earL', 0, (p.rot ?? 0) + MICRO_WORST.rot, (p.y ?? 0) + MICRO_WORST.y),
        avaPigtailPenetration('earR', 0, (p.rot ?? 0) + MICRO_WORST.rot, (p.y ?? 0) + MICRO_WORST.y),
      ), 8, 2)}</tr></table></div>`)
  }

  out.push(`<p class="note">Head pivot for reference: (${hx}, ${hy}).</p>`)
  return out.join('\n')
}

// ── چرخی ─────────────────────────────────────────────────────────────────────

function charkhi() {
  const out = [`<h2>چرخی — the antennas, clipping in rather than pulling out</h2>`]
  out.push(`<p class="note">آوا's and خرسی's ear/pigtail pivots are chord-midpoints because the
    drawn bunch's own centre sits outside the head disc, with no drawn base to read a pivot from —
    so the failure they guard against is the bunch pulling <i>free</i> of the head. چرخی's antennas
    are the opposite case: the root is drawn exactly on the roofline (a literal on-curve vertex of
    the torso path, (${CH.earL.base[0]}, ${CH.earL.base[1]}) / (${CH.earR.base[0]}, ${CH.earR.base[1]})),
    so the stalk cannot detach by rotating about a point that already is the body's own edge. What it
    can do instead is swing back down far enough to dip <i>under</i> the roofline it grows from — a
    clip inward, not a pull outward. The number is roof clearance in art units, positive is clear; the
    guard wants more than 1.</p>`)
  out.push(withRig('charkhi', {}, ({ svg, rig, dom }) => {
    const rows = EMOS.map((emotion) => {
      const cells = STEPS.map((intensity) => {
        rig.apply({ emotion, intensity })
        rig.finish()
        dom.advance(32)
        const p = resolvePosture(emotion, intensity, CHARACTERS.charkhi.posture)
        const v = Math.min(...['earL', 'earR'].map((s) => charkhiAntennaClip(s, p.ears ?? 0)))
        return `<td>${snapshot(svg, SIZE)}<div class="ph ${band(v, 1)}">${v.toFixed(2)}</div></td>`
      }).join('')
      return `<tr><td class="n">${esc(emotion)}</td>${cells}</tr>`
    }).join('')
    return `<div class="wrap"><table><tr><th>antenna clearance</th>${
      STEPS.map((s) => `<th>intensity ${s}</th>`).join('')}</tr>${rows}</table></div>`
  }))

  const onsetL = charkhiAntennaClipOnset('earL')
  out.push(`<p class="note">Worst measured clearance across the full emotion × intensity grid is
    1.302 (sad, intensity 1) — found by sweeping, not assumed. Clipping itself would not begin until
    ${onsetL.toFixed(1)}° of droop, roughly 3.9× چرخی's own largest declared <code>ears</code> travel
    (18° at <code>sad</code>). Roofline for reference: y=${charkhiRoofY(58).toFixed(0)} at the
    shoulder (x=58), falling to y=${charkhiRoofY(100).toFixed(0)} at the apex (x=100).</p>`)
  return out.join('\n')
}

/** Two cells of the same character and pose, differing only in pivot. */
function pivotCompare(slug, shippedOrigin, rejectedOrigin, pose, aLabel, bLabel) {
  return withRig(slug, {}, ({ svg }) => {
    const cell = (origin, label) => {
      const html = snapshot(svg, 150, (s) => parkAt(s, 'lyr-head', pose, origin))
      return `<td>${html}<div class="ph">${esc(label)}</div></td>`
    }
    return `<div class="wrap"><table><tr>${
      cell(shippedOrigin, aLabel)}${cell(rejectedOrigin, bLabel)}</tr></table></div>`
  })
}

export function build() {
  const parts = [`<h1>${esc(title)}</h1>`]
  parts.push(`<p class="lede">Every cell is a real mounted rig, and every number under a cell comes
    from the probe the test suite asserts on — <code>tools/lib/probes.mjs</code>. Blink and idle
    micro-motion are off, but the margins include the worst push micro-motion can add
    (${MICRO_WORST.y} on drop, ${MICRO_WORST.rot}° on tilt), so the numbers are the guarded case
    rather than the drawn one.</p>`)
  parts.push(`<style>
    .ph.ok{color:#30d158}.ph.near{color:#ff9f0a}.ph.bad{color:#ff375f;font-weight:600}
  </style>`)
  parts.push(laki())
  parts.push(tondpa())
  parts.push(khersi())
  parts.push(ava())
  parts.push(charkhi())
  return page(title, parts.join('\n'))
}

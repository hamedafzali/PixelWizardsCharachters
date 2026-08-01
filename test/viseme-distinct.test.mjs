/**
 * A viseme table is a set of distinctions. Two entries that render alike are
 * one entry, however different they look in `VISEMES`.
 *
 * This exists because `rest` and `mbp` — declared distinct, one an open-ish
 * neutral and one an explicit lip closure — rendered byte-identical markup for
 * the whole life of the library, and no test noticed. `drawMouth` routes
 * `viseme.closed || o < 0.06` into a single branch, and `rest`'s aperture of
 * 0.05 fell under the threshold with the same width, so the two collapsed. It
 * was found by looking at a contact sheet, which is not a thing that runs in
 * CI.
 *
 * So the assertion is over *every* pair, not that pair: any two visemes whose
 * declared drawing properties differ must draw differently, on lipped and
 * beaked mouths alike.
 *
 * **Distinctness is geometric, not textual.** Two strings that differ by 0.45
 * art units in a 200-unit space are two strings and one picture — which is
 * exactly what the beak branch was doing, and a string-inequality test would
 * have passed it while the collision stood. Numbers are compared with a
 * minimum separation instead.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { VISEMES, drawMouth } from '../dist/index.js'

const NAMES = Object.keys(VISEMES)

/** The two mouth kinds `drawMouth` supports; both branches must be checked. */
const MOUTHS = {
  lips: { cx: 100, cy: 104, color: '#c0392b' },
  beak: { cx: 100, cy: 104, color: '#f19100', beak: true },
}

/**
 * Smallest difference in art units that is a difference anyone can see.
 *
 * The art space is 200 units wide and a mouth is about 18 of them, drawn into
 * cells as small as 40px. A coordinate that moves by less than a unit has not
 * moved. Deliberately not zero: the point of the test is that "the strings
 * differ" is the wrong question.
 */
const MIN_SEP = 1

const skeleton = (html) => html.replace(/-?\d+(\.\d+)?/g, '#')
const numbers = (html) => (html.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

/** How far apart two renderings are: Infinity if they differ structurally. */
function separation(a, b) {
  if (skeleton(a) !== skeleton(b)) return Infinity // different elements entirely
  const na = numbers(a)
  const nb = numbers(b)
  return na.reduce((max, v, i) => Math.max(max, Math.abs(v - nb[i])), 0)
}

/** The properties that actually reach the renderer. */
const DRAWN = ['o', 'w', 'r', 'closed', 'tongue', 'tuck']
const declaredDiffer = (a, b) => DRAWN.some((k) => (a[k] ?? null) !== (b[k] ?? null))

test('every viseme pair declared distinct renders distinct, on both mouth kinds', () => {
  const collisions = []
  for (const [kind, mouth] of Object.entries(MOUTHS)) {
    for (let i = 0; i < NAMES.length; i++) {
      for (let j = i + 1; j < NAMES.length; j++) {
        const a = NAMES[i]
        const b = NAMES[j]
        if (!declaredDiffer(VISEMES[a], VISEMES[b])) continue
        // mouthOpen 0 is what speak() pins every step to, so this is the
        // playback case and not a hypothetical one.
        const sep = separation(drawMouth(mouth, VISEMES[a], 0), drawMouth(mouth, VISEMES[b], 0))
        if (sep < MIN_SEP) collisions.push(`${kind}: ${a}/${b} separated by ${sep}`)
      }
    }
  }
  assert.deepEqual(collisions, [], `visemes that draw the same mouth:\n  ${collisions.join('\n  ')}`)
})

test('the two shapes that actually collided are separated, and in the right direction', () => {
  // Named explicitly as well as covered by the sweep above, because this is
  // the regression and a sweep that silently stopped covering it would still
  // pass. A press is narrower and flatter than a rest — if that inverts, the
  // shapes are distinct but the mouth is wrong.
  for (const [kind, mouth] of Object.entries(MOUTHS)) {
    const rest = drawMouth(mouth, VISEMES.rest, 0)
    const mbp = drawMouth(mouth, VISEMES.mbp, 0)
    assert.notEqual(rest, mbp, `${kind}: rest and mbp still render identically`)
    assert.ok(separation(rest, mbp) >= MIN_SEP, `${kind}: rest and mbp differ by less than a unit`)
  }
  const lipRest = numbers(drawMouth(MOUTHS.lips, VISEMES.rest, 0))
  const lipMbp = numbers(drawMouth(MOUTHS.lips, VISEMES.mbp, 0))
  // [Mx, My, Qx, Qy, Ex, Ey, stroke-width] — the press is the narrower mouth.
  assert.ok(lipMbp[0] > lipRest[0], 'the pressed mouth should be narrower than the rest')
  assert.ok(lipMbp[3] < lipRest[3], 'the pressed mouth should be flatter than the rest')
})

test('a closed beak is shut, not nearly shut', () => {
  // The beak collision was subtler: `open = 3 + o * 9` gave mbp 3.0 and rest
  // 3.45, which is two strings and one picture. `closed` now means zero.
  const shut = drawMouth(MOUTHS.beak, VISEMES.mbp, 0)
  const open = drawMouth(MOUTHS.beak, VISEMES.aa, 0)
  assert.ok(separation(shut, open) > 5, 'a closed beak and an open one should be far apart')
})

test('mouthOpen opens a mouth held shut by threshold, but not one declared closed', () => {
  // Two different things, and only one of them is a `mouthOpen` override.
  //
  // `rest` is shut because its aperture happens to sit under 0.06, so pushing
  // mouthOpen past the threshold opens it — `Math.max(viseme.o, mouthOpen)`.
  const rest = drawMouth(MOUTHS.lips, VISEMES.rest, 0)
  assert.match(drawMouth(MOUTHS.lips, VISEMES.rest, 0.8), /<ellipse/, 'mouthOpen should open a resting mouth')
  assert.match(rest, /^<path /)

  // `mbp` is shut because the table *says* so, and `viseme.closed ||`
  // short-circuits before the aperture is consulted. So a lip closure stays
  // closed at any mouthOpen. That predates this fix and is the right
  // behaviour — an /m/ with the lips forced apart is not an /m/ — but it is
  // asserted here because nothing else asserted it, and the obvious wrong fix
  // for the collision is to make `closed` yield to mouthOpen.
  assert.equal(drawMouth(MOUTHS.lips, VISEMES.mbp, 1), drawMouth(MOUTHS.lips, VISEMES.mbp, 0),
    'a declared-closed viseme should stay closed at any mouthOpen')
})

test('a mouth kind may not silently drop a declared property it can express', () => {
  // The beak branch ignored `tongue` entirely, so `l` — the busiest viseme in
  // the language, a third of all emitted frames — was drawn on an owl as a
  // plain aperture differing from `e` by 0.88 art units. The lips have drawn
  // its tongue all along. Same table, two levels of detail.
  //
  // Asserted as a property rather than a separation, because that is what the
  // tongue is for: a separation floor is a lower bound the range widening
  // happens to clear on its own, and a test written to that floor let the
  // tongue be deleted without failing.
  //
  // `tuck` is deliberately NOT covered by this. Tucking the lower lip under
  // the teeth is a thing lips do and a beak does not, so its absence there is
  // anatomy rather than an oversight. `tongue` differs: an open beak has one.
  for (const [name, spec] of Object.entries(VISEMES)) {
    if (!spec.tongue || spec.o <= 0.3) continue
    for (const [kind, mouth] of Object.entries(MOUTHS)) {
      assert.match(drawMouth(mouth, spec, 0), /#ff7a95/,
        `${kind}: viseme "${name}" declares a tongue and does not draw one`)
    }
  }
})

test('rest is still a closed mouth', () => {
  // The cheapest wrong fix is to push rest over the 0.06 threshold, which
  // separates it from mbp by giving a resting character a permanently open
  // mouth. Guard the property, not the constant.
  assert.ok(VISEMES.rest.o < 0.06, 'rest should stay under the closed threshold')
  assert.match(drawMouth(MOUTHS.lips, VISEMES.rest, 0), /^<path /, 'rest should draw a line, not an ellipse')
})

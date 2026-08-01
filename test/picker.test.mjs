/**
 * Two pickers, one roster.
 *
 * `createCharacterPicker` (plain DOM) and `CharacterPicker` (React) render
 * different markup on purpose — one builds elements, the other returns a tree —
 * but neither may contain a list of characters. This file enumerates both by
 * walking what they actually produce, and asserts they agree with each other
 * and with `CHARACTER_SLUGS`.
 *
 * The React side is genuinely rendered, through `react-dom/server`, rather than
 * having its returned element tree walked. Walking the tree would mean calling
 * the component as a bare function, which skips hooks — and the component uses
 * `useMemo`, so that would be testing a version of it that does not exist.
 * `react` and `react-dom` are devDependencies only; the published package still
 * has zero runtime dependencies and React stays a peer.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { setupDom } from './helpers/dom.mjs'
import { CHARACTER_SLUGS, CHARACTERS, characterRoster, createCharacterPicker } from '../dist/index.js'
import { CharacterPicker } from '../dist/react.js'

/** Every `data-slug` the vanilla picker put in the DOM, in document order. */
function vanillaSlugs(opts = {}) {
  const dom = setupDom()
  try {
    createCharacterPicker(dom.host, opts)
    return [...dom.host.querySelectorAll('[data-slug]')].map((el) => el.dataset.slug)
  } finally {
    dom.restore()
  }
}

/** Every `data-slug` in the markup React actually renders, in order. */
function reactSlugs(props = {}) {
  const html = renderToStaticMarkup(React.createElement(CharacterPicker, props))
  return [...html.matchAll(/data-slug="([^"]+)"/g)].map((m) => m[1])
}

test('both pickers enumerate the identical roster, in the identical order', () => {
  const vanilla = vanillaSlugs()
  const react = reactSlugs()
  assert.deepEqual(vanilla, [...CHARACTER_SLUGS],
    'the DOM picker no longer matches CHARACTER_SLUGS')
  assert.deepEqual(react, [...CHARACTER_SLUGS],
    'the React picker no longer matches CHARACTER_SLUGS')
  assert.deepEqual(vanilla, react, 'the two pickers have drifted apart')
})

test('the roster is not empty and is not a hardcoded list of one', () => {
  // Same shape of guard as the baseline's "did this measure anything" check: a
  // picker that rendered nothing would satisfy every deepEqual above if
  // CHARACTER_SLUGS also somehow emptied.
  assert.ok(CHARACTER_SLUGS.length >= 8, 'the roster shrank — was that intended?')
  assert.equal(new Set(CHARACTER_SLUGS).size, CHARACTER_SLUGS.length, 'duplicate slug in the roster')
})

test('every roster entry carries a real thumbnail of the character it names', () => {
  // A picker whose thumbnails were all the same character would pass a slug
  // comparison perfectly. The art is keyed off the spec, so it is checkable.
  const seen = new Set()
  for (const e of characterRoster({ size: 64 })) {
    assert.ok(e.svg.startsWith('<svg'), `${e.slug}: no SVG`)
    assert.match(e.svg, /width="64"/, `${e.slug}: thumbnail ignored the size`)
    assert.equal(e.name, CHARACTERS[e.slug].name, `${e.slug}: name does not match the spec`)
    assert.ok(!seen.has(e.svg), `${e.slug} renders identically to an earlier character`)
    seen.add(e.svg)
  }
  assert.equal(seen.size, CHARACTER_SLUGS.length)
})

test('the DOM picker marks exactly one selection, and honours the one it was given', () => {
  const dom = setupDom()
  try {
    const picker = createCharacterPicker(dom.host, { value: 'khersi' })
    const on = () => [...dom.host.querySelectorAll('.is-selected')].map((e) => e.dataset.slug)
    assert.deepEqual(on(), ['khersi'])
    assert.equal(picker.value, 'khersi')
    // Roving tabindex: one tab stop for the whole group, not eight.
    const tabbable = [...dom.host.querySelectorAll('[data-slug]')].filter((e) => e.tabIndex === 0)
    assert.equal(tabbable.length, 1, 'a radiogroup must be a single tab stop')

    picker.setValue('roozi')
    assert.deepEqual(on(), ['roozi'])
  } finally {
    dom.restore()
  }
})

test('an unknown initial value falls back to the first character rather than selecting nothing', () => {
  const dom = setupDom()
  try {
    const picker = createCharacterPicker(dom.host, { value: 'not-a-character' })
    assert.equal(picker.value, CHARACTER_SLUGS[0])
    assert.equal(dom.host.querySelectorAll('.is-selected').length, 1)
  } finally {
    dom.restore()
  }
})

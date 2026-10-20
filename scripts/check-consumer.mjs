// What a consumer on the oldest supported Node (`engines`) actually runs: the
// built entry points, imported as ESM, with no DOM. The test suite itself needs
// a newer Node (jsdom 29), so this is the only check that covers the low end.
import assert from 'node:assert/strict'

const core = await import('../dist/index.js')
const three = await import('../dist/three/index.js')

assert.equal(core.CHARACTER_SLUGS.length, Object.keys(core.CHARACTERS).length)
for (const slug of core.CHARACTER_SLUGS) {
  const svg = core.renderActorSVG(core.CHARACTERS[slug], core.defaultFrame(slug), 120)
  assert.match(svg, /^<svg /, `${slug} renders an <svg>`)
}
assert.deepEqual(core.textToVisemes('سلام').length > 0, true)
assert.equal(typeof three.ActorModel, 'function')

console.log(`Node ${process.version}: ${core.CHARACTER_SLUGS.length} characters render, /three loads.`)

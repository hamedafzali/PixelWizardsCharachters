// What `npm publish` would ship, checked before it ships: every entry point and
// its types present, nothing from the dev side leaking in, and the size inside
// a budget. The budget sits ~20% over the measured size, so ordinary growth
// passes and an accident (a stray `out/` or tarball in `files`) does not.
import { execFileSync } from 'node:child_process'

const BUDGET = { packed: 400_000, unpacked: 1_600_000 }

const REQUIRED = [
  'package.json', 'README.md', 'LICENSE', 'CHANGELOG.md',
  'dist/index.js', 'dist/index.d.ts',
  'dist/react.js', 'dist/react.d.ts',
  'dist/three/index.js', 'dist/three/index.d.ts',
  // the source maps point here
  'src/index.ts',
]
const FORBIDDEN = /^(test|tools|examples|e2e|scripts|out|docs|node_modules)\/|\.tgz$/

const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' }))
const files = new Set(pack.files.map((f) => f.path))
const problems = []

for (const f of REQUIRED) if (!files.has(f)) problems.push(`missing: ${f}`)
for (const f of files) if (FORBIDDEN.test(f)) problems.push(`should not ship: ${f}`)
if (pack.size > BUDGET.packed) problems.push(`packed ${pack.size} B > budget ${BUDGET.packed} B`)
if (pack.unpackedSize > BUDGET.unpacked) problems.push(`unpacked ${pack.unpackedSize} B > budget ${BUDGET.unpacked} B`)

const kb = (n) => `${(n / 1000).toFixed(1)} kB`
console.log(`${pack.entryCount} files, ${kb(pack.size)} packed, ${kb(pack.unpackedSize)} unpacked`)
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

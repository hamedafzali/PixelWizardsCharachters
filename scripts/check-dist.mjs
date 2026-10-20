// `dist/` is committed, so a source change without a rebuild ships stale code.
// This builds `src/` into a scratch directory beside `dist/` (same depth, so the
// source-map paths come out identical) and compares the two both ways: a file
// that differs, one the build no longer makes (tsc never deletes those) and one
// `dist/` is missing all fail. `dist/` itself is never touched.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const fresh = join(root, '.dist-check')

const list = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => relative(dir, join(d.parentPath ?? d.path, d.name)))

rmSync(fresh, { recursive: true, force: true })
try {
  execFileSync(join(root, 'node_modules/.bin/tsc'), ['--outDir', fresh], { cwd: root, stdio: 'inherit' })
  const built = new Set(list(fresh))
  const committed = new Set(list(dist))
  const problems = []
  for (const f of built) {
    if (!committed.has(f)) problems.push(`missing from dist/: ${f}`)
    else if (!readFileSync(join(fresh, f)).equals(readFileSync(join(dist, f)))) problems.push(`differs: dist/${f}`)
  }
  for (const f of committed) if (!built.has(f)) problems.push(`not built from src/ (stale?): dist/${f}`)

  if (problems.length) {
    console.error('dist/ is out of date with src/. Run `npm run build` and commit the result:\n')
    console.error(problems.sort().join('\n'))
    process.exitCode = 1
  } else {
    console.log(`dist/ matches a fresh build of src/ (${built.size} files).`)
  }
} finally {
  rmSync(fresh, { recursive: true, force: true })
}

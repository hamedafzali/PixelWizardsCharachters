/**
 * Mutation harness — with the "did it actually apply?" check built in.
 *
 * ## Why this exists as a module rather than a shell one-liner
 *
 * Three times now the *verification tooling* has had a silent defect that made
 * a check look like it ran clean when it had not run at all:
 *
 *   1. a fly-phase grid whose quantization collapsed every sample onto the same
 *      phase, so the sweep compared a value against itself;
 *   2. a mutation patch that never applied, reported as a surviving mutant —
 *      i.e. read as "the guard is weak" when the guard was never challenged;
 *   3. four `grep`/`perl` patterns with regex errors (an unescaped paren, an
 *      invalid repeat, a literal `\n` in a non-`-0` substitution) that matched
 *      nothing and produced a clean-looking pass.
 *
 * All three share a shape: **absence of evidence rendered as evidence of
 * absence.** A hand-rolled mutation run is especially prone to it, because the
 * expected outcome of a mutation is a *failing* test — so a mutation that does
 * nothing and a mutation that is caught both end in "everything is fine".
 *
 * The fix is the same one applied to pivots: stop restating, start measuring.
 * A pivot is read from the shipped spec so a test cannot hold a stale copy; a
 * mutation is verified against the bytes on disk so a run cannot claim to have
 * tested a change it never made.
 *
 * ## The invariant
 *
 * {@link applyMutation} refuses to report anything but `not-applied` unless the
 * file content **actually changed**, byte for byte, and the change is the one
 * asked for. There is no path through this module that runs a test suite
 * against unmutated code and calls the result a kill. That is the point.
 *
 * A mutation is therefore a four-state result, never two:
 *
 *   `killed`      — applied, bytes changed, at least one test failed. Good.
 *   `survived`    — applied, bytes changed, every test passed. A real gap.
 *   `not-applied` — the pattern matched nothing. **A broken mutation, not a
 *                   result.** Fix the pattern; it says nothing about the guard.
 *   `no-op`       — the pattern matched but produced identical bytes. Also
 *                   broken: a mutation that changes nothing cannot be caught.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12)

/**
 * Rewrite `file` by `mutate(text) → text`, and prove the rewrite happened.
 *
 * Returns `{ ok, before, after, reason }` and **writes nothing** unless the
 * content genuinely differs. `expect`, when given, is a literal substring that
 * must be present afterwards — a second, independent check that the change is
 * the intended one and not an accidental match elsewhere in the file.
 */
export async function applyMutation(file, mutate, expect, absent) {
  const before = await readFile(file, 'utf8')
  const after = mutate(before)

  if (typeof after !== 'string') {
    return { ok: false, before, reason: 'the mutate function returned no text' }
  }
  if (after === before) {
    // The single most important branch in this file. Historically this was the
    // case that silently reported as a survivor.
    return { ok: false, before, reason: 'pattern matched nothing — bytes are identical' }
  }
  if (expect !== undefined && !after.includes(expect)) {
    return {
      ok: false,
      before,
      reason: `the file changed but does not contain the expected text ${JSON.stringify(expect)} — ` +
        'the pattern probably matched somewhere unintended',
    }
  }
  // The counterpart, for deletions: `expect` cannot describe "this line is gone"
  // without pinning the surrounding whitespace, which is how M5's check broke.
  if (absent !== undefined && after.includes(absent)) {
    return { ok: false, before, reason: `${JSON.stringify(absent)} is still present — the deletion did not take` }
  }

  await writeFile(file, after)
  return { ok: true, before, after, reason: `${sha(before)} → ${sha(after)}` }
}

/** Run a test file set, resolving to `{ pass, fail, crashed }`. */
export function runTests(files) {
  return new Promise((resolve) => {
    // TAP, not the default reporter: the summary lines are a documented format
    // (`# pass 12`) rather than pretty output that changes between Node
    // versions. A counts regex that silently stops matching is exactly the
    // class of defect this module exists to prevent.
    // A mutant that leaves a real timer or rAF loop running past a test whose
    // assertion threw (cleanup skipped, since node:test does not run a
    // finally block the test itself didn't write) would otherwise hang this
    // process forever — node:test never force-exits on its own. The timeout
    // turns that into a `crashed` result instead of a stuck run.
    const p = spawn(process.execPath, ['--test', '--test-timeout=10000', '--test-reporter=tap', ...files], { encoding: 'utf8' })
    let out = ''
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { out += d })
    p.on('close', (code) => {
      const num = (k) => Number(out.match(new RegExp(`^# ${k} (\\d+)$`, 'm'))?.[1] ?? NaN)
      const pass = num('pass')
      const fail = num('fail')
      // A suite that crashes on import reports no counts at all. That must not
      // read as a kill: the mutation broke the *loader*, not a guard, and any
      // assertion in the file would have "failed" for free.
      const crashed = Number.isNaN(pass) || Number.isNaN(fail)
      resolve({ pass, fail, crashed, code, out })
    })
  })
}

/** `npm run build`, as a promise. Mutations edit `src/`; tests read `dist/`. */
export function build() {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'pipe' })
    let out = ''
    p.stdout.on('data', (d) => { out += d })
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`tsc failed:\n${out}`))))
  })
}

/**
 * Run one mutation end to end and always restore the file.
 *
 * `m` is `{ id, file, tests, expect, note, mutate }`. Mutations are applied to
 * `src/` and compiled, rather than patched into `dist/`: the compiler is then
 * the thing confirming the mutation is real code, and a pattern written against
 * generated output cannot rot when `tsc` changes how it emits.
 */
export async function runMutation(m) {
  const applied = await applyMutation(m.file, m.mutate, m.expect, m.absent)
  if (!applied.ok) return { ...m, status: 'not-applied', detail: applied.reason }
  try {
    if (m.file.includes('/src/')) {
      try {
        await build()
      } catch (e) {
        return { ...m, status: 'not-applied', detail: `the mutant does not compile: ${e.message.split('\n')[1] ?? ''}` }
      }
    }
    const r = await runTests(m.tests)
    if (r.crashed) {
      return { ...m, status: 'crashed', detail: 'the suite did not run to completion — see output', out: r.out }
    }
    return {
      ...m,
      status: r.fail > 0 ? 'killed' : 'survived',
      detail: `${r.pass} pass, ${r.fail} fail  (${applied.reason})`,
      out: r.out,
    }
  } finally {
    await writeFile(m.file, applied.before)
    if (m.file.includes('/src/')) await build().catch(() => {})
  }
}

/** Convenience builders, so a mutation spec reads as what it does. */
export const replace = (find, into) => (text) =>
  typeof find === 'string' ? text.split(find).join(into) : text.replace(find, into)

/** Insert `code` immediately after the first match of `find`. */
export const after = (find, code) => (text) => text.replace(find, (m) => m + code)

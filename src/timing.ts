/**
 * Timing & spacing — the animation-principles layer.
 *
 * Every action the rig plays is described as a list of key {@link Pose}s. This
 * module compiles that into a CSS `@keyframes` rule and, in the process, adds
 * the two principles a raw pose list is missing:
 *
 *   1. **Anticipation** — a brief counter-move + load-up squash before the
 *      action, derived from the action's own peak pose (lean back before you
 *      lunge, crouch before you jump).
 *   2. **Squash & stretch on the settle** — an impact squash, a rebound
 *      stretch, a diminishing counter, then rest.
 *
 * Both are *derived*, not authored, so a new gesture gets them for free: it
 * only declares what it does, never how it loads up or lands.
 */

/** One key pose. All channels optional; omitted channels are identity. */
export interface Pose {
  /** translate X, art units */
  x?: number
  /** translate Y, art units (negative = up) */
  y?: number
  /** in-plane rotation, degrees */
  rot?: number
  /** out-of-plane spin, degrees (a `rotateY` flip) */
  rotY?: number
  /** horizontal scale, 1 = identity */
  sx?: number
  /** vertical scale, 1 = identity */
  sy?: number
}

/** An action described as key poses plus how hard to load up and land. */
export interface TimedAction {
  /** total duration in seconds, including anticipation and settle */
  dur: number
  /** the action's key poses, spread evenly across the action window */
  poses: Pose[]
  /** anticipation strength 0..1 (0 disables it), default 0.8 */
  anticipation?: number
  /** settle/overshoot strength 0..1 (0 disables it), default 0.8 */
  settle?: number
  /** fraction of `dur` spent anticipating, default 0.18 */
  antTime?: number
  /** fraction of `dur` spent settling, default 0.26 */
  settleTime?: number
  /** CSS timing function for the whole rule, default `ease-in-out` */
  ease?: string
}

const round = (n: number): number => Math.round(n * 1000) / 1000

/** Serialise a pose to a CSS `transform` value. */
export function poseToTransform(p: Pose): string {
  const { x = 0, y = 0, rot = 0, rotY = 0, sx = 1, sy = 1 } = p
  const parts: string[] = []
  if (x || y) parts.push(`translate(${round(x)}px,${round(y)}px)`)
  if (rot) parts.push(`rotate(${round(rot)}deg)`)
  if (rotY) parts.push(`rotateY(${round(rotY)}deg)`)
  if (sx !== 1 || sy !== 1) parts.push(`scale(${round(sx)},${round(sy)})`)
  return parts.length > 0 ? parts.join(' ') : 'none'
}

/**
 * Combine contributions from independent sources onto one element: offsets and
 * angles add, scales multiply. Without this, posture and idle breathing both
 * want `lyr-torso`'s `transform` and the last writer silently wins.
 */
export function composePoses(poses: Iterable<Pose>): Pose {
  const out: Required<Pose> = { x: 0, y: 0, rot: 0, rotY: 0, sx: 1, sy: 1 }
  for (const p of poses) {
    out.x += p.x ?? 0
    out.y += p.y ?? 0
    out.rot += p.rot ?? 0
    out.rotY += p.rotY ?? 0
    out.sx *= p.sx ?? 1
    out.sy *= p.sy ?? 1
  }
  return out
}

/** Weighted magnitude — how "big" a pose is, so we can find the action's peak. */
function magnitude(p: Pose): number {
  return (
    Math.abs(p.x ?? 0) +
    Math.abs(p.y ?? 0) +
    Math.abs(p.rot ?? 0) * 0.6 +
    Math.abs(p.rotY ?? 0) * 0.25 +
    Math.abs((p.sx ?? 1) - 1) * 40 +
    Math.abs((p.sy ?? 1) - 1) * 40
  )
}

/** The most extreme pose in the action — what the anticipation loads against. */
function peakOf(poses: Pose[]): Pose {
  let best = poses[0] ?? {}
  let bestMag = -1
  for (const p of poses) {
    const m = magnitude(p)
    if (m > bestMag) {
      bestMag = m
      best = p
    }
  }
  return best
}

/** Counter-move, capped so a 360° spin doesn't wind up a full half-turn. */
function counter(v: number, ratio: number, cap: number, k: number): number {
  const c = Math.min(Math.abs(v) * ratio, cap) * k
  return v > 0 ? -c : v < 0 ? c : 0
}

/**
 * Derive the anticipation pose from the action's peak: move against it, and
 * always load downward with a squash — anticipation is a wind-up, so it
 * compresses regardless of which way the action goes.
 */
function anticipationPose(peak: Pose, k: number): Pose {
  const up = Math.max(0, -(peak.y ?? 0))
  return {
    x: counter(peak.x ?? 0, 0.16, 6, k),
    y: (up * 0.14 + 2.4) * k,
    rot: counter(peak.rot ?? 0, 0.18, 10, k),
    rotY: counter(peak.rotY ?? 0, 0.1, 12, k),
    sx: 1 + 0.1 * k,
    sy: 1 - 0.13 * k,
  }
}

/**
 * The landing: impact squash → rebound stretch → diminishing counter → rest.
 * Returned as `[localT 0..1, pose]` within the settle window.
 */
function settleBeats(k: number): Array<[number, Pose]> {
  return [
    [0, { y: 2 * k, sx: 1 + 0.13 * k, sy: 1 - 0.16 * k }],
    [0.42, { y: -1.6 * k, sx: 1 - 0.07 * k, sy: 1 + 0.09 * k }],
    [0.74, { sx: 1 + 0.03 * k, sy: 1 - 0.04 * k }],
    [1, {}],
  ]
}

/**
 * Compile a {@link TimedAction} into a `@keyframes` rule body plus the
 * `animation` shorthand that plays it once.
 */
export function buildAction(name: string, a: TimedAction): { css: string; animation: string } {
  const ant = Math.max(0, Math.min(1, a.anticipation ?? 0.8))
  const set = Math.max(0, Math.min(1, a.settle ?? 0.8))
  const antT = ant > 0 ? (a.antTime ?? 0.18) : 0
  const setT = set > 0 ? (a.settleTime ?? 0.26) : 0
  const actStart = antT
  const actEnd = 1 - setT

  const stops = new Map<number, Pose>()
  stops.set(0, {})
  if (ant > 0) stops.set(antT, anticipationPose(peakOf(a.poses), ant))

  const n = a.poses.length
  a.poses.forEach((p, i) => {
    // Strictly inside (actStart, actEnd): headroom at both ends so no pose
    // lands on — and silently replaces — the anticipation stop or the settle's
    // first beat. Every authored pose survives compilation.
    const t = n === 0 ? actEnd : actStart + (actEnd - actStart) * ((i + 1) / (n + 1))
    stops.set(t, p)
  })

  if (set > 0) {
    for (const [local, pose] of settleBeats(set)) stops.set(actEnd + setT * local, pose)
  }
  stops.set(1, stops.get(1) ?? {})

  const body = [...stops.entries()]
    .sort((l, r) => l[0] - r[0])
    .map(([t, p]) => `${round(t * 100)}%{transform:${poseToTransform(p)}}`)
    .join('')

  return {
    css: `@keyframes ${name}{${body}}`,
    animation: `${name} ${round(a.dur)}s ${a.ease ?? 'ease-in-out'} 1`,
  }
}

/**
 * Compile-and-inject, memoised by rule name. Actions are static per gesture, so
 * the first play pays the cost and every later one is a class-free
 * `style.animation` assignment.
 */
const injected = new Map<string, string>()
export function ensureAction(doc: Document, name: string, a: TimedAction): string {
  const cached = injected.get(name)
  if (cached !== undefined) return cached
  const { css, animation } = buildAction(name, a)
  const style = doc.createElement('style')
  style.setAttribute('data-pixel-wizards-action', name)
  style.textContent = css
  doc.head.appendChild(style)
  injected.set(name, animation)
  return animation
}

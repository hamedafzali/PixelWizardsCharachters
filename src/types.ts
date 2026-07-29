/**
* PixelWizardsCharachters — core types.
 *
 * A character is a puppet. An {@link ActorFrame} is one moment of performance:
 * a connected AI emits a stream of frames while a story plays, and the rig
 * performs them. Every visible behaviour is one field on the frame — nothing
 * is hidden in call sites, so the whole performance is data.
 */

// Type-only, so it is erased at compile time and creates no module cycle.
import type { GaitName } from './locomotion.js'

export type EmotionName =
  | 'neutral' | 'happy' | 'excited' | 'thinking'
  | 'encouraging' | 'sad' | 'surprised' | 'sleepy' | 'love'
  | 'confused' | 'proud' | 'shy'

/** Persian viseme groups (phoneme families that share a mouth shape). */
export type VisemeName =
  | 'rest' | 'aa' | 'e' | 'i' | 'o' | 'u'
  | 'mbp' | 'f' | 'sh' | 's' | 'l'

export type Locomotion = 'idle' | 'walk' | 'fly'
export type Gesture =
  | 'wave' | 'jump' | 'spin'
  | 'nod' | 'shake' | 'shrug' | 'point' | 'clap' | 'bounce'
export type Facing = 'left' | 'right'

/** One moment of performance. This is the AI ⇄ rig contract. */
export interface ActorFrame {
  /** character slug, e.g. "roozi" */
  character: string
  emotion: EmotionName
  /** emotion strength, 0..1 — scales brows, squint, widen and body tempo */
  intensity: number
  /** current viseme; `rest` when not speaking */
  viseme: VisemeName
  /** explicit mouth openness 0..1; when > 0 it overrides the viseme's openness */
  mouthOpen: number
  /** where the eyes look, each axis -1..1 (0,0 = at the child) */
  gaze: { x: number; y: number }
  /** independent brow raise, 0..1 */
  browRaise: number
  locomotion: Locomotion
  /** motion tempo multiplier, ~0.5..2 */
  speed: number
  facing: Facing
  /** one-shot action; null when none is playing */
  gesture: Gesture | null
}

export function defaultFrame(character: string): ActorFrame {
  return {
    character,
    emotion: 'neutral',
    intensity: 0.7,
    viseme: 'rest',
    mouthOpen: 0,
    gaze: { x: 0, y: 0 },
    browRaise: 0,
    locomotion: 'idle',
    speed: 1,
    facing: 'right',
    gesture: null,
  }
}

/** Brow shape key — a small vocabulary of eyebrow poses. */
export type BrowKey =
  | 'idle' | 'happy' | 'excited' | 'thinking'
  | 'encouraging' | 'sad' | 'surprised' | 'sleepy'
  | 'confused' | 'proud' | 'shy'

export interface EmotionSpec {
  /** lower-lid rise, 0..1 (a happy/sleepy squint) */
  squint: number
  /** eye widen, 0..1 (surprise/excite) */
  wide: number
  /**
   * Resting mouth when not speaking.
   *
   * **Currently unread.** `drawMouth` is driven entirely by the frame's
   * `viseme` and `mouthOpen`; nothing consults this field, so setting it has no
   * visible effect today. It is kept because the resting shape is a real part
   * of an emotion's design and the presets already describe it — but do not
   * assume a value here has been seen on screen, and do not tune it expecting
   * one. Wiring it would change the resting face of nine shipped emotions
   * (`sad` currently rests on a gentle smile), which is a deliberate decision
   * that has not been taken.
   */
  mouth: 'soft' | 'big' | 'frown' | 'o'
  brow: BrowKey
  /**
   * Where the emotion *itself* points the eyes, each axis -1..1, **added** to
   * the frame's `gaze` rather than replacing it.
   *
   * This is the difference between looking away and being told to look away.
   * شرمگین looks down and off; مغرور lifts the chin and looks slightly past you;
   * گیج looks up and to one side, which is the single most legible cue for
   * "working something out". A driver that says nothing about gaze still gets
   * the right eyes, and one that sets `gaze` explicitly still wins on top.
   *
   * Kept small — beyond about 0.4 the iris hits the sclera edge and the eye
   * reads as pointing at nothing.
   */
  gaze?: { x: number; y: number }
}

/**
 * Per-emotion tuning: override any channel of any emotion preset. A partial
 * spec merges onto the built-in {@link EmotionSpec}, so an editor can save just
 * the fields it changed. Consumed by the rig / renderer / React binding.
 */
export type EmotionOverrides = Partial<Record<EmotionName, Partial<EmotionSpec>>>

export interface VisemeSpec {
  /** openness 0..1 */
  o: number
  /** width multiplier */
  w?: number
  /** roundness (>1 narrows and rounds, e.g. او) */
  r?: number
  /** fully closed (م/ب/پ) */
  closed?: boolean
  /** lower-lip tuck (ف) */
  tuck?: boolean
  /** show tongue (ل/ن/ت/د/ر) */
  tongue?: boolean
  /** human-readable label */
  label: string
}

/**
 * Rig layers, in paint order (back to front). A character supplies art for the
 * layers it has; missing layers are simply not emitted, so a character with no
 * arms yet costs nothing. `near` is the side toward the viewer at the default
 * `facing: 'right'` — the facing flip mirrors the whole tree, so near/far stay
 * correct without per-character work.
 *
 * ## Authoring rules
 *
 * **A layer exists only if the character really has that joint.** Posture and
 * the gait tables send the *same* numbers to every character — `headDrop: 5`,
 * `ears: 34` — so the pivot is what decides whether those numbers read as a nod
 * or a bow. Inventing a pivot for a joint the drawing does not have makes the
 * same posture mean something different on every character, and posture stops
 * being portable.
 *
 * In particular, for `head`, the operative question is: **is there a determinate
 * line where the head meets the body?** A drawn neck is the obvious yes. A
 * collar, a hairline or a jaw sitting on a distinct body form is also a yes —
 * the pivot is *measured off the drawing* rather than invented, which is the
 * whole point of the rule. If the character is one continuous form from base to
 * crown, the answer is no and there is **no `head` layer**: an owl, a blob or a
 * ball draws its face straight onto `torso`, and `headTilt`/`headDrop` then land
 * on nothing — exactly as `tail` droop already does for a character with no
 * tail. That is the correct outcome, not a gap to paper over. (Ears hang off the
 * torso in that case; see `buildLayers`.)
 *
 * The failure this rules out is a pivot chosen because the layer list wanted
 * one. `boomi` has no such line and so has no `head`; `ava` has no neck but a
 * definite collar at y≈140, so she does.
 *
 * `torsoFront` is the escape hatch for the opposite case: a head that belongs
 * *behind* the body. It is torso art that paints after the head — a shell rim, a
 * collar, a scarf — and it is nested inside `torso`, so it leans with the spine.
 * لاکی's shell lives there. Note what it costs: once the head tucks under
 * something, `headDrop` is bounded on both sides (too much buries the mouth,
 * too little detaches the head), so a character using it wants that window
 * measured and tested rather than guessed.
 *
 * The same test applies to every other layer: no tail, no `tail`; wings map to
 * `farArm`/`nearArm` because that is the joint the rig swings, but only if they
 * actually swing.
 */
export type LayerName =
  | 'shadow'
  | 'accBack'
  | 'tail'
  | 'farArm'
  | 'farLeg'
  | 'torso'
  | 'nearLeg'
  | 'nearArm'
  | 'earL'
  | 'earR'
  | 'head'
  | 'torsoFront'
  | 'accFront'

/**
 * Paint order for {@link LayerName}.
 *
 * Flat order only — it does not express the *nesting* (`head` inside `torso`,
 * ears inside `head`), which `buildLayers` owns. The two are checked against
 * each other by test rather than derived, because the nesting is what makes
 * transforms compound and a flat list cannot say it.
 */
export const LAYER_ORDER: LayerName[] = [
  'shadow', 'accBack', 'tail', 'farArm', 'farLeg', 'torso',
  'nearLeg', 'nearArm', 'earL', 'earR', 'head', 'torsoFront', 'accFront',
]

/** One layer: its markup plus the pivot every transform on it turns around. */
export interface RigLayer {
  art: string
  /** transform origin in the 200×200 art space; `shadow` may omit it */
  origin?: [number, number]
}

export type RigLayers = Partial<Record<LayerName, RigLayer>>

/**
 * Secondary silhouette cues — the body-shape half of an emotion.
 *
 * Brows and mouth carry the face; this carries the pose, so `sad` (slumped
 * forward, ears down, tail down) and `sleepy` (sunk, head lolled to one side,
 * ears half-down) read differently at thumbnail size where no face is legible.
 *
 * Deliberately *not* on {@link ActorFrame}: a puppeteer says "be sad", it does
 * not say "droop the ears 22 degrees". This is a per-character visual-design
 * concern, so it lives on the character config and is scaled by the frame's
 * existing `intensity`.
 *
 * All values are at intensity 1 and default to 0 (upright, neutral).
 */
export interface PostureSpec {
  /** torso lean at the hips, degrees; + = slumped forward */
  spine?: number
  /** whole-body sink at the knees, art units; + = lower */
  sink?: number
  /** head tilt, degrees; + = toward the near side */
  headTilt?: number
  /** head drop at the neck, art units; + = chin down */
  headDrop?: number
  /** ear / antenna / tuft angle, degrees; + = droop, − = perk (mirrored per side) */
  ears?: number
  /** tail angle, degrees; + = down, − = up */
  tail?: number
  /** arm hang, degrees; + = drawn in and down */
  arms?: number
}

/** Per-emotion posture. Sparse — unlisted emotions use the neutral pose. */
export type PostureMap = Partial<Record<EmotionName, PostureSpec>>

/** Static description of a character's art + rig anchors. */
export interface CharacterSpec {
  slug: string
  name: string
  role?: string
  /** eye rig anchors — used by blink and gaze */
  eyes: { x: [number, number]; y: number; r: number }
  /** eyelid / blink colour (matches the face) */
  lidColor: string
  /** eyebrow stroke colour */
  browColor: string
  /**
   * Per-emotion silhouette cues. Optional: a character without it still poses
   * its face, it just holds one body shape.
   */
  posture?: PostureMap
  /**
   * Gaits this character may be **phase-driven** through, as an explicit
   * opt-in.
   *
   * Structural capability is not intent. `canDrive` only asks whether the
   * required layers exist, so لاکی — whose back flippers map onto the arm
   * slots, correctly, for its walk — reads as structurally able to fly. Nothing
   * in the geometry can tell a wing from a flipper, so eligibility is declared
   * rather than inferred.
   *
   * Omitted or empty means **no gait is phase-driven** and every gait takes the
   * CSS fallback. That default is deliberate: a new character opts in once its
   * limbs are known to swing the way a gait assumes, instead of inheriting a
   * wingbeat the moment it happens to grow two arms.
   */
  gaits?: readonly GaitName[]
  /**
   * Gestures this character must perform with its **whole body** rather than
   * with the limb the gesture names.
   *
   * The structural fallback already covers "no such limb". This covers the
   * other case: the limb exists, but the character's art bounds how far it may
   * travel, and the gesture asks for more. لاکی's head tucks behind its shell,
   * so a 6.5-unit nod drops the mouth under the rim — the same wall its posture
   * window is measured against, arriving through a gesture instead.
   *
   * Declared rather than inferred, for the reason {@link CharacterSpec.gaits}
   * is: nothing in the geometry distinguishes "this limb cannot travel that far"
   * from "this limb is drawn small". The alternative — scaling every gesture
   * down until it fits the most constrained character on the roster — makes one
   * character's shell everybody's problem.
   */
  gestureFallback?: readonly Gesture[]
  /**
   * Produce the SVG fragments for a given emotion pose. `art` must expose the
   * rig hooks: `.iris[data-r]` groups, one `.browsG` group, and `#mouthG`.
   *
   * Returning `layers` opts the character into the articulated rig; the rig
   * then drives limbs by rotating groups instead of re-rendering. `art` stays
   * the fallback for characters not yet converted, so the two coexist.
   */
  render(ctx: { emotion: EmotionSpec; intensity: number }): {
    grads: string
    art: string
    layers?: RigLayers
    mouth: { cx: number; cy: number; color: string; beak?: boolean }
  }
}

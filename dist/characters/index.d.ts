import type { CharacterSpec } from '../types.js';
/**
 * The character roster. Each spec renders illustration-grade "premium flat"
 * art — form gradients + a core-shadow overlay for volume, rim light, sculpted
 * eyes, blush and secondary detail — and exposes the rig hooks
 * (`.iris`, `.browsG`, `#mouthG`). Core-shadow gradient ids are namespaced per
 * character so multiple characters can share one document.
 */
/**
 * روزی — the reference implementation of the articulated rig. Its art is split
 * into {@link RigLayers} with a pivot per layer, so the rig rotates limbs
 * instead of re-rendering them. The remaining roster still returns flat `art`
 * and keeps working unchanged; see the layer table in the README.
 *
 * A fox has no arms in the original drawing, so the arm layers are newly drawn
 * here rather than extracted — that is the real cost of articulation, and it is
 * per character.
 */
export declare const roozi: CharacterSpec;
/**
 * آوا — a girl: head, hair and a dress. Converted third, after روزی and بومی.
 *
 * Structurally she breaks from both:
 *
 * - **No legs.** They are under the dress, and a walking girl in a long dress
 *   is drawn with a swinging hem, not with visible feet. `walk` therefore
 *   cannot be phase-driven for her and correctly falls back to the CSS body
 *   animation — the first converted character to use that path.
 * - **Arms are newly drawn**, like روزی's. The far arm paints behind the dress
 *   and the near arm in front, which the layer paint order already handles.
 * - **She keeps a head layer.** Her neck is hidden by hair, but head and dress
 *   are two distinct forms meeting on a determinate line at y≈140, so the pivot
 *   is measured, not invented. That is the distinction the authoring rule is
 *   drawing; see the note on {@link RigLayers}.
 * - **No ears, no tail.** The shared presets still compute `ears` and `tail`
 *   droop; both land on nothing.
 */
export declare const ava: CharacterSpec;
/**
 * پشمک — a two-lobe fluffball: a head sphere sitting on a body sphere, with ear
 * tufts and a curl of tail. What it breaks:
 *
 * - **No arms and no legs.** The side strokes are whiskers, not limbs, and the
 *   body meets the ground directly. So *neither* gait can be phase-driven and
 *   pashmak is the first character on the CSS fallback path for both walk and
 *   fly — ava only exercised the walk half of that branch.
 * - **The head/body line is a silhouette notch, not an edge.** The two lobes
 *   overlap and their gradients are near neighbours, so nothing is *drawn* at
 *   the joint. It is still measured, not invented: the lobe boundaries cross at
 *   y≈113.5, which is where the outline visibly pinches. See the authoring rule.
 * - **Ears and tail both exist**, so unlike boomi and ava the shared posture
 *   preset reaches every channel it has except `arms`.
 */
export declare const pashmak: CharacterSpec;
/**
 * لاکی — a turtle, and the first character whose head belongs *behind* its body.
 * What it breaks:
 *
 * - **Head under the shell.** The rim at y≈78 is the hardest joint on the
 *   roster — a real edge with a real colour change — so the pivot is not in
 *   doubt. But the head was drawn *over* the shell, so rotating about that rim
 *   slid the disc across the shell face instead of craning out from under it.
 *   The shell therefore lives in `torsoFront`, which paints after the head.
 * - **Four legs into two leg slots.** The front flippers map to
 *   `nearLeg`/`farLeg` and the back flippers to `nearArm`/`farArm`. That is not
 *   a fudge: the walk table swings each arm opposite the leg on its own side,
 *   which is exactly the diagonal a quadruped trots on.
 * - **Consequently it is `fly`-drivable**, structurally, because it has
 *   "arms". Nothing should ever ask a turtle to fly — see the note in the port
 *   report about `canDrive` being structural rather than intentional.
 */
export declare const laki: CharacterSpec;
/**
 * تندپا — the fifth character on the articulated rig. What it adds to the
 * roster:
 *
 * - **A determinate seam with no visible line.** The head circle crosses the
 *   body ellipse at y≈121.1 (±21.1 wide, an 11-unit-deep overlap lens), so the
 *   pivot is measured, not argued. But both forms carry the *same* `tpB` fill,
 *   so the seam is invisible at rest and an ordering or range error would not
 *   show up by eye — only as a gap opening at a posture extreme. Hence the
 *   swept guard below rather than a rest-pose check.
 * - **Feet, not legs.** The two pads at (80,178) and (120,178) are the only
 *   leg art: flat ovals half-tucked under the body with no drawn leg and no
 *   hip anywhere to measure. A pivot at the pad's own attachment gives a
 *   3-unit wobble, not a stride; a pivot deep inside the body mass would be
 *   invented, which is exactly what the authoring rule forbids. So there is no
 *   `farLeg`/`nearLeg`, and `walk` falls back — permanently, like آوا's legs
 *   under her dress. The name is an irony the drawing does not support.
 * - **Nothing arm-shaped at all**, so unlike لاکی there is no `fly` leak to
 *   withhold; `canDrive('fly')` is already structurally false.
 * - **Ears that are most of the silhouette.** They get the largest droop on the
 *   roster, and they pivot at their base *inside* the head disc, so the base
 *   stays hidden however far the tip swings.
 */
export declare const tondpa: CharacterSpec;
/**
 * بومی — the second character on the articulated rig, chosen because it breaks
 * roozi's assumptions rather than confirming them:
 *
 * - **No head/torso split, and so no `head` layer at all.** An owl's head *is*
 *   its body: one barrel from talons to tufts, with no line anywhere that the
 *   head could be said to pivot about. The facial mass (discs, eyes, brows,
 *   beak) is drawn straight onto `lyr-torso`, and posture's `headDrop`/
 *   `headTilt` land on nothing — the same dead end as `tail` droop here. The
 *   nod boomi does have is a whole-body lean, which is what an owl does.
 * - **No tail.** The `tail` layer is simply absent, and the shared posture
 *   preset's tail channel lands on nothing.
 * - **Wings, not arms.** They map onto `farArm`/`nearArm` because that is what
 *   the rig drives. The legacy `.wingL`/`.wingR` wrappers are *dropped* here:
 *   nesting them inside a layer made both `.loco-fly .wingL` and
 *   `.loco-fly .lyr-farArm` match, flapping the wing twice about two different
 *   pivots. Converting a character migrates it to the layer classes; the
 *   unconverted fliers (simorgh) keep the old hooks and the old rules.
 * - **Eyes are r=15, the roster's largest**, with facial discs behind them that
 *   deliberately do *not* scale with the widen transform (see below).
 */
export declare const boomi: CharacterSpec;
/**
 * خرسی — the last character onto the articulated rig, and the first whose seam
 * is genuinely *visible*:
 *
 * - **A seam you can see.** The head is `khHh` and the body is `khB` — two
 *   different gradients, unlike تندپا and پشمک where head and body share one
 *   fill and only the silhouette carries the join. The crossing is at y≈120.65
 *   (±25.5 wide, a 15-unit-deep lens), so an ordering error or an over-wide
 *   `headDrop` would show as a visible tonal edge in the wrong place rather
 *   than as nothing at all. That makes خرسی the roster's canary for the head
 *   layer: it is the one character where the eye is a real check.
 * - **Ear pivots measured off two-circle geometry.** Each ear disc is centred
 *   *outside* the head (49.52 from the head centre, r 43), so there is no
 *   "attach at the ear's base" point to read off. The pivot is the midpoint of
 *   the head/ear intersection chord — [72.43, 56.81] and [127.57, 56.81] — which
 *   is measured, not chosen, and is where the ear visually emerges from the
 *   skull.
 * - **Feet, not legs; and no arms at all.** The pads at (78,178) and (122,178)
 *   are the same case as تندپا's: flat ovals in the body's own `khB`, no drawn
 *   leg, no hip to measure. There is no arm art anywhere. So neither gait is
 *   drivable and neither is declared.
 */
export declare const khersi: CharacterSpec;
export declare const simorgh: CharacterSpec;
/**
 * چرخی — the roster's first vehicle, and its first character with no `head`,
 * no `farLeg`/`nearLeg`, and no `farArm`/`nearArm` at all.
 *
 * - **No head layer, for a mechanical reason instead of a biological one.**
 *   The body is one continuous moulded form, bumper to roof, with no
 *   determinate line anywhere that could be called where a "head" would meet
 *   a "body" — the same conclusion as بومی, arrived at from a car's shape
 *   rather than an owl's. The face sits straight on `torso`.
 * - **No leg layers.** The wheels are structurally the right count and
 *   position to tempt a `farLeg`/`nearLeg` mapping, but `walk`'s ±20°
 *   oscillating swing table is the wrong motion for something that should
 *   spin continuously about a fixed axle — the same "structurally capable,
 *   semantically wrong" trap `gaits` exists to block (لاکی's flippers-in-arm-
 *   slots is the precedent). So the wheels are static art baked into `torso`,
 *   not a layer: nothing about them independently rotates relative to the
 *   body in this version, and a layer for a joint that does not move is the
 *   thing the head/torso rule already forbids, applied to a limb instead.
 * - **`earL`/`earR` reused for twin roof antennas**, not side mirrors — a
 *   folded-in mirror does not read as broken (real mirrors fold), so it is a
 *   bad stand-in for the ears/pigtails "did this come loose" check. An
 *   antenna is a clean structural match: `ears` is documented on
 *   `PostureSpec` as "ear / antenna / tuft angle", and this is that case.
 * - **Pivots measured off بومی's headless convention, not آوا's/خرسی's.**
 *   Each antenna's `origin` is the literal on-curve vertex where the roofline
 *   path already ends: `[58, 80]` is the endpoint of the body path's left
 *   roof-shoulder cubic, `[142, 80]` the mirror point on the right — read
 *   directly off the drawn body, the same way بومی's tuft origins are read
 *   off its head-triangle paths. The chord-midpoint technique آوا/خرسی use is
 *   specifically for a feature whose own centre sits *outside* the parent
 *   silhouette with no drawn base to read a pivot from; an antenna's base
 *   root is drawn exactly on the roofline, so that case does not apply here.
 * - **A new collision class: clipping in, not pulling out.** Because the
 *   antenna's root is pinned to the roofline vertex it rotates about, it
 *   cannot pull free of the body by construction — the same reason بومی's
 *   tufts carry no penetration guard in the test suite. What *can* happen at
 *   extreme droop is the opposite: the stalk swings back down far enough that
 *   its tip crosses under the roofline it grows from. `charkhiAntennaClip` in
 *   `tools/lib/probes.mjs` measures this against the real roof cubics (the
 *   same technique `lakiRimY` uses for لاکی's shell rim), swept across every
 *   emotion at every intensity; the measured worst case is recorded in
 *   `tools/baselines/geometry.json` rather than guessed.
 */
export declare const charkhi: CharacterSpec;
/** The built-in roster, keyed by slug. */
export declare const CHARACTERS: Record<string, CharacterSpec>;
/** `CHARACTERS`' own keys, so the roster list can never drift from the registry it lists. */
export declare const CHARACTER_SLUGS: string[];
//# sourceMappingURL=index.d.ts.map
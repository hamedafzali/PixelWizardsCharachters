import { eyes, brows } from '../draw.js'
import type { CharacterSpec } from '../types.js'

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
export const roozi: CharacterSpec = {
  slug: 'roozi', name: 'روزی', role: 'واژه‌ها',
  eyes: { x: [83, 117], y: 74, r: 11 }, lidColor: '#f7902f', browColor: '#8a3a12',
  // A fox runs. The forelegs sit in the arm slots and would satisfy the
  // wingbeat's structural check, so `fly` is withheld here rather than by
  // geometry.
  gaits: ['walk'],
  // A fox is mostly ears and tail — give both more travel than the shared preset.
  posture: {
    sad: { ears: 34, tail: 42 },
    sleepy: { ears: 20, tail: 20 },
    excited: { ears: -22, tail: -34 },
    happy: { ears: -12, tail: -22 },
  },
  render({ emotion, intensity }) {
    const e = eyes(83, 117, 74, 11, 'fxIris', emotion.squint * intensity, emotion.wide * intensity)
    const b = brows(83, 117, 58, emotion.brow, '#8a3a12')
    return {
      grads: `
      <radialGradient id="fxH" cx="40%" cy="26%" r="80%"><stop offset="0" stop-color="#ffe0bd"/><stop offset=".5" stop-color="#fb9a3e"/><stop offset="1" stop-color="#e26a12"/></radialGradient>
      <radialGradient id="fxB" cx="42%" cy="28%" r="82%"><stop offset="0" stop-color="#ffcb8f"/><stop offset=".55" stop-color="#f7902f"/><stop offset="1" stop-color="#cf5f0e"/></radialGradient>
      <linearGradient id="fxC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset="1" stop-color="#ffe7c9"/></linearGradient>
      <radialGradient id="fxE" cx="50%" cy="24%" r="82%"><stop offset="0" stop-color="#b4460f"/><stop offset="1" stop-color="#732709"/></radialGradient>
      <radialGradient id="fxT" cx="68%" cy="28%" r="82%"><stop offset="0" stop-color="#ffcb8f"/><stop offset="1" stop-color="#e26a12"/></radialGradient>
      <radialGradient id="fxIris" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="#8a5a34"/><stop offset=".6" stop-color="#5a3418"/><stop offset="1" stop-color="#2a1608"/></radialGradient>
      <radialGradient id="coS" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#7a2e00" stop-opacity=".2"/></radialGradient>`,
      art: '',
      layers: {
        shadow: {
          art: `<ellipse cx="100" cy="188" rx="52" ry="8" fill="#000" opacity=".10"/>`,
        },
        tail: {
          origin: [146, 146],
          art:
            `<path d="M150 150c30-4 40-32 32-54-16 18-26 22-46 32z" fill="url(#fxT)"/>` +
            `<path d="M172 108c-6 14-16 22-30 25l9 15c16-6 24-22 21-40z" fill="url(#fxC)" opacity=".92"/>`,
        },
        // Newly drawn: the original fox had no arms. Flat darker fill on the far
        // side reads as depth without a second gradient.
        farArm: {
          origin: [62, 126],
          art:
            `<path d="M62 126 q-10 14 -12 28" stroke="#cf5f0e" stroke-width="13" stroke-linecap="round" fill="none"/>` +
            `<ellipse cx="50" cy="156" rx="7.5" ry="6" fill="#e9b27a"/>`,
        },
        farLeg: {
          origin: [84, 160],
          art: `<ellipse cx="80" cy="172" rx="12" ry="8" fill="#cf5f0e"/>`,
        },
        torso: {
          origin: [100, 168],
          art:
            `<ellipse cx="100" cy="138" rx="44" ry="38" fill="url(#fxB)"/>` +
            `<ellipse cx="100" cy="150" rx="27" ry="22" fill="url(#fxC)"/>` +
            `<ellipse cx="100" cy="150" rx="44" ry="38" fill="url(#coS)"/>`,
        },
        nearLeg: {
          origin: [116, 160],
          art: `<ellipse cx="120" cy="172" rx="12" ry="8" fill="url(#fxB)"/>`,
        },
        nearArm: {
          origin: [138, 126],
          art:
            `<path d="M138 126 q10 14 12 28" stroke="url(#fxB)" stroke-width="13" stroke-linecap="round" fill="none"/>` +
            `<ellipse cx="150" cy="156" rx="7.5" ry="6" fill="url(#fxC)"/>`,
        },
        earL: {
          origin: [76, 50],
          art:
            `<path d="M62 56 L54 14 L92 40 Z" fill="url(#fxE)"/>` +
            `<path d="M66 48 L62 24 L86 42 Z" fill="#9a3a10"/>`,
        },
        earR: {
          origin: [124, 50],
          art:
            `<path d="M138 56 L146 14 L108 40 Z" fill="url(#fxE)"/>` +
            `<path d="M134 48 L138 24 L114 42 Z" fill="#9a3a10"/>`,
        },
        head: {
          origin: [100, 112],
          art: `<circle cx="100" cy="78" r="42" fill="url(#fxH)"/>
      <path d="M60 76 q-10 6 -8 18 q8 -10 16 -12z" fill="url(#fxH)"/><path d="M140 76 q10 6 8 18 q-8 -10 -16 -12z" fill="url(#fxH)"/>
      <path d="M64 66 q-8 3 -9 13 q7 -7 13 -8z" fill="url(#fxC)"/><path d="M136 66 q8 3 9 13 q-7 -7 -13 -8z" fill="url(#fxC)"/>
      <circle cx="100" cy="82" r="42" fill="url(#coS)"/>
      <ellipse cx="100" cy="94" rx="24" ry="17" fill="url(#fxC)"/>
      <ellipse cx="74" cy="90" rx="7.5" ry="5" fill="#fb6f92" opacity=".4"/><ellipse cx="126" cy="90" rx="7.5" ry="5" fill="#fb6f92" opacity=".4"/>
      ${e}
      ${b}
      <ellipse cx="100" cy="92" rx="6" ry="4.8" fill="#3a1206"/><ellipse cx="97.6" cy="90" rx="1.8" ry="1.3" fill="#fff" opacity=".55"/>
      <path d="M100 97 v6" stroke="#5a2a10" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>
      <g id="mouthG"></g>
      <path d="M58 92 h-16 M60 98 l-16 3" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M142 92 h16 M140 98 l16 3" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>`,
        },
      },
      mouth: { cx: 100, cy: 104, color: '#4a1608' },
    }
  },
}

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
export const ava: CharacterSpec = {
  slug: 'ava', name: 'آوا', role: 'هم‌صحبت',
  eyes: { x: [86, 114], y: 90, r: 10 }, lidColor: '#f4c39c', browColor: '#5b3826',
  // Legs are under the dress, so there is nothing to swing: `walk` has no leg
  // layers and takes the CSS fallback either way. Only the float is driven.
  gaits: ['fly'],
  // No ears and no tail to droop, so sadness has to live in the spine and the
  // shoulders instead — more spine than the shared preset gives.
  posture: {
    sad: { spine: 6, sink: 3, headDrop: 6, arms: 16 },
    sleepy: { spine: 3, sink: 5, headTilt: 14, arms: 10 },
    excited: { arms: -18 },
    happy: { arms: -8 },
  },
  render({ emotion, intensity }) {
    const e = eyes(86, 114, 90, 10, 'avIris', emotion.squint * intensity, emotion.wide * intensity)
    const b = brows(86, 114, 74, emotion.brow, '#5b3826')
    return {
      grads: `
      <radialGradient id="avS" cx="42%" cy="30%" r="76%"><stop offset="0" stop-color="#ffeede"/><stop offset="1" stop-color="#f4c39c"/></radialGradient>
      <linearGradient id="avHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4230"/><stop offset="1" stop-color="#3a2213"/></linearGradient>
      <linearGradient id="avSh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff86c2"/><stop offset="1" stop-color="#e0468f"/></linearGradient>
      <radialGradient id="avIris" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="#7a5636"/><stop offset=".6" stop-color="#4a2e18"/><stop offset="1" stop-color="#241407"/></radialGradient>
      <radialGradient id="avCo" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#7a3a2a" stop-opacity=".15"/></radialGradient>`,
      art: '',
      layers: {
        shadow: {
          art: `<ellipse cx="100" cy="188" rx="44" ry="7" fill="#000" opacity=".10"/>`,
        },
        // Newly drawn: the original ava had no arms. The far one is flat and
        // duller, which reads as depth without a second gradient.
        farArm: {
          origin: [88, 150],
          art:
            `<path d="M88 150 q-14 14 -16 28" stroke="#d13f83" stroke-width="11" stroke-linecap="round" fill="none"/>` +
            `<ellipse cx="72" cy="180" rx="6.5" ry="5.5" fill="#e0b089"/>`,
        },
        torso: {
          // The hips, where the dress meets the body — a spine bend pivots here.
          origin: [100, 176],
          art:
            `<path d="M64 190c0-28 14-46 36-46s36 18 36 46z" fill="url(#avSh)"/>` +
            `<path d="M64 190c0-28 14-46 36-46 -12 6 -18 24 -18 46z" fill="#000" opacity=".08"/>` +
            `<circle cx="78" cy="166" r="4.5" fill="#fff" opacity=".8"/>` +
            `<circle cx="100" cy="176" r="4.5" fill="#fff" opacity=".8"/>` +
            `<circle cx="122" cy="166" r="4.5" fill="#fff" opacity=".8"/>`,
        },
        nearArm: {
          origin: [112, 150],
          art:
            `<path d="M112 150 q14 14 16 28" stroke="url(#avSh)" stroke-width="11" stroke-linecap="round" fill="none"/>` +
            `<ellipse cx="128" cy="180" rx="6.5" ry="5.5" fill="url(#avS)"/>`,
        },
        head: {
          // Where the head meets the dress. Hair hides the neck, but the join is
          // a real line between two forms, so this pivot is measured.
          origin: [100, 140],
          art: `<path d="M55 92c0-30 20-50 45-50s45 20 45 50c0-10-7-17-12-19 2 6 2 11 0 15-4-13-14-22-33-22s-29 9-33 22c-2-4-2-9 0-15-5 2-12 9-12 19z" fill="url(#avHair)"/>
      <circle cx="100" cy="90" r="45" fill="url(#avS)"/>
      <path d="M58 92c0 15 5 25 11 29-4-11-4-21-2-29z" fill="url(#avHair)"/><path d="M142 92c0 15-5 25-11 29 4-11 4-21 2-29z" fill="url(#avHair)"/>
      <circle cx="100" cy="94" r="45" fill="url(#avCo)"/>
      <circle cx="72" cy="64" r="8" fill="#ffcf4d"/><circle cx="72" cy="64" r="3.5" fill="#fff2c4"/>
      ${e}
      ${b}
      <ellipse cx="76" cy="104" rx="7" ry="4.6" fill="#fb7aa8" opacity=".7"/><ellipse cx="124" cy="104" rx="7" ry="4.6" fill="#fb7aa8" opacity=".7"/>
      <path d="M97 96 q3 4 6 0" stroke="#c98a6a" stroke-width="1.4" stroke-linecap="round" fill="none"/>
      <g id="mouthG"></g>`,
        },
      },
      mouth: { cx: 100, cy: 112, color: '#b03a4a' },
    }
  },
}

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
export const pashmak: CharacterSpec = {
  slug: 'pashmak', name: 'پشمک', role: 'صداها',
  eyes: { x: [80, 116], y: 76, r: 11 }, lidColor: '#c9d5e4', browColor: '#5a6b80',
  // Neither legs nor wings: nothing to phase-drive, both gaits fall back to the
  // CSS body animation. Declared empty rather than omitted, so it reads as a
  // decision and not an oversight.
  gaits: [],
  // A ball of fluff has no spine to speak of, so the shared preset's lean reads
  // as the whole character toppling. Ears and tail carry it instead.
  posture: {
    sad: { spine: 4, sink: 4, ears: 34, tail: 34 },
    sleepy: { spine: 2, sink: 7, ears: 20 },
    excited: { spine: -2, ears: -24, tail: -32 },
    surprised: { spine: -3, ears: -28 },
  },
  render({ emotion, intensity }) {
    const e = eyes(80, 116, 76, 11, 'pkIris', emotion.squint * intensity, emotion.wide * intensity)
    const b = brows(80, 116, 60, emotion.brow, '#5a6b80')
    return {
      grads: `
      <radialGradient id="pkH" cx="40%" cy="26%" r="80%"><stop offset="0" stop-color="#fbfdff"/><stop offset=".55" stop-color="#c9d5e4"/><stop offset="1" stop-color="#8ea0b6"/></radialGradient>
      <radialGradient id="pkB" cx="42%" cy="28%" r="82%"><stop offset="0" stop-color="#e6edf5"/><stop offset=".6" stop-color="#c1cddc"/><stop offset="1" stop-color="#8b9db3"/></radialGradient>
      <linearGradient id="pkC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#eaf0f7"/></linearGradient>
      <radialGradient id="pkEar" cx="50%" cy="24%" r="82%"><stop offset="0" stop-color="#ffb0da"/><stop offset="1" stop-color="#e94f9e"/></radialGradient>
      <radialGradient id="pkIris" cx="36%" cy="26%" r="80%"><stop offset="0" stop-color="#8fd6c0"/><stop offset=".55" stop-color="#3f8f78"/><stop offset="1" stop-color="#1e4a3c"/></radialGradient>
      <radialGradient id="pkCo" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3a4a5e" stop-opacity=".18"/></radialGradient>`,
      art: '',
      layers: {
        shadow: { art: `<ellipse cx="98" cy="188" rx="50" ry="8" fill="#000" opacity=".10"/>` },
        // The curl of tail, pivoting where it leaves the body's right edge.
        tail: {
          origin: [146, 154],
          art: `<path d="M150 156c30-2 44-28 33-50-10 20-24 27-44 30z" fill="url(#pkB)"/>`,
        },
        torso: {
          origin: [98, 176],
          art: `<ellipse cx="98" cy="142" rx="45" ry="36" fill="url(#pkB)"/><ellipse cx="98" cy="152" rx="28" ry="20" fill="url(#pkC)"/><ellipse cx="98" cy="150" rx="45" ry="36" fill="url(#pkCo)"/>`,
        },
        // Each tuft pivots at the midpoint of its own base, so an ear droop
        // hinges where the tuft meets the skull rather than sweeping the point
        // through it.
        earL: {
          origin: [77, 45],
          art: `<path d="M62 52 L54 12 L92 38 Z" fill="url(#pkH)"/><path d="M66 46 L61 22 L84 40 Z" fill="url(#pkEar)"/>`,
        },
        earR: {
          origin: [119, 45],
          art: `<path d="M134 52 L142 12 L104 38 Z" fill="url(#pkH)"/><path d="M130 46 L135 22 L112 40 Z" fill="url(#pkEar)"/>`,
        },
        // y=113.5 is where the head lobe and the body lobe cross — the pinch in
        // the outline. Rounded to 114; the whiskers ride the head because they
        // grow out of the muzzle.
        head: {
          origin: [98, 114],
          art: `<circle cx="98" cy="80" r="43" fill="url(#pkH)"/>
      <path d="M58 80 q-11 4 -10 15 q9 -8 17 -9z" fill="url(#pkH)"/><path d="M138 80 q11 4 10 15 q-9 -8 -17 -9z" fill="url(#pkH)"/>
      <path d="M60 92 q-11 2 -12 12 q9 -6 17 -7z" fill="url(#pkH)"/><path d="M136 92 q11 2 12 12 q-9 -6 -17 -7z" fill="url(#pkH)"/>
      <circle cx="98" cy="84" r="43" fill="url(#pkCo)"/>
      <ellipse cx="98" cy="94" rx="22" ry="15" fill="url(#pkC)"/>
      <ellipse cx="74" cy="90" rx="6.5" ry="4.2" fill="#fb6f92" opacity=".32"/><ellipse cx="122" cy="90" rx="6.5" ry="4.2" fill="#fb6f92" opacity=".32"/>
      ${e}
      ${b}
      <path d="M93 90 L105 90 L99 96 Z" fill="#ff6f9d"/><ellipse cx="97" cy="91.5" rx="1.4" ry="1" fill="#fff" opacity=".6"/>
      <path d="M99 96 v5" stroke="#5a6b80" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>
      <g id="mouthG"></g>
      <path d="M56 90 L30 85 M56 96 L31 98" stroke="#e6edf5" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M140 90 L166 85 M140 96 L165 98" stroke="#e6edf5" stroke-width="1.8" stroke-linecap="round"/>`,
        },
      },
      mouth: { cx: 99, cy: 104, color: '#3a4a5e' },
    }
  },
}

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
export const laki: CharacterSpec = {
  slug: 'laki', name: 'لاکی', role: 'شمارش',
  eyes: { x: [90, 110], y: 48, r: 9 }, lidColor: '#84e6a0', browColor: '#188a3e',
  // Walk only. The back flippers occupy the arm slots — which is right, they
  // are what the walk swings — so `canDrive('fly')` is structurally true. A
  // tortoise does not fly, so `fly` is simply not declared.
  gaits: ['walk'],
  // The shell does not bend, so spine lean has to stay small or the whole
  // character tips over. Sadness is carried by the head withdrawing into it.
  posture: {
    // headDrop is boxed in from *both* sides here, which is unique on the roster
    // and is the price of the head tucking behind the shell:
    //   +  drops the mouth under the rim mid-sentence (the widest open viseme
    //      already reaches cy+9, and only ~3 units of clearance remain)
    //   -  lifts the head clear of the rim and detaches it from the body
    // The measured window is about [-3, 0]. Withdrawal is expressed with `sink`,
    // which lowers the whole turtle instead. Both walls have tests.
    sad: { spine: 3, sink: 6, headDrop: 0 },
    sleepy: { spine: 2, sink: 7, headDrop: 0, headTilt: 10 },
    excited: { spine: -2, sink: -3, headDrop: -2 },
    surprised: { spine: -3, sink: -2, headDrop: -2 },
    thinking: { spine: 1, headTilt: 12 },
    // The shared presets put مغرور at headDrop -5 and خجالتی at +4, and both
    // walk straight out of the measured window above — the seam tests caught
    // each of them. Pulled inside it here; the lift and the withdrawal are
    // carried by `sink` instead, which the shell cannot clip.
    proud: { headDrop: -3, sink: -5 },
    shy: { headDrop: 2, sink: 3 },
  },
  // A nod travels 6.5 units down, and the window above allows 2.8 — لاکی would
  // nod its mouth in under the shell rim. It nods with its whole body instead,
  // which the shell moves with. Measured, not assumed; there is a test.
  gestureFallback: ['nod'],
  render({ emotion, intensity }) {
    const e = eyes(90, 110, 48, 9, 'lkIris', emotion.squint * intensity, emotion.wide * intensity)
    const b = brows(90, 110, 36, emotion.brow, '#188a3e')
    return {
      grads: `
      <radialGradient id="lkSh" cx="42%" cy="22%" r="84%"><stop offset="0" stop-color="#7ff0a3"/><stop offset=".55" stop-color="#1fa94f"/><stop offset="1" stop-color="#137a37"/></radialGradient>
      <radialGradient id="lkShIn" cx="42%" cy="22%" r="82%"><stop offset="0" stop-color="#b6f7cc"/><stop offset="1" stop-color="#5fd884"/></radialGradient>
      <radialGradient id="lkH" cx="40%" cy="28%" r="80%"><stop offset="0" stop-color="#c9f7d6"/><stop offset=".6" stop-color="#84e6a0"/><stop offset="1" stop-color="#41c46e"/></radialGradient>
      <radialGradient id="lkIris" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="#2e6b3d"/><stop offset="1" stop-color="#0e3a1f"/></radialGradient>
      <radialGradient id="lkCo" cx="50%" cy="34%" r="64%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0e5a2c" stop-opacity=".2"/></radialGradient>`,
      art: '',
      layers: {
        shadow: { art: `<ellipse cx="100" cy="182" rx="70" ry="8" fill="#000" opacity=".11"/>` },
        // Back flippers. They swing opposite the front flipper on the same side,
        // which is the diagonal a quadruped actually trots on.
        farArm: { origin: [60, 150], art: `<ellipse cx="52" cy="156" rx="13" ry="10" fill="url(#lkH)"/>` },
        nearArm: { origin: [140, 150], art: `<ellipse cx="148" cy="156" rx="13" ry="10" fill="url(#lkH)"/>` },
        // Front flippers, pivoting where each meets the shell rather than at its
        // own centre, so a step hinges at the shoulder.
        farLeg: { origin: [82, 160], art: `<ellipse cx="74" cy="166" rx="13" ry="10" fill="url(#lkH)"/>` },
        nearLeg: { origin: [118, 160], art: `<ellipse cx="126" cy="166" rx="13" ry="10" fill="url(#lkH)"/>` },
        // The torso carrier holds the spine pivot but draws nothing: all of the
        // shell art is in `torsoFront` so it paints over the head.
        torso: { origin: [100, 142], art: '' },
        head: {
          origin: [100, 78],
          art: `<circle cx="100" cy="52" r="30" fill="url(#lkH)"/><circle cx="100" cy="54" r="30" fill="url(#lkCo)"/>
      ${e}
      ${b}
      <ellipse cx="82" cy="58" rx="5" ry="3.4" fill="#fb6f92" opacity=".55"/><ellipse cx="118" cy="58" rx="5" ry="3.4" fill="#fb6f92" opacity=".55"/>
      <g id="mouthG"></g>`,
        },
        // The shell, painted last inside the torso so the neck disappears under
        // the rim at every head angle instead of riding across the shell face.
        torsoFront: {
          origin: [100, 142],
          art: `<path d="M38 142c0-40 28-66 62-66s62 26 62 66z" fill="url(#lkSh)"/>
      <path d="M52 142c0-30 20-52 48-52s48 22 48 52z" fill="url(#lkShIn)"/>
      <path d="M100 90v52 M68 104l18 38 M132 104l-18 38 M62 124h76" stroke="#0f6b30" stroke-width="4" stroke-linecap="round"/>
      <path d="M60 104c14-10 66-10 80 0" stroke="#fff" stroke-opacity=".28" stroke-width="4" stroke-linecap="round" fill="none"/>`,
        },
      },
      mouth: { cx: 100, cy: 63, color: '#0f5a29' },
    }
  },
}

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
export const tondpa: CharacterSpec = {
  slug: 'tondpa', name: 'تندپا', role: 'رنگ‌ها',
  eyes: { x: [84, 116], y: 82, r: 11 }, lidColor: '#e4eaf1', browColor: '#8a93a8',
  // Neither gait is phase-driven, and not by default: the feet are pads with no
  // joint (see above) and there is no arm art of any kind. Both take the CSS
  // fallback and always will.
  gaits: [],
  // A rabbit is ears. They carry nearly all of the silhouette, so they get the
  // widest travel on the roster while the spine — a round crouched barrel —
  // gets very little. `headDrop` is bounded above by the seam: see the swept
  // measurement in the port report.
  posture: {
    sad: { spine: 4, sink: 5, ears: 44, headDrop: 2 },
    sleepy: { spine: 3, sink: 6, ears: 28, headTilt: 12, headDrop: 2 },
    excited: { spine: -3, sink: -2, ears: -22, headDrop: -2 },
    surprised: { spine: -4, ears: -28, headDrop: -3 },
    thinking: { spine: 1, ears: 14, headTilt: 10 },
    // مغرور's shared -5 headDrop pulls تندپا's head clear of its body: the
    // measured seam overlap falls to 95 against a floor of 120. Halved, and the
    // chin-up read is carried by `sink` and the ears instead.
    proud: { headDrop: -2, sink: -5, ears: -18 },
  },
  render({ emotion, intensity }) {
    const e = eyes(84, 116, 82, 11, 'tpIris', emotion.squint * intensity, emotion.wide * intensity)
    const b = brows(84, 116, 66, emotion.brow, '#8a93a8')
    return {
      grads: `
      <radialGradient id="tpB" cx="42%" cy="26%" r="82%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e4eaf1"/><stop offset="1" stop-color="#c2cddb"/></radialGradient>
      <radialGradient id="tpEar" cx="50%" cy="22%" r="82%"><stop offset="0" stop-color="#ffd0e6"/><stop offset="1" stop-color="#f78cbf"/></radialGradient>
      <radialGradient id="tpIris" cx="36%" cy="26%" r="80%"><stop offset="0" stop-color="#7a86a8"/><stop offset=".55" stop-color="#3f4a68"/><stop offset="1" stop-color="#1c2338"/></radialGradient>
      <radialGradient id="tpCo" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3a4560" stop-opacity=".15"/></radialGradient>`,
      art: '',
      layers: {
        shadow: { art: `<ellipse cx="100" cy="188" rx="48" ry="8" fill="#000" opacity=".10"/>` },
        // The foot pads live here, not in leg layers — they are body, not joint.
        torso: {
          origin: [100, 176],
          art:
            `<ellipse cx="100" cy="150" rx="40" ry="34" fill="url(#tpB)"/>` +
            `<ellipse cx="100" cy="158" rx="24" ry="20" fill="#fdfdff"/>` +
            `<ellipse cx="100" cy="152" rx="40" ry="34" fill="url(#tpCo)"/>` +
            `<ellipse cx="80" cy="178" rx="13" ry="8" fill="url(#tpB)"/>` +
            `<ellipse cx="120" cy="178" rx="13" ry="8" fill="url(#tpB)"/>`,
        },
        // Each ear pivots at its base (y≈58), which sits *inside* the head disc
        // — the disc reaches y≈48 at that x — so the base is occluded at every
        // droop angle and only the tip travels. The two ears are now grouped
        // per side rather than outer-pair-then-inner-pair as in the flat art;
        // they do not overlap each other (x 70..92 vs 108..130), so the paint
        // order between them cannot matter.
        earL: {
          origin: [84, 58],
          art:
            `<path d="M78 60 C70 20 78 8 84 8 C92 8 92 30 90 58 Z" fill="url(#tpB)"/>` +
            `<path d="M80 56 C74 26 80 16 84 16 C89 16 89 34 87 55 Z" fill="url(#tpEar)"/>`,
        },
        earR: {
          origin: [116, 58],
          art:
            `<path d="M122 60 C130 20 122 8 116 8 C108 8 108 30 110 58 Z" fill="url(#tpB)"/>` +
            `<path d="M120 56 C126 26 120 16 116 16 C111 16 111 34 113 55 Z" fill="url(#tpEar)"/>`,
        },
        // Pivot at the measured head/body crossing, y≈121.1 — not at the disc
        // centre, which would swing the whole head off the shoulders. The cheek
        // puffs ride the head: they are drawn past the disc edge on purpose and
        // are part of the head silhouette, so they must rotate with it.
        head: {
          origin: [100, 121],
          art:
            `<circle cx="100" cy="86" r="41" fill="url(#tpB)"/>` +
            `<circle cx="66" cy="96" r="13" fill="url(#tpB)"/>` +
            `<circle cx="134" cy="96" r="13" fill="url(#tpB)"/>` +
            `<circle cx="100" cy="88" r="41" fill="url(#tpCo)"/>` +
            e + b +
            `<ellipse cx="74" cy="98" rx="6.5" ry="4.2" fill="#fb6f92" opacity=".6"/>` +
            `<ellipse cx="126" cy="98" rx="6.5" ry="4.2" fill="#fb6f92" opacity=".6"/>` +
            `<path d="M94 96 L106 96 L100 102 Z" fill="#ff6f9d"/>` +
            `<ellipse cx="98" cy="97.5" rx="1.4" ry="1" fill="#fff" opacity=".6"/>` +
            `<path d="M100 102 v5" stroke="#c04a72" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>` +
            `<g id="mouthG"></g>`,
        },
      },
      mouth: { cx: 100, cy: 110, color: '#a01a52' },
    }
  },
}

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
export const boomi: CharacterSpec = {
  slug: 'boomi', name: 'بومی', role: 'حروف',
  eyes: { x: [80, 120], y: 84, r: 15 }, lidColor: '#d4ddff', browColor: '#4a4bb0',
  // Both, and both really driven: the talons are drawn legs at [84,176]/[116,176],
  // not an arm-shaped slot that happens to satisfy the walk's structural check.
  // An owl on the ground walks; withholding it here would have cost a working,
  // conformance-tested gait for no anatomical reason.
  gaits: ['fly', 'walk'],
  // An owl is a stiff round barrel: very little spine travel, no tail, and all
  // the silhouette expression carried by the ear tufts and the head swivel.
  posture: {
    // No head channels here: boomi has no head layer, so headDrop/headTilt have
    // nothing to land on. The shared presets still compute them; they simply go
    // nowhere, the same way tail droop does. Tuning them would be a lie.
    sad: { spine: 4, sink: 2, ears: 30 },
    sleepy: { spine: 2, sink: 5, ears: 18 },
    excited: { ears: -24 },
    happy: { ears: -12 },
    thinking: { headTilt: 10, ears: 6 },
  },
  render({ emotion, intensity }) {
    const e = eyes(80, 120, 84, 15, 'bmIris', emotion.squint * intensity, emotion.wide * intensity)
    const b = brows(80, 120, 58, emotion.brow, '#4a4bb0')
    const talon = (x: number): string =>
      `<path d="M${x} 176 l-7 10 M${x} 176 v12 M${x} 176 l7 10" stroke="#e08a00" stroke-width="4" stroke-linecap="round"/>`
    return {
      grads: `
      <radialGradient id="bmB" cx="42%" cy="24%" r="84%"><stop offset="0" stop-color="#9aa4fb"/><stop offset=".55" stop-color="#5f68e6"/><stop offset="1" stop-color="#3a30b0"/></radialGradient>
      <linearGradient id="bmBe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8ecff"/><stop offset="1" stop-color="#c3ccf8"/></linearGradient>
      <radialGradient id="bmD" cx="42%" cy="30%" r="74%"><stop offset="0" stop-color="#fbfcff"/><stop offset="1" stop-color="#d4ddff"/></radialGradient>
      <radialGradient id="bmIris" cx="38%" cy="28%" r="74%"><stop offset="0" stop-color="#c9822e"/><stop offset=".5" stop-color="#8a4e14"/><stop offset="1" stop-color="#2a1a0a"/></radialGradient>
      <linearGradient id="bmBk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd15a"/><stop offset="1" stop-color="#f19100"/></linearGradient>
      <radialGradient id="bmCo" cx="50%" cy="32%" r="66%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#241a80" stop-opacity=".2"/></radialGradient>`,
      art: '',
      layers: {
        shadow: {
          art: `<ellipse cx="100" cy="186" rx="50" ry="8" fill="#000" opacity=".11"/>`,
        },
        // The pivot now comes from `origin` rather than the hardcoded 50px/150px
        // in RIG_CSS's `.wingL`/`.wingR` rules, so it is finally per-character.
        farArm: {
          origin: [56, 108],
          art: `<path d="M50 104 q-12 30 8 52 q-16 -8 -20 -30 q-2 -16 12 -22z" fill="#3a30b0"/>`,
        },
        farLeg: { origin: [84, 176], art: talon(84) },
        // No head layer: an owl is one barrel from talons to tufts, with no neck
        // to pivot about, so the face is drawn straight onto the torso and rides
        // it. See the authoring rule in CharacterSpec — a head layer with an
        // invented pivot would turn every character's `headDrop` into a
        // different gesture.
        torso: {
          origin: [100, 172],
          art:
            `<ellipse cx="100" cy="118" rx="50" ry="58" fill="url(#bmB)"/>` +
            `<ellipse cx="100" cy="130" rx="31" ry="40" fill="url(#bmBe)"/>` +
            `<ellipse cx="100" cy="118" rx="50" ry="58" fill="url(#bmCo)"/>` +
            // The facial discs are feathering, not eyelids: they stay put while
            // the eye widens inside them. Wrapping them in `.eyeG` would scale
            // them too — the hook is generic enough to do that, and it is the
            // wrong call here.
            `<circle cx="80" cy="84" r="26" fill="url(#bmD)"/><circle cx="120" cy="84" r="26" fill="url(#bmD)"/>` +
            `<circle cx="80" cy="84" r="26" fill="none" stroke="#b9c4f5" stroke-width="1.5"/>` +
            `<circle cx="120" cy="84" r="26" fill="none" stroke="#b9c4f5" stroke-width="1.5"/>` +
            e + b +
            `<g id="mouthG"></g>`,
        },
        nearLeg: { origin: [116, 176], art: talon(116) },
        nearArm: {
          origin: [144, 108],
          art: `<path d="M150 104 q12 30 -8 52 q16 -8 20 -30 q2 -16 -12 -22z" fill="#3a30b0"/>`,
        },
        earL: { origin: [66, 58], art: `<path d="M58 66 L48 30 L80 56 Z" fill="url(#bmB)"/>` },
        earR: { origin: [134, 58], art: `<path d="M142 66 L152 30 L120 56 Z" fill="url(#bmB)"/>` },
      },
      mouth: { cx: 100, cy: 104, color: '#f19100', beak: true },
    }
  },
}

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
export const khersi: CharacterSpec = {
  slug: 'khersi', name: 'خرسی', role: 'احساس‌ها',
  eyes: { x: [84, 116], y: 80, r: 10.5 }, lidColor: '#c79f63', browColor: '#6a4526',
  // No legs beyond the pads and no arms of any kind, so `canDrive` is false for
  // both gaits before the declaration is even consulted. Declared empty anyway,
  // so the decision is on the page rather than implied by an omission.
  gaits: [],
  // The character whose role *is* the emotions, so the silhouette does more work
  // here than anywhere else: the widest spine travel on the roster, because a
  // soft round bear can genuinely slump, paired with the *narrowest* ear travel
  // of any eared character — small round ears set flat against the skull cannot
  // swing like تندپا's without leaving the head.
  posture: {
    sad: { spine: 10, sink: 5, ears: 22, headDrop: 4 },
    sleepy: { spine: 5, sink: 7, ears: 14, headTilt: 13, headDrop: 3 },
    excited: { spine: -5, sink: -3, ears: -16, headDrop: -3 },
    surprised: { spine: -8, sink: -3, ears: -20, headDrop: -4 },
    thinking: { spine: 3, headTilt: 14, ears: 6 },
    love: { spine: -1, headTilt: 10, ears: -8 },
  },
  render({ emotion, intensity }) {
    const e = eyes(84, 116, 80, 10.5, 'khIris', emotion.squint * intensity, emotion.wide * intensity)
    const b = brows(84, 116, 64, emotion.brow, '#6a4526')
    return {
      grads: `
      <radialGradient id="khHh" cx="40%" cy="26%" r="80%"><stop offset="0" stop-color="#e6cea2"/><stop offset=".55" stop-color="#c79f63"/><stop offset="1" stop-color="#a07c46"/></radialGradient>
      <radialGradient id="khB" cx="42%" cy="28%" r="82%"><stop offset="0" stop-color="#c99f6f"/><stop offset=".6" stop-color="#b08863"/><stop offset="1" stop-color="#8a6644"/></radialGradient>
      <radialGradient id="khM" cx="42%" cy="28%" r="78%"><stop offset="0" stop-color="#f7ead2"/><stop offset="1" stop-color="#e6d0af"/></radialGradient>
      <radialGradient id="khEar" cx="50%" cy="28%" r="82%"><stop offset="0" stop-color="#b98322"/><stop offset="1" stop-color="#8a5f14"/></radialGradient>
      <radialGradient id="khIris" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="#7a4e2c"/><stop offset=".6" stop-color="#4a2e18"/><stop offset="1" stop-color="#241207"/></radialGradient>
      <radialGradient id="khCo" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#5a3a1e" stop-opacity=".18"/></radialGradient>`,
      art: '',
      layers: {
        shadow: { art: `<ellipse cx="100" cy="188" rx="50" ry="8" fill="#000" opacity=".11"/>` },
        torso: {
          origin: [100, 176],
          art:
            `<ellipse cx="100" cy="150" rx="44" ry="36" fill="url(#khB)"/>` +
            `<ellipse cx="100" cy="158" rx="25" ry="22" fill="#dcc7a0"/>` +
            `<ellipse cx="100" cy="152" rx="44" ry="36" fill="url(#khCo)"/>` +
            `<ellipse cx="78" cy="178" rx="13" ry="8" fill="url(#khB)"/>` +
            `<ellipse cx="122" cy="178" rx="13" ry="8" fill="url(#khB)"/>`,
        },
        // Pivot at the head/ear chord midpoint (see the note above). The ears
        // now paint after the body art instead of before it, because the rig
        // nests them under the head — harmless here, since they end at y≈68 and
        // the body starts at y≈114, so the two never overlap.
        earL: {
          origin: [72, 57],
          art:
            `<circle cx="66" cy="50" r="18" fill="url(#khEar)"/>` +
            `<circle cx="66" cy="50" r="10" fill="#d9ac74"/>`,
        },
        earR: {
          origin: [128, 57],
          art:
            `<circle cx="134" cy="50" r="18" fill="url(#khEar)"/>` +
            `<circle cx="134" cy="50" r="10" fill="#d9ac74"/>`,
        },
        head: {
          origin: [100, 121],
          art:
            `<circle cx="100" cy="86" r="43" fill="url(#khHh)"/>` +
            `<circle cx="100" cy="90" r="43" fill="url(#khCo)"/>` +
            `<ellipse cx="100" cy="104" rx="25" ry="18" fill="url(#khM)"/>` +
            e + b +
            `<ellipse cx="74" cy="98" rx="7" ry="4.6" fill="#f0a0a0" opacity=".6"/>` +
            `<ellipse cx="126" cy="98" rx="7" ry="4.6" fill="#f0a0a0" opacity=".6"/>` +
            `<ellipse cx="100" cy="98" rx="7.5" ry="5.4" fill="#3b2314"/>` +
            `<ellipse cx="97.4" cy="96" rx="1.9" ry="1.4" fill="#fff" opacity=".5"/>` +
            `<path d="M100 104 v6" stroke="#6a4526" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>` +
            `<g id="mouthG"></g>`,
        },
      },
      mouth: { cx: 100, cy: 116, color: '#5a3a1e' },
    }
  },
}

export const simorgh: CharacterSpec = {
  slug: 'simorgh', name: 'سیمرغ', role: 'راهنما',
  eyes: { x: [80, 120], y: 76, r: 11 }, lidColor: '#fbb26a', browColor: '#b45309',
  render({ emotion, intensity }) {
    const e = eyes(80, 120, 76, 11, 'smIris', emotion.squint * intensity, emotion.wide * intensity)
    const b = brows(80, 120, 58, emotion.brow, '#b45309')
    return {
      grads: `
      <radialGradient id="smH" cx="40%" cy="26%" r="80%"><stop offset="0" stop-color="#ffd9a0"/><stop offset=".55" stop-color="#f9852f"/><stop offset="1" stop-color="#d9660f"/></radialGradient>
      <radialGradient id="smB" cx="42%" cy="28%" r="82%"><stop offset="0" stop-color="#fbb26a"/><stop offset=".6" stop-color="#f4820f"/><stop offset="1" stop-color="#c05a0c"/></radialGradient>
      <linearGradient id="smC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d6"/><stop offset="1" stop-color="#ffe0ad"/></linearGradient>
      <radialGradient id="smIris" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="#6a4a2a"/><stop offset=".6" stop-color="#3a2410"/><stop offset="1" stop-color="#1a0e04"/></radialGradient>
      <radialGradient id="smCo" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#7a3a00" stop-opacity=".18"/></radialGradient>`,
      art: `<ellipse cx="100" cy="188" rx="52" ry="8" fill="#000" opacity=".10"/>
      <ellipse cx="54" cy="152" rx="30" ry="12" transform="rotate(-32 54 152)" fill="#ef4444" opacity=".85"/>
      <ellipse cx="74" cy="162" rx="30" ry="11" transform="rotate(-16 74 162)" fill="#f97316" opacity=".85"/>
      <ellipse cx="100" cy="166" rx="30" ry="11" fill="#eab308" opacity=".85"/>
      <ellipse cx="126" cy="162" rx="30" ry="11" transform="rotate(16 126 162)" fill="#22c55e" opacity=".85"/>
      <ellipse cx="146" cy="152" rx="30" ry="12" transform="rotate(32 146 152)" fill="#3b82f6" opacity=".85"/>
      <g class="wingL"><ellipse cx="52" cy="128" rx="24" ry="13" transform="rotate(-20 52 128)" fill="#fb923c"/><ellipse cx="54" cy="126" rx="17" ry="9" transform="rotate(-20 54 126)" fill="#fdba74"/></g>
      <g class="wingR"><ellipse cx="148" cy="128" rx="24" ry="13" transform="rotate(20 148 128)" fill="#fb923c"/><ellipse cx="146" cy="126" rx="17" ry="9" transform="rotate(20 146 126)" fill="#fdba74"/></g>
      <ellipse cx="100" cy="140" rx="40" ry="42" fill="url(#smB)"/><ellipse cx="100" cy="146" rx="26" ry="30" fill="url(#smC)"/><ellipse cx="100" cy="140" rx="40" ry="42" fill="url(#smCo)"/>
      <ellipse cx="100" cy="150" rx="14" ry="16" fill="#fef3c7" opacity=".5"/>
      <ellipse cx="84" cy="30" rx="7" ry="18" transform="rotate(-16 84 30)" fill="#ef4444"/>
      <ellipse cx="100" cy="26" rx="7" ry="20" fill="#eab308"/>
      <ellipse cx="116" cy="30" rx="7" ry="18" transform="rotate(16 116 30)" fill="#3b82f6"/>
      <circle cx="100" cy="80" r="42" fill="url(#smH)"/><circle cx="100" cy="84" r="42" fill="url(#smCo)"/>
      <ellipse cx="100" cy="90" rx="22" ry="15" fill="url(#smC)" opacity=".55"/>
      ${e}
      ${b}
      <ellipse cx="72" cy="94" rx="8" ry="5" fill="#fca5a5" opacity=".5"/><ellipse cx="128" cy="94" rx="8" ry="5" fill="#fca5a5" opacity=".5"/>
      <g id="mouthG"></g>
      <path d="M84 180 l-6 12 M84 180 v13 M84 180 l6 12" stroke="#d97706" stroke-width="4" stroke-linecap="round"/>
      <path d="M116 180 l-6 12 M116 180 v13 M116 180 l6 12" stroke="#d97706" stroke-width="4" stroke-linecap="round"/>`,
      mouth: { cx: 100, cy: 100, color: '#e0850e', beak: true },
    }
  },
}

/** The built-in roster, keyed by slug. */
export const CHARACTERS: Record<string, CharacterSpec> = {
  roozi, ava, pashmak, laki, tondpa, boomi, khersi, simorgh,
}

export const CHARACTER_SLUGS = Object.keys(CHARACTERS)

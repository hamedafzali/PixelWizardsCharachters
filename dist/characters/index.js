import { eyes, brows } from '../draw.js';
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
export const roozi = {
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
    // Read off the layers below: same pivots, same centres and radii, plus the
    // depth the drawing implies. The head is a 42-radius ball at (100, 78), so
    // face depths are where its surface is: eyes at (±17, −4) sit at z≈34, the
    // brow line 20 higher at z≈29, and the mouth on the muzzle's front at z≈41.
    body3d: {
        layers: {
            tail: {
                pivot: [146, 146, -14],
                parts: [
                    { shape: 'sphere', at: [163, 124, -18], size: [13, 30, 13], rot: [0, 0, 35], color: '#f08a2c' },
                    { shape: 'sphere', at: [177, 103, -16], size: [10, 13, 10], rot: [0, 0, 35], color: '#fff3e3' },
                ],
            },
            farArm: {
                pivot: [62, 126, -12],
                parts: [
                    { shape: 'capsule', at: [56, 140, -12], size: [6.5, 18, 6.5], rot: [0, 0, 23], color: '#d0621a' },
                    { shape: 'sphere', at: [50, 156, -11], size: [7.5, 6, 7], color: '#f2c08c' },
                ],
            },
            farLeg: {
                pivot: [84, 160, -8],
                parts: [{ shape: 'sphere', at: [80, 174, -4], size: [12, 8, 15], color: '#cf5f0e' }],
            },
            torso: {
                pivot: [100, 168, 0],
                parts: [
                    { shape: 'sphere', at: [100, 138, 0], size: [44, 38, 34], color: '#f7902f' },
                    { shape: 'sphere', at: [100, 150, 18], size: [26, 21, 16], color: '#fff3e3' },
                ],
            },
            nearLeg: {
                pivot: [116, 160, 8],
                parts: [{ shape: 'sphere', at: [120, 174, 6], size: [12, 8, 15], color: '#f7902f' }],
            },
            nearArm: {
                pivot: [138, 126, 12],
                parts: [
                    { shape: 'capsule', at: [144, 140, 13], size: [6.5, 18, 6.5], rot: [0, 0, -23], color: '#f7902f' },
                    { shape: 'sphere', at: [150, 156, 14], size: [7.5, 6, 7], color: '#fff3e3' },
                ],
            },
            earL: {
                pivot: [76, 50, -2],
                parts: [
                    { shape: 'cone', at: [70, 36, -4], size: [15, 40, 8], rot: [0, 0, -22], color: '#b4460f' },
                    { shape: 'cone', at: [72, 39, 2], size: [8, 26, 3], rot: [0, 0, -22], color: '#7a2a0c', noOutline: true },
                ],
            },
            earR: {
                pivot: [124, 50, -2],
                parts: [
                    { shape: 'cone', at: [130, 36, -4], size: [15, 40, 8], rot: [0, 0, 22], color: '#b4460f' },
                    { shape: 'cone', at: [128, 39, 2], size: [8, 26, 3], rot: [0, 0, 22], color: '#7a2a0c', noOutline: true },
                ],
            },
            head: {
                pivot: [100, 112, 0],
                parts: [
                    { shape: 'sphere', at: [100, 78, 0], size: [42, 40, 38], color: '#fb9a3e' },
                    // cheek ruffs, pointing out and down like the drawing's tufts
                    { shape: 'cone', at: [58, 88, 6], size: [9, 22, 8], rot: [0, 0, -128], color: '#fb9a3e' },
                    { shape: 'cone', at: [142, 88, 6], size: [9, 22, 8], rot: [0, 0, 128], color: '#fb9a3e' },
                    { shape: 'sphere', at: [100, 95, 28], size: [24, 16, 14], color: '#fff6ea' },
                    { shape: 'sphere', at: [100, 90, 43], size: [6, 4.6, 4], color: '#3a1206' },
                    { shape: 'sphere', at: [98, 88.6, 46.6], size: [1.8, 1.3, 0.6], color: '#ffffff', flat: true, opacity: 0.6, noOutline: true },
                    { shape: 'sphere', at: [73, 91, 27], size: [7.5, 5, 1.2], rot: [0, -42, 0], color: '#fb6f92', flat: true, opacity: 0.45, noOutline: true },
                    { shape: 'sphere', at: [127, 91, 27], size: [7.5, 5, 1.2], rot: [0, 42, 0], color: '#fb6f92', flat: true, opacity: 0.45, noOutline: true },
                ],
            },
        },
        face: {
            layer: 'head',
            center: [100, 78, 0],
            eyes: { z: 33, iris: '#5a3418' },
            brows: { y: 58, z: 29 },
            mouth: { x: 100, y: 104, z: 40.5, color: '#4a1608' },
        },
        shadow: 52,
    },
    render({ emotion, intensity }) {
        const e = eyes(83, 117, 74, 11, 'fxIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(83, 117, 58, emotion.brow, '#8a3a12');
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
                    art: `<path d="M150 150c30-4 40-32 32-54-16 18-26 22-46 32z" fill="url(#fxT)"/>` +
                        `<path d="M172 108c-6 14-16 22-30 25l9 15c16-6 24-22 21-40z" fill="url(#fxC)" opacity=".92"/>`,
                },
                // Newly drawn: the original fox had no arms. Flat darker fill on the far
                // side reads as depth without a second gradient.
                farArm: {
                    origin: [62, 126],
                    art: `<path d="M62 126 q-10 14 -12 28" stroke="#cf5f0e" stroke-width="13" stroke-linecap="round" fill="none"/>` +
                        `<ellipse cx="50" cy="156" rx="7.5" ry="6" fill="#e9b27a"/>`,
                },
                farLeg: {
                    origin: [84, 160],
                    art: `<ellipse cx="80" cy="172" rx="12" ry="8" fill="#cf5f0e"/>`,
                },
                torso: {
                    origin: [100, 168],
                    art: `<ellipse cx="100" cy="138" rx="44" ry="38" fill="url(#fxB)"/>` +
                        `<ellipse cx="100" cy="150" rx="27" ry="22" fill="url(#fxC)"/>` +
                        `<ellipse cx="100" cy="150" rx="44" ry="38" fill="url(#coS)"/>`,
                },
                nearLeg: {
                    origin: [116, 160],
                    art: `<ellipse cx="120" cy="172" rx="12" ry="8" fill="url(#fxB)"/>`,
                },
                nearArm: {
                    origin: [138, 126],
                    art: `<path d="M138 126 q10 14 12 28" stroke="url(#fxB)" stroke-width="13" stroke-linecap="round" fill="none"/>` +
                        `<ellipse cx="150" cy="156" rx="7.5" ry="6" fill="url(#fxC)"/>`,
                },
                earL: {
                    origin: [76, 50],
                    art: `<path d="M62 56 L54 14 L92 40 Z" fill="url(#fxE)"/>` +
                        `<path d="M66 48 L62 24 L86 42 Z" fill="#9a3a10"/>`,
                },
                earR: {
                    origin: [124, 50],
                    art: `<path d="M138 56 L146 14 L108 40 Z" fill="url(#fxE)"/>` +
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
        };
    },
};
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
export const ava = {
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
    // Read off the layers below. The head is a 45-radius ball at (100, 90), so
    // the eyes at (±14, 0) sit at z≈38, the brows 16 higher at z≈35 and the
    // mouth 22 lower at z≈35. The pigtails hang just behind the head's sides.
    body3d: {
        layers: {
            farArm: {
                pivot: [88, 150, -10],
                parts: [
                    { shape: 'capsule', at: [80, 164, -10], size: [5.5, 22, 5.5], rot: [0, 0, 30], color: '#d13f83' },
                    { shape: 'sphere', at: [72, 180, -10], size: [6.5, 5.5, 6], color: '#e0b089' },
                ],
            },
            torso: {
                pivot: [100, 176, 0],
                parts: [{ shape: 'cone', at: [100, 166, 0], size: [36, 48, 28], color: '#f866ac' }],
            },
            nearArm: {
                pivot: [112, 150, 10],
                parts: [
                    { shape: 'capsule', at: [120, 164, 10], size: [5.5, 22, 5.5], rot: [0, 0, -30], color: '#ff86c2' },
                    { shape: 'sphere', at: [128, 180, 10], size: [6.5, 5.5, 6], color: '#f4c39c' },
                ],
            },
            earL: {
                pivot: [57, 89, -6],
                parts: [
                    { shape: 'sphere', at: [58, 89, -6], size: [13.5, 13.5, 12], color: '#52321f' },
                    { shape: 'capsule', at: [48, 132, -8], size: [8, 70, 7], color: '#4a2c1c' },
                ],
            },
            earR: {
                pivot: [143, 89, -6],
                parts: [
                    { shape: 'sphere', at: [142, 89, -6], size: [13.5, 13.5, 12], color: '#52321f' },
                    { shape: 'capsule', at: [152, 132, -8], size: [8, 70, 7], color: '#4a2c1c' },
                ],
            },
            head: {
                pivot: [100, 140, 0],
                // The back of her head is hair, not the face's outline colour.
                back: `<circle cx="100" cy="88" r="47" fill="url(#avHair)"/>`,
                parts: [
                    { shape: 'sphere', at: [100, 90, 0], size: [45, 45, 40], color: '#f9d6b8' },
                    // the hair cap, a shell over the back and top of the head
                    { shape: 'sphere', at: [100, 84, -6], size: [47, 44, 40], color: '#52321f' },
                    { shape: 'sphere', at: [72, 64, 34], size: [8, 8, 3], color: '#ffcf4d' },
                    { shape: 'sphere', at: [76, 104, 34], size: [7, 4.6, 1.2], rot: [0, -28, 0], color: '#fb7aa8', flat: true, opacity: 0.6, noOutline: true },
                    { shape: 'sphere', at: [124, 104, 34], size: [7, 4.6, 1.2], rot: [0, 28, 0], color: '#fb7aa8', flat: true, opacity: 0.6, noOutline: true },
                ],
            },
        },
        face: {
            layer: 'head',
            center: [100, 90, 0],
            eyes: { z: 38, iris: '#4a2e18' },
            brows: { y: 74, z: 35 },
            mouth: { x: 100, y: 112, z: 35, color: '#b03a4a' },
        },
        shadow: 44,
    },
    render({ emotion, intensity }) {
        const e = eyes(86, 114, 90, 10, 'avIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(86, 114, 74, emotion.brow, '#5b3826');
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
                    art: `<path d="M88 150 q-14 14 -16 28" stroke="#d13f83" stroke-width="11" stroke-linecap="round" fill="none"/>` +
                        `<ellipse cx="72" cy="180" rx="6.5" ry="5.5" fill="#e0b089"/>`,
                },
                torso: {
                    // The hips, where the dress meets the body — a spine bend pivots here.
                    origin: [100, 176],
                    art: `<path d="M64 190c0-28 14-46 36-46s36 18 36 46z" fill="url(#avSh)"/>` +
                        `<path d="M64 190c0-28 14-46 36-46 -12 6 -18 24 -18 46z" fill="#000" opacity=".08"/>` +
                        `<circle cx="78" cy="166" r="4.5" fill="#fff" opacity=".8"/>` +
                        `<circle cx="100" cy="176" r="4.5" fill="#fff" opacity=".8"/>` +
                        `<circle cx="122" cy="166" r="4.5" fill="#fff" opacity=".8"/>`,
                },
                nearArm: {
                    origin: [112, 150],
                    art: `<path d="M112 150 q14 14 16 28" stroke="url(#avSh)" stroke-width="11" stroke-linecap="round" fill="none"/>` +
                        `<ellipse cx="128" cy="180" rx="6.5" ry="5.5" fill="url(#avS)"/>`,
                },
                // Pigtails, one per side. Each bunch circle overlaps the head disc
                // (cx100 cy90 r45), so — same rule as خرسی's ears — the pivot is the
                // chord midpoint of that overlap, not the bunch's own centre (which
                // would be a no-op to rotate about) and not an eyeballed guess. These
                // reuse the earL/earR slots: ava has no ears drawn, so the slot that
                // nests "a thing attached to the side of the head, painted just
                // before it" was free.
                //   earChordMidpoint({cx:58,cy:89,r:13.5}, {cx:100,cy:90,r:45})
                //     → [57.07, 88.98], rounded to [57, 89]
                earL: {
                    origin: [57, 89],
                    art: `<circle cx="58" cy="89" r="13.5" fill="url(#avHair)"/>` +
                        `<path d="M50 82 C 34 92, 32 112, 42 130 C 34 142, 36 158, 48 170 C 44 176, 48 182, 56 182 C 62 176, 58 168, 62 160 C 52 148, 52 132, 62 118 C 54 106, 56 92, 66 84 C 60 80, 54 80, 50 82 Z" fill="url(#avHair)"/>` +
                        `<ellipse cx="55" cy="85" rx="5" ry="3.5" fill="#fff" opacity=".18"/>`,
                },
                //   earChordMidpoint({cx:142,cy:89,r:13.5}, {cx:100,cy:90,r:45})
                //     → mirror of earL → [143, 89]
                earR: {
                    origin: [143, 89],
                    art: `<circle cx="142" cy="89" r="13.5" fill="url(#avHair)"/>` +
                        `<path d="M150 82 C 166 92, 168 112, 158 130 C 166 142, 164 158, 152 170 C 156 176, 152 182, 144 182 C 138 176, 142 168, 138 160 C 148 148, 148 132, 138 118 C 146 106, 144 92, 134 84 C 140 80, 146 80, 150 82 Z" fill="url(#avHair)"/>` +
                        `<ellipse cx="145" cy="85" rx="5" ry="3.5" fill="#fff" opacity=".18"/>`,
                },
                head: {
                    // Where the head meets the dress. Hair hides the neck, but the join is
                    // a real line between two forms, so this pivot is measured.
                    origin: [100, 140],
                    art: `<circle cx="100" cy="90" r="45" fill="url(#avS)"/>
      <path d="M55 92c0-30 20-50 45-50s45 20 45 50c0-10-7-17-12-19 2 6 2 11 0 15-4-13-14-22-33-22s-29 9-33 22c-2-4-2-9 0-15-5 2-12 9-12 19z" fill="url(#avHair)"/>
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
        };
    },
};
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
export const pashmak = {
    slug: 'pashmak', name: 'پشمک', role: 'قصه‌ها',
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
    // Read off the layers below. The head is a 43-radius ball at (98, 80): the
    // eyes at (−18/+18, −4) sit at z≈34 and the brows 16 higher at z≈29; the
    // mouth is on the muzzle's front, z≈37.
    body3d: {
        layers: {
            tail: {
                pivot: [146, 154, -14],
                parts: [{ shape: 'sphere', at: [164, 132, -16], size: [12, 27, 12], rot: [0, 0, 40], color: '#c1cddc' }],
            },
            torso: {
                pivot: [98, 176, 0],
                parts: [
                    { shape: 'sphere', at: [98, 142, 0], size: [45, 36, 34], color: '#c1cddc' },
                    { shape: 'sphere', at: [98, 152, 18], size: [28, 20, 15], color: '#f6f9fc' },
                ],
            },
            earL: {
                pivot: [77, 45, -2],
                parts: [
                    { shape: 'cone', at: [69, 33, -4], size: [15, 40, 8], rot: [0, 0, -22], color: '#c9d5e4' },
                    { shape: 'cone', at: [71, 36, 2], size: [8, 26, 3], rot: [0, 0, -22], color: '#f37cb9', noOutline: true },
                ],
            },
            earR: {
                pivot: [119, 45, -2],
                parts: [
                    { shape: 'cone', at: [127, 33, -4], size: [15, 40, 8], rot: [0, 0, 22], color: '#c9d5e4' },
                    { shape: 'cone', at: [125, 36, 2], size: [8, 26, 3], rot: [0, 0, 22], color: '#f37cb9', noOutline: true },
                ],
            },
            head: {
                pivot: [98, 114, 0],
                parts: [
                    { shape: 'sphere', at: [98, 80, 0], size: [43, 41, 38], color: '#c9d5e4' },
                    // cheek tufts, out and down like the drawing's
                    { shape: 'cone', at: [56, 88, 6], size: [9, 22, 8], rot: [0, 0, -120], color: '#c9d5e4' },
                    { shape: 'cone', at: [140, 88, 6], size: [9, 22, 8], rot: [0, 0, 120], color: '#c9d5e4' },
                    { shape: 'sphere', at: [98, 94, 26], size: [22, 15, 13], color: '#f6f9fc' },
                    { shape: 'sphere', at: [99, 92, 38], size: [6, 4, 3], color: '#ff6f9d' },
                    { shape: 'sphere', at: [74, 90, 30], size: [6.5, 4.2, 1.2], rot: [0, -38, 0], color: '#fb6f92', flat: true, opacity: 0.4, noOutline: true },
                    { shape: 'sphere', at: [122, 90, 30], size: [6.5, 4.2, 1.2], rot: [0, 38, 0], color: '#fb6f92', flat: true, opacity: 0.4, noOutline: true },
                ],
            },
        },
        face: {
            layer: 'head',
            center: [98, 80, 0],
            eyes: { z: 34, iris: '#3f8f78' },
            brows: { y: 60, z: 29 },
            mouth: { x: 99, y: 104, z: 37, color: '#3a4a5e' },
        },
        shadow: 50,
    },
    render({ emotion, intensity }) {
        const e = eyes(80, 116, 76, 11, 'pkIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(80, 116, 60, emotion.brow, '#5a6b80');
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
        };
    },
};
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
export const laki = {
    slug: 'laki', name: 'لاکی', role: 'مرور',
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
    //
    // `nuzzle` joins it for the same reason and was caught the same way: the
    // suite measured -0.10 clearance at t=0.421, so a nuzzling لاکی presses its
    // mouth into the rim. Leaning the whole shell into the hand is also the
    // better read for a tortoise — it is what a tortoise would actually do.
    gestureFallback: ['nod', 'nuzzle'],
    // Read off the layers below. The head pokes out ahead of the shell, so it is
    // centred 14 forward: a 30-radius ball at (100, 52, 14) puts the eyes at
    // z≈38, the brows at z≈34 and the mouth at z≈38. The back flippers (the arm
    // slots) sit behind the shell and the front ones (the leg slots) ahead of it.
    // The torso carrier draws nothing in 2D, so it has no parts here either.
    body3d: {
        layers: {
            farArm: { pivot: [60, 150, -16], parts: [{ shape: 'sphere', at: [52, 156, -16], size: [13, 10, 10], color: '#6ad98c' }] },
            farLeg: { pivot: [82, 160, 12], parts: [{ shape: 'sphere', at: [74, 166, 12], size: [13, 10, 10], color: '#6ad98c' }] },
            torso: { pivot: [100, 142, 0], parts: [] },
            nearLeg: { pivot: [118, 160, 12], parts: [{ shape: 'sphere', at: [126, 166, 12], size: [13, 10, 10], color: '#84e6a0' }] },
            nearArm: { pivot: [140, 150, -16], parts: [{ shape: 'sphere', at: [148, 156, -16], size: [13, 10, 10], color: '#84e6a0' }] },
            head: {
                pivot: [100, 78, 10],
                parts: [
                    { shape: 'sphere', at: [100, 52, 14], size: [30, 30, 26], color: '#84e6a0' },
                    { shape: 'sphere', at: [82, 58, 35], size: [5, 3.4, 1.2], rot: [0, -34, 0], color: '#fb6f92', flat: true, opacity: 0.55, noOutline: true },
                    { shape: 'sphere', at: [118, 58, 35], size: [5, 3.4, 1.2], rot: [0, 34, 0], color: '#fb6f92', flat: true, opacity: 0.55, noOutline: true },
                ],
            },
            torsoFront: {
                pivot: [100, 142, 0],
                // A shell is a deep dome, not the shallow lens a 66-tall drawing inflates to.
                depth: 46,
                parts: [
                    { shape: 'sphere', at: [100, 134, 0], size: [62, 58, 46], color: '#1fa94f' },
                    { shape: 'sphere', at: [100, 128, 10], size: [48, 44, 40], color: '#5fd884' },
                ],
            },
        },
        face: {
            layer: 'head',
            center: [100, 52, 14],
            eyes: { z: 38, iris: '#0e3a1f' },
            brows: { y: 36, z: 34 },
            mouth: { x: 100, y: 63, z: 38, color: '#0f5a29' },
        },
        shadow: 70,
    },
    render({ emotion, intensity }) {
        const e = eyes(90, 110, 48, 9, 'lkIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(90, 110, 36, emotion.brow, '#188a3e');
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
        };
    },
};
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
export const tondpa = {
    slug: 'tondpa', name: 'تندپا', role: 'بازی‌ها',
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
    // Read off the layers below. The head is a 41-radius ball at (100, 86): the
    // eyes at (±16, −4) sit at z≈34, the brows 16 higher at z≈29 and the mouth
    // 24 lower at z≈30. The ears rise from inside the head, a little behind it.
    body3d: {
        layers: {
            torso: {
                pivot: [100, 176, 0],
                parts: [
                    { shape: 'sphere', at: [100, 150, 0], size: [40, 34, 32], color: '#e4eaf1' },
                    { shape: 'sphere', at: [100, 158, 16], size: [24, 20, 14], color: '#fdfdff' },
                    { shape: 'sphere', at: [80, 178, 10], size: [13, 8, 12], color: '#e4eaf1' },
                    { shape: 'sphere', at: [120, 178, 10], size: [13, 8, 12], color: '#e4eaf1' },
                ],
            },
            earL: {
                pivot: [84, 58, -4],
                parts: [
                    { shape: 'capsule', at: [84, 34, -4], size: [7, 36, 5], rot: [0, 0, -4], color: '#e4eaf1' },
                    { shape: 'capsule', at: [84, 37, 0], size: [3.5, 28, 1.5], rot: [0, 0, -4], color: '#f78cbf', noOutline: true },
                ],
            },
            earR: {
                pivot: [116, 58, -4],
                parts: [
                    { shape: 'capsule', at: [116, 34, -4], size: [7, 36, 5], rot: [0, 0, 4], color: '#e4eaf1' },
                    { shape: 'capsule', at: [116, 37, 0], size: [3.5, 28, 1.5], rot: [0, 0, 4], color: '#f78cbf', noOutline: true },
                ],
            },
            head: {
                pivot: [100, 121, 0],
                parts: [
                    { shape: 'sphere', at: [100, 86, 0], size: [41, 41, 37], color: '#e4eaf1' },
                    { shape: 'sphere', at: [66, 96, 6], size: [13, 13, 11], color: '#e4eaf1' },
                    { shape: 'sphere', at: [134, 96, 6], size: [13, 13, 11], color: '#e4eaf1' },
                    { shape: 'sphere', at: [100, 98, 32], size: [6, 3.5, 3], color: '#ff6f9d' },
                    { shape: 'sphere', at: [74, 98, 30], size: [6.5, 4.2, 1.2], rot: [0, -36, 0], color: '#fb6f92', flat: true, opacity: 0.6, noOutline: true },
                    { shape: 'sphere', at: [126, 98, 30], size: [6.5, 4.2, 1.2], rot: [0, 36, 0], color: '#fb6f92', flat: true, opacity: 0.6, noOutline: true },
                ],
            },
        },
        face: {
            layer: 'head',
            center: [100, 86, 0],
            eyes: { z: 34, iris: '#3f4a68' },
            brows: { y: 66, z: 29 },
            mouth: { x: 100, y: 110, z: 30, color: '#a01a52' },
        },
        shadow: 48,
    },
    render({ emotion, intensity }) {
        const e = eyes(84, 116, 82, 11, 'tpIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(84, 116, 66, emotion.brow, '#8a93a8');
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
                    art: `<ellipse cx="100" cy="150" rx="40" ry="34" fill="url(#tpB)"/>` +
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
                    art: `<path d="M78 60 C70 20 78 8 84 8 C92 8 92 30 90 58 Z" fill="url(#tpB)"/>` +
                        `<path d="M80 56 C74 26 80 16 84 16 C89 16 89 34 87 55 Z" fill="url(#tpEar)"/>`,
                },
                earR: {
                    origin: [116, 58],
                    art: `<path d="M122 60 C130 20 122 8 116 8 C108 8 108 30 110 58 Z" fill="url(#tpB)"/>` +
                        `<path d="M120 56 C126 26 120 16 116 16 C111 16 111 34 113 55 Z" fill="url(#tpEar)"/>`,
                },
                // Pivot at the measured head/body crossing, y≈121.1 — not at the disc
                // centre, which would swing the whole head off the shoulders. The cheek
                // puffs ride the head: they are drawn past the disc edge on purpose and
                // are part of the head silhouette, so they must rotate with it.
                head: {
                    origin: [100, 121],
                    art: `<circle cx="100" cy="86" r="41" fill="url(#tpB)"/>` +
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
        };
    },
};
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
 *   pivots. Converting a character migrates it to the layer classes; an
 *   unconverted flier would keep the old hooks and the old rules (none remain
 *   in the roster as of v1.3.0 — سیمرغ, the last one, converted then too;
 *   see its own docstring below).
 * - **Eyes are r=15, the roster's largest**, with facial discs behind them that
 *   deliberately do *not* scale with the widen transform (see below).
 */
export const boomi = {
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
    // Read off the layers below. There is no head: the face rides the torso, a
    // 50×58 egg at (100, 118), 42 deep. The eye discs stand on it at z≈30 and
    // the beak at z≈41; the brows sit at the egg's top edge, where it has
    // almost no depth left. Wings fold at the sides, the far one behind.
    body3d: {
        layers: {
            farArm: {
                pivot: [56, 108, -8],
                parts: [{ shape: 'sphere', at: [46, 130, -8], size: [9, 26, 8], rot: [0, 0, 8], color: '#3a30b0' }],
            },
            farLeg: {
                pivot: [84, 176, 4],
                parts: [{ shape: 'capsule', at: [84, 182, 4], size: [2, 8, 2], color: '#e08a00' }],
            },
            torso: {
                pivot: [100, 172, 0],
                parts: [
                    { shape: 'sphere', at: [100, 118, 0], size: [50, 58, 42], color: '#5f68e6' },
                    { shape: 'sphere', at: [100, 130, 18], size: [31, 40, 26], color: '#d4dbf8' },
                    { shape: 'sphere', at: [80, 84, 26], size: [26, 26, 8], color: '#eef1ff' },
                    { shape: 'sphere', at: [120, 84, 26], size: [26, 26, 8], color: '#eef1ff' },
                ],
            },
            nearLeg: {
                pivot: [116, 176, 6],
                parts: [{ shape: 'capsule', at: [116, 182, 6], size: [2, 8, 2], color: '#e08a00' }],
            },
            nearArm: {
                pivot: [144, 108, 8],
                parts: [{ shape: 'sphere', at: [154, 130, 8], size: [9, 26, 8], rot: [0, 0, -8], color: '#3a30b0' }],
            },
            earL: {
                pivot: [66, 58, -4],
                parts: [{ shape: 'cone', at: [62, 50, -4], size: [12, 37, 8], rot: [0, 0, -34], color: '#5f68e6' }],
            },
            earR: {
                pivot: [134, 58, -4],
                parts: [{ shape: 'cone', at: [138, 50, -4], size: [12, 37, 8], rot: [0, 0, 34], color: '#5f68e6' }],
            },
        },
        face: {
            layer: 'torso',
            center: [100, 118, 0],
            eyes: { z: 34, iris: '#8a4e14' },
            brows: { y: 58, z: 12 },
            mouth: { x: 100, y: 104, z: 41, color: '#f19100' },
        },
        shadow: 50,
    },
    render({ emotion, intensity }) {
        const e = eyes(80, 120, 84, 15, 'bmIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(80, 120, 58, emotion.brow, '#4a4bb0');
        const talon = (x) => `<path d="M${x} 176 l-7 10 M${x} 176 v12 M${x} 176 l7 10" stroke="#e08a00" stroke-width="4" stroke-linecap="round"/>`;
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
                    art: `<ellipse cx="100" cy="118" rx="50" ry="58" fill="url(#bmB)"/>` +
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
        };
    },
};
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
export const khersi = {
    slug: 'khersi', name: 'خرسی', role: 'ریاضی',
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
    // Read off the layers below. The head is a 43-radius ball at (100, 86): the
    // eyes at (±16, −6) sit at z≈35 and the brows 16 higher at z≈29; the mouth
    // is on the muzzle's front, z≈36. The round ears sit at the head's rim.
    body3d: {
        layers: {
            torso: {
                pivot: [100, 176, 0],
                parts: [
                    { shape: 'sphere', at: [100, 150, 0], size: [44, 36, 34], color: '#b08863' },
                    { shape: 'sphere', at: [100, 158, 18], size: [25, 22, 14], color: '#dcc7a0' },
                    { shape: 'sphere', at: [78, 178, 10], size: [13, 8, 12], color: '#b08863' },
                    { shape: 'sphere', at: [122, 178, 10], size: [13, 8, 12], color: '#b08863' },
                ],
            },
            earL: {
                pivot: [72, 57, -6],
                parts: [
                    { shape: 'sphere', at: [66, 50, -6], size: [18, 18, 8], color: '#a6741c' },
                    { shape: 'sphere', at: [66, 50, -1], size: [10, 10, 3], color: '#d9ac74', noOutline: true },
                ],
            },
            earR: {
                pivot: [128, 57, -6],
                parts: [
                    { shape: 'sphere', at: [134, 50, -6], size: [18, 18, 8], color: '#a6741c' },
                    { shape: 'sphere', at: [134, 50, -1], size: [10, 10, 3], color: '#d9ac74', noOutline: true },
                ],
            },
            head: {
                pivot: [100, 121, 0],
                parts: [
                    { shape: 'sphere', at: [100, 86, 0], size: [43, 43, 38], color: '#c79f63' },
                    { shape: 'sphere', at: [100, 104, 26], size: [25, 18, 14], color: '#efe0c4' },
                    { shape: 'sphere', at: [100, 98, 38], size: [7.5, 5.4, 4], color: '#3b2314' },
                    { shape: 'sphere', at: [74, 98, 31], size: [7, 4.6, 1.2], rot: [0, -36, 0], color: '#f0a0a0', flat: true, opacity: 0.6, noOutline: true },
                    { shape: 'sphere', at: [126, 98, 31], size: [7, 4.6, 1.2], rot: [0, 36, 0], color: '#f0a0a0', flat: true, opacity: 0.6, noOutline: true },
                ],
            },
        },
        face: {
            layer: 'head',
            center: [100, 86, 0],
            eyes: { z: 35, iris: '#4a2e18' },
            brows: { y: 64, z: 29 },
            mouth: { x: 100, y: 116, z: 36, color: '#5a3a1e' },
        },
        shadow: 50,
    },
    render({ emotion, intensity }) {
        const e = eyes(84, 116, 80, 10.5, 'khIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(84, 116, 64, emotion.brow, '#6a4526');
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
                    art: `<ellipse cx="100" cy="150" rx="44" ry="36" fill="url(#khB)"/>` +
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
                    art: `<circle cx="66" cy="50" r="18" fill="url(#khEar)"/>` +
                        `<circle cx="66" cy="50" r="10" fill="#d9ac74"/>`,
                },
                earR: {
                    origin: [128, 57],
                    art: `<circle cx="134" cy="50" r="18" fill="url(#khEar)"/>` +
                        `<circle cx="134" cy="50" r="10" fill="#d9ac74"/>`,
                },
                head: {
                    origin: [100, 121],
                    art: `<circle cx="100" cy="86" r="43" fill="url(#khHh)"/>` +
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
        };
    },
};
/**
 * سیمرغ — the last unconverted character, and the one most likely to need to
 * point, wave and nuzzle, since it is the app's guide. Converting it follows
 * بومی's playbook (owl → phoenix, wings map to `farArm`/`nearArm`, the legacy
 * `.wingL`/`.wingR` hooks are dropped) with two decisions of its own:
 *
 * - **The three crest feathers stay inside `head`**, painted before the head
 *   circle exactly as before. They are not `earL`/`earR`: there are three
 *   feathers, not a mirrored pair, and forcing a pair onto them would be the
 *   same invented-pivot mistake the authoring rule on `LayerName` warns
 *   against. Keeping them inside one layer's art string preserves their paint
 *   order, so the picture does not change.
 * - **The tail is its own layer**, not baked into `torso` — five feathers
 *   fanned out behind the body, the closest thing on the roster to لاکی's
 *   shell in that it reads as a single ornamental mass, but one that a
 *   `tail`-driven posture (sad droop, excited perk) can now actually reach.
 *   Its pivot is `[100, 132]`: not the visual centroid of the five ellipses
 *   (≈`[100, 158]`, which sits only 18–28 units from the torso pivot below —
 *   see the note on that number), but level with the wing pivots at `cy=132`,
 *   reading the tail as rooted at the same shoulder line the wings root from,
 *   which the art supports (the two outer feathers' own major axes project
 *   back toward `x≈100, y≈132–136` — see the working in the plan doc, not
 *   reproduced here since ellipses don't carry a drawn base the way a path
 *   does).
 * - **The feet move from the end of the flat art string into `torso`.** In
 *   the old unlayered art they painted *after* the face because they were
 *   simply last in the string; nothing made that order meaningful. They sit
 *   at y 180–205 and the head circle ends at y 122, so the two never overlap
 *   and folding the feet into `torso` (paint order: shadow → tail → farArm →
 *   torso → nearArm → head) changes nothing visible.
 * - **One real visual change, same as بومی's: `nearArm` now paints after
 *   `torso`.** The right wing moves from behind the body to in front of it —
 *   that is what near/far means, and it is a correction, not a regression,
 *   but `npm run sheet` is where to actually look at it.
 * - **Why the tail pivot is not the feathers' own centroid.** `pet.ts` reads
 *   `back` off `torso.origin` and `tail` off `tail.origin` directly, and
 *   `pet.test.mjs` guards a 40-unit floor between every pair of zones on every
 *   character (چرخی's 44-unit head/back pair is the tightest on the roster
 *   today). `torso.origin` sits at `[100, 176]`, the same near-the-feet hip
 *   pivot every other character's spine lean uses; a tail pivot at the
 *   feathers' own centroid would land 18–28 units away from that, inside the
 *   guard's floor. `[100, 132]` was chosen for the shoulder-line reading
 *   above, and it happens to also clear the guard by a comfortable margin
 *   (44 units from `torso`, 56 from the head zone) — the geometry did not
 *   need bending to pass the test, but the test is what caught the naive
 *   choice before it shipped.
 */
export const simorgh = {
    slug: 'simorgh', name: 'سیمرغ', role: 'راهنما',
    eyes: { x: [80, 120], y: 76, r: 11 }, lidColor: '#fbb26a', browColor: '#b45309',
    // `nearArm`/`farArm` satisfy `GAITS.fly.requires`, so this is no longer the
    // CSS fallback — it is phase-driven like بومی. No `walk`: there is still no
    // `farLeg`/`nearLeg` layer (a phoenix does not walk in this rig), so that
    // gait keeps taking the CSS body animation, unchanged from before.
    gaits: ['fly'],
    // Read off the layers below. The head is a 42-radius ball at (100, 80): the
    // eyes at (±20, −4) sit at z≈33, the brows 22 higher at z≈27 and the beak
    // 20 lower at z≈34. The tail fans out behind the body and the crest
    // feathers rise from the back of the crown.
    body3d: {
        layers: {
            tail: {
                pivot: [100, 132, -16],
                parts: [
                    { shape: 'sphere', at: [54, 152, -18], size: [30, 12, 5], rot: [0, 0, -32], color: '#ef4444' },
                    { shape: 'sphere', at: [74, 162, -17], size: [30, 11, 5], rot: [0, 0, -16], color: '#f97316' },
                    { shape: 'sphere', at: [100, 166, -16], size: [30, 11, 5], color: '#eab308' },
                    { shape: 'sphere', at: [126, 162, -17], size: [30, 11, 5], rot: [0, 0, 16], color: '#22c55e' },
                    { shape: 'sphere', at: [146, 152, -18], size: [30, 12, 5], rot: [0, 0, 32], color: '#3b82f6' },
                ],
            },
            farArm: {
                pivot: [74, 132, -10],
                parts: [
                    { shape: 'sphere', at: [52, 128, -10], size: [24, 13, 8], rot: [0, 0, -20], color: '#fb923c' },
                    { shape: 'sphere', at: [54, 126, -5], size: [17, 9, 3], rot: [0, 0, -20], color: '#fdba74', noOutline: true },
                ],
            },
            torso: {
                pivot: [100, 176, 0],
                parts: [
                    { shape: 'sphere', at: [100, 140, 0], size: [40, 42, 34], color: '#f4820f' },
                    { shape: 'sphere', at: [100, 146, 18], size: [26, 30, 16], color: '#ffe8bd' },
                    { shape: 'capsule', at: [84, 186, 4], size: [2, 8, 2], color: '#d97706' },
                    { shape: 'capsule', at: [116, 186, 4], size: [2, 8, 2], color: '#d97706' },
                ],
            },
            nearArm: {
                pivot: [126, 132, 10],
                parts: [
                    { shape: 'sphere', at: [148, 128, 10], size: [24, 13, 8], rot: [0, 0, 20], color: '#fb923c' },
                    { shape: 'sphere', at: [146, 126, 15], size: [17, 9, 3], rot: [0, 0, 20], color: '#fdba74', noOutline: true },
                ],
            },
            head: {
                pivot: [100, 112, 0],
                parts: [
                    { shape: 'sphere', at: [100, 80, 0], size: [42, 42, 38], color: '#f9852f' },
                    { shape: 'sphere', at: [84, 30, -8], size: [7, 18, 5], rot: [0, 0, -16], color: '#ef4444' },
                    { shape: 'sphere', at: [100, 26, -8], size: [7, 20, 5], color: '#eab308' },
                    { shape: 'sphere', at: [116, 30, -8], size: [7, 18, 5], rot: [0, 0, 16], color: '#3b82f6' },
                    { shape: 'sphere', at: [72, 94, 30], size: [8, 5, 1.2], rot: [0, -40, 0], color: '#fca5a5', flat: true, opacity: 0.5, noOutline: true },
                    { shape: 'sphere', at: [128, 94, 30], size: [8, 5, 1.2], rot: [0, 40, 0], color: '#fca5a5', flat: true, opacity: 0.5, noOutline: true },
                ],
            },
        },
        face: {
            layer: 'head',
            center: [100, 80, 0],
            eyes: { z: 33, iris: '#3a2410' },
            brows: { y: 58, z: 27 },
            mouth: { x: 100, y: 100, z: 34, color: '#e0850e' },
        },
        shadow: 52,
    },
    render({ emotion, intensity }) {
        const e = eyes(80, 120, 76, 11, 'smIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(80, 120, 58, emotion.brow, '#b45309');
        return {
            grads: `
      <radialGradient id="smH" cx="40%" cy="26%" r="80%"><stop offset="0" stop-color="#ffd9a0"/><stop offset=".55" stop-color="#f9852f"/><stop offset="1" stop-color="#d9660f"/></radialGradient>
      <radialGradient id="smB" cx="42%" cy="28%" r="82%"><stop offset="0" stop-color="#fbb26a"/><stop offset=".6" stop-color="#f4820f"/><stop offset="1" stop-color="#c05a0c"/></radialGradient>
      <linearGradient id="smC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d6"/><stop offset="1" stop-color="#ffe0ad"/></linearGradient>
      <radialGradient id="smIris" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="#6a4a2a"/><stop offset=".6" stop-color="#3a2410"/><stop offset="1" stop-color="#1a0e04"/></radialGradient>
      <radialGradient id="smCo" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#7a3a00" stop-opacity=".18"/></radialGradient>`,
            art: '',
            layers: {
                shadow: { art: `<ellipse cx="100" cy="188" rx="52" ry="8" fill="#000" opacity=".10"/>` },
                tail: {
                    origin: [100, 132],
                    art: `<ellipse cx="54" cy="152" rx="30" ry="12" transform="rotate(-32 54 152)" fill="#ef4444" opacity=".85"/>` +
                        `<ellipse cx="74" cy="162" rx="30" ry="11" transform="rotate(-16 74 162)" fill="#f97316" opacity=".85"/>` +
                        `<ellipse cx="100" cy="166" rx="30" ry="11" fill="#eab308" opacity=".85"/>` +
                        `<ellipse cx="126" cy="162" rx="30" ry="11" transform="rotate(16 126 162)" fill="#22c55e" opacity=".85"/>` +
                        `<ellipse cx="146" cy="152" rx="30" ry="12" transform="rotate(32 146 152)" fill="#3b82f6" opacity=".85"/>`,
                },
                farArm: {
                    origin: [74, 132],
                    art: `<ellipse cx="52" cy="128" rx="24" ry="13" transform="rotate(-20 52 128)" fill="#fb923c"/>` +
                        `<ellipse cx="54" cy="126" rx="17" ry="9" transform="rotate(-20 54 126)" fill="#fdba74"/>`,
                },
                torso: {
                    origin: [100, 176],
                    art: `<ellipse cx="100" cy="140" rx="40" ry="42" fill="url(#smB)"/><ellipse cx="100" cy="146" rx="26" ry="30" fill="url(#smC)"/><ellipse cx="100" cy="140" rx="40" ry="42" fill="url(#smCo)"/>` +
                        `<ellipse cx="100" cy="150" rx="14" ry="16" fill="#fef3c7" opacity=".5"/>` +
                        `<path d="M84 180 l-6 12 M84 180 v13 M84 180 l6 12" stroke="#d97706" stroke-width="4" stroke-linecap="round"/>` +
                        `<path d="M116 180 l-6 12 M116 180 v13 M116 180 l6 12" stroke="#d97706" stroke-width="4" stroke-linecap="round"/>`,
                },
                nearArm: {
                    origin: [126, 132],
                    art: `<ellipse cx="148" cy="128" rx="24" ry="13" transform="rotate(20 148 128)" fill="#fb923c"/>` +
                        `<ellipse cx="146" cy="126" rx="17" ry="9" transform="rotate(20 146 126)" fill="#fdba74"/>`,
                },
                head: {
                    origin: [100, 112],
                    art: `<ellipse cx="84" cy="30" rx="7" ry="18" transform="rotate(-16 84 30)" fill="#ef4444"/>` +
                        `<ellipse cx="100" cy="26" rx="7" ry="20" fill="#eab308"/>` +
                        `<ellipse cx="116" cy="30" rx="7" ry="18" transform="rotate(16 116 30)" fill="#3b82f6"/>` +
                        `<circle cx="100" cy="80" r="42" fill="url(#smH)"/><circle cx="100" cy="84" r="42" fill="url(#smCo)"/>` +
                        `<ellipse cx="100" cy="90" rx="22" ry="15" fill="url(#smC)" opacity=".55"/>` +
                        e + b +
                        `<ellipse cx="72" cy="94" rx="8" ry="5" fill="#fca5a5" opacity=".5"/><ellipse cx="128" cy="94" rx="8" ry="5" fill="#fca5a5" opacity=".5"/>` +
                        `<g id="mouthG"></g>`,
                },
            },
            mouth: { cx: 100, cy: 100, color: '#e0850e', beak: true },
        };
    },
};
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
export const charkhi = {
    slug: 'charkhi', name: 'چرخی', role: 'جاده‌ها',
    eyes: { x: [76, 124], y: 104, r: 13 }, lidColor: '#e1f5fe', browColor: '#2a2a2a',
    // No leg or arm layers exist, so `walk`/`fly` are structurally impossible —
    // `canDrive` is false for both before the declaration is even read. `roll`
    // is different: it drives `root`/`torso` only, which every character has,
    // so it is declared here. It is a chassis bob on the suspension, not the
    // wheels spinning — the wheels are still static art baked into `torso` (see
    // the class doc above), unchanged by this. See `ROLL_PHASES` in
    // `locomotion.ts` for why that is the honest scope of this gait for now.
    gaits: ['roll'],
    // A car body barely leans (small spine travel) and the antennas are rigid
    // wire, not fur, so they get noticeably less travel than the shared
    // preset — the same "narrower than default" call خرسی makes for stiff
    // round ears, applied here because the material is rigid rather than soft.
    // No headTilt/headDrop/tail/arms: there is nothing on this character for
    // those channels to land on, the same dead end بومی's headDrop reaches.
    posture: {
        sad: { spine: 2, sink: 1, ears: 18 },
        sleepy: { spine: 1, sink: 2, ears: 10 },
        excited: { spine: -2, ears: -14 },
        happy: { ears: -8 },
        thinking: { ears: 6 },
        surprised: { ears: -16 },
    },
    // Motion-engine tuning. Wire with a ball on the end whips fast and stiff,
    // not slow and floppy like fur, so the antenna springs are higher and
    // looser. The lag `limit` is measured, not picked: past ~13.9° on top of
    // the sad posture the stalk dips within 1 unit of the roofline (the same
    // floor the posture guard uses), so 10° keeps 1.09 of margin — see
    // `test/motion.test.mjs`. A car body barely pitches forward on the road.
    motion: {
        secondary: {
            layers: {
                earL: { spring: { freq: 5, damping: 0.3 }, limit: 10 },
                earR: { spring: { freq: 5, damping: 0.3 }, limit: 10 },
            },
        },
        body: { lean: { roll: 2 } },
    },
    // Read off the layers below. No head: the face rides the torso, a 70×50
    // body at (100, 122), 40 deep, with the windscreen standing 24 proud of its
    // middle. The eyes on the windscreen sit at z≈39, the brows at z≈36 and the
    // mouth on the bumper at z≈37. The wheels face the viewer, as drawn.
    body3d: {
        layers: {
            torso: {
                pivot: [100, 148, 0],
                parts: [
                    { shape: 'sphere', at: [100, 122, 0], size: [70, 50, 40], color: '#e64a19' },
                    { shape: 'sphere', at: [100, 108, 24], size: [58, 44, 16], color: '#d6f0fc' },
                    { shape: 'cylinder', at: [62, 172, 8], size: [19, 10, 19], rot: [90, 0, 0], color: '#262626' },
                    { shape: 'cylinder', at: [138, 172, 8], size: [19, 10, 19], rot: [90, 0, 0], color: '#262626' },
                    { shape: 'cylinder', at: [62, 172, 9], size: [9, 10.5, 9], rot: [90, 0, 0], color: '#9aa0a6', noOutline: true },
                    { shape: 'cylinder', at: [138, 172, 9], size: [9, 10.5, 9], rot: [90, 0, 0], color: '#9aa0a6', noOutline: true },
                ],
            },
            earL: {
                pivot: [58, 80, -6],
                parts: [
                    { shape: 'capsule', at: [51, 60, -6], size: [1.5, 40, 1.5], rot: [0, 0, -19], color: '#5a5f66' },
                    { shape: 'sphere', at: [44, 40, -6], size: [5, 5, 5], color: '#e64a19' },
                ],
            },
            earR: {
                pivot: [142, 80, -6],
                parts: [
                    { shape: 'capsule', at: [149, 60, -6], size: [1.5, 40, 1.5], rot: [0, 0, 19], color: '#5a5f66' },
                    { shape: 'sphere', at: [156, 40, -6], size: [5, 5, 5], color: '#e64a19' },
                ],
            },
        },
        face: {
            layer: 'torso',
            center: [100, 122, 0],
            eyes: { z: 39, iris: '#2e4a64' },
            brows: { y: 84, z: 36 },
            mouth: { x: 100, y: 140, z: 37, color: '#7a1f00' },
        },
        shadow: 56,
    },
    render({ emotion, intensity }) {
        const e = eyes(76, 124, 104, 13, 'chIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(76, 124, 84, emotion.brow, '#2a2a2a');
        const wheel = (cx) => `<circle cx="${cx}" cy="172" r="19" fill="#262626"/>` +
            `<circle cx="${cx}" cy="172" r="9" fill="#9aa0a6"/>` +
            `<circle cx="${cx}" cy="172" r="3" fill="#5a5f66"/>`;
        const antenna = (x0, y0, xc, yc, tx, ty) => `<path d="M${x0} ${y0} Q${xc} ${yc} ${tx} ${ty}" stroke="#5a5f66" stroke-width="3" stroke-linecap="round" fill="none"/>` +
            `<circle cx="${tx}" cy="${ty}" r="5" fill="#e64a19"/>`;
        return {
            grads: `
      <radialGradient id="chB" cx="42%" cy="22%" r="86%"><stop offset="0" stop-color="#ff8a65"/><stop offset=".55" stop-color="#e64a19"/><stop offset="1" stop-color="#a8320f"/></radialGradient>
      <linearGradient id="chG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2fbff"/><stop offset="1" stop-color="#b3e5fc"/></linearGradient>
      <radialGradient id="chIris" cx="38%" cy="28%" r="76%"><stop offset="0" stop-color="#5a7a9a"/><stop offset=".55" stop-color="#2e4a64"/><stop offset="1" stop-color="#12202e"/></radialGradient>
      <radialGradient id="chCo" cx="50%" cy="30%" r="72%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#5a1a00" stop-opacity=".2"/></radialGradient>`,
            art: '',
            layers: {
                shadow: { art: `<ellipse cx="100" cy="188" rx="56" ry="8" fill="#000" opacity=".11"/>` },
                torso: {
                    origin: [100, 148],
                    art: 
                    // The body silhouette. `charkhiAntennaClip` in probes.mjs evaluates the
                    // second and third `C` segments below directly (the left roof-shoulder
                    // ending at [58,80] and the apex running to [142,80]) rather than an
                    // approximation, so this path is the ground truth for that guard too.
                    `<path d="M40 168 C30 168 26 150 30 128 C33 108 42 92 58 80 C72 68 128 68 142 80 ` +
                        `C158 92 167 108 170 128 C174 150 170 168 160 168 Z" fill="url(#chB)"/>` +
                        wheel(62) + wheel(138) +
                        `<ellipse cx="100" cy="108" rx="58" ry="44" fill="url(#chG)"/>` +
                        `<path d="M40 168 C30 168 26 150 30 128 C33 108 42 92 58 80 C72 68 128 68 142 80 ` +
                        `C158 92 167 108 170 128 C174 150 170 168 160 168 Z" fill="url(#chCo)"/>` +
                        e + b +
                        `<g id="mouthG"></g>` +
                        `<path d="M62 140 h76" stroke="#7a1f00" stroke-width="4" stroke-linecap="round" opacity=".35"/>`,
                },
                earL: { origin: [58, 80], art: antenna(58, 80, 50, 55, 44, 40) },
                earR: { origin: [142, 80], art: antenna(142, 80, 150, 55, 156, 40) },
            },
            mouth: { cx: 100, cy: 140, color: '#7a1f00' },
        };
    },
};
/**
 * ربو — a small helper robot: a boxy head with a glass face screen on a drawn
 * neck, a body with a chest light, two jointed arms, and a wheeled base. It is
 * the roster's first machine with a face *and* limbs, so it answers the
 * authoring questions differently from چرخی:
 *
 * - **A `head` layer, because there is a neck.** The neck is a separate drawn
 *   form (torso art) and the head box sits on it, so the head/body line is the
 *   head box's bottom edge at y=102 — measured off the drawing, the same kind
 *   of answer آوا's collar gives. The neck runs from y=90 to y=112, so it
 *   stays tucked under the head across the posture `headDrop` range in both
 *   directions instead of showing a gap.
 * - **Arm layers on drawn shoulder bolts.** Each arm's `origin` is the centre
 *   of the bolt circle drawn on the body side, `[60, 122]` and `[140, 122]`.
 *   The arms are real joints that swing, so wave/point/clap/shrug use them
 *   rather than falling back to the body.
 * - **`earL`/`earR` reused for twin antennas**, as چرخی does: `ears` on
 *   `PostureSpec` is documented as "ear / antenna / tuft angle". Each root is
 *   an on-curve point of the head path's flat top edge (`H` from x=72 to
 *   x=128 at y=36), `[82, 36]` and `[118, 36]`. Because the stalks stand up
 *   from a flat edge, it would take a droop near 90° before a tip crossed back
 *   under the edge, far past the posture range below.
 * - **`roll` only.** The base is a wheel housing, static art in `torso` like
 *   چرخی's wheels. The arms make `fly` structurally drivable, but a robot
 *   flapping its arms to hover is the "structurally capable, semantically
 *   wrong" case `gaits` exists for, so it is not declared.
 */
export const robo = {
    slug: 'robo', name: 'ربو', role: 'پرسش‌ها',
    eyes: { x: [80, 120], y: 68, r: 11 }, lidColor: '#e0f7fa', browColor: '#1e1b4b',
    gaits: ['roll'],
    // Metal does not slump much, so spine travel stays small and the feeling
    // lives in the head, the antennas and the arms instead.
    posture: {
        sad: { spine: 3, sink: 1, headDrop: 4, ears: 16, arms: 14 },
        sleepy: { spine: 1, sink: 2, headTilt: 10, ears: 10, arms: 8 },
        excited: { spine: -2, ears: -14, arms: -20 },
        happy: { ears: -8, arms: -8 },
        thinking: { headTilt: -6, ears: 6 },
        surprised: { ears: -16, arms: -10 },
    },
    // Read off the layers below. The head is a rounded box, so the face is a
    // nearly flat screen: its centre is put far behind it (z −100), which keeps
    // the features looking straight out. The screen's front is at z≈27, so the
    // eyes, brows and mouth sit at z 28.
    body3d: {
        layers: {
            farArm: {
                pivot: [60, 122, -10],
                parts: [
                    { shape: 'capsule', at: [52, 137, -10], size: [5, 24, 5], rot: [0, 0, 28], color: '#6366f1' },
                    { shape: 'torus', at: [44, 160, -10], size: [6, 2.2, 200], rot: [0, 0, 10], color: '#6366f1' },
                ],
            },
            torso: {
                pivot: [100, 162, 0],
                parts: [
                    { shape: 'box', at: [100, 136, 0], size: [40, 28, 26], color: '#818cf8' },
                    { shape: 'box', at: [100, 101, -2], size: [10, 11, 8], color: '#4338ca' },
                    { shape: 'capsule', at: [100, 171, 0], size: [11, 38, 14], rot: [0, 0, 90], color: '#312e81' },
                    { shape: 'box', at: [100, 134, 26], size: [20, 14, 1.5], color: '#312e81' },
                    { shape: 'sphere', at: [100, 134, 28], size: [8, 8, 3], color: '#22d3ee' },
                    { shape: 'sphere', at: [60, 122, 0], size: [6, 6, 6], color: '#4338ca' },
                    { shape: 'sphere', at: [140, 122, 0], size: [6, 6, 6], color: '#4338ca' },
                ],
            },
            nearArm: {
                pivot: [140, 122, 10],
                parts: [
                    { shape: 'capsule', at: [148, 137, 10], size: [5, 24, 5], rot: [0, 0, -28], color: '#818cf8' },
                    { shape: 'torus', at: [156, 160, 10], size: [6, 2.2, 200], rot: [0, 0, 10], color: '#818cf8' },
                ],
            },
            earL: {
                pivot: [82, 36, -2],
                parts: [
                    { shape: 'capsule', at: [79, 27, -2], size: [1.75, 15, 1.75], rot: [0, 0, -18], color: '#4338ca' },
                    { shape: 'sphere', at: [76, 16, -2], size: [5.5, 5.5, 5.5], color: '#22d3ee' },
                ],
            },
            earR: {
                pivot: [118, 36, -2],
                parts: [
                    { shape: 'capsule', at: [121, 27, -2], size: [1.75, 15, 1.75], rot: [0, 0, 18], color: '#4338ca' },
                    { shape: 'sphere', at: [124, 16, -2], size: [5.5, 5.5, 5.5], color: '#22d3ee' },
                ],
            },
            head: {
                pivot: [100, 102, 0],
                parts: [
                    { shape: 'box', at: [100, 69, 0], size: [50, 33, 26], color: '#818cf8' },
                    { shape: 'box', at: [100, 69, 25], size: [40, 25, 2], color: '#e0f7fa' },
                    { shape: 'sphere', at: [48, 70, 0], size: [7, 7, 7], color: '#4338ca' },
                    { shape: 'sphere', at: [152, 70, 0], size: [7, 7, 7], color: '#4338ca' },
                ],
            },
        },
        face: {
            layer: 'head',
            center: [100, 69, -100],
            eyes: { z: 28, iris: '#312e81' },
            brows: { y: 52, z: 28 },
            mouth: { x: 100, y: 86, z: 28, color: '#3730a3' },
        },
        shadow: 46,
    },
    render({ emotion, intensity }) {
        const e = eyes(80, 120, 68, 11, 'rbIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(80, 120, 52, emotion.brow, '#1e1b4b');
        const antenna = (x0, tx) => `<path d="M${x0} 36 L${tx} 18" stroke="#4338ca" stroke-width="3.5" stroke-linecap="round"/>` +
            `<circle cx="${tx}" cy="16" r="5.5" fill="url(#rbL)"/>` +
            `<circle cx="${tx - 1.6}" cy="14.4" r="1.8" fill="#fff" opacity=".8"/>`;
        const arm = (x0, dir, fill) => `<path d="M${x0} 122 q${dir * 14} 10 ${dir * 16} 30" stroke="${fill}" stroke-width="10" stroke-linecap="round" fill="none"/>` +
            `<path d="M${x0 + dir * 10} 158 a7 7 0 1 0 ${dir * 12} 0" stroke="${fill}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`;
        const head = 'M72 36 H128 C142 36 150 44 150 58 V82 C150 95 142 102 128 102 H72 C58 102 50 95 50 82 V58 C50 44 58 36 72 36 Z';
        return {
            grads: `
      <linearGradient id="rbB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c7d2fe"/><stop offset=".55" stop-color="#818cf8"/><stop offset="1" stop-color="#4f46e5"/></linearGradient>
      <linearGradient id="rbG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0fdff"/><stop offset="1" stop-color="#b2ebf2"/></linearGradient>
      <radialGradient id="rbL" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#cffafe"/><stop offset=".5" stop-color="#22d3ee"/><stop offset="1" stop-color="#0891b2"/></radialGradient>
      <radialGradient id="rbIris" cx="38%" cy="28%" r="76%"><stop offset="0" stop-color="#5a6fd8"/><stop offset=".55" stop-color="#312e81"/><stop offset="1" stop-color="#14123a"/></radialGradient>
      <radialGradient id="rbCo" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1e1b4b" stop-opacity=".22"/></radialGradient>`,
            art: '',
            layers: {
                shadow: { art: `<ellipse cx="100" cy="188" rx="46" ry="7" fill="#000" opacity=".11"/>` },
                farArm: { origin: [60, 122], art: arm(60, -1, '#6366f1') },
                torso: {
                    // Where the body sits on the wheel housing; a spine lean pivots here.
                    origin: [100, 162],
                    art: `<rect x="70" y="160" width="60" height="22" rx="11" fill="#312e81"/>` +
                        `<circle cx="84" cy="171" r="4" fill="#a5b4fc"/><circle cx="100" cy="171" r="4" fill="#a5b4fc"/><circle cx="116" cy="171" r="4" fill="#a5b4fc"/>` +
                        `<rect x="90" y="90" width="20" height="22" rx="4" fill="#4338ca"/>` +
                        `<rect x="60" y="108" width="80" height="56" rx="18" fill="url(#rbB)"/>` +
                        `<rect x="60" y="108" width="80" height="56" rx="18" fill="url(#rbCo)"/>` +
                        `<rect x="80" y="120" width="40" height="28" rx="8" fill="#312e81" opacity=".85"/>` +
                        `<circle cx="100" cy="134" r="8" fill="url(#rbL)"/>` +
                        `<circle cx="97.5" cy="131.5" r="2.4" fill="#fff" opacity=".85"/>` +
                        `<circle cx="60" cy="122" r="6" fill="#4338ca"/><circle cx="140" cy="122" r="6" fill="#4338ca"/>` +
                        `<path d="M86 156 h28" stroke="#312e81" stroke-width="3" stroke-linecap="round" opacity=".4"/>`,
                },
                nearArm: { origin: [140, 122], art: arm(140, 1, 'url(#rbB)') },
                earL: { origin: [82, 36], art: antenna(82, 76) },
                earR: { origin: [118, 36], art: antenna(118, 124) },
                head: {
                    // The bottom edge of the head box, where it sits on the drawn neck.
                    origin: [100, 102],
                    art: `<circle cx="48" cy="70" r="7" fill="#4338ca"/><circle cx="152" cy="70" r="7" fill="#4338ca"/>` +
                        `<path d="${head}" fill="url(#rbB)"/>` +
                        `<path d="${head}" fill="url(#rbCo)"/>` +
                        `<rect x="60" y="44" width="80" height="50" rx="16" fill="url(#rbG)"/>` +
                        `<path d="M66 50 q10 -3 22 -2" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7" fill="none"/>` +
                        e + b +
                        `<ellipse cx="70" cy="82" rx="5.5" ry="3.5" fill="#f472b6" opacity=".45"/><ellipse cx="130" cy="82" rx="5.5" ry="3.5" fill="#f472b6" opacity=".45"/>` +
                        `<g id="mouthG"></g>`,
                },
            },
            mouth: { cx: 100, cy: 86, color: '#3730a3' },
        };
    },
};
/**
 * `role` reconciled against KoodakBook's `kit.tsx` module hosting, 2026-09.
 * The two used to disagree (پشمک `صداها`/sounds hosting stories, لاکی
 * `شمارش`/counting hosting review, تندپا `رنگ‌ها`/colours hosting games,
 * خرسی `احساس‌ها`/emotions hosting math) — two independent taxonomies for the
 * same fact, drifted apart. `role` is not read by the app anywhere (grep
 * confirms it), so the app's module assignment is the one that actually
 * matters; `role` now just describes it. چرخی's `جاده‌ها`/roads is
 * unchanged and unmapped in `kit.tsx` on purpose — it is not a module host,
 * it is meant for the home screen's journey-path illustration (see the
 * KoodakBook redesign plan doc), which is a placement decision, not a role
 * one.
 */
/** The built-in roster, keyed by slug. */
export const CHARACTERS = {
    roozi, ava, pashmak, laki, tondpa, boomi, khersi, simorgh, charkhi, robo,
};
/** `CHARACTERS`' own keys, so the roster list can never drift from the registry it lists. */
export const CHARACTER_SLUGS = Object.keys(CHARACTERS);
//# sourceMappingURL=index.js.map
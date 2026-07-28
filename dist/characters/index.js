import { eyes, brows } from '../draw.js';
/**
 * The character roster. Each spec renders illustration-grade "premium flat"
 * art — form gradients + a core-shadow overlay for volume, rim light, sculpted
 * eyes, blush and secondary detail — and exposes the rig hooks
 * (`.iris`, `.browsG`, `#mouthG`). Core-shadow gradient ids are namespaced per
 * character so multiple characters can share one document.
 */
export const roozi = {
    slug: 'roozi', name: 'روزی', role: 'واژه‌ها',
    eyes: { x: [83, 117], y: 74, r: 11 }, lidColor: '#f7902f', browColor: '#8a3a12',
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
            art: `<ellipse cx="100" cy="188" rx="52" ry="8" fill="#000" opacity=".10"/>
      <path d="M150 150c30-4 40-32 32-54-16 18-26 22-46 32z" fill="url(#fxT)"/>
      <path d="M172 108c-6 14-16 22-30 25l9 15c16-6 24-22 21-40z" fill="url(#fxC)" opacity=".92"/>
      <ellipse cx="100" cy="138" rx="44" ry="38" fill="url(#fxB)"/><ellipse cx="100" cy="150" rx="27" ry="22" fill="url(#fxC)"/><ellipse cx="100" cy="150" rx="44" ry="38" fill="url(#coS)"/>
      <ellipse cx="80" cy="172" rx="12" ry="8" fill="url(#fxB)"/><ellipse cx="120" cy="172" rx="12" ry="8" fill="url(#fxB)"/>
      <path d="M62 56 L54 14 L92 40 Z" fill="url(#fxE)"/><path d="M138 56 L146 14 L108 40 Z" fill="url(#fxE)"/>
      <path d="M66 48 L62 24 L86 42 Z" fill="#9a3a10"/><path d="M134 48 L138 24 L114 42 Z" fill="#9a3a10"/>
      <circle cx="100" cy="78" r="42" fill="url(#fxH)"/>
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
            mouth: { cx: 100, cy: 104, color: '#4a1608' },
        };
    },
};
export const ava = {
    slug: 'ava', name: 'آوا', role: 'هم‌صحبت',
    eyes: { x: [86, 114], y: 90, r: 10 }, lidColor: '#f4c39c', browColor: '#5b3826',
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
            art: `<ellipse cx="100" cy="188" rx="44" ry="7" fill="#000" opacity=".10"/>
      <path d="M64 190c0-28 14-46 36-46s36 18 36 46z" fill="url(#avSh)"/>
      <path d="M64 190c0-28 14-46 36-46 -12 6 -18 24 -18 46z" fill="#000" opacity=".08"/>
      <circle cx="78" cy="166" r="4.5" fill="#fff" opacity=".8"/><circle cx="100" cy="176" r="4.5" fill="#fff" opacity=".8"/><circle cx="122" cy="166" r="4.5" fill="#fff" opacity=".8"/>
      <path d="M55 92c0-30 20-50 45-50s45 20 45 50c0-10-7-17-12-19 2 6 2 11 0 15-4-13-14-22-33-22s-29 9-33 22c-2-4-2-9 0-15-5 2-12 9-12 19z" fill="url(#avHair)"/>
      <circle cx="100" cy="90" r="45" fill="url(#avS)"/>
      <path d="M58 92c0 15 5 25 11 29-4-11-4-21-2-29z" fill="url(#avHair)"/><path d="M142 92c0 15-5 25-11 29 4-11 4-21 2-29z" fill="url(#avHair)"/>
      <circle cx="100" cy="94" r="45" fill="url(#avCo)"/>
      <circle cx="72" cy="64" r="8" fill="#ffcf4d"/><circle cx="72" cy="64" r="3.5" fill="#fff2c4"/>
      ${e}
      ${b}
      <ellipse cx="76" cy="104" rx="7" ry="4.6" fill="#fb7aa8" opacity=".7"/><ellipse cx="124" cy="104" rx="7" ry="4.6" fill="#fb7aa8" opacity=".7"/>
      <path d="M97 96 q3 4 6 0" stroke="#c98a6a" stroke-width="1.4" stroke-linecap="round" fill="none"/>
      <g id="mouthG"></g>`,
            mouth: { cx: 100, cy: 112, color: '#b03a4a' },
        };
    },
};
export const pashmak = {
    slug: 'pashmak', name: 'پشمک', role: 'صداها',
    eyes: { x: [80, 116], y: 76, r: 11 }, lidColor: '#c9d5e4', browColor: '#5a6b80',
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
            art: `<ellipse cx="98" cy="188" rx="50" ry="8" fill="#000" opacity=".10"/>
      <path d="M150 156c30-2 44-28 33-50-10 20-24 27-44 30z" fill="url(#pkB)"/>
      <ellipse cx="98" cy="142" rx="45" ry="36" fill="url(#pkB)"/><ellipse cx="98" cy="152" rx="28" ry="20" fill="url(#pkC)"/><ellipse cx="98" cy="150" rx="45" ry="36" fill="url(#pkCo)"/>
      <path d="M62 52 L54 12 L92 38 Z" fill="url(#pkH)"/><path d="M134 52 L142 12 L104 38 Z" fill="url(#pkH)"/>
      <path d="M66 46 L61 22 L84 40 Z" fill="url(#pkEar)"/><path d="M130 46 L135 22 L112 40 Z" fill="url(#pkEar)"/>
      <circle cx="98" cy="80" r="43" fill="url(#pkH)"/>
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
            mouth: { cx: 99, cy: 104, color: '#3a4a5e' },
        };
    },
};
export const laki = {
    slug: 'laki', name: 'لاکی', role: 'شمارش',
    eyes: { x: [90, 110], y: 54, r: 9 }, lidColor: '#84e6a0', browColor: '#188a3e',
    render({ emotion, intensity }) {
        const e = eyes(90, 110, 54, 9, 'lkIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(90, 110, 42, emotion.brow, '#188a3e');
        return {
            grads: `
      <radialGradient id="lkSh" cx="42%" cy="22%" r="84%"><stop offset="0" stop-color="#7ff0a3"/><stop offset=".55" stop-color="#1fa94f"/><stop offset="1" stop-color="#137a37"/></radialGradient>
      <radialGradient id="lkShIn" cx="42%" cy="22%" r="82%"><stop offset="0" stop-color="#b6f7cc"/><stop offset="1" stop-color="#5fd884"/></radialGradient>
      <radialGradient id="lkH" cx="40%" cy="28%" r="80%"><stop offset="0" stop-color="#c9f7d6"/><stop offset=".6" stop-color="#84e6a0"/><stop offset="1" stop-color="#41c46e"/></radialGradient>
      <radialGradient id="lkIris" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="#2e6b3d"/><stop offset="1" stop-color="#0e3a1f"/></radialGradient>
      <radialGradient id="lkCo" cx="50%" cy="34%" r="64%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0e5a2c" stop-opacity=".2"/></radialGradient>`,
            art: `<ellipse cx="100" cy="182" rx="70" ry="8" fill="#000" opacity=".11"/>
      <ellipse cx="52" cy="156" rx="13" ry="10" fill="url(#lkH)"/><ellipse cx="148" cy="156" rx="13" ry="10" fill="url(#lkH)"/>
      <ellipse cx="74" cy="166" rx="13" ry="10" fill="url(#lkH)"/><ellipse cx="126" cy="166" rx="13" ry="10" fill="url(#lkH)"/>
      <path d="M38 142c0-40 28-66 62-66s62 26 62 66z" fill="url(#lkSh)"/>
      <path d="M52 142c0-30 20-52 48-52s48 22 48 52z" fill="url(#lkShIn)"/>
      <path d="M100 90v52 M68 104l18 38 M132 104l-18 38 M62 124h76" stroke="#0f6b30" stroke-width="4" stroke-linecap="round"/>
      <path d="M60 104c14-10 66-10 80 0" stroke="#fff" stroke-opacity=".28" stroke-width="4" stroke-linecap="round" fill="none"/>
      <circle cx="100" cy="58" r="28" fill="url(#lkH)"/><circle cx="100" cy="60" r="28" fill="url(#lkCo)"/>
      ${e}
      ${b}
      <ellipse cx="82" cy="66" rx="5" ry="3.4" fill="#fb6f92" opacity=".55"/><ellipse cx="118" cy="66" rx="5" ry="3.4" fill="#fb6f92" opacity=".55"/>
      <g id="mouthG"></g>`,
            mouth: { cx: 100, cy: 72, color: '#0f5a29' },
        };
    },
};
export const tondpa = {
    slug: 'tondpa', name: 'تندپا', role: 'رنگ‌ها',
    eyes: { x: [84, 116], y: 82, r: 11 }, lidColor: '#e4eaf1', browColor: '#8a93a8',
    render({ emotion, intensity }) {
        const e = eyes(84, 116, 82, 11, 'tpIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(84, 116, 66, emotion.brow, '#8a93a8');
        return {
            grads: `
      <radialGradient id="tpB" cx="42%" cy="26%" r="82%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e4eaf1"/><stop offset="1" stop-color="#c2cddb"/></radialGradient>
      <radialGradient id="tpEar" cx="50%" cy="22%" r="82%"><stop offset="0" stop-color="#ffd0e6"/><stop offset="1" stop-color="#f78cbf"/></radialGradient>
      <radialGradient id="tpIris" cx="36%" cy="26%" r="80%"><stop offset="0" stop-color="#7a86a8"/><stop offset=".55" stop-color="#3f4a68"/><stop offset="1" stop-color="#1c2338"/></radialGradient>
      <radialGradient id="tpCo" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3a4560" stop-opacity=".15"/></radialGradient>`,
            art: `<ellipse cx="100" cy="188" rx="48" ry="8" fill="#000" opacity=".10"/>
      <ellipse cx="100" cy="150" rx="40" ry="34" fill="url(#tpB)"/><ellipse cx="100" cy="158" rx="24" ry="20" fill="#fdfdff"/><ellipse cx="100" cy="152" rx="40" ry="34" fill="url(#tpCo)"/>
      <ellipse cx="80" cy="178" rx="13" ry="8" fill="url(#tpB)"/><ellipse cx="120" cy="178" rx="13" ry="8" fill="url(#tpB)"/>
      <path d="M78 60 C70 20 78 8 84 8 C92 8 92 30 90 58 Z" fill="url(#tpB)"/><path d="M122 60 C130 20 122 8 116 8 C108 8 108 30 110 58 Z" fill="url(#tpB)"/>
      <path d="M80 56 C74 26 80 16 84 16 C89 16 89 34 87 55 Z" fill="url(#tpEar)"/><path d="M120 56 C126 26 120 16 116 16 C111 16 111 34 113 55 Z" fill="url(#tpEar)"/>
      <circle cx="100" cy="86" r="41" fill="url(#tpB)"/><circle cx="66" cy="96" r="13" fill="url(#tpB)"/><circle cx="134" cy="96" r="13" fill="url(#tpB)"/><circle cx="100" cy="88" r="41" fill="url(#tpCo)"/>
      ${e}
      ${b}
      <ellipse cx="74" cy="98" rx="6.5" ry="4.2" fill="#fb6f92" opacity=".6"/><ellipse cx="126" cy="98" rx="6.5" ry="4.2" fill="#fb6f92" opacity=".6"/>
      <path d="M94 96 L106 96 L100 102 Z" fill="#ff6f9d"/><ellipse cx="98" cy="97.5" rx="1.4" ry="1" fill="#fff" opacity=".6"/>
      <path d="M100 102 v5" stroke="#c04a72" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>
      <g id="mouthG"></g>`,
            mouth: { cx: 100, cy: 110, color: '#a01a52' },
        };
    },
};
export const boomi = {
    slug: 'boomi', name: 'بومی', role: 'حروف',
    eyes: { x: [80, 120], y: 84, r: 15 }, lidColor: '#d4ddff', browColor: '#4a4bb0',
    render({ emotion, intensity }) {
        const e = eyes(80, 120, 84, 15, 'bmIris', emotion.squint * intensity, emotion.wide * intensity);
        const b = brows(80, 120, 58, emotion.brow, '#4a4bb0');
        return {
            grads: `
      <radialGradient id="bmB" cx="42%" cy="24%" r="84%"><stop offset="0" stop-color="#9aa4fb"/><stop offset=".55" stop-color="#5f68e6"/><stop offset="1" stop-color="#3a30b0"/></radialGradient>
      <linearGradient id="bmBe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8ecff"/><stop offset="1" stop-color="#c3ccf8"/></linearGradient>
      <radialGradient id="bmD" cx="42%" cy="30%" r="74%"><stop offset="0" stop-color="#fbfcff"/><stop offset="1" stop-color="#d4ddff"/></radialGradient>
      <radialGradient id="bmIris" cx="38%" cy="28%" r="74%"><stop offset="0" stop-color="#c9822e"/><stop offset=".5" stop-color="#8a4e14"/><stop offset="1" stop-color="#2a1a0a"/></radialGradient>
      <linearGradient id="bmBk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd15a"/><stop offset="1" stop-color="#f19100"/></linearGradient>
      <radialGradient id="bmCo" cx="50%" cy="32%" r="66%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#241a80" stop-opacity=".2"/></radialGradient>`,
            art: `<ellipse cx="100" cy="186" rx="50" ry="8" fill="#000" opacity=".11"/>
      <path d="M84 176 l-7 10 M84 176 v12 M84 176 l7 10" stroke="#e08a00" stroke-width="4" stroke-linecap="round"/>
      <path d="M116 176 l-7 10 M116 176 v12 M116 176 l7 10" stroke="#e08a00" stroke-width="4" stroke-linecap="round"/>
      <path d="M58 66 L48 30 L80 56 Z" fill="url(#bmB)"/><path d="M142 66 L152 30 L120 56 Z" fill="url(#bmB)"/>
      <g class="wingL"><path d="M50 104 q-12 30 8 52 q-16 -8 -20 -30 q-2 -16 12 -22z" fill="#3a30b0"/></g>
      <g class="wingR"><path d="M150 104 q12 30 -8 52 q16 -8 20 -30 q2 -16 -12 -22z" fill="#3a30b0"/></g>
      <ellipse cx="100" cy="118" rx="50" ry="58" fill="url(#bmB)"/><ellipse cx="100" cy="130" rx="31" ry="40" fill="url(#bmBe)"/>
      <ellipse cx="100" cy="118" rx="50" ry="58" fill="url(#bmCo)"/>
      <circle cx="80" cy="84" r="26" fill="url(#bmD)"/><circle cx="120" cy="84" r="26" fill="url(#bmD)"/>
      <circle cx="80" cy="84" r="26" fill="none" stroke="#b9c4f5" stroke-width="1.5"/><circle cx="120" cy="84" r="26" fill="none" stroke="#b9c4f5" stroke-width="1.5"/>
      ${e}
      ${b}
      <g id="mouthG"></g>`,
            mouth: { cx: 100, cy: 104, color: '#f19100', beak: true },
        };
    },
};
export const khersi = {
    slug: 'khersi', name: 'خرسی', role: 'احساس‌ها',
    eyes: { x: [84, 116], y: 80, r: 10.5 }, lidColor: '#c79f63', browColor: '#6a4526',
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
            art: `<ellipse cx="100" cy="188" rx="50" ry="8" fill="#000" opacity=".11"/>
      <circle cx="66" cy="50" r="18" fill="url(#khEar)"/><circle cx="134" cy="50" r="18" fill="url(#khEar)"/>
      <circle cx="66" cy="50" r="10" fill="#d9ac74"/><circle cx="134" cy="50" r="10" fill="#d9ac74"/>
      <ellipse cx="100" cy="150" rx="44" ry="36" fill="url(#khB)"/><ellipse cx="100" cy="158" rx="25" ry="22" fill="#dcc7a0"/><ellipse cx="100" cy="152" rx="44" ry="36" fill="url(#khCo)"/>
      <ellipse cx="78" cy="178" rx="13" ry="8" fill="url(#khB)"/><ellipse cx="122" cy="178" rx="13" ry="8" fill="url(#khB)"/>
      <circle cx="100" cy="86" r="43" fill="url(#khHh)"/><circle cx="100" cy="90" r="43" fill="url(#khCo)"/>
      <ellipse cx="100" cy="104" rx="25" ry="18" fill="url(#khM)"/>
      ${e}
      ${b}
      <ellipse cx="74" cy="98" rx="7" ry="4.6" fill="#f0a0a0" opacity=".6"/><ellipse cx="126" cy="98" rx="7" ry="4.6" fill="#f0a0a0" opacity=".6"/>
      <ellipse cx="100" cy="98" rx="7.5" ry="5.4" fill="#3b2314"/><ellipse cx="97.4" cy="96" rx="1.9" ry="1.4" fill="#fff" opacity=".5"/>
      <path d="M100 104 v6" stroke="#6a4526" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>
      <g id="mouthG"></g>`,
            mouth: { cx: 100, cy: 116, color: '#5a3a1e' },
        };
    },
};
/** The built-in roster, keyed by slug. */
export const CHARACTERS = {
    roozi, ava, pashmak, laki, tondpa, boomi, khersi,
};
export const CHARACTER_SLUGS = Object.keys(CHARACTERS);
//# sourceMappingURL=index.js.map
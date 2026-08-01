/**
 * The character picker — the roster, and one framework-agnostic implementation
 * of choosing from it.
 *
 * There are two pickers in this repo: this one, and `CharacterPicker` in
 * `react.tsx`. That is a deliberate duplication of *markup* and an equally
 * deliberate refusal to duplicate *content*: both call {@link characterRoster}
 * and neither has a list of characters in it. A picker that hardcoded its own
 * roster is how سیمرغ ends up missing from one of them for three releases, so
 * `test/picker.test.mjs` enumerates both and asserts they agree.
 *
 * Each entry carries a real rendered SVG rather than a name, because a picker
 * that shows the characters is worth more than one that lists them — and
 * because it comes free: `renderActorSVG` is the same static renderer the rig
 * mounts, so a thumbnail cannot drift from the thing it stands for.
 */
import { CHARACTERS, CHARACTER_SLUGS } from './characters/index.js';
import { renderActorSVG } from './render.js';
import { defaultFrame } from './types.js';
/**
 * The full roster, with a thumbnail per character.
 *
 * Order follows `CHARACTER_SLUGS`, which is the roster's own order — not
 * alphabetical, and not the object key order of `CHARACTERS`, which is an
 * implementation detail that has changed before.
 */
export function characterRoster({ size = 72, emotion = 'happy', intensity = 0.8 } = {}) {
    return CHARACTER_SLUGS.map((slug) => {
        const spec = CHARACTERS[slug];
        return {
            slug,
            name: spec.name,
            svg: renderActorSVG(spec, { ...defaultFrame(slug), emotion, intensity }, size),
            gaits: spec.gaits ?? [],
            optsOut: spec.gestureFallback ?? [],
        };
    });
}
/**
 * Render a picker into `host`.
 *
 * Plain DOM, no framework, no styles beyond the class names — a picker that
 * shipped its own stylesheet would fight every host it is dropped into. The
 * classes are `ca-picker`, `ca-picker-item` and `ca-picker-item.is-selected`.
 */
export function createCharacterPicker(host, { value, onSelect, className, ...roster } = {}) {
    const entries = characterRoster(roster);
    let current = value && entries.some((e) => e.slug === value) ? value : entries[0].slug;
    const doc = host.ownerDocument;
    const box = doc.createElement('div');
    box.className = className ? `ca-picker ${className}` : 'ca-picker';
    box.setAttribute('role', 'radiogroup');
    box.setAttribute('aria-label', 'character');
    const buttons = new Map();
    for (const e of entries) {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'ca-picker-item';
        b.dataset.slug = e.slug;
        b.setAttribute('role', 'radio');
        // The name is the accessible label; the thumbnail is decoration, so it is
        // hidden from assistive tech rather than read out as a wall of <path>.
        b.setAttribute('aria-label', e.name);
        b.innerHTML = `<span aria-hidden="true">${e.svg}</span><span class="ca-picker-name">${e.name}</span>`;
        b.addEventListener('click', () => {
            select(e.slug);
            onSelect?.(e.slug);
        });
        buttons.set(e.slug, b);
        box.appendChild(b);
    }
    function select(slug) {
        current = slug;
        for (const [s, b] of buttons) {
            const on = s === slug;
            b.classList.toggle('is-selected', on);
            b.setAttribute('aria-checked', String(on));
            // Roving tabindex: the group is one tab stop, arrow keys move within it.
            b.tabIndex = on ? 0 : -1;
        }
    }
    select(current);
    box.addEventListener('keydown', (ev) => {
        const step = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1
            : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
        if (step === 0)
            return;
        ev.preventDefault();
        const i = entries.findIndex((e) => e.slug === current);
        const next = entries[(i + step + entries.length) % entries.length].slug;
        select(next);
        buttons.get(next)?.focus();
        onSelect?.(next);
    });
    host.appendChild(box);
    return {
        setValue: select,
        get value() { return current; },
        destroy() { box.remove(); },
    };
}
//# sourceMappingURL=picker.js.map
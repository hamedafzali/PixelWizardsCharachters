/**
 * Sculpted eye pair — the single biggest appeal lever. A white sclera + a
 * gradient iris/pupil that the rig can translate (gaze) + fixed corneal
 * catchlights + an upper-lid shadow + a lower lid that rises for a squint.
 *
 * Rig hooks: each iris is a `<g class="iris" data-r="R">` the rig translates;
 * lower lids carry `.lidLo`. `squint`/`wide` are 0..1 (already scaled by
 * emotion intensity by the caller).
 */
export function eyes(x1, x2, y, r, irisId, squint = 0, wide = 0) {
    const R = r * (1 + wide * 0.12);
    const one = (cx) => {
        const id = `cl${Math.round(cx)}_${Math.round(y)}`;
        return (`<clipPath id="${id}"><ellipse cx="${cx}" cy="${y}" rx="${R * 1.1}" ry="${R * 1.28}"/></clipPath>` +
            `<ellipse cx="${cx}" cy="${y}" rx="${R * 1.1}" ry="${R * 1.28}" fill="#fdfdff"/>` +
            `<g clip-path="url(#${id})">` +
            `<g class="iris" data-r="${R}"><circle cx="${cx}" cy="${y}" r="${R * 0.82}" fill="url(#${irisId})"/>` +
            `<circle cx="${cx}" cy="${y + R * 0.05}" r="${R * 0.48}" fill="#140c05"/></g>` +
            `<ellipse cx="${cx}" cy="${y - R * 1.02}" rx="${R * 1.32}" ry="${R * 0.82}" fill="#2a1e12" opacity="0.15"/>` +
            `<ellipse class="lidLo" cx="${cx}" cy="${y + R * 1.32}" rx="${R * 1.32}" ry="${R * (0.5 + squint)}" fill="var(--lidfill)"/>` +
            `</g>` +
            `<circle cx="${cx - R * 0.32}" cy="${y - R * 0.36}" r="${R * 0.3}" fill="#fff"/>` +
            `<circle cx="${cx + R * 0.28}" cy="${y + R * 0.3}" r="${R * 0.14}" fill="#fff" opacity="0.85"/>` +
            `<ellipse cx="${cx}" cy="${y}" rx="${R * 1.1}" ry="${R * 1.28}" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="1"/>`);
    };
    return one(x1) + one(x2);
}
/**
 * Eyebrow pair, wrapped in a single `<g class="browsG">` the rig can translate
 * for the independent `browRaise` channel. Brows carry most of the readable
 * emotion at a glance, so each mood gets a distinct pose.
 */
export function brows(x1, x2, y, browKey, color) {
    const w = 8;
    const W = 2.6;
    const seg = (cx, ang, dy) => `<path d="M${cx - w} ${y + dy + ang} Q ${cx} ${y + dy - 2} ${cx + w} ${y + dy - ang}" stroke="${color}" stroke-width="${W}" stroke-linecap="round" fill="none"/>`;
    const inner = (cx, side) => `<path d="M${cx - w} ${y + 2} Q ${cx} ${y - 1} ${cx + w} ${y + (side < 0 ? -4 : 4)}" stroke="${color}" stroke-width="${W}" stroke-linecap="round" fill="none"/>`;
    let s;
    if (browKey === 'excited' || browKey === 'surprised')
        s = seg(x1, -4, -5) + seg(x2, 4, -5);
    else if (browKey === 'happy' || browKey === 'encouraging')
        s = seg(x1, -2, -3) + seg(x2, 2, -3);
    else if (browKey === 'thinking')
        s =
            `<path d="M${x1 - w} ${y} Q ${x1} ${y - 6} ${x1 + w} ${y - 5}" stroke="${color}" stroke-width="${W}" stroke-linecap="round" fill="none"/>` +
                seg(x2, 2, -1);
    else if (browKey === 'sad')
        s = inner(x1, -1) + inner(x2, 1);
    else if (browKey === 'sleepy')
        s = seg(x1, 1, 3) + seg(x2, -1, 3);
    else
        s = seg(x1, -1, 0) + seg(x2, 1, 0);
    return `<g class="browsG">${s}</g>`;
}
//# sourceMappingURL=draw.js.map
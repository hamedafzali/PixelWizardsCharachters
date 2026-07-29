import { resolveEmotion } from './emotions.js';
import { VISEMES } from './visemes.js';
/**
 * Build the mouth `<path>`/`<g>` markup for a viseme + explicit openness. The
 * rig calls this every frame and swaps it into `#mouthG`, so lip-sync is a
 * cheap innerHTML update rather than a full re-render.
 *
 * `beak` characters (owls) draw a two-tone beak instead of lips.
 */
export function drawMouth(mouth, viseme, mouthOpen) {
    const { cx, cy, color, beak } = mouth;
    const o = Math.max(viseme.o, mouthOpen);
    const w = (viseme.w ?? 1) / (viseme.r ?? 1);
    if (beak) {
        const open = 3 + o * 9;
        return (`<path d="M${cx - 11 * w} ${cy} Q ${cx} ${cy - 6} ${cx + 11 * w} ${cy} Q ${cx} ${cy + 2} ${cx - 11 * w} ${cy} Z" fill="#f19100"/>` +
            `<path d="M${cx - 9 * w} ${cy + 1} Q ${cx} ${cy + 2 + open} ${cx + 9 * w} ${cy + 1} Q ${cx} ${cy + open} ${cx - 9 * w} ${cy + 1} Z" fill="#d97a00"/>`);
    }
    if (viseme.closed || o < 0.06) {
        // A gentle closed smile.
        return `<path d="M${cx - 9 * w} ${cy} Q ${cx} ${cy + 5} ${cx + 9 * w} ${cy}" stroke="${color}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
    }
    const rx = 9 * w;
    const ry = 2 + o * 7;
    const parts = [
        `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}"/>`,
    ];
    if (viseme.tongue && o > 0.3) {
        parts.push(`<ellipse cx="${cx}" cy="${cy + ry * 0.4}" rx="${rx * 0.5}" ry="${ry * 0.5}" fill="#ff7a95"/>`);
    }
    if (viseme.tuck) {
        parts.push(`<rect x="${cx - rx}" y="${cy}" width="${rx * 2}" height="${ry + 1}" rx="1.5" fill="#f4f4f7" opacity=".9"/>`);
    }
    else if (o > 0.25) {
        // Upper teeth.
        parts.push(`<rect x="${cx - rx * 0.86}" y="${cy - ry}" width="${rx * 1.72}" height="${Math.min(ry * 0.7, 3)}" rx="1.2" fill="#fff"/>`);
    }
    return parts.join('');
}
/** One layer group, carrying its own pivot so transforms on it turn correctly. */
function layerG(cls, layer, inner = '') {
    if (!layer && !inner)
        return '';
    const o = layer?.origin;
    const style = o ? ` style="transform-origin:${o[0]}px ${o[1]}px"` : '';
    // `inner` paints *behind* this layer's own art. The only caller that passes it
    // is the head, whose ears must sit behind the skull exactly as they did in the
    // original flat art — painting them after put the base of every ear triangle
    // on top of the forehead.
    return `<g class="${cls}"${style}>${inner}${layer?.art ?? ''}</g>`;
}
/**
 * Assemble the articulated tree from a character's layers.
 *
 * Far limbs are painted before the torso art and near limbs after it, so depth
 * reads correctly while every limb stays independently rotatable. The head is a
 * *child* of the torso — bow the spine and the head follows, as it should.
 */
function buildLayers(l) {
    // Ears sit behind the head art and ride it: tilt the head, the ears go too.
    const ears = layerG('lyr-earL', l.earL) + layerG('lyr-earR', l.earR);
    // A character with no visible neck declares no head layer, and its face rides
    // the torso. The ears must then hang off the torso directly — wrapping them in
    // an implicit `.lyr-head` would resurrect the layer with *no* origin, so it
    // would pivot about its own bounding-box centre and posture's headDrop would
    // land on it after all. That is exactly the improvised pivot the no-head rule
    // exists to prevent.
    const head = l.head ? layerG('lyr-head', l.head, ears) : ears;
    const torsoInner = layerG('lyr-tail', l.tail) +
        layerG('lyr-farArm', l.farArm) +
        layerG('lyr-farLeg', l.farLeg);
    // `torsoFront` is torso art that must occlude the head: a shell rim, a collar,
    // a scarf. It is *inside* `.lyr-torso`, so it leans with the spine and stays
    // registered with the rest of the body — an outer sibling would slide off the
    // torso the moment posture moved it. It is the only way a head can tuck
    // *behind* the body without inverting the order for every other character,
    // which needs the head in front.
    const torsoAfter = layerG('lyr-nearLeg', l.nearLeg) +
        layerG('lyr-nearArm', l.nearArm) +
        head +
        layerG('lyr-torsoFront', l.torsoFront);
    const o = l.torso?.origin;
    const torsoStyle = o ? ` style="transform-origin:${o[0]}px ${o[1]}px"` : '';
    const torso = `<g class="lyr-torso"${torsoStyle}>` +
        `${torsoInner}${l.torso?.art ?? ''}${torsoAfter}` +
        `</g>`;
    return layerG('lyr-accBack', l.accBack) + torso + layerG('lyr-accFront', l.accFront);
}
/**
 * Render a complete, self-contained `<svg>` for one frame. This is the pure /
 * stateless path — handy for SSR, thumbnails and tests. The interactive
 * {@link ActorRig} renders once with this then mutates in place.
 *
 * The art space is 200×200; pass `size` for the pixel box.
 *
 * Three nested transform carriers sit between the flip and the art —
 * `.rig-root` (locomotion), `.rig-body` (gesture + squash/stretch) and
 * `.rig-mood` (emotion idle). They exist so those three channels compose
 * instead of overwriting one shared `transform`, and they are emitted for
 * layered and unlayered characters alike.
 *
 * `emotions` (optional) tunes the emotion presets per character — an editor can
 * override any channel of any emotion.
 */
export function renderActorSVG(spec, frame, size = 120, emotions) {
    const emotion = resolveEmotion(frame.emotion, emotions);
    const { grads, art, layers, mouth } = spec.render({ emotion, intensity: frame.intensity });
    const viseme = VISEMES[frame.viseme];
    const mouthMarkup = drawMouth(mouth, viseme, frame.mouthOpen);
    const shadow = layers ? layerG('lyr-shadow', layers.shadow) : '';
    const inner = layers ? buildLayers(layers) : art;
    if (!layers && !art)
        return '';
    const body = `${shadow}<g class="rig-root"><g class="rig-body"><g class="rig-mood">${inner}</g></g></g>`;
    const mounted = body.replace('<g id="mouthG"></g>', `<g id="mouthG">${mouthMarkup}</g>`);
    const flip = frame.facing === 'left' ? ' transform="scale(-1,1) translate(-200,0)"' : '';
    return (`<svg width="${size}" height="${size}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" ` +
        `style="--lidfill:${spec.lidColor}" data-character="${spec.slug}">` +
        `<defs>${grads}</defs>` +
        `<g class="rig-flip"${flip}>${mounted}</g>` +
        `</svg>`);
}
//# sourceMappingURL=render.js.map
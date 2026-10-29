# Character references for Google Flow

`npm run export:flow` renders every character in this package as a set of
reference images for Google Flow (Veo 3.1), with metadata and a prompt
template for each. It reads the source; it never changes it.

## How the characters are stored

The characters are **code, not image files**. There are no PNG, sprite or
model files for them in this repository.

| What | Where | What it is |
|---|---|---|
| 2D art | `src/characters/index.ts`, one `CharacterSpec` per character | Procedural SVG: `render()` returns SVG markup (gradients, paths, ellipses) in a 200×200 box, split into rig layers (head, torso, arms…). This is the original drawing and the authority for every view below. |
| 3D model | the same spec's `body3d` | Primitives (spheres, capsules, boxes…) per layer, which `pixel-wizards-charachters/three` builds with three.js and skins with the 2D art. The front matches the drawing. Sides and back are the renderer's extrapolation; no artist drew them. |
| Static render | `renderActorSVG(spec, frame)` | Standalone SVG of one frame, at rest. |
| Emotions | `src/emotions.ts` (`EMOTIONS`) | 12: neutral, happy, excited, thinking, encouraging, sad, surprised, sleepy, love, confused, proud, shy. They move the eyes, lids, brows, gaze and posture. **The resting mouth is the same in every emotion**, and there is **no "worried"**. |

So the export renders the characters rather than copying files. The 2D views
come from `renderActorSVG` and are only re-framed; the turnaround comes from
`ThreeActor` and is only turned. Both run in headless Chromium.

## Command

```sh
npm install                          # once: dev dependencies (Playwright, three)
npx playwright install chromium      # once, if Chromium is not installed yet
npm run export:flow                  # build, render all 10 characters, validate
```

The run takes about 2 minutes. Options go after `--`:

```sh
npm run export:flow -- roozi ava              # only these characters
npm run export:flow -- --out /path/to/dir     # another output folder (default: exports/)
npm run export:flow -- --background '#ffffff' # plain-background colour (default #ececec)
npm run export:flow -- --no-3d                # skip the 3D turnaround
npm run export:flow -- --validate             # re-check an existing export, render nothing
```

`exports/` is gitignored because the command regenerates it from source. The
command needs no new dependencies: it uses Playwright, which the browser tests
already use, and the package's own build.

## What comes out

```
exports/
  manifest.json                 every character, its files, what is unavailable
  contact-sheet.png             all characters: reference, 4 turnaround views, face
  characters/<id>/              <id> is the slug: roozi, ava, pashmak, …
    reference.png               full body, neutral, centred, plain background   1536×1536 RGB
    reference-transparent.png   the same on transparency                        1536×1536 RGBA
    reference.svg               the same, as the original vector (lossless)
    face.png                    face close-up, neutral, plain background        1024×1024 RGB
    face-transparent.png        the same on transparency                        1024×1024 RGBA
    expressions.png             neutral, happy / sad, surprised (2×2)           2048×2048 RGB
    expressions-all.png         all 12 emotions, in EMOTIONS order (4×3)        2048×1532 RGB
    turnaround.png              front, three-quarter, side, back (3D renderer)  2048×512  RGB
    views/front.png …           each turnaround view alone, transparent         1024×1024 RGBA
    metadata.json               see below
    veo-prompt.md               Veo 3.1 prompt template for 8-second clips
```

All PNGs are 8-bit and carry an `sRGB` chunk. Plain images are RGB with no
alpha; transparent ones are RGBA. Filenames depend only on the character's
slug, so the same source gives the same paths on every run.

The rig's ground shadow is left out of every image. It's a stage effect, not
part of the character.

### What is authoritative and what is not

| File | Source | Trust it for identity? |
|---|---|---|
| `reference*.png`, `reference.svg` | the drawing, re-framed | **Yes**: this is the character. |
| `face*.png`, `expressions*.png` | the drawing, cropped, with the library's emotions | Yes. Expressions are what the library draws, and the mouth does not change. |
| `views/front.png`, `views/threeQuarter.png` | 3D renderer | Close to the drawing; the three-quarter view is the 3D model's reading of it. |
| `views/side.png`, `views/back.png` | 3D renderer | **No.** The drawing has no side or back. The renderer fills them with the outline colour and inflated front art, and face features show as flat discs edge-on. Use them for rough volume only. |

### Not produced

- **A "worried" expression.** The library has no such emotion, and the export
  substitutes nothing. `manifest.json` lists it under `unavailable`.
- **Authored side or back views.** None exist. The ones above are labelled as
  extrapolated.
- **Legs for ava.** Her drawing ends at the dress hem, by design (see her
  docstring), so her reference is not head-to-toe.

## metadata.json

Each field comes from the spec, a measurement of the render, or the curated
table in `tools/flow-export/characters.mjs`. That table may only quote the
character's docstring or describe the rendered drawing.

| Field | From |
|---|---|
| `id`, `name`, `role` | the spec (`slug`, `name`, `role`; Persian is canonical) |
| `roleEnglish` | a translation of `role` |
| `kind`, `kindSource` | the docstring, quoted. `null` where the source names none (pashmak) |
| `description`, `features`, `clothing`, `accessories`, `colorWords` | curated from the rendered drawing |
| `colors.dominant` | measured: opaque pixels of the transparent reference, binned by colour, with share of area |
| `colors.declared` | the spec: lid, brow, mouth, iris and every `body3d` part colour per layer |
| `proportions` | measured in art units (200×200 box): body box, height/width, head box, head share of height (`null` with no head layer), face box, eye positions |
| `structure` | the rendered layers, and whether there are arms, leg layers, a tail, ears or antennas; gaits |
| `rendering` | how each image was made |
| `source` | the file and export that defines the character |
| `emotions` | available, which went into `expressions.png`, which were unavailable |
| `images` | every file: path, width, height, colour mode, background, framing |
| `flow` | which two images to give Flow, the prompt file, and the fixed character text |
| `limitations` | what these references cannot show, for this character |

`manifest.json` lists every character with the same ids, paths and files,
plus the package version and git commit the export came from.

## Using the references in Google Flow

Checked against Google's Flow help pages on 2026-10-28. Flow changes often,
so check the [current help](https://support.google.com/flow/answer/16353334)
if a step does not match.

**Characters (the reusable way).** In a Flow project, open **Characters**
in the left panel and choose **New character**. The editor has two image
slots: upload `face.png` to **Portrait**, then open **Create body** and
upload `reference.png` there. Use **Upload** for both, not the prompt box,
which would generate a new image. Name the character, for example `roozi`,
and paste the fixed character block from `veo-prompt.md` into **Character
info**. In any prompt, write `@roozi` to use it. Flow then keeps the look
without re-uploading
([help](https://support.google.com/flow/answer/16935308)).

**Ingredients (per clip).** Choose **Video → Ingredients** and drag in
`reference.png` (and `face.png`). Then describe how to use them. Google
recommends subject references on a plain background, which these are
([help](https://support.google.com/flow/answer/16894016)).

**Frames (one exact first frame).** Choose **Video → Frames** and add
`reference.png` as the start frame for a clip that must open on the exact
drawing.

**Model limits (per [Flow's model table](https://support.google.com/flow/answer/16352836)):**
- Ingredients work on **Veo 3.1 Fast** and **Veo 3.1 Lite** for **8-second** clips only, and on Gemini Omni Flash. They do not work on **Veo 3.1 Quality**.
- To extend an 8-second Veo clip, use **Extend** with **Veo 3.1 Lite**.
- To reuse a moment from a generated clip, pause on it and choose **Save frame**. You can then use it as a start frame or ingredient for the next clip ([help](https://support.google.com/flow/answer/16935718)).

**What Flow does not take.** `metadata.json`, `manifest.json`, the
turnaround and the expression sheets are not character controls; Flow's help
documents no such workflow. Use them to write prompts and to check results by
eye. Prefer the single-character images as uploads. A sheet with several
poses in one image can lead the model to show several copies of the
character.

### Prompting (Veo 3.1, 8 seconds)

Each `veo-prompt.md` has two parts:

1. **A fixed character block**, generated from `metadata.json`. Paste it
   unchanged into every clip: identity, features, colours, proportions and
   style.
2. **A scene block** to fill in per clip: scene, **one** main action, **one**
   camera move, lighting and environment, and sound.

It ends with continuity and negative lines. Keep both. Those lines tell the
model not to redesign the character, recolour it, add clothing or limbs, or
put text on screen. The assembled example uses an action the character can do
(walk or roll where it has that gait; otherwise look around and smile).

## Checks

Each export ends with a validation pass, which `--validate` can also run on
its own. It re-reads `manifest.json` and every file it lists, and checks
that:

- each file opens as a PNG, and its size and colour mode match the metadata;
- each PNG is 8-bit and has `sRGB`;
- plain images are fully opaque;
- transparent full-figure images have clear corners and are not blank;
- `reference.png` is 1024–2048 px on its longest edge;
- manifest ids, metadata ids and directory names agree;
- every prompt file exists.

Any failure prints a list and exits non-zero. `npm test` also covers the PNG
encoder and that every character has a curated entry
(`test/flow-export.test.mjs`).

## Troubleshooting

| Message | Fix |
|---|---|
| `the library is not built` | `npm run build`, or use `npm run export:flow`, which builds first |
| `three is not installed` / `@playwright/test is not installed` | `npm install` |
| `could not start Chromium` | `npx playwright install chromium` |
| `this Chromium has no WebGL` / `WebGL is not available` | The export forces SwiftShader (software WebGL). If it is still missing, run with `--no-3d` and you get everything except the turnaround |
| `the 3D skin for "<id>" did not load within 15s` | A slow machine. Rerun only that character: `npm run export:flow -- <id>` |
| `"<id>" has no entry in tools/flow-export/characters.mjs` | A new character needs a curated entry. Follow the rule at the top of that file |
| `unknown character` | Use a slug from the list the error prints |

## Adding a character

Add the spec as usual (see CONTRIBUTING.md). Then add its entry to
`tools/flow-export/characters.mjs`: describe only what the drawing shows, and
quote the docstring for what it is. Run `npm run export:flow -- <id>` and look
at the images before using them.

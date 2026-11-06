# Where a style may hook into this engine (pixel art)

Read first: `.claude/skills/pixel-explainer-video/references/engine_api.md` (shots, `S`, materials, models, HUD, cards),
then `references/style_guide.md` (the look and its lessons), `scene_design.md`, `qa_checklist.md` and `assets.md`.
That skill is an older standalone text: ignore its render.mjs / setup.py / sheet.py / fetch_images.py commands (the app
renders, checks and fetches); "320x180" is the HUD coordinate space, while the 3D art resolution is `SETTINGS.art`.

## The pipeline (engine.js, ENGINE_VERSION 8, no ENGINE_KIND export = 'pixel')
Each `shot()` builds its own THREE.Scene lazily (`live()`), renders at `AW x AH` (`DEFAULTS.art`, 320 / 384 / 480 /
640 wide, 16:9) with `facet()` banded materials + a shadow pass + an object-ID pass; `postMat` adds outlines, rim light,
the dithered sky, transitions and vignette, then snaps every pixel to the 16-colour palette. The HUD is a 2D canvas in
320x180 art pixels scaled by `K = 6`, drawn in true colour on top (`compose()`).

## Extension points
| Name | What it is | How a style changes it |
|---|---|---|
| `DEFAULTS` | `art`, `outline { depth, objectId, rim, fogFade, color }`, `shadows { enabled, mapSize }`, `post { vignette, dither }`, `transitions { duration, chapterDuration, pixelateMax }`, `camera { fov, push }`, `palette` | The base's default look sets everything here but `palette`, and settings (base look < the style's `defaults` in style.json < the project's look) are merged over DEFAULTS: change `art`, `outline`, `shadows`, `post`, `transitions`, `camera` in style.json `defaults` (art width must divide 1920 and be 16:9; mapSize 1024 / 2048 / 4096). `palette` and new keys for new switches go here. |
| `C` | the palette (Sweetie-16: bg, plum, red, orange, yellow, lime, green, teal, navy, blue, sky, cyan, white, silver, slate, dark) | Change the 16 VALUES (in C or `DEFAULTS.palette`); keep exactly these 16 keys (see dont.md). |
| `RAMP` | `[shadow side, lit side, top]` per name; `RAMP.brand` = nearest ramp to the brand colour | Add ramps freely as `[C.x, C.y, C.z]`; retune existing ones (a darker top for big grounds). |
| `LIGHTER` (internal) | one-step-lighter rim colour per palette key | Update it when the palette's light order changes. |
| `facet()` / `flat()` / `facetFS` | the banded material (bands at `d > .6` / `d > -.1`), dithered shadows, fog, dithered opacity, `patch` meadow blobs | Change banding or add uniforms here; every 3D look decision goes through facet. |
| `FOG`, `SHADOW`, `LIGHTDIR` | shared uniforms; per shot `S.fogNear`, `S.fogFar`, `S.light`, `S.shadows`, `S.shadowCenter`, `S.shadowSize` | Change defaults in `renderShot()` (30 / 80, light [-.5, 1, .7]). |
| `postMat` fragment | `shade()` outlines + rim + sky, transition `mode` 0 dither, 1 diagonal wipe, 2 iris, 3 glitch, 4 pixelate; `vig`, `dith`, palette snap | A new transition = a new `mode` branch + the auto list `[0, 1, 2, 4, 1, 0]` in `drawFrame()`; scenes pick it with `trans: n`. |
| `S` keys (in `live()` / `renderShot()`) | `bg`, `sky [top, horizon]`, `outline`, `rim`, `fov`, `push` | Add new per-shot keys read in renderShot / drawFrame. |
| `FONT`, `FONT_FILES` | `head: 'Orbitron'`, `body: 'Share Tech Mono'` | New fonts: `add_font`, a FONT_FILES row, then point FONT.head / FONT.body at the family. |
| HUD: `text`, `stat`, `tag`, `rect`, `frame`, `line`, `project`, `hud` | 2D layer in art pixels; head text decodes in (`scramble`) while alpha < 1 | Restyle drawing (outline width, decode effect); keep signatures and the `SUITE.pick` pushes (editor clicks). |
| `chapterSlam()` / `chapterTag()` (internal) | letterbox slam + corner tag in `BRAND.hud` | Restyle freely; the shot fields `chapter: ['01', 'TITLE  ·  SUB']` and `chapterFirst` stay. |
| `card()` | real-image cards on the HUD (true colour), pop in / fade out, label + sub strip | Restyle the frame and label strip; keep `t0` / `t1` and the `EVENTS` 'card' push. |
| `BRAND`, `contrast`, `legibleOn`, `textOn` | brand colour for HUD accents (`BRAND.hud`) and 3D (`RAMP.brand`) | Use them for any new accent; never a literal hex in the HUD. |
| `box`, `vox`, `outline`, `GEO`, `popScale`, `pop` | geometry helpers | Add helpers; `box()` stores its size in `.scale` (animate with `popScale`). |
| `models.js` | `group`, `gridFloor`, `ground`, `terrain`, `scatter`, `tree`, `mountain`, `person`, `car`, `building`, `city`, `ghostBox`, `lamppost`, `plane`, `chip`, `memory`, `disc`, `panel`, `pixelQuad`, `wire`, `orbit`, plus the reference set `ps2`, `colossus`, `rider` | The style's kit goes here (or `lib/*.js` imported by models.js): Groups of `box()` parts with named pivots. |

## Optional: a layout check
No `layoutIssues` / `checkTimes` export exists, so `check_layout` returns nothing for this base. A style may ADD both
(host.js calls them when present; `layoutIssues(t)` returns `[{ t, type, what, detail }]`); the HUD boxes collected
in `SUITE.pick` (text, box, card) are the natural input for cut / overlap / small-text findings.

## What must stay
- Every export (`grep "^export" engine.js models.js`); add, never rename or remove. Do not add `ENGINE_KIND`.
- `W = 320, H = 180, K = 6`, `FW x FH = 1920 x 1080`, and the shot contract `shot({ t0, chapter, chapterFirst, trans, cut, build, update, draw })`.
- `rng(seed)` and the `EVENTS` / `st.hits` sound hooks; frames are pure functions of `t` (shots are built and disposed on demand).

## Restyle in 5 steps
1. Palette: set the 16 values (and `LIGHTER` if the light order changes); retune `RAMP` so big tops don't glare.
2. Render: pick `art.width`, outline switches + colour, shadow size, `post.vignette` / `dither` in the style's `defaults`
   (style.json; the base look sets them, so DEFAULTS values there never show).
3. Material and post: banding in `facetFS`, sky / rim / transitions in `postMat`; add a transition mode if the style needs one.
4. HUD: fonts via `add_font` + FONT / FONT_FILES; restyle `text`, `stat`, `tag`, `card`, chapter slam and tag.
5. Kit: models in models.js (or lib/), then `scenes/hero.js` + kits, `check_preview` and `render_frames` at scale 1.

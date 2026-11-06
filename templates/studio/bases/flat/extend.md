# Flat: where a style may hook into this engine

API: `.claude/skills/flat-explainer-video/references/engine_api.md`. Law: `references/QUALITY_STANDARD.md` (the element
gate, shading roles) and `references/STYLE_GUIDE.md` (layout, motion, colour). Rig: `references/characters.md`.

The flat engine is older than the starter: it has NO `THEMES`, `registerElement`, `LAYOUT_CHECKS` or `TRANSITIONS`
tables. A style reshapes it by changing the values and functions below. Exports are only ever ADDED (an optional new
option on an existing function is fine), never renamed or removed; `ENGINE_KIND` stays `'flat'`; bump `ENGINE_VERSION`
(engine.js line ~444) when engine.js changes. `THREE.ColorManagement.enabled = false` (line ~527) stays: hex in = hex out.

## Extension points
- **`C`** (engine.js line ~39): the palette, colour = meaning (yellow energy, mint good, pink warning, lilac system).
  Change values or add keys; keep every existing key (`skin`, `skinShade`, `hair`, `shirt`, `pants`, `lilac`, `orange`,
  `yellow`, `ink` ... are read by models.js). `C.brand` / `C.brandInk` are set from settings.brand (line ~471).
- **`BG`** (line ~538): background gradients `name: [top, bottom]` used by `S.bg('name')`. Add keys; if the new ground
  is dark, add its name to the `DARK` set below it (line ~543: drifting dust + fainter bokeh). `S.bg(top, bottom)` takes
  raw hex too.
- **`DEFAULTS`** (line ~448): `post.grain` .07 / `post.vignette` .16 (finish), `transitions.duration` .42 s,
  `camera.push` .05 / `punch` .03, `captions.size` 56. The base's default look sets every one of these, and settings
  (base look < the style's `defaults` in style.json < the project's look) are merged over DEFAULTS: a value changed here
  never shows. Tune them in style.json `defaults` (`{ "post": { "vignette": 0.1 } }`); add only NEW keys here; never
  remove keys.
- **`FONT` / `FONT_FILES`** (line ~198): one family, rows `[family, 'fonts/file.woff2', weight, style]`, loaded by
  host.js before the first frame. Fonts arrive via the add_font tool. `text()` draws only `FONT` (weights 800/600): for
  a second family add an optional `font` option to `text()` (additive), don't swap the default per call site.
- **Shading system** (lines ~114-130, ~310-348): `shaded(p, pieces, color, { s, k })`, `crescent`, `ball`, `slab`,
  `withRole('detail' | 'thickness' | 'text', fn)`. The one light is top-left (the shift in `shaded` / `crescentShape`).
  A style may change band width `s`, shade tint `k`, slab `depth`, or the light side - in these functions, so every
  element moves together.
- **Element look in the engine**: `tag()` (sticker thickness 6 px, wipe reveal), `title()` (ink stroke 8 px),
  `line()` (grows, cap pops 1.35x, three ticks), `burst()` / `burstAt()`, `bokeh()`, `gradientBg()`. Restyle inside;
  keep signatures and the `userData` they set (`tag`: plane/w/h for `wipe`, `line`: `set(k, tl)`).
- **`finish(root)`** (line ~380): vignette + monochrome grain on the overlay. Add passes here (paper, halftone); keep
  it deterministic (`seed` from `t`), vignette <= .16.
- **`captions(root, chunks, ...)`** (line ~408): white words, ink stroke 7, spoken word in `BRAND.caption`, lift 4 px.
  Restyle the card; keep `chunkWords` and the BAND position.
- **Transitions** (internal `compMat`, line ~664; picked in `compose`, line ~713): mode 0 = dissolve (drift + sweep from
  the top-left), anything else = slide (`dir` from the `-left/-right/-up/-down` suffix). A new transition = a new
  `mode` branch in the shader + its name mapped in `compose`; `dissolve`, `cut`, `slide-*` must keep working.
- **Checks** (`layoutIssues`, line ~791): no hook table. To add a style rule, add `export const LAYOUT_CHECKS = []` and
  append its findings at the end of `layoutIssues` as `{ t, type, what, detail }`. Keep the existing checks.
- **models.js**: `icons` (line ~426: add an icon as `name(p, s = 1, col)` fitting a ~100 px circle; `badge(p, name)`
  finds it), `POSES` (line ~352: add named poses), `TRAITS` (line ~40: hair / top / extras / colour lists for
  `randomLook`), `heldPhone`, `badge`, `placeOnGround`. New composite elements are new exported functions here.

## Not part of the style
- `character.js` is per project (the user's main character from the library: `name`, `look`, `parts`). The style never
  writes it. The rig in models.js (`character`, `setFace`, `pose`, `drive`, `expr`, `walkPose`, `mixPose`, `REST`,
  `FEET`, `resolveLook`, `randomLook`) must keep its joints and signatures: every library character and character lab
  look is drawn through it. Restyle hair/top/skin drawing, not the rig's API.

## Restyle in 5 steps
1. **Palette**: rewrite `C` values (keep keys and their meanings), add `BG` grounds (+ `DARK`); check text on each
   ground with `contrast()` >= 3.
2. **Fonts**: add_font, `FONT_FILES` row, `FONT`; check labels >= 44 px and titles 90-120 px still fit `TITLE.maxW`.
3. **Element shapes**: shading band / light / thickness in `shaded`, `crescent`, `slab`, `tag`; restyle `icons` and the
   trait drawing. Each changed element alone at ~600 px: check_layout (no SHADING finding) + render_view.
4. **Motion**: `transitions` / `camera` in the style's `defaults`, the dissolve shader, `popSq` squash (line ~399),
   `line` landing.
5. **Finish**: `finish()` passes, `post` in the style's `defaults`, `captions()` card. Re-run hero, kit, samples;
   mustfail scenes must still fail.

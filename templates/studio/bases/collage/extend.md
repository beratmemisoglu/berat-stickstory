# Where a style may hook into this engine (collage / Vox)

Read first: `.claude/skills/vox-collage-video/references/engine_api.md` (every builder and its options), then
`references/style_guide.md` (the Vox bar) and `references/pitfalls.md`. This file lists what a new style may change in
`engine.js` / `models.js` and what must stay. Everything below exists in `engine.js` (ENGINE_KIND 'collage', ENGINE_VERSION 8).

## The two modes (DEFAULTS.mode)
- `'front-page'` (Vox): every chapter is a `panel(slot)` on ONE broadsheet; `layoutPanels()` places them in
  `sheet.cols` columns, the camera whips between them, `finale()` pulls back to the masthead page and loops to frame 0.
- `'scenes'` (the neutral base for custom styles): every `panel()` is a full-frame scene, laid side by side in the order
  shots first show them (vertical: stacked); no sheet backdrop, no panel shadow, tilt 0 unless given, `finale()` returns
  null. `SCENES` (export) is true in this mode. A style that is not a newspaper starts here.

## Extension points (in engine.js unless noted)
| Name | What it is | How a style changes it |
|---|---|---|
| `DEFAULTS` | format, theme, palette, post, camera, sheet, shadow, border, look, mode | `mode` and `look` are read from here (the base look doesn't set them): change them here. Every other key is set by the base's default look, and settings (base look < the style's `defaults` in style.json < the project's look) are merged over DEFAULTS, so a value changed here never shows: set `theme`, `palette`, `post`, `camera`, `sheet`, `shadow`, `border` in style.json `defaults`. Add new keys for new switches here. |
| `DEFAULTS.look` | `torn`, `texture`, `masthead`, `titleFont`, `textFont`, `labelFont`, `enter`, `between` | `torn:false` clean edges, `texture:false` flat fills, `enter` = default entrance (`'drop'`, `'print'`, `'fade'`...), `between` = default move between panels (`'whip'`, `'slide'`, `'push'`, `'cut'`). |
| `THEMES` | paper / paper2 / kraft / parchment / sheet / ink / red / blue / muted / light / tape / bg / age per theme | Add a theme key with ALL of those roles; `age` scales blotches and specks. `C` is built from it + `SETTINGS.palette`. |
| `C`, `BRAND` | resolved colours; `C.red` is the one loud colour, `C.brand` / `C.brandInk` the brand fill + its text | Never hard-code a red: use `C.red` / `C.brand`. Keep the brand block (it moves the brand colour until it reads on `C.paper`). |
| `contrast`, `legibleOn`, `textOn` | WCAG helpers | Use them for any new text colour choice. |
| `FONT_FILES`, `FONTS` | the host loads FONT_FILES before scenes; FONTS maps short names to families | New font: `add_font` tool, then a FONT_FILES row + a FONTS key (+ `WEIGHT` if not 400). |
| `paperCanvas(kind)`, `tornPath()` | procedural paper (base, blotches, fibres, specks, newsprint columns) and ragged outlines | Add a paper kind in the `base` lookup; change texture density here, not per scene. |
| `panel(slot, o)` | a chapter surface; also attaches every builder as `P.<builder>` | New builders must be added to the shortcut list inside `panel()` too. |
| Element builders | `cutout`, `photo`, `paperPiece`, `ransom`, `headline`, `script`, `label`, `stamp`, `counter`, `mark`, `tape`, `dots`, `scatter`, `newspaper`, `drawn` | Add new ones built on the internal `element(P, kind, label, o, build)` + `addFace()` so they get timing, picking, shadows and the layout check. Restyle an existing one by changing its canvas drawing, never its option names. |
| Entrances (`animate()`, `IN_SFX`) | `drop`, `ink`, `print`, `slide-*`, `pop`, `grow`, `peel`, `fade`, `wipe`, `rise`, `none` | Add a `case` in `animate()` and an `IN_SFX` row (null = silent). `slam` stays aliased away (`inAlias`). |
| `shot()`, `transOf`, `TRANS_DUR` | camera framings; whip .85, slide 1.3, move 1.6, push 1.3, pull 2.6 s (erf ramps centred on `at`) | Add a transition name to TRANS_DUR + transOf. `DEFAULTS.transitions.duration` is not read: the lengths live in TRANS_DUR. |
| `camAt()`, `DEFAULTS.camera` | pose blending, drift creep-in, long-pan pull-out, loop push | Tune `fov` / `drift` in the style's `defaults` (`"camera"`; the base look sets them). |
| Post (`postMat` uniforms) | `grain`, `halftone`, `paper`, `vignette`, `warmth`, `tone` from settings `post`; motion blur from `vel` | Change values in the style's `defaults` (`"post"`; the base look sets them all); a new effect = a new uniform fed from a new `post` key (its fallback in DEFAULTS.post) and a line in the fragment shader. |
| `finale()`, `buildMasthead()` | front-page pull-back + masthead | Only in front-page mode; `look.masthead:false` keeps the pull-back without the title. |
| `layoutIssues(t)`, `checkTimes()` | what `check_layout` runs: cut, frame, overlap, mark, small (18 px), contrast (2.8:1) | Add new finding types (push `{ t, type, what, detail }`); never loosen the existing thresholds. |
| `models.js` | `gauge`, `row`, `plusSign` (built on `drawn` / `headline`) | The style's own helpers go here (or in new `lib/*.js` files imported by models.js). |

## What must stay
- Every export name listed by `grep "^export" engine.js` (host.js imports them); add, never rename or remove.
- `ENGINE_KIND = 'collage'`. Units: a panel is `FRAME` (16 x 9, vertical 9 x 16), origin at its centre, y up.
- Element option names (`at`, `in`, `dur`, `out`, `outAt`, `layer`, `over`, `bleed`, `sfx`) and the layer order
  (surfaces < cut-outs 0 < type 1 < labels 2 < stamps/marks 3 < tape 4 < pen 6).
- `e.key` / `userData._st` on every element (the editor's click lands on the element, not the panel).
- Frames are pure functions of `t` (`drawFrame(t)`), so any time renders in any order.

## Restyle in 5 steps
1. Pick the mode: keep `'front-page'` only for a newspaper idea; otherwise set `mode: 'scenes'`.
2. Add a theme to `THEMES` (all roles) and select it with `"theme"` in the style's `defaults` (style.json: it beats the
   base look, which sets `theme: 'press'`); set `look` switches in DEFAULTS.look (torn, texture, fonts, enter, between).
3. Add fonts with `add_font`, then FONT_FILES + FONTS rows; set `look.titleFont/textFont/labelFont`.
4. Restyle the builders the style keeps (canvas drawing only) and add new ones via `element()`; register them in `panel()`.
5. Tune `post` and `camera` in the style's `defaults`, then render `scenes/hero.js` + the kits and run `check_layout`
   until Clean.

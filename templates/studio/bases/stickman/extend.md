# Where a style may hook into this engine (stickman / MS Paint)

Read first: `.claude/skills/stickman-explainer/references/script.md` (the shot language: this base has no engine_api.md),
then `references/catalog.md` (every name a script may use), `references/style.md` (the visual grammar) and the skill's SKILL.md.

## How scenes are written here (different from the other bases)
- There is NO `shot()` export. A scene file calls `` script(`...`) `` from engine.js with text in the shot language
  (`lib/scene.js` `parseScript`): `title`, `cast`, `> narration` (one line = one shot), `set`, `card`, `text`, `photo`,
  `<cast> <pos> pose= e= ...`, `<prop> <pos> ...`, `@word` beats.
- No times are written: `finalizeShots()` finds each `>` line's words in audio/timeline.json and starts the picture
  0.06 s (`LEAD`) before them; unmatched shots sit between neighbours (2.7 words/s, `WPS`).
- Positions are percent of the frame, y from the BOTTOM; `L CL C CR R` stand on the set's ground line.
- Every shot+beat is ONE cached still (`picture()` in engine.js): drawn at 960x540 with an orthographic camera, then
  doubled nearest-neighbour to 1920x1080 in `compose()`. Cuts only, no camera, no tweening inside a beat.

## Extension points
| Name (file) | What it is | How a style changes it |
|---|---|---|
| `DEFAULTS` (engine.js) | `detail` (extra backdrop life via `dress()` in scene.js), `web { on, perMin }` | Add keys for new switches; looks override them via `SETTINGS`. |
| `P` (lib/paint.js, exported as `C`) | the palette: classic Paint colours + skin tones + `accent`, `brand` | Override values or add keys; keep `accent` and `brand` (the brand colour writes into both). `col(name)` resolves names in scripts (`c=red`). |
| Paint primitives (lib/paint.js) | `shape`, `oval`, `box`, `line`, `tube`, `fill`, `dot`, `rect`, `seg`, `stroke`, `spray`, `image`, `text`; `wob()` hand-wobble | The look lives here: outline width (the `line` arg, 3), wobble amount, `text()` font (internal `FONT`, Comic Sans + CZ Script) and its alpha threshold (aliased Paint text). Restyle the drawing, keep the signatures. |
| `rnd()`, `reset()` (lib/paint.js) | seeded random, reseeded per shot (`reset(scene, 1000 + i * 17)`) | Use `rnd()` for any variation in sets/props. |
| `SETS` (lib/sets.js) | backdrops: each paints the 960x540 frame and returns its ground line y | Add a key: `name: () => { ...paint...; return groundY; }`. Restyle existing ones in place. |
| `PROPS` (lib/props.js) | prop library; `G(draw)` = ground prop (bottom-centre), `F(draw)` = float prop (`float: true`, centred) | Add keys with G / F; read `a.c`, `a.text`, `a.len` like the others. |
| `POSES` (lib/poses.js) | joint angles in degrees; `F()` front view, `S()` side view; `plant: 'feet' | 'seat' | 'lie' | 'float'` | Add a pose; test it on the rig and as a sprite before scenes use it. |
| `ITEMS` (lib/items.js) | held / worn things drawn in the hand's frame; `up()` upright, `along()` forearm direction; `wear_*` = clothing | Add keys; `ITEM_NAMES` / `WEAR_NAMES` are derived. |
| `stickman(o)`, `DIM`, `LW`, `EXPRESSIONS` (lib/rig.js) | the procedural big-head rig (bones, faces, hats, hair, skin) | Change proportions in `DIM`, line weight `LW`, face drawing; keep the bone names (`at()`, `handOf()`, `lowest()` use them). |
| `loadSprites`, `pick`, `heightOf`, `FULL` (lib/sprites.js) | sprite figures from make_sprites (assets/sprites), preferred over the rig | Leave the picking as is; see dont.md about sprites and a new look. |
| `drawShot()`, `NAMED`, `SIZE`, `MAN_KEYS` (lib/scene.js) | draws one shot+beat; the chapter title at top centre (size 24) | New grammar keywords go in `parseScript` + `drawItem`; a new character key must join `MAN_KEYS`. |
| `models.js` | re-exports `POSES`, `PROPS`, `SETS`, `ITEMS`, `EXPRESSIONS`, name lists | Export new libraries' name lists here too (catalog). |
| `collectEvents()` | shots as hard cuts, no sfx | Keep it silent (voice only). |
| `shotProblems()` | flags shots > 6 s and empty white frames | Add problems (strings with file:line). |
| `FONT_FILES` | empty (system Comic Sans) | A new font: `add_font`, a FONT_FILES row, then the `FONT` string in paint.js. |

## Optional: a layout check
This engine exports no `layoutIssues` / `checkTimes`, so `check_layout` has nothing to run here. A style may ADD both
exports (host.js calls them when present: `layoutIssues(t)` returns `[{ t, type, what, detail }]`); the `boxes` that
`picture()` already measures per element are the natural input. Until then, verify with `render_frames`.

## What must stay
- Every existing export (engine.js, models.js, lib/*.js names other files import); `ENGINE_KIND = 'stickman'`.
- 16:9 only (`AW 960 x AH 540`, out `1920 x 1080`); the script grammar already in catalog.md keeps working.
- Click boxes: `picture()` pushes one box per drawn item with its script line (the editor jumps there).

## Restyle in 5 steps
1. Palette: change `P` values (keep `accent` / `brand`); decide label colours by role.
2. Line and text look in lib/paint.js: outline width, `wob()` amount, `text()` font and outline.
3. Backdrops: restyle `SETS` (each still returns its ground y) and add the style's own sets.
4. Figures: rig `DIM` / `LW` / faces in rig.js; add props, items and poses the style needs (names into models.js).
5. Write `scenes/hero.js` in the shot language using the new names, `check_preview`, then `render_frames` and look.

# Low poly: where a style may hook into this engine

API: `.claude/skills/lowpoly-shorts/references/engine_api.md`. Procedure and gates: `references/sop.md`, `references/qa.md`;
the look in numbers: `references/style.md`; people and clips: `references/motion.md`; assets: `references/library.md`;
traps: `PITFALLS.md` (skill root).

engine.js is a thin shell (362 lines): the look lives in `lib/`. It re-exports the lib pieces by name (`UI`, `SETS`, `KIT`,
`callout`, `box`, `screen`, ...); those names are the contract with host.js and every scene. Exports are only ever
ADDED, never renamed or removed; `ENGINE_KIND` stays `'lowpoly'`; bump `ENGINE_VERSION` (engine.js line ~27) when the
engine or lib changes. The asset library (`__lib/`, the seed `library/` + the user's finds) is read-only data.

## Extension points
- **Looks** (`LOOKS` in lib/core.js line ~10): `bright` and `moody`, each `render.short` (internal res 320 / 270),
  `post` { sharpen, ca, bloom, threshold, vignette, grain }, `light` { shadows, ambient }, `fog`, `captions` { style,
  size, y, case }, `camera` { push, shake }, `transitions` { duration, set }. Restyle by changing these values, except the
  ones the base's default look sets (`look`, `render.short`, every `post` value, `captions` on / size / y, `camera`,
  `transitions.duration`): settings (base look < the style's `defaults` in style.json < the project's look) win over
  LOOKS, so those go in style.json `defaults` (`{ "post": { "bloom": 0.1 } }`, `{ "look": "moody" }`). `LOOK`
  (line ~8) only knows `'moody'` / else `'bright'` and `MOODY` is a boolean used across lib/: a third look means teaching
  `LOOK` the key and checking every `MOODY` branch. A Suite look writes these into project.json `settings` (they win
  over the engine defaults), so keep the keys.
- **`C`** (lib/core.js line ~53): palette (felt, dealerRed, money, loss, caption, sky, grass, void colours, teal ...).
  Change values or add keys; keep the existing ones (sets, kit and ui read them). `BRAND` (line ~71) defaults to the
  look's accent.
- **Final pass** (lib/post.js `createPost`, line ~19): upscale -> unsharp halo -> chromatic fringe -> soft shoulder ->
  grade (`sat`, `tint`, `bright`, `contrast`, `grey`, `lift`, `vignette`) -> optional Bayer dither -> grain -> overlay.
  A style's finish = `post` values in the style's `defaults` (the base look sets every `LOOKS.post` key) and new
  uniforms in this pass (their values: new `post` keys). Keep the low-res render + soft upscale: it IS
  the style.
- **Transitions** (engine.js `TRANS` line ~105, `durOf` line ~107; shader modes in post.js `mix`, line ~23): `cut push
  push-* blinds flash mosaic black dissolve ghost` + split modes 7-9. New transition = a new `mode` branch in the mix
  shader + its name in `TRANS` (and a default length in `durOf`). Flashes stay <= 70 % white.
- **Camera presets** (lib/camera.js `cameraRig`, line ~23): kinds `push drift orbit dutch low high face insert pov topdown
  track pull follow` + keys; per-kind lens (`baseFov` table line ~28) and framing (`fill` table line ~29). Retune or add
  a kind; the camera always moves.
- **Light and sets** (lib/sets.js): `light(S, kind)` (line ~21, bright/day vs moody rigs), `sky`, `fog`, `floor`,
  `room`, `voidSet` (line ~116), `buildSet` (line ~142: named sets with `spots`). Add a `case` for a new set; keep spots
  and closed rooms with ceilings.
- **2D layer** (lib/ui.js): `F` fonts + `FONT_FILES` (line ~6), `COLORS` (line ~8), captions (`chunkWords`,
  `captionBox`, `drawCaption`: style per look, sizes written for a 1080 x 1920 frame), `callout`, `counter`, `panel`,
  `arrows`, `cctv`, `live`, `custom`. Restyle the drawing; keep the item shape `{ t0, t1, what, text, box, draw }`
  (check_layout reads `box`). New fonts via add_font + a `FONT_FILES` row + `F.h`.
- **Procedural kit** (lib/kit.js): screen UIs (`UI` table line ~20: add a UI key), money, casino pieces, charts, organs,
  `sign`, `ring`, `sting` (the brand sting), `crowd`. New props as new exports, re-exported from engine.js.
- **People** (lib/actor.js `OUTFITS` line ~20, `SKIN`, `BUILDS`; lib/faces.js `EXPRESSIONS`; lib/cast.js `ROSTER`,
  `ROLE_DEFAULTS`, `ROLE_OUTFITS`): add outfits / roles. Scenes use roles (`models.js` `HERO = { role: 'main' }`) so the
  user's character picker keeps working.
- **Checks** (lib/check.js `issues`, called by `layoutIssues` line ~342): no hook table. To add a style rule, add
  `export const LAYOUT_CHECKS = []` in engine.js and append its `{ t, type, what, detail }` findings in `layoutIssues`.
- **PS1 toggles** (`settings.ps1` snap / affine / dither, engine.js `psx` line ~177): off by default; a look may turn them on.

## Restyle in 5 steps
1. **Palette + look**: `C`, then `LOOKS.<look>` (render.short, light, fog); background colours of `makeS` (line ~116)
   and the void sets.
2. **Fonts + captions**: add_font, `FONT_FILES`, `F`, caption style/size/y per look (captions ~46-50 px on 1080 wide).
3. **Element shapes**: sets (`buildSet` cases), kit props, screen UIs, callout/panel drawing; each new one alone in an
   `insert`/`orbit` close-up at scale 1 (qa.md section 3).
4. **Motion**: camera kinds (fov, fill, push), transition set and lengths (cuts ~24-33 / min).
5. **Finish**: `post` values (sharpen, ca, bloom, vignette), grade uniforms, dither. Then check_layout Clean on hero,
   kit, samples at 5 times per second for moving shots; mustfail scenes still fail.

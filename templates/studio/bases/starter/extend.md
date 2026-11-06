# Starter: where a style may hook into this engine

API: `.claude/skills/studio-starter/references/engine_api.md` (every element and option). Law: `.claude/skills/studio-starter/references/RULES.md`
(its "Extension points" table is the short form of this page). Pattern to copy: `references/example_scene.js`.

The starter has no look of its own. A style changes it only at the points below. Everything else in `engine.js` is the
contract host.js, the render workers, check_layout and export rely on: exports are only ever ADDED, never renamed or
removed, no return value changes, `ENGINE_KIND` stays `'starter'`. Bump `ENGINE_VERSION` (line ~21) when engine.js changes.

## Extension points (engine.js unless noted)

- **`THEMES`** (line ~101): the palette. Add a key, e.g. `THEMES.ink = { ... }`, with every key the base has: `bg bg2
  surface ink muted accent accent2 good bad line ground sky floor` (all `'#rrggbb'`), `dark` (bool), `light: { key, hemi }`
  (3D light intensities; key + hemi ~ PI keeps lit faces just under clipping). It is selected with `"theme": "ink"` in
  the style's `defaults` (style.json), which beat the base look (a look picks another with `settings.theme`).
  You may retune `base` / `dark`, but keep both keys: `lib/kit.js` shows every element on `THEMES.base` and `THEMES.dark`.
  `C` (scenes' colours) and `C.brand` / `C.brandInk` are derived from it; don't hard-code hex in scenes.
- **`DEFAULTS`** (line ~24): the engine's fallbacks (`captions`, `post` grain/vignette/contrast/desat/warmth, `camera`
  push/punch/fov, `transitions.duration`, `quality.ss/shadows`, `theme`). Every one of these keys is also set by the base's
  default look, and settings (base look < the style's `defaults` in style.json < the project's look) are merged over
  DEFAULTS: a value changed here never shows. Tune them in style.json `defaults`
  (`{ "theme": "ink", "post": { "vignette": 0.08 } }`); add NEW keys here (a switch the style's own code reads); never
  remove a key (merge reads them). Per-project values come from project.json `settings`, which the app writes, not you.
- **`FONT` / `MONO` / `FONT_FILES`** (line ~240): rows `[family, 'fonts/file.woff2', weight, style]`; host.js loads every
  row before the first frame. Get the file with the add_font tool, then add its row and point `FONT` (or a new export such
  as `DISPLAY`) at the family. Keep `FONT` and `MONO` exported.
- **`registerElement(name, fn)`** (line ~356; use it in `models.js`): the style's own composite elements. `fn(p, opts)`
  returns an Object3D; parent through `in2d(p, 'name')` or `in3d(p, 'name')`. Names are camelCase; a built-in in `EL`
  (rect, rrect, circle, poly, line, arrow, text, title, label, tag, card, counter, image, box, sphere, cyl, ground, group)
  can never be replaced. Set `g.userData.bg = fill` on plates that carry text (contrast check). Examples: `badge`, `table`.
- **`TRANSITIONS`** (line ~533): GLSL bodies returning `vec4`; `A(uv)` / `B(uv)` sample out/in shots, `v` = uv, `e` = eased
  0..1, `dir` = push direction. Add a key at module load (it compiles on the first frame), use `shot({ trans: 'name' })`.
  Keep `dissolve` and `push` (the default and `push-*` resolve to them).
- **`POST_UNIFORMS` + `POST_GLSL`** (line ~540): extra finish passes on `vec3 c` (uv in `v`), run after contrast/desat/warmth
  and before vignette + grain. Uniforms are floats: `POST_UNIFORMS.paper = { value: .3 }; POST_GLSL.push('c *= ...;')`.
- **`LAYOUT_CHECKS`** (line ~699): `LAYOUT_CHECKS.push((S, t, def) => [{ type, detail }])`; runs in check_layout, each
  finding said once per shot. Add the style's own rules here (e.g. "accent used on more than one thing").
- **`CHECK` / `VISIBILITY` / `CAMERA_LIMITS`** (line ~696): thresholds (edge 36 px, overlap .12, minText 40, contrast 3,
  empty .12; dark .10; accel 2.4, peakDeg 60). Tune a value with a reason; never delete a key, never loosen to hide a bug.
- **`models.js`**: the style's elements (registerElement only), imported by scenes. Keep `badge` and `table` exported.
- **`lib/kit.js`**: `kitShot` / `kitGallery`; add new kit helpers as new exports, keep both signatures.
- **Layout values** `SAFE`, `BAND`, `ZONE`, `TITLE`, `GY` (line ~48): a style may shift `TITLE.y` or `GY` for its
  composition; `SAFE` and `BAND` are the player/phone UI and caption band: don't shrink them.

## What a style does NOT change
`shot`, `S.*` (bg, ground, add, line, arrow, view, move, light, fog, toScreen), `cue`, `compose`, `exportVideo`,
`collectEvents`, `layoutIssues`, `checkTimes`, captions (`chunkWords`, `captionAt`), `SUITE`, `PICKABLE`, `rng`. Entrance
kinds (`pop grow rise drop slide-* fade none`) are internal; a new motion goes in an element's own `update`/`S.tick`.

## Restyle in 5 steps
1. **Palette**: add `THEMES.<style>` (and a dark twin if the style has one), select it with `"theme"` in the style's
   `defaults` (style.json); check text/ground pairs with `contrast()` >= 3.
2. **Fonts**: add_font, `FONT_FILES` rows, repoint `FONT`; titles 90+ px, body >= 40 px still hold.
3. **Elements**: the style's signature shapes via `registerElement` in models.js; each one `kitShot` on light and dark,
   check_layout Clean, render_view at full size before any scene uses it.
4. **Motion**: new transitions in `TRANSITIONS`; camera feel through `camera` (push .04, punch .02) and
   `transitions.duration` (.4 s) in the style's `defaults`; per-element motion as pure functions of `t`.
5. **Finish**: `post` values in the style's `defaults`, then `POST_UNIFORMS`/`POST_GLSL` for paper, halftone, tint (a new
   uniform's value is a new key: DEFAULTS is fine for it); a style rule the eye
   keeps catching becomes a `LAYOUT_CHECKS` entry. Re-run hero, kit and sample scenes, then the mustfail scenes (they must
   still fail).

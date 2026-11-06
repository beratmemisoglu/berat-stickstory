# Starter: known pitfalls of this base

Sources: `.claude/skills/studio-starter/references/RULES.md`, `engine_api.md`, the engine's own errors and comments.

## Determinism (frames must be identical on every render)
- Don't call `Math.random(` - use `rng(seed)` or `S.rng()` (seeded per shot); a random frame differs between preview,
  stills and export, and check_layout judges a picture the export never shows.
- Don't call `Date.now(`, `performance.now(`, `new Date(` - time is the `t` the engine passes; anything else drifts per run.
- Don't use `setTimeout`, `setInterval`, `requestAnimationFrame` - the render workers seek frames, nothing ticks.
- Don't touch `document` / the DOM or `fetch` / network in scenes or models - workers are headless and offline.
- Don't loop with `%` on positions (`x = (t * 200) % W`) - it jumps; use `Math.sin(t * w + phase)`.
- Don't mutate state across frames in `update` (`obj.x += 2`) - seeking backwards breaks; set values from `t`.

## Engine contract
- Don't rename or remove any export of engine.js, models.js or lib/kit.js - host.js imports them by name; the app diffs
  exports after every turn and every project on this engine breaks.
- Don't change `ENGINE_KIND` ('starter') or what an existing function returns (`text()` must keep `userData.w/h/size`,
  `shot()` must keep `_file/_line`) - the editor's clicks and the checks read them.
- Don't redefine a built-in element - `registerElement` throws "is a built-in element; pick another name".
- Don't give registerElement a non-camelCase name or a function that returns nothing - it throws.
- Don't add a `TRANSITIONS` / `POST_UNIFORMS` key inside a shot's build - the compositor compiles once on the first
  frame; a later key is ignored and the shot falls back to dissolve ("unknown transition ... dissolve used").
- Don't delete keys from `DEFAULTS`, `THEMES.base`, `THEMES.dark`, `CHECK`, `VISIBILITY`, `CAMERA_LIMITS` - settings
  merge and lib/kit.js read them.
- Don't loosen a threshold to make a finding go away - fix the cause, or mark intent (`over`, `bleed`, `band`,
  `airborne`, `S.sparse`, `S.visibility = false`).
- Don't let a `LAYOUT_CHECKS` function throw - it is caught and printed as "layout check: ..." and finds nothing.

## Dimensions
- Don't put 2D elements (text, label, card, rect, line ...) into the 3D world - throws "is a 2D element (pixels): in a
  3D project it goes on the HUD".
- Don't put box / sphere / cyl on the HUD or in a 2D project - throws "is a 3D element".
- Don't place a solid without what holds it - every solid's origin is its bottom; `y` = the top of the thing under it,
  or check_layout prints `floating`. Mark `userData.airborne` only for things that really fly.

## Layout and legibility (what check_layout prints)
- Don't hard-code numbers that fit one format (`x: 700` is off-frame in 9:16) - derive from `W`, `H`, `ZONE`, `SAFE`, `VERT`.
- Don't go within 36 px of the frame edge - `cut`.
- Don't put anything in `BAND` while captions show - `caption`.
- Don't overlap two 2D elements by more than 12 % of the smaller - `overlap` (or `userData.over = [other]` if intended).
- Don't set text under 40 px on screen (titles 90+) - `small`.
- Don't put text below 3:1 contrast on what is behind it - `contrast`; use `textOn`, `legibleOn`, `label`, `card`.
- Don't fill under 12 % of the content zone - `empty`.
- Don't light a shot too dark - `DARK` / `CRUSHED` (VISIBILITY dark .10, crushFrac .60).
- Don't move the camera with keys under 1.5 s apart - `ABRUPT` (CAMERA_LIMITS accel 2.4, peakDeg 60).
- Don't stack two 3D surfaces at the same depth - `coplanar` / `flicker`; lift one a few cm or make it one surface.
- Don't let solids pass through each other - `through`.
- Don't keep important things only out of `st` - check_layout and the editor's click see only what `build` returns.
- Don't time with raw seconds - use `cue('word', near)`; a miss prints "cue miss" and falls back to `near`.
- Don't use an image key that is not in project.json "images" - a grey placeholder plus "image missing".

## Never edit (the app denies the write)
- `project.json`, `.suite/**`, `.claude/**`, `reference/**` (except `reference/ANALYSIS.md`), `audio/**`.
- `qa/mustfail/**`, `scenes/mustfail_*.js` - they exist to prove a check still fails (overlap, cut, small, DARK; 3D
  also floating). If one starts passing, the check broke, not the scene.
- `vendor/**` (three.js r170), `fonts/**` (fonts come only via the add_font tool), `lib/contact.js`, `lib/collide.js`.

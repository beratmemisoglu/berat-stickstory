# Starter rules (law for every scene and every style built on the starter)

## Do
- Time every event with `cue('word', near)`; every entrance with `S.add(obj, { at })`; motion as a pure function of `t`.
- Place things with the layout values: `ZONE` (content), `SAFE` (never under player / phone UI), `TITLE`, `VERT` for the
  9:16 layout. One file must work in both formats when the style has both.
- Keep every element you care about on `st` (arrays are fine): the checks and the editor's clicks only see `st`.
- One idea per frame; the subject big; text >= 40 px on screen (titles 90+), readable (contrast >= 3: `textOn`, `legibleOn`,
  or a plate: `label`, `card`).
- 3D: stand every solid on what holds it (`y` = the top of the thing under it; the ground is y = 0); light the subject;
  frame with `S.view`, move with `S.move` keys >= 1.5 s apart.
- Prove every new element alone first (`kitShot` on light and dark, check_layout Clean, render_frames at full size).
- Mark intent instead of hiding findings: `userData.over` (a label on its object, a thing inside a container),
  `userData.bleed` (an intended crop), `S.sparse` (emptiness is the idea), `S.visibility = false` (a deliberately dark shot),
  `userData.airborne` (it really flies or falls).

## Don't
- No `Math.random()` (use `rng(seed)` or `S.rng()`), no `Date.now()` / `performance.now()`, no `setTimeout` /
  `requestAnimationFrame`, no `document` / DOM, no `fetch` / network in scenes or models. Frames must be the same every time.
- No numbers that only fit one format (x = 700 is off-frame in 9:16): derive from `W`, `H`, `ZONE`, `SAFE`.
- Nothing in the caption band (`BAND`) while captions show; nothing cut by the frame edge; no accidental overlaps.
- No 2D elements in the 3D world and no 3D solids on the HUD (the engine throws: it says which).
- No `%` on positions for loops (it jumps); use `Math.sin(t * w + phase)`.
- Never edit a `mustfail_*.js` scene: it exists to prove a check still fails.

## Extension points (the ONLY ways a style changes the engine)
| What | How |
|---|---|
| Palette | `THEMES.<name> = { bg, bg2, surface, ink, muted, accent, accent2, good, bad, line, ground, sky, floor, dark, light: { key, hemi } }` in engine.js; the look picks it with `settings.theme` |
| Elements | `registerElement('name', (p, opts) => Object3D)` in models.js (use `in2d(p)` / `in3d(p)` for the parent); then `EL.name` / the exported const. Built-ins are never replaced. |
| Checks | `LAYOUT_CHECKS.push((S, t, def) => [{ type, detail }])`: runs in check_layout, each finding said once per shot |
| Transitions | `TRANSITIONS.name = 'GLSL body returning vec4'` (A(uv), B(uv), v, e, dir); `shot({ trans: 'name' })` |
| Finish | `POST_UNIFORMS.name = { value }` + `POST_GLSL.push('c = ...;')` (on `vec3 c`, `v` = uv) |
| Thresholds | `CHECK`, `VISIBILITY`, `CAMERA_LIMITS` values may be tuned (never deleted) |

Everything else in engine.js is the contract the app relies on (host.js, render workers, the check_layout tool, export,
sound events): **never rename or remove an export**, never change what a function returns, never change `ENGINE_KIND`.
Add new exports beside the old ones; bump `ENGINE_VERSION` when engine.js changes.

## What check_layout reports (and the fix)
| Type | Means | Fix |
|---|---|---|
| cut | within 36 px of / crosses the frame edge | move inside SAFE, or `bleed` if intended |
| caption | in the caption band while a caption shows | move into ZONE |
| overlap | two 2D elements cover > 12 % of the smaller | separate them, or `over = [other]` if intended |
| small | text under 40 px on screen | bigger text |
| contrast | text < 3:1 against what is behind it | `legibleOn`, `textOn`, or a plate |
| empty | < 12 % of the content zone used | bigger subject, the thing the narration names, or `S.sparse` |
| kit | a kit element not whole and comfortably in frame | resize / re-centre it |
| DARK / CRUSHED | too dark / crushed black | light it, lighter grounds; `S.visibility = false` if deliberate |
| ABRUPT | the camera starts, stops or jumps too hard | eased keys further apart, or cut |
| floating (3D) | a solid resting on nothing | rest it, or `airborne` |
| through (3D) | two solids pass through each other | move one so they touch |
| coplanar / flicker (3D) | two surfaces at the same depth z-fight | lift one a few cm, or make it one surface |

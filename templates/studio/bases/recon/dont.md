# Recon: known pitfalls of this base

Sources: `.claude/skills/recon-reconstruction/references/failures.md` (every defect that reached a render),
`quality.md` (hard rules), `signoff.md`, `no_slop.md`, `playbook.md`, and the engine's comments.

## Determinism
- Don't call `Math.random(` - seed it: `hash(i, n)` / `jitter(seed)` from models.js, crimeover's `hh`; "scrambles, typing,
  waveforms and glitches are seeded by the frame number, never by Math.random". Preview must equal render.
- Don't call `Date.now(`, `performance.now(`, `new Date(`, `setTimeout`, `requestAnimationFrame` in scenes, models or
  kits - frames are seeked and rendered in workers (`performance.now` only times the export and contact.js's budget).
- Don't load textures lazily - "Earth and Moon rendered black in the first frames"; list them in story/project
  `"textures"` so they preload.
- Don't hide things with `visible = false` on screen - "nothing pops"; leave the frame, an effect, or a motivated fade.

## Engine contract
- Don't rename or remove any export of engine.js, models.js or lib/*.js - host.js, the Graphics panel and old scenes
  import them by name; the app diffs exports every turn.
- Don't change `ENGINE_KIND` ('recon') or remove the `studio` / `investigation` themes - code branches on `THEME_ID`.
- Don't touch the v9 Graphics layer (`applyGraphics`, `getGraphics`, `GFX_*`) or set graphics values from a look -
  "Scenes must not set or fight these (the user's choice wins)".
- Don't cross-dissolve two 3D scenes - "ghosted double images"; transitions are cut, dip, or the effect cuts.
- Don't append code after a `//` comment on the same line - happened twice in v8, silently commented code out
  ("cliff and chamber vault invisible").
- Don't delete keys from `VISIBILITY`, `CAMERA_LIMITS`, `MAT`, `C`, `THEMES.*`; don't loosen a threshold to pass.
- Don't let a `LAYOUT_CHECKS` function throw - it is caught ("layout check: ...") and reports nothing.

## Geometry (what the sign-off prints)
- Don't stack coplanar surfaces (floor on floor, decal on wall) - `coplanar` ("two surfaces less than 1 cm apart will
  flicker"); one surface per surface, details >= 1 cm proud. v6 cabin floors 1-3 mm apart flickered.
- Don't leave a near plane too small or far plane too big - `flicker` (> 150 px change under depth-only probe); use
  `S.studio({ near, far })`: interiors .05-.1 / 60-120, km map .02 / 120, metre exteriors 1-2 / 12000-16000.
- Don't put a studio floor under an interior or a cockpit - "cockpit floor bugging" (1 mm over the studio floor).
- Don't let props rest on nothing - `floating`; parts that belong together meet (`hitAlong` raycast, not bounding boxes:
  "LM floated off the CM").
- Don't let solids pass through each other - `through`; bodies through bodies or solids - `overlap` (collide, every 0.1 s;
  1 cm tolerance). Declare `S.collide` in every shot with people. Holes bodies pass through are real holes.
- Don't place two side-by-side walkers closer than 0.95 m (0.6 m standing) - "arms bumped up to 4 cm".
- Don't use `Box3.setFromObject(obj)` on rotated meshes for sizing - use the precise `(obj, true)`.

## People and motion
- Don't walk people except via `walkAt` / `clipSpeed` - feet slid; planted-foot slide must measure 0.0000 m.
- Don't touch props except via `handTo` / `grip` (wrist within 2 cm, prop parented to the hand, matching clip).
- Don't tie a camera to a wobbling heading - "camera sweeps left to right"; cameras follow position, eased offsets.
- Don't push under 2.5 s, turn over 20 deg/s (8 in close-ups), or stop-start - `ABRUPT` / camera findings.
- Don't default to egg-head mannequins - realistic library rig + mocap unless the user picked one.

## Look and text
- Don't underexpose for mood - `DARK` / `CRUSHED` / `SUBJECT` (frame mean >= 45 dark looks, 90 bright; < 35 % crushed;
  subject >= 70 and 1.4x its ring). Relight (key/fill/rim/practicals), never brighten in post.
- Don't add bloom, chromatic aberration or heavy vignette to the Studio look - "blown out" in v5: vignette <= .07,
  grain <= .015.
- Don't give text a coloured glow - one neutral `drawText` / `textShadow`; text >= 28 px body, 22 px labels, 4.5:1.
- Don't hold text under 1.5 s after it settles (+0.3 s/word beyond 5); never cut on an unresolved scramble.
- Don't place text over a face, the subject or a real photo's centre third - `TEXTPLACE`; never two tags at once.
- Don't magnify a raster over 1.5x - `PIXELATED`. Don't leave a board string short of its pin - `STRINGEND` (3 mm).
- Don't use stamps, `list()` `mark` / `markAt`, verdict plaques, or any AI-voice `notice` - banned in every style.
- Don't add sound effects the user didn't supply (kit overlays stay silent unless `{ sound: true }`).
- Don't show a modern map for a period story; don't draw evidence with primitives; credit every real asset.

## Never edit (the app denies the write)
- `lib/contact.js`, `lib/collide.js` - the sign-off checks themselves; a check is trusted only after it failed on a
  known-bad case.
- `project.json`, `.suite/**`, `.claude/**`, `reference/**` (except `reference/ANALYSIS.md`), `audio/**`.
- `qa/mustfail/**`, `scenes/mustfail_*.js`, `vendor/**` (incl. the patched GTAO/Bokeh passes), `fonts/**` (add_font only).

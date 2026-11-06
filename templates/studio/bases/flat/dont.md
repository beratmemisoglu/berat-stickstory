# Flat: known pitfalls of this base

Sources: `.claude/skills/flat-explainer-video/references/pitfalls.md` (four review rounds), `QUALITY_STANDARD.md`,
`STYLE_GUIDE.md` §5, `characters.md`, SKILL.md non-negotiables, and the engine's comments.

## Determinism
- Don't call `Math.random(` - this engine has no `rng()` export; seed like `burst({ seed })`, `bokeh({ seed })`,
  `randomLook(seed)` do (an LCG on a seed), or add an `rng` export. Random frames differ between preview and export.
- Don't call `Date.now(`, `performance.now(`, `new Date(`, `setTimeout`, `requestAnimationFrame` in scenes or models -
  frames are seeked; time is only the `t` passed in (`performance.now` in `exportVideo` only measures speed).
- Don't use `document` or `fetch` in scenes/models (text() owns its canvas) - the render workers are headless.
- Don't write `t > X ? A : B` on a pose, face, colour or position - "the face just jumps"; use `mixPose` in `drive()`,
  `expr()`, eased 0.25-0.4 s turns.
- Don't loop with `%` on a position - "ZzZ jumps back to its first frame"; periodic functions or a fade at the wrap.
- Don't spread a partial pose (`mixPose` returns only the keys it mixed) - NaN, the head vanished; start from
  `{ ...POSES.rest, ... }`.
- Don't put a `//` comment inside a one-line template - it swallows the rest of the line; use `/* */`.

## Engine contract
- Don't rename or remove exports of engine.js or models.js - host.js, charview.js and every project import them by name.
- Don't change `ENGINE_KIND` ('flat'), the rig's joints or `character(p, opts)` - every library character and
  character lab look is drawn through it; character.js (per project) is never the style's to edit.
- Don't re-enable colour management or set an sRGB output - "SRGB here washes every colour out" (hex in = hex out).
- Don't give a transition a name the compositor doesn't know - anything but `dissolve` / `cut` runs the slide shader;
  without a `-left/-right/-up/-down` suffix its direction is (0, 0) and it acts as a hard cut.
- Don't expect a per-shot `post` - the finish is built once (`finish()`), from `DEFAULTS.post` / settings.
- Don't raise the vignette above .16 - ".32 turned orange corners brown".

## Element gate (QUALITY_STANDARD: rule zero, elements approved before scenes)
- Don't lay shading or highlights on top of a form - check_layout prints `shading` ("N px of shading/highlight/detail
  drawn OUTSIDE the element's own form", fails above 6 px); cut it with `shaded()`, `clipPts`, `crescent`.
- Don't forget `withRole('detail', ...)` on shading/features or `'thickness'` on intended depth - the measure is by role.
- Don't shade one element and leave its neighbour flat; don't shade strokes thinner than ~14 px.
- Don't light from anywhere but the top-left (shade bottom-right, band s 4-7 px).
- Don't use an element in a scene before it passed alone at ~600 px; don't judge it only at scene size.
- Don't assemble composites inside a scene - they go in models.js as functions.
- Don't draw a clock with both hands on 12 (reads as one hand: use 10:10); hands hold things with fingers on one edge,
  thumb in front on the other.

## Layout and motion (what check_layout prints, what reviewers caught)
- Don't place anything in `BAND` (y -700..-520 vertical, -490..-380 landscape) while captions show - `caption`;
  captions collided with content in 10 of 14 scenes before the rule.
- Don't go within 36 px of the edge after the camera push (up to +8 %) - `cut`.
- Don't overlap two `st` elements over 12 % of the smaller - `overlap` (or `userData.over`).
- Don't set labels under 44 px (check fails under 40), titles outside 90-120 px, icons under ~110 px - `small`.
- Don't fill under 12 % of the zone (aim >= 15 %) - `empty`, unless `S.sparse = true` is the idea.
- Don't reuse the other format's numbers - use `W`, `H`, `GY`, `BAND`, `ZONE`, `TITLE`.
- Don't fade a warm colour over a cool ground (translucent yellow over purple = brown) - opaque `tint()` glows.
- Don't hold a frame still over ~1 s, rain 30 identical particles, or move against the narration.
- Don't hard-cut where nothing carries over - every cut is a dissolve unless a cut is the idea.
- Don't leave stale highlights when focus moves; don't let things appear on top of a face (build them before, behind).
- Don't use images, emoji, red stamp/verdict overlays ('CLOSED', 'DENIED') or any "AI voice" notice.

## Never edit (the app denies the write)
- `project.json`, `.suite/**`, `.claude/**`, `reference/**` (except `reference/ANALYSIS.md`), `audio/**`.
- `qa/mustfail/**`, `scenes/mustfail_*.js` - they prove a check still fails; if one passes, the check broke.
- `vendor/**`, `fonts/**` (fonts only via the add_font tool), `lib/contact.js`, `lib/collide.js`.

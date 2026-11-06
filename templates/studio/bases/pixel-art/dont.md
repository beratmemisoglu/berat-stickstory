# Known pitfalls of this base (pixel art)

Sources: `.claude/skills/pixel-explainer-video/references/style_guide.md` (section 9, lessons learned),
`qa_checklist.md`, `engine_api.md`, `scene_design.md`, `assets.md`, and the engine comments.

## Never edit (the app refuses the write)
- Don't write `project.json`, `.suite/**`, `.claude/**`, `reference/**` (except `reference/ANALYSIS.md`), `audio/**`,
  `qa/mustfail/**`, `scenes/mustfail_*.js`, `vendor/**`, `fonts/**`, `lib/contact.js`, `lib/collide.js` - because the
  app owns them; fonts come only through the `add_font` tool.
- Don't rename or remove any export of engine.js or models.js - because host.js imports them by name and every pixel project breaks; the app diffs exports after each turn.
- Don't set `ENGINE_KIND` to anything but `'pixel'` - because host.js reads a missing or `'pixel'` kind as the pixel engine (the Style Kit's packages always export `ENGINE_KIND = 'pixel'`).

## The old skill text
- Don't run or mention `render.mjs`, `setup.py`, `sheet.py`, `fetch_images.py`, `index.html` or `node`/`python` commands - because the skill is a v1 standalone text; you have no Bash and the app renders (`render_view`, `render_frames`), checks (`check_preview`) and finds images.
- Don't read "320x180" as the render size - because only the HUD is in 320x180 units; the 3D art is `SETTINGS.art` (320 / 384 / 480 / 640 wide).

## Banned calls and patterns
- Don't call `Math.random(`, `Date.now(`, `performance.now(` or `new Date(` in scenes or models - because shots are built lazily and frames rendered out of order must match; use `rng(seed)` (`performance.now` stays only in exportVideo's progress timer).
- Don't use `fetch`, timers or `document.*` in scenes - because frames are pure functions of `t`; draw on `hud` or with `pixelQuad`.
- Don't import one scene file from another - because its shots register twice; shared code goes in models.js.
- Don't set `obj.scale.setScalar(...)` on a `box()` - because its size IS its scale; use `popScale(obj, pop(t, t0))`.
- Don't shake the camera, flash or add overlays to make a scene "less boring" - because the fix was always more detail, depth and a clearer metaphor; `st.hits` drive soft sound accents only.
- Don't draw a red stamp, boxed verdict word or any AI-voice notice - because both are banned in every style.

## Palette and materials
- Don't add or remove keys of `C` - because the post shader holds exactly 16 palette entries (`pal[16]`, `palL[16]`) built from `Object.values(C)` and `LIGHTER`; change values only.
- Don't introduce colours outside the palette in the 3D layer - because everything snaps to the palette and in-between colours turn into dither noise.
- Don't use Lambert / Standard materials - because lit materials plus palette snapping dithered into grey mush; everything goes through `facet()`.
- Don't call `facet('name')` with a ramp that doesn't exist - because the whole shot crashes; add it to `RAMP` first.
- Don't put bright tops (yellow, lime, white) on big ground planes - because large glaring areas; use a darker ramp (`[C.navy, C.teal, C.green]`).
- Don't add gradients in 3D or push vignette / dither up - because colours land between palette entries and flat areas get checkerboard noise.
- Don't `setOpacity` a shared material - because it fades every user of the cached material; create it with `{ unique: true }`.

## Depth and camera
- Don't set `S.fogFar` closer than the farthest important object - because distant mountains became flat pale cut-outs (75 -> fixed at 115).
- Don't leave empty flat planes - because they read as unfinished; scatter rocks, grass, trees.
- Don't put the camera inside or behind geometry - because the subject vanished twice (a car behind buildings, a camera inside a row); check frames.
- Don't spin an object on the wrong Euler axis - because a disc showed its blank back; spin around its symmetry axis.

## HUD and cards
- Don't dim a `font: 'head'` text without `noKinetic: true` - because it stays scrambled at rest (decode runs while alpha < 1).
- Don't let text overlap text, a card or the 3D focal point - because two elements timed at once collided; move, shrink or time one out.
- Don't place text outside the safe margins (18 px sides, 26 px top below the chapter tag, above y=165) - because it hits the tag or the bottom.
- Don't burn captions into the HUD - because captions are delivered separately.
- Don't show a fair-use image full screen or for longer than its idea - because those copies are 250-400 px; cards stay 44-120 art px wide.
- Don't stand in abstract cubes for a concept - because "hard to understand" scenes were fixed by concrete dioramas.
- Don't leave a shot's first frames blank - because transitions show them; give every shot something from t0.
- Don't pass `chapter` as a plain string - because the slam reads `['01', 'TITLE  ·  SUB']` (host.js only patches it); write the array on every shot of the chapter and `chapterFirst: true` on the first.
- Don't rely on `check_layout` - because this engine exports no `layoutIssues`, so it reports nothing; look at frames (0.4 s after t0, 0.3 s after each cue, 1 s before t1) at scale 1 for small text.
- Don't chapter a video under 45 s - because the slam eats the time (0-2 chapters under 2 min).

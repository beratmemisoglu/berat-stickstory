---
name: studio-starter
description: Build a video, or grow a new style, on the Toon Studio STARTER engine - the plain Three.js base of the Style Studio, 2D (flat shapes in pixels) or 3D (lit solids on a ground, text on a HUD), 9:16 or 16:9, with word-timed shots, word-highlight captions, cut / dissolve / push transitions, a light film finish and the full set of checks behind check_layout. Use for any project whose style is "starter" or a style built on it.
---

# Studio starter (Toon Studio)

The starter is a neutral engine with set rules. It has no look of its own: a style made in the Style Studio reshapes it
through its extension points, never by rewriting it. Everything it draws is tagged so the checks can judge it.

The app has already done the setup: `engine.js`, `models.js`, `lib/kit.js`, `fonts/`, `vendor/` exist; when there is a
narration, `audio/timeline.json` and `audio/script_timed.txt` are ready; `project.json` has `end` and the look (`settings`:
`format` landscape 1920 x 1080 or vertical 1080 x 1920, `dim` 2d or 3d). You write the scene files in `scenes/` (listed in
`project.json` "scenes"), new elements in `models.js`, and `audio/beds.json`. The app renders, mixes and exports.

Read first, in this order:
1. `references/RULES.md` - do / don't, the extension points, what may never change. Law.
2. `references/engine_api.md` - every building block with its options, 2D and 3D.
3. `references/example_scene.js` - one complete, correct scene to copy patterns from.
4. `references/sound_design.md` - beds.json and the automatic sounds.
The style's own files (when there are any: `skill/STYLE_GUIDE.md`, `PITFALLS.md`, `QUALITY.md` of the style) win over
the starter's neutral look; the rules and the engine API stay.

## Workflow
1. Read `audio/script_timed.txt`. Plan the shots in `storyboard.md`: one idea per shot, what lands on which word.
2. ELEMENTS FIRST: every new element is made with `registerElement` in `models.js` and shown alone with `kitShot`
   (`lib/kit.js`) on light and dark; `check_layout` must say Clean on it and `render_frames` must look right at full size
   before any scene uses it.
3. Build the scenes, section by section, in `scenes/*.js` with `shot({ t0: cue(...), build(S) { ...; return st } })`.
   Positions from the layout values (`ZONE`, `SAFE`, `BAND`, `TITLE`, `VERT`), never from numbers that only fit one format.
4. VERIFY every scene: `check_preview` (no errors, no cue misses), `check_layout` until it says Clean, then
   `render_frames` at the moments things land and the middle of each shot. Fix the cause, look again only where you changed.
5. Write `audio/beds.json`. Don't render, mix or export.

## Non-negotiables
- Frames are pure functions of time: no `Math.random` (use `rng(seed)`), no `Date.now` / `performance.now`, no DOM, no
  network, no timers in scenes.
- Never rename or remove an engine export; change the engine only through THEMES, registerElement, LAYOUT_CHECKS,
  TRANSITIONS and POST_UNIFORMS / POST_GLSL.
- Nothing cut by the frame edge, nothing in the caption band, no accidental overlaps, every text >= 40 px and readable
  (contrast >= 3), never a near-empty or too-dark frame, eased camera moves. In 3D: everything rests on what holds it and
  nothing passes through anything.
- A finding of `check_layout` is fixed at its cause. The `mustfail_*.js` scenes of a style are meant to fail: never "fix" them.

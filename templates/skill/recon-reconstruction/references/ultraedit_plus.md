# Ultraedit+ : match each shot to a painted target (the measured match loop)

Read this before an Ultraedit+ build or an Ultraedit+ pass. The method comes from three shot-match runs (cafe, dig escape,
prison tunnel): a measured, adversarial loop turned "close but weird" scenes into frames whose layout matched the reference
almost exactly, with zero clipping. Layout converges in 1-2 passes once it is measured; poses take about 5 passes; light and
grade about 10. Procedural materials plateau around 6-7/10 against a painted target: that is fine, stop there.

**The cast is fixed.** The people (figure type, body, surface, outfit, colours, glow, pose, count) never change, even when the
target paints them differently: the image model is told to keep them, the critic is told to ignore them. Ultraedit+ upgrades the
ENVIRONMENT only: set dressing, props, background detail, materials and textures, lighting, atmosphere, depth and grade.

## The tools (the app runs them; you never render, mix or export yourself)

- `make_target { shot, prompt, from_still? }` - your image service paints the ideal frame of shot N in this project's look.
  The app puts the look line (Studio or Investigation theme) in front of your prompt and adds the shot's narration. Write
  what the frame shows: subject and action, the place, the camera (angle, height, distance, lens: wide / normal / tele), the
  light and mood, foreground / midground / background. No text in the picture. `from_still: true` = image-to-image from the
  shot's current render (keeps its camera and layout); without it, text-to-image. Saved as `assets/targets/shot<N>.jpg`,
  counted against the project's image budget. Make each target once; remake it once only when it has text, warped people or
  a set a 3D scene can't hold.
- `match_shot { shot, t? }` - one PASS: renders the frame (default the middle of the shot) at full size and writes
  `.suite/match/shot<N>/pass<K>/`: `_target`, `_render`, `_side` (target LEFT), `_blend` (misplaced masses show double),
  `_edges` (the target's edges in cyan over the darkened render: lines that miss = layout off), `_crop<k>` (centre + the
  regions that differ most, target left) and `_regions.txt` (mean colour of 12 regions: hex, dL, d). Returns the mean
  difference (0-1), the region table, the layout checker's issues at that moment and the side by side.
- `make_texture { name, material, tile_m }` - ONLY offered when the project's image service is Google Flow (free there): a
  seamless 2K texture for a big visible surface (floor, walls, table tops, sofas) instead of a canvas material; subtle and
  stylized, never photo-real; returns the lines to use it (RepeatWrapping, repeat = surface metres / tile_m). Small things keep
  canvas-materials; pictures and small details the target shows come from `make_image` as image planes. One picture per
  request; look at each once and remake only a wrong one. Without the tool: canvas-materials as before.
- `critic_shot { shot }` - a FRESH read-only Opus critic (no memory, reads only the last pass's files) scores 1-10 and
  ranks the top problems with concrete fixes. Run it after every 2nd pass.

## The loop, per shot

(The Ultraedit+ prompt you were given wins where this differs.)
1. A NEW target every run (make_target, from_still on a finished video) and a look at it.
2. Write the numbered GAP LIST: every light source in the target (background bulbs, string lights, signs, windows too) and where
   its light lands, region brightness/colour, atmosphere, materials and textures, every missing prop and detail.
3. 4 passes, each a big visible move that ticks gap-list items off: LIGHT every pass until every listed light works (real
   spot/point lights with soft shadows, emissive practicals with toneMapped false, rims, haze), plus materials/textures and set
   dressing/detail. Camera and layout only when the edges overlay is clearly off. `match_shot` after each pass.
4. `critic_shot` after pass 2 and pass 4. Keep an accepted / rejected ledger in `.suite/build-progress.md`. Verify each claim
   on the edges overlay: critics are reliable on materials and light, unreliable on hidden geometry. Never act on the people.
5. **Stop** after 4 passes (earlier at critic >= 8 and 0 layout issues). Up to 2 extra passes only when the pass-4 critic is
   below 8 and a big gap-list item is still open; name it first. Then check_preview and the next shot.

## Gotchas (each cost passes before)

- **S.collide must be declared** (`S.collide = { bodies, solids }`) in every shot with people: without it body clipping is
  never checked and the checker reports 0 issues while bodies pass through furniture.
- AI targets are not one perspective: people are often drawn 1.2-1.9x the structure, booths that can't physically fit.
  Weight the subject: match its size and place first, then fit the set around it (widen a room rather than intersect).
- Don't hand-tweak a solved camera: drift of ~100 px came back each time. Re-fit the scene, not the camera.
- The engine's roll sign is opposite to most tools: check it with one marker render.
- The theme grade caps highlights: a saturated glow from the target turns pastel. Use the Library's
  `look.recon.shot-match-neutral` settings when the target needs it (never write settings.graphics).
- Box UVs stretch one tile over big faces (reads as planks): use metric UVs (module.any.metric-box).
- `onBeforeCompile` patches need a `customProgramCacheKey` or three.js shares the program.
- `act({ seat })` re-seats a figure every tick: group y offsets are ignored.
- Don't log from ticks: the checks render hundreds of frames.

## Library entries to reach for (library_search, then library_use)

- Modules: `module.recon.glow-person` (emissive figure, rim, outline), `module.recon.canvas-materials` (soil, concrete, wood,
  cloth, brick presets that survived critics), `module.recon.rig-pose` (hinge, lean, footTo / kneeTo helpers),
  `module.recon.cafe-props` / `prison-props` / `mine-props`, `module.any.metric-box`, `module.any.relief`, `module.any.cloth-drape`,
  `module.any.haze-beam`, `module.any.frustum`.
- Recipes: `recipe.recon.night-cafe-cutaway`, `recipe.recon.prison-wall-dig-diorama`, `recipe.recon.cell-shaft-tunnel-section`.
- Solutions: `solution.any.order-of-work`, `solution.any.critic-protocol`, `solution.any.overlay-pack-per-pass`,
  `solution.any.solve-camera-trust-the-solve`, `solution.any.marker-proof`, `solution.any.procedural-material-ceiling`.
- Pitfalls: `pitfall.recon.collide-must-be-declared`, `pitfall.any.ai-reference-inconsistent-scale`,
  `pitfall.recon.roll-sign`, `pitfall.recon.grade-highlight-cap`, `pitfall.any.srgb-vs-linear-colours`.

## Never

Change a shot's start time, its cue words, the narration or the order of events; edit the checks (lib/contact.js,
lib/collide.js); copy text from a target into the scene; keep a version that is worse than the one before (go back).

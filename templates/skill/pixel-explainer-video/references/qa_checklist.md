# Visual QA checklist

Run after writing each section, and again on the final file. The reference video needed ~40 fixes
found only this way - assume every section has problems until a sheet proves otherwise.

## How to sample
- Per shot: 0.4 s after `t0` (first impression), the moment 0.3 s after each key cue lands, and 1 s
  before `t1`. Plus a few mid-transition frames (`t0` of the next shot +/- 0.1).
- Batch 12-20 times per call: `node render.mjs $P stills --times ... --name check` then
  `python $SKILL/scripts/sheet.py $P check 3`, and look at `out/check_sheet.png`.
- For small text or detail: `stills ... --scale 1` then `sheet.py $P check --tile 1280 --keep` (one full-size
  frame per row) or Read the PNGs in `out/check_frames/` directly.
- Final file sweep: `ffmpeg -ss <t> -i out/X.mp4 -frames:v 1` at ~24 evenly spaced times -> sheet.
- Sync spot-check: grab frames ~0.35 s after chosen word starts (elements fade in over ~0.3 s; at
  +0.08 s they are still barely visible).

## What to check on every tile
Readability
- [ ] Can a first-time viewer tell what this shot is about without audio? One subject, clearly framed.
- [ ] Is the thing being talked about *visible* (not hidden behind geometry, not off-screen, not tiny)?
- [ ] Text: no overlaps with other text/cards/3D focal points, inside safe margins, not scrambled at rest.
- [ ] Numbers match the narration (units, decimals, counters landing on the spoken value).
Quality
- [ ] Depth: shadows present, outlines separating shapes, sky/fog giving distance. No empty flat planes.
- [ ] No large glaring flat areas (bright top colours), no checkerboard noise on flat colours.
- [ ] Models have detail and character appropriate to their screen size.
- [ ] Cards: sharp, labelled, not covering headlines, gone when the idea ends.
Timing
- [ ] Elements land on their spoken words (compare tile time with `script_timed.txt`).
- [ ] No blank or half-built first frames; no stale text from a previous beat lingering into a new one.
- [ ] Transitions: both sides look intentional mid-transition.
Technical
- [ ] render.mjs printed no page errors, missing files or `cue miss`.
- [ ] GPU line in render.mjs output is a real GPU (not SwiftShader/llvmpipe).

## Common failures -> fixes
- Text collides: move to another corner, shrink, or fade one element out before the other arrives.
- Subject too small/cropped: change camera distance/height; frame the subject in the middle 60%.
- Camera inside geometry: raise it or offset along the street/aisle; re-check.
- Scene reads as "abstract cubes": replace with a concrete diorama (see scene_design.md recipes).
- Fogged-out background: raise `S.fogFar`. Harsh sky banding: sky gradient only near the horizon (engine default).
- Scrambled labels at rest: `noKinetic: true` for dimmed/static-alpha headings.
- Crash in one shot (whole section black): check render.mjs output for the error; often a missing ramp
  name or an undefined `st.tX` cue variable.

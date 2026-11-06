---
name: blender-toon-shorts
description: Build 3D cartoon shorts in Toon Studio with the Blender engine - our own big-headed toon characters with drawn faces that change on the words (49 expression presets landing with overshoot, takes, automatic lip-sync), rubber-hose acting, sitting checked every frame, densely dressed sets from a 148-prop library, brush-weight ink outlines, colour-scripted EEVEE light, a camera that flies between framings through one continuous set, dissolves where the story jumps, all rendered hidden and headless. 9:16 (1080x1920). Use for every build, edit and Ultraedit of a "3D cartoon shorts" project on the Blender engine (style id blender).
---

# 3D cartoon shorts on the Blender engine (blender-toon-shorts)

Cel-lit 3D cartoon shorts: white round heads with drawn grey faces, coloured bean torsos with costume detail, black
noodle limbs and ball hands, near-black outlines that are heavy on the shadow side, sets dressed to the last label,
light with a shape (pools, stripes, window panes), strong depth of field, a camera that flies from framing to
framing inside one set and creeps while it holds. The craft was measured frame by frame on the owner's own short and
proven on five films; the night-2 build produced three shorts the owner called marvellous. That is the bar, 100 %.
Every character, set, prop, sign and joke you make is ORIGINAL: the reference is a measured answer key for craft only.

The engine draws the characters, the faces (from numbers, one picture per frame), the lip-sync, the walks, the
sitting, the ink and the camera; it checks every render for limbs inside things. You write Python scene files that it
runs inside Blender.

Read, in order:
- `references/sop.md` - THE PROCEDURE in the app, gate by gate, with what the app does for you
- `references/engine_api.md` - every call (cz, char, cam, the tools) with working examples from the films, frames and time
- `references/camera.md` - the grammar numbers, `shot()` / `frame()`, flights, creep, pushes, the recipes
- `references/sitting.md` - seats, lying, riding: bodies ON things, the contact report
- `references/catalog.md` - the 148 props, the 49 faces, poses, gestures, extras, costume ideas
- `references/qa.md` - the bar: the gates, the critic's rubric, the numbers, the measured-quality rule, the grade
- `references/enrich.md` - the Ultraedit method: previs -> enriched target -> build the extras for real; the crew
- `PITFALLS.md` - every failure the lab logged, as rules (read it before the first sequence)

## The build, step by step

1. **The words.** Read `audio/timeline.json` (phrases with words `{w, s, e}`) or `narration`. Frame of a word =
   `round(start x 30) + 1` (`cz.frame_of(t)`); frame 1 = 0.0 s, `t = (f - 1) / 30`. In the scene files `W = cz.words()`
   gives them as `{word, start, end}` (what lip-sync takes) and `cz.at(W, 'word', n)` finds one (engine_api.md §12).
2. **The storyboard: PLAN.md.** Sequences = one continuous set each (cuts only on a set change or a time jump), 6-11
   files for 60 s, tiling the film from frame 1 to the end. One picture per clause: ~4.5 framings per 10 s (4.5-5.5),
   each arriving 0-3 f before its word, holds that creep ~0.19 % per frame, flights of ~13 f measured (author 16-20 f),
   a push into every set change, dissolves (8-12 f) where the story jumps. Every line gets its exact picture; quoted
   speech is lip-synced; numbers become things. The cast, the sets, the light and colour script per set.
3. **cast.py**: one function per character (`char.Char` + hair and costume builders + `face_style`); costume parts on
   the torso's visual surface. Check a lineup render and the face sheet.
4. **sets.py + dress_<set>.py**: layout with all walls and real holes, the light (a motivated key with a shape, a
   complementary fill, rims, practicals), then the dressing: painted surfaces with wear first, then props from the
   library, then one foreground object. A test render of each set's widest framing before dressing.
5. **Sequence files s01.py, s02.py ...**: `F0, F1 = <first>, <last>` (literal global frames on the narration) and
   `build(ctx)`: setup -> set -> cast -> staging (`place`, `walk`, `sit`, `hold`) -> acting on the words -> `Char.bake`
   -> camera framings -> `Cam.bake` -> `return F0, F1`.
6. **Faces on the words.** `face(t, name)` ON the stressed word (it lands in 5 frames with an overshoot; brows lead;
   `big=True` blinks through the change; take presets squash and stretch the head), `blink(t)` on beats, `look()` for
   glances, `talk(t0, t1, words)` on quoted lines (lip-sync is automatic from the words), heads never dead frontal.
   Gestures land ~3-5 frames before the stressed word (`pose(..., antic=0.1-0.15)` for big ones).
7. **Render headless and read the contact report.** Every run.py render prints `CZ CLIP` / `CZ SITCHECK` and
   `CZ CLIPCHECK clean` or a count. It must be clean, or every remaining sample explained (a gag marked
   `cz_contact_ok`). Read the log before looking: `Traceback`, `CZ PROP FAILED`, `CZ SIT`, `CZ CAM`, `Shadow buffer full`.
8. **Look at the stills.** Every framing at its landing and its words (`render_frames`, or run.py frames tiled into one
   sheet); motion frames (4-6 in a row) at every walk, gesture, sit, hold and flight. Ask the rubric's questions (qa.md
   §1). The metrics pass while pictures fail: look at every tile, feet, seats and hands included.
9. **Fix, then look again at only what changed.** Rig signs are tested with a 3-frame render, never reasoned out.
10. **Keep a change only if it measurably improves** what it was made for (a number, the critic's axis, a pixel A/B);
    otherwise revert it. Composition is never traded for density.
11. **Assemble and finish**: assemble.json (order, dissolves, match cuts), the frames around every transition looked
    at, the grade probed per film and written into PLAN.md, the camera grammar measured, every shot clean. The app's
    export renders, assembles, grades, mixes and captions.
12. **Learn**: every failure -> cause -> fix in NOTES.md; engine gaps in your summary (never edit the engine).

## Machine rules (for you and for every helper you brief)

- Blender runs HEADLESS only: `<blender> -b --factory-startup -P <engine>/engine/run.py -- s03.py --frames ... --out
  renders/...` with `CZ_PY=<python>` (the project's CLAUDE.md names the three paths). Never a Blender window, never any
  visible window, never sound.
- **ONE render queue of at most 4 Blenders** on the machine, counting the app's preview (up to 2). Test renders one at a
  time (two at most), 2-6 frames at `--scale 0.3-0.4 --samples 12`; never a second render pool; final renders only
  through the engine's `render_queue.py` (the app's export).
- Files only with Write / Edit. No heredocs, no `python -c` / `node -e`, no shell redirects into files, no `rm` with
  wildcards or variables: every round renders into a NEW folder under `renders/`.
- Scripts run as files with `<python>`; `<python> -m py_compile` every edited file before a render round.
- Stay inside the project; never edit the engine folder.

## Non-negotiables

- Every clause gets its own literal picture; the beat is in frame on its word, never during a flight.
- Faces are the performance: the face the shot is about is readable, lit, near-white, turned 15-20 deg, changing on
  the word.
- Nothing through anything, nobody floating: the contact report is clean on every shot of the final render.
- Light has a shape and a colour script per set; nights bright and saturated; no flat untextured area on camera
  bigger than a sheet of paper.
- The camera flies and creeps; holds never wobble; a jolt only on a hit.
- Characters are our own designs built with `char.Char`; never photos, never real people, never the reference's cast.

## Sound

`scripts/sound_design.py` is the 3D cartoon shorts (Three.js) engine's sound-design script, copied here UNCHANGED as
a placeholder: the Blender engine's events for it are only the shot starts for now (no hits, no actions yet), so do
not schedule sound effects in the scene files. The voiceover leads; no music unless the user asks (Project settings >
Music).

## Banned in every style (the owner's no-slop rules)

- No red stamp / plaque / verdict overlays slammed on ('CLOSED', 'DENIED', 'CASE CLOSED', 'THE END' ...): show the
  fact as a real object (a document with a highlight, a sign, a screen).
- No notice that the voice is AI ('AI-generated voice' or anything like it), ever, anywhere.
- No real brands, logos, people, shows or channels: invented names only.
- Every frame must read: the subject lit and visible, text held >= 1.5 s after it settles, nothing through anything.

# SOP: narration in -> finished shots (the Blender engine inside Toon Studio)

The lab's method (three shorts the owner called marvellous), step by step, with what the app does for you. Every step
ends in a GATE; don't start the next step until it passes. The bar and the numbers: qa.md. The calls: engine_api.md.

## What the app gives you

- **The words.** The app transcribes and times the voiceover: `audio/timeline.json` = phrases `{s, e, text, words:
  [{w, s, e}]}`; `project.json` `end` = the last word + 1.2 s. The `narration` tool lists words with times. In the
  scene files `cz.words()` reads them as `{word, start, end}` (what lip-sync takes), `cz.at(W, 'word', n)` finds one
  (engine_api.md §12).
- **The engine and the tools.** The app finds Blender 5.2+ and ships the engine folder (engine, tools, 148 props,
  faces, textures, the reference's measured numbers) and a Python with Pillow + numpy + OpenCV. The project's CLAUDE.md
  names the three paths, written here as `<blender>`, `<engine>` and `<python>`. When it does not name them, say so in
  your summary instead of guessing.
- **The preview.** The app builds each shot once in a hidden Blender (at most 2 at a time) and shows its frames:
  Solid (fast, flat colours) while scrubbing, Look (EEVEE as rendered, few samples) when the playhead rests. A click
  on the picture becomes the selection: `get_selection` returns the object, its owner root and the character (name
  every part `<prefix>_<part>`, so a click leads to the file that builds it). Any edit to a .py / .json / picture
  restarts the shot's server; what lands in `faces/`, `shots/`, `renders/`, `frames_*` does not. So test renders,
  sheets and scratch scripts go under `renders/`.
- **render_frames**: Look stills (16 samples) of the current files at given times (seconds), through the same hidden
  Blender. Cheap to look with; it does NOT print the contact report (the preview runs with the check off). The run has
  a frame budget: look at what you changed.
- **list_shots**: the shots the app read (from each file's `F0, F1` line and the order in assemble.json).
- **check_layout** has no checks for this engine: the contact report of a run.py render is the machine check.
- **Export** is the app's: it renders every shot through the engine's render queue (4 Blenders, full size), assembles
  the dissolves and match cuts, grades, mixes the voice and burns in the captions (Captions in the project settings).
  You leave the project ready for it (step 7).

## Machine rules (the owner has been burned by each of these)

- Blender runs headless only: `<blender> -b --factory-startup -P <engine>/engine/run.py -- <seq.py> ...`. Never open
  Blender's window, never any visible window, never sound.
- **ONE render queue, at most 4 Blenders on the machine at a time**, counting the app's preview (up to 2). 8-10
  Blenders filled a 16 GB card and every frame took 90 s instead of 2. Test renders one at a time (two at most); never a
  second pool; no test renders while a final render runs; final renders only through `render_queue.py`.
- Write files with Write / Edit. No heredocs, no `python -c` / `node -e`, no shell redirects into files, no `rm` with
  wildcards or variables (it stops for a permission dialog on the owner's screen): every test round writes into a NEW
  folder (`renders/test/s03_r4/`).
- Scripts run as files with `<python>` (Blender's own Python has no Pillow: PNG makers run outside Blender).
- `<python> -m py_compile <every edited .py>` before a render round.
- Stay inside the project folder. Never edit the engine folder.
- Generated folders stay out of the project history: the project's `.gitignore` must list `faces/`, `shots/`,
  `renders/`, `frames_*/`, `__pycache__/` (add the missing lines; keep the app's).

## G0 - Inputs (minutes)

Read `audio/timeline.json` (or `narration` from 0 to the end), `project.json` (`end`, `settings`, the build quality).
GATE: you know the length in frames (`round(end x 30)`), every sentence and its start frame, the story's turns.

## G1 - The plan: PLAN.md (Claude, ~15 min)

Write it before any scene file.
- **Sequences** = one continuous set each; cuts only on a set change or a time jump. A 60 s short: 6-11 sequence
  files, 3-5 sets. The files tile the film: `s01` starts at frame 1, each next F0 = the previous F1 + 1 (overlapping
  only where a dissolve needs pads), the last F1 = the last frame of the video. Boundaries sit on sentence starts or set
  changes.
- **Framings on the words**: one picture per clause, ~4.5-5.5 per 10 s (merge before adding; extra pushes become creep
  inside a framing), each arriving 0-3 f before its word, flights 16-20 f, holds that creep ~0.19 %/f, a push into
  every set change, dissolves where the story jumps (camera.md).
- Every narration line gets its EXACT picture: a ticking clock = a CU with a ticking second hand; "his chair is pushed
  in" = an angle that shows it. Quoted speech = lip-sync (`talk`); inner thoughts = the character turns to the camera.
  Every number spoken gets a thing you can count or read. Abstract ideas become physical objects.
- **Cast**: original designs (never the reference's characters), one strong colour each, costume detail that reads
  at phone size.
- **Sets**: designed for THIS story, a place you could walk around in, the side each camera looks at, real holes behind
  every door and window, the light (one motivated key with a SHAPE, a complementary coloured fill, rims, practicals),
  a colour script per set (unique, saturated; nights bright and saturated, never realistic).
- **Props**: from catalog.md first, new ones only when the library has nothing; moving parts named.
Format (from the Bell film):
```
# <title> - plan. Voiceover 59.52 s, frames 1-1786
## Cast (cast.py)
- MAUD (the wife): dark teal dress, white lace collar + apron, a tight bun with a comb, a cameo brooch.
## Sets (sets.py, dressing dress_<set>.py)
- FRONT ROOM (night / flashback / sunrise): rocking chair, grandfather clock, sash window (moon panes on the floor) ...
  Night = blue-violet moon only; flashback = warm candle-lit; sunrise = gold sun shafts through the window.
## Sequences (global frames; one file each, build(ctx) -> (F0, F1))
| file | set | frames (s) | words | framings |
| s05 | FRONT ROOM night | 869-980 (28.92-32.67) | She's sitting in the dark with a shovel by the door ... | R 28.92 WS MAUD in the rocking chair, moon panes, the clock -> S 30.15 CU shovel by the door -> T 31.20 MCU MAUD, knowing look |
33 framings / 59.5 s = 5.5 per 10 s.
## Colour script
## Grade (filled in at G7)
```
GATE: every clause has its framing and its picture; framings per 10 s in range; no framing whose hold would be under
0.3 s; cast and sets designed; the files tile the whole film.

## G2 - Cast (cast.py)

One function per character returning `char.Char(...)` (engine_api.md §5): torso, belly, hair builder, costume builders,
`face_style`, shoes. Costume parts through `_chest()` (on the visual surface, not inside the torso).
Check: a lineup scene (a sequence-like file under `renders/` that builds every cast member in a row, one camera; render it
with run.py) and the face sheet (`facegen.py --sheet` with each face_style). Hair colours one step darker than you
think (a warm key lifts hair ~3x: #5c2c0f rendered salmon, #2e180b reads deep brown).
GATE: each character reads at phone size, the faces sit right (brows not lost under the hairline, glasses not reading
as sunglasses), no costume part inside the body.

## G3 - Sets (sets.py: layout + light; dress_<set>.py: the detail)

- One function per set (`front_room('night')`), layout only, then its light, then `dress('dress_front_room', mode=...)`
  (engine_api.md §12) and `cz.no_shadow()` at the end. The dressing file owns the detail (one writer each).
- Build all four walls (camera-side walls far away or within the camera bounds), close every corner, a ceiling only
  where a camera looks up (high cameras see over it), real holes behind every door and window, a 360-degree sky drum
  outdoors.
- Surfaces first: painted wall / floor / ceiling textures with wear (stains, scuffs, patched holes, ghost rectangles,
  a worn path), trims, raceways, fixtures, signage; then props; then ONE foreground object for depth. No flat
  untextured area bigger than a sheet of paper on camera.
- Light before dressing: the key with a shape (sun through a real window, a lamp pool, a moon back key), fills low
  enough that the shape survives, practicals glowing. Check the light with a test render of the set's widest framing
  before you dress it (the Bell critic: "light design per shot before dressing ... from the first round, not the fifth").
- Pictures (posters, labels, screens, signs, textures): Pillow scripts in `tex/` run with `<python>`; the app's image
  tool for painted pictures (never text in a generated image: draw text yourself).
GATE: a test render of every set's widest framing: no hole, no world colour showing, the light has a shape, the
surfaces are painted.

## G4 - Sequences (sNN.py; 15-25 min each incl. 2-3 test loops)

`build(ctx) -> (F0, F1)` (engine_api.md §2). In this order:
1. `cz.setup(F1)` (or the pad end), the set, the cast.
2. Staging: `place` (yaw 0 faces the camera side), `walk`, `sit` (sitting.md), `stand`, `hold`.
3. Acting on the words: gestures land ~3-5 f before the stressed word (`pose` with `antic` for big ones), faces change
   ON the word (`face`, `big=True` for a real change, a take for a shock), `blink` on beats, `look` for glances,
   `talk` on quoted lines (`loud=1.6-2.0` to shout), head angles never dead frontal (`set(hyaw=14..24, hroll=..)`).
   Lip-sync is automatic from the words you pass; expressions land with an overshoot by themselves.
4. `c.bake(F0, F1)` for every character, then props animated by hand (`cz.bake`), then the camera (`shot` / `frame` /
   `push`), `Cam.bake` last.
5. Test loop: 1-2 frames per framing at `--scale 0.3-0.4 --samples 12` into a new folder; read the log first
   (`Traceback`, `CZ PROP FAILED`, `CZ SIT`, `CZ CLIP`, `CZ SITCHECK`, `CZ CLIPCHECK`, `CZ CAM`), then a sheet, then LOOK
   at every frame. The usual failures: the camera inside a wall / prop / door leaf / armrest / head, the back of a
   head, a flight through something, a prop facing the wall, a subject outside the set's bounds, a beat in a flight.
6. Motion frames (4-6 consecutive) at every walk, gesture, sit, hold and flight once the stills pass.
Signs (lean, pitch, roll, rotations) are TESTED with a 3-frame 0.4x render, never reasoned out.
GATE: `CZ CLIPCHECK clean`, every framing's still passes the qa.md questions, motion frames clean.

## G5 - Detail loop per set (the owner's bar: "make every single little detail pop")

Per set, at least 6 rounds: render the set's real framings, put them beside what they should carry (the plan's
dressing list; in Ultraedit the enriched targets, enrich.md), add, re-render, look. Match the reference genre's
density and kinds of detail with your own content: every shelf full, labels, wear, cables on walls, little lights.
GATE: no flat area on camera, the extras inside each camera's frame (checked in a render, not assumed from the file).

## G6 - Assembly (assemble.json)

`{"dir": "shots", "shots": [order], "dissolves": [[out, in, f0, f1], ...], "matchcuts": [...], "prerender": [...]}`
(engine_api.md §10). Dissolves 8-12 frames (measured on the reference), on time jumps and where the story jumps; bake
the pads in both files. Step through every boundary of the assembled film frame by frame (a match cut and four
dissolves of the rebuild were invisible on step-6 sheets).
GATE: every shot listed once in order; every dissolve has both shots' frames over its window; the frames around every
transition looked at in the assembled film.

## G7 - Light and grade, the film numbers, leave it ready

- Light per set against the numbers: luminance / saturation / contrast / sharpness with `gradeprobe.py` on the set's
  frames (qa.md §3): nights bright and saturated, interiors light, one motivated key per set.
- The grade: probe 2-4 tries on every 20th frame of the whole film, LOOK at the graded samples, write the chosen
  options into PLAN.md under "Grade".
- The camera grammar from the files (camera.md §3): framings per 10 s, median hold, median flight.
- Ready for export: every sequence builds headless with no Traceback and a clean contact report; the F0 / F1 lines
  tile the film; assemble.json complete; no test files outside `renders/`; PLAN.md current.
GATE: qa.md §0 all green.

## G8 - Learn

Every failure -> cause -> fix, one line each, in `NOTES.md` in the project (what you saw, why, the rule). Problems in
the engine (a missing feature, a bug): work around them in your own file and list them in your summary; never edit
the engine.

## Build quality levels

The build request says which level. All three keep the bar (qa.md); they differ in how much is checked and how.
- **Standard**: G0-G8 in one session; stills at every framing's landing, the contact report clean on every shot.
- **Verified**: Standard + motion frames on every move, the grade probed, the grammar measured, a full review sheet
  (every 15 frames) looked at before the end.
- **Ultraedit**: Verified + the enrich loop on every set's key frames (enrich.md), adversarial critic rounds on the
  rubric (qa.md §1), the measured-keep rule (qa.md §4), a crew when the build runs as one (enrich.md §5), within the
  build's time limit.

## Times (RTX 5080, measured)
Plan ~15 min; cast + sets + props 30-45 min with helpers in parallel; each sequence 15-25 min with 2-3 test loops; a
60 s film ~1-2 h to a full cut. Test render: ~1-3 s a frame at 0.4x / 12 samples plus the build (4-8 s). Final:
~2.2 s a frame per Blender with 4 in parallel (day sets), ~6.3 s for dense night sets; a 60 s film 35-70 min.
48 -> 24 samples saves only 16-28 % (per-frame fixed costs dominate) and is indistinguishable (PSNR 44-48 dB).

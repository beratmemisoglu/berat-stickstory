# SOP: a Stick stories video from narration to finished shots

Every step ends in a GATE. Don't start the next step until the gate passes. When a gate fails, fix the cause (not the
symptom), then re-run only the check that failed. The bar and the failure patterns: qa.md. The calls: engine_api.md.
The mistakes earlier builds made: ../PITFALLS.md (read it before G2).

Your tools in the app: `narration` (words with times, `from` / `to`), `check_preview` (load errors, `say miss`, `cue
miss`, unknown names), `check_layout` (`times`, or `from` / `to`, or nothing = every steady frame), `render_frames` (1-8
`times` per call, `scale` .25-1, `who` = your name in a crew), `list_shots` (every shot with its time range, title and
file:line), `get_selection` (what the user clicked), `remember_rule` (a style rule for later). Every image stays in your
conversation: look at what you changed, at scale 0.5 for stills and 0.25 for sheets.

## G0 - Inputs

- Read `audio/script_timed.txt` end to end and project.json (`settings.format`, `settings.look`,
  `settings.characters`, `"end"`). The narration tool gives every word a time.
- The script's shape (script.md): sentences; `[Name]` lines are a character's own voice (lip-sync them); word-free beats
  (`(beat Ns)` in the script) are real silences in the audio: a gap of N s between two lines' times.
- GATE: you know the length, the 12 story beats and where they fall, the cast (who speaks, who is "you"), the places, the
  numbers that are spoken, and every silence longer than 1.5 s.

## G1 - The storyboard

Write it before any scene (storyboard.md in the project; a crew part writes `.suite/crew/<part>.md`). At the top the
SHARED decisions; then one row per shot.
- SHARED: the cast (`S.char` id or look per person, one look for the whole video: catalog.md §2); the places (base
  `S.place` name + mood + what THIS story adds; a place in several parts = a models.js function; its own cards coloured
  with `S.tone('#hex')` so night stays night); the HUD conventions (which counter / label / icon runs the whole video,
  where it sits: engine_api.md §9 "one element per corner" and "one look per running device": the running counter is
  ONE `UI.hud` item kind in models.js with its values on the timeline, written once, never re-made per part); the
  devices (how each abstract idea becomes a picture: storyboard.md §2) and which characters are `free: true` in which
  frozen / special stretch.
- ROWS: `#`, the `say` words (first 2-4 words exactly as spoken) or `t0` (a wordless beat), the type (INS / CU / ONE /
  TWO / WIDE / GFX / TITLE / SPLIT), the literal picture, place + framing, who does what on which word, the faces, the
  graphic and the word it lands on, the camera, the transition, the sfx.
- Shot count: about 25 a minute (`minutes x 25`; 8 minutes = ~200-210). One picture per clause; ~1.4 per sentence.
- Mix (storyboard.md §1, per 100 shots): ~32 inserts (hands, props, phone / device screens), ~23 face close-ups (speakers
  + 0.5-0.7 s reaction cuts), ~15 one-person acting shots, ~8 two-person interactions, ~8 wides / overheads, ~8 full-frame
  graphics, ~3 title / chapter shots, ~2 split screens.
- Every spoken number = an on-screen number in the same shot, landing on its word. Every list item = its own picture.
  Every new place = a wide first with a corner time / place label. Every dialogue line = the speaker's close-up, a
  listener reaction between lines. Every explanation = a full-frame graphic held 4-10 s across 1-3 sentences, with 0.5 s
  cuts to the hero's face between ideas. Every word-free beat = 1-4 shots of ACTION or REACTION (2-4 s beats) or a run of
  5-8 shots of 0.4-2.3 s (the long action beats).
- GATE: every clause and every beat has its row; the count and the mix are near the targets; every number has its
  graphic and word; no picture over ~5 s without a reason (acting, a push, a building graphic); the hook shows the
  condition by 15 s and the title lands by ~30 s; the cast and places are fixed; no three neighbouring rows with the same
  picture (place + framing + subject), and a stretch of more than ~6 rows in one place changes angles (high, low,
  reverse, insert); every action a clause names (carry, drag, hug both, drop onto the sofa, slip, catch) has the engine
  call that SHOWS it (engine_api.md §6), not a pose near it.

## G2 - Each scene file loads and check_layout is clean

Write one chapter (or your crew part) at a time, in passes of 4-8 shots: write, `check_preview`, look, fix, next pass.
1. `check_preview`: no errors, no `say miss` (the say words must be in the narration, in order, AFTER the previous
   shot's: a phrase that repeats gets `t0`), no `cue miss` (fix the word or use `{ after }` / `{ near }`), no `unknown
   place / prop / fx / info` warnings. `list_shots`: your shots start where the storyboard says.
2. `check_layout` with `from` / `to` = the range you wrote. Fix every finding at its cause:
   - `offscreen` (the subject's head out of frame): frame on the subject (`on`), or `S.subject = a`.
   - `cropped` (eyes / face cut by the frame edge in a close framing): frame wider, `y: -.1`, or move the person.
   - `covered` (a pill / label / HUD over the face): move the overlay (`pos: 'top' | 'bottom'`, another corner) or the
     person (`x` of the camera).
   - `through` (two people inside each other, not touching): space them (> 1.1 heads apart, or 0.25 m apart in z). In a
     split screen stand the two panels' people at different x.
   - `floating` (feet above the floor): the spot's y, a seat that is not a seat (use `sit`), a prop under the feet.
   - `held` (a held prop away from the hand): a prop held and placed at once (hold OR place), or a hold that started
     before the actor's arm layer that covers it (PITFALLS).
   - `dark` / `empty`: a practical light near the subject, another mood, dress the set; a deliberate black / one-colour
     frame gets `dark: true` / `plain: true` on the shot.
   Re-run until it says Clean. A finding that is a deliberate choice goes in the storyboard's open issues with the reason.
- GATE: check_preview clean and check_layout Clean for the range.

## G3 - Stills: every shot at its key words

For every shot, `render_frames` at: just after the cut (t0 + 0.25), each stressed word of its clause (+ 2 frames), and
just before the next cut (t1 - 0.1). 8 times per call, scale 0.5; full size (scale 1, 1-2 per call) where a face, a
graphic or small text carries the beat. Judge each like a viewer (qa.md §2):
- the clause is LITERALLY visible: the noun of the clause is on screen; the stressed word's event happened (the face
  changed, the number landed, the pill popped, the prop moved);
- the subject's face is readable: the right expression, framed by the framing table (style.md §2), not under an overlay,
  not behind a prop;
- the set is a dressed place at real depths, lit, the practicals glowing; the rim light on the people;
- nothing floats, sinks or passes through anything; held props in the hand;
- graphics readable, spelled right, invented names only, nothing banned (no stamps).
Fix, then render ONLY the frames you changed. Two fixes and still wrong: write it in the open issues and move on.
- GATE: every shot passes.

## G4 - Motion: consecutive frames on every action

For every walk, gesture, sit / stand, kneel, fall, reach / take / hand-over, hug, handshake, insert hand, face swap on
the subject, and every non-cut transition: `render_frames` with 3-8 consecutive times 1/24 s apart around the action
(`[t - 3F, ..., t + 4F]`), scale 0.25-0.5. Check (qa.md §3):
- the move takes 2-6 frames, then a dead hold; no arm stuck halfway; no in-between pose that breaks the body;
- feet planted during walks (0 sliding), a stop that eases in 4-7 frames; turns are one-frame swaps (never a slow spin);
- the hand touches the prop in every frame; a hand-off jumps hands in 2 frames; a hug wraps in 4-5 frames;
- face swaps are instant (or a 3-8 frame blend on a mood shift), never on a blink;
- the camera: close-ups still; nudges start 4 frames after the cut and stop before the next one; trucks keep the walker;
- the effect lands on its word (flash, ripple, impact) and is restrained.
- GATE: every action and transition passes.

## G5 - The whole video at once

1. `check_layout` with no times (every steady frame) until Clean.
2. A sample sheet: `render_frames` at scale 0.25, 8 times per call, one frame every ~2.4 s (a crew director: the last
   frame before and the first after every cut between parts + 3-4 frames across each part). Look for: a face under an
   overlay, an empty or flat frame, a repeated picture on neighbouring shots, a person whose look changed, a place that
   changed between shots, a corner HUD that jumps or collides, a light / mood jump inside one scene, missing beats,
   unreadable text, anything copied from a real brand.
3. The ending: the end card carries the question; the last picture pays off the first (a callback).
- GATE: Clean, and the sample passes. Every remaining issue is written down with the reason.

## G6 - Sound

- `S.sfx(type, t)` on visible events only (sound_design.md): 15-25 a minute (35+ in action runs), a UI `blip` on every
  pill, tag, counter step and HUD element, `whoosh` on a scene-changing cut in a pause, `boom` (+ a `riser` before it) on
  reveals and act changes (10-20 a video), foley on every hand action, `step` on walks.
- audio/beds.json: the quiet story bed (`"music": true`, one music bed per section with its mood, about -34 dB (-33 ..
  -36: the music ~19 dB under the voice, music + effects ~15 dB under it; sound_design.md §3), a room tone at -46 dB; 1-3
  planned silences at the darkest moments: no bed there). The user's own music replaces it.
- GATE: grep the scenes for `sfx(`: the count fits the length, every event has its picture, the silences are planned.

## G7 - Finish

- `DESCRIPTION.txt`: a 2-line summary at the top (the app keeps credits below it).
- The storyboard's open issues are up to date.
- Every new failure you hit and its fix goes in your summary as one line (`what you saw: why -> the fix`), in the format
  of PITFALLS.md; `remember_rule` for a lesson that should hold for every video.
- Don't render, mix or export the final video: the app does that. Finish with a short summary.

## Edits (one shot or a few)

1. `get_selection` / `list_shots`: find the shot's file and line. Read the shot and its neighbours.
2. Change it; `check_preview`; `check_layout` with `from` / `to` = that shot's range until Clean.
3. `render_frames` at the moments you changed (and the cuts on both sides when the timing changed); motion frames if you
   changed an action.
4. Don't move a shot's `say` or rename its `// ----` title unless asked (the user's other notes point at them).

## A crew part (scene-builder): the order of work

1. Read SKILL.md, this file, engine_api.md, ../PITFALLS.md, the shared decisions in storyboard.md and your brief; get your
   words with the `narration` tool (`from` / `to` = your range).
2. Storyboard your part in `.suite/crew/<part>.md` (G1 rows) BEFORE any code: ~25 shots a minute of your range.
3. Write your scene file in passes of 4-8 shots on each place's BASE (`S.place(...)`): timing, people and their actions
   on the words, faces, camera, graphics, sfx. Check `.suite/crew/sets.md` between passes; when a place is READY,
   switch its shots to the models.js function (exact import + call from sets.md). Never wait or poll for a place.
4. Your first shot starts on your range's first words; `list_shots` must show your starts inside your range (a phrase
   repeated in another part: `t0`).
5. Sign off your range: G2 (check_preview, check_layout `from` / `to`), G3 (every shot's middle + its key events), G4
   (3-4 frames 1/24 s apart on every walk, gesture and insert), all with `who` = your part name.
6. Report (at most 15 lines): shots and their span, the sign-off results, what you need changed in shared files, open
   problems.
Never edit project.json, models.js, engine.js, lib/*, storyboard.md, another part's file. The HUD in models.js is the
director's; your shots follow its conventions.

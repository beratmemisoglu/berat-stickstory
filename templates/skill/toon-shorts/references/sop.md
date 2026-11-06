# SOP: a 3D cartoon short from narration to finished shots

Every step ends in a GATE. Don't start the next step until the gate passes. When a gate fails, fix the cause (not the
symptom), then re-run only the check that failed. The bar and the failure patterns: qa.md. The calls: engine_api.md.

Your tools in the app: `narration` (words with times), `check_preview` (load errors, `say miss`, `cue miss`),
`check_layout` (`times`: up to 90 moments, or `from` / `to`: a range; no times: every steady frame of the video),
`render_frames` (1-8 `times` per call, `scale` .25-1: the frames come back as images), `list_shots` (every shot with its
time range, title and file:line), `get_selection` (what the user clicked), `remember_rule` (a style rule for later).
Frames cost: every image stays in the conversation and a run has a frame budget. Look at what you changed, at scale
0.5 for stills and 0.25 for sheets; a moment whose files did not change comes back as text.

## G0 - Inputs

- Read `audio/script_timed.txt` and project.json (`settings.format`, `settings.look`, `settings.characters.main`,
  `settings.characters.palette`). `narration` from 0 to the end gives every word a time.
- GATE: you know the length, the sentences, the main character (`S.char('main')` is "you") and whether faces are white.

## G1 - The storyboard (storyboard.md in the project)

Write it before any scene. One row per clause (storyboard.md §2): time, words, the literal picture, set / framing,
camera move, face(s), the action or prop event on the stressed word, the transition in, sfx.
- Shots: a new sentence = a new shot (`say` = its first words); a clause inside a sentence = a beat in the shot. A beat
  every ~1.1-1.5 s.
- Every clause a picture a viewer gets with the sound off; every abstract idea made physical (storyboard.md §7, §8).
- Every spoken number gets an object that changes ON its word (`S.info('led' | 'gauge' | 'bars' | 'digits' | 'clock' |
  'calendar' | 'price' | 'scoreboard' ...)`, or a prop you count: N objects on screen).
- The cast: who appears, with what look (`outfit`, `look`), one strong colour on the hero against the sets.
- The sets, designed for THIS video: for each, the place (`S.place` or `S.room` / `S.floor` + `S.sky`), the light rig,
  12+ story props from props.md (named), 3 depth layers, 2+ glowing practicals, one ticking element, a joke sign, the
  side the camera looks at (dress THAT side). Sets used by 2+ shots become helpers in models.js.
- Transitions: dissolves by default; every hard cut one of the five allowed; whips only inside one set; 1-2 inserts
  (x-ray, map, cross-section) each followed by a reaction; the last shot loops or bookends the first.
- GATE: every clause has its row; every number its object and word; no stretch over 1.5 s without a change; cast and
  sets designed and dressed on paper; the hook pays off by 2-3 s.

## G2 - Each scene file: it loads and check_layout is clean

Write one chapter file at a time (scenes/<chapter>.js, ~6-12 shots, `// ---- N: title ----` above each `shot(`),
registered in project.json `"scenes"` in narration order. Then:
1. `check_preview`: no errors, no `say miss` (the say words must be in the narration, in order), no `cue miss`
   (fix the word or use `{ after }` / `{ near }`).
2. `check_layout` with `from` / `to` = the chapter's time range. Fix every finding (qa.md §1): `caption` (frame the head
   higher: `place: [0, .15]`, a tighter frame, or move the character), `offscreen`, `backface` (turn the body or move
   the camera), `through` (space them; deep seats `back: .45`), `floating`, `dark` (a practical near the subject),
   `empty` (dress what THIS camera sees, add a foreground element, frame tighter), `cropped` (the brows / eyes cut by
   the frame edge: frame wider or `place: [0, -.1]`), `hidden` (the subject's face behind a prop: move the camera or the
   prop), `dim` (the middle of the frame is murky: light the subject, a practical beside it; nights stay blue but
   bright). Prop characters (a modem, a pin with a face) get `userData.face = [x, y, z]` so `caption` sees them too.
   Run it again until it says Clean.
- A finding that is a deliberate choice (a planned back-of-head push into a door) is written in the storyboard's open
  issues with the reason; everything else gets fixed.
- GATE: check_preview clean and check_layout Clean for the chapter.

## G3 - Stills: every shot at its key words

For every shot, `render_frames` at: just after it lands (t0 + 0.25), each stressed word of its clause (+ 2 frames), and
just before it leaves (t1 - 0.1). 8 times per call, scale 0.5. Judge each frame like a viewer (qa.md §2):
- the clause is literally visible; the stressed word's event happened (the face changed, the counter landed, the prop
  popped);
- the face of the subject is readable, the right expression, eyes at 25-45 % of the height, out of the caption band,
  and nothing stands between it and the lens (check_layout's `hidden` catches a covered face; look anyway);
- the set is dense, lit, 3 layers deep; practicals glow; nothing floats, nothing is sunk, nothing passes through;
- the light and grade fit the mood; outlines on everything; signs readable and original.
Fix, then render ONLY the frames you changed. Two fixes and still wrong: write it in the storyboard's open issues and
move on.
- GATE: every shot passes the still list.

## G4 - Motion: consecutive frames on every action

For every walk, gesture, sit / stand, jolt / hop, fall, reach / take / hand-over, throw / catch, face swap on the
subject and every transition: `render_frames` with 6-8 consecutive times 1/30 s apart around the action (e.g.
`[t - 4F, t - 3F, ... t + 3F]`), scale 0.25-0.5. Check (qa.md §3):
- the move takes 2-6 frames, then a dead hold; no arm stuck halfway; nothing through the body or a table;
- feet planted during walks, the stop eases over 5-7 frames, the body bobs;
- the hand touches the prop in every frame; a thrown prop arcs and spins, lands or leaves the frame;
- face swaps go through a closed frame (or pop), never a morph; no blink on a shocked face;
- the camera moves in every frame, is already moving after a dissolve, speeds up before the next;
- dissolves 4-8 frames; a match dissolve's shapes sit on each other at the transition's middle frame.
- GATE: every action and transition passes.

## G5 - The whole video at once

1. `check_layout` with no times (every steady frame of the video) until Clean.
2. A contact sheet: `render_frames` at scale 0.25, 8 times per call, one frame every ~1.2 s from 0 to the end (a 40 s
   short = 5 calls). Look for: a face behind the captions, an empty or flat frame, a frozen camera (two frames alike), a
   shot that repeats the previous picture, a colour or light jump between shots of one set, the hero's colour lost
   against a set, a missing beat, signs or text you can't read, anything copied from a real brand.
3. The loop: the last frame and the first frame look like one continuous moment (or the bookend prop returns).
- GATE: Clean, and the sheet passes. Every remaining issue is written down with the reason.

## G6 - Sound effects

- `S.sfx(type, t)` on visible actions only (sound_design.md): 12-20 a minute, 3-5 in the first 5-8 s, each one tied to
  something on screen (a pop-in, a landing, a door, a splash, a counter landing). Whips and zoom transitions get their
  whoosh by themselves; `S.info(..., { sfx: true })` and some fx add their own: don't double them.
- No music bed (`audio/beds.json` stays without `"music": true`) unless the user asked: music is the user's choice
  (Project settings > Music).
- GATE: grep the scenes for `sfx(`: the count fits the length, the hook has 3-5, every event has its picture.

## G7 - Finish

- `DESCRIPTION.txt`: a 2-line summary at the top (the app keeps credits below it).
- The storyboard's open issues are up to date.
- Every new failure you hit and its fix goes in your summary as one line (what you saw: why -> the fix), in the format
  of PITFALLS.md; `remember_rule` for a lesson that should hold for every video.
- Don't render, mix or export the final video: the app does that. Finish with a short summary.

## Edits (one shot or a few)

1. `get_selection` / `list_shots`: find the shot's file and line. Read the shot and its neighbours.
2. Change it; `check_preview`; `check_layout` with `from` / `to` = that shot's range until Clean.
3. `render_frames` at the moments you changed (and the transitions on both sides when the timing changed); motion frames
   if you changed an action.
4. Don't move a shot's `say` or rename its `// ----` title unless asked (the user's other notes point at them).

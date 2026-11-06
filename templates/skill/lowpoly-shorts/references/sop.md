# SOP: a Low poly short from narration to final mp4

Every step ends in a GATE. Do not start the next step until the gate passes. When a gate fails, fix the cause (not the
symptom), then re-run only the check that failed. What each check flag means and its fix: references/qa.md.
Developer harness commands (outside the app) are marked [dev].

## G0 - Inputs ready
- The project is style Low poly shorts, the look (Bright / Moody) and format (9:16 / 16:9) chosen in project.json settings.
- audio/timeline.json exists (Time words done) and audio/script_timed.txt reads like the narration.
- GATE: `narration` from 0 to the end returns every word with a time; the end time is in project.json "end".

## G1 - Beat sheet (storyboard.md)
One row per clause: `# | words (say) | literal picture | set | cast + clip | camera | callout / UI | transition`.
- One clause = one shot, 1.5-2.5 s. Bright ~30 cuts a minute, Moody ~24. A longer clause gets a camera beat inside.
- The hook: shot 1 is a finished, lit, moving picture of the strongest moment. The ending: loopShot() back to shot 1.
- Numbers in the narration become counters / callouts with the SAME number ("six dealers" = six people on screen).
- GATE: every clause has a row and a literal picture a viewer gets with the sound off; nothing abstract without an object.

## G2 - Library first
- `lowpoly_asset` action search for every noun of the beat sheet (props, sets, vehicles, animals). Note the ids in the
  storyboard. Build by code only what neither the library nor the kit (engine_api.md Kit) has.
- A model from the web: CC0 / CC-BY / public domain only, licence read on its own page, saved with `lowpoly_asset` action
  add (tags that describe it, the author, the source URL, the credit line for CC-BY). It is then reused by id.
- Every new element (found or built) passes the close-up gate (qa.md 3) before it goes into a shot.
- GATE: every prop in the storyboard has an id or a kit function; every added asset has licence + author + source.

## G3 - Set dressing (per set, before the shots)
- Foreground / midground / background in every interior and exterior (props, set dressing, extras). No empty bottom third
  of the frame (the caption sits there, the picture must not die there).
- Furniture faces its use: chairs face the table (the back away from it), beds against a wall, signs ON walls (in front of
  the wall face, not inside it), rugs scaled with width AND a small fixed height (a uniform scale makes a thick slab).
- People at real scale (1.6-1.9 m); props at their library size (check: scale).
- Light per look: Moody = dark room, warm key on the subject (S.subject set), glows and lamps; Bright = flat daylight,
  saturated colours. No white-out surfaces (white paper under a lamp, a white sheet, a window): darken / tint them.
- Colours from the look: natural greens and greys outdoors (no teal trees / salmon rocks in a realistic scene), outfits
  that do not read as bare skin.
- GATE: one still of each set at scale 1 looks like a place in the reference channels (style.md).

## G4 - Each shot (the build loop)
For every shot, in order:
1. Write the shot (scenes/*.js): set, cast with spots, clips, hold / sit / walk, camera, callout, transition.
2. `check_preview`: no errors, no say / cue miss, no asset not loaded.
3. `check_layout` with `times` = start + 0.2, middle, end - 0.1 of the shot; a shot with movement (walks, hand-overs,
   flying things, camera moves): every 0.2 s through the shot. Fix every finding (qa.md 2). Repeat until Clean.
4. `render_frames` start / middle / end at scale 0.5. Review against qa.md 4 (literal, subject size, light, fg/mid/bg,
   clip and expression, hands on props, callout placement, exposure, the camera moved).
5. Motion shots: 3 frames 0.1 s apart at the moment of the action.
- GATE: check_layout Clean for the shot AND the stills pass the qa.md 4 list. Max two fix rounds per issue; still wrong:
  note it in storyboard.md "open issues" and move on.

## G5 - Motion rules (references/motion.md)
- Walks only with walk() / run() (the clip's own speed, pace for the step rate). Never move root.position by hand.
- Props only with hold() (grip that fits, no offset away from the palm). A hand-over: the giver's hold ends at time T,
  the taker's hold starts at T, both hands near the prop at T (two holds), never a prop at someone's head.
- Sitting only with sit(chairObject) on a chair that faces the right way; lying with the Lie clips on the surface (no
  airborne flag on people).
- Head turns within ~70 degrees: turn the body with a.face(target) for anything to the side or behind.
- No clip that puts a hand through the body or the head in a close-up (check: self; look at folded arms yourself).
- GATE: motion frames show feet planted, hands on props, nothing through anything.

## G6 - Text on screen
- Captions are the engine's (on by default): never draw your own.
- One callout at a time, on its object, never on a face or the hair, outside the caption band, inside the frame,
  at least 26 px tall on a 1080 frame (check: covered / offframe / small).
- Counters and labels say what the narration says (numbers match).
- GATE: check_layout has no covered / offframe / small; the stills show readable text at 270 px wide.

## G7 - The whole film
- `check_layout` without times (every steady frame) until Clean.
- [dev] `node scripts/drive.mjs lowpolycheck --match "<project name>"` (5 checks a second over every shot, determinism,
  review frames with the flagged bounds in test-out/lowpoly-review/<project>/). Add `--workspace <ws> --userdata <ud>`
  for a test workspace; `--import "<project dir>"` checks a copy of a project from elsewhere (the original is untouched),
  `--upgrade` puts this build's engine on that copy first.
- GATE: Clean; determinism OK (the same frame renders the same after a seek).

## G8 - Sound
- Sound: sfx(type, t) on picture events (references/sound_design.md). No music bed: music is the user's choice (Project settings > Music).
- Run the Sound step (Pipeline); listen to the hook and the loop point.
- GATE: final_mix.wav exists, narration on top, no clipping in the mix.

## G9 - Render and the final review
- Export (1080 x 1920 / 1920 x 1080). [dev] export time: `lowpolycheck --perf` (about 5-8 s for a 35 s short here).
- Contact sheet: `ffmpeg -i <mp4> -vf "fps=4,scale=270:480,tile=6x4" -q:v 3 grid_%02d.jpg` and look at EVERY tile
  (24 frames = 6 s per sheet) for: clipping, floating, props not in hand, wrong scale, bad framing, flat lighting, empty
  areas, white-outs, caption overlap, repetition, colour mismatch, wrong pose.
- [dev] image pass + review board: `node scripts/drive.mjs lowpolycheck --match "<name>" --video <mp4>` then
  `node scripts/lowpoly-review.mjs` (test-out/lowpoly-review/index.html: one card per issue with its frame).
- GATE: no 'blocks' issue left; every 'visible' one fixed or written down as accepted with the reason.

## G10 - The other format (when the video ships in both 9:16 and 16:9)
- Export > the other format makes a reframe copy: re-aim every camera, move callouts out of the caption band, check what
  the new frame shows (ceilings, the end of the ground, set edges). Then G7 and G9 on that copy.

## G11 - Credits and the library
- DESCRIPTION.txt: the app keeps the 3D asset credits (lowpoly_asset action credits); write the summary on top.
- Every new asset saved to the library with tags a later search will hit (what it is, its material / colour, its use).
- GATE: every CC-BY asset used has its credit line in DESCRIPTION.txt.

## G12 - Log what went wrong
Add every new failure (and its fix) to PITFALLS.md as one line: `- <what you saw>: <why> -> <the fix / the rule>`.
A check that missed something real goes to docs/ps1-style/CLIPPING.md (blind spots) so the check can learn it.

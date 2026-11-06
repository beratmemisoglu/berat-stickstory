---
name: stickstory-videos
description: Build Stick stories videos in berat studio with the stickstory engine - 16:9 "What if you..." story videos (8-12 minutes typical, also shorter; 9:16 too) told to "you", acted by black-silhouette stick people (round black heads, cream eye and mouth shapes, coloured clothes, coloured rim light) in flat-vector illustrated sets layered at real depths, letterboxed 2.0:1, with hand close-ups, HUD graphics, maps and diagrams, one picture per clause and hard cuts. Use for every build, edit and Ultraedit of a "Stick stories" project (style id stickstory).
---

# Stick stories (stickstory-videos)

Long "What if you..." stories: one extreme, numbered condition (an IQ of 500, sixty frozen seconds a day, a hundred lives)
applied to an ordinary life, told to "you" in the second person, present tense, by a calm narrator, with the characters
speaking their own lines. Every clause gets its own literal picture (about 25 pictures a minute, ~210 in 8 minutes): black
stick people with cream face shapes acting in flat-vector rooms, hand close-ups, a phone screen, a map, a counter, a
statement pill. The look and the motion were measured frame by frame on three reference videos
(experiments/stickstory-style/analysis); every character, story, sign and graphic you make is ORIGINAL (invent names and
brands; never imitate a real channel).

The engine draws the sets, the people, the faces, the graphics, the letterbox, the grain and the depth of field. You
write shots: `shot({ say, build(S) {...} })` with a place, the people and what they do on which word, the camera by name,
the graphics on their words, the sound effects.

Read, in order:
- `references/sop.md` - THE PROCEDURE: narration to finished shots, step by step, each step with its gate; a crew part's
  order of work
- `references/engine_api.md` - every call with an example that ran: shot, S.place, S.char + the Actor timeline (walk,
  sit, hold, give, hug, shake, gestures, faces, talk, look), S.prop, S.camera, S.info, the overlays (S.pill, S.label,
  S.counter ...), the HUD (UI.hud in models.js), S.fx (+ S.freeze / S.skill / S.impact), transitions, hand inserts
- `references/catalog.md` - every name: places (+ moods, spots, camera hints), cast, poses, gestures, walks, expressions,
  props by tag, info kinds, effects, overlays
- `references/storyboard.md` - how each kind of clause becomes a picture (dialogue, explanations, lists, numbers,
  wordless beats, new places) and the measured picture mix
- `references/style.md` - the look: letterbox, framings by head size, the two set families, palettes and moods, rim
  light, hands by shot size, grain and vignette
- `references/motion.md` - how the people and the camera move (measured: on 1s, short moves and long holds, walks,
  idles, one-frame turns, holds, contact, crowds; the nudge, pushes, trucks)
- `references/script.md` - the "What if you..." script (850 words / 8 min, the 12-beat sheet, [Name] lines, (beat Ns)
  lines, the devices)
- `references/sound_design.md` - the measured mix and how `S.sfx` and audio/beds.json work
- `references/qa.md` - what the review looks for, frame by frame
- `PITFALLS.md` - what went wrong in real builds and how it was fixed (read it before writing a scene)

## Workflow (a build)

1. Read `audio/script_timed.txt` (the `narration` tool gives every word with its time) and project.json (`settings.format`,
   `settings.look`, `settings.characters`). `S.char('main')` is "you".
2. Storyboard (storyboard.md in the project, or your crew part's `.suite/crew/<part>.md`): ONE PICTURE PER CLAUSE. Per
   shot: the `say` words (or `t0` for a wordless beat), the literal picture, the place + framing, who does what on which
   word, the face changes, the graphic / insert for every number and fact, the camera move, the transition, the sfx.
   Shared decisions at the top: the cast (one look each, for the whole video), the places (with moods), the HUD
   conventions (where the counter, labels, + / - icons sit), the devices.
3. Scenes: `scenes/<chapter or part>.js`, one `shot()` per clause with `// ---- N: title ----` above it, files listed in
   project.json `"scenes"` in narration order. Recurring places with this story's changes go in models.js as functions.
4. Check as you go (sop.md gates): `check_preview` clean (no `say miss`, no `cue miss`), `check_layout` Clean, then
   `render_frames` at every shot's key moments and LOOK; motion frames (1/24 s apart) on every walk, gesture, hand-over
   and insert.
5. Sound: `S.sfx(type, t)` on visible events (15-25 a minute) and the quiet music bed in audio/beds.json
   (sound_design.md). Don't render, mix or export the final video: the app does that.

## Non-negotiables (the references' numbers)

- **One picture per clause**: ~25 pictures a minute (23-28), median shot 1.7-2.1 s; a list item, a number, a new noun
  gets its own picture; no picture over ~5 s unless the camera travels or a graphic keeps building (motion.md).
- **Hard cuts** (93 % of the references): `trans` only for a time / place jump (`dissolve`, 3-6 a video), an impact or
  realisation (`flash`), a reset (`whiteout`), an act break or the end card (`black`). No whips, no zooms between shots.
- **The cut lands in the pause before its phrase** (`say` puts it 2 frames before the first word); a gesture lands 2-5
  frames before its stressed word; a face swaps ON the word; a number's graphic lands ON its word.
- **Pose to pose, on 1s**: short moves (2-6 frames), long dead holds; turns are one-frame view swaps; nobody idles in
  sync; listeners freeze while the speaker acts. Close-ups never move the camera; wides and mediums get the 3 % nudge
  (`S.camera('auto')`).
- **Faces are readable**: the face of whoever the shot is about is lit, unhidden, out from under overlays and from behind
  the character's own arms (a raised sleeve in a 3/4 close-up covers the face: use a front view); expressions change on
  the words. Only in-story dialogue (`[Name]` lines) moves a mouth, never the narration.
- **Bodies obey contact**: feet planted on the floor (no floating, sinking or sliding), held props in the hand, hands
  touching what they touch exactly, nobody through anybody. People start SEATED or LYING when the shot is about sitting
  or lying (the references never show a sit-down) - unless the clause's action IS the sit ("she drops onto the sofa":
  `a.sit(seat, at, { flop: true })`). People who carry, drag or hug use the engine's calls (`a.carry`, `a.drag`,
  `a.hug(b)` / `a.hug([b, c])`), never a hold or a pose that only looks close.
- **Every spoken number is on screen in its shot** (a pill, a counter, a big number, a tag, a sign); every new place
  opens on a wide with a time / place label; dialogue is the speaker's close-up with reaction cuts between lines.
- **One look per running device**: a counter that runs through the video (seconds left, lives, money) is ONE kind
  (`S.ring`, `S.counter`, `S.timer` ...) in models.js `UI.hud`, the same in every part. Every hand insert is `S.hand`.
- **Neighbouring shots differ** (place, framing or subject); a long stretch in one place changes its angles. A vehicle,
  a person or a thing going over an edge is staged with the edge and the drop IN the picture (PITFALLS "Camera").
- **Dense, lit sets**: every shot a dressed place (S.place + props) at real depths; practical lights glow; no bare
  backdrop except a deliberate close-up `S.backdrop`.
- **The letterbox stays** (2.0:1; 2.33:1 scope bars for action stretches).
- Characters are the engine's cast and looks (`S.char`), never photos of real people; text, names and brands are invented.

## Banned in every style (the owner's no-slop rules, 2026-10-13)

- **No red stamp / plaque / verdict overlays**: no rubber stamps or boxed red words slammed on ('CLOSED', 'LOCKED',
  'DENIED', 'CASE CLOSED', 'THE END', 'REJECTED', 'CLASSIFIED', 'FROZEN'). The engine has `S.stamp`, the `stamp` option of
  `document` / `card` and map `stamps`: never use them. Show the fact instead (a real object, a pill, a counter, a
  document with a marker ring, the action itself).
- **No notice that the voice is AI** ('AI-generated voice', 'synthetic voice' or anything like it), ever, anywhere.
- Every frame must read: the subject lit and visible, text held >= 1.5 s after it settles, nothing through anything.

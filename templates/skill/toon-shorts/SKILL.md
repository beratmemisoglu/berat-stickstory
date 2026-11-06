---
name: toon-shorts
description: Build 3D cartoon shorts in Toon Studio with the toon engine - our own big-headed cartoon characters with painted, expressive faces (expression sprites), densely dressed sets, smooth pose-to-pose character animation timed to the words, a camera that never stops, 6-frame dissolves, depth of field and bloom, captions drawn by the engine. 9:16 (1080x1920) first, 16:9 too. Use for every build, edit and Ultraedit of a "3D cartoon shorts" project (style id toon).
---

# 3D cartoon shorts (toon-shorts)

Short, fast, funny explainers told to "you": a big-headed cartoon character lives the story in dense little 3D sets, every
clause becomes a picture, every spoken number becomes an object, faces change on the stressed word, the camera keeps
creeping and pushes into each transition. The look was learned frame by frame from reference shorts; every character,
set, sign and joke you make is ORIGINAL (never imitate a real channel, show, brand or logo; invent names).

The engine draws the 3D, the faces, the depth of field, the captions (from the narration, by itself) and times every shot
from its clause (`say`). You write scenes.

Read, in order:
- `references/sop.md` - THE PROCEDURE: narration to finished shots, step by step, with the gate each step must pass
- `references/style.md` - the look: framings, light per mood, dressing density, colours, outlines, captions band, DOF
- `references/script.md` - how this style tells a story (hook, "you", one idea made literal per clause, loop ending)
- `references/storyboard.md` - turning clauses into shots: what to show, devices for abstract ideas, transitions
- `references/engine_api.md` - every function: shot, S.char + the Actor timeline, S.camera, S.focus, S.room/S.light,
  S.prop (the prop kit), S.fx (particles, weather, fire, water, light cones), S.info (in-world signs, screens, counters,
  maps, charts), S.place (whole dressed places), S.label/S.arrow, sfx
- `references/motion.md` - how characters move (measured: gestures, walks, sits, jolts, falls, throws, faces, blinks) and
  how the camera moves (creep, push into the cut, reaction punch-in, reveal, re-aim, fly-through)
- `references/catalog.md` - every name a scene can use, read from the engine: places, actor methods, poses, gestures,
  walks, cast, outfits, expressions, face extras, light rigs, effects, information kinds
- `references/props.md` - the prop catalogue by tag (search it before building anything by hand)
- `references/qa.md` - the bar every frame is checked against, and the failure patterns
- `references/sound_design.md` - sfx() on picture events
- `PITFALLS.md` - what went wrong in real builds and how it was fixed

## Workflow (a build)
1. Read audio/script_timed.txt. Cut it into clauses: ONE CLAUSE = ONE SHOT (a visual beat every ~1.1-1.5 s; a sentence may
   hold several beats inside one continuous shot when the camera moves through them).
2. storyboard.md in the project: the cast (the main character = `S.char('main')`, "you"), the sets (each one designed for
   THIS video: a place you could walk around in, dressed with 12+ story props, 3 depth layers, 2+ glowing practicals,
   something moving), and per shot: clause, the literal picture, set, characters + what they DO on which word, face
   changes, camera move, transition, in-world info (every number gets a physical object on its word), sfx.
3. Scenes: scenes/*.js with `shot({ say, build(S) { ...; return st }, update(st, t, S) })`, registered in project.json
   "scenes". Recurring helpers (a dressed room used by several shots) go in models.js.
4. Check each shot as you go (sop.md gates): check_layout until Clean, render_frames at the shot's key moments and LOOK
   (faces readable and out of the caption band 66-76 % of the height, nothing floating or through anything, the set dense,
   the light right), motion frames (several frames 1/30 s apart) on every walk, gesture, sit, fall and hand-over.
5. Sound effects only, with sfx(type, t) on visible actions (12-20 a minute, 3-5 in the first 5-8 s). No music bed unless
   the user asks: music is the user's choice (Project settings > Music).

## Non-negotiables
- Every clause gets its own literal picture. Abstract ideas become physical objects (see storyboard.md devices).
- Characters act ON their words: gestures land 3-5 frames before the stressed word, faces swap on it; holds are dead still
  (no idle breathing); feet planted, hands on what they hold, nothing through anything, nobody floating.
- The camera never stops (creep ~5 %/s in holds), accelerates into each transition; 6-frame dissolves on sentence starts.
- Faces are the point: the face of whoever the shot is about is readable, lit and never behind the captions.
- Dense sets: no empty or flat frames, no void above walls, no grey default floor.
- Characters are the engine's cast (`S.char('juno')`, outfits via `{ outfit: 'astronaut' }`); never photos of real people.

## Banned in every style (the owner's no-slop rules, 2026-10-13)
- **No red stamp / plaque / verdict overlays**: no rubber stamps or boxed red words slammed on ('CLOSED', 'LOCKED',
  'DENIED', 'CASE CLOSED', 'THE END', 'REJECTED', 'CLASSIFIED'). Show the fact (a real object, a document with a
  highlight, the action itself) instead.
- **No notice that the voice is AI** ('AI-generated voice', 'synthetic voice' or anything like it), ever, anywhere.
- Every frame must read: the subject lit and visible, text held >= 1.5 s after it settles, nothing through anything.

---
name: stickman-explainer
description: Build a narrated explainer in the MS Paint stick-figure style (big-head scribbly stick figures, flat Paint backdrops, a new picture for every clause of the narration, chapter title in caps, red/yellow labels) inside Toon Studio. Scenes are written in the shot language with script() from engine.js; people and animals come from make_sprites; real photos from web_image.
---

# MS Paint stick-figure explainer (Toon Studio)

The look: the fast story-explainer channels (history, folklore, science) drawn like a scribbly MS Paint picture. One
clause of narration = one new picture, 2-3 seconds each. Read references/style.md (the visual grammar, measured on a
reference video) and references/script.md (the shot language) before writing anything. references/catalog.md lists
every name the library has: sets, poses, faces, hats, held items, props.

## How a video is built
1. **Shots from the narration.** Split audio/script_timed.txt into clauses. Every shot starts with a `>` line holding
   its narration word for word; the engine finds those words in the voice and starts the picture 0.06 s before them.
   Never write times. Leave nothing out and keep the order (a skipped clause leaves the previous picture up too long).
   Japanese, Chinese and Thai have no spaces: copy each clause exactly as audio/script_timed.txt writes it (engine v4+
   finds it across the timed words). Their letters, and Korean and Hindi ones, draw in a bundled font beside Comic Sans.
2. **Scenes.** One file per chapter in scenes/, each:
   ```js
   import { script } from '../engine.js';
   script(`
   title THE EMU WAR
   > In 1932, Australia declared war.
   set desert
   soldier CL pose=walk e=angry
   text "1932" 50,86 c=red size=56
   `);
   ```
   Register every file in project.json "scenes" in order. Casts and the title carry on into the next files.
3. **People and animals.** Each person gets one `cast` line with `desc="..."` (what they look like: skin, hair, hat,
   clothes, one or two things that identify them). `narr` (a plain white-headed stick figure) is built in: use it for
   asides and reaction close-ups. Animals are props (emu, goat, mammoth, horse, cow, dog, dino) with variants
   (`e=angry|happy`, `run=1`, `helmet=1`, `crown=1`). After writing or changing scenes, run **make_sprites**: it
   draws only the poses the scenes use, in the MS Paint style, and keeps them in the user's library for every later
   video. Look at what it returns; fix a wrong figure by changing the pose/face (or the desc) and running it again.
   Anything without a sprite yet is drawn by the procedural stick-figure rig (fine for a draft, not for the final).
4. **Real photos** (only when the project's "Use real images from the web" is on): web_image finds a photo on
   Wikimedia Commons and saves it as IMG[name]; show it with `photo <pos> img=<name> text="caption"`. Use them for
   real places, objects, documents and people the narration names, about as many per minute as the setting says.
5. **QA.** check_preview after each file: unknown names come back with their file:line, and shots that stay too
   long are flagged. Then render_frames across the whole video (8 per call): does each picture show what its words
   say? Anything cut off, overlapping the title, floating, unreadable, empty? Fix and look again at the shots you
   changed only: every image stays in the conversation and costs the user's Claude plan again at each later step.
6. **Sound.** None to add: the style runs on the voice alone (no music, no sound effects; references/sound_design.md).

## Progress file (long builds)

Keep `.suite/build-progress.md` up to date: create it at the start, and after each chapter / scene file write what is done
and checked, the decisions to keep (the cast and their looks, colours, naming), open problems and what is next. A long
build can outgrow the conversation, which Claude Code then summarises: after a summary (or in a fresh conversation) read
this file, CLAUDE.md and storyboard.md first and carry on from "next" without redoing finished work.

## Rules that came from failures
- Floating things stay below y=85 (the chapter title lives at the top). y counts from the BOTTOM (0-100).
- One idea per picture. A line with two nouns: split it, or bring the second in with a beat (`@word`).
- Held items belong to the figure (`hold=` / `hold2=`), never a prop placed "at the hand".
- Figures on vehicles or animals need an explicit `x,y` (they are not on the ground).
- Use the same cast name (and desc) for a person all video: the desc identifies the person in the library.
- Labels: red for facts, numbers and warnings; yellow for names, places, dates; blue/green only for science terms.
- Close-ups: `size=XL` (head and shoulders, legs off-frame), one per surprising fact or punchline.

## Banned in every style (the owner's no-slop rules, 2026-10-13)
- **No red stamp / plaque / verdict overlays**: no rubber stamps or boxed red words slammed on ('CLOSED', 'LOCKED', 'DENIED',
  'CASE CLOSED', 'THE END', 'REJECTED', 'CLASSIFIED'). "Prohibited, straight slop." Show the fact (a real document or
  footage with a highlight, the action itself) instead.
- **No notice that the voice is AI** ('AI-generated voice', 'synthetic voice' or anything like it), ever, anywhere on screen.
- Every frame must read: the subject lit and visible, text held >= 1.5 s after it settles, camera moves eased (a push
  >= 2.5 s), hands on what they hold, nothing through anything. Never cut faster than a shot can be read.

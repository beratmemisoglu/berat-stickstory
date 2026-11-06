---
name: vox-editorial-video
description: Build a Vox-style editorial collage explainer (vertical 9:16 shorts or 16:9) from a timed voiceover, entirely procedurally in Three.js - paper and grid boards, cut-out stickers and printed halftone/duotone "photos", pins, tape, marker annotations, Vox text animators, constant camera drift, cut-the-curve and rack-focus transitions, grain and halftone texture, tactile sound design. Use for any project whose style is "vox" in Toon Studio.
---

# Vox editorial video (Toon Studio)

The app has already done the setup: `engine.js`, `models.js`, `fonts/`, `vendor/` exist; `audio/clean.wav`,
`audio/timeline.json` and `audio/script_timed.txt` are ready; `project.json` has `end` and the look (`settings`).
You write `storyboard.md`, the shot files in `scenes/` (listed in `project.json` "scenes"), new props in
`models.js`, and `audio/beds.json`. The app renders, mixes and exports.

Read first:
- `references/style_guide.md` - what makes it read as Vox (the quality bar; learned from Vox/Johnny Harris breakdowns)
- `references/engine_api.md` - every building block with its options
- `references/sound_design.md` - beds.json and which sounds each element makes

## Workflow
1. Read `audio/script_timed.txt`. Write `storyboard.md`: one shot per sentence or idea (1.5-3.5 s each in shorts),
   for each: the words it covers, the board, the hero element, what lands on which word, the transition in.
2. Build shot by shot. Every shot: a board, one hero element placed at its first frame, supporting elements that
   land on their spoken words (`S.add(obj, { at: cue('word', approx), in: 'drop' })`), a camera drift or move.
3. Look at your work with `render_frames` (2-3 times per shot: just after the key word, mid-shot, near the end;
   plus the middle of each transition) and fix what you see. `check_preview` after every file for errors and cue misses.
4. Write `audio/beds.json` (music mood + room tone). Don't mix or export - the app does that.

## Progress file (long builds)

Keep `.suite/build-progress.md` up to date: create it at the start, and after each section / scene file write what is done
and checked, the decisions to keep (palette, naming, camera rules), open problems and what is next. After a summary of the
conversation (or in a fresh one) read this file, CLAUDE.md and storyboard.md first and carry on from "next".

## Non-negotiables
- Every sentence gets a visual that explains it. No decorative filler, no idle wobble: the camera carries the motion.
- The incoming shot's hero element is on the board at the shot's first frame (`in: 'none'` or at <= t0); only
  secondary details land on cue. An empty board during a transition reads as a glitch.
- One text animation at a time. Keep type big: in 9:16 the frame is only 9 units wide; stay inside x in [-4, 4].
- Textured boards always (paper, grid, dots, wood, felt, newsprint), never flat colour.
- No camera shake, zoom punches, flashes. Transitions are the engine's: slide/whip (cut the curve), blur, push, paper, cut.
- Real people, products and places: no invented photos of real people. Use an anonymous engraving/silhouette with a
  name plaque, or leave space for a real image (`image(key)`), and say so in the storyboard.
- Facts on screen must match the narration exactly (numbers, dates, names).

## Banned in every style (the owner's no-slop rules, 2026-10-13)
- **No red stamp / plaque / verdict overlays**: no rubber stamps or boxed red words slammed on ('CLOSED', 'LOCKED', 'DENIED',
  'CASE CLOSED', 'THE END', 'REJECTED', 'CLASSIFIED'). "Prohibited, straight slop." Show the fact (a real document or
  footage with a highlight, the action itself) instead.
- **No notice that the voice is AI** ('AI-generated voice', 'synthetic voice' or anything like it), ever, anywhere on screen.
- Every frame must read: the subject lit and visible, text held >= 1.5 s after it settles, camera moves eased (a push
  >= 2.5 s), hands on what they hold, nothing through anything. Never cut faster than a shot can be read.

---
name: vox-collage-video
description: Build a Vox newspaper-collage explainer in Toon Studio from a timed voiceover - one broadsheet front page with a panel per chapter, cut-out engraving images made on the user's Higgsfield account (real transparency, about a cent each), torn paper, ransom-note letters, handwriting written by a quill, typewriter labels, inked stamps, marker circles, counters, pins; smooth camera moves between panels and a front-page finale that loops into the first frame. Use for any project whose style is "collage" (shown to the user as "Vox").
---

# Vox collage video (Toon Studio)

The app has already done the setup: `engine.js`, `models.js`, `fonts/`, `vendor/` exist; `audio/clean.wav`,
`audio/timeline.json` and `audio/script_timed.txt` are ready; `project.json` has `end` and the look (`settings`).
You write `storyboard.md`, the image list, the images (with the `make_image` tool), the chapter files in `scenes/`
(listed in `project.json` "scenes"), new helpers in `models.js`, and `audio/beds.json`. The app renders, mixes, exports.

Read first:
- `references/style_guide.md` - the look and the motion (the quality bar) and what is PROHIBITED
- `references/engine_api.md` - every building block with its options
- `references/pitfalls.md` - what went wrong while building this style, and the user's own corrections (read it all)
- `references/sound_design.md` - beds.json and which sounds each element makes

## Workflow
1. Read `audio/script_timed.txt`. Split it into chapters (one idea or era each): as many as the build prompt's PACING
   line says (from the look's Pictures per minute and the video's length; 5-9 for about a minute). Write `storyboard.md`: per
   chapter the panel (slot, paper), the 1-3 camera framings, and what lands on which word.
2. Write the image list at the end of `storyboard.md`: every image once, `name | kind | what it shows`. As many
   cut-outs as the PACING line says (12 a minute by default: a new picture about every 5 s, so a 10-minute video needs
   ~120, not the ~20 of a one-minute one). Type, stamps, numbers, newspaper pages, gauges and diagrams are drawn
   by the engine: no images for them.
3. Set `project.json` "imageStyle" to one line for the shared look, e.g.
   `"Vintage engraving illustration, fine black ink crosshatching, cut out of paper like a collage sticker."`
   Make the images with `make_image` (kind "cutout" for objects and people, "background" for a full-panel map or
   texture). No `ref`. Look at each result; remake only a real failure.
4. PLAN EVERY FRAME before writing code (the SOP below), then build chapter by chapter in `scenes/s1_*.js` ... one
   `panel()` per file; the last file also calls `finale()`.
5. VERIFY every chapter (the SOP below): `check_preview`, then `check_layout` until clean, then the visual pass.
6. Write `audio/beds.json` (music mood + room tone). Don't mix or export.

## SOP: plan and verify every frame (not optional)
Plan (write it as a comment above each shot, like `// frame: x -1 +- 6.4, y .9 +- 3.6`):
- A shot at (x, y, zoom) shows x within `x +- 8/zoom` and y within `y +- 4.5/zoom` (16:9; drift makes it tighter over
  the shot). It must stay inside its panel (x +- 8, y +- 4.5): pick x/y/zoom so it does.
- For every element: its extent (x +- w/2, y +- h/2) is fully inside every framing it appears in, with 0.3 of air, or
  fully outside it. Nothing half in, half out. Nothing overlaps anything unless the overlap is the idea (then pass
  `over`). Know what is under and what is over for each element (layers below).
- Every word on screen is readable where it lands: big enough (the checker wants 18 px), and on paper that
  contrasts with it (a stamp on a map or kraft gets `backing: true`).
Verify (after each chapter, and at the end for the whole video):
1. `check_preview` - no load errors, no cue misses.
2. `check_layout` - fix every problem it lists and run it again until it says Clean. It measures cut-off elements,
   frames that show past the panel, real overlaps (on the shapes), marker lines crossing things, text too small, and
   text with too little contrast. `over` / `bleed` / a mark's `target` only when that is truly the intent.
3. The visual pass: `render_frames` at just after each element lands and the middle of each shot. For every frame
   ask: what is out of place, what is in the way, what is not visible, what is not intended? Why is it bad, and what
   is the fix that makes the frame coherent and consistent with the rest? Fix it, and look again at the moments you
   changed (not the whole chapter). Every image stays in the conversation and costs the user's Claude plan again at
   each later step: scale 0.5, several times per call, scale 1 only for small text.

## Progress file (long builds)

Keep `.suite/build-progress.md` up to date: create it at the start, and after each chapter / scene file write what is done
and checked, the decisions to keep (imageStyle, palette, the images made and what each shows, naming), open problems and
what is next. A long build can outgrow the conversation, which Claude Code then summarises: after a summary (or in a fresh
conversation) read this file, CLAUDE.md and storyboard.md first and carry on from "next" without redoing finished work or
making an image twice.

## Non-negotiables
- Every fact and date on screen is exactly right and matches the narration. Check them.
- No text inside any image. All text is animated typography from the engine.
- The look is the same in every panel: the same imageStyle, the same paper family, the same stamp red.
- The video ends on its opening frame (finale with loop, the default). Never end on a hard cut.
- Keep image generation cheap: plan first, make each image once, reuse images across panels.
- The prohibited list in `references/style_guide.md` is absolute.

## Banned in every style (the owner's no-slop rules, 2026-10-13)
- **No red stamp / plaque / verdict overlays**: no rubber stamps or boxed red words slammed on ('CLOSED', 'LOCKED', 'DENIED',
  'CASE CLOSED', 'THE END', 'REJECTED', 'CLASSIFIED'). "Prohibited, straight slop." Show the fact (a real document or
  footage with a highlight, the action itself) instead.
- **No notice that the voice is AI** ('AI-generated voice', 'synthetic voice' or anything like it), ever, anywhere on screen.
- Every frame must read: the subject lit and visible, text held >= 1.5 s after it settles, camera moves eased (a push
  >= 2.5 s), hands on what they hold, nothing through anything. Never cut faster than a shot can be read.

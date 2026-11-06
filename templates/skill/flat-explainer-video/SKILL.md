---
name: flat-explainer-video
description: Build a flat-vector explainer (9:16 short or 16:9 video) in Toon Studio from a timed voiceover - bright rounded shapes with one consistent light, the project's own main character with real follow-through (blinks, drag, squash and stretch, expressions that change through in-betweens), icons, diagrams and labels that land on the spoken word, lines that draw on and land, particle bursts, dissolves between scenes, word-highlight captions in a reserved band and a soft film finish. Everything procedural in Three.js, no images. Use for any project whose style is "flat" (shown to the user as "Flat explainer").
---

# Flat explainer video (Toon Studio)

The app has already done the setup: `engine.js`, `models.js`, `fonts/`, `vendor/` exist; `audio/clean.wav`,
`audio/timeline.json` and `audio/script_timed.txt` are ready; `project.json` has `end` and the look (`settings`, incl.
`format`: vertical 1080 x 1920 or landscape 1920 x 1080); `character.js` is the main character (who stars in the video).
You write `storyboard.md`, the scene files in `scenes/` (listed in `project.json` "scenes"), new elements in
`models.js`, and `audio/beds.json`. The app renders, mixes and exports.

Read first, in this order, all of it:
1. `references/QUALITY_STANDARD.md` - elements are approved before scenes are built. Law.
2. `references/STYLE_GUIDE.md` - layout, motion, colour, character rules, and what is bad at all costs.
3. `references/engine_api.md` - every building block, with options.
4. `references/example_scene.js` - one complete, correct scene to copy patterns from.
5. `references/pitfalls.md` - what went wrong while this style was built (V1 -> V4) and the reviewer's notes.
6. `references/sound_design.md` - beds.json and the automatic sounds.
7. `references/characters.md` - the main character, background people (`randomLook`), and how characters are made.

## Workflow
1. Read `audio/script_timed.txt`. Split it into 8-14 scenes (one idea each, a new scene every 3-6 s). Write
   `storyboard.md`: per scene the background, the cast (the main character from character.js? which elements?), what lands on which word,
   what carries over from the previous scene, and the colour meaning (one colour per concept, kept all video).
2. List every NEW element you need that `models.js` doesn't have. Build each one in `models.js` with the shading
   primitives (QUALITY_STANDARD §2), then prove it ALONE: a temporary test shot that shows only that element big
   (scale it to ~600 px), `render_frames` on it, check it against the eye-review checklist, and `check_layout`
   (it measures shading drawn outside the element's form). Fix until clean. Then delete the test shot.
3. Build scene by scene in `scenes/s01_*.js` ... (several shots per file is fine). Every visual event on a word:
   `at: cue('word', approxTime)`. Characters: `drive()` for poses, `expr()` for faces.
4. VERIFY each file (not optional):
   a. `check_preview` - no load errors, no cue misses.
   b. `check_layout` - fix everything it lists, run again until it says Clean.
   c. `render_frames` at: just after each element lands; the middle of each shot; and 3-4 CONSECUTIVE times
      (0.033 s apart) around every pose change, expression change, colour change and transition. Nothing may snap.
      For every frame ask: what is out of place, in the way, cut off, unreadable, physically wrong, or not intended?
      Scale 0.5 with several times per call (a run of consecutive snap-check times fits in one call); scale 1 only
      for small text. After a fix, look again only at the moments you changed: every image stays in the conversation
      and costs the user's Claude plan again at each later step. check_layout: run it on the times you changed.
5. Whole video: `check_layout` once more, then `render_frames` across the cuts.
6. Write `audio/beds.json`. Don't render, mix or export.

## Progress file (long builds)

Keep `.suite/build-progress.md` up to date: create it at the start, and after each chapter / scene file write what is done
and checked, the decisions to keep (palette, character names and looks, camera rules, naming), open problems and what is
next. A long build can outgrow the conversation, which Claude Code then summarises: after a summary (or in a fresh
conversation) read this file, CLAUDE.md and storyboard.md first and carry on from "next" without redoing finished work.

## Non-negotiables
- Nothing in the caption band (`BAND`: y -700..-520 vertical, -490..-380 landscape) while captions are on, except ground/background.
- Use the format's constants (`W`, `H`, `GY`, `BAND`, `ZONE`, `TITLE`), never the other format's numbers.
- The main character is `character(p)` from character.js, the same all video. Other people: `randomLook(seed)` looks.
- Every cut is a transition (the default dissolve) unless a hard cut is the idea.
- Nothing snaps: poses, looks, expressions, colours and visibility change through in-betweens.
- Shading is cut from the outline, never laid on top. One light, top-left.
- Every fact on screen matches the narration exactly.
- No images, no emoji, no clip-art text: everything is built from the engine's primitives.

## Banned in every style (the owner's no-slop rules, 2026-10-13)
- **No red stamp / plaque / verdict overlays**: no rubber stamps or boxed red words slammed on ('CLOSED', 'LOCKED', 'DENIED',
  'CASE CLOSED', 'THE END', 'REJECTED', 'CLASSIFIED'). "Prohibited, straight slop." Show the fact (a real document or
  footage with a highlight, the action itself) instead.
- **No notice that the voice is AI** ('AI-generated voice', 'synthetic voice' or anything like it), ever, anywhere on screen.
- Every frame must read: the subject lit and visible, text held >= 1.5 s after it settles, camera moves eased (a push
  >= 2.5 s), hands on what they hold, nothing through anything. Never cut faster than a shot can be read.

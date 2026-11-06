---
name: lowpoly-shorts
description: Build a low-poly 3D short (9:16 or 16:9) in Toon Studio from a timed voiceover - library people with mocap clips, library sets and props, a low-res game-capture look (Bright or Moody), one clause = one shot, a camera that always moves, in-scene number callouts, engine captions. Use for every build, edit and Ultraedit of a Low poly shorts project.
---

# Low poly shorts (Toon Studio)

The look of the big low-poly story shorts: a game capture of low-poly 3D. Two looks (project.json settings.look):
- **Bright** (the weird-facts channel): flat daylight, saturated sets, a soft 320 px upscale, small yellow lowercase captions.
- **Moody** (the casino-story channel): dark rooms, a warm key on the subject, glowing lamps and screens, soft shadows, a
  chunky 270 px render with heavy sharpening, colour fringes and a vignette, bold white captions.

The engine draws the 3D at a low internal resolution and scales it up (that IS the style: never "fix" the softness), adds
the captions from the narration by itself, and times every shot from its clause (`say`). You write scenes.

Read, in order:
- `references/sop.md` - THE PROCEDURE: narration to final mp4, step by step, with the gate each step must pass
- `references/style.md` - the two looks, the rules, shot recipes with durations and cameras
- `references/script.md` - turning narration into shots (one clause = one shot, hook, beats, loop ending)
- `references/engine_api.md` - every function: shot, S.person, walk, do, hold, sit, sets, kit, callouts, cameras, transitions
- `references/library.md` - the asset library: search before you build, save new finds, licences, credits
- `references/motion.md` - the clips, walking without foot sliding, gestures, sitting, picking up, falls
- `references/qa.md` - the quality standard: check_layout, the per-element close-up gate, the frame-by-frame review
- `references/sound_design.md` - beds.json and sfx()
- `PITFALLS.md` - what went wrong before and how it was fixed

## Workflow (a build)
1. Read audio/script_timed.txt. Cut it into clauses: one clause = one shot, 1.5-2.5 s (Bright ~30 cuts a minute, Moody ~24).
2. storyboard.md: the cast (one recurring protagonist + roles), the sets, and per shot: clause, literal picture, set,
   camera, callout / UI, transition. Plan the hook (frame 0 is a finished, lit, moving shot) and the ending (loopShot()).
3. Assets: `lowpoly_asset` action search for everything a shot needs. Build by code only what neither the library nor the
   kit has. A good free model from the web (CC0 / CC-BY / public domain) is saved with `lowpoly_asset` action add.
4. Scenes: scenes/*.js with shot({ say, set, build(S) { ... }, cam, trans }); the cast in models.js; register files in
   project.json "scenes". Asset ids as plain strings (the engine preloads every id it finds in the files).
5. QA (sop.md gates G4-G7, qa.md): check_preview, check_layout until Clean (on moving shots pass times every 0.2 s),
   render_frames over every shot, motion frames on walks, gestures and hand-overs, the contact-sheet review of the export.
6. Sound effects only (sfx() on picture events). NO music bed: music is the user's choice (Project settings > Music). DESCRIPTION.txt summary on top (the app keeps the credits).
   The user's own sounds (Settings > Media > Sound effects library) win per category over the built-in ones; `sfx('tag:door slam', t)` or
   `sfx('user.<category>.<name>', t)` asks for one exactly. Clips the user placed by hand (Music & effects > Layers, project.json
   `audioLayers`) are theirs: never recreate or move them with sfx(). project.json `sound.effects`: auto | library (only theirs) | off.

## Non-negotiables
- Every clause gets its own literal picture. Abstract ideas go into a void set with one object and a label.
- The camera always moves. People always act (a clip that fits, an expression, a look). Nobody T-poses or slides.
- Nothing passes through anything; feet on the floor; props in hands; text never on a face; captions never covered.
- Never photos of real people: faces are the engine's drawn faces. Never a licence other than CC0 / CC-BY / public domain.

## Characters (the app picks them)
The main character is settings.characters.main (the user picks it in Look > Main character): write people as
`S.person({ ...HERO })` (models.js HERO = { role: 'main' }), never hardcode a body / skin / hair for the hero. Recurring
roles: `S.person({ role: 'dealer' })` (dealer, doctor, friend, partner, boss, stranger, expert, clerk, police)
(settings.characters.cast or the roster default; the role keeps its clothes). A specific roster person: `S.person({ character: 'maya' })`
(alex maya marcus jen tom rosa frank lena; engine exports ROSTER). Extras in crowds keep free options.

## Banned in every style (the owner's no-slop rules, 2026-10-13)
- **No red stamp / plaque / verdict overlays**: no rubber stamps or boxed red words slammed on ('CLOSED', 'LOCKED', 'DENIED',
  'CASE CLOSED', 'THE END', 'REJECTED', 'CLASSIFIED'). "Prohibited, straight slop." Show the fact (a real document or
  footage with a highlight, the action itself) instead.
- **No notice that the voice is AI** ('AI-generated voice', 'synthetic voice' or anything like it), ever, anywhere on screen.
- Every frame must read: the subject lit and visible, text held >= 1.5 s after it settles, camera moves eased (a push
  >= 2.5 s), hands on what they hold, nothing through anything. Never cut faster than a shot can be read.

# Low poly: known pitfalls of this base

Sources: `.claude/skills/lowpoly-shorts/PITFALLS.md`, `references/qa.md`, `sop.md`, `style.md`, `motion.md`, the
repo's `docs/ps1-style/PITFALLS.md` + `CLIPPING.md` (research and engine history), and the engine's comments.

## Determinism
- Don't call `Math.random(` - use `rnd(seed)` (mulberry32) or `noise1(x, seed)` from lib/core.js; sets take `seed`.
- Don't call `Date.now(`, `performance.now(`, `new Date(`, `setTimeout`, `requestAnimationFrame` in scenes, models or
  lib drawing code - frames are seeked (`performance.now` only times `exportVideo`).
- Don't keep state between frames (`x += v`) - a shot first drawn mid-way framed differently from the export until
  engine 5 stepped every shot once at its start; everything is a function of `t`.
- Don't use `%` on values that can go negative - kit `slot()` reels jumped (`% 1` on negatives).
- Don't move a walker's root by hand or animate bones by hand - feet slide (check: `feet ... slides` > 3.5 cm);
  `walk()` / `run()` take the clip's own speed.

## Engine contract
- Don't rename or remove exports of engine.js, models.js or lib/*.js - engine.js re-exports lib names (`UI`, `SETS`,
  `KIT`, `callout`, `screen` ...) that host.js and scenes import; the app diffs exports every turn.
- Don't add a local name that clashes with a re-export - "Identifier 'live' has already been declared" broke boot.
- Don't change `ENGINE_KIND` ('lowpoly') or drop the `bright` / `moody` looks - project settings and `MOODY` branches
  depend on them.
- Don't import DOM or three.js into lib/scan.js - the Suite runs it in node to credit assets; keep it dependency-free.
- Don't remove the depth buffer from the low-res targets - hair drew over faces, far walls over people.
- Don't "fix" the softness - the low internal resolution, upscale, halo and fringe ARE the style.
- Don't switch colour management off (`THREE.ColorManagement.enabled = true` here, unlike flat).
- Don't let a flash reach full white - phones strobe; `S.flash` and the `flash` transition peak at 70 %, ~0.1 s, once
  per lightning sequence.

## Assets (the library is read-only)
- Don't build asset ids at run time (`'prop.' + name`) - only plain-string ids in scenes/*.js and models.js (and the
  first argument of `S.prop` / `S.person` / `S.animal`) are preloaded: "asset X is not loaded". Same for clip names
  written only in comments: put them in an exported array.
- Don't write into `library/` or `__lib/` - add finds with the `lowpoly_asset` tool (it dedupes by file hash).
- Don't add Draco / Meshopt / KTX2 .glb or files over 8 MB - there are no decoders.
- Don't trust Kenney / KayKit sizes - give `height:` / `width:`; `scale` findings fire outside 0.45x-2.2x of `size_m`.
- Don't scale rugs uniformly - 7 cm became 18 cm and feet sank (`support`); give width AND a small height.
- Don't use photos of real people, real logos or a channel's branding; only CC0 / CC-BY / public domain.

## People (what check_layout prints)
- Don't mark a person `root.userData.airborne` - it switches off EVERY check for that body (a lying body sank into the
  bed unseen); Lie / Lay / Sit clips are already exempt from the feet checks.
- Don't place chairs with `ry + Math.PI` - they face away and shins go through the back (`through`).
- Don't put two people closer than 0.6 m (`bodies` > 5 cm) unless `userData.touch` marks a hug / handshake.
- Don't hold props more than 3.5 cm from the palm (`hand`); a banknote > 7 cm out is "not in the hand".
- Don't use `KK_Sneak_Loop` (sinks toes 6-9 cm) or rotate a sitting clip onto the back for sleep (legs in the air).
- Don't turn a head past ~80 degrees with lookAt (`look`) - turn the body (`a.face(target)`).
- Don't hardcode the hero's body / hair - use roles (`HERO = { role: 'main' }`) so the user's picker applies.

## Frame (what check_layout prints)
- Don't put the camera inside geometry or a person (`camera`), above a ceiling (`ceiling`), or show the world's edge
  (`edge`); rooms are closed with ceilings and the camera is kept inside.
- Don't stack flat surfaces in one plane (`coplanar`, lift 1 cm) or draw sub-pixel long geometry (`thin`, shimmers).
- Don't set text under 26 px on a 1080 frame (`small`), cut it at the edge (`offframe`), or put it on a face, the hair,
  another text or the caption band (`covered`); one callout at a time.
- Don't let the subject drop under 10 % of frame height or its head 45 % out (`subject`).
- Don't light Moody without a key on the subject (silhouettes) or put white surfaces under lamps (bloom whites out).
- Don't draw your own captions, use red `stamp` / verdict plaques, or any AI-voice notice (banned in every style).
- Don't add sound effects or a music bed by default - music only when the user adds it.

## Never edit (the app denies the write)
- `project.json`, `.suite/**`, `.claude/**`, `reference/**` (except `reference/ANALYSIS.md`), `audio/**`.
- `qa/mustfail/**`, `scenes/mustfail_*.js`, `vendor/**`, `fonts/**` (add_font only), `lib/contact.js`, `lib/collide.js`.
- Base-specific: treat `lib/check.js` as the measured QA (calibrated on a planted-fault set, docs/ps1-style/CLIPPING.md):
  never loosen a detector to make a scene pass; add rules beside it instead.

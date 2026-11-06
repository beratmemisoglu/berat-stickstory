# Known pitfalls of this base (collage / Vox)

Sources: `.claude/skills/vox-collage-video/references/pitfalls.md`, `style_guide.md` (PROHIBITED), `engine_api.md`,
engine.js comments. Each line happened in a real build.

## Never edit (the app refuses the write)
- Don't write `project.json`, `.suite/**`, `.claude/**`, `reference/**` (except `reference/ANALYSIS.md`), `audio/**`,
  `qa/mustfail/**`, `scenes/mustfail_*.js`, `vendor/**`, `fonts/**`, `lib/contact.js`, `lib/collide.js` - because the
  app owns them; fonts come only through the `add_font` tool.
- Don't rename or remove any export of engine.js or models.js - because host.js imports them by name and every project breaks; the app diffs exports after each turn.
- Don't change `ENGINE_KIND = 'collage'` - because the host and the app branch on it (picking, cuts, render scaling).

## Banned calls and patterns
- Don't call `Math.random(`, `Date.now(`, `performance.now(` or `new Date(` in scenes or builders - because frames are rendered out of order and must match; use `rng(seed)` / `hashf(n)` (`performance.now` stays only in exportVideo's progress timer).
- Don't copy `tape()`'s streak loop (it calls `Math.random()`) - because it is the one non-deterministic spot in the base; when you touch tape(), switch it to `rng(e.seed)`.
- Don't use `fetch`, `setTimeout`, `requestAnimationFrame` or `document.*` in scenes - because a frame must be a pure function of `t`; draw with `mkCanvas` / `drawn()`.
- Don't call `shake(` - because it reads as slapped on (it exists only for old scenes).
- Don't pass `in: 'slam'` or animate anything punching in big - because slapped-on type is AI-slop motion; stamps `ink`, headlines `print` / `type` / `rise`.
- Don't use `stamp()` for anything but a date or number, unboxed and level (`box: false, rot: 0`) - because red boxed stamps and verdict words ('CLOSED', 'DENIED', 'THE END', 'CLASSIFIED') are banned in every style.
- Don't import one scene file from another - because its shots register twice; shared code goes in models.js.

## Look
- Don't add section cards or kicker titles on panels ('I. BEFORE THE PRESS') - because announcing sections was rejected as slop; `title` only names the panel in the editor.
- Don't stand in boxes, emoji or big text when `make_image` fails - because that is what made members' first Vox videos poor; stop and tell the user why.
- Don't put text inside images (maps: "no labels, no names, no writing") - because it can't be edited and breaks the look; all text is engine type.
- Don't pass `ref` to make_image - because a style reference leaks its subject into every image; the shared imageStyle keeps the look.
- Don't prompt for sticker borders, torn edges or shadows - because the engine adds them (`stickerCanvas`, `tornPath`, `shadowCanvas`).
- Don't hard-code a red - because the brand colour replaces `C.red`; use `C.red` / `C.brand` / `C.brandInk`.
- Don't add a theme with missing roles - because `C` falls back silently and panels come out in the wrong paper.

## Layout
- Don't place a pen, circle or underline by eye - because it lands next to the word; use `script(... pen)`, `mark({ around, word })`, `wordBox()`.
- Don't start a mark before `script.at + script.dur + .5` - because the circle gets drawn over the quill.
- Don't let a mark cross anything but its `target` - because a red underline over captions reads as a mistake.
- Don't let a zoomed shot leave its panel (x within +-(8 - 8/zoom), y within +-(4.5 - 4.5/zoom)) - because `check_layout` reports `frame` and the next panel shows.
- Don't forget drift shrinks the frame over a shot - because edge elements end up `cut`; give them air or `drift: 0`.
- Don't let red text sit on a map or kraft - because it measured invisible; `backing: true` or bigger type (contrast must be >= 2.8:1, text >= 18 px).
- Don't stack two captions in one row - because strips overlapped at the panel edge; check the panel at zoom 1, not only the close framing.
- Don't use `over` / `bleed` to silence a check - because they mean "intended"; fix the layout instead.

## Motion and timing
- Don't shorten transitions below whip .7 s / move 1.2 s - because snappy moves felt rushed; the erf ramps (TRANS_DUR) are the bar.
- Don't land the incoming panel's hero after the shot's `at` - because transitions are centred on `at`; place it at `at - .5` or earlier.
- Don't let anything wobble while idle (`bob` rarely, gears may `spin`) - because idle motion reads as filler.
- Don't cue a word that the transcript misheard - because `cue()` matches audio/timeline.json, not the script; copy from script_timed.txt.
- Don't end on a hard cut in front-page mode - because the finale loop lands exactly on frame 0 (panel 1's late arrivals lift off).

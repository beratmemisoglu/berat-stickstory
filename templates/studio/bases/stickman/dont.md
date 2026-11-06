# Known pitfalls of this base (stickman / MS Paint)

Sources: `.claude/skills/stickman-explainer/SKILL.md` ("Rules that came from failures"), `references/style.md`,
`script.md`, `sound_design.md`, and the engine / lib comments.

## Never edit (the app refuses the write)
- Don't write `project.json`, `.suite/**`, `.claude/**`, `reference/**` (except `reference/ANALYSIS.md`), `audio/**`,
  `qa/mustfail/**`, `scenes/mustfail_*.js`, `vendor/**`, `fonts/**`, `lib/contact.js`, `lib/collide.js` - because the
  app owns them; fonts come only through the `add_font` tool.
- Don't rename or remove any export of engine.js, models.js or lib/*.js - because host.js and the other lib files import them by name; the app diffs exports after each turn.
- Don't change `ENGINE_KIND = 'stickman'` - because make_sprites, web_image and the host branch on it.

## Banned calls and patterns
- Don't call `Math.random(`, `Date.now(`, `performance.now(` or `new Date(` in scenes or lib drawing code - because pictures are cached and re-rendered out of order; use paint.js `rnd()` (reseeded per shot).
- Don't use `fetch`, timers or `document.*` in scenes - because a scene is only a `script()` call; drawing belongs in lib/.
- Don't add a `shot()` call or JavaScript animation to scene files - because this base has no shot() and scenes are text in the shot language.
- Don't write times in scripts - because the engine times each `>` line from the narration; a wrong time can't be fixed by the editor.
- Don't animate inside a beat (time-based motion in a set or prop) - because `picture()` caches one still per shot+beat; it will never move.
- Don't add transitions, camera moves, sound effects or music - because the style is hard cuts on the voice alone (`collectEvents` returns no sfx; the mix is the voice at -16 LUFS).
- Don't draw a red stamp, boxed verdict word ('CLOSED', 'DENIED', 'THE END') or any AI-voice notice - because both are banned in every style.

## Shot language
- Don't skip or reorder narration clauses - because a skipped `>` line leaves the previous picture up too long and shifts every match after it.
- Don't keep one picture longer than ~4.5 s (shotProblems flags > 6 s) - because the style is one clause = one image, 2-3 s each.
- Don't leave a shot as an empty white frame - because shotProblems reports it and it reads as broken.
- Don't put two ideas in one picture - because a line with two nouns gets split or its second noun comes in with `@word`.
- Don't place floating things above y=85 - because the chapter title lives at the top (y counts from the BOTTOM, 0-100).
- Don't place a held item as a prop "at the hand" - because it floats; use `hold=` / `hold2=`.
- Don't put a figure on a vehicle or animal without an explicit `x,y` - because ground positions plant feet on the set's ground line.
- Don't change a person's cast name or desc mid-video - because the desc identifies the person in the sprite library.
- Don't invent names outside catalog.md - because unknown poses, props, sets and keys come back as errors with file:line.

## Look
- Don't change the line or figure look without planning for sprites - because make_sprites draws people and animals in the MS Paint style and they are preferred over the rig; a restyled rig next to old-style sprites looks like two videos. Restyle what the rig draws and say in STYLE_GUIDE.md that sprites must match.
- Don't anti-alias or smooth anything - because the look is aliased Paint (alpha thresholded text, nearest-neighbour doubling); smoothing breaks it.
- Don't make text bold with a thick outline - because letters merged into one shape (paint.js text() notes); regular weight, thin outline.
- Don't use more than red / yellow (and blue / green for science terms) for labels - because the style's colour roles carry meaning.
- Don't hard-code red for facts - because the brand colour replaces `accent`; use `c=accent` (or no `c=`).
- Don't trust a pose because it is in POSES - because the comment's checkPose() / VERIFY.md check does not exist here; render the pose on the rig and as a sprite and look.
- Don't add formats other than 16:9 - because the engine and the app accept landscape only.

## Verification
- Don't rely on `check_layout` - because this engine has no layoutIssues; it says nothing. Use `check_preview` (unknown names, long shots) and `render_frames` across the video, 8 per call.
- Don't re-render the whole video after a fix - because every image stays in the conversation; look again only at the shots you changed.

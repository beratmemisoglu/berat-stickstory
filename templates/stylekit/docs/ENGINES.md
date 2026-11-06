# The bases: what each engine is good for, how a style changes it, where it bites

A style is one of these engines, copied into the style and restyled at its extension points. The base decides what the
style CAN do (2D or 3D, formats, people, maps, footage, pictures); the style decides how it looks. Pick the base whose
abilities match the videos, not the one whose current look is closest: looks are cheap to change, abilities are not.

For each base below: the engine's API is in `bases/<base>/skill/` (the entry file is named), the exact extension points are
in `docs/bases/<base>/extend.md`, its known traps in `docs/bases/<base>/dont.md`. Those two files were written for the
in-app Studio: translate their tool names with the table in CLAUDE.md. The current ENGINE_VERSION of each base is in
`kit.json`.

**Where a restyle goes (every base):** the engine gets settings in this order, each over the one before: the base's
default look (`bases/<base>/look.json`, written from the app) < style.json `defaults` < the project's look. They are
merged over the engine's own `DEFAULTS`, and the base look sets nearly every `DEFAULTS` key (the "Look settings" lists
below). So a new theme / palette / finish is **defined** in the engine (THEMES, C, LOOKS, a post pass) and **selected and
tuned in style.json `defaults`** (`{ "theme": "midnight", "post": { "vignette": 0.08 } }`); a value changed in engine
`DEFAULTS` on a key the look sets never shows (`cz check` warns: "hidden by the look"). Engine `DEFAULTS` are for new keys
the style adds. Details: docs/METHOD.md, "How settings reach the engine".

## Picking a base

| The videos need | Base | Why |
|---|---|---|
| Something new, 2D (shapes, type, diagrams, infographics, kinetic type, pictures) | `starter --dim 2d` | neutral engine with every hook a style needs (themes, elements, transitions, finish, checks) |
| Something new, 3D (lit solids on a ground, simple objects, text on a HUD) | `starter --dim 3d` | same, with 3D contact checks |
| Flat-vector explainers with a recurring cartoon character | `flat` | the character rig, flat shading system, procedural icons; no pictures |
| Paper cut-out collage, picture-heavy documentaries | `collage` | builders for cut-outs, photos, headlines, torn paper; needs generated pictures |
| Real-event 3D documentaries: places, people, vehicles, maps, archive media | `recon` | real maps and terrain, downloaded models, rigged people with planted feet and verified hand holds, footage and photo overlays, the strongest checks |
| Game-capture 3D shorts: low-poly people, sets, props, fast cuts | `lowpoly` | the asset library, mocap people with roles, cameras that always move, engine-drawn captions |
| Retro 3D with a 16-colour palette and a HUD | `pixel-art` | banded materials, outlines, dithered sky, palette snap |
| MS Paint stick figures, one picture per clause | `stickman` | the shot language, sprites, sets and props by name |

When the references mix two worlds (a 2D collage with occasional 3D maps), pick the base that carries the hardest part
and build the other part in it. Never stitch two engines together.

---

## starter (2D or 3D, 16:9 or 9:16)

**Good for:** any style that doesn't fit another base; the cleanest place to start a new look. 2D: flat shapes in pixels,
text, cards, labels, counters, arrows, pictures (`image(p, key)` from project.json "images"). 3D: box, sphere, cylinder,
ground, lit and shadowed, text on the HUD. No characters, no maps, no footage built in: a style adds its own elements.
**Look settings (controls):** format, dim, captions on/size, post grain/vignette/contrast, camera push-in, transition length
(+ brand colour).
**Extension points:** `THEMES` (palette, every key the base has: `bg bg2 surface ink muted accent accent2 good bad line
ground sky floor dark light`; selected with `"theme"` in style.json `defaults`), `DEFAULTS` (new keys only: the look sets
theme, captions, post, camera, transitions, quality), `FONT` / `MONO` / `FONT_FILES`, `registerElement(name, fn)` in models.js,
`TRANSITIONS` (GLSL bodies), `POST_UNIFORMS` + `POST_GLSL` (finish passes), `LAYOUT_CHECKS` (the style's own rules),
`CHECK` / `VISIBILITY` / `CAMERA_LIMITS` (thresholds: tune with a reason, never delete), `lib/kit.js` (`kitShot`,
`kitGallery`), layout values `SAFE BAND ZONE TITLE GY VERT`.
**Checks:** cut, caption, overlap (12 %), small (40 px), contrast (3:1), empty (12 %), kit, DARK, CRUSHED, ABRUPT; 3D also
floating, through, coplanar, flicker. Must-fails shipped: overlap, cut, small, DARK (+ floating in 3D).
**Seeded random:** `rng(seed)`, `S.rng()`.
**Traps:** 2D elements in the 3D world (and the reverse) throw; numbers that fit one format; `%` loops jump; state kept
across frames breaks seeking; a `LAYOUT_CHECKS` function that throws reports nothing; a transition key added inside a
shot falls back to dissolve; keep `THEMES.base` and `THEMES.dark` (the kit helper shows every element on both).
**API:** `bases/starter/skill/references/engine_api.md`, law in `RULES.md`, a correct scene in `example_scene.js`.

## flat (2D, 9:16 or 16:9)

**Good for:** bright flat-vector explainers (science, psychology, money) with the project's own main character
(`character.js` from the member's character library: the style never writes it). Everything procedural: no pictures.
Colour carries meaning (one colour per concept). Orthographic, exact hex (colour management off).
**Look settings:** format, captions on/size, post grain/vignette, camera push-in and cut punch-in, transition length.
**Extension points:** `C` (palette: change values, add keys, keep every key), `BG` + `DARK` (grounds), `DEFAULTS` (new keys
only: the look sets captions, post, transitions, camera; tune those in style.json `defaults`), one font
family (`FONT` / `FONT_FILES`; a second family = an optional `font` option on `text()`), the shading system
(`shaded`, `crescent`, `ball`, `slab`, `withRole`; one light, top-left), element looks (`tag`, `title`, `line`, `burst`,
`bokeh`), `finish()`, `captions()`, transitions (shader `mode` branches; `dissolve`, `cut`, `slide-*` must keep working),
models.js (`icons`, `POSES`, `TRAITS`, composites as new exported functions). No `THEMES`, `registerElement`,
`LAYOUT_CHECKS` or `TRANSITIONS` tables: a style rule becomes a new `LAYOUT_CHECKS` export appended in `layoutIssues`.
**Checks:** small (labels >= 44 px, fails under 40), shading (detail outside the element's own form, fails above 6 px),
overlap, empty, cut, caption. Must-fails shipped: overlap, cut, caption.
**Seeded random:** none exported: seed like `burst({ seed })` / `randomLook(seed)` do, or add an `rng` export.
**Traps:** shading laid on top of a form instead of cut from its outline; one element shaded and its neighbour flat;
`t > X ? A : B` on a face or pose (it jumps: blend with `mixPose`, `expr()`); a partial pose spread into maths gives NaN
(start from `{ ...POSES.rest }`); a `//` comment inside a one-line template swallows the line; vignette above .16 turns
corners brown; translucent warm over cool turns brown (opaque tints); the rig's joints and `character(p, opts)` signature
are the contract for every library character.
**API:** `bases/flat/skill/references/engine_api.md`; the element gate in `QUALITY_STANDARD.md`; `STYLE_GUIDE.md`;
`characters.md`; `pitfalls.md`.

## collage (2D paper in a 3D camera, 9:16 or 16:9)

**Good for:** cut-out collage documentaries built from pictures: cut-outs, photos, headlines, ransom type, scripts, marks,
tape. Two modes: `'front-page'` (every chapter a panel on one broadsheet, the Vox look) and `'scenes'` (every panel a
full-frame scene: the neutral start for any style that is not a newspaper). **Needs pictures:** in the app, videos get
them from the member's image service (`make_image`); set `capabilities.needsImageKey` so New project tells them. No text
inside pictures: all text is engine type.
**Look settings:** format, theme (paper and ink), pictures per minute, post paper/halftone/grain/vignette/warmth/tone,
cut-out shadows, sticker border, camera creep per shot, whip-pan length, panels per row.
**Extension points:** `DEFAULTS` (`mode` and `look`: torn, texture, fonts, default entrance and move are read from it; the
base look sets theme, palette, post, camera, transitions, sheet, pace, shadow, border: those go in style.json `defaults`),
`THEMES` (all roles; selected with `"theme"` in style.json `defaults`), `C` / `BRAND` (never a hard-coded red: `C.red`, `C.brand`), `FONT_FILES` + `FONTS`, `paperCanvas` / `tornPath`,
element builders via the internal `element()` (register new ones in `panel()`), entrances (`animate()` + `IN_SFX`),
transitions (`TRANS_DUR` + `transOf`: whip .85, slide 1.3, move 1.6, push 1.3, pull 2.6 s), post uniforms, models.js.
**Checks:** cut, frame (a zoom shows past its panel), overlap (4 %; marks 1 %), mark, small (18 px), contrast (2.8:1).
Must-fails shipped: cut, frame, overlap.
**Seeded random:** `rng(seed)`, `hashf(n)`. `tape()`'s streak loop calls `Math.random()` (base debt): switch it to
`rng(e.seed)` when you touch it.
**Traps:** `shake(` and `in: 'slam'` read as slapped-on motion; `stamp()` only for a date or number, unboxed and level;
no section cards or kicker titles; marks placed by eye land beside the word (`mark({ around, word })`); a mark started
before the script's pen finishes; red text on a map or kraft measured invisible; drift shrinks the frame over a shot;
transitions are centred on `at` (land the incoming hero at `at - .5` or earlier); no `ref` passed to make_image.
**API:** `bases/collage/skill/references/engine_api.md`; `style_guide.md`; `pitfalls.md`.

## recon (3D documentary, 16:9 or 9:16)

**Good for:** real events re-staged in 3D: real places from map and elevation data, free downloaded models of real
machines (CC0 / CC-BY, credited), rigged people whose feet stay planted and whose hands really hold things, photo and
footage overlays with source credits, tags, timecards, cards. Two built-in looks: `studio` (matte clay, bright seamless
studio) and `investigation` (dark, one cool key, shallow focus, desaturated grade, one crimson accent). The strictest
checks of all bases (contact, collide, coplanar, flicker, visibility, holds).
**People:** two mannequin bodies (male, female) + the member's uploaded characters (`custom:<id>`), finishes per role,
an animation catalog with quality marks. The male mannequin is a Mixamo file: the kit never copies it; its server reads
it from the installed app (`cz doctor` warns when the app moved), and `cz package` leaves it out.
Never put a Mixamo file into a style. The animation catalog is read from the app too; uploaded characters (`custom:<id>`)
and the member's own imported clips are not available in the kit, so check people with the two mannequins.
**Maps, models, media in videos:** the app's build fetches them (the skill's `bake_region.py`, `fetch_terrain.py`,
`fetch_model.py`; the member's Look switches "Real maps", "Free 3D models", "Real photos and footage"). Keep the sample
simple: procedural sets and models from the base; nothing downloaded without a licence the credits check allows.
**Look settings:** format, theme (Look), render quality, ambient occlusion, grain, vignette, contrast, desaturation,
characters, real media on/per minute, free 3D models, real maps.
**Extension points:** `THEMES` (a theme sets every key the comment above it lists; `THEME_ID` only picks `investigation`
or `studio` until you change that line to `THEMES[SETTINGS.theme] ? SETTINGS.theme : 'studio'`, then `"theme": "<yours>"`
in style.json `defaults` selects it; keep both built-in themes), `C` (prefer `THEME.pal` overrides), `MAT`, `DEFAULTS`
(new keys only: the look sets quality, post, media, models, maps), the theme `grade` (not a third shader), `LIGHTING` rig
presets, `CAMERA_LIMITS`, effect transitions (`TRANS_KINDS` + `FX` + `transSpan` + `transFx`), fonts (`FONT_FILES`, `F`,
`CF`), the 2D overlays (restyle card shapes, keep `{ t0, t1, what, text, draw }`), the corner badge (`THEME.tag`),
`LAYOUT_CHECKS`, `VISIBILITY`, models.js, lib kits (`crime.js`, `crimeover.js`, `figures.js` outfits and roles,
`library.js`, `camera.js` named moves, `props.js`, `hands.js`).
**Checks:** floating, through (contact), overlap (collide: bodies vs bodies and solids every 0.1 s, 1 cm tolerance),
nocollide, support, sunk, coplanar, flicker, DARK, CRUSHED, SUBJECT, BLUR, ABRUPT, HOLD, PLACEMENT, TEXTPLACE, PIXELATED,
STRINGEND. Must-fails shipped: floating, through, coplanar. `lib/contact.js` and `lib/collide.js` are the checks
themselves: never edit them (the app hash-locks them).
**Seeded random:** `hash(i, n)`, `jitter(seed)` (models.js).
**Traps (each one reached a render once):** cross-dissolving two 3D scenes (ghosted doubles: cut or dip); stacked floors
1-3 mm apart flicker (one surface per surface, details >= 1 cm proud, near/far set per scene with `S.studio({ near, far })`);
a studio floor under an interior; bodies placed by eye (plan positions as numbers: 0.95 m between people whose arms swing,
0.6 m standing); hands not through `hold` / `handTo` / `grip`; walkers not through `walkAt` / `clipSpeed` (feet slide);
`Box3.setFromObject(obj)` without `true` on rotated meshes; underexposure for mood (relight, never brighten in post);
bloom, chromatic aberration or heavy vignette on the studio look; textures loaded lazily (black first frames); a camera
tied to a wobbling heading; the v9 Graphics layer (`applyGraphics`, `getGraphics`) is the user's: never set it from a style.
**API:** `bases/recon/skill/references/engine_api.md`; rules in `quality.md`, `signoff.md`, `no_slop.md`, `failures.md`,
`playbook.md`; people in `characters.md`, `hands.md`, `animations.md`, `props.md`; cameras in `camera_moves.md`.

## lowpoly (3D game capture, 9:16 or 16:9)

**Good for:** shorts that look like captured game footage: low-poly people with mocap clips and drawn faces, sets and
props from the asset library, a camera that always moves, one clause = one shot (1.5-2.5 s, about 24-30 cuts a minute),
in-scene number callouts, captions drawn by the engine. Two looks: Bright and Moody. The low internal resolution, soft
upscale, halo and colour fringe ARE the look: don't "fix" them.
**Assets:** the library (`__lib/`: the app's seed library plus the member's finds) is served read-only from the app.
Models come from it by plain-string id. A model the library lacks is added in the app, not inside a style package.
**Look settings:** format, look (Bright / Moody), render resolution, main character and cast roles, captions on/size/height,
sharpen, colour fringes, glow, vignette, camera push-in and shake, wipe length, PS1 strict switches (vertex wobble, texture
warp, dither).
**Extension points:** `LOOKS` in lib/core.js (render, post, light, fog, captions, camera, transitions; a third look means
teaching `LOOK` the key and checking every `MOODY` branch; selected with `"look"` in style.json `defaults`, and the look's
render / post / captions / camera / transitions values tuned there too: the base look sets them all), `C`, the final pass (lib/post.js `createPost`), transitions
(`TRANS` + `durOf` + shader modes; flashes <= 70 % white), camera kinds (lib/camera.js), light and sets (lib/sets.js
`buildSet` cases, closed rooms with ceilings), the 2D layer (lib/ui.js: fonts, captions, callouts, panels), the kit
(lib/kit.js), people (outfits, faces, roles: scenes use roles so the member's character picker keeps working). Checks
have no hook table: add a `LAYOUT_CHECKS` export and append its findings in `layoutIssues`.
**Checks (lib/check.js):** feet (slide > 3.5 cm), hand (> 3.5 cm from the palm), bodies (two people overlapping > 5 cm:
keep 0.6 m apart unless `userData.touch` marks a hug or handshake), look (head turned
past ~80 degrees), camera (inside geometry), ceiling, edge (the world's edge shows), coplanar, thin, small (26 px at 1080
wide), offframe, covered, subject, scale, support, through. Must-fails shipped: covered, floating, offframe. lib/check.js
is calibrated on a planted-fault set: never loosen a detector; add rules beside it.
**Seeded random:** `rnd(seed)`, `noise1(x, seed)` (lib/core.js).
**Traps:** asset ids built at run time are never preloaded ("asset X is not loaded"); Draco / Meshopt / KTX2 models have
no decoder; Kenney / KayKit sizes are wrong (give `height:` / `width:`); a person marked `airborne` loses every check;
chairs placed with `ry + Math.PI` face away; `KK_Sneak_Loop` sinks toes; a local name that clashes with a re-export
breaks boot; colour management stays ON here (unlike flat); no captions of your own (the engine draws them).
**API:** `bases/lowpoly/skill/references/engine_api.md`; procedure `sop.md`, gates `qa.md`, the look in numbers
`style.md`, people `motion.md`, assets `library.md`; traps `PITFALLS.md` at the skill root.

## pixel-art (3D pixel art + HUD, 16:9 only)

**Good for:** retro explainers: a low-resolution 3D world (320 / 384 / 480 / 640 wide) with banded materials, outlines, rim
light and a dithered sky, snapped to a 16-colour palette, under a true-colour HUD drawn in 320 x 180 units, with real-image
cards for things named.
**Look settings:** art resolution, depth / object outlines, rim light, outline fog fade and colour, cast shadows and shadow
detail, vignette, edge dither, transition length, pixelate transition, field of view, camera push-in.
**Extension points:** `DEFAULTS` (new keys only: the look sets art, outline, shadows, post, transitions, camera; tune those
in style.json `defaults`), `C` (exactly 16 keys: change values only; the post shader holds 16 entries), `RAMP`
(add ramps freely), `LIGHTER`, `facet()` / `facetFS` (every 3D look decision), fog / shadow / light defaults, the
`postMat` fragment (a new transition = a new `mode` branch + the auto list), per-shot `S` keys, `FONT` / `FONT_FILES`, the
HUD (`text`, `stat`, `tag`, `rect`, `frame`, `line`, `card`; keep the `SUITE.pick` pushes), chapter slam / tag, models.js.
**Checks:** none in the engine (no `layoutIssues`): the frames check (BLANK, DARK) is the machine check. Must-fails
shipped: blank, dark. A style may add `layoutIssues` / `checkTimes` exports (host.js calls them when present; the HUD boxes
in `SUITE.pick` are the natural input) and then writes must-fails for them.
**Contract note:** the base engine exports no `ENGINE_KIND` (host.js reads a missing one as `'pixel'`), and
docs/bases/pixel-art says not to add one. In the kit the engine contract names the kind, so `cz new` adds
`export const ENGINE_KIND = 'pixel';` at the end of the style's engine.js. Keep that line; add no other.
**Seeded random:** `rng(seed)`.
**Traps:** Lambert / Standard materials dither into grey mush (everything through `facet()`); colours outside the palette
turn into dither noise; bright tops on big grounds glare; `setOpacity` on a shared material fades every user of it
(`{ unique: true }`); `S.fogFar` closer than the farthest important object flattens it; a scene file importing another
registers its shots twice; `chapter` must be `['01', 'TITLE · SUB']`; the old skill text's render.mjs / setup.py commands
are not how the kit renders (use `cz`).
**API:** `bases/pixel-art/skill/references/engine_api.md`; `style_guide.md`, `scene_design.md`, `qa_checklist.md`, `assets.md`.

## stickman (MS Paint stick figures, 16:9 only)

**Good for:** the deliberately crude Paint look: stick figures (sprites first, the rig as fallback), sets, props, cards,
one picture per clause, hard cuts on the voice alone. Scenes are text in a shot language, not code: ``script(`...`)``
with `>` narration lines (one line = one shot), `set`, `card`, `text`, `photo`, cast lines with poses and expressions, and
`@word` beats. No times are written: the engine finds each `>` line's words in the narration.
**Look settings:** more details, real images from the web (on, per minute).
**Extension points:** `DEFAULTS` (new keys only: the look sets detail and web), the palette `P` (lib/paint.js, exported as
`C`; keep `accent` and `brand`), the Paint
primitives (outline width, `wob()` wobble, text font and threshold), `rnd()` / `reset()`, `SETS` (each returns its ground
y), `PROPS` (`G` ground / `F` float), `POSES`, `ITEMS`, the rig (`DIM`, `LW`, faces), new grammar keywords in
`parseScript` + `drawItem`, `shotProblems()`, `FONT_FILES` (empty: system Comic Sans).
**Checks:** none in the engine (no `layoutIssues`); `shotProblems` flags shots over 6 s and empty white frames; the frames
check is the machine check. Must-fails shipped: blank, dark.
**Seeded random:** `rnd()` (reseeded per shot).
**Traps:** each shot+beat is ONE cached still (anything time-based inside a beat never moves); no transitions, camera
moves, sound effects or music; a skipped `>` line shifts every later match; pictures longer than ~4.5 s drag (and a still
shot of 2.5 s or more trips FROZEN: use beats); held items via `hold=` not as props "at the hand"; restyling the rig without
the sprites makes two looks in one video (sprites are drawn in the Paint style and preferred over the rig); no
anti-aliasing anywhere.
**API:** no engine_api.md: `bases/stickman/skill/references/script.md` (the shot language), `catalog.md` (every name a
script may use), `style.md`.

---

## What every base shares

- The engine contract (docs/CHECKS.md, `contract`): exports only added, `ENGINE_KIND` unchanged, `ENGINE_VERSION` bumped
  whenever engine.js changes, in the exact format `export const ENGINE_VERSION = N`.
- Frames are pure functions of `t`; the banned list is the same everywhere (docs/CHECKS.md, `banned`).
- `cue('word', near)` places events on spoken words (stickman: its `>` lines and `@word`); transcripts mishear words, so
  cue the word as it is written in `audio/timeline.json`.
- The shared runtime (the host page, the server routes, the render workers, the base's sound pass) is not part of the
  style. It is the app's, it keeps every custom engine working, and the style never patches around it.

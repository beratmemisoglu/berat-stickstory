---
name: recon-reconstruction
description: Build a narrated 3D reconstruction documentary (matte clay Three.js scenes in a seamless high-key studio, real maps from OpenStreetMap and elevation data, real photos and footage, free downloaded 3D models, the user's mannequin characters (figure(role)), black name tags and news-desk cards; or, in the Investigation look, a dark, cinematic investigative documentary on any topic with faceless mannequins, full-screen archive, pinned boards, red-grid networks and evidence desks) inside Toon Studio, and sign it off with the automatic checks and a frame-by-frame review before anything is rendered.
---

# 3D reconstruction documentary (Toon Studio)

The look: the "what really happened" reconstruction channels. Real events re-staged as matte off-white clay models in a
seamless grey studio, high key and natural (soft key light, ambient occlusion, almost no post), with black name tags on
leader lines, bottom-left timecards, chapter cards, real photographs in white print frames and real footage cards.
Places are real: maps and terrain come from OpenStreetMap and elevation data. People are the project's characters,
`figure(role)` mannequins (both looks) with planted feet and hands that touch what they hold. Every fact on screen is checked.

**Two looks.** The project's `settings.theme` picks one (project.json; CLAUDE.md says which is active):
- `studio` (default, the Studio look): everything in this file as written.
- `investigation` (the Investigation look): a dark, cinematic investigative documentary - a VISUAL style for any topic
  (sport, business, history, science, a life story or a crime). The workflow changes: read the section
  "Investigation look" below first; it overrides the steps and the look rules it names. Everything else (no overlaps,
  contacts, sign-off, real and credited) stays.

Read before writing anything:
1. **references/quality.md**: the standard and the 14 hard rules. Each one exists because it was broken once.
2. **references/signoff.md**: how a video is signed off before it may be rendered (the automatic checks + the frame review).
3. **references/engine_api.md**: the engine, models, library, world and check APIs, with examples.
4. **references/failures.md**: every defect seen so far with its cause and fix. Skim it, and search it when something looks wrong.
5. references/playbook.md is the long version of how the reference films were made (Hudson, Tacoma, Apollo 13, Tham Luang).
6. Investigation look only: **references/investigation_shots.md** (narration trigger -> shot -> kit call, cut rules, pacing)
   and **references/investigation_script.md** (the investigative script: 14 beats, 32 rules, visual tags, breaks).
7. **references/no_slop.md** (MANDATORY, both looks; it outranks every pacing number): the owner's no-slop SOP - the bans,
   the failure catalogue, the PRE-RENDER CHECKLIST, lighting / interaction / camera / readability / pacing rules.
8. **references/camera_moves.md** (engine v15+): the named camera moves (lib/camera.js). Every shot's camera starts from one
   of them (framing by shot size and angle on a subject), customised by its parameters; raw keyframes only when none fits.
9. **references/props.md** (engine v15+): the prop kit (lib/props.js), the placement rules (`place()` / `arrange.*`: on what
   holds it, facing what it serves, never overlapping or in pieces) and how to design a new prop (its own file, checked alone
   with the `view_prop` tool before it goes into a shot).
10. **references/characters.md** (engine v17, both looks): every person is `figure(role)` (lib/figures.js): two mannequin
    bodies, each role's body / finish / colour from Look > Characters, groups, the user's own uploaded characters.
11. **references/animations.md**: the clip catalog (lib/anims.js: 131 built-in clips + the user's imported Mixamo clips,
    `findAnims(tag)`); and **references/hands.md** (when present): objects held in the hands (lib/hands.js `hold()`).

**Crew builds (the app's Build):** the build's Claude is the director: it plans, writes what every chapter shares
(scenes/c0_setup.js, lib/shared.js), then scene-builder agents build the chapters at the same time, one writer per file, and
the director integrates and signs off the whole film. The prompt of each role says exactly what it may touch.

**Banned in every look (no exceptions):** red stamp / plaque / verdict overlays (`stamp()`, `list()` `mark`), any notice
that the voice is AI, and sound effects the user did not supply. The voice is the user's ElevenLabs voice.

**Vertical 9:16 (`settings.format === 'vertical'`, engine v14+):** the frame is FW 1080 x FH 1920. Shot `fov` values keep
their 16:9 meaning; the engine widens the lens so the portrait frame holds most of the centre square of that framing (~80% across) plus more
above and below. So frame subjects vertically (standing figures, towers, a route running up a top-down map), keep the
key content and every name tag, timecard and caption in the centre column, and place overlays from `FW` / `FH`, never
from fixed 1920×1080 pixel positions. Check the frames at 1080×1920 in the review.
Shorts apps cover the top ~190 px and the bottom ~400 px with their own buttons and captions: `OV_SAFE` ({ t, b, l, r })
holds those margins, and the overlay defaults already respect them in vertical (photo / footage: a centred print in the
upper half; timecard, source, cite: above the bottom margin; tag: clamped inside). Leave x / y out unless you need a
place, and then keep it inside OV_SAFE.

## How a video is built
1. **Research the event.** Use research.md if the script step wrote one. Otherwise check the key facts with WebSearch: dates,
   times, places with coordinates, who was there, the real sequence of events.
2. **Plan it in storyboard.md.** List one shot per narration beat (a new shot every 4-8 s). For each shot give what it shows,
   the camera, the overlays, and which real asset it uses. A good mix:
   - a real-map establishing shot
   - close reconstructions of the key moments
   - one real photo or footage card per chapter
   - a diagram or data card where the story explains something
   - a closing headline with sources
3. **Real places.** Make one map per place with `scripts/region.py`; the build prompt gives the exact Python command. Use the place's
   real latitude and longitude. Apply the **period rule**: only the map layers that existed at the time (no modern roads or bridges
   in a 1940 story). Then load it in the first scene with `await setup({ region })`. An airport: add the `aeroway` layer
   (runways, taxiways, aprons, terminals, gates). Engine v16: build a map shot with `regionMap()` (lib/maps.js) and every
   exterior or window view with `horizon()` / `apron()` / `terminal()` (lib/exterior.js): references/engine_api.md
   "Maps and exteriors". A map reads at a glance and an exterior never shows a void.
4. **Real media.** Only free, credited sources:
   - Photos: the `web_image` tool, which uses Wikimedia Commons and records the credit. Show them with `photo()`.
   - Footage: a public-domain or CC film from Wikimedia Commons, extracted to numbered jpgs and shown with `footage()`.
5. **Free 3D models.** Download where a real object needs a real shape: spacecraft, vehicles, aircraft, animals (never people).
   - **Sources:** CC0, public-domain or CC-BY models from sources that need no account: NASA 3D Resources, Smithsonian 3D (CC0
     items), Poly Pizza, Quaternius, Kenney, and Khronos glTF samples (check each one's licence).
   - **Licence:** check it on the model's own page, then download with `scripts/fetch_model.py`. It refuses NC, ND and unclear
     licences and records the artist in assets/models/CREDITS.json.
   - **Upright:** downloaded models are often tilted or the wrong size. Load them with `model(key, { size/height/width, upright })`
     and find contact points with `hitAlong()`, never bounding boxes.
   - **People are never downloaded:** every person is the project's `figure(role)` (references/characters.md), in both looks.
     `actor()` / `cast()` are legacy: only for keeping an old project's existing scenes working, never for new people.
   - **Building it yourself:** if no free model fits, build the object procedurally from basic shapes (box, mesh, extrusions,
     lathe), following its real proportions.
6. **Check every asset alone first.** Before using a new asset in a shot, look at it alone at full size from the front and the side:
   with the `view_prop` tool (engine v15+: a 2x2 sheet and a report of loose / floating parts and its size), else with
   render_frames on a temporary close camera in its first shot. Is it upright, the right size, sensible, detailed enough?
   Fix it, then put the shot's camera back.
7. **Write the scenes.** Write one file per chapter in scenes/ (e.g. scenes/c1_the_crash.js), registered in project.json "scenes"
   in order. Keep "end" as the app set it.
   - The first scene file starts with the setup call: `await setup({ region, models, textures, images, sequences })`.
   - Every event lands on its word: `cue('word', near)`.
   - **People** (both looks): `figure(role, { parent: S.scene, x, z, ry, act, t })` from lib/figures.js. The scene names
     the ROLE, never a look: each role's body / finish / colour is the user's (Look > Characters, `settings.figures`); never
     pass rig / outfit / colors, never override the user's role picks (a shared look for a GROUP in code: `figureGroup()`).
     The story's person is `figure('main')`. In the Studio look a matte finish suits the clay set, but the user's picks win.
     They act what is said: `f.act()` / `f.play('<catalog clip>')` / `f.sequence()` (references/animations.md: `findAnims(tag)`,
     never invent a clip name); seated people ALWAYS with `sitOn(S, person, seat)` (lib/props.js); held objects with
     lib/hands.js `hold()` (references/hands.md when present). The colour is the identity: never recolour a role per shot.
   - Every shot with people or moving bodies declares `S.collide` (`f.caps()` for a figure).
   - Sounds go on the frames the picture shows them: `sfx(type, t)`.
8. **Sign off** (references/signoff.md). Do this before you finish, and do not skip it.
   - check_preview: no errors, no cue misses.
   - check_layout until it says Clean. On this style it runs the coplanar audit, the interpenetration check and the z-fight probe
     over the whole film.
   - render_frames at every shot's start, middle and end (scale 0.5, up to 4 per call), and at full size (scale 1, one or two
     per call) wherever a flaw would show: contact points (feet on the ground, hands on what they hold, wheels and hulls),
     faces, tags and small text, and every moment something moves near something else.
     Fix what is wrong, then look again only at the moments you changed. A check_layout finding is never left standing: fix
     it at its cause until it says Clean. A purely visual flaw still wrong after two more looks: write it in storyboard.md
     and move on. A moment whose files did not change comes back as text, not a new image. Each run has a frame budget sized
     to cover this whole sign-off; if render_frames ever says it is used up, finish with check_preview and check_layout and
     list the moments you could not look at.
   - Every image stays in the conversation and costs the user's Claude plan again at each later step: one look per moment,
     no repeat sweeps of the whole film (check_layout measures what can be measured; run it on the times you changed).
   - Review readability: nobody hidden, nobody headless, nothing cut off, no card over the subject, never two tags in the same place.
9. **Write the sound.** Write audio/beds.json, one bed per stretch: wind outdoors, water at sea or in caves, drone inside, space
   in orbit. Then sfx() calls in the scenes for impacts, splashes, alarms and ticks (references/engine_api.md "Sound").
10. **Write DESCRIPTION.txt.** A short summary of the event, then every credit: the photos and footage (from
    assets/credits.txt), the 3D models (from assets/models/CREDITS.json), the map data (OpenStreetMap ODbL, AWS Terrain
    Tiles), and a note on what is simplified. This is pasted into the YouTube description.

## Investigation look (`settings.theme === 'investigation'`)

A 10-15 minute dark, cinematic investigative documentary at the pacing of the big investigation channels: faceless glossy
mannequins in near-black dioramas (~40-45% of screen time), real archive, photos and stock full screen (~25-30%), papers on
a desk (documents, headlines, screens with a highlighter, ~15-20%), the red-grid network and the pinned board (~10-15%), quote
cards, maps and cards for the rest. The pacing is the identity: median shot ~2.3 s, long-burst-long. Engine v7+ (`THEME`,
`broll()`, `cutAt()`, effect transitions) with the kit modules `lib/crime.js` (3D: crimeBoard, networkGrid, sideView,
evidence, darkSpace, setBedroom / setOffice / setLobby / setStreet / setVoid), `lib/crimeover.js` (2D: placeTag,
lowerThird, statFloater, notice (never about an AI voice), redact, chapterCard, titleCard, quoteCard, headlineCard, creditsPanel, makeDoc) and
`lib/figures.js` (people: `figure(role)`). All of them: references/engine_api.md "Engine v7" + "Investigation kit".

**Any topic: the look is a visual style, not a genre.** It was designed from crime-documentary channels, but the story's
own topic decides the content. Crime devices (suspects and a victim, mugshot-like cards, redactions, police, "the crime",
an arrest) belong only to a story that IS about a crime or an investigation. Any other topic uses the same devices for its
own subject: the board (`crimeBoard`: the kit's historical name) pins that story's players, teams, companies or events; the
network grid shows who connects to whom in that field; the desk holds that field's papers (a team sheet, a contract, a lab
notebook, a match report); the roles are the story's own people; the tone is investigative (what really happened, and how),
never a crime show's. Never invent a crime, suspects, a victim, police or an investigation the story does not have, and
picture prompts (make_image, make_target, textures) describe the shot's own subject in the look's visual terms, never a genre.

**What changes in "How a video is built":**
- **Step 2, the storyboard**, follows references/investigation_shots.md instead of "a new shot every 4-8 s":
  - read script.txt for its tags (`[MANNEQUIN]`, `[PHOTO name]`, `[DOC]`, `[HEADLINE]`, `[UI]`, `[GRID]`, `[BOARD]`,
    `[PLACE+DATE]`, `[STOCK]`, `[ARCHIVE]`, `[SIDEVIEW]`, `[MAP]`, `[QUOTE: name]`, `[CHAPTER: title]`, `[BREAK Ns]`) next to
    audio/script_timed.txt (the words and their times); a script without tags gets them in the storyboard;
  - one row per shot: start (the anchor word), length, shot type, the words, the picture, transition in, camera, real asset
    with its credit number (experiments/crime-style/test60/storyboard.md is a worked example);
  - **cut ~1 frame before the word**: shots start at `cutAt('word', near)`; **the picture lands on the name** (a named
    person's photo + lowerThird on the name); **one shot per list item** at 0.6-0.8 s; **burst then hold** (3-12 cuts under
    a second, then a 3-19 s hold); **keyboard stutter** (3 x ~0.65 s typing close-ups when someone goes to work);
    **black and chapter cards only in narration pauses** (a [BREAK] or a real gap in audio/timeline.json);
  - aim at the reference pacing: median shot ~2.3 s, about 16 shots per minute overall, 40-60 cuts/min in the cold-open
    teaser and montages, ~14/min under dialogue, ~5/min on long grid or quote-card explanations.
- **Shot types and when to use them** (full table in investigation_shots.md):
  - MANNEQUIN diorama: a person doing something, in present tense (a set + `figure(role, { act })`).
  - BOARD: linking the story's players, events and clues (`crimeBoard`, pins, red string, camera along the string; in a
    crime story the investigators' board of suspects and clues).
  - GRID network: who connects to whom, money or data flowing (`networkGrid`, one node per spoken noun).
  - DOC / HEADLINE evidence desk: a claim, a record, a press fact (`evidence` + highlighter on the spoken phrase,
    `headlineCard` with a punch-in on the number).
  - BROLL full screen: real archive, photos, stock (`broll()` edge to edge, credit, censor; the 3D is not rendered under it).
  - SIDEVIEW: a route through a building, who was on which floor (`sideView`, locked camera, crimson path).
  - MAP: travel between real places (region maps as in the Studio look, `placeTag` for the date).
  - QUOTE card: a real person's own words or voice (`quoteCard`, words typing on their timings).
  - PLACE+DATE: every jump in place or time (`placeTag`, rolling year, carried across the cut).
  - CHAPTER: a chapter card inside a pause, framed by black (`chapterCard` in a `flat` shot after a `trans: 'black'`).
  - LOWER THIRD: the first appearance of a real named person (`lowerThird(name, role)`, decodes in).
- **Step 4, real media**: the look's `media.perMin` is the number of real pictures per minute, and here they are mostly
  full-screen `broll()` (archive film, period photos, stock), not framed cards. Find them as in the Studio look (web_image,
  Wikimedia Commons, public-domain or CC footage), declare every source once with `sources(...)` and give each one its
  numbered credit; a 3D shot that shows a real fact can carry `cite()`.
- **People**: the same `figure(role)` as in step 7 (references/characters.md); here the glossy and glow finishes read best
  on the dark, but the user's picks in Look > Characters win. **The colour is the identity**: never recolour a role per shot;
  an unknown or withheld person stays the `'unknown'` figure until the reveal.
- **Step 9, sound**: NO sound effects unless the user supplied them (the v1 review: "disruptive"). The kit's overlays are
  silent by default (`{ sound: true }` opts in, only with the user's sounds); don't add `sfx()` calls on your own ("the user's sounds" = their Sound effects library, Settings > Media, which
  sound_design.py plays first through sfxlib.py, or the clips they place in Music & effects > Layers; project.json
  `sound.effects` is auto | library | off, off by default in the Investigation look). Voice =
  the user's ElevenLabs voice; music-only stretches go where the [BREAK] markers are.
- **references/no_slop.md is mandatory here** (read it before the storyboard): the v1 review's failures (sets where nothing
  is visible, blurred grey close-ups, egg-head mannequins, a painting carried with unattached arms, an abrupt push, cards
  held 0.7 s, scrambles unresolved at the cut, a drawn-oval thumbprint, red stamps, an 'AI-generated voice' notice) and
  the PRE-RENDER CHECKLIST every shot must pass. Keep what the owner liked: highlights on real footage and documents,
  clean layered compositions, real period media full screen with its credit.
- **Colour code**: one crimson accent over black and grey. Red = threat / digital (grid, padlocks, skulls, progress bars),
  blue = a character's mind (circuit lines). No other saturated colour except a role's colour.
- **No gore.** Violence and abuse are never shown: a headline carries them.

## Progress file (long builds)

Keep `.suite/build-progress.md` up to date: create it at the start, and after each chapter / scene file write what is done
and which sign-off checks it passed, the decisions to keep (palette, people and their looks, models and their credits,
camera rules, naming), open problems and what is next. A long build can outgrow the conversation, which Claude Code then
summarises: after a summary (or in a fresh conversation) read this file, CLAUDE.md and storyboard.md first and carry on
from "next" without redoing finished work. The sign-off still covers every shot.

## Non-negotiables
- **Graphics are the user's.** The editor's Graphics panel (engine v9) saves render scale, shadows, AO, depth of field,
  bloom, anti-aliasing, tone mapping, exposure, grade and export quality in `settings.graphics`. Never write or reset it,
  never hard-code a value a scene uses to fight it (exposure, fog density, fov scaling, post strength): light the scene
  for the look and let the user's Graphics sit on top (references/engine_api.md, "Graphics settings").
- **The look's own light.** Studio: high key and natural. The light grey studio and matte clay stay. No heavy
  post-processing, no dark or moody grading, no blown highlights. Depth comes from ambient occlusion and the key light.
  Investigation: a dark mood that is always visible: the mood comes from contrast and colour, never underexposure. Every
  scene has a three-point setup (motivated key, fill 25-50 % of it, rim) plus practicals and a lit set, and passes the
  no_slop.md visibility gates; depth of field only behind the subject, vignette ~.30-.45, grain ~.03, highlights capped
  (nothing clips to pure white except a flash frame), one crimson accent. Text stays legible on the dark (light text, min
  sizes, nothing cut by the frame edge, held >= 1.5 s after it settles).
- **Nothing passes through anything.** Every shot with people declares `S.collide`, and check_layout must be clean.
- **Nothing snaps, nothing pops.** Moving things follow one curve sampled by arc length. Cameras that follow a subject
  are computed after it moves. Objects leave the frame or disappear inside an effect; they never simply vanish.
- **One surface per surface.** Never stack coplanar meshes. Give every scene a depth range that fits it: `S.studio({ near, far })`.
- **Real and credited.** Real places, real coordinates, real photos and footage where they exist, every one credited on screen
  with `source()` and in DESCRIPTION.txt (Investigation: a numbered `sources()` / `credit` / `cite()` on every real asset).
- **Overlays sit in empty space.** Never on the subject. A tag points at its subject with a leader line.

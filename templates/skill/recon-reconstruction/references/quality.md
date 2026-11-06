# Reconstruction style: quality standard

The bar is `out/hudson_recon_v7.mp4` (v4 set the layout rules, v6 the look and the world, v7 the motion, contacts and render hygiene). Defect history: FAILURES.md. How to build: PLAYBOOK.md. Nothing ships below it. Every rule here comes from a defect that reached a render.

## The SOP (in this order, every time)

1. **Assets first, alone, full screen.** Every procedurally generated asset is rendered by itself in
   `src/scenes/assets.js` (one per second, `node render.mjs stills --scenes assets --end N 0.5 1.5 ...`) from several
   angles (3/4, side, top, close-up). Each frame is viewed **at full 1920x1080 size**, one by one, never as a thumbnail
   or contact sheet. Anything off gets fixed and re-rendered before it goes into a shot.
2. **Then every shot, at its key moments, full size.** That means the start, the moment each overlay lands, and the end of the shot.
3. **Then the transitions.** Pull frames at each cut and mid-transition from the final MP4.
4. **Then the final MP4.** Spot-check frames pulled from the encoded file, not just the stills.

Contact sheets are only for overview and pacing. They never count as verification.

## Assets: it must make visual sense

- **Physically assembled.** Parts touch what holds them up. No floating parts, no gaps, nothing poking
  through a surface (fan blades inside the nacelle, sharklets on top of the wingtip, doors flush with the skin, feet on the floor).
- **Placed by the real thing's logic.** Engines hang under and ahead of the wing on a pylon. Windows sit on the skin.
  Cockpit glazing forms one band. Seat backs face the row behind them. Real-world references come first (A320 layout,
  NTSB facts, real coordinates for maps).
- **Enough detail to read as the object.** A seat has legs, armrests, a tray table and a pocket. A cockpit has a shell,
  windscreen, glareshield, screens, pedestal, overhead panel and harnesses. A map has real coastlines, airports and area names.
  A box standing in for a thing is a fail.
- **Every surface lit and shaded.** No unlit dark ceilings and no white-on-white mush. Interiors use `studio({ interior: true, lamps })`.
  Materials step in value (white figures, grey seats, darker carpet) so forms separate.
- **Characters are the project's mannequins.** Every person is `figure(role)` (references/characters.md, both looks), moved by
  catalog clips (references/animations.md), seated with `sitOn()`, hands placed with `handTo()` / `hold()` (references/hands.md when present).
  Hands go where hands would really go (sidestick, book corners, seat back ahead). Poses must not clip into props or poke out unnaturally.

## Shots: no overlaps, everything intentional

- **No overlay covers a subject.** Cards, tags and labels sit in empty space (sky, water, wall, map). If there is none,
  reframe the camera. Never just accept a card over a person or the aircraft.
- **Tags point at their subject.** Use `line: true` with a leader from an anchor on the object itself (`localToWorld` or a joint
  position). A tag floating near nothing is a fail. Tags stay 40 px inside the frame (enforced in `tag()`).
- **Nothing is cut off by the frame edge** unless that is the point of the shot. Tags, pins and subjects are all fully in frame.
- **Map labels avoid the overlay zones** (the clock, the time card and the cards, via `keepOut`).
- **Objects sit in their world.** An aircraft on water shows a waterline (the hull cut by the surface plus foam). Shadows land
  where they should, and nothing hovers.
- **The subject is framed.** What the narration names is in frame when it is named, big enough to read and not crowded.
- **No double exposure.** Transitions are hard cuts, or a dip through the studio grey. Two 3D scenes are never blended.
  (Investigation look: also the engine's effect cuts `flash`, `glitch`, `black` and `iris`; still never a cross-dissolve.)

## Legibility

- **Contrast:** grey studio (`#cfd0cd`) with white clay on top. Never white on near-white.
  (Investigation: light text, `C.text`, on the dark; never dark grey on black, never text over a bright highlight.)
- **Text sizes:** mono labels at least 16 px, tag subtitles 17 px, body text at least 22 px, all in dark charcoal (not light grey)
  in the Studio look; the same minimum sizes in light text in the Investigation look (source credits at least 11 px, on their dark box).
- **Text shadow:** text never gets a coloured glow or halo. Every overlay text uses the engine's one soft neutral drop shadow
  (`drawText` / `textShadow`, token `THEME.ov.shadow`); a red glow behind text reads as cheap.
- **Colour use:** one accent blue for what matters. Red only for alarms, never for a stamp, plaque or verdict mark. (Investigation: one crimson accent instead.)

## Facts

Every claim carries a source line or a source in its card. Quotes are short and verbatim, with the speaker and context given.

## Look, motion, world (added with v6)

- **High key, natural (Studio look).** Grade: vignette at most .07, grain at most .015, no chromatic aberration, bloom off. Depth comes from GTAO and a
  soft key light, never from haze, heavy blur or contrast curves. The Investigation look has its own bar (next section).
- **Depth range per scene** (`S.studio({ near, far })`). Coplanar floors otherwise z-fight and "clip" at distance.
- **No snapping.** Anything that moves along a path uses one curve sampled by arc length (`getPointAt`). Every overlay attached to
  it (the route line, tags) samples the same curve. Check this numerically: no frame-to-frame difference spike above 3x the median.
- **Real world, real media.** Real places come from real data (OpenStreetMap, real coordinates). Real people and events get a real
  photo or footage where a public-domain or CC source exists, credited on screen (`media/CREDITS.json`).

## The Investigation look (settings.theme = 'investigation', engine v7+)

A look-scoped bar: it replaces "High key, natural" and the Studio contrast rule above, nothing else. The hard rules below
(surfaces, depth range, continuity, contacts, collisions, sign-off) apply unchanged.

- **Dark mood, never murky, always visible.** The mood comes from contrast and colour, not underexposure: every scene has a
  written three-point setup (motivated key, fill at 25-50 % of it, rim) plus practicals and a lit set (a pool on the wall or
  floor behind the subject), and passes the visibility gates of references/no_slop.md (frame mean luma >= 45, < 35 % crushed
  pixels, subject mean >= 70 and 1.4x its surround, faces and hands >= 80 and sharp). A shot that fails is relit, not
  brightened in post. The v1 review found shots where nothing was visible: that is the worst failure of this look.
- **The grade the theme sets.** Vignette about .30-.45, grain about .03, contrast and desaturation from the look; highlights
  capped (nothing clips to pure white except the one frame of a `flash` cut); depth of field on the look point. Archive
  and photos get the archival grade of `broll()` (faded blacks, capped highlights).
- **One crimson accent.** Black, greys and one crimson (`C.crimson`, `C.dot`): red = threat / digital, blue = a mind.
  The only other saturated colour is a role's colour, and **the colour is the identity**: the same person has the same
  body, finish and colour in every shot.
- **Every real asset is credited on screen**: a numbered source line (`sources()`, `broll({ credit })`, `cite()`) on every
  archive clip, photo, headline and document that is real; designed props look designed, never fake archival.
- **Legibility still rules**: light text on the dark, minimum sizes as above, nothing cut by the frame edge, no card or tag
  over the subject, lower thirds and place tags in their lower-left zone, never two tags in the same place.
- **Pacing is part of the bar**: cuts land about a frame before their word (`cutAt`), black and chapter cards only in
  narration pauses, no gore (a headline carries it). Never cut faster than the shot can be read (no_slop.md P1-P4).

## Hard rules (added with v7; each one has an automatic check)

1. **One surface per surface.** Never stack two coplanar meshes (floor on floor, decal on wall). Paint detail into the texture
   of the one surface. Something meant to sit on a surface stays at least 1 cm proud of it, more at distance. Check: `S.audit()` (`?audit=1`)
   prints COPLANAR, and `render.mjs zfight` must say "clean" over the whole film.
2. **Depth range fits the scene.** `S.studio({ near, far })`: interiors .05-.1 / 60-120, the km map .02 / 120, metre exteriors 1-2 / 12000-16000.
   No studio floor under an interior.
3. **Nothing moves without continuity.** Paths are arc-length splines, cameras are computed after the subject moves and never tied
   to a wobbling heading, and attitudes (pitch, bank) are physically plausible and smoothed. Check: `render.mjs probe` (max step and acceleration).
4. **Nothing pops.** Objects enter and leave by moving out of frame, inside an effect, or with a motivated fade. Never `visible = false` on screen.
5. **Feet stay planted, hands touch what they hold.** Walking only via `walkAt`; contacts only via `handTo` / `grip` / `settle` / `brace`.
   Check: foot slide measured at 0.0000 m (`scenes/walkqa.js`), and hand close-ups in `scenes/chars.js`.
6. **Effects are soft and motivated.** Particles are soft sprites, never solid balls, and are born where the physical event happens.
   An effect must never wash out the subject.
7. **Look at consecutive frames, not just stills.** At every flagged or risky moment, 6 consecutive frames from the encoded MP4.
8. **Period-correct worlds.** A map shows only what existed at the time of the story (Tacoma 1940 has no later roads or bridges).
   Region configs list their layers, and thin modern structures in the elevation data are removed.
9. **Downloaded models are checked like our own.** Use only CC0, public domain or CC-BY. Verify the licence on the source page, and
   credit it on screen and in `src/assets/models/CREDITS.json`. Every model gets a front and a side view at full size: upright, at real
   size, with docking points found by raycast rather than bounding boxes. Restyle to clay with `model()`. Never download people:
   they are the project's `figure(role)`s.
10. **Every check must be proven to work.** Trust a check that prints nothing only after a known-bad case has made it print.
    The calibration scene is `zf.js`, for both audit and zfight.
11. **Bodies never overlap bodies.** For several people in a small space, use a cutaway with the camera outside. Plan positions so no
    two meshes can meet in any frame, and check the most crowded frame at full size.
12. **The subject is never covered.** A card or chart sits in the emptiest third of the frame for its whole time on screen, and two tags
    are never on screen at the same spot or time unless they are meant to be read together.

13. **Nothing passes through anything, ever, and it is proven by a check.** A body never passes through another body, and never
    through a solid object (furniture, walls, ceilings, consoles, rock, vehicles). Openings that bodies pass through are real holes
    in the geometry. Check: every shot with people or moving bodies declares `S.collide`, and `render.mjs collide` must print
    "clean" over the whole film. Then the frames are reviewed for readability: nobody hidden, headless, or cut.
14. **Sign-off before render.** No final render, and nothing shown, until `sh tools/signoff.sh <story> <end>` prints PASS
    and the manual frame review in [SIGNOFF.md](SIGNOFF.md) is written down.

## No slop (added 2026-10-13 from the owner's review of crime-style v1; full SOP: references/no_slop.md)

15. **Banned in every look and every style:** red stamp / plaque / verdict overlays ('FERME', 'LOCKED', 'CASE CLOSED',
    `list()` item `mark` / `markAt`: deprecated, never pass them; crimeover `stamp()` draws nothing), and any notice that the
    voice is AI ('AI-generated voice' and the like). Show a fact with real footage or a real document and a highlight instead.
16. **Visible and lit.** Three-point light + practicals per scene and the no_slop.md visibility gates on every shot's start,
    middle and end (see the Investigation section for the numbers). Nothing ships where the subject cannot be seen.
17. **People act.** Every person is the user's `figure(role)` playing a mocap clip that fits the words (walk, idle, sit,
    carry, push: references/animations.md); never frozen, hand-posed, recoloured per shot or an old rig (`cast()` / `actor()`).
18. **Hands on what they handle.** Carry, lift, hold, open, hand over: hands IK-attached to grip points (wrist within 2 cm),
    the prop parented to the hand or carry anchor, the body playing a matching clip, no clipping above 1 cm.
19. **Controlled camera.** Eased in and out, a push or dolly >= 2.5 s, angular speed <= 20 deg/s (8 in a close-up), no
    stop-start, no abrupt speed change.
20. **Readable text.** Every text settled (decode finished) and held >= 1.5 s, + 0.3 s per word beyond 5; a scramble is never
    still scrambled when its shot ends.
21. **Sound.** The voice is the user's ElevenLabs voice; no sound effects unless the user supplied them.
22. **Keep what works:** highlights on real footage and documents (depth), clean layered compositions (v1 sec 11), real period
    media full screen with its credit (v1 sec 19).

## v2.3 rules (the user's review of mona v2.2): text placement, strings, resolution
- **Text placement (TEXTPLACE).** Place tags, lower thirds, date labels and stat floaters on the SAFE grid only: lowerLeft
  (6 % from the left, baseline at 80 % of the height, above the credit line) is the default; lowerRight / upperLeft /
  upperRight are the alternatives. Leave `x` / `y` out: `at: 'auto'` (crimeover.js `safeSpot`) measures the picture under
  each anchor (edge density, luminance spread, brightness) and takes the calmest. Never over a face, the subject or the centre
  third of a real photo (declare faces with `S.textAvoid = [[x, y, w, h]]`), never over busy texture without the soft
  neutral scrim (`scrim: 'auto'` default; never a plate). Long tags split into a line + `sub`. check_layout TEXTPLACE fails
  overlaps with the subject / centre third / another text / the credit line, and anything outside 4 % margins.
- **Strings always connect (STRINGEND).** A board string runs from pin head to pin head, computed from the pins' world
  positions every frame. There is no slack / stops-short end: `B.string(item, item)`; a point end gets a visible pin
  (`B.pinAt`). check_layout STRINGEND fails any drawn string end more than 3 mm from a pin head.
- **No upscaled rasters (PIXELATED).** Never show a low-resolution raster magnified: any picture shown large (b-roll,
  photos, maps, evidence pages) may be magnified at most 1.5x at its most zoomed moment (Ken Burns included). Maps come from
  the open geodata pipeline (`region.py` / `bake_region.py` for places, `tools/bake_wide_map.py` for countries: AWS Terrain
  Tiles relief + Natural Earth borders, baked at 2x the frame), never an upscaled world image. For photos: find the
  original / a larger copy on Wikimedia Commons (same PD/CC0 licence, update CREDITS.json); if none exists, show it whole
  with `broll(key, { fit: 'print' })` (<= 1.4x over a blurred copy of itself) or reduce the zoom. check_layout PIXELATED
  fails a b-roll (or an overlay with `mag`) above 1.5x.

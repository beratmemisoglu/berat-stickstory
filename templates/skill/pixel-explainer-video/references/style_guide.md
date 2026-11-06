# Style guide - the look, and why

## Contents
1. The look in one paragraph
2. Palette and shading
3. Depth: shadows, outlines, skies, fog
4. Models: detail and character
5. Composition and camera
6. HUD typography and layout
7. Real-image cards
8. Motion language
9. Lessons learned (things that looked wrong and how they were fixed)

## 1. The look in one paragraph
Real 3D scenes rendered at 320x180 and snapped to the 16-colour Sweetie-16 palette, so everything reads
as crisp pixel art. Surfaces use fixed three-tone colour ramps per face (top / lit side / shadow side),
objects cast dithered shadows, every silhouette gets a 1-pixel dark outline, skies are dithered
two-colour gradients and distant terrain fades into the horizon colour. On top sits a 1920x1080 HUD in
smooth retro fonts (Orbitron for headings, Share Tech Mono for everything else). Real-world images
appear as framed cards on the HUD layer (true colour, not quantised). Calm cameras, clear subjects,
one idea per shot.

## 2. Palette and shading
- Palette `C` (Sweetie-16): bg #1a1c2c, plum, red, orange, yellow, lime, green, teal, navy, blue, sky,
  cyan, white, silver, slate, dark. Never introduce other colours in the 3D layer - the post shader
  snaps everything to the palette anyway, and in-between colours turn into noisy dither.
- Shading = ramps `[shadow side, lit side, top]` (see `RAMP` in engine.js; add your own as
  `[C.x, C.y, C.z]`). Light comes from upper-left-front. Pick ramps so the *top* colour isn't too bright
  over large areas: a big field of lime or yellow tops glares (the fix was grass `[C.bg, C.navy, C.teal]`
  or `[C.navy, C.teal, C.green]` for sunny scenes).
- Use `MeshBasic`/lit materials only for special cases (pixelQuad images). Lit Lambert materials +
  palette snapping dithered into grey mush - that's why everything uses `facet()`.
- Colour roles stay consistent within a video: e.g. blue = positive/data, red/orange = error/limits,
  yellow = signal/active, lime = success. Decide them in the storyboard.

## 3. Depth
- **Cast shadows** are automatic for `facet` materials. Tune per shot with `S.shadowSize`,
  `S.shadowCenter` (a Vector3), or `S.shadows = false` for flat diagram shots.
- **Outlines** are automatic (depth-edge detection). Disable with `S.outline = false` only for HUD-like
  flat compositions.
- **Skies**: `S.sky = [topColour, horizonColour]` - the dither band sits near the horizon only. Use
  outdoor skies deliberately: navy->sky for daylight, blue->cyan for tropical, plum->orange for sunset,
  bg->navy for night/studio (the default gives a faint horizon glow automatically).
- **Fog**: `S.fogNear/S.fogFar` fade to the horizon colour. Make far > the distance of the farthest
  important object or it becomes a flat cut-out (distant mountains went flat pale blue at fogFar 75;
  fixed at 115). Dithered fog is part of the look - use it to separate foreground from background.
- Add ground detail: `scatter(heightFn, {n, area})` rocks and grass tufts, trees with `tree(s, seed)`
  variants. Empty planes read as unfinished.

## 4. Models: detail and character
Build from `box()` parts with a few deliberate details rather than one big block. What made the
difference in the reference video:
- Buildings: shopfront band + awning, varied lit windows (warm + a few cyan), cornice, rooftop AC /
  water tower / antenna.
- Characters/creatures: silhouette first (horns, cape, mane, tail), then 2-3 material zones (stone vs
  fur vs glow), glowing eyes/sigils in cyan/yellow for focal points.
- Vehicles: wheels with hubcaps, lights front/back, windows band.
- Hardware: chips with pins and a die, boards with traces and moving data pulses, labels via HUD tags.
Keep models in `models.js`; tag animatable parts (`g.legL`, `g.paint = [...]`) so scenes can drive them.
Scale: a person is ~0.5 units, a building 1-3, a giant ~8.

## 5. Composition and camera
- One subject per shot, framed so it occupies the middle 60%; leave the top-left (chapter tag), top
  corners (titles/stats) and the bottom 15% (breathing room) free of important 3D detail.
- Cameras move slowly and purposefully: orbit a few degrees, dolly toward the subject when the
  narration focuses on it, rise to reveal scale, drop to "player view". Never shake. The engine adds a
  gentle 4% push-in per shot.
- Check that the camera isn't inside geometry (a car hidden behind buildings, a camera placed inside a
  building row - both happened). Keep the thing being talked about visible.
- Transitions are chosen automatically (dither, diagonal wipe, iris, pixelate, glitch for chapter
  openings); override per shot with `trans: 0-4` if a specific one tells the story better.

## 6. HUD typography and layout
- Headings: `text(..., {font: 'head', size: 8-16})` (Orbitron). Body/labels: default font (Share Tech
  Mono) size 6-7. Big numbers: `stat()`. Labels anchored to 3D: `tag()`.
- Headings "decode in" automatically when their alpha animates (scramble + rise). Text that is
  *intentionally dimmed* must pass `noKinetic: true`, or it stays scrambled (bug seen on dimmed labels).
- Coordinates are in 320x180 art pixels. Safe margins: 18 px left/right, 26 px top (below the chapter
  tag), keep text above y=165.
- One headline + at most 2-3 supporting lines on screen. Stack right-aligned info at W-18.
- Text never overlaps other text or a card; if it would, move it or time it out (`1 - ease(...)`).
- No burned-in captions (deliver SRT instead).
- Chapter openings: set `chapter: ['01', 'TITLE  ·  SUBTITLE'], chapterFirst: true` on the first shot of a
  chapter and `chapter` on the rest - the engine draws the letterbox slam and the corner tag.

## 7. Real-image cards
`card(key, x, y, w, t, {t0, t1, label, sub, align, bg})` - appear on the word that names the thing.
Box art ~44 px wide, screenshots 90-120 px, photos of people 60-85 px, logos 24-40 px (use `bg: C.white`
for logos with transparent/dark marks). Label real things ("RIDGE RACER V · 2000"), credit CC photos in
`sub` ("photo: Name, CC BY-SA 3.0"). Keep cards clear of headlines and stats; don't leave them on screen
longer than the idea they illustrate.

## 8. Motion language
- Things *build* (pop in staggered, draw on, fill up), *flow* (pulses along paths), *transform*
  (random -> sorted, ghost -> solid) - motion carries the explanation.
- Timing: key visual lands on the spoken word (`cue`), supporting text 0.2-0.5 s later, and leaves when
  the narration moves on.
- Counters count up (`easeOut`) to the spoken number; years can roll like an odometer.
- Keep effects in service of clarity. When a scene felt "boring", the fix was more detail, depth and a
  clearer metaphor - not shake, flashes or extra overlays.

## 9. Lessons learned (real failures from the reference project)
| Symptom | Cause | Fix |
|---|---|---|
| Colours slightly off / yellow looked orange | palette compared in linear space vs sRGB pixels | ColorManagement disabled in engine; keep all colours as palette hex |
| Whole shot crashes | missing ramp name in `facet('xyz')` | use existing ramps or add to `RAMP` |
| Disc showed blank back side | spin applied on wrong Euler axis | spin around the object's symmetry axis (`rotation.y` after a tilt) |
| Big glaring areas | bright top colour over large faces | darker ramp for ground planes |
| Mountains became flat pale cut-outs | fog too close | raise `fogFar` |
| Checkerboard noise on flat colours | vignette/dither pushing colours between palette entries | engine limits dither to edges; don't add gradients in 3D |
| Labels garbled permanently | kinetic scramble on intentionally dimmed text | `noKinetic: true` |
| Text overlapping text/cards | two elements timed at once | move, shrink, or time one out |
| Subject hidden | camera behind/inside geometry | raise or move camera, check frames |
| "Hard to understand" scenes | abstract cubes/tiles standing in for a concept | rebuild as a concrete diorama (a TV drawing a frame, a map with studios, a painted panorama) |
| Blank early frames of a shot | content appears only on a later cue | give every shot something to look at from its first frame |

# Scene design - from narration to shots

## Contents
1. Storyboard process
2. Shot sizing and pacing
3. Visual metaphors by concept type (recipes)
4. Recurring structures (openers, chapters, recaps, outro)
5. Reference shots worth studying

## 1. Storyboard process
1. Read `audio/script_timed.txt` twice. Mark the thesis, the sections (topic shifts, "Now let's look
   at...", named case studies) and the payoff lines.
2. Chapters: 3-6 per 10 minutes, each introduced by the engine's slam (`chapterFirst`). The intro
   (hook + premise) and the ending (synthesis + outro) are unchaptered. Short videos: under 2 min use
   0-2 chapters (only if the script has clearly separate parts); under 45 s none - the slam eats time.
3. For every phrase write: *what the viewer should understand* -> *the concrete image that shows it*.
   Prefer a physical, spatial metaphor over a text slide: a TV drawing its picture line by line for a
   frame budget; memory as a grid of cells filling by colour category; streaming as a city whose
   buildings materialise around a car; knowledge spreading as orbs travelling roads between studio
   buildings.
4. Group phrases into shots of 4-15 s; one shot = one idea. A new shot starts where the narration's
   idea changes (use the phrase start as `t0`).
5. List every named real thing -> image cards (see assets.md).
6. Save as `storyboard.md` (section, time range, shot list with metaphor + cues + cards). Build from it.

## 2. Shot sizing and pacing
- ~4-6 shots per minute is the reference density (47 shots / 11 min). Short punchy beats (a year, a
  number) can be 3-5 s; a mechanism explanation 10-20 s with several internal beats keyed by `cue`.
- Inside a long shot, change *something* every 2-4 s (a new element lands, camera moves, a label
  appears) so it never feels static - but keep the same set so it stays readable.
- Give every shot content from its first frame (transitions show the first frames).

## 3. Visual metaphors by concept type
| Concept | Recipe (all exist in examples/ps2) |
|---|---|
| A product/device introduced | hero model on `gridFloor`, slow orbit, real photo card, name headline, key spec `stat` |
| Year / "then vs now" | big year in the corner, era-typical diorama (race track vs giant in a landscape), year counter roll between them |
| A number / capacity / budget | object whose parts fill (memory cells, ring clock, bars) with the `stat` counting up to the spoken number |
| Ratio / comparison ("150x bigger") | the two quantities as physical stacks side by side (1 cube vs a wall of 150), counter to the ratio |
| Process / pipeline | stations in a row (chips, quads showing images), items flowing between them, numbered step labels appear on cue |
| Hardware internals | board model: chips with dies, traces with moving data pulses, camera dollies to each part as named, `tag` labels, real chip photo card |
| Streaming / loading / LOD | world around a moving player; near = detailed, far = ghost wireframe or simple shells; flashes when parts load/unload; top-down reveal |
| Data layout (disc, file, memory map) | top-down disc/grid with coloured blocks per category; animate random -> sorted; a read head that jumps |
| Constraint tuning (speed caps, limits) | the constrained thing in motion + an instrument (speedometer, graph) showing the cap |
| People / studios / companies | name card + photo card + logo card; for many actors: small buildings on a map connected by roads |
| Code / languages | an editor panel on the HUD with syntax-coloured lines revealed in order; highlight the key lines on cue |
| Visual effect explanations (bloom, blur, fur) | build the effect literally: stacked shell layers, image panels at each pipeline stage, ghost copies for blur |
| Frame rate / performance over time | an animated line graph panel (HUD) next to the 3D subject |
| History / diffusion of knowledge | timeline bars (hardware vs knowledge), network of nodes with travelling pulses |
| "Why" questions / thesis lines | a big two-line headline on a calm hero shot; let it breathe |

## 4. Recurring structures
- **Cold open (first 20-40 s)**: the hook as a contrast (then vs now, small vs impossible), with real
  box art; end on a title card built from 3D (e.g. the device bursting into voxels while the title
  letters drop in).
- **Premise section**: define the constraints the video is about with clear, labelled visuals - this
  is the vocabulary the rest of the video reuses (reuse colours and models later).
- **Case-study chapters**: chapter slam -> who (name/photo/logo cards) -> the problem -> the trick,
  shown mechanically -> the result (real screenshot).
- **Recap**: one pillar per case study with logo/cover cards above and a one-line summary each.
- **Outro**: the hero device exploding into parts "piece by piece", subscribe prompt, credits text
  (small, slate colour, bottom).

## 5. Reference shots worth studying (examples/ps2/scenes)
- `s2_budgets.js` 2a (CRT drawing a frame against a ring clock), 2c/2d (ratio as stacks), 2e (painted
  backdrop sliding over a wall: "they hid the limits").
- `s3_city.js` 3c (streaming around a car, ghost vs solid, rise to reveal).
- `s4_hardware.js` board(), 4c (vector units: SIMD lanes, model -> triangles, assembly panel).
- `s5_rockstar.js` 5b (sectors), 5c (disc layout random -> sorted, duplicates), 5e (8 car slots).
- `s6_naughty.js` 6a (walk to the mountain), 6b (the far mountain is a flat card), 6d (hot reload).
- `s8_ico.js` 8b (fur shells), 8c (bloom pipeline), 8f (LOD rings with painted panorama).
- `s9_end.js` 9a (recap pillars), 9b (knowledge network), 9c (timeline + memory filled to the limit).
Note these import `'../engine.js'`/`'../models.js'` exactly like your project scenes do.

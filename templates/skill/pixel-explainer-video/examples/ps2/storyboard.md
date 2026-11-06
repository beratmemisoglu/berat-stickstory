# Storyboard - "How PS2 studios hid the hardware's limits" (11:12)

Thesis: the PS2 never changed; developers learned to design around its limits.
Colour roles: blue = memory/data, yellow = signal/active, red/orange = error & limits, lime = success, cyan = VU/GPU work.

## Cold open (0:00-0:32, no chapter)
| t | narration | visual | cards |
|---|---|---|---|
| 0.0 | "At the heart of every PS2 game... same 32 MB" | fat PS2 on a grid floor, lid lifts, 32 memory cells rise out; `32 MB` stat | PS2 photo |
| 5.3 | "March 2000 ... Ridge Racer 5, a handful of cars on a closed track" | oval track, 4 cars looping, year 2000 | RR5 cover + screenshot |
| 11.4 | "Five years later... Shadow of the Colossus, 16 giants, 18,000 polygons, no loading screen" | landscape, walking colossus + rider, wireframe flash on "polygons", year rolls 2000->2005, 16 giant icons, "NOW LOADING" crossed out | SotC cover, Valus screenshot |
| 24.3 | "Nobody upgraded the hardware... the people writing the code" | PS2 with "CPU = same" checklist, then little developers pop in behind it with code snippets | |
| 29.7 | "...what they figured out" | title: PS2 bursts into voxels, THE LIMITS drops letter by letter | |

## Premise: two budgets (0:32-1:18)
- TIME: CRT drawing a frame scanline by scanline + 60-segment ring clock filling to 16.7 ms; finished frames stream out as a film strip.
- SPACE: 32 memory cells fill by category as "see / hear / touch" are spoken (blue / orange / lime).
- 4.7 GB disc vs 32 MB cube; wall of 150 cubes builds up with a ~150x counter.
- "How big a game can be" vs "what can exist right now": wall vs single cube, pulses flowing between them.
- "They didn't break the limits. They hid them.": camera flies to a wall of red limit-blocks; a painted landscape backdrop slides over it.

## Liberty City (1:18-2:08)
- GTA III: 9x7 voxel city pops up; stacked 130 MB bar (77 models / 45 textures / rest). Cards: GTA III cover, street screenshot.
- 4x memory: four memory blocks; the first fills with code/sound/cars/people/frame reservations.
- Streaming: car drives up an avenue; buildings near it solid, the rest ghost wireframes; rise to show the tiny solid bubble in a huge city; drop to street level where fog hides the edges ("without the player noticing").

## Inside the PS2 (2:08-3:30)
Board model reused across 6 shots; camera dollies to each part as it is named: EE + main core (294.9 MHz counter, real EE photo), VU0/VU1 (4 SIMD lanes, model -> lit -> triangles, assembly panel), GS (4 MB eDRAM, 48 GB/s, 2.4 billion px/s, screen layers stacking), DVD (5.5 MB/s, laser seeking = reading nothing), three pedestals = three tools.

## 01 The disc - Rockstar (3:30-5:30)
Credits (DMA -> Rockstar North logos, team photo, Obbe Vermeij/Adam Fowler name cards) over a city standing on a spinning disc; sectors map (near full detail / shells / skyline cut-outs, red thrown-out / cyan read-in flashes); disc layout random -> sorted by district, duplicates of common models, laser grabs the nearest; speedometer cap + air resistance; Portland roadblock; clipped-wing plane; 8 car slots -> traffic turns into the stolen car; San Andreas desert map with LS unloading as SF loads; GTA III loading screen.

## 02 The code - Naughty Dog (5:30-6:50)
Jak's island: walk to the mountain and climb it (Guinness card, "no levels / no load screens"); camera swings to reveal the far mountains are a flat painted card; GOAL editor panel (Lisp lines + highlighted VU assembly), Andy Gavin photo; hot reload PC -> dev kit, character on TV changes colour, "NO RESTART", 500,000 lines counter; compiler freeze clock to 15:00, Sony acquisition, language dropped.

## 03 The vector units - Traveller's Tales (6:50-7:38)
Candle-lit church interior made of particle flames and window dust (Crash cover, TT logo, in-game screenshot); diagram: main core busy computing particles -> whole system moved to VU1 (16 KB table), core freed for AI + physics; idle VU chip lights up: "+1 processor for free".

## 04 The graphics chip - Team Ico (7:38-10:00)
Hero shot (Fumito Ueda photo, breakdown list); fur shells stacking 1->6 over a stone patch, side view shows slices, edge fins; bloom pipeline as image panels (frame -> 64x64 -> stretched blur -> blended), real Mono & Wander glow screenshot; Wander 3,000 vs Colossus 18,000 polygons, hidden collision proxy; IK feet on a slope; land in three rings (painted panorama / coarse checkerboard blocks / detailed near tile); disc reads in frame gaps + memory defrag; FPS graph + motion-blur ghosts.

## Ending (10:00-11:12)
Recap pillars with logos; why five years: blank manual -> studio map with knowledge orbs; hardware bar done in 2000 vs knowledge bar growing to 2005, RR5 vs SotC covers; memory filled right up to the last cell; outro: PS2 explodes piece by piece, subscribe, credits.

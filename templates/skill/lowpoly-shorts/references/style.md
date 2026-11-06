# The style: low-poly game-capture shorts

Measured from two channels (docs/ps1-style in the app's repo): ~17 + 87 shorts, every number from analysis scripts.
It is NOT strict PS1 rendering: modern real-time light on low-poly assets, drawn at a low internal resolution and scaled up
soft, then sharpened (edge halos) and colour-fringed. Nothing is animated on twos: full 30 fps, smooth motion.

## The two looks (settings.look)
| | Bright (Low Poly Shorts) | Moody (Loaded Dice) |
|---|---|---|
| render | 320 x 568, light sharpening, little fringe | 270 x 480, heavy sharpening, ~1 px fringe, strong vignette |
| light | flat daylight: high ambient + one soft sun, few shadows, photo-ish skies | dark room, a warm key on the subject (it follows by itself), soft shadows, blue-black ambient, glowing lamps / screens / neon (bloom) |
| colour | saturated primaries, clean whites, sky blue, grass green, median brightness high | near-black interiors (>=23% of the frame), felt green, dealer red, chip blue, lamp gold |
| captions | small yellow lowercase, thin outline, 2-4 words, at 67.5% height | bold white sentence case, black outline, slight shadow, 2-5 words, at 75% height |
| cuts | ~30-33 / min, median shot 1.5 s, 28% under 1 s | ~24 / min, median 1.8 s, mean 2.4 s |
| transitions | 90% hard cuts, push wipes (mostly vertical), blinds, colour-shift time lapse | 85% hard cuts, pixel-mosaic for state changes, white flash on shocks, drop to black, split screens |
| topics / voice | weird facts, body horror, animals, dumb crimes; deadpan third person, dry punchline | one niche story (casinos, money); second person ("You run a casino"), rhetorical-question end |
| numbers | pixel-font labels, counters, red arrows, health bars, "?" boxes | money-green gains / red losses with black outline, 8-bit banners, bevelled game-UI panels, LIVE scoreboards |

Both: speech from 0.1 s, cut on the last word, one clause = one shot, the camera ALWAYS moves, captions always on top,
symbolic void sets for abstract beats, a recurring protagonist with costume and expression changes, music only when the user adds it (Project settings > Music).

## Rules
- One clause = one shot, a literal picture of the clause ("take down all the clocks" -> a man on a ladder removes a clock).
- Abstract ideas: a void set (teal / grid / purple / red / black / space) with ONE object and a label or number.
- Every shot moves: push-in by default; dutch 10-25 deg on inserts; wide-angle face close-ups (fov 70-85, Bright); POV with
  the subject in front; a fast 10-frame pull-out from an insert to the wide; top-down over tables and beds; tracking walks.
- People always act: a clip that fits the words, an expression that matches, heads turning to what matters.
- Numbers live in the scene, next to their object (callouts follow it); one callout at a time; never over a face.
- Faces: the engine's drawn faces only. Never photos of real people, never real logos or a real channel's branding.
- The brand sting (S.sting) once, at the first "you see" / turn word between 4 and 12 s, if the user wants one.
- The last shot loops back to the first (loopShot) or lands a punchline image; nothing after the last word.

## Shot recipes (duration, camera)
| shot | length | camera |
|---|---|---|
| hook: protagonist mid-event in a lit set | 1-3 s | slow push or orbit, wide-angle medium-close |
| literal clause (one verb acted by a clip) | 0.6-2 s | push or drift, often dutch 15 deg |
| face punch (expression swap) | 0.5-1.5 s | `face` (fov 72-85 Bright) |
| POV hands / prop thrust at the lens | 0.8-2 s | `pov`, G_Thrust_Prop_Loop |
| insert of a prop / screen / document | 0.5-2 s | `insert` (macro, dutch) |
| top-down over a table / bed | 2-5 s | `topdown` |
| tracking walk | 2-4 s | `track` or `follow` |
| void explainer (organ, atom, number) | 1.5-5 s | `orbit` / push, pixel label pops |
| number / UI reveal | 1-3 s | static-ish push, callout or panel pops |
| split comparison | 1-4 s | split: 'h' or 'diag', each pane its own push |
| fast pull-out reveal | a 0.3 s move inside a 1-3 s shot | `pull` |
| mass scale (crowd, heap) | 1.5-4 s | `high` pull-back, counter ticks |
| fall / ragdoll gag | 0.7-1.5 s | wide, static-ish, Hit_Knockback / KK_Fall_Death_* |
| colour-shift time lapse | 2-6 s | static, S.grade animates |
| punchline / loop | 1-3 s | loopShot() |

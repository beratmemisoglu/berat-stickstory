# The style: 3D toon shorts (the look rules every scene follows)

Vertical explainer shorts: original round-headed cartoon characters act out a narration spoken to "you" in dense, warmly
lit 3D sets. Soft toon shading, dark warm ink outlines, bloom on every lamp, depth of field in close-ups. The camera
never stops, scenes melt into each other, and every fact is a prop in the world. These rules come from a
frame-by-frame study of reference shorts; the exact calls are in engine_api.md, the motion presets in motion.md.

Everything you make is original: never copy a character, set, sign, logo or joke from a known show, channel, game or
brand. Invent brand names.

## 1. Format and the caption band

- 1080x1920, 30 fps, rendered on ones (every frame moves something: the camera at least).
- Captions are drawn by the engine: 1-2 white words centred at **70.5 % of the height**. Their band is **66-76 % of
  the height** (between 20 % and 80 % of the width). **No face, no eyes, no key prop in that band, ever.** Torsos,
  tables, floors and backgrounds may pass behind it.
- Safe placement of a face: eyes at 25-45 % of the height in CU / MCU / MS; in a wide the whole character can stand
  below the band only if the face stays readable (rare: prefer framing the character high).

## 2. Characters

- Units are metres. A grown-up is ~1.67 m to the top of the head; the head is a sphere ~0.49 m across (3.4 heads tall).
  A chair seat is 0.45 m. Characters face +z, the floor is y = 0.
- Body: sphere head, bean torso (no neck), thin stick limbs (~0.035 head diameters thick), ball hands, tiny feet.
  Identity comes from clothes, a hair cap or hat and ONE accessory, never from a new body shape.
- Faces are painted on the head and turn with it (never billboards). They change by swapping, never by morphing; they
  never lip-sync the narration. Use the face set that fits each line (deadpan for dry lines, rings for surprise,
  chevrons for pain); the engine handles blinks and the closed-eye frame between faces.
- Holds are dead still: no breathing, no swaying. Life comes from the camera, the face, lights and particles.
- Objects can be characters (a pill, a coin, a device on a wall): same face system, same thin limbs.
- The hero is "you": the narrated character. Give them one strong clothing colour that contrasts with the set.

## 3. Framings (use the engine's named framings)

| framing | use it for | notes |
|---|---|---|
| ecu | the key prop or a single feature (an eye, a display, a pen nib), the hook, a zoom-through | background fully melted |
| cu | a reaction face, a gag landing | eyes at ~35-40 % height |
| mcu | the default for a character delivering a beat | head + chest, eyes at ~30-40 % |
| ms | actions with the hands (reach, press, hold), two-shots | full torso, props in hand visible |
| mws / ws | walks, arrivals, sets being shown, group scenes | the set dressing must fill the frame |
| ews / aerial | "where": a town, an island, a building; reveals | haze on far layers, tiny life (cars, birds) |
| top-down | tables, boards, maps, circles of people | straight down or 70-80° |
| pov | "you see ...": the hero's own hands at the bottom of the frame | eyelids or a blur for sleep / losing sight |

Lens: ~45° vertical for character shots; ~60° (wide) for corridors, low-angle exteriors, arrivals and aerials; ~22°
(tele) for a two-shot framed over a blurred foreground object. Camera heights: knee height for arrivals and walk-ins,
head height inside, a 30-40° high angle for overviews, top-down for tables. Roll 0° (4-5° only on a fast action pass).
Never shake.

## 4. Light per mood (engine rigs)

| mood / place | rig | practicals and colour |
|---|---|---|
| ordinary indoor, office, kitchen | `interior` | warm window key, blinds casting stripes across characters, a lamp or pendant glowing |
| stressed home at night | `interior` cooled | cool blue-grey ambient + one warm pendant |
| sunny outside | `day` | soft sun, long soft shadows (one direction per scene), saturated sky, round clouds |
| evening | `sunset` | the whole frame salmon / orange-pink, string lights |
| night outside | `night` | blue moonlight, a bright band on water, stars |
| city at night, arcades, bars | `neon` | blue ambient, magenta + cyan signs, warm spill from doors and windows, wet ground reflecting every light |
| one lamp in a dark room | `bulb` | a single warm bulb on a cord with a visible cone and a pool on the floor; strong vignette; let it swing |
| danger / alarm beat | `alarm` | red wash IN on the trigger word (3-6 frames), out on the release word |
| under water | `underwater` | teal, caustic lines over everything, rising bubbles |
| space, HUD and diagram inserts | `space` / dark | navy with glows |

- Every set has **at least 2 practical lights** (lamps, screens, signs, windows) and they bloom.
- The character is lit by the scene: cream by day, lavender at night, orange by a fire. Don't light the hero separately.
- Light changes are story beats: an alarm turns the world red on its word; relief brings it back; sinking deeper cools
  the key over ~1 s; a day passing slides sunset -> night over ~0.6 s.

## 5. Dressing density

- **At least 12 distinct props in an interior**, each one saying something about the story (a stressed person's desk:
  bills, a mug, pills, a phone lighting up). Exteriors: a dressed midground plus a far layer (skyline, tree line, sea).
- **Three depth layers** in every shot from MS out: a foreground element close to the lens (blurred: a post, crates, a
  plant, the top of a machine), the character plane, a soft background.
- **One ticking element** per set: something always alive (a counter creeping up, a lamp swinging, a screen
  scrolling, clouds drifting, a fan turning).
- **At least one joke sign** per short: original, deadpan, ≤ 4 words, legible, placed where the camera lingers.
- A sparse room is allowed only when one light does all the work (`bulb`, strong vignette, a bold patterned floor).
- No empty floor or bare wall filling more than a third of the frame.
- Props stand on things: on the floor, on a table, hung on a wall. Nothing floats unless it flies on purpose.

## 6. Shapes, colours, surfaces

- Everything rounded and chunky (bevels, capsules, rounded boxes), smooth (no faceting), slightly exaggerated. Nothing
  razor-thin or realistically detailed.
- Saturated but not neon. Two or three tones per object (main, a darker shade, an accent). One complementary accent per
  set (a teal shirt in a red-and-gold room).
- Surfaces are stylised: wood grain, patterned carpets with a border, terrazzo with chips, noisy sand, painted labels.
  No photos as textures.
- Emissive only for real light sources (screens, lamps, neon, LEDs, fire), so bloom picks them up.

## 7. Outlines

- Every solid object has a dark warm ink outline (#2a1d17, never pure black). Characters: ~3 % of the head diameter,
  never under ~4 px or over ~14 px at 1080 wide. Sets and props: 2-4 px at 1080 (0.6-1 % of the object's size).
  Tiny detail meshes: none.
- Face features and stick limbs are drawn in the outline colour.

## 8. Depth of field

- CU / MCU: focus on the eyes, the background melts into bokeh (blur ~1-1.5 % of the frame width).
- Anything within ~1 m of the lens is heavily blurred: use it as a foreground frame.
- Wides: little blur; soften only the bottom ~12 % of near ground (a miniature feel).
- Corridors and journey shots: sharp front to back.
- Rack focus (2-5 frames) to pass attention from a face to an object, or to morph one graphic into another.

## 9. Information lives in the world

- Numbers, names, rules, times and places are **props**: a counter on a sign, buttons that light up, a chart made of
  stacked real objects, a printed strip, a road sign, a poster, a ledger, a display. Every spoken number changes
  something on screen ON its word.
- A screen-style view (satellite map with a YOU marker, x-ray monitor, thermal camera) is allowed as its **own
  full-frame insert shot**: the picture IS that screen. Never paste HUD panels over a character shot.
- At most one 2D label with a leader line per short, for the big reveal. Labels inside the world fade in over 3-6 frames.

## 10. Effects (use them to make actions read)

- Dust motes drifting in interiors; 4-point glints on metal and coins (3-5 frames); sparkles on a picked-up prop
  (~10 frames).
- Impacts: a short star flash plus thin sound arcs rising from the contact; splashes are rings + a jet + flying drops.
- Fast falls and tumbles: 2-3 smear ghosts behind the object. Spinning flips: a ghost trail.
- Weather where the story needs it: slanted rain with splashes, a 3-frame lightning flash, fire that grows from sparks,
  dark smoke drifting over faces, steam puffs from an overheated head.
- Sweat drops, blush, tears, anger marks, steam belong to the face (see the face sets).

## 11. Never

- A static camera (beyond the short stops the storyboard plans).
- A face behind the captions, a back-of-head close-up the shot is not about, a face too small to read its expression.
- Breathing or idle swaying; squash and stretch on bodies or heads (one exception: a jolt's 2-3 frame torso stretch).
- Morphing between expressions, lip-sync to the narrator.
- Plain hard cuts between unrelated shots (see storyboard.md for the five allowed cases).
- 2D overlays, arrows or panels over character shots; real logos, real brands, real people's faces.
- Grain or colour fringing you can see at phone size.

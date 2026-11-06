# The look

Measured on the three references (experiments/stickstory-style/analysis: sets, characters, camera, hands, graphics, fx
NOTES.md). The engine does most of it; this file is what you check a frame against and what your own additions must match.

## 1. The frame

- 1920 x 1080 with **black letterbox bars: the picture is 2.0:1** (60 px bars). Every reference frame is letterboxed,
  graphics and end cards included. Framings (§2) are measured against the PICTURE, not the full frame.
- **Scope mode 2.33:1** (128 px bars, eased in 4 frames, out 5): action, the gadget montage, "the genius sees it"
  stretches; 0-12 stretches of 1-7 s a video (one reference used it for 6.5 % of its runtime, another never). Start it on
  a cut or together with a grade change (`S.freeze` + `S.scope`).
- 9:16 projects (`settings.format: 'vertical'`) have no bars; keep faces and text in the centre column.
- Two looks (Project settings): **Story** (the studied look: depth of field, warm practical glows, film grain, vignette) and
  **Clean** (less blur, no grain).

## 2. Framings by head size (heads.py over every reference shot)

| framing | head diameter / picture height | head top | where |
|---|---|---|---|
| `ecu` | 0.8-0.85 (eyes ~0.45) | | centred |
| `cu` | **0.37** (0.35-0.43) | 0.26 | centred: x 0.42-0.58 (63 of 67 close-ups); eyes just above the middle; the chest cut by the bottom bar |
| `ms` | 0.21 (0.17-0.29) | 0.31 | |
| wide (`ws`, `P.cam.wide`) | 0.10 (0.07-0.14) | 0.43 | head centres near the horizontal middle, spread over the width |

- Close-ups are CENTRED, not on the thirds. The head is drawn 1.3x in close-ups (`ecu cu mcu`), sunk into the collar: the
  references' close-up proportion (automatic).
- Two-shot: heads at x 0.41 and 0.60 of the width (gap 0.18-0.22), the same height and size, facing each other in
  profile / 3/4, the pair centred. Staggered two-shot: the far one at x 0.28, the near one at 0.79 and 1.3-1.5x bigger.
- In a room wide a standing figure's feet are at ~82 % of the frame (just in front of the floor line at ~73 %); figures
  are 0.25-0.56 of the picture height.
- Over the shoulder: a blurred dark head bottom-left (diameter 0.4-0.6 of the picture height) at z +1.5 .. +3.
- No Dutch angles (roll 0, ever); slanted objects (badges, papers, a phone) carry the dynamism.

## 3. Sets: two families

**Room** (iq500 + sister, ~70 % of story shots): frontal box rooms seen from about neck height, the back wall filling the
frame, a ceiling band on top (14-25 % of the picture), the floor line at ~70 %, a plank floor fanning toward a vanishing
point far above the frame, thin side walls at the edges, 10-25 small props per room, muted desaturated palettes (mean
saturation 24-29 %), a strong radial vignette, motivated light (lamp glows, window shafts, monitor bloom), and the SAME set
recoloured by time of day. No black outlines on props: edges are darker tints of the object colour. No contact shadows
indoors (exteriors have soft ellipses under the feet).

**Stage** (timeloop): flat side-on rooms, no ceiling, no side walls, one dominant hue per set (orange nap room, blue
study), a wainscot band, a flat floor band with an elliptical sheen under the action, furniture as near-black silhouettes
or with dark outlines, spotlight cones, floating dust motes, saturation ~44 %. Background people are pawn silhouettes.

- A story uses 3-4 "home" places for about half its story time (each recoloured by mood) plus 20-35 one-shot places
  (1-3 s montage beats). The same place must look the same in every shot (models.js).
- Depth layers back to front: the view through windows -> the back wall -> wall-hung items -> furniture against the wall
  -> mid floor (table, sofa) -> the people (z = 0) -> an optional foreground occluder (a table edge, a chair back,
  blurred). A close-up shows the SAME room behind, blurred, often with a sharp foreground strip at the bottom.
- Moods of one set (catalog.md §1): day (warm, wall bright, cool sky in the window) -> dusk (x0.7, practical lamps on,
  violet -> peach window) -> night (x0.35, grey-violet / blue, all colour from practicals: a lit doorway, a monitor, a
  lamp, the moon) -> candle (x0.2, one warm pool). `memory` = the grey-blue flashback; `alarm` = red; `violet` = action.

## 4. People

- Body: flat black **#0b080e**, a perfect-circle head, straight capsule limbs 0.25 heads thick, 5.35 heads tall; no
  outline on the body; far limbs a lighter purple-black.
- **Rim light**: the whole silhouette repeated behind the character in the set's rim colour, shifted ~0.06 heads toward
  the key light (crisp). One rim colour per place and mood (warm #f8ba74 lamps, night blue #8dc6f2, white #dfe6f5 ...):
  the place sets it; don't override it without a light that motivates it.
- Face features cream **#fdefdb** (no outline): eyes, brows, mouth, extras (tears, under-eye arcs, sweat, sparkle).
- Clothes: a flat fill + a shade tone on the side away from the light + a thin darker outline; long garments get fold
  stripes. **Identity rule**: one saturated signature colour on the top + at most 1-2 accessories (glasses, a hair clip, a
  scarf, a cap); the hero's colour (the blue hoodie) never changes.
- Extras: faceless silhouettes in one dark tint (#2a263c day, #332430 warm, #6d6a74 grey memory, #1d1a2a night).
- Kids are small (`kid`, `small`), teens 0.9x; the elder look is the adult body with the props (hat, glasses, moustache,
  coat).

## 5. Hands by shot size

- Wides and mediums: a black **nub** at the end of the arm (no fingers), drawn over what it grips. Even a sip in a medium
  close-up stays a nub.
- Hand inserts and the phone at the ear in a close-up: the **finger glove** (`RIG.Hand`, style 'glove'; the storybook
  look: style 'flat', a black mitten). Fingers wrap the prop. Build every insert with `S.hand` (engine_api.md §13): it
  frames the hand / prop at the references' size (~55-60 % of the picture).
- Layering: the hand over the gripped part of a prop; a prop shown TO the camera (phone screen out) over the hand; in a
  hand-off receiver > object > giver; in a hug the hugging arm crosses in front of the hugged body; a far arm behind the
  torso.
- Contact is exact (0 gap); a gesture toward a person stops 0.3 heads short.

## 6. Light, post, effects

- Practical lights glow (additive radial gradients: lamps, candles, monitors, bulbs, EXIT signs); window shafts are 2-3
  parallel soft bands. Glows never flicker unless the thing blinks.
- **Grain**: mono, per pixel, new every frame (sd ~2.5/255). **Vignette**: corners ~30-40 % darker, always on.
- **Depth of field**: wides and mediums sharp; close-ups blur the background (sigma ~11 px at 1080) and foreground pieces
  (~10 px); it grows by itself with the shot size. No rack focus in the references.
- **No** lens flares, chromatic aberration, RGB glitch, VHS lines, motion blur or camera shake. An impact is a 2-3 frame
  white lift + particles; "magic" is a warm glow + a few rising specks.
- Effects are flat shapes (straight rain streaks, flat glass triangles, round smoke puffs) and short (bursts 6-15 frames,
  flashes 2-3).

## 7. Graphics and text

- One font family: **Open Sans ExtraBold caps** for everything (pills, labels, counters, titles), JetBrains Mono for
  terminals and CCTV, Kalam for handwriting. Wide tracking on small labels.
- Pills: a dark capsule (#181418 90 %), a thin themed border, cream caps; gold = fact, red = danger, green = success, blue
  = gadget, violet = prediction, amber fill = the chosen option.
- Corner HUD: cream caps with a soft dark halo (the lives counter bottom-right), the chapter label top-left (cream caps,
  dark brown outline, optional gold second line), + / - icons in the top corners. One element per corner.
- Entrances: a pop (opacity .35 -> 1, scale 1.08 -> 1 over 3 frames), a fade (4 frames) for labels and titles, list items
  5 frames, lines and routes drawing on in 8-12 frames, counts easing to their value. An element tied to a word starts
  0-3 frames before the word; exits are hard cuts.
- Full-frame graphics are cut in like any shot; their motion is inside them (elements fading in, a count, a tour).
- Text is held >= 1.5 s after it settles; never over a face; spelled right; every name and brand invented.

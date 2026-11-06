# The quality bar: what is checked, the numbers, the rule for keeping a change

The bar is the owner's own short, measured frame by frame, and the night-2 shorts he called marvellous. A shot is done
only when it passes every gate below. The machine checks find what can be measured; looking finds the rest. Night 1
passed every metric with a white board through the boss's head, a spear across a face and a close-up held on an empty
frog for 2 s: metrics AND looking, always.

## 0. The gates, in order (per shot)

1. **Build**: the file renders headless with no `Traceback` and none of `CZ PROP FAILED`, `CZ PLACEHOLDER`,
   `CZ DRESS FAILED`, `CZ FACES MISSING`, `CZ POSTER MISSING`, `Shadow buffer full`. Syntax first:
   `<python> -m py_compile s03.py sets.py cast.py` after every edit (a sed that appended a comment inside a call broke
   every shot of a film for a round, four times in one night).
2. **Contact**: `CZ CLIPCHECK clean`, or every remaining sample explained (a gag marked `cz_contact_ok`, a quilt over
   the legs) in your summary. No `CZ SIT ... sitting on air`, no `CZ SITCHECK`.
3. **Stills**: every framing at its landing frame and at its key words. LOOK at every one (§1).
4. **Motion**: 4-6 consecutive frames at every walk, gesture, sit, stand, hold, release, take and flight; mid-flight
   frames read (no smear, no euler-flip spin, nothing passing through the lens).
5. **Timing**: each framing lands 0-3 f before its word and holds through it; faces change ON the word; gestures land
   ~3-5 f before the stressed word; quoted lines lip-synced.
6. **Transitions**: every shot boundary of the ASSEMBLED film stepped through frame by frame (a dissolve or a match cut
   is invisible on a sheet that steps 6 frames).
7. **Film numbers**: camera grammar (camera.md §3) and the picture numbers (§3 below).
8. Watch it once at full speed.
Fix, then look again at ONLY what changed. Two failed fixes of the same thing: note it in PLAN.md and move on.

## 1. The rubric (the adversarial critic's; every still, 0-10 per axis)

Pass = every axis >= 8 AND zero defects.

| axis | what was checked |
|---|---|
| 1 composition | subject place + size, lens, camera height; subject on a third, whole head + ~10 % headroom; the beat (the thing the words name) visible in the frame |
| 2 character fidelity | faces in the style (soft grey features, lidded rest eyes, rings for shock, big rounded mouths), never dead frontal (15-20 deg yaw + tilt), proportions, costume detail (collars, tags, badges, buttons) |
| 3 acting | a readable pose, the expression on the word, overshoot and settle, hands doing something meaningful, weight; gags that need hands staged as big readable shapes |
| 4 light | a motivated key with a SHAPE (pools, stripes, panes), a complementary coloured fill, rims that separate characters from the set, practicals glowing, light falling off in depth; heads stay near-white in every light |
| 5 colour | the scene's own colour script, saturated and unique, no muddy greys, value contrast |
| 6 materials + detail | every surface on camera painted, props chunky with bevels, dressing as dense as the target (with an enriched target: does ours carry every extra it shows, listed by name) |
| 7 depth | a foreground element, a mid ground, a background; DOF on close shots; atmospheric falloff |
| 8 defects | any one = FAIL (§2) |
| 9 verdict | "would this frame pass as a $100M production?" in one line |

How hard it is: on night 2 the critics scored Bell 4.6 -> 5.9 and Tickets 3.5 -> 6.0 over six rounds; not one framing
reached 8 on every axis (the best axis anywhere was 7). The scale is deliberately harsh: use it to RANK the fixes
(the top 3 per round moved the mean ~0.3-0.5), not as a reason to stop.

## 2. Defects (each one fails the frame; all were found in real rounds)

- The camera inside or behind geometry: inside a head (the whole frame orange), behind a cabinet, blocked mid-flight by
  a house front, ending inside an open door leaf.
- A beat spoken during a flight (the line plays over a blurred move), or the beat not staged at all (the finger the
  string is tied to never in frame; a "thumbs-up" that is a ball on a stick; a shrug that is one hand on a head).
- The subject cut by the frame edge (a face cut through the eye, a walker who leaves the frame); a sign cut by the edge.
- Bodies through seats, floating sitters, legs in chair legs, arms in counter tops, characters parked inside walls
  before their cue, a body inside a door leaf, bills sunk into a body.
- Characters hidden behind a monitor, a register, another head; the back of a head in a close shot.
- A crashed dressing file (`CZ DRESS FAILED`) that leaves a set bare; a magenta placeholder; a missing texture.
- A blown practical (a pure-white flat globe with an ink outline cut by the frame top).
- Things that read as something else at phone size: a pipe as a ladder, a coffin as a drawer, a wink as an eye patch,
  thick glasses as sunglasses, a lap drape as a barrel, an insert arm as a lollipop.
- The same framing repeated (one bell close-up four times).
- Text that is wrong: misspelt, mirrored, the wrong language for the story (a Japanese marker on a box in an American
  office).

## 3. The numbers

### Camera grammar (per film; camera.md)
| metric | reference | margin | Japan (pass) | Jar (pass) |
|---|---|---|---|---|
| framings per 10 s | 4.50 | +-30 % | 5.80 | 5.70 |
| median hold | 21.5 f | +-35 % | 27 f | 26 f |
| median flight | 13 f | +-35 % | 12 f | 11 f |
| flight speed peak (0-1 through the flight) | 0.50 | +-0.15 | 0.50 | 0.44 |
| creep in holds | 0.19 %/f | +-60 % | 0.08 %/f | 0.17 %/f |

### Picture (per film, graded, 360 px wide analysis)
| metric | reference mean | margin | Japan | Jar |
|---|---|---|---|---|
| luminance | 131 | 15 % | 118 | 115 |
| saturation (HSV) | 113 | 20 % | 100 | 116 |
| contrast (grey std) | 55 | 20 % | 54 | 47 |
| sharpness (Laplacian variance) | 1546 | 50 % | 896 | 1330 |
The reference's per-shot ranges: luminance 66-162 (mostly 100-150), saturation 77-165 (warm interiors ~100-120, neon
and dream parts ~160), contrast 31-75, sharpness ~600-2600. Its NIGHTS are bright and saturated (interiors ~92
luminance, saturation 148-181), never realistic. Raw renders measure low on saturation and sharpness: the grade is part
of the style (§5). Measure with `<python> <engine>/tools/gradeprobe.py <frames_dir> --step 20 --try ...` (it prints
these four numbers against the reference's means; a near-neutral try `"sat=1.0,lift=0.5,sharpen=0,bloom=0"` shows the
raw state).

### Detail
Detail parity in the lab (edges x background edges x sharpness against reference frames of the same shot size,
geometric mean) had to reach >= 1.0 per set; what got bare rooms there: painted surfaces with wear, trims, fixtures,
signage, then props, then ONE foreground object. In the app judge axis 6 by name against the plan's dressing list or
the enriched target: no flat untextured area bigger than a sheet of paper on camera, every shelf full.

### Contact
`CZ CLIPCHECK clean` on every shot of the final render.

## 4. The measured-quality rule

- **Keep a change only if it measurably improves the thing it was made for.** The rebuild's targeted pass scored every
  candidate camera with a likeness measure and kept only higher scores (a monitor moved 0.12 m scored 0.4226 vs 0.4228:
  not kept). Four alternative framings of one shot all scored lower: the original stayed.
- **A/B every "improvement" with a pixel diff before believing it.** EEVEE GI was pixel-identical on these
  emission-ended shaders (mean diff 0.0); 48 -> 24 samples was indistinguishable (PSNR 44-48 dB) and saved 16-28 %, not
  50 %; light-power changes vanish under the toon lift (`light ** 0.62`): darker base colours and a stronger key move
  the mood, fills don't.
- **Measure the input before tuning the output** (the ramp probe, engine_api.md §11: a guessed 0.35..0.8 ramp came out
  flat brown; the stripes sat at 2.0 and the sun at 3+).
- **A check that finds nothing must say so**: "floats 49 cm" was a ray that ran out of steps, not a measurement. When
  your own check cannot measure, report "could not measure".
- **Freeze, then let measured fixes in**: past a freeze only changes that move a measured number toward the target.
- **Metrics pass while pictures fail**: a gain of 1.15 hit luminance 132 / saturation 112.5 exactly and washed a bronze
  jar to cream. Look at the graded samples.
- Settle the grade first, then the holds (the grade changes the pixel differences the hold measure uses).

## 5. The grade (per film, never copied from another film)

Probe on every 20th frame, compare, LOOK at the graded samples, pick, write the choice into PLAN.md:
```
<python> <engine>/tools/gradeprobe.py shots/s04 --step 20 --try "sat=1.2" "sat=1.0,gain=1.15" "sat=1.0,bloom=0.3,curve=0/0 0.15/0.27 0.5/0.68 0.85/0.91 1/1"
```
- Defaults of the finish: bloom 0.5, midtone lift 0.575, saturation 1.2, unsharp 0.9, vignette, grain 5.
- What the films took: Japan sat 1.2 (lum 118, sat 100); Jar `--sat 1.0 --bloom 0.3 --curve "0/0 0.15/0.27 0.5/0.68
  0.85/0.91 1/1"` (lum 115, sat 116, con 47): a red lacquer hall and violet nights are saturated AND darker, Japan's
  grade on them measured lum 99 / sat 157.
- A gain (multiply) brightens without flattening contrast but washes colours out; brightening with clipping lowers HSV
  saturation; a tone curve that lifts darks + mids and rolls off before white keeps the colour.

## 6. Looking: sheets and stills

- `render_frames` (the app's Look stills, 16 samples) for the moments you changed: framings at their landing and at
  their words, 2-6 times per call; every image stays in the conversation and the run has a frame budget.
- For many frames at once, one contact sheet costs one image: render the frames with run.py into `renders/review/...`,
  then tile them (a helper you write once, run with `<python>`):
  ```python
  # renders/sheet.py <frames_dir> <out.jpg> [step] [cols]: one labelled sheet of every step-th PNG
  import os, sys
  from PIL import Image, ImageDraw
  d, out = sys.argv[1], sys.argv[2]; step = int(sys.argv[3]) if len(sys.argv) > 3 else 1; cols = int(sys.argv[4]) if len(sys.argv) > 4 else 6
  fs = sorted(f for f in os.listdir(d) if f.endswith('.png'))[::step]
  w = 270; ims = []
  for f in fs:
      im = Image.open(os.path.join(d, f)).convert('RGB'); im = im.resize((w, int(im.height * w / im.width)))
      ImageDraw.Draw(im).text((6, 6), f[:-4], fill=(255, 255, 0)); ims.append(im)
  rows = (len(ims) + cols - 1) // cols; h = ims[0].height
  sheet = Image.new('RGB', (cols * w, rows * h), (20, 20, 20))
  for i, im in enumerate(ims): sheet.paste(im, ((i % cols) * w, (i // cols) * h))
  sheet.save(out, quality=88); print('SHEET', out, len(ims))
  ```
- The final review: a sheet every 15 frames of the whole film, every tile looked at, suspicious tiles opened at full
  size (a contact sheet every 0.5 s caught the board through the head; flight blur hid it at 15 f).
- Contacts never show on a face-and-framing look: read the CZ lines first, then look at feet, seats, hands and props.

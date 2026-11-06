# Pitfalls (each one happened while building this style)

## No pictures, no video (members got poor videos this way)
If `make_image` says image generation is not working (no Higgsfield / Fal.ai key, no connection, key rejected, no credits),
STOP making images. Never stand in hand-drawn shapes, emoji, coloured boxes or big text for the cut-outs: that is
exactly what made members' first Vox videos look poor. Finish only what needs no new image, then tell the user plainly
that the pictures could not be made, why, and how to fix it (Settings > Image generation, or credits on that account).

## The user's corrections (first review of the test video)
1. **Hover/select must hit the element, not the panel.** Every element carries its own selection key; if you build
   something by hand (a raw THREE object), give it `userData._st` and a `name`, or the click selects the whole panel.
2. **Precision.** The quill was drawn next to the writing, not on it. The pen now finds its own nib (the furthest
   down-left opaque pixel; override with `penTip: [u, v]`) and rides the measured centre of the ink column being
   revealed. Never place a pen, circle or underline by eye: use `script(... pen)`, `mark({ around, word })`, `wordBox()`.
3. **Know what is over what.** A red circle was drawn over the quill. Marks come after the pen has lifted (start them
   at `script.at + script.dur + .5`); the pen is the top layer only while writing. Layers: see style_guide.md.
4. **No section cards.** "I. BEFORE THE PRESS" kickers were slop; panels have no titles on them.
5. **The camera needs velocity.** Snappy eased moves felt rushed. Transitions are now erf ramps (continuous speed,
   slow in, slow out, 99% of the move within its duration): whip .85 s, move 1.6 s, finale 2.6 s. Don't shorten them.
6. **Plan and verify every frame.** Things were half outside the frame during and after moves. Write the frame box as
   a comment above each shot, keep every element fully in or out, run `check_layout` until clean, then look.
7. **Nothing slaps on.** Tilted red stamps popping in big (868) are an AI-slop motion pattern. Red stamp plaques and
   verdict words are now banned outright (every style); a date inks in unboxed and level; headlines print in; tape is laid down.
8. **Marks over things.** A red underline ran across the captions and the screw press. A mark crosses only its target.
9. **Visibility.** "BY 1500" in red on a sepia map was invisible. `check_layout` measures contrast on the rendered
   frame; on busy grounds use `backing: true`. If something doesn't need to be there, remove it.
10. **Overlaps at the edges.** Two caption strips overlapped at the bottom-left of the mass-print panel. Give every
   caption its own row; check the whole panel at the full framing, not just the close one.

## Images
- **A style reference leaks its subject.** Using the first cut-out (a monk) as `ref` put the monk into five other
  images. The shared `imageStyle` alone keeps the look consistent. Don't use `ref`.
- **No Higgsfield model returns transparency (tested).** The tool asks for a flat white background and removes it
  locally (free, real alpha). One subject, on white, with margin.
- **Enclosed gaps** (inside a gear) are removed only when flat pure white. Remake a bad cut-out with "isolated on pure white".
- **Text in images** can't be edited and ruins the look. Maps: "no labels, no names, no writing".
- **Budget.** About $0.013 an image; 15-25 for a minute; same name + prompt is free.

## Layout and camera
- **Frame 0 shows the hero** (`at <= 0`); it's also the loop's last frame.
- **A zoomed shot must stay inside its panel**: x within +-(8 - 8/zoom), y within +-(4.5 - 4.5/zoom).
- **Drift shrinks the frame** over the shot (zoom x (1 + drift)); elements near the edge need more air, or drift 0.
- **Pins over cards**: dots default to layer 3; on a map with cards give dots `layer: 1` and keep cards off the land
  that has pins.
- **Anchor labels** (`anchor: 'left' | 'right'`) when they start or end at a known x.
- **Order slots** so consecutive chapters are neighbours (the second row can run right to left).

## Timing
- Transitions are centred on the shot's `at`: put the incoming panel's hero at `at - .5` or earlier.
- Transcripts mishear words ("Rotary" -> "Tree"): `cue()` needs the word as it is in audio/timeline.json.
- The loop push starts `loopDur` before the end and lands 0.12 s early; panel 1's later elements lift off during it.

## Checking the loop
- Film grain changes every frame (two consecutive frames score ~0.89 SSIM): compare first and last frame with a
  small blur (gblur sigma 2); 0.98+ is a clean loop.

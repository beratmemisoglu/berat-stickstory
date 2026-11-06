# {{NAME}} - analysis of the references

Written in the study stage (docs/METHOD.md stage 1) from what you measured with ffmpeg and what you saw in the frames.
Measured values only: hex colours, seconds, shares of time, px at 1920 wide (1080 wide for 9:16), LUFS. Replace every
"_(to fill)_"; write "none in the references" where a section truly has nothing, and "skipped: <why>" where a number
could not be measured. The member's reference files never leave the kit: only this file goes into the package.

## Sources
Each reference: file name (not its path on the member's computer), what it is, duration and size, which seconds you used.
_(to fill)_

## Source setup (only when converting an existing setup: docs/CONVERT.md)
The old setup's tools, and its look as found in its code (palette, fonts and licences, layout constants, easing curves,
transitions, characters, picture sources, caption style, sound), each with the file it came from.
_(to fill, or "not a conversion")_

## Shot types and share of time
Each kind of shot (title card, diagram, close-up, map, character moment ...) with its share of the running time and its
median length in seconds.
_(to fill)_

## Pacing
Shots, cuts per minute, shot length median / p10 / p90 in s, words per minute, pauses (count, median s), the share of cuts
within 0.15 s of a word start and its chance value. Say which cuts were soft (dissolves, whips) and how long they last.
_(to fill)_

## Palette
Background, ink, 1-3 accents, each as hex with where it is used and its share of the frame. Contrast of text on its
background (as a ratio).
_(to fill)_

## Type
Typefaces (or the nearest free OFL family), weights, sizes in px, case, letter spacing, line length, where text sits.
_(to fill)_

## Lighting and finish
2D: flat or shaded, shadow style, grain, vignette, texture. 3D: key / fill / rim, contrast, fog, grade. Mean light and the
share of dark pixels.
_(to fill)_

## Motion and camera
How things enter and leave (curve, duration in s, overshoot), holds, camera moves (kind, speed, duration in s),
transitions between shots (kind, duration).
_(to fill)_

## Sound
Loudness (integrated LUFS, range LU, true peak dBFS), voice / music / effects, pauses and what fills them.
_(to fill)_

## Narration trigger -> visual
Rules like "a number is said -> it counts up on screen within 0.2 s". At least five.
_(to fill)_

## What to avoid
What the references never do, and the docs/NO_SLOP.md items that apply.
_(to fill)_

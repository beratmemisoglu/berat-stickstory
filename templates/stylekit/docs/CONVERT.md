# Converting an existing setup onto a kit base

Many members already make videos with their own Claude Code setup: a HyperFrames or Remotion project, a Three.js page, a
Python + ffmpeg pipeline, After Effects templates, "a template folder and a build folder". This is how that look comes
into Toon Studio. The short version: **the look comes over, the code does not.** Toon Studio renders every style on its own
engines (the bases), so the old setup is measured and rebuilt on the closest base, then finished with the normal method.

Be honest with the member from the start about what comes over and what doesn't (the last section). Say it before the
work, not after.

## 1. Inventory the old setup (20-40 min, read only)

Put (or point to) the old setup in a folder of its own inside the kit, for example `old/`. Read it; don't change it. Run
its renders only when the member says so and only the way its own README / scripts say. Never copy its secrets (API keys,
`.env`) anywhere.

Write what makes the look, in numbers, into `styles/<name>/reference/ANALYSIS.md` (the study template has a
"Source setup" section for this). Read the code for the intended values and the member's finished videos for the real
ones; when they disagree, the videos win.

| Look part | Where it hides in the old setup | Write down |
|---|---|---|
| Palette | CSS variables, theme files, `colors.ts`, hex in components, LUTs | every colour with its role (bg, ink, accent ...) as hex, and its share of the frame measured in renders |
| Type | font files, `@font-face`, `fontFamily` props | families, weights, sizes in px at 1920 (or 1080) wide, case, letter spacing, line length; each font's licence |
| Layout grid | safe-area constants, padding, flex / absolute positions | margins, title zone, caption zone, where the subject sits, all in px and % of the frame, per aspect |
| Motion curves | GSAP eases, CSS `cubic-bezier`, Remotion `spring()` / `interpolate()`, AE keyframes | per kind of entrance and exit: curve, duration in s, overshoot, stagger |
| Transitions | transition components, ffmpeg `xfade`, AE presets | kind, duration, direction, how often (cuts per minute from the renders) |
| Camera | zoom / pan wrappers, Ken Burns, Three.js camera code | push-in %, durations, moves per shot |
| Characters | images, sprites, rigs, AI-generated people | how they are made, how many poses, what stays the same across videos |
| Pictures | stock, AI prompts, scraped images | where each kind comes from, its licence, the image prompt style (it becomes `prompts.imageStyle`) |
| Captions | caption components, `.ass` styles | font, size, position, words per card, highlight rule |
| Sound | music beds, sound effects, voice settings | loudness (LUFS), what plays when; the member's own sound files and their licences |
| Pacing | the script and the edit | words per minute, shot length median / p10 / p90, cuts per minute (METHOD.md stage 1) |
| Per video vs per style | the template folder vs the build folder | what changes every video (the topic's pictures, text) and what never does (the look) |

Then measure 1-3 of the member's finished videos exactly as METHOD.md stage 1 does. Those numbers are the target.

## 2. Pick the closest base (5 min)

Match the old setup's abilities, not its file format (docs/ENGINES.md, "Picking a base"):

| The old setup is | Usually becomes |
|---|---|
| HyperFrames / HTML + CSS + GSAP, Remotion compositions, Lottie, kinetic type, flat infographics | `starter --dim 2d` (`flat` when it is a cartoon-character explainer; `collage` when it is cut-out pictures) |
| A Three.js page, 3D objects on a ground, simple 3D diagrams | `starter --dim 3d` |
| 3D documentary: places, maps, vehicles, people re-enacting events | `recon` |
| Game-like 3D shorts with people and props | `lowpoly` |
| A slideshow of AI or stock pictures with Ken Burns moves and captions (Python / ffmpeg) | `collage` in `'scenes'` mode (pictures as cut-outs with camera moves), or `starter --dim 2d` with `image()` |
| Stick figures / MS Paint drawings | `stickman` |
| Pixel or retro 3D | `pixel-art` |

Tell the member which base and the one reason. If two fit, show both with one hero frame each before going further.

## 3. Recreate the look on the base, with numbers (1-2 h)

`cz new <name> --base <base> --aspects <the old setup's formats>`, then METHOD.md stage 2, with the inventory as the
style guide's source. Translate, never copy code:

| Old setup | On a kit base |
|---|---|
| a frame number at N fps (Remotion) | seconds: `frame / fps`; then on a spoken word with `cue('word', near)` |
| GSAP `power2.out` / `power3.out` / `power4.out` | ease-out quadratic / cubic / quartic: `1 - (1 - x)^2`, `^3`, `^4` |
| `back.out(1.7)`, CSS overshoot | the base's overshoot ease (flat `pop` = outBack 2.2, 0.26 s) or `1 + (s + 1)(x - 1)^3 + s(x - 1)^2` |
| Remotion `spring({ damping, stiffness, mass })` | a damped spring as a pure function of `t` since the start (no state between frames) |
| `interpolate(frame, [a, b], [x, y], { extrapolateRight: 'clamp' })` | clamp `(t - a) / (b - a)` to 0..1, ease it, mix x..y |
| CSS keyframes, timelines with offsets | one `update(t)` per element; offsets become cues on words |
| `Math.random()` for variety | the base's seeded generator (`rng(seed)`, `rnd()`, `hash()`) |
| DOM text, HTML cards | the base's text and card elements (canvas textures); no DOM in scenes |
| CSS filters, blend modes, backdrop blur | a finish pass (`POST_GLSL` on the starter; the base's post settings elsewhere), or dropped |
| custom GLSL shaders | starter `TRANSITIONS` / `POST_GLSL`, or materials in the 3D bases |
| xfade / AE transitions | the base's transitions, or a new one at its transition extension point |
| an AI image per scene | in videos: the app's image service (`capabilities.needsImageKey`, `prompts.imageStyle`); in the sample: pictures the member owns or PD / CC0 ones, credited |
| fonts | the same family if its licence allows shipping (OFL, Apache-2.0, the member's own); else the nearest free family, compared side by side |
| sound effects from the member's own library | not part of a style package today: write in ANALYSIS.md what plays when, so videos can add them in the app |

Port assets only with a licence: the member's own drawings, characters and logos (`own` in CREDITS.json), OFL fonts with
their licence files, CC0 / PD / CC-BY files with source and author. Nothing with unknown origin; never a Mixamo file.

## 4. Rebuild the first 15 seconds side by side (1-2 h)

Proof that the look came over is a frame-by-frame comparison, not an opinion.
1. Pick one of the member's finished videos. Take its first 15 s: cut list, one frame per shot, the words
   (METHOD.md stage 1). For the narration timing, the member makes a Toon Studio project with that video's voice-over and
   you copy its `audio/timeline.json`, or use the old setup's own word timings converted to
   `[{ s, e, text, words: [{ w, s, e }] }]`.
2. Add a view `match` (`scenes/match.js`, end 15) that rebuilds those 15 s with the style's kit: same shots, same
   framing, same moments. Times may come straight from the measured cut list here (it is a calibration).
3. Render the same moments: `cz stills <style> match --times <each shot's middle, each transition> --scale 1`, and pull the
   reference frames at the same times. Compare with the sheets in METHOD.md stage 6 (side by side, blend, edges, region
   colours) and a fresh critic (docs/CRITIC.md) with the reference frames as targets.
4. Fix in this order: framing and layout, then palette and grade, then type, then motion. Stop at a critic score of 8,
   or when two critics agree within 0.5 and the member is happy with the frames.
5. Show the member both side by side. Their yes closes this step.
6. Remove the `match` view and its scene before packaging (it is a calibration, and its pictures may be the member's).

## 5. Then the normal method

From here it is METHOD.md stage 3 onwards: the kit (every element alone), must-fail scenes first, the sample, the review
loop, sign-off, package, battle test. A converted style passes exactly the same checks as any other.

## What comes over and what doesn't

| Comes over | Doesn't |
|---|---|
| the look: palette, type, layout, motion feel, transitions, camera feel, pacing | the old code itself: React / Remotion components, HTML and CSS, GSAP timelines, AE projects, Python frame generators |
| the member's own art, characters, logos (as files they own) | another renderer: Toon Studio renders every style on its own engines |
| licensed fonts and assets, with credits | anything fetched from the web at render time (APIs, CDNs): frames must not depend on the network |
| the image prompt style | random or clock-driven effects as they were: they are rebuilt seeded and as functions of time |
| the narration and caption rules | effects only a browser's CSS can do and no shader replaces: say which, show the nearest result |
| | footage-heavy edits (video clips) on bases that don't play footage: of the bases, recon shows archive footage |

When something important can't come over, say so with a frame of the nearest result, and let the member decide whether
the style is still worth finishing on this base.

---
name: intro-edit
description: Edit a video's intro read into a finished, Apple-launch style opening - animated text and graphics synced to the speech on a HyperFrames 4K canvas (three speed graphs, overlapping nulls, word ramps, subtle zooms, footage untouched) - then give it a sound-effects pass keyed to every animation (whooshes on their peak, clicks on their landing frame). One workflow, delivered as work/intro/output.mp4 + work/intro/output.sfx.wav. Used by Toon Studio's "Edit the intro" button in Personal Brand projects.
---

# Intro edit (motion graphics + sound effects)

The user recorded an intro: them, on camera, reading the opening of the video. You turn it into the opening a viewer
remembers: clean animated text and graphics that support what is being said, landing on the words, in the house style,
and a sound-effects pass that makes every move land. No hand-holding: every decision from the transcript, the frames
and the doctrine; everything verified with stills before the render and with numbers after it.

**The doctrine is `references/editing-style.md`. Read it fully before touching HTML.** Then `references/API.md`
(the `window.SMOOTH` helpers), `references/LAYOUT.md` (canvas, columns, type scale, card anatomy) and
`references/CHECKLIST.md`. The doctrine overrides every generic motion default you know: power2 fades, back.out pops,
big blurs, glows, crossfades, idle wobble and camera shake are banned.

## What the user has asked for in past intros (house taste)
- Snappy. Graphics that make the video better to watch, never corny captions of what is being said.
- Minimal, modern glass look for UI-like visuals (cards, chips, waveforms, counters), buttery smooth velocity curves.
- Zooms: slow and tasteful or clearly intentional. No quick zoom jumps; dial amounts down rather than up.
- No text or graphics on top of anything shown full screen; nothing over the face.
- No tilted, yellow "highlighter" one-off texts (the doctrine's scripted-joke exception is off for this user).
- Bullet points: make them interesting to look at (icons, chips, staggered rows, a counter) while keeping the smooth
  entrance/exit curves.
- Verify that nothing overlaps and nothing unintentional survives. Ultra high quality.

## The reference: the intro this user called "perfect"
`templates/reference-glass-intro/` is a finished intro the user loved (build.py generates index.html; 75 s,
2560x1440; its storyboard and sound cues are next to it). **Study it before you storyboard** and match its standard:
- **Visualize, don't caption.** Each card is a small piece of UI that shows the idea: the real waveform of the read
  (drawn from `env.json`) shrinking as cuts land, two tracks with cut marks, a prompt card with chips, bars that fill
  or drain, a transcript whose lines light up or fall away, a ring with an orb doing laps, a counter running. Text is a
  label on the visual (a kicker, a number, a chip), rarely a headline on its own.
- **Scale:** glass panels are substantial (about 25-75 % of the frame width; the bottom editor panel spans 75 %), not
  a lone 40 px chip. A card that is only a kicker with nothing under it for more than half a second is a bug.
- **Glass:** translucent dark cards with a soft top highlight, backdrop blur, 32 px corners (at 1440p), a 1.5 px inner
  stroke, one warm accent that matches the lamps.
- **One continuous feel:** the next card enters while the previous exits (midpoint overlap), sounds on every move.
Its sound cue names come from the user's old paid library; use the names from `sfx_mix.py --list` instead.

## Inside Toon Studio
- **Finish before you stop.** The session ends when your turn ends, and anything still running is killed. Never end
  your turn with a command running in the background; wait for it (step 7 shows how for the render).
- **Input:** `media.json` in the project folder (the current directory). The file with `role: "intro"` (not `derived`)
  is the intro read. Other files: `screen` / `facecam` are the main video (another workflow edits them; leave them
  alone). Files with `role: "other"` may be clips to showcase in the intro only if the user's notes say so.
- **Work folder:** `work/intro/` (created by stage.py). Scripts: `SK="$CZ_SKILL/scripts"` (the skill also sits in
  `.claude/skills/intro-edit`). Python: `"$CZ_PYTHON"`, never a bare `python`. ASR: the Suite sets `CZ_ASR_PYTHON` /
  `CZ_ASR_SCRIPT` (Parakeet when installed, else a local Whisper fallback); stage.py uses them.
- **Deliver:** `work/intro/output.mp4` (the rendered intro, with the voice) + `work/intro/output.sfx.wav` (the SFX stem,
  same length). When you finish, the Suite mixes the stem under the voice and puts the intro at the start of the
  timeline, where the user watches it with the rest of the video.
- Never modify, move or re-encode the footage in media.json. Everything you write goes under `work/intro/`.
- Your replies show in a narrow side panel: short, plain sentences. Say what you are doing at each step
  ("Transcribed: 31 s, 84 words", "Storyboard: 7 cards", "Rendering, about 2 minutes", ...).
- Long steps (the render) take minutes: run them and wait; do not start other edits meanwhile.

## The workflow

### 1. Stage
```bash
SK="$CZ_SKILL/scripts"
"$CZ_PYTHON" "$SK/stage.py"
cd work/intro
```
Prints the source, the render copy, the transcript with times, and the study stills. If it says **NEEDS NODE**, stop
and tell the user: HyperFrames needs Node.js; running the Toon Studio installer again adds it.

### 2. Clean the read (only if needed)
Read the transcript. If the read contains false starts, restarts, a flubbed line said twice, or long dead air at the
start/end, splice them out: pick the RAW-intro ranges to keep from `raw_words.json` (cut in the pauses between words,
never inside a word; keep ~0.08 s before the first word and ~0.15 s after the last word of each kept range) and run
```bash
"$CZ_PYTHON" "$SK/stage.py" --keep "0.00-4.12,6.80-31.40"
```
It rebuilds `input-video.mp4` (20 ms equal-power crossfades at each join) and re-transcribes it; from here on all times
are in the spliced clip. If the read is clean, skip this: never trim a good read.

### 3. Frame study -> safe zone
Look at `study/sheet.jpg` (8 stills across the clip; the times are printed by stage.py). Decide and write into
`storyboard.json`: `safeZone` (the box the face and gestures occupy, in 3840x2160 canvas pixels; nothing enters it),
`columns` (the free left/right x-ranges, a chest band if free), `accent` (one palette color that matches the light:
warm -> orange, cool or neutral -> blue).

### 4. Storyboard
One card per spoken thought, landing on the **stressed word** (card start = word start - 0.08 s). ~5 s per card for
dense reads, 8-12 s for reflective ones; plan **clean-footage moments** on purpose (personal lines, the beat before a
name, the first second). For each card: id, start/end, column, content (kicker, headline <= 5 words per line <= 2
lines, rows / pills / bars / bubbles / counter), the motion (`ramp` / `maskUp` / `cardIn` / `react` / `grow` / `count`)
and its exit, any zoom (`punchIn` 1.05-1.09 + origin, where the `zoomOut` lands). Write `storyboard.json`.

### 5. Build index.html
Start from the staged `index.html` (the 4K skeleton, duration and fps already set; the `<audio>` element carries the
voice: keep it). `templates/example-intro.html` is a finished 52 s reference build. Structure:
`#cam-drift > #cam-snap > #stage > (video, #gfx > scenes)`; each card is a `.scene.clip` with
`data-start`/`data-duration` (pad +-0.05 s around its motion) and two nulls `.n` around content in `.col-l`/`.col-r`.
Per card, in order: entrance helpers at their word times -> `S.drift` on the outer null for the hold -> optional
`S.punchIn` / `S.zoomOut` -> exit helpers timed so the next card's first entrance starts at the midpoint of this exit.
Only `window.SMOOTH` helpers; no raw `gsap.to` with other eases; never `S.wiggle`.

**Keep every time in one place.** Either write the timeline with named constants at the top of the script, or
(recommended for anything over ~6 cards) generate index.html from a small `build.py` that holds the times as variables,
reads `words.json` (a `T(word, after)` helper returning a word's start), writes index.html and also writes
`timing.json` = {name: seconds} for every entrance, landing, exit and zoom. The sound pass (step 8) reads the same
numbers, so every sound lands exactly on its move.

### 6. Verify with stills, never with renders
```bash
"$CZ_PYTHON" "$SK/hf.py" check
"$CZ_PYTHON" "$SK/hf.py" snapshot 2.1,2.6,5.4,...        # every landing, every mid-transition, every zoom peak
```
Look at every snapshot. Fix: text in the safe zone (move the column or shrink the type); a card arriving before its
first row; clipped sideways exits (check the parent's overflow); crowding at zoom (move the zoom origin toward that
column); overlaps `check` reports (the sampler is right). Re-snapshot after every fix. Go on only with clean stills and
0 errors. Tick every item of `references/CHECKLIST.md`.

### 7. Render
```bash
"$CZ_PYTHON" "$SK/hf.py" render      # starts the render in its own process, waits up to ~9 min
"$CZ_PYTHON" "$SK/hf.py" wait        # while it says STILL RENDERING: run it again (as often as needed)
```
Renders `output.mp4` (4K, the composition's fps, all workers, GPU where available) and checks it; it must print
RENDER OK. Tell the user roughly how long it takes. Run both commands in the foreground (Bash timeout 600000 ms), never
with run_in_background, and **never end your turn while the render is running**: this session closes when you stop,
and the Suite takes whatever is in work/intro at that moment. You may write sfx_cues.json while you wait (between
`hf.py wait` calls), but the sound pass itself needs the finished output.mp4.

### 8. Sound-effects pass
The intro gets sound where things move. See the library first:
```bash
"$CZ_PYTHON" "$SK/sfx_mix.py" --list
```
Built-in sounds are synthesized (no licences); sounds named `my_...` are the user's own library (Settings in the
Suite): prefer those when they fit. Write `sfx_cues.json` from the animation times (`timing.json` names or seconds):
- **Whooshes by their PEAK** (`"align": "peak"`, the default for whooshes), placed on the fastest part of the move they
  carry: a card sliding in -> right at the start of its entrance (~0.1 s in); a collapse or a slide across -> the middle
  of the move; an exit -> near its end.
- **Clicks, blips and taps by their ONSET**, on the frame the element lands: a chip or card landing -> click; something
  turning red / removed -> `click_negative`; a check mark, a "done", a result -> `confirm` / `notify`; a counter or a
  row of marks -> a series of `click_tick` (slightly rising level and pan across the row).
- **Pan toward the side that moves:** left column -0.35, right column 0.35, centre / full frame 0.
- **Levels:** whooshes -22..-31 dB, clicks -20..-28, ticks -28..-32, blips -20..-24. Big moments get one
  `impact_soft` or `riser` at most; `sub_drop` at most once per intro, if ever.
- **Variety:** never the same sound twice in a row; use `rate` 0.94-1.08 on repeats.
- **Silence is part of it:** no sounds on clean-footage moments, none on slow drifts or slow zooms.
Then build the stem and read its report:
```bash
"$CZ_PYTHON" "$SK/sfx_mix.py"
```
It writes `output.sfx.wav` (48 kHz / 24-bit, exactly as long as output.mp4) and `sfx_cues.tsv`, and reports how far
the SFX sit under the voice (aim for 12-20 dB), cues per 5 s, repeats, and anything cut off. Fix every `CHECK:` line
and re-run. (`--preview` also writes preview-with-sfx.mp4, voice + SFX, if the user wants to hear it outside the Suite.)

### 9. Report
In a few short lines: what the intro now does (a small table: time -> card -> motion -> zoom), how many sound cues and
the level, anything you cut from the read (step 2), and that the Suite placed it at the start of the timeline.

## Iterating on feedback
- "too much" -> halve the number (zoom scale, drift distance, stagger, SFX level), never change the graph.
- "dull" -> check overlap first (is anything resting?), then entrance distance, then a punch-in on the stressed word.
- "messy" -> look for a blur, a glow or a crossfade and remove it; then too many simultaneous sounds.
- "covering me" -> the safe zone was measured wrong: redo step 3.
- After any change to index.html: check, snapshot, render, then re-run sfx_mix.py (the stem must match the new
  output.mp4; update the cue times if the animation times moved).

## Files in this skill
- `references/editing-style.md` - the doctrine. `API.md` - the helpers. `LAYOUT.md` - sizes. `CHECKLIST.md`.
- `assets/motion/smooth.js`, `assets/fonts/`, `assets/vendor/gsap.min.js` - the kit, copied into work/intro by stage.py.
- `templates/composition-skeleton.html` (the starting index.html), `templates/example-intro.html` (a finished build),
  `templates/storyboard-template.json`.
- `scripts/stage.py` (stage, splice, transcribe, study frames), `scripts/hf.py` (check / snapshot / render),
  `scripts/sfx_mix.py` (the sound pass), `scripts/make_sfx.py` (the built-in synthesized sound library).

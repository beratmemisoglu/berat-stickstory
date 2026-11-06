---
name: pixel-explainer-video
description: Turn a voiceover audio file into a finished, fully produced explainer video in a 3D pixel-art style (Three.js rendered at 320x180 on a strict 16-colour palette, cast shadows, outlines, dithered skies) with a clean retro-font HUD, real images of the games/people/companies mentioned, word-synced animation, synthesized ambience and SFX, and a fast headless render. Use this whenever the user gives an audio/narration/voiceover file and wants a video made from it, asks for "the pixel art style", "the PS2 video style", "like the last video", a pixel-art or retro 3D explainer, or wants any topic visualized from narration - even if they only say "make the video from this mp3". Handles everything from scratch - installing dependencies, audio cleanup, transcription, alignment, storyboarding, scene building, visual QA, sound design, mixing, rendering and delivery.
---

# Pixel Explainer Video

Input: one voiceover file (any topic). Output: `out/<title>.mp4` (1080p30, H.264, -16 LUFS mix) plus
`captions.srt`, the clean voice, the mix, a credits list and review sheets.

The quality bar is a hand-made motion-design video: every sentence has a visual that *explains* it,
scenes have depth and character, text is readable, nothing is decorative noise. Getting there is not
about writing more code - it's about the review loops below. Budget real time for them.

## 0. Orientation (read first)
- **`references/hibit.md` - engine v10 (READ FIRST in the Toon Studio): the Hi-Bit look (~100 colours, 5 shading steps),
  the libraries (props, sets, camera moves, people rigs and motion), full-screen b-roll, the layout check, and the variety
  rules. It wins over older advice below (320x180 / strict 16 colours describe the legacy look only).**
- `references/style_guide.md` - the visual language and the quality bar (read before building any scene).
- `references/engine_api.md` - engine + model library API (read before writing scene code).
- `references/scene_design.md` - how to storyboard narration into shots, with recipes per concept type.
- `references/qa_checklist.md` - what to check on every review sheet; known failure modes and fixes.
- `references/audio.md`, `references/sound_design.md`, `references/assets.md` - details for those phases.
- `examples/ps2/scenes/*.js` - a complete 11-minute reference video (47 shots). Skim 2-3 shots before
  writing your own; copy patterns, not content.

Paths below: `$SKILL` = this skill's folder, `$P` = the project folder (create it next to the audio or
where the user asks). Scripts print what they did; read their reports.

## 1. Setup (once per machine, ~2 min)
```bash
python $SKILL/scripts/setup.py          # installs numpy/pillow/scipy/stable-ts, checks ffmpeg/node/Chrome/GPU
python $SKILL/scripts/init_project.py $P --audio <voiceover> --title "<Title>"
```
If setup reports missing system tools (ffmpeg, Node >= 18, Chrome/Edge), show the user the printed
install command and get their OK before installing system software. If an NVIDIA GPU is present but
torch is CPU-only, offer the CUDA wheel command it prints (alignment gets ~10x faster).

## 2. Audio: clean, transcribe, align (~5 min)
```bash
python $SKILL/scripts/audio_prep.py $P      # tighten pauses safely -> audio/clean.wav (+ report, overview png)
python $SKILL/scripts/transcribe.py $P      # -> audio/transcript_raw.txt   (--whisper-cpp <dir> if the user has one)
```
Proofread `transcript_raw.txt` -> save `audio/transcript.txt`. Fix names/terms (look them up), and write
units/symbols the way they are *spoken* ("4 megahertz", "8 by 8") so alignment matches the audio.
```bash
python $SKILL/scripts/align.py $P           # -> audio/timeline.json, script_timed.txt, captions.srt, align_report.json
```
Check `prep_report.json` (click_check ok) and `align_report.json` (remaining mismatches should only be
spelling variants). Details and thresholds: `references/audio.md`. If the user didn't want pauses tightened,
use `audio_prep.py --keep-pauses`.

## 3. Understand the story, gather real images
Read `audio/script_timed.txt` end to end. Write `$P/storyboard.md`: sections/chapters with time ranges,
and for every sentence the visual idea that explains it (see `references/scene_design.md`). Identify every
game, product, person, company, place and piece of hardware named - those get real images.
```bash
python $SKILL/scripts/fetch_images.py search --pages "<Wikipedia article>" ... --commons "<query>" ...
```
Show the user the shortlist (file, size, license) and get approval before downloading (unless they already
approved asset gathering for this project), then `fetch_images.py get $P "File:X.jpg=key" ...`. Rules and
placement in `references/assets.md`. Never rip YouTube; if gameplay footage is wanted, ask the user for clips.

## 4. Build the scenes
One file per section in `$P/scenes/` (e.g. `s1_intro.js`), listed in `project.json.scenes`, with
`project.json.end` = last phrase end + ~1 s (an ending or outro that runs past the narration raises `end` to its own end, or it is cut off). Each shot is `shot({ t0, build, update, draw })`; every
animation is keyed to a spoken word with `cue('word', approxTime)`. Add new models to `$P/models.js`
following its patterns (faceted boxes, palette ramps, a bit of character). Preview any time:
`node $P/render.mjs $P serve` -> http://localhost:8765.

Work section by section: write it, render stills, look, fix, move on. Don't write all scenes and look once.

## 5. Visual QA loop (the part that makes it good)
```bash
node $P/render.mjs $P stills --times 3.5,8.2,12.9,... --name check && python $SKILL/scripts/sheet.py $P check
```
Open `out/check_sheet.png` and inspect every tile against `references/qa_checklist.md`: 2-3 frames per
shot (just after the key word lands, mid-shot, near the end) plus mid-transition frames. Fix, re-render,
re-look. Expect 3-6 rounds per section; the reference video needed ~40 fixes. Also check console
errors printed by render.mjs (missing images, `cue miss`) - each is a real bug.

## 6. Sound design + mix (~2 min)
```bash
node $P/render.mjs $P events                 # shot boundaries, card entrances, accents -> audio/events.json
```
Write `audio/beds.json` (ambience per section, see `references/sound_design.md`), then:
```bash
python $SKILL/scripts/sound_design.py $P && python $SKILL/scripts/mix.py $P
```
`mix_report.json` must pass (voice >= 16 dB over the bed while speaking, true peak <= -1 dB, -16 LUFS).
You cannot hear the result, so also render a spectrogram of a busy 40 s (ffmpeg showspectrumpic) and
check for tonal whines or broadband hiss pulses; tell the user which timestamps to listen to.

## 7. Render and deliver (~1-2 min for 10 min of video)
```bash
node $P/render.mjs $P video --name "<slug>"  # -> out/<slug>.mp4 with final_mix.wav muxed
```
Must be faster than realtime (expect 5-15x on a GPU). If render.mjs warns about software WebGL, fix GPU
flags before rendering long videos. Then sweep the *final file*: extract ~24 evenly spaced frames with
ffmpeg, contact-sheet them, and check nothing regressed; spot-check sync by extracting frames at a few
word start times from `timeline.json`. Deliver: the mp4, `audio/captions.srt`, `audio/final_mix.wav`,
`audio/clean.wav`, credits (`fetch_images.py credits $P`), and one line per section describing what's shown.

## Progress file (long builds)

Keep `.suite/build-progress.md` up to date: create it at the start, and after each section / scene file write what is done
and checked, the decisions to keep (palette use, character names and looks, camera rules, naming, images fetched), open
problems and what is next. A long build can outgrow the conversation, which Claude Code then summarises: after a summary
(or in a fresh conversation) read this file, CLAUDE.md and storyboard.md first and carry on from "next" without redoing
finished work.

## Non-negotiables (why they matter)
- **No burned-in captions**, no camera shake, zoom punches, flashes or chromatic aberration: viewers
  found them disruptive and they read as bloat. Motion comes from the scene itself (things building,
  moving, lighting up) and calm camera moves. Transitions are the engine's dithered styles.
- **Retro fonts, not pixel fonts** for all text (Orbitron headings, Share Tech Mono body) - pixel fonts
  were hard to read at video size.
- **Every visual explains the narration** at that moment. If a shot is just "cubes on a grid", it's not done.
- **Real images for real things** named in the script; synthesized visuals for concepts.
- **Look before you ship**: every claim of "done" is backed by a contact sheet you actually inspected.
- Renders are always at least realtime; if something is slow, change the approach, don't wait.

## Optional
- Thumbnails: `references/thumbnails.md` (uses the Higgsfield connector if available; costs credits,
  ask first).
- Community/showcase stills: render chosen times with `stills --scale 1` (lossless 1080p PNG).

## Banned in every style (the owner's no-slop rules, 2026-10-13)
- **No red stamp / plaque / verdict overlays**: no rubber stamps or boxed red words slammed on ('CLOSED', 'LOCKED', 'DENIED',
  'CASE CLOSED', 'THE END', 'REJECTED', 'CLASSIFIED'). "Prohibited, straight slop." Show the fact (a real document or
  footage with a highlight, the action itself) instead.
- **No notice that the voice is AI** ('AI-generated voice', 'synthetic voice' or anything like it), ever, anywhere on screen.
- Every frame must read: the subject lit and visible, text held >= 1.5 s after it settles, camera moves eased (a push
  >= 2.5 s), hands on what they hold, nothing through anything. Never cut faster than a shot can be read.

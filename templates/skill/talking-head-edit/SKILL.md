---
name: talking-head-edit
description: Edit raw talking-head / tutorial footage end to end - a screen recording (with the good mic audio) plus one or MANY facecam clips - into two frame-synced, Resolve-ready files with every restart, false start, blooper, dead air and junk removed, 20 ms crossfades, and lipsync verified. Use whenever the user gives a screen recording + facecam file(s) and says "run the editing workflow", "same editing workflow", "edit this / cut the restarts / sync these", "remove the bad takes", or hands over raw recording files. Also covers re-cuts of an existing edit and the follow-up "chapters + SEO tags" for the final export.
---

# Talking-head edit (screen recording + facecam)

The user drops raw files and expects a finished, verified edit with **no hand-holding**. The standard is: the two files
go straight into DaVinci Resolve and need no fixing - a constant flow of talking, perfectly tight, no restart, stutter,
inhale, filler or foreign-language line left in. That standard comes from three things, all mandatory:
1. **script-first**: you write `script.md` - only the sentences the video needs, each from its last clean take. The
   cutter builds the video from exactly those words. Everything else is gone by construction; you never decide what
   a "bad take" is and never list what to remove;
2. every cut is **anchored on aligned words and read from the waveform** (build_cut.py does this, not you);
3. the edit is **checked against the script** (waveform + read-back, check_edit.py) and `finalize.py`, which runs the
   checks itself, passes. Nothing is "done" before that.

The user's own words for the job:
> Match the audios based on waveform, keep only the good audio. Transcribe frame-perfectly, but look at the
> waveforms and correct the timing. Get rid of ALL unnecessary restarts - only focus on what should be kept in,
> get rid of the rest no matter what that is. Fix the audio gaps, crossfade so nothing pops, never cut word endings.
> Give progress reports. Export the screen recording and the facecam separately so I can overlay them in Resolve.
> Multiple facecams (camera stopped during generation waits) -> output ONE facecam file.

## Deliverables (folder OUT: `<footage folder>\Edit\` standalone, `$CZ_OUT` in Toon Studio)
| File | Spec |
|---|---|
| `ScreenRecording_Edited.mov` | source resolution/fps, H.264 (NVENC cq18), 24-bit PCM edited audio |
| `Facecam_Edited.mov` | ONE continuous file assembled from all camera clips, camera fps, same audio |
| `Edited_Audio.wav` | 32-bit float master |

Same length, same start: both go on the timeline at 0. Working files stay in the work folder.

## Inside Toon Studio (read first: overrides the rest of this file where they differ)
The Suite ran you in a Personal Brand project. Differences from the standalone workflow:
- **Inputs:** `media.json` in the project folder (the current directory). `role: "screen"` = the screen recording with the
  good mic (the master), `role: "facecam"` = camera clips (pass every one), `role: "intro"` = the intro read (it has its
  own workflow: leave it out). Files marked `derived` are outputs of an earlier run: never use them as inputs.
- **Work folder:** `work/` in the project: `mkdir -p work && cd work`, run every script from there with `"$CZ_PYTHON"`
  (never a bare `python`). Scripts: `SK="$CZ_SKILL/scripts"`. Deliverables go to `$CZ_OUT` automatically.
- **Do EVERY step, 1 to 10, including the video render, all gates and finalize.py.** The Suite loads the files you
  deliver (`delivery.json`) as the edit: the edited screen recording and the one continuous facecam, each as a single
  clip on its timeline. Nothing else reaches the user, so a skipped gate is a defect the user will see.
- **Re-runs / change requests on an existing cut:** work from the existing `work/script.md` (see "Re-cuts").
- **Report** as in step 11. Your replies show in a narrow panel: short, plain sentences.
- Never modify, move or re-encode the footage; everything you write goes under `work/` and `$CZ_OUT`.
- **Finish before you stop.** The session ends when your turn ends and background commands die with it. Run long steps
  in the foreground with a long Bash timeout (600000 ms); if a step needs longer, run it in the background and keep
  checking until it is done. Never end your turn before finalize.py has printed DELIVERED.

## Environment
- Windows + Git Bash (macOS works too). `ffmpeg`/`ffprobe`, Python 3 with numpy + scipy, NVIDIA GPU if present
  (NVENC + CUDA decode; scripts fall back to CPU automatically).
- **No third-party VAD, ever** (no Silero, no webrtcvad, no pyannote): speech boundaries come from the waveform envelope
  (vad.py = a 10 ms loudness envelope + threshold), words from per-utterance ASR + forced alignment. That combination is
  what makes the cuts precise; a VAD model mis-handles restarts and quiet word endings (the user's own tests).
- ASR is local only, never cloud: `common.run_asr` picks the user's Parakeet (`~/tools/parakeet`), the app's
  transcriber (`CZ_ASR_PYTHON`/`CZ_ASR_SCRIPT`) or the bundled Whisper fallback. Same output format for all.
- `SK="$HOME/.claude/skills/talking-head-edit/scripts"` standalone; `SK="$CZ_SKILL/scripts"` and `"$CZ_PYTHON"`
  instead of `python` in Toon Studio. Run every script with CWD = the work folder.
- Quote every path (spaces and `;` are common). Long steps (per-utterance ASR 3-5 min per hour of recording with Parakeet, video render 5-20 min):
  run in the background, wait with an until-loop, keep the user posted, **never end your turn while one runs.**

## Never change the skill's own scripts
The scripts and their gates are the standard. Do not edit, patch or replace them (or write your own versions of them)
to get past a check. If a gate looks wrong, re-measure independently as the gate's message says, and if you are still
convinced it is a false alarm, stop and report it with the evidence instead of delivering.

## Progress reports
Short, numbered, factual, at each milestone: files probed -> sync locked -> transcript read (what goes and why) ->
script written -> cut (old -> new length) -> audio + script check -> video rendered -> lipsync/visual -> delivered.

---

## The pipeline

### 1. Probe + extract
```bash
mkdir -p "<folder>/Edit/work" && cd "<folder>/Edit/work"
python "$SK/probe_extract.py" --screen "<screen.mp4>" --cam "<fx30.1130.MP4>" --cam "<fx30.1131.MP4>" ...
```
Pass **every** camera file. Also list the folder: unlisted files (tiny stray recordings, warm-ups) get identified and
mentioned. Note low master bitrate, extra audio tracks, VFR, cams-total vs screen length.

### 2. Sync every camera clip
```bash
python "$SK/sync.py"            # add --drift -44 if no clip is >= 10 min long (Sony FX30: -41..-53 ppm)
```
**What normal looks like - do NOT write your own sync code for any of these, they are handled:**
- `NO MATCH` for a clip = warm-up/test take shot before the screen recording started. Confirm (level/one frame/
  `ptr.py` on `cam_<key>_16.wav`), exclude, report what it contains.
- `N rejected` points = desktop playback heard through speakers (~150-200 ms late). Expected.
- `OVERLAP` between clips (even several seconds) is real: both camera files contain that moment. The renderer takes
  the clip with the larger coverage per span. Harmless. Do not patch sync.json.
- Voice-point spread p5..p95 of +-10..20 ms per clip is normal (3 s windows). Drift -40..-55 ppm is normal.
- Only if a clip that clearly contains the user's speech gets `NO MATCH`, or Gate B later fails for a clip, investigate
  deeper (windowed offsets along the clip, see references/lessons.md #5-#9).

### 3. Envelope, utterances, per-utterance transcript
```bash
python "$SK/vad.py"; python "$SK/transcribe.py"; python "$SK/quiet_regions.py"
```
transcribe.py prints how many words the full pass missed - expect non-zero; the per-utterance text is the truth.

### 4. Write the script -> `script.md`
**Read `utt.txt` completely, in order, in chunks of ~80 lines** (never decide from a summary, a grep or a sample) and
write `script.md` as you read: one line per sentence the video needs, in recording order. Rules, with real examples
in `references/editing-doctrine.md` (read it first, every time):
- **Select, never filter.** A line goes in only if the video needs it. Restarts, fillers, reactions that lead nowhere,
  off-mic talk, other videos' audio, other languages, tests: not listed = not in the video. Nothing to classify.
- **The last clean take** of every sentence. build_cut.py refuses a line when a later take of the same sentence
  exists within 60 utterances (`!earlier-take: <why>` only when the later take is broken).
- **Only the words you mean.** `U12 | text` takes those words from U12 (write the part you need, not the whole
  utterance when it starts with a false start). Word ranges (`U12 3-17 | text`) from `words.py 12`.
- **Don't type sentences out.** Write the utterance numbers you keep as you read, then
  `python "$SK/script_lines.py" 4 5 11-13 20 ... > script.md` writes the lines with their full text; edit the lines
  you need only part of, insert the `PLAYBACK` lines.
- **The viewer test, on every line** (doctrine: "The viewer test"): would the viewer miss it? Echoes of the previous
  line, thinking aloud, waiting commentary ("so let's see", "I'm curious"), reactions that state nothing ("wow, nice",
  "that's cool", "it's fine"), fragments that go nowhere and a transition said twice are NOT needed. A reaction stays
  only when it is the verdict. It removes talk, never content: facts, numbers, prices, offers and calls to action
  stay. Then `python "$SK/script_lines.py" --read` prints the script as the viewer hears it:
  read all of it and apply the test once more. Tight, continuous talking is the standard.
- **Spoken instructions in the recording are orders** ("cut this whole thing out", "intro is not part of the video").
- **Playback the viewer must see** = `PLAYBACK a-b | why`, only the part being shown, <= 15 s (`!long: <why>` to
  exceed; the raw-vs-edit comparison kind). Minutes of playback read as dead air.
- Do not "fix" what was said (numbers, names, "Cloud" for Claude): mention factual slips in the report.
```bash
python "$SK/build_cut.py"        # -> spans.json + script_words.json; refuses mismatches, earlier takes, reuse, order
```
It prints how many utterances have words NOT in the script: read that list once more - is anything the video needs
missing? Anything unneeded that IS in the script is your call to remove: nothing checks the editorial choice for you.

### 5. Audio
```bash
python "$SK/render_audio.py"     # 20 ms equal-power crossfades, float WAV, timeline.json, click scan
```
"outside crossfade" = natural transient in the source next to the cut (confirm, report). "IN CROSSFADE" = a cut sits
inside sound: find the word (script_words.json) and report it - it is a cutter problem, not something to hand-fix.

### 6. The script check (before any video render)
```bash
python "$SK/check_edit.py"
```
FAIL = the edit contains something the script does not: unaccounted sound (inhale, mumble, hidden stutter, a word from
outside the script), a repeat/filler heard in the read-back, a word hiding extra words. Fix it through `script.md`
(a different take, a shorter word range) -> build_cut.py -> render_audio.py -> check_edit.py. REVIEW lines: listen
with `ptr.py` on the output time; the transcriber drops words, so a REVIEW is usually fine - say so in the report.
There are no whitelists: rhetoric that is in the script passes because it is in the script.
**Never drop a sentence the video needs to get past a check or a tool problem** (a number that keeps coming out wrong,
a name the transcriber mangles). The script decides the content; the tools serve it. If a needed line cannot pass,
stop and report it with the evidence - a shorter video that silently lost its point is the worst outcome.

### 7. Video (frame-exact, absolute grid; re-runs resume, and a changed cut wipes stale segments automatically)
```bash
python "$SK/segrender.py" screen && python "$SK/segrender.py" cam && python "$SK/mux.py"
```
Frame counts must equal expected exactly; mux prints a full decode test per file.

### 8. GATE B - lipsync per camera clip
```bash
python "$SK/verify_sync.py"
```
Every strong span within half a camera frame of its clip median. Weak spans must be blocks/holds. A weak SPEECH span
or an outlier: re-measure independently (envelope at 48 kHz on halves of the span, correct camera excerpt).

### 9. GATE C - look at it
```bash
python "$SK/contact.py"          # then Read contact.png and switches.png
```

### 10. FINAL GATE
```bash
python "$SK/finalize.py"         # RUNS check_edit.py + verify_sync.py itself, checks freshness/frames -> delivery.json
```

### 11. Report
1. Raw length -> edited length (% removed), deliverable paths + sizes.
2. Cameras: which clip covers what, gaps, excluded files and what they contain, drift, overlaps.
3. Editorial calls: spoken instructions followed, discarded runs, earlier takes used (and why), playback kept (and how long).
4. Numbers: script lines, pieces, in-sentence gaps removed, joins/clicks, frame counts, lipsync range per clip.
5. Worth a listen: factual slips, unavoidable stutters, low-bitrate source, number/price inconsistencies.

## Re-cuts ("put back the part about X", "tighten the pauses", "cut the last minute")
Never hand-edit output files or timelines. Change `script.md` (use `utt.txt` to find the utterances), then run
build_cut.py -> render_audio.py -> check_edit.py -> segrender screen/cam -> mux.py -> verify_sync.py -> contact.py
-> finalize.py. Same checks, same standard.

## Follow-up: YouTube chapters + tags for the final export
`python "$SK/chapters.py" "<final.mp4>"` (timestamps from the FINAL export with the intro). First chapter `00:00`,
>= 10 s apart, "Step N" for workflow videos, previews/results as their own chapters. Tags <= 500 chars, broad terms
first then long-tail; 2-line SEO description opener; save to `youtube_chapters_and_tags.txt` next to the video; flag
ASR mishearings that will also hit YouTube auto-captions.

## Reference
- `references/editing-doctrine.md` - how to write script.md, with real examples (read before step 4)
- `references/lessons.md` - every failure seen so far and the built-in fix (read when something looks off)

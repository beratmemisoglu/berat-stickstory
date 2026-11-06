# Audio pipeline details

## audio_prep.py (clean + tighten pauses)
- When NOT to tighten (`--keep-pauses`): the user says pacing is intentional, the narration has dramatic
  beats or music underneath, it's a dialogue/interview, or pauses are already short (median gap < 0.2 s
  in `prep_report`). TTS voiceovers with long uniform gaps benefit most from tightening.
- Default: every pause becomes 110-200 ms (longer original pauses stay longer). The 11-minute
  reference went 12:13 -> 11:11 and sounded natural. `--keep-pauses` skips tightening (only
  normalises) - use it if the user says the pacing is already right or wants dramatic pauses kept.
- Never cut inside a word: tails are measured to -62 dB with a 25 ms guard; only silence cores are
  removed, joined with 20 ms equal-power crossfades.
- Check `prep_report.json`: `click_check.ok` must be true. `cuts_with_energy_above_-55dB` lists cut
  regions that had faint sound - normally breaths/room tone between the word tail and the next onset.
  If there are many, open `out/audio_overview.png` or plot the envelope around a few of them.

## transcribe.py
- Uses whisper.cpp if the user has a build (`--whisper-cpp <dir>` containing whisper-cli and a ggml
  model), else openai-whisper through stable-ts (`turbo` on GPU, `medium.en` on CPU).
- The raw text is a draft. Proofread for: proper nouns (people, studios, products - check spellings
  online when unsure), homophones ("two"/"to"), British vs American spellings used by the subject
  ("Traveller's"), and **write units/symbols as spoken** ("294.9 megahertz", "8 by 8", "C plus plus"
  can stay "C++" only if alignment still matches; if a word keeps failing to align, spell it phonetically).

## align.py
Produces `timeline.json` (phrases with word timings), `script_timed.txt`, `captions.srt`.
Stages and why they exist:
1. forced alignment (stable-ts) of the corrected text;
2. snapping word edges to onsets/decays in the waveform (raw alignment squeezed some words to ~0 length);
3. pause anchoring - real pauses must fall between words (39 straddling words in the reference);
4. phrases = voiced regions between real pauses (ground truth, more reliable than word gaps);
5. every phrase is re-transcribed independently with 200 ms silence padding (Whisper drops the first
   word of clips that start abruptly); words heard on the other side of a pause are moved;
6. false pauses from stop-consonant closures (the silent "k" in "se-ctors") are merged.
Read `align_report.json`: remaining mismatches should be recogniser spellings only ("47gb" vs
"4.7 gigabytes", "3" vs "III"). If a mismatch shows a word missing at a phrase edge, inspect that spot.

## Sync spot-check after rendering
Pick 5-6 random words from `timeline.json`, extract frames ~0.35 s after their start from the final mp4,
and confirm the visual beat keyed to them is present (cards/headlines keyed with `cue`).

# Lessons - every failure seen so far and what the scripts now do about it

| # | Symptom | Cause | Built-in fix |
|---|---|---|---|
| 1 | Whisper word stamps had no gaps; 51 min grouped into 38 "phrases" | ASR stretches word timing across silence | Cut points come from the WAVEFORM (10 ms envelope); ASR only supplies words |
| 2 | Whisper `--dtw` returned `t_dtw: -1` | build/model combination | Not used; Parakeet + forced alignment gives ~20 ms word times |
| 3 | Whisper hallucinated one sentence ~20x over a silent stretch | full-file decoding over long silence | Every utterance transcribed separately |
| 4 | Parakeet full pass silently dropped 488 words (incl. a whole intro) on a 64-min file; 192 on a 42-min file | full-file decoding | Per-utterance pass is the source of truth; full pass only for the coverage report |
| 5 | Camera drifted 114 ms over 51 min | separate clocks (FX30 ~ -42..-53 ppm) | Drift fitted on long clips, applied per segment |
| 6 | Short clips gave drift estimates from -79 to +17 ppm | too little time span | Drift only fitted on clips with >= 600 s of points; short clips use the median / --drift |
| 7 | Cluster of sync points at a constant -170 ms | OBS records desktop audio digitally; camera hears the speakers ~170 ms later | Voice-only points (> 60 ms off the trend rejected) |
| 8 | A clip matched nowhere | warm-up/test take recorded before OBS started | Reported as NO MATCH; confirm content, exclude, tell the user |
| 9 | Two clips "overlapped" by 0.8 s | ambiguous edges in silence | Report it; harmless if only silence; lipsync gate decides |
| 10 | One 448-term ffmpeg select/setpts expression: "Error while parsing expression" | parser limits | Per-span renders on an absolute frame grid + lossless concat |
| 11 | (avoided) trim+concat drifts up to half a frame per cut | per-clip duration rounding | Frame ranges from round(out_time * fps) on the absolute grid; counts must match exactly |
| 12 | Lipsync check showed +-100 ms on half the spans | the check compared against a STALE audio render | verify_sync.py always regenerates its reference from the current render |
| 13 | 15-20 ms lipsync outliers | pitch-period ambiguity in sample-level correlation | Envelope-based lipsync; outliers re-measured independently at 48 kHz |
| 14 | Re-measure of an outlier gave garbage | camera excerpt started after the span's camera time | Always compute the camera time first and cut the excerpt around it |
| 15 | Restarts inside one breath survived the first cut (5-9 per project) | silence-based cutting can't see them | Script-first: only listed words exist; check_edit.py reads the edit back |
| 16 | Aligner showed only one "it" in "it it", one "Toon Studio" in a restarted phrase | forced aligner normalizes disfluencies | build_cut.py cuts at the dip before the kept word when new sound follows; check_edit.py fails on unaccounted sound / hidden words |
| 17 | Click scan flagged a join | natural "-ts" transient 22 ms before the cut in the source | render_audio.py distinguishes steps inside vs outside the crossfade |
| 18 | "Couldn't find this file" when giving the user a link | markdown link with <...> kept the ">" in the path | Give paths as plain code blocks; request folder access before opening files in the side pane |
| 19 | Low-bitrate master (61 kbps AAC) | recorder setting | Report it; nothing in the edit can add quality back |
| 20 | Camera started late / stopped early | user started camera after OBS | Uncovered spans render black (reported); usually the take starts after the camera anyway |
| 21 | An agent spent a long detour "fixing" a real 8.6 s overlap between two camera clips and patched sync.json | the skill did not say what normal looks like | SKILL.md step 2 lists normal outcomes; overlaps are real and handled by the renderer |
| 22 | User: "dead spaces, inconsistent cuts, borderline unusable" (Toon Studio run) | (a) the app skipped this skill's render + gates and played ~240 cuts live from proxies; (b) 89 s + 2x 57 s playback blocks kept whole | The Suite now runs the full pipeline and loads the rendered files as ONE clip each; edl.py refuses blocks > 25 s without `long_ok` |
| 23 | Re-cut after a render could reuse old segment files (same index, different span) | resumable segment cache | segrender.py signs each seg folder with the timeline+sync hash and wipes it when the cut changes |
| 24 | Gates could be skipped or run on an old render | nothing enforced order/freshness | every gate records into gates.json; finalize.py refuses stale or failing gates |
| 25 | Envelope lipsync flagged 3 of 141 spans at up to 32 ms; a fresh agent proved them in sync with GCC-PHAT (all within 5.4 ms) - then edited the gate script itself to pass | the envelope method is biased by room reverb on some phonemes | verify_sync.py now re-measures envelope outliers with GCC-PHAT (both halves must agree within 1 ms, within 16.7 ms of the clip's PHAT median); SKILL.md forbids editing the scripts |

| 26 | Sonnet 5.5 cut: stutters, bad takes, inhales, repeats and a Hungarian line left in - "just as bad" | keep.json FILTERED the recording (bulk ranges, repeats_ok whitelists), Parakeet disguised Hungarian as English and hid stutters, the read-back gate verified against itself, a loose -55 dB gate let 27% low-level sound in | Script-first rewrite: script.md lists only the needed sentences; build_cut.py; check_edit.py (waveform + read-back against the script, no whitelists); finalize.py runs the checks itself |
| 27 | Most script lines "out of recording order" | aligner stretched last words 0.7 s into silence / placed words past the phrase end | words clamped to the phrase's sound edges; late words re-anchored |
| 28 | "you can't" came out "you can"; "fix" lost its f; "this suite" lost its tail | cutting on a loudness threshold | edges read from the waveform shape: release bursts stay, soft onsets from -60 dB stay, tails up to 0.45 s |
| 29 | "their their" leaked through as one aligned word | aligner normalization | a dip followed by new sustained sound (>= 10 dB rise) ends the word at the dip |
| 30 | Clicks at joins inside continuous speech | splitting lines at tiny gaps | no split inside a line unless > 150 ms gap or >= 80 ms of unaccounted sound |
| 31 | A lip smack kept before "So"; the long s of "super" lost 85 ms (click in the crossfade) | onset search took the loudest frame / gave up after 100 ms | mouth-click rule (non-plosive words start at the dip after a <= 20 ms burst); a steady hissing first sound is kept whole up to 250 ms |

| 32 | Numbers clipped in an APPROVED edit: "Opus 5.5 was" -> "Opus five was", "Gemini 3.8" -> "Gemini 3", "10k views" -> "K views", "just thirty-seven dollars" -> "just thirty" (8 of 22 numbers) - and every check passed | the forced aligner has no digits in its alphabet: "5.5" got a sliver next to its neighbour, its sound sat in the gap and was cut as a pause; the read-back collapses numbers, so one missing number was only a lowercase review | Parakeet aligns numbers in their spoken form ("five point five") and folds them back; build_cut.py gives a number too short to be said the audible sound between its neighbours; check_edit.py FAILS a number kept shorter than it can be said, or kept short with >= 150 ms of its sound cut beside it |
| 33 | A delivery was refused as "scripts changed" after an honest run | the lock compared the project's scripts with the app's CURRENT templates, which had been updated mid-run | the Suite records the scripts' hashes when a run starts and compares with that; an added .py (e.g. a numpy.py that would shadow numpy) counts as a change |
| 34 | Transcription took 24 min for a 57-min recording | the aligner model (1.2 GB) was reloaded for every one of 642 utterance files | loaded once per run (and the full-file pass rides in the same call): 4.5 min |
| 35 | The final gate failed a check that had passed minutes earlier on the same audio (twice, on a real run: 10 min re-render, then "DELIVERED" on a plain re-run) | the transcriber varies run to run: a neighbour misheard at a window's edge ("right now I" -> "right now you can"), a faint sound heard once as a filler | every transcriber-based FAIL gets a second listen (edge moved off the neighbour / the chunk heard again whole and in overlapping halves); it fails only if heard again, otherwise it is a REVIEW line |
| 36 | "check_edit.py FAILED" with no reason shown to the agent | finalize.py printed only the last 6000 characters - a page of spelling notes pushed the FAIL line out | spelling notes go to check_review.txt; finalize prints every FAIL / REVIEW line |
| 37 | An in-app run dropped needed sentences ("51 minutes was the raw recording...", "95% of the job") because their numbers kept failing | the number bug (#32) plus no rule against trading content for a pass | SKILL.md: never drop a needed sentence to get past a check or a tool problem; report it |
## Real numbers from past runs (for sanity checks)
| Video | Raw | Edited | Utterances kept | In-breath trims | Joins | Lipsync |
|---|---|---|---|---|---|---|
| Low-poly (1 cam) | 51:15 | 27:30 | 580 / 683 | 16 | 449 | -11..+14 ms |
| Talking-head demo (1 cam + intro) | 39:07 | 20:04 + 1:03 | 360 / 577 | 24 | 292 + 11 | -9.5..+13.8 ms |
| Faceless channel (1 cam) | 25:41 | 13:56 | 272 / 338 | 33 | 208 | median 2.4 ms, 95% within 10 ms |
| Toon Studio demo (3 cams, 1 unused) | 64:21 | 13:35 | 245 / 359 | 29 | 186 | +-9..12 ms around clip median |
| Three.js demo (6 cams, 1 unused) | 42:16 | 8:46 | 144 / 264 | 14 | 115 | -10.6..+14.3 ms |
Parakeet: ~22 s ASR per 25 min of audio; per-utterance pass ~0.3 s per utterance (it was 2 s while the aligner model reloaded for every file - fixed in the transcriber, 2026-09-29).

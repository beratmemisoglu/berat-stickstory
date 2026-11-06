# Transcription and audio step errors
keywords: transcription, transcriber, time words, clean audio, clean and time, python not found, ffmpeg, audio step, mix failed, no words could be timed, parakeet, setup failed, did not pass the test
platforms: both

## Python or ffmpeg was not found
> Python was not found. Install it, or set its path in Settings > System > Tool paths...
> ... could not run ffmpeg. Install it or set its path in Settings > System > Tool paths.

What it means: the audio steps need Python and ffmpeg on this computer.

Fix:
1. Open **Settings > System > System check**.
2. Install what is missing. On Windows, in PowerShell: `winget install --id Python.Python.3.12 -e` and `winget install --id Gyan.FFmpeg -e`. On Mac, in Terminal: `brew install python` and `brew install ffmpeg` (no Homebrew yet? Get it from brew.sh first).
3. Restart the app and press **Run checks**. Still not found? Set the path in **Settings > System > Tool paths**.

## Another audio step is running
> Another audio step is still running for this project.

Fix: wait for it to finish (or cancel it), then try again.

## Transcription setup failed
> Transcription setup did not pass the test after three tries.
> The transcriber's own Python environment is missing " ...

Fix:
1. Make sure Claude is signed in (**Settings > AI engines**).
2. In **Settings > System > System check**, on the Transcription row click **Set up with Claude** (or **Redo with Claude**).
3. Still failing? Click **Help > Report a problem** so it gets fixed.

## No words could be timed
> No words could be timed. Check that the voiceover is speech and that script.txt matches it.

Fix:
1. Check that the voiceover file really has the narration in it.
2. Make sure the script matches what is said, then press **Time words** again.

## Nothing to mix
> There is no voiceover to mix yet. Add the voiceover (first step), then run this step again.

Fix: add the voiceover first, then run the step again.

## The mix failed
> The mix failed: ...

Fix: run the step again. If it fails again, click **Help > Report a problem** so it gets fixed.

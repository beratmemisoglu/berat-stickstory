# Transcription setup (word timing)
keywords: transcription, transcribe, speech to text, words timed, word timing, timing off, out of sync, captions out of sync, subtitles wrong, not set up yet, whisper is used, whisper, whisper on the cpu, parakeet, speech model, set up with claude, redo with claude, set up for english, try again, slow transcription, no gpu, cpu, gpu, asr
platforms: both

The app times every spoken word of your voiceover so pictures and captions match the voice. This runs on your own computer, and nothing leaves it.

## Check it

Open **Settings > System > System check** and look at the **Transcription** line. A green dot means a speech model is set up, with its name and speed.

When Claude is signed in and nothing transcribes English yet, the app asks your Claude to set it up by itself.

## "Not set up yet: Whisper is used for now."

Whisper (slower) does the work until a setup is done. Two ways to set one up:

- **Set up with Claude**: your Claude checks this computer, picks the best local speech model, installs it and tests it on a spoken sample. Claude must be signed in first ("Connect Claude first"). **Show progress** shows what it does; **Stop** cancels.
- **Whisper on the CPU**: the app installs Whisper itself (about 1 GB) and tests it. Works on any computer without a graphics card, no Claude needed. Pick **Base (fastest)** or **Small (more accurate)** first.

## Setup takes a long time

If **Set up transcription** takes a long time, **System check > Transcription** shows the minutes so far and the current step, and **Home** has a **Stop** button. If nothing happens for 15 minutes the app stops it and says why. Click **Try again** (it cleans up the unfinished attempt first), or pick **Whisper on the CPU**: the app installs it itself, no Claude needed. A setup cut off by closing the app shows as failed with **Try again**.

## Other buttons you may see

- **Try again**: the last setup failed; the line says why.
- **Redo with Claude**: Claude looks for a better model for this computer and switches only if it passes the test (uses Claude).
- **Set up for English**: shown when the setup for several languages also does English; installs a model made for English (usually a little more accurate).
- "Parakeet (your own install)": your own Parakeet is used. Its folder can be set in **Settings > System > Tool paths**.

## Other languages

Videos in other languages need **Several languages** in **Settings > General > Language**. A second line, **Transcription, other languages**, then shows that setup. See "Video language".

## Words are out of sync

1. In the editor's Pipeline, find **Words timed** and click **Redo**.
2. Still wrong? Click **Help > Report a problem** so it gets fixed.

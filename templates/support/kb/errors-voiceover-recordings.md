# Voiceover errors: local voice, recordings and language
keywords: local voice, install local voice, free voice, python 3.10, recording, recordings, join, joining failed, open in another program, no script to read, does not speak, language, voiceover failed, already being made
platforms: both

## No script yet
> There is no script to read yet. Write it first (the Script step), or use your own recording.

Fix: write the script first, or add your own recording.

## The voice does not speak this language
> ... does not speak ...
> ... the language of this video.
> The local voice does not speak ...
> ... the language of this video.

Fix: pick a model or voice for that language in the Voiceover window, or use ElevenLabs, Fish Audio or your own recording.

## The voiceover file is in use
> ... is open in another program (a player, an audio editor or a sync app). Close it there, then try again.

Fix: close the file in that program (or pause the sync app), then try again.

## The local voice is not installed
> Install the local voice first (Local voice, Install). It is free and runs on this computer.
> The local voice needs its Python package: press Install...

Fix: in the Voiceover window open **Local voice** and press **Install** (also in **Settings > Media > Voiceover**).

## The local voice needs another Python
> The local voice needs Python 3.10 to 3.13; this computer's Python is ...

Fix: install Python 3.12, then press **Install** again. On Windows, in PowerShell: `winget install --id Python.Python.3.12 -e`. On Mac: the Python 3.12 installer from python.org.

## The local voice download stopped
> The download of ...
> ... Press Install again: it continues where it stopped.
> ... arrived damaged (not the published file). Try again.

Fix: check the internet connection and press **Install** again.

## Recordings can't be read or joined
> ... is not an audio or video file the app can read.
> ffmpeg was not found. Install it or set its path in Settings > System > Tool paths.
> Joining the recordings failed: ...

Fix:
1. Use common audio or video files (wav, mp3, m4a, mp4, mov).
2. ffmpeg missing: install it from **Settings > System > System check** (Windows PowerShell: `winget install --id Gyan.FFmpeg -e`; Mac Terminal: `brew install ffmpeg`).
3. Still failing? Click **Help > Report a problem** so it gets fixed.

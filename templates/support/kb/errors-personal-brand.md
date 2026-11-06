# Personal Brand errors
keywords: personal brand, talking head, facecam, screen recording, footage, timeline empty, clip missing, file missing, already rendering, render failed, render cancelled, not a video or audio file, no length, cut not delivered, intro not rendered, edit the intro
platforms: both

## The timeline is empty
> The timeline is empty: add footage first.

Fix: add your recordings in **Footage**, then render.

## A clip's file is missing
> A clip's file is missing ...
> ... Relink or remove it in Footage.

What it means: a recording used in the edit was moved, renamed or deleted, or its drive is not connected.

Fix: put the file back where it was (or connect the drive). Otherwise remove it in **Footage** and add it again.

## A file can't be used
> ... is not a video or audio file.
> ... has no length (is it a finished recording?).

Fix: use the finished recording (let the recording program finish saving it), in a common format like mp4, mov, wav or mp3.

## Already rendering
> This video is already rendering.

Fix: wait for that render to finish.

## Claude stopped before the cut was finished
> Claude stopped before the cut was delivered...

Fix: ask Claude in the Claude panel to finish the cut, or start the edit again.

## Claude stopped before the intro was finished
> Claude stopped before the intro was rendered...

Fix: ask Claude to finish the render and the sound pass, or start **Edit the intro** again. Node.js must be installed for intros (**Settings > System > System check**).

## ffmpeg problems
> ffmpeg not found ...
> ... Install ffmpeg or set its path in Settings.
> ffmpeg failed: ...

Fix: install ffmpeg from **Settings > System > System check** (Windows PowerShell: `winget install --id Gyan.FFmpeg -e`; Mac Terminal: `brew install ffmpeg`), restart the app and render again. If ffmpeg failed, check free disk space; still failing? Click **Help > Report a problem** so it gets fixed.
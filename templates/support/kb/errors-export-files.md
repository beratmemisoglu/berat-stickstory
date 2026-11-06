# Export errors: ffmpeg, limits, 4K and deleting
platforms: both

## ffmpeg not found
> ffmpeg not found ...
> ... Install ffmpeg or set its path in Settings.

What it means: the app needs ffmpeg to put the picture and the sound together, and it can't find it.

Fix:
1. Open **Settings > System > System check** and look at the **ffmpeg (export)** row.
2. Install it. On Windows, in PowerShell: `winget install --id Gyan.FFmpeg -e`. On Mac, in Terminal: `brew install ffmpeg` (no Homebrew yet? Get it from brew.sh first).
3. Restart the app, then press **Run checks**: the dot should be green.
4. Installed but still not found? Paste its location into **Settings > System > Tool paths**.

## ffmpeg failed
> ffmpeg failed: ...

What it means: ffmpeg started but stopped while writing the video.

Fix:
1. Make sure the disk has free space, then export again.
2. Still failing? Click **Help > Report a problem** so it gets fixed.


What it means: Standard includes 12 finished video exports a month. Clips of a range and 9:16 trailers don't count.


## 4K is Premium


## Deleting during an export
> This video is being exported. Wait for the export to finish (or cancel it in its Export dialog), then delete it.

Fix: wait for the export or cancel it, then delete.
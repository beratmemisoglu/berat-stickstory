# Export failed or stuck
keywords: export failed, won't export, wont export, render failed, export error, stuck exporting, export stuck, stuck at 40%, stuck at 0%, frozen export, export slow, export takes forever, black video, no sound in export, no audio, silent video, no music in export, ffmpeg, ffmpeg not found, old narration, old voice in export, stopped responding, loop, out of exports, export limit, cancel export, no audio track found
platforms: both

## First checks

1. **Settings > System > System check**: the **ffmpeg (export)** line needs a green dot. If it says "Not found: export cannot add audio / mux", run the install command shown next to it (in PowerShell on Windows, in Terminal on Mac), then restart the app. Installed but still not found? Set its path in **Settings > System > Tool paths**.
2. Preview warnings? Click **Fix with Claude**, then export again: a scene with an error can stop an export.

## Messages

- "A scene stopped responding at about m:ss ... most likely a loop that never ends": ask Claude to check the scene at that time, then export again.
- "The preview renderer stopped responding": a slow graphics card or a stuck scene. Try again, then see "Preview black, stuck, broken or slow".
- "This video has no shots to render": fix the error the editor shows first.
- "The voiceover changed after the audio was cleaned" or "The words of this voiceover are not timed yet": click **Clean and time** or **Time words** under the preview, then export.
- "You've used this month's 12 exports on Standard": they reset on the 1st. See "Plans: Standard and Premium".

## It exported, but...

- **No music or effects**: the export window said "the clean voiceover (no sound design yet)". Run **Sound design mixed** in the Pipeline, then export again.
- **"no audio track found"**: there was no voiceover to add. Check **Voiceover added** and **Audio cleaned**.
- **Black video**: **Settings > System > Graphics**: pick **Software**, then **Restart now**. See "Preview black, stuck, broken or slow".
- **Old voice**: the narration changed after that export (**Video exported** says "outdated"). Export again.

## Slow, or stuck at a percentage

The progress line shows frames and time left. These take much longer: **Also make a 4K version**, and in 3D reconstruction **Export quality** set to **Maximum**, or high Supersampling or Motion blur in **Graphics > Export quality**. **Draft (fastest)** is quickest for a check.

Still failing? Copy the text from the **Export failed** box and click **Help > Report a problem** so it gets fixed.

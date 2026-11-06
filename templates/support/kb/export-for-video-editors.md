# Using your export in Premiere, DaVinci Resolve or CapCut
keywords: clips, shots, edl timeline, channel folder, premiere, premiere pro, davinci, resolve, davinci resolve, capcut, final cut, fcp, video editor, nle, edit further, import into editor, project file, xml, edl, separate tracks, stems, separate audio, music only, voice only, export layers, transparent background, alpha, prores, mov, 60fps, 24fps
platforms: both

For explainer videos the app exports a finished video: MP4 (H.264) at 30 fps. There is no layered project file, but you can get the video cut into its shots with a timeline file your editor opens (below).

What you can take into any editor:
- **The MP4**: 1920×1080 (1080×1920 for a vertical project) with the voice, music and effects mixed into one sound track.
- **Separate audio tracks** (tick **Also export the audio as separate tracks** in the Export window; it stays ticked): three WAV files next to the video, `<name>-voice.wav`, `<name>-music.wav` (the music, ambience and your Music / Ambience layers) and `<name>-sfx.wav` (the sound effects and your other layers). They are 24-bit 48 kHz, start at the video's first frame and are exactly as long as the video (a range export too), and together they sound exactly like the video's mix, so you can rebalance them in your editor without exporting again. A video whose sound design was made in an older version gives `<name>-bed.wav` (music and effects together) instead of the music and effects tracks until you run **Sound design** again. Not mixed yet: only the voice track.
- **The shots as separate clips** (tick **Also export the shots as separate clips (for Premiere, DaVinci, CapCut)** in the Export window; it stays ticked): after the video is done, it is cut at every shot change into a `<name>-clips` folder next to it: `001_<shot>.mp4`, `002_<shot>.mp4` … (picture and sound; every clip starts exactly on its shot's first frame), plus `<name>.edl`. Import the .edl in Premiere (**File > Import**) or DaVinci Resolve (**File > Import > Timeline**) and point it to the clips folder: the clips line up exactly as in the video. In CapCut, drag the numbered clips onto the timeline in order. The clips are cut from the 1080p video (no new render, no separate layers).
- **The 4K version** (Premium, **Also make a 4K version**): more room to crop or zoom.
- **The captions file (.srt)**: most editors import it as subtitles. See "Captions and subtitles (.srt)".
- **Vertical versions and trailers**: see "Vertical 9:16 versions and trailers".
- **Single frames**: the camera button under the preview saves a 1080p PNG.

All of them are in the project's out folder: after an export click **Show in folder** (File Explorer on Windows, Finder on Mac), or use the folder button on the **Renders** page. A video that belongs to a channel is also placed in that channel's folder, `exports/<channel name>` in your workspace (**Channel folder** after the export, or on the **Renders** page).

## Often you don't need another editor

- Your own music, sound effects and levels: **Music & effects** (see "Sound effects and audio layers").
- Shorter pauses: **Trim silences**.
- Changing a shot: ask Claude in the editor.

Editing your own camera footage instead? See "Personal Brand (editing your own footage)".

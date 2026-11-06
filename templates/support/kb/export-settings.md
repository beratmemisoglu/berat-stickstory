# Export settings (the Video tab)
keywords: export settings, export options, resolution, 1080p, 1920x1080, full hd, 4k, uhd, 2160p, 3840x2160, fps, frame rate, 30 fps, 60 fps, quality, bitrate, h.264, mp4 format, gif, make a gif, selected range, export part, export clip, only a part, captions srt, export quality, draft, maximum, exports left, premium 4k, cancel export
platforms: both

Everything in **Export > Video**:

- **File name**: the name of the MP4.
- Size and format are fixed: 1920×1080 (1080×1920 for a vertical project), 30 fps, H.264 MP4. There is no frame-rate or format choice. The line under the name says which sound goes in: the mixed soundtrack, or "the clean voiceover (no sound design yet)" if **Sound design mixed** hasn't run.
- **Only the selected range (…)**: appears when a shot, a phrase or a range (Shift + drag on the timeline) is selected. Exports just that part.
- **Also make a GIF**: appears once **Only the selected range** is ticked; the range must be 30 s or shorter. A small 15 fps GIF for sharing, saved next to the MP4: 540 wide, or 960 wide with hard pixels for Pixel art and MS Paint stick figures (the dialog shows the width).
- **Export quality** (3D reconstruction only): **Draft (fastest)** (about 3-4x faster), **Standard**, **Maximum** (about 2x slower, sharpest), or **Same as preview (use my Graphics settings)**.
- **Also make a 4K version** (Premium): a 4K file (3840×2160, or 2160×3840 for vertical) is saved next to the 1080p one, upscaled from it. Pixel art and MS Paint stick figures stay pixel-sharp; the other styles are upscaled smoothly.
- **Save captions (.srt) next to the video**: on by default, only for full-length exports. See "Captions and subtitles (.srt)".
- **Also export the audio as separate tracks (voice, music, sound effects)**: off by default, remembered once ticked. Saves `<name>-voice.wav`, `<name>-music.wav` and `<name>-sfx.wav` next to the MP4, as long as the video, for fine-tuning the audio in another editor. See "Using your export in Premiere, DaVinci Resolve or CapCut".
- **Also export the shots as separate clips (for Premiere, DaVinci, CapCut)**: off by default, remembered once ticked. Cuts the finished video into one MP4 per shot in `<name>-clips/` plus an .edl timeline. See "Using your export in Premiere, DaVinci Resolve or CapCut".

## Standard plan

The window shows "Standard plan: N of 12 video exports left this month." (the sidebar shows "N of 12 exports left").
- Counted: full-length exports, also a full-length vertical video.
- Not counted: a selected range, a vertical trailer or clip.
- At 0: "You've used this month's 12 exports on Standard. They reset on the 1st; Premium has unlimited exports."
- 4K is Premium only: on Standard the box is greyed out with a **Premium** tag.

## Buttons

- **YouTube chapters**: see "YouTube chapters".
- While exporting: **Cancel export** (partial files are removed) and **Close, keep exporting**.
- The progress line shows frames done, speed and about how long is left.
- After an export: **Play**, **Show in folder**, **Clips folder** (when clips were made) and **Channel folder** (for a video in a channel: every export of that channel's videos, in `exports/<channel name>` in your workspace).

Other formats: the **Vertical 9:16** tab (see "Vertical 9:16 versions and trailers").

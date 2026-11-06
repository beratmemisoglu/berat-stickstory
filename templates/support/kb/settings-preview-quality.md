# Preview quality (laggy or slow preview)
keywords: preview quality, laggy preview, laggy, slow preview, preview slow, stutter, stuttering, choppy, jerky, low fps, fps, frame rate, lag, playback lag, not smooth, slow computer, performance, resolution, full, half, quarter, auto, preview size, real time
platforms: both

**Settings > General > Preview quality** sets how big the editor's live preview is drawn. On a slow computer a smaller preview plays the video in real time while you edit.

## Options

- **Full** (default): every pixel of the video.
- **Half**: half the width and height. Plays smoothly on most computers.
- **Quarter**: for slow computers, a rough picture that keeps up.
- **Auto**: starts at Full and drops while playing when frames come too slowly.

Exports, saved frames and Claude's frames always stay full size: this only changes what you see while editing.

The same choice is in the editor, next to the playback speed.

## Still slow?

- The editor may say a project's preview is always drawn at full size. That is an older project: click **Update engine** when the editor offers it to get the smaller sizes.
- Each video also has its own **Graphics** settings (render scale, shadows, post processing and more, with a frame-rate readout): open the video in the editor and press **Graphics** at the top, next to its look. **Settings > General > Graphics (each video)** only points there.
- Preview black, or a message that it can't create WebGL: see "Graphics: graphics card or software".

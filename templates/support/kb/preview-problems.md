# Preview black, stuck, broken or slow
keywords: black screen, black preview, blank preview, preview not loading, stuck loading, loading the scenes, updating forever, webgl, can't create webgl, error creating webgl context, gpu, graphics card, graphics driver, software graphics, laggy, lag, slow preview, choppy, stutter, low fps, preview warnings, preview warning, error in preview, fix with claude, did not finish loading, endless loop, frozen preview, old mac, opencore, reloading preview
platforms: both

## "Could not create WebGL" or the preview stays black

1. Click **Use software graphics and restart** in the message on the preview.
2. Or open **Settings > System > Graphics**, pick **Software** ("Slower, works on unsupported graphics") and click **Restart now**.

The app can also switch to software by itself: a message says so, and the sidebar shows **Restart for software graphics** until you restart.
To go back to your graphics card later, pick **Automatic** ("The graphics card (fastest)") and restart.

Still failing in software graphics? On Windows: update Windows and your graphics driver. On Mac: update macOS. Then restart the computer and open the app again.

## "The preview did not finish loading within 25 s"

A scene may be stuck in an endless loop, or the video is very heavy. Click **Fix with Claude**, or **Reload** to try again.

## Errors and warnings

- An error box on the picture: **Reload**, or **Fix with Claude**.
- A preview warning bar under the picture says what went wrong: click **Fix with Claude**, or its **X** to hide it. The same list is under **Preview warnings** in the left panel (**Clear** empties it).

## Slow or choppy

- **Preview quality** (gauge menu next to the playback speed): **Half** or **Quarter** plays in real time on slow computers; **Auto** drops by itself while playing. Also in **Settings > General > Preview quality**.
- 3D reconstruction videos: **Graphics** > **Fast preview**, a lower **Render scale**, or a **Frame rate cap**.
- Exports, saved frames and Claude's frames are not affected: they stay full size.

## Other messages

- A shot that freezes in the preview recovers by itself within about 20 seconds; no need to restart the app.
- "Reloading preview" in the top bar, or **Updating** on the picture: a change is loading. It swaps in by itself.
- "The GPU reset the preview. Reloading it.": it reloads by itself.

Still wrong? Click **Help** at the bottom of the sidebar, then **Report a problem**. **Copy diagnostics** (in **Settings > General**, under Workspace) copies details you can paste into your report.

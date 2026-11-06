# Graphics: graphics card, Safe display or software (black preview, dark window, WebGL error)
keywords: graphics, graphics card, gpu, webgl, can't create webgl, error creating webgl context, black preview, preview black, preview blank, preview not showing, software, software graphics, automatic, safe display, swiftshader, driver, old driver, opencore, opencore legacy patcher, old mac, restart for software graphics, restart now, remote desktop, slow export, exports slow, keep software graphics, try the graphics card again, dark window
platforms: both

**Settings > System > Graphics** sets how the preview and your videos are drawn.

## Options

- **Automatic** (default): the graphics card. Fastest.
- **Safe display** (Windows only): for a window that stays dark or empty. 3D previews and exports still run on your graphics card at full speed; only the window is put on screen another way.
- **Software**: slower (previews **and exports** are drawn by the processor), but works on graphics the app can't use (like an old or broken graphics driver on Windows, or an older Mac with OpenCore Legacy Patcher).

Pick **Safe display** if the app window stays dark. Pick **Software** if the preview says it can't create WebGL, or stays black.

The line under it says what runs now: "Running on the graphics card.", "Running in Safe display: 3D on the graphics card, the window shown in software.", "Running in software graphics: previews and exports are drawn by the processor, so they are slower." or "Running on the graphics card, but it gives no 3D (WebGL)."

## A change needs a restart

After you switch, it says "Restart the app to use …" with **Restart now**. The sidebar also shows **Restart for software graphics** (or **Restart for card graphics**) until you restart: click it to restart now.

## The app switched by itself

If the graphics card can't start the 3D preview, the app switches to software for the next start and says so once ("This computer's graphics can't draw the 3D preview, so the app switched to software graphics…"). Click **Restart now**. Settings then adds: "The app switched to software by itself because the graphics card could not start the 3D preview."

If the window stayed dark, the app (or the Toon Studio Launcher) switches to Safe display on Windows, or to software graphics on a Mac, and Settings says so.

## After an update

- The first start after every update checks again that the window really shows, with fresh graphics caches.
- On software graphics, the app tries one faster mode once (Safe display on Windows, the graphics card on a Mac). Settings says "Trying Safe display after the update" while it does. If the window shows, it stays; if not, it goes straight back to software without asking.
- **Keep software graphics after updates** (shown when you're on software) turns that off.

## Tips

- Software is slower: lower **Preview quality** (Settings > General) if the preview lags.
- Updated your graphics driver? Click **Try the graphics card again** (or pick **Automatic**) and restart to use the card again.
- Still black in every mode? Click **Help > Report a problem** so it gets fixed.

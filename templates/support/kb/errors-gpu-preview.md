# Graphics and preview errors
keywords: black preview, blank preview, preview not loading, webgl, graphics, gpu, graphics card, software graphics, switched to software, restart now, 3d preview, preview failed to load, preview warnings, fix with claude, sound events, stopped responding, dark window, empty window, window stays black, black screen, rescue, safe display
platforms: both

## The whole app window stays dark or empty
What it means: on some graphics cards the app runs but its window never shows on screen (one flat dark rectangle, no buttons).

Fix:
1. Wait a minute: the **Toon Studio Launcher** watches every start. On Windows, when the window looks dark it asks in its own small window, **Is Toon Studio's window dark or empty?**: click **It's dark: fix it** and it restarts Toon Studio in **Safe display**. If it's still dark it tries software graphics next.
2. The app also checks this itself after every update. On Windows a Windows message may ask **Is the Toon Studio window dark or empty?**: click **It's dark or empty - fix it**. The app restarts in **Safe display** (3D still runs on your graphics card, full speed). Opening the app again while the dark window is open also brings up that question.
3. Still dark, or no launcher yet? Open **Toon Studio Launcher** yourself (Windows: Start menu; Mac: Applications) and click **Open**, or run the rescue command. It closes Toon Studio, updates it and starts it in a mode that shows. Projects, settings and the Skool login are not touched.
   - Windows (PowerShell): `irm https://raw.githubusercontent.com/therussellchris/Toon Studio/main/rescue.ps1 | iex`
   - Mac (Terminal): `curl -fsSL https://raw.githubusercontent.com/therussellchris/Toon Studio/main/rescue.sh | bash`
4. Still dark on Windows: close it and run `$env:CZ_RESCUE='software'; irm https://raw.githubusercontent.com/therussellchris/Toon Studio/main/rescue.ps1 | iex` (software graphics: slower, always shows).
5. After a graphics driver update you can go back to full speed: **Settings > System > Graphics > Try the graphics card again**.

## Stuck on software graphics (slow previews and exports)
Software graphics draw previews **and exports** with the processor, so both are slower. You don't stay on it: after each update the app tries one faster mode once (Safe display on Windows, the graphics card on a Mac) and keeps it if the window shows. If not, it goes straight back to software without asking.

To go faster now: **Settings > System > Graphics** > **Safe display** (Windows: 3D stays on the graphics card, full speed) > **Restart now**. To stay on software after updates, turn on **Keep software graphics after updates** there.

## The app switched to Safe display
What it means: the app's window stayed dark on this computer, so it now shows the window a safer way. 3D previews and exports still run on the graphics card. It's in **Settings > System > Graphics**.

## The app switched to software graphics
> This computer's graphics can't draw the 3D preview, so the app switched to software graphics (slower, but works on unsupported graphics). Restart the app to use them.

What it means: the graphics card could not start the 3D preview, so the app changed the setting for you.

Fix: click **Restart now** in that message (or restart the app yourself).

## The graphics could not start the 3D preview
> Your computer's graphics could not start the 3D preview. Switch to software graphics...

Fix:
1. Open **Settings > System > Graphics**, pick **Software**.
2. Click **Restart now**.

## Even software graphics fail
> Your computer could not start the 3D preview, even with software graphics.

Fix:
1. On Windows: install Windows updates and update your graphics driver. On Mac: update macOS.
2. Restart the computer, then open the app again.
3. Still failing? Click **Help > Report a problem** so it gets fixed.

## Preview failed to load
> Preview failed to load: ...

What it means: a scene of this video has an error, so the preview can't start.

Fix: if the editor shows red lines under **Preview warnings**, click **Fix with Claude** there. Otherwise copy the message into the Claude panel and ask Claude to fix it.

## Every frame has an error
> The scenes threw an error at every requested time. Check the preview warnings.

Fix: click **Fix with Claude** under Preview warnings, then try again.

## A scene stopped while collecting sounds
> A scene stopped responding while the sound events were collected ...

Fix: ask Claude to check the scenes for a loop that never finishes, then run the step again.

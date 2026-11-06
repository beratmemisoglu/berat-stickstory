# Toon Studio Launcher (dark window fix, update, go back to an older version, repair)
keywords: launcher, Toon Studio launcher, window didn't show, dark window, black window, won't open, app won't start, go back, older version, previous version, downgrade, roll back, rollback, revert version, undo update, bad update, repair, reinstall, fix install, missing tools, updates paused, resume updates, install update mac, copy diagnostics
platforms: both

The **Toon Studio Launcher** is a small helper the installer puts next to Toon Studio (Windows: Start menu > **Toon Studio Launcher**; Mac: **Applications > Toon Studio Launcher**). Toon Studio also installs it by itself if you installed before it existed.

## It fixes a window that doesn't show, by itself

Every time Toon Studio starts, the launcher watches the start. You don't see it when all is well.

- **Windows:** it also looks at the window from the outside. If the window looks dark or empty, it shows its own small window, **Is Toon Studio's window dark or empty?**: click **It's dark: fix it** and it restarts Toon Studio in **Safe display** (your previews and exports stay on your graphics card, full speed). Still dark: it tries software graphics next. When it is sure (the start froze, or closed by itself twice), it shows **Toon Studio's window didn't show** with a countdown and fixes it by itself.
- **Mac:** it steps in when a start freezes or closes by itself, and restarts Toon Studio in software graphics.
- **It's showing**: the window is fine; it doesn't ask again until the next update. **Wait**: it asks again in a minute.

Your projects are not touched.

## Open it yourself

Open **Toon Studio Launcher** when Toon Studio won't start, or to:

- **Open**: starts Toon Studio and watches that it shows.
- **Update to …**: installs the newest version (Toon Studio closes and opens again). On a Mac this is also what **Install now** in Toon Studio does, so there is no dragging into Applications.
- **Go back to an earlier version**: if a new version gives you trouble. Pick a version; Toon Studio closes, that version is installed and opens. Your settings and database from when you last used that version come back (today's are kept as a copy). On Windows, updates pause until you click **Resume updates** in the launcher (Settings > Updates then says automatic updates are off). On a Mac nothing updates by itself anyway: **Update** in the launcher brings you back to the newest.
- **Graphics card**: shows the graphics mode; on software graphics, **Try Safe display** (Windows) or **Try the graphics card** (Mac) starts Toon Studio in the faster mode and puts it back if the window stays dark.
- **Tools it needs**: shows whether git, ffmpeg, Python, Node.js and Claude Code are found, with **Repair** when something is missing.
- **Repair**: checks everything Toon Studio needs (git, ffmpeg, Python and its packages, Node.js, Claude Code, the app) and puts back what is missing, the same as running the install command again. On a Mac without Homebrew it tells you to run the install command in Terminal once (Homebrew needs your Mac password).
- **Copy diagnostics**: copies your versions, graphics settings and recent log lines. Keep them private; paste them only when someone in the community asks.
- **Report a problem**: copies a short report with your version and system and opens the community, so you can paste it into a new post.

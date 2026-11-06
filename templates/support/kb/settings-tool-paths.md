# Tool paths (the app can't find a tool)
keywords: tool paths, path, paths, not found, can't find, installed but not found, where is ffmpeg, ffmpeg path, python path, git path, claude path, codex path, parakeet, parakeet folder, executable, exe, location, homebrew, brew, opt homebrew, where.exe, which, binary not found, not on path
platforms: both

**Settings > System > Tool paths** tells the app where a tool is. Only needed if the app can't find it by itself (System check says "Not found" although you installed it).

## Fields

- **claude**: Claude Code.
- **codex**: Codex, for ChatGPT.
- **git**, **ffmpeg**, **python**.
- **parakeet**: only if you run your own Parakeet: its install folder.

An empty claude or codex field shows "Found automatically: …" with the path it uses.

## Fill one in

1. Find the tool's full path:
   - On Windows, in PowerShell: `where.exe ffmpeg` (or `where.exe claude`, `where.exe python` …)
   - On Mac, in Terminal: `which ffmpeg` (or `which claude`, `which python3` …). Homebrew tools are often in /opt/homebrew/bin, e.g. /opt/homebrew/bin/ffmpeg.
2. Paste the path into the field and click outside it. It saves ("Saved.").
3. Click **Run checks** at the top of Settings.

Clear a field to go back to finding the tool automatically.

Nothing printed by `where.exe` / `which`? The tool isn't installed: see "System check and missing tools".

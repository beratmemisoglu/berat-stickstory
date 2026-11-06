# System check and missing tools
keywords: system check, run checks, missing, not found, red dot, yellow dot, install, copy install command, git, ffmpeg, python, python packages, node, node.js, claude code, tools missing, can't revert, export no audio, audio pipeline disabled, intro edits, homebrew, brew, winget, setup, health, preview server, path problem
platforms: both

**Settings > System > System check** lists everything the app needs. A missing tool only switches off the steps that use it. Click **Run checks** (top of Settings) to check again.

## A line says "Not found"

1. Click **Copy install command** on that line.
2. Run it (On Windows: in PowerShell / On Mac: in Terminal), then click **Run checks**. Still "Not found"? Restart the app.

| Line | What you see if missing | On Windows (PowerShell) | On Mac (Terminal) |
|---|---|---|---|
| Claude Code | Claude Code is not installed | `irm https://claude.ai/install.ps1 \| iex` | `curl -fsSL https://claude.ai/install.sh \| bash` |
| Git (edit history) | Not found: edits cannot be reverted | `winget install --id Git.Git -e` | `xcode-select --install` |
| ffmpeg (export) | Not found: export cannot add audio / mux | `winget install --id Gyan.FFmpeg -e` | `brew install ffmpeg` |
| Python (audio) | Not found: audio pipeline disabled | `winget install --id Python.Python.3.12 -e` | `brew install python` |
| Node.js (intro edits) | Not found: Claude cannot render edited intros | `winget install --id OpenJS.NodeJS.LTS -e` | `brew install node` |

On a Mac, ffmpeg and Python install with Homebrew. No Homebrew yet? Get it from brew.sh first.

## Other lines

- **Python packages**: "Missing …" with an **Install** button: click it. If it says **Install (~2 GB with PyTorch)**, that download is large.
- **Claude Code** "Not signed in": see "Claude not installed or not signed in".
- **Transcription**: see "Transcription setup (word timing)".

## Installed, but still "Not found"

Tell the app where the tool is in **Settings > System > Tool paths** (see "Tool paths").

## Still red?

In **Settings > General > Workspace** click **Copy diagnostics**, then click **Help > Report a problem** so it gets fixed.

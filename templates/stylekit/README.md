# Toon Studio Style Kit

This folder is where you build your own Toon Studio video styles with Claude Code. It holds Toon Studio's real engines,
the same checks the app runs, and the instructions Claude follows. When a style is ready, Claude packs it into one file
and you import it in Toon Studio (Styles > Custom > Import style).

The full guide is **Toon Studio Style Kit Guide.pdf** in this folder (also `docs/GUIDE.md`). The kit is part of your
Toon Studio membership and is for building styles for Toon Studio: read **TERMS.md** (short).

## Start in 3 steps

1. Put 1-3 reference videos or pictures of the look you want into the `refs` folder (create it if it isn't there).
2. Open a terminal in this folder and start Claude Code:
   - Windows (Terminal or PowerShell): `cd "<path of this folder>"`, then `claude`
   - Mac (Terminal): `cd "<path of this folder>"`, then `claude`
3. Tell Claude what you want, for example:
   ```
   Study the videos in refs/ and make a style called Midnight Files on the recon base, 16:9 and 9:16.
   ```

Claude shows you frames to approve along the way. When you're happy, say "Package it" and import the file from `dist/`.

## The kit commands (Claude runs them; you can too)

| Windows (PowerShell) | Mac (Terminal) | What |
|---|---|---|
| `.\cz doctor` | `./cz doctor` | checks that everything the kit needs is there |
| `.\cz list` | `./cz list` | your styles |
| `.\cz preview <style> sample` | `./cz preview <style> sample` | plays a style's sample |

## What's in here

| Folder | What |
|---|---|
| `styles/` | your styles, one folder each |
| `dist/` | packages ready to import |
| `refs/` | your references (never put into a package) |
| `bases/`, `tools/`, `docs/` | the engines, the kit commands and the instructions (don't edit) |

Getting the kit again from Toon Studio into this same folder refreshes the engines and keeps `styles/` and `dist/`.

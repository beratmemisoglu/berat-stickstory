# Toon Studio: Toon Studio 0.20.0 without its window

This folder runs Toon Studio's own main-process code (`appcore/main/index.js`, copied from the app) as a library:
its project setup, CLAUDE.md writer, voiceover, Clean and time, sound design, mix, export, Claude task runner (prompts,
crew agents, hooks, tools) and every Claude tool. Only the app's window is replaced: its hidden render windows are pages
of a headless Chrome (`appcore/load.cjs`). So a video made here is made exactly as in the app, for every style.

## Make a video (the app's flow, step by step)

All commands: `python studio.py ...` from this folder (`python studio.py help` lists them). Long ones (run, export,
voice) take minutes to hours: run them in the background.

1. `python studio.py new <name> --style <id> [--length 60] [--format vertical|landscape] [--lang en] [--look <preset>]
   [--topic "..."] [--brief "..."]` - styles: `python studio.py styles`; looks: `python studio.py looks <style>`.
2. Script: `python studio.py run <name> script --notes "<topic, angle, notes>"` (the app's Write the script: research,
   research.md, script.txt), or write `script.txt` yourself (## sections, [notes] on their own line).
3. `python studio.py voice <name>` - ElevenLabs with the owner's voice settings (appdata/config.json "voice"); it cleans
   and times the words right after (autoTime). Own recording: `--provider file --file <path>`. Re-time only:
   `python studio.py audio <name>`.
4. Build: `python studio.py run <name> build --level <standard|props|polish|scenes|ultra|ultraplus> [--notes "..."]`
   (levels of a style: `python studio.py levels <name>`; the app's default is the owner's pick, Ultraedit for the best).
   This is the app's Build: the same request text, the same model and effort rules (Ultraedit on Opus), the crew
   agents, the frame budget, the tools.
5. Changes: `python studio.py run <name> edit --notes "<what to change, where (time / shot)>"`; questions: `run <name> ask`.
   An Ultraedit pass on a finished video: `run <name> ultra`.
6. `python studio.py sound <name>` (music and effects; export also runs it when needed), then
   `python studio.py export <name> [--stems]` -> the project's `out/<name>.mp4`.

A silent video (no voice, no music): skip `voice`; write `audio/timeline.json` + `audio/script_timed.txt` yourself with
the shots' cue lines and their times, a silent `audio/clean.wav` of the length and `end` in project.json, then
`run <name> build` (tell it the lines are timing cues only) and `export <name> --silent` (no sound track; the app
itself refuses a silent soundtrack).

## Custom styles (the app's Style Kit) and dmscales

- `python studio.py kit [folder]` writes the app's Style Kit (now at `C:\Users\berat\ToonStudio-Projects\Toon Studio Style
  Kit`); build styles there with its own CLAUDE.md and `cz` (`./cz check|stills|export|package <style>`).
  `python studio.py import-style <zip>` runs the app's import checks and adds the style; `styles` lists it, `new --style
  custom-<name>` uses it.
- **dmscales** (`custom-dmscales`): whiteboard explainers reverse-engineered from @dmscales (research and measurements in
  `C:\Users\berat\ToonStudio-Projects\research\dmscales\reports`). Source: `...\Toon Studio Style Kit\styles\dmscales` (git;
  REVIEW.md = review log + sign-off); package `...\dist\custom-dmscales.zip`. Looks: Clean (later videos) and Hit (the two
  most-viewed videos: bold italic, #fcfcfc); control `era`.
- A dmscales video: `new <name> --style custom-dmscales [--look custom-dmscales-hit]`, the member's voice with
  `voice <name> --provider file --file v.wav` (+ their `script.txt`), their screenshots and clips with
  `node <project>\.claude\skills\style-custom-dmscales\scripts\add_media.mjs <project> <files...>`, then `run <name> build`:
  the build writes `edit-plan.md` (the direction) from the narration and the files first, then the scenes.

## Working on a project yourself in this session

`python studio.py use <name>`, then reconnect the `suite` MCP server (/mcp): its tools are the app's own for that
project's style (render_frames, check_preview, check_layout, list_shots, narration, make_image, make_sprites, web_image,
lowpoly_asset, enrich_frame, library_*, ...). Read the project's own CLAUDE.md and its skill
(`<project>/.claude/skills/<skill>/SKILL.md`) first and follow them. For whole builds prefer `run`: it is the app's
exact procedure.

## Where things are

- Workspace (projects, suite.db, library, STYLE.md): `C:\Users\berat\ToonStudio-Projects` (outside this folder on
  purpose: a CLAUDE.md above the projects would leak into the app's own Claude runs).
- `appcore/` the app's code + `load.cjs` (the stand-in for Electron) + `cli.cjs` + `mcp.cjs` + `fixes.cjs` (fixes the
  app lacks, applied to a project's own engine.js by every cli command: the stickstory/toon video encoder fallback for
  "OperationError: Encoding error" on export); `appdata/` the app's data
  folder (config.json: voice, sound, Claude, tool paths); `templates/` the style engines and skills; `kit/` + `blender/`
  the Blender engine and Blender 5.2.3 (linked into appdata/ and templates/ where the app looks for them).
- Google Flow (free pictures): the app's Flow Chrome profile, linked in appdata/flow-chrome. Sign-in or a robot check:
  the owner runs `python studio.py flow-open` and finishes it in that window (never do it for them).
- Keys come from environment variables, never files: ELEVENLABS_API_KEY, HIGGSFIELD_API_KEY, FAL_KEY, FISH_AUDIO_API_KEY.

Never edit `appcore/main/index.js`, `templates/`, `kit/` or `blender/`: they are the app's.

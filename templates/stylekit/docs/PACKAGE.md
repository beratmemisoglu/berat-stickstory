# The package: what goes to the app, what the app checks, versions and engine updates

`cz package <style>` turns `styles/<name>/` into `dist/<id>/` and `dist/<id>.zip`. The member imports the zip in
Toon Studio (Styles > Custom > Import style). This file says what is inside, what the app does with it, and how versions
and engine updates work.

## What is inside

```
<id>/                       (in the zip: this folder at the root, or its files directly at the root)
  style.json                the manifest (schema 2) + the "kit" block
  engine/                   engine.js models.js lib/ fonts/ vendor/ [sprites/ assets/]: the style's own engine
  skill/                    STYLE_GUIDE.md QUALITY.md PITFALLS.md (+ any other .md): the style skill of every project
  skill/base/               the base skill (engine_api.md etc.) as it was at the engine the style is built on
  looks/<look-id>.json      at least one look
  sample/views.json         { narration: { timeline, script }, views: { sample, hero, kit, mustfail_*: { expect } },
                              images: { <key>: "assets/<file>" } }   (project.json "images", relative to sample/)
  sample/scenes/*.js        the views' scenes (sample + hero + kit + >= 1 must-fail)
  sample/timeline.json      the narration timing [{ s, e, text, words: [{ w, s, e }] }]   sample/script.txt
  sample/assets/            pictures the sample scenes use
  reference/ANALYSIS.md     what the style was measured from (never the member's reference files)
  CREDITS.json              [{ file, source, licence, author }] for every asset not from the base
  preview.mp4 poster.jpg    made by cz package
  FIXES.md                  only when the app's Claude changed something (what + why)
```

Where each part comes from in the style folder: the engine files at the style's root go to `engine/` (never a Mixamo
file; a base file of a type packages may not hold, like 3D reconstruction's QA pages `lib/holdview.html` and
`lib/propview.html`, stays out while it equals the style's own base snapshot `.cz/base-engine/` or this kit's base, so a
newer kit never makes an untouched style fail); `skill/`, `looks/`, `CREDITS.json`, `reference/ANALYSIS.md`, `FIXES.md` as they are; the views in `project.json`
with their scene files, `audio/timeline.json`, `script.txt` and `assets/` go to `sample/`, and project.json `"images"` (the
pictures the host page loads for `image()` / `IMG[]`) into sample/views.json `images`: only entries whose picture is in
`assets/` (an entry without its file is left out with a medium `sample` finding). `skill/base/` is the base
skill the style was built on (`.cz/base-skill/`). An empty `prompts.qualityBar` is filled from QUALITY.md's "The bar".
Nothing else is packaged: not `refs/`, not the rest of `reference/`, not `REVIEW.md` or `review/`, not `.cz/`,
`.rebase/` or `out/`, not `.git/`.

The `kit` block (written by `cz package`, read by the import):
```json
"kit": { "kit": 1, "app": "0.14.0", "host": "<sha1 of the host page>", "base": "flat", "baseEngine": 7, "built": "2026-10-16T12:00:00Z" }
```
`from` = `{ style: <base>, engineVersion: <baseEngine> }`. The id is `custom-<slug>`. The app rewrites the fields it owns
on install (`version`, `official`, `aliases`, `studio`, and the id when it clashes).

## Limits (refused before anything else is read)

Total <= 200 MB unpacked; one file <= 50 MB; <= 4000 files; no symlinks; no absolute paths, `..`, drive letters or NUL in
names. Only these extensions: `js mjs json md txt png jpg jpeg webp gif svg glb gltf bin ktx2 hdr exr ttf otf woff woff2
wav mp3 ogg m4a mp4 webm csv`. Left out with a plain warning: `.env*`, files named like `*key*` / `*secret*` / `*token*`,
`.git/`, `node_modules/`, `out/`. Refused: names matching `mixamo` or the known Y Bot file (licence: Mixamo files are
never shipped).

## What the app does with it

1. Unpacks it and runs the static checks (the same `static.mjs` as `cz check`).
2. Runs the render checks in hidden render workers, in every declared aspect.
3. Shows a checklist with live status and every finding as finding -> meaning -> fix (docs/CHECKS.md), with:
   - **Let Claude fix it:** a Claude inside the app that can touch ONLY this style's files (engine.js, models.js, lib/,
     scenes, skill/, looks/, style.json; never the check code, which is hash-locked, never anything outside the style).
     After each round the app re-runs every check itself. At most 3 rounds; then it shows what is left. Every change is
     written to FIXES.md.
   - **Copy fix list:** the open findings as text, to paste into Claude Code in the kit.
4. When nothing high is open: **Add to my styles**. The style appears everywhere at once: New project (Custom styles),
   Routines, the Look panel, Project settings, Ultraedit, reframing between 16:9 and 9:16.

Custom styles are a Premium feature: the import page is there only on Premium.

## Versions: the style and every project keep what they were made with

- **A custom style owns its engine.** App updates never touch it. It was built on base engine `from.engineVersion`.
  When the app's base engine is newer, the style card says so; moving to it is the member's choice (below).
- **Re-importing the same id makes a new version** of that style: `version = max(installed + 1, manifest.version)`,
  `ENGINE_VERSION = max(installed engine + 1, package engine)`. The previous version is kept (the last 3); the style card
  offers **Go back to vN**, which installs that version again as the next number (going back is a new version too).
- **A project keeps the style version it was made with**: its engine is its own copy, and its skill, prompts and looks come
  from its own snapshot of the package, never from the installed one. When a newer version is installed, the editor
  shows **"<Style> vN is available - Update"**. Update changes the engine and the snapshot together in one save point, so
  History can undo it. It is never automatic, not even when a project is imported.
- **Built-in styles** update with the app as always.
- **The shared runtime** (the host page, the server routes, the render workers, the pipeline scripts, the base's sound
  pass, the shared libraries for low poly assets, animations and uploaded characters) is the app's and is not pinned.
  The app keeps every custom engine working with it: it changes only by adding, and frozen packages of every base and
  engine version are re-checked before every app release.

What this means for the style: never rely on an accident of the current runtime (an undocumented global, a route that
happens to exist); use only what the base API documents.

## Moving to a newer base engine (`cz rebase`)

The member asks for this when the style card says "engine update available" and they want what the new engine brings.
First get a fresh kit from the updated app (Styles > Custom > Get the Style Kit, same folder) so `bases/` holds the new
engine.

Three versions of the engine are involved:

| Name | Where | What it is |
|---|---|---|
| old base | `styles/<name>/.cz/base-engine/` | the base engine the style was built on |
| new base | `styles/<name>/.rebase/` | the base engine of this app, put there by `cz rebase <style>` |
| ours | `styles/<name>/` (engine.js, models.js, lib/ ...) | the style's restyled engine |

Steps:
1. Make a save point of the style first (`git add -A && git commit` inside `styles/<name>/`; `git init` once if it has none).
2. `cz rebase <style>`. It prints both versions and what it put in `.rebase/`.
3. See what each side changed (inside `styles/<name>/`): `git diff --no-index .cz/base-engine/engine.js .rebase/engine.js`
   (the app's changes) and `git diff --no-index .cz/base-engine/engine.js engine.js` (the style's). Same for models.js
   and every lib file `cz rebase` listed as changed.
4. Merge file by file with a real 3-way merge, on the style's files:
   `git merge-file engine.js .cz/base-engine/engine.js .rebase/engine.js` (writes the result into engine.js, conflicts
   marked `<<<<<<<` / `>>>>>>>`). Resolve every conflict by keeping the style's look values (palette, fonts, DEFAULTS
   values, its added elements and checks) and the base's new behaviour (fixes, new exports, new options). Files only the
   base changed: take the new base's. New base files: copy them in. `vendor/`: take the new base's as a whole.
5. Keep every export either side has. Set `ENGINE_VERSION` above both the style's previous number and the new base's.
6. `cz rebase <style> --done`: the new base becomes the style's recorded base (`.rebase/` replaces `.cz/base-engine/`,
   `from.engineVersion` and the base skill snapshot are updated, so the next package says "built on <Base> engine vN").
7. `cz check <style>`: everything as before, every must-fail still firing. Render the same stills as before the rebase
   (hero, kit, sample at the same times, `--scale 1`) and compare them side by side: the look must not change unless the
   member wanted it.
8. `cz package <style>` and re-import: a new version, and projects in the style get the Update offer.

When a conflict can't be resolved without changing the look, stop and show the member the two options with frames.

**No snapshot of the old base** (`.cz/base-engine/` missing: a style imported from a package built on an engine version
this kit doesn't have; `cz import-package` says so): `cz rebase` warns, puts the kit's base in `.rebase/` and lists every
file where the style differs from it. Each difference is either the style's change or the base's: read them and merge by
hand (keep the look, take the behaviour). Better: copy `.cz/base-engine/` back from the style's old folder
(`styles/.replaced/...`) and run `cz rebase` again for a real 3-way merge. `--done` records the kit's base as the new
snapshot either way.

## The round trip: fixes made in the app come back to the kit

When the app's Claude fixed something during the import, the installed style is no longer the same as `styles/<name>/`.
Bring it back before changing anything else:
1. In the app: the style card > **Export package** (a zip).
2. In the kit: make a save point of the style (`git add -A && git commit` inside `styles/<name>/`), then
   `cz import-package <zip> --replace`. The package becomes `styles/<name>/`; the folder you had moves to
   `styles/.replaced/<name>-<stamp>/` (it prints the path).
3. A package carries only what ships, so bring the kit-only parts back from the kept folder: `.git/` (your save points),
   `REVIEW.md`, `review/`, the measurements in `reference/` (not ANALYSIS.md: the package's is current). If the import
   says there is no snapshot of the engine the style was built on, bring `.cz/base-engine/` back too.
4. With `.git/` back, `git status` and `git diff` show exactly what the app's Claude changed; `FIXES.md` says why. Add
   each lesson to `skill/PITFALLS.md`. If you had changed the same lines in the kit after the last package, merge your
   version from the kept folder by hand now. Commit.
5. Continue as usual; the next `cz package` and import becomes the next version.

`cz import-package` also takes a package from someone else (a folder or a zip): read every file before you build on it,
check its CREDITS.json, and run `cz check` first. `--as <name>` imports it as a NEW style: folder `styles/<name>/`, id
`custom-<name>`, version 1, `created` now, none of the original's aliases, its looks' `"style"` rewritten to the new id
(the name too, when it was the default one). Without `--as` the package keeps its id: that is the round trip of the same
style, and the next import in the app is its next version.

## The manifest fields that change what the app does

| Field | What it does in the app |
|---|---|
| `name`, `tagline`, `description` | the style card and New project; the description also opens the style skill |
| `aspects` | the formats New project offers and the format switch (16:9, 9:16 or both) |
| `dim` | 2D or 3D (starter-based styles); seeds the right default look |
| `controls` (`keep`, `add`, `remove`) | the Look panel: the base's controls, minus `remove`, plus `add` (an added control with a base control's path replaces it) |
| `defaults` | the settings a new project starts with; they beat the base's default look, so this is where the style selects its theme and sets post, camera and captions values (engine `DEFAULTS` are only read for keys no look sets) |
| `capabilities.needsImageKey` | New project and the build ask for an image service (styles whose videos need generated pictures) |
| `capabilities.reframe` | the video can be reframed between 16:9 and 9:16 (needs both aspects; `prompts.reframe` is told then) |
| `render.smooth` | smooth scaling for 4K / GIF output (false only for hard-pixel looks) |
| `audio.music`, `audio.lufs` | music beds (`beds`), none (`none`) or the member's own music (`user`); the loudness target |
| `checks.layout` | whether the layout check runs for projects in the style |
| `prompts.build` / `context` / `qualityBar` / `reframe` / `imageStyle` / `ignoreBaseRefs` | what every video in the style is told (METHOD.md stage 7) |
| `fonts.charsets` | the character sets the style's fonts cover (the fonts check verifies them) |
| `defaultLook` | the look new projects start with |

Leave `id`, `version`, `official`, `aliases`, `studio` and the `kit` block to `cz package` and the app.

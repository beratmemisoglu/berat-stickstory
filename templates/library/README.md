# templates/library - the built-in seed of the Library

The read-only, shipped half of the Library (plan: `docs/LIBRARY_PLAN.md`). Members' own entries live in
`<workspace>/library/` with the same layout; the app indexes both (files are the truth, the DB is a rebuildable index).
This first seed (step L3) is a hand-curated harvest of the three shot-match scenes in the owner's PREVIEW workspace
(`cafe-shot-match`, `recon-dig-escape`, `recon-prison-tunnel`) and their two method logs.

## Layout

```
templates/library/<kind>/<id>/
  entry.json        the card (schema below); files[] / versions[] hashes are filled by the seal step
  preview.jpg       640 px wide still (modules, recipes, looks, poses); know-how entries have none
  v1/               the immutable version folder; this is what library_use copies to <project>/library/<id>/
    index.js        module entry (modules)          scene.js + settings.json  (recipes)
    proof.js        a minimal recon SCENE that uses the entry (renders clean = the entry works)
    settings.json   look / recipe settings          pose.json  pose data
```

`<kind>` is the first id segment: module, recipe, look, pose, solution, pitfall (and later model, material, texture,
image, sprite, font, sound, anim, check). Folder name = the full id.

## Ids

`<kind>.<base>.<slug>` matching
`^(model|module|material|texture|image|sprite|font|sound|anim|pose|recipe|look|solution|pitfall|check)\.(any|recon|lowpoly|flat|collage|stickman|pixel-art|starter|custom-[a-z0-9-]{1,40})\.[a-z0-9-]{1,48}$`.
`any` = engine-independent (imports only `THREE` from `engine.js`, which every Toon Studio engine exports); a base name =
needs that engine's own `lib/` (e.g. `recon` modules use `lib/crime.js`, `lib/figures.js`, `lib/crimeover.js`).
Know-how scope letters map the same way: G -> `any` (scope global), R -> the base (scope `base:<base>`), I never harvested.

## Module contract

- A module is a folder with `index.js`. In a project it lives at `<project>/library/<id>/index.js`, so:
  - the engine is `../../engine.js` (the project root's engine.js), the base kit is `../../lib/<file>.js`;
  - another library module is `../<other-id>/index.js` (it must be in `requires`, so library_use copies it too);
  - nothing else: no absolute paths, no `../../scenes`, no network, no project-specific files (`world.js`, assets).
- A scene imports a module as `../library/<id>/index.js` (scenes are `<project>/scenes/<name>.js`).
- Modules build on call: no top-level side effects except lazily created, cached textures/materials (created on first
  use, after the engine is up). Every builder takes its parent and returns what it made (+ `solids` for S.collide where
  it matters). Hung or decorative parts carry `userData.noContact`, held props `noContact`, grounds `userData.ground`.
- Shader patches (`onBeforeCompile`) always set `customProgramCacheKey` from their parameters.
- Recipes: `v1/scene.js` is written by library_use to `scenes/<as>.js`; it imports only `../engine.js`, `../lib/*.js`
  and `../library/<module-id>/index.js` (all listed in `requires`). `v1/settings.json` carries the project settings the
  look was matched under: `theme` + `post` are part of the recipe (merge them into project.json `settings`);
  `graphicsAtMatch` is informational only (Graphics belongs to the user: never write `settings.graphics`).
- Proofs: `v1/proof.js` is a scene. Copy it to `scenes/<name>.js` with the entry (and its `requires`) installed under
  `library/`; a recipe's proof imports `./<slug>.js`, i.e. it expects the recipe installed with `as` = its slug.
  A proof must boot without errors, not be blank, and report 0 layoutIssues.

## entry.json

Fields follow the plan's schema: `schema, id, uid, origin (seed), kind, title, summary (<= 200), tags, engines
[{ base, min, max }], three, scope, status, version, versions[{ v, hash, at, note }], delivery (copy), files[{ path,
role, bytes, sha1 }], entry, exports, usage { import, example }, requires[], doc { when, avoid, gotchas[], params },
problem { symptom, cause, fix, detect, scopeLetter } (know-how only), preview, provenance[{ project, projectId, file,
lines, edit, session, at, by }], licence { id, author, source_url, credit_text }, metrics, related[], created, updated`.
Additions in this seed: `proof` (the proof scene inside the version folder), `proofRequires` (entries the proof needs
beyond `requires`), for recipes `settings` (settings.json) and `compare` (compare.jpg beside entry.json: the shot-match
sheet, reference | render, not copied into projects). `files[].path` is relative to the version folder ('index.js'), as
library_add writes it. File roles: `entry` (index.js / scene.js), `data` (settings.json, pose.json), `doc` (proof.js).
Every entry.json parses with `LibEntrySchema` (src/shared/library.ts).

## Verifying the seed

Every module proof and every recipe was rendered headlessly through `templates/host` in a throwaway recon project laid
out exactly as library_use would leave it (engine files from `templates/recon`, every `v1/` copied to
`library/<id>/`), with `layoutIssues` at t = 1.0 and 1.5. Re-run that after every recon `ENGINE_VERSION` bump
(`drive.mjs libraryseed`, step L3 of the plan, does it in the app).

# 3D cartoon shorts and the Blender engine
keywords: 3d cartoon shorts, cartoon, toon, blender, blender engine, engine, three js, eevee, solid, look, render in blender, install blender, blender not installed, blender missing, quality, standard, verified, ultraedit, slow export, export takes long, apple silicon, intel mac
platforms: both

**3D cartoon shorts**: big-headed 3D cartoon characters with faces that change on the words, in busy dressed sets.
In **New project**, pick the style, then **Engine**:

- **Three.js**: renders live in the app. Instant previews, quick exports.
- **Blender**: renders in Blender, which runs hidden. Richer light, depth of field, motion blur and denser sets
  (the look of the showcase shorts). You never open Blender yourself.

Both make **Vertical 9:16** or **Wide 16:9** (the **Format** switch).

## Blender: quality

Picked in New project, changeable in the **Build** dialog:

- **Standard**: one Claude session builds and checks every shot. The fastest and lightest on your Claude plan.
- **Verified**: adds a frame-by-frame check of every scene.
- **Ultraedit**: the studio method: several builders work at once, a critic reviews every shot, a second round
  fixes what it found. The best result, the most Claude usage. It runs on the model and effort picked for the
  project (Claude panel or Project settings); with none picked, Opus 5.5 at High.

## Blender: preview

Under the preview, **Solid** is a light, fast shading for scrubbing; **Look** shows the real light when the playhead
rests. Play runs from frames made in the background. Click a character or prop to select it for Claude.

## Blender: installing it

Toon Studio installs Blender itself the first time you need it (the official build from blender.org, about 400 MB,
once): **Install Blender** in New project, or by itself when you create the project or open its preview.
The preview starts when it's done.

**Mac**: Blender 5.2 needs a Mac with Apple silicon (M1 or newer). On an Intel Mac, use the Three.js engine.

## Blender: exporting takes longer

Blender renders every frame for real: on a fast graphics card a 1-minute short takes about 15-50 minutes (busy night
scenes are the slow end), on a laptop several times longer. Frames already rendered are kept, so exporting again
after a small change only renders the shots that changed.

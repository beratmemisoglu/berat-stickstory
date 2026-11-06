---
name: mega-informational
description: Build "3D Informational" videos in Toon Studio with the Blender engine - realistic megaproject explainers where every clause of the narration is one step of a giant engineering idea built on screen (machines dig, lift, wrap, drill, float), in realistic EEVEE (engine/mega.py - physical sky and hard sun, PBR rock / snow / steel / water, detailed hard-surface models, green see-through X-ray on the thing the narration names), with one calm, continuous camera move per shot. 9:16 (1080x1920) or 16:9. Use for every build, edit and Ultraedit of a "3D Informational" project (style id mega).
---

# 3D Informational on the Blender engine (mega-informational)

Realistic 3D explainers: "Could you move Mount Everest to America?" answered step by step on screen. Each clause is ONE
picture of one step - a trench being dug, drills cutting, a slab lifted, a platform built, a globe with a route. The thing
the words name glows in see-through green X-ray on its word. Machines are detailed hard-surface models (cabs with glass,
hoses, chrome rams, tracks with links, rails, bolts, decals), the world is lit by a physical sky and a hard low sun,
materials are PBR with Google Flow textures. The camera makes ONE calm, continuous move per shot (a push, an orbit, a rise, a
pull-back) that eases in and out; shots meet in plain cuts. The bar is the owner's own Blender short, rebuilt 1:1 in the lab,
and a second film made the same way: both are in `examples/` - read them before writing anything.

You write Python scene files that the app runs inside a hidden Blender. The engine (cz.py + mega.py, Flow textures in
assets/mega, the tools) is part of the app: never copy it into the project.

Read, in order:
- `references/sop.md` - THE PROCEDURE in the app, gate by gate
- `references/engine_api.md` - every mega.py call (generated from the engine), plus the cz primitives
- `references/camera.md` - THE CAMERA: the grammar, M.Flight, lenses, one calm move per shot (the owner's top priority)
- `references/models.md` - how a model reaches the bar (hard-surface detail, materials, instancing, speed)
- `references/enrich.md` - the enrich loop (every shot: previs -> enriched target -> build it for real)
- `references/qa.md` - the gates and the look numbers
- `PITFALLS.md` - every failure already made once, as rules
- `examples/everest/` (the 1:1 rebuild: SHOTS.md, common.py, props_a..d.py, e01-e32.py) and `examples/roof/`
  (a new film: house.py a staged hero model, props_r1/r2.py, r01-r27.py) - copy their PATTERNS (materials, models,
  flights, X-ray timing), never their content.

## The build, step by step
1. **Words.** `audio/script_timed.txt` / `audio/timeline.json`; `W = cz.words()`, `cz.at(W, 'word', n)`. Frame of a word =
   round(start x 30) + 1; frame 1 = 0.0 s.
2. **Storyboard (storyboard.md).** The big idea as a chain of steps; one shot per clause (~2 s), contiguous F0-F1 from
   frame 1 to the end. Per shot: the literal picture, what moves / is built on which word, what glows green on which word,
   the camera move. Recurring hero objects (the slab, the house) keep ONE design all film long (a staged model like
   examples/roof/house.py when it is built up over the film).
3. **The kit of this film.** common.py: materials (M.pbr / rock / snow_rock / steel / water / xray with Flow textures,
   make_texture for big surfaces), the hero models. props_*.py: machines and set pieces at the bar of models.md.
4. **Shots.** e01.py ... each `F0, F1 = a, b` and `build(ctx)`: `M.setup(F1, sun_elev=, sun_rot=, ...)`, the set, the
   motion baked per frame (M.bake_path / cz.bake / M.visible / M.xray_fade on the words), ONE camera
   `M.Flight(keys).bake(F0, F1)`. assemble.json `{"dir": "shots", "shots": [...], "dissolves": []}`.
5. **Check + look.** check_layout until Clean; render_frames start / middle / end of every shot (scale 0.5) and LOOK.
6. **Enrich** (references/enrich.md), then look again.

## Rules that never bend
- ONE camera per shot, always `M.Flight`; 18-35 mm; it never stops; one calm move per shot, no whips, no zoom transitions,
  no cuts inside a shot; no per-frame noise / shake.
- No plain boxes as machines; no empty ground filling the frame; every big surface textured.
- The named thing glows green ON its word (M.xray + M.xray_fade), not before, and fades out after.
- Numbers and labels as clean 3D text (M.text3d) or decals - never a 2D overlay slammed on.
- Frame cost: under ~1.5 s at full size (M.setup's defaults: 16 samples, no ray tracing, fast GI). Instancing for repeats.
- No music unless the user asks. Do not schedule sound effects in the scene files (no sound events in this engine yet).

## Banned in every style (the owner's no-slop rules)
- No red stamp / plaque / verdict overlays slammed on: show the fact as a real object.
- No notice that the voice is AI, ever, anywhere.

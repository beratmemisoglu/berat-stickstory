# SOP in the app (gate by gate)

What the app already did: the voice cleaned (audio/clean.wav), the words timed (audio/timeline.json,
audio/script_timed.txt), project.json "end" set, Blender installed and running hidden. You never open, install or call
Blender, never copy the engine, never render the final video.

| gate | you do | done when |
|---|---|---|
| 1 words | read script_timed.txt | you know every clause's frames |
| 2 storyboard | storyboard.md (steps, shots, X-ray words, camera moves) | shots tile frame 1 to the end, ~2 s each |
| 3 kit | common.py, props_*.py (models.md) | each model checked in a close render_frames still |
| 4 shots | e01.py ... + assemble.json | every shot builds (check_layout) |
| 5 look | render_frames start / middle / end of every shot | qa.md list passes on every still |
| 6 enrich | enrich.md on the key moments | the targets' extras are built for real |
| 7 polish | fix what the stills show; Ultraedit: a second full round | check_layout Clean again |

## Light (M.setup)
- `M.setup(F1, sun_elev=15-35, sun_rot=<deg>, sun_power=3-4, light_k=1.0-1.3, light_sat=0.55-1.0, haze=0-0.6)`.
  The camera sees a saturated physical sky; the scene is lit by a calmer copy (shadows stay neutral grey).
- Put the sun to the side or behind the subject at a low angle: long shadows and rim light. Snow wants bluer shadows
  (light_sat ~0.9-1.15). Interiors: area lights + emissive practicals (strength <= 1.5), darker ceilings.
- `samples=16`, no ray tracing: the budget. Screen-space reflections only for water / metal hero shots
  (`sc.eevee.use_raytracing = True; sc.eevee.ray_tracing_method = 'SCREEN'; sc.eevee.ray_tracing_options.resolution_scale = '4'`).

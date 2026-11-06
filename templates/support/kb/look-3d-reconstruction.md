# 3D reconstruction look settings
keywords: 3d reconstruction, reconstruction, documentary, clay, studio look, investigation, dark look, true crime, film grain, grain, grainy, noise, vignette, dark corners, too dark, contrast, desaturation, black and white, colourless, render quality, draft, supersampling, shimmer, flicker, ambient occlusion, shadows, real photos, footage, real maps, 3d models, brand colour, characters
platforms: both

Change these in the editor: **Look** button > change the setting > **Apply to project**. There are two looks:
**Studio** (bright clay, the default) and **Investigation** (dark and cinematic, for any topic).

- **Format**: Wide 16:9 or Vertical 9:16. Picked in New project, fixed afterwards.
- **Look**: **Studio (bright clay)** or **Investigation (dark)**.
- **Render quality**: **Final (2× supersampling)** (default): no shimmer on busy scenes, but slower. **Draft (1×)**
  is quicker for trying things.
- **Ambient occlusion** (on): soft contact shadows where surfaces meet.
- **Film grain** (0 to 0.08; Studio 0.014, Investigation 0.030). Studio allows at most 0.05.
- **Vignette** (0 to 0.6; Studio 0.07, Investigation 0.38). Studio allows at most 0.15.
- **Contrast** (0.8× to 1.5×; Investigation 1.2×): Investigation only.
- **Desaturation** (0% to 100%; 55%): Investigation only. Lower it for more colour.
- **Characters**: who plays each role. See "3D reconstruction characters".
- **Real photos and footage** (on): real photos and archive film from Wikimedia Commons, credited.
- **Real pictures per minute** (0 to 4, default 1).
- **Free 3D models from the web** (on): free models of real machines, vehicles and animals, artists credited. Off:
  everything is modelled by code.
- **Real maps of the places** (on): maps and terrain from OpenStreetMap and elevation data.
- **Brand colour** (Style default): your channel colour instead of the blue: chapter kickers, timecards, callouts,
  route lines and place dots.

To remove grain or dark corners, set **Film grain** or **Vignette** to 0.

## "Vignette must be 0-0.15" or "Film grain must be 0-0.05"

The Studio look is bright, so it caps these. Lower the slider, or switch **Look** to Investigation.

The real-media switches are also in the editor's **Project settings** and in New project.

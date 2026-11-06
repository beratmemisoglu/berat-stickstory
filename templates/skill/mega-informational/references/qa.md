# QA: the gates

1. check_layout says Clean (every shot builds; no camera issue).
2. render_frames start / middle / end of every shot at scale 0.5, and LOOK at each:
   - the clause shown literally (the step being done, on its word)
   - the green X-ray on the named thing on its word
   - models detailed (no plain boxes, bevels, materials with texture and wear)
   - light: a hard low sun with long shadows, a darker shade side, rim on silhouettes, specular on metal and water
   - the frame filled: the subject 50-80 % of the frame height, foreground / midground / background
   - the camera moving (compare the start and end frames: they differ)
3. The look numbers (the export grades toward them automatically): brightness ~98, saturation ~101, contrast ~58 on
   0-255 frames measured like the owner's reference. Too flat = a lower sun, darker fill (M.setup light_k 1.0-1.3).
4. Speed: a frame under ~1.5 s at full size (render_frames prints the time per frame).

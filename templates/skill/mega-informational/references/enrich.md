# The enrich loop (SOP for every shot)

1. enrich_frame(t, style, note) on the key moment of a shot (its widest framing): the app renders YOUR frame (the
   previs) and sends it with a showcase frame to the image service (Google Flow); it returns the SAME render, richer:
   hard-surface detail, debris, decals, lamps, atmosphere, better light. targets/<shot>_<frame>_enriched.png.
2. LOOK at the target: it must show YOUR shot (same camera, same objects). A different scene = a bad target: call
   enrich_frame again with a clearer note, never build from it.
3. Build every extra for real in your files: panel lines and bolts as geometry, decals for flat things (labels, stripes,
   signs), debris scattered with M.scatter, lamps as emissive parts, haze / clouds as cloud cards.
4. render_frames at that moment and compare with the target: density, light, contrast. Loop until ours carries it.
Standard: the 4-6 most important shots. Verified and Ultraedit: every shot.

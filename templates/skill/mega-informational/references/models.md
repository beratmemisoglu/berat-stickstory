# Models at the bar

The examples' props files are the bar: examples/everest/props_a.py (excavators: tracks with links + rollers, boom / stick
with hydraulic rams + chrome rods + hoses, a cab with tinted glass + frame + handrails + seat, counterweight, decals,
worn paint), props_b.py (lattice cranes with jibs + trolleys + cables, a magnet hall, site equipment: containers,
generators, cable drums), props_c.py (globe, sea, ballast tanks, a ship hull with deckhouse, lifeboats, masts),
props_d.py (a reactor hall with grating floors, walking crowds, an eagle with feather cards, a flag), examples/roof/
house.py (a hero model built in STAGES across the film) + props_r1/r2.py (trees from layered leaf clusters, cars, weather).

## How
- Many parts, each a cz primitive or a numpy mesh (M.heightfield, M.column for rock); bevel every hard edge
  (cz.box bevel= 0.02-0.04 of the size); join the parts of one model with `M.join(name, parts, apply=True)` (it bakes
  every part's bevel before joining: the old join kept only the first part's bevel and everything read as plastic).
- Materials: PBR with roughness 0.4-0.6 on paint, metal 0.15, a grime / dirt mix toward the bottom, darker crevices,
  tinted glass (roughness 0.05) with something behind it. Flow textures (assets/mega: basalt, snow, mountain_rock,
  dirt_dark, lava_cracks, steel_panels, earth_day, clouds, alaska_map, hazard, radiation_sign, roof_*) or make_texture
  for big surfaces.
- Repeats (columns, magnets, reactors, people, trees): build one, place linked copies (`o.copy()` keeping `o.data`) or
  join many into one mesh: fewer objects = a faster frame.
- Cut-out cards (clouds, leaves, feathers): a solid DITHERED material with an alpha clip; BLENDED transparency only for
  the X-ray and true glass (it sorts badly and ghosted bushes in the roof film).
- Scale: pick one (1 unit = 1 m for houses, ~100 m for geography) and keep props at real proportions.

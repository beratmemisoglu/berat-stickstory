# The asset library

ONE merged library: the app's seed (727 entries: 6 human bodies on one skeleton + hair, 149 mocap clips, 49 animals and
creatures, 472 props, 39 vehicles, 93 sets / buildings, 17 textures and skies; all CC0 or CC-BY) plus this computer's own
saved finds (<workspace>/assets/lowpoly). The engine sees both under one index; nothing is copied into projects.

## ALWAYS search first
`lowpoly_asset` { action: 'search', query: 'slot machine', kind?: 'prop' } -> ids, sizes, clip counts, licences.
Search several words and synonyms (a "cop car" is `police`, a "poker chip" is `token` or `chip`). Ids by prefix:
`char.*` bodies and hair · `anim.*` clip files · `animal.q.*` / `animal.mon.*` animals and monsters · `prop.kf.*` home and office
(Kenney furniture), `prop.kkr.*` restaurant / kitchen, `prop.food.*`, `prop.arcade.*` arcade + casino (`prop.arcade.gambling_machine`),
`prop.board.*` dice, coins, tokens, `prop.market.*` shop, `prop.grave.*`, `prop.station.*` lab / control room, `prop.nature.*`,
`prop.kkcity.*` / `prop.roads.*` street furniture and cars, `prop.pp.*` singles (hospital bed, syringe, DNA, CRT monitor, briefcase,
gavel, safe, cash stack, gold bars, trophy, red button, microphone, phone, cigar, book, calendar, clipboard, brains, skeleton),
`vehicle.*`, `set.commercial.*` / `set.suburban.*` / `set.industrial.*` / `set.kkcity.*` buildings, `set.kf.*` walls / doors / stairs,
`set.roads.*` road tiles, `tex.*` textures (felt, carpet_a/b, wood, wood_floor, concrete, asphalt, grass, dirt, tiles, marble,
paving, bricks) and skies (sky_day, sky_sunset, sky_overcast, sky_night).
Style tags: style-lowpoly (Quaternius: realistic low poly, prefer for this look), style-toy (Kenney / KayKit, rounded),
style-blocky, style-cartoon. Keep one video consistent.

## Using an asset
`S.prop('prop.arcade.gambling_machine', { at: [x, z], ry, height: 1.9 })` - write the id as a plain string: the engine
preloads every id written in the scene files (and models.js) before the first frame. Ids built at run time are not seen:
then `await preload('id')` at the top of the scene file. Sizes: library models are in metres; set `height` / `width` /
`length` / `size` for a real size (Kenney sizes are +-30%).

## Saving a new find (so no video downloads it twice)
1. Search the library first. Then the web: Poly Pizza (poly.pizza), Quaternius, Kenney, Sketchfab "downloadable", Smithsonian
   3D, NASA 3D. Read the licence ON THE MODEL'S OWN PAGE.
2. Allowed: CC0, public domain, CC-BY 3.0 / 4.0 (credit required). Refused: NC, ND, SA, "personal use", "standard" store
   licences, Mixamo, anything unclear.
3. `lowpoly_asset` { action: 'add', id: 'prop.vintage_radio', kind: 'prop', name, tags, licence, licence_quote, author,
   source_url (the page), credit_text (CC-BY: the exact credit line), url (direct https .glb) }. It checks the licence and the
   file (uncompressed .glb under 8 MB, no Draco / Meshopt), measures it and indexes it in the user library.
4. Look at it in a frame (size, facing +z, materials) before using it everywhere.

## Credits
The app keeps a credits block in DESCRIPTION.txt (between the asset-credit lines) with every library asset the scenes use:
CC-BY credit lines first, then the CC0 authors. `lowpoly_asset` { action: 'credits' } refreshes and returns it. Write your
summary above it; never delete the block.

## What the library does NOT have (build it with the kit / by code)
Roulette table + wheel, playing cards, poker / baccarat tables (felt + `tex.felt` tinted), courtroom furniture, hospital machines,
stadium, classroom chalkboard, CRT with drawn UI, cash piles, money cubes, organs other than brains, x-ray bodies, airplane
interior. The kit has most of these (engine_api.md); anything else: boxes and cylinders WITH detail, sized from real proportions.

## Faces
`face.sheet1` (kind face): the generated expression sheet every drawn face uses (3x3 cells: neutral, shocked, grin, grimace,
crying, smug, scared, thinking, laughing; eyes layer + mouth layer, keyed from flat grey). Original, made for this project, no
real person (licence OWN-CC0, not credited). The engine maps the expression names onto it (lib/faces.js RECIPE).

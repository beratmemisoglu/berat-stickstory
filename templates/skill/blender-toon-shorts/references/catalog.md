# Catalogue: props, faces, poses, gestures, extras

Every name below is read from the engine (`assets/props/*.py` headers and `build()` options, `engine/faceparams.py`,
`engine/char.py`). A prop's full options and its numbers (seat heights, grip points, moving parts) are in its file's
header and `META`: read the file before staging with it.

## 1. Props (148, `cz.prop('<name>', '<instance name>', loc, rot=deg, scale=1, **options)`)

Conventions: metres, the front faces -Y, floor props stand on z = 0 with the root at the floor centre, wall props have
their back at y = 0 (on a left wall rot +90, on a right wall rot -90). Characters are ~1.3 m tall; seats 0.45-0.47 m.
Moving parts are empties `<instance>_<part>` (META['animate']). Colours take hex options (`color=`, `wood=` ...).

**Read this before using a prop** (what works in a project):
- Props marked **(film pictures)** print pictures made for the showcase films (the kit carries them: they render). Their
  printed names and logos belong to those films: never show them as they are in a frame where they read. Pass your own
  picture where the option exists (noted), or keep them small, turned away or out of focus.
- Props marked **(makes pictures)** draw a new PNG for new text / options the first time (into the project's
  `.suite/btex/`, by themselves); their default look comes from pictures already made.
- The cardboard box carries a Japanese marker scrawl: `marker=False` (+ your own label plane). Several office props were
  made for a Japanese office (labels in Japanese): check every label against the story's language.

### Seats and beds
- `simple_chair` - plain office side chair, padded seat 0.46. Waiting rooms, interviews. `color, frame, tape`
- `office_chair` - 5-star swivel chair, seat 0.47, the top turns. Desks. `color, frame, turn`
- `gb_chair` - ladder-back kitchen chair, rush seat 0.46. Kitchens, period rooms. `wood, paint`
- `gb_rocking_chair` - rocking chair with knitted cushion + throw, seat 0.46, rocks on `_rock`. `rock, wood, throw`
- `lo_chair_row` - a row of moulded waiting chairs on a beam (alternating colours). Waiting rooms. `n, pitch, colors`
- `tk_couch` - saggy worn 2-seat sofa (META seat heights + depth). Living rooms. `color, throw, sock, card`
- `throne` - a throne on a three-step lacquer dais. Palaces, comic grandeur. `lacquer, dais, gold, cushion, footstool`
- `gb_bed` - four-poster bed with patchwork quilt + nightstand (META mattress_z, sit_at). `quilt, bag, pot, wood`
- `ld_mattress` - a bare quilted mattress on the floor with a pillow (META lie, top). Poor bedrooms. `pillow, color, tufts`

### Tables, desks, counters
- `office_desk` - single-pedestal desk 1.4 x 0.7 x 0.72, knee space OFF-centre (x -0.18), clutter, optional monitor. `screen, clutter, monitor, drawer, top, body`
- `bare_desk` - old grey-green steel desk, three drawers + centre drawer. Empty offices. `items, drawer, drawer2, drawer3, mid, color, top`
- `off_desk_extras` - extra desk-top items for an office_desk (same root): tray, daruma, calendar, bottle. `items`
- `gb_table` - rustic pine kitchen table 1.3 x 0.8 x 0.72, optional checked cloth + food (META item_spots). `cloth, items, wood`
- `court_table` - low red lacquer table with a bronze wine cup (`_cup`, `_wine`), jug, peaches. `cup, wine, jug, peaches, lacquer`
- `tk_counter` - shop checkout counter (customer -Y, clerk +Y), mat, items, impulse rack. `mat, items, screen, pole, shavings, height, impulse, turn`
- `ld_crate` - red wooden crate used as a nightstand (META top). `color`

### Storage, shelves, boxes
- `filing_cabinet` - 4-drawer steel cabinet, the top drawer opens (`_drawer1`). `drawer, body, front, handle, note`
- `off_shelf` - light-steel office storage: low credenza or tall shelf with binders and top items. `kind, w, seed, top, body, door`
- `room_shelf` - a dusty wall shelf on L brackets with binders and papers. `binders, papers, board`
- `lt_shelf` **(film pictures)** - wall shelving packed with products. `w, h, shelves, seed, z0, d`
- `gb_hutch` - kitchen hutch / Welsh dresser with canisters, plates, cups (back on the wall). `wood, back, plates, cups, jars`
- `hall_curio` - dark rosewood display cabinet of treasures in staggered compartments. `w, h, d, seed, back, wood`
- `room_boxes` - a stack of archive boxes with handwritten labels (Japanese). `n, color`
- `cardboard_box` - hollow kraft box, four flaps (`_flapF/B/L/R`), contents when open. `open, items, marker`
- `lo_tackle_box` **(film pictures)** - long green box, two lids folding out flat (`_lidL/_lidR`), rows of tickets. `open, ticket (your png), length, rows`
- `lt_tacklebox` - a chunky teal tackle box carried by its handle (root = the grip). `color`
- `tk_snack_rack` - two-sided gondola snack shelf. Shops. `seed, header, hooks, turn`
- `tk_cooler` - 3-door glass drink cooler, lit header, its own light. Shops. `on, light, power, open, cases, seed`

### Doors, windows, room fixtures
- `door` **(makes pictures)** - interior door in its frame, the leaf swings on `_leaf` (open=0..1, -100 deg). `open, hinge, sign, color, frame, sign_bg, sign_ink`
- `window_blinds` - small window with venetian blinds and sky card. A sun through it is BLOCKED (PITFALLS: light). `open, broken, glass, sky, sky_dist, blind`
- `window_city` - 2.4 x 2.0 m office window onto a skyline (day / night exterior). `time, glass, exterior, span, seed, sticker`
- `gb_window` **(makes pictures)** - double-hung 6-over-6 sash window with real gaps (moon / sun pane patterns on the floor), curtains. `w, h, color, curtains, lace, tie, open`
- `ld_sheet_window` - a window covered by a pinned sheet, the pane an emissive card you animate (night -> dawn). `pane, fold, pins`
- `desk_partition` - low cubicle divider with pinned papers. `papers, feet, color, frame, width, height`
- `room_fixtures` - one small fixture: switch, outlet, ... (wall kinds and ceiling kinds). `kind, lit`
- `room_hooks` - coat-hook rail with an umbrella and a hanger. `umbrella, hanger, umbrella_color`
- `room_aircon` - aged wall-mounted air conditioner, flap half open. `flap, led, note, hose`
- `room_exit_sign` - emergency exit light over a door (glowing green panel). `on, strength`
- `ceiling_light` - recessed fluorescent panel or an enamel pendant on a cord (`_swing`). `kind, on, drop, shade, swing`
- `room_extinguisher` - extinguisher in a red floor stand (Japanese label). `dusty`
- `off_extinguisher` - red extinguisher on a floor stand with hose and gauge.
- `off_floor_sign` - yellow A-frame "watch your step" sign (Japanese print): one foreground object for depth.
- `room_water_cooler` - corridor water cooler with bottle and cup dispenser. `water, cups`
- `off_water_server` - slim water server with hot / cold taps and a big bottle. `panel, bottle`
- `off_recycle` - three sorting bins with labels (Japanese).
- `off_coat_rack` - coat stand with coat + scarf + tote, umbrella stand beside it. `umbrellas, coat`
- `off_copier` - multifunction copier with a sheet in the output and a lit panel. `paper, body, trim`
- `trash_bin` - small office bin with papers (Japanese sticker). `papers, color, sticker`
- `lt_trashcan` - big tapered store trash can with a dark opening (a body can go in head-first). `h, r0, r1, empty, color`
- `lt_trash` - one piece of flying trash: banana peel, paper cup, crumpled paper, soda can. `kind, seed`

### Wall dressing: boards, signs, pictures, clocks
- `off_board` - framed board: printed sign (your png), whiteboard with tray + magnets, or cork with papers. `img, w, h, kind, frame, tray, magnets, papers, seed`
- `room_notice` - a taped paper notice with a lifted corner (any png). `img, w, h, tilt, lift_deg`
- `room_notice_board` - aluminium-framed cork board with pinned papers. `papers`
- `wall_calendar` **(needs day/date pictures)** - daily flip calendar on a nail, the top page flips. `day, date, flip, board`
- `wall_clock` - round wall clock, hands `_hour` / `_minute` (rotation_euler.y, + = clockwise from the front). `r, rim, face, hands, time`
- `gb_grandfather_clock` **(makes pictures)** - 1.95 m long-case clock, painted dial, hands `_hour` / `_minute`, pendulum `_pendulum` (META dial_z). `time, swing, wood`
- `photo_frame` - desk photo frame with a printed photo (your png). `photo, style, stand`
- `hall_scroll` - hanging scroll (calligraphy / painting png) with roller and cord. `img, w, h, kind, roller, knob, cord`
- `hall_screen` - big folding lacquer screen, one picture across all panels. `img, width, panels, pic_h, zig, lacquer, skirt_h, feet`
- `stage_emblem` - giant blue-and-gold wall emblem with marquee bulbs and scales of justice. `radius, tilt, bulbs, enamel, gold, bulb, bulb_strength`
- `stage_tablet` - a round-topped slate stele engraved in gold on a marble base. `slate, marble, gold, height`

### Lamps, flames, practicals (most carry their own light)
- `lt_pendant` - green enamel pendant lamp with warm reflector and glowing bulb. `drop, shade, r, bulb`
- `lo_globe_lamp` - pendant opal globe on a rod. `drop, r, glow`
- `lo_desk_lamp` - red metal desk lamp, deep shade, glowing bulb. `color, glow`
- `tk_floor_lamp` - tall linen-drum floor lamp with its own light. `on, light, power`
- `ld_bulb` - bare bulb on a long cord with a glow. `color, strength, on, cord`
- `gb_lantern` - hurricane oil lantern with a POINT light (`_light`) and flickering flame (META grip). `lit, power, color, paint`
- `gb_candle` - brass chamberstick with a cartoon flame and a POINT light (META grip, flame). `lit, power, height, color`
- `hall_candle` - tall bronze pricket candle stand with a red candle and light. `height, light, power`
- `hanging_lantern` - red silk palace lantern, glowing. `lit, drop, swing, silk, fu`
- `gb_street_lamp` - cast-iron gas street lamp, POINT light + optional ground pool spot. `lit, power, color, pool`
- `out_lantern_string` - a sagging cord of small paper lanterns (festival lights), optional real lights. `b, sag, n, colours, lit, lights, power, r`
- `out_stone_lantern` - granite garden lantern, optional light inside. `lit, light, power, stone, moss, scale`
- `torch` - wooden torch with a brazier and flame, on a stand or a wall (META torch lights). `mount, lit, light, power, size`
- `gb_stove` - pot-bellied cast-iron stove with kettle and stovepipe; lit = fire-door glow + a POINT light. `lit, light_w, board, kettle`
- `lo_fish_tank` - fish tank on a cabinet: glowing blue water, gravel, weed, a castle, a pufferfish that swims (`_fish`); its small sign is a film picture (built without it). `water, stand`

### Screens, devices, office things
- `lo_crt` - beige CRT monitor + keyboard, lit screen (its default screen and sticky note are film pictures: pass your own `screen`). `keyboard, screen, beige`
- `lt_monitor` **(film pictures)** - customer display on a pole. `screen, h, tilt`
- `lt_register` **(film pictures)** - cash register with keypad and display. `drawer`
- `lt_terminal` - card payment terminal on a swivel pole. `h, yaw`
- `lt_scanner` - handheld barcode scanner with a red laser fan (`_beam`) and coiled cable. `beam, beam_len, cable`
- `lo_printer` - desktop printer seen top-down, a ticket slides out (label + default ticket are film pictures: built plain without them). `ticket (your png), out`
- `lo_sec_button` - red push button on a box, dome glows, presses down (`_btn`); its printed label is a film picture (built plain without it). `lit, press`
- `tk_tv` - chunky old CRT TV on a stand, lit screen (your png), optional light. `screen, on, light, power`
- `tk_desk_phone` - office desk phone, liftable handset, lit LCD (META grip). `color, lifted, on, hs`
- `tk_dispenser` - acrylic scratch-ticket dispenser case, 2 x 4 bins, strips that pull out. `art, empty, bins_empty, strips, floor, pulled, seed`
- `smartphone` - phone in a coloured case, lit screen (your png). `screen, on, case, glow`
- `rubber_stamp` - big office stamp + a notice sheet (hide the sheet when held, PITFALLS). `text, stamped, lift, wood`
- `law_book` - thick red hardcover with gold title. `lying, cloth, cover, spine`
- `coffee_mug` - warm-white mug with a cat face, optional steam wisps. `steam, coffee, color, band`

### Hand props
- `gb_hand_bell` - small brass hand bell, the clapper swings (`_clapper`; META grip). `clapper, wood, brass`
- `gb_shovel` - period spade, root = the blade tip (META grip, mid, tread). `dirt, wood, iron`
- `gb_suitcase` **(makes pictures)** - packed leather valise with straps, tag and two tickets under the strap. `tickets, sleeve, tag, leather, lid`
- `gb_teacup` **(makes pictures)** - porcelain teacup + saucer, the cup lifts (`_cup`), steam. `steam, saucer, tea, steam_strength`
- `gb_bill` **(makes pictures)** - a paper bill / IOU sheet, crumple and curl (META grip). `kind 0..5, crumple, curl, seed`
- `lt_ticket` **(film pictures)** - a scratch ticket lying flat. `w, small, back`
- `lt_wallet` **(film pictures)** - an open bifold wallet that folds (`fold`). `fold`
- `tk_card` **(film pictures)** - a scratch card with a scratch-off silver layer in 13 states and overlay planes. `card, silver, overlays, hidden_ov, upright, w, back`
- `spear` - palace guard's spear with a tassel (hold it out at x -0.3: it crossed a face at -0.2). `kind, grip, tassel`
- `ld_bucket` - blue plastic bucket with water. `color, water, handle_tilt`
- `ld_pizza_box` - a stack of pizza boxes. `count`
- `ld_fishbowl` - round glass fishbowl with fish, a toy boat and a castle. `fish, boat, castle, water`
- `ld_captain_hat` - a captain hat accessory (parent it to a head). `R, tilt`

### Clutter
- `tk_apt_clutter` - bachelor-apartment clutter for a coffee table or the floor (pizza box, cans, ...; META spots). `items, seed`
- `gb_street_bits` **(makes pictures)** - street dressing, one kind each: barrel, crate, trough, hitch rail, milk cans, cart wheel, bench, sign. `kind, seed, text, bg, ink, mount`
- `out_debris` - rubble scatter: roof tiles, bricks, stones, splintered planks. `w, d, n, tiles, mix, avoid, seed, scale`
- `out_tufts` - ground scatter: grass clumps, wild flowers, pebbles. `w, d, n, flowers, pebbles, grass, grass2, petals, h, ground, at, avoid, keep, seed`

### Plants and nature
- `potted_plant` - terracotta pot with a rubber plant (leaves on pivots, droop). `size, droop, pot, tag`
- `out_shrub` - chunky bushes and small trees, optional flowers. `kind, size, leaf, leaf2, bloom, night, seed`
- `pine_tree` - stylised windswept pine. `size, mirror, foliage, bark, seed`
- `gb_dead_tree` **(makes pictures)** - gnarled leafless tree, optional crow (`_crow`). `size, seed, mirror, crow, bark`
- `ld_lily` - a lily pad, optional lotus flower. `r, flower, notch, seed`
- `hilltop` - a grassy hill-top terrain piece with a path. `night, tufts, flowers, stones, seed`
- `gb_grave_mound` **(makes pictures)** - an old grassy or a fresh dirt grave mound. `fresh, length, width, seed`

### Graveyard
- `gb_coffin` **(makes pictures)** - six-sided coffin for a lying character, lid closed / off / cut, bills inside (META pillow, inner). `lid, bills, seed`
- `gb_headstone` **(makes pictures)** - headstone in 5 styles with engraved lines and moss, a lean on `_tilt`. `style, tilt, seed, lines, moss, color`
- `gb_bell_post` **(makes pictures)** - a grave bell post: the bell swings (`_bell`), the clapper (`_clapper`), the string (`_string`). `swing, clapper, plaque, pipe_depth`
- `gb_iron_fence` **(makes pictures)** - wrought-iron fence run on a curb, optional double gate. `length, gate, gate_open, seed, iron, stone`

### Buildings, exteriors, skies
- `gb_house` **(makes pictures)** - 2-storey clapboard house with a deep porch, lit windows one by one, door pivot (META porch_z, windows, lamp_hook). `lit, color, trim, seed, door_open, hall, roof, win_power, switchable`
- `hut` - small thatched hut with a cloth doorway, optional lamp. `lit, lamp, cloth, wood, hat, jar, open, sink`
- `city_gate` - 8 m section of brick city wall with an arched gate, gatehouse, torches (META torch_lights). `open, openL, openR, lit, windows_lit, banners, gatehouse`
- `out_skyline` - chunky distant buildings for far layers (10-25 m away). `kind, w, d, h, eaves, tiers, roof, wall, lit, ol, towers, terrace, haze, seed`
- `out_ruin` - ruined palace wall runs (backdrop). `kind, w, h, d, breaches, tilt, ol, stucco, seed`
- `out_palace_bits` - things thrown about by a quake: a fallen column, a table, ... `kind, L, seed`
- `rubble_pile` - a heap of earth and debris with broken columns. `dust, lantern, plaque, seed`
- `out_well` - fieldstone village well with a windlass. `night, seed`
- `out_stall` - market stall with striped awning and goods, optional light. `kind, cloth, sign, lit, light, power, seed`
- `out_cart` - two-wheeled wooden handcart with a load. `load, seed`
- `out_fence` - bamboo fence along a polyline. `pts, h, step, lattice, ground, at, night, seed`
- `out_banner` - tall pole with a long cloth banner. `kind, design, height, cloth_w, cloth_h, wave, pole, seed`
- `out_lion` - stone guardian lion on a pedestal. `mirror, stone, seed`
- `out_smoke` - a thin smoke column of soft puffs. `height, n, r0, drift, col, col2, seed`
- `tk_canopy` - gas-station canopy + pumps + price sign seen 8-15 m away, lit. `on, lights, power, pad, sign, neon`
- `ld_castle_isle` **(film pictures)** - a rock island with a castle (very big, far away). `seed`
- `out_sky_drum` - a full 360-degree painted panorama cylinder (r 26 m): use it for every exterior. `img, radius, z0, z1, segs, strength`
- `night_sky` - a 160-degree curved night sky backdrop (side and reverse shots see past it: prefer the drum). `time, moon, stars, seed`

### Vehicles and big set pieces
- `ld_suv` - a red boxy toy SUV with an open cabin, wheels / steering / dice that animate (META driver: seat + wheel). `color, steer, spin, swing, cargo, ghost`
- `ld_yacht` **(film pictures)** - a toy cabin cruiser with a hot tub and lights (META deck, captain, tub). `lights, wheel, clutter`

### Stage, palace, hall
- `stage_balustrade` - marble balustrade with gold rail, optional lamps. `length, height, spacing, posts, marble, gold, lamps, glow`
- `stage_column` - fluted marble column, optional sconce. `height, marble, gold, flutes, sconce, sconce_z, glow`
- `stage_curtain` - velvet drape / swag / backdrop with gold ties. `kind, width, height, folds, depth, side, tie, swags, color, gold, seed`
- `stage_truss` - lighting truss with theatre cans. `length, cans, steel, lens_strength`
- `palace_column` - red lacquer column with bracket top, optional crack. `height, cracked, beam, lacquer, seed`
- `hall_bells` - a rack of bronze chime bells with mallets. `length, top, bottom`
- `hall_censer` - bronze tripod incense burner with smoke, on a stand. `size, smoke, stand`
- `hall_crane` - bronze crane on a tortoise-shell rock. `size, mirror`
- `hall_vase` - porcelain vase on a carved stand (4 shapes, glazes). `kind, h, glaze, stand`
- `seismo_jar` - a big bronze ancient earthquake detector with dragon heads and frogs (a hero prop). `jaws, drop, swing, cutaway, cut, patina, trigrams`

## 2. Faces (49 presets: `c.face(t, name, big=True)`)

Sheet of all of them: `<python> <engine>/tools/facegen.py --sheet renders/faces_sheet.jpg`. Resting eyes are lidded grey
half-ovals (the "unimpressed" look everyone wears at rest); rings = surprise / fear; n-arcs = happiness.
TAKE = a big arrival that squashes and stretches the head (strength in brackets).

Rest and attitude
- `neutral` - lidded rest eyes, a small closed smile line: the default.
- `calm` - lower lids, a soft smile.
- `bored` - heavy tilted lids, eyes down, a flat skewed mouth.
- `unimpressed` - half lids, a flat slightly downturned mouth: the style's rest attitude.
- `smug` - uneven lids, one brow up, a lopsided smirk, eyes aside.
- `sly` - WIDE ring eyes glancing hard to the side + a skewed smile (a big side glance, not lidded).
- `sideglance` - ring eyes glancing aside, a small skewed mouth.
- `knowing` - a lidded side glance + a smirk ("she knows"; use this, not sly, for a quiet knowing look).
- `suspicious` - narrow uneven lids glancing aside, a tight small frown.
- `scheming` - low tilted lids, angry brows, a wide clenched-teeth grin.
- `skeptical` - one brow up, one down, uneven lids, a skewed mouth.
- `thinking` - ring eyes looking up and aside, a small pursed mouth, one brow up.
- `confused` - rings, brows at opposite tilts, a wavy mouth.
- `determined` - tilted lids, brows down hard, a firm mouth.
- `annoyed` - low lids, angry brows, a frown.
- `angry` - a lidded glare, steep brows, a strong frown.
- `furious` (TAKE 0.8) - a glare, brows slammed down, clenched teeth in an open mouth, a vein.
- `pout` - brows down, eyes up, a small pushed round mouth.
- `whistle` - rings looking up and aside, a small round "o".
- `sleepy` - nearly shut lids, a small yawn.
- `asleep` - eyes shut, a small open round mouth.
- `effort` - squeezed lids, angry brows, clenched teeth, sweat.
- `sick` - low lids, worried brows, a wavy mouth, gloom.
- `disgusted` - uneven lids, a downturned skewed mouth with the tongue out.

Happy
- `smile` - lidded eyes, a wide closed smile.
- `happy` - closed n-arc eyes, a big smile.
- `blissful` - closed arcs, a soft smile, blush.
- `grin` - closed arcs, a wide clenched-teeth grin (override `{'em': 0, 'eo_L': 0.9, 'eo_R': 0.9}` for open eyes).
- `biggrin` (TAKE 0.8) - wide rings, a huge open grin with tooth dividers.
- `laugh` - closed arcs, a wide open laughing mouth, teeth + tongue.
- `excited` (TAKE 0.7) - wide rings, an open grin, sparkle.
- `manic` (TAKE 0.9) - huge rings with small pupils, a wide clenched grin.
- `wink` - one eye shut (drawn as a happy arc), a skewed smile.
- `love` - heart eyes, an open smile, blush.
- `starstruck` (TAKE 0.8) - star eyes, an open grin.

Surprise, fear, sorrow
- `surprised` (TAKE 1.0) - rings, brows shot up onto the hair, a small open "o".
- `shocked` (TAKE 1.25) - big rings with small pupils, brows over the hairline, an open "o", sweat: the strongest take.
- `gape` (TAKE 1.0) - rings, the jaw dropped wide open, teeth + tongue.
- `worried` (TAKE 0.5) - rings, brows tilted up in the middle, a small wavy mouth (use it for "nervous" beats).
- `nervous` - lidded, worried brows, a clenched toothy smile, sweat (its half lids read as sunglasses: prefer worried).
- `embarrassed` - lids lowered, looking down and aside, a small wavy smile, blush.
- `scared` (TAKE 0.8) - rings with small pupils, worried brows high, a small wavy open mouth.
- `terrified` (TAKE 1.1) - huge rings with tiny pupils, a clenched-teeth grimace, sweat.
- `panic` (TAKE 1.2) - huge rings, a screaming open mouth, sweat + stress marks.
- `sad` - tilted lids, sad brows, eyes down, a frown.
- `crying` - closed arcs, sad brows, a wailing wavy mouth, tears.
- `pain` - X eyes, clenched teeth, stress marks.
- `dizzy` - spiral eyes, a wavy open mouth.
- `dead` - X eyes, a slack wavy mouth.

Face extras (`c.extra(t0, t1, name)`, 3-frame ramps): `sweat`, `blush`, `tears`, `stress`, `sparkle`, `vein`, `gloom`.
Visemes (lip-sync, automatic): `rest`, `MBP` (m b p), `AI` (a i), `E` (e h), `O`, `U` (u w q), `FV`, `L` (l t d n),
`S` (s z c j x: a clenched-teeth bar), `etc`.

## 3. Poses (`c.pose(t, name, dur=0.18, antic=0, **channel overrides)`)

Hands are in the torso frame (x = the character's left, -y = forward, z up from the hips; `s` = scale, `ht` = torso
height, chest = 0.62 ht). A named pose sets every channel it names.
- `rest` - both hands down by the hips.
- `hips` - hands on the hips.
- `shrug` - both hands out to the sides at 0.7 ht, a little forward (add `hroll`, palms-up read needs both arms).
- `cheer` - both arms straight up (they read as antennae: widen them, `hL=(0.42, -0.14, 0.8), hR=(-0.42, -0.14, 0.8)`).
- `point` - the right hand forward at chest height (aim it with hR).
- `pointup` - the right hand up above the head.
- `wave` - the right hand up beside the head (shake it with set() keys).
- `think` - the right hand at the chin, the left across the belly.
- `phone` - both hands in front of the chest (holding a phone).
- `type` - both hands forward low (a keyboard).
- `cross` - arms crossed over the chest (big bellies: pass the hands in front, sitting.md).
- `behind` - hands behind the back.
- `headrest` - both hands behind the head.
- `present` - the right hand out to the side, presenting.
- `slump` - lean back 14 deg, hands hanging low.
- `upright` - lean back to 0.

## 4. Gestures the films built (set() keys: the engine has no gesture library)

```python
for k in range(3):                                        # a happy little wave, three shakes
    c.set(24.15 + k * 0.16, dur=0.08, hR=(-0.36, -0.12, 0.66)); c.set(24.23 + k * 0.16, dur=0.08, hR=(-0.28, -0.12, 0.62))
for k in range(6):                                        # eager bounces while seated: RELATIVE to the current body height
    t = 35.2 + k * 1.25
    c.set(t, dur=0.12, bodyz=c.T['bodyz'].at(t) + 0.012); c.set(t + 0.14, dur=0.18, bodyz=c.T['bodyz'].at(34.0))
for k in range(5):                                        # waving a bill overhead (the bill held in hR)
    t = TX + 0.05 + k * 0.28
    c.set(t, dur=0.1, hR=(-0.24, -0.2, c.ht * 1.55)); c.set(t + 0.14, dur=0.1, hR=(-0.26, -0.24, c.ht * 1.25))
for k in range(2):                                        # digging with a shovel
    t = 44.28 + k * 0.32
    M.set(t, dur=0.12, lean=22, hR=(-0.12, -0.34, M.ht * 0.3)); M.set(t + 0.15, dur=0.14, lean=4, hR=(-0.12, -0.28, M.ht * 0.6))
c.pose(37.8, 'rest', dur=0.15, antic=0.1, hL=(0.24, -0.3, c.ht * 0.95))     # a thumbs-up position (add a thumb shape, below)
c.set(42.62, dur=0.15, squash=0.94); c.set(42.8, dur=0.2, squash=1.0)       # a small flinch with the face change
```
- Ball hands cannot carry a finger gesture: add shapes to the hand empty. A thumbs-up that reads:
  ```python
  blk = cz.toon('cz_limb', '#14100c', 0.8)
  mit = cz.sphere('hl_mitten', 0.055, (0, -0.01, 0), blk, ol=0.004, parent=c.ctrl['hL'], segs=20, rings=10)
  mit.data.transform(Matrix.Diagonal((0.8, 1.2, 1.25, 1)))                   # a fist
  cz.cyl('hl_thumb', 0.026, 0.085, (0, -0.04, 0.02), blk, rot=(90, 0, 0), ol=0.004, parent=c.ctrl['hL'], verts=12)
  cz.sphere('hl_thumbtip', 0.026, (0, -0.125, 0.02), blk, ol=0.004, parent=c.ctrl['hL'], segs=12, rings=6)
  ```
  A finger up = the hand ABOVE the head (1.4 x head height, arm straight up); a shrug = both arms out at the elbows
  with the shoulders up; a point = `pose('point')` + `look()` the same way.
- Head and body accents: `set(t, hyaw=.., hroll=.., hpitch=..)` (never a dead-frontal head: hyaw 14-24 and a little
  roll), `lean` / `sway` slumps, `squash` flinches.

## 5. Hair and costume ideas (from the night-2 casts: write your own builders in cast.py)

- Hair: `hair_cap` bowl cut (`sides=-0.04, back=-0.9, puff=1.08`), bun (`bun=(0.12, 0.95, 0.25)`), a parted fringe
  (`bangs=0.08, part=0.3`), a crown band for a balding man (hairline `front=0.6`, hair at the sides and back only); a
  curl, a swoop or a quiff as tapered tubes; a perm as a dome of SMALL curl spheres (~1/8 of the head, a scalloped
  edge, `inkline=False`). Tall swoops read as nightcaps; big curl balls as a clown wig.
- A tapered tube along a cubic Bezier (curls, ties, straps, cords, lanyards), from the casts:
  ```python
  def tube(name, pts, r0, r1, mat, parent, ol=0.005, n=24, ring=14):
      P = [Vector(p) for p in pts]
      def at(t):
          a = [P[0].lerp(P[1], t), P[1].lerp(P[2], t), P[2].lerp(P[3], t)]; b = [a[0].lerp(a[1], t), a[1].lerp(a[2], t)]
          return b[0].lerp(b[1], t)
      bm = bmesh.new(); rings = []
      for i in range(n + 1):
          t = i / n; c = at(t); tg = (at(min(1, t + 1e-3)) - at(max(0, t - 1e-3))).normalized()
          up = Vector((0, 0, 1)) if abs(tg.z) < 0.9 else Vector((1, 0, 0))
          u = tg.cross(up).normalized(); v = tg.cross(u).normalized(); r = r0 + (r1 - r0) * (t ** 0.9)
          rings.append([bm.verts.new(c + (u * math.cos(2 * math.pi * k / ring) + v * math.sin(2 * math.pi * k / ring)) * r) for k in range(ring)])
      for i in range(n):
          for k in range(ring): bm.faces.new((rings[i][k], rings[i][(k + 1) % ring], rings[i + 1][(k + 1) % ring], rings[i + 1][k]))
      bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
      o = cz._mesh_obj(name, bm, mat); cz.place(o, (0, 0, 0), parent=parent)
      if ol: cz.outline(o, ol)
      return o
  ```
- Costumes that read at phone size: collar points + a button placket + a name tag decal + a badge (a polo); a
  loosened crooked tie, a pocket protector with pens, a lanyard + ID card, a coffee stain (an office shirt); a waistcoat
  + cravat + watch chain; a skirt cone + lace collar + brooch; a nightcap with a tassel; curlers + a shawl; braces;
  a police cap + star badge + pockets; a bucket hat with lures all round the band; round spectacles as OPEN rings
  (a filled wireframe disc reads as sunglasses), thick frames + a bead chain with `dot_eyes`.
- One strong colour per hero against the sets; same-colour neighbours merge (a dais as red as its throne).

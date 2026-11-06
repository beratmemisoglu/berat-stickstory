# The prop kit (generated from the engine: experiments/toon-style/tools/skilldocs.py)

317 original props made in code, in the toon look. Use them by name: `S.prop(name, { at: [x, z], ry, on: table, scale, seed, ...options })`.
Search here before building anything by hand. Options per prop are in its description. userData conventions: `top` (stand things
on it), `seat` (sit on it), `grip` (hold it), `footprint` (where a character cannot stand), `screen` (redraw with `userData.draw(fn)`),
`light` (its lamp), `setLit(on)`, `fireAt` / `lavaAt` / `exhaustAt` / `muzzleAt` (where S.fx goes). Never use the option names
`on`, `at`, `y`, `ry`, `rel`, `shadow`, `scale`, `seed` for a prop's own settings (placement reads them).

## architecture (2)
- `door`: panelled door 0.9 x 2.1 with frame, back at z 0 (o.open 0..1, o.beyond: lit colour; userData.door hinge)
- `window`: window with frame, sill, view (o.view day|night|sunset|dusk), curtains (o.curtains colour|false, o.long), o.blinds

## bathroom (7)
- `bathroom_sink`: pedestal wash basin with tap, top .84 m
- `bathtub`: clawfoot bathtub full of water (o.bubbles, o.duck, o.water false)
- `mirror`: wall mirror (o.shape rect|oval) at 1.55 m
- `toilet`: toilet with tank (o.open: lid up; userData.lid)
- `toilet_paper`: toilet paper roll
- `towel`: striped towel draped over a wall rail at 1.15 m
- `towel_stack`: stack of folded towels (o.count)

## beach (8)
- `beach-towel`: striped beach towel 1.75 m along z, flat (o.colors)
- `beach-umbrella`: striped beach umbrella ~2.3 m in a sand mound (o.color, o.color2, o.tilt)
- `coconut`: coconut ~.22 m (o.open: half shell with white flesh)
- `life-ring`: red and white life ring with rope on a post ~1.55 m (o.post false: lying flat)
- `lifeguard-tower`: lifeguard tower ~4.4 m: stilts, platform (top 1.97), hut, ramp to +z, flag, sign (o.text, o.color)
- `sandcastle`: sand castle ~.6 m with keep, towers and a flag
- `shell`: scallop shell ~.17 m (o.color)
- `starfish`: starfish ~.26 m lying flat (o.color)

## building (4)
- `apartment`: apartment block 4-7 floors by seed (o.floors, o.w, o.d, o.color, o.balconies, o.lit random lit windows), rooftop tank
- `house`: cartoon house 6.4 x 5.6 m: siding, gable roof, door + step, shuttered windows, chimney (o.floors 1-2, o.color, o.roof, o.door, o.lit)
- `shop`: shop front 5.2 m wide: display window with goods, door, striped scalloped awning, sign board (o.text name, o.color wall, o.accent, o.floors upper floors, o.lit)
- `skyscraper`: glass tower 30-60 m in setback tiers with a spire (o.height, o.w, o.tiers, o.color, o.lit offices + beacon)

## camp (4)
- `backpack`: hiking backpack ~.65 m with bedroll, pocket at +z (o.color, grip on the top loop)
- `camp-lantern`: camping lantern ~.33 m with warm light (o.lit default true, userData.light, grip on the handle)
- `campfire`: stone ring + log teepee + glowing embers; userData.fireAt for the flames (o.lit)
- `tent`: A-frame tent ~1.5 m tall, door at +z, ropes and pegs (o.color)

## decor (2)
- `picture_frame`: framed picture at 1.55 m (o.art landscape|portrait|abstract|sunset, o.tex, o.text; o.mount 0 = stands)
- `wall_clock`: round wall clock at 2 m (o.time "10:10"; userData.hands.hour/minute rotate z)

## extreme (12)
- `bones`: old bones scattered on the ground: two long bones, a few ribs and small bones (~1 m spread; seed). solid false
- `cave-mouth`: a rocky cliff with a dark cave opening that fades to black inside, boulders at its foot; the opening faces +z (w: width, default 8 m; seed)
- `ice-block`: a glossy cube of ice with frosty cracks (size, default 1 m). inside: an Object3D to freeze inside it - the block then turns see-through
- `iceberg`: a faceted iceberg floating with the waterline at y = 0 and its big blue underwater part below (size: width, default 10 m; under: false to drop the hidden part; seed)
- `mine-cart`: a rusty mine cart full of ore (load: "ore" | "gold" | "empty") on a short piece of track along z (rails: false for just the cart on the ground; on mine-rails use y: .16). userData.wheels
- `mine-rails`: a straight mine-railway track along z: two steel rails on wooden sleepers (len default 6; the rail top is at y = .16). solid false
- `rope-bridge`: a sagging wooden rope bridge across a gap, spanning x from -len/2 to len/2 with log posts at both ends on y = 0 (len default 10; sag; broken: true for missing planks; sway: amplitude, default 0). userData.deckAt(u) -> [x, y, z] on the deck (u 0..1)
- `skull`: a cartoon human skull with dark eye sockets and teeth, facing +z, sitting on y = 0 (size: scale; jaw: false)
- `snowy-peak`: a big snow-capped mountain with ridges, grey-blue rock and a jagged snow line (h default 40 m; r base radius; seed). A backdrop piece: solid false
- `stalagmites`: a cluster of drippy cave stalagmites (hang: true for stalactites hanging down from y = 0, put them at the ceiling; n; h tallest, default 2.2 m; seed)
- `volcano`: a volcano with a glowing lava crater, lava streaks down its rocky sides and ash near the rim (h default 30 m; lava: false for a dormant one). userData.lavaAt (crater, for smoke / eruption fx), light
- `warning-sign`: a warning sign on posts (kind: "board" red DANGER header with a line below, "triangle" yellow with !; text, sub: the words; color). userData.screen: the sign texture (redraw it)

## food (8)
- `apple`: apple with stem and leaf (o.color)
- `banana`: banana (o.count bunch)
- `bread_loaf`: crusty bread loaf with scored top
- `cake`: two-tier frosted cake on a stand (o.candles n lit candles, o.color)
- `cookie`: chocolate chip cookie
- `cookie_jar`: glass cookie jar full of cookies with a label (o.text)
- `pizza`: pepperoni pizza in eight slices (o.missing; userData.slices)
- `pizza_box`: pizza box with printed lid (o.open 0..1 shows the pizza, o.text)

## furniture (18)
- `armchair`: chunky upholstered armchair with rolled arms, seat .49 m
- `bar_stool`: chrome bar stool with a round glossy cushion, seat .78 m
- `bed`: double bed with headboard, pillows and a folded-back duvet (o.single, o.w)
- `bookshelf`: tall bookcase packed with books (userData.shelves = board heights)
- `cabinet`: six-drawer dresser / sideboard, top .88 m
- `chair`: wooden ladder-back chair, seat .45 m (o.cushion: colour)
- `coffee_table`: low wooden coffee table with a shelf, top .42 m
- `desk`: office desk with a three-drawer pedestal, top .75 m
- `dining_table`: wooden dining table 1.6 x .9, top .75 m
- `kitchen_counter`: base cabinets with worktop and splashback, top .92 m (o.w)
- `office_chair`: swivel office chair on five castors, seat .5 m
- `rug`: flat rug (o.shape rect|round|runner, o.pattern border|diamond|stripes|rings), solid false
- `shelf`: open shelving dressed with books, jars, plants, boxes (o.fill false = empty)
- `side_table`: bedside / side table with a drawer, top .59 m
- `sofa`: three-seat sofa, rolled arms, seat .49 m (o.count seats, o.w width)
- `stool`: round wooden four-leg stool, seat .48 m
- `wall_cabinet`: upper wall cabinet hung at 1.45 m (o.mount), back at z 0
- `wardrobe`: two-door wardrobe (o.open 0..1 shows hanging shirts; userData.doors)

## history (27)
- `amphora`: a two-handled terracotta amphora with black bands and a zig-zag frieze (0.86 m; color)
- `cannon`: an old iron cannon on a wooden carriage with two big spoked wheels, muzzle +z, a pile of cannonballs (balls: false). userData.barrel (tilt on x), muzzleAt
- `castle-tower`: a round stone castle tower with arrow slits, an arched door and either a pointed slate roof with a pennant (default) or a crenellated top (roof: false) (h default 11; r 2.6; roofColor)
- `castle-wall`: a straight stone castle wall segment with crenellations along both edges and arrow slits; chain several end to end (len default 8, h 5, along x)
- `catapult`: a wooden catapult on four wheels with a throwing arm, rope torsion bundle and a stone in its cup; front +z (fire: 0 cocked .. 1 thrown; load: false). userData.arm, setFire(k)
- `column`: a fluted marble column with base and capital (h default 4; broken: true for a snapped one with its capital lying beside it; seed; color)
- `crown`: a gold crown with eight points, coloured gems and a red velvet cap (cap: false; 0.25 m)
- `galleon`: a three-masted sailing galleon with billowing sails, stern castle with lit windows, gunports and a bowsprit; bow +z, waterline at y = 0, gently rocking (len default 26 m; rock: 0 to hold still; sail colour)
- `hourglass`: a wooden hourglass with sand running from the top bulb to the bottom (flow: 0..1 how much has run; 0.33 m). userData.setFlow(k)
- `knight-helmet`: a steel knight's great helm with eye slits, breathing holes, brass cross strap and a red plume (plume: false; 0.42 m), sits on y = 0
- `longship`: a long Norse-style ship: clinker hull with curled stem and stern posts, round painted shields along the rails, striped square sail and oars; bow +z, waterline y = 0, rocking (len default 16; oars: false; rock)
- `map-table`: a heavy wooden table with an old treasure map spread on it (coastlines, compass rose, dotted route, red X), weights and a divider (userData.top; userData.screen: the map texture to redraw)
- `old-globe`: an antique floor globe: parchment-coloured world map on a wooden tripod stand with brass meridian ring (spin: rad/s, default 0; 1.2 m)
- `palisade`: a wooden palisade: a row of sharpened log stakes with two cross beams behind (len default 6 along x; h 3)
- `pyramid`: a stone pyramid with block courses and a gold capstone (size: base width m, default 30; kind: "smooth" | "steps" for a stepped temple-pyramid with a front stair and a shrine on top)
- `quill-inkpot`: a glass inkpot with a white feather quill standing in it (0.32 m). solid false
- `sarcophagus`: a painted royal sarcophagus with a gold face mask and striped headdress, lying with the head at -z (stand: true to stand it upright facing +z; open: true to slide the lid aside; 2.2 m)
- `scroll`: a parchment scroll lying open with handwriting and a red seal (rolled: true for a rolled scroll tied with a ribbon; text: your own lines in a serif hand). Flat: solid false
- `shield`: a round wooden shield with a painted design, iron rim and boss, standing upright facing +z (colors: [a, b]; design: "quarters" | "swirl" | "half" | "cross"; seed picks one). userData.grip
- `standing-stones`: ancient standing stones: two trilithons (two uprights and a lintel) and three single stones in an arc (kind: "ring" for a circle of n stones, r radius; mossy grey)
- `statue`: a generic stone statue of a robed figure holding up an orb, on a plinth (material: "stone" | "bronze"; 3.4 m)
- `sundial`: a stone pedestal sundial with a bronze dial and a triangular gnomon (1.1 m)
- `sword`: a straight sword standing on its tip as if stuck in the ground (lying: true to lie flat; 1 m). userData.grip
- `temple`: a classical temple front: three steps, a row of six fluted columns, frieze, triangular pediment and roof, dark doorway (12 m wide, 10 m tall; ruin: true for broken columns and no roof; color)
- `throne`: a royal throne: gold frame, tall arched back and red cushions, front +z (dais: true adds a two-step platform with a red carpet; color, cushion). userData.seat
- `treasure-pile`: a heap of gold coins with goblets, gems and a crown (r: radius, default 0.8 m; seed)
- `wall-torch`: a burning torch in an iron wall bracket: back plate at z = 0 (put it against a wall), flame at ~2.2 m (h: bracket height, default 1.9; lit: false). userData.light (flickers), fireAt

## home (4)
- `fan`: pedestal fan with wire cage (o.desk: small desk fan; userData.spin rotates z)
- `light_switch`: wall light switch at 1.15 m (o.lit false = switched off)
- `radiator`: column radiator against the wall (o.count sections)
- `smoke_alarm`: smoke alarm with red LED on the wall at 2.3 m (o.ceiling: on the ceiling, o.lit false)

## kitchen (16)
- `bottle`: labelled bottle (o.kind water|soda|wine|juice, o.text)
- `bowl`: ceramic bowl (o.fill soup|cereal|none)
- `cereal_box`: printed cereal box with an invented brand (o.text, o.color)
- `fridge`: two-door fridge with a note and magnets (o.open 0..1 shows lit shelves with food)
- `fruit_bowl`: bowl of apples, orange, grapes and bananas
- `glass`: drinking glass (o.fill water|milk|juice|soda|empty)
- `jar`: glass jar with lid and label (o.kind jam|honey|pickles, o.text)
- `kettle`: stovetop kettle with arched handle and spout
- `microwave`: microwave with a green clock display (o.text, o.lit: running)
- `mug`: ceramic mug of coffee (o.fill coffee|tea|cocoa|milk|none, o.print smile|heart|none, o.text)
- `pan`: frying pan with long handle (o.food "egg")
- `plate`: white dinner plate with a coloured rim line
- `pot`: cooking pot with handles and lid (o.lid false)
- `sink`: kitchen sink unit: cabinet, worktop with a steel basin, gooseneck tap
- `stove`: cooker with four burners and an oven (o.lit: glowing burner + oven light)
- `toaster`: retro toaster with two slices popping up (o.toast false)

## lab (16)
- `battery`: battery cell standing on its minus end (AA 5 cm; o.big: true is a fat D cell 6 cm): black body, copper top band with a +, metal nub. o.color band
- `battery_big`: car battery (26 cm): black box, red + and black - terminals, carry handle, yellow "12V" label, charge-eye light
- `battery_meter`: big battery charge indicator as a 3D object (0.5 m wide, stands upright): white rounded casing, five glowing segments red -> amber -> green with the level. o.level 0..1 (.8), o.charging: true adds a lightning bolt. userData.level(k), fill(k0, k1, t0, t1) animates deterministically
- `beaker`: glass lab beaker (12 cm) with coloured liquid and white measuring marks. o.liquid colour, o.fill 0..1, o.glow: true makes the liquid glow
- `bunsen_burner`: Bunsen burner (15 cm) with a flickering blue flame and an orange gas hose; o.flame: false turns it off
- `circuit_board`: green circuit board lying flat (22 cm): gold traces, a big chip, small chips, capacitors, resistors, header pins and a lit LED
- `flask`: conical lab flask (18 cm) half full of coloured liquid; o.bubbles: true makes bubbles rise, o.glow: true makes the liquid glow. o.liquid colour, o.fill 0..1
- `gear`: a single chunky gear standing on its teeth, facing +z (o.r radius .12, o.teeth 16, o.color, o.spin rad/s)
- `gears`: three meshing gears (brass, steel, copper) on a wooden backboard (0.5 m wide, stands upright); they turn together with correct ratios (o.spin rad/s of the big gear, 0 stops them). userData.gears [{ mesh, n }]
- `lightbulb`: classic light bulb (13 cm, stands on its screw cap; scale it up for a big "idea" bulb). o.lit (default true): warm glowing glass + a point light (userData.light); off: clear glass showing the filament. o.intensity, o.range. userData.set(on)
- `magnet`: red horseshoe magnet with steel tips (17 cm), standing on its tips (U opening down). o.color
- `magnifying_glass`: magnifying glass (24 cm): wooden handle, brass rim, clear lens with a glint; stands on its handle end (origin) with the lens up, o.flat lays it on a table. userData.lens
- `microscope`: lab microscope (40 cm), its side profile toward +z (arm on the left, eyepiece tube leaning right): cream body, black tube, objective turret, stage with a slide, lit lamp, focus knobs
- `petri_dish`: petri dish (9 cm) with amber agar and coloured bacteria colonies; o.lid: true adds the clear lid
- `test_tube_rack`: wooden test-tube rack with five glass tubes of coloured liquids (26 cm). o.colors [5], o.n
- `wrist_gadget`: chunky wrist gadget with a 2-line amber LED dot-matrix display, three buttons and a dial, on a thick black strap (stands on its strap, display toward +z). o.lines [2]. userData.screen/draw(fn)/set(line1, line2)

## light (4)
- `bulb`: bare bulb on a cord from the ceiling (o.ceiling 3, o.drop 1); userData.pivot swings it, userData.light
- `desk_lamp`: articulated desk lamp with a lit head + point light
- `floor_lamp`: floor lamp with a glowing drum shade + point light (o.lit false = off, o.intensity)
- `pendant_lamp`: pendant lamp with a dome shade glowing underneath (o.color, o.ceiling, o.drop); userData.pivot swings

## machine (15)
- `antenna_tower`: radio / cell antenna lattice tower (o.h, default 6 m): three red and white legs, cross bracing, panel antennas, a small dish and a blinking red beacon on top
- `atm`: cash machine kiosk "CASH 24" (1.72 m): lit header, recessed screen with side keys, sloped keypad, glowing card slot, cash slot with a bill stack. o.page: welcome | pin | amount | cash. userData.screen/draw(fn)/page(name, o), cash (bill stack mesh: animate its position.z to dispense)
- `ball_machine`: vertical pin-board ball machine "BALL RUSH" (original, 1.86 m on its stand): round glass playfield with brass pins, silver balls launched up a rail and bouncing down through the pins, centre slot display, chasing border lights, ball tray. o.balls (moving balls, 10), o.color. userData.feature(text) sets the centre display
- `cash_register`: shop cash register (0.42 m wide, on a counter): cream body, sloped keys, glowing green amount display on a post, drawer with bills and coins. o.amount. userData.drawer, open(k 0..1), set(amount), screen/draw(fn)
- `cctv_camera`: security camera on a wall bracket (origin on the floor at the wall, back at z = 0, mounted at o.h = 2.4 m): white housing with a sun hood, lens, blinking red light. o.sweep: true pans it slowly. userData.head (pivot: aim it)
- `claw_machine`: claw crane machine "GRAB-O" (1.95 m, 0.82 m wide): glass case full of round plush prizes, a claw on a gantry, lit marquee, joystick and button. o.color. userData.setClaw(x, z, drop, open): x, z -1..1 across the case, drop 0..1, open 0..1; userData.claw (group)
- `control_panel`: control room console desk (1.3 m wide, 1.4 m tall at the back): sloped panel with knobs, toggles, sliders, blinking lamps, a big red button, an oscilloscope and a radar, upright back panel with a status map screen. userData.screen/draw(fn) (the big screen), redButton (mesh), lamps (materials)
- `elevator_panel`: elevator button panel, wall-mounted (origin on the floor at the wall, back at z = 0, panel centre ~1.25 m): floor display with arrow, two columns of round numbered buttons that light up one by one, alarm bell. o.floors (12), o.style: steel | brass, o.lit colour or o.rainbow, o.pressed [floors lit at start], o.h (panel centre). userData.light(n, on, colour) (n = floor number or "bell"), press(n, on), lightAll(on), floor(n, dir), buttons
- `led_counter`: LED number board with red seven-segment digits (data as a physical object: jackpots, prices, counters). o.digits (8), o.value, o.prefix ("$"), o.color, o.label (title band above, e.g. "JACKPOT"), o.pole: true puts it on a 2.2 m pole sign. Origin on the floor. userData.set(v), count(from, to, t0, t1, ease) animates deterministically, screen/draw(fn)
- `satellite_dish`: satellite dish on a pole (1.45 m, dish 0.9 m across): white parabolic dish tilted to the sky, feed arm with the receiver. o.tilt (radians up), o.color. userData.dish (pivot: aim it)
- `server_rack`: data-centre server rack (2 m tall): twelve servers with drive bays and blinking green / amber / blue LEDs, vented top. o.color
- `signal_box`: roadside traffic-signal controller cabinet (1.4 m): grey-green metal box on a concrete plinth, door with handle and lock, vents, warning sticker, ID plate
- `slot_machine`: casino slot machine "SUPER SPIN" (2.07 m with its arched topper, 0.74 m wide; a stool in front makes it playable): three real spinning reels behind glass with a payline, chasing topper bulbs, pull lever, button deck, credit LEDs, pay table. o.color, o.text (topper), o.symbols (rest), o.credits. userData.reels, symbols, spin(at, result[3], {dur, stagger, turns}) -> stop time, show(names), setReels(t), credits(n), pull(at), lever
- `slot_reel_unit`: the inside of a slot machine: three reels on a steel bracket with motors, an axle and a part label (0.7 m wide, 0.4 m tall; put it on a shelf or inside a cut-open cabinet). Same reel API as slot_machine: reels, spin(at, result), show(names), setReels(t)
- `vending_machine`: drinks vending machine "FIZZO" (1.85 m, 0.95 m wide): lit glass front with five shelves of cans and bottles, keypad and price LEDs, coin and bill slots, pickup flap. o.color

## medical (7)
- `bandage_roll`: gauze bandage roll with an unrolled tail
- `first_aid_kit`: first-aid case with a cross (o.color "red")
- `hospital_bed`: hospital bed with raised back, rails, blanket (userData.back)
- `iv_stand`: IV drip stand with saline bag and tube
- `pill`: two-tone capsule lying down (o.color, o.color2, o.kind "tablet")
- `pill_bottle`: amber pill bottle with child cap and label (o.text, o.sub, o.lying, o.pills n scattered)
- `stethoscope`: stethoscope lying flat

## modern (11)
- `drone`: quadcopter drone (36 cm across): white body, four arms with rotors, camera gimbal, green/red arm LEDs. o.spin: true shows spinning rotor discs (rotors turn every frame). userData.rotors
- `earbuds`: wireless earbuds: white pill charging case with a status light and two buds lying in front (6 cm case)
- `flat_tv`: flat screen TV on its stand (1.12 m wide, on a cabinet). o.show: news | cartoon | bars | static | off. userData.screen/draw(fn)/show(name)
- `game_controller`: modern twin-grip game controller lying face up (16 cm): two thumbsticks, d-pad, four pastel face buttons, light bar. o.color
- `laptop`: open laptop (34 cm wide, on a desk): silver body, dark keyboard, glowing screen. o.app: chart | code | video, o.open degrees (105). userData.lid (hinge), open(deg), screen/draw(fn)/app(name)
- `robot_small`: small cute helper robot (0.6 m tall): rounded white body on treads, screen face with glowing eyes, antenna light, short arms. o.color accent, o.mood: happy | neutral | sad | surprised | love | error | sleep. userData.head, arms [L, R], face(mood), screen/draw(fn)
- `router`: wifi router (24 cm): white box, three antennas, a row of blinking status LEDs
- `smartphone`: smartphone (17 cm, stands upright; o.flat lies screen up): round-cornered glowing screen. o.app: home | chat | call | stocks | notify | map | video | off (+ o.name, o.msgs, o.title, o.body, o.change). userData.screen/draw(fn)/app(name, o)
- `smartwatch`: smartwatch standing on its strap, face toward +z (8 cm): glowing face with time, activity ring, heart rate. o.color strap, o.time, o.bpm. userData.screen/draw(fn)/set({time, bpm, ring})
- `tablet`: tablet (26 cm, stands upright; o.flat lies screen up). o.app as smartphone (default video). userData.screen/draw(fn)/app(name, o)
- `vr_headset`: VR headset (20 cm): white visor with a black glossy front, face foam, head strap loop. o.color

## money (4)
- `coins_pile`: gold coin stacks with loose coins (o.count stacks)
- `money_stack`: banded banknote bundles (o.count bundles, piled)
- `piggy_bank`: pink piggy bank with a coin slot
- `wallet`: leather wallet with a note and a card peeking out

## nature (20)
- `boulder`: big rounded boulder ~1.2 m (o.size, o.moss)
- `bush`: round leafy bush ~1 m (o.flowers / o.berries colour or true, o.wide)
- `cactus`: ribbed cactus: o.kind tall (~2.2 m with arms) | barrel; o.flower
- `cliff`: rock cliff chunk with strata and grassy top (o.w 5, o.h 3.2, o.d 3, o.grass, o.color), top = height
- `coral-rock`: coral rock ~1 m: branching coral, brain coral, tube sponges (o.color)
- `dead-tree`: bare crooked grey tree ~3.5 m (spooky, drought, winter)
- `dune`: sand dune with wind ripples (o.r 5, o.h 1.5)
- `flowers`: patch of 5-9 flowers ~.35 m, walk-through (o.color, o.n, o.spread)
- `fruit-tree`: broadleaf tree with fruit hanging under the canopy (o.fruitColor, o.fruits count)
- `grass`: grass tufts ~.4 m, walk-through (o.n tufts, o.spread, o.tall, o.dry)
- `hedge`: trimmed hedge along x (o.length 3, o.height 1.1, o.depth .8), top = height
- `hill`: gentle grassy hill (o.r 6, o.h 1.6, o.color), walkable (solid false)
- `log`: cut log lying along x ~1.6 m, ringed ends, seat height ~.4
- `mushroom`: spotted toadstool ~.36 m (o.n 1-3, o.color cap, o.size for giant ones)
- `palm`: curved palm ~5.5 m, ringed trunk, arching serrated fronds, coconuts
- `pine`: conifer ~5 m with drooping scalloped tiers (o.size, o.tall, o.wide)
- `reeds`: reeds and cattails ~1.4 m by the water, walk-through
- `rocks`: cluster of 3-5 rocks ~1 m across (o.n, o.size, o.moss)
- `stump`: tree stump ~.5 m with root flares, ringed top (seat / top)
- `tree`: round broadleaf tree ~5 m, lush clustered leaf puffs (o.seed shape, o.size, o.fruit, o.leaves: leaf|autumn|blossom, o.wide, o.detail .3-1: fewer leaves for far trees; ~65k tris at 1)

## ocean (20)
- `anchor`: a big iron ship anchor standing on its crown, with a ring and a short chain on the ground (chain: false; stock: "wood" | "iron"; 1.8 m)
- `anemone`: a sea anemone: a stubby column crowned with swaying tentacles with light tips (color, tip; size: scale of ~0.45 m)
- `anglerfish`: a dark deep-sea anglerfish with a huge toothy underbite and a glowing lure on a stalk (userData.light: the lure's light; size: scale of ~0.8 m). Centre at origin, nose +z
- `bathysphere`: a steel deep-diving sphere with thick round windows, a bolted hatch, a lifting lug and cable; rests on y = 0 (cable: length above, default 3 m; 1.6 m)
- `buoy`: a red and white navigation buoy bobbing at the waterline (y = 0) with a blinking lamp on top (color; light: userData.light, blinks every 2.5 s)
- `coral`: a coral cluster on a rock (kind: "mix" | "branch" | "brain" | "fan" | "tube"; seed: colours and shape; ~1.2 m wide). Sea fans sway
- `diving-bell`: an old brass diving bell with round portholes and rivet bands, open at the bottom (dark inside), hanging cable (cable: length above, default 4 m; 2.3 m tall)
- `fish`: a toon fish swimming in place, nose +z (kind: "tang" tall blue/yellow, "clown" orange with white bands, "silver" sleek; seed: colour variant; size: scale of ~0.4 m). Centre at origin
- `jellyfish`: a glowing see-through jellyfish that pulses and trails tentacles (color, size: scale of a 0.7 m bell). Centre (bell) at origin; no outline
- `kelp`: a clump of tall swaying kelp strands with leaf blades and air floats (h: height, default 4 m; n strands; color)
- `lighthouse`: a red and white striped lighthouse with a gallery, a glowing lantern room (userData.light) and a sweeping beam (h default 16 m; beam: false; userData.beamSpeed rad/s; rocks: false)
- `octopus`: a toon octopus sitting on the sea floor, eight curling arms that wave, big eyes (color, size: scale of ~1.8 m spread). Sits on y = 0
- `oil-rig`: an offshore oil platform on four yellow legs: decks, a lattice drilling derrick, crane, helipad, quarters and a burning flare boom (userData.fireAt; legs stand on the water at y = 0; size: scale of a 46 m rig; below: extra leg length under y = 0)
- `sea-turtle`: a sea turtle gliding with flapping front flippers, patterned shell, head +z (size: scale of ~1.2 m). Centre at origin
- `shark`: a toon shark swimming in place, nose +z: grey-blue back, white belly, big dorsal fin, toothy grin (len default 2.8 m; teeth: false for a closed mouth). Centre at origin
- `shipwreck`: a sunken wooden ship lying tilted and half buried on the sea floor: a hole in its side shows the ribs, broken mast, barnacles, weed (len default 14 m)
- `submarine`: a cartoon submarine: rounded hull with a conning tower, periscope, lit portholes, cross fins and a spinning propeller; bow +z (len default 14 m; color; lit: false for dark portholes; spin: propeller rad/s). Centre at origin. userData.prop
- `submersible`: a deep-sea research submersible: white body, orange top, big front viewport, lamps (a real spotlight: userData.light), a claw arm, skids and thrusters; sits on its skids at y = 0, front +z (size: scale of 7 m)
- `treasure-chest`: a wooden treasure chest with brass bands and lock, gold inside (open: 0..1 lid angle; metal colour). userData.lid, setOpen(k), top
- `whale`: a big toon whale (humpback-like: long white flippers, throat grooves, flukes), nose +z, slow up-down swim (len default 12 m). Centre at origin

## office (12)
- `briefcase`: leather briefcase with gold latches
- `calendar`: wall calendar with a circled day (o.text month, o.day)
- `cheque`: bank cheque (o.to, o.amount, o.words, o.date, o.signed); userData.screen to write it live
- `clipboard`: clipboard with a checklist (o.text title); userData.screen
- `envelope`: envelope: back with flap and seal, or front with stamp + address (o.text e.g. "FINAL NOTICE")
- `filing_cabinet`: metal filing cabinet (o.count drawers, o.open = drawer index pulled out with folders)
- `notebook`: spiral notebook (o.text label, o.open)
- `paper_stack`: stack of printed paper (o.count sheets, o.text heading)
- `pen`: ballpoint pen lying down (o.color)
- `sticky_note`: sticky note with curled corner (o.text, o.stick: upright against a surface)
- `trash_can`: waste bin with crumpled paper (o.spill false)
- `whiteboard`: whiteboard with marker tray (o.text lines with \n, o.stand: on wheels); userData.screen

## party (4)
- `balloon`: shiny balloon on a string (o.len string, o.color); string end at the origin
- `candle`: lit pillar candle on a brass dish (o.lit false; userData.flame, light)
- `gift_box`: wrapped gift box with ribbon and bow (o.color, o.ribbon)
- `trophy`: gold trophy cup on a base with a plate (o.text)

## plant (2)
- `potted_plant`: potted plant (o.kind leafy|snake|cactus|bush, o.small for desks, o.pot colour)
- `vase_flowers`: vase of daisies and tulips (o.count, o.color)

## retro (22)
- `arcade_cabinet`: upright arcade cabinet "COSMO CRUSH" (1.78 m, 0.66 m wide): lit marquee, tilted screen, joystick and buttons, coin door, side art. o.color sides, o.title. userData.screen/draw(fn)
- `boombox`: big 80s boombox (0.62 m wide): two speakers with chrome rings, tape deck, glowing tuner, carry handle, antenna. o.color body
- `brick_phone`: chunky 80s brick mobile phone (22 cm, stands upright): pull antenna, green LCD, big keypad. userData.screen/draw(fn)/set(text)
- `calculator`: desktop calculator (16 cm; lies flat, o.upright stands it): LCD with segment digits, grey and orange keys, solar strip. o.value. userData.screen/draw(fn)/set(value)
- `cassette_tape`: audio cassette (10 cm; lies flat, o.upright stands it): label with handwriting, window with two white hubs. o.color shell, o.text
- `crt_tv`: chunky 80s CRT television (0.6 m wide, sits on a table or the floor): bulging glass screen, knobs, rabbit-ear antennas. o.color, o.show: cartoon | bars | news | static | off. userData.screen/draw(fn)/show(name)
- `film_camera`: 35 mm film SLR camera (15 cm): black body, chrome top plate and prism, big lens. grip in the right hand
- `floppy_disk`: 3.5 inch floppy disk (9.4 cm; lies flat, o.upright stands it): metal shutter, handwritten label. o.color, o.text
- `game_cartridge`: retro game cartridge with an original game label (12 cm; lies flat, o.upright stands it). o.title, o.color
- `game_console`: original 90s home console "PIXO 16" (30 cm) with a cartridge in the slot and a corded gamepad in front. o.color
- `gamepad_retro`: retro dog-bone gamepad (19 cm, original design): cream body, navy pads, d-pad, three coloured buttons (lies flat, o.upright to hold it up to camera). o.color
- `headphones`: retro foam headphones (17 cm): metal band, orange foam pads; stands on its pads, band up. o.color pads
- `instant_camera`: chunky instant camera (14 cm): white body, big lens, flash, a colour stripe; o.photo: true pushes a fresh photo out of the slot. o.color, o.stripe
- `joystick`: retro arcade-style joystick: black base, chrome stick with a red ball top, red fire button (17 cm base). userData.stick = the stick pivot (rotate it to tilt)
- `pager`: 90s pager (6 cm, stands upright): dot-matrix LED message window, two buttons, belt clip. o.text. userData.screen/draw(fn)/set(text)
- `radio`: vintage wooden tabletop radio (0.38 m wide): cloth grille with slats, glowing round tuning dial, two knobs. o.color wood
- `record_player`: record player (0.44 m wide): wooden base, chrome platter with a spinning record (o.spin false stops it), tonearm on the record. o.label colour. userData.platter
- `retro_computer`: beige 80s desktop computer: case with floppy drive, CRT monitor with green text, keyboard and mouse (0.5 m wide, sits on a desk). o.lines: screen text lines. userData.screen/draw(fn)/type(lines)
- `rotary_phone`: classic rotary telephone (22 cm): dome body, finger-wheel dial, handset on the cradle, coiled cord. o.color. userData.handset (lift it off)
- `tape_player`: portable cassette player with a tape in its window, play buttons on top and foam headphones lying beside it (player 14 cm tall). o.color
- `typewriter`: manual typewriter (0.4 m wide, sits on a desk): stepped round keys, platen with a typed sheet, return lever. o.color, o.text (sheet text)
- `vhs_tape`: VHS video tape (19 cm; lies flat, o.upright stands it): black shell, window with reels, handwritten label + spine label. o.text

## school (5)
- `book`: hardback book lying flat (o.text title, o.color)
- `book_stack`: stack of books (o.count)
- `chalkboard`: green chalkboard with wooden frame and chalk tray (o.text); userData.screen
- `school_chair`: plastic school chair on a tube frame, seat .46 m
- `school_desk`: school desk with book tray, top .75 m

## sky (3)
- `cloud`: puffy cartoon cloud ~4 m wide (o.size, o.color, o.under)
- `moon`: cartoon moon ~2.4 m, soft glow, faces +z (o.phase crescent | full, o.size)
- `sun`: cartoon sun disc ~3 m with rays, glowing, faces +z (o.size, o.rays false)

## space (17)
- `airlock-door`: an airlock: a wall piece with a rounded hatch door, hazard-striped frame, wheel handle, status lamp and keypad (state: "locked" | "open"; open: 0..1). userData.door, lamp, setOpen(k) slides the door into the wall
- `asteroid`: a tumbling potato-shaped asteroid with craters (size: length m, default 3; spin rad/s, default .25; seed). Centre at origin
- `comet`: a comet: icy nucleus in a glowing coma with a long blue-white tail streaming toward -z (size: nucleus m, default 1.2; tail length = 14 x size). Centre at origin
- `crater`: a crater: a raised rim around a shallow bowl on flat ground (r: rim radius, default 3; color matches the ground). Walkable (solid: false)
- `crew-capsule`: a cone-shaped crew capsule on its heat shield (d: base diameter, default 4; chutes: three parachutes above it, for splashdowns). userData.hatch
- `gas-giant`: a banded gas giant with a storm spot and a tilted ring (r default 5; ring: false to drop it; colors: band palette; spin). Centre at origin
- `lunar-lander`: a lunar lander on four legs: gold-foil descent stage, silver crew cabin with windows, ladder on the front leg (size: scale, default 1 = 6.6 m tall). userData.cabin (the ascent stage)
- `moon-rocks`: a small cluster of rounded grey moon rocks (color, n, seed; ~1.3 m wide)
- `planet-earth`: an Earth-like planet with oceans, green and tan continents, ice caps, a cloud layer and a blue atmosphere glow (r default 3; spin rad/s; seed: other continents). Centre at origin
- `planet-red`: a rusty red desert planet with dark plains, craters and a white polar cap, thin pink haze (r default 3; spin; seed). Centre at origin
- `rocket`: a rocket standing on its launch pad with a service tower (h: height of the rocket in m, default 30; pad, tower, color accent, body colour, name: side text). userData.ship lifts off (move it), exhaustAt
- `rover`: a six-wheeled planetary rover with a camera mast that has two lens eyes, dish antenna and power unit (scale; 3 m long). userData.wheels (spin on x), head (the mast camera, turn it)
- `satellite`: a satellite floating (centre at origin): gold-foil body, two solar wings facing +z, dish on top (size scale; 12 m span; spin: roll speed rad/s)
- `small-moon`: a small grey moon covered in craters (r default 1.5; userData.spin rad/s, default .15; seed). Centre at origin
- `space-flag`: an expedition flag on a pole with a top bar (no wind needed; colors: [field, emblem], text: a word under the emblem, wind: true to ripple). 2.6 m
- `space-helmet`: a white space helmet with a gold reflective visor on a display stand (1.4 m). Without the stand: stand: false (helmet sits on y = 0, 0.45 m)
- `station-module`: a space-station module floating (centre at origin), long along x, windows on its +z side, docking ring at +x, solar panels above and below (len default 9; panels)

## storage (2)
- `cardboard_box`: taped cardboard box with FRAGILE print (o.size [w,h,d], o.text, o.open)
- `crate`: wooden slat crate (o.kind plastic, o.text stencil, o.fill "apples")

## street (18)
- `barrier`: road barrier 1.6 m: striped planks, warning lamp (o.lit, o.flash)
- `brick-wall`: brick wall along x with coping (o.length 4, o.height 1.2, o.color); top, seat when low
- `bus-stop`: bus shelter 3.2 m: roof, glass back, ad poster (o.lit, o.poster {title, sub, c1, c2}), bench seat .48, BUS sign (o.text)
- `crosswalk`: zebra crossing: stripes along x spanning o.width (6) in z, o.length 2.6
- `fence`: wooden post-and-rail fence along x (o.length 4.8, o.color)
- `gate`: picket garden gate between posts; userData.door hinge group (o.open 0..1)
- `hydrant`: fire hydrant ~.8 m (o.color)
- `mailbox`: street mailbox ~1.25 m with slot and label (o.text MAIL, o.color)
- `manhole`: manhole cover ~.9 m, flat
- `park-bench`: park bench 1.7 m: cast-iron sides, wooden slats, seat .48 (o.color wood, o.length)
- `phone-booth`: phone booth ~2.6 m with glazing bars and a PHONE sign (o.lit, o.text, o.color)
- `picket-fence`: white picket fence along x ~1 m tall (o.length 3, o.color)
- `road`: straight road along x: asphalt, lane lines, curbs (o.length 20, o.width 7, o.sidewalk m, o.center colour); sidewalkY
- `road-sign`: sign on a pole: o.kind street (o.text, o.text2) | round (o.text 20) | warn (o.text !) | arrow (o.text); userData.screen
- `street-bin`: slatted public litter bin ~.95 m (o.color)
- `street-lamp`: street lamp: o.kind classic (globe ~3.9 m) | curved (arm over +z ~4.6 m); o.lit glows + userData.light
- `traffic-cone`: orange traffic cone ~.7 m with white bands
- `traffic-light`: traffic light ~3.4 m (o.state red|yellow|green, userData.setState)

## tools (6)
- `broom`: broom standing on its bristles (grip at 1.0 m)
- `bucket`: plastic bucket with wire handle (o.water)
- `hammer`: claw hammer lying on its side
- `ladder`: A-frame step ladder 1.5 m
- `toolbox`: metal toolbox with carry handle
- `wrench`: open-end / ring spanner lying flat

## travel (1)
- `suitcase`: hard-shell rolling suitcase (o.handle: telescopic handle up)

## vehicle (16)
- `ambulance`: ambulance van 5.4 m: white box, red stripe, plus emblem, light bar (o.flash)
- `bicycle`: bicycle 1.75 m along z (o.color frame), seat .96, grip on the bar
- `bus`: city bus 10 m: window band, doors on -x, destination sign (o.text, o.lit), o.color, o.color2
- `car`: chunky car 3.9 m (o.color, o.lit headlights), top = roof
- `fire-truck`: fire engine 8 m: lockers, ladder, hose reel, light bar (o.flash)
- `helicopter`: helicopter: bubble cabin, tail boom, skids, 8.6 m rotor (o.color, o.spin); userData.rotor
- `hot-air-balloon`: hot-air balloon ~10 m: striped envelope, wicker basket (top = basket floor), burner flame (o.lit, o.color, o.color2)
- `motorbike`: motorbike 2 m along z: tank, seat .86, chrome pipe (o.color, o.lit)
- `motorboat`: motorboat 5 m: windscreen, seats, outboard motor (o.color); waterline
- `plane`: small high-wing propeller plane 6.5 m, wings 8.6 m, on its wheels (o.color, o.accent, o.spin); userData.prop
- `police-car`: navy and white police car with light bar (o.flash animates it, o.text)
- `rowboat`: hollow wooden rowboat 3 m with seats and oars; keel at y 0, userData.waterline (sink it to that in water)
- `sailboat`: sailboat 5.5 m, mast ~7.4 m, mainsail + jib, cabin (o.color hull, o.sail); waterline
- `taxi`: yellow taxi with checker band and roof sign (o.text, o.lit)
- `train-carriage`: train carriage 12 m on two bogies: window row (o.lit), doors, roof (o.color, o.color2)
- `truck`: delivery truck 7.2 m: cab + cargo box with an invented name (o.text, o.color cab, o.box)

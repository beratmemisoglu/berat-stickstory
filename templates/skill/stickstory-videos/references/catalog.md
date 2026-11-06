# Catalog: every name a scene can use

Read from the engine's own registries on 2026-10-23 (the lab's `--dump` of PROP_REG, FX, INFO, PLACES, POSES, GESTURES,
WALKS and a dump scene for spots, camera hints, cast, faces, overlays; experiments/stickstory-style/lab/skilldump). When
a name here and the engine disagree, the engine wins: `check_preview` warns about unknown places, props, moods, fx and
info kinds (`unknown place "x": known ...`).

## 1. Places (`S.place(name, { mood, seed, colors, ...options })`)

Format: name (family, default mood): what it is. **Options.** Spots (name:kind/facing). Camera hints (`P.cam.<name>`).
Doors (`P.doors.<name>.open(t, dur)`). Every room place also has the stand spots `center`, `left`, `right` (and most
`entry`); every place has `P.cam.wide` and `P.cam.full`, stage places also `P.cam.close`.

Moods (any place; each has its own default): `day` `dusk` `evening` `night` `candle` `alarm` (red) `violet` `blue`
`memory` (grey flashback) `dim`. Friendly names: dining room, living room, home office, office floor, call center,
hideout, laboratory, hall, entrance, school, school corridor, hospital room, shop, store, coffee shop, car, bus stop, roof,
city, parking garage, parking, school yard, police station, interview, prison, tv studio, talkshow, nap room, table, macro,
plain; sports field, pitch, football pitch / field, soccer field / pitch, town field, playing field, sports ground,
running track (all = `field`, the eye-level pitch with a horizon).

**Every outdoor place needs its horizon** (a sky + a far layer) at the framing you use: `stadium` is a high-angle painted
card with NO sky - a medium or close-up in front of it is a flat green wall (video 02's town field). Sports at eye level =
`field`.

### Homes and work (room family)
- `bedroom` (room, night): window with brown curtains (rain at night), wall clock, nightstand with a bedside lamp and photo, double bed with a purple duvet, floor lamp, door at the right. **mood** night (lamp-lit warm) | day | dusk | blue (moonlit) | candle; **lamp: false** (night without the lamp: blue); **door** 'closed' | 'ajar' | 'lit' | 'litAjar'; **rain**; **duvet** '#hex'; **kid: true** (single bed). Spots: nightstand:table, bed:bed, bedside:seat, door:door, window, entry. Cams: wide, full, bed. Doors: door.
- `hallway` (room, day): beige wall, front door + a room door, family photo, coats on hooks, runner rug, shoe rack. **mood** day | evening | night; **front** 'closed' | 'open' | 'lit' | 'ajar' (spot door); **room** (spot roomDoor). Spots: roomDoor:door, door:door, coats, entry. Cams: wide, full. Doors: roomDoor, door.
- `homeoffice` (room, day): panelled door, wardrobe, metal shelf with coloured boxes, a bicycle wheel and a printer, three blueprints, desk with monitor, desk lamp and mug, office chair, round rug, window with a skyline. **mood** day (cool) | night (monitor bloom, moon) | dusk | blue | evening; **screen** 'dark' | 'text' | 'code' | 'chart' | 'off'. Spots: door:door, desk:table, chair:seat/1, window, shelf, wardrobe, entry. Cams: wide, full, desk. Doors: door.
- `kitchen` (room, day): door, clock, calendar, green cabinets, tiled counter with sink and oven, window with yellow curtains, pendant lamp over a dining table with a check cloth and 3 chairs, family photo, wall TV, fridge. **mood** day | dusk | evening | night | candle (+ memory, dim); **party: true** (bunting); **door** 'closed' | 'open' | 'lit' | 'ajar' (night default lit); **lamp**; **table: false**; **chairs** ['left', 'right', 'back']; **tv** 'news' | false. Spots: door:door, counter / sink / stove / counterTop:counter, fridge, table:table, chair1:seat/1 (faces right), chair2:seat/-1 (faces left), chair3:seat (back, front view), window, entry/1. Cams: wide (the back wall, NOT the table), full (the whole room incl. the table), right, table, counter. Doors: door.
- `livingroom` (room, evening): door, a row of small framed pictures, sofa, coffee table on a rug, floor lamp, sideboard with plant and router, wall TV option. **mood** evening (warm lamp) | day | night | dusk | blue; **tv: true**; **window: true**; **sofa** '#hex'. Spots: door:door, sofa1 / sofa2 / sofa3 / sofa:seat, sofaLie:bed, table:table, sideboard:counter, entry. Cams: wide, full, sofa. Doors: door.
- `callcenter` (room, night): high violet strip windows, fluorescent tubes with haze, 4 rows of desks with blue monitors and seated worker silhouettes with headsets; a wall board of scribbles. **mood** night | blue | alarm; **rows** 2-5; **workers**; **board: true**. Spots: row1-row5:seat, aisle, door:door. Cams: wide, full, desk. Doors: door.
- `lab` (room, day): window, a wide two-panel whiteboard with blue scribbles, a shelf of 16 coloured binders, a long lab counter with a microscope, a test-tube rack and a device, a stool. **mood** day (white) | evening | night; **board** 'scribble' | 'clean' | 'diagram'; **title** 'PROJECT: ...'. Spots: counter:counter, board, window, stool:seat. Cams: wide, full, close, board.
- `office` (room, night): an open-plan office floor at night: ceiling light panels, tall windows on the night city between columns, EXIT door with a green sign, LED clock box, three elevators with floor digits, four desk islands with monitors, keyboards and chairs. **mood** night | alarm (red) | violet | blue | day; **islands** 1-5; **led** '00:00' | false; **floor** '1'; **elevators**. Spots: door:door, elevator1-3:door, desk1a / desk1b ... desk4b:seat, island1-4:table, windows, elevators, entry. Cams: wide, full, close, elevators, desks. Doors: door.
- `workshop` (room, night): a hideout: cinder-block wall, dark wooden slats, papers and charts pinned with red pins, a pendant cone lamp with a big light cone on the wall, a long table with a laptop, a trash can, a coat. **mood** night (lamp) | day | blue; **lamp: false**; **papers** 3-8; **led** '2:15:00' | false. Spots: table:table, wall. Cams: wide, full, table.

### Storybook stages (stage family: one strong hue, near-black furniture, dust motes)
- `apartment` (stage, night): a dark blue room with a wall-wide window onto the night skyline (fireworks option), a long low sofa, a wall shelf, a coffee table. **mood** night | dusk (sunset window) | day; **fireworks: true**; **hue** navy | violet | any stage hue. Spots: sofa1-3:seat, window, table:table. Cams: wide, close, full.
- `bakery` (stage, day): cream tiled wall, two shelves of loaves, a brick oven with a fire glow, a pendant lamp, a long wooden counter for kneading. **mood** day | dusk | night; **fire: false**. Spots: counter:counter, baker, oven. Cams: wide, close, full.
- `bathroom` (stage, day): mint tiled wall, white sinks with mirrors above, a tiled floor. **mood** day | night | dim; **sinks** 2-4. Spots: sink1-3:counter. Cams: wide, close, full.
- `classroom` (stage, day): beige wall, alphabet strip over a green chalkboard, a wall clock, a big window (right), rows of school desks and chairs as near-black silhouettes. **mood** day | dusk | dim | memory; **board** 'A B C'; **pupils: true** (seated pawn silhouettes); **desks** 4-6. Spots: desk1-4:seat/1, board, window. Cams: wide, close, full, board.
- `gym` (stage, day): a changing room / gym corridor: warm yellow wall, lockers in alternating rust and green, a notice board, a bench. **mood** day | dusk | dim; **lockers** 8-14. Spots: bench:seat, lockers. Cams: wide, close, full.
- `inauguration` (stage, day): a pale blue sky with falling confetti, a white columned capitol with flags, a podium with a gold seal on a platform, a big crowd of pawn silhouettes holding up lit phones. **mood** day | dusk; **confetti: false**; **crowd: false**; **flags** '#hex'. Spots: podium:counter, platform, crowd. Cams: wide, close, full, podium.
- `kindergarten` (stage, day): orange nap room, window with sunset light shafts, four kids' drawings, a wall clock, a row of cots with coloured blankets and pillows, a toy table. **mood** day (orange) | dim (the desaturated end) | dusk | night; **cots** 3-7; **kids: true** (small sleeping heads). Spots: cot1-cot5:bed, window. Cams: wide, close, full, cot.
- `stage` (stage, day): the storybook stage room template: one strong hue, wall with a soft light, wainscot, flat floor band with a sheen, window shafts, dust motes; add your own props. **hue** orange | yellow | blue | green | pink | mint | cream | red | violet | navy | teal | grey (or **colors** { wall, lower, floor, base }); **mood** day | dusk | night | dim | memory; **window** 'left' | 'right' | false; **clock**; **frames** n; **shelf**; **motes: false**. Spots: center, left, right, back. Cams: wide, close, full.
- `studio` (stage, night): a TV studio (talk show / debate): deep blue-violet set, a night-city backdrop with a big show screen, the host desk with a logo disc, a guest sofa (or two debate lecterns), audience heads. **show** 'talk' | 'debate'; **title** 'THE BIG TALK'; **names** ['MAX', 'SEN. VOSS']. Spots: host:seat/-1, guest:seat/1. Cams: wide, close, full.
- `study` (stage, day): a child's study: cool blue wall, a high shelf of coloured books, a long dark desk, a floor lamp silhouette, book stacks, a strong floor sheen. **hue** blue | any stage hue; **mood** day | dusk | night. Spots: desk:table, floor:seat/1. Cams: wide, close, full.
- `theatre` (stage, night): red velvet curtains framing a raised stage, a gold proscenium line, a spotlight cone with a floor pool, rows of dark audience heads in the foreground. **mood** night | day; **audience**; **spot** x of the spotlight; **curtain** '#hex'. Spots: stage, stageLeft, stageRight, center. Cams: wide, close, full, stage.
- `whiteroom` (stage, day): a bare white room with a heavy vignette, an empty frame, a simple table (hospital / afterlife / dream). **mood** day | memory | night; **table**; **frame**. Spots: table:bed. Cams: wide, close, full.
- `stadium` (stage, day, shadows): a school sports day seen from HIGH up: plum stands with a banner, a red running track with white lane lines, mowed grass - one painted backdrop card, no sky. **Wides only** (a medium / close-up at eye level is a flat green wall: use `field`). **mood** day | dusk; **banner** 'SPORTS DAY'; **flag**. Spots: start, finish. Cams: wide, close, full.
- `schoolyard` (stage, day, shadows): a red-brick school with white-framed windows, a door on steps with a porch light, a flag, an iron fence with a banner, round hazy trees, a pale sun. **mood** day | dusk | night; **banner** 'SPORTS DAY' | false. Spots: door:door, steps:seat. Cams: wide, close, full.

### Outside (room family, `shadows: true`)
- `busstop` (night): a glass shelter with a roof and a BUS sign, a timetable panel, a bench, a city bus with lit windows and an LED route number, a street lamp, rain and puddles. **mood** night | day | dusk; **rain** (default at night); **bus**; **route** '12'. Spots: bench:seat, stop, busDoor. Cams: wide, full.
- `field` (day): a football pitch / town sports field AT EYE LEVEL with a real horizon (lessons 02-handshake): mowed grass with white pitch lines, ad boards, a red running track, a small covered stand with spectators and a banner, two floodlight masts, a tree line, far hills, a clear sky with clouds (sunset at dusk, stars + lit floodlights at night). Every framing shows the horizon; close-ups blur it. **mood** day | dusk | night (floodlights on, the pitch stays green); **view** 'side' (default: across the pitch, the halfway line and the centre circle round the people) | 'goal' (facing a goal: net, six-yard box, penalty box, spot, arc); **banner** 'TOWN CUP' | false; **crowd: false**; **track: false**; **lights: false**; **goalX**, **standX** m. Spots: center, left, right, halfway (side), goal / penalty / box (goal view), touchline, track, trackStart, trackFinish, bench:seat (front). Cams: wide, full, low, stand, goal (goal view).
- `garage` (day): an underground parking garage: concrete pillars, a yellow LEVEL -3 band, hazard stripes, fluorescent tubes, parking lines, parked cars. **mood** day | night | alarm; **level** '-3'; **cars**. Spots: car. Cams: wide, full.
- `house` (dusk): a cream house with a gabled red roof, a door with a porch light, a lit window, a lawn, a fence, a round tree, hills, a sunset sky. **mood** dusk | day | night; **door** 'closed' | 'open'. Spots: door:door. Cams: wide, full.
- `park` (night): row houses with lit windows behind a dark hedge, round trees, a park bench, lamp posts, a paved path. **mood** night | day | dusk; **bench**; **rain**. Spots: bench / bench1-3:seat. Cams: wide, full, bench.
- `rooftop` (night): a concrete ledge and roof, vents and an antenna, the skyline behind (lit tower, far city dots, mountains, moon, stars). **mood** night | dusk | day; **moon: false**. Spots: ledge. Cams: wide, full.
- `skyline` (night): an establishing view: navy sky, moon with a halo, stars, mountains, a tower with a 13 x 28 window grid, far city dots (no ground). **mood** night | dusk | day; **moon: false**; **towerX** m. Spots: center. Cams: wide, full, tower.
- `street` (day): a row of facades with shop fronts (cafe with a striped awning, electronics, bakery, books) and a stone bank, steps, a lit ATM and a billboard; street lamps; pavement, kerb and road. **mood** day | dusk | night | memory; **rain**; **billboard** 'TEXT' | false; **cars**; **names** { cafe, shop, bank, books }. Spots: atm, bankDoor:door, cafe, shop, kerb. Cams: wide, full, close, bank.

### Special rooms (room family)
- `backdrop`: a plain close-up background: a soft gradient wall in a colour (or a set's wall colour for its mood), optional blurred lamp bokeh or a window light patch. **color** '#hex' | **like** 'kitchen' | 'bedroom' | 'office' | ...; **mood**; **bokeh** true | n; **window**; **dark**. Also `S.backdrop(...)`.
- `cafe` (day): a long counter with a till and a cake display, a chalk menu board, shelves of cups and jars, pendant lamps, bar stools, a window to the street. **mood** day | evening | night; **kind** 'cafe' | 'shop'; **name** 'CORNER CAFE'. Spots: counter:counter, barista, customer, till, stool1-3:seat, window. Cams: wide, full.
- `carInterior` (day): inside a car, side view (far door with windows onto a passing street, seats in profile, dashboard, wheel) or **view: 'front'** (the driver through the windscreen). **mood** day | dusk | night; **color**; **outside** 'street' | 'trees' | 'city'. Spots: driver:seat/1, back:seat/1, passenger:seat/1, wheel. Cams: wide, full, driver.
- `cell` (day): concrete block walls, a steel door with a hatch, a high barred window throwing a warm light patch, a bunk, a hanging bulb. **mood** day | night | blue. Spots: door:door, bunk:seat, bunkLie:bed. Cams: wide, full. Doors: door.
- `corridor` (day): a long one-point corridor: doors along both walls, ceiling lights, a tiled floor; walk toward or away from the camera. **kind** school | hospital | office | vault | prison; **mood** day | night | memory | blue | alarm; **length** 18; **width** 3.2; **doors** 3 per side. Spots: doorL1-3:door/1, doorR1-3:door/-1, far, mid, near. Cams: wide, full.
- `elevator` (day): the steel cabin through its open doors from the landing, handrail, lit ceiling, floor indicator, call buttons. **mood** day | night | alarm; **floor** 'L' | '12'; **doors** 'open' | 'closed'. Spots: back, landing, door:door. Cams: wide, full.
- `hospital` (day): pale green-grey walls, a window, a hospital bed with rails, a heart monitor, an IV stand, a privacy curtain, a visitor chair, a door with a small window. **mood** day | night | evening; **monitor**; put the patient on spot `bed` (`S.char(id, { lie: 'bed' })`). Spots: door:door, bed:bed, bedside:seat, chair:seat/-1, window. Cams: wide, full, bed. Doors: door.
- `interrogation` (night): dark concrete walls, a one-way mirror, a hanging lamp with a hard light cone over a metal table with two chairs. **mood** night | day | blue. Spots: door:door, table:table, chair1:seat/1, chair2:seat/-1, mirror. Cams: wide, full, table. Doors: door.
- `library` (day): tall shelves of coloured spines, a reading table with two green lamps and chairs, a door with a PUSH sign, a clock. **mood** day | evening | memory; **table**. Spots: door:door, table:table, chair1:seat/1, chair2:seat/-1, shelves. Cams: wide, full. Doors: door.
- `lobby` (night): a glass curtain wall onto the dark street, a reception desk, a bench, an LED clock box, a polished floor. **mood** night | day | blue; **police: true** (blinking light bars outside); **led** '00:00'. Spots: desk:counter, guard, bench:seat, glass. Cams: wide, full.
- `police` (day): blue-grey walls, a long front desk with a computer, a notice board with wanted posters, a clock, a waiting bench, a barred door. **mood** day | night | evening. Spots: door:door, desk:counter, officer, front, bench:seat. Cams: wide, full. Doors: door.
- `stairwell` (night): a flight of stairs rising across the frame with a railing, a landing, a big painted floor number, a caged lamp, a fire door. **mood** night | day | alarm; **level** '11'. Spots: door:door, bottom, top, stairs. Cams: wide, full. Doors: door.
- `tabletop` (day): a top-down surface for inserts: wood planks, kitchen tiles, a dark desk, a bed sheet, a check cloth. **surface** wood | tiles | desk | sheet | cloth | marble | concrete; **mood** day | dusk | night | candle; **light** 'left' | 'right' | 'top'. Spots: center, left, right, top, bottom, topLeft, topRight, bottomLeft, bottomRight (kind surface). Cams: wide, full, top, close. Also `S.tabletop(surface, o)`.

## 2. Cast (`S.char(id)`; `'main'` = the project's main character)

| id | who |
|---|---|
| `you` | the blue-hoodie "you" hero (default main character) |
| `rae` | the red-hoodie hero (any age: rae@kid, rae@small) |
| `pip` | little sister: top-knot with a teal bow and hair clip, plain black body |
| `nora` | mother: round glasses and a cream knit scarf |
| `vera` | mother: teal coat-dress with a yellow belt, bun with long hair |
| `hal` | father: grey suit, blue tie, white cuffs, watch |
| `gus` | father: blue track jacket, yellow headband |
| `bree` | girl: pink hoodie, top bun |
| `krane` | villain: bald, brown moustache, lab coat over a brown vest |
| `sterling` | boss: navy suit, slicked hair, dark tie |
| `remy` | call-centre worker: curly hair, headset, ochre jacket with an ID card |
| `walt` | old man: fedora, round glasses, white moustache, tan trench coat |
| `edna` | old woman: grey hair with a bun, round glasses, cream scarf |
| `dale` | coach: green hoodie, navy flat cap, whistle |
| `kit` | small kid (about 5): red hoodie, a hair tuft |
| `teo` | kid (about 10): yellow t-shirt, red cap |
| `zed` | kid: green t-shirt, orange beanie |
| `lulu` | small girl: pigtail buns, purple dress |
| `ada` | doctor: teal scrubs, ponytail |
| `ivy` | scientist: lab coat, square glasses, bob hair |
| `tess` | teacher: yellow dress, top bun |
| `june` | young woman: white dress, long hair |
| `finn` | builder: yellow hard hat, orange t-shirt |
| `cody` | rancher: cowboy hat, denim shirt |
| `sam` | graduate: gown and mortarboard |
| `ozzy` | prisoner: grey striped robe |
| `bo` | cook: white toque, red t-shirt, white apron |
| `max` | police officer: blue uniform, star badge, navy cap |
| `abe` | grandfather: white hair, glasses, brown sweater |
| `nell` | office worker: white shirt, red tie, ponytail |
| `jax` | teen: purple hoodie, headphones |
| `rook` | armoured guard: helmet with a green visor, no face (repeat for squads) |
| `extra`, `extra-warm`, `extra-grey`, `extra-night` | faceless background people (purple, warm crowds, grey memory, night) |

Ages: `adult`, `teen` (0.9x), `kid`, `small` (about 5), `elder` (adult body + the old person's props): `'id@kid'`.

A look object (`S.char({ ... })` or `{ base: 'id', ...changes }`): `name`, `age`, `outfit: { top, color, color2, pants,
shoes, watch: 'L' | 'R' | 'both', cuff, pocket, strings, hood, tie, belt, badge, lanyard, whistle, apron, hem, sleeves,
inner }`, `hair`, `hairColor`, `hairAcc`, `hat`, `hatColor`, `glasses: 'round' | 'square'`, `moustache: 'brown' |
'white'`, `clip` (colour), `scarf` (colour), `rim`, `face` (default expression), `handStyle: 'glove' | 'flat'`,
`cast: 'L' | 'R'` (a white plaster cast on that forearm: every framing, close-ups and that side's hand inserts),
`sling: true` (the cast arm in a pale-blue sling across the chest; holds and gestures use the other hand), `castColor`,
`slingColor`. Per shot: `S.char('abe', { cast: 'L', sling: true })`; for a whole stretch, one look in models.js
(`export const ABE_HURT = { base: 'abe', cast: 'L', sling: true }`).
- tops (`outfit.top`): none, hoodie, tee, tank, sweater, shirt, suit, jacket, track, coat, labcoat, dress, coatdress,
  skirt, robe, gown, scrubs, apron, uniform, armor, vest.
- hair: tuft, topknot, topbun, bun, bunlong, buns, ponytail, ponytail-top, bob, long, curls, afro, spikes, grey, greybun,
  white, bald, slick.
- hats: cap, beanie, hardhat, cowboy, fedora, flatcap, headband, gradcap, helmet, headset, headphones, toque, beret,
  crown, bandana, party.
- rim colours (`RIG.RIMS`, a place sets its own): warm #f8ba74, sunset #f5a85f, amber #e1995b, peach #e09a85, evening
  #de977c, salmon #dfa093, night #8dc6f2, cool #97cbf8, white #dfe6f5, grey #c9c6cf, pink #f0a0b8, green #9fe0b0.
- Identity rule: one saturated signature colour on the top + at most 1-2 accessories; the same look in every shot.

## 3. Poses (`a.pose(name)`, `S.char(id, { pose })`) and gestures (`a.gesture(name)`)

Standing poses: `stand` (arms hanging), `armsCrossed`, `handsOnHips`, `thinking` (hand on the chin), `handsOnHead`
(panic), `cheer` (V), `armsUp` (surrender), `shrug`, `cower`, `facepalm`, `point`, `present` (open hand to the side),
`explain` (one hand, palm up), `fidget` (hands together, nervous), `handsBack`, `pockets`, `wave`, `fist` (one fist
raised), `bow`, `stretch`.
Seated poses (`posture` of `sit`): `upright` (hands on the thighs), `slumped`, `leanTable` (forearms on the table),
`headInHands`, `typing`, `eating`, `phoneLap`.

| gesture | in / hold / out (frames) | what |
|---|---|---|
| `wave` | 5 / 24 / 5 | arm up, forearm swings every 2-3 frames |
| `point` | 5 / 28 / 5 | accelerating in, hard stop, slow creep (`a.point(target)` aims it) |
| `reach` | 4 / 24 / 4 | toward someone, stops 0.3 heads short |
| `shrug` | 5 / 16 / 6 | |
| `crossArms` | 8 / 48 / 6 | |
| `thinking` (= `chin`) | 6 / 40 / 6 | hand to the chin |
| `facepalm` | 4 / 24 / 6 | |
| `handsOnHead` | 2 / 18 / 7 | snaps on in 2 frames, no in-betweens |
| `fistPump` | 3 / 14 / 5 | fist down 3 f, punch up 3 f |
| `cheer` | 6 / 28 / 5 | both arms up in a V, no anticipation |
| `celebrate` | 6 / 36 / 5 | arms up and bouncing |
| `clap` | 4 / 30 / 4 | one clap every 3 frames |
| `cower` | 4 / 30 / 8 | |
| `handsOnHips` | 6 / 40 / 6 | |
| `fidget` | 5 / 48 / 5 | hands rubbing (loop 12 f) |
| `talk` (= `explain`) | 5 / 20 / 5 | talking hand with small beats (loop 14 f) |
| `present` | 6 / 30 / 6 | open-hand presenting |
| `armsUp` | 3 / 30 / 6 | hands up |
| `stretch` | 10 / 20 / 8 | |
| `bow` | 8 / 10 / 8 | |
| `laugh` | 3 / 36 / 6 | snap forward 3 f, then a 6-frame bob (+ face `happy`) |
| `headScratch` | 6 / 30 / 6 | scratch the head (loop 5 f) |
| `fist` | 5 / 40 / 5 | one fist raised and held |

`hold` in the options is SECONDS (`{ hold: 1.2 }`), `until` an end time; `side: 'L' | 'R'` for one-handed ones.

## 4. Walks (`a.walk(to, at, { style })`)

| style | frames a step | what |
|---|---|---|
| `normal` | 8.7 | everyday walk, arms +-12 deg (the default) |
| `medium` | 7.5 | a bit quicker |
| `brisk` | 5 | quick purposeful walk, arms +35 / -23 |
| `slow` | 10 | slow, head a little down |
| `tired` | 8.7 | heavy, head down |
| `sad` | 10 | sad shuffle, head down |
| `sneak` | 9 | tiptoe, knees bent, arms up (not in the references) |
| `kid` | 5.8 | child walk (the default for kids) |
| `elderly` | 10 | bent forward (not in the references) |
| `jog` | 4.5 | |
| `run` | 3.5 | adult run, lean 15-20 deg, elbows 90 pumping |
| `kidRun` | 4.2 | child run, very bouncy |

## 5. Faces

Expressions (`a.face(name)`, `face:` option): `neutral` (the default half-lid + flat line, the most common), `bored`,
`oh` (half-lid + O), `talk`, `calm` (eyes closed), `sigh`, `sleepy`, `tired` (raised brows, purple under-eye arcs),
`smile` (dot eyes + smile), `content`, `happy` (^ ^ + smile), `laugh` (^ ^ + O), `ha` (laugh + the HA! sticker), `grin`,
`evil` (the mastermind's tilted grin), `smug`, `smirk`, `scheming` (smug + a sparkle), `wink`, `winkHappy`, `love`
(hearts), `surprised` (dot eyes + small o), `shock` (ring eyes + tall O: the big shock face), `shocked` (+ raised brows),
`scared` (ring eyes, worried brows, wavy mouth), `panic` (+ the head glint), `worried` (sad brows, grey dot eyes),
`nervous` (+ wavy mouth + sweat drop), `sad` (sad brows, teary under-arcs, frown), `teary` (moved: small smile), `cry`
(grimace, tear drop + stream), `sob`, `weep` (closed eyes, streams), `happyTears`, `joyTears`, `angry`, `mad` (angry +
shouting O), `determined`, `frustrated` (> <), `pained`, `sideEye`, `thinking` (looking up-side, one brow raised),
`confused`, `disgust`, `genius` (orange light streaks: the mastermind), `dazed` (| | eyes), `blank`, `none`.
Aliases: scheme, shocked2, joy, glad, upset, crying, fear, afraid, annoyed, proud, excited, laughing, terrified, thinking2,
idle, default.

Custom faces from parts (`a.face({ eyes, brows, mouth, extras, look, mouthX, mouthRot, eyeColor })`):
- eyes: half, dot, big, ring, happy, laugh, closed, closedDown, squeeze, bars, glow (or `[left, right]`)
- brows: sad, worried, angry, mild, raised, lifted, flat, up
- mouths: line, short, smile, smileSmall, smileBig, smirk, smirkSide, grin, o, O, oSmall, oTiny, frown, wavy, grimace,
  grimaceB
- extras: tears, tearL, tearR, streams, streamL, streamR, underTired, underTeary, underGrey, sweat, sparkle, glint, ha,
  hearts, glowEyes

Hand-insert poses (`RIG.Hand(look, { pose })`, `h.setPose(name)`): flat, open (= palm), fist, point, press, grip, pinch,
pen, hold-phone (= phone), phone-pov, phone-ear, hold-cup (= mug), sheet, clasp (thumb along the top), dangle, cup
(= open-palm), wave, shake + shakeWrap (the two hands of a handshake: build it with `S.hand(null, { shake: 'who' })` /
`S.handshake(a, b)`, never with two hand cards laid over each other), holdOpen (holding hands, before the fingers
close), pinky / pinkyHook / pinkyHookUp (a fist with the little finger out / hooked down / hooked up).

Two-hand close-ups (engine_api.md §13), one call each - never two hand cards on one spot: `S.handshake(a, b, { pump })`,
`S.handhold(a, b, { at, squeeze, up })` (holding hands: a's fingers curled over b's hand, arms in a V),
`S.fistBump(a, b, { at })` (knuckles meet + a small pop), `S.pinkyPromise(a, b, { at, pump })` (the little fingers hook).

## 6. Props (`S.prop(name, o)`, `a.hold(name)`), by tag

Every prop also takes `scale`, `facing`, `mood`, `style` ('flat' | 'outline' | 'silhouette'), `tint`, `color`, `seed`,
`detail`. ORIGIN = where `at: [x, y, z]` puts a wall thing (default: its bottom centre on the floor).
Friendly names: kitchenChair, diningChair, swivelChair, barStool, parkBench, lockerBench, couch, hospitalBed, singleBed,
kitchenTable, diningTable, coffeeTable, officeDesk, schoolDesk, bar, bookshelf, lamp (tableLamp), smartphone, cellphone,
computer, screen (monitor), notepad, document (paper), letter (envelope), note (stickyNote), coffee (mug with steam),
police (policeCar), bicycle, streetLight, trash, gift, cash, photo, drawing, blueprint, frame, wallClock, deskClock,
cabinet, fireHydrant, trafficCone, teddyBear, sedan, motorcycle.

**furniture**
- `chair` wooden kitchen / dining chair. view side (default, sitter faces right) | front | back; color, legColor, facing
- `officeChair` office swivel chair. view side | back | front; color
- `schoolChair` school chair. view side | front; color, frame
- `stool` variant kitchen (.62) | bar (.76 padded) | low (.45, a grown-up's flat-foot height) | lab; h, color. No back: the
  sitter's own `facing` wins; a sitter whose feet can't reach the floor flat puts them on its rung (`S.char(id, { sit:
  stool, feet })`, engine_api §6.3)
- `bench` frontal. variant park | locker | bus | stadium; w, back, color; seats[] along it
- `sofa` frontal. seats 1-3, color, cushions, pillows: false; seats[] + lie
- `armchair` frontal, one seat; color
- `bed` along its long side, headboard left. variant double | single | hospital; duvet flat | body | folded | false, duvetColor, color; lie + seat (edge)
- `table` variant kitchen (check cloth) | dining | coffee | side | cafe (round); cloth check | plain | false, w, h, color
- `desk` variant office | home | school | reception; w, h, color
- `counter` variant kitchen | bar | lab | shop; w, h, sink, oven, hob, color, top
- `nightstand` with a drawer; color
- `shelf` variant metal | book | wall (one board, origin at the board); items boxes | books | binders | mixed | none | [per level]; levels, seed
- `wardrobe` two doors; w, h, color
- `rug` lying on the floor. variant oval | rect; w, d, color
- `floorLamp` drum shade; lit (default), glow, glowR
- `tableLamp` table / bedside lamp; lit, color, glow
- `deskLamp` angled, aiming right (facing -1: left); lit, color
- `pendant` ORIGIN AT THE CEILING; cord (m), shade cone | dome | bulb, lit, cone (light cone), color
- `cot` kindergarten cot; color (blanket), w; lie + front (blanket)

**handheld**
- `mug` color, label (text | false), labelColor, steam / hot, drink, detail; grips hand, handle, two; points rim
- `cup` takeaway cup with lid + sleeve; brand (invented), steam
- `glass` variant water | juice | wine | flute | whisky; fill 0..1, drink
- `bottle` variant water | wine | soda | beer | milk | sauce; label, color; grips hand, neck
- `jar` small jar with lid and label (hand-off prop)
- `book` closed (cover; title) | open: true | view 'spine'; color, w, h; grips hand, left, right
- `notebook` variant spiral | school; open (lined pages, handwritten text); title, color
- `paper` A4 sheet. title, text (handwritten unless font 'print'), lines n, check, signature, stamp, pin, wall, color; grips left, right
- `envelope` view front | back; heart (red seal)
- `pen` upright, tip down. variant pen | pencil | marker | crayon | chalk; lying; grips hand, pinch; points tip
- `pencil`, `marker` (= pen variants)
- `keys` key ring with 2-3 keys and a fob; grips hand
- `wallet` card peeking out; card: false
- `card` credit / ID card (invented); color, text
- `money` variant notes (n, value) | stack | coins (n)
- `coins` (= money variant coins); n, seed
- `watch` wrist watch (close-up size). time 'HH:MM', run, seconds, smart, color, strap; grips wrist
- `glasses` variant round | square; color
- `bag` variant handbag | backpack | school | shopping (items, label) | duffel; color; grips hand (+ strap, back)
- `backpack` (= bag variant backpack)
- `suitcase` variant rolling (handle: true) | briefcase; color
- `briefcase` (= suitcase variant briefcase); grips hand
- `box` variant cardboard | gift | shoe | pizza | crate; open, w, h, color; top
- `giftBox` (= box variant gift); color, ribbon
- `umbrella` open (default; r) | closed; color; grips hand
- `toy` variant teddy | car | blocks | robot | duck; color
- `teddy` sitting teddy bear; color, bow
- `ball` variant football | basketball | tennis | baseball | beach; r
- `guitar` upright (lying: true for playing); grips neck, body, strum
- `flashlight` lens up; lit (lens glow + beam cone), beam: false, beamL, beamW
- `lighter` lit (flame + glow); points flame
- `stunGun` non-lethal, yellow tip; grips hand
- `baton` tonfa style; grips hand, far
- `phone` smartphone. screen: spec | 'text' | fn (ui: lock | home | call {name, status, timer} | chat {name, msgs: [{text, me}]} | signal | battery {level} | bank {amount} | map | video | notify {title, text} | timer | alarm | text | off | photo), view front | back, detail high, glow; grips hand, thumb, ear, top, two
- `tablet` portrait (landscape: true). screen spec, glow, detail; grips hand, left, right
- `camera` variant dslr | compact | video; grips hand, left
- `microphone` variant handheld | stand (h) | desk; grips hand

**kitchen**
- `plate` front ellipse (view 'top' for top-down inserts). food toast | eggs | cake | steak | pasta | salad | cookies | pizza; r
- `bowl` food soup | cereal | salad | rice | empty, steam
- `pot` two handles; lid: false shows food; steam
- `pan` frying pan; food, steam
- `kettle` variant stove | electric; steam; points spout
- `knife`, `spoon`, `fork` (handle down)
- `rollingPin` grips left, right
- `cuttingBoard` top band to put food on
- `wallCabinet` upper cabinets, ORIGIN = BOTTOM CENTRE (hang ~1.33 m). n doors, doorW, h, color
- `hood` cooker hood, ORIGIN = canopy bottom centre (~1.5 m over the hob); chimney
- `spiceRack` wall shelf with spice jars, ORIGIN = the board; jars [colours], w
- `dishRack` plates on edge (stands on the counter)
- `tiles` backsplash panel, ORIGIN = BOTTOM CENTRE; w, h, tile, color, grout
- `fridge` open (lit inside), note (sticky note text), drawing, magnets n, w, h; grips door
- `stove` oven window, knobs, burners; lit; top

**food**
- `food` kind apple | banana | toast | sandwich | pizza | donut | burger | croissant | cookie | egg | cakeSlice | cake (candles n, lit, view 'top')
- `cake` birthday cake: candles n, lit, view 'top', color, icing, fill

**office**
- `stickyNote` handwritten line (text), color
- `waterCooler`, `filingCabinet` (drawers n; open index), `trashCan` (variant office | kitchen | recycling; full)

**tech**
- `chip` microchip, ORIGIN = CENTRE; led, ledAt
- `laptop` view front | back | side; closed; screen spec (default 'windows'), glow; grips left, right
- `keyboard` (view 'top' for top-down); color
- `mouse`
- `monitor` (.56 wide). screen spec (default 'windows'; 'lines' | code | doc | chart | email | desktop | login), view back, glow, w
- `tv` (1.1 wide). screen spec (default news { headline, tag, ticker }; sport | static | text | off), stand (else origin = its bottom edge for the wall), glow, w
- `printer` paper: false
- `router` two antennas, green LEDs

**home**
- `candle` lit (default), h, holder: false
- `sink` variant pedestal | vanity; points tap, basin
- `wheel` bicycle wheel; r
- `washer` front loader; spin, clothes colour
- `fan` variant desk | standing; on, speed
- `alarmClock` time 'HH:MM', run, t0, wedge [h0, h1], bells, d, color
- `plant` variant small | tall | cactus | flower | hanging (origin = hook); color, pot, seed
- `door` in its frame, origin = bottom centre of the opening (1.85 m). variant panel | flush | glass | steel; open 0..1, lit, gap, handle 'bar' (+ sign PUSH), color, frame, w, h; grips handle

**wall** (ORIGIN = CENTRE unless said)
- `ledClock` red digits. text | time 'HH:MM' + run | countdown { from (s), t0 }; w, color
- `lightSwitch` (~1.1 m)
- `curtains` ORIGIN = THE ROD (anchor top); w, h, open 0..1, color
- `clock` white face, black ring, red second hand. time 'HH:MM' | hours, run (1 = real time; 60 = a minute a second), t0, d, color, seconds: false
- `calendar` red header, grey squares. month, day (red circle), crossed (n days X-ed), w
- `pictureFrame` (standing: true = on a table, origin bottom). picture family | landscape | blueprint | portrait | drawing | abstract | cert | text; people, frame: false, pin, w, h, color
- `mirror` variant oval | rect; w, h
- `whiteboard` (stand: true = on legs, origin bottom). title, type: true | { t0, cps } (types the title on), lines n, text, ink, w, h; points write
- `blackboard` chalkboard; text, math, w, h
- `coatRack` ORIGIN = THE BAR; coats n | [colours], w
- `bunting`, `stringLights` ORIGIN = LEFT ATTACH POINT; w, sag, colors

**medical**: `stethoscope` (grips hand, neck), `syringe` (liquid), `pillBottle` (pills), `heartMonitor` (on a pole,
animated ECG; bpm, spo2, flat (flatline), glow; stand: false = the box only), `aed`, `ivStand` (liquid).
**cleaning**: `bucket` (water; grips hand), `mop` (variant broom; grips hand, low), `broom`.
**sports**: `trophy` (color), `medal` (text, color, ribbon), `stopwatch` (run, speed, t0), `whistle`, `racket`.
**tools**: `wrench`, `screwdriver` (color), `hammer`, `tweezers` (grips pinch; points tip), `toolbox` (open).
**stage**: `flag` (color, emblem, wave, w, h), `piano` (grand piano side view with its bench; seat; points keys),
`podium` (variant podium | lectern; seal, mic, text, color), `lectern`.
**lab**: `microscope`, `testTubes` (n, colors). **school**: `lockers` (n, h, colors), `globe`.

**vehicle** (side views facing right)
- `car` sedan (4.3 m). color, driver / passenger (silhouettes), open 'driver' | 'rear', hood, headlights, lightBar, glass; wheels turn with x; seats driver / rear; grips door, trunk, hood
- `policeCar` lights: true (red / blue swap every 4 frames) + car options; `taxi`; `van` (driver, text, lightBar; seat driver); `ambulance` (lights, driver, text)
- `bus` city bus (10 m): lit windows with passengers (0..1, seed), route, dest, lit, headlights, stripe; points door
- `bike` color; seat + grips handlebar + points pedal; `scooter` variant kick | moped; `motorbike` (= scooter moped)

**street**
- `lampPost` lit (glow + a light cone on the ground), cone: false, h, glow
- `trafficLight` state red | yellow | green, or cycle { t0, red, green, yellow }
- `sign` kind street (text) | stop | bus | arrow | warning | parking | exit (wall, origin centre) | shop (text, lit) | level
- `hydrant`, `mailbox` (text), `bin`, `cone`, `barrier` (w, colors), `atm` (text), `tree` (variant round | tall | pine; h, color), `hedge` (w, h)

**animal** (side views facing right; `facing: -1` = left)
- `dog` a small terrier (~0.4 m). pose stand | run | jump (legs stretched: lift it with `at: [x, y, z]`) | sit | bark (head up, mouth open, bark lines; `lines: false`), color, collar, `frisbee: true` (in the mouth), size; grips body (carry it like a parcel: `a.hold(dog, { grip: 'box' })`) / collar / leash
- `bird` (= `pigeon`) 0.2 m. pose stand | fly (wings up) | flap (wings down); a frozen bird hangs in the air with `at: [x, y, z]`

Grips a hand uses by default (`a.hold(prop, { grip })` to choose): phone / smartphone / remote / card / ticket ->
`phone-look`; mug / cup / coffee / tea -> `mug`; glass / flute / wine / bottle -> `glass`; book -> `book`; notebook /
paper / sheet / letter / drawing / photo -> `sheet`; box / parcel / package -> `box`; gift / present -> `gift`; bag /
briefcase / suitcase / handbag -> `bag`; jar / can -> `jar`; marker -> `marker`; pen / pencil -> `pen`; tool / wrench /
hammer / torch / flashlight / gun -> `tool`; sign / placard -> `sign`; apple / sandwich / burger / key(s) / money /
cash / wallet -> `food`; ball -> `ball`. Others: `phone-ear`, `phone-show` (screen to the camera), `phone-text` (both
hands), `sip`, `rifle` (both hands, diagonal), `hang` (arm down, the prop dangles). Anything else: `mug`.

## 7. Information graphics (`S.info(kind, o)`)

- `terminal`: typed terminal (navy, JetBrains Mono caps 88, 1 char/frame, block cursor blinking 9 off / 14 on, centred block scrolling up in 6 frames): { lines: ['NICE WORK, LEO.', { text, at|word|pause }], at, cps, pause: .9 }
- `number`: big full-screen number / statement with a slow push: { value: '$1,000,000' | { from, to, at|word, preset: 'money'|'counter'|'attempts', frames }, style: 'cream'|'red'|'green'|'amber'|'white', label: 'UNTIL MIDNIGHT TOMORROW', prefix, suffix, box, push: .08|false }
- `title`: the 'What if you ...?' title over the shot's picture: { lines: ['WHAT IF YOU HAD', '500 IQ?'], style: 'glow'|'outline', pos: 'center'|'left'|[x, y], at|word } (also `S.title(lines, o)`)
- `endcard`: closing card: night, ring of light, cast, question, engagement row on words: { lines: ['WHAT WOULD YOU DO', 'WITH 500 IQ?'], cast: ['main', 'mom', 'leo'], comment: 'comments', subscribe: 'subscribe', like: 'like', part: 'part', partText: 'PART 2' } (also `S.endcard(o)`)
- `news`: broadcast graphics over the shot's picture: { style: 'blue'|'red', headline, sub, ticker, tab: 'BREAKING', strap, channel: 'NEWS', tv: true, at }
- `cctv`: security-camera look over the shot's picture: { style: 'iq' (grey, grain, REC, frame-counting timecode) | 'cam' (colour, CAM label, frame, face box), label, time: '23:41', face: actor }
- `document`: paper with handwritten lines (Kalam, ink #2f366b) fading in 6 frames each, 6 apart, 10 frames ahead of their words: { lines: [{ text, word|at, align, heart }], style: 'note' (lined landscape, desk) | 'page' (title + grey text bars + photo) | 'whiteboard', title, bars, photo, footer, stamp: { text, word, theme }, mark: { line, word } (red marker ring), pos, width, rot, backdrop }
- `note`: sticky note / handwritten note: { text | lines, color: 'yellow'|'pink'|'blue'|'paper', heart, pos, rot, board }
- `calendar`: month page: red header, days, marked days (red marker ring drawing on, crosses): { month: 'MARCH', start: 3 (weekday of the 1st, 0 = Monday), days: 31, ring: { day: 14, word }, cross: [1, 2, 3], note, pos, board }
- `card`: score / test card (aptitude style): { title: 'APTITUDE TEST', label: 'SCORE', value | { from, to, word }, curve: true, marker: .5, stamp: { text: 'EXACTLY AVERAGE', word }, board }
- `statbox`: in-world stat box that scales with the camera: { label: '7 DAYS', value | count spec, prefix: '$', theme, cap: 78, pos, states }
- `chart`: charts on a dark board: { type: 'bell' (bell curve of tiny figures, gold axis, labels: [{ value, text, word, marker }], highlight: { value, word }, mean, sd, min, max) | 'line' | 'bars' | 'vote' (header, question, from, to, yes) | 'gauge' (value) }
- `phone`: a phone with a flat UI screen (in a set or held): { screen: 'call'|'chat'|'notify'|'bank'|'alert'|'map'|'lock', name, sub, messages: [{ text, me, word }], balance, pos, scale, rot }
- `sign`: a card / sign with big words (NOVA WINS. style) on a board or in a set: { lines: ['NOVA', 'WINS.'], colors: ['#2a3f9a', '#b8333a'], paper, rot, board }
- `worldmap`: world map (Natural Earth outline): { style: 'gold'|'steel'|'dots', rect: [x, y, w], pins: [{ place: 'paris'|[lon, lat]|{ x, y }, word }], labels: [{ text, to: place, x, y, word }] (lines draw to the place in 12 f), routes: [{ from, to, word, frames: 9, bend }], nodes: [{ place, word }], stamps: [{ place, text, word }] (BANNED: no stamps), pills: [{ text, x, y, theme, word }], push: { to, word|at, zoom: 2.6, frames: 8 } }
- `citygrid`: street grid map (red on black, dots at crossings): { color, cell: 72, icons: [{ x, y (grid cells) | px: [x, y], label, shape: 'square'|'tower'|'van'|'cam'|'dot', color, word }], cams: { n, at, every }, route: { pts: [[gx, gy], ...], word, dashed }, pills: [{ text, x, y, theme, word }] }
- `floorplan`: office floor plan (amber on black): { outline: [x, y, w, h], walls, desks, exits: [{ x, y, label: 'LIFTS', word }] (red X), dots: [{ x, y, label, color, below }], boxes: [{ x, y, w, h, label: 'STAIRS' }], path: { pts, word }, pills, caption }
- `building`: wireframe tower: { floors: 40, style: 'orange'|'green', highlight: { floor, word }, xs: n, labels: [{ text, floor }], counter: { label, value } }
- `network`: network graph: { nodes: [{ id, x, y, label, icon: 'bank'|'phone'|'person' }], links: [[a, b, word]], tokens: [{ from, to, word }], tags: [{ text, x, y, word }] }
- `diagram`: blueprint line drawings drawing on in ~13 frames on navy: { items: [{ shape: 'head'|'brain'|'box'|'gift'|'arrow'|'circle'|'bulb'|'heart'|'path', x, y, s, word, accent }], glow: { at|word, x, y, r } }
- `split`: two panels with a torn divider, each its own little scene: { left: (S, p) => { ...; return camera spec }, right: ..., at: .46, slide: { word } } (also `S.split(left, right, o)`)

World-map places by name (`place: 'paris'`): the cities in lib/info/world.js PLACES (london, paris, berlin, madrid,
reykjavik, anchorage, honolulu, ... ) or `[lon, lat]`.

## 8. Effects (`S.fx(kind, o)`; times are numbers)

- `dust`: floating dust specks (the storybook motes): 40-60 soft cream dots 3-14 px drifting slowly, some big and blurred. { density, color, area | around, z }
- `rain`: straight streaks 1.5-2 px x 40-90 px leaning `angle` deg (12; storm 22), fast, 3 depths. { density, angle, speed, color, area | around, z, opacity }
- `drops`: rain on a window: ~80 round drops 14-46 px, a few sliding down leaving a trail; pair with bokeh behind. { area | around (the glass), density, scale, color, z }
- `snow`: soft white flakes 2-24 px falling slowly with a sway, 3 depths. { density, speed, wind, color, area | around, z }
- `confetti`: 9 x 4 px paper rects drifting down, spinning and fluttering; { from: point } = a burst that pops up and flutters down. { density, colors, area | around, from, z }
- `bokeh`: soft out-of-focus light discs 35-90 px for close-up backgrounds, nearly still. { density, colors, area | around, z, opacity }
- `streaks`: thin lines racing in `dir` (deg, 180 = to the left, -90 = down). { dir, speed, len: [min, max] px, width, count, density, color, alpha, add, glints, area | around, z }
- `speedLines`: thin white dashes 60-150 px racing past (a cockpit / car window, a fast move). Same options as streaks.
- `shower`: a gold shower (money / value pouring back). { at, until, from, dir (-52), spread (62), speed, count, color, opacity }
- `camFlashes`: press / crowd camera flashes, 3 frames each; { small: true } = tiny pops in far stands. { rate, area | around, z, seed }
- `bubbles`: thin rings rising and wobbling; { from: point } = a stream. { density, area | around, from, height, z }
- `water`: a water surface: short horizontal light dashes twinkling, optional glitter column. { area | around, glitter: x, density, color, z }
- `impact`: a 3-frame white lift + a white-hot disc, 10 rays and a ring at the point (+ burst: 'sparks' | 'shards' | 'dust'). { at, from, flash (.32, false = none), burst, color, scale } (also `S.impact(at, where, o)`)
- `sparks`: yellow-white streaks thrown from a point with gravity and a warm glow; a burst at `at`, or crackling until `until` with { rate }. { at, until, from, count, dir + spread, rate, color, scale }
- `shards`: 42 pale-blue glass slivers flying out, spinning, falling; white-hot the first 2 frames. { at, from, count, dir + spread, life (1.6 s), flash, color, scale }
- `crack`: white polylines radiating from the hit with cross links, drawn on in 3 frames, then static. { at, from | around, size (m), width (m), dur, color }
- `zap`: a stun dart: a white streak flies from A to B leaving thin rings, then the hit. { at, from, to, dur (4 frames), color, flash, scale }
- `electric`: 3 jagged cyan-white arcs around a point, re-drawn every 2 frames, a pulsing glow. { at, until, from, radius (.07), color, scale }
- `fireworks`: ray bursts and dot rings, a new one every `every` s (0.7), 3 alive at once, in the upper sky or inside an area / around a window. { every, colors, area | around, z, depth, scale }
- `smoke`: soft round puffs: one at `at`, or a rising plume with { rate }. { at, until, from, rate, size (.035), rise, wind, color, opacity, scale }
- `steam`: 3 white ribbons rising in slow S-curves from a cup / pot (2.1 s cycle); size it to the cup (height ~2.5x a mug in close-up). { from (the rim point), height (m, .3), width, count, sway, period, color, opacity }
- `ripple`: style 'genius' (one thin white ring + a follower 3 frames later, ~0.7 frame heights in 12 frames: "he sees it" / time stops), 'water' (flat ellipses every 8 frames), 'shock' (one small fast ring). { at, until, from, style, radius, flat, every, color, alpha, reverse }
- `glint`: a white 4-point star (~30 px) popping for 5 frames on an eye, a gem, a lens, an idea. { at, from, size (px), color }
- `sparkles`: tiny warm dots and 4-point stars rising and twinkling around a point / actor (the age-jump look). { at, until, from, radius (.12), count, color, rise }
- `aura`: a big soft glow behind + a faint one in front of an actor / object, slowly pulsing, a few rising specks. { at, until, around | from, color, strength (.35), size, specks }
- `lightShaft`: 'window' (2-3 parallel soft bands on the wall), 'fan' (god rays fanning down from a hot spot), 'cone' (spot / street lamp / flashlight with a glow at the source and a floor pool). { mode, from | around, angle, spread, len, width, bands, color, alpha, z, dust, pool }
- `flicker`: a light that changes: 'lamp' (rare 2-6 frame dips), 'fluorescent' (failing tube), 'screen' (shimmer), 'blink' (LED on/off, { period, duty }), 'candle'; { target } (an object) shows / hides with it. { mode, from | around, size, color, strength, target }
- `siren`: a red / blue bar glow swapping every 4 frames and the whole picture washing red / blue. { at, until, from | around (the car: bar on its roof), wash (.6), period (8 frames), scale }
- `screenGlow`: a screen lighting a face: a cool plume above the screen and a soft light on the face ({ phone: true } = brighter, from below). { from (the screen), face (actor), color, strength, shimmer }
- `reset`: the time-loop reset: a white light grows (20 frames), a white wall of light sweeps the frame (~30 frames) and holds white: cut the next shot with trans 'flash' or 'whiteout'. { at, from, dir ('right'), sweep (1.25 s), until }
- `freeze`: time stops: the picture goes flat and cool (eased in 3 frames), a thin ripple ring runs out from `from` when time stops and back when it restarts, specks hang in the air, every field effect stops. Returns fz: fz.frozen(t), fz.k(t), fz.time(t). { at, until, from, ring: false, dust: false, restart: 'in' | 'out', strength } (also `S.freeze(o)`; `S.char(id, { free: true })` keeps moving)
- `skill`: a skill flowing from A to B in a handshake: two warm threads + specks run from A's shoulder through the joined hands (a glow pops there) into B. { from: A, to: B, at (the contact), dur (1.2 s), sideA, sideB, color, strength } (also `S.skill(A, B, o)`)

## 9. Overlays, themes, HUD kinds

Overlays (`S.<name>`): pill, options, label, counter, plusminus (= icon), tag, stat, timer, ring, clock, elapsed,
checklist, stamp (banned), warning, typed: engine_api.md §9. Pill / tag themes: `fact` (gold, default), `danger` (red),
`success` (green), `gadget` (blue), `predict` (violet), `neutral` (white), `chosen` (amber fill), `navy`, `amber`,
`money`, `muted`. HUD kinds (models.js `UI.hud([...])`): counter, label, icon, checklist, timer, ring, clock. Pills, tags
and the other overlays are kept inside the picture (never over the letterbox bars); `pos: 'bottom'` rows stack upward.

## 10. Camera kinds and framings

Kinds: auto (= creep), static, nudge, nudgeOut, push, pull, pushBig, threat, stepPush, punch, crash, pullReveal,
pushInto, zoomThrough, truck, follow, pan, linearPan, tilt, keys. Framings: ecu, cu, mcu, ms, mls, ls (= full), ws, vws,
ews, `{ h }`. Transitions: cut, dissolve, quick, flash, whiteout, black, match (whip / zoom / push exist but are not in
the style).

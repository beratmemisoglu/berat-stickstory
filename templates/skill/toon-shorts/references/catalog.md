# Catalogue (generated from the engine: experiments/toon-style/tools/skilldocs.py)

Everything a scene can name, read from the live engine. The how-to is engine_api.md and motion.md.

## Actor methods (a = S.char(...))

- `a.place(x, z, ry = this.home.ry, y = this.home.y)`: place the character: x, z on the floor, facing ry radians (0 = toward +z, the camera's default side), y = floor height
- `a.stand(name)`: the starting pose (no animation): a POSES name or a partial pose
- `a.pose(p, t, o = {})`: blend to a pose (name or partial pose) starting at t. o: { dur (s, default 6 frames), ease, follow (frames the body lags) }
- `a.gesture(name, t, o = {})`: a gesture that LANDS `early` frames (default 4) before t (the stressed word's start): 5-6 frame outCubic arc, no  overshoot, the body follows 3 frames later, dead hold. o: { dur (frames), early, until (back to rest), back, backDur (frames) }
- `a.face(name, t = -1e3, o = {})`: expression: the new face is fully on at t (through a half-lid + closed frame when the change is big; shock pops).  o: { inbetween: false (instant), pop, tilt (the head roll change a big swap carries, default ~6 deg; 0 = none) }
- `a.look(x, y, t, o = {})`: pupils: x right, y up (-1..1) over 2 frames; or look(target, t) at an actor / object / [x,y,z] (tracked every frame)
- `a.lids(k, t, o = {})`: eyelids 0 open .. 1 shut (e.g. sleepy .45) over 4 frames
- `a.blinks(o = {})`: idle blinks for a hero in close shots: 3 frames (half, closed, half) every 1.5-4 s; never on shock or asleep faces.  o: { every: [min, max] s, from, to, seed, nervous (every 8-10 frames) }
- `a.blink(t)`: a single blink at t (3 frames)
- `a.headTo(target, t, o = {})`: turn the head toward a world point / actor / object, or null (back to straight), over 5 frames (outCubic)
- `a.nod(t, o = {})`: a head nod as a button on a line: up 4 % of the head in 1 frame, down 6 % over 4, settle over 4
- `a.react(t, o = {})`: reaction tilt: the head dips and rolls 15-20 deg in 8 frames (sineOut), holds, returns in 8. o: { hold (s), side: 1|-1 }
- `a.turn(to, t, o = {})`: turn the body to yaw ry (radians), toward [x, z], an actor or 'camera'. 180 deg in 4 frames; o: { dur (s), settle (frames) }
- `a.walk(points, t0, o = {})`: walk a path of [x, z] points from where it stands, starting at t0 (it turns toward the path first, ending at t0).  o: { style: walk | brisk | stroll | step | scurry | run | sneak | march | waddle | dizzy, speed (m/s), until (t1),  endYaw (rad) | face ('camera' | [x, z] | actor), arms: swing | pump | behind | out | carry }
- `a.moveTo(x, z, t0, o = {})`: walk straight to x, z (see walk)
- `a.hop(t, o = {})`: a hop / jump: anticipation squat (4 frames), stretch on take-off, ballistic arc up h metres in the air for dur s,  landing squash (3 frames). t = take-off. o: { h, dur, to: [x, z] (jump there), tuck }
- `a.move(to, t0, t1, o = {})`: slide the whole character without a walk cycle (fly, get pushed, ride, a real-time fall into frame). o: { y, ease, rot: [x,y,z] }
- `a.jolt(t, o = {})`: startle / jolt at t: the body pops up in 2 frames (linear; with the torso stretched +24 % the head travels ~0.45 head  heights), the head snaps upright, the eyes open 1 frame after the body (popped); it falls back over 11 frames, the  stretch relaxes in 6. o: { face, h (body lift, head heights), deflate (slump lower after, head heights, until o.until),  sweat: true (a drop 10 frames later, held 35), arms: true (fling up) }
- `a.fall(t, o = {})`: topple like a plank from the feet: 90 deg * quadIn over dur (default 24 frames, measured), a small bounce on the floor,  the free arms flail up for the first half. t = start. o: { dir: back | forward | left | right, dur (s), rest (deg) }
- `a.sit(seat, t, o = {})`: sit on a seat: a prop with userData.seat (sits on its front edge facing away from its back) or [x, y, z] (the seat  point) + o.ry. t = the CONTACT frame (the face swap rides it): a 3 frame dip, a 5 frame rise, an 11 frame curved  descent, a 1 frame drop on contact, 2 held, a 3 frame rebound and a 5 frame settle. o: { ry, face, pose (arms), quick }
- `a.standUp(t, o = {})`: stand up from the seat at t (start): lean forward 4 frames (head 0.12 head heights down and forward), hold 3, rise  in 8 frames with the measured speed profile 3,7,10,9,7,6,5,3 (peak at frame 3). o: { pose }
- `a.crouch(t, o = {})`: crouch down (5 frames, knees out) at t and back up (6 frames) at o.until
- `a.reach(target, t, o = {})`: reach a hand to a world point / object / actor, arriving at t (4 frames, outCubic, no overshoot); the body leans after  it (follow-through 3 frames), eyes and head look at it. o: { side, until (t back), grip, hold (stay), push (press) }
- `a.press(target, t, o = {})`: press a button (world point / object) at t: the finger reaches in 3 frames, pushes 1 cm for a frame, holds, retracts  in 7. o: { side, hold (frames), grip: point | flat }
- `a.hold(obj, side = 'R', t0 = -1e3, t1 = 1e9, o = {})`: hold a prop (Object3D) in hand 'L' | 'R' | 'both' from t0 to t1. Uses the prop's userData.grip ({ at, rot } in the  prop's own space) when it has one. o: { at: [x,y,z] / rot: offset in the hand's frame, drop: true (falls to the  floor when let go), place: [x,y,z] (where it is left), floor (y), orient: 'upright' (default: stays upright, faces  the character's way) | 'hand' (follows the hand's rotation) }
- `a.take(obj, t, o = {})`: pick a prop up: reach to its grip point (arriving at t) and hold it from t (until o.until)
- `a.throw(obj, t, o = {})`: throw a held prop at t (it leaves the hand): 7 frame wind-down from t - 9 frames (the hand drops ~0.4 head diameters, ease-out), a 2 frame snap up,  then real ballistics (apex ~1 head diameter above the hand after 11 frames, 15-20 deg/frame spin). o: { side,  to: [x,y,z] | actor (its catch()) , apex (m), spin (deg/frame), g }
- `a.catch(obj, t, o = {})`: catch a prop arriving at t (thrown by another actor's throw({ to: this })): hands up 4 frames before, it closes in 1,  pulls in to a carry over 7. o: { side, until }
- `a.extra(name, t0, t1, o = {})`: a face extra (sweat, blush, stress, ...) from t0 to t1; o: { slot 1|2, anim: 'fall' | 'fade' | 'bob', x, y, scale }
- `a.poseAt(t)`: the authored pose at time t (keys blended in order, each from where the previous left off)
- `a.box()`: world bounding box of the character
- `a.head()`: world position of the head's centre

## Poses (`a.pose(name, t)`, `a.stand(name)`)

`rest`, `neutral`, `clasp`, `behind`, `hips`, `cross`, `shrug`, `point`, `pointL`, `pointUp`, `pointSide`, `pointBack`, `wave`, `think`, `head`, `facepalm`, `scratch`, `celebrate`, `armsUp`, `armsOut`, `cower`, `present`, `presentL`, `hold`, `carry`, `holdR`, `holdL`, `holdUp`, `catch`, `reach`, `reachDown`, `clap`, `rub`, `thumbsUp`, `stop`, `belly`, `throat`, `mouth`, `eat`, `phone`, `look`, `chin`, `fists`, `lean`, `slouch`, `proud`, `sneak`, `crouch`, `sit`, `sitBack`, `sitHead`, `lounge`, `limp`, `drowsy`

## Gestures (`a.gesture(name, wordTime)`: lands ~4 frames before the word)

- `shrug`: pose shrug, 5 frames
- `point`: pose point, 5 frames
- `pointUp`: pose pointUp, 6 frames
- `pointSide`: pose pointSide, 6 frames
- `pointBack`: pose pointBack, 6 frames
- `hips`: pose hips, 4 frames
- `cross`: pose cross, 6 frames
- `think`: pose think, 6 frames
- `head`: pose head, 6 frames
- `chin`: pose chin, 5 frames
- `facepalm`: pose facepalm, 5 frames
- `scratch`: pose scratch, 6 frames, loops (scratch)
- `celebrate`: pose celebrate, 5 frames
- `wave`: pose wave, 6 frames, loops (wave)
- `cower`: pose cower, 4 frames
- `present`: pose present, 6 frames
- `presentL`: pose presentL, 6 frames
- `stop`: pose stop, 4 frames
- `clap`: pose clap, 4 frames, loops (clap)
- `rub`: pose rub, 6 frames, loops (rub)
- `thumbsUp`: pose thumbsUp, 5 frames
- `reach`: pose reach, 4 frames
- `belly`: pose belly, 6 frames
- `mouth`: pose mouth, 5 frames
- `look`: pose look, 6 frames
- `armsUp`: pose armsUp, 6 frames
- `armsOut`: pose armsOut, 11 frames
- `throat`: pose throat, 5 frames
- `fists`: pose fists, 4 frames
- `clasp`: pose clasp, 6 frames
- `behind`: pose behind, 7 frames
- `phone`: pose phone, 6 frames
- `crouch`: pose crouch, 5 frames
- `holdUp`: pose holdUp, 6 frames
- `catch`: pose catch, 4 frames

## Walk styles (`a.walk(points, t0, { style })`)

- `walk`: speed None m/s, stride 0.26 m
- `brisk`: speed None m/s, stride 0.26 m
- `stroll`: speed None m/s, stride 0.23 m
- `step`: speed None m/s, stride 0.24 m
- `scurry`: speed None m/s, stride 0.1 m
- `run`: speed None m/s, stride 0.46 m
- `sneak`: speed None m/s, stride 0.18 m
- `march`: speed None m/s, stride 0.28 m
- `waddle`: speed None m/s, stride 0.17 m
- `dizzy`: speed None m/s, stride 0.2 m

## Cast (`S.char(id)`, the main character is `S.char('main')`)

- `milo`: Milo, everyman (regular)
- `juno`: Juno, everywoman (regular)
- `dex`: Dex, scientist (slim)
- `bea`: Bea, kid (kid)
- `otis`: Otis, big guy (round)
- `rose`: Nana Rose, grandma (elder)
- `walt`: Walt, grandpa (elder)
- `kai`: Kai, student (regular)
- `priya`: Priya, professional (slim)
- `sam`: Sam, officer (strong)
- `lola`: Lola, explorer (regular)
- `viktor`: Viktor, boss (regular)
- `ike`: Ike, adventurer (strong)
- `mei`: Mei, doctor (regular)
- `rex`: Rex, athlete (strong)
- `tess`: Tess, pilot (slim)
- `hugo`: Hugo, chef (round)
- `ada`: Ada, engineer (regular)
- `bo`: Bo, little kid (kid)
- `zed`: Zed, shady guy (slim)

## Outfits (`S.char(id, { outfit })`)

`astronaut`, `diver`, `hazmat`, `explorer`, `winter`, `beach`, `worker`, `medieval`, `knight`, `pharaoh`, `pilot`, `sailor`

## Expressions (`a.face(name, wordTime)`)

`neutral`, `happy`, `smile`, `laugh`, `excited`, `manic`, `blissful`, `smug`, `scheming`, `wink`, `calm`, `bored`, `thinking`, `skeptical`, `confused`, `sideglance`, `whistle`, `pout`, `annoyed`, `angry`, `furious`, `determined`, `sad`, `crying`, `worried`, `nervous`, `embarrassed`, `scared`, `terrified`, `panic`, `shocked`, `surprised`, `gape`, `pain`, `effort`, `sick`, `disgusted`, `sleepy`, `asleep`, `dizzy`, `dead`, `love`, `starstruck`

## Face extras (`a.extra(name, t0, t1, { anim })`)

`sweat`, `blush`, `stress`, `vein`, `sparkle`, `sweats`, `tears`, `gloom`

## Light rigs (`S.light(name)`)

`studio`, `interior`, `day`, `sunset`, `night`, `bulb`, `neon`, `underwater`, `space`, `alarm`

## Effects (`S.fx(kind, o)`)

- `dust`
- `rain`
- `snow`
- `leaves`
- `petals`
- `confetti`
- `bubbles`
- `smoke`
- `steam`
- `fire`
- `embers`
- `campfire`
- `sparks`
- `explosion`
- `splash`
- `sparkle`
- `stars`
- `lightCone`
- `godrays`
- `glow`
- `water`
- `underwater`
- `clouds`
- `fog`
- `lightning`
- `tornado`
- `lava`
- `trail`
- `speedLines`
- `xrayScan`
- `godRays`
- `rays`
- `cone`
- `lightcone`
- `bulb`
- `mist`
- `ocean`
- `sea`
- `glint`
- `smear`
- `ghost`
- `xray`
- `scan`
- `speedlines`
- `caustics`

## In-world information (`S.info(kind, o)`)

- `sign`: text ('\n' = new line), sub, style 'wood'|'metal'|'street'|'neon'|'hang', arrow 'left'|'right'|'up'|'down' (wood/hang: the board is an arrow), mount 'posts'|'pole'|'hang'|'wall', height (board bottom / hanging point, m), w, h, d, color, textColor, glow (neon colour), frame (neon border colour), lightAt (neon flickers on: on, off 1 frame, on), buzz (a dead frame now and then), light: false (no coloured spill)
- `poster`: title, sub, kicker (small caps line on top), plate (e.g. 'PLATE XIII'), draw ('tree'|'leaf'|'fruit'|'coin'|'money'|'house'|'bolt'|'warning'|'heart'|'globe'|'bars'|'line'|'pie'|'person'|'drop'|'flame'|'star'|'check'|'cross'|'clock'|'up'|'down' or fn(x, X, Y, W, H)), image (IMG key), figs: [{ draw|image, label }], footer, style 'plate'|'bold'|'photo', color (bold background), paper, w, h, fix 'tape'|'pins'|'pin'|'none', frame (wood frame), rip: t (tears off up-left over 12 frames)
- `notice`: title, text (wrapped body), lines: [...] (one per row), textSize (% of the width), draw / image, tabs: 'text' (tear-off tabs), style 'paper'|'sticky'|'document'|'card', w, h, paper, org (document letterhead, invented), fix 'pin'|'pins'|'tape'|'magnet'|'none', tilt (rad), highlight: { line: index | match: 'text', t, color } (a marker swipe across that row ON its cue; an array for several), signature (document)
- `document`: notice with style "document" (white A4 report: heading, rows, highlight on cue)
- `screen`: device 'tv'|'retro'|'monitor'|'phone'|'tablet'|'wall', w (screen width m), aspect, color (housing), glow (brightness, 1.05), mount 'stand'|'wall' (tv), powerOn: t (dark until then, opens like a CRT on its cue); content (or states: [{ t, ...content }] switching ON each cue): bg, fg, accent, title, live, ui 'news'|'stock'|'chat'|'bank'|'call'|'error'|'app', big (text), count: { from, to, t0, t1, money, decimals, pre, suf }, lines: [...], type: [t0, t1] (lines typed), chart: { type 'line'|'bars'|'pie', values, colors, t0, t1 (draws on) }, image (IMG key) / draw, messages: [{ text, me, t }], ticker (scrolling text), name (call)
- `led`: from, to (or value), t0, t1 (rolls from `from` to `to`, LANDS EXACTLY on `to` at t1; t1 alone = 0.7 s roll), ease ('counter' default: per-frame steps, slightly accelerating, 1-frame holds), jitter, money ('$'|'€'|true), pre, suf, decimals, compact, before (text shown before t0, e.g. '10:42 108°F'), text (static) | texts: [[t, 'text'], ...] (switch ON each cue), style 'dots'|'seg', color, align, pitch (dot pitch m), cells (character width), mount 'pole'|'wall'|'desk'|'none', height (display bottom on a pole), header (a painted board above), headerColor, headerText, postColor, glow, sfx
- `scoreboard`: teams: [{ name, color, score: n | [[t, n], ...] (changes ON each cue, the digits flash 8 frames) }], title, clock: { from: seconds, t0, t1?, to? } (counts down), period, w, h, color (lit digits), mount 'legs'|'wall'|'hang', height
- `board`: style 'chalk'|'white', w, h, mount 'wall'|'easel', title (written at the top from the start), items: [{ text | draw ('circle'|'ellipse'|'underline'|'arrow'|'box'|'check'|'cross'|'plus'|'minus'|'equals'|'chart'|'down'|'bars'|'star'|'heart'|'house'|'person'|'sun'|'wave'|'dollar') | strokes: [[[x, y], ...], ...] (unit coords), pos: [u, v] (0..1 from the top-left: the item's centre; text: left edge with align 'left'), size (fraction of the board height), color, t (writing STARTS on this cue), dur (default text .06 s a letter, drawings .4 s), align, angle, weight }]
- `tag`: text, sub, color (card), textColor, w, h, string: false (no string: a stuck label), length (string, m), tilt (rad), swing (amplitude rad), in (pops + swings from that cue)
- `price`: value (number) | text, money ('$' default), decimals (2), from + t0 + t1 (the price rolls, lands on value at t1), was (old price) + change: t (the old price is struck and the new one pops ON the cue), label ('SALE'), color, textColor, plus every tag option
- `mapTable`: w, d (map size m), seed, lands: [[[u, v], ...], ...] (polygons in -1..1, v = north/away) or count (seeded islands), sea, land, beach, dress (trees + mountains), table: false (map board only, origin at its bottom), height (table top), pins: [{ at: [u, v], t (lands ON the cue), color, label }], route: { pts: [[u, v], ...], t0, t1 (dots appear, the last at t1), color, arc (m), dots, marker }, labels: [{ text, at: [u, v], t }], compass
- `globe`: r, seed, spin (deg/s), stand: false (floating planet, origin at its centre), tilt (deg), pin: { lat, lon, t (pops ON the cue), color, label }, face: { lat, lon, t0, t1 } (turns so that place faces front, LANDS at t1; defaults to the pin), clouds, colors: { sea, land, high, ice }
- `satellite`: w, d (plane size m; 9:16 by default), upright (stands facing +z like a giant screen, origin at its centre; default: lies flat on the ground), y, seed, day (day colours; default night), islands: [[u, v, rx, ry], ...], source ('SATELLITE · LIVE'), label (string | [[t, text], ...]), you: [u, v] | false (u, v in -1..1, v = up the frame), youText, rings, sweep (deg/s or false), clouds (drift), alert: { text, t (pops ON the cue), color }, storm: { at: [u, v], r, t }, coords (bottom line). Flat: view it from above with a slight tilt, p: [x, h, z + h * .3], l: [x, 0, z] (a camera straight down rolls with the drift); upright: frame it like a wall
- `bars`: values: [n, ...] (items per bar, or a value with per), per (value per item), labels: [...], item 'block'|'coin'|'check'|'cash'|'book'|'box'|'solid', colors, cues: [t, ...] (each bar's LAST item lands ON its cue) | t0 + stagger, step (frames between items, 2), mode 'drop'|'pop'|'grow' (solid bars rise and land at the cue), unit (item height), gap, ledge: false, labelColor, showValues, valueFmt (num options), highlight: { bar, t } (that bar glows ON the cue)
- `digits`: text, h (cap height m), depth, colors (one or per char), side (side colour), gap, windows (building windows on the faces), skyline: true | { shrink, back } (each next char smaller and farther: a skyline), cues: [t, ...] | t0 + stagger (each char rises from the ground, ~full ON its cue), align 'center'|'left', weight
- `grid`: rows, cols, token 'coin'|'button'|'bulb'|'dot', values (heads/tails: array or 'HTTH..' string; seeded when absent), labels: true | [...] (numbers on buttons), colors: [heads, tails] | per-cell fn(i, r, c), lit (glow colour), upright (stands facing +z; default lies flat facing up), pitch, board ('felt' | 'brass' | false), frame colour, light: [{ cells: [i, ...] | 'all', t | t0 + step, color }], run: { row, from, len, t0, step (frames, 2.2) | times: [...], heads: false } (a run lighting cell by cell, each ON its cue; with seeded values the run is made heads), dim: { t } (the unlit ones darken over 6 frames), circle: { cells, t, color } (a red marker ring drawn round them)
- `calendar`: from, to: day numbers or ISO dates ('2025-03-10'); pages: [...] (labels instead); t0, t1 (the pages flip, the target page is showing EXACTLY from t1), month (header when no dates), note (small line), mark: { t, color } (a marker ring round the final date drawn ON the cue), desk: true (a desk stand), w, h, color (header)
- `clock`: time ('10:10') | from + to + t0 + t1 (the hands sweep forward, landing EXACTLY on `to` at t1), ease, seconds: true (a ticking second hand, real time), style 'wall'|'alarm', ring: { t0, t1 } (alarm shakes), r, color (rim), face, numbers: 'all'|'quarters'|false
- `gauge`: min, max, from, value (or to), t0, t1 (the needle swings with a small overshoot and LANDS EXACTLY on value at t1), ease ('outBack'), zones: [[from, to, colour], ...], ticks (major count), unit, title, readout (a digital value under the hub), decimals, r, color (housing)
- `thermometer`: min, max, from, value (or to), t0, t1 (the red rises / falls, LANDS EXACTLY at t1), ease, unit ('°C'), step (labelled ticks), h (board height), color (board), hot (the liquid glows above this value)
- `timer`: from (seconds), to (0), t0 (starts), t1 (optional: reaches `to` EXACTLY at t1, else real time), up: true (counts up), format 'mm:ss'|'ss'|'ss.cc'|'hh:mm:ss', blink (seconds of blinking at the end, 1.5), style 'box'|'bomb', color (digits)
- `speech`: text, to: an actor (or Object3D / [x, y, z]) whose head it floats beside (follows it), side 1|-1 (body to the right / left of the tail), offset: [right, up] (m, camera space), size (text height m, .085), w (max width), color, textColor, in (pops from the tail ON the cue), out, type: true (letters appear over typeDur), billboard: false (keep its own rotation), keepOnScreen: false (never switch sides at the frame edge)
- `thought`: text | draw (a picture name) | image, to, side, offset, size, w (max text width), cw / ch (cloud size m), color, in (the small puffs pop first, the cloud ON the cue), out, keepOnScreen: false
- `checklist`: items: ['text', ...] | [{ text, mark 'tick'|'cross', t, done (ticked from the start) }], times: [t, ...] (each mark is drawn ON its cue: 1 frame before to 4 after), title, strike (cross out the crossed items), w, h, board colour, paper
- `newspaper`: name (masthead, invented), date, headline, sub, image | draw (the photo box), body (columns of grey lines), price, w, h, paper, highlight: { line: 'headline'|'sub', t } (a marker swipe ON the cue), spin: t (the classic spin-in, landing ON the cue)
- `book`: left / right: { title, text, draw, image } (the open spread), turn: { t, left, right } (a page turns and the next spread shows; the page lands ON the cue), w (open width), d (page height), color (cover); lies open facing up (rx tilts it)
- `magnifier`: target: an info object with userData.face (poster, notice, document, newspaper, checklist, board, screen, calendar, book) | { mesh, tex, w, h }; zoom (2), r (lens radius m), path: [{ t, uv: [u, v] }, ...] (u, v 0..1 across the face; the lens lifts on an arc between keys and arrives ON each t) | from, to, t0, t1; hover (m), handle (angle rad); without a target: a standalone glass at `at` showing tex / text / draw
- `label3d`: text, point: an actor (its head) | Object3D | [x, y, z] (followed every frame), anchor: [x, y, z] offset added to the point, offset: [right, up] (m, camera space; default [.28, .3]; keepOnScreen: false stops it flipping sides at the frame edge), size (text height m, .1), color (card), textColor, in (dot pops, the leader draws out, the card pops ON the cue), out, onTop (drawn over everything)

## Places (`S.place(name, o)` -> { spots, cams, ... })

- `living-room`: a lived-in living room: sofa facing a TV, coffee table, rug, lamps, window, shelves, posters, ceiling fan Options: era 80s (wood panelling, CRT + console, VHS) | 90s (CRT + PIXO 16 console, posters) | modern (flat TV, plants); mood day | night | warm | cold | alarm; wall, floor, tv false
- `kids-bedroom`: a kid's bedroom: single bed under string lights and a turning mobile, posters, toys, desk, wardrobe, round rug Options: mood day | night (glow stars on the ceiling, night light) | warm; wall; theme space | dino
- `home-office`: a home office: a desk facing the room with a computer (90s: beige PC, dial-up modem, phone line), chair, shelves, window, cork board Options: era 90s | 80s (beige PC, modem, floppies, rotary phone) | modern (monitor + laptop); mood day | night (screen glow) | warm; wall
- `kitchen`: a home kitchen: counter run with sink under the window, stove with a steaming kettle, fridge, wall cabinets, table with chairs under a pendant lamp, bills and clutter Options: mood day | night (cool + one warm pendant: the stressed look) | warm | cold; era 80s | modern; wall, floor
- `classroom`: a classroom: chalkboard (or whiteboard), teacher desk + floor globe, rows of school desks, windows with blinds, posters, cubbies, a clock Options: era modern (whiteboard) | 80s | 1919 (chalkboard, wood); mood day | warm | night | alarm; o.board text on the board
- `lab`: a science lab: a centre island with microscope and bubbling glowing flasks, bench run with shelves of bottles, fume hood, whiteboard of formulas, server rack, ceiling pipes Options: era modern | 1919 (wood benches, brick, bare bulbs); mood day | night | alarm | cold; o.board text
- `office`: an office floor: the hero cubicle facing the room (computer, papers, plant), neighbouring cubicles, windows onto the city, water cooler, printer, filing cabinets, flickering fluorescents Options: era modern | 80s | 90s (beige computers); mood day | night (overtime) | warm | alarm; wall, carpet colour
- `hospital-room`: a hospital room: bed under a headwall with a live heart monitor, IV stand, privacy curtain on a rail, window with blinds, visitor chair, flowers and pills on a bedside table Options: mood day | night (monitor glow) | cold | alarm; wall
- `diner`: a retro diner: chequered floor, a teal counter with chrome stools, booths under the windows, neon name sign, menu board, pie display, jukebox, pendant lamps Options: o.name (the neon name, invented), o.menu [lines]; era 50s look default | modern (cafe colours); mood day | night (neon + window night) | warm
- `store`: a corner store: an aisle of packed shelves leading to glowing drinks fridges, checkout counter with a cash register, hanging aisle signs, price signs, a claw machine Options: o.name (invented, on the sign), mood day | night (fridges glow) | alarm; wall, floor
- `street`: a street of invented shops seen down its length: road with parked cars and one driving by, sidewalks with lamps, hydrant, bus stop, crossing, traffic light, skyline beyond Options: mood day | night (lit windows, neon, street lamps) | warm | storm (o.rain); o.names [shop names]; o.traffic false (no car driving by)
- `old-town`: an old-town square: cobbles, pastel town houses with shutters and red roofs, a tall stone clock tower, a fountain, café tables under parasols, pigeons, bunting Options: era modern | 1919 | medieval (timber frames, torches, no parasols); o.tower false; mood day | warm | night (string lights, lit windows) | storm
- `harbour`: a working waterfront: a stone quay along the water with bollards, crates and barrels, rails, brick warehouses with painted names, a giant riveted storage tank, a moored steamer smoking, gulls Options: era 1919 (default: steamer, cart, gas lamps, the tank) | modern (containers, motorboat); o.tank false; o.tankName; mood day | warm | night | storm
- `outback`: the red outback: red dirt, spinifex, pale gum trees along a dry creek bed, termite mounds, a campfire with swags, camels, flat-topped mesas on the horizon under a huge sky Options: mood day | warm (sunset) | night (fire-lit, stars); o.camels false (packs only); o.fire false
- `beach`: a tropical beach: noisy sand sloping into a foam-lined sea, palms leaning over the frame, umbrella and towel, sandcastle, shells, a lifeguard tower, boats and a far island; o.kind "island" makes it a small island Options: kind beach | island; mood day | warm (sunset) | night (moon, stars) | storm
- `forest`: a forest clearing on a dirt path: trees in layers, ferns, mossy logs, mushrooms, rocks, light shafts through the canopy and falling leaves; o.kind "park": lawn, path, benches, lamps, pond, flower beds Options: kind forest | park; mood day | warm | night | storm; o.season summer | autumn
- `desert`: a desert: rolling dunes with ripples, bleached bones and a skull, rocks, a lone sign, mesas on the hazy horizon, wind blowing sand; o.kind "cactus" for a cactus desert with buttes Options: kind dunes | cactus; mood day | warm | night | storm (sandstorm haze); o.camel true
- `mountain`: a rocky ledge at a cliff edge high above a valley: a sea of clouds below, snowy peaks beyond, pines, a warning sign; o.bridge adds a rope bridge out to a rock pillar Options: mood day | warm | cold | night | storm; o.bridge true; o.flag true (a summit flag)
- `cave`: a cave: a rocky dome with stalactites and stalagmites, glowing crystal clusters, a still pool, a lantern camp with bones nearby, daylight spilling from the mouth behind; o.mine adds rails and a mine cart Options: mood day (light from the mouth) | night | alarm; o.crystals colour; o.mine true
- `airplane-cabin`: an airliner cabin: rows of 3+3 seats down a patterned aisle, oval windows with clouds sliding past, overhead bins, light strips, glowing exit signs, the galley curtain at the end Options: mood day | night | warm | storm (turbulence) | alarm (oxygen masks down, red light); seat colour o.seats
- `hangar`: an aircraft hangar: corrugated walls, roof trusses, a propeller plane on the painted concrete, tools, ladders, drums; the great doors stand open onto the apron and sky; o.rig adds a big glass water-tank test rig Options: mood day | warm | night (work lamps); o.rig true; o.plane false
- `mission-control`: mission control: tiers of glowing consoles stepping up toward the back, office chairs, a giant wall screen with a live trajectory map and a mission clock, side screens of charts, dim ceiling spots Options: era modern | 60s (green CRT glow, beige consoles); mood night (default: dark room, screens glow) | day | alarm; o.title
- `spacecraft-cabin`: a cramped spacecraft cabin (capsule / lunar module): every wall covered in switch panels, dials and blinking lights, two crew seats, small windows onto space (or the moon outside), cables, an ABORT button; o.float sets small items drifting Options: kind capsule | lander (moon surface in the windows); o.float true; mood cold (default) | night | alarm | warm
- `space-station`: a space-station module: a long white tube of locker panels, handrails and cable bundles, laptops on arms, light strips, a big round window at the end with the Earth curving past; things drift Options: mood cold (default) | night (Earth's night side, city lights) | alarm; o.float false stops the drifting items
- `outer-space`: open space: thousands of twinkling stars, the Earth (or a red planet / gas giant) filling the lower frame, a station module and a satellite drifting, tumbling asteroids, a moon, the sun flaring Options: o.planet earth | red | gas; o.ship station | capsule | none; mood (the rig is always space light)
- `ocean-surface`: the open sea from the deck of a work barge: steel deck with crates, coiled rope, life rings and a wheelhouse, railings, rolling waves to the horizon, a far ship, a buoy, gulls Options: mood day | warm | night | storm (rain, lightning, big waves); o.ship false
- `deep-sea`: the deep sea: near-black blue, marine snow drifting down, a research submersible with real lamps, glowing jellyfish, an anglerfish with its lure, silver fish, rock spires fading into the dark Options: mood (always dark); o.sub false; o.creatures false
- `seafloor`: the deep seafloor: rippled silt, boulders, pale anemones and corals, a flatfish half buried, crabs, a hydrothermal vent puffing black smoke, a bathysphere light from above, marine snow; o.kind "trench" raises steep walls on both sides Options: kind floor | trench; o.vent false
- `museum-hall`: a grand museum hall: marble floor, columns along the walls, paintings, a statue on a plinth, glass display cases (skull, amphora, crown, hourglass), velvet rope barriers, benches, a whale skeleton hanging under a skylight Options: mood day | warm | night (after hours: cases glow, a guard's lamp) | alarm; o.skeleton false

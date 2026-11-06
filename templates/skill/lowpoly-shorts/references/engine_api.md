# Engine API (templates/lowpoly/engine.js, ENGINE_VERSION 5)

Scenes import from `../engine.js` (and the cast from `../models.js`). Metres, y up, people face +z. Times are seconds.

```js
import { shot, loopShot, cue, sfx, KIT, phone, cash, chips, card, roulette, slot, led, bars, lineChart, heart, sign, THREE } from '../engine.js';
import { HERO } from '../models.js';

// ---- 3: he checks his bank app ----
shot({ say: 'He checked his bank', set: 'office', trans: 'push-up', build(S) {
  const you = S.person({ ...HERO, face: 'worried', spot: 'front' });
  you.do('Idle_TalkingPhone_Loop', S.t0);
  you.hold(phone('bank', { balance: '$4' }), { hand: 'r', grip: 'phone' });
  you.expr('shocked', S.at('four'));
  S.callout('$4', { on: you, at: S.at('four'), color: 'red', style: 'banner' });
  S.camera('push', { on: you });
  sfx('beep', S.at('bank'));
  return { you };                      // what the editor can click by name
} });
```

## Shots
- `shot({ say, set, setOpts, build(S), update(st, t, S), cam, on, trans, transDur, grade, captions, split, setB, buildB, camB, name })`
  - `say`: the first 2-4 words of the shot's clause, as spoken. Shots are timed from their words, in order (each search starts
    after the previous shot's words). No times needed. (`t0: seconds` still works.) A miss prints `say miss` in check_preview.
  - `set`: a built-in set (below); `build(S)` adds people and things and returns `st` (named things for clicks / checks).
  - `cam`: camera preset name or `{ kind, ...options }` when you don't call `S.camera()` (default: 'push' on the first person).
  - `trans` (how this shot comes in): `'cut'` (default, ~85-90%), `'push-up' | 'push-down' | 'push-left' | 'push-right'`,
    `'blinds'`, `'flash'` (white flash on a cut), `'mosaic'` (pixel-mosaic dissolve: a state change of one object), `'black'`,
    `'dissolve'` / `'ghost'` (double exposure). `transDur` overrides the length.
  - `grade: 'grey'` (flashback / "legal") or `{ sat, tint: [r,g,b], bright, contrast, grey, vignette }`; animated: `S.grade(t => ({...}))`.
  - `captions: false` hides captions during the shot (when the words are on screen anyway).
  - split screen: `split: 'h' | 'v' | 'diag'` + `setB`, `buildB(S2)`, `camB`: two scenes, A on top / left.
- `loopShot({ say, trans })`: the last shot replays the opening shot (its set, build and camera) timed so it ENDS on the
  opening composition: the video loops.
- `cue('word', near)` absolute time of a word near `near`; inside a shot `S.at('word')` (searched from the shot's clause).

## S (inside build)
- `S.t0, S.t1, S.dur` the shot's times. `S.scene`, `S.cam` (THREE). `S.spots` (the set's places: `{ name: [x, z, ry] }`).
- `S.person(o)` -> Actor (below). `S.animal('cow', { at: [x, 0, z], clip: 'Walk' })`. `S.crowd({ n, area: [x0, z0, x1, z1], face: [x, z] | actor, clips, gap, seed })`.
- `S.prop(id | 'search words', { at: [x, z] | [x, y, z], y, ry, height | width | length | size, tint, name })` -> a library model.
- `S.add(obj | actor, ...)` adds kit objects / THREE objects (they become pickable and checkable).
- `S.set(name, o)`, `S.room({ w, d, h, floor: 'tex.wood_floor', wall, windows, door, lamps, stripe, ceiling })`, `S.floor({ tex, w, d, color })`.
- `S.light('bright' | 'day' | 'moody' | 'warm' | 'night' | 'void' | 'neon', o)`: sets come lit for the look; Moody's warm key
  follows the shot's subject (never a silhouette). `S.lamp([x, y, z], { color, intensity })` a glowing bulb that lights.
- `S.sky('day' | 'sunset' | 'overcast' | 'night' | '#hex')`, `S.fog('dark' | 'haze' | null)`.
- `S.camera(kind, { on, ... })` (Camera) and `S.subject` (what check_layout keeps in frame).
- Overlays (2D, on top, with the look's colour fringe): `S.callout(text, { on, at, until, color, style, size, dx, dy, sub })`,
  `S.counter(from, to, { at, dur, prefix, suffix, on, color })`, `S.panel({ title, sub, icon, x, y, w, h, color, at })`,
  `S.stamp(...)` is BANNED (red stamp / verdict plaques like 'DENIED' are slop in every style: never call it), `S.arrows({ n, dir, x, y, color, at })`, `S.cctv({ cam, start, rewind })`,
  `S.live({ left, right, clock })`, `S.custom((ctx, t, a, S) => {...}, { at })`. Positions in 1080-wide frame units
  (x 0..1080, y 0..1920 for 9:16), or `on:` a person / object / [x, y, z] (it follows it).
  callout styles: `'num'` (big heavy number, black outline + drop shadow: green gains `color: 'green'`, red losses `'red'`,
  yellow facts), `'banner'` (8-bit pixel font on a red bar: shock numbers, brand colour when set), `'pixel'` (pixel-font
  label, e.g. 'POTASSIUM-40'), `'label'` (dark name tag). The pixel font is capitals only: Latin, Russian Cyrillic (engine
  v9) and digits; other letters lose their accents (a letter it has no form for draws as '?').
- `S.flash(at, dur)` white flash; `S.drop(at, [keep...])` the set drops to black around who stays (0.3 s) - a symbolic beat;
  `S.grade(...)`; `S.bills({ from, at, count, spread })` flying banknotes; `S.sting('CHANNEL NAME', { at, hold })` the 3D
  brand sting (chunky voxel letters fly in, hold ~1.2 s, spin out); `S.ring(target)` a white ground circle.
- `S.tick(t => ...)` per-frame code; `S.sfx(type, t)`.

## Actor (S.person)
`S.person({ name, body: 'm' | 'f' | 'mannequin' | 'mannequin_f' | library id, skin: 'pale' | 'light' | 'medium' | 'tan' | 'brown' | 'dark' | 'deep' | '#hex',
  outfit: 'casual' | 'tee' | 'everyman' | 'suit' | 'guard' | 'business' | 'dealer' | 'doctor' | 'scrubs' | 'nurse' | 'police' | 'prisoner' |
  'worker' | 'hoodie' | 'sweater' | 'labcoat' | 'judge' | 'soldier' | 'chef' | 'swim' | 'none' | { top, sleeves: 'short'|'long', shirt, jacket, vest, coat, tie, bottom, shorts, shoes, gloves },
  hair: 'simpleparted' | 'buzzed' | 'buzzedfemale' | 'long' | 'buns' | 'bald', hairColor, beard: true, brows: false,
  hat: 'cap' | 'hat' | 'tophat' | 'police' | 'hardhat' | 'helmet' | 'wig' | 'headset', glasses: true | 'shades',
  face: expression, eyeColor, height (m), clip, phase, at: [x, y, z], ry, spot: set spot name,
  build: 'normal' (default) | 'slim' | 'heavy' | 'athletic' (the file's bodybuilder), brows: 'mesh' (the old mesh brows; off by default) })`
  outfit objects may say `open: true` (an open jacket over the shirt).
- `.at(x, y, z, ry)` / `.at([x, z], ry)`, `.face(target)` turn toward a point / actor.
- `.do(clip, at, { fade, speed, loop })` play a library clip from time `at` (blends 0.25 s). Idle_Loop runs by default.
- `.walk([[x, z], ...], { at, pace, clip, then })` walk along points from the current place, at the clip's own measured
  speed (feet don't slide); `pace` 1.25 = ~2 steps/s (default). `.run(points, o)` jogs. It turns along the path and ends in `then` (Idle_Loop).
- `.sit(chairObject | { pos: [x, seatTopY, z], ry }, { at, enter, clip })` (seat ~0.45 m; enter plays Sitting_Enter first).
- `.hold(obj, { hand: 'r' | 'l', grip: 'palm' | 'grip' | 'phone' | 'card' | 'tray', at, until, offset, rot })` a prop in the hand (follows the hand bone).
- `.lookAt(target, at, { until })` head turns (eased) to a point / actor / object. `.expr('shocked', at)` expression change.
- `.fingers('wiggle' | 'claw' | 'fist' | 'point' | 'open', at, { until, hand: 'r' | 'l' | 'both', rate })` finger poses on top of the clip
  (tickling / typing fingers, a fist, pointing, an open palm).
- `.wear(kind, color)` add a hat / glasses later. `.head()`, `.box()`, `.boneAt('hand_r')` for placing things.
- Expressions (the generated face sheet, library face.sheet1): neutral talk happy grin laugh smug shocked scared angry yell sad crying
  grimace thinking worried disgust sleep dead wink blink.

## Camera (S.camera(kind, options)) - it always moves
`push` (default slow push-in) · `drift` (sideways) · `orbit` (`speed` deg/s) · `dutch` (tilted push, `dutch` deg) · `insert` (macro
on a prop, dutch) · `face` (close-up of the head: it frames the head box, `fill` = head / frame height, `side` deg off the face) · `low` (ground level) · `high` · `wide` · `topdown` (straight down, slow
turn) · `track` (alongside a walker, `dist`, `dir` ±1, `height`) · `follow` (behind a walker) · `pov` (`from`: an actor's eyes,
`look`: the target) · `pull` (fast 10-frame pull-out: starts on `from`, pulls to the wide at `at`) · keys `[{ t, p, l, fov, roll }]`.
Options: `on` (subject), `fill` (subject height / frame height), `fov`, `side` (deg off its front), `yaw`, `dist`, `height`, `push`
(per second), `drift`, `dutch`, `offset: [x, y, z]`, `look: [x, y, z]`. A room's camera stays inside the room.

## Sets (S.set / shot set:)
Interiors: `casino` `office` `bedroom` `living` `kitchen` `diner` `lab` `hospital` `classroom` `courtroom` · exteriors: `street`
`suburb` `park` `farm` `desert` `stadium` · symbolic: `void` / `void-teal` (flat teal), `void-grid` (glowing grid floor),
`void-black` (white grid), `void-purple` / `void-red` (wavy moving backdrop), `space` (stars) · `studio` (plain).
Each gives spots (S.spots: e.g. casino.table / player / slots, office.desk / front / side, street.sidewalk / road / door,
park.path / bench, courtroom.judge / witness / lawyer, hospital.bed / aisle, classroom.teacher / student).

## Kit (procedural, import from engine.js; add with S.add, place with .position)
`phone(ui, data)`, `laptop(ui, data)`, `crt(ui, data)`, `monitor(ui, data)`, `screenWall(cols, rows, pick)`, `screen(ui, data, { w, h })`:
UIs `'bank' | 'bet' | 'camera' | 'cctv' | 'chat' | 'terminal' | 'text' | 'win'` or your own `(ctx, w, h, data) => {}`; screens
have the LCD grid; `.userData.screen.userData.redraw(data)` changes them. Money: `bill()`, `cash({ cols, rows, layers })`,
`moneyCube(size)`, `S.bills(...)`. Casino: `chips(n, color)` (`.userData.setCount(k)` grows a stack), `card(rank, suit)`,
`roulette({ spin: [t0, t1] })`, `slot({ spin: [t0, t1], result: [0,0,0], stops: [t,t,t], settle: [s,s,s], title, neon, color, upright, meter, flash })`:
symbols 0 '7' 1 'BAR' 2 '$' 3 '♦' 4 '★' 5 'X', a red payline; result [0,0,1] = a near miss (settle [.4,.4,1.3]: the third reel crawls);
`upright: true` a standing player's cabinet (deck 1.0 m, reels 1.42 m, bill acceptor `userData.billSlot` - KK_Interact's right hand
reaches it from 0.89 m in front, 0.07 m left of the centre; G_Typing_Standing_Loop / KK_Working_B hands are over the deck from 0.8 m);
`meter: t => ({ credit, bet, win })` an LED credit meter; `flash: [t0, t1]` the neon blinks (a win). Moody casino rows are these cabinets. Numbers: `led('12:45', { color, h })`
(`.userData.set(text)`), `scoreboard({ home, away, score, clock })`, `calendar({ month, day, year })` (`.userData.set({...})`).
Charts: `bars([3, 7, 12], { colors, h, at, dur })`, `lineChart([[x, y]...], { color, at, dur })`. Body: `heart()` (`.userData.beat(t)`),
`lungs()` (`.userData.breathe(t)`), `stomach()`, `skeleton()`; brains / skeletons / DNA also in the library. Signs: `sign('BLACK!', { w, h, bg, color })`, `ring(r)`.
KIT.* also has `crowd`, `sting`, `UI`. Library models: `model(id, o)`, `search(words, { kind })`, `texture(id, { repeat })`.

## Flags the layout check reads (set them only when the odd thing IS the picture)
`root.userData.touch = true` (a hug / handshake: bodies may touch) · `obj.userData.airborne = true` (a prop that flies: no
floating check; it is still checked against the people it passes) · `obj.userData.standOn = true` (a person may stand on it) ·
`obj.userData.sunkOk` / `scaleOk` (buried / odd-sized on purpose) · `obj.userData.noCheck` (decor the check ignores) ·
`shot({ macro: true })` (a camera right at a prop) · `shot({ edgeOk: true })` (the world's edge in view on purpose) ·
`S.wide = true` (a tiny subject is the picture). Never `root.userData.airborne` on a person to quiet the feet check: it turns
every check off for that person (lying / sitting clips are already exempt from the feet checks).

## Sound
`sfx(type, t, { gain, pan 0..1 })` on picture events: whoosh swish impact thud pop click beep coin cash chime win slot roulette
cards chips typing phone camera stamp bell glitch crowd cheer gasp heartbeat alarm explosion honk glass splash tick.
Wipes, flashes and pull-outs get their whoosh by themselves.

## Settings (project.json "settings", set by the look; don't edit unless asked)
`format` vertical|landscape · `look` bright|moody · `render.short` internal pixels (270 / 320) · `post` sharpen ca bloom threshold
vignette grain · `captions` on size y case · `camera` push shake · `transitions.duration` · `ps1` snap affine dither · `brand.color`.
Frame: FW x FH = 1080 x 1920 (or 1920 x 1080); the 3D renders at RW x RH.

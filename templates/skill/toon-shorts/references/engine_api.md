# Engine API (templates/toon/engine.js, ENGINE_VERSION 1)

Scenes import from `../engine.js` (and your own helpers from `../models.js`). Units are metres, +y up, the floor is
y = 0, characters face +z at `ry: 0` (toward the default camera side). Times are seconds of the video; inside a shot
`S.at('word')` gives the time a spoken word starts. Everything is a pure function of time: any frame can be drawn first
(never keep state between frames, never use `Math.random()`: use `rnd(seed)`).

What every name means: `catalog.md` (actor methods, poses, gestures, walks, cast, outfits, expressions, extras, light
rigs, fx kinds, info kinds and their options, places), `props.md` (every prop and its options). How bodies and the camera
move: `motion.md`. Every example in §12 was rendered and passed check_layout as written.

## 1. Sizes to build with

| thing | size |
|---|---|
| grown-up (`regular` body) | 1.63 m to the top of the head; head centre (eyes) at ~1.37 m; head 0.49 m across |
| other bodies (`cast.js` BODY) | slim 1.74 m, strong 1.69, round 1.54, elder 1.53 (stooped), kid 1.13 (head centre ~0.88 m) |
| reach | the arm is 0.5 m from the shoulder (~1.05 m high): a hand reaches ~0.55 m from the body's centre |
| seats | chair .45, stool .48, armchair / sofa .49 (0.86 m deep), office chair .5, bar stool .78 |
| tables | coffee table .42, side table .59, desk / dining table .75, kitchen counter .92 |
| rooms | `S.room` default 7 x 6 x 3 m; the back wall is at z = `front - d` (= -4 by default) |

## 2. A scene file

```js
import { shot, loopShot, THREE, toonMat, outlineAll, E, seg } from '../engine.js';
import { kitchen } from '../models.js';
const F = 1 / 30;                       // one frame

// ---- 3: you grab your coffee ----
shot({ say: 'You grab your coffee', build(S) {
  // set, props, characters, their timelines, camera, sound
  return { you, mug };                  // named things: the editor can click them, crew agents can find them
} });
```

- One shot per clause that starts a sentence (beats inside it for the other clauses: storyboard.md). Files hold one
  chapter each (~6-12 shots) and are listed in project.json `"scenes"` IN NARRATION ORDER.
- `// ---- N: title ----` right above each `shot(`: the editor and `list_shots` name the shot from it.
- `shot(def)` fields:

| field | meaning |
|---|---|
| `say` | the first 2-4 words of the clause, as spoken. The shot starts 0.1 s (3 frames) before them. Searched in order, after the previous shot's words: shots must be in narration order. A miss prints `say miss` (check_preview) and the shot lands 2 s after the previous one. |
| `t0` (or `at`) | an explicit start time instead of `say` (rare: a beat that starts mid-word) |
| `build(S)` | builds the shot once (set, props, characters + all their keys, camera, sfx); returns `st` |
| `update(st, t, S)` | optional, every frame: animate what `build` made (pure in t). `S.tick(fn)` does the same from inside build. |
| `trans` / `transDur` | how this shot comes IN (§3) / its length in seconds |
| `cam`, `on`, `frame` | the camera when build never calls `S.camera` (`cam` is a kind name: `'creep'`, `'push'` ...) |
| `grade` | a fixed grade object for the shot (§9); animated grades: `S.grade(fn)` |
| `dof: false` | depth of field off for the shot |
| `captions: false` | no captions during this shot (e.g. the words are on a sign anyway) |
| `name` | a title when there is no `// ----` comment |
| `camInside: false` | let the camera leave the `S.room` box (fly-throughs past a wall) |

- `loopShot({ say, trans })`: the last shot replays the OPENING shot (its build, update, camera, grade) on a clock that
  ends exactly on the opening's first frame, so the video loops. Its local time runs up to the opening's `t0` (usually
  0): actions keyed after that never play, creep and pushes (which start at `S.t0`) stay parked: keep the loop clause
  short (≤ ~1.5 s) and let the dissolve into it carry the motion. The opening's `S.at()` calls are searched near the
  loop's words and print `cue miss` there: harmless; to silence them write `S.at('word', { near: S.t0 + 2 })` in the
  opening shot.
- Cues: `S.at('word')` = start of the word nearest the shot's `say` (prefix match: 'run' finds 'running'; several words
  `S.at('half an hour')` match in a row). Options `{ after: s }` (search from `say + s`, for a repeated word),
  `{ near: t }` (search near an absolute time), `{ which: 'e' }` (the END of the word). Outside a shot:
  `cue('word', nearTime, 's' | 'e')`. A word not found within 12 s prints `cue miss` and returns the search time.
  Compute cue times once in build (`const tHit = S.at('slam')`), never inside update.

## 3. Transitions (`trans` of the shot that comes in)

The transition is centred on the new shot's `t0` (3 frames before its first word): a 6-frame dissolve runs from 6
frames before the word to the word. Both shots are drawn and keep moving through it. Shot 1 defaults to `'cut'`, every
other shot to `'dissolve'`.

| trans | frames | what it does | use it for |
|---|---|---|---|
| `dissolve` | 6 | cross-dissolve | every new sentence (the default) |
| `match` | 7 | a dissolve; YOU line the shapes up | a round thing onto a round thing, a face onto a face: the incoming feature on the same screen spot at a similar size (frame both with `place` / `frame` and render the transition's middle frame to compare) |
| `zoom` | 9 | A rushes past the lens, B lands from slightly big (+ an automatic whoosh) | the end of a fly-through or a dive into something; the zoom-through an eye |
| `whip` (= `whip-left`), `whip-right`, `whip-up`, `whip-down` | 12 | both pictures slide with a motion smear (+ whoosh). `whip`: the picture moves left (the camera pans right) | the next subject in the SAME set, never across places |
| `push` | 10 | the new shot slides down from the top and pushes the old one out | rare: a stacked list, a lift going down |
| `flash` | 4 | a hard switch under a white flash | lightning, a camera flash, a shock |
| `black` | 16 | a dip through black | a time skip (night falls), the one slow pause |
| `cut` | 0 | a hard cut | only the five allowed cuts (storyboard.md §5) |

`transDur: 8 / 30` lengthens one (4-8 frames for dissolves; up to 11 for a slow change of place or night).

## 4. The S object (inside build)

| member | what |
|---|---|
| `S.t0`, `S.t1`, `S.dur` | the shot's start / end (the next shot's t0) / length |
| `S.scene`, `S.cam`, `S.def`, `S.THREE`, `S.C` (palette), `S.aspect`, `S.vert` | the three.js scene and camera, the shot def, helpers |
| `S.add(obj, ...)` | adds things you built (objects or actors) (a `userData.kind` or `pickRoot` makes them clickable and layout-checked) |
| `S.tick(fn)` | `fn(t, S)` every frame (animate doors, lamps, screens) |
| `S.at(word, o)` | the cue time of a word (§2) |
| `S.subject` | what check_layout keeps in frame and readable (set by `S.camera(..., { on })`; assign it yourself when the shot is about someone else) |
| `S.spots`, `S.placeName` | named spots of a place (`S.place`) |
| `S.bounds` | the room box (`S.room` sets it): the camera is clamped inside unless `camInside: false` |
| `S.rig` | the last light rig: `{ kind, key, fill, rim, hemi }` (THREE lights: animate `.intensity` / `.color` in a tick) |
| `S.props`, `S.actors` | what was added |
| `S.screen(p)` | `[x, y, inFront]` in frame pixels (1080 x 1920) of an actor (a point above its head), an object (its centre) or `[x, y, z]` |

## 5. Sets: room, floor, sky, light, fog, places

- `S.room({ w: 7, d: 6, h: 3, front: 2, wall: '#7d8f8a', wallKind, floorKind: 'wood', floor: colour, ceiling: true,
  ceilingColor, skirt, dado: true, sides: [-1, 1], ext: 6 })`: floor + back wall at z = `front - d` + two side walls +
  a ceiling + skirting. Floor, side walls and ceiling run `ext` metres past the front so a pulled-back 9:16 camera never
  sees the void. `wallKind` / `floorKind`: `wood | tiles | checker | carpet | concrete | plaster | wallpaper | grass |
  sand | asphalt | metal`. Sets `S.bounds` (camera clamp).
- `S.floor({ size: [30, 30] | r (disc), kind, color, repeat, at: [x, z], y, rough })`: a ground plane (exteriors, a sand
  disc on the sea).
- `S.sky('day' | 'dusk' | 'dawn' | 'night' | 'storm' | 'space' | 'underwater' | 'interior' | 'neon' | ['#top', '#horizon'],
  { sun: [x, y, z], sunGlow, stars, starCount })`: a sky dome (night and space add stars).
- `S.light(rig, o)`: `studio | interior | day | sunset | night | bulb | neon | underwater | space | alarm` (moods: style.md
  §4). o: `{ key: '#hex', ki, fill, fi, rim, ri, sky, gnd, hi, kd: [x, y, z] (key direction), at: [x, z] (centre of the
  shadowed area), shadowSize: 6 (half-width of the shadow box: raise it for big exteriors), shadows: false }`. A shot
  without a light gets `studio`. Calling it twice adds a second rig (avoid: double light).
- `S.fog(color, near, far)`: distance haze (exteriors: `S.fog('#cfe8f6', 40, 160)`).
- `S.place(name, o)`: a whole dressed place in one call (floor or terrain, walls or sky, the light rig and practicals,
  12-30 props in three depth layers, something always moving: no extra `S.room` / `S.light` on top). Options on every place: `seed` (layout, props,
  colours), `mood` (`day | night | warm | cold | alarm | storm` where it fits), `era` (`modern | 80s | 90s | 60s | 1919 |
  medieval` where it fits), `density` (.5-1.5), wall / floor colours, `name` / `signs` (texts), `maxLights` (real lights,
  4), plus each place's own. Returns `{ spots: { name: [x, z, ry] }, cams: { name: camera options }, props: { name:
  Object3D }, seats: { name: { at: [x, z], ry, y, prop } }, tops: { name: prop }, bounds, mood, era }` and merges the
  spots into `S.spots`. The places, their aliases, options and spots: catalog.md § Places (or the header and `def(...)`
  lines of `lib/places.js`).

```js
const P = S.place('living-room', { seed: 2, mood: 'night', era: '90s' });
const you = S.char('main', { at: P.spots.center.slice(0, 2), ry: P.spots.center[2] });   // spot names: see the place
S.prop('mug', { on: P.tops.table, at: [.2, 0], rel: true });                              // dress it for THIS story
S.camera('creep', P.cams.wide);                                                             // the place's own wide
```

  A place is a start, not the shot: add the story's own props, a joke sign, the light beat, and check what each camera
  sees. Re-aiming a place cam at a character with a tighter frame (`{ ...P.cams.center, on: you, frame: 'ms' }`) keeps
  its angle, and the place's foreground pieces (a TV cabinet, a counter) can end up in front of the face: check_layout
  does not see that, look at the still.

## 6. Props: `S.prop`, `S.scatter`

```js
const desk = S.prop('desk', { at: [0, -2.6], ry: 0 });                        // on the floor at x, z
const mug  = S.prop('mug', { on: desk, at: [.3, -2.5], fill: 'coffee' });      // ON the desk top: at = absolute x, z
const lamp = S.prop('desk_lamp', { on: desk, at: [-.3, 0], rel: true });       // rel: at is relative to the desk's x, z
S.scatter(['rocks', 'bush', 'grass'], [x0, z0, x1, z1], 12, { seed: 4, gap: .6, avoid: [[x, z, r]], scale: 1, vary: .3, ry });
```

- Placement options (reserved names, never a prop's own setting): `at: [x, z] | [x, y, z]`, `y`, `ry`, `on`, `rel`,
  `scale`, `seed`, `shadow: false`. `on: prop` puts it at that prop's `userData.top` height; WITHOUT `rel: true` the
  `at` x, z are world coordinates (the default `[0, 0]` drops it at the world origin, not on the table). The table's
  rotation is ignored: give the x, z yourself.
- Everything else in the options is the prop's own (`fill`, `text`, `open`, `lit`, `kind`, `w` ...): props.md lists
  them per prop. Search props.md by tag before building anything by hand (317 props).
- `userData` conventions you can read: `top` (stand things on it), `seat` (sit on it), `grip` (`{ at, rot }` where a
  hand holds it), `footprint` / `solid` (the layout check), `screen` (a canvas texture: redraw it), `light` (its real
  light), `door` / `doors` / `lid` / `hands` / `pivot` / `wheels` (parts to animate in a tick), `setLit(on)`, `fireAt`
  / `lavaAt` / `exhaustAt` / `muzzleAt` (where an fx goes). Wall pieces (door, window, picture_frame, mirror,
  calendar, wall_cabinet, towel) have their back at z = 0: put them at the wall's z + 0.01 (`wall_clock` is centred on
  z = 0: + 0.03).
- Props that open or move have the part ready: `fridge.userData.door.rotation.y = -1.85 * k` (open 0..1), `door`
  prop `userData.door.rotation.y = -1.75 * k`, `wall_clock.userData.hands.minute.rotation.z`. Build them with
  `open: .001` when the inside should exist (the shelves, the lit plane behind a door) but look shut.
- Your own prop (when the kit lacks it): a Group of rounded meshes with `toonMat(color, { rough, metal, emissive, ei })`,
  then `outlineAll(group, '#2a1d17', w, 1.2)` (w = ~0.8 % of its size), `group.userData.kind = 'ball'`, `S.add(group)`.
  Add `userData.grip`, `top`, `seat` when hands or other props use it.

## 7. Characters: `S.char`

```js
const you = S.char('main', { at: [x, z], ry, face: 'happy', pose: 'hips' });   // the project's main character = "you"
const doc = S.char('mei', { at: [1, -1], ry: -.4, outfit: 'hazmat' });         // a cast id + a topic outfit
const kid = S.char('bo', { look: { top: { type: 'hoodie', color: '#cc3333' } } }); // look overrides REPLACE whole parts
const gus = S.char({ name: 'Gus', body: 'round', skin: 'tan', hair: { type: 'curly', color: '#222222' },
  top: { type: 'tee', color: '#2f9c95' }, bottom: { type: 'pants', color: '#333344' }, shoes: '#222222' });   // a one-off
const ava = S.char('c_k3x9q2', { at: [2, 0] });   // one of THIS project's own characters (engine v2)
```

The project's OWN characters (engine v2): New project can make a random character, a random cast for the whole video, or
one described in words; they are stored in project.json `settings.characters.custom` (`{ "c_k3x9q2": { name, role, body,
skin, hair, top, bottom, shoes, hat, acc } }`) and `settings.characters.main` may name one of them. When the project has
own characters, they ARE this video's cast: `S.char('main')` is "you", the others play the supporting roles by their id
(their `role` says who they are), before any built-in cast id. Never redesign them in a scene: same look in every shot.

Colours are always 6-digit hex (`'#cc3333'`): the clothes painter and `shade()` read 6 digits; `'#c33'` comes out as a
broken colour (`'#7f02NaN'`).

- Options: `at: [x, z]`, `ry` (radians, 0 = facing +z), `y` (standing on a raised floor), `face` (expression from the
  start), `pose` (starting pose), `outfit`, `scale` (the whole body), `look: { ... }`.
- `look` merges shallowly: `look: { top: { color } }` loses the top's `type`; always give the whole part. Parts: `body`,
  `skin` (`pale | light | warm | tan | brown | deep | white` or `'#hex'`), `hair: { type, color }`, `top: { type, color,
  color2, pattern, under, tie, badge, vest, trim, belt, collar }`, `bottom: { type, color }`, `shoes`, `boots`, `gloves`,
  `hat`, `hatColor`, `acc: [...]`, `limbs`, `face: { scale, y }` (move the face sprite down under a cap brim:
  `face: { y: -.06 }`). Types are listed at the top of `lib/cast.js`; the cast and outfits in catalog.md.
- The white-face palette: the project setting `characters.palette = 'white'` makes every head white; one character:
  `look: { skin: 'white' }`; keep one character's tone in a white project: `look: { palette: 'skin' }`.
- `S.char` returns an Actor: its timeline methods (walk, gesture, face, sit, take, throw ...) are in motion.md and
  catalog.md. Internals you may need: `a.toon.head` (the head group: attach things that ride the head), `a.toon.B`
  (body sizes: `B.head` radius, `B.leg`, `B.torso`, `B.arm`), `a.toon.height`, `a.head()` (head centre), `a.box()`,
  `a.home` (`{ x, z, ry, y }` where it stands).
- `S.add(actor)` order is update order: create a THROWER before the CATCHER (pitfall: the thrower otherwise pins the
  caught prop to the landing point).

## 8. Effects (`S.fx`) and in-world information (`S.info`)

`S.fx(kind, o)` adds a pure-time effect and returns its group. Common options: `at: [x, y, z]` (or an object: its centre
at build time), `area: [w, h, d]`, `count`, `size`, `color`, `seed`, `intensity`, `wind: [x, y, z]`, `t0` / `t1`
(emitters start / stop; weather fades in / out), `t` (when a one-shot fires: default the shot start + 0.5 s), `times` /
`every` (repeats), `sfx: false` (no automatic sound).

| kind | options (defaults) |
|---|---|
| `dust` | motes drifting in light: `at, area, count 70, size .016, color, wind` |
| `rain` / `snow` | `at` (ground centre), `area [10,7,10]`, `count 700` / `380`, `speed`, `wind`, `splashes` |
| `leaves` / `petals` | tumbling, settling: `at, area [6,4,6], count 40, size .11, palette` ('autumn', 'green', 'petals') |
| `confetti` | a burst at `t` (with `dir`, `speed`) or falling (`area`); automatic `pop` |
| `smoke` / `steam` | `at, color 'grey' / 'white' / 'black', rate 7, life 2.8, size .3, grow, rise`; steam: `count 3, height .35` |
| `fire` / `campfire` / `embers` | `at, size .5, count 7, light, t0` (ignite) `t1` (die); campfire adds logs, stones, smoke |
| `sparks` | a burst of streaks at `t`: `count 26, dir, spread 75, speed 4, gravity, life .6` |
| `explosion` | flash light + fireball + debris + smoke ring at `t`: `size 1`; automatic `impact` |
| `splash` | water jet + drops + rings at `t` (`at` = the surface point); automatic `splash` |
| `bubbles` | `at, area [.8,1.6,.8], count 18, rise .45, size .045` |
| `sparkle` (= `glint`) | 4-point star glints for 10 frames: `at` or `on: object`, `t` or `times`, `count 1, size .16, sfx: true` (a ding) |
| `stars` | twinkling stars: `count 420, radius 120` |
| `lightCone` (= `bulb`, `cone`) | a hanging bulb + visible cone + floor pool + a real spot light: `at` (bulb), `length`, `radius`, `color`, `swing` (deg), `period 2.7`, `dust`, `shade`, `shadows: false`, `light: false` |
| `godrays` | window shafts: `at` (window centre), `size [w, h]`, `dir`, `length 5`, `count 4`, `dust` |
| `glow` | a halo on a light source: `at` or `on`, `size .5, color, flicker, pulse, streak` |
| `water` (= `sea`, `ocean`) | stylised water with waves and foam: `at, size [40,40], waves .06, color, shallow, foam` |
| `underwater` (= `caustics`) | caustics + motes + bubbles + rays + blue fog: `at, area [12,12], depth 6` |
| `clouds` | puffy drifting cloud groups: `at, area [140,12,50], count 7, size 7, speed .5`, `tone`: 'day' / 'dusk' / 'night' / 'storm' / 'pink' |
| `fog` (= `mist`) | low ground mist layers: `at, size 16, height .7, layers 6, color, opacity .5` |
| `lightning` | bolt + sky flash at `t` (`times` / `every`): `at` (strike point), `height 14`, `flash`; thunder `impact` 0.35 s later |
| `tornado`, `lava` | `at, height 6, radius 2, speed` / `at, size [6,6]` |
| `trail` (= `ghost`, `smear`) | copies along a moving object's path: `of` (an object or an actor) or `path(t)`, `t0, t1`, `style` 'ghost' / 'glow', `copies 3, gap 1.5` (frames), `minSpeed` |
| `speedLines` | streaks past a fast / falling thing: `of` or `at, dir [0,-1,0], count 28, radius [.45,1.3], speed 16` |
| `xrayScan` (= `xray`, `scan`) | a cyan line sweeps down in 10 frames at `t`; above it `of` turns into a translucent x-ray body and `inside` (your organs, a skeleton, a signal cord) appears; `back: t` sweeps it back. `dur`, `dir` 'down' / 'up', `xColor, xOpacity .6, rimColor, color, glowColor, thickness` |

`S.info(kind, o)` builds an in-world information object (sign, poster, notice, document, screen, led, scoreboard,
board, tag, price, mapTable, globe, satellite, bars, digits, grid, calendar, clock, gauge, thermometer, timer, speech,
thought, checklist, newspaper, book, magnifier, label3d), places it and adds it. Every kind's options: catalog.md.
- Common: `at: [x, z]` (floor, or the kind's usual height for wall things) or `[x, y, z]`, `y`, `on`, `rx / ry / rz`,
  `scale`, `in: t` (pops in, ~full size ON that frame), `out: t`, `parent`, `add: false`, `outline: false`, `sfx: true`
  (its own sound on its event: a ding when a counter lands, pops for pins, clicks for marks).
- Origins: standing things at their base on the floor; wall things at their centre with the back on z = 0, facing +z
  (put them at the wall's z + 0.01).
- Cue rules (pass `S.at('word')`): counters, gauges, thermometers, clocks, calendars and timers LAND EXACTLY on their
  target at `t1` (never show it before); lights, scores, screen states and pops are ON at their cue; marks drawn by hand
  (ticks, highlights, board writing) START on their cue; travelling things (pins, stacked bars, route dots) TOUCH DOWN
  on their cue.
- Facts live here, never in 2D overlays. No verdict stamps or red plaques (banned).

## 9. Camera, focus, grade

`S.camera(kind, o)` sets the shot's camera (one per shot; the last call wins) and `S.subject = o.on`.

Framings (`frame`): the head's size is measured against the frame WIDTH in 9:16, and the head centre always lands above
the caption band:

| frame | ecu | cu | mcu | ms | mws | ws | ews | aerial |
|---|---|---|---|---|---|---|---|---|
| head width / frame width | 128 % | 57 % | 40 % | 27 % | 19 % | 11 % | 4 % | 1.7 % |
| head centre (from the top) | 44 % | 40 % | 36 % | 32 % | 33 % | 40 % | 46 % | 50 % |
| default height angle | 6° | 6° | 6° | 6° | 6° | 6° | 18° | 70° |

- An object subject (`on: prop`): the frame width = 0.45 / 0.85 / 1.2 / 1.7 / 2.4 / 4.2 / 11 / 26 x the object's size for
  ecu ... aerial, centred at 45 %. A point subject (`on: [x, y, z]`): a 0.6 m object at that point. A number
  (`frame: 3.4`): the frame is that many metres tall at the subject (actors' heads at 38 %, objects centred).
- Options on every kind (except keys / fly): `on`, `frame` (the start framing; push / move also `from`), `to` (end
  framing), `side` (degrees around the subject from its facing; + = toward its left), `yaw` (absolute degrees: 0 = the
  camera at +z looking toward -z), `height` (degrees above), `zoom` (x the distance), `place: [x, y]` (move the subject
  in the frame, -1..1: `[0, .15]` raises it), `offset: [x, y, z]` (metres added to the look-at), `fov` (34 for ecu / cu,
  else 40; 60 for corridors and arrivals, 22 for a tele two-shot), `roll` (degrees), `lockAt` (the time the subject is
  framed at; default the shot start), `follow` (true: re-solve every frame; false: don't carry the camera along a
  walking subject), `creep` (.06 = 6 % of the distance a second, at most 35 %), `drift` (1: the sub-pixel wander that
  keeps holds alive), `into` (true or seconds: a cubic-in push whose speed peaks ON the cut; `intoAmt` .42), `react`
  (`t` or `[{ at, amt: .3, frames: 19 }]`: the reaction push, sine in, settles back 15 %), `end: { ... }` (options for
  the END framing only).
- A walking subject is followed by itself: the framing locked at `lockAt` slides with the subject's floor path (never
  its bob or hops). `static` never moves.

| kind | what (defaults) |
|---|---|
| `creep` | the default: framing `frame` ('ms'), creeping in ~6 %/s after a 0.4 s ease-in |
| `static` | no creep, no follow (a deliberate still: ≤ 2 per short, each < 1 s) |
| `push` | log-zoom from `from` ('ms') to `to` ('cu'), `at` (S.t0), `dur` (to the shot end), `ease` ('inOutSine') |
| `move` | like push (to 'ws' by default), with the creep on top: a reframe in any direction |
| `reveal` (= `pull`) | the pull-out: `from` → `to` ('ws'), `at`, `dur 1.6`, ease-in for a few frames then a long settle, a slight tilt up (`tilt`) |
| `pan` | re-aim from `on` to `toward` (an actor / object / point) in 18 frames cubic-out at `at` (S.t0 + 0.4), `frame2` |
| `orbit` | `deg 30` around the subject over `dur` (the shot) from `at`, ease inOutSine |
| `crane` | rise from `height` to `height2` (40) over `dur`, `frame2` |
| `track` | alongside a walker, re-solved every frame: absolute `yaw` 90 (the camera on +x: for a walker moving along z; `yaw: 0` for one moving along x) |
| `follow` | keep a moving thing in frame, the look-at lagging `lag .12` s (`mix .85`) |
| `keys` | `keys: [{ t, p: [x,y,z], l: [x,y,z], fov, roll }]` (absolute times), `ease 'inOutCubic'`, `focus` |
| `fly` | `path: [[x,y,z], ...]` (camera), `look: [[x,y,z], ...]` (or one point), `from` / `to` (times: the shot), `ease 'inOutSine'`, `fov`, `focus` (fly-throughs, aerial sweeps) |

No `S.camera` call: `cam` (a kind name, default `creep`) on `on` / the first character, `frame` 'ms'. `keys` and `fly`
have no creep, no `into`, no `react`: give them their own accelerating curve (`ease: 'inCubic'` into a transition).

Depth of field (on by default; the look sets its strength):
- The focus follows the camera's subject. `S.focus(target, { at, dur: 10 / 30, aperture })` racks it to an actor (its
  eyes), an object, `[x, y, z]` or a distance in metres at `at`; call it in time order. `S.focus(mug, { at: tSee, dur: 4 / 30 })`.
- `S.dof({ aperture: .12, radius: 16, amount: 1, on: false })`; `shot({ dof: false })`.

Grade and flashes:
- `S.grade({ ... })` or `S.grade(t => ({ ... }))`: `tint: [r, g, b]`, `lift: [r, g, b]`, `sat`, `bright`, `contrast`,
  `grey`, `fade` (to black), `vignette`, `bloom`, `threshold`, `flash`. An alarm wash ON its word:
  `tint: [1 + .35 * k, 1 - .25 * k, 1 - .25 * k]` with k ramping over 4 frames (§12.8). Light changes are better done
  with the light itself (`S.rig.key.color`, `S.light('alarm')` in a shot of its own) when the whole set changes.
- `S.flash(at, dur = .3)`: a white flash (a camera flash, a lightning strike, the cover of a flash cut).

## 10. Overlays and sound

- `S.label('Text', { at: () => S.screen(obj), t0, t1, x, y })`: a white label with a leader line (at most ONE in a
  short, for the big reveal). `S.arrow({ from: [x, y] | fn, to: [x, y] | fn, t0, t1, color })`. `S.over({ draw(ctx, t, S),
  t0, t1, what })` a custom 2D overlay. Never panels, stamps or HUDs over a character shot.
- `S.sfx(type, t, { gain, pan, dur })` (also `sfx(...)`): a sound on a picture event. Types and rules: sound_design.md.

## 11. Captions, models.js, performance

Captions are drawn by the engine from the narration: 1-2 words (a short function word glues to the next, ≤ 15
characters), Inter 800 white with a dark stroke, centred at 70.5 % of the height, on 3 frames before the word, swapped
instantly, held until the next (cleared after a pause > 0.7 s), drawn over everything including transitions. Their band
is 66-76 % of the height: no face there (check_layout: `caption`). Settings (`captions.on / size / y / words / case:
'upper'`) belong to the user; `captions: false` hides them for one shot.

models.js holds this project's reusable pieces: a set used by several shots (`export function kitchen(S) { ...; return
{ counter, fridge, ... }; }`), a dressed corner, a recurring prop you built, a recurring character spec
(`export const GUS = { name: 'Gus', body: 'round', ... }` then `S.char(GUS)`). Import them in scenes.

Performance (every shot is built when first shown; a heavy build stalls the preview and the export):
- A character is a few dozen meshes, each with an outline; 10-15 extras in a crowd shot are fine, 40 are slow: far
  extras can be fewer and simpler.
- Big machines and buildings (`slot_machine`, `galleon`, `oil-rig`, `skyscraper`, `control_panel`) are hundreds of
  meshes: one or two per shot, not rows of them. `S.scatter` 10-20 things, not 200.
- `tree` is ~65k triangles at `detail: 1`: use `detail: .3-.5` for every tree that is not close.
- Real lights cost on every surface: lamps with a point light (`floor_lamp`, `desk_lamp`, `pendant_lamp`, `bulb`,
  `lightbulb`, `candle`, `camp-lantern`, `street-lamp` lit, `wall-torch`), `fire`, `lightCone` (a shadowed spot) and
  `explosion` all add one. Keep ~6 real lights in a shot; far practicals can glow without lighting (`lit: false` where
  the prop offers it, or `prop.userData.light.intensity = 0`).
- Shadows come from the key light (a 2048 map over `shadowSize` x 2 metres; `lightCone` and `fire` with `shadows`
  add their own): big exteriors need `shadowSize` 12-20 or the shadows stop at the edge of a small box.

## 12. Worked examples (each rendered in the lab; copy, then change the set and the words)

The kitchen helper used by 12.1 and 12.7 (put it in models.js):

```js
export function kitchen(S, o = {}) {
  S.room({ w: 7, d: 6, h: 3, wall: '#e9d8b4', wallKind: 'wallpaper', floorKind: 'tiles', floor: '#d9cbb0' });   // back wall at z = -4
  S.light('interior');
  const K = {};
  K.counter = S.prop('kitchen_counter', { at: [-1.6, -3.68], w: 1.8 });
  K.stove = S.prop('stove', { at: [.05, -3.67], lit: true });
  K.fridge = S.prop('fridge', { at: [1.25, -3.64], open: o.fridgeOpen ?? 0 });
  S.prop('window', { at: [-1.6, -3.99], mount: 1.2, view: 'day' });
  S.prop('wall_clock', { at: [.05, -3.97], mount: 2.25, time: '7:45' });
  S.prop('wall_cabinet', { at: [-2.2, -3.99], w: .9 });
  S.prop('pendant_lamp', { at: [-.4, -1.6], ceiling: 3 });
  S.prop('toaster', { on: K.counter, at: [-2.2, -3.7] });
  S.prop('cereal_box', { on: K.counter, at: [-1.05, -3.75], ry: .3 });
  S.prop('kettle', { on: K.stove, at: [.15, -3.6] });
  K.table = S.prop('dining_table', { at: [-.2, -1.7], w: 1.3 });
  S.prop('chair', { at: [-.2, -2.35] });
  S.prop('fruit_bowl', { on: K.table, at: [-.4, -1.75] });
  S.prop('mug', { on: K.table, at: [.15, -1.55], fill: 'coffee' });
  S.prop('potted_plant', { at: [2.9, -3.6], kind: 'leafy' });
  S.prop('rug', { at: [-.2, -1.5], shape: 'round', w: 2.4 });
  K.mess = S.prop('pizza_box', { at: [1.3, -1.2], open: .8, ry: -.4 });
  S.prop('bowl', { at: [1.75, -.9], fill: 'cereal' });
  S.prop('trash_can', { at: [2.6, -2.9] });
  S.fx('dust', { at: [-.4, 1.6, -2], area: [4, 2.4, 3], count: 60 });
  return K;
}
```

### 12.1 Walk into a dressed place, react on a word

```js
// ---- 1: you walk into the kitchen and spot the mess ----
shot({ say: 'You walk into the kitchen', build(S) {
  const K = kitchen(S);
  const you = S.char('main', { at: [-2.6, -.2], ry: Math.PI / 2, face: 'happy' });
  you.walk([[-.9, -.5]], S.t0 - .3, { style: 'brisk', face: 'camera' });     // started before the shot: mid-stride on frame 1
  const tMess = S.at('mess');
  you.headTo(K.mess, S.at('spot'));                                          // the head turns to the mess on "spot"
  you.look(K.mess, S.at('spot') - 2 * F);                                    // the pupils lead by 2 frames
  you.face('shocked', tMess);                                                // fully on at the word (it pops)
  you.gesture('head', tMess);                                                // both hands on the head, landing 4 frames early
  S.camera('creep', { on: you, frame: 'ms', yaw: 15, react: [{ at: tMess + 5 * F, amt: .1 }], into: true });   // yaw 15: toward the dressed back wall
  S.sfx('swish', tMess - 4 * F, { gain: -4 });
  return { you, mess: K.mess };
} });
```

### 12.2 Reach and take

```js
// ---- 2: you grab your coffee from the desk ----
shot({ say: 'You grab your coffee', build(S) {
  S.room({ w: 6, d: 5, h: 2.8, wall: '#6f8fa0', floorKind: 'wood' });        // back wall at z = -3
  S.light('interior');
  const desk = S.prop('desk', { at: [0, -2.6] });
  const mug = S.prop('mug', { on: desk, at: [.3, -2.5], fill: 'coffee', print: 'smile' });
  S.prop('laptop', { on: desk, at: [-.25, -2.65], ry: .25, app: 'chart' });
  S.prop('desk_lamp', { on: desk, at: [-.5, -2.75], ry: .6 });
  S.prop('sticky_note', { on: desk, at: [.05, -2.45], text: 'CALL MOM', ry: -.2 });
  S.prop('potted_plant', { on: desk, at: [.55, -2.8], kind: 'snake', small: true });
  S.prop('bookshelf', { at: [-1.9, -2.75] });
  S.prop('window', { at: [1.2, -2.99], mount: 1.0, view: 'day', blinds: true });
  S.prop('office_chair', { at: [-1.05, -1.95], ry: .4 });
  S.prop('trash_can', { at: [.9, -2.6] });
  S.prop('calendar', { at: [-.9, -2.99], text: 'MAY', day: 12 });
  S.prop('floor_lamp', { at: [2.4, -2.6] });
  const you = S.char('main', { at: [.95, -2.4], ry: -Math.PI / 2, face: 'sleepy' });   // beside the desk, facing it
  const tGrab = S.at('coffee') - 2 * F;
  you.take(mug, tGrab, { side: 'L' });                                       // the hand ARRIVES on the mug at tGrab and holds it from then on
  you.pose('holdL', tGrab + 2 * F, { dur: 8 * F });                          // and brings it up in front of the chest
  you.face('blissful', S.at('coffee'));
  S.fx('sparkle', { on: mug, t: tGrab + 3 * F });
  S.camera('creep', { on: you, frame: 'ms', side: 35, into: true });         // across the desk at the face: the reach comes toward us
  S.sfx('click', tGrab, { gain: -6 });
  return { you, mug, desk };
} });
```

The hand: a character's LEFT hand is on its +x side (on screen right when it faces the camera). Pick the hand on the
prop's side and the one the camera sees.

### 12.3 Walk to a seat and sit on the word

```js
// ---- 3: then you sit down with a sigh ----
shot({ say: 'Then you sit down', build(S) {
  S.room({ w: 7, d: 6, h: 3, wall: '#b06a5a', wallKind: 'wallpaper', floorKind: 'wood' });
  S.light('interior');
  const chair = S.prop('armchair', { at: [.5, -2.2] });
  S.prop('side_table', { at: [1.35, -2.4] });
  S.prop('floor_lamp', { at: [-.6, -3.2] });
  S.prop('bookshelf', { at: [-2.2, -3.75] });
  S.prop('picture_frame', { at: [.5, -3.98], w: .9, h: .6, art: 'landscape' });
  S.prop('rug', { at: [.2, -1.5], w: 2.6, d: 1.8 });
  S.prop('coffee_table', { at: [.3, -.9] });
  S.prop('book_stack', { at: [-2.6, -1.6], count: 6 });
  S.prop('potted_plant', { at: [2.8, -3.4] });
  S.prop('radiator', { at: [2.2, -3.95] });
  const tSit = S.at('down');                                                 // the CONTACT frame
  const you = S.char('main', { face: 'sad' });
  you.sit(chair, tSit, { face: 'blissful', back: .45 });                     // sets the spot in front of the seat (deep seat: back .45)
  const spot = [you.home.x, you.home.z];                                     // read that spot back ...
  you.place(-.6, -.6, Math.PI / 2);                                          // ... start somewhere else
  you.walk([spot], tSit - 2.4, { style: 'walk', until: tSit - 24 * F, endYaw: chair.rotation.y });   // arrive 24 frames before the contact
  you.nod(S.at('sigh'));
  S.camera('creep', { on: you, frame: 'mws', side: -25, lockAt: tSit, into: true });   // framed where it sits
  S.sfx('thud', tSit, { gain: -6 });
  return { you, chair };
} });
```

`sit()` moves the character's home to the seat front, so call it first and walk to `you.home` afterwards. The sit
itself starts 19 frames before the contact (dip, rise, descent; `quick: true`: 11 frames, no dip): the walk must end
before that, so start it early (before the shot when the clause is short). Chairs and stools use
the default `back`; armchairs and sofas (0.86 m deep) need `back: .45`.

### 12.4 Throw and catch

```js
// ---- 4: Rex throws you the ball and you catch it ----
shot({ say: 'Rex throws you the ball', build(S) {
  S.floor({ kind: 'grass', size: [40, 40] }); S.sky('day'); S.light('day');
  S.prop('fence', { at: [0, -3.5], length: 9 });
  S.prop('tree', { at: [-3.2, -5], detail: .6 }); S.prop('tree', { at: [3.4, -6], seed: 3, detail: .6 });
  S.prop('bush', { at: [-1.6, -3.2] }); S.prop('bush', { at: [2, -3.1], flowers: true });
  S.prop('park-bench', { at: [1.2, -2.6] });
  S.scatter(['flowers', 'grass'], [-4, -3, 4, 1.5], 14, { seed: 4, avoid: [[-1, -.6, .8], [1, -.6, .8]] });
  S.fx('clouds', { tone: 'day' });
  const ball = new THREE.Group(); ball.name = 'ball'; ball.userData.kind = 'ball';
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(.075, 24, 16), toonMat('#e2432f', { rough: .4 })));
  outlineAll(ball, '#2a1d17', .004, 1.2);
  S.add(ball);
  const rex = S.char('rex', { at: [-.6, -1.2], ry: Math.PI / 2 - .5, face: 'smug' });       // the thrower is created FIRST
  const you = S.char('main', { at: [.4, -.2], ry: -Math.PI / 2 + .5, face: 'neutral' });    // close, staggered in depth, both 3/4 to the lens
  rex.stand('holdR'); rex.hold(ball, 'R');                                   // in his hand from the start
  const tThrow = S.at('ball'), tCatch = S.at('catch');                       // ~0.75 s of flight reads best (11 frames up, 11 down)
  rex.throw(ball, tThrow, { to: you });                                      // the flight ends in your hand at your catch time
  you.catch(ball, tCatch);
  you.face('surprised', tThrow + 4 * F).face('happy', tCatch + 2 * F);
  S.camera('creep', { on: [-.1, 1.15, -.7], frame: 3.4, height: 8, into: true });   // a point between them, a 3.4 m tall frame
  S.sfx('swish', tThrow); S.sfx('pop', tCatch, { gain: -2 });
  return { rex, you, ball };
} });
```

### 12.5 A counter landing on the spoken number

```js
// ---- 5: the meter rolls all the way to ninety ----
shot({ say: 'The meter rolls', build(S) {
  S.room({ w: 6, d: 5, h: 3, wall: '#5f7f7a', floorKind: 'tiles', floor: '#cfd6d2' });   // back wall at z = -3
  S.light('interior');
  const meter = S.info('led', { at: [-.05, -2.99], mount: 'wall', height: 1.75, from: 0, to: 90,
    t0: S.at('rolls'), t1: S.at('ninety'), suf: ' L', header: 'TAP METER', sfx: true });   // shows 90 exactly from "ninety"
  S.prop('bathroom_sink', { at: [.9, -2.75] });
  S.prop('mirror', { at: [.9, -2.99] });
  S.prop('towel', { at: [1.75, -2.99] });
  S.prop('bucket', { at: [-1.4, -2.6], water: true });
  S.prop('toilet_paper', { at: [-1.9, -2.7] });
  S.prop('towel_stack', { at: [-2.3, -2.6], count: 4 });
  const you = S.char('main', { at: [.75, -1.7], ry: -.35, face: 'skeptical' });   // faces the camera; only the eyes go to the meter
  you.look(meter, S.at('rolls') - 2 * F);
  you.gesture('present', S.at('way'));                                       // the RIGHT hand: on screen left, toward the meter
  you.face('shocked', S.at('ninety'));
  S.camera('push', { on: you, from: 'mws', to: 'ms', side: 10, offset: [-.4, .15, 0], into: true });   // offset: the meter shares the frame
  S.sfx('tick', S.at('rolls'), { dur: S.at('ninety') - S.at('rolls'), gain: -4 });
  return { you, meter };
} });
```

### 12.6 The reveal pull-out

```js
// ---- 6: but the whole kitchen is on an island ----
shot({ say: 'But the whole kitchen', build(S) {
  S.sky('day'); S.light('day', { shadowSize: 14 }); S.fog('#cfe8f6', 40, 160);
  S.fx('water', { size: [220, 220] });
  S.floor({ r: 9, kind: 'sand', y: .02 });
  S.prop('kitchen_counter', { at: [-1.4, -1.2], w: 1.8 });
  S.prop('fridge', { at: [.4, -1.15] });
  S.prop('stove', { at: [-.25, -1.2] });
  S.prop('dining_table', { at: [-.4, .4], w: 1.3 });
  for (const [x, z, s] of [[-5.5, -3, 1], [5.2, -2.2, 3], [3.6, 4.4, 5], [-4.2, 4.8, 7]]) S.prop('palm', { at: [x, z], seed: s, ry: s });
  S.prop('beach-umbrella', { at: [4.6, 1.2] }); S.prop('sandcastle', { at: [-2.8, 3.4] });
  S.fx('clouds', { tone: 'day', count: 9 });
  const you = S.char('main', { at: [1.6, .2], ry: -.3, face: 'neutral' });
  you.face('gape', S.at('island'));
  // fast start, long settle; half done ~0.5 s in: start it ~0.55 s before the word that names the place
  S.camera('reveal', { on: you, from: 'cu', to: 'ews', at: S.at('island') - .55, dur: 1.6, end: { height: 30 } });
  return { you };
} });
```

### 12.7 A fly-through into an object, and the shot that comes out of it

```js
// ---- 7: so you fly straight inside the fridge ----
shot({ say: 'So you fly', build(S) {
  const K = kitchen(S, { fridgeOpen: .001 });                                // .001: the inside is built, the door looks shut
  const door = K.fridge.userData.door, c = K.fridge.position;
  const tOpen = S.at('inside') - 12 * F;
  // the door swings open AHEAD of the camera in 6 frames; the camera rushes in (cubic in) and the next shot zooms through
  S.tick(t => { door.rotation.y = -1.85 * E.outCubic(seg(t, tOpen, tOpen + 6 * F)); });
  S.camera('fly', { path: [[-1.2, 1.5, 1.6], [.2, 1.25, -1.2], [c.x, 1.0, c.z + .55]], look: [[-.2, 1.1, -2.4], [c.x, 1.0, c.z]],
    ease: 'inCubic', to: S.t1 + .1 });
  S.sfx('whoosh', S.t1 - .3, { gain: -3 });
  return { fridge: K.fridge };
} });

// ---- 8: the next shot comes in with trans: 'zoom' and its camera already moving ----
shot({ say: 'Inside your head', trans: 'zoom', build(S) { /* 12.8 */ } });
```

The thing passed through is a real object of the scene that opens before the camera reaches it. The outgoing camera
peaks in speed on the cut (`ease: 'inCubic'`, ending just after `S.t1`); the incoming shot decelerates (a `pull` /
`reveal` from a closer framing, or `push` with `at: S.t0 - .1`).

### 12.8 An x-ray / inside view (xrayScan)

```js
// ---- 8: inside your head the alarm goes off ----
shot({ say: 'Inside your head', trans: 'zoom', build(S) {
  S.room({ w: 6, d: 5, h: 2.8, wall: '#56648e', floorKind: 'carpet', floor: '#6a4a5a' });
  S.light('night', { ki: 3.2, hi: 1.2 });                                     // a phone-bright night: blue, but the subject reads (check_layout `dim`)
  S.prop('bed', { at: [0, -2.1] });
  S.prop('side_table', { at: [1.25, -2.6] });
  const nightstand = S.prop('side_table', { at: [-1.25, -2.6] });
  S.prop('desk_lamp', { on: nightstand, at: [-1.25, -2.6], ry: .5 });       // a practical beside the subject lights the face
  S.prop('wall_clock', { at: [0, -2.99], mount: 2.1, time: '3:12' });
  S.prop('window', { at: [1.6, -2.99], view: 'night', mount: 1.1 });
  const you = S.char('main', { at: [.2, -.9], ry: 0, face: 'calm' });
  // what the x-ray shows: a brain with an alarm bell, hung on the head group so it moves with the head
  const brain = new THREE.Group();
  const lobe = new THREE.Mesh(new THREE.SphereGeometry(.15, 32, 24), toonMat('#f29ab0', { rough: .5, emissive: '#f29ab0', ei: .35 }));
  lobe.scale.set(1.15, .9, 1); brain.add(lobe);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(.04, 20, 14), toonMat('#ff3b2f', { emissive: '#ff3b2f', ei: 0 }));
  bell.position.set(.06, .12, .06); brain.add(bell);
  outlineAll(brain, '#2a1d17', .004, 1.2);
  brain.position.set(0, .03, -.02); you.toon.head.add(brain);
  const tScan = S.at('head'), tAlarm = S.at('alarm'), tOff = S.at('off');
  S.fx('xrayScan', { of: you, inside: brain, t: tScan, back: tOff + .35, xOpacity: .35 });   // lighter shell: the inside reads
  S.tick(t => { bell.material.emissiveIntensity = t >= tAlarm - F ? 3 : 0; });             // the bell lights ON its word
  you.jolt(tAlarm + 4 * F, { face: 'shocked', sweat: true });                               // the face shows once the scan is back
  S.grade(t => { const k = seg(t, tAlarm - 2 * F, tAlarm + 2 * F) * (1 - seg(t, tOff + .2, tOff + .4));
    return { tint: [1 + .35 * k, 1 - .25 * k, 1 - .25 * k] }; });                           // a red wash in on "alarm", out after "off"
  S.camera('creep', { on: you, frame: 'mcu', react: [{ at: tAlarm + 6 * F, amt: .12 }] });
  S.sfx('alarm', tAlarm, { dur: .9, gain: -6 });
  return { you, brain };
} });
```

While the scan is on, the subject is a translucent shell: its face is not drawn. Put face beats before the scan or after
it sweeps `back`. Inside objects read best slightly emissive.

### 12.9 A match dissolve between two shots

```js
// ---- 9: your eye looks like a clock ----
shot({ say: 'Your eye looks', build(S) {
  S.room({ w: 6, d: 5, h: 2.8, wall: '#7d8f8a', floorKind: 'wood' }); S.light('interior');
  S.prop('bookshelf', { at: [-1.4, -2.75] }); S.prop('floor_lamp', { at: [1.3, -2.5] }); S.prop('potted_plant', { at: [.4, -2.6] });
  const you = S.char('main', { at: [0, -.6], ry: 0, face: 'thinking' });
  you.look(-.6, .5, S.at('looks'));                                          // pupils up-left
  S.camera('push', { on: you, from: 'mcu', to: 'cu', into: true });          // ends on a big round head, centred
  return { you };
} });

// ---- 10: a clock that never stops ticking ----
shot({ say: 'A clock that', trans: 'match', build(S) {
  S.room({ w: 6, d: 5, h: 3, wall: '#c9b48a', wallKind: 'wallpaper', floorKind: 'wood' });   // back wall at z = -3
  S.light('interior');
  const clock = S.prop('wall_clock', { at: [0, -2.97], mount: 1.6, r: .2 });
  const cab = S.prop('cabinet', { at: [0, -2.7] }); S.prop('vase_flowers', { on: cab, at: [.3, -2.7] });
  S.prop('picture_frame', { at: [-1.1, -2.99], art: 'portrait' }); S.prop('picture_frame', { at: [1.1, -2.99], art: 'sunset' });
  const hands = clock.userData.hands;
  S.tick(t => { hands.minute.rotation.z = -Math.floor(t * 2) * .1; });      // the hand ticks twice a second
  S.camera('creep', { on: clock, frame: .8, place: [0, .25] });              // the clock lands where the head was, at its size
  S.sfx('tick', S.at('ticking'), { dur: .6, gain: -8 });
  return { clock };
} });
```

Check a match with render_frames at the new shot's `t0` (the middle of the dissolve) and adjust `frame` / `place` until
the two round shapes sit on each other.

### 12.10 A crowd with a cascade

```js
// ---- 11: and the whole town lines up to watch ----
shot({ say: 'And the whole town', build(S) {
  S.floor({ kind: 'asphalt', size: [60, 60] }); S.sky('day'); S.light('day', { shadowSize: 10 });
  S.prop('road', { at: [0, 2.5], length: 30 });
  S.prop('shop', { at: [-3.2, -5], text: 'BUNS & CO', color: '#e9c46a' }); S.prop('shop', { at: [2.4, -5], text: 'FIX-IT', color: '#9fc4b8', seed: 2 });
  S.prop('street-lamp', { at: [-.5, -2.8] }); S.prop('bus-stop', { at: [5.6, -2.6] }); S.prop('hydrant', { at: [1.2, -2.4] });
  S.info('sign', { at: [-5.2, -2.2], text: 'LINE\nSTARTS\nHERE', style: 'wood', arrow: 'right', mount: 'posts', height: 1.1 });
  const ids = ['juno', 'dex', 'otis', 'rose', 'walt', 'priya', 'sam', 'lola', 'viktor', 'mei', 'hugo', 'ada'];
  const line = ids.map((id, i) => S.char(id, { at: [-3.2 + i * .62, -1.3 - (i % 2) * .12], ry: -.25, face: i === 7 ? 'bored' : 'neutral' }));
  const you = S.char('main', { at: [.9, .3], ry: -.5, face: 'smug' });
  const tWatch = S.at('watch');
  line.forEach((a, i) => { if (i !== 7) a.headTo(you, tWatch - 6 * F + i * 3 * F).face('happy', tWatch - 2 * F + i * 3 * F); });   // 3 frames apart; one never turns
  you.gesture('wave', S.at('lines'), { until: tWatch + .6 });
  S.camera('creep', { on: you, frame: 'ws', side: -35, place: [.15, 0], into: true });
  return { you, line };
} });
```

Extras never blink (no `blinks()`), stay calm and still, and never act unless the beat is theirs.

### 12.11 The loop back to the opening

```js
// ---- 12: then it all starts again ----
loopShot({ say: 'Then it all starts' });          // replays shot 1's set and camera, ending on its first frame
```

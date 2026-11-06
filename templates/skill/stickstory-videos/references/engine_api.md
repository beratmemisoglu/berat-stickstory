# Engine API (templates/stickstory/engine.js, ENGINE_VERSION 3)

Scenes import from `../engine.js` (and this video's own places and helpers from `../models.js`). Every example in this
file is the code of a lab shot that rendered without errors and passed check_layout (experiments/stickstory-style/lab/
skill1, skill2, skill3, 2026-10-23); `§17` lists them. Names to pick from: `catalog.md`. How bodies and the camera move:
`motion.md`. What a picture must show: `storyboard.md`.

## 0. Conventions

- A 2.5D cut-out theatre: every set, person and prop is a flat vector card standing at a depth z, seen by a long-lens
  camera looking toward -z. Units are metres, +y up, the floor is y = 0, **bigger z = nearer the camera**. The people's
  plane is z = 0; the back wall of a room is at z = -3.5; foreground pieces stand at z = +1 .. +3 (they blur).
- A grown-up is 1.70 m to the top of the head; the head is a disc about 0.32 m across (5.35 heads tall).
- Time is ABSOLUTE video time in seconds, never shot-relative. One frame is `1 / 24` s (the references animate on 1s at
  24 fps; the export is 30 fps). Write `const F = 1 / 24` at the top of a scene file.
- Everything is a pure function of time: any frame can be drawn first. Never keep state between frames, never use
  `Math.random()`, `Date.now()` or timers: use `rnd(seed)` (seeded) and absolute times.
- Inside `build(S)`: `S.at('word')` is the time the spoken word starts. Compute cue times once in build, never in update.

## 1. A scene file and `shot()`

```js
import { shot } from '../engine.js';
// import { abesShop } from '../models.js';      // this video's own places (§15)
const F = 1 / 24;

// ---- 12: Mum comes home ----
shot({ say: 'Mum is home', build(S) {
  const P = S.place('kitchen', { mood: 'day' });
  const you = S.char('main', { sit: 'chair1' });
  const pip = S.char('pip', { sit: 'chair2', face: 'happy' });
  const mum = S.char('nora', { at: 'door', face: 'tired' });
  mum.walk('center', S.at('home'), { style: 'tired' });
  you.look(mum, S.at('home'));
  S.label('7:02 A.M. · HOME');
  S.camera('static', P.cam.full);
  S.sfx('door', S.at('Mum'));
  return { you, pip, mum };                       // named things: the editor can click them, crew agents can find them
} });
```

- One shot per clause (storyboard.md). One file per chapter / crew part, `// ---- N: title ----` right above each
  `shot(`, files listed in project.json `"scenes"` IN NARRATION ORDER.
- `shot(def)` fields:

| field | meaning |
|---|---|
| `say` | the first 2-4 words of the clause as spoken. The cut lands **2 frames before** the first word. Searched in order AFTER the previous shot's words (the files load in `"scenes"` order). A miss prints `say miss` and the shot lands 2 s after the previous one. |
| `t0` (or `at`) | an exact start time instead of `say` (a phrase that repeats in the narration; a wordless beat that starts in a pause) |
| `build(S)` | builds the shot once (place, people + their whole timeline, props, graphics, camera, sfx); returns `st` |
| `update(st, t, S)` | optional, every frame: animate what build made (pure in t). `S.tick(fn)` does the same from inside build. |
| `trans`, `transDur` | how this shot comes IN (§4); `transDur` in seconds overrides the length |
| `cam`, `on`, `frame` | the camera when build never calls `S.camera` (`cam: 'auto'` / a kind name / `{ kind, ... }`) |
| `scope: true` | the letterbox narrows to 2.33:1 for this shot (a run of scope shots stays narrow; bars ease in 4 frames, out 5) |
| `hud: false` | hide the persistent HUD (models.js `UI.hud`) on this shot (a title, an end card, a full-frame graphic) |
| `grade` | a fixed grade object (§12); animated grades: `S.grade(t => ({...}))` |
| `dof: false` | no depth of field (graphics boards have none anyway) |
| `letterbox: false` | no bars on this shot (never: every reference frame is letterboxed) |
| `captions: false` | no burned captions during the shot (captions are off by default in this style) |
| `dark: true` / `plain: true` | a deliberate dark / one-colour frame: check_layout skips `dark` / `empty` |
| `name` | a title when there is no `// ----` comment |

## 2. Cues

- `S.at('word')` = the start of the word nearest the shot's `say` (prefix match: `'run'` finds `'running'`; several words
  `S.at('half an hour')` match in a row). Options: `{ after: s }` (search from `say + s`, for a repeated word),
  `{ near: t }` (search near an absolute time), `{ which: 'e' }` (the END of the word).
- A word not found within 20 s prints `cue miss` (check_preview) and returns the search time.
- Outside a shot (module level): `import { cue } from '../engine.js'; cue('word', nearTime, 's' | 'e')`.
- Actor methods take a time as a number, a word string (`a.wave('hello')` = `a.wave(S.at('hello'))`) or `{ word, near,
  after }`. Overlays and info graphics take `at: number | 'word'` or `word: 'word'`. **Effects (`S.fx`, `S.impact`,
  `S.freeze`, `S.skill`) take numbers only**: write `S.at('word')`.

## 3. Shot length and where the cut lands

The engine makes every shot last until the next shot's `t0`. The cut sits 2 frames before the `say` words (inside the
references' 0-12 frame lead; storyboard.md §3). Wordless beats (`(beat Ns)` lines in the script) have no words: give
their shots `t0` = a time inside the silence (the narration tool shows it: the previous word's end + ~0.25 s, then every
1.7-3.4 s inside the beat).

## 4. Transitions (`trans` of the shot that comes IN)

| trans | frames | what it is | use it for (the references: 93 % hard cuts) |
|---|---|---|---|
| `cut` (default) | 0 | hard cut | every clause, almost always |
| `dissolve` | 12 | linear crossfade centred on the cut | a time or place jump, a re-angle on the same moment (3-6 a video) |
| `quick` | 4 | short crossfade | a run of rapid inserts |
| `flash` | - | hard cut that lands ~1.9x bright and decays in ~10 frames | a realisation, an impact, a reset |
| `whiteout` | - | the OUTGOING shot ramps to white over 10 frames, 2 white, cut, 11-frame decay | a life reset, a big time jump (after `S.fx('reset')`) |
| `black` | 16 | through black | an act break; into the end card |
| `match` | 12 | a dissolve; YOU line the shapes up | rare |
| `whip`, `whip-left/right/up/down`, `zoom`, `push` | 10 / 9 / 10 | slides and zooms | NOT in the references: don't |

Split screens are a shot of their own (`S.split`, §10).

## 5. Places

```js
const P = S.place('kitchen', { mood: 'night' });   // -> { spots, cam, doors, bounds, rim, rimDir, bg, shadows, group, family, mood }
S.camera('static', P.cam.wide);                   // the references' whole-room wide
```

- `S.place(name, o)` builds a whole dressed set into the shot (44 places: catalog.md §1 with their options, spots and
  camera hints). Outdoors, pick a place whose horizon (sky + a far layer) shows at the framing you use: a sports ground at
  eye level is `field` (`S.place('field', { mood: 'night', view: 'goal' })`), never `stadium` (a high-angle card: a medium
  in front of it is a flat green wall - video 02). Every place takes `mood` (catalog.md §1: day | dusk | evening | night | candle | alarm | violet | blue |
  memory | dim; each place has its own default), `seed` (another arrangement of the small dressing), `colors: { key:
  '#hex' }` (override a palette key). Friendly names work too (`'living room'`, `'call center'`, `'bus stop'`, `'school'`).
- The place hands its **rim light** colour and direction to every person built after it (`S.rim`, `S.rimDir`) and sets the
  background colour. Props placed later take the set's mood (`S.mood`).
- `P.spots` (also `S.spots`, `S.spot(name)`): named marks `{ x, y, z, kind: 'stand' | 'seat' | 'bed' | 'door' | 'counter'
  | 'table' | 'surface', facing, seatY, topY }`. Use the NAME: `S.char('main', { at: 'door' })`, `a.walk('chair1')`,
  `S.prop('mug', { at: 'table' })` (a table / counter spot puts the prop on its top).
- `P.cam.wide` (a whole-room wide: a standing figure's feet at ~82 % of the frame, the floor line ~73 %), `P.cam.full`
  (wider, establishing: shows a room's table and side furniture), plus a place's own (`P.cam.table`, `P.cam.bed`,
  `P.cam.desk`, `P.cam.board` ...: catalog.md §1). Stage places (the storybook family) also have `P.cam.close`. Each is a
  camera spec `{ on: [x, y, z], frame: { h } }`: `S.camera('static', P.cam.table)`, `S.camera('auto', P.cam.wide)`.
- `P.doors.door.open(t, dur)` / `.close(t)` swings a door leaf (rooms with doors: catalog.md §1).
- Two families: **room** (frontal box rooms, ceiling band, plank floor, muted palettes, no contact shadows; exteriors
  return `shadows: true` and draw soft shadows under feet) and **stage** (flat side-on rooms, one strong hue, near-black
  furniture, dust motes). style.md §3.
- Plain backgrounds: `S.backdrop('#3a4152')` or `S.backdrop({ like: 'kitchen', mood: 'night', bokeh: true, window: true,
  dark: true })` (a soft wall in a set's colour: close-ups where the set itself is not needed). `S.tabletop('wood' |
  'tiles' | 'desk' | 'sheet' | 'cloth' | 'marble' | 'concrete', { mood, light: 'left' | 'right' | 'top' })` = a top-down
  surface for inserts (spots `center`, `left`, `right`, `top`, `bottom`, `topLeft` ...; frame it with `P.cam.top` /
  `P.cam.close`).
- A place used by several shots or parts with THIS story's changes = a function in models.js (§15).

## 6. People: `S.char(id, o)` -> an Actor

```js
const you = S.char('main', { at: 'door', facing: '3q-right', face: 'tired' });
const pip = S.char('pip', { sit: 'chair2', face: 'happy' });
const mum = S.char('nora', { at: [-.6, .3], facing: 'right' });
```

| id | who |
|---|---|
| `'main'` (= `'hero'`) | "you": the project's main character (settings.characters.main; default the blue-hoodie `you`) |
| a project character | an id in project.json `settings.characters.custom` (a look the user made) |
| a cast id | `'pip'`, `'nora'`, `'hal'`, `'krane'`, ... (catalog.md §2: 32 people + 4 extra tints) |
| `'id@age'` | the same look at another age: `'rae@kid'`, `'you@kid'` (ages adult, teen, kid, small, elder) |
| a look object | `{ base: 'hal', outfit: { color: '#7a4fc0' } }` (a variation), or a whole look `{ name, age, outfit: { top, color, tie, watch ... }, hair, hat, hatColor, glasses, moustache, scarf, clip }` (catalog.md §2) |
| any other name | a stable random look for that name |

Options `o`:

| option | meaning |
|---|---|
| `at` | a spot name, `[x, z]` or `[x, y, z]` (feet on y) |
| `facing` | `'right'` `'left'` `'3q-right'` (default) `'3q-left'` `'front'` `'back'` `'3q-back-right'` `'3q-back-left'` |
| `sit` | start SEATED on a seat spot or a seat prop (the references never show a sit-down: cut in seated) |
| `posture` | the seated pose with `sit`: `'upright'` (default) `'slumped'` `'leanTable'` `'headInHands'` `'typing'` `'eating'` `'phoneLap'` |
| `feet` | where a sitter's feet go: `'auto'` (default: flat on the floor; on a stool's rung when the seat is too high for flat feet; a stool at the right height tucks the far foot back) `'floor'` `'rung'` `'tuck'` `'dangle'` (§6.3) |
| `cast`, `sling` | `cast: 'L'` / `'R'`: a white plaster cast on that forearm in every framing (close-ups and that side's hand inserts too); `sling: true`: the cast arm rests in a sling across the chest all shot, holds and gestures use the other hand (§6.8) |
| `lie` | start lying on a bed spot / bed prop (`{ head: 'right' }` / `prone` options go in `o`) |
| `pose` | a held pose from the first frame (catalog.md §3) |
| `face` | the starting expression (default `'neutral'`) |
| `idle` | `'still'` (frozen + blinks, the most common), `'sway'` (60-80 f, 1-2 % of the height), `'breathe'` (close-ups); default: a seeded pick (35 % sway); extras default `'still'` |
| `free: true` | keeps moving while `S.freeze` holds the world |
| `scale` | size (1 = as drawn; a perspective walk toward the camera is a walk in z, not a scale) |
| `rim` | the rim light: a colour, `null` (none) or `{ color, dir: [x, y] }` (default: the place's) |
| `headScale` | the head size (default 1.3 in close-ups `ecu cu mcu`, 1 otherwise: the references' close-up head) |
| `extra: true` | a faceless background silhouette |
| `name`, `seed` | the name in the editor / the seed of its idle and blinks |

### 6.1 How an Actor's timeline works

- Every call SCHEDULES something at an absolute time; nothing happens "now". Calls chain and return the actor.
- `at` omitted = right after this actor's previous BODY action (walk, sit, gesture ...): `you.walk('door').wave()` waves
  when the walk ends. `a.wait(.5)` moves that cursor, `a.then(t)` sets it.
- Arm actions are layers applied in time order: **the later-starting one wins**. A hold that starts at the shot start
  and a sip that starts BEFORE it shows no sip (PITFALLS). Start every action at or after `S.t0`.
- Times inside a shot that fall before `S.t0` or after `S.t1` are simply off screen.

### 6.2 Moving

```js
you.walk('door', S.at('walk') - 6 * F, { style: 'brisk' });     // planted feet, ease in 5-6 f, stop with a dip
S.camera('truck', { on: you, frame: 'ls' });                     // the camera keeps the walker centred
```

| call | what |
|---|---|
| `a.walk(to, at, { style, until, speed, face, stop, tempo })` | walk to a spot / `[x, z]` / an actor (stops `stop` m short, default 2.4 heads) / a prop. `style` = catalog.md §4 (`normal` default, `kid` for children). `until` = arrive at that time; `speed` m/s; `face` = the view at the end. Walking in depth (mostly z) turns the body front / back. |
| `a.run(to, at, o)` | the run gait (`kidRun` for children) |
| `a.step(dx | spot, at)` | a small reposition, keeps the view |
| `a.enter('door' | 'left' | 'right', { to, at, from })` | hidden until `at`, then walks in from the door spot / from off screen to `to` |
| `a.exit('door' | 'left' | 'right', { at, dist })` | walks out (through a door: hidden there) |
| `a.turn(view | actor | [x, z], at, { via: '3q' })` | a ONE-FRAME view swap (the references' turn); `via` adds a 2-frame 3/4 between |
| `a.faceEachOther(b, at)` | both turn to face each other |
| `a.jump(at, { to, height })` | 5 f crouch, arc, land 2 f, recover |
| `a.fall(at, { dir: 'back' | 'forward' })` | topples in ~9 f, small bounce, lies |
| `a.at(t)` | `{ x, z }` where it is at t |
| `a.hide(at)` / `a.show(at)` | visibility |

### 6.3 Postures

| call | what (frames at 24 fps) |
|---|---|
| `a.sit(seat, at, { posture, instant, flop })` | walks to the seat if needed, sits (12 f). On screen sit-downs are NOT in the references: prefer `S.char(..., { sit })`. EXCEPT when the clause IS the sitting ("she drops onto the sofa", "he collapses into the chair"): `a.sit('sofa2', S.at('drops') - 2 * F, { flop: true })` = a 6-frame accelerating drop + a bounce, slumped, from where they stand (in front of the seat; a front sofa stays a front view) |
| `a.stand(at)` | the measured 11-frame rise from a seat; from kneel / floor a 10-frame tween |
| stools | a `stool` has no back: the sitter's own `facing` wins (even over a spot that names one), it leans forward a little, and its feet go where a person's would: on a stool too high for flat feet (kitchen / lab .62, bar .76 against a grown-up's .456) both feet on the rung; on a `low` stool (.45) the near foot on the floor, the far one tucked onto the rung. `feet: 'floor' \| 'rung' \| 'tuck' \| 'dangle'` overrides (`S.char` and `a.sit`). Video 02's Grandpa read "perched" on the clock-shop stool: legs straight down from the seat's front edge, an upright trunk, an empty lap |
| `a.kneel(at, { one, low, slow })` | 8 f (`slow`: the 30-frame emotional kneel); `one: true` = on one knee; `low: true` = sitting back on the heels (to hug a small child) |
| `a.crouch(at)` | quick drop, 5 f |
| `a.floor(at)` / `a.slideDown(at)` | slide down a wall to sit on the floor, knees up, 22 f |
| `a.bend(at, { angle })` | bend over (70 deg), 14 f |
| `a.lieDown(bed, at)` / `a.getUp(at, { sit })` | lie back over 18 f / sit up 16 f then stand 11 f |
| `a.idleAs('still' | 'sway' | 'breathe', at)` | change the idle |

### 6.4 Arms: poses and gestures

```js
you.pose('leanTable', S.at('lean') - 4 * F).face('smile', S.at('smile'));    // a seated pose, the face on the word
mum.gesture('point', S.at('there') - 3 * F, { hold: 1.2 });
you.cheer(S.at('cheers') - 2 * F);
```

- `a.gesture(name, at, { until, hold (seconds), side: 'L' | 'R', face })`: a pose reached and left with the measured
  timing (in 2-10 f, hold, out 3-8 f; catalog.md §3). Shortcuts: `a.wave / shrug / cheer / celebrate / clap / facepalm /
  thinking / crossArms / handsOnHips / handsOnHead / fistPump / cower / fidget / laugh / explain (at, o)`.
  `a.gesture('headScratch')`, `a.gesture('talk')` (= `explain`: talking hand beats).
- `a.pose(name, at, { until, in, out, instant, side })`: hold a named pose until `until` (or the end of the shot).
- `a.point(target, at, { hold, until, side })`: arm straight at an actor / spot / prop / `[x, y, z]`, 5 f accelerating
  in, hard stop. `a.reach(target, at)`: reach toward it, stopping 0.3 heads short (no contact).
  `a.press(target, at, { frames })`: the hand touches it exactly (a button, a screen, a bell).
- Land the gesture 2-5 frames BEFORE the stressed word (`S.at('word') - 3 * F`); the face swaps ON the word.
- A gesture (or pose, hug, point ...) whose release would START in the last 6 frames of the shot is held through the cut
  by the engine (video 01: a cheer's arms swept down through a T-pose 4 frames before the cut). Release it earlier (at
  least 7 frames before `S.t1`) or let it run to the cut; a clip with `toCut: false` keeps its late release.

### 6.5 Head and face

| call | what |
|---|---|
| `a.face(expr, at, { blend })` | change the expression at `at`: inside a shot a 3-frame crossfade of the parts that change (default), at the shot's start instant; `blend: 0` = a hard swap, `blend: 3-8` frames = the slow mood shift. `tired` (purple under-eye arcs) is rare in the references (~5 in 29 min): only for real exhaustion, never as a default face. `expr`: catalog.md §5, or a custom `{ eyes, brows, mouth, extras, look: [x, y], mouthX, mouthRot, eyeColor: 'worried' }` from the parts list |
| `a.look(target | 'camera' | 'down' | 'up' | [eyeX, eyeY], at, { until, frames })` | eyes + a small head turn in 3-5 f |
| `a.nod(at, { n })` / `a.headShake(at, { n })` | yes (8 f each) / no (6 f swings) |
| `a.tilt(deg, at, { until })` / `a.nudge(at)` | a head tilt held / the 3-frame close-up head nudge |
| `a.doubleTake(target, at)` | glance, away, snap back with `shock` |
| `a.talk(t0, t1)` | lip-sync (the O ring, one peak per syllable) from t0 to t1 |
| `a.say('Do the magic', { from })` | lip-sync a character's own line: finds each word in the narration (for `[Name]` lines) |
| `a.sob('cry', 'sad', t0, t1)` | the emotional-silence toggle between two faces (holds 16, 12, 10, 4 f) |
| `a.blink(at)` / `a.blinks(false)` | an extra blink / no automatic blinks (they come every 3.5-4 s, 3 frames closed, never on a face change) |

**Only in-story dialogue moves a mouth.** The narrator ("you" told by the narrator) never lip-syncs: the hero's mouth
moves only on `[You]` lines.

### 6.6 Holding things

```js
mum.hold('mug', { at: S.t0, props: { steam: true } }).give(you, S.at('coffee'));   // the prop jumps hands in 2 f
you.hold('mug').sip(Math.max(S.t0 + F, S.at('sip') - 9 * F));                     // at the mouth on "sip"
you.phone(S.t0, null).face('worried', S.at('rings'));                             // looking at a phone
```

| call | what |
|---|---|
| `a.hold(prop, at, { hand: 'R' | 'L' | 'both', grip, until, props: {...} })` | `prop` = a prop name (made for you, `props` = its options) or a prop object. The grip comes from the prop's kind (catalog.md §6: phone-look, mug, glass, book, sheet, box, gift, bag, jar, marker, pen, tool, rifle, food, sign ...); `grip: 'phone-ear'`, `'phone-show'`, `'phone-text'`, `'sip'`, `'hang'` choose another. The prop is rigid in the hand (0 px drift). |
| `a.sip(at, { hold, face })` | the held mug / cup / glass to the mouth: up 9 f, `hold` 20 f, down 4 f; eyes ^ ^ |
| `a.drop(at)` | the held prop falls (constant acceleration, slight spin) and stays |
| `a.put(obj | null, surface, at)` | reach 6 f, let go on a table / counter spot or a prop's top, back 5 f |
| `a.pick(obj, at, { hand })` | reach a prop where it is, take it, hold it |
| `a.give(obj?, other, at, { hand, until })` | both reach, the prop jumps hands in 2 frames at `at`, receiver over prop over giver; the giver steps closer if needed |
| `a.phone(at, until, { ear, prop })` | look at a phone (or `ear: true`: at the ear with the 21-frame head nod loop) |
| `a.read(at, until)` / `a.write(at, until, { board })` / `a.type(at, until)` / `a.eat(at, until, { every })` | book at the face / pen on a desk or marker on a board / seated typing bursts / fork to the mouth every 2 s |

Phone and screen pictures: `a.hold('phone', { props: { screen: { ui: 'call', name: 'MUM' } } })` (screen UIs:
catalog.md §6). A phone FULL SCREEN is `S.info('phone', ...)` (§10).

### 6.7 Two people (contact is exact; layering is handled)

```js
you.hug(mum, S.at('hug'), { until: S.t1 - .2, face: 'teary' });   // walks in, wraps in 5 f, leans in 16 f, holds
you.shake(hal, S.at('shake')).face('smile', S.at('shake'));      // hands meet halfway, 3 pumps of 8 f
```

| call | what |
|---|---|
| `a.hug(b, at, { until, mutual: false, face })` | a steps to b, both hug (the smaller one in front, the hugger's near arm over the back). The two heads stay side by side: each steps aside until they overlap by at most a rim (12 % of a head), measured at the shot's own head size, so wides, mediums and close-ups all show two faces (video 01: a hug close-up was one black blob with four eyes) |
| `a.hug([b, c], at, { until, face })` | a GROUP hug ("Mum hugs you both", a family hug): a turns to the front in the middle, b and c step in on either side, lean in, cheek to cheek; a's arms round both backs, theirs round a's waist; b and c step out until the heads only touch |
| `a.shake(b, at, { pumps, until })` / `a.handshake` | the near hands meet EXACTLY halfway (a wide / medium). Its CLOSE-UP is one call: `S.handshake(a, b, { pump })` (§13) |
| `a.highFive(b, at)` | both hands up, contact 2 f |
| `a.holdHands(b, at, { until })` | side by side, same facing. Its CLOSE-UP is one call: `S.handhold(a, b, { at })`; a fist bump / pinky promise close-up: `S.fistBump` / `S.pinkyPromise` (§13) |
| `a.handOnShoulder(b, at, { until })` | from beside / behind |
| `a.push(b, at, { dist })` | b staggers back 0.3 m |
| `a.catch(b, at, { until })` | b tips back, a's arms take the upper back; a steps back as needed so b's head lands beside a's, not in it |
| `a.carry(b, at, { until, to, sit, style })` | a walks up to b and lifts them in 8 f. An adult (b taller than ~70 % of a) goes over a's shoulder (`style: 'shoulder'`: a fireman's carry, legs hanging in front, torso down a's back, drawn behind a); a child in a's arms at the chest (`style: 'arms'`). `to`: a walks there carrying (arrives at `until`); at `until` b is put down standing beside a, or seated: `sit: 'seat5'` (a seat spot or seat prop) |
| `a.drag(b, to, at, { until, sit })` | a takes b's wrist and walks to `to` (arriving at `until`), leaning forward; b slides behind half-lying, face up, arm raised to a's hand; then b sits on the floor where left (or `sit: seat`) |

Frozen people (S.freeze) carried or dragged by a free hero move with the hero and stay exactly where they are put
(`kit.carry(man, S.at('feet'), { to: 'back', until: S.t1 - .2, sit: 'seat8' })`). Never carry an adult with a hold or a
pose: the old chest carry lifted adults above the carrier's head (video 01).

### 6.8 A plaster cast and a sling (a broken wrist / arm)

```js
const abe = S.char('abe', { sit: 'bench', facing: 'left', cast: 'L', sling: true });   // every shot from the break on
abe.hold('mug', S.at('tea'));                                                           // the free (right) hand takes it
S.hand(null, { who: 'abe', side: 'L', cast: true, sling: true, pose: 'open' });        // the cast hand in an insert
```

The cast is part of the arm (rig.js): it shows in wides, mediums and close-ups, follows every pose, and lying in bed the
cast arm rests on top of the body. With `sling: true` the forearm stays across the chest all shot and every hold or
one-handed gesture without a `side` goes to the other hand. For a whole stretch of the story put the look in models.js
once (`export const ABE_HURT = { base: 'abe', cast: 'L', sling: true }`, `S.char(ABE_HURT, ...)`) and name it in the
storyboard's cast table with its time range. Never lay a white card over an arm from models.js (video 02: it went missing
in close-ups and inserts).

### 6.9 Crowds

```js
S.crowd({ n: 9, x: [-3.2, 3.2], z: [-1.4, -.5], mood: 'cheer', at: 'cheers', look: 'extra-warm' });
```

`S.crowd({ n, x: [x0, x1], z: [z0, z1], mood: 'still' | 'sway' | 'bob' | 'cheer' | 'laugh' | 'clap' | 'walk' | 'run',
facing: 'front' | 'mixed' | ... | actor, at, to, look | looks: [...], faceless: false, scale, vary, seed })` -> Actor[].
Faceless silhouettes by default (`look: 'extra' | 'extra-warm' | 'extra-grey' | 'extra-night'`; `looks: ['bree', 'teo']`
for coloured people). Each gets its own period and phase; group laughs start within 0-1 frame. Leave a gap in `x` where
the hero stands, or put the crowd behind (`z` < the hero's).

## 7. Props

```js
const table = S.prop('table', { at: [0, -.4], variant: 'kitchen' });
S.prop('mug', { on: table, x: .3, steam: true });
S.prop('clock', { at: [-1.6, 2.1, -3.45], time: '7:02' });
S.dress([['plant', { at: [2.2, -3.2] }], ['lamp', { on: table, x: -.5 }]]);
```

- `S.prop(name, o)` (156 props + friendly aliases: catalog.md §6, by tag): `at: [x, z]` (on the floor), `[x, y, z]` (wall
  things hang by their origin: their catalog line says ORIGIN), or a spot name (a table / counter spot puts it on the
  top); `on: prop | 'propName', x | u (0..1 across), dy, dz` = standing on another prop's top; `scale`, `facing: -1`
  (mirror; text stays readable), `mood` (default the set's), `style: 'flat' | 'outline' | 'silhouette'` (stage sets use
  silhouette), `color`, `seed`, `detail: 'high'` (close-ups), `rot`, `lying: true` + every option in its catalog line.
- `S.dress([[name, o], ...])` places several. World values of a placed prop: `S.topOf(table)` `{ y, x0, x1, z }`,
  `S.seatOf(chair)`, `S.lieOf(bed)`, `S.gripOf(prop, 'hand')` (Vector3).
- A seat prop is a seat: `S.char('main', { sit: chair })`. A bed prop is a bed: `{ lie: bed }`.
- Screens on props (`phone`, `tablet`, `laptop`, `monitor`, `tv`): `screen: 'text' | { ui: 'call' | 'chat' | 'bank' |
  'notify' | 'alert' | 'map' | 'lock' | 'home' | 'timer' | 'alarm' | 'battery' | 'signal' | 'video' | 'photo' | 'off',
  ... }` (props: catalog.md §6 lines).

## 8. Camera

```js
S.camera('auto', { on: you, frame: 'ms' });          // the default: static for close-ups, the 3 % nudge for wider shots
S.camera('static', { on: pip, frame: 'cu' });        // close-ups never move
S.camera('static', { on: [0, 1.15, .3], frame: { h: 2.2 } });   // a two-shot on a point, picture 2.2 m tall
S.camera('truck', { on: you, frame: 'ls' });         // keep a walker centred
```

Framings (`frame`), by the head's size in the 2.0:1 picture (the references' measures; style.md §2):

| frame | picture height | head top at | use |
|---|---|---|---|
| `ecu` | 1.22 heads | 9 % | the eyes, a big emotion |
| `cu` | 2.7 heads (head = 0.37 of the picture) | 26 % | speakers, reactions, feelings |
| `mcu` | 3.6 heads | 28 % | a speaker with a prop at the chest |
| `ms` | 4.76 heads (0.21) | 31 % | one person acting, a two-shot |
| `mls` / `ls` (`full`) | 6.3 / 7.6 heads | 34 / 36 % | a walk, the whole body |
| `ws` / `vws` / `ews` | 10 / 14 / 22 heads | | a room, a street, a skyline |
| `{ h: metres }` | that many metres tall at the subject | | two-shots and things |

The lens follows the framing (a wider field of view on close shots so the room behind stays at its wide-shot size, just
blurred), and close-ups draw the head 1.3x (`headScale`). Background blur grows by itself as the shot gets closer.

Options of every kind: `on` (actor / prop / `[x, y, z]` / spot coords), `frame`, `x` (where the subject sits across the
picture, -.5 .. .5: `x: -.18` = left of centre), `y` (+ = the subject higher), `zoom`, `side`, `height`, `at` (start),
`dur`, `amount`, `ease`.

| kind | what (24 fps) | when |
|---|---|---|
| `auto` (= `creep`) | `static` for `ecu cu mcu` and shots under ~2 s; else `nudge` | the default |
| `static` | parked | close-ups, inserts, ~half of the wides |
| `nudge` | 4 f after the cut, zoom 1.00 -> 1.03 over 40 f, then a full stop (ends 8 f before the cut) | wides / mediums |
| `nudgeOut` | 1.00 -> 0.975 over 16 f | rare |
| `push` / `pull` | from one framing to another `{ from: 'ms', to: 'cu', dur }`; `push` without from/to = +18 % in 3 s | emotion |
| `pushBig` / `threat` | +18 % / +42 % over ~3 s, sine | an emotional hold / a threat reveal |
| `stepPush` | +4.5 % in 34 f at each time of `steps: [t1, t2, ...]` | emotional dialogue, one step per line |
| `punch` | +32 % over 18 f at `at` | a word that hits |
| `crash` | x1.5 in 10 f from `at` | a shock cut |
| `pullReveal` | hold `detail` (or `on`) at `from: 'cu'`, then out to `to: 'ws'` in 11 f | a reveal |
| `pushInto` / `zoomThrough` | into `target` (a window, eye, screen): x4 over 85 f / x2.7 in 10 f ending at the cut | into the next place |
| `truck` | the camera's x locked to the walker (`on`), layers slide by depth | walks |
| `follow` | like truck, lagging behind smoothly (`lag` s) | a slower walk |
| `pan` | `{ from, to, dur: 1.2 }` from one subject / point to another, holds at both ends | |
| `linearPan` | constant drift `speed` (px a frame at 960, 3), `dir` | the timeloop look |
| `tilt` | the frame slides by `amount` pictures over 32 f | a tilt reveal |
| `keys` | `{ keys: [{ t, on, frame, x, y, zoom, ease }] }` | anything else (tours: `S.tour`, §10) |

`'crane'`, `'rack'`, `'whip'` do not exist here: an unknown kind prints a warning and uses `auto`. Never roll, never
shake (an impact is a flash, §11).

**Focus.** The subject is in focus automatically. `S.focus(target, { at, dur, aperture })` moves the focus to another
actor / prop / distance at `at` over `dur` (rack focus: not in the references, keep it rare). `S.dof({ aperture, amount,
on: false })` overrides the blur. Foreground pieces (a blurred head, a table edge) are cards at z +1 .. +3.

## 9. Overlays: labels, pills, counters (2D, crisp, on top of the picture)

All take `at` (a number, or a word string: starts 2 frames before the word), `word`, `until`, and a place `pos: 'top' |
'bottom' | 'center' | [x, y]` (design px of a 1920 x 1080 frame) | an actor (above its head) | a thing | `[x, y, z]`, with
`dx`, `dy`. Without `at` / `word` an element is there from the cut. Exits are hard cuts unless the element fades.

```js
S.label('7:02 A.M. · HOME');                                      // top-left chapter / time label, fades in 4 f
S.label('TWENTY YEARS LATER', { style: 'later' });                // the quiet lower-left "later" caption
S.pill('MUM · CALLING', { word: 'rings', theme: 'danger' });      // statement capsule, 3-frame pop
S.options([{ text: 'STEAL IT BACK', word: 'steal', strike: 'tell' }, { text: 'TELL THE TRUTH', word: 'truth', chosen: 'truth' }], { pos: [1400, 420] });
S.stat('GUARDS', 50, { corner: 'bl', theme: 'danger', word: 'Lives' });
S.checklist([['CHESS', 'Lives'], ['PIANO', 'sixty'], ['12 LANGUAGES', 'four']]);
```

| overlay | call |
|---|---|
| statement pill | `S.pill(text, { theme, word, pos, row, h: 100, small, strike: word, chosen: word, until })`; themes: `fact` (gold, default), `danger`, `success`, `gadget`, `predict`, `neutral`, `chosen` (amber fill), `navy`, `amber`, `money`, `muted`; `row` stacks (pitch 1.35 h) |
| option list | `S.options([{ text, word, strike, chosen, theme, h }], { pos, h: 60 })` |
| chapter / time label | `S.label(text, { sub, corner: 'tl' | 'tr' | 'bl' | 'br', style: 'later', until, fade })` |
| lives counter | `S.counter('LIVES', { value: 64 | { from, to, preset } | [[time, v], ...], big, pos, prefix, suffix })` (bottom-right; a change dips 8 f, swaps, fades back 5 f; `big` = the centred count-up) |
| pro / con icon | `S.plusminus('+' | '-', { born: actor | [x, y], word, fly: word, corner, pop: false })` (= `S.icon`) |
| object tag | `S.tag('MUG · 60.0°C', { pos: thing | [x, y, z], dx, dy: -110, style: 'amber' | 'navy' | theme, word, line: false })` (a prediction tag: `'SOCKS · 99%'`) |
| stat box | `S.stat(label, value | { from, to, preset }, { corner, pos, theme, prefix, suffix, states: [[word, { theme, value, label }]] })` |
| countdown | `S.timer({ from: '31:47:59' | seconds, dir: -1, at, format: 'hms' | 'ms' | 'hm', prefix })` (top-right, ticks every 24 f) |
| countdown ring | `S.ring({ from: 48 })` (counts down one a second from the cut / `at`; `stop: 'hand'` holds it there) or `S.ring({ value: 48 })` (story time: held) or `{ value: [[S.t0, 48], ['seconds', 47]] }`; `max: 60`, `corner: 'tr'`, `warn: 5` (red from there), `big: true` (centred: "the ring big in frame", label 'SECONDS'). A dark disc, a blue arc shrinking with the value, the number in the middle, a pulse on every change. For a budget of seconds (a frozen minute, a bomb, a breath) |
| clock stamp | `S.clock('3:52 P.M.', { style: 'box' | 'mint' | 'pill' })` |
| elapsed tab | `S.elapsed('+1 YEAR', { at, x })` (a torn tab from the top bar) |
| checklist | `S.checklist(['CHESS', ['PIANO', 'piano'], ...])` (top-right, items pop on their words) |
| PSA bar | `S.warning(['A REAL BANK NEVER ASKS YOU TO MOVE MONEY.', 'HANG UP. CALL THE NUMBER ON YOUR CARD.'])` |
| typed text | `S.typed('LEO · 26', { pos, cap: 40, fam: 'sans' | 'mono' | 'hand', color, cursor, cps: 24, align, word })` |
| stamp | `S.stamp(...)` exists but is BANNED (SKILL.md "Banned in every style") |

**One element per corner** (they collide otherwise): top-left = the chapter label OR the `+` icon; top-right = the
checklist OR the countdown (timer / ring) OR the `-` icon; bottom-right = the lives counter OR the clock stamp;
bottom-left = the "later" caption OR a stat box. Pills go top-centre (default) or bottom-centre, never over a face
(check_layout `covered`). Overlays are kept inside the picture (a pill or tag pushed past a letterbox bar is moved back
in); `row` stacks pills DOWN from the top and UP from the bottom.

**One look per running device.** A counter the whole video keeps (the seconds left, the lives, the money) has ONE kind
for the whole video, decided in the storyboard's SHARED decisions and drawn by the HUD in models.js (§9.1) - never a
`S.timer` in one part, a `S.stat` in the next and a home-made ring in a third (video 01: the frozen-minute countdown
changed its look three times between crew parts).

**Counts start at their time.** `{ from, to, word }` STARTS counting on the word (preset `money` 20 f ease-out,
`counter` 37 f, `attempts` 73 f). To LAND on the spoken number, start it its length earlier:
`{ from: 0, to: 70, at: S.at('seventy', { which: 'e' }) - 20 / 24, preset: 'money' }`.

### 9.1 The persistent HUD (the whole video): models.js

```js
// models.js
import { THREE, UI } from './engine.js';
UI.hud([
  { kind: 'counter', label: 'LIVES', value: [[20, 63], ['four', 64]], from: 20, to: 26, near: 22 },
  { kind: 'icon', sign: '+', from: 15.92, to: 19.92 },
]);
```

Kinds: `counter` `{ label, value: n | [[time | word, v], ...] | t => v, corner: 'br', from, to }`, `label` `{ text, sub,
from, to, fade, corner }`, `icon` `{ sign, from, to }`, `checklist` `{ items: [[text, time | word], ...], from, to }`,
`timer` `{ start: '31:47:59', at, dir: -1, from, to }`, `ring` `{ start: 48, at (the time it shows start), stop, value:
[[time, v], ...] (instead of start), max: 60, corner, warn, from, to }`, `clock` `{ text, style, from, to }`. Words
resolve near `near` (default `from`). A shot with `hud: false` hides it. Scene files that need it import `'../models.js'`.

```js
// the frozen minute's ring: real time (one a second) where the action runs, a held value list where the narration thinks
// (ranges never overlap: one ring on screen)
UI.hud([
  { kind: 'ring', start: 48, at: 274.4, from: 274.4, to: 283.3 },                                       // 48, 47, 46 ...
  { kind: 'ring', value: [[283.3, 48], [285.6, 47], [299.6, 42], [301.0, 41]], from: 283.3, to: 305.7 }, // story time
  { kind: 'ring', start: 38, at: 340.9, stop: 376.9, from: 305.7, to: 380.6 },                           // the rescue, held at 1
]);
```

## 10. Full-frame graphics and screens: `S.info(kind, o)`

Three sorts (catalog.md §7 has every kind with its options):
- **boards** (a whole shot's picture, laid out in design px of 1920 x 1080, framed by a static camera unless the shot sets
  one): `number`, `terminal`, `chart`, `worldmap`, `citygrid`, `floorplan`, `building`, `network`, `diagram`, and the
  paper kinds without `pos` (`document`, `note`, `calendar`, `card`, `phone`, `sign`: on a desk / wall / dark backdrop);
- **in the set** (`pos: [x, y, z]`, `width` m, `rot` deg; a hand can hold them): `document`, `note`, `calendar`, `card`,
  `statbox`, `phone`, `sign`;
- **over the shot's picture**: `title`, `news`, `cctv` (+ `endcard`, its own picture).

```js
S.info('number', { value: { from: 0, to: 70, at: S.at('seventy', { which: 'e' }) - 20 / 24, preset: 'money' }, style: 'red', label: 'BEATS A MINUTE' });
S.info('chart', { type: 'bell', labels: [{ value: 100, text: 'MOST PEOPLE', word: 'hundred' }] });
S.info('terminal', { lines: ['NICE WORK, LEO.'] });
S.info('news', { style: 'red', headline: 'CALL-CENTRE GANG ARRESTED', sub: 'THREE HUNDRED REFUNDS', tab: 'BREAKING', word: 'news', tv: true });
S.title(['WHAT IF YOU COULD', 'PAUSE THE WORLD?'], { word: 'pause' });    // over the shot's place
S.endcard({ lines: ['WHAT WOULD YOU DO', 'WITH 60 SECONDS?'], cast: ['main', 'pip', 'nora'] });
```

- Board timing: elements take `at` / `word` like overlays; text fades in 4-5 f, lines draw on in 8-12 f, counters count.
- `S.tour(board, [{ at, x, y, h, ease }, ...])`: a camera tour over a board (x, y = design px of the board, h = how many
  px tall the view is): `const B = S.info('chart', {...}); S.tour(B, [{ at: S.t0, x: 960, y: 540, h: 1080 }, { at:
  S.at('rare'), x: 1500, y: 600, h: 500 }])`. A `number` board pushes in slowly by itself (`push: false` to stop it).
- `S.split(left, right, { at: .46, slide: { word, keep: 'right' | 'left', frames: 8 } })`: two panels with a torn divider,
  each `(S2) => { ...build a little scene...; return { kind: 'static', on, frame } }`. Stand the two panels' people at
  different `x` (check_layout sees them in one scene). Corner icons: `S.plusminus('+')`, `S.plusminus('-')`.

```js
S.split(S2 => { S2.place('kitchen', { mood: 'day' }); const a = S2.char('main', { at: [0, 0], facing: '3q-right', face: 'happy' }); return { kind: 'static', on: a, frame: 'ms' }; },
        S2 => { S2.place('office', { mood: 'night' }); const b = S2.char('main', { at: [1.6, 0], facing: '3q-left', face: 'tired' }); return { kind: 'static', on: b, frame: 'ms' }; });
```

## 11. Effects: `S.fx(kind, o)`

```js
S.freeze({ at: S.at('stopped'), from: you });            // the world stops; S.char(..., { free: true }) keeps moving
S.impact(S.at('breaks'), [.8, 1.6, -2.9], { burst: 'shards' });
S.skill(ivy, you, { at: S.at('hand') });                  // the skill flows through a handshake
S.fx('confetti', { at: S.at('cheers') });
S.fx('ripple', { at: tf, from: [0, 1.1, .55] });
```

- 32 kinds (catalog.md §8): fields (`dust rain drops snow confetti bokeh streaks speedLines shower camFlashes bubbles
  water`), bursts (`impact sparks shards crack zap electric fireworks smoke steam ripple glint sparkles aura`), light
  (`lightShaft flicker siren screenGlow reset`), story (`freeze skill`).
- Common options: `at`, `until` | `dur` (NUMBERS: `S.at('word')`), `area: [x0, y0, x1, y1]` | `around: obj` (a field
  inside a window / a cone), `from` / `to` (a point `[x, y, z]`, an actor (its chest; `{ actor, part: 'head' | 'hand' |
  'chest', side }`), an object, or `t => [x, y, z]`), `z`, `density`, `color`, `seed`. Defaults: from the shot start to
  its end. Fields fill the view at 3 depths and stay put when the camera moves.
- `S.impact(at, where, { burst: 'sparks' | 'shards' | 'dust', flash: .32 | false })`: a 3-frame white lift + a white-hot
  disc, rays, a ring. `S.freeze({ at, until, from, ring, restart, keep })` returns `fz` with `fz.frozen(t)`, `fz.time(t)`
  (the world clock: holds while frozen: drive your own frozen things with it). `S.skill(A, B, { at, dur: 1.2 })`.
- **Who is inside the frozen minute keeps FULL colour**: every `S.char(..., { free: true })` (and what they hold) and every
  hand insert (`S.hand`, or any object with `userData.kind = 'hand'`) stays in its real colours while the world greys -
  the hero, then the sister who held his hand, the grey-coat man who is not frozen. `keep: [actors / objects]` names them
  yourself, `keep: false` greys everything. So a character who joins the minute must be `free: true` in EVERY shot of it.
- Restraint: no glitch, no RGB split, no lens flare, no camera shake (style.md §6).

## 12. Grade, flashes, scope bars

- `S.grade({ sat, bright, contrast, grey, tint: [r, g, b], lift: [r, g, b], vignette, fade, bloom, threshold })` or
  `S.grade(t => ({ ... }))`; `shot({ grade: {...} })`. The flashback / memory look is the place mood `'memory'`, not a
  grade.
- `S.flash(at, dur = 10 / 24)`: the picture lifts ~1.9x and decays (an impact, a realisation) without a cut.
- `S.scope(from, until)` inside a shot, or `shot({ scope: true })`: the 2.33:1 bars for an action / "the genius sees it"
  stretch (budget 0-12 stretches of 1-7 s a video).

## 13. Hand inserts (32 % of the references' shots are inserts)

**ONE call: `S.hand(prop | null, o)`** builds the whole insert (the glove hand in the character's sleeve, the prop in the
hand or on a surface, the blurred backdrop or a top-down tabletop, the framing at the references' size, the 4-frame
ease-out entry / 10-frame exit) and returns `{ hand, prop, frameH, rest }`. Use it for every insert (video 01's builders
wrote their own from the low-level card below: the hands came out at ~25 % of the picture, the references' at ~55-60 %,
with sleeves running across the whole frame).

```js
shot({ say: 'You close your', build(S) {                      // the "close your fist" insert: the hand ~57 % of the picture
  S.hand(null, { pose: 'flat', backdrop: 'busstop', mood: 'night', close: 'fist' });
  S.freeze({ at: S.at('fist') });                            // the hand insert keeps its colour in the frozen minute
} });
shot({ say: 'Then you open', build(S) { S.hand(null, { pose: 'fist', open: 'hand' }); } });
shot({ say: 'Mum is calling', build(S) { S.hand('phone', { screen: { ui: 'call', name: 'MUM' } }); } });   // held, street blurred
shot({ say: 'You tap', build(S) { S.hand('phone', { surface: 'wood', from: 'right', screen: { ui: 'bank', amount: '$0.00' } }); } });
shot({ say: 'Her hand', build(S) { S.hand(null, { who: POPPY, pose: 'open', from: 'left', enter: true }); } });   // another's sleeve
```

Options: `pose` (a hand pose, below; default by prop: phone 'hold-phone' / 'point' top-down, mug 'hold-cup', pen 'pen',
tweezers 'pinch'), `side` 'R' | 'L', `who` (whose sleeve: 'main', a cast id, a look), `from` (bottom | bottom-right |
bottom-left | left | right | top | top-right | top-left: where the arm comes from), `enter` (true | an edge: slides in 4
f at `at`), `leave` (a time / word: out in 10 f), `close` / `open` (a word or time: the hand closes to a fist / opens 1
frame before it), `poses: [[word | time, pose], ...]`, `top: true` | `surface: 'wood' | 'desk' | 'tiles' | 'cloth' |
'sheet' | 'marble'` (top-down), `screen` (phone UI), `prop: { ...make options }`, `size` (palm width, .08), `fill` (the
prop's share of the picture height), `x`, `y`, `pos: [dx, dy]` (a second hand, offset in m), `backdrop` (a place name),
`like`, `mood`, `cast: true` (+ `sling: true`: the plaster cast on this arm; a look with `cast` on this side gets it by
itself), `camera: false` (frame it yourself). Two hands meeting are ONE call each (below): never two `S.hand` cards laid
on one spot (video 01: one hand with ~10 fingers, two fists bumping, a pinky promise drawn as two index fingers).

**A handshake close-up is ONE call** (video 02's builders laid a 'flat' and a 'clasp' card over each other: both thumbs
stood up in a V):

```js
shot({ say: 'You shake it', build(S) {
  const h = S.handshake('main', 'hal', { backdrop: 'stage', mood: 'day', pump: 'shake' });   // = S.hand(null, { who: 'main', shake: 'hal', ... })
  S.fx('glint', { at: S.at('shake'), from: h.rest });                                         // (optional) a glint on the clasp
} });
```

`who`'s hand comes from the left (its back to the camera, the fingers curled down over the other hand, the thumb along the
top), the other's from the right (behind it, its thumb across the near knuckles); `from: 'right'` swaps the sides; `pump`
(word / time: 3 pumps of 8 f, `pumps: n`), `at` + `enter: true` (both slide in over 4 f), `leave`, `size`, `frameH`.
Returns `{ near, far, hands, frameH, rest }`.

**Holding hands, a fist bump, a pinky promise: ONE call each**, in the same shape (= `S.handshake(a, b, { kind: 'hold' |
'bump' | 'pinky' })`, or `S.hand(null, { who: a, shake: b, kind })`):

```js
shot({ say: "Poppy's small hand slides into yours", build(S) {
  S.handhold('main', POPPY, { at: 'yours', backdrop: 'street', mood: 'night' });     // hers slides in, your fingers close on "yours"
} });
shot({ say: 'Mum takes your hand', build(S) { S.handhold(MUM, 'main', { squeeze: 'takes' }); } });        // already held, one squeeze
shot({ say: 'Bump it', build(S) { S.fistBump('main', 'hal', { at: 'bump', backdrop: 'field', mood: 'day' }); } });
shot({ say: 'You promise', build(S) { S.pinkyPromise(MUM, POPPY, { at: 'promise', pump: 'swear' }); } });
```

| call | what |
|---|---|
| `S.handhold(a, b, o)` | side by side, both arms from above in a V (`up: true`: both from below - raised joined hands, across a table): a's hand in front, its fingers curled over b's; b's behind, only its thumb over a's knuckles (the handshake's one clasp, no pump). `at`: b's hand slides in (10 f) and a's fingers close round it (4 f) landing on `at`; without `at` they are holding at the cut. `squeeze: word / time` = one 9 f squeeze |
| `S.fistBump(a, b, o)` | two fists from the left and right, thumbs on top, knuckles meeting on `at` (6 f accelerating in, 9 f from off the frame with `enter`), a 3 f recoil and a small white pop (`pop: false`, `popSize`) with a soft pop sound (`sound: false`); without `at` the bump lands 8 f into the shot |
| `S.pinkyPromise(a, b, o)` | two fists from the left and right, the little fingers straight out of the bottom of the fists; on `at` they come together (6 f) and hook: a's curls down over b's, b's up behind a's with its tip showing; without `at` hooked at the cut. `pump: word / time` = shaken twice (8 f each) |

Common options (as `S.handshake`): `at`, `enter: true` (both come in from the frame edges first), `leave` (out in 10 f),
`from: 'right'` (the mirror image: a on the right), `backdrop` / `like` / `mood`, `size` (an adult's palm width, .08: a
child's hand is drawn smaller by its look's age), `frameH`, `x`, `y`, `camera: false`, `rim`, `farTone: false` (b's hand
is drawn in the figures' far-limb tone so two gloves never merge into one black blob), `layout: { a: { ang, x, y }, b:
{...} }` (deg / palm widths from the join: moves one hand). Returns `{ near, far, hands, frameH, rest }`. Who is `a`:
holding hands, `a` is the hand on top (the one that takes the other); for a promise or a bump it is just the left hand.

The low-level card (only when S.hand can't do it):

- `RIG.Hand(look, { pose, side: 'R' | 'L', style: 'glove' (default) | 'flat' (the storybook mitten) | 'light', size,
  sleeve: true | '#hex' | false, sleeveLen (palm widths), watch, rim, light: [x, y] })` -> `h` with `h.root` (wrist at the
  origin, fingers up +y), `h.setPose(name)` (catalog.md §5: flat open fist point press grip pinch pen hold-phone
  phone-pov phone-ear hold-cup sheet clasp dangle cup wave shake shakeWrap holdOpen pinky pinkyHook pinkyHookUp), `h.setAngle(rad)`, `h.hold(obj, { front, at: 'hold' |
  'pinch' | 'palm' | [x, y] })`, `h.grip(name)` (a point in the hand's space).
- The hand is drawn over what it grips; a phone shown to the camera goes in front (`front: true` / pose `hold-phone`).
- On a top-down surface (frame the THING, not the table: `P.cam.top` shows the whole table and a phone is a speck):
  `S.tabletop('wood', { mood: 'night' }); const ph = S.prop('phone', { at: 'center', screen: { ui: 'bank', amount:
  '$0.00' }, detail: 'high' }); S.camera('static', { on: ph, frame: { h: .3 } });`
- Wide and medium shots keep the plain nub hand; the glove is only for inserts and the phone-at-the-ear close-up
  (style.md §5).

## 14. The shape kit (your own cards)

From `../engine.js`: `rrect(w, h, r, color, o)`, `rect`, `ellipse(rx, ry, color, o)`, `circle`, `ring(r0, r1, color)`,
`capsule(len, w, color)`, `poly([[x, y], ...], color)`, `stroke(pts, w, color, { closed })`, `bez(P, n)`, `path('M .. L
.. Q .. C .. Z', color, { scale, svg })`, `gradient(w, h, [[0, '#hex', alpha], [1, '#hex']], { dir: 'v' | 'h' |
'radial' })`, `glow(r, color, { opacity, add })`, `softShadow(rx, ry)`, `text(str, { size, font, weight, color, bg,
border, align })`, `stack(...)` (children stacked front to back by `Z.step` = 1.5 mm), `group(...)`, `recolor(obj, map)`,
`box2(obj)`, `mat(color, o)`. Options of shapes: `{ at: [x, y, z], rot, anchor: 'bottom' | 'center' | 'top-left' ...,
opacity, order, name }`. Shared geometry and materials: never dispose them, never change a shared material's colour
(`mat(color, { unique: true })` for one you animate). Flat fills, a second face at 0.84x, edge lines at 0.77x, tiny
highlights, no black outlines (style.md §4). Add to the shot with `S.add(obj)`; animate with `S.tick(t => ...)` or
`obj.userData.update = (t, S) => ...`.

## 15. models.js: this video's own places and helpers

```js
// models.js
import { THREE, UI } from './engine.js';
export const HERO = 'main';
/** Abe's corner shop: the cafe place made his, with the can pyramid the story knocks over */
export function abesShop(S, o = {}) {
  const P = S.place('cafe', { kind: 'shop', name: "ABE'S", mood: o.mood ?? 'day' });
  const cans = S.prop('box', { at: [1.4, .4], variant: 'crate' });
  return { ...P, spots: P.spots, cans };
}
```

A place used in several shots or parts lives here, ONCE, so every framing shows the same set. Keep `HERO` and the
imports; scene files `import { abesShop } from '../models.js'`.

Your own cards in a place (a facade, a sign, a broken rail) take their colours through `S.tone('#hex')` (graded by the
place's mood exactly like the library's sets; `S.tone('!#ffe2a6')` = as is, for lit things): `G.add(rrect(13, 7.5, 0,
S.tone('#e7ebf2'), { at: [0, 0, -2.9], anchor: 'bottom' }))`. A fixed '#hex' stays day-bright in a night scene (video
01's hospital front at midnight). Animals: `S.prop('dog', { pose: 'jump', frisbee: true })`, `S.prop('bird', { pose:
'fly', at: [x, y, z] })` (catalog.md §6 "animal").

## 16. Sound: `S.sfx(type, t, { gain, pan, dur })`

On a visible event only (sound_design.md): `S.sfx('door', S.at('Mum'))`, `S.sfx('blip', S.at('seventy'))`,
`S.sfx('boom', S.at('pause'))`, `S.sfx('riser', S.at('pause') - 1.4, { dur: 1.4 })`. Types: sound_design.md.

## 17. The examples that ran (lab/skill1-4, 2026-10-23; re-run on the finished libraries: no errors, check_layout clean at every steady frame)

| example | lab file | checked |
|---|---|---|
| kitchen wide, seated starts, walk in, time label (§1) | skill1/scenes/people.js shot 1 | still + layout clean |
| close-up lip-sync on a character line (`say`) | skill1 shot 2 | still |
| seated `leanTable` pose + face on the word | skill1 shot 3 | still |
| hold + give (hand-off) | skill1 shot 4 | still |
| hold + sip | skill1 shot 5 | still (the sip ordering rule) |
| hug | skill1 shot 6 | still |
| brisk walk + truck camera | skill1 shot 7 | still |
| handshake | skill1 shot 8 | still |
| title over a frozen street, crowd, freeze | skill2/scenes/graphics.js shot 1 | still |
| big number landing on its word | skill2 shot 2 | still |
| bell chart | skill2 shot 3 | still |
| phone held + pill | skill2 shot 4 | still + layout clean |
| options over a close-up on a backdrop | skill2 shot 5 | still |
| label + stat + checklist + HUD counter / icon (models.js) | skill2 shot 6 | still |
| terminal, split screen, news on a TV, end card | skill2 shots 7-10 | stills |
| freeze with a free hero, crowd, rain | skill3/scenes/fx.js shot 1 | still |
| hand insert (§13) | skill3 shot 2 | still |
| crack + impact + shards, cower | skill3 shot 3 | still |
| flash cut, dissolve + "later" label, skill handshake, cheering crowd + confetti, scope + seated slump, lying in bed | skill3 shots 4-9 | stills |
| a models.js place (§15) + wave + clock stamp | skill4/scenes/more.js shot 1 (+ skill4/models.js) | still |
| a tag pinned to a prop | skill4 shot 2 | still |
| a phone insert on a tabletop (§13) | skill4 shot 3 | still |
| countdown + elapsed tab + PSA bar, seated on a sofa | skill4 shot 4 | still |
| point gesture + stepPush | skill4 shot 5 | still |
| chart + `S.tour` | skill4 shot 6 | still |
| pullReveal | skill4 shot 7 | still |
| props on props, wall clock, `S.dress` (§7) | skill4 shot 8 | still |
| freeze keeps the free hero / a hand insert in colour (§11) | review1/scenes/r.js shots 1, 14 | stills |
| `S.ring` corner + big, bottom pills stacking up inside the picture (§9) | review1 shots 3, 4 | stills |
| shoulder carry to a spot, drag along the floor (§6.7) | review1 shots 5, 6 | stills + strips |
| group hug (§6.7), front-view bow turning 3/4 (§6.4), phone at the ear from the cut | review1 shots 7, 8, 9 | stills |
| `S.tone` on own cards (§15), dog / bird props | review1 shots 11, 12 | stills |
| `a.sit(.., { flop: true })` (§6.3) | review1 shot 13 | strip |
| the §13 `S.hand` examples (close, open, phone held, tabletop tap, another's sleeve) | review1 shots 14-18 | stills + layout clean |
| the `field` place: side / goal views, day / dusk / night, wide / medium / close-up / full, a bench sitter (§5) | lessons2/scenes/field.js | stills + layout clean |
| stool sitters: low / kitchen / bar, 3/4 / side / front, facing left over a pinned spot, a sit-down onto a kitchen stool (§6.3) | lessons2/scenes/sit.js | stills |
| `cast` + `sling` in every framing, a mug in the free hand, an insert, in bed (§6.8, §13) | lessons2/scenes/cast.js | stills + layout clean |
| the handshake close-up `S.handshake` / `S.hand(null, { shake })` with pump + glint, `from: 'right'`; a models.js look with a cast (§13) | lessons2/scenes/shake.js | stills + layout clean |
| `S.handhold` (a child's hand sliding in on a word, a squeeze, `up`, `from: 'right'`, via `S.hand(null, { shake, kind })`), `S.fistBump` (on a word, `enter`), `S.pinkyPromise` (hook on a word, pump, `from: 'right'`), the unchanged handshake (§13) | handsfix/scenes/hands.js | stills + strips + layout clean |
| hug / group hug / catch at wide, medium and close-up: two heads side by side (§6.7); a cheer / armsUp released 4 / 2 frames before the cut held through it (§6.4) | handsfix/scenes/hug.js, gesture.js | stills + layout clean |

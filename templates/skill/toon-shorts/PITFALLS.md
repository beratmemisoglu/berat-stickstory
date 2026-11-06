# Pitfalls (3D cartoon shorts)

What went wrong while building the engine and its examples, and how it was fixed. One line each:
`- <what you saw>: <why> -> <the fix / the rule>`. This file grows with every real build (battle test first).

## Framing and the 9:16 frame

- A face behind the captions: the caption band is 66-76 % of the height (20-80 % of the width); a creep or push moves a
  head down the frame -> frame the head higher (`place: [0, .15]`), check the shot's LAST frame, never move the captions.
- An empty or void frame: a tall 9:16 frame shows a lot of ceiling, floor and sky; a room seen from too far back or an
  exterior without a far layer shows the background colour -> rooms from `S.room` (they extend past the front), a sky
  dome + a far layer (skyline, trees, sea) outdoors, frame tighter; check_layout `empty` names the band.
- A bare wall behind the hero: the set was dressed on one side and the camera looked at the other -> dress what THIS
  camera sees; aim with absolute `yaw` (e.g. `yaw: 15` = looking at the back wall) instead of `side` for walkers.
- Two characters cut by the frame edges: a 9:16 frame is only ~2 m wide at a two-shot -> stand them within ~1.2 m,
  staggered in depth (one nearer the lens), both turned 3/4 to the camera.
- The back of the head in a close shot: `headTo` a thing behind the character turns the face away (not flagged when
  the camera is farther than ~3 m) -> move the pupils (`look`) and keep the face to the lens, or turn the body.
- Flat props unreadable (rugs, maps, scrolls, papers, a crosswalk, a beach towel lying flat): from a 6° eye-level
  camera they are slivers -> a high camera (`height: 35-60`) or top-down when the flat thing carries the beat.
- Small props invisible (a 13 cm bulb, a 9 cm petri dish, a pill) in a medium or wide shot -> frame them close
  (`on: prop, frame: 'cu'`) or scale them up for the gag (`scale: 3`: the big "idea bulb").
- A face hidden under a hat: low brims and helmets cover the brows and eyes -> `look: { face: { y: -.06 } }` (as Tess
  under her cap) or a higher hat; check it in a close-up still.
- A pan's subject flagged `offscreen` at the end: check_layout follows `on`, not `toward` -> set `S.subject` to the
  one the shot is about, or frame both.
- The hero hidden behind a TV cabinet, and check_layout said Clean: the check has no occlusion test (a prop between the
  lens and the face is never flagged) -> look at the stills; a place cam re-aimed at a character with a tighter frame
  keeps its angle and its foreground pieces (seen with `living-room` `cams.center` + `frame: 'ms'`).

## Props and placement

- A prop's own option named `on`, `at`, `y`, `ry`, `rel`, `shadow`, `scale` or `seed` breaks placement: placement
  reads those names -> never use them for a prop's own settings (your own props too).
- A mug on the table landed at the world origin: `on` sets only the height; `at` is world x, z (default [0, 0]) ->
  give the x, z on the table, or `rel: true` for an offset from the table's centre.
- A fridge or door opened in a tick showed an empty black box: the inside is built only when `open > 0` at build ->
  build with `open: .001` and animate `userData.door.rotation.y`.
- A wall clock half inside the wall: it is centred on z = 0 (other wall pieces have their back at 0) -> wall z + 0.03.
- Shadows stop in a square around the origin outdoors: the key light's shadow box is 12 m wide -> `S.light('day',
  { shadowSize: 14-20 })` for big exteriors.
- A slow preview: trees at full detail (~65k triangles each), dozens of lamps with real lights, rows of big machines ->
  `detail: .3-.5` on far trees, ~6 real lights a shot, one or two big machines.

## Characters and motion

- Standing inside an armchair or sofa before sitting (check_layout `through`): the seat-front spot is 0.24 m in front
  of the seat's centre, inside a 0.86 m deep seat -> `sit(chair, t, { back: .45 })` for armchairs and sofas.
- Sitting where the walk did not end: `sit()` moves the character's home to the seat front -> call `sit()` first, read
  `a.home`, `a.place()` the start, then `walk()` to the home, arriving ≥ 20 frames before the contact.
- A caught ball pinned in mid-air: actors update in creation order and the thrower keeps placing its prop at the
  landing point -> create the thrower (and a giver in a hand-over) BEFORE the catcher (the taker).
- Clothes, shoes or trims in a broken colour: a 3-digit colour (`'#c33'`); `shade()` reads only 6-digit hex -> always
  `'#cc3333'` for looks, props and signs.
- A recast character lost its clothes: `look` overrides replace whole parts (`look: { top: { color } }` drops the
  top's type) -> give the whole part (`top: { type: 'hoodie', color }`).
- Pupils that don't move, lids that don't close, no blinks on `laugh, excited, blissful, scheming, furious, crying,
  pain, effort, asleep, dizzy, dead, love, starstruck`: these sprites have no eye whites (by design) -> use a face with
  eyes for a "looking at" beat.
- Faces of deep-skin characters (lola, sam) read weakly in dim rooms: dark-brown lines on dark skin -> light them well
  when their face carries the beat; `sick`'s pale green lines read only in close shots.
- The mouth can't change apart from the eyes, the eyes don't squash between faces (we use the half-lid frame), skirts
  and coat tails pass through the thighs when seated or crouching, a hat never flies off in a fall -> frame around
  them (no low close-up on a seated skirt).
- No smear on a fast fall or a thrown prop: not automatic -> `S.fx('trail', { of: thing, t0, t1, style: 'ghost' })` or
  `S.fx('speedLines', { of })`.
- The x-ray hid the hero's face: while the scan is on, the subject is a translucent shell -> face beats before the
  scan or after `back`; make inside objects slightly emissive and use `xOpacity: .35` so they read.

## Camera and timing

- A frozen camera in the middle of a shot: `push` is still before its `at` (no creep) -> `move` for a mid-shot push
  (it creeps until `at`), `push` only from the shot start.
- The incoming shot parked during the first half of the dissolve: creep and pushes start at `S.t0` -> start the
  entry move at `S.t0 - .2` when the shot must arrive moving.
- A camera parked before the dissolve -> `into: true` on every shot that leaves through a dissolve.
- The fly-through stopped short of the door: `S.room` clamps the camera inside the room box -> `camInside: false` on
  that shot when the camera must pass a wall.
- The loop shot (fixed in the engine, 2026-10-17): `loopShot` replays the opening on a clock that ends at the opening's
  first frame; its creep now runs backwards INTO the opening's framing and its `S.at()` finds the opening's words. Keep
  the loop clause short and let it end on the opening's composition.
- A shot starting 2 s after the previous one for no reason: its `say` words were not found after the previous shot's
  (a typo, or scene files out of narration order) -> fix the words / the order in project.json `"scenes"`.
- A face swap a beat late: keyed to the word's end or the clause start -> `S.at('word') - 2 * F`.

## From the real builds (battle test, 2026-10-17; experiments/toon-style/ISSUES.md in the Suite's repo)

- A close-up that cuts the brows / eyes at the top of the 9:16 frame (short 01, two shots): the head framed too high ->
  check_layout `cropped` flags it; frame a bit wider or `place: [0, -.1]`. A close-up may cut the skull, never the eyes.
- The hero's face hidden behind a prop (a TV cabinet, a shelf) -> check_layout `hidden`; move the camera or the prop.
- A murky middle of the frame (short 02: a hallway lit only by a glowing cord; a pipe room lit from the edges) ->
  check_layout `dim`; light the subject (a lamp on it, a practical beside it) or frame it against something brighter.
- PROP CHARACTERS (modems, pins, machines with faces) are faces too: keep their eyes out of the caption band (66-76 % of
  the height) and readable. Mark every prop character's face: `obj.userData.face = [x, y, z]` (the face's centre in the
  object's own space) and check_layout's `caption` test covers it like a cast member's face.
- Steam from a pot, smoke from a campfire drifting over a face (short 03, twice): the source sat between the lens and
  the face, and no check sees particles -> put the fire / pot beside or behind the character as the camera sees it, or
  let the plume rise away from the faces; look at the face in the stills.
- A death told by an empty, murky frame (short 03: "die by the creek" as a dark dirt bank, no creek) -> show the place
  the narration names (the water in frame), a clear light for the mood (cold blue for winter), the left-behind objects
  as the subject, quiet and respectful.
- ~80 sound effects a minute (short 01: every action got an sfx) -> 12-20 a minute, only on visible, important events
  (impacts, pops, a whoosh on a whip): the final mix keeps the most important ones and drops the rest anyway.
- A set designed as a 1,000-line hand-built world took 30 minutes while the builders waited -> start every set from
  `S.place(name)` (29 dressed places) and add only this story's props, states and the joke sign.
- A picture plan that asks for a red X, a stamp, a "red warning box" or a plaque -> banned (below): the director turned
  them into in-world things (a breath cloud that pops, a marker highlight on a support page, a newspaper headline).
  A red X drawn IN the world (a marker X on a whiteboard, short 08) counts too: show the limit as part of the thing (the
  fish icons stop at a dashed line, a gauge's needle in its red zone).
- A running counter that contradicts the words (short 08: "past thirty thousand feet" while the depth read 29,584 on
  "feet") -> a counter passes the spoken value ON its word: time it with `S.at('thousand')`, not the shot's end; check
  the frame at that word.
- A number built from 3D digits that never reads whole (short 10: "1178" slid in from the left and the push cut the 1
  and the 8: it read "178") -> on its word every digit is fully in frame; frame the whole number, then push.
- A date shown twice that doesn't match (short 05: the newspaper said Wednesday the 15th, a calendar three shots later
  Tuesday the 14th) -> one date per story, the true one (FACTS), the same on every calendar, paper and sign.
- Faces that don't fit the story's weight (short 05: a rescuer and a stuck man grinning, right before "twenty-one people
  die") -> in a disaster or a death beat: effort, fear, exhaustion, grief; the comedy stays in the objects, never in
  smiles at the victims.
- An everyday object that doesn't read as itself at phone size (short 07: "plastic bags" was a faint see-through shell
  with swirl lines over a canister) -> give it its telltale features: a bag gets a twisted, tied top and crinkles, tape a
  roll and a torn edge, a sock its stripes and heel; check it in a still at the word.
- The clause's object not in the picture (short 08: "tons of iron pellets" showed the hoppers, not one pellet) -> the
  thing the words name is visible on its word (cut the hopper open, a close-up of the pellets trickling).
- Black squares in a frame: a prop with a zero-size or degenerate piece (a lathe with a zero radius at both ends, a
  boolean where a size was expected) -> the engine now repairs zero normals and guards the blurs; still never build
  zero-size geometry or pass booleans as sizes.

## Never (the owner's rules)

- No rubber stamps, red verdict plaques or boxed red words slammed on ('CLOSED', 'DENIED', 'CASE CLOSED' ...): show the
  fact as a real object (a document with a highlight, a sign, a screen).
- No notice that the voice is AI, anywhere.
- No real brands, logos, people, shows or channels: invented names only.
- No HUD panels or 2D boxes over a character shot: facts live in the world (`S.info`); a screen view is its own
  insert shot; at most one `S.label` per short.

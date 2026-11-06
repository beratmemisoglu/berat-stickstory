# Stick stories - pitfalls

What went wrong while building the style, its engine and its examples, and how it was fixed. One line each:
`- <what you saw>: <why> -> <the fix / the rule>`. This file grows with every real build: add your new failures in this
format (sop.md G7).

## Timing and the script

- A voiced 880-word script came out 5:17, not 8:00 (BUILD_LOG 05:15): the references leave 25-40 word-free beats (voice
  only 30-40 % of the time) and ~0.75 s between sentences -> the script carries `(beat Ns)` lines (real silences) and the
  project uses the Natural sentence pause; a builder fills every beat with action / reaction shots (`t0` inside the gap).
- Re-voiced with beats it ran 8:40 (BUILD_LOG 05:50): the Natural pauses added more than estimated -> beats ~1 s shorter;
  an 8-minute script = ~850 words + ~115 s of beats (script.md).
- A shot whose phrase repeats earlier in the narration landed on the wrong occurrence or printed `say miss`: `say` searches
  AFTER the previous shot's words, in project.json "scenes" order -> `t0` for that shot (a crew part: always check
  `list_shots` after check_preview).
- The cut lands 2 frames before the `say` words; the references' sentence-start cuts sit ~6 frames before (inside the
  pause) -> fine as it is; never later than the word, and for a sentence after a long beat give the new shot `t0` a few
  frames earlier if the picture must arrive first.
- A count-up "landed" 0.6 s after its spoken number: `{ from, to, word }` STARTS counting on the word (preset `money` 20
  frames, `counter` 37) -> start it its length before the word's end:
  `{ from: 0, to: 70, at: S.at('seventy', { which: 'e' }) - 20 / 24, preset: 'money' }`.
- `S.fx(...)` / `S.freeze` / `S.impact` with `at: 'word'` broke: effects take numbers only (overlays and info graphics
  take words) -> `at: S.at('word')`.

## People and animation

- The owner (watching video 01): "what are those double lines under the eyes? then next frame it's fixed": a `tired` face
  (raised brows + two purple under-eye arcs) swapped to `bored` one second into the shot and the arcs vanished in one
  frame; `tired` was also the default face of 14 people in that video (the references use it ~5 times in 29 min) ->
  `a.face` crossfades the changing parts over 3 frames inside a shot (engine v3); `tired` only for real exhaustion,
  `neutral` / `bored` as the default face.
- The sip never showed (the mug stayed at the chest): arm actions are layers applied in time order and the LATER-starting
  one wins; the sip started 2 frames before the shot (before the hold that starts at `S.t0`) -> start every action at or
  after `S.t0`: `you.hold('mug').sip(Math.max(S.t0 + F, S.at('sip') - 9 * F))`.
- A sit-down animated on screen looks unlike the references: none of the three references shows a sit-down; every seated
  shot cuts in on someone already seated -> `S.char(id, { sit: 'chair1', posture })`; the same for lying (`{ lie: 'bed' }`).
- A turn animated as a slow spin: the references swap views in ONE frame -> `a.turn('left', at)` (`{ via: '3q' }` for a
  2-frame 3/4 between); never tween a view.
- Everyone moved at once in a group shot: the references freeze the listeners while the speaker gestures, and give each
  person its own idle -> act one person at a time; leave the others `idle: 'still'` (extras are by default).
- In a frozen-world shot the hero froze too: `S.freeze` stops every actor and effect -> `S.char('main', { free: true })`
  for whoever keeps moving (BUILD_LOG 05:55: frozen time first did not stop characters; now it does, so `free` is needed).
- A pose depended on the frame drawn before (stills differed from playback): the Actor once integrated state frame to frame
  (BUILD_LOG 05:55) -> fixed in the engine: every pose is a pure function of t; never keep your own state between frames.
- The narrator's lines moved the hero's mouth: lip-sync is only for in-story dialogue -> `a.say('line')` / `a.talk()` on
  `[Name]` lines only; the narrated "you" keeps a closed mouth and acts with the face.
- Seated people hovered with sloping thighs and `leanTable` read as a big forward hunch with the arms hidden (lab skill1,
  2026-10-23): the rig's hip was too low for 0.45-0.47 m chairs -> fixed in the rig (211abadd: level thighs, vertical
  shins, flat feet); still look at every seated still (the seat's own spot, never a stand spot near a chair).
- Extras stood on top of the hero in a cheering crowd: `S.crowd` spread them over `x` including the hero's x at nearly the
  same depth -> leave a gap in `x` where the hero stands, or put the crowd behind (`z` smaller than the hero's).
- Video 01 (review, 2026-10-23): every adult the hero carried shot up out of the seat to above his head, upright, legs
  dangling over his face (9 shots of the bus rescue): `a.carry` was a child's chest carry -> fixed in the engine: an adult
  goes over the shoulder (a fireman's carry, drawn behind the carrier), a child at the chest; `a.carry(b, at, { to, until,
  sit })` walks up, lifts, carries to `to` and puts them down (seated with `sit`); `a.drag(b, to, at, { until })` drags
  someone along the floor. Frozen people carried by the free hero move with him and stay where they are put.
- "Mum hugs you both" / "a family hug": the hug took one partner, the little sister stood outside it -> `a.hug([b, c], at)`
  is a group hug (the hugger front in the middle, the others cheek to cheek on both sides).
- Poppy's bow floated tilted 35 deg sideways in a front view: a lean is a rotation in the picture plane, so a front view
  shows it as a sideways tip -> fixed in the engine: front views keep only 15 % of a lean, and a pose with a big lean (bow,
  bend) turns the person to 3/4 for its duration. Still: stage bows, bends and laughs in side or 3/4 views.
- "She drops onto the sofa in her coat" showed her standing in front of the sofa, then seated in the next shot: the rule
  "people start seated" is for shots ABOUT sitting, not for a clause whose action IS the sit -> `a.sit(seat, S.at('drops')
  - 2 * F, { flop: true })` (a 6-frame drop + bounce, slumped, straight down from where she stands).
- A child cheering in a 3/4 close-up hid her whole face behind her raised sleeve for the whole line (shot 24): a hoodie /
  jacket sleeve raised in a 3/4 view draws over the head (the bare arm goes behind it: a rig fault, reported) -> until the rig
  is fixed: in 3/4 close-ups give raised-arm gestures (cheer, celebrate, fist, handsOnHead) to front views (`facing:
  'front'` for the shot) or frame them medium; look at the frame on the word.
- A phone held at the ear from the cut reached up over the first 6 frames of the shot (a flail on every cut): fixed in the
  engine (an action that starts at the cut is there at the cut; `fromCut: true` on a clip keeps the move).
- Video 01: on the tilted bus floor a part moved its people with its own `S.tick` (`a.root.position.y += floor(x)`): the
  man Kit carried rode the engine's pose of Kit, not the moved one, and floated above his head -> never move an actor's
  root yourself when someone is carried by it, holds hands with it or hugs it; stand people at `[x, y, z]` with the floor
  height in y (seats with their own `floorY`), or film the scene level and tilt the set only.
- Video 02: Grandpa on the clock-shop stool read "perched" in the night shots (and "postures removed, stool lowered to .45"
  didn't cure it); three of those shots asked `facing: 'left'` and he faced right anyway: the sit stretched the legs to the
  floor whatever the seat height (on a kitchen / bar stool .62-.76 a standing lean), on the .45 stool the shins dropped
  straight from the seat's front edge under an upright trunk with an empty lap (his arm in a sling), and the stool's seat
  claimed facing 1 -> fixed in the engine: a stool has no back (the sitter's facing wins, even over a spot that pins one),
  its sitter leans in a little, and the feet go on the rung when the seat is too high for flat feet / the far foot tucks
  onto the rung on a low stool (`feet:` overrides, engine_api §6.3). Still look at every seated still against the seat.
- Video 02: Grandpa's plaster cast was a white card the director laid over the arm from models.js every frame; it went
  missing in close-ups and had to be hand-drawn again for the inserts (and the follow-up read "the cast" as the cast of
  characters) -> a cast is part of the look: `S.char('abe', { cast: 'L', sling: true })` (or one models.js look with
  `cast` / `sling`) in EVERY shot from the injury on; the inserts take `S.hand(null, { who, side: 'L', cast: true })`.
  Never draw a body part or a garment from models.js. Write "plaster cast" (never "cast") in notes and fix requests.
- Video 02: the handshake close-ups showed both thumbs sticking up in a V: builders laid a 'flat' and a 'clasp' hand card
  over each other, and the clasp's thumb stood 50 deg off the hand -> one call: `S.handshake('main', 'hal', { pump:
  'shake' })` (= `S.hand(null, { shake: 'hal' })`): the near hand's back with its fingers curled over the other hand, both
  thumbs along the top (engine_api §13). The clasp pose now lays its thumb along the top too.
- Video 01 (7:08-7:12, 4:20, 5:05, 1:11): "Mum takes one hand" / "Poppy's small hand slides into yours" read as one hand
  with ~10 fingers or two fists bumping side by side: builders stacked two whole `S.hand` gloves (clasp + clasp, flat +
  grip) on one spot, both black -> one call: `S.handhold(a, b, { at })` (a's fingers curled over b's hand, arms in a V,
  b's hand in the far-limb tone, a child's hand smaller); never two hand cards on one spot (engine_api §13).
- Video 01 (3:18): the pinky promise was two index fingers pointing at each other with a gap: there was no pinky pose ->
  `S.pinkyPromise(a, b, { at, pump })` (two fists, the little fingers hooked); a fist bump is `S.fistBump(a, b, { at })`.
- Video 01 (7:45-7:49): the hug close-ups were one black blob with four eyes: the hug put the heads ~0.6 heads apart and a
  close-up draws them 1.3x -> fixed in the engine: hugs, group hugs and catches step the people apart until the heads
  overlap by a rim at most, at the shot's head size. Don't move huggers yourself afterwards; look at every hug still.
- Video 01 (1:30.7): in a catch the catcher's head sank into the falling man's head: the caught one tips back 38 deg
  toward the catcher -> fixed in the engine (the catcher steps back as far as the heads need).
- Video 01 (0:52.6, 3:43.3): a cheer's arms snapped to a T-pose 4 frames before the cut, raised arms flapped out 2 frames
  before it: `hold` ended the gesture just before `S.t1`, so the cut caught the release mid-sweep -> fixed in the engine:
  a release that would start in the last 6 frames of a shot holds through the cut; end a gesture 7+ frames before the
  cut or hold it to the cut (`until: S.t1`).

## Camera and framing

- The kitchen wide showed the back wall and cut the dining table and the people at it: `P.cam.wide` is the back-wall
  wide at x = 0 -> `P.cam.full` (the whole room) or the place's own `P.cam.table` for people at the table (catalog.md §1).
- The first camera crept on every shot and swayed (BUILD_LOG 03:35): written before the study -> the references never move
  close-ups or inserts; wides and mediums get one 3 % nudge 4 frames after the cut. `S.camera('auto')` does exactly that
  ("never parked" in a crew brief means `auto`, not a creep on close-ups).
- `S.camera('crane')`, `'rack'`, `'whip'` printed `unknown camera kind`: this engine has no such moves (a crew brief may
  list them) -> catalog.md §10 kinds; rack focus = `S.focus`, rare.
- A phone on a tabletop was a speck: `P.cam.top` frames the whole table -> frame the thing:
  `S.camera('static', { on: phone, frame: { h: .3 } })`.
- Video 01: the bus "tips over the edge" and "hangs over the black river" read as a bus doing a wheelie ON the bridge (7
  shots): a bridge seen side-on runs left-right, so a vehicle leaving it moves toward / away from the camera - a card tilted
  in the picture plane can't show that -> stage it from the END of the bridge (the road comes to the broken railing at one
  side of the picture, the drop and the river beside it, the bus's back half on the road and its front half sticking out
  past the edge, nose down over the water) or from the riverbank looking up at the nose over the parapet. The same for
  cars off cliffs, people off ledges: the edge must be IN the picture, with the drop beside it.
- Video 01: three open-hand inserts in a row (shots 185-187, 5.7 s of the same picture) and the whole ending (16 shots,
  37 s) in front of the same hospital facade: neighbouring shots must differ in place, framing or subject (qa.md §4) ->
  when the story stays in one place, change the angle (the street the other way, a high wide, a low angle, the snow in
  front of a lamp, a reverse), and never give one picture to three neighbouring clauses.

## Graphics and HUD

- A pill pinned to the person (`pos: you`) sat over the face in a close-up (check_layout `covered`) -> close-ups take
  pills at `pos: 'top'` (default) or `'bottom'`; pin pills / tags to things, not faces.
- The chapter label and the `+` icon overlapped, the stat box hid under the checklist (lab skill2, 2026-10-23): both
  default to the same corner -> one element per corner: top-left label OR + icon, top-right checklist OR timer OR - icon,
  bottom-right lives counter OR clock, bottom-left "later" caption OR stat box (`corner:`).
- The persistent lives counter showed on the terminal and the title card: `UI.hud` items cover every shot in their time
  range -> `shot({ hud: false })` on full-frame graphics that must stay clean.
- check_layout said `through` in a split screen: both panels' people stood at x = 0 in the one scene -> stand them at
  different x (each panel's camera frames its own).
- The engine offers `S.stamp`, `stamp:` on documents / cards and map `stamps`: the references use rubber stamps, the
  owner bans them in every style -> never; a pill, a counter or a marker ring instead.
- Video 01: the frozen minute's countdown changed its look between crew parts (a red `S.timer` box, a `S.stat` box, a
  home-made ring board, a "SECONDS LEFT TODAY" number board): the engine had no ring and each part picked its own -> the
  engine has `S.ring` (+ HUD kind `ring`); the storyboard names ONE kind for every running device and the director puts it
  in models.js `UI.hud([...])`, so every part shows the same element (engine_api.md §9 "One look per running device").
- Video 01: a pill with `pos: 'bottom', row: 1` sat under the bottom letterbox bar (cut in half): rows stacked downward
  from every position -> fixed in the engine (bottom rows stack up; pills and tags are moved back inside the picture).
- Video 01: the hero, his sister and Mum went grey with the rest of the frozen world (the clue "her eyes are shut, but
  she is in full colour" was lost): the freeze graded the whole picture -> fixed in the engine: `free: true` characters and
  hand inserts keep full colour (engine_api.md §11). Mark EVERY character inside the minute `free: true` in every shot.

## Sets and props

- Video 02: the town field was a flat green wall behind every medium and close-up (no horizon) until two follow-up edits
  hand-built a project-only `townfield`; the filmed fix gave only one shot its horizon (Shot scope): the storyboard asked
  for "a sports field (stadium)", and `stadium` (also the old meaning of 'field' / 'sports field') is the timeloop's
  HIGH-ANGLE painted card with no sky -> **every outdoor place needs its horizon (a sky + a far layer: hills, trees, a
  skyline) at the framing you use**: a sports ground at eye level is the place `field` (pitch lines, track, stand,
  floodlights, trees, sky; `view: 'goal'`; moods day / dusk / night); `stadium` only for high wides. A models.js exterior
  of your own carries a sky card (`z` -30 .. -40) and a far layer too; check a medium and a close-up of every exterior.
- Video 01: the hospital front "at midnight" was a day-white facade in every shot of the ending: the set designer's own
  cards in models.js used fixed colours that ignore the place's mood -> custom cards take `S.tone('#hex')` (graded by the
  mood like the library's sets; `'!#hex'` for lit things: a sign, a lit window).
- Video 01: the story's dog was a grey rat-like card, the pigeons flat ellipses: there were no animals -> props `dog`
  (stand / run / jump / sit / bark, frisbee) and `bird` / `pigeon` (stand / fly / flap).
- Video 01: hand inserts written from the low-level `RIG.Hand` card came out small (~25 % of the picture vs the
  references' 55-60 %) with sleeves across the whole frame (the skill said "there is no one-call insert", but `S.hand`
  existed) -> `S.hand(prop | null, { close, open, who, from, surface })` for every insert (engine_api.md §13).

## Sound

- Video 02: the export's voice-to-bed check failed (a toast) and a follow-up had to lower every music bed to -37 .. -39:
  the beds were written "at about -32 dB" as the guidance said, and this style's audible effects are most of the bed
  (re-mixed off video 02: -32 -> 14.2 dB under the voice, -34 -> 15.1, -38 -> 16.0) -> music beds at about -34 dB (-33 ..
  -36; quieter in dialogue): the bare music ~19 dB under the voice, the whole bed ~15 dB (the references: 14-19 / 10-13).
  Never above -31 (sound_design.py lowers a music bed that would sit less than 14 dB under the voice). Lowering the music
  further barely moves the check: if it still complains, the effects are too dense (keep ~25 a minute), not the music.

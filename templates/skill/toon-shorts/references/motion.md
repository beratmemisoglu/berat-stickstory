# Motion: how characters and the camera move

Every number here was measured frame by frame on the reference shorts and rebuilt in `lib/anim.js` (characters) and
`lib/camera.js` (camera). The engine already does the curves: your job is to pick the right method and put it on the
right frame. Method signatures: catalog.md; the API: engine_api.md. F = one frame = 1 / 30 s (`const F = 1 / 30`).

## 1. The law

- **Pose to pose.** A move takes 2-6 frames, then the body is DEAD STILL. Nobody breathes, sways or bobs in a hold.
  Life in a hold comes from the camera creep, the face (swaps, blinks, pupils), lights and particles.
- **Everything lands on a word.** Key every action to `S.at('word')`; compute the times once in build.
- **One thing at a time on the subject.** A gesture finishes (and holds ≥ 15 frames) before the next starts; the second
  arm of a two-arm action starts ~10 frames after the first lands.
- **No squash and stretch** on bodies or heads. The only exception is built into `jolt` (2-3 frames).
- **Never** lip-sync the narration; only an on-screen speaker of a quoted line moves the mouth.

## 2. Timing against the words

| event | key it at | method |
|---|---|---|
| a gesture | lands 4 frames before the stressed word (`early`, 3-5) | `a.gesture('shrug', S.at('and'))` |
| a face swap | fully on 2 frames before the stressed word (0-6 before, never > 3 after) | `a.face('smug', S.at('genius') - 2 * F)` |
| a startle (jolt / hop) | the IMPACT + 4-6 frames, not a word | `a.jolt(tHit + 5 * F, { face: 'shocked' })` |
| a reaction to a touch | 2-4 frames after the contact | `a.face('surprised', tTouch + 3 * F)` |
| a reaction to a finished event (a reveal lands) | 6-10 frames after | `a.face('bored', tLanded + 8 * F)` |
| a number's prop event | ON the number's word | `S.info('led', { ..., t1: S.at('ninety') })` |
| a concrete noun's picture | within 0-10 frames of the word | a prop pops (`in: S.at('cake')`), a hand takes it |
| a camera move | starts within ±3 frames of its trigger word | `S.camera('reveal', { at: S.at('island') - .55 })` |
| the reaction push | 5-7 frames after the face swap | `react: [{ at: tSwap + 5 * F, amt: .1 }]` |
| a gag punch-in | ENDS on the frame the face changes | §8 |

## 3. Which method for which beat

| the beat | do |
|---|---|
| explains, points at something | `gesture('point' / 'pointUp' / 'pointSide' / 'pointBack' / 'present')` + pupils on it |
| pride, attitude | `gesture('hips')`, `pose('proud', t)`, face `smug` |
| doubt, thinking | `gesture('think' / 'chin')`, pupils darting (`look` every 4-6 frames) |
| panic, pain | `gesture('head')`, face `panic` / `pain`, `extra('sweat' / 'stress')` |
| defeat, resignation | `gesture('shrug')` or `pose('slouch', t)`, face `bored` / `sad` |
| "this big" | `gesture('armsOut')` (11 frames, a slow one) |
| hunger, sickness | `gesture('belly' / 'throat' / 'mouth')` |
| cold, refusal | `gesture('cross')` (arms crossed) |
| stop, no | `gesture('stop')` |
| a win, joy | `gesture('celebrate' / 'armsUp')`, or `hop` |
| scheming | `gesture('rub')` (loops until `until`), face `scheming` |
| a call | `gesture('phone')` + a phone prop held |
| a surprise, a bang | `jolt` (seated, asleep) or `hop` (standing), locked to the impact |
| a dry line | the deadpan: face `bored` / `skeptical` held 20-40 frames, a `nod` as the button |
| a punchline | the face swap + the camera gag punch |
| dead, knocked out | `fall(t, { dir: 'back' })` + face `dead` / `dizzy` |

Gestures: `a.gesture(name, wordTime, { dur (frames), early: 4, until, back, backDur: 8 })`. `until` drops back to rest
(ease in over 8 frames); without it the pose holds for the rest of the shot. Loops (`wave`, `scratch`, `clap`, `rub`)
jiggle on the hold until `until` (default 1.2 s). Slower changes of stance: `a.pose('lean' | 'slouch' | 'proud' |
'sneak' | 'drowsy' | 'limp', t, { dur: 10 * F })`; the starting stance: `a.stand('hips')` or `S.char(id, { pose })`.

## 4. Faces

- `a.face(name, t)`: the face is fully on at t. A change to another emotional group passes through a half-lid frame and
  a closed frame (automatic); shock faces (`shocked`, `surprised`, `scared`, `terrified`, `panic`, `gape`, `starstruck`)
  squeeze 2 frames then pop in at 85 %. A swap tips the head ~6° (alternating sides).
- `{ inbetween: false }`: a direct swap for impacts and extremes (pain on a hit, X eyes, a snap to terror).
  `{ tilt: 0 }`: no head roll.
- A new face on the subject about every 1.2 s; an emotional beat is a chain of 2-3 faces (startle → closed → smug).
  Background characters keep one calm face; a group reacting together swaps on the same frame.
- The face fits the line: `bored` / `skeptical` for dry lines, rings (`surprised`, `shocked`) for surprise, `pain` /
  `effort` for strain, `blissful` for relief. Contrast is a joke: the line says "terrified", the face is bored, then it
  snaps on the word.
- Extras on the face: `a.extra('sweat' | 'sweats' | 'blush' | 'stress' | 'vein' | 'tears' | 'gloom' | 'sparkle', t0, t1,
  { anim: 'fade' | 'fall' | 'bob', slot: 1 | 2, x, y, scale })`. `fall` = stress dashes sliding off when it ends.
- `a.lids(k, t)`: eyelids 0 open .. 1 shut over 4 frames (sleepy .45); `a.lids(0, t2)` opens them again.

## 5. Blinks

- Most blinks come for free from the swaps (the closed in-between frame).
- Call `a.blinks()` only for the SUBJECT of a close shot (cu / mcu / ms) whose face holds longer than ~2 s:
  `you.blinks({ from: S.t0, to: tNextSwap - 10 * F })` (seeded 1.5-4 s, 3 frames each; none on shock, terror, asleep,
  dead or dizzy faces). Keep blinks out of the 10 frames before a planned swap.
- `{ nervous: true }`: every 8-10 frames, for a guilty or panicking beat. `a.blink(t)` one blink: two of them 4-6 frames
  apart are the double-blink button on a deadpan ending.
- Never on background characters, dark glasses, or a face under ~8 % of the frame width.

## 6. Looking: pupils and head

- `a.look(target, t)`: pupils to an actor, object or `[x, y, z]` (tracked every frame, 2 frames to get there);
  `a.look(x, y, t)` with numbers -1..1 (`look(0, 0, t)` back to the lens). Look at what the character touches, wants or
  fears; at the lens when facing the camera. Pupils lead the head by 2 frames.
- `a.headTo(target, t)`: the head turns in 5 frames (cubic out) and keeps tracking; `headTo(null, t)` back to straight.
  It turns at most ~63° sideways and ~20° up / down: for anything further, `a.turn(target, t)` the body.
- In a close shot the FACE is the point: prefer the pupils (`look`) to a head turn away from the lens; a head turned
  more than ~60° shows the back of the head (check_layout `backface`).

## 7. Moving through space

Walks: `a.walk([[x, z], ...], t0, { style, until, face | endYaw, arms, speed })`. Feet plant on the path (no sliding),
the start accelerates over 9 frames, the stop takes 7, the body turns toward the path before t0.

| style | frames / step | speed (m/s, grown-up) | use |
|---|---|---|---|
| `walk` / `brisk` | 5.5 | 1.42 | the default; purposeful, official |
| `stroll` | 8.5 (sink, then a 1-frame pop) | 0.81 | a cool, unhurried character |
| `step` | 7.5 | 0.96 | a few steps to place something |
| `march` | 7 | 1.2 | stiff, proud |
| `run` | 4 (fists pump, lean) | 3.45 | fleeing, late |
| `sneak` | 10 (crouched, arms out) | 0.54 | sneaking |
| `scurry` | 2 (rock ±5°) | 1.5 | small object characters only |
| `waddle` | 9.5 (wide) | 0.54 | hurt, overloaded |
| `dizzy` | 7 (sway) | 0.86 | after a fall, drunk on sugar |

- Kids and short legs walk slower (speed scales with the leg). `until: t1` forces the arrival time: keep the implied
  speed within ~25 % of the table or the steps look wrong; choose the style instead.
- The path is a smooth curve through the points: route it around furniture with a point beside each obstacle (keep
  ≥ 0.4 m from its edges). Start a walk before the shot (`S.t0 - .3`) for a mid-stride first frame.
- End facing: `face: 'camera' | [x, z] | actor` or `endYaw: radians`. Arms holding a prop or posed don't swing.
- The camera follows a walking subject by itself (its floor path). `track` (side-on) and `follow` for long walks.
- `a.moveTo(x, z, t0, o)` = a one-point walk. `a.move(to, t0, t1, { y, ease, rot })` slides without steps: only when the
  legs are hidden, the character rides something, flies or falls into frame. Never glide across open floor.
- `a.turn(to, t)`: radians, `[x, z]`, an actor or `'camera'`. 180° takes 4 frames; to the camera 6 frames + a 2-frame
  settle. A pop face on a turn rides the squeeze frames.

Sitting and standing:
- `a.sit(seat, tContact, { face, back, quick, pose })`: `tContact` is the frame the bottom lands (the face swap rides 2
  frames after it). It dips 3, rises 5, descends 11, drops on contact, rebounds 3 and settles 5 frames: it starts 19
  frames before the contact (`quick: true`: 11). Call it FIRST (it moves the character to the seat front, `a.home`), then
  walk there (engine_api.md §12.3). Deep seats (armchair, sofa) `back: .45`. Plain sits with no bounce: `quick: true`.
- `a.standUp(t)`: lean 4 frames, hold 3, rise 8 (speed peaks in frame 3).
- `a.crouch(t, { until })`: 5 frames down with the knees out, 6 back up.

Startles, hops, falls:
- `a.jolt(t, { face, h: .15, sweat, arms: true, deflate, until })`: the body pops up in 2 frames with the torso stretched,
  the eyes pop 1 frame later, back down over 11. For seated or sleeping characters. `deflate: .06` slumps lower after.
- `a.hop(t, { h: .32, dur: .36, to: [x, z], tuck })`: anticipation squat 4 frames, ballistic arc, landing squash.
  The standing startle (t = the impact + 5 frames) and cheer jumps.
- `a.fall(t, { dir: 'back' | 'forward' | 'left' | 'right', dur: 24 * F })`: topples like a plank (quad-in), bounces
  once, stays down for the rest of the shot. The camera keeps moving through it.
- Props that fall: animate them in a tick with gravity (`y = y0 - 4.9 * x * x`, quad-in), spin them, end ON the impact
  frame; the impact gets a flinch (§8), a sound and the startle 4-6 frames later.

Hands and props:
- `a.reach(target, t, { side, until, hold: 10, grip, push, lean, look: true })`: the hand ARRIVES at t in 4 frames
  (no overshoot), the body leans after it, the head and pupils go to it.
- `a.press(target, t)`: a finger presses a button: 4 frames in, 1 cm push for a frame, retracts in 7.
- `a.take(prop, t, { side, until })`: reach to its grip point and hold it from t (12.2 in engine_api.md); follow with
  `a.pose('holdL' | 'holdR' | 'holdUp' | 'hold' | 'carry', t + 2 * F)` to bring it up.
- `a.hold(prop, side, t0, t1, { at, rot, orient: 'hand', drop, place, floor })`: in the hand from t0 to t1 (the prop's
  `userData.grip` goes to the palm; upright by default). `drop: true` lets it fall when released, `place: [x, y, z]`
  leaves it there.
- `a.throw(prop, t, { to: actor | [x, y, z], apex, spin })` + `b.catch(prop, tCatch)`: a 7-frame wind-down, a 2-frame
  snap, real ballistics; the catch time sets the flight (~0.75 s reads best). Create the thrower BEFORE the catcher.
- A hand-over (A gives B a letter at T): create A first; `A.hold(letter, 'R', -1e3, T)`; `A.gesture('reach', T, { early: 2,
  until: T + 12 * F })`; find A's hand at T with a pure probe: `A.update(T); A.root.updateMatrixWorld(true); const p =
  A.toon.handPos('R');` then `B.reach(p, T, { side: 'L', grip: 'hold', hold: 3 }); B.hold(letter, 'L', T);
  B.pose('holdL', T + 3 * F, { dur: 8 * F })`.
- Which hand: a character's LEFT hand is on its +x side, so on screen right when it faces the camera. Use the hand on
  the prop's side, the one the camera sees.

## 8. The camera's moves (measured) and when to use each

One `S.camera` per shot: a base kind plus `react` (reaction pushes) and `into` (the exit push). For a sequence of moves
use `keys` or `fly`.

| move | how | when |
|---|---|---|
| creep | `creep` (default): 6 %/s in after a 0.4 s ease-in | between moves, every hold |
| arrive moving | the incoming shot already moves through the dissolve: a `push` / `reveal` with `at: S.t0 - .2`, or a creep | every shot's start |
| leave accelerating | `into: true`: cubic-in, speed peaks ON the cut | every shot that ends in a dissolve (not before a settle-dissolve) |
| reaction push | `react: [{ at: tSwap + 5 * F, amt: .06-.13 }]` (19 frames, sine) | the subject reacts to something |
| gag punch-in | `S.camera('move', { on, from: 'mcu', to: 'cu', at: tGag - 12 * F, dur: 12 * F, ease: 'inOutQuad' })` | a planned punchline: the move ENDS on the face swap |
| bump | `react: [{ at: tLand, amt: .024, frames: 9 }]` | a character's big move lands |
| flinch | `react: [{ at: tHit, amt: -.12, frames: 9 }]` (a pull-back) | an impact |
| slow / medium push | `push` from → to over the shot (x1.06-1.3) | a sentence-long build-up |
| reveal pull-out | `reveal`, `from: 'cu'`, `to: 'ws' / 'ews'`, `dur: 1.6`, started ~0.55 s before the word that names the place | "it's an island", "the whole street" |
| re-aim | `pan`, `toward: thing` (18 frames cubic-out) | the next subject in the same set, inside one shot |
| whip | the next shot `trans: 'whip'` (12 frames) | the next subject of the same set as a new shot |
| follow / track | `follow` (the look lags), `track` (side-on) | runners, walkers, a thrown thing |
| orbit / crane | `orbit` (`deg: 30-40`), `crane` (`height2: 35-40`) | a seated character mulling; rising to an overview |
| fly-through | `fly` with `ease: 'inCubic'` ending just past `S.t1`, the next shot `trans: 'zoom'` | into a building, a machine, a fridge, a head |
| stop | `static` | at most 2 per short, < 1 s: the key reveal, the pre-impact still, the final hold |

- `push` starts at `at` and is still before it: for a punch in the middle of a shot use `move` (it creeps until `at`).
- Never two reaction moves on the same beat. No roll (4-5° only on a fast action pass). Never shake.
- A creep on a close-up pushes the head DOWN the frame toward the caption band: check the shot's last frame.

## 9. Common mistakes

| mistake | fix |
|---|---|
| everyone frozen in one pose for the whole shot | a gesture or face on every beat (~1.2 s) |
| an idle sway or a sine bob added "for life" | delete it: holds are dead still |
| a gesture keyed to the clause start, not the stressed word | key it to `S.at('word')` |
| a new gesture before the last one landed (arms stuck halfway) | let each land and hold ≥ 15 frames |
| a face swap at the word's end (late) | `S.at('word') - 2 * F` |
| a startle keyed to a word | key it to the impact + 4-6 frames |
| the head turned away from a close camera | pupils instead, or turn the body toward the lens |
| a walk whose `until` forces 3 m/s in a stroll | change the style or the arrival time |
| walking through a table | a path point beside the table |
| sitting where the walk did not end | `sit()` first, walk to `a.home` |
| a prop held beside the hand | `take` / `hold` (never place it near the hand) |
| a caught ball pinned in mid-air | create the thrower before the catcher |
| blinks on extras or on a terrified face | `blinks()` only on the close subject |
| a push that starts mid-shot from a dead stop | `move` instead of `push` |
| a parked camera before the dissolve | `into: true` |

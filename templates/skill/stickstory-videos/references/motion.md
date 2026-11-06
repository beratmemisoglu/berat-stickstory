# Motion: how people and the camera move

Measured at full rate on the three references (experiments/stickstory-style/analysis/motion, hands, characters, camera
NOTES.md; 24 fps, F = one frame = 1/24 s). The Actor and the camera already move this way; this file tells you which
call to make and when, and what to check in motion frames.

## 1. The model in one paragraph

Everything is a tweened 2D rig animated **on 1s**, **pose to pose: short transitions, long holds**. 75-87 % of all frames
are near-still. Moves are short (arm gestures 2-6 frames, a stand-up 11, a hug wrap 4-5, a turn 1) with quad / cubic
in-out easing and no overshoot; gestures accelerate into a hard stop and leave with an ease-out. Holds are either a true
freeze or a drift too slow to see. No smears, no motion blur, almost no anticipation (an arm can go from hanging to
overhead in 2 frames). The only follow-through is hair. **The camera supplies much of the life** (a nudge, a truck along
a set while the people stand frozen).

What this means when you write a shot: give each person ONE or TWO actions on the clause's words, not a stream of
movement; let the holds be holds; act the face more than the body.

## 2. Walks

| style | frames a step | stride | arms | use |
|---|---|---|---|---|
| `brisk` | 5 | long | +35 / -23 deg | purposeful, late, determined |
| `medium` | 7.5 | | +-20 | a bit quick |
| `normal` (default) | 8.7 | 0.27 of the height | +-12 | everyday |
| `slow`, `sad`, `tired` | 10 / 10 / 8.7 | short | small, head down | after bad news, at night |
| `kid` (default for kids), `kidRun` | 5.8 / 4.2 | | | children |
| `run`, `jog` | 3.5 / 4.5 | long, rear leg extended | elbows 90 deg pumping, lean 15-20 deg | chases, rescues |

- Feet are planted (0 px slide) with IK; the body is lowest at contact, highest at passing; the start eases in over 5-6
  frames (the body tips forward first), the stop eases out over 4-7 frames with a small dip.
- Two walkers never share a period: `{ tempo: .92 }` / `{ tempo: 1.08 }` on one of them.
- Profile walks across the frame are the common view; a walk mostly in depth turns the body front / back (bob only, no
  sway). Perspective walks toward the camera are walks in z.
- The camera for a walk: `truck` (locked on the walker, the layers slide by depth: the references' parallax) or a static
  wide the walker crosses. A cheat for a close emotional walk: a frozen mid-stride pose with a slow slide is NOT
  available as one call; prefer a static wide.

## 3. Sitting, lying, the floor

- **No on-screen sit-down in the references**: every seated shot cuts in on someone already seated. Start seated
  (`S.char(id, { sit: 'chair1', posture: 'upright' | 'typing' | ... })`). On-screen transitions that DO happen: stand-up
  (11 frames, `a.stand`), crouch drop (5 f), slide down a wall to the floor (22 f), kneel into a hug (`a.kneel(at, { slow:
  true })`, 30 f), bend over (14 f).
- Desk / chair, side view: torso ~10 deg forward, thighs level on the seat, shins vertical, feet flat, forearms level at
  the desk top (`typing`). Bed edge: thighs level, hands on the thighs (`upright`). Bedside: torso 35-40 deg toward the
  bed, both hands around the other's hand.
- Working at a desk: hands still on the device, a 9-frame burst every ~1.5 s (`a.type`). Drinking: up 13 f (the engine:
  9 f to the mouth), sip hold 16-20 f, down 4-10 f; the head tips back, the eyes close (`a.sip`).
- Seated cheering: torso fixed, arms up in 4 frames, held 28, down in 3-4.
- Lying: flat and frozen (no breathing) or propped under a blanket (`S.char(id, { lie: 'bed' })`, `face: 'sleepy'`).

## 4. Idles and holds

Three idle types, picked per character, never in sync:
1. **still** (frozen + blinks): the most common; every listener, every extra.
2. **sway** (60-80 frames, 1-2 % of the height, under 1 px a frame): standing people in long holds.
3. **breathe** (36-40 frames, ~10 % of a head): close-ups of someone emotional.
`S.char` picks one (35 % sway) unless you pass `idle`; `a.idleAs(kind, at)` changes it. **While one person gestures, the
others are frozen.** No fidgets, weight shifts or look-arounds as idle; blinks are the only regular idle in frozen shots.
Close-up acting = short head nudges (2-3 frames, `a.nudge`) and face swaps; 35-40 % of close-ups have a completely still
head.

## 5. Gestures (frames: in / hold / out)

| gesture | timing | notes |
|---|---|---|
| point / offer | 5 accelerating, hard stop / 28 / 5 ease-out | the listener frozen |
| cheer (arms V) | 6 / 28 / 5 | no anticipation |
| hands on head | **2-frame snap** / 18 / 7 | no in-betweens |
| arms crossed | 7-8 in | |
| wave | arm up, forearm swings every 2-3 f (~4.7 f a cycle), ~4 cycles | the face changes first |
| clap | one clap every 3 frames | |
| laugh | snap 30-40 deg forward in 2-3 f, then a 6-frame bob | a group laughs within 0-1 frame of each other |
| drink | 13 / 16 / 10 | eyes close |
| fist pump | down 3, up 3 | |

Rules: transitions 2-6 frames, holds 16-30; arms straight or bent at one clean angle; the hand and forearm arrive
together. **Land the gesture 2-5 frames BEFORE the stressed word** (`S.at('word') - 3 * F`): the hard stop reads on the
word. Out on the next phrase or held to the cut - never in the last frames before it: a release that would start in the
last 6 frames of the shot is held through the cut by the engine (video 01: a cheer's arms swept through a T-pose 4 frames
before the cut, raised arms flapped out 2 frames before it).

## 6. Turns and heads

- Body turns are **one-frame view swaps** between front, 3/4, profile, 3/4 back and back (`a.turn`); a walk step may
  follow 1-2 frames later. Several people may swap on the same frame.
- Head: nudges of 2-3 frames, small; dips on stopping, tips back when drinking. No double-takes, flinches or jolts as body
  motion: **surprise is a face swap** (`a.face('shock', at)`). (`a.doubleTake` exists: use it rarely.)

## 7. Faces in motion

- A change lands ON the stressed word or 1-2 frames before. Inside a shot it is a 3-frame crossfade by default (only the
  parts that change fade: brows, under-eye arcs and tears never pop on or off; the owner saw a one-frame swap as a
  glitch); at a shot's first frames it is instant (the cut hides it); `{ blend: 0 }` forces the references' hard swap,
  `{ blend: 3-8 }` a slow mood shift. Never scale or bob the head on a change.
- Reactions come 12-24 frames after the other person's line.
- Blinks every 3.5-4 s (+-1), 3 frames closed, never on a stressed word or a face change (automatic).
- Lip-sync only for in-story dialogue (`[Name]` lines): the O ring peaks once per syllable (5-8 frames), opens 1-2 frames
  before the word, closes 1-3 after (`a.say(line)`). Talking adds an occasional head tilt (`a.tilt(12, at, { until })`).
- Emotional silence: the A/B toggle (`a.sob('cry', 'sad', t0, t1)`).
- Phone at the ear: the head nods up 2.4 % over 5 frames and back over 6 (`a.phone(at, until, { ear: true })`).

## 8. Hands and contact (frames)

| action | timing |
|---|---|
| reach out / take | 4-5 ease-out, contact 10-20, leave 4-5 ease-in |
| lift to the mouth | 9 in-out, hold ~20, lower 4 |
| hand-off | both reach, the object jumps hands in 2 frames (receiver over object over giver) |
| hug | arms wrap in 3-5 after arrival, the pair leans in over ~16 (sine), then a hold; the heads side by side, overlapping by a rim at most (the engine keeps them apart at every framing) |
| kneel into a hug | 28-30, sine |
| press a button | reach 5, contact 10, leave 5 |
| handshake | near hands meet exactly halfway, 3 pumps of 8 frames; its close-up `S.handshake(a, b, { pump })`: the near hand's fingers curled over the other hand, both thumbs along the top (never two hand cards laid over each other: the thumbs stood up in a V, video 02) |
| holding hands (close-up) | the other hand slides in 10, the fingers close round it 4 (on the word), a squeeze 9 (timeloop s140 / s208): `S.handhold(a, b, { at, squeeze })` |
| fist bump (close-up) | fists accelerate in 6, contact on the word, recoil 3, settle 6, a small pop: `S.fistBump(a, b, { at })` |
| pinky promise (close-up) | the fists come together 6 while the little fingers hook, then 2 shakes of 8: `S.pinkyPromise(a, b, { at, pump })` |
| drop | constant acceleration, slight spin |
| arms drop from a raised pose | 2 |
| expression on contact | swaps on the contact frame |

Held props are rigid (0 px drift relative to the hand); a hand holding still drifts at most 0.6 px a frame; no hand
jitter. Contact is exact; a gesture toward a person stops 0.3 heads short.

## 9. Several people and crowds

- Pairs and trios: each its own idle type, period and phase; walkers side by side with different step periods; listeners
  freeze while the speaker gestures.
- Group reactions start within 0-1 frame of the cue (laughs bob in phase, then drift).
- Foreground crowd members bob / sway with periods 9-12 frames, all different, starting 5-6 frames into the shot at
  different frames; background crowds are flat faceless silhouettes, frozen while the camera trucks, or bobbing ~12 f.
- `S.crowd({ mood: 'still' | 'sway' | 'bob' | 'cheer' | 'laugh' | 'clap' | 'walk' | 'run' })` does all of this; up to
  ~20 animated extras, dense static rows behind.

## 10. The camera

| move | numbers | when (rough counts over ~27 min of references) |
|---|---|---|
| static | | ~430 shots: close-ups, inserts (~90 % of them), half the wides |
| nudge (`auto` on wides / mediums) | wait 4 f, zoom 1.00 -> 1.03 over 40 f quad in-out, full stop >= 8 f before the cut | 138 |
| nudgeOut | 1.00 -> 0.975 over 12-20 f | 31 |
| pushBig | +15-20 % over ~3 s, sine | 19: emotional holds |
| threat | +35-50 % over 2-4 s | a threat reveal |
| stepPush | +4.5 % in 34 f at each new line | emotional dialogue |
| truck / pan / tilt | 26-46 f quad in-out; linear drifts in the storybook look | 24 |
| punch | +32 % over 18 f on a word | ~2 |
| crash | x1.5 in 10 f from the cut | 1-2 |
| pullReveal | x0.37 over 11 f quad-out | 1-2 |
| pushInto / zoomThrough | x4 over 85 f into a window / eye / screen, cut to the inside / x2.7 in 10 f + cut | 1-2 each |
| diagram tour | 0.5-2.5 s pans / zooms with 0.5-1.5 s holds | over long graphics (`S.tour`) |

- Close-ups and inserts never move. Never roll, never shake, no rack focus.
- A hold over 5 s needs acting, a slow push or a graphic that keeps building.
- Layers spread with depth (back wall 1.0, mid props 1.2, front props 1.35-1.4 in a truck): put foreground pieces at
  z +1 .. +3 to get it.

## 11. Recipes (all ran in the labs: engine_api.md §17)

```js
// a reaction on the word
you.face('shock', S.at('gone')).nudge(S.at('gone'));
// a gesture that lands before its word, then the face
mum.gesture('point', S.at('there') - 3 * F, { hold: 1.2 }).face('smile', S.at('listen'));
// a walk to a door, the camera trucking
you.walk('door', S.at('walk') - 6 * F, { style: 'brisk' }); S.camera('truck', { on: you, frame: 'ls' });
// emotional dialogue: a step of the push on each line
S.camera('stepPush', { on: ivy, frame: 'ms', steps: [S.at('Look'), S.at('Now')] });
// a mood shift during narration
you.face('sad', S.at('exhausted'), { blend: 4 });
```

# Hands and holding (lib/hands.js, engine v17+)

Every object a person holds goes through `hold()`. It parents the prop to the hand bone with an offset computed ONCE from
the visible palm (`f.palm()` axes) and the prop's grip frame, closes the fingers until they touch the real mesh (never
through it, no air), moves the hand to the use pose (phone at the ear, papers read, a box carried) by IK after the clip
every frame, and places the second hand of two-hand grips. check_layout's HOLD check measures the real meshes.

```js
import { prop, place } from '../lib/props.js';
import { hold, rest, holdIssues, VERIFIED, USES, POSES, gripsOf } from '../lib/hands.js';
const f = figure('main', { parent: S.scene });
const phone = prop('smartphone'); hold(f, phone, 'ear');            // the grip names its use (ear); side: the grip's hand
hold(f, prop('mug'), 'wrap', { side: 'L' });                       // 'any' grips work in either hand (mirrored)
const mug = place(S, prop('mug'), { on: counter });                 // pick-up: rests on a surface until t0
hold(f, mug, 'wrap', { t0: 3, t1: 7 });                             // reach 0.5 s before t0, grip, lift; put back at t1, release
hold(f, prop('cardboard box'), 'carry');                            // two-hand grips: both hands, the box in front of the belly
rest(f, keyboard);                                                  // typing / writing: the hands come down onto the surface under them
handover(giver, taker, box, 'carry', { t: 2.4 });                   // one prop from hand to hand (both stand ~0.85 m apart, same clock)
// then drive the figure as usual, every frame WITH the time: f.act('walk', { t }) / f.sequence(list, t) / f.walkAt(..., { t })
```
`hold(f, prop, grip?, { side 'R'|'L', t0?, t1?, use?, pose?, weight?, rest?, parent?, flip?, dwell?, reach?, lift?, arc? })`
-> h (`h.release()`, `h.report` after a check). t0 / t1 are read on the figure's OWN clock (the t of its act / sequence /
walkAt): drive every figure with the scene time, offset a clip with a sequence step's `start`. rest: the world pose the
prop goes to / comes from (default: where it is now); flip: the grip turned 180 deg (taking it from someone facing you);
dwell: seconds the hands stay on it at rest; arc: how high a pick-up lifts it before turning (6 cm).
`handover(a, b, prop, grip, { t, gripB?, sideA?, sideB?, y?, at?, settle .4, overlap .2, lift .7, reach .7 })` -> { a, b, at, fit }:
the prop arrives at an exchange point both reach (settle .4 s before t) (`fit.short` > 0 = still out of reach: stand them closer), b's hands close on
it while it is still, both hold it until t + overlap, then b lifts it (turned round when they face each other) and a lets go.
`rest(f, surface, { sides 'LR', clearance .002, max .25, t0?, t1?, on? })` -> r: every frame the clip's hands (typing hovers
13-16 cm over a keyboard) come down onto the surface right under them - the surface AND what it stands on (the desk under the
keyboard; `on` overrides) - orientation, finger motion and the clip's elbow kept, never into either.
Seated at a table or desk, `sitOn` (props.js, v18) already calls `rest(f, top)` with the flat things on it (keyboard, papers,
plates) as `on`, weighted by how much a resting clip plays (sit, sitChair, typing: a talking clip lifts the hands off);
`sitOn(S, f, chair, { rest: false })` opts out, `{ rest: keyboard }` picks the surface. Rests run after the holds and give a
hand to a hold that takes it (continuously).
`holdIssues(f)` -> `[{ type: 'HOLD', detail }]` (the LAYOUT_CHECKS entry runs it for every hold and rest in the shot).
The holds run in `f.onApply` (figures.js v17: after every apply(), after its arm-out-of-body correction, at the time of the
act / sequence / walkAt); a figure that holds things gets `f.noAutoPhone` (no built-in act('phone') phone or palm push).
Fist clips (Point, Pistol, Punch, Throw, Lockpick, FoldArms) and big forearm twists fight a grip: no hold() during them.
`gripsOf(prop)` lists a prop's grips; `USES` / `POSES` the use frames and hand poses.

## Rules
1. Anything in a hand: `hold()`. Never `f.hold()`, never `bone.add(prop)`, never a prop placed by coordinates near a hand.
2. Only VERIFIED combos (kind x grip x body x hand x clip, the table in hands.js). Anything else: verify it first (SOP).
3. One hold per hand at a time; a two-hand grip takes both. Release (`h.release()`) or give `t1` before the next one.
4. Pick-ups need a reachable rest: standing, a surface about 1 m high within ~45 cm; seated, `sitOn` the person first.
   The mannequin's spine leans up to ~25 deg; farther, the HOLD check says how many cm short (the prop would pop).
5. Grips with fingers under a flat object (book/papers carry, read) cannot be picked up from a table: hold them from the
   start (no t0) or start the shot with them already in hand. A grip with a `pick` grip (the smartphone's) can: the hand
   takes it with the pick grip and the prop turns into the use grip on the way up.
8. Things on the floor next to a person (bags, a suitcase): `beside(S, item, person, { side })` (props.js), never coordinates.
6. The Idle_Talking clip gestures with the free hand: one-hand chest uses (look/hold) are not verified with it on every body.
7. Seated with a hanging item (bag, briefcase, a carried book/folder/laptop): it hangs into the seat - not verified (put it down).

## Grips (props.js `grip(pos, fingers, palm, o)`, userData.prop.grips)
pos = where the palm centre goes (prop-local), fingers = the open fingers' direction, palm = from the palm INTO the
object; x = fingers x palm is the RIGHT thumb's side. o: `hand` 'R'|'L'|'any', `pose`, `use`, `mirror` ('x'|'y'|'z': the
plane the other hand's grip is mirrored across - one that maps the prop onto itself without moving the grip into a part),
`second` (the other hand's grip), `contact` (fingers that must touch), `up` (hang axis), `tip` (ear/mouth point), `clips`,
`bar` (handle grips: `[[x, y, z], [x, y, z], r]` the handle's centre line + half thickness - the solve tries a few palm places
over it and keeps the one whose fingers wrap it best; the HOLD check fails a hook that does not wrap it).
Kit grips: smartphone look/ear/film (+ pick: how a hand takes it off a table; look/ear/film use it at a pick-up), phone handset ear, mug wrap, glass wrap, water bottle wrap, can wrap, papers
read/carry, folder read/carry, newspaper read/carry, book carry, open book read, tablet read/look, laptop (open: 0) carry,
briefcase handle, shopping bag handle, cane handle, staff two, broom two, baseball bat two/carry, umbrella handle,
flashlight aim, microphone hold, hammer handle, cardboard box carry, crate carry, tray two, steering wheel drive,
placard two, id card show, key pinch (not verified).
Poses: relaxed, fist, wrap, grip (wrap, thumb along), pinch, phone, edge (sheet edge: fingers behind, thumb in front),
hook (bag handles: palm above the bar, the bar across the middle phalanges, fingers under and round it, thumb tucked),
flat (palm under / on a face), point. A handle needs room for the hook: >= 4.5 cm clear under the bar, <= 2 cm deep.
Uses: clip (the clip moves the hand), hang (+ hangs straight down, sideways off the legs, above the floor), look, film,
ear, read, hold, drink, carry, tray, pole, sign, aim, show, mic, umbrella, wheel (the prop stays put, hands go to it).

## SOP: a new holdable prop (or a new grip, clip or body)
1. Build it to the kit contract (props.md). Real proportions; check that a 2.5 cm mannequin finger fits any hole/gap
   the grip needs (a mug handle's 13 mm hole does not: no handle grip).
2. Write the grip: wraps put the palm ON the surface; thin bars/poles put the palm centre ~3 cm toward the wrist so the
   bar lies across the finger bases; phones/sheets/boards put the palm beside the edge. Pick pose, contact, use, mirror.
3. Look at it alone first: `<project>/lib/holdview.html?body=male&args=["kind"]&grip=<grip>&side=R&clip=Idle_Loop,Walk_Loop&times=.3,1.1`
   (the view_hold tool; `window.viewHold(o)` -> { png, report: { clean, verified, rows } }), both bodies, both hands. Then
   the harness for the full matrix (headless, muted):
   `node experiments/recon-style/src/stories/handtest/run.mjs "<kind>:<grip>" --times 0.3,1.1 --views face,pov,out,below --out <dir> [--body female]`
   (`all` = every grip; `--clips a,b` other clips; `--xray` see-through body; `pickup`; `sit`; `calib` = the palm frame).
4. LOOK at every sheet (out/handtest/<dir>/<kind>_<grip>_<side>.png: each clip x time x 4 views) and at
   `python review.py <male dir> <female dir> <out>` pages. The numbers miss "glued" holds (fingers on the bag body
   instead of through its loop, a scissor grip that measures clean): a combo is verified only if it LOOKS right too.
5. Fix the grip / pose / contact / use; rerun until clean on both bodies and both hands (results*.json, log.txt).
6. `python verified.py <male dir> <female dir>` -> paste VERIFIED into lib/hands.js (+ the experiments mirror);
   add visual rejects to REJECT in verified.py. Add a line below for every mistake you hit.

## The HOLD check (per hold, the current frame)
finger/hand vertex inside the prop (> 1 mm) - the prop inside the body (> 2 mm, any visible vertex near it) - the prop
off the hand (nearest hand vertex > 5 mm) - a contact finger in the air (> 3 mm) - a handle (grip `bar`) not wrapped: index /
middle / ring must touch it from below AND round it (its far side, or every tip >= 2 mm past its centre) - the second hand off its grip (> 6 mm)
- the use pose out of reach - the hand short of a resting prop at t0/t1 - the prop through another solid or the floor -
a phone not at the ear (judged once it arrived) - a hand inside furniture (table, cradle, door) - a handover's exchange out of
reach or its two people on different clocks - an unverified combo. Props in a hand are skipped by PLACEMENT. The solve corrects what it safely can: the object moves off the palm along
its normal, a finger stops at the surface, the thumb swings/spreads to touch, the prop is kept out of the trunk and legs
(forward, up for carries, sideways for bags), a hand out of reach pulls the prop toward its shoulder, the spine leans.

## VERIFIED (2026-10-16): 555 combos, both bodies (male Y Bot, female mannequin), both hands where the grip allows
36 kind x grip rows in lib/hands.js; clips I Idle_Loop ('stand'), W Walk_Loop ('walk'), T Idle_Talking_Loop ('talk'),
A Sitting_Idle_Loop ('sit'), S KK_Sit_Chair_Idle_Loop ('sitChair') + the grip's own (Idle_TalkingPhone_Loop, Walk_Carry_Loop,
Idle_Torch_Loop, Driving_Loop). Not verified: key pinch (scissor grip), seated staff/broom (pole into the thigh), hammer L on
the male (index 6 mm off), glass on the female (thumb base 1.4 mm in), talking with tablet/phone look, seated hanging items.
Removed (cannot be held properly by the mannequin hands): mug handle, backpack top loop, suitcase top handle, pen.

## Failures and fixes (what it looked like -> cause -> fix)
- Phone 9 cm up the forearm, hand bent back -> the right hand's use frame (side, up, fwd) was left-handed -> right-handed anchor frame, the side sign applied to vectors.
- Phone resting on the thumb, 11 mm off the palm -> the bind thumb points 35 deg into the palm side -> the thumb swings in from outside until contact (+ a spread axis); the phone rests in the fingers, palm beside its edge.
- Fingers 10 mm off a mug while the solver said "touching" -> finger capsules took their radius from the big joint balls -> contact measured on the real skinned vertices (sampled, triangle grid).
- Carried box twisted 35 deg and in the belly -> anchored to the chest bone's rotation (clips twist the spine) -> chest/pelvis uses = bone position + the figure's facing; per-frame keep-out vs trunk and legs.
- Box out of reach / thighs into it while walking -> use point too low and far -> higher use point, keep-out forward+up, automatic reach fit.
- Flat hands on a box with fingers 27 mm off -> 'flat' had no contact fingers -> flat closes the fingers onto the face.
- Forearm through the box / tray -> hands mid-side, the forearm crossed the object -> grips near the back edge; tray: back corners, fingers forward.
- Papers/folder/book carried standing up along the forearm -> pinched at the bottom edge -> pinch the TOP edge, hang it below.
- Bags into the thigh -> hang straight, then push sideways as an arc about the shoulder (no over-reach), repeat after re-hanging; above the floor by bending the elbow.
- Cane/pole/hammer/mic: the bar under the palm, fingers in the air -> palm centre on the bar -> palm ~3 cm toward the wrist.
- Two-hand poles 1-3 cm out of reach -> fixed use offsets -> a hand out of reach pulls the prop toward its shoulder.
- Female fingertips through objects -> her skeleton skins the tips to *_04_leaf bones, ignored by the finger model -> leaf weights ride the third phalanx.
- Female thumb margin 16 -> 99 mm, bottle pushed 36 mm off the palm -> the subsampled test missed the big thenar -> every thumb-base vertex tested, margin capped at 6 mm.
- Female box into the chest -> clavicle-weighted vertices (her chest) left out of the keep-out -> included.
- Thumb hovering 15 mm over the mug rim -> one spread value -> spread search when the thumb must touch.
- Index never curling round a handle -> a finger touching at the open pose stayed open -> its first joint stays, the next ones still close.
- Mug held in the left hand with the fingers in the handle -> mirror 'x' moved the grip into the handle -> mirror 'z'.
- Mug popped 28 cm into the hand at t0 (75 cm table, standing) -> out of reach, IK clamps -> spine lean + a HOLD message; pick up from ~1 m standing.
- A phone appeared in the free hand -> hands.js re-showed figures.js's act('phone') phone -> hands.js only ever hides it.
- Key looked like a scissor grip, backpack fingers "glued" on the bag: both measured clean -> the visual review is part of the SOP.
- Wheel hands floating -> placed for a standing person -> the wheel only with Driving_Loop, seated, 40 cm in front of the chest.
- A "smarter" thumb search (no penetration first) left the thumb 5 mm off every cup -> the cup must first move off the thenar (verify -> move rounds), then the thumb wraps -> keep the contact-first search; re-run the cups on both bodies after any solver change.
- act('sit') changed clip in engine v17 (Sitting_Idle_Loop; the KK chair clip is 'sitChair') -> both are in the harness and the table (A, S).
- Typing hands 13-16 cm over the keyboard -> the clip's hands are not on a surface -> rest(f, keyboard): 2-3 mm on both bodies.
- (charstress, 25 multi-person scenes) Handover: the taker held the box at head height with crossed arms -> her flipped grip
  had an unflipped use pose -> a flipped grip flips its use frame. The box jumped 6-22 cm at the switch, both holds moved it ->
  ownership (a hold that is not holding never moves the prop) + a held-at-rest phase + fitExchange (a point both reach).
- Handover 0.4 s early -> the taker's clip ran on t + 0.4 and holds read the figure's clock -> one clock; HOLD says so.
- Desk phone handset 45 cm out of seated reach (back corner), popped into the hand; a second handset stayed glued on the
  phone -> arrange.desk puts it within reach; desk phone { handset: false } + top 'cradle' (Bx y is the BOTTOM: top .076).
- Handset dragged the hand 10-25 mm through the phone body on the way up -> pick-ups rise in an arc (6 cm) and turn late.
- Mug pick-up: the pinky 3 mm into the table -> the wrap grip's palm centre at mid height (4.7 cm; re-verified both bodies).
- Seated diner's glass 17 mm into the table top -> use poses rise onto the furniture under them (liftOverSolids).
- Bat / bag / briefcase popped 1.5-2.3 cm while walking -> keep-out margins fade in over 3 cm of depth, the push is at most
  1.5x a vertex's depth for hangs (3x for chest carries: 1.5x left a crate 3 mm in the thigh).
- (open) A hanging hammer turned 17 deg in 1/60 s when a talking gesture lifted it toward upside down (hangStraight's minimal
  rotation is undefined near 180 deg). Capping / fading that turn broke walking canes, running bags and the bat carry (they
  need 150-180 deg from the grip): reverted. Do not combine hang grips with gesture clips (Idle_Talking) until fixed per grip.
- Hand / elbow snapped 1.7-2.7 cm when a reach or rest started -> the IK pole fades in with the weight; rest() keeps the clip's
  elbow. Typing hands 15 mm into the desk top -> rest() rests on the keyboard AND the desk.
- Hands through a door leaf / jamb / handle were not reported -> HOLD: hand vertices inside scene solids.
- A seated caller's head jumped 9 cm during a reach -> the spine lean followed the moving reach target -> it aims at the
  rest target, faded by the reach's progress. Reaching from the lap went 15 mm through the desk top, a side grip was
  entered from above -> reach path: pull back, rise, over, the last quarter along the palm normal.
- Office chair arm posts 11 mm into a seated male's thighs -> arms at +-0.255 m.
- Read grips "clean" with BOTH THUMBS IN THE AIR beside the sheet (the thumb touching the 7 mm side edge counted as contact)
  -> papers / folder / newspaper / tablet read: the palm beside the edge facing it, the thumb on the front face, index and
  middle behind, middle + thumb must touch (re-verified both bodies x 5 clips in holdview). Open book read and tablet look
  still have the old grip: fix the same way before relying on them.
- Briefcase / shopping bag: the fingers lay flat on the bag's face, draped over the handle, "clean" by numbers -> the straight
  14 cm mannequin finger reached past the handle into the case top (2.2 cm under the bar), so closeFinger stopped at once; a
  2.6 cm deep bar / 3.4 cm apart ropes are deeper than the 3 cm middle phalanx can pass under -> briefcase bar 2 x 1.8 cm,
  5 cm clear; bag ropes together (2 cm), arch 1 cm lower (the bag hangs no lower); hook pose closes from 40 % (`from`), MCP .5
  / PIP 1.7 / DIP 1.2, thumb tucked (opp .9: it stuck up like a thumbs-up); grip `bar` + a palm-place search per hand (one
  place hooked the male right hand and left the female's fingers 5 mm under the bar); HOLD fails a hook that does not wrap
  the bar (old grips: "touch the bar nowhere, tips 48 / 72 mm short"). Re-verified I W T + Jog_Fwd + Sprint, both bodies
  and hands (seated: put it down). A grip whose open fingers already touch the prop never closes: start the close part way.
- That palm-place search cost 8-10 s per hold (35 finger solves): the app's 30 s still budget ran out on a street with three
  bags -> the place is kept per body x prop x grip x hand x pose (BAR_PLACE), baked for the built-in bodies (BAR_BEST):
  0.5-0.7 s per hold, the same grip. A new bar grip / body: run the search once and bake its result.

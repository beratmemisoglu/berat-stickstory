# Character animations (lib/anims.js)

Every clip a figure can play, by name or by kind. Two sources, one catalog:

- **Built-in** (131 clips, CC0, ship with the app): Quaternius UAL 1 + 2 (`Idle_Loop`, `Walk_Loop`, `Sitting_Talking_Loop`,
  `Idle_TalkingPhone_Loop`, `Death01`...), the authored gestures (`G_Point_Forward`, `G_Facepalm`, `G_Typing_Seated_Loop`...)
  and KayKit (`KK_PickUp`, `KK_Sit_Chair_Down`, `KK_Lockpicking_Loop`...).
- **The user's own** (Settings > Media > Character animations): Mixamo clips and other humanoid FBX / GLB files the user
  downloaded and imported. Named after the file (`Talking On Phone`, `Walking`). They exist only on this computer.

## Find a clip

```js
import { loadAnims, findAnims, animInfo, ANIMS } from '../lib/anims.js';
await loadAnims('all');                         // the catalog + every clip file (or a list of names: cheaper)
findAnims('phone')                              // entries, best first: user clips rank first on a tie
findAnims({ tag: 'sit', loop: true })           // filters: tag(s), loop, inPlace, hands ('none'|'left'|'right'|'both'), kind ('builtin'|'user')
animInfo('talking-on-phone')                    // by name, id (slug) or any case
```

**Use only usable clips** (every built-in clip was played on both bodies and checked; table at the end): `findAnims`
never returns a clip marked `broken`; `findAnims({ tag: 'idle', verified: true })` returns only `verified` ones;
`{ body: 'female' }` judges by that body's own verdict. An `ok` clip has a known minor flaw in its `notes`: read them
before you use it (a camera angle or a prop usually hides it). A broken clip played anyway (`f.act('KK_Sneak_Loop')`)
warns and the figure plays `Idle_Loop` instead; `figure(role, { allowBroken: true })` forces it (never in a video).
`f.clipInfo(name)` -> `{ duration, loop, ground, quality, notes }` as that figure plays it.

An entry: `{ name, id, kind, source, tags, loop, inPlace, duration, hands, suits, travel, quality, qualityBy?, notes? }`. `hands` = which hands the clip
keeps busy (props, hand IK); `suits` = what it is for, in words; `travel` = m/s the source walked (in place = 0).

Tags: idle walk run sit talk phone point carry pick-up type fight fall dance gesture wave cheer shrug facepalm think yes no
fold-arms hands-on-head hands-up react hit death lie crouch kneel sneak jump climb swim drive push pull throw eat work gun
exercise get-up sit-down injured zombie scared angry sad look door crawl turn roll slide travel. Check `ANIMS` for the
exact names before writing a scene; never invent a clip name.

## Play it

Figures play any catalog name: `f.play('Talking On Phone', t)` / `f.act('Talking On Phone', { t })`, blended like the
built-in acts. Under the hood: `animClip(name, f.root)` returns a THREE.AnimationClip fitted to that figure's skeleton:

- Mixamo bones map onto the UE5 names (Hips -> pelvis, Spine/1/2 -> spine_01-03, LeftArm -> upperarm_l, LeftHandIndex1 ->
  index_01_l...); every bone copies the source's world-space rotation change from its rest pose (T-pose vs A-pose,
  different bone axes and proportions handled); hips height scales with the leg length (feet stay on the floor).
- A hand near the head in the source (phone, facepalm, hands on head) stays at the same place on the target's head.
- Deterministic: baked on a fixed frame grid; the same time is always the same pose (no state carried between frames).
- Loops: `clip.userData.loop` (built-in loops also end in `_Loop`). Wrap time yourself when you drive a mixer directly.

## Walking and travelling clips

Clips play **in place** by default: the straight-line drift of a travelling clip (Mixamo Walking without In Place) is
removed and its speed reported: `animSpeed(name, f.root)` (world m/s) and `clip.userData.speed / travel` (direction).
Move the figure with `f.walkAt(from, dir, dist, { clip: 'Walking' })` (it moves the figure at the clip's speed: the
planted foot does not slide) or your own `x = speed * t`. `animClip(name, root, { inPlace: false })` keeps the travel.

## Blending

Several clips at once = weights (`f.play(a, ta, .6).play(b, tb, .4).apply()`); `blendFor(a, b)` gives the crossfade
seconds; `f.act(name, { from, at })` crossfades from the previous act. Mixing a user clip with a built-in one works (same
skeleton after retargeting).

## When the user wants a move that is not there

Say which: "There is no built-in clip for <move>. You can add one from mixamo.com: sign in with your own free Adobe
account, search the motion, Download: FBX, Without Skin, 30 fps, In Place for walks and runs. Then Settings > Media >
Character animations > Import FBX..., or drop the files into the inbox folder shown there (a bulk download works)."
Never download Mixamo files yourself and never copy them into the project or the app: they stay in the user's library
(`<workspace>/assets/animations/`, served at `<project>/__anims/`).

Limits: humanoid skeletons only (Mixamo, UE5-style and similar names); one clip per FBX take; no finger IK; contacts other
than hand-to-head (hands on hips, on a table) follow the source's angles, so check them on a still. The user's own imports
are not QA'd (no `quality`): look at them on a still on both bodies before a whole video uses them.

## What the figure does after the clip (automatic, deterministic)

Every `apply()` (act / play / sequence / walkAt) poses the clip, then, as a pure function of that pose (the same clip at
the same time is bit-identical, whatever played before; checked twice per clip):

1. **Grounding** by what the clip does (`f.clipInfo(n).ground`): `feet` the lowest sole on the floor at every time;
   `body` (lie, floor sit, falls, crawl, push-ups, rolls, slides, kneel) the lowest point of the whole body on the floor;
   `seat` (chair sit, typing, driving) the soles on the floor, and `{ seat: y }` / `sitOn` put the clip's own thigh
   underside on the seat; `air` (jumps, climbs) the lowest sole over the whole clip.
2. **Feet that stay put**: where a foot touches the floor it is held (leg IK) until it lifts; walks hold the stance foot on
   a line moving back at the clip's speed (= `f.speed`, what walkAt / sequence travel at). Fights are left alone.
3. **Seated**: resting feet go onto the floor by the knee alone (toes point down if the shin cannot reach), and after
   `sitOn` with a backrest the spine leans back to it (at most 30 deg; the hands stay where the clip put them).
4. **No arm inside the body**: hands, forearms and upper arms that sank into the torso, head, legs or the other arm are
   moved out (the volumes are each bone's drawn mesh). Turn off per figure with `figure(role, { unclip: false })`.
5. Then held props (`lib/hands.js` hold(), `f.handTo`), then `f.onApply(fn)` callbacks `fn(t, f)`.

`f.noAutoPhone = true` (or act option `{ phone: false }`) stops the phone clips from adding their own phone. `apply()`
with nothing queued keeps the last pose (never the bind pose).

## Failures and fixes (the animqa pass, 2026-10-16)

Every catalog clip on both bodies, measured over its whole length at 15 fps (pops at 30 fps): self-intersection of the
drawn mesh (hands / forearms / upper arms / legs vs star-shaped volumes of each bone's own mesh), soles vs the floor,
planted-foot sliding (in place and under walkAt), twists, knees bending backwards, pops and loop seams, limb directions vs
the clip on its source skeleton, determinism; plus contact sheets (start / quarter / half / three-quarter / end, front and
side). Harness: `experiments/recon-style/src/stories/animqa` (`run.mjs all`, `grade.mjs`; regress: `drive.mjs animqa`).

| What we saw | Cause | Fix |
| --- | --- | --- |
| Hands 1-3 cm in the thighs standing, 5 cm in the knees seated, folded arms 7 cm in the chest, hands 13 cm in the head (hands on head, facepalm), upper arms 3 cm in the chest (point, pistol, typing) | the clips were made on the slimmer UAL mannequin; both bodies are wider | figures.js NO CLIPPING: arms pushed out of the body volumes after every clip (weighted push, left arm gives way arm-to-arm, hands above the head may hold each other) |
| KayKit lie / floor-sit clips 17 cm into the floor, then floating 40 cm, ending with a 120 deg snap back to standing | they were grounded as "seated" (no lift) and their last key is the rest pose | `body` grounding (lowest point of the whole body); `cleanClip` cuts a snapping last key |
| KayKit chair clips floating 50 cm, the female's feet 15 cm off the floor on every chair, 9 cm off the backrest | KK chair clips keep the pelvis at standing height; sitOn counted the calf behind the knee as "thigh on seat" (the female hovered 11 cm) | `seat` grounding on the soles + per-clip seat height; sitOn's contact = first 60 % of the thigh; seated feet onto the floor by the knee; lean to the backrest |
| One-shots floating up to 12 cm where their feet were higher than at the lowest moment | one-shots took the lift of their lowest moment for the whole clip | per-time grounding for every clip except jumps / climbs |
| Feet sliding 10-160 cm in KayKit one-shots (pick-up 32 cm, hit 23 cm, sit-chair stand-up 40 cm) | the source clips slide (same numbers on the source skeleton) | foot hold: contact runs pinned at their median ankle position by leg IK |
| Sneak / zombie walk / crouch walk / walk backwards sliding 0.5-1.3 m under walkAt; walking backwards faced forward | speed from the foot bone; root motion left in the KK hips track (snaps back at the seam); backward travel read as 0.2 m/s | speed from the contact patch / the held stance line; the hips' straight-line drift removed in place; `_back` clips face away from the travel |
| 3-4 cm hitch at the loop seam (typing standing, clap, thrust prop) | last key off the first | `cleanClip` blends a loop's last quarter onto its start |
| `Yes`, `KK_Wave`, `KK_Cheer` played once and froze | the catalog's loop flag was ignored for names without `_Loop` | the catalog decides loop |
| f.palm centre 37 mm toward the wrist (male) | the wrist ball was averaged in | palm-side vertices between 35-80 % of wrist-to-knuckle |
| (charstress v18) Seated soles 8-26 mm in the floor (male) / 40-56 mm above it (female), depending on where the figure stood before | the planted-feet table was sampled with a stale world matrix the first time a clip played after sitOn moved the figure (a "1 m slide": no resting feet, no floor fix) | world matrix refreshed before sampling: 0.8-1.1 mm on every seat, both bodies |
| A seated talker's head jumped 19 cm in 1/60 s | the backrest lean was all (30 deg) or nothing | the lean the back needs, faded out between 30 and 42 deg needed |
| Walk -> stand crossfade: soles 49-51 mm in the floor | weighted grounding of the two clips | the blended pose's own lowest sole on the floor (crossfades of standing / walking clips) |
| Sitting_Enter / Sitting_Exit at the seated spot: standing inside the chair, a 19 cm head jump into the seated loop | the clips start standing where the seated pelvis ends | `f.sitDown / f.standUp / f.standSpot` after sitOn (references/characters.md) |
| A landing foot jumped 16-20 cm during a sit-down | the knee-only floor fix has two solutions near a vertical shin | a foot in the floor rises by opening the knee; sit-down / stand-up keep their own soles |

Open (v18): two unclip hand pops remain - Walk_Loop at 0.68 s (2.6 cm in 1/60 s) and G_Point_Forward (3.8 cm): the body
volumes are 2 cm slices (a staircase along each bone), a hand crossing a slice boundary sees its depth step. Interpolating
the slices removed both but moved the folded-arms / hands-on-head corrections past animqa's baseline (a 10 cm loop-seam
pop on Idle_FoldArms_Loop): re-baseline animqa together with that change.

Not fixed (marked broken, never offered): sword / melee fights (lunges slide 20-110 cm, forearm twists 120-150 deg, legs
through each other in combos), rolls and slides (body 2-4 cm in the floor, the source slides), the KayKit sneak and
walk-backwards loops and the zombie walk (their stance foot surges 15-70 cm against any steady travel), Hit_Knockback,
Farm_PlantSeed (kneels 2-6 cm into the floor), NinjaJump_Start. Broken on one body only (offered for the other):
Shield_Dash and Sword_Dash on the male; Crouch_Fwd_Loop and G_Facepalm on the female (her hand ends above the face once
it is pushed out of the head). Measured but not judged: elbow bend direction (the clips redistribute upper-arm twist, so a
fixed hinge reference lies).

## Quality of every built-in clip

The full table (verdict per body, notes) is `assets/anims/quality.json` in the engine (merged into `builtin.json`, which
the catalog serves: every entry has `quality`, `qualityBy` when the bodies differ, and `notes` when not verified). Use
only these. A clip broken on ONE body is `ok` with "BROKEN" for that body in its note: that body plays `Idle_Loop`
instead, so give that role the other body or another clip.

**verified (71)**: Crouch_Idle_Loop, Dance_Loop, Driving_Loop, Hit_Chest, Hit_Head, Idle_Loop, Idle_Talking_Loop, Idle_Torch_Loop,
Interact, Jump_Land, Jump_Loop, Jump_Start, PickUp_Table, Pistol_Aim_Down, Pistol_Aim_Neutral, Punch_Cross,
Sitting_Enter, Sitting_Idle_Loop, Sitting_Talking_Loop, Spell_Simple_Enter, Spell_Simple_Exit, Spell_Simple_Shoot,
Swim_Idle_Loop, Sword_Idle, Chest_Open, ClimbUp_1m, Consume, Idle_Lantern_Loop, Idle_No_Loop, Idle_Shield_Break,
Idle_Shield_Loop, Idle_TalkingPhone_Loop, LayToIdle, NinjaJump_Idle_Loop, NinjaJump_Land, OverhandThrow,
Shield_OneShot, Sword_Block, Walk_Carry_Loop, Yes, Zombie_Idle_Loop, G_Point_Side, G_Shrug, G_Typing_Seated_Loop,
G_Hold_Up_Overhead, G_Hold_Up_Overhead_Loop, KK_Fall_Death_B, KK_Hit_A, KK_Interact, KK_PickUp, KK_Use_Item, KK_Cheer,
KK_Lie_Idle_Loop, KK_Lie_StandUp, KK_PushUps_Loop, KK_Sit_Chair_Idle_Loop, KK_Sit_Chair_StandUp, KK_Sit_Floor_Down,
KK_Sit_Floor_Idle_Loop, KK_Sit_Floor_StandUp, KK_SitUps_Loop, KK_Wave, KK_Hammering_Loop, KK_Hold_A_Loop,
KK_Hold_B_Loop, KK_Hold_C_Loop, KK_Lockpicking_Loop, KK_Working_A, KK_Working_B, KK_Working_C, KK_Dodge_Backward

**ok (41, minor: read the note)**:

| Clip | Note |
| --- | --- |
| Crouch_Fwd_Loop | female: BROKEN (not played on this body); male: walk foot slide 4.5 cm; female: walk foot slide 8.5 cm |
| Death01 | collapses and lies flat on its back; a foot whips at the impact (one frame) |
| Fixing_Kneeling | kneels on one knee and works low; the right upper arm brushes the chest (1 cm) and the left hand settles 13 cm once at 2.1 s |
| Jog_Fwd_Loop | fast legs: the stride kicks a little at the loop seam; the flight phase is kept on the floor |
| Pistol_Aim_Up | two-hand grip: the support hand sinks into the gun hand (a held gun covers it) |
| Pistol_Idle_Loop | male: pop 5.1 cm hand_l |
| Pistol_Reload | two-hand grip: the support hand sinks into the gun hand (a held gun covers it) |
| Pistol_Shoot | male: pop 5.8 cm hand_l; female: pop 4.3 cm hand_l |
| Punch_Jab | a fast jab: the fist travels 35-38 cm in one 1/30 s frame (that is the punch, not a snap) |
| Push_Loop | it walks while pushing: move the figure with walkAt / a sequence walk step (clip Push_Loop); played in place the male feet slide |
| Sitting_Exit | male: twist hand_l 100 deg |
| Spell_Simple_Idle_Loop | male: pop 3.6 cm calf_r |
| Sprint_Loop | fast legs: the stride kicks a little at the loop seam; the flight phase is kept on the floor |
| Swim_Fwd_Loop | water scenes: the lowest point of the body rests on the figure's y: place it under the water line |
| Walk_Formal_Loop | male: walk foot slide 3.6 cm |
| Walk_Loop | male: walk foot slide 3.9 cm |
| Farm_Harvest | male: clip arm-torso 9.2 mm (uarm_r>spine_02); male: twist calf_r 54 deg; female: twist calf_r 56.5 deg |
| Farm_Watering | male: clip arm-torso 12.6 mm (uarm_r>spine_02) |
| Idle_FoldArms_Loop | folded arms: the hands tuck under the other arm and against the chest (contact by design, 1-5 cm) |
| Idle_Rail_Call | male: clip arm-torso 11.9 mm (uarm_r>spine_02); male: twist lowerarm_r 123.4 deg; male: twist calf_r 53.6 deg; female: twist lowerarm_r 124 deg |
| Idle_Rail_Loop | male: twist calf_r 53.6 deg; female: twist calf_r 54 deg |
| Shield_Dash | male: BROKEN (not played on this body); male: foot slide 59.6 cm; female: foot slide 4.8 cm |
| Slide_Loop | female: under floor 8.1 mm |
| Sword_Dash | male: BROKEN (not played on this body); male: clip arm-arm 37.1 mm (hand_r>upperarm_l); male: floating 27.5 mm; male: foot slide 16.9 cm; male: twist calf_r 51.8 deg |
| TreeChopping_Loop | male: twist lowerarm_r 129.2 deg; female: twist lowerarm_r 129.9 deg |
| Zombie_Scratch | male: twist calf_r 52.8 deg; female: clip arm-legs 8.7 mm (hand_l>calf_l); female: twist calf_r 54.5 deg |
| G_Point_Forward | male: pop 4.8 cm hand_r |
| G_Facepalm | female: BROKEN (not played on this body); female: clip arm-head 14.7 mm (farm_r>Head); female: pop 10.3 cm hand_r |
| G_Hands_On_Head | female: the hands rest on top of the head with the fingers laced (they overlap by design; one 11 cm hand settle at 1.2 s) |
| G_Hands_On_Head_Loop | female: the hands rest on top of the head with the fingers laced (they overlap by design; one 11 cm hand settle at 1.2 s) |
| G_Typing_Standing_Loop | male: clip arm-torso 8.9 mm (uarm_r>spine_02); male: pop 3.9 cm hand_r; female: retarget hand_l 14.9 deg |
| G_Thrust_Prop_Loop | male: pop 6.5 cm hand_r |
| G_Clap_Loop | female: the hands overlap up to 4 cm at the clap |
| KK_Fall_Death_A | falls stiffly backwards and ends propped on the elbows; the heels dip 1.4 cm into the floor for one frame early on |
| KK_Hit_B | male: pop 5.1 cm lowerarm_r; female: pop 3.9 cm lowerarm_r |
| KK_Throw | male: foot slide 3.8 cm; female: foot slide 3.3 cm |
| KK_Lie_Down | lies down on its side; lying, one foot rests on the other |
| KK_Sit_Chair_Down | male: floating 18.8 mm; female: floating 15 mm; female: foot slide 4.9 cm |
| KK_Digging_Loop | in place: the feet shuffle with each shovel swing; female: a hand snaps 15 cm at the loop start |
| KK_Sawing_Loop | male: foot slide 3 cm; female: foot slide 3.1 cm |
| KK_Crawl_Loop | crawls on hands and knees; the knees sink up to 1.6 cm into the floor |

**broken (19, never offered)**: Roll, Sword_Attack, Farm_PlantSeed, Hit_Knockback, Melee_Hook, Melee_Hook_Rec, NinjaJump_Start, Slide_Exit,
Slide_Start, Sword_Heavy_Combo, Sword_Regular_A, Sword_Regular_A_Rec, Sword_Regular_B, Sword_Regular_B_Rec,
Sword_Regular_C, Sword_Regular_Combo, Zombie_Walk_Fwd_Loop, KK_Sneak_Loop, KK_Walk_Backwards_Loop.
For sneaking, pushing, crawling or walking backwards: a Mixamo import (see above), checked on a still.

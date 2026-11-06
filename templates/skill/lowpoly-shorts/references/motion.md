# Motion: library clips only

Every human body (char.base_m_* / base_f_* / mannequin_*) shares the skeleton 'ue5-mannequin-65', and every clip below plays
on every body. The engine fits each clip to the body with the library's prepareClip (pelvis height scaled to the legs:
feet stay on the floor). Never animate bones by hand, never move a walking person by hand.

## The clips (L = loops)
- ual1: Idle_Loop L (default), Idle_Talking_Loop L (talk gestures), Walk_Loop L, Walk_Formal_Loop L, Jog_Fwd_Loop L, Sprint_Loop L,
  Crouch_Idle_Loop L, Crouch_Fwd_Loop L, Sitting_Enter, Sitting_Idle_Loop L, Sitting_Talking_Loop L, Sitting_Exit, Interact (press /
  reach), PickUp_Table, Push_Loop L, Driving_Loop L, Fixing_Kneeling, Hit_Chest, Hit_Head, Death01, Jump_Start, Jump_Loop L, Jump_Land,
  Roll, Punch_Jab, Punch_Cross, Dance_Loop L, Swim_Idle_Loop L, Swim_Fwd_Loop L, Idle_Torch_Loop L, Pistol_* , Sword_*, Spell_Simple_*, A_TPose
- ual2: Idle_TalkingPhone_Loop L (phone call), Idle_FoldArms_Loop L, Idle_No_Loop L, Yes, Walk_Carry_Loop L (carry a box), Consume
  (eat / drink), OverhandThrow, Chest_Open, ClimbUp_1m, Hit_Knockback (knocked flat), LayToIdle (get up), Farm_*, TreeChopping_Loop L,
  Zombie_Idle_Loop L, Zombie_Walk_Fwd_Loop L, Zombie_Scratch, Slide_*, NinjaJump_*, Idle_Lantern_Loop, Idle_Rail_*, Shield_*, Melee_*
- kaykit_ue: KK_Wave L, KK_Cheer L, KK_Fall_Death_A (0.8 s), KK_Fall_Death_B (2.6 s), KK_Hit_A / B, KK_PickUp (from the floor),
  KK_Throw, KK_Use_Item, KK_Interact, KK_Lie_Down, KK_Lie_Idle_Loop L, KK_Lie_StandUp, KK_Sit_Chair_Down / Idle_Loop / StandUp,
  KK_Sit_Floor_Down / Idle_Loop / StandUp, KK_PushUps_Loop, KK_SitUps_Loop, KK_Crawl_Loop, KK_Sneak_Loop, KK_Walk_Backwards_Loop,
  KK_Dodge_Backward, KK_Hammering_Loop, KK_Digging_Loop, KK_Sawing_Loop, KK_Lockpicking_Loop, KK_Hold_A/B/C_Loop, KK_Working_A/B/C
- gestures: G_Point_Forward, G_Point_Side, G_Shrug, G_Facepalm, G_Hands_On_Head, G_Hands_On_Head_Loop L, G_Typing_Standing_Loop L
  (hands at 1.03 m), G_Typing_Seated_Loop L (keyboard 0.78 m, seat 0.45 m), G_Hold_Up_Overhead, G_Hold_Up_Overhead_Loop L,
  G_Thrust_Prop_Loop L (a prop thrust at the lens, 2 Hz shake), G_Clap_Loop L. Non-loop gestures start and end on Idle_Loop.

What to use: idle Idle_Loop · talk Idle_Talking_Loop · walk walk() · run run() · sit sit() · type G_Typing_* · press buttons
Interact · point G_Point_* · shrug G_Shrug · wave KK_Wave · facepalm G_Facepalm · phone Idle_TalkingPhone_Loop · show something
G_Hold_Up_Overhead · carry Walk_Carry_Loop · cheer KK_Cheer · despair G_Hands_On_Head · fall / faint Hit_Knockback,
KK_Fall_Death_A/B, Death01 · get up LayToIdle, KK_Lie_StandUp · pick up PickUp_Table / KK_PickUp · arms crossed Idle_FoldArms_Loop ·
yes / no Yes / Idle_No_Loop · eat / drink Consume.

## Walking without foot sliding
- `walk([[x, z], ...], { at, pace })`: the engine measures the clip's own ground speed on THIS body (planted foot speed) and moves
  the person at exactly that speed x pace. Change `pace` (step rate: 1.25 ~ 2 steps/s, the analysed walk), never the distance per
  time by hand. The person turns along the path (corners eased) and ends in Idle_Loop.
- Walks shorter than one step look wrong: at least ~1.2 m. A walk across a shot: start it at S.t0 so frame 0 already moves.
- Stairs / slopes: not supported by walk(); keep walks on flat floors.
- check_layout measures the planted foot (slides over 5 cm are flagged).

## Hands, gestures, props
- `hold(obj, { hand: 'r', grip })`: the prop is attached to the hand bone (palm centre, fingers +z). grip 'palm' (resting on the
  palm), 'grip' (a handle: bottle, axe, torch, gavel), 'phone' / 'card' (flat, held up), 'tray'. Fine-tune with offset / rot
  (metres / radians in the palm frame) and LOOK at a close-up: the prop must touch the hand (check_layout 'hand').
- Pair the grip with a clip whose hand is where the prop should be: phone at the ear Idle_TalkingPhone_Loop, card / document
  up G_Hold_Up_Overhead or G_Thrust_Prop_Loop, box Walk_Carry_Loop, typing G_Typing_*.
- Picking something up: KK_PickUp (floor) / PickUp_Table, then hold(obj, { at: pickTime + 0.5 }) and hide the resting copy then.

## Sitting
`sit(chair, { at, enter })` or `sit({ pos: [x, seatTop, z], ry })`: the seat top is ~0.45 m in the clips (Sitting_* and KK_Sit_Chair_*);
the person is placed so the hips rest on it. ry = the way the person faces. Desk work: Sitting_Idle_Loop / G_Typing_Seated_Loop.

## Faces and looks
`expr('shocked', at)` on the word; `lookAt(target, at, { until })` turns head + neck (clamped) with an ease. Change expressions
on the words that carry the feeling, not on a timer.

## Animals
`S.animal('cow', { clip: 'Walk' })` - each animal has its own clips (names in the library search result: Walk, Gallop, Idle,
Eating, Death, Attack...). walk() works for them too (speed from the clip name). Old farm pigs / sheep / pugs / llamas only idle.

# Quality gates (every shot, frame by frame)

A shot is done only when it passes every gate below. The checks find what a machine can measure; the frame review finds
the rest. Look at the frames yourself: a clean check is necessary, never sufficient.

## 0. Order

1. **check_preview**: the project loads, no errors, every shot's words are found in the timeline.
2. **check_layout until it is clean** (§1).
3. **Still gate** (§2): `render_frames` on every shot, at its start, middle and end, and at every stressed word.
4. **Motion gate** (§3): 6 consecutive frames (1/30 s apart) at every gesture, walk, fall, swap, prop event and
   transition.
5. **Timing gate** (§4): events against the word timings.
6. **Transition gate** (§5) and **look gate** (§6).
7. Fix, then look again at ONLY what changed. If something is still wrong after two fixes, note it in the storyboard
   and move on.

## 1. check_layout findings

| finding | means | fix |
|---|---|---|
| caption | a face is in the caption band (66-76 % of the height) | reframe: raise the camera target, push in so the head sits higher, or move the character back; never move the captions |
| offscreen | the character the shot is about is out of frame, or its head is cut in a close shot | reframe; check the whole shot, not one frame (the creep can drift a head out) |
| backface | the camera sees the back of the subject's head in a close framing | turn the character toward the camera, or move the camera around; only a deliberate push into the back of a head is allowed |
| through | two characters, or a character and a prop, are inside each other | space them (at least a body width apart), move the prop, change the pose |
| floating | a character's feet are above the ground with nothing under them | put them on the floor or on the seat; hops and jumps are exempt only while they last |
| dark | the frame is too dark to read | add a practical light near the subject, raise the key, or use a lighter rig for that beat |
| empty | most of the frame is one flat colour | dress the set (§2.3), add a foreground element, or reframe onto the dressed part |

## 2. Still gate (ask this of every still)

### 2.1 Story
- Does the picture show THIS clause literally? Would someone with the sound off get it?
- Is the stressed word's event visible (the prop popped, the counter landed, the face changed)?
- Is it clear who the shot is about? Is the subject big enough (a face carrying an expression should be at least ~8 %
  of the frame width; a subtle expression needs ~15 %)?

### 2.2 Faces
- The subject's face is visible, facing the camera or in 3/4, above the caption band.
- The expression matches the line (deadpan on dry lines, rings on surprise, chevrons on pain).
- The face sits ON the head: features slide toward the side the head turns, never float flat in front of it, never
  stretch past the sphere's edge.
- No mouth moves with the narration.
- Background characters are calm and still: they don't upstage the subject.

### 2.3 Set and dressing
- At least ~12 distinct props in an interior; three depth layers (a blurred foreground element, the subject, a soft
  background); no bare floor or wall over a third of the frame.
- At least 2 practical lights, and they glow.
- Props rest on something (floor, table, shelf, wall); nothing hovers; nothing is sunk into a surface.
- Signs and labels are legible and original; no real brand, logo or person.

### 2.4 Look
- Every solid object has its ink outline; character lines are neither hairline-thin nor fat rings in close-ups.
- Colours are saturated but not neon; the hero contrasts with the set.
- Depth of field: CU / MCU background soft, the subject's eyes sharp; wides mostly sharp.
- No blown-out white (a lamp's glow is fine, a white table top is not); no flicker or stripes where two surfaces
  overlap (a rug on a floor, a poster on a wall: lift one by a centimetre).

## 3. Motion gate (consecutive frames)

- **The camera moves** between the first and last frame of every shot. Count the full stops in the whole short: at most
  2, each under a second, each one planned.
- **Arrivals and exits:** the camera is already moving on the first frames after a dissolve and is speeding up on the
  last frames before the next one. A camera that parks right before a transition is a fault.
- **Holds are frozen:** a held character does not drift, breathe or jitter (except an emotion overlay that the face
  shows: anger tremble, hunger squirm).
- **Gestures:** a gesture takes 2-6 frames and then holds; no arm stuck halfway between two poses during a hold; no
  limb passing through the body, the head, a table or another character.
- **Hands and props:** the hand touches what it holds in every frame; a prop that appears in a hand appears in one
  frame on its word, not mid-air nearby.
- **Feet:** planted feet don't slide during walks; feet are on the ground (or the seat) at every contact frame.
- **Airborne things** follow an arc (up slowing, down speeding up) and spin; they leave the frame or land, they never
  vanish in the air.
- **Face swaps** are instant (with at most a closed-eye or squint frame between), never a morph; blinks are 2-4 frames.
  No blink on rings, terror, startled, dead or asleep eyes, or on background characters.
- **Walks:** the body bobs (low just after each contact); stops ease out over 5-7 frames, no skid.
- **Near-lens objects:** anything passing the lens fades out instead of being cut open by the near plane.

## 4. Timing gate (against the word timings)

| event | where it must land |
|---|---|
| a new shot (transition start) | 0-3 frames before the first word of its sentence |
| the subject's face swap | fully on 2 frames before the stressed word (0-6 before is fine, never more than 3 after) |
| a startle | 4-6 frames after the impact it reacts to |
| a gesture | complete 2-5 frames before its stressed word |
| a number's prop event (counter landing, light, placed object) | on the number's word |
| a concrete noun's picture | within 0-10 frames of the word |
| a camera move | starts within ±3 frames of its trigger word; a gag punch ends ON the gag frame |
| captions | engine-timed (3 frames early): check they never cover a face and never show an empty frame |
| the last word | ends ~0.25 s before the final frame; nothing after it but a tiny button |

Also: the hook pays off by ~2-3 s; no stretch over 1.5 s without a visible change; a new face on the subject about
every 1.2 s.

## 5. Transition gate

- Dissolves are 4-8 frames (up to 11 for a slow change), with both shots moving.
- Every hard cut is one of the five allowed cases (match on action, the same prop in both shots, the end of a rush from
  outside to inside or out of a zoom-through hole, under a flash, one quick action jump in the same set). A plain cut
  between unrelated shots is a fault.
- Whip pans stay within one set.
- Match dissolves line up: the incoming feature sits on the outgoing one (same spot, similar size).
- Fly-throughs: the door / panel / pupil is open before the camera reaches it; nothing pops in front of the lens.

## 6. Look gate (the whole short)

- One consistent outline colour and weight across shots; one light logic per scene; grade shifts happen on their words.
- HUD-style screens appear only as their own insert shots, never pasted over a character shot; at most one 2D label
  with a leader line in the whole short.
- No grain or colour fringing you can see at phone size.
- Sound (if you mixed it): the voice is clear, the music sits far under it with no ducking, every effect belongs to
  something on screen, no silence anywhere.

## 7. Failure patterns

| what you see | why it happens | fix |
|---|---|---|
| an empty-looking frame (a bare wall, a big plain floor, a lonely character) | the set was dressed for the wide but the shot is a close-up, or the camera turned toward an undressed side | dress what the camera sees in THIS shot; add a foreground element; reframe |
| a face behind the captions | the character was framed at eye level in a wide, or the creep pushed the head down into the band | frame the head higher (eyes at 25-45 % of the height); check the last frame of the creep |
| a floating prop or person | placed at a guessed height, or a scaled rug / seat changed the surface height | put it on the real surface top; re-check after any scaling |
| a frozen camera | the shot has no move, or a move ended long before the shot did | add the creep; end the shot on an accelerating push into the transition |
| a camera parked before a dissolve | the last move eased to zero early | move the push so its peak speed falls on the dissolve's middle frame |
| limbs stuck in mid-air | a gesture started but the hold took the in-between pose, or two gestures overlap | finish every gesture in 2-6 frames and hold the end pose; don't start a new one until the last one landed |
| an arm through the body or a table | a reach target behind the body or below a surface | move the target, turn the character, or use the hinge (elbow) form for that pose |
| a hand beside, not on, the prop | the prop was placed in the world instead of in the hand | attach the prop to the hand |
| a late face | the swap was keyed to the word's end, or to the clause start instead of the stressed word | key it to the stressed word's start minus ~2 frames |
| a number that changes off its word | the counter's duration doesn't end on the word | end the roll exactly on the word's start |
| a scene change in the middle of a sentence | shots split by duration, not by sentence | start shots on sentence starts; use beats inside the shot for clauses |
| breathing / swaying characters | an idle loop or noise was added | remove it: holds are frozen in this style |
| a face that morphs or melts between expressions | an interpolated face | swap instantly, through a closed-eye frame |
| a face floating in front of the head, or sliding off it | wrong projection or a billboard | the face must be painted on the sphere and turn with it |
| a blinking terrified character | the blink scheduler ran on a terror face | no blinks on rings, terror, startled, dead or asleep eyes |
| an unreadable tiny face carrying the joke | the subject is too far away | push in, or use a stronger shape (rings, tooth grid) |
| the back of the head in a close shot | the character faces the set, not the camera | turn the body; move the camera around |
| a hard cut that jars | a plain cut between shots | dissolve, or make it one of the five allowed cuts |
| a HUD panel over the hero | an overlay used for a fact | turn the fact into a prop, or give the screen view its own insert shot |
| a mouth moving with the narrator | lip-sync applied to the hero | remove it; only an on-screen speaker of a quoted line moves the mouth |
| unreadable signs | text too small or low contrast | fewer words (≤ 4), bigger letters, a light board with dark text |
| flicker or stripes where two surfaces meet | two coplanar surfaces | lift one by ~1 cm |
| a white blob of light | a lamp hotspot on a pale surface, or too much bloom | lower the light's intensity or the surface's brightness |
| a prop appearing or vanishing for no reason | no cause given | pop it in on its word, let it leave the frame, or hide it behind an effect |
| dead air, or music fighting the voice | pauses not tightened, music too loud | pauses ≤ 0.3 s; music ~18 LU under the voice, constant |

## 8. Done means

- check_layout is clean, or every remaining finding is a deliberate choice written in the storyboard.
- Every shot passed the still, motion and timing gates by eye.
- The short loops (or bookends) and the last word ends just before the last frame.
- Nothing in it copies a real brand, a real person, or another creator's characters, sets or jokes.

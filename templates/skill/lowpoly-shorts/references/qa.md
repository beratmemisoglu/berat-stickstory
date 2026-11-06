# Quality standard (the gate every shot passes)

The whole procedure, step by step with gates, is references/sop.md. This page is what the checks measure and how to fix
each finding.

## 1. check_preview
No load errors, no "say miss", no cue misses, no "asset ... not loaded" (write ids as plain strings).

## 2. check_layout until it says Clean
It measures steady frames of every shot (pass `times` to look at specific moments: for a moving shot pass 5 per second,
e.g. every 0.2 s from the shot's start to its end). Each finding names the element and file:line. What each one means:
- through: a body part inside a solid (capsules sampled on their surface, hands to the fingertips, the head), a flying
  prop (userData.airborne) passing through a person, or a held prop through its holder's own leg / body. Fix: move the
  person or the object, use the set's spots, sit() on a seat, change the clip, hold the prop further out.
  On its own seat only the hips, back and thighs may touch it: shins inside a crate or through a chair back still count
  (a chair that faces away from the table puts the legs through its back: turn the chair).
- bodies: two people overlapping (> 5 cm). Space them >= 0.6 m, or mark a hug / handshake root.userData.touch = true.
- feet: floating (> 5 cm) or sunk (> 4.5 cm) during a standing / walking clip (relative to the person's own y), or the
  planted foot sliding (> 3.5 cm) on a walk. Runs and sprints may leave the ground up to 20 cm (flight phase).
- support: the feet against what is REALLY under them: floating above it, sunk into it (a rug scaled up uniformly becomes
  18 cm thick: scale rugs with width AND a fixed small height), or standing on top of furniture. Fix: a.at(x, surfaceY, z);
  mark a box / prop userData.standOn = true when standing on it is the picture (a stage, a car roof).
- seat: a seated person hovering (> 7 cm) above or sunk into the seat under the pelvis and thighs. Fix: sit(chairObject)
  (it finds the seat), or the real seat top in sit({ pos }).
- self: a hand / forearm deep inside the own torso, or a hand inside the head (a clip that crosses through the body).
  Fix: another clip. (Shallow folded-arm contact is not flagged; look at close-ups yourself.)
- hand: a held prop more than 3.5 cm from the palm. Fix: hold() with a grip that fits; no offset away from the palm.
- floating: a prop resting on nothing (every checked frame: a prop that moves can end in the air). Something that flies:
  obj.userData.airborne = true.
- sunk: a prop sunk into the ground (> 3 cm). Mark userData.sunkOk = true only when it is buried on purpose.
- scale: a library prop at more than 2.2x or under 0.45x its real size (the library's size_m). Use its own size, or mark
  userData.scaleOk = true when the odd size IS the joke.
- camera: inside or grazing geometry, inside a person (use cam 'pov' with from: that person instead), or a surface filling
  40% of the frame from under 30 cm (the near clip cuts it open). An intended macro shot of a prop: shot({ macro: true, ... }).
- ceiling: a body above the room's ceiling or behind its back / side walls.
- subject: off frame, under 10% of the frame height (S.wide = true if a tiny subject IS the picture), head more than 45% out.
- covered: callouts / panels on each other, on the caption, in the caption band (the next caption lands there), or on
  more than 20% of a face.
- offframe: a callout / panel cut by the frame edge. Shorter text, a smaller size, or move it in.
- small: text under 26 px tall on a 1080 frame (unreadable on a phone). Captions are ~46 px.
- coplanar: two surfaces in the same plane facing the same way (a rug on a floor, a poster on a wall): lift / move one 1 cm.
- thin: geometry thinner than one render pixel but long on screen (a wire, a far pole): it shimmers. Thicker, closer, or gone.
- look: a head turn beyond ~80 degrees (the neck stops at ~70: the face looks past the target). Turn the body: a.face(target).
- edge: the end of the world in view (nothing under the horizon). A bigger ground / set piece there, fog, or another angle (shot({ edgeOk: true }) when the edge IS the picture).
- worn: hair / hat / glasses cutting into the face (measured once when put on).
Never silence a check with a flag that switches more off than the problem: root.userData.airborne on a person switches off
EVERY check for that person (a lying person is already exempt from the feet checks: KK_Lie / Lay / Sit clips).

## 3. The close-up gate (every new element)
Any new model you build or add is looked at alone, big, before it goes into shots: a temporary shot with S.camera('insert' or
'orbit', { on: it }) + render_frames at scale 1. Facing the right way (+z front), right size next to a person (1.8 m), parts
attached (legs on the table top, a sign on its pole), no holes or missing faces, materials not black / not glowing by mistake.

## 4. The frame-by-frame review
render_frames over every shot (8 per call, scale 0.5) and ask for each frame:
- Does it show THIS clause, literally? Would a viewer get it with the sound off?
- Is the subject big, lit (Moody: on its key light, never a silhouette) and in focus of the composition (rule of thirds,
  headroom, nothing important in the bottom 20% under the caption)?
- Foreground / midground / background present? (props, set dressing, extras) No big empty floor or wall.
- People: right clip for the words, expression, looking at something, feet planted, hands on their props.
- Callout / UI readable, on its object, not over a face or the hair, one at a time, not cut by the edge.
- The camera moves (compare the start and end frames of the shot).
- Exposure: no white-out (a lamp hotspot on a table, a white sheet, a window), no flash on every lightning bolt.
Motion: 3 frames 0.1 s apart on every walk, gesture, fall, hand-over and fast camera move.
What the check can NOT see (look for these yourself): a prop held in the hand but in the wrong place (a briefcase at the
head), a wrong pose (a sitting clip turned onto its back = legs in the air), a head turned too far by the clip itself,
folded arms sinking into each other, labels sitting on the hair, colours that clash with the look, counts that don't match
the words, repeated shots.

## 5. The look matches the references
Bright: bright and saturated, soft, small yellow captions. Moody: dark with a warm key, glows, heavy edge halos and fringes,
white captions. Not muddy, not blown out (a lamp's glow is fine, a white table top is not).

Fix, then look again ONLY at what changed (at most twice per fix; still wrong: note it in storyboard.md and move on).

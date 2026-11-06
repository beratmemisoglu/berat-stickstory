# Pitfalls: what went wrong while this style was built (V1 -> V4), and the reviewer's own notes

## Reviewer's notes (each one became a rule; don't make them again)
- "Harsh transition, the previous scene just disappears" -> every cut is a transition (default dissolve).
- "The face just jumps to the next version of it" -> `expr()` + eased look/head turns; never `t > X ? A : B` on a face.
- "Dopamine circles appear out of thin air and overlap the head" -> things that come FROM an object are built before
  it (behind it) and start hidden behind it. Layer order is a decision: comment it per scene.
- "It leaks where there's no gap / no fluid" -> physics: a visible hole below the fluid line, gravity, a puddle.
- "ZzZ jumps back to its first frame" -> seamless loops only (periodic functions, fade at the wrap).
- "That's not a hand at all" -> hands are designed elements (palm, fingers on one edge, thumb in front on the other).
- "The Y's just change colour" -> colour changes spread from their cause (grow a second-colour copy from the binding
  site); this applies to every colour change.
- "The jump is just frames switching" -> continuous weights: crouch -> stretch -> airborne -> squash -> settle,
  squash pivoting at the feet.
- "The pill shading is outside the pill" -> shading is cut from the outline (QUALITY_STANDARD).

## Self-review findings (V1 -> V3)
- Captions collided with content in 10 of 14 scenes -> the caption band rule.
- Two captions on one frame at every boundary -> handled by the engine now.
- Labels at 26-34 px were unreadable on a phone -> 40 px minimum.
- Everything in the top half of the frame -> use the whole column, centroid around +150.
- The character looked sad by default (down-sloped brows) -> friendly neutral face.
- 1-3 s holds with nothing moving -> secondary motion everywhere.
- A dopamine burst flying AWAY from the brain on "the brain uses dopamine" -> motion must say the narration.
- 30 identical particles raining = noise -> few, big, deliberate actors.
- A highlight ring left on the old node after the focus moved -> stale state.
- Translucent yellow halos over purple turned brown; a strong vignette turned orange corners brown -> opaque tints,
  vignette <= .16.
- Clock with both hands on 12 read as one hand -> 10:10.
- Raised arms crossed the face -> back arm behind the torso, named poses only.
- `mixPose` returns only the keys it mixed: spreading a partial pose into maths gave NaN and the head vanished ->
  always start from a full pose (`{ ...POSES.rest, ... }`) and check frames around every change.
- A `//` comment inside a one-line template swallowed the rest of the line -> use `/* */` in one-liners.

# QA: the bar every frame is checked against

The owner compares the result with the references frame by frame. Judge like a viewer with the sound off first (does the
picture tell the clause?), then with the words (does it land on them?). The gates that use this file: sop.md G2-G5.

## 1. check_layout (what it measures, and the fix)

| finding | means | fix |
|---|---|---|
| `offscreen` | the subject's head (the shot's `on`, or its only person) is out of frame | frame on it; `S.subject = a`; move the person |
| `cropped` | a close framing cuts the eyes at the top, or the face at a side | frame wider, `y: -.1`, centre the close-up |
| `covered` | a pill / label / HUD / title sits over the subject's face | move the overlay (`pos`, `corner`) or the camera's `x` |
| `through` | two people inside each other at the same depth, not touching | space them; split screens: different x per panel |
| `floating` | feet above the floor, not seated / lying / jumping | the spot's y, `sit` for seats, nothing under a standing person |
| `held` | a held prop more than 5 cm from the hand | hold OR place (not both); start actions at or after `S.t0` |
| `dark` | the frame's mean is too dark to read | a practical near the subject, another mood; deliberate: `dark: true` |
| `empty` | 70 %+ of the frame is one flat colour | dress what the camera sees, frame tighter; deliberate: `plain: true` |

It does NOT see: a face hidden behind a prop or the character's own raised arm, a person cut by a foreground card, wrong
expressions, a picture that does not match its clause, text that is misspelled, a stamp, a corner collision between two
HUD elements that do not cover a face, a carried person in an impossible place, a night set lit like day. Look at the
stills - and at 24 fps frames (sop.md G4) on every carry, drag, hug, sit and gesture: in video 01 the reach at every cut,
the slip landing after its word and the carried man shooting up out of his seat only showed in motion frames.

## 2. Stills (render_frames at the key words)

Every frame:
- **The clause is literally on screen**: its noun, its number, its person, its action. With the sound off you can say
  what the sentence is about.
- **The event of the stressed word has happened** by the word: the face changed, the number landed (count finished), the
  pill popped, the hand closed.
- **The subject reads**: the face of whoever the shot is about is in the framing table (style.md §2: a close-up head ~0.37
  of the picture, centred), lit, with the right expression, not under an overlay, not behind a prop or another person.
- **People are on model**: the same look as in every other shot (clothes colour, hair, accessories); the rim light in the
  place's colour; the body whole (no broken joints, no arm stuck in the torso, no foot through the floor, no seated person
  hovering over the seat); held props in the hand; hands touching what they touch.
- **The place is dressed and lit**: a real set at depth (wall, furniture, people's plane, an optional blurred foreground),
  practicals glowing, the mood matching the story time (night = blue / lamp-lit, never a bright day by mistake); close-ups
  show the same room blurred.
- **Graphics**: readable at the size shown, spelled right, invented names, the same HUD conventions as every other shot,
  one element per corner, held >= 1.5 s, inside the picture (not over the letterbox bars).
- **Nothing banned**: no stamps / verdict plaques, no AI-voice notice, no real brand.
- The letterbox bars are there (scope bars only in action stretches).

## 3. Motion (frames 1/24 s apart)

- Pose to pose: the move takes 2-6 frames, then a dead hold (a still frame repeated, or a drift too small to see).
- Walks: each planted foot stays put (no skating); the body bobs; the start eases in 5-6 frames, the stop 4-7 with a dip.
- Turns: one frame, not a tween.
- Hand-offs, hugs, handshakes: hands meet exactly; the prop jumps hands in 2 frames; nobody's arm passes through a body.
- Faces: swaps instant, on the word; blinks 3 frames; mouths only on dialogue.
- The camera: close-ups still; a nudge starts ~4 frames after the cut and stops before the next; no shake, no roll.
- Effects: on their word, short, restrained; a flash cut lands bright and decays in ~10 frames.

## 4. The whole video

- ~25 pictures a minute, no picture over ~5 s without a reason, the mix near storyboard.md §1.
- Neighbouring shots differ (place, framing or subject); a re-angle on the same moment is a deliberate dissolve.
- Continuity: the same person = the same look; the same place = the same set and mood inside one scene; a prop someone
  holds stays in that hand across the cut.
- The HUD counter runs and changes on its words; labels at every new place and time jump.
- Cuts in the pauses (2-6 frames before the phrase), never in the middle of a word.
- The hook shows the condition by 15 s; the title by ~30 s; the end card carries the question.

## 5. Failure patterns to look for

- A talking head with nothing else: a dialogue run with no reaction cuts and no inserts.
- A held graphic with nothing building (a static chart for 8 s): add the count, the labels on their words, a tour.
- Everyone moving at once; idles in sync; a person frozen in one pose for a whole long shot while the clause asks for an
  action.
- A seated person whose sit-down plays on screen (the references cut in seated).
- A narrated line lip-synced by the hero.
- The camera creeping on a close-up; a nudge that runs into the cut.
- A wide that misses the people the clause is about (a place's `cam.wide` that frames the back wall only).
- A number spoken but not shown; a number shown before its word.
- A corner HUD collision (label + icon, stat + checklist).
- A whip or zoom transition between shots (not in the style).
- (video 01) A running counter that changes its look between shots or parts (a red box here, a stat box there, a ring).
- (video 01) A character inside the frozen minute who greys with the world (not `free: true` in that shot).
- (video 01) A clause action named but not shown: "carries", "drags", "hugs you both", "drops onto the sofa", "slips",
  "catches" with the people only standing near each other, or a carried adult held upright above the carrier's head.
- (video 01) A raised arm / sleeve over the speaker's face in a 3/4 close-up; a bow or bend tipping sideways in a front view.
- (video 01) An object over an edge (a bus off a bridge) staged side-on so it reads as tilted ON the road: the edge and the
  drop must be in the picture.
- (video 01) Three neighbouring shots with the same picture; a whole act in front of one backdrop at one angle.
- (video 01) A night scene whose hand-built set stays day-bright (custom cards without `S.tone`).

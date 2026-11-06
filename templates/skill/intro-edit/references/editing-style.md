# Editing Style — the smooth-motion doctrine (smooth-recut skill)

**This file is the law for every intro built with this skill.** It was written after watching, frame-stepping
and transcribing nine reference motion-design tutorials. Everything below is what those references actually do.
Nothing below is guessed.

> **THESE motions are the smooth motions.** The generic motion advice that ships with
> the HyperFrames skills and other tutorial material (uniform `power2.out` fades,
> `back.out` pops on everything, big `backdrop-filter` glows, 0.3 s crossfades,
> "breathing" idle wobble, characters raining in with rotateX) is **sloppy goop**. Do
> not use it. If a rule in a skill contradicts this file, this file wins.

Reference index used throughout:

| ref | video | what it taught |
| --- | --- | --- |
| R1 | Apple Style Text Animation in AE | per-character ramp reveal with position + opacity + blur, Ramp Up shape, Ease High 50 / Ease Low 100, offset −100→100 over ~1 s, plus a fast scale keyframe for punch |
| R2 | Beginner's Guide To Smooth Animation | value vs speed graph, easy ease → **influence ≈ 70 %**, spacing keyframes 20 frames apart, motion-blur settings (shutter 270°, phase −90°, 16 samples) |
| R3 | Master Camera Movement (2 min) | camera = null parent, 35 mm feel, keyframe position + scale, easy ease then pull handles, motion blur |
| R4 | Master Text Animation (1 min) | the exact recipe: opacity 0 + position +100, Units Words, Shape Ramp Up, Ease High −50, Ease Low 100, Offset −100→+100 |
| R5 | Learn Smooth Editing in 12 min | the four components: **snappy movement + prolonged drift, overlapping keyframes on nulls, transition-with-movement, wiggle camera** |
| R6 | Master Smooth Motion & Premium Look | entrance graph = fast first then gradually slow; exit graph = slow first then fast; **never let a keyframe rest**; entrance 20–40 f, opacity 5 f, click/reaction 10 f; slight path curve + 3–4° rotation on entries; SF Pro Bold; subtle drop shadow; separation |
| R7 | Overlapping Keyframes | the pause at point B kills smoothness; start move B→C at the **middle** of A→B on a parent null; chain nulls endlessly |
| R8 | Smooth Camera Movement (23 min) | zooms are Z-position moves on a chain of nulls; each new null keyframes **before** the previous move ends; "drag the right handle in so it starts fast and takes its time to slow down"; for zoom-ins "drag the left side in so we ease into the zoom" |
| R9 | Ultimate Apple Style Guide | palette, SF Pro Display (Bold for titles, Medium/Regular for subs), centered layouts with breathing room, slide-up with square mask, word-by-word reveal, glassmorphism recipe, very subtle drop shadow |

---

## 1. Velocity: the three graphs (and nothing else)

The references only ever use three speed-graph shapes. Every tween in this project
maps to one of them. They are registered in `motion/smooth.js` as GSAP eases.

| name | AE description (verbatim from refs) | speed graph | CSS/GSAP bezier | use for |
| --- | --- | --- | --- | --- |
| `snapOut` | "fast at the first, then gradually it gets slower … the thing that makes it so smooth is the last 10 to 20 % of the movement, where the line becomes flatter" (R5, R6, R8) | peak at the very start, long flat tail | `cubic-bezier(0.08, 0.98, 0.18, 1)` | **every entrance**, punch-in zooms, bars filling, strikes, counters |
| `mid` | "start it slow, the line is flat, then drop down, cover most distance in the shortest time, then slow down at the end … influence around 70" (R5, R2) | symmetric sharp peak in the middle | `cubic-bezier(0.70, 0.00, 0.30, 1)` | **repositions** (an element that is already on screen moving to a new place), zoom-outs, stack shifts, the 'whip' of a card from one column to another |
| `exitIn` | "whenever you want to move something out of the frame, use a graph which is slow at the first and then fast at the end" (R6, R5 'hard stop') | slow start, ramps to max speed at the cut | `cubic-bezier(0.70, 0.00, 0.84, 0.00)` | **every exit** that leaves the frame or slides away |
| `drift` | "prolong the movement with a linear movement on a parent null … it's pulling the viewer in" (R5) | almost flat, near-constant | `cubic-bezier(0.30, 0.00, 0.70, 1)` (gentle) or `none` | the long tail after a snap: zoom drift, slow slide, scale creep |

Rules that go with the graphs:

- **Never `power2.out`, never `back.out` on text, never `elastic`, never `bounce`.** The
  only overshoot allowed is a UI "reaction" (a button/checkmark that gets clicked)
  and it is tiny: `back.out(1.2)` over 10 frames (R6 click simulation).
- **Never crossfade as a transition.** Things move in and move out. Opacity is a
  5-frame (0.17 s) helper that runs *inside* the move so nothing pops (R6: "opacity, but
  it's only five frames").
- Every motion has a **hard start**. There is no ease-in on entrances. The element is
  already at maximum speed on frame 1 and spends most of its duration decelerating.

## 2. Timing (30 fps)

| thing | frames | seconds | source |
| --- | --- | --- | --- |
| entrance of a card / headline | 20–40 f | 0.67–1.33 s | R6 "enter the scene with 20 to 40 frames" |
| opacity helper on entrance/exit | 5 f | 0.17 s | R6 |
| click / reaction / micro pop | 10 f | 0.33 s | R6 |
| exit (slide out) | 12–18 f | 0.4–0.6 s | R5 hard-stop transition, R6 |
| snappy move (position/scale hit) | 4–8 f snap then drift | 0.15–0.27 s + 1–4 s drift | R5 component 1 |
| word ramp (per word) | ~15 f | 0.5 s | R4/R1: offset −100→100 over ~1 s across the line |
| word stagger | 2–3 f | 0.07–0.10 s | R4 ramp up with Ease High −50/Low 100 |
| keyframe spacing that reads "smooth" | 20 f between hits | 0.67 s | R2 "Alt+Shift+Right twice" |
| zoom-in (punch) | 12–15 f snap + drift | 0.4–0.5 s + hold | R8, R5 |
| zoom-out | 20–24 f | 0.67–0.8 s | R8 "drag in both sides a little" |

## 3. Overlapping keyframes — the actual secret (R7, R5, R6, R8)

"When the object reaches the middle point there's a tiny pause that completely kills
the smoothness. Even a few frames, our eyes can feel it."

Implementation in HTML: the AE **null object** is a **wrapper div**. Every graphic gets a
chain of wrappers:

```
<div class="n3">      ← 3rd movement (e.g. slide-out exit)
  <div class="n2">    ← 2nd movement (e.g. shift up to make room)
    <div class="n1">  ← 1st movement (entrance)
      <div class="el">…the visible thing…</div>
```

- Each movement animates **its own wrapper**, never the same transform twice.
- The next movement **starts at the midpoint of the previous one** (R7: "somewhere around
  the middle of those two original keyframes"). In code: `at = prevStart + prevDur * 0.5`.
- Exits overlap the next scene's entrance the same way: the outgoing element is still
  accelerating away while the incoming one is already decelerating into place
  (R5 component 3: "match the speed of the first animation so the second looks the same").
- The camera (zoom) is the outermost null. Zoom moves also start before the previous
  zoom finishes (R8: "keyframe your null layers before the previous one has finished").
- Corollary from R6: **"Don't let your keyframe rest."** While a card is on screen for
  more than ~1.5 s it should carry a drift (a slow ±1 % scale or 20–40 px slide on its
  parent null with `drift`), never a wobble, never a loop.

## 4. Entrances (exact recipes)

### 4.1 Word ramp (headlines) — R4 / R1 / R9
Words, not characters, for anything read beside a face (characters are for hero
single-word hits only). Per word:

- start: `y = +0.9em`, `opacity 0`, `filter: blur(0.12em)`
- end: `y = 0`, `opacity 1`, `blur 0`
- ease `snapOut`, duration 0.5 s, stagger 0.085 s (this is the Ramp Up shape with
  Ease High −50 / Ease Low 100: the leading edge is soft, the trailing edge sharp)
- the blur is **per word and small**. No layer-wide blur, no glow. This is why the old
  blurs looked messy: they were 24–40 px backdrop blurs on whole panels.
- Optional "dynamic" version (R1): the whole line's null also scales 1.06 → 1.0 with
  `snapOut` over 0.6 s in parallel.

### 4.2 Slide-up with square mask — R9
For pills, list rows, file rows: the element's own wrapper has `overflow:hidden` with a
few px of padding; the element slides from `y = +110 %` to `0`, `snapOut`, 0.6–0.8 s.
The mask edge makes the reveal read clean.

### 4.3 Card entrance — R6
Cards travel along a slight curve with a tiny rotation that settles:
`from { x: ±220px (toward its home column edge), y: +60px, rotation: ±3°, scale: 0.96, opacity: 0 }`
→ `{ x:0, y:0, rotation:0, scale:1, opacity:1 }`, ease `snapOut`, 0.8 s; opacity only
over the first 0.17 s. Then the card's parent null drifts (`drift`) 24 px in the
direction of travel for the rest of its life.

### 4.4 Punch-in zoom — R5 / R8
Camera null: `scale 1 → 1.06` with `snapOut` over 0.45 s, transform-origin at the
face (55 % 42 %), then a second camera null continues `1 → 1.02` linearly over 2–3 s.
Zoom-outs use `mid` over 0.7 s and start while the drift is still running.

## 5. Exits

- Slide out **in the direction the element came from or continued toward** (a right
  column card exits right, a headline exits up). `exitIn`, 0.45 s, opacity 0.17 s at the end.
- Scale-away exit for centered things: `scale 1 → 1.08, opacity → 0` with `exitIn` 0.4 s
  (the camera is "passing through" it).
- The cut/next entrance lands **before** the exit finishes (see § 3).

## 6. Layout, type, color (R9 + finished frames of R4/R7/R1)

### Typography
- Font: **SF Pro Display**. Not installed here → **Inter** (metric-identical intent).
  Bold (700) for headlines, Medium (500) for subheads/labels, Regular (400) for body.
- Headline beside the face: **150–190 px** at 4K, letter-spacing **−0.02 em**, line-height
  **1.0**. Subhead: 64–80 px, letter-spacing −0.005 em. Label/kicker: 44–52 px, Medium,
  uppercase off (Apple doesn't shout), sentence case.
- Color: white `#FFFFFF` on footage; secondary `#E5E5EA`; muted `#8E8E93`.
- Drop shadow on text over footage: **subtle** — `0 6px 24px rgba(0,0,0,0.45)` (R9: "it
  needs to be very subtle if you want it to be Apple-like"). No glow.
- Text is always **left-aligned in the left column** or **left-aligned in the right column**.
  Centered only for hero hits that intentionally sit on the chest band, never on the face.

### Apple palette (exact hex from R9's palette card)
| role | hex |
| --- | --- |
| Light Gray (dividers, cards on light) | `#E5E5EA` |
| Mid Gray (secondary text) | `#8E8E93` |
| Dark Gray 2 (subtle UI) | `#3A3A3C` |
| Dark Gray (dark cards) | `#1C1C1E` |
| Apple Blue (primary / links / buttons / iMessage) | `#007AFF` |
| Apple Green (success / confirmations) | `#34C759` |
| Apple Orange (warnings, warm accent; matches this set's lamps) | `#FF9500` |
| Red (destructive) | `#FF3B30` |

### Panels
- Rounded corners always. Radius 36–44 px at 4K for cards, 999 px for pills.
- Dark glass card: `background: rgba(28,28,30,0.78)`, `backdrop-filter: blur(40px)`,
  **1.5 px inner stroke** `rgba(255,255,255,0.18)` (R9 glassmorphism: white stroke,
  overlay, ~30 % opacity), shadow `0 24px 60px rgba(0,0,0,0.35)`.
- White card (for iMessage-style bubbles): `#FFFFFF` with `#1C1C1E` text; outgoing
  bubble `#007AFF` with white text.
- Breathing room: **inner padding ≥ 48 px**, gap between rows ≥ 28 px, nothing touches an
  edge; safe margins 200 px from canvas edges.

### Composition with a talking head
- Face-safe zone (measure per clip in step 3; example from the original intro: x 1350–2350, y 350–1600). **Nothing enters it** except the
  one scripted joke.
- Left column: x 260 → 1300. Right column: x 2560 → 3620. Vertical anchor ≈ 1040
  (eye line) so text sits *beside* the face, not above/below it.
- Clean footage moments are part of the rhythm. Leave the frame empty when the line
  is personal or a beat lands ("and you're still sitting there…", "my name is…"
  before the plate, the breath before "Let's go").

## 7. Camera: zooms only, no wiggle
R5's `wiggle(1,8)` camera shake was tried in V3 and **rejected by Christophe on sight** ("everything
shaking"). It is banned. The camera moves only with deliberate zooms:

- Punch-in on the stressed word: `scale 1 → 1.05–1.09`, `snapOut`, 0.5 s, origin on the face
  (~48 % 40 %), then the outer null keeps drifting `+1.5–2 %` linearly for the life of the beat.
- Zoom-out with `mid` over 0.7–0.8 s, started before the drift ends.
- Opening: linear push 1.00 → 1.03 over the first line, released with `mid` on "everything you see".
- Final: `exitIn` push 1 → 1.12 into the cut.
- Graphics ride the camera (they are inside the camera nulls) so the zoom reads as one shot.

## 8. Motion blur
AE motion blur (270° shutter, −90° phase, 16 samples) is what makes the snap read
smooth in the references. The browser cannot render true motion blur. **Do not fake
it with big blurs.** The compensation is: snaps are 1–2 frames longer than in AE and
never exceed ~14 px per frame of travel at the peak. Per-word blur (§ 4.1) is the only
blur allowed.

## 9. Sync to speech
- A graphic **lands on the stressed word**, not on the start of the sentence. Use the
  word-level `transcript.json` timings; entrance start = word start − 0.08 s so the
  deceleration tail is happening exactly as the word is heard.
- Lists reveal on their spoken words. Counters run for the length of the phrase.
- A graphic exits on the last word of its thought or when the next graphic needs the space.

## 10. Checklist before rendering
1. Every entrance is `snapOut`; every exit `exitIn`; every reposition `mid`. No other eases
   except the 10-frame `back.out(1.2)` reaction.
2. No element sits still longer than 1.5 s without a drift on a parent null.
3. Every chained movement starts at the midpoint of the previous one.
4. No blur larger than 0.12 em, no glow, no crossfade.
5. Text is Inter 700 / 500, white, subtle shadow, beside the face, never on it.
6. Frame-check with `npx hyperframes snapshot . --at <times>` at each landing moment and
   each mid-transition moment before the full render.

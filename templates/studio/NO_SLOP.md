# No slop: the universal list (every Studio stage, every style, 2D and 3D)

Slop is anything a viewer reads as cheap, generic or machine-made: a decoration that carries no fact, a frame where
nothing can be seen, a body that does not do what it holds, a move that jerks, text that flashes past unread, a sound that
interrupts. One slop frame costs the whole video's credibility. A shot that can't be made good is replaced (real media
with a highlight, a held clean wide), never shipped as is. This list outranks pacing targets and reference imitation.
Sources: crime-style SOP_NO_SLOP.md (= recon no_slop.md), recon quality.md + signoff.md, flat QUALITY_STANDARD.md, the
app's `NO_SLOP_BANS` prompt text.

## 1. Hard bans (the owner's rules; no style, look or reference overrides them)
- **No red stamp / plaque / verdict overlay**: no rubber stamps or boxed red words slammed on ('CLOSED', 'LOCKED',
  'DENIED', 'CASE CLOSED', 'THE END', 'REJECTED', 'CLASSIFIED', verdict marks on lists). "Prohibited, straight slop."
  Show the fact instead: the real document, photo or footage with a highlight / circle on the words that matter, or the action itself.
- **No notice that the voice is AI** ('AI-generated voice', 'synthetic voice', 'voice: AI', 'TTS'), anywhere, ever.
  A neutral label ('ARCHIVE FOOTAGE', 'DRAMATISATION') is fine.
- **No sound effects the user did not supply** (whooshes, booms, typewriters, stamps, blips). Voice + the user's music only.
- **No section cards announcing chapters** on content ('I. BEFORE THE PRESS'), no slapped-on motion (things that slam in big and tilted).
- **No drawn stand-in for evidence or a real thing** (an oval as a "thumbprint", a box as a machine, emoji or coloured
  boxes when an image can't be made). Use the real thing, or stop and say why it couldn't be made.
- **No coloured glow on text** (red halo, outer glow, blurred coloured copy): one soft neutral drop shadow only.
- **No text inside generated images**; all text is engine type.
- **No upscaled rasters**: a picture shown large is magnified at most 1.5x at its most zoomed moment (Ken Burns included).
- **Every frame must read**: subject lit and visible, text held, camera eased, hands on what they hold, nothing through anything.

## 2. Visibility and readability gates (numbers)
Luminance Y = 0.2126R + 0.7152G + 0.0722B on sRGB 0-255, measured on the rendered frame (before captions):
- **L1 frame**: mean Y >= 90 for bright looks, >= 45 for a declared dark look; fewer than 35 % of pixels with Y < 16 (crushed).
- **L2 subject**: mean Y in the subject's box >= 70 and >= 1.4x the ring around it (box grown 25 %).
- **L3 detail**: >= 20 % of subject pixels with Y > 90; p95 - p5 inside the subject >= 80 (shape, not a flat blob).
- **L4 face / hands / held prop**: mean Y >= 80, p95 - p5 >= 60, and sharp (not eaten by depth of field or vignette).
- **L5 clipping**: fewer than 2 % of pixels at Y >= 250, except a declared flash frame.
- Dark mood comes from contrast and colour, never underexposure. A failing shot is relit (fill, rim, a practical, a
  lit wall behind), never brightened in post.
- **Text hold**: every text stays >= 1.5 s after it is fully settled (decode / typing / print finished), + 0.3 s per word beyond 5.
  A decode or scramble finishes within 0.6 s and is settled on the last frame it shows.
- **Text size at 1080p**: body >= 28 px, labels >= 22 px, credits >= 16 px; never under the engine's own check minimum.
- **Contrast**: text >= 4.5:1 against what is behind it (the engine checks may fail lower, e.g. 2.8:1 or 3:1: that is the
  floor, not the target). Busy ground: a paper / plate / neutral scrim behind the text.
- Information nobody can read is noise: if it can't be read, enlarge it, back it, or remove it.

## 3. Layout
- **Nothing cut by the frame edge**: every element fully in or fully out (more than 3 % outside = cut), unless a close
  crop is the declared intent. The camera never shows past the edge of its set / panel.
- **No accidental overlaps**: text over text, a card or tag over the subject, a mark over anything but its target, pins over
  cards. Every overlap is a declared decision. Two tags never at once in the same place.
- **The subject is framed**: what the narration names is in frame when it is named, big enough to read, in the middle
  60 %, not crowded; a card sits in the emptiest third for its whole time.
- **Caption band and safe zones**: nothing important in the caption band while captions show; text inside 4 % margins
  (more where the base sets them); corners with permanent UI (chapter tag, title) stay clear.
- **Air**: about 0.3-0.4 of a unit (or ~2 % of the frame) between elements and at every edge.
- **Never an empty frame**: a shot has its subject from its first frame (transitions show it); a mostly empty content zone
  is either declared sparse or filled with what the narration names.

## 4. Motion and camera
- **C1** Every move eases in and out (smoothstep / easeInOutCubic / erf ramp / damped spring). No linear starts, no snaps.
- **C2** A push-in or dolly lasts >= 2.5 s; an orbit >= 4 s; hold >= 1.5 s before and after a big move. 2D camera
  travels keep the base's tested lengths (e.g. whip >= 0.7 s, reframe >= 1.2 s).
- **C3** Speed: <= 0.25 x subject distance per second; <= 20 deg/s turning, <= 8 deg/s in a close-up.
- **C4** No speed change above 50 % of peak within 0.2 s except at the eased ends; no frame-to-frame step spike above 3x the median.
- **C5** One continuous move per shot (or a hold then a move); never two moves with a dead stop between.
- **C6** No shake (handheld only as a declared choice, <= 0.3 deg, < 1.5 Hz). Nothing wobbles while idle.
- **Every element lands on its spoken word** (0-0.15 s before it) and leaves when the narration moves on.
- **Nothing pops**: things enter and leave by moving, inside an effect, or with a motivated fade.
- **Pacing**: a cut happens when the shot has been read. Sub-second cuts only in a declared montage of strong frames.
  Reference pacing numbers are a ceiling on boredom, not a licence for unreadable frames.
- **No double exposure** of two 3D scenes; a cut or a deliberate transition, never a muddy cross-blend.

## 5. 3D contact (and its 2D equivalents)
- **Nothing floats**: everything rests on what holds it; feet planted (slide 0), seats at real seat height; anything not in
  contact stays >= 2 cm from every surface.
- **Nothing through anything**: body vs body, body vs solid, prop vs prop; interpenetration <= 1 cm. Openings bodies pass
  through are real holes in the geometry. Plan positions as numbers (about 0.95 m between people whose arms swing).
- **One surface per surface**: never two coplanar meshes (z-fight / flicker); a decal stays >= 1 cm proud.
- **Hands on what they hold**: named grip points, wrist within 2 cm, palm toward the prop; the prop is parented to the hand
  (or a carry anchor) for the whole contact; the body plays a matching action with anticipation and settle.
  A hand-over meets at one point on one frame. In 2D: held items belong to the figure (hold slots), never placed "at the hand".
- **Every verb said is acted**: reach -> act -> follow-through; nobody frozen while the narration says they act.
- **2D elements pass the element gate before scenes use them**: shading and highlights cut from the element's own outline,
  nothing poking outside its silhouette, light from one side, same stroke weights / radii / palette as the set, judged alone
  at ~600 px, not only at scene size.

## 6. Writing on screen
- No hype words or empty adjectives ('incredible', 'insane', 'game-changing', 'revolutionary', 'stunning', 'epic').
  Say the measured thing: a number, a date, a name.
- Numbers instead of adjectives in docs and findings: colours as hex, times in seconds, loudness in LUFS, sizes in px or
  units ("contrast 2.1:1 on #c49a68", not "a bit hard to read").
- Every fact, date and number on screen matches the narration and the source; quotes short, verbatim, attributed; every real
  asset credited.
- One idea per picture; labels name, they don't narrate.

## 7. How to verify (nothing renders before this passes)
1. **Checks first**: `check_preview` (load errors, cue misses, unknown names), then `check_layout` until it says Clean.
   Fix every finding at its cause; never silence a check with an "intended" flag (`over`, `bleed`, `sparse`) unless that is true.
2. **A check is trusted only once it has been seen to fail** on a known-bad case (`qa/mustfail/`, `scenes/mustfail_*.js`).
   A check that prints nothing at all is a broken pipe until proven otherwise. If the base has no layout check, say so and
   rely on frames.
3. **Then frames at full size** (scale 1 for text; contact sheets count only for overview): every shot at its start,
   middle and end, plus the moment each element settles. Consecutive frames (about 0.1-0.3 s apart) wherever something moves
   near something else, at every grab / release, and at every transition.
4. **Readability no check can measure**: is anyone hidden or headless, is the subject covered, does the picture show what
   its words say, would a first-time viewer get it without audio?
5. **Write each finding as `finding -> what it means -> exact fix`**, using the words the check prints, e.g.
   `overlap: label "1440" covers 18% of cutout "press" -> the date hides the subject -> move the label to y -3.2 (own row)`;
   `DARK: too dark to read (mean 0.072 < 0.1) -> the shot reads as a black screen -> raise the fill to 40 % of the key and add a lamp in frame`;
   `ABRUPT: accelerates 4.1 frame/s^2 at 12.40 s (limit 2.4) -> the push starts hard -> ease from rest over 2.5 s`.
   "Looked fine" is not a review.
6. Fix, then look again only at the moments you changed, and re-run the checks before calling a stage done.

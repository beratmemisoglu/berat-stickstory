# Flat explainer: the look, the motion, and what is bad at all costs

Reference genre: flat-vector popular-science shorts (9:16, bright, rounded, a recurring character, a visual event on
nearly every word). Projects can also be 16:9 (`settings.format = 'landscape'`): same rules, a wider stage (§1b). Everything here was learned the hard way across four rounds of review (see pitfalls.md).

## 1. Layout in 9:16 (1080 x 1920, origin at the centre, y up)
| Rule | Value |
|---|---|
| Caption band | y -700..-520 is reserved for captions. Nothing important there (ground and background are fine). |
| Ground line | `GY = -420`. Characters stand on it with `placeOnGround(ch, x, scale)` and get `S.shadow(w, x)`. |
| Content zone | y -420..880, visual centroid around +120..+200. Use the whole column, not just the top half. |
| Edge margin | >= 40 px of air at the edges, AFTER the camera push (up to +8 %). Tags and titles at the very top edge are the most common slip. |
| Fill | a steady frame uses >= ~15 % of the content zone: one big subject (400-700 px) beats three small ones. Near-empty frames read as broken unless emptiness IS the idea (`S.sparse = true`, e.g. "silence"). |
| Text | labels >= 44 px (tags 44-56), titles 90-120 px via `title()` (centred, every line the same size, never in a corner). Caption length is handled by the engine. |
| Icons | >= ~110 px on screen. |
| Title cards | `captions: false` on the shot when the title words ARE the narration. |

## 1b. Layout in 16:9 (1920 x 1080: `VERT` is false)
| Rule | Value |
|---|---|
| Caption band | `BAND` y -490..-380 (just above the player controls). |
| Ground line | `GY = -300`. A character at scale ~0.9-1.1 stands about 600 px tall. |
| Content zone | `ZONE` x -960..960, y -300..480. Compose SIDE BY SIDE: the character on one third, the idea on the other two; diagrams read left to right. |
| Titles | `title()` (max 1500 px wide, `TITLE.y` 400). |
| Fill | the same >= 15 %, measured on the wide zone: a lone centred subject in 16:9 reads empty. |
Write every position from `W`, `H`, `GY`, `ZONE` (or check `VERT`): numbers copied from a vertical scene put things
off-frame or in the band.

## 2. Motion
- **Every spoken beat gets a visual event**, timed with `cue('word', approx)`. Holds longer than ~1 s need secondary
  motion (blink, breathing via `drive()`, a float, a pulse). Never a frozen frame.
- **Carriers across cuts:** something travels through the seam (dots converge where the next object appears, the same
  diagram stays in place across two shots, an object shrinks into the next layout). Plan it in storyboard.md.
- **Cause and effect, not decoration:** "uses dopamine" = dots flow INTO the brain. Ask of every animation: what does
  it say? Motion that contradicts the narration is worse than none.
- **Few, big, slow actors:** 6-10 big particles on deliberate paths read; 30 tiny random ones are noise.
- **Entrances:** `pop` (squash and stretch, default), `rise`, `grow`, `wipe` (labels: always wipe), `slide-*`.
- **Lines land:** use `S.line` (grows, cap pops, ticks), and let the thing it points at appear after it lands.
- **Anticipation -> action -> settle** for characters (crouch before a jump, squash on landing, pivot at the feet).
- **Nothing snaps.** Every change at a word goes through in-betweens: `mixPose` with an eased weight inside `drive()`,
  `expr()` for faces, eased look/head turns (0.25-0.4 s). Never `t > X ? A : B` on a pose, a face, a colour or a
  position.
- **Colour changes spread from their cause** (from the binding site, the docking point, the centre), never a global
  swap: grow a second-colour copy (`stickGrow`, a scaling overlay that rises from the contact point).
- **Loops are seamless:** periodic functions (`Math.sin`) or fade at the wrap. A `%` on a position is a bug.
- **Stale state is a bug:** when focus moves, everything tied to it moves (beams, highlights, shadows).
- **Physics holds up:** a leak comes from a visible hole below the fluid line, falls under gravity, lands, leaves a
  puddle. For every moving element: where does it come from, where does it go?

## 3. Colour
- **Colour = meaning, film-wide.** Pick one colour per concept in storyboard.md (e.g. yellow = the hero substance,
  mint = good/working, pink = warning, lilac = the body/system) and never reuse a meaning colour for decoration.
- Backgrounds: `S.bg('night' | 'sky' | 'sunset' | 'lemon' | 'indigo' | 'violet' | 'ink' | 'cell' | 'mint' | 'rose')`.
  Dark grounds for "inside" (body, mind, machine), sky for everyday life, warm for distraction/urgency.
- **Never fade a warm colour over a cool ground** (translucent yellow over purple = brown). Glows and halos are OPAQUE
  lighter tints of the local background (`tint(bgColour, .15)`), ripples in a hue of the ground.
- 4-5 colours per scene.

## 4. Characters (models.js: `character()`; the main character is the project's character.js)
- The main character is the user's own (character.js, see characters.md): `character(S.root, { scale })`. Same look all
  video, never redesigned in a scene. Background people: `character(S.root, { look: randomLook(seed) })` with seeds
  that give a different hair style and top colour from the main character.
- Friendly by default (neutral brows, smile). Use `POSES` (rest, hipsOut, shrug, cheer, wave, stop, sad, think) and
  `walkPose(phase, amount)`; blend with `mixPose`. Always move through `drive(ch, poseFn, t)`: it adds drag
  (forearms trail), the bun follow-through and breathing. `poseFn(tt)` must be a pure function of time.
- Faces: `expr(ch, t, [[time, eyes, mouth, brow], ...])` (eyes: open/happy/shut/half, mouths: smile/flat/o/grin/frown,
  brow -1 worried .. +1 determined). It blinks with in-betweens and morphs mouths; never call setFace per frame.
- Older option names still work for quick variants: `character(p, { shirt, pants, hair, skin })`.
- Things that come FROM the character (thoughts, dots, sweat) are built BEFORE it so they emerge from behind.
- A character on the ground has a shadow that follows it.

## 5. Bad - avoid at all costs
1. Anything in the caption band while captions are on.
2. A hard cut where nothing carries over (use the default dissolve).
3. A scene that holds still for more than ~1 s.
4. Labels under 44 px, icons under ~110 px, titles in a corner or hugging the top edge, near-empty frames.
5. Muddy colours from translucent warm-over-cool fades.
6. Particles as decoration instead of actors with a path and a meaning.
7. Motion that contradicts the narration.
8. Stale indicators left behind.
9. Elements crossing the frame edge or touching each other by accident.
10. Floating characters with no ground or shadow.
11. Snaps: a pose, face, colour or position that jumps between two frames.
12. Sawtooth loops that jump back to their first frame.
13. Shading outside an element's form; one element shaded and its neighbour flat.
14. Physically impossible behaviour (leaks without a hole, things appearing out of thin air ON TOP of a face).
15. Judging a scene from one still: look at consecutive frames around every change.

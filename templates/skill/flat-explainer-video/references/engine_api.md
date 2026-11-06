# Flat engine API (engine.js ENGINE_VERSION 6, models.js)

```js
import { shot, cue, C, W, H, VERT, GY, BAND, ZONE, TITLE, text, tag, rrect, circle, ring, stick, group, shaded, ball, dopa, tint, withRole,
  capsulePts, circlePts, clipPts, E, seg, lerp, clamp, ease, pop } from '../engine.js';
import { character, randomLook, placeOnGround, drive, expr, mixPose, POSES, walkPose, icons, badge, heldPhone, FEET } from '../models.js';
```
Units: pixels, origin at the centre, y up. The frame is `W x H`: 1080 x 1920 (vertical) or 1920 x 1080 (landscape,
`VERT` false), set per project. `GY`, `BAND`, `ZONE` {x0,x1,y0,y1}, `TITLE` {y,maxW,top} follow the format. Times in seconds.
Draw order = build order (later on top). Colours: `C.name`, `'#rrggbb'` or `0xrrggbb` everywhere.

## Shots
```js
// ---- 3: the reward meter leaks ----        <- title comment (the editor lists shots by it)
shot({ t0: cue('reward', 10.6) - .2, trans: 'dissolve', focus: [0, 150], captions: true,
  build(S) { S.bg('sky'); S.ground('#1f6fd8'); const st = {}; /* build, S.add(...) */ return st; },
  update(st, t, S) { /* per-frame motion: drive(), expr(), custom maths; pure function of t */ } });
```
- `t0`: start (a shot lasts until the next one). `trans`: how it comes in: `'dissolve'` (default; drift + soft sweep),
  `'slide-left' | 'slide-right' | 'slide-up'` (both shots move together), `'cut'` (only when something carries over
  exactly). `transDur` overrides the length. `captions: false` hides captions during the shot (title cards).
- `focus: [x, y]`: point the slow camera push moves toward (default `[0, 150]`, landscape `[0, 90]`). `S.noCamera = true` in build: no push.
  `S.sparse = true` in build: this shot is meant to be nearly empty (the layout check won't call it empty).
- Return `st`: every element you may want to click, check or animate, as `st.name = obj`. `check_layout` looks at the
  top-level entries of `st` (cut-offs within 36 px of the edge, caption band, overlaps, small text, shading outside
  the form, and near-empty frames).
  `obj.userData.over = true | [otherObj]` = an intended overlap (a label on its object). `obj.userData.bleed = true` =
  intended crop. `obj.userData.ground = true` = floor/background element (ignored).

## S (inside build)
- `S.root`: the content group (pushed by the camera). Primitives called without a parent add to it during build.
- `S.bg(name)` or `S.bg(topHex, bottomHex)`: background gradient + barely-visible depth discs (+ dust on dark grounds).
  Names: `night sky sunset lemon indigo violet ink cell mint rose`.
- `S.ground(fillHex, edgeHex?)`: the floor below `GY`.
- `S.shadow(width, x)`: soft contact shadow on the ground (keep a reference and move it with the character).
- `S.add(obj, { at, in, dur, dist, out, outAt, outDur, sfx, gain })`: entrance (+ optional exit) + its sound.
  Set the object's position/scale BEFORE calling S.add (it remembers them as the rest state).
  `in`: `'pop'` (default, squash & stretch) | `'rise'` | `'grow'` | `'wipe'` (tags: left-to-right reveal) |
  `'slide-left|right|up|down'` (arrives from that side, `dist` px) | `'fade'` | `'none'`.
  `out`: `'pop' | 'fade' | 'slide-left|right|up|down'` with `outAt`. `sfx: false` silences it.
- `S.line(x1, y1, x2, y2, width, color, { at, dur = .22, ticks = true, cap = true })`: draws on, then lands.
- `S.burst(x, y, { at, dur = 1, rays = 14, dots = 4, r0 = 150, r1 = 330, color, size, seed })`: dotted radial rays.
- `S.sfx(type, t, { pan, gain })`: an extra sound (see sound_design.md).
- `S.t0`, `S.t1`, `S.GY`, `S.BAND`, `S.C`.

## Primitives (engine.js) - `p` = parent group (or omit inside build)
- `group(p, x, y)` · `circle(p, r, color, x, y, o)` · `ring(p, r, width, color, x, y)` · `arc(p, r, width, a0, a1, color, x, y)`
- `rrect(p, w, h, radius, color, x, y, o)` · `rrOutline(p, w, h, r, borderW, color, x, y)` · `poly(p, pts, color, x, y)`
- `blob(p, pts, color)` (smooth closed curve through points) · `stick(p, x1, y1, x2, y2, width, color)` (capsule
  stroke; `stickGrow(st, k)` grows it 0..1 from its start)
- `o = { opacity }` on most primitives (avoid translucent warm-over-cool).
- `text(p, str, { size = 48, weight = 800 | 600, color, stroke, strokeW, align = 'center'|'left'|'right', x, y, lineH })`
  Inter only. `'\n'` for lines. Returns a mesh; `.userData.w` = width in px.
- `title(p, str, { y = 640, size = 104, color, stroke, colors })`: THE way to put a title on screen: centred, every
  line the same size (`'Line one
line two'`), shrunk to fit `TITLE.maxW` (920 px vertical, 1500 landscape), kept `TITLE.top` below the frame top. Bring it in
  with `S.add(t, { at, in: 'pop' })`; use `captions: false` on that shot when the title words are the narration.
- `tag(p, str, { fill, color, size, x, y, padX, padY, r })`: a pill label with thickness. Bring it in with
  `S.add(tg, { at, in: 'wipe' })`. `.userData.w/h`.
- Masks: `maskCircle(p, r, ref, x, y)` then `useMask(group, ref)` clips everything already in `group` to the circle
  (zoom-inset bubbles). Each inset uses its own `ref`.
- Gradients: `gradientBg(p, top, bottom, w, h)`.

## Shading (QUALITY_STANDARD)
- `shaded(p, pieces, color, { s = 6, k = -.2, x, y })`: THE way to make a solid object. `pieces` = one convex CCW
  point list or an array of them: `capsulePts(w, h, r, cx, cy)`, `circlePts(r, cx, cy)`, `starPieces(R, r)`,
  `rotPts(pts, angle, cx, cy)`, `shiftPts(pts, dx, dy)`.
- `ball(p, r, color, { x, y, shade, spec })` round things; `dopa(p, r)` the shaded yellow particle;
  `crescent(p, r, d, color, x, y)` a bottom-right shade on a circle.
- `slab(p, w, h, r, color, { x, y, depth = 14 })` a card with thickness and a top highlight.
- `clipPts(pts, ...planes)` (plane `[a, b, c]` keeps `a*x + b*y + c >= 0`), `planesOf(convexPts)`.
- `withRole('detail' | 'thickness', () => ...)` marks meshes built inside the callback (for the layout check).
- `tint(hex, k)`: k > 0 toward white, k < 0 darker. Shade = `tint(c, -.2)`, highlight = `tint(c, .35)`.

## Motion helpers
- `E.outCubic, inCubic, inOutCubic, outQuint, inOutSine, outBack(k, s)`, `seg(t, a, b)` (0..1), `ease(t, a, b, f)`,
  `lerp`, `clamp`, `pop(t, t0, d)` (scale with overshoot), `popSq(t, t0, d)` -> `[sx, sy]`, `bump(t, a, b)` (0->1->0).
- `cue('word', near, 's' | 'e')`: start (or end) time of the spoken word(s) nearest `near`. Always use it for timing.
  Words match without case or accents, in any language (engine v4+): `cue('transcripcion', 4)` finds "Transcripción,".
  Japanese, Chinese and Thai (no spaces): the timeline's words are what a word breaker found, and a cue may span several
  of them (engine v6+): `cue('東京タワー', 12)` finds "東京" + "タワー". Copy cue words from audio/script_timed.txt.
- Other scripts: Japanese, Korean, Chinese, Thai and Hindi letters (and Vietnamese ones) draw in a bundled font the
  preview adds under Inter; captions join Japanese, Chinese and Thai words without spaces (timeline words with `ns`,
  engine v6+). Break long titles into lines yourself ("\n" in `text()`), never inside a word; no `tracking` on Thai or
  Hindi text, and never reveal Thai or Hindi letter by letter.
- Seamless loops: `Math.sin(t * w + phase)`. Never `%` on a position.

## Characters and kit (models.js)
- `character(p, { x, y, scale, flip })` -> the project's MAIN character (character.js) as a group (origin at the hips).
  `character(p, { look, scale })` anyone else (`randomLook(seed)` for background people, or a look object), `{ as: 'mo' }`
  for Mo. `placeOnGround(ch, x, scale)` stands it on `GY`. Looks, parts and the trait catalog: characters.md.
  `ch.userData.R.name` is the character's name.
- `drive(ch, tt => pose, t)`: the ONLY way to animate a body (drag, follow-through, breathing).
  Pose keys: `armL [shoulder, elbow]`, `armR`, `legL [hip, knee]`, `legR`, `head` (tilt rad), `look [x, y]` (face
  offset px), `bob`, `lean`. `armL[0] > 0` swings the viewer-left arm outward; `armR[0] < 0` the right one.
  `POSES.rest | hipsOut | shrug | cheer | wave | stop | sad | think`, `mixPose(a, b, k)`, `walkPose(phase, amount, base)`.
- `expr(ch, t, [[t0, eyes, mouth, brow], ...], seed)`: expression timeline with in-betweens (first key at 0).
- Icons (each ~100 px, centred; scale the returned group): `icons.brain(p, s, col) book gamepad phone(p, s) coffee
  bell star(p, s, col) clock(p, s) dna house network plate moon check(p, col) pill(p, s, colA, colB)
  calendar(p, label, col) sun dumbbell`. `clock(...).userData.min / .hr` are the hands (rotate `.rotation.z`).
- `badge(p, iconName, { r, ringCol, fill, x, y, scaleIcon })` an icon in a ring (hub-and-spoke nodes).
- `heldPhone(p, screen => { ...build screen content... })` a right hand holding a phone (scale ~1, ~370 x 660).
Add new elements to models.js in the same style and prove them with the gate before using them.

## Captions and finish
Automatic from the timeline: 1-3 words per card in the band, the spoken word turns yellow (the brand colour when the
look sets one). Settings (the look): `captions.on/size`, `post.grain/vignette`, `camera.push/punch`, `transitions.duration`,
`brand.color`. Don't hand-edit them.

## Brand colour (engine v7)
The look's Brand colour (`brand.color`, '#rrggbb', or unset) is exported as `BRAND`: `{ on, color, ink, caption }`, and
`C.brand` / `C.brandInk` (unset: `C.yellow` and its text colour, so scenes may always use them). When set, the engine uses
it by itself for the spoken caption word (`BRAND.caption`, readable on the caption outline) and the default `tag()` fill
(text in `BRAND.ink`). Use `C.brand` for the one key accent: title and chapter cards, highlights, lower thirds, the end
card; keep the palette's colour meanings for everything else, and text on it in `C.brandInk`. Helpers: `contrast(a, b)`
(WCAG ratio), `legibleOn(c, bg, min = 3)` (c moved toward white/black until it reads on bg), `textOn(c)`.

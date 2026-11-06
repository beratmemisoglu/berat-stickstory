# Starter engine API (engine.js ENGINE_VERSION 1, ENGINE_KIND 'starter')

```js
import { shot, cue, C, W, H, VERT, DIM, SAFE, ZONE, BAND, TITLE, GY, rect, rrect, circle, poly, line, arrow, text, title, label,
  tag, card, counter, image, box, sphere, cyl, ground, group, E, ease, seg, lerp, clamp, pop, bump, rng, fmt, tint, textOn,
  legibleOn, contrast, BRAND } from '../engine.js';
import { kitShot, kitGallery } from '../lib/kit.js';
import { badge, table } from '../models.js';
```

## Frame and units
- `W x H`: 1920 x 1080 (`VERT` false) or 1080 x 1920 (`VERT` true), from `settings.format`. `DIM`: '2d' or '3d' (`settings.dim`).
- **2D**: pixels, origin at the frame centre, y up. Draw order = build order (later on top).
- **3D**: metres, y up, the ground at y = 0. Every solid's origin is the middle of its BOTTOM: `box(null, 1, 1, 1, c)` stands
  on the ground, `{ y: .75 }` stands it on something .75 m high. 2D elements (text, title, label, tag, card, counter,
  image, line, arrow, rect ...) go on the shot's HUD (pixels, over the 3D picture).
- Layout values (pixels, both dims): `SAFE` {x0,x1,y0,y1} never covered by player / phone UI; `ZONE` where content goes;
  `BAND` {y0,y1} the caption band (nothing important there); `TITLE` {y,maxW,top} title() defaults; `GY` the 2D ground line.
- Colours: `C.<key>` from the theme (bg bg2 surface ink muted accent accent2 good bad line ground sky floor), `C.brand` /
  `C.brandInk`, or '#rrggbb' / 0xrrggbb anywhere.

## Shots
```js
// ---- 3: the reward arrives ----             <- title comment (the editor lists shots by it)
shot({ t0: cue('reward', 10.6) - .1, trans: 'dissolve', captions: true, focus: [0, 120], post: { contrast: 1.05 },
  build(S) { S.bg(); const st = {}; /* build, S.add(...) */ return st; },
  update(st, t, S) { /* per-frame motion, a pure function of t */ } });
```
- `t0` seconds (a shot lasts until the next one). `trans`: `'dissolve'` (default) | `'cut'` | `'push-left' | 'push-right' |
  'push-up' | 'push-down'` | a TRANSITIONS key; `transDur` overrides the length (settings.transitions.duration).
- `captions: false` hides captions during the shot (title cards whose words are the narration).
- Return `st`: every element you may click, check or animate (`st.name = obj`, arrays too). check_layout judges these.

## S (inside build)
- `S.root` (2D content / the 3D world), `S.hud` (pixels, not pushed by the camera), `S.back`, `S.scene`, `S.cam`.
- `S.bg()` the theme's gradient · `S.bg(top, bottom)` · `S.bg(color)` · a C key works: `S.bg('bg2', 'bg')`.
- `S.ground(color?)`: 2D a floor below `GY`; 3D the ground plane at y = 0.
- `S.add(obj, { at, in, dur, dist, out, outAt, outDur, sfx, gain })`: entrance (+ exit) and its sound. Position the object
  first. `in`: `'pop'` (default) | `'grow'` | `'rise'` | `'drop'` (3D: falls and bounces) | `'fade'` | `'slide-left|right|up|down'`
  | `'none'`. `out`: `'pop' | 'fade' | 'slide-*'` at `outAt`. No `at`: there from the start.
- `S.line(x1, y1, x2, y2, w, color, { at, dur })` / `S.arrow(...)`: draws on, then lands (a click).
- `S.tick(t => ...)`: per-frame code. `S.sfx(type, t, { pan, gain })`: an extra sound.
- `S.rng()`: this shot's seeded random (0..1). `S.noCamera = true`: no push. `S.sparse = true`: meant to be nearly empty.
  `S.visibility = false`: a deliberately dark shot. `S.kit`: set by kitShot.
- 3D: `S.view(pos, look, fov)` the camera (default [0, 2.2, 7.5] looking at [0, 1, 0]); `S.move([{ t, pos, look, fov }, ...])`
  eased moves between keys (keep keys >= 1.5 s apart: check_layout calls fast ones ABRUPT); `S.light({ key: [x, y, z],
  intensity, hemi, color, area, shadows })`; `S.fog(near, far, color)`; `S.toScreen([x, y, z])` -> HUD pixels of a 3D point
  (to place a label next to a thing).

## 2D elements (p = parent group; null inside build = the default layer)
- `rect(p, w, h, color, x, y, o)` · `rrect(p, w, h, r, color, x, y, o)` · `circle(p, r, color, x, y, o)` · `poly(p, pts, color, x, y)`
- `line(p, x1, y1, x2, y2, w, color)` · `arrow(p, x1, y1, x2, y2, w, color, { head })`: `.userData.set(k)` grows them 0..1.
- `text(p, str, { size = 48, weight = 800 | 600, color, font: FONT | MONO, align, x, y, lineH, stroke, strokeW, wrap, maxW })`:
  `wrap` = px width to wrap at, `maxW` = shrink to fit. `.userData.w / h`.
- `title(p, str, { y = TITLE.y, size = 104, color, colors })`: centred, lines the same size, shrunk to `TITLE.maxW`.
- `label(p, str, { x, y, size = 40, fill, color })`: text on a plate. `tag(p, str, { x, y, size = 40, fill = C.brand })`: a pill.
- `card(p, { w, h, x, y, title, body, fill, titleSize = 52, bodySize = 40 })`: a panel; the body wraps.
- `counter(p, { from, to, at, dur, decimals, prefix, suffix, size, color, x, y })`: counts by itself (numbers via fmt()).
- `image(p, key, { w, h, x, y })`: a picture from project.json "images" (a grey placeholder + a warning when missing).
- `group(p, x, y, z)`: a group (no parent: S.root; a HUD group on a 3D shot: `group(S.hud)`).
- `o = { opacity }` on the shapes.

## 3D elements (3D projects only; metres)
- `box(p, w, h, d, color, { x, y, z, ry, rough, metal })` · `sphere(p, r, color, {...})` · `cyl(p, r, h, color, { r2, seg, ... })`
- `ground(p, { size, color, y })`: the floor (S.ground() makes it). Never checked for floating.
- They cast and take soft shadows (settings.quality.shadows).

## Tags the checks read (userData)
`kind`, `role` ('form' | 'text' | 'solid' | 'ground' | 'detail' | 'thickness'), `size`. Intent marks: `over = true | [other]`
(an intended overlap / something meant to sit inside another), `bleed = true` (an intended crop at the frame edge),
`band = true` (allowed in the caption band), `ground = true` (floor / background), `airborne = true` (a 3D thing that really
flies or falls), `bg = '#hex'` (the plate a text reads against).

## Motion and timing
- `cue('word', near, 's' | 'e')`: when the spoken word(s) start (end) nearest `near` seconds. Time every event with it.
- `E.outCubic inCubic inOutCubic outQuint inOutSine outBack(k, s) outBounce`, `seg(t, a, b)`, `ease(t, a, b, f)`, `lerp`,
  `clamp`, `pop(t, t0, d)`, `bump(t, a, b)` (0 -> 1 -> 0), `rng(seed)` (the only randomness).
- Colour: `tint(c, k)` (k > 0 lighter, < 0 darker), `contrast(a, b)`, `textOn(fill)`, `legibleOn(c, bg, min)`.

## Kit (lib/kit.js)
- `kitShot({ t0, name, bg: 'light' | 'dark', build: S => element })`: one element alone, framed and centred.
- `kitGallery([{ name, build }], { t0, each })`: every element on light then dark; returns the end time.
Kit elements stand still (no S.add); check_layout adds a `kit` finding when one is not whole and comfortably in frame.

## Captions, finish, brand
Captions come from the timeline by themselves (1-3 words per card in `BAND`, the spoken word in `BRAND.caption`).
Settings (the look): `captions.on/size`, `post.grain/vignette/contrast/desat/warmth`, `camera.push/punch/fov`,
`transitions.duration`, `quality.ss/shadows`, `theme`, `brand.color`. Don't hand-edit them; a shot's `post` overrides the
finish for that shot. `BRAND = { on, color, ink, caption }`: the brand colour (unset = the theme's accent) is the default
tag() fill; use `C.brand` for the one key accent.

## check_layout findings (types)
`cut` `caption` `overlap` `small` `contrast` `empty` `kit` `DARK` `CRUSHED` `ABRUPT`, and in 3D `floating` `through`
`coplanar` `flicker`. Thresholds: `CHECK`, `VISIBILITY`, `CAMERA_LIMITS` (a style may tune them, never remove them).

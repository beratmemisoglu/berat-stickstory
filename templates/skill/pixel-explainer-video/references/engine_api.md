# Engine API

Project files: `engine.js` (renderer, HUD, shots, export), `models.js` (model library - extend it),
`scenes/*.js` (your shots), `project.json`, `index.html` (generic host; don't edit).
Scenes import with relative paths:
```js
import { THREE, C, RAMP, shot, cue, ease, easeOut, easeIn, seg, pop, clamp, lerp, V, rng,
         text, stat, tag, rect, line, frame, project, card, facet, flat, box, vox, hud, FONT, W, H } from '../engine.js';
import { city, building, car, person, tree, terrain, scatter, mountain, gridFloor, orbit, pixelQuad, ... } from '../models.js';
```

## Contents
1. Shots and timing
2. Scene state `S` (per-shot render settings)
3. Geometry and materials
4. Model library
5. HUD drawing
6. Image cards
7. Rendering, stills, events
8. Minimal complete shot

## 1. Shots and timing
```js
shot({
  t0: cue('first words of shot', 12.3) - .1,  // start ~0.1 s before the phrase that opens it
  chapter: ['02', 'THE CODE  ·  NAUGHTY DOG'],   // optional: corner tag (use on every shot of the chapter)
  chapterFirst: true,                          // optional: first shot of a chapter -> letterbox "slam" intro (engine v5+:
                                               // number, title and the part after '  ·  ' stacked, each centred on the frame)
  trans: 2,                                    // optional transition INTO this shot: 0 dither, 1 diagonal wipe, 2 iris, 3 glitch, 4 pixelate
  cut: false,                                  // optional: hard cut instead of a transition
  build(S) { ...; return st; },                // create the scene once; return your state object `st`
  update(st, t, S) { ... },                    // every frame: animate objects + set the camera (t = absolute seconds)
  draw(st, t, S) { ... },                      // every frame: HUD (text, stats, tags, cards) in 320x180 art pixels
});
```
- Shot end `t1` = next shot's `t0` (set by `finalizeShots`). `S.t0/S.t1` are available inside.
- `cue(words, near, which='s')` -> start time of the spoken words (multi-word match, nearest to `near`
  seconds; `which='e'` returns the end of the last word). Take `near` from `audio/script_timed.txt`.
  A miss logs `cue miss` (render.mjs prints it) and returns `near` - fix every miss. Words match without case or
  accents, in any language (engine v3+): `cue('transcripcion', 4)` finds "Transcripción,". `fmt(n, dec)` writes
  numbers the way the narration's language does (project.json "language": 1.000,5 in Spanish).
  Japanese, Chinese and Thai (no spaces): a cue may span several timed words (engine v7+): `cue('東京タワー', 12)`
  finds "東京" + "タワー"; copy cue words from audio/script_timed.txt. Japanese, Korean, Chinese, Thai and Hindi
  letters draw in a bundled font the preview adds under Orbitron and Share Tech Mono; `text()` draws one line, so
  break long titles into several `text()` lines yourself, never inside a word, and keep `spacing` 0 for Thai and Hindi.
- Store cue times in `st` during build (`st.tYear = cue('five years', 11.4)`), use them in update/draw.
- `st.hits = [times]` marks key reveal moments. They ONLY drive soft sound accents in the sound design
  (the engine never shakes the camera).
- Easing: `ease(x)` smoothstep 0..1 (clamped), `easeOut`, `easeIn`, `seg(t,a,b)`, `pop(t, t0, dur)`
  overshoot pop-in, `lerp`, `clamp`. Pop objects in with `popScale(obj, pop(t, t0))` - it scales relative to
  the object's original scale. Never `obj.scale.setScalar(...)` on a `box()`: its size IS its scale. Fades: `ease((t - tIn) / .3) * (1 - ease((t - tOut) / .3))`.
- `rng(seed)` deterministic random - never use `Math.random()` (renders must be reproducible and
  frames rendered out of order must match).

## 2. Scene state `S`
Created per shot: `S.scene`, `S.cam` (PerspectiveCamera, fov 40). Settable in build:
| key | default | effect |
|---|---|---|
| `S.bg` | C.bg | clear colour (also the default sky) |
| `S.sky` | [bg, one step lighter] | `[top, horizon]` dithered sky gradient; fog fades to `horizon` |
| `S.fogNear`, `S.fogFar` | 30, 80 | dithered distance fog (world units from camera) |
| `S.shadows` | true | set false for flat diagram shots |
| `S.shadowCenter` / `S.shadowSize` | auto (where the camera looks) | override if shadows are clipped |
| `S.outline` | true | depth-edge outlines |
| `S.fov` / `S.push` | 40 / 0.04 | base field of view / gentle push-in over the shot |
Set the camera every frame in `update` (`orbit(S.cam, target, radius, angle, height)` or
`S.cam.position.set(...); S.cam.lookAt(...)`).

## 3. Geometry and materials
- `box(w, h, d, ramp, [x,y,z])` -> faceted palette box (the basic building block; origin = centre).
- `facet(ramp)` material: ramp name from `RAMP` (white, grey, black, blue, cyan, red, orange, yellow,
  green, lime, plum, teal, navy, sky, dark, sand, stone; `yellowFlat limeFlat orangeFlat cyanFlat` keep the
  named colour on top faces - plain yellow/lime/white go one step lighter on top) or an array `[shadow, side, top]` of `C` colours.
  Options: `{opacity}` (dithered transparency), `{side: THREE.DoubleSide}`.
- `flat(colour)` single-tone. `vox(rows, charToRamp, {size, depth})` voxel sprite from text rows.
- `setOpacity(obj, a)` - dithered fade (needs materials created with `{unique: true}` or it changes all
  users of the cached material).
- Coplanar flicker (engine v9): two surfaces in one plane (a plane on a floor, a poster flush on a wall, a stripe box
  sharing a face with its base) z-fight and flicker. Never put two surfaces in the same plane: lift the top one
  (>= 0.02 units) or use `decal(mesh, level = 1)`, which draws it in front with a depth bias (stack: level 2, 3...).
  After `build()` the engine also finds axis-aligned overlapping same-plane facet meshes and biases the smaller one
  automatically (`S.decals` = how many; `S.autoDecal = false` turns it off). It cannot see rotated meshes, InstancedMesh
  or objects moved into place later in `update()` - offset those yourself. `coplanarPairs(S.scene)` lists the pairs.
- InstancedMesh with `facet()` works (use for particles, windows, crowds - hundreds of items are cheap).
- Lines (`THREE.LineSegments` + `LineBasicMaterial({color: C.x})`) for wireframes/grids/roads.

## 4. Model library (`models.js`; add yours here)
Generic: `group(...)`, `gridFloor(size, step, col)`, `ground(w, d, ramp)`, `terrain(w, d, seg, hf, ramp)`
(faceted height field; `hf(x,z)` -> y), `scatter(hf, {n, area, seed, cx, cz, grassRamp})` rocks + grass,
`tree(scale, seed)` (3 colour variants), `mountain(r, h, seed, ramp, snow)` jagged range, `person(ramp, s, hair)`,
`car(ramp, s, taxi)` (`.paint` = body parts to recolour), `building(w, h, d, ramp, seed, litFraction)`,
`city(nx, nz, {lot, seed, hMin, hMax})` (`.lots[i] = {x,z,w,d,h,solid,ghost}` - toggle solid/ghost wireframe),
`ghostBox(w,h,d,col)`, `lamppost`, `plane(s)`, `chip(w, d, ramp, dieRamp)`, `memory(cols, rows, size, gap, ramp)`
(`.cells`, `.set(i, ramp)`), `disc(r)`, `panel(w, h, ramp)`, `pixelQuad(w, h, drawFn(ctx,w,h), pw, ph)`
(canvas-drawn pixel image on a quad; `.userData.redraw(fn)` to animate it - e.g. a TV screen),
`wire(obj, col)` edge overlay, `orbit(cam, target, r, angle, height)`.
Topic-specific examples from the reference video (reuse or use as patterns): `ps2()` console,
`colossus(s)` (pivots `legL legR armL armR`, `.eyes`, `.sigil`), `rider(s)` horse + rider.
Shared code between scene files (helpers, a board used by several sections) goes in `models.js` or a
helper module that is NOT listed in `project.json.scenes` - never import one scene file from another
(it would register its shots twice).
Pattern for new models: a `THREE.Group` of `box()` parts, pivots as child Groups for animation, a few
detail parts (lights, trims, props), expose handles on the group (`g.wheel`, `g.paint`, `g.screen`).

## 5. HUD drawing (inside `draw`, units = art pixels 320x180)
- `text(str, x, y, {size=7, col=C.white, font='body'|'head', weight, align='center'|'left'|'right', alpha, outline=true, spacing, noKinetic})`
  Headings (`font:'head'`) decode in/rise automatically while alpha < 1; pass `noKinetic:true` for
  intentionally dimmed text and for numbers that change every frame.
- `stat(x, y, value, unit, {size=22, align, alpha, label, unitCol})` big number + unit + label.
- `tag(S.cam, worldPos, str, {dx, dy, col, sub, alpha})` label with leader line to a 3D point.
- `rect(x,y,w,h,col,alpha)`, `frame(...)` outline box, `line(x0,y0,x1,y1,col,alpha,lw)`.
- `project(worldVec, S.cam)` -> `[x, y, z]` art-pixel position (z > 1 = behind camera).
- Raw canvas: `hud` (2D context, already scaled to art pixels) for arcs/graphs; set `hud.globalAlpha` back to 1.
- Brand colour (engine v8): the look's `brand.color` ('#rrggbb' or unset) is `BRAND = { on, color, hud, ink, slot }`.
  The engine draws the chapter slam bars and number, the chapter tag and `stat()` units in `BRAND.hud` (the brand
  colour moved just enough to read on the dark HUD; unset = `C.yellow`, as before). Use `BRAND.hud` for HUD accents you
  draw (titles' key word, lower thirds, the end card) and `BRAND.ink` for text on a `BRAND.color` fill. In the 3D world
  use `RAMP.brand` (= the nearest palette ramp, `RAMP[BRAND.slot]`): the art stays on the 16-colour palette. Helpers:
  `contrast(a, b)`, `legibleOn(c, bg, min = 3)`, `textOn(c)`.

## 6. Image cards
`card(key, x, y, w, t, {t0, t1, label, sub, align:'left'|'right'|'center', bg, h, cropY})`
- `key` = image key from `project.json.images` (fetch_images.py registers them).
- Pops in at `t0`, fades out before `t1`; height from aspect ratio unless `h` given (then cover-crop).
- Drawn on the 1080p layer in true colour. Returns its height (art px) for stacking.
- SVG logos without an intrinsic size: pass `h` explicitly. Images containing several items (e.g. two
  covers side by side): pass `h` plus `cropY`, and crop the file with PIL first if you need one item.
- `pixelQuad` textures: make the canvas resolution about equal to the quad's size on screen in art pixels
  (a quad covering 60x40 art px -> ~60x40 canvas). Much larger canvases get downsampled and small
  letters/details turn to mush; draw text on the HUD instead of inside tiny textures.

## 7. Rendering, stills, events (`node render.mjs <project> <mode>`)
- `stills --times a,b,c --name X [--scale 0.5]` -> `out/X_frames/*.png` (then `sheet.py`); `--scale 1` = 1080p.
- `video [--name slug] [--from s --to s] [--fps 30] [--bitrate 10e6]` -> `out/slug.mp4` (muxes
  `audio/final_mix.wav`, else `clean.wav`, when rendering from 0).
- `events` -> `audio/events.json` for sound design. `serve` -> live preview with audio and scrubber.
- Frames are pure functions of `t`; shots are built lazily and disposed when far away, so any time can
  be rendered in any order.

## 8. Minimal complete shot
```js
// scenes/s2_budget.js
import { THREE, C, shot, cue, ease, easeOut, pop, V, text, stat, tag, card, box } from '../engine.js';
import { gridFloor, orbit, memory } from '../models.js';

shot({ t0: cue('The second one is space', 41.6) - .1, build(S) {
  const st = { mem: memory(8, 4, .42, .08, 'navy') };
  S.scene.add(st.mem, gridFloor(80, 1, C.navy));
  st.tSpace = cue('space', 42.5); st.t32 = cue('32 megabytes', 47);
  st.hits = [st.tSpace, st.t32];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(0, 1, 0), 5.6, .2 + (t - S.t0) * .03, .9);
  st.mem.cells.forEach((c, i) => st.mem.set(i, t > st.tSpace + i * .04 ? 'sky' : 'navy'));   // cells fill one by one
}, draw(st, t, S) {
  const a = ease((t - st.tSpace) / .4);
  text('SPACE', 18, 43, { size: 16, font: 'head', weight: 900, align: 'left', alpha: a });
  stat(160, 132, '32', 'MB', { alpha: ease((t - st.t32) / .4), size: 18, label: 'all of it, right now' });
}});
```

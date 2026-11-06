# Vox engine API (engine.js v1, models.js)

```js
import { shot, cue, card, cutout, photo, words, tag, scribble, board, image, C, FRAME, fmt, clamp, seg, lerp,
         ease, easeIn, easeOut, easeInOut, easeOutBack, settle, rng, THREE } from '../engine.js';
import { pushpin, tape, paperclip, string, pencil, frame, coin, coinStack, bill, billStack, calendarPage,
         keycap, keyRow, typewriter, typeBasket, upright, sun, spectrum, waveCard, molecule, atmosphere,
         person, engraving } from '../models.js';
```

## Space and time
- The board is the XY plane at z = 0; the camera looks down -Z. At zoom 1 the frame shows exactly `FRAME.w x FRAME.h`
  units (9 x 16 vertical, 16 x 9 landscape) centred on the view point. +z is toward the camera (height above the board).
- Times are seconds. `cue('word', approx, which = 's'|'e')` = when the narrator says `word` (nearest occurrence to
  `approx`); multi-word cues work (`cue('rule of', 3.2)`). Use cues for every landing, never raw times. Words match
  without case or accents, in any language (engine v2+).
- Colours: `C.paper C.paper2 C.ink C.accent C.accent2 C.muted C.dark C.light C.line C.bg C.white C.black` follow the
  look's theme; hex strings are fine for subject colours.

## Shots
```js
// ---- 3: divide 72 by your yearly return ----
shot({ t0: cue('divide', 5.0) - .1, trans: 'blur', build(S) {
  S.board('grid'); S.light = 'desk';
  const st = {};
  st.card = card({ w: 7.4, h: 5.2, color: '#fbf8f0' }); st.card.position.set(0, .4, .18); S.add(st.card, { in: 'none' });
  st.n = words('72', { size: 2.4, font: 'gothic' }); st.n.position.set(-2, 1.2, .21); S.add(st.n, { in: 'none' });
  st.ul = scribble('underline', { w: 3, h: .4, at: cue('return', 7), dur: .35 }); st.ul.position.set(1.8, .2, .2); S.add(st.ul, { in: 'none' });
  S.view = { zoom: 1.1, y: .5 }; S.drift = { zoom: .05, x: .1 };
  return st;
}, update(st, t, S) { /* optional per-frame animation */ }, draw(st, t, S) { /* optional 2D overlay (HUD units) */ } });
```
- `t0`: start (the previous shot ends there). `trans`: how this shot comes in: `'slide-left'|'slide-right'|'slide-up'|
  'slide-down'` (cut the curve with motion blur), `'whip-left'|'whip-right'` (faster), `'blur'` (rack focus),
  `'push'` (zoom-through), `'paper'` (sheet wipe), `'cut'`. `transDur` overrides the length (look setting by default).
- Keep objects you may want to click or animate on `st` (st.card, st.pins[2]) - the editor's picks resolve to them.
- `S.board(kind, opts)`: `paper | grid | dots | wood | felt | cork | plaster | chalk | newsprint | swirl | stripes`;
  opts: `color`, `color2` (swirl), `scale` (world units per texture tile), `tint: [dark, light]` (newsprint),
  `headlines`, `masthead` (newsprint), `darken` (0..1).
- `S.light`: `'desk'` (warm key, soft shadows) | `'studio'` (neutral) | `'spot'` (pool of light, dark edges) | `'flat'` |
  `'window'`; `S.lightDir = [x, y, z]`; `S.shadowSoft` (x softness); `S.shadows = false`.
- Camera: `S.view = { x, y, zoom, rot, tilt }` (tilt 0.2-0.6 looks at 3D props from the front); `S.drift = { zoom, x, y,
  rot }` accumulated over the shot; `S.moves([[at, { x, y, zoom, rot, tilt }, dur = .9], ...])` eased moves.
- Depth of field: `S.dof = 0..1` (blur grows with distance from the focus plane), `S.focusZ` (focus height, default 0).
  `S.blur = 0..1` blurs the whole shot. `S.aberration` for screen content (default from the look, usually 0).
- `S.bg` clear colour (rarely visible), `S.envIntensity` (metal reflections).

## Bringing things in
`S.add(obj, { at, in, from, dur, out, outAt, outDur, sfx })` adds to the scene and animates:
- `in`: `'drop'` (falls onto the board, shadow tightens: paper) | `'slide'` (from `'left'|'right'|'top'|'bottom'`) |
  `'pop'` (overshoot scale: stickers, tags) | `'flip'` | `'rise'` (text) | `'fade'` | `'grow'` | `'spin'` | `'none'`
  (present from the start). Objects hold still after landing.
- `out`: `'lift'` (toward camera and away) | `'slide'` | `'fade'` | `'drop'`, at `outAt`.
- `sfx`: false, or a sound type to override the default (drop = paper, slide = slide, pop = pop, ...). See sound_design.md.
- Place first (`obj.position.set(x, y, z)`, `obj.rotation.z`), then `S.add`: the rest pose is where you put it.

## Paper and images
- `card({ w, h, color, draw(ctx, cw, ch, t, pxPerUnit), dynamic, torn: 0..2, edges: 'tblr', radius, border, curl, seed })`
  A sheet of paper with anything drawn on it (canvas pixels, `cw x ch`). `dynamic: true` redraws every frame
  (charts that grow with t). Torn edges for clippings; `border` white margin; `curl` lifts the corners.
- `cutout({ w, h, draw, border = .09, treat, grain })` a sticker: draw on a transparent canvas, it gets a white border.
- `photo({ w, h, build(sub), style: 'duotone'|'halftone'|'bw'|'color', ink, light, mid, cut = true, frame: true, pad, border, cell })`
  A printed photo of a procedural 3D subject: `build` gets `{ scene, cam, THREE, key, rim }` - add your models to
  `sub.scene`; `frame: true` fits the camera. `cut: true` = sticker cut to the subject; false = rectangular print.
- `image(key, { w, cut, border, treat, torn })` a real image from project.json "images" (assets/), same treatments.
- Treatments on canvases: `halftone(canvas, { cell, ink })`, `duotone(canvas, { dark, light, mid })`, `roughen(canvas, amt)`,
  `stickerize(canvas, px)`, `renderToCanvas(build, w, h, { frame, pad })`.

## Text
`words(text | t => text, opts)` a text element (transparent unless `plate`):
`size` (font size, units), `font`: `'serif'|'garamond'|'gothic'|'condensed'|'black'|'mono'|'sans'`, `weight`, `italic`,
`color`, `align`, `width` (wrap), `lineHeight`, `spacing` (em), `upper`, `plate` (paper colour behind), `pad`, `radius`,
`stroke: { color, width }`, `shadow`.
Animations: `anim: 'none'|'fill'|'type'|'random'|'odometer'|'rise'|'decode'`, `at`, `dur`, `accent` (fill colour).
Marks: `highlight: { match: 'word' | from, to, color, at, dur }`, `underline: { color, at, dur }`.
A function as text makes a live counter: `words(t => '$' + fmt(lerp(800, 1497, easeOut(seg(t, a, b)))), { font: 'mono' })`.
`fmt` writes numbers the way the narration's language does (project.json "language"; engine v2+).

`tag(text, { style: 'paper'|'plaque'|'sticker'|'tape'|'dark', size, font, color })` labels: torn paper strip, dark
plaque with gold keyline, white sticker, masking-tape label, dark chip.

`scribble(kind, { w, h, color, width, at, dur, pts, bend, seed })` marker annotations that draw on:
`'circle'|'underline'|'arrow'|'cross'|'check'|'box'|'bracket'|'path'` (`pts` in 0..1 space; 3 points = curve).

## Props (models.js)
`pushpin(color)`, `tape(w, h)`, `paperclip()`, `string([x,y,z], [x,y,z], color)`, `pencil(len)`, `frame(w, h, { style: 'gilt'|'wood' })`
(content goes at `frame.userData.inner`), `coin({ label })`, `coinStack(n)`, `bill(value, { w })`, `billStack(n, value)`,
`calendarPage(big, small)`, `keycap(letter)` (`.userData.press(k)`), `keyRow('QWERTY')` (`.userData.keys[L]`),
`typewriter({ typed(ctx, cw, ch, t) })` (Y-up: wrap with `upright()`; `.userData.pressKey(L, k)`, `.userData.armUp(i, k)`),
`typeBasket()` (top-down type-bar fan; `.userData.fire(i, k, skew)`), `sun({ d })`, `spectrum()`, `waveCard({ wavelength, color, at })`,
`molecule()`, `atmosphere()`, `person({ h, color })`, `engraving({ label })`.
New props: build them from `THREE` meshes with `solidMat(color, { rough, metal })` / `paperMat(texture)` and cast shadows;
keep them Y-up and wrap with `upright()` if they have a "top", or build them flat on XY.

## HUD (2D overlay, rarely needed)
`draw(st, t, S)` runs after the 3D frame in HUD units (`W x H` = 540 x 960 vertical): `text(str, x, y, { size, font, col,
align })`, `rect()`, `line()`. Use it for source credits or debug, not for the main typography (that belongs in the collage).

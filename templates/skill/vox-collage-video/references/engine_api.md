# Collage engine API (engine.js, ENGINE_VERSION 7)

```js
import { panel, shot, finale, cue, shake, C, drawn, rng, ... } from '../engine.js';
import { gauge, plusSign, row } from '../models.js';
```
Units: a panel is 16 x 9 (vertical format: 9 x 16) with its origin at the centre, y up. Times in seconds.
Every element takes `{ x, y, rot (degrees), scale, at, in, dur, out, outAt, outDur, layer, sfx }`.
- `at`: when it arrives (use `cue('word', approxTime)`; words match without case or accents, in any language, engine
  v4+); `at <= 0` = on the paper from frame 0. `fmt(n, dec)` writes numbers the narration's language's way.
  Japanese, Chinese and Thai (no spaces): a cue may span several timed words (engine v7+): `cue('東京タワー', 12)` finds
  "東京" + "タワー"; copy cue words from audio/script_timed.txt. Their letters (and Korean and Hindi ones) draw in a
  bundled font the preview adds under every Vox font, so any `font` works; break long lines yourself between words, no
  `spacing` on Thai or Hindi, and no letter-by-letter typing of Thai or Hindi.
- `in`: `'drop'` (default: placed on the paper) | `'slide-left|right|up|down'` (arrives from that side) | `'pop'` |
  `'grow'` | `'ink'` (stamps: soaks in) | `'print'` (revealed left to right with a slight rise) | `'rise'` | `'fade'` |
  `'wipe'` | `'none'`. (There is no slam: it maps to ink / print.)
- `out` (optional, with `outAt`): `'lift'` | `'fade'` | `'drop'` | `'slide-left|right|up|down'`.
- `layer`: draw order bucket (0 cut-outs, 1 type, 2 labels, 3 stamps/marks, 4 tape); later calls draw on top within one.
- `sfx`: sound name to override, or `false` for none (each entrance has a default sound).
- `spin` (radians/s, e.g. gears), `bob: { amount, speed }` (use rarely).
- `over: true | [element or label, ...]`: this overlap is intended (the layout check won't flag it).
- `bleed: true`: this element is meant to run off the frame (a close crop). Rare.

## Panels and the camera
- `panel(slot, { bg, title, tilt, torn, color })` -> P. (`title` only names it in the editor: nothing is drawn.) `slot`: position on the front page, 0 = top-left, then left to
  right, `settings.sheet.cols` per row (default 4). `bg`: `'paper' | 'paper2' | 'kraft' | 'parchment' | 'newsprint' |
  'white'` or an IMG name (a `make_image` background).
  All element functions exist as methods: `P.cutout(...)` === `cutout(P, ...)`.
- `shot({ at, panel, x, y, zoom, rot, trans, dur, drift, name })`: from `at` the camera looks at `panel` + (x, y) with
  `zoom` (1 = the panel fills the frame; 1.2-1.45 for close framings). `trans`: `'whip'` (default between panels) |
  `'move'` (default inside a panel) | `'slide'` | `'push'` | `'cut'`. `drift`: creep-in over the shot (default .035).
  Transitions are centred on `at`.
- `finale({ at, title, kicker, edition, issue, tag, footer, font, masthead, dur = 2.6, loop = true, loopDur = 1.6 })`: pull back to the
  whole front page (every panel finished), masthead prints; with loop the last loopDur seconds push back into the
  first shot's framing so the video ends on its first frame. Call it once, in the last scene file.
- `shake(at, amount, dur)`: exists, but don't use it (it reads as slapped on).

## Pictures
- `cutout(P, name, { h | w, border = 10, flip })`: an IMG with transparency; hand-cut white border + soft shadow.
- `photo(P, name, { w | h, torn = true, border })`: a rectangular image printed on torn paper.
- `paperPiece(P, { w, h, color, torn })`: a torn sheet (to compose on). color: paper names or '#hex'.
- `newspaper(P, { w, name, date, headline, sub })`: a whole newspaper page (blackletter masthead, rules, columns).
- `scatter(P, name, { n, at, dur, spread, h, from: [x, y], to: [x, y], spin, stay })`: copies of a cut-out flying across.
- `dots(P, [[x, y], ...], { at, stagger, r, color, ring, layer })`: pins popping in one after another.
- `drawn(P, { w, h, draw(ctx, k, time, W, H), at, animDur, key(time), shadow })`: anything drawn on a canvas;
  `draw` runs when `key(time)` changes (default: 60 steps of progress k over animDur). models.js `gauge()` uses it.

## Type
- `ransom(P, 'EVERY BOOK', { size = 1.1, at, per = .07, anchor })`: ransom-note letters dropped one by one.
- `headline(P, text, { size = 1, font, color, anim, at, dur, anchor, italic, bg, spacing })`: anim `'type' | 'print' |
  'rise' | 'fade' | 'wipe' | 'drop'`. fonts: `blackletter, typewriter, script, courier, anton, abril, serif, condensed,
  heavy, gothic, mono, sans`.
- `script(P, text, { size = 1, color, at, dur, pen, penH, penTip, anchor })`: handwriting written left to right; `pen` = an
  IMG name (a quill) whose nib (found automatically, or `penTip: [u, v]` in the image) rides the ink being revealed.
  The pen lifts away 0.08 s after the last letter; `script.at + script.dur + .5` is when marks may start.
- `label(P, text, { style, size = .32, at, anchor, color })`: `style` `'typewriter'` (typed on a strip) |
  `'strip'` | `'black'` (white caps on black tape) | `'tag'` (red box) | `'plain'`.
- `stamp(P, text, { size = .8, rot = -1.5, color = C.red, at, box = true, font, backing })`: inked type that soaks in. Use it
  ONLY for a date or number, unboxed and level (`box: false, rot: 0`). BANNED (every style): a red boxed rubber stamp or any
  verdict / status word ('CLOSED', 'DENIED', 'THE END', 'CLASSIFIED'): "straight slop".
  `backing: true` puts it on a paper chip (maps, kraft, anything busy).
- `counter(P, { from, to, x, y, size = 1, at, countDur = 1.6, prefix, suffix, suffixEnd, dec, card = true, color })`.
- `mark(P, { type, around, word, x, y, w, h, x2, y2, at, dur, color, width, target })`: marker drawn on: `'circle' |
  'underline' | 'arrow' | 'cross' | 'strike' | 'box'`. `around: element, word: 'hand'` puts it exactly around that word
  of a script/headline (and sets target). A mark may only cross its `target`.
- `wordBox(element, word)` -> `{ x, y, w, h }`: exactly where a word of a script/headline sits.
- `tape(P, { x, y, w, rot, at })`: masking tape.
- models.js: `gauge(P, { size, max, from, to, unit, at, dur })`, `plusSign(P, { x, y, at })`, `row(n, { x0, x1, y })`.

## The layout check
`layoutIssues(t)` / `checkTimes()` (the app's `check_layout` tool runs them at every steady frame): cut, frame, overlap,
mark, small, contrast. See SKILL.md for the SOP.

## Colours, settings
`C.paper, paper2, kraft, parchment, sheet, ink, red, blue, muted, light, tape` (theme from settings.theme:
press | sepia | broadsheet). `SETTINGS` = project.json "settings" (set by looks in the app; don't edit by hand).
Brand colour (engine v8): the look's `brand.color` ('#rrggbb' or unset) becomes the one loud colour: `C.red` (stamps,
dates, marker circles and arrows, tags, red headlines) is the brand colour moved just enough to read on the paper.
`C.brand` is the exact colour (fills behind ink: highlighter swipes, sticker backings), `C.brandInk` the text on it;
`BRAND = { on, color, ink, accent }`. Unset, all of them are the theme's red. Use `C.red` / `C.brand`, never a literal red.
Look switches (engine v5, in DEFAULTS / settings): `look: { torn, texture, masthead, titleFont }` - `torn: false` = clean
straight edges instead of ragged paper (panels, photos, paper pieces, labels, stamp chips, cards, tape), `texture: false` =
flat colour surfaces (no fibres, blotches, newsprint), `masthead: false` = the finale shows the panels without a newspaper
title (`titleFont` sets its font). `border: 0` = cut-outs without the white sticker border. A custom style sets these in
its own engine.js DEFAULTS.
Images: `IMG[name]` (project.json "images", filled by make_image).

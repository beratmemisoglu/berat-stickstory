# API — `assets/motion/smooth.js` (`window.SMOOTH`)

Load after GSAP: `<script src="vendor/gsap.min.js"></script><script src="motion/smooth.js"></script>`.
All helpers take the master timeline `tl` first and an absolute time `at` in seconds; times
are quantized to 1/30 s internally. Selectors are CSS strings or elements. Every helper
returns the time its motion ends where useful.

## Eases (registered on GSAP by name)
| name | bezier | doctrine §1 role |
| --- | --- | --- |
| `snapOut` | (0.08, 0.98, 0.18, 1) | entrances, punches, bars, counters |
| `mid` | (0.70, 0.00, 0.30, 1) | repositions, zoom-outs, stack shifts |
| `exitIn` | (0.70, 0.00, 0.84, 0) | exits |
| `drift` | (0.30, 0.00, 0.70, 1) | prolonged hold motion |

Constants: `S.q(t)` frame-quantize, `S.f(n)` frames→seconds, `S.OP` = 5 frames (0.167 s).

## Text
- `S.words(el)` → splits text nodes into `<span class="w">` per word (idempotent). Called
  for you by `ramp`/`rampOut`. Inline children (e.g. accent `<span>`) are preserved.
- `S.ramp(tl, sel, at, {dur=0.5, stagger=0.085, scaleHit=false})` → doctrine §4.1 word
  ramp: y +90 %, opacity 0, blur 0.12 em → rest, `snapOut`. `scaleHit` adds the R1
  "dynamic" 1.06→1 scale on the whole line. Returns end time.
- `S.rampOut(tl, sel, at, {dur=0.38, stagger=0.03})` → words leave upward, `exitIn`.

## Blocks
- `S.maskUp(tl, sel, at, {dur=0.7})` → §4.2 slide-up inside a `.mask` parent (y 115 % → 0,
  `snapOut`, 5-frame opacity). Use for pills, rows, bubbles, strike rows.
- `S.cardIn(tl, sel, at, {dir='left'|'right'|'up'|'down', dist=220, dur=0.8})` → §4.3 card
  entrance along a slight curve with 3° settling rotation and 0.96→1 scale. `dir` is where
  it comes **from**.
- `S.cardOut(tl, sel, at, {dir, dist=260, dur=0.45})` → §5 slide-out, `exitIn`, opacity in
  the last 5 frames.
- `S.scaleAway(tl, sel, at, {dur=0.4})` → §5 centered exit: scale 1→1.08 + opacity.
- `S.react(tl, sel, at)` → the only overshoot: 10-frame `back.out(1.2)` from scale 0.6.
  For a checkmark, a button, a bubble "arriving". Never for headlines.
- `S.grow(tl, sel, at, dur=0.6, origin='left center')` → scaleX 0→1, `snapOut`. Bars,
  strike lines, rules. Element needs `transform-origin` via `origin`.
- `S.count(tl, sel, at, from, to, dur, fmt?)` → tabular counter, `snapOut`. `fmt(v)` returns
  the string (e.g. `v => Math.round(v) + '%'`).

## Movement while on screen
- `S.drift(tl, sel, at, dur, props)` → §3 "never rest": e.g. `{y:-24}` or `{x:-26}` on the
  card's **outer null** for the whole hold. One drift per hold, in the direction of travel.
- `S.move(tl, sel, at, props, dur=0.6)` → `mid` reposition (a headline whipping to another
  column, a stack shifting up). Animate a **different wrapper** than the entrance used.

## Camera (needs `#cam-drift > #cam-snap` around the stage)
- `S.punchIn(tl, at, {scale=1.06, dur=0.45, origin='50% 42%', driftTo=1.02, driftDur=3})`
  → snap on `#cam-snap` (`snapOut`) then linear drift on `#cam-drift` starting at the snap's
  midpoint. House range: `scale` 1.05–1.09, `driftTo` 1.015–1.02. Origin: between the
  subject and the active text column so text stays inside safe margins.
- `S.zoomOut(tl, at, {dur=0.7})` → both nulls back to 1 with `mid`; start it before the
  drift ends.
- `S.wiggle(...)` exists for completeness and is **banned** (doctrine §7). Do not call it.

## Null wrapper pattern
```html
<div class="scene clip" id="s3" data-start="7.45" data-duration="6.95" data-track-index="1">
  <div class="n" id="s3-n2">        <!-- drift / reposition -->
    <div class="n" id="s3-n1">      <!-- (spare) -->
      <div class="col-l"> …content with ids… </div>
```
Entrance helpers target the content ids; `drift`/`move` target `#s3-n2`; exits target the
content again (a different property than the drift, so no fight).

## Timing recipe for one card (copy this)
```js
S.ramp(tl, "#s3-k", t0, { dur: 0.45, stagger: 0.06 });      // kicker on the first word
S.ramp(tl, "#s3-t", t0 + 0.2, { scaleHit: true });          // headline
S.cardIn(tl, "#s3-card", tRow - 0.45, { dir: "left" });     // card lands just before its first row
S.maskUp(tl, "#s3-row1", tRow);                              // rows on their spoken words
S.drift(tl, "#s3-n2", t0 + 0.6, hold, { y: -24 });           // never rest
S.punchIn(tl, tStress, { scale: 1.05, origin: "38% 42%" }); // optional
S.zoomOut(tl, tEnd - 0.9);                                   // release before the exit
S.rampOut(tl, "#s3-t", tEnd - 0.4); S.rampOut(tl, "#s3-k", tEnd - 0.45);
S.cardOut(tl, "#s3-card", tEnd - 0.4, { dir: "left" });
// next card's first entrance at ≈ tEnd - 0.2 (midpoint of this exit)
```

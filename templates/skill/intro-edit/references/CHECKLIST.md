# Pre-render checklist

Run every item. If any fails, fix and re-snapshot before rendering.

## Motion
- [ ] Every entrance uses `snapOut` (`ramp`, `maskUp`, `cardIn`, `grow`, `count`, `punchIn`).
- [ ] Every exit uses `exitIn` (`rampOut`, `cardOut`, `scaleAway`, slide-outs).
- [ ] Every on-screen reposition and zoom-out uses `mid`.
- [ ] The only overshoot is `S.react` on a UI reaction, never on text.
- [ ] No `S.wiggle`, no camera shake, no idle loop, no `repeat: -1`.
- [ ] No crossfade. Opacity only as the 5-frame helper inside a move.
- [ ] No blur except the per-word 0.12 em in `ramp`. No glow.
- [ ] Every card holding > 1.5 s has a `drift` on its outer null.
- [ ] Each chained movement starts at the midpoint of the previous one (entrances of the
      next card overlap exits of this card).
- [ ] Zooms: 5–9 % punch, 1.5–2 % drift, origin biased toward the active column; opening
      push ≤ 3 %; final push ≤ 12 %.

## Sync
- [ ] Each graphic lands on its stressed word (start = word − 0.08 s), verified against
      `transcript.json`.
- [ ] Rows/list items reveal on their own spoken words.
- [ ] Counters run for the length of the phrase they illustrate.
- [ ] Clean-footage moments exist where the script is personal.

## Layout & type
- [ ] Nothing inside the safe zone (except a scripted joke).
- [ ] Text is left-aligned inside a column, ≥ 200 px from any canvas edge at max zoom.
- [ ] Inter 700 headlines 150–190 px (4K) / 75–95 px (1080p), letter-spacing −0.02 em;
      Inter 500 for labels; white; shadow `0 6px 24px rgba(0,0,0,.45)`.
- [ ] Palette only from the Apple set; one accent per video.
- [ ] Cards: 36–44 px radius, 1.5 px inner stroke, inner padding ≥ 48 px, row gap ≥ 28 px.
- [ ] `.mask` wrappers have side padding so sideways exits are not clipped.

## Verification
- [ ] `hf.py check` → 0 errors (layout overlaps are real; fix them).
- [ ] Snapshots taken at every landing, every mid-transition, every zoom peak, and read.
- [ ] No empty card visible for > 0.5 s.
- [ ] Original footage file untouched (`ls -l` timestamps unchanged).

## Delivery
- [ ] `hf.py render` printed RENDER OK: 3840x2160, the composition fps, audio present, duration = clip.
- [ ] Sound-effects pass done: `output.sfx.wav` written, its report read, every CHECK line fixed.
- [ ] One short table of cards, zooms and sounds in the hand-off message.

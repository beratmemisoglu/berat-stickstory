# Layout — canvas, columns, type scale, card anatomy

All values for a 3840×2160 canvas. For 1920×1080 multiply every px by 0.5.

## Safe zone (measure per clip, WORKFLOW step 3)
A talking head framed center usually occupies x 1350–2350, y 350–1600 including hand
gestures. Write the measured box into `storyboard.json.safeZone`. Nothing enters it.

## Columns
| column | x | width | vertical anchor | use |
| --- | --- | --- | --- | --- |
| left | 260 | 1040 | center at 1040 (eye line) | headlines, bars, strikes, bubbles |
| right | 2560 | 1060 | center at 1040 | lists, file panels, counters, pills |
| chest band | 0–3840 centered | — | top ≈ 1720 | hero one-liners, name plate |

If the subject sits left of center, mirror: use the right column for primary text.
Keep ≥ 200 px from every canvas edge **at maximum zoom** (a 1.09 punch with origin near
center pulls the far edge in by ~9 % of the distance to the origin).

## Type scale (Inter; SF Pro Display is the intent)
| role | size | weight | tracking | line-height | color |
| --- | --- | --- | --- | --- | --- |
| h1 headline | 172 | 700 | −0.02 em | 1.0 | white |
| h2 headline | 132 | 700 | −0.02 em | 1.02 | white |
| sub | 68 | 500 | −0.005 em | 1.2 | #E5E5EA |
| label / kicker | 48 | 500 | 0 | 1.2 | #8E8E93 |
| pill | 72 | 700 | −0.01 em | — | white |
| row | 76 | 700 | −0.015 em | — | white |
| big stat | 300 | 700 | −0.04 em | 1.0 | white, tabular |
| bubble | 68 | 500 | −0.01 em | — | white on #007AFF |
Shadow on anything over footage: `0 6px 24px rgba(0,0,0,.45)`. No shadow on text inside a card.
Sentence case. No uppercase kickers.

## Palette
`#FFFFFF` text · `#E5E5EA` secondary · `#8E8E93` muted · `#3A3A3C` subtle UI · `#1C1C1E` dark card
`#007AFF` blue · `#34C759` green · `#FF9500` orange · `#FF3B30` red
One accent per video, chosen to match the footage's practical light.

## Card anatomy
- Dark glass: `rgba(28,28,30,.78)`, `backdrop-filter: blur(40px)` (this blur is a material,
  not a motion; it never animates), radius 40, `inset 0 0 0 1.5px rgba(255,255,255,.18)`,
  shadow `0 24px 60px rgba(0,0,0,.35)`, padding 48/56.
- Pill: radius 999, padding 30/56/30/44, leading 26 px dot in the accent.
- iMessage bubble: radius 44 with one 12 px corner, blue `#007AFF` outgoing, `#E5E5EA` incoming.
- Bar: track 34 px `rgba(255,255,255,.14)`, fill in accent, label row above (60/56 px).
- Strike: 12 px red line at 52 % height, grows from left.
- Frame outline (for "everything on screen"): inset 96, radius 64, 8 px white stroke,
  drawn with dash-offset, `snapOut` 1.1 s.
- Name plate: 260×10 accent rule, name 160/700, tag 56/500, at x 260, y 1720.

## Scene container
```
#root > #cam-drift > #cam-snap > #stage > [video, #gfx > .scene.clip*]
```
Graphics live inside the camera so zooms read as one shot. Audio is a separate
`<audio>` on the root with the video muted.

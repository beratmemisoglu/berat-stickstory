# {{NAME}} - quality

Every finding is written **finding -> what it means -> exact fix**, in the same words the check prints. Every video built
in this style and every review reads this file. One row per line; numbers, not adjectives.

## Checks every style gets (the engine's layout check)

These rows use the starter engine's words. A base with other finding names (flat `shading`, collage `frame`, recon
`HOLD`, lowpoly `feet`) keeps its own: copy them from docs/bases/{{BASE}}/dont.md and docs/CHECKS.md. Pixel art and
stickman have no layout check: say so here and list the frame checks instead.

| Finding (as printed) | What it means | Exact fix |
|---|---|---|
| cut: is within N px of / crosses the frame edge | an element is cropped or crowds the edge | keep it inside SAFE, or `userData.bleed = true` if the crop is intended |
| caption: reaches into the caption band | it sits where captions draw | move it into the content zone (ZONE) |
| overlap: N% of the smaller one is covered | two elements collide by accident | separate them, or `userData.over = [other]` when one is meant to sit on the other |
| small: text is N px tall on screen | unreadable on a phone | at least the engine's minimum (labels), 90+ px for titles |
| contrast: text ... has contrast N (needs M) | text does not read on what is behind it | `legibleOn(color, bg)`, or put it on a plate |
| empty: only N% of the content zone holds anything | the frame says nothing | bigger subject, add what the narration names, or `S.sparse = true` if emptiness is the idea |
| DARK: the picture is too dark to read | the subject can't be seen | light the subject / lighten the background (never by turning text up) |
| CRUSHED: N % of the picture is crushed black | shadows lose all detail | lift the background and shadows (hemi light, lighter ground) |
| ABRUPT: camera: ... | the camera snaps or whips | ease from rest to rest over >= 1.5 s, or cut |
| kit: the element is not fully and comfortably in frame | a kit element can't be judged | show it whole, 6 % from every edge, >= 12 % of the frame |
| floating: its bottom is N m above the ground | a 3D solid hovers | rest it (y = 0 or the top of what holds it), or `userData.airborne = true` |
| through: they pass through each other | solids interpenetrate | move one so they touch without passing through |
| coplanar: two surfaces N m apart will flicker | z-fighting | lift the top one or make it one surface |
| flicker: N px change when only the depth precision changes | z-fighting seen in the render | separate the surfaces by a few cm |

## This style's own findings

What breaks THIS look (its palette, type, elements, motion), one row each. Every row a machine can check has a
`LAYOUT_CHECKS` entry and a must-fail view (docs/METHOD.md stage 4); the rest are checked by eye in every review.

| Finding | What it means | Exact fix |
|---|---|---|
| _(to fill)_ | | |

## Severity changes (optional)

The checks file each engine finding as high (cut, caption, DARK, CRUSHED, floating, through, coplanar, flicker ...),
medium (overlap, small, contrast, kit, FROZEN, SAME) or low (empty, ABRUPT). A style that needs another level writes one
line per finding type here, with the reason, for example:
`- severity EMPTY: high` (the style's whole point is a full frame)

## The bar (one paragraph every shot is judged by; it becomes `prompts.qualityBar` when that is empty)

_(to fill)_

# {{NAME}} - quality

Every finding is written the way the review loop uses it: **finding -> what it means -> exact fix**, in the same words
the check prints (check_layout's type in capitals as it appears). Issues quote these lines; a fixed issue's lesson
goes to PITFALLS.md (written by the app). Keep each line one row; numbers, not adjectives.

## Checks every style gets (the engine's check_layout)

These rows are the starter engine's words; a base with other check names (flat `band`, recon `contact`, lowpoly
`feet`) keeps its own words: copy them from bases/{{BASE}}/dont.md when they differ.

| Finding (as printed) | What it means | Exact fix |
|---|---|---|
| CUT: is within N px of / crosses the frame edge | an element is cropped or crowds the edge | keep it inside SAFE, or `userData.bleed = true` if the crop is intended |
| CAPTION: reaches into the caption band | it sits where captions draw | move it into the content zone (ZONE) |
| OVERLAP: N% of the smaller one is covered | two elements collide by accident | separate them, or `userData.over = [other]` when one is meant to sit on the other |
| SMALL: text is N px tall on screen | unreadable on a phone | at least the engine's minText (labels), 90+ px for titles |
| CONTRAST: text ... has contrast N (needs M) | text does not read on what is behind it | `legibleOn(color, bg)`, or put it on a plate |
| EMPTY: only N% of the content zone holds anything | the frame says nothing | make the subject bigger, add what the narration names, or `S.sparse = true` if emptiness is the idea |
| DARK: the picture is too dark to read | the subject can't be seen | light the subject / lighten the background (never by turning text up) |
| CRUSHED: N % of the picture is crushed black | shadows lose all detail | lift the background and shadows (hemi light, lighter ground) |
| ABRUPT: camera: ... | the camera snaps or whips | ease from rest to rest over >= 1.5 s, or cut |
| KIT: the element is not fully and comfortably in frame | a kit element can't be judged | show it whole, 6 % from every edge, >= 12 % of the frame |
| FLOATING: its bottom is N m above the ground | a 3D solid hovers | rest it (y = 0 or the top of what holds it), or `userData.airborne = true` |
| THROUGH: they pass through each other | solids interpenetrate | move one so they touch without passing through |
| COPLANAR: two surfaces N m apart will flicker | z-fighting | lift the top one or make it one surface |
| FLICKER: N px change when only the depth precision changes | z-fighting seen in the render | separate the surfaces by a few cm |

## This style's own findings

What breaks THIS look (its palette, type, elements, motion), each as a row. Add a row whenever a review finds a new
kind of fault.

| Finding | What it means | Exact fix |
|---|---|---|
| _(to fill)_ | | |

## Severity changes (optional)

The app files each check's findings as high (boot, throw, contract, broken check, banned call, CUT, CAPTION, DARK),
medium (OVERLAP, SMALL, CONTRAST) or low (EMPTY, ABRUPT). A style that needs another level writes one line per check
here, for example `- severity EMPTY: high` (a style whose whole point is a full frame).

## The bar (one paragraph Ultraedit and the review judge every shot by)

_(to fill)_

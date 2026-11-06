# The shot language

Scene files pass it to `script()` from engine.js (see SKILL.md). `cast <name> desc="..."` defines a person for make_sprites.

One statement per line; `#` starts a comment. A shot starts with `>`; everything until the next `>` belongs to it.

```
cast narr                                   # the narrator: plain white head
cast schli skin=light hat=top beard=stache  # a person, defined once
title THE CITY FROM THE STORY               # chapter header on every following shot (title - : none)

> Then in 1870,                             # narration of this shot (spoken while it is on screen)
card "1870" c=yellow                        # white frame + one big label

> a rich German businessman named Heinrich Schliemann
set town                                    # backdrop
schli C pose=hips e=smug wear=suit          # a character
text "Heinrich Schliemann" 50,88 c=yellow size=36

> decided the poem was a treasure map.
set white
schli CL pose=offer e=happy wear=suit hold=map
@treasure chest R s=1.2                     # appears when "treasure" is spoken (a beat)
```

## Positions
`L CL C CR R` (18/33/50/67/82 % across, standing on the set's ground), or `x` (percent across, on the ground),
or `x,y` (percent across, percent **up from the bottom**). Ground props stand on their position; float props
(marked `*` in the catalog) are centred on it (default height 60 %).

## Characters: `<cast name> <pos> key=value ...`
| key | values |
|---|---|
| pose | front: stand talk talk2 talkL shrug present pointR pointL pointUp wave waveL cheer scared hips think facepalm crossarms pray fight holdup shiver sit crosslegged dance — side: sstand stalk walk walk2 run run2 spoint offer carry push pull throw dig kneel crouch kneelpray sitchair sitground lie fall jump bow sneak swave sscared ride |
| e | neutral talk smile happy shock scared worried angry sad smug confused dead sleep think yell |
| dir | `l` mirrors a side pose to face left |
| size | XS S M L, or **XL = reaction close-up** (big head + shoulders, legs off-frame); `s=` exact scale |
| look | l r u d (pupils) |
| skin | white light tan brown dark green gray blue (or any colour) |
| hat | pith fisher viking crown cowboy top wizard helmet conquistador feather cap hood chef hardhat mitre turban laurel |
| hair / hairc | spiky tuft long bun bald cap / colour |
| beard | full, stache · `glasses=1` |
| hold / hold2 | near or screen-left hand / other hand: spear staff torch sign flag book scroll cup bottle apple coin bag lantern skull gem phone fish bone sword shovel pickaxe magnifier stick rope map shield (`-` = nothing) |
| wear / wearc | robe dress vest suit cape / colour · `back=1` backpack |
| on | seat for `sit`/`sitchair`: rock (default) chair log none |

Poses with `seat` in the catalog sit on a seat drawn under them; `lie` lies on the ground; `float` (jump) uses the y you give.

## Props: `<prop> <pos> key=value ...`
`s=` scale, `c=` colour, `flip=1` mirror, `rot=` degrees, `text="..."` (sign, speech, thought, label, impact,
number, layers, slab, gravestone, shaker), `len=` (arrow, dashes, measure, fence, wheat, slab), `h=` (slab),
`r=` (circle), `hi=` (layers: highlighted band, 0 = top), `cut=1` (layers: a trench), `tilt=` (scales),
`fire=1` (machinegun), `run=1 e= helmet=1 crown=1` (emu), `e=` (goat), `steam=0` (mug).

## Text
`text "words" <pos> c=red size=40` — red for facts/numbers, yellow for names/places/dates, blue/green for science
terms. `card "..." c=` = white frame with one big label. Without `c=`, text, cards, `label` and `number` use the colour
`accent`: Paint red, or the look's Brand colour when it sets one (engine v5; `c=brand` is the exact brand colour). With a
Brand colour, use `c=accent` where you would have used red for facts, numbers and dates. `\n` in a string breaks the line.

## Photo
`photo <pos> img=<name> s=.5 text="Lake Nyos"` — a framed real photo (made with web_image) with a caption.
`photo <pos> set=sea s=.38 text="Lake Nyos" prop=volcano` — a framed picture of a mini drawn backdrop instead.

## Beats
Prefix any element line with `@word`: it appears when that word is spoken in this shot. Use for reveals
(an X after "no crater", the second number in a comparison).

## Backdrops: `set <name>`
white paper field plains desert snow mountains forest jungle village town city sea beach underwater night
glownight space sky storm volcanic cave indoor lab arena

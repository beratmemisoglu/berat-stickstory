// SAMPLE: a short explainer on the sample narration. One sentence = one picture; `@word` lines appear when that word
// is spoken, so every picture builds up on its words. Only the built-in narrator sprite (narr) is used.
import { script } from '../engine.js';

script(`
cast narr
title THE RUNAWAY MOON

> Look up tonight and you will see the Moon.
set night
narr 30 pose=pointUp e=talk
@tonight meteor 55,78 s=.8
@moon text "the Moon" 85,70 c=yellow size=36

> It sits about 384,400 kilometres away.
set space
globe 14,48 s=1.2
moon 86,48 s=1.5 c=#000010
@kilometres dashes 50,48 len=500 c=white
@kilometres text "384,400 km" 48,63 c=red size=48

> That gap is so wide that every other planet fits inside it.
set space
globe 11.04,50 s=1.1
moon 92,50 s=1.2 c=#000010
@wide measure 51.5,20 len=777 rot=90 c=white
@wide text "384,400 km" 53,31 c=red size=48
# the planets in order; only Saturn (and faintly Uranus) has a ring, so the others are plain discs (a filled circle)
@planet text "●" 20,50 c=silver size=77 outline=none
@planet text "●" 24.6,50 c=lyellow size=108 outline=none
@planet text "●" 30.2,50 c=red size=85 outline=none
@planet text "●" 39.6,50 c=orange size=238 outline=none
@planet planet 54.17,50 s=.52 c=gold
@planet planet 68.75,50 s=.38 c=cyan
@planet text "●" 81.25,50 c=blue size=138 outline=none

> And every year, the Moon drifts 3.8 centimetres further out.
set space
globe 16,48 s=1.2
moon 58,48 s=1.4 c=#000010
@drifts arrow 67,48 len=120 c=yellow
@drifts motion 50,48 c=white
@centimetres text "+3.8 cm a year" 41,14 c=red size=44

> About as fast as your fingernails grow.
set white
narr 34 size=XL e=confused
@fingernails thought 74,74 text="fingernails?"

> So enjoy the view while it lasts.
set night
narr 30 pose=crouch e=smile
@view sparkle 72,80 s=.9
@lasts hourglass 58,31 s=.9
`);

// HERO: the style at its best in three pictures (a title frame, the signature diagram, a reaction close-up).
// Shots are timed by the narration (audio/timeline.json): each `>` line starts when its words are spoken.
import { script } from '../engine.js';

script(`
cast narr
title -

> Look up tonight and you
set night
text "The Runaway Moon" 60,12 c=yellow size=64
narr 14 pose=pointUp e=talk

> will see the Moon.
title THE RUNAWAY MOON
set space
globe 14,48 s=1.3
dashes 50,48 len=520 c=white
moon 86,48 s=1.6 c=#000010
text "384,400 km" 48,63 c=red size=48
text "Earth" 14,24 c=yellow size=32
text "Moon" 86,24 c=yellow size=32

> sits about 384,400 kilometres away.
set white
narr 34 size=XL e=worried
text "3.8 cm\\na year" 72,56 c=red size=64
`);

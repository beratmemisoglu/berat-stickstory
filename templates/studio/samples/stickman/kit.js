// KIT: the style's elements, one per picture, on their usual backdrops: the narrator figure, a reaction close-up, a
// text card, a labelled backdrop, a diagram, a symbol, a spectacle, a framed picture and ground props.
// The `>` lines are pieces of the sample narration: they only time the pictures (about 2 s each).
import { script } from '../engine.js';

script(`
cast narr
title THE STYLE KIT

> Look up tonight and you
set field
narr C pose=pointR e=smug

> will see the Moon.
set white
narr C size=XL e=think

> sits about 384,400 kilometres away.
card "384,400 km" c=red size=72

> That gap is so wide that
set night
text "the Moon" 85,70 c=yellow size=36

> every other planet fits inside it.
set white
layers 46,46 s=1.5 text="crust|mantle|core" hi=2
text "inside the Moon" 50,80 c=yellow size=44

> And every year, the Moon
set white
hourglass 50,48 s=1.8

> drifts 3.8 centimetres further out.
set space
meteor 46,46 s=1.5

> About as fast as your
set white
photo 50,50 set=beach s=.6 text="the sea" c=yellow

> fingernails grow.
set field
tree 74 s=1.2
goat 36 s=1.4
`);

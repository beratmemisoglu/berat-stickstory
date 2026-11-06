// MUSTFAIL: DARK
// A deliberate mistake: the frame check must report it. If it ever passes, the check is broken (never fix this file).
// Dark hills painted in dark colours on the black space backdrop, nothing lit: a picture too dark to read.
import { script } from '../engine.js';

script(`
title -

> Look up tonight and you will see the Moon.
set space
hill 30,0 s=1.6 c=navy
hill 76,0 s=1 c=dgreen
boulder 54,0 s=.8 c=dgray
`);

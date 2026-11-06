// MUSTFAIL: BLANK
// A deliberate mistake: the frame check must report it. If it ever passes, the check is broken (never fix this file).
// The narrator is placed at x=150 (off the right edge of the frame) and there is no chapter title, so the picture is
// one flat white field.
import { script } from '../engine.js';

script(`
cast narr
title -

> Look up tonight and you will see the Moon.
set white
narr 150 pose=pointUp e=talk
`);

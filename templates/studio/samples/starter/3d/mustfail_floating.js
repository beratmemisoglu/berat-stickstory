// MUSTFAIL: floating
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, box, cyl, C } from '../engine.js';

// ---- mustfail: a box hanging in the air with nothing under it ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); S.ground(); const st = {};
  st.post = cyl(null, .25, 1, C.good, { x: -1.2 });
  st.float = box(null, .8, .8, .8, C.accent, { x: .8, y: .9 });
  return st;
} });

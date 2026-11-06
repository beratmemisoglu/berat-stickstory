// MUSTFAIL: cut
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, box, sphere, C, VERT } from '../engine.js';

// ---- mustfail: a box cut by the right edge of the frame ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); S.ground(); const st = {};
  st.ball = sphere(null, .5, C.accent2);
  st.edge = box(null, 1, 1, 1, C.accent, { x: VERT ? 2.4 : 5 });
  return st;
} });

// MUSTFAIL: DARK
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, box, sphere } from '../engine.js';

// ---- mustfail: a room with the lights nearly off (dim, but not a deliberate full black) ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg('#101013'); S.ground('#1c1c21'); S.light({ intensity: .3, hemi: .2 }); const st = {};
  st.crate = box(null, 1.2, 1.2, 1.2, '#3a3a42', { x: -.8 });
  st.ball = sphere(null, .5, '#3a3a42', { x: .9 });
  return st;
} });

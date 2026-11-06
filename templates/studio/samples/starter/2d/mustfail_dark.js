// MUSTFAIL: DARK
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, rrect, circle, ZONE } from '../engine.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;
// ---- mustfail: a picture too dark to read ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg('#060607', '#0b0b0d'); const st = {};
  st.box = rrect(null, 700, 420, 40, '#16161a', 0, cy);
  st.dot = circle(null, 120, '#1d1d22', 0, cy);
  st.dot.userData.over = true;
  return st;
} });

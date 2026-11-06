// MUSTFAIL: cut
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, W, ZONE } from '../engine.js';
import { badge } from '../models.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;
// ---- mustfail: a badge half off the right edge of the frame ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg('indigo'); const st = {};
  st.brain = badge(null, 'brain', { r: 220, scaleIcon: 2.4, x: 0, y: cy });
  st.clock = badge(null, 'clock', { r: 160, scaleIcon: 1.6, x: W / 2 - 40, y: cy });
  return st;
} });

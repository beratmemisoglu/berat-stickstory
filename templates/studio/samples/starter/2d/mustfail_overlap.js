// MUSTFAIL: overlap
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, card, ZONE } from '../engine.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;
// ---- mustfail: two cards on top of each other ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); const st = {};
  st.a = card(null, { w: 600, h: 320, x: -120, y: cy + 60, title: 'First card', body: 'Covered by the second one.' });
  st.b = card(null, { w: 600, h: 320, x: 140, y: cy - 60, title: 'Second card', body: 'Lies over the first.' });
  return st;
} });

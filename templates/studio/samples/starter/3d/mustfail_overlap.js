// MUSTFAIL: overlap
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, card, box, C, TITLE } from '../engine.js';

// ---- mustfail: two HUD cards on top of each other ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); S.ground(); const st = {};
  st.crate = box(null, 1, 1, 1, C.accent);
  st.a = card(null, { w: 600, h: 300, x: -120, y: TITLE.y - 60, title: 'First card', body: 'Covered by the second one.' });
  st.b = card(null, { w: 600, h: 300, x: 140, y: TITLE.y - 160, title: 'Second card', body: 'Lies over the first.' });
  return st;
} });

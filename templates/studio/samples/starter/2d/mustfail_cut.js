// MUSTFAIL: cut
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, card, title, W, ZONE } from '../engine.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;
// ---- mustfail: a card cut by the right edge of the frame ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); const st = {};
  st.title = title(null, 'Cut off', { y: cy + 200 });
  st.card = card(null, { w: 600, h: 320, x: W / 2 - 120, y: cy - 120, title: 'Half outside', body: 'The frame edge cuts it.' });
  return st;
} });

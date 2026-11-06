// MUSTFAIL: overlap
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, slab, text, C, ZONE, VERT } from '../engine.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;
// ---- mustfail: two cards lie on top of each other ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg('night'); const st = {};
  st.a = slab(null, VERT ? 640 : 700, 360, 36, C.white, { x: VERT ? -80 : -160, y: cy + 80 });
  text(st.a, 'First card', { size: 64, color: C.ink });
  st.b = slab(null, VERT ? 640 : 700, 360, 36, C.mint, { x: VERT ? 80 : 160, y: cy - 80 });
  text(st.b, 'Second card', { size: 64, color: C.ink });
  return st;
} });

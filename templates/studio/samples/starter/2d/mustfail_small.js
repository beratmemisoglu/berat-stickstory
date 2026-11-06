// MUSTFAIL: small
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, title, text, C, ZONE } from '../engine.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;
// ---- mustfail: a caption far too small to read ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); const st = {};
  st.title = title(null, 'Small print', { y: cy + 120 });
  st.fine = text(null, 'nobody can read this line on a phone', { size: 22, weight: 600, color: C.ink, y: cy - 60 });
  return st;
} });

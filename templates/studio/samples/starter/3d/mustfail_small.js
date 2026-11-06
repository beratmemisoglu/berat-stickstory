// MUSTFAIL: small
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, box, text, C, TITLE } from '../engine.js';

// ---- mustfail: a HUD line far too small to read ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); S.ground(); const st = {};
  st.crate = box(null, 1.2, 1.2, 1.2, C.accent);
  st.fine = text(null, 'nobody can read this line on a phone', { size: 22, weight: 600, color: C.ink, y: TITLE.y });
  return st;
} });

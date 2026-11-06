// MUSTFAIL: caption
// A deliberate mistake: check_layout must report it. If it ever says Clean here, the check is broken (never fix this file).
import { shot, tag, C, BAND, ZONE } from '../engine.js';
import { badge } from '../models.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;
// ---- mustfail: a label sits in the caption band while the narration's captions are on screen ----
shot({ t0: 0, trans: 'cut', build(S) {
  S.bg('sky'); const st = {};
  st.moon = badge(null, 'moon', { r: 200, scaleIcon: 2.2, y: cy + 60 });
  st.label = tag(null, 'In the caption band', { fill: C.pink, size: 56, y: (BAND.y0 + BAND.y1) / 2 });
  return st;
} });

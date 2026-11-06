// Example scene (2D) for the starter engine: two shots that pass check_layout in 16:9 and 9:16. Copy its patterns:
// a title comment per shot, cue() for every time, positions from ZONE / TITLE / VERT, every element on st, S.add for
// entrances. (3D: the same shape of file with box / sphere / cyl on S.ground(), S.view(...), and text on the HUD.)
import { shot, cue, C, VERT, ZONE, title, label, tag, card, circle } from '../engine.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;                      // the middle of the content zone

// ---- 1: the opening title ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); const st = {};
  st.title = title(null, 'Every style\nstarts somewhere', { y: cy + 80 });
  S.add(st.title, { at: cue('every', .3), in: 'rise' });
  st.tag = tag(null, 'starter', { y: cy - (VERT ? 180 : 150) });
  S.add(st.tag, { at: cue('somewhere', 1.4) });
  return st;
} });

// ---- 2: a palette on a card ----
shot({ t0: cue('this', 2.2) - .1, build(S) {
  S.bg('bg2', 'bg'); const st = {};
  st.card = card(null, { w: VERT ? 860 : 1100, h: VERT ? 760 : 560, y: cy, title: 'A palette', body: 'Five colours, each with one meaning.' });
  S.add(st.card, { at: cue('frame', 4.3), in: 'rise' });
  const gap = VERT ? 150 : 190;
  st.swatch = [C.accent, C.accent2, C.good, C.bad, C.ink].map((c, i) => {
    const s = circle(null, VERT ? 56 : 64, c, (i - 2) * gap, cy - (VERT ? 160 : 110));
    s.userData.over = [st.card];                          // they sit on the card on purpose
    return S.add(s, { at: cue('palette', 5) + i * .08 });
  });
  st.note = label(null, 'one idea per frame', { y: cy - (VERT ? 520 : 360) });
  S.add(st.note, { at: cue('shapes', 6.9) });
  return st;
} });

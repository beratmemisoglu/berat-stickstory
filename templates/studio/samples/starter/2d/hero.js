// Starter hero frames (2D): three still frames that show the look at a glance (the Style Studio's first visible result).
// Static on purpose: no entrances, no camera push. Restyle these first.
import { shot, C, VERT, ZONE, title, text, label, tag, card, circle, arrow } from '../engine.js';
import { badge } from '../models.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;

// ---- hero 1: title and palette ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); S.noCamera = true; const st = {};
  st.title = title(null, 'A plain\nstarting point', { y: cy + (VERT ? 200 : 120), size: VERT ? 120 : 130 });
  const r = VERT ? 56 : 64, gap = VERT ? 140 : 170;
  st.swatch = [C.accent, C.accent2, C.good, C.bad, C.ink].map((c, i) => circle(null, r, c, (i - 2) * gap, cy - (VERT ? 120 : 140)));
  return st;
} });

// ---- hero 2: cards and badges ----
shot({ t0: 2, trans: 'cut', captions: false, build(S) {
  S.bg('bg2', 'bg'); S.noCamera = true; const st = {};
  const w = VERT ? 820 : 760, x = VERT ? 0 : -420, y1 = VERT ? cy + 300 : cy;
  st.card = card(null, { w, h: 280, x, y: y1, title: 'One idea per frame', body: 'Big type, honest shapes, room to breathe.' });
  const bx = VERT ? -220 : 420, by = VERT ? cy - 180 : cy + 120;
  st.b = [1, 2, 3].map((n, i) => badge(null, { r: 64, label: n, fill: [C.accent, C.accent2, C.good][i], x: VERT ? bx + i * 220 : bx + (i - 1) * 180, y: by }));
  st.tag = tag(null, 'clear', { size: 48, x: VERT ? 0 : 420, y: VERT ? cy - 380 : cy - 110 });
  return st;
} });

// ---- hero 3: a diagram ----
shot({ t0: 4, trans: 'cut', captions: false, build(S) {
  S.bg(); S.noCamera = true; const st = {};
  const pts = VERT ? [[0, cy + 420], [0, cy + 60], [0, cy - 300]] : [[-560, cy + 40], [0, cy + 40], [560, cy + 40]];
  st.node = pts.map(([x, y], i) => label(null, ['Brief', 'Kit', 'Video'][i], { size: 56, x, y, fill: i === 1 ? C.accent : C.surface }));
  const pad = VERT ? 90 : 190;
  st.link = [0, 1].map(i => { const [a, b] = [pts[i], pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    return arrow(null, a[0] + ux * pad, a[1] + uy * pad, b[0] - ux * pad, b[1] - uy * pad, 10, C.ink); });
  st.note = text(null, 'every element proven alone first', { size: 44, weight: 600, color: C.muted, y: VERT ? cy - 480 + 60 : cy - 200 });
  return st;
} });

// Starter hero frames (3D): three still frames that show the look at a glance (the Style Studio's first visible result).
// Static on purpose: no entrances, no camera push. Restyle these first.
import { shot, C, VERT, TITLE, box, sphere, cyl, title, label, card } from '../engine.js';
import { table } from '../models.js';

const k = VERT ? .7 : 1, sx = VERT ? .95 : 1.5, back = VERT ? 1.35 : 1;

// ---- hero 1: a still life ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg(); S.ground(); S.noCamera = true; const st = {};
  st.box = box(null, k, k, k, C.accent, { x: -sx, ry: .4 });
  st.ball = sphere(null, .5 * k, C.accent2);
  st.can = cyl(null, .42 * k, 1.2 * k, C.good, { x: sx });
  st.title = title(null, 'A plain\nstarting point', { size: VERT ? 110 : 120 });
  return st;
} });

// ---- hero 2: a table set ----
shot({ t0: 2, trans: 'cut', captions: false, build(S) {
  S.bg('bg2', 'bg'); S.ground(); S.noCamera = true; S.view(VERT ? [1.2, 2.6, 7.6] : [2.6, 2.1, 4.6], [0, .6, 0]); const st = {};
  st.table = table(null, { w: 1.6, d: .9 });
  st.dot = [C.accent, C.accent2, C.good].map((c, i) => sphere(null, .12, c, { x: (i - 1) * .4, y: .75 }));
  st.crate = box(null, .5, .5, .5, C.accent2, { x: VERT ? -.6 : -1.4, z: VERT ? 1.3 : .5, ry: .3 });
  st.card = card(null, { w: VERT ? 820 : 700, h: 260, x: VERT ? 0 : -500, y: TITLE.y - 40, title: 'Solid ground', body: 'Everything rests on something.' });
  return st;
} });

// ---- hero 3: a stack ----
shot({ t0: 4, trans: 'cut', captions: false, build(S) {
  S.bg(); S.ground(); S.noCamera = true; S.view([1.8 * back, 2.6 * back, 6 * back], [0, .9, 0]); const st = {};
  st.stack = [[1.2, C.accent], [.9, C.accent2], [.6, C.good]].map(([s, c], i) => box(null, s, .5, s, c, { y: i * .5, ry: i * .25 }));
  const [px, py] = S.toScreen([.3, 1.5, 0]);
  st.lab = label(null, 'proven alone first', { size: 48, x: px + (VERT ? 120 : 330), y: py + 150 });
  return st;
} });

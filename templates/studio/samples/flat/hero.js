// Flat explainer hero frames: three shots that show the look at a glance (the Style Studio's first visible result).
// Static on purpose (everything is in place from the first frame; only breathing, blinks and the slow camera push move).
// The person is the project's own main character (character.js). Restyle these first.
import { shot, C, VERT, ZONE, title, tag, group, E, seg } from '../engine.js';
import { character, placeOnGround, drive, expr, mixPose, POSES, icons, badge } from '../models.js';

const cy = (ZONE.y0 + ZONE.y1) / 2;
const scaled = (fn, s, x, y) => { const g = group(null, x, y); fn(g); g.scale.setScalar(s); return g; };   // an icon group at a size

// ---- hero 1: the title, the main character stretching under the moon ----
// layout: vertical = title on top, character centred on the ground, moon top-right of the character;
//         landscape = character on the left third, title centred, moon on the right third
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg('night'); S.ground('#2a1060', '#3c1a80'); const st = {};
  const s = VERT ? 1 : .85, x = VERT ? 0 : -580;
  S.shadow(260 * s, x);
  st.hero = character(null, { scale: s }); placeOnGround(st.hero, x, s);
  st.title = group(null, VERT ? 0 : 300, VERT ? 640 : 330);      // landscape: centred over the right two thirds
  title(st.title, VERT ? 'How sleep\nresets\nyour brain' : 'How sleep\nresets your brain', { size: VERT ? 110 : 100, y: 0 });
  st.moon = VERT ? scaled(icons.moon, 1.5, 370, 370) : scaled(icons.moon, 1.7, 600, -10);
  return st;
}, update(st, t) {
  drive(st.hero, () => mixPose(POSES.rest, POSES.cheer, .8), t);   // a slow stretch, breathing on top
  expr(st.hero, t, [[0, 'half', 'o', -.2]], .4);
} });

// ---- hero 2: the signature diagram, a hub and its spokes ----
// layout: brain hub in the middle (yellow ring = the hero idea), four day badges on the corners, links behind them,
//         the label under the hub between the lower badges
shot({ t0: 2, captions: false, build(S) {
  S.bg('indigo'); const st = {};
  const hub = VERT ? [0, 260] : [0, 110], R = VERT ? 95 : 90;
  const sats = VERT ? [[-290, 610], [290, 610], [-290, -90], [290, -90]] : [[-480, 300], [480, 300], [-480, -100], [480, -100]];
  // links first: they run centre to centre BEHIND the badges, so nothing pokes over a ring
  sats.forEach(([x, y]) => S.line(hub[0], hub[1], x, y, 12, C.lilac, { at: S.t0 - .6, sfx: false }));
  st.hub = badge(null, 'brain', { r: 170, scaleIcon: 1.6, ringCol: C.yellow, x: hub[0], y: hub[1] });
  ['book', 'coffee', 'phone', 'moon'].forEach((n, i) => (st['sat' + i] = badge(null, n, { r: R, scaleIcon: 1.05, x: sats[i][0], y: sats[i][1] })));
  st.label = tag(null, 'Memories', { fill: C.yellow, size: 60, x: 0, y: VERT ? -290 : -170 });
  return st;
} });

// ---- hero 3: the payoff, the main character cheering in the morning sun ----
shot({ t0: 4, captions: false, build(S) {
  S.bg('sky'); S.ground('#1f6fd8'); const st = {};
  const s = VERT ? 1.15 : 1, x = VERT ? -170 : -420;
  S.shadow(280 * s, x);
  st.sun = VERT ? scaled(icons.sun, 2.4, 250, 620) : scaled(icons.sun, 2.4, 520, 300);
  st.hero = character(null, { scale: s }); placeOnGround(st.hero, x, s);
  st.label = tag(null, 'Rested', { fill: C.mint, size: 64, x: VERT ? 230 : 360, y: VERT ? 320 : 0 });
  st.label2 = tag(null, 'Ready', { fill: C.yellow, size: 64, x: VERT ? 230 : 360, y: VERT ? 170 : -150 });
  return st;
}, update(st, t) {
  drive(st.hero, () => POSES.cheer, t);
  expr(st.hero, t, [[0, 'happy', 'grin', .2]], 1.1);
  st.sun.rotation.z = .25 * E.inOutSine(seg(t, 4, 6));             // the rays turn slowly with the push
} });

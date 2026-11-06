// Flat explainer kit: the style's key elements, each alone at gate size (~600 px) on the ground it usually lives on.
// One element per shot, 2 s each: the main character, titles, meaning-coloured labels, a badge, a shaded icon, a card,
// the particle and its burst, the icon set. Every element here passed the element gate (QUALITY_STANDARD.md).
import { shot, C, VERT, ZONE, title, text, tag, slab, dopa, group, E, seg } from '../engine.js';
import { character, placeOnGround, drive, expr, mixPose, POSES, icons, badge } from '../models.js';

const cy = VERT ? 170 : (ZONE.y0 + ZONE.y1) / 2;   // a lone element sits a little above the frame's middle

// ---- kit 1: the main character (character.js), waving ----
shot({ t0: 0, trans: 'cut', captions: false, build(S) {
  S.bg('sky'); S.ground('#1f6fd8'); const st = {};
  const s = VERT ? 1.25 : 1;
  S.shadow(280 * s, 0);
  st.hero = character(null, { scale: s }); placeOnGround(st.hero, 0, s);
  return st;
}, update(st, t) {
  // the wave rises in, then the forearm swings (a periodic swing: no jump at a wrap)
  drive(st.hero, tt => { const k = E.inOutCubic(seg(tt, .1, .5)), p = mixPose(POSES.rest, POSES.wave, k);
    return { ...p, armR: [p.armR[0], p.armR[1] + .35 * k * Math.sin(tt * 7)] }; }, t);
  expr(st.hero, t, [[0, 'open', 'smile', 0], [.45, 'happy', 'grin', .2]], .3);
} });

// ---- kit 2: titles (title(): centred, every line the same size) and body text ----
shot({ t0: 2, captions: false, build(S) {
  S.bg('night'); const st = {};
  st.title = title(null, 'Big, bold\ntitles', { size: 120, y: cy + (VERT ? 80 : 60) });
  st.body = text(null, 'One size per line,\nalways centred', { size: 52, weight: 600, color: C.cream, y: cy - (VERT ? 170 : 150) });
  return st;
} });

// ---- kit 3: colour = meaning, labels wipe in (yellow energy, mint good, pink careful) ----
shot({ t0: 4, captions: false, build(S) {
  S.bg('violet'); const st = {};
  const rows = [['sun', 'Energy', C.yellow], ['check', 'Good', C.mint], ['bell', 'Careful', C.pink]];
  rows.forEach(([icon, word, col], i) => {
    const y = cy + (1 - i) * (VERT ? 230 : 200);
    st['icon' + i] = badge(null, icon, { r: 95, scaleIcon: 1.2, ringCol: col, x: -170, y });
    const tg = st['label' + i] = tag(null, word, { fill: col, size: 60, y });
    tg.position.x = -40 + tg.userData.w / 2;                                         // labels share a left edge
    S.add(tg, { at: S.t0 + .3 + i * .15, in: 'wipe' });
  });
  return st;
}, update(st, t, S) {
  // a finished wipe opens its clip plane all the way (the plane is placed before the frame's camera push, see sample.js)
  for (let i = 0; i < 3; i++) if (t >= S.t0 + .3 + i * .15 + .24) st['label' + i].userData.plane.constant = 1e5;
} });

// ---- kit 4: the badge (an icon in a ring: hub-and-spoke nodes) ----
shot({ t0: 6, captions: false, build(S) {
  S.bg('cell'); const st = {};
  st.badge = badge(null, 'brain', { r: 280, scaleIcon: 2.6, ringCol: C.yellow, y: cy });
  return st;
} });

// ---- kit 5: a shaded icon at gate size (one light, top-left; the clock reads 10:10) ----
shot({ t0: 8, captions: false, build(S) {
  S.bg('lemon'); const st = {};
  st.clock = icons.clock(null, 4.4); st.clock.position.set(0, cy, 0);
  return st;
}, update(st, t) {
  const m = st.clock.userData.min; m.userData.a0 ??= m.rotation.z;
  m.rotation.z = m.userData.a0 - .5 * E.inOutSine(seg(t, 8.3, 9.8));   // the minute hand moves on, eased
} });

// ---- kit 6: a card (slab: thickness below, highlight band on top) holding one idea ----
shot({ t0: 10, captions: false, build(S) {
  S.bg('mint'); const st = {};
  st.card = slab(null, VERT ? 820 : 900, 440, 40, C.white, { y: cy, depth: 16 });
  const star = icons.star(st.card, 1.7); star.position.set(VERT ? -250 : -280, 0, 0);
  text(st.card, 'One idea\nper card', { size: 64, color: C.ink, x: VERT ? 90 : 100 });
  return st;
} });

// ---- kit 7: the particle (a shaded ball) and its burst ----
shot({ t0: 12, captions: false, build(S) {
  S.bg('indigo'); const st = {};
  S.burst(0, cy, { at: S.t0 + .4, dur: 1.3, rays: 16, size: 10, seed: 3, r0: VERT ? 230 : 240, r1: VERT ? 380 : 320 });
  st.ball = dopa(null, VERT ? 200 : 210); st.ball.position.set(0, cy, 0);
  S.add(st.ball, { at: S.t0 + .2 });
  return st;
} });

// ---- kit 8: the icon set, each in its badge ----
shot({ t0: 14, captions: false, build(S) {
  S.bg('sunset'); const st = {};
  const pos = VERT ? [[-200, cy + 200], [200, cy + 200], [-200, cy - 200], [200, cy - 200]] : [[-600, cy], [-200, cy], [200, cy], [600, cy]];
  ['sun', 'moon', 'coffee', 'book'].forEach((n, i) => {
    st[n] = badge(null, n, { r: 140, scaleIcon: 1.6, x: pos[i][0], y: pos[i][1] });
    S.add(st[n], { at: S.t0 + .25 + i * .12 });
  });
  return st;
} });

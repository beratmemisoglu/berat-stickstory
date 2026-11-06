// Pixel-art hero: three frames that show the style at its best (2 s each): the title over a wind farm at sunset, the
// night town the power reaches, and the generator cut away on the studio floor. Metres, y up, the ground at y = 0;
// the HUD is 320 x 180 art pixels (safe: 18 px sides, 26 px top, above y = 165).
import { C, shot, ease, lerp, V, text, tag, box, W } from '../engine.js';
import { mountain, gridFloor } from '../models.js';
// the wind-to-town models live in windkit.js next to this file (a style that keeps them moves them into models.js)
import { hills, turbine, pylon, cable, pulses, flow, linkPylons, lightUp, substation, generator, grassland, town, moon } from './windkit.js';

// ---- 1: the title over a wind farm at sunset ----
shot({ t0: 0, cut: true, build(S) {
  S.bg = C.plum; S.sky = [C.plum, C.orange]; S.fogNear = 40; S.fogFar = 170;
  grassland(S, hills, [C.bg, C.navy, C.teal], 5, 260, 30, -8, false);
  const st = { ts: [[-7.6, -9.3], [-3.1, -8.7], [1.8, -9.2], [6.4, -8.8]].map(([x, z]) => { const t = turbine(1.2); t.position.set(x, hills(x, z) - .1, z); t.rotation.y = .12; S.scene.add(t); return t; }) };
  for (let i = 0; i < 4; i++) { const m = mountain(10 + i * 2, 9 + i * 2, i + 3, 'dark', false); m.position.set(-45 + i * 30, -1, -72 - (i % 2) * 10); S.scene.add(m); }
  return st;
}, update(st, t, S) {
  st.ts.forEach((tb, i) => tb.rotor.rotation.z = -t * 1.3 - i * .9);
  S.cam.position.set(lerp(-.6, .4, ease(t / 2)), 1.6, 9); S.cam.lookAt(0, 3, -8);
}, draw(st, t) {
  text('WIND TO WATTS', W / 2, 124, { size: 20, font: 'head', weight: 900, alpha: ease((t - .05) / .35) });
  text('how a hilltop lights a town', W / 2, 141, { size: 7.5, col: C.yellow, alpha: ease((t - .25) / .35) });
} });

// ---- 2: the night town, the line coming in from the hills ----
shot({ t0: 2, build(S) {
  S.bg = C.bg; S.sky = [C.bg, C.navy]; S.fogNear = 50; S.fogFar = 140;
  const st = { town: town(3) }; S.scene.add(st.town); lightUp(st.town.wins, st.town.order, .8);
  moon(S, [-10, 4, -40], 1.8);
  for (let i = 0; i < 5; i++) { const m = mountain(9 + i * 2, 7 + i * 2, i + 7, 'dark', false); m.position.set(-50 + i * 25, -1, -58 - (i % 2) * 8); S.scene.add(m); }
  const sub = substation(1.3); sub.position.set(11.5, 0, -4.6); sub.rotation.y = -Math.PI / 2; S.scene.add(sub); sub.updateMatrixWorld(true);
  const ps = [-25, -18, -11.5].map(z => { const p = pylon(1.1); p.position.set(11.5, 0, z); S.scene.add(p); return p; });
  const ls = linkPylons(S, ps, C.slate, .35);
  for (let e = 0; e < 4; e++) { const p = ps[2], c = cable(p.localToWorld(p.ends[[1, 3, 2, 0][e]].clone()), sub.localToWorld(sub.ends[e].clone()), C.slate, .25); S.scene.add(c); ls.push(c); }
  st.pulses = pulses(S, ls, 2, .11);
  return st;
}, update(st, t, S) {
  flow(st.pulses, t, .5);
  S.cam.position.set(lerp(-4.6, -3.6, ease((t - 2) / 2)), 5.5, 14); S.cam.lookAt(1.5, 1.2, -3);
} });

// ---- 3: the generator cut away on the studio floor ----
shot({ t0: 4, build(S) {
  S.bg = C.bg; S.sky = [C.bg, C.navy];
  S.scene.add(gridFloor(40, 1, C.dark), box(14, .02, 14, [C.bg, C.bg, C.bg], [0, -.012, 0]));
  const st = { g: generator(1) }; S.scene.add(st.g);
  return st;
}, update(st, t, S) {
  st.g.spin.rotation.z = -t * 2.2;
  S.cam.position.set(lerp(2.5, 2, ease((t - 4) / 2)), 2, 4.4); S.cam.lookAt(-.35, 1.15, 0);
}, draw(st, t, S) {
  const a = ease((t - 4.05) / .35);
  text('INSIDE THE GENERATOR', 18, 32, { size: 10, font: 'head', weight: 900, align: 'left', alpha: a });
  text('a spinning magnet drives current', 18, 44, { size: 6.5, col: C.silver, align: 'left', alpha: a });
  text('through copper coils', 18, 52, { size: 6.5, col: C.silver, align: 'left', alpha: a });
  tag(S.cam, V(0, 1.22, .26), 'MAGNET', { dx: -62, dy: 22, alpha: ease((t - 4.25) / .3), col: C.white });
  tag(S.cam, V(.58, 1.56, .26), 'COPPER COILS', { dx: 34, dy: -14, alpha: ease((t - 4.4) / .3), col: C.orange });
} });

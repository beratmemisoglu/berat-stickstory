// Pixel-art kit: the sample's elements, one per shot (2 s each), each on its typical sky and ground. Units are metres,
// y up, the ground at y = 0; the HUD is 320 x 180 art pixels (safe: 18 px sides, 26 px top, above y = 165).
import { C, shot, ease, lerp, V, rng, text, stat, tag, box } from '../engine.js';
import { tree, mountain, lamppost, car, person, gridFloor, orbit } from '../models.js';
// the wind-to-town models live in windkit.js next to this file (a style that keeps them moves them into models.js)
import { hills, turbine, pylon, cable, pulses, flow, linkPylons, house, block, lightUp, substation, generator, grassland } from './windkit.js';

const flatGround = () => 0;
// the element's name tag, top left (Orbitron name + the code that makes it)
function name(t, t0, title, code) {
  const a = ease((t - t0 - .1) / .3);
  text(title, 18, 32, { size: 11, font: 'head', weight: 900, align: 'left', alpha: a });
  text(code, 18, 45, { size: 6, col: C.silver, align: 'left', alpha: a });
}

// ---- 1: the wind turbine, on its hill in daylight ----
shot({ t0: 0, cut: true, build(S) {
  S.bg = C.blue; S.sky = [C.blue, C.sky]; S.fogNear = 40; S.fogFar = 170;
  const hf = (x, z) => .6 * Math.exp(-(x * x + z * z) / 30) + .15 * Math.sin(x * .4) * Math.cos(z * .3);
  grassland(S, hf, undefined, 4, 300, 24, 0, false);
  const st = { t: turbine(1.2) }; st.t.position.y = hf(0, 0) - .03; S.scene.add(st.t);
  for (let i = 0; i < 3; i++) { const m = mountain(7 + i * 2, 9 + i * 3, i + 2, 'stone', true); m.position.set(-30 + i * 28, -1, -60 - i * 6); S.scene.add(m); }
  return st;
}, update(st, t, S) {
  st.t.rotor.rotation.z = -t * 1.6;
  orbit(S.cam, V(-.9, 2.5, 0), 10.5, .55 - t * .06, .2);
}, draw(st, t) { name(t, 0, 'WIND TURBINE', 'turbine(s) · g.rotor spins'); } });

// ---- 2: pylons and cables carrying current ----
shot({ t0: 2, build(S) {
  S.bg = C.blue; S.sky = [C.blue, C.sky]; S.fogNear = 25; S.fogFar = 90;
  grassland(S, flatGround, undefined, 7, 300, 30, -4, false);
  const st = { ps: [0, 1, 2].map(i => { const p = pylon(1); p.position.set(-1.5 + i * 5, 0, -i * 4.5); p.rotation.y = -.84; S.scene.add(p); return p; }) };
  st.pulses = pulses(S, linkPylons(S, st.ps, C.dark, .45), 2);
  return st;
}, update(st, t, S) {
  flow(st.pulses, t, .5);
  S.cam.position.set(lerp(-1.4, -.6, ease((t - 2) / 2)), 1.5, 5.8); S.cam.lookAt(-1.6, 1.7, -4.5);
}, draw(st, t) { name(t, 2, 'PYLONS + CABLES', 'pylon · cable · pulses'); } });

// ---- 3: a house at dusk, its windows lit ----
shot({ t0: 4, build(S) {
  S.bg = C.plum; S.sky = [C.plum, C.orange]; S.fogNear = 30; S.fogFar = 100;
  S.scene.add(box(40, .1, 40, [C.bg, C.navy, C.teal], [0, -.05, 0]), box(1.4, .02, .5, 'stone', [0, .01, .95]));
  const st = { h: house(1.6, 'white', 'red') }; S.scene.add(st.h);
  const lp = lamppost(1.4); lp.position.set(1.3, 0, 1); S.scene.add(lp);
  lightUp(st.h.wins, [0, .5, .2, .8], .9);
  return st;
}, update(st, t, S) { orbit(S.cam, V(-.6, .65, 0), 4.6, .62 - (t - 4) * .07, .6); },
draw(st, t) { name(t, 4, 'HOUSE', 'house(s, wall, roof) · lightUp()'); } });

// ---- 4: a town block at night ----
shot({ t0: 6, build(S) {
  S.bg = C.bg; S.sky = [C.bg, C.navy]; S.fogNear = 40; S.fogFar = 120;
  S.scene.add(box(40, .1, 40, [C.bg, C.navy, C.navy], [0, -.05, 0]), box(40, .02, 1.4, [C.bg, C.dark, C.dark], [0, .01, 1.6]));
  const st = { b: block(1.9, 2.6, 1.4, 'teal', 3) }; S.scene.add(st.b);
  const b2 = block(1.3, 1.6, 1.2, 'plum', 8); b2.position.set(-2.1, 0, -.2); S.scene.add(b2); lightUp(b2.wins, b2.order, .5);
  const lp = lamppost(1.3); lp.position.set(1.4, 0, .95); S.scene.add(lp);
  const cr = car('red', 1.1); cr.position.set(.2, .02, 1.6); S.scene.add(cr);
  return st;
}, update(st, t, S) {
  lightUp(st.b.wins, st.b.order, .3 + .5 * ease((t - 6.2) / 1.2));
  orbit(S.cam, V(-1.2, 1.2, 0), 6.8, .5 - (t - 6) * .05, 1.1);
}, draw(st, t) { name(t, 6, 'TOWN BLOCK', 'block(w, h, d, ramp) · lights on'); } });

// ---- 5: the substation ----
shot({ t0: 8, build(S) {
  S.bg = C.blue; S.sky = [C.blue, C.sky]; S.fogNear = 30; S.fogFar = 100;
  grassland(S, flatGround, undefined, 9, 260, 26, 0, false);
  const st = { sub: substation(1.3) }; S.scene.add(st.sub);
  const p = pylon(1.1); p.position.set(-5.2, 0, 0); p.rotation.y = Math.PI / 2; S.scene.add(p);
  p.updateMatrixWorld(true); st.sub.updateMatrixWorld(true);
  const ls = [0, 1, 2, 3].map(e => { const c = cable(p.localToWorld(p.ends[[1, 3, 2, 0][e]].clone()), st.sub.localToWorld(st.sub.ends[e].clone()), C.dark, .25); S.scene.add(c); return c; });
  st.pulses = pulses(S, ls, 2);
  return st;
}, update(st, t, S) {
  flow(st.pulses, t, .6);
  orbit(S.cam, V(-1.8, 1.1, 0), 9.2, 2.62 - (t - 8) * .06, 2.2);   // from behind the yard: the line arrives on the right
}, draw(st, t) { name(t, 8, 'SUBSTATION', 'substation(s) · transformer(s)'); } });

// ---- 6: the generator, cut away (studio floor) ----
shot({ t0: 10, build(S) {
  S.bg = C.bg; S.sky = [C.bg, C.navy];
  S.scene.add(gridFloor(40, 1, C.dark), box(14, .02, 14, [C.bg, C.bg, C.bg], [0, -.012, 0]));
  const st = { g: generator(1) }; S.scene.add(st.g);
  return st;
}, update(st, t, S) {
  st.g.spin.rotation.z = -t * 2.2;
  S.cam.position.set(lerp(2.4, 1.7, ease((t - 10) / 2)), 1.95, lerp(4.4, 4.7, ease((t - 10) / 2))); S.cam.lookAt(-.1, 1.1, 0);
}, draw(st, t) { name(t, 10, 'GENERATOR', 'generator(s) · g.spin turns'); } });

// ---- 7: the land: hills, trees, rocks, mountains ----
shot({ t0: 12, build(S) {
  S.bg = C.blue; S.sky = [C.blue, C.sky]; S.fogNear = 40; S.fogFar = 170;
  grassland(S, hills, undefined, 11, 380, 40, -5);
  const r = rng(12);
  for (let i = 0; i < 9; i++) { const x = -6 + i * 1.6 + r() * .6, z = -3 - r() * 4, tr = tree(1.5, i); tr.position.set(x, hills(x, z) - .02, z); S.scene.add(tr); }
  for (let i = 0; i < 4; i++) { const m = mountain(8 + i * 2, 10 + i * 3, i + 5, 'stone', true); m.position.set(-36 + i * 24, -1, -55 - (i % 2) * 8); S.scene.add(m); }
  return {};
}, update(st, t, S) {
  S.cam.position.set(lerp(-3, -1.6, ease((t - 12) / 2)), 2.2, 7); S.cam.lookAt(0, 1.6, -6);
}, draw(st, t) { name(t, 12, 'THE LAND', 'terrain · scatter · tree · mountain'); } });

// ---- 8: the HUD type: headline, body, stat and a tag on a model ----
// (the kit's dark studio floor is meant here: the type is shown on it and the models are lit, so S.dark = true tells the
// layout check that the near-black backdrop is a choice, not an unlit frame)
shot({ t0: 14, build(S) {
  S.bg = C.bg; S.sky = [C.bg, C.navy]; S.dark = true;
  S.scene.add(gridFloor(40, 1, C.dark), box(14, .02, 14, [C.bg, C.bg, C.bg], [0, -.012, 0]));
  const st = { h: house(1.3, 'stone', 'plum') }; st.h.position.set(1.1, 0, 0); st.h.rotation.y = -.4; S.scene.add(st.h);
  const p = person('orange', 1.6); p.position.set(.15, 0, .7); S.scene.add(p);
  lightUp(st.h.wins, [0, .4, .2, .6], 1);
  return st;
}, update(st, t, S) { orbit(S.cam, V(.6, .5, 0), 4.6, .2 - (t - 14) * .05, 1.2); },
draw(st, t, S) {
  const a = ease((t - 14.1) / .3);
  text('HEADLINE', 18, 32, { size: 13, font: 'head', weight: 900, align: 'left', alpha: a });
  text('body text in Share Tech Mono', 18, 46, { size: 7, col: C.silver, align: 'left', alpha: a });
  stat(18, 76, '50', 'Hz', { align: 'left', size: 20, alpha: a, label: 'stat()' });
  tag(S.cam, st.h.position.clone().add(V(0, 1.05, 0)), 'tag on a model', { dy: -16, dx: 6, alpha: a });
} });

// Pixel-art sample: five shots on the sample narration (audio/timeline.json, ~20 s): where a town's evening light comes
// from, wind to window. Metres, y up, the ground at y = 0; the HUD is 320 x 180 art pixels (safe: 18 px sides, 26 px top,
// above y = 165). Every element lands on its word (cue), every shot moves.
import { C, shot, cue, ease, clamp, lerp, V, rng, text, tag, box, W } from '../engine.js';
import { tree, mountain, lamppost, gridFloor } from '../models.js';
// the wind-to-town models live in windkit.js next to this file (a style that keeps them moves them into models.js)
import { hills, turbine, pylon, cable, pulses, flow, linkPylons, house, lightUp, substation, generator, grassland, town } from './windkit.js';

// ---- 1: every evening, a whole city switches on ----
shot({ t0: 0, cut: true, build(S) {
  S.bg = C.bg; S.sky = [C.bg, C.navy]; S.fogNear = 50; S.fogFar = 140;
  const st = { town: town(3) }; S.scene.add(st.town);
  for (let i = 0; i < 5; i++) { const m = mountain(9 + i * 2, 7 + i * 2, i + 7, 'dark', false); m.position.set(-50 + i * 25, -1, -58 - (i % 2) * 8); S.scene.add(m); }
  st.tTitle = cue('every', .3); st.tSub = cue('evening', .66); st.tCity = cue('city', 1.74); st.tOn = cue('on', 2.46);
  st.hits = [st.tCity];
  return st;
}, update(st, t, S) {
  lightUp(st.town.wins, st.town.order, .12 + .8 * ease((t - st.tCity + .2) / (st.tOn - st.tCity + .6)));   // a wave from the left
  const k = ease(t / 3);
  S.cam.position.set(lerp(-5.6, -4.4, k), lerp(4.4, 4.1, k), lerp(12.5, 11.8, k)); S.cam.lookAt(lerp(.2, .8, k), 1.6, -3);
}, draw(st, t) {
  text('WIND TO WATTS', W / 2, 34, { size: 18, font: 'head', weight: 900, alpha: ease((t - st.tTitle) / .35) });
  text('where a town\'s evening light comes from', W / 2, 50, { size: 7, col: C.yellow, alpha: ease((t - st.tSub) / .35) });
} });

// ---- 2: the power starts out in the hills, where wind turns the turbines ----
shot({ t0: cue('the power', 3.06) - .1, build(S) {
  S.bg = C.blue; S.sky = [C.blue, C.sky]; S.fogNear = 40; S.fogFar = 170;
  grassland(S, hills, undefined, 4, 450, 40, -4);
  const st = { ts: [[1.6, -9.4], [4.9, -8.8], [8.2, -9.3], [11.5, -8.7]].map(([x, z]) => { const t = turbine(1.15); t.position.set(x, hills(x, z) - .1, z); t.rotation.y = .1; S.scene.add(t); return t; }) };
  const r = rng(21);
  for (let i = 0; i < 7; i++) { const x = -6 + i * 3 + r(), z = -2 - r() * 3, tr = tree(1.4, i); tr.position.set(x, hills(x, z) - .06, z); S.scene.add(tr); }
  for (let i = 0; i < 4; i++) { const m = mountain(9 + i * 2, 11 + i * 3, i + 2, 'stone', true); m.position.set(-40 + i * 27, -1, -62 - (i % 2) * 8); S.scene.add(m); }
  st.tPower = cue('power', 3.42); st.tHills = cue('hills', 5.22); st.tWind = cue('wind', 6.18);
  st.hits = [st.tHills, st.tWind];
  return st;
}, update(st, t, S) {
  const spin = .5 * t + 1.6 * Math.max(0, t - st.tWind) - 1.1 * Math.max(0, t - st.tWind - 1) * clamp((t - st.tWind - 1) / 2);   // the wind picks up
  st.ts.forEach((tb, i) => tb.rotor.rotation.z = -spin - i * 1.3);
  const k = ease((t - S.t0) / (S.t1 - S.t0));
  S.cam.position.set(lerp(3.6, 6.4, k), lerp(1.7, 3.1, k), lerp(9.5, 8.2, k)); S.cam.lookAt(lerp(2, 4.6, k), lerp(2.7, 3.1, k), -8.5);
}, draw(st, t, S) {
  const a = ease((t - st.tPower) / .35);
  text('WHERE THE POWER STARTS', 18, 64, { size: 6.5, col: C.white, align: 'left', alpha: a });   // under the first rotor, over the far range
  text('IN THE HILLS', 18, 77, { size: 13, font: 'head', weight: 900, align: 'left', alpha: ease((t - st.tHills) / .35) });
  // the tag hangs from the foot of the first tower onto the open hillside: its line never crosses a rotor
  tag(S.cam, st.ts[0].position.clone().add(V(0, .45, 0)), 'WIND TURBINE', { dx: -8, dy: 22, alpha: ease((t - st.tWind) / .3) });
} });

// ---- 3: each rotor spins a generator ----
shot({ t0: cue('each rotor', 8.22) - .1, build(S) {
  S.bg = C.bg; S.sky = [C.bg, C.navy];
  S.scene.add(gridFloor(40, 1, C.dark), box(14, .02, 14, [C.bg, C.bg, C.bg], [0, -.012, 0]));
  const st = { g: generator(1) }; S.scene.add(st.g);
  st.tRotor = cue('rotor', 8.58); st.tSpins = cue('spins', 8.94);
  st.hits = [st.tRotor];
  return st;
}, update(st, t, S) {
  st.g.spin.rotation.z = -(1.2 * (t - S.t0) + 2.4 * Math.max(0, t - st.tSpins));   // it speeds up on "spins"
  const k = ease((t - S.t0) / (S.t1 - S.t0));
  S.cam.position.set(lerp(4.4, 3.8, k), lerp(2.4, 2.2, k), lerp(2.9, 3.6, k)); S.cam.lookAt(-1.1, .95, -.9);
}, draw(st, t, S) {
  const a = ease((t - S.t0 - .1) / .35);
  text('THE GENERATOR', 18, 32, { size: 12, font: 'head', weight: 900, align: 'left', alpha: a });
  text('a magnet spins inside copper coils', 18, 45, { size: 6.5, col: C.silver, align: 'left', alpha: ease((t - S.t0 - .3) / .35) });
  tag(S.cam, V(0, 1.22, -2.3), 'ROTOR', { dx: 30, dy: -34, alpha: ease((t - st.tRotor) / .3) });
} });

// ---- 4: cables carry the current across the valley, a substation steps it down ----
const valley = (x, z) => { const k = clamp((Math.hypot(x - 11, z) - 2.4) / 3);   // a dip the line crosses, the land rising behind it, flat at the substation
  return k * (-2.4 * Math.exp(-((x + 3) ** 2) / 60) + .2 * Math.sin(z * .35 + x * .1)) + 2.4 * ease(clamp(-(z + 5) / 14)); };
shot({ t0: cue('cables', 10.26) - .1, build(S) {
  S.bg = C.blue; S.sky = [C.blue, C.sky]; S.fogNear = 40; S.fogFar = 170;
  grassland(S, valley, undefined, 8, 500, 46, -2, false);
  const r = rng(5);
  for (let i = 0; i < 10; i++) { const x = -18 + i * 3.6 + r(), z = -4 - r() * 5, tr = tree(1.4, i); tr.position.set(x, valley(x, z) - .02, z); S.scene.add(tr); }
  for (let i = 0; i < 4; i++) { const m = mountain(9 + i * 2, 6 + i * 1.5, i + 4, 'stone', true); m.position.set(-36 + i * 26, -1, -60 - (i % 2) * 8); S.scene.add(m); }
  const st = { sub: substation(1.3) }; st.sub.position.set(11, 0, 0); S.scene.add(st.sub); st.sub.updateMatrixWorld(true);
  st.ps = [-16, -9, -2, 5].map(x => { const p = pylon(1.15); p.position.set(x, valley(x, 0) - .02, 0); p.rotation.y = Math.PI / 2; S.scene.add(p); return p; });
  const ls = linkPylons(S, st.ps, C.dark, .45), last = st.ps[3];
  for (let e = 0; e < 4; e++) { const c = cable(last.localToWorld(last.ends[[1, 3, 2, 0][e]].clone()), st.sub.localToWorld(st.sub.ends[e].clone()), C.dark, .3); S.scene.add(c); ls.push(c); }
  st.pulses = pulses(S, ls, 2, .1);
  st.tCables = cue('cables', 10.26); st.tSub = cue('substation', 13.38);
  st.hits = [st.tCables, st.tSub];
  return st;
}, update(st, t, S) {
  flow(st.pulses, t, .5);
  const k = ease((t - S.t0) / (S.t1 - S.t0));
  S.cam.position.set(lerp(-7.5, 3, k), lerp(2.6, 3.2, k), lerp(12.5, 10, k)); S.cam.lookAt(lerp(-5, 8.6, k), lerp(.2, .9, k), 0);
}, draw(st, t, S) {
  const a = ease((t - st.tCables) / .35);
  text('HIGH-VOLTAGE LINES', 18, 32, { size: 11, font: 'head', weight: 900, align: 'left', alpha: a });
  text('carry the current across the valley', 18, 44, { size: 6.5, col: C.white, align: 'left', alpha: a });
  tag(S.cam, st.sub.position.clone().add(V(.4, 1.4, 0)), 'SUBSTATION', { dx: 0, dy: -36, alpha: ease((t - st.tSub) / .3), sub: 'steps the voltage down', subCol: C.white });
} });

// ---- 5: every street lights up; one turbine can light hundreds of homes ----
const dome = (x, z) => 4.6 * Math.exp(-((x - 9) ** 2 + (z + 36) ** 2) / 110);
shot({ t0: cue('and every street', 15.06) - .1, build(S) {
  S.bg = C.plum; S.sky = [C.plum, C.orange]; S.fogNear = 40; S.fogFar = 150;
  grassland(S, dome, [C.bg, C.navy, C.teal], 6, 300, 30, -20, false);
  S.scene.add(box(2, .02, 60, [C.bg, C.dark, C.dark], [0, .015, -10]));
  for (const x of [-1.15, 1.15]) S.scene.add(box(.3, .05, 60, 'stone', [x, .025, -10]));
  const st = { wins: [], order: [] }, r = rng(17), walls = ['white', 'stone', 'teal', 'white', 'sand'], roofs = ['red', 'plum', 'navy', 'red'];
  for (let i = 0; i < 9; i++) for (const side of [-1, 1]) {
    const z = 5 - i * 1.75, h = house(1.3, walls[(i + (side > 0)) % 5], roofs[(i * 2 + (side > 0)) % 4]);
    h.position.set(side * 1.85, 0, z); h.rotation.y = -side * Math.PI / 2; S.scene.add(h);
    h.wins.forEach(m => { st.wins.push(m); st.order.push(i / 9 * .8 + r() * .2); });
    if (i % 3 === 2) { const lp = lamppost(1.3); lp.position.set(side * 1.32, 0, z + .85); lp.rotation.y = side > 0 ? Math.PI : 0; S.scene.add(lp); }
  }
  st.tb = turbine(2.2); st.tb.position.set(9.6, dome(9.6, -35.2) - .05, -35.2); st.tb.rotation.y = -.25; S.scene.add(st.tb);   // on a terrain vertex: grounded exactly
  st.tStreet = cue('street', 15.78); st.tUp = cue('up', 16.5); st.tOne = cue('one turbine', 17.1); st.tLight = cue('light hundreds', 18.18);
  st.hits = [st.tStreet, st.tLight];
  return st;
}, update(st, t, S) {
  lightUp(st.wins, st.order, ease((t - st.tStreet + .1) / (st.tUp - st.tStreet + 1)));
  st.tb.rotor.rotation.z = -t * 1.1;
  const k = ease((t - S.t0) / (S.t1 - S.t0));
  S.cam.position.set(lerp(-.25, .2, k), lerp(1.45, 1.75, k), lerp(9.6, 8.2, k)); S.cam.lookAt(.4, 2.6, -20);
}, draw(st, t, S) {
  tag(S.cam, st.tb.position.clone().add(V(0, 2.2, 0)), 'ONE TURBINE', { dx: 34, dy: -6, alpha: ease((t - st.tOne) / .3) });
  text('HUNDREDS OF HOMES', 18, 32, { size: 12, font: 'head', weight: 900, align: 'left', alpha: ease((t - st.tLight) / .35) });
} });

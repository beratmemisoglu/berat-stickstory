// 0:00 - 0:32  Cold open: same 32 MB, 2000 vs 2005, "the people writing the code", title.
import { THREE, C, shot, cue, ease, easeOut, seg, pop, clamp, lerp, V, text, stat, tag, rect, line, frame, project, facet, box, rng, W, H, hud, FONT, card } from '../engine.js';
import { ps2, memory, car, colossus, rider, mountain, terrain, gridFloor, orbit, wire, person, tree, scatter } from '../models.js';

// ---- 1a: the console and its 32 MB ----
shot({ t0: 0, build(S) {
  const st = { ps2: ps2(), mem: memory(8, 4, .3, .06, 'blue') };
  S.scene.add(st.ps2, gridFloor(60, 1, C.navy));
  st.mem.scale.setScalar(.42); S.scene.add(st.mem);
  st.tMem = cue('32 megabytes', 3); st.tHeart = cue('heart', .5); st.tPS = cue('PlayStation 2 game', 1.6);
  st.hits = [st.tMem];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(0, 1.0, 0), lerp(8.5, 6.8, ease(t / 5.3)), -.5 + t * .06, lerp(3.4, 2.2, ease(t / 5.3)));
  const k = ease((t - st.tHeart) / 2.2);
  st.ps2.children[1].position.y = .65 + k * .9;                 // lid lifts to reveal the heart
  st.mem.position.set(0, lerp(.3, 1.75, easeOut((t - st.tMem + .6) / 1.2)), 0);
  st.mem.cells.forEach((c, i) => { const s = pop(t, st.tMem - .4 + i * .025, .3); c.visible = s > 0; c.scale.setScalar(.3 * Math.max(s, .01)); c.material = facet((i * 5 + Math.floor(t * 6)) % 13 < 2 ? 'cyan' : 'blue'); });
}, draw(st, t, S) {
  const a = ease((t - st.tMem - .3) / .4);
  const [x, y] = project(st.mem.position.clone().add(V(1.7, .3, 0)), S.cam);
  card('ps2_console', 18, 30, 96, t, { t0: st.tPS, t1: st.tMem + 1.6, label: 'PLAYSTATION 2', sub: 'photo: Evan-Amos' });
  line(x - 6, y, x + 10, y, C.silver, a); stat(x + 12, y, '32', 'MB', { alpha: a, label: 'MAIN MEMORY', size: 18, align: 'left' });
}});

// ---- 1b: March 2000, Ridge Racer 5: a few cars on a closed track ----
shot({ t0: cue('In March', 5.3) - .1, build(S) {
  const st = { cars: [] };
  S.scene.add(gridFloor(60, 1, C.navy));
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.4, 40, 1), facet('grey', { side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.scale.set(1.5, 1, 1); ring.position.y = .01; S.scene.add(ring);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), facet('green', { side: THREE.DoubleSide }));
  inner.rotation.x = -Math.PI / 2; inner.scale.set(1.5, 1, 1); S.scene.add(inner);
  const dash = new THREE.Mesh(new THREE.RingGeometry(3.78, 3.82, 40, 1), facet('white', { side: THREE.DoubleSide }));
  dash.rotation.x = -Math.PI / 2; dash.scale.set(1.5, 1, 1); dash.position.y = .02; S.scene.add(dash);
  ['red', 'yellow', 'blue', 'lime'].forEach((r, i) => { const c = car(r, 1.1); S.scene.add(c); st.cars.push(c); });
  for (let i = 0; i < 6; i++) { const tr = tree(1.4, i); tr.position.set(Math.cos(i) * 1.6, 0, Math.sin(i * 1.7) * 1.4); S.scene.add(tr); }
  st.tYear = cue('March 2000', 5.6); st.tRR = cue('Ridge Racer', 6.9); st.tCars = cue('handful', 9.5);
  st.hits = [st.tYear, st.tRR];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  orbit(S.cam, V(0, 0, 0), 11, .9 + lt * .05, 6.2);
  st.cars.forEach((c, i) => {
    const a = lt * (.55 + i * .04) + i * 1.3;
    c.position.set(Math.cos(a) * 3.8 * 1.5, .02, Math.sin(a) * 3.8 * (1 - i * .03));
    c.rotation.y = -a - Math.PI / 2 + Math.atan2(1.5, 1) * 0;
    const vx = -Math.sin(a) * 1.5, vz = Math.cos(a); c.rotation.y = Math.atan2(-vz, vx);
  });
}, draw(st, t, S) {
  const a = ease((t - st.tYear) / .4);
  text('MARCH', 18, 34, { size: 7, col: C.silver, align: 'left', alpha: a });
  text('2000', 17, 50, { size: 24, font: 'head', weight: 900, align: 'left', alpha: a });
  const b = ease((t - st.tRR) / .4);
  text('RIDGE RACER V', W - 18, 36, { size: 10, font: 'head', align: 'right', alpha: b });
  text('launch title', W - 18, 47, { size: 7, col: C.yellow, align: 'right', alpha: b });
  const c = ease((t - st.tCars) / .4);
  card('rr5_cover', 18, 60, 44, t, { t0: st.tRR });
  card('rr5_shot', W - 18, 66, 104, t, { t0: st.tRR + .5, align: 'right', label: 'RIDGE RACER V · 2000' });
  text('4 cars  ·  1 closed track', W - 18, 57, { size: 6.5, col: C.silver, align: 'right', alpha: c });
}});

// ---- 1c: 2005, Shadow of the Colossus ----
function landscape(S, seed = 3) {
  const r = rng(seed);
  const hf = (x, z) => Math.sin(x * .12) * 1.3 + Math.cos(z * .09 + 1) * 1.6 + Math.sin((x + z) * .05) * 2 - (Math.abs(x) < 7 ? 0 : 0);
  const land = terrain(160, 160, 48, hf, [C.bg, C.navy, C.teal]); S.scene.add(land, scatter(hf, { n: 900, area: 70, seed }));
  for (let i = 0; i < 9; i++) { const m = mountain(8 + r() * 8, 12 + r() * 12, i, 'stone'); const a = i / 9 * Math.PI * 2;
    m.position.set(Math.cos(a) * (55 + r() * 15), -1, Math.sin(a) * (55 + r() * 15)); S.scene.add(m); }
  return hf;
}
shot({ t0: cue('Five years later', 11.4) - .1, build(S) {
  S.bg = C.navy; S.sky = [C.navy, C.sky]; S.fogNear = 30; S.fogFar = 115;
  const hf = landscape(S);
  const st = { hf, col: colossus(.9), rid: rider(1.2) };
  S.scene.add(st.col, st.rid);
  st.wire = wire(st.col); st.wire.visible = false; st.col.add(st.wire);
  st.tYear = cue('Five years later', 11.4); st.tSotc = cue('Shadow of the Colossus', 12.8);
  st.tHorse = cue('horse', 15.1); st.tBoy = cue('boy', 15.8); st.tGiants = cue('16 giants', 16.6);
  st.tPoly = cue('18,000', 18); st.tWalk = cue('walking', 20.2); st.tLoad = cue('loading screen', 23);
  st.hits = [st.tYear, st.tPoly, st.tLoad];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  const cz = -2 + lt * .55;
  st.col.position.set(4, st.hf(4, cz) - .2, cz);
  st.col.legL.rotation.x = Math.sin(lt * 1.6) * .35; st.col.legR.rotation.x = -Math.sin(lt * 1.6) * .35;
  st.col.armL.rotation.x = -Math.sin(lt * 1.6) * .2; st.col.armR.rotation.x = Math.sin(lt * 1.6) * .2;
  st.col.position.y += Math.abs(Math.cos(lt * 1.6)) * .15;
  const rz = cz + 7 + Math.sin(lt * .5);
  st.rid.position.set(-2.5, st.hf(-2.5, rz), rz); st.rid.rotation.y = -Math.PI / 2;
  st.rid.position.y += Math.abs(Math.sin(lt * 7)) * .08;
  st.wire.visible = t > st.tPoly - .1 && t < st.tWalk + .3;
  const camZ = cz + 19 - ease((t - st.tWalk) / 3) * 4;
  S.cam.position.set(-7 + ease((t - st.tWalk) / 4) * 3, 5 + st.hf(-7, camZ) * .3, camZ);
  S.cam.lookAt(1, 4.2, cz + 1);
}, draw(st, t, S) {
  const a = ease((t - st.tYear) / .4);
  text('LATER', 18, 34, { size: 7, col: C.silver, align: 'left', alpha: a });
  const yr = 2000 + Math.floor(5 * easeOut((t - st.tYear) / .9));
  text(String(yr), 17, 50, { size: 24, font: 'head', weight: 900, align: 'left', alpha: a, noKinetic: true, col: yr < 2005 ? C.yellow : C.white });
  const b = ease((t - st.tSotc) / .4);
  text('SHADOW OF THE COLOSSUS', W - 18, 36, { size: 9, font: 'head', align: 'right', alpha: b });
  card('sotc_cover', 18, 60, 44, t, { t0: st.tSotc });
  card('sotc_valus', W - 18, 92, 96, t, { t0: st.tGiants + .4, t1: st.tLoad, align: 'right', label: 'ONE OF THE 16 COLOSSI' });
  tag(S.cam, st.rid.position.clone().add(V(.5, 1.2, 0)), 'a horse', { alpha: ease((t - st.tHorse) / .3) * (1 - ease((t - st.tGiants - 1) / .4)), dy: -12, dx: -10 });
  tag(S.cam, st.rid.position.clone().add(V(0, 1.6, 0)), 'a boy', { alpha: ease((t - st.tBoy) / .3) * (1 - ease((t - st.tGiants - 1) / .4)), dy: -22, dx: 8 });
  // 16 giants counter as tiny silhouettes
  const g = ease((t - st.tGiants) / .3);
  if (g > 0) for (let i = 0; i < 16; i++) {
    const on = t > st.tGiants + i * .05;
    const x = W - 18 - (15 - i) * 7, y = 48;
    rect(x - 2, y, 4, 5, on ? C.silver : C.dark, g); rect(x - 1.2, y - 2, 2.4, 2, on ? C.silver : C.dark, g);
    rect(x - .9, y - 1.3, .6, .5, C.cyan, on ? g : 0);
  }
  text('16 GIANTS', W - 18, 60, { size: 6.5, col: C.silver, align: 'right', alpha: g });
  const p = ease((t - st.tPoly) / .3) * (1 - ease((t - st.tLoad) / .4));
  const n = Math.round(18000 * easeOut((t - st.tPoly) / 1.2));
  if (p > 0) stat(W - 18, 76, n.toLocaleString('en-US'), 'polygons', { align: 'right', size: 14, alpha: p, unitCol: C.cyan });
  const l = ease((t - st.tLoad) / .3);
  if (l > 0) {
    const x = W / 2 - 30, y = 88;
    rect(x - 52, y - 8, 104, 16, C.bg, .75 * l); frame(x - 52, y - 8, 104, 16, C.red, l, .8);
    text('NOW LOADING', x - 26, y, { size: 7, col: C.silver, alpha: l, outline: false });
    rect(x + 8, y - 2, 36, 4, C.dark, l); rect(x + 8, y - 2, 12, 4, C.silver, l);
    line(x - 50, y - 6, x + 50, y + 6, C.red, l, 1.2); line(x - 50, y + 6, x + 50, y - 6, C.red, l, 1.2);
    text('0 LOADING SCREENS', x, y + 16, { size: 7, font: 'head', col: C.orange, alpha: l });
  }
}});

// ---- 1d: nobody upgraded the hardware; the people writing the code changed ----
shot({ t0: cue('Nobody upgraded', 24.3) - .1, build(S) {
  const st = { ps2: ps2(), people: [] };
  S.scene.add(st.ps2, gridFloor(60, 1, C.navy));
  const r = rng(9);
  for (let i = 0; i < 9; i++) { const p = person(['blue', 'red', 'lime', 'orange', 'cyan', 'plum'][i % 6], 2.2);
    const a = -.3 + i * .4; p.position.set(-3.2 + i * .8, 0, -1.9 - (i % 2) * .5); p.rotation.y = 0; p.visible = false; S.scene.add(p); st.people.push(p); }
  st.tSame = cue('console was the same', 25.9); st.tPeople = cue('people writing', 28.3); st.tNobody = cue('Nobody', 24.4);
  st.hits = [st.tPeople];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  orbit(S.cam, V(0, .9, -.5), lerp(6.6, 7.4, ease(lt / 5)), .3 - lt * .04, 2.2);
  st.people.forEach((p, i) => { const s = pop(t, st.tPeople + i * .06, .3); p.visible = s > 0; p.scale.setScalar(Math.max(s, .01)); p.position.y = Math.abs(Math.sin(t * 6 + i)) * .05; });
}, draw(st, t, S) {
  const items = [['CPU', 'same'], ['32 MB RAM', 'same'], ['GPU', 'same'], ['DVD DRIVE', 'same']];
  items.forEach(([a, b], i) => {
    const al = ease((t - st.tNobody - i * .25) / .3) * (1 - ease((t - st.tPeople) / .4));
    text(a, 22, 40 + i * 13, { size: 7.5, font: 'head', align: 'left', alpha: al });
    text('= ' + b, 88, 40 + i * 13, { size: 7.5, col: C.lime, align: 'left', alpha: al * ease((t - st.tSame) / .3) });
  });
  const code = ['(stream-sector s)', 'lq.xyzw vf01', 'blend(prev, .3)'];
  code.forEach((c, i) => {
    const s = st.people[i * 4];
    const al = ease((t - st.tPeople - .2 - i * .12) / .3);
    const [x, y] = project(s.position.clone().add(V(0, 1.3, 0)), S.cam);
    text(c, x, y - 6, { size: 7, col: [C.lime, C.cyan, C.yellow, C.orange, C.sky][i], alpha: al });
  });
}});

// ---- 1e: title: the console bursts into voxels as THE LIMITS slams in letter by letter ----
shot({ t0: cue('And in this video', 29.7) - .1, trans: 3, build(S) {
  const st = { ps2: ps2() };
  S.scene.add(st.ps2, gridFloor(60, 1, C.navy));
  const N = 320, r = rng(21);
  st.burst = ['blue', 'cyan', 'yellow', 'white'].map(c => { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), facet(c), N / 4); S.scene.add(im); return im; });
  st.parts = Array.from({ length: N }, () => ({ v: V(r() - .5, r() * .9 + .2, r() - .5).normalize().multiplyScalar(3 + r() * 7), s: .06 + r() * .16, spin: r() * 9 }));
  st.tBoom = S.t0 + .35; st.t = cue('figured out', 31.5);
  st.hits = [st.tBoom, st.tBoom + .45];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0, d = Math.max(0, t - st.tBoom);
  orbit(S.cam, V(0, .6, 0), lerp(6.5, 9.5, easeOut(d / 1.5)), 2.6 + lt * .15, lerp(2.2, 3.4, easeOut(d / 1.5)));
  st.ps2.scale.setScalar(t < st.tBoom ? 1 + Math.sin(lt * 40) * .015 * (lt / .35) : Math.max(.001, 1 - d * 4));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E3 = new THREE.Euler();
  st.parts.forEach((p, i) => {
    const im = st.burst[i % 4], k = Math.floor(i / 4);
    const pos = V(0, .5, 0).addScaledVector(p.v, d).add(V(0, -4.9 * d * d * .35, 0));
    pos.y = Math.max(pos.y, p.s / 2);
    const s = t > st.tBoom ? p.s * (1 - clamp((d - 1.4) / .6)) : .0001;
    im.setMatrixAt(k, M.compose(pos, Q.setFromEuler(E3.set(d * p.spin, d * p.spin * .7, 0)), V(s, s, s)));
  });
  st.burst.forEach(im => im.instanceMatrix.needsUpdate = true);
}, draw(st, t, S) {
  const a = ease((t - st.tBoom) / .3);
  rect(0, 50, W, 52, C.bg, .55 * a);
  text('BUILT RIGHT UP AGAINST', W / 2, 60, { size: 7, col: C.yellow, alpha: ease((t - st.tBoom - .5) / .4), spacing: 1.5 });
  const word = 'THE LIMITS'; hud.font = `900 24px ${FONT.head}`;
  const tw = hud.measureText(word).width; let x = W / 2 - tw / 2;
  [...word].forEach((ch, i) => {
    const cw = hud.measureText(ch).width, tl = st.tBoom + .05 + i * .045, k = clamp((t - tl) / .22);
    if (k > 0) text(ch, x + cw / 2, 82 - (1 - easeOut(k)) * 26, { size: 24, font: 'head', weight: 900, alpha: 1, noKinetic: true, col: k < 1 ? C.yellow : C.white });
    x += cw;
  });
  text('how PS2 studios hid the hardware', W / 2, 98, { size: 7, col: C.silver, alpha: ease((t - st.tBoom - .9) / .4) });
}});

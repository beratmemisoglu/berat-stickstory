// 2:08 - 3:30  Inside the PS2: Emotion Engine (core, VU0, VU1), Graphics Synthesizer, DVD drive; three tools.
import { THREE, C, shot, cue, ease, easeOut, easeIn, seg, pop, clamp, lerp, V, text, stat, tag, rect, line, frame, project, facet, flat, box, rng, W, H, card } from '../engine.js';
import { ps2, chip, disc, memory, gridFloor, orbit, panel } from '../models.js';

// ---------- the board, shared by every hardware shot ----------
function board(S) {
  const b = { };
  S.scene.add(box(13, .2, 9, [C.bg, C.navy, C.teal], [0, -.1, 0]));
  // copper traces
  const pts = [], r = rng(4);
  for (let i = 0; i < 70; i++) { const z = -4 + r() * 8, x0 = -6 + r() * 5, x1 = x0 + 1 + r() * 5; pts.push(x0, .01, z, x1, .01, z, x1, .01, z, x1, .01, z + (r() - .5) * 2); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  S.scene.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: C.green })));
  const segs = []; for (let i = 0; i < pts.length; i += 6) segs.push([pts[i], pts[i + 2], pts[i + 3], pts[i + 5]]);
  const pulse = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), facet('yellow'), segs.length); S.scene.add(pulse);
  b.tick = t => { const M = new THREE.Matrix4();
    segs.forEach(([x0, z0, x1, z1], i) => { const k = (t * (.35 + (i % 7) * .08) + i * .37) % 1;
      pulse.setMatrixAt(i, M.makeScale(.12, .05, .12).setPosition(lerp(x0, x1, k), .03, lerp(z0, z1, k))); });
    pulse.instanceMatrix.needsUpdate = true; };
  // Emotion Engine with its three units on the die
  b.ee = chip(2.6, 2.6); b.ee.position.set(-3, 0, 0); S.scene.add(b.ee);
  b.core = box(.9, .25, .9, 'white', [-3.45, .32, -.35]);
  b.vu0 = box(.5, .25, .5, 'sky', [-2.55, .32, -.55]);
  b.vu1 = box(.5, .25, .5, 'cyan', [-2.55, .32, .25]);
  S.scene.add(b.core, b.vu0, b.vu1);
  // RAM
  b.ram = [chip(1.5, .8, 'black', 'blue'), chip(1.5, .8, 'black', 'blue')];
  b.ram.forEach((m, i) => { m.position.set(-3.8 + i * 1.7, 0, 2.6); S.scene.add(m); });
  // Graphics Synthesizer with embedded memory
  b.gs = chip(2.2, 2.2); b.gs.position.set(1.6, 0, .2); S.scene.add(b.gs);
  b.edram = box(1.0, .22, .7, 'plum', [1.6, .3, .45]); b.gsCore = box(1.0, .22, .4, 'orange', [1.6, .3, -.25]);
  S.scene.add(b.edram, b.gsCore);
  // VU1 -> GS bus
  b.bus = new THREE.Group();
  for (let i = 0; i < 3; i++) b.bus.add(box(3.7, .03, .06, 'yellow', [-.55, .03, .1 + i * .12]));
  S.scene.add(b.bus); b.bus.visible = false;
  // DVD drive
  b.dvd = new THREE.Group(); b.dvd.position.set(4.3, 0, -1.8);
  b.dvd.add(box(3.6, .35, 3.6, 'grey', [0, .17, 0]));
  b.disc = disc(1.5); b.disc.position.set(0, .42, 0); b.dvd.add(b.disc);
  b.dvd.add(box(.12, .05, 3.2, 'black', [1.55, .4, 0]));
  b.laser = box(.36, .16, .3, 'red', [1.55, .5, 0]); b.dvd.add(b.laser);
  b.beam = box(.04, .5, .04, 'yellow', [1.55, .7, 0]); b.dvd.add(b.beam);
  S.scene.add(b.dvd);
  return b;
}
const Pee = V(-3, .3, 0), Pgs = V(1.6, .3, .2), Pdvd = V(4.3, .4, -1.8);
function camTo(S, target, r, ang, h) { orbit(S.cam, target, r, ang, h); }
function flowCubes(S, n, col) {
  const g = []; for (let i = 0; i < n; i++) { const m = box(.14, .14, .14, col); S.scene.add(m); g.push(m); } return g;
}

// ---- 4a: open up the PS2 ----
shot({ t0: cue("So let's open up", 128) - .1, build(S) {
  const st = { b: board(S), shell: ps2() };
  st.shell.scale.setScalar(4.3); st.shell.position.set(0, -.3, 0); S.scene.add(st.shell);
  st.tOpen = cue('open up', 128.5); st.tStudios = cue('the studios', 130);
  st.hits = [st.tOpen + .4];
  return st;
}, update(st, t, S) {
  st.b?.tick?.(t);
  const k = easeIn((t - st.tOpen) / 1.6);
  st.shell.position.y = -.3 + k * 16; st.shell.rotation.z = k * .3;
  st.shell.visible = k < .98;
  camTo(S, V(0, 0, 0), lerp(19, 13, ease((t - S.t0) / 3.5)), .5, lerp(10, 9.5, k));
}, draw(st, t, S) {
  card('ps2_board', W - 18, 24, 118, t, { t0: st.tOpen + 1.1, align: 'right', label: 'THE REAL THING', sub: 'SCPH-30001 board · photo: Evan-Amos' });
}});

// ---- 4b: Emotion Engine, main core @ 294.9 MHz ----
shot({ t0: cue('At the center', 131.6) - .1, build(S) {
  const st = { b: board(S) };
  st.tEE = cue('Emotion Engine', 132.4); st.tCore = cue('main core', 134); st.tMhz = cue('294.9', 136);
  st.hits = [st.tEE, st.tMhz];
  return st;
}, update(st, t, S) {
  st.b?.tick?.(t);
  const lt = t - S.t0;
  camTo(S, V(-3, .2, 0), lerp(7, 4.2, ease(lt / 3)), .35 + lt * .03, lerp(4.5, 3.2, ease(lt / 3)));
  const k = ease((t - st.tCore) / .4);
  st.b.core.position.y = .32 + k * .25 + (t > st.tMhz ? Math.abs(Math.sin(t * 20)) * .03 : 0);
  st.b.core.material = facet(t > st.tCore ? 'yellow' : 'white');
}, draw(st, t, S) {
  const a = ease((t - st.tEE) / .4);
  text('EMOTION ENGINE', 18, 30, { size: 11, font: 'head', align: 'left', alpha: a });
  text('the main processor chip', 18, 41, { size: 6.5, col: C.silver, align: 'left', alpha: a });
  tag(S.cam, st.b.core.position.clone().add(V(0, .15, 0)), 'MAIN CORE', { alpha: ease((t - st.tCore) / .3), dx: 40, dy: -22, sub: 'runs the game logic' });
  card('ee_chip', 18, 54, 58, t, { t0: st.tEE + .4, label: 'EMOTION ENGINE', sub: 'CXD9615GB · CC BY-SA 3.0' });
  const m = ease((t - st.tMhz) / .4);
  if (m > 0) stat(W - 20, 34, (294.9 * easeOut((t - st.tMhz) / .8)).toFixed(1), 'MHz', { size: 16, align: 'right', alpha: m });
}});

// ---- 4c: the two vector units ----
shot({ t0: cue('Next to it sit', 138) - .1, build(S) {
  const st = { b: board(S), lanes: flowCubes(S, 16, 'cyan'), model: new THREE.Group() };
  const tri = new THREE.Mesh(new THREE.IcosahedronGeometry(.45, 0), facet('orange'));
  st.wire = new THREE.LineSegments(new THREE.EdgesGeometry(tri.geometry), new THREE.LineBasicMaterial({ color: C.cyan }));
  st.model.add(tri, st.wire); st.tri = tri; st.model.position.set(-2.55, 1.6, .25); S.scene.add(st.model);
  st.tVU = cue('two vector units', 138.6); st.tFour = cue('four floating point', 140.6); st.tVU0 = cue('VU0', 143.6);
  st.tVU1 = cue('VU1 is wired', 146.8); st.tMoved = cue('moved', 150.5); st.tLit = cue('lit', 151.6); st.tTri = cue('triangles', 152.5);
  st.tHand = cue('by hand', 156.7); st.tAsm = cue('assembly language', 157.9);
  st.hits = [st.tVU, st.tFour, st.tTri];
  return st;
}, update(st, t, S) {
  st.b?.tick?.(t);
  const lt = t - S.t0;
  const toGS = ease((t - st.tVU1) / 2);
  camTo(S, V(lerp(-2.6, -.8, toGS), .3, 0), lerp(4.4, 6.6, toGS), .2 + lt * .012, lerp(2.4, 3.6, toGS));
  st.b.vu0.position.y = .32 + ease((t - st.tVU) / .4) * .2; st.b.vu1.position.y = .32 + ease((t - st.tVU - .2) / .4) * .2;
  st.b.bus.visible = t > st.tVU1 + .3;
  // 4 lanes of numbers going through a VU together (SIMD)
  const f = ease((t - st.tFour) / .3) * (1 - ease((t - st.tVU0) / .3));
  st.lanes.forEach((c, i) => {
    const lane = i % 4, k = ((lt * .8 + Math.floor(i / 4) * .25) % 1);
    c.position.set(-2.55 + (lane - 1.5) * .2, .8, -.55 - 1.2 + k * 2.4); c.visible = f > 0 && k > .05 && k < .95;
  });
  // VU1: model gets moved, lit, turned into triangles
  const m = ease((t - st.tMoved) / .3);
  st.model.visible = m > 0 && t < st.tHand;
  st.model.scale.setScalar(Math.max(m, .01));
  st.model.rotation.set(t * .8, t * 1.1, 0);
  st.model.position.x = -2.55 + Math.sin(Math.max(0, t - st.tMoved) * 2) * .4;
  st.tri.material = facet(t > st.tLit ? 'orange' : 'grey');
  st.tri.visible = t < st.tTri + .2 || Math.floor(t * 4) % 2 === 0 && t < st.tTri + .6;
  st.wire.visible = t > st.tTri;
}, draw(st, t, S) {
  const a = ease((t - st.tVU) / .4);
  text('2 VECTOR UNITS', 18, 30, { size: 10, font: 'head', align: 'left', alpha: a });
  text('small math processors', 18, 41, { size: 6.5, col: C.silver, align: 'left', alpha: a });
  const f = ease((t - st.tFour) / .3) * (1 - ease((t - st.tVU0) / .3));
  text('4 CALCULATIONS AT ONCE', W - 18, 30, { size: 8, font: 'head', col: C.cyan, align: 'right', alpha: f });
  text('x  y  z  w', W - 18, 41, { size: 7, col: C.silver, align: 'right', alpha: f });
  tag(S.cam, st.b.vu0.position.clone().add(V(0, .15, 0)), 'VU0', { alpha: ease((t - st.tVU0) / .3), dx: 34, dy: -24, col: C.sky, sub: 'physics · animation' });
  tag(S.cam, st.b.vu1.position.clone().add(V(0, .15, 0)), 'VU1', { alpha: ease((t - st.tVU1) / .3), dx: -10, dy: 26, col: C.cyan, sub: 'geometry for the GS' });
  const bus = project(V(0, .1, .2), S.cam);
  text('direct line to the graphics chip', bus[0], bus[1] - 8, { size: 6, col: C.yellow, alpha: ease((t - st.tVU1 - .5) / .3) * (1 - ease((t - st.tMoved) / .3)) });
  const steps = [[st.tMoved, 'MOVED'], [st.tLit, 'LIT'], [st.tTri, 'TRIANGLES']];
  steps.forEach(([tc, s], i) => text(s, W - 18, 30 + i * 11, { size: 8, font: 'head', align: 'right', col: C.orange, alpha: ease((t - tc) / .25) * (1 - ease((t - st.tHand) / .3)) }));
  const h = ease((t - st.tHand) / .3);
  if (h > 0) {
    const L = ['; VU1 microprogram', 'lq.xyzw   vf01, 0(vi01)', 'mulax.xyzw ACC, vf10, vf01x', 'madday.xyzw ACC, vf11, vf01y', 'maddz.xyzw vf02, vf12, vf01z', 'div  Q, vf00w, vf02w', 'mulq.xyz  vf02, vf02, Q', 'sq.xyzw   vf02, 1(vi02)'];
    rect(W - 128, 26, 112, 8 + L.length * 8, C.bg, .88 * h); frame(W - 128, 26, 112, 8 + L.length * 8, C.slate, h);
    L.forEach((s, i) => text(s, W - 123, 33 + i * 8, { size: 5.8, align: 'left', col: i === 0 ? C.slate : C.lime, outline: false, alpha: h * ease((t - st.tHand - i * .12) / .15) }));
  }
}});

// ---- 4d: the Graphics Synthesizer ----
shot({ t0: cue("Then there's the graphics", 158.9) - .1, build(S) {
  const st = { b: board(S), layers: [] };
  for (let i = 0; i < 14; i++) { const p = panel(1.6, .9, ['blue', 'orange', 'green', 'sky', 'red', 'yellow', 'plum'][i % 7]);
    p.rotation.x = -Math.PI / 2; p.position.set(1.6, .7 + i * .09, .2); S.scene.add(p); st.layers.push(p); }
  st.bits = flowCubes(S, 10, 'yellow');
  st.tGS = cue('graphics synthesizer', 159.6); st.t4 = cue('only 4 megabytes', 162); st.tIn = cue('built right into', 164.5); st.t48 = cue('48 gigabytes', 166);
  st.tFill = cue('2.4 billion', 169); st.tShader = cue("can't run shaders", 171.3); st.tVertex = cue("can't move a single", 172.6);
  st.tPaint = cue('paint the whole screen', 174.9); st.tBarely = cue('barely slow down', 178.5);
  st.hits = [st.tGS, st.t48, st.tFill, st.tPaint];
  return st;
}, update(st, t, S) {
  st.b?.tick?.(t);
  const lt = t - S.t0;
  camTo(S, V(1.6, .6, .2), lerp(5.2, 4.4, ease(lt / 8)) + ease((t - st.tPaint) / 1.5) * 1.2, -.35 + lt * .02, 2.4 + ease((t - st.tPaint) / 1.5) * 1.2);
  st.b.edram.position.y = .3 + ease((t - st.t4) / .4) * .15;
  const bw = ease((t - st.t48) / .3) * (1 - ease((t - st.tFill) / .3));
  st.bits.forEach((c, i) => { const k = (t * 2.2 + i / 10) % 1; c.position.set(1.2 + k * .8, .55, .45 - .35 + (i % 2) * .7 * 0); c.position.z = lerp(.45, -.25, k); c.visible = bw > 0; });
  const p = t - st.tPaint;
  st.layers.forEach((l, i) => { const s = p > i * .16 ? 1 : 0; l.visible = s > 0 && (p < 3.2); l.position.y = .7 + i * .08; });
}, draw(st, t, S) {
  const a = ease((t - st.tGS) / .4);
  text('GRAPHICS SYNTHESIZER', 18, 30, { size: 10, font: 'head', align: 'left', alpha: a });
  text('the "GS" - the graphics chip', 18, 41, { size: 6.5, col: C.silver, align: 'left', alpha: a });
  tag(S.cam, st.b.edram.position.clone().add(V(0, .12, 0)), '4 MB', { alpha: ease((t - st.t4) / .3), dx: 26, dy: -20, col: C.red, sub: t > st.tIn ? 'built into the chip' : 'video memory' });
  const b = ease((t - st.t48) / .3);
  stat(W - 20, 34, '48', 'GB/s', { size: 14, align: 'right', alpha: b, label: 'bandwidth' });
  const c = ease((t - st.tFill) / .3);
  stat(W - 20, 64, '2.4', 'billion px/s', { size: 14, align: 'right', alpha: c, unitCol: C.orange });
  [[st.tShader, 'NO SHADERS'], [st.tVertex, "CAN'T MOVE VERTICES"]].forEach(([tc, s], i) => {
    const d = ease((t - tc) / .3) * (1 - ease((t - st.tPaint) / .3));
    text('✕ ' + s, 18, 58 + i * 11, { size: 7.5, font: 'head', col: C.red, align: 'left', alpha: d });
  });
  const e = ease((t - st.tPaint) / .3);
  if (e > 0) { const n = Math.min(14, Math.floor((t - st.tPaint) / .16) + 1);
    text('BUT IT CAN PAINT', 18, 58, { size: 8, font: 'head', col: C.lime, align: 'left', alpha: e });
    text(`screen layer ${n} / frame`, 18, 69, { size: 7, col: C.silver, align: 'left', alpha: e }); }
  text('...and barely slow down', 18, 80, { size: 7, col: C.yellow, align: 'left', alpha: ease((t - st.tBarely) / .3) });
}});

// ---- 4e: the DVD drive: 5.5 MB/s, but seeking reads nothing ----
shot({ t0: cue('And finally', 179.7) - .1, build(S) {
  const st = { b: board(S) };
  st.tDVD = cue('the DVD drive', 180.5); st.t55 = cue('5.5 megabytes', 183); st.tLaser = cue('the laser', 187.5); st.tJump = cue('Every jump', 190.8); st.tNothing = cue('reading nothing', 193.5);
  st.hits = [st.t55, st.tJump];
  return st;
}, update(st, t, S) {
  st.b?.tick?.(t);
  const lt = t - S.t0;
  camTo(S, V(4.3, .5, -1.8), lerp(6, 4.6, ease(lt / 4)), .55 - lt * .02, 3.4);
  st.b.disc.rotation.y = t * 9;
  // laser: reads slowly, then jumps (fast, beam off) every ~1.5 s after the "laser" cue
  let z = Math.sin(lt * .15) * .3, reading = true;
  if (t > st.tLaser) {
    const c = (t - st.tLaser) / 1.5, ph = c % 1, i = Math.floor(c);
    const from = [-.9, 1.1, -.3, .8, -1.1, .4][i % 6], to = [1.1, -.3, .8, -1.1, .4, -.9][i % 6];
    if (ph < .45) { z = lerp(from, to, easeOut(ph / .45)); reading = false; } else z = to + (ph - .45) * .1;
  }
  st.b.laser.position.z = z; st.b.beam.position.z = z; st.b.beam.visible = reading && Math.floor(t * 20) % 3 !== 0;
  st.reading = reading;
}, draw(st, t, S) {
  const a = ease((t - st.tDVD) / .4);
  text('DVD DRIVE', 18, 30, { size: 11, font: 'head', align: 'left', alpha: a });
  stat(18, 50, '5.5', 'MB/s', { size: 14, align: 'left', alpha: ease((t - st.t55) / .3), label: '' });
  text('at full speed', 18, 62, { size: 6.5, col: C.silver, align: 'left', alpha: ease((t - st.t55) / .3) });
  const s = ease((t - st.tLaser) / .3);
  if (s > 0) {
    const [x, y] = project(st.b.laser.getWorldPosition(V(0, 0, 0)).add(V(0, .3, 0)), S.cam);
    text(st.reading ? 'READING' : 'SEEKING... reading nothing', x, y - 12, { size: 7, font: 'head', col: st.reading ? C.lime : C.red, alpha: s });
  }
}});

// ---- 4f: three tools in the box ----
shot({ t0: cue('So there are three tools', 194.2) - .1, build(S) {
  const st = { ped: [] };
  S.scene.add(gridFloor(80, 1, C.navy));
  const items = [];
  const vus = new THREE.Group(); vus.add(box(.7, .7, .7, 'sky', [-.45, .35, 0]), box(.7, .7, .7, 'cyan', [.45, .35, 0]));
  const gs = chip(1.6, 1.6); gs.add(box(1.2, .06, .8, 'plum', [0, .22, 0]));
  const dsc = disc(1.0);
  [vus, gs, dsc].forEach((o, i) => {
    const p = new THREE.Group(); p.add(box(2.2, .5, 2.2, 'black', [0, .25, 0])); o.position.y = .6; p.add(o);
    p.position.set((i - 1) * 4.6, 0, 0); S.scene.add(p); st.ped.push({ p, o });
  });
  st.tThree = cue('three tools', 194.9); st.tPair = cue('a pair of processors', 196.1); st.tProg = cue('if you write', 198.3);
  st.tChip = cue("a graphics chip that's bad", 199.4); st.tDisc = cue('and a disc', 203); st.tSlow = cue('slow to move', 204.5);
  st.tBest = cue('better than anyone', 208.5);
  st.hits = [st.tThree, st.tBest];
  return st;
}, update(st, t, S) {
  st.b?.tick?.(t);
  orbit(S.cam, V(0, .8, 0), 12.5, Math.sin((t - S.t0) * .15) * .15, 2.6);
  const tt = [st.tPair, st.tChip, st.tDisc];
  st.ped.forEach(({ p, o }, i) => {
    const on = t > tt[i] - .1; o.rotation.y = t * (on ? .9 : .2);
    p.position.y = on ? ease((t - tt[i]) / .3) * .3 * (1 - ease((t - tt[i] - 2.5) / .5)) : 0;
    if (i === 2) { o.rotation.x = .5; o.rotation.y = t * 3; }
  });
}, draw(st, t, S) {
  const a = ease((t - st.tThree) / .4);
  text('3 TOOLS IN THE BOX', W / 2, 28, { size: 10, font: 'head', alpha: a });
  const cards = [[st.tPair, 'PROCESSORS', 'can do anything', st.tProg, 'if you write the code'],
                 [st.tChip, 'GRAPHICS CHIP', 'bad at thinking', st.tChip + 1.7, 'fast at drawing'],
                 [st.tDisc, 'THE DISC', 'huge', st.tSlow, 'slow to move around']];
  cards.forEach(([tc, h, s1, t2, s2], i) => {
    const [x] = project(V((i - 1) * 4.6, 0, 0), S.cam);
    const b = ease((t - tc) / .3);
    text(h, x, 124, { size: 8, font: 'head', alpha: b });
    text(s1, x, 134, { size: 6.5, col: C.silver, alpha: b });
    text(s2, x, 142, { size: 6.5, col: C.yellow, alpha: ease((t - t2) / .3) });
  });
  const c = ease((t - st.tBest) / .4);
  text('every great PS2 game mastered one of them', W / 2, 40, { size: 7, col: C.cyan, alpha: c });
}});

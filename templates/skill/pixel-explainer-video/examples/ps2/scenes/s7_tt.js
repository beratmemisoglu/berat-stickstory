// 6:50 - 7:38  Traveller's Tales: moving a whole particle system onto VU1.
import { THREE, C, shot, cue, ease, easeOut, easeIn, seg, pop, clamp, lerp, V, text, stat, tag, rect, line, frame, project, facet, flat, box, rng, W, H, card } from '../engine.js';
import { chip, gridFloor, orbit } from '../models.js';

const CH = ['03', 'THE VECTOR UNITS  ·  TRAVELLER\'S TALES'];

function particles(S, n, col) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), facet(col), n); S.scene.add(im); return im;
}

// ---- 7a: candle flames and window light, made of particles ----
shot({ t0: cue("Now let's look at the vector units", 409.5) - .1, chapter: CH, chapterFirst: true, build(S) {
  S.bg = C.bg; S.fogNear = 14; S.fogFar = 34;
  const st = {};
  S.scene.add(box(20, .1, 16, [C.bg, C.dark, C.dark], [0, -.05, 0]));
  S.scene.add(box(20, 8, .3, [C.bg, C.plum, C.plum], [0, 4, -6]));                  // back wall
  for (const x of [-10, 10]) S.scene.add(box(.3, 8, 16, [C.bg, C.plum, C.plum], [x, 4, 0]));
  st.windows = [-5, 0, 5].map(x => { const w = box(1.6, 3, .1, 'cyan', [x, 4.6, -5.8]); S.scene.add(w); S.scene.add(box(1.8, .3, .2, 'black', [x, 6.3, -5.7])); return w; });
  for (let i = 0; i < 6; i++) S.scene.add(box(.9, .5, .9, 'grey', [-6.5 + i * 2.6, .25, -3]));
  st.candles = [];
  for (let i = 0; i < 6; i++) { const x = -6.5 + i * 2.6; S.scene.add(box(.18, .5, .18, 'white', [x, .75, -3])); st.candles.push(V(x, 1.05, -3)); }
  st.flame = particles(S, 6 * 40, 'yellow'); st.flame2 = particles(S, 6 * 20, 'orange');
  st.dust = particles(S, 3 * 90, 'cyan');
  st.tCrash = cue('Crash Bandicoot', 412); st.tBurton = cue('Jon Burton', 417.3); st.tFlame = cue('candle flames', 421); st.tPart = cue('particles', 423.3); st.tTiny = cue('tiny shapes', 424.5);
  st.hits = [st.tPart];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  S.cam.position.set(Math.sin(lt * .04) * 3, 3.2, 8.5 - lt * .15); S.cam.lookAt(0, 2.4, -3.5);
  const M = new THREE.Matrix4(), r = rng(1);
  let n = 0, m = 0;
  st.candles.forEach((c, ci) => {
    for (let i = 0; i < 60; i++) {
      const life = ((t * 1.4 + i / 60 + ci * .17) % 1), s = (1 - life) * .12 + .02;
      const x = c.x + Math.sin(i * 12.9 + t * 7) * .06 * (1 + life), y = c.y + life * .55, z = c.z + Math.cos(i * 7.3) * .05;
      (i % 3 ? st.flame : st.flame2).setMatrixAt(i % 3 ? n++ : m++, M.makeScale(s, s, s).setPosition(x, y, z));
    }
  });
  st.flame.count = n; st.flame2.count = m;
  let d = 0;
  [-5, 0, 5].forEach((wx, wi) => { for (let i = 0; i < 90; i++) {
    const k = ((i * .137 + t * .05 + wi * .3) % 1), along = k;
    const x = wx + (r() - .5) * 1.4 + along * 1.8, y = 4.6 - along * 4.2 + Math.sin(t + i) * .1, z = -5.6 + along * 4.5 + (r() - .5) * .6;
    const s = .04 + (i % 3) * .015;
    st.dust.setMatrixAt(d++, M.makeScale(s, s, s).setPosition(x, y, z));
  } });
  st.dust.count = d;
  [st.flame, st.flame2, st.dust].forEach(im => im.instanceMatrix.needsUpdate = true);
}, draw(st, t, S) {
  const a = ease((t - st.tCrash) / .3);
  text('CRASH BANDICOOT', W - 18, 34, { size: 9, font: 'head', align: 'right', alpha: a });
  text('THE WRATH OF CORTEX · 2001', W - 18, 44, { size: 6.5, col: C.yellow, align: 'right', alpha: a });
  text("Jon Burton, founder of Traveller's Tales", W - 18, 54, { size: 6.5, col: C.silver, align: 'right', alpha: ease((t - st.tBurton) / .3) });
  card('crash_cover', W - 18, 62, 44, t, { t0: st.tCrash, align: 'right' });
  card('logo_tt', W - 68, 62, 40, t, { t0: st.tBurton, align: 'right' });
  card('crash_shot', 18, 46, 46, t, { t0: st.tPart + .4, label: 'IN-GAME' });
  tag(S.cam, st.candles[2].clone().add(V(0, .4, 0)), 'candle flames', { alpha: ease((t - st.tFlame) / .3), dy: -20, dx: -16, col: C.yellow });
  tag(S.cam, V(0, 3.2, -4), 'window light', { alpha: ease((t - st.tFlame - .8) / .3), dy: -18, dx: 24, col: C.cyan });
  const c = ease((t - st.tPart) / .3);
  text('= THOUSANDS OF PARTICLES', 18, 34, { size: 8, font: 'head', align: 'left', alpha: c });
}});

// ---- 7b: normally the main core does it; TT moved the whole system to VU1 ----
shot({ t0: cue('Normally', 425.3) - .1, chapter: CH, build(S) {
  const st = { flow: [] };
  S.scene.add(gridFloor(60, 1, C.navy));
  st.core = chip(2, 2, 'black', 'white'); st.core.position.set(-4, 0, 0);
  st.vu1 = chip(1.5, 1.5, 'black', 'cyan'); st.vu1.position.set(0, 0, 1.8);
  st.gs = chip(2, 2, 'black', 'orange'); st.gs.position.set(4, 0, 0);
  S.scene.add(st.core, st.vu1, st.gs);
  st.table = new THREE.Group(); for (let i = 0; i < 16; i++) st.table.add(box(.18, .08, .18, 'yellow', [(i % 4) * .22 - .33, 0, Math.floor(i / 4) * .22 - .33]));
  st.table.position.set(0, .35, 1.8); S.scene.add(st.table);
  for (let i = 0; i < 26; i++) { const b = box(.13, .13, .13, 'yellow'); S.scene.add(b); st.flow.push(b); }
  st.tWork = cue('work out where every particle', 426.5); st.tSend = cue('send the result', 430); st.tMoved = cue('moved the whole particle system', 432);
  st.tTable = cue('A table of data', 434.6); st.t16 = cue('16 kilobytes', 436.9); st.tCalc = cue('could calculate', 440); st.tTri = cue('turn them into', 442.6);
  st.tStraight = cue('straight to the graphics chip', 444.5); st.tNever = cue('never touched them', 446.3); st.tFree = cue('left free', 447.8);
  st.hits = [st.tMoved];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(0, .3, .6), 11, 0 + Math.sin((t - S.t0) * .1) * .08, 6.2);
  const moved = t > st.tMoved + .6;
  st.table.visible = t > st.tTable; st.table.position.y = .35 + (1 - ease((t - st.tTable) / .6)) * 2;
  st.flow.forEach((b, i) => {
    const k = (t * .8 + i / st.flow.length) % 1;
    let p;
    if (!moved) p = V(-4, .6, 0).lerp(V(4, .6, 0), k);                                   // core -> GS
    else { p = k < .5 ? V(0, .5, 1.8).lerp(V(0, .5, 1.8), 0) : V(0, .5, 1.8).lerp(V(4, .6, 0), (k - .5) * 2); if (k < .5) { const a = k * 12.5 + i; p.add(V(Math.cos(a) * .7, k * 1.2, Math.sin(a) * .7)); } }
    p.y += Math.sin(k * Math.PI) * (moved ? .8 : 1.2);
    b.position.copy(p); b.visible = t > st.tWork && (!moved || t > st.tCalc);
    b.material = facet(moved && k >= .5 ? 'orange' : 'yellow');
  });
}, draw(st, t, S) {
  const moved = t > st.tMoved + .6;
  tag(S.cam, V(-4, .4, 0), 'MAIN CORE', { dy: 30, alpha: 1 });
  tag(S.cam, V(0, .4, 1.8), 'VU1', { dy: 26, col: C.cyan, sub: t > st.t16 ? '16 KB of memory' : '' });
  tag(S.cam, V(4, .4, 0), 'GRAPHICS CHIP', { dy: 30 });
  // core load bar
  const [cx, cy0] = project(V(-4, 0, 0), S.cam), cy = cy0 + 58;
  const load = moved ? (t > st.tFree ? .35 : .08) : .95;
  rect(cx - 22, cy - 18, 44, 5, C.dark); rect(cx - 22, cy - 18, 44 * load, 5, moved ? C.lime : C.red);
  text(moved ? (t > st.tFree ? 'AI + PHYSICS' : 'idle') : 'BUSY: particles', cx, cy - 24, { size: 6, col: moved ? C.lime : C.red });
  const a = ease((t - S.t0) / .3) * (1 - ease((t - st.tMoved) / .3));
  text('NORMALLY', 18, 34, { size: 9, font: 'head', align: 'left', alpha: a, col: C.silver });
  const b = ease((t - st.tMoved) / .3);
  text("TRAVELLER'S TALES: ALL OF IT ON VU1", 18, 34, { size: 8, font: 'head', align: 'left', alpha: b, col: C.cyan });
  const steps = [[st.tCalc, 'calculate every particle'], [st.tTri, 'turn them into triangles'], [st.tStraight, 'send straight to the GS']];
  steps.forEach(([tc, s], i) => text(`${i + 1}. ${s}`, 18, 46 + i * 9, { size: 6.5, align: 'left', alpha: ease((t - tc) / .3) }));
  text('the main core never touches them', W - 18, 34, { size: 7, col: C.yellow, align: 'right', alpha: ease((t - st.tNever) / .3) });
}});

// ---- 7c: that's what the vector units were for: a second processor, free ----
shot({ t0: cue("That's what the vector units were for", 449.5) - .1, chapter: CH, build(S) {
  const st = { a: chip(2, 2, 'black', 'white'), b: chip(2, 2, 'black', 'dark') };
  st.b.children[1].material = facet('grey');
  st.a.position.set(-1.8, 0, 0); st.b.position.set(1.8, 0, 0);
  S.scene.add(st.a, st.b, gridFloor(60, 1, C.navy));
  st.tLaunch = cue('launch games', 451.3); st.tHard = cue('code was hard', 454); st.tLearned = cue('studios that learned', 455.3); st.tSecond = cue('second processor for free', 457);
  st.hits = [st.tSecond];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(0, .3, 0), 6.5, .0 + (t - S.t0) * .03, 3.4);
  const on = t > st.tLearned + .6;
  st.b.children[1].material = facet(on ? 'cyan' : 'grey'); st.b.position.y = on ? ease((t - st.tLearned - .6) / .3) * .25 : 0;
}, draw(st, t, S) {
  const a = ease((t - st.tLaunch) / .3) * (1 - ease((t - st.tLearned) / .3));
  text('LAUNCH GAMES: VUs mostly idle', W / 2, 36, { size: 8, font: 'head', col: C.silver, alpha: a });
  text('(that code was hard to write)', W / 2, 47, { size: 6.5, col: C.slate, alpha: a * ease((t - st.tHard) / .3) });
  const b = ease((t - st.tSecond) / .3);
  text('+1 PROCESSOR, FOR FREE', W / 2, 40, { size: 11, font: 'head', weight: 900, col: C.cyan, alpha: b });
}});

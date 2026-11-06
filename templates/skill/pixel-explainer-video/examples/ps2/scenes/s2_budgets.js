// 0:32 - 1:18  Two budgets: time (16.7 ms) and space (32 MB); 4.7 GB disc vs 32 MB; "they hid them".
import { THREE, C, shot, cue, ease, easeOut, easeIn, seg, pop, clamp, lerp, V, text, stat, tag, rect, line, frame, project, facet, flat, box, rng, W, H, fmt, card } from '../engine.js';
import { memory, disc, gridFloor, orbit, panel, pixelQuad, mountain, terrain } from '../models.js';

// ---- 2a: TIME: a CRT draws its picture line by line while a 16.7 ms ring clock fills; frames stream out as a film strip ----
function tvPicture(x, w, h, rows, n) {                 // the frame being "built": a little game scene, drawn up to `rows`
  x.fillStyle = C.bg; x.fillRect(0, 0, w, h);
  for (let y = 0; y < Math.min(rows, h); y++) {
    const col = y < h * .45 ? (y < h * .2 ? C.navy : C.blue) : y < h * .62 ? C.sky : C.green;
    x.fillStyle = col; x.fillRect(0, y, w, 1);
    const hx = (n * 7) % 40;
    if (y > h * .35 && y < h * .62 && Math.sin((y * 3 + hx) * .2) > .2) { x.fillStyle = C.teal; x.fillRect(4 + (y * 5) % 30, y, 10, 1); }
    if (y > h * .5 && y < h * .78) { x.fillStyle = C.red; x.fillRect(w * .45 + Math.sin(n) * 6, y, 5, 1); }
    if (y > h * .44 && y < h * .5) { x.fillStyle = C.sand ?? C.orange; x.fillRect(w * .45 + Math.sin(n) * 6, y, 5, 1); }
    if (y === Math.floor(h * .18)) { x.fillStyle = C.yellow; x.fillRect(w * .78, y - 2, 4, 4); }
  }
  if (rows < h) { x.fillStyle = C.white; x.fillRect(0, rows, w, 1); }       // the scanline being drawn
}
shot({ t0: cue('Every game on this console', 32.2) - .1, build(S) {
  const st = { strip: [] };
  S.scene.add(gridFloor(80, 1, C.navy));
  const tv = new THREE.Group();
  tv.add(box(3.2, 2.5, 2.2, 'black', [0, 1.45, 0]), box(3.35, .18, 2.3, 'grey', [0, .15, 0]));
  tv.add(box(.5, .3, .05, 'grey', [1.1, .5, 1.12]), box(.12, .12, .05, 'lime', [1.35, .5, 1.13]));
  st.scr = pixelQuad(2.6, 1.8, () => {}, 64, 44); st.scr.position.set(-.1, 1.6, 1.11); tv.add(st.scr);
  st.scr.material.alphaTest = 0; st.scr.material.transparent = false;
  tv.position.set(-.6, 0, 0); S.scene.add(tv); st.tv = tv;
  // 60-segment ring clock
  st.ring = [];
  for (let i = 0; i < 60; i++) { const a = Math.PI / 2 - i / 60 * Math.PI * 2; const b = box(.18, .3, .12, 'navy', [3.1 + Math.cos(a) * 1.25, 1.6 + Math.sin(a) * 1.25, 0]);
    b.rotation.z = a; S.scene.add(b); st.ring.push(b); }
  // film strip of finished frames
  for (let i = 0; i < 8; i++) { const f = new THREE.Group(); f.add(box(1.1, .8, .06, 'black', [0, 0, 0]));
    const pic = pixelQuad(.95, .66, () => {}, 32, 22); pic.position.z = .04; pic.material.alphaTest = 0; f.add(pic); f.pic = pic; f.n = -1;
    S.scene.add(f); st.strip.push(f); }
  st.tTwo = cue('two budgets', 34); st.tTime = cue('time', 35.8); st.t60 = cue('60 frames', 37); st.tMs = cue('16.7', 38.9); st.tEvery = cue('every frame', 41);
  st.hits = [];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0, period = 1.1;
  const run = t > st.t60, ph = run ? ((t - st.t60) / period) % 1 : (t > st.tTime ? 0 : 1), n = run ? Math.floor((t - st.t60) / period) : 0;
  st.scr.userData.redraw((x, w, h) => tvPicture(x, w, h, Math.floor(ph * h), n));
  st.ring.forEach((b, i) => b.material = facet(i / 60 < ph ? (ph > .92 ? 'orange' : 'yellow') : 'navy'));
  st.strip.forEach((f, i) => {
    const k = i + (run ? ph : 0);
    f.position.set(-3.2 - k * 1.25, 1.3 - k * .05, -.6 - k * .35); f.rotation.y = .35;
    f.visible = run && n - i - 1 >= 0;
    if (f.visible && f.n !== n - i - 1) { f.n = n - i - 1; f.pic.userData.redraw((x, w, h) => tvPicture(x, w, h, h, f.n)); }
  });
  orbit(S.cam, V(.4, 1.5, 0), lerp(10.5, 8.2, ease((t - st.tTime) / 2)), -.28 + lt * .012, 1.4);
}, draw(st, t, S) {
  const a = ease((t - S.t0 - .2) / .4) * (1 - ease((t - st.tTime) / .4));
  text('EVERY GAME LIVES INSIDE', W / 2, 30, { size: 7, col: C.silver, alpha: a });
  text('TWO BUDGETS', W / 2, 44, { size: 16, font: 'head', weight: 900, alpha: a * ease((t - st.tTwo) / .3) });
  const b = ease((t - st.tTime) / .4);
  text('BUDGET 1', 18, 30, { size: 6.5, col: C.yellow, align: 'left', alpha: b });
  text('TIME', 18, 43, { size: 16, font: 'head', weight: 900, align: 'left', alpha: b });
  const c = ease((t - st.t60) / .4);
  text('60 FRAMES / SECOND', W - 18, 30, { size: 7, font: 'head', align: 'right', alpha: c });
  text('shown ~66x slower', W - 18, 40, { size: 5.5, col: C.slate, align: 'right', alpha: c });
  const d = ease((t - st.tMs) / .4);
  if (d > 0) {
    const ph = ((t - st.t60) / 1.1) % 1;
    const [x, y] = project(V(3.1, 1.6, 0), S.cam);
    text((16.7 * ph).toFixed(1), x, y - 2, { size: 11, font: 'head', weight: 900, alpha: d, noKinetic: true, col: ph > .92 ? C.orange : C.white });
    text('ms', x, y + 8, { size: 6, col: C.yellow, alpha: d });
    text('the whole picture has to be ready in 16.7 ms', W / 2, 160, { size: 7, col: C.silver, alpha: d });
  }
  const [fx, fy] = project(V(-5.5, 2.2, -1.2), S.cam);
  text('finished frames', fx, fy - 6, { size: 6, col: C.silver, alpha: ease((t - st.t60 - 1.2) / .4) });
}});

// ---- 2b: SPACE: everything in the frame lives in 32 MB ----
shot({ t0: cue('The second one is space', 41.6) - .1, build(S) {
  const st = { mem: memory(8, 4, .42, .08, 'navy') };
  S.scene.add(st.mem, gridFloor(80, 1, C.navy));
  st.mem.position.set(0, .4, 0);
  st.tSpace = cue('space', 42.5); st.tSee = cue('see', 43.9); st.tHear = cue('hear', 44.4); st.tTouch = cue('touch', 44.9);
  st.t32 = cue('32 megabytes', 47);
  st.hits = [st.tSpace, st.t32];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(1.3, 1.0, 0), 5.6, .2 + (t - S.t0) * .03, .9);
  const groups = [[st.tSee, 'sky', [0, 1, 2, 3, 8, 9, 10, 11, 16, 17]], [st.tHear, 'orange', [4, 5, 12, 13]], [st.tTouch, 'lime', [6, 7, 14, 15, 22]]];
  st.mem.cells.forEach((c, i) => c.material = facet('navy'));
  for (const [tc, r, idx] of groups) idx.forEach((i, k) => { if (t > tc + k * .05) st.mem.cells[i].material = facet(r); });
  st.mem.cells.forEach((c, i) => c.position.z = Math.max(0, .2 - (t - (i < 24 ? st.tSee : 99)) * .5) * 0);
}, draw(st, t, S) {
  const a = ease((t - st.tSpace) / .4);
  text('BUDGET 2', 18, 30, { size: 6.5, col: C.yellow, align: 'left', alpha: a });
  text('SPACE', 18, 43, { size: 16, font: 'head', weight: 900, align: 'left', alpha: a });
  const L = [[st.tSee, 'SEE', 'models, textures', C.sky], [st.tHear, 'HEAR', 'sounds, music', C.orange], [st.tTouch, 'TOUCH', 'collision, physics', C.lime]];
  L.forEach(([tc, h, s, col], i) => {
    const b = ease((t - tc) / .3);
    rect(W - 96, 28 + i * 16, 5, 5, col, b);
    text(h, W - 87, 30.5 + i * 16, { size: 7, font: 'head', align: 'left', alpha: b });
    text(s, W - 87, 37 + i * 16, { size: 5.5, col: C.silver, align: 'left', alpha: b });
  });
  const c = ease((t - st.t32) / .4);
  stat(W / 2, 132, '32', 'MB', { alpha: c, size: 18, label: 'all of it, right now' });
}});

// ---- 2c: the disc holds 4.7 GB, ~150x the memory ----
shot({ t0: cue('Compare that', 48.4) - .1, build(S) {
  const st = { disc: disc(2.4), cube: box(.3, .3, .3, 'cyan', [0, 0, 0]), wall: new THREE.Group() };
  S.scene.add(st.disc, st.cube, st.wall, gridFloor(80, 1, C.navy));
  st.disc.position.set(-2.2, 1.6, 0); st.disc.rotation.x = Math.PI / 2 - .25;
  st.cube.position.set(2.4, .15, 1.2);
  const M = new THREE.Matrix4();
  st.im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), facet('navy'), 150);
  for (let i = 0; i < 150; i++) st.im.setMatrixAt(i, M.makeScale(.26, .26, .26).setPosition(1.2 + (i % 15) * .3, .15 + Math.floor(i / 15) * .3, -.4));
  st.im.count = 0; st.wall.add(st.im);
  st.tDisc = cue('The disc', 50.8); st.tGB = cue('4.7 gigabytes', 53.3); st.t150 = cue('150 times', 55.6); st.tOnce = cue('at once', 57.6);
  st.hits = [st.tGB, st.t150];
  return st;
}, update(st, t, S) {
  st.disc.rotation.y = t * 2.5;
  orbit(S.cam, V(.6, 1.5, 0), lerp(9.5, 10.5, ease((t - st.t150) / 2)), -.15, 1.6);
  st.im.count = Math.round(150 * easeOut((t - st.t150) / 1.6));
  st.cube.visible = t > st.tGB;
}, draw(st, t, S) {
  const a = ease((t - st.tDisc) / .4);
  const [dx, dy] = project(st.disc.position.clone().add(V(0, 2.8, 0)), S.cam);
  stat(dx, dy, '4.7', 'GB', { alpha: ease((t - st.tGB) / .4), size: 18, label: 'ONE DVD' });
  card('ps2_console', W - 18, 28, 100, t, { t0: S.t0 + .2, t1: st.t150, align: 'right', label: 'PLAYSTATION 2', sub: 'with a built-in DVD drive' });
  text('THE DISC', dx, dy - 16, { size: 6.5, col: C.silver, alpha: a });
  const [cx, cy] = project(st.cube.position.clone().add(V(0, .3, 0)), S.cam);
  tag(S.cam, st.cube.position.clone().add(V(0, .2, 0)), '32 MB', { alpha: ease((t - st.tGB - .3) / .3), dy: -10, dx: 16, col: C.cyan, sub: 'memory' });
  const b = ease((t - st.t150) / .4);
  if (b > 0) stat(W - 30, 30, '~' + Math.max(1, Math.round(150 * easeOut((t - st.t150) / 1.6))) + 'x', '', { alpha: b, size: 18, align: 'right', label: 'more than memory holds' });
}});

// ---- 2d: how big a game can be vs how much can exist right now ----
shot({ t0: cue('One of these numbers', 58.4) - .1, build(S) {
  const st = { wall: new THREE.Group(), mem: box(.5, .5, .5, 'cyan', [0, 0, 0]), pulses: [] };
  const M = new THREE.Matrix4();
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), facet('navy'), 150);
  for (let i = 0; i < 150; i++) im.setMatrixAt(i, M.makeScale(.22, .22, .22).setPosition((i % 15) * .26 - 1.8, .12 + Math.floor(i / 15) * .26, 0));
  st.wall.add(im); st.wall.position.set(-2.4, 0, 0); st.im = im;
  st.mem.position.set(2.8, .9, 0);
  S.scene.add(st.wall, st.mem, gridFloor(80, 1, C.navy));
  const pm = facet('yellow');
  for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), pm); S.scene.add(p); st.pulses.push(p); }
  st.tBig = cue('how big', 59.5); st.tExist = cue('exist', 62); st.t100 = cue('100 times apart', 65); st.tWork = cue('work together', 67.2); st.tFrame = cue('on every frame', 68.5);
  st.hits = [st.t100];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(.2, 1.1, 0), 8.2, -.08 + (t - S.t0) * .015, 1.4);
  st.mem.rotation.y = t * .6;
  const flow = ease((t - st.tWork) / .5);
  st.pulses.forEach((p, i) => {
    const k = ((t * .9 + i / st.pulses.length) % 1);
    const from = V(-.3, .3 + (i % 9) * .25, 0), to = V(2.8, .9, 0);
    p.position.lerpVectors(from, to, k); p.position.y += Math.sin(k * Math.PI) * .6; p.visible = flow > 0 && i / st.pulses.length < flow;
  });
}, draw(st, t, S) {
  const a = ease((t - st.tBig) / .4), b = ease((t - st.tExist) / .4);
  const [lx] = project(V(-2.4, 0, 0), S.cam), [rx] = project(V(2.8, 0, 0), S.cam);
  text('HOW BIG A GAME CAN BE', lx, 30, { size: 6.5, col: C.silver, alpha: a });
  stat(lx, 46, '4.7', 'GB', { size: 14, alpha: a });
  text('WHAT CAN EXIST RIGHT NOW', rx, 30, { size: 6.5, col: C.silver, alpha: b });
  stat(rx, 46, '32', 'MB', { size: 14, alpha: b, unitCol: C.cyan });
  const c = ease((t - st.t100) / .4) * (1 - ease((t - st.tWork) / .4));
  text('> 100x APART', W / 2, 60, { size: 9, font: 'head', col: C.orange, alpha: c });
  const d = ease((t - st.tFrame) / .3);
  if (d > 0) text('frame ' + String(Math.floor((t - st.tFrame) * 60) + 1).padStart(4, '0'), W / 2, 60, { size: 7, col: C.yellow, alpha: d });
}});

// ---- 2e: into the gap: they didn't break the limits, they hid them ----
shot({ t0: cue('So before we look', 69.5) - .1, build(S) {
  S.bg = C.bg; S.fogNear = 8; S.fogFar = 26;
  const st = {};
  st.wall = new THREE.Group();
  const M = new THREE.Matrix4(), im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), facet('plum'), 16 * 9);
  for (let i = 0; i < 144; i++) im.setMatrixAt(i, M.makeScale(.9, .9, .2).setPosition((i % 16) - 7.5, Math.floor(i / 16) + .5, 0));
  st.wall.add(im); st.wall.position.z = -6; S.scene.add(st.wall);
  // painted backdrop that slides in front of the wall
  st.paint = pixelQuad(16, 9, (x, w, h) => {
    const g = [[C.navy, 0], [C.blue, .35], [C.sky, .55], [C.orange, .68], [C.yellow, .72]];
    for (let y = 0; y < h; y++) { let col = C.navy; for (const [c, s] of g) if (y / h >= s) col = c; x.fillStyle = col; x.fillRect(0, y, w, 1); }
    x.fillStyle = C.yellow; x.beginPath(); x.arc(w * .7, h * .7, 5, 0, 7); x.fill();
    x.fillStyle = C.teal; for (let i = 0; i < w; i++) { const hh = 8 + Math.sin(i * .3) * 3 + Math.sin(i * .11) * 4; x.fillRect(i, h - hh, 1, hh); }
    x.fillStyle = C.green; for (let i = 0; i < w; i++) { const hh = 4 + Math.sin(i * .5 + 1) * 2; x.fillRect(i, h - hh, 1, hh); }
  }, 96, 54);
  st.paint.position.set(0, 4.5, -5.6); S.scene.add(st.paint);
  S.scene.add(gridFloor(80, 1, C.navy));
  st.tGap = cue('into that gap', 71.5); st.tBest = cue('best PS2 games', 74.8); st.tLimits = cue("hardware's limits", 76.5); st.tHid = cue('They hid them', 77.5);
  st.hits = [st.tHid];
  return st;
}, update(st, t, S) {
  const k = ease((t - st.tGap) / 4);
  S.cam.position.set(0, 3.2 + k * 1.2, lerp(16, 9.5, k)); S.cam.lookAt(0, 4.4, -6);
  st.paint.position.x = lerp(-17, 0, easeOut((t - st.tHid) / .7)); st.paint.visible = t > st.tHid;
}, draw(st, t, S) {
  const a = ease((t - st.tLimits) / .4) * (1 - ease((t - st.tHid) / .3));
  text("DIDN'T BREAK THE LIMITS", W / 2, 40, { size: 11, font: 'head', weight: 900, col: C.red, alpha: a });
  const b = ease((t - st.tHid - .2) / .4);
  text('THEY HID THEM', W / 2, 40, { size: 14, font: 'head', weight: 900, col: C.yellow, alpha: b });
}});

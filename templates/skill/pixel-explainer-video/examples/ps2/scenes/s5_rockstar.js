// 3:30 - 5:30  Rockstar and the disc: streaming sectors, disc layout, tuning the game to the drive,
// 8 car types, San Andreas.
import { THREE, C, shot, cue, ease, easeOut, easeIn, seg, pop, clamp, lerp, V, text, stat, tag, rect, line, frame, project, facet, flat, box, rng, W, H, fmt, hud, card as E_card } from '../engine.js';
import { disc, memory, city, car, building, tree, lamppost, plane, gridFloor, orbit, ground, terrain, mountain, ghostBox, scatter } from '../models.js';

const CH = ['01', 'THE DISC  ·  ROCKSTAR'];

// ---- 5a: a city standing on a disc; the people behind the streaming ----
shot({ t0: cue("Let's start with the disc", 210.5) - .1, chapter: CH, chapterFirst: true, build(S) {
  const st = { d: disc(5), c: city(5, 5, { lot: 1.2, seed: 3, hMin: .3, hMax: 1.6 }), mem: memory(8, 4, .22, .04, 'navy'), bits: [] };
  st.d.position.y = .03; S.scene.add(st.d, gridFloor(80, 1, C.navy));
  st.c.position.y = .06; st.d.add(st.c); st.c.lots.forEach(L => L.ghost.visible = false);
  st.mem.position.set(0, 4.2, -3); S.scene.add(st.mem);
  for (let i = 0; i < 12; i++) { const b = box(.12, .12, .12, 'yellow'); S.scene.add(b); st.bits.push(b); }
  st.tDMA = cue('DMA Design', 212); st.tRock = cue('Rockstar North', 213.9); st.tObbe = cue('Obbe Vermeij', 217.9);
  st.tQuote = cue('no way', 219.2); st.tStream = cue('Streaming models', 222.3); st.tHard = cue('hardest technical', 225.2); st.tAdam = cue('Adam Fowler', 228.6);
  st.hits = [st.tRock, st.tHard];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  st.d.rotation.y = lt * .12;
  orbit(S.cam, V(0, 1.4, -.5), 11.5, .2 + lt * .02, 5.2);
  const f = ease((t - st.tStream) / .5);
  st.bits.forEach((b, i) => { const k = (t * .7 + i / 12) % 1; b.position.set(Math.sin(i * 2.1) * 2 * (1 - k), .3 + k * 3.9, -3 * k + Math.cos(i * 1.7) * 2 * (1 - k)); b.visible = f > 0; });
  st.mem.cells.forEach((c, i) => c.material = facet(f > 0 && ((i * 5 + Math.floor(t * 5)) % 7) < 3 ? 'yellow' : 'navy'));
}, draw(st, t, S) {
  const card = (tc, t1, y, h, s, col = C.white) => { const a = ease((t - tc) / .3) * (1 - ease((t - t1) / .3));
    text(h, W - 18, y, { size: 8.5, font: 'head', align: 'right', col, alpha: a }); if (s) text(s, W - 18, y + 10, { size: 6.5, col: C.silver, align: 'right', alpha: a }); };
  E_card('logo_dma', 18, 30, 34, t, { t0: st.tDMA, t1: st.tObbe, bg: C.white });
  E_card('logo_rockstar_north', 60, 30, 34, t, { t0: st.tRock, t1: st.tObbe, bg: C.white });
  E_card('dma_team', 18, 84, 112, t, { t0: st.tDMA + .6, t1: st.tObbe, label: "DMA DESIGN'S ORIGINAL TEAM", sub: '2011 · photo: Steve Hammond, CC BY-SA 2.0' });
  E_card('gta3_driveby', 18, 96, 100, t, { t0: st.tStream + .3, label: 'GRAND THEFT AUTO III · PS2' });
  card(st.tDMA, st.tObbe, 34, 'DMA DESIGN', '');
  card(st.tRock, st.tObbe, 46, '→ ROCKSTAR NORTH', '', C.yellow);
  card(st.tObbe, st.tStream, 34, 'OBBE VERMEIJ', 'technical director, GTA III');
  const q = ease((t - st.tQuote) / .3) * (1 - ease((t - st.tStream) / .3));
  if (q > 0) { rect(18, 60, 150, 26, C.bg, .8 * q); rect(18, 60, 2, 26, C.yellow, q);
    text('"no way the whole map would fit', 25, 68, { size: 6.5, align: 'left', alpha: q, outline: false });
    text("in the PS2's memory\"", 25, 78, { size: 6.5, align: 'left', alpha: q, outline: false }); }
  card(st.tStream, st.tAdam, 34, 'STREAMING FROM THE DVD', '');
  card(st.tHard, st.tAdam, 46, 'hardest technical challenge', '', C.orange);
  card(st.tAdam, 999, 34, 'ADAM FOWLER', 'wrote the streaming code');
}});

// ---- 5b: sectors: full detail near, cheap stand-ins further out, skylines for other islands ----
shot({ t0: cue('The city was cut into sectors', 229.9) - .1, chapter: CH, build(S) {
  S.fogNear = 40; S.fogFar = 90;
  const st = { sec: [], car: car('yellow', 1.2) };
  const N = 7, L = 3;
  S.scene.add(box(60, .05, 60, [C.navy, C.navy, C.navy], [0, -.1, 0]));
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = (i - (N - 1) / 2) * L, z = (j - (N - 1) / 2) * L, r = rng(i * 13 + j * 7 + 1);
    const tile = box(L - .12, .06, L - .12, 'black', [x, 0, z]);
    const full = new THREE.Group();
    for (let k = 0; k < 3; k++) { const b = building(.6 + r() * .3, .7 + r() * 1.6, .6 + r() * .3, ['grey', 'white', 'teal', 'red', 'blue'][Math.floor(r() * 5)], i * 50 + j * 5 + k);
      b.position.set(x - .7 + (k % 2) * 1.3, 0, z - .7 + (k > 1 ? 1.3 : 0)); full.add(b); }
    const shell = box(L * .5, .25 + r() * .5, L * .5, [C.dark, C.dark, C.slate], [x, 0, z]); shell.position.y = shell.scale.y / 2;
    S.scene.add(tile, full, shell);
    st.sec.push({ x, z, tile, full, shell, state: -1, changed: -9 });
  }
  // other islands: flat skyline cut-outs
  st.sky = new THREE.Group();
  const r = rng(77);
  for (let i = 0; i < 16; i++) { const h = .6 + r() * 2.2; const b = box(.9, h, .05, [C.slate, C.slate, C.silver], [-10 + i * 1.3, h / 2, -19]); st.sky.add(b); }
  for (let i = 0; i < 12; i++) { const h = .6 + r() * 1.8; const b = box(.05, h, .9, [C.slate, C.slate, C.silver], [19, h / 2, -8 + i * 1.3]); st.sky.add(b); }
  S.scene.add(st.sky, st.car);
  st.tFull = cue('loaded in full detail', 233); st.tStand = cue('cheap stand-ins', 236); st.tIslands = cue('The other islands', 239.5);
  st.tDrove = cue('As the player drove', 241.4); st.tOut = cue('threw out', 243.3); st.tIn = cue('read in', 245);
  st.hits = [st.tOut, st.tIn];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  // car path: loops around the grid streets
  const u = Math.max(0, t - st.tDrove) * .9 + 0;
  const px = -4.5 + Math.sin(u * .35) * 6, pz = 4.5 - u * 1.1 + Math.max(0, u - 8) * 1.1;
  st.car.position.set(px, .05, pz); st.car.rotation.y = Math.PI / 2 + Math.cos(u * .35) * .4;
  st.sec.forEach(s => {
    const d = Math.max(Math.abs(s.x - px), Math.abs(s.z - pz));
    const want = t < st.tFull ? 1 : d < 3.2 ? 2 : (t < st.tStand ? 0 : 1);        // 2 full, 1 shell, 0 nothing
    if (want !== s.state) { if (s.state !== -1) s.changed = t; s.prev = s.state; s.state = want; }
    s.full.visible = s.state === 2; s.shell.visible = s.state === 1;
    const flash = t - s.changed < .35 && t > st.tDrove;
    s.tile.material = facet(flash ? (s.state === 2 ? 'cyan' : 'red') : s.state === 2 ? [C.navy, C.blue, C.blue] : 'black');
  });
  st.sky.visible = t > st.tIslands;
  const far = ease((t - st.tIslands) / 1.2) * (1 - ease((t - st.tDrove) / 1.2));
  orbit(S.cam, V(px * .4, 0, pz * .3 - 2), 19 + far * 8, .45 + lt * .01, 19 + far * 4);
}, draw(st, t, S) {
  const a = ease((t - S.t0 - .3) / .3);
  text('THE CITY, CUT INTO SECTORS', 18, 34, { size: 8, font: 'head', align: 'left', alpha: a });
  const L = [[st.tFull, C.sky, 'near: full detail'], [st.tStand, C.slate, 'further: low-poly shells'], [st.tIslands, C.silver, 'other islands: flat skylines']];
  L.forEach(([tc, col, s], i) => { const b = ease((t - tc) / .3); rect(18, 44 + i * 10, 5, 5, col, b); text(s, 27, 46.5 + i * 10, { size: 6.5, align: 'left', alpha: b }); });
  const o = ease((t - st.tOut) / .3); rect(18, 78, 5, 5, C.red, o); text('thrown out', 27, 80.5, { size: 6.5, align: 'left', alpha: o, col: C.red });
  const n = ease((t - st.tIn) / .3); rect(18, 88, 5, 5, C.cyan, n); text('read in', 27, 90.5, { size: 6.5, align: 'left', alpha: n, col: C.cyan });
}});

// ---- 5c: where things sit on the disc ----
shot({ t0: cue('But reading is only half', 246.4) - .1, chapter: CH, build(S) {
  const st = { d: disc(4.2), N: 90 };
  S.scene.add(st.d);
  const M = new THREE.Matrix4(), r = rng(8);
  st.home = []; st.rand = []; st.col = [];
  const cols = ['orange', 'sky', 'lime'];
  for (let i = 0; i < st.N; i++) {
    const district = Math.floor(i / 30);
    st.col.push(district);
    const a = district * 2.09 + (i % 30) / 30 * 1.9, rad = 1.9 + ((i * 7) % 5) * .42;       // sorted: districts in contiguous wedges
    st.home.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    const ra = r() * 6.28, rr = 1.8 + r() * 2.1; st.rand.push([Math.cos(ra) * rr, Math.sin(ra) * rr]);
  }
  st.ims = cols.map(c => { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), facet(c), 30); S.scene.add(im); return im; });
  // duplicated common models (white), spread around the disc
  st.dup = []; for (let i = 0; i < 9; i++) { const a = i * .7 + .3, rr = 2.2 + (i % 3) * .7; const m = box(.3, .12, .3, 'white', [Math.cos(a) * rr, .12, Math.sin(a) * rr]); m.visible = false; S.scene.add(m); st.dup.push(m); }
  st.laser = box(.3, .25, .3, 'red', [0, .25, 0]); st.beam = box(.05, 1.5, .05, 'yellow', [0, .9, 0]); S.scene.add(st.laser, st.beam);
  st.arm = box(4.4, .05, .08, 'grey', [2.2, .2, 0]); S.scene.add(st.arm);
  st.tWhere = cue('where things sit', 249); st.tJump = cue('every jump', 251.1); st.tArr = cue('Rockstar arranged', 253.2); st.tClose = cue('close together on the disc', 257.3);
  st.tModels = cue('models used everywhere', 259.5); st.tCopies = cue('put copies', 264.5); st.tNear = cue('whichever one was nearest', 267.5);
  st.hits = [st.tArr];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  orbit(S.cam, V(0, 0, .4), 9.2, .0, 7.6);
  st.d.rotation.y = lt * .25;
  const k = easeOut((t - st.tArr - .6) / 2.4), M = new THREE.Matrix4(), cnt = [0, 0, 0];
  for (let i = 0; i < st.N; i++) {
    const [hx, hz] = st.home[i], [rx, rz] = st.rand[i];
    const x = lerp(rx, hx, k), z = lerp(rz, hz, k), c = st.col[i];
    const p = V(x, .08, z).applyAxisAngle(V(0, 1, 0), lt * .25);
    st.ims[c].setMatrixAt(cnt[c]++, M.makeScale(.28, .1, .28).setPosition(p.x, .08, p.z));
  }
  st.ims.forEach(im => im.instanceMatrix.needsUpdate = true);
  // laser seeks: long jumps before sorting, short hops after
  const jumps = t < st.tArr + 1 ? [3.9, 1.6, 3.2, 2.0, 3.7] : [2.4, 2.7, 2.5, 2.9, 2.6];
  const c = (lt * .9) % jumps.length, i = Math.floor(c), f = c - i;
  let rad = lerp(jumps[i], jumps[(i + 1) % jumps.length], easeOut(f / .4));
  const showDup = t > st.tCopies;
  st.dup.forEach((m, j) => { m.visible = t > st.tCopies + j * .1; const p = V(Math.cos(j * .7 + .3) * (2.2 + (j % 3) * .7), .12, Math.sin(j * .7 + .3) * (2.2 + (j % 3) * .7)).applyAxisAngle(V(0, 1, 0), lt * .25); m.position.copy(p); });
  if (t > st.tNear) {  // grab the nearest duplicate: laser only makes a tiny move
    let best = 1e9, br = rad; st.dup.forEach(m => { const d = Math.abs(Math.hypot(m.position.x, m.position.z) - rad); if (d < best) { best = d; br = Math.hypot(m.position.x, m.position.z); } });
    rad = br; st.dup.forEach(m => m.material = facet(Math.abs(Math.hypot(m.position.x, m.position.z) - rad) < .05 ? 'yellow' : 'white'));
  }
  st.laser.position.set(rad, .25, 0); st.beam.position.set(rad, .9, 0);
  st.beam.visible = f > .4;
  st.jumpDist = Math.abs(jumps[(i + 1) % jumps.length] - jumps[i]);
}, draw(st, t, S) {
  const a = ease((t - st.tWhere) / .3);
  text('WHERE FILES SIT ON THE DISC', 18, 32, { size: 8, font: 'head', align: 'left', alpha: a });
  const cols = [[C.orange, 'Portland'], [C.sky, 'Staunton Island'], [C.lime, 'Shoreside Vale']];
  cols.forEach(([c, n], i) => { rect(18, 42 + i * 9, 5, 5, c, a); text(n, 27, 44.5 + i * 9, { size: 6.5, align: 'left', alpha: a }); });
  const b = ease((t - st.tJump) / .3) * (1 - ease((t - st.tArr) / .3));
  text('every jump of the laser = time', W - 18, 32, { size: 7, col: C.red, align: 'right', alpha: b });
  const c = ease((t - st.tArr) / .3) * (1 - ease((t - st.tModels) / .3));
  text('close in the city = close on the disc', W - 18, 32, { size: 7, col: C.lime, align: 'right', alpha: c });
  const d = ease((t - st.tModels) / .3);
  text('trees · lampposts · common buildings', W - 18, 32, { size: 7, col: C.white, align: 'right', alpha: d });
  text(t > st.tNear ? 'grab the nearest copy' : t > st.tCopies ? 'copied all over the disc' : '', W - 18, 42, { size: 7, col: C.yellow, align: 'right', alpha: ease((t - st.tCopies) / .3) });
}});

// ---- 5d: tune the game to the speed of the drive ----
shot({ t0: cue('And then they tuned', 269.2) - .1, chapter: CH, build(S) {
  S.fogNear = 18; S.fogFar = 45;
  const st = { car: car('red', 1.6), c: city(2, 14, { lot: 2.6, seed: 41 }) };
  st.c.lots.forEach(L => { L.ghost.visible = false; L.solid.position.x += Math.sign(L.x) * 1.2; });
  S.scene.add(st.c, st.car, ground(40, 60, 'black'), box(3.2, .02, 60, [C.dark, C.dark, C.dark], [0, .0, 0]));
  for (let i = 0; i < 20; i++) S.scene.add(box(.1, .03, .6, 'yellow', [0, .02, -28 + i * 3]));
  st.tDrive = cue('speed of the drive', 271.3); st.tLimit = cue('hard speed limits', 273); st.tAir = cue('air resistance', 275.2); st.tFeel = cue('not enough for anyone', 278); st.tCatch = cue('time to catch up', 280.5);
  st.hits = [st.tLimit, st.tAir];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  const z = 20 - lt * 3.6;
  st.car.position.set(.6, 0, z); st.car.rotation.y = Math.PI / 2;
  S.cam.position.set(.3, 3.4, z + 7); S.cam.lookAt(.4, .3, z - 3);
}, draw(st, t, S) {
  // speedometer
  const a = ease((t - st.tLimit) / .3);
  if (a > 0) {
    const cx = W - 48, cy = 58, R = 26;
    hudArc(cx, cy, R, C.dark, 1, 3, a);
    const cap = .78, sp = Math.min(cap, .3 + (t - st.tLimit) * .25) - (t > st.tAir ? .04 : 0);
    hudArc(cx, cy, R, C.yellow, sp, 3, a);
    const ang = Math.PI * .75 + cap * Math.PI * 1.5;
    line(cx + Math.cos(ang) * (R - 5), cy + Math.sin(ang) * (R - 5), cx + Math.cos(ang) * (R + 5), cy + Math.sin(ang) * (R + 5), C.red, a, 1.4);
    text(Math.round(sp * 160) + '', cx, cy, { size: 11, font: 'head', alpha: a });
    text('HARD SPEED LIMIT', cx, cy + 18, { size: 6, col: C.red, alpha: a });
  }
  const b = ease((t - st.tAir) / .3);
  if (b > 0) {
    text('AIR RESISTANCE  +3%', 18, 36, { size: 8, font: 'head', col: C.cyan, align: 'left', alpha: b });
    for (let i = 0; i < 5; i++) { const x = 30 + ((t * 60 + i * 37) % 120), y = 50 + i * 8; line(x, y, x + 14, y, C.cyan, b * .7, .8); }
    text('too small to feel', 18, 95, { size: 6.5, col: C.silver, align: 'left', alpha: ease((t - st.tFeel) / .3) });
    text('...enough for the disc to catch up', 18, 104, { size: 6.5, col: C.yellow, align: 'left', alpha: ease((t - st.tCatch) / .3) });
  }
}});
function hudArc(cx, cy, R, col, frac, lw, alpha) {
  hud.globalAlpha = alpha; hud.strokeStyle = col; hud.lineWidth = lw; hud.beginPath();
  hud.arc(cx, cy, R, Math.PI * .75, Math.PI * .75 + frac * Math.PI * 1.5); hud.stroke(); hud.globalAlpha = 1;
}

// ---- 5d2: Portland: a building in the middle of the road ----
shot({ t0: cue('In Portland', 281.4) - .1, chapter: CH, build(S) {
  S.fogNear = 25; S.fogFar = 60;
  const st = { car: car('yellow', 1.4), block: building(2.6, 2.2, 2.2, 'sand', 3, .6) };
  S.scene.add(ground(40, 60, 'black'), box(3.4, .02, 60, [C.dark, C.dark, C.dark], [0, 0, 0]), st.block, st.car);
  st.block.position.set(0, 0, -4);
  const c = city(2, 12, { lot: 2.8, seed: 9 }); c.lots.forEach(L => { L.ghost.visible = false; L.solid.position.x += Math.sign(L.x) * 1.3; }); S.scene.add(c);
  st.tIsland = cue('first island', 282.4); st.tMiddle = cue('middle of a long road', 284); st.tSpeed = cue('full speed', 286.5);
  st.hits = [st.tMiddle];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  const z = 12 - lt * 3.2;
  const dz = z - (-4), swerve = Math.exp(-dz * dz / 9) * 2.1;
  st.car.position.set(.7 + swerve, 0, z); st.car.rotation.y = Math.PI / 2 - Math.sign(dz) * Math.exp(-dz * dz / 9) * .6;
  orbit(S.cam, V(0, 0, -1), 12, .35, 9);
}, draw(st, t, S) {
  const a = ease((t - st.tIsland) / .3);
  text('PORTLAND', 18, 34, { size: 10, font: 'head', align: 'left', alpha: a });
  tag(S.cam, st.block.position.clone().add(V(0, 2.8, 0)), 'building in the middle of the road', { alpha: ease((t - st.tMiddle) / .3), dy: -14, col: C.orange });
  text('no long straight = no full speed', W - 18, 34, { size: 7, col: C.yellow, align: 'right', alpha: ease((t - st.tSpeed) / .3) });
}});

// ---- 5d3: the plane with clipped wings ----
shot({ t0: cue('The one plane', 287.8) - .1, chapter: CH, build(S) {
  S.bg = C.navy; S.sky = [C.navy, C.sky]; S.fogNear = 20; S.fogFar = 50;
  const st = { p: plane(2) };
  S.scene.add(st.p, box(80, .1, 6, [C.dark, C.dark, C.dark], [0, -.05, 0]), ground(80, 60, [C.bg, C.bg, C.dark]));
  for (let i = 0; i < 16; i++) S.scene.add(box(1, .03, .12, 'white', [-40 + i * 5, .02, 0]));
  st.tWings = cue('clipped wings', 289.2); st.tGround = cue('barely gets off', 290.3);
  st.hits = [st.tWings];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0, x = -6 + lt * 3.5;
  const hop = Math.max(0, Math.sin((lt - 1.2) * 1.8)) * .35 * (lt > 1.2 ? 1 : 0);
  st.p.position.set(x, .35 + hop, 0); st.p.rotation.z = hop * .25;
  S.cam.position.set(x + 2, 1.6, 7); S.cam.lookAt(x, .7, 0);
}, draw(st, t, S) {
  tag(S.cam, st.p.position.clone().add(V(.1, .1, .7)), 'clipped wings', { alpha: ease((t - st.tWings) / .3), dy: -22, dx: 10, col: C.orange });
  text('ALTITUDE: barely any', 18, 34, { size: 8, font: 'head', align: 'left', alpha: ease((t - st.tGround) / .3) });
}});

// ---- 5e: only ~8 vehicle types in memory; steal one and the city drives it ----
shot({ t0: cue('The memory limit even decided', 291.3) - .1, chapter: CH, build(S) {
  S.fogNear = 20; S.fogFar = 50;
  const st = { cars: [], player: car('yellow', 1.3) };
  const c = city(2, 12, { lot: 2.8, seed: 19 }); c.lots.forEach(L => { L.ghost.visible = false; L.solid.position.x += Math.sign(L.x) * 1.6; }); S.scene.add(c);
  S.scene.add(ground(40, 60, 'black'), box(4.4, .02, 60, [C.dark, C.dark, C.dark], [0, 0, 0]));
  st.kinds = ['red', 'blue', 'lime', 'white', 'orange', 'plum', 'teal', 'grey'];
  for (let i = 0; i < 12; i++) { const k = st.kinds[i % 8]; const cc = car(k, 1.2, false); cc.kind = k; S.scene.add(cc); st.cars.push(cc); }
  S.scene.add(st.player);
  st.t8 = cue('eight vehicle types', 294.8); st.tLoaded = cue('already loaded', 298.9); st.tStole = cue('stole a certain car', 300.5);
  st.tWhole = cue('whole city', 302.3); st.tBudget = cue("That's the memory budget", 304.8);
  st.hits = [st.tWhole, st.tBudget];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  st.cars.forEach((c, i) => {
    const lane = i % 2 ? -1 : 1, z = ((i * 4.3 + lt * (lane > 0 ? -2.4 : 2.1)) % 40 + 40) % 40 - 20;
    c.position.set(lane * 1.0, 0, z); c.rotation.y = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
    const becomes = t > st.tWhole + i * .12;               // the whole city starts driving the stolen car
    const want = becomes ? 'yellow' : c.kind;
    if (c.cur !== want) { c.paint.forEach(m => m.material = facet(want)); c.cur = want; }
  });
  st.player.position.set(-2.8, 0, 2); st.player.rotation.y = Math.PI / 2; st.player.visible = t > st.tStole;
  orbit(S.cam, V(0, 0, 0), 12, .7 + lt * .01, 8.5);
}, draw(st, t, S) {
  const a = ease((t - st.t8) / .3);
  text('VEHICLE TYPES IN MEMORY', 18, 30, { size: 7, font: 'head', align: 'left', alpha: a });
  st.kinds.forEach((k, i) => {
    const on = t > st.t8 + i * .08, x = 18 + i * 13, y = 38;
    const col = t > st.tWhole ? C.yellow : facet(k).uniforms.c1.value.getStyle();
    rect(x, y, 10, 7, on ? col : C.dark, a); frame(x, y, 10, 7, C.slate, a);
  });
  text('~8 slots', 18 + 8 * 13 + 4, 42, { size: 6.5, col: C.silver, align: 'left', alpha: a });
  E_card('gta3_walk', W - 18, 70, 100, t, { t0: st.tLoaded, t1: st.tBudget, align: 'right', label: 'GTA III STREET TRAFFIC' });
  tag(S.cam, st.player.position.clone().add(V(0, .8, 0)), 'you steal this', { alpha: ease((t - st.tStole) / .3), dy: -14, dx: -8, col: C.yellow });
  const b = ease((t - st.tBudget) / .3);
  text("NOT A COINCIDENCE. IT'S THE MEMORY BUDGET.", W / 2, 60, { size: 7.5, font: 'head', col: C.orange, alpha: b });
}});

// ---- 5f: San Andreas: three cities, countryside in between as loading time ----
shot({ t0: cue('By San Andreas', 306) - .1, chapter: CH, build(S) {
  S.bg = C.plum; S.sky = [C.plum, C.orange]; S.fogNear = 60; S.fogFar = 120;
  const st = {};
  const hf = (x, z) => Math.sin(x * .15) * 1.1 + Math.cos(z * .2) * .9 + Math.sin(x * .41 + z * .3) * .45;
  const land = terrain(70, 40, 56, hf, [C.plum, C.red, C.orange]); S.scene.add(land);
  S.scene.add(scatter(hf, { n: 500, area: 60, seed: 8, grassRamp: [C.teal, C.green, C.green] }));
  { const r2 = rng(12); for (let i = 0; i < 26; i++) { const x = -30 + r2() * 60, z = -14 + r2() * 28; if (Math.abs(x + 24) < 5 || Math.abs(x - 22) < 5) continue;
    const c = new THREE.Group(); c.add(box(.18, .9, .18, 'green', [0, .45, 0]), box(.14, .35, .14, 'green', [.18, .55, 0]), box(.14, .3, .14, 'green', [-.16, .7, 0]));
    c.position.set(x, hf(x, z), z); S.scene.add(c); } }
  const forest = []; const r = rng(5);
  for (let i = 0; i < 40; i++) { const tr = tree(1.6, i); const x = -8 + r() * 10, z = -14 + r() * 10; tr.position.set(x, hf(x, z), z); S.scene.add(tr); }
  st.cities = [[-24, 8, 'LOS SANTOS'], [22, 8, 'SAN FIERRO'], [0, -12, 'LAS VENTURAS']].map(([x, z, n], i) => {
    const c = city(4, 4, { lot: 1.5, seed: 50 + i, hMin: .5, hMax: 2.6 }); c.position.set(x, hf(x, z), z);
    c.lots.forEach(L => L.ghost.visible = false); S.scene.add(c); return { c, x, z, n };
  });
  st.road = []; for (let i = 0; i <= 40; i++) { const k = i / 40; const x = lerp(-24, 22, k), z = 8 - Math.sin(k * Math.PI) * 14; st.road.push(V(x, hf(x, z) + .05, z)); }
  st.road.forEach((p, i) => { if (i % 2) S.scene.add(box(.8, .05, .8, 'black', [p.x, p.y, p.z])); });
  st.car = car('red', 1.8); S.scene.add(st.car);
  st.tThree = cue('three cities', 308); st.tCountry = cue('countryside', 309.8); st.tPlan = cue('The original plan', 311); st.tTrain = cue('train or plane', 316);
  st.tInstead = cue('Instead', 317.3); st.tUnload = cue('unload one city', 321); st.tOne = cue('one map', 324.3);
  st.hits = [st.tInstead, st.tOne];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  const k = clamp((t - st.tInstead) / 7.5);
  const i = Math.min(39, Math.floor(k * 40)), f = k * 40 - i;
  const p = st.road[i].clone().lerp(st.road[i + 1], f), q = st.road[i + 1];
  st.car.position.copy(p); st.car.rotation.y = Math.atan2(-(q.z - p.z), q.x - p.x);
  // load states along the drive: LS unloads as SF streams in
  st.lsLoad = 1 - clamp((k - .35) / .25); st.sfLoad = clamp((k - .5) / .3);
  st.cities[0].c.visible = t < st.tInstead || st.lsLoad > .02;
  st.cities[1].c.visible = t < st.tInstead || st.sfLoad > .02 || t > st.tOne;
  const sep = ease((t - st.tPlan) / .6) * (1 - ease((t - st.tInstead) / .6));
  st.cities.forEach((c, j) => c.c.position.y = sep * 0);
  orbit(S.cam, V(lerp(0, p.x * .4, ease((t - st.tInstead) / 1)), 0, 0), 46, .15 + lt * .006, 30);
}, draw(st, t, S) {
  const a = ease((t - st.tThree) / .3);
  text('SAN ANDREAS', 18, 30, { size: 10, font: 'head', align: 'left', alpha: a });
  text('2004', 18, 41, { size: 7, col: C.yellow, align: 'left', alpha: a });
  E_card('gtasa_cover', 18, 50, 40, t, { t0: st.tThree, t1: st.tInstead });
  E_card('gtasa_shot', 18, 92, 96, t, { t0: st.tUnload, label: 'SAN ANDREAS · 2004' });
  st.cities.forEach(c => { const [x, y] = project(V(c.x, 3.5, c.z), S.cam); text(c.n, x, y, { size: 6.5, font: 'head', alpha: a }); });
  const sep = ease((t - st.tPlan) / .3) * (1 - ease((t - st.tInstead) / .3));
  if (sep > 0) {
    text('ORIGINAL PLAN: 3 SEPARATE MAPS', W - 18, 30, { size: 7, font: 'head', col: C.silver, align: 'right', alpha: sep });
    const P = st.cities.map(c => project(V(c.x, 1, c.z), S.cam));
    for (let i = 0; i < 3; i++) { const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % 3];
      for (let k = 0; k < 1; k += .08) line(lerp(x0, x1, k), lerp(y0, y1, k), lerp(x0, x1, k + .04), lerp(y0, y1, k + .04), C.cyan, sep * ease((t - st.tTrain) / .3), 1); }
    text('travel by train or plane', W - 18, 40, { size: 6.5, col: C.cyan, align: 'right', alpha: sep * ease((t - st.tTrain) / .3) });
  }
  const m = ease((t - st.tInstead) / .3);
  if (m > 0) {
    text('MEMORY', W - 18, 30, { size: 7, font: 'head', align: 'right', alpha: m });
    [['LOS SANTOS', st.lsLoad, C.orange], ['SAN FIERRO', st.sfLoad, C.sky]].forEach(([n, v, c], i) => {
      text(n, W - 70, 42 + i * 10, { size: 6, align: 'right', alpha: m, col: C.silver });
      rect(W - 66, 39 + i * 10, 48, 5, C.dark, m); rect(W - 66, 39 + i * 10, 48 * v, 5, c, m);
    });
    text('desert + forest = loading time', W - 18, 64, { size: 6.5, col: C.yellow, align: 'right', alpha: ease((t - st.tUnload) / .3) });
    text('ONE MAP · NO LOADING SCREENS', W / 2, 150 - 10, { size: 8, font: 'head', col: C.lime, alpha: ease((t - st.tOne) / .3) });
  }
}});

// ---- 5g: GTA III still had loading screens between islands ----
shot({ t0: cue('Grand Theft Auto III still had', 327.1) - .1, chapter: CH, build(S) {
  S.bg = C.bg; return { t: cue('loading screens between its islands', 328.5) };
}, update(st, t, S) { S.cam.position.set(0, 0, 5); S.cam.lookAt(0, 0, 0); }, draw(st, t, S) {
  const a = ease((t - S.t0 - .1) / .3);
  rect(60, 50, 200, 60, C.navy, a); frame(60, 50, 200, 60, C.slate, a, 1);
  text('LOADING', W / 2, 70, { size: 12, font: 'head', alpha: a });
  text('STAUNTON ISLAND', W / 2, 84, { size: 7, col: C.silver, alpha: a });
  const k = ((t - S.t0) * .35) % 1;
  for (let i = 0; i < 20; i++) rect(80 + i * 8, 94, 6, 6, i / 20 < k ? C.yellow : C.dark, a);
}});

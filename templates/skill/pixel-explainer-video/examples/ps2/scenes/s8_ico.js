// 7:38 - 10:00  Team Ico: fur shells, bloom, collision proxies, IK, LOD rings, streaming in frame gaps, motion blur.
import { THREE, C, RAMP, shot, cue, ease, easeOut, easeIn, seg, pop, clamp, lerp, V, text, stat, tag, rect, line, frame, project, facet, flat, box, rng, W, H, hud, card } from '../engine.js';
import { colossus, rider, person, mountain, terrain, gridFloor, orbit, pixelQuad, wire, tree, ghostBox, memory, scatter } from '../models.js';

const CH = ['04', 'THE GRAPHICS CHIP  ·  TEAM ICO'];
const hills = (x, z) => Math.sin(x * .1) * 1.2 + Math.cos(z * .08 + 1) * 1.4 + Math.sin((x + z) * .05) * 1.6;
function land(S, ramp = [C.bg, C.navy, C.teal]) {
  S.bg = C.navy; S.sky = [C.navy, C.sky]; S.fogNear = 30; S.fogFar = 115;
  S.scene.add(terrain(200, 200, 60, hills, ramp), scatter(hills, { n: 1400, area: 70, seed: 3 }));
  const r = rng(12);
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, d = 60 + r() * 20; const m = mountain(10 + r() * 8, 14 + r() * 12, i, 'stone'); m.position.set(Math.cos(a) * d, -1, Math.sin(a) * d); S.scene.add(m); }
}
function walk(col, lt, speed = 1.6) {
  col.legL.rotation.x = Math.sin(lt * speed) * .35; col.legR.rotation.x = -Math.sin(lt * speed) * .35;
  col.armL.rotation.x = -Math.sin(lt * speed) * .2; col.armR.rotation.x = Math.sin(lt * speed) * .2;
}
// dithered see-through copy of an object (for motion-blur ghosts)
function ghostify(obj, opacity) {
  obj.traverse(m => { if (m.isMesh && m.material?.uniforms?.c0) { const u = m.material.uniforms;
    m.material = facet([u.c0.value.getStyle(), u.c1.value.getStyle(), u.c2.value.getStyle()], { opacity }); } });
  return obj;
}

// ---- 8a: Shadow of the Colossus, Team Ico, 2005 ----
shot({ t0: cue('Which brings us to the graphics chip', 458.1) - .1, chapter: CH, chapterFirst: true, build(S) {
  land(S);
  const st = { col: colossus(1.1), rid: rider(1.3) };
  S.scene.add(st.col, st.rid);
  st.tSq = cue('squeezed the most', 460.5); st.tSotc = cue('Shadow of the Colossus', 462.3); st.tIco = cue('Team Ico', 463.8);
  st.tBreak = cue('detailed breakdown', 467.5); st.tAround = cue('getting around the PS2', 471);
  st.hits = [st.tSotc];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  st.col.position.set(0, hills(0, -6) - .3, -6 + lt * .15); walk(st.col, lt, 1.2);
  st.rid.position.set(-1.5, hills(-1.5, 8), 8); st.rid.rotation.y = -Math.PI / 2 + .6;
  S.cam.position.set(-7 + lt * .12, 2.4 + hills(-7, 18), 19); S.cam.lookAt(0, 6.2, -3);
}, draw(st, t, S) {
  const a = ease((t - st.tSq) / .3) * (1 - ease((t - st.tSotc) / .3));
  text('the game that used all three', W / 2, 36, { size: 7, col: C.silver, alpha: a });
  const b = ease((t - st.tSotc) / .3);
  text('SHADOW OF THE COLOSSUS', W - 18, 34, { size: 10, font: 'head', align: 'right', alpha: b });
  text('Team Ico · 2005', W - 18, 45, { size: 6.5, col: C.yellow, align: 'right', alpha: ease((t - st.tIco) / .3) });
  card('sotc_cover', W - 18, 56, 44, t, { t0: st.tSotc, t1: st.tBreak, align: 'right' });
  card('fumito_ueda', 18, 60, 84, t, { t0: st.tIco, label: 'FUMITO UEDA', sub: 'director · photo: AI Dreamy, CC BY-SA 4.0' });
  const d = ease((t - st.tBreak) / .3);
  if (d > 0) { rect(W - 108, 54, 90, 40, C.bg, .85 * d); frame(W - 108, 54, 90, 40, C.slate, d);
    text('TECHNICAL BREAKDOWN', W - 63, 61, { size: 5.5, col: C.yellow, alpha: d, outline: false });
    ['fur', 'bloom', 'collision', 'LOD + streaming', 'motion blur'].forEach((s, i) => text('· ' + s, W - 104, 68 + i * 5.5, { size: 5, col: C.silver, align: 'left', alpha: d * ease((t - st.tBreak - .2 - i * .15) / .2), outline: false })); }
}});

// ---- 8b: fur = stacked see-through shells ----
function furLayer(k, seed) {
  const r = rng(seed);
  return pixelQuad(4, 4, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const n = Math.round(260 * (1 - k * .6));
    for (let i = 0; i < n; i++) { x.fillStyle = [C.green, C.teal, C.lime][i % 3]; x.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1); }
  }, 40, 40);
}
shot({ t0: cue('Start with the fur', 472.5) - .1, chapter: CH, build(S) {
  S.bg = C.bg;
  const st = { skin: box(4, .4, 4, 'stone', [0, -.2, 0]), layers: [], fins: [] };
  S.scene.add(st.skin, gridFloor(40, 1, C.navy));
  for (let k = 0; k < 6; k++) { const q = furLayer(k / 6, 20 + k); q.rotation.x = -Math.PI / 2; q.position.y = .08 + k * .16; S.scene.add(q); st.layers.push(q); }
  for (let i = 0; i < 18; i++) { const f = box(.04, .7, .22, 'green', [2 - .02, .3, -1.9 + i * .22]); f.rotation.z = -.5; S.scene.add(f); st.fins.push(f); }
  st.tGrab = cue('grab and climb', 475.5); st.tModern = cue('modern graphics card', 476.6); st.tCant = cue("The PS2 can't", 478.8);
  st.tStack = cue('stacked layers', 483.2); st.tScan = cue('slices of a scan', 485.5); st.tSee = cue('see-through texture', 487.4);
  st.tThree = cue('three to six', 489.9); st.tDepth = cue('depth', 493.2); st.tExtra = cue('extra drawing', 494.4); st.tGS = cue('graphics synthesizer', 496.3);
  st.tEdges = cue('at the edges', 501.5); st.tStrips = cue('strips of hair', 503.5);
  st.hits = [st.tStack, st.tThree, st.tStrips];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  const n = t < st.tStack ? 0 : t < st.tThree ? Math.min(3, 1 + Math.floor((t - st.tStack) / .8)) : Math.min(6, 3 + Math.floor((t - st.tThree) / .5));
  st.layers.forEach((q, k) => { q.visible = k < n; q.position.y = .08 + k * lerp(.16, .1, ease((t - st.tDepth) / 1)); });
  st.fins.forEach(f => f.visible = t > st.tStrips);
  // side view to see the slices, then top view where it reads as fur, then edge view for fins
  const side = ease((t - st.tScan + .5) / 1.2) * (1 - ease((t - st.tDepth + .8) / 1.2));
  const edge = ease((t - st.tEdges) / 1.2);
  orbit(S.cam, V(0, .3, 0), lerp(7, 6, side), .5 + lt * .05 + edge * .9, lerp(lerp(5.5, .9, side), 2.2, edge));
}, draw(st, t, S) {
  const a = ease((t - st.tModern) / .3) * (1 - ease((t - st.tStack) / .3));
  text('MODERN GPU: every strand', 18, 34, { size: 8, font: 'head', align: 'left', alpha: a, col: C.silver });
  text("PS2: can't", 18, 46, { size: 8, font: 'head', align: 'left', col: C.red, alpha: a * ease((t - st.tCant) / .3) });
  const b = ease((t - st.tStack) / .3);
  const n = t < st.tThree ? Math.min(3, 1 + Math.floor((t - st.tStack) / .8)) : Math.min(6, 3 + Math.floor((t - st.tThree) / .5));
  text('FUR SHELLS', 18, 34, { size: 10, font: 'head', align: 'left', alpha: b });
  text(`${Math.max(1, n)} layer${n > 1 ? 's' : ''} above the skin`, 18, 45, { size: 6.5, col: C.lime, align: 'left', alpha: b });
  text('each: a see-through slice of hair', 18, 54, { size: 6.5, col: C.silver, align: 'left', alpha: ease((t - st.tSee) / .3) });
  const c = ease((t - st.tExtra) / .3) * (1 - ease((t - st.tEdges) / .3));
  if (c > 0) { stat(W - 18, 38, 'x' + Math.max(1, n), 'draws', { size: 16, align: 'right', alpha: c });
    text('the GS paints layer after layer', W - 18, 52, { size: 6.5, col: C.yellow, align: 'right', alpha: c * ease((t - st.tGS) / .3) }); }
  const e = ease((t - st.tStrips) / .3);
  text('+ fins: strips of hair at the edges', W - 18, 38, { size: 7, col: C.lime, align: 'right', alpha: e });
}});

// ---- 8c: bloom: shrink to 64x64, stretch back up blurred, blend over ----
function sceneImg(x, w, h, scale = 1) {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, C.navy); g.addColorStop(.6, C.sky); g.addColorStop(1, C.cyan);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = C.white; x.beginPath(); x.arc(w * .72, h * .3, w * .07, 0, 7); x.fill();
  x.fillStyle = C.dark; x.fillRect(w * .28, h * .35, w * .16, h * .4); x.fillRect(w * .24, h * .45, w * .06, h * .25); x.fillRect(w * .42, h * .45, w * .06, h * .25); x.fillRect(w * .31, h * .25, w * .1, h * .12);
  x.fillStyle = C.teal; x.fillRect(0, h * .78, w, h * .22);
  x.fillStyle = C.white; x.fillRect(w * .05, h * .7, w * .18, h * .1);
}
shot({ t0: cue('Then the light', 505.5) - .1, chapter: CH, build(S) {
  S.bg = C.bg;
  const st = {};
  const mk = (fn, pw, ph) => pixelQuad(2.6, 1.6, fn, pw, ph);
  st.full = mk((x, w, h) => sceneImg(x, w, h), 160, 100);
  st.small = mk((x, w, h) => { const c = document.createElement('canvas'); c.width = 16; c.height = 10; sceneImg(c.getContext('2d'), 16, 10); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, w, h); }, 160, 100);
  st.blur = mk((x, w, h) => { const c = document.createElement('canvas'); c.width = 16; c.height = 10; sceneImg(c.getContext('2d'), 16, 10); x.imageSmoothingEnabled = true; x.filter = 'blur(6px)'; x.drawImage(c, -6, -6, w + 12, h + 12); }, 160, 100);
  st.out = mk((x, w, h) => { sceneImg(x, w, h); const c = document.createElement('canvas'); c.width = 16; c.height = 10; sceneImg(c.getContext('2d'), 16, 10);
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = .45; x.filter = 'blur(8px)'; x.drawImage(c, -8, -8, w + 16, h + 16); }, 160, 100);
  st.prev = mk((x, w, h) => { x.translate(-6, 0); sceneImg(x, w, h); }, 160, 100);
  [st.full, st.small, st.blur, st.out].forEach((q, i) => { q.position.set(-4.8 + i * 3.2, 1.6, 0); S.scene.add(q); });
  st.prev.position.set(4.8, -.6, 0); st.prev.scale.setScalar(.6); S.scene.add(st.prev);
  S.scene.add(gridFloor(40, 1, C.navy));
  st.tWashed = cue('washed-out glow', 508.8); st.tNo = cue('no feature for that', 510.2); st.tTook = cue('took the finished picture', 513);
  st.tShrank = cue('shrank a copy', 514.3); st.tBlur = cue('blurred it', 517.8); st.tBlend = cue('blended it over', 519.6); st.tPrev = cue('frame before', 522.5); st.tResult = cue('soft glow', 524.5);
  st.hits = [st.tShrank, st.tBlur, st.tBlend, st.tResult];
  return st;
}, update(st, t, S) {
  const k = ease((t - st.tResult) / 1.2);
  S.cam.position.set(lerp(0, 4.8, k), lerp(1.4, 1.6, k), lerp(9.5, 3.4, k)); S.cam.lookAt(lerp(0, 4.8, k), lerp(1.1, 1.6, k), 0);
  st.full.visible = t > st.tTook; st.small.visible = t > st.tShrank; st.blur.visible = t > st.tBlur; st.out.visible = t > st.tBlend; st.prev.visible = t > st.tPrev && k < .5;
}, draw(st, t, S) {
  const a = ease((t - S.t0 - .2) / .3) * (1 - ease((t - st.tTook) / .3));
  text('THE GLOW', W / 2, 40, { size: 12, font: 'head', alpha: a });
  card('sotc_mono', W / 2, 64, 150, t, { t0: S.t0 + .6, t1: st.tTook, align: 'center', label: 'THE REAL THING', sub: 'Shadow of the Colossus (2005)' });
  text('the PS2 has no feature for it', W / 2, 52, { size: 7, col: C.red, alpha: a * ease((t - st.tNo) / .3) });
  const labs = [[st.tTook, 'finished frame'], [st.tShrank, 'shrink to 64x64'], [st.tBlur, 'stretch back up = blur'], [st.tBlend, 'blend over original']];
  labs.forEach(([tc, s], i) => { const [x, y] = project(V(-4.8 + i * 3.2, .6, 0), S.cam); text(`${i + 1}  ${s}`, x, y + 8, { size: 6, alpha: ease((t - tc) / .3) * (1 - ease((t - st.tResult) / .3)), col: i === 3 ? C.yellow : C.white });
    if (i) { const [x0, y0] = project(V(-4.8 + (i - 1) * 3.2 + 1.35, 1.6, 0), S.cam); line(x0 + 1, y0, x0 + 6, y0, C.silver, ease((t - tc) / .3)); } });
  const [px, py] = project(V(4.8, -1.2, 0), S.cam);
  text('+ a bit of the previous frame', px, py + 6, { size: 6, col: C.cyan, alpha: ease((t - st.tPrev) / .3) * (1 - ease((t - st.tResult) / .3)) });
}});

// ---- 8d: 3,000 vs 18,000 polygons; the hidden collision copy ----
shot({ t0: cue('Then the Colossi themselves', 526.2) - .1, chapter: CH, build(S) {
  land(S);
  const st = { col: colossus(1), wan: person('red', 2.2), proxy: new THREE.Group() };
  st.col.position.set(1.5, hills(1.5, 0) - .2, 0); st.wan.position.set(-3.5, hills(-3.5, 3), 3);
  S.scene.add(st.col, st.wan);
  st.w = wire(st.col, C.cyan); S.scene.add(st.w);
  [[0, 2.3, 0, 2.6, 4.6, 1.4], [0, 5.2, 0, 3.8, 3.2, 2.6], [0, 6.8, .2, 1.8, 1.8, 1.8]].forEach(([x, y, z, w, h, d]) => {
    const g = ghostBox(w, h, d, C.red); g.position.set(1.5 + x, hills(1.5, 0) - .2 + y, z); st.proxy.add(g); });
  S.scene.add(st.proxy);
  st.tWander = cue('Wander', 528.3); st.t3000 = cue('3,000', 530); st.t18 = cue('18,000', 533.4); st.tTooMany = cue('too many to test', 534.5);
  st.tHidden = cue('hidden', 538); st.t40 = cue('a 40th', 541);
  st.hits = [st.t18, st.tHidden];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(-.8, 4.2, 0), 17, .25 + (t - S.t0) * .02, 1.4);
  st.w.visible = t > st.t18 - .1 && t < st.tHidden;
  st.proxy.visible = t > st.tHidden;
  const hide = t > st.tHidden + .8;
  st.col.visible = !hide || Math.floor(t * 2) % 2 === 0 && t < st.t40;
  if (t > st.t40) st.col.visible = true;
}, draw(st, t, S) {
  const [wx, wy] = project(st.wan.position.clone().add(V(0, 1.2, 0)), S.cam);
  text('WANDER', wx, wy - 18, { size: 7, font: 'head', alpha: ease((t - st.tWander) / .3) });
  if (t > st.t3000 - .1) stat(wx, wy - 6, Math.round(3000 * easeOut((t - st.t3000) / .8)).toLocaleString('en-US'), 'polys', { size: 9, alpha: ease((t - st.t3000) / .3) });
  const [cx, cy] = project(st.col.position.clone().add(V(3.4, 6.5, 0)), S.cam);
  text('COLOSSUS', cx, cy - 14, { size: 7, font: 'head', alpha: ease((t - st.t18 + .6) / .3) });
  if (t > st.t18 - .1) stat(cx, cy - 2, Math.round(18000 * easeOut((t - st.t18) / .8)).toLocaleString('en-US'), 'polys', { size: 9, alpha: ease((t - st.t18) / .3), unitCol: C.cyan });
  card('sotc_valus', 18, 26, 76, t, { t0: st.tTooMany - .6, t1: st.tHidden + .3, label: 'A COLOSSUS YOU CAN CLIMB' });
  const a = ease((t - st.tTooMany) / .3) * (1 - ease((t - st.tHidden) / .3));
  text('too many to test collisions against every frame', W / 2, 160, { size: 7, col: C.orange, alpha: a });
  const b = ease((t - st.tHidden) / .3);
  text('HIDDEN COLLISION COPY', 18, 34, { size: 8, font: 'head', col: C.red, align: 'left', alpha: b });
  text('~1/40 of the polygons', 18, 45, { size: 7, col: C.silver, align: 'left', alpha: ease((t - st.t40) / .3) });
}});

// ---- 8e: inverse kinematics: feet land on the actual slope ----
shot({ t0: cue('And as a Colossus walks', 542.8) - .1, chapter: CH, build(S) {
  S.bg = C.navy; S.sky = [C.navy, C.sky]; S.fogNear = 30; S.fogFar = 70;
  const slope = x => x * .28;
  const g = new THREE.PlaneGeometry(40, 14, 20, 6).toNonIndexed(); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, slope(p.getX(i)) + Math.sin(p.getZ(i) * .6) * .15);
  g.computeVertexNormals(); S.scene.add(new THREE.Mesh(g, facet([C.bg, C.navy, C.teal])));
  const st = { col: colossus(.8), slope, marks: [box(.3, .3, .3, 'cyan'), box(.3, .3, .3, 'cyan')] };
  st.marks.forEach(m => { m.rotation.set(.785, 0, .785); S.scene.add(m); });
  S.scene.add(st.col);
  st.tIK = cue('inverse kinematics', 546); st.tLive = cue('calculated live', 547.6); st.tSlope = cue('actual slope', 549.8); st.tFloat = cue('floating above', 550.6);
  st.hits = [st.tIK];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0, x = -3 + lt * .45;
  st.col.position.set(x, st.slope(x) + .1, 0); st.col.rotation.y = Math.PI / 2; walk(st.col, lt, 1.4);
  const ik = t > st.tIK;
  // per-leg: foot target = ground height under that foot; adjust leg pitch so it reaches (simple 1-bone IK)
  [st.col.legL, st.col.legR].forEach((L, i) => {
    const phase = Math.sin(lt * 1.4) * (i ? -1 : 1), fx = x + phase * .9;
    const ground = st.slope(fx), hip = st.col.position.y + 3.2 * .8;
    const need = hip - ground, len = 3.4 * .8;
    L.scale.y = ik ? clamp(need / len, .7, 1.25) : 1;
    st.marks[i].position.set(fx, ground + .15, i ? -.7 : .7); st.marks[i].visible = ik;
  });
  S.cam.position.set(x + 1, st.slope(x) + 4.2, 14); S.cam.lookAt(x, st.slope(x) + 3.2, 0);
}, draw(st, t, S) {
  const a = ease((t - st.tIK) / .3);
  text('INVERSE KINEMATICS', 18, 34, { size: 9, font: 'head', align: 'left', col: C.cyan, alpha: a });
  text('feet placed on the ground, calculated live', 18, 45, { size: 6.5, col: C.silver, align: 'left', alpha: ease((t - st.tLive) / .3) });
  text('on the real slope - not floating above it', 18, 54, { size: 6.5, col: C.yellow, align: 'left', alpha: ease((t - st.tSlope) / .3) });
}});

// ---- 8f: the land in three rings: painted backdrop far away, coarse blocks in the middle, full detail near ----
shot({ t0: cue('And the land', 551.5) - .1, chapter: CH, build(S) {
  S.bg = C.navy; S.sky = [C.navy, C.sky]; S.fogNear = 200; S.fogFar = 300;
  const st = {};
  const near = terrain(24, 24, 24, hills, [C.navy, C.teal, C.green]); S.scene.add(near);
  S.scene.add(scatter(hills, { n: 500, area: 23, seed: 9 }));
  const r = rng(4); for (let i = 0; i < 30; i++) { const x = -11 + r() * 22, z = -11 + r() * 22; const tr = tree(1.3, i); tr.position.set(x, hills(x, z), z); S.scene.add(tr); }
  st.nearFrame = ghostBox(24, .1, 24, C.lime); st.nearFrame.position.y = 3.2; S.scene.add(st.nearFrame);
  st.mid = new THREE.Group();
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { if (!i && !j) continue;
    const m = terrain(24, 24, 3, (x, z) => hills(x + i * 24, z + j * 24) * 1.4, (i + j) % 2 ? [C.bg, C.navy, C.teal] : [C.bg, C.dark, C.slate]); m.position.set(i * 24, 0, j * 24); st.mid.add(m);
    const e = ghostBox(24, .1, 24, C.slate); e.position.set(i * 24, 3, j * 24); st.mid.add(e); }
  S.scene.add(st.mid);
  // far: a painted panorama wrapped on a cylinder
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = C.sky; x.fillRect(0, 0, 512, 64);
  for (const [col, base, amp, f] of [[C.slate, 34, 16, .045], [C.dark, 46, 10, .09], [C.teal, 56, 5, .2]]) {
    x.fillStyle = col; for (let i = 0; i < 512; i++) { const hgt = base - amp * (Math.sin(i * f) * .6 + Math.sin(i * f * 2.3 + 1) * .4); x.fillRect(i, hgt, 1, 64 - hgt); } }
  x.fillStyle = C.white; for (let i = 0; i < 512; i += 1) { const hgt = 34 - 16 * (Math.sin(i * .045) * .6 + Math.sin(i * .1035 + 1) * .4); if (hgt < 22) x.fillRect(i, hgt, 1, 3); }
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = 3; tex.colorSpace = THREE.NoColorSpace;
  st.ring = new THREE.Mesh(new THREE.CylinderGeometry(110, 110, 40, 48, 1, true), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }));
  st.ring.position.y = 14; S.scene.add(st.ring);
  st.person = person('red', 1.6); st.person.position.set(0, hills(0, 0), 0); S.scene.add(st.person);
  st.tNothing = cue('Nothing in the game has a loading', 552.5); st.tThree = cue('three layers of detail', 555); st.tFar = cue('Far away', 556.5);
  st.tMid = cue('middle distance', 561); st.t600 = cue('600 by 600', 562.5); st.t30 = cue('30th to a hundredth', 565); st.tClose = cue('close to the player', 567.5); st.t100 = cue('100 by 100', 569.2);
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  st.mid.visible = t > st.tMid - .3;
  st.nearFrame.visible = t > st.tClose;
  // low view toward the painted horizon -> rise for the middle ring -> down over the player
  const up = ease((t - st.tMid + .5) / 2.2), down = ease((t - st.tClose) / 1.8);
  const h = lerp(lerp(2.6, 55, up), 26, down), r = lerp(lerp(9, 70, up), 22, down);
  const a = .5 + lt * .03;
  S.cam.position.set(Math.sin(a) * r, h + hills(0, 0), Math.cos(a) * r);
  S.cam.lookAt(lerp(-Math.sin(a) * 60, 0, Math.max(up, down)), lerp(8, 0, Math.max(up, down)), lerp(-Math.cos(a) * 60, 0, Math.max(up, down)));
}, draw(st, t, S) {
  const a = ease((t - st.tNothing) / .3) * (1 - ease((t - st.tFar) / .3));
  text('NO LOADING SCREENS, ANYWHERE', W / 2, 36, { size: 8, font: 'head', alpha: a });
  const L = [[st.tFar, C.silver, 'FAR', 'a picture painted on a distant surface'], [st.tMid, C.teal, 'MIDDLE', t > st.t600 ? '600 m blocks · 1/30 - 1/100 of the polygons' : 'low-detail blocks'], [st.tClose, C.lime, 'NEAR', '100 m blocks · full detail']];
  L.forEach(([tc, col, hd, s], i) => { const b = ease((t - tc) / .3);
    rect(18, 32 + i * 16, 5, 5, col, b); text(hd, 27, 34.5 + i * 16, { size: 7, font: 'head', align: 'left', alpha: b });
    text(s, 27, 41.5 + i * 16, { size: 6, col: C.silver, align: 'left', alpha: b }); });
}});

// ---- 8g: streaming in the gaps between frames; tidying memory ----
shot({ t0: cue('The game reads in new pieces', 571.2) - .1, chapter: CH, build(S) {
  const st = { mem: memory(16, 3, .3, .05, 'navy') };
  st.mem.position.set(0, .5, 0); S.scene.add(st.mem, gridFloor(60, 1, C.navy));
  const r = rng(6); st.frag = st.mem.cells.map(() => r() < .55);
  st.tGaps = cue('gaps between drawing frames', 573); st.tTidy = cue('tidies up', 575.5); st.tHours = cue('hours of play', 578);
  st.hits = [st.tTidy];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(0, 1.2, 0), 8.5, .0, 2.2);
  const k = ease((t - st.tTidy) / 1.5);
  const used = st.frag.filter(Boolean).length;
  st.mem.cells.forEach((c, i) => {
    const on = k < .5 ? st.frag[i] : i < used;              // compacted after tidy
    c.material = facet(on ? (k > .5 ? 'lime' : 'sky') : 'navy');
  });
}, draw(st, t, S) {
  const a = ease((t - st.tGaps) / .3);
  if (a > 0) {                                             // frame timeline with disc reads in the gaps
    const y = 34, x0 = 20, fw = 22;
    text('FRAMES', x0, y - 8, { size: 6, col: C.silver, align: 'left', alpha: a });
    for (let i = 0; i < 12; i++) {
      const x = x0 + i * (fw + 2) - ((t * 20) % (fw + 2));
      if (x < 16 || x > W - 34) continue;
      rect(x, y, fw - 4, 8, C.blue, a); rect(x + fw - 4, y, 4, 8, C.cyan, a * (i % 2 ? 1 : .6));
    }
    rect(W - 90, y + 14, 5, 5, C.blue, a); text('drawing', W - 82, y + 16.5, { size: 6, align: 'left', alpha: a });
    rect(W - 50, y + 14, 5, 5, C.cyan, a); text('disc read', W - 42, y + 16.5, { size: 6, align: 'left', alpha: a });
  }
  const b = ease((t - st.tTidy) / .3);
  text('MEMORY: tidied up in the gaps too', W / 2, 128, { size: 7, font: 'head', col: C.lime, alpha: b });
  text("so it never runs out, even after hours", W / 2, 138, { size: 6.5, col: C.silver, alpha: ease((t - st.tHours) / .3) });
}});

// ---- 8h: unstable frame rate -> motion blur as style ----
shot({ t0: cue('But even with all of that', 579.2) - .1, chapter: CH, build(S) {
  land(S);
  const st = { col: colossus(1), ghosts: [] };
  S.scene.add(st.col);
  for (let i = 0; i < 3; i++) { const g = ghostify(colossus(1), .55 - i * .15); S.scene.add(g); st.ghosts.push(g); }
  st.tSteady = cue('steady frame rate', 581.5); st.t15 = cue('between 15 and 60', 585); st.tBlur = cue('added motion blur', 587.5);
  st.tShift = cue('shifted and blended', 591); st.tHide = cue('hide the frame rate', 594); st.tStyle = cue('part of the style', 599.3);
  st.hits = [st.tBlur, st.tStyle];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  const cz = -4 + lt * .3;
  st.col.position.set(0, hills(0, cz) - .2, cz); walk(st.col, lt, 1.3);
  const pan = t > st.tBlur ? Math.sin((t - st.tBlur) * .9) * 1.6 : 0;
  const cam = V(-9 + pan * 2, 3 + hills(-9, cz + 8), cz + 12); S.cam.position.copy(cam); S.cam.lookAt(0, 5, cz);
  const blur = ease((t - st.tShift) / .5);
  st.ghosts.forEach((g, i) => {                          // previous frames, shifted by camera motion
    g.visible = blur > 0 && Math.abs(Math.cos((t - st.tBlur) * .9)) > .15;
    g.position.copy(st.col.position).add(V(-(i + 1) * .35 * Math.sign(Math.cos((t - st.tBlur) * .9)), 0, 0));
    g.legL.rotation.x = st.col.legL.rotation.x; g.legR.rotation.x = st.col.legR.rotation.x;
  });
}, draw(st, t, S) {
  const a = ease((t - st.tSteady) / .3);
  if (a > 0) {
    const x0 = W - 120, y0 = 30, w = 100, h = 34;
    rect(x0 - 4, y0 - 4, w + 8, h + 16, C.bg, .8 * a); frame(x0 - 4, y0 - 4, w + 8, h + 16, C.slate, a);
    text('FPS', x0, y0 + h + 6, { size: 5.5, col: C.silver, align: 'left', alpha: a, outline: false });
    line(x0, y0, x0 + w, y0, C.dark, a); line(x0, y0 + h, x0 + w, y0 + h, C.dark, a);
    text('60', x0 + w + 2, y0, { size: 5, col: C.silver, align: 'left', alpha: a, outline: false }); text('15', x0 + w + 2, y0 + h, { size: 5, col: C.silver, align: 'left', alpha: a, outline: false });
    hud.globalAlpha = a; hud.strokeStyle = C.yellow; hud.lineWidth = .8; hud.beginPath();
    for (let i = 0; i <= 50; i++) { const tt = t - (50 - i) * .06; const f = 37 + Math.sin(tt * 2.3) * 14 + Math.sin(tt * 7.1) * 8 + Math.sin(tt * .7) * 6;
      const y = y0 + h - (clamp(f, 15, 60) - 15) / 45 * h; i ? hud.lineTo(x0 + i * w / 50, y) : hud.moveTo(x0, y); }
    hud.stroke(); hud.globalAlpha = 1;
    text('swings between 15 and 60', x0 + w / 2, y0 + h + 6, { size: 5.5, col: C.orange, alpha: a * ease((t - st.t15) / .3), outline: false });
  }
  const b = ease((t - st.tBlur) / .3);
  text('MOTION BLUR', 18, 34, { size: 10, font: 'head', align: 'left', alpha: b });
  text('previous frame shifted + blended in', 18, 45, { size: 6.5, col: C.silver, align: 'left', alpha: ease((t - st.tShift) / .3) });
  text('hides the frame rate changes', 18, 54, { size: 6.5, col: C.cyan, align: 'left', alpha: ease((t - st.tHide) / .3) });
  const c = ease((t - st.tStyle) / .3);
  text('A LIMIT, TURNED INTO STYLE', W / 2, 80, { size: 9, font: 'head', col: C.yellow, alpha: c });
}});

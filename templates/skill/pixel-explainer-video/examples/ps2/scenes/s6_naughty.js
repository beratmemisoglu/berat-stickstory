// 5:30 - 6:50  Naughty Dog: Jak and Daxter's unbroken world, LOD tricks, GOAL, hot reload, the cost.
import { THREE, C, shot, cue, ease, easeOut, easeIn, seg, pop, clamp, lerp, V, text, stat, tag, rect, line, frame, project, facet, flat, box, rng, W, H, hud, card } from '../engine.js';
import { ps2, person, tree, mountain, terrain, gridFloor, orbit, ground, pixelQuad, wire, scatter } from '../models.js';

const CH = ['02', 'THE CODE  ·  NAUGHTY DOG'];
const HF = (x, z) => {                                   // island with a mountain at (0, -40)
  const m = Math.max(0, 1 - Math.hypot(x, z + 40) / 16) ** 1.4 * 14;
  const isl = Math.max(-1.5, 1.2 - Math.hypot(x * .6, (z + 18) * .45) / 14);
  return Math.max(m, isl + Math.sin(x * .4) * .25 + Math.cos(z * .35) * .25);
};
function island(S, withFar = true) {
  S.bg = C.blue; S.sky = [C.blue, C.cyan]; S.fogNear = 40; S.fogFar = 110;
  S.scene.add(box(400, .1, 400, [C.bg, C.navy, C.blue], [0, -.9, 0]));      // sea
  const land = terrain(70, 80, 56, HF, [C.navy, C.teal, C.green]); land.position.z = -18; S.scene.add(land, scatter((x, z) => HF(x, z + 18), { n: 700, area: 44, seed: 5, cz: -18 }));
  const snow = mountain(4.2, 4, 3, 'white', false); snow.position.set(0, 10.8, -40); S.scene.add(snow);
  const r = rng(3);
  for (let i = 0; i < 45; i++) { const x = -18 + r() * 36, z = -2 - r() * 30; if (HF(x, z - 18 + 18) > 3) continue;
    const t = tree(1.8, i); t.position.set(x, HF(x, z), z); S.scene.add(t); }
  let far = null;
  if (withFar) {                                          // far background = a painted card
    far = pixelQuad(160, 40, (x, w, h) => {
      x.fillStyle = C.slate; for (let i = 0; i < w; i++) { const hh = 14 + Math.sin(i * .09) * 8 + Math.sin(i * .23) * 5; x.fillRect(i, h - hh, 1, hh); }
      x.fillStyle = C.dark; for (let i = 0; i < w; i++) { const hh = 7 + Math.sin(i * .15 + 2) * 4; x.fillRect(i, h - hh, 1, hh); }
    }, 160, 40);
    far.position.set(0, 12, -110); S.scene.add(far);
  }
  return far;
}

// ---- 6a: one unbroken world: see the mountain, walk to it, climb it ----
shot({ t0: cue('another game', 332) - 1.3, chapter: CH, chapterFirst: true, build(S) {
  const st = { far: island(S), jak: person('orange', 3) };
  S.scene.add(st.jak);
  st.tJak = cue('Jak and Daxter', 334.2); st.tND = cue('by Naughty Dog', 335.3); st.tDec = cue('December 2001', 337); st.tGuin = cue('Guinness', 338.4);
  st.tNoLv = cue('No levels', 342.8); st.tNoLd = cue('no load screens', 343.7); st.tSee = cue('see a mountain', 345.6);
  st.tWalk = cue('walk to it', 347); st.tClimb = cue('climb it', 347.9); st.tStop = cue('without the game ever stopping', 349.2);
  st.hits = [st.tGuin, st.tNoLv, st.tNoLd, st.tStop];
  return st;
}, update(st, t, S) {
  // path: beach (0,-2) -> mountain base (0,-28) -> summit (0,-38)
  const k = ease((t - st.tWalk + .2) / 1.4), c = ease((t - st.tClimb) / 2.2);
  const z = lerp(lerp(-2, -27, k), -37.5, c), x = Math.sin(z * .2) * 1.5;
  st.jak.position.set(x, HF(x, z) + .05, z); st.jak.rotation.y = Math.PI;
  st.jak.position.y += Math.abs(Math.sin(t * 9)) * .12;
  const back = V(x + 3, HF(x, z) + 5 + c * 4, z + 11 - c * 2);
  const wide = V(12, 9, 16);
  const m = ease((t - st.tSee + .5) / 1.2);
  S.cam.position.copy(wide.clone().lerp(back, m)); S.cam.lookAt(lerp(0, x, m), lerp(6, HF(x, z) + 2 + c * 2, m), lerp(-26, z - 8, m));
}, draw(st, t, S) {
  const a = ease((t - st.tJak) / .3);
  text('JAK AND DAXTER', W - 18, 34, { size: 10, font: 'head', align: 'right', alpha: a });
  text('Naughty Dog · December 2001', W - 18, 45, { size: 6.5, col: C.yellow, align: 'right', alpha: ease((t - st.tDec) / .3) });
  card('jak_cover', W - 18, 56, 44, t, { t0: st.tJak, t1: st.tSee, align: 'right' });
  card('logo_naughty_dog', W - 68, 58, 64, t, { t0: st.tND, t1: st.tSee, align: 'right' });
  card('jak_shot', W - 18, 56, 112, t, { t0: st.tSee + .3, align: 'right', label: 'JAK AND DAXTER · 2001' });
  const g = ease((t - st.tGuin) / .3) * (1 - ease((t - st.tNoLv - 2.4) / .3));
  if (g > 0) { rect(18, 30, 132, 30, C.bg, .82 * g); frame(18, 30, 132, 30, C.yellow, g, .8);
    text('GUINNESS WORLD RECORDS', 84, 38, { size: 6, col: C.yellow, alpha: g, outline: false });
    text('first console game with a', 84, 47, { size: 6.2, alpha: g, outline: false });
    text('single, unbroken 3D world', 84, 55, { size: 6.2, alpha: g, outline: false }); }
  [[st.tNoLv, 'LEVELS'], [st.tNoLd, 'LOAD SCREENS']].forEach(([tc, s], i) => {
    const b = ease((t - tc) / .25) * (1 - ease((t - st.tSee) / .4));
    text('✕ ' + s, 18, 72 + i * 11, { size: 8, font: 'head', col: C.red, align: 'left', alpha: b });
  });
  tag(S.cam, V(0, 15.2, -40), 'the mountain', { alpha: ease((t - st.tSee) / .3) * (1 - ease((t - st.tWalk) / .3)), dy: -12 });
  const d = ease((t - st.tStop) / .3);
  text('NEVER STOPS TO LOAD', W / 2, 60, { size: 9, font: 'head', col: C.lime, alpha: d });
}});

// ---- 6b: same tricks: simple models far away, flat images for the farthest ----
shot({ t0: cue('The world was built out of', 349.9) - .1, chapter: CH, build(S) {
  const st = { far: island(S) };
  st.mid = mountain(9, 7, 2, [C.dark, C.slate, C.slate], false); st.mid.position.set(-28, -1, -70); S.scene.add(st.mid);
  st.w = wire(st.mid, C.cyan); S.scene.add(st.w);
  st.tSimple = cue('simplified models', 353); st.tFlat = cue('flat images', 355.5); st.tTell = cue('never tell the difference', 357.5);
  st.hits = [st.tFlat];
  return st;
}, update(st, t, S) {
  const k = ease((t - st.tFlat) / 2.2);
  const ang = lerp(0, 1.25, k);
  S.cam.position.set(Math.sin(ang) * 60, lerp(12, 30, k), -40 + Math.cos(ang) * 60); S.cam.lookAt(0, 6, lerp(-60, -80, k));
  st.w.visible = t > st.tSimple;
}, draw(st, t, S) {
  tag(S.cam, V(-28, 7, -70), 'simplified model', { alpha: ease((t - st.tSimple) / .3), dy: -16, col: C.cyan });
  tag(S.cam, V(0, 20, -110), 'far away: a flat picture', { alpha: ease((t - st.tFlat - .8) / .3), dy: -14, col: C.yellow });
  text('...the player can never tell', W / 2, 40, { size: 7.5, col: C.silver, alpha: ease((t - st.tTell) / .3) });
}});

// ---- 6c: GOAL: their own language, Lisp + raw assembly side by side ----
const GOAL = [
  ['(defun jak-jump ((self jak))', 'lisp'],
  ['  (let ((v (-> self velocity)))', 'lisp'],
  ['    (set! (-> v y) (* 1.5 *jump-speed*))', 'lisp'],
  ['    (rlet ((vel :class vf)', 'lisp'],
  ['           (acc :class vf))', 'lisp'],
  ['      (.lvf vel (&-> v quad))', 'asm'],
  ['      (.mul.x.vf vel vel acc)', 'asm'],
  ['      (.svf (&-> v quad) vel))', 'asm'],
  ["    (play-anim self 'jump)))", 'lisp'],
];
shot({ t0: cue('What made Naughty Dog different', 358.9) - .1, chapter: CH, build(S) {
  const st = { ps: ps2() };
  S.scene.add(st.ps, gridFloor(60, 1, C.navy)); st.ps.position.set(5.2, 0, -1.5);
  st.tCode = cue('how they wrote the code', 360.5); st.tC = cue('Instead of C', 361.8); st.tOwn = cue('built themselves', 365.5);
  st.tGoal = cue('called GOAL', 367); st.tLisp = cue('game-oriented', 368); st.tAndy = cue('Andy Gavin', 370.2);
  st.tRes = cue('mostly used in research', 373); st.tHigh = cue('high-level code', 375.8); st.tAsm = cue('raw assembly', 377.3); st.tFile = cue('same file', 379);
  st.hits = [st.tGoal, st.tAsm];
  return st;
}, update(st, t, S) { orbit(S.cam, V(1.2, .6, 0), 6.5, -.5 + (t - S.t0) * .02, 2.2); }, draw(st, t, S) {
  const a = ease((t - st.tCode) / .3);
  const cc = ease((t - st.tC) / .3) * (1 - ease((t - st.tOwn) / .3));
  text('C / C++', 30, 40, { size: 12, font: 'head', col: C.slate, align: 'left', alpha: cc });
  line(26, 44, 92, 34, C.red, cc * ease((t - st.tC - .5) / .2), 1.5);
  const g = ease((t - st.tGoal) / .3);
  text('GOAL', 18, 36, { size: 16, font: 'head', weight: 900, col: C.lime, align: 'left', alpha: g });
  text('Game Oriented Assembly Lisp', 18, 48, { size: 6.5, col: C.silver, align: 'left', alpha: ease((t - st.tLisp) / .3) });
  card('andy_gavin', W - 18, 26, 72, t, { t0: st.tAndy, align: 'right', label: 'ANDY GAVIN', sub: 'photo: Jkay747, CC BY-SA 3.0' });
  text('created by Andy Gavin', 18, 56, { size: 6.5, col: C.yellow, align: 'left', alpha: ease((t - st.tAndy) / .3) });
  const e = ease((t - st.tRes) / .3);
  if (e > 0) {
    rect(14, 64, 176, 84, C.bg, .9 * e); frame(14, 64, 176, 84, C.slate, e);
    rect(14, 64, 176, 8, C.dark, e); text('jak-player.gc', 20, 68.5, { size: 5.5, col: C.silver, align: 'left', alpha: e, outline: false });
    GOAL.forEach(([s, kind], i) => {
      const hi = kind === 'asm' ? ease((t - st.tAsm) / .3) : ease((t - st.tHigh) / .3);
      if (kind === 'asm' && hi > 0) rect(15, 75 + i * 8 - 3.5, 174, 7.5, C.navy, e * hi);
      text(s, 20, 76 + i * 8, { size: 5.8, align: 'left', outline: false, alpha: e * (.35 + .65 * Math.max(hi, t < st.tHigh ? 1 : 0)), col: kind === 'asm' ? C.orange : C.lime });
    });
    text('high-level Lisp', 196, 80, { size: 6, col: C.lime, align: 'left', alpha: ease((t - st.tHigh) / .3) });
    text('raw VU assembly', 196, 120, { size: 6, col: C.orange, align: 'left', alpha: ease((t - st.tAsm) / .3) });
    text('- same file -', 196, 140, { size: 6, col: C.white, align: 'left', alpha: ease((t - st.tFile) / .3) });
  }
}});

// ---- 6d: hot reload into the running game ----
shot({ t0: cue('It also let them change', 379.8) - .1, chapter: CH, build(S) {
  const st = { kit: ps2(), pkt: box(.25, .25, .25, 'lime') };
  S.scene.add(gridFloor(60, 1, C.navy), st.kit, st.pkt);
  st.kit.position.set(2.2, 0, 0); st.kit.traverse(m => { if (m.isMesh && m.material?.uniforms?.c1?.value.getHexString() === '333c57') m.material = facet('navy'); });
  const pc = new THREE.Group(); pc.add(box(1.9, 1.3, .12, 'black', [0, 1.25, 0]), box(.2, .6, .2, 'grey', [0, .3, 0]), box(1.0, .08, .6, 'grey', [0, .02, 0]));
  st.scr = pixelQuad(1.7, 1.1, () => {}, 48, 32); st.scr.position.set(0, 1.25, .07); pc.add(st.scr);
  pc.position.set(-2.8, 0, .3); pc.rotation.y = .35; S.scene.add(pc);
  const tv = new THREE.Group(); tv.add(box(2.2, 1.5, .5, 'black', [0, 0, 0]));
  st.tv = pixelQuad(1.9, 1.2, () => {}, 48, 30); st.tv.position.z = .26; tv.add(st.tv);
  tv.position.set(2.2, 2.1, -.3); S.scene.add(tv);
  st.tChange = cue('change a piece of code', 381); st.tCompile = cue('compile it', 381.7); st.tSend = cue('send it straight', 382.8);
  st.tNo = cue('No restart', 385.4); st.tKept = cue('kept playing', 386.5); st.tAppear = cue('just appeared', 388); st.tHalf = cue('half a million', 389.8);
  st.hits = [st.tSend, st.tNo, st.tHalf];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(-.2, 1.2, 0), 8.2, .15 + Math.sin((t - S.t0) * .2) * .08, 1.8);
  const k = clamp((t - st.tSend) / 1.2);
  st.pkt.visible = k > 0 && k < 1;
  st.pkt.position.set(lerp(-2.6, 2.2, k), 1.4 + Math.sin(k * Math.PI) * 1.4, lerp(.4, .2, k)); st.pkt.rotation.set(t * 5, t * 4, 0);
  const newCode = t > st.tSend + 1.2;
  st.scr.userData.redraw((x, w, h) => {
    x.fillStyle = C.bg; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) { x.fillStyle = [C.lime, C.lime, C.orange, C.lime, C.sky, C.lime, C.lime][i]; x.fillRect(3 + (i % 3) * 3, 3 + i * 4, 14 + ((i * 7) % 20), 2); }
    if (t > st.tChange) { x.fillStyle = C.yellow; x.fillRect(3, 11, t > st.tCompile ? 30 : 20 + ((t * 10) % 10), 2); }
  });
  st.tv.userData.redraw((x, w, h) => {                   // the running game: a character hopping forever
    x.fillStyle = C.navy; x.fillRect(0, 0, w, h); x.fillStyle = C.green; x.fillRect(0, h - 7, w, 7);
    const px = 8 + ((t * 9) % (w - 16)), py = h - 13 - Math.abs(Math.sin(t * 4)) * 8;
    x.fillStyle = newCode ? C.yellow : C.orange; x.fillRect(px, py, 5, 6);
    x.fillStyle = newCode ? C.lime : C.sky; x.fillRect(px + 1, py - 2, 3, 2);
    if (newCode) { x.fillStyle = C.cyan; x.fillRect(px - 3, py + 3, 2, 1); x.fillRect(px + 6, py + 3, 2, 1); }
  });
}, draw(st, t, S) {
  tag(S.cam, V(-2.8, 2.1, .3), 'PC: edit + compile', { alpha: ease((t - st.tChange) / .3) * (1 - ease((t - st.tNo) / .3)), dy: -12, col: C.lime });
  tag(S.cam, V(2.2, .9, 0), 'dev kit, game running', { alpha: ease((t - st.tSend) / .3), dy: 22, dx: 10 });
  const n = ease((t - st.tNo) / .25);
  if (n > 0) { rect(W / 2 - 40, 30, 80, 16, C.bg, .8 * n); frame(W / 2 - 40, 30, 80, 16, C.lime, n, .8);
    text('NO RESTART', W / 2, 38, { size: 9, font: 'head', col: C.lime, alpha: n, outline: false }); }
  text('new code appears in the running game', W / 2, 54, { size: 6.5, col: C.yellow, alpha: ease((t - st.tAppear) / .3) });
  const h = ease((t - st.tHalf) / .3);
  if (h > 0) stat(18, 100, Math.round(500000 * easeOut((t - st.tHalf) / 1.2)).toLocaleString('en-US'), 'lines of GOAL', { size: 13, align: 'left', alpha: h });
}});

// ---- 6e: it wasn't free ----
shot({ t0: cue("It wasn't free", 391.3) - .1, chapter: CH, build(S) {
  const st = { ps: ps2(), ring: new THREE.Group() };
  S.scene.add(st.ps, gridFloor(60, 1, C.navy), st.ring);
  for (let i = 0; i < 12; i++) { const p = box(.1, .5, .1, i % 2 ? 'lime' : 'orange'); const a = i / 12 * Math.PI * 2; p.position.set(Math.cos(a) * 2.6, 1, Math.sin(a) * 2.6); p.rotation.z = (i % 2 ? .4 : -.4); st.ring.add(p); }
  st.tFreeze = cue('compiler freezing', 393.5); st.t15 = cue('15 minutes', 397); st.tSony = cue('Sony bought', 399.5); st.tDrop = cue('mostly dropped', 401); st.tShare = cue('could share code', 403);
  st.tOne = cue('one studio had built', 406.4);
  st.hits = [st.t15, st.tOne];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(0, .7, 0), 7.5, .8 + (t - S.t0) * .05, 2.6);
  st.ring.visible = t > st.tOne; st.ring.rotation.y = t * .6; st.ring.scale.setScalar(pop(t, st.tOne, .5));
}, draw(st, t, S) {
  const a = ease((t - S.t0 - .2) / .3) * (1 - ease((t - st.tOne) / .3));
  text("IT WASN'T FREE", 18, 34, { size: 10, font: 'head', align: 'left', col: C.orange, alpha: a });
  const f = ease((t - st.tFreeze) / .3) * (1 - ease((t - st.tSony) / .3));
  if (f > 0) {
    const m = Math.min(15, (t - st.tFreeze) * 3.2), mm = Math.floor(m), ss = Math.floor((m - mm) * 60);
    rect(18, 46, 120, 30, C.bg, .85 * f); frame(18, 46, 120, 30, C.slate, f);
    text('compiler: cleaning up memory...', 24, 54, { size: 6, col: C.silver, align: 'left', alpha: f, outline: false });
    text(`${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, 24, 67, { size: 11, font: 'head', col: m >= 15 ? C.red : C.white, align: 'left', alpha: f, outline: false });
    text('up to 15 min', 132, 67, { size: 6, col: C.orange, align: 'right', alpha: ease((t - st.t15) / .3) * f, outline: false });
  }
  const s = ease((t - st.tSony) / .3) * (1 - ease((t - st.tOne) / .3));
  text('SONY BUYS NAUGHTY DOG', 18, 54, { size: 8, font: 'head', align: 'left', alpha: s });
  text('GOAL mostly dropped', 18, 66, { size: 7, col: C.red, align: 'left', alpha: s * ease((t - st.tDrop) / .3) });
  text('no one else could share the code', 18, 76, { size: 6.5, col: C.silver, align: 'left', alpha: s * ease((t - st.tShare) / .3) });
  const o = ease((t - st.tOne) / .4);
  text('ONE LANGUAGE', W / 2, 36, { size: 12, font: 'head', weight: 900, col: C.lime, alpha: o });
  text('built around one console', W / 2, 49, { size: 7, col: C.silver, alpha: o });
}});

// 10:00 - 11:12  What they had in common; why it took five years; outro.
import { THREE, C, shot, cue, ease, easeOut, easeIn, seg, pop, clamp, lerp, V, text, stat, tag, rect, line, frame, project, facet, flat, box, rng, W, H, hud, card } from '../engine.js';
import { ps2, memory, disc, chip, city, colossus, car, person, gridFloor, orbit, pixelQuad, building } from '../models.js';

// ---- 9a: four studios, one idea: never ask the PS2 to do what it's bad at ----
shot({ t0: cue("So now let's take a look", 600.3) - .1, build(S) {
  const st = { pillars: [] };
  S.scene.add(gridFloor(80, 1, C.navy));
  const icons = [
    () => { const c = city(3, 3, { lot: .7, seed: 2, hMin: .2, hMax: .9 }); c.lots.forEach(L => L.ghost.visible = false); return c; },
    () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) g.add(box(.9 - (i % 2) * .3, .08, .08, i % 3 === 2 ? 'orange' : 'lime', [(i % 2) * .15, .1 + i * .18, 0])); return g; },
    () => { const g = new THREE.Group(); g.add(box(.5, .5, .5, 'cyan', [0, .25, 0])); for (let i = 0; i < 10; i++) g.add(box(.08, .08, .08, 'yellow', [Math.cos(i) * .5, .6 + (i % 4) * .15, Math.sin(i * 1.7) * .4])); return g; },
    () => { const c = colossus(.12); return c; },
  ];
  ['ROCKSTAR', 'NAUGHTY DOG', "TRAVELLER'S TALES", 'TEAM ICO'].forEach((n, i) => {
    const p = new THREE.Group(); p.add(box(1.8, .4, 1.8, 'black', [0, .2, 0]));
    const ic = icons[i](); ic.position.y = .45; p.add(ic); p.icon = ic;
    p.position.set((i - 1.5) * 5.0, 0, 0); S.scene.add(p); st.pillars.push(p);
  });
  st.tCommon = cue('had in common', 602.5); st.tNot = cue('Not one of them', 603.4); st.tBad = cue('bad at', 605.8);
  st.times = [cue('Rockstar decided', 606.4), cue('Naughty Dog built', 608.8), cue("Traveller's Tales handed", 611.3), cue('And Team Ico', 614.6)];
  st.tFur = cue('into fur', 619.8); st.tLight = cue('light', 620.6); st.tMotion = cue('and motion', 621);
  st.hits = [...st.times];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(0, .8, 0), 16, Math.sin((t - S.t0) * .12) * .1, 3.4);
  st.pillars.forEach((p, i) => { const on = t > st.times[i]; p.position.y = on ? ease((t - st.times[i]) / .3) * .35 : 0; p.icon.rotation.y = t * (on ? .8 : .15); });
}, draw(st, t, S) {
  const a = ease((t - st.tNot) / .3) * (1 - ease((t - st.times[0]) / .3));
  text('NOT ONE OF THEM ASKED THE PS2', W / 2, 34, { size: 8.5, font: 'head', alpha: a });
  text("to do something it was bad at", W / 2, 45, { size: 7, col: C.orange, alpha: a * ease((t - st.tBad) / .3) });
  const notes = ["decided what didn't need to exist", "built the tools Sony didn't give them", 'used a processor most games ignored', 'turned "draw it again" into'];
  st.pillars.forEach((p, i) => {
    const [x] = project(p.position.clone(), S.cam), b = ease((t - st.times[i]) / .3);
    card(['logo_rockstar_north', 'logo_naughty_dog', 'logo_tt', 'sotc_cover'][i], x, 58, i === 1 ? 40 : 24, t, { t0: st.times[i], align: 'center', bg: i === 0 ? C.white : undefined });
    text(['ROCKSTAR', 'NAUGHTY DOG', "TRAVELLER'S TALES", 'TEAM ICO'][i], x, 112, { size: 5.8, font: 'head', alpha: .35 + .65 * b, noKinetic: b >= 1 || b <= 0 });
    const words = notes[i].split(' '), half = Math.ceil(words.length / 2);
    text(words.slice(0, half).join(' '), x, 121, { size: 5.3, col: C.silver, alpha: b });
    text(words.slice(half).join(' '), x, 128, { size: 5.3, col: C.silver, alpha: b });
  });
  const [fx] = project(st.pillars[3].position, S.cam);
  [[st.tFur, 'fur'], [st.tLight, 'light'], [st.tMotion, 'motion']].forEach(([tc, s], i) => text(s, fx - 16 + i * 16, 136, { size: 6.5, col: C.yellow, alpha: ease((t - tc) / .2) }));
}});

// ---- 9b: why five years? a thin manual, then knowledge travelling between studios ----
shot({ t0: cue('So the question is', 621.7) - .1, build(S) {
  S.fogNear = 40; S.fogFar = 90;
  const st = { studios: [], roads: [] };
  S.scene.add(box(40, .1, 28, [C.bg, C.dark, C.dark], [0, -.05, 0]), gridFloor(80, 2, C.navy));
  // an open, nearly blank manual
  st.book = new THREE.Group();
  const pageL = box(1.5, .06, 2.0, 'white', [-.78, .2, 0]), pageR = box(1.5, .06, 2.0, 'white', [.78, .2, 0]);
  pageL.rotation.z = .12; pageR.rotation.z = -.12; st.book.add(pageL, pageR, box(3.2, .1, 2.2, 'blue', [0, .08, 0]));
  for (let i = 0; i < 3; i++) st.book.add(box(1.0 - i * .25, .02, .08, 'grey', [-.8, .28 + i * .0, -.6 + i * .3]));
  st.book.position.set(0, .1, 3); S.scene.add(st.book);
  const r = rng(31), P = [[-9, -4], [-4, -7], [2, -6], [8, -3], [10, 3], [4, 5], [-3, 6], [-9, 3], [0, -1]];
  P.forEach(([x, z], i) => {
    const b = building(1.3 + r() * .6, 1.2 + r() * 1.6, 1.3, ['grey', 'teal', 'red', 'blue', 'white'][i % 5], i + 40, .5);
    b.position.set(x, 0, z); S.scene.add(b);
    const beacon = box(.3, .3, .3, 'grey', [x, b.children[0].scale.y + .45, z]); S.scene.add(beacon);
    st.studios.push({ x, z, beacon, h: b.children[0].scale.y });
  });
  const E = [[8, 0], [8, 2], [8, 5], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [8, 6], [8, 3]];
  E.forEach(([a, b]) => { const A = P[a], B = P[b], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const road = box(len, .04, .35, 'black', [(A[0] + B[0]) / 2, .02, (A[1] + B[1]) / 2]); road.rotation.y = -Math.atan2(B[1] - A[1], B[0] - A[0]); S.scene.add(road);
    const orb = box(.28, .28, .28, 'yellow'); orb.visible = false; S.scene.add(orb); st.roads.push({ a, b, orb }); });
  st.tFive = cue('five years', 623.6); st.tManual = cue('in a manual', 625.2); st.tThin = cue('thin', 628); st.tDiscover = cue('had to be discovered', 633.5);
  st.tOne = cue('usually by one studio', 634.6); st.tSpread = cue('quietly spread', 636.5); st.tSony = cue("Sony's own engineers", 640); st.tYears = cue('years after launch', 644.5);
  st.hits = [];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0, map = ease((t - st.tDiscover) / 1.4);
  st.book.visible = map < .98;
  st.book.position.y = .1 + Math.sin(t * 1.5) * .05;
  orbit(S.cam, V(lerp(0, 0, map), lerp(.6, 0, map), lerp(3, 0, map)), lerp(5.5, 21, map), .2 + lt * .02, lerp(3.2, 15, map));
  // knowledge: starts at studio 8 (centre), each studio learns a moment after an orb reaches it
  const learned = st.studios.map(() => Infinity); if (t > st.tOne) learned[8] = st.tOne;
  for (let pass = 0; pass < 4; pass++) st.roads.forEach(({ a, b }) => {
    const [from, to] = learned[a] <= learned[b] ? [a, b] : [b, a];
    if (learned[from] < Infinity) learned[to] = Math.min(learned[to], Math.max(learned[from], st.tSpread) + 1.4);
  });
  st.studios.forEach((s, i) => { const on = t > learned[i]; s.beacon.material = facet(on ? 'yellow' : 'grey'); s.beacon.position.y = s.h + .45 + (on ? Math.abs(Math.sin(t * 3 + i)) * .12 : 0); });
  st.roads.forEach(({ a, b, orb }) => {
    const [from, to] = learned[a] <= learned[b] ? [a, b] : [b, a];
    const t0 = Math.max(learned[from], st.tSpread), k = (t - t0) / 1.4;
    orb.visible = k > 0 && k < 1 && learned[from] < Infinity;
    const A = st.studios[from], B = st.studios[to];
    orb.position.set(lerp(A.x, B.x, k), .35 + Math.sin(k * Math.PI) * .8, lerp(A.z, B.z, k)); orb.rotation.y = t * 4;
  });
}, draw(st, t, S) {
  const a = ease((t - st.tFive) / .3) * (1 - ease((t - st.tManual) / .3));
  text('WHY DID IT TAKE', W / 2, 30, { size: 8, font: 'head', col: C.silver, alpha: ease((t - S.t0) / .3) * (1 - ease((t - st.tManual) / .3)) });
  text('5 YEARS?', W / 2, 46, { size: 18, font: 'head', weight: 900, alpha: a });
  const b = ease((t - st.tManual) / .3) * (1 - ease((t - st.tDiscover) / .3));
  text('NONE OF THIS WAS IN THE MANUAL', W / 2, 30, { size: 8.5, font: 'head', alpha: b });
  text('thin, incomplete docs · no standard way', W / 2, 41, { size: 6.5, col: C.silver, alpha: b * ease((t - st.tThin) / .3) });
  const c = ease((t - st.tDiscover) / .3) * (1 - ease((t - st.tSony) / .3));
  text('DISCOVERED BY ONE STUDIO', W / 2, 30, { size: 8.5, font: 'head', col: C.yellow, alpha: c });
  text('then spread through talks, papers, people moving jobs', W / 2, 41, { size: 6.5, col: C.silver, alpha: c * ease((t - st.tSpread) / .3) });
  const d = ease((t - st.tSony) / .3);
  text('SONY STILL TEACHING IT', W / 2, 30, { size: 8.5, font: 'head', alpha: d });
  text('talks on the VUs and GS, years after launch', W / 2, 41, { size: 6.5, col: C.silver, alpha: d * ease((t - st.tYears) / .3) });
}});

// ---- 9c: hardware finished in 2000, knowledge finished at the end of its life ----
shot({ t0: cue('The hardware was finished', 645.6) - .1, build(S) {
  const st = { mem: memory(8, 4, .32, .06, 'navy') };
  st.mem.position.set(0, -.2, 0); S.scene.add(st.mem, gridFloor(80, 1, C.navy));
  st.tHw = cue('finished in 2000', 646.8); st.tKnow = cue('The knowledge', 647.6); st.tLife = cue('end of its life', 650);
  st.tGap = cue('biggest gaps', 652.5); st.tBetter = cue('better hardware', 657.7); st.tKnew = cue('finally knew', 660); st.tRight = cue('right up against them', 662.2);
  st.hits = [st.tKnew, st.tRight];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(0, 1.6, 0), lerp(7.5, 5.8, ease((t - st.tKnew) / 2)), .3 + (t - S.t0) * .03, .6);
  const fill = ease((t - st.tKnew) / 2.5);
  st.mem.cells.forEach((c, i) => c.material = facet(i / 32 < fill ? (i === 31 && t > st.tRight ? 'yellow' : 'cyan') : 'navy'));
}, draw(st, t, S) {
  const a = ease((t - st.tHw) / .3) * (1 - ease((t - st.tKnew) / .3));
  if (a > 0) {
    const x0 = 40, x1 = W - 40, yr = y => x0 + (y - 2000) / 5 * (x1 - x0);
    for (let y = 2000; y <= 2005; y++) text(String(y), yr(y), 38, { size: 6, col: C.silver, alpha: a });
    text('HARDWARE', x0 - 4, 48, { size: 6, align: 'right', alpha: a }); rect(x0, 45, (x1 - x0), 5, C.dark, a); rect(x0, 45, 3, 5, C.lime, a);
    text('done', x0 + 6, 48, { size: 5.5, col: C.lime, align: 'left', alpha: a });
    const kw = ease((t - st.tKnow) / 2.6);
    text('KNOWLEDGE', x0 - 4, 60, { size: 6, align: 'right', alpha: a }); rect(x0, 57, (x1 - x0), 5, C.dark, a); rect(x0, 57, (x1 - x0) * kw, 5, C.yellow, a);
    const g = ease((t - st.tGap) / .3);
    card('rr5_cover', x0 + 8, 86, 22, t, { t0: st.tGap, t1: st.tKnew, align: 'center' });
    card('sotc_cover', x1 - 8, 86, 22, t, { t0: st.tGap + .3, t1: st.tKnew, align: 'center' });
    text('first games', x0, 72, { size: 6, col: C.silver, alpha: a * g }); text('last games', x1, 72, { size: 6, col: C.silver, alpha: a * g });
    line(x0 + 20, 72, x1 - 22, 72, C.orange, a * g, .8);
    text('one of the biggest gaps of any console', W / 2, 82, { size: 6.5, col: C.orange, alpha: a * g });
  }
  const b = ease((t - st.tBetter) / .3) * (1 - ease((t - st.tKnew) / .3));
  text('NOT BETTER HARDWARE', W / 2, 100, { size: 9, font: 'head', col: C.silver, alpha: b });
  const c = ease((t - st.tKnew) / .3);
  text('PEOPLE WHO KNEW EXACTLY WHERE THE LIMITS WERE', W / 2, 34, { size: 7.5, font: 'head', alpha: c });
  text('...and built right up against them', W / 2, 45, { size: 7, col: C.yellow, alpha: ease((t - st.tRight) / .3) });
}});

// ---- 10: outro ----
shot({ t0: cue('But for now', 663.3) - .1, build(S) {
  const st = { parts: [] };
  S.scene.add(gridFloor(80, 1, C.navy));
  const P = ps2(); S.scene.add(P); st.ps = P;
  P.children.forEach((c, i) => st.parts.push({ c, home: c.position.clone(), dir: V(Math.sin(i * 2.4), .6 + (i % 5) * .3, Math.cos(i * 1.7)).multiplyScalar(1.4) }));
  st.tSub = cue('consider subscribing', 666.5); st.tPiece = cue('piece by piece', 669.5);
  st.hits = [st.tSub, st.tPiece];
  return st;
}, update(st, t, S) {
  orbit(S.cam, V(0, .8, 0), 8, .4 + (t - S.t0) * .1, 2.6);
  const k = easeOut((t - st.tPiece + .8) / 1.5);
  st.parts.forEach(p => { p.c.position.copy(p.home).addScaledVector(p.dir, k); p.c.rotation.y = k * p.dir.x; });
}, draw(st, t, S) {
  const a = ease((t - st.tSub) / .3);
  if (a > 0) { const s = pop(t, st.tSub, .4);
    hud.save(); hud.translate(W / 2, 60); hud.scale(s, s);
    rect(-42, -10, 84, 20, C.red, a); frame(-42, -10, 84, 20, C.orange, a, .8);
    text('SUBSCRIBE', 0, 0, { size: 9, font: 'head', weight: 900, alpha: a, outline: false }); hud.restore(); }
  text('Images via Wikipedia / Wikimedia Commons · PS2 photos: Evan-Amos (PD)', W / 2, 160, { size: 4.4, col: C.slate, outline: false, alpha: ease((t - S.t0) / .5) });
  text('Andy Gavin: Jkay747 (CC BY-SA 3.0) · Fumito Ueda: AI Dreamy (CC BY-SA 4.0)', W / 2, 166, { size: 4.4, col: C.slate, outline: false, alpha: ease((t - S.t0) / .5) });
  text('DMA Design team: Steve Hammond (CC BY-SA 2.0) · EE chip (CC BY-SA 3.0) · game art © respective publishers', W / 2, 172, { size: 4.4, col: C.slate, outline: false, alpha: ease((t - S.t0) / .5) });
  text('systems, opened up piece by piece', W / 2, 80, { size: 7, col: C.silver, alpha: ease((t - st.tPiece) / .3) });
}});

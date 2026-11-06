// 1:18 - 2:08  Liberty City: 130 MB of data vs 32 MB memory; only what the player sees needs to exist.
import { THREE, C, shot, cue, ease, easeOut, seg, pop, clamp, lerp, V, text, stat, tag, rect, line, frame, project, facet, flat, box, rng, W, H, card } from '../engine.js';
import { memory, city, car, gridFloor, orbit, ground } from '../models.js';

// ---- 3a: GTA III, Liberty City = 130 MB (77 models, 45 textures, rest) ----
shot({ t0: cue('Take', 79.3) - .9, build(S) {
  S.fogNear = 22; S.fogFar = 48;
  const st = { city: city(9, 7, { seed: 11 }) };
  S.scene.add(st.city, ground(40, 30, 'black'));
  st.tGta = cue('Grand Theft Auto III', 79.6); st.tLib = cue('Liberty City', 83); st.t130 = cue('130 megabytes', 84.8);
  st.t77 = cue('77 megabytes', 86.6); st.t45 = cue('45 megabytes', 88.9); st.tRest = cue('the rest', 90.8);
  st.hits = [st.tGta, st.t130];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  orbit(S.cam, V(0, 0, 0), lerp(15, 12, ease(lt / 10)), .6 + lt * .035, lerp(11, 8, ease(lt / 10)));
  st.city.lots.forEach((L, i) => { const s = pop(t, S.t0 + .1 + (i % 13) * .04 + Math.floor(i / 13) * .05, .4); L.solid.scale.set(1, Math.max(s, .01), 1); L.ghost.visible = false; });
}, draw(st, t, S) {
  const a = ease((t - st.tGta) / .4);
  text('GRAND THEFT AUTO III', 18, 30, { size: 10, font: 'head', align: 'left', alpha: a });
  text('2001', 18, 41, { size: 7, col: C.yellow, align: 'left', alpha: a });
  card('gta3_cover', 18, 50, 46, t, { t0: st.tGta });
  card('gta3_walk', W - 18, 40, 84, t, { t0: st.tLib, t1: st.tRest + 1.4, align: 'right', label: 'LIBERTY CITY', sub: 'Grand Theft Auto III' });
  const b = ease((t - st.tLib) / .4);
  text('LIBERTY CITY', W - 18, 30, { size: 8, font: 'head', align: 'right', alpha: b });
  const c = ease((t - st.t130) / .4);
  if (c > 0) {                              // stacked data bar, 130 MB across 260 px (2 px per MB)
    const x0 = 30, y = 138, s = 2;
    stat(x0 + 130, y - 20, '130', 'MB of city data', { size: 13, alpha: c });
    rect(x0, y, 130 * s, 9, C.dark, c);
    const parts = [[st.t77, 77, C.sky, '77 MB 3D models'], [st.t45, 45, C.orange, '45 MB textures'], [st.tRest, 8, C.silver, 'rest']];
    let x = x0;
    for (const [tc, mb, col, lab] of parts) {
      const k = easeOut((t - tc) / .6);
      rect(x, y, mb * s * k, 9, col, c);
      text(lab, x + mb * s / 2, y + 16, { size: 6, col, alpha: ease((t - tc) / .3) });
      x += mb * s;
    }
  }
}});

// ---- 3b: that's 4x the whole memory, and memory also needs code, sound, cars, people, the frame ----
shot({ t0: cue("That's four times", 92.2) - .1, build(S) {
  const st = { mems: [0, 1, 2, 3].map(() => memory(8, 4, .26, .05, 'blue')) };
  st.mems.forEach((m, i) => { m.position.set((i - 1.5) * 3.0, .3, 0); S.scene.add(m); });
  S.scene.add(gridFloor(80, 1, C.navy));
  st.tFour = cue('four times', 92.5); st.tNeeds = cue('still needs room', 95.5);
  st.items = [['code', 'lime', 4], ['sound', 'orange', 3], ['cars', 'red', 3], ['people', 'plum', 3], ['frame', 'cyan', 4]]
    .map(([w, r, n], i) => ({ w, r, n, t: cue(w === 'code' ? "game's code" : w === 'people' ? 'people walking' : w === 'frame' ? 'frame being drawn' : 'the ' + w, 96 + i * 1.2) }));
  st.tNever = cue('never be in memory', 102.5);
  st.hits = [st.tFour, st.tNever];
  return st;
}, update(st, t, S) {
  const k = ease((t - st.tNeeds) / 1.2);
  orbit(S.cam, V(lerp(0, -4.5, k), 1, 0), lerp(10, 5.2, k), 0, lerp(2.2, 1.1, k));
  st.mems.forEach((m, i) => { m.visible = i === 0 || t > st.tFour + i * .2; m.cells.forEach(c => c.material = facet('blue')); });
  let cell = 0;
  for (const it of st.items) for (let j = 0; j < it.n; j++, cell++) if (t > it.t + j * .05) st.mems[0].cells[cell].material = facet(it.r);
  if (t > st.tNever) st.mems.slice(1).forEach((m, i) => m.position.y = .3 + Math.sin((t - st.tNever) * 9 + i) * .04);
}, draw(st, t, S) {
  const a = ease((t - st.tFour) / .4) * (1 - ease((t - st.tNeeds) / .4));
  text('THE CITY = 4x ALL OF MEMORY', W / 2, 36, { size: 9, font: 'head', alpha: a });
  st.items.forEach((it, i) => {
    const b = ease((t - it.t) / .3);
    rect(W - 92, 34 + i * 12, 5, 5, facet(it.r).uniforms.c1.value.getStyle(), b);
    text(it.w, W - 83, 36.5 + i * 12, { size: 7, align: 'left', alpha: b });
  });
  const c = ease((t - st.tNever) / .3);
  text('never all at once', W - 92, 102, { size: 7, col: C.orange, align: 'left', alpha: c });
}});

// ---- 3c: only what the player sees needs to exist; swap the rest in and out ----
shot({ t0: cue('While we go through this', 104) - .1, build(S) {
  S.fogNear = 30; S.fogFar = 70;
  const st = { city: city(15, 15, { seed: 23, lot: 2.4 }), car: car('yellow', 1.4) };
  S.scene.add(st.city, st.car, ground(60, 60, 'black'));
  const river = box(60, .06, 3.6, [C.navy, C.blue, C.blue], [0, .01, -10.8]); S.scene.add(river);
  st.city.lots.forEach(L => { if (Math.abs(L.z + 10.8) < 2.2) { L.solid.visible = false; L.ghost.visible = false; L.river = true; } });
  st.tSmall = cue('small part of the city', 107.5); st.tStreet = cue('The street', 109.6); st.tSky = cue('skyline', 112.5);
  st.tBehind = cue('behind the next corner', 113.4); st.tRiver = cue('across the river', 115.5); st.tNot = cue("doesn't need to exist", 116.5);
  st.tSwap = cue('swapped the rest', 121.4); st.tBig = cue('far bigger', 124.2); st.tTrick = cue('The trick', 125.4);
  st.hits = [st.tNot, st.tBig];
  return st;
}, update(st, t, S) {
  const lt = t - S.t0;
  const cz = 12 - lt * .75;                          // car drives up the avenue (-z)
  st.car.position.set(1.2, 0, cz); st.car.rotation.y = Math.PI / 2;
  const radius = t < st.tNot ? 60 : lerp(60, 7.5, ease((t - st.tNot) / 1.2));
  st.city.lots.forEach(L => {
    if (L.river) return;
    const d = Math.hypot(L.x - 1.2, L.z - cz), inView = d < radius;
    L.solid.visible = inView; L.ghost.visible = !inView;
    if (inView && radius < 20) L.solid.scale.y = ease((radius - d) / 1.5);
    else L.solid.scale.y = 1;
  });
  // camera: chase -> high reveal -> low "player view"
  const up = ease((t - st.tBig) / 2) * (1 - ease((t - st.tTrick - .3) / 1.4));
  const chase = V(1.2 + 2.5, 10 + up * 22, cz + 7 + up * 8);
  S.cam.position.copy(chase); S.cam.lookAt(1.2, 0, cz - 3 + up * 2);
  S.fogNear = lerp(30, 6, ease((t - st.tTrick) / 1.2)); S.fogFar = lerp(70, 16, ease((t - st.tTrick) / 1.2));
}, draw(st, t, S) {
  const a = ease((t - st.tSmall) / .4) * (1 - ease((t - st.tNot) / .4));
  text('THE PLAYER ONLY SEES A SMALL PART', W / 2, 30, { size: 7.5, font: 'head', alpha: a });
  const b = ease((t - st.tNot) / .4) * (1 - ease((t - st.tSwap) / .4));
  text("EVERYTHING ELSE DOESN'T NEED TO EXIST", W / 2, 30, { size: 7.5, font: 'head', col: C.silver, alpha: b });
  text('...not yet', W / 2, 41, { size: 7, col: C.yellow, alpha: b * ease((t - st.tNot - 1) / .3) });
  const c = ease((t - st.tSwap) / .4) * (1 - ease((t - st.tTrick) / .4));
  text('SWAP IT IN AND OUT AS YOU MOVE', W / 2, 30, { size: 7.5, font: 'head', col: C.cyan, alpha: c });
  const d = ease((t - st.tTrick) / .4);
  text('...WITHOUT THE PLAYER NOTICING', W / 2, 30, { size: 7.5, font: 'head', col: C.yellow, alpha: d });
  tag(S.cam, st.car.position.clone().add(V(0, .7, 0)), 'player', { alpha: ease((t - st.tStreet) / .3) * (1 - ease((t - st.tBig) / .3)), dy: -14, dx: -14, col: C.yellow });
}});

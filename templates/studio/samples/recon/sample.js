// Sample (3D reconstruction): US Airways Flight 1549, 15 January 2009, in five shots on the sample narration (~20 s,
// audio/timeline.json). The take-off on the grey map, the bird strike at real scale, the turn back to the Hudson, the
// ditching, the rescue. Metres, y up (the map shots: 1 unit = 1 km). Every element lands on its word (cue), every shot moves
// (the aircraft, the geese, the water, an eased camera), people declare S.collide, the flying things userData.airborne.
// 9:16: the wide shots step back (tallKeys / tallOff, flight1549.js) so the aircraft is whole in the narrow frame.
import { shot, cue, THREE, E, ease, seg, clamp, lerp, chapter, place, tag, timecard, big, C, FW, FH } from '../engine.js';
import { airliner, goose, cast, wingCrowd, particles, hash, nycMap, ll, ENG } from '../models.js';
import { personCaps } from '../lib/collide.js';
import { V, ENGZ, ROUTE, uOfWay, flyAt, kmV, mapWorld, MAP_LIFT, routeLine, mapLabels, clock, riverWorld, restOn, rv, FLOAT, fullPlane, fullFerry, TALL, tallKeys, tallOff } from './flight1549.js';

const T2 = cue('About', 3.78) - .15, T3 = cue('With', 7.24) - .15, T4 = cue('After', 11.08) - .15, T5 = cue('Ferries', 15.5) - .15;
const STRIKE = cue('struck', 5.68), TOUCH = cue('touched', 13.94);
const U_STRIKE = uOfWay(5);

// ---- 1. the take-off from LaGuardia, on the grey map of New York ----
shot({ t0: 0, trans: 'cut', name: 'take-off', build(S) {
  const p = mapWorld(S, { target: [7, 0, -2], area: 7 });
  const uAt = t => ease(t, .2, T2 + .3, E.inOutSine) * U_STRIKE * .62;
  S.over(chapter('Reconstruction · 15 January 2009', 'US Airways Flight 1549', { t0: cue('January', .68) - .1 }));
  S.over(routeLine(uAt, { t0: 0 }));
  S.over(mapLabels({ t0: .4, skip: ['NEW JERSEY', 'MANHATTAN'] }));
  S.over(place(kmV([40.7769, -73.874]), 'LAGUARDIA', { t0: cue('1549', 2.02) - .1, dx: 18, dy: 16 }));
  return { p, uAt };
}, update(st, t, S) {
  // the camera rides with the aircraft (its position only, never its heading), eased from a low side view to a higher one
  const P = flyAt(st.p, st.uAt(t), MAP_LIFT), k = E.inOutSine(seg(t, 0, T2)), aim = P.clone().add(V(0, MAP_LIFT * .5, 0));
  S.cam.position.copy(aim).add(V(lerp(2.2, 1.6, k), lerp(1.5, 2.3, k), lerp(3.1, 3.4, k))); S.cam.lookAt(aim); S.look.copy(aim);
  if (S.cam.fov !== 38) { S.cam.fov = 38; S.cam.updateProjectionMatrix(); }
} });

// ---- 2. about two minutes later, 2,818 ft over the Bronx: the flock (real scale, 1 unit = 1 m, the strike point is the origin) ----
const VEL = 77, planeAt = t => V(0, 859 + (t - STRIKE) * 7, -(t - STRIKE) * VEL), PITCH = .12;
const planeMat = t => { const m = new THREE.Object3D(); m.position.copy(planeAt(t)); m.rotation.set(PITCH, 0, 0); m.updateMatrixWorld(true); return m; };
shot({ t0: T2, trans: 'cut', name: 'bird strike', build(S) {
  S.studio({ floor: false, near: 1, far: 16000, fog: [3000, 7000], area: 60, key: [-400, 900, 300], soft: 4, keyI: 1.6, shadowFar: 3000 });
  S.sky('#b9c7d4', '#e4e4df', '#dcdcd7'); S.post.ao = 1.2;
  // the grey map of New York below, at real scale (the strike point under the aircraft)
  const map = nycMap(S.scene), [sx, sy] = ll(40.84, -73.879); map.scale.setScalar(1000); map.position.set((-1 - sx) * 1000, 0, -(2 - sy) * 1000);
  const p = airliner(S.scene, { mat: new THREE.MeshStandardMaterial({ color: 0x8fb0e4, roughness: .62 }) }); p.userData.airborne = true; p.name = 'Flight 1549';
  S.tick(t => { p.position.copy(planeAt(t)); p.rotation.set(PITCH, 0, 0); S.followKey(p.position); });
  // the flock: every goose flies a straight line at 15 m/s across the climb; two are solved backwards from the engine intakes at
  // the strike and end inside a burst of down; the others pass clear of the airframe (above the fin, below the belly, past the
  // far wingtip), flare and dive away. Nothing pops: the struck ones vanish inside the burst.
  const ps = planeMat(STRIKE), hits = [ps.localToWorld(V(-ENG.x, ENG.y, ENGZ - 2.4)), ps.localToWorld(V(ENG.x, ENG.y, ENGZ - 2.4))], VB = V(-15, -.6, 0), birds = [];
  for (let i = 0; i < 11; i++) {
    const b = goose(S.scene); b.scale.setScalar(1.3); b.userData.airborne = true; b.name = 'Canada goose'; birds.push(b);
    const lane = i % 3, lx = lane === 0 ? 21 + hash(i, 1) * 9 : 3 + hash(i, 1) * 14, ly = lane === 0 ? (hash(i, 2) - .5) * 6 : lane === 1 ? 12 + hash(i, 2) * 4 : -7.5 - hash(i, 2) * 4;
    const hit = i < 2, aim = hit ? hits[i] : ps.localToWorld(V(lx, ly, ENGZ - 2.4 + (hash(i, 3) - .5) * 10));
    Object.assign(b.userData, { hit, aim, ph: hash(i, 4) * 6 });
  }
  const NF = 220, fl = particles(S.scene, NF * 2, { color: 0xf4f1ea }), fd = particles(S.scene, NF * 2, { color: 0x7d776d, opacity: .7 });
  const NP = 110, smoke = particles(S.scene, NP * 2, { color: 0x9a9c9e, opacity: .42 });
  S.tick(t => {
    birds.forEach((b, i) => { const { hit, aim, ph } = b.userData, dt = t - STRIKE, P = aim.clone().addScaledVector(VB, dt);
      if (hit) { b.visible = dt < 0; b.position.copy(P); b.lookAt(P.clone().add(VB)); b.rotateY(Math.PI); b.userData.flap(t + ph, 0); return; }
      if (dt > -.35) { const k = dt + .35, out = aim.clone().sub(planeAt(STRIKE)).setY(0).normalize(), e = Math.min(1, k * 2.5);
        P.addScaledVector(out, 2.5 * k * k).add(V(0, -3 * k * k, 0)); b.position.copy(P); b.lookAt(P.clone().add(VB)); b.rotateY(Math.PI);
        b.rotateZ(e * .6 * (hash(i, 6) < .5 ? -1 : 1)); b.rotateX(-e * .35); b.userData.flap(t * 1.4 + ph, Math.min(1, k * 4) * (1 - seg(k, .5, 1)));
      } else { b.position.copy(P); b.lookAt(P.clone().add(VB)); b.rotateY(Math.PI); b.userData.flap(t + ph, 0); } });
    hits.forEach((H, j) => { for (let i = 0; i < NF; i++) { const age = t - STRIKE - hash(i, 7) * .12, idx = j * NF + i;
      if (age <= 0 || age > 2.6) { fl.userData.set(idx, 0, -1e4, 0, 0, 0); fd.userData.set(idx, 0, -1e4, 0, 0, 0); continue; }
      const dir = V(hash(i, 8) - .5, hash(i, 9) - .5, hash(i, 10) - .5).normalize(), sp = 4 + hash(i, 11) * 16, k = 1 - Math.exp(-age * 2.2);
      const P = H.clone().addScaledVector(dir, sp * k / 2.2).add(V(0, -.36 * age * age, 0)), a = (1 - age / 2.6) * (age < .05 ? age / .05 : 1);
      (i % 5 ? fl : fd).userData.set(idx, P.x, P.y, P.z, .14 + hash(i, 12) * .3, a); (i % 5 ? fd : fl).userData.set(idx, 0, -1e4, 0, 0, 0); } });
    fl.userData.commit(); fd.userData.commit();
    [-1, 1].forEach((sd, j) => { for (let i = 0; i < NP; i++) { const born = STRIKE + .03 + Math.pow(i / NP, 1.6) * 1.15, age = t - born, idx = j * NP + i;
      if (age <= 0 || age > 3) { smoke.userData.set(idx, 0, -1e4, 0, 0, 0); continue; }
      const P = planeMat(born).localToWorld(V(sd * ENG.x, ENG.y, ENGZ + 3.4)).add(V((hash(i + j * 99, 13) - .5) * age * 2.4, (hash(i + j * 99, 14) - .3) * age * 1.8, (hash(i + j * 99, 15) - .5) * age * 2));
      smoke.userData.set(idx, P.x, P.y, P.z, 1.6 + age * 4.5, (1 - age / 3) * Math.min(1, age * 8) * (1 - i / NP * .8)); } });
    smoke.userData.commit();
  });
  // chase camera: a world offset from the aircraft (left, up, behind) eased between two framings, aimed ahead of the nose
  const K0 = { o: tallOff([-16, 6.8, 54], 1.7), f: TALL ? 30 : 62 }, K1 = { o: tallOff([-14.5, 6.2, 47], 1.7), f: TALL ? 28 : 58 };
  S.tick(t => { const k = E.inOutSine(seg(t, T2, T3)), o = K0.o.map((v, i) => lerp(v, K1.o[i], k)), P = planeAt(t);
    S.cam.position.set(P.x + o[0], P.y + o[1], P.z + o[2]); const L = V(P.x, P.y - 1, P.z - lerp(K0.f, K1.f, k)); S.cam.lookAt(L); S.look.copy(L);
    if (S.cam.fov !== 38) { S.cam.fov = 38; S.cam.updateProjectionMatrix(); } });
  S.over(tag(s => s.proj(birds[4].position), 'Canada geese', 'crossing the climb · about 8 lb each', { t0: cue('minutes', 4.54) - .1, t1: STRIKE + .3, line: true, dx: -560, dy: -70 }));
  S.over(clock(STRIKE, TOUCH, { t0: STRIKE }));
  return { p };
} });

// ---- 3. no thrust: the turn back south, toward the river (the map again, from the north) ----
shot({ t0: T3, trans: 'cut', name: 'the turn', build(S) {
  const p = mapWorld(S, { target: [0, 0, -4], area: 9 });
  const U1 = uOfWay(10), uAt = t => lerp(U_STRIKE, U1, ease(t, T3 + .1, T4 + .2, E.inOutSine));
  S.camera(tallKeys([{ t: T3, p: [5.2, 14.5, -14.5], l: [.2, 0, -4.6], fov: 40 }, { t: T4, p: [4.2, 13.6, -13.2], l: [-.4, 0, -3.9], fov: 40 }], 1.25, { l: [[.2, 0, -6.4], [-.4, 0, -5.7]] }));
  S.over(routeLine(uAt, { t0: T3 }));
  S.over(mapLabels({ t0: T3 + .2, skip: ['QUEENS'] }));
  S.over(timecard('15:27 · 2,818 ft', 'both engines lost · no thrust', { t0: cue('thrust', 8) - .1 }));
  S.over(place(kmV([40.769, -74.006]), 'HUDSON RIVER', { t0: cue('turned', 9.14) - .1, fill: C.accent, dx: 18, dy: 14 }));
  S.over(clock(STRIKE, TOUCH, { t0: T3 }));
  return { p, uAt };
}, update(st, t) { flyAt(st.p, st.uAt(t), MAP_LIFT); } });

// ---- 4. 208 seconds after the strike: nose up, wings level, onto the water (real scale, rest point = origin) ----
const sAt = t => (t < TOUCH ? -60 - 70 * (TOUCH - t) : -60 * Math.exp(-(t - TOUCH) * 1.15));
shot({ t0: T4, trans: 'cut', name: 'touchdown', build(S) {
  riverWorld(S, { area: 140 });
  const p = fullPlane(S);
  // spray: soft particles born on the hull where it is in the water at that moment, then left behind (never solid balls)
  const NC = 1400, curtain = particles(S.scene, NC, { color: 0xffffff, opacity: 1 }), NF = 500, foam = particles(S.scene, NF, { color: 0xffffff, opacity: .75 });
  S.tick(t => {
    const air = Math.max(0, TOUCH - t), settle = E.outCubic(seg(t, TOUCH, TOUCH + 2.4));
    p.position.copy(rv(sAt(t), 0, lerp(FLOAT + air * 3.2, FLOAT, settle))); p.rotation.order = 'YXZ'; p.rotation.set(lerp(.17, -.025, settle), Math.PI, 0);
    for (let i = 0; i < NC; i++) { const born = TOUCH - .1 + hash(i, 1) * 2, age = t - born, life = .9 + hash(i, 2) * 1.3;
      const v0 = Math.max(0, (sAt(born + .01) - sAt(born)) / .01) / 70;
      if (age <= 0 || age >= life || v0 < .08) { curtain.userData.set(i, 0, -1e4, 0, 0, 0); continue; }
      const sd = hash(i, 3) < .5 ? -1 : 1, along = sAt(born) - 2 - hash(i, 4) * 16, side = sd * (2.1 + hash(i, 5) * .5);
      const vo = (5 + hash(i, 6) * 11) * v0, vu = (1.6 + hash(i, 7) * 4.4) * v0, vb = (2 + hash(i, 8) * 6) * v0, y = vu * age - 4.9 * age * age;
      if (y < -.05) { curtain.userData.set(i, 0, -1e4, 0, 0, 0); continue; }
      const P = rv(along + vb * age, side + sd * vo * age, Math.max(.05, y)), a = (1 - age / life) * Math.min(1, age * 10);
      curtain.userData.set(i, P.x, P.y, P.z, (.22 + hash(i, 9) * .45) * (1 + age * 1.4), a * (.7 + .3 * v0)); }
    for (let i = 0; i < NF; i++) { const born = TOUCH + hash(i, 21) * 2.6, age = t - born;
      if (age <= 0) { foam.userData.set(i, 0, -1e4, 0, 0, 0); continue; }
      const sd = hash(i, 22) < .5 ? -1 : 1, P = rv(sAt(born) - hash(i, 23) * 20 + 2, sd * (1.8 + hash(i, 24) * 2.5 + Math.sqrt(age) * 1.6), .12);
      foam.userData.set(i, P.x, P.y, P.z, .5 + hash(i, 25) * .9 + age * .25, Math.min(1, age * 4) * Math.max(0, 1 - age / 9) * .8); }
    curtain.userData.commit(); foam.userData.commit();
    // the camera paces the aircraft from the New Jersey side (its position only, computed after it moved), slowing with it on
    // the water, then eases wider while it settles
    const k = E.inOutSine(seg(t, TOUCH, T5)), P = p.position;
    S.cam.position.copy(P).add(V(...tallOff([lerp(-58, -66, k), lerp(8, 11, k), lerp(24, 16, k)], 1.6))); const L = P.clone().add(V(0, 2, 6)); S.cam.lookAt(L); S.look.copy(L);
    if (S.cam.fov !== 34) { S.cam.fov = 34; S.cam.updateProjectionMatrix(); }
  });
  S.over(tag(s => s.proj(p.localToWorld(V(0, 2.4, -6))), 'Nose up, wings level', 'the tail touches first', { t0: cue('gliding', 12.8) - .1, line: true, dx: -140, dy: -230 }));
  S.over(clock(STRIKE, TOUCH, { t0: T4 }));
  return { p };
} });

// ---- 5. ferries alongside within minutes; everyone out on the wings ----
shot({ t0: T5, trans: 'cut', name: 'rescue', build(S) {
  riverWorld(S, { area: 70 });
  const p = fullPlane(S); restOn(p);
  const crowd = cast(p, 80), pax = wingCrowd(crowd); crowd.sync();
  const f1 = fullFerry(S, 'first ferry'), f2 = fullFerry(S, 'second ferry');
  S.tick(t => { const k = E.outCubic(seg(t, T5 - .4, T5 + 3.8)); f1.position.copy(rv(lerp(-230, -36, k), -44));
    const k2 = E.inOutSine(seg(t, T5, T5 + 4.6)); f2.position.copy(rv(lerp(-420, -170, k2), 46)); });
  S.collide = { bodies: () => pax.map((q, i) => ({ name: `passenger ${i + 1}`, caps: personCaps(q) })), solids: [] };
  S.camera(tallKeys([{ t: T5, p: rv(56, -74, 24).toArray(), l: rv(-16, -12, 2).toArray(), fov: 36 }, { t: 20, p: rv(48, -66, 21).toArray(), l: rv(-14, -12, 2).toArray(), fov: 36 }], 1.8, { up: 12 }));
  S.over(timecard('15:35 · Hudson River', 'NY Waterway ferries alongside', { t0: cue('Ferries', 15.5) - .1 }));
  S.over(big('155', 'ALL ON BOARD SURVIVED', { t0: cue('All', 17.44) - .1, color: C.accent, x: TALL ? FW / 2 : 1450, y: TALL ? FH * .3 : 870, size: 96 }));
  return { p };
} });

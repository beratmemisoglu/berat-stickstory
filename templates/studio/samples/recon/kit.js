// Kit (3D reconstruction): the style's elements, one per shot (2 s each), each on its usual ground: the clay airliner on
// a plinth, the realistic library figures (lib/figures.js: the roles the user dresses in Look > Characters), the clay
// mannequin crowd (models.js cast(): poses), the geese, the ferry on the river (with the clay city behind), the mannequins
// at real scale on a wing, the grey map with a route and place pins, the aircraft in the sky with a quote card. Restyle the
// elements here first, then the scenes.
// 9:16: the wide elements step back (tallKeys, flight1549.js) so each one is whole in the narrow frame.
import { shot, THREE, tag, place, timecard, quote } from '../engine.js';
import { airliner, plinth, mesh, cast, POSE, add, jitter, goose, wingCrowd } from '../models.js';
import { figure } from '../lib/figures.js';
import { personCaps } from '../lib/collide.js';
import { V, mapWorld, routeLine, mapLabels, flyAt, kmV, MAP_LIFT, riverWorld, restOn, rv, fullPlane, fullFerry, TALL, tallKeys } from './flight1549.js';

// ---- 1. the airliner: matte clay, on a display plinth ----
shot({ t0: 0, trans: 'cut', name: 'kit airliner', build(S) {
  S.studio({ key: [-6, 12, 9], area: 9, fog: [40, 110], near: .1, far: 200 });
  plinth(S.scene, 3.4, .6);
  const p = airliner(S.scene); p.scale.setScalar(.15); p.position.set(0, 1.55, 0); p.rotation.set(0, 2.0, 0); p.name = 'Airbus A320';
  mesh(new THREE.CylinderGeometry(.42, .55, 4.45, 24), new THREE.MeshStandardMaterial({ color: 0x9a9c99, roughness: .6 }), [0, -4.105, 1.2], [0, 0, 0], p);   // display post (plane space)
  // (far enough that the airframe spans under 60 % of the frame width: closer, contact.js takes the fuselage for the ground it
  // stands on. 9:16 is narrow, so it steps back further)
  S.camera(tallKeys([{ t: 0, p: [-7.7, 3.6, 8.1], l: [0, 1.3, 0], fov: 30 }], 2.75, { up: 5 }));
  S.over(tag(s => s.proj(p.localToWorld(V(0, 4.5, -6))), 'Airbus A320', 'matte clay · 37.6 m long', { t0: 0, line: true, dx: -330, dy: -200 }));
  return { p };
} });

// ---- 2. people: the realistic library figures (rigged, mocap), dressed per role ----
shot({ t0: 2, trans: 'cut', name: 'kit figures', build(S) {
  S.studio({ key: [5, 9, 7], area: 4, fog: [20, 60], near: .05, far: 80 });
  const a = figure('main', { parent: S.scene, x: -.55, z: 0, ry: .35 }), b = figure('witness', { parent: S.scene, x: .6, z: -.1, ry: -.45 });
  S.collide = { bodies: () => [{ name: 'main', caps: a.caps() }, { name: 'witness', caps: b.caps() }], solids: [] };
  S.camera([{ t: 2, p: [.1, 1.45, 4.3], l: [0, .95, 0], fov: 32 }]);
  return { a, b };
}, update(st, t) { st.a.act('stand', { t }); st.b.act('talk', { t }); } });

// ---- 3. the clay mannequin crowd (instanced: cheap enough for a full cabin), its poses ----
shot({ t0: 4, trans: 'cut', name: 'kit mannequins', build(S) {
  S.studio({ key: [5, 10, 8], area: 5, fog: [20, 70], near: .05, far: 80 });
  const crowd = cast(S.scene, 4), poses = [POSE.stand, POSE.wave, POSE.huddle, POSE.balance];
  const ppl = poses.map((q, i) => { const p = crowd.add({ x: (i - 1.5) * 1.15, z: i % 2 ? -.3 : 0, ry: (i - 1.5) * -.18, color: [0xf3f2ef, 0x7fa6e6, 0xeceae6, 0xf6f5f2][i] }); p.apply(add(q, jitter(i + 3, .3))); return p; });
  crowd.sync();
  S.collide = { bodies: () => ppl.map((p, i) => ({ name: `mannequin ${i + 1}`, caps: personCaps(p) })), solids: [] };
  S.camera(tallKeys([{ t: 4, p: [0, 1.6, 5.6], l: [0, .9, 0], fov: 34 }], 1.8));
  return { crowd };
} });

// ---- 4. Canada geese: hinged wings, a ~3 Hz wingbeat ----
shot({ t0: 6, trans: 'cut', name: 'kit geese', build(S) {
  S.studio({ floor: false, near: .1, far: 400, fog: [100, 300], key: [-6, 12, 6], area: 6 });
  S.sky('#b9c7d4', '#e4e4df', '#dcdcd7');
  const g = [[-1.6, .2, 0], [.4, .7, -1.2], [2.1, -.1, -.4]].map(([x, y, z], i) => { const b = goose(S.scene); b.position.set(x, y + 2, z); b.rotation.y = -Math.PI / 2 + i * .08; b.userData.airborne = true; b.name = 'Canada goose'; return b; });
  S.camera(tallKeys([{ t: 6, p: [4.6, 1.5, 6.2], l: [.2, 2.2, -.4], fov: 32 }], 1.7));
  return { g };
}, update(st, t) { st.g.forEach((b, i) => b.userData.flap(t + i * .23, 0)); } });

// ---- 5. the ferry on the river ----
shot({ t0: 8, trans: 'cut', name: 'kit ferry', build(S) {
  riverWorld(S, { area: 40, ice: false });
  const f = fullFerry(S);
  S.camera(tallKeys([{ t: 8, p: rv(40, -32, 9).toArray(), l: rv(4, 0, 3.5).toArray(), fov: 34 }], 1.45, { l: rv(2, 0, 3.5).toArray() }));
  return { f };
}, update(st, t) { st.f.position.copy(rv((t - 8) * 2.5, 0)); } });

// ---- 6. the mannequins at real scale: passengers standing on the wing, spaced so no two can touch ----
shot({ t0: 10, trans: 'cut', name: 'kit wing', build(S) {
  riverWorld(S, { area: 30 });
  const p = fullPlane(S); restOn(p); p.updateMatrixWorld(true);
  const crowd = cast(p, 80), pax = wingCrowd(crowd); crowd.sync();
  S.collide = { bodies: () => pax.map((q, i) => ({ name: `passenger ${i + 1}`, caps: personCaps(q) })), solids: [] };
  S.camera(tallKeys([{ t: 10, p: p.localToWorld(V(-15, 5.5, 13)).toArray(), l: p.localToWorld(V(-7, -.6, -1)).toArray(), fov: 36 }], 1.55, { l: p.localToWorld(V(-10, -.6, -1)).toArray() }));
  S.over(timecard('Hudson River · January', 'the water about 41 °F (5 °C)', { t0: 10 }));
  return { p };
} });

// ---- 7. the grey map: real coordinates, a route drawn on, place pins ----
shot({ t0: 12, trans: 'cut', name: 'kit map', build(S) {
  const p = mapWorld(S, { target: [1, 0, -3], area: 10 });
  flyAt(p, .55, MAP_LIFT);
  S.camera(tallKeys([{ t: 12, p: [2.2, 15.5, 6.5], l: [.8, 0, -3.4], fov: 40 }], 1.7, { l: [-.4, 0, -3.4], up: 3 }));
  S.over(routeLine(() => .55, { t0: 12 }));
  S.over(mapLabels({ t0: 12 }));
  S.over(place(kmV([40.7769, -73.874]), 'LAGUARDIA', { t0: 12, dx: TALL ? -200 : 18, dy: 14 }));
  S.over(place(kmV([40.850, -74.0605]), 'TETERBORO', { t0: 12, dx: 18, dy: -46 }));
  return { p };
} });

// ---- 8. the aircraft at real scale in the sky, with a quote card (real words, verbatim, attributed) ----
shot({ t0: 14, trans: 'cut', name: 'kit quote', build(S) {
  S.studio({ floor: false, near: 1, far: 4000, fog: [1500, 3500], area: 40, key: [-200, 400, 150], soft: 4, keyI: 1.6, shadowFar: 1200 });
  S.sky('#b9c7d4', '#e4e4df', '#dcdcd7');
  const p = fullPlane(S); p.position.set(0, 300, 0); p.rotation.set(.05, -.5, .08);
  // (9:16: the aircraft in the upper half, the quote card in its default place below it)
  S.camera(tallKeys([{ t: 14, p: [-46, 296, 52], l: [-6, 300, -2], fov: 34 }], 1.9, { l: [-6, 284, -2] }));
  S.over(quote('We\'re gonna be in the Hudson.', 'Capt. Chesley Sullenberger', 'to New York approach control · 15:29', TALL ? { t0: 14, size: 40, mark: true } : { t0: 14, x: 110, y: 700, w: 800, size: 40, mark: true }));
  return { p };
} });

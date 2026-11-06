// Hero frames (3D reconstruction): three held frames that show the look at a glance (the Style Studio's first visible
// result): the aircraft on its plinth with the chapter title, the ditching with everyone out on the wings, the flight on the
// grey map. Matte clay, the bright seamless studio, black name tags, the blue accent. Held on purpose: no entrances.
// 9:16: each shot steps back (tallKeys, flight1549.js) so the whole aircraft is in the narrow frame.
import { shot, THREE, chapter, tag, timecard, place, big, C, FW, OV_SAFE } from '../engine.js';
import { airliner, plinth, mesh, cast, wingCrowd, wingAt } from '../models.js';
import { personCaps } from '../lib/collide.js';
import { V, mapWorld, routeLine, mapLabels, flyAt, kmV, MAP_LIFT, riverWorld, restOn, rv, fullPlane, fullFerry, TALL, tallKeys } from './flight1549.js';

// ---- hero 1: the aircraft on its plinth, the chapter title ----
shot({ t0: 0, trans: 'cut', name: 'hero title', build(S) {
  S.studio({ key: [6, 12, 9], area: 9, fog: [40, 110], near: .1, far: 200 });
  plinth(S.scene, 3.4, .6);
  const p = airliner(S.scene); p.scale.setScalar(.15); p.position.set(.6, 1.55, 0); p.rotation.set(0, 2.62, 0); p.name = 'Airbus A320';
  // the display post belongs to the model (plane space, x 1/0.15): from the plinth top (y .6 = -6.33 here) 1.5 cm into the belly (-1.98)
  mesh(new THREE.CylinderGeometry(.42, .55, 4.45, 24), new THREE.MeshStandardMaterial({ color: 0x9a9c99, roughness: .6 }), [0, -4.105, 1.2], [0, 0, 0], p);
  S.camera(tallKeys([{ t: 0, p: [6.4, 2.7, 7.8], l: [-.2, 1.45, 0], fov: 30 }], 2.9, { l: [.3, 1.3, 0], up: 5 }));
  S.over(chapter('Reconstruction · 15 January 2009', 'US Airways Flight 1549', { t0: 0 }));
  S.over(timecard('LaGuardia → Charlotte', 'Airbus A320 · 150 passengers + 5 crew', { t0: 0 }));
  return { p };
} });

// ---- hero 2: on the Hudson, everyone out on the wings, a ferry alongside ----
shot({ t0: 2, trans: 'cut', name: 'hero river', build(S) {
  riverWorld(S, { area: 60 });
  const p = fullPlane(S); restOn(p);
  const crowd = cast(p, 80), pax = wingCrowd(crowd); crowd.sync();
  const fer = fullFerry(S); fer.position.copy(rv(-58, -44));
  S.collide = { bodies: () => pax.map((q, i) => ({ name: `passenger ${i + 1}`, caps: personCaps(q) })), solids: [] };
  S.camera(tallKeys([{ t: 2, p: rv(34, -46, 9).toArray(), l: rv(-8, -4, 3.5).toArray(), fov: 34 }], 1.6, { l: rv(-2, -2, 2).toArray() }));
  S.over(tag(s => s.proj(p.localToWorld(V(-6.5, wingAt(6.5).y + 1.9, 0))), 'Passengers on the wings', 'waiting for the ferries', { t0: 2, line: true, dx: 70, dy: -250 }));
  S.over(timecard('15:31 · Hudson River', 'off West 48th Street, Manhattan', { t0: 2 }));
  return { p };
} });

// ---- hero 3: the whole flight on the grey map of New York ----
shot({ t0: 4, trans: 'cut', name: 'hero map', build(S) {
  const p = mapWorld(S, { target: [1, 0, -3], area: 10 });
  const U = .93; flyAt(p, U, MAP_LIFT);
  S.camera(tallKeys([{ t: 4, p: [6.5, 13.5, 9.5], l: [1.2, 0, -2.6], fov: 40 }], 1.4, { up: 4 }));
  S.over(routeLine(() => U, { t0: 4 }));
  S.over(mapLabels({ t0: 4, skip: ['QUEENS', 'THE BRONX', 'NEW JERSEY'] }));
  S.over(place(kmV([40.7769, -73.874]), 'LAGUARDIA', { t0: 4, dx: TALL ? -200 : 18, dy: 14 }));
  S.over(place(kmV([40.84, -73.879]), 'BIRD STRIKE · 2,818 FT', { t0: 4, dx: TALL ? -300 : 18, dy: -46 }));
  S.over(place(kmV([40.769, -74.006]), 'HUDSON RIVER', { t0: 4, fill: C.accent, dx: TALL ? 18 : -190, dy: 14 }));
  S.over(big('208 s', 'WITHOUT ENGINE THRUST', { t0: 4, x: TALL ? FW / 2 : 370, y: TALL ? OV_SAFE.t + 160 : 270, size: 92 }));
  return { p };
} });

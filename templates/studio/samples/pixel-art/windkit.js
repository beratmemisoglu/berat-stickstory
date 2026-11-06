// The wind-to-town kit: the models shared by hero.js, kit.js and sample.js (a helper, not a scene: it registers no shots
// and no view lists it). A style that keeps these moves them into models.js. Metres, y up, the ground at y = 0.
import { THREE, C, clamp, V, rng, facet, flat, box } from '../engine.js';
import { terrain, scatter, tree, lamppost } from '../models.js';

export const TAU = Math.PI * 2, LITR = [C.yellow, C.yellow, C.yellow], OFFR = [C.bg, C.dark, C.dark], LIT = facet(LITR), OFF = facet(OFFR);   // lit / dark window
export const faceted = geo => { const g = geo.toNonIndexed(); g.computeVertexNormals(); return g; };   // flat facets, crisp bands
export const mesh = (geo, ramp, pos = [0, 0, 0]) => { const m = new THREE.Mesh(faceted(geo), facet(ramp)); m.position.set(...pos); return m; };
export const hills = (x, z) => 2.4 * Math.exp(-((z + 9) ** 2) / 26) * (1 + .25 * Math.sin(x * .21 + 1)) + .35 * Math.sin(x * .13) * Math.cos(z * .17);
export function turbine(s = 1) {                // 3.1 m to the hub, faces +z; spin g.rotor.rotation.z
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(.05 * s, .1 * s, 3 * s, 8), 'white', [0, 1.5 * s, 0]), box(.34 * s, .08 * s, .34 * s, 'stone', [0, .04 * s, 0]));
  g.add(box(.17 * s, .17 * s, .5 * s, 'white', [0, 3.06 * s, -.06 * s]));                       // nacelle
  g.rotor = new THREE.Group(); g.rotor.position.set(0, 3.06 * s, .22 * s); g.add(g.rotor);
  const hub = mesh(new THREE.ConeGeometry(.09 * s, .18 * s, 6), 'white', [0, 0, .07 * s]); hub.rotation.x = Math.PI / 2; g.rotor.add(hub);
  for (let i = 0; i < 3; i++) { const arm = new THREE.Group(); arm.rotation.z = i * TAU / 3;
    arm.add(box(.12 * s, .5 * s, .03 * s, 'white', [.02 * s, .3 * s, 0]), box(.07 * s, .95 * s, .025 * s, 'white', [.01 * s, 1.02 * s, 0])); g.rotor.add(arm); }
  g.userData.kind = 'wind turbine'; return g;
}
export function pylon(s = 1) {                  // lattice pylon 2.75 m, arms along x; g.ends = cable points (local)
  const g = new THREE.Group(), k = .06, xw = h => (.17 + (1.25 - h) * k) * s;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = box(.05 * s, 2.5 * s, .05 * s, 'grey', [sx * .17 * s, 1.25 * s, sz * .17 * s]); l.rotation.set(-sz * k, 0, sx * k); g.add(l); }
  for (const h of [.55, 1.15, 1.75, 2.3]) { const w = xw(h);
    g.add(box(2 * w, .04 * s, .04 * s, 'grey', [0, h * s, w]), box(2 * w, .04 * s, .04 * s, 'grey', [0, h * s, -w]),
      box(.04 * s, .04 * s, 2 * w, 'grey', [w, h * s, 0]), box(.04 * s, .04 * s, 2 * w, 'grey', [-w, h * s, 0])); }
  g.add(box(1.3 * s, .06 * s, .06 * s, 'grey', [0, 2.2 * s, 0]), box(1 * s, .06 * s, .06 * s, 'grey', [0, 1.75 * s, 0]), box(.06 * s, .3 * s, .06 * s, 'grey', [0, 2.6 * s, 0]));
  g.ends = [];
  for (const [x, y] of [[-.62, 2.2], [.62, 2.2], [-.47, 1.75], [.47, 1.75]]) { g.add(box(.05 * s, .15 * s, .05 * s, 'cyan', [x * s, (y - .1) * s, 0])); g.ends.push(V(x * s, (y - .19) * s, 0)); }
  g.userData.kind = 'pylon'; return g;
}
export function cable(a, b, col, sag = .3, n = 16) {   // a sagging cable between two world points; .pts carry the pulses
  const pts = []; for (let i = 0; i <= n; i++) { const u = i / n; pts.push(a.clone().lerp(b, u).add(V(0, -sag * 4 * u * (1 - u), 0))); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col })); l.pts = pts; return l;
}
export const along = (pts, u) => { const f = clamp(u) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)); return pts[i].clone().lerp(pts[i + 1], f - i); };
export function pulses(S, lines, per = 3, size = .09) { // current as yellow pulses running along cables; move with flow(st.pulses, t)
  return lines.flatMap((l, j) => Array.from({ length: per }, (_, i) => { const b = box(size, size, size, LITR); b.pts = l.pts; b.ph = i / per + j * .13; S.scene.add(b); return b; }));
}
export const flow = (list, t, speed = .45) => list.forEach(b => b.position.copy(along(b.pts, (t * speed + b.ph) % 1)));
export function linkPylons(S, ps, col, sag = .3) {      // cables between consecutive pylons (same arm to same arm)
  ps.forEach(p => p.updateMatrixWorld(true)); const out = [];
  for (let i = 0; i + 1 < ps.length; i++) for (let e = 0; e < 4; e++) { const c = cable(ps[i].localToWorld(ps[i].ends[e].clone()), ps[i + 1].localToWorld(ps[i + 1].ends[e].clone()), col, sag); S.scene.add(c); out.push(c); }
  return out;
}
export function gable(w, h, d, ramp, pos) {     // a gable roof, ridge along x; origin = the middle of its base
  const geo = new THREE.CylinderGeometry(1, 1, 1, 3, 1).toNonIndexed(); geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI / 2);
  geo.translate(0, .5, 0); geo.scale(w, h / 1.5, d / 1.732); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, facet(ramp)); m.position.set(...pos); return m;
}
export function house(s = 1, wall = 'white', roof = 'red') {   // 0.9 m, front +z; g.wins light up with lightUp()
  const g = new THREE.Group(), w = .8 * s, h = .5 * s, d = .6 * s;
  g.add(box(w, h, d, wall, [0, h / 2, 0]), gable(w + .08 * s, .34 * s, d + .1 * s, roof, [0, h, 0]));
  g.add(box(.14 * s, .26 * s, .02 * s, 'plum', [-.2 * s, .13 * s, d / 2 + .012 * s]), box(.08 * s, .28 * s, .08 * s, 'grey', [.22 * s, h + .24 * s, -.1 * s]));
  g.wins = [box(.13 * s, .12 * s, .02 * s, OFFR, [.04 * s, .3 * s, d / 2 + .012 * s]), box(.13 * s, .12 * s, .02 * s, OFFR, [.26 * s, .3 * s, d / 2 + .012 * s]),
    box(.02 * s, .12 * s, .13 * s, OFFR, [w / 2 + .012 * s, .3 * s, -.1 * s]), box(.02 * s, .12 * s, .13 * s, OFFR, [w / 2 + .012 * s, .3 * s, .12 * s])];
  g.add(...g.wins); g.userData.kind = 'house'; return g;
}
export function block(w, h, d, ramp, seed = 1) { // a town block, windows on its +z and +x faces; g.wins + g.order (0..1 each)
  const g = new THREE.Group(), r = rng(seed * 97 + 5);
  g.add(box(w, h, d, ramp, [0, h / 2, 0]), box(w + .06, .06, d + .06, 'grey', [0, h + .03, 0]));
  g.wins = []; g.order = [];
  for (let y = .4; y < h - .15; y += .3) {
    for (let x = -w / 2 + .18; x < w / 2 - .1; x += .24) g.wins.push(box(.12, .14, .02, OFFR, [x, y, d / 2 + .012]));
    for (let z = -d / 2 + .18; z < d / 2 - .1; z += .24) g.wins.push(box(.02, .14, .12, OFFR, [w / 2 + .012, y, z]));
  }
  g.wins.forEach(m => { g.add(m); g.order.push(r()); }); g.userData.kind = 'town block'; return g;
}
export const lightUp = (wins, order, k) => wins.forEach((m, i) => m.material = order[i] < k ? LIT : OFF);
export function transformer(s = 1) {            // a substation transformer: tank, cooling fins, three bushings
  const g = new THREE.Group();
  g.add(box(.6 * s, .55 * s, .45 * s, 'teal', [0, .275 * s + .06 * s, 0]));
  for (let i = 0; i < 4; i++) g.add(box(.04 * s, .4 * s, .14 * s, 'navy', [(-.21 + i * .14) * s, .3 * s, .3 * s]));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(.035 * s, .05 * s, .3 * s, 6), 'white', [(-.18 + i * .18) * s, .76 * s, 0]));
  return g;
}
export function substation(s = 1) {             // fenced 3 x 2 m yard: two transformers and a gantry; g.ends = where the line lands (local)
  const g = new THREE.Group();
  g.add(box(3 * s, .06 * s, 2 * s, 'stone', [0, .03 * s, 0]));
  for (const x of [-.5, .75]) { const t = transformer(s); t.position.x = x * s; g.add(t); }
  for (const z of [-.62, .62]) g.add(box(.08 * s, 1.75 * s, .08 * s, 'grey', [-1.25 * s, .9 * s, z * s]));
  g.add(box(.08 * s, .08 * s, 1.4 * s, 'grey', [-1.25 * s, 1.75 * s, 0]));
  g.ends = [];
  for (const z of [-.47, -.15, .15, .47]) { g.add(box(.05 * s, .14 * s, .05 * s, 'cyan', [-1.25 * s, 1.64 * s, z * s])); g.ends.push(V(-1.25 * s, 1.56 * s, z * s)); }
  const pts = [], fx = 1.48 * s, fz = .98 * s, fy = .45 * s;   // fence: a wire line around the yard
  for (const [a, b] of [[[-fx, -fz], [fx, -fz]], [[fx, -fz], [fx, fz]], [[fx, fz], [-fx, fz]], [[-fx, fz], [-fx, -fz]]]) pts.push(V(a[0], fy, a[1]), V(b[0], fy, b[1]));
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C.silver })));
  for (const [x, z] of [[-fx, -fz], [fx, -fz], [fx, fz], [-fx, fz], [0, fz], [0, -fz]]) g.add(box(.04 * s, .5 * s, .04 * s, 'grey', [x, .25 * s, z]));
  g.userData.kind = 'substation'; return g;
}
export function generator(s = 1) {              // cutaway: copper coils on a stator ring around a spinning two-pole magnet,
  const g = new THREE.Group(), cy = 1.22 * s;     // on a plinth; axis z, g.spin turns on .rotation.z, g.blades at the back
  g.add(box(2.4 * s, .2 * s, 1.3 * s, 'stone', [0, .1 * s, 0]), box(.3 * s, .3 * s, .8 * s, 'grey', [-.62 * s, .35 * s, 0]), box(.3 * s, .3 * s, .8 * s, 'grey', [.62 * s, .35 * s, 0]));
  for (let i = 0; i < 12; i++) { const p = new THREE.Group(); p.position.set(0, cy, 0); p.rotation.z = i * TAU / 12;
    p.add(box(.34 * s, .22 * s, .6 * s, 'grey', [0, .86 * s, 0]), box(.24 * s, .15 * s, .5 * s, 'orange', [0, .67 * s, 0])); g.add(p); }
  g.spin = new THREE.Group(); g.spin.position.set(0, cy, 0); g.add(g.spin);
  g.spin.add(box(.36 * s, .5 * s, .5 * s, 'red', [0, .25 * s, 0]), box(.36 * s, .5 * s, .5 * s, 'blue', [0, -.25 * s, 0]));
  const shaft = mesh(new THREE.CylinderGeometry(.07 * s, .07 * s, 2.4 * s, 8), 'grey', [0, 0, -.9 * s]); shaft.rotation.x = Math.PI / 2; g.spin.add(shaft);
  g.blades = new THREE.Group(); g.blades.position.z = -2 * s; g.spin.add(g.blades);
  const hub = mesh(new THREE.ConeGeometry(.15 * s, .3 * s, 6), 'white', [0, 0, -.12 * s]); hub.rotation.x = -Math.PI / 2; g.blades.add(hub);
  for (let i = 0; i < 3; i++) { const arm = new THREE.Group(); arm.rotation.z = i * TAU / 3 + .5;
    arm.add(box(.2 * s, .4 * s, .05 * s, 'white', [.03 * s, .3 * s, 0]), box(.12 * s, .65 * s, .04 * s, 'white', [.015 * s, .8 * s, 0])); g.blades.add(arm); }
  g.userData.kind = 'generator'; return g;
}
export function grassland(S, hf, ramp = [C.navy, C.teal, C.green], seed = 4, n = 500, area = 40, cz = -4, rocks = true) {
  const land = terrain(160, 160, 100, hf, ramp); land.material = facet(ramp, { patch: 1 });
  S.scene.add(land, scatter(hf, { n, area, seed, cz, rocks }));
  return land;
}
export function town(seed = 3) {                // blocks on a main street (along x) + houses behind; g.wins + g.order light it left to right
  const g = new THREE.Group(), r = rng(seed), ramps = ['teal', 'navy', 'plum', 'grey', 'blue']; g.wins = []; g.order = [];
  g.add(box(60, .1, 60, [C.bg, C.navy, C.navy], [0, -.05, 0]), box(60, .02, 1.5, [C.bg, C.dark, C.dark], [0, .015, 0]));
  const add = (wins, x, own) => wins.forEach((m, k) => { g.wins.push(m); g.order.push((x + 8) / 16 * .75 + own[k] * .25); });
  for (let i = 0; i < 9; i++) for (const side of [-1, 1]) {
    const w = 1 + r() * .5, h = 1.1 + r() * 1.7, d = 1 + r() * .3, x = (i - 4) * 1.75 + (r() - .5) * .2;
    const b = block(w, h, d, ramps[Math.floor(r() * ramps.length)], i * 2 + side + 7);
    b.position.set(x, 0, side * (1.35 + d / 2)); g.add(b); add(b.wins, x, b.order);   // windows face +z: the cameras look from the south
  }
  for (let i = 0; i < 10; i++) { const x = -7 + i * 1.6, hs = house(1.1, ['white', 'stone', 'teal'][i % 3], ['red', 'plum', 'navy'][i % 3]);
    hs.position.set(x, 0, -4.6 - (i % 2) * .5); g.add(hs); add(hs.wins, x, [r(), r(), r(), r()]);
    if (i % 3 === 1) { const tr = tree(1.2, i); tr.position.set(x + .8, 0, -5.6); g.add(tr); } }
  for (const x of [-7, -3.5, 0, 3.5, 7]) for (const z of [-.95, .95]) { const lp = lamppost(1); lp.position.set(x + .87, 0, z); lp.rotation.y = z < 0 ? -Math.PI / 2 : Math.PI / 2; g.add(lp); }
  g.userData.kind = 'town'; return g;
}
export function moon(S, pos, r = 2) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), flat(C.white)); m.position.set(...pos); m.userData.noShadow = true; S.scene.add(m); return m; }

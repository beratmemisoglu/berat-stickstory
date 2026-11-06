// ENVIRONMENT KITS for the pixel engine (v10 "Hi-Bit", legacy look too): a whole place in one call, at real scale (metres).
//   import { citySet, useCam, lightPreset } from '../lib/sets.js';
//   build(S) { const set = citySet(S, { time: 'sunset' }); useCam(S, set, 'street'); const p = person(); place(p, ...set.spots.sidewalk) ... }
// Every xxxSet(S, opts) adds its pieces to S.scene (one group, userData.oidEach so every piece gets its own outline), applies a
// light preset (S.sky, S.bg, S.fogNear/Far, S.light; opts.light overrides the set's own), marks floors / roads / shells
// userData.ground, aims S.cam at its first camera, and returns
//   { group, spots: { name: [x, y, z] } (standing points: y = the floor height there), cam: { name: { p: [x,y,z], l: [x,y,z] } }, props: {...} }
// Macro sets (chipSet, phoneMacroSet) are built at opts.scale x real size (chips as buildings: a person 1.75 m tall walks
// between them); their props are the prop kit's own pieces at that scale.
import * as E from '../engine.js';
import * as P from './props.js';
const { THREE, C } = E;

// ---------- light presets ----------
// sky: C keys top -> horizon (Hi-Bit draws all 4, the legacy look the first and last); fog [near, far] in metres; light = direction TO the light
export const LIGHTS = {
  day: { sky: ['blue', 'sky', 'sky', 'cyan'], fog: [90, 320], light: [-.5, 1, .6] },
  sunset: { sky: ['navy', 'plum', 'red', 'orange'], fog: [70, 300], light: [-1, .34, .22] },
  night: { sky: ['bg', 'bg', 'navy', 'navy'], fog: [45, 220], light: [.35, 1, .45] },
  neon: { sky: ['bg', 'navy', 'plum', 'plum'], fog: [40, 180], light: [.5, .85, .6] },
  interior: { sky: ['dark', 'dark', 'slate', 'slate'], fog: [30, 90], light: [-.35, 1, .55] },
  studio: { sky: ['dark', 'dark', 'navy', 'navy'], fog: [35, 110], light: [-.5, 1, .8] },
  dramatic: { sky: ['bg', 'bg', 'bg', 'plum'], fog: [25, 90], light: [.9, .55, -.25] },
};
/** apply a light preset to a shot: 'day' | 'sunset' | 'night' | 'neon' | 'interior' | 'studio' | 'dramatic' (o.fog = [near, far] override) */
export function lightPreset(S, name = 'day', o = {}) {
  const L = LIGHTS[name] || LIGHTS.day, sky = L.sky.map(k => C[k] ?? k);
  S.sky = E.HIBIT ? sky : [sky[0], sky[sky.length - 1]];
  S.bg = sky[0]; [S.fogNear, S.fogFar] = o.fog || L.fog; S.light = [...L.light];
  return L;
}
/** point S.cam at one of a set's cameras (or any { p, l }) */
export function useCam(S, set, name) {
  const c = typeof name === 'object' ? name : (set.cam[name] || Object.values(set.cam)[0]);
  S.cam.position.set(...c.p); S.cam.lookAt(...c.l); return c;
}

// ---------- shared helpers ----------
const R = P.R, rnd = E.rng;
function kit(S, name, light, o) {
  const g = new THREE.Group(); g.userData = { name, set: true, oidEach: true }; S.scene.add(g);
  lightPreset(S, o.light || light, o);
  return g;
}
/** a ground slab whose TOP is at y (never counted as overlap) */
function slab(g, w, d, ramp, x = 0, z = 0, y = 0, t = .2) { const m = E.box(w, t, d, R(ramp), [x, y - t / 2, z]); m.userData.ground = true; g.add(m); return m; }
/** a wall / shell box (ground: the layout check ignores it) */
function shell(g, w, h, d, ramp, x, y0, z) { const m = E.box(w, h, d, R(ramp), [x, y0 + h / 2, z]); m.userData.ground = true; g.add(m); return m; }
const put = (g, o, x, z, rotY = 0, y = 0) => { P.place(o, x, z, { y, rotY }); g.add(o); return o; };
const glowBox = (g, w, h, d, key, x, y, z) => { const m = new THREE.Mesh(E.GEO.box, P.glow(key)); m.scale.set(w, h, d); m.position.set(x, y, z); g.add(m); return m; };
function inst(g, list, spec, ground = true) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(E.GEO.box, P.M(spec), list.length), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Eu = new THREE.Euler();
  list.forEach(([w, h, d, x, y, z, ry = 0], i) => im.setMatrixAt(i, M4.compose(new THREE.Vector3(x, y, z), Q.setFromEuler(Eu.set(0, ry, 0)), new THREE.Vector3(w, h, d))));
  im.userData.ground = ground; g.add(im); return im;
}
function terrain(w, d, seg, hf, ramp) {
  const gm = new THREE.PlaneGeometry(w, d, seg, Math.round(seg * d / w)).toNonIndexed(); gm.rotateX(-Math.PI / 2);
  const p = gm.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hf(p.getX(i), p.getZ(i)));
  gm.computeVertexNormals(); const m = new THREE.Mesh(gm, P.M(ramp)); m.userData.ground = true; return m;
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
/** a box from point a to point b: w across (world X stays X for paths in a Y-Z plane), t thick */
function beam(g, a, b, w, t, ramp) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = E.box(w, 1, t, R(ramp));
  m.scale.set(w, d.length(), t); m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.userData.ground = true; g.add(m); return m;
}
/** a street-front shop: 2-3 storeys, awning + sign over the door (lit at night), facing +Z */
function shop(o) {
  const g = P.skyscraper({ floors: o.floors, w: o.w, d: o.d, ramp: o.ramp, lit: o.night ? .45 : .3, night: o.night, seed: o.seed, spire: false });
  const b = g.children[0], w = o.w, d = o.d, z = d / 2;
  const m = E.box(w * .55, .9, .2, R(o.sign), [0, 4.0, z + .1]); if (o.night) m.material = P.glow(o.signGlow || 'yellow'); b.add(m);
  g.userData.name = 'shop'; g.userData.kind = 'shop';
  return g;
}
const DAY_WALLS = ['sand', 'white', 'concrete', 'pink', 'teal', 'orange', 'paper'], NIGHT_WALLS = ['dark', 'black', 'dark', 'plum', 'navy', 'carbon'];
const DRY = E.HIBIT ? 'olive' : 'teal', SCRUB = E.HIBIT ? 'green' : 'green';   // (legacy olive = the lime-topped green ramp: too loud for hills)
const CAR_RAMPS =['red', 'blue', 'white', 'black', 'green', 'yellowFlat', 'grey', 'orange'];

// =====================================================================================================================
/** citySet(S, { time: 'day'|'sunset'|'night', length: 140, seed, traffic: true }) - a Los Santos street: 4-lane road along X with
 *  markings and a crosswalk, raised sidewalks, palms, street lights, a traffic light, shops facing the road (z < 0), a skyline */
export function citySet(S, o = {}) {
  const { time = 'day', length: L = 140, seed = 3, traffic = true } = o, night = time === 'night', lit = time !== 'day', r = rnd(seed * 31 + 7);
  const g = kit(S, 'city', time, o), props = { cars: [], shops: [], palms: [] };
  slab(g, L + 400, 600, night ? 'dark' : 'concrete', 0, -120, 0, .3);                                                   // everything beyond
  slab(g, L, 14, 'asphalt', 0, 0, .02, .2);                                                                              // road
  for (const s of [-1, 1]) { slab(g, L, 5, 'concrete', 0, s * 9.5, .15, .3); slab(g, L, .25, 'grey', 0, s * 7.1, .17, .3); }   // sidewalks + kerbs
  const mk = [], wd = [];
  for (const s of [-1, 1]) mk.push([L, .012, .12, 0, .026, s * .16]);
  for (let x = -L / 2 + 2; x < L / 2 - 3; x += 9) for (const s of [-1, 1]) if (Math.abs(x - 20) > 4) wd.push([3, .012, .14, x + 1.5, .026, s * 3.5]);
  for (let z = -6; z <= 6.01; z += 1.1) wd.push([3, .012, .55, 20, .026, z]);
  inst(g, mk, 'yellowFlat'); inst(g, wd, 'white');
  // shops facing the road, a skyline behind
  let x = -L / 2 + 2;
  while (x < L / 2 - 8) {
    const w = 10 + Math.floor(r() * 7), d = 12 + Math.floor(r() * 5), floors = 2 + Math.floor(r() * 2);
    const s = shop({ floors, w, d, ramp: pick(r, night ? NIGHT_WALLS : DAY_WALLS), sign: pick(r, ['red', 'blue', 'yellowFlat', 'green', 'purple']), signGlow: pick(r, ['yellow', 'cyan', 'red', 'lime', 'magenta']), night, seed: Math.floor(r() * 99) });
    put(g, s, x + w / 2, -12 - d / 2, 0, .15); props.shops.push(s); x += w + .6 + r() * 1.5;
  }
  for (const [zr, off] of [[-64, 0], [-104, 16], [-146, 6]]) for (let xx = -L / 2 + 12 + off; xx < L / 2; xx += 32) {   // skyline: rows of 32 m lots (no overlaps)
    const t = P.skyscraper({ floors: 14 + Math.floor(r() * 32), w: 18 + r() * 8, d: 18 + r() * 8, ramp: pick(r, night ? ['navy', 'dark', 'glass'] : ['concrete', 'white', 'glass', 'sand']), style: r() < .5 ? 'grid' : 'bands', lit: night ? .4 : .3, night: lit && time === 'night', seed: Math.floor(xx) + zr });
    put(g, t, xx + (r() - .5) * 3, zr + (r() - .5) * 4);
  }
  for (let xx = -L / 2 + 6; xx < L / 2 - 4; xx += 14) for (const s of [-1, 1]) { const p = P.palmTree({ h: 8 + r() * 4, seed: Math.floor(r() * 99) }); put(g, p, xx + (s > 0 ? 7 : 0), s * 8.3, 0, .15); props.palms.push(p); }
  for (let xx = -L / 2 + 13; xx < L / 2 - 4; xx += 28) for (const s of [-1, 1]) put(g, P.streetLight({ lit }), xx + (s > 0 ? 7 : 0), s * 7.7, s > 0 ? Math.PI / 2 : -Math.PI / 2, .15);
  props.trafficLight = put(g, P.trafficLight({ arm: 4.5, state: 'green' }), 23.5, -7.8, -Math.PI / 2, .15);
  put(g, P.hydrant(), -11.5, -7.8, 0, .15); put(g, P.bench(), -18, -10.8, 0, .15); put(g, P.bench(), 6, 10.8, Math.PI, .15);
  put(g, P.dumpster(), 33, -9.7, 0, .15);
  if (traffic) [[-24, 1.75, 0], [6, 5.25, 0], [31, 1.75, 0], [-6, -1.75, Math.PI], [16, -5.25, Math.PI], [-36, -1.75, Math.PI]].forEach(([cx, cz, ry], i) => {
    const mk2 = [P.sedan, P.taxi, P.sportsCar, P.sedan, P.policeCar, P.sedan][i];
    const c = mk2({ ramp: i === 1 ? undefined : i === 4 ? undefined : pick(r, CAR_RAMPS), lights: lit }); put(g, c, cx, cz, ry, .02); props.cars.push(c);
  });
  return { group: g, props,
    spots: { sidewalk: [0, .15, 9.6], sidewalkFar: [0, .15, -9.6], road: [0, .02, 1.75], roadFar: [0, .02, -1.75], crosswalk: [20, .02, 0], corner: [23, .15, -10], shopDoor: [props.shops[3]?.position.x ?? 0, .15, -11.6] },
    cam: { street: { p: [-14, 1.7, 10.6], l: [8, 3, -8] }, wide: { p: [-34, 17, 36], l: [0, 3, -10] }, low: { p: [-8, .7, 4.2], l: [10, 1.2, -1] }, skyline: { p: [4, 1.8, 11.5], l: [-6, 22, -70] } },
    ...aimFirst(S, { p: [-14, 1.7, 10.6], l: [8, 3, -8] }) };
}
const aimFirst = (S, c) => { S.cam.position.set(...c.p); S.cam.lookAt(...c.l); return {}; };

// =====================================================================================================================
/** highwaySet(S, { time: 'day', length: 420, seed }) - a freeway: two 3-lane carriageways along X, median barrier, guard rails,
 *  an overhead sign gantry (blank signs), dry scrub, hills and a hazy skyline */
export function highwaySet(S, o = {}) {
  const { time = 'day', length: L = 420, seed = 5 } = o, lit = time !== 'day', r = rnd(seed * 17 + 1);
  const g = kit(S, 'highway', time, o), props = { cars: [] };
  slab(g, L + 600, 800, time === 'night' ? 'dark' : DRY, 0, 0, 0, .3);
  slab(g, L, 29, 'asphalt', 0, 0, .03, .2);
  const mk = [];
  for (const s of [-1, 1]) {
    mk.push([L, .012, .14, 0, .036, s * 1.0], [L, .012, .14, 0, .036, s * 12.2]);
    for (let x = -L / 2; x < L / 2; x += 12) for (const zz of [4.6, 8.2]) mk.push([4, .012, .14, x + 2, .036, s * zz]);
  }
  inst(g, mk, 'white');
  shell(g, L, .8, .5, 'concrete', 0, .03, 0);                                                                            // median barrier
  for (const s of [-1, 1]) { const posts = []; for (let x = -L / 2; x < L / 2; x += 4) posts.push([.12, .7, .12, x, .38, s * 14.1]); inst(g, posts, 'metal'); shell(g, L, .3, .06, 'metal', 0, .55, s * 14.05); }
  for (let x = -L / 2 + 10, i = 0; x < L / 2; x += 20, i++) put(g, P.streetLight({ lit, h: 10, arm: 2 }), x, 0, i % 2 ? Math.PI / 2 : -Math.PI / 2, .83);   // median lights, arms alternating
  // sign gantry at x = 40
  for (const s of [-1, 1]) { shell(g, .5, 7.6, .5, 'metal', 40, 0, s * 14.6); }
  shell(g, .6, .6, 30, 'metal', 40, 7, 0); shell(g, .3, .3, 30, 'metal', 40, 6.4, 0);
  for (const zz of [-7, 7]) { const s = zz > 0 ? -1 : 1, x0 = 40 + s * .4, xf = x0 + s * .12;                             // each faces its oncoming traffic
    shell(g, .2, 2.6, 6, 'green', x0, 4.2, zz); inst(g, [[.05, .3, 4, xf, 6.0, zz], [.05, .3, 2.6, xf, 5.3, zz - .6], [.05, .45, .45, xf, 4.8, zz + 2.2]], 'white', true); }
  // scrub, hills, skyline
  const sc = []; for (let i = 0; i < 260; i++) { const zz = (r() < .5 ? -1 : 1) * (17 + r() * 120), k = .4 + r() * 1.1; sc.push([k * 1.4, k, k * 1.2, (r() - .5) * L * 1.4, k / 2, zz, r() * 3]); }
  inst(g, sc, time === 'night' ? 'teal' : SCRUB, true);
  const ridge = (x, z) => { const k = Math.max(0, Math.min(1, (-z - 110) / 50)); return k * (22 + 14 * Math.sin(x * .013 + 2) + 8 * Math.sin(x * .041) + 5 * Math.sin(x * .09 + z * .05)); };
  const rg = terrain(L + 500, 160, 70, (x, z) => ridge(x, z - 180), time === 'night' ? 'navy' : DRY); rg.position.z = -180; g.add(rg);   // hills behind (-Z)
  for (let i = 0; i < 8; i++) put(g, P.skyscraper({ floors: 18 + Math.floor(r() * 30), w: 22, d: 22, night: time === 'night', lit: .4, seed: i, ramp: time === 'night' ? 'navy' : 'concrete' }), 60 + i * 28, 150 + r() * 40);
  [[-30, 2.8, 0, P.sedan], [-6, 6.4, 0, P.sportsCar], [18, 10.0, 0, P.taxi], [-48, 6.4, 0, P.policeCar], [10, -2.8, Math.PI, P.sedan], [-20, -6.4, Math.PI, P.sedan], [36, -10, Math.PI, P.motorbike]].forEach(([x, z, ry, f]) => {
    const c = f({ ramp: pick(r, CAR_RAMPS), lights: lit }); put(g, c, x, z, ry, .03); props.cars.push(c); });
  const cam = { chase: { p: [-40, 2.6, 4.6], l: [-20, 1.2, 4.8] }, side: { p: [-4, 2.2, 24], l: [-6, 1.5, 0] }, overpass: { p: [-70, 15, 0], l: [0, 0, 0] }, gantry: { p: [22, 9, -15], l: [44, 4, 6] } };
  aimFirst(S, cam.side);
  return { group: g, props, cam, spots: { shoulder: [0, .03, 13.2], lane1: [0, .03, 2.8], lane2: [0, .03, 6.4], lane3: [0, .03, 10], laneB1: [0, .03, -2.8], median: [0, .83, 0] } };
}

// =====================================================================================================================
/** beachSet(S, { time: 'sunset', sun: true, seed }) - sand, sea, a pier on posts with lamps and a Ferris wheel at its end, palms, a lifeguard tower */
export function beachSet(S, o = {}) {
  const { time = 'sunset', seed = 2, sun = time === 'sunset' } = o, lit = time !== 'day', r = rnd(seed * 41 + 3);
  const g = kit(S, 'beach', time, o), props = { palms: [] };
  slab(g, 600, 120, 'sand', 0, 40, 0, .4);                                                                               // beach z > -20
  slab(g, 900, 700, 'navy', 0, -370, -.5, .4);                                                // sea (lower)
  const fm = []; for (let i = 0; i < 60; i++) fm.push([4 + r() * 10, .05, .4 + r() * .4, (r() - .5) * 400, -.42, -21 - r() * 3]);
  for (let i = 0; i < 90; i++) fm.push([3 + r() * 8, .05, .3, (r() - .5) * 500, -.44, -30 - r() * 200]);
  inst(g, fm, time === 'day' ? 'sky' : 'blue');
  inst(g, [[600, .06, 1.2, 0, -.05, -20.4]], 'white');
  // pier: deck y = 4 from z -6 to -96
  const deck = shell(g, 7, .35, 92, 'wood', 0, 3.65, -50);
  const posts = []; for (let z = -8; z > -96; z -= 6) for (const s of [-1, 1]) posts.push([.4, 4.6, .4, s * 3.1, 1.4, z]);
  inst(g, posts, 'brown');
  for (const s of [-1, 1]) { shell(g, .12, .1, 92, 'white', s * 3.4, 5.0, -50); const rp = []; for (let z = -5; z > -96; z -= 2) rp.push([.1, 1.0, .1, s * 3.4, 4.5, z]); inst(g, rp, 'white'); }
  beam(g, [0, .3, 7], [0, 3.86, -4.6], 5.6, .3, 'wood');                                                                // ramp up from the sand
  for (const s of [-1, 1]) beam(g, [s * 2.9, 1.3, 7], [s * 2.9, 4.86, -4.6], .1, .1, 'white');
  for (let z = -12; z > -90; z -= 14) for (const s of [-1, 1]) put(g, P.streetLight({ lit, h: 4.5, arm: .6 }), s * 3.0, z, s > 0 ? Math.PI : 0, 4);
  // Ferris wheel at the end
  const fw = new THREE.Group(); fw.position.set(0, 4 + 15.6, -84); g.add(fw); fw.userData = { name: 'ferris wheel', kind: 'ferris wheel', solid: true, size: [28, 30, 3.5] };
  const wheel = new THREE.Group(); fw.add(wheel);
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, ca = Math.cos(a), sa = Math.sin(a); const s = E.box(.25, 13, .25, R('white'), [0, 0, 0]); s.position.set(ca * 6.5, sa * 6.5, 0); s.rotation.z = a - Math.PI / 2; wheel.add(s);
    const rim = E.box(.4, 5.3, .4, R(lit ? 'red' : 'white'), [ca * 13, sa * 13, 0]); rim.rotation.z = a; wheel.add(rim);
    const cab = E.box(1.6, 1.6, 1.6, R(['red', 'yellowFlat', 'blue', 'lime'][i % 4]), [ca * 13, sa * 13 - 1.3, 0]); wheel.add(cab); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.4, 8), P.M('metal')); hub.rotation.x = Math.PI / 2; fw.add(hub);
  for (const s of [-1, 1]) for (const zz of [-1.6, 1.6]) { const lg = E.box(.5, 16.5, .5, R('white'), [s * 4.2, -7.7, zz]); lg.rotation.z = s * .26; fw.add(lg); }
  props.wheel = wheel;
  // palms, lifeguard tower, sun
  for (let i = 0; i < 12; i++) { const p = P.palmTree({ h: 9 + r() * 5, seed: i + seed, lean: .1 + r() * .12 }); put(g, p, -90 + i * 16 + (r() - .5) * 6, 6 + r() * 26); props.palms.push(p); }
  const tower = new THREE.Group(); put(g, tower, 26, -12);
  for (const x of [-1, 1]) for (const z of [-1, 1]) tower.add(E.box(.2, 2.4, .2, R('white'), [x * 1.1, 1.2, z * 1.1]));
  tower.add(E.box(2.8, .2, 2.8, R('wood'), [0, 2.5, 0]), E.box(2.4, 1.8, 2.4, R('sky'), [0, 3.5, 0]), E.box(3.0, .25, 3.0, R('red'), [0, 4.5, 0]));
  tower.userData = { name: 'lifeguard tower', kind: 'lifeguard tower', solid: true, rest: true, size: [3, 4.6, 3] };
  if (sun) { const sd = new THREE.Mesh(new THREE.CircleGeometry(10, 12), P.glow('yellow')); sd.position.set(-60, 14, -140); sd.lookAt(0, 4, 0); sd.userData.noShadow = true; g.add(sd); props.sun = sd; }
  const cam = { shore: { p: [-26, 1.7, 2], l: [0, 9, -60] }, pier: { p: [2.2, 5.8, -22], l: [0, 12, -84] }, wide: { p: [-70, 20, 26], l: [0, 6, -50] }, sunset: { p: [14, 1.4, -14], l: [-60, 10, -120] } };
  aimFirst(S, cam.shore);
  return { group: g, props, cam, spots: { sand: [0, 0, 4], shore: [-10, 0, -17], pierStart: [0, 4, -8], pierEnd: [0, 4, -70], tower: [26, 2.6, -12] } };
}

// =====================================================================================================================
/** hillsSet(S, { time: 'day', seed }) - dry hills rising toward -Z with the hillside sign on a terrace, a road, the city spread below (+Z) */
export function hillsSet(S, o = {}) {
  const { time = 'day', seed = 4 } = o, night = time === 'night', r = rnd(seed * 13 + 5);
  const g = kit(S, 'hills', time, o), props = {};
  const base = (x, z) => { const k = Math.max(0, (-z - 15) / 60); return (-z - 15 > 0 ? (-z - 15) * .42 : 0) * (1 + .18 * Math.sin(x * .031 + 1)) + 7 * Math.sin(x * .022 + z * .017) * Math.min(1, k) + 3 * Math.sin(x * .07 - z * .05) * Math.min(1, k); };
  const SZ = -64, SH = base(0, SZ);
  const hf = (x, z) => { const b = base(x, z), dx = Math.max(0, Math.abs(x) - 30) / 10, dz = Math.max(0, Math.abs(z - SZ) - 6) / 8, k = Math.max(0, 1 - Math.max(dx, dz)); return b + (SH - b) * Math.min(1, k * 1.5); };
  g.add(terrain(500, 300, 90, (x, z) => hf(x, z - 100), night ? 'teal' : DRY)); g.children.at(-1).position.z = -100;
  slab(g, 500, 400, night ? 'dark' : 'concrete', 0, 240, -.03, .3);
  // the hillside sign on its terrace, facing the city
  slab(g, 50, 9, night ? 'dark' : 'sand', 0, SZ - .6, SH + .06, .5);                                                       // the terrace pad (also the sign's support for check_layout)
  const sign = P.vineSign({ seed: seed + 2 }); put(g, sign, 0, SZ, 0, SH + .06); props.sign = sign;
  // scrub on the slopes
  const sc = []; for (let i = 0; i < 420; i++) { const x = (r() - .5) * 460, z = -20 - r() * 220; if (Math.abs(x) < 34 && Math.abs(z - SZ) < 10) continue; const k = .5 + r() * 1.4; sc.push([k * 1.3, k, k * 1.3, x, hf(x, z) + k * .3, z, r() * 3]); }
  inst(g, sc, night ? 'navy' : 'green', true);
  // city below
  for (let i = 0; i < 46; i++) {
    const x = (i % 9 - 4) * 34 + (r() - .5) * 4, z = 70 + Math.floor(i / 9) * 38 + (r() - .5) * 4, fl = r() < .25 ? 20 + Math.floor(r() * 30) : 2 + Math.floor(r() * 8);
    put(g, P.skyscraper({ floors: fl, w: 16 + r() * 10, d: 16 + r() * 10, ramp: pick(r, night ? NIGHT_WALLS : DAY_WALLS), night, lit: night ? .45 : .3, seed: i, style: r() < .4 ? 'bands' : 'grid' }), x, z);
  }
  for (let i = 0; i < 20; i++) put(g, P.palmTree({ h: 9 + r() * 4, seed: i }), (r() - .5) * 300, 28 + r() * 18);
  const cam = { sign: { p: [12, hf(12, SZ + 30) + 1.8, SZ + 30], l: [0, SH + 5, SZ] }, overlook: { p: [-6, Math.max(SH, hf(-6, SZ - 30)) + 30, SZ - 30], l: [4, SH - 26, 100] },
    below: { p: [6, 2, 22], l: [0, SH + 10, SZ] }, ridge: { p: [-60, hf(-60, -110) + 6, -110], l: [0, SH + 4, SZ] } };
  aimFirst(S, cam.sign);
  return { group: g, props, cam, spots: { terrace: [0, SH, SZ + 5], signFoot: [-8, SH, SZ + 3], city: [0, 0, 60], hilltop: [0, hf(0, -110), -110] }, height: hf };
}

// =====================================================================================================================
/** roomSet(S, { time: 'night', poster (image key), poster2, walls: 'purple', floor: 'wood', rgb: 'neonPink' }) - a gamer's bedroom
 *  (4.5 x 4 m, open toward +X/+Z for the camera): bed, desk with monitor + PC, chair, posters, window, shelf, rug, LED strip */
export function roomSet(S, o = {}) {
  const { time = 'night', floor = 'wood', rgb = 'neonPink' } = o, night = time === 'night', walls = o.walls || (night ? 'plum' : 'purple');
  const g = kit(S, 'room', 'interior', o), props = {};
  slab(g, 4.5, 4, floor, 0, 0, 0, .15);
  slab(g, 40, 40, 'dark', 0, 0, -.16, .2);
  // back wall (z = -2) built around a window (x -1.95..-1.0, y 1.1..2.0), left wall (x = -2.25)
  const W = (w, h, x, y0) => shell(g, w, h, .12, walls, x, y0, -2.06);
  W(.3, 2.7, -2.1, 0); W(3.25, 2.7, .625, 0); W(.95, 1.1, -1.475, 0); W(.95, .7, -1.475, 2.0);
  shell(g, .12, 2.7, 4.12, walls, -2.31, 0, 0);
  glowBox(g, .95, .9, .02, night ? 'navy' : 'sky', -1.475, 1.55, -2.11);                                                 // the view outside
  if (night) for (let i = 0; i < 9; i++) glowBox(g, .05, .05, .01, i % 3 ? 'yellow' : 'orange', -1.85 + (i * .37) % .8, 1.15 + (i * .13) % .35, -2.1);
  for (const [w, h, x, y] of [[1.03, .05, -1.475, 2.0], [1.03, .05, -1.475, 1.1], [.05, .95, -1.95, 1.55], [.05, .95, -1.0, 1.55], [.03, .9, -1.475, 1.55]]) shell(g, w, h, .06, 'white', x, y - h / 2, -1.99);
  // bed (head against the back wall, along the left wall)
  const bed = new THREE.Group(); put(g, bed, -1.49, -.94);
  bed.add(E.box(1.4, .3, 2.0, R('wood'), [0, .15, 0]), E.box(1.36, .2, 1.96, R('paper'), [0, .4, 0]), E.box(1.38, .1, 1.3, R(o.blanket || 'denim'), [0, .52, .33]), E.box(.9, .12, .4, R('white'), [0, .56, -.7]), E.box(1.4, .5, .08, R('wood'), [0, .55, -.96]));
  bed.userData = { name: 'bed', kind: 'bed', solid: true, rest: true, size: [1.4, .8, 2.0], top: .5 }; props.bed = bed;
  const ns = new THREE.Group(); put(g, ns, -.53, -1.76); ns.add(E.box(.45, .5, .4, R('wood'), [0, .25, 0]), E.box(.36, .12, .02, R('brown'), [0, .32, .205]));
  ns.userData = { name: 'nightstand', kind: 'nightstand', solid: true, rest: true, size: [.45, .5, .4], top: .5 };
  g.add(P.onTop(P.lamp({ lit: true }), ns, { rotY: -.6 }));
  // desk corner
  const desk = put(g, P.desk({ w: 1.4, d: .7 }), .7, -1.6); props.desk = desk;
  props.monitor = P.onTop(P.monitor({ screen: o.screen || 'game', w: .6 }), desk, { dz: -.1 }); g.add(props.monitor);
  g.add(P.onTop(P.coffeeMug({ ramp: 'red' }), desk, { dx: .5, dz: .15 }));
  g.add(P.onTop(P.controller(), desk, { dx: -.4, dz: .18, rotY: .3 }));
  props.pc = put(g, P.pcTower({ rgb: true }), 1.78, -1.68);
  props.chair = put(g, P.officeChair(), .7, -.88, Math.PI);
  // posters, rug, shelf, LED strip
  const poster = (x, z, ry, key, ramp) => {
    if (key && E.IMG?.[key]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(.6, .85), E.imageMat(key)); p.position.set(x, 1.8, z); p.rotation.y = ry; g.add(p); return p; }
    const p = new THREE.Group(); p.position.set(x, 1.8, z); p.rotation.y = ry; g.add(p);
    p.add(E.box(.6, .85, .012, R(ramp), [0, 0, 0]), E.box(.4, .3, .012, R('yellowFlat'), [0, .12, .01]), E.box(.5, .1, .012, R('white'), [0, -.27, .01])); return p;
  };
  poster(.7, -1.993, 0, o.poster, 'red'); poster(-2.243, .45, Math.PI / 2, o.poster2, 'blue');
  slab(g, 2.0, 1.5, o.rug || 'teal', .3, .35, .012, .012);
  put(g, P.bookshelf({ w: .8, h: 1.6 }), -2.09, 1.35, Math.PI / 2);
  glowBox(g, 4.1, .03, .03, rgb, .05, 2.62, -1.985); glowBox(g, .03, .03, 4.0, rgb, -2.235, 2.62, 0);
  const cam = { wide: { p: [2.2, 1.95, 3.7], l: [-.4, 1.0, -1.2] }, desk: { p: [.7, 1.38, .35], l: [.7, 1.05, -1.8] }, over: { p: [1.35, 1.55, -.35], l: [.45, 1.0, -1.9] }, bed: { p: [-.2, 1.25, 1.5], l: [-1.6, .6, -1.2] } };
  aimFirst(S, cam.wide);
  return { group: g, props, cam, spots: { chair: [.7, 0, -.88], bed: [-1.49, .5, -.6], desk: [.7, .75, -1.6], center: [.4, 0, .6], window: [-1.47, 0, -1.6] } };
}

// =====================================================================================================================
/** officeSet(S, { time: 'day', carpet: 'navy', seed }) - an open-plan game studio: rows of desks with monitors and chairs, pillars,
 *  a window band with the city outside, a whiteboard, server racks, plants, hanging light panels */
export function officeSet(S, o = {}) {
  const { time = 'day', carpet = 'grey', seed = 8 } = o, night = time === 'night', r = rnd(seed * 7 + 2);
  const g = kit(S, 'office', time === 'day' ? 'interior' : 'night', o), props = { desks: [], chairs: [], monitors: [] };
  if (time === 'day') { S.sky = E.HIBIT ? [C.blue, C.sky, C.sky, C.cyan] : [C.blue, C.cyan]; S.bg = C.blue; S.fogNear = 60; S.fogFar = 260; }
  slab(g, 20, 14, carpet, 0, 0, 0, .15); slab(g, 400, 400, night ? 'dark' : 'concrete', 0, 0, -3, .3);
  shell(g, 20.2, 1.0, .25, 'white', 0, 0, -7.12); shell(g, 20.2, .5, .25, 'white', 0, 2.9, -7.12);                      // window band frame
  for (let x = -10; x <= 10.01; x += 2.5) shell(g, .12, 1.9, .2, 'dark', x, 1.0, -7.1);
  shell(g, .25, 3.4, 14.4, 'white', -10.12, 0, 0);                                                                       // left wall
  for (const x of [-4.5, 4.5]) shell(g, .6, 3.4, .6, 'concrete', x, 0, -.6);
  for (let i = 0; i < 10; i++) put(g, P.skyscraper({ floors: 8 + Math.floor(r() * 30), w: 16, d: 16, night, lit: .4, seed: i + 30, ramp: night ? 'navy' : pick(r, ['concrete', 'glass', 'white']) }), -64 + (i % 7) * 20, -40 - Math.floor(i / 7) * 26 - r() * 4);
  const row = (z, face) => [-6.5, -2.0, 2.5].forEach((x, i) => {
    const d = put(g, P.desk({ w: 1.6, d: .8 }), x, z, face); props.desks.push(d);
    for (const dx of [-.38, .38]) { const m = P.onTop(P.monitor({ screen: pick(r, ['code', 'game', 'desktop']), w: .55 }), d, { dx, dz: -.15, rotY: -dx * .5 }); g.add(m); props.monitors.push(m); }
    if (i === 1) g.add(P.onTop(P.coffeeMug(), d, { dx: .62, dz: .2 }));
    const c = put(g, P.officeChair({ ramp: pick(r, ['black', 'blue', 'red']) }), x + Math.sin(face) * 0, z + Math.cos(face) * .78, face + Math.PI + (r() - .5) * .4); props.chairs.push(c);
  });
  row(-4.2, 0); row(1.8, Math.PI);
  put(g, P.whiteboard({ stand: false, w: 2.4 }), -9.98, -1.2, Math.PI / 2, .8);
  props.racks = [put(g, P.serverRack(), 8.6, -6.3, 0), put(g, P.serverRack({ seed: 9 }), 7.95, -6.3, 0)];
  for (const [x, z] of [[-9.3, -6.3], [6.6, -6.4], [-9.3, 5.6]]) put(g, P.pottedPlant({ seed: Math.floor(x) }), x, z);
  for (const z of [-4.2, 1.8]) for (const x of [-6.5, -2, 2.5]) glowBox(g, 1.4, .05, .5, night ? 'white' : 'white', x, 3.15, z);
  const cam = { wide: { p: [8.8, 3.3, 6.8], l: [-2, .8, -3] }, aisle: { p: [-8.6, 1.6, -1.2], l: [6, 1.1, -1.4] }, desk: { p: [-2, 1.5, -2.55], l: [-2, 1.0, -4.6] }, high: { p: [0, 7.5, 9.5], l: [0, 0, -2] } };
  aimFirst(S, cam.wide);
  return { group: g, props, cam, spots: { desk1: [-6.5, 0, -3.42], desk2: [-2, 0, -3.42], desk3: [2.5, 0, -3.42], desk4: [-6.5, 0, 1.02], whiteboard: [-8.8, 0, -1.2], window: [0, 0, -6.2], racks: [7.5, 0, -5.2], aisle: [0, 0, -1.2] } };
}

// =====================================================================================================================
/** labSet(S, { ramp: 'white', grid: true, size: 40, light: 'studio' }) - a clean void with a grid floor for diagrams */
export function labSet(S, o = {}) {
  const { ramp = 'white', grid = true, size = 40 } = o;
  const g = kit(S, 'lab', 'studio', o);
  slab(g, size, size, ramp, 0, 0, 0, .2); slab(g, 600, 600, 'dark', 0, 0, -.25, .2);
  if (grid) { const L = [], G = Math.min(size, typeof grid === 'number' ? grid : 16); for (let k = -G / 2; k <= G / 2; k += 1) { L.push([G + .05, .006, .05, 0, .003, k], [.05, .006, G + .05, k, .003, 0]); }   // a 16 m grid (thin far lines alias to dots)
    inst(g, L, ramp === 'white' || ramp === 'paper' ? 'concrete' : 'navy'); }
  const cam = { front: { p: [0, 2.2, 9], l: [0, 1, 0] }, three4: { p: [6.5, 4, 7.5], l: [0, .8, 0] }, top: { p: [0, 14, .01], l: [0, 0, 0] }, low: { p: [0, .5, 6], l: [0, 1.2, 0] } };
  aimFirst(S, cam.front);
  return { group: g, props: {}, cam, spots: { center: [0, 0, 0], left: [-3, 0, 0], right: [3, 0, 0], back: [0, 0, -3], front: [0, 0, 3] } };
}

// =====================================================================================================================
/** chipSet(S, { scale: 250, ramp: 'teal' (board), gpu: false, light: 'dramatic' }) - a motherboard as a landscape: chips, slots and
 *  capacitors as buildings (at 250x a RAM stick is a 33 m wall, the CPU a 9 m plaza), on standoffs over the dark case floor */
export function chipSet(S, o = {}) {
  const { scale: k = 250, ramp = 'teal', gpu = false } = o, r = rnd(11);
  const g = kit(S, 'chip', 'night', o), props = {};
  if (!o.fog) { S.fogNear = 70; S.fogFar = 260; }
  slab(g, 900, 900, 'carbon', 0, 0, 0, .3);
  const y0 = .006 * k;                                                                                                    // 6 mm standoffs
  const mb = P.motherboard({ ramp, scale: k }); put(g, mb, 0, 0, 0, y0); Object.assign(mb.userData, { ground: true, solid: false }); mb.traverse(m => { if (m.isMesh) m.userData.ground = true; });   // (each part a support) props.board = mb;
  for (const [x, z] of [[-.14, -.11], [.14, -.11], [-.14, .11], [.14, .11], [0, -.11], [0, .11]]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.003 * k, .003 * k, y0, 6), P.M('gold')); s.position.set(x * k, y0 / 2, z * k); s.userData.ground = true; g.add(s); }
  const top = y0 + .0016 * k, L = v => v * k;
  for (let i = 0; i < 2; i++) { const s = P.ramStick({ scale: k, heatsink: i === 0, rgb: i === 0 }); put(g, s, L(.03 + i * .022), L(-.045), Math.PI / 2, top + L(.004)); s.userData.over = [mb]; s.userData.rest = false; }   // (held by its slot)
  // SMD chips and capacitor towers on the open ground
  const chips = [], pins = [], free = [[.075, .135, -.11, -.02], [-.01, .045, .0, .11], [.1, .14, .0, .1], [-.12, -.04, .093, .102]];   // board areas with no parts
  for (const [x0, x1, z0, z1] of free) for (let cx = x0 + .009; cx < x1 - .004; cx += .018) for (let cz = z0 + .009; cz < z1 - .004; cz += .018) {
    if (r() < .35) continue;
    const w = L(.006 + r() * .008), d = L(.006 + r() * .008), x = L(cx), z = L(cz);
    chips.push([w, L(.0015), d, x, top + L(.00075), z]);
    for (let p = 0; p < 6; p++) for (const sd of [-1, 1]) pins.push([L(.0006), L(.0006), L(.0012), x - w / 2 + (p + .5) * w / 6, top + L(.0003), z + sd * (d / 2 + L(.0006))]);
  }
  inst(g, chips, 'carbon', false); inst(g, pins, 'metal', true);
  const caps = []; for (let i = 0; i < 9; i++) caps.push([L(-.112 + i * .009), L(.108 + (i % 2) * .008)]);
  for (const [x, z] of caps) { const c = new THREE.Mesh(new THREE.CylinderGeometry(L(.004), L(.004), L(.011), 8).toNonIndexed(), P.M('metal')); c.geometry.computeVertexNormals(); c.position.set(x, top + L(.0055), z); c.userData = { name: 'capacitor', solid: true, rest: true, size: [L(.008), L(.011), L(.008)] }; g.add(c);
    const cr = E.box(L(.006), L(.0004), L(.001), R('dark'), [x, top + L(.011) + L(.0002), z]); g.add(cr); }
  if (gpu) { const c = P.gpuCard({ scale: k }); put(g, c, L(-.06), L(.035), 0, top + L(.011)); c.userData.over = [mb]; }
  const cpu = [L(-.035), top + L(.01), L(-.045)];
  const cam = { street: { p: [L(.125), top + 1.7, L(.0)], l: [L(.0), top + 3, L(-.045)] }, aerial: { p: [L(.16), L(.17), L(.2)], l: [0, top, 0] }, cpu: { p: [L(-.0), top + L(.035), L(-.0)], l: cpu }, ram: { p: [L(.09), top + 3, L(.02)], l: [L(.03), top + 4, L(-.06)] } };
  aimFirst(S, cam.street);
  return { group: g, props, cam, spots: { cpu, street: [L(.0), top, L(.03)], ram: [L(.05), top, L(.0)], board: [L(.06), top, L(.06)] }, scale: k };
}

// =====================================================================================================================
/** serverSet(S, { racks: 10 (per side), leds: true, light: 'night' }) - a data-centre cold aisle: racks facing it on both sides,
 *  tiled raised floor, overhead cable trays, light strips, an exit sign */
export function serverSet(S, o = {}) {
  const { racks: n = 10, leds = true } = o, len = n * .62;
  const g = kit(S, 'server room', 'night', o), props = { racks: [] };
  S.fogNear = 12; S.fogFar = 40;
  slab(g, 7, len + 6, 'concrete', 0, 0, 0, .3); slab(g, 200, 200, 'carbon', 0, 0, -.3, .2);
  const tl = []; for (let x = -3.6; x <= 3.6; x += .6) tl.push([.025, .006, len + 6, x, .003, 0]); for (let z = -len / 2 - 3; z <= len / 2 + 3; z += .6) tl.push([7, .006, .025, 0, .003, z]);
  inst(g, tl, 'grey');
  for (let i = 0; i < n; i++) { const z = -len / 2 + .31 + i * .62;
    props.racks.push(put(g, P.serverRack({ leds, seed: i * 2 + 1 }), -1.4, z, Math.PI / 2), put(g, P.serverRack({ leds, seed: i * 2 + 2 }), 1.4, z, -Math.PI / 2)); }
  for (const s of [-1, 1]) {
    shell(g, .3, 3.4, len + 6, 'dark', s * 3.6, 0, 0);
    for (const dz of [-.18, .18]) shell(g, .04, .1, len + 2, 'metal', s * 1.4 + dz, 2.4, 0);
    const rungs = []; for (let z = -len / 2 - 1; z < len / 2 + 1; z += .4) rungs.push([.36, .03, .04, s * 1.4, 2.42, z]); inst(g, rungs, 'metal', false);
    shell(g, .26, .08, len + 2, s < 0 ? 'yellowFlat' : 'blue', s * 1.4, 2.45, 0);
  }
  glowBox(g, .25, .04, len + 2, 'white', 0, 3.1, 0);
  shell(g, 7.5, 3.4, .3, 'dark', 0, 0, -len / 2 - 3.15); glowBox(g, .7, .25, .04, 'lime', 0, 2.6, -len / 2 - 2.98);
  const cam = { aisle: { p: [0, 1.6, len / 2 + 2.6], l: [0, 1.2, -len / 2] }, rack: { p: [.45, 1.3, 1.1], l: [-1.0, 1.1, .1] }, end: { p: [0, 2.8, -len / 2 - 2.2], l: [0, .8, len / 2] }, low: { p: [.5, .3, len / 2 + 1], l: [0, 1.6, -len / 2] } };
  aimFirst(S, cam.aisle);
  return { group: g, props, cam, spots: { aisle: [0, 0, 0], aisleFront: [0, 0, len / 2 + 1], aisleEnd: [0, 0, -len / 2] } };
}

// =====================================================================================================================
/** phoneMacroSet(S, { scale: 200, light: 'dramatic' }) - inside a phone at macro scale: the aluminium frame, the battery, the logic
 *  board with the SoC (die blocks visible), shield cans, camera modules, a flex cable, screws, tiny parts */
export function phoneMacroSet(S, o = {}) {
  const { scale: k = 200 } = o, r = rnd(21), L = v => v * k;
  const g = kit(S, 'phone macro', 'dramatic', o), props = {};
  S.fogNear = 40; S.fogFar = 140;
  slab(g, 300, 300, 'carbon', 0, 0, -.3, .2);
  slab(g, L(.075), L(.155), 'black', 0, 0, 0, .3);                                                                       // display back
  for (const s of [-1, 1]) { shell(g, .45, L(.008), L(.155) + .9, 'metal', s * (L(.0375) + .22), -.3, 0); shell(g, L(.075), L(.008), .45, 'metal', 0, -.3, s * (L(.0775) + .22)); }
  // battery (lower 60 %)
  const bat = new THREE.Group(); put(g, bat, 0, L(.03));
  bat.add(E.box(L(.064), L(.005), L(.09), R('black'), [0, L(.0025), 0]), E.box(L(.04), .05, L(.05), R('paper'), [0, L(.005) + .025, L(.005)]), E.box(L(.03), .05, L(.008), R('red'), [0, L(.005) + .06, L(-.014)]));
  bat.userData = { name: 'battery', kind: 'battery', solid: true, rest: true, size: [L(.064), L(.005), L(.09)], top: L(.005) }; props.battery = bat;
  // logic board (top)
  const board = slab(g, L(.068), L(.04), 'navy', 0, L(-.052), L(.0012), L(.0012)); board.userData.name = 'logic board';
  const bt = L(.0012);
  props.soc = put(g, P.socChip({ scale: k }), L(.01), L(-.055), 0, bt); props.soc.userData.over = [board];
  for (const [x, z, w, d] of [[-.018, -.06, .016, .014], [.024, -.044, .012, .016], [.024, -.064, .01, .01]]) { const c = shell(g, L(w), L(.0016), L(d), 'metal', L(x), bt, L(z)); c.userData = { name: 'shield can', solid: true, rest: true, size: [L(w), L(.0016), L(d)] };
    const vh = []; for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) vh.push([.12, .02, .12, L(x - w / 2) + (i + .5) * L(w) / 6, bt + L(.0016) + .01, L(z - d / 2) + (j + .5) * L(d) / 4]); inst(g, vh, 'dark', true); }
  for (const [x, z, rr] of [[-.022, -.04, .006], [-.008, -.038, .0045]]) { const cm = new THREE.Group(); put(g, cm, L(x), L(z), 0, bt);
    cm.add(E.box(L(rr * 2.3), L(.005), L(rr * 2.3), R('carbon'), [0, L(.0025), 0]));
    const ln = new THREE.Mesh(new THREE.CylinderGeometry(L(rr), L(rr), L(.002), 12).toNonIndexed(), P.M('glass')); ln.geometry.computeVertexNormals(); ln.position.y = L(.006); cm.add(ln);
    const rg = new THREE.Mesh(new THREE.CylinderGeometry(L(rr * .5), L(rr * .5), L(.0022), 10).toNonIndexed(), P.M('carbon')); rg.geometry.computeVertexNormals(); rg.position.y = L(.0062); cm.add(rg);
    cm.userData = { name: 'camera module', kind: 'camera module', solid: true, rest: true, size: [L(rr * 2.3), L(.007), L(rr * 2.3)] }; }
  const fp = [[L(-.004), bt + .05, L(-.0325)], [L(-.004), bt + .55, L(-.0295)], [L(-.004), L(.005) + .35, L(-.0215)], [L(-.004), L(.005) + .06, L(-.016)]];   // flex ribbon board -> battery
  for (let i = 1; i < fp.length; i++) beam(g, fp[i - 1], fp[i], 2.4, .08, 'orange');
  shell(g, 2.8, .3, 1.2, 'carbon', L(-.004), bt, L(-.0325));
  const smd = []; for (let i = 0; i < 160; i++) { const x = L(-.032 + r() * .064), z = L(-.07 + r() * .036); if (Math.hypot(x - L(.01), z - L(-.055)) < L(.012)) continue; smd.push([.14 + r() * .2, .1, .08 + r() * .12, x, bt + .05, z, r() < .5 ? 0 : Math.PI / 2]); }
  inst(g, smd.filter((_, i) => i % 2), 'sand', true); inst(g, smd.filter((_, i) => !(i % 2)), 'grey', true);
  for (const [x, z] of [[-.0315, -.069], [.0315, -.069], [-.0315, -.034], [.0315, -.034]]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .2, 8).toNonIndexed(), P.M('metal')); s.geometry.computeVertexNormals(); s.position.set(L(x), bt + .1, L(z)); g.add(s); g.add(E.box(.6, .03, .1, R('dark'), [L(x), bt + .21, L(z)])); }
  const soc = [L(.01), bt + L(.0018), L(-.055)];
  const cam = { soc: { p: [L(.03), bt + 3.2, L(-.035)], l: soc }, wide: { p: [L(.07), L(.09), L(.1)], l: [0, 0, L(-.01)] }, battery: { p: [L(-.05), 3.2, L(.07)], l: [0, L(.005), L(.03)] }, low: { p: [5.5, bt + .8, -5.4], l: [L(.01), bt + .3, L(-.056)] } };
  aimFirst(S, cam.soc);
  return { group: g, props, cam, spots: { soc, board: [L(-.005), bt, L(-.05)], battery: [0, L(.005), L(.03)], frame: [0, 0, L(.07)] }, scale: k };
}

// =====================================================================================================================
/** stageSet(S, { plinths: 3, accent: 'neonCyan', beams: true }) - a dark keynote stage: round stage with a glowing rim, back wall,
 *  a truss with spotlights and dithered light cones onto plinths in an arc. spots.plinth0..n = plinth tops */
export function stageSet(S, o = {}) {
  const { plinths: n = 3, accent = 'neonCyan', beams = true } = o;
  const g = kit(S, 'stage', 'dramatic', o), props = { plinths: [] };
  S.light = [-.3, 1, .5];
  slab(g, 200, 200, 'carbon', 0, 0, 0, .2);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, .5, 16).toNonIndexed(), P.M('dark')); st.geometry.computeVertexNormals(); st.position.y = .25; st.userData.ground = true; g.add(st);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(7.5, .06, 3, 32).toNonIndexed(), P.glow(accent)); rim.rotation.x = Math.PI / 2; rim.position.y = .46; g.add(rim);
  shell(g, 26, 10, .5, 'black', 0, 0, -9.5);
  for (let i = 0; i < 7; i++) glowBox(g, .08, 7, .05, i % 2 ? accent : 'navy', -9 + i * 3, 4, -9.24);
  shell(g, 18, .35, .35, 'metal', 0, 7.4, -1); shell(g, 18, .35, .35, 'metal', 0, 7.4, 1.2);
  const pl = []; for (let i = 0; i < n; i++) pl.push(P.plinth({ w: 1.1, h: 1.0, ramp: o.plinthRamp || 'white', accent }));
  P.arrange(pl, { arc: 5, spread: n > 1 ? 70 : 0, z: -2, y: .5 }); pl.forEach(p => { g.add(p); props.plinths.push(p); });
  const spots = { center: [0, .5, 0], left: [-3.5, .5, 1.5], right: [3.5, .5, 1.5], front: [0, .5, 4] };
  pl.forEach((p, i) => { spots['plinth' + i] = [p.position.x, p.position.y + p.userData.top, p.position.z];
    const fx = p.position.x * .8, fz = .1, fy = 7.2; g.add(E.box(.4, .5, .4, R('black'), [fx, fy, fz]));
    if (beams) { const top = new THREE.Vector3(fx, fy - .25, fz), bot = new THREE.Vector3(p.position.x, p.position.y + p.userData.top + .05, p.position.z), d = bot.clone().sub(top), h = d.length();
      const cn = new THREE.Mesh(new THREE.CylinderGeometry(.12, .75, h, 10, 1, true), E.facet(R('yellowFlat'), { opacity: .2, side: THREE.DoubleSide, unlit: true }));
      cn.position.copy(top).add(bot).multiplyScalar(.5); cn.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize()); cn.userData.noShadow = true; cn.userData.noOutline = true; g.add(cn); } });
  const cam = { front: { p: [0, 2.6, 11.5], l: [0, 1.6, -1] }, wide: { p: [10, 6.5, 13], l: [0, 1.4, -2] }, low: { p: [2.2, .95, 6.2], l: [0, 2.2, -2] }, top: { p: [0, 13, 5], l: [0, 0, -1] } };
  aimFirst(S, cam.front);
  return { group: g, props, cam, spots };
}

export const SETS = {
  citySet: { make: citySet, desc: "Los Santos street; { time: 'day'|'sunset'|'night', length, seed, traffic } cams street wide low skyline" },
  highwaySet: { make: highwaySet, desc: 'freeway; { time, length } cams chase side overpass gantry' },
  beachSet: { make: beachSet, desc: "sunset pier + Ferris wheel; { time, sun } cams shore pier wide sunset" },
  hillsSet: { make: hillsSet, desc: 'hills + hillside sign + city below; { time } cams sign overlook below ridge' },
  roomSet: { make: roomSet, desc: "gamer bedroom; { time, poster, poster2, walls, floor, rgb, screen } cams wide desk over bed" },
  officeSet: { make: officeSet, desc: 'open-plan game studio; { time, carpet } cams wide aisle desk high' },
  labSet: { make: labSet, desc: 'clean grid void for diagrams; { ramp, grid, size } cams front three4 top low' },
  chipSet: { make: chipSet, desc: 'motherboard landscape at 250x; { scale, ramp, gpu } cams street aerial cpu ram' },
  serverSet: { make: serverSet, desc: 'data-centre aisle; { racks, leds } cams aisle rack end low' },
  phoneMacroSet: { make: phoneMacroSet, desc: 'inside a phone at 200x; { scale } cams soc wide battery low' },
  stageSet: { make: stageSet, desc: 'dark keynote stage + plinths; { plinths, accent, beams } cams front wide low top' },
};

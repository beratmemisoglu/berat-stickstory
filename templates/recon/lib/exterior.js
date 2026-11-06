// EXTERIORS (engine v16): the world outside, so no exterior shot and no window shows a void (docs: the skill's
// references/engine_api.md "Maps and exteriors"). Before v16 crew builds showed a white void behind the terminal glass, a
// plain block for the terminal and aircraft floating over the apron (docs/CREW_BUILD.md runs 1-4).
//   import { horizon, apron, terminal, restOnGround, vehicle, landingGear } from '../lib/exterior.js';
//   horizon(S, { time: 'afternoon', kind: 'airport', y: -4.5 })    // sky + sun + far horizon (from inside, behind the glass too)
//   const A = apron(S, { y: -4.5, stands: [-10, 10], model: 'airliner', front: '+z' })   // painted stands, parked aircraft ON
//      their wheels, jet bridges to the facade, service vehicles, light masts (+ horizon() unless horizon: false)
//   const T = terminal(S, { y: -4.5, x0: -40, x1: 40, roof: 'sawtooth' })   // a terminal's airside face: glazing, roofline
// Frame of apron() and terminal(): the facade runs along x at z = 0 and faces -z (the apron lies at z < 0, the building at
// z > 0), ground level y = o.y; o.at = [x, z] and o.yaw (deg) move and turn the whole thing. Units: metres.
// Vehicles follow the prop contract (lib/props.js): prop('tug'), place(S, prop('fuel truck'), { at, face }) work too.
import { THREE, THEME, THEME_ID, selectable } from '../engine.js';
import { airliner, AC, fusY, fusR, WING, wingAt } from '../models.js';
import { MODELS, model } from './library.js';
import { propGroup, defineProp, part as P, boxPart as Bx, cylinder as cyl, mat } from './props.js';

const INV = THEME_ID === 'investigation';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const hh = (i, n = 0) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
const OUTDOOR = {   // older engines (no THEME.outdoor): the v16 values
  studio: { sky: { day: ['#a3bfd8', '#e4e8ea', '#cfcdc6'], afternoon: ['#b2c1cd', '#e9dfcd', '#cdc5b6'], dusk: ['#5a6d8a', '#e2b58f', '#8a7c6e'], night: ['#0c1321', '#28324a', '#17191f'] },
    sun: { day: [0xfffaf0, 2.8, 55], afternoon: [0xffe4c0, 2.6, 26], dusk: [0xffae78, 1.9, 7], night: [0x9fb4e0, .55, 40] }, haze: { day: '#dfe3e5', afternoon: '#e2d8c6', dusk: '#c9a184', night: '#202838' } },
  investigation: { sky: { day: ['#2a3746', '#8a949b', '#34373a'], afternoon: ['#262f3a', '#a08f7b', '#3a3732'], dusk: ['#101826', '#7a5c47', '#221f1c'], night: ['#04060a', '#182030', '#0b0c0e'] },
    sun: { day: [0xe6edf5, 1.9, 50], afternoon: [0xffd6a8, 2.1, 24], dusk: [0xff9e68, 1.6, 7], night: [0x8fa6d6, .5, 40] }, haze: { day: '#6f777d', afternoon: '#7d7163', dusk: '#5a4536', night: '#151b26' } },
};
const OUT = () => { const d = OUTDOOR[INV ? 'investigation' : 'studio'], t = THEME?.outdoor || {}; return { sky: { ...d.sky, ...(t.sky || {}) }, sun: { ...d.sun, ...(t.sun || {}) }, haze: { ...d.haze, ...(t.haze || {}) } }; };
// materials of the outdoors per look (Investigation: a few stops darker, never black)
const C = INV
  ? { concrete: '#5d5f62', joint: 'rgba(0,0,0,.32)', ground: { desert: 0x5b5246, grass: 0x34402f, concrete: 0x4c4e51, city: 0x3e4044 }, far: 0x4a4e54, farWin: 0x8c7b5e, metal: 0x5d6268, glass: 0x1b2128, wall: 0x6b6d70, roof: 0x8a8d91, white: 0xb9bcbf, tyre: 0x141517, yellow: '#b8962e', red: '#9a2a26', line: '#c9c9c4' }
  : { concrete: '#bdbcb6', joint: 'rgba(0,0,0,.16)', ground: { desert: 0xc9b896, grass: 0x9fae86, concrete: 0xb5b4ae, city: 0xa9a8a3 }, far: 0xb3b6b9, farWin: 0x8b9aa8, metal: 0xa9adb2, glass: 0x4c5966, wall: 0xc9c6bf, roof: 0xe2e0da, white: 0xf1f0ec, tyre: 0x2a2b2e, yellow: '#e2b53a', red: '#c8463e', line: '#f4f3ee' };
const std = (c, r = .8, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, ...x });
function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...o.repeat); } return t;
}
const backdrop = o => { o.traverse(m => { m.userData.noContact = true; m.userData.backdrop = true; m.userData.noPick = true; m.castShadow = false; m.receiveShadow = false; }); return o; };
function merged(geos) {   // one geometry from many (same material): far silhouettes are drawn in a few calls
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = []; let off = 0;
  for (const g0 of geos) { const g = g0.index ? g0 : g0; pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3);
    if (g.index) for (const i of g.index.array) idx.push(i + off); else for (let i = 0; i < g.attributes.position.count; i++) idx.push(i + off); off += g.attributes.position.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setIndex(idx); return m;
}

/** horizon(S, o): the sky for the time of day, the sun, a ground to the horizon and far silhouettes in the haze, so an
 *  exterior or a window never shows a void. o: { time: 'day' | 'afternoon' | 'dusk' | 'night' (default: afternoon),
 *  kind: 'airport' | 'city' | 'desert' | 'flat', y (ground level, 0), center: [x, z] (0, 0), dist (the far ring, 700 m),
 *  dir: [x, z] + arc (deg): only that sector (e.g. the view through the glass: dir [0, -1], arc 150), ground: 'desert' |
 *  'grass' | 'concrete' | 'city' | false, sun (true; false inside a room that has its own key), sunAz (deg, 0 = from
 *  the north/-z, 90 = from +x; default 215), fog (true), seed }. Returns { group, sun, sky: [top, horizon, ground], haze }. */
export function horizon(S, o = {}) {
  const L = OUT(), time = o.time ?? 'afternoon', sky = L.sky[time] ?? L.sky.afternoon, haze = L.haze[time] ?? L.haze.afternoon;
  const y = o.y ?? 0, [cx, cz] = o.center ?? [0, 0], dist = o.dist ?? 700, seed = o.seed ?? 7, kind = o.kind ?? 'airport';
  S.sky(sky[0], sky[1], sky[2]);
  if (o.fog !== false) { S.scene.fog = new THREE.Fog(new THREE.Color(haze), o.fogNear ?? dist * .45, o.fogFar ?? dist * 2.4); if (S.cam.far < dist * 2) { S.cam.far = dist * 2.6; S.cam.updateProjectionMatrix(); } }
  const G = new THREE.Group(); G.name = 'horizon'; S.scene.add(G);
  // the ground out to the horizon, 0.6 m under the level (never coplanar with an apron or a road laid at y)
  if (o.ground !== false) { const gc = C.ground[o.ground ?? (kind === 'city' ? 'city' : kind === 'airport' ? 'desert' : kind)] ?? C.ground.desert;
    const gm = new THREE.Mesh(new THREE.CircleGeometry(dist * 3, 64), std(gc, 1)); gm.rotation.x = -Math.PI / 2; gm.position.set(cx, y - .6, cz); gm.name = 'ground to the horizon'; gm.receiveShadow = true; gm.userData.ground = true; G.add(gm); }
  // far silhouettes on the ring (one merged mesh per material)
  const a0 = o.dir ? Math.atan2(o.dir[0], -o.dir[1]) : 0, arc = (o.arc ?? 360) * D2R, n = Math.round((o.arc ?? 360) / 360 * (kind === 'city' ? 90 : kind === 'airport' ? 46 : 30));
  const solid = [], lit = [], sheds = [];
  const put = (list, geo, x, yy, z, ry = 0) => { geo.rotateY(ry); geo.translate(x, yy, z); list.push(geo); };
  for (let i = 0; i < n && kind !== 'flat'; i++) {
    const a = a0 - arc / 2 + arc * (i + .5) / n + (hh(i, seed) - .5) * arc / n * .6, r = dist * (.85 + hh(i, seed + 1) * .3), x = cx + Math.sin(a) * r, z = cz - Math.cos(a) * r, ry = -a;
    const u = hh(i, seed + 2), w = 20 + hh(i, seed + 3) * 70;
    if (kind === 'city') { const h = 12 + Math.pow(u, 2.2) * 110; put(solid, new THREE.BoxGeometry(w * .6, h, w * .5), x, y + h / 2 - .5, z, ry); if (u > .4) put(lit, new THREE.BoxGeometry(w * .6 + .4, h * .55, .4), x, y + h * .55, z, ry); }
    else if (kind === 'airport') {
      if (u < .45) { const h = 9 + u * 18; put(solid, new THREE.BoxGeometry(w * 1.6, h, 22), x, y + h / 2 - .5, z, ry); put(lit, new THREE.BoxGeometry(w * 1.6 + .4, 2.2, 22.4), x, y + h * .62, z, ry); }        // far terminals and offices
      else if (u < .7) { const h = 12 + u * 10, hg = new THREE.CylinderGeometry(h, h, w * 1.2, 20, 1, false, 0, Math.PI); hg.rotateZ(Math.PI / 2); put(sheds, hg, x, y - .5, z, ry); }   // hangars (vaulted, along the ring)
      else if (u < .78) { put(solid, new THREE.CylinderGeometry(.35, .45, 26, 8), x, y + 12.5, z); put(lit, new THREE.BoxGeometry(3, 1.2, 1.2), x, y + 25.5, z, ry); }   // light masts
      else { const h = 4 + u * 6; put(solid, new THREE.BoxGeometry(w * .8, h, 12), x, y + h / 2 - .5, z, ry); }   // low service buildings
    } else if (kind === 'desert') { const h = 6 + u * 26; const rg = new THREE.ConeGeometry(w * 1.8, h, 4, 1); put(solid, rg, x, y + h / 2 - 1, z, ry + Math.PI / 4); }
  }
  if (kind === 'airport' && (o.tower ?? true)) {   // the control tower: shaft, cab, roof
    const a = a0 + (o.towerAt ?? -.22) * arc, r = dist * .75, x = cx + Math.sin(a) * r, z = cz - Math.cos(a) * r;
    put(solid, new THREE.CylinderGeometry(3, 4.2, 58, 16), x, y + 29 - .5, z); put(lit, new THREE.CylinderGeometry(8, 6, 6, 12), x, y + 61, z); put(solid, new THREE.CylinderGeometry(8.8, 8.8, 1.4, 12), x, y + 64.7, z);
  }
  const farM = std(C.far, .95), litM = std(C.far, .6, { emissive: new THREE.Color(C.farWin), emissiveIntensity: time === 'night' ? 1.4 : time === 'dusk' ? .8 : .18 });
  for (const [list, m, name] of [[solid, farM, 'far buildings'], [lit, litM, 'far windows'], [sheds, farM, 'far hangars']]) if (list.length) { const mesh = new THREE.Mesh(merged(list), m); mesh.name = name; G.add(mesh); }
  // the haze band: a soft lighter band low on the horizon behind the silhouettes (keeps the far scene from going flat)
  const hz = canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); const c = new THREE.Color(haze); const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(.6, `rgba(${rgb},.55)`); g.addColorStop(1, `rgba(${rgb},.85)`); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  // (a cylinder's theta runs (sin, cos) in (x, z); the ring's angle a runs (sin a, -cos a): theta = PI - a)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(dist * 1.35, dist * 1.35, dist * .16, 64, 1, true, Math.PI - a0 - arc / 2, arc), new THREE.MeshBasicMaterial({ map: hz, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide }));
  band.position.set(cx, y + dist * .07, cz); band.name = 'horizon haze'; G.add(band);
  backdrop(G); G.children.filter(m => m.userData.ground).forEach(m => { m.receiveShadow = true; m.userData.noPick = true; });
  // the sun
  let sun = null;
  if (o.sun !== false) { const s = L.sun[time] ?? L.sun.afternoon, az = (o.sunAz ?? 215) * D2R, el = s[2] * D2R, d = 220, area = o.sunArea ?? 90;
    sun = new THREE.DirectionalLight(s[0], s[1] * (o.sunI ?? 1)); sun.position.set(cx + Math.sin(az) * Math.cos(el) * d, y + Math.sin(el) * d, cz - Math.cos(az) * Math.cos(el) * d); sun.target.position.set(cx, y, cz);
    sun.castShadow = true; Object.assign(sun.shadow.camera, { left: -area, right: area, top: area, bottom: -area, near: 1, far: d * 2.2 }); sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; sun.shadow.radius = 4;
    sun.name = 'sun'; S.scene.add(sun, sun.target); }
  return { group: G, sun, sky, haze, time };
}

/** restOnGround(obj, y = 0, o): stand a model on the ground at y: its wheels when it has parts named like wheels / tyres /
 *  gear (o.wheels: a RegExp), else its lowest point; with wheels, also pitched so the front and rear wheels touch together
 *  (a downloaded aircraft's nose wheel often hangs a few cm above its mains). Call after positioning and turning it. */
export function restOnGround(obj, y = 0, o = {}) {
  const re = o.wheels ?? /wheel|tyre|tire|gear|bogie/i, wheels = [];
  obj.traverse(m => { if (m.isMesh && (re.test(m.name || '') || re.test(m.parent?.name || ''))) wheels.push(m); });
  const centre = m => new THREE.Box3().setFromObject(m, true).getCenter(V());
  const lowest = list => { let lo = Infinity; for (const m of list) lo = Math.min(lo, new THREE.Box3().setFromObject(m, true).min.y); return lo; };
  obj.updateMatrixWorld(true);
  if (wheels.length >= 2 && o.level !== false) {
    for (let it = 0; it < 3; it++) {
      const cs = wheels.map(centre); let A = cs[0], B = cs[0], dm = -1;
      for (const p of cs) for (const q of cs) { const d = Math.hypot(p.x - q.x, p.z - q.z); if (d > dm) { dm = d; A = p; B = q; } }
      if (dm < .3) break;
      const ax = V(B.x - A.x, 0, B.z - A.z).normalize(), mid = (A.clone().add(B)).multiplyScalar(.5), side = cs.map(c => (c.x - mid.x) * ax.x + (c.z - mid.z) * ax.z);
      const fr = wheels.filter((m, i) => side[i] > 0), rr = wheels.filter((m, i) => side[i] <= 0);
      if (!fr.length || !rr.length) break;
      const dh = lowest(fr) - lowest(rr); if (Math.abs(dh) < .002) break;
      const perp = V(-ax.z, 0, ax.x), ang = Math.atan2(dh, dm);
      for (const sgn of [1, -1]) { obj.rotateOnWorldAxis(perp, sgn * ang); obj.updateMatrixWorld(true); const d2 = lowest(fr) - lowest(rr); if (Math.abs(d2) < Math.abs(dh)) break; obj.rotateOnWorldAxis(perp, -sgn * ang); obj.updateMatrixWorld(true); }
    }
  }
  const lo = wheels.length ? lowest(wheels) : new THREE.Box3().setFromObject(obj, true).min.y;
  obj.position.y += y - lo - (o.sink ?? .003); obj.updateMatrixWorld(true);
  return obj;
}

/** landingGear(plane): nose gear + two main gears for the built-in airliner (models.js airliner(), which has none: it was
 *  made for a ditching), sized like an A320's (engines 0.6 m off the ground). apron() adds it; restOnGround() stands on it. */
export function landingGear(plane) {
  const g = new THREE.Group(); g.name = 'landing gear'; plane.add(g);
  const tyre = std(C.tyre, .85), hub = std(C.metal, .4, { metalness: .4 }), strut = std(C.metal, .35, { metalness: .5 });
  const zOf = s => s - AC.L / 2, ground = -3.95;
  const wheel = (x, z, r, w, name) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 24), tyre); m.rotation.z = Math.PI / 2; m.position.set(x, ground + r, z); m.name = name; m.castShadow = true; g.add(m);
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(r * .5, r * .5, w + .02, 16), hub); hb.rotation.z = Math.PI / 2; hb.position.copy(m.position); hb.name = name + ' hub'; g.add(hb); };
  const leg = (x, z, y0, y1, r, name) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 12), strut); m.position.set(x, (y0 + y1) / 2, z); m.name = name; m.castShadow = true; g.add(m); };
  const axle = (x, z, y0, len, r, name) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), strut); m.rotation.z = Math.PI / 2; m.position.set(x, y0, z); m.name = name; g.add(m); };   // through both wheels and the strut
  // nose gear (s = 5 m): two small wheels under the nose
  const sN = 5, zN = zOf(sN), yN = fusY(sN) - fusR(sN) + .25;
  leg(0, zN, ground + .38, yN, .09, 'nose gear strut'); axle(0, zN, ground + .38, .62, .05, 'nose gear axle'); for (const x of [-.24, .24]) wheel(x, zN, .38, .2, 'nose gear wheel');
  // main gears (s = 17.4 m) under the wing roots: two wheels each side, track 7.6 m
  const sM = 17.4, zM = zOf(sM);
  for (const side of [-1, 1]) { const x = side * 3.8, yW = wingAt(x).y - .1; leg(x, zM, ground + .58, yW, .13, 'main gear strut');   // up into the wing
    axle(x, zM, ground + .58, 1.1, .08, 'main gear axle'); for (const dx of [-.42, .42]) wheel(x + dx, zM, .58, .34, 'main gear wheel'); }
  return g;
}

// ---------- vehicles (the prop contract: origin at the footprint centre on the ground, front +Z) ----------
const tyreM = () => mat(C.tyre, .85), metalM = () => mat(C.metal, .4, .4), glassM = () => mat(C.glass, .15, .2), whiteM = () => mat(C.white, .55);
// a wheel pair and its axle as ONE mesh: small wheels far away still count as what the vehicle stands on (contact.js checks
// only parts 8 px or bigger on screen; a lone wheel would drop out and leave the body "floating")
const wheelPair = (g, z, r, halfTrack, w = .3, name = 'wheels') => {
  const geo = cache2(`wp${r}|${halfTrack}|${w}`, () => { const parts = [-1, 1].map(s => { const c = new THREE.CylinderGeometry(r, r, w, 20); c.rotateZ(Math.PI / 2); c.translate(s * halfTrack, 0, 0); return c; });
    const ax = new THREE.CylinderGeometry(r * .18, r * .18, halfTrack * 2, 8); ax.rotateZ(Math.PI / 2); return merged([...parts, ax]); });
  return P(g, geo, tyreM(), 0, r, z, name);
};
const VEH = {
  // pushback tug: a low heavy body, a sunken cab to one side, the tow bar at the front. 6 x 1.7 x 2.6 m
  'tug': [[2.6, 1.7, 6], (g, o) => { const body = mat(new THREE.Color(o.color ?? C.yellow).getHex(), .6);
    wheelPair(g, -1.8, .45, 1.05, .42); wheelPair(g, 1.8, .45, 1.05, .42);
    Bx(g, 2.5, .75, 5.8, body, 0, .3, 0, 'tug body', .06);
    Bx(g, 1.1, .7, 1.3, glassM(), .55, 1.0, -1.6, 'tug cab glass', .04); Bx(g, 1.2, .08, 1.4, body, .55, 1.68, -1.6, 'tug cab roof', .02);
    for (const sx of [.05, 1.05]) for (const sz of [-2.25, -.95]) Bx(g, .08, .72, .08, metalM(), sx, 1.0, sz, 'tug cab post', .01);
    Bx(g, .25, .2, 1.3, metalM(), 0, .45, 3.45, 'tow bar', .02); return {}; }],
  // baggage cart: flat bed, four posts, a canopy, bags on the bed. 1.5 x 1.7 x 3 m
  'baggage cart': [[1.5, 1.7, 3], (g, o) => { const fr = mat(C.metal, .5, .3);
    wheelPair(g, -1.05, .22, .62, .16); wheelPair(g, 1.05, .22, .62, .16);
    Bx(g, 1.5, .12, 3, fr, 0, .38, 0, 'cart bed', .02);
    for (const sx of [-.7, .7]) for (const sz of [-1.42, 1.42]) Bx(g, .06, 1.1, .06, fr, sx, .49, sz, 'cart post', .005);
    Bx(g, 1.56, .06, 3.06, mat(INV ? 0x4a5058 : 0x8f9aa8, .8), 0, 1.58, 0, 'cart canopy', .01);
    const bags = [0x3a3f48, 0x6b3a36, 0x2f3a46, 0x4c5a3e, 0x5d5a55]; let k = o.seed ?? 3;
    for (let i = 0; i < 5; i++) { const w = .42 + hh(k, i) * .2, h = .55 + hh(k + 1, i) * .25; Bx(g, w, h, .28, mat(bags[i % bags.length], .7), -.35 + (i % 2) * .7, .5, -1.1 + i * .5, 'bag', .04); }
    Bx(g, .12, .1, .7, fr, 0, .3, 1.8, 'cart drawbar', .01); return {}; }],
  // belt loader: chassis, a small cab at the rear, a belt rising to the front (cargo door height). 2.1 x 2.6 x 7.6 m
  'belt loader': [[2.1, 2.6, 7.6], (g, o) => { const body = whiteM(), dk = mat(C.tyre, .7);
    wheelPair(g, -2.6, .38, .9, .3); wheelPair(g, 2.6, .38, .9, .3);
    Bx(g, 2.0, .45, 7.2, body, 0, .45, 0, 'loader chassis', .04);
    Bx(g, 1.0, 1.15, 1.1, glassM(), .45, .88, -2.9, 'loader cab', .05);
    const belt = new THREE.Group(); belt.name = 'loader belt'; belt.position.set(0, 1.55, .3); belt.rotation.x = -Math.atan2(1.9, 7.4); g.add(belt);
    Bx(belt, .9, .1, 7.6, dk, 0, -.05, 0, 'belt', .02); for (const sx of [-.5, .5]) Bx(belt, .08, .28, 7.6, metalM(), sx, -.18, 0, 'belt rail', .01);
    for (const sz of [-1.4, 1.6]) Bx(g, .16, 1.0 + (sz + 1.4) * .26, .16, metalM(), 0, .82, sz, 'belt support', .01);
    return {}; }],
  // fuel truck: cab, chassis, a long tank. 2.5 x 3.2 x 10 m
  'fuel truck': [[2.5, 3.2, 10], (g, o) => { const body = whiteM(), tank = mat(INV ? 0x8d9196 : 0xd8dadd, .35, .35);
    wheelPair(g, 3.4, .52, 1.0, .4); wheelPair(g, -2.0, .52, 1.0, .4); wheelPair(g, -3.4, .52, 1.0, .4);
    Bx(g, 2.3, .5, 9.6, mat(C.tyre, .6), 0, .62, 0, 'truck chassis', .04);
    Bx(g, 2.45, 2.2, 2.0, body, 0, .9, 3.85, 'truck cab', .12); Bx(g, 2.2, .9, .1, glassM(), 0, 2.05, 4.84, 'truck windscreen', .02);
    const tg = cyl(1.1, 1.1, 6.6, 28); P(g, tg, tank, 0, 2.18, -.9, 'fuel tank', [Math.PI / 2, 0, 0]);
    for (const sz of [-4.2, 2.4]) P(g, cache2('tankend', () => new THREE.SphereGeometry(1.1, 24, 12)), tank, 0, 2.18, sz, 'fuel tank end').scale.set(1, 1, .28);
    return {}; }],
  // catering truck: cab, a box body raised on a scissor lift. 2.5 x 4.2 x 8.5 m
  'catering truck': [[2.5, 4.2, 8.5], (g, o) => { const body = whiteM();
    wheelPair(g, 3.0, .45, 1.0, .36); wheelPair(g, -2.6, .45, 1.0, .36);
    Bx(g, 2.3, .45, 8.2, mat(C.tyre, .6), 0, .55, 0, 'truck chassis', .04);
    Bx(g, 2.4, 2.1, 1.9, body, 0, .8, 3.2, 'truck cab', .1); Bx(g, 2.15, .85, .1, glassM(), 0, 1.9, 4.12, 'truck windscreen', .02);
    for (const s of [-1, 1]) { const r = P(g, cyl(.06, .06, 2.9, 8), metalM(), 0, 1.75, -1.5, 'scissor arm', [s * .62, 0, 0]); void r; }
    Bx(g, 2.5, 2.4, 5.6, body, 0, 2.6, -1.4, 'catering box', .05); Bx(g, 2.52, .3, 5.62, mat(INV ? 0x2f3a46 : 0x3c5a86, .6), 0, 4.3, -1.4, 'catering stripe', .02);
    return {}; }],
  // apron bus: long, low floor, a window band, doors. 3 x 3.1 x 13.5 m
  'bus': [[3, 3.1, 13.5], (g, o) => { const body = whiteM();
    wheelPair(g, 4.8, .45, 1.2, .36); wheelPair(g, -4.8, .45, 1.2, .36);
    Bx(g, 2.9, 2.6, 13.3, body, 0, .35, 0, 'bus body', .2); Bx(g, 2.96, 1.05, 12.6, glassM(), 0, 1.55, 0, 'bus windows', .1);
    Bx(g, 2.6, .12, 12.8, mat(C.metal, .6), 0, 2.94, 0, 'bus roof', .05); return {}; }],
  // airport fire truck (ARFF): big wheels, a long red body, a roof turret. 3 x 3.6 x 10.5 m
  'fire truck': [[3, 3.6, 10.5], (g, o) => { const red = mat(new THREE.Color(C.red).getHex(), .5);
    for (const z of [3.4, -1.2, -3.6]) wheelPair(g, z, .7, 1.1, .5);
    Bx(g, 2.9, 2.3, 10.2, red, 0, .75, 0, 'fire truck body', .12); Bx(g, 2.6, .8, .1, glassM(), 0, 2.15, 5.12, 'fire truck windscreen', .02);
    P(g, cyl(.35, .45, .5, 16), metalM(), 0, 3.3, 3.2, 'roof turret'); P(g, cyl(.08, .1, 1.6, 10), metalM(), 0, 3.55, 3.95, 'turret nozzle', [Math.PI / 2.4, 0, 0]);
    Bx(g, 1.4, .14, .3, mat(0x2050ff, .3), 0, 3.05, 4.7, 'light bar', .03); return {}; }],
  // ambulance: cab + box body, a red stripe, a light bar. 2.2 x 2.9 x 6.2 m
  'ambulance': [[2.2, 2.9, 6.2], (g, o) => { const body = whiteM();
    wheelPair(g, 2.0, .4, .9, .28); wheelPair(g, -1.9, .4, .9, .28);
    Bx(g, 2.1, 1.6, 1.6, body, 0, .45, 2.1, 'ambulance cab', .12); Bx(g, 1.9, .65, .1, glassM(), 0, 1.35, 2.9, 'ambulance windscreen', .02);
    Bx(g, 2.2, 2.3, 4.2, body, 0, .45, -.8, 'ambulance box', .08); Bx(g, 2.24, .22, 4.22, mat(new THREE.Color(C.red).getHex(), .5), 0, 1.3, -.8, 'ambulance stripe', .02);
    Bx(g, 1.2, .14, .3, mat(0x2050ff, .3), 0, 2.75, .9, 'light bar', .03); return {}; }],
};
const GEO2 = new Map(); const cache2 = (k, f) => { let g = GEO2.get(k); if (!g) { g = f(); GEO2.set(k, g); } return g; };
export const VEHICLE_KINDS = Object.keys(VEH);
/** vehicle(kind, o): an airport service vehicle (tug, baggage cart, belt loader, fuel truck, catering truck, bus, fire
 *  truck, ambulance) on its wheels, front +Z, following the prop contract (also prop(kind) once this module is imported). */
export function vehicle(kind, o = {}) {
  const v = VEH[kind]; if (!v) throw new Error(`vehicle: unknown kind "${kind}". Kinds: ${VEHICLE_KINDS.join(', ')}`);
  return propGroup(kind, o, g => ({ mount: 'floor', ...(v[1](g, o) || {}) }));
}
for (const [k, v] of Object.entries(VEH)) defineProp(k, o => vehicle(k, o), { size: v[0], mount: 'floor', note: 'airport vehicle, front +Z (lib/exterior.js)' });

// ---------- the apron ----------
const FRONT = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 };
/** apron(S, o): an airport apron in front of a terminal facade: concrete with joints and painted stand markings (one
 *  texture: no decals, nothing coplanar), aircraft parked nose-in ON their wheels, jet bridges from the facade to the
 *  forward door, service vehicles at work, light masts, and horizon() for the sky and the far airport.
 *  o: { y (apron level, 0), at: [x, z], yaw (deg), x0 / x1 (-100 / 100), depth (140), stands: n | [x, ...] | [{ x, model,
 *  front, size }] (3), spacing (48), model (a loaded MODELS key; default the built-in airliner + landingGear), front
 *  ('+z' | '-z' | '+x' | '-x': where the model's nose points in its file; scouts report it; default '+z'), size (37.6 m),
 *  wheels (RegExp of its wheel parts), noseGap (9 m facade to nose), floor (4.5: the gate level above the apron, where the
 *  bridges meet the facade), bridges, vehicles, masts, markings (all true), labels: ['401', ...] (stand numbers painted),
 *  time, horizon (true | horizon() options), seed }.
 *  Returns { group, slab, aircraft, bridges, vehicles, masts, stands: [{ x, nose, door }] (world), solids, horizon }. */
export function apron(S, o = {}) {
  const y = o.y ?? 0, x0 = o.x0 ?? -100, x1 = o.x1 ?? 100, D = o.depth ?? 140, W = x1 - x0, seed = o.seed ?? 11, gap = o.noseGap ?? 9;
  const G = new THREE.Group(); G.name = o.name ?? 'apron'; if (o.at) G.position.set(o.at[0], 0, o.at[1]); G.rotation.y = (o.yaw ?? 0) * D2R; S.scene.add(G);
  const sp = o.spacing ?? 48, ns = Array.isArray(o.stands) ? o.stands.length : (o.stands ?? 3);
  const stands = (Array.isArray(o.stands) ? o.stands : Array.from({ length: ns }, (_, i) => (i - (ns - 1) / 2) * sp)).map((s, i) => typeof s === 'number' ? { x: s } : s);
  const need = (o.size ?? AC.L) * 1.15;   // a wingspan (~ the length of an airliner) + clearance between the wingtips
  for (let i = 1; i < stands.length; i++) { const d = Math.abs(stands[i].x - stands[i - 1].x); if (d < need) throw new Error(`apron: stands ${d.toFixed(0)} m apart: parked airliners need about ${need.toFixed(0)} m (wingspan + clearance). Space the stands (spacing / stands: [x, ...]) or park fewer.`); }
  // the slab, painted in one texture: concrete, slab joints every 5 m, the service road along the facade, per stand a yellow
  // lead-in line, a stop bar at the nose and a red safety box; stand numbers
  const ppm = Math.min(12, 4096 / W, 4096 / D), TW = Math.round(W * ppm), TH = Math.round(D * ppm);
  const tex = canvasTex(TW, TH, (x) => {
    const X = wx => (wx - x0) * ppm, Z = wz => (wz + D) * ppm;   // world (local) x / z -> canvas px (row 0 = the far edge, z = -D)
    x.fillStyle = C.concrete; x.fillRect(0, 0, TW, TH);
    for (let i = 0; i < 2600; i++) { const v = hh(i, seed) * .09; x.fillStyle = `rgba(${INV ? '0,0,0' : '60,58,54'},${v})`; x.fillRect(hh(i, seed + 1) * TW, hh(i, seed + 2) * TH, 3 + hh(i, seed + 3) * 40, 3 + hh(i, seed + 4) * 30); }
    x.strokeStyle = C.joint; x.lineWidth = Math.max(1, ppm * .04); for (let wx = Math.ceil(x0 / 5) * 5; wx <= x1; wx += 5) { x.beginPath(); x.moveTo(X(wx), 0); x.lineTo(X(wx), TH); x.stroke(); }
    for (let wz = -D; wz <= 0; wz += 5) { x.beginPath(); x.moveTo(0, Z(wz)); x.lineTo(TW, Z(wz)); x.stroke(); }
    if (o.markings !== false) {
      const line = (a, b, col, w, dash) => { x.strokeStyle = col; x.lineWidth = Math.max(1.2, w * ppm); x.setLineDash(dash ? dash.map(d => d * ppm) : []); x.beginPath(); x.moveTo(X(a[0]), Z(a[1])); x.lineTo(X(b[0]), Z(b[1])); x.stroke(); x.setLineDash([]); };
      line([x0, -6], [x1, -6], C.line, .15, [3, 3]); line([x0, -1.2], [x1, -1.2], C.line, .15);   // the service road along the facade
      stands.forEach((s, i) => {
        line([s.x, -D], [s.x, -gap - 1], C.yellow, .2); line([s.x - 3, -gap - 1.5], [s.x + 3, -gap - 1.5], C.yellow, .35);   // lead-in line + stop bar
        x.strokeStyle = C.red; x.lineWidth = Math.max(1.2, .18 * ppm); x.setLineDash([1.2 * ppm, .8 * ppm]); x.strokeRect(X(s.x - 20), Z(-gap - 42), 40 * ppm, 34 * ppm); x.setLineDash([]);   // safety area
        const lab = (o.labels || [])[i] ?? s.label; if (lab) { x.save(); x.translate(X(s.x + 2.5), Z(-D + 14)); x.fillStyle = C.yellow; x.font = `700 ${Math.round(3.2 * ppm)}px Inter, Arial, sans-serif`; x.fillText(String(lab), 0, 0); x.restore(); }
      });
    }
  });
  const side = std(INV ? 0x45474a : 0xa9a8a2, .9), top = std(0xffffff, .88, { map: tex });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, .4, D), [side, side, top, side, side, side]); slab.position.set((x0 + x1) / 2, y - .2, -D / 2); slab.receiveShadow = true; slab.name = 'apron'; slab.userData.ground = true; G.add(slab);
  const solids = [slab], aircraft = [], bridges = [], vehicles = [], masts = [], out = [];
  G.updateMatrixWorld(true);
  const W2 = v => G.localToWorld(v.clone());
  // aircraft at the stands, nose-in, ON their wheels
  for (const s of stands) {
    const key = s.model ?? o.model, L = s.size ?? o.size ?? AC.L;
    let a;
    if (key && MODELS[key]) { a = model(key, { size: L, look: o.look ?? 'tone', name: s.name ?? 'airliner' }); a.rotation.y = FRONT[s.front ?? o.front ?? '+z'] ?? 0; }
    else { a = airliner(null); landingGear(a); a.rotation.y = Math.PI; a.scale.setScalar(L / AC.L); selectable(a, s.name ?? 'airliner', 'vehicle'); }
    // the nose exactly gap metres off the facade, whatever the model's origin (measured before it joins the group: G-local)
    a.position.set(s.x, y, 0); a.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(a, true); a.position.z = -gap - bb.max.z;
    G.add(a); a.updateMatrixWorld(true);
    restOnGround(a, y, { wheels: o.wheels });
    // the airframe is held by its gear: only the wheels / gear are checked for contact (an engine on its pylon or a fin
    // would read as a loose part to contact.js, which only lets slender things hang at their side)
    const wre = o.wheels ?? /wheel|tyre|tire|gear|bogie/i; a.traverse(m => { if (m.isMesh && !wre.test(m.name || '') && !wre.test(m.parent?.name || '')) m.userData.noContact = true; });
    aircraft.push(a); solids.push(a);
    const door = V(s.x + L * .053 + .35, y + L * .09, -(gap + L * .15));   // the forward left door (port = +x for a nose-in aircraft)
    out.push({ x: s.x, nose: W2(V(s.x, y + L * .1, -gap)), door: W2(door), plane: a });
    // the jet bridge: rotunda off the facade on a column, a sloping tunnel, the cab at the door, the drive leg with wheels
    if (o.bridges !== false && s.bridge !== false) {
      const bm = std(C.white, .5, { metalness: .2 }), gl = std(C.glass, .2), fl = y + (o.floor ?? 4.5), B = new THREE.Group(); B.name = 'jet bridge'; G.add(B);
      const rx = s.x + 12, rz = -3.4, rot = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 3.0, 24), bm); rot.position.set(rx, fl + 1.5, rz); rot.name = 'bridge rotunda'; B.add(rot);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(.45, .55, fl - y + .203, 12), bm); col.position.set(rx, (fl + y) / 2 + .1, rz); col.name = 'bridge column'; B.add(col);   // 3 mm into the apron, 20 cm into the rotunda
      const link = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, rz * -1 + .3), bm); link.position.set(rx, fl + 1.4, rz / 2 + .15); link.name = 'bridge link'; B.add(link);
      const cab = V(door.x + 1.75, door.y - .1, door.z), from = V(rx, fl, rz), dir = V(cab.x - from.x, 0, cab.z - from.z), len = dir.length(), drop = (fl) - (cab.y);
      const tun = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.7, len - 1.2), bm), mid = from.clone().lerp(V(cab.x, cab.y, cab.z), .5);
      tun.position.set(mid.x, (fl + cab.y) / 2 + 1.35, mid.z); tun.rotation.order = 'YXZ'; tun.rotation.y = Math.atan2(dir.x, dir.z); tun.rotation.x = Math.atan2(drop, len); tun.name = 'bridge tunnel'; B.add(tun);
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.56, .7, len - 1.6), gl); band.position.copy(tun.position).add(V(0, .45, 0)); band.rotation.copy(tun.rotation); band.name = 'bridge windows'; B.add(band);
      const cb = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.9, 3.2), bm); cb.position.set(cab.x, cab.y + 1.45, cab.z); cb.name = 'bridge cab'; B.add(cb);
      const lp = from.clone().lerp(cab, .72), legH = (fl + (cab.y - fl) * .72) - y;
      // the drive unit: leg + axle + wheels in one group (one thing standing on its wheels, for contact.js too)
      const dv = new THREE.Group(); dv.name = 'bridge drive'; B.add(dv);
      const lg = new THREE.Mesh(new THREE.BoxGeometry(.5, legH - .3 + .1, .5), bm); lg.position.set(lp.x, y + .3 + (legH - .3 + .1) / 2, lp.z); lg.name = 'bridge leg'; dv.add(lg);   // from the axle up 10 cm into the tunnel
      const ax = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.5, 10), bm); ax.rotation.z = Math.PI / 2; ax.position.set(lp.x, y + .417, lp.z); ax.name = 'bridge axle'; dv.add(ax);
      for (const sx of [-.6, .6]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .3, 16), std(C.tyre, .85)); wh.rotation.z = Math.PI / 2; wh.position.set(lp.x + sx, y + .417, lp.z); wh.name = 'bridge wheel'; dv.add(wh); }
      // rotunda, link, tunnel and cab are held by the column and the drive leg by construction (contact.js would call them
      // floating: nothing under their lowest points); the column, leg and wheels stay checked
      B.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; if (!/column|leg|wheel|axle/.test(m.name)) m.userData.noContact = true; } }); selectable(B, 'jet bridge', 'building'); bridges.push(B); solids.push(B);
    }
    // service vehicles around the aircraft (seeded): a tug at the nose, a belt loader + baggage carts at the forward hold, a
    // fuel truck and an apron bus between the stands
    if (o.vehicles !== false && s.vehicles !== false) {
      const k = Math.round(s.x * 7 + seed), add = (kind, x, z, ry, vo = {}) => { const v = vehicle(kind, { seed: k, ...vo }); v.position.set(x, y, z); v.rotation.y = ry; G.add(v); vehicles.push(v); solids.push(v); return v; };
      if (hh(k, 1) < .65) add('tug', s.x, -gap + 3.4, Math.PI);
      // (the forward hold door ~7.5 m aft of the nose, ahead of the engine nacelle)
      if (hh(k, 2) < .8) { add('belt loader', s.x - L * .053 - 4.6, -(gap + L * .2), Math.PI / 2); for (let c = 0; c < 2 + Math.floor(hh(k, 3) * 2); c++) add('baggage cart', s.x - L * .053 - 10.6 - c * 3.6, -(gap + L * .2), Math.PI / 2, { seed: k + c }); }
      if (hh(k, 4) < .5) add('fuel truck', s.x + sp * .5 - 3, -(gap + 8), Math.PI * (hh(k, 5) < .5 ? 0 : 1));
      else if (hh(k, 6) < .6) add('bus', s.x + sp * .5 - 1, -(gap + 30), 0);
    }
  }
  // light masts along the far edge
  if (o.masts !== false) { const lm = std(C.metal, .5, { metalness: .3 }), lamp = std(0x111111, .4, { emissive: new THREE.Color(0xfff0d8), emissiveIntensity: (o.time === 'night' || o.time === 'dusk') ? 2.2 : .5 });
    for (let mx = x0 + 30; mx <= x1 - 20; mx += 60) { const M = new THREE.Group(); M.name = 'apron light mast'; G.add(M);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(.3, .45, 26, 10), lm); p.position.set(mx, y + 13, -D + 8); p.name = 'mast pole'; M.add(p);
      const hd = new THREE.Mesh(new THREE.BoxGeometry(4, .9, .9), lm); hd.position.set(mx, y + 26.3, -D + 8); hd.name = 'mast head'; M.add(hd);
      for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(.8, .5, .12), lamp); l.position.set(mx - 1.5 + i, y + 26.2, -D + 8 + .5); l.name = 'mast lamp'; M.add(l); }
      M.traverse(m => { if (m.isMesh) m.castShadow = true; }); masts.push(M); } }
  // the sun from the apron side (it lights the facade, the aircraft's faces and the vehicles; az is in G's turned frame)
  const H = o.horizon === false ? null : horizon(S, { kind: 'airport', time: o.time, y, center: [G.position.x, G.position.z], sunAz: (o.sunAz ?? 35) - (o.yaw ?? 0), ...(typeof o.horizon === 'object' ? o.horizon : {}) });
  return { group: G, slab, aircraft, bridges, vehicles, masts, stands: out, solids, horizon: H };
}

// ---------- the terminal's airside face ----------
/** terminal(S, o): a terminal building seen from the apron (or from far): a lower service level (concrete, doors), the
 *  glazed gate level with mullions and transoms and the hall's light behind the glass, a roof with an overhanging canopy.
 *  o: { y (apron level, 0), at, yaw, x0 / x1 (-60 / 60), depth (36), lower (4.5: the gate level above the apron), glazed
 *  (6.5), roof: 'flat' | 'sawtooth' | 'vault', gates: [{ x, label }] (signs over the bridge doors), lit (true: the hall
 *  glows behind the glass), name }. Returns { group, solids, floorY, roofY } (world heights). */
export function terminal(S, o = {}) {
  const y = o.y ?? 0, x0 = o.x0 ?? -60, x1 = o.x1 ?? 60, W = x1 - x0, Dp = o.depth ?? 36, lo = o.lower ?? 4.5, gz = o.glazed ?? 6.5, cx = (x0 + x1) / 2;
  const G = new THREE.Group(); G.name = o.name ?? 'terminal'; if (o.at) G.position.set(o.at[0], 0, o.at[1]); G.rotation.y = (o.yaw ?? 0) * D2R; S.scene.add(G);
  const wall = std(C.wall, .85), dark = std(INV ? 0x1d1f22 : 0x5a5f66, .5), roof = std(C.roof, .7), mull = std(INV ? 0x1a1c1f : 0x3d4247, .4, { metalness: .4 }), solids = [];
  const add = (geo, m, x, yy, z, name) => { const me = new THREE.Mesh(geo, m); me.position.set(x, yy, z); me.name = name; me.castShadow = me.receiveShadow = true; G.add(me); return me; };
  // lower service level: concrete with dark openings (one texture)
  const lt = canvasTex(1024, 128, (x, w, h) => { x.fillStyle = INV ? '#5d5f62' : '#c4c1ba'; x.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) { x.fillStyle = INV ? '#16181b' : '#4a4f55'; x.fillRect(30 + i * 84, h * .3, 46, h * .7); } x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, w, 6); }, { repeat: [W / 60, 1] });
  solids.push(add(new THREE.BoxGeometry(W, lo, Dp), [wall, wall, wall, wall, wall, std(0xffffff, .85, { map: lt })], cx, y + lo / 2, Dp / 2, 'terminal service level'));
  // the gate level: the hall's glow behind tinted glass (one texture: ceiling light lines, a few silhouettes), mullions, transoms
  const gt = canvasTex(1024, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, INV ? '#2a2c2e' : '#6b7480'); g.addColorStop(1, INV ? '#121416' : '#3e4650'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (o.lit !== false) { x.fillStyle = INV ? 'rgba(255,226,184,.55)' : 'rgba(255,248,232,.7)'; for (let i = 0; i < 3; i++) x.fillRect(0, 20 + i * 18, w, 4); for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(10,10,12,${.35 + hh(i, 5) * .3})`; x.fillRect(hh(i, 6) * w, h * .55, 10, h * .45); } } });
  const glass = std(0xffffff, .12, { map: gt, emissive: 0xffffff, emissiveMap: gt, emissiveIntensity: INV ? .55 : .3, metalness: .2 }); gt.wrapS = THREE.RepeatWrapping; gt.repeat.set(W / 40, 1);
  solids.push(add(new THREE.BoxGeometry(W, gz, Dp - 1), [wall, wall, wall, wall, wall, glass], cx, y + lo + gz / 2, Dp / 2 + .5, 'terminal glazing'));
  const mg = []; for (let x = x0 + 2; x < x1 - .5; x += 2) { const b = new THREE.BoxGeometry(.14, gz, .3); b.translate(x, y + lo + gz / 2, .45); mg.push(b); }
  for (const yy of [y + lo + 2.4, y + lo + 4.6]) { const b = new THREE.BoxGeometry(W, .14, .3); b.translate(cx, yy, .45); mg.push(b); }
  add(merged(mg), mull, 0, 0, 0, 'terminal mullions');
  // roof + canopy overhang (+ fascia), then the roof shape
  const ry = y + lo + gz;
  solids.push(add(new THREE.BoxGeometry(W + 2, .9, Dp + 4), roof, cx, ry + .45, Dp / 2 - 1.2, 'terminal roof'));
  add(new THREE.BoxGeometry(W + 2.1, .5, .3), dark, cx, ry + .2, -3.2, 'roof fascia');
  let top = ry + .9;
  if (o.roof === 'sawtooth') { const n = Math.max(1, Math.round(W / 14)), tw = W / n, sg = [];
    for (let i = 0; i < n; i++) { const pr = new THREE.CylinderGeometry(tw * .58, tw * .58, Dp + 2, 3, 1); pr.rotateX(Math.PI / 2); pr.rotateZ(Math.PI); pr.scale(1, .55, 1); pr.translate(x0 + tw * (i + .5), top + tw * .58 * .55 * .5 - .05, Dp / 2 - 1.2); sg.push(pr); }
    add(merged(sg.map(g => g.toNonIndexed ? g.toNonIndexed() : g)), roof, 0, 0, 0, 'sawtooth roof'); top += tw * .45; }
  else if (o.roof === 'vault') { const vg = new THREE.CylinderGeometry(Dp * .6, Dp * .6, W, 40, 1, false, .45, Math.PI - .9); vg.rotateZ(Math.PI / 2); vg.scale(1, .32, 1);   // the top arc (sin >= .43)
    add(vg, roof, cx, top - Dp * .6 * .32 * Math.sin(.45) - .05, Dp / 2 - 1.2, 'vaulted roof'); top += Dp * .6 * .32 * (1 - Math.sin(.45)); }
  // gate signs over the bridge doors
  for (const gte of o.gates || []) { const st = canvasTex(256, 96, (x, w, h) => { x.fillStyle = INV ? '#101214' : '#20262c'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2d45c'; x.font = '700 60px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(gte.label ?? ''), w / 2, h / 2 + 3); });
    add(new THREE.BoxGeometry(3.2, 1.2, .2), [dark, dark, dark, dark, dark, std(0xffffff, .5, { map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: .6 })], gte.x, ry - .9, .1, `gate sign ${gte.label ?? ''}`); }
  selectable(G, G.name, 'building'); G.updateMatrixWorld(true);
  return { group: G, solids, floorY: y + lo, roofY: top };
}

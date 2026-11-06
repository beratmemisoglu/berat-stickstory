// Whole dressed places for the 3D toon shorts: S.place(name, o) builds a complete, lit, dressed environment in ONE call
// (floor / terrain, walls or sky, the light rig + practicals, 12-30 props in three depth layers, something always moving)
// and returns where things are, so a scene starts from a place and then customises it for its story:
//   const P = S.place('living-room', { seed: 2, mood: 'night', era: '90s' });
//   const m = S.char('main', { at: P.spots.couch.slice(0, 2), ry: P.spots.couch[2] });
//   S.camera('creep', P.cams.wide);                 // or { ...P.cams.couch, on: m, frame: 'mcu' } to frame the actor
//   S.prop('mug', { on: P.props.table, at: [.2, -.9] });    P.props.tv.userData.show('news')
// Options on every place: seed (colours, names, prop choice, small dressing), mirror (true: the layout flipped left-right),
// mood ('day' | 'night' | 'warm' (sunset / evening) | 'cold' | 'alarm' | 'storm'; aliases sunset, evening, dusk, rain, red),
// era ('modern' | '80s' | '90s' | '1919' | 'medieval' | '60s' where it fits), density (.5-1.5: how much small dressing),
// maxLights (real point lights, default 4), wall / floor colours, names and sign texts (o.name, o.names, o.title, o.board,
// o.menu ...) and per-place options (PLACES[n].opts lists them). Aliases pick variants: 'park', 'island', 'trench', 'canyon',
// 'lunar-module', 'cafe' ... (placeAliases()).
// Returns { name, spots: { name: [x, z, ry] (+ y for floating spots in space / under water) }, cams: { name: { on: [x, y, z],
// frame (m tall at `on`), yaw, height (deg), fov, spot | seat (who it frames), note } } (spread it into S.camera; to frame an
// actor instead use { ...cam, on: actor, frame: 'mcu' }), props: { name: Object3D } (the main pieces, addressable),
// seats: { name: { at: [x, z], ry, y, p: [x, y, z] (actor.sit(seat.p, t, { ry: seat.ry })), prop } }, tops: { name: prop with
// userData.top }, bounds, room (interiors: { w, h, zb (back wall z), zf (front wall z), x0, x1 }), mood, era }.
// Interiors face +z: the back wall is at room.zb, the camera side is +z; the front wall hides itself when a camera is behind it.
// Everything is original (invented names on every sign).
// Rules kept by every place: no void at the 9:16 frame edges from the returned cams (rooms are closed boxes whose sides,
// floor and ceiling run on past the front so a pulled-back camera never leaves the set; exteriors have a sky dome, fog
// matched to the horizon and a far layer), textured floors, at least two practical lights that bloom, a light budget
// (o.maxLights real point lights, default 4: other lamps keep their glow without a light), something always moving.
import { THREE, C, rnd, shade, mixHex, canvasTex, noise1, clamp, lerp } from './core.js';
import { toonMat } from './rig.js';
import { addOutline, outlineAll, Noodle } from './geo.js';
import * as SETS from './sets.js';
import { prop as makeProp, REG as PROP_REG } from './props.js';
import * as FX from './fx.js';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';

const INK = C.ink, PI = Math.PI, TAU = PI * 2, D2R = PI / 180;
export const PLACES = {};
const ALIAS = {};
export function build(S, name, o = {}) {
  const key = PLACES[name] ? name : ALIAS[name];
  const p = PLACES[key];
  if (!p) { console.warn(`unknown place "${name}" (lib/places.js: ${placeNames().join(', ')})`); return { spots: {}, cams: {}, props: {} }; }
  const c = ctxOf(S, key, { ...(p.defaults || {}), ...o }); c.asked = name;   // an alias can pick a variant ('park', 'island', 'cafe')
  const before = new Set(S.scene.children);
  p.make(c);
  if (c.o.mirror) mirror(c, before);
  return result(c);
}
/** o.mirror: the whole layout flipped left-right. Props and pieces move (x -> -x) and turn (ry -> -ry) but are not
 *  mirrored themselves (their text stays readable); ground, effects and light rigs are mirrored; spots, cams, seats follow. */
function mirror(c, before) {
  const S = c.S, flipObj = o => { o.position.x *= -1; o.rotation.y = -o.rotation.y; o.rotation.z = -o.rotation.z; };
  for (const o of [...S.scene.children]) {
    if (before.has(o)) continue;
    if (o === c.room?.group) { for (const k of [...c.room.front.children]) if (k.userData.pickRoot || k.userData.kind) flipObj(k); continue; }
    if (o.isLight) { o.position.x *= -1; if (o.target) o.target.position.x *= -1; continue; }
    if (o.renderOrder === -10) continue;                       // the sky dome is symmetric
    flipObj(o); if (!(o.userData.pickRoot || o.userData.kind || o.userData.actor)) o.scale.x *= -1;
  }
  for (const s of Object.values(c.spots)) { s[0] = -s[0]; s[2] = -s[2]; }
  for (const cm of Object.values(c.cams)) { cm.on[0] = -cm.on[0]; cm.yaw = -cm.yaw; }
  for (const st of Object.values(c.seats)) { st.at[0] = -st.at[0]; st.p[0] = -st.p[0]; st.ry = -st.ry; }
  if (c.bounds && c.bounds.x0 != null) { const { x0, x1 } = c.bounds; c.bounds.x0 = -x1; c.bounds.x1 = -x0; }
  if (S.bounds && S.bounds.x0 != null && !c.room) { const { x0, x1 } = S.bounds; S.bounds.x0 = -x1; S.bounds.x1 = -x0; }
}
export const placeNames = () => Object.keys(PLACES).sort();
export const placeAliases = () => ({ ...ALIAS });
const def = (name, aliases, tags, desc, opts, make, defaults) => { PLACES[name] = { tags, desc, opts, make, defaults }; for (const a of aliases) ALIAS[a] = name; };

// =====================================================================================================================
// context: seeded choices, the prop helper with the light budget, spots, cams
// =====================================================================================================================
const MOODS = { sunset: 'warm', evening: 'warm', dusk: 'warm', golden: 'warm', dark: 'night', rain: 'storm', red: 'alarm', danger: 'alarm' };
const strHash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
function ctxOf(S, name, o) {
  const seed = +o.seed || 1, R = rnd(seed * 977 + strHash(name) % 9973);
  const c = { S, o, R, seed, name, mood: MOODS[o.mood] || o.mood || 'day', era: o.era || 'modern', dens: clamp(+(o.density ?? 1), .3, 2),
    props: {}, spots: {}, cams: {}, seats: {}, tops: {}, nLights: 0, maxLights: o.maxLights ?? 4 };
  return c;
}
function result(c) {
  return { name: c.name, spots: c.spots, cams: c.cams, props: c.props, seats: c.seats, tops: c.tops, bounds: c.S.bounds || c.bounds || null, mood: c.mood, era: c.era, room: c.room || null, lights: c.nLights };
}
const pick = (c, a) => a[Math.floor(c.R() * a.length) % a.length];
const chance = (c, p) => c.R() < p * c.dens;
const rr = (c, a, b) => a + c.R() * (b - a);
const many = (c, n) => Math.max(0, Math.round(n * c.dens));
/** a spot where a character stands / sits / walks to: [x, z, ry] */
const spot = (c, name, x, z, ry = 0) => (c.spots[name] = [+x.toFixed(3), +z.toFixed(3), +ry.toFixed(3)]);
/** a camera: look at `on` (the frame's centre), `frame` metres tall there, from yaw (deg, 0 = from +z) and height (deg) */
function cam(c, name, on, frame, yaw = 0, height = 8, fov = 40, extra = {}) {
  // inside a room the lens stays under the ceiling and inside the side walls (a steep angle is flattened to fit)
  const d = frame / 2 / Math.tan(fov * D2R / 2), r = c.room;
  if (r) { // a reverse angle never backs through the back wall: the frame tightens until the lens fits
    const cz = Math.cos(yaw * D2R) * Math.cos(height * D2R); if (!r.openBack && cz < -.05 && on[2] + d * cz < r.zb + .2) { const dm = (on[2] - (r.zb + .2)) / -cz; frame = +(2 * dm * Math.tan(fov * D2R / 2)).toFixed(2); }
    const dd = frame / 2 / Math.tan(fov * D2R / 2), top = r.h - .18; if (on[1] + dd * Math.sin(height * D2R) > top) height = Math.asin(clamp((top - on[1]) / dd, -1, 1)) / D2R;
    const px = () => on[0] + dd * Math.cos(height * D2R) * Math.sin(yaw * D2R); let k = 0;
    const axis = Math.cos(yaw * D2R) >= 0 ? 0 : 180;
    while ((px() > r.x1 - .15 || px() < r.x0 + .15) && k++ < 80) yaw -= Math.sign(Math.sin((yaw - axis) * D2R)) || 0; }
  return (c.cams[name] = { on: on.map(v => +v.toFixed(3)), frame, yaw: +yaw.toFixed(1), height: +height.toFixed(1), fov, ...extra });
}
/** a seat: { at: [x, z], ry, y, p: [x, y, z] (the seat point: actor.sit(seat.p, t, { ry: seat.ry })), prop } */
const seat = (c, name, p, x, z, ry, y) => { const yy = y ?? p?.userData?.seat ?? .45; c.seats[name] = { at: [x, z], ry, y: yy, p: [x, yy, z], prop: p || null }; };

/** put a registry prop: name ('a|b' = the first that exists), o: at [x, z] | [x, y, z], y, ry, on (a prop with a top), key
 *  (return it by that name), parent (an Object3D instead of the scene), light (true keep / false drop its lamp light),
 *  sway (amplitude rad: plants) + the prop's own options. Missing props are skipped (null). */
function P(c, name, o = {}) {
  const nm = String(name).split('|').find(n => PROP_REG[n]); if (!nm) return null;
  const { at = [0, 0], key, parent, light, on, y, ry, sway, shadow, ...rest } = o;
  let g;
  try { g = makeProp(nm, { seed: Math.floor(c.R() * 1e5), ...rest }); } catch (e) { console.warn(`place ${c.name}: prop ${nm} failed: ${e.message}`); return null; }
  let yy = y ?? 0;
  if (on) { on.updateMatrixWorld(true); const top = on.userData.top ?? (new THREE.Box3().setFromObject(on).max.y - on.position.y); yy = on.position.y + top * on.scale.y + (y ?? 0); }
  if (at.length === 3) g.position.set(at[0], at[1], at[2]); else g.position.set(at[0], yy, at[1]);
  if (ry != null) g.rotation.y = ry;
  g.traverse(m => { if (m.isMesh && !m.userData.isOutline) { m.castShadow = shadow !== false; m.receiveShadow = true; } });
  budget(c, g, light);
  if (sway) swayIt(g, sway, c.R() * 10);
  if (parent) parent.add(g); else c.S.add(g);
  if (key) c.props[key] = g;
  return g;
}
/** real lights cost every pixel: keep at most c.maxLights (light: true forces one, false drops it; the glow stays) */
function budget(c, g, want) {
  const ls = []; g.traverse(o => { if (o.isLight) ls.push(o); });
  for (const L of ls) {
    if (want === true || (want !== false && L.intensity > 0 && c.nLights < c.maxLights)) { c.nLights++; L.castShadow = false; continue; }
    L.parent?.remove(L); L.target?.parent?.remove(L.target);
  }
}
/** a point light of the place itself (window spill, fire, screens): counted in the budget */
function lamp(c, at, color, intensity = 2, dist = 6, parent = null) {
  if (c.nLights >= c.maxLights) return null;
  const L = new THREE.PointLight(color, intensity, dist, 2); L.position.set(...at); L.userData.noPick = true; (parent || c.S.scene).add(L); c.nLights++; return L;
}
const chain = (obj, f) => { const prev = obj.userData.update; obj.userData.update = prev ? (t, S) => { prev(t, S); f(t, S); } : f; return obj; };
/** a slow sway (plants, hanging things, trees): rotates around the base, a pure function of t */
function swayIt(g, amp = .03, ph = 0, speed = .5) { const rx = g.rotation.x, rz = g.rotation.z; return chain(g, t => { g.rotation.z = rz + amp * noise1(t * speed + ph, 3); g.rotation.x = rx + amp * .6 * noise1(t * speed * .8 + ph, 5); }); }
/** an effect from lib/fx.js, if it exists (a missing kind never crashes a place) */
function fx(c, kind, o) { if (!FX.KINDS?.[kind]) return null; try { return FX.make(c.S, kind, o); } catch (e) { console.warn(`place ${c.name}: fx ${kind}: ${e.message}`); return null; } }

// =====================================================================================================================
// geometry, materials, textures
// =====================================================================================================================
const GEO = new Map();
const memo = (k, f) => { let g = GEO.get(k); if (!g) { g = f(); g.userData.shared = true; GEO.set(k, g); } return g; };
const q = v => Math.round(v * 1e4) / 1e4;
/** rounded box centred on its middle, smooth normals (the ink hull never cracks) */
function rbox(w, h, d, r = .02, seg = 2) {
  r = Math.max(1e-4, Math.min(r, w / 2 * .999, h / 2 * .999, d / 2 * .999));
  return memo(`rb${q(w)},${q(h)},${q(d)},${q(r)},${seg}`, () => {
    const s = seg * 2 + 1, b = new THREE.BoxGeometry(1, 1, 1, s, s, s), g = b.toNonIndexed(); b.dispose();
    const Pp = g.attributes.position.array, N = g.attributes.normal.array, UV = g.attributes.uv.array, hs = .5 / s, n = new THREE.Vector3(), bx = w / 2 - r, by = h / 2 - r, bz = d / 2 - r;
    for (let i = 0, k = 0; i < Pp.length; i += 3, k += 2) { const x = Pp[i], y = Pp[i + 1], z = Pp[i + 2], ox = N[i], oy = N[i + 1], oz = N[i + 2];
      n.set(x - Math.sign(x) * hs, y - Math.sign(y) * hs, z - Math.sign(z) * hs).normalize();
      const X = bx * Math.sign(x) + n.x * r, Y = by * Math.sign(y) + n.y * r, Z = bz * Math.sign(z) + n.z * r;
      Pp[i] = X; Pp[i + 1] = Y; Pp[i + 2] = Z; N[i] = n.x; N[i + 1] = n.y; N[i + 2] = n.z;
      // uv from the final position on the face (labels and posters are not squeezed into the middle)
      const u = (a, L) => a / L + .5;
      if (Math.abs(oz) > .5) { UV[k] = u(oz > 0 ? X : -X, w); UV[k + 1] = u(Y, h); }
      else if (Math.abs(ox) > .5) { UV[k] = u(ox > 0 ? -Z : Z, d); UV[k + 1] = u(Y, h); }
      else { UV[k] = u(X, w); UV[k + 1] = u(oy > 0 ? -Z : Z, d); } }
    g.computeBoundingSphere(); return g;
  });
}
/** rounded cylinder standing from y = 0 to h (top radius rt, bottom rb, rim bevel b) */
function rcyl(rt, rb = rt, h = .1, b = .01, seg = 32) {
  b = Math.max(1e-4, Math.min(b, rt * .98, rb * .98, h / 2 * .98));
  return memo(`rc${q(rt)},${q(rb)},${q(h)},${q(b)},${seg}`, () => {
    const pts = [new THREE.Vector2(0, 0)], arc = (cx, cy, a0, a1) => { for (let i = 0; i <= 4; i++) { const a = a0 + (a1 - a0) * i / 4; pts.push(new THREE.Vector2(cx + Math.cos(a) * b, cy + Math.sin(a) * b)); } };
    arc(rb - b, b, -PI / 2, 0); arc(rt - b, h - b, 0, PI / 2); pts.push(new THREE.Vector2(0, h));
    const g = new THREE.LatheGeometry(pts, seg); g.computeVertexNormals(); return g;
  });
}
const sph = (ws = 24, hs = 16) => memo(`sp${ws},${hs}`, () => new THREE.SphereGeometry(1, ws, hs));
const planeG = (w, h) => memo(`pl${q(w)},${q(h)}`, () => new THREE.PlaneGeometry(w, h));
const torusG = (R, r, arc = TAU, rs = 10, ts = 32) => memo(`to${q(R)},${q(r)},${q(arc)},${rs},${ts}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc));
const M = (color, o = {}) => toonMat(color, o);
const glowM = (color, ei = 2) => toonMat(color, { emissive: color, ei });
const MATS = new Map();
/** a material with a canvas texture (glow > 0: lit by itself, for screens, signs, windows) */
function TM(t, o = {}) {
  const k = t.uuid + JSON.stringify(o); if (MATS.has(k)) return MATS.get(k);
  const m = new THREE.MeshStandardMaterial({ color: o.tint ?? '#ffffff', map: t, roughness: o.rough ?? .85, metalness: o.metal ?? 0, transparent: !!o.transparent, side: o.side ?? THREE.FrontSide });
  if (o.glow) { m.emissive.set('#ffffff'); m.emissiveMap = t; m.emissiveIntensity = o.glow; }
  if (o.decal) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4; }
  MATS.set(k, m); return m;
}
/** a mesh into parent at p, rotation r, scale s */
function mesh(parent, geo, mat, p, r, s) {
  const o = new THREE.Mesh(geo, mat);
  if (p) o.position.set(p[0], p[1], p[2]);
  if (r) o.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0);
  if (s != null) { if (typeof s === 'number') o.scale.setScalar(s); else o.scale.set(s[0], s[1], s[2]); }
  o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}
const deco = o => { o.userData.noOutline = true; o.castShadow = false; return o; };
const ink = (g, w = .01) => outlineAll(g, INK, w, 1.2);
/** add a built piece of the place: outlined, picked as one, solid unless said */
function piece(c, g, key, o = {}) {
  if (o.ink !== false) ink(g, o.ink ?? .01);
  g.userData.pickRoot = true; g.userData.kind ??= key || g.name || 'set'; g.name ||= key || 'set';
  g.userData.solid = o.solid ?? true;
  if (o.shadow === false) g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  (o.parent || null)?.add(g) ?? c.S.add(g);
  if (key) c.props[key] = g;
  return g;
}
/** a rod between two points */
function strut(parent, a, b, r, mat, seg = 12) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), L = d.length();
  const o = mesh(parent, rcyl(r, r, L, r * .4, seg), mat, a); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}
/** a bendy tube through points (cables, rails, pipes) */
function tube(parent, pts, r, mat, seg = 32) {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, 8, false);
  return mesh(parent, g, mat);
}

// ---------- 2D noise for terrain ----------
const h2 = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
function vn2(x, z, s = 0) { const i = Math.floor(x), j = Math.floor(z), fx_ = x - i, fz = z - j, u = fx_ * fx_ * (3 - 2 * fx_), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h2(i, j, s), h2(i + 1, j, s), u), lerp(h2(i, j + 1, s), h2(i + 1, j + 1, s), u), v) * 2 - 1; }
const fbm2 = (x, z, s = 0) => vn2(x, z, s) * .55 + vn2(x * 2.1, z * 2.1, s + 3) * .28 + vn2(x * 4.3, z * 4.3, s + 7) * .17;
const sstep = (a, b, x) => { if (a === b) return x >= a ? 1 : 0; const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

// ---------- painted surfaces (stylised, never photographic) ----------
const TXC = new Map();
const FONT = (wt, px) => `${wt} ${px}px Inter, Arial, sans-serif`;
function blot(x, w, h, col, R, n, k, s0 = 2, s1 = 6, a = .4) { x.globalAlpha = a; for (let i = 0; i < n; i++) { x.fillStyle = shade(col, (R() - .5) * k); const s = s0 + R() * (s1 - s0); x.beginPath(); x.ellipse(R() * w, R() * h, s, s * (.6 + R() * .6), R() * PI, 0, TAU); x.fill(); } x.globalAlpha = 1; }
const PAINT = {
  plaster: (x, w, h, c, R) => { x.fillStyle = c; x.fillRect(0, 0, w, h); blot(x, w, h, c, R, 900, .09, 4, 18, .25); },
  stripes: (x, w, h, c, R, o) => { x.fillStyle = c; x.fillRect(0, 0, w, h); const n = o.n ?? 8; x.fillStyle = o.c2 || shade(c, -.1); for (let i = 0; i < n; i++) x.fillRect(i * w / n, 0, w / n * .45, h); x.fillStyle = o.c3 || shade(c, .18); for (let i = 0; i < n; i++) x.fillRect(i * w / n + w / n * .62, 0, 3, h); blot(x, w, h, c, R, 300, .06, 3, 10, .2); },
  motif: (x, w, h, c, R, o) => { x.fillStyle = c; x.fillRect(0, 0, w, h); const n = o.n ?? 6, m = o.c2 || shade(c, -.14); x.fillStyle = m;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const cx = (i + (j % 2) * .5) * w / n, cy = (j + .5) * h / n, s = w / n * .16; x.beginPath(); x.moveTo(cx, cy - s * 1.6); x.lineTo(cx + s, cy); x.lineTo(cx, cy + s * 1.6); x.lineTo(cx - s, cy); x.closePath(); x.fill(); }
    x.fillStyle = o.c3 || shade(c, .12); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.beginPath(); x.arc((i + .5 + (j % 2) * .5) * w / n, j * h / n, w / n * .05, 0, TAU); x.fill(); } },
  panel: (x, w, h, c, R) => { const n = 8; for (let i = 0; i < n; i++) { x.fillStyle = shade(c, (R() - .5) * .14); x.fillRect(i * w / n, 0, w / n, h);
      x.globalAlpha = .3; for (let k = 0; k < 6; k++) { x.strokeStyle = shade(c, -.2 - R() * .1); x.lineWidth = 1 + R() * 2; const xx = i * w / n + R() * w / n; x.beginPath(); x.moveTo(xx, 0); x.bezierCurveTo(xx + (R() - .5) * 12, h * .3, xx + (R() - .5) * 12, h * .7, xx + (R() - .5) * 8, h); x.stroke(); } x.globalAlpha = 1;
      x.fillStyle = shade(c, -.42); x.fillRect(i * w / n, 0, 4, h); } },
  brick: (x, w, h, c, R, o) => { x.fillStyle = o.mortar || shade(c, .35); x.fillRect(0, 0, w, h); const rows = o.rows ?? 16, bw = w / (o.cols ?? 6), bh = h / rows;
    for (let j = 0; j < rows; j++) for (let i = -1; i <= (o.cols ?? 6); i++) { const xx = i * bw + (j % 2) * bw / 2; x.fillStyle = shade(c, (R() - .5) * .22); x.beginPath(); x.roundRect(xx + 2, j * bh + 2, bw - 4, bh - 4, 3); x.fill(); x.fillStyle = shade(c, .08); x.fillRect(xx + 4, j * bh + 3, bw - 10, 2); } },
  block: (x, w, h, c, R) => { x.fillStyle = shade(c, -.12); x.fillRect(0, 0, w, h); const rows = 6, cols = 3, bw = w / cols, bh = h / rows;
    for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) { const xx = i * bw + (j % 2) * bw / 2; x.fillStyle = shade(c, (R() - .5) * .05); x.beginPath(); x.roundRect(xx + 3, j * bh + 3, bw - 6, bh - 6, 6); x.fill(); } blot(x, w, h, c, R, 400, .07, 2, 6, .3); },
  terrazzo: (x, w, h, c, R, o) => { x.fillStyle = c; x.fillRect(0, 0, w, h); const cols = o.chips || [shade(c, -.35), shade(c, .25), '#c96a4a', '#5a8a8a', '#e9c46a'];
    for (let i = 0; i < 1400; i++) { x.fillStyle = cols[Math.floor(R() * cols.length)]; const s = 1.5 + R() * 5; x.beginPath(); x.moveTo(R() * w, R() * h); const X = R() * w, Y = R() * h; x.ellipse(X, Y, s, s * (.5 + R() * .5), R() * PI, 0, TAU); x.fill(); }
    if (o.grid) { x.strokeStyle = shade(c, -.25); x.lineWidth = 3; x.strokeRect(0, 0, w, h); } },
  lino: (x, w, h, c, R, o) => { const n = o.n ?? 4; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 && o.c2 ? o.c2 : shade(c, (R() - .5) * .05); x.fillRect(i * w / n, j * h / n, w / n, h / n); }
    blot(x, w, h, c, R, 1600, .3, 1, 2.5, .35); x.strokeStyle = shade(c, -.2); x.lineWidth = 2; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * w / n, 0); x.lineTo(i * w / n, h); x.stroke(); x.beginPath(); x.moveTo(0, i * h / n); x.lineTo(w, i * h / n); x.stroke(); } },
  tiles: (x, w, h, c, R, o) => { const n = o.n ?? 4, gr = o.grout || shade(c, -.25); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 && o.c2 ? o.c2 : shade(c, (R() - .5) * .06); x.beginPath(); x.roundRect(i * w / n + 2, j * h / n + 2, w / n - 4, h / n - 4, 4); x.fill(); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(i * w / n + 6, j * h / n + 5, w / n * .5, 3); } },
  carpet: (x, w, h, c, R, o) => { x.fillStyle = c; x.fillRect(0, 0, w, h); blot(x, w, h, c, R, 2400, .12, 1, 2.5, .5); const n = o.n ?? 4, a = o.c2 || shade(c, -.25), b = o.c3 || '#e9c46a';
    x.strokeStyle = a; x.lineWidth = 6; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const cx = (i + .5) * w / n, cy = (j + .5) * h / n, s = w / n * .42; x.beginPath(); x.moveTo(cx, cy - s); x.lineTo(cx + s, cy); x.lineTo(cx, cy + s); x.lineTo(cx - s, cy); x.closePath(); x.stroke(); x.fillStyle = b; x.beginPath(); x.arc(cx, cy, s * .16, 0, TAU); x.fill(); } },
  cobble: (x, w, h, c, R) => { x.fillStyle = shade(c, -.45); x.fillRect(0, 0, w, h); const rows = 10, cols = 8;
    for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) { const sw = w / cols, sh = h / rows, cx = (i + (j % 2) * .5 + .5) * sw + (R() - .5) * 4, cy = (j + .5) * sh + (R() - .5) * 3;
      x.fillStyle = shade(c, (R() - .5) * .28); x.beginPath(); x.ellipse(cx, cy, sw * .44, sh * .4, (R() - .5) * .3, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.ellipse(cx - sw * .1, cy - sh * .12, sw * .2, sh * .12, 0, 0, TAU); x.fill(); } },
  flags: (x, w, h, c, R) => { x.fillStyle = shade(c, -.35); x.fillRect(0, 0, w, h); let y = 0; while (y < h) { const rh = h / 4; let xx = -R() * 60; while (xx < w) { const sw = 70 + R() * 90; x.fillStyle = shade(c, (R() - .5) * .2); x.beginPath(); x.roundRect(xx + 3, y + 3, sw - 6, rh - 6, 8); x.fill(); xx += sw; } y += rh; } },
  ashlar: (x, w, h, c, R) => { x.fillStyle = shade(c, -.3); x.fillRect(0, 0, w, h); const rows = 6; for (let j = 0; j < rows; j++) { let xx = -(j % 2) * 60; while (xx < w) { const sw = 100 + R() * 70; x.fillStyle = shade(c, (R() - .5) * .16); x.beginPath(); x.roundRect(xx + 3, j * h / rows + 3, sw - 6, h / rows - 6, 6); x.fill(); xx += sw; } } blot(x, w, h, c, R, 500, .1, 2, 8, .25); },
  metal: (x, w, h, c, R, o) => { x.fillStyle = c; x.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { x.strokeStyle = shade(c, (R() - .5) * .1); x.globalAlpha = .4; x.beginPath(); const y = R() * h; x.moveTo(0, y); x.lineTo(w, y + (R() - .5) * 4); x.stroke(); } x.globalAlpha = 1;
    const n = o.n ?? 2; x.strokeStyle = shade(c, -.32); x.lineWidth = 4; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * w / n, 0); x.lineTo(i * w / n, h); x.stroke(); x.beginPath(); x.moveTo(0, i * h / n); x.lineTo(w, i * h / n); x.stroke(); }
    x.fillStyle = shade(c, -.25); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (const [u, v] of [[.06, .06], [.94, .06], [.06, .94], [.94, .94]]) { x.beginPath(); x.arc((i + u) * w / n, (j + v) * h / n, 4, 0, TAU); x.fill(); } },
  corrugated: (x, w, h, c, R) => { const n = 24; for (let i = 0; i < n; i++) { const g = x.createLinearGradient(i * w / n, 0, (i + 1) * w / n, 0); g.addColorStop(0, shade(c, -.18)); g.addColorStop(.5, shade(c, .1)); g.addColorStop(1, shade(c, -.18)); x.fillStyle = g; x.fillRect(i * w / n, 0, w / n + 1, h); } blot(x, w, h, c, R, 200, .15, 3, 14, .25); },
  rock: (x, w, h, c, R) => { x.fillStyle = c; x.fillRect(0, 0, w, h); blot(x, w, h, c, R, 700, .3, 6, 30, .35); x.strokeStyle = shade(c, -.4); x.globalAlpha = .5; for (let i = 0; i < 26; i++) { x.lineWidth = 1 + R() * 2.5; let X = R() * w, Y = R() * h; x.beginPath(); x.moveTo(X, Y); for (let k = 0; k < 5; k++) { X += (R() - .5) * 60; Y += (R() - .3) * 40; x.lineTo(X, Y); } x.stroke(); } x.globalAlpha = 1; },
  dirt: (x, w, h, c, R) => { x.fillStyle = c; x.fillRect(0, 0, w, h); blot(x, w, h, c, R, 500, .25, 8, 40, .3); blot(x, w, h, c, R, 2500, .35, 1, 3, .55); for (let i = 0; i < 120; i++) { x.fillStyle = shade(c, -.25 + R() * .4); x.beginPath(); x.ellipse(R() * w, R() * h, 2 + R() * 5, 2 + R() * 4, R() * PI, 0, TAU); x.fill(); } },
  sand: (x, w, h, c, R) => { x.fillStyle = c; x.fillRect(0, 0, w, h); blot(x, w, h, c, R, 3200, .14, 1, 2.2, .6); x.strokeStyle = shade(c, -.07); x.lineWidth = 3; x.globalAlpha = .5; for (let i = 0; i < 14; i++) { const y = R() * h; x.beginPath(); x.moveTo(0, y); for (let k = 1; k <= 8; k++) x.lineTo(k * w / 8, y + Math.sin(k + i) * 6); x.stroke(); } x.globalAlpha = 1; },
  grass: (x, w, h, c, R) => { x.fillStyle = c; x.fillRect(0, 0, w, h); blot(x, w, h, c, R, 400, .2, 10, 40, .3); for (let i = 0; i < 2600; i++) { x.strokeStyle = shade(c, (R() - .45) * .35); x.lineWidth = 2; const X = R() * w, Y = R() * h; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + (R() - .5) * 4, Y - 4 - R() * 7); x.stroke(); } },
  planks: (x, w, h, c, R, o) => { const n = o.n ?? 6; for (let i = 0; i < n; i++) { x.fillStyle = shade(c, (R() - .5) * .18); x.fillRect(0, i * h / n, w, h / n); x.fillStyle = shade(c, -.5); x.fillRect(0, (i + 1) * h / n - 4, w, 4); x.fillStyle = shade(c, -.4); x.fillRect(((i * 211) % 7) / 7 * w, i * h / n, 4, h / n);
      x.globalAlpha = .25; for (let k = 0; k < 5; k++) { x.strokeStyle = shade(c, -.25); x.lineWidth = 1.5; const y = i * h / n + R() * h / n; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * .3, y + (R() - .5) * 8, w * .6, y + (R() - .5) * 8, w, y); x.stroke(); } x.globalAlpha = 1;
      x.fillStyle = '#5a5a5a'; for (const u of [.04, .52]) { x.beginPath(); x.arc(u * w, (i + .3) * h / n, 3, 0, TAU); x.arc(u * w, (i + .7) * h / n, 3, 0, TAU); x.fill(); } } },
  asphalt: (x, w, h, c, R) => { x.fillStyle = c; x.fillRect(0, 0, w, h); blot(x, w, h, c, R, 3000, .3, 1, 2.5, .5); blot(x, w, h, c, R, 60, .15, 20, 60, .2); },
  silt: (x, w, h, c, R) => { x.fillStyle = c; x.fillRect(0, 0, w, h); blot(x, w, h, c, R, 300, .2, 10, 50, .25); blot(x, w, h, c, R, 2500, .25, 1, 2, .5); x.strokeStyle = shade(c, .1); x.lineWidth = 3; x.globalAlpha = .35; for (let i = 0; i < 10; i++) { const y = R() * h; x.beginPath(); x.moveTo(0, y); for (let k = 1; k <= 10; k++) x.lineTo(k * w / 10, y + Math.sin(k * 1.3 + i) * 8); x.stroke(); } x.globalAlpha = 1; },
  snow: (x, w, h, c, R) => { x.fillStyle = c; x.fillRect(0, 0, w, h); blot(x, w, h, c, R, 400, .08, 10, 40, .4); },
};
/** a tiling painted texture: kind, base colour, repeat [u, v] (per surface), extra options (n, c2, c3, ...) */
function ptex(kind, color, rep = [1, 1], o = {}) {
  const key = kind + '|' + color + '|' + JSON.stringify(o); let base = TXC.get(key);
  if (!base) { base = canvasTex(o.px ?? 512, o.px ?? 512, (x, w, h) => PAINT[kind](x, w, h, color, rnd(o.seed ?? 3), o)); base.wrapS = base.wrapT = THREE.RepeatWrapping; TXC.set(key, base); }
  const t = base.clone(); t.repeat.set(rep[0], rep[1]); t.needsUpdate = true; return t;
}
/** a sign / label / screen texture: lines of text on a background */
function textTex(lines, o = {}) {
  const W = o.w ?? 512, H = o.h ?? 256; lines = [].concat(lines);
  return canvasTex(W, H, (x, w, h) => {
    if (o.bg !== null) { x.fillStyle = o.bg ?? '#f4ecdc'; x.fillRect(0, 0, w, h); }
    if (o.border) { x.strokeStyle = o.border; x.lineWidth = o.bw ?? h * .06; x.beginPath(); x.roundRect(x.lineWidth / 2 + 4, x.lineWidth / 2 + 4, w - x.lineWidth - 8, h - x.lineWidth - 8, h * .08); x.stroke(); }
    const n = lines.length, lh = h * (o.lh ?? .8) / n;
    lines.forEach((s, i) => { let px = Math.round(lh * (i === 0 ? (o.big ?? .78) : (o.small ?? .55))); x.font = FONT(i === 0 ? 800 : 600, px); while (x.measureText(s).width > w * (o.fit ?? .88) && px > 8) { px -= 2; x.font = FONT(i === 0 ? 800 : 600, px); }
      x.textAlign = 'center'; x.textBaseline = 'middle'; const y = h * (1 - (o.lh ?? .8)) / 2 + lh * (i + .5);
      if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = px * .35; }
      if (o.stroke) { x.lineWidth = px * .16; x.strokeStyle = o.stroke; x.lineJoin = 'round'; x.strokeText(s, w / 2, y); }
      x.fillStyle = (i === 0 ? o.fg : o.fg2 || o.fg) ?? '#2a1d17'; x.fillText(s, w / 2, y); x.shadowBlur = 0; });
  });
}

// =====================================================================================================================
// light per mood
// =====================================================================================================================
const IN = {
  day:   { rig: 'interior', o: {}, view: 'day' },
  warm:  { rig: 'interior', o: { key: '#ffb46e', ki: 2.0, fill: '#8a8fd6', sky: '#e8c49c', gnd: '#5a3c34', hi: .45 }, view: 'sunset' },
  night: { rig: 'interior', o: { key: '#a4b6ea', ki: 1.2, fill: '#5e70b8', fi: .6, rim: '#a8b8ff', ri: .8, sky: '#626ca0', gnd: '#2a2236', hi: .62 }, view: 'night' },
  cold:  { rig: 'interior', o: { key: '#d9e6ff', ki: 1.6, fill: '#8ea6e0', sky: '#c8d4e8', gnd: '#4c525e', hi: .55 }, view: 'dusk' },
  alarm: { rig: 'alarm', o: {}, view: 'night' },
  storm: { rig: 'interior', o: { key: '#b4c0d8', ki: .9, fill: '#5a6a90', sky: '#8a96ac', gnd: '#2c2c34', hi: .42 }, view: 'night' },
};
function lightIn(c, o = {}) { const m = IN[c.mood] || IN.day; c.S.light(m.rig, { shadowSize: o.shadowSize ?? 6, at: o.at, ...m.o, ...(o.rig || {}) }); c.view = m.view; return m; }
const OUT = {
  day:   { rig: 'day', o: {}, sky: 'day', fog: '#cfe6f6', clouds: 'day' },
  warm:  { rig: 'sunset', o: {}, sky: ['#5a4a9a', '#ffa86e'], fog: '#f2a57e', clouds: 'pink' },
  night: { rig: 'night', o: { ki: 1.6, hi: .55, fi: .55 }, sky: 'night', fog: '#1a2650', clouds: 'night' },
  cold:  { rig: 'day', o: { key: '#e4eeff', ki: 2.2, sky: '#cfdcf0', fill: '#9ab6ee' }, sky: ['#6f9bd0', '#dfeaf4'], fog: '#dbe6f0', clouds: 'day' },
  storm: { rig: 'day', o: { key: '#c4ccd8', ki: 1.1, sky: '#9aa4b4', hi: .55, fill: '#7a8aa8' }, sky: 'storm', fog: '#7d8794', clouds: 'storm' },
  alarm: { rig: 'alarm', o: {}, sky: ['#2a0a10', '#d0482a'], fog: '#8a2a1c', clouds: 'storm' },
};
/** an exterior: sky dome, sun / moon rig, fog matched to the horizon, drifting clouds */
function outdoors(c, o = {}) {
  const S = c.S, m = OUT[c.mood] || OUT.day;
  S.sky(o.sky ?? m.sky, { sun: o.sun, sunGlow: c.mood === 'day' || c.mood === 'warm' ? 1 : 0, starCount: o.stars });
  S.light(m.rig, { shadowSize: o.shadowSize ?? 14, at: o.at, ...m.o, ...(o.rig || {}) });
  if (o.fog !== false) S.fog(o.fogColor ?? m.fog, o.fogNear ?? 30, o.fogFar ?? 160);
  if (o.clouds !== false && m.clouds) fx(c, 'clouds', { at: o.cloudAt ?? [0, 26, -90], area: o.cloudArea ?? [180, 16, 50], count: o.cloudCount ?? 9, size: o.cloudSize ?? 8, speed: .6, tone: m.clouds, seed: c.seed * 7 + 1 });
  c.outside = true; return m;
}

// =====================================================================================================================
// rooms: a closed box (walls face inward, so a camera behind a wall sees through it) whose side walls, floor and
// ceiling run on `ext` metres past the front wall: a pulled-back 9:16 camera never sees past the set
// =====================================================================================================================
function room(c, o = {}) {
  const S = c.S, w = o.w ?? 7, h = o.h ?? 2.9, zb = o.back ?? -3, zf = o.front ?? 3.5, ze = zf + (o.ext ?? 10), x0 = -w / 2, x1 = w / 2;
  const wallC = c.o.wall || o.wall || '#cdbb9b', wk = o.wallKind || 'plaster', tile = o.wallTile ?? 1.4;
  const g = new THREE.Group(); g.name = 'room';
  const add = (geo, mat, p, r, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); if (r) m.rotation.set(...r); m.receiveShadow = true; m.userData.noPick = true; m.userData.ground = true; parent.add(m); return m; };
  const wallMat = len => TM(ptex(wk, wallC, [len / tile, h / tile], o.wallOpt || {}), { rough: .95 });
  // floor (textured) + ceiling
  const fl = c.o.floor || o.floor || '#a46a3c', fk = o.floorKind || 'planks', ft = o.floorTile ?? 1.6;
  const floorM = fk === 'wood' || fk === 'checker' || fk === 'carpet0' ? (() => { const m = M('#ffffff', { map: SETS.surface(fk, { color: fl, repeat: [w / ft, (ze - zb) / ft] }), rough: .8 }); return m; })() : TM(ptex(fk, fl, [w / ft, (ze - zb) / ft], o.floorOpt || {}), { rough: o.floorRough ?? .8 });
  add(planeG(w, ze - zb), floorM, [0, 0, (zb + ze) / 2], [-PI / 2, 0, 0]);
  const ceilC = o.ceiling || shade(wallC, .25);
  add(planeG(w, ze - zb), o.ceilingKind ? TM(ptex(o.ceilingKind, ceilC, [w / 1.2, (ze - zb) / 1.2]), { rough: 1 }) : M(ceilC, { rough: 1 }), [0, h, (zb + ze) / 2], [PI / 2, 0, 0]);
  // walls
  if (!o.openBack) add(planeG(w, h), wallMat(w), [0, h / 2, zb]);
  add(planeG(ze - zb, h), wallMat(ze - zb), [x0, h / 2, (zb + ze) / 2], [0, PI / 2, 0]);
  add(planeG(ze - zb, h), wallMat(ze - zb), [x1, h / 2, (zb + ze) / 2], [0, -PI / 2, 0]);
  const front = new THREE.Group(); front.name = 'front wall'; g.add(front);
  add(planeG(w, h), wallMat(w), [0, h / 2, zf], [0, PI, 0], front);
  front.userData.update = (t, SS) => { front.visible = SS.cam.position.z < zf - .05; };
  // wainscot (a lower band) + trims
  const trimC = o.trim || shade(wallC, -.38), trim = M(trimC, { rough: .6 }), trims = new THREE.Group(), ftr = new THREE.Group(); g.add(trims); front.add(ftr);
  if (o.wainscot) { const W = o.wainscot, wh = W.h ?? .95, wm = len => TM(ptex(W.kind || 'panel', W.color || shade(wallC, -.2), [len / (W.tile ?? 1.2), wh / (W.tile ?? 1.2)], W.opt || {}), { rough: .8 });
    add(planeG(w, wh), wm(w), [0, wh / 2, zb + .006]); add(planeG(ze - zb, wh), wm(ze - zb), [x0 + .006, wh / 2, (zb + ze) / 2], [0, PI / 2, 0]); add(planeG(ze - zb, wh), wm(ze - zb), [x1 - .006, wh / 2, (zb + ze) / 2], [0, -PI / 2, 0]); add(planeG(w, wh), wm(w), [0, wh / 2, zf - .006], [0, PI, 0], front);
    mesh(trims, rbox(w, .05, .05, .015), trim, [0, wh, zb + .02]); mesh(trims, rbox(.05, .05, ze - zb, .015), trim, [x0 + .02, wh, (zb + ze) / 2]); mesh(trims, rbox(.05, .05, ze - zb, .015), trim, [x1 - .02, wh, (zb + ze) / 2]); mesh(ftr, rbox(w, .05, .05, .015), trim, [0, wh, zf - .02]); }
  if (o.skirting !== false) { if (!o.openBack) mesh(trims, rbox(w, .11, .03, .01), trim, [0, .055, zb + .015]); mesh(trims, rbox(.03, .11, ze - zb, .01), trim, [x0 + .015, .055, (zb + ze) / 2]); mesh(trims, rbox(.03, .11, ze - zb, .01), trim, [x1 - .015, .055, (zb + ze) / 2]); mesh(ftr, rbox(w, .11, .03, .01), trim, [0, .055, zf - .015]); }
  if (o.crown !== false) { const cm = M(o.crownColor || shade(ceilC, -.08), { rough: .7 }); if (!o.openBack) mesh(trims, rbox(w, .08, .06, .02), cm, [0, h - .04, zb + .03]); mesh(trims, rbox(.06, .08, ze - zb, .02), cm, [x0 + .03, h - .04, (zb + ze) / 2]); mesh(trims, rbox(.06, .08, ze - zb, .02), cm, [x1 - .03, h - .04, (zb + ze) / 2]); mesh(ftr, rbox(w, .08, .06, .02), cm, [0, h - .04, zf - .03]); }
  for (const t of [trims, ftr]) { t.traverse(m => { if (m.isMesh) { m.castShadow = false; m.userData.noPick = true; } }); ink(t, .005); }
  g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  S.scene.add(g); S.scene.background = new THREE.Color(shade(wallC, -.6));
  S.bounds = { x0, x1, z0: zb, z1: ze, h };
  c.room = { w, h, zb, zf, ze, x0, x1, front, group: g, openBack: !!o.openBack };
  return c.room;
}
/** where a wall item goes: wall 'back' | 'left' | 'right' | 'front', u = the position along it (x, or z on the sides) */
function wallAt(c, wall, u, inset = 0) {
  const r = c.room;
  if (wall === 'left') return { at: [r.x0 + inset, u], ry: PI / 2 };
  if (wall === 'right') return { at: [r.x1 - inset, u], ry: -PI / 2 };
  if (wall === 'front') return { at: [u, r.zf - inset], ry: PI, parent: r.front };
  return { at: [u, r.zb + inset], ry: 0 };
}
/** a registry prop on / against a wall (inset = how far its origin sits from the wall: half its depth for furniture) */
function W(c, name, wall, u, inset = 0, o = {}) { const w = wallAt(c, wall, u, inset); return P(c, name, { ...o, at: o.y != null ? [w.at[0], o.y, w.at[1]] : w.at, ry: (w.ry + (o.turn || 0)), parent: w.parent }); }
/** a window in a wall showing the mood's view (+ a soft spill light on the floor in daylight) */
function win(c, wall, u, o = {}) { return W(c, 'window', wall, u, .005, { view: o.view || c.view || 'day', w: o.w ?? 1.1, h: o.h ?? 1.3, mount: o.mount ?? .9, curtains: o.curtains, blinds: o.blinds, long: o.long, key: o.key }); }

// =====================================================================================================================
// set pieces made here (same look: rounded, chunky, toon materials, ink)
// =====================================================================================================================
/** ceiling fan: turning blades (the room's ticking element) */
function ceilingFan(c, x, z, o = {}) {
  const h = c.room?.h ?? 2.9, g = new THREE.Group(); g.name = 'ceiling fan'; g.position.set(x, h, z);
  const mt = M(o.color || '#6b4a2f', { rough: .5 }), br = M('#c9a25a', { rough: .3, metal: .4 });
  mesh(g, rcyl(.05, .05, .25, .02, 16), br, [0, -.25, 0]);
  mesh(g, rcyl(.14, .1, .14, .04, 24), br, [0, -.38, 0]);
  const rot = new THREE.Group(); rot.position.y = -.33; g.add(rot);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU, b = mesh(rot, rbox(.62, .018, .15, .008), mt, [Math.cos(a) * .44, 0, Math.sin(a) * .44], [0, -a, .06]); void b; }
  if (o.light !== false) mesh(g, sph(20, 12), glowM('#fff1cf', 1.6), [0, -.46, 0], null, [.11, .07, .11]);
  ink(g, .006); g.userData.solid = false; g.userData.pickRoot = true; g.userData.kind = 'ceiling fan';
  const sp = o.speed ?? 3.2; g.userData.update = t => { rot.rotation.y = t * sp; };
  c.S.add(g); return g;
}
/** fluorescent ceiling panel (glows, no real light) */
function fluo(c, x, z, w = 1.2, d = .3, o = {}) {
  const h = o.h ?? c.room?.h ?? 2.9, g = new THREE.Group(); g.name = 'ceiling light'; g.position.set(x, h, z); if (o.ry) g.rotation.y = o.ry;
  mesh(g, rbox(w + .06, .05, d + .06, .015), M('#e8e6e0', { rough: .6 }), [0, -.025, 0]);
  deco(mesh(g, rbox(w, .02, d, .008), glowM(o.color || '#f4f8ff', o.ei ?? 1.6), [0, -.055, 0]));
  ink(g, .004); g.userData.solid = false; c.S.add(g);
  if (o.flicker) { const m = g.children[1].material = g.children[1].material.clone(); chain(g, t => { const n = noise1(t * 9, o.flicker); m.emissiveIntensity = (o.ei ?? 1.6) * (n > .82 ? .25 : 1); }); }
  return g;
}
/** a glowing neon sign: tubes of text on a dark board; flicker: dead frames now and then */
function neon(c, text, color, o = {}) {
  const w = o.w ?? 1.4, h = o.h ?? .45, g = new THREE.Group(); g.name = 'neon ' + text;
  const t = canvasTex(1024, Math.round(1024 * h / w), (x, W, H) => { x.clearRect(0, 0, W, H); x.fillStyle = 'rgba(0,0,0,0)'; let px = H * .62; x.font = FONT(800, px); while (x.measureText(text).width > W * .86 && px > 10) { px -= 2; x.font = FONT(800, px); }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.shadowColor = color; x.shadowBlur = px * .25; x.strokeStyle = color; x.lineWidth = px * .1; x.strokeText(text, W / 2, H / 2); x.shadowBlur = 0; x.fillStyle = mixHex(color, '#ffffff', .65); x.fillText(text, W / 2, H / 2); });
  if (o.board !== false) mesh(g, rbox(w, h, .05, .03), M(o.boardColor || '#1e1a26', { rough: .6 }), [0, 0, .025]);
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: o.ei ?? 2.2, color: '#ffffff', roughness: .4, depthWrite: false });
  const face = deco(mesh(g, planeG(w * .96, h * .94), m, [0, 0, .056])); face.renderOrder = 2;
  ink(g, .006);
  if (o.flicker !== false) { const base = o.ei ?? 2.2, ph = c.R() * 50; chain(g, t2 => { const n = noise1(t2 * 7 + ph, 9); m.emissiveIntensity = base * (n > .86 ? .15 : 1); }); }
  g.userData.pickRoot = true; g.userData.kind = 'neon sign'; g.userData.solid = false;
  return g;
}
/** an original poster (seeded design): title, sub, colours, a simple graphic */
const POSTERS = [
  { t: 'SPACE BEANS 3', s: 'NOW IN 3D', bg: ['#1d2b58', '#5a3a8a'], fg: '#ffd166', art: 'planet' },
  { t: 'NEON MOOSE', s: 'LIVE  FRI 9PM', bg: ['#ff5f8a', '#ffb46b'], fg: '#2a1d17', art: 'sun' },
  { t: 'TURBO RALLY', s: 'PIXO 16', bg: ['#2f9c95', '#1d2b4f'], fg: '#f6c945', art: 'bolt' },
  { t: 'NAP HARDER', s: '', bg: ['#f6c945', '#f08a2a'], fg: '#2a1d17', art: 'stripes' },
  { t: 'THE SOCK PUPPETS', s: 'WORLD TOUR', bg: ['#7a4fc4', '#ee7fa6'], fg: '#ffffff', art: 'wave' },
  { t: 'TO THE MOON', s: '', bg: ['#0d1638', '#2f4f9a'], fg: '#ffffff', art: 'rocket' },
  { t: 'RAWR', s: 'DINO DAYS', bg: ['#5fae4a', '#2f7a4a'], fg: '#ffffff', art: 'dino' },
  { t: 'BELIEVE IN TOAST', s: '', bg: ['#e2432f', '#f08a2a'], fg: '#fff3d6', art: 'sun' },
];
function posterTex(d) {
  return canvasTex(360, 512, (x, W, H) => {
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, d.bg[0]); gr.addColorStop(1, d.bg[1]); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.fillStyle = d.fg; x.strokeStyle = d.fg; x.lineWidth = 10;
    const cx = W / 2, cy = H * .42;
    if (d.art === 'sun') { x.beginPath(); x.arc(cx, cy, W * .24, 0, TAU); x.fill(); for (let i = 0; i < 5; i++) x.fillRect(0, cy + W * .06 + i * 18, W, 7); }
    else if (d.art === 'planet') { x.beginPath(); x.arc(cx, cy, W * .2, 0, TAU); x.fill(); x.beginPath(); x.ellipse(cx, cy, W * .36, W * .08, -.3, 0, TAU); x.stroke(); for (let i = 0; i < 30; i++) x.fillRect((i * 97) % W, (i * 53) % (H * .7), 3, 3); }
    else if (d.art === 'bolt') { x.beginPath(); x.moveTo(cx + 30, cy - 110); x.lineTo(cx - 50, cy + 10); x.lineTo(cx + 5, cy + 10); x.lineTo(cx - 30, cy + 110); x.lineTo(cx + 55, cy - 20); x.lineTo(cx, cy - 20); x.closePath(); x.fill(); }
    else if (d.art === 'stripes') { for (let i = -4; i < 8; i++) { x.save(); x.translate(i * 60, 0); x.rotate(.5); x.fillRect(0, -50, 22, H * 1.6); x.restore(); } }
    else if (d.art === 'wave') { for (let k = 0; k < 4; k++) { x.beginPath(); for (let i = 0; i <= 20; i++) x.lineTo(i * W / 20, cy - 60 + k * 40 + Math.sin(i * .9 + k) * 16); x.stroke(); } }
    else if (d.art === 'rocket') { x.beginPath(); x.ellipse(cx, cy, 34, 100, 0, 0, TAU); x.fill(); x.beginPath(); x.moveTo(cx - 34, cy + 40); x.lineTo(cx - 70, cy + 100); x.lineTo(cx - 20, cy + 80); x.fill(); x.beginPath(); x.moveTo(cx + 34, cy + 40); x.lineTo(cx + 70, cy + 100); x.lineTo(cx + 20, cy + 80); x.fill(); x.fillStyle = d.bg[1]; x.beginPath(); x.arc(cx, cy - 20, 16, 0, TAU); x.fill(); x.fillStyle = '#ff9a3a'; x.beginPath(); x.moveTo(cx - 20, cy + 98); x.lineTo(cx, cy + 160); x.lineTo(cx + 20, cy + 98); x.fill(); }
    else if (d.art === 'dino') { x.beginPath(); x.ellipse(cx, cy + 20, 90, 50, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(cx + 80, cy - 50, 34, 26, 0, 0, TAU); x.fill(); x.fillRect(cx + 50, cy - 40, 30, 60); for (const dx of [-50, 30]) x.fillRect(cx + dx, cy + 50, 22, 50); x.beginPath(); x.moveTo(cx - 80, cy + 10); x.lineTo(cx - 160, cy + 60); x.lineTo(cx - 70, cy + 50); x.fill(); }
    let px = 64; x.font = FONT(800, px); while (x.measureText(d.t).width > W * .88) { px -= 2; x.font = FONT(800, px); }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = d.fg; x.fillText(d.t, cx, H * .8);
    if (d.s) { x.font = FONT(600, 26); x.fillText(d.s, cx, H * .9); }
  });
}
const PTEX = new Map();
function poster(c, wall, u, o = {}) {
  const d = o.design || (o.title ? { t: o.title, s: o.sub || '', bg: o.bg || ['#2f9c95', '#1d2b4f'], fg: o.fg || '#ffffff', art: o.art || 'sun' } : pick(c, POSTERS));
  const k = JSON.stringify(d); if (!PTEX.has(k)) PTEX.set(k, posterTex(d));
  const w = o.w ?? .5, h = o.h ?? .7, g = new THREE.Group(); g.name = 'poster ' + d.t;
  const pm = M('#f3ecdc', { rough: .9 });
  mesh(g, rbox(w, h, .012, .004), [pm, pm, pm, pm, TM(PTEX.get(k), { rough: .8 }), pm], [0, 0, .006]);
  if (o.frame) { const fm = M(o.frame, { rough: .5 }); for (const s of [-1, 1]) { mesh(g, rbox(.035, h + .07, .03, .01), fm, [s * (w / 2 + .017), 0, .015]); mesh(g, rbox(w + .07, .035, .03, .01), fm, [0, s * (h / 2 + .017), .015]); } }
  else for (const [x, y] of [[-1, 1], [1, 1]]) deco(mesh(g, sph(8, 6), M('#e2432f'), [x * (w / 2 - .03), y * (h / 2 - .03), .014], null, .012));
  const wa = wallAt(c, wall, u, .004); g.position.set(wa.at[0], o.y ?? 1.6, wa.at[1]); g.rotation.set(0, wa.ry, o.tilt ?? (c.R() - .5) * .05);
  ink(g, .004); g.userData.pickRoot = true; g.userData.kind = 'poster'; g.userData.solid = false; g.userData.screen = PTEX.get(k);
  (wa.parent || c.S.scene).add(g); if (!wa.parent) c.S.props.push(g); if (o.key) c.props[o.key] = g;
  return g;
}
/** a flat sign board (shop names, door plates, joke signs): text on a painted board */
function board(c, lines, o = {}) {
  const w = o.w ?? 1.2, h = o.h ?? .35, g = new THREE.Group(); g.name = 'sign ' + [].concat(lines)[0];
  const t = textTex(lines, { w: 768, h: Math.max(64, Math.round(768 * h / w)), bg: o.bg ?? '#f4ecdc', fg: o.fg ?? '#2a1d17', border: o.border, glow: o.glowText, lh: o.lh ?? .74 });
  const sm = M(o.edge || shade(o.bg ?? '#f4ecdc', -.35), { rough: .6 });
  mesh(g, rbox(w + .06, h + .06, .04, .015), sm, [0, 0, .02]);
  deco(mesh(g, planeG(w, h), TM(t, { rough: .7, glow: o.glow }), [0, 0, .041]));
  ink(g, .005); g.userData.pickRoot = true; g.userData.kind = 'sign'; g.userData.solid = false; g.userData.screen = t;
  return g;
}
function placeOnWall(c, g, wall, u, y, key) { const wa = wallAt(c, wall, u, .004); g.position.set(wa.at[0], y, wa.at[1]); g.rotation.y = wa.ry; (wa.parent || c.S.scene).add(g); if (!wa.parent) c.S.props.push(g); if (key) c.props[key] = g; return g; }
/** an animated screen (canvas redrawn every 2nd frame): draw(x, w, h, t) */
function liveScreen(c, w, h, draw, o = {}) {
  const px = o.px ?? 512, t = canvasTex(px, Math.round(px * h / w), (x, W, H) => draw(x, W, H, 0));
  const g = new THREE.Group(); g.name = o.name || 'screen';
  if (o.bezel !== false) mesh(g, rbox(w + .08, h + .08, .06, .02), M(o.bezel || '#2f3036', { rough: .5 }), [0, 0, .03]);
  deco(mesh(g, planeG(w, h), TM(t, { glow: o.glow ?? 1.1, rough: .4 }), [0, 0, .061]));
  ink(g, .006); g.userData.screen = t; g.userData.pickRoot = true; g.userData.kind = o.name || 'screen'; g.userData.solid = false;
  let last = -1; g.userData.update = tt => { const f = Math.floor(tt * 15); if (f === last) return; last = f; const cv = t.userData.canvas, x = cv.getContext('2d'); draw(x, cv.width, cv.height, tt); t.needsUpdate = true; };
  return g;
}
/** a counter / bar / desk block: body + top (+ kick plinth) */
function counter(c, w, d, h, o = {}) {
  const g = new THREE.Group(); g.name = o.name || 'counter';
  const body = o.bodyTex ? TM(ptex(o.bodyTex, o.color || '#b8453a', [w / .8, h / .8], o.texOpt || {}), { rough: .7 }) : M(o.color || '#b8453a', { rough: .6 });
  mesh(g, rbox(w, h - .06, d - .06, .03), body, [0, (h - .06) / 2 + .02, .0]);
  mesh(g, rbox(w + .06, .06, d + .04, .02), o.topMat || M(o.top || '#e9e1cf', { rough: .4 }), [0, h - .03, .01]);
  mesh(g, rbox(w - .04, .08, d - .12, .02), M(shade(o.color || '#b8453a', -.4)), [0, .04, -.02]);
  if (o.trim) mesh(g, rbox(w + .01, .04, .015, .01), M(o.trim, { rough: .3, metal: .4 }), [0, h * .55, d / 2 - .02]);
  ink(g, .008); g.userData.top = h; return g;
}
/** an upholstered booth (diner, cabin): seat + tall back, faces +z */
function booth(c, w, color, o = {}) {
  const g = new THREE.Group(); g.name = 'booth'; const cm = M(color, { rough: .5 }), dk = M(shade(color, -.3), { rough: .6 }), base = M(o.base || '#6b4a2f', { rough: .6 });
  mesh(g, rbox(w, .4, .55, .05), base, [0, .2, 0]);
  mesh(g, rbox(w - .04, .14, .54, .06), cm, [0, .47, .02]);
  mesh(g, rbox(w - .04, .72, .16, .07), cm, [0, .9, -.22], [-.1, 0, 0]);
  for (let i = 1; i < (o.tufts ?? 3); i++) deco(mesh(g, rbox(.02, .55, .02, .008), dk, [-w / 2 + i * w / (o.tufts ?? 3), .92, -.135], [-.1, 0, 0]));
  ink(g, .008); g.userData.seat = .54; return g;
}
/** a merged shelving unit of product boxes / jars (one draw call): w, h, d, rows, palette */
function goodsShelf(c, w, h, d, o = {}) {
  const g = new THREE.Group(); g.name = o.name || 'shelves'; const R = rnd(o.seed ?? c.seed * 13 + 1);
  const frame = M(o.frame || '#d8dde3', { rough: .5, metal: .2 }), rows = o.rows ?? 5;
  for (const s of [-1, 1]) mesh(g, rbox(.04, h, d, .01), frame, [s * (w / 2 - .02), h / 2, 0]);
  mesh(g, rbox(w, h, .02, .005), M(o.back || shade(o.frame || '#d8dde3', -.15)), [0, h / 2, -d / 2 + .01]);
  const parts = [], pal = o.palette || ['#e2432f', '#f6c945', '#3f6fd1', '#5fae4a', '#f08a2a', '#ee7fa6', '#2f9c95', '#efe3c8', '#7a4fc4'];
  for (let r = 0; r < rows; r++) {
    const y = .12 + r * (h - .15) / rows; mesh(g, rbox(w - .06, .03, d, .008), frame, [0, y, 0]);
    let x = -w / 2 + .06; const sh = (h - .15) / rows - .08;
    while (x < w / 2 - .12) { const kind = R(), bw = .07 + R() * .14, bh = sh * (.45 + R() * .5), col = pal[Math.floor(R() * pal.length)];
      const geo = kind < .55 ? rbox(bw, bh, d * .7, .01, 1) : kind < .85 ? rcyl(bw * .38, bw * .38, bh, .01, 12) : rcyl(bw * .3, bw * .42, bh * .8, .02, 12);
      const gg = geo.clone(); gg.translate(x + bw / 2, y + .015 + (kind < .55 ? bh / 2 : 0), (R() - .5) * .04); const n = gg.attributes.position.count, cc = new THREE.Color(col), a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(gg.index ? gg.toNonIndexed() : gg);
      x += bw + .015 + R() * .03; }
  }
  mesh(g, rbox(w, .04, d + .02, .01), frame, [0, h - .02, 0]);
  if (parts.length) { for (const p of parts) { if (p.attributes.uv) p.deleteAttribute('uv'); } const m = mesh(g, mergeGeometries(parts, false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55 })); m.userData.noOutline = false; }
  ink(g, .006); g.userData.top = h; return g;
}
/** simple stylised "lollipop" trees for far layers (cheap): a trunk + 2-4 leaf puffs */
function farTree(parent, x, z, s, col, R) {
  const tm = M('#6b4a2f'), lm = M(col, { rough: .9 });
  mesh(parent, rcyl(.12 * s, .16 * s, 1.6 * s, .03, 8), tm, [x, 0, z]);
  const n = 2 + Math.floor(R() * 3); for (let i = 0; i < n; i++) mesh(parent, sph(12, 8), lm, [x + (R() - .5) * 1.1 * s, (1.9 + R() * 1.1) * s, z + (R() - .5) * .8 * s], null, (.8 + R() * .5) * s);
}
/** a row of far trees / hills: the soft background layer of an exterior */
function treeLine(c, z, x0, x1, o = {}) {
  const g = new THREE.Group(); g.name = 'tree line'; const R = rnd(c.seed * 31 + Math.round(z));
  const cols = o.colors || ['#3f8a3a', '#4f9a3f', '#2f7a3f', '#5aa64a'];
  for (let x = x0; x < x1; x += (o.gap ?? 2.4) * (.7 + R() * .6)) farTree(g, x, z + (R() - .5) * (o.depth ?? 3), (o.size ?? 1.6) * (.75 + R() * .5), cols[Math.floor(R() * cols.length)], R);
  ink(g, o.ink ?? .04); g.userData.solid = false; g.traverse(m => { if (m.isMesh) m.castShadow = !!o.shadow; }); c.S.add(g); return g;
}
/** rounded hills / dunes / mesas far away (a silhouette band that fills the horizon) */
function hills(c, z, x0, x1, o = {}) {
  const g = new THREE.Group(); g.name = 'hills'; const R = rnd(c.seed * 17 + Math.round(z)), col = o.color || '#7fb05a';
  for (let x = x0; x < x1; x += (o.gap ?? 14) * (.6 + R() * .7)) { const s = (o.size ?? 10) * (.6 + R() * .7), m = mesh(g, sph(28, 14), M(shade(col, (R() - .5) * .12), { rough: .95 }), [x, -s * (o.sink ?? .55), z + (R() - .5) * (o.depth ?? 10)], null, [s * (o.wide ?? 1.6), s * (o.tall ?? 1), s]); m.castShadow = false; }
  ink(g, o.ink ?? .08); g.userData.solid = false; c.S.add(g); return g;
}
/** flat-topped mesas / buttes (outback, desert) */
function mesas(c, z, x0, x1, o = {}) {
  const g = new THREE.Group(); g.name = 'mesas'; const R = rnd(c.seed * 23 + Math.round(z)), col = o.color || '#c0603a';
  for (let x = x0; x < x1; x += (o.gap ?? 22) * (.6 + R() * .8)) { const hgt = (o.h ?? 9) * (.6 + R() * .7), w = (o.w ?? 14) * (.6 + R() * .8);
    const mm = mesh(g, rcyl(w * .42, w * .58, hgt, hgt * .12, 9), M(shade(col, (R() - .5) * .14), { rough: 1 }), [x, 0, z + (R() - .5) * 12], [0, R() * PI, 0], [1, 1, .6 + R() * .4]); mm.castShadow = false;
    mesh(g, rcyl(w * .44, w * .44, hgt * .14, hgt * .05, 9), M(shade(col, .12)), [x, hgt * .86, mm.position.z], [0, mm.rotation.y, 0], [1, 1, mm.scale.z]).castShadow = false; }
  ink(g, o.ink ?? .1); g.userData.solid = false; c.S.add(g); return g;
}
/** a ground of painted texture with gentle bumps (flat inside `flat` metres of `at` so props and characters stand on y = 0) */
function terrain(c, o = {}) {
  const sz = o.size ?? [160, 160], seg = o.seg ?? 120, at = o.at ?? [0, 0], flat = o.flat ?? 6, amp = o.amp ?? .6, sc = o.scale ?? .08, s0 = o.seedN ?? c.seed;
  const geo = new THREE.PlaneGeometry(sz[0], sz[1], seg, seg); geo.rotateX(-PI / 2);
  const Pp = geo.attributes.position, hAt = o.height || ((x, z) => { const d = Math.hypot(x - at[0], z - at[1]); return fbm2(x * sc, z * sc, s0) * amp * sstep(flat, flat * 2.2, d); });
  for (let i = 0; i < Pp.count; i++) { const x = Pp.getX(i) + at[0], z = Pp.getZ(i) + at[1]; Pp.setY(i, hAt(x, z)); }
  geo.computeVertexNormals();
  const tile = o.tile ?? 2.5, m = new THREE.Mesh(geo, TM(ptex(o.kind || 'grass', o.color || C.grass, [sz[0] / tile, sz[1] / tile], o.opt || {}), { rough: .95 }));
  m.position.set(at[0], o.y ?? 0, at[1]); m.receiveShadow = true; m.userData.ground = true; m.userData.noPick = true; c.S.scene.add(m);
  return { mesh: m, hAt };
}

/** a built piece into the shot at [x, z] | [x, y, z], turned ry */
function put(c, g, at, ry = 0, key, o = {}) { if (at.length === 3) g.position.set(at[0], at[1], at[2]); else g.position.set(at[0], o.y ?? 0, at[1]); g.rotation.y = ry; return piece(c, g, key, { ink: false, ...o }); }
/** a string of little coloured bulbs on a sagging wire from a to b ([x, y, z]); they twinkle */
function stringLights(c, a, b, o = {}) {
  const g = new THREE.Group(); g.name = 'string lights'; const n = o.n ?? 14, sag = o.sag ?? .25, cols = o.colors || ['#ffd27a', '#ff7a8a', '#7ad8ff', '#b8ff7a'];
  const at = k => [lerp(a[0], b[0], k), lerp(a[1], b[1], k) - sag * 4 * k * (1 - k), lerp(a[2], b[2], k)];
  const pts = []; for (let i = 0; i <= 24; i++) pts.push(at(i / 24));
  deco(tube(g, pts, .005, M('#2a2522'), 48));
  const mats = cols.map(col => toonMat(col, { emissive: col, ei: 2.2 }).clone());
  for (let i = 1; i < n; i++) { const p = at(i / n); deco(mesh(g, sph(10, 8), mats[i % mats.length], [p[0], p[1] - .035, p[2]], null, [.022 * (o.size ?? 1), .032 * (o.size ?? 1), .022 * (o.size ?? 1)])); }
  if (o.twinkle !== false) g.userData.update = t => mats.forEach((m, i) => { m.emissiveIntensity = 1.7 + .8 * Math.sin(t * 2.2 + i * 1.9); });
  g.userData.solid = false; g.userData.pickRoot = true; g.userData.kind = 'string lights'; (o.parent || c.S.scene).add(g); return g;
}
/** a line of little triangle flags (bunting) from a to b, fluttering */
function bunting(c, a, b, o = {}) {
  const g = new THREE.Group(); g.name = 'bunting'; const n = o.n ?? 12, sag = o.sag ?? .3, cols = o.colors || ['#e2432f', '#f6c945', '#3f6fd1', '#5fae4a', '#ee7fa6', '#ffffff'];
  const at = k => [lerp(a[0], b[0], k), lerp(a[1], b[1], k) - sag * 4 * k * (1 - k), lerp(a[2], b[2], k)];
  const pts = []; for (let i = 0; i <= 24; i++) pts.push(at(i / 24)); deco(tube(g, pts, .006, M('#e9e1cf'), 48));
  const s = o.size ?? .22, tri = memo('tri' + s, () => { const sh = new THREE.Shape(); sh.moveTo(-s / 2, 0); sh.lineTo(s / 2, 0); sh.lineTo(0, -s * 1.2); sh.closePath(); return new THREE.ShapeGeometry(sh); });
  const dir = new THREE.Vector3(b[0] - a[0], 0, b[2] - a[2]).normalize(), ry = Math.atan2(-dir.z, dir.x), flags = [];
  for (let i = 1; i < n; i++) { const p = at(i / n), f = mesh(g, tri, M(cols[i % cols.length], { rough: .9, side: THREE.DoubleSide }), [p[0], p[1], p[2]], [0, ry, 0]); f.userData.noOutline = true; flags.push(f); }
  g.userData.update = t => flags.forEach((f, i) => { f.rotation.x = .25 * Math.sin(t * 2.3 + i * .9); });
  g.userData.solid = false; c.S.scene.add(g); return g;
}
/** a red rotating alarm beacon (the alarm mood's moving light) */
function beacon(c, at, o = {}) {
  const g = new THREE.Group(); g.name = 'alarm beacon'; g.position.set(...at); if (o.ry) g.rotation.y = o.ry;
  mesh(g, rcyl(.09, .1, .05, .015, 24), M('#2f3036'), [0, 0, 0]);
  const dm = toonMat('#ff3a2a', { emissive: '#ff2a1a', ei: 2.5, rough: .3 }).clone();
  mesh(g, sph(24, 12), dm, [0, .05, 0], null, [.075, .09, .075]);
  ink(g, .004); g.userData.solid = false;
  g.userData.update = t => { dm.emissiveIntensity = 1.2 + 2.2 * Math.max(0, Math.sin(t * 7)); };
  (o.parent || c.S.scene).add(g); return g;
}
/** toy blocks with letters, stacked */
function toyBlocks(c, n = 4) {
  const g = new THREE.Group(); g.name = 'toy blocks'; const L = 'ABCXYZ123', cols = ['#e2432f', '#3f6fd1', '#f6c945', '#5fae4a', '#ee7fa6'];
  for (let i = 0; i < n; i++) { const ch = L[Math.floor(c.R() * L.length)], col = pick(c, cols), t = textTex(ch, { w: 128, h: 128, bg: col, fg: '#ffffff', big: .9, lh: .9 });
    const s = .1, lvl = i < 3 ? 0 : 1, x = lvl ? -.055 + (i - 3) * .11 : (i - 1) * .115;
    mesh(g, rbox(s, s, s, .012), TM(t, { rough: .6 }), [x, s / 2 + lvl * s, (c.R() - .5) * .03], [0, (c.R() - .5) * .5, 0]); }
  ink(g, .004); return g;
}
/** a sitting teddy bear (~.36 m) */
function teddy(c, col = '#b5793f') {
  const g = new THREE.Group(); g.name = 'teddy'; const m = M(col, { rough: .95 }), lt = M(shade(col, .35), { rough: .95 }), dk = M('#2a1d17', { rough: .4 });
  mesh(g, sph(), m, [0, .12, 0], null, [.11, .12, .09]); mesh(g, sph(), lt, [0, .11, .06], null, [.07, .08, .04]);
  mesh(g, sph(), m, [0, .28, .01], null, .085); mesh(g, sph(), lt, [0, .265, .075], null, [.04, .03, .03]); mesh(g, sph(12, 8), dk, [0, .28, .1], null, .012);
  for (const s of [-1, 1]) { mesh(g, sph(), m, [s * .065, .35, 0], null, .032); mesh(g, sph(12, 8), dk, [s * .03, .3, .078], null, .01); mesh(g, sph(), m, [s * .1, .14, .04], null, [.035, .07, .035]); mesh(g, sph(), m, [s * .06, .04, .09], null, [.04, .035, .07]); }
  ink(g, .004); return g;
}
/** a slowly turning mobile of planets and stars hanging from the ceiling (kids' rooms) */
function mobile(c, x, z, h) {
  const g = new THREE.Group(); g.name = 'mobile'; g.position.set(x, h, z);
  tube(g, [[0, 0, 0], [0, -.35, 0]], .004, M('#e9e1cf'));
  const rot = new THREE.Group(); rot.position.y = -.35; g.add(rot);
  mesh(rot, torusG(.25, .008, TAU, 6, 40), M('#e9b44c', { rough: .4 }), [0, 0, 0], [PI / 2, 0, 0]);
  const cols = ['#e2432f', '#3f6fd1', '#f6c945', '#5fae4a', '#ee7fa6'];
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, L = .12 + (i % 3) * .07; tube(rot, [[Math.cos(a) * .25, 0, Math.sin(a) * .25], [Math.cos(a) * .25, -L, Math.sin(a) * .25]], .002, M('#e9e1cf'), 4);
    mesh(rot, sph(16, 10), M(cols[i], { rough: .5 }), [Math.cos(a) * .25, -L - .04, Math.sin(a) * .25], null, .045); }
  ink(g, .003); g.userData.solid = false; g.userData.update = t => { rot.rotation.y = t * .5; };
  c.S.add(g); return g;
}
/** a dial-up modem with blinking lights (90s desks) */
function modem(c) {
  const g = new THREE.Group(); g.name = 'modem'; mesh(g, rbox(.22, .045, .16, .015), M('#d9d2c0', { rough: .5 }), [0, .0225, 0]);
  const leds = []; for (let i = 0; i < 6; i++) { const m = toonMat(i % 3 === 0 ? '#ff4a3a' : '#5aff6a', { emissive: i % 3 === 0 ? '#ff4a3a' : '#5aff6a', ei: 2 }).clone(); leds.push(m); deco(mesh(g, sph(8, 6), m, [-.07 + i * .028, .03, .081], null, .006)); }
  ink(g, .003); g.userData.update = t => leds.forEach((m, i) => { m.emissiveIntensity = Math.sin(t * (6 + i * 3.1) + i) > (i < 2 ? -.8 : .2) ? 2.2 : .15; });
  return g;
}
/** a desk monitor on a stand with a live screen (modern) */
function monitor(c, draw, o = {}) {
  const g = new THREE.Group(); g.name = 'monitor'; const w = o.w ?? .56, h = o.h ?? .33, dk = M('#2f3036', { rough: .45 });
  mesh(g, rbox(.22, .015, .16, .007), dk, [0, .0075, 0]); mesh(g, rbox(.04, .22, .03, .01), dk, [0, .12, -.03]);
  const s = liveScreen(c, w, h, draw, { name: 'monitor screen', bezel: '#2f3036' }); s.position.set(0, .22 + h / 2, -.01); g.add(s);
  ink(g, .004); g.userData.screen = s.userData.screen; return g;
}
const CODE = (x, w, h, t) => { x.fillStyle = '#1b2233'; x.fillRect(0, 0, w, h); const lh = h / 14, sc = Math.floor(t * 3);
  for (let i = 0; i < 14; i++) { const k = (i + sc) * 7919 % 97, ind = (k % 4) * 18; x.fillStyle = ['#7ad8ff', '#ffd166', '#b8ff7a', '#ff8fb0', '#e9e9f0'][k % 5]; x.fillRect(14 + ind, i * lh + lh * .3, 40 + (k * 13) % (w * .6), lh * .45); } };
const CHART = (x, w, h, t) => { x.fillStyle = '#f4f6fa'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d2b4f'; x.fillRect(0, 0, w, h * .14); x.strokeStyle = '#2f9c95'; x.lineWidth = 6; x.beginPath();
  for (let i = 0; i <= 20; i++) x.lineTo(i / 20 * w, h * (.8 - .5 * (i / 20) - .12 * Math.sin(i * 1.3 + t * 2))); x.stroke(); x.fillStyle = '#e2432f'; for (let i = 0; i < 6; i++) x.fillRect(w * .08 + i * w * .14, h * .9, w * .08, -h * (.1 + .05 * ((i * 7) % 5))); };
/** a cubicle partition (fabric panel with a trim cap), length along x */
function partition(c, len, h = 1.3, col = '#7d8ea0') {
  const g = new THREE.Group(); g.name = 'partition';
  mesh(g, rbox(len, h, .06, .02), TM(ptex('carpet', col, [len / .6, h / .6], { n: 2, c2: shade(col, -.08), c3: shade(col, .05) }), { rough: 1 }), [0, h / 2, 0]);
  mesh(g, rbox(len + .02, .04, .08, .015), M('#c9ccd2', { rough: .4 }), [0, h, 0]);
  for (const s of [-1, 1]) mesh(g, rbox(.05, h, .08, .015), M('#c9ccd2', { rough: .4 }), [s * len / 2, h / 2, 0]);
  ink(g, .006); return g;
}
/** a water cooler (offices): bottle bubbles now and then */
function waterCooler(c) {
  const g = new THREE.Group(); g.name = 'water cooler';
  mesh(g, rbox(.32, .95, .32, .04), M('#eceae4', { rough: .5 }), [0, .475, 0]);
  mesh(g, rbox(.2, .12, .04, .02), M('#9aa3ad'), [0, .72, .17]);
  for (const [x, col] of [[-.05, '#3f6fd1'], [.05, '#e2432f']]) mesh(g, rcyl(.012, .012, .04, .004, 10), M(col), [x, .69, .18], [PI / 2, 0, 0]);
  mesh(g, rcyl(.13, .13, .38, .06, 28), M('#7fc6ff', { rough: .15, transparent: true, opacity: .8 }), [0, .97, 0]);
  mesh(g, rcyl(.05, .05, .06, .015, 16), M('#7fc6ff', { rough: .15 }), [0, .93, 0]);
  ink(g, .005); return g;
}
/** an office printer / copier */
function printer(c) {
  const g = new THREE.Group(); g.name = 'printer'; const b = M('#e3e1da', { rough: .5 }), dk = M('#4a4d55', { rough: .5 });
  mesh(g, rbox(.6, .75, .55, .04), b, [0, .375, 0]); mesh(g, rbox(.62, .12, .57, .03), b, [0, .81, 0]); mesh(g, rbox(.45, .02, .3, .01), M('#ffffff'), [0, .885, .05]);
  mesh(g, rbox(.5, .05, .02, .01), dk, [0, .55, .28]); mesh(g, rbox(.5, .05, .02, .01), dk, [0, .3, .28]); deco(mesh(g, rbox(.08, .03, .01, .005), glowM('#5aff8a', 1.5), [.2, .78, .29]));
  ink(g, .006); g.userData.top = .87; return g;
}
const ECG = (x, w, h, t) => { x.fillStyle = '#0b1a14'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(80,255,140,.15)'; x.lineWidth = 1; for (let i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
  x.strokeStyle = '#5aff8c'; x.lineWidth = 5; x.lineJoin = 'round'; x.beginPath(); const off = (t * 220) % w;
  for (let i = 0; i <= w; i += 4) { const ph = ((i + off) % 180) / 180; const y = ph > .4 && ph < .44 ? -.9 : ph > .44 && ph < .48 ? .5 : ph > .6 && ph < .7 ? -.18 * Math.sin((ph - .6) * 31) : 0; x.lineTo(i, h * .42 + y * h * .3); } x.stroke();
  x.fillStyle = '#5aff8c'; x.font = FONT(800, h * .2); x.textAlign = 'right'; x.fillText(String(70 + Math.round(4 * Math.sin(t * .7))), w * .95, h * .86); x.fillStyle = '#7ad8ff'; x.font = FONT(800, h * .14); x.textAlign = 'left'; x.fillText('98%', w * .05, h * .88); };
/** a hanging privacy curtain on a ceiling rail (hospital) along x */
function curtainRail(c, len, h, col = '#9fc4d8') {
  const g = new THREE.Group(); g.name = 'curtain';
  mesh(g, rbox(len, .03, .04, .01), M('#c9ccd2', { rough: .4, metal: .3 }), [0, h - .02, 0]);
  const geo = new THREE.PlaneGeometry(len, h - .45, 60, 1), Pp = geo.attributes.position; for (let i = 0; i < Pp.count; i++) Pp.setZ(i, Math.sin(Pp.getX(i) * 9) * .05); geo.computeVertexNormals();
  const m = mesh(g, geo, M(col, { rough: .9, side: THREE.DoubleSide }), [0, (h - .45) / 2 + .35, 0]); m.userData.noOutline = true;
  ink(g, .004); return g;
}
/** a jukebox: arched cabinet with colour-cycling glowing bands */
function jukebox(c) {
  const g = new THREE.Group(); g.name = 'jukebox'; const wd = M('#8a4a2a', { rough: .5 });
  mesh(g, rbox(.8, 1.1, .5, .06), wd, [0, .55, 0]); mesh(g, rcyl(.4, .4, .5, .06, 32), wd, [0, 1.1, -.25], [PI / 2, 0, 0]);
  const mats = ['#ff4a8a', '#ffd166', '#5ad8ff'].map(col => toonMat(col, { emissive: col, ei: 2 }).clone());
  mats.forEach((m, i) => { const t = mesh(g, torusG(.33 - i * .05, .022, PI, 8, 32), m, [0, 1.1, .26]); deco(t); });
  mesh(g, rbox(.5, .3, .04, .02), TM(textTex(['A1  B2  C3', 'D4  E5  F6'], { w: 256, h: 160, bg: '#fff3d6', fg: '#8a2a2a' }), { glow: .6 }), [0, .8, .25]);
  deco(mesh(g, rbox(.6, .12, .03, .02), mats[2], [0, .25, .25]));
  ink(g, .006); g.userData.update = t => mats.forEach((m, i) => { m.emissiveIntensity = 1.4 + 1.1 * Math.sin(t * 2.5 + i * 2.1); });
  return g;
}
/** a glowing glass-door drinks fridge (shops) */
function fridgeCase(c, w = 1.2, o = {}) {
  const g = new THREE.Group(); g.name = 'drinks fridge'; const h = 2.0, d = .7, fr = M(o.color || '#e9e9ee', { rough: .4 });
  mesh(g, rbox(w, h, d, .03), fr, [0, h / 2, 0]);
  const inner = goodsShelf(c, w - .12, h - .3, d * .7, { rows: 5, frame: '#cfd6de', palette: ['#e2432f', '#f6c945', '#3f9c95', '#3f6fd1', '#5fae4a', '#ff8a3a'], seed: o.seed });
  inner.position.set(0, .12, .02); g.add(inner);
  deco(mesh(g, planeG(w - .12, h - .3), glowM('#dff6ff', .5), [0, h / 2, -d / 2 + .06]));
  const gl = mesh(g, planeG(w - .1, h - .26), new THREE.MeshStandardMaterial({ color: '#bfe8ff', transparent: true, opacity: .18, roughness: .05 }), [0, h / 2, d / 2 + .005]); gl.userData.noOutline = true; gl.castShadow = false;
  for (const s of [-1, 0, 1]) mesh(g, rbox(.04, h - .2, .03, .01), fr, [s * (w / 2 - .03), h / 2, d / 2]);
  deco(mesh(g, rbox(w - .1, .14, .02, .01), TM(textTex(o.text || 'ICE COLD', { w: 512, h: 64, bg: '#2f9c95', fg: '#ffffff' }), { glow: .9 }), [0, h - .1, d / 2 + .01]));
  ink(g, .007); g.userData.top = h; return g;
}
/** a lab bench: cabinets with a black worktop */
function labBench(c, w, d = .75, o = {}) { const g = counter(c, w, d, .92, { color: o.color || '#e3e6ea', top: o.top || '#2a2c32', name: 'lab bench' });
  for (let i = 0; i < Math.floor(w / .5); i++) mesh(g, rbox(.12, .02, .02, .008), M('#9aa3ad', { metal: .4 }), [-w / 2 + .25 + i * .5, .7, d / 2 - .02]); ink(g, .006); return g; }
/** a fume hood: a cabinet with a glowing interior behind a glass sash */
function fumeHood(c, w = 1.4) {
  const g = new THREE.Group(); g.name = 'fume hood'; const b = M('#e3e6ea', { rough: .45 });
  mesh(g, rbox(w, .9, .8, .03), b, [0, .45, 0]); mesh(g, rbox(w + .04, .06, .84, .02), M('#2a2c32'), [0, .92, 0]);
  for (const s of [-1, 1]) mesh(g, rbox(.08, 1.1, .8, .02), b, [s * (w / 2 - .04), 1.5, 0]);
  mesh(g, rbox(w, .45, .8, .03), b, [0, 2.27, 0]); mesh(g, rbox(w - .16, 1.1, .03, .01), b, [0, 1.5, -.38]);
  deco(mesh(g, planeG(w - .18, 1.05), glowM('#d9f4ff', .6), [0, 1.5, -.36]));
  const gl = mesh(g, planeG(w - .16, .7), new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: .22, roughness: .05 }), [0, 1.75, .38]); gl.userData.noOutline = true; gl.castShadow = false;
  mesh(g, rbox(w - .16, .05, .05, .015), M('#9aa3ad', { metal: .4 }), [0, 1.4, .38]);
  deco(mesh(g, rbox(.6, .1, .01, .005), TM(textTex('KEEP SASH LOW', { w: 512, h: 80, bg: '#f6c945', fg: '#2a1d17' })), [0, 2.2, .41]));
  ink(g, .007); g.userData.top = .95; return g;
}
/** a cork board with pinned notes */
function corkBoard(c, w = 1.1, h = .75) {
  const g = new THREE.Group(); g.name = 'cork board';
  mesh(g, rbox(w + .06, h + .06, .03, .01), M('#8a5a34', { rough: .6 }), [0, 0, .015]);
  deco(mesh(g, planeG(w, h), TM(ptex('dirt', '#c9955a', [1, 1], { seed: 9 }), { rough: 1 }), [0, 0, .031]));
  const cols = ['#fff3a6', '#ffd0e0', '#cfe8ff', '#d8ffd0', '#ffffff'];
  for (let i = 0; i < 7; i++) { const nw = .14 + c.R() * .1, nh = .12 + c.R() * .1; const m = mesh(g, rbox(nw, nh, .004, .002), M(pick(c, cols), { rough: .9 }), [(c.R() - .5) * (w - nw), (c.R() - .5) * (h - nh), .036], [0, 0, (c.R() - .5) * .3]); m.userData.noOutline = true;
    deco(mesh(g, sph(8, 6), M(pick(c, ['#e2432f', '#3f6fd1', '#f6c945'])), [m.position.x, m.position.y + nh * .35, .042], null, .012)); }
  ink(g, .004); g.userData.solid = false; return g;
}
/** a floating wall shelf (a board on brackets) at height y; returns the board (top = its surface) */
function wallShelf(c, wall, u, y, w = 1.0, o = {}) {
  const g = new THREE.Group(); g.name = 'wall shelf'; const wd = M(o.color || '#b77b45', { rough: .6 });
  mesh(g, rbox(w, .035, .24, .01), wd, [0, 0, .12]); for (const s of [-1, 1]) mesh(g, rbox(.025, .14, .2, .008), M('#3a3a3a'), [s * (w / 2 - .12), -.08, .1]);
  ink(g, .005); const wa = wallAt(c, wall, u, .004); g.position.set(wa.at[0], y, wa.at[1]); g.rotation.y = wa.ry; g.userData.top = .0175; g.userData.solid = false; g.userData.pickRoot = true; g.userData.kind = 'wall shelf';
  (wa.parent || c.S.scene).add(g); return g;
}
/** small things on a surface: names, a box [x0, z0, x1, z1] in world space, n */
function clutter(c, names, on, box, n, o = {}) { const out = []; for (let i = 0; i < n; i++) { const x = rr(c, box[0], box[2]), z = rr(c, box[1], box[3]); const p = P(c, pick(c, names), { on, at: [x, z], ry: rr(c, -PI, PI), ...o }); if (p) out.push(p); } return out; }

// ---------- exterior set pieces ----------
/** a facade texture (+ a lit-windows emissive map): plaster / brick / timber, floors of windows with shutters, a door */
function facadeTex(w, h, o = {}) {
  const px = 512, py = Math.round(px * h / w), R = rnd(o.seed ?? 3), fl = o.floors ?? 3, fh = (h - (o.base ?? 0)) / fl, ppm = px / w;
  const wins = []; for (let f = 0; f < fl; f++) { const n = Math.max(1, Math.round(w / (o.pitch ?? 1.6))); for (let i = 0; i < n; i++) wins.push({ f, i, n, lit: R() < (o.litShare ?? .55) }); }
  const winRect = W_ => { const cw = w / W_.n, ww = Math.min(cw * .5, o.winW ?? .9), wh = fh * (o.winH ?? .5); return { x: (W_.i + .5) * cw - ww / 2, y: h - (W_.f * fh + fh * .32 + (o.base ?? 0)) - wh, w: ww, h: wh }; };
  const map = canvasTex(px, py, (x, W, H) => {
    const kind = o.kind || 'plaster', col = o.color || '#e9c46a';
    x.fillStyle = col; x.fillRect(0, 0, W, H);
    if (kind === 'brick') PAINT.brick(x, W, H, col, R, { rows: Math.round(h * 7), cols: Math.round(w * 2.2), mortar: shade(col, .3) }); else if (kind === 'stone') PAINT.ashlar(x, W, H, col, R); else blot(x, W, H, col, R, 500, .1, 6, 26, .3);
    if (kind === 'timber') { x.fillStyle = o.beam || '#5b3b25'; for (let f = 0; f <= fl; f++) x.fillRect(0, H - (f * fh + (o.base ?? 0)) * ppm - 8, W, 12); for (let i = 0; i <= 4; i++) x.fillRect(i * W / 4 - 6, 0, 12, H); for (let f = 0; f < fl; f++) for (let i = 0; i < 4; i++) { const y0 = H - (f * fh + (o.base ?? 0)) * ppm, y1 = y0 - fh * ppm; x.save(); x.lineWidth = 9; x.strokeStyle = o.beam || '#5b3b25'; x.beginPath(); x.moveTo(i * W / 4, y0); x.lineTo((i + 1) * W / 4, y1); x.stroke(); x.restore(); } }
    if (o.band) { x.fillStyle = shade(col, -.25); for (let f = 1; f < fl; f++) x.fillRect(0, H - (f * fh + (o.base ?? 0)) * ppm - 5, W, 10); }
    for (const wn of wins) { const r = winRect(wn), X = r.x * ppm, Y = r.y * ppm, WW = r.w * ppm, HH = r.h * ppm;
      if (o.shutters !== false && kind !== 'brick') { x.fillStyle = o.shutter || '#3f7a5a'; x.fillRect(X - WW * .42, Y, WW * .38, HH); x.fillRect(X + WW * 1.04, Y, WW * .38, HH); x.fillStyle = shade(o.shutter || '#3f7a5a', -.25); for (let k = 1; k < 6; k++) { x.fillRect(X - WW * .42, Y + k * HH / 6, WW * .38, 2); x.fillRect(X + WW * 1.04, Y + k * HH / 6, WW * .38, 2); } }
      x.fillStyle = o.frame || '#f4efe3'; x.beginPath(); if (o.arch) { x.roundRect(X - 6, Y - 6, WW + 12, HH + 12, [WW / 2 + 6, WW / 2 + 6, 3, 3]); } else x.rect(X - 6, Y - 6, WW + 12, HH + 12); x.fill();
      x.fillStyle = wn.lit && o.night ? '#ffd58a' : '#3a4a66'; x.beginPath(); if (o.arch) x.roundRect(X, Y, WW, HH, [WW / 2, WW / 2, 0, 0]); else x.rect(X, Y, WW, HH); x.fill();
      x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(X + 4, Y + 4, WW * .25, HH * .5); x.fillStyle = o.frame || '#f4efe3'; x.fillRect(X + WW / 2 - 3, Y, 6, HH); x.fillRect(X, Y + HH * .5 - 3, WW, 6);
      x.fillStyle = shade(col, -.35); x.fillRect(X - 10, Y + HH + 6, WW + 20, 8); }
    if (o.door !== false && (o.base ?? 0) === 0) { const dw = 1.0 * ppm, dh = Math.min(2.2, fh * .78) * ppm, dx = W * (o.doorAt ?? .5) - dw / 2; x.fillStyle = o.doorColor || '#5b3b25'; x.beginPath(); x.roundRect(dx, H - dh, dw, dh, [dw / 2, dw / 2, 0, 0]); x.fill(); x.fillStyle = shade(o.doorColor || '#5b3b25', -.3); x.fillRect(dx + dw / 2 - 2, H - dh + 20, 4, dh - 20); x.fillStyle = '#e9b44c'; x.beginPath(); x.arc(dx + dw * .75, H - dh * .45, 5, 0, TAU); x.fill(); }
    if (o.sign) { x.font = FONT(800, Math.round(ppm * .42)); x.textAlign = 'center'; x.textBaseline = 'middle'; const sw = Math.min(W * .9, x.measureText(o.sign).width + ppm * .6), sy = H - ((o.signAt ?? fl - .15) * fh + (o.base ?? 0)) * ppm;
      x.fillStyle = o.signBg || 'rgba(0,0,0,0)'; x.fillRect(W / 2 - sw / 2, sy - ppm * .35, sw, ppm * .7); x.fillStyle = o.signColor || '#f4efe3'; x.fillText(o.sign, W / 2, sy, W * .86); }
  });
  let emi = null;
  if (o.night) emi = canvasTex(px / 2, Math.round(py / 2), (x, W, H) => { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); const k = W / w; for (const wn of wins) if (wn.lit) { const r = winRect(wn); x.fillStyle = '#ffd08a'; x.fillRect(r.x * k, r.y * k, r.w * k, r.h * k); } });
  return { map, emi };
}
/** a town house / block: rounded body with a painted facade on +z, a gable or flat roof, chimney */
function townhouse(c, w, h, d, o = {}) {
  const g = new THREE.Group(); g.name = o.name || 'building'; const fl = o.floors ?? Math.max(1, Math.round(h / 3));
  const ft = facadeTex(w, h, { ...o, floors: fl, seed: o.seed ?? Math.floor(c.R() * 1e4), night: c.mood === 'night' || c.mood === 'storm' });
  const fm = new THREE.MeshStandardMaterial({ map: ft.map, roughness: .9 }); if (ft.emi) { fm.emissive.set('#ffffff'); fm.emissiveMap = ft.emi; fm.emissiveIntensity = 1.3; }
  const side = M(shade(o.color || '#e9c46a', -.12), { rough: .95 });
  mesh(g, rbox(w, h, d, .05, 1), [side, side, side, side, fm, side], [0, h / 2, 0]);
  const roofC = o.roof || '#a8503a', rm = M(roofC, { rough: .8 });
  if (o.roofKind === 'flat') { mesh(g, rbox(w + .2, .25, d + .2, .05), M(shade(o.color || '#e9c46a', -.3)), [0, h + .1, 0]); }
  else { const rh = o.roofH ?? Math.min(2.6, w * .45), sh = new THREE.Shape(); sh.moveTo(-w / 2 - .3, 0); sh.lineTo(w / 2 + .3, 0); sh.lineTo(0, rh); sh.closePath();
    const geo = memo(`roof${q(w)},${q(rh)},${q(d)}`, () => { const e = new THREE.ExtrudeGeometry(sh, { depth: d + .4, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2 }); e.translate(0, 0, -(d + .4) / 2); e.computeVertexNormals(); return e; });
    const rf = mesh(g, geo, rm, [0, h, 0]); rf.userData.noOutline = false;
    if (o.chimney !== false) mesh(g, rbox(.5, 1.4, .5, .05), M(shade(roofC, -.2)), [w * .25, h + rh * .55, -d * .15]); }
  if (o.awning) { const aw = new THREE.Group(); const am = TM(ptex('stripes', o.awning, [w / 1.2, 1], { n: 4, c2: '#ffffff', c3: o.awning }), { rough: .8, side: THREE.DoubleSide }); mesh(aw, rbox(w * .8, .05, 1.2, .02), am, [0, 0, .6], [.35, 0, 0]); aw.position.set(0, (o.awningY ?? 2.7), d / 2); g.add(aw); }
  ink(g, o.ink ?? .02); g.userData.solid = true; g.userData.footprint = { w, d }; return g;
}
/** a stone clock tower: ashlar shaft, four clock faces (the minute hands sweep), belfry, pointed roof */
function clockTower(c, h = 16, o = {}) {
  const g = new THREE.Group(); g.name = 'clock tower'; const w = o.w ?? 2.6, st = TM(ptex('ashlar', o.color || '#c9b48a', [w / 1.5, h / 1.5]), { rough: .95 });
  mesh(g, rbox(w, h, w, .06, 1), st, [0, h / 2, 0]); mesh(g, rbox(w + .4, .5, w + .4, .08), M(shade(o.color || '#c9b48a', -.15)), [0, .25, 0]);
  for (const y of [h * .55, h - .2]) mesh(g, rbox(w + .25, .25, w + .25, .06), M(shade(o.color || '#c9b48a', -.18)), [0, y, 0]);
  const face = canvasTex(256, 256, (x, W) => { x.fillStyle = '#f6f0dc'; x.beginPath(); x.arc(W / 2, W / 2, W / 2, 0, TAU); x.fill(); x.strokeStyle = '#2a1d17'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.lineWidth = 8; x.beginPath(); x.moveTo(W / 2 + Math.sin(a) * W * .36, W / 2 - Math.cos(a) * W * .36); x.lineTo(W / 2 + Math.sin(a) * W * .45, W / 2 - Math.cos(a) * W * .45); x.stroke(); } });
  const hands = [], fy = h - 1.6;
  for (let i = 0; i < 4; i++) { const a = i * PI / 2, fg = new THREE.Group(); fg.rotation.y = a; g.add(fg);
    mesh(fg, rcyl(.85, .85, .12, .04, 40), M('#5b3b25'), [0, fy, w / 2 - .02], [PI / 2, 0, 0]); deco(mesh(fg, memo('cf', () => new THREE.CircleGeometry(.76, 40)), TM(face, { glow: c.mood === 'night' ? .9 : 0 }), [0, fy, w / 2 + .105]));
    const hh = new THREE.Group(); hh.position.set(0, fy, w / 2 + .13); fg.add(hh); mesh(hh, rbox(.07, .42, .03, .015), M('#2a1d17'), [0, .19, 0]); hh.rotation.z = -1.6;
    const mh = new THREE.Group(); mh.position.set(0, fy, w / 2 + .15); fg.add(mh); mesh(mh, rbox(.05, .64, .03, .015), M('#2a1d17'), [0, .3, 0]); hands.push(mh); }
  for (const s of [-1, 1]) for (const k of [0, 1]) mesh(g, rbox(.5, 1.6, .2, .08), M('#2a2622'), k ? [s * .6, h - 4, w / 2 + .01] : [w / 2 + .01, h - 4, s * .6], k ? null : [0, PI / 2, 0]);
  const roof = mesh(g, memo('pyr' + w, () => { const cg = new THREE.ConeGeometry(w * .82, w * 1.6, 4, 1); cg.rotateY(PI / 4); return cg; }), M(o.roof || '#3f5a6a', { rough: .6 }), [0, h + w * .8, 0]); void roof;
  mesh(g, rcyl(.03, .03, 1.2, .01, 8), M('#e9b44c', { metal: .5, rough: .3 }), [0, h + w * 1.6, 0]); mesh(g, sph(12, 8), M('#e9b44c', { metal: .5, rough: .3 }), [0, h + w * 1.6 + 1.2, 0], null, .12);
  ink(g, .03); g.userData.update = t => hands.forEach(m => { m.rotation.z = -(t * .1) % TAU; }); g.userData.footprint = { w, d: w }; return g;
}
/** a café table with two chairs and a parasol */
function cafeSet(c, col = '#e2432f') {
  const g = new THREE.Group(); g.name = 'cafe table'; const mt = M('#3a3d45', { rough: .4, metal: .3 });
  mesh(g, rcyl(.32, .32, .03, .012, 28), M('#f4efe3', { rough: .5 }), [0, .72, 0]); mesh(g, rcyl(.025, .025, .72, .01, 10), mt, [0, 0, 0]); mesh(g, rcyl(.22, .24, .03, .01, 20), mt, [0, 0, 0]);
  mesh(g, rcyl(.02, .02, 2.2, .008, 8), M('#e9e1cf'), [0, 0, 0]);
  const can = memo('parasol', () => { const p = []; for (let i = 0; i <= 8; i++) { const k = i / 8; p.push(new THREE.Vector2(1.15 * k, .42 * (1 - k * k))); } const l = new THREE.LatheGeometry(p, 8); l.computeVertexNormals(); return l; });
  mesh(g, can, TM(ptex('stripes', col, [4, 1], { n: 2, c2: '#ffffff', c3: col }), { side: THREE.DoubleSide, rough: .8 }), [0, 1.85, 0]).name = 'parasol';
  ink(g, .006);
  for (const s of [-1, 1]) { const ch = makeProp(PROP_REG.chair ? 'chair' : 'stool', { seed: 3, cushion: col }); ch.position.set(s * .55, 0, s * .1); ch.rotation.y = -s * PI / 2; g.add(ch); }
  g.userData.footprint = { r: .8 }; return g;
}
/** a stone fountain: round basin, column, upper bowl, rippling water and a playing jet */
function fountain(c, r = 1.6) {
  const g = new THREE.Group(); g.name = 'fountain'; const st = M(c.o.stone || '#d8ccb0', { rough: .9 });
  const rim = memo('fnt' + r, () => { const p = []; const a = (cx, cy, rr2, a0, a1) => { for (let i = 0; i <= 5; i++) { const t = a0 + (a1 - a0) * i / 5; p.push(new THREE.Vector2(cx + Math.cos(t) * rr2, cy + Math.sin(t) * rr2)); } };
    p.push(new THREE.Vector2(r - .3, .25)); a(r - .15, .45, .15, PI, PI / 2); a(r - .15, .45, .15, PI / 2, 0); p.push(new THREE.Vector2(r, 0)); p.push(new THREE.Vector2(0, 0)); return new THREE.LatheGeometry(p.reverse(), 48); });
  mesh(g, rim, st); mesh(g, rcyl(.22, .3, 1.3, .05, 20), st, [0, 0, 0]);
  mesh(g, memo('fbowl', () => { const l = new THREE.LatheGeometry([[0, 0], [.2, 0], [.55, .14], [.62, .22], [.55, .24], [0, .14]].map(([a, b]) => new THREE.Vector2(a, b)), 32); l.computeVertexNormals(); return l; }), st, [0, 1.2, 0]);
  mesh(g, rcyl(.06, .08, .35, .02, 12), st, [0, 1.4, 0]);
  const wt = canvasTex(256, 256, (x, W) => { x.fillStyle = '#4aa8d8'; x.fillRect(0, 0, W, W); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 5; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(W / 2, W / 2, i * 16 + 8, 0, TAU); x.stroke(); } }); wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
  const wm = new THREE.MeshStandardMaterial({ map: wt, roughness: .15, emissive: '#2a6a9a', emissiveIntensity: .25 });
  const water = deco(mesh(g, memo('fwat' + r, () => new THREE.CircleGeometry(r - .3, 40)), wm, [0, .42, 0], [-PI / 2, 0, 0]));
  deco(mesh(g, memo('fwat2', () => new THREE.CircleGeometry(.5, 24)), wm, [0, 1.36, 0], [-PI / 2, 0, 0]));
  const jm = new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: .55, roughness: .1, emissive: '#7ac8ff', emissiveIntensity: .3 }), jets = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, j = deco(tube(g, [[0, 1.75, 0], [Math.cos(a) * .3, 1.95, Math.sin(a) * .3], [Math.cos(a) * .55, 1.45, Math.sin(a) * .55]], .025, jm, 12)); jets.push(j); }
  ink(g, .012);
  g.userData.update = t => { wt.offset.set(Math.sin(t * .7) * .02, (t * .05) % 1); water.rotation.z = t * .1; jets.forEach((j, i) => { j.scale.setScalar(1 + .04 * Math.sin(t * 9 + i)); }); };
  g.userData.footprint = { r }; return g;
}
/** a pigeon pecking on the ground (bobs its head) */
function pigeon(c, ph = 0) {
  const g = new THREE.Group(); g.name = 'pigeon'; const gr = M(pick(c, ['#8a8f9a', '#a3a7b0', '#6f737e', '#c8c4bc']), { rough: .8 }), nk = M('#5aa08a', { rough: .4, metal: .2 });
  mesh(g, sph(16, 12), gr, [0, .12, 0], null, [.07, .07, .12]); mesh(g, rbox(.08, .02, .1, .01), M('#5a5e68'), [0, .13, -.12], [.4, 0, 0]);
  const head = new THREE.Group(); head.position.set(0, .17, .08); g.add(head); mesh(head, sph(12, 10), nk, [0, 0, 0], null, [.05, .05, .055]); mesh(head, sph(12, 10), gr, [0, .04, .03], null, .04);
  mesh(head, sph(8, 6), M('#e9a35a'), [0, .035, .075], null, [.012, .012, .025]); for (const s of [-1, 1]) deco(mesh(head, sph(6, 4), M('#2a1d17'), [s * .03, .05, .05], null, .009));
  for (const s of [-1, 1]) mesh(g, rcyl(.006, .006, .06, .002, 6), M('#e98a7a'), [s * .025, 0, .01]);
  ink(g, .004); g.userData.solid = false;
  g.userData.update = t => { const k = Math.max(0, Math.sin(t * 3 + ph)); head.position.set(0, .17 - k * .07, .08 + k * .05); head.rotation.x = k * .8; g.rotation.y += 0; };
  return g;
}
/** seagulls gliding in circles high up (the sky's moving element) */
function gulls(c, at, n = 4, r = 6) {
  const g = new THREE.Group(); g.name = 'gulls'; const wm = M('#f4f4f0', { rough: .7 }), tip = M('#3a3d45');
  const birds = []; for (let i = 0; i < n; i++) { const b = new THREE.Group(); mesh(b, sph(10, 8), wm, [0, 0, 0], null, [.08, .07, .2]);
    const wl = new THREE.Group(), wr = new THREE.Group(); b.add(wl, wr); mesh(wl, rbox(.45, .015, .12, .01), wm, [.22, 0, 0]); mesh(wl, rbox(.12, .016, .1, .008), tip, [.42, 0, 0]); mesh(wr, rbox(.45, .015, .12, .01), wm, [-.22, 0, 0]); mesh(wr, rbox(.12, .016, .1, .008), tip, [-.42, 0, 0]);
    ink(b, .006); g.add(b); birds.push({ b, wl, wr, ph: i * 1.7, rr: r * (.6 + (i % 3) * .25), y: (i % 2) * 1.5 }); }
  g.position.set(...at); g.userData.solid = false;
  g.userData.update = t => birds.forEach(B => { const a = t * .25 + B.ph; B.b.position.set(Math.cos(a) * B.rr, B.y + Math.sin(t * .7 + B.ph) * .4, Math.sin(a) * B.rr); B.b.rotation.set(0, -a, .25); const f = Math.sin(t * 5 + B.ph) * .35; B.wl.rotation.z = f; B.wr.rotation.z = -f; });
  c.S.scene.add(g); return g;
}
/** a brick warehouse with a painted name, big doors and a row of windows; front at +z */
function warehouse(c, w, h, d, o = {}) {
  const g = townhouse(c, w, h, d, { kind: 'brick', color: o.color || pick(c, ['#a8503a', '#9a4a34', '#b8643f']), floors: o.floors ?? 2, pitch: 2.4, winW: 1.2, winH: .45, arch: true, shutters: false, frame: '#e9e1cf', door: false, sign: o.name, signAt: (o.floors ?? 2) - .35, signColor: '#f4efe3', roofKind: o.roofKind || 'gable', roof: '#5a5a62', chimney: false, ink: .025, name: 'warehouse' });
  const dm = M('#5b3b25', { rough: .7 }); mesh(g, rbox(2.6, 3.0, .15, .05), dm, [-w * .22, 1.5, d / 2 + .02]); mesh(g, rbox(2.6, 3.0, .15, .05), dm, [w * .22, 1.5, d / 2 + .02]);
  for (const x of [-w * .22, w * .22]) for (let i = -1; i <= 1; i += 2) deco(mesh(g, rbox(.06, 2.8, .02, .01), M('#3a2416'), [x + i * .4, 1.5, d / 2 + .1]));
  mesh(g, rbox(w + .2, .4, 1.4, .05), M('#3a3d45'), [0, 3.4, d / 2 + .6]); ink(g, .02);
  return g;
}
/** a big riveted storage tank (molasses, water, oil): cylinder, banding rings, a domed top, a ladder, a painted name */
function storageTank(c, r = 7, h = 14, o = {}) {
  const g = new THREE.Group(); g.name = 'storage tank'; const col = o.color || '#9aa3ad';
  const tx = canvasTex(1024, 512, (x, W, H) => { x.fillStyle = col; x.fillRect(0, 0, W, H); for (let j = 0; j < 6; j++) { x.fillStyle = shade(col, -.08 + (j % 2) * .05); x.fillRect(0, j * H / 6, W, H / 6 - 3); x.fillStyle = shade(col, -.3); for (let i = 0; i < 64; i++) { x.beginPath(); x.arc(i * W / 64 + 8, j * H / 6 + 6, 3, 0, TAU); x.fill(); } }
    blot(x, W, H, col, rnd(4), 120, .25, 10, 50, .25); for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(110,60,30,.35)'; const X = (i * 131) % W; x.fillRect(X, (i * 71) % H, 6, 40 + (i * 13) % 90); }
    if (o.name) { x.font = FONT(800, 64); x.textAlign = 'center'; x.fillStyle = '#f4efe3'; x.fillText(o.name, W * .25, H * .4); x.fillText(o.name, W * .75, H * .4); } });
  mesh(g, memo(`tank${r},${h}`, () => { const cg = new THREE.CylinderGeometry(r, r, h, 48, 1, true); cg.translate(0, h / 2, 0); return cg; }), TM(tx, { rough: .6, metal: .2, side: THREE.DoubleSide }));
  mesh(g, memo(`tdome${r}`, () => new THREE.SphereGeometry(r * 1.02, 48, 12, 0, TAU, 0, PI * .14)), M(shade(col, -.1), { rough: .6, metal: .2 }), [0, h - r * 1.02 * Math.cos(PI * .14) + .02, 0]);
  for (const y of [.15, h * .33, h * .66, h - .1]) mesh(g, torusG(r + .04, .09, TAU, 6, 64), M(shade(col, -.3), { metal: .3 }), [0, y, 0], [PI / 2, 0, 0]);
  const lad = new THREE.Group(); lad.position.set(0, 0, r + .25); g.add(lad); for (const s of [-1, 1]) mesh(lad, rbox(.06, h, .06, .02), M('#3a3d45'), [s * .25, h / 2, 0]); for (let y = .4; y < h; y += .45) mesh(lad, rbox(.5, .04, .04, .015), M('#3a3d45'), [0, y, 0]);
  ink(g, .05); g.userData.footprint = { r }; return g;
}
/** a wooden pier / dock on posts: deck from x0..x1 (along x), depth d (along z), deck height y */
function pier(c, len, d, y = .9, o = {}) {
  const g = new THREE.Group(); g.name = 'pier'; const pm = M(o.post || '#5b3b25', { rough: .9 });
  mesh(g, rbox(len, .2, d, .04), TM(ptex('planks', o.color || '#8a6a4a', [len / 1.4, d / 1.4], { n: 6 }), { rough: .9 }), [0, y - .1, 0]);
  for (let x = -len / 2 + .3; x <= len / 2; x += 2.2) for (const z of [-d / 2 + .15, d / 2 - .15]) mesh(g, rcyl(.15, .17, y + 2.5, .05, 12), pm, [x, -2.5, z]);
  mesh(g, rbox(len, .16, .16, .04), pm, [0, y + .02, d / 2 - .08]);
  ink(g, .012); g.userData.top = y; g.userData.solid = false; return g;
}
/** an iron bollard with a rope loop */
function bollard(c) { const g = new THREE.Group(); g.name = 'bollard'; const m = M('#2f3036', { rough: .4, metal: .3 }); mesh(g, rcyl(.13, .16, .5, .04, 16), m); mesh(g, rcyl(.2, .2, .08, .03, 16), m, [0, .5, 0]); mesh(g, torusG(.17, .035, TAU, 8, 20), M('#c9a46a', { rough: 1 }), [0, .35, 0], [PI / 2, 0, 0]); ink(g, .005); return g; }
/** a wooden barrel (o.lying) */
function barrel(c, o = {}) { const g = new THREE.Group(); g.name = 'barrel'; const geo = memo('barrel', () => { const l = new THREE.LatheGeometry([[0, 0], [.26, 0], [.3, .2], [.32, .45], [.3, .7], [.26, .9], [0, .9]].map(([a, b]) => new THREE.Vector2(a, b)), 24); l.computeVertexNormals(); return l; });
  mesh(g, geo, M(o.color || pick(c, ['#8a5a34', '#a46a3c', '#7a4a2a']), { rough: .8 })); for (const y of [.15, .75]) mesh(g, torusG(y > .5 ? .285 : .29, .018, TAU, 6, 24), M('#3a3d45', { metal: .3 }), [0, y, 0], [PI / 2, 0, 0]);
  ink(g, .006); if (o.lying) { g.rotation.z = PI / 2; g.position.y = .32; } return g; }
/** a wooden two-wheeled cart (no horse), bed + barrels or sacks */
function cart(c, o = {}) {
  const g = new THREE.Group(); g.name = 'cart'; const wd = M('#8a5a34', { rough: .8 }), dk = M('#5b3b25');
  mesh(g, rbox(1.4, .1, 2.4, .03), wd, [0, .75, 0]); for (const s of [-1, 1]) mesh(g, rbox(.08, .35, 2.4, .03), wd, [s * .66, .95, 0]); mesh(g, rbox(1.4, .35, .08, .03), wd, [0, .95, -1.16]);
  for (const s of [-1, 1]) { const wh = new THREE.Group(); wh.position.set(s * .8, .6, .1); wh.rotation.y = PI / 2; g.add(wh); mesh(wh, torusG(.55, .05, TAU, 8, 32), dk); for (let i = 0; i < 8; i++) { const sp = mesh(wh, rbox(.04, 1.05, .04, .015), dk, [0, 0, 0]); sp.rotation.z = i * PI / 8; } mesh(wh, rcyl(.1, .1, .14, .03, 12), dk, [0, 0, -.07], [PI / 2, 0, 0]); }
  for (const s of [-1, 1]) strut(g, [s * .45, .75, 1.2], [s * .35, .45, 2.6], .035, wd);
  if (o.load !== false) for (let i = 0; i < 3; i++) { const b = barrel(c); b.position.set(-.35 + (i % 2) * .7, .8, -.6 + i * .55); b.scale.setScalar(.8); g.add(b); }
  ink(g, .008); return g;
}
/** a 1910s-style steam freighter at anchor (hull, bridge, funnel with smoke), along x */
function steamer(c, o = {}) {
  const g = new THREE.Group(); g.name = 'steamer'; const L = o.len ?? 26, hull = M(o.hull || '#2f3036', { rough: .7 }), red = M('#9a2a24'), wh = M('#e9e1cf', { rough: .7 });
  mesh(g, rbox(L, 3.2, 5, 1.2), hull, [0, .6, 0]); mesh(g, rbox(L - .4, .8, 4.8, .3), red, [0, -.8, 0]);
  mesh(g, rbox(6, 2.4, 3.6, .3), wh, [-2, 3.3, 0]); mesh(g, rbox(3.5, 1.4, 3.2, .25), wh, [-2, 5.1, 0]);
  mesh(g, rcyl(.8, .9, 5, .1, 20), M('#1d1d22'), [1.6, 3.2, 0]); mesh(g, rcyl(.82, .82, .9, .1, 20), red, [1.6, 7.0, 0]);
  for (const x of [-L * .36, L * .32]) mesh(g, rcyl(.15, .2, 11, .05, 10), M('#6b4a2f'), [x, 2.2, 0]);
  for (let i = 0; i < 8; i++) deco(mesh(g, sph(8, 6), glowM('#ffd58a', c.mood === 'night' ? 2 : 0), [-5 + i * .7, 3.6, 1.82], null, [.15, .15, .05]));
  ink(g, .04); if (o.smoke !== false) fx(c, 'smoke', { at: [(o.at?.[0] ?? 0) + 1.6 * Math.cos(o.ry ?? 0), 8.2 + (o.at?.[1] ?? 0), (o.at?.[2] ?? 0) - 1.6 * Math.sin(o.ry ?? 0)], color: 'grey', size: 1.2, grow: 3, rise: 1.4, rate: 3, life: 6, wind: [1.2, 0, 0], opacity: .7 });
  return g;
}
/** a eucalyptus (gum) tree: pale smooth trunk forking into sparse grey-green leaf clumps */
function gumTree(c, s = 1, o = {}) {
  const g = new THREE.Group(); g.name = 'gum tree'; const R = rnd(o.seed ?? Math.floor(c.R() * 1e4)), bark = M(o.bark || '#e9e1d0', { rough: .7 }), lf = M(o.leaf || pick(c, ['#7a9a6a', '#6a8a5a', '#8aa07a']), { rough: .95 });
  const base = [0, 0, 0], fork = [(R() - .5) * .6 * s, 3.2 * s, (R() - .5) * .4 * s];
  tube(g, [base, [fork[0] * .3, 1.5 * s, fork[2] * .2], fork], .22 * s, bark, 12);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + R(), L = (1.8 + R() * 1.6) * s, end = [fork[0] + Math.cos(a) * L * .7, fork[1] + L * (.7 + R() * .4), fork[2] + Math.sin(a) * L * .6];
    tube(g, [fork, [lerp(fork[0], end[0], .5), lerp(fork[1], end[1], .6) + .3 * s, lerp(fork[2], end[2], .5)], end], .1 * s, bark, 10);
    for (let k = 0; k < 3; k++) mesh(g, sph(12, 8), lf, [end[0] + (R() - .5) * 1.2 * s, end[1] + (R() - .3) * .6 * s, end[2] + (R() - .5) * 1.2 * s], null, [(.9 + R() * .5) * s, (.45 + R() * .25) * s, (.8 + R() * .5) * s]); }
  ink(g, .02 * s); g.userData.footprint = { r: .4 * s }; return g;
}
/** a camel (standing, o.sitting folds the legs) facing +z */
function camel(c, o = {}) {
  const g = new THREE.Group(); g.name = 'camel'; const col = o.color || pick(c, ['#c8955a', '#b8844a', '#d6a86a']), m = M(col, { rough: .9 }), dk = M(shade(col, -.25), { rough: .9 });
  const legY = o.sitting ? .2 : 1.0;
  mesh(g, sph(20, 14), m, [0, legY + .45, 0], null, [.45, .45, .85]); mesh(g, sph(16, 12), m, [0, legY + .85, -.05], null, [.33, .42, .45]);
  tube(g, [[0, legY + .55, .7], [0, legY + .75, 1.05], [0, legY + 1.35, 1.2], [0, legY + 1.6, 1.25]], .14, m, 16);
  mesh(g, sph(16, 12), m, [0, legY + 1.62, 1.42], null, [.15, .16, .3]); mesh(g, sph(12, 10), dk, [0, legY + 1.58, 1.68], null, [.13, .1, .1]);
  for (const s of [-1, 1]) { mesh(g, sph(8, 6), M('#2a1d17'), [s * .12, legY + 1.7, 1.52], null, .028); mesh(g, sph(8, 6), m, [s * .1, legY + 1.8, 1.32], null, [.04, .07, .04]); }
  if (o.sitting) { for (const [x, z] of [[-.3, .55], [.3, .55], [-.3, -.55], [.3, -.55]]) mesh(g, sph(10, 8), dk, [x, .18, z], null, [.12, .14, .3]); }
  else for (const [x, z] of [[-.25, .55], [.25, .55], [-.25, -.55], [.25, -.55]]) { tube(g, [[x, legY + .2, z], [x, legY * .5, z + .05], [x, .06, z]], .07, m, 8); mesh(g, sph(10, 8), dk, [x, .05, z + .04], null, [.1, .06, .13]); }
  if (o.packs !== false) { for (const s of [-1, 1]) mesh(g, rbox(.25, .45, .6, .08), M(pick(c, ['#8a3a2a', '#3f6f5a', '#c9893a'])), [s * .48, legY + .45, .1]); mesh(g, rbox(.7, .1, .7, .04), M('#6b4a2f'), [0, legY + .88, .35]); }
  tube(g, [[0, legY + .6, -.8], [0, legY + .2, -.95]], .03, dk, 6);
  ink(g, .012); return g;
}
/** a dry creek bed winding through: a sunken pale strip with pebbles + its banks */
function creekBed(c, pts, w = 2.4, color = '#d8c0a0') {
  const g = new THREE.Group(); g.name = 'creek bed'; const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], .015, p[1]))), N = 80;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) { const u = i / N, p = curve.getPointAt(u), t = curve.getTangentAt(u), n = new THREE.Vector3(-t.z, 0, t.x).normalize(), ww = w * (.8 + .3 * Math.sin(u * 13));
    for (const s of [-1, 1]) { pos.push(p.x + n.x * s * ww / 2, .02, p.z + n.z * s * ww / 2); uv.push(s > 0 ? 1 : 0, u * curve.getLength() / 2); } if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const t = ptex('dirt', color, [1, 1], { seed: 21 }); const m = new THREE.Mesh(geo, TM(t, { rough: 1, decal: true })); m.receiveShadow = true; m.userData.noPick = true; g.add(m);
  if (geo.attributes.normal.getY(0) < 0) { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const tt = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = tt; } geo.computeVertexNormals(); }
  c.S.scene.add(g); return { g, curve };
}
/** glowing crystal clusters (caves): hexagonal prisms with points, pulsing */
function crystals(c, col = '#7ae8ff', n = 6, s = 1) {
  const g = new THREE.Group(); g.name = 'crystals'; const m = toonMat(col, { emissive: col, ei: 1.6, rough: .2 }).clone(), geo = memo('crys', () => { const cg = new THREE.CylinderGeometry(.1, .12, .8, 6); cg.translate(0, .4, 0); const tip = new THREE.ConeGeometry(.1, .3, 6); tip.translate(0, .95, 0); const mg = mergeGeometries([cg.toNonIndexed(), tip.toNonIndexed()]); mg.computeVertexNormals(); return mg; });
  for (let i = 0; i < n; i++) { const k = (.5 + c.R() * .9) * s; mesh(g, geo, m, [(c.R() - .5) * .5 * s, 0, (c.R() - .5) * .5 * s], [(c.R() - .5) * .9, c.R() * PI, (c.R() - .5) * .9], [k, k * (.8 + c.R() * .8), k]); }
  ink(g, .006); const ph = c.R() * 9; g.userData.update = t => { m.emissiveIntensity = 1.3 + .6 * Math.sin(t * 1.3 + ph); }; return g;
}
/** a shipping container (corrugated box with doors on +x end) */
function container(c, col, o = {}) {
  const g = new THREE.Group(); g.name = 'container'; const L = o.len ?? 6, t = TM(ptex('corrugated', col, [L / 1.2, 1]), { rough: .7 });
  mesh(g, rbox(L, 2.6, 2.44, .05), t, [0, 1.3, 0]); mesh(g, rbox(.05, 2.5, 2.3, .02), M(shade(col, -.2)), [L / 2 + .01, 1.3, 0]);
  if (o.text) mesh(g, rbox(L * .6, .5, .02, .01), TM(textTex(o.text, { w: 512, h: 64, bg: col, fg: '#ffffff' })), [0, 2.0, 1.23]);
  ink(g, .02); return g;
}
/** rows of simple far buildings (a skyline band) with lit windows at night */
function skyline(c, z, x0, x1, o = {}) {
  const g = new THREE.Group(); g.name = 'skyline'; const R = rnd(c.seed * 41 + Math.round(z)), night = c.mood === 'night' || c.mood === 'storm';
  const wt = canvasTex(128, 256, (x, W, H) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); for (let j = 0; j < 16; j++) for (let i = 0; i < 4; i++) { x.fillStyle = night ? (R() < .45 ? '#ffd58a' : '#26304a') : '#9fb4cc'; x.fillRect(8 + i * 30, 6 + j * 16, 18, 9); } });
  wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
  for (let x = x0; x < x1; x += (o.gap ?? 7) * (.6 + R() * .7)) { const h = (o.h ?? 30) * (.4 + R() * .9), w = 5 + R() * 6, col = pick(c, o.colors || ['#9aa8c0', '#b8b0a8', '#8a9ab0', '#c4b8a0']);
    const t = wt.clone(); t.repeat.set(w / 8, h / 16); t.needsUpdate = true; const m = new THREE.MeshStandardMaterial({ color: col, map: t, roughness: .9 }); if (night) { m.emissive.set('#ffffff'); m.emissiveMap = t; m.emissiveIntensity = .5; m.color.set(shade(col, -.5)); }
    const b = mesh(g, rbox(w, h, w * .8, .1, 1), m, [x, h / 2, z + (R() - .5) * 10]); b.castShadow = false; }
  ink(g, .08); g.userData.solid = false; c.S.add(g); return g;
}
/** a big rocky shell around a cave (a displaced dome, rock texture inside) */
function caveShell(c, r = 9, o = {}) {
  const geo = new THREE.SphereGeometry(r, 64, 32, 0, TAU, 0, PI * .55), Pp = geo.attributes.position, s0 = c.seed * 3;
  for (let i = 0; i < Pp.count; i++) { const v = new THREE.Vector3(Pp.getX(i), Pp.getY(i), Pp.getZ(i)), n = v.clone().normalize(); const k = 1 + .14 * fbm2(n.x * 3 + n.y * 2, n.z * 3 - n.y * 2, s0) + .05 * fbm2(n.x * 9, n.z * 9 + n.y * 7, s0 + 4); v.multiplyScalar(k); v.y *= o.flat ?? .62; Pp.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, TM(ptex('rock', o.color || '#6a5a52', [10, 6]), { rough: 1, side: THREE.BackSide })); m.receiveShadow = true; m.userData.noPick = true; m.userData.ground = true;
  c.S.scene.add(m); return m;
}

// =====================================================================================================================
// THE PLACES
// =====================================================================================================================

// ---------------------------------------------------------------- living room
def('living-room', ['lounge', 'living'], ['home', 'interior'], 'a lived-in living room: sofa facing a TV, coffee table, rug, lamps, window, shelves, posters, ceiling fan',
  'era 80s (wood panelling, CRT + console, VHS) | 90s (CRT + PIXO 16 console, posters) | modern (flat TV, plants); mood day | night | warm | cold | alarm; wall, floor, tv false',
  c => {
    const S = c.S, e = c.era, retro = e === '80s' || e === '90s';
    const wall = c.o.wall || (e === '80s' ? '#d8b98a' : e === '90s' ? pick(c, ['#9fc4b8', '#e6c88f', '#c9b3d6']) : pick(c, ['#d9d2c4', '#b9c9c4', '#e3cfb4']));
    room(c, { w: 6.2, h: 2.8, back: -2.7, front: 3.4, wall, wallKind: e === '90s' ? 'motif' : 'plaster', wallOpt: { n: 5 }, floorKind: 'wood', floor: c.o.floor || '#a8703f',
      wainscot: e === '80s' ? { kind: 'panel', color: '#8a5a34', h: 1.0 } : null });
    lightIn(c);
    const R = c.room;
    // the sofa wall
    const sofa = P(c, 'sofa', { at: [0, R.zb + .48], color: c.o.sofa || (e === '80s' ? '#c9893a' : pick(c, ['#3f6f8a', '#b8453a', '#5c8a5a', '#7a4f8a'])), key: 'sofa' });
    seat(c, 'sofa', sofa, 0, R.zb + .5, 0, .57); seat(c, 'sofa-left', sofa, -.6, R.zb + .5, 0, .57); seat(c, 'sofa-right', sofa, .6, R.zb + .5, 0, .57);
    win(c, 'back', -.2, { w: 1.3, h: 1.1, mount: 1.05, key: 'window', curtains: e === '80s' ? '#c9893a' : undefined, blinds: e === 'modern' && chance(c, .5) });
    const fl = P(c, 'floor_lamp', { at: [-1.45, R.zb + .35], key: 'lamp', lit: c.mood !== 'day' || chance(c, .4) });
    const st = P(c, 'side_table', { at: [1.4, R.zb + .3], key: 'sideTable' });
    P(c, 'desk_lamp', { on: st, at: [1.32, R.zb + .25], ry: -.5, lit: true });
    if (chance(c, .8)) P(c, retro ? 'rotary_phone' : 'smartphone', { on: st, at: [1.52, R.zb + .38], ry: -.3, flat: true });
    // left wall: shelves; right wall: a door and the plant corner
    const bs = W(c, 'bookshelf', 'left', R.zb + 1.4, .18, { key: 'bookshelf' });
    W(c, 'cabinet', 'left', R.zb + 2.65, .27, { key: 'cabinet' });
    W(c, 'door', 'right', R.zb + 2.1, .002, { key: 'door', color: '#e9e1cf' });
    P(c, 'potted_plant', { at: [2.6, R.zb + .4], kind: 'leafy', sway: .02, scale: 1.5 });
    if (chance(c, .7)) P(c, 'potted_plant', { at: [-2.65, R.zb + .35], kind: pick(c, ['snake', 'bush']), sway: .015, scale: 1.3 });
    W(c, 'wall_clock', 'back', 1.4, 0, { mount: 2.05 });
    if (retro) { poster(c, 'back', -1.55, { y: 1.75, w: .48, h: .66 }); poster(c, 'left', R.zb + .55, { y: 1.65, w: .42, h: .6 }); }
    else { W(c, 'picture_frame', 'back', -1.6, 0, { w: .5, h: .62, mount: 1.75, art: 'abstract' }); W(c, 'picture_frame', 'left', R.zb + .55, 0, { w: .45, h: .35, mount: 1.6, art: 'landscape' }); }
    W(c, 'picture_frame', 'back', 1.05, 0, { w: .3, h: .38, mount: 1.55, art: pick(c, ['portrait', 'sunset']) });
    // middle: rug, coffee table and its clutter
    P(c, 'rug', { at: [0, R.zb + 1.6], w: 2.6, d: 1.8, color: e === '80s' ? '#7a3a2a' : undefined, pattern: e === '80s' ? 'diamond' : undefined });
    const ct = P(c, 'coffee_table', { at: [0, R.zb + 1.45], key: 'table' }); c.tops.table = ct;
    if (retro) { P(c, 'gamepad_retro', { on: ct, at: [-.2, R.zb + 1.5], ry: .4 }); P(c, 'vhs_tape', { on: ct, at: [.25, R.zb + 1.38], ry: -.3 }); }
    else P(c, 'game_controller', { on: ct, at: [-.2, R.zb + 1.5], ry: .4 });
    P(c, 'mug', { on: ct, at: [.05, R.zb + 1.55], fill: 'cocoa', key: 'mug' });
    if (chance(c, .7)) P(c, 'pizza_box', { on: ct, at: [.3, R.zb + 1.45], ry: .2, open: .0 });
    if (chance(c, .5)) P(c, 'bowl', { on: ct, at: [-.35, R.zb + 1.35], fill: 'cereal' });
    // the TV in front of the sofa (a foreground piece from the wide, the subject of the reverse angle)
    if (c.o.tv !== false) {
      const tx = -.4, unit = P(c, 'cabinet', { at: [tx, .75], ry: PI, key: 'tvStand', color: retro ? '#6b4329' : '#2f3036' });
      const tv = retro ? P(c, 'crt_tv', { on: unit, at: [tx, .78], ry: PI, show: c.o.show || 'cartoon', key: 'tv' }) : P(c, 'flat_tv', { on: unit, at: [tx, .8], ry: PI, show: c.o.show || 'cartoon', key: 'tv' });
      if (retro) { P(c, 'game_console', { on: unit, at: [tx + .45, .72], ry: PI + .2, key: 'console' }); for (let i = 0; i < 3; i++) P(c, 'vhs_tape', { on: unit, at: [tx - .35 - i * .02, .7], y: i * .03, ry: PI + .3 }); }
      // the screen glows on the room (a soft cool spill toward the sofa)
      if (tv) lamp(c, [tx, 1.0, .3], c.mood === 'night' ? '#9fc8ff' : '#cfe4ff', c.mood === 'night' ? .9 : .35, 3.5);
    }
    // the front wall (seen from the reverse angle): a shelf, a poster, a window
    W(c, 'shelf', 'front', -1.7, .18, { w: 1.1 });
    if (retro) poster(c, 'front', .8, { y: 1.65 }); else W(c, 'picture_frame', 'front', .8, 0, { art: 'landscape', w: .7, h: .5, mount: 1.55 });
    W(c, 'radiator', 'front', 1.9, 0);
    W(c, 'window', 'front', 1.9, 0, { view: c.view, w: .9, h: 1.1, mount: 1.0 });
    // ceiling: a fan with its lamp (the ticking element) + a far corner plant
    ceilingFan(c, 0, -.6, { color: e === '80s' ? '#6b4a2f' : '#e9e1cf' });
    if (c.view === 'day' || c.view === 'sunset') fx(c, 'godrays', { at: [-.2, 1.6, R.zb + .05], size: [1.2, 1.0], dir: [.25, -.75, 1], length: 2.0, count: 3, intensity: .25, dust: 40, color: c.view === 'sunset' ? '#ffc08a' : '#fff0c8' });
    else fx(c, 'dust', { at: [0, 1.3, -1], area: [3, 2, 2.5], count: 40, intensity: .5 });
    // where people go, and the cameras
    spot(c, 'center', 0, -.35, 0); spot(c, 'couch', 0, R.zb + .78, 0); spot(c, 'window', -.25, R.zb + .95, PI); spot(c, 'tv', -1.15, .3, PI + .35); spot(c, 'door', R.x1 - .6, R.zb + 2.1, -PI / 2); spot(c, 'shelf', R.x0 + .75, R.zb + 1.4, -PI / 2);
    cam(c, 'wide', [0, 1.15, R.zb + 1.4], 4.4, 24, 9, 50, { spot: 'center' });
    cam(c, 'couch', [0, .95, R.zb + .75], 2.0, -28, 4, 45, { seat: 'sofa' });
    cam(c, 'tv', [-.7, 1.1, .6], 2.5, 188, 8, 50, { spot: 'tv' });
    cam(c, 'high', [0, .9, R.zb + 1.3], 4.6, 32, 30, 50, { spot: 'center' });
    cam(c, 'center', [0, 1.25, -.35], 3.0, 10, 6, 40, { spot: 'center' });
    void fl; void bs;
  });

// ---------------------------------------------------------------- kids' bedroom
def('kids-bedroom', ['bedroom', 'kids-room', 'nursery'], ['home', 'interior'], "a kid's bedroom: single bed under string lights and a turning mobile, posters, toys, desk, wardrobe, round rug",
  'mood day | night (glow stars on the ceiling, night light) | warm; wall; theme space | dino',
  c => {
    const wall = c.o.wall || pick(c, ['#a9d3e6', '#f2c4c8', '#bfe0b0', '#d9c8f0']);
    room(c, { w: 5.6, h: 2.7, back: -2.5, front: 3.0, wall, wallKind: 'stripes', wallOpt: { n: 6 }, floorKind: 'wood', floor: c.o.floor || '#c58d55', wainscot: { kind: 'plaster', color: '#f6f0e2', h: .85 }, trim: '#ffffff' });
    lightIn(c); const R = c.room, night = c.mood === 'night';
    const bed = P(c, 'bed', { at: [-1.45, R.zb + 1.08], single: true, color: pick(c, ['#3f6fd1', '#e2432f', '#5fae4a']), key: 'bed' });
    seat(c, 'bed', bed, -1.0, R.zb + 1.35, PI / 2, .56);
    if (bed) { const td = put(c, teddy(c), [-1.55, .56, R.zb + .45], .2, 'teddy'); void td; }
    win(c, 'back', .95, { w: 1.1, h: 1.1, mount: 1.0, curtains: pick(c, ['#f6c945', '#ee7fa6', '#5fae4a']) });
    const ns = P(c, 'side_table', { at: [-.35, R.zb + .3], key: 'nightstand' });
    P(c, 'desk_lamp', { on: ns, at: [-.42, R.zb + .25], ry: .5, color: '#f6c945', lit: night || chance(c, .5) });
    P(c, 'book', { on: ns, at: [-.25, R.zb + .35], ry: .3 });
    const theme = c.o.theme || pick(c, ['space', 'dino']);
    poster(c, 'back', -1.45, { y: 1.75, design: theme === 'space' ? POSTERS[5] : POSTERS[6] });
    poster(c, 'right', R.zb + 2.2, { y: 1.7, design: theme === 'space' ? POSTERS[0] : POSTERS[3] });
    stringLights(c, [-2.6, 2.35, R.zb + .03], [-.2, 2.35, R.zb + .03], { n: 12, sag: .3 });
    mobile(c, -1.4, R.zb + 1.3, R.h);
    // desk corner (right wall) + wardrobe + bookshelf
    const desk = W(c, 'school_desk', 'right', R.zb + 1.0, .33, { key: 'desk' });
    if (desk) { P(c, 'desk_lamp', { on: desk, at: [R.x1 - .25, R.zb + .8], ry: -1.8, lit: !night, light: false }); P(c, 'notebook', { on: desk, at: [R.x1 - .35, R.zb + 1.05], ry: -1.3, open: true }); P(c, 'pen', { on: desk, at: [R.x1 - .3, R.zb + 1.25], ry: .4 }); }
    W(c, 'school_chair', 'right', R.zb + 1.0, .75, { turn: PI });
    W(c, 'wardrobe', 'left', R.zb + 2.5, .33, { key: 'wardrobe', color: '#f1ebde' });
    W(c, 'bookshelf', 'front', -1.9, .17, { w: .8, h: 1.4 });
    W(c, 'wall_clock', 'right', R.zb + 2.2, 0, { mount: 2.25 });
    // floor: rug + toys
    P(c, 'rug', { at: [.4, -.4], shape: 'round', w: 1.9, color: pick(c, ['#3f6f8a', '#7a4f8a', '#c9893a']) });
    put(c, toyBlocks(c, 5), [.9, -.15], .4, 'blocks');
    P(c, 'robot_small', { at: [1.5, R.zb + 1.9], ry: -.7, scale: .6, mood: 'happy', key: 'robot' });
    P(c, 'cardboard_box', { at: [R.x1 - .45, R.zb + 1.9], open: true, text: 'TOYS', ry: -.2 });
    if (chance(c, .8)) P(c, 'gift_box', { at: [-.1, .7], ry: .5, scale: .8 });
    if (chance(c, .6)) P(c, 'balloon', { at: [-2.4, R.zb + .3], len: 1.4, color: '#ee7fa6' });
    P(c, 'potted_plant', { at: [2.45, R.zb + .3], kind: 'leafy', sway: .02 });
    // the ceiling: a lamp, and glow stars at night
    if (night) { const sg = new THREE.Group(); sg.name = 'glow stars'; const sm = glowM('#d8ff9a', 1.4); for (let i = 0; i < 26; i++) { const s = deco(mesh(sg, sph(6, 4), sm, [rr(c, -2.6, 2.6), R.h - .01, rr(c, -2.4, 2.4)], null, [.04, .005, .04])); s.rotation.y = c.R(); } c.S.scene.add(sg); fx(c, 'dust', { at: [-1.4, 1.2, -1.5], area: [2, 1.6, 1.6], count: 30, intensity: .5 }); }
    else fx(c, 'godrays', { at: [.95, 1.55, R.zb + .05], size: [1.0, .9], dir: [-.2, -.6, 1], length: 3, count: 3, intensity: .55, dust: 50 });
    P(c, 'pendant_lamp', { at: [.4, -.4], ceiling: R.h, drop: .45, color: '#f6c945', lit: !night || chance(c, .3) });
    spot(c, 'center', .3, -.2, 0); spot(c, 'bed', -1.0, R.zb + 1.6, PI / 2); spot(c, 'desk', R.x1 - .85, R.zb + 1.0, -PI / 2); spot(c, 'window', .95, R.zb + .7, PI); spot(c, 'toys', .9, .25, -.4);
    cam(c, 'wide', [-.4, 1.15, -1.1], 4.2, 18, 8, 50, { spot: 'center' });
    cam(c, 'bed', [-1.2, 1.0, R.zb + 1.2], 2.6, 30, 8, 45, { seat: 'bed' });
    cam(c, 'desk', [R.x1 - .7, 1.2, R.zb + 1.0], 2.6, -60, 8, 45, { spot: 'desk' });
    cam(c, 'center', [.3, 1.25, -.2], 3.0, 8, 6, 40, { spot: 'center' });
  });

// ---------------------------------------------------------------- home office / computer desk
def('home-office', ['computer-desk', 'study', 'den'], ['home', 'interior', 'office'], 'a home office: a desk facing the room with a computer (90s: beige PC, dial-up modem, phone line), chair, shelves, window, cork board',
  "era 90s | 80s (beige PC, modem, floppies, rotary phone) | modern (monitor + laptop); mood day | night (screen glow) | warm; wall",
  c => {
    const retro = c.era === '90s' || c.era === '80s', night = c.mood === 'night';
    room(c, { w: 5.2, h: 2.7, back: -2.4, front: 3.2, wall: c.o.wall || (retro ? '#e6d3a8' : '#cfd8dc'), wallKind: retro ? 'motif' : 'plaster', wallOpt: { n: 5 }, floorKind: retro ? 'carpet' : 'wood', floor: c.o.floor || (retro ? '#6a7a8a' : '#a8703f'), floorOpt: { n: 3 } });
    lightIn(c); const R = c.room;
    const desk = P(c, 'desk', { at: [0, -.9], ry: PI, key: 'desk' }); c.tops.desk = desk;
    const ch = P(c, 'office_chair', { at: [0, -1.55], ry: 0, color: pick(c, ['#e2432f', '#3f6fd1', '#2f3036']), key: 'chair' });
    seat(c, 'chair', ch, 0, -1.6, 0, .5);
    // the computer sits off-centre and turned to the chair: the front camera sees the face beside it, the screen's back in front
    if (retro) { P(c, 'retro_computer', { on: desk, at: [.33, -.86], ry: PI - .35, key: 'computer', lines: ['C:\\> DIAL 555-0199', 'CONNECTING...', '56K  ####____', 'WELCOME TO NETZONE'] });
      put(c, modem(c), [.58, .75, -.66], PI - .3, 'modem');
      P(c, c.era === '80s' ? 'rotary_phone' : 'brick_phone', { on: desk, at: [-.45, -.72], ry: PI + .4, key: 'phone' });
      for (let i = 0; i < 3; i++) P(c, 'floppy_disk', { on: desk, at: [-.1 + i * .04, -1.08], y: i * .004, ry: PI + i * .3 });
      // the phone line: modem -> down the desk -> along the floor -> the wall jack
      const cg = new THREE.Group(); tube(cg, [[.58, .76, -.6], [.66, .7, -.6], [.7, .3, -.62], [.75, .015, -.85], [1.6, .015, -1.5], [R.x1 - .05, .015, -1.7], [R.x1 - .02, .3, -1.72]], .008, M('#e9e4d6'), 64); mesh(cg, rbox(.04, .08, .1, .01), M('#e9e4d6'), [R.x1 - .02, .32, -1.72]); ink(cg, .003); c.S.scene.add(cg);
    } else { put(c, monitor(c, CODE), [.35, .75, -.72], PI - .35, 'monitor'); P(c, 'laptop', { on: desk, at: [-.3, -1.0], ry: PI + .3, app: 'chart', key: 'laptop' }); P(c, 'smartphone', { on: desk, at: [.05, -1.12], ry: PI, flat: true, app: 'notify', key: 'phone' }); }
    const lampP = P(c, 'desk_lamp', { on: desk, at: [-.55, -.7], ry: PI - .6, lit: true, key: 'lamp' }); void lampP;
    const mug = P(c, 'mug', { on: desk, at: [-.15, -.78], fill: 'coffee', key: 'mug' });
    if (mug) fx(c, 'steam', { at: [-.15, .87, -.78], count: 3, height: .3 });
    P(c, 'sticky_note', { on: desk, at: [.2, -1.12], ry: .2, text: 'PAY BILL?' });
    P(c, 'paper_stack', { on: desk, at: [-.45, -1.05], ry: PI + .1, count: 12 });
    // behind the chair: the back wall (what the front camera sees)
    W(c, 'bookshelf', 'back', -1.6, .18, { key: 'bookshelf' });
    win(c, 'back', .45, { w: 1.1, h: 1.1, mount: 1.05, blinds: !retro || chance(c, .5), curtains: retro ? '#8a5a8a' : false });
    const sh = wallShelf(c, 'back', -.55, 1.95, .8); clutter(c, ['book_stack', 'jar', 'trophy', 'potted_plant'], sh, [-.85, R.zb + .1, -.25, R.zb + .15], 3, { small: true, scale: .8 });
    const cb = corkBoard(c, .9, .65); placeOnWall(c, cb, 'back', 1.7, 1.55, 'board');
    if (retro) poster(c, 'back', -.5, { y: 1.4, w: .4, h: .55, design: POSTERS[2] }); else P(c, 'picture_frame', { at: [-.5, 1.3, R.zb], w: .45, h: .32, art: 'abstract' });
    W(c, 'calendar', 'right', R.zb + .9, 0, { mount: 1.5, text: 'MARCH' });
    W(c, 'filing_cabinet', 'right', R.zb + 1.7, .33, { turn: 0 });
    W(c, 'wall_clock', 'back', 1.7, 0, { mount: 2.3 });
    P(c, 'trash_can', { at: [.75, -1.4] });
    P(c, 'potted_plant', { at: [R.x0 + .35, R.zb + 1.2], kind: 'snake', sway: .015 });
    P(c, 'rug', { at: [0, -1.4], w: 2.2, d: 1.6, pattern: 'border' });
    // the front wall (seen over the shoulder): a door, a shelf of boxes
    W(c, 'door', 'front', -1.2, .002, { color: '#e9e1cf' }); W(c, 'shelf', 'front', 1.2, .18, { w: 1.0 });
    if (night) fx(c, 'dust', { at: [0, 1.2, -1.4], area: [1.6, 1.2, 1.2], count: 30, intensity: .5 });
    else fx(c, 'godrays', { at: [.45, 1.6, R.zb + .05], size: [1.0, .9], dir: [.2, -.55, 1], length: 3, count: 3, intensity: .5, dust: 40 });
    fluo(c, 0, .2, 1.0, .5, { ei: night ? .4 : 1.2 });
    spot(c, 'center', .9, .2, -.3); spot(c, 'desk', 0, -1.55, 0); spot(c, 'window', .45, R.zb + .6, PI); spot(c, 'board', 1.6, R.zb + .6, PI);
    cam(c, 'front', [-.05, 1.1, -1.55], 2.3, -8, 12, 40, { seat: 'chair' });
    cam(c, 'over', [.25, 1.05, -.85], 1.7, 215, 26, 50, { seat: 'chair', note: 'over the shoulder onto the screen' });
    cam(c, 'wide', [0, 1.15, -1.3], 4.0, 24, 10, 50, { spot: 'center' });
    cam(c, 'screen', [.3, 1.0, -.8], .7, 165, 6, 40, { seat: 'chair' });
  });

// ---------------------------------------------------------------- kitchen
def('kitchen', ['home-kitchen'], ['home', 'interior', 'kitchen'], 'a home kitchen: counter run with sink under the window, stove with a steaming kettle, fridge, wall cabinets, table with chairs under a pendant lamp, bills and clutter',
  "mood day | night (cool + one warm pendant: the stressed look) | warm | cold; era 80s | modern; wall, floor",
  c => {
    const night = c.mood === 'night';
    room(c, { w: 5.8, h: 2.7, back: -2.6, front: 3.2, wall: c.o.wall || pick(c, ['#e9dcc0', '#cfe0d8', '#f0d8c0']), wallKind: 'plaster', floorKind: 'lino', floor: c.o.floor || '#e9e4d8', floorOpt: { n: 4, c2: pick(c, ['#3f6f8a', '#b8453a', '#2f3036']) }, floorTile: 1.2 });
    lightIn(c); const R = c.room, zc = R.zb + .32;
    // the counter run along the back wall
    const fr = P(c, 'fridge', { at: [-2.4, R.zb + .4], key: 'fridge', color: c.era === '80s' ? '#e9c46a' : undefined });
    const k1 = P(c, 'kitchen_counter', { at: [-1.4, zc], w: 1.2, key: 'counter' });
    const sink = P(c, 'sink', { at: [-.33, zc], key: 'sink' });
    const k2 = P(c, 'kitchen_counter', { at: [.73, zc], w: 1.2, key: 'counter2' });
    const stove = P(c, 'stove', { at: [1.73, zc], key: 'stove', lit: night && chance(c, .5) });
    P(c, 'kitchen_counter', { at: [2.55, zc], w: .5 });
    const tiles = new THREE.Mesh(planeG(4.9, .55), TM(ptex('tiles', pick(c, ['#f4f1ea', '#cfe8e0', '#f6e0b0']), [4.9 / .3, .55 / .3], { n: 2 }), { rough: .4 })); tiles.position.set(.45, 1.2, R.zb + .004); tiles.receiveShadow = true; tiles.userData.noPick = true; c.S.scene.add(tiles);
    win(c, 'back', -.33, { w: 1.0, h: .85, mount: 1.25, blinds: true, curtains: false, key: 'window' });
    for (const x of [-1.4, .73]) W(c, 'wall_cabinet', 'back', x, 0, { w: 1.1, mount: 1.6 });
    const hood = new THREE.Group(); mesh(hood, rbox(.8, .3, .5, .04), M('#b4bcc6', { rough: .35, metal: .4 }), [0, 0, 0]); mesh(hood, rbox(.25, .5, .25, .03), M('#b4bcc6', { rough: .35, metal: .4 }), [0, .38, -.1]); ink(hood, .005); put(c, hood, [1.73, 1.85, R.zb + .27], 0, 'hood');
    // on the counters
    P(c, 'kettle', { on: stove, at: [1.6, R.zb + .25], key: 'kettle' }); fx(c, 'steam', { at: [1.68, 1.18, R.zb + .25], count: 3, height: .35 });
    P(c, 'pot', { on: stove, at: [1.88, R.zb + .45] });
    P(c, 'toaster', { on: k1, at: [-1.75, R.zb + .3], ry: .2 }); P(c, 'microwave', { on: k1, at: [-1.25, R.zb + .25], lit: night });
    P(c, 'cereal_box', { on: k2, at: [.35, R.zb + .3], ry: .3 }); P(c, 'jar', { on: k2, at: [.65, R.zb + .2], kind: 'cookies' }); P(c, 'bottle', { on: k2, at: [.9, R.zb + .3], kind: 'juice' });
    P(c, 'potted_plant', { on: sink, at: [-.6, R.zb + .12], kind: 'cactus', small: true, scale: .8 });
    if (c.era === '80s') P(c, 'radio', { on: k2, at: [1.05, R.zb + .25] }); else P(c, 'cookie_jar', { on: k2, at: [1.05, R.zb + .25] });
    // the table (midground) under the pendant lamp, with the story's clutter
    const tb = P(c, 'dining_table', { at: [.25, -.35], ry: PI / 2, key: 'table' }); c.tops.table = tb;
    const ch1 = P(c, 'chair', { at: [-.45, -.35], ry: PI / 2, cushion: '#e2432f' }), ch2 = P(c, 'chair', { at: [.95, -.35], ry: -PI / 2, cushion: '#e2432f' });
    seat(c, 'chair-left', ch1, -.45, -.35, PI / 2); seat(c, 'chair-right', ch2, .95, -.35, -PI / 2);
    P(c, 'chair', { at: [.25, .75], ry: PI });
    P(c, 'fruit_bowl', { on: tb, at: [.25, -.65] }); P(c, 'mug', { on: tb, at: [.1, -.05], fill: 'coffee' });
    P(c, 'envelope', { on: tb, at: [.4, -.15], ry: .3, text: 'FINAL NOTICE' }); P(c, 'envelope', { on: tb, at: [.45, -.25], ry: -.4, y: .004 });
    if (chance(c, .7)) P(c, 'pill_bottle', { on: tb, at: [.05, -.3], pills: 3 });
    P(c, 'smartphone', { on: tb, at: [.4, .1], flat: true, app: 'notify', key: 'phone' });
    P(c, 'pendant_lamp', { at: [.25, -.35], ceiling: R.h, drop: .75, color: c.o.lampColor || '#3f6f5a', lit: true, intensity: night ? 4.5 : 2.5, key: 'lamp', light: true });
    // side walls + front wall
    W(c, 'calendar', 'left', -.6, 0, { mount: 1.45 }); W(c, 'wall_clock', 'left', .5, 0, { mount: 2.1 });
    W(c, 'door', 'right', -.2, .002, { color: '#ffffff' }); W(c, 'light_switch', 'right', .45, 0);
    W(c, 'cabinet', 'front', -1.4, .27, { key: 'dresser' }); W(c, 'picture_frame', 'front', -1.4, 0, { mount: 1.5, art: 'sunset' }); W(c, 'radiator', 'front', 1.3, 0);
    if (night) fx(c, 'dust', { at: [.25, 1.2, -.35], area: [1.6, 1.4, 1.6], count: 35, intensity: .6 });
    else fx(c, 'godrays', { at: [-.33, 1.67, R.zb + .05], size: [.9, .75], dir: [.3, -.6, 1], length: 3, count: 3, intensity: .5, dust: 40 });
    spot(c, 'center', 1.3, .9, -.3); spot(c, 'table', .25, -1.5, 0); spot(c, 'sink', -.33, R.zb + 1.0, PI); spot(c, 'fridge', -2.0, R.zb + 1.3, PI * .85); spot(c, 'stove', 1.73, R.zb + 1.05, PI);
    cam(c, 'wide', [0, 1.2, -1.3], 4.4, 15, 9, 50, { spot: 'table' });
    cam(c, 'table', [.25, 1.25, -1.5], 2.6, 8, 6, 40, { spot: 'table' });
    cam(c, 'seated', [-.4, 1.0, -.35], 2.2, 70, 6, 40, { seat: 'chair-left' });
    spot(c, 'room', 1.3, .9, PI - .2);
    cam(c, 'counter', [1.3, 1.2, .9], 2.4, 172, 10, 50, { spot: 'room', note: 'from the counter side looking into the room' });
    void fr; void sink;
  });

// ---------------------------------------------------------------- classroom
def('classroom', ['school', 'school-room'], ['school', 'interior'], 'a classroom: chalkboard (or whiteboard), teacher desk + floor globe, rows of school desks, windows with blinds, posters, cubbies, a clock',
  "era modern (whiteboard) | 80s | 1919 (chalkboard, wood); mood day | warm | night | alarm; o.board text on the board",
  c => {
    const old = c.era === '1919' || c.era === '80s';
    room(c, { w: 8, h: 3.1, back: -3.6, front: 4.2, wall: c.o.wall || pick(c, ['#e6e0c8', '#d6e6d0', '#e8dcc8']), wallKind: 'block', wallTile: 1.6, floorKind: c.era === '1919' ? 'wood' : 'lino', floor: c.o.floor || (c.era === '1919' ? '#a46a3c' : '#c9b99a'), floorOpt: { n: 4, c2: '#b8a888' }, floorTile: 1.2, wainscot: { kind: 'block', color: c.o.wainscot || pick(c, ['#6f8f9a', '#9a7a5a', '#7a9a6a']), h: 1.0, tile: 1.6 }, ceilingKind: 'tiles' });
    lightIn(c, { shadowSize: 7 }); const R = c.room;
    const bd = W(c, old ? 'chalkboard' : 'whiteboard', 'back', -.2, 0, { scale: 1.4, text: c.o.board || (old ? 'TODAY: FRACTIONS\n1/2 + 1/4 = ?' : 'QUIZ FRIDAY!\n(NO, REALLY)'), key: 'board' });
    void bd; W(c, 'wall_clock', 'back', -.2, 0, { mount: 2.6, key: 'clock' });
    poster(c, 'back', -1.75, { y: 1.75, w: .55, h: .75, title: 'THE PLANETS', sub: 'ALL 8 OF THEM', bg: ['#1d2b58', '#3f6fd1'], fg: '#ffd166', art: 'planet' });
    poster(c, 'back', 1.35, { y: 1.65, w: .5, h: .66, title: 'READ MORE', sub: 'BOOKS ARE COOL', bg: ['#f6c945', '#f08a2a'], fg: '#2a1d17', art: 'stripes' });
    W(c, 'potted_plant', 'back', 2.0, .2, { kind: 'leafy', scale: 1.6, sway: .015 }); W(c, 'trash_can', 'back', 1.2, .2);
    bunting(c, [R.x0 + .1, 2.85, -2.6], [R.x1 - .1, 2.85, -2.6], { n: 16, sag: .25 }); bunting(c, [R.x0 + .1, 2.85, .4], [R.x1 - .1, 2.85, .4], { n: 16, sag: .25, colors: ['#3f6fd1', '#f6c945', '#e2432f'] });
    // teacher
    const td = P(c, 'desk', { at: [-2.2, R.zb + 1.3], ry: PI, key: 'teacherDesk' });
    if (td) { P(c, 'apple', { on: td, at: [-2.55, R.zb + 1.4] }); P(c, 'book_stack', { on: td, at: [-1.85, R.zb + 1.35], ry: .3 }); P(c, 'mug', { on: td, at: [-2.2, R.zb + 1.5], print: 'heart' }); }
    P(c, 'old-globe', { at: [-3.3, R.zb + .9], key: 'globe', spin: .2 });
    P(c, 'office_chair', { at: [-2.2, R.zb + .75], color: '#3f6f8a' });
    // the class: rows of desks facing the board
    const xs = [-2.5, -.85, .85, 2.5], zs = [-1.4, -.05, 1.3]; let k = 0;
    for (const z of zs) for (const x of xs) { k++; const dsk = P(c, 'school_desk', { at: [x, z], ry: PI }); const chr = P(c, 'school_chair', { at: [x, z + .5], ry: PI, color: pick(c, ['#e2432f', '#3f6fd1', '#5fae4a', '#f6c945']) });
      seat(c, 'desk' + k, chr, x, z + .5, PI); if (dsk && chance(c, .6)) P(c, pick(c, ['notebook', 'book', 'pen', 'apple']), { on: dsk, at: [x + rr(c, -.15, .15), z + rr(c, -.1, .1)], ry: rr(c, -1, 1) }); }
    // windows (right wall), shelves + cork board (left), cubbies + coats (front)
    for (const z of [-2.2, -.4, 1.4]) win(c, 'right', z, { w: 1.4, h: 1.4, mount: 1.0, blinds: true, curtains: false });
    for (const z of [-1.3, .5]) P(c, 'potted_plant', { at: [R.x1 - .15, 1.0, z], kind: pick(c, ['cactus', 'leafy']), small: true });
    W(c, 'bookshelf', 'left', -2.0, .18); W(c, 'bookshelf', 'left', -1.05, .18);
    placeOnWall(c, corkBoard(c, 1.4, .9), 'left', .8, 1.55, 'corkboard');
    W(c, 'door', 'left', 2.8, .002, { color: '#3f6f8a' });
    for (const x of [-2.6, -1.2, .2]) W(c, 'shelf', 'front', x, .18, { w: 1.3, h: 1.2 });
    for (const x of [1.5, 2.1, 2.7]) P(c, 'backpack', { at: [x, R.zf - .25], ry: PI, color: pick(c, ['#e2432f', '#3f6fd1', '#f6c945', '#5fae4a']) });
    poster(c, 'front', 2.1, { y: 1.75, design: POSTERS[6] });
    for (const z of [-2, 0, 2]) for (const x of [-1.6, 1.6]) fluo(c, x, z, 1.3, .35, { ei: c.mood === 'night' ? .5 : 1.5, flicker: x > 0 && z === 2 ? 3 : 0 });
    fx(c, 'godrays', { at: [R.x1 - .05, 1.7, -.4], size: [1.3, 1.2], dir: [-1, -.55, .3], length: 4, count: 3, intensity: c.view === 'day' ? .45 : .25, dust: 50 });
    if (c.mood === 'alarm') beacon(c, [-.2, 2.95, R.zb + .1]);
    spot(c, 'teacher', -.2, R.zb + .9, 0); spot(c, 'center', 0, .65, 0); spot(c, 'aisle', 0, .65, PI); spot(c, 'board', .9, R.zb + .7, -.5); spot(c, 'window', R.x1 - .6, -.4, -PI / 2);
    cam(c, 'board', [-.2, 1.45, R.zb + .85], 4.2, 0, 8, 50, { spot: 'teacher', note: 'from behind the rows (blurred desks in front)' });
    cam(c, 'class', [0, .9, .3], 3.8, 180, 14, 50, { spot: 'aisle', note: "the teacher's view of the rows" });
    cam(c, 'wide', [-.2, 1.3, -1.6], 5.2, 28, 12, 50, { spot: 'teacher' });
    cam(c, 'desk', [-.85, .95, .35], 2.2, 160, 10, 45, { seat: 'desk6' });
  });

// ---------------------------------------------------------------- lab
def('lab', ['laboratory', 'science-lab'], ['science', 'interior'], 'a science lab: a centre island with microscope and bubbling glowing flasks, bench run with shelves of bottles, fume hood, whiteboard of formulas, server rack, ceiling pipes',
  "era modern | 1919 (wood benches, brick, bare bulbs); mood day | night | alarm | cold; o.board text",
  c => {
    const old = c.era === '1919' || c.era === 'old';
    room(c, { w: 7, h: 3, back: -3, front: 3.6, wall: c.o.wall || (old ? '#a8583a' : '#e9eef0'), wallKind: old ? 'brick' : 'plaster', wallTile: old ? 1.0 : 1.4, floorKind: old ? 'planks' : 'lino', floor: c.o.floor || (old ? '#8a5a34' : '#bcc7cc'), floorOpt: { n: 3, c2: '#aab6bc' }, floorTile: 1.4,
      wainscot: old ? null : { kind: 'tiles', color: '#f4f8fa', h: 1.2, opt: { n: 4, grout: '#c9d4d8' }, tile: .8 } });
    lightIn(c); const R = c.room, bench = { color: old ? '#a46a3c' : '#e3e6ea', top: old ? '#5b3b25' : '#2a2c32' };
    const run = put(c, labBench(c, 3.4, .75, bench), [-1.4, R.zb + .38], 0, 'bench');
    if (!old) put(c, fumeHood(c, 1.4), [1.85, R.zb + .42], 0, 'hood'); else P(c, 'map-table', { at: [1.8, R.zb + .7], key: 'table' });
    const s1 = wallShelf(c, 'back', -1.4, 1.55, 3.2, { color: old ? '#6e4325' : '#cfd6de' }), s2 = wallShelf(c, 'back', -1.4, 2.0, 3.2, { color: old ? '#6e4325' : '#cfd6de' });
    for (const s of [s1, s2]) for (let i = 0; i < 9; i++) P(c, pick(c, ['bottle', 'jar', 'beaker', 'flask']), { on: s, at: [-2.9 + i * .36 + rr(c, -.05, .05), R.zb + .12], liquid: pick(c, ['#5aff8a', '#ff6ad0', '#ffd166', '#6ad8ff']), fill: .6, kind: pick(c, ['water', 'wine', 'juice']) });
    P(c, 'microscope', { on: run, at: [-2.6, R.zb + .4], ry: .3 }); P(c, 'test_tube_rack', { on: run, at: [-1.6, R.zb + .35] }); P(c, 'beaker', { on: run, at: [-1.1, R.zb + .4], liquid: '#5aff8a', glow: true }); if (old) P(c, 'typewriter', { on: run, at: [-.3, R.zb + .4] }); else P(c, 'laptop', { on: run, at: [-.35, R.zb + .4], app: 'chart' });
    // the island: the hero's workbench
    const isl = put(c, labBench(c, 2.2, .9, bench), [0, -.75], 0, 'island'); c.tops.island = isl;
    P(c, 'flask', { on: isl, at: [-.55, -.6], liquid: '#5aff8a', glow: true, bubbles: true, key: 'flask' });
    P(c, 'flask', { on: isl, at: [-.3, -.85], liquid: '#ff6ad0', glow: true, bubbles: true, scale: .8 });
    P(c, 'bunsen_burner', { on: isl, at: [.1, -.7] }); P(c, 'petri_dish', { on: isl, at: [.35, -.55], lid: true }); P(c, 'magnifying_glass', { on: isl, at: [.6, -.85], flat: true });
    P(c, 'clipboard', { on: isl, at: [.55, -.5], ry: .3, text: 'TEST #47' }); P(c, 'beaker', { on: isl, at: [-.8, -.95], liquid: '#6ad8ff', glow: true });
    lamp(c, [-.55, 1.05, -.45], '#7affb0', .45, 2.2);
    for (const x of [-.75, .75]) P(c, 'bar_stool', { at: [x, -.05], color: '#3f6fd1' });
    // walls: whiteboard of formulas (right), rack (left), warnings
    W(c, 'whiteboard', 'right', -.6, 0, { scale: 1.3, text: c.o.board || 'E = mc²?\nH2O + ??? = !!!\nDO NOT LICK', key: 'whiteboard' });
    if (!old) W(c, 'server_rack', 'left', -1.5, .42, { key: 'rack' }); else W(c, 'bookshelf', 'left', -1.5, .18);
    W(c, 'filing_cabinet', 'left', -.6, .33);
    const sign = board(c, ['DO NOT LICK', 'THE SAMPLES'], { w: .7, h: .32, bg: '#f6c945', border: '#2a1d17' }); placeOnWall(c, sign, 'back', 1.85, 2.6);
    P(c, 'gears', { at: [R.x0 + .05, 1.6, .8], ry: PI / 2, spin: .4 });
    W(c, 'cabinet', 'front', 1.5, .27, { color: '#cfd6de' }); W(c, 'door', 'front', -1.4, .002, { color: '#3f6f8a' });
    // the ceiling: pipes + lights
    const pg = new THREE.Group(); for (const [z, r, col] of [[-2.6, .06, '#b4bcc6'], [-2.35, .04, '#e2432f'], [-2.15, .05, '#3f6fd1']]) { tube(pg, [[R.x0, R.h - .2, z], [R.x1, R.h - .2, z]], r, M(col, { rough: .4, metal: .3 }), 8); }
    ink(pg, .006); c.S.scene.add(pg);
    if (old) { for (const x of [-1.5, 0, 1.5]) P(c, 'bulb', { at: [x, -.7], ceiling: R.h, drop: .9 }); } else for (const x of [-1.6, 0, 1.6]) fluo(c, x, -.6, 1.2, .3, { ei: c.mood === 'night' ? .5 : 1.5 });
    if (c.mood === 'alarm') beacon(c, [0, 2.85, R.zb + .1]);
    fx(c, 'dust', { at: [0, 1.4, -.6], area: [3, 1.6, 2], count: 40, intensity: .5 });
    spot(c, 'island', 0, -1.45, 0); spot(c, 'center', -.9, .7, .2); spot(c, 'hood', 1.85, R.zb + 1.2, PI); spot(c, 'board', R.x1 - .7, -.4, -PI / 2 + .4);
    cam(c, 'island', [0, 1.2, -1.4], 2.8, 8, 8, 40, { spot: 'island' });
    cam(c, 'wide', [-.2, 1.3, -1.5], 4.8, 22, 10, 50, { spot: 'island' });
    cam(c, 'flask', [-.55, 1.05, -.6], .9, 30, 10, 40, { spot: 'island', note: 'close on the glowing flask' });
    cam(c, 'board', [R.x1 - .5, 1.4, -.5], 2.8, -60, 6, 45, { spot: 'board' });
  });

// ---------------------------------------------------------------- office
def('office', ['open-office', 'cubicles', 'workplace'], ['office', 'interior'], 'an office floor: the hero cubicle facing the room (computer, papers, plant), neighbouring cubicles, windows onto the city, water cooler, printer, filing cabinets, flickering fluorescents',
  "era modern | 80s | 90s (beige computers); mood day | night (overtime) | warm | alarm; wall, carpet colour",
  c => {
    const retro = c.era === '80s' || c.era === '90s', night = c.mood === 'night';
    room(c, { w: 8, h: 2.9, back: -3.4, front: 4, wall: c.o.wall || pick(c, ['#d9d8d0', '#d6dce0', '#e3dccb']), wallKind: 'plaster', floorKind: 'carpet', floor: c.o.floor || pick(c, ['#56677a', '#6a5a7a', '#5a6a5a']), floorOpt: { n: 6 }, floorTile: 1.4, ceilingKind: 'tiles' });
    lightIn(c); const R = c.room, pc = col => pick(c, col);
    for (const x of [-2.4, 0, 2.4]) win(c, 'back', x, { w: 1.5, h: 1.5, mount: .9, blinds: true, curtains: false, view: night ? 'night' : c.view });
    // the hero cubicle (open toward the camera)
    const desk = P(c, 'desk', { at: [0, -1.25], ry: PI, key: 'desk' }); c.tops.desk = desk;
    put(c, partition(c, 2.2, 1.3), [0, -2.05], 0, 'partition');
    for (const s of [-1, 1]) put(c, partition(c, 1.5, 1.3), [s * 1.12, -1.3], PI / 2, null);
    const ch = P(c, 'office_chair', { at: [0, -1.85], color: '#2f3036', key: 'chair' }); seat(c, 'chair', ch, 0, -1.9, 0, .5);
    if (retro) P(c, 'retro_computer', { on: desk, at: [.33, -1.2], ry: PI - .35, key: 'computer' }); else { put(c, monitor(c, CHART), [.35, .75, -1.07], PI - .35, 'monitor'); P(c, 'laptop', { on: desk, at: [-.3, -1.3], ry: PI + .3, app: 'code' }); }
    P(c, 'paper_stack', { on: desk, at: [-.5, -1.05], count: 30, text: 'Q3 REPORT' }); P(c, 'mug', { on: desk, at: [-.05, -1.45], text: 'BOSS?' });
    P(c, 'potted_plant', { on: desk, at: [.58, -1.45], small: true, kind: 'snake' }); P(c, retro ? 'calculator' : 'smartphone', { on: desk, at: [.15, -1.5], flat: true });
    const sn = board(c, ['IN A MEETING', '(WITH MY BED)'], { w: .36, h: .2, bg: '#fff3a6' }); sn.position.set(-.6, 1.05, -2.0); c.S.scene.add(sn);
    // neighbours
    for (const s of [-1, 1]) { const x = s * 2.6, d2 = P(c, 'desk', { at: [x, -1.25], ry: PI }); put(c, partition(c, 2.0, 1.3), [x, -2.05], 0, null);
      P(c, retro ? 'retro_computer' : 'laptop', { on: d2, at: [x, -1.2], ry: PI, app: 'chart' }); P(c, 'office_chair', { at: [x, -1.8], ry: s * .4, color: pc(['#3f6fd1', '#e2432f', '#2f3036']) }); P(c, 'paper_stack', { on: d2, at: [x + .4, -1.3], count: 8 }); }
    // along the walls
    W(c, 'filing_cabinet', 'left', -.3, .33); W(c, 'filing_cabinet', 'left', .2, .33); put(c, printer(c), [R.x0 + .4, 1.1], PI / 2, 'printer');
    put(c, waterCooler(c), [R.x1 - .3, .9], -PI / 2, 'cooler'); fx(c, 'bubbles', { at: [R.x1 - .3, 1.15, .9], area: [.15, .3, .15], count: 5, rise: .25, size: .02 });
    W(c, 'whiteboard', 'right', 1.6, 0, { scale: 1.2, text: 'GOALS:\n1. COFFEE\n2. ???' });
    W(c, 'wall_clock', 'back', -1.2, 0, { mount: 2.6 }); W(c, 'wall_clock', 'back', 1.2, 0, { mount: 2.6, time: '5:00' });
    poster(c, 'left', 2.2, { y: 1.65, title: 'SYNERGY', sub: 'WHATEVER THAT IS', bg: ['#2f9c95', '#1d2b4f'], fg: '#ffffff', art: 'wave' });
    for (const [x, z] of [[R.x0 + .4, -2.9], [R.x1 - .4, -2.9]]) P(c, 'potted_plant', { at: [x, z], kind: 'leafy', scale: 1.8, sway: .02 });
    W(c, 'door', 'front', 2.3, .002, { color: '#8a5a3a' }); for (const x of [-2.6, -1.2]) put(c, partition(c, 1.3, 1.3), [x, R.zf - .4], 0, null, { parent: R.front });
    for (const z of [-1.8, .4, 2.6]) for (const x of [-2, 0, 2]) fluo(c, x, z, 1.2, .3, { ei: night ? (x === 0 && z === -1.8 ? 1.4 : .25) : 1.4, flicker: x === 2 && z === .4 ? 5 : 0 });
    if (c.mood === 'alarm') beacon(c, [0, 2.75, R.zb + .1]);
    fx(c, 'dust', { at: [0, 1.4, -1.2], area: [3, 1.6, 2], count: 30, intensity: .4 });
    spot(c, 'desk', 0, -1.85, 0); spot(c, 'center', 0, .2, 0); spot(c, 'cooler', R.x1 - .95, .75, -PI / 2 + .7); spot(c, 'window', 0, R.zb + .7, PI);
    cam(c, 'desk', [-.05, 1.05, -1.85], 2.4, -8, 12, 40, { seat: 'chair' });
    cam(c, 'wide', [0, 1.2, -1.3], 4.8, 18, 10, 50, { spot: 'center' });
    cam(c, 'cooler', [R.x1 - .9, 1.3, .9], 2.8, -40, 6, 45, { spot: 'cooler', note: 'the water-cooler chat (whiteboard behind)' });
    cam(c, 'aisle', [0, 1.3, -.5], 4.0, 0, 6, 50, { spot: 'center' });
  });

// ---------------------------------------------------------------- hospital room
def('hospital-room', ['hospital', 'ward', 'clinic'], ['medical', 'interior'], 'a hospital room: bed under a headwall with a live heart monitor, IV stand, privacy curtain on a rail, window with blinds, visitor chair, flowers and pills on a bedside table',
  "mood day | night (monitor glow) | cold | alarm; wall",
  c => {
    const night = c.mood === 'night';
    room(c, { w: 5.6, h: 2.8, back: -2.6, front: 3.2, wall: c.o.wall || pick(c, ['#d8ece4', '#e6e0d0', '#d6e2ee']), wallKind: 'plaster', floorKind: 'lino', floor: c.o.floor || '#d6d0c4', floorOpt: { n: 2, c2: '#c8c2b6' }, floorTile: 1.0,
      wainscot: { kind: 'plaster', color: c.o.wainscot || '#9fcabc', h: .9 }, ceilingKind: 'tiles' });
    lightIn(c); const R = c.room;
    const bed = P(c, 'hospital_bed', { at: [0, R.zb + 1.1], key: 'bed' }); seat(c, 'bed', bed, 0, R.zb + 1.3, 0, .56);
    // headwall: a panel with a glowing strip and outlets
    const hw = new THREE.Group(); mesh(hw, rbox(2.2, .3, .08, .03), M('#eef2f4', { rough: .5 }), [0, 0, 0]); deco(mesh(hw, rbox(2.0, .04, .02, .01), glowM('#f4fbff', 1.4), [0, -.12, .045]));
    for (let i = 0; i < 4; i++) mesh(hw, rbox(.09, .09, .02, .01), M(i % 2 ? '#3f9c95' : '#e2432f'), [-.8 + i * .5, .03, .045]); ink(hw, .005); put(c, hw, [0, 1.45, R.zb + .04], 0, 'headwall', { solid: false });
    const ecg = liveScreen(c, .46, .3, ECG, { name: 'heart monitor', bezel: '#3a3d45' }); const arm = new THREE.Group(); mesh(arm, rbox(.06, .06, .5, .02), M('#9aa3ad', { metal: .4 }), [0, -.2, -.25]); ecg.add(arm); ecg.position.set(.95, 1.75, R.zb + .5); ecg.rotation.y = -.35; c.S.add(ecg); c.props.monitor = ecg;
    P(c, 'iv_stand', { at: [-.8, R.zb + .75], key: 'iv' });
    const st = P(c, 'side_table', { at: [-1.05, R.zb + 1.55], ry: PI / 2, key: 'sideTable' });
    P(c, 'vase_flowers', { on: st, at: [-1.1, R.zb + 1.45], scale: .8 }); P(c, 'pill_bottle', { on: st, at: [-.95, R.zb + 1.68], pills: 2 }); P(c, 'glass', { on: st, at: [-1.0, R.zb + 1.35], fill: 'water' });
    P(c, 'balloon', { at: [-1.25, 1.0, R.zb + 1.75], len: 1.0, color: '#ee7fa6' });
    if (bed) P(c, 'clipboard', { at: [.0, .58, R.zb + 1.95], ry: .1, text: 'PATIENT: YOU' });
    const arm2 = P(c, 'armchair', { at: [1.85, R.zb + 2.3], ry: -.9, color: '#3f6f8a', key: 'chair' }); seat(c, 'visitor', arm2, 1.85, R.zb + 2.3, -.9);
    // curtain rail on the left, window (right wall), sink + mirror (front)
    put(c, curtainRail(c, 2.6, R.h, pick(c, ['#9fc4d8', '#c9b3d6', '#bfe0c8'])), [-1.85, R.zb + 1.6], PI / 2, 'curtain', { solid: false });
    win(c, 'right', R.zb + 1.2, { w: 1.3, h: 1.3, mount: .9, blinds: true, curtains: false });
    W(c, 'wall_clock', 'back', -1.4, 0, { mount: 2.2 });
    const hs = board(c, ['HANDS.', 'WASH. THEM.'], { w: .5, h: .32, bg: '#cfe8ff', border: '#3f6fd1' }); placeOnWall(c, hs, 'back', 1.75, 1.55);
    W(c, 'bathroom_sink', 'front', -1.6, .25); W(c, 'mirror', 'front', -1.6, 0); W(c, 'door', 'front', .8, .002, { color: '#cfe0e8' });
    W(c, 'first_aid_kit', 'left', R.zb + 2.9, .2, { y: .9 });
    for (const z of [-1.2, .8]) fluo(c, 0, z, 1.2, .5, { ei: night ? .25 : 1.4 });
    if (night) lamp(c, [.95, 1.6, R.zb + .7], '#7affb0', 1.2, 3);
    if (c.mood === 'alarm') beacon(c, [0, 2.65, R.zb + .1]);
    fx(c, 'dust', { at: [.5, 1.4, -1.2], area: [2.5, 1.5, 2], count: 30, intensity: .45 });
    spot(c, 'center', .4, .4, -.2); spot(c, 'doctor', .85, R.zb + 1.25, -PI / 2 + .5); spot(c, 'window', R.x1 - .7, R.zb + 1.2, -PI / 2); spot(c, 'bed', 0, R.zb + 1.35, 0);
    cam(c, 'bed', [0, 1.05, R.zb + 1.3], 3.0, 18, 12, 45, { seat: 'bed' });
    cam(c, 'wide', [.7, 1.2, R.zb + 1.5], 4.4, 14, 10, 50, { spot: 'doctor' });
    cam(c, 'monitor', [.95, 1.75, R.zb + .5], .8, -20, 4, 40, { spot: 'doctor', note: 'the heart monitor close' });
    cam(c, 'visitor', [1.75, 1.0, R.zb + 2.25], 2.4, -50, 6, 40, { seat: 'visitor' });
  });

// ---------------------------------------------------------------- diner / cafe
def('diner', ['cafe', 'restaurant', 'coffee-shop'], ['food', 'interior'], 'a retro diner: chequered floor, a teal counter with chrome stools, booths under the windows, neon name sign, menu board, pie display, jukebox, pendant lamps',
  "o.name (the neon name, invented), o.menu [lines]; era 50s look default | modern (cafe colours); mood day | night (neon + window night) | warm",
  c => {
    const night = c.mood === 'night', cafe = c.era === 'modern' && c.o.kind === 'cafe';
    const accent = c.o.accent || pick(c, ['#e2432f', '#2f9c95', '#3f6fd1']);
    room(c, { w: 7, h: 3, back: -3, front: 4, wall: c.o.wall || '#f3e6c8', wallKind: 'plaster', floorKind: 'lino', floor: '#f4f0e6', floorOpt: { n: 4, c2: '#2a2a30' }, floorTile: 1.0,
      wainscot: { kind: 'tiles', color: accent, h: 1.1, opt: { n: 4, c2: '#ffffff', grout: '#d8d0c0' }, tile: .6 }, trim: '#b4bcc6' });
    lightIn(c); const R = c.room;
    const ctr = put(c, counter(c, 4.2, .7, 1.05, { color: accent, top: '#e9e1cf', trim: '#d8dde3', name: 'diner counter' }), [.7, R.zb + 1.35], 0, 'counter'); c.tops.counter = ctr;
    for (let i = 0; i < 6; i++) { const x = -1.0 + i * .68, st = P(c, 'bar_stool', { at: [x, R.zb + 1.95], color: accent }); seat(c, 'stool' + (i + 1), st, x, R.zb + 1.95, PI, .78); }
    // on the counter
    P(c, 'cake', { on: ctr, at: [-.95, R.zb + 1.3], key: 'pie' }); const dome = new THREE.Mesh(sph(24, 12), new THREE.MeshStandardMaterial({ color: '#dff3ff', transparent: true, opacity: .25, roughness: .05 })); dome.scale.set(.2, .22, .2); dome.position.set(-.95, 1.08, R.zb + 1.3); dome.userData.noPick = true; c.S.scene.add(dome);
    clutter(c, ['mug', 'plate', 'glass', 'bottle'], ctr, [-.4, R.zb + 1.2, 2.6, R.zb + 1.5], many(c, 7), { fill: 'coffee', kind: 'soda' });
    P(c, 'cash_register', { on: ctr, at: [2.45, R.zb + 1.3], ry: .3, amount: 4.5 });
    // behind the counter: shelves, coffee machine, menu, the neon name
    const sh = wallShelf(c, 'back', -.6, 1.55, 1.8, { color: '#d8dde3' }); clutter(c, ['mug', 'plate', 'jar'], sh, [-1.4, R.zb + .1, .2, R.zb + .14], 6);
    const cm = new THREE.Group(); mesh(cm, rbox(.7, .55, .45, .04), M('#b4bcc6', { metal: .4, rough: .35 }), [0, .275, 0]); for (const x of [-.18, .18]) { mesh(cm, rcyl(.08, .07, .2, .02, 16), M('#2a1d17', { rough: .2 }), [x, .02, .1]); deco(mesh(cm, rbox(.05, .02, .01, .005), glowM('#ff4a3a', 1.5), [x, .45, .23])); } ink(cm, .005);
    put(c, cm, [1.1, .92, R.zb + .3], 0, 'coffeeMachine'); const lc = P(c, 'kitchen_counter', { at: [1.6, R.zb + .32], w: 2.6 }); void lc;
    const menu = board(c, c.o.menu || ['MENU', 'PIE  3.50', 'COFFEE  1.00', 'MYSTERY STEW  ?'], { w: 1.0, h: .75, bg: '#2a2a30', fg: '#ffffff', fg2: '#ffd166', edge: '#8a5a34', lh: .85 }); placeOnWall(c, menu, 'back', 1.95, 1.85, 'menu');
    const nm = neon(c, c.o.name || pick(c, ['MOONBEAM DINER', 'THE LUCKY FORK', 'ROUTE 9 EATS', 'PIE HOLE']), pick(c, ['#ff4a8a', '#5ad8ff', '#ffd166']), { w: 2.0, h: .46 }); placeOnWall(c, nm, 'back', .3, 2.5, 'sign');
    // booths along the left wall under windows
    for (const [z, k] of [[-1.5, 'a'], [1.1, 'b']]) {
      const b1 = put(c, booth(c, 1.3, accent), [-2.85, z - .62], 0, null), b2 = put(c, booth(c, 1.3, accent), [-2.85, z + .62], PI, null);
      const tb = put(c, counter(c, 1.2, .7, .75, { color: '#b4bcc6', top: '#e9e1cf', name: 'booth table' }), [-2.85, z], 0, 'booth-table-' + k);
      seat(c, 'booth-' + k, b1, -2.85, z - .65, 0, .54); seat(c, 'booth-' + k + '2', b2, -2.85, z + .65, PI, .54);
      P(c, pick(c, ['plate', 'mug', 'glass']), { on: tb, at: [-2.75, z - .1], fill: 'soda' }); P(c, 'bottle', { on: tb, at: [-3.15, z + .1], kind: 'soda', text: 'KETCHUP', scale: .7 });
      win(c, 'left', z, { w: 1.4, h: 1.1, mount: 1.15, curtains: false, view: night ? 'night' : c.view });
      void b1; void b2;
    }
    const op = neon(c, 'OPEN', '#ff4a3a', { w: .6, h: .25, board: false }); op.position.set(R.x0 + .06, 2.0, -.2); op.rotation.y = PI / 2; c.S.scene.add(op);
    put(c, jukebox(c), [R.x1 - .35, -.4], -PI / 2, 'jukebox');
    W(c, 'wall_clock', 'right', -1.6, 0, { mount: 2.3 }); poster(c, 'right', .9, { y: 1.75, title: 'TRY THE PIE', sub: 'SERIOUSLY', bg: ['#ffd166', '#f08a2a'], fg: '#8a2a2a', art: 'sun' });
    W(c, 'door', 'front', 1.6, .002, { color: accent }); poster(c, 'front', -1.2, { y: 1.7, design: POSTERS[1] }); P(c, 'potted_plant', { at: [-2.9, R.zf - .4], kind: 'leafy', scale: 1.6 });
    for (const x of [-.6, .7, 2.0]) P(c, 'pendant_lamp', { at: [x, R.zb + 1.35], ceiling: R.h, drop: .9, color: accent, lit: true, light: x === .7 ? true : undefined });
    fx(c, 'steam', { at: [.92, 1.2, R.zb + .4], count: 3, height: .4 });
    fx(c, 'dust', { at: [0, 1.4, -1], area: [3, 1.6, 2], count: 30, intensity: .45 });
    spot(c, 'cook', .7, R.zb + .75, 0); spot(c, 'center', .5, .6, 0); spot(c, 'door', 1.6, R.zf - .8, PI);
    cam(c, 'counter', [.6, 1.55, R.zb + .9], 4.0, 8, 8, 45, { spot: 'cook', note: 'over the counter at whoever works it' });
    cam(c, 'wide', [-.4, 1.15, -1.0], 5.0, 24, 10, 50, { spot: 'center' });
    cam(c, 'booth', [-2.85, 1.05, -2.1], 2.2, 15, 14, 45, { seat: 'booth-a' });
    cam(c, 'stools', [.4, 1.1, R.zb + 1.95], 2.6, 30, 6, 45, { seat: 'stool3' });
    void cafe;
  });

// ---------------------------------------------------------------- store / shop interior
def('store', ['shop', 'shop-interior', 'supermarket', 'corner-store'], ['shop', 'interior'], 'a corner store: an aisle of packed shelves leading to glowing drinks fridges, checkout counter with a cash register, hanging aisle signs, price signs, a claw machine',
  "o.name (invented, on the sign), mood day | night (fridges glow) | alarm; wall, floor",
  c => {
    const night = c.mood === 'night';
    room(c, { w: 7.6, h: 3.2, back: -4, front: 3.6, wall: c.o.wall || pick(c, ['#e9eef0', '#f3ead6', '#e2eedd']), wallKind: 'plaster', floorKind: 'lino', floor: c.o.floor || '#e6e6e0', floorOpt: { n: 4, c2: pick(c, ['#d0d4d8', '#e8c8b8', '#c8d8e8']) }, floorTile: 1.0, ceilingKind: 'tiles' });
    lightIn(c); const R = c.room;
    for (const x of [-2.4, -1.15, .1, 1.35]) put(c, fridgeCase(c, 1.2, { seed: c.seed * 7 + x * 3, text: pick(c, ['ICE COLD', 'FIZZ!', 'DRINKS']) }), [x, R.zb + .38], 0, x === .1 ? 'fridge' : null);
    P(c, 'vending_machine', { at: [2.8, R.zb + .5], key: 'vending' });
    lamp(c, [-.5, 1.5, R.zb + 1.0], '#dff6ff', 2.5, 5);
    // two aisle runs (shelves face the centre aisle and the side aisles)
    const runs = [];
    for (const s of [-1, 1]) for (const f of [-1, 1]) { const sh = goodsShelf(c, 2.8, 1.75, .45, { rows: 5, seed: c.seed * 11 + s * 3 + f }); runs.push(put(c, sh, [s * 1.25 + f * .23, -1.5], f > 0 ? PI / 2 : -PI / 2, null)); }
    for (const [x, label] of [[0, 'AISLE 3  SNACKS'], [-2.5, 'AISLE 2  ???'], [2.5, 'AISLE 4  SOUP']]) { const b = board(c, label, { w: 1.2, h: .28, bg: '#3f6fd1', fg: '#ffffff' }); b.position.set(x, 2.55, -1.2); b.rotation.y = 0; c.S.scene.add(b); tube(b, [[-.4, .15, .02], [-.4, .65, .02]], .006, M('#9aa3ad')); tube(b, [[.4, .15, .02], [.4, .65, .02]], .006, M('#9aa3ad')); }
    for (const [x, z, ry] of [[-.98, -1.0, PI / 2], [.98, -2.0, -PI / 2]]) { const p = board(c, ['SALE', '2 FOR 3'], { w: .3, h: .2, bg: '#e2432f', fg: '#ffffff' }); p.position.set(x, 1.15, z); p.rotation.y = ry; c.S.scene.add(p); }
    // checkout (front left)
    const co = put(c, counter(c, 1.8, .8, 1.0, { color: '#3f6fd1', top: '#e9e1cf', name: 'checkout' }), [-2.6, 1.3], PI / 2, 'checkout'); c.tops.checkout = co;
    P(c, 'cash_register', { on: co, at: [-2.65, .65], ry: PI / 2 + .5, amount: 12.99, key: 'register' });
    put(c, goodsShelf(c, .6, .6, .25, { rows: 3, name: 'candy rack', palette: ['#ee7fa6', '#f6c945', '#e2432f', '#7a4fc4'] }), [-2.35, 1.0, 1.95], PI / 2, null);
    W(c, 'shelf', 'left', 1.3, .18, { w: 1.0 }); poster(c, 'left', -.2, { y: 1.9, title: c.o.name || pick(c, ['PICK-N-GO', 'MOONLITE MART', 'PANTRY PLUS']), sub: 'OPEN LATE-ISH', bg: ['#e2432f', '#f6c945'], fg: '#ffffff', art: 'sun', w: .6, h: .8 });
    P(c, 'claw_machine', { at: [2.7, 1.6], ry: -PI / 2, key: 'claw' });
    for (let i = 0; i < 3; i++) P(c, 'crate', { at: [1.9, .2, 2.4], y: i * .36, kind: 'plastic', ry: i * .1 });
    W(c, 'cctv_camera', 'back', 3.4, 0, { h: 2.8, sweep: true });
    const sg = board(c, ['NO BIG BAGS', 'NO SMALL DOGS'], { w: .7, h: .32, bg: '#fff3a6' }); placeOnWall(c, sg, 'right', -.4, 1.6);
    W(c, 'door', 'front', 1.2, .002, { color: '#3f6fd1' }); W(c, 'window', 'front', -.6, 0, { view: c.view, w: 1.8, h: 1.4, mount: .8, curtains: false });
    for (const z of [-3, -1.5, 0, 1.5]) for (const x of [-1.25, 1.25]) fluo(c, x, z, 1.5, .25, { ei: night ? 1.0 : 1.5, flicker: x > 0 && z === 0 ? 4 : 0 });
    if (c.mood === 'alarm') beacon(c, [0, 3.0, R.zb + .1]);
    fx(c, 'dust', { at: [0, 1.4, -1.5], area: [1.6, 1.6, 3], count: 30, intensity: .45 });
    spot(c, 'aisle', 0, -.9, 0); spot(c, 'clerk', -3.1, 1.3, PI / 2); spot(c, 'customer', -2.0, 1.3, -PI / 2); spot(c, 'fridge', .1, R.zb + 1.2, PI); spot(c, 'center', .2, .9, 0);
    cam(c, 'aisle', [0, 1.3, -1.6], 4.6, 0, 6, 50, { spot: 'aisle', note: 'down the aisle to the glowing fridges' });
    cam(c, 'counter', [-2.75, 1.35, 1.25], 3.0, 75, 10, 45, { spot: 'clerk' });
    cam(c, 'wide', [-.2, 1.3, -1.0], 5.0, 22, 10, 50, { spot: 'center' });
    void runs;
  });

// =====================================================================================================================
// EXTERIORS
// =====================================================================================================================
const SHOP_NAMES = ['LUCKY SOCKS', 'BYTE BAKERY', 'NOODLE NOOK', 'GOOD PAWS', 'VINYL VAULT', 'DONUT WORRY', 'FIX-IT FRANK', 'MOON LAUNDRY', 'TOAST & CO', 'PIXEL PALACE', 'BEAN THERE', 'HAT TRICK'];
const PASTELS = ['#e9c46a', '#e8a07a', '#9fc4b8', '#b8c8e8', '#e6b8c8', '#d8d0b0', '#c4d8a0', '#f0d8a8'];

// ---------------------------------------------------------------- street
def('street', ['city-street', 'main-street', 'downtown'], ['city', 'exterior'], 'a street of invented shops seen down its length: road with parked cars and one driving by, sidewalks with lamps, hydrant, bus stop, crossing, traffic light, skyline beyond',
  "mood day | night (lit windows, neon, street lamps) | warm | storm (o.rain); o.names [shop names]; o.traffic false (no car driving by)",
  c => {
    const S = c.S, night = c.mood === 'night' || c.mood === 'storm', rw = 6, sw = 2.6, fx0 = rw / 2 + .22 + sw;
    outdoors(c, { shadowSize: 16, at: [-3, -6], fogNear: 35, fogFar: 160 });
    S.floor({ size: [260, 260], kind: 'asphalt', color: '#55575e', at: [0, -40] });
    P(c, 'road', { at: [0, -25], ry: PI / 2, length: 100, width: rw, sidewalk: sw, key: 'road' });
    P(c, 'crosswalk', { at: [0, -9], ry: PI / 2, width: rw, length: 2.6 });
    const names = c.o.names || [...SHOP_NAMES].sort(() => c.R() - .5);
    let k = 0;
    for (const side of [-1, 1]) for (let z = 7; z > -60; z -= 5.5) {
      if (z < -8 && z > -12) continue;    // the cross street
      const sh = P(c, 'shop', { at: [side * (fx0 + 2.5), z], ry: -side * PI / 2, text: names[k % names.length], floors: 1 + Math.floor(c.R() * 2.4), lit: night, color: pick(c, PASTELS), key: k === 0 ? 'shop' : k === 1 ? 'shop2' : undefined });
      if (sh && night && k % 3 === 1) { const n = neon(c, pick(c, ['OPEN', 'NOODLES', '24H', 'ARCADE', 'TACOS']), pick(c, ['#ff4a8a', '#5ad8ff', '#ffd166', '#8aff6a']), { w: 1.3, h: .45 }); n.position.set(side * (fx0 + .06), 4.4, z + 1.2); n.rotation.y = -side * PI / 2; S.scene.add(n); }
      k++;
    }
    // far end: taller blocks and a skyline
    for (const [x, z, f] of [[-14, -66, 6], [14, -70, 7], [-6, -80, 5], [8, -84, 6]]) P(c, 'apartment', { at: [x, z], floors: f, lit: night });
    P(c, 'skyscraper', { at: [-20, -110], lit: night }); P(c, 'skyscraper', { at: [22, -120], lit: night, height: 45 });
    skyline(c, -160, -90, 90, { h: 45 });
    // the sidewalks: lamps, hydrant, bins, bus stop, booth, trees, signs
    for (const side of [-1, 1]) for (let z = -1; z > -55; z -= 10) P(c, 'street-lamp', { at: [side * (rw / 2 + .55), z + (side > 0 ? 6 : 0)], ry: -side * PI / 2, kind: 'curved', lit: night, light: night ? undefined : false });
    P(c, 'hydrant', { at: [-(rw / 2 + .6), 1.2] }); P(c, 'street-bin', { at: [-(rw / 2 + .6), -3.2] }); P(c, 'mailbox', { at: [-(fx0 - .45), -1.0], ry: PI / 2, text: 'MAIL' });
    P(c, 'bus-stop', { at: [rw / 2 + 1.4, -3.5], ry: -PI / 2, key: 'busStop', lit: night }); P(c, 'phone-booth', { at: [-(rw / 2 + .9), -14], ry: PI / 2, lit: night });
    P(c, 'bicycle', { at: [-(rw / 2 + .5), -5.5], ry: .15 }); P(c, 'traffic-light', { at: [-(rw / 2 + .45), -7.6], ry: 0, state: 'red', key: 'trafficLight' }); P(c, 'traffic-light', { at: [rw / 2 + .45, -10.4], ry: PI, state: 'green' });
    P(c, 'road-sign', { at: [rw / 2 + .6, -7.7], kind: 'street', text: pick(c, ['MAPLE ST', 'ELM AVE', 'BAKER ST', '5TH AVE']), text2: 'NO HONKING (PLEASE)' });
    for (const z of [-17, -30]) P(c, 'tree', { at: [rw / 2 + 1.2, z], detail: .35, scale: .6 });
    P(c, 'traffic-cone', { at: [-1.2, -6] }); P(c, 'manhole', { at: [.8, -1.5] });
    // parked cars + one driving
    const cars = ['car', 'taxi', 'car', 'truck', 'car', 'police-car'];
    [[-1.55, -2.5, PI], [-1.55, -17, PI], [1.55, 3.5, 0], [1.55, -22, 0], [-1.55, -28, PI]].forEach(([x, z, ry], i) => P(c, cars[i % cars.length], { at: [x, z], ry, color: pick(c, ['#e2432f', '#3f6fd1', '#f6c945', '#5fae4a', '#e9e1cf', '#7a4fc4']), lit: night && i % 2 === 0, key: i === 0 ? 'car' : undefined }));
    if (c.o.traffic !== false) { const mv = P(c, 'car', { at: [1.5, -40], ry: PI, color: pick(c, ['#2f9c95', '#ee7fa6', '#f08a2a']), lit: night, light: false, key: 'movingCar' });
      if (mv) chain(mv, t => { const u = ((t * 6) % 90); mv.position.z = 15 - u; mv.visible = mv.position.z < 12; }); }
    if (c.o.rain || c.mood === 'storm') fx(c, 'rain', { at: [-2, 0, -2], area: [12, 9, 14], count: 900 });
    fx(c, 'dust', { at: [-3, 1.5, 0], area: [4, 2.5, 5], count: 30, intensity: .4 });
    spot(c, 'sidewalk', -(rw / 2 + 1.35), 1.5, 0); spot(c, 'shop', -(fx0 - .9), -4.5, -PI / 2 + .25); spot(c, 'crossing', -.8, -9, 0); spot(c, 'curb', rw / 2 + .7, -2.2, -PI / 2); spot(c, 'busStop', rw / 2 + 1.3, -3.0, -PI / 2 + .3);
    cam(c, 'street', [-(rw / 2 + 1.2), 1.45, 1.5], 4.6, 6, 5, 50, { spot: 'sidewalk', note: 'down the street (shops recede left, road right)' });
    cam(c, 'shop', [-(fx0 - .9), 1.6, -4.5], 3.6, 70, 6, 45, { spot: 'shop', note: 'from the road onto the shop fronts' });
    cam(c, 'crossing', [-.8, 1.4, -9], 4.2, 15, 6, 50, { spot: 'crossing' });
    cam(c, 'wide', [0, 2.6, -10], 16, 4, 14, 50, { spot: 'crossing', note: 'high, down the whole street' });
    cam(c, 'low', [-(rw / 2 + 1.2), 1.3, 1.5], 3.4, -12, -6, 60, { spot: 'sidewalk', note: 'knee-height arrival' });
    c.bounds = { x0: -fx0, x1: fx0, z0: -60, z1: 12 };
  });

// ---------------------------------------------------------------- old-town square
def('old-town', ['town-square', 'old-town-square', 'piazza', 'village-square'], ['town', 'exterior'], 'an old-town square: cobbles, pastel town houses with shutters and red roofs, a tall stone clock tower, a fountain, café tables under parasols, pigeons, bunting',
  "era modern | 1919 | medieval (timber frames, torches, no parasols); o.tower false; mood day | warm | night (string lights, lit windows) | storm",
  c => {
    const S = c.S, med = c.era === 'medieval', night = c.mood === 'night';
    outdoors(c, { shadowSize: 18, at: [0, -3], fogNear: 40, fogFar: 170 });
    terrain(c, { kind: 'cobble', color: c.o.ground || '#b8a890', size: [140, 140], amp: 0, tile: 2.2 });
    // the ring of houses: back row (z = -13) + the two sides
    const row = (x0, x1, place) => { let x = x0; while (x < x1) { const w = 4 + c.R() * 2.2, h = 8 + c.R() * 5; place(x + w / 2, w, h); x += w + .05; } };
    let n = 0;
    row(-16, 16, (x, w, h) => put(c, townhouse(c, w, h, 7, { kind: med ? 'timber' : 'plaster', color: pick(c, PASTELS), roof: pick(c, ['#a8503a', '#b8643f', '#8a4a3a', '#6a5a62']), shutter: pick(c, ['#3f7a5a', '#3f6f8a', '#8a3a3a']), floors: Math.max(2, Math.round(h / 3.2)), band: true, awning: n++ === 2 && !med ? '#e2432f' : null }), [x, -13], 0, n === 1 ? 'house' : null));
    for (const s of [-1, 1]) row(-11, 9, (z, w, h) => put(c, townhouse(c, w, h, 7, { kind: med ? 'timber' : 'plaster', color: pick(c, PASTELS), roof: pick(c, ['#a8503a', '#b8643f', '#8a4a3a']), shutter: pick(c, ['#3f7a5a', '#3f6f8a', '#8a3a3a']), floors: Math.max(2, Math.round(h / 3.2)), band: true, awning: s < 0 && z > -6 && z < -1 && !med ? '#2f9c95' : null }), [s * 12.5, -z], -s * PI / 2 + (s < 0 ? PI : 0) * 0, null));
    if (c.o.tower !== false) put(c, clockTower(c, 24, { color: '#c9b48a' }), [3.5, -19], 0, 'tower');
    put(c, fountain(c, 1.7), [0, -4], 0, 'fountain');
    // café corner (left)
    for (const [x, z, col] of [[-5.2, -1.2, '#e2432f'], [-6.8, -4.2, '#2f9c95'], [-4.6, -6.5, '#e2432f']]) { const cs = put(c, cafeSet(c, col), [x, z], c.R(), null); if (med) cs.children.filter(m => m.name === 'parasol').forEach(m => { m.visible = false; }); P(c, pick(c, ['mug', 'glass']), { at: [x + .1, .75, z], fill: 'coffee' }); }
    const cs0 = c.props; void cs0;
    seat(c, 'cafe', null, -5.75, -1.1, PI / 2, .45);
    // pigeons, lamps, benches, planters
    for (let i = 0; i < many(c, 7); i++) put(c, pigeon(c, i * 1.3), [1.2 + rr(c, -1.5, 2.2), rr(c, -.5, 2.5)], rr(c, -PI, PI), null, { solid: false });
    for (const [x, z] of [[-3, 2.5], [4.5, -7.5], [-8.5, -8.5]]) P(c, med ? 'wall-torch' : 'street-lamp', { at: [x, z], kind: 'classic', lit: night || c.mood === 'warm', light: night ? undefined : false });
    P(c, 'park-bench', { at: [4.6, -1], ry: -PI / 2 }); P(c, 'bicycle', { at: [6.2, -6.5], ry: .4 });
    for (const [x, z] of [[2.6, -9.2], [-2.6, -9.2]]) P(c, 'bush', { at: [x, z], flowers: '#ee7fa6', scale: .8 });
    if (night) { stringLights(c, [-12, 6.5, -9.5], [12, 6.5, -9.5], { n: 22, sag: 1.2, size: 2.2 }); stringLights(c, [-12, 6.2, -3], [3, 7.5, -12], { n: 16, sag: 1, size: 2.2 }); }
    else { bunting(c, [-12, 6.5, -9.5], [12, 6.5, -9.5], { n: 20, sag: 1.2, size: .45 }); bunting(c, [-12, 6.2, -3], [3, 7.5, -12], { n: 14, sag: 1, size: .45 }); }
    gulls(c, [2, 16, -14], 3, 8);
    fx(c, 'dust', { at: [0, 1.5, -1], area: [6, 3, 6], count: 30, intensity: .4 });
    spot(c, 'center', .6, 1.6, 0); spot(c, 'fountain', 1.2, -1.9, -.4); spot(c, 'cafe', -5.2, -.3, .3); spot(c, 'pigeons', 2.2, 1.0, -.6);
    cam(c, 'square', [.6, 1.6, 1.6], 5.0, 8, 6, 50, { spot: 'center', note: 'fountain + houses + the tower top behind' });
    cam(c, 'tower', [2.5, 9, -14], 26, 6, 2, 50, { spot: 'center', note: 'the whole square up to the tower' });
    cam(c, 'cafe', [-5.2, 1.3, -.3], 3.0, 35, 6, 45, { spot: 'cafe' });
    cam(c, 'fountain', [1.0, 1.5, -1.9], 3.6, -25, 8, 45, { spot: 'fountain' });
    cam(c, 'low', [.6, 2.2, 1.6], 4.6, 0, -10, 55, { spot: 'center', note: 'low angle looking up' });
  });

// ---------------------------------------------------------------- harbour / waterfront
def('harbour', ['harbor', 'waterfront', 'docks', 'port', 'quay'], ['water', 'exterior'], 'a working waterfront: a stone quay along the water with bollards, crates and barrels, rails, brick warehouses with painted names, a giant riveted storage tank, a moored steamer smoking, gulls',
  "era 1919 (default: steamer, cart, gas lamps, the tank) | modern (containers, motorboat); o.tank false; o.tankName; mood day | warm | night | storm",
  c => {
    const S = c.S, modern = c.era === 'modern', night = c.mood === 'night' || c.mood === 'storm';
    outdoors(c, { shadowSize: 20, at: [-1, -8], fogNear: 45, fogFar: 200, fogColor: c.mood === 'day' ? '#d6e6ee' : undefined });
    terrain(c, { kind: 'flags', color: c.o.ground || '#a89a88', size: [60, 220], at: [-27, -60], amp: 0, tile: 2.4 });
    // the quay edge + water
    const qe = new THREE.Group(); mesh(qe, rbox(1.2, 3, 200, .1), TM(ptex('ashlar', '#9a9488', [1, 60]), { rough: 1 }), [0, -1.5, 0]); mesh(qe, rbox(1.3, .2, 200, .08), M('#c4bca8', { rough: .9 }), [0, .02, 0]); ink(qe, .02); put(c, qe, [3.4, -60], 0, 'quay', { solid: false });
    fx(c, 'water', { at: [40, -.7, -60], size: [74, 220], waves: .07, color: c.o.water || '#2f6a82', shallow: '#4a9aa8', foam: .6 });
    // warehouses along the left, the tank at the end
    const wn = c.o.names || ['HALVORSEN & DAUGHTERS', 'PIER 9 STORES', 'BRIGHTWATER IMPORTS', 'ACME-ISH COFFEE'];
    [[8, 0], [-5, 1], [-18, 2], [-31, 3]].forEach(([z, i]) => put(c, warehouse(c, 12, 9 + (i % 2) * 3, 9, { name: wn[i % wn.length], floors: 2 + (i % 2) }), [-10.5, z], PI / 2, i === 0 ? 'warehouse' : null));
    if (c.o.tank !== false) put(c, storageTank(c, 8, 16, { name: c.o.tankName || (modern ? 'BAYSIDE FUEL' : 'KESTREL SYRUP CO.'), color: modern ? '#d8dde3' : '#8a8f96' }), [-7, -48], 0, 'tank');
    skyline(c, -150, -60, 40, { h: 22, colors: ['#b8a898', '#a8a0a0', '#c4b8a8'] }); hills(c, -170, -120, 120, { color: '#8aa07a', size: 18 });
    // across the water: a low far shore
    hills(c, -60, 60, 140, { color: '#8a9a7a', size: 10, depth: 4 }).rotation.y = 0;
    // rails, bollards, crates, barrels, lamps, the cart
    P(c, 'mine-rails', { at: [-3.6, -15], len: 60 });
    for (let z = 6; z > -44; z -= 4.5) put(c, bollard(c), [2.55, z], 0, null);
    const ship = modern ? P(c, 'sailboat', { at: [6.4, -.95, -12], ry: 0, key: 'boat' }) : put(c, steamer(c, { at: [7.3, -.2, -18], ry: PI / 2 }), [7.3, -.2, -18], PI / 2, 'ship', { solid: false });
    void ship;
    for (const [x, z, n2] of [[-1.2, -3.2, 3], [-2.2, -5.6, 2], [.4, -12, 4], [-6, -9, 3]]) for (let i = 0; i < n2; i++) P(c, 'crate', { at: [x + (i % 2) * .55, z + Math.floor(i / 2) * .45], y: (i >= 2 ? .36 : 0), ry: rr(c, -.2, .2), text: pick(c, ['FRAGILE', 'THIS WAY UP', 'SYRUP', 'NAILS']) });
    for (const [x, z] of [[-.5, -1.4], [-.05, -2.2], [-.85, -2.5]]) put(c, barrel(c), [x, z], c.R(), null);
    put(c, barrel(c, { lying: true }), [-1.4, -6.6], .4, null);
    if (modern) { put(c, container(c, '#c8443a', { text: 'BLUEFIN LINES' }), [-5.5, -24], PI / 2, null); put(c, container(c, '#3f6fd1'), [-5.5, -24 + 0], PI / 2, null, { y: 2.62 }); put(c, container(c, '#2f9c95'), [-1.5, -28], .05, null); }
    else put(c, cart(c), [-2.6, 2.2], -.5, 'cart');
    for (const z of [3, -9, -21, -33]) P(c, 'street-lamp', { at: [-4.8, z], kind: 'classic', lit: night, light: night ? undefined : false });
    P(c, 'anchor', { at: [-4.5, -1], ry: .6, scale: .7 }); P(c, 'life-ring', { at: [2.4, -7], ry: -PI / 2 });
    gulls(c, [8, 9, -8], 4, 7);
    fx(c, 'dust', { at: [-1, 1.5, 0], area: [5, 2.5, 5], count: 25, intensity: .35 });
    spot(c, 'quay', -.8, 2.6, 0); spot(c, 'edge', 1.9, -1.0, -PI / 2 + .2); spot(c, 'cart', -1.5, 3.4, -.6); spot(c, 'tank', -1.5, -36, 0);
    cam(c, 'quay', [-.8, 1.5, 2.6], 4.8, 10, 6, 50, { spot: 'quay', note: 'down the quay: warehouses left, water right, the tank at the end' });
    cam(c, 'tank', [-4, 7, -46], 26, 6, 3, 50, { spot: 'tank', note: 'the tank towering at the end of the quay' });
    cam(c, 'water', [2.3, 1.6, -1.6], 4.0, -70, 6, 45, { spot: 'edge', note: 'at the quay edge, the water and the ship behind' });
    cam(c, 'wide', [-1, 4, -14], 20, 15, 12, 50, { spot: 'quay' });
  }, { era: '1919' });

// ---------------------------------------------------------------- outback
def('outback', ['bush', 'australian-outback', 'red-centre'], ['nature', 'exterior'], 'the red outback: red dirt, spinifex, pale gum trees along a dry creek bed, termite mounds, a campfire with swags, camels, flat-topped mesas on the horizon under a huge sky',
  "mood day | warm (sunset) | night (fire-lit, stars); o.camels false (packs only); o.fire false",
  c => {
    const S = c.S, night = c.mood === 'night';
    outdoors(c, { shadowSize: 18, at: [0, -3], fogNear: 60, fogFar: 260, fogColor: c.mood === 'day' ? '#f0d8b8' : undefined, cloudCount: 7 });
    terrain(c, { kind: 'dirt', color: c.o.ground || '#c0603a', size: [260, 260], at: [0, -40], amp: 1.2, scale: .04, flat: 10, tile: 3 });
    mesas(c, -120, -160, 160, { color: '#b85a36', h: 14, w: 26 }); mesas(c, -190, -220, 220, { color: '#c8785a', h: 20, w: 40, gap: 34 });
    creekBed(c, [[-30, -26], [-12, -10], [-2, -5.5], [8, -7], [22, -16]], 3.2, '#e2c8a0');
    for (const [x, z, s] of [[-10, -12, 1.1], [4.5, -8.5, 1.3], [13, -15, 1], [-20, -20, 1.2], [-4.6, 2.6, .9]]) put(c, gumTree(c, s), [x, z], c.R() * TAU, x === 4.5 ? 'gumTree' : null);
    // spinifex, rocks, termite mounds, a dead log in the creek
    for (let i = 0; i < many(c, 26); i++) { const a = c.R() * TAU, r = 2.5 + c.R() * 16; P(c, 'grass', { at: [Math.cos(a) * r, -3 + Math.sin(a) * r * .8], dry: true, tall: c.R() < .4 ? 1.5 : 1, scale: 1.2 + c.R() * .8, shadow: false }); }
    for (const [x, z] of [[-1.6, 4.2], [2.4, 4.6], [-.9, -1.2], [1.1, -2.6], [3.5, -.8], [-2.2, .4]]) P(c, 'grass', { at: [x, z], dry: true, n: 9, spread: .6, scale: 1.6, shadow: false });
    for (let i = 0; i < 10; i++) P(c, 'rocks', { at: [rr(c, -4, 4), rr(c, -3, 5)], scale: .18 + c.R() * .2, color: '#9a5a3a', shadow: false });
    for (const [x, z] of [[-2.5, -4.5], [6, -5], [-7, -8]]) P(c, 'rocks', { at: [x, z], color: '#a8603a', scale: .8 + c.R() * .6 });
    const tm = M('#b8643a', { rough: 1 });
    for (const [x, z, h] of [[-6.5, -3, 1.9], [7.5, -2, 1.4], [-14, -16, 2.4]]) { const g = new THREE.Group(); g.name = 'termite mound'; mesh(g, rcyl(.25, .55, h, .2, 10), tm); mesh(g, rcyl(.15, .3, h * .6, .12, 8), tm, [.25, 0, .1]); mesh(g, sph(10, 8), tm, [0, h, 0], null, [.25, .3, .25]); ink(g, .01); put(c, g, [x, z], c.R() * TAU, null); }
    P(c, 'log', { at: [-1.2, -5.4], ry: .4, color: '#9a8a7a' });
    // the camp: fire, swags, packs, billy; camels resting behind
    if (c.o.fire !== false) { const cf = P(c, 'campfire', { at: [1.4, 1.6], lit: true, key: 'campfire' }); const fa = cf?.userData?.fireAt; fx(c, 'fire', { at: fa ? [1.4 + fa[0], fa[1], 1.6 + fa[2]] : [1.4, .1, 1.6], size: .55, intensity: night ? 1.4 : 1 }); fx(c, 'embers', { at: [1.4, .3, 1.6], count: 16 }); fx(c, 'smoke', { at: [1.4, .7, 1.6], size: .2, rate: 4, opacity: .5, wind: [.25, 0, 0] }); }
    P(c, 'log', { at: [2.6, 2.6], ry: 1.1 }); P(c, 'backpack', { at: [3.1, 1.3], ry: -.6, color: '#3f6f5a' }); P(c, 'beach-towel', { at: [-.6, 2.6], ry: .3, colors: ['#3f6f5a', '#c9893a'] }); P(c, 'camp-lantern', { at: [2.5, .9], lit: c.mood !== 'day' });
    if (c.o.camels !== false) { put(c, camel(c), [-3.4, -2.6], .9, 'camel'); put(c, camel(c, { sitting: true }), [-5.5, -4.4], .3, 'camel2'); }
    else for (const [x, z] of [[-3, -2], [-3.6, -2.4]]) P(c, 'backpack', { at: [x, z], scale: 1.4, color: '#8a3a2a' });
    fx(c, 'dust', { at: [0, 1, 0], area: [8, 2, 8], count: 40, intensity: .5, color: '#ffd8a8' });
    spot(c, 'camp', .5, 3.1, 0); spot(c, 'fire', 2.3, 1.9, -PI / 2 - .2); spot(c, 'creek', -2, -6.4, .2); spot(c, 'camel', -2.2, -1.6, -.4);
    seat(c, 'log', null, 2.6, 2.6, -2.0, .37);
    cam(c, 'camp', [.6, 1.25, 3.0], 4.6, 12, 5, 50, { spot: 'camp', note: 'the camp with the creek, gums and mesas behind' });
    cam(c, 'wide', [-.5, 1.6, -1], 14, 18, 9, 50, { spot: 'camp' });
    cam(c, 'camel', [-2.6, 1.5, -2.2], 3.6, 25, 5, 45, { spot: 'camel' });
    cam(c, 'low', [.6, 1.6, 3.0], 3.6, -6, -5, 55, { spot: 'camp', note: 'low: the sky' });
  });

// ---------------------------------------------------------------- beach / island
def('beach', ['island', 'seaside', 'tropical-beach'], ['nature', 'water', 'exterior'], 'a tropical beach: noisy sand sloping into a foam-lined sea, palms leaning over the frame, umbrella and towel, sandcastle, shells, a lifeguard tower, boats and a far island; o.kind "island" makes it a small island',
  "kind beach | island; mood day | warm (sunset) | night (moon, stars) | storm",
  c => {
    const S = c.S, isl = c.o.kind === 'island' || c.asked === 'island';
    outdoors(c, { shadowSize: 16, at: [0, -2], fogNear: 60, fogFar: 260, fogColor: c.mood === 'day' ? '#cfe8f4' : undefined, sun: [-.3, .25, -.9] });
    const hAt = isl ? (x, z) => { const d = Math.hypot(x, z + 2); return -1.4 + 1.5 * sstep(16, 7, d) + .15 * fbm2(x * .2, z * .2, 3) * sstep(14, 6, d); }
      : (x, z) => (z < -4 ? Math.max(-2.5, (z + 4) * .12) : .06 * fbm2(x * .25, z * .25, 3) * sstep(-3, 2, z) + (z > 6 ? (z - 6) * .12 + .5 * fbm2(x * .1, z * .1, 8) : 0));
    terrain(c, { kind: 'sand', color: c.o.sand || '#efd19a', size: [200, 200], at: [0, -20], seg: 160, height: hAt, tile: 2.2 });
    fx(c, 'water', { at: [0, -.12, isl ? -2 : -104], size: isl ? [300, 300] : [300, 200], waves: .05, color: '#1f8ccf', shallow: '#5cc9ec', foam: 1.2 });
    // palms framing the shot (one leans in from the left, canopy across the top)
    const pl = P(c, 'palm', { at: [-2.6, 4.6], ry: -.4, key: 'palm', scale: 1.05 }); if (pl) { pl.rotation.z = -.12; swayIt(pl, .02, 1, .4); }
    for (const [x, z, s] of [[3.6, -.5, .9], [-7, -1.5, 1.1], [8.5, 3, 1.0], [-12, 6, 1.2]]) { const p2 = P(c, 'palm', { at: [x, z], ry: c.R() * TAU, scale: s }); if (p2) swayIt(p2, .015, c.R() * 9, .35); }
    if (!isl) { P(c, 'beach-umbrella', { at: [1.7, -1.6], color: '#e2432f', key: 'umbrella' }); P(c, 'beach-towel', { at: [1.5, -.9], ry: .5, key: 'towel' }); P(c, 'lifeguard-tower', { at: [11, -2.5], ry: -.5, text: 'NO SHARKS (PROBABLY)' }); P(c, 'life-ring', { at: [5.5, -2.2], ry: -.4 }); }
    P(c, 'sandcastle', { at: [.9, -.2], key: 'sandcastle' });
    for (let i = 0; i < many(c, 7); i++) P(c, pick(c, ['shell', 'starfish', 'coconut']), { at: [rr(c, -3, 4), rr(c, -3.4, 1.5)], ry: c.R() * TAU, shadow: false });
    P(c, 'bush', { at: [-4.5, 2.5], scale: 1.2 }); P(c, 'grass', { at: [-3.4, 3.2], scale: 1.6 }); P(c, 'grass', { at: [4.6, 2.8], scale: 1.4 });
    P(c, 'sailboat', { at: [9, -.4, -34], ry: -.8, key: 'boat' }); P(c, 'rowboat', { at: [-14, -.35, -48], ry: .6 });
    // a far island with palms on the horizon
    const fi = new THREE.Group(); mesh(fi, sph(28, 12), M('#e6c88a', { rough: 1 }), [0, -3.5, 0], null, [16, 5, 9]); mesh(fi, sph(28, 12), M('#5fae4a', { rough: 1 }), [2, -1.2, -1], null, [10, 4, 6]); ink(fi, .1); fi.position.set(-38, 0, -120); S.scene.add(fi);
    if (!isl) hills(c, 70, -120, 120, { color: '#7fb05a', size: 14, sink: .4 });
    if (c.mood === 'night') P(c, 'moon', { at: [-10, 26, -120], size: 4, phase: 'full' }); else if (c.mood !== 'storm') P(c, 'sun', { at: [18, 30, -140], size: 5, shadow: false, light: false });
    gulls(c, [2, 10, -10], 3, 6);
    spot(c, 'sand', 0, .6, 0); spot(c, 'shore', -.5, -3.6, PI + .3); spot(c, 'umbrella', 2.0, -.1, -.3); spot(c, 'castle', .9, .5, PI);
    seat(c, 'towel', null, 1.5, -.9, .5, .05);
    cam(c, 'beach', [0, 1.35, .6], 4.6, 4, 4, 50, { spot: 'sand', note: 'the sea behind, horizon near the middle, a palm leaning into the top' });
    cam(c, 'shore', [-.5, 1.3, -3.6], 3.6, 160, 6, 45, { spot: 'shore', note: 'from the water back to the beach' });
    cam(c, 'wide', [0, 2, -2], 14, 12, 10, 50, { spot: 'sand' });
    cam(c, 'low', [0, 1.6, .6], 3.6, -8, -6, 55, { spot: 'sand' });
  });

// ---------------------------------------------------------------- forest / park
def('forest', ['park', 'woods', 'woodland', 'garden'], ['nature', 'exterior'], 'a forest clearing on a dirt path: trees in layers, ferns, mossy logs, mushrooms, rocks, light shafts through the canopy and falling leaves; o.kind "park": lawn, path, benches, lamps, pond, flower beds',
  "kind forest | park; mood day | warm | night | storm; o.season summer | autumn",
  c => {
    const S = c.S, park = c.o.kind === 'park' || c.asked === 'park' || c.asked === 'garden', autumn = c.o.season === 'autumn', night = c.mood === 'night';
    outdoors(c, { shadowSize: 18, at: [0, -4], fogNear: park ? 40 : 18, fogFar: park ? 170 : 75, fogColor: c.mood === 'day' ? (park ? '#d6ead8' : '#b8d4b0') : undefined });
    terrain(c, { kind: 'grass', color: c.o.ground || (autumn ? '#8aa04a' : '#6aa64a'), size: [180, 180], at: [0, -30], amp: park ? .3 : .8, scale: .06, flat: 6, tile: 2.6 });
    creekBed(c, [[.6, 12], [0, 3], [-.6, -4], [1.5, -12], [5, -24], [3, -40]], park ? 1.8 : 1.4, park ? '#d8c8a0' : '#b8946a');
    const leaves = autumn ? 'autumn' : 'leaf';
    if (park) {
      for (const [x, z, s] of [[-5.5, -6, 1.1], [6, -10, 1.2], [-9, -16, 1], [9, -20, 1.1], [-4, -24, .9]]) P(c, 'tree', { at: [x, z], scale: s, leaves, detail: .55, sway: .01 });
      P(c, 'park-bench', { at: [-1.9, -2.5], ry: PI / 2 * .7, key: 'bench' }); seat(c, 'bench', null, -1.9, -2.5, PI / 2 * .7, .48);
      P(c, 'street-lamp', { at: [1.6, -1], kind: 'classic', lit: night || c.mood === 'warm', light: night ? undefined : false }); P(c, 'street-bin', { at: [-1.6, -.6] });
      for (const [x, z] of [[3.5, -4], [4.6, -5.2], [-3.4, 1.8]]) P(c, 'flowers', { at: [x, z], color: pick(c, ['#e2432f', '#f6c945', '#ee7fa6', '#7a4fc4']), n: 9 });
      P(c, 'hedge', { at: [-6, -9], length: 4 }); P(c, 'hedge', { at: [6.5, -13], length: 4, ry: .3 });
      fx(c, 'water', { at: [5.5, .02, -8.5], size: [6, 4], waves: .02, color: '#3f8ab0', shallow: '#6ac0d8', foam: .3 }); for (const [x, z] of [[3, -7], [8, -9.5]]) P(c, 'reeds', { at: [x, z] });
      const sign = board(c, ['PLEASE DO NOT', 'FEED THE BENCH'], { w: .7, h: .36, bg: '#3f6f5a', fg: '#ffffff' }); const post = new THREE.Group(); mesh(post, rbox(.08, 1.2, .08, .02), M('#6b4a2f'), [0, .6, 0]); sign.position.set(0, 1.15, .04); post.add(sign); put(c, post, [-2.9, -3.6], .5, 'sign');
      P(c, 'bicycle', { at: [2.4, -2.6], ry: -.5 });
      treeLine(c, -40, -60, 60, { size: 2.2 });
    } else {
      // layers of trees: near (frame edges), mid, far line
      for (const [x, z, s, kd] of [[-3.4, 3.5, 1.2, 'tree'], [3.6, 2.4, 1.1, 'pine'], [-5.5, -3, 1.3, 'pine'], [5.2, -5, 1.3, 'tree'], [-3, -10, 1.2, 'tree'], [3.8, -13, 1.4, 'pine'], [-7.5, -15, 1.3, 'tree'], [8, -9, 1.2, 'pine'], [0, -20, 1.4, 'tree'], [-12, -6, 1.3, 'pine'], [12, -2, 1.3, 'tree']])
        P(c, kd, { at: [x, z], scale: s, leaves, detail: Math.abs(z) < 6 ? .7 : .4, sway: .008 });
      for (let i = 0; i < many(c, 10); i++) P(c, 'bush', { at: [rr(c, -6, 6) + (c.R() < .5 ? -2 : 2), rr(c, -14, 3)], scale: .6 + c.R() * .5, berries: c.R() < .3 ? true : undefined });
      P(c, 'log', { at: [-1.9, -1.6], ry: .5, key: 'log' }); seat(c, 'log', null, -1.9, -1.6, .5 + PI / 2, .37);
      P(c, 'stump', { at: [2.0, -3.2] }); P(c, 'mushroom', { at: [-1.4, -1.0], n: 3 }); P(c, 'mushroom', { at: [2.4, -2.6], n: 2, color: '#e2432f' });
      P(c, 'rocks', { at: [1.8, .8], moss: true, scale: .7 }); P(c, 'boulder', { at: [-4, -6], moss: true });
      for (let i = 0; i < many(c, 6); i++) P(c, 'flowers', { at: [rr(c, -3, 3), rr(c, -6, 2)], color: pick(c, ['#f6c945', '#ffffff', '#ee7fa6']), n: 5, shadow: false });
      treeLine(c, -32, -50, 50, { size: 2.4, colors: ['#2f6a3a', '#3f7a3a', '#2a5a34'] }); treeLine(c, -46, -60, 60, { size: 3, colors: ['#4a7a5a', '#5a8a6a'] });
      fx(c, 'godrays', { at: [1, 7, -3], size: [3, 1.5], dir: [-.25, -1, .35], length: 9, count: 4, intensity: c.mood === 'day' ? .45 : .25, dust: 60 });
    }
    fx(c, autumn ? 'leaves' : 'dust', autumn ? { at: [0, 0, -2], area: [8, 5, 8], count: 30 } : { at: [0, 1.4, -1], area: [6, 2.5, 6], count: 40, intensity: .5 });
    spot(c, 'path', -.1, 1.8, 0); spot(c, 'clearing', .3, -2.2, -.2); spot(c, 'deep', 1.2, -11, .3);
    cam(c, 'path', [-.1, 1.3, 1.8], 4.6, 6, 6, 50, { spot: 'path', note: 'the path winding away between layers of trees' });
    cam(c, 'clearing', [.3, 1.3, -2.2], 3.4, -20, 6, 45, { spot: 'clearing' });
    cam(c, 'wide', [0, 3, -6], 14, 10, 12, 50, { spot: 'path' });
    cam(c, 'low', [-.1, 1.8, 1.8], 4, 10, -12, 60, { spot: 'path', note: 'low: up into the canopy' });
  });

// ---------------------------------------------------------------- desert
def('desert', ['dunes', 'sahara', 'badlands', 'canyon'], ['nature', 'exterior'], 'a desert: rolling dunes with ripples, bleached bones and a skull, rocks, a lone sign, mesas on the hazy horizon, wind blowing sand; o.kind "cactus" for a cactus desert with buttes',
  "kind dunes | cactus; mood day | warm | night | storm (sandstorm haze); o.camel true",
  c => {
    const S = c.S, cac = c.o.kind === 'cactus' || c.asked === 'canyon' || c.asked === 'badlands';
    outdoors(c, { shadowSize: 18, at: [0, -3], fogNear: 50, fogFar: 230, fogColor: c.mood === 'day' ? '#f2dcb4' : undefined, sky: c.mood === 'day' ? ['#4a8ad0', '#f6e2c0'] : undefined, cloudCount: 4, sun: [.2, .5, -.85] });
    const sandC = c.o.sand || (cac ? '#d89a64' : '#e8c27a');
    terrain(c, { kind: 'sand', color: sandC, size: [240, 240], at: [0, -50], seg: 140, tile: 2.6, height: (x, z) => { const d = Math.hypot(x, z + 1), m = sstep(7, 18, d); return (cac ? .5 : 3.2) * (.5 + .5 * Math.sin(x * .08 + z * .05 + 2 * fbm2(x * .03, z * .03, 5))) * m + .5 * fbm2(x * .1, z * .1, 7) * m; } });
    if (!cac) { for (const [x, z, r, h] of [[-9, -12, 6, 2], [10, -16, 7, 2.4], [-2, -26, 9, 3], [18, -30, 8, 3]]) P(c, 'dune', { at: [x, z], r, h, ry: c.R() * PI, shadow: false }); }
    mesas(c, -140, -180, 180, { color: cac ? '#b85a36' : '#d09a6a', h: cac ? 22 : 12, w: cac ? 30 : 24 });
    if (cac) { for (const [x, z, k] of [[-1.7, -3.2, 'tall'], [2.2, -5.5, 'tall'], [-6, -10, 'barrel'], [1.6, -1.2, 'barrel'], [9, -12, 'tall'], [-11, -18, 'tall'], [-.6, -9, 'tall']]) P(c, 'cactus', { at: [x, z], kind: k, flower: c.R() < .4 }); }
    else P(c, 'cactus', { at: [5.5, -9], kind: 'barrel' });
    P(c, 'skull', { at: [1.3, .2], ry: -.5, scale: 1.4, key: 'skull' }); P(c, 'bones', { at: [1.8, -.4], ry: .3 }); P(c, 'rocks', { at: [-2.6, -1.8], color: '#b88a5a' }); P(c, 'boulder', { at: [3.4, -3.5], color: '#a87a4a', scale: 1.4 });
    P(c, 'dead-tree', { at: [-4.2, -5.5], ry: .8 });
    const sg = board(c, ['NEXT WATER', '200 KM'], { w: .8, h: .45, bg: '#d8b88a', fg: '#5a2a1a', edge: '#6b4a2f' }); const post = new THREE.Group(); mesh(post, rbox(.1, 1.5, .1, .02), M('#6b4a2f'), [0, .75, 0]); sg.position.set(0, 1.45, .06); sg.rotation.z = .08; post.add(sg); put(c, post, [-1.3, -.8], .35, 'sign');
    if (c.o.camel) put(c, camel(c), [-5, -3.5], 1.2, 'camel');
    fx(c, 'dust', { at: [0, .5, 0], area: [12, 1.2, 10], count: 70, intensity: .8, color: '#fff0d0', wind: [1.2, .05, .2], size: .02 });
    if (c.mood === 'storm') fx(c, 'fog', { at: [0, 0, -4], size: 40, height: 2.5, color: '#e8c8a0', opacity: .55 });
    spot(c, 'dunes', 0, 1.2, 0); spot(c, 'skull', .6, .5, -.8); spot(c, 'sign', -.7, -.1, .3);
    cam(c, 'dunes', [0, 1.35, 1.2], 4.6, 4, 4, 50, { spot: 'dunes' });
    cam(c, 'wide', [0, 3, -6], 16, 8, 8, 50, { spot: 'dunes' });
    cam(c, 'skull', [1.2, .35, .1], 1.2, 30, 10, 40, { spot: 'skull', note: 'the skull close, the walker behind' });
    cam(c, 'low', [0, 1.7, 1.2], 3.8, -10, -8, 55, { spot: 'dunes' });
  });

// ---------------------------------------------------------------- mountain / cliff edge
def('mountain', ['cliff', 'cliff-edge', 'summit', 'peak'], ['nature', 'exterior'], 'a rocky ledge at a cliff edge high above a valley: a sea of clouds below, snowy peaks beyond, pines, a warning sign; o.bridge adds a rope bridge out to a rock pillar',
  "mood day | warm | cold | night | storm; o.bridge true; o.flag true (a summit flag)",
  c => {
    const S = c.S, edge = -3.8;
    outdoors(c, { shadowSize: 14, at: [0, -1], fogNear: 80, fogFar: 460, fogColor: c.mood === 'day' ? '#cfe2f2' : undefined, cloudAt: [0, -14, -90], cloudArea: [260, 8, 120], cloudCount: 14, cloudSize: 12 });
    terrain(c, { kind: 'rock', color: c.o.rock || '#8a8a86', size: [240, 300], at: [0, -130], seg: 220, tile: 3,
      height: (x, z) => { const shelf = .12 * fbm2(x * .3, z * .3, 4) + (z > 6 ? (z - 6) * .25 : 0) + Math.max(0, Math.abs(x) - 6) * .35; const drop = sstep(edge, edge - 2.2, z + .6 * fbm2(x * .4, 0, 9)); return lerp(shelf, -70 + 20 * fbm2(x * .02, z * .02, 2), drop); } });
    for (let i = 0; i < 14; i++) P(c, 'grass', { at: [rr(c, -4, 5), rr(c, -1, 5)], scale: 1.3, shadow: false });
    for (const [x, z, s] of [[-3.8, -3.2, 1.0], [c.o.bridge ? 5.4 : 2.8, -3.4, .9], [-6.5, -2, 1.3], [5.8, -1.5, 1.2], [.5, -3.9, .6]]) P(c, 'boulder', { at: [x, z], scale: s, moss: c.R() < .4 });
    for (const [x, z, s] of [[-5.2, 1.5, 1.1], [4.8, 2.8, 1.2], [-7.5, 4.5, 1.4], [7, -.2, 1]]) P(c, 'pine', { at: [x, z], scale: s, sway: .01 });
    for (const [x, z, s, h] of [[-70, -170, 1.5, -60], [30, -200, 1.9, -60], [110, -165, 1.4, -60], [-20, -280, 2.6, -70]]) P(c, 'snowy-peak', { at: [x, h, z], scale: s, shadow: false });
    P(c, 'warning-sign', { at: [-1.6, -2.6], kind: 'board', text: 'MIND THE VIEW', ry: .3, key: 'sign' });
    for (let i = 0; i < many(c, 8); i++) P(c, 'grass', { at: [rr(c, -4, 5), rr(c, -2.5, 4)], scale: 1.1, shadow: false });
    P(c, 'flowers', { at: [2.2, .8], color: '#f6f0ff', n: 7 }); P(c, 'backpack', { at: [2.1, -.4], ry: -.8, key: 'backpack' });
    if (c.o.flag) P(c, 'space-flag', { at: [1.2, -2.6], colors: ['#e2432f', '#ffffff'], text: 'TOP', wind: true });
    if (c.o.bridge) { const br = P(c, 'rope-bridge', { at: [3.2, -.1, -9.5], ry: PI / 2, len: 11, key: 'bridge' }); const pil = new THREE.Group(); mesh(pil, rcyl(2.2, 3.4, 70, .6, 9), TM(ptex('rock', '#8a8a86', [3, 20]), { rough: 1 }), [0, -70, 0]); ink(pil, .04); put(c, pil, [3.2, -16.5], 0, 'pillar'); void br; spot(c, 'bridge', 3.2, -3.6, PI); }
    gulls(c, [6, -4, -18], 3, 10);
    fx(c, 'dust', { at: [0, 1.5, -1], area: [6, 2.5, 5], count: 25, intensity: .4 });
    spot(c, 'edge', 0, -2.5, 0); spot(c, 'view', 0, -2.9, PI); spot(c, 'ledge', 1.2, 1.5, -.3);
    cam(c, 'edge', [0, 1.4, -2.5], 4.6, 10, 5, 50, { spot: 'edge', note: 'the hero at the edge, cloud sea and peaks behind' });
    cam(c, 'view', [0, 1.2, -5.8], 5, 6, 4, 50, { spot: 'view', note: 'behind the hero looking out over the drop' });
    cam(c, 'down', [0, -3, -6], 12, 25, 35, 50, { spot: 'edge', note: 'high: the ledge, the drop and the cloud sea' });
    cam(c, 'wide', [0, 0, -4], 30, 25, 6, 50, { spot: 'edge', note: 'out over the drop' });
    cam(c, 'low', [0, 1.9, -2.5], 4, -8, -10, 55, { spot: 'edge' });
  });

// ---------------------------------------------------------------- cave
def('cave', ['cavern', 'grotto', 'mine'], ['nature', 'interior'], 'a cave: a rocky dome with stalactites and stalagmites, glowing crystal clusters, a still pool, a lantern camp with bones nearby, daylight spilling from the mouth behind; o.mine adds rails and a mine cart',
  "mood day (light from the mouth) | night | alarm; o.crystals colour; o.mine true",
  c => {
    const S = c.S;
    const dayM = c.mood !== 'night';
    S.light('night', { ki: dayM ? 1.3 : .8, key: dayM ? '#ffe6c0' : '#9ab0ff', kd: [-1, 5, -6], fill: '#7a8ad0', fi: .7, hi: .75, sky: '#8a90b8', gnd: '#3a2e2a', rim: dayM ? '#ffe0b0' : '#9fd8ff', ri: 1.4, shadowSize: 10 });
    S.fog('#2a2630', 10, 34); S.scene.background = new THREE.Color('#1a1820');
    caveShell(c, 11, { color: c.o.rock || '#6a5a52' });
    terrain(c, { kind: 'rock', color: '#5a4c44', size: [40, 40], at: [0, -2], amp: .35, scale: .25, flat: 5, tile: 2 });
    // the mouth: a bright opening at the back + light pouring in
    const mt = canvasTex(256, 256, (x, W) => { const gr = x.createLinearGradient(0, 0, 0, W); if (c.mood === 'night') { gr.addColorStop(0, '#1a2a6a'); gr.addColorStop(1, '#4a5aa0'); } else { gr.addColorStop(0, '#7ec4ef'); gr.addColorStop(.7, '#cfeaff'); gr.addColorStop(.72, '#7fb05a'); gr.addColorStop(1, '#5a9a4a'); } x.fillStyle = gr; x.fillRect(0, 0, W, W); });
    const mouth = new THREE.Mesh(memo('mouth', () => new THREE.CircleGeometry(2.4, 32)), new THREE.MeshBasicMaterial({ map: mt, fog: false })); mouth.position.set(1.5, 2.2, -9.4); mouth.scale.set(1.25, .9, 1); mouth.userData.noPick = true; S.scene.add(mouth);
    fx(c, 'godrays', { at: [1.5, 2.6, -9.2], size: [3.4, 2.4], dir: [-.1, -.35, 1], length: 9, count: 5, intensity: c.mood === 'night' ? .2 : .6, dust: 80, color: c.mood === 'night' ? '#9ab8ff' : '#fff0c8' });
    for (const [x, z, s] of [[-5.5, -4, 1.4], [5.8, -3, 1.2], [-4, -7, 1.6], [6.5, -7.5, 1.8], [-6.8, 1, 1.2], [6.8, 2.5, 1.1], [3.4, -6, .8]]) P(c, 'stalagmites', { at: [x, z], scale: s, color: '#8a7a6a' });
    for (const [x, z, s] of [[-2.5, -3, 1.2], [2.5, -1.5, 1.0], [0, -5.5, 1.4], [-4.5, .5, 1.1], [4.2, -4.6, 1.3]]) P(c, 'stalagmites', { at: [x, .62 * Math.sqrt(121 - x * x - z * z) * 1.08, z], hang: true, scale: s, color: '#8a7a6a' });
    const cc = c.o.crystals || '#7ae8ff';
    for (const [x, z, col, s] of [[-3.2, -2.2, cc, 1.2], [3.8, -2.4, '#c87aff', 1.3], [-5.2, -5.5, '#c87aff', 1.6], [4.6, .2, cc, .9]]) { const cr = crystals(c, col, 7, s); put(c, cr, [x, z], c.R() * TAU, x === -3.2 ? 'crystals' : null, { solid: false }); lamp(c, [x, .8, z], col, 1.6, 4.5); }
    fx(c, 'water', { at: [2.6, .04, -3.2], size: [3.4, 2.4], waves: .015, color: '#103a4a', shallow: '#2a8a9a', foam: 0 });
    for (const [x, z] of [[1, -3], [4.2, -3.5], [2.6, -4.6]]) P(c, 'rocks', { at: [x, z], scale: .5, color: '#6a5a52' });
    P(c, 'camp-lantern', { at: [-1.4, .9], lit: true, key: 'lantern', light: true }); P(c, 'backpack', { at: [-1.9, 1.3], ry: .6 }); P(c, 'bones', { at: [1.4, 1.2], ry: .4 }); P(c, 'skull', { at: [1.7, 1.0], ry: -.6 });
    if (c.o.mine || c.asked === 'mine') { P(c, 'mine-rails', { at: [-2.6, -3], len: 14 }); P(c, 'mine-cart', { at: [-2.6, -4.2], load: 'gold', key: 'cart' }); const sp = new THREE.Group(); for (const s of [-1, 1]) mesh(sp, rbox(.25, 3.2, .25, .04), M('#6b4a2f'), [s * 1.4, 1.6, 0]); mesh(sp, rbox(3.1, .3, .3, .05), M('#6b4a2f'), [0, 3.2, 0]); ink(sp, .01); put(c, sp, [-2.6, -6.5], 0, 'beams'); }
    if (c.mood === 'alarm') beacon(c, [-1.4, 2.2, -3]);
    fx(c, 'dust', { at: [0, 1.4, -1], area: [6, 2.5, 6], count: 40, intensity: .45 });
    spot(c, 'cave', 0, .8, 0); spot(c, 'pool', 1.2, -2.0, -.5); spot(c, 'crystals', -2.3, -1.2, .6); spot(c, 'mouth', 1.4, -6.5, PI);
    cam(c, 'cave', [0, 1.35, .8], 4.4, 6, 6, 50, { spot: 'cave', note: 'the hero, crystals and the bright mouth behind' });
    cam(c, 'crystals', [-2.6, 1.1, -1.6], 2.6, 40, 8, 45, { spot: 'crystals' });
    cam(c, 'mouth', [1.4, 1.6, -6.5], 3.6, 175, 8, 50, { spot: 'mouth', note: 'silhouette against the daylight' });
    cam(c, 'wide', [0, 1.2, -2], 7.5, 15, 10, 55, { spot: 'cave' });
    c.bounds = { x0: -8, x1: 8, z0: -9, z1: 8, h: 6 };
  });

// =====================================================================================================================
// TRANSPORT, SPACE, OCEAN, MUSEUM
// =====================================================================================================================
/** many small coloured parts merged into one mesh (one draw call): parts [{ geo, pos, rot, scl, color }] */
function mergeColored(parts) {
  const list = parts.map(p => { const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()); g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot || [0, 0, 0]))), new THREE.Vector3(...(p.scl || [1, 1, 1]))));
    g.clearGroups(); if (g.attributes.uv) g.deleteAttribute('uv'); const cc = new THREE.Color(p.color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; });
  const m = mergeGeometries(list, false); m.computeBoundingSphere(); return m;
}
const VC = new Map(); const vcM = (rough = .6) => { if (!VC.has(rough)) VC.set(rough, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough })); return VC.get(rough); };
/** an airliner seat block (n seats side by side), facing +z, merged */
function seatBlock(c, n = 3, col = '#2f4a7a') {
  const k = `seats${n}${col}`; const geo = memo(k, () => { const P2 = [], sw = .47, x0 = -(n - 1) * sw / 2;
    for (let i = 0; i < n; i++) { const x = x0 + i * sw; P2.push({ geo: rbox(.44, .13, .48, .05), pos: [x, .44, .02], color: col }, { geo: rbox(.44, .74, .13, .06), pos: [x, .84, -.22], rot: [-.13, 0, 0], color: col }, { geo: rbox(.32, .15, .03, .012), pos: [x, 1.1, -.135], rot: [-.13, 0, 0], color: '#f4f1ea' }); }
    for (let i = 0; i <= n; i++) P2.push({ geo: rbox(.05, .05, .42, .02), pos: [x0 - sw / 2 + i * sw, .6, .0], color: '#9aa3ad' });
    P2.push({ geo: rbox(n * sw, .06, .4, .02), pos: [0, .34, -.02], color: '#5a5e68' }, { geo: rbox(.06, .34, .06, .02), pos: [x0, .17, 0], color: '#5a5e68' }, { geo: rbox(.06, .34, .06, .02), pos: [-x0, .17, 0], color: '#5a5e68' });
    return mergeColored(P2); });
  const g = new THREE.Group(); g.name = 'seats'; const m = mesh(g, geo, vcM(.7)); void m; ink(g, .006); g.userData.seat = .5; return g;
}
const CLOUDVIEW = mood => { const t = canvasTex(256, 256, (x, W) => {
  const sky = mood === 'night' ? ['#0a1030', '#1d2b58'] : mood === 'warm' ? ['#7a6ac8', '#ffb07a'] : mood === 'storm' ? ['#5a6070', '#9aa0aa'] : ['#4a9be0', '#bfe3ff'];
  const gr = x.createLinearGradient(0, 0, 0, W); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); x.fillStyle = gr; x.fillRect(0, 0, W, W);
  const R = rnd(5); if (mood === 'night') { for (let i = 0; i < 60; i++) { x.fillStyle = '#ffffff'; x.fillRect(R() * W, R() * W * .7, 2, 2); } }
  x.fillStyle = mood === 'night' ? '#3a4470' : mood === 'warm' ? '#ffd8c8' : '#ffffff'; for (let i = 0; i < 9; i++) { const cx = R() * W, cy = W * (.55 + R() * .4); for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(cx + (k - 2) * 14, cy - (k % 2) * 10, 16 + R() * 8, 0, TAU); x.fill(); } } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

// ---------------------------------------------------------------- airplane cabin
def('airplane-cabin', ['airliner', 'plane-cabin', 'cabin', 'flight'], ['travel', 'interior'], 'an airliner cabin: rows of 3+3 seats down a patterned aisle, oval windows with clouds sliding past, overhead bins, light strips, glowing exit signs, the galley curtain at the end',
  "mood day | night | warm | storm (turbulence) | alarm (oxygen masks down, red light); seat colour o.seats",
  c => {
    const S = c.S, R0 = 2.0, cy = 1.05, z0 = -12, z1 = 9, L = z1 - z0, alarm = c.mood === 'alarm';
    lightIn(c, { rig: { kd: [1, 6, 3] } });
    const wallC = c.o.wall || '#ece8de', sm = TM(ptex('plaster', wallC, [6, L / 2]), { rough: .8, side: THREE.BackSide });
    const shell = new THREE.Mesh(memo('fus', () => { const g = new THREE.CylinderGeometry(R0, R0, L, 56, 1, true); g.rotateX(PI / 2); return g; }), sm); shell.position.set(0, cy, (z0 + z1) / 2); shell.receiveShadow = true; shell.userData.noPick = true; S.scene.add(shell);
    const fw = 2 * Math.sqrt(R0 * R0 - cy * cy);
    const fl = new THREE.Mesh(planeG(fw, L), TM(ptex('carpet', c.o.carpet || '#3a4a6a', [fw / .8, L / .8], { n: 3, c2: '#2a3654', c3: '#7a8ab0' }), { rough: 1 })); fl.rotation.x = -PI / 2; fl.position.set(0, 0, (z0 + z1) / 2); fl.receiveShadow = true; fl.userData.noPick = true; S.scene.add(fl);
    const aisle = new THREE.Mesh(planeG(.5, L), TM(ptex('carpet', '#7a2a3a', [1, L / .6], { n: 2, c2: '#5a1a2a', c3: '#e9b44c' }), { rough: 1, decal: true })); aisle.rotation.x = -PI / 2; aisle.position.set(0, .002, (z0 + z1) / 2); aisle.userData.noPick = true; S.scene.add(aisle);
    S.scene.background = new THREE.Color('#2a2622');
    // seats: 3 + 3 rows facing +z (the camera looks back down the aisle at the faces)
    const col = c.o.seats || pick(c, ['#2f4a7a', '#3f6f8a', '#8a2a3a', '#2f6a5a']); let row = 0;
    for (let z = 5; z > -10; z -= .86) { row++; for (const s of [-1, 1]) { const b = put(c, seatBlock(c, 3, col), [s * .97, z], 0, row === 2 && s < 0 ? 'seats' : null); void b; }
      for (const [k, x] of [['A', -1.44], ['B', -.97], ['C', -.5], ['D', .5], ['E', .97], ['F', 1.44]]) seat(c, `${row}${k}`, null, x, z, 0, .5); }
    // windows (clouds slide by), bins, light strips, service panels
    const view = CLOUDVIEW(c.mood), vm = new THREE.MeshBasicMaterial({ map: view, fog: false }), frameM = M('#f4f1ea', { rough: .5 }), shadeM = M('#d8d2c4', { rough: .7 });
    const wg = new THREE.Group(); wg.name = 'windows';
    const winGeo = memo('cabwin', () => { const sh = new THREE.Shape(); const w = .26, h = .36, r = .12; sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); const g = new THREE.ShapeGeometry(sh, 6); const P2 = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < P2.count; i++) uv.setXY(i, P2.getX(i) / w + .5, P2.getY(i) / h + .5); return g; });
    for (let z = 5.2; z > -10; z -= .86) for (const s of [-1, 1]) { const x = s * (Math.sqrt(R0 * R0 - .01) - .03), w = new THREE.Mesh(winGeo, vm); w.position.set(x, 1.15, z); w.rotation.y = -s * PI / 2; w.userData.noOutline = true; wg.add(w);
      const fr = new THREE.Mesh(memo('cabfr', () => { const g = new THREE.TorusGeometry(.17, .03, 8, 24); g.scale(1, 1.3, .5); return g; }), frameM); fr.position.set(x - s * .012, 1.15, z); fr.rotation.y = -s * PI / 2; wg.add(fr);
      if (c.R() < .3) { const sh = new THREE.Mesh(planeG(.27, .2), shadeM); sh.position.set(x - s * .02, 1.25, z); sh.rotation.y = -s * PI / 2; wg.add(sh); } }
    ink(wg, .004); S.scene.add(wg);
    view.userData.k = 0; wg.userData.update = t => { view.offset.x = -(t * .35) % 1; };
    const binM = TM(ptex('metal', '#f4f1ea', [L / 1.2, 1], { n: 1 }), { rough: .5 });
    for (const s of [-1, 1]) { const b = new THREE.Group(); mesh(b, rbox(.62, .42, L - 3.5, .06), binM, [0, 0, 0]); deco(mesh(b, rbox(.02, .3, L - 3.6, .01), M('#c8c4b8'), [-s * .3, -.02, 0])); b.position.set(s * 1.38, 1.98, (z0 + z1) / 2 - .4); b.rotation.z = s * .38; ink(b, .006); b.userData.solid = false; S.scene.add(b);
      deco(mesh(b, rbox(.04, .03, L - 3.6, .01), glowM('#fff4dc', 1.4), [-s * .22, -.24, 0])); }
    for (const s of [-1, 1]) deco(mesh(S.scene, rbox(.08, .03, L - 2, .01), glowM(alarm ? '#ff5a4a' : '#e6f2ff', 1.5), [s * .55, 2.86, (z0 + z1) / 2]));
    for (let z = 4.4; z > -10; z -= 2.58) for (const s of [-1, 1]) { const p = new THREE.Group(); mesh(p, rbox(.5, .05, .35, .015), M('#e8e4da'), [0, 0, 0]); deco(mesh(p, sph(8, 6), glowM('#fff4dc', c.mood === 'night' ? 2 : .2), [.12, -.03, 0], null, [.03, .01, .03])); deco(mesh(p, rbox(.1, .012, .05, .005), glowM(alarm ? '#ff4a3a' : '#f6c945', 1.6), [-.1, -.03, 0])); p.position.set(s * 1.0, 1.72, z); p.rotation.z = s * .38; ink(p, .003); S.scene.add(p); }
    // the ends: galley wall with lavatory doors + exits (far end); cockpit bulkhead (behind the camera)
    const back = new THREE.Group(); mesh(back, memo('bulk', () => new THREE.CircleGeometry(R0, 48)), M('#e3ddd0', { rough: .8 }), [0, cy, 0]);
    for (const x of [-.7, .7]) { mesh(back, rbox(.75, 1.9, .06, .04), M('#d0c8b8'), [x, .95, .03]); deco(mesh(back, rbox(.16, .1, .02, .01), glowM('#5aff6a', 1), [x, 1.75, .07])); }
    const exitS = board(c, 'EXIT', { w: .5, h: .2, bg: '#1a6a3a', fg: '#ffffff', glow: 1.2 }); exitS.position.set(0, 2.3, .05); back.add(exitS);
    const cur = curtainRail(c, 1.0, 2.4, '#3f4a6a'); cur.position.set(0, 0, .3); back.add(cur);
    back.position.set(0, 0, z0 + .05); ink(back, .006); back.userData.solid = false; S.scene.add(back);
    const front = new THREE.Group(); mesh(front, memo('bulk', () => new THREE.CircleGeometry(R0, 48)), M('#e3ddd0', { rough: .8 }), [0, cy, 0], [0, PI, 0]); front.position.set(0, 0, z1 - .05); S.scene.add(front);
    for (const s of [-1, 1]) { const e = board(c, 'EXIT', { w: .34, h: .13, bg: '#8a1a1a', fg: '#ffffff', glow: 1.3 }); e.position.set(s * 1.25, 2.25, -2.3); e.rotation.y = 0; S.scene.add(e); }
    if (alarm) { for (let z = 4.4; z > -6; z -= .86) for (const x of [-1.2, -.7, .7, 1.2]) { const mk = new THREE.Group(); tube(mk, [[0, 0, 0], [0, -.35, 0]], .004, M('#e9e4d6'), 4); mesh(mk, rcyl(.05, .04, .06, .01, 12), M('#f6c945'), [0, -.42, 0]); mk.position.set(x, 1.75, z + .3); S.scene.add(mk); swayIt(mk, .15, x * 3 + z, 2.2); } }
    spot(c, 'aisle', 0, -.9, 0); spot(c, 'galley', 0, -10.5, 0);
    cam(c, 'aisle', [0, 1.3, -1.6], 3.6, 0, 3, 55, { spot: 'aisle', note: 'down the aisle at the rows of faces' });
    cam(c, 'seat', [-1.3, 1.0, 3.3], 1.4, 80, 6, 50, { seat: '3A', note: 'a window seat from the aisle, between the rows' });
    cam(c, 'window', [-1.8, 1.15, 3.48], .8, 75, 2, 40, { seat: '3A' });
    cam(c, 'wide', [0, 1.5, -3], 4.6, 0, 6, 60, { spot: 'aisle' });
    c.bounds = { x0: -1.6, x1: 1.6, z0, z1, h: 2.85 }; S.bounds = c.bounds;
  });

// ---------------------------------------------------------------- hangar / airport
def('hangar', ['airport', 'aircraft-hangar', 'airfield'], ['travel', 'interior'], 'an aircraft hangar: corrugated walls, roof trusses, a propeller plane on the painted concrete, tools, ladders, drums; the great doors stand open onto the apron and sky; o.rig adds a big glass water-tank test rig',
  "mood day | warm | night (work lamps); o.rig true; o.plane false",
  c => {
    const S = c.S, night = c.mood === 'night';
    room(c, { w: 22, h: 10, back: -16, front: 6, wall: c.o.wall || '#9aa8b0', wallKind: 'corrugated', wallTile: 3, floorKind: 'asphalt', floor: '#b8b6ae', floorTile: 3, ceilingKind: 'corrugated', openBack: true, crown: false, skirting: false });
    lightIn(c, { shadowSize: 14, at: [0, -6] }); const R = c.room;
    S.sky(OUT[c.mood]?.sky || 'day'); S.scene.background = new THREE.Color('#9fc8e8');
    terrain(c, { kind: 'asphalt', color: '#7a7c80', size: [200, 180], at: [0, -106], amp: 0, tile: 3 });
    const lines = new THREE.Mesh(planeG(.3, 60), glowM('#f6c945', .15)); lines.rotation.x = -PI / 2; lines.position.set(0, .01, -30); lines.userData.noPick = true; S.scene.add(lines);
    for (let z = -2; z > -14; z -= 3) { const l = new THREE.Mesh(planeG(.25, 1.6), M('#f6c945')); l.rotation.x = -PI / 2; l.position.set(0, .012, z); l.userData.noPick = true; S.scene.add(l); }
    // the doorway: header + slid-open door panels
    const dg = new THREE.Group(); const dm = TM(ptex('corrugated', '#c4ccd2', [3, 3]), { rough: .7 });
    mesh(dg, rbox(22, 2.6, .5, .1), dm, [0, 8.7, 0]); for (const s of [-1, 1]) for (let i = 0; i < 2; i++) mesh(dg, rbox(3.2, 7.4, .3, .08), dm, [s * (9.3 - i * .4), 3.7, .35 + i * .35]);
    ink(dg, .03); dg.position.set(0, 0, R.zb); S.scene.add(dg);
    // roof trusses + hanging work lamps
    const tg = new THREE.Group(); const sm = M('#6a7480', { rough: .5, metal: .3 });
    for (let z = R.zb + 2; z < 6; z += 4) { mesh(tg, rbox(22, .35, .3, .05), sm, [0, 9.0, z]); for (let x = -9; x <= 9; x += 3) strut(tg, [x, 9, z], [x + 1.5, 9.8, z], .07, sm, 6); }
    ink(tg, .02); S.scene.add(tg);
    for (const [x, z] of [[-4, -8], [4, -8], [-4, -2], [4, -2]]) P(c, 'pendant_lamp', { at: [x, z], ceiling: 9.8, drop: 2.2, scale: 1.8, color: '#3f5a6a', lit: true, light: night || (x < 0 && z === -8) ? undefined : false });
    // the plane and the work around it
    if (c.o.plane !== false) P(c, 'plane', { at: [0, -7.5], ry: .25, scale: 1.25, color: pick(c, ['#e2432f', '#f6c945', '#3f6fd1', '#e9e1cf']), accent: '#2a1d17', key: 'plane', spin: 0 });
    P(c, 'ladder', { at: [3.2, -5.6], ry: -.6 }); P(c, 'toolbox', { at: [2.4, -3.4], ry: .3 }); P(c, 'traffic-cone', { at: [-3.5, -2.5] }); P(c, 'traffic-cone', { at: [4.8, -9.5] });
    for (const [x, z] of [[-9.6, -5], [-9.2, -4.2], [-9.8, -3.4]]) put(c, barrel(c, { color: pick(c, ['#c8443a', '#3f6fd1', '#5a7a4a']) }), [x, z], c.R(), null);
    const wb = put(c, counter(c, 3, .8, .95, { color: '#6a7480', top: '#8a5a34', name: 'workbench' }), [R.x1 - .5, -4], -PI / 2, 'workbench'); P(c, 'toolbox', { on: wb, at: [R.x1 - .5, -4.6] }); P(c, 'radio', { on: wb, at: [R.x1 - .5, -3.4], ry: -PI / 2 });
    placeOnWall(c, corkBoard(c, 2, 1.2), 'right', -4, 2.2, null);
    for (let i = 0; i < 4; i++) P(c, 'crate', { at: [-8.5 + (i % 2) * .6, -9 + Math.floor(i / 2) * .5], y: i > 1 ? .36 : 0, text: pick(c, ['PROPS', 'SPARE PARTS', 'DO NOT DROP']) });
    const sg = board(c, ['HANGAR 3', 'MIND THE PROPELLER'], { w: 3, h: .9, bg: '#f6c945', fg: '#2a1d17' }); placeOnWall(c, sg, 'left', -6, 6.5, 'sign');
    if (c.o.rig) {
      const rg = new THREE.Group(); rg.name = 'water tank rig'; const fm = M('#d8dde3', { rough: .4, metal: .4 }), W2 = 4.2, H2 = 3.2, D2 = 3;
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(rg, rbox(.16, H2 + .4, .16, .04), fm, [x * W2 / 2, (H2 + .4) / 2, z * D2 / 2]);
      for (const y of [.1, H2 + .3]) { mesh(rg, rbox(W2 + .16, .16, .16, .04), fm, [0, y, D2 / 2]); mesh(rg, rbox(W2 + .16, .16, .16, .04), fm, [0, y, -D2 / 2]); mesh(rg, rbox(.16, .16, D2, .04), fm, [W2 / 2, y, 0]); mesh(rg, rbox(.16, .16, D2, .04), fm, [-W2 / 2, y, 0]); }
      const wm = new THREE.MeshStandardMaterial({ color: '#3fa8d8', transparent: true, opacity: .45, roughness: .05, emissive: '#1a5a8a', emissiveIntensity: .35, depthWrite: false });
      const wb2 = mesh(rg, rbox(W2 - .1, H2 * .85, D2 - .1, .04), wm, [0, .2 + H2 * .425, 0]); wb2.userData.noOutline = true; wb2.castShadow = false; wb2.renderOrder = 2;
      for (const z of [-.9, .9]) tube(rg, [[W2 / 2, .6, z * .5], [W2 / 2 + .8, .6, z * .5], [W2 / 2 + .8, .02, z * .5]], .07, M('#c8443a'), 8);
      ink(rg, .012); rg.userData.footprint = { w: W2 + .3, d: D2 + .3 }; put(c, rg, [-5.2, -1.5], .3, 'rig', { ink: false });
      fx(c, 'bubbles', { at: [-5.2, 1.6, -1.5], area: [3, 2.4, 2], count: 26, rise: .5 });
      P(c, 'control_panel', { at: [-1.9, 1.5], ry: -1.1, key: 'rigPanel' }); }
    fx(c, 'godrays', { at: [0, 4, R.zb + .5], size: [12, 6], dir: [.1, -.35, 1], length: 10, count: 5, intensity: c.mood === 'day' ? .35 : .2, dust: 80 });
    gulls(c, [0, 14, -40], 3, 8);
    treeLine(c, -70, -60, 60, { size: 2.6 }); hills(c, -110, -120, 120, { color: '#8aa07a', size: 16 });
    spot(c, 'plane', 1.5, -2.4, -.3); spot(c, 'door', -2.6, -15.5, PI + .3); spot(c, 'rig', -2.5, .2, .6); spot(c, 'center', 0, 1, 0);
    cam(c, 'hangar', [.8, 1.7, -2.2], 7, 12, 8, 55, { spot: 'plane', note: 'the plane, the open doors and the sky' });
    cam(c, 'plane', [0, 2.2, -7.5], 9, 35, 12, 50, { spot: 'plane' });
    cam(c, 'rig', [-3.6, 1.25, -.3], 4.8, 42, 8, 50, { spot: 'rig' });
    cam(c, 'door', [-2.1, 1.6, -15.5], 6, 168, 6, 55, { spot: 'door', note: 'from outside looking in' });
    S.bounds = null;
  });

// ---------------------------------------------------------------- mission control
const MAPSCREEN = (era) => (x, W, H, t) => {
  const old = era === '60s' || era === '1960s', bg = old ? '#0a1a10' : '#0a1430', fg = old ? '#5aff8c' : '#5ad8ff';
  x.fillStyle = bg; x.fillRect(0, 0, W, H); x.strokeStyle = old ? 'rgba(90,255,140,.15)' : 'rgba(90,216,255,.15)'; x.lineWidth = 1; for (let i = 0; i < W; i += W / 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let j = 0; j < H; j += H / 10) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
  x.fillStyle = old ? 'rgba(90,255,140,.28)' : 'rgba(90,216,255,.28)'; for (const [cx, cy, rx, ry] of [[.2, .4, .09, .14], [.27, .7, .05, .12], [.48, .32, .06, .1], [.52, .6, .06, .14], [.7, .35, .14, .12], [.82, .72, .05, .06]]) { x.beginPath(); x.ellipse(cx * W, cy * H, rx * W, ry * H, .3, 0, TAU); x.fill(); }
  x.strokeStyle = '#ffd166'; x.lineWidth = 4; x.setLineDash([12, 10]); x.beginPath(); for (let i = 0; i <= 60; i++) { const u = i / 60; x.lineTo(W * (.05 + .9 * u), H * (.75 - .55 * Math.sin(u * PI) + .1 * Math.sin(u * 9))); } x.stroke(); x.setLineDash([]);
  const u = (t * .03) % 1, px = W * (.05 + .9 * u), py = H * (.75 - .55 * Math.sin(u * PI) + .1 * Math.sin(u * 9)); x.fillStyle = '#ff5a4a'; x.beginPath(); x.arc(px, py, 10, 0, TAU); x.fill(); x.strokeStyle = '#ff5a4a'; x.lineWidth = 3; x.beginPath(); x.arc(px, py, 18 + 6 * Math.sin(t * 6), 0, TAU); x.stroke();
  x.fillStyle = fg; x.font = FONT(800, H * .07); x.textAlign = 'left'; x.fillText('MISSION 7  TRAJECTORY', W * .02, H * .08);
  const s = Math.floor(t + 761), hh = String(Math.floor(s / 3600)).padStart(2, '0'), mm = String(Math.floor(s / 60) % 60).padStart(2, '0'), ss = String(s % 60).padStart(2, '0'); x.textAlign = 'right'; x.fillText(`T+ ${hh}:${mm}:${ss}`, W * .98, H * .08);
};
def('mission-control', ['control-room', 'mission-control-room', 'launch-control'], ['space', 'interior'], 'mission control: tiers of glowing consoles stepping up toward the back, office chairs, a giant wall screen with a live trajectory map and a mission clock, side screens of charts, dim ceiling spots',
  "era modern | 60s (green CRT glow, beige consoles); mood night (default: dark room, screens glow) | day | alarm; o.title",
  c => {
    const S = c.S, old = c.era === '60s' || c.era === '1960s';
    room(c, { w: 13, h: 4.6, back: -6.5, front: 6, wall: c.o.wall || (old ? '#5a5a52' : '#2a3242'), wallKind: 'metal', wallOpt: { n: 2 }, wallTile: 1.6, floorKind: 'carpet', floor: old ? '#5a4a3a' : '#2f3646', floorOpt: { n: 5 }, ceilingKind: 'tiles', ceiling: '#3a3e48' });
    lightIn(c, { shadowSize: 9 }); const R = c.room;
    const big = liveScreen(c, 8, 3.1, MAPSCREEN(c.era), { name: 'main screen', bezel: '#1a1d24', px: 1024, glow: 1.2 }); placeOnWall(c, big, 'back', 0, 2.55, 'screen');
    for (const s of [-1, 1]) { const sc = liveScreen(c, 1.9, 1.3, s < 0 ? CHART : CODE, { name: 'side screen' }); placeOnWall(c, sc, 'back', s * 5.4, 2.9); }
    const ttl = board(c, c.o.title || 'FLIGHT', { w: 1.6, h: .35, bg: '#1a1d24', fg: old ? '#5aff8c' : '#ffd166', glow: 1.0, edge: '#3a3e48' }); placeOnWall(c, ttl, 'back', 0, 4.37);
    lamp(c, [0, 2.6, R.zb + 1.5], old ? '#7affa0' : '#7ac8ff', 3, 9);
    // tiers of consoles (platforms step up toward the camera)
    const tiers = [[-2.9, 0], [-.7, .32], [1.5, .64]], col = old ? '#c8bfa8' : undefined; let n = 0;
    tiers.forEach(([z, y], ti) => {
      if (y > 0) { const pf = new THREE.Group(); mesh(pf, rbox(R.w - .2, y, 2.2, .04), TM(ptex('carpet', old ? '#5a4a3a' : '#2f3646', [6, 1], { n: 5 }), { rough: 1 }), [0, y / 2, 0]); mesh(pf, rbox(R.w - .2, .05, .06, .02), M('#e9b44c', { emissive: '#e9b44c', ei: .3 }), [0, y - .02, -1.1]); ink(pf, .006); put(c, pf, [0, z + .4], 0, null, { solid: false }); }
      for (let i = 0; i < 4; i++) { const x = -2.1 + i * 1.4 + (ti === 1 ? .3 : 0); n++;
        const cp = P(c, 'control_panel', { at: [x, y, z], color: col, key: n === 2 ? 'console' : undefined });
        const ch = P(c, 'office_chair', { at: [x, y, z + .8], ry: PI + rr(c, -.3, .3), color: pick(c, ['#2f3036', '#3a3d45', '#5a2a2a']) }); seat(c, 'console' + n, ch, x, z + .8, PI, .5 + y);
        if (cp && chance(c, .6)) P(c, pick(c, ['mug', 'book_stack', 'clipboard']), { at: [x + .45, y + .86, z + .2], fill: 'coffee', text: 'GO / NO GO' }); }
    });
    for (const s of [-1, 1]) { W(c, 'server_rack', s < 0 ? 'left' : 'right', -3, .42); W(c, 'server_rack', s < 0 ? 'left' : 'right', -2.3, .42); }
    W(c, 'wall_clock', 'left', -.5, 0, { mount: 3, time: '9:41' }); W(c, 'door', 'front', 3.5, .002, { color: '#3a3e48' }); W(c, 'potted_plant', 'front', -4.5, .25, { kind: 'snake', scale: 1.4 });
    for (let x = -4.5; x <= 4.5; x += 3) for (let z = -4.5; z <= 4.5; z += 3) deco(mesh(S.scene, rcyl(.12, .12, .02, .01, 16), glowM('#fff1d0', 1.4), [x, R.h - .02, z]));
    if (c.mood === 'alarm') { beacon(c, [-3.6, 4.25, R.zb + .1]); beacon(c, [3.6, 4.25, R.zb + .1]); }
    fx(c, 'dust', { at: [0, 2, -2], area: [6, 2.5, 4], count: 40, intensity: .4 });
    spot(c, 'front', 0, R.zb + 1.4, 0); spot(c, 'flight', 0, 2.6, PI); spot(c, 'aisle', -.2, .4, 0);
    cam(c, 'room', [0, 2.3, -3.5], 6.2, 0, 12, 55, { spot: 'front', note: 'from the back over the tiers to the big screen' });
    cam(c, 'front', [0, 1.6, R.zb + 1.4], 3.6, 6, 4, 45, { spot: 'front', note: 'the hero under the big screen' });
    cam(c, 'operators', [0, 1.2, -.3], 4.4, 180, 38, 50, { seat: 'console6', note: 'from high above the screen back over the consoles' });
    cam(c, 'console', [-.7, 1.05, -2.1], 2.0, 160, 25, 45, { seat: 'console2', note: 'an operator over the console' });
  }, { mood: 'night' });

// ---------------------------------------------------------------- spacecraft cabin
const PANEL = (base, seed) => canvasTex(1024, 512, (x, W, H) => {
  const R = rnd(seed); x.fillStyle = base; x.fillRect(0, 0, W, H); x.strokeStyle = shade(base, -.35); x.lineWidth = 4;
  const cells = [[0, 0, .34, .5], [.34, 0, .33, .5], [.67, 0, .33, .5], [0, .5, .5, .5], [.5, .5, .5, .5]];
  for (const [u, v, w, h] of cells) { const X = u * W + 8, Y = v * H + 8, WW = w * W - 16, HH = h * H - 16; x.fillStyle = shade(base, -.08); x.fillRect(X, Y, WW, HH); x.strokeRect(X, Y, WW, HH);
    x.fillStyle = '#2a1d17'; x.font = FONT(800, 16); x.textAlign = 'left'; x.fillText(pick({ R }, ['O2 FLOW', 'CABIN PRESS', 'PWR BUS A', 'RCS', 'COMMS', 'GUIDANCE', 'FUEL']), X + 8, Y + 22);
    const kind = R();
    if (kind < .35) for (let i = 0; i < 3; i++) { const cx = X + WW * (.2 + i * .3), cy = Y + HH * .58, r = Math.min(WW, HH) * .16; x.fillStyle = '#f4efe3'; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); x.strokeStyle = '#2a1d17'; x.lineWidth = 3; x.stroke(); x.beginPath(); x.moveTo(cx, cy); const a = -2 + R() * 3; x.lineTo(cx + Math.cos(a) * r * .8, cy + Math.sin(a) * r * .8); x.stroke(); }
    else if (kind < .75) for (let j = 0; j < 2; j++) for (let i = 0; i < 6; i++) { const sx = X + 20 + i * (WW - 40) / 6, sy = Y + 50 + j * (HH - 60) / 2; x.fillStyle = '#3a3d45'; x.fillRect(sx, sy, 22, 30); x.fillStyle = '#d8dde3'; x.fillRect(sx + 7, sy + (R() < .5 ? 2 : 14), 8, 14); x.fillStyle = '#2a1d17'; x.font = FONT(600, 11); x.fillText(['ON', 'OFF', 'ARM', 'AUTO'][Math.floor(R() * 4)], sx, sy + 44); }
    else { x.fillStyle = '#10140e'; x.fillRect(X + 14, Y + 34, WW - 28, HH - 48); x.fillStyle = '#ffb04a'; x.font = FONT(800, 30); for (let i = 0; i < 3; i++) x.fillText(String(Math.floor(R() * 9999)).padStart(5, '0'), X + 26, Y + 70 + i * 34); } }
});
def('spacecraft-cabin', ['capsule', 'lunar-module', 'lander-cabin', 'cockpit-space'], ['space', 'interior'], 'a cramped spacecraft cabin (capsule / lunar module): every wall covered in switch panels, dials and blinking lights, two crew seats, small windows onto space (or the moon outside), cables, an ABORT button; o.float sets small items drifting',
  "kind capsule | lander (moon surface in the windows); o.float true; mood cold (default) | night | alarm | warm",
  c => {
    const S = c.S, lander = c.o.kind === 'lander' || c.asked === 'lunar-module' || c.asked === 'lander-cabin', base = c.o.wall || '#a8adb4';
    room(c, { w: 2.8, h: 2.3, back: -1.25, front: 2.7, ext: 6, wall: base, wallKind: 'metal', wallOpt: { n: 2 }, wallTile: .8, floorKind: 'metal', floor: '#6a6e76', floorTile: .8, ceilingKind: 'metal', ceiling: '#8a9098', crown: false });
    lightIn(c, { rig: { kd: [.5, 5, 3] } }); const R = c.room;
    // panels on every wall (painted switches and dials) + real toggles, glowing buttons and a screen
    const pt = PANEL(shade(base, -.05), c.seed * 3 + 1), pt2 = PANEL(shade(base, -.1), c.seed * 3 + 2);
    const pg = new THREE.Group(); pg.name = 'panels';
    mesh(pg, rbox(2.5, .9, .1, .02), TM(pt, { rough: .6 }), [0, .95, R.zb + .05], [.25, 0, 0]);
    for (const s of [-1, 1]) { mesh(pg, rbox(.1, .8, 1.8, .02), [M(base), M(base), M(base), M(base), TM(pt2, { rough: .6 }), M(base)].map((m, i) => i === (s < 0 ? 0 : 1) ? TM(pt2, { rough: .6 }) : m), [s * (R.w / 2 - .05), 1.55, -.1]); }
    mesh(pg, rbox(2.5, .12, 1.0, .02), TM(pt2, { rough: .6 }), [0, R.h - .07, -.6]);
    const leds = []; for (let i = 0; i < 18; i++) { const m = toonMat(pick(c, ['#ff4a3a', '#5aff6a', '#ffd166', '#5ad8ff']), { emissive: '#ffffff', ei: 1.5 }).clone(); m.emissive.copy(m.color); leds.push(m); deco(mesh(pg, sph(8, 6), m, [-1.1 + (i % 9) * .27, i < 9 ? 1.32 : .62, R.zb + (i < 9 ? .22 : .02)], null, .022)); }
    for (let i = 0; i < 10; i++) { const tg = mesh(pg, rcyl(.008, .008, .06, .003, 6), M('#d8dde3', { metal: .5 }), [-.9 + i * .2, 1.05, R.zb + .17], [.9 + (i % 3) * .3, 0, 0]); void tg; }
    const ab = mesh(pg, rcyl(.07, .07, .05, .02, 20), toonMat('#e2432f', { emissive: '#e2432f', ei: .6 }), [.95, .82, R.zb + .12], [PI / 2 + .25, 0, 0]); void ab; deco(mesh(pg, rbox(.24, .06, .01, .005), TM(textTex('ABORT', { w: 256, h: 64, bg: '#f6c945', fg: '#2a1d17' })), [.95, .7, R.zb + .1], [.25, 0, 0]));
    ink(pg, .004); S.scene.add(pg); pg.userData.update = t => leds.forEach((m, i) => { m.emissiveIntensity = Math.sin(t * (1.3 + (i % 5) * .7) + i) > -.3 ? 1.8 : .2; });
    const scr = liveScreen(c, .5, .34, (x, W, H, t) => { x.fillStyle = '#0a140c'; x.fillRect(0, 0, W, H); x.fillStyle = '#5aff8c'; x.font = FONT(800, H * .13); x.textAlign = 'left'; ['ALT  ' + (14800 - Math.floor(t * 37)), 'VEL  ' + (1612 - Math.floor(t * 3)), 'FUEL ' + (62 - Math.floor(t * .2)) + '%', t % 1 < .5 ? '> PROGRAM 64_' : '> PROGRAM 64'].forEach((s, i) => x.fillText(s, W * .06, H * (.2 + i * .2))); }, { name: 'guidance screen', bezel: '#3a3d45' });
    scr.position.set(-.55, 1.45, R.zb + .1); scr.rotation.x = .25; S.add(scr); c.props.screen = scr;
    // windows onto space (two small rounded triangles / rounds), view painted
    const vt = canvasTex(256, 256, (x, W) => { x.fillStyle = '#02030a'; x.fillRect(0, 0, W, W); const r2 = rnd(7); for (let i = 0; i < 80; i++) { x.fillStyle = '#ffffff'; x.globalAlpha = .4 + r2() * .6; x.fillRect(r2() * W, r2() * W, 2, 2); } x.globalAlpha = 1;
      if (lander) { x.fillStyle = '#9a9a9a'; x.beginPath(); x.moveTo(0, W * .62); for (let i = 0; i <= 10; i++) x.lineTo(i * W / 10, W * (.6 + .05 * Math.sin(i * 1.7))); x.lineTo(W, W); x.lineTo(0, W); x.fill(); x.fillStyle = '#7a7a7a'; for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(r2() * W, W * (.72 + r2() * .25), 14 + r2() * 20, 5 + r2() * 6, 0, 0, TAU); x.fill(); } }
      else { const gr = x.createRadialGradient(W * .7, W * 1.4, W * .2, W * .7, W * 1.4, W * 1.05); gr.addColorStop(0, '#3f8ad8'); gr.addColorStop(.85, '#5ab8ff'); gr.addColorStop(.9, '#bfe8ff'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, W); } });
    for (const s of [-1, 1]) { const wg = new THREE.Group(); mesh(wg, torusG(.19, .045, TAU, 10, 32), M('#5a5e68', { metal: .4 }), [0, 0, 0]); deco(mesh(wg, memo('cw', () => new THREE.CircleGeometry(.19, 32)), new THREE.MeshBasicMaterial({ map: vt, fog: false }), [0, 0, -.01])); ink(wg, .004); wg.position.set(s * .62, 1.82, R.zb + .03); wg.rotation.x = .12; S.scene.add(wg); }
    lamp(c, [0, 1.8, R.zb + .6], lander ? '#e8eef8' : '#cfe4ff', 1.2, 3);
    // crew seats (couches) + harness straps, cables, a hatch behind
    for (const s of [-1, 1]) { const sg = new THREE.Group(); const sm = M(pick(c, ['#d8d0c0', '#c8c4b8']), { rough: .8 }); mesh(sg, rbox(.55, .12, .55, .05), sm, [0, .5, 0]); mesh(sg, rbox(.55, .8, .14, .06), sm, [0, .95, -.25], [-.2, 0, 0]); mesh(sg, rbox(.6, .5, .5, .05), M('#6a6e76', { metal: .3 }), [0, .22, 0]);
      for (const k of [-1, 1]) deco(mesh(sg, rbox(.05, .6, .01, .005), M('#3f6fd1'), [k * .15, .9, -.17], [-.2, 0, 0])); ink(sg, .006); put(c, sg, [s * .62, .35], 0, s < 0 ? 'seatL' : 'seatR'); seat(c, s < 0 ? 'left' : 'right', sg, s * .62, .38, 0, .56); }
    const cg = new THREE.Group(); for (let i = 0; i < 4; i++) tube(cg, [[-1.3, 2.2, -1 + i * .3], [-1.0, 1.95 - i * .05, -.6 + i * .3], [-.6, 2.15, -.3 + i * .3]], .018, M(pick(c, ['#3a3d45', '#c8443a', '#3f6fd1'])), 10); ink(cg, .003); S.scene.add(cg);
    const hatch = new THREE.Group(); mesh(hatch, rcyl(.55, .55, .06, .03, 32), M('#8a9098', { metal: .4, rough: .4 }), [0, 0, 0], [PI / 2, 0, 0]); mesh(hatch, torusG(.3, .03, TAU, 8, 28), M('#e2432f'), [0, 0, .06]); for (let i = 0; i < 4; i++) mesh(hatch, rbox(.6, .04, .04, .015), M('#e2432f'), [0, 0, .06], [0, 0, i * PI / 4]);
    ink(hatch, .004); placeOnWall(c, hatch, 'front', 0, 1.2, 'hatch'); hatch.position.z -= .06;
    if (c.o.float) { const items = ['pen', 'notebook', 'apple', 'wrench', 'clipboard', 'cookie'].map((n2, i) => P(c, n2, { at: [rr(c, -.9, .9), 1.3 + c.R() * .6, rr(c, -.5, 1.2)], ry: c.R() * TAU, shadow: false })).filter(Boolean);
      items.forEach((it, i) => { const p0 = it.position.clone(), r0 = it.rotation.clone(); chain(it, t => { it.position.set(p0.x + .05 * Math.sin(t * .4 + i), p0.y + .06 * Math.sin(t * .6 + i * 2), p0.z + .04 * Math.cos(t * .5 + i)); it.rotation.set(r0.x + t * .3 * (i % 2 ? 1 : -1), r0.y + t * .2, r0.z + t * .25); }); }); }
    if (c.mood === 'alarm') beacon(c, [0, R.h - .15, -.1]);
    spot(c, 'center', 0, .05, 0); spot(c, 'window', .55, R.zb + .55, PI);
    cam(c, 'cabin', [-.25, 1.3, -.1], 3.0, 8, 3, 70, { seat: 'left', note: 'wide lens, the seats and the panel wall' });
    cam(c, 'seat', [-.62, 1.05, .3], 1.4, 10, 4, 45, { seat: 'left' });
    cam(c, 'window', [.62, 1.82, R.zb], .6, 10, 0, 40, { spot: 'window', note: 'out of the window' });
    cam(c, 'panel', [-.4, 1.2, R.zb + .1], 1.0, -15, 12, 40, { spot: 'center', note: 'the panel close' });
  }, { mood: 'cold' });

// ---------------------------------------------------------------- space station module
def('space-station', ['station', 'iss', 'space-station-module', 'orbital-station'], ['space', 'interior'], 'a space-station module: a long white tube of locker panels, handrails and cable bundles, laptops on arms, light strips, a big round window at the end with the Earth curving past; things drift',
  "mood cold (default) | night (Earth's night side, city lights) | alarm; o.float false stops the drifting items",
  c => {
    const S = c.S, night = c.mood === 'night';
    room(c, { w: 3.0, h: 2.8, back: -7, front: 4.5, ext: 8, wall: '#e8eaee', wallKind: 'metal', wallOpt: { n: 2 }, wallTile: .9, floorKind: 'metal', floor: '#d6dae0', floorTile: .9, ceilingKind: 'metal', ceiling: '#eef0f4', crown: false, skirting: false });
    lightIn(c, { rig: { kd: [0, 6, 2] } }); const R = c.room;
    // racks of lockers along both walls + floor/ceiling strips
    const lt = canvasTex(512, 512, (x, W) => { x.fillStyle = '#e3e6ea'; x.fillRect(0, 0, W, W); x.strokeStyle = '#a8b0ba'; x.lineWidth = 6; for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { x.strokeRect(i * W / 2 + 10, j * W / 2 + 10, W / 2 - 20, W / 2 - 20); x.fillStyle = '#9aa3ad'; x.fillRect(i * W / 2 + W / 4 - 30, j * W / 2 + W / 4 - 6, 60, 12); x.fillStyle = pick(c, ['#3f6fd1', '#e2432f', '#f6c945', '#5fae4a']); x.fillRect(i * W / 2 + 20, j * W / 2 + 20, 40, 14); } });
    for (const s of [-1, 1]) for (let z = -6.3; z < 4; z += 1.2) { const rk = new THREE.Group(); mesh(rk, rbox(.2, 1.15, 1.15, .03), [M('#e3e6ea'), M('#e3e6ea'), M('#e3e6ea'), M('#e3e6ea'), M('#e3e6ea'), M('#e3e6ea')].map((m, i) => i === (s < 0 ? 0 : 1) ? TM(lt, { rough: .6 }) : m), [0, 0, 0]); ink(rk, .004); rk.position.set(s * (R.w / 2 - .1), 1.35, z); S.scene.add(rk); }
    for (const s of [-1, 1]) { deco(mesh(S.scene, rbox(.05, .04, 10.5, .01), glowM('#f2f8ff', 1.8), [s * .6, R.h - .02, -1.4])); deco(mesh(S.scene, rbox(.3, .02, 10.5, .01), M('#c8ccd2'), [s * .6, .01, -1.4])); }
    const hm = M('#f6c945', { rough: .4 });
    for (const s of [-1, 1]) for (const y of [.55, 2.15]) { const hr = new THREE.Group(); tube(hr, [[s * 1.18, y, -6.4], [s * 1.18, y, 4]], .025, hm, 4); for (let z = -6; z < 4; z += 2) mesh(hr, rbox(.12, .05, .05, .015), M('#9aa3ad'), [s * 1.24, y, z]); ink(hr, .004); S.scene.add(hr); }
    for (let k = 0; k < 4; k++) { const cg = new THREE.Group(); const z0 = -5 + k * 2.4; tube(cg, [[-1.3, 2.6, z0], [-1.0, 2.35, z0 + .6], [-.4, 2.5, z0 + 1.2], [.2, 2.62, z0 + 1.8]], .03, M(pick(c, ['#3a3d45', '#e2432f', '#3f6fd1', '#5a5e68'])), 16); ink(cg, .003); S.scene.add(cg); }
    for (const [s, z, app] of [[-1, -2.2, 'chart'], [1, -.4, 'code'], [-1, 1.6, 'video']]) { const lp = P(c, 'laptop', { at: [s * 1.02, 1.25, z], ry: -s * PI / 2, app, key: z === -2.2 ? 'laptop' : undefined }); if (lp) lp.rotation.z = s * .15; }
    // the window at the end: Earth below, or its night side
    const et = canvasTex(512, 512, (x, W) => { x.fillStyle = '#02030a'; x.fillRect(0, 0, W, W); const r2 = rnd(3); for (let i = 0; i < 70; i++) { x.fillStyle = '#ffffff'; x.globalAlpha = .3 + r2() * .7; x.fillRect(r2() * W, r2() * W * .5, 2, 2); } x.globalAlpha = 1;
      const gr = x.createRadialGradient(W * .4, W * 1.9, W * .9, W * .4, W * 1.9, W * 1.55); gr.addColorStop(0, night ? '#0a1430' : '#2f7ad0'); gr.addColorStop(.9, night ? '#14204a' : '#5ab8ff'); gr.addColorStop(.95, night ? '#3a5aa0' : '#d8f4ff'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, W);
      x.fillStyle = night ? '#ffd58a' : 'rgba(255,255,255,.85)'; for (let i = 0; i < (night ? 120 : 14); i++) { const a = r2() * 1.2 - .6, rr2 = W * (1.0 + r2() * .5), X = W * .4 + Math.sin(a) * rr2, Y = W * 1.9 - Math.cos(a) * rr2; if (Y < W) { x.beginPath(); x.ellipse(X, Y, night ? 2 : 30 + r2() * 40, night ? 2 : 8 + r2() * 8, 0, 0, TAU); x.fill(); } } });
    const wg = new THREE.Group(); mesh(wg, torusG(.85, .12, TAU, 12, 48), M('#c8ccd2', { metal: .4, rough: .4 }), [0, 0, 0]); const em = deco(mesh(wg, memo('stwin', () => new THREE.CircleGeometry(.85, 48)), new THREE.MeshBasicMaterial({ map: et, fog: false }), [0, 0, -.02]));
    wg.position.set(0, 1.45, R.zb + .06); ink(wg, .006); S.scene.add(wg); c.props.window = wg; wg.userData.update = t => { em.rotation.z = t * .02; };
    lamp(c, [0, 1.5, R.zb + .8], night ? '#8aa8ff' : '#bfe4ff', 2, 5);
    W(c, 'airlock-door', 'front', 0, .1, { scale: .65 });
    if (c.o.float !== false) { const items = ['pen', 'apple', 'wrench', 'notebook', 'mug', 'cookie', 'calculator', 'banana'].map((n2, i) => P(c, n2, { at: [rr(c, -.8, .8), .9 + c.R() * 1.3, rr(c, -5, 2.5)], ry: c.R() * TAU, shadow: false })).filter(Boolean);
      items.forEach((it, i) => { const p0 = it.position.clone(), r0 = it.rotation.clone(); chain(it, t => { it.position.set(p0.x + .08 * Math.sin(t * .3 + i), p0.y + .1 * Math.sin(t * .45 + i * 2), p0.z + .1 * Math.cos(t * .35 + i)); it.rotation.set(r0.x + t * .25 * (i % 2 ? 1 : -1), r0.y + t * .15, r0.z + t * .2); }); }); }
    if (c.mood === 'alarm') beacon(c, [0, R.h - .12, -2]);
    fx(c, 'dust', { at: [0, 1.4, -2], area: [2, 2, 8], count: 50, intensity: .45, wind: [.01, .01, .01] });
    spot(c, 'module', 0, -.6, 0); spot(c, 'window', .45, R.zb + 1.2, -.5); spot(c, 'laptop', -.45, -2.2, -PI / 2);
    c.spots.module.push(.45); c.spots.window.push(.3); c.spots.laptop.push(.35);
    cam(c, 'module', [0, 1.55, -1.2], 2.8, 0, 2, 60, { spot: 'module', note: 'down the module to the Earth window (characters float: spot[3] = y)' });
    cam(c, 'window', [0, 1.5, R.zb + 1.0], 2.4, 15, 4, 50, { spot: 'window' });
    cam(c, 'laptop', [-.6, 1.4, -2.2], 1.8, 50, 6, 45, { spot: 'laptop' });
  }, { mood: 'cold' });

// ---------------------------------------------------------------- outer space
def('outer-space', ['space', 'orbit', 'deep-space'], ['space', 'exterior'], 'open space: thousands of twinkling stars, the Earth (or a red planet / gas giant) filling the lower frame, a station module and a satellite drifting, tumbling asteroids, a moon, the sun flaring',
  "o.planet earth | red | gas; o.ship station | capsule | none; mood (the rig is always space light)",
  c => {
    const S = c.S;
    S.sky('space', { starCount: 2000 }); S.light('space', { shadowSize: 12, kd: [-6, 3, 4] }); S.scene.fog = null;
    fx(c, 'stars', { count: 600, radius: 140 });
    const pl = c.o.planet || 'earth', pn = { earth: 'planet-earth', red: 'planet-red', gas: 'gas-giant' }[pl] || 'planet-earth';
    P(c, pn, { at: [6, -46, -60], r: 40, spin: .01, key: 'planet', shadow: false });
    P(c, 'small-moon', { at: [-24, 22, -90], r: 4, shadow: false });
    if (c.o.ship !== 'none') { if (c.o.ship === 'capsule') P(c, 'crew-capsule', { at: [-3.5, -1, -8], ry: .6, key: 'ship' }); else { const st = P(c, 'station-module', { at: [-5, 2.5, -12], ry: .3, key: 'ship' }); if (st) chain(st, t => { st.rotation.z = .1 * Math.sin(t * .1); }); } }
    P(c, 'satellite', { at: [9, 6, -22], spin: .15, key: 'satellite' });
    for (const [x, y, z, s] of [[4, 3.2, -6, 1.2], [-2.6, -1.5, -4, .6], [7, -2, -10, 1.8], [-9, 5, -16, 2.4], [2, 8, -26, 3]]) P(c, 'asteroid', { at: [x, y, z], size: s, spin: .15 + c.R() * .2 });
    P(c, 'comet', { at: [-30, 30, -120], ry: -.6, size: 2 });
    fx(c, 'glow', { at: [-60, 25, 60], size: 30, color: '#fff2d0', intensity: 1.4, streak: true });
    spot(c, 'float', 0, 0, 0); c.spots.float.push(1.2); spot(c, 'ship', -2.2, -6, .6); c.spots.ship.push(2.2);
    cam(c, 'space', [0, 1.95, 0], 3.4, 10, 8, 45, { spot: 'float', note: 'the hero drifting, the planet curving below' });
    cam(c, 'wide', [-1, 0, -8], 18, 20, 10, 50, { spot: 'float' });
    cam(c, 'planet', [6, -12, -60], 60, 0, 20, 50, { spot: 'float', note: 'the planet (no hero in frame)' });
  });

// ---------------------------------------------------------------- ocean surface
def('ocean-surface', ['ocean', 'open-sea', 'sea', 'barge'], ['water', 'exterior'], 'the open sea from the deck of a work barge: steel deck with crates, coiled rope, life rings and a wheelhouse, railings, rolling waves to the horizon, a far ship, a buoy, gulls',
  "mood day | warm | night | storm (rain, lightning, big waves); o.ship false",
  c => {
    const S = c.S, storm = c.mood === 'storm';
    outdoors(c, { shadowSize: 14, at: [0, -3], fogNear: 60, fogFar: 300, fogColor: c.mood === 'day' ? '#cfe6f2' : undefined, cloudAt: [0, 22, -80] });
    fx(c, 'water', { at: [0, -1.4, -60], size: [400, 300], waves: storm ? .35 : .12, color: storm ? '#1f4a6a' : '#1f78b8', shallow: storm ? '#3f6a8a' : '#4ab0e0', foam: storm ? 1.6 : .8 });
    // the barge (its deck is y = 0)
    const bg = new THREE.Group(); bg.name = 'barge'; const hullM = M('#3f5a6a', { rough: .6 }), deckT = TM(ptex('metal', '#8a8f96', [8, 20], { n: 2 }), { rough: .7 });
    mesh(bg, rbox(9, 2.2, 22, .4), hullM, [0, -1.1, -4]); mesh(bg, rbox(8.6, .1, 21.6, .04), deckT, [0, -.04, -4]); mesh(bg, rbox(9.05, .5, 22.05, .2), M('#c8443a'), [0, -1.9, -4]);
    for (const s of [-1, 1]) { tube(bg, [[s * 4.3, 1.0, 6.8], [s * 4.3, 1.0, -14.8]], .035, M('#e9e1cf'), 4); tube(bg, [[s * 4.3, .55, 6.8], [s * 4.3, .55, -14.8]], .025, M('#e9e1cf'), 4); for (let z = 6.6; z > -15; z -= 2) mesh(bg, rbox(.06, 1.0, .06, .02), M('#e9e1cf'), [s * 4.3, .5, z]); }
    const wh = new THREE.Group(); mesh(wh, rbox(4, 2.6, 3, .1), M('#e9e1cf'), [0, 1.3, 0]); mesh(wh, rbox(4.3, .2, 3.3, .06), M('#c8443a'), [0, 2.7, 0]); for (let i = 0; i < 4; i++) deco(mesh(wh, rbox(.7, .5, .02, .02), c.mood === 'night' ? glowM('#ffd58a', 1.4) : M('#3a4a66'), [-1.3 + i * .87, 1.9, 1.51]));
    mesh(wh, rcyl(.06, .08, 3.4, .02, 8), M('#e9e1cf'), [1.2, 2.7, -.6]); deco(mesh(wh, sph(10, 8), glowM('#ff4a3a', 2), [1.2, 6.15, -.6], null, .1));
    const flag = mesh(wh, planeG(.7, .45), M('#3f6fd1', { side: THREE.DoubleSide }), [1.55, 5.7, -.6]); flag.userData.noOutline = true; chain(wh, t => { flag.rotation.y = .3 * Math.sin(t * 3); });
    wh.position.set(0, 0, -12.5); bg.add(wh);
    ink(bg, .02); bg.userData.solid = false; S.scene.add(bg); c.props.barge = bg;
    for (const [x, z, n2] of [[-2.6, -4.5, 4], [2.4, -7, 3], [-2.2, -9.5, 2]]) for (let i = 0; i < n2; i++) P(c, 'crate', { at: [x + (i % 2) * .55, z + Math.floor(i / 2) * .42], y: i >= 2 ? .36 : 0, kind: i % 3 ? undefined : 'plastic', text: 'FRAGILE' });
    put(c, container(c, '#c8443a', { text: 'DEEP BLUE CARGO' }), [2.4, -2.5], PI / 2, 'container');
    const rope = new THREE.Group(); for (let i = 0; i < 5; i++) mesh(rope, torusG(.32 - i * .03, .035, TAU, 8, 28), M('#c9a46a', { rough: 1 }), [0, .035 + i * .06, 0], [PI / 2, 0, 0]); ink(rope, .004); put(c, rope, [-1.6, 1.4], 0, null, { solid: false });
    P(c, 'life-ring', { at: [-4.1, -1.2], ry: PI / 2 }); P(c, 'toolbox', { at: [1.2, 1.2], ry: .4 }); put(c, bollard(c), [3.6, 3.5], 0, null); put(c, bollard(c), [-3.6, 3.5], 0, null);
    for (const [x, z] of [[1.6, -1.2], [1.9, -1.6]]) put(c, barrel(c, { color: '#3f6fd1' }), [x, z], c.R(), null);
    if (c.o.ship !== false) put(c, steamer(c, { at: [-40, -1.2, -110], ry: .3, smoke: !storm }), [-40, -1.2, -110], .3, 'ship', { solid: false });
    P(c, 'buoy', { at: [14, -1.4, -30] }); P(c, 'lighthouse', { at: [90, -1.4, -220], scale: .5, shadow: false });
    gulls(c, [2, 8, -6], 4, 6);
    if (storm) { fx(c, 'rain', { at: [0, 0, -2], area: [12, 9, 14], count: 1000, wind: [2, 0, 0] }); fx(c, 'lightning', { at: [-30, 0, -120], every: 4.5, height: 60 }); }
    spot(c, 'deck', 0, -1.5, 0); spot(c, 'rail', -3.6, -3.2, PI / 2 - .3); spot(c, 'bow', 0, 5.5, 0);
    cam(c, 'deck', [0, 1.45, -1.5], 4.6, 12, 6, 50, { spot: 'deck', note: 'the deck, the wheelhouse and the sea' });
    cam(c, 'rail', [-3.8, 1.5, -3.2], 3.8, 80, 6, 45, { spot: 'rail', note: 'at the railing, the open sea behind' });
    cam(c, 'wide', [0, 2, -6], 20, 30, 12, 50, { spot: 'deck' });
    cam(c, 'low', [0, 1.8, -1.5], 4, -10, -8, 55, { spot: 'deck' });
  });

// ---------------------------------------------------------------- deep sea
def('deep-sea', ['deep-ocean', 'abyss', 'midnight-zone'], ['water', 'underwater'], 'the deep sea: near-black blue, marine snow drifting down, a research submersible with real lamps, glowing jellyfish, an anglerfish with its lure, silver fish, rock spires fading into the dark',
  "mood (always dark); o.sub false; o.creatures false",
  c => {
    const S = c.S;
    S.sky(['#00040c', '#04203a'], { sunGlow: 0 }); S.light('underwater', { ki: .95, hi: .5, fi: .55, key: '#6ab8ff', sky: '#2a5a8a', gnd: '#02060c', ri: .8, shadowSize: 10 }); S.fog('#03182c', 4, 30);
    terrain(c, { kind: 'silt', color: '#2a3a4a', size: [120, 120], at: [0, -20], y: -7, amp: 3, scale: .08, flat: 0, tile: 3 });
    for (const [x, z, h] of [[-6, -10, 14], [7, -14, 18], [-12, -22, 22], [12, -6, 12]]) { const sp = new THREE.Group(); mesh(sp, rcyl(.8, 2.2, h, .5, 9), TM(ptex('rock', '#3a4652', [2, 6]), { rough: 1 }), [0, -7, 0]); ink(sp, .03); put(c, sp, [x, z], c.R(), null, { solid: false }); }
    fx(c, 'dust', { at: [0, 1.5, -3], area: [12, 8, 12], count: 260, color: '#d8eeff', size: .02, wind: [.02, -.08, .01], intensity: .8 });
    if (c.o.sub !== false) { const sb = P(c, 'submersible', { at: [3.4, -.4, -5.5], ry: -.7, key: 'sub', light: true }); if (sb) { sb.userData.footprint ??= { w: 3.2, d: 6.6 }; const y0 = sb.position.y; chain(sb, t => { sb.position.y = y0 + .12 * Math.sin(t * .5); }); fx(c, 'bubbles', { at: [3.4, 2.6, -5.5], area: [1.4, 3, 1.4], count: 12 }); } }
    if (c.o.creatures !== false) {
      for (const [x, y, z, col, s] of [[-2.4, 3.4, -3, '#7ae8ff', .9], [-4, 5.5, -8, '#ff7ad8', 1.2], [1.4, 4.6, -2, '#b8a0ff', .6], [5, 6, -12, '#7ae8ff', 1.4]]) { P(c, 'jellyfish', { at: [x, y, z], color: col, size: s }); }
      P(c, 'anglerfish', { at: [-1.6, 1.3, -.6], ry: .9, size: 1.1, key: 'anglerfish', light: true });
      for (let i = 0; i < 6; i++) P(c, 'fish', { at: [2 + rr(c, -1, 1), 2.6 + rr(c, -.5, .5), -3 + rr(c, -1, 1)], ry: -PI / 2 + rr(c, -.2, .2), kind: 'silver', size: .6 });
      P(c, 'whale', { at: [-14, 9, -34], ry: PI / 2, shadow: false });
    }
    spot(c, 'float', 0, 0, 0); c.spots.float.push(1.0); spot(c, 'sub', .9, -1.5, -.4); c.spots.sub.push(.8);
    cam(c, 'deep', [0, 2.2, 0], 3.8, 10, 2, 45, { spot: 'float', note: 'the hero (a diver) in the dark, lamps and glows around' });
    cam(c, 'sub', [1.0, 1.6, -2.3], 4.4, 22, 6, 50, { spot: 'sub' });
    cam(c, 'wide', [0, 2, -6], 12, 15, 8, 55, { spot: 'float' });
  });

// ---------------------------------------------------------------- seafloor / trench
function flatfish(c) {
  const g = new THREE.Group(); g.name = 'flatfish'; const t = canvasTex(256, 256, (x, W) => { x.fillStyle = '#b8a07a'; x.fillRect(0, 0, W, W); const r2 = rnd(11); for (let i = 0; i < 60; i++) { x.fillStyle = r2() < .5 ? '#8a6a4a' : '#d8c8a0'; x.beginPath(); x.arc(r2() * W, r2() * W, 4 + r2() * 10, 0, TAU); x.fill(); } });
  const body = mesh(g, sph(28, 12), TM(t, { rough: .8 }), [0, .06, 0], null, [.34, .06, .22]);
  mesh(g, torusG(.26, .025, TAU, 6, 40), M('#a8906a'), [0, .05, 0], [PI / 2, 0, 0], [1.3, 1, 1]);
  mesh(g, sph(12, 8), M('#a8906a'), [-.36, .05, 0], null, [.08, .03, .1]);
  for (const z of [-.04, .05]) { mesh(g, sph(12, 8), M('#f4efe3'), [.18, .12, z], null, .035); deco(mesh(g, sph(8, 6), M('#2a1d17'), [.2, .15, z], null, .018)); }
  ink(g, .004); g.userData.update = t => { body.scale.y = .06 * (1 + .1 * Math.sin(t * 2)); }; g.userData.solid = false; return g;
}
function crab(c) {
  const g = new THREE.Group(); g.name = 'crab'; const m = M('#e2432f', { rough: .6 });
  mesh(g, sph(16, 10), m, [0, .1, 0], null, [.16, .07, .12]); for (const s of [-1, 1]) { for (let i = 0; i < 3; i++) tube(g, [[s * .12, .1, -.06 + i * .06], [s * .24, .14, -.08 + i * .07], [s * .3, 0, -.1 + i * .08]], .012, m, 6);
    mesh(g, sph(10, 8), m, [s * .2, .14, .14], null, [.06, .045, .07]); mesh(g, sph(8, 6), M('#2a1d17'), [s * .04, .2, .08], null, .018); }
  ink(g, .004); const ph = c.R() * 9; g.userData.update = t => { g.position.x += 0; g.rotation.y = .2 * Math.sin(t * .8 + ph); }; g.userData.solid = false; return g;
}
def('seafloor', ['trench', 'sea-floor', 'ocean-floor', 'seabed'], ['water', 'underwater'], 'the deep seafloor: rippled silt, boulders, pale anemones and corals, a flatfish half buried, crabs, a hydrothermal vent puffing black smoke, a bathysphere light from above, marine snow; o.kind "trench" raises steep walls on both sides',
  "kind floor | trench; o.vent false",
  c => {
    const S = c.S, trench = c.o.kind === 'trench' || c.asked === 'trench';
    S.sky(['#000308', '#031a30'], { sunGlow: 0 }); S.light('underwater', { ki: .7, hi: .5, fi: .5, key: '#7ac0ff', sky: '#2a5a8a', gnd: '#04080e', ri: .8, shadowSize: 10, kd: [1, 8, 3] }); S.fog('#041a2e', 5, 34);
    terrain(c, { kind: 'silt', color: c.o.silt || '#5a6a74', size: [140, 140], at: [0, -30], amp: .4, scale: .15, flat: 5, tile: 2.4,
      height: trench ? (x, z) => .3 * fbm2(x * .15, z * .15, 2) + Math.pow(Math.max(0, Math.abs(x + 2 * fbm2(0, z * .05, 4)) - 6), 1.6) * 1.4 : undefined });
    fx(c, 'dust', { at: [0, 2, -3], area: [12, 6, 12], count: 220, color: '#d8eeff', size: .02, wind: [.02, -.07, .01], intensity: .7 });
    for (const [x, z, s] of [[-3.2, -2.5, 1.2], [3.6, -4, 1.6], [-5, -7, 2], [2, -9, 1.4], [5.4, 0, .9]]) P(c, 'boulder', { at: [x, z], scale: s, color: '#4a5662' });
    for (let i = 0; i < 8; i++) P(c, 'rocks', { at: [rr(c, -5, 5), rr(c, -8, 2)], scale: .4 + c.R() * .4, color: '#4a5662', shadow: false });
    for (const [x, z, col] of [[-1.8, -1.2, '#f0d8e8'], [2.3, -2.1, '#ffd8b0'], [-2.8, -4.6, '#d8f0ff'], [1.2, -5.5, '#f0e0ff']]) P(c, 'anemone', { at: [x, z], color: col, tip: '#7ae8ff' });
    for (const [x, z] of [[-4, -3.2], [3.6, -6.4]]) P(c, 'coral', { at: [x, z], kind: pick(c, ['fan', 'branch']), color: '#e8d8c8' });
    put(c, flatfish(c), [.9, .1], .6, 'flatfish'); put(c, crab(c), [-1.2, .6], .4, 'crab'); put(c, crab(c), [2.8, -1.2], -.8, null);
    for (let i = 0; i < 3; i++) { const sc = new THREE.Group(); mesh(sc, memo('cuc', () => new THREE.CapsuleGeometry(.05, .18, 4, 10)), M('#c8607a', { rough: .7 }), [0, .05, 0], [PI / 2, 0, 0]); ink(sc, .003); put(c, sc, [rr(c, -2, 2), rr(c, -3, 1)], c.R() * TAU, null, { solid: false }); }
    if (c.o.vent !== false) { const v = new THREE.Group(); v.name = 'vent'; mesh(v, rcyl(.25, .7, 2.4, .2, 10), TM(ptex('rock', '#3a3a3e', [1, 3]), { rough: 1 }), [0, 0, 0]); mesh(v, rcyl(.3, .32, .3, .1, 10), M('#2a2a2e'), [0, 2.3, 0]); ink(v, .01); put(c, v, [-3.6, -6], 0, 'vent');
      fx(c, 'smoke', { at: [-3.6, 2.7, -6], color: 'black', size: .25, grow: 4, rise: .8, rate: 5, life: 4, wind: [.15, 0, 0], opacity: .8 }); fx(c, 'glow', { at: [-3.6, 2.6, -6], size: .6, color: '#ff7a3a', intensity: .6, pulse: .3 }); lamp(c, [-3.6, 2.5, -5.6], '#ff7a3a', 1.2, 4); }
    P(c, 'bathysphere', { at: [4.2, 3.4, -7], key: 'bathysphere' }); lamp(c, [4.0, 4.3, -6.2], '#e8f4ff', 3.5, 10);
    P(c, 'anglerfish', { at: [3.2, 1.6, -2.6], ry: -1.2, size: .9, light: true });
    if (!trench) P(c, 'shipwreck', { at: [-9, -18], ry: .7, scale: .9 });
    spot(c, 'floor', 0, .9, 0); spot(c, 'vent', -2.4, -4.4, .5); spot(c, 'flatfish', .4, .8, -.4);
    cam(c, 'floor', [0, 1.3, .9], 4.4, 8, 6, 50, { spot: 'floor' });
    cam(c, 'flatfish', [.9, .25, .1], .9, 20, 25, 40, { spot: 'flatfish', note: 'the flatfish close' });
    cam(c, 'vent', [-3, 1.8, -5], 4.4, 30, 6, 50, { spot: 'vent' });
    cam(c, 'wide', [0, 2, -4], 12, 10, 12, 55, { spot: 'floor' });
  });

// ---------------------------------------------------------------- museum hall
function whaleSkeleton(c, L = 9) {
  const g = new THREE.Group(); g.name = 'skeleton'; const bm = M('#efe6d0', { rough: .7 });
  const spine = new THREE.CatmullRomCurve3([[-L / 2, .2, 0], [-L / 4, .5, 0], [0, .55, 0], [L / 4, .35, 0], [L / 2, -.2, 0]].map(p => new THREE.Vector3(...p)));
  mesh(g, new THREE.TubeGeometry(spine, 60, .12, 8, false), bm);
  for (let i = 0; i < 26; i++) { const u = i / 26, p = spine.getPointAt(u); mesh(g, sph(10, 8), bm, [p.x, p.y, 0], null, [.11, .16, .11]); if (u > .25 && u < .75) { const r = .9 * Math.sin((u - .2) / .6 * PI); const rib = mesh(g, torusG(r, .04, PI * 1.15, 6, 20), bm, [p.x, p.y - r * .95, 0], [0, PI / 2, PI / 2 - .3]); void rib; } }
  mesh(g, sph(20, 12), bm, [L / 2 + .7, -.25, 0], null, [.9, .4, .5]); mesh(g, rbox(1.6, .12, .25, .05), bm, [L / 2 + .9, -.65, .25], [0, .1, -.1]); mesh(g, rbox(1.6, .12, .25, .05), bm, [L / 2 + .9, -.65, -.25], [0, -.1, -.1]);
  for (const s of [-1, 1]) mesh(g, rbox(1.3, .08, .45, .04), bm, [L / 5, -.4, s * .9], [0, s * .5, s * .3]);
  mesh(g, rbox(.9, .05, .6, .03), bm, [-L / 2 - .3, .15, 0], [0, 0, .1]);
  for (const x of [-L / 3, L / 4]) tube(g, [[x, .6, 0], [x, 4, 0]], .008, M('#9aa3ad'), 2);
  ink(g, .01); g.userData.solid = false; return g;
}
def('museum-hall', ['museum', 'gallery', 'exhibition-hall'], ['history', 'interior'], 'a grand museum hall: marble floor, columns along the walls, paintings, a statue on a plinth, glass display cases (skull, amphora, crown, hourglass), velvet rope barriers, benches, a whale skeleton hanging under a skylight',
  "mood day | warm | night (after hours: cases glow, a guard's lamp) | alarm; o.skeleton false",
  c => {
    const S = c.S, night = c.mood === 'night';
    room(c, { w: 11, h: 6.4, back: -9, front: 5, wall: c.o.wall || pick(c, ['#c8a88a', '#9ab0a0', '#b8a0a8']), wallKind: 'plaster', floorKind: 'terrazzo', floor: '#e6dccb', floorOpt: { chips: ['#b8a890', '#f4efe3', '#9a8a7a', '#c96a4a'] }, floorTile: 2, wainscot: { kind: 'ashlar', color: '#d8ccb0', h: 1.3, tile: 1.6 }, ceiling: '#efe6d4', trim: '#f4efe3' });
    lightIn(c, { shadowSize: 10, at: [0, -3] }); const R = c.room;
    // skylight + its light shafts
    const sk = new THREE.Group(); mesh(sk, rbox(5, .3, 7, .05), M('#f4efe3'), [0, 0, 0]); deco(mesh(sk, rbox(4.4, .05, 6.4, .02), glowM(night ? '#3a4a8a' : '#eaf6ff', night ? .6 : 1.6), [0, -.16, 0])); for (let i = -1; i <= 1; i++) mesh(sk, rbox(.08, .12, 6.4, .03), M('#9aa3ad'), [i * 1.1, -.18, 0]); ink(sk, .01); sk.position.set(0, R.h - .05, -3.5); S.scene.add(sk);
    if (!night) fx(c, 'godrays', { at: [0, R.h - .3, -3.5], size: [4, 2.5], dir: [.15, -1, .25], length: 7, count: 4, intensity: .35, dust: 70, right: [1, 0, 0], up: [0, 0, 1] });
    // columns along both walls, paintings between them
    for (const s of [-1, 1]) for (let z = -8; z <= 3; z += 3.6) { P(c, 'column', { at: [s * (R.w / 2 - .55), z], h: R.h - .1, scale: 1 }); }
    const arts = ['landscape', 'portrait', 'sunset', 'abstract'];
    for (const s of [-1, 1]) for (let z = -6.2; z <= 2; z += 3.6) W(c, 'picture_frame', s < 0 ? 'left' : 'right', z, 0, { w: 1.4, h: 1.0, mount: 2.4, art: pick(c, arts), frame: '#c9a14a', scale: 1.4 });
    W(c, 'picture_frame', 'back', -3.3, 0, { w: 1.5, h: 2.0, mount: 1.8, art: 'portrait', frame: '#c9a14a', scale: 1.3 }); W(c, 'picture_frame', 'back', 3.3, 0, { w: 2.2, h: 1.4, mount: 2.0, art: 'landscape', frame: '#c9a14a', scale: 1.2 });
    const ban = board(c, c.o.title ? [c.o.title] : ['THE HALL OF', 'VERY OLD THINGS'], { w: 2.6, h: .8, bg: '#7a2a3a', fg: '#f6d88a', edge: '#c9a14a' }); placeOnWall(c, ban, 'back', 0, 4.6, 'banner');
    // centre: statue on a plinth (back), display cases, rope barriers, benches
    const pl = new THREE.Group(); mesh(pl, rbox(1.6, 1.0, 1.6, .05), TM(ptex('ashlar', '#e8e0d0', [1, 1]), { rough: .8 }), [0, .5, 0]); mesh(pl, rbox(1.8, .12, 1.8, .04), M('#d8ccb0'), [0, 1.06, 0]); ink(pl, .01); put(c, pl, [0, -7.2], 0, 'plinth');
    P(c, 'statue', { at: [0, 1.12, -7.2], key: 'statue', scale: .9 });
    const caseOf = (x, z, item, opts = {}) => { const cs = new THREE.Group(); cs.name = 'display case'; mesh(cs, rbox(.9, .95, .9, .04), M('#5b3b25', { rough: .5 }), [0, .475, 0]); mesh(cs, rbox(.94, .06, .94, .02), M('#c9a14a', { metal: .4, rough: .3 }), [0, .98, 0]);
      const gl = mesh(cs, rbox(.86, .7, .86, .02), new THREE.MeshStandardMaterial({ color: '#dff3ff', transparent: true, opacity: .2, roughness: .05, depthWrite: false }), [0, 1.36, 0]); gl.userData.noOutline = true; gl.castShadow = false; gl.renderOrder = 3;
      deco(mesh(cs, rbox(.86, .02, .86, .01), glowM('#fff4dc', night ? 1.4 : .5), [0, 1.7, 0])); ink(cs, .006); put(c, cs, [x, z], 0, null);
      const it = P(c, item, { at: [x, 1.01, z], ry: .5, ...opts }); const lab = board(c, opts.label || 'DO NOT TAP', { w: .3, h: .08, bg: '#f4efe3' }); lab.position.set(x, .85, z + .46); lab.rotation.x = -.6; S.scene.add(lab); return it; };
    caseOf(-2.6, -3.6, 'skull', { scale: 1.3, label: 'SOMEBODY, PROBABLY' }); caseOf(2.6, -3.6, 'amphora', { scale: .65, label: 'A VERY OLD JUG' }); caseOf(-2.6, -.6, 'crown', { label: 'NOT FOR TRYING ON' }); caseOf(2.6, -.6, 'hourglass', { label: 'TIME (ORIGINAL)', flow: .4 });
    for (const [x0, x1, z] of [[-1.2, 1.2, -5.9]]) { const rg = new THREE.Group(); for (const x of [x0, 0, x1]) { mesh(rg, rcyl(.04, .04, .95, .015, 10), M('#c9a14a', { metal: .5, rough: .3 }), [x, 0, 0]); mesh(rg, sph(12, 8), M('#c9a14a', { metal: .5, rough: .3 }), [x, .98, 0], null, .06); mesh(rg, rcyl(.15, .17, .04, .015, 16), M('#c9a14a', { metal: .5 }), [x, 0, 0]); }
      tube(rg, [[x0, .9, 0], [(x0) / 2, .7, 0], [0, .9, 0]], .025, M('#9a1a2a', { rough: .8 }), 12); tube(rg, [[0, .9, 0], [x1 / 2, .7, 0], [x1, .9, 0]], .025, M('#9a1a2a', { rough: .8 }), 12); ink(rg, .005); put(c, rg, [0, z], 0, 'ropes', { solid: false }); }
    for (const z of [1.6]) { const bn = new THREE.Group(); mesh(bn, rbox(2, .12, .5, .04), M('#7a2a3a', { rough: .6 }), [0, .46, 0]); for (const s of [-1, 1]) mesh(bn, rbox(.1, .4, .45, .03), M('#5b3b25'), [s * .85, .2, 0]); ink(bn, .008); put(c, bn, [0, z], 0, 'bench'); seat(c, 'bench', bn, 0, z, 0, .52); }
    P(c, 'old-globe', { at: [R.x0 + 1.3, 3.6], spin: .15 }); P(c, 'potted_plant', { at: [R.x1 - .7, 4], kind: 'leafy', scale: 2 });
    if (c.o.skeleton !== false) { const sk2 = whaleSkeleton(c, 8); sk2.position.set(-.5, 3.4, -3); sk2.rotation.y = .25; S.scene.add(sk2); c.props.skeleton = sk2; chain(sk2, t => { sk2.rotation.z = .015 * Math.sin(t * .3); }); }
    W(c, 'door', 'front', 3.2, .002, { color: '#5b3b25', h: 2.6, w: 1.2 }); W(c, 'cctv_camera', 'front', -4.8, 0, { h: 4.5, sweep: true });
    if (night) { lamp(c, [0, 2.5, -1.5], '#9ab8ff', 2.5, 9); }
    if (c.mood === 'alarm') { beacon(c, [-4.5, 5.6, R.zb + .1]); beacon(c, [4.5, 5.6, R.zb + .1]); }
    fx(c, 'dust', { at: [0, 2.5, -3], area: [5, 3.5, 6], count: 50, intensity: .5 });
    spot(c, 'hall', 0, -1.0, 0); spot(c, 'statue', .9, -5.4, -.3); spot(c, 'case', -1.6, -2.6, .6); spot(c, 'bench', 0, 2.3, PI);
    cam(c, 'hall', [0, 2.0, -1.2], 6.5, 6, 6, 55, { spot: 'hall', note: 'down the hall: skeleton, cases, the statue at the end' });
    cam(c, 'case', [-2.2, 1.3, -3.2], 2.6, 30, 10, 45, { spot: 'case' });
    cam(c, 'statue', [.4, 2.2, -6.6], 5, 10, -2, 50, { spot: 'statue' });
    cam(c, 'skeleton', [-.5, 3.2, -3], 7, 20, -12, 55, { spot: 'hall', note: 'looking up at the skeleton' });
  });

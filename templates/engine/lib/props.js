// PROP KIT for the pixel engine (v10 "Hi-Bit", also draws in the legacy 16-colour look): procedural props at REAL scale
// (1 unit = 1 metre), built from boxes / extrusions / low-segment cylinders with RAMP names, so they shade in 3 or 5 steps.
//   import { smartphone, sedan, place, onTop, arrange, PROPS } from '../lib/props.js';
//   const desk = place(desk(), 0, 0); const pc = onTop(laptop({ open: true, screen: 'img_a' }), desk, { dx: -.2 });
// PROP CONTRACT (every factory): returns ONE THREE.Group, origin at the centre of its footprint, lowest point at y = 0,
// FRONT = +Z (screens, faces, doors, drawers look at +Z). Vehicles drive along +X (nose at +X, their side faces +Z).
//   userData = { name, kind, size: [w, h, d] (metres, the real bounding box), solid, rest, top? (height of the surface
//   things stand on: desk, plinth, conveyor), label? (diagram blocks: drawn on the HUD by the scene) } + animation handles.
// Every factory takes an options object; common options: ramp (main colour ramp name), scale (uniform: a chip at 20x for a
// diagram shot - size/top are scaled too), screen (an image key loaded in project.json "images" -> imageMat; else a
// procedural screen: 'game' | 'code' | 'boot' | 'desktop' | 'off' | any colour name).
// Small things (chips, RAM, SSD, a phone lying flat) are tiny at real scale: the camera near plane is 0.1 m and depth
// outlines start at 35 cm, so show them big with { scale: 10..100 } (or put the camera >= 0.25 m away).
// Animation helpers: spinFan(obj, t), flashLights(car, t), blinkLeds(rack, t), runConveyor(belt, t), setBars(chart, k),
// growArrow(arrow, k), pathAt(pipeOrPoints, k), setTrafficLight(light, state). Placement: place, onTop, arrange.
import * as E from '../engine.js';
const { THREE, RAMP, C, facet, GEO } = E;

// ---------- colours ----------
const LEGACY = { skin: 'sand', skinDark: 'red', hair: 'black', brown: 'plum', wood: 'sand', asphalt: 'black', concrete: 'grey', glass: 'sky',
  gold: 'yellow', purple: 'plum', pink: 'red', denim: 'blue', olive: 'green', neonPink: 'red', neonCyan: 'cyan', paper: 'white', rubber: 'black',
  metal: 'stone', carbon: 'black', yellowFlat: 'yellow', limeFlat: 'lime', orangeFlat: 'orange', cyanFlat: 'cyan' };
/** ramp array for a ramp name (or an array passed through); unknown names fall back to a legacy look-alike, then grey */
export const R = n => Array.isArray(n) ? n : RAMP[n] || RAMP[LEGACY[n]] || RAMP.grey;
const topCol = n => { const a = R(n); return a[a.length - 1]; };
const GLOW_LEGACY = { neonPink: 'red', neonCyan: 'cyan', gold: 'yellow', glass: 'cyan', paper: 'white', metal: 'silver', purple: 'plum', pink: 'red', amber: 'orange' };
const GLOW_ALIAS = { neonCyan: ['neon', 'cyan'], neonPink: ['magenta', 'red'], gold: ['gold', 'yellow'], purple: ['lavender', 'plum'], pink: ['pink', 'red'] };
const GM = new Map();
/** emissive (unlit) material: a C key ('red', 'cyan', 'yellow', Hi-Bit extras like 'magenta') = that exact colour,
 *  else a ramp name = its top colour. Screens, LEDs, lamps, lit windows, neon. */
export function glow(key) {
  let m = GM.get(key); if (m) return m;
  const alias = GLOW_ALIAS[key]?.find(k => C[k]);                    // neon ramps' top step is near white: glow their saturated colour
  const col = alias ? C[alias] : C[key] ?? (!RAMP[key] && GLOW_LEGACY[key] ? C[GLOW_LEGACY[key]] : null);
  m = col ? facet([col, col, col], { unlit: true }) : facet(R(key), { unlit: true });
  GM.set(key, m); return m;
}
/** material from a spec: a Material, '!name' = glow(name), else a lit facet of ramp `name` */
export function M(spec) {
  if (spec && spec.isMaterial) return spec;
  if (typeof spec === 'string' && spec[0] === '!') return glow(spec.slice(1));
  return facet(R(spec));
}
const MT = (spec, opacity) => facet(R(spec), { opacity, side: THREE.DoubleSide });   // dithered see-through (glass panes, light cones)

// ---------- geometry helpers ----------
const GG = new Map();
const geo = (k, f) => { let g = GG.get(k); if (!g) { g = f(); GG.set(k, g); } return g; };
const flatN = g => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
const V3 = p => p && p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]);
const UP = new THREE.Vector3(0, 1, 0);
const r4 = v => Math.round(v * 1e5) / 1e5;
/** box centred at (x, y, z) */
function bx(g, w, h, d, spec, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(GEO.box, M(spec)); m.scale.set(w, h, d); m.position.set(x, y, z); g.add(m); return m; }
/** box standing on y0 */
const bb = (g, w, h, d, spec, x, y0, z) => bx(g, w, h, d, spec, x, y0 + h / 2, z);
const cylGeo = (rt, rb, h, seg) => geo(`c${r4(rt)},${r4(rb)},${r4(h)},${seg}`, () => flatN(new THREE.CylinderGeometry(rt, rb, h, seg)));
/** cylinder centred at (x, y, z) along axis 'y' | 'x' | 'z' (o.top = top radius for a cone-ish frustum) */
function cy(g, r, h, spec, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(cylGeo(o.top ?? r, r, h, o.seg ?? 10), M(spec)); m.position.set(x, y, z);
  if (o.axis === 'x') m.rotation.z = Math.PI / 2; else if (o.axis === 'z') m.rotation.x = Math.PI / 2;
  if (o.rot) m.rotation.y += o.rot;
  g.add(m); return m;
}
/** cylinder from point a to point b (radius r at a, r2 at b) */
function tube(g, a, b, r, spec, o = {}) {
  const A = V3(a), B = V3(b), d = B.clone().sub(A), L = d.length();
  const m = new THREE.Mesh(cylGeo(o.r2 ?? r, r, L, o.seg ?? 8), M(spec));
  m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); g.add(m); return m;
}
/** square rod (box) from a to b, thickness t (and t2 across) */
function rod(g, a, b, t, spec, t2 = t) {
  const A = V3(a), B = V3(b), d = B.clone().sub(A), L = d.length();
  const m = new THREE.Mesh(GEO.box, M(spec)); m.scale.set(t, L, t2);
  m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); g.add(m); return m;
}
/** rounded-rectangle outline (centred), corners stepped with `steps` segments; r = one radius or [tr, tl, bl, br] */
function rrect(w, h, r, steps = 2) {
  const rs = Array.isArray(r) ? r : [r, r, r, r], pts = [];
  const cs = [[w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2], [w / 2, -h / 2]];
  cs.forEach(([px, py], q) => {
    const rr = Math.min(rs[q], w / 2 - 1e-5, h / 2 - 1e-5);
    if (rr <= 1e-6) { pts.push([px, py]); return; }
    const cx = px - Math.sign(px) * rr, cyy = py - Math.sign(py) * rr;
    for (let i = 0; i <= steps; i++) { const a = (q + i / steps) * Math.PI / 2; pts.push([cx + Math.cos(a) * rr, cyy + Math.sin(a) * rr]); }
  });
  return pts;
}
/** extrusion of a 2D outline: plane 'xy' (outline x,y; depth along z), 'zy' (outline z,y; depth along x), 'xz' (plan x,z; height along y); centred on its depth */
function ex(g, pts, depth, spec, o = {}) {
  const plane = o.plane || 'xy';
  const gm = geo('e' + plane + r4(depth) + pts.map(p => r4(p[0]) + ',' + r4(p[1])).join(';'), () => {
    const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
    const e = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 }); e.translate(0, 0, -depth / 2);
    if (plane === 'zy') e.rotateY(-Math.PI / 2); else if (plane === 'xz') e.rotateX(Math.PI / 2);
    return flatN(e);
  });
  const m = new THREE.Mesh(gm, M(spec)); m.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0); g.add(m); return m;
}
/** rounded slab facing +Z: w x h outline, d thick, centred at (x, y, z) */
const rslab = (g, w, h, d, r, spec, x, y, z, steps = 2) => ex(g, rrect(w, h, r, steps), d, spec, { x, y, z });
/** rounded plate lying flat: w (x) x d (z) outline, h tall, standing on y0 */
const rplate = (g, w, h, d, r, spec, x, y0, z, steps = 2) => ex(g, rrect(w, d, r, steps), h, spec, { plane: 'xz', x, y: y0 + h / 2, z });
/** many boxes in one draw: list of [w, h, d, x, y, z, rotY?] */
function ib(g, list, spec) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(GEO.box, M(spec), list.length), Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), Eu = new THREE.Euler();
  list.forEach(([w, h, d, x, y, z, ry = 0], i) => im.setMatrixAt(i, Mx.compose(new THREE.Vector3(x, y, z), Q.setFromEuler(Eu.set(0, ry, 0)), new THREE.Vector3(w, h, d))));
  im.instanceMatrix.needsUpdate = true; g.add(im); return im;
}
const torGeo = (R0, r, rs, ts) => geo(`t${r4(R0)},${r4(r)},${rs},${ts}`, () => flatN(new THREE.TorusGeometry(R0, r, rs, ts)));
/** ring facing +Z (a torus) centred at (x, y, z) */
function ring(g, R0, r, spec, x, y, z, o = {}) { const m = new THREE.Mesh(torGeo(R0, r, o.rs ?? 4, o.ts ?? 16), M(spec)); m.position.set(x, y, z); if (o.axis === 'y') m.rotation.x = Math.PI / 2; if (o.axis === 'x') m.rotation.y = Math.PI / 2; g.add(m); return m; }
/** merge every plain mesh under `src` into one mesh per material (fewer draw calls for leafy / many-part pieces) */
export function bake(src) {
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert(), by = new Map(), out = new THREE.Group();
  src.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const gm = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(gm);
  });
  for (const [mat, list] of by) {
    let n = 0; for (const gm of list) n += gm.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let k = 0;
    for (const gm of list) { pos.set(gm.attributes.position.array, k * 3); nor.set(gm.attributes.normal.array, k * 3); k += gm.attributes.position.count; gm.dispose(); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.add(new THREE.Mesh(bg, mat));
  }
  return out;
}

// ---------- screens ----------
/** a screen face facing +Z whose back sits on plane z (w x h centred at x, y). Image key -> imageMat, else procedural. Returns its front z. */
function screenFace(g, w, h, kind = 'game', x = 0, y = 0, z = 0) {
  const e = Math.max(.0003, Math.min(w, h) * .004);
  if (typeof kind === 'string' && E.IMG && E.IMG[kind] && E.imageMat) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), E.imageMat(kind)); p.position.set(x, y, z + e); p.userData.screen = kind; g.add(p);
    bx(g, w, h, e * .5, '!bg', x, y, z + e * .25);                          // (a dark backing: the plane alone has no outline)
    return z + e;
  }
  const L = (fw, fh, fx, fy, spec, k = 1) => bx(g, w * fw, h * fh, e, spec, x + w * fx, y + h * fy, z + e * (k - .5));
  switch (kind) {
    case 'off': L(1, 1, 0, 0, 'carbon'); return z + e;
    case 'code': L(1, 1, 0, 0, '!bg');
      [[.5, '!lime'], [.3, '!sky'], [.62, '!yellow'], [.42, '!white'], [.25, '!orange'], [.55, '!sky'], [.35, '!lime']].forEach(([lw, c], i) =>
        L(lw, .055, -.42 + lw / 2 + (i % 3 === 1 ? .06 : 0), .38 - i * .12, c, 2));
      return z + 2 * e;
    case 'boot': L(1, 1, 0, 0, '!bg'); L(.5, .07, 0, -.2, '!dark', 2); L(.3, .07, -.1, -.2, '!lime', 3); L(.14, .14 * w / h * (h / w), 0, .12, '!white', 2); return z + 3 * e;
    case 'desktop': L(1, 1, 0, 0, '!blue'); L(.55, .55, -.12, .08, '!white', 2); L(.55, .1, -.12, .3, '!sky', 3); L(1, .08, 0, -.46, '!navy', 2); return z + 3 * e;
    case 'game': L(1, .62, 0, .19, '!sky'); L(1, .38, 0, -.31, '!green'); L(.34, .38, .05, -.31, '!dark', 2); L(.02, .3, .05, -.33, '!yellow', 3);
      L(.11, .11 * w / h, .3, .3, '!yellow', 2); L(.14, .08, -.25, .02, '!navy', 2); L(.1, .14, -.32, .08, '!navy', 2); L(.12, .1, .08, -.38, '!red', 4); return z + 4 * e;
    default: L(1, 1, 0, 0, C[kind] || RAMP[kind] ? '!' + kind : '!navy'); return z + e;   // a colour name, else (an image not loaded) a dark lit screen
  }
}

// ---------- finishing ----------
const _box = new THREE.Box3();
const r3 = v => Math.round(v * 1e4) / 1e4;
/** wraps the content group b into g: recentre (footprint centre, bottom y = 0) unless keepOrigin, apply o.scale, write userData */
function fin(g, b, name, o = {}, x = {}) {
  g.updateMatrixWorld(true); _box.makeEmpty(); _box.expandByObject(b);
  if (!x.keepOrigin) { b.position.x -= (_box.min.x + _box.max.x) / 2; b.position.y -= _box.min.y; b.position.z -= (_box.min.z + _box.max.z) / 2; }
  const s = o.scale ?? 1;
  if (s !== 1) { b.scale.multiplyScalar(s); b.position.multiplyScalar(s); }
  const size = [_box.max.x - _box.min.x, _box.max.y - _box.min.y, _box.max.z - _box.min.z].map(v => r3(v * s));
  Object.assign(g.userData, { name, kind: name, size, solid: x.solid ?? true, rest: x.rest ?? true }, x.top != null ? { top: r3(x.top * s) } : {}, x.data || {});
  if (x.over) g.userData.over = x.over;
  // tall things with a crown / arm over the street (palms, street lights): only the trunk / pole is solid, so a car under a crown is no overlap
  if (x.solidPart) { g.userData.solid = false; g.userData.rest = false; Object.assign(x.solidPart.userData, { name: `${name} ${x.partName}`, solid: true, rest: true }); g.userData.solidPart = x.solidPart; }
  return g;
}
const kit = () => { const g = new THREE.Group(), b = new THREE.Group(); g.add(b); return [g, b]; };

// =====================================================================================================================
// DEVICES
// =====================================================================================================================
// a slab device (phone / tablet), upright, screen facing +Z, standing on its bottom edge (lying: true = screen up)
function slate(name, o, P) {
  const [g, b] = kit(), { screen = 'game', ramp = 'black', lying = false } = o, body = o.case || ramp;
  const { W, H, D, r, bez } = P;
  rslab(b, W, H, D, r, body, 0, H / 2, 0, 3);                                       // body
  rslab(b, W - .003, H - .003, .0006, r * .8, 'carbon', 0, H / 2, D / 2 + .0003, 3);    // front glass (black)
  const fz = screenFace(b, W - bez * 2, H - bez * 2 - P.chin, screen, 0, H / 2 + P.chin / 2, D / 2 + .0006);
  if (P.punch) cy(b, .0022, .0006, 'carbon', 0, H - bez - .006, fz + .0003, { axis: 'z', seg: 8 });
  // camera bump on the back (-Z)
  const { bw, bh, bxp, byp, lenses } = P.bump;
  rslab(b, bw, bh, .0016, Math.min(bw, bh) * .22, body, bxp, byp, -D / 2 - .0008, 2);
  for (const [lx, ly, lr] of lenses) { cy(b, lr, .0012, 'carbon', bxp + lx, byp + ly, -D / 2 - .0022, { axis: 'z', seg: 10 }); cy(b, lr * .55, .0006, 'glass', bxp + lx, byp + ly, -D / 2 - .0031, { axis: 'z', seg: 8 }); }
  if (P.flash) bx(b, .004, .004, .0008, '!white', bxp + P.flash[0], byp + P.flash[1], -D / 2 - .002);
  // side buttons
  bx(b, .0012, H * .1, D * .45, body, W / 2 + .0004, H * .64, 0);
  bx(b, .0012, H * .18, D * .45, body, -W / 2 - .0004, H * .66, 0);
  P.extra?.(b, { W, H, D, body });
  if (lying) { b.rotation.x = -Math.PI / 2; }
  return fin(g, b, name, o, { data: { screenKey: screen } });
}
/** smartphone({ screen: 'game'|'code'|imageKey, ramp: 'black', case: ramp, lying: false }) - 7.5 x 16 x 0.8 cm */
export function smartphone(o = {}) {
  return slate('smartphone', o, { W: .075, H: .16, D: .008, r: .009, bez: .0045, chin: .001, punch: true,
    bump: { bw: .032, bh: .036, bxp: -.075 / 2 + .021, byp: .16 - .023, lenses: [[-.007, .008, .0052], [.007, .008, .0052], [-.007, -.008, .0052]] }, flash: [.007, -.008] });
}
/** tablet({ screen, ramp: 'metal', lying }) - 25 x 17.5 cm, landscape */
export function tablet(o = {}) {
  return slate('tablet', { ramp: 'metal', ...o }, { W: .25, H: .175, D: .0065, r: .013, bez: .009, chin: 0, punch: false,
    bump: { bw: .018, bh: .018, bxp: -.25 / 2 + .016, byp: .175 - .016, lenses: [[0, 0, .005]] } });
}
/** gamingPhone({ screen, ramp: 'black', accent: 'neonCyan' (RGB strip / triggers), lying }) - vents, RGB strip, shoulder triggers */
export function gamingPhone(o = {}) {
  const accent = o.accent || 'neonCyan';
  return slate('gaming phone', o, { W: .078, H: .17, D: .0105, r: .006, bez: .004, chin: 0, punch: false,
    bump: { bw: .03, bh: .03, bxp: -.078 / 2 + .02, byp: .17 - .022, lenses: [[-.006, .006, .005], [.006, -.006, .005]] }, flash: [.006, .006],
    extra(b, { W, H, D }) {
      for (let i = 0; i < 6; i++) bx(b, .028, .0016, .0008, 'carbon', .012, H * .62 - i * .0042, -D / 2 - .0004);       // vents
      bx(b, .003, H * .42, .0008, '!' + accent, -.004, H * .34, -D / 2 - .0004);                                       // RGB strip
      bx(b, .012, .012, .0008, '!' + accent, .012, H * .3, -D / 2 - .0004);                                            // light logo
      for (const yy of [.2, .8]) bx(b, .0016, .018, D * .7, accent, W / 2 + .0008, H * yy, 0);                         // shoulder triggers
    } });
}
/** laptop({ open: true, angle: 0.28 (lid lean back, rad), screen: 'code', ramp: 'metal' }) - 32 x 22 cm */
export function laptop(o = {}) {
  const [g, b] = kit(), { open = true, angle = .28, screen = 'code', ramp = 'metal' } = o;
  const W = .32, D = .22, Hb = .016, L = .21, T = .007;
  rplate(b, W, Hb, D, .012, ramp, 0, 0, 0);
  const keys = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 13; c++) keys.push([.0165, .0016, .0155, -.117 + c * .0195, Hb + .0008, -.088 + r * .019]);
  keys.push([.1, .0016, .0155, 0, Hb + .0008, -.088 + 5 * .019]);
  ib(b, keys, 'carbon');
  bx(b, .105, .0008, .062, R(ramp).length > 3 ? 'concrete' : 'grey', 0, Hb + .0004, D / 2 - .04);                     // trackpad
  const lid = new THREE.Group(); lid.position.set(0, Hb + (open ? 0 : .002), -D / 2 + .005); b.add(lid);
  rslab(lid, W, L, T, .012, ramp, 0, L / 2, -T / 2, 2);
  rslab(lid, W - .01, L - .01, .0008, .008, 'carbon', 0, L / 2, .0004, 2);
  screenFace(lid, W - .026, L - .03, screen, 0, L / 2 + .004, .0008);
  bx(lid, .003, .003, .0006, 'carbon', 0, L - .009, .0012);                                                          // webcam
  lid.rotation.x = open ? -angle : Math.PI / 2;
  return fin(g, b, 'laptop', o, { data: { lid } });
}
/** pcTower({ glass: true (open side window on +X), rgb: true, ramp: 'black', accent: 'neonCyan', pane: false }) - 21 x 46 x 45 cm */
export function pcTower(o = {}) {
  const [g, b] = kit(), { glass = true, rgb = true, ramp = 'black', accent = 'neonCyan', accent2 = 'neonPink' } = o;
  const W = .21, H = .46, D = .45, y0 = .015, fans = [];
  for (const x of [-1, 1]) for (const z of [-1, 1]) bb(b, .03, y0, .05, 'rubber', x * (W / 2 - .025), 0, z * (D / 2 - .04));
  bb(b, W - .002, .01, D - .022, ramp, 0, y0, -.011); bb(b, W - .002, .01, D - .022, ramp, 0, y0 + H - .01, -.011);     // floor / roof
  bb(b, W - .004, H - .02, .008, ramp, 0, y0 + .01, -D / 2 + .004);                                                   // back
  bb(b, .008, H - .02, D - .024, ramp, -W / 2 + .004, y0 + .01, -.012);                                               // left wall
  bb(b, W + .004, H + .002, .022, ramp, 0, y0 - .001, D / 2 - .011);                                                  // front panel (a bezel, a hair wider)
  bb(b, W - .04, H - .07, .002, 'carbon', 0, y0 + .035, D / 2 + .001);                                                // front mesh
  for (const yy of [.12, .25, .38]) {
    if (rgb) ring(b, .052, .004, '!' + accent, 0, y0 + yy, D / 2 + .0035, { ts: 16 });
    cy(b, .016, .002, rgb ? '!' + accent2 : 'dark', 0, y0 + yy, D / 2 + .003, { axis: 'z', seg: 8 });
  }
  cy(b, .007, .004, '!white', W / 2 - .03, y0 + H + .002, D / 2 - .03, { seg: 8 });                                    // power button
  if (glass) {                                                                                                         // window frame on +X
    bb(b, .008, .02, D - .022, ramp, W / 2 - .004, y0 + .01, -.011); bb(b, .008, .02, D - .022, ramp, W / 2 - .004, y0 + H - .03, -.011);
    bb(b, .008, H - .06, .02, ramp, W / 2 - .004, y0 + .03, D / 2 - .032); bb(b, .008, H - .06, .016, ramp, W / 2 - .004, y0 + .03, -D / 2 + .008);
    if (o.pane) bb(b, .002, H - .06, D - .06, null, W / 2 - .003, y0 + .03, 0).material = MT('glass', .3);
  } else {
    bb(b, .008, H - .02, D - .024, ramp, W / 2 - .004, y0 + .01, -.012);
    for (let i = 0; i < 8; i++) bb(b, .002, .006, .2, 'carbon', W / 2 + .001, y0 + .3 + i * .014, -.05);
  }
  // inside
  bb(b, .004, .3, .3, 'carbon', -W / 2 + .01, y0 + .13, -.02);                                                        // motherboard tray
  bb(b, W - .02, .11, D - .05, ramp, .002, y0 + .01, -.01);                                                            // PSU shroud
  bb(b, .1, .015, .2, 'carbon', -.03, y0 + .12 + .03, -.02);                                                           // GPU
  bb(b, .1, .03, .2, 'black', -.03, y0 + .165, -.02);
  if (rgb) bx(b, .002, .006, .18, '!' + accent2, .021, y0 + .18, -.02);
  bb(b, .08, .1, .055, 'metal', -.045, y0 + .27, -.03);                                                               // CPU cooler
  bb(b, .08, .1, .02, 'black', -.045, y0 + .27, .008);
  if (rgb) ring(b, .036, .003, '!' + accent, -.045, y0 + .32, .019, { ts: 12 });
  for (const zz of [-.1, -.115]) { bb(b, .035, .13, .006, 'black', -.075, y0 + .25, zz); if (rgb) bb(b, .004, .13, .007, '!' + accent2, -.056, y0 + .25, zz); }
  if (rgb) ring(b, .055, .004, '!' + accent, 0, y0 + .33, -D / 2 + .012, { ts: 16 });                                    // rear fan
  return fin(g, b, 'pc tower', o, { data: { fans } });
}
/** monitor({ screen: 'desktop', ramp: 'black', w: 0.62 }) - 27" on a stand */
export function monitor(o = {}) {
  const [g, b] = kit(), { screen = 'desktop', ramp = 'black' } = o, W = o.w ?? .62, H = W * .59;
  const yc = .13 + H / 2;
  rplate(b, .26, .012, .19, .03, ramp, 0, 0, -.03);
  bb(b, .05, yc - .02, .025, ramp, 0, .012, -.055);
  rslab(b, W * .62, H * .66, .035, .02, ramp, 0, yc, -.03, 2);
  rslab(b, W, H, .022, .006, ramp, 0, yc, 0, 1);
  screenFace(b, W - .016, H - .026, screen, 0, yc + .004, .011);
  bx(b, .006, .003, .002, '!lime', W / 2 - .02, yc - H / 2 + .006, .012);
  return fin(g, b, 'monitor', o);
}
/** crtTv({ screen: 'game', ramp: 'grey', antenna: false }) - a deep 20" tube TV */
export function crtTv(o = {}) {
  const [g, b] = kit(), { screen = 'game', ramp = 'grey', antenna = false } = o;
  for (const x of [-.18, .18]) for (const z of [-.05, .05]) bb(b, .04, .012, .04, 'rubber', x, 0, z);
  bb(b, .5, .42, .2, ramp, 0, .012, 0);
  bb(b, .4, .34, .14, ramp, 0, .05, -.17);
  bb(b, .26, .22, .1, ramp, 0, .1, -.28);
  rslab(b, .4, .3, .01, .03, 'carbon', 0, .28, .1 + .005, 2);
  rslab(b, .37, .27, .004, .028, 'carbon', 0, .28, .112, 2);
  screenFace(b, .34, .25, screen, 0, .28, .114);
  bb(b, .42, .06, .006, 'dark', 0, .04, .103);
  for (const x of [.13, .18]) cy(b, .014, .012, 'carbon', x, .07, .109, { axis: 'z', seg: 8 });
  bx(b, .008, .008, .004, '!red', -.17, .07, .107);
  for (let i = 0; i < 6; i++) bx(b, .002, .03, .006, 'carbon', -.05 + i * .012, .07, .104);
  if (antenna) { cy(b, .03, .02, 'black', 0, .442, -.05, { seg: 8 }); rod(b, [0, .45, -.05], [-.17, .78, -.08], .006, 'metal'); rod(b, [0, .45, -.05], [.17, .78, -.08], .006, 'metal'); }
  return fin(g, b, 'crt tv', o);
}
function fanRotor(parent, r, x, y, z, spec = 'grey', n = 9) {
  const rot = new THREE.Group(); rot.position.set(x, y, z); rot.userData.isFan = true; parent.add(rot);
  cy(rot, r * .36, r * .3, 'carbon', 0, 0, r * .05, { axis: 'z', seg: 10 });
  for (let i = 0; i < n; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI * 2 / n; rot.add(arm);
    const bl = bx(arm, r * .62, r * .26, r * .05, spec, r * .62, 0, 0); bl.rotation.x = .45; }
  return rot;
}
/** gpuCard({ fans: 2|3, ramp: 'black', accent: 'red' }) - a graphics card standing on its edge, fans facing +Z (28 x 12.5 x 4 cm) */
export function gpuCard(o = {}) {
  const [g, b] = kit(), { fans = 3, ramp = 'black', accent = 'red' } = o, L = .28, H = .12;
  const pads = []; for (let i = 0; i < 40; i++) pads.push([.0018, .008, .0024, -.08 + i * .003, .004, -.012]);
  ib(b, pads, 'gold');
  bb(b, L - .01, H - .008, .002, 'carbon', .005, .006, -.012);
  bb(b, L - .012, H - .01, .003, 'metal', .005, .008, -.0145);                                                        // backplate
  rslab(b, L - .016, H - .012, .026, .012, ramp, .006, .008 + (H - .012) / 2, .002, 2);                                // shroud
  bx(b, L - .05, .004, .0012, accent, .006, H - .006, .0156); bx(b, L - .05, .004, .0012, accent, .006, .014, .0156);
  const rot = [], n = fans === 2 ? 2 : 3, sp = (L - .04) / n;
  for (let i = 0; i < n; i++) {
    const x = .006 - (L - .04) / 2 + sp * (i + .5);
    ring(b, .043, .0035, 'dark', x, .068, .0158, { ts: 16 });
    rot.push(fanRotor(b, .04, x, .068, .016));
  }
  bb(b, .002, .125, .02, 'metal', -L / 2 + .009, 0, -.006); bx(b, .02, .002, .02, 'metal', -L / 2 + .019, .124, -.006);   // bracket
  bb(b, .03, .012, .008, 'carbon', .08, H - .004, -.012);
  return fin(g, b, 'gpu card', o, { data: { fans: rot } });
}
/** cpuChip({ pins: true }) - a desktop CPU (3.75 cm square): pins, green substrate, metal heat spreader, gold corner mark */
export function cpuChip(o = {}) {
  const [g, b] = kit(), S = .0375, p0 = o.pins === false ? 0 : .002, pins = [];
  if (p0) for (let i = 0; i < 14; i++) for (let j = 0; j < 14; j++) if (!(i > 4 && i < 9 && j > 4 && j < 9)) pins.push([.0007, p0, .0007, -S / 2 + .0025 + i * .00248, p0 / 2, -S / 2 + .0025 + j * .00248]);
  ib(b, pins, 'gold');
  bb(b, S, .0012, S, 'olive', 0, p0, 0);
  const smd = []; for (let i = 0; i < 6; i++) smd.push([.0012, .0006, .0007, -.012 + i * .0048, p0 + .0015, S / 2 - .0022]);
  ib(b, smd, 'metal');
  rplate(b, .032, .001, .032, .003, 'metal', 0, p0 + .0012, 0);
  rplate(b, .028, .0022, .028, .002, 'metal', 0, p0 + .0022, 0);
  const tri = bx(b, .0028, .0003, .0028, 'gold', -S / 2 + .0022, p0 + .00135, S / 2 - .0022); tri.rotation.y = Math.PI / 4;
  return fin(g, b, 'cpu chip', o);
}
/** socChip({ die: true }) - a phone system-on-chip (1.4 cm). die: coloured blocks (userData.blocks: cpu, little, gpu, npu, modem, cache,
 *  each { mesh, label, at: local [x, y, z] } for HUD tags / highlights); die: false = the closed package */
export function socChip(o = {}) {
  const [g, b] = kit(), u = .001, blocks = {};
  bb(b, .014, .0008, .014, 'carbon', 0, 0, 0);
  const balls = []; for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) balls.push([.0005, .0003, .0005, -.0066 + i * .0012, -.00015, -.0066 + j * .0012]);
  ib(b, balls, 'metal');
  if (o.die === false) {
    rplate(b, .0124, .0004, .0124, .0006, 'metal', 0, .0008, 0);
    bx(b, .004, .0001, .0008, 'dark', -.003, .00125, .004);
    return fin(g, b, 'soc chip', o);
  }
  bb(b, .0124, .0004, .0124, 'dark', 0, .0008, 0);
  const y = .0012, T = (name, label, x0, x1, z0, z1, ramp, sub) => {
    const m = bb(b, (x1 - x0) * u, .0003, (z1 - z0) * u, ramp, (x0 + x1) / 2 * u, y, (z0 + z1) / 2 * u);
    blocks[name] = { mesh: m, label, at: [(x0 + x1) / 2 * u, y + .0003, (z0 + z1) / 2 * u] };
    if (sub) { const [nx, nz, sr] = sub, list = [], w = (x1 - x0) / nx, d = (z1 - z0) / nz;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) list.push([(w - .35) * u, .0001, (d - .35) * u, (x0 + w * (i + .5)) * u, y + .00035, (z0 + d * (j + .5)) * u]);
      ib(b, list, sr); }
  };
  T('cpu', 'CPU', -5.6, -.9, -5.6, -1.4, 'orange', [2, 2, 'orangeFlat']);
  T('little', 'Efficiency cores', -5.6, -.9, -1, 1.6, 'yellow', [4, 1, 'yellowFlat']);
  T('cache', 'Cache', -5.6, -.9, 2, 5.6, 'cyan');
  T('gpu', 'GPU', -.5, 5.6, -5.6, .4, 'lime', [3, 2, 'green']);
  T('npu', 'NPU', -.5, 2.6, .8, 5.6, 'purple');
  T('modem', 'Modem', 3, 5.6, .8, 5.6, 'blue');
  return fin(g, b, 'soc chip', o, { data: { blocks } });
}
/** ramStick({ ramp: 'green', heatsink: false, rgb: false }) - a DDR desktop module standing on its contacts (13.3 x 3.1 cm) */
export function ramStick(o = {}) {
  const [g, b] = kit(), { ramp = 'green', heatsink = false, rgb = false } = o, L = .133;
  bb(b, L, .027, .0012, ramp, 0, .004, 0);
  bb(b, L / 2 - .011, .004, .0012, ramp, -L / 4 - .0055 - .005, 0, 0); bb(b, L / 2 + .009, .004, .0012, ramp, L / 4 - .0045 - .005, 0, 0);
  const pads = []; for (let i = 0; i < 96; i++) { const x = -L / 2 + .003 + i * .00134; if (Math.abs(x + .01) < .0015) continue; for (const z of [-1, 1]) pads.push([.0009, .0034, .0003, x, .002, z * .00075]); }
  ib(b, pads, 'gold');
  if (heatsink) {
    for (const z of [-1, 1]) bb(b, L - .002, .028, .0014, 'metal', 0, .006, z * .0014);
    bb(b, L - .002, .004, .0042, 'black', 0, .031, 0);
    if (rgb) bb(b, L - .01, .002, .003, '!' + (rgb === true ? 'neonCyan' : rgb), 0, .035, 0);
  } else {
    const chips = []; for (let i = 0; i < 8; i++) for (const z of [-1, 1]) chips.push([.0095, .0095, .0008, -L / 2 + .011 + i * .0158, .0175, z * .001]);
    ib(b, chips, 'carbon');
    bx(b, .004, .002, .0013, 'metal', 0, .0075, .0004);
  }
  return fin(g, b, 'ram stick', o);
}
/** ssd({ type: 'm2' | '2.5', ramp: 'green', sticker: false }) - an M.2 2280 stick lying flat (8 x 2.2 cm) or a 2.5" drive */
export function ssd(o = {}) {
  const [g, b] = kit(), { type = 'm2', ramp = 'teal' } = o;
  if (type === '2.5') {
    rplate(b, .07, .007, .1, .002, 'black', 0, 0, 0);
    bb(b, .062, .0004, .07, 'paper', 0, .007, .008); bb(b, .05, .0002, .012, 'red', 0, .0074, .03);
    bb(b, .024, .004, .004, 'carbon', -.012, .0015, -.051);
    return fin(g, b, 'ssd', o);
  }
  bb(b, .08, .0008, .022, ramp, 0, 0, 0);
  bb(b, .009, .0012, .009, 'carbon', -.025, .0008, 0); bb(b, .006, .001, .008, 'carbon', -.013, .0008, 0);
  bb(b, .014, .0012, .014, 'carbon', .004, .0008, 0); bb(b, .014, .0012, .014, 'carbon', .021, .0008, 0);
  if (o.sticker) { bb(b, .056, .0002, .018, 'paper', -.004, .002, 0); bb(b, .02, .0001, .004, 'black', -.016, .0022, .004); }
  const pads = []; for (let i = 0; i < 15; i++) { const z = -.0095 + i * .00136; if (Math.abs(z - .004) < .0012) continue; pads.push([.0035, .0002, .0009, .0378, .0009, z]); }
  ib(b, pads, 'gold');
  bb(b, .003, .0002, .004, 'gold', -.0385, .0008, 0);
  return fin(g, b, 'ssd', o);
}
/** hdd({ open: false }) - a 3.5" hard drive lying flat; open shows the platter, arm and magnet (userData.platter, .arm to animate) */
export function hdd(o = {}) {
  const [g, b] = kit(), W = .1016, Lz = .147;
  bb(b, .095, .002, .1, 'olive', 0, 0, -.015);
  bb(b, W, .02, Lz, 'metal', 0, .002, 0);
  bb(b, .04, .008, .005, 'carbon', -.02, .006, -Lz / 2 - .002);
  let platter = null, arm = null;
  if (o.open) {
    bb(b, W - .008, .0006, Lz - .008, 'concrete', 0, .022, 0);
    platter = cy(b, .0475, .002, 'paper', 0, .0236, .022, { seg: 24 });
    cy(b, .012, .004, 'metal', 0, .0256, .022, { seg: 12 });
    arm = new THREE.Group(); arm.position.set(.034, .0236, -.048); b.add(arm);
    cy(arm, .008, .006, 'metal', 0, .002, 0, { seg: 10 });
    const a = rod(arm, [0, .0035, 0], [-.04, .0035, .065], .006, 'metal', .0015); a.userData.keep = true;
    bx(arm, .004, .002, .006, 'carbon', -.04, .0026, .066);
    bb(b, .028, .006, .024, 'dark', .03, .0226, -.064);
  } else {
    rplate(b, W - .002, .003, Lz - .002, .004, 'metal', 0, .022, 0);
    cy(b, .048, .0015, 'metal', 0, .0255, .022, { seg: 24 });
    bb(b, .06, .0004, .06, 'paper', 0, .0262, -.035); bb(b, .04, .0002, .008, 'black', 0, .0266, -.025);
    for (const [x, z] of [[-.046, -.068], [.046, -.068], [-.046, .068], [.046, .068], [-.046, 0], [.046, 0]]) cy(b, .0025, .001, 'grey', x, .0255, z, { seg: 6 });
  }
  return fin(g, b, 'hdd', o, { data: { platter, arm } });
}
/** motherboard({ ramp: 'green' (PCB), chip: true (a CPU in the socket) }) - ATX board lying flat (30.5 x 24.4 cm), traces, slots, caps */
export function motherboard(o = {}) {
  const [g, b] = kit(), { ramp = 'teal' } = o, y = .0016;
  bb(b, .305, y, .244, ramp, 0, 0, 0);
  const tr = [], rr = E.rng(7);
  for (let i = 0; i < 28; i++) { const len = .03 + rr() * .09;
    if (i % 2) tr.push([len, .0002, .0008, -.14 + rr() * (.28 - len) + len / 2, y + .0001, -.11 + rr() * .22]);
    else tr.push([.0008, .0002, len, -.14 + rr() * .28, y + .0001, -.11 + rr() * (.22 - len) + len / 2]); }
  ib(b, tr, 'gold');
  bb(b, .03, .045, .16, 'carbon', -.135, y, -.03);                                                                     // I/O shroud
  bb(b, .06, .006, .06, 'metal', -.035, y, -.045); bb(b, .045, .002, .045, 'carbon', -.035, y + .006, -.045);            // socket
  if (o.chip !== false) bb(b, .037, .004, .037, 'metal', -.035, y + .006, -.045);
  bb(b, .014, .028, .07, 'black', -.087, y, -.045); bb(b, .07, .028, .014, 'black', -.04, y, -.098);                       // VRM heatsinks
  for (let i = 0; i < 4; i++) bb(b, .006, .009, .135, i % 2 ? 'black' : 'grey', .03 + i * .011, y, -.045);              // RAM slots
  bb(b, .008, .012, .052, 'paper', .143, y, -.035);                                                                     // 24-pin
  for (const zz of [.035, .085]) bb(b, .09, .011, .009, 'black', -.06, y, zz);                                          // PCIe
  bb(b, .045, .008, .045, 'metal', .07, y, .065);                                                                       // chipset
  bb(b, .07, .004, .024, 'black', -.05, y, .06);                                                                        // M.2 cover
  for (let i = 0; i < 8; i++) cy(b, .0035, .009, i % 2 ? 'metal' : 'black', -.075 + (i % 4) * .012, y + .0045, -.005 - Math.floor(i / 4) * .012, { seg: 8 });
  bx(b, .004, .002, .004, '!lime', .12, y + .001, .1);
  return fin(g, b, 'motherboard', o);
}
/** controller({ ramp: 'black' | 'white' }) - a gamepad lying flat, front (player side) = +Z: sticks, d-pad, 4 face buttons, bumpers */
export function controller(o = {}) {
  const [g, b] = kit(), { ramp = 'black' } = o;
  const plan = [[-.06, -.045], [.06, -.045], [.075, -.035], [.079, 0], [.071, .04], [.06, .058], [.045, .06], [.03, .036], [-.03, .036], [-.045, .06], [-.06, .058], [-.071, .04], [-.079, 0], [-.075, -.035]];
  ex(b, plan, .028, ramp, { plane: 'xz', y: .022 });
  ex(b, [[-.05, -.04], [.05, -.04], [.06, -.02], [.055, .02], [.035, .03], [-.035, .03], [-.055, .02], [-.06, -.02]], .01, ramp, { plane: 'xz', y: .041 });
  for (const s of [-1, 1]) bb(b, .03, .016, .038, ramp, s * .058, 0, .036);
  const T = .046;
  for (const [x, z] of [[-.036, -.014], [.018, .014]]) { cy(b, .006, .006, 'carbon', x, T + .003, z, { seg: 8 }); cy(b, .011, .005, 'dark', x, T + .0085, z, { seg: 10 }); }
  bb(b, .017, .004, .0055, 'carbon', -.018, T, .014); bb(b, .0055, .004, .017, 'carbon', -.018, T, .014);
  for (const [dx, dz, c] of [[0, -.008, '!yellow'], [.008, 0, '!red'], [0, .008, '!lime'], [-.008, 0, '!sky']]) cy(b, .0036, .004, c, .037 + dx, T + .002, -.014 + dz, { seg: 8 });
  cy(b, .006, .002, '!white', 0, T + .001, -.026, { seg: 10 });
  for (const s of [-1, 1]) bb(b, .034, .008, .012, 'dark', s * .046, .028, -.046);
  return fin(g, b, 'controller', o);
}
/** heatsinkFan({ spin: 1.5 (turns/s for spinFan), rgb: false }) - a tower CPU cooler: copper pipes, fin stack, front fan */
export function heatsinkFan(o = {}) {
  const [g, b] = kit(), fins = [];
  bb(b, .04, .006, .04, 'metal', 0, 0, 0);
  for (const x of [-.014, -.005, .005, .014]) cy(b, .003, .15, 'orange', x, .081, 0, { seg: 6 });
  for (let i = 0; i < 30; i++) fins.push([.12, .0012, .1, 0, .032 + i * .004, 0]);
  ib(b, fins, 'metal');
  bb(b, .122, .006, .102, 'black', 0, .15, 0);
  const fz = .05 + .0125;
  bb(b, .12, .01, .025, 'black', 0, .03, fz); bb(b, .12, .01, .025, 'black', 0, .14, fz);
  bb(b, .01, .1, .025, 'black', -.055, .04, fz); bb(b, .01, .1, .025, 'black', .055, .04, fz);
  const rot = fanRotor(b, .05, 0, .09, fz - .002, 'dark', 7);
  if (o.rgb) ring(b, .052, .002, '!' + (o.rgb === true ? 'neonCyan' : o.rgb), 0, .09, fz + .013, { ts: 16 });
  return fin(g, b, 'heatsink fan', o, { data: { fans: [rot], spin: o.spin ?? 1.5 } });
}
/** cable(points [[x,y,z]...] in the parent's coordinates, { ramp: 'black', r: 0.004, plugs: true }) - a smooth cable through the points */
export function cable(points, o = {}) {
  const [g, b] = kit(), r = o.r ?? .004, pts = points.map(V3);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const m = new THREE.Mesh(flatN(new THREE.TubeGeometry(curve, Math.max(12, pts.length * 10), r, 5, false)), M(o.ramp || 'black')); b.add(m);
  if (o.plugs !== false) for (const k of [0, 1]) { const p = curve.getPointAt(k), t = curve.getTangentAt(k); const pl = bx(b, r * 3, r * 6, r * 3, 'dark', p.x, p.y, p.z); pl.quaternion.setFromUnitVectors(UP, t); }
  return fin(g, b, 'cable', o, { keepOrigin: true, solid: false, rest: false, over: true, data: { curve } });
}

// =====================================================================================================================
// CONSOLES (recognisable silhouettes, no logos or text)
// =====================================================================================================================
/** ps3() - the original 'fat' console lying flat: stepped convex top, slot, ports (32.5 x 9.8 x 27.4 cm) */
export function ps3(o = {}) {
  const [g, b] = kit(), ramp = o.ramp || 'black';
  bb(b, .325, .046, .274, ramp, 0, .004, 0);
  bb(b, .318, .02, .27, ramp, 0, .05, 0); bb(b, .29, .016, .266, ramp, 0, .07, 0); bb(b, .24, .012, .262, ramp, 0, .086, 0);
  for (const x of [-.13, .13]) for (const z of [-.1, .1]) bb(b, .03, .004, .03, 'rubber', x, 0, z);
  bb(b, .325 - .004, .006, .0016, 'metal', 0, .044, .1375);
  bb(b, .15, .004, .002, 'carbon', -.02, .062, .1356);
  for (let i = 0; i < 4; i++) bb(b, .012, .006, .002, 'carbon', -.14 + i * .016, .018, .1378);
  bb(b, .01, .01, .002, 'metal', .13, .02, .1378); bb(b, .01, .01, .002, 'metal', .145, .02, .1378);
  bx(b, .004, .004, .0015, '!lime', .155, .033, .1378);
  return fin(g, b, 'ps3', o);
}
/** ps4() - the slanted two-slab console lying flat, light bar along the top (27.5 x 5.3 x 30.5 cm) */
export function ps4(o = {}) {
  const [g, b] = kit(), ramp = o.ramp || 'black', bar = o.light || 'sky';
  ex(b, [[-.152, .026], [.140, .026], [.153, .053], [-.139, .053]], .275, ramp, { plane: 'zy' });
  ex(b, [[-.146, .003], [.127, .003], [.136, .022], [-.137, .022]], .262, ramp, { plane: 'zy' });
  bb(b, .25, .006, .25, 'carbon', 0, .021, -.01);
  bb(b, .174, .0012, .288, 'carbon', .05, .053, .007);
  bb(b, .006, .0018, .29, '!' + bar, -.04, .053, .007);
  for (const x of [-.11, .11]) for (const z of [-.1, .09]) bb(b, .02, .003, .02, 'rubber', x, 0, z);
  return fin(g, b, 'ps4', o);
}
/** ps5({ ramp: 'white' (wings) }) - standing: white flared wings around a black core, blue glow in the gap, round stand */
export function ps5(o = {}) {
  const [g, b] = kit(), wing = o.ramp || 'white';
  cy(b, .075, .012, 'black', 0, .006, 0, { seg: 12 });
  bb(b, .064, .37, .21, 'black', 0, .012, 0);
  const prof = [[-.1, .012], [.092, .012], [.098, .12], [.112, .3], [.128, .38], [.106, .392], [-.118, .392], [-.132, .38], [-.112, .25], [-.104, .12]];
  for (const s of [-1, 1]) ex(b, prof, .018, wing, { plane: 'zy', x: s * .041 });
  for (const s of [-1, 1]) bb(b, .003, .3, .004, '!' + (o.light || 'blue'), s * .029, .05, .106);
  bb(b, .03, .006, .002, 'carbon', 0, .2, .1055);
  return fin(g, b, 'ps5', o);
}
/** xbox360({ ramp: 'white' }) - lying flat: the 'inhaled' concave top, disc tray, ring-of-light power button */
export function xbox360(o = {}) {
  const [g, b] = kit(), ramp = o.ramp || 'white';
  for (const x of [-.13, .13]) for (const z of [-.1, .1]) bb(b, .02, .004, .02, 'grey', x, 0, z);
  bb(b, .309, .028, .258, ramp, 0, .004, 0); bb(b, .299, .022, .256, ramp, 0, .032, 0);
  for (const s of [-1, 1]) bb(b, .05, .028, .258, ramp, s * .1295, .032, 0);
  bb(b, .15, .014, .003, 'metal', -.05, .03, .13);
  bb(b, .148, .002, .004, 'grey', -.05, .024, .1305);
  ring(b, .011, .0022, '!lime', .11, .038, .1305, { ts: 12 });
  cy(b, .008, .003, 'metal', .11, .038, .13, { axis: 'z', seg: 10 });
  for (let i = 0; i < 6; i++) bb(b, .003, .03, .002, 'grey', .145 - i * .0055, .02, .1295);
  return fin(g, b, 'xbox 360', o);
}
/** xboxOne({ ramp: 'black' }) - the flat 'VCR' box: vent stripes on half the top, slot, glowing button */
export function xboxOne(o = {}) {
  const [g, b] = kit(), ramp = o.ramp || 'black';
  bb(b, .325, .004, .265, 'rubber', 0, 0, 0);
  bb(b, .333, .075, .274, ramp, 0, .004, 0);
  const sl = []; for (let i = 0; i < 20; i++) sl.push([.0045, .0016, .27, -.16 + i * .009, .0795, 0]);
  ib(b, sl, 'carbon');
  bb(b, .14, .004, .002, 'carbon', -.06, .045, .1375);
  cy(b, .007, .002, '!white', .14, .045, .1375, { axis: 'z', seg: 10 });
  return fin(g, b, 'xbox one', o);
}
/** nintendoSwitch({ dock: false, left: 'neonCyan', right: 'red', screen }) - the tablet with Joy-Cons, upright, screen facing +Z */
export function nintendoSwitch(o = {}) {
  const [g, b] = kit(), { dock = false, screen = 'game', left = 'neonCyan', right = 'red' } = o, y0 = dock ? .014 : 0, H = .102;
  rslab(b, .173, H, .014, .004, 'carbon', 0, y0 + H / 2, 0, 1);
  screenFace(b, .156, .088, screen, 0, y0 + H / 2, .007);
  if (!dock) {
    for (const s of [-1, 1]) {
      const ramp = s < 0 ? left : right, x = s * (.173 / 2 + .017);
      ex(b, rrect(.034, H, s < 0 ? [0, .016, .016, 0] : [.016, 0, 0, .016], 3), .018, ramp, { x, y: H / 2, z: -.002 });
      cy(b, .0075, .006, 'carbon', x, H * (s < 0 ? .72 : .38), .009, { axis: 'z', seg: 8 });
      cy(b, .0065, .002, 'dark', x, H * (s < 0 ? .72 : .38), .0122, { axis: 'z', seg: 8 });
      for (const [dx, dy] of [[0, .0085], [.0085, 0], [0, -.0085], [-.0085, 0]]) cy(b, .0034, .002, 'carbon', x + dx, H * (s < 0 ? .38 : .72) + dy, .0078, { axis: 'z', seg: 8 });
      bb(b, .006, .0016, .002, 'carbon', x - s * .008, H - .012, .0078);
    }
  } else {
    bb(b, .19, .014, .06, 'black', 0, 0, -.004);
    bb(b, .19, .1, .026, 'black', 0, .014, -.022);
    rslab(b, .19, .062, .012, .006, 'black', 0, .014 + .031, .014, 1);
    bx(b, .012, .002, .002, '!red', .08, .02, .0205);
  }
  return fin(g, b, 'nintendo switch', o);
}
/** steamDeck({ screen, ramp: 'black' }) - wide handheld, upright, screen facing +Z: sticks, d-pad, buttons, square trackpads, grips */
export function steamDeck(o = {}) {
  const [g, b] = kit(), { screen = 'game', ramp = 'black' } = o, H = .117;
  rslab(b, .298, H, .02, .036, ramp, 0, H / 2, 0, 3);
  for (const s of [-1, 1]) rslab(b, .07, .1, .024, .03, ramp, s * .11, .052, -.02, 2);
  rslab(b, .176, .108, .0012, .006, 'carbon', 0, H / 2 + .002, .0106, 2);
  screenFace(b, .156, .094, screen, 0, H / 2 + .002, .0112);
  for (const s of [-1, 1]) {
    const xo = s * .124, xi = s * .107;
    if (s < 0) { bx(b, .018, .006, .002, 'carbon', xo, .092, .011); bx(b, .006, .018, .002, 'carbon', xo, .092, .0112); }
    else for (const [dx, dy] of [[0, .008], [.008, 0], [0, -.008], [-.008, 0]]) cy(b, .0034, .002, 'carbon', xo + dx, .092 + dy, .0108, { axis: 'z', seg: 8 });
    cy(b, .007, .006, 'carbon', xi, .063, .013, { axis: 'z', seg: 8 }); cy(b, .0105, .004, 'dark', xi, .063, .0175, { axis: 'z', seg: 10 });
    rslab(b, .032, .03, .0012, .003, 'dark', xi, .026, .0106, 1);
  }
  return fin(g, b, 'steam deck', o);
}

// =====================================================================================================================
// GAME WORLD (Los Santos vibe)
// =====================================================================================================================
function wheel(b, r, w, x, z, rim = 'metal') {
  cy(b, r, w, 'rubber', x, r, z, { axis: 'z', seg: 10 });
  cy(b, r * .58, .02, rim, x, r, z + Math.sign(z) * (w / 2 + .005), { axis: 'z', seg: 8 });
  cy(b, r * .2, .03, 'carbon', x, r, z + Math.sign(z) * (w / 2 + .012), { axis: 'z', seg: 6 });
}
function car4(o, name, P) {
  const [g, b] = kit(), { ramp = P.ramp, lights = false } = o, glass = o.glass || (E.HIBIT ? 'glass' : 'navy'), Wd = P.W;   // (legacy glass = the blue ramp: tinted navy reads on any paint)
  ex(b, P.body, Wd, ramp);
  ex(b, P.cabin, P.cw, glass);
  bx(b, P.roof[1] - P.roof[0], .055, P.cw + .04, P.roofRamp || ramp, (P.roof[0] + P.roof[1]) / 2, P.roof[2], 0);
  if (P.pillar != null) bx(b, .12, P.roof[2] - P.belt, P.cw + .03, P.roofRamp || ramp, P.pillar, (P.roof[2] + P.belt) / 2, 0);
  for (const [x, rr] of P.wheels) for (const s of [-1, 1]) wheel(b, rr, P.tw, x, s * (Wd / 2 - P.tw / 2 + .02));
  bx(b, P.L + .04, .1, Wd + .02, 'carbon', 0, P.sill, 0);                                                              // sills / bumpers line
  const hl = lights ? '!yellow' : '!white';
  for (const s of [-1, 1]) { bx(b, .08, P.hl[1], P.hl[2], hl, P.hl[0], P.hl[3], s * P.hl[4]); bx(b, .06, P.tl[1], P.tl[2], '!red', P.tl[0], P.tl[3], s * P.tl[4]); }
  if (P.grille) bx(b, .05, P.grille[1], P.grille[2], 'carbon', P.grille[0], P.grille[3], 0);
  for (const s of [-1, 1]) bx(b, .14, .09, .12, ramp, P.mirror[0], P.mirror[1], s * (Wd / 2 + .06));
  for (const x of P.doors || []) bx(b, .02, P.belt - P.sill - .1, Wd + .016, 'carbon', x, (P.belt + P.sill) / 2 + .02, 0);
  P.extra?.(b, { ramp, Wd });
  return fin(g, b, name, o, { data: { lights: b.userData.lights } });
}
const SEDAN = { ramp: 'red', L: 4.72, W: 1.8, cw: 1.54, tw: .26, sill: .36, belt: .92,
  body: [[-2.36, .3], [2.3, .3], [2.38, .48], [2.3, .75], [1.05, .9], [-2.2, .94], [-2.38, .68]],
  cabin: [[-1.78, .9], [1.0, .88], [.34, 1.4], [-1.16, 1.43]], roof: [-1.22, .4, 1.42], pillar: -.38,
  wheels: [[1.45, .34], [-1.42, .34]], hl: [2.32, .09, .36, .64, .58], tl: [-2.35, .12, .4, .78, .6], grille: [2.37, .14, .8, .5], mirror: [.88, 1.0], doors: [.62, -.95] };
/** sedan({ ramp: 'blue', glass: 'glass', lights: false (night headlights) }) - 4.7 m four-door, nose at +X */
export function sedan(o = {}) { return car4(o, 'sedan', SEDAN); }
/** sportsCar({ ramp: 'orange' }) - a low wedge coupe with a rear wing, nose at +X */
export function sportsCar(o = {}) {
  return car4(o, 'sports car', { ramp: 'orange', L: 4.5, W: 1.95, cw: 1.56, tw: .3, sill: .32, belt: .8,
    body: [[-2.25, .26], [2.2, .26], [2.3, .4], [2.2, .55], [.7, .78], [-1.9, .86], [-2.28, .75], [-2.32, .45]],
    cabin: [[-1.62, .8], [.8, .75], [-.05, 1.14], [-.88, 1.17], [-1.78, .85]], roof: [-.92, 0, 1.15], pillar: null,
    wheels: [[1.42, .34], [-1.38, .35]], hl: [2.22, .05, .4, .5, .62], tl: [-2.3, .06, .5, .7, .55], grille: null, mirror: [.55, .88], doors: [.45],
    extra(b, { ramp }) {
      for (const s of [-1, 1]) bx(b, .06, .18, .06, 'carbon', -2.02, .95, s * .55);
      bx(b, .36, .045, 1.8, ramp, -2.05, 1.06, 0);
      bx(b, .7, .2, 1.97, 'carbon', -.75, .5, 0);
    } });
}
/** policeCar({ lights: false }) - black-and-white sedan, push bar, roof light bar (userData.lights = [red, blue]; flashLights(car, t)) */
export function policeCar(o = {}) {
  return car4({ ...o, ramp: o.ramp || 'black' }, 'police car', { ...SEDAN, roofRamp: 'white',
    extra(b, { Wd }) {
      bx(b, 2.1, .44, Wd + .012, 'white', -.05, .63, 0);
      bx(b, 1.1, .08, .36, 'carbon', -.4, 1.49, 0);
      const red = bx(b, .5, .1, .3, '!red', -.67, 1.58, 0), blue = bx(b, .5, .1, .3, '!blue', -.13, 1.58, 0);
      red.userData.on = 'red'; blue.userData.on = 'blue'; b.userData.lights = [red, blue];
      bx(b, .06, .36, 1.0, 'carbon', 2.47, .52, 0); bx(b, .1, .06, 1.0, 'carbon', 2.42, .72, 0);
    } });
}
/** taxi({ ramp: 'yellowFlat' }) - yellow sedan with a roof sign and a checker stripe */
export function taxi(o = {}) {
  return car4({ ...o, ramp: o.ramp || 'yellowFlat' }, 'taxi', { ...SEDAN,
    extra(b, { Wd }) {
      bx(b, .6, .2, .28, '!yellow', -.4, 1.55, 0); bx(b, .64, .03, .3, 'carbon', -.4, 1.44, 0);
      const ch = []; for (let i = 0; i < 10; i++) ch.push([.15, .08, Wd + .01, -1.5 + i * .3, .82, 0]);
      ib(b, ch, 'carbon');
    } });
}
/** motorbike({ ramp: 'red' }) - a sport bike, nose at +X, standing on both wheels */
export function motorbike(o = {}) {
  const [g, b] = kit(), ramp = o.ramp || 'red';
  for (const x of [.72, -.7]) { cy(b, .32, .12, 'rubber', x, .32, 0, { axis: 'z', seg: 10 }); cy(b, .17, .13, 'metal', x, .32, 0, { axis: 'z', seg: 8 }); }
  for (const s of [-1, 1]) rod(b, [.72, .32, s * .075], [.52, .98, s * .075], .045, 'metal');
  rod(b, [.52, .9, 0], [-.3, .56, 0], .08, 'carbon');
  for (const s of [-1, 1]) rod(b, [-.3, .5, s * .08], [-.7, .32, s * .08], .05, 'carbon');
  bx(b, .46, .34, .28, 'metal', .06, .45, 0);
  ex(b, [[-.2, .8], [.42, .84], [.5, .98], [.26, 1.06], [-.14, 1.01]], .3, ramp);
  bx(b, .55, .08, .27, 'carbon', -.45, .94, 0);
  ex(b, [[-.72, .84], [-.28, .84], [-.28, .9], [-.98, 1.0]], .22, ramp);
  bx(b, .05, .05, .14, '!red', -.97, .98, 0);
  ex(b, [[.38, .62], [.72, .66], [.66, 1.04], [.42, 1.0]], .34, ramp);
  bx(b, .06, .04, .74, 'carbon', .5, 1.04, 0);
  cy(b, .07, .05, '!yellow', .7, .86, 0, { axis: 'x', seg: 8 });
  cy(b, .05, .7, 'metal', -.32, .36, .19, { axis: 'x', seg: 8 });
  bx(b, .36, .04, .14, ramp, .74, .7, 0);
  return fin(g, b, 'motorbike', o);
}
/** palmTree({ h: 9, lean: 0.12, seed: 1, fronds: 9 }) - curved ringed trunk, drooping V-folded fronds, coconuts */
export function palmTree(o = {}) {
  const [g, b] = kit(), { h = 9, lean = .12, seed = 1, fronds = 9 } = o, r = E.rng(seed * 131 + 17), dir = r() * Math.PI * 2, N = 8;
  const tr = new THREE.Group(), pt = k => { const t = k / N; return [Math.cos(dir) * lean * h * t * t, h * t, Math.sin(dir) * lean * h * t * t]; };
  for (let k = 0; k < N; k++) { const a = pt(k), c = pt(k + 1), rr = .24 - .1 * k / N; tube(tr, a, c, rr, 'brown', { r2: rr - .012, seg: 7 }); tube(tr, a, [a[0], a[1] + .14, a[2]], rr + .03, 'sand', { seg: 7 }); }
  const trunk = bake(tr); b.add(trunk);
  const top = pt(N), cr = new THREE.Group(); cr.position.set(...top);
  for (let i = 0; i < fronds; i++) {
    const f = new THREE.Group(); f.rotation.y = i * Math.PI * 2 / fronds + r() * .4; cr.add(f);
    const Lf = 2.6 + r() * 1.2, up = (r() - .3) * .5, P = [];
    for (let k = 0; k <= 4; k++) { const t = k / 4; P.push([t * Lf, Lf * (.28 * t - .62 * t * t) + up * t * Lf * .4]); }
    for (let k = 0; k < 4; k++) {
      const [x0, y0] = P[k], [x1, y1] = P[k + 1], s = new THREE.Group(); s.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); s.rotation.z = Math.atan2(y1 - y0, x1 - x0); f.add(s);
      const wd = .75 * (1 - k * .2), len = Math.hypot(x1 - x0, y1 - y0) + .05;
      for (const sd of [-1, 1]) { const l = bx(s, len, .05, wd / 2, k % 2 ? 'green' : 'olive', 0, -.04, sd * wd / 4); l.rotation.x = sd * .45; }
    }
  }
  for (let i = 0; i < 4; i++) bx(cr, .2, .2, .2, 'brown', Math.cos(i * 1.7) * .25, -.25, Math.sin(i * 1.7) * .25);
  b.add(bake(cr)); b.children.at(-1).position.set(...top);
  return fin(g, b, 'palm tree', o, { solidPart: trunk, partName: 'trunk' });
}
/** streetLight({ h: 8, lit: false, arm: 2.2 }) - pole with a curved arm reaching +X; origin at the pole foot */
export function streetLight(o = {}) {
  const [g, b] = kit(), { h = 8, lit = false, arm = 2.2 } = o;
  bb(b, .36, .5, .36, 'concrete', 0, 0, 0);
  const pole = cy(b, .09, h, 'metal', 0, h / 2, 0, { top: .065, seg: 8 });
  rod(b, [0, h - .1, 0], [arm * .5, h + .25, 0], .09, 'metal'); rod(b, [arm * .5, h + .25, 0], [arm, h + .2, 0], .09, 'metal');
  bx(b, .75, .16, .36, 'metal', arm + .25, h + .14, 0);
  bx(b, .62, .03, .26, lit ? '!yellow' : 'paper', arm + .25, h + .05, 0);
  return fin(g, b, 'street light', o, { keepOrigin: true, solidPart: pole, partName: 'pole' });
}
/** trafficLight({ state: 'red'|'yellow'|'green', arm: 0 (metres of arm reaching +X with a second head) }) - setTrafficLight(obj, state) */
export function trafficLight(o = {}) {
  const [g, b] = kit(), { state = 'red', arm = 0 } = o, heads = [];
  bb(b, .3, .2, .3, 'concrete', 0, 0, 0);
  const pole = cy(b, .07, 3.8, 'black', 0, 1.9, 0, { seg: 8 });
  const head = (x, y) => {
    bx(b, .36, 1.02, .3, 'black', x, y, .16);
    const L = {};
    [['red', .32], ['yellow', 0], ['green', -.32]].forEach(([c, dy]) => {
      L[c] = cy(b, .1, .04, 'carbon', x, y + dy, .33, { axis: 'z', seg: 10 });
      bx(b, .26, .03, .14, 'black', x, y + dy + .14, .38);
    });
    heads.push(L);
  };
  head(0, 3.1);
  if (arm) { rod(b, [0, 3.5, 0], [arm, 3.5, 0], .1, 'black'); head(arm, 3.0); }
  g.userData.heads = heads;
  setTrafficLight(g, state);
  return fin(g, b, 'traffic light', o, { keepOrigin: true, data: { heads }, solidPart: pole, partName: 'pole' });
}
const LAMP_ON = { red: '!red', yellow: '!yellow', green: '!lime' }, LAMP_OFF = { red: 'plum', yellow: 'brown', green: 'teal' };
/** switch a traffic light's lamps: state 'red' | 'yellow' | 'green' | 'off' */
export function setTrafficLight(obj, state) { for (const L of obj.userData.heads || []) for (const c in L) L[c].material = M(c === state ? LAMP_ON[c] : LAMP_OFF[c]); obj.userData.state = state; return obj; }
/** billboard({ image (key), w: 8, h: 3.5, pole: 6, lit: false }) - a roadside billboard on a pole with a catwalk and lamps */
export function billboard(o = {}) {
  const [g, b] = kit(), { w = 8, h = 3.5, pole = 6, lit = false } = o, yc = pole + h / 2;
  cy(b, .3, pole + .3, 'metal', 0, (pole + .3) / 2, -.2, { seg: 8 });
  bx(b, w + .3, h + .3, .3, 'carbon', 0, yc, 0);
  if (o.image && E.IMG && E.IMG[o.image]) screenFace(b, w, h, o.image, 0, yc, .15);
  else { bx(b, w, h, .05, 'paper', 0, yc, .17); bx(b, w * .42, h * .8, .05, o.adRamp || 'red', -w * .24, yc, .22); bx(b, w * .45, h * .18, .05, 'navy', w * .22, yc + h * .22, .22); bx(b, w * .3, h * .12, .05, 'navy', w * .18, yc - .1, .22); bx(b, w * .2, h * .2, .05, 'yellowFlat', w * .3, yc - h * .28, .22); }
  bx(b, w, .06, .7, 'metal', 0, pole - .1, .45);
  for (let i = 0; i <= 8; i++) bx(b, .04, .7, .04, 'metal', -w / 2 + i * w / 8, pole + .25, .78);
  bx(b, w, .04, .04, 'metal', 0, pole + .6, .78);
  for (const x of [-w / 3, 0, w / 3]) { rod(b, [x, yc + h / 2 + .15, 0], [x, yc + h / 2 + .45, .8], .06, 'metal'); bx(b, .4, .14, .2, lit ? '!yellow' : 'metal', x, yc + h / 2 + .45, .85); }
  return fin(g, b, 'billboard', o);
}
/** bench({ ramp: 'wood' }) - park bench: slatted seat and back on two metal frames (1.8 m) */
export function bench(o = {}) {
  const [g, b] = kit(), ramp = o.ramp || 'wood';
  for (const s of [-1, 1]) { bb(b, .06, .44, .5, 'black', s * .8, 0, 0); rod(b, [s * .8, .4, -.22], [s * .8, .85, -.32], .06, 'black'); bx(b, .07, .05, .5, 'black', s * .8, .66, 0); }
  for (const z of [-.15, 0, .15]) bb(b, 1.8, .04, .12, ramp, 0, .44, z);
  for (const y of [.62, .76]) { const s = bx(b, 1.8, .11, .035, ramp, 0, y, -.27 - (y - .55) * .2); s.rotation.x = -.2; }
  return fin(g, b, 'bench', o);
}
/** hydrant({ ramp: 'red' }) - fire hydrant (0.8 m) */
export function hydrant(o = {}) {
  const [g, b] = kit(), ramp = o.ramp || 'red';
  cy(b, .17, .06, ramp, 0, .03, 0, { seg: 8 }); cy(b, .12, .48, ramp, 0, .3, 0, { seg: 8 }); cy(b, .15, .05, ramp, 0, .55, 0, { seg: 8 });
  cy(b, .12, .14, ramp, 0, .64, 0, { top: .06, seg: 8 }); cy(b, .035, .06, 'metal', 0, .74, 0, { seg: 6 });
  for (const s of [-1, 1]) cy(b, .05, .12, ramp, s * .16, .42, 0, { axis: 'x', seg: 8 });
  cy(b, .07, .1, ramp, 0, .4, .15, { axis: 'z', seg: 8 }); cy(b, .04, .02, 'metal', 0, .4, .2, { axis: 'z', seg: 6 });
  return fin(g, b, 'hydrant', o);
}
/** dumpster({ ramp: 'green' }) - a wheeled waste container with two black lids */
export function dumpster(o = {}) {
  const [g, b] = kit(), ramp = o.ramp || 'green';
  for (const x of [-.8, .8]) for (const z of [-.4, .4]) cy(b, .07, .06, 'rubber', x, .07, z, { axis: 'z', seg: 8 });
  ex(b, [[-.55, .14], [.5, .14], [.62, 1.25], [-.55, 1.25]], 1.9, ramp, { plane: 'zy' });
  for (const s of [-1, 1]) { const l = bx(b, .94, .05, 1.26, 'carbon', s * .48, 1.3, .03); l.rotation.x = -.08; }
  for (const s of [-1, 1]) bx(b, .2, .14, 1.2, 'dark', s * .5, .55, .04).scale.set(.24, .14, 1.22);
  for (const s of [-1, 1]) bx(b, .06, .5, .06, 'dark', s * .98, .7, .05);
  return fin(g, b, 'dumpster', o);
}
/** fence({ length: 4, type: 'wood' | 'chain' | 'metal', h: 1.2 }) - along X */
export function fence(o = {}) {
  const [g, b] = kit(), { length = 4, type = 'wood', h = 1.2 } = o, n = Math.max(1, Math.round(length / 2));
  const post = type === 'wood' ? 'wood' : 'metal';
  for (let i = 0; i <= n; i++) bb(b, .1, h + .1, .1, post, -length / 2 + i * length / n, 0, 0);
  if (type === 'wood') {
    for (const y of [.3, h - .2]) bx(b, length, .08, .05, 'wood', 0, y, .03);
    const pk = []; for (let x = -length / 2 + .1; x < length / 2 - .05; x += .16) pk.push([.1, h - .05, .025, x, (h - .05) / 2 + .02, .0675]);
    ib(b, pk, 'brown');
  } else if (type === 'chain') {
    bx(b, length, .05, .05, 'metal', 0, h + .03, 0);
    const p = bx(b, length, h - .05, .01, null, 0, (h - .05) / 2 + .02, 0); p.material = MT('metal', .45);
  } else {
    for (const y of [.12, h - .05]) bx(b, length, .05, .04, 'carbon', 0, y, 0);
    const bars = []; for (let x = -length / 2 + .12; x < length / 2 - .05; x += .12) bars.push([.025, h - .1, .025, x, h / 2, 0]);
    ib(b, bars, 'carbon');
  }
  return fin(g, b, 'fence', o);
}
/** vineSign({ widths: [...], h: 9, ramp: 'white' }) - hillside sign as tall generic blocks on scaffolding (no lettering), facing +Z */
export function vineSign(o = {}) {
  const [g, b] = kit(), { h = 9, ramp = 'white' } = o, r = E.rng(o.seed ?? 3);
  const widths = o.widths || [4.6, 4.2, 4.6, 3.0, 4.6, 5.2, 4.6, 4.6];
  // letter-like 3x5 glyphs in a shuffled order: reads as big hillside letters, spells nothing
  const GL = ['111101101101111', '101111111111101', '111010010010111', '111100110100111', '110101101101110', '101101111111101', '111100100100100', '111101111101101'];
  const order = o.glyphs || GL.map((_, k) => k).sort(() => r() - .5);
  let x = -(widths.reduce((a, c) => a + c, 0) + (widths.length - 1) * 1.1) / 2;
  widths.forEach((w, i) => {
    const hh = h * (.94 + r() * .08), cx = x + w / 2, gp = new THREE.Group(); gp.position.set(cx, 0, 0); gp.rotation.z = (r() - .5) * .04; b.add(gp);
    const gl = GL[order[i % order.length] % GL.length], cw = w / 3, ch = hh / 5;
    for (let row = 0; row < 5; row++) {                                                                                  // runs of filled cells per row
      let c = 0; while (c < 3) { if (gl[row * 3 + c] !== '1') { c++; continue; } let e = c; while (e < 3 && gl[row * 3 + e] === '1') e++;
        bb(gp, (e - c) * cw, ch, .3, ramp, -w / 2 + (c + e) / 2 * cw, .4 + (4 - row) * ch, 0); c = e; }
    }
    for (const s of [-1, 1]) { rod(gp, [s * w * .3, .4, -.18], [s * w * .3, hh * .85, -.18], .14, 'wood'); rod(gp, [s * w * .3, 0, -2.2], [s * w * .3, hh * .7, -.2], .12, 'wood'); }
    bb(gp, w * .8, .4, 2.4, 'wood', 0, 0, -1.1);
    x += w + 1.1;
  });
  return fin(g, b, 'hillside sign', o);
}
/** skyscraper({ floors: 20, w: 18, d: 18, ramp: 'concrete', style: 'grid'|'bands', lit: 0.35 (share of lit windows), night: false, seed, spire }) */
export function skyscraper(o = {}) {
  const [g, b] = kit(), { floors = 20, w = 18, d = 18, ramp = 'concrete', style = 'grid', lit = .35, night = false, seed = 1 } = o, r = E.rng(seed * 7919 + 3), st = 3.2;
  const tiers = floors >= 14 ? [[0, .62, 1], [.62, .86, .8], [.86, 1, .58]] : floors >= 8 ? [[0, .76, 1], [.76, 1, .78]] : [[0, 1, 1]];
  const on = [], off = [], bands = [];
  const winRamp = o.glass || (night ? 'dark' : 'denim');                                                  // (Hi-Bit glass is near white: day panes read as reflections only when 'lit')
  let topY = 0, tw = w, td = d;
  for (const [a, c, k] of tiers) {
    const f0 = Math.round(a * floors), f1 = Math.max(f0 + 1, Math.round(c * floors)); tw = w * k; td = d * k;
    const y0 = f0 * st, hh = (f1 - f0) * st;
    bb(b, tw, hh, td, ramp, 0, y0, 0);
    bb(b, tw + .5, .45, td + .5, ramp, 0, y0 + hh - .4, 0);                                                         // ledge (top 5 cm above the roof: no shared plane)
    for (let f = Math.max(1, f0); f < f1; f++) {
      const y = f * st + st * .45;
      for (const [len, ax] of [[tw, 'x'], [td, 'z']]) {
        const n = Math.max(1, Math.floor(len / 3)), sp = len / n;
        for (const side of [-1, 1]) {
          if (style === 'bands') { const L = len - 1.2; ax === 'x' ? bands.push([L, 1.5, .14, 0, y, side * td / 2]) : bands.push([.14, 1.5, L, side * tw / 2, y, 0]); }
          for (let i = 0; i < n; i++) {
            const p = -len / 2 + sp * (i + .5), isOn = r() < lit;
            if (style === 'bands' && !isOn) continue;
            const ww = style === 'bands' ? sp * .8 : Math.min(2, sp * .62), list = isOn ? on : off;
            const dz = style === 'bands' ? .2 : .14;
            ax === 'x' ? list.push([ww, 1.7, dz, p, y, side * td / 2]) : list.push([dz, 1.7, ww, side * tw / 2, y, p]);
          }
        }
      }
    }
    topY = y0 + hh;
  }
  ib(b, bands, winRamp); ib(b, off, winRamp); ib(b, on, night ? '!yellow' : (style === 'bands' ? 'paper' : 'sky'));
  bb(b, w * .7, 2.8, .25, night ? '!yellow' : 'glass', 0, .1, d / 2);                                                 // lobby glass
  bb(b, w * .8, .3, 1.6, ramp, 0, 3.1, d / 2 + .7);                                                                    // canopy
  for (let i = 0; i < 3; i++) bb(b, 1.6, 1.0, 1.2, 'metal', (r() - .5) * tw * .5, topY, (r() - .5) * td * .5);
  if (o.spire ?? floors > 24) { cy(b, .25, floors * .25, 'metal', 0, topY + floors * .125, 0, { top: .08, seg: 6 }); bx(b, .3, .3, .3, '!red', 0, topY + floors * .25 + .1, 0); }
  return fin(g, b, 'skyscraper', o, { data: { floors, height: floors * st } });
}
/** house({ ramp: 'paper' (stucco), roof: 'red', w: 10, d: 8 }) - a single-storey LA bungalow: pitched roof, garage, door, windows */
export function house(o = {}) {
  const [g, b] = kit(), { ramp = 'paper', roof = 'red', w = 10, d = 8 } = o, hW = 3;
  bb(b, w + .2, .25, d + .2, 'concrete', 0, 0, 0);
  bb(b, w, hW, d, ramp, 0, .25, 0);
  ex(b, [[-d / 2, hW + .25], [d / 2, hW + .25], [0, hW + 2.1]], w, ramp, { plane: 'zy' });                          // gable walls
  for (const s of [-1, 1]) rod(b, [0, hW + .2, s * (d / 2 + .5)], [0, hW + 2.25, 0], w + .6, roof, .16);               // two roof planes
  bb(b, .8, 1.6, .8, ramp, w * .3, hW + 1.2, -1);
  bb(b, 3.2, 2.4, .1, 'white', -w / 2 + 2.1, .25, d / 2);
  for (let i = 1; i < 5; i++) bx(b, 3.2, .04, .12, 'concrete', -w / 2 + 2.1, .25 + i * .48, d / 2 + .01);
  bb(b, 1.0, 2.2, .1, 'wood', .8, .25, d / 2); bx(b, .08, .08, .06, 'gold', 1.15, 1.3, d / 2 + .08);
  bb(b, 1.6, .15, 1.0, 'concrete', .8, 0, d / 2 + .5);
  for (const [x, z, s] of [[3.1, d / 2, 'z'], [-w / 2, 1, 'x'], [w / 2, -1.5, 'x']]) {
    if (s === 'z') { bb(b, 1.8, 1.4, .12, 'white', x, 1.1, z); bb(b, 1.6, 1.2, .14, 'glass', x, 1.2, z); }
    else { bb(b, .12, 1.4, 1.8, 'white', x, 1.1, z); bb(b, .14, 1.2, 1.6, 'glass', x, 1.2, z); }
  }
  return fin(g, b, 'house', o);
}
/** gasStation({ ramp: 'white', accent: 'red', lit: false }) - canopy on four pillars over two pump islands, a shop behind, a price sign */
export function gasStation(o = {}) {
  const [g, b] = kit(), { ramp = 'white', accent = 'red', lit = false } = o;
  bb(b, 16, .12, 20, 'concrete', 0, 0, 0);
  for (const x of [-5, 5]) for (const z of [-1, 5]) bb(b, .5, 4.6, .5, ramp, x, .12, z);
  bb(b, 14, .8, 9, ramp, 0, 4.7, 2); bb(b, 14.1, .3, 9.1, accent, 0, 4.85, 2);
  for (const x of [-3.5, 0, 3.5]) bb(b, 2.4, .04, 1.2, lit ? '!white' : 'paper', x, 4.66, 2);
  for (const x of [-3, 3]) {
    bb(b, 1.4, .2, 4.4, 'concrete', x, .12, 2);
    for (const z of [.6, 3.4]) { bb(b, .8, 1.8, .5, ramp, x, .32, z); bb(b, .82, .45, .52, accent, x, 1.7, z); bx(b, .4, .28, .04, '!sky', x, 1.25, z + .27); bx(b, .4, .28, .04, '!sky', x, 1.25, z - .27); rod(b, [x + .42, 1.4, z], [x + .5, .6, z], .05, 'carbon'); }
  }
  bb(b, 12, 3.6, 6, ramp, 0, .12, -6.8); bb(b, 12.2, .7, 6.2, accent, 0, 3.6, -6.8);
  bb(b, 7, 2.4, .1, lit ? '!yellow' : 'glass', -1.5, .3, -3.8); bb(b, 1.6, 2.4, .1, 'glass', 3.6, .3, -3.8);
  cy(b, .2, 6, 'metal', 7.2, 3.12, 8.6, { seg: 8 });
  bb(b, 2.2, 2.6, .4, accent, 7.2, 6.1, 8.6);
  for (let i = 0; i < 3; i++) bx(b, 1.6, .45, .1, lit ? '!yellow' : 'white', 7.2, 7.95 - i * .75, 8.85);
  return fin(g, b, 'gas station', o);
}

// =====================================================================================================================
// STUDIO / OFFICE
// =====================================================================================================================
/** desk({ w: 1.4, d: 0.7, h: 0.75, ramp: 'wood', legs: 'metal', drawers: false }) - userData.top = h (use onTop) */
export function desk(o = {}) {
  const [g, b] = kit(), { w = 1.4, d = .7, h = .75, ramp = 'wood', legs = 'metal', drawers = false } = o;
  bb(b, w, .04, d, ramp, 0, h - .04, 0);
  for (const x of [-1, 1]) for (const z of [-1, 1]) if (!(drawers && x > 0)) bb(b, .05, h - .04, .05, legs, x * (w / 2 - .05), 0, z * (d / 2 - .05));
  bb(b, w - .16, .3, .02, legs, 0, h - .36, -d / 2 + .06);
  if (drawers) { bb(b, .42, h - .04, d - .04, legs, w / 2 - .23, 0, 0); for (let i = 0; i < 3; i++) { bb(b, .38, .2, .02, ramp, w / 2 - .23, .06 + i * .22, d / 2 - .01); bx(b, .12, .02, .02, 'metal', w / 2 - .23, .2 + i * .22, d / 2 + .01); } }
  return fin(g, b, 'desk', o, { top: h });
}
/** officeChair({ ramp: 'black' }) - five-star base on casters, gas lift, seat, tilted back, armrests; faces +Z */
export function officeChair(o = {}) {
  const [g, b] = kit(), ramp = o.ramp || 'black';
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + .3, x = Math.sin(a) * .3, z = Math.cos(a) * .3;
    rod(b, [0, .09, 0], [x, .07, z], .04, 'carbon'); cy(b, .03, .03, 'rubber', x, .03, z, { axis: 'x', seg: 6 }); }
  cy(b, .028, .34, 'metal', 0, .26, 0, { seg: 8 });
  rplate(b, .5, .08, .5, .08, ramp, 0, .43, .01);
  rod(b, [0, .45, -.18], [0, .62, -.26], .05, 'carbon');
  const bk = rslab(b, .46, .56, .06, .08, ramp, 0, .86, -.25); bk.rotation.x = -.1;
  for (const s of [-1, 1]) { bx(b, .04, .2, .04, 'carbon', s * .23, .6, -.02); bx(b, .06, .03, .26, 'carbon', s * .23, .71, .0); }
  return fin(g, b, 'office chair', o);
}
/** serverRack({ leds: true, units: 12, ramp: 'black' }) - 42U cabinet, open front with servers and LEDs (blinkLeds(rack, t)) */
export function serverRack(o = {}) {
  const [g, b] = kit(), { leds = true, units = 12, ramp = 'black' } = o, r = E.rng(o.seed ?? 5), L = [];
  for (const x of [-1, 1]) for (const z of [-1, 1]) bb(b, .04, 2.0, .04, ramp, x * .28, 0, z * .48);
  bb(b, .6, .05, 1.0, ramp, 0, 1.95, 0); bb(b, .6, .08, 1.0, ramp, 0, 0, 0);
  for (const x of [-1, 1]) bb(b, .02, 1.87, .92, ramp, x * .29, .08, 0);
  bb(b, .52, 1.87, .02, ramp, 0, .08, -.48);
  const sh = 1.8 / units;
  for (let i = 0; i < units; i++) {
    const y = .12 + i * sh, hh = sh - .012;
    bb(b, .5, hh, .9, 'black', 0, y, -.02);
    bb(b, .5, hh, .012, i % 3 === 2 ? 'metal' : 'dark', 0, y, .435);
    for (let k = 0; k < 4; k++) bx(b, .07, hh * .3, .006, 'carbon', -.16 + k * .08, y + hh * .5, .444);
    if (leds) for (let k = 0; k < 3; k++) { const c = ['lime', 'lime', 'cyan', 'orange'][Math.floor(r() * 4)]; const m = bx(b, .012, .012, .006, '!' + c, .15 + k * .025, y + hh * .62, .444); m.userData.led = c; m.userData.ph = r(); L.push(m); }
  }
  return fin(g, b, 'server rack', o, { data: { leds: L } });
}
/** whiteboard({ w: 1.8, stand: true }) - a board with a small drawn diagram (coloured strips), on a wheeled stand or wall-mounted */
export function whiteboard(o = {}) {
  const [g, b] = kit(), { w = 1.8, stand = true } = o, yc = stand ? 1.3 : .6;
  bx(b, w + .06, 1.16, .04, 'metal', 0, yc, 0);
  bx(b, w, 1.1, .02, 'paper', 0, yc, .02);
  for (const [x, y, ww, hh, c] of [[-.55, .25, .36, .22, 'blue'], [0, .25, .36, .22, 'red'], [.55, .25, .36, .22, 'green'], [-.27, .25, .18, .03, 'dark'], [.27, .25, .18, .03, 'dark'], [-.4, -.2, .7, .03, 'blue'], [-.4, -.3, .5, .03, 'blue'], [.45, -.25, .3, .3, 'orange']])
    bx(b, ww * w / 1.8, hh, .006, c, x * w / 1.8, yc + y, .033);
  bx(b, w * .6, .03, .08, 'metal', 0, yc - .58, .05);
  if (stand) for (const s of [-1, 1]) { bb(b, .04, 1.9, .04, 'metal', s * (w / 2 + .05), .06, -.03); bb(b, .05, .04, .6, 'metal', s * (w / 2 + .05), .04, -.03);
    for (const z of [-.25, .2]) cy(b, .03, .03, 'rubber', s * (w / 2 + .05), .03, z, { axis: 'x', seg: 6 }); }
  return fin(g, b, 'whiteboard', o, { rest: stand });
}
/** coffeeMug({ ramp: 'white', coffee: true }) */
export function coffeeMug(o = {}) {
  const [g, b] = kit(), ramp = o.ramp || 'white';
  cy(b, .04, .095, ramp, 0, .0475, 0, { seg: 10 });
  if (o.coffee !== false) cy(b, .034, .002, E.HIBIT ? 'brown' : 'dark', 0, .0955, 0, { seg: 10 });
  bx(b, .012, .01, .012, ramp, .046, .075, 0); bx(b, .012, .01, .012, ramp, .046, .025, 0); bx(b, .012, .06, .012, ramp, .058, .05, 0);
  return fin(g, b, 'coffee mug', o);
}
/** bookshelf({ w: 0.9, h: 1.9, d: 0.32, ramp: 'wood', seed }) - five shelves of mixed books (one leaning) */
export function bookshelf(o = {}) {
  const [g, b] = kit(), { w = .9, h = 1.9, d = .32, ramp = 'wood', seed = 2 } = o, r = E.rng(seed * 97 + 1);
  for (const s of [-1, 1]) bb(b, .025, h, d, ramp, s * (w / 2 - .0125), 0, 0);
  bb(b, w - .05, .015, d - .02, 'brown', 0, .05, -.0);
  bb(b, w - .05, h - .05, .012, 'brown', 0, .05, -d / 2 + .006);
  const n = 5, sp = (h - .1) / n, cols = ['red', 'blue', 'green', 'yellow', 'purple', 'teal', 'orange', 'paper', 'navy'], per = {};
  for (let i = 0; i <= n; i++) bb(b, w - .05, .025, d, ramp, 0, .05 + i * sp - (i === n ? .025 : 0), 0);
  for (let i = 0; i < n; i++) {
    let x = -w / 2 + .03; const y0 = .05 + i * sp + .025;
    while (x < w / 2 - .12) {
      if (r() < .1) { x += .06; continue; }
      const bw = .022 + r() * .03, bh = sp * (.55 + r() * .3), bd = d * (.62 + r() * .2), c = cols[Math.floor(r() * cols.length)];
      (per[c] ||= []).push([bw, bh, bd, x + bw / 2, y0 + bh / 2, -d / 2 + .02 + bd / 2]); x += bw + .002;
    }
    if (i % 2 === 0) { const c = cols[i]; const lb = bx(b, .03, sp * .7, d * .7, c, w / 2 - .09, y0 + sp * .33, -d / 2 + .02 + d * .35); lb.rotation.z = -.32; }
  }
  for (const c in per) ib(b, per[c], c);
  return fin(g, b, 'bookshelf', o);
}
/** lamp({ lit: true, floor: false, ramp: 'black' }) - desk lamp (arm + head) or floor lamp (pole + shade) */
export function lamp(o = {}) {
  const [g, b] = kit(), { lit = true, floor = false, ramp = 'black' } = o;
  if (floor) {
    cy(b, .16, .03, ramp, 0, .015, 0, { seg: 10 }); cy(b, .015, 1.45, 'metal', 0, .75, 0, { seg: 6 });
    cy(b, .24, .3, 'paper', 0, 1.55, 0, { top: .18, seg: 10 }); if (lit) cy(b, .2, .01, '!yellow', 0, 1.395, 0, { seg: 10 });
    return fin(g, b, 'floor lamp', o);
  }
  cy(b, .07, .02, ramp, 0, .01, 0, { seg: 10 });
  rod(b, [0, .02, 0], [-.06, .3, -.02], .016, ramp); rod(b, [-.06, .3, -.02], [.12, .38, -.02], .016, ramp);
  const hd = new THREE.Group(); hd.position.set(.13, .37, -.02); hd.rotation.z = -.6; b.add(hd);
  cy(hd, .06, .09, ramp, 0, -.035, 0, { top: .025, seg: 8 });
  if (lit) cy(hd, .052, .006, '!yellow', 0, -.081, 0, { seg: 8 });
  return fin(g, b, 'desk lamp', o);
}

/** pottedPlant({ h: 1.1, ramp: 'green', pot: 'brown', seed }) - office plant: pot, soil, a few leaf clumps */
export function pottedPlant(o = {}) {
  const [g, b] = kit(), { h = 1.1, ramp = 'green', pot = 'brown' } = o, r = E.rng(o.seed ?? 6);
  cy(b, .2, .4, pot, 0, .2, 0, { top: .24, seg: 8 }); cy(b, .2, .02, 'dark', 0, .405, 0, { seg: 8 });
  cy(b, .025, h * .4, 'brown', 0, .4 + h * .2, 0, { seg: 5 });
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + r(), rr = .1 + r() * .14, y = .55 + r() * (h - .65); const l = bx(b, .26, .2, .26, i % 2 ? ramp : 'olive', Math.cos(a) * rr, y, Math.sin(a) * rr); l.rotation.y = a; }
  return fin(g, b, 'potted plant', o);
}

// =====================================================================================================================
// DIAGRAM PROPS (to explain tech in 3D: blocks, arrows, gates, pipes, belts, packets, charts, plinths)
// =====================================================================================================================
/** block({ w: 1, h: 0.5, d: 1, ramp: 'blue', label, glow: false }) - a bevelled tile; userData.label + userData.labelAt (local point above) for a HUD tag */
export function block(o = {}) {
  const [g, b] = kit(), { w = 1, h = .5, d = 1, ramp = 'blue', label } = o, bev = Math.min(w, d, h) * .12;
  bb(b, w, h - bev, d, o.glow ? '!' + ramp : ramp, 0, 0, 0);
  bb(b, w - bev * 2, bev, d - bev * 2, o.glow ? '!' + ramp : ramp, 0, h - bev, 0);
  return fin(g, b, 'block', o, { top: h, data: { label: label ?? null, labelAt: [0, h + .12, 0] } });
}
/** arrow3d(from [x,y,z], to [x,y,z], { ramp: 'yellow', r: 0.08, head: 0.3, glow: false }) - in the parent's coordinates; growArrow(a, k) draws it 0..1 */
export function arrow3d(from, to, o = {}) {
  const [g, b] = kit(), { r = .08, ramp = 'yellow' } = o, A = V3(from), B = V3(to), dir = B.clone().sub(A), L = dir.length(), head = Math.min(o.head ?? r * 4, L * .5);
  const spec = o.glow ? '!' + ramp : ramp, arm = new THREE.Group(); arm.position.copy(A); arm.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize()); b.add(arm);
  const shaft = bx(arm, L - head, r * 2, r * 2, spec, (L - head) / 2, 0, 0);
  const tip = new THREE.Mesh(cylGeo(0, r * 2.6, head, 4), M(spec)); tip.rotation.z = -Math.PI / 2; tip.rotation.x = Math.PI / 4; tip.position.x = L - head / 2; arm.add(tip);
  return fin(g, b, 'arrow', o, { keepOrigin: true, solid: false, rest: false, over: true, data: { shaft, tip, len: L, head } });
}
/** draw an arrow from its start: k 0..1 */
export function growArrow(a, k) {
  const { shaft, tip, len, head } = a.userData; k = Math.max(0, Math.min(1, k));
  const sl = Math.max(.001, (len - head) * k); shaft.scale.x = sl; shaft.position.x = sl / 2; tip.position.x = sl + head / 2; tip.visible = shaft.visible = k > 0; return a;
}
/** gate({ ramp: 'purple', w: 2.4, h: 2.6, d: 0.6, field: true, glowRamp: 'neonCyan' }) - a translator gate blocks pass through (not solid) */
export function gate(o = {}) {
  const [g, b] = kit(), { ramp = 'purple', w = 2.4, h = 2.6, d = .6, field = true, glowRamp = 'neonCyan' } = o;
  for (const s of [-1, 1]) { bb(b, .5, h, d, ramp, s * (w / 2 + .25), 0, 0); bb(b, .6, .15, d + .2, ramp, s * (w / 2 + .25), 0, 0); }
  bb(b, w + 1.0, .45, d, ramp, 0, h, 0);
  for (const s of [-1, 1]) { bx(b, .04, h - .1, d * .6, '!' + glowRamp, s * (w / 2 - .01), h / 2, 0); }
  bx(b, w, .06, d * .6, '!' + glowRamp, 0, h - .03, 0);
  let fld = null;
  if (field) { fld = bx(b, w, h - .06, .02, null, 0, (h - .06) / 2, 0); fld.material = MT(glowRamp, .28); fld.userData.noOutline = true; }
  return fin(g, b, 'gate', o, { solid: false, over: true, data: { field: fld, opening: [w, h] } });
}
/** polyline helpers: point at fraction k (0..1, by length) along points */
export function pathAt(points, k) {
  const P = (points.userData?.points || points).map(V3); let tot = 0; const L = [];
  for (let i = 1; i < P.length; i++) { L.push(P[i].distanceTo(P[i - 1])); tot += L.at(-1); }
  let t = Math.max(0, Math.min(1, k)) * tot;
  for (let i = 0; i < L.length; i++) { if (t <= L[i] || i === L.length - 1) return P[i].clone().lerp(P[i + 1], L[i] ? Math.min(1, t / L[i]) : 0); t -= L[i]; }
  return P[0].clone();
}
/** pipe(points [[x,y,z]...] (parent coordinates), { ramp: 'metal', r: 0.15, flanges: true }) - straight runs + elbow blocks; pathAt(pipe, k) */
export function pipe(points, o = {}) {
  const [g, b] = kit(), { ramp = 'metal', r = .15 } = o, P = points.map(V3);
  for (let i = 1; i < P.length; i++) tube(b, P[i - 1], P[i], r, ramp, { seg: 8 });
  P.forEach((p, i) => { if (o.flanges !== false) { if (i > 0 && i < P.length - 1) bx(b, r * 2.5, r * 2.5, r * 2.5, ramp, p.x, p.y, p.z); else tube(b, p, p.clone().add((i ? P[i - 1] : P[1]).clone().sub(p).setLength(r * .8)), r * 1.35, ramp, { seg: 8 }); } });
  return fin(g, b, 'pipe', o, { keepOrigin: true, solid: false, rest: false, over: true, data: { points: points.map(p => [...(p.isVector3 ? p.toArray() : p)]) } });
}
/** conveyor({ length: 6, w: 1.2, h: 0.8, ramp: 'grey' }) - belt on legs along X; runConveyor(c, t, speed) moves the belt marks; userData.top = h */
export function conveyor(o = {}) {
  const [g, b] = kit(), { length = 6, w = 1.2, h = .8, ramp = 'grey' } = o, sp = .5;
  bb(b, length, .06, w, 'rubber', 0, h - .06, 0);
  for (const s of [-1, 1]) bb(b, length + .1, .16, .08, ramp, 0, h - .12, s * (w / 2 + .04));
  for (const s of [-1, 1]) cy(b, .1, w, 'metal', s * length / 2, h - .1, 0, { axis: 'z', seg: 8 });
  for (let x = -length / 2 + .3; x <= length / 2 - .3; x += Math.max(1.2, length / 5)) for (const s of [-1, 1]) bb(b, .08, h - .12, .08, ramp, x, 0, s * (w / 2 + .04));
  const marks = new THREE.Group(); b.add(marks);
  for (let x = -length / 2 + .2; x < length / 2 - sp; x += sp) bx(marks, .06, .006, w - .1, 'dark', x, h + .003, 0);
  return fin(g, b, 'conveyor', o, { top: h, data: { marks, spacing: sp, length } });
}
/** move a conveyor's belt marks: speed in m/s along +X */
export function runConveyor(c, t, speed = .6) { const { marks, spacing } = c.userData; if (marks) marks.position.x = ((t * speed) % spacing + spacing) % spacing; return c; }
/** dataPacket({ ramp: 'cyan', s: 0.35, glow: true }) - a glowing core in a cube frame (the thing that moves through pipes and gates) */
export function dataPacket(o = {}) {
  const [g, b] = kit(), { ramp = 'cyan', s = .35, glow: gl = true } = o, t = s * .12, h = s / 2;
  bx(b, s * .62, s * .62, s * .62, gl ? '!' + ramp : ramp, 0, h, 0);
  const frame = o.frame || 'navy';
  for (const [ax, ay, az] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) for (const u of [-1, 1]) for (const v of [-1, 1]) {
    const p = ax ? [0, u * (h - t / 2), v * (h - t / 2)] : ay ? [u * (h - t / 2), 0, v * (h - t / 2)] : [u * (h - t / 2), v * (h - t / 2), 0];
    bx(b, ax ? s : t, ay ? s - 2 * t : t, az ? s - 2 * t : t, frame, p[0], p[1] + h, p[2]);   // x edges full, y / z edges between them
  }
  return fin(g, b, 'data packet', o, { rest: false });
}
/** stackOfBlocks(n = 4, { w: 1, h: 0.4, d: 1, ramps: [...], jitter: 0.05, seed }) - userData.blocks (bottom first) */
export function stackOfBlocks(n = 4, o = {}) {
  const [g, b] = kit(), { w = 1, h = .4, d = 1, jitter = .05, ramps = ['blue', 'sky', 'cyan', 'teal', 'navy'] } = o, r = E.rng(o.seed ?? 4), blocks = [];
  for (let i = 0; i < n; i++) { const k = block({ w, h, d, ramp: ramps[i % ramps.length] }); k.position.set((r() - .5) * jitter * 2, i * h, (r() - .5) * jitter * 2); k.rotation.y = (r() - .5) * jitter * 2; b.add(k); blocks.push(k); }
  return fin(g, b, 'stack of blocks', o, { top: n * h, data: { blocks } });
}
/** barChart(values [..], { ramp: 'lime', ramps, w: 0.6, gap: 0.3, maxH: 3, d: 0.6 }) - bars on a base plate; setBars(chart, k) grows them */
export function barChart(values = [1, 2, 3], o = {}) {
  const [g, b] = kit(), { w = .6, gap = .3, maxH = 3, d = .6, ramp = 'lime' } = o, mx = Math.max(...values, 1e-6), bars = [];
  const tot = values.length * w + (values.length - 1) * gap;
  bb(b, tot + .4, .08, d + .4, 'black', 0, 0, 0);
  values.forEach((v, i) => {
    const p = new THREE.Group(), hh = Math.max(.02, v / mx * maxH); p.position.set(-tot / 2 + w / 2 + i * (w + gap), .08, 0); b.add(p);
    bb(p, w, 1, d, o.ramps ? o.ramps[i % o.ramps.length] : ramp, 0, 0, 0); p.scale.y = hh;
    bars.push({ pivot: p, h: hh, value: v, top: [p.position.x, .08 + hh, 0] });
  });
  return fin(g, b, 'bar chart', o, { data: { bars } });
}
/** grow a bar chart: k 0..1 (all bars) or a function (i) => k */
export function setBars(chart, k) { chart.userData.bars.forEach((bar, i) => { const kk = typeof k === 'function' ? k(i) : k; bar.pivot.scale.y = Math.max(.001, bar.h * kk); bar.pivot.visible = kk > 0; }); return chart; }
/** plinth({ w: 1.2, h: 1, ramp: 'white', accent: 'neonCyan' (glow strip, null = none) }) - a display pedestal; userData.top = h */
export function plinth(o = {}) {
  const [g, b] = kit(), { w = 1.2, h = 1, ramp = 'white', accent = 'neonCyan' } = o;
  bb(b, w + .3, .15, w + .3, ramp, 0, 0, 0);
  bb(b, w, h - .25, w, ramp, 0, .15, 0);
  bb(b, w + .12, .1, w + .12, ramp, 0, h - .1, 0);
  if (accent) bb(b, w + .02, .04, w + .02, '!' + accent, 0, h - .16, 0);
  return fin(g, b, 'plinth', o, { top: h });
}

// =====================================================================================================================
// ANIMATION HELPERS
// =====================================================================================================================
/** spin every fan rotor under obj (gpuCard, heatsinkFan): t seconds, rps turns per second (default the prop's own) */
export function spinFan(obj, t, rps) { const s = rps ?? obj.userData.spin ?? 1.5; obj.traverse(o => { if (o.userData.isFan) o.rotation.z = -t * s * Math.PI * 2; }); return obj; }
/** police light bar: alternates red / blue every `period` s (on = false: both dark) */
export function flashLights(car, t, period = .3, on = true) {
  const L = car.userData.lights || []; const k = Math.floor(t / period) % 2;
  L.forEach((m, i) => { m.material = M(on && i === k ? '!' + m.userData.on : (m.userData.on === 'red' ? 'plum' : 'navy')); }); return car;
}
/** server LEDs blink (each its own rhythm) */
export function blinkLeds(rack, t) { for (const m of rack.userData.leds || []) m.visible = Math.sin((t * (2 + m.userData.ph * 5) + m.userData.ph * 9)) > -.4; return rack; }

// =====================================================================================================================
// PLACEMENT
// =====================================================================================================================
const supTop = s => s.position.y + (s.userData.top ?? s.userData.size?.[1] ?? 0) * s.scale.y;
const addOver = (obj, s) => { const u = obj.userData; if (u.over === true) return; u.over = [...(Array.isArray(u.over) ? u.over : []), s]; };
/** put obj's bottom on the floor (o.y, default 0) or on top of o.on (its userData.top or height) at x, z; o.rotY turns it */
export function place(obj, x = 0, z = 0, o = {}) {
  obj.position.set(x, (o.on ? supTop(o.on) : (o.y ?? 0)) + (o.lift ?? 0), z);
  if (o.rotY != null) obj.rotation.y = o.rotY;
  if (o.on) addOver(obj, o.on);
  return obj;
}
/** stand obj on top of support, offset (dx, dz) in the support's own frame (turns with it); rotY relative to the support */
export function onTop(obj, support, o = {}) {
  const a = support.rotation.y, dx = o.dx ?? 0, dz = o.dz ?? 0;
  return place(obj, support.position.x + dx * Math.cos(a) + dz * Math.sin(a), support.position.z - dx * Math.sin(a) + dz * Math.cos(a), { on: support, rotY: a + (o.rotY ?? 0) });
}
/** lay out objects: { row: true } (along X), { grid: cols }, { arc: radius, spread: degrees } around (x, z); gap between footprints; on / y like place */
export function arrange(objs, o = {}) {
  const { gap = .3, x = 0, z = 0 } = o, sz = ob => ob.userData.size || [1, 1, 1];
  if (o.grid) {
    const cols = o.grid, cw = Math.max(...objs.map(ob => sz(ob)[0])) + gap, cd = Math.max(...objs.map(ob => sz(ob)[2])) + gap, rows = Math.ceil(objs.length / cols);
    objs.forEach((ob, i) => place(ob, x + (i % cols - (cols - 1) / 2) * cw, z + (Math.floor(i / cols) - (rows - 1) / 2) * cd, o));
  } else if (o.arc) {
    const R0 = o.arc, sp = (o.spread ?? 100) * Math.PI / 180, n = objs.length;
    objs.forEach((ob, i) => { const a = n > 1 ? -sp / 2 + sp * i / (n - 1) : 0; place(ob, x + Math.sin(a) * R0, z + R0 * (1 - Math.cos(a)), { ...o, rotY: -a }); });
  } else {
    const tot = objs.reduce((s, ob) => s + sz(ob)[0], 0) + gap * (objs.length - 1); let cx = x - tot / 2;
    objs.forEach(ob => { const w = sz(ob)[0]; place(ob, cx + w / 2, z, o); cx += w + gap; });
  }
  return objs;
}

// =====================================================================================================================
// REGISTRY (for the skill and the editor): name -> { make(opts), desc, cat }
// =====================================================================================================================
const P = (make, cat, desc) => ({ make, cat, desc });
export const PROPS = {
  smartphone: P(smartphone, 'device', 'phone 7.5x16 cm, upright screen +Z; { screen, ramp, case, lying }'),
  tablet: P(tablet, 'device', 'tablet 25x17.5 cm landscape; { screen, ramp, lying }'),
  gamingPhone: P(gamingPhone, 'device', 'gaming phone: vents, RGB strip, shoulder triggers; { screen, ramp, accent, lying }'),
  laptop: P(laptop, 'device', 'laptop 32x22 cm; { open, angle, screen, ramp }'),
  pcTower: P(pcTower, 'device', 'gaming PC 21x46x45 cm, side window on +X; { glass, rgb, ramp, accent, accent2, pane }'),
  monitor: P(monitor, 'device', '27" monitor on a stand; { screen, ramp, w }'),
  crtTv: P(crtTv, 'device', 'tube TV; { screen, ramp, antenna }'),
  gpuCard: P(gpuCard, 'device', 'graphics card on edge, fans +Z (spinFan); { fans, ramp, accent }'),
  cpuChip: P(cpuChip, 'device', 'desktop CPU 3.75 cm (use scale); { pins }'),
  socChip: P(socChip, 'device', 'phone SoC 1.4 cm with labelled die blocks (userData.blocks); { die }'),
  ramStick: P(ramStick, 'device', 'DDR module 13.3 cm on its contacts; { ramp, heatsink, rgb }'),
  ssd: P(ssd, 'device', 'M.2 SSD (or type 2.5); { type, ramp, sticker }'),
  hdd: P(hdd, 'device', '3.5" hard drive; { open }'),
  motherboard: P(motherboard, 'device', 'ATX board 30.5x24.4 cm; { ramp, chip }'),
  controller: P(controller, 'device', 'gamepad lying flat; { ramp }'),
  heatsinkFan: P(heatsinkFan, 'device', 'tower CPU cooler with fan (spinFan); { spin, rgb }'),
  cable: P(cable, 'device', 'cable(points, { ramp, r, plugs })', ),
  ps3: P(ps3, 'console', 'PS3 fat lying flat'), ps4: P(ps4, 'console', 'PS4 slanted slabs + light bar; { light }'), ps5: P(ps5, 'console', 'PS5 standing; { ramp, light }'),
  xbox360: P(xbox360, 'console', 'Xbox 360 lying flat'), xboxOne: P(xboxOne, 'console', 'Xbox One box'), nintendoSwitch: P(nintendoSwitch, 'console', 'Switch + Joy-Cons, upright; { dock, left, right, screen }'),
  steamDeck: P(steamDeck, 'console', 'Steam Deck upright; { screen, ramp }'),
  sedan: P(sedan, 'world', '4.7 m sedan nose +X; { ramp, glass, lights }'), sportsCar: P(sportsCar, 'world', 'sports coupe; { ramp, lights }'),
  policeCar: P(policeCar, 'world', 'police sedan, light bar (flashLights)'), taxi: P(taxi, 'world', 'yellow taxi with roof sign'),
  motorbike: P(motorbike, 'world', 'sport bike nose +X; { ramp }'), palmTree: P(palmTree, 'world', 'palm 9 m; { h, lean, seed, fronds }'),
  streetLight: P(streetLight, 'world', 'street light 8 m, arm +X, origin at pole; { h, lit, arm }'),
  trafficLight: P(trafficLight, 'world', 'traffic light; { state, arm } (setTrafficLight)'),
  billboard: P(billboard, 'world', 'billboard 8x3.5 m on a 6 m pole; { image, w, h, pole, lit }'),
  bench: P(bench, 'world', 'park bench 1.8 m'), hydrant: P(hydrant, 'world', 'fire hydrant'), dumpster: P(dumpster, 'world', 'dumpster; { ramp }'),
  fence: P(fence, 'world', 'fence along X; { length, type: wood|chain|metal, h }'), vineSign: P(vineSign, 'world', 'hillside sign of generic blocks; { widths, h }'),
  skyscraper: P(skyscraper, 'world', 'tower; { floors, w, d, ramp, style: grid|bands, lit, night, seed, spire }'),
  house: P(house, 'world', 'LA bungalow; { ramp, roof, w, d }'), gasStation: P(gasStation, 'world', 'gas station 16x20 m; { ramp, accent, lit }'),
  desk: P(desk, 'office', 'desk (top = h); { w, d, h, ramp, legs, drawers }'), officeChair: P(officeChair, 'office', 'office chair facing +Z'),
  serverRack: P(serverRack, 'office', '42U rack (blinkLeds); { leds, units, ramp }'), whiteboard: P(whiteboard, 'office', 'whiteboard; { w, stand }'),
  coffeeMug: P(coffeeMug, 'office', 'mug; { ramp, coffee }'), pottedPlant: P(pottedPlant, 'office', 'office plant; { h, ramp, pot }'), bookshelf: P(bookshelf, 'office', 'bookshelf; { w, h, d, ramp, seed }'), lamp: P(lamp, 'office', 'desk / floor lamp; { lit, floor }'),
  block: P(block, 'diagram', 'labelled tile; { w, h, d, ramp, label, glow }'), arrow3d: P(arrow3d, 'diagram', 'arrow3d(from, to, { ramp, r, head, glow }) (growArrow)'),
  gate: P(gate, 'diagram', 'translator gate (not solid); { ramp, w, h, field, glowRamp }'), pipe: P(pipe, 'diagram', 'pipe(points, { ramp, r }) (pathAt)'),
  conveyor: P(conveyor, 'diagram', 'conveyor belt (runConveyor, top = h); { length, w, h }'), dataPacket: P(dataPacket, 'diagram', 'glowing data cube; { ramp, s, glow }'),
  stackOfBlocks: P(stackOfBlocks, 'diagram', 'stackOfBlocks(n, { w, h, d, ramps })'), barChart: P(barChart, 'diagram', 'barChart(values, { ramp, ramps, w, maxH }) (setBars)'),
  plinth: P(plinth, 'diagram', 'display pedestal (top = h); { w, h, ramp, accent }'),
};

// worlds props: space, the deep ocean, history and extreme places - the sets of exploration, accident and history shorts.
// Every prop is made in code in the toon look (chunky rounded shapes, 2-3 tones, ink outline) and is ORIGINAL (agency
// names, flags and emblems are invented). Units are metres next to a 1.67 m character; things sit on y = 0 and face +z.
// Floating things (planets, satellites, fish, whales...) have their centre at the local origin; ships and buoys float
// with the waterline at y = 0. Creatures move on their own: userData.update(t) is a pure function of time.
// Extra userData (besides top/seat/grip/solid/screen/light from props.js):
//   spin (rad/s, planets/moons/asteroids/globes), fireAt / lavaAt / exhaustAt / muzzleAt ([x,y,z] local: where an fx
//   goes), ship (the rocket that lifts off its pad), door/lid/arm/wheels/head/barrel (parts to animate),
//   setOpen(k) / setFlow(k) / setFire(k) helpers, deckAt(u) (a point on the rope bridge's deck).
import { THREE, rnd, shade, canvasTex, clamp, lerp, noise1 } from '../core.js';
import { toonMat } from '../rig.js';
import { outlineAll, outlineMat, Noodle, lathe as slathe } from '../geo.js';
import { mergeGeometries, mergeVertices } from '../../vendor/jsm/utils/BufferGeometryUtils.js';

const INK = '#2a1d17', PI = Math.PI, TAU = PI * 2;
const V2 = (x, y) => new THREE.Vector2(x, y), V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- materials
const M = (c, o = {}) => toonMat(c, o);
/** emissive (real light sources only: lamps, screens, lava, glowing lures) */
const glow = (c, ei = 1.6, o = {}) => toonMat(c, { emissive: c, ei, rough: .5, ...o });
const VCM = new Map();
/** a toon material that takes its colours from the geometry's vertex colours */
function vcMat(o = {}) { const k = JSON.stringify(o); if (!VCM.has(k)) { const m = toonMat('#ffffff', o).clone(); m.vertexColors = true; VCM.set(k, m); } return VCM.get(k); }
/** see-through (glass, jelly, ghosts): no outline, no shadow */
function seeThru(c, op = .45, o = {}) { const m = toonMat(c, { transparent: true, opacity: op, rough: o.rough ?? .15, emissive: o.emissive, ei: o.ei }).clone(); m.depthWrite = false; if (o.side) m.side = o.side; if (o.add) m.blending = THREE.AdditiveBlending; return m; }
const mapMat = (c, map, o = {}) => toonMat(c, { ...o, map });

// ---------------------------------------------------------------- geometry
const RB = new Map();
/** a rounded box (w, h, d, corner radius r), centred; smooth normals, cached */
function rbox(w, h, d, r = .08, s = 3) {
  const half = [w / 2, h / 2, d / 2]; r = Math.max(1e-3, Math.min(r, half[0] - 1e-4, half[1] - 1e-4, half[2] - 1e-4));
  const key = [w, h, d, r, s].map(x => (+x).toFixed(4)).join(); if (RB.has(key)) return RB.get(key);
  const n = 2 * s + 1, g = new THREE.BoxGeometry(1, 1, 1, n, n, n), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, q = [0, 0, 0], o = V3();
  // BoxGeometry face order px nx py ny pz nz: [u axis, v axis, udir, vdir] (uv = u * udir + .5, .5 - v * vdir), so the texture spans the whole face
  const FACES = [[2, 1, -1, -1], [2, 1, 1, -1], [0, 2, 1, 1], [0, 2, 1, -1], [0, 1, 1, -1], [0, 1, -1, -1]], per = (n + 1) * (n + 1);
  for (let i = 0; i < P.count; i++) {
    for (let a = 0; a < 3; a++) { const k = Math.round((P.array[i * 3 + a] + .5) * n), H = half[a]; q[a] = k <= s ? -H + r * (k / s) : H - r * ((n - k) / s); }
    const F = FACES[Math.min(5, Math.floor(i / per))]; U.setXY(i, q[F[0]] / (2 * half[F[0]]) * F[2] + .5, .5 - q[F[1]] / (2 * half[F[1]]) * F[3]);
    const ix = clamp(q[0], -(half[0] - r), half[0] - r), iy = clamp(q[1], -(half[1] - r), half[1] - r), iz = clamp(q[2], -(half[2] - r), half[2] - r);
    o.set(q[0] - ix, q[1] - iy, q[2] - iz); const L = o.length(); if (L < 1e-9) o.set(0, 1, 0); else o.divideScalar(L);
    P.setXYZ(i, ix + o.x * r, iy + o.y * r, iz + o.z * r); N.setXYZ(i, o.x, o.y, o.z);
  }
  g.userData.smooth = true; g.userData.shared = true; RB.set(key, g); return g;
}
function arcPts(P, cx, cy, r, a0, a1, n = 6) { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; P.push(V2(Math.max(0, cx + Math.cos(a) * r), cy + Math.sin(a) * r)); } }
/** a cylinder / frustum with rounded rims, base at y = 0 (rt top radius, rb bottom radius, b bevel) */
function rcyl(rt, rb = rt, h = 1, b = .05, seg = 32) {
  b = Math.max(1e-3, Math.min(b, h / 2 - 1e-4, Math.max(rt, rb) * .5));
  const P = [V2(0, 0)];
  if (rb > b * 1.01) arcPts(P, rb - b, b, b, -PI / 2, 0); else P.push(V2(rb, 0));
  if (rt > b * 1.01) arcPts(P, rt - b, h - b, b, 0, PI / 2); else P.push(V2(rt, h));
  P.push(V2(0, h));
  return new THREE.LatheGeometry(P, seg);
}
/** a solid of revolution from [r, y] pairs (no smoothing: sharp where you put points close) */
const lathe = (pts, seg = 32, p0 = 0, pl = TAU) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(Math.max(0, r), y)), seg, p0, pl);
/** a lathe turned on its side: the profile's y axis becomes +z (noses point +z) */
const zLathe = (pts, seg = 32, smooth = 0) => { const g = smooth ? slathe(pts, seg, smooth) : lathe(pts, seg); g.rotateX(PI / 2); return g; };
const sphere = (r = 1, w = 32, h = 22) => new THREE.SphereGeometry(r, w, h);
/** an extruded 2D shape, centred on its depth (z) */
function ext(shape, depth, bevel = .02, o = {}) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * (o.bs ?? 1), bevelSegments: o.segs ?? 3, curveSegments: o.cs ?? 16, steps: o.steps ?? 1 });
  g.translate(0, 0, -depth / 2); return g;
}
const shapeOf = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; };
/** a smooth closed shape through points (Catmull-Rom spline) */
function blobShape(pts, n = 64) { const c = new THREE.SplineCurve(pts.map(([x, y]) => V2(x, y))); const P = c.getSpacedPoints(n); const s = new THREE.Shape(); P.forEach((p, i) => i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)); s.closePath(); return s; }
function rrect(w, h, r, s = new THREE.Shape()) { const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
const rrectPath = (w, h, r) => rrect(w, h, r, new THREE.Path());
/** a thin box sheet (flags, sails, maps, scrolls): f(u, v) -> z bulge, sx * sy segments */
function cloth(w, h, t, sx, sy, f) { const g = new THREE.BoxGeometry(w, h, t, sx, sy, 1), P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, P.getZ(i) + f(P.getX(i) / w + .5, P.getY(i) / h + .5)); g.computeVertexNormals(); g.userData.base = P.array.slice(); return g; }

// noise 3D (value noise + fbm) for rocks, planets, ice
function h3(i, j, k, s) { const n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + s * 19.19) * 43758.5453; return n - Math.floor(n); }
function n3(x, y, z, s = 0) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = x - i, v = y - j, w = z - k, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), c = w * w * (3 - 2 * w);
  let r = 0; for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) r += h3(i + dx, j + dy, k + dz, s) * (dx ? a : 1 - a) * (dy ? b : 1 - b) * (dz ? c : 1 - c);
  return r * 2 - 1;
}
const f3 = (x, y, z, s = 0) => n3(x, y, z, s) * .6 + n3(x * 2.13, y * 2.13, z * 2.13, s + 3) * .28 + n3(x * 4.7, y * 4.7, z * 4.7, s + 7) * .12;

/** a lumpy rounded rock / potato: { r, sx, sy, sz, amp, freq, seed, detail, flat (flatten below this y, unit space), box (0..1 squareness) } */
function blob(o = {}) {
  const ico = new THREE.IcosahedronGeometry(1, o.detail ?? 4); ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
  const g = mergeVertices(ico), P = g.attributes.position, v = V3(), s = (o.seed ?? 1) * 1.37, f = o.freq ?? 1.6, A = o.amp ?? .2, e = 1 - (o.box ?? 0) * .75;
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).normalize();
    if (o.box) { v.set(Math.sign(v.x) * Math.abs(v.x) ** e, Math.sign(v.y) * Math.abs(v.y) ** e, Math.sign(v.z) * Math.abs(v.z) ** e); }
    const d = 1 + A * f3(v.x * f + s, v.y * f + s * .7, v.z * f - s * .3, o.seed ?? 1) + (o.crater ? o.crater(v) : 0);
    v.multiplyScalar(d);
    if (o.flat != null && v.y < o.flat) v.y = o.flat + (v.y - o.flat) * .12;
    P.setXYZ(i, v.x * (o.sx ?? 1) * (o.r ?? 1), v.y * (o.sy ?? 1) * (o.r ?? 1), v.z * (o.sz ?? 1) * (o.r ?? 1));
  }
  g.computeVertexNormals(); return g;
}
/** colour every vertex: f(x, y, z, nx, ny, nz) -> '#hex' | THREE.Color */
function paint(g, f) {
  const P = g.attributes.position, N = g.attributes.normal, col = new Float32Array(P.count * 3), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) { const v = f(P.getX(i), P.getY(i), P.getZ(i), N ? N.getX(i) : 0, N ? N.getY(i) : 1, N ? N.getZ(i) : 0, i); c.set(v); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const cmix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(k));

// ---------------------------------------------------------------- scene-graph helpers
const grp = (name = '') => { const g = new THREE.Group(); g.name = name; return g; };
function add(par, geo, mat, p, r, s) {
  const m = new THREE.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]);
  if (s != null) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]); }
  par.add(m); return m;
}
const _up = V3(0, 1, 0);
/** a rod (rounded ends) from point a to b */
function rod(par, a, b, r, mat, o = {}) {
  const A = V3(...a), d = V3(...b).sub(A), L = d.length();
  const g = o.flat ? new THREE.CylinderGeometry(r, o.r2 ?? r, L, o.seg ?? 10).translate(0, L / 2, 0) : rcyl(o.r2 ?? r, r, L, Math.min(r, o.r2 ?? r) * .8, o.seg ?? 12);
  const m = new THREE.Mesh(g, mat); m.position.copy(A); m.quaternion.setFromUnitVectors(_up, d.normalize()); par.add(m); return m;
}
/** a tube along points (ropes, rails, cables, tentacles that do not move) */
function tube(par, pts, r, mat, o = {}) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => V3(...p)), !!o.closed, 'centripetal');
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, o.n ?? Math.max(8, pts.length * 8), r, o.rad ?? 8, !!o.closed), mat); par.add(m);
  if (!o.closed && o.caps !== false) for (const u of [0, 1]) { const p = c.getPointAt(u); add(par, sphere(r, 10, 8), mat, [p.x, p.y, p.z]); }
  return m;
}
/** stop place() from turning a mesh's shadow on (glows, beams, flames, see-through shells) */
function noShadow(m) { m.traverse(x => { if (x.isMesh) { Object.defineProperty(x, 'castShadow', { get: () => false, set: () => {}, configurable: true }); x.userData.noOutline = true; } }); return m; }
/** merge a group's meshes (by material) into a few meshes: lattices, plank rows, coin heaps */
function bake(g) {
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert(), by = new Map();
  g.traverse(m => { if (m.isMesh && !m.userData.isOutline) { if (!by.has(m.material)) by.set(m.material, []); by.get(m.material).push(m); } });
  const out = grp(g.name);
  for (const [mat, list] of by) {
    const keepC = list.every(m => m.geometry.attributes.color);
    const geos = list.map(m => {
      let x = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv', ...(keepC ? ['color'] : [])].includes(k)) x.deleteAttribute(k);
      if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
      x.applyMatrix4(inv.clone().multiply(m.matrixWorld)); return x;
    });
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat); mesh.userData.noOutline = list.every(m => m.userData.noOutline); out.add(mesh);
  }
  return out;
}

// ---------------------------------------------------------------- the ink
/** outline width for a prop of a given size (m): ~0.7 % for hand props, thinner (relative) for buildings and ships */
const olw = size => .0072 * Math.pow(Math.max(.05, size), .8);
const HULLS = new WeakMap();
function hullOf(geo) {
  let h = HULLS.get(geo); if (h) return h;
  const c = new THREE.BufferGeometry(); c.setAttribute('position', geo.attributes.position.clone()); if (geo.index) c.setIndex(geo.index.clone());
  h = mergeVertices(c, 1e-4); h.computeVertexNormals(); h.userData.shared = !!geo.userData.shared; HULLS.set(geo, h); return h;
}
/** outline every solid mesh under root; hard-edged geometry (boxes, extrudes, cylinders) gets a smoothed hull so corners close */
function ink(root, size, o = {}) {
  const w = o.w ?? olw(size), px = o.px ?? 1.2;
  root.traverse(m => {
    if (!m.isMesh || m.userData.isOutline || m.userData.noOutline || m.userData.olMesh || m.userData.live) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material; if (mat?.transparent && (mat.opacity ?? 1) < .99) return;
    const geo = m.geometry, hard = !geo.index || geo.userData.hard || (/Box|Cylinder|Cone|Extrude|Shape|Polyhedron|Octa|Dodeca|Tetra/.test(geo.type) && !geo.userData.smooth);
    if (!hard) return;
    const ol = new THREE.Mesh(hullOf(geo), outlineMat(INK, w, px)); ol.userData.isOutline = true; ol.userData.noPick = true; ol.castShadow = false; ol.receiveShadow = false; ol.renderOrder = m.renderOrder;
    m.add(ol); m.userData.olMesh = ol;
  });
  outlineAll(root, INK, w, px);
  return root;
}

// ---------------------------------------------------------------- canvas textures (cached)
const TEX = new Map();
const tex = (key, w, h, fn, o = {}) => { if (!TEX.has(key)) { const t = canvasTex(w, h, fn); if (o.wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } if (o.rep) t.repeat.set(o.rep[0], o.rep[1]); TEX.set(key, t); } return TEX.get(key); };
/** pixel-by-pixel canvas: f(u, v) -> [r, g, b] (0..255) */
function pixels(x, w, h, f) { const im = x.createImageData(w, h), d = im.data; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = f((i + .5) / w, (j + .5) / h), k = (j * w + i) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = c[3] ?? 255; } x.putImageData(im, 0, 0); }
const rgb = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b].map(v => Math.round(Math.pow(v, 1 / 2.2) * 255)); };
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lerp3 = (a, b, k) => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * clamp(k));
/** equirect direction for sphere UVs (three's SphereGeometry mapping) */
function dirOf(u, v) { const ph = u * TAU, th = v * PI; return [-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)]; }
/** crinkled foil (gold on landers and satellites): grey-scale, tinted by the material colour */
const foilTex = () => tex('foil', 256, 256, (x, w, h) => {
  x.fillStyle = '#ececec'; x.fillRect(0, 0, w, h); const R = rnd(11);
  for (let i = 0; i < 160; i++) { const cx = R() * w, cy = R() * h, n = 3 + (R() * 3 | 0), s = 10 + R() * 22; x.fillStyle = `rgba(${R() < .55 ? '255,255,255' : '170,160,150'},${.15 + R() * .25})`; x.beginPath(); for (let k = 0; k < n; k++) { const a = k / n * TAU + R(); x.lineTo(cx + Math.cos(a) * s * (.5 + R()), cy + Math.sin(a) * s * (.5 + R())); } x.fill(); }
  x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; for (let i = 0; i < 22; i++) { x.beginPath(); const y = R() * h; x.moveTo(R() * w, y); x.lineTo(R() * w, y + (R() - .5) * 40); x.stroke(); }
}, { wrap: true, rep: [2, 2] });
const foilMat = (c = '#f0b445') => mapMat(c, foilTex(), { rough: .42, metal: .12 });
/** yellow / black hazard stripes (uv in metres: ~0.17 m stripes) */
const hazardTex = () => tex('hazard', 256, 256, (x, w, h) => { x.fillStyle = '#f1c232'; x.fillRect(0, 0, w, h); x.fillStyle = '#26262b'; for (let i = -4; i < 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 32, 0); x.lineTo(i * 64 + 32 + h, h); x.lineTo(i * 64 + h, h); x.fill(); } }, { wrap: true, rep: [1.5, 1.5] });
/** solar cells: dark blue grid with a glossy sweep */
const cellTex = () => tex('cells', 512, 256, (x, w, h) => {
  x.fillStyle = '#c9d2e6'; x.fillRect(0, 0, w, h);
  const nx = 8, ny = 4, gx = w / nx, gy = h / ny;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const g = x.createLinearGradient(i * gx, j * gy, (i + 1) * gx, (j + 1) * gy); g.addColorStop(0, '#2a4aa6'); g.addColorStop(.55, '#1c2f74'); g.addColorStop(1, '#2d50b0'); x.fillStyle = g; x.fillRect(i * gx + 4, j * gy + 4, gx - 8, gy - 8); x.strokeStyle = 'rgba(160,190,255,.35)'; x.lineWidth = 1.5; for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(i * gx + 4, j * gy + k * gy / 4); x.lineTo((i + 1) * gx - 4, j * gy + k * gy / 4); x.stroke(); } }
  const s = x.createLinearGradient(0, 0, w, h); s.addColorStop(.3, 'rgba(255,255,255,0)'); s.addColorStop(.45, 'rgba(255,255,255,.22)'); s.addColorStop(.6, 'rgba(255,255,255,0)'); x.fillStyle = s; x.fillRect(0, 0, w, h);
});
/** fake reflection (visors, portholes): sky above, dark below, a highlight streak */
const reflTex = (top = '#ffe9b0', bot = '#6a3d10', key = 'refl') => tex(key + top + bot, 256, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(.48, shade(top, -.25)); g.addColorStop(.52, bot); g.addColorStop(1, shade(bot, -.3)); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(w * .32, h * .3, w * .2, h * .06, -.6, 0, TAU); x.fill(); x.beginPath(); x.ellipse(w * .62, h * .2, w * .06, h * .025, -.6, 0, TAU); x.fill();
});
/** text on a sign / hull: lines of Inter 800 */
function textTex(text, o = {}) {
  const W = o.w ?? 512, H = o.h ?? 128, lines = String(text).split('\n');
  return canvasTex(W, H, (x, w, h) => {
    if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, w, h); } else x.clearRect(0, 0, w, h);
    x.fillStyle = o.color ?? '#1d1d24'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const fs = (o.size ?? .62) * h / lines.length; x.font = `${o.weight ?? 800} ${fs}px ${o.font ?? 'Inter, Arial, sans-serif'}`;
    lines.forEach((l, i) => { let s = fs; x.font = `${o.weight ?? 800} ${s}px ${o.font ?? 'Inter, Arial, sans-serif'}`; while (x.measureText(l).width > w * .9 && s > 8) { s *= .92; x.font = `${o.weight ?? 800} ${s}px ${o.font ?? 'Inter, Arial, sans-serif'}`; } x.fillText(l, w / 2, h * (i + .5) / lines.length + (o.dy ?? 0)); });
  });
}
/** a fresnel halo shell (atmospheres, comas): additive, no outline, no shadow */
function halo(r, color, o = {}) {
  const s = new THREE.Mesh(sphere(r, 48, 32), softGlow(color, { ...o, rim: !o.inv })); s.userData.noPick = true; noShadow(s); return s;
}
/** additive glow material: rim (bright at the silhouette: atmospheres) or core (bright facing the camera: comas, beams, tails);
 *  fade: also fade along uv.y (1 = full at v = 1) */
function softGlow(color, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) }, p: { value: o.pow ?? 2.4 }, a: { value: o.alpha ?? 1 }, rim: { value: o.rim ? 1 : 0 }, fade: { value: o.fade ?? 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: o.side ?? THREE.FrontSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec2 vU; void main(){ vU = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 c; uniform float p; uniform float a; uniform float rim; uniform float fade; varying vec3 vN; varying vec3 vV; varying vec2 vU;
      void main(){ float d = abs(dot(normalize(vN), normalize(vV)));
        float f = rim > .5 ? pow(1. - d, p) * smoothstep(0., .35, d) : pow(d, p);
        if (fade > 0.) f *= pow(clamp(vU.y, 0., 1.), fade);
        gl_FragColor = vec4(c * f * a * 1.6, 1.); }`,
  });
}

// =====================================================================================================================
// SPACE
// =====================================================================================================================
const nameTex = (name, color) => canvasTex(128, 512, (x, w, h) => { x.clearRect(0, 0, w, h); x.save(); x.translate(w / 2, h / 2); x.rotate(PI / 2); x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; let s = 96; x.font = `800 ${s}px Inter, Arial`; while (x.measureText(name).width > h * .92) { s *= .92; x.font = `800 ${s}px Inter, Arial`; } x.fillText(name, 0, 4); x.restore(); });
/** a porthole: rim + glass dome, looking along +z (r radius) */
function porthole(par, p, r, rim, glassC = '#2c4f7a', o = {}) {
  const g = grp('porthole'); g.position.set(...p); if (o.rot) g.rotation.set(...o.rot);
  add(g, rcyl(r, r, o.depth ?? r * .5, r * .2, 28), M(rim, { rough: .45, metal: .2 }), [0, 0, -(o.depth ?? r * .5) * .5], [PI / 2, 0, 0]);
  const gl = add(g, sphere(r * .78, 24, 14), o.lit ? glow(o.lit, o.ei ?? .9) : mapMat('#ffffff', reflTex('#9fd4ff', glassC, 'port'), { rough: .15 }), [0, 0, (o.depth ?? r * .5) * .5 - r * .2], null, [1, 1, .35]);
  gl.rotation.z = -.5;
  par.add(g); return g;
}
const SPACE = {
  rocket: { tags: ['space', 'vehicle'], desc: 'a rocket standing on its launch pad with a service tower (h: height of the rocket in m, default 30; pad, tower, color accent, body colour, name: side text). userData.ship lifts off (move it), exhaustAt',
    make(o) {
      const H = o.h ?? 30, k = H / 30, root = grp('rocket'), inner = grp(); inner.scale.setScalar(k); root.add(inner);
      const acc = o.color ?? '#e2432f', white = o.body ?? '#f2ede2', dark = '#3b3f4b', R = 2.3;
      const padTop = o.pad === false ? 0 : 2, ship = grp('ship'); ship.position.y = padTop; inner.add(ship);
      // engine bell + body + nose
      add(ship, lathe([[0, .55], [1.05, .1], [1.35, 0], [1.3, .25], [1.0, 1.0], [.78, 1.7], [.72, 2.3], [0, 2.3]], 32), M(dark, { rough: .4, metal: .3 }));
      add(ship, rcyl(R, R, 16, .35, 48), M(white, { rough: .55 }), [0, 2.2, 0]);
      const nose = []; for (let i = 0; i <= 16; i++) { const u = i / 16; nose.push([R * Math.pow(1 - u * u, .62) * (1 - .02 * u), 18.1 + u * 11.6]); } nose.push([0, 29.8]);
      add(ship, lathe([[0, 18], [R, 18], ...nose], 48), M(acc, { rough: .45 }));
      // bands (torus rings sit half inside the body: no coplanar faces)
      for (const y of [3.2, 11.5, 18.1]) add(ship, new THREE.TorusGeometry(R + .02, .2, 10, 48), M(y === 11.5 ? dark : acc, { rough: .5 }), [0, y, 0], [PI / 2, 0, 0]);
      porthole(ship, [0, 21.2, R - .05], .75, '#d7dbe2', '#20406a', { depth: .5 });
      porthole(ship, [0, 15.4, R - .05], .38, '#d7dbe2', '#20406a', { depth: .35 });
      // fins (4, swept)
      const fin = ext(shapeOf([[0, 7.2], [1.0, 6.4], [2.7, 2.2], [3.0, -.5], [2.35, -.5], [1.4, .9], [0, 1.4]]), .34, .1);
      for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4, f = add(ship, fin, M(acc, { rough: .45 }), [0, 0, 0]); f.position.set(Math.cos(a) * (R - .25), .4, -Math.sin(a) * (R - .25)); f.rotation.y = a; }
      // vertical name
      if (o.name !== false) { const n = add(ship, new THREE.CylinderGeometry(R + .03, R + .03, 7.2, 24, 1, true, -.45, .9), mapMat('#ffffff', nameTex(o.name ?? 'KESTREL', '#1f2433')), [0, 7.35, 0]); n.material.transparent = false; n.material.alphaTest = .5; n.userData.noOutline = true; }
      if (o.pad !== false) {
        add(inner, rcyl(7.2, 7.8, 2, .35, 48), M('#a4a39d', { rough: .9 }));
        add(inner, rcyl(5, 5.2, .3, .1, 48), M('#8d8c87', { rough: .9 }), [0, 1.9, 0]);
        const ring = add(inner, new THREE.RingGeometry(5.4, 6.4, 64, 1), mapMat('#ffffff', tex('hazring', 512, 32, (x, w, h) => { x.fillStyle = '#f1c232'; x.fillRect(0, 0, w, h); x.fillStyle = '#26262b'; for (let i = 0; i < 40; i++) { x.beginPath(); x.moveTo(i * w / 40, 0); x.lineTo(i * w / 40 + 6, 0); x.lineTo(i * w / 40 + 6 - 10, h); x.lineTo(i * w / 40 - 10, h); x.fill(); } })), [0, 2.012, 0], [-PI / 2, 0, 0]);
        ring.userData.noOutline = true; ring.geometry = (() => { const g = ring.geometry, P = g.attributes.position, U = g.attributes.uv; for (let i = 0; i < P.count; i++) { const a = Math.atan2(P.getY(i), P.getX(i)), rr = Math.hypot(P.getX(i), P.getY(i)); U.setXY(i, (a / TAU + .5) * 1, (rr - 5.4) / 1); } return g; })();
        for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; add(inner, rbox(.8, 1.2, .8, .15), M('#5d5f66', { rough: .6 }), [Math.cos(a) * 1.8, 2.4, Math.sin(a) * 1.8]); }
      }
      if (o.tower !== false && o.pad !== false) {
        const T = grp('tower'), tc = M('#d8562c', { rough: .6 }), tx = R + 4.6, s = 1.3, top = 27, y0 = 2, C4 = [[-s, -s], [s, -s], [s, s], [-s, s]];
        for (const [dx, dz] of C4) rod(T, [tx + dx, y0, dz], [tx + dx, y0 + top, dz], .17, tc, { flat: true, seg: 8 });
        for (let y = y0 + .5, i = 0; y < y0 + top; y += 2.6, i++) for (let f = 0; f < 4; f++) {
          const a = C4[f], b = C4[(f + 1) % 4]; rod(T, [tx + a[0], y, a[1]], [tx + b[0], y, b[1]], .1, tc, { flat: true, seg: 6 });
          if (y + 2.6 < y0 + top) { const [p, q] = (i + f) % 2 ? [a, b] : [b, a]; rod(T, [tx + p[0], y, p[1]], [tx + q[0], y + 2.6, q[1]], .07, tc, { flat: true, seg: 6 }); }
        }
        inner.add(bake(T));
        add(inner, rbox(tx - s - R + .4, .5, 1.6, .12), M('#9aa0a8', { rough: .6 }), [(tx - s + R - .4) / 2, 2 + 19.6, 0]);
        add(inner, rbox(1.4, 1.6, 1.6, .2), M('#c9cdd3', { rough: .6 }), [R + .35, 2 + 19.9, 0]);
        add(inner, rbox(3.2, .4, 3.2, .1), M('#9aa0a8'), [tx, 2 + top + .2, 0]);
        rod(inner, [tx, 2 + top + .4, 0], [tx, 2 + top + 4, 0], .08, M('#9aa0a8'));
        add(inner, sphere(.22, 12, 8), glow('#ff4433', 2.2), [tx, 2 + top + 4.1, 0]);
      }
      root.userData.ship = ship; root.userData.exhaustAt = [0, padTop * k, 0];
      return ink(root, H * .55);
    } },

  'crew-capsule': { tags: ['space', 'vehicle'], desc: 'a cone-shaped crew capsule on its heat shield (d: base diameter, default 4; chutes: three parachutes above it, for splashdowns). userData.hatch',
    make(o) {
      const D = o.d ?? 4, k = D / 4, root = grp('crew-capsule'), g = grp(); g.scale.setScalar(k); root.add(g);
      const white = o.color ?? '#eceae4', side = (y) => 1.95 - (y - .45) * (1.2 / 2.55);
      add(g, lathe([[0, 0], [1.55, .05], [1.9, .16], [2.02, .3], [2.0, .42], [0, .42]], 48), M('#6b4a35', { rough: .8 }));
      const body = []; body.push([0, .4], [1.98, .4]); for (let i = 0; i <= 12; i++) { const y = .45 + i * 2.55 / 12; body.push([side(y) + .04 * Math.sin(i / 12 * PI), y]); } body.push([.72, 3.08], [.62, 3.12], [0, 3.12]);
      add(g, lathe(body, 48), M(white, { rough: .55 }));
      add(g, rcyl(.55, .6, .6, .1, 32), M('#9ca3ad', { rough: .5, metal: .2 }), [0, 3.05, 0]);
      add(g, new THREE.TorusGeometry(.6, .06, 8, 32), M('#5d6470'), [0, 3.62, 0], [PI / 2, 0, 0]);
      add(g, new THREE.TorusGeometry(1.86, .09, 10, 64), M(o.accent ?? '#f08a2a', { rough: .5 }), [0, .82, 0], [PI / 2, 0, 0]);
      const slope = Math.atan2(1.2, 2.55);
      for (const sx of [-1, 1]) { const y = 2.25, r = side(y); const w = porthole(g, [sx * .52, y, Math.sqrt(r * r - .27) - .02], .2, '#c4c8cf', '#203a60', { depth: .2 }); w.rotation.set(-slope, sx * .38, 0); }
      const hatch = grp('hatch'); const hy = 1.35, hr = side(hy); hatch.position.set(0, hy, hr - .02); hatch.rotation.x = -slope; g.add(hatch);
      add(hatch, rbox(.9, .95, .14, .14), M('#d4d6da', { rough: .5 }));
      add(hatch, rbox(.42, .08, .1, .04), M('#3b3f4b'), [0, -.18, .08]);
      for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4, y = 2.1, r = side(y); const q = add(g, rbox(.3, .3, .18, .06), M('#4a4e58'), [Math.sin(a) * r, y, Math.cos(a) * r]); q.rotation.y = a; q.rotateX(-slope); }
      if (o.chutes) {
        const cg = grp('chutes'); g.add(cg);
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * TAU + .3, cx = Math.sin(a) * 2.6, cz = Math.cos(a) * 2.6 - .5, cy = 12.5 + (i === 1 ? .8 : 0);
          const can = lathe([[0, 1.68], [1.2, 1.5], [2.1, .95], [2.5, .05], [2.7, 0], [2.75, .2], [2.3, 1.1], [1.3, 1.7], [0, 1.9]], 24);
          paint(can, (x, y, z) => (Math.floor((Math.atan2(z, x) / TAU + .5) * 12) % 2) ? '#f7f1e6' : '#e2432f');
          const c = add(cg, can, vcMat({ rough: .7 }), [cx, cy, cz]); c.rotation.set(Math.cos(a) * .25, 0, -Math.sin(a) * .25);
          for (let j = 0; j < 6; j++) { const b = j / 6 * TAU; const top = V3(Math.cos(b) * 2.6, .05, Math.sin(b) * 2.6).applyEuler(c.rotation).add(c.position); const l = rod(cg, [top.x, top.y, top.z], [0, 3.7, 0], .02, M('#d8d2c4'), { flat: true }); l.userData.noOutline = true; }
        }
      }
      root.userData.hatch = hatch;
      return ink(root, D);
    } },

  'lunar-lander': { tags: ['space', 'vehicle'], desc: 'a lunar lander on four legs: gold-foil descent stage, silver crew cabin with windows, ladder on the front leg (size: scale, default 1 = 6.6 m tall). userData.cabin (the ascent stage)',
    make(o) {
      const k = o.size ?? 1, root = grp('lunar-lander'), g = grp(); g.scale.setScalar(k); root.add(g);
      const foil = foilMat(), silver = M('#cfd3d9', { rough: .45, metal: .15 }), dark = M('#3a3d45', { rough: .5 }), leg = M('#b8bcc4', { rough: .4, metal: .3 });
      const ds = lathe([[0, 0], [1.9, 0], [2.15, .12], [2.25, .35], [2.25, 1.35], [2.15, 1.58], [1.9, 1.7], [0, 1.7]], 8, PI / 8); const st = add(g, ds, foil, [0, 1.1, 0]); void st;
      add(g, rcyl(1.4, 1.5, .25, .08, 8), M('#2f3239'), [0, .9, 0]);
      add(g, lathe([[0, .2], [.6, 0], [.75, .1], [.5, .5], [.4, .7], [0, .7]], 24), dark, [0, .55, 0]);
      for (let i = 0; i < 4; i++) {
        const a = i * PI / 2, c = Math.cos(a), s = Math.sin(a), out = 3.25;
        rod(g, [c * 2.0, 2.5, s * 2.0], [c * out, .32, s * out], .12, leg);
        rod(g, [c * 1.5, 1.1, s * 1.5], [c * (out - .55), 1.2, s * (out - .55)], .07, leg);
        rod(g, [c * 2.05 - s * .9, 1.3, s * 2.05 + c * .9], [c * (out - .3), .9, s * (out - .3)], .06, leg);
        add(g, rcyl(.42, .48, .16, .07, 24), M('#d6d9de', { rough: .5 }), [c * out, 0, s * out]);
        add(g, sphere(.16, 12, 10), leg, [c * out, .3, s * out]);
      }
      // ladder on the +z leg
      const z0 = 2.05, z1 = 3.15;
      for (const sx of [-.28, .28]) rod(g, [sx, 2.45, z0], [sx, .35, z1], .035, leg, { flat: true });
      for (let i = 1; i < 8; i++) { const u = i / 8; rod(g, [-.28, lerp(2.45, .35, u), lerp(z0, z1, u)], [.28, lerp(2.45, .35, u), lerp(z0, z1, u)], .028, leg, { flat: true }); }
      add(g, rbox(.9, .12, .7, .05), silver, [0, 2.86, 2.0]);
      // ascent stage (crew cabin)
      const cab = grp('cabin'); cab.position.y = 2.8; g.add(cab);
      add(cab, rbox(2.5, 1.9, 2.3, .3), silver, [0, 1.05, -.1]);
      add(cab, lathe([[0, 0], [1.05, 0], [1.2, .2], [1.2, 1.35], [1.0, 1.6], [0, 1.65]], 8, PI / 8), M('#9ea4ad', { rough: .45, metal: .25 }), [0, .2, .5], null, [1, 1, .62]);
      for (const sx of [-1, 1]) { add(cab, rbox(.5, .4, .1, .1), M('#8e959f', { rough: .45 }), [sx * .36, 1.28, 1.24], [-.18, 0, sx * .22]); add(cab, rbox(.4, .3, .08, .08), mapMat('#ffffff', reflTex('#9fd4ff', '#14213a', 'lens'), { rough: .15 }), [sx * .36, 1.28, 1.29], [-.18, 0, sx * .22]); }
      add(cab, rbox(.75, .75, .14, .1), M('#d9dce1'), [0, .55, 1.27]);
      add(cab, rbox(.3, .06, .06, .02), dark, [0, .42, 1.36]);
      for (const sx of [-1, 1]) add(cab, sphere(.55, 20, 14), foil, [sx * 1.35, .9, -.5], null, [.7, 1, 1]);
      add(cab, rcyl(.45, .5, .35, .08, 24), silver, [0, 1.95, -.2]);
      rod(cab, [.85, 1.8, -.8], [1.25, 2.9, -1.0], .04, leg); const dish = add(cab, lathe([[0, 0], [.45, .12], [.52, .2], [.5, .22], [0, .08]], 24), M('#eef0f2'), [1.25, 2.9, -1.0]); dish.rotation.set(.9, .5, 0);
      for (const [x, z] of [[-1.3, .9], [1.3, .9], [-1.3, -1.1], [1.3, -1.1]]) { add(cab, rbox(.24, .24, .24, .05), dark, [x, 1.4, z]); for (const d of [[1, 0, 0], [0, 1, 0], [0, -1, 0]]) add(cab, rcyl(.03, .07, .16, .02, 10), dark, [x + d[0] * .12 * Math.sign(x), 1.4 + d[1] * .12, z], [0, 0, d[0] ? -Math.sign(x) * PI / 2 : d[1] < 0 ? PI : 0]); }
      root.userData.cabin = cab;
      return ink(root, 6.6 * k);
    } },

  rover: { tags: ['space', 'vehicle'], desc: 'a six-wheeled planetary rover with a camera mast that has two lens eyes, dish antenna and power unit (scale; 3 m long). userData.wheels (spin on x), head (the mast camera, turn it)',
    make(o) {
      const k = o.size ?? 1, root = grp('rover'), g = grp(); g.scale.setScalar(k); root.add(g);
      const body = M(o.color ?? '#efebe2', { rough: .55 }), dark = M('#3e424b', { rough: .6 }), metal = M('#9da4ae', { rough: .4, metal: .3 }), foil = foilMat('#eeae3e'), acc = M(o.accent ?? '#f08a2a', { rough: .5 });
      const tread = tex('tread', 512, 64, (x, w, h) => { x.fillStyle = '#5a5e68'; x.fillRect(0, 0, w, h); x.fillStyle = '#383b43'; for (let i = 0; i < 20; i++) { const a = i * w / 20; x.beginPath(); x.moveTo(a, 0); x.lineTo(a + 12, h / 2); x.lineTo(a, h); x.lineTo(a + 10, h); x.lineTo(a + 22, h / 2); x.lineTo(a + 10, 0); x.fill(); } });
      add(g, rbox(1.5, .5, 2.1, .16), body, [0, 1.12, 0]);
      add(g, rbox(1.56, .16, 2.16, .07), foil, [0, .86, 0]);
      add(g, rbox(.55, .28, .5, .08), body, [-.38, 1.5, -.45]);
      add(g, rbox(.42, .2, .42, .07), acc, [.4, 1.45, -.6]);
      add(g, rbox(1.2, .07, .55, .03), M('#d6d0c2'), [0, 1.38, .5]);
      const wheels = [];
      for (const sx of [-1, 1]) {
        for (const z of [-.92, 0, .92]) {
          const wg = grp('wheel'); wg.position.set(sx * 1.12, .42, z); g.add(wg);
          add(wg, rcyl(.42, .42, .36, .12, 32), mapMat('#ffffff', tread, { rough: .8 }), [-.18 * sx, 0, 0], [0, 0, -sx * PI / 2]);
          add(wg, rcyl(.2, .2, .06, .03, 20), acc, [sx * .16, 0, 0], [0, 0, -sx * PI / 2]);
          wheels.push(wg);
          rod(g, [sx * .84, .98, z], [sx * .84, .42, z], .055, metal); rod(g, [sx * .84, .42, z], [sx * .96, .42, z], .06, metal);
        }
        rod(g, [sx * .84, .98, -.98], [sx * .84, .98, .98], .065, metal);
        rod(g, [sx * .7, 1.02, 0], [sx * .84, .98, 0], .08, metal);
      }
      // camera mast with a two-eyed head
      rod(g, [.5, 1.35, .75], [.5, 2.42, .75], .065, metal);
      const head = grp('head'); head.position.set(.5, 2.52, .75); g.add(head);
      add(head, rbox(.62, .34, .38, .1), body);
      add(head, rbox(.5, .07, .3, .03), acc, [0, .19, -.02]);
      for (const sx of [-1, 1]) { add(head, rcyl(.095, .095, .1, .03, 20), dark, [sx * .14, -.01, .16], [PI / 2, 0, 0]); add(head, sphere(.07, 16, 12), mapMat('#ffffff', reflTex('#9fd4ff', '#10192b', 'lens'), { rough: .15 }), [sx * .14, -.01, .27], null, [1, 1, .45]); }
      // dish + power unit + arm
      rod(g, [-.45, 1.62, -.45], [-.45, 1.95, -.45], .05, metal); const dish = add(g, lathe([[0, 0], [.34, .08], [.4, .12], [.38, .14], [0, .05]], 24), M('#f4f2ec'), [-.45, 1.97, -.45]); dish.rotation.set(.7, .5, 0);
      const rtg = add(g, rcyl(.17, .17, .62, .06, 16), dark, [0, 1.12, -1.0]); rtg.rotation.x = -1.1;
      for (let i = 0; i < 6; i++) { const f = add(rtg, rbox(.035, .56, .4, .015), dark, [0, .31, 0]); f.rotation.y = i * PI / 6; }
      rod(g, [-.45, 1.0, 1.02], [-.55, .82, 1.45], .05, metal); rod(g, [-.55, .82, 1.45], [-.15, .7, 1.5], .045, metal); add(g, rbox(.22, .2, .2, .05), dark, [-.1, .68, 1.52]);
      root.userData.wheels = wheels; root.userData.head = head;
      return ink(root, 3 * k);
    } },

  satellite: { tags: ['space', 'vehicle'], desc: 'a satellite floating (centre at origin): gold-foil body, two solar wings facing +z, dish on top (size scale; 12 m span; spin: roll speed rad/s)',
    make(o) {
      const k = o.size ?? 1, root = grp('satellite'), g = grp(); g.scale.setScalar(k); root.add(g);
      const foil = foilMat('#eeae3e'), white = M('#efede6', { rough: .5 }), metal = M('#a9afb8', { rough: .4, metal: .3 }), cells = mapMat('#ffffff', cellTex(), { rough: .35, metal: .15 });
      add(g, rbox(1.7, 1.9, 1.7, .18), foil);
      add(g, rbox(1.76, .18, 1.76, .06), white, [0, .98, 0]); add(g, rbox(1.76, .18, 1.76, .06), white, [0, -.98, 0]);
      for (const sx of [-1, 1]) {
        rod(g, [sx * .85, 0, 0], [sx * 1.8, 0, 0], .07, metal);
        add(g, rcyl(.13, .13, .2, .04, 14), metal, [sx * 1.7, 0, 0], [0, 0, PI / 2]);
        for (const j of [0, 1]) { const x = sx * (2.0 + j * 2.25 + 1.05); add(g, rbox(2.1, 1.6, .09, .04), cells, [x, 0, 0]); add(g, rbox(2.18, 1.68, .05, .02), metal, [x, 0, -.06]); }
      }
      add(g, rcyl(.1, .14, .4, .04, 12), metal, [0, 1.05, 0]);
      const dish = add(g, lathe([[0, 0], [.75, .2], [.88, .3], [.85, .33], [0, .14]], 32), white, [0, 1.42, .1]); dish.rotation.x = .55;
      rod(dish, [0, .1, 0], [0, .62, 0], .025, metal); add(dish, sphere(.07, 10, 8), metal, [0, .65, 0]);
      for (const [x, z] of [[.6, .6], [-.6, -.6]]) rod(g, [x, -1.0, z], [x * 1.4, -2.0, z * 1.4], .02, metal, { flat: true });
      add(g, lathe([[.12, 0], [.2, -.25], [.08, -.25]], 14), M('#3a3d45'), [0, -1.08, 0]);
      root.userData.spin = o.spin ?? 0;
      root.userData.update = t => { g.rotation.z = (root.userData.spin || 0) * t; };
      return ink(root, 6 * k);
    } },

  'station-module': { tags: ['space', 'vehicle'], desc: 'a space-station module floating (centre at origin), long along x, windows on its +z side, docking ring at +x, solar panels above and below (len default 9; panels)',
    make(o) {
      const L = o.len ?? 9, root = grp('station-module'), R = 2.1;
      const panel = tex('stpanel', 256, 256, (x, w, h) => { x.fillStyle = '#ece8df'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(80,70,60,.18)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.stroke(); x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.stroke(); } x.fillStyle = 'rgba(80,70,60,.25)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (const [a, b] of [[8, 8], [56, 8], [8, 56], [56, 56]]) { x.beginPath(); x.arc(i * 64 + a, j * 64 + b, 2.2, 0, TAU); x.fill(); } }, { wrap: true, rep: [8, 3] });
      const bodyG = rcyl(R, R, L, .7, 48); bodyG.translate(0, -L / 2, 0); bodyG.rotateZ(-PI / 2);
      add(root, bodyG, mapMat('#ffffff', panel, { rough: .6 }));
      for (let i = 0; i < 5; i++) add(root, new THREE.TorusGeometry(R + .03, .11, 10, 48), M('#c3beb2', { rough: .55 }), [-L / 2 + 1.2 + i * (L - 2.4) / 4, 0, 0], [0, PI / 2, 0]);
      for (let i = 0; i < 3; i++) porthole(root, [-L / 4 + i * L / 4, .3, R - .08], .32, '#cfd3da', null, { lit: '#ffd58a', ei: .9, depth: .32 });
      add(root, rcyl(1.1, 1.1, .9, .2, 32), M('#b9bec6', { rough: .45, metal: .2 }), [L / 2 - .25, 0, 0], [0, 0, -PI / 2]);
      add(root, new THREE.TorusGeometry(1.15, .14, 10, 36), M('#7f8792'), [L / 2 + .62, 0, 0], [0, PI / 2, 0]);
      for (const y of [.9, -.9]) rod(root, [-L / 2 + 1, y + (y > 0 ? .1 : -.1), R - .12], [L / 2 - 1.5, y + (y > 0 ? .1 : -.1), R - .12], .05, M('#f0c63a'));
      if (o.panels !== false) {
        const cells = mapMat('#ffffff', cellTex(), { rough: .35, metal: .15 }), metal = M('#a9afb8', { rough: .4, metal: .3 });
        for (const sy of [-1, 1]) { rod(root, [-.6, sy * (R - .1), 0], [-.6, sy * (R + 2.2), 0], .1, metal); add(root, rbox(6.2, 2.6, .1, .05), cells, [-.6, sy * (R + 3.4), 0]); add(root, rbox(6.3, .12, .14, .04), metal, [-.6, sy * (R + 2.1), 0]); }
      }
      return ink(root, L);
    } },

  'airlock-door': { tags: ['space', 'vehicle', 'door'], desc: 'an airlock: a wall piece with a rounded hatch door, hazard-striped frame, wheel handle, status lamp and keypad (state: "locked" | "open"; open: 0..1). userData.door, lamp, setOpen(k) slides the door into the wall',
    make(o) {
      const root = grp('airlock-door'), W = 3.6, H = 3.0, dw = 1.6, dh = 2.2, dy = .14 + dh / 2;
      const wallTex = tex('airwall', 256, 256, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4); x.fillStyle = 'rgba(0,0,0,.18)'; for (const [a, b] of [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]]) { x.beginPath(); x.arc(a, b, 4, 0, TAU); x.fill(); } }, { wrap: true, rep: [1 / 1.2, 1 / 1.2] });
      const wallS = new THREE.Shape(); wallS.moveTo(-W / 2, 0); wallS.lineTo(W / 2, 0); wallS.lineTo(W / 2, H); wallS.lineTo(-W / 2, H); wallS.closePath();
      const hole = rrectPath(dw, dh, .35); hole.getPoints(); const hp = new THREE.Path(rrect(dw, dh, .35).getPoints(24).map(p => V2(p.x, p.y + dy))); wallS.holes.push(hp); void hole;
      add(root, ext(wallS, .5, .04, { cs: 24 }), mapMat(o.wall ?? '#8d9aa8', wallTex, { rough: .7 }));
      const frameS = rrect(dw + .5, dh + .5, .5); frameS.holes.push(new THREE.Path(rrect(dw, dh, .35).getPoints(24)));
      const haz = hazardTex();
      add(root, ext(frameS, .16, .04, { cs: 24 }), mapMat('#ffffff', haz, { rough: .6 }), [0, dy, .33]);
      add(root, rbox(dw + .4, dh + .4, .5, .3), M('#1b2029', { rough: .9 }), [0, dy, -.6]);
      const door = grp('door'); door.position.set(0, dy, .05); root.add(door);
      add(door, ext(rrect(dw - .04, dh - .04, .33), .22, .04), M(o.door ?? '#d5dae1', { rough: .5, metal: .1 }));
      add(door, ext(rrect(dw - .5, dh - .6, .2), .06, .02), M('#bfc6cf', { rough: .5 }), [0, -.15, .14]);
      porthole(door, [0, .72, .14], .2, '#9aa3ae', '#1c2a40', { depth: .14 });
      const wheel = grp('wheel'); wheel.position.set(0, -.2, .22); door.add(wheel);
      add(wheel, new THREE.TorusGeometry(.28, .04, 10, 32), M('#d24a2e', { rough: .45 }));
      for (let i = 0; i < 4; i++) rod(wheel, [0, 0, 0], [Math.cos(i * PI / 2 + PI / 4) * .27, Math.sin(i * PI / 2 + PI / 4) * .27, 0], .025, M('#5d636e'));
      add(wheel, rcyl(.07, .07, .08, .02, 16), M('#5d636e'), [0, 0, -.02], [PI / 2, 0, 0]);
      const locked = (o.state ?? 'locked') === 'locked', lampMat = glow(locked ? '#ff3b2a' : '#3dff7a', 2.2).clone();
      const lamp = add(root, sphere(.13, 16, 10), lampMat, [dw / 2 + .6, H - .22, .37], null, [1, 1, .6]); add(root, rcyl(.16, .17, .06, .02, 16), M('#3b4049'), [dw / 2 + .6, H - .22, .3], [PI / 2, 0, 0]);
      const kp = add(root, rbox(.32, .5, .08, .04), M('#3b4049'), [dw / 2 + .55, 1.35, .3]); void kp;
      for (let i = 0; i < 6; i++) add(root, rbox(.07, .06, .04, .015), i === 5 ? glow('#3dff7a', 1.4) : M('#c9ced6'), [dw / 2 + .5 + (i % 2) * .1, 1.48 - Math.floor(i / 2) * .1, .35]);
      add(root, rbox(1.3, .26, .05, .03), mapMat('#ffffff', textTex(o.text ?? 'AIRLOCK 2', { bg: '#2b313b', color: '#f1c232', w: 512, h: 102 })), [0, H - .2, .3]);
      const setOpen = kk => { door.position.x = clamp(kk) * (dw + .2); };
      setOpen(o.open ?? 0);
      Object.assign(root.userData, { door, lamp, setOpen });
      return ink(root, 3.6);
    } },

  'space-flag': { tags: ['space'], desc: 'an expedition flag on a pole with a top bar (no wind needed; colors: [field, emblem], text: a word under the emblem, wind: true to ripple). 2.6 m',
    make(o) {
      const root = grp('space-flag'), [bg, fg] = o.colors ?? ['#f08a2a', '#1d2b4f'];
      const metal = M('#d9dde3', { rough: .35, metal: .3 });
      add(root, rcyl(.03, .03, 2.65, .025, 12), metal);
      rod(root, [-.02, 2.6, 0], [1.3, 2.6, 0], .022, metal);
      const t = canvasTex(512, 340, (x, w, h) => {
        x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = shade(bg, -.18); x.fillRect(0, h * .78, w, h * .22);
        x.fillStyle = '#ffffff'; x.beginPath(); x.arc(w / 2, h * .4, h * .26, 0, TAU); x.fill();
        x.fillStyle = fg; x.beginPath(); x.arc(w / 2, h * .4, h * .16, 0, TAU); x.fill();
        x.strokeStyle = fg; x.lineWidth = h * .04; x.beginPath(); x.ellipse(w / 2, h * .4, h * .33, h * .1, -.35, 0, TAU); x.stroke();
        x.fillStyle = '#ffffff'; x.beginPath(); x.arc(w / 2 + h * .22, h * .22, h * .035, 0, TAU); x.fill();
        if (o.text !== false) { x.fillStyle = '#ffffff'; x.font = `800 ${h * .13}px Inter, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.text ?? 'ORBIS', w / 2, h * .89); }
      });
      const f = (u, v, tt = 0) => Math.sin(u * 7 + tt * 3) * .035 * u + Math.sin(v * 5 + u * 3) * .015;
      const geo = cloth(1.25, .82, .015, 24, 10, (u, v) => f(u, v));
      const flag = add(root, geo, mapMat('#ffffff', t, { rough: .8 }), [.66, 2.17, 0]);
      if (o.wind) { flag.userData.live = true; const P = geo.attributes.position, B = geo.userData.base; root.userData.update = tt => { for (let i = 0; i < P.count; i++) { const u = B[i * 3] / 1.25 + .5, v = B[i * 3 + 1] / .82 + .5; P.setZ(i, B[i * 3 + 2] - f(u, v) + f(u, v, tt) * 2.2); } P.needsUpdate = true; geo.computeVertexNormals(); }; }
      add(root, rcyl(.12, .18, .05, .02, 16), M('#8f8f96', { rough: 1 }), [0, -.02, 0]);
      root.userData.grip = { at: [0, 1.1, 0], rot: [0, 0, 0] };
      return ink(root, 1.6);
    } },

  'moon-rocks': { tags: ['space', 'extreme', 'nature'], desc: 'a small cluster of rounded grey moon rocks (color, n, seed; ~1.3 m wide)',
    make(o) {
      const root = grp('moon-rocks'), R = rnd(o.seed ?? 1), c = o.color ?? '#9b9ba4', n = o.n ?? 3 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) {
        const s = i === 0 ? .55 : .18 + R() * .3, a = R() * TAU, d = i === 0 ? 0 : .45 + R() * .45;
        const m = add(root, blob({ seed: (o.seed ?? 1) * 7 + i, amp: .26, freq: 1.4, detail: 3, flat: -.35, sx: 1 + R() * .4, sy: .75 + R() * .25, box: .25 }), M(i % 2 ? shade(c, -.12) : c, { rough: .95 }), [Math.cos(a) * d, 0, Math.sin(a) * d], [0, R() * TAU, 0], s);
        m.position.y = s * .3;
      }
      return ink(root, 1.2);
    } },

  crater: { tags: ['space', 'extreme', 'nature'], desc: 'a crater: a raised rim around a shallow bowl on flat ground (r: rim radius, default 3; color matches the ground). Walkable (solid: false)',
    make(o) {
      const R = o.r ?? 3, hr = R * .13, c = o.color ?? '#a3a3ab', root = grp('crater');
      const g = slathe([[R * 1.65, -.04], [R * 1.6, .01], [R * 1.35, hr * .25], [R * 1.12, hr * .75], [R, hr], [R * .9, hr * .8], [R * .72, hr * .3], [R * .45, .05], [0, .03]], 72, 6);
      g.deleteAttribute('uv'); g.deleteAttribute('normal'); const m = mergeVertices(g), P = m.attributes.position;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x), y = P.getY(i); if (y > .02) P.setY(i, y * (1 + .35 * noise1(a * 3 + 10, o.seed ?? 1) + .2 * noise1(a * 9, 3))); void r; }
      m.computeVertexNormals();
      paint(m, (x, y, z) => { const r = Math.hypot(x, z); return r < R * .85 ? cmix(shade(c, -.28), shade(c, -.1), r / (R * .85)) : r < R * 1.15 ? cmix(shade(c, .08), c, Math.abs(r - R) / (R * .15)) : c; });
      add(root, m, vcMat({ rough: 1 }));
      root.userData.solid = false;
      return ink(root, R * 1.4);
    } },
};

// ---------------------------------------------------------------- planets (centre at the origin, they float)
const PLANET_TEX = new Map();
function planetTex(kind, seed, f) { const key = kind + seed; if (!PLANET_TEX.has(key)) PLANET_TEX.set(key, canvasTex(512, 256, (x, w, h) => pixels(x, w, h, f))); return PLANET_TEX.get(key); }
function planet(name, r, map, o = {}) {
  const root = grp(name), body = grp('body'); root.add(body);
  const b = add(body, sphere(r, 64, 44), mapMat('#ffffff', map, { rough: o.rough ?? .85 })); void b;
  root.userData.spin = o.spin ?? .06; root.userData.body = body;
  const ups = []; root.userData.update = t => { body.rotation.y = (root.userData.spin || 0) * t; for (const u of ups) u(t); };
  return { root, body, ups };
}
Object.assign(SPACE, {
  'planet-earth': { tags: ['space', 'planet'], desc: 'an Earth-like planet with oceans, green and tan continents, ice caps, a cloud layer and a blue atmosphere glow (r default 3; spin rad/s; seed: other continents). Centre at origin',
    make(o) {
      const r = o.r ?? 3, s = o.seed ?? 1;
      const map = planetTex('earth', s, (u, v) => { const [x, y, z] = dirOf(u, v), n = f3(x * 1.7 + s, y * 1.7, z * 1.7, s) + .12 * f3(x * 6, y * 6, z * 6, s + 2), lat = Math.abs(y);
        if (lat > .9 - .05 * n) return rgb('#f4f8fb');
        if (n > .08) { const k = clamp((n - .08) * 3), dry = clamp(.5 + f3(x * 3, y * 3 + 4, z * 3, s + 9) * 1.2 - lat * .6); return lerp3(lerp3(hexRGB('#5aa845'), hexRGB('#3f8a3a'), k), hexRGB('#d9b56a'), dry * .8); }
        return lerp3(hexRGB('#2d7fd3'), hexRGB('#1b5fae'), clamp(-n * 2.5)); });
      const { root, body, ups } = planet('planet-earth', r, map, o);
      const cloudT = planetTex('clouds', s, (u, v) => { const [x, y, z] = dirOf(u, v), n = f3(x * 2.6 + 5, y * 4, z * 2.6, s + 4); const a = clamp((n - .05) * 4); return [255, 255, 255, a * 235]; });
      const cl = add(root, sphere(r * 1.025, 64, 44), (() => { const m = toonMat('#ffffff', { map: cloudT, rough: 1 }); m.transparent = true; m.depthWrite = false; return m; })()); noShadow(cl);
      root.add(halo(r * 1.045, '#5fb4ff', { pow: 2.8, alpha: .6 }));
      ups.push(t => { cl.rotation.y = (root.userData.spin || 0) * t * 1.3 + .4; }); void body;
      ink(root, r * 2); return root;
    } },
  'planet-red': { tags: ['space', 'planet'], desc: 'a rusty red desert planet with dark plains, craters and a white polar cap, thin pink haze (r default 3; spin; seed). Centre at origin',
    make(o) {
      const r = o.r ?? 3, s = o.seed ?? 2, R = rnd(s), cr = Array.from({ length: 14 }, () => { const u = R() * 2 - 1, a = R() * TAU, q = Math.sqrt(1 - u * u); return [Math.cos(a) * q, u, Math.sin(a) * q, .04 + R() * .09]; });
      const map = planetTex('red', s, (u, v) => { const [x, y, z] = dirOf(u, v), n = f3(x * 1.8 + s, y * 1.8, z * 1.8, s), lat = y;
        if (lat > .9 + .04 * n) return rgb('#fbf3ec');
        let c = lerp3(hexRGB('#cf6a3c'), hexRGB('#e79a62'), clamp(.5 + n * 1.5)); if (n < -.12) c = lerp3(c, hexRGB('#8a3a24'), clamp((-.12 - n) * 4));
        for (const [cx, cy, cz, cs] of cr) { const d = Math.acos(clamp(x * cx + y * cy + z * cz, -1, 1)); if (d < cs) c = lerp3(c, hexRGB('#9c4a2c'), d > cs * .78 ? -.4 : .35); }
        return c; });
      const { root } = planet('planet-red', r, map, o);
      root.add(halo(r * 1.035, '#ffb08a', { pow: 3, alpha: .35 }));
      ink(root, r * 2); return root;
    } },
  'gas-giant': { tags: ['space', 'planet'], desc: 'a banded gas giant with a storm spot and a tilted ring (r default 5; ring: false to drop it; colors: band palette; spin). Centre at origin',
    make(o) {
      const r = o.r ?? 5, s = o.seed ?? 3, pal = (o.colors ?? ['#e9cf9f', '#d39a5c', '#f2e2bf', '#b9773f', '#e7b77a']).map(hexRGB);
      const map = planetTex('giant' + pal.join(), s, (u, v) => { const [x, y, z] = dirOf(u, v), w = y * 7 + f3(x * 2, y * 9, z * 2, s) * .7 + Math.sin(u * TAU * 3) * .05, i = Math.floor(w) , f = w - i;
        let c = lerp3(pal[((i % 5) + 5) % 5], pal[(((i + 1) % 5) + 5) % 5], clamp((f - .7) / .3));
        const du = Math.min(Math.abs(u - .3), 1 - Math.abs(u - .3)) / .055, dv = (v - .63) / .045, e = du * du + dv * dv;
        if (e < 1) { const sw = Math.sin(Math.atan2(dv, du) * 2 + e * 7) * .18; c = lerp3(hexRGB('#c4512f'), hexRGB('#ec9a63'), clamp(e * 1.1 + sw)); } else if (e < 1.35) c = lerp3(c, hexRGB('#f6ead2'), .55);
        return c; });
      const { root, body } = planet('gas-giant', r, map, { ...o, spin: o.spin ?? .1 });
      body.scale.y = .93;
      if (o.ring !== false) {
        const rg = grp('ring'); rg.rotation.set(.38, 0, .22); root.add(rg);
        const rt = tex('ringbands' + s, 512, 16, (x, w) => { const R = rnd(s); for (let i = 0; i < w; i++) { const k = i / w, a = .55 + .45 * Math.sin(k * 40 + R()) * Math.sin(k * 9); x.fillStyle = `rgb(${Math.round(lerp(196, 240, a))},${Math.round(lerp(160, 214, a))},${Math.round(lerp(120, 170, a))})`; x.fillRect(i, 0, 1, 16); } x.fillStyle = 'rgba(40,30,25,.8)'; x.fillRect(w * .58, 0, w * .03, 16); });
        const ringG = lathe([[r * 1.35, 0], [r * 2.15, 0], [r * 2.17, .015], [r * 2.15, .03], [r * 1.35, .03], [r * 1.33, .015], [r * 1.35, 0]], 96);
        const P = ringG.attributes.position, U = ringG.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, (Math.hypot(P.getX(i), P.getZ(i)) - r * 1.35) / (r * .8), .5);
        add(rg, ringG, mapMat('#ffffff', rt, { rough: .9 }), [0, -.015, 0]);
      }
      ink(root, r * 2.2); return root;
    } },
  'small-moon': { tags: ['space', 'planet'], desc: 'a small grey moon covered in craters (r default 1.5; userData.spin rad/s, default .15; seed). Centre at origin',
    make(o) {
      const r = o.r ?? 1.5, s = o.seed ?? 4, R = rnd(s), cr = Array.from({ length: 16 }, () => { const u = R() * 2 - 1, a = R() * TAU, q = Math.sqrt(1 - u * u); return [V3(Math.cos(a) * q, u, Math.sin(a) * q), .12 + R() * .28]; });
      const crater = v => { let d = 0; for (const [c, cs] of cr) { const a = Math.acos(clamp(v.dot(c), -1, 1)) / cs; if (a < 1.4) d += a < 1 ? -.3 * cs * (1 - a * a) : .12 * cs * Math.sin((a - 1) / .4 * PI); } return d; };
      const g = blob({ seed: s, amp: .05, freq: 2, detail: 5, crater });
      const mc = o.color ?? '#bdbcc3';
      paint(g, (x, y, z) => { const v = V3(x, y, z).normalize(); let k = 0, rim = 0; for (const [c, cs] of cr) { const a = Math.acos(clamp(v.dot(c), -1, 1)) / cs; if (a < 1) k = Math.max(k, .55 + .45 * (1 - a)); else if (a < 1.25) rim = 1; } return rim && !k ? shade(mc, .12) : cmix(mc, shade(mc, -.3), k * .8 + f3(x * 3, y * 3, z * 3, s) * .3); });
      const root = grp('small-moon'), body = grp('body'); root.add(body); add(body, g, vcMat({ rough: .95 }), null, null, r);
      root.userData.spin = o.spin ?? .15; root.userData.body = body;
      root.userData.update = t => { body.rotation.y = (root.userData.spin || 0) * t; };
      return ink(root, r * 2);
    } },
  asteroid: { tags: ['space', 'planet'], desc: 'a tumbling potato-shaped asteroid with craters (size: length m, default 3; spin rad/s, default .25; seed). Centre at origin',
    make(o) {
      const L = o.size ?? 3, s = o.seed ?? 5, R = rnd(s), cr = Array.from({ length: 9 }, () => { const u = R() * 2 - 1, a = R() * TAU, q = Math.sqrt(1 - u * u); return [V3(Math.cos(a) * q, u, Math.sin(a) * q), .15 + R() * .3]; });
      const crater = v => { let d = 0; for (const [c, cs] of cr) { const a = Math.acos(clamp(v.dot(c), -1, 1)) / cs; if (a < 1.3) d += a < 1 ? -.12 * cs * (1 - a * a) : .05 * cs * Math.sin((a - 1) / .3 * PI); } return d; };
      const g = blob({ seed: s, amp: .3, freq: 1.2, detail: 4, crater, sx: 1, sy: .62, sz: .72 });
      paint(g, (x, y, z) => cmix(o.color ?? '#8d7f72', shade(o.color ?? '#8d7f72', -.35), .45 + f3(x * 2.5, y * 2.5, z * 2.5, s + 1) * .9));
      const root = grp('asteroid'), body = grp('body'); root.add(body); add(body, g, vcMat({ rough: 1 }), null, null, L / 2);
      root.userData.spin = o.spin ?? .25; root.userData.body = body;
      root.userData.update = t => { const w = root.userData.spin || 0; body.rotation.set(w * t * .7 + s, w * t * .4, w * t * .25); };
      return ink(root, L);
    } },
  comet: { tags: ['space', 'planet'], desc: 'a comet: icy nucleus in a glowing coma with a long blue-white tail streaming toward -z (size: nucleus m, default 1.2; tail length = 14 x size). Centre at origin',
    make(o) {
      const k = o.size ?? 1.2, root = grp('comet'), s = o.seed ?? 6;
      const g = blob({ seed: s, amp: .3, freq: 1.5, detail: 4, sx: 1.2, sy: .8, sz: .9 });
      paint(g, (x, y, z) => cmix('#6f7f95', '#e9f4ff', clamp(.35 + f3(x * 2, y * 2, z * 2, s) * 1.5)));
      const nuc = add(root, g, vcMat({ rough: .9 }), null, null, k / 2);
      root.add(halo(k * 1.7, '#7fc8ff', { inv: true, pow: 3.5, alpha: .3 }));
      const tails = [];
      for (const [c, len, wid, off, al] of [['#4fa8ff', 16, 1.4, 0, .3], ['#ffd99a', 11, 2.6, .5, .22], ['#cfeaff', 9, .7, -.15, .26]]) {
        const geo = new THREE.CylinderGeometry(.5 * k, wid * k, len * k, 28, 8, true); geo.translate(0, -len * k / 2, 0); geo.rotateX(PI / 2);
        const t = add(root, geo, softGlow(c, { pow: 1.6, alpha: al, fade: 1.4, side: THREE.DoubleSide }), [0, off * k, 0]); t.rotation.x = off * .1; noShadow(t); tails.push(t);
      }
      root.userData.update = t => { tails.forEach((m, i) => { m.scale.set(1 + .06 * Math.sin(t * 2.1 + i), 1 + .06 * Math.cos(t * 1.7 + i * 2), 1 + .04 * Math.sin(t * 1.3 + i)); }); nuc.rotation.y = t * .2; };
      return ink(root, k * 2);
    } },
  'space-helmet': { tags: ['space'], desc: 'a white space helmet with a gold reflective visor on a display stand (1.4 m). Without the stand: stand: false (helmet sits on y = 0, 0.45 m)',
    make(o) {
      const root = grp('space-helmet'), stand = o.stand !== false, y0 = stand ? 1.0 : .16;
      if (stand) { add(root, rcyl(.3, .34, .07, .03, 32), M('#3b4049', { rough: .9 })); add(root, rcyl(.035, .045, .93, .02, 12), M('#9ba3ad', { rough: .6, metal: .3 }), [0, .07, 0]); }
      const visT = tex('visor', 256, 256, (x, w, h) => { const g = x.createRadialGradient(w * .4, h * .35, 4, w * .5, h * .5, w * .75); g.addColorStop(0, '#ffe08a'); g.addColorStop(.45, '#e9a531'); g.addColorStop(1, '#8a4a0c'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.ellipse(w * .3, h * .3, w * .16, h * .05, -.5, 0, TAU); x.fill(); x.beginPath(); x.ellipse(w * .5, h * .2, w * .05, h * .02, -.5, 0, TAU); x.fill(); });
      const shell = M(o.color ?? '#f1efe9', { rough: .4 }), accent = M(o.accent ?? '#3f6fd1', { rough: .45 });
      add(root, new THREE.TorusGeometry(.17, .045, 12, 32), accent, [0, y0 - .02, 0], [PI / 2, 0, 0]);
      add(root, rcyl(.17, .18, .08, .03, 32), M('#c9ced6', { rough: .4, metal: .2 }), [0, y0 - .1, 0]);
      add(root, sphere(.22, 40, 28), shell, [0, y0 + .19, 0], null, [1, 1.04, 1.06]);
      const vis = add(root, new THREE.SphereGeometry(.226, 40, 24, PI / 2 - .85, 1.7, .72, .95), mapMat('#ffffff', visT, { rough: .2 }), [0, y0 + .19, .012], null, [1, 1.04, 1.06]); vis.material.side = THREE.DoubleSide;
      add(root, new THREE.TorusGeometry(.2, .02, 8, 40, 2.05), M('#c9ced6', { rough: .4 }), [0, y0 + .19, 0], [0, PI / 2 + 1.03, PI / 2 - .32]).scale.set(1.08, 1.08, 1.12);
      for (const sx of [-1, 1]) { add(root, rbox(.05, .12, .12, .02), M('#c9ced6'), [sx * .225, y0 + .2, -.02]); add(root, sphere(.03, 10, 8), glow('#bfe8ff', 1.4), [sx * .2, y0 + .32, .1]); }
      if (!stand) root.position.y = 0;
      return ink(root, .6);
    } },
});

// =====================================================================================================================
// OCEAN
// =====================================================================================================================
// ---------- creature helpers
/** a toon eye looking along dir: white ball, dark pupil, glint (r = eye radius) */
function eye(par, p, r, dir = [0, 0, 1], o = {}) {
  const g = grp('eye'); g.position.set(...p); par.add(g);
  add(g, sphere(r, 20, 14), M(o.white ?? '#fbfaf5', { rough: .3 }));
  const d = V3(...dir).normalize();
  const pu = add(g, sphere(r * (o.pupil ?? .56), 16, 12), M(o.iris ?? '#1b1512', { rough: .25 }), d.clone().multiplyScalar(r * .6).toArray()); pu.userData.noOutline = true;
  const hl = add(g, sphere(r * .17, 8, 6), glow('#ffffff', .5), d.clone().multiplyScalar(r * 1.1).add(V3(0, r * .26, r * .08)).toArray()); hl.userData.noOutline = true;
  return g;
}
/** radius of a [r, y] profile at y (linear) */
function profR(prof, y) { for (let i = 1; i < prof.length; i++) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; if (y <= y1) return lerp(r0, r1, (y - y0) / ((y1 - y0) || 1)); } return 0; }
/** a swimming body: smoothed lathe of a [r, z] profile (tail at -z, nose at +z), sx width, sy height; keeps its rest pose for bending */
function swimGeo(prof, sx, sy, seg = 36) { const g = slathe(prof, seg, 5); g.rotateX(PI / 2); g.scale(sx, sy, 1); g.userData.base = g.attributes.position.array.slice(); return g; }
/** bend a swimGeo: offset along axis (0 = x side to side, 1 = y up and down) by f(z) */
function bend(geo, f, axis = 0) { const P = geo.attributes.position.array, B = geo.userData.base; for (let i = 0; i < P.length; i += 3) P[i + axis] = B[i + axis] + f(B[i + 2]); geo.attributes.position.needsUpdate = true; }
/** a vertical fin: smooth shape in (z, y), t thick (centred on x) */
function finGeo(pts, t, smooth = true) { const g = ext(smooth ? blobShape(pts, 48) : shapeOf(pts), t, t * .35, { segs: 2 }); g.rotateY(-PI / 2); return g; }
/** a flat fin: smooth shape in (x, back), t thick (centred on y); back > 0 points to -z */
function flatFin(pts, t) { const g = ext(blobShape(pts, 48), t, t * .35, { segs: 2 }); g.rotateX(-PI / 2); return g; }
const slope = (f, z, e = .002) => (f(z + e) - f(z - e)) / (2 * e);
const wood = (c = '#a46a3c', key = 'planks', n = 6) => tex(key + c + n, 256, 256, (x, w, h) => {
  x.fillStyle = c; x.fillRect(0, 0, w, h); const R = rnd(n * 7);
  for (let i = 0; i < n; i++) { x.fillStyle = shade(c, (R() - .5) * .14); x.fillRect(0, i * h / n, w, h / n - 3); x.fillStyle = shade(c, -.38); x.fillRect(0, (i + 1) * h / n - 3, w, 3);
    x.strokeStyle = shade(c, -.16); x.globalAlpha = .4; for (let k = 0; k < 4; k++) { const y = i * h / n + R() * h / n; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * .3, y + 4, w * .6, y - 4, w, y + 2); x.stroke(); } x.globalAlpha = 1; }
}, { wrap: true });

// ---------- boat hulls (shared by the shipwreck, the galleon and the longship)
/** a smooth hull, keel at y = 0, bow at +z: { L, B, D, transom, sheerBow, sheerStern, keelRise, full, double (pointed both ends), hole(u, v) } */
function hullGeo(o) {
  const { L, B, D } = o, nu = o.nu ?? 44, nv = o.nv ?? 22, tr = o.transom ?? .55, p = o.full ?? .65;
  const wF = o.double ? u => Math.pow(Math.max(0, Math.sin(u * PI)), .6) : u => u < .4 ? lerp(tr, 1, Math.sin(u / .4 * PI / 2)) : Math.pow(Math.max(0, Math.cos((u - .4) / .6 * PI / 2)), o.bowFine ?? .75);
  const yT = u => D * (1 + (o.sheerBow ?? .3) * u ** 3 + (o.sheerStern ?? .2) * (1 - u) ** 3);
  const yK = u => D * (o.keelRise ?? .3) * ((Math.max(0, u - .65) / .35) ** 2 + (o.double ? (Math.max(0, .35 - u) / .35) ** 2 : 0));
  const pt = (u, v) => { const th = (v - .5) * PI, s = Math.sin(th), w = wF(u) * B / 2, yt = yT(u), yk = yK(u); return [Math.sign(s) * Math.pow(Math.abs(s), p) * w, yt - (yt - yk) * Math.pow(Math.cos(th), .8), (u - .5) * L]; };
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { pos.push(...pt(i / nu, j / nv)); uv.push(i / nu, j / nv); }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    if (o.hole && o.hole((i + .5) / nu, (j + .5) / nv)) continue;
    const a = i * (nv + 1) + j, b = a + nv + 1, c = a + 1, d = b + 1; idx.push(a, c, b, c, d, b);
  }
  if (!o.double) { const base = pos.length / 3, c = pt(0, .5), top = yT(0); pos.push(0, (c[1] + top) / 2, -L / 2); uv.push(.5, .5); for (let j = 0; j <= nv; j++) { pos.push(...pt(0, j / nv)); uv.push(j / nv, 0); } for (let j = 0; j < nv; j++) idx.push(base, base + 2 + j, base + 1 + j); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return { geo: g, pt, yT, wF, L, B, D };
}
/** the deck: a flat strip between the hull's top edges, `drop` below them, from u0 to u1 */
function deckGeo(H, drop, u0 = 0, u1 = 1, n = 30) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) { const u = lerp(u0, u1, i / n), a = H.pt(u, 0), b = H.pt(u, 1), y = H.yT(u) - drop, k = .97; pos.push(a[0] * k, y, a[2], b[0] * k, y, b[2]); uv.push(a[0] / 2, a[2] / 2, b[0] / 2, b[2] / 2); }
  for (let i = 0; i < n; i++) { const p = i * 2, q = p + 2; idx.push(p, q, p + 1, p + 1, q, q + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.userData.hard = true; return g;
}
/** hull + its dark inside (same geometry drawn from the back) + a rail along the top edge */
function hullMeshes(par, H, outer, inner, rail, rr) {
  const m = add(par, H.geo, outer); const im = new THREE.Mesh(H.geo, (() => { const x = M(inner, { rough: .9 }).clone(); x.side = THREE.BackSide; return x; })()); im.userData.noOutline = true; par.add(im);
  if (rail) for (const v of [0, 1]) tube(par, Array.from({ length: 17 }, (_, i) => { const p = H.pt(i / 16, v); return [p[0] * .985, p[1] + rr * .4, p[2]]; }), rr, rail);
  return m;
}

const FISH = {
  tang: { L: .42, sx: .4, sy: 1, prof: [[0, -.21], [.035, -.185], [.05, -.15], [.11, -.08], [.16, 0], [.165, .05], [.14, .11], [.08, .17], [.03, .2], [0, .21]],
    tail: [[.02, 0], [-.05, .07], [-.12, .11], [-.09, 0], [-.12, -.11], [-.05, -.07]], dorsal: [[.09, .1], [.04, .19], [-.08, .2], [-.15, .14], [-.13, .1]], anal: [[.0, -.1], [-.05, -.17], [-.14, -.13], [-.12, -.09]],
    pal: [['#3f6fd1', '#f6c945', '#1d2b4f'], ['#f6c945', '#f6c945', '#2a1d17'], ['#9a6ae0', '#ffd23f', '#3b2a6a'], ['#2fb0a5', '#f08a2a', '#1d4f4a']], eyeZ: .12, eyeY: .045, eyeR: .028 },
  clown: { L: .34, sx: .62, sy: .78, prof: [[0, -.17], [.04, -.15], [.06, -.12], [.1, -.06], [.115, .02], [.105, .08], [.075, .13], [.03, .16], [0, .17]],
    tail: [[.02, 0], [-.05, .06], [-.09, .06], [-.1, 0], [-.09, -.06], [-.05, -.06]], dorsal: [[.06, .06], [.02, .12], [-.05, .12], [-.1, .09], [-.1, .05]], anal: [[-.02, -.05], [-.05, -.11], [-.1, -.09], [-.1, -.05]],
    pal: [['#f47a20', '#f47a20', '#ffffff'], ['#e2432f', '#e2432f', '#ffffff'], ['#f6a531', '#f6a531', '#ffffff']], eyeZ: .095, eyeY: .03, eyeR: .024 },
  silver: { L: .5, sx: .55, sy: .7, prof: [[0, -.25], [.025, -.22], [.035, -.18], [.07, -.1], [.09, 0], [.085, .08], [.06, .16], [.025, .22], [0, .25]],
    tail: [[.02, 0], [-.06, .06], [-.15, .12], [-.1, 0], [-.15, -.12], [-.06, -.06]], dorsal: [[.04, .05], [0, .11], [-.06, .09], [-.06, .05]], anal: [[-.08, -.04], [-.1, -.08], [-.14, -.06], [-.13, -.03]],
    pal: [['#5d84a8', '#cfdae3', '#f2d14a'], ['#4f8f86', '#d5e2dc', '#f08a2a'], ['#6a6fa8', '#d9dcef', '#ee7fa6']], eyeZ: .17, eyeY: .02, eyeR: .022 },
};
/** shared swim motion: body wave + tail follow + pectoral flap + bob */
function swimLoop(root, body, geo, tail, pecs, inner, o) {
  const { A, w, ph, k, L, axis = 0 } = o, zt = -L / 2;
  const f = (z, t) => A * Math.sin(w * t + ph - z / L * k) * Math.pow(clamp((L / 2 - z) / L), 1.7);
  root.userData.update = t => {
    bend(geo, z => f(z, t), axis);
    if (tail) { const fz = z => f(z, t); if (axis === 0) { tail.position.x = fz(zt); tail.rotation.y = -Math.atan(slope(fz, zt) * 1.4); } else { tail.position.y = fz(zt); tail.rotation.x = Math.atan(slope(fz, zt) * 1.4); } }
    for (const [p, s, base] of pecs) p.rotation.y = s * (base + .35 * Math.sin(w * t * .8 + ph));
    if (inner) inner.position.y = L * .03 * Math.sin(t * 1.1 + ph);
  };
}
const OCEAN = {
  fish: { tags: ['ocean', 'creature'], desc: 'a toon fish swimming in place, nose +z (kind: "tang" tall blue/yellow, "clown" orange with white bands, "silver" sleek; seed: colour variant; size: scale of ~0.4 m). Centre at origin',
    make(o) {
      const F = FISH[o.kind] || FISH.tang, R = rnd(o.seed ?? 1), pal = F.pal[Math.floor(R() * F.pal.length)], k = o.size ?? 1, L = F.L;
      const root = grp('fish'), inner = grp(); inner.scale.setScalar(k); root.add(inner);
      const geo = swimGeo(F.prof, F.sx, F.sy, 32);
      paint(geo, (x, y, z) => {
        if (o.kind === 'clown') { for (const [zc, wd] of [[.1, .022], [-.005, .026], [-.12, .016]]) { const d = Math.abs(z - zc); if (d < wd) return '#ffffff'; if (d < wd + .008) return '#1b1512'; } return pal[0]; }
        if (o.kind === 'silver') { const yy = y + .004 * Math.sin(z * 30); return Math.abs(yy - .004) < .005 ? pal[2] : cmix(pal[1], pal[0], (yy + .01) / .03); }
        return z > .14 ? cmix(pal[0], shade(pal[0], .25), (z - .14) / .06) : z < -.15 ? shade(pal[0], -.08) : pal[0];
      });
      const body = add(inner, geo, vcMat({ rough: .5 })); body.userData.live = true;
      const fm = M(pal[1], { rough: .5 }), dark = M(shade(pal[0], -.25), { rough: .5 });
      add(inner, finGeo(F.dorsal, .012), o.kind === 'tang' ? M(pal[2], { rough: .5 }) : fm);
      add(inner, finGeo(F.anal, .012), o.kind === 'tang' ? M(pal[2], { rough: .5 }) : fm);
      const tail = grp('tail'); tail.position.z = -L / 2 + .015; inner.add(tail); add(tail, finGeo(F.tail, .012), fm);
      const pecs = [];
      for (const s of [-1, 1]) { const zz = F.eyeZ - .05, rr = profR(F.prof, zz); const pg = grp(); pg.position.set(s * rr * F.sx * .92, -.01, zz); inner.add(pg); add(pg, finGeo([[0, 0], [-.04, .02], [-.07, 0], [-.04, -.018]], .008), o.kind === 'clown' ? dark : fm); pecs.push([pg, s, .5]); }
      for (const s of [-1, 1]) { const rr = profR(F.prof, F.eyeZ); eye(inner, [s * rr * F.sx * .78, F.eyeY, F.eyeZ], F.eyeR, [s, .05, .35]); }
      swimLoop(root, body, geo, tail, pecs, inner, { A: L * .07, w: TAU * (1.5 + R() * .5), ph: R() * TAU, k: 4, L });
      return ink(root, L * k * .6);
    } },
  shark: { tags: ['ocean', 'creature'], desc: 'a toon shark swimming in place, nose +z: grey-blue back, white belly, big dorsal fin, toothy grin (len default 2.8 m; teeth: false for a closed mouth). Centre at origin',
    make(o) {
      const L = o.len ?? 2.8, root = grp('shark'), inner = grp(); root.add(inner);
      const prof = [[0, -.5], [.025, -.47], [.04, -.42], [.08, -.3], [.13, -.12], [.15, .02], [.14, .15], [.11, .28], [.07, .38], [.035, .45], [0, .5]].map(([r, y]) => [r * L, y * L]);
      const geo = swimGeo(prof, .88, 1, 36), back = o.color ?? '#7194ad', belly = '#eef1ee';
      paint(geo, (x, y, z) => cmix(belly, back, (y / L + .015 - .012 * Math.sin(z / L * 9)) / .025));
      const body = add(inner, geo, vcMat({ rough: .5 })); body.userData.live = true;
      const fm = M(back, { rough: .5 });
      add(inner, finGeo([[.12, .1], [.04, .25], [-.02, .33], [-.05, .3], [-.07, .2], [-.13, .1]].map(([z, y]) => [z * L, y * L]), .03 * L), fm);
      add(inner, finGeo([[-.27, .06], [-.31, .12], [-.34, .11], [-.35, .05]].map(([z, y]) => [z * L, y * L]), .015 * L), fm);
      add(inner, finGeo([[-.25, -.06], [-.29, -.11], [-.32, -.09], [-.32, -.05]].map(([z, y]) => [z * L, y * L]), .012 * L), fm);
      const tail = grp('tail'); tail.position.z = -L / 2 + .02 * L; inner.add(tail);
      add(tail, finGeo([[.03, 0], [-.04, .06], [-.15, .24], [-.17, .23], [-.1, .06], [-.07, 0], [-.11, -.13], [-.08, -.12], [-.03, -.05]].map(([z, y]) => [z * L, y * L]), .025 * L, false), fm);
      const pecs = [];
      for (const s of [-1, 1]) { const pg = grp(); pg.position.set(s * .1 * L, -.06 * L, .14 * L); pg.rotation.z = s * 1.1; inner.add(pg); add(pg, finGeo([[.04, 0], [-.02, -.04], [-.13, -.17], [-.15, -.15], [-.07, -.02]].map(([z, y]) => [z * L, y * L]), .022 * L), fm); pecs.push([pg, s, .12]); }
      for (const s of [-1, 1]) {
        const zz = .35 * L, rr = profR(prof, zz) * .88; eye(inner, [s * rr * .82, .045 * L, zz], .024 * L, [s, .1, .5], { pupil: .62 });
        for (let i = 0; i < 4; i++) { const z = (.22 - i * .028) * L, r2 = profR(prof, z) * .88; const sl = add(inner, rbox(.012 * L, .075 * L, .01 * L, .004 * L), M('#3d5263'), [s * r2 * .97, .0, z], [0, s * .35, -s * .12]); sl.userData.noOutline = true; }
      }
      const mouth = grp('mouth'); mouth.position.set(0, -.085 * L, .34 * L); inner.add(mouth);
      const arc = add(mouth, new THREE.TorusGeometry(.06 * L, .011 * L, 8, 24, PI * .9), M('#5a2430', { rough: .6 }), [0, 0, 0], [PI / 2 - .25, 0, PI * .05]); arc.scale.set(1.15, 1, 1);
      if (o.teeth !== false) for (let i = 0; i < 9; i++) { const a = PI * (.08 + i * .1), t = add(mouth, rcyl(0, .008 * L, .022 * L, .002, 8), M('#ffffff', { rough: .3 }), [Math.cos(a) * .067 * L, -.004 * L + Math.sin(a) * .015 * L, Math.sin(a) * .06 * L], [PI, 0, 0]); t.userData.noOutline = true; }
      swimLoop(root, body, geo, tail, pecs, inner, { A: .045 * L, w: TAU * .75, ph: (o.seed ?? 1) * 1.3, k: 3, L });
      return ink(root, L * .5);
    } },
  whale: { tags: ['ocean', 'creature'], desc: 'a big toon whale (humpback-like: long white flippers, throat grooves, flukes), nose +z, slow up-down swim (len default 12 m). Centre at origin',
    make(o) {
      const L = o.len ?? 12, root = grp('whale'), inner = grp(); root.add(inner);
      const prof = [[0, -.5], [.02, -.47], [.035, -.42], [.07, -.3], [.12, -.15], [.16, 0], [.18, .12], [.175, .25], [.15, .36], [.1, .45], [.04, .49], [0, .5]].map(([r, y]) => [r * L, y * L]);
      const geo = swimGeo(prof, 1, .86, 40), back = o.color ?? '#3b5b82', belly = '#d9e3ea';
      paint(geo, (x, y, z) => { const b = (y / L + .03 - .015 * Math.sin(z / L * 7)) / .03; if (b < 0 && z > -.05 * L && Math.abs(Math.sin(x / L * 70)) < .22) return '#9fb3c3'; return cmix(belly, back, b); });
      const body = add(inner, geo, vcMat({ rough: .55 })); body.userData.live = true;
      const fm = M(back, { rough: .55 }), white = M('#cfdbe3', { rough: .55 });
      add(inner, finGeo([[-.18, .1], [-.22, .145], [-.25, .14], [-.26, .1]].map(([z, y]) => [z * L, y * L]), .02 * L), fm);
      const tail = grp('tail'); tail.position.z = -L / 2 + .02 * L; inner.add(tail);
      add(tail, flatFin([[-.2, .1], [-.15, .1], [-.05, .04], [0, .06], [.05, .04], [.15, .1], [.2, .1], [.12, .0], [0, -.04], [-.12, .0]].map(([x, b]) => [x * L, b * L]), .018 * L), fm);
      const pecs = [];
      for (const s of [-1, 1]) { const pg = grp(); pg.position.set(s * .15 * L, -.08 * L, .17 * L); pg.rotation.set(.3, 0, s * .8); inner.add(pg); const fl = add(pg, finGeo([[.03, 0], [.0, .02], [-.08, -.12], [-.15, -.3], [-.12, -.31], [-.05, -.15], [-.02, -.02]].map(([z, y]) => [z * L, y * L]), .013 * L), white); fl.rotation.y = 0; pecs.push([pg, s, .25]); }
      for (const s of [-1, 1]) {
        const zz = .3 * L, rr = profR(prof, zz); eye(inner, [s * rr * .9, -.02 * L, zz], .026 * L, [s, .1, .45], { pupil: .6 });
        tube(inner, Array.from({ length: 7 }, (_, i) => { const z = lerp(.475, .25, i / 6) * L, y = (-.06 - .025 * Math.sin(i / 6 * PI * .7)) * L, rz = profR(prof, z); return [s * Math.sqrt(Math.max(0, rz * rz - (y / .86) ** 2)) * 1.005, y, z]; }), .008 * L, M('#1f2f45'), { caps: false });
      }
      add(inner, sphere(.012 * L, 12, 8), M('#1f2f45'), [0, profR(prof, .3 * L) * .86, .3 * L], null, [1.6, .5, 1]);
      const pec = pecs.map(([p, s]) => [p, s, 0]);
      swimLoop(root, body, geo, tail, [], inner, { A: .05 * L, w: TAU * .22, ph: (o.seed ?? 1), k: 2.5, L, axis: 1 });
      const base = root.userData.update; root.userData.update = t => { base(t); for (const [p, s] of pec) p.rotation.z = s * (.8 + .12 * Math.sin(t * TAU * .22 + 1)); };
      return ink(root, L * .45);
    } },
  jellyfish: { tags: ['ocean', 'creature'], desc: 'a glowing see-through jellyfish that pulses and trails tentacles (color, size: scale of a 0.7 m bell). Centre (bell) at origin; no outline',
    make(o) {
      const k = o.size ?? 1, c = o.color ?? '#ff8fd0', c2 = shade(c, .35), root = grp('jellyfish'), inner = grp(); inner.scale.setScalar(k); root.add(inner);
      const g = lathe([[0, .12], [.2, .08], [.3, .02], [.35, 0], [.36, .06], [.32, .17], [.24, .26], [.12, .31], [0, .32]], 48);
      { const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y < .1) { const a = Math.atan2(z, x), s = 1 + .07 * Math.cos(a * 8) * (1 - y / .1); P.setX(i, x * s); P.setZ(i, z * s); } } g.computeVertexNormals(); }
      const bellM = seeThru(c, .55, { emissive: c, ei: .45, side: THREE.DoubleSide, rough: .2 });
      const bell = grp('bell'); inner.add(bell); add(bell, g, bellM);
      add(bell, sphere(.15, 24, 16), seeThru(c2, .6, { emissive: c2, ei: .6 }), [0, .15, 0], null, [1, .7, 1]);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; add(bell, sphere(.022, 8, 6), glow(c2, 2), [Math.cos(a) * .35, .02, Math.sin(a) * .35]); }
      const armM = seeThru(c2, .55, { emissive: c, ei: .4, side: THREE.DoubleSide }), tenM = seeThru(c, .6, { emissive: c, ei: .5 });
      const arms = [], tens = [], R = rnd(o.seed ?? 3), ph = R() * TAU;
      for (let i = 0; i < 4; i++) { const n = new Noodle(armM, 22, 8, .04); inner.add(n); arms.push([n, i / 4 * TAU + .4, .75 + R() * .2]); }
      for (let i = 0; i < 12; i++) { const n = new Noodle(tenM, 18, 5, .007); inner.add(n); tens.push([n, i / 12 * TAU, 1.0 + R() * .5]); }
      const w = TAU * .55;
      root.userData.update = t => {
        const p = .5 - .5 * Math.cos(w * t + ph); bell.scale.set(1 + .1 * p, 1 - .15 * p, 1 + .1 * p); inner.position.y = .06 * Math.sin(w * t + ph - 1.4);
        for (const [n, a, len] of arms) n.setPath(Array.from({ length: 6 }, (_, j) => { const d = j / 5 * len, sw = .07 * Math.sin(t * 1.3 + a * 2 + d * 3) * d; return V3(Math.cos(a) * (.08 + .04 * j) + sw, .06 - d, Math.sin(a) * (.08 + .04 * j) + .05 * Math.cos(t * 1.1 + a + d * 2) * d); }), u => .045 * (1 - u * .7) * (1 + .3 * Math.sin(u * 34 + a)));
        for (const [n, a, len] of tens) n.setPath(Array.from({ length: 6 }, (_, j) => { const d = j / 5 * len, rr = .33 * (1 + .1 * p) * (1 - j * .03); return V3(Math.cos(a) * rr + .1 * Math.sin(t * 1.6 + a * 3 + d * 2.5) * d, .02 - d - .05 * p * (1 - j / 5), Math.sin(a) * rr + .08 * Math.cos(t * 1.2 + a + d * 2) * d); }), u => .008 * (1 - u * .6));
      };
      root.userData.update(0);
      noShadow(root); root.userData.solid = false;
      return root;
    } },
  octopus: { tags: ['ocean', 'creature'], desc: 'a toon octopus sitting on the sea floor, eight curling arms that wave, big eyes (color, size: scale of ~1.8 m spread). Sits on y = 0',
    make(o) {
      const k = o.size ?? 1, c = o.color ?? '#ff7a52', root = grp('octopus'), g = grp(); g.scale.setScalar(k); root.add(g);
      const mg = slathe([[0, 0], [.17, .03], [.26, .13], [.29, .3], [.26, .47], [.17, .58], [0, .62]], 40, 5);
      paint(mg, (x, y, z) => f3(x * 9, y * 9, z * 9, 4) > .32 ? shade(c, .3) : cmix(shade(c, .12), c, y / .4));
      const mantle = grp('mantle'); mantle.position.set(0, .22, -.05); mantle.rotation.x = -.35; g.add(mantle);
      add(mantle, mg, vcMat({ rough: .45 }));
      for (const s of [-1, 1]) eye(g, [s * .13, .38, .19], .085, [s * .25, .05, 1], { pupil: .5 });
      add(g, sphere(.04, 12, 8), M(shade(c, -.3)), [0, .26, .25], null, [1.2, .7, .6]);
      const armM = M(c, { rough: .45 }), arms = [], ph = (o.seed ?? 2) * 1.7;
      for (let i = 0; i < 8; i++) { const n = new Noodle(armM, 26, 10, .06); g.add(n); arms.push([n, (i + .5) / 8 * TAU + .2, i]); }
      root.userData.update = t => {
        for (const [n, a, i] of arms) {
          const ca = Math.cos(a), sa = Math.sin(a), s1 = Math.sin(t * 1.3 + i * 1.7 + ph), s2 = Math.sin(t * .9 + i * 2.3 + ph), tw = .1 * Math.sin(t * .7 + i);
          const P = (r, y, side = 0) => V3(ca * r - sa * side, y, sa * r + ca * side);
          n.setPath([P(.06, .24), P(.22, .1), P(.42, .045, tw * .3), P(.64, .05 + .02 * s1, tw * .7), P(.8 + .03 * s2, .1 + .07 * s1, tw), P(.84 - .05 * s2, .2 + .08 * s1, tw * 1.4), P(.74 - .06 * s2, .23 + .06 * s2, tw * 1.6)], u => .065 * (1 - u * .82) + .006);
        }
      };
      root.userData.update(0);
      return ink(root, 1.2 * k);
    } },
  anglerfish: { tags: ['ocean', 'creature'], desc: 'a dark deep-sea anglerfish with a huge toothy underbite and a glowing lure on a stalk (userData.light: the lure\'s light; size: scale of ~0.8 m). Centre at origin, nose +z',
    make(o) {
      const k = o.size ?? 1, L = .8, root = grp('anglerfish'), inner = grp(); inner.scale.setScalar(k); root.add(inner);
      const c = o.color ?? '#4b3a5c';
      const prof = [[0, -.4], [.03, -.37], [.07, -.3], [.18, -.15], [.27, 0], [.29, .1], [.26, .22], [.18, .31], [.08, .36], [0, .37]];
      const geo = swimGeo(prof, .92, 1, 36);
      paint(geo, (x, y, z) => cmix(shade(c, .28), c, (y + .08) / .14));
      const body = add(inner, geo, vcMat({ rough: .55 })); body.userData.live = true;
      // the mouth: a dark cave with a jutting lower jaw and needle teeth
      add(inner, sphere(.2, 24, 16), M('#1a0f1c', { rough: .9 }), [0, -.06, .25], null, [1.05, .55, .6]);
      const jaw = add(inner, lathe([[0, 0], [.15, .01], [.22, .06], [.24, .12], [.2, .13], [.12, .07], [0, .05]], 32), M(shade(c, .15), { rough: .5 }), [0, -.17, .26], [.35, 0, 0], [1.1, 1, 1]); void jaw;
      for (let i = 0; i < 9; i++) { const a = (i / 8 - .5) * 2.3, x = Math.sin(a) * .2, z = .26 + Math.cos(a) * .14; add(inner, rcyl(0, .014, .09 - Math.abs(i - 4) * .006, .002, 8), M('#f6f1e2', { rough: .3 }), [x, -.14, z], [.15, 0, -x * .6]); }
      for (let i = 0; i < 7; i++) { const a = (i / 6 - .5) * 2.0, x = Math.sin(a) * .2, z = .27 + Math.cos(a) * .1; add(inner, rcyl(0, .012, .07, .002, 8), M('#f6f1e2', { rough: .3 }), [x, .03, z], [PI - .15, 0, x * .6]); }
      for (const s of [-1, 1]) eye(inner, [s * .2, .12, .22], .04, [s, .2, .6], { pupil: .4, iris: '#d9e86a' });
      const fm = M(shade(c, -.15), { rough: .5 });
      const tail = grp('tail'); tail.position.z = -.38; inner.add(tail); add(tail, finGeo([[.02, 0], [-.05, .09], [-.13, .12], [-.1, 0], [-.13, -.12], [-.05, -.09]], .02), fm);
      add(inner, finGeo([[-.12, .18], [-.18, .26], [-.27, .2], [-.25, .12]], .016), fm);
      const pecs = []; for (const s of [-1, 1]) { const pg = grp(); pg.position.set(s * .24, -.05, -.02); inner.add(pg); add(pg, finGeo([[0, 0], [-.07, .05], [-.12, 0], [-.07, -.05]], .014), fm); pecs.push([pg, s, .6]); }
      // the lure
      const lure = grp('lure'); lure.position.set(0, .27, .14); inner.add(lure);
      tube(lure, [[0, 0, 0], [0, .18, .06], [0, .27, .22], [0, .22, .36]], .013, M(shade(c, .1), { rough: .5 }), { caps: false });
      const lc = o.glow ?? '#d8ff6a', bm = glow(lc, 3).clone(); add(lure, sphere(.055, 16, 12), bm, [0, .2, .38]);
      const lh = halo(.15, lc, { inv: true, pow: 2.4, alpha: .45 }); lh.position.set(0, .2, .38); lure.add(lh);
      const light = new THREE.PointLight(lc, 1.6, 3, 1.6); light.position.set(0, .2, .4); lure.add(light);
      swimLoop(root, body, geo, tail, pecs, inner, { A: .03, w: TAU * .9, ph: (o.seed ?? 1) * 2.1, k: 3, L });
      const base = root.userData.update; root.userData.update = t => { base(t); lure.rotation.x = .12 * Math.sin(t * 1.4); const pu = .75 + .25 * Math.sin(t * 2.6); bm.emissiveIntensity = 2.2 + 1.3 * pu; light.intensity = 1.6 * pu * k * k; };
      root.userData.light = light;
      return ink(root, L * k * .7);
    } },
  'sea-turtle': { tags: ['ocean', 'creature'], desc: 'a sea turtle gliding with flapping front flippers, patterned shell, head +z (size: scale of ~1.2 m). Centre at origin',
    make(o) {
      const k = o.size ?? 1, root = grp('sea-turtle'), inner = grp(); inner.scale.setScalar(k); root.add(inner);
      const skin = o.skin ?? '#8fae5a', shellC = o.color ?? '#6d7f3c';
      const scute = tex('scute' + shellC, 512, 512, (x, w, h) => {
        x.fillStyle = shade(shellC, -.35); x.fillRect(0, 0, w, h);
        const cell = (cx, cy, rx, ry) => { const g = x.createRadialGradient(cx, cy, 2, cx, cy, Math.max(rx, ry)); g.addColorStop(0, shade(shellC, .3)); g.addColorStop(1, shellC); x.fillStyle = g; x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + PI / 6; x.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); } x.closePath(); x.fill(); };
        for (let i = 0; i < 5; i++) cell(w / 2, h * (.14 + i * .18), w * .11, h * .085);
        for (const s of [-1, 1]) for (let i = 0; i < 4; i++) cell(w / 2 + s * w * .21, h * (.22 + i * .18), w * .1, h * .085);
        for (const s of [-1, 1]) for (let i = 0; i < 7; i++) cell(w / 2 + s * w * .37, h * (.12 + i * .125), w * .06, h * .055);
      });
      const sg = slathe([[0, 0], [.42, 0], [.47, .03], [.45, .1], [.35, .19], [.2, .24], [0, .26]], 48, 4);
      { const P = sg.attributes.position, U = sg.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, P.getX(i) / 1.0 + .5, .5 - P.getZ(i) / 1.0); }
      add(inner, sg, mapMat('#ffffff', scute, { rough: .5 }), [0, -.02, 0], null, [1, 1, 1.25]);
      add(inner, slathe([[0, -.1], [.3, -.08], [.42, -.03], [.44, .0], [0, .0]], 40, 3), M('#e6d79c', { rough: .6 }), [0, -.01, 0], null, [.95, 1, 1.2]);
      const sm = M(skin, { rough: .55 }), sp = M(shade(skin, -.25), { rough: .55 });
      const head = grp('head'); head.position.set(0, .03, .55); inner.add(head);
      add(head, rcyl(.08, .09, .14, .06, 20), sm, [0, 0, -.07], [PI / 2, 0, 0]);
      add(head, sphere(.11, 24, 16), sm, [0, .02, .08], null, [.9, .8, 1.1]);
      for (const s of [-1, 1]) eye(head, [s * .075, .05, .13], .03, [s * .6, .1, 1], { pupil: .62 });
      add(head, sphere(.035, 10, 8), sp, [.05, .09, .05], null, [1, .4, 1]); add(head, sphere(.03, 10, 8), sp, [-.04, .1, .0], null, [1, .4, 1]);
      const fl = [];
      for (const s of [-1, 1]) {
        const pg = grp(); pg.position.set(s * .36, 0, .32); inner.add(pg);
        add(pg, flatFin([[0, -.05], [.2, -.06], [.5, .08], [.62, .22], [.55, .25], [.3, .1], [0, .07]].map(([x, b]) => [x * s, b]), .035), sm);
        fl.push([pg, s]);
        const bg = grp(); bg.position.set(s * .25, -.02, -.42); inner.add(bg); add(bg, flatFin([[0, -.04], [.14, 0], [.2, .1], [.12, .14], [0, .06]].map(([x, b]) => [x * s, b]), .03), sm); fl.push([bg, s * .4]);
      }
      add(inner, rcyl(0, .05, .14, .02, 12), sm, [0, -.02, -.55], [-PI / 2, 0, 0]);
      const ph = (o.seed ?? 1) * 1.9;
      root.userData.update = t => { for (const [p, s] of fl) { p.rotation.z = s * .5 * Math.sin(t * 1.6 + ph); p.rotation.y = -Math.abs(s) * .25 * Math.cos(t * 1.6 + ph) * Math.sign(s); } head.rotation.x = .06 * Math.sin(t * .8 + ph); inner.position.y = .03 * Math.sin(t * 1.6 + ph - 1); };
      return ink(root, k);
    } },
};

// ---------- reef and sea floor
function branchCoral(par, mat, seed, h = .6) {
  const R = rnd(seed), g = grp();
  const grow = (p, d, len, r, depth) => { const q = p.clone().addScaledVector(d, len); rod(g, p.toArray(), q.toArray(), r, mat, { seg: 10 }); add(g, sphere(r * 1.15, 10, 8), mat, q.toArray());
    if (depth > 0) for (let i = 0; i < 2 + (R() < .4 ? 1 : 0); i++) { const nd = d.clone().add(V3((R() - .5) * 1.3, R() * .5, (R() - .5) * 1.3)).normalize(); grow(q, nd, len * (.62 + R() * .2), r * .75, depth - 1); } };
  for (let i = 0; i < 3; i++) grow(V3((R() - .5) * .1, 0, (R() - .5) * .1), V3((R() - .5) * .8, 1, (R() - .5) * .8).normalize(), h * .45, h * .07, 2);
  par.add(bake(g)); return g;
}
function brainCoral(par, c, seed, r = .3) {
  const g = blob({ seed, amp: .08, freq: 1.2, detail: 4, flat: -.1, sy: .7 });
  paint(g, (x, y, z) => Math.abs(Math.sin(f3(x * 2.5, y * 2.5, z * 2.5, seed) * 22)) < .35 ? shade(c, -.3) : c);
  return add(par, g, vcMat({ rough: .7 }), [0, r * .05, 0], null, r);
}
/** a sea fan: a solid lacy fan (veins painted on) on a short stalk, base at the origin, facing +z */
function fanCoral(par, c, seed, h = .8) {
  const R = rnd(seed), w = h * 1.25;
  const t = canvasTex(256, 256, (x, W, H) => { x.fillStyle = shade(c, .18); x.fillRect(0, 0, W, H); x.strokeStyle = shade(c, -.38); x.lineCap = 'round';
    const br = (px, py, a, len, lw, d) => { const qx = px + Math.cos(a) * len, qy = py - Math.sin(a) * len; x.lineWidth = lw; x.beginPath(); x.moveTo(px, py); x.lineTo(qx, qy); x.stroke(); if (d > 0) { br(qx, qy, a + .32 + R() * .22, len * .8, lw * .75, d - 1); br(qx, qy, a - .32 - R() * .22, len * .8, lw * .75, d - 1); } };
    br(W / 2, H, PI / 2, H * .22, 16, 6); x.lineWidth = 2.5; x.strokeStyle = shade(c, -.25); for (let i = 0; i < 260; i++) { const a = .1 + R() * (PI - .2), rr = (.15 + R() * .8) * H; const px = W / 2 + Math.cos(a) * rr, py = H - Math.sin(a) * rr; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - .5) * 22, py + (R() - .5) * 22); x.stroke(); }
    x.fillStyle = shade(c, -.3); for (let i = 0; i < 140; i++) { x.beginPath(); x.arc(R() * W, R() * H, 2 + R() * 3, 0, TAU); x.fill(); } });
  t.repeat.set(1 / w, 1 / h); t.offset.set(.5, 0);
  const pts = []; for (let i = 0; i <= 12; i++) { const a = PI * (.06 + .88 * i / 12); pts.push([Math.cos(a) * w / 2 * (1 + .07 * Math.sin(i * 2.3 + seed)), h * .2 + Math.sin(a) * h * .8 * (1 + .05 * Math.cos(i * 3.1 + seed))]); }
  pts.push([-.06 * h, h * .06], [-.035 * h, 0], [.035 * h, 0], [.06 * h, h * .06]);
  const fan = add(par, ext(blobShape(pts, 72), .02 * h, .008 * h), mapMat('#ffffff', t, { rough: .7 }));
  return fan;
}
function tubeSponges(par, c, seed, n = 6) {
  const R = rnd(seed);
  for (let i = 0; i < n; i++) { const h = .18 + R() * .4, r = .04 + R() * .035, a = R() * TAU, d = R() * .16;
    const t = add(par, lathe([[r * .6, 0], [r, .02], [r * 1.08, h * .6], [r * 1.25, h], [r * 1.12, h + .015], [r * .85, h - .01], [r * .7, h * .5], [0, h * .45]], 20), M(i % 2 ? c : shade(c, .2), { rough: .6 }), [Math.cos(a) * d, 0, Math.sin(a) * d]); t.rotation.set((R() - .5) * .4, 0, (R() - .5) * .4); }
}
const CORAL_C = ['#ff6f9e', '#ff8a3a', '#b57cff', '#ffd23f', '#ff4f63', '#4fe0c8'];
Object.assign(OCEAN, {
  coral: { tags: ['ocean', 'nature'], desc: 'a coral cluster on a rock (kind: "mix" | "branch" | "brain" | "fan" | "tube"; seed: colours and shape; ~1.2 m wide). Sea fans sway',
    make(o) {
      const kind = o.kind ?? 'mix', R = rnd(o.seed ?? 1), pick = () => CORAL_C[Math.floor(R() * CORAL_C.length)], root = grp('coral'), s = o.seed ?? 1, fans = [];
      const c1 = pick(), c2 = pick(), c3 = pick();
      if (kind === 'branch') branchCoral(root, M(c1, { rough: .55 }), s, .7);
      else if (kind === 'brain') brainCoral(root, c1 === '#ff9a4a' ? '#c9b45a' : '#b9c46a', s, .4);
      else if (kind === 'fan') fans.push(fanCoral(root, c1, s, .9));
      else if (kind === 'tube') tubeSponges(root, c1, s, 7);
      else {
        add(root, blob({ seed: s, amp: .25, detail: 3, flat: -.3, sy: .45, box: .2 }), M('#a0928a', { rough: 1 }), [0, .06, 0], null, .36);
        const b = grp(); b.position.set(-.12, .14, .05); root.add(b); branchCoral(b, M(c1, { rough: .55 }), s, .75);
        const br = grp(); br.position.set(.32, .02, .22); root.add(br); brainCoral(br, '#d9cf6a', s + 1, .26);
        const fg = grp(); fg.position.set(.08, .1, -.22); fg.rotation.y = R() * .6 - .3; root.add(fg); fans.push(fanCoral(fg, c2, s + 2, .85));
        const tb = grp(); tb.position.set(-.42, .0, -.12); root.add(tb); tubeSponges(tb, c3, s + 3, 5);
      }
      if (fans.length) root.userData.update = t => { for (const f of fans) f.rotation.x = .08 * Math.sin(t * .9 + s); };
      return ink(root, .9);
    } },
  kelp: { tags: ['ocean', 'nature'], desc: 'a clump of tall swaying kelp strands with leaf blades and air floats (h: height, default 4 m; n strands; color)',
    make(o) {
      const H = o.h ?? 4, n = o.n ?? 4, R = rnd(o.seed ?? 1), c = o.color ?? '#9a9a32', root = grp('kelp'), strands = [];
      const stemM = M(shade(c, -.3), { rough: .6 }), floatM = M('#c9a23c', { rough: .45 });
      add(root, blob({ seed: o.seed ?? 1, amp: .3, detail: 2, flat: -.2, sy: .5 }), M('#6e5a3a', { rough: .9 }), [0, .03, 0], null, .16);
      const leafG = finGeo([[0, 0], [.08, .05], [.3, .07], [.5, .03], [.56, 0], [.45, -.03], [.2, -.04], [.06, -.03]], .012);
      for (let i = 0; i < n; i++) {
        const h = H * (.7 + R() * .3), stem = new Noodle(stemM, 24, 6, .022); root.add(stem);
        const leaves = [], nl = Math.floor(h / .32);
        for (let j = 1; j < nl; j++) { const lg = grp(); root.add(lg); const lc = '#' + cmix(c, '#c9b04a', Math.round(j / nl * 4) / 4 * .8).getHexString(); const leaf = add(lg, leafG, M(lc, { rough: .55 })); leaf.rotation.y = PI / 2; add(lg, sphere(.028, 10, 8), floatM); leaves.push([lg, j / nl, j % 2 ? 1 : -1, R() * TAU]); }
        strands.push({ stem, leaves, h, a: R() * TAU, d: .05 + R() * .08, ph: R() * TAU });
      }
      const at = (s, u, t) => { const sw = H * .09 * Math.pow(u, 1.5); return V3(Math.cos(s.a) * s.d + sw * Math.sin(t * .7 + s.ph + u * 2.2), u * s.h, Math.sin(s.a) * s.d + sw * .6 * Math.sin(t * .53 + s.ph * 1.3 + u * 1.7)); };
      root.userData.update = t => {
        for (const s of strands) {
          s.stem.setPath(Array.from({ length: 7 }, (_, j) => at(s, j / 6, t)), u => .024 * (1 - u * .5));
          for (const [lg, u, side, rot] of s.leaves) { const p = at(s, u, t), q = at(s, u + .02, t); lg.position.copy(p); lg.rotation.set(0, rot + side * .4, 0); lg.rotateZ(side * (.75 + .15 * Math.sin(t * 1.1 + u * 5)) + Math.atan2(q.x - p.x, q.y - p.y) * .5); }
        }
      };
      root.userData.update(0);
      return ink(root, 1.6);
    } },
  anemone: { tags: ['ocean', 'creature', 'nature'], desc: 'a sea anemone: a stubby column crowned with swaying tentacles with light tips (color, tip; size: scale of ~0.45 m)',
    make(o) {
      const k = o.size ?? 1, c = o.color ?? '#ff7a5c', tip = o.tip ?? '#ffe0b0', root = grp('anemone'), g = grp(); g.scale.setScalar(k); root.add(g);
      add(g, lathe([[0, 0], [.15, 0], [.17, .03], [.13, .12], [.14, .2], [.18, .24], [.16, .26], [0, .25]], 32), M(shade(c, -.15), { rough: .6 }));
      const tm = M(c, { rough: .5 }), tt = M(tip, { rough: .5 }), tens = [], R = rnd(o.seed ?? 1), cap = new THREE.CapsuleGeometry(.03, .17, 4, 10), tipG = sphere(.036, 12, 8);
      for (let i = 0; i < 38; i++) {
        const ring = i < 24 ? 0 : 1, a = (ring ? (i - 24) / 14 : i / 24) * TAU + ring * .2, r = ring ? .08 : .15, pg = grp();
        pg.position.set(Math.cos(a) * r, .25, Math.sin(a) * r); g.add(pg);
        const len = .8 + R() * .5; add(pg, cap, tm, [0, .115 * len, 0], null, [1, len, 1]); add(pg, tipG, tt, [0, .23 * len + .01, 0]);
        tens.push([pg, a, ring ? .4 : 1.0, R() * TAU]);
      }
      root.userData.update = t => { for (const [pg, a, lean, ph] of tens) { const s = Math.sin(t * 1.2 + ph) * .25, s2 = Math.sin(t * .8 + a * 2) * .2; pg.rotation.set(Math.sin(a) * lean + s2, 0, -Math.cos(a) * lean + s); } };
      root.userData.update(0);
      return ink(root, .45 * k);
    } },
  shipwreck: { tags: ['ocean', 'history', 'vehicle'], desc: 'a sunken wooden ship lying tilted and half buried on the sea floor: a hole in its side shows the ribs, broken mast, barnacles, weed (len default 14 m)',
    make(o) {
      const L = o.len ?? 14, B = L * .3, D = L * .23, root = grp('shipwreck'), w = grp(); root.add(w);
      const holeU = .58, holeV = .78, hole = (u, v) => Math.max(Math.abs(u - holeU) / .13, Math.abs(v - holeV) / .15) + .25 * noise1(u * 40 + v * 25, 2) < 1;
      const H = hullGeo({ L, B, D, hole, sheerBow: .35, sheerStern: .3 });
      paint(H.geo, (x, y, z) => { const plank = Math.abs(Math.sin(y / D * 22)) < .14; const alg = clamp(.35 - y / D * .6 + f3(x * .4, y * .4, z * .4, 3) * .9); return cmix(plank ? '#7a5636' : '#c8955c', '#8fae5f', alg * .55); });
      hullMeshes(w, H, vcMat({ rough: .9 }), '#2e2117', M('#5a4330', { rough: .9 }), D * .035);
      for (let i = 0; i < 5; i++) { const u = holeU - .1 + i * .05; tube(w, Array.from({ length: 9 }, (_, j) => { const p = H.pt(u, .55 + j / 8 * .43); return [p[0] * .96, p[1], p[2]]; }), D * .03, M('#4a3524', { rough: .9 }), { caps: false }); }
      add(w, deckGeo(H, D * .12, 0, .32), mapMat('#ffffff', wood('#7a5c40', 'deckw', 8), { rough: .9 }));
      const mz = (.45 - .5) * L; rod(w, [0, H.yT(.45) - D * .2, mz], [0, H.yT(.45) + D * .9, mz], D * .07, M('#5f4630', { rough: .9 }));
      add(w, lathe([[D * .07, 0], [D * .05, D * .12], [D * .02, D * .1], [0, D * .2]], 10), M('#5f4630', { rough: .9 }), [0, H.yT(.45) + D * .9, mz]);
      rod(root, [-B * .45, D * .12, -.12 * L], [-B * 1.25, D * .06, -.42 * L], D * .06, M('#6f5236', { rough: .9 }));
      const R = rnd(o.seed ?? 4), barn = M('#d9d2c2', { rough: .9 });
      for (let i = 0; i < 16; i++) { const p = H.pt(.1 + R() * .8, R() < .5 ? .15 + R() * .25 : .55 + R() * .25); const bm = add(w, sphere(D * (.016 + R() * .014), 10, 6), barn, [p[0] * .995, p[1], p[2]]); bm.scale.set(Math.abs(p[0]) > B * .2 ? .5 : 1, Math.abs(p[0]) > B * .2 ? 1 : .5, 1); }
      w.rotation.set(.06, 0, .42); w.position.y = -D * .28;
      add(root, blob({ seed: 9, amp: .2, detail: 3, flat: -.2, sx: 1.2, sy: .25, sz: 2.2 }), M(o.sand ?? '#d8bf8a', { rough: 1 }), [-B * .55, 0, 0], null, B * .5);
      for (let i = 0; i < 5; i++) { const x = (R() - .3) * B, z = (R() - .5) * L * .8; tube(root, [[x, 0, z], [x + .1, .5, z], [x - .05, 1.0, z + .1], [x + .1, 1.4, z]], .03, M('#6f8a32', { rough: .6 })); }
      return ink(root, L * .6);
    } },
  'treasure-chest': { tags: ['ocean', 'history', 'treasure'], desc: 'a wooden treasure chest with brass bands and lock, gold inside (open: 0..1 lid angle; metal colour). userData.lid, setOpen(k), top',
    make(o) {
      const root = grp('treasure-chest'), w = .9, d = .55, h = .45, r = d / 2;
      const woodM = mapMat('#ffffff', wood(o.color ?? '#9a6234', 'chest', 4), { rough: .75 }), brass = M(o.metal ?? '#e0a83e', { rough: .35, metal: .35 });
      add(root, rbox(w, h, d, .04), woodM, [0, h / 2, 0]);
      for (const x of [-.3, .3]) add(root, rbox(.07, h + .02, d + .02, .02), brass, [x, h / 2, 0]);
      add(root, rbox(w + .02, .06, d + .02, .02), brass, [0, .03, 0]);
      add(root, rbox(.15, .19, .05, .02), brass, [0, h - .06, d / 2 + .01]);
      add(root, rbox(.025, .06, .02, .008), M('#2a1d17'), [0, h - .08, d / 2 + .035]);
      const gold = M('#f2c14e', { rough: .35, metal: .3 });
      add(root, blob({ seed: 3, amp: .15, detail: 3, sy: .45 }), gold, [0, h - .02, 0], null, [w * .42, .3, d * .42]);
      for (let i = 0; i < 8; i++) { const R = rnd(i + 5); add(root, rcyl(.035, .035, .01, .004, 16), gold, [(R() - .5) * w * .7, h + .06 + R() * .05, (R() - .5) * d * .6], [(R() - .5) * .8, 0, (R() - .5) * .8]); }
      add(root, sphere(.045, 16, 10), M('#e2433f', { rough: .2 }), [.12, h + .1, .05], null, [1, .8, 1]);
      const lid = grp('lid'); lid.position.set(0, h, -r); root.add(lid);
      const lidG = new THREE.CylinderGeometry(r, r, w, 28, 1, false, 0, PI); lidG.rotateZ(PI / 2);
      add(lid, lidG, woodM, [0, 0, r]);
      add(lid, rbox(w, .03, d, .012), woodM, [0, .015, r]);
      for (const x of [-.3, .3]) add(lid, new THREE.TorusGeometry(r + .01, .022, 8, 24, PI), brass, [x, 0, r], [0, PI / 2, 0]);
      add(lid, rbox(.15, .1, .05, .02), brass, [0, .05, d + .01]);
      const setOpen = kk => { lid.rotation.x = -clamp(kk) * 1.95; };
      setOpen(o.open ?? 0);
      Object.assign(root.userData, { lid, setOpen, top: h + r });
      return ink(root, .9);
    } },
  anchor: { tags: ['ocean', 'history'], desc: 'a big iron ship anchor standing on its crown, with a ring and a short chain on the ground (chain: false; stock: "wood" | "iron"; 1.8 m)',
    make(o) {
      const root = grp('anchor'), iron = M(o.color ?? '#454a53', { rough: .5, metal: .3 }), rust = M('#8a4a2a', { rough: .8 });
      add(root, rcyl(.07, .075, 1.58, .05, 16), iron, [0, .06, 0]);
      add(root, new THREE.TorusGeometry(.55, .065, 14, 40, PI), iron, [0, .62, 0], [0, 0, PI]);
      for (const s of [-1, 1]) { const f = add(root, ext(blobShape([[0, .26], [-.14, -.02], [0, .04], [.14, -.02]], 32), .07, .025), iron, [s * .55, .66, 0]); f.rotation.z = -s * .45; }
      add(root, sphere(.1, 16, 12), iron, [0, .1, 0]);
      const st = o.stock === 'iron' ? iron : M('#7a5232', { rough: .8 });
      rod(root, [-.55, 1.4, 0], [.55, 1.4, 0], .055, st); for (const s of [-1, 1]) add(root, sphere(.075, 12, 10), st, [s * .57, 1.4, 0]);
      add(root, new THREE.TorusGeometry(.14, .035, 10, 28), iron, [0, 1.78, 0]);
      add(root, rbox(.16, .06, .06, .02), rust, [0, 1.15, .06]);
      if (o.chain !== false) {
        const lg = new THREE.TorusGeometry(.055, .018, 8, 18), cv = new THREE.CatmullRomCurve3([[0, 1.64, .02], [.1, 1.45, .12], [.22, 1.0, .25], [.3, .5, .36], [.36, .12, .45], [.5, .03, .62], [.75, .03, .74], [1.05, .03, .8]].map(p => V3(...p)));
        const n = Math.floor(cv.getLength() / .13), P = cv.getSpacedPoints(n);
        for (let i = 0; i < n; i++) { const a = P[i], b = P[i + 1], m = add(root, lg, iron, [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]); m.quaternion.setFromUnitVectors(_up, b.clone().sub(a).normalize()); m.rotateY(i % 2 ? PI / 2 : 0); m.rotateZ(PI / 2); m.scale.set(1.55, 1, 1); }
      }
      return ink(root, 1.6);
    } },
  buoy: { tags: ['ocean'], desc: 'a red and white navigation buoy bobbing at the waterline (y = 0) with a blinking lamp on top (color; light: userData.light, blinks every 2.5 s)',
    make(o) {
      const root = grp('buoy'), b = grp(), c = o.color ?? '#e2432f'; root.add(b);
      const fg = lathe([[0, -.7], [.45, -.66], [.72, -.38], [.8, -.05], [.78, .2], [.62, .34], [.36, .42], [0, .44]], 40);
      paint(fg, (x, y) => y > -.05 && y < .2 ? '#f4f1ea' : c); add(b, fg, vcMat({ rough: .5 }));
      const red = M(c, { rough: .5 }), white = M('#f4f1ea', { rough: .5 }), dark = M('#3b3f4b', { rough: .5 });
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; rod(b, [Math.cos(a) * .32, .4, Math.sin(a) * .32], [Math.cos(a) * .2, 2.1, Math.sin(a) * .2], .04, i % 2 ? red : white); }
      for (const [y, r] of [[1.0, .29], [1.6, .24]]) add(b, new THREE.TorusGeometry(r, .035, 8, 28), red, [0, y, 0], [PI / 2, 0, 0]);
      add(b, rcyl(.32, .3, .1, .04, 24), dark, [0, 2.1, 0]);
      const lampM = glow('#ffe066', 3).clone(); const lamp = add(b, sphere(.12, 16, 12), lampM, [0, 2.32, 0], null, [1, 1.3, 1]);
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; rod(b, [Math.cos(a) * .15, 2.2, Math.sin(a) * .15], [Math.cos(a) * .15, 2.48, Math.sin(a) * .15], .015, dark); }
      add(b, rcyl(.18, .18, .05, .02, 20), dark, [0, 2.48, 0]);
      const light = new THREE.PointLight('#ffe066', 3, 8, 1.6); light.position.set(0, 2.32, 0); b.add(light);
      const ph = (o.seed ?? 1) * 1.1;
      root.userData.update = t => { b.position.y = .08 * Math.sin(t * 1.1 + ph); b.rotation.set(.06 * Math.sin(t * .9 + ph), 0, .05 * Math.sin(t * .7 + ph + 1)); const on = ((t + ph) % 2.5) < .45 ? 1 : 0; lampM.emissiveIntensity = on ? 3.2 : .25; light.intensity = on ? 3 : 0; void lamp; };
      root.userData.light = light;
      return ink(root, 2.5);
    } },
});

// ---------- vessels and structures
/** a propeller in the xy plane (spins about z): n blades of length r */
function propeller(par, r, mat, n = 4) { const g = grp('propeller'); par.add(g); add(g, sphere(r * .25, 14, 10), mat, null, null, [1, 1, 1.4]); for (let i = 0; i < n; i++) { const b = add(g, rbox(r * .42, r * 1.0, r * .08, r * .04), mat, [0, 0, 0]); b.rotation.z = i / n * TAU; b.position.set(-Math.sin(i / n * TAU) * r * .55, Math.cos(i / n * TAU) * r * .55, 0); b.rotateY(.5); } return g; }
Object.assign(OCEAN, {
  submarine: { tags: ['ocean', 'vehicle'], desc: 'a cartoon submarine: rounded hull with a conning tower, periscope, lit portholes, cross fins and a spinning propeller; bow +z (len default 14 m; color; lit: false for dark portholes; spin: propeller rad/s). Centre at origin. userData.prop',
    make(o) {
      const L = o.len ?? 14, k = L / 14, root = grp('submarine'), g = grp(); g.scale.setScalar(k); root.add(g);
      const c = o.color ?? '#ffbe2e', body = M(c, { rough: .45 }), dark = M('#3b3f4b', { rough: .5 }), acc = M(o.accent ?? '#e2432f', { rough: .45 });
      const prof = [[0, -7], [.6, -6.7], [1.0, -5.9], [1.45, -4.3], [1.72, -2], [1.78, 0], [1.76, 2.6], [1.6, 4.4], [1.22, 5.8], [.66, 6.75], [0, 7]];
      add(g, zLathe(prof, 48, 5), body);
      add(g, new THREE.TorusGeometry(1.79, .12, 10, 48), acc, [0, 0, -2.4]);
      add(g, new THREE.TorusGeometry(1.7, .12, 10, 48), acc, [0, 0, 4.0]);
      add(g, finGeo([[-1.5, 0], [1.7, 0], [1.4, 2.1], [.2, 2.35], [-1.2, 1.9]], 1.0), body, [0, 1.35, .8]);
      add(g, rbox(1.12, .18, 1.6, .08), acc, [0, 3.55, .75]);
      for (const s of [-1, 1]) add(g, rbox(1.2, .1, .55, .05), body, [s * .95, 2.9, 1.6]);
      rod(g, [.2, 3.6, .3], [.2, 4.9, .3], .09, dark); rod(g, [.2, 4.9, .3], [.2, 4.9, .85], .09, dark); add(g, rbox(.26, .26, .32, .08), dark, [.2, 4.9, .95]);
      rod(g, [-.25, 3.6, -.1], [-.25, 4.3, -.1], .04, dark);
      const lit = o.lit === false ? null : '#ffd58a';
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const z = -2.6 + i * 1.5, r = profR(prof.map(([a, b]) => [a, b]), z); porthole(g, [s * (r - .12), .25, z], .36, '#d9dde3', '#1d3557', { rot: [0, s * PI / 2, 0], lit, ei: .8, depth: .3 }); }
      porthole(g, [0, .1, 6.5], .32, '#d9dde3', '#1d3557', { rot: [-.3, 0, 0], lit: '#fff1c4', ei: 2.4, depth: .3 });
      const fin = finGeo([[.4, .3], [-1.5, .3], [-2.2, 2.7], [-1.4, 2.75]], .2);
      for (let i = 0; i < 4; i++) { const f = add(g, fin, acc, [0, 0, -4.3]); f.rotation.z = i * PI / 2; }
      const pr = propeller(g, .95, M('#c9a23c', { rough: .35, metal: .4 }), 4); pr.position.z = -7.1;
      root.userData.prop = pr; const spin = o.spin ?? 6;
      root.userData.update = t => { pr.rotation.z = t * spin; };
      return ink(root, L * .55);
    } },
  submersible: { tags: ['ocean', 'vehicle'], desc: 'a deep-sea research submersible: white body, orange top, big front viewport, lamps (a real spotlight: userData.light), a claw arm, skids and thrusters; sits on its skids at y = 0, front +z (size: scale of 7 m)',
    make(o) {
      const k = o.size ?? 1, root = grp('submersible'), g = grp(); g.scale.setScalar(k); root.add(g);
      const white = M('#f1efe8', { rough: .45 }), orange = M(o.color ?? '#f08a2a', { rough: .45 }), dark = M('#3b3f4b', { rough: .5 }), metal = M('#a7adb6', { rough: .4, metal: .3 }), yel = M('#f6c945', { rough: .5 });
      add(g, rbox(2.6, 2.3, 6, 1.0), white, [0, 1.85, 0]);
      add(g, rbox(1.5, .95, 3.2, .42), orange, [0, 3.2, -.6]);
      rod(g, [0, 3.6, -1.6], [0, 4.6, -1.6], .05, metal); add(g, sphere(.09, 10, 8), glow('#ff5544', 2.4), [0, 4.65, -1.6]);
      add(g, rbox(2.64, .35, 5.6, .15), orange, [0, 1.05, 0]);
      add(g, sphere(1.0, 32, 24), M('#d9dce1', { rough: .4 }), [0, 1.8, 2.75], null, [1, 1, .55]);
      porthole(g, [0, 1.85, 3.2], .38, '#4a505b', '#1c2c48', { depth: .3 });
      for (const s of [-1, 1]) porthole(g, [s * .55, 1.45, 3.05], .16, '#4a505b', '#1c2c48', { depth: .2, rot: [.2, s * .5, 0] });
      // lamps on a bar
      rod(g, [-1.25, 2.75, 2.5], [1.25, 2.75, 2.5], .07, metal);
      const lampM = glow('#fff4d0', 3.2);
      for (const x of [-1.05, 0, 1.05]) { const lg = grp(); lg.position.set(x, 2.75, 2.65); lg.rotation.x = .35; g.add(lg); add(lg, rcyl(.17, .14, .32, .05, 20), dark, [0, 0, -.12], [PI / 2, 0, 0]); add(lg, sphere(.13, 16, 10), lampM, [0, 0, .2], null, [1, 1, .4]); }
      const spot = new THREE.SpotLight('#fff1d6', 60 * k * k, 30 * k, .5, .6, 1.4); spot.position.set(0, 2.75, 2.9); const tg = new THREE.Object3D(); tg.position.set(0, -.5, 12); g.add(spot, tg); spot.target = tg;
      // claw arm (front right) + sample basket
      const arm = grp('arm'); arm.position.set(1.05, 1.15, 2.6); g.add(arm);
      rod(arm, [0, 0, 0], [.2, -.2, .8], .08, metal); rod(arm, [.2, -.2, .8], [.1, -.65, 1.2], .07, metal);
      for (const s of [-1, 1]) add(arm, rbox(.06, .28, .1, .03), dark, [.1 + s * .07, -.8, 1.25], [0, 0, s * .3]);
      add(g, rbox(1.5, .5, .8, .08), yel, [-.35, .55, 3.15]); add(g, rbox(1.36, .4, .68, .06), M('#2b2f38', { rough: .9 }), [-.35, .62, 3.15]);
      for (const s of [-1, 1]) { rod(g, [s * .95, .12, -2.6], [s * .95, .12, 2.6], .1, metal); for (const z of [-2, 0, 2]) rod(g, [s * .95, .12, z], [s * .85, .75, z], .06, metal); add(g, sphere(.1, 10, 8), metal, [s * .95, .12, 2.65]); }
      for (const s of [-1, 1]) { const th = grp(); th.position.set(s * 1.45, 2.0, -2.7); g.add(th); add(th, new THREE.TorusGeometry(.38, .1, 10, 24), orange); add(th, rcyl(.12, .12, .5, .05, 12), dark, [0, 0, -.25], [PI / 2, 0, 0]); rod(g, [s * 1.2, 2.0, -2.7], [s * 1.08, 2.0, -2.7], .08, metal); propeller(th, .3, dark, 3).name = 'prop'; }
      root.userData.light = spot;
      return ink(root, 7 * k * .6);
    } },
  'diving-bell': { tags: ['ocean', 'history'], desc: 'an old brass diving bell with round portholes and rivet bands, open at the bottom (dark inside), hanging cable (cable: length above, default 4 m; 2.3 m tall)',
    make(o) {
      const root = grp('diving-bell'), brass = M(o.color ?? '#c98a3a', { rough: .4, metal: .3 }), dark = M('#5a3a1c', { rough: .5 });
      const prof = [[1.0, 0], [.96, .3], [.92, 1.0], [.84, 1.55], [.66, 1.92], [.36, 2.12], [0, 2.18]];
      const bg = slathe(prof, 48, 4); const b = add(root, bg, brass);
      const im = new THREE.Mesh(bg, (() => { const m = M('#24170c', { rough: 1 }).clone(); m.side = THREE.BackSide; return m; })()); im.userData.noOutline = true; root.add(im); void b;
      add(root, new THREE.TorusGeometry(1.0, .075, 10, 48), dark, [0, .03, 0], [PI / 2, 0, 0]);
      for (const [y, r] of [[.55, .955], [1.75, .78]]) { add(root, new THREE.TorusGeometry(r, .045, 8, 48), dark, [0, y, 0], [PI / 2, 0, 0]); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; add(root, sphere(.03, 6, 5), dark, [Math.cos(a) * (r + .04), y, Math.sin(a) * (r + .04)]); } }
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU, w = porthole(root, [Math.sin(a) * .9, 1.15, Math.cos(a) * .9], .24, '#8a5a24', '#1d3a52', { depth: .25 }); w.rotation.y = a; w.rotateX(-.08); }
      add(root, new THREE.TorusGeometry(.2, .06, 10, 24), dark, [0, 2.35, 0]);
      add(root, rbox(.3, .14, .2, .05), dark, [0, 2.18, 0]);
      if (o.cable !== 0) rod(root, [0, 2.53, 0], [0, 2.55 + (o.cable ?? 4), 0], .035, M('#3b3f4b'), { flat: true });
      return ink(root, 2.3);
    } },
  bathysphere: { tags: ['ocean', 'history', 'vehicle'], desc: 'a steel deep-diving sphere with thick round windows, a bolted hatch, a lifting lug and cable; rests on y = 0 (cable: length above, default 3 m; 1.6 m)',
    make(o) {
      const root = grp('bathysphere'), steel = M(o.color ?? '#5d7286', { rough: .45, metal: .3 }), dark = M('#2f3b47', { rough: .5 });
      add(root, new THREE.TorusGeometry(.42, .07, 10, 28), dark, [0, .06, 0], [PI / 2, 0, 0]);
      add(root, sphere(.8, 48, 32), steel, [0, .84, 0]);
      porthole(root, [0, 1.0, .74], .17, '#2f3b47', '#1d3557', { depth: .26, rot: [-.2, 0, 0], lit: o.lit ? '#ffd58a' : null });
      for (const s of [-1, 1]) porthole(root, [s * .34, .82, .68], .13, '#2f3b47', '#1d3557', { depth: .22, rot: [0, s * .46, 0], lit: o.lit ? '#ffd58a' : null });
      const hatch = grp(); hatch.position.set(.79, .84, 0); hatch.rotation.y = PI / 2; root.add(hatch);
      add(hatch, rcyl(.32, .33, .1, .04, 32), dark, [0, 0, -.05], [PI / 2, 0, 0]);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; add(hatch, sphere(.03, 8, 6), steel, [Math.cos(a) * .27, Math.sin(a) * .27, .06]); }
      add(root, rbox(.3, .22, .16, .06), dark, [0, 1.68, 0]);
      add(root, new THREE.TorusGeometry(.13, .04, 10, 20), dark, [0, 1.86, 0]);
      if (o.cable !== 0) rod(root, [0, 1.98, 0], [0, 2.0 + (o.cable ?? 3), 0], .03, M('#3b3f4b'), { flat: true });
      return ink(root, 1.6);
    } },
  'oil-rig': { tags: ['ocean', 'extreme'], desc: 'an offshore oil platform on four yellow legs: decks, a lattice drilling derrick, crane, helipad, quarters and a burning flare boom (userData.fireAt; legs stand on the water at y = 0; size: scale of a 46 m rig; below: extra leg length under y = 0)',
    make(o) {
      const k = o.size ?? 1, root = grp('oil-rig'), g = grp(); g.scale.setScalar(k); root.add(g);
      const yel = M('#e8b931', { rough: .5 }), grey = M('#8d949c', { rough: .7 }), white = M('#efebe2', { rough: .6 }), red = M('#d9452b', { rough: .55 }), dark = M('#3b3f4b', { rough: .6 });
      const below = o.below ?? 0;
      for (const [x, z] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) { add(g, rcyl(1.3, 1.5, 16 + below, .4, 24), yel, [x, -below, z]); add(g, new THREE.TorusGeometry(1.5, .2, 8, 24), dark, [x, 2.2, z], [PI / 2, 0, 0]); }
      const br = grp(); for (const y of [5, 11]) { for (const [a, b] of [[[-8, -6], [8, -6]], [[-8, 6], [8, 6]], [[-8, -6], [-8, 6]], [[8, -6], [8, 6]]]) rod(br, [a[0], y, a[1]], [b[0], y, b[1]], .35, yel, { flat: true, seg: 8 }); }
      for (const [a, b] of [[[-8, -6], [8, -6]], [[-8, 6], [8, 6]]]) { rod(br, [a[0], 5, a[1]], [b[0], 11, b[1]], .28, yel, { flat: true, seg: 8 }); rod(br, [b[0], 5, b[1]], [a[0], 11, a[1]], .28, yel, { flat: true, seg: 8 }); }
      g.add(bake(br));
      add(g, rbox(22, 2.2, 17, .4), grey, [0, 16.6, 0]);
      add(g, rbox(20, .5, 15, .2), red, [0, 15.3, 0]);
      add(g, rbox(17, 1.8, 13, .35), white, [0, 18.6, 0]);
      const winT = tex('rigwin', 256, 128, (x, w, h) => { x.fillStyle = '#efebe2'; x.fillRect(0, 0, w, h); for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { x.fillStyle = (r + c) % 3 ? '#2a3a52' : '#ffd58a'; x.fillRect(12 + c * 40, 14 + r * 38, 26, 22); } });
      add(g, rbox(7, 6, 6, .3), mapMat('#ffffff', winT, { rough: .6 }), [-6.5, 22.5, -3]);
      add(g, rbox(7.4, .4, 6.4, .15), red, [-6.5, 25.6, -3]);
      // helipad
      const hp = grp(); hp.position.set(-6.5, 25.9, -3); g.add(hp);
      add(hp, rcyl(4.2, 4.2, .35, .1, 40), M('#5b7a6a', { rough: .8 }));
      const H = add(hp, new THREE.CircleGeometry(3.9, 40), mapMat('#ffffff', tex('heliH', 256, 256, (x, w, h) => { x.fillStyle = '#5b7a6a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f6c945'; x.lineWidth = 10; x.beginPath(); x.arc(w / 2, h / 2, w * .4, 0, TAU); x.stroke(); x.fillStyle = '#ffffff'; x.font = `800 ${h * .5}px Inter, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', w / 2, h / 2 + 6); })), [0, .37, 0], [-PI / 2, 0, 0]); H.userData.noOutline = true;
      // derrick
      const dk = grp(), dc = M('#f2f0ea', { rough: .6 }), base = 19.5, top = 42, s0 = 3, s1 = .8, C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [a, b] of C4) rod(dk, [4 + a * s0, base, 2 + b * s0], [4 + a * s1, top, 2 + b * s1], .22, dc, { flat: true, seg: 8 });
      for (let y = base + 2, i = 0; y < top; y += 3.2, i++) { const sa = lerp(s0, s1, (y - base) / (top - base)), sb = lerp(s0, s1, Math.min(1, (y + 3.2 - base) / (top - base)));
        for (let f = 0; f < 4; f++) { const a = C4[f], b = C4[(f + 1) % 4]; rod(dk, [4 + a[0] * sa, y, 2 + a[1] * sa], [4 + b[0] * sa, y, 2 + b[1] * sa], .13, i % 2 ? red : dc, { flat: true, seg: 6 }); if (y + 3.2 < top) rod(dk, [4 + a[0] * sa, y, 2 + a[1] * sa], [4 + b[0] * sb, y + 3.2, 2 + b[1] * sb], .09, dc, { flat: true, seg: 6 }); } }
      g.add(bake(dk));
      add(g, rbox(2.6, 1.2, 2.6, .2), red, [4, top + .4, 2]);
      add(g, rbox(6, 3, 6, .3), M('#c9cdd3', { rough: .6 }), [4, 21, 2]);
      // crane
      add(g, rcyl(.9, 1.1, 4, .2, 20), yel, [7.5, 19.5, -5]); add(g, rbox(2, 1.6, 2.4, .3), yel, [7.5, 24.2, -5]);
      const boom = rod(g, [7.5, 24.5, -5], [16, 31, -9], .45, yel, { seg: 10 }); void boom; rod(g, [16, 31, -9], [16, 24, -9], .05, dark, { flat: true }); add(g, rbox(.6, .6, .6, .1), dark, [16, 23.7, -9]);
      // flare boom
      const fl = grp(); for (let i = 0; i < 3; i++) { const t0 = i / 3, t1 = (i + 1) / 3, P = u => [lerp(9, 20, u), lerp(17.5, 27, u), lerp(6, 10, u)]; const [a, b] = [P(t0), P(t1)]; rod(fl, [a[0], a[1] - .6, a[2]], [b[0], b[1] - .6, b[2]], .15, dc, { flat: true, seg: 6 }); rod(fl, [a[0], a[1] + .6, a[2]], [b[0], b[1] + .6, b[2]], .15, dc, { flat: true, seg: 6 }); rod(fl, [a[0], a[1] - .6, a[2]], [b[0], b[1] + .6, b[2]], .1, dc, { flat: true, seg: 6 }); }
      g.add(bake(fl));
      const flame = grp('flame'); flame.position.set(20, 27.6, 10); g.add(flame);
      const fm = [glow('#ff7a1a', 2.6), glow('#ffb43a', 3), glow('#fff0b0', 3.4)];
      const fl3 = [[1.3, 3.6, fm[0]], [.9, 2.6, fm[1]], [.45, 1.6, fm[2]]].map(([r, h, m], i) => add(flame, lathe([[0, 0], [r * .7, r * .2], [r, r * .8], [r * .7, h * .55], [r * .25, h * .85], [0, h]], 20), m, [0, i * .1, 0]));
      noShadow(flame);
      for (const [z, x] of [[-8.6, -4], [-8.6, 4]]) add(g, new THREE.CapsuleGeometry(.7, 2.2, 6, 14), M('#f08a2a', { rough: .5 }), [x, 15.8, z], [0, 0, PI / 2]);
      const ph = (o.seed ?? 1) * 1.7;
      root.userData.update = t => { fl3.forEach((m, i) => { const n = noise1(t * 6 + i * 3, 5); m.scale.set(1 + .08 * n, 1 + .18 * noise1(t * 7 + i, 9), 1 + .08 * n); m.rotation.z = .08 * noise1(t * 3 + i, 2); }); void ph; };
      root.userData.fireAt = [20 * k, 28 * k, 10 * k];
      return ink(root, 46 * k * .5);
    } },
  lighthouse: { tags: ['ocean', 'building'], desc: 'a red and white striped lighthouse with a gallery, a glowing lantern room (userData.light) and a sweeping beam (h default 16 m; beam: false; userData.beamSpeed rad/s; rocks: false)',
    make(o) {
      const H = o.h ?? 16, k = H / 16, root = grp('lighthouse'), g = grp(); g.scale.setScalar(k); root.add(g);
      const red = o.color ?? '#d23b2c', white = '#f4f1ea';
      const tr = y => lerp(2.2, 1.6, (y - .4) / 12.1), ys = [];
      for (let i = 0; i <= 40; i++) ys.push(.4 + i * .3);
      for (let c = .9; c < 12.2; c += 2.3) ys.push(c - .015, c + .015);
      ys.sort((a, b) => a - b);
      const tp = [[0, 0], [2.25, 0], [2.25, .3]]; for (const y of ys) if (y - tp[tp.length - 1][1] > .005) tp.push([tr(y), y]);
      tp.push([1.55, 12.55], [0, 12.55]);
      const tg = lathe(tp, 48);
      paint(tg, (x, y) => y < .9 ? '#8f8f96' : Math.floor((y - .9) / 2.3) % 2 ? red : white);
      add(g, tg, vcMat({ rough: .55 }));
      const dark = M('#2f333c', { rough: .5 }), redM = M(red, { rough: .5 });
      add(g, rcyl(2.25, 1.9, .35, .1, 40), dark, [0, 12.5, 0]);
      add(g, new THREE.TorusGeometry(2.15, .06, 8, 48), dark, [0, 13.75, 0], [PI / 2, 0, 0]);
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; rod(g, [Math.cos(a) * 2.15, 12.85, Math.sin(a) * 2.15], [Math.cos(a) * 2.15, 13.75, Math.sin(a) * 2.15], .035, dark); }
      add(g, rcyl(1.3, 1.3, .35, .1, 32), dark, [0, 12.85, 0]);
      const lampM = glow('#fff2c0', 2.2);
      add(g, rcyl(1.15, 1.15, 1.7, .1, 32), lampM, [0, 13.2, 0]);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; rod(g, [Math.cos(a) * 1.17, 13.2, Math.sin(a) * 1.17], [Math.cos(a) * 1.17, 14.9, Math.sin(a) * 1.17], .045, dark); }
      add(g, slathe([[0, 0], [1.45, 0], [1.4, .15], [1.0, .7], [.4, 1.15], [0, 1.25]], 40, 3), redM, [0, 14.85, 0]);
      add(g, sphere(.2, 14, 10), dark, [0, 16.15, 0]); rod(g, [0, 16.3, 0], [0, 16.9, 0], .03, dark);
      add(g, rbox(1.0, 1.9, .5, .25), M('#6e3b2a', { rough: .7 }), [0, .95, 2.08], [.06, 0, 0]);
      add(g, rbox(1.3, .18, .6, .06), dark, [0, 2.0, 2.1], [.06, 0, 0]);
      for (const y of [4.5, 8.2]) { const r = lerp(2.2, 1.6, (y - .4) / 12.1); add(g, rbox(.45, .65, .2, .1), dark, [0, y, r - .03], [Math.atan((2.2 - 1.6) / 12.1), 0, 0]); }
      const light = new THREE.PointLight('#ffe9a8', 40, 40, 1.5); light.position.set(0, 14.05, 0); g.add(light);
      let beam = null;
      if (o.beam !== false) { beam = grp('beam'); beam.position.y = 14.05; g.add(beam); for (const s of [-1, 1]) { const bg = new THREE.CylinderGeometry(.5, 3.2, 26, 24, 6, true); bg.translate(0, -13, 0); bg.rotateZ(s * PI / 2); const b = add(beam, bg, softGlow('#fff2c0', { pow: 1.2, alpha: .35, fade: 1.2, side: THREE.DoubleSide })); noShadow(b); } }
      if (o.rocks !== false) { const R = rnd(o.seed ?? 3); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + R(), s = .9 + R() * 1.1; const m = add(g, blob({ seed: i + 1, amp: .3, detail: 3, flat: -.3, sy: .7, box: .3 }), M(i % 2 ? '#7d7a76' : '#8f8b86', { rough: 1 }), [Math.cos(a) * (2.6 + s * .5), s * .25, Math.sin(a) * (2.6 + s * .5)], [0, R() * TAU, 0], s); void m; } }
      root.userData.beamSpeed = o.beamSpeed ?? .8;
      root.userData.update = t => { if (beam) beam.rotation.y = t * (root.userData.beamSpeed || 0); };
      root.userData.light = light;
      return ink(root, H * .55);
    } },
});

// =====================================================================================================================
// HISTORY
// =====================================================================================================================
/** stone blocks with mortar (tinted by the material colour of the clone) */
const stoneTex = (c = '#b9b2a4', key = 'stone') => tex(key + c, 512, 256, (x, w, h) => {
  x.fillStyle = shade(c, -.3); x.fillRect(0, 0, w, h); const R = rnd(21), rows = 4;
  for (let r = 0; r < rows; r++) { let px = r % 2 ? -w / 8 : 0; while (px < w) { const bw = w / 4 * (.75 + R() * .5); x.fillStyle = shade(c, (R() - .5) * .14); x.beginPath(); x.roundRect(px + 3, r * h / rows + 3, bw - 6, h / rows - 6, 10); x.fill(); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(px + 6, r * h / rows + 5, bw - 14, 5); px += bw; } }
}, { wrap: true });
/** a stone material whose blocks repeat rx * ry times over a face's 0..1 uv */
function stoneMat(c, rx, ry, key) { const t = stoneTex(c, key).clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return mapMat('#ffffff', t, { rough: .9 }); }
/** a cartoon flame (3 nested teardrops, bloom-bright), base at the origin; g.userData.flicker(t) animates it */
function flame(par, s = 1, p = [0, 0, 0]) {
  const g = grp('flame'), prof = [[0, 0], [.07, .02], [.1, .09], [.085, .18], [.045, .27], [0, .36]]; g.position.set(...p);
  const L = [[seeThru('#ff5a12', .82, { emissive: '#ff5a12', ei: 2.2 }), 1], [seeThru('#ffb02e', .92, { emissive: '#ffb02e', ei: 2.6 }), .68], [glow('#fff3c0', 3), .4]];
  const ms = L.map(([m, k], i) => add(g, lathe(prof.map(([r, y]) => [r * k * s, y * k * s]), 20), m, [0, i * .012 * s, 0]));
  noShadow(g); par.add(g);
  g.userData.flicker = (t, seed = 0) => ms.forEach((m, i) => { const n = noise1(t * 7 + i * 3.1 + seed, 5); m.scale.set(1 + .1 * n, 1 + .22 * noise1(t * 8.3 + i + seed, 9), 1 + .1 * n); m.rotation.z = .12 * noise1(t * 3 + i + seed, 2); });
  return g;
}
/** a fluted classical column (h, r, broken, seed, color); base at y = 0 */
function makeColumn(o = {}) {
  const h = o.h ?? 4, r = o.r ?? .32, c = o.color ?? '#ece5d3', g = grp('column'), stone = M(c, { rough: .75 }), dark = M(shade(c, -.1), { rough: .8 });
  add(g, rbox(r * 2.7, .18, r * 2.7, .04), dark, [0, .09, 0]);
  add(g, new THREE.TorusGeometry(r * 1.06, r * .17, 10, 36), stone, [0, .25, 0], [PI / 2, 0, 0]);
  const top = o.broken ? h * (.42 + rnd(o.seed ?? 1)() * .22) : h - .45;
  const sh = new THREE.CylinderGeometry(r * .88, r, top - .22, 80, 6, false); sh.translate(0, (top - .22) / 2 + .22, 0);
  { const P = sh.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = P.getY(i), rr = Math.hypot(x, z); if (rr < 1e-4) { if (o.broken && y > top - .01) P.setY(i, y - .05); continue; } const a = Math.atan2(z, x), f = 1 - .06 * Math.pow(.5 + .5 * Math.cos(a * 20), 2); P.setX(i, x * f); P.setZ(i, z * f); if (o.broken && y > top - .01) P.setY(i, y + .16 * noise1(a * 2.5 + 7, o.seed ?? 1) + .06 * noise1(a * 9, 3)); } sh.computeVertexNormals(); }
  add(g, sh, stone);
  if (!o.broken) { add(g, lathe([[r * .86, 0], [r * 1.05, .05], [r * 1.32, .2], [r * 1.36, .25], [0, .25]], 36), stone, [0, h - .45, 0]); add(g, rbox(r * 2.9, .2, r * 2.9, .04), stone, [0, h - .1, 0]); }
  return g;
}
function pyrGeo(b0, b1, y0, y1) {   // a square frustum (b = half widths), one quad per side with 0..1 uv, plus a top cap
  const pos = [], uv = [], C = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  for (let i = 0; i < 4; i++) { const [ax, az] = C[i], [bx, bz] = C[(i + 1) % 4], q = [[ax * b0, y0, az * b0, 0, 0], [bx * b0, y0, bz * b0, 1, 0], [bx * b1, y1, bz * b1, .5 + .5 * b1 / b0, 1], [ax * b1, y1, az * b1, .5 - .5 * b1 / b0, 1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(q[k][0], q[k][1], q[k][2]); uv.push(q[k][3], q[k][4]); } }
  if (b1 > 0) for (const k of [0, 1, 2, 0, 2, 3]) { const [cx, cz] = C[k]; pos.push(cx * b1, y1, cz * b1); uv.push(cx * .5 + .5, cz * .5 + .5); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}
/** a disc / shield face pattern */
const shieldTex = (a, b, kind) => tex('shield' + a + b + kind, 256, 256, (x, w, h) => {
  x.fillStyle = a; x.fillRect(0, 0, w, h); x.fillStyle = b;
  if (kind === 'quarters') { x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2); }
  else if (kind === 'swirl') { for (let i = 0; i < 3; i++) { x.save(); x.translate(w / 2, h / 2); x.rotate(i * TAU / 3); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(w * .3, -h * .1, w * .45, h * .2, w * .2, h * .5); x.lineTo(w * .05, h * .5); x.bezierCurveTo(w * .3, h * .2, w * .15, 0, 0, 0); x.fill(); x.restore(); } }
  else if (kind === 'half') x.fillRect(0, 0, w / 2, h);
  else { x.fillRect(w * .4, 0, w * .2, h); x.fillRect(0, h * .4, w, h * .2); }
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 3; for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(i * w / 6, 0); x.lineTo(i * w / 6, h); x.stroke(); }
});
const parchTex = (key, w, h, draw) => tex(key, w, h, (x, W, H) => { const g = x.createRadialGradient(W / 2, H / 2, W * .1, W / 2, H / 2, W * .75); g.addColorStop(0, '#f6e9c8'); g.addColorStop(1, '#d8bf8a'); x.fillStyle = g; x.fillRect(0, 0, W, H); const R = rnd(31); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(140,100,50,${R() * .06})`; x.beginPath(); x.arc(R() * W, R() * H, 10 + R() * 50, 0, TAU); x.fill(); } draw(x, W, H, R); });
function scribbles(x, x0, y0, w, h, n, R, c = 'rgba(70,45,25,.75)') { x.strokeStyle = c; x.lineWidth = Math.max(2, h / n * .18); x.lineCap = 'round'; for (let i = 0; i < n; i++) { const y = y0 + (i + .5) * h / n; let px = x0; x.beginPath(); x.moveTo(px, y); while (px < x0 + w * (.75 + R() * .25)) { const s = 6 + R() * 16; x.quadraticCurveTo(px + s / 2, y - h / n * .3 * (R() - .3), px + s, y); px += s + (R() < .2 ? 10 : 0); if (R() < .2) x.moveTo(px, y); } x.stroke(); } }

const HISTORY = {
  pyramid: { tags: ['history', 'building'], desc: 'a stone pyramid with block courses and a gold capstone (size: base width m, default 30; kind: "smooth" | "steps" for a stepped temple-pyramid with a front stair and a shrine on top)',
    make(o) {
      const S = o.size ?? 30, root = grp('pyramid'), sand = o.color ?? '#e2c48a';
      if (o.kind === 'steps') {
        const n = o.steps ?? 6, H = S * .55, st = stoneMat(o.color ?? '#b9b09a', 6, 1.2);
        for (let i = 0; i < n; i++) { const w = lerp(S, S * .32, i / n), h = H / n; add(root, rbox(w, h * .96, w, h * .1), st, [0, h * i + h / 2, 0]); }
        const sw = S * .16, top = H, d = S / 2 - S * .32 / 2;
        const stair = add(root, rbox(sw, .3, Math.hypot(top, d), .05), M(shade(o.color ?? '#b9b09a', -.08), { rough: .9 }), [0, top / 2, S * .16 + d / 2]); stair.rotation.x = Math.atan2(top, d);
        for (let i = 0; i < 16; i++) { const u = (i + .5) / 16; add(root, rbox(sw * .96, top / 16 * .5, d / 16 * .9, .02), M(shade(o.color ?? '#b9b09a', .08), { rough: .9 }), [0, u * top, S / 2 - u * d]); }
        add(root, rbox(S * .2, H * .2, S * .2, .1), st, [0, H + H * .1, 0]);
        add(root, rbox(S * .07, H * .12, .3, .05), M('#1f1a17', { rough: 1 }), [0, H + H * .06, S * .1]);
        add(root, rbox(S * .24, S * .015, S * .24, .05), M('#c9452e', { rough: .7 }), [0, H + H * .2 + S * .008, 0]);
        return ink(root, S * .5);
      }
      const H = S * .64, b = S / 2, cut = .9, t = canvasTex(512, 512, (x, w, h) => { x.fillStyle = shade(sand, -.25); x.fillRect(0, 0, w, h); const R = rnd(5); for (let r = 0; r < 16; r++) { let px = r % 2 ? -16 : 0; while (px < w) { const bw = 40 + R() * 30; x.fillStyle = shade(sand, (R() - .5) * .12); x.fillRect(px + 2, r * h / 16 + 2, bw - 4, h / 16 - 4); px += bw; } } });
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(S / 9, H / 9);
      add(root, pyrGeo(b, b * (1 - cut), 0, H * cut), mapMat('#ffffff', t, { rough: .95 }));
      add(root, pyrGeo(b * (1 - cut) * 1.02, 0, H * cut - .001, H), M('#f0c24a', { rough: .3, metal: .4 }));
      return ink(root, S * .5);
    } },
  column: { tags: ['history', 'building'], desc: 'a fluted marble column with base and capital (h default 4; broken: true for a snapped one with its capital lying beside it; seed; color)',
    make(o) {
      const root = grp('column'), c = o.color ?? '#ece5d3'; root.add(makeColumn(o));
      if (o.broken) { const R = rnd(o.seed ?? 1), cap = grp(); cap.position.set(.75, .2, .35); cap.rotation.set(PI / 2 - .2, R() * PI, 0); root.add(cap); add(cap, lathe([[.27, 0], [.34, .05], [.42, .2], [.43, .25], [0, .25]], 32), M(c, { rough: .75 }), [0, -.1, 0]); add(cap, rbox(.9, .2, .9, .04), M(c, { rough: .75 }), [0, .25, 0]);
        const drum = add(root, rcyl(.3, .3, .6, .05, 32), M(c, { rough: .75 }), [-.6, .3, .6], [PI / 2, .7, 0]); drum.position.y = .3; }
      return ink(root, o.h ?? 4);
    } },
  temple: { tags: ['history', 'building'], desc: 'a classical temple front: three steps, a row of six fluted columns, frieze, triangular pediment and roof, dark doorway (12 m wide, 10 m tall; ruin: true for broken columns and no roof; color)',
    make(o) {
      const root = grp('temple'), c = o.color ?? '#ece5d3', stone = M(c, { rough: .75 }), dark = M(shade(c, -.12), { rough: .8 });
      add(root, rbox(13.4, .3, 8.6, .05), dark, [0, .15, 0]); add(root, rbox(12.8, .3, 8.0, .05), stone, [0, .45, 0]); add(root, rbox(12.2, .3, 7.4, .05), dark, [0, .75, 0]);
      add(root, rbox(9, 6, .7, .1), M(shade(c, -.05), { rough: .85 }), [0, 3.9, -1.6]);
      add(root, rbox(2.2, 3.8, .3, .2), M('#2a2320', { rough: 1 }), [0, 2.8, -1.15]);
      const broken = o.ruin ? [1, 4] : [];
      const spots = [...[-5, -3, -1, 1, 3, 5].map(x => [x, 3.0]), [-5, .4], [5, .4], [-5, -2.4], [5, -2.4]];
      spots.forEach(([x, z], i) => { const col = makeColumn({ h: 6, r: .38, color: c, broken: broken.includes(i), seed: i + 1 }); col.position.set(x, .9, z); root.add(col); });
      if (!o.ruin) {
        add(root, rbox(11.6, .6, 6.9, .04), stone, [0, 7.2, .3]);
        const fr = canvasTex(512, 64, (x, w, h) => { x.fillStyle = shade(c, -.04); x.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { x.fillStyle = shade(c, -.22); const px = i * w / 16 + 6; x.fillRect(px, 6, 5, h - 12); x.fillRect(px + 10, 6, 5, h - 12); } });
        fr.wrapS = THREE.RepeatWrapping; fr.repeat.set(1, 1);
        add(root, rbox(11.8, .7, 7.1, .04), mapMat('#ffffff', fr, { rough: .8 }), [0, 7.85, .3]);
        add(root, rbox(12.5, .25, 7.7, .05), stone, [0, 8.32, .3]);
        const ped = add(root, ext(shapeOf([[-6.2, 0], [6.2, 0], [0, 1.9]]), 7.5, .06), stone, [0, 8.45, .3]); void ped;
        add(root, ext(shapeOf([[-5.1, .25], [5.1, .25], [0, 1.5]]), .12, .02), M(shade(c, -.18), { rough: .85 }), [0, 8.45, 4.13]);
        const a = Math.atan2(1.9, 6.2), L = Math.hypot(1.9, 6.2) + .3;
        for (const s of [-1, 1]) add(root, rbox(L, .16, 7.9, .05), M(o.roof ?? '#c76a45', { rough: .8 }), [s * 3.05, 8.45 + .98, .3], [0, 0, -s * a]);
      } else {
        add(root, rbox(6.4, .6, 1.0, .04), stone, [-2, 7.2, 3.0]);
        const d = add(root, rcyl(.36, .36, 1.1, .05, 32), stone, [3.2, .36, 5.2], [PI / 2, .9, 0]); void d;
      }
      return ink(root, 10);
    } },
  'castle-tower': { tags: ['history', 'building'], desc: 'a round stone castle tower with arrow slits, an arched door and either a pointed slate roof with a pennant (default) or a crenellated top (roof: false) (h default 11; r 2.6; roofColor)',
    make(o) {
      const R0 = o.r ?? 2.6, H = o.h ?? 11, root = grp('castle-tower'), c = o.color ?? '#b5ada0';
      const tw = rcyl(R0, R0 + .3, H, .12, 48); { const P = tw.attributes.position, U = tw.attributes.uv; for (let i = 0; i < P.count; i++) U.setY(i, P.getY(i) / H); }
      add(root, tw, stoneMat(c, Math.round(TAU * R0 / 2.4), Math.round(H / 1.6)));
      add(root, rcyl(R0 + .45, R0 - .05, .6, .12, 48), M(shade(c, -.08), { rough: .9 }), [0, H - .05, 0]);
      const dark = M('#1e1a18', { rough: 1 });
      for (const [y, a] of [[3.8, 0], [7, .7], [7, -.7], [5.4, 1.6], [5.4, -1.6]]) { const s = add(root, rbox(.2, .9, .5, .08), dark, [Math.sin(a) * (R0 + .1), y, Math.cos(a) * (R0 + .1)]); s.rotation.y = a; }
      const arch = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, PI, false); s.lineTo(-w / 2, 0); return s; };
      const fr = new THREE.Shape(); fr.moveTo(-.95, 0); fr.lineTo(-.7, 0); fr.lineTo(-.7, 1.85); fr.absarc(0, 1.85, .7, PI, 0, true); fr.lineTo(.7, 0); fr.lineTo(.95, 0); fr.lineTo(.95, 1.95); fr.absarc(0, 1.95, .95, 0, PI, false); fr.lineTo(-.95, 0);
      add(root, ext(fr, .6, .06), M(shade(c, .12), { rough: .9 }), [0, 0, R0 + .3]);
      add(root, ext(arch(1.4, 2.55), .2, .02), mapMat('#ffffff', wood('#7a4a2a', 'door', 1), { rough: .8 }), [0, 0, R0 + .38]);
      for (const x of [-.35, .35]) add(root, rbox(.08, .08, .08, .02), M('#3b3f4b'), [x, 1.2, R0 + .5]);
      if (o.roof !== false) {
        const rc = o.roofColor ?? '#4f5f94';
        const rg = lathe([[0, 0], [R0 + .75, 0], [R0 + .7, .22], [R0 * .4, H * .38], [0, H * .62]], 48);
        add(root, rg, M(rc, { rough: .65 }), [0, H + .5, 0]);
        add(root, new THREE.TorusGeometry(R0 + .72, .1, 8, 48), M(shade(rc, -.25)), [0, H + .55, 0], [PI / 2, 0, 0]);
        const top = H + .5 + H * .62; rod(root, [0, top - .3, 0], [0, top + 2, 0], .05, M('#3b3f4b'));
        const fg = cloth(1.4, .55, .02, 12, 4, (u, v) => Math.sin(u * 6) * .06 * u); { const P = fg.attributes.position; for (let i = 0; i < P.count; i++) { const u = P.getX(i) / 1.4 + .5; P.setY(i, P.getY(i) * (1 - u * .85)); } fg.computeVertexNormals(); }
        add(root, fg, M(o.flag ?? '#d23b2c', { rough: .7 }), [.72, top + 1.6, 0]);
      } else {
        const n = Math.round(TAU * (R0 + .3) / 1.15);
        const pg = lathe([[R0 + .05, 0], [R0 + .45, 0], [R0 + .45, .7], [R0 + .05, .7], [R0 + .05, 0]], 48); { const P = pg.attributes.position, U = pg.attributes.uv; for (let i = 0; i < P.count; i++) U.setY(i, P.getY(i) / .7); }
        add(root, pg, stoneMat(c, Math.round(TAU * R0 / 2.4), 1), [0, H + .5, 0]);
        for (let i = 0; i < n; i++) { const a = i / n * TAU, m = add(root, rbox(.62, .7, .4, .06), M(c, { rough: .9 }), [Math.sin(a) * (R0 + .25), H + 1.55, Math.cos(a) * (R0 + .25)]); m.rotation.y = a; }
      }
      return ink(root, H * .6);
    } },
  'castle-wall': { tags: ['history', 'building'], desc: 'a straight stone castle wall segment with crenellations along both edges and arrow slits; chain several end to end (len default 8, h 5, along x)',
    make(o) {
      const L = o.len ?? 8, H = o.h ?? 5, T = 2.2, root = grp('castle-wall'), c = o.color ?? '#b5ada0';
      add(root, rbox(L, H, T, .08), stoneMat(c, Math.round(L / 2.6), Math.round(H / 1.3)), [0, H / 2, 0]);
      const n = Math.floor(L / 1.3), mm = M(c, { rough: .9 }), dark = M('#1e1a18', { rough: 1 });
      for (let i = 0; i < n; i++) { const x = -L / 2 + (i + .5) * L / n; for (const z of [T / 2 - .22, -T / 2 + .22]) add(root, rbox(.72, .85, .44, .06), mm, [x, H + .42, z]); }
      for (let i = 0; i < Math.floor(L / 2.6); i++) add(root, rbox(.16, .75, .2, .06), dark, [-L / 2 + (i + .5) * L / Math.floor(L / 2.6), H * .58, T / 2 - .02]);
      return ink(root, Math.max(L, H) * .6);
    } },
  palisade: { tags: ['history', 'building'], desc: 'a wooden palisade: a row of sharpened log stakes with two cross beams behind (len default 6 along x; h 3)',
    make(o) {
      const L = o.len ?? 6, H = o.h ?? 3, root = grp('palisade'), R = rnd(o.seed ?? 1), n = Math.round(L / .34), lg = grp();
      for (let i = 0; i < n; i++) { const r = .15 + R() * .03, h = H * (.9 + R() * .15); const g = lathe([[0, 0], [r, 0], [r, h], [r * .5, h + .3], [r * .12, h + .42], [0, h + .44]], 14); paint(g, (x, y) => y > h + .02 ? '#d6a86c' : cmix('#7a4e2c', '#94643a', .5 + .5 * Math.sin(Math.atan2(x, y) * 3 + i))); const m = add(lg, g, vcMat({ rough: .85 }), [-L / 2 + (i + .5) * L / n, 0, (R() - .5) * .06], [(R() - .5) * .06, 0, (R() - .5) * .06]); void m; }
      root.add(bake(lg));
      for (const y of [.8, H * .75]) rod(root, [-L / 2, y, -.26], [L / 2, y, -.26], .1, M('#7a4e2c', { rough: .85 }));
      return ink(root, H);
    } },
  cannon: { tags: ['history', 'weapon'], desc: 'an old iron cannon on a wooden carriage with two big spoked wheels, muzzle +z, a pile of cannonballs (balls: false). userData.barrel (tilt on x), muzzleAt',
    make(o) {
      const root = grp('cannon'), iron = M(o.color ?? '#33363d', { rough: .45, metal: .35 }), woodM = M('#8a5530', { rough: .8 }), dark = M('#2b2f38', { rough: .6 });
      const cheek = ext(shapeOf([[-1.55, 0], [-1.4, 0], [.35, .42], [.55, .45], [.62, .72], [.25, .9], [-.1, .82], [-1.55, .22]]), .12, .03);
      for (const s of [-1, 1]) add(root, cheek, woodM, [s * .28, 0, 0], [0, -PI / 2, 0]);
      add(root, rbox(.7, .12, .3, .04), woodM, [0, .22, -1.2]);
      rod(root, [-.62, .62, .25], [.62, .62, .25], .055, dark);
      for (const s of [-1, 1]) {
        const wg = grp(); wg.position.set(s * .58, .62, .25); wg.rotation.y = PI / 2; root.add(wg);
        add(wg, new THREE.TorusGeometry(.56, .055, 10, 40), woodM); add(wg, new THREE.TorusGeometry(.6, .03, 8, 40), dark);
        add(wg, rcyl(.11, .11, .2, .04, 16), woodM, [0, 0, -.1], [PI / 2, 0, 0]);
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; rod(wg, [0, 0, 0], [Math.cos(a) * .53, Math.sin(a) * .53, 0], .028, woodM, { seg: 8 }); }
      }
      const barrel = grp('barrel'); barrel.position.set(0, .82, .2); barrel.rotation.x = -.08; root.add(barrel);
      add(barrel, zLathe([[0, -.95], [.06, -.95], [.085, -.9], [.05, -.84], [.16, -.8], [.21, -.7], [.21, -.6], [.23, -.57], [.23, -.49], [.2, -.47], [.165, .6], [.19, .64], [.19, .72], [.165, .74], [.16, .82], [.13, .86], [.1, .86], [.1, .7], [0, .7]], 36, 0), iron);
      add(barrel, sphere(.1, 12, 8), M('#0d0d10', { rough: 1 }), [0, 0, .72], null, [1, 1, .3]);
      for (const s of [-1, 1]) add(barrel, rcyl(.06, .06, .14, .02, 12), iron, [s * .16, 0, 0], [0, 0, -s * PI / 2]);
      if (o.balls !== false) { const bm = M('#2b2d33', { rough: .5, metal: .3 }); for (const [x, y, z] of [[1.0, .1, .5], [1.2, .1, .5], [1.1, .1, .67], [1.1, .26, .56]]) add(root, sphere(.1, 16, 12), bm, [x, y, z]); }
      barrel.updateMatrix(); const mz = V3(0, 0, .86).applyMatrix4(barrel.matrix);
      Object.assign(root.userData, { barrel, muzzleAt: mz.toArray() });
      return ink(root, 2);
    } },
  catapult: { tags: ['history', 'weapon'], desc: 'a wooden catapult on four wheels with a throwing arm, rope torsion bundle and a stone in its cup; front +z (fire: 0 cocked .. 1 thrown; load: false). userData.arm, setFire(k)',
    make(o) {
      const root = grp('catapult'), woodM = M('#9a6a3c', { rough: .8 }), dk = M('#6e4325', { rough: .8 }), rope = M('#c9a56a', { rough: .9 }), iron = M('#3b3f4b', { rough: .5 });
      for (const s of [-1, 1]) add(root, rbox(.24, .26, 3.3, .05), woodM, [s * .7, .62, 0]);
      for (const z of [-1.4, -.2, 1.4]) add(root, rbox(1.66, .2, .22, .04), dk, [0, .62, z]);
      for (const s of [-1, 1]) for (const z of [-1.05, 1.05]) { add(root, rcyl(.46, .46, .18, .05, 28), dk, [s * .92, .46, z], [0, 0, -s * PI / 2]); add(root, rcyl(.12, .12, .22, .03, 12), iron, [s * .92, .46, z], [0, 0, -s * PI / 2]); }
      for (const s of [-1, 1]) { rod(root, [s * .62, .72, .5], [s * .5, 2.15, .55], .1, woodM, { seg: 8 }); rod(root, [s * .62, .72, 1.35], [s * .52, 1.7, .62], .07, woodM, { seg: 8 }); }
      add(root, rbox(1.25, .24, .28, .06), woodM, [0, 2.1, .55]); add(root, rbox(.6, .2, .16, .06), M('#8a2a22', { rough: .9 }), [0, 2.1, .4]);
      add(root, rcyl(.22, .22, 1.3, .08, 20), rope, [-.65, .82, -.3], [0, 0, -PI / 2]);
      const arm = grp('arm'); arm.position.set(0, .82, -.3); root.add(arm);
      add(arm, rbox(.18, 3.0, .2, .05), woodM, [0, 1.5, 0]);
      add(arm, lathe([[0, 0], [.2, .02], [.3, .12], [.32, .22], [.29, .22], [.27, .14], [.18, .07], [0, .06]], 24), dk, [0, 2.95, .08], [PI / 2, 0, 0]);
      if (o.load !== false) add(arm, blob({ seed: 2, amp: .2, detail: 3 }), M('#8f8b86', { rough: 1 }), [0, 2.95, .28], null, .2);
      const setFire = k => { arm.rotation.x = lerp(-1.32, .5, clamp(k)); };
      setFire(o.fire ?? 0);
      Object.assign(root.userData, { arm, setFire });
      return ink(root, 3.3);
    } },
};

/** a ship that rocks on the water (pure function of t): a = amplitude multiplier */
const rocking = (ship, base, a = 1, ph = 0) => t => { ship.rotation.z = .03 * a * Math.sin(t * .7 + ph); ship.rotation.x = .015 * a * Math.sin(t * .53 + ph + 1); ship.position.y = base + .1 * a * Math.sin(t * .9 + ph); };
Object.assign(HISTORY, {
  galleon: { tags: ['history', 'ocean', 'vehicle'], desc: 'a three-masted sailing galleon with billowing sails, stern castle with lit windows, gunports and a bowsprit; bow +z, waterline at y = 0, gently rocking (len default 26 m; rock: 0 to hold still; sail colour)',
    make(o) {
      const L = o.len ?? 26, B = L * .3, D = L * .22, root = grp('galleon'), ship = grp('ship'); root.add(ship);
      const H = hullGeo({ L, B, D, transom: .75, sheerBow: .3, sheerStern: .45, keelRise: .3, full: .55 }), draft = D * .42;
      paint(H.geo, (x, y) => y < draft * 1.05 ? '#7a3226' : Math.abs(y - D * .74) < D * .07 ? '#d9a23c' : Math.abs(Math.sin(y / D * 26)) < .12 ? '#3e2716' : '#5c3a22');
      const gold = M('#d9a23c', { rough: .45, metal: .2 }), dk = M('#3e2716', { rough: .8 }), woodM = M('#6e4325', { rough: .8 });
      hullMeshes(ship, H, vcMat({ rough: .8 }), '#3a2616', gold, D * .035);
      const dy = D * .1; add(ship, deckGeo(H, dy), mapMat('#ffffff', wood('#b98a5a', 'gdeck', 6), { rough: .85 }));
      const deckY = u => H.yT(u) - dy, zOf = u => (u - .5) * L;
      for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const u = .26 + i * .075, x = H.wF(u) * B / 2; add(ship, rbox(.6, .52, .4, .1), M('#1b1512', { rough: 1 }), [s * (x * .985), D * .6, zOf(u)]); }
      // stern castle + forecastle
      const cw = H.wF(.1) * B * .92, cz = zOf(.1), cy = deckY(.1);
      add(ship, rbox(cw, 2.6, .2 * L, .25), woodM, [0, cy + 1.3, cz]); add(ship, rbox(cw + .2, .3, .2 * L + .2, .1), gold, [0, cy + 2.65, cz]);
      for (let i = 0; i < 4; i++) add(ship, rbox(.7, .9, .2, .12), glow('#ffcf7a', 1.1), [(i - 1.5) * cw / 4.4, cy + 1.4, cz - .1 * L - .02]);
      add(ship, rbox(cw * .9, .2, .14, .06), gold, [0, cy + .7, cz - .1 * L - .02]);
      for (const s of [-1, 1]) { add(ship, sphere(.28, 14, 10), glow('#ffd58a', 2), [s * cw * .35, cy + 3.4, cz - .1 * L + .3]); rod(ship, [s * cw * .35, cy + 2.8, cz - .1 * L + .3], [s * cw * .35, cy + 3.15, cz - .1 * L + .3], .05, dk); }
      const fw = H.wF(.86) * B * .8; add(ship, rbox(fw, 1.5, .12 * L, .22), woodM, [0, deckY(.86) + .75, zOf(.86)]); add(ship, rbox(fw + .2, .25, .12 * L + .2, .1), gold, [0, deckY(.86) + 1.55, zOf(.86)]);
      // masts, yards, sails
      const sailC = o.sail ?? '#f3ead2', mainT = canvasTex(256, 256, (x, w, h) => { x.fillStyle = sailC; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,90,50,.18)'; x.lineWidth = 3; for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(i * w / 6, 0); x.lineTo(i * w / 6, h); x.stroke(); } x.fillStyle = o.emblem ?? '#c9412f'; x.beginPath(); x.arc(w / 2, h * .5, w * .2, 0, TAU); x.fill(); x.fillStyle = sailC; x.beginPath(); x.arc(w / 2, h * .5, w * .12, 0, TAU); x.fill(); });
      const sm = mapMat('#ffffff', mainT, { rough: .8 }), plain = M(sailC, { rough: .8 });
      const sail = (w, h, y, z, m) => { const g = cloth(w, h, .06, 14, 10, (u, v) => .14 * w * Math.sin(PI * u) * Math.sin(PI * (.15 + .85 * v))); add(ship, g, m, [0, y, z + .25]); };
      for (const [u, hm, big] of [[.7, 3.2, 0], [.47, 3.6, 1], [.24, 2.6, 0]]) {
        const z = zOf(u), y0 = deckY(u), h = hm * D; rod(ship, [0, y0, z], [0, y0 + h, z], .045 * D * (big ? 1.15 : 1), woodM, { seg: 14 });
        const y1 = y0 + h * .42, y2 = y0 + h * .78, w1 = B * (big ? 1.25 : 1.05), w2 = w1 * .75;
        rod(ship, [-w1 / 2, y1, z + .15], [w1 / 2, y1, z + .15], .03 * D, dk); rod(ship, [-w2 / 2, y2, z + .15], [w2 / 2, y2, z + .15], .025 * D, dk);
        sail(w1 * .92, h * .34, y1 - h * .18, z, big ? sm : plain); sail(w2 * .9, h * .3, y2 - h * .16, z, plain);
        add(ship, rcyl(.55, .45, .5, .1, 16), dk, [0, y2 + h * .08, z]);
        const pen = cloth(2.2, .45, .02, 8, 2, (uu) => .08 * Math.sin(uu * 5)); { const P = pen.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) * (1 - (P.getX(i) / 2.2 + .5) * .9)); pen.computeVertexNormals(); }
        add(ship, pen, M(o.emblem ?? '#c9412f', { rough: .7 }), [0, y0 + h + .1, z - 1.1], [0, PI / 2, 0]);
        for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { const l = rod(ship, [0, y0 + h * .8, z], [s * H.wF(u) * B / 2 * .97, H.yT(u), z + (j - 1) * 1.2], .025, dk, { flat: true, seg: 5 }); l.userData.noOutline = true; }
      }
      const bz = L / 2, by = H.yT(1); rod(ship, [0, by - .4, bz - 1], [0, by + 2.6, bz + .28 * L], .12 * D * .3, woodM, { seg: 10 });
      const jib = add(ship, ext(shapeOf([[0, 0], [5.5, 0], [0, 7]]), .05, .02), plain, [0, by + .6, bz + .2 * L], [0, PI / 2, 0]); jib.scale.set(L / 26, L / 26, 1);
      add(ship, sphere(.35, 14, 10), gold, [0, H.yT(1) - .3, bz + .1]);
      ship.position.y = -draft;
      root.userData.update = (o.rock ?? 1) ? rocking(ship, -draft, o.rock ?? 1, o.seed ?? 0) : null; if (!root.userData.update) delete root.userData.update;
      root.userData.ship = ship;
      return ink(root, L * .5);
    } },
  longship: { tags: ['history', 'ocean', 'vehicle'], desc: 'a long Norse-style ship: clinker hull with curled stem and stern posts, round painted shields along the rails, striped square sail and oars; bow +z, waterline y = 0, rocking (len default 16; oars: false; rock)',
    make(o) {
      const L = o.len ?? 16, k = L / 16, B = 3.6 * k, D = 1.5 * k, root = grp('longship'), ship = grp('ship'); root.add(ship);
      const H = hullGeo({ L, B, D, double: true, sheerBow: 1.0, sheerStern: .85, keelRise: .45, full: .6, nu: 48 }), draft = D * .45;
      paint(H.geo, (x, y) => { const b = y / (.22 * k); return b - Math.floor(b) < .12 ? '#5a3a20' : Math.floor(b) % 2 ? '#a5713f' : '#93603a'; });
      const woodM = M('#93603a', { rough: .8 }), dk = M('#5a3a20', { rough: .8 });
      hullMeshes(ship, H, vcMat({ rough: .8 }), '#3e2716', dk, D * .05);
      add(ship, deckGeo(H, D * .35, .1, .9), mapMat('#ffffff', wood('#a77b4f', 'ldeck', 8), { rough: .85 }));
      for (const s of [1, -1]) { const z = s * L / 2, y = H.yT(s > 0 ? 1 : 0) - .1 * k;
        tube(ship, [[0, y - .5 * k, z - s * .25 * k], [0, y, z], [0, y + .55 * k, z + s * .25 * k], [0, y + .95 * k, z + s * .1 * k], [0, y + 1.05 * k, z - s * .25 * k], [0, y + .8 * k, z - s * .45 * k], [0, y + .62 * k, z - s * .3 * k]], .14 * k, woodM, { n: 40 });
        add(ship, sphere(.17 * k, 12, 10), woodM, [0, y + .66 * k, z - s * .3 * k]); }
      const pal = [['#c9412f', '#f2e2b8'], ['#e9b44c', '#2f4f9a'], ['#2f4f9a', '#f2e2b8'], ['#f2e2b8', '#c9412f']], kinds = ['half', 'quarters', 'swirl', 'cross'];
      const shG = lathe([[0, -.01], [.37, -.02], [.38, 0], [.34, .015], [.2, .035], [0, .04]], 28); shG.rotateX(PI / 2);
      { const P = shG.attributes.position, U = shG.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, P.getX(i) / .76 + .5, P.getY(i) / .76 + .5); }
      let n = 0;
      for (const s of [-1, 1]) for (let i = 0; i < 9; i++) { const u = .22 + i * .07, x = H.wF(u) * B / 2, sg = grp(); sg.position.set(s * (x + .04 * k), H.yT(u) - .3 * k, (u - .5) * L); sg.rotation.y = s * PI / 2; sg.scale.setScalar(k); ship.add(sg); const [a, b] = pal[n % 4]; add(sg, shG, mapMat('#ffffff', shieldTex(a, b, kinds[n % 4]), { rough: .6 })); add(sg, sphere(.08, 12, 8), M('#9aa3ad', { rough: .4, metal: .3 }), [0, 0, .04], null, [1, 1, .6]); n++; }
      const mz = 0, my = H.yT(.5) - D * .35, mh = 7.5 * k; rod(ship, [0, my, mz], [0, my + mh, mz], .14 * k, woodM, { seg: 12 });
      rod(ship, [-B * .85, my + mh * .88, mz + .2], [B * .85, my + mh * .88, mz + .2], .08 * k, dk);
      const st = canvasTex(256, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? (o.sail ?? '#c9412f') : '#f2e6c8'; x.fillRect(i * w / 8, 0, w / 8, h); } });
      add(ship, cloth(B * 1.6, mh * .55, .05, 14, 10, (u, v) => .5 * k * Math.sin(PI * u) * Math.sin(PI * (.1 + .9 * v))), mapMat('#ffffff', st, { rough: .8 }), [0, my + mh * .6, mz + .35]);
      if (o.oars !== false) for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const u = .25 + i * .085, x = H.wF(u) * B / 2, z = (u - .5) * L; rod(ship, [s * (x - .3 * k), H.yT(u) - .45 * k, z], [s * (x + 2.6 * k), draft - .25 * k, z + .5 * k], .045 * k, woodM, { seg: 8 }); add(ship, rbox(.08 * k, .2 * k, .6 * k, .03 * k), woodM, [s * (x + 2.75 * k), draft - .32 * k, z + .55 * k], [0, 0, s * .25]); }
      ship.position.y = -draft;
      if (o.rock ?? 1) root.userData.update = rocking(ship, -draft, o.rock ?? 1, o.seed ?? 0);
      root.userData.ship = ship;
      return ink(root, L * .5);
    } },
  scroll: { tags: ['history'], desc: 'a parchment scroll lying open with handwriting and a red seal (rolled: true for a rolled scroll tied with a ribbon; text: your own lines in a serif hand). Flat: solid false',
    make(o) {
      const root = grp('scroll'), parch = M('#efdcae', { rough: .8 }), woodM = M('#7a4e2c', { rough: .7 });
      if (o.rolled) {
        add(root, rcyl(.05, .05, .44, .02, 24), parch, [-.22, .05, 0], [0, 0, -PI / 2]);
        for (const s of [-1, 1]) add(root, sphere(.03, 12, 8), woodM, [s * .25, .05, 0]);
        add(root, new THREE.TorusGeometry(.053, .012, 8, 24), M('#c9412f', { rough: .6 }), [0, .05, 0], [0, PI / 2, 0]);
        add(root, rcyl(.03, .03, .012, .005, 20), M('#a8231d', { rough: .5 }), [0, .1, .02], [-.4, 0, 0]);
      } else {
        const t = parchTex('scrolltex' + (o.text || ''), 384, 512, (x, w, h, R) => { if (o.text) { x.fillStyle = 'rgba(60,35,20,.9)'; x.textAlign = 'center'; const ls = String(o.text).split('\n'); let fs = 54; x.font = `italic 600 ${fs}px Georgia, 'Times New Roman', serif`; ls.forEach((l, i) => x.fillText(l, w / 2, h * .2 + i * fs * 1.25)); } else scribbles(x, w * .12, h * .1, w * .76, h * .62, 9, R); x.fillStyle = '#b3241d'; x.beginPath(); x.arc(w * .72, h * .85, 26, 0, TAU); x.fill(); x.fillStyle = '#d9473b'; x.beginPath(); x.arc(w * .72, h * .85, 15, 0, TAU); x.fill(); });
        const sh = cloth(.44, .58, .005, 12, 20, (u, v) => .035 * Math.pow(Math.max(0, v - .86) / .14, 2) + .02 * Math.pow(Math.max(0, .1 - v) / .1, 2));
        add(root, sh, mapMat('#ffffff', t, { rough: .85 }), [0, .012, 0], [-PI / 2, 0, 0]);
        add(root, rcyl(.04, .04, .46, .015, 20), parch, [-.23, .04, -.3], [0, 0, -PI / 2]);
        add(root, rcyl(.016, .016, .54, .008, 12), woodM, [-.27, .018, .3], [0, 0, -PI / 2]);
        for (const s of [-1, 1]) { add(root, sphere(.026, 10, 8), woodM, [s * .28, .02, .3]); add(root, sphere(.024, 10, 8), woodM, [s * .25, .04, -.3]); }
        root.userData.solid = false;
      }
      return ink(root, .5);
    } },
  'quill-inkpot': { tags: ['history'], desc: 'a glass inkpot with a white feather quill standing in it (0.32 m). solid false',
    make(o) {
      const root = grp('quill-inkpot');
      add(root, lathe([[0, 0], [.05, 0], [.058, .01], [.058, .05], [.045, .068], [.028, .075], [.03, .085], [.024, .088], [0, .086]], 28), M(o.color ?? '#24365a', { rough: .15 }));
      add(root, rcyl(.023, .023, .004, .002, 16), M('#0b0b10', { rough: .3 }), [0, .084, 0]);
      const q = grp('quill'); q.position.set(0, .03, 0); q.rotation.set(-.25, 0, -.32); root.add(q);
      rod(q, [0, 0, 0], [0, .32, 0], .004, M('#e9dcc0', { rough: .5 }), { seg: 8 });
      const vane = ext(blobShape([[0, .11], [.028, .15], [.04, .22], [.03, .29], [.004, .34], [-.016, .3], [-.022, .2], [-.012, .13]], 40), .004, .002);
      add(q, vane, M(o.feather ?? '#f6f1e6', { rough: .7 }));
      root.userData.solid = false;
      return ink(root, .3);
    } },
  amphora: { tags: ['history'], desc: 'a two-handled terracotta amphora with black bands and a zig-zag frieze (0.86 m; color)',
    make(o) {
      const root = grp('amphora'), c = o.color ?? '#c96a3a';
      const t = tex('amph' + c, 256, 256, (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = '#2a1d17'; for (const [y, hh] of [[.16, .03], [.3, .015], [.46, .015], [.64, .05], [.9, .1]]) x.fillRect(0, (1 - y) * h, w, hh * h); x.strokeStyle = '#2a1d17'; x.lineWidth = 6; x.beginPath(); for (let i = 0; i <= 16; i++) x.lineTo(i * w / 16, (1 - (i % 2 ? .43 : .33)) * h); x.stroke(); for (let i = 0; i < 8; i++) { x.beginPath(); x.arc((i + .5) * w / 8, (1 - .55) * h, 8, 0, TAU); x.fill(); } });
      add(root, lathe([[0, 0], [.06, 0], [.065, .03], [.055, .07], [.12, .19], [.2, .36], [.215, .47], [.19, .6], [.11, .69], [.075, .72], [.07, .8], [.088, .83], [.09, .86], [.06, .865], [.058, .83], [0, .82]], 40), mapMat('#ffffff', t, { rough: .75 }));
      for (const s of [-1, 1]) tube(root, [[s * .07, .76, 0], [s * .16, .78, 0], [s * .2, .72, 0], [s * .19, .62, 0]], .018, M(c, { rough: .75 }));
      return ink(root, .8);
    } },
  sword: { tags: ['history', 'weapon'], desc: 'a straight sword standing on its tip as if stuck in the ground (lying: true to lie flat; 1 m). userData.grip',
    make(o) {
      const root = grp('sword'), g = grp(); root.add(g);
      add(g, ext(shapeOf([[0, 0], [.028, .09], [.032, .74], [-.032, .74], [-.028, .09]]), .008, .004, { bs: .8 }), M('#d4dae2', { rough: .28, metal: .35 }));
      add(g, rbox(.24, .035, .05, .015), M(o.metal ?? '#e0a83e', { rough: .35, metal: .35 }), [0, .76, 0]);
      add(g, rcyl(.02, .02, .17, .008, 14), M('#5a3a22', { rough: .7 }), [0, .78, 0]);
      for (let i = 0; i < 3; i++) add(g, new THREE.TorusGeometry(.021, .005, 6, 16), M('#3e2716'), [0, .82 + i * .045, 0], [PI / 2, 0, 0]);
      add(g, sphere(.032, 14, 10), M(o.metal ?? '#e0a83e', { rough: .35, metal: .35 }), [0, .97, 0]);
      if (o.lying) { g.rotation.set(-PI / 2, 0, 0); g.position.set(0, .03, .45); root.userData.grip = { at: [0, .03, -.42], rot: [-PI / 2, 0, 0] }; root.userData.solid = false; }
      else { g.position.y = -.04; root.userData.grip = { at: [0, .82, 0], rot: [0, 0, 0] }; }
      return ink(root, .9);
    } },
  shield: { tags: ['history', 'weapon'], desc: 'a round wooden shield with a painted design, iron rim and boss, standing upright facing +z (colors: [a, b]; design: "quarters" | "swirl" | "half" | "cross"; seed picks one). userData.grip',
    make(o) {
      const R = rnd(o.seed ?? 1), pals = [['#c9412f', '#f2e2b8'], ['#2f4f9a', '#e9b44c'], ['#2f7a4a', '#f2e2b8'], ['#e9b44c', '#5a2a1a']], [a, b] = o.colors ?? pals[Math.floor(R() * 4)], kind = o.design ?? ['quarters', 'swirl', 'half', 'cross'][Math.floor(R() * 4)];
      const root = grp('shield'), g = grp(); g.position.y = .47; g.rotation.x = -.12; root.add(g);
      const sg = lathe([[0, -.015], [.44, -.03], [.455, -.02], [.45, 0], [.36, .028], [.2, .052], [0, .06]], 40); sg.rotateX(PI / 2);
      { const P = sg.attributes.position, U = sg.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, P.getX(i) / .9 + .5, P.getY(i) / .9 + .5); }
      add(g, sg, mapMat('#ffffff', shieldTex(a, b, kind), { rough: .65 }));
      const iron = M('#5d636e', { rough: .4, metal: .35 });
      add(g, new THREE.TorusGeometry(.45, .022, 8, 48), iron);
      add(g, sphere(.1, 20, 14), iron, [0, 0, .05], null, [1, 1, .6]);
      root.userData.grip = { at: [0, .47, -.06], rot: [0, 0, 0] };
      return ink(root, .9);
    } },
  'knight-helmet': { tags: ['history', 'weapon'], desc: 'a steel knight\'s great helm with eye slits, breathing holes, brass cross strap and a red plume (plume: false; 0.42 m), sits on y = 0',
    make(o) {
      const root = grp('knight-helmet'), steel = M(o.color ?? '#b9c0c9', { rough: .32, metal: .4 }), brass = M('#d9a23c', { rough: .4, metal: .3 }), dark = M('#141216', { rough: 1 });
      add(root, slathe([[0, 0], [.15, 0], [.158, .02], [.156, .2], [.15, .3], [.13, .36], [.08, .395], [0, .405]], 40, 4), steel, null, null, [1, 1, 1.1]);
      for (const s of [-1, 1]) add(root, rbox(.11, .022, .05, .01), dark, [s * .062, .255, .158], [0, s * .32, 0]);
      add(root, rbox(.028, .3, .03, .01), brass, [0, .2, .166]);
      add(root, new THREE.TorusGeometry(.162, .012, 8, 40, PI * .9), brass, [0, .29, 0], [PI / 2, 0, PI * .05], [1, 1.1, 1]);
      for (let i = 0; i < 6; i++) add(root, sphere(.009, 8, 6), dark, [.04 + (i % 3) * .028, .1 + Math.floor(i / 3) * .03, .158 - (i % 3) * .01]);
      add(root, new THREE.TorusGeometry(.152, .012, 8, 40), brass, [0, .012, 0], [PI / 2, 0, 0], [1, 1.1, 1]);
      if (o.plume !== false) { const pm = M(o.plumeColor ?? '#d23b2c', { rough: .7 }); for (let i = 0; i < 4; i++) tube(root, [[0, .39, .02], [(i - 1.5) * .02, .5, -.04 - i * .01], [(i - 1.5) * .03, .55, -.16], [(i - 1.5) * .035, .5, -.27 - i * .015]], .035 - i * .004, pm); }
      return ink(root, .45);
    } },
  'wall-torch': { tags: ['history', 'light'], desc: 'a burning torch in an iron wall bracket: back plate at z = 0 (put it against a wall), flame at ~2.2 m (h: bracket height, default 1.9; lit: false). userData.light (flickers), fireAt',
    make(o) {
      const root = grp('wall-torch'), y0 = o.h ?? 1.9, iron = M('#3b3f4b', { rough: .5, metal: .3 });
      add(root, rbox(.16, .32, .04, .02), iron, [0, y0, .02]);
      for (const y of [y0 + .1, y0 - .1]) add(root, sphere(.014, 8, 6), M('#8a8f99'), [0, y, .045]);
      rod(root, [0, y0 - .06, .03], [0, y0 + .02, .2], .016, iron);
      add(root, new THREE.TorusGeometry(.045, .012, 8, 20), iron, [0, y0 + .03, .22], [PI / 2, 0, 0]);
      const t = grp('torch'); t.position.set(0, y0 - .12, .22); t.rotation.x = .28; root.add(t);
      add(t, lathe([[.018, 0], [.024, .3], [.03, .4], [0, .4]], 14), M('#7a4e2c', { rough: .8 }));
      add(t, slathe([[0, .36], [.04, .37], [.056, .42], [.058, .5], [.045, .55], [0, .56]], 18, 3), M('#4a3524', { rough: 1 }));
      for (const y of [.4, .47]) add(t, new THREE.TorusGeometry(.055, .008, 6, 18), iron, [0, y, 0], [PI / 2, 0, 0]);
      let f = null, light = null;
      if (o.lit !== false) { f = flame(t, .9, [0, .53, 0]); light = new THREE.PointLight('#ffad5a', 5, 7, 1.7); light.position.set(0, .7, 0); t.add(light); }
      t.updateMatrix(); const fa = V3(0, .55, 0).applyMatrix4(t.matrix);
      Object.assign(root.userData, { fireAt: fa.toArray(), light });
      if (f) root.userData.update = tt => { f.userData.flicker(tt, o.seed ?? 0); light.intensity = 5 * (1 + .18 * noise1(tt * 9, 3) + .1 * noise1(tt * 23, 7)); };
      return ink(root, .6);
    } },
});

function makeCrown(o = {}) {
  const g = grp('crown'), gold = M(o.color ?? '#f0c24a', { rough: .3, metal: .4 }), gems = ['#e2433f', '#3f6fd1', '#3fbf6a'];
  add(g, lathe([[.095, 0], [.108, 0], [.112, .075], [.1, .075], [.09, .005], [.095, 0]], 40), gold);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, p = add(g, ext(shapeOf([[-.034, 0], [.034, 0], [0, .075]]), .012, .004), gold, [Math.sin(a) * .104, .07, Math.cos(a) * .104]); p.rotation.y = a; add(g, sphere(.013, 10, 8), gold, [Math.sin(a) * .104, .15, Math.cos(a) * .104]); add(g, sphere(.016, 12, 8), M(gems[i % 3], { rough: .15 }), [Math.sin(a) * .113, .037, Math.cos(a) * .113], null, [1, 1, .6]).lookAt(Math.sin(a) * 9, .037, Math.cos(a) * 9); }
  if (o.cap !== false) add(g, sphere(.094, 24, 14, ), M('#9a1f2c', { rough: .8 }), [0, .03, 0], null, [1, .8, 1]);
  return g;
}
Object.assign(HISTORY, {
  throne: { tags: ['history'], desc: 'a royal throne: gold frame, tall arched back and red cushions, front +z (dais: true adds a two-step platform with a red carpet; color, cushion). userData.seat',
    make(o) {
      const root = grp('throne'), g = grp(); root.add(g), void 0;
      const gold = M(o.color ?? '#e0a83e', { rough: .35, metal: .3 }), red = M(o.cushion ?? '#b3242c', { rough: .85 }), dark = M('#7a2a1c', { rough: .7 });
      let base = 0;
      if (o.dais) { add(root, rbox(2.8, .2, 2.4, .04), M('#a59d90', { rough: .9 }), [0, .1, 0]); add(root, rbox(2.2, .2, 1.8, .04), M('#bdb5a8', { rough: .9 }), [0, .3, -.1]); add(root, rbox(.9, .02, 2.0, .01), red, [0, .21, .6]); base = .4; }
      g.position.y = base;
      for (const x of [-.42, .42]) for (const z of [-.3, .3]) add(g, lathe([[.05, 0], [.07, .03], [.05, .08], [.06, .14], [.05, .16], [0, .16]], 14), gold, [x, 0, z]);
      add(g, rbox(1.0, .26, .8, .06), gold, [0, .28, 0]);
      add(g, rbox(.86, .14, .7, .06), red, [0, .47, .02]);
      const back = new THREE.Shape(); back.moveTo(-.5, 0); back.lineTo(.5, 0); back.lineTo(.5, 1.45); back.quadraticCurveTo(.5, 1.75, 0, 1.95); back.quadraticCurveTo(-.5, 1.75, -.5, 1.45); back.lineTo(-.5, 0);
      add(g, ext(back, .14, .04), gold, [0, .36, -.36]);
      const pad = new THREE.Shape(); pad.moveTo(-.36, 0); pad.lineTo(.36, 0); pad.lineTo(.36, 1.2); pad.quadraticCurveTo(.36, 1.45, 0, 1.6); pad.quadraticCurveTo(-.36, 1.45, -.36, 1.2); pad.lineTo(-.36, 0);
      add(g, ext(pad, .06, .03), red, [0, .5, -.27]);
      for (const s of [-1, 1]) { add(g, rbox(.14, .14, .74, .05), gold, [s * .5, .74, .02]); add(g, rbox(.1, .3, .1, .03), gold, [s * .5, .56, .3]); add(g, sphere(.09, 14, 10), gold, [s * .5, .78, .4]); add(g, sphere(.08, 14, 10), gold, [s * .52, 1.88, -.36]); }
      const cr = makeCrown({ cap: false }); cr.position.set(0, 2.3, -.36); cr.scale.setScalar(1.3); g.add(cr);
      add(g, sphere(.07, 14, 10), M('#e2433f', { rough: .15 }), [0, 1.95, -.27], null, [1, 1, .5]);
      root.userData.seat = base + .54;
      return ink(root, 2);
    } },
  crown: { tags: ['history', 'treasure'], desc: 'a gold crown with eight points, coloured gems and a red velvet cap (cap: false; 0.25 m)', make(o) { const root = grp('crown'); root.add(makeCrown(o)); root.userData.solid = false; return ink(root, .3); } },
  'treasure-pile': { tags: ['history', 'treasure', 'ocean'], desc: 'a heap of gold coins with goblets, gems and a crown (r: radius, default 0.8 m; seed)',
    make(o) {
      const R0 = o.r ?? .8, Hh = R0 * .55, R = rnd(o.seed ?? 3), root = grp('treasure-pile'), gold = M('#f2c14e', { rough: .32, metal: .35 }), deep = M('#d99a2a', { rough: .4, metal: .3 });
      add(root, blob({ seed: o.seed ?? 3, amp: .12, detail: 4, flat: -.05, sy: .55 }), deep, [0, 0, 0], null, [R0, Hh / .55, R0]);
      const ht = (x, z) => Hh * Math.sqrt(Math.max(0, 1 - (x * x + z * z) / (R0 * R0))), coins = grp(), cg = rcyl(.045, .045, .012, .005, 18);
      for (let i = 0; i < 90; i++) { const a = R() * TAU, d = Math.sqrt(R()) * R0 * 1.05, x = Math.cos(a) * d, z = Math.sin(a) * d, y = ht(x, z), gx = (ht(x + .01, z) - ht(x - .01, z)) / .02, gz = (ht(x, z + .01) - ht(x, z - .01)) / .02; const m = new THREE.Mesh(cg, gold); m.position.set(x, Math.max(.005, y - .004), z); m.rotation.set(Math.atan(gz) + (R() - .5) * .5, R() * TAU, -Math.atan(gx) + (R() - .5) * .5); coins.add(m); }
      root.add(bake(coins));
      for (let i = 0; i < 2; i++) { const a = R() * TAU, d = R0 * (.3 + R() * .4), x = Math.cos(a) * d, z = Math.sin(a) * d; add(root, lathe([[0, 0], [.06, 0], [.065, .015], [.015, .04], [.015, .13], [.07, .17], [.09, .26], [.08, .27], [.0, .2]], 24), gold, [x, ht(x, z) - .03, z], [(R() - .5) * .4, 0, (R() - .5) * .4]); }
      for (let i = 0; i < 6; i++) { const a = R() * TAU, d = R0 * R() * .8, x = Math.cos(a) * d, z = Math.sin(a) * d; add(root, sphere(.04, 14, 10), M(['#e2433f', '#3f6fd1', '#3fbf6a', '#b57cff'][i % 4], { rough: .12 }), [x, ht(x, z) + .02, z], null, [1, .75, 1]); }
      const cr = makeCrown({}); cr.position.set(R0 * .15, Hh - .04, R0 * .1); cr.rotation.set(.25, .5, -.2); root.add(cr);
      return ink(root, R0 * 2);
    } },
  sarcophagus: { tags: ['history'], desc: 'a painted royal sarcophagus with a gold face mask and striped headdress, lying with the head at -z (stand: true to stand it upright facing +z; open: true to slide the lid aside; 2.2 m)',
    make(o) {
      const root = grp('sarcophagus'), g = grp(); root.add(g);
      const pts = [[0, 1.1], [.24, 1.06], [.32, .92], [.3, .74], [.38, .62], [.41, .3], [.37, -.3], [.3, -.85], [.24, -1.05], [0, -1.1]], outline = (k) => blobShape([...pts, ...pts.slice(1, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [x * k, y * k]), 80);
      const lay = (geo, d) => { geo.rotateX(-PI / 2); geo.translate(0, d / 2, 0); return geo; };
      add(g, lay(ext(outline(.95), .5, .04), .5), M(o.color ?? '#2f5fa8', { rough: .6 }));
      add(g, lay(ext(outline(1.0), .06, .02), .06), M('#e0a83e', { rough: .35, metal: .3 }), [0, .5, 0]);
      const t = canvasTex(256, 640, (x, w, h) => {
        x.fillStyle = '#e8b54a'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 14; i++) { x.fillStyle = i % 2 ? '#2f5fa8' : '#e8b54a'; x.beginPath(); x.ellipse(w / 2, h * .17, w * (.45 - i * .012), h * (.15 - i * .004), 0, PI * (.05 + i * .02), PI * (.95 - i * .02)); x.lineTo(w / 2, h * .17); x.fill(); }
        x.fillStyle = '#f2c860'; x.beginPath(); x.ellipse(w / 2, h * .12, w * .2, h * .085, 0, 0, TAU); x.fill();
        for (let i = 0; i < 5; i++) { x.strokeStyle = ['#c9412f', '#2f5fa8', '#3f9a6a', '#e8b54a', '#2f5fa8'][i]; x.lineWidth = 12; x.beginPath(); x.arc(w / 2, h * .2, w * (.25 + i * .045), PI * .15, PI * .85); x.stroke(); }
        x.fillStyle = '#2a1d17'; x.fillRect(w * .2, h * .44, w * .6, 8); x.fillRect(w * .2, h * .47, w * .6, 4);
        for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { const px = w * (.24 + c * .17), py = h * (.53 + r * .07), k = (r * 4 + c) % 4; x.fillStyle = '#2a1d17'; if (k === 0) { x.beginPath(); x.arc(px, py, 8, 0, TAU); x.fill(); } else if (k === 1) x.fillRect(px - 9, py - 3, 18, 6); else if (k === 2) { x.beginPath(); x.moveTo(px - 9, py + 7); x.lineTo(px + 9, py + 7); x.lineTo(px, py - 8); x.fill(); } else { x.fillRect(px - 2, py - 10, 4, 20); x.fillRect(px - 8, py - 2, 16, 4); } }
        x.strokeStyle = '#2f5fa8'; x.lineWidth = 6; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(w * (.18 + i * .32), h * .5); x.lineTo(w * (.18 + i * .32), h * .97); x.stroke(); }
      });
      t.repeat.set(1 / .86, 1 / 2.26); t.offset.set(.43 / .86, 1.13 / 2.26);
      const lid = grp('lid'); lid.position.y = .56; g.add(lid);
      add(lid, lay(ext(outline(1.0), .14, .09, { segs: 4 }), .14), mapMat('#ffffff', t, { rough: .5 }));
      add(lid, sphere(.17, 24, 16), M('#f2c860', { rough: .3, metal: .3 }), [0, .2, -.98], null, [1, .45, 1.2]);
      for (const s of [-1, 1]) add(lid, sphere(.03, 10, 8), M('#1b1512'), [s * .065, .27, -1.02], null, [1.4, .6, .8]);
      add(lid, rbox(.03, .025, .09, .01), M('#d9a23c'), [0, .275, -.92]);
      if (o.open) { lid.position.set(.62, .62, .1); lid.rotation.set(0, .25, -.12); add(g, lay(ext(outline(.82), .02, 0), .02), M('#1a120d', { rough: 1 }), [0, .5, 0]); }
      if (o.stand) { g.rotation.x = PI / 2; g.position.set(0, 1.15, -.35); }
      return ink(root, 2);
    } },
  statue: { tags: ['history', 'building'], desc: 'a generic stone statue of a robed figure holding up an orb, on a plinth (material: "stone" | "bronze"; 3.4 m)',
    make(o) {
      const root = grp('statue'), c = o.material === 'bronze' ? '#5f9e86' : (o.color ?? '#bdb6a6'), st = M(c, { rough: o.material === 'bronze' ? .45 : .85, metal: o.material === 'bronze' ? .3 : 0 }), pl = M(o.plinth ?? '#9d968a', { rough: .9 });
      add(root, rbox(1.3, .25, 1.3, .05), pl, [0, .125, 0]); add(root, rbox(1.1, .8, 1.1, .05), pl, [0, .65, 0]); add(root, rbox(1.25, .18, 1.25, .05), pl, [0, 1.12, 0]);
      const rg = lathe([[0, 0], [.42, 0], [.44, .06], [.36, .6], [.3, 1.1], [.28, 1.35], [.2, 1.5], [0, 1.55]], 48);
      { const P = rg.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), y = P.getY(i), a = Math.atan2(z, x), f = 1 + .05 * Math.sin(a * 9) * (1 - y / 1.6); P.setX(i, x * f); P.setZ(i, z * f); } rg.computeVertexNormals(); }
      add(root, rg, st, [0, 1.21, 0]);
      add(root, sphere(.19, 28, 20), st, [0, 3.0, 0]);
      add(root, new THREE.TorusGeometry(.18, .035, 8, 28), st, [0, 3.06, -.02], [PI / 2 - .2, 0, 0]);
      add(root, rcyl(.08, .09, .2, .03, 14), st, [0, 2.72, 0]);
      tube(root, [[.24, 2.62, 0], [.34, 2.9, .05], [.38, 3.2, .1], [.36, 3.45, .1]], .07, st);
      add(root, sphere(.13, 20, 14), st, [.36, 3.56, .1]);
      tube(root, [[-.24, 2.62, 0], [-.32, 2.35, .08], [-.3, 2.05, .16], [-.2, 1.9, .2]], .07, st);
      return ink(root, 3.4);
    } },
  'standing-stones': { tags: ['history', 'nature'], desc: 'ancient standing stones: two trilithons (two uprights and a lintel) and three single stones in an arc (kind: "ring" for a circle of n stones, r radius; mossy grey)',
    make(o) {
      const root = grp('standing-stones'), R = rnd(o.seed ?? 2), c = o.color ?? '#8f949c';
      const stone = (w, h, d, s) => { const g = blob({ seed: s, amp: .08, freq: 2.2, detail: 4, box: .85, sx: w / 2, sy: h / 2, sz: d / 2 }); paint(g, (x, y, z, nx, ny) => ny > .6 || f3(x * 3, y * 3, z * 3, s) > .35 ? cmix(c, '#6f8a4a', .65) : cmix(c, shade(c, -.2), .5 + f3(x * 2, y * 2, z * 2, s + 1))); return g; };
      const vm = vcMat({ rough: .95 }), put = (w, h, d, x, z, a, s, y = h / 2 - .1) => { const m = add(root, stone(w, h, d, s), vm, [x, y, z]); m.rotation.y = a; return m; };
      if (o.kind === 'ring') { const n = o.n ?? 9, r = o.r ?? 5; for (let i = 0; i < n; i++) { const a = i / n * TAU, h = 2.4 + R() * 1.4; put(.9 + R() * .4, h, .6, Math.sin(a) * r, Math.cos(a) * r, a, i + 1); } }
      else {
        for (const [x, z, a] of [[-2.1, -.4, .25], [2.1, -.4, -.25]]) { const ca = Math.cos(a), sa = Math.sin(a); for (const s of [-1, 1]) put(.9, 3.7, .7, x + s * .78 * ca, z - s * .78 * sa, a, Math.floor(R() * 99)); const l = put(2.7, .65, .75, x, z, a, Math.floor(R() * 99), 3.85); void l; }
        for (const [x, z, a, h] of [[-4.2, 1.2, .7, 2.6], [4.3, 1.4, -.7, 2.2], [0, -2.2, 0, 2.9]]) put(.95, h, .65, x, z, a, Math.floor(R() * 99));
      }
      return ink(root, 4);
    } },
  hourglass: { tags: ['history'], desc: 'a wooden hourglass with sand running from the top bulb to the bottom (flow: 0..1 how much has run; 0.33 m). userData.setFlow(k)',
    make(o) {
      const root = grp('hourglass'), woodM = M(o.color ?? '#8a5530', { rough: .6 }), sand = M('#e9c46a', { rough: .9 });
      add(root, rcyl(.12, .125, .035, .012, 28), woodM); add(root, rcyl(.125, .12, .035, .012, 28), woodM, [0, .3, 0]);
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .5; add(root, lathe([[.012, 0], [.016, .02], [.011, .05], [.016, .13], [.011, .21], [.016, .24], [.012, .265], [0, .265]], 10), woodM, [Math.cos(a) * .1, .035, Math.sin(a) * .1]); }
      const lower = add(root, lathe([[0, 0], [.08, 0], [.07, .015], [0, .07]], 24), sand, [0, .042, 0]);
      const upper = add(root, lathe([[0, 0], [.075, .07], [0, .07]], 24), sand, [0, .17, 0]);
      const stream = add(root, rcyl(.004, .004, .12, .001, 6), sand, [0, .05, 0]); stream.userData.noOutline = true;
      const gl = add(root, slathe([[.004, .035], [.06, .045], [.094, .08], [.098, .12], [.07, .155], [.012, .168], [.07, .181], [.098, .215], [.094, .255], [.06, .29], [.004, .3]], 28, 4), seeThru('#cfeaf2', .32, { side: THREE.DoubleSide }));
      noShadow(gl);
      const setFlow = k => { k = clamp(k); lower.scale.set(.55 + .45 * Math.sqrt(k), Math.max(.02, Math.pow(k, .7)), .55 + .45 * Math.sqrt(k)); upper.scale.setScalar(Math.max(.001, Math.pow(1 - k, .5))); upper.visible = k < .999; stream.visible = k > .001 && k < .999; };
      setFlow(o.flow ?? .4);
      root.userData.setFlow = setFlow; root.userData.solid = false;
      return ink(root, .33);
    } },
  sundial: { tags: ['history'], desc: 'a stone pedestal sundial with a bronze dial and a triangular gnomon (1.1 m)',
    make(o) {
      const root = grp('sundial'), st = M(o.color ?? '#c9c1b2', { rough: .9 }), br = M('#b8863a', { rough: .4, metal: .35 });
      add(root, rbox(.6, .12, .6, .04), st, [0, .06, 0]);
      add(root, lathe([[.2, 0], [.22, .04], [.17, .1], [.13, .2], [.12, .6], [.14, .74], [.2, .8], [.24, .85], [0, .85]], 32), st, [0, .12, 0]);
      const t = tex('dial', 256, 256, (x, w, h) => { x.fillStyle = '#c99a4a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#5a3a1a'; x.lineWidth = 4; x.beginPath(); x.arc(w / 2, h / 2, w * .44, 0, TAU); x.stroke(); x.beginPath(); x.arc(w / 2, h / 2, w * .3, 0, TAU); x.stroke(); for (let i = 0; i < 12; i++) { const a = PI + i / 11 * PI; x.lineWidth = i % 3 ? 3 : 6; x.beginPath(); x.moveTo(w / 2 + Math.cos(a) * w * .3, h / 2 + Math.sin(a) * w * .3); x.lineTo(w / 2 + Math.cos(a) * w * .44, h / 2 + Math.sin(a) * w * .44); x.stroke(); } x.fillStyle = '#5a3a1a'; x.beginPath(); x.arc(w / 2, h / 2, 8, 0, TAU); x.fill(); });
      const dial = add(root, rcyl(.3, .31, .04, .015, 40), br, [0, .97, 0]); void dial;
      const face = add(root, new THREE.CircleGeometry(.28, 40), mapMat('#ffffff', t, { rough: .45 }), [0, 1.0101, 0], [-PI / 2, 0, 0]); face.userData.noOutline = true;
      add(root, ext(shapeOf([[0, 0], [.26, 0], [0, .2]]), .02, .006), br, [0, 1.01, 0], [0, PI / 2, 0]);
      return ink(root, 1.1);
    } },
  'old-globe': { tags: ['history'], desc: 'an antique floor globe: parchment-coloured world map on a wooden tripod stand with brass meridian ring (spin: rad/s, default 0; 1.2 m)',
    make(o) {
      const root = grp('old-globe'), woodM = M('#7a4a2a', { rough: .6 }), brass = M('#d9a23c', { rough: .35, metal: .35 }), s = o.seed ?? 7;
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; tube(root, [[Math.cos(a) * .36, .78, Math.sin(a) * .36], [Math.cos(a) * .36, .5, Math.sin(a) * .36], [Math.cos(a) * .3, .2, Math.sin(a) * .3], [Math.cos(a) * .42, .02, Math.sin(a) * .42]], .028, woodM); }
      add(root, sphere(.05, 12, 8), woodM, [0, .3, 0]); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; rod(root, [0, .3, 0], [Math.cos(a) * .33, .3, Math.sin(a) * .33], .018, woodM); }
      add(root, new THREE.TorusGeometry(.4, .03, 10, 48), woodM, [0, .8, 0], [PI / 2, 0, 0]);
      const tilt = grp(); tilt.position.y = .8; tilt.rotation.z = .41; root.add(tilt);
      add(tilt, new THREE.TorusGeometry(.37, .014, 8, 48), brass);
      rod(tilt, [0, -.38, 0], [0, .38, 0], .008, brass);
      const map = planetTex('oldmap', s, (u, v) => { const [x, y, z] = dirOf(u, v), n = f3(x * 1.9 + s, y * 1.9, z * 1.9, s); const grid = (Math.abs(((u * 24) % 1) - .5) > .47 || Math.abs(((v * 12) % 1) - .5) > .47); let c = n > .1 ? lerp3(hexRGB('#a8834e'), hexRGB('#8a6a3c'), clamp((n - .1) * 3)) : lerp3(hexRGB('#ead6a6'), hexRGB('#d9c08c'), clamp(-n * 2)); if (Math.abs(n - .1) < .012) c = hexRGB('#5a3e22'); if (grid) c = lerp3(c, hexRGB('#7a5a3a'), .5); return c; });
      const ball = add(tilt, sphere(.33, 48, 32), mapMat('#ffffff', map, { rough: .6 }));
      root.userData.spin = o.spin ?? 0;
      root.userData.update = t => { ball.rotation.y = (root.userData.spin || 0) * t; };
      return ink(root, 1.2);
    } },
  'map-table': { tags: ['history'], desc: 'a heavy wooden table with an old treasure map spread on it (coastlines, compass rose, dotted route, red X), weights and a divider (userData.top; userData.screen: the map texture to redraw)',
    make(o) {
      const root = grp('map-table'), woodM = M(o.color ?? '#7a4a2a', { rough: .6 }), s = o.seed ?? 3;
      add(root, rbox(1.8, .08, 1.1, .03), mapMat('#ffffff', wood(o.color ?? '#8a5530', 'mtable', 5), { rough: .6 }), [0, .78, 0]);
      add(root, rbox(1.62, .12, .92, .02), woodM, [0, .68, 0]);
      for (const x of [-.78, .78]) for (const z of [-.43, .43]) add(root, lathe([[.05, 0], [.06, .03], [.045, .1], [.07, .3], [.04, .5], [.055, .62], [.05, .74], [0, .74]], 16), woodM, [x, 0, z]);
      const map = parchTex('treasuremap' + s, 768, 512, (x, w, h, R) => {
        const land = (px, py) => f3(px / w * 3.2 + s, py / h * 2.2, s * .3, s) + .25 - Math.hypot(px / w - .45, py / h - .5) * .9;
        const im = x.getImageData(0, 0, w, h), d = im.data;
        for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) { const L = land(i, j); if (L > 0) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const k = ((j + b) * w + i + a) * 4; d[k] = d[k] * .9; d[k + 1] = d[k + 1] * .86; d[k + 2] = d[k + 2] * .72; } if (Math.abs(L) < .012) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const k = ((j + b) * w + i + a) * 4; d[k] = 80; d[k + 1] = 52; d[k + 2] = 30; } }
        x.putImageData(im, 0, 0);
        x.strokeStyle = 'rgba(90,60,35,.5)'; x.lineWidth = 2; for (let i = 0; i < 14; i++) { const px = R() * w, py = R() * h; if (land(px, py) > 0) continue; x.beginPath(); for (let k = 0; k < 3; k++) { x.moveTo(px + k * 12, py); x.quadraticCurveTo(px + k * 12 + 5, py - 5, px + k * 12 + 10, py); } x.stroke(); }
        for (let i = 0; i < 6; i++) { const px = w * (.3 + R() * .3), py = h * (.3 + R() * .35); if (land(px, py) < .05) continue; x.fillStyle = 'rgba(90,60,35,.85)'; x.beginPath(); x.moveTo(px - 14, py + 8); x.lineTo(px, py - 12); x.lineTo(px + 14, py + 8); x.fill(); }
        x.setLineDash([10, 9]); x.strokeStyle = '#8a2a1a'; x.lineWidth = 5; x.beginPath(); x.moveTo(w * .08, h * .85); x.bezierCurveTo(w * .3, h * .9, w * .3, h * .45, w * .52, h * .48); x.stroke(); x.setLineDash([]);
        x.strokeStyle = '#c9241d'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(w * .52 - 16, h * .48 - 16); x.lineTo(w * .52 + 16, h * .48 + 16); x.moveTo(w * .52 + 16, h * .48 - 16); x.lineTo(w * .52 - 16, h * .48 + 16); x.stroke();
        const cx = w * .85, cy = h * .2; x.fillStyle = 'rgba(90,60,35,.9)'; for (let i = 0; i < 4; i++) { const a = i * PI / 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a - .25) * 18, cy + Math.sin(a - .25) * 18); x.lineTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60); x.lineTo(cx + Math.cos(a + .25) * 18, cy + Math.sin(a + .25) * 18); x.fill(); } x.font = '700 28px Georgia, serif'; x.textAlign = 'center'; x.fillText('N', cx, cy - 70);
        x.strokeStyle = 'rgba(90,60,35,.7)'; x.lineWidth = 6; x.strokeRect(14, 14, w - 28, h - 28);
      });
      const sheet = cloth(1.42, .95, .004, 20, 14, (u, v) => .025 * (Math.pow(Math.max(0, u - .9) / .1, 2) + Math.pow(Math.max(0, .08 - u) / .08, 2)));
      add(root, sheet, mapMat('#ffffff', map, { rough: .85 }), [0, .826, 0], [-PI / 2, 0, 0]);
      for (const [x, z] of [[-.66, -.4], [.64, .42]]) add(root, blob({ seed: x > 0 ? 3 : 5, amp: .2, detail: 2, flat: -.3 }), M('#7d7a76', { rough: 1 }), [x, .84, z], null, .05);
      const dv = grp(); dv.position.set(.35, .835, .3); dv.rotation.y = .6; root.add(dv); for (const s2 of [-1, 1]) rod(dv, [0, .005, 0], [s2 * .06, .005, .26], .006, M('#d9a23c', { rough: .35, metal: .35 }), { seg: 6 }); add(dv, sphere(.015, 8, 6), M('#d9a23c'));
      root.userData.top = .83; root.userData.screen = map;
      return ink(root, 1.8);
    } },
});

// =====================================================================================================================
// EXTREME PLACES
// =====================================================================================================================
/** a polar height field (mountains): h(r, a) in metres for r in 0..R; the rim sinks just under y = 0 */
function heightDisc(R, h, nr = 56, na = 96) {
  const pos = [], idx = [];
  pos.push(0, h(0, 0), 0);
  for (let i = 1; i <= nr; i++) for (let j = 0; j < na; j++) { const r = R * Math.pow(i / nr, 1.15), a = j / na * TAU; pos.push(Math.cos(a) * r, i === nr ? -.15 : h(r, a), Math.sin(a) * r); }
  const at = (i, j) => 1 + (i - 1) * na + (j % na);
  for (let j = 0; j < na; j++) idx.push(0, at(1, j + 1), at(1, j));
  for (let i = 1; i < nr; i++) for (let j = 0; j < na; j++) { const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j), d = at(i + 1, j + 1); idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const EXTREME = {
  volcano: { tags: ['extreme', 'nature'], desc: 'a volcano with a glowing lava crater, lava streaks down its rocky sides and ash near the rim (h default 30 m; lava: false for a dormant one). userData.lavaAt (crater, for smoke / eruption fx), light',
    make(o) {
      const H = o.h ?? 30, R = H * 1.45, s = o.seed ?? 1, root = grp('volcano');
      const prof = [[0, -.3], [R * 1.03, -.3], [R, 0], [R * .78, H * .12], [R * .52, H * .38], [R * .32, H * .72], [R * .2, H * .96], [R * .17, H], [R * .135, H * .95], [R * .09, H * .84], [0, H * .82]];
      const g0 = slathe(prof, 120, 4); g0.deleteAttribute('uv'); g0.deleteAttribute('normal'); const g = mergeVertices(g0), P = g.attributes.position;
      const gully = (x, y, z) => Math.sin(Math.atan2(z, x) * 13 + f3(x / H, y / H, z / H, s + 2) * 4);
      const vk = (x, y, z) => { const r = Math.hypot(x, z); return 1 + .07 * f3(x / H * 3, y / H * 3, z / H * 3, s) + .075 * gully(x, y, z) * Math.min(1, y / H * 1.6) * (r > R * .16 ? 1 : 0); };
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y < .01) continue; const k = vk(x, y, z); P.setX(i, x * k); P.setZ(i, z * k); }
      g.computeVertexNormals();
      const streaks = o.lava === false ? [] : [.4, 1.9, 3.3, 4.6].map(a => a + s);
      paint(g, (x, y, z) => { const r = Math.hypot(x, z); if (r < R * .14 && y > H * .7) return '#3a2a26'; const ash = clamp((y / H - .62) / .3); let c = cmix(cmix('#7a625a', '#4d3d3a', clamp(y / H * 1.4)), '#9a8e88', ash * .8); const gl = gully(x, y, z); if (gl < -.35 && y > H * .08) c = cmix(c, '#2e2422', .55); else if (gl > .6) c = cmix(c, '#a08a80', .25); if (f3(x / H * 6, y / H * 6, z / H * 6, s + 5) > .32) c = cmix(c, '#3d302d', .45); return c; });
      add(root, g, vcMat({ rough: .95 }));
      let light = null, pool = null;
      if (o.lava !== false) {
        const lm = glow('#ff6a1a', 2.6).clone();
        pool = add(root, rcyl(R * .115, R * .115, H * .02, H * .01, 40), lm, [0, H * .83, 0]); pool.userData.noOutline = true;
        const sm = glow('#ff7a22', 2.2);
        const side = prof.slice(2, 8);
        for (const a of streaks) { const pts = []; for (let i = 0; i <= 28; i++) { const u = i / 28, y = lerp(H * .975, H * (.28 + .1 * Math.sin(a * 3)), u), r = profR(side, y), aa = a + .06 * Math.sin(u * 9 + a), x = Math.cos(aa) * r, z = Math.sin(aa) * r, k = vk(x, y, z) + H * .004 / Math.max(r, 1); pts.push([x * k, y, z * k]); } const t = tube(root, pts, H * .01, sm, { caps: false, n: 120 }); t.userData.noOutline = true; noShadow(t); }
        light = new THREE.PointLight('#ff7a2a', 30 * (H / 30) ** 2, H * 1.2, 1.4); light.position.set(0, H * 1.05, 0); root.add(light);
        root.userData.update = t => { lm.emissiveIntensity = 2.4 + .5 * Math.sin(t * 1.7) + .3 * noise1(t * 3, 4); };
      }
      Object.assign(root.userData, { lavaAt: [0, H * .85, 0], light });
      return ink(root, H * .6);
    } },
  iceberg: { tags: ['extreme', 'ocean', 'nature'], desc: 'a faceted iceberg floating with the waterline at y = 0 and its big blue underwater part below (size: width, default 10 m; under: false to drop the hidden part; seed)',
    make(o) {
      const S = o.size ?? 10, s = o.seed ?? 3, root = grp('iceberg');
      const fm = (() => { const m = vcMat({ rough: .3 }).clone(); m.flatShading = true; return m; })();
      const top = blob({ seed: s, amp: .3, freq: 1.3, detail: 2, box: .4, sx: .5, sy: .32, sz: .4 }); top.translate(0, .08, 0);
      const peak = blob({ seed: s + 5, amp: .3, freq: 1.6, detail: 2, box: .3, sx: .2, sy: .45, sz: .2 }); peak.translate(.12, .3, -.05);
      for (const g of [top, peak]) paint(g, (x, y, z, nx, ny) => ny > .45 ? '#f6fcff' : ny > -.1 ? '#cdeef9' : '#9fd8ee');
      add(root, top, fm, null, null, S); add(root, peak, fm, null, null, S);
      if (o.under !== false) { const u = blob({ seed: s + 9, amp: .25, freq: 1.2, detail: 2, box: .3, sx: .7, sy: .65, sz: .55 }); u.translate(0, -.55, 0); paint(u, (x, y) => cmix('#7fc8e6', '#2f7fb0', clamp(-y * 1.2))); const um = vcMat({ rough: .3 }).clone(); um.flatShading = true; add(root, u, um, null, null, S); }
      return ink(root, S * .5);
    } },
  'ice-block': { tags: ['extreme', 'nature'], desc: 'a glossy cube of ice with frosty cracks (size, default 1 m). inside: an Object3D to freeze inside it - the block then turns see-through',
    make(o) {
      const k = o.size ?? 1, root = grp('ice-block');
      const t = tex('frost', 256, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#e8f8ff'); g.addColorStop(1, '#a9dcf0'); x.fillStyle = g; x.fillRect(0, 0, w, h); const R = rnd(4); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 2; for (let i = 0; i < 9; i++) { let px = R() * w, py = R() * h; x.beginPath(); x.moveTo(px, py); for (let k2 = 0; k2 < 5; k2++) { px += (R() - .5) * 70; py += (R() - .5) * 70; x.lineTo(px, py); } x.stroke(); } x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.moveTo(w * .1, h * .3); x.lineTo(w * .3, h * .1); x.lineTo(w * .38, h * .1); x.lineTo(w * .1, h * .38); x.fill(); });
      if (o.inside?.isObject3D) {
        const b = add(root, rbox(k, k, k, .08 * k), (() => { const m = toonMat('#ffffff', { map: t, transparent: true, opacity: .5, rough: .1 }); m.depthWrite = false; return m; })(), [0, k / 2, 0]); noShadow(b);
        const box = new THREE.Box3().setFromObject(o.inside), sz = box.getSize(V3()), sc = .8 * k / Math.max(sz.x, sz.y, sz.z, 1e-3); o.inside.scale.multiplyScalar(sc); o.inside.position.set(0, k * .1 - box.min.y * sc, 0); root.add(o.inside);
      } else add(root, rbox(k, k, k, .08 * k), mapMat('#ffffff', t, { rough: .12 }), [0, k / 2, 0]);
      return ink(root, k);
    } },
  'snowy-peak': { tags: ['extreme', 'nature'], desc: 'a big snow-capped mountain with ridges, grey-blue rock and a jagged snow line (h default 40 m; r base radius; seed). A backdrop piece: solid false',
    make(o) {
      const H = o.h ?? 40, R = o.r ?? H * 1.4, s = o.seed ?? 2, root = grp('snowy-peak');
      const h = (r, a) => { const t = r / R, x = Math.cos(a) * r / H, z = Math.sin(a) * r / H, ridge = 1 - Math.abs(f3(x * 2.2, z * 2.2, s, s)); return H * Math.pow(1 - t, 1.35) * (.82 + .3 * ridge) + H * .18 * Math.pow(Math.max(0, 1 - Math.hypot(Math.cos(a) * r - R * .35, Math.sin(a) * r + R * .1) / (R * .35)), 1.5); };
      const g = heightDisc(R, h, 64, 120);
      paint(g, (x, y, z, nx, ny) => { const n = f3(x / H * 4, z / H * 4, s + 3, s); return y > H * (.52 + .12 * n) - (ny > .75 ? H * .1 : 0) ? '#f5f9ff' : cmix('#7d8597', '#5d6577', clamp(.5 + n)); });
      add(root, g, vcMat({ rough: .9 }));
      root.userData.solid = false;
      return ink(root, H * .6);
    } },
  'cave-mouth': { tags: ['extreme', 'nature'], desc: 'a rocky cliff with a dark cave opening that fades to black inside, boulders at its foot; the opening faces +z (w: width, default 8 m; seed)',
    make(o) {
      const W = o.w ?? 8, Hh = W * .8, D = W * .6, s = o.seed ?? 4, root = grp('cave-mouth');
      const outer = blobShape([[-W / 2, -1], [-W * .55, Hh * .35], [-W * .42, Hh * .78], [-W * .12, Hh], [W * .22, Hh * .93], [W * .46, Hh * .66], [W * .54, Hh * .28], [W / 2, -1]], 60);
      const ow = W * .42, oh = Hh * .58, hole = new THREE.Path(); hole.moveTo(-ow / 2, -.3); hole.lineTo(ow / 2, -.3); hole.lineTo(ow / 2 * .95, oh * .55); hole.quadraticCurveTo(ow * .4, oh, 0, oh); hole.quadraticCurveTo(-ow * .45, oh, -ow / 2 * .98, oh * .5); hole.lineTo(-ow / 2, -.3); outer.holes.push(hole);
      const g0 = new THREE.ExtrudeGeometry(outer, { depth: D, bevelEnabled: true, bevelThickness: .4, bevelSize: .35, bevelSegments: 3, curveSegments: 24, steps: 8 }); g0.translate(0, 0, -D / 2);
      g0.deleteAttribute('uv'); g0.deleteAttribute('normal'); const g = mergeVertices(g0, 1e-3), P = g.attributes.position;
      const inHole = (x, y) => Math.abs(x) < ow * .55 && y < oh * 1.05;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y < .06) continue; const n = f3(x * .35, y * .35, z * .35, s), d = .45 * W / 8; P.setXYZ(i, x + n * d, y + f3(x * .35 + 9, y * .35, z * .35, s) * d * .6, z + f3(x * .35, y * .35 + 4, z * .35, s) * d * .8); }
      g.computeVertexNormals();
      paint(g, (x, y, z) => { const base = cmix('#8a7d70', '#6a5e54', .5 + f3(x * .5, y * .5, z * .5, s + 2)); if (inHole(x, y) && z < D / 2 + .3) return cmix(base, '#120d0b', clamp((D / 2 + .4 - z) / (D * .55))); return base; });
      add(root, g, vcMat({ rough: .95 }));
      const back = add(root, rbox(ow * 1.1, oh * 1.05, .2, .05), M('#0b0807', { rough: 1 }), [0, oh / 2, -D / 2 - .1]); back.userData.noOutline = true;
      const fl = new THREE.PlaneGeometry(ow * 1.05, D + .8, 1, 8); fl.rotateX(-PI / 2); paint(fl, (x, y, z) => cmix('#0b0807', '#4f453c', clamp((z + D / 2) / (D + .8) * 1.3 - .2)));
      const fm = add(root, fl, vcMat({ rough: 1 }), [0, .015, .4]); fm.userData.noOutline = true; fm.userData.ground = true;
      const R = rnd(s); for (let i = 0; i < 4; i++) { const sx = i % 2 ? 1 : -1, sc = .6 + R() * .7; add(root, blob({ seed: s + i, amp: .3, detail: 3, flat: -.3, box: .3, sy: .7 }), M(i % 2 ? '#7d7066' : '#8f8277', { rough: 1 }), [sx * (ow * .55 + .5 + R() * 1.5), sc * .25, D / 2 + .6 + R()], [0, R() * TAU, 0], sc); }
      return ink(root, W * .6);
    } },
  stalagmites: { tags: ['extreme', 'nature'], desc: 'a cluster of drippy cave stalagmites (hang: true for stalactites hanging down from y = 0, put them at the ceiling; n; h tallest, default 2.2 m; seed)',
    make(o) {
      const R = rnd(o.seed ?? 5), n = o.n ?? 5, Hm = o.h ?? 2.2, root = grp('stalagmites'), vm = vcMat({ rough: .7 });
      for (let i = 0; i < n; i++) {
        const h = Hm * (i ? .3 + R() * .55 : 1), r = h * (.16 + R() * .06), a = R() * TAU, d = i ? .3 + R() * .7 : 0;
        const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12, y = t * h, rr = r * Math.pow(1 - t, .8) * (1 + .1 * Math.sin(t * 22 + i)); pts.push([k === 12 ? 0 : Math.max(rr, r * .06), y]); }
        pts.unshift([0, 0]); const g = slathe(pts, 24, 3);
        paint(g, (x, y) => cmix('#a8916f', '#efe4cc', y / h));
        const m = add(root, g, vm, [Math.cos(a) * d, 0, Math.sin(a) * d], [(R() - .5) * .1, 0, (R() - .5) * .1]);
        if (o.hang) { m.rotation.x += PI; }
      }
      return ink(root, Hm);
    } },
  bones: { tags: ['extreme', 'history'], desc: 'old bones scattered on the ground: two long bones, a few ribs and small bones (~1 m spread; seed). solid false',
    make(o) {
      const root = grp('bones'), R = rnd(o.seed ?? 6), bm = M(o.color ?? '#efe6cf', { rough: .75 });
      const long = (x, z, a, L) => { const g = grp(); g.position.set(x, .04, z); g.rotation.y = a; root.add(g); rod(g, [-L / 2, 0, 0], [L / 2, 0, 0], .028, bm, { seg: 12 }); for (const s of [-1, 1]) for (const d of [-1, 1]) add(g, sphere(.042, 12, 10), bm, [s * L / 2, .005, d * .03]); };
      long(-.15, .1, .4, .48); long(.25, -.15, -.9, .38);
      for (let i = 0; i < 4; i++) { const rib = add(root, new THREE.TorusGeometry(.17, .014, 8, 20, PI * .8), bm, [.05 + i * .07, .03, .25], [PI / 2, 0, -.3 + i * .05]); void rib; }
      for (let i = 0; i < 5; i++) add(root, new THREE.CapsuleGeometry(.018, .08, 4, 10), bm, [(R() - .5) * .9, .02, (R() - .5) * .7], [PI / 2, 0, R() * PI]);
      root.userData.solid = false;
      return ink(root, .8);
    } },
  skull: { tags: ['extreme', 'history'], desc: 'a cartoon human skull with dark eye sockets and teeth, facing +z, sitting on y = 0 (size: scale; jaw: false)',
    make(o) {
      const k = o.size ?? 1, root = grp('skull'), g = grp(); g.scale.setScalar(k); root.add(g);
      const bm = M(o.color ?? '#efe6cf', { rough: .7 }), dark = M('#1b1512', { rough: 1 });
      add(g, sphere(.11, 32, 24), bm, [0, .14, -.01], null, [1, .95, 1.08]);
      add(g, rbox(.14, .08, .1, .035), bm, [0, .07, .045]);
      for (const s of [-1, 1]) { add(g, sphere(.035, 16, 12), bm, [s * .055, .085, .07]); const e = add(g, sphere(.034, 16, 12), dark, [s * .043, .125, .095], null, [1, 1.1, .55]); e.userData.noOutline = true; }
      const nose = add(g, ext(shapeOf([[-.014, 0], [.014, 0], [0, .03]]), .01, .003), dark, [0, .078, .108]); nose.userData.noOutline = true; nose.rotation.x = -.2;
      for (let i = 0; i < 6; i++) { const t = add(g, rbox(.014, .02, .012, .004), M('#fbf6e6', { rough: .5 }), [(i - 2.5) * .016, .045, .097]); t.userData.noOutline = true; }
      if (o.jaw !== false) add(g, rbox(.12, .03, .08, .012), bm, [0, .017, .04]);
      root.userData.solid = false;
      return ink(root, .25 * k);
    } },
  'rope-bridge': { tags: ['extreme'], desc: 'a sagging wooden rope bridge across a gap, spanning x from -len/2 to len/2 with log posts at both ends on y = 0 (len default 10; sag; broken: true for missing planks; sway: amplitude, default 0). userData.deckAt(u) -> [x, y, z] on the deck (u 0..1)',
    make(o) {
      const L = o.len ?? 10, W = 1.2, sag = o.sag ?? L * .08, R = rnd(o.seed ?? 3), root = grp('rope-bridge'), span = grp('span'); root.add(span);
      const ropeM = M('#c9a56a', { rough: .9 }), woodM = M('#8a5a34', { rough: .85 }), logM = M('#6e4325', { rough: .85 });
      const dy = u => .25 - sag * 4 * u * (1 - u), X = u => (u - .5) * L;
      for (const sx of [-1, 1]) for (const z of [-W / 2 - .05, W / 2 + .05]) { add(root, lathe([[0, -.2], [.11, -.2], [.11, 1.3], [.06, 1.42], [0, 1.45]], 14), logM, [sx * (L / 2 + .15), 0, z]); }
      for (const z of [-W / 2, W / 2]) { tube(span, Array.from({ length: 13 }, (_, i) => { const u = i / 12; return [X(u), .25 + 1.05 - sag * .75 * 4 * u * (1 - u), z]; }), .03, ropeM, { n: 60 }); tube(span, Array.from({ length: 13 }, (_, i) => { const u = i / 12; return [X(u), dy(u) - .04, z * .9]; }), .025, ropeM, { n: 60 }); }
      const pl = grp(), n = Math.round(L / .27);
      for (let i = 0; i < n; i++) { if (o.broken && R() < .14) continue; const u = (i + .5) / n, sl = (dy(u + .01) - dy(u - .01)) / (.02 * L); const m = new THREE.Mesh(rbox(.22, .05, W * (.9 + R() * .08), .02), woodM); m.position.set(X(u), dy(u), (R() - .5) * .04); m.rotation.set(0, (R() - .5) * .06, Math.atan(sl)); pl.add(m); }
      span.add(bake(pl));
      for (let i = 1; i < 12; i++) { const u = i / 12; for (const z of [-W / 2, W / 2]) { const l = rod(span, [X(u), dy(u), z * .92], [X(u), .25 + 1.05 - sag * .75 * 4 * u * (1 - u), z], .012, ropeM, { flat: true, seg: 5 }); l.userData.noOutline = true; } }
      const sw = o.sway ?? 0; if (sw) root.userData.update = t => { span.rotation.x = .04 * sw * Math.sin(t * 1.3); };
      root.userData.deckAt = u => [X(u), dy(u) + .03, 0];
      root.userData.solid = false;
      return ink(root, L * .4);
    } },
  'mine-cart': { tags: ['extreme', 'vehicle'], desc: 'a rusty mine cart full of ore (load: "ore" | "gold" | "empty") on a short piece of track along z (rails: false for just the cart on the ground; on mine-rails use y: .16). userData.wheels',
    make(o) {
      const root = grp('mine-cart'), withRails = o.rails !== false, y0 = withRails ? .16 : 0;
      if (withRails) root.add(railsGroup(2.4));
      const c = o.color ?? '#b5532f', bodyM = M(c, { rough: .6, metal: .2 }), band = M('#4a4e57', { rough: .5, metal: .3 });
      const bg = rbox(.9, .5, 1.2, .07).clone(); { const P = bg.attributes.position; for (let i = 0; i < P.count; i++) { const k = 1 + .14 * (P.getY(i) / .5 + .5); P.setX(i, P.getX(i) * k); P.setZ(i, P.getZ(i) * k); } }
      bg.userData.shared = false; add(root, bg, bodyM, [0, y0 + .52, 0]);
      add(root, rbox(1.06, .07, 1.38, .03), band, [0, y0 + .76, 0]); add(root, rbox(.96, .06, 1.26, .03), band, [0, y0 + .4, 0]);
      for (const z of [-.3, .3]) add(root, rbox(1.0, .5, .05, .02), band, [0, y0 + .56, z * 1.05]);
      const wheels = [];
      for (const sx of [-1, 1]) for (const z of [-.38, .38]) { const w = grp(); w.position.set(sx * .32, y0 + .14, z); root.add(w); add(w, rcyl(.14, .14, .07, .025, 20), M('#2f3238', { rough: .5, metal: .3 }), [-.035 * sx, 0, 0], [0, 0, -sx * PI / 2]); add(w, rcyl(.17, .17, .015, .005, 20), M('#2f3238'), [sx * .03, 0, 0], [0, 0, -sx * PI / 2]); wheels.push(w); }
      add(root, rbox(.7, .1, 1.0, .03), band, [0, y0 + .26, 0]);
      const load = o.load ?? 'ore';
      if (load !== 'empty') { const R = rnd(4); for (let i = 0; i < 9; i++) add(root, blob({ seed: i + 2, amp: .3, detail: 2, box: .3 }), load === 'gold' || (i % 4 === 0 && load === 'ore') ? M('#f2c14e', { rough: .3, metal: .35 }) : M('#4f4a47', { rough: .9 }), [(R() - .5) * .6, y0 + .78 + R() * .1, (R() - .5) * .9], [R(), R(), R()], .12 + R() * .06); }
      root.userData.wheels = wheels;
      return ink(root, 1.4);
    } },
  'mine-rails': { tags: ['extreme'], desc: 'a straight mine-railway track along z: two steel rails on wooden sleepers (len default 6; the rail top is at y = .16). solid false',
    make(o) { const root = grp('mine-rails'); root.add(railsGroup(o.len ?? 6)); root.userData.solid = false; return ink(root, 1.5); } },
  'warning-sign': { tags: ['extreme', 'sign'], desc: 'a warning sign on posts (kind: "board" red DANGER header with a line below, "triangle" yellow with !; text, sub: the words; color). userData.screen: the sign texture (redraw it)',
    make(o) {
      const root = grp('warning-sign'), post = M('#7a4e2c', { rough: .85 });
      if (o.kind === 'triangle') {
        const tri = new THREE.Shape(), rr = .07; tri.moveTo(-.5 + rr, -.42); tri.lineTo(.5 - rr, -.42); tri.quadraticCurveTo(.5, -.42, .46, -.36); tri.lineTo(.04, .4); tri.quadraticCurveTo(0, .46, -.04, .4); tri.lineTo(-.46, -.36); tri.quadraticCurveTo(-.5, -.42, -.5 + rr, -.42);
        const t = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#26262b'; x.fillRect(0, 0, w, h); x.fillStyle = o.color ?? '#f6c945'; x.beginPath(); x.moveTo(w * .5, h * .14); x.lineTo(w * .9, h * .84); x.lineTo(w * .1, h * .84); x.closePath(); x.fill(); x.fillStyle = '#26262b'; x.font = `800 ${h * .42}px Inter, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.text ?? '!', w / 2, h * .6); });
        t.repeat.set(1, 1 / .88); t.offset.set(.5, .42 / .88);
        add(root, ext(tri, .04, .015), mapMat('#ffffff', t, { rough: .5 }), [0, 1.75, .05]);
        add(root, rcyl(.04, .04, 1.75, .02, 12), M('#9aa3ad', { rough: .4, metal: .4 }), [0, -.05, 0]);
        root.userData.screen = t;
      } else {
        const t = canvasTex(512, 352, (x, w, h) => { x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, w, h); x.fillStyle = o.color ?? '#d2232a'; x.beginPath(); x.roundRect(16, 16, w - 32, h * .42, 18); x.fill(); x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; let fs = h * .3; x.font = `800 ${fs}px Inter, Arial`; const T = o.text ?? 'DANGER'; while (x.measureText(T).width > w * .82) { fs *= .92; x.font = `800 ${fs}px Inter, Arial`; } x.fillText(T, w / 2, 16 + h * .21); x.fillStyle = '#1d1d24'; fs = h * .2; x.font = `800 ${fs}px Inter, Arial`; const S2 = o.sub ?? 'KEEP OUT'; while (x.measureText(S2).width > w * .86) { fs *= .92; x.font = `800 ${fs}px Inter, Arial`; } x.fillText(S2, w / 2, h * .72); x.strokeStyle = '#1d1d24'; x.lineWidth = 8; x.strokeRect(6, 6, w - 12, h - 12); });
        t.repeat.set(1 / 1.0, 1 / .69); t.offset.set(.5, .5);
        add(root, ext(rrect(1.0, .69, .06), .045, .015), mapMat('#ffffff', t, { rough: .55 }), [0, 1.5, .06]);
        for (const x of [-.36, .36]) add(root, lathe([[0, -.25], [.045, -.25], [.045, 1.75], [.02, 1.82], [0, 1.83]], 12), post, [x, 0, 0]);
        root.userData.screen = t;
      }
      return ink(root, 1.6);
    } },
};
function railsGroup(len) {
  const g = grp('rails'), steel = M('#8f97a1', { rough: .35, metal: .45 }), woodM = M('#6e4a2e', { rough: .9 }), sl = grp();
  for (let i = 0; i < Math.round(len / .55); i++) { const m = new THREE.Mesh(rbox(1.0, .08, .16, .02), woodM); m.position.set(0, .04, -len / 2 + (i + .5) * len / Math.round(len / .55)); sl.add(m); }
  g.add(bake(sl));
  for (const x of [-.32, .32]) { add(g, rbox(.07, .08, len, .015), steel, [x, .12, 0]); add(g, rbox(.12, .02, len, .008), steel, [x, .085, 0]); }
  return g;
}

export const REG = { ...SPACE, ...OCEAN, ...HISTORY, ...EXTREME };

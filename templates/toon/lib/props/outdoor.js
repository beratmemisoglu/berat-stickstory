// Outdoor props for the toon engine: nature (trees with lush clustered foliage, bushes, rocks, grass, flowers, ...), beach,
// camp, street furniture, building facades, vehicles and sky pieces. Every design is original and made in code: rounded
// chunky shapes, toonMat surfaces in 2-3 tones, ink outlines (~0.6-1 % of the prop, thinner on thin parts), standing on
// y = 0 and facing +z, sizes in metres next to a 1.67 m character. Invented names only on signs.
// Options (o): seed (variation), color, size (scale of nature pieces), text (signs), lit (night lamps / windows) + the
// per-prop ones in each `desc`. userData beyond the kit's own (top / seat / grip / solid / screen / light):
//   setLit(on)    lamps, lanterns, lit windows, vehicle lights: switch the glow (and the light) on or off
//   fireAt        campfire / lantern: local [x, y, z] where lib/fx.js puts the flame
//   door          gate: the hinge group (rotate .y to open)        rotor / prop: helicopter rotor, plane propeller
//   setState(s)   traffic light: 'red' | 'yellow' | 'green'         waterline: boats, height of the water line
//   footprint     { r } (round) or { w, d } (box): the part a character cannot stand inside, for props whose bounding
//                 box is much bigger than their body (trees, umbrellas, lamps: you can stand under the canopy)
import { THREE, C, rnd, shade, canvasTex } from '../core.js';
import { toonMat } from '../rig.js';
import { addOutline } from '../geo.js';
import { mergeGeometries, mergeVertices } from '../../vendor/jsm/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2, PI = Math.PI;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const OL = C.outline;
const pick = (R, a) => a[Math.floor(R() * a.length) % a.length];
const range = (R, a, b) => a + R() * (b - a);
const clamp01 = x => Math.max(0, Math.min(1, x));
const sm = k => { k = clamp01(k); return k * k * (3 - 2 * k); };

// ---------------------------------------------------------------- materials
const M = (c, o) => toonMat(c, o);
/** a material of its own (lamps that switch, signs that glow): never shared with other props */
const own = (c, o = {}) => toonMat(c, o).clone();
const VCM = new Map();
/** the toon surface with vertex colours (foliage, stone, painted gradients) */
function vcMat(o = {}) {
  const k = JSON.stringify(o);
  if (!VCM.has(k)) { const m = toonMat('#ffffff', { ...o, _vc: 1 }); m.vertexColors = true; m.needsUpdate = true; VCM.set(k, m); }
  return VCM.get(k);
}
const glass = () => M('#34496b', { rough: .16, metal: .15 });
/** a material showing a canvas texture (labels, facades); glow > 0 also lights it (emissive map) */
function texMat(tex, o = {}) {
  const m = toonMat('#ffffff', { map: tex, rough: o.rough ?? .7 });
  if (o.emi || o.glow) { m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = o.emi || tex; m.emissiveIntensity = o.glow ?? 1.4; }
  return m;
}
const COL = new Map();
const col = h => { if (!COL.has(h)) COL.set(h, new THREE.Color(h)); return COL.get(h); };
const mixC = (a, b, k) => col(a).clone().lerp(col(b), clamp01(k));

// ---------------------------------------------------------------- meshes + outlines
function mk(geo, mat, at = [0, 0, 0], rot = null, parent = null, ud = null) {
  const m = new THREE.Mesh(geo, mat); m.position.set(at[0] || 0, at[1] || 0, at[2] || 0);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  if (ud) Object.assign(m.userData, ud);
  if (parent) parent.add(m);
  return m;
}
/** ink outline on every mesh under root: w metres (a mesh's userData.olw overrides), px minimum pixels */
function ink(root, w, px = 1.2) {
  const list = []; root.traverse(o => { if (o.isMesh && !o.userData.isOutline && !o.userData.noOutline) list.push(o); });
  for (const m of list) { const mt = Array.isArray(m.material) ? m.material[0] : m.material; if (mt?.transparent && (mt.opacity ?? 1) < .99) continue; addOutline(m, OL, m.userData.olw ?? w, px); }
  return root;
}
const thin = (m, w) => { m.userData.olw = w; return m; };
const noInk = m => { m.userData.noOutline = true; return m; };
// glass casts no shadow: place() switches castShadow on for every mesh, so the shadow pass gets a depth material that
// discards every fragment instead
let NOSHADOW = null;
const noShadow = m => { m.customDepthMaterial = NOSHADOW ??= new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, transparent: true, opacity: 0, alphaTest: .5 }); return m; };

// ---------------------------------------------------------------- geometry
/** a rounded box (bevel radius r, s segments per bevel) centred on the origin; keeps BoxGeometry's face groups + uvs */
function rbox(w, h, d, r = .04, s = 3) {
  r = Math.max(.001, Math.min(r, w / 2 * .999, h / 2 * .999, d / 2 * .999));
  const n = s * 2 + 1, g = new THREE.BoxGeometry(1, 1, 1, n, n, n), P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array, hs = .5 / n;
  const bx = w / 2 - r, by = h / 2 - r, bz = d / 2 - r, v = V3();
  for (let i = 0, j = 0; i < P.length; i += 3, j += 2) {
    const x = P[i], y = P[i + 1], z = P[i + 2], sx = Math.sign(x), sy = Math.sign(y), sz = Math.sign(z), fx = N[i], fy = N[i + 1], fz = N[i + 2];
    v.set(x - sx * hs, y - sy * hs, z - sz * hs).normalize();
    const X = bx * sx + v.x * r, Y = by * sy + v.y * r, Z = bz * sz + v.z * r;
    P[i] = X; P[i + 1] = Y; P[i + 2] = Z; N[i] = v.x; N[i + 1] = v.y; N[i + 2] = v.z;
    // uvs from the final position (BoxGeometry's face conventions), so a texture spans the face evenly
    const ux = (X + w / 2) / w, uy = (Y + h / 2) / h, uz = (Z + d / 2) / d;
    if (fx > .5) { U[j] = 1 - uz; U[j + 1] = uy; } else if (fx < -.5) { U[j] = uz; U[j + 1] = uy; }
    else if (fy > .5) { U[j] = ux; U[j + 1] = 1 - uz; } else if (fy < -.5) { U[j] = ux; U[j + 1] = uz; }
    else if (fz > .5) { U[j] = ux; U[j + 1] = uy; } else { U[j] = 1 - ux; U[j + 1] = uy; }
  }
  g.attributes.position.needsUpdate = true; g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
/** rounded box standing on y = 0 */
const rboxUp = (w, h, d, r, s) => rbox(w, h, d, r, s).translate(0, h / 2, 0);
/** a lathe from [radius, y] pairs, bottom to top (outward normals); o.smooth spline-smooths the profile */
function lath(prof, seg = 32, o = {}) {
  let pts = prof.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  if (o.smooth && pts.length > 2) pts = new THREE.SplineCurve(pts).getPoints((pts.length - 1) * o.smooth);
  return new THREE.LatheGeometry(pts, seg, o.phi0 ?? 0, o.phiLen ?? TAU);
}
/** a tube swept along points: prof = radius | [width, thickness] | u => either (u 0..1 along). Width lies along
 *  (tangent x up), so a flat blade swept with up = [0,1,0] lies flat. o: seg, rad, closed, caps, up */
function sweep(pts, prof = .05, o = {}) {
  const seg = o.seg ?? 16, rad = o.rad ?? 10, closed = !!o.closed;
  const P = pts.map(p => Array.isArray(p) ? V3(p[0], p[1], p[2]) : p.clone());
  const curve = P.length === 2 && !closed ? new THREE.LineCurve3(P[0], P[1]) : new THREE.CatmullRomCurve3(P, closed, 'centripetal', .5);
  const pos = [], nor = [], uv = [], idx = [], T = V3(), N = V3(), B = V3(), p = V3(), q = V3(), up = o.up ? V3(...o.up) : V3(0, 1, 0), ends = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg; curve.getPointAt(u, p); curve.getTangentAt(u, T).normalize();
    if (i === 0) { N.copy(up).addScaledVector(T, -T.dot(up)); if (N.lengthSq() < 1e-6) N.set(1, 0, 0).addScaledVector(T, -T.x); N.normalize(); }
    else N.addScaledVector(T, -T.dot(N)).normalize();
    B.crossVectors(T, N);
    const r = typeof prof === 'function' ? prof(u) : prof, rw = Math.max(1e-4, Array.isArray(r) ? r[0] : r), rt = Math.max(1e-4, Array.isArray(r) ? r[1] : r);
    for (let j = 0; j <= rad; j++) {
      const a = j / rad * TAU, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(p.x + N.x * ca * rt + B.x * sa * rw, p.y + N.y * ca * rt + B.y * sa * rw, p.z + N.z * ca * rt + B.z * sa * rw);
      q.copy(N).multiplyScalar(ca / rt).addScaledVector(B, sa / rw).normalize();
      nor.push(q.x, q.y, q.z); uv.push(j / rad, u);
    }
    if (i === 0 || i === seg) ends.push({ p: p.clone(), t: T.clone() });
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  if (!closed && o.caps !== false) {
    const c0 = pos.length / 3, e = seg * (rad + 1);
    pos.push(ends[0].p.x, ends[0].p.y, ends[0].p.z, ends[1].p.x, ends[1].p.y, ends[1].p.z);
    nor.push(-ends[0].t.x, -ends[0].t.y, -ends[0].t.z, ends[1].t.x, ends[1].t.y, ends[1].t.z); uv.push(.5, 0, .5, 1);
    for (let j = 0; j < rad; j++) { idx.push(c0, j + 1, j); idx.push(c0 + 1, e + j, e + j + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
/** radius that rounds the end of a sweep: r * roundEnd(u) closes the last ~k of the length like a half sphere */
const roundEnd = (u, k = .12) => u < 1 - k ? 1 : Math.sqrt(Math.max(0, 1 - ((u - (1 - k)) / k) ** 2)) * .92 + .08;
const roundBoth = (u, k = .12) => Math.min(roundEnd(u, k), roundEnd(1 - u, k));
function addUV(g) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }
/** vertex colours from fn(position, normal, i, uv) -> THREE.Color | hex */
function paint(g, fn) {
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, n = P.count, a = new Float32Array(n * 3), p = V3(), q = V3(), c = new THREE.Color(), t = new THREE.Vector2();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i); q.fromBufferAttribute(N, i); if (U) t.fromBufferAttribute(U, i);
    const r = fn(p, q, i, t); if (r?.isColor) c.copy(r); else c.set(r);
    a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const tint = (g, hexc) => paint(g, () => col(hexc));
const KEEP = new Set(['position', 'normal', 'uv', 'color']);
function prep(g) {
  if (!g.index) { const n = g.attributes.position.count, ix = []; for (let i = 0; i < n; i++) ix.push(i); g.setIndex(ix); }
  for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  addUV(g); if (!g.attributes.color) tint(g, '#ffffff');
  g.clearGroups(); return g;
}
/** merge geometries into one (all get position / normal / uv / color) */
const merge = list => mergeGeometries(list.filter(Boolean).map(prep), false);
/** smooth lumpy displacement: a few random sine waves over space */
function noiseDirs(R, n = 6, f = 1.8, amp = .14) { return [...Array(n)].map(() => ({ d: V3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize(), f: f * (.6 + R() * .9), ph: R() * TAU, a: amp * (.5 + R() * .5) / Math.sqrt(n / 3) })); }
const lump = (D, x, y, z) => { let s = 0; for (const k of D) s += k.a * Math.sin((k.d.x * x + k.d.y * y + k.d.z * z) * k.f + k.ph); return s; };
/** a welded sphere (no seam) to displace */
function wsphere(ws = 22, hs = 14, r = 1) { let g = new THREE.SphereGeometry(r, ws, hs); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g); return g; }
/** a lumpy rounded rock: o.size [x, y, z] metres, o.amp lumpiness, o.flat where the bottom is cut flat (sits on y = 0) */
function blob(R, o = {}) {
  const g = wsphere(o.ws ?? 22, o.hs ?? 14), D = noiseDirs(R, 6, o.freq ?? 1.8, o.amp ?? .14), P = g.attributes.position, [sx, sy, sz] = o.size || [1, 1, 1], flat = o.flat ?? -.45;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i); const k = 1 + lump(D, x, y, z); x *= k; y *= k; z *= k;
    if (y < flat) y = flat + (y - flat) * .08;
    P.setXYZ(i, x * sx, (y - flat) / (1 - flat) * sy, z * sz);
  }
  g.computeVertexNormals(); return addUV(g);
}
/** bend a geometry: fn(y) -> [dx, dz] added per vertex (trunk lean) */
function bend(g, fn) { const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const [dx, dz] = fn(P.getY(i)); P.setX(i, P.getX(i) + dx); P.setZ(i, P.getZ(i) + dz); } g.computeBoundingSphere(); return g; }
/** an ExtrudeGeometry from 2D points (x, y), centred in depth, with a soft bevel */
function slab(pts2, depth = .05, bevel = .015, o = {}) {
  const sh = new THREE.Shape(pts2.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * (o.k ?? 1), bevelSegments: o.bs ?? 3, curveSegments: o.cs ?? 12 });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}
/** basis matrix placing a unit object: z axis along `dir`, y axis as close as possible to `upv`, scaled, at p */
function orient(p, dir, upv, s) {
  const z = dir.clone().normalize(), y = upv.clone().addScaledVector(z, -upv.dot(z)); if (y.lengthSq() < 1e-6) y.set(1, 0, 0).addScaledVector(z, -z.x); y.normalize();
  const x = y.clone().cross(z); const m = new THREE.Matrix4().makeBasis(x, y, z);
  if (Array.isArray(s)) m.scale(V3(s[0], s[1], s[2])); else m.scale(V3(s, s, s));
  return m.setPosition(p);
}

// ---------------------------------------------------------------- canvas textures (labels, patterns)
const FONT = (wgt, px) => `${wgt} ${Math.round(px)}px Inter, Arial, sans-serif`;
function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
function fitText(x, text, cx, cy, maxW, size, wgt = 800) {
  let s = size; x.font = FONT(wgt, s); while (x.measureText(text).width > maxW && s > 6) { s *= .92; x.font = FONT(wgt, s); }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, cx, cy + s * .04);
}
/** a sign face: text on a coloured board (always opaque) */
function label(text, o = {}) {
  const W = o.w ?? 512, H = o.h ?? 128;
  return canvasTex(W, H, (x) => {
    x.fillStyle = o.bg ?? '#1d2b4f'; x.fillRect(0, 0, W, H);
    if (o.border) { const b = o.bw ?? H * .07; x.strokeStyle = o.border; x.lineWidth = b; rr(x, b * 1.2, b * 1.2, W - b * 2.4, H - b * 2.4, o.radius ?? H * .08); x.stroke(); }
    if (o.draw) o.draw(x, W, H);
    x.fillStyle = o.fg ?? '#ffffff';
    if (text) fitText(x, String(text), W / 2, H / 2, W * (o.fit ?? .84), H * (o.size ?? .56), o.weight ?? 800);
  });
}
/** a flat text plane (no outline) facing +z */
function plate(tex, w, h, o = {}) { const m = mk(new THREE.PlaneGeometry(w, h), o.mat || texMat(tex, o)); m.userData.noOutline = true; return m; }
function stripeTex(colors, n = 8, o = {}) {
  return canvasTex(o.w ?? 256, o.h ?? 256, (x, W, H) => {
    for (let i = 0; i < n; i++) { x.fillStyle = colors[i % colors.length]; if (o.diag) { x.save(); x.translate(W / 2, H / 2); x.rotate(PI / 4); x.fillRect(-W, -H + i * (H * 2 / n), W * 2, H * 2 / n + 1); x.restore(); } else if (o.horiz) x.fillRect(0, i * H / n, W, H / n + 1); else x.fillRect(i * W / n, 0, W / n + 1, H); }
  });
}

// ================================================================ NATURE
const GREENS = {
  leaf: ['#2c7a33', '#4b9e3b', '#7cc44c', '#b9e06a'],
  bush: ['#296d35', '#3f9541', '#6dbd4a', '#acd862'],
  pine: ['#1d5a3c', '#2c7848', '#4d9d5a', '#8cc66c'],
  palm: ['#2d8a3d', '#4cad45', '#86d058', '#c4e670'],
  autumn: ['#a8432c', '#d9772c', '#f0b03c', '#ffd979'],
  blossom: ['#d4688f', '#ee90b4', '#ffc2d8', '#fff1f6'],
};
const palOf = (o, d) => (typeof o.leaves === 'string' && GREENS[o.leaves]) || o.pal || GREENS[d];

// leaf card: an almond leaf (round base, pointed tip) with a little thickness, base at the origin, tip at z = 1, face
// normal +y, tip drooping and edges curled up. 16 vertices: a tree carries a thousand of them.
let LEAF_G = null;
function leafGeo() {
  if (LEAF_G) return LEAF_G;
  const n = 14, pos = [], idx = [], w = u => .34 * 2.49 * Math.sqrt(u) * Math.pow(1 - u, .9), yb = (u, x) => -u * u * .16 + u * .05 + Math.abs(x) * .14;
  for (let k = 0; k < n; k++) { const t = k / n * TAU, u = (1 - Math.cos(t)) / 2, x = (Math.sin(t) >= 0 ? 1 : -1) * w(u); pos.push(x, yb(u, x), u); }
  pos.push(0, yb(.45, 0) + .045, .45, 0, yb(.45, 0) - .035, .45);
  for (let k = 0; k < n; k++) { const a = k, b = (k + 1) % n; idx.push(n, b, a, n + 1, a, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals(); addUV(g);
  return (LEAF_G = g);
}
/** Lush foliage: every cluster is a big puff with smaller puffs bulging out of its outer side, then leaf cards stick out
 *  of the visible surface (never inside another puff) so the silhouette is leafy. Two greens + a light + a highlight,
 *  darker low and inside (vertex colours). clusters: [{ p: Vector3, r }]. Returns { puffs, leaves, y0, y1, list }. */
function foliage(R, clusters, o = {}) {
  const pal = (o.pal || GREENS.leaf).map(h => col(h)), [dk, md, lt, hi] = pal, sub = o.sub ?? [4, 7];
  let y0 = Infinity, y1 = -Infinity; const ctr = V3();
  for (const c of clusters) { y0 = Math.min(y0, c.p.y - c.r); y1 = Math.max(y1, c.p.y + c.r); ctr.add(c.p); }
  ctr.divideScalar(clusters.length);
  const puffs = [];
  for (const c of clusters) {
    puffs.push({ p: c.p.clone(), r: c.r, tone: R(), core: true });
    const n = sub[0] + Math.floor(R() * (sub[1] - sub[0] + 1)), out = c.p.clone().sub(ctr); out.y = Math.max(out.y, 0) * .6 + c.r * (o.lift ?? .9); out.normalize();
    for (let i = 0; i < n; i++) {
      const d = V3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize().addScaledVector(out, o.outward ?? 1.1).normalize();
      if (d.y < -.3) { d.y = -.3; d.normalize(); }
      puffs.push({ p: c.p.clone().addScaledVector(d, c.r * range(R, .55, .78)), r: c.r * range(R, .4, .6), tone: R() });
    }
  }
  const span = Math.max(.01, y1 - y0);
  const shadeAt = (p, n, base, isLeaf) => {
    const h = clamp01((p.y - y0) / span), outw = clamp01(.5 + .5 * p.clone().sub(ctr).normalize().dot(n));
    const occ = .58 + .42 * clamp01(h * .7 + outw * .35 + n.y * .2);
    const c = base.clone().multiplyScalar(occ);
    if (n.y > .25) c.lerp(lt, clamp01((n.y - .25) / .75) * sm(h * 1.3 - .2) * (isLeaf ? .45 : .6));
    if (n.y > .7 && h > .72) c.lerp(hi, (isLeaf ? .35 : .25) * clamp01((h - .72) / .28));
    return c;
  };
  const geos = [];
  for (const q of puffs) {
    const g = new THREE.SphereGeometry(q.r, o.ws ?? 14, o.hs ?? 10); g.scale(1, o.squash ?? .9, 1); g.translate(q.p.x, q.p.y, q.p.z);
    const base = q.tone < .5 ? dk.clone() : dk.clone().lerp(md, .5);
    paint(g, (p, n) => shadeAt(p, n, base, false)); geos.push(g);
  }
  // leaf cards on the visible surface
  const LG = leafGeo(), leaves = [], ls = o.leafSize ?? .3, want = o.nLeaves ?? Math.round(puffs.reduce((s, q) => s + q.r * q.r, 0) * (o.density ?? 9));
  const wsum = puffs.reduce((s, q) => s + q.r * q.r, 0);
  for (let tries = 0; leaves.length < want && tries < want * 6; tries++) {
    let k = R() * wsum, q = puffs[0]; for (const qq of puffs) { k -= qq.r * qq.r; if (k <= 0) { q = qq; break; } }
    const dir = V3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize();
    const s = q.p.clone().addScaledVector(dir, q.r); s.y = q.p.y + (s.y - q.p.y) * (o.squash ?? .9);
    if (o.minY != null && s.y < o.minY) continue;
    if (puffs.some(qq => qq !== q && s.distanceTo(qq.p) < qq.r * .93)) continue;
    // shingled: leaves lie along the surface, pointing outward and a little down
    const L = ls * range(R, .75, 1.25), tg = V3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); tg.addScaledVector(dir, -tg.dot(dir)).normalize();
    const d = tg.multiplyScalar(.8).addScaledVector(dir, .3).add(V3(0, -.45, 0)).normalize();
    const g = LG.clone().applyMatrix4(orient(s.clone().addScaledVector(d, -L * .15), d, V3(0, 1, 0).lerp(dir, .78), L));
    const r = R(), base = r < .35 ? md : r < .86 ? lt.clone().lerp(md, .35) : hi.clone().lerp(lt, .35);
    const n0 = dir.clone(); paint(g, (p) => shadeAt(p, n0, base, true));
    leaves.push(g);
  }
  return { puffs: merge(geos), leaves: leaves.length ? merge(leaves) : null, y0, y1, list: puffs, ctr };
}
/** small round fruit hanging on the lower outside of the canopy */
function fruits(R, F, n, color, r = .1) {
  const out = [], c1 = col(color), c2 = col(shade(color, -.25));
  for (let tries = 0; out.length < n && tries < n * 40; tries++) {
    const q = pick(R, F.list), dir = V3(R() * 2 - 1, range(R, -.9, .15), R() * 2 - 1).normalize();
    const s = q.p.clone().addScaledVector(dir, q.r * .96);
    if (F.list.some(qq => qq !== q && s.distanceTo(qq.p) < qq.r * .95)) continue;
    if (s.clone().sub(F.ctr).setY(0).length() < .5) continue;
    const g = new THREE.SphereGeometry(r * range(R, .85, 1.15), 12, 9); g.scale(1, .92, 1); g.translate(s.x, s.y - r * .4, s.z);
    paint(g, (p, nn) => c2.clone().lerp(c1, clamp01(.45 + nn.y * .6)));
    const st = new THREE.CylinderGeometry(.012, .016, r * .9, 5); st.translate(s.x, s.y + r * .45, s.z); tint(st, '#5a3a1e');
    out.push(g, st);
  }
  return out.length ? merge(out) : null;
}
function trunkGeo(th, lean, r0 = .36, bark = '#8a5a36') {
  const g = lath([[r0, 0], [r0 * .74, .12], [r0 * .58, .45], [r0 * .53, th * .6], [r0 * .47, th], [r0 * .32, th + .4]], 18, { smooth: 4 });
  bend(g, y => [lean * (y / th) ** 2, 0]);
  const dkb = shade(bark, -.38);
  return paint(g, (p, n) => mixC(dkb, bark, clamp01(.35 + n.x * .25 + n.z * .3 - p.y / th * .25)));
}
function branchGeo(a, b, r0, bark = '#8a5a36', R) {
  const m = a.clone().lerp(b, .5); m.y += a.distanceTo(b) * .15; if (R) m.add(V3((R() - .5) * .3, 0, (R() - .5) * .3));
  return paint(sweep([a, m, b], u => r0 * (1 - u * .55), { seg: 10, rad: 8 }), (p, n) => mixC(shade(bark, -.4), bark, .45 + n.y * .3));
}
function finishTree(g, s, F, wTrunk) {
  ink(g, wTrunk * s);
  g.scale.setScalar(s);
  g.userData.footprint = { r: .4 * s };
  g.userData.canopy = { y0: F.y0 * s, y1: F.y1 * s };
  return g;
}
/** round broadleaf tree: thick trunk, a wide dome of clustered leaf puffs; o.fruit adds fruit (o.fruitColor) */
function tree(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), bark = o.bark || '#8b5b38';
  const th = range(R, 2.0, 2.5), lean = range(R, -.3, .3), rx = range(R, 1.8, 2.3) * (o.wide ?? 1), ry = rx * range(R, .55, .68);
  const top = V3(lean, th, 0), ctr = V3(lean * 1.25, th + ry * .5, 0);
  const cl = [], n = o.clusters ?? 9 + Math.floor(R() * 4);
  for (let i = 0; i < n; i++) {
    const az = i / n * TAU + R() * .45, el = range(R, -.25, .85), k = range(R, .6, .8);
    cl.push({ p: V3(ctr.x + Math.cos(az) * Math.cos(el) * rx * k, ctr.y + Math.sin(el) * ry * k, ctr.z + Math.sin(az) * Math.cos(el) * rx * k * .85), r: rx * range(R, .3, .4) });
  }
  cl.push({ p: ctr.clone().add(V3(0, ry * .3, 0)), r: rx * .5 });
  const wood = [trunkGeo(th, lean, .36, bark)];
  const low = cl.slice(0, n).filter(c => c.p.y < ctr.y + ry * .25).slice(0, 5);
  for (const c of low) wood.push(branchGeo(top.clone().add(V3(0, -.35, 0)), c.p.clone().lerp(top, .2), .12, bark, R));
  mk(merge(wood), vcMat(), [0, 0, 0], null, g);
  const F = foliage(R, cl, { pal: palOf(o, 'leaf'), leafSize: (o.leafSize ?? .3) * rx / 2.1, density: (o.density ?? 85) * (o.detail ?? 1), sub: [5, 8], ws: o.detail < .6 ? 10 : 14, hs: o.detail < .6 ? 7 : 10 });
  mk(F.puffs, vcMat({ rough: .9 }), [0, 0, 0], null, g);
  if (F.leaves) thin(mk(F.leaves, vcMat({ rough: .75 }), [0, 0, 0], null, g), .009 * s);
  if (o.fruit) { const fr = fruits(R, F, o.fruits ?? 16, o.fruitColor || pick(R, ['#e2432f', '#f2a53a', '#d4d84a']), .11); if (fr) thin(mk(fr, vcMat({ rough: .4 }), [0, 0, 0], null, g), .008 * s); }
  return finishTree(g, s, F, .02);
}
/** conifer: 4-5 drooping scalloped tiers, dark underside, light tips */
function pine(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), H = range(R, 4.4, 5.6) * (o.tall ?? 1), tiers = o.tiers ?? 4 + Math.floor(R() * 2);
  const [dk, md, lt, hi] = palOf(o, 'pine').map(col);
  mk(trunkGeo(1.4, 0, .22, '#7a4f33'), vcMat(), [0, 0, 0], null, g);
  const geos = [];
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1), base = .9 + k * (H - 2.0) * .82, Rr = (1.55 - k * 1.05) * (o.wide ?? 1), h = 1.35 - k * .45, ph = R() * TAU, lobes = 7 + (i % 3);
    let tg = lath([[0, base - .1], [Rr * .5, base], [Rr * .92, base - .1], [Rr, base - .02], [Rr * .8, base + h * .3], [Rr * .42, base + h * .7], [0, base + h]], 40, { smooth: 3 });
    tg.deleteAttribute('uv'); tg.deleteAttribute('normal'); tg = mergeVertices(tg);
    const P = tg.attributes.position;
    for (let j = 0; j < P.count; j++) {
      const x = P.getX(j), z = P.getZ(j), y = P.getY(j), rr0 = Math.hypot(x, z), f = clamp01(rr0 / Rr), a = Math.atan2(z, x);
      const w = 1 + .1 * Math.sin(a * lobes + ph) * f * f; P.setXYZ(j, x * w, y - .07 * (Math.sin(a * lobes + ph) * .5 + .5) * f * f * f, z * w);
    }
    tg.computeVertexNormals(); addUV(tg);
    paint(tg, (p, n) => { const f = clamp01(Math.hypot(p.x, p.z) / Rr); let c = n.y < -.1 ? dk.clone().multiplyScalar(.85) : dk.clone().lerp(md, clamp01(.3 + f * .5 + n.y * .3)); if (n.y > .2) c.lerp(lt, f * f * .6 * clamp01(n.y)); if (f > .85 && n.y > 0) c.lerp(hi, (f - .85) * 2); return c.multiplyScalar(.85 + .15 * k); });
    geos.push(tg);
  }
  mk(merge(geos), vcMat({ rough: .88 }), [0, 0, 0], null, g);
  return finishTree(g, s, { y0: .8, y1: H }, .02);
}
/** palm: curved ringed trunk, a crown of serrated arching fronds, coconuts */
function palm(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), H = range(R, 4.6, 5.6), bx = range(R, .6, 1.3) * (R() < .5 ? -1 : 1), bz = range(R, -.4, .4);
  const pts = [V3(0, 0, 0), V3(bx * .1, H * .3, bz * .1), V3(bx * .45, H * .66, bz * .45), V3(bx, H, bz)];
  const rings = 14, c1 = col('#b07d4c'), c2 = col('#8a5c35');
  const tr = sweep(pts, u => (.21 - .08 * u + .14 * (1 - u) ** 10) * (1 + .1 * Math.abs(Math.sin(u * PI * rings)) ** .5), { seg: 60, rad: 12 });
  paint(tr, (p, n, i, t) => { const f = (t.y * rings) % 1; return (f < .55 ? c1 : c2).clone().multiplyScalar(.8 + .2 * clamp01(n.x * .5 + n.z * .5 + .6)); });
  mk(tr, vcMat(), [0, 0, 0], null, g);
  const T = pts[3], [dk, md, lt, hi] = palOf(o, 'palm').map(col), fr = [], nF = o.fronds ?? 8 + Math.floor(R() * 2);
  for (let i = 0; i < nF; i++) {
    const az = i / nF * TAU + R() * .35, d = V3(Math.cos(az), 0, Math.sin(az)), len = range(R, 2.3, 2.9), rise = range(R, 0, .5);
    const fp = [T.clone(), T.clone().addScaledVector(d, len * .22).add(V3(0, .42 + rise * .5, 0)), T.clone().addScaledVector(d, len * .52).add(V3(0, .38 + rise * .3, 0)), T.clone().addScaledVector(d, len * .8).add(V3(0, 0, 0)), T.clone().addScaledVector(d, len).add(V3(0, -.55 - R() * .4, 0))];
    const fg = sweep(fp, u => [.44 * Math.sin(PI * u) ** .7 * (1 - .25 * u) * (u < .08 ? u / .08 : .7 + .3 * Math.abs(Math.sin(u * PI * 10))), .035 * (1 - .6 * u) + .006], { seg: 40, rad: 10 });
    const base = i % 2 ? dk.clone().lerp(md, .4) : md;
    paint(fg, (p, n, j, t) => { const c = base.clone().lerp(lt, clamp01(t.y * .8) * .55); if (n.y > .5) c.lerp(hi, .18 * t.y); return c.multiplyScalar(n.y < -.3 ? .72 : 1); });
    fr.push(fg);
  }
  mk(merge(fr), vcMat({ rough: .7 }), [0, 0, 0], null, g);
  const nuts = [];
  for (let i = 0; i < (o.coconuts ?? 3 + Math.floor(R() * 2)); i++) { const a = i / 3.5 * TAU + R(); const c = new THREE.SphereGeometry(.15, 14, 10); c.scale(1, 1.1, 1); c.translate(T.x + Math.cos(a) * .2, T.y - .2, T.z + Math.sin(a) * .2); paint(c, (p, n) => mixC('#4a2f1a', '#7a5230', .5 + n.y * .4)); nuts.push(c); }
  mk(merge(nuts), vcMat({ rough: .6 }), [0, 0, 0], null, g);
  thin(g.children[1], .01 * s);
  return finishTree(g, s, { y0: H - 1, y1: H + .8 }, .016);
}
/** bare dead tree: crooked grey trunk splitting into gnarly branches */
function deadTree(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), bark = o.bark || '#7d6d62', H = range(R, 2.4, 3.2), geos = [];
  const tp = [V3(0, 0, 0), V3(range(R, -.15, .15), H * .35, range(R, -.1, .1)), V3(range(R, -.3, .3), H * .7, range(R, -.15, .15)), V3(range(R, -.3, .3), H, 0)];
  geos.push(sweep(tp, u => .24 * (1 - u * .62) + .16 * (1 - u) ** 12, { seg: 24, rad: 12 }));
  const grow = (from, dir, len, r, depth) => {
    const mid = from.clone().addScaledVector(dir, len * .5).add(V3((R() - .5) * len * .3, (R() - .2) * len * .2, (R() - .5) * len * .3)), end = from.clone().addScaledVector(dir, len).add(V3((R() - .5) * len * .25, 0, (R() - .5) * len * .25));
    geos.push(sweep([from, mid, end], u => r * (1 - u * .8) * roundEnd(u, .08), { seg: 10, rad: 8 }));
    if (depth > 0) for (let k = 0; k < 2; k++) { const nd = dir.clone().add(V3((R() - .5) * 1.4, range(R, .1, .7), (R() - .5) * 1.4)).normalize(); grow(mid.clone().lerp(end, range(R, .2, .7)), nd, len * range(R, .5, .7), r * .6, depth - 1); }
  };
  const nb = 3 + Math.floor(R() * 2);
  for (let i = 0; i < nb; i++) { const a = i / nb * TAU + R(), at = new THREE.CatmullRomCurve3(tp).getPointAt(range(R, .55, .95)); grow(at, V3(Math.cos(a), range(R, .45, 1), Math.sin(a) * .7).normalize(), range(R, 1, 1.6), .1, 2); }
  const m = merge(geos); paint(m, (p, n) => mixC(shade(bark, -.35), bark, .45 + n.y * .3 + n.z * .2 - p.y * .03));
  mk(m, vcMat(), [0, 0, 0], null, g);
  ink(g, .016 * s); g.scale.setScalar(s); g.userData.footprint = { r: .3 * s };
  return g;
}
/** round leafy bush; o.flowers: a colour for little blossoms (or true), o.berries likewise */
function bush(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), w = range(R, 1.1, 1.5) * (o.wide ?? 1), h = range(R, .8, 1.05);
  const cl = [{ p: V3(0, h * .52, 0), r: .45 }], n = 5 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * .6, k = range(R, .7, 1); cl.push({ p: V3(Math.cos(a) * w * .3 * k, h * range(R, .3, .55), Math.sin(a) * w * .25 * k), r: range(R, .28, .38) }); }
  const F = foliage(R, cl, { pal: palOf(o, 'bush'), sub: [2, 4], leafSize: .19, density: 95 * (o.detail ?? 1), lift: .5, minY: .06 });
  mk(F.puffs, vcMat({ rough: .9 }), [0, 0, 0], null, g);
  if (F.leaves) thin(mk(F.leaves, vcMat({ rough: .75 }), [0, 0, 0], null, g), .006 * s);
  const deco = o.flowers || o.berries;
  if (deco) {
    const cc = typeof deco === 'string' ? deco : o.flowers ? pick(R, ['#ff8fb8', '#ffffff', '#ffd23f', '#c48aff']) : '#d8342c', bits = [];
    for (let tries = 0; bits.length < 22 && tries < 400; tries++) {
      const q = pick(R, F.list), d = V3(R() * 2 - 1, range(R, -.1, 1), R() * 2 - 1).normalize(), p = q.p.clone().addScaledVector(d, q.r * .97);
      if (F.list.some(qq => qq !== q && p.distanceTo(qq.p) < qq.r * .95)) continue;
      const b = new THREE.SphereGeometry(o.flowers ? .05 : .04, 8, 6); if (o.flowers) b.scale(1, .55, 1); b.translate(p.x, p.y, p.z); tint(b, cc); bits.push(b);
      if (o.flowers) { const c = new THREE.SphereGeometry(.018, 6, 4); c.translate(p.x, p.y + .02, p.z); tint(c, '#ffd23f'); bits.push(c); }
    }
    if (bits.length) thin(mk(merge(bits), vcMat({ rough: .5 }), [0, 0, 0], null, g), .004 * s);
  }
  ink(g, .012 * s); g.scale.setScalar(s);
  return g;
}
/** trimmed hedge along x: o.length, o.height, o.depth */
function hedge(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), L = o.length ?? 3, H = o.height ?? 1.1, D = o.depth ?? .8, [dk] = GREENS.bush;
  mk(rboxUp(L - .15, H - .12, D - .15, .22), M(shade(dk, -.1)), [0, 0, 0], null, g);
  const cl = [], nx = Math.max(2, Math.round(L / .55));
  for (let i = 0; i < nx; i++) {
    const x = -L / 2 + .3 + (L - .6) * i / (nx - 1);
    cl.push({ p: V3(x + range(R, -.05, .05), H - .28, range(R, -.08, .08)), r: range(R, .3, .36) });
    for (const sd of [-1, 1]) cl.push({ p: V3(x + range(R, -.1, .1), H * range(R, .3, .55), sd * (D / 2 - .26)), r: range(R, .26, .32) });
  }
  const F = foliage(R, cl, { pal: palOf(o, 'bush'), sub: [1, 2], leafSize: .16, density: 95 * (o.detail ?? 1), lift: .2, outward: .5, minY: .05 });
  mk(F.puffs, vcMat({ rough: .9 }), [0, 0, 0], null, g);
  if (F.leaves) thin(mk(F.leaves, vcMat({ rough: .75 }), [0, 0, 0], null, g), .006);
  ink(g, .012); g.userData.top = H; g.userData.footprint = { w: L, d: D };
  return g;
}
const STONE = ['#8f929e', '#a7a9b4', '#c3c5cd', '#6c6f7d'];
function rockPaint(g, top, o = {}) {
  const [b, l, hi, d] = (o.pal || STONE).map(col), moss = o.moss ? col(o.moss === true ? '#5f9a3f' : o.moss) : null;
  return paint(g, (p, n) => { let c = d.clone().lerp(b, clamp01(.45 + n.y * .5 + p.y / top * .3)); if (n.y > .35) c.lerp(l, (n.y - .35) * .9); if (n.y > .8) c.lerp(hi, .25); if (moss && n.y > .55) c.lerp(moss, clamp01((n.y - .55) * 3) * .85); return c; });
}
/** a big rounded boulder (o.size scales; o.moss: green on top) */
function boulder(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), sz = [range(R, .55, .75) * s, range(R, .55, .8) * s, range(R, .5, .65) * s];
  const geo = blob(R, { size: sz, amp: .16 }); rockPaint(geo, sz[1], o);
  mk(geo, vcMat({ rough: .85 }), [0, 0, 0], null, g);
  ink(g, .014 * s); g.userData.top = sz[1] * .9;
  return g;
}
/** a cluster of 3-5 rocks of different sizes */
function rocks(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), n = o.n ?? 3 + Math.floor(R() * 3), geos = [];
  for (let i = 0; i < n; i++) {
    const k = i === 0 ? 1 : range(R, .35, .65), sz = [range(R, .35, .5) * k, range(R, .35, .55) * k, range(R, .3, .45) * k], a = R() * TAU, d = i === 0 ? 0 : range(R, .35, .6);
    const b = blob(R, { size: sz, amp: .18, ws: 16, hs: 10 }); rockPaint(b, sz[1], o); b.translate(Math.cos(a) * d, 0, Math.sin(a) * d); geos.push(b);
  }
  mk(merge(geos), vcMat({ rough: .85 }), [0, 0, 0], null, g);
  ink(g, .01 * s); g.scale.setScalar(s);
  return g;
}
/** grass tufts (walk-through: solid false); o.n tufts, o.spread radius, o.tall */
function grass(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), n = o.n ?? 3 + Math.floor(R() * 3), spread = o.spread ?? .35, geos = [];
  const [dk, md, lt, hi] = (o.pal || ['#2f7a2e', '#4f9e38', '#86c24a', '#c2dc6a']).map(col), dry = o.dry ? col('#c9a94a') : null;
  for (let t = 0; t < n; t++) {
    const a = R() * TAU, d = t ? Math.sqrt(R()) * spread : 0, cx = Math.cos(a) * d, cz = Math.sin(a) * d, nb = 12 + Math.floor(R() * 7), h0 = range(R, .38, .62) * (o.tall ?? 1);
    for (let i = 0; i < nb; i++) {
      const ba = R() * TAU, lean = range(R, .1, .45), h = h0 * range(R, .6, 1.1), dir = V3(Math.cos(ba), 0, Math.sin(ba)), b = V3(cx + dir.x * .03, 0, cz + dir.z * .03);
      const bl = sweep([b, b.clone().addScaledVector(dir, h * lean * .25).add(V3(0, h * .55, 0)), b.clone().addScaledVector(dir, h * lean).add(V3(0, h, 0))], u => [.03 * (1 - u) + .003, .012 * (1 - u) + .002], { seg: 6, rad: 5, up: [dir.x, 0, dir.z] });
      const tip = R() < .3 ? hi : lt;
      paint(bl, (p, nn, j, tt) => { const c = dk.clone().lerp(md, clamp01(tt.y * 1.6)).lerp(tip, clamp01(tt.y * 1.4 - .5)); return dry && i % 3 === 0 ? c.lerp(dry, .6) : c; });
      geos.push(bl);
    }
  }
  mk(merge(geos), vcMat({ rough: .8 }), [0, 0, 0], null, g);
  if (o.ink) ink(g, .004);
  g.scale.setScalar(s); g.userData.solid = false;
  return g;
}
/** a patch of flowers (solid false): o.color petals (else a seeded mix), o.n */
function flowers(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), n = o.n ?? 5 + Math.floor(R() * 4), geos = [];
  const pals = ['#ff7aa8', '#ffd23f', '#ffffff', '#b57bff', '#ff5a4a', '#ff9f43', '#6fc3ff'], c0 = o.color || pick(R, pals), c1 = o.color || pick(R, pals);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = i ? Math.sqrt(R()) * (o.spread ?? .35) : 0, x = Math.cos(a) * d, z = Math.sin(a) * d, h = range(R, .3, .5), lx = range(R, -.06, .06), lz = range(R, -.06, .06);
    const top = V3(x + lx, h, z + lz);
    geos.push(tint(sweep([V3(x, 0, z), V3(x + lx * .3, h * .5, z + lz * .3), top], .009, { seg: 6, rad: 5 }), '#3f8a34'));
    const pc = R() < .5 ? c0 : c1, np = 5, pr = range(R, .06, .08), tilt = V3(lx, 1, lz).normalize();
    for (let k = 0; k < np; k++) {
      const ang = k / np * TAU, dir = V3(Math.cos(ang), 0, Math.sin(ang)); dir.addScaledVector(tilt, -dir.dot(tilt)).normalize();
      const pg = new THREE.SphereGeometry(1, 8, 6); pg.applyMatrix4(orient(top.clone().addScaledVector(dir, pr * .75), dir, tilt, [pr * .55, pr * .2, pr * .75]));
      paint(pg, (p, nn) => mixC(shade(pc, -.18), pc, .6 + nn.y * .4)); geos.push(pg);
    }
    const cg = new THREE.SphereGeometry(pr * .42, 8, 6); cg.scale(1, .7, 1); cg.translate(top.x, top.y + pr * .08, top.z); tint(cg, pc === '#ffd23f' ? '#c26a1a' : '#ffd23f'); geos.push(cg);
    if (i % 2 === 0) { const la = R() * TAU, ld = V3(Math.cos(la), .5, Math.sin(la)).normalize(), lb = LEAF_G || leafGeo(); const lg = lb.clone().applyMatrix4(orient(V3(x, h * .3, z), ld, V3(0, 1, 0), .1)); tint(lg, '#4fa03c'); geos.push(lg); }
  }
  mk(merge(geos), vcMat({ rough: .7 }), [0, 0, 0], null, g);
  ink(g, .004); g.scale.setScalar(s); g.userData.solid = false;
  return g;
}
/** toadstool(s): spotted dome cap on a cream stem; o.n 1-3, o.color cap */
function mushroom(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), n = o.n ?? 1, capC = o.color || pick(R, ['#e2432f', '#e2432f', '#f08a2a', '#b06ad8']);
  for (let i = 0; i < n; i++) {
    const k = i ? range(R, .45, .7) : 1, a = R() * TAU, d = i ? range(R, .14, .22) : 0, x = Math.cos(a) * d, z = Math.sin(a) * d, h = .2 * k, cr = .17 * k;
    const st = lath([[.06 * k, 0], [.072 * k, .02 * k], [.055 * k, h * .55], [.05 * k, h], [.03 * k, h + .02]], 20, { smooth: 3 });
    paint(st, (p, nn) => mixC('#d9c9a8', '#f6ecd9', .5 + nn.x * .3 + nn.z * .3)); st.translate(x, 0, z);
    const cap = lath([[0, h - .01 * k], [cr * .5, h + .01 * k], [cr * .95, h - .005 * k], [cr, h + .02 * k], [cr * .85, h + .08 * k], [cr * .45, h + .14 * k], [0, h + .16 * k]], 32, { smooth: 3 });
    paint(cap, (p, nn) => nn.y < -.2 ? col('#e8d7b8') : mixC(shade(capC, -.3), capC, .55 + nn.y * .45)); cap.translate(x, 0, z);
    const spots = [];
    for (let j = 0; j < 7; j++) { const sa = j / 7 * TAU + R() * .5, el = range(R, .35, 1.1), dir = V3(Math.cos(sa) * Math.cos(el), Math.sin(el), Math.sin(sa) * Math.cos(el)); const sp = new THREE.SphereGeometry(1, 8, 5); sp.applyMatrix4(orient(V3(x + dir.x * cr * .82, h + .03 * k + dir.y * .13 * k, z + dir.z * cr * .82), dir, V3(0, 1, 0), [.03 * k, .03 * k, .012 * k])); tint(sp, '#fffaf0'); spots.push(sp); }
    mk(merge([st, cap]), vcMat({ rough: .55 }), [0, 0, 0], null, g);
    thin(mk(merge(spots), vcMat({ rough: .6 }), [0, 0, 0], null, g), .003);
  }
  ink(g, .006); g.scale.setScalar(s);
  return g;
}
function barkTex(seed = 3, base = '#8b5b38') {
  const R = rnd(seed);
  return canvasTex(256, 256, (x, W, H) => { x.fillStyle = base; x.fillRect(0, 0, W, H); for (let i = 0; i < 70; i++) { x.strokeStyle = shade(base, -.15 - R() * .25); x.globalAlpha = .6; x.lineWidth = 2 + R() * 5; const X = R() * W; x.beginPath(); x.moveTo(X, 0); x.bezierCurveTo(X + (R() - .5) * 20, H * .3, X + (R() - .5) * 20, H * .7, X + (R() - .5) * 14, H); x.stroke(); } x.globalAlpha = 1; });
}
function ringsTex(base = '#e4c08a') {
  return canvasTex(256, 256, (x, W, H) => { x.fillStyle = shade(base, -.25); x.fillRect(0, 0, W, H); const cx = W / 2, cy = H / 2; for (let r = W * .47, i = 0; r > 4; r -= 9 + (i % 3) * 3, i++) { x.fillStyle = i === 0 ? shade(base, -.45) : i % 2 ? base : shade(base, -.1); x.beginPath(); x.arc(cx + Math.sin(i) * 2, cy + Math.cos(i * 1.3) * 2, r, 0, TAU); x.fill(); } x.fillStyle = shade(base, -.35); x.beginPath(); x.arc(cx, cy, 5, 0, TAU); x.fill(); });
}
/** a cut log lying along x (sit on it: userData.seat) */
function log(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), L = o.length ?? range(R, 1.4, 1.9), r = range(R, .17, .22);
  const bt = barkTex(o.seed ?? 3), rt = ringsTex();
  const geo = new THREE.CylinderGeometry(r, r * 1.04, L, 22, 1);
  mk(geo, [texMat(bt, { rough: .9 }), texMat(rt, { rough: .8 }), texMat(rt, { rough: .8 })], [0, r, 0], [0, 0, PI / 2], g);
  const st = sweep([V3(L * .15, r * 1.6, 0), V3(L * .2, r * 2.1, .05), V3(L * .26, r * 2.4, .12)], u => .05 * (1 - u * .5) * roundEnd(u), { seg: 6, rad: 8 });
  mk(tint(st, '#7a4f30'), vcMat(), [0, 0, 0], null, g);
  ink(g, .01 * s); g.scale.setScalar(s); g.userData.seat = (r * 2 - .02) * s;
  return g;
}
/** a tree stump with root flares and a ringed top (seat) */
function stump(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), h = range(R, .4, .55), r = range(R, .3, .38);
  mk(new THREE.CylinderGeometry(r, r * 1.12, h, 22, 1), [texMat(barkTex(o.seed ?? 4), { rough: .9 }), texMat(ringsTex(), { rough: .8 }), M('#5e3b24')], [0, h / 2, 0], null, g);
  const roots = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + R() * .5, d = V3(Math.cos(a), 0, Math.sin(a)); roots.push(sweep([d.clone().multiplyScalar(r * .7).setY(h * .45), d.clone().multiplyScalar(r * 1.25).setY(.08), d.clone().multiplyScalar(r * 1.7).setY(0)], u => .1 * (1 - u * .7) * roundEnd(u, .15), { seg: 8, rad: 8 })); }
  const rg = merge(roots); paint(rg, (p, n) => mixC('#5e3b24', '#8b5b38', .5 + n.y * .4)); mk(rg, vcMat(), [0, 0, 0], null, g);
  ink(g, .01 * s); g.scale.setScalar(s); g.userData.seat = h * s; g.userData.top = h * s;
  return g;
}
/** cactus: o.kind 'tall' (ribbed column + arms) | 'barrel'; o.flower */
function cactus(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), kind = o.kind || 'tall', c = col(o.color || '#4f9a48'), dk = col('#2f6a35'), lt = col('#8cc65a');
  const ribbed = (prof, ribs = 10) => {
    let b = lath(prof, 60, { smooth: 4 }); b.deleteAttribute('uv'); b.deleteAttribute('normal'); b = mergeVertices(b);
    const P = b.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), a = Math.atan2(z, x), k = 1 + .075 * Math.cos(a * ribs); P.setX(i, x * k); P.setZ(i, z * k); }
    b.computeVertexNormals(); addUV(b);
    return paint(b, (p, n) => { const a = Math.atan2(p.z, p.x), gr = Math.cos(a * ribs); return dk.clone().lerp(c, clamp01(.5 + gr * .6)).lerp(lt, clamp01(n.y) * .35 + clamp01(gr - .6) * .3); });
  };
  const geos = []; let top;
  if (kind === 'barrel') { const h = .55; geos.push(ribbed([[0, 0], [.28, .03], [.36, .2], [.34, .42], [.22, .53], [0, h]], 16)); top = h; }
  else {
    const h = range(R, 1.9, 2.4); top = h;
    geos.push(ribbed([[0, 0], [.22, .01], [.27, .12], [.27, h - .45], [.24, h - .15], [.15, h - .02], [0, h]], 10));
    const arms = R() < .25 ? [1] : [-1, 1];
    for (const sd of arms) {
      const y0 = range(R, .7, 1.1), out = range(R, .5, .62), up = range(R, .5, .8);
      const ag = sweep([V3(sd * .15, y0, 0), V3(sd * (out - .05), y0 + .02, 0), V3(sd * out, y0 + .2, 0), V3(sd * out, y0 + up, 0)], u => .14 * roundEnd(u, .14), { seg: 20, rad: 14 });
      paint(ag, (p, n) => dk.clone().lerp(c, .55 + n.y * .2 + n.z * .25).lerp(lt, clamp01(n.y) * .3)); geos.push(ag);
    }
  }
  mk(merge(geos), vcMat({ rough: .7 }), [0, 0, 0], null, g);
  if (o.flower ?? R() < .5) {
    const fl = []; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU, d = V3(Math.cos(a), .6, Math.sin(a)).normalize(); const p = new THREE.SphereGeometry(1, 8, 6); p.applyMatrix4(orient(V3(d.x * .05, top + .02, d.z * .05), d, V3(0, 1, 0), [.04, .015, .06])); tint(p, '#ff6fa8'); fl.push(p); }
    const cc = new THREE.SphereGeometry(.03, 8, 6); cc.translate(0, top + .03, 0); tint(cc, '#ffd23f'); fl.push(cc);
    thin(mk(merge(fl), vcMat({ rough: .6 }), [0, 0, 0], null, g), .004);
  }
  ink(g, .012 * s); g.scale.setScalar(s); g.userData.footprint = { r: .3 * s };
  return g;
}
/** reeds / cattails by water (solid false) */
function reeds(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), geos = [], heads = [], n = o.n ?? 10 + Math.floor(R() * 5);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * .35, x = Math.cos(a) * d, z = Math.sin(a) * d, h = range(R, 1, 1.6), lx = range(R, -.15, .15), lz = range(R, -.15, .15);
    const tip = V3(x + lx, h, z + lz);
    if (i % 3 === 2) { const dir = V3(lx, 0, lz).normalize(); geos.push(paint(sweep([V3(x, 0, z), V3(x + lx * 1.5, h * .55, z + lz * 1.5), V3(x + lx * 4, h * .8, z + lz * 4)], u => [.035 * (1 - u) + .004, .006], { seg: 10, rad: 6, up: [dir.x || 1, 0, dir.z] }), (p, nn, j, t) => mixC('#3f7f34', '#8cbf5a', t.y))); continue; }
    geos.push(paint(sweep([V3(x, 0, z), V3(x + lx * .4, h * .5, z + lz * .4), tip], .012, { seg: 8, rad: 5 }), (p, nn, j, t) => mixC('#4a7f36', '#9cc46a', t.y)));
    if (i % 2 === 0) { const hd = lath([[0, 0], [.035, .02], [.04, .1], [.035, .2], [0, .22]], 12, { smooth: 2 }); hd.translate(tip.x, tip.y - .26, tip.z); paint(hd, (p, nn) => mixC('#4a2c1a', '#7a4a2a', .5 + nn.y * .3)); heads.push(hd); }
  }
  mk(merge(geos), vcMat({ rough: .75 }), [0, 0, 0], null, g);
  if (heads.length) mk(merge(heads), vcMat({ rough: .8 }), [0, 0, 0], null, g);
  ink(g, .005); g.scale.setScalar(s); g.userData.solid = false;
  return g;
}
/** a rocky cliff chunk with layered strata and a grassy top (o.grass false: bare); o.w, o.h, o.d */
function cliff(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), W = o.w ?? 5, H = o.h ?? 3.2, D = o.d ?? 3, geos = [];
  const base = o.color || '#b8875a', a = col(base), b = col(shade(base, -.16)), dkr = col(shade(base, -.42)), lt = col(shade(base, .14)), gr = col('#5fa53f'), grl = col('#8ccc55');
  // craggy chunks: lumpy blocks with flat tops at stepped heights, packed over W x D (the tallest at the back)
  const n = o.chunks ?? 6 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const back = i < n * .55, hx = (back ? range(R, .2, .32) : range(R, .16, .26)) * W, hz = range(R, .3, .45) * D;
    const cx = (back ? (i / (n * .55) - .5) * W * .8 : range(R, -.4, .4) * W), cz = back ? -D * .15 + range(R, -.1, .1) * D : D * range(R, .1, .3);
    const top = (back ? range(R, .8, 1) : range(R, .35, .65)) * H, Dn = noiseDirs(R, 7, 2.8, .26), geo = wsphere(22, 16), P = geo.attributes.position;
    for (let j = 0; j < P.count; j++) {
      let x = P.getX(j), y = P.getY(j), z = P.getZ(j); const k = 1 + lump(Dn, x, y, z);
      x *= k; z *= k; y *= 1 + lump(Dn, x * .7, y * 2, z * .7) * .4;
      // boxy: push the sides out (superellipse), flatten the top and bottom
      const sx = Math.sign(x) * Math.abs(x) ** .6, sz = Math.sign(z) * Math.abs(z) ** .6;
      let yy = Math.sign(y) * Math.abs(y) ** .55; if (yy > .82) yy = .82 + (yy - .82) * .15; if (yy < -.7) yy = -.7;
      P.setXYZ(j, cx + sx * hx, (yy + .7) / 1.52 * top, cz + sz * hz);
    }
    geo.computeVertexNormals(); addUV(geo);
    const ph = R() * 3;
    paint(geo, (p, nn) => {
      const band = Math.floor(p.y * 2.3 + Math.sin(p.x * 1.1 + ph) * .4) % 2;
      let c = (band ? a : b).clone().lerp(dkr, clamp01(.3 - nn.y * .3 - p.y / H * .4 + (1 - Math.abs(nn.z)) * .1));
      if (nn.y > .2) c.lerp(lt, (nn.y - .2) * .5);
      if (o.grass !== false && nn.y > .62 && p.y > top * .78) c = gr.clone().lerp(grl, clamp01((nn.y - .62) * 2.6) * .75);
      return c;
    });
    geos.push(geo);
  }
  // fallen rocks at the foot
  for (let i = 0; i < 4; i++) { const k = range(R, .25, .5), rk = blob(R, { size: [k, k * .8, k * .9], amp: .2, ws: 14, hs: 10 }); rk.translate(range(R, -.45, .45) * W, 0, D * range(R, .35, .55)); paint(rk, (p, nn) => b2c(nn)); geos.push(rk); }
  function b2c(nn) { return dkr.clone().lerp(b, .5 + nn.y * .4).lerp(lt, clamp01(nn.y - .4) * .5); }
  mk(merge(geos), vcMat({ rough: .9 }), [0, 0, 0], null, g);
  ink(g, .02); g.userData.top = H; g.userData.footprint = { w: W, d: D };
  return g;
}
function moundGeo(Rr, H, seg = 56) {
  let gm = lath([[Rr, 0], [Rr * .86, H * .12], [Rr * .66, H * .45], [Rr * .42, H * .8], [Rr * .18, H * .97], [0, H]], seg, { smooth: 4 });
  gm.deleteAttribute('uv'); gm.deleteAttribute('normal'); gm = mergeVertices(gm); return gm;
}
/** a gentle grassy hill (walk on it: solid false); o.r radius, o.h height, o.color */
function hill(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), Rr = o.r ?? 6, H = o.h ?? 1.6, geo = moundGeo(Rr, H), P = geo.attributes.position, Dn = noiseDirs(R, 4, .5, .12);
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); P.setY(i, y * (1 + lump(Dn, x, 0, z) * (y / H))); P.setZ(i, z * (o.depth ?? .8)); }
  geo.computeVertexNormals(); addUV(geo);
  const c = o.color || C.grass;
  paint(geo, (p, n) => mixC(shade(c, -.22), shade(c, .12), clamp01(p.y / H * .8 + n.y * .3 - .1)));
  mk(geo, vcMat({ rough: .95 }), [0, 0, 0], null, g);
  ink(g, .02); g.userData.top = H; g.userData.solid = false;
  return g;
}
/** a sand dune: long gentle windward side, steeper lee, wind ripples (solid false) */
function dune(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), Rr = o.r ?? 5, H = o.h ?? 1.5, geo = moundGeo(Rr, H), P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); P.setXYZ(i, x * (x < 0 ? 1.5 : .7), y, z * (o.depth ?? .7) + Math.sin(x * .4) * .3); }
  geo.computeVertexNormals(); addUV(geo); void R;
  const c = o.color || C.sand;
  paint(geo, (p, n) => mixC(shade(c, -.2), shade(c, .1), clamp01(.4 + n.x * -.4 + n.y * .3)).lerp(col(shade(c, -.12)), (Math.sin(p.x * 5 + p.z * 1.4) * .5 + .5) * .35 * clamp01(n.y)));
  mk(geo, vcMat({ rough: .95 }), [0, 0, 0], null, g);
  ink(g, .02); g.userData.top = H; g.userData.solid = false;
  return g;
}
/** coral rock: a rock with branching coral, a brain coral and tube sponges */
function coral(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), geos = [];
  const base = blob(R, { size: [.55, .5, .45], amp: .2, ws: 18, hs: 12 }); rockPaint(base, .5, { pal: ['#a8948a', '#c2aea2', '#d8c8bc', '#7d6a62'] }); geos.push(base);
  const cc = o.color || pick(R, ['#f06a8a', '#ff8a4a', '#b46ad8']);
  const grow = (p, dir, len, r, depth) => {
    const e = p.clone().addScaledVector(dir, len), m = p.clone().lerp(e, .5).add(V3((R() - .5) * .08, 0, (R() - .5) * .08));
    geos.push(paint(sweep([p, m, e], u => r * (1 - u * .3) * roundEnd(u, .2), { seg: 8, rad: 8 }), (q, n) => mixC(shade(cc, -.25), cc, .55 + n.y * .45)));
    if (depth > 0) for (let k = 0; k < 2; k++) grow(m.clone().lerp(e, .6), dir.clone().add(V3((R() - .5) * 1.4, .4, (R() - .5) * 1.4)).normalize(), len * .7, r * .8, depth - 1);
  };
  for (let i = 0; i < 2; i++) grow(V3(range(R, -.2, .1), .4, range(R, -.1, .15)), V3(range(R, -.4, .4), 1, range(R, -.3, .3)).normalize(), .3, .045, 2);
  const br = new THREE.SphereGeometry(.2, 24, 16); br.scale(1, .8, 1); br.translate(.28, .38, .12);
  paint(br, (p, n) => mixC('#c77a2a', '#f2b24a', (Math.sin(p.x * 60 + Math.sin(p.z * 40) * 2) * .5 + .5) * .7 + n.y * .2)); geos.push(br);
  for (let i = 0; i < 3; i++) { const h = range(R, .2, .35), x = -.32 + i * .09, z = .1 + (i % 2) * .08, t = lath([[.045, 0], [.05, h * .5], [.055, h], [.035, h + .005], [.03, h - .03], [0, h - .035]], 12); t.translate(x, .3, z); paint(t, (p, n) => n.y > .5 && p.y > .3 + h - .01 ? col('#5a2a4a') : mixC('#9a5ac8', '#c48aff', .5 + n.x * .3)); geos.push(t); }
  mk(merge(geos), vcMat({ rough: .75 }), [0, 0, 0], null, g);
  ink(g, .01 * s); g.scale.setScalar(s * 1.5);
  return g;
}

// ================================================================ BEACH
const BRIGHT = ['#e2432f', '#2f7fd1', '#f2a53a', '#2fa59a', '#e86fa0', '#7a4fc4'];
/** beach umbrella: 8 striped gores on a banded pole in a little sand mound; o.color, o.color2, o.tilt (radians) */
function umbrella(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c1 = o.color || pick(R, BRIGHT), c2 = o.color2 || '#fbf6ea', H = 2.25, Rr = 1.15, top = new THREE.Group();
  top.rotation.z = o.tilt ?? range(R, -.16, .16); top.rotation.x = range(R, -.06, .06); g.add(top);
  const pole = lath([[.03, -.3], [.03, H], [.02, H + .05]], 12); paint(pole, p => (Math.floor((p.y + .3) / .32) % 2 ? col(c1) : col(c2)));
  mk(pole, vcMat({ rough: .5 }), [0, 0, 0], null, top);
  const prof = [[.03, H - .14], [Rr * .5, H - .31], [Rr * .97, H - .5], [Rr, H - .47], [Rr * .96, H - .43], [Rr * .55, H - .18], [Rr * .2, H - .04], [0, H]];
  for (let i = 0; i < 8; i++) mk(lath(prof, 6, { phi0: i / 8 * TAU, phiLen: TAU / 8 }), M(i % 2 ? c2 : c1, { rough: .65 }), [0, 0, 0], null, top);
  mk(new THREE.SphereGeometry(.05, 12, 8), M(c1, { rough: .4 }), [0, H + .03, 0], null, top);
  const mound = new THREE.SphereGeometry(.24, 18, 8, 0, TAU, 0, PI / 2); mound.scale(1, .3, 1); mk(mound, M(shade(C.sand, -.05)), [0, 0, 0], null, g);
  ink(g, .012); g.userData.footprint = { r: .1 };
  return g;
}
/** beach towel lying along z (solid false); o.colors: stripe colours */
function towel(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), cs = o.colors || pick(R, [['#e2432f', '#fbf6ea', '#f2a53a'], ['#2f7fd1', '#fbf6ea'], ['#2fa59a', '#f6c945', '#fbf6ea'], ['#e86fa0', '#ffffff', '#7a4fc4']]);
  mk(rbox(.85, .03, 1.75, .012, 2), texMat(stripeTex(cs, 9, { horiz: true }), { rough: .95 }), [0, .015, 0], null, g);
  ink(g, .005); g.userData.solid = false;
  return g;
}
/** sand castle ~.6 m: keep, four towers, walls, a door and a flag */
function sandcastle(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), sand = o.color || '#e6c88e', geos = [];
  const crenels = (r, y, n, s) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; const b = rbox(s, s * 1.1, s, s * .25, 2); b.translate(Math.cos(a) * r, y, Math.sin(a) * r); geos.push(b); } };
  geos.push(lath([[.5, 0], [.44, .06], [.3, .1], [0, .11]], 36, { smooth: 3 }));
  geos.push(lath([[.17, .09], [.15, .42], [.165, .43], [.12, .44], [0, .44]], 24)); crenels(.135, .465, 7, .055);
  for (const [x, z] of [[-.27, -.2], [.27, -.2], [-.27, .2], [.27, .2]]) { const t = lath([[.1, .09], [.085, .3], [.098, .31], [.07, .32], [0, .32]], 18); t.translate(x, 0, z); geos.push(t); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, b = rbox(.04, .045, .04, .01, 2); b.translate(x + Math.cos(a) * .075, .34, z + Math.sin(a) * .075); geos.push(b); } }
  for (const [x, z, w, d] of [[0, .2, .44, .07], [0, -.2, .44, .07], [-.27, 0, .07, .34], [.27, 0, .07, .34]]) { const b = rbox(w, .17, d, .02, 2); b.translate(x, .17, z); geos.push(b); }
  const m = merge(geos); paint(m, (p, n) => mixC(shade(sand, -.25), shade(sand, .1), .5 + n.y * .35 + Math.sin(p.x * 70 + p.z * 53) * .08));
  mk(m, vcMat({ rough: .95 }), [0, 0, 0], null, g);
  mk(rbox(.07, .11, .02, .02, 2), M('#5a4130'), [0, .15, .165], null, g);
  mk(new THREE.CylinderGeometry(.006, .006, .22, 5), M('#7a5a3a'), [0, .55, 0], null, g);
  mk(slab([[0, 0], [.12, .04], [0, .08]], .006, .003), M('#e2432f'), [0, .58, 0], null, g);
  ink(g, .005);
  return g;
}
/** starfish lying flat ~.26 m */
function starfish(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || pick(R, ['#f2884a', '#e8584a', '#f2b04a', '#d86aa8']), pts = [];
  for (let i = 0; i < 10; i++) { const a = PI / 2 + i / 10 * TAU, r = i % 2 ? .05 : .13; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const geo = slab(pts, .02, .018, { bs: 4, cs: 4 }); geo.rotateX(-PI / 2); geo.translate(0, .03, 0);
  mk(geo, M(c, { rough: .7 }), [0, 0, 0], null, g);
  const dots = []; for (let i = 0; i < 5; i++) for (let k = 1; k < 4; k++) { const a = PI / 2 + i / 5 * TAU, r = k * .03, d = new THREE.SphereGeometry(.009, 6, 4); d.translate(Math.cos(a) * r, .052 - k * .003, -Math.sin(a) * r); dots.push(d); }
  noInk(mk(tint(merge(dots), shade(c, .35)), vcMat(), [0, 0, 0], null, g));
  ink(g, .004); g.userData.solid = false;
  return g;
}
/** scallop shell ~.17 m with radiating ribs */
function shell(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || pick(R, ['#f6b8a8', '#f8d6b0', '#f3c6d8', '#fbeede']);
  const geo = wsphere(32, 12), P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y < 0) y = 0; if (z < 0) z *= .3;
    const a = Math.atan2(x, z + .35), rib = 1 + .1 * Math.cos(a * 16); P.setXYZ(i, x * .085, y * .045 * rib + .002, z * .085);
  }
  geo.computeVertexNormals(); addUV(geo);
  paint(geo, (p) => { const a = Math.atan2(p.x, p.z + .03); return mixC(shade(c, -.2), c, .55 + Math.cos(a * 16) * .45); });
  mk(geo, vcMat({ rough: .5 }), [0, 0, 0], null, g);
  mk(rbox(.05, .012, .02, .005, 2), M(shade(c, -.15)), [0, .006, -.03], null, g);
  ink(g, .003); g.userData.solid = false;
  return g;
}
/** coconut ~.22 m (o.open: a half shell showing the white flesh) */
function coconut(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group();
  if (o.open) {
    const geo = lath([[0, 0], [.07, .004], [.11, .04], [.12, .09], [.105, .1], [.095, .07], [.06, .056], [0, .052]], 24, { smooth: 2 });
    paint(geo, (p, n) => n.y > .3 && Math.hypot(p.x, p.z) < .1 ? col('#fbf6ea') : mixC('#4a2f1a', '#7a5230', .5 + n.y * .3));
    mk(geo, vcMat({ rough: .7 }), [0, 0, 0], null, g);
  } else {
    const geo = blob(R, { size: [.105, .2, .11], amp: .06, flat: -.85, ws: 20, hs: 14 });
    paint(geo, (p, n) => mixC('#4a2f1a', '#86592f', .45 + n.y * .3 + Math.sin(p.y * 120 + p.x * 40) * .1));
    mk(geo, vcMat({ rough: .8 }), [0, 0, 0], null, g);
    const eyes = []; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, e = new THREE.SphereGeometry(.014, 8, 6); e.translate(Math.cos(a) * .028, .195, Math.sin(a) * .028 + .02); eyes.push(e); }
    noInk(mk(tint(merge(eyes), '#2a1a10'), vcMat(), [0, 0, 0], null, g));
  }
  ink(g, .004);
  return g;
}
function ringGroup(c1 = '#e2432f', c2 = '#fbf6ea') {
  const rg = new THREE.Group();
  for (let i = 0; i < 8; i++) { const t = new THREE.TorusGeometry(.33, .085, 12, 10, TAU / 8); t.rotateZ(i * TAU / 8); mk(t, M(i % 2 ? c2 : c1, { rough: .5 }), [0, 0, 0], null, rg); }
  const rope = M('#e9dcc0', { rough: .9 });
  thin(mk(new THREE.TorusGeometry(.43, .011, 6, 64), rope, [0, 0, 0], null, rg), .003);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + TAU / 16, w = mk(new THREE.TorusGeometry(.1, .014, 6, 18), rope, [Math.cos(a) * .37, Math.sin(a) * .37, 0], null, rg); w.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(-Math.sin(a), Math.cos(a), 0)); thin(w, .003); }
  return rg;
}
/** life ring hanging on a wooden post (o.post false: lying flat on the ground) */
function lifering(o) {
  const g = new THREE.Group(), rg = ringGroup(o.color || '#e2432f');
  if (o.post === false) { rg.rotation.x = -PI / 2; rg.position.y = .09; g.add(rg); g.userData.solid = false; }
  else { mk(rboxUp(.12, 1.55, .12, .03), M('#9a6a3c'), [0, 0, -.12], null, g); mk(rbox(.05, .05, .2, .015), M('#6a4a2a'), [0, 1.42, -.02], null, g); rg.position.set(0, 1.0, .02); g.add(rg); g.userData.footprint = { r: .12 }; }
  ink(g, .008);
  return g;
}
/** lifeguard tower: stilts, platform (top), hut with a dark window, ramp, flag, sign (o.text), o.color */
function lifeguardTower(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || pick(R, ['#e2432f', '#2fa59a', '#f2a53a', '#2f7fd1']), wood = '#c99a63', white = '#f6f1e6', ph = 1.9;
  const wm = M(wood, { rough: .85 }), wd = M(shade(wood, -.2));
  for (const x of [-1.05, 1.05]) for (const z of [-.95, .95]) mk(rboxUp(.15, ph, .15, .03), wm, [x, 0, z], null, g);
  for (const x of [-1.05, 1.05]) mk(rbox(.06, 2.3, .07, .02), wd, [x, ph / 2, 0], [.78 * (x > 0 ? 1 : -1), 0, 0], g);
  mk(rbox(.07, 2.6, .06, .02), wd, [0, ph / 2, -.95], [0, 0, .65], g);
  mk(rbox(2.55, .14, 2.35, .04), M(shade(wood, -.08)), [0, ph, 0], null, g);
  const hy = ph + .07, hut = new THREE.Group(); hut.position.set(0, hy, -.3); g.add(hut);
  mk(rboxUp(1.9, 1.55, 1.45, .06), M(c, { rough: .7 }), [0, 0, 0], null, hut);
  mk(rbox(1.5, .62, .05, .03), M('#283444', { rough: .3 }), [0, 1.0, .72], null, hut);
  for (const [x, y, w, h] of [[0, 1.33, 1.6, .07], [0, .67, 1.6, .07], [-.78, 1.0, .07, .72], [.78, 1.0, .07, .72]]) mk(rbox(w, h, .07, .02), M(white), [x, y, .73], null, hut);
  mk(rbox(2.3, .14, 1.95, .05), M(white), [0, 1.62, .05], [.07, 0, 0], hut);
  mk(new THREE.CylinderGeometry(.025, .025, 1.1, 8), M('#8a8f96'), [.8, 2.1, -.2], null, hut);
  mk(slab([[0, 0], [.45, .14], [0, .28]], .015, .008), M('#f2c230'), [.82, 2.4, -.2], null, hut);
  for (const x of [-1.2, -.5, .5, 1.2]) mk(rboxUp(.07, .9, .07, .02), M(white), [x, ph + .07, 1.1], null, g);
  for (const sx of [-1, 1]) mk(rbox(.8, .07, .07, .02), M(white), [sx * .85, ph + .95, 1.1], null, g);
  for (const sx of [-1, 1]) for (const z of [-.2, .5]) mk(rboxUp(.07, .9, .07, .02), M(white), [sx * 1.2, ph + .07, z], null, g);
  for (const sx of [-1, 1]) mk(rbox(.07, .07, 1.4, .02), M(white), [sx * 1.2, ph + .95, .45], null, g);
  const len = Math.hypot(ph, 2.6), ramp = mk(rbox(.85, .07, len, .02), wm, [0, ph / 2, 1.18 + 1.3], [Math.atan2(ph, 2.6), 0, 0], g);
  for (let i = 0; i < 8; i++) mk(rbox(.85, .04, .05, .015), wd, [0, .055, -len / 2 + .25 + i * (len - .5) / 7], null, ramp);
  const tex = label(o.text || 'LIFEGUARD', { bg: c, fg: '#ffffff', w: 512, h: 112 }); g.userData.screen = tex;
  mk(rbox(1.6, .32, .06, .02), M(white), [0, 1.86, .72], null, hut);
  mk(new THREE.PlaneGeometry(1.5, .26), texMat(tex), [0, 1.86, .755], null, hut).userData.noOutline = true;
  const rg = ringGroup(); rg.scale.setScalar(.7); rg.rotation.y = PI / 2; rg.position.set(1.03, hy + .8, -.4); g.add(rg);
  ink(g, .012); g.userData.top = hy; g.userData.footprint = { w: 2.3, d: 2.1 };
  return g;
}

// ================================================================ CAMP
/** campfire: stone ring, log teepee, ash bed with glowing embers (o.lit default true). userData.fireAt for lib/fx.js */
function campfire(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), stones = [], logs = [], lit = o.lit !== false;
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + R() * .2, k = range(R, .8, 1.15), b = blob(R, { size: [.12 * k, .13 * k, .1 * k], amp: .2, ws: 12, hs: 8 }); b.rotateY(-a); b.translate(Math.cos(a) * .46, 0, Math.sin(a) * .46); rockPaint(b, .13); stones.push(b); }
  mk(merge(stones), vcMat({ rough: .85 }), [0, 0, 0], null, g);
  mk(lath([[.36, 0], [.35, .02], [.2, .035], [0, .04]], 24), M('#4a4440', { rough: 1 }), [0, 0, 0], null, g);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + R() * .3; logs.push(paint(sweep([V3(Math.cos(a) * .34, .03, Math.sin(a) * .34), V3(Math.cos(a) * .04, .44, Math.sin(a) * .04)], u => .055 * roundBoth(u, .1), { seg: 8, rad: 10 }), (p, n, j, t) => mixC('#8b5b38', '#1e1410', clamp01((t.y - .45) * 2.2)).multiplyScalar(.75 + .25 * clamp01(n.y + .6)))); }
  mk(merge(logs), vcMat(), [0, 0, 0], null, g);
  const em = own('#ff9a3a', { emissive: '#ff7a1a', ei: lit ? 2.2 : 0, rough: .6 }), embers = [];
  for (let i = 0; i < 9; i++) { const a = R() * TAU, d = range(R, .05, .26), e = new THREE.SphereGeometry(range(R, .025, .04), 8, 6); e.scale(1, .6, 1); e.translate(Math.cos(a) * d, .04, Math.sin(a) * d); embers.push(e); }
  noInk(mk(merge(embers), em, [0, 0, 0], null, g));
  ink(g, .01);
  g.userData.fireAt = [0, .2, 0]; g.userData.setLit = on => { em.emissiveIntensity = on ? 2.2 : 0; };
  return g;
}
/** A-frame tent ~1.45 m tall: door opening, rolled flap, ridge pole, guy ropes and pegs; o.color */
function tent(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || pick(R, ['#f08a2a', '#2fa59a', '#e2432f', '#5f8ad1', '#e9b84c']), W = 2.1, H = 1.45, D = 2.3;
  const body = slab([[-W / 2, 0], [0, H], [W / 2, 0]], D, .06, { bs: 3 }); body.translate(0, .06, 0);
  paint(body, (p) => p.y < .28 ? col(shade(c, -.28)) : col(c));
  mk(body, vcMat({ rough: .85 }), [0, 0, 0], null, g);
  mk(slab([[-.45, 0], [0, .98], [.45, 0]], .02, .012), M('#33241c'), [0, .07, D / 2 + .07], null, g);
  mk(sweep([V3(-.43, .1, D / 2 + .1), V3(-.25, .55, D / 2 + .11), V3(-.06, .95, D / 2 + .1)], u => .05 * roundBoth(u, .1), { seg: 10, rad: 10 }), M(shade(c, -.12)), [0, 0, 0], null, g);
  mk(rboxUp(W + .5, .02, D + .4, .01), M('#3f5a3a'), [0, 0, 0], null, g);
  for (const s of [-1, 1]) {
    mk(new THREE.CylinderGeometry(.025, .025, .34, 8), M('#8a8f96'), [0, H + .1, s * (D / 2 + .14)], [PI / 2, 0, 0], g);
    const a = V3(0, H + .12, s * (D / 2 + .25)), b = V3(0, 0, s * (D / 2 + 1.0));
    noInk(mk(sweep([a, b], .008, { seg: 2, rad: 5 }), M('#efe6d2'), [0, 0, 0], null, g));
    mk(rboxUp(.04, .12, .04, .01), M('#9aa0a8'), [0, -.02, b.z], null, g);
  }
  ink(g, .012); g.userData.footprint = { w: W, d: D };
  return g;
}
/** camp lantern ~.33 m with a warm glowing glass (o.lit default true, userData.light, setLit) */
function lantern(o) {
  const g = new THREE.Group(), lit = o.lit !== false, mc = o.color || '#2f6a4f', mm = M(mc, { rough: .45, metal: .3 });
  mk(lath([[0, 0], [.085, 0], [.09, .028], [.074, .05], [0, .05]], 20), mm, [0, 0, 0], null, g);
  const gl = own('#fff1c2', { emissive: '#ffc764', ei: lit ? 2.4 : 0, rough: .2 });
  mk(new THREE.CylinderGeometry(.062, .062, .16, 18), gl, [0, .13, 0], null, g);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; thin(mk(new THREE.CylinderGeometry(.007, .007, .17, 5), mm, [Math.cos(a) * .068, .13, Math.sin(a) * .068], null, g), .002); }
  mk(lath([[.074, .205], [.086, .225], [.05, .265], [.02, .278], [0, .282]], 20), mm, [0, 0, 0], null, g);
  thin(mk(new THREE.TorusGeometry(.06, .008, 6, 18, PI), M('#4a4f56', { metal: .5, rough: .4 }), [0, .28, 0], null, g), .002);
  const L = new THREE.PointLight('#ffc874', lit ? 2.5 : 0, 6, 2); L.position.set(0, .13, 0); L.castShadow = false; g.add(L);
  ink(g, .004);
  Object.assign(g.userData, { light: L, fireAt: [0, .13, 0], grip: { at: [0, .335, 0], rot: [0, 0, 0] }, setLit: on => { gl.emissiveIntensity = on ? 2.4 : 0; L.intensity = on ? 2.5 : 0; } });
  return g;
}
/** hiking backpack ~.65 m with a bedroll (front +z = pocket side, straps at the back) */
function backpack(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || pick(R, ['#e2432f', '#2f7fd1', '#f2a53a', '#3f8f5a', '#7a4fc4']), c2 = shade(c, -.3);
  mk(rbox(.36, .48, .22, .08), M(c), [0, .26, 0], null, g);
  mk(rbox(.38, .1, .25, .045), M(c2), [0, .5, .005], null, g);
  mk(rbox(.26, .2, .08, .04), M(c2), [0, .18, .12], null, g);
  mk(rbox(.06, .03, .02, .008), M('#c9ced4', { metal: .4 }), [0, .27, .165], null, g);
  for (const s of [-1, 1]) {
    mk(rbox(.06, .16, .14, .025), M(c2), [s * .2, .15, 0], null, g);
    mk(sweep([V3(s * .09, .46, -.11), V3(s * .11, .3, -.17), V3(s * .1, .08, -.12)], [.03, .012], { seg: 10, rad: 8, up: [0, 0, -1] }), M('#2b2f36'), [0, 0, 0], null, g);
  }
  thin(mk(new THREE.TorusGeometry(.04, .01, 6, 12, PI), M('#2b2f36'), [0, .555, -.06], null, g), .003);
  mk(new THREE.CylinderGeometry(.075, .075, .44, 18), M('#4a6a8a'), [0, .63, 0], [0, 0, PI / 2], g);
  for (const x of [-.12, .12]) mk(new THREE.TorusGeometry(.078, .012, 6, 18), M('#2b2f36'), [x, .63, 0], [0, PI / 2, 0], g);
  ink(g, .005); g.userData.grip = { at: [0, .56, -.06], rot: [0, 0, 0] };
  return g;
}

// ================================================================ STREET
const IRON = '#2f4a3f';
/** park bench ~1.7 m: cast-iron sides, wooden slats (seat .47); o.color wood, o.length */
function bench(o) {
  const g = new THREE.Group(), wood = o.color || '#b8743c', L = o.length ?? 1.7, im = M(o.iron || IRON, { rough: .5, metal: .3 }), wm = M(wood, { rough: .8 });
  for (const s of [-1, 1]) {
    const x = s * (L / 2 - .12);
    mk(sweep([V3(x, 0, -.22), V3(x, .45, -.23), V3(x, .88, -.36)], .032, { seg: 10, rad: 8 }), im, [0, 0, 0], null, g);
    mk(sweep([V3(x, 0, .24), V3(x, .45, .23)], .032, { seg: 2, rad: 8 }), im, [0, 0, 0], null, g);
    mk(sweep([V3(x, .45, .23), V3(x, .62, .22), V3(x, .64, 0), V3(x, .6, -.22)], .028, { seg: 12, rad: 8 }), im, [0, 0, 0], null, g);
    mk(rbox(.05, .05, .5, .015), im, [x, .42, 0], null, g);
    for (const z of [-.22, .24]) mk(rbox(.1, .03, .1, .01), im, [x, .015, z], null, g);
  }
  for (let i = 0; i < 4; i++) mk(rbox(L, .04, .1, .015), wm, [0, .46, -.17 + i * .125], null, g);
  for (let i = 0; i < 3; i++) { const y = .58 + i * .12; mk(rbox(L, .09, .035, .015), wm, [0, y, -.27 - (y - .45) * .32], [-.3, 0, 0], g); }
  ink(g, .007); g.userData.seat = .48;
  return g;
}
/** street lamp: o.kind 'classic' (globe on a post ~3.9 m) | 'curved' (swan neck over the road ~4.6 m); o.lit; userData.light */
function streetLamp(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), lit = !!o.lit, kind = o.kind || (R() < .5 ? 'classic' : 'curved'), pm = M(o.color || '#2d3a3f', { rough: .45, metal: .35 });
  const H = kind === 'classic' ? 3.4 : 4.1;
  mk(lath([[.18, 0], [.18, .08], [.13, .15], [.11, .5], [.075, .62], [0, .62]], 20), pm, [0, 0, 0], null, g);
  mk(lath([[.07, .55], [.06, H], [.04, H + .02], [0, H + .02]], 14), pm, [0, 0, 0], null, g);
  const gl = own('#fff4d6', { emissive: '#ffd27a', ei: lit ? 2.6 : 0, rough: .25 });
  let at;
  if (kind === 'classic') {
    mk(lath([[.06, H - .02], [.1, H + .02], [.13, H + .08], [.06, H + .1], [0, H + .1]], 18), pm, [0, 0, 0], null, g);
    mk(new THREE.SphereGeometry(.21, 22, 16), gl, [0, H + .3, 0], null, g);
    mk(lath([[0, H + .45], [.11, H + .47], [.13, H + .52], [.05, H + .6], [0, H + .62]], 18), pm, [0, 0, 0], null, g);
    mk(new THREE.SphereGeometry(.035, 10, 8), pm, [0, H + .64, 0], null, g);
    at = V3(0, H + .3, 0);
  } else {
    const end = V3(0, H + .32, .85);
    mk(sweep([V3(0, H - .05, 0), V3(0, H + .3, .08), V3(0, H + .45, .45), end], .045, { seg: 16, rad: 10 }), pm, [0, 0, 0], null, g);
    mk(lath([[.0, -.02], [.24, -.01], [.25, .03], [.16, .12], [.05, .16], [0, .16]], 22, { smooth: 2 }), pm, [end.x, end.y - .1, end.z], null, g);
    mk(new THREE.CylinderGeometry(.2, .17, .05, 22), gl, [end.x, end.y - .13, end.z], null, g);
    at = V3(end.x, end.y - .25, end.z);
  }
  // a downward cone: a pool of light on the ground, walls beside the lamp are not blown out
  const L = new THREE.SpotLight('#ffd59a', lit ? 40 : 0, 14, 1.0, .75, 2); L.position.copy(at); L.target.position.set(at.x, 0, at.z); L.castShadow = false; g.add(L, L.target);
  ink(g, .01);
  Object.assign(g.userData, { light: L, footprint: { r: .2 }, setLit: on => { gl.emissiveIntensity = on ? 2.6 : 0; L.intensity = on ? 40 : 0; } });
  return g;
}
/** fire hydrant ~.8 m (o.color red / yellow) */
function hydrant(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || pick(R, ['#d8342c', '#d8342c', '#f2c230']), m = M(c, { rough: .45 }), cap = M('#e9ecef', { rough: .35, metal: .3 });
  mk(lath([[0, 0], [.17, 0], [.17, .05], [.13, .07], [.12, .5], [.145, .52], [.145, .56], [.12, .585], [.1, .68], [.06, .74], [0, .76]], 24, { smooth: 2 }), m, [0, 0, 0], null, g);
  for (const s of [-1, 1]) { mk(new THREE.CylinderGeometry(.05, .055, .12, 14), m, [s * .15, .42, 0], [0, 0, PI / 2], g); mk(new THREE.CylinderGeometry(.06, .06, .03, 6), cap, [s * .22, .42, 0], [0, 0, PI / 2], g); }
  mk(new THREE.CylinderGeometry(.065, .07, .1, 16), m, [0, .38, .14], [PI / 2, 0, 0], g); mk(new THREE.CylinderGeometry(.075, .075, .035, 6), cap, [0, .38, .2], [PI / 2, 0, 0], g);
  mk(new THREE.CylinderGeometry(.03, .04, .06, 6), cap, [0, .78, 0], null, g);
  ink(g, .006);
  return g;
}
/** street mailbox ~1.25 m: rounded-top box on legs, slot, label (o.text 'MAIL', o.color) */
function mailbox(o) {
  const g = new THREE.Group(), c = o.color || '#2f5fb5', m = M(c, { rough: .45 }), dk = M(shade(c, -.45));
  mk(rboxUp(.52, .62, .46, .04), m, [0, .36, 0], null, g);
  const top = new THREE.CylinderGeometry(.26, .26, .46, 26, 1, false, -PI / 2, PI); top.rotateX(-PI / 2); mk(top, m, [0, .98, 0], null, g);
  mk(rbox(.26, .035, .03, .012), M('#1c2230'), [0, 1.06, .232], null, g);
  mk(rbox(.3, .07, .05, .02), dk, [0, 1.12, .245], [.35, 0, 0], g);
  for (const x of [-.22, .22]) for (const z of [-.18, .18]) mk(rboxUp(.06, .38, .06, .015), dk, [x, 0, z], null, g);
  const tex = label(o.text || 'MAIL', { bg: c, fg: '#ffffff', w: 256, h: 96 }); g.userData.screen = tex;
  mk(new THREE.PlaneGeometry(.36, .135), texMat(tex), [0, .78, .232], null, g).userData.noOutline = true;
  ink(g, .007);
  return g;
}
/** public litter bin ~.95 m: slatted body, domed lid with an opening */
function streetBin(o) {
  const g = new THREE.Group(), c = o.color || '#3f6b4a', cc = col(c), cd = col(shade(c, -.32));
  const body = lath([[.0, 0], [.26, 0], [.27, .06], [.25, .1], [.27, .78], [.29, .8], [0, .8]], 48);
  paint(body, (p) => { const a = Math.atan2(p.z, p.x); return Math.cos(a * 14) > .55 && p.y > .1 && p.y < .76 ? cd : cc; });
  mk(body, vcMat({ rough: .55, metal: .2 }), [0, 0, 0], null, g);
  mk(lath([[.3, .8], [.3, .86], [.22, .95], [0, .98]], 32, { smooth: 2 }), M(shade(c, -.15), { rough: .5 }), [0, 0, 0], null, g);
  mk(rbox(.24, .1, .06, .03), M('#1d241f'), [0, .87, .23], [-.6, 0, 0], g);
  ink(g, .007);
  return g;
}
/** traffic cone ~.7 m with white bands */
function cone(o) {
  const g = new THREE.Group(), c = o.color || '#f2701e', parts = [], H = .7, r0 = .17, r1 = .028, bands = [[.06, .22, c], [.22, .32, '#f4f1ea'], [.32, .44, c], [.44, .53, '#f4f1ea'], [.53, H, c]];
  for (const [a, b, cc] of bands) { const ra = r0 + (r1 - r0) * (a - .06) / (H - .06), rb = r0 + (r1 - r0) * (b - .06) / (H - .06), cy = new THREE.CylinderGeometry(rb, ra, b - a, 24, 1); cy.translate(0, (a + b) / 2, 0); paint(cy, (p, n) => col(cc).clone().multiplyScalar(.85 + .15 * clamp01(n.x + n.z + .5))); parts.push(cy); }
  const tip = new THREE.SphereGeometry(r1, 12, 8, 0, TAU, 0, PI / 2); tip.translate(0, H, 0); tint(tip, c); parts.push(tip);
  mk(merge(parts), vcMat({ rough: .45 }), [0, 0, 0], null, g);
  mk(rboxUp(.44, .05, .44, .02), M(shade(c, -.2)), [0, 0, 0], null, g);
  ink(g, .005);
  return g;
}
/** road barrier ~1.6 m: A-frame legs, striped planks, a warning lamp (o.lit, o.flash) */
function barrier(o) {
  const g = new THREE.Group(), stripe = texMat(stripeTex(['#e2432f', '#f7f3ea'], 10, { diag: true, w: 512, h: 128 }), { rough: .6 }), legm = M('#e9ecef', { rough: .5 });
  for (const x of [-.68, .68]) for (const s of [-1, 1]) mk(rbox(.06, 1.08, .06, .02), legm, [x, .5, s * .14], [s * .25, 0, 0], g);
  mk(rbox(1.62, .2, .05, .02), stripe, [0, .86, 0], null, g);
  mk(rbox(1.62, .16, .05, .02), stripe, [0, .46, 0], null, g);
  const lm = own('#ffb020', { emissive: '#ff9a10', ei: o.lit ? 2.4 : 0, rough: .3 });
  mk(new THREE.SphereGeometry(.07, 14, 10, 0, TAU, 0, PI / 2), lm, [-.62, .97, 0], null, g);
  if (o.flash) g.userData.update = t => { lm.emissiveIntensity = Math.sin(t * TAU * 1.2) > 0 ? 2.4 : 0; };
  ink(g, .006); g.userData.setLit = on => { lm.emissiveIntensity = on ? 2.4 : 0; };
  return g;
}
/** road sign on a pole: o.kind 'street' (two name blades, o.text / o.text2) | 'round' (o.text, e.g. '20') | 'warn' (triangle, o.text '!') | 'arrow' (o.text); userData.screen */
function roadSign(o) {
  const g = new THREE.Group(), kind = o.kind || 'street', H = o.height ?? (kind === 'street' ? 2.7 : 2.4), metal = M('#a9b0b8', { rough: .4, metal: .5 });
  mk(new THREE.CylinderGeometry(.035, .04, H, 10), metal, [0, H / 2, 0], null, g);
  mk(new THREE.SphereGeometry(.04, 10, 6, 0, TAU, 0, PI / 2), metal, [0, H, 0], null, g);
  const face = (tex, w, h, y, z, ry = 0, geo) => { const m = mk(geo || new THREE.PlaneGeometry(w, h), texMat(tex), [0, y, z], [0, ry, 0], g); m.userData.noOutline = true; return m; };
  if (kind === 'street') {
    const t1 = label(o.text || 'MAPLE ST', { bg: '#2f7a4a', fg: '#ffffff', border: '#ffffff', w: 512, h: 120 }), t2 = label(o.text2 || 'OAK AVE', { bg: '#2f7a4a', fg: '#ffffff', border: '#ffffff', w: 512, h: 120 });
    mk(rbox(1.05, .25, .035, .02), M('#2f7a4a'), [0, H - .2, 0], null, g); face(t1, 1.0, .225, H - .2, .019); face(t1, 1.0, .225, H - .2, -.019, PI);
    const b2 = new THREE.Group(); b2.rotation.y = PI / 2; b2.position.y = H - .5; g.add(b2);
    mk(rbox(1.05, .25, .035, .02), M('#2f7a4a'), [0, 0, 0], null, b2);
    for (const [z, ry] of [[.019, 0], [-.019, PI]]) mk(new THREE.PlaneGeometry(1.0, .225), texMat(t2), [0, 0, z], [0, ry, 0], b2).userData.noOutline = true;
    g.userData.screen = t1;
  } else if (kind === 'round') {
    const t = canvasTex(256, 256, (x, W) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, W); x.strokeStyle = '#d8342c'; x.lineWidth = 30; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 18, 0, TAU); x.stroke(); x.fillStyle = '#1a1a1a'; fitText(x, o.text || '20', W / 2, W / 2, W * .55, W * .42); });
    mk(new THREE.CylinderGeometry(.33, .33, .035, 36), metal, [0, H - .3, -.02], [PI / 2, 0, 0], g);
    face(t, 0, 0, H - .3, .0, 0, new THREE.CircleGeometry(.32, 36)); g.userData.screen = t;
  } else if (kind === 'warn') {
    mk(slab([[-.38, -.32], [.38, -.32], [0, .34]], .025, .03), M('#d8342c', { rough: .5 }), [0, H - .35, -.01], null, g);
    const tri = new THREE.ShapeGeometry(new THREE.Shape([[-.27, -.24], [.27, -.24], [0, .22]].map(([x, y]) => new THREE.Vector2(x, y))));
    mk(tri, M('#ffffff'), [0, H - .35, .036], null, g).userData.noOutline = true;
    const t = label(o.text || '!', { bg: '#ffffff', fg: '#1a1a1a', w: 128, h: 128, size: .8 }); face(t, .16, .16, H - .42, .04); g.userData.screen = t;
  } else {
    const t = label(o.text || 'BEACH', { bg: '#2f6fb0', fg: '#ffffff', w: 512, h: 140, fit: .62, draw: (x, W, Hh) => { x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(W * .96, Hh / 2); x.lineTo(W * .84, Hh * .18); x.lineTo(W * .84, Hh * .36); x.lineTo(W * .72, Hh * .36); x.lineTo(W * .72, Hh * .64); x.lineTo(W * .84, Hh * .64); x.lineTo(W * .84, Hh * .82); x.closePath(); x.fill(); } });
    mk(rbox(1.0, .28, .035, .02), M('#2f6fb0'), [.35, H - .25, 0], null, g);
    mk(new THREE.PlaneGeometry(.96, .26), texMat(t), [.35, H - .25, .019], null, g).userData.noOutline = true; g.userData.screen = t;
  }
  ink(g, .006); g.userData.footprint = { r: .06 };
  return g;
}
/** traffic light ~3.4 m: yellow backboard, three lamps; o.state 'red' | 'yellow' | 'green' (userData.setState) */
function trafficLight(o) {
  const g = new THREE.Group(), H = 2.55, pm = M('#3b4148', { rough: .45, metal: .3 }), lamps = {};
  mk(lath([[.09, 0], [.08, .1], [.055, .15], [.05, H], [0, H]], 14), pm, [0, 0, 0], null, g);
  mk(rboxUp(.5, 1.1, .03, .05), M('#f2c230'), [0, H - .05, -.15], null, g);
  mk(rboxUp(.34, .96, .26, .07), M('#2b2f36', { rough: .5 }), [0, H, 0], null, g);
  const cols = { red: '#ff3b30', yellow: '#ffc21a', green: '#2fd16a' };
  ['red', 'yellow', 'green'].forEach((k, i) => {
    const y = H + .8 - i * .3, m = own(shade(cols[k], -.55), { rough: .25 });
    lamps[k] = { m, c: cols[k] }; mk(new THREE.CylinderGeometry(.1, .1, .04, 24), m, [0, y, .13], [PI / 2, 0, 0], g);
    mk(rbox(.26, .025, .13, .01), M('#22262c'), [0, y + .12, .2], [.25, 0, 0], g);
  });
  const set = s => { for (const k in lamps) { const L = lamps[k]; const on = k === s; L.m.color.set(on ? L.c : shade(L.c, -.55)); L.m.emissive.set(on ? L.c : '#000000'); L.m.emissiveIntensity = on ? 2.6 : 1; } };
  set(o.state || 'red');
  ink(g, .007); Object.assign(g.userData, { setState: set, footprint: { r: .1 } });
  return g;
}
function posterTex(o = {}) {
  return canvasTex(256, 384, (x, W, H) => {
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, o.c1 || '#ff8a3a'); gr.addColorStop(1, o.c2 || '#e8406a'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(W / 2, H * .42, W * .26, 0, TAU); x.fill();
    x.fillStyle = o.c2 || '#e8406a'; x.beginPath(); x.ellipse(W / 2, H * .42, W * .09, W * .17, 0, 0, TAU); x.fill();
    x.fillStyle = '#ffffff'; fitText(x, o.title || 'BUBBLO', W / 2, H * .13, W * .86, H * .1); x.font = FONT(600, H * .05); x.fillText(o.sub || 'so very fizzy', W / 2, H * .78);
  });
}
/** bus stop shelter ~3.2 m: roof, glass back, lit ad poster (o.lit), bench (seat), BUS sign (o.text) */
function busStop(o) {
  const g = new THREE.Group(), W = 3.2, D = 1.35, Hh = 2.4, fc = o.color || '#2f6fb0', fm = M(fc, { rough: .45, metal: .25 });
  for (const x of [-W / 2 + .05, W / 2 - .05]) for (const z of [-D / 2 + .06, D / 2 - .1]) mk(rboxUp(.08, Hh, .08, .02), fm, [x, 0, z], null, g);
  mk(rbox(W + .3, .12, D + .3, .05), fm, [0, Hh + .06, 0], null, g);
  mk(rbox(W + .32, .05, D + .32, .02), M('#f2f2ee'), [0, Hh + .01, 0], null, g);
  noShadow(mk(new THREE.BoxGeometry(W * .62, Hh - .55, .03), M('#cfe8f5', { rough: .1, transparent: true, opacity: .32 }), [-W * .17, .35 + (Hh - .55) / 2, -D / 2 + .06], null, g));
  for (const y of [.33, Hh - .17]) mk(rbox(W - .1, .06, .06, .02), fm, [0, y, -D / 2 + .06], null, g);
  const pt = posterTex(o.poster), pm = own('#ffffff', { map: pt, rough: .5 }); if (o.lit) { pm.emissive.set('#ffffff'); pm.emissiveMap = pt; pm.emissiveIntensity = 1.3; }
  mk(rboxUp(.95, 1.6, .12, .03), fm, [W / 2 - .58, .36, -D / 2 + .06], null, g);
  mk(new THREE.PlaneGeometry(.82, 1.23), pm, [W / 2 - .58, 1.16, -D / 2 + .125], null, g).userData.noOutline = true;
  for (let i = 0; i < 3; i++) mk(rbox(1.6, .045, .12, .015), M('#c9ced4', { metal: .4, rough: .4 }), [-.55, .46, -D / 2 + .25 + i * .14], null, g);
  for (const x of [-1.2, .1]) mk(rboxUp(.05, .44, .3, .015), fm, [x, 0, -D / 2 + .39], null, g);
  const px = W / 2 + .4; mk(new THREE.CylinderGeometry(.04, .04, 2.75, 10), M('#a9b0b8', { metal: .5, rough: .4 }), [px, 1.375, D / 2 - .1], null, g);
  const t = label(o.text || 'BUS', { bg: fc, fg: '#ffffff', w: 256, h: 256, size: .42 });
  mk(new THREE.CylinderGeometry(.26, .26, .04, 32), fm, [px, 2.6, D / 2 - .1], [PI / 2, 0, 0], g);
  mk(new THREE.CircleGeometry(.23, 32), texMat(t), [px, 2.6, D / 2 - .077], null, g).userData.noOutline = true;
  mk(rbox(.3, .42, .05, .02), M('#f2f2ee'), [px, 1.5, D / 2 - .1], null, g);
  ink(g, .01);
  Object.assign(g.userData, { seat: .48, screen: t, footprint: { w: W, d: D }, setLit: on => { pm.emissive.set(on ? '#ffffff' : '#000000'); pm.emissiveMap = on ? pt : null; pm.emissiveIntensity = on ? 1.3 : 1; pm.needsUpdate = true; } });
  return g;
}
/** phone booth ~2.45 m: glass panes, glazing bars, lit PHONE sign (o.lit, o.text), o.color */
function phoneBooth(o) {
  const g = new THREE.Group(), c = o.color || '#d8342c', m = M(c, { rough: .45 }), W = 1.0, H = 2.2;
  mk(rboxUp(W + .1, .12, W + .1, .03), m, [0, 0, 0], null, g);
  for (const x of [-1, 1]) for (const z of [-1, 1]) mk(rboxUp(.1, H, .1, .03), m, [x * W / 2, .1, z * W / 2], null, g);
  mk(rboxUp(W + .16, .22, W + .16, .05), m, [0, H + .08, 0], null, g);
  mk(lath([[.82, 0], [.62, .08], [.17, .14], [0, .15]], 4, { phi0: PI / 4 }), m, [0, H + .3, 0], null, g);
  const gm = M('#cfe8f5', { rough: .1, transparent: true, opacity: .3 });
  for (const [x, z, ry] of [[0, W / 2, 0], [0, -W / 2, 0], [W / 2, 0, PI / 2], [-W / 2, 0, PI / 2]]) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
    noShadow(mk(new THREE.BoxGeometry(W - .1, H - .3, .02), gm, [0, .25 + (H - .3) / 2, 0], null, p));
    for (let i = 0; i < 6; i++) mk(rbox(W - .08, .04, .05, .012), m, [0, .3 + i * (H - .4) / 5, 0], null, p);
    mk(rbox(.04, H - .3, .05, .012), m, [0, .25 + (H - .3) / 2, 0], null, p);
  }
  mk(rbox(.06, .16, .04, .015), M('#c9ced4', { metal: .5 }), [.32, 1.1, W / 2 + .04], null, g);
  mk(rbox(.26, .38, .14, .03), M('#2b2f36'), [0, 1.3, -W / 2 + .12], null, g);
  mk(rbox(.06, .2, .06, .02), M('#1c1f24'), [.1, 1.32, -W / 2 + .21], null, g);
  const t = label(o.text || 'PHONE', { bg: '#1c1f24', fg: '#ffffff', w: 384, h: 96 }), sm2 = own('#ffffff', { map: t, rough: .5 });
  const setLit = on => { sm2.emissive.set(on ? '#ffffff' : '#000000'); sm2.emissiveMap = on ? t : null; sm2.emissiveIntensity = 1.5; sm2.needsUpdate = true; }; setLit(!!o.lit);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2, p = mk(new THREE.PlaneGeometry(.8, .17), sm2, [Math.sin(a) * (W / 2 + .085), H + .19, Math.cos(a) * (W / 2 + .085)], [0, a, 0], g); p.userData.noOutline = true; }
  ink(g, .009); Object.assign(g.userData, { screen: t, setLit, footprint: { w: W, d: W } });
  return g;
}
/** wooden post-and-rail fence along x (o.length 4.8, o.color) */
function fence(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), L = o.length ?? 4.8, wood = o.color || '#a0703f', H = 1.05, n = Math.max(2, Math.round(L / 1.6) + 1), posts = [], rails = [];
  for (let i = 0; i < n; i++) { const p = rboxUp(.13, H + .08, .13, .04); p.rotateZ(range(R, -.03, .03)); p.translate(-L / 2 + i * L / (n - 1), 0, 0); paint(p, () => col(shade(wood, range(R, -.12, .05)))); posts.push(p); }
  for (const y of [.4, .82]) { const r = rbox(L + .1, .11, .05, .02); r.translate(0, y, .08); paint(r, () => col(shade(wood, .06))); rails.push(r); }
  mk(merge(posts), vcMat({ rough: .85 }), [0, 0, 0], null, g); mk(merge(rails), vcMat({ rough: .85 }), [0, 0, 0], null, g);
  ink(g, .007); g.userData.footprint = { w: L, d: .2 };
  return g;
}
const PICKET = [[-.045, 0], [.045, 0], [.045, .84], [0, .94], [-.045, .84]];
/** white picket fence along x (o.length 3, o.color) */
function picketFence(o) {
  const g = new THREE.Group(), L = o.length ?? 3, c = o.color || '#f7f3ea', pk = [], n = Math.max(2, Math.round(L / .17));
  for (let i = 0; i < n; i++) { const p = slab(PICKET, .03, .008, { bs: 2 }); p.translate(-L / 2 + .085 + i * (L - .17) / (n - 1), 0, 0); pk.push(p); }
  mk(tint(merge(pk), c), vcMat({ rough: .7 }), [0, 0, 0], null, g);
  for (const y of [.25, .68]) mk(rbox(L, .07, .03, .012), M(shade(c, -.08)), [0, y, -.035], null, g);
  ink(g, .005); g.userData.footprint = { w: L, d: .1 };
  return g;
}
/** garden gate between two posts; userData.door = the hinge group (rotation.y opens it), o.open 0..1 */
function gate(o) {
  const g = new THREE.Group(), c = o.color || '#f7f3ea', pm = M(shade(c, -.05), { rough: .7 });
  for (const x of [-.68, .68]) { mk(rboxUp(.16, 1.25, .16, .04), pm, [x, 0, 0], null, g); mk(new THREE.SphereGeometry(.1, 14, 10), pm, [x, 1.32, 0], null, g); }
  const door = new THREE.Group(); door.position.set(-.6, 0, 0); g.add(door);
  const pk = []; for (let i = 0; i < 7; i++) { const p = slab(PICKET, .03, .008, { bs: 2 }); p.translate(.09 + i * .17, .05, 0); pk.push(p); }
  mk(tint(merge(pk), c), vcMat({ rough: .7 }), [0, 0, 0], null, door);
  for (const y of [.3, .75]) mk(rbox(1.18, .07, .03, .012), M(shade(c, -.08)), [.6, y, -.035], null, door);
  mk(rbox(.06, .62, .03, .012), M(shade(c, -.08)), [.6, .52, -.04], [0, 0, -.88], door);
  door.rotation.y = (o.open ?? 0) * 1.9;
  ink(g, .006); Object.assign(g.userData, { door, footprint: { w: 1.5, d: .2 } });
  return g;
}
/** manhole cover (flat, solid false) */
function manhole(o) {
  const g = new THREE.Group(), t = canvasTex(256, 256, (x, W) => { x.fillStyle = '#3d4044'; x.fillRect(0, 0, W, W); x.strokeStyle = '#2a2c30'; x.lineWidth = 10; x.beginPath(); x.arc(W / 2, W / 2, W * .44, 0, TAU); x.stroke(); x.lineWidth = 7; for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(W / 2 + i * 28, 30); x.lineTo(W / 2 + i * 28, W - 30); x.stroke(); x.beginPath(); x.moveTo(30, W / 2 + i * 28); x.lineTo(W - 30, W / 2 + i * 28); x.stroke(); } });
  mk(new THREE.CylinderGeometry(.42, .44, .025, 36), [M('#2f3236'), texMat(t, { rough: .6 }), M('#2f3236')], [0, .0125, 0], null, g);
  ink(g, .004); g.userData.solid = false;
  return g;
}
/** zebra crossing decal: stripes along x across a road o.width wide (z), o.length stripe length */
function crosswalk(o) {
  const g = new THREE.Group(), Wd = o.width ?? 6, L = o.length ?? 2.6, n = Math.max(2, Math.floor(Wd / 1)), parts = [];
  for (let i = 0; i < n; i++) { const b = rbox(L, .012, .5, .004, 1); b.translate(0, .027, -Wd / 2 + .5 + i * (Wd - 1) / (n - 1)); parts.push(b); }
  noInk(mk(tint(merge(parts), '#f4f2ea'), vcMat({ rough: .7 }), [0, 0, 0], null, g)); g.userData.solid = false;
  return g;
}
function brickTex(base = '#b5553a', seed = 2) {
  const R = rnd(seed);
  return canvasTex(512, 512, (x, W, H) => { x.fillStyle = '#d6c8b0'; x.fillRect(0, 0, W, H); const rows = 8, bw = W / 4, bh = H / rows; for (let r = 0; r < rows; r++) for (let c = -1; c < 5; c++) { const off = r % 2 ? bw / 2 : 0; x.fillStyle = shade(base, (R() - .5) * .2); rr(x, c * bw + off + 5, r * bh + 5, bw - 10, bh - 10, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(c * bw + off + 10, r * bh + 8, bw - 20, 6); } });
}
/** brick wall along x (o.length 4, o.height 1.2) with a coping (top; seat when low), o.color brick */
function brickWall(o) {
  const g = new THREE.Group(), L = o.length ?? 4, H = o.height ?? 1.2, T = .32, t = brickTex(o.color || '#b5553a', o.seed ?? 2);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(L / 1.0, H / .5);
  mk(rboxUp(L, H, T, .02, 1), texMat(t, { rough: .9 }), [0, 0, 0], null, g);
  mk(rbox(L + .06, .08, T + .08, .02), M('#c9c2b4'), [0, H + .04, 0], null, g);
  ink(g, .01); Object.assign(g.userData, { top: H + .08, footprint: { w: L, d: T } }); if (H < .7) g.userData.seat = H + .08;
  return g;
}
/** a straight road along x: asphalt with lane lines, curbs, optional sidewalks (o.length 20, o.width 7, o.sidewalk m) */
function road(o) {
  const g = new THREE.Group(), L = o.length ?? 20, Wd = o.width ?? 7, sw = o.sidewalk ?? 0, R = rnd(o.seed ?? 3);
  const H = Math.max(64, Math.round(1024 * Wd / L / 4) * 4), t = canvasTex(1024, H, (x, W, Hh) => {
    const ppm = W / L; x.fillStyle = '#4a4c52'; x.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 2500; i++) { x.fillStyle = shade('#4a4c52', (R() - .5) * .25); x.fillRect(R() * W, R() * Hh, 2, 2); }
    x.fillStyle = '#eeeeea'; x.fillRect(0, .3 * ppm, W, .12 * ppm); x.fillRect(0, Hh - .42 * ppm, W, .12 * ppm);
    x.fillStyle = o.center || '#f2c230'; for (let s = 0; s < L; s += 6) x.fillRect(s * ppm, Hh / 2 - .07 * ppm, 3 * ppm, .14 * ppm);
  });
  noInk(mk(rbox(L, .02, Wd, .005, 1), texMat(t, { rough: .85 }), [0, .01, 0], null, g));
  for (const s of [-1, 1]) {
    mk(rbox(L, .15, .22, .03, 2), M('#b9b5aa'), [0, .075, s * (Wd / 2 + .11)], null, g);
    if (sw > 0) { const st = canvasTex(256, 256, (x, W) => { x.fillStyle = '#c9c4b8'; x.fillRect(0, 0, W, W); x.strokeStyle = '#a9a498'; x.lineWidth = 4; x.strokeRect(2, 2, W - 4, W - 4); }); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(L / 1.2, sw / 1.2); mk(rbox(L, .14, sw, .02, 1), texMat(st, { rough: .9 }), [0, .07, s * (Wd / 2 + .22 + sw / 2)], null, g); }
  }
  ink(g, .006); Object.assign(g.userData, { solid: false, screen: t, sidewalkY: sw > 0 ? .14 : 0 });
  return g;
}

// ================================================================ BUILDINGS
const WALLS = ['#c96f4a', '#d9b26a', '#8fa6b8', '#b8c48a', '#e0d4c0', '#9d7aa8', '#d98a7a', '#7fb0a0'];
const SHOP_NAMES = ['BUN & BEAN', "PIP'S GROCER", 'MOON MART', 'TOOT TOYS', 'NOODLE NOOK', 'LUCKY LOAF', 'PAGE & PINE', 'FIZZ & CO', 'TINY TEA', 'SPROCKET BIKES'];
/** windows for a wall wm x hm metres: floors from y0, cols per floor; each { x, y (bottom), w, h, lit } */
function windowGrid(R, wm, o) {
  const out = [], cols = o.cols ?? Math.max(1, Math.round(wm / (o.pitch ?? 2.4))), fh = o.fh ?? 3, ww = o.ww ?? 1.05, wh = o.wh ?? 1.45;
  for (let f = 0; f < o.floors; f++) for (let c = 0; c < cols; c++) out.push({ x: (c + .5) * wm / cols - ww / 2, y: (o.y0 ?? .5) + f * fh + (fh - wh) * .45, w: ww, h: wh, lit: !!o.lit && R() < (o.litP ?? .55), warm: R() < .8 });
  return out;
}
/** a facade canvas: wall colour, floor bands, framed windows (dark glass with a sky glint, or lit warm with curtains). map + emi */
function facadeTex(wm, hm, wins, o = {}) {
  const ppm = Math.min(56, 2048 / Math.max(wm, hm)), W = Math.max(16, Math.round(wm * ppm)), H = Math.max(16, Math.round(hm * ppm)), R = rnd(o.seed ?? 4), base = o.color || '#d9b26a';
  const draw = (x, emi) => {
    x.fillStyle = emi ? '#000000' : base; x.fillRect(0, 0, W, H);
    if (!emi) {
      for (let i = 0; i < W * H / 60; i++) { x.fillStyle = shade(base, (R() - .5) * .08); x.fillRect(R() * W, R() * H, 2, 2); }
      if (o.fh) for (let y = (o.y0 ?? .5) + o.fh - .15; y < hm - .5; y += o.fh) { x.fillStyle = shade(base, -.1); x.fillRect(0, H - y * ppm, W, .12 * ppm); }
      if (o.plinth) { x.fillStyle = shade(base, -.25); x.fillRect(0, H - o.plinth * ppm, W, o.plinth * ppm); }
    }
    for (const w of wins) {
      const X = w.x * ppm, Y = H - (w.y + w.h) * ppm, ww = w.w * ppm, hh = w.h * ppm, fr = .09 * ppm;
      if (!emi) { x.fillStyle = o.frame || '#f6f1e6'; x.fillRect(X - fr, Y - fr, ww + fr * 2, hh + fr * 2); }
      if (w.lit) {
        const gr = x.createLinearGradient(0, Y, 0, Y + hh); gr.addColorStop(0, w.warm ? '#ffe9a8' : '#e8f4ff'); gr.addColorStop(1, w.warm ? '#ffb85a' : '#9fd0ff'); x.fillStyle = gr; x.fillRect(X, Y, ww, hh);
        if (!emi || true) { x.fillStyle = emi ? 'rgba(0,0,0,.55)' : 'rgba(150,60,40,.45)'; x.fillRect(X, Y, ww * .22, hh); x.fillRect(X + ww * .78, Y, ww * .22, hh); }
      } else if (!emi) {
        const gr = x.createLinearGradient(X, Y, X + ww, Y + hh); gr.addColorStop(0, '#5f86b0'); gr.addColorStop(.5, '#34496b'); gr.addColorStop(1, '#26354f'); x.fillStyle = gr; x.fillRect(X, Y, ww, hh);
        x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.moveTo(X + ww * .15, Y + hh); x.lineTo(X + ww * .55, Y); x.lineTo(X + ww * .7, Y); x.lineTo(X + ww * .3, Y + hh); x.fill();
      } else continue;
      if (!emi) { x.fillStyle = o.frame || '#f6f1e6'; x.fillRect(X + ww / 2 - fr * .4, Y, fr * .8, hh); x.fillRect(X, Y + hh * .45, ww, fr * .8); }
    }
  };
  const map = canvasTex(W, H, x => draw(x, false)), emi = wins.some(w => w.lit) ? canvasTex(W, H, x => draw(x, true)) : null;
  return { map, emi };
}
const litMat = (f, on, glow = 1) => { const m = texMat(f.map, { rough: .85 }); if (f.emi) { m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = f.emi; m.emissiveIntensity = on ? glow : 0; } return m; };
/** apartment block: o.floors (4-7 by seed), o.w, o.d, o.color, o.lit (random lit windows), balconies, rooftop tank */
function apartment(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), floors = o.floors ?? 4 + Math.floor(R() * 4), fh = 3, W = o.w ?? pick(R, [8, 9, 10]), D = o.d ?? 8, H = floors * fh + .8;
  const c = o.color || pick(R, WALLS), lit = !!o.lit;
  const fw = windowGrid(R, W, { floors, fh, lit, y0: .5 }).filter(w => !(w.y < 1 && Math.abs(w.x + w.w / 2 - W / 2) < 1.3)), sw = windowGrid(R, D, { floors, fh, lit, y0: .5 });
  const ff = facadeTex(W, H, fw, { color: c, fh, seed: (o.seed ?? 1) * 7, plinth: .5 }), sf = facadeTex(D, H, sw, { color: c, fh, seed: (o.seed ?? 1) * 7 + 3, plinth: .5 });
  const fm = litMat(ff, lit), sm2 = litMat(sf, lit), rm = M(shade(c, -.35));
  mk(rboxUp(W, H, D, .08, 2), [sm2, sm2, rm, rm, fm, fm], [0, 0, 0], null, g);
  const sills = []; for (const w of fw) { const s = rbox(w.w + .25, .08, .16, .03, 2); s.translate(-W / 2 + w.x + w.w / 2, w.y - .06, D / 2 + .06); sills.push(s); }
  mk(tint(merge(sills), shade(c, .25)), vcMat(), [0, 0, 0], null, g);
  mk(rboxUp(1.7, 2.4, .14, .03), M('#3a3f48'), [0, 0, D / 2 + .02], null, g);
  mk(rboxUp(1.4, 2.2, .06, .02), glass(), [0, .05, D / 2 + .09], null, g);
  mk(rbox(2.3, .12, 1.1, .04), M(shade(c, -.4)), [0, 2.65, D / 2 + .5], null, g);
  if (o.balconies ?? R() < .6) { const bal = []; for (const w of fw) if (w.y > 2 && Math.round(w.x) % 2 === 0) { const b = rbox(w.w + .6, .12, .8, .03, 2); b.translate(-W / 2 + w.x + w.w / 2, w.y - .12, D / 2 + .4); bal.push(b); const r = rbox(w.w + .6, .55, .05, .02, 2); r.translate(-W / 2 + w.x + w.w / 2, w.y + .17, D / 2 + .78); bal.push(r); } if (bal.length) mk(tint(merge(bal), shade(c, -.2)), vcMat(), [0, 0, 0], null, g); }
  const par = M(shade(c, -.15)); for (const [x, z, w, d] of [[0, D / 2 - .12, W, .25], [0, -D / 2 + .12, W, .25], [W / 2 - .12, 0, .25, D], [-W / 2 + .12, 0, .25, D]]) mk(rboxUp(w, .5, d, .05), par, [x, H, z], null, g);
  if (R() < .7) { const tx = range(R, -W * .25, W * .25); mk(new THREE.CylinderGeometry(.7, .7, 1.3, 20), M('#8a9099', { metal: .3 }), [tx, H + 1.55, -D * .2], null, g); for (const dx of [-.45, .45]) for (const dz of [-.45, .45]) mk(rboxUp(.08, .9, .08, .02), M('#5a6068'), [tx + dx, H, -D * .2 + dz], null, g); }
  for (let i = 0; i < 2; i++) mk(rboxUp(.8, .5, .6, .06), M('#c9ced4'), [range(R, -W * .3, W * .3), H, range(R, 0, D * .3)], null, g);
  ink(g, .02);
  Object.assign(g.userData, { top: H, footprint: { w: W, d: D }, setLit: on => { for (const m of [fm, sm2]) if (m.emissiveMap) m.emissiveIntensity = on ? 1 : 0; } });
  return g;
}
/** glass skyscraper 30-60 m in 2-3 setback tiers with a spire (o.height, o.w, o.color glass tint, o.lit offices) */
function skyscraper(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), H = o.height ?? range(R, 30, 60), W = o.w ?? range(R, 10, 14), tiers = o.tiers ?? (R() < .5 ? 2 : 3), c = o.color || pick(R, ['#6f8fb0', '#5a7a9a', '#7d94b4', '#4a6a8a', '#8aa8b8']), lit = !!o.lit, mats = [];
  let y = 0;
  for (let i = 0; i < tiers; i++) {
    const w = W * (1 - i * .24), h = i === tiers - 1 ? H - y : H * (tiers === 2 ? .68 : i === 0 ? .5 : .3), floors = Math.max(1, Math.round(h / 3.6)), cols = Math.max(2, Math.round(w / 1.6));
    const t = canvasTex(Math.min(1024, cols * 24), Math.min(2048, floors * 24), (x, Wc, Hc) => {
      const gr = x.createLinearGradient(0, 0, 0, Hc); gr.addColorStop(0, shade(c, .35)); gr.addColorStop(1, shade(c, -.15)); x.fillStyle = gr; x.fillRect(0, 0, Wc, Hc);
      const cw = Wc / cols, fh2 = Hc / floors; x.fillStyle = shade(c, -.45); for (let f = 0; f < floors; f++) x.fillRect(0, f * fh2, Wc, fh2 * .22);
      x.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < cols; k++) x.fillRect(k * cw, 0, cw * .08, Hc);
    });
    const e = lit ? canvasTex(Math.min(1024, cols * 24), Math.min(2048, floors * 24), (x, Wc, Hc) => { x.fillStyle = '#000'; x.fillRect(0, 0, Wc, Hc); const cw = Wc / cols, fh2 = Hc / floors; for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) if (R() < .4) { x.fillStyle = R() < .7 ? '#ffe2a0' : '#d8ecff'; x.fillRect(k * cw + cw * .1, f * fh2 + fh2 * .25, cw * .85, fh2 * .7); } }) : null;
    const m = texMat(t, { rough: .5 }); m.metalness = .08; if (e) { m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = e; m.emissiveIntensity = .9; } mats.push(m);
    const rm = M(shade(c, -.4));
    mk(rboxUp(w, h, w, .12, 2), [m, m, rm, rm, m, m], [0, y, 0], null, g);
    mk(rboxUp(w + .3, .4, w + .3, .1), M('#d8dde3'), [0, y + h - .2, 0], null, g);
    y += h;
  }
  mk(new THREE.CylinderGeometry(.12, .25, 6, 10), M('#c9ced4', { metal: .5 }), [0, y + 3, 0], null, g);
  const bm = own('#ff4a3a', { emissive: '#ff2a1a', ei: lit ? 1.5 : 0 }); mk(new THREE.SphereGeometry(.22, 12, 8), bm, [0, y + 6.1, 0], null, g);
  ink(g, .04, 1);
  Object.assign(g.userData, { top: y, footprint: { w: W, d: W }, setLit: on => { for (const m of mats) if (m.emissiveMap) m.emissiveIntensity = on ? .9 : 0; bm.emissiveIntensity = on ? 1.5 : 0; } });
  return g;
}
function sidingTex(base) { return canvasTex(256, 256, (x, W, H) => { x.fillStyle = base; x.fillRect(0, 0, W, H); for (let i = 0; i < 8; i++) { x.fillStyle = shade(base, -.12); x.fillRect(0, i * H / 8 + H / 8 - 5, W, 5); x.fillStyle = shade(base, .08); x.fillRect(0, i * H / 8, W, 3); } }); }
/** a cartoon house: siding walls, gable roof, door, shuttered windows, chimney (o.floors 1-2, o.color, o.roof, o.lit) */
function house(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), floors = o.floors ?? 2, W = o.w ?? 6.4, D = o.d ?? 5.6, fh = 2.7, Hw = floors * fh + .35;
  const c = o.color || pick(R, ['#f2d6a2', '#a8cfe0', '#f4b8a0', '#cfe0b0', '#f6f1e6', '#e8c0d8']), roofC = o.roof || pick(R, ['#b5553a', '#5a6a8a', '#7a4a3a', '#3f5a6a', '#8a3a3a']), trim = '#fbf8f0', shut = o.shutters || pick(R, ['#3f6a8a', '#2f6a4f', '#8a3a3a', '#5a4a7a']);
  const st = sidingTex(c); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(W / 2, Hw / 1.6); const wm = texMat(st, { rough: .85 });
  mk(rboxUp(W, Hw, D, .05, 2), wm, [0, 0, 0], null, g);
  mk(rboxUp(W + .12, .35, D + .12, .04), M('#9a958c'), [0, 0, 0], null, g);
  const rh = D * .42, gable = slab([[-D / 2, 0], [D / 2, 0], [0, rh]], W - .02, 0); gable.rotateY(PI / 2); gable.translate(0, Hw, 0); mk(gable, M(c, { rough: .85 }), [0, 0, 0], null, g);
  const ang = Math.atan2(rh, D / 2), plen = Math.hypot(D / 2, rh) + .55, rm = M(roofC, { rough: .7 }), sn = Math.sin(ang), cs = Math.cos(ang);
  for (const s of [-1, 1]) mk(rbox(W + .5, .16, plen, .05, 2), rm, [0, Hw + rh / 2 - .2 * sn + .08 * cs, s * (D / 4 + .2 * cs + .08 * sn)], [s * ang, 0, 0], g);
  mk(new THREE.CylinderGeometry(.11, .11, W + .55, 12), M(shade(roofC, -.2)), [0, Hw + rh + .07, 0], [0, 0, PI / 2], g);
  mk(rboxUp(.6, 2.7, .6, .05), texMat(brickTex('#a8503a', 5), { rough: .9 }), [W * .28, Hw + rh * .25, -D * .12], null, g);
  mk(rbox(.72, .12, .72, .04), M('#6a6058'), [W * .28, Hw + rh * .25 + 2.72, -D * .12], null, g);
  const gm = own('#34496b', { rough: .16, metal: .15 }), lit = !!o.lit;
  const setLit = on => { gm.color.set(on ? '#ffe2a0' : '#34496b'); gm.emissive.set(on ? '#ffc46a' : '#000000'); gm.emissiveIntensity = on ? 1.6 : 1; };
  setLit(lit);
  const win = (x, y, face, w = 1.05, h = 1.3) => {
    const p = new THREE.Group(); p.position.set(face === 'f' ? x : face === 'l' ? -W / 2 : W / 2, y, face === 'f' ? D / 2 : x); if (face !== 'f') p.rotation.y = face === 'l' ? -PI / 2 : PI / 2; g.add(p);
    mk(rbox(w + .16, h + .16, .1, .03), M(trim), [0, 0, .02], null, p); mk(rbox(w, h, .06, .02), gm, [0, 0, .05], null, p);
    mk(rbox(.05, h, .05, .015), M(trim), [0, 0, .09], null, p); mk(rbox(w, .05, .05, .015), M(trim), [0, h * .1, .09], null, p);
    mk(rbox(w + .3, .07, .2, .025), M(trim), [0, -h / 2 - .1, .08], null, p);
    for (const s of [-1, 1]) mk(rbox(w * .42, h + .1, .05, .02), M(shut), [s * (w / 2 + w * .26), 0, .04], null, p);
  };
  const dx = -W * .2;
  mk(rboxUp(1.25, 2.3, .12, .03), M(trim), [dx, .3, D / 2 + .01], null, g);
  mk(rboxUp(1.0, 2.1, .1, .03), M(o.door || pick(R, ['#b5553a', '#2f6a4f', '#3f5a8a', '#e2b84a'])), [dx, .3, D / 2 + .04], null, g);
  mk(new THREE.SphereGeometry(.05, 10, 8), M('#e9b44c', { metal: .6, rough: .3 }), [dx + .35, 1.35, D / 2 + .12], null, g);
  mk(rboxUp(1.6, .3, .7, .04), M('#9a958c'), [dx, 0, D / 2 + .35], null, g);
  mk(rbox(1.7, .1, .7, .03), M(roofC), [dx, 2.75, D / 2 + .32], [-.15, 0, 0], g);
  win(W * .23, 1.6, 'f', 1.3);
  if (floors > 1) { win(-W * .23, fh + 1.55, 'f'); win(W * .23, fh + 1.55, 'f'); }
  for (const f of ['l', 'r']) for (let k = 0; k < floors; k++) win(0, 1.6 + k * fh, f);
  ink(g, .02);
  Object.assign(g.userData, { top: Hw, footprint: { w: W, d: D }, setLit });
  return g;
}
function shopInteriorTex(R, accent) {
  return canvasTex(512, 256, (x, W, H) => {
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#fff2d0'); gr.addColorStop(1, '#e8c890'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    for (let s = 0; s < 3; s++) { const y = 40 + s * 70; x.fillStyle = '#8a5a36'; x.fillRect(0, y + 44, W, 8); for (let i = 0; i < 14; i++) { x.fillStyle = pick(R, ['#e2432f', '#2f7fd1', '#f2a53a', '#2fa59a', '#e86fa0', '#7a4fc4', '#f6c945', accent]); const w = 18 + R() * 16, h = 22 + R() * 20; rr(x, 8 + i * 36, y + 44 - h, w, h, 4); x.fill(); } }
    x.fillStyle = shade(accent, -.2); x.fillRect(W * .55, H - 60, W * .4, 60); x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.moveTo(W * .1, H); x.lineTo(W * .4, 0); x.lineTo(W * .5, 0); x.lineTo(W * .2, H); x.fill();
  });
}
/** shop front: display window with goods, door, striped awning, sign board (o.text, o.color wall, o.accent, o.floors upper floors, o.lit) */
function shop(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), W = o.w ?? 5.2, D = o.d ?? 5, H1 = 3.7, up = o.floors ?? 1, fh = 3, H = H1 + up * fh + .4;
  const c = o.color || pick(R, WALLS), accent = o.accent || pick(R, BRIGHT), name = o.text || pick(R, SHOP_NAMES), lit = !!o.lit;
  const fw = windowGrid(R, W, { floors: up, fh, lit, y0: H1, pitch: 2.2 }), sw = windowGrid(R, D, { floors: up, fh, lit, y0: H1 });
  const ff = facadeTex(W, H, fw, { color: c, fh, y0: H1, seed: (o.seed ?? 1) * 5 }), sf = facadeTex(D, H, sw, { color: c, fh, y0: H1, seed: (o.seed ?? 1) * 5 + 2, plinth: .4 });
  const fm = litMat(ff, lit), sm2 = litMat(sf, lit), rm = M(shade(c, -.35));
  mk(rboxUp(W, H, D, .06, 2), [sm2, sm2, rm, rm, fm, fm], [0, 0, 0], null, g);
  const dk = M(shade(accent, -.45), { rough: .6 }), z0 = D / 2;
  mk(rboxUp(W - .25, H1 - .2, .14, .04), dk, [0, 0, z0 + .02], null, g);
  const it = shopInteriorTex(R, accent), im = own('#ffffff', { map: it, rough: .3 });
  const setInt = on => { im.emissive.set(on ? '#ffffff' : '#000000'); im.emissiveMap = on ? it : null; im.emissiveIntensity = on ? 1.1 : 1; im.needsUpdate = true; };
  const wx = -W * .14, ww = W * .55;
  mk(rboxUp(ww + .1, .6, .24, .03), M(accent), [wx, 0, z0 + .1], null, g);
  mk(new THREE.PlaneGeometry(ww, 2.2), im, [wx, 1.75, z0 + .1], null, g).userData.noOutline = true;
  for (const x of [-ww / 2, 0, ww / 2]) mk(rbox(.07, 2.3, .07, .02), M(shade(accent, -.2)), [wx + x, 1.75, z0 + .13], null, g);
  mk(rbox(ww + .1, .08, .1, .02), M(shade(accent, -.2)), [wx, 2.86, z0 + .14], null, g);
  const dxp = W * .3;
  mk(rboxUp(1.15, 2.4, .1, .03), M(shade(accent, -.2)), [dxp, 0, z0 + .1], null, g);
  const dg = own('#34496b', { rough: .16, metal: .15 });
  mk(rboxUp(.95, 2.25, .06, .02), dg, [dxp, .02, z0 + .14], null, g);
  const ot = label('OPEN', { bg: '#fbf6ea', fg: '#e2432f', w: 256, h: 96, border: '#e2432f', bw: 6 });
  mk(new THREE.PlaneGeometry(.42, .16), texMat(ot), [dxp, 1.55, z0 + .175], null, g).userData.noOutline = true;
  mk(rbox(.04, .5, .04, .015), M('#e9b44c', { metal: .6 }), [dxp - .35, 1.15, z0 + .2], null, g);
  const aw = new THREE.Group(); aw.position.set(0, H1 - .15, z0 + .1); aw.rotation.x = .38; g.add(aw);
  const at = stripeTex([accent, '#fbf6ea'], 10, { w: 512, h: 64 });
  mk(rbox(W - .3, .07, 1.25, .03, 2), texMat(at, { rough: .8 }), [0, 0, .62], null, aw);
  const sc = []; const n = Math.round((W - .3) / .32);
  for (let i = 0; i < n; i++) { const d = new THREE.CylinderGeometry(.16, .16, .05, 16, 1, false, PI / 2, PI); d.rotateX(-PI / 2); d.translate(-(W - .3) / 2 + .16 + i * (W - .3 - .32) / (n - 1), -.01, 1.25); tint(d, i % 2 ? '#fbf6ea' : accent); sc.push(d); }
  mk(merge(sc), vcMat({ rough: .8 }), [0, 0, 0], null, aw);
  const tex = label(name, { bg: '#fbf6ea', fg: shade(accent, -.35), w: 1024, h: 160, border: shade(accent, -.35), bw: 8 }), sgm = own('#ffffff', { map: tex, rough: .5 });
  const setSign = on => { sgm.emissive.set(on ? '#ffffff' : '#000000'); sgm.emissiveMap = on ? tex : null; sgm.emissiveIntensity = on ? .9 : 1; sgm.needsUpdate = true; };
  mk(rbox(W * .82, .7, .16, .05), dk, [0, H1 + .35, z0 + .1], null, g);
  mk(new THREE.PlaneGeometry(W * .78, .6), sgm, [0, H1 + .35, z0 + .185], null, g).userData.noOutline = true;
  const sills = []; for (const w of fw) { const s = rbox(w.w + .25, .08, .16, .03, 2); s.translate(-W / 2 + w.x + w.w / 2, w.y - .06, z0 + .06); sills.push(s); }
  if (sills.length) mk(tint(merge(sills), shade(c, .25)), vcMat(), [0, 0, 0], null, g);
  const par = M(shade(c, -.15)); mk(rboxUp(W + .1, .4, .3, .05), par, [0, H, z0 - .15], null, g);
  const setLit = on => { setInt(on); setSign(on); dg.color.set(on ? '#ffe2a0' : '#34496b'); dg.emissive.set(on ? '#ffc46a' : '#000000'); dg.emissiveIntensity = on ? .8 : 1; for (const m of [fm, sm2]) if (m.emissiveMap) m.emissiveIntensity = on ? 1 : 0; };
  setLit(lit);
  ink(g, .018);
  Object.assign(g.userData, { top: H, footprint: { w: W, d: D }, screen: tex, setLit });
  return g;
}

// ================================================================ VEHICLES
const CAR_COLS = ['#e2432f', '#2f7fd1', '#f2a53a', '#2fa59a', '#7a4fc4', '#f6f1e6', '#3a3f48', '#8fd0e8', '#e86fa0', '#6fbf4a'];
/** narrow the top of a geometry: x by kx, z by kz at the top (linear in height), dz shifts the top back (slanted windscreen) */
function taper(geo, kx, kz, dz = 0) {
  geo.computeBoundingBox(); const b = geo.boundingBox, P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) { const k = (P.getY(i) - b.min.y) / (b.max.y - b.min.y || 1); P.setX(i, P.getX(i) * (1 + (kx - 1) * k)); P.setZ(i, P.getZ(i) * (1 + (kz - 1) * k) - dz * k); }
  geo.computeVertexNormals(); return geo;
}
function wheel(r = .34, w = .24, hub = '#c9ced4') {
  const g = new THREE.Group(), tire = new THREE.TorusGeometry(r * .68, r * .32, 12, 26); tire.scale(1, 1, w / (r * .64));
  mk(tire, M('#2a2d33', { rough: .85 }), [0, 0, 0], null, g);
  mk(new THREE.CylinderGeometry(r * .48, r * .48, w * .78, 22), M(hub, { metal: .45, rough: .35 }), [0, 0, 0], [PI / 2, 0, 0], g);
  mk(new THREE.CylinderGeometry(r * .16, r * .18, w * .9, 10), M('#7a8089', { metal: .5 }), [0, 0, 0], [PI / 2, 0, 0], g);
  g.rotation.y = PI / 2; return g;
}
function plateTex(R) { const L = 'ABCDEFGHJKLMNPRSTUVWXYZ'; return label(`${L[Math.floor(R() * 23)]}${L[Math.floor(R() * 23)]} ${Math.floor(R() * 900 + 100)}`, { bg: '#f7f3ea', fg: '#1d2b4f', border: '#1d2b4f', w: 256, h: 72, bw: 4 }); }
/** a chunky car on wheels facing +z; returns parts so variants can dress it */
function carBase(o, v = {}) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), color = o.color || v.color || pick(R, CAR_COLS), L = v.L ?? 3.9, W = v.W ?? 1.8, wr = .35, y0 = .3, bh = .62, lit = !!o.lit;
  const bm = M(color, { rough: .3 });
  mk(rbox(W, bh, L, .22), bm, [0, y0 + bh / 2, 0], null, g);
  mk(taper(rbox(W * .84, .56, L * .52, .18), .9, .72, .12), glass(), [0, y0 + bh + .25, -L * .07], null, g);
  mk(rbox(W * .78, .08, L * .36, .035), bm, [0, y0 + bh + .54, -L * .1], null, g);
  for (const s of [-1, 1]) {
    mk(rbox(.05, .52, .14, .02), bm, [s * W * .4, y0 + bh + .25, -L * .07], null, g);
    mk(rbox(.12, .08, .07, .025), bm, [s * (W / 2 + .03), y0 + bh + .08, L * .18], null, g);
    mk(rbox(.02, .035, .14, .01), M('#c9ced4', { metal: .5 }), [s * (W / 2 + .005), y0 + .48, L * .02], null, g);
    for (const z of [-1, 1]) { const wh = wheel(wr, .26); wh.position.set(s * (W / 2 - .13), wr, z * (L / 2 - .74)); g.add(wh); }
  }
  const hl = own('#fff6d8', { emissive: '#fff2c8', ei: lit ? 2.6 : 0, rough: .2 }), tl = own('#ff3b30', { emissive: '#ff2a1a', ei: lit ? 1.6 : 0, rough: .3 });
  for (const s of [-1, 1]) { mk(new THREE.CylinderGeometry(.11, .11, .06, 18), hl, [s * W * .32, y0 + .4, L / 2 - .01], [PI / 2, 0, 0], g); mk(rbox(.26, .11, .06, .03), tl, [s * W * .33, y0 + .44, -L / 2 + .01], null, g); }
  const chrome = M('#d4d9de', { metal: .45, rough: .3 });
  for (const s of [-1, 1]) mk(rbox(W * 1.02, .15, .2, .07), chrome, [0, y0 + .07, s * (L / 2 - .02)], null, g);
  mk(rbox(W * .42, .15, .05, .03), M('#2b2f36'), [0, y0 + .32, L / 2 + .005], null, g);
  const pt = plateTex(R); for (const s of [-1, 1]) mk(new THREE.PlaneGeometry(.42, .12), texMat(pt), [0, y0 + .07, s * (L / 2 + .085)], [0, s > 0 ? 0 : PI, 0], g).userData.noOutline = true;
  const lights = [hl, tl];
  const setLit = on => { hl.emissiveIntensity = on ? 2.6 : 0; tl.emissiveIntensity = on ? 1.6 : 0; };
  Object.assign(g.userData, { top: y0 + bh + .58, setLit });
  return { g, R, W, L, y0, bh, color, bm, lights, roofY: y0 + bh + .58 };
}
const finishVehicle = (g, w) => { ink(g, w); return g; };
function car(o) { return finishVehicle(carBase(o).g, .012); }
/** taxi: yellow car, checker band, TAXI roof sign (o.lit lights it) */
function taxi(o) {
  const b = carBase(o, { color: '#f6c22e' }), { g, W, L, y0, roofY } = b;
  const ck = canvasTex(512, 32, (x, Wc, Hc) => { for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#1c1f24' : '#f7f3ea'; x.fillRect(i * 16, j * 16, 16, 16); } });
  for (const s of [-1, 1]) mk(new THREE.PlaneGeometry(L * .78, .08), texMat(ck), [s * (W / 2 + .004), y0 + .3, 0], [0, s * PI / 2, 0], g).userData.noOutline = true;
  const t = label(o.text || 'TAXI', { bg: '#f7f3ea', fg: '#1c1f24', w: 256, h: 96 }), sm2 = own('#ffffff', { map: t });
  mk(rbox(.6, .2, .26, .05), M('#f7f3ea'), [0, roofY + .1, -L * .1], null, g);
  for (const s of [-1, 1]) mk(new THREE.PlaneGeometry(.52, .16), sm2, [0, roofY + .1, -L * .1 + s * .132], [0, s > 0 ? 0 : PI, 0], g).userData.noOutline = true;
  const base = g.userData.setLit; g.userData.setLit = on => { base(on); sm2.emissive.set(on ? '#ffffff' : '#000000'); sm2.emissiveMap = on ? t : null; sm2.emissiveIntensity = 1.2; sm2.needsUpdate = true; };
  g.userData.setLit(!!o.lit); g.userData.screen = t;
  return finishVehicle(g, .012);
}
function lightBar(g, y, z, w = .9, flash = false) {
  const red = own('#ff3b30', { emissive: '#ff2a1a', ei: 2.4, rough: .3 }), blue = own('#2f7fff', { emissive: '#2a6aff', ei: 2.4, rough: .3 });
  mk(rbox(w + .1, .06, .3, .02), M('#2b2f36'), [0, y, z], null, g);
  mk(rbox(w / 2 - .02, .12, .26, .05), red, [-w / 4, y + .08, z], null, g); mk(rbox(w / 2 - .02, .12, .26, .05), blue, [w / 4, y + .08, z], null, g);
  if (flash) g.userData.update = t => { const k = Math.floor(t * 4) % 2; red.emissiveIntensity = k ? 3 : .2; blue.emissiveIntensity = k ? .2 : 3; };
  return [red, blue];
}
/** police car: navy and white, POLICE doors, light bar (o.flash animates it) */
function police(o) {
  const b = carBase(o, { color: '#1d2b4f' }), { g, W, L, y0, roofY } = b;
  const t = label(o.text || 'POLICE', { bg: '#f7f3ea', fg: '#1d2b4f', w: 512, h: 96 });
  for (const s of [-1, 1]) { mk(rbox(.03, .36, L * .44, .012), M('#f7f3ea'), [s * W / 2, y0 + .36, .05], null, g); mk(new THREE.PlaneGeometry(L * .36, .14), texMat(t), [s * (W / 2 + .017), y0 + .38, .05], [0, s * PI / 2, 0], g).userData.noOutline = true; }
  lightBar(g, roofY + .01, -L * .1, .9, !!o.flash);
  g.userData.screen = t;
  return finishVehicle(g, .012);
}
/** cab + box vehicles (vans, trucks): returns the group and sizes */
function cabBase(o, v) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), cc = o.color || v.cab, W = v.W ?? 2.1, cabL = v.cabL ?? 1.8, wr = v.wr ?? .42, y0 = v.y0 ?? .38, L = v.L, lit = !!o.lit;
  const cm = M(cc, { rough: .35 }), zc = L / 2 - cabL / 2;
  mk(rbox(W, .85, cabL, .2), cm, [0, y0 + .425, zc], null, g);
  mk(taper(rbox(W * .94, .75, cabL * .86, .16), .96, .84, .14), glass(), [0, y0 + .85 + .34, zc - .05], null, g);
  mk(rbox(W * .96, .1, cabL * .62, .04), cm, [0, y0 + .85 + .74, zc - .2], null, g);
  mk(rbox(W * .98, .18, .2, .07), M('#d4d9de', { metal: .45, rough: .3 }), [0, y0 + .05, L / 2 - .02], null, g);
  mk(rbox(W * .5, .25, .05, .04), M('#2b2f36'), [0, y0 + .35, L / 2 + .01], null, g);
  const hl = own('#fff6d8', { emissive: '#fff2c8', ei: lit ? 2.6 : 0, rough: .2 });
  for (const s of [-1, 1]) { mk(new THREE.CylinderGeometry(.12, .12, .06, 18), hl, [s * W * .36, y0 + .42, L / 2], [PI / 2, 0, 0], g); mk(rbox(.12, .1, .07, .025), cm, [s * (W / 2 + .05), y0 + 1.2, zc + .4], null, g); }
  mk(rbox(W * .9, .3, L - cabL - .1, .05), M('#2b2f36'), [0, y0 + .05, -cabL / 2], null, g);
  const axles = v.axles || [L / 2 - cabL * .5, -L / 2 + 1.0];
  for (const z of axles) for (const s of [-1, 1]) { const wh = wheel(wr, .32); wh.position.set(s * (W / 2 - .15), wr, z); g.add(wh); }
  Object.assign(g.userData, { setLit: on => { hl.emissiveIntensity = on ? 2.6 : 0; } });
  return { g, R, W, L, y0, cabL, cm, boxZ: -cabL / 2 - .05, boxL: L - cabL - .15 };
}
/** delivery truck: cab + cargo box with an invented company name (o.text, o.color cab, o.box) */
function truck(o) {
  const b = cabBase(o, { cab: pick(rnd((o.seed ?? 1) + 9), ['#2f7fd1', '#e2432f', '#2fa59a', '#f2a53a']), L: 7.2, W: 2.3, cabL: 2.0, wr: .48, axles: [2.6, -1.6, -2.6] }), { g, W, y0, boxZ, boxL } = b;
  const bc = o.box || '#f6f1e6', H = 2.7;
  mk(rboxUp(W + .14, H, boxL, .1), M(bc, { rough: .6 }), [0, y0 + .2, boxZ], null, g);
  const t = label(o.text || 'HOPPA HAUL', { bg: bc, fg: '#1d2b4f', w: 1024, h: 200, draw: (x, Wc, Hc) => { x.fillStyle = b.cm.color.getStyle(); x.fillRect(0, Hc * .82, Wc, Hc * .18); } });
  for (const s of [-1, 1]) mk(new THREE.PlaneGeometry(boxL * .86, boxL * .86 * .195), texMat(t), [s * (W / 2 + .072), y0 + .2 + H * .58, boxZ], [0, s * PI / 2, 0], g).userData.noOutline = true;
  mk(rbox(W + .1, .06, .06, .02), M('#9aa0a8'), [0, y0 + .5, boxZ - boxL / 2 - .03], null, g);
  g.userData.screen = t; g.userData.top = y0 + .2 + H;
  return finishVehicle(g, .015);
}
/** ambulance van: white box, red stripe, plus emblem, light bar (o.flash) */
function ambulance(o) {
  const b = cabBase(o, { cab: '#f6f4ee', L: 5.4, W: 2.1, cabL: 1.8, wr: .4, axles: [1.75, -1.55] }), { g, W, y0, boxZ, boxL } = b, H = 2.15;
  mk(rboxUp(W + .1, H, boxL, .12), M('#f6f4ee', { rough: .55 }), [0, y0 + .15, boxZ], null, g);
  const bh = W / 2 + .05, zc = b.L / 2 - b.cabL / 2;
  for (const s of [-1, 1]) { mk(rbox(.03, .24, boxL, .01), M('#e2432f'), [s * (bh + .012), y0 + .7, boxZ], null, g); mk(rbox(.03, .24, b.cabL - .3, .01), M('#e2432f'), [s * (W / 2 + .012), y0 + .55, zc], null, g); }
  const em = canvasTex(256, 256, (x, Wc) => { x.fillStyle = '#f6f4ee'; x.fillRect(0, 0, Wc, Wc); x.fillStyle = '#e2432f'; x.beginPath(); x.arc(Wc / 2, Wc / 2, Wc * .46, 0, TAU); x.fill(); x.fillStyle = '#ffffff'; x.fillRect(Wc * .41, Wc * .18, Wc * .18, Wc * .64); x.fillRect(Wc * .18, Wc * .41, Wc * .64, Wc * .18); });
  const t = label(o.text || 'AMBULANCE', { bg: '#e2432f', fg: '#ffffff', w: 512, h: 72 });
  for (const s of [-1, 1]) { mk(new THREE.CircleGeometry(.42, 32), texMat(em), [s * (bh + .004), y0 + 1.55, boxZ], [0, s * PI / 2, 0], g).userData.noOutline = true; mk(new THREE.PlaneGeometry(2.0, .2), texMat(t), [s * (bh + .03), y0 + .7, boxZ], [0, s * PI / 2, 0], g).userData.noOutline = true; }
  mk(new THREE.CircleGeometry(.36, 32), texMat(em), [0, y0 + 1.5, boxZ - boxL / 2 - .002], [0, PI, 0], g).userData.noOutline = true;
  lightBar(g, y0 + .15 + H + .02, boxZ + boxL / 2 - .3, 1.2, !!o.flash);
  g.userData.screen = t; g.userData.top = y0 + .15 + H;
  return finishVehicle(g, .013);
}
/** fire engine: long red body, silver lockers, white band, ladder on top, light bar (o.flash) */
function fireTruck(o) {
  const b = cabBase(o, { cab: '#d8342c', L: 8, W: 2.35, cabL: 2.1, wr: .5, axles: [2.9, -1.9, -2.95] }), { g, W, y0, boxZ, boxL } = b, H = 1.75;
  mk(rboxUp(W + .05, H, boxL, .12), M('#d8342c', { rough: .4 }), [0, y0 + .15, boxZ], null, g);
  const lk = canvasTex(256, 256, (x, Wc) => { x.fillStyle = '#c9ced4'; x.fillRect(0, 0, Wc, Wc); x.fillStyle = '#9aa0a8'; for (let i = 0; i < 12; i++) x.fillRect(0, i * Wc / 12, Wc, 5); x.fillStyle = '#7a8089'; x.fillRect(Wc * .44, Wc * .8, Wc * .12, 10); });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) mk(new THREE.PlaneGeometry(1.35, 1.05), texMat(lk, { rough: .4 }), [s * (W / 2 + .03), y0 + .9, boxZ + boxL / 2 - .9 - i * 1.55], [0, s * PI / 2, 0], g).userData.noOutline = true;
    mk(rbox(.03, .14, boxL + 2.1, .01), M('#f7f3ea'), [s * (W / 2 + .03), y0 + .3, boxZ + 1.05], null, g);
  }
  const lad = [], ll = boxL + 1.2, ly = y0 + .15 + H + .3;
  for (const s of [-1, 1]) { const r = rbox(.07, .1, ll, .02, 2); r.translate(s * .42, ly, boxZ + .4); lad.push(r); }
  for (let i = 0; i < 14; i++) { const r = new THREE.CylinderGeometry(.025, .025, .84, 8); r.rotateZ(PI / 2); r.translate(0, ly, boxZ + .4 - ll / 2 + .2 + i * (ll - .4) / 13); lad.push(r); }
  mk(tint(merge(lad), '#d8dde3'), vcMat({ metal: .4, rough: .35 }), [0, 0, 0], null, g);
  for (const z of [-boxL / 2 + .5, boxL / 2 - .6]) mk(rboxUp(.3, .3, .3, .05), M('#9aa0a8'), [0, y0 + .15 + H, boxZ + z], null, g);
  mk(new THREE.TorusGeometry(.32, .12, 10, 22), M('#e9e4d4'), [0, y0 + 1.0, boxZ - boxL / 2 - .05], null, g);
  lightBar(g, y0 + .85 + .84, b.L / 2 - b.cabL * .6, 1.3, !!o.flash);
  g.userData.top = ly;
  return finishVehicle(g, .015);
}
/** city bus ~10 m: window band, doors on the right (-x), lit destination sign (o.text, o.lit), o.color, o.color2 band */
function bus(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || pick(R, ['#f2a53a', '#2f7fd1', '#e2432f', '#2fa59a', '#f6f1e6']), c2 = o.color2 || pick(R, ['#1d2b4f', '#f6f1e6', '#e2432f']), L = 10, W = 2.5, y0 = .36, H = 2.8, lit = !!o.lit;
  const bm = M(c, { rough: .4 });
  mk(rboxUp(W, H, L, .3, 3), bm, [0, y0, 0], null, g);
  mk(rbox(W + .04, 1.0, L - 1.6, .1), glass(), [0, y0 + 1.75, -.35], null, g);
  mk(rbox(W - .3, 1.3, .1, .1), glass(), [0, y0 + 1.65, L / 2 - .02], null, g);
  mk(rbox(W - .4, 1.0, .1, .1), glass(), [0, y0 + 1.8, -L / 2 + .02], null, g);
  mk(rbox(W + .04, .28, L * .97, .08), M(c2), [0, y0 + .75, 0], null, g);
  for (const z of [L / 2 - 1.35, -.6]) mk(rboxUp(.06, 2.15, 1.1, .03), glass(), [-W / 2, y0 + .15, z], null, g);
  const t = label(o.text || '42  CITY', { bg: '#14161a', fg: '#ffb020', w: 512, h: 96, weight: 800 }), sm2 = own('#ffffff', { map: t });
  mk(rbox(1.85, .34, .08, .03), M('#14161a'), [0, y0 + 2.5, L / 2 - .01], null, g);
  mk(new THREE.PlaneGeometry(1.7, .26), sm2, [0, y0 + 2.5, L / 2 + .035], null, g).userData.noOutline = true;
  const hl = own('#fff6d8', { emissive: '#fff2c8', ei: 0, rough: .2 });
  for (const s of [-1, 1]) { mk(new THREE.CylinderGeometry(.13, .13, .06, 18), hl, [s * W * .36, y0 + .45, L / 2 + .01], [PI / 2, 0, 0], g); mk(rbox(.12, .1, .07, .025), bm, [s * (W / 2 + .05), y0 + 2.2, L / 2 - .4], null, g); }
  mk(rbox(W * 1.01, .25, .2, .07), M('#3a3f48'), [0, y0 + .1, L / 2], null, g); mk(rbox(W * 1.01, .25, .2, .07), M('#3a3f48'), [0, y0 + .1, -L / 2], null, g);
  for (const z of [L / 2 - 2.2, -L / 2 + 2.3]) for (const s of [-1, 1]) { const wh = wheel(.52, .34); wh.position.set(s * (W / 2 - .18), .52, z); g.add(wh); }
  const setLit = on => { hl.emissiveIntensity = on ? 2.6 : 0; sm2.emissive.set(on ? '#ffffff' : '#000000'); sm2.emissiveMap = on ? t : null; sm2.emissiveIntensity = 1.6; sm2.needsUpdate = true; };
  setLit(lit);
  ink(g, .016); Object.assign(g.userData, { top: y0 + H, screen: t, setLit });
  return g;
}
/** bicycle ~1.75 m long (front +z): diamond frame, spoked wheels, saddle, bars; o.color frame */
function bicycle(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || pick(R, ['#2fa59a', '#e2432f', '#2f7fd1', '#f2a53a']), fm = M(c, { rough: .35, metal: .2 }), r = .34;
  const rear = V3(0, r, -.55), front = V3(0, r, .55), bb = V3(0, .3, -.04), seat = V3(0, .86, -.2), headT = V3(0, .88, .38), headB = V3(0, .7, .43);
  for (const [a, b2] of [[seat, headT], [headB, bb], [bb, seat], [bb, rear], [seat, rear], [headB, front]]) mk(sweep([a, b2], .022, { seg: 1, rad: 8 }), fm, [0, 0, 0], null, g);
  for (const s of [-1, 1]) mk(sweep([V3(s * .04, headB.y, headB.z), V3(s * .045, front.y, front.z)], .016, { seg: 1, rad: 6 }), fm, [0, 0, 0], null, g);
  mk(sweep([headB, headT, V3(0, 1.0, .35)], .02, { seg: 4, rad: 8 }), fm, [0, 0, 0], null, g);
  mk(sweep([V3(-.28, 1.02, .3), V3(-.1, 1.0, .36), V3(.1, 1.0, .36), V3(.28, 1.02, .3)], .016, { seg: 10, rad: 6 }), M('#3a3f48', { metal: .3 }), [0, 0, 0], null, g);
  for (const s of [-1, 1]) mk(new THREE.CylinderGeometry(.025, .025, .1, 10), M('#2a2d33'), [s * .3, 1.02, .3], [0, 0, PI / 2], g);
  mk(sweep([seat, V3(0, .93, -.21)], .014, { seg: 1, rad: 6 }), M('#c9ced4', { metal: .5 }), [0, 0, 0], null, g);
  mk(rbox(.14, .06, .26, .03), M('#3a2a20'), [0, .96, -.22], null, g);
  for (const p of [rear, front]) {
    const wg = new THREE.Group(); wg.position.copy(p); g.add(wg);
    mk(new THREE.TorusGeometry(r - .02, .028, 8, 36), M('#2a2d33', { rough: .8 }), [0, 0, 0], [0, PI / 2, 0], wg);
    const sp = []; for (let i = 0; i < 8; i++) { const sg = new THREE.CylinderGeometry(.004, .004, (r - .04) * 2, 4); sg.rotateX(i / 8 * PI); sp.push(sg); }
    noInk(mk(tint(merge(sp), '#c9ced4'), vcMat({ metal: .5 }), [0, 0, 0], null, wg));
    mk(new THREE.CylinderGeometry(.03, .03, .08, 10), M('#9aa0a8', { metal: .5 }), [0, 0, 0], [0, 0, PI / 2], wg);
  }
  mk(new THREE.CylinderGeometry(.08, .08, .02, 16), M('#9aa0a8', { metal: .5 }), [.03, bb.y, bb.z], [0, 0, PI / 2], g);
  for (const s of [-1, 1]) { mk(rbox(.02, .16, .03, .008), M('#3a3f48'), [s * .07, bb.y - s * .06, bb.z + s * .03], [s * .4, 0, 0], g); mk(rbox(.09, .02, .05, .008), M('#2a2d33'), [s * .1, bb.y - s * .13, bb.z + s * .07], null, g); }
  ink(g, .005); g.userData.seat = .96; g.userData.grip = { at: [.28, 1.02, .3], rot: [0, 0, 0] };
  return g;
}
/** motorbike ~2 m long (front +z): tank, seat, engine, chrome pipe, headlight (o.lit), o.color */
function motorbike(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || pick(R, ['#e2432f', '#2f7fd1', '#f2a53a', '#2b2f36', '#2fa59a']), bm = M(c, { rough: .3 }), r = .32, chrome = M('#d4d9de', { metal: .55, rough: .25 });
  for (const z of [-.68, .7]) { const wh = wheel(r, .16, '#9aa0a8'); wh.position.set(0, r, z); g.add(wh); mk(new THREE.TorusGeometry(r + .04, .05, 8, 20, PI * .55), bm, [0, r, z], [0, PI / 2, PI * .22], g); }
  const tank = new THREE.SphereGeometry(.2, 20, 14); tank.scale(.85, .7, 1.25); mk(tank, bm, [0, .82, .15], null, g);
  mk(rbox(.3, .12, .6, .06), M('#2a2d33'), [0, .8, -.32], [.08, 0, 0], g);
  mk(rbox(.26, .3, .4, .08), M('#5a6068', { metal: .4 }), [0, .5, .02], null, g);
  mk(sweep([V3(.17, .4, .1), V3(.2, .3, -.3), V3(.2, .38, -.8)], .04, { seg: 10, rad: 10 }), chrome, [0, 0, 0], null, g);
  for (const s of [-1, 1]) mk(sweep([V3(s * .07, r, .7), V3(s * .08, .92, .5)], .025, { seg: 1, rad: 8 }), chrome, [0, 0, 0], null, g);
  mk(sweep([V3(-.32, 1.08, .42), V3(-.15, 1.0, .5), V3(.15, 1.0, .5), V3(.32, 1.08, .42)], .02, { seg: 10, rad: 6 }), M('#3a3f48', { metal: .3 }), [0, 0, 0], null, g);
  const hl = own('#fff6d8', { emissive: '#fff2c8', ei: o.lit ? 2.6 : 0, rough: .2 });
  mk(new THREE.SphereGeometry(.1, 16, 12, 0, TAU, 0, PI / 2), chrome, [0, .92, .6], [-PI / 2, 0, 0], g);
  mk(new THREE.CircleGeometry(.085, 18), hl, [0, .92, .605], null, g).userData.noOutline = true;
  mk(rbox(.12, .06, .04, .02), M('#ff3b30'), [0, .82, -.7], null, g);
  ink(g, .006); Object.assign(g.userData, { seat: .86, setLit: on => { hl.emissiveIntensity = on ? 2.6 : 0; } });
  return g;
}
/** boat hull along z (bow +z), bottom at y = 0: decked (closed, flat deck) or open (inner bowl + gunwale) */
// unit sphere point (y <= 0) -> hull point: pinched bow at +z, flat transom at the back, sheer rising to the bow
function hullPt(x, y, z, L, W, H) {
  if (z < -.82) z = -.82;
  const pinch = z > 0 ? 1 - .45 * z * z : 1 + .12 * z * z, yy = -Math.pow(Math.max(0, -y), .8), sheer = (.32 * Math.max(0, z) ** 2 + .08 * Math.max(0, -z) ** 2) * H;
  return [x * pinch * W / 2, (yy + 1) * H + sheer * (1 + yy * .3), (z - .09) / .91 * L / 2];
}
/** boat hull along z (bow +z), keel at y = 0, closed with a flat deck (o.open: open shell, no deck) */
function hull(L, W, H, o = {}) {
  let geo = new THREE.SphereGeometry(1, 40, o.open ? 12 : 24, 0, TAU, o.open ? PI / 2 : 0, o.open ? PI / 2 : PI); geo.deleteAttribute('uv'); geo.deleteAttribute('normal'); geo = mergeVertices(geo);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) { const [a, b, c] = hullPt(P.getX(i), Math.min(0, P.getY(i)), P.getZ(i), L, W, H); P.setXYZ(i, a, b, c); }
  if (o.flip) { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
  geo.computeVertexNormals(); addUV(geo);
  const [bot, side, stripe, deck] = [col(o.bottom || '#e2432f'), col(o.color || '#f6f1e6'), col(o.stripe || '#1d2b4f'), col(o.deck || '#c99a63')];
  paint(geo, (p, n) => { if (o.flip) return deck.clone().multiplyScalar(.75 + .25 * clamp01(n.y)); if (n.y > .8 && p.y > H * .9) return deck; const f = p.y / H; return f < .38 ? bot : f < .5 ? stripe : side; });
  return geo;
}
function rim(L, W, H, r = .05) { const pts = []; for (let i = 0; i < 48; i++) { const t = i / 48 * TAU, [x, y, z] = hullPt(Math.sin(t), 0, Math.cos(t), L, W, H); pts.push(V3(x * .97, y + r * .3, z * .985)); } return sweep(pts, r, { closed: true, seg: 96, rad: 8 }); }
/** wooden rowboat ~3 m, hollow, with seats and oars */
function rowboat(o) {
  const g = new THREE.Group(), L = 3, W = 1.25, H = .5, wood = o.color || '#b5784a';
  mk(hull(L, W, H, { open: true, bottom: shade(wood, -.25), color: wood, stripe: o.stripe || '#2f7fd1' }), vcMat({ rough: .7 }), [0, 0, 0], null, g);
  const inner = hull(L * .94, W * .88, H * .78, { open: true, flip: true, deck: shade(wood, -.15) }); inner.translate(0, H * .22, 0);
  noInk(mk(inner, vcMat({ rough: .8 }), [0, 0, 0], null, g));
  mk(tint(rim(L, W, H, .06), shade(wood, .12)), vcMat(), [0, 0, 0], null, g);
  for (const z of [-.45, .45]) mk(rbox(W * .8, .06, .26, .02), M(shade(wood, .1)), [0, H - .08, z], null, g);
  for (const s of [-1, 1]) { mk(sweep([V3(s * .3, H + .1, -.9), V3(s * .2, H + .1, 1.1)], .022, { seg: 1, rad: 8 }), M('#d9b07a'), [0, 0, 0], null, g); mk(rbox(.16, .03, .45, .015), M('#d9b07a'), [s * .2, H + .1, 1.25], null, g); }
  ink(g, .009); Object.assign(g.userData, { waterline: H * .4, seat: H + .05, top: H });
  return g;
}
/** sailboat ~5.5 m with mast (~7 m), mainsail, jib and a small cabin; o.color hull, o.sail */
function sailboat(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), L = 5.5, W = 1.9, H = .85, hc = o.color || pick(R, ['#f6f1e6', '#1d2b4f', '#2f7fd1']), sail = o.sail || '#fbf8f0';
  mk(hull(L, W, H, { bottom: '#1d2b4f', color: hc, stripe: '#e2432f', deck: '#d9b07a' }), vcMat({ rough: .5 }), [0, 0, 0], null, g);
  mk(rboxUp(1.1, .45, 1.6, .12), M('#f6f1e6'), [0, H + .02, -.3], null, g);
  for (const s of [-1, 1]) mk(rbox(.02, .14, .5, .02), glass(), [s * .55, H + .3, -.2], null, g);
  const mz = .6, mh = 6.5; mk(new THREE.CylinderGeometry(.05, .06, mh, 10), M('#c9ced4', { metal: .4 }), [0, H + mh / 2, mz], null, g);
  mk(new THREE.CylinderGeometry(.04, .04, 2.6, 8), M('#c9ced4', { metal: .4 }), [0, H + .9, mz - 1.3], [PI / 2, 0, 0], g);
  const ms = slab([[0, 0], [0, mh - .5], [-2.5, 0]], .03, .015); ms.rotateY(-PI / 2); mk(ms, M(sail, { rough: .8 }), [.04, H + .95, mz - .04], null, g);
  const jb = slab([[0, 0], [0, mh - 1.2], [2.0, 0]], .03, .015); jb.rotateY(-PI / 2); mk(jb, M(shade(sail, -.06), { rough: .8 }), [-.04, H + .5, mz + .1], null, g);
  ink(g, .01); Object.assign(g.userData, { waterline: H * .4, top: H });
  return g;
}
/** motorboat ~5 m: windscreen, seats, outboard motor; o.color */
function motorboat(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), L = 5, W = 2, H = .8, hc = o.color || pick(R, ['#f6f1e6', '#e2432f', '#2fa59a']);
  mk(hull(L, W, H, { bottom: '#2f7fd1', color: hc, stripe: '#1d2b4f', deck: '#e9e4d4' }), vcMat({ rough: .45 }), [0, 0, 0], null, g);
  mk(rboxUp(1.4, .45, .5, .1), M('#f6f1e6'), [0, H, .55], null, g);
  noShadow(mk(taper(rbox(1.5, .45, .08, .03), .9, 1, .15), M('#a8d8f0', { rough: .1, transparent: true, opacity: .45 }), [0, H + .65, .78], null, g));
  mk(rbox(1.56, .06, .12, .02), M('#c9ced4', { metal: .4 }), [0, H + .44, .8], null, g);
  for (const x of [-.4, .4]) { mk(rboxUp(.5, .3, .5, .1), M('#2f7fd1'), [x, H, -.4], null, g); mk(rboxUp(.5, .45, .14, .07), M('#2f7fd1'), [x, H + .3, -.6], null, g); }
  mk(rboxUp(.35, .55, .45, .1), M('#2b2f36'), [0, H - .05, -L / 2 + .15], null, g);
  mk(rbox(.12, .6, .12, .04), M('#3a3f48'), [0, H - .3, -L / 2 + .1], null, g);
  ink(g, .01); Object.assign(g.userData, { waterline: H * .4, top: H });
  return g;
}
/** small propeller plane ~7 m long, 8.5 m wings (nose +z); userData.prop spins with o.spin */
function plane(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || '#f6f1e6', acc = o.accent || pick(R, ['#e2432f', '#2f7fd1', '#f2a53a']), bm = M(c, { rough: .35 }), am = M(acc, { rough: .35 }), gy = 1.15;
  const fus = lath([[0, 0], [.14, .08], [.3, 1.2], [.55, 3.4], [.62, 4.7], [.58, 5.5], [.42, 6.15], [.22, 6.45], [0, 6.5]], 28, { smooth: 3 });
  fus.rotateX(PI / 2); fus.translate(0, gy, -3.4);
  paint(fus, (p) => p.z > 2.2 && p.z < 2.55 ? col(acc) : col(c)); mk(fus, vcMat({ rough: .35 }), [0, 0, 0], null, g);
  mk(rbox(8.6, .16, 1.35, .07, 2), bm, [0, gy + .55, .6], null, g);
  for (const s of [-1, 1]) mk(rbox(.6, .17, 1.37, .07, 2), am, [s * 4.05, gy + .55, .6], null, g);
  for (const s of [-1, 1]) mk(sweep([V3(s * .45, gy - .1, .7), V3(s * 1.6, gy + .5, .6)], .04, { seg: 1, rad: 8 }), M('#9aa0a8', { metal: .4 }), [0, 0, 0], null, g);
  mk(rbox(3, .1, .8, .05, 2), bm, [0, gy + .2, -3.0], null, g);
  mk(slab([[0, 0], [1.0, 0], [1.0, 1.2], [.62, 1.25]], .1, .04), am, [0, gy + .1, -2.55], [0, PI / 2, 0], g);
  const cp = new THREE.SphereGeometry(.5, 20, 14, 0, TAU, 0, PI / 2); cp.scale(.95, .75, 1.6); mk(cp, glass(), [0, gy + .48, 1.0], null, g);
  const prop = new THREE.Group(); prop.position.set(0, gy, 3.12); g.add(prop);
  mk(lath([[.2, 0], [.18, .12], [.08, .3], [0, .34]], 18, { smooth: 2 }), am, [0, 0, 0], [PI / 2, 0, 0], prop);
  for (const a of [0, PI]) mk(rbox(.14, 1.7, .04, .02), M('#3a3f48'), [0, 0, .1], [0, 0, a + .3], prop);
  for (const [x, z] of [[-.9, .6], [.9, .6], [0, 2.5]]) { mk(sweep([V3(x * .5, gy - .3, z), V3(x, .3, z)], .035, { seg: 1, rad: 6 }), M('#9aa0a8'), [0, 0, 0], null, g); const wh = wheel(.28, .16); wh.position.set(x, .28, z); g.add(wh); }
  if (o.spin) g.userData.update = t => { prop.rotation.z = t * 40; };
  ink(g, .012); Object.assign(g.userData, { prop, top: gy + .63 });
  return g;
}
/** helicopter ~9 m rotor: bubble cabin, tail boom, skids; userData.rotor (o.spin turns it), o.color */
function helicopter(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || pick(R, ['#f2a53a', '#e2432f', '#2f7fd1', '#2fa59a']), bm = M(c, { rough: .35 }), cy = 1.35;
  const cab = new THREE.SphereGeometry(1, 28, 20); cab.scale(1.05, .95, 1.55); mk(cab, bm, [0, cy, 0], null, g);
  const ws = new THREE.SphereGeometry(1, 24, 16, 0, TAU, 0, PI * .55); ws.rotateX(PI / 2.2); ws.scale(.9, .8, 1.1); mk(ws, glass(), [0, cy + .15, .6], null, g);
  mk(sweep([V3(0, cy + .2, -1.2), V3(0, cy + .45, -3), V3(0, cy + .7, -4.6)], u => .32 * (1 - u * .6), { seg: 14, rad: 12 }), bm, [0, 0, 0], null, g);
  mk(slab([[0, 0], [.7, 0], [.3, 1.1], [0, 1.0]], .08, .03), bm, [0, cy + .55, -4.3], [0, PI / 2, 0], g);
  const tr = new THREE.Group(); tr.position.set(.16, cy + 1.05, -4.55); g.add(tr);
  for (const a of [0, PI / 2]) mk(rbox(.04, .9, .1, .02), M('#3a3f48'), [0, 0, 0], [a, 0, 0], tr);
  mk(new THREE.CylinderGeometry(.12, .16, .4, 12), M('#5a6068'), [0, cy + 1.0, -.1], null, g);
  const rotor = new THREE.Group(); rotor.position.set(0, cy + 1.25, -.1); g.add(rotor);
  mk(new THREE.CylinderGeometry(.18, .18, .12, 14), M('#3a3f48'), [0, 0, 0], null, rotor);
  for (let i = 0; i < 4; i++) mk(rbox(.26, .04, 4.3, .02, 2), M('#2b2f36'), [0, .02, 0], [0, i * PI / 2, 0], rotor).geometry.translate(0, 0, 2.15);
  for (const s of [-1, 1]) {
    mk(sweep([V3(s * .75, .06, -1.2), V3(s * .75, .06, 1.1), V3(s * .75, .2, 1.45)], .05, { seg: 12, rad: 8 }), M('#5a6068'), [0, 0, 0], null, g);
    for (const z of [-.6, .6]) mk(sweep([V3(s * .75, .06, z), V3(s * .5, cy - .65, z)], .04, { seg: 1, rad: 6 }), M('#5a6068'), [0, 0, 0], null, g);
  }
  if (o.spin) g.userData.update = t => { rotor.rotation.y = t * 9; tr.rotation.x = t * 30; };
  ink(g, .012); Object.assign(g.userData, { rotor, tailRotor: tr });
  return g;
}
/** train carriage ~12 m on bogies: window row (o.lit), doors, roof vents; o.color, o.color2 band */
function trainCarriage(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c = o.color || pick(R, ['#2f6a4f', '#c9443a', '#2f5fa0', '#e9b84c', '#f6f1e6']), c2 = o.color2 || pick(R, ['#f6f1e6', '#1d2b4f', '#e9b84c']), L = 12, W = 2.9, y0 = .95, H = 2.9, lit = !!o.lit;
  mk(rboxUp(W, H, L, .32, 3), M(c, { rough: .4 }), [0, y0, 0], null, g);
  mk(rboxUp(W * .86, .3, L - .6, .15), M('#9aa0a8'), [0, y0 + H - .12, 0], null, g);
  mk(rbox(W + .03, .2, L - .3, .06), M(c2), [0, y0 + .65, 0], null, g);
  const wm = own('#34496b', { rough: .16, metal: .15 }); const setLit = on => { wm.color.set(on ? '#ffe2a0' : '#34496b'); wm.emissive.set(on ? '#ffc46a' : '#000000'); wm.emissiveIntensity = on ? 1.5 : 1; }; setLit(lit);
  const wins = []; for (let i = 0; i < 8; i++) { const z = -L / 2 + 1.6 + i * (L - 3.2) / 7; if (Math.abs(z - L * .3) < .7 || Math.abs(z + L * .3) < .7) continue; const w2 = rbox(W + .04, .85, .95, .14, 2); w2.translate(0, y0 + 1.75, z); wins.push(w2); }
  mk(merge(wins), wm, [0, 0, 0], null, g);
  for (const z of [L * .3, -L * .3]) for (const s of [-1, 1]) mk(rboxUp(.05, 2.1, 1.0, .04), M(shade(c, -.3)), [s * W / 2, y0 + .15, z], null, g);
  mk(rboxUp(W * .8, .5, L - 1, .05), M('#2b2f36'), [0, y0 - .4, 0], null, g);
  for (const zb of [L / 2 - 2.2, -L / 2 + 2.2]) { mk(rboxUp(W * .42, .45, 2.2, .06), M('#3a3f48'), [0, .32, zb], null, g); for (const dz of [-.7, .7]) for (const s of [-1, 1]) { const wh = wheel(.42, .14, '#7a8089'); wh.position.set(s * .8, .42, zb + dz); g.add(wh); } }
  for (const s of [-1, 1]) mk(rbox(.3, .25, .5, .06), M('#3a3f48'), [0, y0 + .2, s * (L / 2 + .2)], null, g);
  ink(g, .016); Object.assign(g.userData, { top: y0 + H + .2, setLit });
  return g;
}
/** hot-air balloon ~10 m: 12 gores in 2-3 colours, wicker basket (top = basket floor), ropes, burner (o.lit flame) */
function balloon(o) {
  const R = rnd(o.seed ?? 1), g = new THREE.Group(), c1 = o.color || pick(R, BRIGHT), c2 = o.color2 || pick(R, ['#f6c945', '#fbf6ea', '#2f7fd1', '#2fa59a']), c3 = o.color3 || '#fbf6ea';
  const ey = 2.7, prof = [[0, 0], [.55, .02], [.75, .5], [1.6, 1.6], [2.8, 3.0], [3.35, 4.2], [3.3, 5.2], [2.7, 6.2], [1.5, 6.95], [0, 7.15]];
  for (let i = 0; i < 12; i++) mk(lath(prof, 4, { smooth: 4, phi0: i / 12 * TAU, phiLen: TAU / 12 }), M([c1, c2, c1, c3][i % 4], { rough: .6 }), [0, ey, 0], null, g);
  const wk = canvasTex(256, 256, (x, W) => { x.fillStyle = '#b07a3e'; x.fillRect(0, 0, W, W); for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { x.fillStyle = (i + j) % 2 ? '#9a6430' : '#c48a4a'; x.fillRect(i * 16, j * 16, 15, 15); } });
  mk(rboxUp(1.25, .95, 1.25, .1), texMat(wk, { rough: .9 }), [0, 0, 0], null, g);
  mk(rbox(1.35, .1, 1.35, .05), M('#6a4426'), [0, .95, 0], null, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) noInk(mk(sweep([V3(sx * .6, .97, sz * .6), V3(sx * .5, ey + .1, sz * .5)], .012, { seg: 1, rad: 5 }), M('#6a4426'), [0, 0, 0], null, g));
  mk(new THREE.CylinderGeometry(.18, .22, .3, 14), M('#9aa0a8', { metal: .5 }), [0, 2.1, 0], null, g);
  const fm = own('#ffb040', { emissive: '#ff8a1a', ei: o.lit ? 3 : 0 }); const fl = mk(new THREE.ConeGeometry(.14, .55, 12), fm, [0, 2.5, 0], null, g); fl.visible = !!o.lit; fl.userData.noOutline = true;
  ink(g, .02);
  Object.assign(g.userData, { top: .12, setLit: on => { fm.emissiveIntensity = on ? 3 : 0; fl.visible = on; } });
  return g;
}

// ================================================================ SKY
/** puffy cartoon cloud ~4 m wide (solid false): white top, lavender underside; o.size, o.color */
function cloud(o) {
  const R = rnd(o.seed ?? 1), s = o.size ?? 1, g = new THREE.Group(), geos = [], top = col(o.color || '#ffffff'), bot = col(o.under || '#c9d0ea'), n = 4 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1) - .5) * 3.2, r = range(R, .7, 1.05) * (1 - Math.abs(x) * .12); const p = new THREE.SphereGeometry(r, 20, 14); p.translate(x, r * .35, range(R, -.3, .3)); geos.push(p); }
  for (let i = 0; i < 3; i++) { const r = range(R, .75, 1.05), p = new THREE.SphereGeometry(r, 20, 14); p.translate(range(R, -1, 1), r * .35 + range(R, .55, .9), range(R, -.2, .2)); geos.push(p); }
  const m = merge(geos), P = m.attributes.position; for (let i = 0; i < P.count; i++) if (P.getY(i) < 0) P.setY(i, P.getY(i) * .25);
  m.computeVertexNormals(); paint(m, (p, n) => bot.clone().lerp(top, clamp01(.35 + p.y * .4 + n.y * .3)));
  mk(m, vcMat({ rough: 1 }), [0, 0, 0], null, g);
  ink(g, .03 * s, 1); g.scale.setScalar(s); g.userData.solid = false;
  return g;
}
/** cartoon sun ~3 m: glowing disc with a ring of rays, faces +z (o.rays false: just the disc) */
function sun(o) {
  const s = o.size ?? 1, g = new THREE.Group(), c = o.color || '#ffd23f', m = M(c, { emissive: c, ei: 1.4, rough: .6 }), rm = M('#ffa62a', { emissive: '#ff9a1a', ei: 1.3 });
  const d = new THREE.SphereGeometry(1.2, 32, 20); d.scale(1, 1, .3); mk(d, m, [0, 0, 0], null, g);
  if (o.rays !== false) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = mk(new THREE.ConeGeometry(.22, .6, 12), rm, [Math.cos(a) * 1.65, Math.sin(a) * 1.65, -.05], [0, 0, a - PI / 2], g); r.scale.set(1, 1, .4); }
  ink(g, .03 * s, 1); g.scale.setScalar(s); g.userData.solid = false;
  return g;
}
/** cartoon moon ~2.5 m: o.phase 'crescent' (default) | 'full' with craters; faces +z, soft glow */
function moon(o) {
  const s = o.size ?? 1, g = new THREE.Group(), c = o.color || '#f3ecc8', m = M(c, { emissive: c, ei: .7, rough: .8 });
  if (o.phase === 'full') {
    const d = new THREE.SphereGeometry(1.2, 32, 20); d.scale(1, 1, .5); mk(d, m, [0, 0, 0], null, g);
    const cm = M(shade(c, -.15), { emissive: shade(c, -.15), ei: .6 });
    for (const [x, y, r] of [[-.4, .35, .28], [.35, -.3, .22], [.45, .45, .14], [-.2, -.55, .16]]) { const cr = new THREE.SphereGeometry(r, 16, 10); cr.scale(1, 1, .25); noInk(mk(cr, cm, [x, y, .56], null, g)); }
  } else {
    const pts = []; for (let i = 0; i <= 24; i++) { const a = -PI * .5 + i / 24 * PI * 1.0; pts.push([Math.cos(a) * 1.2, Math.sin(a) * 1.2]); }
    for (let i = 24; i >= 0; i--) { const a = -PI * .5 + i / 24 * PI; pts.push([Math.cos(a) * .55 + .0, Math.sin(a) * 1.2 * .92]); }
    const geo = slab(pts.map(([x, y]) => [x - .3, y]), .25, .12, { cs: 4 }); mk(geo, m, [0, 0, 0], null, g);
  }
  ink(g, .03 * s, 1); g.scale.setScalar(s); g.userData.solid = false;
  return g;
}

// ================================================================ REGISTRY
export const REG = {
  'tree': { make: tree, tags: ['nature', 'tree', 'outdoor'], desc: 'round broadleaf tree ~5 m, lush clustered leaf puffs (o.seed shape, o.size, o.fruit, o.leaves: leaf|autumn|blossom, o.wide, o.detail .3-1: fewer leaves for far trees; ~65k tris at 1)' },
  'fruit-tree': { make: o => tree({ ...o, fruit: true }), tags: ['nature', 'tree', 'outdoor'], desc: 'broadleaf tree with fruit hanging under the canopy (o.fruitColor, o.fruits count)' },
  'pine': { make: pine, tags: ['nature', 'tree', 'outdoor'], desc: 'conifer ~5 m with drooping scalloped tiers (o.size, o.tall, o.wide)' },
  'palm': { make: palm, tags: ['nature', 'tree', 'beach', 'outdoor'], desc: 'curved palm ~5.5 m, ringed trunk, arching serrated fronds, coconuts' },
  'dead-tree': { make: deadTree, tags: ['nature', 'tree', 'outdoor'], desc: 'bare crooked grey tree ~3.5 m (spooky, drought, winter)' },
  'bush': { make: bush, tags: ['nature', 'plant', 'outdoor'], desc: 'round leafy bush ~1 m (o.flowers / o.berries colour or true, o.wide)' },
  'hedge': { make: hedge, tags: ['nature', 'plant', 'street', 'outdoor'], desc: 'trimmed hedge along x (o.length 3, o.height 1.1, o.depth .8), top = height' },
  'boulder': { make: boulder, tags: ['nature', 'rock', 'outdoor'], desc: 'big rounded boulder ~1.2 m (o.size, o.moss)' },
  'rocks': { make: rocks, tags: ['nature', 'rock', 'outdoor'], desc: 'cluster of 3-5 rocks ~1 m across (o.n, o.size, o.moss)' },
  'grass': { make: grass, tags: ['nature', 'plant', 'outdoor', 'decal'], desc: 'grass tufts ~.4 m, walk-through (o.n tufts, o.spread, o.tall, o.dry)' },
  'flowers': { make: flowers, tags: ['nature', 'plant', 'outdoor'], desc: 'patch of 5-9 flowers ~.35 m, walk-through (o.color, o.n, o.spread)' },
  'mushroom': { make: mushroom, tags: ['nature', 'plant', 'outdoor'], desc: 'spotted toadstool ~.36 m (o.n 1-3, o.color cap, o.size for giant ones)' },
  'log': { make: log, tags: ['nature', 'camp', 'outdoor'], desc: 'cut log lying along x ~1.6 m, ringed ends, seat height ~.4' },
  'stump': { make: stump, tags: ['nature', 'camp', 'outdoor'], desc: 'tree stump ~.5 m with root flares, ringed top (seat / top)' },
  'cactus': { make: cactus, tags: ['nature', 'plant', 'desert', 'outdoor'], desc: 'ribbed cactus: o.kind tall (~2.2 m with arms) | barrel; o.flower' },
  'reeds': { make: reeds, tags: ['nature', 'plant', 'water', 'outdoor'], desc: 'reeds and cattails ~1.4 m by the water, walk-through' },
  'cliff': { make: cliff, tags: ['nature', 'rock', 'outdoor'], desc: 'rock cliff chunk with strata and grassy top (o.w 5, o.h 3.2, o.d 3, o.grass, o.color), top = height' },
  'hill': { make: hill, tags: ['nature', 'terrain', 'outdoor'], desc: 'gentle grassy hill (o.r 6, o.h 1.6, o.color), walkable (solid false)' },
  'dune': { make: dune, tags: ['nature', 'terrain', 'desert', 'beach', 'outdoor'], desc: 'sand dune with wind ripples (o.r 5, o.h 1.5)' },
  'coral-rock': { make: coral, tags: ['nature', 'water', 'beach', 'outdoor'], desc: 'coral rock ~1 m: branching coral, brain coral, tube sponges (o.color)' },
  // beach
  'beach-umbrella': { make: umbrella, tags: ['beach', 'outdoor'], desc: 'striped beach umbrella ~2.3 m in a sand mound (o.color, o.color2, o.tilt)' },
  'beach-towel': { make: towel, tags: ['beach', 'outdoor', 'decal'], desc: 'striped beach towel 1.75 m along z, flat (o.colors)' },
  'sandcastle': { make: sandcastle, tags: ['beach', 'outdoor'], desc: 'sand castle ~.6 m with keep, towers and a flag' },
  'starfish': { make: starfish, tags: ['beach', 'water', 'outdoor'], desc: 'starfish ~.26 m lying flat (o.color)' },
  'shell': { make: shell, tags: ['beach', 'outdoor'], desc: 'scallop shell ~.17 m (o.color)' },
  'coconut': { make: coconut, tags: ['beach', 'food', 'outdoor'], desc: 'coconut ~.22 m (o.open: half shell with white flesh)' },
  'life-ring': { make: lifering, tags: ['beach', 'water', 'outdoor'], desc: 'red and white life ring with rope on a post ~1.55 m (o.post false: lying flat)' },
  'lifeguard-tower': { make: lifeguardTower, tags: ['beach', 'outdoor', 'building'], desc: 'lifeguard tower ~4.4 m: stilts, platform (top 1.97), hut, ramp to +z, flag, sign (o.text, o.color)' },
  // camp
  'campfire': { make: campfire, tags: ['camp', 'outdoor'], desc: 'stone ring + log teepee + glowing embers; userData.fireAt for the flames (o.lit)' },
  'tent': { make: tent, tags: ['camp', 'outdoor'], desc: 'A-frame tent ~1.5 m tall, door at +z, ropes and pegs (o.color)' },
  'camp-lantern': { make: lantern, tags: ['camp', 'light', 'outdoor'], desc: 'camping lantern ~.33 m with warm light (o.lit default true, userData.light, grip on the handle)' },
  'backpack': { make: backpack, tags: ['camp', 'outdoor'], desc: 'hiking backpack ~.65 m with bedroll, pocket at +z (o.color, grip on the top loop)' },
  // street
  'park-bench': { make: bench, tags: ['street', 'park', 'seat', 'outdoor'], desc: 'park bench 1.7 m: cast-iron sides, wooden slats, seat .48 (o.color wood, o.length)' },
  'street-lamp': { make: streetLamp, tags: ['street', 'park', 'light', 'outdoor'], desc: 'street lamp: o.kind classic (globe ~3.9 m) | curved (arm over +z ~4.6 m); o.lit glows + userData.light' },
  'hydrant': { make: hydrant, tags: ['street', 'outdoor'], desc: 'fire hydrant ~.8 m (o.color)' },
  'mailbox': { make: mailbox, tags: ['street', 'outdoor'], desc: 'street mailbox ~1.25 m with slot and label (o.text MAIL, o.color)' },
  'street-bin': { make: streetBin, tags: ['street', 'park', 'outdoor'], desc: 'slatted public litter bin ~.95 m (o.color)' },
  'traffic-cone': { make: cone, tags: ['street', 'outdoor'], desc: 'orange traffic cone ~.7 m with white bands' },
  'barrier': { make: barrier, tags: ['street', 'outdoor'], desc: 'road barrier 1.6 m: striped planks, warning lamp (o.lit, o.flash)' },
  'road-sign': { make: roadSign, tags: ['street', 'sign', 'outdoor'], desc: 'sign on a pole: o.kind street (o.text, o.text2) | round (o.text 20) | warn (o.text !) | arrow (o.text); userData.screen' },
  'traffic-light': { make: trafficLight, tags: ['street', 'light', 'outdoor'], desc: 'traffic light ~3.4 m (o.state red|yellow|green, userData.setState)' },
  'bus-stop': { make: busStop, tags: ['street', 'seat', 'outdoor'], desc: 'bus shelter 3.2 m: roof, glass back, ad poster (o.lit, o.poster {title, sub, c1, c2}), bench seat .48, BUS sign (o.text)' },
  'phone-booth': { make: phoneBooth, tags: ['street', 'outdoor'], desc: 'phone booth ~2.6 m with glazing bars and a PHONE sign (o.lit, o.text, o.color)' },
  'fence': { make: fence, tags: ['street', 'farm', 'park', 'outdoor'], desc: 'wooden post-and-rail fence along x (o.length 4.8, o.color)' },
  'picket-fence': { make: picketFence, tags: ['street', 'house', 'outdoor'], desc: 'white picket fence along x ~1 m tall (o.length 3, o.color)' },
  'gate': { make: gate, tags: ['street', 'house', 'outdoor'], desc: 'picket garden gate between posts; userData.door hinge group (o.open 0..1)' },
  'manhole': { make: manhole, tags: ['street', 'outdoor', 'decal'], desc: 'manhole cover ~.9 m, flat' },
  'crosswalk': { make: crosswalk, tags: ['street', 'outdoor', 'decal'], desc: 'zebra crossing: stripes along x spanning o.width (6) in z, o.length 2.6' },
  'brick-wall': { make: brickWall, tags: ['street', 'outdoor', 'building'], desc: 'brick wall along x with coping (o.length 4, o.height 1.2, o.color); top, seat when low' },
  'road': { make: road, tags: ['street', 'outdoor', 'decal'], desc: 'straight road along x: asphalt, lane lines, curbs (o.length 20, o.width 7, o.sidewalk m, o.center colour); sidewalkY' },
  // buildings (front at +z; o.lit lights windows and signs, userData.setLit)
  'shop': { make: shop, tags: ['building', 'street', 'outdoor'], desc: 'shop front 5.2 m wide: display window with goods, door, striped scalloped awning, sign board (o.text name, o.color wall, o.accent, o.floors upper floors, o.lit)' },
  'house': { make: house, tags: ['building', 'house', 'outdoor'], desc: 'cartoon house 6.4 x 5.6 m: siding, gable roof, door + step, shuttered windows, chimney (o.floors 1-2, o.color, o.roof, o.door, o.lit)' },
  'apartment': { make: apartment, tags: ['building', 'street', 'city', 'outdoor'], desc: 'apartment block 4-7 floors by seed (o.floors, o.w, o.d, o.color, o.balconies, o.lit random lit windows), rooftop tank' },
  'skyscraper': { make: skyscraper, tags: ['building', 'city', 'outdoor'], desc: 'glass tower 30-60 m in setback tiers with a spire (o.height, o.w, o.tiers, o.color, o.lit offices + beacon)' },
  // vehicles (front at +z; o.lit headlights, o.color)
  'car': { make: car, tags: ['vehicle', 'street', 'outdoor'], desc: 'chunky car 3.9 m (o.color, o.lit headlights), top = roof' },
  'taxi': { make: taxi, tags: ['vehicle', 'street', 'outdoor'], desc: 'yellow taxi with checker band and roof sign (o.text, o.lit)' },
  'police-car': { make: police, tags: ['vehicle', 'street', 'outdoor'], desc: 'navy and white police car with light bar (o.flash animates it, o.text)' },
  'ambulance': { make: ambulance, tags: ['vehicle', 'street', 'outdoor'], desc: 'ambulance van 5.4 m: white box, red stripe, plus emblem, light bar (o.flash)' },
  'bus': { make: bus, tags: ['vehicle', 'street', 'outdoor'], desc: 'city bus 10 m: window band, doors on -x, destination sign (o.text, o.lit), o.color, o.color2' },
  'truck': { make: truck, tags: ['vehicle', 'street', 'outdoor'], desc: 'delivery truck 7.2 m: cab + cargo box with an invented name (o.text, o.color cab, o.box)' },
  'fire-truck': { make: fireTruck, tags: ['vehicle', 'street', 'outdoor'], desc: 'fire engine 8 m: lockers, ladder, hose reel, light bar (o.flash)' },
  'bicycle': { make: bicycle, tags: ['vehicle', 'street', 'park', 'outdoor'], desc: 'bicycle 1.75 m along z (o.color frame), seat .96, grip on the bar' },
  'motorbike': { make: motorbike, tags: ['vehicle', 'street', 'outdoor'], desc: 'motorbike 2 m along z: tank, seat .86, chrome pipe (o.color, o.lit)' },
  'rowboat': { make: rowboat, tags: ['vehicle', 'boat', 'water', 'outdoor'], desc: 'hollow wooden rowboat 3 m with seats and oars; keel at y 0, userData.waterline (sink it to that in water)' },
  'sailboat': { make: sailboat, tags: ['vehicle', 'boat', 'water', 'outdoor'], desc: 'sailboat 5.5 m, mast ~7.4 m, mainsail + jib, cabin (o.color hull, o.sail); waterline' },
  'motorboat': { make: motorboat, tags: ['vehicle', 'boat', 'water', 'outdoor'], desc: 'motorboat 5 m: windscreen, seats, outboard motor (o.color); waterline' },
  'plane': { make: plane, tags: ['vehicle', 'air', 'outdoor'], desc: 'small high-wing propeller plane 6.5 m, wings 8.6 m, on its wheels (o.color, o.accent, o.spin); userData.prop' },
  'helicopter': { make: helicopter, tags: ['vehicle', 'air', 'outdoor'], desc: 'helicopter: bubble cabin, tail boom, skids, 8.6 m rotor (o.color, o.spin); userData.rotor' },
  'train-carriage': { make: trainCarriage, tags: ['vehicle', 'rail', 'outdoor'], desc: 'train carriage 12 m on two bogies: window row (o.lit), doors, roof (o.color, o.color2)' },
  'hot-air-balloon': { make: balloon, tags: ['vehicle', 'air', 'sky', 'outdoor'], desc: 'hot-air balloon ~10 m: striped envelope, wicker basket (top = basket floor), burner flame (o.lit, o.color, o.color2)' },
  // sky (no collision)
  'cloud': { make: cloud, tags: ['sky', 'outdoor'], desc: 'puffy cartoon cloud ~4 m wide (o.size, o.color, o.under)' },
  'sun': { make: sun, tags: ['sky', 'outdoor', 'light'], desc: 'cartoon sun disc ~3 m with rays, glowing, faces +z (o.size, o.rays false)' },
  'moon': { make: moon, tags: ['sky', 'outdoor', 'night'], desc: 'cartoon moon ~2.4 m, soft glow, faces +z (o.phase crescent | full, o.size)' },
};

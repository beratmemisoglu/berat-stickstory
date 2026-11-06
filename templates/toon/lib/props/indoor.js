// Indoor props for the 3D toon look: furniture, lights, kitchen + food, bathroom, office + school, money + party, medical,
// tools + home. Every prop is built in code from rounded parts (rounded boxes, bevelled lathes, tubes, bevelled extrudes)
// in 2-3 soft toon tones with the dark-brown ink outline, sized in metres next to a 1.67 m character (chair seat .45,
// table top .75, door 2.1), front = +z, standing on y = 0.
// Wall props (picture, clock, mirror, window, switch, boards, calendar, towel rail...) hang at a natural height above their
// floor point with their back at z = 0: place them at the wall's z (o.mount changes the height; 0 = stand on a surface).
// Options the makers read when they make sense: color, seed (variation), w / h / size, open, on, text, count, kind.
// userData: top / seat (heights), grip { at: [x,y,z] local point the hand holds, rot: turns it upright in the hand },
// solid false for flat things, screen (a canvasTex the scene may redraw), light (a PointLight), and parts to animate:
// pivot / door / doors / hands / spin / slices / flame.
import { THREE, rnd, shade, canvasTex } from '../core.js';
import { toonMat } from '../rig.js';
import { addOutline, outlineMat, Noodle } from '../geo.js';
import { mergeVertices, mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js';

const INK = '#2a1d17', PI = Math.PI, TAU = PI * 2;
const GEO = new Map(), TEX = new Map(), MATS = new Map();
// cached geometries are flagged shared: the engine then never disposes them when a shot is dropped (other shots use them)
const memo = (m, k, f) => { let v = m.get(k); if (v === undefined) { v = f(); if (v?.isBufferGeometry) v.userData.shared = true; m.set(k, v); } return v; };
const pick = (a, R) => a[Math.floor(R() * a.length) % a.length];

// ---------- palettes ----------
const WOODS = ['#b77b45', '#a46a3c', '#c58d55', '#94603a'];
const FABRICS = ['#3f9c95', '#e0a33a', '#d65a40', '#4a6fb5', '#7a5bb5', '#5c9e4c', '#c95a7a', '#35507f', '#e07b5a'];
const BRIGHT = ['#e2432f', '#f08a2a', '#f6c945', '#5fae4a', '#2f9c95', '#3f6fd1', '#7a4fc4', '#ee7fa6'];
const BOOKS = ['#c0392b', '#2f4a7a', '#3f8f5a', '#e0a33a', '#7a4fc4', '#d65a40', '#2f9c95', '#efe3c8', '#5b3b25', '#e9b44c', '#35507f', '#a83a5a'];
const PAPER = '#f5efe1', WHITE = '#f4f1ea', CHROME = '#b4bcc6', GOLD = '#e9b44c', DARK = '#2f3036';

// ---------- materials ----------
const mat = (c, o) => toonMat(c, o || {});
const matte = c => toonMat(c, { rough: .92 });
const gloss = c => toonMat(c, { rough: .56 });
const metal = (c = CHROME) => toonMat(c, { rough: .42, metal: .28 });
const glow = (c, ei = 2.4) => toonMat(c, { emissive: c, ei });
const sheen = () => toonMat('#ffffff', { emissive: '#ffffff', ei: .22, rough: .3 });
/** a textured toon surface (toonMat's cache key would serialise the canvas, so mapped materials are made here) */
function texMat(t, o = {}) {
  return memo(MATS, t.uuid + JSON.stringify(o), () => {
    const m = new THREE.MeshStandardMaterial({ color: o.color ?? '#ffffff', map: t, roughness: o.rough ?? .82, metalness: 0 });
    if (o.glow) { m.emissive.set('#ffffff'); m.emissiveMap = t; m.emissiveIntensity = o.glow; }
    if (o.decal) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4; }
    return m;
  });
}
const vcMat = (rough = .8) => memo(MATS, 'vc' + rough, () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0 }));
const tex = (key, w, h, fn) => memo(TEX, key, () => canvasTex(w, h, fn));

// ---------- geometry ----------
/** rounded box (w, h, d, corner r); s = rounding steps, m = flat middle segments (more for bending) */
function rbox(w, h, d, r = .01, s = 3, m = 1) {
  r = Math.max(1e-4, Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5));
  return memo(GEO, `rb${w}|${h}|${d}|${r}|${s}|${m}`, () => {
    const n = 2 * s + m, g = new THREE.BoxGeometry(1, 1, 1, n, n, n), P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
    const inner = [w / 2 - r, h / 2 - r, d / 2 - r], size = [w, h, d], v = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
    const map = (u, a) => {
      const i = Math.round((u + .5) * n);
      if (i <= s) return -(inner[a] + r * Math.tan((1 - i / s) * PI / 4));
      if (i >= s + m) return inner[a] + r * Math.tan(((i - s - m) / s) * PI / 4);
      return -inner[a] + 2 * inner[a] * (i - s) / m;
    };
    const F = (cu, a) => map(cu - .5, a) / size[a] + .5;   // uv follows the moved vertices (labels are not squeezed)
    for (let i = 0; i < P.count; i++) {
      const ax = Math.abs(N.getX(i)) > .5 ? [2, 1] : Math.abs(N.getY(i)) > .5 ? [0, 2] : [0, 1];
      UV.setXY(i, F(UV.getX(i), ax[0]), F(UV.getY(i), ax[1]));
      v.set(map(P.getX(i), 0), map(P.getY(i), 1), map(P.getZ(i), 2));
      c.set(Math.max(-inner[0], Math.min(inner[0], v.x)), Math.max(-inner[1], Math.min(inner[1], v.y)), Math.max(-inner[2], Math.min(inner[2], v.z)));
      nn.copy(v).sub(c); const l = nn.length() || 1; nn.multiplyScalar(1 / l);
      v.copy(c).addScaledVector(nn, r); P.setXYZ(i, v.x, v.y, v.z); N.setXYZ(i, nn.x, nn.y, nn.z);
    }
    g.computeBoundingSphere(); return g;
  });
}
/** rounded cylinder from y = 0 to h (top radius first), edge bevel b */
function rcyl(rt, rb = rt, h = .1, b = .01, seg = 32) {
  b = Math.max(1e-4, Math.min(b, rt * .98, rb * .98, h / 2 * .98));
  return memo(GEO, `rc${rt}|${rb}|${h}|${b}|${seg}`, () => {
    const pts = [new THREE.Vector2(0, 0)];
    const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= 4; i++) { const a = a0 + (a1 - a0) * i / 4; pts.push(new THREE.Vector2(cx + Math.cos(a) * b, cy + Math.sin(a) * b)); } };
    arc(rb - b, b, -PI / 2, 0); arc(rt - b, h - b, 0, PI / 2); pts.push(new THREE.Vector2(0, h));
    return new THREE.LatheGeometry(pts, seg);
  });
}
/** a solid of revolution from [r, y] points (bottom to top); smooth > 0 runs a spline through them */
function lath(pts, seg = 32, smooth = 0) {
  return memo(GEO, 'la' + JSON.stringify(pts) + '|' + seg + '|' + smooth, () => {
    let v = pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
    if (smooth > 0) { const a = v[0], b = v[v.length - 1], mid = new THREE.SplineCurve(v).getPoints(v.length * smooth); mid[0] = a; mid[mid.length - 1] = b; v = mid; }
    return new THREE.LatheGeometry(v, seg);
  });
}
/** a hollow vessel (cup, bowl, pot, vase): outer [r, y] points from the base edge up to the rim, wall t, floor bottomT */
function hollow(outer, t, bottomT, seg = 40) {
  bottomT ??= t * 1.6;
  return memo(GEO, 'ho' + JSON.stringify(outer) + '|' + t + '|' + bottomT + '|' + seg, () => {
    const sp = new THREE.SplineCurve(outer.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(Math.max(10, outer.length * 6));
    const top = sp[sp.length - 1], rim = t / 2, P = [new THREE.Vector2(0, 0), ...sp];
    for (let i = 1; i < 6; i++) { const a = i / 6 * PI; P.push(new THREE.Vector2(top.x - rim + Math.cos(a) * rim, top.y + Math.sin(a) * rim)); }
    for (let i = sp.length - 1; i >= 0; i--) { const p = sp[i]; if (p.y <= bottomT + t * .6) break; P.push(new THREE.Vector2(Math.max(.0005, p.x - t), p.y)); }
    const last = P[P.length - 1];
    P.push(new THREE.Vector2(Math.max(.0004, last.x - t * .5), bottomT), new THREE.Vector2(0, bottomT));
    return new THREE.LatheGeometry(P, seg);
  });
}
/** a ring-shaped shell (lamp shade, roll): walls from rb (bottom) to rt (top), thickness t, rounded rims */
function shell(rb, rt, h, t, seg = 40) {
  return memo(GEO, `sh${rb}|${rt}|${h}|${t}|${seg}`, () => {
    const P = [], n = 8, rr = t / 2;
    for (let i = 0; i <= n; i++) { const k = i / n; P.push(new THREE.Vector2(rb + (rt - rb) * k, h * k)); }
    for (let i = 1; i < 6; i++) { const a = i / 6 * PI; P.push(new THREE.Vector2(rt - rr + Math.cos(a) * rr, h + Math.sin(a) * rr)); }
    for (let i = n; i >= 0; i--) { const k = i / n; P.push(new THREE.Vector2(rb - t + (rt - rb) * k, h * k)); }
    for (let i = 1; i <= 6; i++) { const a = PI + i / 6 * PI; P.push(new THREE.Vector2(rb - rr + Math.cos(a) * rr, Math.sin(a) * rr)); }
    return new THREE.LatheGeometry(P, seg);
  });
}
/** a thick ring with rounded edges (paper roll, tape, bandage): outer ro, inner ri, height h */
function rollGeo(ro, ri, h, b = .004, seg = 40) {
  return memo(GEO, `ro${ro}|${ri}|${h}|${b}|${seg}`, () => {
    const P = [], arc = (cx, cy, a0, a1) => { for (let i = 0; i <= 4; i++) { const a = a0 + (a1 - a0) * i / 4; P.push(new THREE.Vector2(cx + Math.cos(a) * b, cy + Math.sin(a) * b)); } };
    arc(ri + b, b, PI, PI * 1.5); arc(ro - b, b, -PI / 2, 0); arc(ro - b, h - b, 0, PI / 2); arc(ri + b, h - b, PI / 2, PI); P.push(P[0].clone());
    return new THREE.LatheGeometry(P, seg);
  });
}
const sphere = () => memo(GEO, 'sph', () => new THREE.SphereGeometry(1, 32, 20));
const sphereLo = () => memo(GEO, 'sphl', () => new THREE.SphereGeometry(1, 16, 10));
const torus = (R, r, arc = TAU, rs = 12, ts = 40) => memo(GEO, `to${R}|${r}|${arc}|${rs}|${ts}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc));
const capsule = (r, len, seg = 16) => memo(GEO, `ca${r}|${len}|${seg}`, () => new THREE.CapsuleGeometry(r, len, 6, seg));
/** smooth-normal copy of a geometry for the ink hull (extrudes have split normals that would crack the outline) */
function hullOf(geo) {
  if (geo.userData.hull) return geo.userData.hull;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', geo.attributes.position.clone()); if (geo.index) g.setIndex(geo.index.clone());
  const m = mergeVertices(g, 1e-4); m.computeVertexNormals(); geo.userData.hull = m; return m;
}
/** a bevelled extrude of a 2D shape: thickness T along +z (from 0); flat: lie it down (thickness along +y, shape y -> -z) */
function extr(key, shapeFn, T, bev = .004, flat = false) {
  return memo(GEO, `ex${key}|${T}|${bev}|${flat}`, () => {
    const bt = Math.min(bev, T * .45), g = new THREE.ExtrudeGeometry(shapeFn(), { depth: Math.max(1e-4, T - bt * 2), bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt, bevelOffset: -bt, bevelSegments: 3, curveSegments: 20 });
    g.translate(0, 0, bt); if (flat) g.rotateX(-PI / 2);
    g.computeBoundingSphere(); hullOf(g); return g;
  });
}
/** rounded rectangle path (centred at cx, cy) into a Shape / Path */
function rr(p, w, h, r, cx = 0, cy = 0) {
  r = Math.max(1e-4, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4));
  const x0 = cx - w / 2 + r, x1 = cx + w / 2 - r, y0 = cy - h / 2 + r, y1 = cy + h / 2 - r;
  p.moveTo(x0, cy - h / 2); p.lineTo(x1, cy - h / 2); p.absarc(x1, y0, r, -PI / 2, 0, false); p.lineTo(cx + w / 2, y1); p.absarc(x1, y1, r, 0, PI / 2, false);
  p.lineTo(x0, cy + h / 2); p.absarc(x0, y1, r, PI / 2, PI, false); p.lineTo(cx - w / 2, y0); p.absarc(x0, y0, r, PI, PI * 1.5, false);
  return p;
}
const rrShape = (w, h, r) => rr(new THREE.Shape(), w, h, r);
function ringShape(ow, oh, or, iw, ih, ir, icx = 0, icy = 0) { const s = rrShape(ow, oh, or); s.holes.push(rr(new THREE.Path(), iw, ih, ir, icx, icy)); return s; }
/** planar uv 0..1 over a w x h rectangle centred on 0 (ShapeGeometry gives raw coordinates) */
function flatUV(geo, w, h) { const P = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < P.count; i++) uv.setXY(i, P.getX(i) / w + .5, P.getY(i) / h + .5); uv.needsUpdate = true; return geo; }
/** closed loops (rows of equal length) stitched into one smooth surface; the winding is turned to face outward */
function loft(rows) {
  const L = rows[0].length, pos = [], uv = [], idx = [];
  rows.forEach((row, i) => row.forEach((p, j) => { pos.push(p.x, p.y, p.z); uv.push(j / (L - 1), i / (rows.length - 1)); }));
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < L; j++) { const j2 = (j + 1) % L, a = i * L + j, b = i * L + j2, c = (i + 1) * L + j, d = (i + 1) * L + j2; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const mid = Math.floor(rows.length / 2), c = new THREE.Vector3(); rows[mid].forEach(p => c.add(p)); c.multiplyScalar(1 / L);
  const N = g.attributes.normal; let s = 0; rows[mid].forEach((p, j) => { const k = mid * L + j; s += (p.x - c.x) * N.getX(k) + (p.y - c.y) * N.getY(k) + (p.z - c.z) * N.getZ(k); });
  if (s < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  g.computeBoundingSphere(); return g;
}
/** many small parts merged into one vertex-coloured mesh (books, coins): parts = [{ geo, pos, rot, scl, color }] */
function mergeParts(parts) {
  const list = parts.map(p => {
    const g = p.geo.index ? p.geo.clone() : p.geo.clone(), m = new THREE.Matrix4().compose(new THREE.Vector3(...p.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot || [0, 0, 0]))), new THREE.Vector3(...(p.scl || [1, 1, 1])));
    g.applyMatrix4(m); g.clearGroups(); const c = new THREE.Color(p.color || '#ffffff'), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  });
  const out = mergeGeometries(list, false); out.computeBoundingSphere(); return out;
}
/** crumpled paper ball */
function crumple(seed, r) {
  return memo(GEO, `cr${seed}|${r}`, () => {
    const R = rnd(seed), base = new THREE.IcosahedronGeometry(1, 2); base.deleteAttribute('normal'); base.deleteAttribute('uv');
    const g = mergeVertices(base), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const k = r * (.82 + R() * .3); P.setXYZ(i, P.getX(i) * k, P.getY(i) * k, P.getZ(i) * k); }
    g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  });
}

// ---------- assembling ----------
function part(parent, geo, m, p, r, s) {
  const o = new THREE.Mesh(geo, m);
  if (p) o.position.set(p[0], p[1], p[2]);
  if (r) o.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0, r[3] || 'XYZ');
  if (s != null) { if (typeof s === 'number') o.scale.setScalar(s); else o.scale.set(s[0], s[1], s[2]); }
  parent.add(o); return o;
}
const grp = (parent, p, r) => { const g = new THREE.Group(); if (p) g.position.set(p[0], p[1], p[2]); if (r) g.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0, r[3] || 'XYZ'); parent?.add(g); return g; };
const deco = (o) => { o.userData.noOutline = true; o.castShadow = false; return o; };
/** a rod between two points (legs, rails, spokes): radius rA at a, rB at b */
function strut(parent, a, b, rA, m, rB = rA, seg = 16) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), L = d.length();
  const o = part(parent, rcyl(rB, rA, L, Math.min(rA, rB) * .45, seg), m, a);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}
/** a bendy tube through points (cords, stems, handles); r number or u => r */
function tube(parent, pts, r, m, seg = 24, rad = 10) {
  const n = new Noodle(m, seg, rad, typeof r === 'number' ? r : .01); n.setPath(pts.map(p => new THREE.Vector3(...p)), r);
  // the noodle's side triangles wind inward (the rig flips them the same way): turn them to face out
  const P = n.geometry.attributes.position, N = n.geometry.attributes.normal, ix = n.geometry.index.array, v = i => new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i));
  const a = v(ix[0]), fn = v(ix[1]).sub(a).cross(v(ix[2]).sub(a));
  if (fn.dot(new THREE.Vector3(N.getX(ix[0]), N.getY(ix[0]), N.getZ(ix[0]))) < 0) { for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } n.geometry.index.needsUpdate = true; }
  n.frustumCulled = true; parent.add(n); return n;
}
/** a label wrapped on a cylinder (centred on +z): radius, height, centre y, arc (radians) */
function band(parent, r, h, y, t, arc = PI, seg = 32) {
  const g = memo(GEO, `bd${r}|${h}|${arc}|${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg, 1, true, -arc / 2, arc));
  return deco(part(parent, g, texMat(t, { decal: true, rough: .6 }), [0, y, 0]));
}
const plane = (w, h) => memo(GEO, `pl${w}|${h}`, () => new THREE.PlaneGeometry(w, h));
function pointLight(parent, p, color, intensity, dist = 6) { const L = new THREE.PointLight(color, intensity, dist, 2); L.position.set(...p); parent.add(L); return L; }

// ink widths are quantised (every distinct width compiles its own outline shader)
const qInk = w => +(.0005 * Math.pow(1.25, Math.round(Math.log(Math.max(w, .0005) / .0005) / Math.log(1.25)))).toFixed(5);
const _s = new THREE.Vector3();
/** outline every part (small parts get a finer line) and set the userData conventions. size = the prop's main dimension. */
function finish(g, o, size, ud = {}) {
  const k = o.scale || 1, W = (ud.ink ?? .0085) * size * k; delete ud.ink;
  g.updateMatrixWorld(true);
  const list = []; g.traverse(m => { if (m.isMesh && !m.userData.isOutline && !m.userData.noOutline && !m.userData.olMesh) list.push(m); });
  for (const m of list) {
    const mt = Array.isArray(m.material) ? m.material[0] : m.material;
    if (mt?.transparent && (mt.opacity ?? 1) < .99) continue;
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    m.getWorldScale(_s);
    const r = m.geometry.boundingSphere.radius * Math.max(_s.x, _s.y, _s.z) * k;
    const w = qInk(m.userData.ink != null ? m.userData.ink * k : Math.min(W, Math.max(r * .1, W * .4)));
    const hull = m.geometry.userData.hull;
    if (hull) { const h = new THREE.Mesh(hull, outlineMat(INK, w, 1.2)); h.userData.isOutline = true; h.userData.noPick = true; h.castShadow = h.receiveShadow = false; m.add(h); m.userData.olMesh = h; }
    else addOutline(m, INK, w, 1.2);
  }
  Object.assign(g.userData, ud);
  return g;
}

// ---------- canvas painting ----------
const FONT = (wt, px) => `${wt} ${px}px Inter, Arial, sans-serif`;
function txt(x, s, X, Y, px, o = {}) {
  let p = px; x.font = FONT(o.wt ?? 800, p); x.textAlign = o.align ?? 'center'; x.textBaseline = 'middle';
  if (o.max) while (x.measureText(s).width > o.max && p > 8) { p -= 2; x.font = FONT(o.wt ?? 800, p); }
  if (o.stroke) { x.lineWidth = o.lw ?? p * .2; x.strokeStyle = o.stroke; x.lineJoin = 'round'; x.strokeText(s, X, Y); }
  x.fillStyle = o.color ?? '#1d1d24'; x.fillText(s, X, Y);
}
const box = (x, X, Y, w, h, r, fill) => { x.beginPath(); x.roundRect(X, Y, w, h, r); x.fillStyle = fill; x.fill(); };
const circ = (x, X, Y, r, fill) => { x.beginPath(); x.arc(X, Y, r, 0, TAU); x.fillStyle = fill; x.fill(); };
/** grey "text" bars (printed lines) */
function lines(x, X, Y, w, n, gap, h, color, R, minK = .45) { x.fillStyle = color; for (let i = 0; i < n; i++) { const k = i === n - 1 ? minK + R() * .3 : .75 + R() * .25; x.beginPath(); x.roundRect(X, Y + i * gap, w * k, h, h / 2); x.fill(); } }
function paintLabel(x, W, H, L) {
  x.fillStyle = L.bg || '#ffffff'; x.fillRect(0, 0, W, H);
  const body = (w, h, ox, oy) => {
    const cx = ox + w / 2, mw = w * (L.span ?? .5);
    if (L.band) { x.fillStyle = L.band; x.fillRect(ox, oy, w, h * .27); if (L.bandText) txt(x, L.bandText, cx, oy + h * .14, h * .16, { color: L.bandInk || '#ffffff', max: mw }); }
    txt(x, L.title || '', cx, oy + h * (L.band ? .55 : .45), h * (L.size ?? .27), { color: L.ink || '#1d2b4f', max: mw });
    if (L.sub) txt(x, L.sub, cx, oy + h * .81, h * .12, { color: L.ink || '#1d2b4f', wt: 600, max: mw });
  };
  if (L.vertical) { x.save(); x.translate(W / 2, H / 2); x.rotate(-PI / 2); body(H, W, -H / 2, -W / 2); x.restore(); } else body(W, H, 0, 0);
}
function paintView(x, W, H, view, R) {
  const sky = { day: ['#4f9fe0', '#cdeaf7'], night: ['#0c1430', '#2a3a70'], sunset: ['#f07a5a', '#ffd89a'], dusk: ['#363c7a', '#e98f78'] }[view] || ['#4f9fe0', '#cdeaf7'];
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  if (view === 'night') { for (let i = 0; i < 40; i++) circ(x, R() * W, R() * H * .6, 1 + R() * 1.5, 'rgba(255,255,240,.85)'); circ(x, W * .72, H * .2, W * .09, '#f6efd2'); }
  else if (view === 'sunset' || view === 'dusk') circ(x, W * .5, H * .62, W * .16, '#ffe9b0');
  else for (let c = 0; c < 3; c++) { const cx = R() * W, cy = H * (.1 + R() * .35), s = W * (.07 + R() * .05); for (let k = 0; k < 4; k++) circ(x, cx + (k - 1.5) * s * .9, cy + (k % 2) * s * .25, s * (k % 3 ? .7 : 1), 'rgba(255,255,255,.92)'); }
  const far = view === 'night' ? '#1b2448' : view === 'day' ? '#8db9cf' : '#a8667a';
  let bx = 0; while (bx < W) { const bw = W * (.1 + R() * .12), bh = H * (.12 + R() * .2); x.fillStyle = far; x.fillRect(bx, H - bh - H * .1, bw - 2, bh + H * .1);
    if (view !== 'day') for (let wy = H - bh - H * .08; wy < H - H * .12; wy += 12) for (let wx = bx + 5; wx < bx + bw - 8; wx += 10) if (R() < .45) { x.fillStyle = '#ffd77a'; x.fillRect(wx, wy, 4, 5); }
    bx += bw; }
  if (view === 'day') for (let i = 0; i < 6; i++) circ(x, (i + R() * .5) * W / 5, H * (.97 + R() * .03), W * (.1 + R() * .05), i % 2 ? '#5c9e4c' : '#4a8a3e');
}
function paintRug(x, W, H, pat, col, R) {
  const c2 = shade(col, .42), c3 = shade(col, -.38), cream = '#f1e4c8', gold = '#e9b44c';
  x.fillStyle = col; x.fillRect(0, 0, W, H);
  if (pat === 'rings') { for (let i = 9; i >= 1; i--) { x.beginPath(); x.arc(W / 2, H / 2, W / 2 * i / 9, 0, TAU); x.fillStyle = i % 2 ? col : (i % 4 === 0 ? cream : c3); x.fill(); } }
  else if (pat === 'border') {
    x.fillStyle = c3; x.fillRect(0, 0, W, H); x.fillStyle = col; x.fillRect(W * .08, H * .08, W * .84, H * .84);
    x.strokeStyle = cream; x.lineWidth = 7; x.strokeRect(W * .12, H * .12, W * .76, H * .76);
    const dia = (cx, cy, s, f) => { x.beginPath(); x.moveTo(cx, cy - s); x.lineTo(cx + s, cy); x.lineTo(cx, cy + s); x.lineTo(cx - s, cy); x.closePath(); x.fillStyle = f; x.fill(); };
    dia(W / 2, H / 2, W * .2, c3); dia(W / 2, H / 2, W * .13, cream); dia(W / 2, H / 2, W * .06, c2);
    for (const [cx, cy] of [[.2, .2], [.8, .2], [.2, .8], [.8, .8]]) dia(W * cx, H * cy, W * .045, cream);
    for (let i = 0; i < 24; i++) { circ(x, W * .04, H * (i + .5) / 24, 4, cream); circ(x, W * .96, H * (i + .5) / 24, 4, cream); }
  } else if (pat === 'diamond') {
    x.strokeStyle = gold; x.lineWidth = 4; x.globalAlpha = .85; const s = 64;
    for (let yy = -s; yy < H + s; yy += s) for (let xx = -s; xx < W + s; xx += s) { const cx = xx + ((yy / s) % 2 ? s / 2 : 0); x.beginPath(); x.moveTo(cx, yy - s * .28); x.lineTo(cx + s * .28, yy); x.lineTo(cx, yy + s * .28); x.lineTo(cx - s * .28, yy); x.closePath(); x.stroke(); }
    x.globalAlpha = 1; x.strokeStyle = c3; x.lineWidth = 26; x.strokeRect(13, 13, W - 26, H - 26); x.strokeStyle = gold; x.lineWidth = 5; x.strokeRect(30, 30, W - 60, H - 60);
  } else { const cs = [col, c2, cream, c3, col, gold]; for (let i = 0; i < 16; i++) { x.fillStyle = cs[i % cs.length]; x.fillRect(0, i * H / 16, W, H / 16 + 1); } }
  for (let i = 0; i < 2500; i++) { x.fillStyle = R() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)'; x.fillRect(R() * W, R() * H, 2, 2); }
}
function paintArt(x, W, H, kind, R, text) {
  if (kind === 'portrait') {
    x.fillStyle = pick(['#e9b77a', '#9fc4b8', '#c9a0c8', '#e98f78'], R); x.fillRect(0, 0, W, H);
    const shirt = pick(['#3f6fd1', '#d65a40', '#3f9c95', '#7a4fc4'], R); x.beginPath(); x.ellipse(W / 2, H * 1.02, W * .3, H * .38, 0, 0, TAU); x.fillStyle = shirt; x.fill();
    circ(x, W / 2, H * .44, W * .25, '#f6e3cc'); x.beginPath(); x.arc(W / 2, H * .44, W * .26, PI * 1.05, PI * 1.95); x.lineTo(W / 2, H * .3); x.fillStyle = pick(['#5b3b25', '#2a1d17', '#c98a45'], R); x.fill();
    x.strokeStyle = '#2a1d17'; x.lineWidth = 5; x.beginPath(); x.arc(W / 2, H * .44, W * .25, 0, TAU); x.stroke();
    circ(x, W * .42, H * .47, 5, '#2a1d17'); circ(x, W * .58, H * .47, 5, '#2a1d17'); x.beginPath(); x.arc(W / 2, H * .53, W * .05, .2, PI - .2); x.stroke();
  } else if (kind === 'abstract') {
    x.fillStyle = '#f3ead6'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) { x.fillStyle = pick(BRIGHT, R); x.globalAlpha = .9; if (R() < .5) circ(x, R() * W, R() * H, W * (.08 + R() * .18), x.fillStyle); else x.fillRect(R() * W * .8, R() * H * .8, W * (.15 + R() * .3), H * (.1 + R() * .3)); }
    x.globalAlpha = 1;
  } else {
    const sunset = kind === 'sunset', gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, sunset ? '#f08a5a' : '#6fb6ea'); gr.addColorStop(1, sunset ? '#ffd89a' : '#d6eef9'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    circ(x, W * (sunset ? .5 : .74), H * (sunset ? .55 : .24), W * .1, sunset ? '#fff0b8' : '#fff4c4');
    if (sunset) { x.fillStyle = '#3f6fa8'; x.fillRect(0, H * .6, W, H * .4); x.fillStyle = 'rgba(255,240,184,.6)'; for (let i = 0; i < 5; i++) x.fillRect(W * (.42 + R() * .06), H * (.64 + i * .06), W * (.16 - i * .02), 4); }
    else { x.fillStyle = '#7fbf5a'; x.beginPath(); x.ellipse(W * .3, H * 1.05, W * .6, H * .42, 0, 0, TAU); x.fill(); x.fillStyle = '#5c9e4c'; x.beginPath(); x.ellipse(W * .85, H * 1.1, W * .55, H * .45, 0, 0, TAU); x.fill(); }
  }
  if (text) txt(x, text, W / 2, H * .5, H * .2, { color: '#ffffff', stroke: '#2a1d17', max: W * .86 });
}
function paintPage(x, W, H, R, heading, ruled = false) {
  x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, W, H);
  if (ruled) { x.fillStyle = '#9cc0e6'; for (let y = H * .14; y < H; y += H * .055) x.fillRect(0, y, W, 2); x.fillStyle = '#e47a7a'; x.fillRect(W * .14, 0, 2, H); return; }
  if (heading) txt(x, heading, W / 2, H * .1, H * .065, { color: '#1d2b4f', max: W * .8 }); else lines(x, W * .12, H * .07, W * .5, 1, 0, H * .035, '#55606e', R);
  for (let p = 0; p < 3; p++) lines(x, W * .12, H * (.2 + p * .26), W * .76, 5, H * .042, H * .016, '#a7adb5', R);
}
function paintNote(x, W, H) {
  x.fillStyle = '#9fd09a'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#3f7a4a'; x.lineWidth = 6; x.strokeRect(8, 8, W - 16, H - 16); x.lineWidth = 2; x.strokeRect(18, 18, W - 36, H - 36);
  x.globalAlpha = .35; x.strokeStyle = '#3f7a4a'; for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(W * .52, H / 2, W * .08 + i * 4, H * .3 - i * 2, 0, 0, TAU); x.stroke(); } x.globalAlpha = 1;
  circ(x, W * .52, H * .5, H * .26, '#d7ecd0'); circ(x, W * .52, H * .44, H * .12, '#3f7a4a'); x.beginPath(); x.ellipse(W * .52, H * .7, H * .16, H * .1, 0, PI, TAU); x.fillStyle = '#3f7a4a'; x.fill();
  txt(x, '100', W * .14, H * .26, H * .2, { color: '#2f5f3a' }); txt(x, '100', W * .87, H * .76, H * .2, { color: '#2f5f3a' });
  txt(x, '100', W * .87, H * .26, H * .12, { color: '#2f5f3a' }); txt(x, '100', W * .14, H * .76, H * .12, { color: '#2f5f3a' });
}
function paintCheque(x, W, H, o) {
  x.fillStyle = '#e7f2e2'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(80,140,100,.18)'; x.lineWidth = 2; for (let i = 0; i < 14; i++) { x.beginPath(); for (let k = 0; k <= W; k += 8) x.lineTo(k, H * (i / 14) + Math.sin(k * .03 + i) * 6); x.stroke(); }
  x.strokeStyle = '#7aa58a'; x.lineWidth = 4; x.strokeRect(4, 4, W - 8, H - 8);
  txt(x, o.bank || 'MAPLE & BIRCH BANK', W * .05, H * .13, H * .085, { align: 'left', color: '#2f5f3a' });
  txt(x, 'No. ' + (o.no || '0427'), W * .95, H * .13, H * .07, { align: 'right', color: '#55606e', wt: 600 });
  txt(x, 'DATE', W * .62, H * .3, H * .055, { align: 'left', color: '#55606e', wt: 600 }); x.fillStyle = '#55606e'; x.fillRect(W * .69, H * .33, W * .26, 2);
  txt(x, o.date || '', W * .7, H * .27, H * .07, { align: 'left', color: '#1d3a8a', wt: 600 });
  txt(x, 'PAY TO THE ORDER OF', W * .05, H * .48, H * .055, { align: 'left', color: '#55606e', wt: 600 }); x.fillRect(W * .3, H * .52, W * .4, 2);
  txt(x, o.to || '', W * .31, H * .45, H * .08, { align: 'left', color: '#1d3a8a', wt: 600, max: W * .38 });
  box(x, W * .74, H * .37, W * .21, H * .16, 6, '#ffffff'); x.strokeStyle = '#7aa58a'; x.lineWidth = 2; x.strokeRect(W * .74, H * .37, W * .21, H * .16);
  txt(x, '$ ' + (o.amount ?? '1,000.00'), W * .845, H * .45, H * .09, { color: '#1d3a8a', max: W * .19 });
  x.fillStyle = '#55606e'; x.fillRect(W * .05, H * .67, W * .65, 2); txt(x, o.words || '', W * .06, H * .63, H * .065, { align: 'left', color: '#1d3a8a', wt: 600, max: W * .64 });
  txt(x, 'MEMO', W * .05, H * .84, H * .05, { align: 'left', color: '#55606e', wt: 600 }); x.fillRect(W * .13, H * .86, W * .3, 2);
  x.fillRect(W * .58, H * .86, W * .37, 2);
  if (o.signed !== false) { x.strokeStyle = '#1d3a8a'; x.lineWidth = 3; x.beginPath(); x.moveTo(W * .6, H * .84); for (let k = 0; k < 9; k++) x.quadraticCurveTo(W * (.62 + k * .035), H * (k % 2 ? .72 : .86), W * (.64 + k * .035), H * .8); x.stroke(); }
  txt(x, '⑆0123 4567⑆ 0427', W * .05, H * .95, H * .05, { align: 'left', color: '#55606e', wt: 600 });
}
function paintBoard(x, W, H, text, chalk) {
  const R = rnd(11);
  if (chalk) { x.fillStyle = '#2f5d46'; x.fillRect(0, 0, W, H); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${R() * .05})`; x.fillRect(R() * W, R() * H, 3, 3); } }
  else { x.fillStyle = '#f8f8f4'; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(160,170,180,.12)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.ellipse(R() * W, R() * H, 60, 20, .3, 0, TAU); x.fill(); } }
  const ink = chalk ? '#f4f1e6' : '#2c4fa8', ink2 = chalk ? '#f6d36a' : '#d23a2f';
  const L = String(text ?? '').split('\n').filter(Boolean);
  if (L.length) { L.forEach((s, i) => txt(x, s, W * .5, H * (L.length === 1 ? .5 : .22 + i * .6 / Math.max(1, L.length - 1)), H * (L.length === 1 ? .26 : .14), { color: i ? ink : ink2, wt: chalk ? 600 : 800, max: W * .88 })); return; }
  txt(x, chalk ? 'a² + b² = c²' : 'THE PLAN', W * .3, H * .16, H * .11, { color: ink2, max: W * .5 });
  x.strokeStyle = ink; x.lineWidth = chalk ? 6 : 5; x.lineCap = 'round';
  for (let i = 0; i < 3; i++) { circ(x, W * .08, H * (.36 + i * .16), 6, ink); x.beginPath(); x.moveTo(W * .12, H * (.36 + i * .16)); for (let k = 1; k < 8; k++) x.lineTo(W * (.12 + k * .045), H * (.36 + i * .16) + (k % 2 ? -6 : 6)); x.stroke(); }
  x.lineWidth = 5; x.beginPath(); x.moveTo(W * .62, H * .2); x.lineTo(W * .62, H * .82); x.lineTo(W * .95, H * .82); x.stroke();
  [.3, .45, .6].forEach((v, i) => { x.strokeRect(W * (.66 + i * .09), H * (.82 - v), W * .06, H * v); });
  x.strokeStyle = ink2; x.lineWidth = 6; x.beginPath(); x.moveTo(W * .66, H * .6); x.lineTo(W * .92, H * .22); x.stroke(); x.beginPath(); x.moveTo(W * .92, H * .22); x.lineTo(W * .87, H * .24); x.moveTo(W * .92, H * .22); x.lineTo(W * .915, H * .3); x.stroke();
}

// ================= furniture =================
function chair(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(WOODS, R), wd = mat(col, { rough: .7 }), dk = mat(shade(col, -.22), { rough: .7 }), S = .45;
  part(g, rbox(.46, .05, .44, .018), wd, [0, S - .025, 0]);
  for (const x of [-.19, .19]) {
    part(g, rcyl(.019, .023, S - .03, .007, 16), dk, [x, 0, .17]);
    part(g, rcyl(.021, .024, .97, .008, 16), dk, [x, 0, -.18]);
    part(g, rbox(.022, .022, .33, .008), dk, [x, .16, 0]);
  }
  part(g, rbox(.36, .02, .02, .008), dk, [0, .16, .17]);
  for (const y of [.63, .76]) part(g, rbox(.38, .045, .024, .01), wd, [0, y, -.18]);
  part(g, rbox(.47, .07, .045, .02), wd, [0, .935, -.18]);
  if (o.cushion) part(g, rbox(.41, .045, .39, .02), matte(o.cushion), [0, S + .02, .01]);
  const seat = S + (o.cushion ? .04 : 0);
  return finish(g, o, .97, { seat, top: seat });
}
function stool(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(WOODS, R), wd = mat(col, { rough: .7 }), dk = mat(shade(col, -.25), { rough: .7 }), S = .48;
  part(g, rcyl(.17, .16, .05, .02, 40), wd, [0, S - .05, 0]);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4, c = Math.cos(a), s = Math.sin(a); strut(g, [c * .1, S - .05, s * .1], [c * .165, 0, s * .165], .019, dk, .022); }
  part(g, torus(.14, .011), dk, [0, .17, 0], [PI / 2, 0, 0]);
  return finish(g, o, .5, { seat: S, top: S });
}
function bar_stool(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#d83a34', '#e0a33a', '#3f9c95', '#3f6fd1'], R), cu = gloss(col), mt = metal(), S = .78;
  part(g, rcyl(.22, .23, .035, .014, 40), mat('#7d8590', { rough: .55, metal: .2 }));
  part(g, rcyl(.028, .028, .62, .01, 20), mt, [0, .03, 0]);
  part(g, rcyl(.15, .12, .03, .01), mt, [0, .645, 0]);
  part(g, rcyl(.19, .175, .105, .042, 40), cu, [0, S - .105, 0]);
  part(g, torus(.165, .011), mt, [0, .3, 0], [PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + PI / 2; strut(g, [0, .3, 0], [Math.cos(a) * .165, .3, Math.sin(a) * .165], .008, mt); }
  return finish(g, o, .8, { seat: S, top: S });
}
function couch(o, n, w) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(FABRICS, R);
  const fab = matte(col), fabD = matte(shade(col, -.16)), leg = mat('#5b3b25', { rough: .6 });
  const d = .86, aw = .17, inner = w - aw * 2, cw = inner / n;
  part(g, rbox(w - .04, .26, d - .04, .06), fabD, [0, .23, 0]);
  part(g, rbox(w - .02, .56, .2, .08), fabD, [0, .58, -d / 2 + .1]);
  for (const s of [-1, 1]) {
    part(g, rbox(aw, .5, d, .07), fab, [s * (w / 2 - aw / 2), .35, 0]);
    part(g, rcyl(.095, .095, d + .01, .04, 28), fab, [s * (w / 2 - aw / 2), .58, -d / 2 - .005], [PI / 2, 0, 0]);
  }
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + cw * (i + .5);
    part(g, rbox(cw - .012, .13, d - .22, .05), fab, [x, .425, .08]);
    part(g, rbox(cw - .03, .38, .15, .065), fab, [x, .67, -d / 2 + .26], [-.14, 0, 0]);
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, rcyl(.018, .026, .11, .008, 16), leg, [x * (w / 2 - .07), 0, z * (d / 2 - .07)]);
  return finish(g, o, Math.max(w, .9), { seat: .49, top: .49 });
}
function bed(o) {
  const R = rnd(o.seed), g = new THREE.Group(), W = o.w ?? (o.single ? 1.0 : 1.5), L = 2.05, col = o.color || pick(FABRICS, R);
  const wood = mat(o.frame || pick(WOODS, R), { rough: .7 }), sheet = matte(o.sheet || '#f2ede2'), bl = matte(col), bl2 = matte(shade(col, .3)), pil = matte('#fbf8f2');
  part(g, rbox(W + .06, .2, L, .04), wood, [0, .22, 0]);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, rcyl(.03, .035, .13, .01, 16), wood, [x * (W / 2 - .02), 0, z * (L / 2 - .06)]);
  part(g, rbox(W, .22, L - .08, .08), sheet, [0, .42, .02]);
  part(g, rbox(W + .14, .95, .07, .05), wood, [0, .55, -L / 2 - .01]);
  part(g, rbox(W - .1, .45, .03, .02), mat(shade(o.frame || '#b77b45', .12), { rough: .7 }), [0, .78, -L / 2 + .035]);
  const np = W > 1.2 ? 2 : 1, pw = W / np - .12;
  for (let i = 0; i < np; i++) part(g, rbox(pw, .13, .34, .062), pil, [(-W / 2 + (i + .5) * W / np), .6, -L / 2 + .28], [-.22, 0, 0]);
  const dl = L * .62, dz = L / 2 - dl / 2 + .02;
  part(g, rbox(W + .05, .26, dl, .08), bl, [0, .43, dz]);
  part(g, rbox(W + .07, .075, .16, .035), bl2, [0, .545, dz - dl / 2 + .07]);
  return finish(g, o, L, { seat: .56, top: .56 });
}
function dining_table(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? 1.6, d = o.d ?? .9, H = o.h ?? .75;
  const col = o.color || pick(WOODS, R), top = mat(col, { rough: .6 }), dk = mat(shade(col, -.22), { rough: .7 });
  part(g, rbox(w, .055, d, .022), top, [0, H - .0275, 0]);
  part(g, rbox(w - .16, .09, d - .16, .015), dk, [0, H - .1, 0]);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, rcyl(.026, .036, H - .05, .01, 20), dk, [x * (w / 2 - .1), 0, z * (d / 2 - .1)]);
  return finish(g, o, w, { top: H });
}
function coffee_table(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? 1.0, d = .55, H = .42;
  const col = o.color || pick(WOODS, R), top = mat(col, { rough: .55 }), dk = mat(shade(col, -.25), { rough: .7 });
  part(g, rbox(w, .06, d, .025), top, [0, H - .03, 0]);
  part(g, rbox(w - .14, .025, d - .12, .01), dk, [0, .12, 0]);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, rbox(.05, H - .05, .05, .018), dk, [x * (w / 2 - .06), (H - .05) / 2, z * (d / 2 - .06)]);
  return finish(g, o, w, { top: H });
}
function side_table(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick([...WOODS, '#e9e1cf', '#7fa79a'], R), bd = mat(col, { rough: .6 }), dk = mat(shade(col, -.22), { rough: .65 });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, rcyl(.018, .022, .13, .008, 16), dk, [x * .19, 0, z * .16]);
  part(g, rbox(.46, .44, .4, .025), bd, [0, .34, 0]);
  part(g, rbox(.5, .03, .43, .012), dk, [0, .575, 0]);
  part(g, rbox(.4, .16, .02, .008), mat(shade(col, .08), { rough: .6 }), [0, .46, .2]);
  part(g, sphere(), metal('#d9b45a'), [0, .46, .222], null, .018);
  return finish(g, o, .6, { top: .59 });
}
function desk(o) {
  const R = rnd(o.seed), g = new THREE.Group(), H = .75, w = o.w ?? 1.3;
  const top = mat(o.top || pick(WOODS, R), { rough: .55 }), col = o.color || pick(['#e9e1cf', '#7fa79a', '#3f6f8a', '#c98a55'], R), bd = mat(col, { rough: .65 }), fr = mat(shade(col, .08), { rough: .6 }), hd = metal();
  part(g, rbox(w, .045, .65, .015), top, [0, H - .0225, 0]);
  const px = w / 2 - .23;
  part(g, rbox(.42, H - .045, .6, .02), bd, [px, (H - .045) / 2, 0]);
  for (const y of [.13, .35, .57]) { part(g, rbox(.38, .19, .02, .008), fr, [px, y, .3 + .008]); part(g, capsule(.008, .1), hd, [px, y + .04, .325], [0, 0, PI / 2]); }
  part(g, rbox(.04, H - .045, .6, .012), bd, [-w / 2 + .03, (H - .045) / 2, 0]);
  part(g, rbox(w - .5, .3, .02, .008), bd, [-.17, .5, -.27]);
  return finish(g, o, w, { top: H });
}
function office_chair(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#35507f', '#2f3036', '#d65a40', '#3f9c95', '#5c9e4c'], R), fab = matte(col), base = mat('#2b2c31', { rough: .5 }), mt = metal();
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + PI / 2, c = Math.cos(a), s = Math.sin(a); strut(g, [0, .085, 0], [c * .29, .06, s * .29], .02, base, .016); part(g, sphere(), base, [c * .29, .03, s * .29], null, .03); }
  part(g, rcyl(.04, .046, .17, .012, 20), base, [0, .07, 0]);
  part(g, rcyl(.024, .024, .2, .008, 16), mt, [0, .22, 0]);
  part(g, rbox(.22, .04, .22, .012), base, [0, .41, 0]);
  part(g, rbox(.5, .09, .48, .042), fab, [0, .45, .01]);
  part(g, rbox(.07, .36, .03, .012), base, [0, .6, -.25], [-.08, 0, 0]);
  part(g, rbox(.46, .52, .08, .04), fab, [0, .88, -.27], [-.08, 0, 0]);
  part(g, rbox(.6, .025, .05, .01), base, [0, .41, -.02]);
  for (const s of [-1, 1]) { part(g, rbox(.035, .22, .035, .012), base, [s * .285, .52, -.02]); part(g, rbox(.07, .035, .26, .015), base, [s * .285, .64, 0]); }
  return finish(g, o, 1.1, { seat: .495, top: .495 });
}
function kitchen_counter(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? 1.2, d = .62, H = .92;
  const col = o.color || pick(['#eee6d6', '#9fbfa8', '#3f6f8a', '#e7c89a', '#c96a52'], R), fr = mat(col, { rough: .6 }), car = mat(shade(col, -.14), { rough: .7 });
  const topM = mat(o.top || pick(['#d9d2c4', '#b98a5a', '#5f6268'], R), { rough: .5 }), hd = metal();
  part(g, rbox(w - .04, .1, d - .1, .01), mat('#3a3330'), [0, .05, -.03]);
  part(g, rbox(w, H - .14, d - .04, .015), car, [0, .1 + (H - .14) / 2, -.02]);
  part(g, rbox(w + .03, .04, d + .02, .012), topM, [0, H - .02, 0]);
  const n = Math.max(1, Math.round(w / .6)), cw = w / n, fz = d / 2 - .03;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + cw * (i + .5);
    part(g, rbox(cw - .02, .5, .02, .008), fr, [x, .37, fz]);
    part(g, rbox(cw - .02, .2, .02, .008), fr, [x, .74, fz]);
    part(g, capsule(.008, .11), hd, [x, .79, fz + .022], [0, 0, PI / 2]);
    part(g, capsule(.008, .1), hd, [x + (i % 2 ? -1 : 1) * (cw / 2 - .06), .52, fz + .022]);
  }
  if (o.splash !== false) part(g, rbox(w + .03, .12, .02, .008), topM, [0, H + .06, -d / 2 + .02]);
  return finish(g, o, Math.max(w, .9), { top: H });
}
function wall_cabinet(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? .8, h = .7, d = .34, M = o.mount ?? 1.45;
  const col = o.color || pick(['#eee6d6', '#9fbfa8', '#3f6f8a', '#e7c89a'], R), fr = mat(col, { rough: .6 }), car = mat(shade(col, -.14), { rough: .7 });
  part(g, rbox(w, h, d, .015), car, [0, M + h / 2, d / 2]);
  const n = Math.max(1, Math.round(w / .4)), cw = w / n;
  for (let i = 0; i < n; i++) { const x = -w / 2 + cw * (i + .5); part(g, rbox(cw - .015, h - .03, .02, .008), fr, [x, M + h / 2, d + .01]); part(g, sphere(), metal(), [x + (i % 2 ? -1 : 1) * (cw / 2 - .05), M + .08, d + .03], null, .014); }
  return finish(g, o, Math.max(w, h), { wall: true, top: M + h });
}
function cabinet(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? 1.0, d = .46;
  const col = o.color || pick([...WOODS, '#7fa79a', '#e9e1cf', '#c96a52'], R), bd = mat(col, { rough: .6 }), dk = mat(shade(col, -.2), { rough: .65 }), fr = mat(shade(col, .07), { rough: .6 });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, rcyl(.02, .025, .09, .008, 16), dk, [x * (w / 2 - .05), 0, z * (d / 2 - .05)]);
  part(g, rbox(w, .77, d, .02), bd, [0, .08 + .385, 0]);
  part(g, rbox(w + .03, .03, d + .02, .012), dk, [0, .865, 0]);
  for (let r = 0; r < 3; r++) for (const s of [-1, 1]) { const y = .08 + .13 + r * .245, x = s * w / 4; part(g, rbox(w / 2 - .02, .22, .02, .008), fr, [x, y, d / 2 + .008]); part(g, sphere(), metal('#d9b45a'), [x, y, d / 2 + .03], null, .016); }
  return finish(g, o, w, { top: .88 });
}
/** shelf dressing: books (merged) and small objects on each board */
function dressShelves(g, ys, w, z0, depth, gap, R, bookish) {
  const books = [], bands = [], zf = z0 + depth;     // zf = front edge of the boards
  ys.forEach(y => {
    let x = -w / 2 + .01;
    while (x < w / 2 - .04) {
      const k = R();
      if (k < (bookish ? .82 : .5)) {
        const nB = 3 + Math.floor(R() * 7), lean = R() < .3;
        for (let b = 0; b < nB && x < w / 2 - .04; b++) {
          const t = .022 + R() * .024, h = Math.min(gap, .17 + R() * .1), dp = Math.min(depth - .02, .16 + R() * .06), c = pick(BOOKS, R);
          books.push({ geo: rbox(t, h, dp, .004, 1), pos: [x + t / 2, y + h / 2, zf - .015 - dp / 2], color: c });
          if (R() < .6) bands.push({ geo: rbox(t * .82, .012, .003, .001, 1), pos: [x + t / 2, y + h * .8, zf - .015 + .0005], color: R() < .5 ? '#f1e4c8' : '#e9b44c' });
          x += t + .002;
        }
        if (lean && x < w / 2 - .1) { const t = .03, h = Math.min(gap, .22), c = pick(BOOKS, R); books.push({ geo: rbox(t, h, .18, .004, 1), pos: [x + h * .2 + .01, y + h * .48, zf - .11], rot: [0, 0, -.38], color: c }); x += h * .45; }
        x += .02 + R() * .05;
      } else if (k < .64) {
        const n = 2 + Math.floor(R() * 3); let yy = y;
        for (let i = 0; i < n; i++) { const t = .025 + R() * .015, bw = .16 + R() * .05; books.push({ geo: rbox(bw, t, .2, .004, 1), pos: [x + .1, yy + t / 2, zf - .12], rot: [0, (R() - .5) * .2, 0], color: pick(BOOKS, R) }); yy += t; }
        x += .24;
      } else if (k < .78) {
        const r = .035 + R() * .015, h = .07 + R() * .06, c = pick(['#e2432f', '#e9b44c', '#5fae4a', '#a85a3a'], R);
        part(g, rcyl(r, r, h, .008, 24), gloss(c), [x + r, y, zf - .07]);
        part(g, rcyl(r * 1.02, r * 1.02, .02, .006, 24), mat(pick(['#e9e1cf', '#c9a14a', '#2f3036'], R)), [x + r, y + h, zf - .07]);
        x += r * 2 + .04;
      } else if (k < .9) {
        const pot = part(g, hollow([[.04, 0], [.045, .005], [.05, .07], [.055, .08]], .006, .01, 24), mat('#c96a43', { rough: .8 }), [x + .055, y, zf - .08]);
        for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + R(); part(pot, sphere(), mat(i % 2 ? '#5c9e4c' : '#3f8a3a', { rough: .8 }), [Math.cos(a) * .03, .1 + R() * .03, Math.sin(a) * .03], [0, -a, .5], [.04, .018, .025]); }
        x += .13;
      } else {
        const bw = .1 + R() * .08, bh = .06 + R() * .07;
        part(g, rbox(bw, bh, .14, .01), mat(pick(['#e9d9a8', '#c8995f', '#9fc4b8', '#e98f78'], R), { rough: .7 }), [x + bw / 2, y + bh / 2, zf - .085]);
        x += bw + .03;
      }
    }
  });
  if (books.length) { const m = part(g, mergeParts(books), vcMat(.75)); m.userData.ink = .0024; }
  if (bands.length) deco(part(g, mergeParts(bands), vcMat(.6)));
}
function shelf(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? .9, H = o.h ?? 1.6, d = .34, n = o.count ?? 4;
  const col = o.color || pick(WOODS, R), wd = mat(col, { rough: .7 }), dk = mat(shade(col, -.32), { rough: .8 });
  for (const s of [-1, 1]) part(g, rbox(.035, H, d, .012), wd, [s * (w / 2 - .0175), H / 2, 0]);
  part(g, rbox(w - .05, H - .02, .015, .005), dk, [0, H / 2, -d / 2 + .01]);
  const ys = []; for (let i = 0; i < n; i++) ys.push(.06 + (H - .085) * i / (n - 1));
  for (const y of ys) part(g, rbox(w - .06, .03, d - .02, .01), wd, [0, y, .005]);
  if (o.fill !== false) dressShelves(g, ys.slice(0, -1).map(y => y + .015), w - .08, -d / 2 + .02, d - .02, ys[1] - ys[0] - .05, R, false);
  return finish(g, o, H, { top: ys[n - 1] + .015, shelves: ys.map(y => y + .015) });
}
function bookshelf(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? .9, H = o.h ?? 1.85, d = .32, n = o.count ?? 5;
  const col = o.color || pick(WOODS, R), wd = mat(col, { rough: .65 }), dk = mat(shade(col, -.38), { rough: .8 });
  for (const s of [-1, 1]) part(g, rbox(.04, H - .04, d, .012), wd, [s * (w / 2 - .02), (H - .04) / 2, 0]);
  part(g, rbox(w + .04, .05, d + .03, .015), wd, [0, H - .025, .005]);
  part(g, rbox(w - .06, .07, .02, .008), wd, [0, .035, d / 2 - .02]);
  part(g, rbox(w - .06, H - .06, .015, .005), dk, [0, H / 2, -d / 2 + .01]);
  const ys = []; for (let i = 0; i < n; i++) ys.push(.07 + (H - .14) * i / n);
  for (const y of ys) part(g, rbox(w - .07, .025, d - .02, .008), wd, [0, y, .005]);
  if (o.fill !== false) dressShelves(g, ys.map(y => y + .0125), w - .1, -d / 2 + .02, d - .03, (H - .14) / n - .04, R, true);
  return finish(g, o, H, { top: H, shelves: ys.map(y => y + .0125) });
}
function wardrobe(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? 1.0, H = 2.0, d = .58, open = o.open ?? 0;
  const col = o.color || pick([...WOODS, '#e9e1cf', '#7fa79a'], R), bd = mat(col, { rough: .65 }), dk = mat(shade(col, -.2), { rough: .7 }), inner = matte(shade(col, -.45)), hd = metal('#d9b45a');
  const y0 = .08, h = H - y0 - .06;
  for (const s of [-1, 1]) part(g, rbox(.03, h, d, .01), bd, [s * (w / 2 - .015), y0 + h / 2, 0]);
  part(g, rbox(w, .03, d, .01), bd, [0, y0 + .015, 0]);
  part(g, rbox(w, .03, d, .01), bd, [0, y0 + h - .015, 0]);
  part(g, rbox(w - .04, h - .04, .02, .005), inner, [0, y0 + h / 2, -d / 2 + .015]);
  part(g, rbox(w + .06, .06, d + .05, .02), dk, [0, H - .03, 0]);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, rcyl(.025, .03, y0, .008, 16), dk, [x * (w / 2 - .05), 0, z * (d / 2 - .05)]);
  if (open > 0) {
    part(g, rcyl(.012, .012, w - .06, .005, 12), hd, [-w / 2 + .03, y0 + h - .14, 0], [0, 0, -PI / 2]);
    const nS = 4 + Math.floor(R() * 3);
    for (let i = 0; i < nS; i++) { const x = -w / 2 + .12 + i * (w - .24) / (nS - 1), c = pick(FABRICS, R); part(g, torus(.025, .004, PI), hd, [x, y0 + h - .14, 0], [0, PI / 2, 0]); part(g, rbox(.04, .62, .42, .02), matte(c), [x, y0 + h - .5, 0]); }
  }
  const doors = [];
  for (const s of [-1, 1]) {
    const piv = grp(g, [s * w / 2, 0, d / 2]); piv.rotation.y = s * open * 1.7; doors.push(piv);
    const cx = -s * (w / 4 - .004);
    part(piv, rbox(w / 2 - .008, h - .01, .025, .01), bd, [cx, y0 + h / 2, .0125]);
    for (const [py, ph] of [[y0 + h * .7, h * .44], [y0 + h * .24, h * .36]]) part(piv, rbox(w / 2 - .13, ph, .012, .006), dk, [cx, py, .029]);
    part(piv, capsule(.009, .16), hd, [-s * (w / 2 - .05), 1.05, .045]);
  }
  return finish(g, o, H, { top: H, doors, door: doors[0] });
}
function door(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? .9, h = o.h ?? 2.1, open = o.open ?? 0;
  const col = o.color || pick(['#8a5a3a', '#a46a3c', '#e9e1cf', '#3f6f8a', '#b8453a', '#6f8f6a'], R), dm = mat(col, { rough: .6 }), dk = mat(shade(col, -.14), { rough: .65 }), trim = mat(o.trim || '#efe6d4', { rough: .7 }), br = mat(GOLD, { rough: .3, metal: .3 });
  for (const s of [-1, 1]) part(g, rbox(.08, h + .05, .03, .01), trim, [s * (w / 2 + .04), (h + .05) / 2, .015]);
  part(g, rbox(w + .2, .09, .036, .012), trim, [0, h + .07, .018]);
  if (open > 0) deco(part(g, plane(w, h), o.beyond ? glow(o.beyond, 1.1) : matte('#1b1512'), [0, h / 2, .004]));
  const piv = grp(g, [-w / 2, 0, .03]); piv.rotation.y = -open * 1.75;
  part(piv, rbox(w - .006, h - .01, .045, .012), dm, [w / 2, h / 2, .0225]);
  for (const [px, py, ph] of [[-1, 1.48, .78], [1, 1.48, .78], [-1, .55, .72], [1, .55, .72]]) part(piv, rbox(w * .34, ph, .014, .007), dk, [w / 2 + px * w * .2, py * h / 2.1, .05]);
  for (const s of [1, -1]) { const z = s > 0 ? .045 : 0; part(piv, rcyl(.032, .032, .012, .004, 24), br, [w - .08, 1.0, z], [s * PI / 2, 0, 0]); strut(piv, [w - .08, 1.0, z], [w - .08, 1.0, z + s * .03], .009, br); part(piv, sphere(), br, [w - .08, 1.0, z + s * .046], null, [.03, .03, .022]); }
  return finish(g, o, h, { wall: true, door: piv, pivot: piv });
}
function curtainGeo(w, h, folds = 4, amp = .025, t = .014) {
  return memo(GEO, `cu${w}|${h}|${folds}|${amp}`, () => {
    const N = folds * 10, k = folds * TAU / w;
    const loop = (y, sc) => { const pts = [], f = 1 + .07 * (1 - y / h);
      for (let i = 0; i <= N; i++) { const x = w / 2 - w * i / N; pts.push(new THREE.Vector3(x * f, y, Math.sin(x * k) * amp + t / 2 * sc)); }
      for (let i = 0; i <= N; i++) { const x = -w / 2 + w * i / N; pts.push(new THREE.Vector3(x * f, y, Math.sin(x * k) * amp - t / 2 * sc)); }
      return pts; };
    return loft([loop(0, 0), loop(.005, .8), loop(.015, 1), loop(h - .01, 1), loop(h, 0)]);
  });
}
function windowProp(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? 1.0, h = o.h ?? 1.2, y0 = o.mount ?? .95, view = o.view || 'day';
  const fr = mat(o.frame || '#f1ebde', { rough: .6 });
  const t = canvasTex(256, Math.round(256 * h / w), (x, W, H) => paintView(x, W, H, view, rnd(o.seed + 3)));
  deco(part(g, plane(w - .06, h - .06), new THREE.MeshBasicMaterial({ map: t }), [0, y0 + h / 2, .012]));
  for (const s of [-1, 1]) part(g, rbox(.06, h, .08, .015), fr, [s * (w / 2 - .03), y0 + h / 2, .04]);
  for (const y of [y0 + .03, y0 + h - .03]) part(g, rbox(w, .06, .08, .015), fr, [0, y, .04]);
  part(g, rbox(.035, h - .1, .05, .01), fr, [0, y0 + h / 2, .035]);
  part(g, rbox(w - .1, .035, .05, .01), fr, [0, y0 + h * .58, .035]);
  part(g, rbox(w + .16, .045, .16, .015), fr, [0, y0 - .005, .08]);
  if (o.blinds) { const bm = mat('#f4efe3', { rough: .7 }); for (let y = y0 + h - .1; y > y0 + h * .3; y -= .055) part(g, rbox(w - .12, .012, .045, .005), bm, [0, y, .07], [.25, 0, 0]); }
  if (o.curtains !== false) {
    const cc = o.curtains && typeof o.curtains === 'string' ? o.curtains : pick(['#d65a40', '#3f9c95', '#e0a33a', '#7a5bb5', '#4a6fb5', '#c95a7a'], R), cm = matte(cc), rodM = mat('#5b3b25', { rough: .5 });
    const rodY = y0 + h + .14, cw = w * .36, ch = o.long ? rodY - .02 : h + .34;
    part(g, rcyl(.014, .014, w + .56, .006, 12), rodM, [-(w + .56) / 2, rodY, .21], [0, 0, -PI / 2]);
    for (const s of [-1, 1]) { part(g, sphere(), rodM, [s * (w / 2 + .3), rodY, .21], null, .028); part(g, rbox(.03, .05, .21, .01), rodM, [s * (w / 2 + .18), rodY, .105]); }
    for (const s of [-1, 1]) part(g, curtainGeo(cw, ch, 4), cm, [s * (w / 2 + .24 - cw / 2), rodY - ch, .2]);
  }
  return finish(g, o, Math.max(w, h), { wall: true, screen: t });
}
function rug(o) {
  const R = rnd(o.seed), g = new THREE.Group(), shape = o.shape || 'rect', w = o.w ?? (shape === 'round' ? 1.8 : shape === 'runner' ? .8 : 2.0), d = o.d ?? (shape === 'runner' ? 2.4 : 1.4);
  const col = o.color || pick(['#b8453a', '#3f6f8a', '#c9893a', '#5c8a5a', '#7a4f8a', '#2f4a6f'], R), pat = o.pattern || (shape === 'round' ? 'rings' : pick(['border', 'diamond', 'stripes'], R));
  const t = tex(`rug|${shape}|${pat}|${col}`, 512, Math.round(512 * (shape === 'round' ? 1 : d / w)), (x, W, H) => paintRug(x, W, H, pat, col, rnd(7))), T = .014, edge = matte(shade(col, -.35));
  if (shape === 'round') { part(g, rcyl(w / 2, w / 2, T, .006, 64), edge); deco(part(g, memo(GEO, 'circ' + w, () => new THREE.CircleGeometry(w / 2 - .005, 64)), texMat(t, { rough: .95 }), [0, T + .0008, 0], [-PI / 2, 0, 0])); }
  else part(g, rbox(w, T, d, .006, 2), [edge, edge, texMat(t, { rough: .95 }), edge, edge, edge], [0, T / 2, 0]);
  return finish(g, o, .5, { top: T, solid: false });
}
function picture_frame(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? .5, h = o.h ?? .4, fw = .045, fd = .035, stand = o.mount === 0, y = stand ? 0 : (o.mount ?? 1.55);
  const fc = o.frame || pick(['#c9a14a', '#6b4329', '#2f3036', '#f1ebde', '#b5793f'], R), fm = mat(fc, { rough: .45, metal: fc === '#c9a14a' ? .3 : 0 });
  const art = o.tex || canvasTex(320, Math.round(320 * h / w), (x, W, H) => paintArt(x, W, H, o.art || pick(['landscape', 'portrait', 'abstract', 'sunset'], R), rnd(o.seed + 9), o.text));
  const hold = grp(g, stand ? [0, h / 2 + fw + .005, .03] : [0, y, 0], stand ? [-.14, 0, 0] : null);
  part(hold, rbox(w + fw * 2, fw, fd, .012), fm, [0, h / 2 + fw / 2, fd / 2]);
  part(hold, rbox(w + fw * 2, fw, fd, .012), fm, [0, -h / 2 - fw / 2, fd / 2]);
  for (const s of [-1, 1]) part(hold, rbox(fw, h + .002, fd, .012), fm, [s * (w / 2 + fw / 2), 0, fd / 2]);
  part(hold, rbox(w + .004, h + .004, .01, .002), matte('#f3ecdc'), [0, 0, .01]);
  deco(part(hold, plane(w - .05, h - .05), texMat(art, { rough: .7 }), [0, 0, .0155]));
  if (stand) strut(g, [0, h * .7, -.01], [0, 0, -.12], .008, fm);
  return finish(g, o, Math.max(w, h) + fw * 2, { wall: !stand, screen: art });
}
function wall_clock(o) {
  const R = rnd(o.seed), g = new THREE.Group(), r = o.r ?? .16, y = o.mount ?? 2.0;
  const rim = gloss(o.color || pick(['#2f3036', '#e2432f', '#3f6fd1', '#b5793f', '#3f9c95'], R)), dk = mat(DARK, { rough: .5 });
  part(g, rcyl(r, r, .05, .018, 48), rim, [0, y, 0], [PI / 2, 0, 0]);
  const face = tex('clockface', 256, 256, (x, W, H) => {
    circ(x, W / 2, H / 2, W / 2, '#f7f1e3');
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, big = i % 5 === 0, r0 = W * (big ? .37 : .41), r1 = W * .45; x.strokeStyle = '#2a1d17'; x.lineWidth = big ? 6 : 2; x.beginPath(); x.moveTo(W / 2 + Math.sin(a) * r0, H / 2 - Math.cos(a) * r0); x.lineTo(W / 2 + Math.sin(a) * r1, H / 2 - Math.cos(a) * r1); x.stroke(); }
    [[12, 0], [3, PI / 2], [6, PI], [9, PI * 1.5]].forEach(([n, a]) => txt(x, String(n), W / 2 + Math.sin(a) * W * .28, H / 2 - Math.cos(a) * W * .28, W * .14, { color: '#2a1d17' }));
  });
  deco(part(g, memo(GEO, 'circ' + (r - .015), () => new THREE.CircleGeometry(r - .015, 48)), texMat(face, { rough: .6 }), [0, y, .0506]));
  part(g, torus(r - .012, .008, TAU, 10, 48), rim, [0, y, .05]);
  const [hh, mm] = String(o.time || '10:10').split(':').map(Number);
  const hour = grp(g, [0, y, .056]), minute = grp(g, [0, y, .062]);
  part(hour, rbox(.016, r * .5, .006, .003, 1), dk, [0, r * .2, 0]); part(minute, rbox(.011, r * .74, .006, .003, 1), dk, [0, r * .3, 0]);
  hour.rotation.z = -((hh % 12) + (mm || 0) / 60) / 12 * TAU; minute.rotation.z = -(mm || 0) / 60 * TAU;
  part(g, sphere(), mat('#e2432f'), [0, y, .066], null, [.012, .012, .006]);
  return finish(g, o, r * 2, { wall: true, hands: { hour, minute } });
}
// ================= lights =================
function floor_lamp(o) {
  const R = rnd(o.seed), g = new THREE.Group(), on = o.lit !== false;
  const sc = o.color || pick(['#f1dfb5', '#e9a35a', '#9fc4b8', '#e57a5a'], R), shadeM = mat(sc, { rough: .8 }), pole = mat(o.pole || '#c9a25a', { rough: .35, metal: .3 }), base = mat(DARK, { rough: .5 });
  part(g, rcyl(.15, .17, .04, .015, 40), base);
  part(g, rcyl(.016, .016, 1.4, .006, 16), pole, [0, .035, 0]);
  part(g, sphere(), pole, [0, .75, 0], null, .024);
  part(g, shell(.23, .14, .3, .008), shadeM, [0, 1.3, 0]);
  if (on) deco(part(g, lath([[.124, .296], [.163, .15], [.214, .004]], 40), glow('#ffe2a8', 1.1), [0, 1.3, 0]));
  part(g, rcyl(.02, .02, .05, .006, 16), base, [0, 1.42, 0]);
  const bulb = deco(part(g, sphere(), on ? glow('#fff2cc', 3) : mat('#f4ecd8', { rough: .2 }), [0, 1.42, 0], null, .045));
  const L = pointLight(g, [0, 1.4, 0], '#ffcf8a', on ? (o.intensity ?? 3) : 0, 7);
  return finish(g, o, 1.65, { light: L, bulb });
}
function desk_lamp(o) {
  const R = rnd(o.seed), g = new THREE.Group(), on = o.lit !== false, col = o.color || pick(['#e2432f', '#3f6fd1', '#3f9c95', '#f6c945', '#2f3036'], R), bd = gloss(col), jt = metal();
  part(g, rcyl(.08, .085, .025, .01, 32), bd);
  part(g, sphere(), jt, [0, .035, -.02], null, .016);
  strut(g, [0, .035, -.02], [0, .25, -.08], .011, bd);
  part(g, sphere(), jt, [0, .25, -.08], null, .016);
  strut(g, [0, .25, -.08], [0, .36, .08], .01, bd);
  const head = grp(g, [0, .36, .1], [PI - .55, 0, 0]);
  part(head, hollow([[.03, 0], [.045, .03], [.07, .09], [.075, .1]], .004, .008, 32), bd, [0, -.02, 0]);
  part(head, sphere(), jt, [0, -.025, 0], null, .016);
  if (on) deco(part(head, memo(GEO, 'circ.06', () => new THREE.CircleGeometry(.06, 32)), glow('#fff2cc', 2.6), [0, .068, 0], [-PI / 2, 0, 0]));
  const p = new THREE.Vector3(0, .1, 0).applyEuler(head.rotation).add(head.position);
  const L = pointLight(g, [p.x, p.y, p.z], '#ffd9a0', on ? (o.intensity ?? 1.2) : 0, 2.5);
  return finish(g, o, .45, { light: L });
}
function hanging(o, withShade) {
  const R = rnd(o.seed), g = new THREE.Group(), C0 = o.ceiling ?? 3.0, drop = o.drop ?? (withShade ? .8 : 1.0), on = o.lit !== false;
  const dk = mat(DARK, { rough: .5 });
  part(g, rcyl(.05, .05, .025, .01, 24), dk, [0, C0 - .025, 0]);
  const piv = grp(g, [0, C0, 0]);
  part(piv, rcyl(.004, .004, drop - .06, .002, 8), dk, [0, -drop + .06, 0]);
  part(piv, rcyl(.018, .02, .05, .006, 16), dk, [0, -drop + .02, 0]);
  let lightY = -drop - .05;
  if (withShade) {
    const col = o.color || pick(['#6f9c7a', '#e2432f', '#f6c945', '#3f6f8a', '#2f3036'], R);
    part(piv, hollow([[.03, 0], [.08, .04], [.18, .16], [.2, .19]], .006, .01, 40), gloss(col), [0, -drop + .05, 0], [PI, 0, 0]);
    if (on) deco(part(piv, memo(GEO, 'circ.172', () => new THREE.CircleGeometry(.172, 40)), glow('#ffe9b8', 1.6), [0, -drop - .115, 0], [PI / 2, 0, 0]));
    lightY = -drop - .16;
  }
  const bulbG = lath([[0, 0], [.012, .003], [.03, .025], [.036, .05], [.03, .08], [.016, .1], [.016, .115]], 24, 3);
  const bulb = deco(part(piv, bulbG, on ? glow('#ffe3a8', 3) : mat('#f4ecd8', { rough: .2 }), [0, -drop - .095, 0]));
  const L = pointLight(piv, [0, lightY, 0], '#ffc985', on ? (o.intensity ?? (withShade ? 3.5 : 4)) : 0, 9);
  return finish(g, o, withShade ? .4 : .25, { light: L, pivot: piv, bulb });
}
// ================= kitchen =================
function fridge(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = .74, d = .68, H = 1.8, open = o.open ?? 0;
  const col = o.color || pick(['#f1efe9', '#9fd3c7', '#f2c1b0', '#c9d6e3', '#e9d9a8'], R), bd = mat(col, { rough: .6 }), inner = mat('#eef6f8', { rough: .6 }), hd = metal('#c9d0d8');
  const y0 = .04, T = .04;
  part(g, rbox(w - .06, y0, d - .1, .01), mat(DARK), [0, y0 / 2, 0]);
  for (const s of [-1, 1]) part(g, rbox(T, H - y0, d, .015), bd, [s * (w / 2 - T / 2), y0 + (H - y0) / 2, 0]);
  part(g, rbox(w, T, d, .015), bd, [0, H - T / 2, 0]);
  part(g, rbox(w, T, d, .015), bd, [0, y0 + T / 2, 0]);
  part(g, rbox(w - .02, H - y0 - .02, T, .01), inner, [0, y0 + (H - y0) / 2, -d / 2 + T / 2]);
  part(g, rbox(w - .06, .03, d - .06, .008), inner, [0, 1.27, 0]);
  if (open > 0) {
    const glass = mat('#cfe8f0', { rough: .2 });
    for (const y of [.45, .75, 1.02]) part(g, rbox(w - .09, .012, d - .12, .004), glass, [0, y, -.02]);
    deco(part(g, rbox(.24, .012, .05, .005), glow('#fff8e0', 1.5), [0, 1.25, .1]));
    part(g, rbox(.07, .19, .07, .01), mat('#f4f1ea'), [-.2, .55, -.05]); part(g, rbox(.072, .06, .072, .008), mat('#3f6fd1'), [-.2, .62, -.05]);
    part(g, rcyl(.04, .04, .1, .01), gloss('#e2432f'), [.05, .456, -.08]); part(g, rcyl(.041, .041, .02, .006), mat('#e9e1cf'), [.05, .556, -.08]);
    part(g, extr('cheese', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(.12, 0); s.lineTo(0, .07); s.closePath(); return s; }, .06, .006), mat('#f6c945', { rough: .6 }), [.12, .756, .02], [-PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) part(g, sphere(), mat(i % 2 ? '#5fae4a' : '#e2432f', { rough: .5 }), [-.18 + i * .09, 1.06, .05], null, .035);
    part(g, rbox(.16, .1, .12, .02), gloss('#9fc4b8'), [.18, 1.082, -.08]);
  }
  const mk = (y1, y2, hy, hl) => {
    const piv = grp(g, [-w / 2, 0, d / 2]); piv.rotation.y = -open * 1.85 * (y1 < 1 ? 1 : .0);
    part(piv, rbox(w, y2 - y1, .06, .028), bd, [w / 2, (y1 + y2) / 2, .03]);
    part(piv, capsule(.012, hl), hd, [w - .07, hy, .075]);
    for (const [a, b] of [[hy - hl / 2, 0], [hy + hl / 2, 0]]) strut(piv, [w - .07, a, .06], [w - .07, a, .075], .008, hd);
    return piv;
  };
  const main = mk(y0 + .008, 1.27, .95, .34), top = mk(1.285, H - .005, 1.42, .16);
  if (open > 0) for (const y of [.5, .95]) { part(main, rbox(w - .12, .1, .07, .015), inner, [w / 2, y, -.04]); for (let i = 0; i < 3; i++) part(main, rcyl(.025, .025, .14, .008, 16), gloss(pick(BRIGHT, R)), [.15 + i * .2, y - .03, -.04]); }
  if (o.note !== false) {
    const nt = tex('fridgenote', 128, 160, (x, W, H) => { x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, W, H); x.strokeStyle = '#3f6fd1'; x.lineWidth = 5; x.lineCap = 'round'; circ(x, W * .5, H * .3, W * .14, 'rgba(0,0,0,0)'); x.beginPath(); x.arc(W * .5, H * .3, W * .14, 0, TAU); x.stroke(); x.beginPath(); x.moveTo(W * .5, H * .4); x.lineTo(W * .5, H * .66); x.moveTo(W * .3, H * .5); x.lineTo(W * .7, H * .5); x.moveTo(W * .5, H * .66); x.lineTo(W * .34, H * .86); x.moveTo(W * .5, H * .66); x.lineTo(W * .66, H * .86); x.stroke(); x.strokeStyle = '#e2432f'; x.beginPath(); x.arc(W * .82, H * .14, 12, 0, TAU); x.stroke(); });
    part(top, rbox(.13, .16, .003, .001, 1), [mat(PAPER), mat(PAPER), mat(PAPER), mat(PAPER), texMat(nt), mat(PAPER)], [w * .4, 1.56, .0615]);
    part(top, sphere(), gloss('#e2432f'), [w * .4, 1.63, .066], null, [.012, .012, .007]);
    part(main, sphere(), gloss('#f6c945'), [w * .3, 1.12, .066], null, [.014, .014, .008]); part(main, sphere(), gloss('#3f9c95'), [w * .55, 1.05, .066], null, [.014, .014, .008]);
  }
  return finish(g, o, H, { top: H, door: main, doors: [main, top] });
}
function stove(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = .76, d = .64, H = .92, on = !!o.lit;
  const col = o.color || pick(['#f1efe9', '#e2432f', '#2f3036', '#9fd3c7', '#e9c46a'], R), bd = mat(col, { rough: .45 }), top = mat('#2b2c31', { rough: .4 }), hd = metal(), black = mat('#1d1d21', { rough: .5 });
  part(g, rbox(w, H - .03, d, .02), bd, [0, (H - .03) / 2, 0]);
  part(g, rbox(w, .03, d, .01), top, [0, H - .015, 0]);
  part(g, rbox(w, .16, .05, .02), bd, [0, H + .07, -d / 2 + .025]);
  [[-.18, .12, .08], [.18, .12, .065], [-.18, -.13, .065], [.18, -.13, .08]].forEach(([x, z, r], i) => {
    part(g, rcyl(r, r, .012, .004, 32), black, [x, H, z]);
    part(g, torus(r * .78, .006, TAU, 8, 32), hd, [x, H + .013, z], [PI / 2, 0, 0]);
    if (on && i === 0) deco(part(g, torus(r * .5, .009, TAU, 8, 32), glow('#ff6a2a', 2.5), [x, H + .014, z], [PI / 2, 0, 0]));
  });
  for (let i = 0; i < 4; i++) part(g, rcyl(.022, .024, .024, .006, 20), mat(DARK, { rough: .4 }), [(-1.5 + i) * .15, H - .08, d / 2], [PI / 2, 0, 0]);
  part(g, rbox(w - .06, .48, .03, .014), bd, [0, .43, d / 2 + .01]);
  part(g, rbox(w - .26, .2, .006, .003), on ? glow('#ffb05a', 1.3) : gloss('#26272d'), [0, .45, d / 2 + .027]);
  part(g, capsule(.011, w - .2), hd, [0, .7, d / 2 + .065], [0, 0, PI / 2]);
  for (const s of [-1, 1]) strut(g, [s * (w / 2 - .14), .7, d / 2 + .02], [s * (w / 2 - .14), .7, d / 2 + .065], .009, hd);
  part(g, rbox(w - .06, .11, .02, .01), bd, [0, .1, d / 2 + .005]);
  return finish(g, o, H, { top: H + .012 });
}
function sink(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? .9, d = .62, H = .92;
  const col = o.color || pick(['#eee6d6', '#9fbfa8', '#3f6f8a', '#e7c89a', '#c96a52'], R), fr = mat(col, { rough: .6 }), car = mat(shade(col, -.14), { rough: .7 });
  const topM = mat(o.top || pick(['#d9d2c4', '#b98a5a', '#5f6268'], R), { rough: .5 }), steel = metal('#c3cbd3'), dark = mat('#5f666e', { rough: .4 });
  part(g, rbox(w - .04, .1, d - .1, .01), mat('#3a3330'), [0, .05, -.03]);
  part(g, rbox(w, .62, d - .04, .015), car, [0, .41, -.02]);
  part(g, rbox(w, .16, .02, .008), fr, [0, .8, d / 2 - .03]);
  for (const s of [-1, 1]) part(g, rbox(.02, .16, d - .04, .006), car, [s * (w / 2 - .01), .8, -.02]);
  part(g, rbox(w, .16, .02, .006), car, [0, .8, -d / 2 + .02]);
  for (const s of [-1, 1]) { part(g, rbox(w / 2 - .02, .56, .02, .008), fr, [s * w / 4, .4, d / 2 - .03]); part(g, capsule(.008, .1), metal(), [s * .05, .52, d / 2 - .012]); }
  part(g, extr('sinktop' + w, () => ringShape(w + .03, d + .02, .012, .52, .36, .05, 0, -.01), .04, .005, true), topM, [0, H - .04, 0]);
  part(g, extr('sinkliner', () => ringShape(.545, .385, .06, .52, .36, .05), .14, .003, true), steel, [0, H - .18, .01]);
  part(g, rbox(.53, .012, .37, .004), steel, [0, H - .174, .01]);
  part(g, rcyl(.025, .025, .004, .0015), dark, [0, H - .168, .01]);
  part(g, rcyl(.025, .028, .04, .008, 20), steel, [0, H, -.24]);
  strut(g, [0, H + .03, -.24], [0, H + .3, -.24], .014, steel);
  part(g, torus(.08, .014, PI, 10, 24), steel, [0, H + .3, -.16], [0, PI / 2, 0]);
  strut(g, [0, H + .3, -.08], [0, H + .26, -.08], .015, steel);
  for (const s of [-1, 1]) part(g, rcyl(.018, .022, .035, .008, 16), steel, [s * .1, H, -.24]);
  return finish(g, o, Math.max(w, .9), { top: H });
}
function microwave(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = .5, h = .3, d = .38, on = !!o.lit;
  const col = o.color || pick(['#ecebe6', '#2f3036', '#e2432f', '#9fd3c7'], R), bd = mat(col, { rough: .45 }), dk = gloss('#23262c');
  for (const s of [-1, 1]) part(g, rbox(.04, .012, .04, .004), mat(DARK), [s * .2, .006, .12]);
  part(g, rbox(w, h, d, .03), bd, [0, h / 2 + .01, 0]);
  part(g, rbox(w * .7, h - .04, .02, .01), mat(shade(col, -.06), { rough: .45 }), [-w * .14, h / 2 + .01, d / 2 + .005]);
  part(g, rbox(w * .52, h - .1, .006, .004), on ? glow('#ffd27a', 1.4) : dk, [-w * .16, h / 2 + .01, d / 2 + .017]);
  const disp = tex('mwdisp' + (o.text || '12:00'), 128, 48, (x, W, H) => { x.fillStyle = '#10241a'; x.fillRect(0, 0, W, H); txt(x, o.text || '12:00', W / 2, H / 2 + 2, H * .62, { color: '#7dff9a' }); });
  part(g, rbox(.1, .036, .006, .003, 1), [dk, dk, dk, dk, new THREE.MeshBasicMaterial({ map: disp }), dk], [w * .355, h - .045, d / 2 + .003]);
  for (let i = 0; i < 6; i++) part(g, rbox(.026, .018, .008, .004, 1), mat(shade(col, -.25)), [w * .355 + (i % 2 - .5) * .036, h - .1 - Math.floor(i / 2) * .03, d / 2 + .003]);
  part(g, capsule(.008, .16), metal(), [w * .2 - .015, h / 2 + .01, d / 2 + .03]);
  return finish(g, o, w, { top: h + .01 });
}
function breadShape(w = .11, h = .12) {
  const s = new THREE.Shape(); s.moveTo(-w / 2 + .01, 0); s.lineTo(w / 2 - .01, 0); s.quadraticCurveTo(w / 2, 0, w / 2, .01); s.lineTo(w / 2, h * .6);
  s.bezierCurveTo(w / 2 + w * .1, h * .98, w * .08, h * 1.04, 0, h * .9); s.bezierCurveTo(-w * .08, h * 1.04, -w / 2 - w * .1, h * .98, -w / 2, h * .6);
  s.lineTo(-w / 2, .01); s.quadraticCurveTo(-w / 2, 0, -w / 2 + .01, 0); return s;
}
function toaster(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#d6dce2', '#e2432f', '#9fd3c7', '#f6c945', '#f1efe9'], R);
  const bd = col === '#d6dce2' ? metal(col) : gloss(col), dk = mat(DARK);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, rcyl(.012, .012, .01, .004), dk, [x * .1, 0, z * .05]);
  part(g, rbox(.28, .19, .16, .035, 4), bd, [0, .105, 0]);
  for (const z of [-.03, .03]) part(g, rbox(.2, .006, .022, .003, 1), mat('#1d1d21'), [0, .2, z]);
  if (o.toast !== false) for (const z of [-.03, .03]) part(g, extr('slice', () => breadShape(), .014, .003), [mat('#f2d9a6', { rough: .9 }), mat('#c98a45', { rough: .8 })], [0, .13, z - .007]);
  part(g, rbox(.022, .03, .045, .008), dk, [.15, .15, 0]);
  part(g, rcyl(.014, .016, .014, .005, 16), dk, [.08, .06, .08], [PI / 2, 0, 0]);
  return finish(g, o, .28, { top: .2 });
}
function kettle(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#e2432f', '#3f9c95', '#f6c945', '#d6dce2', '#2f4a7a'], R), bd = col === '#d6dce2' ? metal(col) : gloss(col), dk = mat(DARK, { rough: .5 });
  part(g, lath([[0, 0], [.08, 0], [.095, .012], [.105, .06], [.095, .13], [.07, .18], [.055, .198], [0, .2]], 40, 3), bd);
  part(g, rcyl(.05, .055, .016, .006, 32), dk, [0, .19, 0]);
  part(g, sphere(), dk, [0, .215, 0], null, [.016, .013, .016]);
  tube(g, [[.08, .06, 0], [.125, .1, 0], [.155, .155, 0], [.17, .18, 0]], u => .022 - .011 * u, bd);
  tube(g, [[-.06, .17, 0], [-.05, .26, 0], [0, .29, 0], [.05, .26, 0], [.06, .17, 0]], .011, dk);
  return finish(g, o, .25, { top: .2, grip: { at: [0, .29, 0], rot: [0, 0, 0] } });
}
function mug(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#f4f1ea', '#e2432f', '#f6c945', '#3f6fd1', '#3f9c95', '#ee7fa6'], R), body = gloss(col);
  part(g, hollow([[.036, 0], [.041, .004], [.042, .03], [.043, .095]], .005, .01, 40), body);
  const fill = o.fill ?? 'coffee';
  if (fill !== 'none') deco(part(g, memo(GEO, 'circ.0372', () => new THREE.CircleGeometry(.0372, 32)), mat({ coffee: '#5a3622', tea: '#b5652a', cocoa: '#7a4a32', milk: '#f7f4ec' }[fill] || '#5a3622', { rough: .3 }), [0, .078, 0], [-PI / 2, 0, 0]));
  part(g, torus(.026, .0065, PI, 10, 24), body, [.047, .05, 0], [0, 0, -PI / 2]);
  const print = o.text ? 'text' : (o.print ?? pick(['none', 'smile', 'heart', 'none'], R));
  if (print !== 'none') {
    const ink = col === '#f4f1ea' || col === '#f6c945' ? '#2a1d17' : '#ffffff';
    const t = tex(`mugprint|${print}|${o.text || ''}|${ink}`, 256, 128, (x, W, H) => {
      x.clearRect(0, 0, W, H); x.fillStyle = 'rgba(0,0,0,0)';
      if (print === 'text') txt(x, o.text, W / 2, H / 2, H * .36, { color: ink, max: W * .44 });
      else if (print === 'heart') { x.fillStyle = '#e2432f'; x.beginPath(); x.moveTo(W / 2, H * .82); x.bezierCurveTo(W * .3, H * .6, W * .38, H * .15, W / 2, H * .35); x.bezierCurveTo(W * .62, H * .15, W * .7, H * .6, W / 2, H * .82); x.fill(); }
      else { x.strokeStyle = ink; x.lineWidth = 7; x.lineCap = 'round'; circ(x, W * .44, H * .38, 7, ink); circ(x, W * .56, H * .38, 7, ink); x.beginPath(); x.arc(W / 2, H * .45, H * .22, .35, PI - .35); x.stroke(); }
    });
    const m = texMat(t, { decal: true, rough: .4 }); m.transparent = true;
    deco(part(g, memo(GEO, 'mugband', () => new THREE.CylinderGeometry(.0438, .0432, .05, 32, 1, true, -PI * .45, PI * .9)), m, [0, .05, 0]));
  }
  return finish(g, o, .1, { top: .095, grip: { at: [.075, .05, 0], rot: [0, 0, 0] } });
}
function plate(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#3f6fd1', '#e2432f', '#3f9c95', '#e9b44c'], R);
  part(g, lath([[0, 0], [.07, 0], [.076, .004], [.085, .009], [.12, .017], [.13, .023], [.131, .026], [.126, .027], [.116, .021], [.085, .013], [.075, .012], [0, .012]], 48, 2), gloss(o.white || WHITE));
  part(g, torus(.122, .0028, TAU, 6, 64), gloss(col), [0, .0215, 0], [PI / 2, 0, 0], [1, 1, .5]);
  return finish(g, o, .26, { top: .012 });
}
function bowl(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#f4f1ea', '#e2432f', '#3f6fd1', '#f6c945', '#3f9c95'], R);
  part(g, hollow([[.04, 0], [.05, .008], [.075, .03], [.09, .062], [.092, .072]], .006, .012, 40), gloss(col));
  const fill = o.fill ?? pick(['soup', 'cereal', 'none'], R);
  if (fill !== 'none') {
    deco(part(g, memo(GEO, 'circ.079', () => new THREE.CircleGeometry(.079, 32)), mat(fill === 'soup' ? '#e9873a' : '#f7f1e3', { rough: .35 }), [0, .052, 0], [-PI / 2, 0, 0]));
    if (fill === 'cereal') for (let i = 0; i < 16; i++) { const a = R() * TAU, r = Math.sqrt(R()) * .066; part(g, torus(.007, .0032, TAU, 6, 12), mat(pick(['#e9a35a', '#d98a3a', '#f2c36a'], R)), [Math.cos(a) * r, .054, Math.sin(a) * r], [PI / 2 + (R() - .5) * .6, 0, R()]); }
    if (fill === 'soup') for (let i = 0; i < 5; i++) { const a = R() * TAU, r = Math.sqrt(R()) * .05; part(g, sphere(), mat(pick(['#5fae4a', '#f6c945'], R)), [Math.cos(a) * r, .053, Math.sin(a) * r], null, [.008, .003, .008]); }
  }
  return finish(g, o, .18, { top: .072 });
}
function pot(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick([CHROME, '#e2432f', '#3f6fd1', '#f6c945'], R), bd = col === CHROME ? metal(col) : gloss(col), dk = mat(DARK, { rough: .5 });
  part(g, hollow([[.115, 0], [.12, .008], [.12, .15], [.122, .16]], .006, .01, 48), bd);
  for (const s of [-1, 1]) part(g, torus(.025, .007, PI, 8, 16), dk, [s * .125, .13, 0], [PI / 2, 0, -s * PI / 2]);
  if (o.lid !== false) { part(g, lath([[0, 0], [.125, 0], [.126, .006], [.1, .024], [.05, .034], [0, .036]], 48, 2), bd, [0, .16, 0]); part(g, sphere(), dk, [0, .2, 0], null, [.018, .013, .018]); }
  return finish(g, o, .26, { top: .2 });
}
function pan(o) {
  const R = rnd(o.seed), g = new THREE.Group();
  part(g, hollow([[.1, 0], [.11, .006], [.13, .035], [.135, .045]], .005, .008, 48), mat('#2d2e33', { rough: .45 }));
  part(g, rbox(.03, .016, .03, .006), metal(), [.14, .036, 0]);
  part(g, capsule(.013, .18), mat(o.color || pick([DARK, '#e2432f', '#3f9c95', '#5b3b25'], R), { rough: .5 }), [.24, .05, 0], [0, 0, PI / 2 - .12]);
  if (o.food === 'egg') { part(g, lath([[0, 0], [.05, 0], [.055, .004], [.045, .008], [0, .009]], 32, 2), mat('#fbf8f0', { rough: .4 }), [0, .008, 0], null, [1, 1, .85]); part(g, sphere(), gloss('#f6b324'), [.008, .018, .004], null, [.02, .012, .02]); }
  return finish(g, o, .4, { top: .01, grip: { at: [.3, .057, 0], rot: [0, 0, 0] } });
}
function bottle(o) {
  const R = rnd(o.seed), kind = o.kind || pick(['water', 'soda', 'wine', 'juice'], R), g = new THREE.Group();
  const K = { water: { c: '#a8d8ea', cap: '#3f6fd1', lb: '#ffffff', ink: '#3f6fd1', h: .26, t: 'DRIPLY' }, soda: { c: '#4f9a5a', cap: '#e2432f', lb: '#e2432f', ink: '#ffffff', h: .25, t: 'FIZZLY' }, wine: { c: '#2e4a33', cap: '#7a1f2b', lb: '#f1e6cc', ink: '#7a1f2b', h: .32, t: 'VINO' }, juice: { c: '#f39a2a', cap: '#5fae4a', lb: '#fff4d6', ink: '#e2432f', h: .22, t: 'ORANGO' } }[kind] || { c: o.color || '#a8d8ea', cap: '#3f6fd1', lb: '#fff', ink: '#222', h: .25, t: '' };
  const h = K.h, neck = kind === 'wine' ? .62 : .55;
  part(g, lath([[0, 0], [.03, 0], [.036, .006], [.037, .02], [.037, h * neck], [.03, h * (neck + .1)], [.017, h * (neck + .2)], [.014, h * .86], [.014, h * .95], [0, h * .95]], 40, 3), gloss(o.color || K.c));
  part(g, rcyl(.0165, .0165, h * .07, .004, 20), mat(K.cap, { rough: .5 }), [0, h * .935, 0]);
  const t = tex(`btl|${kind}|${o.text || K.t}`, 512, 128, (x, W, H) => paintLabel(x, W, H, { bg: K.lb, title: o.text || K.t, ink: K.ink, size: .42, span: .42 }));
  band(g, .0378, h * .22, h * .3, t, PI * 1.2);
  deco(part(g, capsule(.0035, h * .24), sheen(), [-.0235, h * .57, .0282], [0, -.7, 0], [.7, 1, .45]));
  return finish(g, o, h, { top: h, grip: { at: [0, h * .35, 0], rot: [0, 0, 0] } });
}
function glass(o) {
  const g = new THREE.Group(), fill = o.fill ?? 'water';
  part(g, hollow([[.03, 0], [.033, .004], [.037, .11]], .003, .012, 40), toonMat('#e6f6fb', { rough: .1, transparent: true, opacity: .32 }));
  part(g, torus(.0355, .0016, TAU, 6, 40), mat('#f4fbfd', { rough: .2 }), [0, .1105, 0], [PI / 2, 0, 0]);
  part(g, rcyl(.03, .031, .012, .004, 32), mat('#d9eef5', { rough: .15 }));
  if (fill !== 'empty') part(g, rcyl(.0322, .0295, .072, .002, 32), mat({ water: '#bfe4f2', milk: '#f7f4ec', juice: '#f7a83a', soda: '#7a3a20' }[fill] || '#bfe4f2', { rough: .25 }), [0, .012, 0]);
  deco(part(g, capsule(.0025, .06), sheen(), [-.021, .06, .026]));
  return finish(g, o, .11, { top: .11, grip: { at: [0, .06, 0], rot: [0, 0, 0] } });
}
function jar(o) {
  const R = rnd(o.seed), kind = o.kind || pick(['jam', 'honey', 'pickles'], R), g = new THREE.Group();
  const K = { jam: ['#b8323a', '#e2432f', 'JAM'], honey: ['#e8a530', '#f6c945', 'HONEY'], pickles: ['#7aa03a', '#2f6f3a', 'PICKLES'] }[kind] || ['#b8323a', '#e2432f', 'JAM'];
  part(g, lath([[0, 0], [.04, 0], [.045, .006], [.046, .02], [.046, .095], [.04, .105], [.036, .11], [0, .11]], 40, 3), gloss(o.color || K[0]));
  part(g, rcyl(.04, .04, .025, .008, 32), mat(K[1], { rough: .45 }), [0, .108, 0]);
  const t = tex('jar' + (o.text || K[2]), 512, 128, (x, W, H) => paintLabel(x, W, H, { bg: '#f4ead2', title: o.text || K[2], ink: '#5b3b25', size: .44, span: .42 }));
  band(g, .0468, .045, .05, t, PI * 1.2);
  deco(part(g, capsule(.003, .012), sheen(), [-.026, .087, .03], [0, -.7, 0], [.7, 1, .45]));
  return finish(g, o, .14, { top: .133, grip: { at: [0, .06, 0], rot: [0, 0, 0] } });
}
function cereal_box(o) {
  const R = rnd(o.seed), w = .2, h = .29, d = .07, g = new THREE.Group(), col = o.color || pick(['#f6c945', '#e2432f', '#3f6fd1', '#5fae4a', '#f08a2a'], R), name = o.text || pick(['STAR PUFFS', 'MEGA FLAKES', 'LOOPY BITS'], R);
  const t = tex(`cereal|${col}|${name}`, 280, 400, (x, W, H) => {
    x.fillStyle = col; x.fillRect(0, 0, W, H); x.fillStyle = shade(col, -.2); x.fillRect(0, 0, W, H * .1);
    const ws = name.split(' '); ws.forEach((s, i) => txt(x, s, W / 2, H * (.2 + i * .14), H * .13, { color: '#ffffff', stroke: '#2a1d17', max: W * .9 }));
    x.beginPath(); x.ellipse(W / 2, H * .7, W * .36, H * .1, 0, 0, PI); x.fillStyle = '#ffffff'; x.fill(); x.beginPath(); x.ellipse(W / 2, H * .7, W * .36, H * .04, 0, 0, TAU); x.fillStyle = '#f7f1e3'; x.fill();
    for (let i = 0; i < 9; i++) { x.strokeStyle = '#e98f2a'; x.lineWidth = 6; x.beginPath(); x.arc(W * (.25 + (i % 5) * .12), H * (.66 - Math.floor(i / 5) * .05), 9, 0, TAU); x.stroke(); }
    x.save(); x.translate(W * .8, H * .5); x.rotate(-.3); x.fillStyle = '#e2432f'; x.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, r = k % 2 ? 22 : 32; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); txt(x, 'NEW!', 0, 1, 15, { color: '#ffffff' }); x.restore();
    txt(x, '500 g', W * .15, H * .93, H * .045, { color: '#ffffff', wt: 600 });
  });
  const side = mat(shade(col, -.08), { rough: .7 });
  part(g, rbox(w, h, d, .006, 2), [side, side, side, side, texMat(t, { rough: .7 }), mat(col, { rough: .7 })], [0, h / 2, 0]);
  return finish(g, o, h, { top: h, grip: { at: [0, h * .45, 0], rot: [0, 0, 0] } });
}
// food builders (plain groups, outlined by the prop that holds them)
function appleG(parent, p, col, s = 1) {
  const a = grp(parent, p); a.scale.setScalar(s);
  part(a, lath([[0, .008], [.02, 0], [.036, .01], [.042, .03], [.04, .055], [.03, .07], [.012, .068], [0, .061]], 32, 3), mat(col, { rough: .5 }));
  part(a, capsule(.002, .016, 8), mat('#5b3b25'), [.002, .075, 0], [0, 0, -.25]);
  part(a, sphere(), mat('#5c9e4c', { rough: .7 }), [.012, .075, .004], [0, .4, -.5], [.012, .003, .02]);
  return a;
}
function bananaG(parent, p, ry = 0) {
  const b = grp(parent, p, [0, ry, 0]), y = mat('#f6d24a', { rough: .6 }), tip = mat('#5b4a2a');
  const pts = [[-.09, .03, -.01], [-.045, .016, .012], [0, .014, .02], [.045, .016, .012], [.09, .03, -.01]];
  tube(b, pts, u => .017 * (.3 + .7 * Math.pow(Math.sin(PI * u), .6)), y, 24, 10);
  part(b, sphere(), tip, [-.091, .031, -.01], null, .006); part(b, capsule(.0045, .012, 8), mat('#8a9a3a'), [.095, .034, -.012], [0, 0, -1.1]);
  return b;
}
function orangeG(parent, p) { const o = grp(parent, p); part(o, sphere(), mat('#f08a2a', { rough: .75 }), [0, .04, 0], null, .04); part(o, sphere(), mat('#5c9e4c'), [.006, .08, 0], [0, 0, .4], [.01, .003, .016]); return o; }
function grapesG(parent, p, R) { const gg = grp(parent, p), m = gloss('#7a3a8a'); for (let i = 0; i < 14; i++) { const lay = Math.floor(i / 5), a = i * 2.4; part(gg, sphere(), m, [Math.cos(a) * (.025 - lay * .006), .015 + lay * .02 + R() * .004, Math.sin(a) * (.025 - lay * .006)], null, .0125); } return gg; }
function cookieG(parent, p, r = .035) {
  const c = grp(parent, p); part(c, rcyl(r, r, .012, .005, 32), mat('#c98a4a', { rough: .8 }));
  for (let i = 0; i < 6; i++) { const a = i * 1.7, rr2 = r * (.25 + (i % 3) * .22); part(c, sphere(), mat('#4a2a1a'), [Math.cos(a) * rr2, .0115, Math.sin(a) * rr2], null, [.005, .003, .005]); }
  return c;
}
function fruit_bowl(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#b77b45', '#f4f1ea', '#3f6fd1', '#e9b44c'], R);
  part(g, hollow([[.06, 0], [.07, .01], [.12, .05], [.15, .085]], .008, .015, 48), gloss(col));
  appleG(g, [-.06, .04, .035], '#d8382f'); appleG(g, [.055, .04, -.035], '#8cc04a'); orangeG(g, [.01, .035, .07]); appleG(g, [-.02, .07, -.055], '#d8382f');
  grapesG(g, [.075, .05, .05], R); bananaG(g, [0, .09, -.005], .3);
  return finish(g, o, .3, { top: .085 });
}
function apple(o) { const g = new THREE.Group(); appleG(g, [0, 0, 0], o.color || pick(['#d8382f', '#8cc04a', '#e9a33a'], rnd(o.seed))); return finish(g, o, .08, { grip: { at: [0, .04, 0], rot: [0, 0, 0] } }); }
function banana(o) { const g = new THREE.Group(), n = o.count ?? 1; for (let i = 0; i < n; i++) bananaG(g, [0, i * .018, i * .012], (i - (n - 1) / 2) * .12); return finish(g, o, .18, { grip: { at: [.09, .03, -.01], rot: [0, 0, PI / 2] } }); }
function bread_loaf(o) {
  const g = new THREE.Group(), crust = mat(o.color || '#c98a45', { rough: .75 }), score = mat('#efcf98', { rough: .85 });
  part(g, lath([[0, -.135], [.04, -.132], [.062, -.118], [.072, -.08], [.074, 0], [.072, .08], [.062, .118], [.04, .132], [0, .135]], 40, 3), crust, [0, .059, 0], [0, 0, -PI / 2], [.8, 1, 1]);   // lathe turned along x, squashed in height
  for (const x of [-.07, 0, .07]) part(g, capsule(.0075, .05, 8), score, [x, .114, 0], [0, .75, PI / 2], [1, 1, .55]);
  return finish(g, o, .27, { top: .12, grip: { at: [0, .06, 0], rot: [0, 0, 0] } });
}
function pizzaG(parent, p, R, missing = 0) {
  const pz = grp(parent, p), r = .155, n = 8, cheese = mat('#f4c64a', { rough: .6 }), crust = mat('#d79a52', { rough: .75 }), pep = mat('#c2412f', { rough: .55 }), basil = mat('#3f8f3a'), slices = [];
  for (let i = 0; i < n - missing; i++) {
    const s = grp(pz), a0 = i * TAU / n + .012, a1 = (i + 1) * TAU / n - .012; slices.push(s);
    const wedge = memo(GEO, 'pzw' + i, () => { const gg = new THREE.CylinderGeometry(r - .012, r - .012, .012, 12, 1, false, a0, a1 - a0); gg.translate(0, .006, 0); hullOf(gg); return gg; });
    part(s, wedge, cheese, [0, .004, 0]);
    part(s, torus(r - .008, .012, a1 - a0, 8, 12), crust, [0, .012, 0], [-PI / 2, 0, a0 - PI / 2], [1, 1, .85]);
    for (const a of [a0, a1]) part(s, sphere(), crust, [Math.sin(a) * (r - .008), .012, Math.cos(a) * (r - .008)], null, [.012, .0102, .012]);
    for (let k = 0; k < 2 + (i % 2); k++) { const a = a0 + .12 + R() * (a1 - a0 - .24), rr2 = .045 + R() * .07; part(s, rcyl(.019, .019, .004, .0015, 20), pep, [Math.sin(a) * rr2, .016, Math.cos(a) * rr2]); }
    if (R() < .5) { const a = (a0 + a1) / 2, rr2 = .09; part(s, sphere(), basil, [Math.sin(a) * rr2, .018, Math.cos(a) * rr2], [0, a, 0], [.012, .002, .007]); }
  }
  pz.userData.slices = slices; return pz;
}
function pizza(o) { const g = new THREE.Group(), pz = pizzaG(g, [0, 0, 0], rnd(o.seed), o.missing ?? 0); return finish(g, o, .32, { top: .02, slices: pz.userData.slices }); }
function pizza_box(o) {
  const R = rnd(o.seed), g = new THREE.Group(), s = .38, h = .045, open = o.open ?? 0, card = mat('#d9b98a', { rough: .85 }), inner = mat('#e8d3ad', { rough: .9 });
  const t = tex('pizzabox' + (o.text || ''), 512, 512, (x, W, H) => { x.fillStyle = '#e3c79a'; x.fillRect(0, 0, W, H); circ(x, W / 2, H / 2, W * .3, '#e2432f'); circ(x, W / 2, H / 2, W * .26, '#ffffff'); circ(x, W / 2, H / 2, W * .24, '#e2432f'); txt(x, o.text || 'SLICE', W / 2, H * .44, H * .1, { color: '#ffffff', max: W * .42 }); txt(x, o.text ? '' : 'CITY', W / 2, H * .56, H * .1, { color: '#ffffff' }); txt(x, 'HOT & FRESH', W / 2, H * .88, H * .05, { color: '#a83a2a' }); });
  if (open <= 0) part(g, rbox(s, h, s, .006, 2), [card, card, texMat(t, { rough: .85 }), card, card, card], [0, h / 2, 0]);
  else {
    part(g, rbox(s, .006, s, .002, 1), card, [0, .003, 0]);
    for (const [x, z, w2, d2] of [[0, s / 2 - .003, s, .006], [0, -s / 2 + .003, s, .006], [s / 2 - .003, 0, .006, s], [-s / 2 + .003, 0, .006, s]]) part(g, rbox(w2, h, d2, .002, 1), card, [x, h / 2, z]);
    const piv = grp(g, [0, h, -s / 2]); piv.rotation.x = -open * 1.95;
    part(piv, rbox(s, .006, s, .002, 1), [card, card, texMat(t, { rough: .85 }), inner, card, card], [0, .003, s / 2]);
    part(piv, rbox(s, .03, .006, .002, 1), card, [0, -.012, s - .003]);
    pizzaG(g, [0, .006, 0], R, o.missing ?? 0).scale.setScalar(1.12);
  }
  return finish(g, o, s, { top: h });
}
function cake(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#f4a6c0', '#8a5a3a', '#f6e3b0', '#9fd3c7'], R), sponge = mat(col, { rough: .7 }), frost = mat(o.frosting || '#fbf3ea', { rough: .45 });
  part(g, lath([[0, 0], [.08, 0], [.08, .01], [.03, .02], [.025, .06], [.18, .07], [.18, .08], [0, .08]], 48), gloss(WHITE));
  const tier = (y, r, h) => {
    part(g, rcyl(r, r, h, .015, 48), sponge, [0, y, 0]);
    part(g, rcyl(r + .004, r + .004, .02, .009, 48), frost, [0, y + h - .012, 0]);
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + R() * .2, l = .01 + R() * .03; part(g, capsule(.0065, l, 8), frost, [Math.sin(a) * (r + .002), y + h - .01 - l / 2, Math.cos(a) * (r + .002)]); }
  };
  tier(.08, .14, .09); tier(.17, .095, .075);
  const nC = o.candles ?? 0;
  if (nC > 0) for (let i = 0; i < nC; i++) { const a = i / nC * TAU, x = Math.sin(a) * .05 * (nC > 1 ? 1 : 0), z = Math.cos(a) * .05 * (nC > 1 ? 1 : 0); part(g, rcyl(.006, .006, .06, .002, 12), mat(pick(['#3f6fd1', '#e2432f', '#f6c945', '#5fae4a'], R)), [x, .25, z]); deco(part(g, lath([[0, 0], [.008, .006], [.01, .016], [.006, .03], [0, .042]], 16, 3), glow('#ffcf5a', 3), [x, .315, z])); }
  else for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; part(g, sphere(), gloss('#d8282f'), [Math.sin(a) * .06, .255, Math.cos(a) * .06], null, .014); }
  return finish(g, o, .36, { top: .245 });
}
function cookie_jar(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#e2432f', '#b77b45', '#3f9c95', '#f6c945'], R);
  part(g, hollow([[.08, 0], [.088, .008], [.09, .15], [.07, .17], [.06, .18]], .004, .01, 40), toonMat('#e6f6fb', { rough: .1, transparent: true, opacity: .3 }));
  part(g, rcyl(.087, .089, .01, .004, 40), mat('#d6ecf2', { rough: .15 }));
  part(g, torus(.06, .005, TAU, 8, 40), mat('#d6ecf2', { rough: .15 }), [0, .18, 0], [PI / 2, 0, 0]);
  part(g, rcyl(.066, .066, .022, .008, 40), gloss(col), [0, .18, 0]);
  part(g, sphere(), gloss(col), [0, .21, 0], null, [.022, .018, .022]);
  for (let i = 0; i < 9; i++) { const a = R() * TAU, r = R() * .04; const c = cookieG(g, [Math.cos(a) * r, .011 + i * .015, Math.sin(a) * r], .03); c.rotation.set((R() - .5) * .8, R() * 3, (R() - .5) * .8); }
  // an opaque sticker (a see-through label inside a see-through jar sorts badly)
  const t = tex('cookielabel2' + (o.text || ''), 256, 96, (x, W, H) => { x.fillStyle = '#f7f1e3'; x.fillRect(0, 0, W, H); x.strokeStyle = '#c98a4a'; x.lineWidth = 8; x.strokeRect(6, 6, W - 12, H - 12); txt(x, o.text || 'COOKIES', W / 2, H / 2 + 2, H * .42, { color: '#8a4a2a', max: W * .8 }); });
  deco(part(g, memo(GEO, 'cjband', () => new THREE.CylinderGeometry(.0905, .0905, .05, 32, 1, true, -PI * .22, PI * .44)), texMat(t, { decal: true, rough: .6 }), [0, .075, 0]));
  deco(part(g, capsule(.0035, .08), sheen(), [-.0745, .1, .052], [0, -.96, 0], [.7, 1, .45]));
  return finish(g, o, .22, { top: .225, grip: { at: [0, .1, 0], rot: [0, 0, 0] } });
}
function cookie(o) { const g = new THREE.Group(); cookieG(g, [0, 0, 0]); return finish(g, o, .07, { top: .012, grip: { at: [0, .006, 0], rot: [-PI / 2, 0, 0] } }); }
// ================= bathroom =================
function bathtub(o) {
  const R = rnd(o.seed), g = new THREE.Group(), L = 1.6, W = .76, H = .66, col = o.color || pick(['#f4f2ee', '#f2b8c6', '#9fd3c7', '#2f4a6f'], R);
  const out = gloss(col), white = gloss('#f6f4ef'), gold = mat(GOLD, { rough: .3, metal: .3 }), chrome = metal();
  part(g, rbox(L - .04, H - .16, W - .04, .2, 4), out, [0, .14 + (H - .16) / 2, 0]);
  part(g, extr('tubrim', () => ringShape(L, W, .3, L - .14, W - .14, .25), .045, .012, true), white, [0, H - .01, 0]);
  if (o.water !== false) deco(part(g, memo(GEO, 'tubwater', () => flatUV(new THREE.ShapeGeometry(rrShape(L - .12, W - .12, .26), 16), L, W)), mat('#a9dcf0', { rough: .2 }), [0, H + .015, 0], [-PI / 2, 0, 0]));
  if (o.bubbles) for (let i = 0; i < 16; i++) part(g, sphere(), mat('#ffffff', { rough: .4 }), [.25 + R() * .4, H + .02, (R() - .5) * .45], null, [.03 + R() * .03, .02 + R() * .015, .03 + R() * .03]);
  if (o.duck) { const d = grp(g, [-.15, H + .015, .05]), ym = gloss('#f6c945'); part(d, sphere(), ym, [0, .03, 0], null, [.05, .035, .04]); part(d, sphere(), ym, [.035, .075, 0], null, .025); part(d, capsule(.007, .015, 8), mat('#f08a2a'), [.065, .072, 0], [0, 0, PI / 2]); part(d, sphere(), mat(DARK), [.05, .085, .015], null, .004); part(d, sphere(), mat(DARK), [.05, .085, -.015], null, .004); }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { strut(g, [x * (L / 2 - .2), .03, z * (W / 2 - .14)], [x * (L / 2 - .24), .18, z * (W / 2 - .17)], .026, gold, .04); part(g, sphere(), gold, [x * (L / 2 - .2), .032, z * (W / 2 - .14)], null, [.042, .032, .042]); }
  const fx = -L / 2 + .12;
  part(g, rcyl(.025, .03, .03, .008, 20), chrome, [fx, H + .03, 0]);
  strut(g, [fx, H + .05, 0], [fx, H + .22, 0], .014, chrome);
  part(g, torus(.06, .014, PI, 10, 24), chrome, [fx + .06, H + .22, 0]);
  for (const s of [-1, 1]) part(g, rcyl(.018, .022, .04, .008, 16), chrome, [fx - .02, H + .03, s * .1]);
  return finish(g, o, L, { top: H + .035, seat: H + .035 });
}
function toilet(o) {
  const col = o.color || '#f4f3ef', g = new THREE.Group(), wh = gloss(col), sh = gloss(shade(col, -.06)), open = !!o.open, chrome = metal();
  part(g, lath([[0, 0], [.13, 0], [.135, .01], [.12, .08], [.11, .18], [.15, .3], [.19, .38], [.195, .4], [.175, .405], [.14, .36], [.08, .33], [0, .32]], 40, 3), wh, [0, 0, .05], null, [1, 1, 1.22]);
  deco(part(g, memo(GEO, 'circ.13', () => new THREE.CircleGeometry(.13, 32)), mat('#a9d8ea', { rough: .2 }), [0, .345, .05], [-PI / 2, 0, 0], [1, 1.22, 1]));
  part(g, torus(.155, .028, TAU, 10, 48), wh, [0, .415, .05], [PI / 2, 0, 0], [1, 1.22, .5]);
  const piv = grp(g, [0, .43, -.18]); piv.rotation.x = open ? -(PI / 2 - .12) : 0;
  part(piv, rcyl(.19, .19, .025, .01, 40), sh, [0, -.008, .23], null, [1, 1, 1.22]);
  part(g, rbox(.42, .38, .19, .045), wh, [0, .59, -.2]);
  part(g, rbox(.45, .035, .21, .015), sh, [0, .795, -.2]);
  part(g, rbox(.06, .015, .015, .006), chrome, [.15, .72, -.1]);
  return finish(g, o, .8, { seat: .44, top: .81, lid: piv });
}
function bathroom_sink(o) {
  const col = o.color || '#f4f3ef', g = new THREE.Group(), wh = gloss(col), chrome = metal();
  part(g, lath([[0, 0], [.12, 0], [.12, .02], [.08, .06], [.06, .4], [.08, .62], [.1, .68], [0, .68]], 40, 3), wh);
  part(g, hollow([[.12, 0], [.2, .06], [.25, .12], [.26, .16]], .012, .03, 48), wh, [0, .68, 0], null, [1, 1, .78]);
  part(g, rbox(.34, .03, .1, .012), wh, [0, .825, -.165]);
  part(g, rcyl(.022, .026, .04, .008, 16), chrome, [0, .835, -.17]);
  strut(g, [0, .865, -.17], [0, .875, -.09], .012, chrome);
  for (const s of [-1, 1]) part(g, rcyl(.016, .02, .035, .007, 16), chrome, [s * .09, .835, -.17]);
  return finish(g, o, .85, { top: .84 });
}
function mirror(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? .55, h = o.h ?? .75, y = o.mount ?? 1.55, oval = (o.shape ?? pick(['rect', 'oval'], R)) === 'oval';
  const fm = mat(o.frame || pick(['#c9a14a', '#b77b45', '#2f3036', '#f1ebde'], R), { rough: .4 }), r = oval ? Math.min(w, h) / 2 : .05;
  const t = tex('mirrorglass', 256, 256, (x, W, H) => { const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#dbeef4'); gr.addColorStop(1, '#9fbecb'); x.fillStyle = gr; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(255,255,255,.55)'; x.save(); x.translate(W / 2, H / 2); x.rotate(-.7); x.fillRect(-W, -40, W * 2, 26); x.fillRect(-W, 10, W * 2, 10); x.restore(); });
  const shape = (ww, hh, rr2) => oval ? (() => { const s = new THREE.Shape(); s.absellipse(0, 0, ww / 2, hh / 2, 0, TAU, false); return s; })() : rrShape(ww, hh, rr2);
  part(g, extr(`mirframe${w}|${h}|${oval}`, () => { const s = shape(w + .09, h + .09, r + .045); const hole = new THREE.Path(); if (oval) hole.absellipse(0, 0, w / 2, h / 2, 0, TAU, true); else rr(hole, w, h, r); s.holes.push(hole); return s; }, .04, .01), fm, [0, y, 0]);
  deco(part(g, memo(GEO, `mirglass${w}|${h}|${oval}`, () => flatUV(new THREE.ShapeGeometry(shape(w + .01, h + .01, r + .005), 32), w, h)), texMat(t, { rough: .15 }), [0, y, .012]));
  return finish(g, o, Math.max(w, h), { wall: true });
}
function towel(o) {
  const R = rnd(o.seed), g = new THREE.Group(), M = o.mount ?? 1.15, col = o.color || pick(['#3f9c95', '#e98f78', '#f6c945', '#4a6fb5', '#f4f1ea'], R), chrome = metal(), zb = .07, rb = .011;
  for (const s of [-1, 1]) strut(g, [s * .28, M, 0], [s * .28, M, zb], .012, chrome);
  part(g, rcyl(rb, rb, .62, .005, 16), chrome, [-.31, M, zb], [0, 0, -PI / 2]);
  const geo = memo(GEO, 'towel' + M, () => {
    const rho = rb + .009, path = [];
    for (let i = 0; i <= 6; i++) path.push([M - .48 + .48 * i / 6, zb + rho]);
    for (let i = 1; i < 10; i++) { const a = i / 10 * PI; path.push([M + Math.sin(a) * rho, zb + Math.cos(a) * rho]); }
    for (let i = 0; i <= 6; i++) path.push([M - .4 * i / 6, zb - rho]);
    const W2 = .21, T = .006, sec = []; for (let i = 0; i <= 8; i++) sec.push([W2 - .004 - (W2 - .004) * 2 * i / 8, T]); for (let i = 1; i < 4; i++) { const a = PI / 2 + i / 4 * PI; sec.push([-W2 + .004 + Math.cos(a) * .004 * 0, Math.sin(a) * T]); } for (let i = 0; i <= 8; i++) sec.push([-(W2 - .004) + (W2 - .004) * 2 * i / 8, -T]); for (let i = 1; i < 4; i++) { const a = -PI / 2 + i / 4 * PI; sec.push([W2 - .004, Math.sin(a) * T]); }
    const rows = path.map(([y, z], i) => { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], ty = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(ty, tz) || 1, ny = tz / l, nz = -ty / l;
      const k = (i === 0 || i === path.length - 1) ? 0 : 1, sx = (i === 0 || i === path.length - 1) ? .985 : 1;
      return sec.map(([sx2, sn]) => new THREE.Vector3(sx2 * sx, y + ny * sn * k, z + nz * sn * k)); });
    return loft(rows);
  });
  const t = tex('towel' + col, 32, 256, (x, W, H) => { x.fillStyle = col; x.fillRect(0, 0, W, H); x.fillStyle = shade(col, .5); for (const v of [.06, .1, .9, .94]) x.fillRect(0, H * v, W, H * .025); });
  part(g, geo, texMat(t, { rough: .95 }));
  return finish(g, o, .6, { wall: true });
}
function towel_stack(o) {
  const R = rnd(o.seed), g = new THREE.Group(), n = o.count ?? 3; let y = 0;
  for (let i = 0; i < n; i++) { const c = pick(['#3f9c95', '#e98f78', '#f6c945', '#4a6fb5', '#f4f1ea'], R), h = .05; part(g, rbox(.32, h, .22, .024), matte(c), [(R() - .5) * .02, y + h / 2, (R() - .5) * .02], [0, (R() - .5) * .08, 0]); part(g, rbox(.322, .008, .222, .003, 1), matte(shade(c, .45)), [0, y + h * .3, 0]); y += h; }
  return finish(g, o, .32, { top: y });
}
function toilet_paper(o) {
  const g = new THREE.Group();
  part(g, rollGeo(.055, .02, .1, .007), matte('#fbf8f2'));
  deco(part(g, lath([[.0192, .099], [.0192, .001]], 24), mat('#c8995f')));
  return finish(g, o, .11, { top: .1, grip: { at: [0, .05, 0], rot: [0, 0, 0] } });
}
// ================= office + school =================
function boardProp(o, chalk) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? (chalk ? 1.6 : 1.2), h = o.h ?? (chalk ? .9 : .8), stand = !!o.stand && !chalk, y0 = o.mount ?? (stand ? 1.0 : chalk ? .85 : .95);
  const fm = chalk ? mat(o.frame || '#9a6a3c', { rough: .6 }) : metal('#d6dce2'), fw = .035, z0 = stand ? 0 : 0;
  const t = canvasTex(Math.round(512 * w / h), 512, (x, W, H) => paintBoard(x, W, H, o.text, chalk));
  const surf = chalk ? mat('#2f5d46', { rough: .95 }) : mat('#f8f8f4', { rough: .35 });
  part(g, rbox(w, h, .012, .004, 1), [surf, surf, surf, surf, texMat(t, { rough: chalk ? .95 : .35 }), surf], [0, y0 + h / 2, z0 + .008]);
  for (const s of [-1, 1]) { part(g, rbox(w + fw * 2, fw, .03, .008), fm, [0, y0 + h / 2 + s * (h / 2 + fw / 2), z0 + .015]); part(g, rbox(fw, h, .03, .008), fm, [s * (w / 2 + fw / 2), y0 + h / 2, z0 + .015]); }
  part(g, rbox(w * .6, .02, .06, .008), fm, [0, y0 - fw - .005, z0 + .04]);
  if (chalk) { for (let i = 0; i < 3; i++) part(g, capsule(.006, .05, 8), mat(i === 1 ? '#f6d36a' : '#f7f4ec'), [-.2 + i * .07, y0 - fw + .012, z0 + .045], [0, 0, PI / 2]); part(g, rbox(.12, .025, .045, .008), mat('#b77b45'), [.25, y0 - fw + .018, z0 + .045]); part(g, rbox(.12, .012, .045, .004), matte('#6f6f78'), [.25, y0 - fw + .0, z0 + .045]); }
  else for (let i = 0; i < 2; i++) part(g, capsule(.007, .1, 8), mat(i ? '#2c4fa8' : '#d23a2f', { rough: .5 }), [-.1 + i * .15, y0 - fw + .01, z0 + .045], [0, 0, PI / 2]);
  if (stand) {
    const leg = metal('#c3cbd3');
    for (const s of [-1, 1]) { const x = s * (w / 2 + fw + .02); part(g, rcyl(.016, .016, y0 + h + .05, .006, 12), leg, [x, .05, 0]); part(g, rbox(.04, .03, .55, .01), leg, [x, .05, 0]); for (const z of [-.25, .25]) part(g, sphere(), mat(DARK), [x, .025, z], null, .025); }
  }
  return finish(g, o, w, { wall: !stand, screen: t });
}
function school_desk(o) {
  const R = rnd(o.seed), g = new THREE.Group(), top = mat(o.top || pick(WOODS, R), { rough: .6 }), mt = mat(o.color || pick(['#6f7f90', '#3f6f8a', '#5c8a5a', '#2f3036'], R), { rough: .45, metal: .2 });
  part(g, rbox(.66, .03, .48, .012), top, [0, .735, 0]);
  part(g, rbox(.6, .012, .4, .004), mt, [0, .615, -.02]);
  for (const s of [-1, 1]) part(g, rbox(.012, .1, .4, .004), mt, [s * .3, .665, -.02]);
  part(g, rbox(.6, .1, .012, .004), mt, [0, .665, -.22]);
  part(g, rbox(.17, .025, .23, .004), mat('#3f6fd1'), [-.12, .635, -.02]); part(g, rbox(.17, .02, .23, .004), mat('#e2432f'), [-.1, .657, -.03], [0, .1, 0]);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, rcyl(.013, .013, .72, .005, 12), mt, [x * .29, 0, z * .2]);
  for (const s of [-1, 1]) part(g, rbox(.012, .012, .4, .004), mt, [s * .29, .12, 0]);
  part(g, rbox(.5, .006, .012, .002, 1), mat(shade(o.top || '#a46a3c', -.3)), [0, .751, -.2]);
  return finish(g, o, .75, { top: .75 });
}
function school_chair(o) {
  const R = rnd(o.seed), g = new THREE.Group(), pl = gloss(o.color || pick(['#e0a33a', '#3f6fd1', '#d65a40', '#3f9c95', '#5c9e4c'], R)), mt = mat('#6f7f90', { rough: .45, metal: .2 });
  part(g, rbox(.4, .035, .38, .016), pl, [0, .44, 0]);
  part(g, rbox(.38, .2, .025, .012), pl, [0, .72, -.2], [-.08, 0, 0]);
  for (const s of [-1, 1]) { strut(g, [s * .17, 0, .16], [s * .17, .43, .15], .012, mt); strut(g, [s * .17, 0, -.17], [s * .17, .82, -.21], .012, mt); }
  return finish(g, o, .82, { seat: .46, top: .46 });
}
function filing_cabinet(o) {
  const R = rnd(o.seed), g = new THREE.Group(), n = o.count ?? 4, w = .47, d = .62, H = .33 * n, open = o.open ?? -1;
  const col = o.color || pick(['#8f9aa6', '#6f8f7a', '#c9c2b2', '#3f6f8a'], R), bd = mat(col, { rough: .62, metal: .1 }), fr = mat(shade(col, .06), { rough: .6, metal: .1 }), hd = metal();
  part(g, rbox(w, H, d, .012), bd, [0, H / 2, 0]);
  for (let i = 0; i < n; i++) {
    const y = (i + .5) * H / n, hd2 = H / n - .02, out = i === open ? .34 : 0, dg = grp(g, [0, 0, out]);
    part(dg, rbox(w - .03, hd2, .02, .008), fr, [0, y, d / 2 + .01]);
    part(dg, rbox(.13, .022, .025, .008), hd, [0, y + .03, d / 2 + .03]);
    const lt = tex('fclabel' + i, 96, 40, (x, W, H2) => { x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, W, H2); txt(x, ['A-F', 'G-L', 'M-R', 'S-Z', 'MISC', 'OLD'][i % 6], W / 2, H2 / 2 + 1, H2 * .6, { color: '#1d2b4f' }); });
    part(dg, rbox(.07, .03, .004, .002, 1), [hd, hd, hd, hd, texMat(lt), hd], [0, y + .085, d / 2 + .021]);
    if (out > 0) {
      deco(part(g, plane(w - .05, hd2 - .01), matte('#1c1a1a'), [0, y, d / 2 + .001]));
      part(dg, rbox(w - .06, .01, out + .02, .003), fr, [0, y - hd2 / 2 + .01, d / 2 - out / 2]);
      for (const s of [-1, 1]) part(dg, rbox(.01, hd2 - .06, out + .02, .003), fr, [s * (w / 2 - .035), y - .02, d / 2 - out / 2]);
      for (let k = 0; k < 7; k++) part(dg, rbox(w - .1, hd2 - .08, .006, .002, 1), mat(pick(['#e9cf8f', '#7fb0c8', '#e9cf8f', '#e98f78'], R)), [0, y - .03 + (k % 2) * .01, d / 2 - .03 - k * .042]);
    }
  }
  return finish(g, o, H, { top: H });
}
function paper_stack(o) {
  const R = rnd(o.seed), g = new THREE.Group(), n = o.count ?? 30, T = .0011 * n + .002;
  const sideT = tex('paperside', 64, 64, (x, W, H) => { x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, W, H); x.fillStyle = '#d8d2c4'; for (let y = 4; y < H; y += 8) x.fillRect(0, y, W, 2); });
  const pg = tex('page' + (o.text || ''), 256, 362, (x, W, H) => paintPage(x, W, H, rnd(4), o.text));
  const side = texMat(sideT, { rough: .9 }), white = mat('#f7f3ea', { rough: .9 });
  part(g, rbox(.21, T, .297, .002, 1), [side, side, texMat(pg, { rough: .9 }), white, side, side], [0, T / 2, 0]);
  if (o.loose !== false) for (let i = 0; i < 2; i++) part(g, rbox(.21, .0012, .297, .0005, 1), [white, white, texMat(pg, { rough: .9 }), white, white, white], [(R() - .5) * .03, T + .0006 + i * .0013, (R() - .5) * .03], [0, (R() - .5) * .3, 0]);
  return finish(g, o, .3, { top: T + .003, grip: { at: [0, T / 2, 0], rot: [0, 0, 0] } });
}
function notebook(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#e2432f', '#3f6fd1', '#5fae4a', '#7a4fc4', '#f6c945', '#2f3036'], R), cv = mat(col, { rough: .6 }), white = mat('#fbf8f0', { rough: .9 }), mt = metal();
  const ruled = tex('ruled', 256, 330, (x, W, H) => paintPage(x, W, H, null, null, true));
  if (o.open) {
    for (const s of [-1, 1]) { part(g, rbox(.17, .003, .22, .001, 1), cv, [s * .087, .0015, 0]); part(g, rbox(.162, .008, .212, .002, 1), [white, white, texMat(ruled, { rough: .9 }), white, white, white], [s * .087, .007, 0]); }
    for (let i = 0; i < 11; i++) part(g, torus(.007, .0012, TAU, 6, 16), mt, [0, .009, -.1 + i * .02]);
    return finish(g, o, .34, { top: .011 });
  }
  const lb = tex('nblabel' + (o.text || 'NOTES'), 256, 128, (x, W, H) => { x.fillStyle = col; x.fillRect(0, 0, W, H); box(x, W * .12, H * .2, W * .76, H * .6, 14, '#fbf8f0'); txt(x, o.text || 'NOTES', W / 2, H / 2 + 2, H * .3, { color: '#1d2b4f', max: W * .66 }); });
  part(g, rbox(.17, .004, .22, .0015, 1), cv, [0, .002, 0]);
  part(g, rbox(.162, .01, .212, .002, 1), white, [.002, .009, 0]);
  part(g, rbox(.17, .004, .22, .0015, 1), [cv, cv, texMat(lb, { rough: .6 }), cv, cv, cv], [0, .016, 0]);
  for (let i = 0; i < 11; i++) part(g, torus(.0095, .0013, TAU, 6, 16), mt, [-.085, .009, -.1 + i * .02]);
  return finish(g, o, .22, { top: .018, grip: { at: [0, .009, 0], rot: [0, 0, 0] } });
}
function pen(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#3f6fd1', '#e2432f', '#2f3036', '#5fae4a'], R), bd = gloss(col), mt = metal();
  part(g, capsule(.0055, .11, 12), bd, [0, .0055, 0], [0, 0, PI / 2]);
  part(g, lath([[0, 0], [.0052, 0], [.0022, .016], [.0009, .021], [0, .022]], 12), mt, [.06, .0055, 0], [0, 0, -PI / 2]);
  part(g, rbox(.035, .0025, .004, .001, 1), mt, [-.04, .0115, 0]);
  return finish(g, o, .13, { grip: { at: [.02, .0055, 0], rot: [0, 0, PI / 2] } });
}
function envelope(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#f4efe3', '#d9b98a', '#f4efe3'], R), front = o.side === 'front' || !!o.text, pm = mat(col, { rough: .85 });
  const t = front ? tex('envfront' + (o.text || '') + col, 360, 180, (x, W, H) => { x.fillStyle = col; x.fillRect(0, 0, W, H); box(x, W * .8, H * .1, W * .13, H * .3, 4, '#e2432f'); circ(x, W * .865, H * .25, H * .07, '#f6c945'); x.strokeStyle = '#55606e'; x.lineWidth = 2; x.beginPath(); x.arc(W * .72, H * .27, H * .1, 0, TAU); x.stroke(); lines(x, W * .35, H * .55, W * .45, 3, H * .1, H * .045, '#55606e', rnd(2)); if (o.text) txt(x, o.text, W * .06, H * .2, H * .13, { align: 'left', color: '#d23a2f', max: W * .6 }); }) : null;
  part(g, rbox(.22, .004, .11, .0015, 1), front ? [pm, pm, texMat(t, { rough: .85 }), pm, pm, pm] : pm, [0, .002, 0]);
  if (!front) {
    part(g, extr('envflap', () => { const s = new THREE.Shape(); s.moveTo(-.108, .053); s.lineTo(.108, .053); s.lineTo(.008, -.008); s.quadraticCurveTo(0, -.013, -.008, -.008); s.closePath(); return s; }, .0014, .0005, true), mat(shade(col, -.06), { rough: .85 }), [0, .004, 0]);
    if (o.seal !== false) part(g, rcyl(.011, .011, .003, .0012, 20), gloss('#c0392b'), [0, .005, .006]);
  }
  return finish(g, o, .22, { top: .006, grip: { at: [-.09, .002, 0], rot: [-PI / 2, 0, 0] } });
}
function cheque(o) {
  const g = new THREE.Group(), t = canvasTex(512, 218, (x, W, H) => paintCheque(x, W, H, o)), pm = mat('#e7f2e2', { rough: .85 });
  part(g, rbox(.2, .0015, .085, .0006, 1), [pm, pm, texMat(t, { rough: .85 }), pm, pm, pm], [0, .00075, 0]);
  return finish(g, o, .2, { top: .0015, screen: t, grip: { at: [-.08, .001, 0], rot: [-PI / 2, 0, 0] } });
}
function sticky_note(o) {
  const R = rnd(o.seed), g = new THREE.Group(), s = .076, col = o.color || pick(['#f6e36a', '#f7a6c4', '#9fd8f0', '#b5e38a', '#f8b46a'], R);
  const geo = memo(GEO, 'sticky', () => { const b = rbox(s, s, .0012, .0005, 1, 12).clone(), P = b.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i), k = Math.max(0, (-s * .1 - y) / (s * .4)); P.setZ(i, P.getZ(i) + k * k * .012); } b.computeVertexNormals(); b.computeBoundingSphere(); return b; });
  const t = canvasTex(256, 256, (x, W, H) => { x.fillStyle = col; x.fillRect(0, 0, W, H); x.fillStyle = shade(col, -.06); x.fillRect(0, 0, W, H * .16); const L = String(o.text ?? '').split('\n'); if (o.text) L.forEach((l, i) => txt(x, l, W / 2, H * (.5 + (i - (L.length - 1) / 2) * .2), H * (L.length > 2 ? .15 : .19), { color: '#1d2b4f', max: W * .86 })); else lines(x, W * .14, H * .32, W * .72, 4, H * .14, H * .045, '#4a5f8a', rnd(3)); });
  const pm = mat(col, { rough: .85 }), stick = !!o.stick;
  part(g, geo, [pm, pm, pm, pm, texMat(t, { rough: .85 }), pm], stick ? [0, s / 2, .0006] : [0, .0006, 0], stick ? null : [-PI / 2, 0, 0]);
  return finish(g, o, .08, { top: .002, screen: t, solid: false });
}
function trash_can(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#4f6d8a', '#2f3036', '#5c8a5a', '#d65a40', '#c9c2b2'], R), paper = mat('#f1ece0', { rough: .9 });
  part(g, hollow([[.11, 0], [.118, .008], [.15, .33], [.152, .34]], .006, .012, 40), mat(col, { rough: .5 }));
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + R(); part(g, crumple(o.seed * 7 + i, .05), paper, [Math.cos(a) * .05, .3 + R() * .02, Math.sin(a) * .05]); }
  if (o.spill !== false) part(g, crumple(o.seed * 7 + 9, .045), paper, [.22, .042, .1]);
  return finish(g, o, .34, { top: .34 });
}
function cardboard_box(o) {
  const R = rnd(o.seed), g = new THREE.Group(), [w, h, d] = o.size || [.45, .32, .35], open = o.open ?? 0, card = mat('#c8995f', { rough: .85 }), inner = mat('#a87a48', { rough: .9 }), tape = mat('#e3c48d', { rough: .4 });
  const t = tex('boxprint' + (o.text || '') + w + h, 256, Math.round(256 * h / w), (x, W, H) => { x.fillStyle = '#c8995f'; x.fillRect(0, 0, W, H); x.strokeStyle = '#4a2f1a'; x.fillStyle = '#4a2f1a'; x.lineWidth = 5;
    for (const ax of [.12, .24]) { x.beginPath(); x.moveTo(W * ax, H * .38); x.lineTo(W * ax, H * .18); x.stroke(); x.beginPath(); x.moveTo(W * ax - 9, H * .24); x.lineTo(W * ax, H * .14); x.lineTo(W * ax + 9, H * .24); x.fill(); }
    x.beginPath(); x.moveTo(W * .82, H * .14); x.lineTo(W * .9, H * .14); x.lineTo(W * .87, H * .26); x.lineTo(W * .85, H * .26); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(W * .86, H * .26); x.lineTo(W * .86, H * .36); x.moveTo(W * .83, H * .36); x.lineTo(W * .89, H * .36); x.stroke();
    txt(x, o.text || 'FRAGILE', W / 2, H * .66, H * .16, { color: o.text ? '#2a1d17' : '#c0392b', max: W * .8 }); });
  const front = texMat(t, { rough: .85 });
  if (open <= 0) {
    part(g, rbox(w, h, d, .008, 2), [card, card, card, card, front, card], [0, h / 2, 0]);
    part(g, rbox(.07, .002, d + .004, .0008, 1), tape, [0, h + .0005, 0]);
    for (const s of [-1, 1]) part(g, rbox(.07, .05, .002, .0008, 1), tape, [0, h - .025, s * (d / 2 + .0005)]);
  } else {
    part(g, rbox(w, .01, d, .003, 1), inner, [0, .005, 0]);
    part(g, rbox(w, h, .01, .003, 1), [card, card, card, card, front, inner], [0, h / 2, d / 2 - .005]);
    part(g, rbox(w, h, .01, .003, 1), [card, card, card, card, inner, card], [0, h / 2, -d / 2 + .005]);
    for (const s of [-1, 1]) part(g, rbox(.01, h, d - .02, .003, 1), [s > 0 ? card : inner, s > 0 ? inner : card, card, card, card, card], [s * (w / 2 - .005), h / 2, 0]);
    const a = .4 + open * .1;
    for (const s of [-1, 1]) { const pz = grp(g, [0, h, s * (d / 2 - .005)], [s * a, 0, 0]); part(pz, rbox(w - .006, d * .48, .006, .002, 1), card, [0, d * .24, 0]); const px = grp(g, [s * (w / 2 - .005), h, 0], [0, 0, -s * a]); part(px, rbox(.006, w * .45, d - .03, .002, 1), card, [0, w * .225, 0]); }
  }
  return finish(g, o, Math.max(w, h, d), { top: h, grip: { at: [0, h / 2, 0], rot: [0, 0, 0] } });
}
function crate(o) {
  const R = rnd(o.seed), g = new THREE.Group(), [w, h, d] = o.size || [.5, .36, .38], plastic = o.kind === 'plastic';
  const col = o.color || (plastic ? pick(['#d83a34', '#f6c945', '#3f6fd1', '#5c9e4c'], R) : pick(['#d1a06a', '#c58d55', '#b98a5a'], R)), sl = plastic ? gloss(col) : mat(col, { rough: .8 }), po = plastic ? gloss(shade(col, -.15)) : mat(shade(col, -.25), { rough: .8 });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, rbox(.04, h, .04, .008), po, [x * (w / 2 - .02), h / 2, z * (d / 2 - .02)]);
  part(g, rbox(w - .04, .015, d - .04, .004), po, [0, .02, 0]);
  for (let i = 0; i < 3; i++) { const y = .06 + i * (h - .1) / 2;
    for (const s of [-1, 1]) { part(g, rbox(w - .02, .085, .02, .006), sl, [0, y, s * (d / 2 - .01)]); part(g, rbox(.02, .085, d - .02, .006), sl, [s * (w / 2 - .01), y, 0]); } }
  if (o.text) { const t = tex('crate' + o.text, 256, 64, (x, W, H) => { x.clearRect(0, 0, W, H); txt(x, o.text, W / 2, H / 2 + 2, H * .7, { color: 'rgba(42,29,23,.85)', max: W * .9 }); }); const m = texMat(t, { decal: true }); m.transparent = true; deco(part(g, plane(w * .6, .07), m, [0, .06 + (h - .1) / 2, d / 2 + .0015])); }
  if (o.fill === 'apples') for (let i = 0; i < 8; i++) appleG(g, [(-1.5 + i % 4) * w * .2, h - .1, (Math.floor(i / 4) - .5) * d * .4], pick(['#d8382f', '#8cc04a'], R), 1.1);
  return finish(g, o, Math.max(w, h, d), { top: h, grip: { at: [0, h / 2, 0], rot: [0, 0, 0] } });
}
function suitcase(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#3f6fd1', '#e2432f', '#3f9c95', '#f6c945', '#7a4fc4', '#2f3036'], R), bd = gloss(col), dk = mat(DARK, { rough: .5 }), mt = metal();
  part(g, rbox(.42, .62, .25, .06, 4), bd, [0, .355, 0]);
  for (const x of [-.11, 0, .11]) part(g, rbox(.035, .5, .014, .006), gloss(shade(col, -.12)), [x, .355, .127]);
  part(g, rbox(.428, .628, .014, .063), dk, [0, .355, 0]);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, sphere(), dk, [x * .17, .025, z * .08], null, [.015, .025, .025]);
  part(g, torus(.05, .009, PI, 8, 20), dk, [0, .665, 0]);
  if (o.handle) { for (const s of [-1, 1]) part(g, rcyl(.008, .008, .3, .003, 10), mt, [s * .08, .65, -.1]); part(g, capsule(.012, .16), dk, [0, .96, -.1], [0, 0, PI / 2]); }
  return finish(g, o, .66, { top: .665, grip: o.handle ? { at: [0, .96, -.1], rot: [0, 0, 0] } : { at: [0, .705, 0], rot: [0, 0, 0] } });
}
function briefcase(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#7a4a2a', '#2f3036', '#5b3b25', '#8a3a2a'], R), bd = mat(col, { rough: .55 }), dk = mat(shade(col, -.35), { rough: .55 }), gold = mat(GOLD, { rough: .3, metal: .3 });
  part(g, rbox(.44, .32, .1, .025), bd, [0, .16, 0]);
  part(g, rbox(.445, .012, .105, .006), dk, [0, .25, 0]);
  part(g, torus(.055, .011, PI, 8, 20), dk, [0, .32, 0]);
  for (const s of [-1, 1]) { part(g, rbox(.03, .02, .03, .006), gold, [s * .055, .325, 0]); part(g, rbox(.035, .03, .012, .005), gold, [s * .13, .25, .052]); }
  return finish(g, o, .44, { top: .32, grip: { at: [0, .37, 0], rot: [0, 0, 0] } });
}
// ================= money + party =================
function money_stack(o) {
  const R = rnd(o.seed), g = new THREE.Group(), n = o.count ?? 1;
  const top = texMat(tex('banknote', 312, 132, (x, W, H) => paintNote(x, W, H)), { rough: .75 }), edge = texMat(tex('noteedge', 64, 32, (x, W, H) => { x.fillStyle = '#e9f2df'; x.fillRect(0, 0, W, H); x.fillStyle = '#9fc49a'; for (let y = 2; y < H; y += 4) x.fillRect(0, y, W, 1.5); }), { rough: .9 }), band = mat('#efe0b0', { rough: .6 });
  const per = n > 6 ? 4 : n > 2 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const L = Math.floor(i / per), j = i % per, x = per === 1 ? 0 : per === 2 ? (j - .5) * .165 : ((j % 2) - .5) * .165, z = per === 4 ? (Math.floor(j / 2) - .5) * .072 : 0, b = grp(g, [x + (R() - .5) * .01, L * .0165 + .008, z + (R() - .5) * .01], [0, (R() - .5) * .12, 0]);
    part(b, rbox(.156, .016, .066, .003, 1), [edge, edge, top, top, edge, edge]);
    part(b, rbox(.035, .0172, .0675, .002, 1), band);
  }
  const H = Math.ceil(n / per) * .0165;
  return finish(g, o, .16, { top: H, grip: { at: [0, .008, 0], rot: [0, 0, 0] }, ink: .006 });
}
function coins_pile(o) {
  const R = rnd(o.seed), g = new THREE.Group(), n = o.count ?? 5, coin = rcyl(.014, .014, .0032, .0012, 24), parts = [];
  for (let s = 0; s < n; s++) { const a = s * 2.4 + R(), r = s ? .02 + Math.sqrt(s) * .016 : 0, x = Math.cos(a) * r, z = Math.sin(a) * r, k = 3 + Math.floor(R() * 8);
    for (let i = 0; i < k; i++) parts.push({ geo: coin, pos: [x + (R() - .5) * .002, i * .0032, z + (R() - .5) * .002], color: R() < .85 ? '#e9b44c' : '#d9a33c' }); }
  for (let i = 0; i < n + 3; i++) { const a = R() * TAU, r = .05 + R() * .05; parts.push({ geo: coin, pos: [Math.cos(a) * r, .0015, Math.sin(a) * r], rot: [(R() - .5) * .3, 0, (R() - .5) * .3], color: '#e9b44c' }); }
  const m = part(g, mergeParts(parts), memo(MATS, 'coinmat', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .3 }))); m.userData.ink = .0011;
  return finish(g, o, .2, { top: .03 });
}
function wallet(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#6b3f24', '#2f3036', '#8a3a2a', '#35507f'], R), bd = mat(col, { rough: .55 });
  const st = tex('wallet' + col, 256, 210, (x, W, H) => { x.fillStyle = col; x.fillRect(0, 0, W, H); x.strokeStyle = shade(col, .35); x.setLineDash([10, 8]); x.lineWidth = 4; x.strokeRect(14, 14, W - 28, H - 28); });
  part(g, rbox(.11, .018, .09, .007, 2), [bd, bd, texMat(st, { rough: .55 }), bd, bd, bd], [0, .009, 0]);
  part(g, rbox(.1, .002, .05, .0008, 1), mat('#9fd09a', { rough: .8 }), [.004, .011, -.032], [0, .08, 0]);
  part(g, rbox(.085, .002, .054, .0008, 1), gloss('#3f6fd1'), [-.01, .013, -.03], [0, -.06, 0]);
  return finish(g, o, .11, { top: .018, grip: { at: [0, .009, 0], rot: [0, 0, 0] } });
}
function piggy_bank(o) {
  const col = o.color || '#f4a3b5', g = new THREE.Group(), bd = gloss(col), dk = mat(shade(col, -.3)), eye = mat(DARK);
  part(g, sphere(), bd, [0, .125, 0], null, [.125, .105, .155]);
  part(g, rcyl(.036, .038, .035, .012, 24), mat(shade(col, .12), { rough: .4 }), [0, .12, .14], [PI / 2, 0, 0]);
  for (const s of [-1, 1]) { part(g, sphere(), dk, [s * .013, .12, .177], null, [.006, .009, .004]); part(g, lath([[0, 0], [.03, 0], [.012, .04], [0, .045]], 16, 2), bd, [s * .065, .21, .06], [-.4, 0, s * .45]); part(g, sphere(), eye, [s * .045, .16, .135], null, .011); }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, rcyl(.026, .03, .055, .01, 16), bd, [x * .065, 0, z * .075]);
  tube(g, [[0, .14, -.15], [.02, .16, -.175], [.035, .14, -.18], [.02, .125, -.17], [.01, .145, -.165]], .006, bd);
  part(g, rbox(.045, .006, .01, .002, 1), mat('#3a2026'), [0, .229, -.01]);
  return finish(g, o, .25, { top: .23, grip: { at: [0, .125, 0], rot: [0, 0, 0] } });
}
function trophy(o) {
  const g = new THREE.Group(), gold = mat(o.color || '#f4c24a', { rough: .34, metal: .12 }), base = mat('#3a2a22', { rough: .5 });
  part(g, rbox(.15, .06, .15, .01), base, [0, .03, 0]);
  const t = tex('trophyplate' + (o.text || '#1'), 128, 48, (x, W, H) => { x.fillStyle = '#e9c46a'; x.fillRect(0, 0, W, H); txt(x, o.text || '#1', W / 2, H / 2 + 1, H * .6, { color: '#3a2a22', max: W * .9 }); });
  part(g, rbox(.09, .03, .004, .0015, 1), [gold, gold, gold, gold, texMat(t, { rough: .4 }), gold], [0, .03, .076]);
  part(g, lath([[0, 0], [.045, 0], [.045, .01], [.02, .02], [.015, .06], [.03, .075], [.015, .09], [.02, .1], [0, .1]], 32, 0), gold, [0, .06, 0]);
  part(g, hollow([[.02, 0], [.05, .02], [.07, .07], [.08, .14]], .004, .01, 40), gold, [0, .16, 0]);
  for (const s of [-1, 1]) part(g, torus(.035, .007, PI * 1.1, 8, 20), gold, [s * .07, .245, 0], [0, 0, s > 0 ? -PI * .55 : PI * .45]);
  return finish(g, o, .3, { top: .3, grip: { at: [0, .12, 0], rot: [0, 0, 0] } });
}
function gift_box(o) {
  const R = rnd(o.seed), g = new THREE.Group(), w = o.w ?? .3, h = o.h ?? .22, col = o.color || pick(['#e2432f', '#3f6fd1', '#5fae4a', '#7a4fc4', '#ee7fa6', '#3f9c95'], R), rc = o.ribbon || pick(['#f6c945', '#ffffff', '#e2432f'], R), bm = gloss(col), lm = gloss(shade(col, .08)), rm = gloss(rc);
  part(g, rbox(w, h - .04, w, .012), bm, [0, (h - .04) / 2, 0]);
  part(g, rbox(w + .015, .055, w + .015, .014), lm, [0, h - .0325, 0]);
  part(g, rbox(.045, h + .004, w + .02, .006), rm, [0, (h + .004) / 2 - .002, 0]);
  part(g, rbox(w + .02, h + .007, .045, .006), rm, [0, (h + .007) / 2 - .002, 0]);
  for (const s of [-1, 1]) part(g, torus(.038, .011, TAU, 8, 28), rm, [s * .034, h + .03, 0], [0, 0, s * .7], [1, .75, .55]);
  part(g, sphere(), rm, [0, h + .012, 0], null, .018);
  return finish(g, o, Math.max(w, h), { top: h + .005, grip: { at: [0, h / 2, 0], rot: [0, 0, 0] } });
}
function balloon(o) {
  const R = rnd(o.seed), g = new THREE.Group(), len = o.len ?? 1.1, col = o.color || pick(BRIGHT, R), bm = toonMat(col, { rough: .3 });
  const b = grp(g, [0, len, 0]);
  part(b, lath([[0, 0], [.012, .006], [.06, .04], [.12, .12], [.135, .2], [.12, .28], [.07, .33], [0, .345]], 40, 4), bm, [0, .012, 0]);
  part(b, lath([[0, 0], [.008, 0], [.012, .014], [0, .016]], 12), bm, [0, -.004, 0]);
  deco(part(b, sphere(), sheen(), [-.055, .26, .085], [0, 0, .5], [.018, .035, .012]));
  tube(g, [[0, len - .004, 0], [.03, len * .72, .01], [-.025, len * .45, 0], [.012, len * .18, -.005], [0, 0, 0]], .0018, mat('#f4f1ea'), 32, 6);
  return finish(g, o, .35, { grip: { at: [0, 0, 0], rot: [0, 0, 0] }, top: len + .36 });
}
function candle(o) {
  const R = rnd(o.seed), g = new THREE.Group(), lit = o.lit !== false, col = o.color || pick(['#f4ead6', '#e2432f', '#f6c945', '#9fd3c7'], R), wax = mat(col, { rough: .6 });
  part(g, lath([[0, 0], [.06, 0], [.065, .008], [.072, .015], [.064, .017], [0, .013]], 32, 2), mat(GOLD, { rough: .3, metal: .3 }));
  part(g, rcyl(.028, .029, .12, .008, 32), wax, [0, .012, 0]);
  for (let i = 0; i < 4; i++) { const a = i * 1.6 + R(), l = .015 + R() * .025; part(g, capsule(.005, l, 8), wax, [Math.sin(a) * .0285, .128 - l / 2, Math.cos(a) * .0285]); }
  part(g, rcyl(.0015, .0015, .012, .0006, 6), mat(DARK), [0, .13, 0]);
  let flame = null, L = null;
  if (lit) { flame = deco(part(g, lath([[0, 0], [.008, .006], [.011, .016], [.007, .03], [0, .045]], 16, 3), glow('#ffcf5a', 3), [0, .136, 0])); deco(part(g, sphere(), glow('#fff6d8', 3), [0, .146, 0], null, [.004, .008, .004])); L = pointLight(g, [0, .17, 0], '#ffb45a', o.intensity ?? .7, 3); }
  return finish(g, o, .15, { top: .132, light: L, flame, grip: { at: [0, .03, 0], rot: [0, 0, 0] } });
}
// ================= medical =================
function pillG(parent, p, c1, c2, r = .0048, L = .021) {
  const pg = grp(parent, p, [0, 0, -PI / 2]);
  const half = (rr2, h0, h1, top) => { const pts = []; if (!top) { for (let i = 0; i <= 6; i++) { const a = -PI / 2 + i / 6 * PI / 2; pts.push([Math.cos(a) * rr2, h0 + rr2 + Math.sin(a) * rr2]); } pts.push([rr2, h1], [0, h1]); } else { pts.push([0, h0], [rr2, h0]); for (let i = 0; i <= 6; i++) { const a = i / 6 * PI / 2; pts.push([Math.cos(a) * rr2, h1 - rr2 + Math.sin(a) * rr2]); } } return lath(pts, 24); };
  part(pg, half(r, -L / 2, .002, false), gloss(c1));
  part(pg, half(r * 1.06, -.0005, L / 2 + .0005, true), gloss(c2));
  return pg;
}
function pill(o) {
  const R = rnd(o.seed), g = new THREE.Group();
  if (o.kind === 'tablet') { part(g, rcyl(.0055, .0055, .0035, .0015, 24), gloss(o.color || '#fbf8f2')); part(g, rbox(.008, .0006, .0008, .0003, 1), mat('#d8d2c4'), [0, .0036, 0]); return finish(g, o, .012, { grip: { at: [0, .002, 0], rot: [0, 0, 0] } }); }
  const pal = pick([['#e2432f', '#f6ecd9'], ['#2f9c95', '#fbf8f2'], ['#3f6fd1', '#f6c945'], ['#5fae4a', '#fbf8f2'], ['#7a4fc4', '#ee7fa6']], R);
  pillG(g, [0, .0051, 0], o.color || pal[0], o.color2 || pal[1]);
  return finish(g, o, .022, { grip: { at: [0, .005, 0], rot: [0, 0, 0] } });
}
function pill_bottle(o) {
  const R = rnd(o.seed), g = new THREE.Group(), lying = !!o.lying, col = o.color || '#e98a2b', cap = mat(o.cap || '#fbf8f2', { rough: .5 });
  const body = grp(g, lying ? [-.053, .031, 0] : [0, 0, 0], lying ? [0, 0, -PI / 2] : null);
  part(body, lath([[0, 0], [.026, 0], [.029, .004], [.03, .012], [.03, .075], [.027, .08], [.026, .086], [0, .086]], 40, 2), gloss(col));
  const capT = tex('capridge', 128, 32, (x, W, H) => { x.fillStyle = '#fbf8f2'; x.fillRect(0, 0, W, H); x.fillStyle = '#d6d0c2'; for (let i = 0; i < W; i += 4) x.fillRect(i, 0, 2, H); });
  capT.wrapS = THREE.RepeatWrapping; capT.repeat.set(4, 1);
  part(body, rcyl(.031, .031, .024, .006, 40), o.cap ? cap : texMat(capT, { rough: .5 }), [0, .082, 0]);
  const t = tex(`pilllabel|${o.text || 'RELIEF'}|${lying}`, 512, 256, (x, W, H) => paintLabel(x, W, H, { bg: '#ffffff', band: '#3f6fd1', bandText: 'Rx  ·  No. 0427', title: o.text || 'RELIEF', sub: o.sub || '200 mg · 30 tablets', ink: '#1d2b4f', vertical: lying, span: lying ? .9 : .48 }));
  band(body, .0306, lying ? .062 : .048, lying ? .04 : .042, t, PI * 1.2, 40);
  if (!lying) deco(part(body, capsule(.0025, .01), sheen(), [-.019, .076, .022], [0, -.7, 0], [.7, 1, .45]));
  if (o.pills) for (let i = 0; i < o.pills; i++) { const a = R() * TAU, r = .07 + R() * .06, pal = pick([['#e2432f', '#f6ecd9'], ['#2f9c95', '#fbf8f2']], R); const p = pillG(g, [Math.cos(a) * r, .0051, Math.sin(a) * r], pal[0], pal[1]); p.rotation.y = R() * TAU; p.rotation.order = 'YXZ'; }
  return finish(g, o, .11, { top: lying ? .062 : .106, grip: { at: lying ? [0, .031, 0] : [0, .045, 0], rot: [0, 0, 0] } });
}
function first_aid_kit(o) {
  const R = rnd(o.seed), g = new THREE.Group(), red = !!(o.color === 'red' || (o.color == null && R() < .4)), bc = red ? '#d83a34' : WHITE, cc = red ? WHITE : '#d83a34', bm = gloss(bc);
  part(g, rbox(.32, .22, .1, .03), bm, [0, .11, 0]);
  part(g, rbox(.325, .01, .105, .005), gloss(shade(bc, -.12)), [0, .17, 0]);
  part(g, extr('cross', () => { const s = new THREE.Shape(), a = .018, b = .055; s.moveTo(-a, -b); s.lineTo(a, -b); s.lineTo(a, -a); s.lineTo(b, -a); s.lineTo(b, a); s.lineTo(a, a); s.lineTo(a, b); s.lineTo(-a, b); s.lineTo(-a, a); s.lineTo(-b, a); s.lineTo(-b, -a); s.lineTo(-a, -a); s.closePath(); return s; }, .01, .003), gloss(cc), [0, .1, .047]);
  part(g, torus(.045, .008, PI, 8, 20), mat(DARK), [0, .22, 0]);
  for (const s of [-1, 1]) part(g, rbox(.03, .02, .01, .004), metal(), [s * .1, .17, .052]);
  return finish(g, o, .32, { top: .22, grip: { at: [0, .265, 0], rot: [0, 0, 0] } });
}
function hospital_bed(o) {
  const R = rnd(o.seed), g = new THREE.Group(), fr = metal('#d6dce2'), sheet = matte('#eef3f6'), bl = matte(o.color || pick(['#9fcde3', '#9fd3c7', '#c9b8e0'], R)), panel = gloss(o.panel || '#7fb0c8'), dk = mat(DARK);
  part(g, rbox(.9, .06, 1.9, .02), fr, [0, .33, 0]);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { part(g, rcyl(.018, .018, .25, .006, 12), fr, [x * .38, .06, z * .85]); part(g, sphere(), dk, [x * .38, .035, z * .85], null, [.02, .035, .035]); }
  part(g, rbox(.88, .13, 1.15, .05), sheet, [0, .425, .35]);
  const piv = grp(g, [0, .36, -.225], [.45, 0, 0]);
  part(piv, rbox(.88, .13, .72, .05), sheet, [0, .065, -.36]);
  part(piv, rbox(.55, .12, .3, .055), matte('#fbf8f2'), [0, .18, -.5], [.1, 0, 0]);
  part(g, rbox(.92, .16, 1.0, .05), bl, [0, .44, .45]);
  part(g, rbox(.94, .05, .14, .02), matte('#fbf8f2'), [0, .51, -.02]);
  part(g, rbox(.95, .55, .05, .045), panel, [0, .65, -.98]);
  part(g, rbox(.95, .32, .05, .04), panel, [0, .55, .98]);
  for (const s of [-1, 1]) { for (const y of [.58, .66]) part(g, rcyl(.012, .012, .7, .005, 12), fr, [s * .48, y, -.6], [PI / 2, 0, 0]); for (const z of [-.55, .05]) part(g, rcyl(.012, .012, .3, .005, 12), fr, [s * .48, .38, z]); }
  return finish(g, o, 1.9, { seat: .56, top: .56, back: piv });
}
function iv_stand(o) {
  const g = new THREE.Group(), fr = metal(), dk = mat(DARK);
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + PI / 2, c = Math.cos(a), s = Math.sin(a); strut(g, [0, .07, 0], [c * .28, .05, s * .28], .012, fr); part(g, sphere(), dk, [c * .28, .025, s * .28], null, .025); }
  part(g, rcyl(.011, .011, 1.85, .004, 12), fr, [0, .06, 0]);
  part(g, rbox(.14, .01, .01, .004), fr, [0, 1.9, 0]);
  for (const s of [-1, 1]) part(g, torus(.018, .003, PI * 1.3, 6, 16), fr, [s * .065, 1.88, 0], [0, 0, PI * 1.2]);
  const t = tex('ivbag', 96, 160, (x, W, H) => { x.fillStyle = '#e9f6fb'; x.fillRect(0, 0, W, H); x.fillStyle = '#b9e0f0'; x.fillRect(0, H * .3, W, H * .7); box(x, W * .15, H * .4, W * .7, H * .32, 6, '#ffffff'); txt(x, '0.9%', W / 2, H * .5, H * .1, { color: '#3f6fd1' }); txt(x, 'SALINE', W / 2, H * .62, H * .08, { color: '#3f6fd1' }); });
  const bm = mat('#d8eef7', { rough: .3 });
  part(g, rbox(.12, .18, .03, .015), [bm, bm, bm, bm, texMat(t, { rough: .3 }), bm], [.065, 1.75, 0]);
  part(g, rcyl(.008, .008, .035, .003, 12), mat('#e6f6fb', { rough: .2 }), [.065, 1.625, 0]);
  tube(g, [[.065, 1.63, 0], [.08, 1.35, .05], [.13, 1.05, .12], [.24, .95, .2]], .0045, mat('#e6f4f8', { rough: .4 }), 24, 8);
  part(g, rbox(.02, .035, .015, .005), mat('#3f6fd1'), [.09, 1.28, .065]);
  return finish(g, o, 1.9, {});
}
function stethoscope(o) {
  const R = rnd(o.seed), g = new THREE.Group(), tm = mat(o.color || pick(['#2f4a7a', '#2f3036', '#d83a34', '#3f9c95'], R), { rough: .4 }), mt = metal(), dk = mat(DARK), y = .006;
  part(g, rcyl(.022, .022, .012, .005, 32), mt, [.09, 0, .07]);
  part(g, rcyl(.019, .019, .002, .0008, 32), mat('#eef3f6', { rough: .3 }), [.09, .0115, .07]);
  tube(g, [[.075, y, .06], [.02, y, .1], [-.06, y, .07], [-.1, y, -.01], [-.06, y, -.06]], .0055, tm, 30, 8);
  part(g, rcyl(.0075, .0075, .024, .003, 12), mt, [-.044, y, -.06], [0, 0, PI / 2]);
  for (const s of [-1, 1]) { tube(g, [[-.05, y, -.06], [-.02 + s * .01, y, -.09 - s * .02], [.02 + s * .04, y, -.12 - s * .015], [.06 + s * .05, y, -.11]], .0028, mt, 20, 6); part(g, sphere(), dk, [.06 + s * .05, y, -.11], null, .007); }
  return finish(g, o, .25, { grip: { at: [.09, .006, .07], rot: [-PI / 2, 0, 0] } });
}
function bandage_roll(o) {
  const g = new THREE.Group(), t = tex('gauze', 64, 64, (x, W, H) => { x.fillStyle = '#f7f1e3'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(180,170,150,.5)'; x.lineWidth = 1; for (let i = 0; i < W; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 3);
  const gm = texMat(t, { rough: .95 });
  part(g, rollGeo(.032, .011, .06, .005), gm, [-.03, .032, 0], [0, 0, -PI / 2]);
  const strip = memo(GEO, 'bandstrip', () => { const b = rbox(.056, .0015, .14, .0006, 1, 12).clone(), P = b.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + Math.sin(P.getZ(i) * 40) * .0012 + .0012); b.computeVertexNormals(); b.computeBoundingSphere(); return b; });
  part(g, strip, gm, [0, 0, .072]);
  return finish(g, o, .1, { top: .064, grip: { at: [0, .032, 0], rot: [0, 0, 0] } });
}
// ================= tools + home =================
function broom(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#d83a34', '#3f6fd1', '#5fae4a', '#b77b45'], R), hm = mat(col, { rough: .5 }), straw = mat('#e9c36a', { rough: .9 });
  part(g, rcyl(.012, .013, 1.12, .006, 16), hm, [0, .2, 0]);
  part(g, rcyl(.018, .018, .04, .006, 16), metal(), [0, .18, 0]);
  part(g, rbox(.3, .05, .07, .015), mat(shade(col, -.15), { rough: .6 }), [0, .19, 0]);
  const t = tex('straw', 64, 16, (x, W, H) => { x.fillStyle = '#e9c36a'; x.fillRect(0, 0, W, H); x.fillStyle = '#c9a04a'; for (let i = 0; i < W; i += 6) x.fillRect(i, 0, 2, H); }); t.wrapS = THREE.RepeatWrapping; t.repeat.set(40, 1);
  part(g, extr('bristles', () => { const s = new THREE.Shape(); s.moveTo(-.17, 0); s.lineTo(.17, 0); s.lineTo(.14, .17); s.lineTo(-.14, .17); s.closePath(); return s; }, .06, .008), [texMat(t, { rough: .9 }), straw], [0, 0, -.03]);
  part(g, rbox(.3, .02, .072, .006), mat('#b5793f', { rough: .8 }), [0, .15, 0]);
  return finish(g, o, 1.3, { grip: { at: [0, 1.0, 0], rot: [0, 0, 0] }, grip2: { at: [0, .7, 0] } });
}
function bucket(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#3f8fd1', '#e2432f', '#f6c945', '#5fae4a', '#c3cbd3'], R), bd = col === '#c3cbd3' ? metal(col) : gloss(col), mt = metal();
  part(g, hollow([[.12, 0], [.128, .008], [.155, .27], [.16, .28]], .006, .012, 40), bd);
  part(g, torus(.158, .007, TAU, 8, 48), bd, [0, .27, 0], [PI / 2, 0, 0]);
  if (o.water) deco(part(g, memo(GEO, 'circ.148', () => new THREE.CircleGeometry(.148, 32)), mat('#8fcfe8', { rough: .2 }), [0, .22, 0], [-PI / 2, 0, 0]));
  for (const s of [-1, 1]) part(g, sphere(), bd, [s * .157, .245, 0], null, .014);
  tube(g, [[-.158, .245, 0], [-.13, .36, 0], [0, .42, 0], [.13, .36, 0], [.158, .245, 0]], .004, mt, 30, 6);
  part(g, capsule(.011, .07), mat(DARK), [0, .42, 0], [0, 0, PI / 2]);
  return finish(g, o, .3, { top: .28, grip: { at: [0, .42, 0], rot: [0, 0, 0] } });
}
function ladder(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#c3cbd3', '#b77b45', '#f6c945'], R), rail = col === '#c3cbd3' ? metal(col) : mat(col, { rough: .6 }), cap = gloss(o.cap || '#f08a2a'), dk = mat(DARK);
  for (const s of [-1, 1]) {
    part(g, rbox(.04, 1.47, .065, .012), rail, [s * .22, .725, .125], [-.17, 0, 0]);
    part(g, rbox(.035, 1.44, .05, .012), rail, [s * .2, .71, -.165], [.19, 0, 0]);
    part(g, rbox(.05, .03, .08, .01), dk, [s * .22, .015, .25]); part(g, rbox(.045, .03, .065, .01), dk, [s * .2, .015, -.3]);
    strut(g, [s * .21, .8, .11], [s * .2, .8, -.15], .006, rail);
  }
  for (const y of [.36, .72, 1.08]) part(g, rbox(.42, .025, .1, .008), rail, [0, y, .25 - .25 * y / 1.45 + .005]);
  part(g, rbox(.48, .06, .3, .02), cap, [0, 1.47, -.03]);
  return finish(g, o, 1.5, { top: 1.5 });
}
function toolbox(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#d9392f', '#3f6fd1', '#f6c945', '#2f3036', '#5c9e4c'], R), bd = gloss(col), lid = gloss(shade(col, -.1)), dk = mat(DARK), mt = metal();
  part(g, rbox(.46, .2, .22, .02), bd, [0, .1, 0]);
  part(g, rbox(.47, .05, .23, .02), lid, [0, .22, 0]);
  part(g, capsule(.012, .2), dk, [0, .3, 0], [0, 0, PI / 2]);
  for (const s of [-1, 1]) strut(g, [s * .1, .24, 0], [s * .1, .3, 0], .01, mt);
  for (const s of [-1, 1]) part(g, rbox(.035, .04, .012, .005), mt, [s * .15, .2, .114]);
  return finish(g, o, .46, { top: .245, grip: { at: [0, .3, 0], rot: [0, 0, 0] } });
}
function hammer(o) {
  const R = rnd(o.seed), g = new THREE.Group(), wood = mat('#c98f55', { rough: .6 }), grip = mat(o.color || pick(['#d83a34', '#2f3036', '#f6c945'], R), { rough: .55 }), mt = metal('#b9c2cc');
  part(g, capsule(.013, .2, 12), wood, [-.03, .0135, 0], [0, 0, PI / 2]);
  part(g, capsule(.016, .075, 12), grip, [-.1, .0165, 0], [0, 0, PI / 2]);
  part(g, rbox(.032, .034, .075, .008), mt, [.09, .018, .005]);
  part(g, rcyl(.017, .017, .025, .005, 20), mt, [.09, .018, .04], [PI / 2, 0, 0]);
  for (const s of [-1, 1]) tube(g, [[.09 + s * .006, .022, -.03], [.09 + s * .007, .022, -.06], [.09 + s * .008, .012, -.085]], u => .007 - .0045 * u, mt, 12, 8);
  return finish(g, o, .26, { grip: { at: [-.1, .016, 0], rot: [0, 0, -PI / 2] } });
}
function wrench(o) {
  const g = new THREE.Group();
  part(g, extr('wrench', () => {
    const s = new THREE.Shape(), rH = .028, cx = .085, hw = .012, rL = .022, lx = -.1, an = Math.asin(.011 / rH);
    s.moveTo(lx + Math.sqrt(rL * rL - hw * hw), -hw); s.lineTo(cx - Math.sqrt(rH * rH - hw * hw), -hw);
    s.absarc(cx, 0, rH, Math.atan2(-hw, -Math.sqrt(rH * rH - hw * hw)) + TAU, TAU - an, false);
    s.lineTo(cx + rH * Math.cos(an) - .03, -.011); s.lineTo(cx + rH * Math.cos(an) - .03, .011); s.lineTo(cx + rH * Math.cos(an), .011);
    s.absarc(cx, 0, rH, an, Math.atan2(hw, -Math.sqrt(rH * rH - hw * hw)), false);
    s.lineTo(lx + Math.sqrt(rL * rL - hw * hw), hw);
    s.absarc(lx, 0, rL, Math.atan2(hw, Math.sqrt(rL * rL - hw * hw)), TAU - Math.atan2(hw, Math.sqrt(rL * rL - hw * hw)), false);
    const hole = new THREE.Path(); hole.absarc(lx, 0, .011, 0, TAU, true); s.holes.push(hole); return s;
  }, .008, .0025, true), metal(o.color || '#b9c2cc'));
  return finish(g, o, .22, { grip: { at: [-.02, .004, 0], rot: [0, 0, -PI / 2] } });
}
function battery(o) {
  const g = new THREE.Group(), body = mat(o.color || '#2b2b30', { rough: .45 }), cap = gloss(o.band || '#e98a2b'), mt = metal();
  part(g, rcyl(.017, .017, .062, .003, 32), body);
  part(g, rcyl(.0175, .0175, .024, .003, 32), cap, [0, .04, 0]);
  part(g, rcyl(.006, .006, .005, .0015, 16), mt, [0, .0615, 0]);
  const t = tex('battlabel' + (o.text || ''), 256, 128, (x, W, H) => { x.clearRect(0, 0, W, H); txt(x, '+', W * .5, H * .25, H * .34, { color: '#ffffff' }); txt(x, o.text || 'VOLTO', W * .5, H * .7, H * .2, { color: '#ffffff', max: W * .4 }); });
  const m = texMat(t, { decal: true, rough: .45 }); m.transparent = true;
  deco(part(g, memo(GEO, 'battband', () => new THREE.CylinderGeometry(.0179, .0179, .05, 32, 1, true, -PI * .45, PI * .9)), m, [0, .032, 0]));
  return finish(g, o, .065, { top: .066, grip: { at: [0, .03, 0], rot: [0, 0, 0] } });
}
function light_switch(o) {
  const g = new THREE.Group(), M = o.mount ?? 1.15, on = o.lit !== false;
  part(g, rbox(.08, .12, .012, .005), gloss(o.color || WHITE), [0, M, .006]);
  part(g, rbox(.016, .034, .018, .006), gloss('#efe8da'), [0, M + (on ? .006 : -.006), .018], [on ? -.35 : .35, 0, 0]);
  for (const s of [-1, 1]) part(g, rcyl(.004, .004, .002, .0008, 10), mat('#b9c2cc'), [0, M + s * .045, .012], [PI / 2, 0, 0]);
  return finish(g, o, .12, { wall: true });
}
function smoke_alarm(o) {
  const g = new THREE.Group(), ceiling = !!o.ceiling, M = ceiling ? (o.ceiling === true ? 3.0 : o.ceiling) : (o.mount ?? 2.3);
  const hold = grp(g, [0, M, 0], [ceiling ? PI : PI / 2, 0, 0]);
  const rings = tex('alarmrings', 32, 128, (x, W, H) => { x.fillStyle = '#efece4'; x.fillRect(0, 0, W, H); x.fillStyle = '#c9c4b8'; for (let y = H * .55; y < H; y += 9) x.fillRect(0, y, W, 4); });
  part(hold, lath([[0, 0], [.07, 0], [.072, .006], [.068, .02], [.05, .032], [0, .036]], 40, 2), texMat(rings, { rough: .6 }));
  part(hold, torus(.064, .004, TAU, 8, 48), gloss('#e2ddd2'), [0, .016, 0], [PI / 2, 0, 0]);
  deco(part(hold, sphere(), o.lit === false ? mat('#7a2020') : glow('#ff3a2a', 3), [.035, .026, .012], null, .005));
  part(hold, rcyl(.009, .009, .006, .002, 16), gloss('#e2ddd2'), [-.03, .027, -.012]);
  return finish(g, o, .15, { wall: !ceiling });
}
function fan(o) {
  const R = rnd(o.seed), g = new THREE.Group(), desk = !!o.desk, col = o.color || pick(['#5fb3c9', '#f1efe9', '#e2432f', '#f6c945', '#9fd3c7'], R), bd = gloss(col), mt = metal(), wire = mat('#9aa3ad', { rough: .4 });
  const ph = desk ? .12 : .95, cy = ph + .1, k = desk ? .75 : 1;
  part(g, rcyl(.15 * k + .02, .17 * k + .02, .04, .015, 40), bd);
  part(g, rcyl(.017, .017, ph, .006, 16), mt, [0, .035, 0]);
  part(g, rcyl(.025, .025, .06, .008, 16), bd, [0, ph - .06, 0]);
  part(g, sphere(), bd, [0, ph, 0], null, .03);
  const head = grp(g, [0, cy, 0]); head.scale.setScalar(k);
  part(head, capsule(.06, .07), bd, [0, 0, -.08], [PI / 2, 0, 0]);
  part(head, torus(.2, .006, TAU, 8, 64), wire, [0, 0, .02]); part(head, torus(.19, .005, TAU, 8, 64), wire, [0, 0, -.05]);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; strut(head, [Math.cos(a) * .2, Math.sin(a) * .2, .02], [Math.cos(a) * .19, Math.sin(a) * .19, -.05], .0025, wire, .0025, 6); }
  for (const r of [.07, .135]) deco(part(head, torus(r, .0025, TAU, 6, 48), wire, [0, 0, .02]));
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; deco(strut(head, [Math.cos(a) * .04, Math.sin(a) * .04, .02], [Math.cos(a) * .2, Math.sin(a) * .2, .02], .002, wire, .002, 5)); }
  part(head, rcyl(.035, .035, .015, .006, 24), bd, [0, 0, .015], [PI / 2, 0, 0]);
  const spin = grp(head, [0, 0, -.015]);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, b = grp(spin, null, [0, 0, a]); part(b, sphere(), gloss(shade(col, -.08)), [0, .1, 0], [0, .35, 0], [.065, .1, .01]); }
  part(spin, sphere(), bd, [0, 0, 0], null, .028);
  return finish(g, o, desk ? .45 : 1.2, { spin });
}
function radiator(o) {
  const R = rnd(o.seed), g = new THREE.Group(), n = o.count ?? 8, col = o.color || pick(['#efece6', '#e2ddd2', '#c9d6e3', '#e98f78'], R), bd = mat(col, { rough: .45 }), W = n * .062;
  for (let i = 0; i < n; i++) part(g, rbox(.05, .56, .1, .024), bd, [(i - (n - 1) / 2) * .062, .38, .08]);
  for (const y of [.15, .61]) part(g, rcyl(.018, .018, W, .006, 16), bd, [-W / 2, y, .08], [0, 0, -PI / 2]);
  for (const s of [-1, 1]) part(g, rbox(.04, .1, .08, .01), bd, [s * (W / 2 - .03), .05, .08]);
  part(g, rcyl(.014, .014, .15, .005, 12), metal(), [W / 2 + .03, 0, .08]);
  strut(g, [W / 2, .15, .08], [W / 2 + .03, .15, .08], .014, metal());
  part(g, rcyl(.025, .025, .03, .008, 20), gloss('#efece6'), [W / 2 + .03, .15, .08]);
  return finish(g, o, Math.max(W, .66), { top: .66, wall: true });
}
function potted_plant(o) {
  const R = rnd(o.seed), g = new THREE.Group(), kind = o.kind || pick(['leafy', 'snake', 'cactus', 'leafy'], R), small = !!o.small, inner = grp(g);
  if (small) inner.scale.setScalar(.5);
  const pc = o.pot || pick(['#c96a43', '#f1ebde', '#3f6f8a', '#e0a33a', '#2f3036'], R), potM = mat(pc, { rough: .7 });
  part(inner, hollow([[.1, 0], [.11, .008], [.13, .24], [.135, .25]], .012, .03, 40), potM);
  part(inner, torus(.137, .014, TAU, 10, 48), mat(shade(pc, -.08), { rough: .7 }), [0, .245, 0], [PI / 2, 0, 0]);
  deco(part(inner, memo(GEO, 'circ.125', () => new THREE.CircleGeometry(.125, 32)), mat('#4a3222'), [0, .225, 0], [-PI / 2, 0, 0]));
  const g1 = mat('#4f9a3e', { rough: .75 }), g2 = mat('#3c7f33', { rough: .75 }), stemM = mat('#5c8a3a', { rough: .8 });
  let top = .3;
  if (kind === 'leafy') {
    const n = 9; for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * .4, rr2 = .07 + R() * .1, y = .38 + R() * .26, c = Math.cos(a), s = Math.sin(a);
      tube(inner, [[c * .02, .22, s * .02], [c * rr2 * .4, y * .8, s * rr2 * .4], [c * rr2, y, s * rr2]], .006, stemM, 12, 6);
      part(inner, sphere(), i % 2 ? g1 : g2, [c * (rr2 + .07), y + .02, s * (rr2 + .07)], [-.25 - R() * .3, PI / 2 - a, 0, 'YXZ'], [.065, .012, .13]); top = Math.max(top, y + .08); }
  } else if (kind === 'snake') {
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + R() * .3, r = .03 + R() * .04, h = .25 + R() * .2; part(inner, sphere(), i % 2 ? g2 : mat('#5c9e4c', { rough: .7 }), [Math.cos(a) * r, .22 + h / 2, Math.sin(a) * r], [Math.sin(a) * .15, -a, -Math.cos(a) * .15], [.035, h / 2, .01]); top = Math.max(top, .22 + h); }
  } else if (kind === 'cactus') {
    const cm = mat('#5c9e4c', { rough: .7 });
    part(inner, capsule(.06, .22, 20), cm, [0, .4, 0]);
    for (const s of [-1, 1]) { strut(inner, [0, .38 + s * .02, 0], [s * .1, .38 + s * .02, 0], .028, cm); part(inner, capsule(.03, .08 + (s > 0 ? .04 : 0), 14), cm, [s * .1, .43 + (s > 0 ? .03 : 0), 0]); }
    part(inner, sphere(), gloss('#ee7fa6'), [0, .57, 0], null, [.025, .018, .025]); top = .6;
  } else { for (let i = 0; i < 5; i++) part(inner, sphere(), i % 2 ? g1 : g2, [(R() - .5) * .12, .38 + R() * .12, (R() - .5) * .12], null, .1 + R() * .04); top = .58; }
  return finish(g, o, small ? .35 : .7, { top: (small ? .5 : 1) * top });
}
function vase_flowers(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(['#3f6fd1', '#f1ebde', '#e2432f', '#3f9c95', '#e0a33a'], R), stemM = mat('#5c8a3a', { rough: .8 });
  part(g, hollow([[.05, 0], [.06, .01], [.075, .08], [.06, .17], [.035, .22], [.04, .25]], .006, .015, 40), gloss(col));
  const n = o.count ?? (5 + Math.floor(R() * 3));
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + R() * .5, rr2 = .04 + R() * .09, y = .42 + R() * .16, c = Math.cos(a), s = Math.sin(a), p = [c * rr2, y, s * rr2];
    tube(g, [[c * .01, .2, s * .01], [c * rr2 * .4, y * .78, s * rr2 * .4], p], .0045, stemM, 12, 6);
    const head = grp(g, p, [s * .5, 0, -c * .5]), kind = R() < .5 ? 'daisy' : 'tulip';
    if (kind === 'daisy') { const pc = pick(['#fbf8f2', '#f7a6c4', '#f6e36a'], R); part(head, sphere(), mat('#f6b324'), [0, .008, 0], null, [.02, .011, .02]); for (let k = 0; k < 10; k++) { const b = k / 10 * TAU; part(head, sphere(), mat(pc, { rough: .6 }), [Math.cos(b) * .034, .005, Math.sin(b) * .034], [0, -b, 0], [.026, .005, .012]); } }
    else { const tc = gloss(pick(['#e2432f', '#ee7fa6', '#f6c945', '#7a4fc4'], R)); part(head, lath([[0, 0], [.02, .006], [.03, .028], [.028, .052], [.0, .046]], 20, 3), tc); for (let k = 0; k < 3; k++) { const b = k / 3 * TAU; part(head, sphere(), tc, [Math.cos(b) * .016, .05, Math.sin(b) * .016], [Math.sin(b) * .3, 0, -Math.cos(b) * .3], [.014, .014, .01]); } }
  }
  for (const s of [-1, 1]) part(g, sphere(), mat('#4f9a3e', { rough: .75 }), [s * .05, .3, .02], [0, 0, s * .7], [.015, .07, .006]);
  return finish(g, o, .6, { top: .25 });
}
function book(o) {
  const R = rnd(o.seed), g = new THREE.Group(), col = o.color || pick(BOOKS, R), cv = mat(col, { rough: .65 }), pg = mat('#f7f1e3', { rough: .9 });
  const t = tex('bookcover' + col + (o.text || ''), 200, 288, (x, W, H) => { x.fillStyle = col; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(W * .08, 0, W * .04, H); if (o.text) txt(x, o.text, W * .55, H * .3, H * .1, { color: '#f7f1e3', max: W * .75 }); else lines(x, W * .2, H * .22, W * .65, 2, H * .08, H * .045, 'rgba(247,241,227,.9)', rnd(5)); circ(x, W * .55, H * .64, W * .16, 'rgba(247,241,227,.35)'); });
  part(g, rbox(.16, .004, .23, .002, 1), cv, [0, .002, 0]);
  part(g, rbox(.16, .004, .23, .002, 1), [cv, cv, texMat(t, { rough: .65 }), cv, cv, cv], [0, .03, 0]);
  part(g, rbox(.008, .032, .23, .003, 1), cv, [-.077, .016, 0]);
  part(g, rbox(.15, .024, .222, .002, 1), pg, [.003, .016, 0]);
  return finish(g, o, .23, { top: .032, grip: { at: [0, .016, 0], rot: [0, 0, 0] } });
}
function book_stack(o) {
  const R = rnd(o.seed), g = new THREE.Group(), n = o.count ?? 4, parts = []; let y = 0;
  for (let i = 0; i < n; i++) { const t = .025 + R() * .03, w = .15 + R() * .07, d = .2 + R() * .06, c = pick(BOOKS, R); parts.push({ geo: rbox(w, t, d, .004, 1), pos: [(R() - .5) * .02, y + t / 2, (R() - .5) * .02], rot: [0, (R() - .5) * .3, 0], color: c }); parts.push({ geo: rbox(w * .97, t * .7, .004, .0015, 1), pos: [(R() - .5) * .0, y + t / 2, 0], color: '#f7f1e3', skip: true }); y += t; }
  const m = part(g, mergeParts(parts.filter(p => !p.skip)), vcMat(.7)); m.userData.ink = .0024;
  return finish(g, o, .25, { top: y, grip: { at: [0, y / 2, 0], rot: [0, 0, 0] } });
}
function calendar(o) {
  const R = rnd(o.seed), g = new THREE.Group(), M = o.mount ?? 1.5, month = o.text || pick(['JANUARY', 'MARCH', 'MAY', 'JULY', 'OCTOBER', 'DECEMBER'], R), circled = o.day ?? (3 + Math.floor(R() * 24));
  const t = tex('cal' + month + circled, 300, 420, (x, W, H) => { x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, W, H); x.fillStyle = '#d83a34'; x.fillRect(0, H * .08, W, H * .16); txt(x, month, W / 2, H * .16, H * .085, { color: '#ffffff', max: W * .86 });
    for (let d = 0; d < 35; d++) { const cx = W * (.1 + (d % 7) * .133), cy = H * (.34 + Math.floor(d / 7) * .13), n = d - 2; if (n >= 1 && n <= 31) txt(x, String(n), cx, cy, H * .045, { color: d % 7 === 0 ? '#d83a34' : '#2a1d17' }); if (n === circled) { x.strokeStyle = '#d83a34'; x.lineWidth = 4; x.beginPath(); x.ellipse(cx, cy, W * .06, H * .04, -.2, 0, TAU); x.stroke(); } } });
  const pm = mat('#fbf8f0', { rough: .85 });
  part(g, rbox(.3, .42, .004, .0015, 1), [pm, pm, pm, pm, texMat(t, { rough: .85 }), pm], [0, M, .006]);
  for (let i = 0; i < 8; i++) part(g, torus(.008, .0012, TAU, 6, 16), metal(), [-.12 + i * .034, M + .2, .006], [0, PI / 2, 0]);
  part(g, sphere(), metal(), [0, M + .23, .004], null, .005);
  return finish(g, o, .42, { wall: true });
}
function clipboard(o) {
  const g = new THREE.Group(), board = mat('#a87a48', { rough: .6 }), mt = metal();
  const t = tex('clip' + (o.text || ''), 256, 340, (x, W, H) => { x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, W, H); txt(x, o.text || 'CHECKLIST', W / 2, H * .1, H * .06, { color: '#1d2b4f', max: W * .8 }); for (let i = 0; i < 6; i++) { const y = H * (.24 + i * .12); x.strokeStyle = '#55606e'; x.lineWidth = 3; x.strokeRect(W * .1, y - 12, 24, 24); if (i < 3) { x.strokeStyle = '#2f9c55'; x.lineWidth = 5; x.beginPath(); x.moveTo(W * .1 + 4, y); x.lineTo(W * .1 + 11, y + 8); x.lineTo(W * .1 + 24, y - 12); x.stroke(); } lines(x, W * .26, y - 5, W * .62, 1, 0, 10, '#a7adb5', rnd(i + 2)); } });
  const pm = mat('#fbf8f0', { rough: .9 });
  part(g, rbox(.23, .006, .32, .01, 2), board, [0, .003, 0]);
  part(g, rbox(.21, .0015, .28, .0006, 1), [pm, pm, texMat(t, { rough: .9 }), pm, pm, pm], [0, .007, .01]);
  part(g, rbox(.1, .012, .04, .005), mt, [0, .012, -.13]);
  part(g, rcyl(.006, .006, .08, .002, 12), mt, [-.04, .017, -.15], [0, 0, -PI / 2]);
  return finish(g, o, .32, { top: .008, screen: t, grip: { at: [0, .01, -.13], rot: [-PI / 2, 0, 0] } });
}

// ================= registry =================
const def = (tags, desc, make) => ({ make, tags: ['indoor', ...tags], desc });
export const REG = {
  // furniture
  chair: def(['furniture', 'seat', 'home', 'kitchen'], 'wooden ladder-back chair, seat .45 m (o.cushion: colour)', chair),
  stool: def(['furniture', 'seat', 'home'], 'round wooden four-leg stool, seat .48 m', stool),
  bar_stool: def(['furniture', 'seat', 'kitchen', 'diner'], 'chrome bar stool with a round glossy cushion, seat .78 m', bar_stool),
  armchair: def(['furniture', 'seat', 'home'], 'chunky upholstered armchair with rolled arms, seat .49 m', o => couch(o, 1, .95)),
  sofa: def(['furniture', 'seat', 'home'], 'three-seat sofa, rolled arms, seat .49 m (o.count seats, o.w width)', o => couch(o, o.count ?? 3, o.w ?? 2.0)),
  bed: def(['furniture', 'seat', 'home', 'bedroom'], 'double bed with headboard, pillows and a folded-back duvet (o.single, o.w)', bed),
  dining_table: def(['furniture', 'table', 'home', 'kitchen'], 'wooden dining table 1.6 x .9, top .75 m', dining_table),
  coffee_table: def(['furniture', 'table', 'home'], 'low wooden coffee table with a shelf, top .42 m', coffee_table),
  side_table: def(['furniture', 'table', 'home', 'bedroom'], 'bedside / side table with a drawer, top .59 m', side_table),
  desk: def(['furniture', 'table', 'office'], 'office desk with a three-drawer pedestal, top .75 m', desk),
  office_chair: def(['furniture', 'seat', 'office'], 'swivel office chair on five castors, seat .5 m', office_chair),
  kitchen_counter: def(['furniture', 'kitchen', 'table'], 'base cabinets with worktop and splashback, top .92 m (o.w)', kitchen_counter),
  wall_cabinet: def(['furniture', 'kitchen', 'wall'], 'upper wall cabinet hung at 1.45 m (o.mount), back at z 0', wall_cabinet),
  cabinet: def(['furniture', 'home', 'bedroom'], 'six-drawer dresser / sideboard, top .88 m', cabinet),
  shelf: def(['furniture', 'storage', 'home', 'office'], 'open shelving dressed with books, jars, plants, boxes (o.fill false = empty)', shelf),
  bookshelf: def(['furniture', 'storage', 'home', 'office', 'school'], 'tall bookcase packed with books (userData.shelves = board heights)', bookshelf),
  wardrobe: def(['furniture', 'storage', 'bedroom'], 'two-door wardrobe (o.open 0..1 shows hanging shirts; userData.doors)', wardrobe),
  door: def(['architecture', 'wall', 'home'], 'panelled door 0.9 x 2.1 with frame, back at z 0 (o.open 0..1, o.beyond: lit colour; userData.door hinge)', door),
  window: def(['architecture', 'wall', 'home'], 'window with frame, sill, view (o.view day|night|sunset|dusk), curtains (o.curtains colour|false, o.long), o.blinds', windowProp),
  rug: def(['furniture', 'decor', 'floor', 'home'], 'flat rug (o.shape rect|round|runner, o.pattern border|diamond|stripes|rings), solid false', rug),
  picture_frame: def(['decor', 'wall', 'home'], 'framed picture at 1.55 m (o.art landscape|portrait|abstract|sunset, o.tex, o.text; o.mount 0 = stands)', picture_frame),
  wall_clock: def(['decor', 'wall', 'home', 'office', 'school'], 'round wall clock at 2 m (o.time "10:10"; userData.hands.hour/minute rotate z)', wall_clock),
  // lights
  floor_lamp: def(['light', 'furniture', 'home'], 'floor lamp with a glowing drum shade + point light (o.lit false = off, o.intensity)', floor_lamp),
  desk_lamp: def(['light', 'office', 'home'], 'articulated desk lamp with a lit head + point light', desk_lamp),
  bulb: def(['light', 'home'], 'bare bulb on a cord from the ceiling (o.ceiling 3, o.drop 1); userData.pivot swings it, userData.light', o => hanging(o, false)),
  pendant_lamp: def(['light', 'home', 'kitchen'], 'pendant lamp with a dome shade glowing underneath (o.color, o.ceiling, o.drop); userData.pivot swings', o => hanging(o, true)),
  // kitchen
  fridge: def(['kitchen', 'appliance'], 'two-door fridge with a note and magnets (o.open 0..1 shows lit shelves with food)', fridge),
  stove: def(['kitchen', 'appliance'], 'cooker with four burners and an oven (o.lit: glowing burner + oven light)', stove),
  sink: def(['kitchen'], 'kitchen sink unit: cabinet, worktop with a steel basin, gooseneck tap', sink),
  microwave: def(['kitchen', 'appliance'], 'microwave with a green clock display (o.text, o.lit: running)', microwave),
  toaster: def(['kitchen', 'appliance'], 'retro toaster with two slices popping up (o.toast false)', toaster),
  kettle: def(['kitchen'], 'stovetop kettle with arched handle and spout', kettle),
  mug: def(['kitchen', 'small'], 'ceramic mug of coffee (o.fill coffee|tea|cocoa|milk|none, o.print smile|heart|none, o.text)', mug),
  plate: def(['kitchen', 'small'], 'white dinner plate with a coloured rim line', plate),
  bowl: def(['kitchen', 'small', 'food'], 'ceramic bowl (o.fill soup|cereal|none)', bowl),
  pot: def(['kitchen'], 'cooking pot with handles and lid (o.lid false)', pot),
  pan: def(['kitchen'], 'frying pan with long handle (o.food "egg")', pan),
  bottle: def(['kitchen', 'small', 'drink'], 'labelled bottle (o.kind water|soda|wine|juice, o.text)', bottle),
  glass: def(['kitchen', 'small', 'drink'], 'drinking glass (o.fill water|milk|juice|soda|empty)', glass),
  jar: def(['kitchen', 'small', 'food'], 'glass jar with lid and label (o.kind jam|honey|pickles, o.text)', jar),
  cereal_box: def(['kitchen', 'food'], 'printed cereal box with an invented brand (o.text, o.color)', cereal_box),
  fruit_bowl: def(['kitchen', 'food'], 'bowl of apples, orange, grapes and bananas', fruit_bowl),
  apple: def(['food', 'small'], 'apple with stem and leaf (o.color)', apple),
  banana: def(['food', 'small'], 'banana (o.count bunch)', banana),
  bread_loaf: def(['food', 'kitchen'], 'crusty bread loaf with scored top', bread_loaf),
  pizza: def(['food'], 'pepperoni pizza in eight slices (o.missing; userData.slices)', pizza),
  pizza_box: def(['food', 'kitchen'], 'pizza box with printed lid (o.open 0..1 shows the pizza, o.text)', pizza_box),
  cake: def(['food', 'party'], 'two-tier frosted cake on a stand (o.candles n lit candles, o.color)', cake),
  cookie_jar: def(['food', 'kitchen'], 'glass cookie jar full of cookies with a label (o.text)', cookie_jar),
  cookie: def(['food', 'small'], 'chocolate chip cookie', cookie),
  // bathroom
  bathtub: def(['bathroom'], 'clawfoot bathtub full of water (o.bubbles, o.duck, o.water false)', bathtub),
  toilet: def(['bathroom'], 'toilet with tank (o.open: lid up; userData.lid)', toilet),
  bathroom_sink: def(['bathroom'], 'pedestal wash basin with tap, top .84 m', bathroom_sink),
  mirror: def(['bathroom', 'wall', 'decor'], 'wall mirror (o.shape rect|oval) at 1.55 m', mirror),
  towel: def(['bathroom', 'wall'], 'striped towel draped over a wall rail at 1.15 m', towel),
  towel_stack: def(['bathroom', 'home'], 'stack of folded towels (o.count)', towel_stack),
  toilet_paper: def(['bathroom', 'small'], 'toilet paper roll', toilet_paper),
  // office + school
  whiteboard: def(['office', 'school', 'wall'], 'whiteboard with marker tray (o.text lines with \\n, o.stand: on wheels); userData.screen', o => boardProp(o, false)),
  chalkboard: def(['school', 'wall'], 'green chalkboard with wooden frame and chalk tray (o.text); userData.screen', o => boardProp(o, true)),
  school_desk: def(['school', 'furniture', 'table'], 'school desk with book tray, top .75 m', school_desk),
  school_chair: def(['school', 'furniture', 'seat'], 'plastic school chair on a tube frame, seat .46 m', school_chair),
  filing_cabinet: def(['office', 'furniture', 'storage'], 'metal filing cabinet (o.count drawers, o.open = drawer index pulled out with folders)', filing_cabinet),
  paper_stack: def(['office', 'paper'], 'stack of printed paper (o.count sheets, o.text heading)', paper_stack),
  notebook: def(['office', 'school', 'paper', 'small'], 'spiral notebook (o.text label, o.open)', notebook),
  pen: def(['office', 'school', 'small'], 'ballpoint pen lying down (o.color)', pen),
  envelope: def(['office', 'paper', 'small'], 'envelope: back with flap and seal, or front with stamp + address (o.text e.g. "FINAL NOTICE")', envelope),
  cheque: def(['office', 'money', 'paper', 'small'], 'bank cheque (o.to, o.amount, o.words, o.date, o.signed); userData.screen to write it live', cheque),
  sticky_note: def(['office', 'paper', 'small'], 'sticky note with curled corner (o.text, o.stick: upright against a surface)', sticky_note),
  trash_can: def(['office', 'home'], 'waste bin with crumpled paper (o.spill false)', trash_can),
  cardboard_box: def(['storage', 'home', 'office'], 'taped cardboard box with FRAGILE print (o.size [w,h,d], o.text, o.open)', cardboard_box),
  crate: def(['storage', 'outdoor'], 'wooden slat crate (o.kind plastic, o.text stencil, o.fill "apples")', crate),
  suitcase: def(['travel', 'storage'], 'hard-shell rolling suitcase (o.handle: telescopic handle up)', suitcase),
  briefcase: def(['office', 'travel'], 'leather briefcase with gold latches', briefcase),
  calendar: def(['office', 'wall', 'home'], 'wall calendar with a circled day (o.text month, o.day)', calendar),
  clipboard: def(['office', 'medical', 'school', 'paper'], 'clipboard with a checklist (o.text title); userData.screen', clipboard),
  book: def(['school', 'office', 'home', 'small'], 'hardback book lying flat (o.text title, o.color)', book),
  book_stack: def(['school', 'office', 'home'], 'stack of books (o.count)', book_stack),
  // money + party
  money_stack: def(['money', 'small'], 'banded banknote bundles (o.count bundles, piled)', money_stack),
  coins_pile: def(['money', 'small'], 'gold coin stacks with loose coins (o.count stacks)', coins_pile),
  wallet: def(['money', 'small'], 'leather wallet with a note and a card peeking out', wallet),
  piggy_bank: def(['money', 'home'], 'pink piggy bank with a coin slot', piggy_bank),
  trophy: def(['party', 'office', 'decor'], 'gold trophy cup on a base with a plate (o.text)', trophy),
  gift_box: def(['party'], 'wrapped gift box with ribbon and bow (o.color, o.ribbon)', gift_box),
  balloon: def(['party'], 'shiny balloon on a string (o.len string, o.color); string end at the origin', balloon),
  candle: def(['party', 'light', 'home'], 'lit pillar candle on a brass dish (o.lit false; userData.flame, light)', candle),
  // medical
  pill_bottle: def(['medical', 'small'], 'amber pill bottle with child cap and label (o.text, o.sub, o.lying, o.pills n scattered)', pill_bottle),
  pill: def(['medical', 'small'], 'two-tone capsule lying down (o.color, o.color2, o.kind "tablet")', pill),
  first_aid_kit: def(['medical'], 'first-aid case with a cross (o.color "red")', first_aid_kit),
  hospital_bed: def(['medical', 'furniture', 'seat'], 'hospital bed with raised back, rails, blanket (userData.back)', hospital_bed),
  iv_stand: def(['medical'], 'IV drip stand with saline bag and tube', iv_stand),
  stethoscope: def(['medical', 'small'], 'stethoscope lying flat', stethoscope),
  bandage_roll: def(['medical', 'small'], 'gauze bandage roll with an unrolled tail', bandage_roll),
  // tools + home
  broom: def(['tools', 'home'], 'broom standing on its bristles (grip at 1.0 m)', broom),
  bucket: def(['tools', 'home'], 'plastic bucket with wire handle (o.water)', bucket),
  ladder: def(['tools', 'home'], 'A-frame step ladder 1.5 m', ladder),
  toolbox: def(['tools'], 'metal toolbox with carry handle', toolbox),
  hammer: def(['tools', 'small'], 'claw hammer lying on its side', hammer),
  wrench: def(['tools', 'small'], 'open-end / ring spanner lying flat', wrench),
  battery: def(['tools', 'tech', 'small'], 'cylinder battery with + mark (o.text, o.band colour)', battery),
  light_switch: def(['home', 'wall', 'small'], 'wall light switch at 1.15 m (o.lit false = switched off)', light_switch),
  smoke_alarm: def(['home', 'wall', 'small'], 'smoke alarm with red LED on the wall at 2.3 m (o.ceiling: on the ceiling, o.lit false)', smoke_alarm),
  fan: def(['home', 'appliance', 'office'], 'pedestal fan with wire cage (o.desk: small desk fan; userData.spin rotates z)', fan),
  radiator: def(['home', 'wall'], 'column radiator against the wall (o.count sections)', radiator),
  potted_plant: def(['plant', 'decor', 'home', 'office'], 'potted plant (o.kind leafy|snake|cactus|bush, o.small for desks, o.pot colour)', potted_plant),
  vase_flowers: def(['plant', 'decor', 'home'], 'vase of daisies and tulips (o.count, o.color)', vase_flowers),
};

// module.recon.ground-cover v1 - instanced small stuff that makes procedural ground read as real: grass tufts, scattered
// stones, gravel pressed into a cut face, roots fanning down a face. All instanced or merged, all noContact (decoration).
// Contract: THREE from engine.js; part/std from lib/crime.js; hh from lib/crimeover.js.
import { THREE } from '../../engine.js';
import { part, std } from '../../lib/crime.js';
import { hh } from '../../lib/crimeover.js';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// grassTufts(parent, spots, o): clumps of thin tapered curved blades (50 per clump). spots = [[cx, cz, radius, clumps,
// height], ...] on the ground plane y = o.y (0). Straw-coloured under a moon by default (o.color). Far tufts on a steep
// AI-image top need ~2x the size to read like the reference (it scales props up with distance).
export function grassTufts(parent, spots, o = {}) {
  const blade = new THREE.PlaneGeometry(.05, 1, 1, 4); blade.translate(0, .5, 0); const bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y * .9)); bp.setZ(i, y * y * .25); }
  blade.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: o.color ?? 0xb4b89c, roughness: .9, side: THREE.DoubleSide });
  let n = 0; for (const s of spots) n += s[3]; const im = new THREE.InstancedMesh(blade, mat, n * 50); im.name = 'grass'; im.userData.noContact = true; im.castShadow = true; im.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let k = 0; const y0 = o.y ?? 0;
  for (const [cx, cz, r, cnt, h] of spots) for (let t = 0; t < cnt; t++) {
    const a = hh(k, 1) * 6.283, d = Math.sqrt(hh(k, 2)) * r, tx = cx + Math.cos(a) * d, tz = cz + Math.sin(a) * d, th = (h ?? .55) * (.6 + hh(k, 3) * .7);
    for (let b = 0; b < 50; b++, k++) { const ba = hh(k, 4) * 6.283, lean = .15 + hh(k, 5) * .55;
      q.setFromAxisAngle(V(0, 1, 0), ba); q.premultiply(new THREE.Quaternion().setFromAxisAngle(V(Math.cos(ba), 0, -Math.sin(ba)), lean));
      m.compose(V(tx + (hh(k, 6) - .5) * .25 * th, y0, tz + (hh(k, 7) - .5) * .25 * th), q, V(th, th * (.7 + hh(k, 8) * .5), th)); im.setMatrixAt(k, m);
      c.setHSL(.12 + hh(k, 9) * .05, .12 + hh(k, 10) * .12, .42 + hh(k, 11) * .22); im.setColorAt(k, c); } }
  im.count = k; parent.add(im); return im;
}
// stones(parent, n, area, o): n angular stones (dodecahedra squashed to .6 height) scattered in area = [x0, x1, z0, z1] on
// the plane y = o.y, half sunk (y + .35 s). o: seed, color (0x7a808a), size (.14 max extra radius).
export function stones(parent, n, area, o = {}) {
  const seed = o.seed ?? 0, im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), std(o.color ?? 0x7a808a, .9), n); im.name = 'stones'; im.userData.noContact = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { const s = .04 + hh(i + seed, 1) ** 2 * (o.size ?? .14); q.setFromEuler(new THREE.Euler(hh(i, 2) * 3, hh(i, 3) * 3, 0));
    m.compose(V(area[0] + hh(i + seed, 4) * (area[1] - area[0]), (o.y ?? 0) + s * .35, area[2] + hh(i + seed, 5) * (area[3] - area[2])), q, V(s, s * .6, s)); im.setMatrixAt(i, m); }
  parent.add(im); return im;
}
// faceGravel(parent, surf, o): pebbles pressed into a vertical cut face (plane z ~ 0) seated on its relief: surf(x, y) is
// the face's z at (x, y) (module.any.relief reliefFaces().surf). o: n (450), x0, x1, y0, y1, skip(x, y) -> true to leave
// a hole (shafts, tunnels), color, seed. Without gravel a relief face reads as 'stucco'.
export function faceGravel(parent, surf, o = {}) {
  const N = o.n ?? 450, im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), std(o.color ?? 0x6b5a48, .9), N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s0 = o.seed ?? 91;
  const x0 = o.x0 ?? -5, x1 = o.x1 ?? 5, y0 = o.y0 ?? -5, y1 = o.y1 ?? 0;
  let k = 0; for (let i = 0; i < N * 5 && k < N; i++) { const x = x0 + hh(i, s0) * (x1 - x0), y = y1 - hh(i, s0 + 1) * (y1 - y0), r = .012 + hh(i, s0 + 2) ** 2 * .035;
    if (o.skip?.(x, y)) continue;
    q.setFromEuler(e.set(hh(i, s0 + 3) * 3, hh(i, s0 + 4) * 3, hh(i, s0 + 5) * 3)); m4.compose(V(x, y, surf(x, y) + r * .2), q, V(r * 1.3, r * .8, r)); im.setMatrixAt(k++, m4); }
  im.count = k; im.castShadow = im.receiveShadow = true; im.name = 'gravel'; im.userData.noContact = true; parent.add(im); return im;
}
// faceStones(parent, surf, list, o): bigger pale angular stones half buried in a face: list = [[x, y, r, seed?], ...]
export function faceStones(parent, surf, list, o = {}) {
  const mat = o.mat ?? std(o.color ?? 0x6e665d, .85);
  return list.map(([x, y, r, k], i) => { k ??= i; const s = part(new THREE.DodecahedronGeometry(r, 0), mat, [x, y, surf(x, y) + r * .15], [hh(k, 4) * 3, hh(k, 5) * 3, 0], parent, 'stone'); s.scale.set(1.4, .8, .8); s.userData.noContact = true; return s; });
}
// roots(parent, surf, starts, o): thin branching roots growing down a face from starts = [[x, y, angle, length], ...],
// laid ON the relief (z = surf + r * .6), 2 levels of branches. o: r (.026), color, floor (stop y), seed.
export function roots(parent, surf, starts, o = {}) {
  const mat = std(o.color ?? 0x6e5a44, .8), out = [], floor = o.floor ?? -1e9;
  const tube = (pts, r) => { const m = part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 6), r, 5), mat, [0, 0, 0], null, parent, 'root'); m.userData.noContact = true; out.push(m); };
  const grow = (x, y, ang, len, r, depth, sd) => { const pts = [], n = 8; let X = x, Y = y, a = ang;
    for (let i = 0; i <= n; i++) { pts.push(V(X, Y, surf(X, Y) + r * .6)); a += (hh(sd, i) - .5) * .28; X += Math.sin(a) * len / n; Y -= Math.cos(a) * len / n; if (Y < floor) break; }
    if (pts.length > 2) tube(pts, r);
    if (depth > 0) for (let b = 0; b < (depth > 1 ? 2 : 1); b++) { const k = 2 + Math.floor(hh(sd, b + 30) * (pts.length - 3)), p = pts[k]; if (!p) continue;
      grow(p.x, p.y, a + (hh(sd, b + 40) - .5) * 1.6, len * (.45 + hh(sd, b + 50) * .3), r * .55, depth - 1, sd * 7 + b + 1); } };
  starts.forEach(([x, y, a, len], k) => grow(x, y, a, len, o.r ?? .026, o.depth ?? 2, k + (o.seed ?? 3)));
  return out;
}

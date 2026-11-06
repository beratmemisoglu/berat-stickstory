// module.any.relief v1 - rough faces (cut earth, rock, spoil) as displaced planes, the noise behind them, and the closed
// backing volume that makes a relief count as a solid. From the prison-tunnel shot match (19 passes, critic-tuned).
// Contract: imports only THREE from the project's engine.js.
import { THREE } from '../../engine.js';

// deterministic hash 0..1 (same as lib/crimeover.js hh, so patterns match the recon kit's)
export function hash(a, b = 0) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296;
}
// value noise and 5-octave fbm, 0..1
export const vnoise = (x, y, s = 0) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi * 7 + s, yi * 13), b = hash((xi + 1) * 7 + s, yi * 13), c = hash(xi * 7 + s, (yi + 1) * 13), d = hash((xi + 1) * 7 + s, (yi + 1) * 13);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
export const fbm = (x, y, s = 0, oct = 5) => { let t = 0, a = .5, f = 1; for (let o = 0; o < oct; o++) { t += a * vnoise(x * f, y * f, s + o * 31); a *= .5; f *= 2.1; } return t; };

// reliefHeight(x, y, w, h, amp, seed, o): the displacement at local (x, y) of a w x h face. Edges are pinned to 0 over 12 cm
// (o.pin === false: not pinned). Three noise scales (2.4 / 6 / 14 per m: finer read as soil, coarser as foam/sponge, see
// solution.any.relief-scale-at-render) and the deep pits clamped at -0.12 amp (soil settles, it has no black holes). o.bias lifts it.
export function reliefHeight(x, y, w, h, amp, seed, o = {}) {
  const ex = Math.min(1, (w / 2 - Math.abs(x)) / .12), ey = Math.min(1, (h / 2 - Math.abs(y)) / .12), e = o.pin === false ? 1 : Math.max(0, Math.min(ex, ey));
  const f = o.freq ?? 1, n = fbm(x * 2.4 * f + seed, y * 2.4 * f, seed) - .5, k = fbm(x * 6 * f + seed, y * 6 * f, seed + 9) - .5, c = Math.max(0, fbm(x * 14 * f + seed, y * 14 * f, seed + 17) - .45);
  return Math.max(-.12 * amp, n * amp + k * amp * .6 + c * amp * .5) * e + (o.bias ?? 0) * e;
}

// relief(w, h, amp, seed, mat, o): a rough face in the local xy plane facing +z, w x h metres, amp m of relief.
// o.res vertices per metre (28), o.tile metres per UV unit (1: UVs in metres, so a material's repeat = tiles per metre,
// as module.recon.canvas-materials perMetre() makes them), o.pin, o.bias, o.freq.
// The mesh carries userData.heightAt(lx, ly) (local) so things that sit ON it (stones, roots, gravel) can be seated.
// A relief is an open surface: it is NOT a solid for S.collide. Pair it with backing() (see below).
export function relief(w, h, amp, seed, mat, o = {}) {
  const sw = Math.max(8, Math.round(w * (o.res ?? 28))), sh = Math.max(8, Math.round(h * (o.res ?? 28)));
  const g = new THREE.PlaneGeometry(w, h, sw, sh), p = g.attributes.position, uv = g.attributes.uv, tile = o.tile ?? 1;
  for (let i = 0; i < p.count; i++) p.setZ(i, reliefHeight(p.getX(i), p.getY(i), w, h, amp, seed, o));
  g.computeVertexNormals();
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; if (o.name) m.name = o.name;
  m.userData.heightAt = (lx, ly) => reliefHeight(lx, ly, w, h, amp, seed, o);
  return m;
}

// reliefFaces(parent): a registry of front faces in one plane, so props can be seated on the surface at world (X, Y):
//   const R = reliefFaces(G); R.face(x0, x1, y0, y1, z, seed, amp, mat, o); const zAt = R.surf(X, Y)
export function reliefFaces(parent) {
  const faces = [];
  const face = (x0, x1, y0, y1, z, seed, amp, mat, o = {}) => { const m = relief(x1 - x0, y1 - y0, amp, seed, mat, o); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); m.name = o.name ?? 'relief face'; parent.add(m);
    faces.push({ x0, x1, y0, y1, z, seed, amp, o }); return m; };
  const surf = (X, Y, fallback = .02) => { const f = faces.find(q => X >= q.x0 && X <= q.x1 && Y >= q.y0 && Y <= q.y1 && !q.o.back); if (!f) return fallback;
    return f.z + reliefHeight(X - (f.x0 + f.x1) / 2, Y - (f.y0 + f.y1) / 2, f.x1 - f.x0, f.y1 - f.y0, f.amp, f.seed, f.o); };
  return { face, surf, faces };
}

// backing(w, h, depth, mat, o): the closed volume behind a relief so S.collide treats the earth as solid (a relief alone
// lets bodies pass through earth). It sits o.gap metres (default .3) BEHIND the face plane: clamped displacement makes flat
// plateaus at a fixed depth, and a backing box at exactly that depth z-fights (FLICKER 6,400 px in the tunnel shot).
// Returns a Mesh whose front face is at local z = -gap; position it like the relief.
export function backing(w, h, depth, mat, o = {}) {
  const gap = o.gap ?? .3, m = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), mat);
  m.geometry.translate(0, 0, -gap - depth / 2); m.castShadow = false; m.receiveShadow = true; m.name = o.name ?? 'relief backing'; return m;
}

// lumpyBox(w, h, d, seed, amp, sag): a box with noisy faces (rubble blocks, mattresses, pillows, spoil heaps)
export function lumpyBox(w, h, d, seed, amp = .03, sag = 0) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w * 14)), 3, Math.max(1, Math.round(d * 14))), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = fbm(x * 3 + seed, z * 3, seed) - .5, top = y > 0 ? 1 : .3;
    p.setY(i, y + n * amp * 2 * top - sag * (1 - (2 * z / d) ** 2) * (y > 0 ? 1 : 0)); p.setX(i, x + (fbm(z * 4, y * 4 + seed, seed + 3) - .5) * amp); p.setZ(i, z + (fbm(x * 4, y * 4, seed + 5) - .5) * amp); }
  g.computeVertexNormals(); return g;
}

// lumpyLip(L, r, seed): a long lumpy roll (the clod lip along a cut edge over a tunnel); axis along y, rotate it into place
export function lumpyLip(L, r = .11, seed = 41) {
  const g = new THREE.CylinderGeometry(r, r, L, 24, Math.max(1, Math.round(L * 30)), false), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)); const rr = Math.hypot(v.x, v.z), a = Math.atan2(v.z, v.x),
      k = 1 + (fbm(v.y * 3, a * 2, seed) - .5) * 1.1 + (fbm(v.y * 9, a * 4, seed + 2) - .5) * .5;
    if (rr > 1e-4) { v.x *= k; v.z *= k; } p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}

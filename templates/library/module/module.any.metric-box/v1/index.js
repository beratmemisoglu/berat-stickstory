// module.any.metric-box v1 - box geometry whose UVs are in METRES on every face, and one-mesh merging of parts.
// Why: BoxGeometry maps 0..1 onto every face, so one texture tile stretches over a 16 m slab and reads as planks or
// streaks (prison-tunnel pass 6). With metric UVs a material's repeat means "tiles per metre" on every face at once.
// Contract: imports only THREE from the project's engine.js (every berat studio engine exports it).
import { THREE } from '../../engine.js';

// metricBox(w, h, d, unit = 1): a BoxGeometry with UVs = metres / unit on each face (unit 2 = one UV per 2 m).
// Face order +x -x +y -y +z -z -> UV extents (d,h) (d,h) (w,d) (w,d) (w,h) (w,h).
export function metricBox(w, h, d, unit = 1, seg = [1, 1, 1]) {
  const g = new THREE.BoxGeometry(w, h, d, ...seg), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const [sx, sy, sz] = seg, cnt = [(sz + 1) * (sy + 1), (sz + 1) * (sy + 1), (sx + 1) * (sz + 1), (sx + 1) * (sz + 1), (sx + 1) * (sy + 1), (sx + 1) * (sy + 1)];
  let f = 0, end = cnt[0];
  for (let i = 0; i < uv.count; i++) { while (i >= end && f < 5) end += cnt[++f]; const [a, b] = dims[f]; uv.setXY(i, uv.getX(i) * a / unit, uv.getY(i) * b / unit); }
  return g;
}

// metricUV(geometry, unit = 1, axes = 'auto'): rewrites the UVs of any geometry to world-size metres by projecting each
// vertex on the two axes its normal is most perpendicular to (a cheap tri-planar box projection). Good for extrusions,
// lathes seen from the side and displaced planes; call after the geometry is final.
export function metricUV(g, unit = 1) {
  const p = g.attributes.position, n = g.attributes.normal ?? (g.computeVertexNormals(), g.attributes.normal);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay >= ax && ay >= az) uv.setXY(i, x / unit, z / unit); else if (ax >= az) uv.setXY(i, z / unit, y / unit); else uv.setXY(i, x / unit, y / unit); }
  uv.needsUpdate = true; return g;
}

// merged(geometries): several geometries (already translated/rotated) as ONE BufferGeometry (position, normal, uv only).
// Why: the coplanar checker pairs surfaces by world AABB, so two rotated rails (or neighbouring planks) at one height are
// flagged although they never touch; lifting one by 1 cm to dodge it changes contacts (the cart's wheels sank into the
// rail). One mesh has no partner to pair with.
export function merged(list) {
  const parts = list.map(g => { const q = g.index ? g.toNonIndexed() : g.clone(); if (!q.attributes.normal) q.computeVertexNormals();
    if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2)); return q; });
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) { const n = parts[0].attributes[k].itemSize, len = parts.reduce((s, q) => s + q.attributes[k].array.length, 0), a = new Float32Array(len); let o = 0;
    for (const q of parts) { a.set(q.attributes[k].array, o); o += q.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(a, n)); }
  out.computeBoundingBox(); out.computeBoundingSphere(); return out;
}

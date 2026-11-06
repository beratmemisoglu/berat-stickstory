// module.any.frustum v1 - an open box wider at the top (a mine-cart tub, a hopper, a planter, a bin) built as its own
// BufferGeometry. Why: a 4-sided CylinderGeometry turned by pi/4 and then scaled non-uniformly is SHEARED into a diamond
// (scale applies before rotation in a mesh's matrix), which is how the first cart came out.
// Contract: imports only THREE from the project's engine.js.
import { THREE } from '../../engine.js';

// frustum(tl, tw, bl, bw, h, o): top length/width, bottom length/width, height; origin at the bottom centre.
// o.floor (true) closes the bottom; o.lid (false) closes the top; flat normals, metric UVs (o.unit m per repeat, 1).
// The faces are single-sided: use a DoubleSide material to see the inside of an open tub.
export function frustum(tl, tw, bl, bw, h, o = {}) {
  const T = [[-tl / 2, h, -tw / 2], [tl / 2, h, -tw / 2], [tl / 2, h, tw / 2], [-tl / 2, h, tw / 2]], B = [[-bl / 2, 0, -bw / 2], [bl / 2, 0, -bw / 2], [bl / 2, 0, bw / 2], [-bl / 2, 0, bw / 2]], P = [];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; P.push(...B[i], ...B[j], ...T[j], ...B[i], ...T[j], ...T[i]); }
  if (o.floor !== false) P.push(...B[0], ...B[2], ...B[1], ...B[0], ...B[3], ...B[2]);
  if (o.lid) P.push(...T[0], ...T[1], ...T[2], ...T[0], ...T[2], ...T[3]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  // metric UVs: each face projected on its two widest axes
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2), u = o.unit ?? 1;
  for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [a, b] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)]; uv[i * 2] = a / u; uv[i * 2 + 1] = b / u; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}

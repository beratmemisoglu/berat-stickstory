// module.any.cloth-drape v1 - procedural cloth without a simulation: a blanket laid on a mattress that falls over its front
// edge in accordion folds with a ragged hem, and a crumpled heap. From the prison-tunnel bunk (critic: 'bedding').
// Contract: THREE from the project's engine.js; noise from module.any.relief (copied next to this module).
import { THREE } from '../../engine.js';
import { fbm, lumpyBox } from '../module.any.relief/index.js';
export { lumpyBox };   // mattresses and pillows: lumpyBox(w, h, d, seed, amp, sag)

// drape(w, d, hd, seed, folds, drop): a cloth w (x) by d (z) laid from the back edge of a mattress of half depth hd.
// Local origin = the mattress top centre. On the mattress: a bunched heap (soft front-back ridges) + fine wrinkles; past
// the front edge (z > hd) it hangs: accordion folds along x, a hem whose length varies with x (drop = the longest fall).
// Use a DoubleSide material. It is a thin open surface: mark it noContact (userData) and keep it out of S.collide solids.
export function drape(w, d, hd, seed = 3, folds = .4, drop = .5) {
  const g = new THREE.PlaneGeometry(w, d, Math.round(w * 50), Math.round(d * 50)); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z0 = p.getZ(i) + (d / 2 - hd), u = x / (w / 2);
    const heap = Math.max(0, fbm(x * 2 + seed, z0 * 1.3, seed) - .38) * folds * (1 - u * u * .6), ridge = Math.abs(Math.sin(x * 11 + fbm(x, z0 * 3, seed) * 6)) * .025, wr = (fbm(x * 9 + seed, z0 * 9, seed + 4) - .5) * .025;
    const len = drop * (.55 + .45 * fbm(x * 2.5 + seed, 3, seed + 11)), over = z0 - hd;
    let y = heap + ridge * (heap > .02 ? 1 : .4) + wr + .015, z = z0;
    if (over > 0) { const o = Math.min(over, len); z = hd + .06 + (Math.sin(x * 13 + seed) * .045 + (fbm(x * 5, o * 5, seed + 21) - .5) * .16) * Math.min(1, o * 6) + Math.max(0, over - len) * .25; y = Math.min(y, .02) * (1 - Math.min(1, o * 8)) - o - Math.max(0, over - len) * .1; }
    p.setXYZ(i, x + (fbm(z0 * 3, x * 3, seed + 7) - .5) * .06, y, z); }
  g.computeVertexNormals(); return g;
}

// heap(sx, sy, sz, seed): a crumpled cloth heap (a flattened noisy blob with fold ridges), bottom flattened at y = -.05 sy
export function heap(sx, sy, sz, seed = 5) {
  const g = new THREE.IcosahedronGeometry(1, 5), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)); const n = fbm(v.x * 2.5 + seed, v.z * 2.5 + v.y * 2, seed) - .5, fold = Math.abs(Math.sin(v.x * 7 + v.z * 3 + seed)) * .12;
    v.multiplyScalar(1 + n * .7 + fold); v.y = Math.max(-.05, v.y); p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz); }
  g.computeVertexNormals(); return g;
}

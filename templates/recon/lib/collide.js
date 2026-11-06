// Interpenetration check (HARD RULE 13): bodies are approximated by capsules (segment + radius) built from their joints.
// - body vs body: two capsules of different bodies closer than ra + rb - tol
// - body vs solid: points sampled through each capsule's volume that lie INSIDE a closed solid mesh (ray parity test)
// A shot opts in with S.collide = { bodies: () => [{ name, caps }], solids: [Object3D...] }; render.mjs collide <t0> <t1> <step>
// reports every frame with a violation. Capsule lists: personCaps(person) for our rig, actorCaps(actor) for rigged glTF people.
import * as THREE from '../vendor/three.module.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// our rig: [from joint, to joint, radius] (radii from PARTS, a little inside the visible surface)
const RIG = [['hips', 'neck', .13], ['head', 'head+', .095], ['shL', 'elL', .045], ['elL', 'wrL', .038], ['wrL', 'fiL', .035], ['shR', 'elR', .045], ['elR', 'wrR', .038],
  ['wrR', 'fiR', .035], ['hipL', 'knL', .06], ['knL', 'anL', .045], ['hipR', 'knR', .06], ['knR', 'anR', .045]];
export function personCaps(p) {
  const s = p.scale ?? 1, pos = n => n === 'head+' ? p.scenePos('head').add(p.scenePos('head').sub(p.scenePos('neck')).normalize().multiplyScalar(.12 * s)) : p.scenePos(n);
  return RIG.map(([a, b, r]) => ({ a: pos(a), b: pos(b), r: r * s, part: a }));
}
// Quaternius / Unreal-style skeleton
const UAL = [['pelvis', 'neck_01', .13], ['Head', 'Head+', .095], ['upperarm_l', 'lowerarm_l', .045], ['lowerarm_l', 'hand_l', .038], ['upperarm_r', 'lowerarm_r', .045],
  ['lowerarm_r', 'hand_r', .038], ['thigh_l', 'calf_l', .06], ['calf_l', 'foot_l', .045], ['thigh_r', 'calf_r', .06], ['calf_r', 'foot_r', .045]];
export function actorCaps(a) {
  const s = (a.height ?? 1.8) / 1.8, w = n => a.bone(n).getWorldPosition(V());
  const pos = n => n === 'Head+' ? w('Head').add(w('Head').sub(w('neck_01')).normalize().multiplyScalar(.14 * s)) : w(n);
  return UAL.map(([x, y, r]) => ({ a: pos(x), b: pos(y), r: r * s, part: x }));
}
// shortest distance between segments p1-q1 and p2-q2
export function segDist(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t; if (a < 1e-9 && e < 1e-9) return p1.distanceTo(p2);
  if (a < 1e-9) { s = 0; t = THREE.MathUtils.clamp(f / e, 0, 1); }
  else { const c = d1.dot(r); if (e < 1e-9) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
    else { const b = d1.dot(d2), den = a * e - b * b; s = den > 1e-9 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0; t = (b * s + f) / e;
      if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); } } }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
}
// inside a closed mesh: odd number of surface crossings along a ray (both faces counted)
const rc = new THREE.Raycaster(), DIR = V(.5774, .5771, .5776).normalize();
function inside(pt, solid) {
  rc.set(pt, DIR); rc.far = 1e4; const hits = rc.intersectObject(solid, true); let n = 0, last = -1;
  for (const h of hits) { if (h.distance - last > 1e-5) n++; last = h.distance; } return n % 2 === 1;
}
export function check(spec, o = {}) {
  const tol = o.tol ?? .01, out = [], bodies = spec.bodies(), solids = spec.solids || [];
  // body vs body
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++)
    for (const A of bodies[i].caps) for (const B of bodies[j].caps) { const d = segDist(A.a, A.b, B.a, B.b), lim = A.r + B.r - tol;
      if (d < lim) out.push(`${bodies[i].name}.${A.part} x ${bodies[j].name}.${B.part} ${((lim - d) * 100).toFixed(1)} cm`); }
  // body vs solid (double-sided raycast for the parity count, restored after)
  const mats = new Map(); for (const s of solids) s.traverse(m => { if (m.isMesh) for (const mt of [].concat(m.material)) if (!mats.has(mt)) { mats.set(mt, mt.side); mt.side = THREE.DoubleSide; } });
  for (const B of bodies) for (const c of B.caps) for (const s of solids) {
    let hit = 0; const ax = c.b.clone().sub(c.a), L = ax.length(), n = L > 1e-6 ? ax.clone().divideScalar(L) : V(0, 1, 0);
    const u = Math.abs(n.y) < .9 ? V(0, 1, 0).cross(n).normalize() : V(1, 0, 0).cross(n).normalize(), v = n.clone().cross(u), rr = Math.max(0, c.r - tol);
    for (let k = 0; k <= 4 && !hit; k++) { const p = c.a.clone().addScaledVector(ax, k / 4);
      for (const off of [V(), u.clone().multiplyScalar(rr), u.clone().multiplyScalar(-rr), v.clone().multiplyScalar(rr), v.clone().multiplyScalar(-rr)]) if (inside(p.clone().add(off), s)) { hit = 1; break; } }
    if (hit) out.push(`${B.name}.${c.part} inside ${s.name || s.type}`);
  }
  for (const [mt, side] of mats) mt.side = side;
  return out;
}

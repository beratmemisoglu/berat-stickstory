// module.recon.rig-pose v1 - pose helpers for the recon kit's figures (lib/figures.js: the human rig and the mannequins share
// one skeleton: pelvis, spine_01..03, neck_01, Head, thigh_/calf_/foot_ l|r, upperarm_/lowerarm_/hand_ l|r).
// All of them run AFTER the clip in the same tick: f.act(...) / f.play(...).apply() first, then these, then f.handTo().
// Contract: THREE from the project's engine.js; works on any figure() / who() result (f.group, f.caps(), f.scenePos()).
import { THREE } from '../../engine.js';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// boneOf(f, name): the first bone of that name in the figure (null when the rig has none)
export const boneOf = (f, name) => { let b = null; f.group.traverse(o => { if (!b && o.isBone && o.name === name) b = o; }); return b; };
// bodyOf(f, name): the S.collide body of a figure: { name, caps } (caps = the clothed body's capsules)
export const bodyOf = (f, name) => ({ name: name ?? f.name, caps: f.caps() });

// rotW(bone, q): a WORLD-space rotation q applied to a bone (children follow): L' = P^-1 q P L
export function rotW(b, q) { const P = new THREE.Quaternion(); b.parent.getWorldQuaternion(P); const Pi = P.clone().invert(); b.quaternion.premultiply(Pi.multiply(q).multiply(P)); b.updateMatrixWorld(true); }
// aim(bone, from, to): turn a bone so its world direction `from` points along `to`
export const aim = (b, from, to) => rotW(b, new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize()));
// turn(f, bone, axis, a): turn one bone about a WORLD axis by a radians (spine twists for prone / kneeling poses)
export function turn(f, name, axis, a) { const b = boneOf(f, name); if (!b || !a) return;
  const pq = new THREE.Quaternion(); b.parent.getWorldQuaternion(pq); b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize().applyQuaternion(pq.invert()), a)); b.updateMatrixWorld(true); }

// the figure's own sideways axis in world space (bending about it tips the body forward)
function sideAxis(f) { f.group.updateWorldMatrix(true, true); const fq = new THREE.Quaternion(); f.group.getWorldQuaternion(fq); return V(0, 1, 0).cross(V(0, 0, 1).applyQuaternion(fq)).normalize(); }
function bend(f, name, axisW, k) { const b = boneOf(f, name); if (!b || !k) return; const pq = new THREE.Quaternion(); b.parent.getWorldQuaternion(pq);
  b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axisW.clone().applyQuaternion(pq.invert()), k)); b.updateMatrixWorld(true); }

// lean(f, a, head): bend the spine forward by a radians (split over spine_01..03) and the neck by head.
// A spine curve, i.e. a HUNCH. For a bend at the hips use hinge() first (solution.any.hip-hinge-not-lean).
export function lean(f, a, head = 0) { const ax = sideAxis(f); for (const [n, k] of [['spine_01', a / 3], ['spine_02', a / 3], ['spine_03', a / 3], ['neck_01', head]]) bend(f, n, ax, k); }
// hinge(f, a): a hip hinge - the pelvis tips forward by a and both thighs turn back by a, so the legs stay where the clip
// put them while the trunk bends over (diggers, a man pushing a cart). Then a little lean() on top.
export function hinge(f, a) { if (!a) return; const ax = sideAxis(f); bend(f, 'pelvis', ax, a); bend(f, 'thigh_l', ax, -a); bend(f, 'thigh_r', ax, -a); }
// tilt(f, a, back = .25): tip the WHOLE body forward by a (radians) about a point near the rear foot (call once in build,
// after the figure is placed): the straight heel-to-head diagonal of a man shoving something heavy, which no spine
// bend gives. back = how far behind the origin the pivot is (m per radian of tilt).
export function tilt(f, a, back = .25) { if (!a) return; const g = f.group; g.rotateX(a); g.position.addScaledVector(V(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y)), -back * a); }

// footTo(f, side, target, pole): two-bone IK for a leg (the kit has handTo but no foot IK): the foot bone's origin goes to
// target (world), the knee bends towards pole (world). Returns the MISS distance in metres: when the target is out of
// reach the leg straightens silently ("dancer kick"), so check it: misses > .03 m mean move the target or the body.
export function footTo(f, side, T, pole) {
  const s = side === 'L' || side === 'l' ? 'l' : 'r', th = boneOf(f, 'thigh_' + s), ca = boneOf(f, 'calf_' + s), fo = boneOf(f, 'foot_' + s); if (!th || !ca || !fo) return Infinity;
  f.group.updateMatrixWorld(true);
  const w = b => b.getWorldPosition(V()), H = w(th), Kp = w(ca), F = w(fo), a = Kp.distanceTo(H), b2 = F.distanceTo(Kp);
  const D = T.clone().sub(H), d = Math.min(a + b2 - 1e-3, Math.max(Math.abs(a - b2) + 1e-3, D.length())), dir = D.normalize();
  const cosA = (a * a + d * d - b2 * b2) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const n = pole.clone().sub(H); n.addScaledVector(dir, -n.dot(dir)).normalize();
  const K = H.clone().addScaledVector(dir, a * cosA).addScaledVector(n, a * sinA);
  aim(th, Kp.clone().sub(H), K.clone().sub(H)); const K2 = w(ca), F2 = w(fo); aim(ca, F2.clone().sub(K2), H.clone().addScaledVector(dir, d).sub(K2));
  return w(fo).distanceTo(T);
}

// boneLog(S, figs, names, o): print bone positions (BONE <figure> <bone> x y z) ONCE per render, only when the URL has
// ?bones=1, never during check runs (a tick logger runs for every CHECK frame: hundreds of lines).
export function boneLog(S, figs, names = ['pelvis', 'Head', 'hand_l', 'hand_r', 'foot_l', 'foot_r'], o = {}) {
  const q = new URLSearchParams(location.search); if (!q.get('bones')) return; let done = false;
  S.tick(() => { if (done) return; done = true; for (const f of figs) console.log('BONE ' + f.name + ' ' + names.map(b => { const p = (o.local ? o.local.worldToLocal(f.scenePos(b).clone()) : f.scenePos(b)); return `${b} ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`; }).join(' | ')); });
}
// lowestPoint(f, bones): the lowest of the given bones in world y (for a "support" check: is anything on the floor?)
export function lowestPoint(f, bones = ['foot_l', 'foot_r', 'calf_l', 'calf_r', 'hand_l', 'hand_r', 'pelvis']) {
  let lo = null; for (const b of bones) { const p = f.scenePos(b); if (p && (!lo || p.y < lo.y)) lo = p.clone(); } return lo;
}

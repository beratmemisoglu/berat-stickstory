// HANDS AND HOLDING (3D reconstruction, engine v17+, lib/hands.js): every object a person holds goes through hold().
// The prop rides the hand bone with an offset computed ONCE from the VISIBLE palm and the prop's grip frame (no drift, no
// pop), the fingers close on the object until they touch it (never through it), a use pose (phone at the ear, papers
// read, a box carried) and the second hand of two-hand grips are placed by IK after the clip every frame, and the HOLD
// check (check_layout) measures the real meshes. Docs, SOP and the VERIFIED table: the skill's references/hands.md.
//   import { hold, holdIssues, POSES, USES, VERIFIED } from '../lib/hands.js';
//   hold(f, prop('smartphone'), 'ear')                        // the phone to the right ear (the grip names its use)
//   hold(f, prop('mug'), 'wrap', { side: 'L' })               // any grip with hand 'any' works in either hand (mirrored)
//   const m = place(S, prop('mug'), { on: desk }); hold(f, m, 'wrap', { t0: 3, t1: 7 })   // picked up at 3, put back at 7
// Rules: never parent a prop to a bone by hand, never f.hold(), never place an object near a hand: hold() it. Only the
// VERIFIED kind x grip x body x hand x clip combos are signed off (holdIssues warns on the rest).
import * as ENG from '../engine.js';
const { THREE } = ENG;

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smoother = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10);
const asV = a => a == null ? null : a.isVector3 ? a.clone() : V3(a[0], a[1], a[2]);
const sideOf = s => /^l/i.test(String(s ?? 'R')) ? 'l' : 'r';
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

// =====================================================================================================================
// HAND POSES: per finger the flexion of its three joints (radians, 0 = the straight bind finger), the thumb's opposition
// (across the palm) and spread. contact: the fingers that must end touching the object (they close from open toward the
// pose and STOP at the surface: never through it, never more than 3 mm of air).
// =====================================================================================================================
const F4 = (a, b, c) => ({ index: a, middle: a, ring: b ?? a, pinky: c ?? b ?? a });
export const POSES = {
  relaxed: { f: F4([.22, .32, .22], [.28, .38, .25], [.34, .42, .28]), thumb: { opp: 0, flex: [.05, .15, .15] }, contact: [] },
  fist:    { f: F4([1.45, 1.65, 1.1]), thumb: { opp: .95, flex: [.25, .55, .6] }, contact: [] },
  wrap:    { f: F4([1.65, 1.8, 1.35]), thumb: { opp: 1.6, flex: [.3, 1.1, 1.0] }, contact: ['index', 'middle', 'ring', 'pinky', 'thumb'], palm: true },
  grip:    { f: F4([1.65, 1.8, 1.35]), thumb: { opp: .2, spread: .2, flex: [0, .2, .2] }, contact: ['index', 'middle', 'ring', 'pinky'], palm: true },   // wrap, the thumb along the object
  pinch:   { f: { index: [.6, .95, .7], middle: [.9, 1.25, .8], ring: [1.15, 1.35, .9], pinky: [1.25, 1.4, .9] }, thumb: { opp: .6, flex: [.15, .5, .6] }, contact: ['index', 'thumb'], palm: false },
  phone:   { f: F4([.9, 1.4, 1.0]), thumb: { opp: 1.7, spread: .25, flex: [.2, .7, .7] }, contact: ['index', 'middle', 'ring', 'thumb'], palm: true },
  hook:    { f: F4([.5, 1.7, 1.2]), from: .4, thumb: { opp: .9, flex: [.2, .55, .5] }, contact: ['index', 'middle', 'ring'], palm: false },   // bag handles: the bar across the middle phalanges, the fingers under and round it (closes from 40 %: see closeFinger)
  flat:    { f: F4([.45, .3, .2]), thumb: { opp: .5, spread: .3, flex: [0, .2, .2] }, contact: ['index', 'middle', 'ring'], palm: true },   // fingers lie on the surface (close until they touch)
  edge:    { f: F4([.55, .45, .35]), thumb: { opp: 1.7, spread: .1, flex: [.2, .6, .6] }, contact: ['index', 'middle', 'thumb'], palm: false },   // a sheet's / board's edge: fingers behind, thumb on the front
  point:   { f: { index: [0, .02, .02], middle: [1.45, 1.65, 1.1], ring: [1.45, 1.65, 1.1], pinky: [1.45, 1.65, 1.1] }, thumb: { opp: .95, flex: [.25, .6, .5] }, contact: [] },
};

// =====================================================================================================================
// THE RIG: the visible hand (palm frame, finger chains, flexion axes, phalanx radii) measured ONCE per figure from the
// visible skinned mesh in each hand bone's local space (rigid to the bone, so every number is pose independent)
// =====================================================================================================================
const RIGS = new WeakMap();
function visibleSkins(f) {
  const out = [], bi = f.bodyInfo?.();
  if (Array.isArray(bi?.meshes)) for (const m of bi.meshes) if (m?.isSkinnedMesh && m.layers.isEnabled(0) && !/outline/i.test(m.name)) out.push(m);
  if (!out.length && Array.isArray(f.mannequin)) for (const m of f.mannequin) if (m.isSkinnedMesh && !/outline/i.test(m.name)) out.push(m);
  if (!out.length) f.group.traverse(o => { if (o.isSkinnedMesh && o.visible !== false && o.layers.isEnabled(0) && !o.userData.acc && !o.userData.noContact && o.skeleton?.bones.some(b => /^hand_[lr]$/.test(b.name))) out.push(o); });
  return out;
}
const decomposeRT = m => { const p = V3(), q = new THREE.Quaternion(), s = V3(); m.decompose(p, q, s); return { p, q, s }; };
function rigOf(f) {
  let R = RIGS.get(f); if (R) return R;
  f.group.updateMatrixWorld(true);
  const skins = visibleSkins(f); if (!skins.length) throw new Error(`hands: ${f.name}: no visible skinned body (rig "${f.rig}")`);
  const sk = skins[0].skeleton, byName = new Map(sk.bones.map((b, i) => [b.name, i]));
  const bindW = name => { const i = byName.get(name); return i == null ? null : new THREE.Matrix4().copy(sk.boneInverses[i]).invert(); };
  R = { f, skins, sk, byName, bindW, sides: {} };
  // the figure's bind space: up and forward (checked, not assumed: the head above the pelvis, the toes ahead of the ankle)
  const P = n => V3().setFromMatrixPosition(bindW(n));
  R.up = P('Head').sub(P('pelvis')).normalize(); R.fwd = P('ball_l').sub(P('foot_l')).projectOnPlane(R.up).normalize();
  R.right = V3().crossVectors(R.fwd, R.up).normalize();   // facing +Z with +Y up: the right is -X
  for (const s of ['l', 'r']) R.sides[s] = handData(R, s);
  RIGS.set(f, R); return R;
}
function vertsOf(R, test) {   // the visible vertices whose strongest bone passes test(name): bind-space positions + weights
  const out = [];
  for (const m of R.skins) { const g = m.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = m.skeleton.bones;
    for (let i = 0; i < pos.count; i++) { let best = -1, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      const nm = bones[best]?.name || ''; if (!test(nm)) continue;
      const v = V3().fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix), ws = [];
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > 1e-3) ws.push([bones[si.getComponent(i, k)]?.name || '', w]); }
      out.push({ v, bone: nm, ws, mesh: m, i }); } }
  return out;
}
function handData(R, s) {
  const f = R.f, hand = f.bone('hand_' + s), up = f.bone('upperarm_' + s), lo = f.bone('lowerarm_' + s);
  const Hb = R.bindW('hand_' + s), Hi = Hb.clone().invert();
  const u = V3().setFromMatrixColumn(hand.matrixWorld, 0).length();              // metres per hand-bone unit
  const relM = name => { const W = R.bindW(name); if (!W) return null; const m = Hi.clone().multiply(W); m.elements[12] *= u; m.elements[13] *= u; m.elements[14] *= u; return m; };   // hand-metric bind matrix
  const pos = name => { const m = relM(name); return m ? V3().setFromMatrixPosition(m) : null; };
  // the palm frame: F = wrist -> middle knuckle, side = pinky -> index knuckle, N = out of the palm (palms face down in the bind T-pose)
  const mid = pos('middle_01_' + s), idx = pos('index_01_' + s), pk = pos('pinky_01_' + s), F = mid.clone().normalize();
  let N = V3().crossVectors(F, idx.clone().sub(pk)).normalize();
  if (N.clone().transformDirection(Hb).dot(R.up) > 0) N.negate();
  // the figure's own visible palm (figures.js f.palm, v17): its normal + forward ARE the frame's axes (its centre is the
  // centroid of every hand vertex, the wrist ball included, so the grip point below stays the central palm)
  const fp = f.palm?.(s.toUpperCase()); if (fp?.normal && fp?.forward) { const hq = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
    const Nf = fp.normal.clone().applyQuaternion(hq).normalize(), Ff = fp.forward.clone().applyQuaternion(hq).normalize(); if (Nf.dot(N) > .9 && Ff.dot(F) > .9) { N = Nf; F.copy(Ff); } }
  const X = V3().crossVectors(F, N).normalize(); N.crossVectors(X, F).normalize();   // x = F x N: the right hand's thumb side
  // vertices: the hand + finger bones (bind-space -> hand-metric)
  const re = new RegExp(`^(hand|thumb|index|middle|ring|pinky)(_0[1-4](_leaf)?)?_${s}$`);
  const verts = vertsOf(R, n => re.test(n)).map(o => ({ ...o, h: o.v.clone().applyMatrix4(Hi).multiplyScalar(u) }));
  const L = mid.length(), xc = idx.clone().add(pk).multiplyScalar(.5).dot(X);
  // the palm surface: palm vertices between 35 and 80 % of the way to the knuckles, near the palm's mid line, on the N side
  const palmV = verts.filter(o => o.bone === 'hand_' + s), cand = palmV.filter(o => { const a = o.h.dot(F) / L, b = o.h.dot(X) - xc; return a > .35 && a < .8 && Math.abs(b) < .018 && o.h.dot(N) > 0; });
  const ns = cand.map(o => o.h.dot(N)).sort((a, b) => a - b), nSurf = ns.length ? ns[Math.floor(ns.length * .9)] : .012;
  const palmP = X.clone().multiplyScalar(xc).addScaledVector(F, .58 * L).addScaledVector(N, nSurf);
  const palm = new THREE.Matrix4().makeBasis(X, F, N).setPosition(palmP);
  // finger chains: bind matrices (hand-metric), flexion axes in each bone's own frame, phalanx tips + radii from the mesh
  const chains = {};
  for (const fn of FINGERS) {
    const names = [1, 2, 3].map(k => `${fn}_0${k}_${s}`); if (names.some(n => !f.bone(n))) continue;
    const bones = names.map(n => f.bone(n)), Mb = names.map(relM), loc = [];
    for (let k = 0; k < 3; k++) { const parent = k ? Mb[k - 1] : new THREE.Matrix4(); loc.push(decomposeRT(parent.clone().invert().multiply(Mb[k]))); }
    // the tip: the leaf bone, else the farthest vertex of the last phalanx along it
    const J = Mb.map(m => V3().setFromMatrixPosition(m)), dir3 = J[2].clone().sub(J[1]).normalize(), leaf = `${fn}_04_leaf_${s}`;
    for (const o of verts) if (o.bone === leaf) o.bone = names[2];   // (the female body skins its fingertips to the leaf bones)
    let tip = pos(leaf); const v3 = verts.filter(o => o.bone === names[2]);
    if (v3.length) { let far = 0; for (const o of v3) far = Math.max(far, o.h.clone().sub(J[2]).dot(dir3)); tip = J[2].clone().addScaledVector(dir3, far); }
    if (!tip) tip = J[2].clone().addScaledVector(dir3, J[2].distanceTo(J[1]) * .8);
    const seg = [[J[0], J[1]], [J[1], J[2]], [J[2], tip]];
    const rad = [0, 1, 2].map(k => { const vs = verts.filter(o => o.bone === names[k]).map(o => segDistPt(o.h, seg[k][0], seg[k][1])).sort((a, b) => a - b); return vs.length ? vs[Math.floor(vs.length * .9)] : .008; });
    const tipLocal = tip.clone().applyMatrix4(Mb[2].clone().invert());
    // flexion axis per joint: rotating the finger about (bone dir x N) moves it toward the palm side
    const axes = [0, 1, 2].map(k => { const d = seg[k][1].clone().sub(seg[k][0]).normalize(); let a = V3().crossVectors(d, N).normalize(); if (fn === 'thumb') a = V3().crossVectors(d, X.clone().multiplyScalar(s === 'r' ? -1 : 1)).normalize();
      return a.applyQuaternion(decomposeRT(Mb[k]).q.invert()); });
    const samp = [0, 1, 2].map(k => { const vs = verts.filter(o => o.bone === names[k]), n = fn === 'thumb' && k === 0 ? 1 : Math.max(1, Math.floor(vs.length / 120)); return vs.filter((_, i) => i % n === 0); });   // (the thumb's base: every vertex - its thenar is big)
    const ch = { fn, names, bones, Mb, MbInv: Mb.map(m => m.clone().invert()), loc, axes, tipLocal, rad, samp, opp: null };
    if (fn === 'thumb') ch.opp = F.clone().applyQuaternion(decomposeRT(Mb[0]).q.invert());   // opposition: about the palm's long axis
    // signs: a positive angle must move the tip toward the palm side (N)
    for (let k = 0; k < 3; k++) { const z = fk(ch, [0, 0, 0], 0), a = [0, 0, 0]; a[k] = .2; const t1 = fk(ch, a, 0); if (t1.tip.dot(N) < z.tip.dot(N) - 1e-6) ch.axes[k].negate(); }
    if (ch.opp) { const z = fk(ch, [0, 0, 0], 0), t1 = fk(ch, [0, 0, 0], .3); if (t1.tip.dot(N) < z.tip.dot(N) - 1e-6) ch.opp.negate();
      ch.spr = N.clone().applyQuaternion(decomposeRT(Mb[0]).q.invert()); const t2 = fk(ch, [0, 0, 0], 0, .3); if (t2.tip.distanceTo(idx) < z.tip.distanceTo(idx)) ch.spr.negate(); }
    chains[fn] = ch;
  }
  // vertex skin data for exact FK verification: each vertex as (bone weights) in hand-metric bind space
  const boneIdx = {}; for (const fn in chains) { chains[fn].names.forEach((n, k) => (boneIdx[n] = [fn, k])); boneIdx[`${fn}_04_leaf_${s}`] = [fn, 2]; }
  for (const o of verts) o.fw = o.ws.map(([n, w]) => [boneIdx[n] ?? null, w]);
  for (const fn in chains) chains[fn].samp = chains[fn].samp.map((list, k) => list.map(o => { const ws = o.fw.map(([b, w]) => [b && b[0] === fn ? b[1] : -1, w]), t = ws.reduce((a, x) => a + x[1], 0) || 1; return { h: o.h, k, w: ws.map(([j, w]) => [j, w / t]) }; }));
  return { s, hand, up, lo, u, Hb, palm, palmInv: palm.clone().invert(), F, N, X, L, chains, verts, palmV, boneIdx };
}
// finger forward kinematics in hand-metric space: angles [a1, a2, a3] (+ thumb opposition) -> joint matrices + tip
const _rq = new THREE.Quaternion();
function fk(ch, ang, opp = 0, spread = 0) {
  const M = []; let prev = new THREE.Matrix4();
  for (let k = 0; k < 3; k++) { const l = ch.loc[k], q = l.q.clone(); if (k === 0 && ch.opp && opp) q.multiply(_rq.setFromAxisAngle(ch.opp, opp)); if (k === 0 && ch.spr && spread) q.multiply(_rq.setFromAxisAngle(ch.spr, spread));
    q.multiply(_rq.setFromAxisAngle(ch.axes[k], ang[k] || 0)); const m = new THREE.Matrix4().compose(l.p, q, V3(1, 1, 1)); prev = prev.clone().multiply(m); M.push(prev); }
  const J = M.map(m => V3().setFromMatrixPosition(m)), tip = ch.tipLocal.clone().applyMatrix4(M[2]);
  return { M, J, tip, seg: [[J[0], J[1]], [J[1], J[2]], [J[2], tip]] };
}
function segDistPt(p, a, b) { const ab = b.clone().sub(a), t = clamp(p.clone().sub(a).dot(ab) / Math.max(1e-12, ab.lengthSq())); return a.clone().addScaledVector(ab, t).distanceTo(p); }

// =====================================================================================================================
// PROP GEOMETRY in a frame (triangles per part, closed parts for the inside test) + point queries
// =====================================================================================================================
function propTris(prop, toFrame) {   // toFrame: Matrix4 prop-local (metres) -> frame
  prop.updateMatrixWorld(true); const inv = prop.matrixWorld.clone().invert(), parts = [];
  prop.traverse(m => { if (!m.isMesh || !m.geometry?.attributes?.position || m.userData.noHold) return; if (m.material && [].concat(m.material).every(x => x.visible === false)) return;
    const g = m.geometry, pa = g.attributes.position, ix = g.index, M = toFrame.clone().multiply(inv.clone().multiply(m.matrixWorld)), n = ix ? ix.count : pa.count;
    const tri = new Float32Array(n * 3), v = V3();
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pa, ix ? ix.getX(i) : i).applyMatrix4(M); tri[i * 3] = v.x; tri[i * 3 + 1] = v.y; tri[i * 3 + 2] = v.z; }
    const box = new THREE.Box3(); for (let i = 0; i < n; i++) box.expandByPoint(v.set(tri[i * 3], tri[i * 3 + 1], tri[i * 3 + 2]));
    const closed = !/Plane|Tube|Shape|Ring|Circle/.test(g.type) && !m.userData.open;
    parts.push({ tri, n: n / 3, box, closed, name: m.name }); });
  return parts;
}
// closest distance from p to the triangles (Ericson's closest point on a triangle)
const _a = V3(), _b = V3(), _c = V3(), _ab = V3(), _ac = V3(), _ap = V3(), _bp = V3(), _cp = V3(), _r = V3();
function triDist2(p, T, o) {
  _a.set(T[o], T[o + 1], T[o + 2]); _b.set(T[o + 3], T[o + 4], T[o + 5]); _c.set(T[o + 6], T[o + 7], T[o + 8]);
  _ab.subVectors(_b, _a); _ac.subVectors(_c, _a); _ap.subVectors(p, _a);
  const d1 = _ab.dot(_ap), d2 = _ac.dot(_ap); if (d1 <= 0 && d2 <= 0) return p.distanceToSquared(_a);
  _bp.subVectors(p, _b); const d3 = _ab.dot(_bp), d4 = _ac.dot(_bp); if (d3 >= 0 && d4 <= d3) return p.distanceToSquared(_b);
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return p.distanceToSquared(_r.copy(_a).addScaledVector(_ab, v)); }
  _cp.subVectors(p, _c); const d5 = _ab.dot(_cp), d6 = _ac.dot(_cp); if (d6 >= 0 && d5 <= d6) return p.distanceToSquared(_c);
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return p.distanceToSquared(_r.copy(_a).addScaledVector(_ac, w)); }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return p.distanceToSquared(_r.copy(_b).addScaledVector(_c.clone().sub(_b), w)); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; return p.distanceToSquared(_r.copy(_a).addScaledVector(_ab, v).addScaledVector(_ac, w));
}
function surfDist(parts, p, cap = 1) {   // unsigned distance to the nearest surface (cap: early-out bound)
  let best = cap * cap;
  for (const P of parts) { if (P.box.distanceToPoint(p) ** 2 > best) continue; const T = P.tri; for (let o = 0; o < T.length; o += 9) { const d = triDist2(p, T, o); if (d < best) best = d; } }
  return Math.sqrt(best);
}
const RAYD = V3(.5774, .5771, .5776).normalize(), _e1 = V3(), _e2 = V3(), _h = V3(), _s = V3(), _q = V3();
function insidePart(P, p) {   // ray parity against one closed part
  if (!P.closed || !P.box.containsPoint(p)) return false; const T = P.tri; let n = 0;
  for (let o = 0; o < T.length; o += 9) { _a.set(T[o], T[o + 1], T[o + 2]); _e1.set(T[o + 3] - T[o], T[o + 4] - T[o + 1], T[o + 5] - T[o + 2]); _e2.set(T[o + 6] - T[o], T[o + 7] - T[o + 1], T[o + 8] - T[o + 2]);
    _h.crossVectors(RAYD, _e2); const a = _e1.dot(_h); if (Math.abs(a) < 1e-12) continue; const fI = 1 / a; _s.subVectors(p, _a); const uu = fI * _s.dot(_h); if (uu < 0 || uu > 1) continue;
    _q.crossVectors(_s, _e1); const vv = fI * RAYD.dot(_q); if (vv < 0 || uu + vv > 1) continue; if (fI * _e2.dot(_q) > 1e-7) n++; }
  return n % 2 === 1;
}
// signed: < 0 = inside the prop by that depth
function signedDist(parts, p, cap = 1) { const d = surfDist(parts, p, cap); for (const P of parts) if (insidePart(P, p)) return -d; return d; }

// =====================================================================================================================
// GRIPS: userData.prop.grips (props.js) -> frames. A grip: { hand 'R'|'L'|'any', pos, fingers (F), palm (N: from the palm
// into the object), pose, use, mirror ('x'|'y'|'z': the plane the other hand's grip is mirrored across), second?: { ... } }
// =====================================================================================================================
const AX = { x: 0, y: 1, z: 2 };
function gripFrame(g, mirror) {
  let p = asV(g.pos), F = asV(g.fingers).normalize(), N = asV(g.palm);
  if (mirror) { const k = AX[mirror] ?? 0; for (const v of [p, F, N]) v.setComponent(k, -v.getComponent(k)); }
  N.addScaledVector(F, -N.dot(F)).normalize(); const X = V3().crossVectors(F, N).normalize();
  return new THREE.Matrix4().makeBasis(X, F, N).setPosition(p);
}
export function gripsOf(prop) { return prop?.userData?.prop?.grips ?? {}; }
function resolveGrip(prop, grip, side) {
  const all = gripsOf(prop), kind = prop.userData?.prop?.kind ?? prop.name;
  let name = grip, g = typeof grip === 'object' ? grip : all[grip];
  if (!g && grip == null) { name = Object.keys(all)[0]; g = all[name]; }
  if (!g) throw new Error(`hold: "${kind}" has no grip "${grip}". Its grips: ${Object.keys(all).join(', ') || 'none (add grips: references/hands.md)'}`);
  const want = g.hand ?? 'any', s = side ?? (want === 'L' ? 'l' : 'r');
  const mir = want !== 'any' && sideOf(want) !== s ? (g.mirror ?? 'x') : (want === 'any' && s === 'l' ? (g.mirror ?? 'x') : null);
  return { name, g, side: s, mirror: mir, kind };
}

// =====================================================================================================================
// USES: where the held prop goes relative to the body (IK after the clip): pos = where its grip point (two-hand grips: the
// middle of the two) goes, y / z = the prop's own axes, all in the anchor's frame (s = toward the holding hand's side, u =
// up, f = the figure's forward; metres on the 1.8 m body, scaled with the figure's height). head = the head bone; chest /
// pelvis = that bone's position + the figure's facing. anchor 'clip' = the hand stays where the clip puts it (the prop
// rides it); 'scene' = the prop stays put, hands go to it. clear: keep-out direction; lift: carries rise over a thigh.
// =====================================================================================================================
export const USES = {
  clip:   { anchor: 'clip', note: 'the clip moves the hand, the prop rides it (carried at the side, a bag, a closed book)' },
  hang:   { anchor: 'clip', hang: true, note: 'clip hand, the prop hangs straight down from the grip (bags, a cane, a briefcase)' },
  look:   { anchor: 'chest', pos: [.07, .01, .3], y: [-.12, .62, -.78], z: [0, -.78, -.62], clear: 'f', note: 'one hand, the face (+Y) toward the eyes: a phone or tablet looked at' },
  film:   { anchor: 'chest', pos: [.06, .17, .34], y: [0, .12, -1], z: [0, -1, -.12], clear: 'f', note: 'held up at eye level filming: screen to the eyes' },
  ear:    { anchor: 'head', ear: true, note: 'the phone / handset against the cheek, top at the ear' },
  read:   { anchor: 'chest', pos: [0, -.02, .34], y: [0, .62, -.78], z: [0, -.78, -.62], clear: 'f', centre: true, note: 'two hands, read: papers, an open book, a newspaper, a tablet' },
  hold:   { anchor: 'chest', pos: [.12, -.14, .3], y: [0, 1, 0], z: [0, 0, 1], clear: 'f', note: 'upright in front of the chest: a mug, a glass, a bottle, a can' },
  drink:  { anchor: 'head', pos: [0, -.1, .1], y: [0, .82, -.57], z: [0, .57, .82], clear: 'f', mouth: true, note: 'the rim at the lips, tilted' },
  carry:  { anchor: 'chest', pos: [0, -.2, .26], y: [0, 1, 0], z: [0, 0, 1], clear: 'f', centre: true, lift: .6, note: 'two hands, a box or crate in front of the belly' },
  tray:   { anchor: 'chest', pos: [0, -.16, .3], y: [0, 1, 0], z: [0, 0, 1], clear: 'f', centre: true, lift: .6, note: 'two flat hands under a tray at the waist' },
  pole:   { anchor: 'chest', pos: [-.02, -.12, .22], y: [-.4, .88, .25], z: [0, -.27, .96], clear: 'f', centre: true, note: 'two hands on a staff / broom / bat across the body' },
  sign:   { anchor: 'chest', pos: [0, .3, .2], y: [0, 1, 0], z: [0, 0, 1], clear: 'f', centre: true, lift: 1.2, note: 'two hands up the stick of a placard held high, the board over the head, its face forward (kept off the head up and forward)' },
  aim:    { anchor: 'chest', pos: [.14, -.06, .36], y: [0, 1, 0], z: [0, -.15, 1], clear: 'f', note: 'a torch / tool pointed forward (+Z)' },
  show:   { anchor: 'chest', pos: [.1, .02, .36], y: [0, .97, -.25], z: [0, .25, .97], clear: 'f', note: 'a card, badge or key shown forward (+Z face)' },
  mic:    { anchor: 'head', pos: [.02, -.11, .13], y: [0, .55, -.83], z: [0, .83, .55], clear: 'f', mouth: true, note: 'the microphone head at the mouth' },
  umbrella: { anchor: 'chest', pos: [.13, .1, .24], y: [0, 1, 0], z: [0, 0, 1], clear: 'f', note: 'the shaft upright, the canopy over the head' },
  wheel:  { anchor: 'scene', note: 'the prop stays put (a steering wheel): both hands go to it' },
};
const ANCHOR_BONE = { head: 'Head', chest: 'spine_03', pelvis: 'pelvis' };

// =====================================================================================================================
// THE SOLVE (once per hold): the prop in the hand's metric frame, the palm pushed out of / onto the object, the fingers
// closed until their skin-blended vertex samples touch it, then every skinned hand vertex verifies (a finger found inside
// stops earlier; what no finger can fix moves the object off the hand along the palm normal)
// =====================================================================================================================
function poseOf(name) { const p = POSES[name] ?? POSES[name?.replace(/-.*/, '')]; if (!p) throw new Error(`hold: unknown hand pose "${name}" (${Object.keys(POSES).join(', ')})`); return p; }
function solveHand(H, prop, G, poseName, o = {}) {
  const pose = poseOf(poseName), N = H.N, pc = V3().setFromMatrixPosition(H.palm);
  let X = H.palm.clone().multiply(G.clone().invert());          // prop-local -> hand-metric
  let parts = propTris(prop, X), shift = 0, grid = triGrid(parts);
  const move = d => { shift += d; X.premultiply(new THREE.Matrix4().makeTranslation(N.x * d, N.y * d, N.z * d)); parts = propTris(prop, X); grid = triGrid(parts); };
  // the palm's object side: palm vertices (hand bone) within 6.5 cm of the palm centre, on the palm side
  const palmPts = H.palmV.map(v => v.h).filter(p => p.dot(N) > 0 && p.clone().sub(pc).projectOnPlane(N).length() < .065);
  const angles = {}, report = {}, margin = {}; for (const fn in H.chains) margin[fn] = .0006;
  for (let round = 0; round < 8; round++) {
    // 1. the palm: never inside the object; resting on it when the pose holds it in the palm
    for (let it = 0; it < 6; it++) {
      let deep = 0, near = 1; for (const p of palmPts) { const d = signedDist(parts, p, .08); if (d < 0) deep = Math.max(deep, -d); else near = Math.min(near, d); }
      let step = 0; if (deep > 2e-4) step = deep + .0006; else if (round === 0 && pose.palm && o.palmTouch !== false && near > .0015 && near < .03) step = -(near - .0008);
      if (!step) break; move(step);
    }
    // 2. the fingers: close from open toward the pose, stop at the surface; the exact skinned vertices verify
    let worst = 0;
    for (let pass = 0; pass < 3; pass++) {
      for (const fn in H.chains) angles[fn] = closeFinger(H.chains[fn], fn === 'thumb' ? pose.thumb.flex : pose.f[fn], fn === 'thumb' ? pose.thumb.opp : 0, grid, margin[fn], fn === 'thumb' ? pose.thumb.spread ?? 0 : 0, fn === 'thumb' ? 0 : pose.from ?? 0);
      if (H.chains.thumb && (o.contact ?? pose.contact ?? []).includes('thumb') && distalGap(H.chains.thumb, angles.thumb, grid) > .002) {   // the thumb must touch: try other spreads
        let best = angles.thumb, bg = distalGap(H.chains.thumb, best, grid);
        for (const d of [-.3, .3, -.6, .6, -.9]) { const a = closeFinger(H.chains.thumb, pose.thumb.flex, pose.thumb.opp, grid, margin.thumb, (pose.thumb.spread ?? 0) + d), gp = distalGap(H.chains.thumb, a, grid); if (gp < bg - 1e-4) { best = a; bg = gp; } if (bg <= .002) break; }
        angles.thumb = best; }
      const bad = verifyVerts(H, angles, parts); let any = false; worst = 0;
      for (const fn in bad) if (bad[fn] > 2e-4) { margin[fn] = Math.min(.006, margin[fn] + bad[fn] + .0008); any = true; worst = Math.max(worst, bad[fn]); }
      if (!any) break;
    }
    if (worst <= 2e-4) break;
    move(worst + .0008);   // 3. still inside (an open finger, the thumb's base): the object moves off the hand along the palm normal
  }
  for (const fn in H.chains) { const ch = H.chains[fn], a = angles[fn], F = fk(ch, a.ang, a.opp, a.spread); let gap = 1; const q = V3();
    for (let k = 0; k < 3; k++) for (const o of ch.samp[k]) gap = Math.min(gap, gridDist(grid, sampAt(ch, F, o, q), .05));
    report[fn] = { gap: +Math.max(0, gap).toFixed(4), stopped: a.stopped, need: (o.contact ?? pose.contact ?? []).includes(fn) }; }
  return { X, angles, report, shift, pose: poseName, contact: o.contact ?? pose.contact ?? [] };
}
// a uniform grid over the prop's triangles (1 cm cells): nearest-surface queries touch only the triangles near the point
function triGrid(parts, cell = .01) {
  const g = new Map(), key = (x, y, z) => ((x + 600) * 1201 + (y + 600)) * 1201 + (z + 600), all = new THREE.Box3();
  parts.forEach((P, pi) => { all.union(P.box); const T = P.tri; for (let o = 0; o < T.length; o += 9) {
    const x0 = Math.floor(Math.min(T[o], T[o + 3], T[o + 6]) / cell), x1 = Math.floor(Math.max(T[o], T[o + 3], T[o + 6]) / cell), y0 = Math.floor(Math.min(T[o + 1], T[o + 4], T[o + 7]) / cell), y1 = Math.floor(Math.max(T[o + 1], T[o + 4], T[o + 7]) / cell);
    const z0 = Math.floor(Math.min(T[o + 2], T[o + 5], T[o + 8]) / cell), z1 = Math.floor(Math.max(T[o + 2], T[o + 5], T[o + 8]) / cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const k = key(x, y, z); let a = g.get(k); if (!a) g.set(k, a = []); a.push(pi, o); } } });
  return { g, cell, parts, key, box: all };
}
function gridDist(G, p, cap) {   // unsigned distance to the nearest triangle (cap when farther)
  if (G.box.distanceToPoint(p) > cap) return cap; const c = G.cell; let best = cap * cap;
  const x0 = Math.floor((p.x - cap) / c), x1 = Math.floor((p.x + cap) / c), y0 = Math.floor((p.y - cap) / c), y1 = Math.floor((p.y + cap) / c), z0 = Math.floor((p.z - cap) / c), z1 = Math.floor((p.z + cap) / c);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 400) return surfDist(G.parts, p, cap);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const a = G.g.get(G.key(x, y, z)); if (!a) continue; for (let i = 0; i < a.length; i += 2) { const d = triDist2(p, G.parts[a[i]].tri, a[i + 1]); if (d < best) best = d; } }
  return Math.sqrt(best);
}
const _hp = V3(), _hq = V3();
// a sample under a finger pose: rigid with its phalanx (closing: what the phalanx itself touches), or skin-blended (blend:
// the exact surface, for the penetration tests - near a joint the two differ by a few mm)
function sampAt(ch, F, o, out, blend = false) {
  if (!blend) return out.copy(o.h).applyMatrix4(ch.MbInv[o.k]).applyMatrix4(F.M[o.k]);
  out.set(0, 0, 0); for (const [k, w] of o.w) { _hq.copy(o.h); if (k >= 0) _hq.applyMatrix4(ch.MbInv[k]).applyMatrix4(F.M[k]); out.addScaledVector(_hq, w); } return out; }
function distalGap(ch, a, G, blend = false) { const F = fk(ch, a.ang, a.opp, a.spread); let g = 1; for (let k = 1; k < 3; k++) for (const o of ch.samp[k]) g = Math.min(g, gridDist(G, sampAt(ch, F, o, _hp, blend), .05)); return g; }
function capsHit(ch, F, G, from, margin) {   // any visible vertex of phalanges from..2 (posed, skin-blended) within margin of the prop or inside it
  for (let k = from; k < 3; k++) for (const o of ch.samp[k]) { sampAt(ch, F, o, _hp); if (gridDist(G, _hp, margin + 1e-4) < margin) return true; for (const P of G.parts) if (insidePart(P, _hp)) return true; }
  return false;
}
function closeFinger(ch, target, opp, parts, margin, spread = 0, from = 0) {
  // from: start the close part way (a fraction of the target): a hook's straight fingers reach past a bag handle into the
  // bag top and stopped there at once, lying on the bag's face (a 14 cm finger, the bag 11 cm under the palm)
  const tgt = target || [0, 0, 0], ang = ch.opp ? [0, 0, 0] : tgt.map(x => x * from), stopped = [false, false, false];
  let o = 0;
  if (ch.opp) {   // the thumb: starts swung out (no opposition), swings in toward the pose's opposition until it touches
    o = Math.min(0, opp); while (o > -1.2 && capsHit(ch, fk(ch, ang, o, spread), parts, 0, margin)) o -= .06;
    if (opp > o) { let lo = o, hi = opp, hit = false; const N = 20;
      for (let i = 1; i <= N; i++) { const x = o + (opp - o) * i / N; if (capsHit(ch, fk(ch, ang, x, spread), parts, 0, margin)) { hi = x; lo = o + (opp - o) * (i - 1) / N; hit = true; break; } }
      if (hit) { for (let j = 0; j < 7; j++) { const m = (lo + hi) / 2; if (capsHit(ch, fk(ch, ang, m, spread), parts, 0, margin)) hi = m; else lo = m; } o = lo; } else o = opp; }
  }
  // phases: joints k..2 close together (in the pose's proportions) until any of their phalanges touches; a phalanx that
  // already touches stays (its joint does not close), the joints after it still may
  for (let k = 0; k < 3; k++) {
    if (capsHit(ch, fk(ch, ang, o, spread), parts, k, margin)) { stopped[k] = true; continue; }
    const base = ang.slice(), span = tgt.map((x, i) => i >= k ? Math.max(0, x - base[i]) : 0); if (span.every(x => x < 1e-4)) continue;
    const at = l => base.map((x, i) => x + span[i] * l);
    let lo = 0, hi = 1, hit = false; const N = 24;
    for (let i = 1; i <= N; i++) { const l = i / N; if (capsHit(ch, fk(ch, at(l), o, spread), parts, k, margin)) { hi = l; lo = (i - 1) / N; hit = true; break; } }
    if (hit) { for (let j = 0; j < 7; j++) { const m = (lo + hi) / 2; if (capsHit(ch, fk(ch, at(m), o, spread), parts, k, margin)) hi = m; else lo = m; } stopped[k] = true; }
    const l = hit ? lo : 1; at(l).forEach((x, i) => (ang[i] = x));
    if (!hit) break;   // nothing to touch: the pose is reached
  }
  return { ang, opp: o, spread, stopped, open: stopped[0] && ang.every(x => x === 0) };
}
function verifyVerts(H, angles, parts) {   // deepest skinned vertex inside the prop per finger
  const D = {}, Mp = {}, Mi = {};
  for (const fn in H.chains) { const ch = H.chains[fn], P = fk(ch, angles[fn].ang, angles[fn].opp, angles[fn].spread); Mp[fn] = P.M; Mi[fn] = ch.Mb.map(m => m.clone().invert()); }
  const p = V3(), q = V3();
  for (const o of H.verts) { if (!o.fw.some(([b]) => b)) continue; p.set(0, 0, 0); let wsum = 0;
    for (const [b, w] of o.fw) { q.copy(o.h); if (b) q.applyMatrix4(Mi[b[0]][b[1]]).applyMatrix4(Mp[b[0]][b[1]]); p.addScaledVector(q, w); wsum += w; }
    p.multiplyScalar(1 / wsum); const fn = (o.fw.find(([b]) => b) || [])[0]?.[0]; if (!fn) continue;
    for (const P of parts) if (insidePart(P, p)) { const d = surfDist([P], p, .03); D[fn] = Math.max(D[fn] || 0, d); break; } }
  return D;
}

// =====================================================================================================================
// RUNTIME: after every apply() of the figure (the clip, its relaxed hands): use IK, the second hand, the finger poses
// =====================================================================================================================
const HOLDS = new Set();   // every live hold (the HOLD check walks them)
function hookFigure(f) {
  if (f._handsHook) return f._handsHook; const list = [];
  if (typeof f.onApply === 'function') {   // figures.js v17: the holds run at the end of every apply(), at the time of the act / sequence / walkAt
    f.onApply(t => { f._ht = t; runHolds(f, list); }); if (f._ht == null && typeof f.time === 'number') f._ht = f.time;
  } else {   // (older figures.js: wrap the methods)
    const ap = f.apply.bind(f); f.apply = (...a) => { const r = ap(...a); runHolds(f, list); return r; };
    for (const k of ['act', 'sequence', 'timeline']) { const fn = f[k]?.bind(f); if (!fn) continue; f[k] = (x, y) => { const t = k === 'act' ? y?.t : typeof y === 'number' ? y : y?.t; if (typeof t === 'number') f._ht = t; return fn(x, y); }; }
    const wk = f.walkAt?.bind(f); if (wk) f.walkAt = (a, b, c, wo = {}) => { if (typeof wo.t === 'number') f._ht = wo.t; return wk(a, b, c, wo); };
  }
  // no built-in act('phone') phone (nor its palm push) on a figure whose hands hold() things: a held prop replaces it
  f.noAutoPhone = true; if (f._phone) { f._phone.removeFromParent?.(); f._phone = null; }
  return (f._handsHook = list);
}
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
function palmWorld(H) { H.hand.updateMatrixWorld(true); const m = H.hand.matrixWorld.clone(); const u = H.u; m.scale(V3(1 / u, 1 / u, 1 / u)); return m.multiply(H.palm); }   // world frame of the visible palm
function worldQ(b) { return b.getWorldQuaternion(new THREE.Quaternion()); }
function setWorldQ(b, q) { const pq = b.parent.getWorldQuaternion(new THREE.Quaternion()); b.quaternion.copy(pq.invert().multiply(q)); b.updateMatrixWorld(true); }
// two-bone IK: the visible palm onto the world frame T (metric axes): wrist from the palm offset, elbow toward the pole
// poleW: how much the elbow turns into the pole's plane (0 = it stays in the clip's own elbow plane): fading it in with the
// hold's weight keeps the elbow from snapping when the IK starts (charstress: 1.7 cm hand / elbow pops at rest and reach starts)
function armTo(H, T, pole, poleW = 1) {
  const { p: tp, q: tq } = decomposeRT(T), pd = decomposeRT(H.palm), Rh = tq.clone().multiply(pd.q.clone().invert());
  const Wt = tp.clone().sub(pd.p.clone().applyQuaternion(Rh));     // pd.p is metric already
  const S = H.up.getWorldPosition(V3()), E = H.lo.getWorldPosition(V3()), W = H.hand.getWorldPosition(V3());
  const a = S.distanceTo(E), b = E.distanceTo(W), D = Wt.clone().sub(S), d = clamp(D.length(), Math.abs(a - b) + 1e-4, (a + b) * .9995), dir = D.clone().normalize();
  const own = E.clone().sub(S); own.addScaledVector(dir, -own.dot(dir));
  let pv = own.clone(); if (pole && poleW > 0) { const pp = pole.clone().sub(S); pp.addScaledVector(dir, -pp.dot(dir)); if (pp.lengthSq() > 1e-10) { pp.normalize(); pv = own.lengthSq() > 1e-10 && poleW < 1 ? own.normalize().lerp(pp, poleW) : pp; } }
  if (pv.lengthSq() < 1e-10) pv.set(0, -1, 0); pv.normalize();
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA), E2 = S.clone().addScaledVector(dir, cosA * a).addScaledVector(pv, sinA * a);
  const r1 = new THREE.Quaternion().setFromUnitVectors(E.clone().sub(S).normalize(), E2.clone().sub(S).normalize()); setWorldQ(H.up, r1.multiply(worldQ(H.up)));
  const E3 = H.lo.getWorldPosition(V3()), W3 = H.hand.getWorldPosition(V3()), Tc = S.clone().addScaledVector(dir, d);
  const r2 = new THREE.Quaternion().setFromUnitVectors(W3.sub(E3).normalize(), Tc.sub(E3).normalize()); setWorldQ(H.lo, r2.multiply(worldQ(H.lo)));
  // forearm twist: half of the hand's twist about the forearm goes to the forearm (no candy-wrapper wrist)
  const fa = H.hand.getWorldPosition(V3()).sub(H.lo.getWorldPosition(V3())).normalize(), cur = worldQ(H.hand), rel = Rh.clone().multiply(cur.clone().invert());
  const tw = twistAngle(rel, fa); if (Math.abs(tw) > 1e-3) setWorldQ(H.lo, new THREE.Quaternion().setFromAxisAngle(fa, tw * .5).multiply(worldQ(H.lo)));
  setWorldQ(H.hand, Rh); return Math.max(0, D.length() - (a + b) * .9995);   // > 0: out of reach by that much
}
function twistAngle(q, axis) { const r = V3(q.x, q.y, q.z), p = axis.clone().multiplyScalar(r.dot(axis)), t = new THREE.Quaternion(p.x, p.y, p.z, q.w).normalize(); let a = 2 * Math.acos(clamp(t.w, -1, 1)); if (V3(t.x, t.y, t.z).dot(axis) < 0) a = -a; if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI; return a; }
function lerpFrame(A, B, w) { const a = decomposeRT(A), b = decomposeRT(B); return new THREE.Matrix4().compose(a.p.lerp(b.p, w), a.q.slerp(b.q, w), V3(1, 1, 1)); }
// a reach to a prop at rest: up first, then over to it, then down onto it (a straight line from a seated person's lap went
// through the desk's front edge: index 15 mm in the desk top, charstress deskcall)
// via (optional): a point in front of the chest at the target's height - the hand first pulls back under it (a seated
// person's hand on the thigh is under the desk top), rises, then goes over (charstress deskcall: 15 mm into the desk top)
// The last quarter comes in along the palm's normal from 6 cm outside the grip (a side grip was entered from above through
// the box's top edge: 1.3 cm, charstress handbox).
// (the via path blends in by how far the hand starts below the grip: a hard switch made a seated caller's head jump 9 cm
// the frame his idle hand crossed the threshold)
function reachFrame(A, B, w, via) { const a = decomposeRT(A), b = decomposeRT(B), q = a.q.slerp(b.q, smoother(clamp(w / .8))), p = V3();
  const n = V3(0, 0, 1).applyQuaternion(b.q), pre = b.p.clone().addScaledVector(n, -.06), top = Math.max(a.p.y, pre.y) + .05, wl = clamp(w / .78);
  const hw = smoother(clamp((wl - .15) / .85)); p.set(a.p.x + (pre.x - a.p.x) * hw, 0, a.p.z + (pre.z - a.p.z) * hw); p.y = wl < .55 ? a.p.y + (top - a.p.y) * smoother(wl / .55) : top + (pre.y - top) * smoother((wl - .55) / .45);
  const vw = via ? smoother(clamp((pre.y - a.p.y - .01) / .06)) : 0;
  if (vw > 0) { const v = V3(via.x, top, via.z), pv = V3();
    if (wl < .3) { const k = smoother(wl / .3); pv.set(a.p.x + (v.x - a.p.x) * k, a.p.y, a.p.z + (v.z - a.p.z) * k); }
    else if (wl < .6) { const k = smoother((wl - .3) / .3); pv.set(v.x, a.p.y + (top - a.p.y) * k, v.z); }
    else { const k = smoother((wl - .6) / .4); pv.set(v.x + (pre.x - v.x) * k, top + (pre.y - top) * k, v.z + (pre.z - v.z) * k); }
    p.lerp(pv, vw); }
  if (w > .78) p.lerp(b.p, smoother((w - .78) / .22));
  return new THREE.Matrix4().compose(p, q, V3(1, 1, 1)); }
const chestVia = (R, H) => { const S = H.up.getWorldPosition(V3()), f = R.f.fwd().setY(0).normalize(); return S.addScaledVector(f, .16); };
// a pick-up / put-down path: the prop first rises off its surface (an arc, h.arc m, default 6 cm) and turns only once it
// is clear (rotation 15 % behind) - the straight blend dragged the handset's grip hand 10-25 mm through the desk phone
function liftFrame(A, B, w, h) { const a = decomposeRT(A), b = decomposeRT(B), wr = smoother(clamp((w - .15) / .85)), p = a.p.lerp(b.p, w); p.y += (h?.arc ?? .06) * Math.sin(Math.PI * clamp(w));
  return new THREE.Matrix4().compose(p, a.q.slerp(b.q, wr), V3(1, 1, 1)); }
function openSol(H) { return H._open ??= { angles: Object.fromEntries(Object.keys(H.chains).map(fn => [fn, { ang: [.08, .1, .08], opp: 0, spread: 0 }])) }; }   // a loose open hand
function setFingers(H, sol, w) {
  for (const fn in H.chains) { const ch = H.chains[fn], a = sol.angles[fn]; if (!a) continue;
    for (let k = 0; k < 3; k++) { const q = ch.loc[k].q.clone(); if (k === 0 && ch.opp && a.opp) q.multiply(_rq.setFromAxisAngle(ch.opp, a.opp)); if (k === 0 && ch.spr && a.spread) q.multiply(_rq.setFromAxisAngle(ch.spr, a.spread)); q.multiply(_rq.setFromAxisAngle(ch.axes[k], a.ang[k]));
      if (w >= 1) ch.bones[k].quaternion.copy(q); else ch.bones[k].quaternion.slerp(q, w); } }
  H.hand.updateMatrixWorld(true);
}
function anchorWorld(R, h) {   // the use frame's anchor in the world: the head bone itself, or a body bone's position + the figure's facing
  const U = h.useDef, b = R.f.bone(ANCHOR_BONE[U.anchor]); b.updateMatrixWorld(true);
  if (U.anchor === 'head') { const m = b.matrixWorld.clone(), s = V3().setFromMatrixColumn(m, 0).length(); m.scale(V3(1 / s, 1 / s, 1 / s)); return m.multiply(h.anchorLocal); }
  R.f.group.updateMatrixWorld(true); return new THREE.Matrix4().compose(b.getWorldPosition(V3()), R.f.group.getWorldQuaternion(new THREE.Quaternion()), V3(1, 1, 1));
}
// keep-out (every frame, chest / pelvis uses): the held prop never enters the trunk or the legs as the clip moves them
const _kv = V3();
function keepOut(R, h, T, dir, stiff = 3) {   // stiff: the push is at most this times a vertex's depth (hang: 1.5, softer)
  if (!h.boxes) { h.boxes = []; for (const P of propTris(h.prop, new THREE.Matrix4())) h.boxes.push(P.box.clone().expandByScalar(.01)); }
  R._trunk ??= vertsOf(R, n => !/^(hand|thumb|index|middle|ring|pinky|lowerarm|upperarm)/.test(n)).filter((o, i) => i % 3 === 0);   // (clavicle: the chest of the female body)
  // the bones near the prop (their vertices are tested): measured from the prop's box CENTRE with a bone's length of margin -
  // from its origin with .35 m a walking thigh bone came in range with its vertices already deep in a briefcase (2 cm pop)
  if (!h.boxC) { const all = new THREE.Box3(); for (const B of h.boxes) all.union(B); h.boxC = all.getCenter(V3()); h.boxR = all.getSize(V3()).length() / 2; }
  const inv = T.clone().invert(), c = h.boxC.clone().applyMatrix4(T), r = h.boxR + .6;
  const dW = dir ?? V3(0, 0, 1).transformDirection(R.f.group.matrixWorld), dL = dW.clone().transformDirection(inv).negate(), near = new Map();
  let s = 0;
  for (const o of R._trunk) { let ok = near.get(o.bone); if (ok == null) { ok = R.f.bone(o.bone)?.getWorldPosition(_kv).distanceTo(c) < r; near.set(o.bone, ok); } if (!ok) continue;
    // (the push is at most `stiff` x the vertex's depth in the box: a vertex entering through a side face had the whole box width
    // to exit along the push direction at once - the bat / bag popped 1.9 cm the frame a leg vertex entered, charstress)
    skinnedWorld(o, _kv); _kv.applyMatrix4(inv); for (const B of h.boxes) if (B.containsPoint(_kv)) s = Math.max(s, Math.min(exitAlong(B, _kv, dL), stiff * depthIn(B, _kv))); }
  // (the extra 2 mm margin fades in with the depth: a fixed margin made the prop jump 2 mm the frame a leg first touched it)
  h.kept = s; if (s > 0) { const st = s + .002 * smoother(s / .002); T.premultiply(new THREE.Matrix4().makeTranslation(dW.x * st, dW.y * st, dW.z * st)); }
  return T;
}
// over furniture (body uses): a held prop's use pose never sinks into a table / desk in front of the person - it rises onto
// the top under it (+4 mm, at most 25 cm). A seated diner's glass went 17 mm into the table top, charstress mugpick.
const _ls = new THREE.Raycaster(), _lsB = new THREE.Box3();
function liftOverSolids(R, h, T) {
  if (!h.boxes) { h.boxes = []; for (const P of propTris(h.prop, new THREE.Matrix4())) h.boxes.push(P.box.clone().expandByScalar(.01)); }
  const box = new THREE.Box3(), c = V3(); for (const B of h.boxes) for (let i = 0; i < 8; i++) box.expandByPoint(c.set(i & 1 ? B.max.x : B.min.x, i & 2 ? B.max.y : B.min.y, i & 4 ? B.max.z : B.min.z).applyMatrix4(T));
  let scene = R.f.group; while (scene.parent) scene = scene.parent; const cand = [], grow = box.clone().expandByScalar(.02);
  scene.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || !m.visible || m.userData.noContact) return; for (let p = m; p; p = p.parent) if (p === h.prop || p === R.f.group || p.userData?.noContact || p.userData?.heldNow) return;
    const g = m.geometry; if (!g?.attributes?.position) return; if (!g.boundingBox) g.computeBoundingBox(); _lsB.copy(g.boundingBox).applyMatrix4(m.matrixWorld); if (_lsB.getSize(c).length() > 12 || !_lsB.intersectsBox(grow)) return; cand.push(m); });
  if (!cand.length) return 0; let lift = 0;
  for (const [x, z] of [[.5, .5], [.1, .1], [.9, .1], [.1, .9], [.9, .9]]) { const px = box.min.x + (box.max.x - box.min.x) * x, pz = box.min.z + (box.max.z - box.min.z) * z;
    _ls.set(V3(px, box.max.y + .3, pz), V3(0, -1, 0)); _ls.far = box.max.y - box.min.y + .35; const hit = _ls.intersectObjects(cand, false).find(x => x.point.y < box.max.y - .01); if (!hit) continue;
    if (hit.point.y > box.min.y + .006 - .01) lift = Math.max(lift, hit.point.y + .004 - (box.min.y + .01)); }   // (box.min.y + .01: the boxes are grown 1 cm)
  lift = Math.min(lift, .25); h.lifted = lift; if (lift > 0) T.premultiply(new THREE.Matrix4().makeTranslation(0, lift, 0));
  return lift;
}
// reach fit (body uses): a hand that cannot reach its grip pulls the prop toward its shoulder by the shortfall (both hands
// of a two-hand hold; the shorter female arms, a clip that leans) - then the keep-out checks the body again
function wristTarget(H, T) { const { p: tp, q: tq } = decomposeRT(T), pd = decomposeRT(H.palm), Rh = tq.clone().multiply(pd.q.clone().invert()); return tp.clone().sub(pd.p.clone().applyQuaternion(Rh)); }
function armLen(H) { return H._len ??= H.lo.getWorldPosition(V3()).distanceTo(H.up.getWorldPosition(V3())) + H.hand.getWorldPosition(V3()).distanceTo(H.lo.getWorldPosition(V3())); }
function fitReach(R, h, Tp) {
  let moved = false; const hands = [[R.sides[h.side], h.T1]]; if (h.second) hands.push([h.second.H, h.second.T]);
  for (let it = 0; it < 4; it++) { let worst = 0, dir = null;
    for (const [H, G] of hands) { const W = wristTarget(H, Tp.clone().multiply(G)), S = H.up.getWorldPosition(V3()), d = W.distanceTo(S) - armLen(H) * .985; if (d > worst) { worst = d; dir = S.sub(W).normalize(); } }
    if (!dir) break; const st = worst + .004; Tp.premultiply(new THREE.Matrix4().makeTranslation(dir.x * st, dir.y * st, dir.z * st)); moved = true; }
  return moved;
}
// lean: a hand target just out of reach bends the spine toward it (people bend to grab things) - up to ~25 deg, reset by the
// clip every frame (deterministic); the arm IK runs after it
// w: the weight of the lean (the reach's progress toward the prop at rest): a lean that followed the moving reach target
// jumped 6 deg in a frame (head 5-9 cm, charstress phonepick / deskcall); it now aims at the rest target, faded in
function leanToward(R, H, T, w = 1) {
  const Wt = wristTarget(H, T), S = H.up.getWorldPosition(V3()), need = Wt.distanceTo(S) - armLen(H) * .985; if (need <= 0) return 0;
  const sp = R.f.bone('spine_01'); if (!sp) return 0; const P = sp.getWorldPosition(V3()), a = V3().crossVectors(S.clone().sub(P), Wt.clone().sub(S)); if (a.lengthSq() < 1e-10) return 0; a.normalize();
  const ang = Math.min(.45, need / Math.max(.2, S.distanceTo(P)) * 1.15) * w; if (ang < 1e-5) return 0; setWorldQ(sp, new THREE.Quaternion().setFromAxisAngle(a, ang).multiply(worldQ(sp))); return ang;
}
const depthIn = (B, p) => Math.min(p.x - B.min.x, B.max.x - p.x, p.y - B.min.y, B.max.y - p.y, p.z - B.min.z, B.max.z - p.z);
function exitAlong(B, p, d) { let t = Infinity; for (const k of ['x', 'y', 'z']) { if (Math.abs(d[k]) < 1e-9) continue; const e = d[k] > 0 ? (B.max[k] - p[k]) / d[k] : (B.min[k] - p[k]) / d[k]; t = Math.min(t, e); } return isFinite(t) ? t : 0; }
function poleFor(R, H, kind) {
  const S = H.up.getWorldPosition(V3()), up = V3(0, 1, 0), fw = R.f.fwd(), out = V3().crossVectors(up, fw).multiplyScalar(H.s === 'l' ? 1 : -1);
  if (kind === 'ear' || kind === 'mouth') return S.addScaledVector(out, .45).addScaledVector(up, -.25).addScaledVector(fw, .15);
  return S.addScaledVector(up, -.55).addScaledVector(out, .38).addScaledVector(fw, -.18);
}
function runHolds(f, list) {
  if (!list.length) return; const R = rigOf(f), t = f._ht ?? 0;
  // holds first, rests after them: a rest settles on the FINAL torso (a hold's spine lean carried the resting left hand 27-30 mm
  // into the table, charstress mugpick); a rest side whose hand a hold uses now (reaching, held, putting down) yields to the hold
  // (continuous: per hand, the rest's weight x (1 - the strongest hold on that hand now) - a yes / no yield snapped a resting
  // hand 6.6 cm off the table the frame a glass pick-up's reach began, charstress mugpick)
  for (const h of list) if (h.kind !== 'rest') h.update(t, R);
  let busy = null; for (const h of list) if (h.kind === 'rest') { if (!busy) { busy = {}; for (const x of list) if (x.kind !== 'rest') { const w = x.weightAt(t); for (const s of [x.side, x.second?.side]) if (s) busy[s] = Math.max(busy[s] ?? 0, w); } } h.busy = busy; h.update(t, R); }
}

// the phase weights of a hold at time t: reach (hand to the prop at rest), held (attached), put (back to rest), release
// (h.reachT / h.liftT: per hold, o.reach / o.lift; a handover takes longer)
const REACH = .5, LIFT = .45;
// dwell0 / dwell1 (o.dwell): the hands stay on the prop where it rests for that long after the grab / before the release
// (a handover: the giver's prop is still at the exchange point while the taker's hands close on it)
function phases(h, t) {
  const t0 = h.t0, t1 = h.t1, RE = h.reachT ?? REACH, LI = h.liftT ?? LIFT, D0 = h.dwell0 ?? 0, D1 = h.dwell1 ?? 0;
  if (t0 == null && t1 == null) return { held: true, toUse: 1, grab: 1 };
  if (t0 != null && t < t0) { const k = smoother((t - (t0 - RE)) / RE); return { held: false, toRest: k, grab: k }; }
  if (t1 == null || t < t1 - D1 - LI) return { held: true, toUse: t0 == null ? 1 : smoother((t - t0 - D0) / LI), grab: 1, fromRest: t0 != null };
  if (t < t1) return { held: true, toUse: 1 - smoother((t - (t1 - D1 - LI)) / LI), grab: 1, fromRest: true };
  const k = 1 - smoother((t - t1) / RE); return { held: false, toRest: k, grab: k, after: true };
}
// another hold of the same prop that holds it at its own figure's time (a handover: the giver until t, the taker after):
// a hold that does not hold the prop now never moves it then
const ownerOf = (h) => (h.prop.userData.holds || []).find(o => o !== h && HOLDS.has(o) && phases(o, o.f._ht ?? 0).held) ?? null;
// a world pose: a Matrix4, or { at: [x, y, z], yaw (deg), quat: [x, y, z, w] }
function asPose(r) { if (!r) return null; if (r.isMatrix4) return r.clone(); const q = r.quat ? new THREE.Quaternion(...r.quat) : new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), (r.yaw ?? 0) * Math.PI / 180);
  return new THREE.Matrix4().compose(asV(r.at ?? [0, 0, 0]), q, V3(1, 1, 1)); }

/** hold(f, prop, grip?, { side 'R'|'L', t0?, t1?, use?, pose?, weight? }) -> the hold (h.release(), h.report)
 *  grip: a name from the prop's grips (default: its first) or a grip object. side: the hand (default the grip's).
 *  t0/t1: picked up at t0 from where it rests now (the hand reaches for it before t0), put back at t1 (else held all along).
 *  use: override the grip's use (USES). Call it once in build(); the figure's act()/sequence() calls drive it. */
// the handle grips' palm place over the bar (hold(), g.bar): found once per body x prop x grip x hand x pose x flip
const BAR_PLACE = new Map();
const BAR_BEST = {   // (baked 2026-10-16 from the verified search, both built-in bodies: key -> [dy, dz] m along the fingers / palm normal)
  'male|briefcase|handle|r|hook|0': [0, -.015], 'male|briefcase|handle|l|hook|0': [0, -.015], 'female|briefcase|handle|r|hook|0': [0, -.015], 'female|briefcase|handle|l|hook|0': [0, -.015],
  'male|shopping bag|handle|r|hook|0': [-.005, -.015], 'male|shopping bag|handle|l|hook|0': [-.005, -.015], 'female|shopping bag|handle|r|hook|0': [.01, -.015], 'female|shopping bag|handle|l|hook|0': [.01, -.015] };
export const _barPlaces = () => Object.fromEntries(BAR_PLACE);
export function hold(f, prop, grip, o = {}) {
  if (!f?.bone || !f.apply) throw new Error('hold: needs a figure from figure() (human or mixamo rig)');
  if (!prop?.isObject3D) throw new Error('hold: needs a prop (prop(kind) or a group)');
  const R = rigOf(f), list = hookFigure(f);
  const G0 = resolveGrip(prop, grip, o.side ? sideOf(o.side) : null), s = G0.side, H = R.sides[s];
  const g = G0.g, useName = o.use ?? g.use ?? 'clip', useDef = USES[useName]; if (!useDef) throw new Error(`hold: unknown use "${useName}" (${Object.keys(USES).join(', ')})`);
  // flip: the grip turned 180 deg about the prop's up axis (taking a prop from someone who faces you: a handover)
  const FL = o.flip ? new THREE.Matrix4().makeRotationY(Math.PI) : null, gf = (gg, m) => { const M = gripFrame(gg, m); return FL ? M.premultiply(FL) : M; };
  let G = gf(g, G0.mirror), sol = solveHand(H, prop, G, o.pose ?? g.pose ?? 'wrap', g);
  // a handle (g.bar): the palm's best place over the bar for THIS hand - the bodies' fingers differ (2.5-3 cm thick, 12-15 cm
  // long), one grip position hooked the male right hand and left the female's fingers under the bar in the air: a few offsets
  // along the fingers and the palm normal, the one whose fingers wrap the bar best (wrapScore)
  // (the best few are then measured on the DRAWN hand mesh: an uploaded character's middle phalanx went 9 mm into the briefcase
  // where the finger model saw it clear - a place with any drawn finger inside the prop loses 10x its depth)
  // (FAST: the search is 35 finger solves, 8-10 s per hold - a street with three bags took longer than the app's 30 s still
  // budget. The place found is kept per body x prop x grip x hand x pose (BAR_PLACE, the built-in bodies' baked in BAR_BEST
  // from the verified search): one solve after the first time, none of the search for the two built-in bodies)
  if (g.bar && !g.second) { const bkey = `${f.custom ? 'custom:' + (f.figure?.custom ?? '') : f.body}|${prop.userData?.prop?.kind ?? prop.name}|${G0.name ?? grip}|${s}|${o.pose ?? g.pose ?? 'wrap'}|${o.flip ? 1 : 0}`;
    const known = BAR_PLACE.get(bkey) ?? BAR_BEST[bkey];
    if (known) { if (known[0] || known[1]) { G = G.clone().multiply(new THREE.Matrix4().makeTranslation(0, known[0], known[1])); sol = solveHand(H, prop, G, o.pose ?? g.pose ?? 'wrap', g); } }
    else { const bar = barOf(g, G0.mirror, FL), cand = [{ s: wrapScore(H, sol, bar, G), G, sol, dy: 0, dz: 0 }];
      for (const dy of [-.02, -.015, -.01, -.005, 0, .005, .01]) for (const dz of [-.015, -.01, -.005, 0, .005]) { if (!dy && !dz) continue;
        const Gt = G.clone().multiply(new THREE.Matrix4().makeTranslation(0, dy, dz)), st = solveHand(H, prop, Gt, o.pose ?? g.pose ?? 'wrap', g); cand.push({ s: wrapScore(H, st, bar, Gt), G: Gt, sol: st, dy, dz }); }
      cand.sort((a, b) => b.s - a.s); const top = cand.slice(0, 6); for (const c of top) { c.dr = drawnIn(R, H, c.sol, prop); c.s -= 10 * c.dr.d; } top.sort((a, b) => b.s - a.s);
      G = top[0].G; sol = top[0].sol; BAR_PLACE.set(bkey, [top[0].dy, top[0].dz]); } }
  // (open: the uploaded character of charstress custom keeps its ring_03 ~9 mm in the briefcase bar at every place - the hook's
  // 40 % start already puts its thicker ring finger into the bar, where the finger model sees it clear)
  const h = { f, prop, side: s, grip: G0.name, kind: G0.kind, use: useName, useDef, G, sol, t0: o.t0, t1: o.t1, weight: o.weight ?? 1, second: null, name: `${f.name}: ${G0.kind} (${G0.name})`, reachT: o.reach, liftT: o.lift, flip: !!o.flip,
    dwell0: o.dwell0 ?? o.dwell, dwell1: o.dwell1 ?? o.dwell, arc: o.arc };
  // the second hand of two-hand grips: its own frame on the prop, its own finger solve
  if (g.second) { const s2 = s === 'r' ? 'l' : 'r', H2 = R.sides[s2], G2 = gf(g.second, G0.mirror), sol2 = solveHand(H2, prop, G2, g.second.pose ?? g.pose ?? 'wrap', g.second);
    // the solve may have moved the palm off the object along its normal: the IK target is the corrected palm frame
    const T2 = G2.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -sol2.shift)); h.second = { side: s2, H: H2, G: G2, T: T2, sol: sol2 }; }
  h.T1 = G.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -sol.shift));   // where the palm sits on the prop (prop-local)
  // a PICK grip (o.pick or the grip's own `pick`): how the hand takes the prop off a surface when the use grip cannot (a phone
  // lying flat cannot be held from below): at rest the hand is in the pick grip, during the lift the prop turns in the
  // fingers to the use grip (and back before a put-down)
  const pk = o.t0 != null || o.t1 != null ? (o.pick ?? g.pick) : null;
  if (pk && !g.second) { const PK = resolveGrip(prop, pk, s), Gp = gf(PK.g, PK.mirror), solP = solveHand(H, prop, Gp, PK.g.pose ?? 'pinch', PK.g);
    h.pick = { name: PK.name, G: Gp, sol: solP, T1: Gp.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -solP.shift)), local: new THREE.Matrix4().makeScale(1 / H.u, 1 / H.u, 1 / H.u).multiply(solP.X) }; }
  const gp = V3().setFromMatrixPosition(G); h.anchorPt = h.second ? gp.clone().add(V3().setFromMatrixPosition(h.second.G)).multiplyScalar(.5) : gp;
  h.tip = asV(g.tip ?? [0, 0, -.055]); if (G0.mirror) h.tip.setComponent(AX[G0.mirror], -h.tip.getComponent(AX[G0.mirror])); h.up = asV(g.up ?? [0, 1, 0]).normalize();
  if (FL) { h.tip.set(-h.tip.x, h.tip.y, -h.tip.z); h.up.set(-h.up.x, h.up.y, -h.up.z); }
  // a handle grip's bar ([a, b, r]: its centre line + half thickness, prop-local): the HOLD check tests that the fingers wrap it
  if (g.bar) h.bar = barOf(g, G0.mirror, FL);
  // the prop in the hand bone's frame (bone units): X^-1 maps hand-metric -> prop ... prop = handMetric * X
  const u = H.u; h.local = new THREE.Matrix4().makeScale(1 / u, 1 / u, 1 / u).multiply(sol.X);
  // the rest pose (where it was before pick-up, where it goes at t1; o.rest: a given world pose, e.g. a handover's
  // exchange point) and its parent (o.parent; else the prop's own; a prop given o.rest outside the scene: the figure's scene)
  prop.updateMatrixWorld(true); h.rest = asPose(o.rest) ?? prop.matrixWorld.clone();
  h.parent0 = o.parent ?? (o.rest ? (() => { let p = f.group; while (p.parent) p = p.parent; return p; })() : prop.parent);
  (prop.userData.holds ??= []).push(h);
  // the use frame: anchor bone (bind axes) + the prop pose in it, cleared off the body
  if (['head', 'chest', 'pelvis'].includes(useDef.anchor)) setupUse(R, h, H);
  h.weightAt = t => { const P = phases(h, t); return P.held ? 1 : P.grab; };
  h.update = (t, R2) => updateHold(h, t, R2);
  h.release = () => { const i = list.indexOf(h); if (i >= 0) list.splice(i, 1); HOLDS.delete(h); const k = prop.userData.holds?.indexOf(h) ?? -1; if (k >= 0) prop.userData.holds.splice(k, 1); if (h.parent0 && prop.parent !== h.parent0) { h.parent0.attach(prop); } return prop; };
  prop.userData.noContact = true; prop.userData.heldBy = h;
  list.push(h); HOLDS.add(h);
  h.update(f._ht ?? o.t0 ?? 0, R); R.f.group.updateMatrixWorld(true);   // on the current pose now (never f.apply() here: with no clip queued it resets to the bind pose); act()/sequence() drive it from here
  return h;
}
// the deepest DRAWN hand vertex (the real skinned mesh, fingers posed as the solve says) inside the prop placed by that solve
// (hand-metric: the palm frame) - the finger model and an uploaded character's mesh can differ by several mm
function drawnIn(R, H, sol, prop) {
  const saved = Object.fromEntries(Object.values(H.chains).flatMap(ch => ch.names.map(n => [n, R.f.bone(n)?.quaternion.clone()])));
  setFingers(H, sol, 1); R.f.group.updateMatrixWorld(true); for (const m of R.skins) m.skeleton.update();
  const parts = propTris(prop, sol.X), box = new THREE.Box3(); for (const P of parts) box.union(P.box); box.expandByScalar(.002);
  const Pi = H.hand.matrixWorld.clone().scale(V3(1 / H.u, 1 / H.u, 1 / H.u)).invert(), v = V3(), by = {}; let deep = 0;   // world -> hand-metric (sol.X's frame)
  R._handAll ??= vertsOf(R, n => /^(hand|thumb|index|middle|ring|pinky)/.test(n));
  for (const o of R._handAll) { if (!o.bone.endsWith('_' + H.s) && o.bone !== H.hand.name) continue; skinnedWorld(o, v).applyMatrix4(Pi); if (!box.containsPoint(v)) continue;
    for (const P of parts) if (insidePart(P, v)) { const d = surfDist([P], v, .03), fn = /^(thumb|index|middle|ring|pinky)/.exec(o.bone)?.[1]; deep = Math.max(deep, d); if (fn) by[fn] = Math.max(by[fn] ?? 0, d); break; } }
  for (const [n, q] of Object.entries(saved)) if (q) R.f.bone(n).quaternion.copy(q); R.f.group.updateMatrixWorld(true);
  return { d: deep, by };   // by: the depth per finger
}
// a grip's handle bar in prop-local (mirrored / flipped like the grip): { a, b (centre line ends), r (half thickness) }
function barOf(g, mirror, FL) { const mv = p => { const w = asV(p); if (mirror) w.setComponent(AX[mirror], -w.getComponent(AX[mirror])); if (FL) w.set(-w.x, w.y, -w.z); return w; }; return { a: mv(g.bar[0]), b: mv(g.bar[1]), r: g.bar[2] }; }
// how well a finger solve wraps a bar (higher = better): each of index / middle / ring touching under it (gap -> 0), round
// its far side, the tip past its centre (capped); the solve's push off the palm counts against it
function wrapScore(H, sol, bar, G) {
  const Xi = sol.X.clone().invert(), A = bar.a, ax = bar.b.clone().sub(A).normalize(), L = A.distanceTo(bar.b), p = V3();
  const nP = V3().setFromMatrixColumn(G, 2), dP = V3().setFromMatrixColumn(G, 1); nP.addScaledVector(ax, -nP.dot(ax)).normalize(); dP.addScaledVector(ax, -dP.dot(ax)).addScaledVector(nP, -dP.dot(nP)).normalize();
  let score = 0;
  for (const fn of ['index', 'middle', 'ring']) { const ch = H.chains[fn], a = sol.angles[fn]; if (!ch || !a) continue; const F = fk(ch, a.ang, a.opp, a.spread); let under = .02, far = .02, tip = -.03;
    for (let k = 0; k < 3; k++) for (const o of ch.samp[k]) { sampAt(ch, F, o, p).applyMatrix4(Xi); const t = p.clone().sub(A).dot(ax); if (t < -.004 || t > L + .004) continue;
      const off = p.clone().sub(A.clone().addScaledVector(ax, clamp(t, 0, L))), x = off.dot(nP), y = off.dot(dP), d = Math.max(0, Math.hypot(x, y) - bar.r);
      if (k === 2) tip = Math.max(tip, x);
      if (y > 0 && Math.abs(x) < bar.r) under = Math.min(under, d); if (x > 0 && Math.abs(y) < bar.r * 1.5) far = Math.min(far, d); }
    score += -2 * under - far + Math.min(tip, .012); }
  return score - 2 * sol.shift;
}
/** handover(a, b, prop, grip, { t, gripB, at, y, lift, reach, flip, sideA, sideB }) -> { a, b, at }: a holds the prop
 *  until t, b holds it from t on. Over `lift` s before t a's hands bring it to the EXCHANGE pose (default: midway between
 *  the two, at elbow height, its +Z pointing from a to b), b's hands reach it there over `reach` s, at t both are on it and
 *  it changes owner without moving (no pop), then b lifts it to b's own use pose while a's hands go back to the clip.
 *  b takes it with the grip turned 180 deg (flip, default when the two face each other). Place both people first; call it
 *  INSTEAD of hold() for that prop (a's earlier pick-up: pass a: { t0 }). The HOLD check says when the exchange is out of
 *  reach. */
export function handover(a, b, prop, grip, o = {}) {
  if (typeof o.t !== 'number') throw new Error('handover: needs { t } (the moment the prop changes hands)');
  // timing: the prop arrives at the exchange pose `settle` s before t and stays there; the taker's hands close on it by t;
  // both hold it there until t + overlap (it does not move), then the giver lets go and the taker lifts it
  const at = o.at ? asPose(o.at) : exchangeFrame(a, b, prop, grip, o), fa = a.fwd(), fb = b.fwd(), facing = fa.dot(fb) < -.2, D = o.settle ?? .4, D2 = o.overlap ?? .2;
  const ha = hold(a, prop, grip, { lift: o.lift ?? .7, ...(o.a || {}), side: o.sideA, t1: o.t + D2, dwell1: D + D2, rest: at });
  const hb = hold(b, prop, o.gripB ?? grip, { reach: o.reach ?? .7, lift: o.lift ?? .7, ...(o.b || {}), side: o.sideB, t0: o.t, dwell0: D2, rest: at, flip: o.flip ?? facing });
  if (!o.at) { const fit = fitExchange(a, b, ha, hb, prop, grip, o); ha.rest = hb.rest = fit.at; ha.fit = hb.fit = fit; }
  ha.pair = hb; hb.pair = ha;
  return { a: ha, b: hb, at: ha.rest, fit: ha.fit ?? null };
}
// the exchange pose both people reach: between them (k of the way from a) at a height that keeps every hand of both inside
// its arm's reach (preferring halfway, elbow height); fit.short > 0 = still that far out of reach (stand them closer)
function fitExchange(a, b, ha, hb, prop, grip, o) {
  a.group.updateMatrixWorld(true); b.group.updateMatrixWorld(true);
  const pa = a.group.getWorldPosition(V3()), pb = b.group.getWorldPosition(V3()), d = pb.clone().sub(pa).setY(0), q = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.atan2(d.x, d.z));
  const g = resolveGrip(prop, grip, o.sideA ? sideOf(o.sideA) : null).g, gp = asV(g.pos), mid = g.second ? gp.clone().add(asV(g.second.pos)).multiplyScalar(.5) : gp, hgt = ((a.height ?? 1.8) + (b.height ?? 1.8)) / 2;
  const hands = [[a, ha], [b, hb]].flatMap(([f, h]) => { const R = rigOf(f); return [[R.sides[h.side], h.T1], ...(h.second ? [[h.second.H, h.second.T]] : [])]; });
  let best = null;
  for (const k of [.5, .45, .55, .4, .6, .35, .65]) for (const yy of (o.y != null ? [o.y / (hgt / 1.8)] : [1.0, .95, 1.05, .9, 1.1, 1.15, .85])) {
    const X = new THREE.Matrix4().compose(pa.clone().lerp(pb, k).setY(Math.max(pa.y, pb.y) + yy * hgt / 1.8).sub(mid.clone().applyQuaternion(q)), q, V3(1, 1, 1));
    let short = -1; for (const [H, T] of hands) short = Math.max(short, wristTarget(H, X.clone().multiply(T)).distanceTo(H.up.getWorldPosition(V3())) - armLen(H) * .95);
    const score = Math.max(short, -.02); if (!best || score < best.score - 1e-3) best = { at: X, short: +short.toFixed(3), k, y: +(yy * hgt / 1.8).toFixed(3), score }; }
  return best;
}
// the exchange pose: the prop's grip centre midway between the two roots at elbow height (o.y), +Z from a to b, upright
function exchangeFrame(a, b, prop, grip, o) {
  a.group.updateMatrixWorld(true); b.group.updateMatrixWorld(true);
  const pa = a.group.getWorldPosition(V3()), pb = b.group.getWorldPosition(V3()), d = pb.clone().sub(pa).setY(0), yaw = Math.atan2(d.x, d.z);
  const g = resolveGrip(prop, grip, o.sideA ? sideOf(o.sideA) : null).g, gp = asV(g.pos), mid = g.second ? gp.clone().add(asV(g.second.pos)).multiplyScalar(.5) : gp;
  const hgt = ((a.height ?? 1.8) + (b.height ?? 1.8)) / 2, y = o.y ?? 1.0 * hgt / 1.8, q = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), yaw);
  const P = pa.clone().lerp(pb, o.k ?? .5).setY(Math.max(pa.y, pb.y) + y).sub(mid.clone().applyQuaternion(q));
  return new THREE.Matrix4().compose(P, q, V3(1, 1, 1));
}
// use space (s toward the holding hand, u up, f forward) -> the anchor's right-handed frame (x = the figure's left, y up, z
// forward): s = sgn * x (the right hand's side is -x). A frame given in use space is mirrored into it (y, z mirrored, x = y x z).
const sgnOf = h => h.side === 'l' ? 1 : -1;
const FLIP_Y = new THREE.Matrix4().makeRotationY(Math.PI);
const useV = (v, sg) => V3(v.x * sg, v.y, v.z);
function useFrame(P, y, z, sg) { const Y = useV(y, sg).normalize(), Z = useV(z, sg); Z.addScaledVector(Y, -Z.dot(Y)).normalize(); return new THREE.Matrix4().makeBasis(V3().crossVectors(Y, Z), Y, Z).setPosition(useV(P, sg)); }
function setupUse(R, h, H) {
  const U = h.useDef, bn = ANCHOR_BONE[U.anchor], Bw = R.bindW(bn), sg = sgnOf(h);
  const toBone = decomposeRT(Bw).q.invert(), L = R.right.clone().negate();
  h.anchorLocal = new THREE.Matrix4().makeBasis(L.clone().applyQuaternion(toBone), R.up.clone().applyQuaternion(toBone), R.fwd.clone().applyQuaternion(toBone));   // head: bone-relative axes (origin = the bone)
  h.anchorBind = new THREE.Matrix4().makeBasis(L, R.up, R.fwd).setPosition(V3().setFromMatrixPosition(Bw));   // chest / pelvis at bind: the figure's axes at the bone
  if (U.ear || U.mouth) { earFrame(R, h, H); return; }
  const P = asV(U.pos).multiplyScalar((R.f.height ?? 1.8) / 1.8); if (U.centre) P.x = 0;
  h.useLocal = useFrame(P, asV(U.y), asV(U.z), sg); if (h.flip) h.useLocal.multiply(FLIP_Y);   // (a flipped grip holds the prop turned round: so is its use pose)
  atUsePoint(h, V3().setFromMatrixPosition(h.useLocal), h.anchorPt);
  clearBody(R, h, H, U.clear === 'f' ? V3(0, 0, 1) : V3(sg, 0, 0));
}
// push the prop (+ the hands holding it) along `dir` (anchor frame) until no visible body vertex is within 1.5 cm of it
function atUsePoint(h, P, pt) { const m = h.useLocal, q = decomposeRT(m).q; m.setPosition(P.clone().sub(pt.clone().applyQuaternion(q))); }   // the prop point pt (prop-local) lands on P
function bodyVertsIn(R, frameW) {   // the visible body (bind) in a frame given as a world-at-bind matrix
  R._body ??= vertsOf(R, n => !/^(hand|thumb|index|middle|ring|pinky|lowerarm|upperarm)/.test(n)).map(o => o.v);
  const inv = frameW.clone().invert(); return R._body.map(v => v.clone().applyMatrix4(inv));
}
function anchorBind(R, h) { const bn = ANCHOR_BONE[h.useDef.anchor], Bw = R.bindW(bn).clone(), s = V3().setFromMatrixColumn(Bw, 0).length(); Bw.scale(V3(1 / s, 1 / s, 1 / s)); return { Bw, s }; }
const metresPerBind = R => R.sides.r.u / (V3().setFromMatrixColumn(R.bindW('hand_r'), 0).length() || 1);
function clearBody(R, h, H, dir) {
  const fr = h.anchorBind, mpb = metresPerBind(R);
  const pts = bodyVertsIn(R, fr).map(p => p.multiplyScalar(mpb));   // the body in anchor-metric
  h.useLocal = h.useLocal.clone(); let pushed = 0;
  for (let it = 0; it < 40; it++) {
    const parts = propTris(h.prop, h.useLocal); let worst = -1;
    for (const p of pts) { if (!parts.some(P => P.box.distanceToPoint(p) < .016)) continue; const d = signedDist(parts, p, .03); worst = Math.max(worst, .015 - d); }
    if (worst <= 0) break; const st = Math.min(.05, worst + .002); h.useLocal.premultiply(new THREE.Matrix4().makeTranslation(dir.x * st, dir.y * st, dir.z * st)); pushed += st;
  }
  h.pushed = pushed;
}
// phone / handset at the ear, cup / mic at the mouth: the head's own surface sets the frame (computed in use space)
function earFrame(R, h, H) {
  const U = h.useDef, { Bw } = anchorBind(R, h), fr = Bw.clone().multiply(h.anchorLocal), sg = sgnOf(h), mpb = metresPerBind(R), fi = fr.clone().invert();
  const head = vertsOf(R, n => /^(Head|neck_01)$/.test(n)).map(o => o.v.clone().applyMatrix4(fi).multiplyScalar(mpb));   // anchor-metric (x left, y up, z fwd)
  const hs = head.map(p => useV(p, sg));                                                                            // use space (s, u, f)
  let P, y, z;
  if (U.ear) {
    // the ear: the head's widest point on the holding side around ear height; the phone's top there, its bottom toward the mouth
    let best = null; for (const p of hs) if (p.y > .02 && p.y < .12 && Math.abs(p.z) < .04 && (!best || p.x > best.x)) best = p;
    const ear = best ?? V3(.085, .06, 0), mouth = V3(.03, -.03, .085);
    y = V3(-1, 0, .12).normalize();                                   // the screen (+Y) faces the cheek
    z = mouth.clone().sub(ear); z.addScaledVector(y, -z.dot(y)).normalize();   // phone top -> bottom = +Z
    P = ear.clone().add(V3(.006, 0, .012));
  } else { y = asV(U.y); z = asV(U.z); P = V3(0, -.03, .095).add(asV(U.pos).multiplyScalar(.3)); }
  h.useLocal = useFrame(P, y, z, sg); if (h.flip) h.useLocal.multiply(FLIP_Y); atUsePoint(h, useV(P, sg), h.tip);
  // clear: the prop AND the hand around it (palm + posed fingers, from the solve) at least 2 mm off the head
  const handPts = handPointsInProp(H, h.sol);
  const dir = U.ear ? V3(sg, 0, 0) : V3(0, 0, 1); let pushed = 0;
  for (let it = 0; it < 60; it++) {
    const parts = propTris(h.prop, h.useLocal), hp = handPts.map(p => p.clone().applyMatrix4(h.useLocal));
    let worst = -1; for (const p of head) { if (!parts.some(Q => Q.box.distanceToPoint(p) < .006)) continue; worst = Math.max(worst, .002 - signedDist(parts, p, .01)); }
    const hb = new THREE.Box3().setFromPoints(hp).expandByScalar(.004);
    for (const p of head) { if (!hb.containsPoint(p)) continue; for (const q of hp) { const d = q.distanceTo(p); if (d < .004) worst = Math.max(worst, .004 - d); } }
    if (worst <= 0) break; const st = Math.min(.02, worst + .001); h.useLocal.premultiply(new THREE.Matrix4().makeTranslation(dir.x * st, dir.y * st, dir.z * st)); pushed += st;
  }
  h.pushed = pushed;
}
function handPointsInProp(H, sol) {   // the posed hand's visible vertices in prop-local metres (rigid with the prop while held)
  const Xi = sol.X.clone().invert(), out = [], Mp = {}, Mi = {};
  for (const fn in H.chains) { const ch = H.chains[fn], a = sol.angles[fn]; if (!a) continue; Mp[fn] = fk(ch, a.ang, a.opp, a.spread).M; Mi[fn] = ch.Mb.map(m => m.clone().invert()); }
  for (let i = 0; i < H.verts.length; i += 2) { const o = H.verts[i], p = V3(), q = V3(); let ws = 0;
    for (const [b, w] of o.fw) { q.copy(o.h); if (b && Mp[b[0]]) q.applyMatrix4(Mi[b[0]][b[1]]).applyMatrix4(Mp[b[0]][b[1]]); p.addScaledVector(q, w); ws += w; }
    out.push(p.multiplyScalar(1 / ws).applyMatrix4(Xi)); }
  return out;
}
function updateHold(h, t, R) {
  const H = R.sides[h.side], P = phases(h, t), prop = h.prop, U = h.useDef;
  // the prop's world pose at rest (before pick-up / after put-down) - unless another hold of it holds it now (a handover)
  if (!P.held) {
    const owner = ownerOf(h);
    if (!owner) { if (h.parent0 && prop.parent !== h.parent0) h.parent0.add(prop);
      const pi = h.parent0 ? h.parent0.matrixWorld.clone().invert() : new THREE.Matrix4(); prop.matrix.copy(pi.multiply(h.rest)); prop.matrix.decompose(prop.position, prop.quaternion, prop.scale); prop.updateMatrixWorld(true); prop.userData.heldNow = false; }
    h.reachRest = 0; h.lean = 0; h.atRest = false; h.regrip = null;
    if (P.grab > 0) { const target = h.rest.clone().multiply(h.pick?.T1 ?? h.T1), cur = palmWorld(H), T = reachFrame(cur, target, P.toRest, chestVia(R, H)); h.lean = leanToward(R, H, target, P.toRest); const rr = armTo(H, T, poleFor(R, H), P.toRest); if (P.toRest > .999) h.reachRest = rr; setFingers(H, h.pick?.sol ?? h.sol, P.grab);
      if (h.second) { const H2 = h.second.H, c2 = palmWorld(H2), T2 = reachFrame(c2, h.rest.clone().multiply(h.second.T), P.toRest, chestVia(R, H2)); const r2 = armTo(H2, T2, poleFor(R, H2), P.toRest); if (P.toRest > .999) h.reachRest = Math.max(h.reachRest, r2); setFingers(H2, h.second.sol, P.grab); } }
    return;
  }
  // a fixed prop (a steering wheel): it stays where it is, both hands go to it
  if (U.anchor === 'scene') {
    if (h.parent0 && prop.parent !== h.parent0) h.parent0.add(prop);
    const pi = h.parent0 ? h.parent0.matrixWorld.clone().invert() : new THREE.Matrix4(); prop.matrix.copy(pi.multiply(h.rest)); prop.matrix.decompose(prop.position, prop.quaternion, prop.scale); prop.updateMatrixWorld(true);
    const cur = palmWorld(H), T = h.rest.clone().multiply(h.T1); h.reach = armTo(H, P.toUse < 1 && P.fromRest ? lerpFrame(cur, T, P.toUse) : T, poleFor(R, H)); setFingers(H, h.sol, 1);
    if (h.second) { const H2 = h.second.H, c2 = palmWorld(H2), T2 = h.rest.clone().multiply(h.second.T); h.reach2 = armTo(H2, P.toUse < 1 && P.fromRest ? lerpFrame(c2, T2, P.toUse) : T2, poleFor(R, H2)); setFingers(H2, h.second.sol, 1); }
    prop.userData.heldNow = true; return;
  }
  // held AT REST (the moment of the grab, a dwell, a handover's exchange): the prop stays exactly where it rests and the
  // hands are on it - two holds of one prop both at rest agree on its pose (no order dependence, no pop at the switch)
  if (P.fromRest && P.toUse <= 1e-6) {
    if (h.parent0 && prop.parent !== h.parent0) h.parent0.add(prop);
    const pi = h.parent0 ? h.parent0.matrixWorld.clone().invert() : new THREE.Matrix4(); prop.matrix.copy(pi.multiply(h.rest)); prop.matrix.decompose(prop.position, prop.quaternion, prop.scale); prop.updateMatrixWorld(true);
    const T = h.rest.clone().multiply(h.pick?.T1 ?? h.T1); h.lean = leanToward(R, H, T); h.reach = armTo(H, T, poleFor(R, H)); setFingers(H, h.pick?.sol ?? h.sol, 1);
    if (h.second) { const H2 = h.second.H; h.reach2 = armTo(H2, h.rest.clone().multiply(h.second.T), poleFor(R, H2)); setFingers(H2, h.second.sol, 1); }
    h.reachRest = Math.max(h.reach, h.reach2 ?? 0); h.atRest = true; prop.userData.heldNow = true; return;
  }
  // held: the prop rides the hand; the hand goes to the use frame (IK) or stays with the clip
  h.atRest = false; if (prop.parent !== H.hand) H.hand.add(prop);
  const rg = h.pick && P.fromRest && P.toUse < 1 ? smoother(clamp((P.toUse - .1) / .8)) : null; h.regrip = rg;   // (the regrip weight: 0 pick .. 1 use)
  // (mid-regrip the prop also moves 3 cm out of the palm: the blend of the two grips passed the handset through the palm, 12 mm)
  const rgM = rg == null ? null : lerpFrame(h.pick.local, h.local, rg); if (rgM) { const d = .03 * Math.sin(Math.PI * rg) / H.u; rgM.premultiply(new THREE.Matrix4().makeTranslation(H.N.x * d, H.N.y * d, H.N.z * d)); rgM.scale(V3(1 / H.u, 1 / H.u, 1 / H.u)); }
  prop.matrix.copy(rg == null ? h.local : rgM); prop.matrix.decompose(prop.position, prop.quaternion, prop.scale); prop.userData.heldNow = true;
  let target = null;
  if (U.anchor === 'scene') target = h.rest.clone().multiply(h.T1);
  else if (h.useLocal) { const Tp = anchorWorld(R, h).multiply(h.useLocal), kd = U.lift ? R.f.fwd().setY(0).normalize().add(V3(0, U.lift, 0)).normalize() : null;
    if (U.anchor !== 'head') { keepOut(R, h, Tp, kd); if (fitReach(R, h, Tp)) keepOut(R, h, Tp, kd); liftOverSolids(R, h, Tp); } target = Tp.multiply(h.T1); }
  // a hanging prop picked up / put down: the lift ends (and the put-down starts) exactly in the settled hang pose (straight,
  // off the legs, above the floor) - the hand popped 4-10 cm the frame the hang solve took over (charstress handdoc)
  const lifting = P.fromRest && P.toUse < 1; let hangEnd = null;
  if (U.hang && lifting && !target) { settleHang(); hangEnd = palmWorld(H); }
  const cur = palmWorld(H);
  if (lifting) { const restT = h.rest.clone().multiply(h.pick?.T1 ?? h.T1); target = liftFrame(restT, target ?? hangEnd ?? cur, P.toUse, h); }
  if (target) { const T = h.weight < 1 ? lerpFrame(cur, target, h.weight) : target; if (P.fromRest && P.toUse < 1) h.lean = leanToward(R, H, h.rest.clone().multiply(h.pick?.T1 ?? h.T1), 1 - P.toUse); h.reach = armTo(H, T, poleFor(R, H, U.ear ? 'ear' : U.mouth ? 'mouth' : null), h.weight); }
  if (U.hang && !lifting) settleHang();
  function settleHang() { hangStraight(h, H); { // a bag at the side: never into the legs - the arm swings it out sideways
      prop.updateMatrixWorld(true); const Tp = prop.matrixWorld.clone(), sc = V3().setFromMatrixColumn(Tp, 0).length(); Tp.scale(V3(1 / sc, 1 / sc, 1 / sc));
      const out = V3().crossVectors(V3(0, 1, 0), R.f.fwd()).multiplyScalar(h.side === 'l' ? 1 : -1).normalize();
      for (let it = 0; it < 3; it++) { if (it) { prop.updateMatrixWorld(true); Tp.copy(prop.matrixWorld); Tp.scale(V3(1 / sc, 1 / sc, 1 / sc)); } keepOut(R, h, Tp.clone(), out, 1.5); if (!(h.kept > 0)) break; const T = palmWorld(H), S = H.up.getWorldPosition(V3()), p = V3().setFromMatrixPosition(T), r = p.distanceTo(S), ax = R.f.fwd().multiplyScalar(h.side === 'l' ? -1 : 1);
        // (the 1.5 cm clearance fades in over 3 cm of depth and the depth counts at most 1.5x a vertex's depth in the 1 cm-grown
        // box: a fixed margin, then a steep one, popped a walker's bag / briefcase 1.5-2.3 cm the frame a thigh touched it)
        const ang = Math.asin(clamp((h.kept + .015 * smoother(h.kept / .03)) / Math.max(.2, r), 0, .8)), q = new THREE.Quaternion().setFromAxisAngle(ax, ang), np = p.clone().sub(S).applyQuaternion(q).add(S);
        if (np.clone().sub(p).dot(out) < 0) { q.setFromAxisAngle(ax, -ang); np.copy(p).sub(S).applyQuaternion(q).add(S); }
        T.setPosition(np); h.reach = armTo(H, T, null); hangStraight(h, H); }
      prop.updateMatrixWorld(true); const low = new THREE.Box3().setFromObject(prop).min.y, fy = R.f.group.getWorldPosition(V3()).y + .012;
      if (low < fy) { const T = palmWorld(H); T.premultiply(new THREE.Matrix4().makeTranslation(0, fy - low, 0)); h.reach = armTo(H, T, null); hangStraight(h, H); } } }
  prop.updateMatrixWorld(true);
  // the regrip: the fingers ease open half way (the prop turns in a loose hand) and close again in the use grip - blending
  // the two grips straight drove the thumb 15 mm through the handset mid-turn (charstress deskcall)
  if (rg != null) { if (rg < .5) { setFingers(H, h.pick.sol, 1); setFingers(H, openSol(H), .85 * smoother(rg / .5)); } else { setFingers(H, openSol(H), .85); setFingers(H, h.sol, smoother((rg - .5) / .5)); } }
  else setFingers(H, h.sol, 1);
  prop.updateMatrixWorld(true);
  if (h.second) { const H2 = h.second.H, T = prop.matrixWorld.clone(); const sc = V3().setFromMatrixColumn(T, 0).length(); T.scale(V3(1 / sc, 1 / sc, 1 / sc));
    h.reach2 = armTo(H2, T.multiply(h.second.T), poleFor(R, H2)); setFingers(H2, h.second.sol, 1); }
}
// (open: the hammer of a talking woman turned 17 deg in 1/60 s when a gesture lifted it toward upside down - the minimal
// rotation's axis is undefined near 180 deg. A cap / fade of this turn broke walking canes, running bags and the bat's
// carry (they need 150-180 deg from the grip): reverted, charstress b5 - fix it per grip, not here)
function hangStraight(h, H) {   // turn the hand about the grip so the prop's +Y points up (a bag hangs, a cane points down)
  const prop = h.prop; prop.updateMatrixWorld(true); const yW = h.up.clone().transformDirection(prop.matrixWorld), q = new THREE.Quaternion().setFromUnitVectors(yW, V3(0, 1, 0));
  const pivot = V3().setFromMatrixPosition(prop.matrixWorld.clone().multiply(h.T1)), hq = worldQ(H.hand).premultiply(q), hp = H.hand.getWorldPosition(V3());
  setWorldQ(H.hand, hq); const np = H.hand.getWorldPosition(V3()); void hp; void np; void pivot;
}

// =====================================================================================================================
// THE HOLD CHECK: measured on the real meshes at the current frame
// =====================================================================================================================
function skinnedWorld(o, out) { out.copy(o.mesh.geometry.attributes.position ? out.fromBufferAttribute(o.mesh.geometry.attributes.position, o.i) : out); o.mesh.applyBoneTransform(o.i, out); return out.applyMatrix4(o.mesh.matrixWorld); }
/** holdIssues(f, prop?) -> [{ type: 'HOLD', detail }] for the figure's holds (or the one of that prop) at the current pose */
export function holdIssues(f, prop) {
  const out = [], list = f?._handsHook || []; if (!list.length) return out; const R = rigOf(f), say = d => out.push({ type: 'HOLD', detail: d });
  for (const m of R.skins) m.skeleton.update();
  f.group.updateMatrixWorld(true);
  for (const h of list) { if (h.kind === 'rest' || (prop && h.prop !== prop)) continue; const t = f._ht ?? 0, P = phases(h, t); if (!P.held) continue;
    const r = measureHold(h, R); h.report = r; const nm = h.name;
    if (r.handIn > .001) say(`${nm}: the ${r.handInWhere} is ${(r.handIn * 1000).toFixed(1)} mm inside the ${h.kind}`);
    if (r.bodyIn > .002) say(`${nm}: the ${h.kind} passes ${(r.bodyIn * 1000).toFixed(0)} mm into the body (${r.bodyWhere})`);
    const turning = !!h.pick && h.regrip != null;   // (during a pick-up's lift the prop turns in the fingers: no air / palm judgement)
    if (r.palmGap > .005 && (POSES[h.sol.pose]?.palm) && !turning && !(h.atRest && h.pick)) say(`${nm}: the ${h.kind} floats ${(r.palmGap * 1000).toFixed(1)} mm off the palm`);
    for (const [fn, g] of Object.entries(r.gaps)) if (g > .003 && !turning && !(h.atRest && h.pick)) say(`${nm}: ${fn} finger ${(g * 1000).toFixed(1)} mm off the ${h.kind} (air)`);
    if (r.wrap && !r.wrap.ok && !turning) say(`${nm}: the fingers do not wrap the ${h.kind} handle (they touch the bar ${r.wrap.touched.length ? 'on its ' + r.wrap.touched.join(' + ') + ' side only' : 'nowhere'}; finger tips ${r.wrap.tip_mm == null ? '?' : Math.abs(r.wrap.tip_mm) + ' mm ' + (r.wrap.tip_mm < 0 ? 'short of' : 'past')} the bar centre): a hook has the palm above the bar, the fingers down its near side, under it and up its far side`);
    if (r.second != null && r.second > .006) say(`${nm}: the second hand is ${(r.second * 1000).toFixed(0)} mm off its grip (out of reach?)`);
    if (h.reach > .005 && !h.atRest) say(`${nm}: the use pose is ${(h.reach * 100).toFixed(1)} cm out of the arm's reach`);
    if (h.fit?.short > .005) say(`${nm}: the handover's exchange point is ${(h.fit.short * 100).toFixed(1)} cm out of reach for one of the two: stand them closer (about 0.9 m apart for a two-hand prop)`);
    if (h.reachRest > .005) say(`${nm}: at pick-up / put-down (t0 / t1) the hand is ${(h.reachRest * 100).toFixed(1)} cm short of the prop where it rests - it would pop into the hand: seat the person, put the prop nearer or on a higher surface (a standing mannequin reaches about 1 m high surfaces, it cannot bend down)`);
    if (r.scene) say(`${nm}: the ${h.kind} passes through "${r.scene}"`);
    if (r.handScene) say(`${nm}: the ${r.handSceneSide === 'l' ? 'left' : 'right'} hand is ${(r.handSceneDepth * 1000).toFixed(0)} mm inside "${r.handScene}"`);
    if (h.pair && Math.abs((h.f._ht ?? 0) - (h.pair.f._ht ?? 0)) > 1e-3) say(`${nm}: handover with ${h.pair.f.name}: the two run on different clocks (${(h.f._ht ?? 0).toFixed(2)} s vs ${(h.pair.f._ht ?? 0).toFixed(2)} s): drive both with the scene time (offset a clip with sequence steps' start, never with t + x)`);
    if (r.ear != null && r.ear > .035 && !(P.fromRest && P.toUse < .99)) say(`${nm}: the phone is ${(r.ear * 100).toFixed(1)} cm from the ear`);
    if (!isVerified(h, f.clip)) say(`${nm}: grip "${h.grip}" with the clip "${f.clip}" is not in the VERIFIED table: render it in handtest (references/hands.md) before use`);
  }
  return out;
}
function measureHold(h, R) {
  const prop = h.prop; prop.updateMatrixWorld(true); const inv = prop.matrixWorld.clone().invert(), sc = V3().setFromMatrixColumn(prop.matrixWorld, 0).length();
  const parts = propTris(prop, new THREE.Matrix4().makeScale(sc, sc, sc)), box = new THREE.Box3(); for (const P of parts) box.union(P.box);
  const big = box.clone().expandByScalar(.03), v = V3(), r = { handIn: 0, handInWhere: '', bodyIn: 0, bodyWhere: '', palmGap: 0, gaps: {}, second: null, scene: null, ear: null };
  const toLocal = p => p.applyMatrix4(inv).multiplyScalar(sc);
  // 1. every visible vertex (hands, arms, body) inside the prop
  R._all ??= vertsOf(R, () => true);
  const wc = new THREE.Box3().setFromObject(prop), cen = wc.getCenter(V3()), rad = wc.getSize(V3()).length() / 2 + .45, nearB = new Map();   // only bones near the prop
  for (const o of R._all) { let ok = nearB.get(o.bone); if (ok == null) { ok = (R.f.bone(o.bone)?.getWorldPosition(V3()).distanceTo(cen) ?? 0) < rad; nearB.set(o.bone, ok); } if (!ok) continue;
    skinnedWorld(o, v); toLocal(v); if (!big.containsPoint(v)) continue; for (const P of parts) if (insidePart(P, v)) { const d = surfDist([P], v, .1);
      const isHand = /^(hand|thumb|index|middle|ring|pinky)/.test(o.bone) || o.ws.some(([n, w]) => w > .25 && /^(hand|thumb|index|middle|ring|pinky)/.test(n)); if (isHand) { if (d > r.handIn) { r.handIn = d; r.handInWhere = o.bone; r.handV = o; } } else if (d > r.bodyIn) { r.bodyIn = d; r.bodyWhere = o.bone; r.bodyAt = v.toArray().map(x => +x.toFixed(3)); r.bodyV = o; } break; } }
  // 2. the palm gap and the contact fingers' air gaps
  const sides = [[R.sides[h.side], h.sol]]; if (h.second) sides.push([h.second.H, h.second.sol]);
  for (const [H, sol] of sides) { if (H === R.sides[h.side]) { const pc = V3().setFromMatrixPosition(H.palm); let pg = 1;   // the object rests on the hand: its nearest hand vertex
      for (let i = 0; i < H.verts.length; i += 2) { const o = H.verts[i]; if (o.h.distanceTo(pc) > .09) continue; skinnedWorld(o, v); toLocal(v); pg = Math.min(pg, surfDist(parts, v, .1)); } r.palmGap = pg; }
    for (const fn of sol.contact || []) { const ch = H.chains[fn]; if (!ch) continue; let best = 1;
      for (const o of H.verts) { if (o.bone !== ch.names[2] && o.bone !== ch.names[1]) continue; skinnedWorld(o, v); toLocal(v); best = Math.min(best, surfDist(parts, v, .05)); }
      r.gaps[(H.s === 'l' ? 'left ' : 'right ') + fn] = best; } }
  if (h.second) { const pw = palmWorld(h.second.H), T = prop.matrixWorld.clone(); T.scale(V3(1 / sc, 1 / sc, 1 / sc)); T.multiply(h.second.T); r.second = V3().setFromMatrixPosition(pw).distanceTo(V3().setFromMatrixPosition(T)); }
  // 2b. a handle (grip with a bar): the fingers WRAP the bar - they touch it on the palm's side, under it and on its far side
  // (index / middle / ring), the tips past its centre. Fingers lying on a briefcase's face over the handle measured "clean".
  if (h.bar) { const H = R.sides[h.side], A = h.bar.a.clone().multiplyScalar(sc), B = h.bar.b.clone().multiplyScalar(sc), L = A.distanceTo(B), ax = B.clone().sub(A).normalize(), rr = h.bar.r * sc;
    const nP = V3().setFromMatrixColumn(h.T1, 2), dP = V3().setFromMatrixColumn(h.T1, 1);   // palm normal (into the prop) and finger direction, prop-local
    nP.addScaledVector(ax, -nP.dot(ax)).normalize(); dP.addScaledVector(ax, -dP.dot(ax)).addScaledVector(nP, -dP.dot(nP)).normalize();
    const touch = { near: false, under: false, far: false, over: false }; let tip = Infinity;
    for (const fn of ['index', 'middle', 'ring']) { const ch = H.chains[fn]; if (!ch) continue; let ft = -Infinity;
      for (const o of H.verts) { const k = ch.names.indexOf(o.bone); if (k < 0) continue; skinnedWorld(o, v); toLocal(v); const t = v.clone().sub(A).dot(ax);
        if (t < -.004 || t > L + .004) continue; const off = v.clone().sub(A.clone().addScaledVector(ax, clamp(t, 0, L))), x = off.dot(nP), y = off.dot(dP);
        if (k === 2) ft = Math.max(ft, x);
        if (Math.hypot(x, y) > rr + .012 || surfDist(parts, v, .01) > .004) continue;   // touching the bar (not the case under it)
        const a = Math.atan2(y, -x) * 180 / Math.PI; touch[Math.abs(a) < 45 ? 'near' : Math.abs(a) > 135 ? 'far' : a > 0 ? 'under' : 'over'] = true; }
      tip = Math.min(tip, ft); }
    // wrapped: under the bar AND round it (touching its far side, or every finger tip at least 2 mm past the bar's centre)
    r.wrap = { ok: touch.under && (touch.far || tip >= .002), touched: Object.keys(touch).filter(k => touch[k]), tip_mm: isFinite(tip) ? +(tip * 1000).toFixed(1) : null }; }
  // 3. through other scene objects (closed solid meshes whose box meets the prop's)
  const scene = (() => { let s = prop; while (s.parent) s = s.parent; return s; })(), wbox = new THREE.Box3().setFromObject(prop).expandByScalar(-.002);
  const samples = []; for (const P of parts) for (let o = 0; o < P.tri.length; o += 9 * 7) samples.push(V3(P.tri[o], P.tri[o + 1], P.tri[o + 2]).multiplyScalar(1 / sc).applyMatrix4(prop.matrixWorld));
  scene.traverse(m => { if (r.scene || !m.isMesh || m.isSkinnedMesh || !m.visible || m.userData.noContact) return; for (let p = m; p; p = p.parent) if (p === prop || p === h.f.group) return;
    const g = m.geometry; if (!g?.attributes?.position || /Plane|Tube/.test(g.type)) return; if (!g.boundingBox) g.computeBoundingBox(); const mb = g.boundingBox.clone().applyMatrix4(m.matrixWorld); if (!mb.intersectsBox(wbox)) return;
    if (mb.getSize(V3()).length() > 30) return;   // environment (floors) are judged by the floor test below
    const solid = [{ tri: triArray(m), n: 0, box: mb, closed: true }];
    for (const p of samples) if (insidePart(solid[0], p)) { r.scene = m.name || m.parent?.name || 'object'; break; } });
  // the floor (y = the figure's ground): nothing held goes below it
  const fy = h.f.group.getWorldPosition(V3()).y; if (!r.scene && new THREE.Box3().setFromObject(prop).min.y < fy - .003) r.scene = 'the floor';
  // 4. the holding hands inside other scene solids (fingers through the table or the cradle at a pick-up, a hand in a wall)
  const hs = handsInScene(R, [h.side, h.second?.side].filter(Boolean), prop); if (hs) { r.handScene = hs.name; r.handSceneDepth = hs.depth; r.handSceneSide = hs.side; }
  // the ear: the phone's ear point (its tip) to the drawn head's surface (a fixed 12 cm head radius read 4.7 cm "from the
  // ear" on an uploaded character's bigger head, charstress custom)
  if (h.useDef.ear) { R._headV ??= vertsOf(R, n => n === 'Head').filter((o, i) => i % 3 === 0); const tp = h.tip.clone().multiplyScalar(1 / sc).applyMatrix4(prop.matrixWorld); let best = 1;
    for (const o of R._headV) best = Math.min(best, skinnedWorld(o, v).distanceTo(tp)); r.ear = R._headV.length ? best : Math.max(0, V3().setFromMatrixPosition(prop.matrixWorld).distanceTo(R.f.bone('Head').getWorldPosition(V3())) - .12); }
  return r;
}
// the deepest visible hand vertex (sides 'l' / 'r') inside a closed solid of the scene (not the figure, not `skip`, not
// noContact things, not environment-sized meshes or planes) -> { name, depth, side } | null
function handsInScene(R, sides, skip) {
  const f = R.f, hv = [], hb = new THREE.Box3(); let scene = f.group; while (scene.parent) scene = scene.parent;
  for (const s of sides) { const H = R.sides[s]; for (let i = 0; i < H.verts.length; i += 3) { const p = skinnedWorld(H.verts[i], V3()); p.s = s; hv.push(p); hb.expandByPoint(p); } }
  if (!hv.length) return null; let best = null;
  scene.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || !m.visible || m.userData.noContact || m.userData.noHold) return;
    for (let p = m; p; p = p.parent) { if (p === skip || p === f.group || p.userData?.noContact || p.visible === false) return; }
    const g = m.geometry; if (!g?.attributes?.position || /Plane|Tube|Shape|Ring|Circle|Edges|Line/.test(g.type) || m.userData.open) return;
    if ([].concat(m.material).some(x => x?.transparent && (x.opacity ?? 1) < .6)) return;
    if (!g.boundingBox) g.computeBoundingBox(); const mb = g.boundingBox.clone().applyMatrix4(m.matrixWorld); if (!mb.intersectsBox(hb) || mb.getSize(V3()).length() > 12) return;
    let solid = null;
    for (const p of hv) { if (!mb.containsPoint(p)) continue; solid ??= { tri: triArray(m), n: 0, box: mb, closed: true }; if (!insidePart(solid, p)) continue;
      const d = surfDist([solid], p, .05); if (d > .002 && (!best || d > best.depth)) best = { name: m.name || m.parent?.name || 'object', depth: d, side: p.s }; } });
  return best;
}
function triArray(m) { const g = m.geometry, pa = g.attributes.position, ix = g.index, n = ix ? ix.count : pa.count, T = new Float32Array(n * 3), v = V3();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(pa, ix ? ix.getX(i) : i).applyMatrix4(m.matrixWorld); T[i * 3] = v.x; T[i * 3 + 1] = v.y; T[i * 3 + 2] = v.z; } return T; }

// =====================================================================================================================
// VERIFIED: kind x grip -> the clips rendered close up in handtest (3 angles x several times) and found clean. hands.md
// has the SOP to add a row. holdIssues warns on anything else.
// =====================================================================================================================
// (generated by stories/handtest/verified.py from the final runs of both bodies; per body and hand the clips: I Idle_Loop
// (act 'stand'), W Walk_Loop ('walk'), T Idle_Talking_Loop ('talk'), A Sitting_Idle_Loop ('sit'), S KK_Sit_Chair_Idle_Loop
// ('sitChair'), then full clip names)
export const VERIFIED = {
  'baseball bat|carry': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWTAS' } },
  'baseball bat|two': { male: { R: 'IWTAS' }, female: { R: 'IWTAS' } },
  'book|carry': { male: { L: 'IWTAS', R: 'IWTS' }, female: { L: 'IWTAS', R: 'IWTS' } },
  'briefcase|handle': { male: { L: 'IWT Jog_Fwd_Loop Sprint_Loop', R: 'IWT Jog_Fwd_Loop Sprint_Loop' }, female: { L: 'IWT Jog_Fwd_Loop Sprint_Loop', R: 'IWT Jog_Fwd_Loop Sprint_Loop' } },   // (hook re-verified 2026-10-16; seated: put it down)
  'broom|two': { male: { R: 'IWT' }, female: { R: 'IWT' } },
  'cane|handle': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWTAS' } },
  'can|wrap': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWTAS' } },
  'cardboard box|carry': { male: { R: 'IWTAS Walk_Carry_Loop' }, female: { R: 'IWTAS Walk_Carry_Loop' } },
  'crate|carry': { male: { R: 'IWTAS Walk_Carry_Loop' }, female: { R: 'IWTAS Walk_Carry_Loop' } },
  'flashlight|aim': { male: { L: 'IWTAS Idle_Torch_Loop', R: 'IWTAS Idle_Torch_Loop' }, female: { L: 'IWTAS Idle_Torch_Loop', R: 'IWTAS Idle_Torch_Loop' } },
  'folder|carry': { male: { L: 'IWTAS', R: 'IWTS' }, female: { L: 'IWTAS', R: 'IWTS' } },
  'folder|read': { male: { R: 'IWTAS' }, female: { R: 'IWTAS' } },
  'glass|wrap': { male: { L: 'IWTAS', R: 'IWTAS' } },
  'hammer|handle': { male: { R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWTAS' } },
  'id card|show': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWTAS' } },
  'laptop|carry': { male: { L: 'IWTAS', R: 'IWTS' }, female: { L: 'IWTAS', R: 'IWTS' } },
  'microphone|hold': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWTAS' } },
  'mug|wrap': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWAS' } },
  'newspaper|carry': { male: { L: 'IWTAS', R: 'IWTS' }, female: { L: 'IWTAS', R: 'IWTS' } },
  'newspaper|read': { male: { R: 'IWTAS' }, female: { R: 'IWTAS' } },
  'open book|read': { male: { R: 'IWTAS' }, female: { R: 'IWTAS' } },
  'papers|carry': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWTS' } },
  'papers|read': { male: { R: 'IWTAS' }, female: { R: 'IWTAS' } },
  'phone handset|ear': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWTAS' } },
  'placard|two': { male: { R: 'IWS' }, female: { R: 'IWTAS' } },
  'shopping bag|handle': { male: { L: 'IWT Jog_Fwd_Loop Sprint_Loop', R: 'IWT Jog_Fwd_Loop Sprint_Loop' }, female: { L: 'IWT Jog_Fwd_Loop Sprint_Loop', R: 'IWT Jog_Fwd_Loop Sprint_Loop' } },   // (hook re-verified 2026-10-16; seated: put it down)
  'smartphone|ear': { male: { L: 'IWTAS Idle_TalkingPhone_Loop', R: 'IWTAS Idle_TalkingPhone_Loop' }, female: { L: 'IWTAS Idle_TalkingPhone_Loop', R: 'IWTAS Idle_TalkingPhone_Loop' } },
  'smartphone|film': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWTAS' } },
  'smartphone|look': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWAS' } },
  'staff|two': { male: { R: 'IWT' }, female: { R: 'IWT' } },
  'steering wheel|drive': { male: { R: ' Driving_Loop' }, female: { R: ' Driving_Loop' } },
  'tablet|look': { male: { L: 'IWTAS', R: 'IWAS' }, female: { L: 'IWAS', R: 'IWAS' } },
  'tablet|read': { male: { R: 'IWTAS' }, female: { R: 'IWTAS' } },
  'tray|two': { male: { R: 'IWTAS' }, female: { R: 'IWTAS' } },
  'umbrella|handle': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWTAS' } },
  'water bottle|wrap': { male: { L: 'IWTAS', R: 'IWTAS' }, female: { L: 'IWTAS', R: 'IWTAS' } },
};
const CLIP_SHORT = { I: 'Idle_Loop', W: 'Walk_Loop', T: 'Idle_Talking_Loop', A: 'Sitting_Idle_Loop', S: 'KK_Sit_Chair_Idle_Loop' };
/** isVerified(hold, clip): that kind x grip x body x hand x clip was rendered and found clean in handtest */
export function isVerified(h, clip) {
  const row = VERIFIED[`${h.kind}|${h.grip}`], body = /^f/i.test(String(h.f.figure?.body ?? 'male')) ? 'female' : 'male', s = row?.[body]?.[h.side.toUpperCase()];
  if (s == null) return false; const [short, ...full] = s.split(' '), c = String(clip || ''); return [...short].some(k => CLIP_SHORT[k] === c) || full.includes(c);
}
export const holds = () => [...HOLDS];

// =====================================================================================================================
// REST: hands that work ON a surface (typing on a keyboard, writing on a desk, a hand flat on a counter): every frame after
// the clip each hand comes down onto the surface right under it (the clip's hand orientation and finger motion kept) and
// never goes into it. rest(f, keyboard) once in build(), like hold(); the HOLD check says when a hand hovers or sinks.
// =====================================================================================================================
const RESTS = new Set(), _rcR = new THREE.Raycaster(), DOWN = V3(0, -1, 0);
// surface: one object or a list (rest() passes the surface AND what it stands on: a keyboard and its desk - the heel of the
// hand came down 15 mm into the desk top in front of the keyboard, charstress office)
function restGap(H, surface) {   // the lowest hand vertex's height over the surface under it (null: the hand is not over it)
  H._restSamp ??= H.verts.filter((o, i) => /^(index|middle|ring|pinky|thumb)_0[23]_/.test(o.bone) ? i % 2 === 0 : o.bone.startsWith('hand_') && i % 9 === 0);
  let best = null; const v = V3(), list = Array.isArray(surface) ? surface : [surface];
  for (const o of H._restSamp) { skinnedWorld(o, v); _rcR.set(v.clone().add(V3(0, .25, 0)), DOWN); _rcR.far = .6; const hit = _rcR.intersectObjects(list, true).find(x => x.object.visible !== false && !x.object.userData?.noHold); if (!hit) continue;
    const g = v.y - hit.point.y; if (g < -.03) continue; if (best == null || g < best) best = g; }   // (a vertex far under the top: the hand is not on it)
  return best;
}
/** rest(f, surface, { sides 'LR' | 'L' | 'R', clearance (m, 2 mm), max (m the hand may come down, .25), t0?, t1? }) -> r
 *  (r.release(), r.gap = { l, r } after a frame) */
export function rest(f, surface, o = {}) {
  if (!f?.bone || !f.apply) throw new Error('rest: needs a figure from figure()'); if (!surface?.isObject3D) throw new Error('rest: needs the surface (a prop or mesh)');
  rigOf(f); const list = hookFigure(f), sides = [...String(o.sides ?? 'LR')].map(sideOf), sup = surface.parent?.userData?.prop ? surface.parent : null, on = o.on ?? (sup ? [surface, sup] : [surface]);
  const r = { f, prop: surface, on, kind: 'rest', side: null, sides, t0: o.t0, t1: o.t1, gap: {}, weightAt: () => 0, name: `${f.name}: hands on "${surface.name || surface.userData?.prop?.kind || 'surface'}"` };
  r.update = (t, R) => { let w = 1; if (r.t0 != null) w *= smoother((t - r.t0) / .3); if (r.t1 != null) w *= 1 - smoother((t - r.t1) / .3); r.w = w; if (w <= 0) return;
    surface.updateMatrixWorld(true);
    r.ws = {}; for (const s of sides) { const ws = w * (1 - (r.busy?.[s] ?? 0)); r.ws[s] = ws; if (ws <= 1e-4) { r.gap[s] = null; continue; } const H = R.sides[s]; let moved = 0;
      for (let it = 0; it < 3; it++) { const gap = restGap(H, on); if (gap == null) { r.gap[s] = null; break; } r.gap[s] = gap;
        const d = clamp((gap - (o.clearance ?? .002)) * ws, -.05, (o.max ?? .25) - moved); if (Math.abs(d) < 5e-4) break; moved += d;
        const T = palmWorld(H); T.premultiply(new THREE.Matrix4().makeTranslation(0, -d, 0)); armTo(H, T, null); if (ws < 1) break; } } };
  r.release = () => { const i = list.indexOf(r); if (i >= 0) list.splice(i, 1); RESTS.delete(r); };
  list.push(r); RESTS.add(r); return r;
}
function restIssues(r) {   // measured again on the frame as drawn
  const out = [], R = rigOf(r.f); if ((r.w ?? 1) < .999) return out; for (const m of R.skins) m.skeleton.update();
  for (const s of r.sides) { if ((r.ws?.[s] ?? 1) < .999) continue; const g = restGap(R.sides[s], r.on ?? r.prop); if (g == null) continue; const nm = `${r.name} (${s === 'l' ? 'left' : 'right'} hand)`;   // (a side a hold uses: the HOLD check judges it)
    if (g > .006) out.push({ type: 'HOLD', detail: `${nm}: hovers ${(g * 1000).toFixed(0)} mm above it (beyond the reach of the rest IK?)` });
    if (g < -.002) out.push({ type: 'HOLD', detail: `${nm}: ${(-g * 1000).toFixed(0)} mm into it` }); }
  const hs = handsInScene(R, r.sides, r.prop, r.on); if (hs) out.push({ type: 'HOLD', detail: `${r.name}: the ${hs.side === 'l' ? 'left' : 'right'} hand is ${(hs.depth * 1000).toFixed(0)} mm inside "${hs.name}"` });
  return out;
}
// check_layout: every hold and rest of every figure in the shot
ENG.LAYOUT_CHECKS?.push(S => { const out = [], inShot = f => { for (let p = f.group; p; p = p.parent) if (p === S.scene) return true; return false; };
  for (const h of HOLDS) { if (!inShot(h.f)) continue; if (!out.some(x => x._f === h.f)) for (const q of holdIssues(h.f)) out.push({ ...q, _f: h.f }); }
  for (const r of RESTS) if (inShot(r.f)) for (const q of restIssues(r)) out.push({ ...q, _f: r.f });
  return out.map(({ _f, ...q }) => q); });
export const rests = () => [...RESTS];
export { restIssues };
export const _debug = { rigOf, fk, propTris, signedDist, palmWorld, measureHold, restGap, drawnIn };

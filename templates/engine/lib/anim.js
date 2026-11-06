// People rigs + motion helpers (pixel engine v10+, lib/anim.js in a project). Everything is a pure function of the time:
// an export, a still or a scrub can jump to any t and gets the same frame.
//
//   import { person2, pose, walkTo, attach, followPath, driveCar, flowPackets, countUp, typeOn } from '../lib/anim.js';
//   build(S) { const p = person2({ ramp: 'red', hairStyle: 'long', accessory: 'glasses' }); S.scene.add(p); return { p }; }
//   update(st, t) { walkTo(st.p, [-3, 0], [1, 0], 1, 4.5, { t });        // walks (feet planted), idles before / after
//                   pose(st.p, 'wave', t, { t0: 5, dur: 2 }); }            // a gesture blended in from idle and back out
//
// person2(): an articulated voxel person, ~1.75 m (s scales), facing +Z, its origin on the floor between the feet.
//   rig.joints: hips spine neck head shoulderL/R elbowL/R handL/R gripL/R (palm points) hipL/R kneeL/R ankleL/R.
//   Legs are always solved by IK from foot targets (feet stay where a clip plants them); arms by FK angles or IK.
// pose(rig, clip, t, opts): idle walk run sit typeAtDesk holdPhone point wave shrug celebrate think drive (POSES).
//   opts.t0 (+ dur | t1, blend): the clip fades in from opts.base (idle) at t0 and back out at t0 + dur.
// walkTo(rig, from, to, t0, t1, opts) / walkPath(rig, points, t0, t1, opts): moves the root AND animates the gait. Steps
//   are planned along the path (whole number of steps, feet together at both ends) and driven by the distance travelled,
//   so the planted foot never slides whatever the speed. opts.gait 'walk' | 'run' (auto: run above 2.4 m/s).
// Motion helpers: followPath driveCar spin bob blink flowPackets assemble explode countUp typeOn attach act.
// Functions without a t argument evaluate at opts.t, else the engine's NOW (the frame being drawn).
import { THREE, C, box, clamp, lerp, seg, NOW } from '../engine.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const ss = k => (k = clamp(k), k * k * (3 - 2 * k));
export const smootherstep = k => (k = clamp(k), k * k * k * (k * (k * 6 - 15) + 10));
const qE = (x = 0, y = 0, z = 0, order = 'XYZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, order));
const ONE = V(1, 1, 1);
const nowT = o => (o && o.t != null ? o.t : NOW);
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

// ---------- the body (body space: metres for s = 1, origin on the floor between the feet, facing +Z, left = +X) ----------
export const BODY = { hipY: .92, hipX: .1, thigh: .42, shin: .42, ankle: .08, spineUp: .06, shoulderX: .235, shoulderY: .43,
  upper: .28, fore: .26, neckY: .46, headUp: .06, height: 1.75, stand: .905, toe: [0, -.08, .19] };
const B = BODY;

const OUTFITS = { casual: { sleeves: 'short' }, tee: { sleeves: 'short' }, hoodie: { sleeves: 'long', hood: true, pocket: true },
  suit: { sleeves: 'long', suit: true }, jacket: { sleeves: 'long', jacket: true }, longsleeve: { sleeves: 'long' } };

/**
 * person2({ ramp, skin, hair, hairStyle, outfit, pants, shoes, tie, tee, s, accessory, name, seed })
 *  ramp: clothes (top) RAMP name ('blue'); skin ('skin' | 'skinDark' | any ramp); hair ('hair' | 'brown' | 'gold' | ...);
 *  hairStyle: short | long | bun | buzz | bald | mohawk | afro | ponytail; outfit: casual | hoodie | suit | jacket | longsleeve;
 *  accessory: glasses | sunglasses | cap | headphones | backpack | beard | watch (or an array). s: scale (1 = 1.75 m).
 */
export function person2(o = {}) {
  const s = o.s ?? 1, out = OUTFITS[o.outfit ?? 'casual'] ?? OUTFITS.casual, acc = new Set([o.accessory].flat().filter(Boolean));
  const top = o.ramp ?? (out.suit ? 'dark' : 'blue'), skin = o.skin ?? 'skin', hair = o.hair ?? 'hair';
  const pants = o.pants ?? (out.suit ? top : 'denim'), shoes = o.shoes ?? (out.suit ? 'black' : 'rubber'), sole = out.suit ? shoes : (o.sole ?? 'white');
  const seed = o.seed ?? hash(JSON.stringify({ ...o, accessory: [...acc] }));
  const root = new THREE.Group(); root.isRig = true; root.name = o.name ?? 'person';
  const body = new THREE.Group(); body.scale.setScalar(s); root.add(body);
  const J = {};
  const G = (name, parent, pos) => { const g = new THREE.Group(); g.name = name; g.position.set(...pos); parent.add(g); J[name] = g; return g; };
  const X = (parent, w, h, d, ramp, pos) => { const m = box(w, h, d, ramp, pos); parent.add(m); return m; };
  const dark = [C.bg, C.bg, C.dark];
  // pelvis + torso
  const hips = G('hips', body, [0, B.hipY, 0]);
  X(hips, .34, .17, .2, pants, [0, .045, 0]);
  const spine = G('spine', hips, [0, B.spineUp, 0]);
  X(spine, .36, .46, .22, top, [0, .23, 0]);
  if (out.suit) { X(spine, .1, .17, .02, o.shirt ?? 'white', [0, .365, .115]); X(spine, .036, .22, .02, o.tie ?? 'red', [0, .3, .122]); }
  if (out.jacket) X(spine, .1, .44, .02, o.tee ?? 'white', [0, .22, .115]);
  if (out.hood) X(spine, .26, .1, .07, top, [0, .42, -.135]);
  if (out.pocket) X(spine, .22, .1, .02, top, [0, .09, .115]);
  if (acc.has('backpack')) { X(spine, .3, .36, .14, o.bag ?? 'olive', [0, .24, -.185]); for (const x of [-.11, .11]) X(spine, .04, .3, .02, o.bag ?? 'olive', [x, .27, .117]); }
  // neck + head (face toward +Z)
  const neck = G('neck', spine, [0, B.neckY, 0]);
  X(neck, .09, .08, .09, skin, [0, .03, 0]);
  const head = G('head', neck, [0, B.headUp, 0]);
  X(head, .22, .21, .22, skin, [0, .105, 0]);
  for (const x of [-.05, .05]) { X(head, .035, .04, .02, dark, [x, .11, .115]); X(head, .05, .014, .016, hair, [x, .148, .114]); }
  X(head, .036, .05, .03, skin, [0, .078, .12]);                                  // nose
  X(head, .06, .014, .012, o.lips ?? 'skinDark', [0, .036, .112]);              // mouth
  X(head, .03, .05, .06, skin, [.118, .1, .0]); X(head, .03, .05, .06, skin, [-.118, .1, .0]);   // ears
  const hs = o.hairStyle ?? 'short';
  if (hs !== 'bald') {
    if (hs === 'buzz') X(head, .228, .03, .228, hair, [0, .205, -.004]);
    else if (hs === 'afro') { X(head, .3, .17, .29, hair, [0, .2, -.02]); X(head, .3, .12, .1, hair, [0, .1, -.1]); }
    else if (hs === 'mohawk') { X(head, .228, .02, .228, hair, [0, .207, -.004]); X(head, .05, .07, .22, hair, [0, .245, -.01]); }
    else { X(head, .236, .06, .232, hair, [0, .205, -.01]); X(head, .236, .14, .035, hair, [0, .14, -.122]); X(head, .024, .07, .14, hair, [.12, .16, -.045]); X(head, .024, .07, .14, hair, [-.12, .16, -.045]);
      X(head, .2, .03, .02, hair, [0, .182, .108]);                               // fringe
      if (hs === 'long') { X(head, .25, .3, .05, hair, [0, .03, -.11]); X(head, .03, .2, .13, hair, [.125, .06, -.04]); X(head, .03, .2, .13, hair, [-.125, .06, -.04]); }
      if (hs === 'bun') X(head, .1, .09, .09, hair, [0, .22, -.11]);
      if (hs === 'ponytail') { X(head, .07, .07, .07, hair, [0, .17, -.155]); X(head, .06, .2, .05, hair, [0, .05, -.17]); } }
  }
  if (acc.has('beard')) { X(head, .2, .07, .04, hair, [0, .03, .1]); X(head, .2, .06, .12, hair, [0, .005, .05]); }
  if (acc.has('glasses') || acc.has('sunglasses')) { const g = acc.has('sunglasses') ? 'black' : (o.frames ?? 'black'); X(head, .21, .016, .02, g, [0, .132, .128]);
    for (const x of [-.052, .052]) X(head, .07, .052, .014, acc.has('sunglasses') ? 'black' : 'glass', [x, .108, .131]); }
  if (acc.has('cap')) { X(head, .24, .07, .24, o.capRamp ?? 'red', [0, .225, -.008]); X(head, .2, .02, .12, o.capRamp ?? 'red', [0, .2, .16]); }
  if (acc.has('headphones')) { X(head, .26, .03, .05, 'black', [0, .245, 0]); for (const x of [-.128, .128]) X(head, .04, .09, .08, 'black', [x, .11, 0]); }
  // arms (left = +X): shoulder -> elbow -> hand; grip = the palm (local +Z out of the palm, -Y toward the fingers)
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sh = G('shoulder' + side, spine, [sx * B.shoulderX, B.shoulderY, 0]); sh.userData.oid = true;
    X(sh, .1, .3, .11, top, [0, -.13, 0]);
    const el = G('elbow' + side, sh, [0, -B.upper, 0]);
    X(el, .088, .27, .095, out.sleeves === 'long' ? top : skin, [0, -.125, 0]);
    if (acc.has('watch') && side === 'L') X(el, .096, .03, .1, 'black', [0, -.23, 0]);
    const ha = G('hand' + side, el, [0, -B.fore, 0]);
    X(ha, .07, .1, .05, skin, [0, -.045, 0]); X(ha, .03, .045, .028, skin, [0, -.03, .035]);   // hand + thumb
    const gr = G('grip' + side, ha, [-sx * .035, -.055, 0]); gr.rotation.y = -sx * Math.PI / 2;
    // legs: hip -> knee -> ankle (+ shoe)
    const hp = G('hip' + side, hips, [sx * B.hipX, 0, 0]); hp.userData.oid = true;
    X(hp, .15, .44, .16, pants, [0, -.2, 0]);
    const kn = G('knee' + side, hp, [0, -B.thigh, 0]);
    X(kn, .125, .43, .135, pants, [0, -.205, 0]);
    const an = G('ankle' + side, kn, [0, -B.shin, 0]);
    X(an, .11, .055, .245, shoes, [0, -.0275, .055]); X(an, .115, .028, .26, sole, [0, -.066, .06]);
  }
  root.joints = J; root.body = body;
  root.userData = { name: o.name ?? 'person', size: [.5 * s, 1.75 * s, .3 * s], solid: true, rest: true, person: true, height: B.height * s, s, seed };
  applyPose(root, CLIPS.idle(0, {}, root));
  return root;
}

// ---------- pose data: { hips: { p, q }, spine, neck, head, shL, elL, haL, shR, elR, haR, raiseL, raiseR, footL, footR } ----------
// footX = { p: ankle target (body space), pitch (+ = heel up / toes down), yaw (+ = toes toward +X) }
function newPose() {
  return { hips: { p: V(0, B.stand, 0), q: new THREE.Quaternion() }, spine: new THREE.Quaternion(), neck: new THREE.Quaternion(), head: new THREE.Quaternion(),
    shL: new THREE.Quaternion(), elL: new THREE.Quaternion(), haL: new THREE.Quaternion(), shR: new THREE.Quaternion(), elR: new THREE.Quaternion(), haR: new THREE.Quaternion(),
    raiseL: 0, raiseR: 0, footL: { p: V(B.hipX, B.ankle, 0), pitch: 0, yaw: .06 }, footR: { p: V(-B.hipX, B.ankle, 0), pitch: 0, yaw: -.06 } };
}
const QK = ['spine', 'neck', 'head', 'shL', 'elL', 'haL', 'shR', 'elR', 'haR'];
export function mixPose(A, Bp, w) {
  if (w <= 0) return A; if (w >= 1) return Bp;
  const P = newPose(); P.hips.p.lerpVectors(A.hips.p, Bp.hips.p, w); P.hips.q.slerpQuaternions(A.hips.q, Bp.hips.q, w);
  for (const k of QK) P[k].slerpQuaternions(A[k], Bp[k], w);
  P.raiseL = lerp(A.raiseL, Bp.raiseL, w); P.raiseR = lerp(A.raiseR, Bp.raiseR, w);
  for (const f of ['footL', 'footR']) P[f] = { p: A[f].p.clone().lerp(Bp[f].p, w), pitch: lerp(A[f].pitch, Bp[f].pitch, w), yaw: lerp(A[f].yaw, Bp[f].yaw, w) };
  return P;
}
// arm by angles: flex = forward raise, abd = sideways raise, twist = about the arm, bend = elbow, wrist = hand pitch (rad)
function armFK(P, side, flex, abd, twist = 0, bend = 0, wrist = 0) {
  const sx = side === 'L' ? 1 : -1;
  P['sh' + side] = qE(-flex, sx * twist, sx * abd, 'ZXY'); P['el' + side] = qE(-bend, 0, 0); P['ha' + side] = qE(-wrist, 0, 0);
}
// two-bone IK: joint A, target T, bone lengths, pole (where the middle joint points). kind 'arm' (lower bone bends toward
// local +Z) | 'leg' (toward -Z). Returns the upper bone's rotation in the frame A and T are given in, + the middle joint's.
function twoBone(A, T, l1, l2, pole, kind) {
  const d = T.clone().sub(A), L = d.length(), Lc = clamp(L, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4), dir = L > 1e-6 ? d.divideScalar(L) : V(0, -1, 0);
  const cb = clamp((l1 * l1 + Lc * Lc - l2 * l2) / (2 * l1 * Lc), -1, 1), sb = Math.sqrt(1 - cb * cb);
  let pp = pole.clone().addScaledVector(dir, -pole.dot(dir)); if (pp.lengthSq() < 1e-8) pp = Math.abs(dir.y) < .9 ? V(0, 1, 0).cross(dir) : V(1, 0, 0).cross(dir); pp.normalize();
  const E = A.clone().addScaledVector(dir, l1 * cb).addScaledVector(pp, l1 * sb), u = E.clone().sub(A).normalize(), w = A.clone().addScaledVector(dir, Lc).sub(E).normalize();
  const k = Math.acos(clamp(u.dot(w), -1, 1));
  let bend = w.clone().addScaledVector(u, -u.dot(w)); if (bend.lengthSq() < 1e-8) bend = pp.clone().negate().addScaledVector(u, pp.dot(u)); bend.normalize();
  const Y = u.clone().negate(), Z = kind === 'arm' ? bend : bend.clone().negate(), Xa = Y.clone().cross(Z).normalize(); Z.copy(Xa.clone().cross(Y)).normalize();
  const q1 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xa, Y, Z));
  return { q1, q2: qE(kind === 'arm' ? -k : k, 0, 0), reach: L <= l1 + l2 };
}
const hipsM = P => new THREE.Matrix4().compose(P.hips.p, P.hips.q, ONE);
const spineM = P => hipsM(P).multiply(new THREE.Matrix4().compose(V(0, B.spineUp, 0), P.spine, ONE));
// arm IK: the wrist to `target` (body space), the elbow toward `pole` (body-space direction)
function armIK(P, side, target, pole) {
  const sx = side === 'L' ? 1 : -1, Mi = spineM(P).invert(), sh = V(sx * B.shoulderX, B.shoulderY + P['raise' + side], 0);
  const T = target.clone().applyMatrix4(Mi), pl = (pole ?? V(sx * .5, -1, -.5)).clone().transformDirection(Mi);
  const r = twoBone(sh, T, B.upper, B.fore, pl, 'arm'); P['sh' + side] = r.q1; P['el' + side] = r.q2; return r;
}
// orient a hand in body space: fingers along `fingers`, palm facing `palm` (directions); after armIK / armFK
function handAim(P, side, fingers, palm) {
  const sx = side === 'L' ? 1 : -1, fore = P.hips.q.clone().multiply(P.spine).multiply(P['sh' + side]).multiply(P['el' + side]);
  const Y = fingers.clone().normalize().negate(), Xp = palm.clone().addScaledVector(Y, -palm.dot(Y)).normalize().multiplyScalar(-sx);   // the palm is local -X (L) / +X (R)
  const Z = Xp.clone().cross(Y).normalize(), Xa = Y.clone().cross(Z).normalize();
  const qB = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xa, Y, Z));
  P['ha' + side] = fore.invert().multiply(qB);
}
// body-space position of a point given in the rig's parent (world) space
function toBody(rig, p) { rig.updateMatrixWorld(true); return rig.body.worldToLocal(p.isVector3 ? p.clone() : V(...p)); }

// ---------- apply (legs by IK from the foot targets) ----------
const _m = new THREE.Matrix4(), _qi = new THREE.Quaternion();
export function applyPose(rig, P) {
  const J = rig.joints;
  J.hips.position.copy(P.hips.p); J.hips.quaternion.copy(P.hips.q);
  J.spine.quaternion.copy(P.spine); J.neck.quaternion.copy(P.neck); J.head.quaternion.copy(P.head);
  for (const s of ['L', 'R']) {
    J['shoulder' + s].position.y = B.shoulderY + P['raise' + s];
    J['shoulder' + s].quaternion.copy(P['sh' + s]); J['elbow' + s].quaternion.copy(P['el' + s]); J['hand' + s].quaternion.copy(P['ha' + s]);
    const f = P['foot' + s], sx = s === 'L' ? 1 : -1, Mi = _m.compose(P.hips.p, P.hips.q, ONE).clone().invert();
    const T = f.p.clone().applyMatrix4(Mi), qi = _qi.copy(P.hips.q).invert();
    const pole = V(Math.sin(f.yaw) + sx * .12, 0, Math.cos(f.yaw)).applyQuaternion(qi);
    const r = twoBone(V(sx * B.hipX, 0, 0), T, B.thigh, B.shin, pole, 'leg');
    J['hip' + s].quaternion.copy(r.q1); J['knee' + s].quaternion.copy(r.q2);
    const qF = qE(0, f.yaw, 0).multiply(qE(f.pitch, 0, 0));
    J['ankle' + s].quaternion.copy(r.q1.clone().multiply(r.q2).invert().multiply(qi.clone().multiply(qF)));
  }
  return rig;
}

// ---------- clips: (t, opts, rig) -> pose ----------
const ph = rig => rig?.userData?.seed ?? 0;
function standArms(P, t, k = 0) { const b = Math.sin(TAU * (t / 4.2 + k)); armFK(P, 'L', .03 * b, .08, 0, .16 + .03 * b); armFK(P, 'R', -.03 * b, .08, 0, .16 + .03 * b); }
function idle(t, o = {}, rig) {
  const P = newPose(), k = ph(rig), b = Math.sin(TAU * (t / 4.2 + k)), w = Math.sin(TAU * (t / 8.5 + k * 1.7)) * (o.shift ?? 1);
  P.hips.p.set(.022 * w, B.stand - .004 * (1 + b) / 2, 0); P.hips.q = qE(0, .03 * Math.sin(TAU * (t / 13 + k)), .03 * w);
  P.spine = qE(.02 + .012 * b, .025 * Math.sin(TAU * (t / 11 + k)), -.045 * w); P.neck = qE(-.01 * b, 0, .01 * w);
  P.head = qE(.03 * Math.sin(TAU * (t / 6.3 + k * 3)) - .015 * b, (o.look ?? 1) * (.12 * Math.sin(TAU * (t / 7.7 + k * 2)) + .04 * Math.sin(TAU * (t / 3.3 + k))), -.01 * w);
  P.raiseL = P.raiseR = .006 * (1 + b) / 2; standArms(P, t, k);
  return P;
}
function sitBase(t, o, rig, seat = o.seat ?? .46, back = o.back ?? -.32) {
  const P = newPose(), k = ph(rig), b = Math.sin(TAU * (t / 4.2 + k));
  P.hips.p.set(0, seat + .1, back); P.spine = qE(-.04 + .012 * b, .02 * Math.sin(TAU * (t / 9 + k)), 0);
  P.head = qE(.03 * Math.sin(TAU * (t / 6 + k)), .1 * Math.sin(TAU * (t / 8.3 + k * 2)), 0);
  P.footL = { p: V(.12, B.ankle, o.feet ?? .02), pitch: 0, yaw: .08 }; P.footR = { p: V(-.12, B.ankle, o.feet ?? .02), pitch: 0, yaw: -.08 };
  P.raiseL = P.raiseR = .005 * (1 + b) / 2;
  return P;
}
const CLIPS = {
  idle,
  // walk / run IN PLACE: the gait for a root moving forward at opts.speed (the caller moves the root): walkTo does both
  walk: (t, o, rig) => gaitPose(rig, inPlacePlan(rig, 'walk', o.speed), (o.speed ?? GAITS.walk.speed) * t + 500 * (rig?.userData?.s ?? 1), t, o),
  run: (t, o, rig) => gaitPose(rig, inPlacePlan(rig, 'run', o.speed), (o.speed ?? GAITS.run.speed) * t + 500 * (rig?.userData?.s ?? 1), t, o),
  sit: (t, o, rig) => { const P = sitBase(t, o, rig), seat = o.seat ?? .46, back = o.back ?? -.32;
    for (const [s, sx] of [['L', 1], ['R', -1]]) { armIK(P, s, V(sx * .15, seat + .2, back + .3), V(sx * .6, -.3, -1)); handAim(P, s, V(0, -.25, 1), V(0, -1, 0)); }
    return P; },
  typeAtDesk: (t, o, rig) => { const seat = o.seat ?? .46, P = sitBase(t, o, rig, seat), k = ph(rig), desk = o.desk ?? .74, kz = o.keys ?? .1;
    P.spine = qE(.2, 0, 0); P.neck = qE(.05, 0, 0); P.head = qE(o.look === 'keys' ? .45 : .02 + .02 * Math.sin(TAU * (t / 5 + k)), .05 * Math.sin(TAU * (t / 6.5 + k)), 0);
    for (const [s, sx, off] of [['L', 1, 0], ['R', -1, .5]]) {
      const tap = Math.max(0, Math.sin(TAU * (t * (o.rate ?? 4.5) + off + k))) ** 2, jit = (hash(Math.floor(t * 3 + off * 7 + k * 100)) - .5) * .05;
      armIK(P, s, V(sx * .14 + jit, desk + .045 + .016 * tap, kz), V(sx * .7, -1, -.4)); handAim(P, s, V(-sx * .15, -.35, 1), V(0, -1, 0)); }
    return P; },
  holdPhone: (t, o, rig) => { const P = o.seated ? sitBase(t, o, rig) : idle(t, { ...o, look: .15 }, rig), k = ph(rig), hy = o.seated ? (o.seat ?? .46) + .45 : 1.12, hz = o.seated ? -.06 : .24;
    P.neck = qE(.15, 0, 0); P.head = qE(.38 + .02 * Math.sin(TAU * (t / 5 + k)), .03 * Math.sin(TAU * (t / 7 + k)), 0);
    const eye = V(0, hy + .5, hz - .14), hand = V(-.07, hy, hz);
    armIK(P, 'R', hand, V(-.6, -1, -.5)); handAim(P, 'R', V(.35, .45, 1), eye.clone().sub(hand));
    if (o.hands === 2) { armIK(P, 'L', V(.05, hy - .03, hz - .01), V(.6, -1, -.5)); handAim(P, 'L', V(-.4, .3, 1), V(0, 1, -.3)); }
    if (o.scroll) { const sc = Math.max(0, Math.sin(TAU * (t * .6 + k))) ** 4; P.haR.multiply(qE(-.12 * sc, 0, 0)); }
    return P; },
  point: (t, o, rig) => { const P = idle(t, { ...o, look: 0 }, rig), sideP = o.hand === 'L' ? 'L' : 'R', sx = sideP === 'L' ? 1 : -1;
    let dir = o.at ? toBody(rig, o.at).sub(V(sx * B.shoulderX, B.hipY + B.spineUp + B.shoulderY, 0)) : V(-sx * .1, .15, 1).applyAxisAngle(V(0, 1, 0), (o.yaw ?? 0));
    dir.normalize(); if (dir.z < -.2) dir.z = -.2; dir.normalize();
    const sh = V(sx * B.shoulderX, B.hipY + B.spineUp + B.shoulderY, 0);
    armIK(P, sideP, sh.clone().addScaledVector(dir, .52), V(sx * .3, -1, -.2)); handAim(P, sideP, dir, V(0, -1, 0));
    const yaw = clamp(Math.atan2(dir.x, dir.z), -1, 1), pitch = clamp(-Math.asin(clamp(dir.y, -1, 1)), -.4, .5);
    P.spine = P.spine.clone().multiply(qE(0, yaw * .25, 0)); P.head = qE(pitch * .6, yaw * .55, 0);
    return P; },
  wave: (t, o, rig) => { const P = idle(t, { ...o, look: 0 }, rig), s = o.hand === 'L' ? 'L' : 'R', sx = s === 'L' ? 1 : -1, w = Math.sin(TAU * (o.hz ?? 2) * t);
    armIK(P, s, V(sx * (.4 + .09 * w), 1.72 - .02 * Math.abs(w), .1), V(sx, -.5, .1)); handAim(P, s, V(sx * (.25 + .4 * w), 1, .05), V(0, .1, 1));
    P.head = qE(-.04, -sx * .1, sx * .05); return P; },
  shrug: (t, o, rig) => { const P = idle(t, { ...o, look: 0 }, rig); P.raiseL = P.raiseR = .05;
    for (const [s, sx] of [['L', 1], ['R', -1]]) { armIK(P, s, V(sx * .36, 1.05, .2), V(sx * .3, -1, -.6)); handAim(P, s, V(sx * .7, 0, .7), V(0, 1, 0)); }
    P.head = qE(.02, 0, .14); P.neck = qE(0, 0, .04); return P; },
  celebrate: (t, o, rig) => { const P = idle(t, { ...o, look: 0 }, rig), pump = Math.sin(TAU * (o.hz ?? 2.2) * t), bounce = (1 - Math.cos(TAU * (o.hz ?? 2.2) * t)) / 2;
    P.hips.p.y = B.stand - .05 * bounce;
    for (const [s, sx] of [['L', 1], ['R', -1]]) { armIK(P, s, V(sx * .34, 1.93 + .05 * pump - .05 * bounce, .06), V(sx, -.25, .1)); handAim(P, s, V(sx * .2, 1, 0), V(0, 0, 1)); }
    P.head = qE(-.18, 0, 0); P.spine = qE(-.06, 0, 0); return P; },
  think: (t, o, rig) => { const P = idle(t, { ...o, look: .2 }, rig), k = ph(rig);
    armIK(P, 'R', V(-.05, 1.36, .2), V(-.3, -1, .25)); handAim(P, 'R', V(.1, 1, .15), V(0, 0, 1));
    armIK(P, 'L', V(-.07, 1.11, .17), V(.6, -1, -.3)); handAim(P, 'L', V(-1, 0, .1), V(0, 1, 0));
    P.head = qE(.08 + .04 * Math.sin(TAU * (t / 3.5 + k)), .1, .1); P.neck = qE(.04, 0, .03); return P; },
  drive: (t, o, rig) => { const P = newPose(), k = ph(rig), wc = V(...(o.wheel ?? [0, .92, -.2])), r = o.wheelR ?? .17, tilt = o.wheelTilt ?? .45, steer = o.steer ?? 0;
    P.hips.p.set(0, o.seat ?? .4, o.back ?? -.6); P.spine = qE(-.16, 0, 0); P.neck = qE(.1, 0, 0);
    P.head = qE(.06, .06 * Math.sin(TAU * (t / 6 + k)) + steer * .25, 0);
    P.footL = { p: V(.14, B.ankle + .02, o.feet ?? .08), pitch: -.35, yaw: .05 }; P.footR = { p: V(-.14, B.ankle + .02, o.feet ?? .08), pitch: -.35, yaw: -.05 };
    const n = V(0, Math.sin(tilt), -Math.cos(tilt)), up = V(0, Math.cos(tilt), Math.sin(tilt)), rt = V(1, 0, 0);
    for (const [s, sx] of [['L', 1], ['R', -1]]) { const a = sx * (1.05) - steer, hp = wc.clone().addScaledVector(up, r * Math.cos(a)).addScaledVector(rt, r * Math.sin(a));
      armIK(P, s, hp, V(sx * .6, -1, -.2)); handAim(P, s, up.clone().multiplyScalar(Math.cos(a)).addScaledVector(rt, Math.sin(a)).multiplyScalar(-1).addScaledVector(n, -.4), n.clone().negate()); }
    return P; },
};
export const POSES = Object.keys(CLIPS);

/**
 * pose(rig, name, t, opts): set the rig to clip `name` at time t (pure). Gestures with opts.t0 fade in from opts.base
 * ('idle', or a pose object) over opts.blend (.45 s) and, with opts.dur / opts.t1, back out. Returns the pose data.
 */
export function pose(rig, name, t, o = {}) {
  const f = CLIPS[name]; if (!f) throw new Error(`anim: unknown pose "${name}" (${POSES.join(' ')})`);
  let P = f(t, o, rig);
  if (o.t0 != null || o.t1 != null || o.dur != null) {
    const bl = o.blend ?? .45, t0 = o.t0 ?? -1e9, t1 = o.t1 ?? (o.dur != null ? t0 + o.dur : 1e9);
    const w = smootherstep(seg(t, t0, t0 + bl)) * (1 - smootherstep(seg(t, t1 - bl, t1)));
    if (w < 1) { const base = typeof o.base === 'object' ? o.base : (CLIPS[o.base ?? 'idle'] ?? idle)(t, o.baseOpts ?? {}, rig); P = mixPose(base, P, w); }
  }
  applyPose(rig, P); return P;
}
// a timeline of clips with cross-fades: act(rig, t, [{ t0: 0, clip: 'idle' }, { t0: 3, clip: 'wave', hz: 2 }, ...], { blend })
export function act(rig, t, list, { blend = .45 } = {}) {
  const L = [...list].sort((a, b) => a.t0 - b.t0); let i = 0; for (let k = 0; k < L.length; k++) if (t >= L[k].t0) i = k;
  const ev = it => CLIPS[it.clip](t, it, rig); let P = ev(L[i]);
  if (i > 0 && t < L[i].t0 + blend) P = mixPose(ev(L[i - 1]), P, smootherstep((t - L[i].t0) / blend));
  applyPose(rig, P); return P;
}

// ---------- gait: steps planned along a path, driven by the distance travelled ----------
export const GAITS = {
  walk: { speed: 1.25, step: s => clamp(.36 + .2 * s, .38, .72), front: .45, back: .75, lift: .085, heel: .5, heelStart: .15, lean: .05, arm: .32, elbow: .25, elbowSwing: .15, twist: .06 },
  run: { speed: 3.3, step: s => clamp(.55 + .17 * s, .8, 1.3), front: .3, back: .45, lift: .2, heel: .6, heelStart: .05, lean: .17, arm: .75, elbow: 1.45, elbowSwing: .2, twist: .1 },
};
// plan for a path of length D (m): each foot's plants and swings { a, b, s0, s1 } in path distance
// The first foot steps st, then each foot swings 2 st (from behind the body to ahead of it), and the last foot closes next
// to the other one at D: both feet together at the start and at the end. A swing lifts when the body is G.back steps past
// the foot's plant (the first step: at once) and lands when the body is G.front steps short of the next plant (the closing
// step: when the body arrives). Stance overlaps (double support) for the walk; the run has flight phases.
function planSteps(D, gait, st0, first = 'L') {
  const G = GAITS[gait], n = Math.max(1, Math.round(D / st0)), st = D / n, other = first === 'L' ? 'R' : 'L';
  const seq = { [first]: [], [other]: [] }, feet = { [first]: [], [other]: [] };
  for (let q = 1; q <= n; q++) seq[q % 2 ? first : other].push(q);
  const closer = n % 2 ? other : first; seq[closer].push(n);
  for (const f of [first, other]) { let a = 0;
    for (const q of seq[f]) { const b = q * st, closing = f === closer && q === n;
      const s1 = closing ? D : b - G.front * st, s0 = a === 0 && f === first ? 0 : Math.min(a + G.back * st, s1 - .1 * st);
      feet[f].push({ a, b, s0, s1, closing }); a = b; } }
  return { D, n, st, feet, gait, first };
}
function footAt(plan, f, s) {   // -> { q (path distance of the plant), lift (m), pitch, swing (0..1, or -1 in stance), from, to }
  const G = GAITS[plan.gait], st = plan.st; let a = 0;
  for (const w of plan.feet[f]) {
    const hs = a + G.heelStart * st, heelEnd = w.s0 > hs + .05 * st ? G.heel : 0;   // heel-off ramps through the stance
    if (s < w.s0) return { q: a, lift: 0, pitch: heelEnd * ss((s - hs) / (w.s0 - hs)), swing: -1 };
    if (s < w.s1) { const u = (s - w.s0) / (w.s1 - w.s0), size = clamp((w.b - w.a) / (1.6 * st), .55, 1);
      return { q: lerp(w.a, w.b, smootherstep(u)), lift: G.lift * size * Math.sin(Math.PI * u), pitch: heelEnd * (1 - ss(u / .7)) - .14 * size * Math.sin(Math.PI * clamp((u - .45) / .55)), swing: u, from: w.a, to: w.b }; }
    a = w.b;
  }
  return { q: a, lift: 0, pitch: 0, swing: -1 };
}
const PLANS = new Map();
function inPlacePlan(rig, gait, speed) { const s = rig?.userData?.s ?? 1, key = `${gait}:${speed}:${s}`; if (!PLANS.has(key)) { const sp = speed ?? GAITS[gait].speed, st0 = GAITS[gait].step(sp) * s;
  PLANS.set(key, { plan: planSteps(1000 * s, gait, st0), path: null }); } return PLANS.get(key); }
// the walking pose at path distance s: root on the path, feet at their plants (world), hips from the leg reach
function gaitPose(rig, PL, s, t, o = {}) {
  const plan = PL.plan, G = GAITS[plan.gait], sc = rig?.userData?.s ?? 1, k = ph(rig), P = newPose(), path = PL.path;
  const rootAt = q => path ? path.at(q) : { p: V(0, 0, q), h: 0 };
  const R0 = rootAt(s), hy = R0.h, toLocal = w => w.clone().sub(R0.p).applyAxisAngle(V(0, 1, 0), -hy).divideScalar(sc);
  const feet = {};
  for (const [f, sx] of [['L', 1], ['R', -1]]) {
    const F = footAt(plan, f, s), side = (q, h) => V(Math.cos(h), 0, -Math.sin(h)).multiplyScalar(sx * B.hipX * sc);
    let wp, yaw;
    if (F.swing >= 0) { const A = rootAt(F.from), Bq = rootAt(F.to), u = smootherstep(F.swing); wp = A.p.clone().add(side(F.from, A.h)).lerp(Bq.p.clone().add(side(F.to, Bq.h)), u); yaw = angDiff(lerp(A.h, A.h + angDiff(Bq.h, A.h), u), hy); }
    else { const A = rootAt(F.q); wp = A.p.clone().add(side(F.q, A.h)); yaw = angDiff(A.h, hy); }
    const lp = toLocal(wp); lp.y += B.ankle;   // the plant is on the ground; the IK target is the ankle above it
    yaw += sx * .06;                            // a little toe-out (the heel-off pivots about the same toe the mesh has)
    const ankle = heelPivot(lp, F.pitch, yaw); ankle.y += F.lift / sc;
    feet[f] = { p: ankle, pitch: F.pitch, yaw };
  }
  P.footL = feet.L; P.footR = feet.R;
  // hips: as high as standing allows, lowered (soft-min) so both legs reach their feet
  const Rl = .985 * (B.thigh + B.shin), cons = [B.stand], dz = feet.L.p.z - feet.R.p.z, run = plan.gait === 'run';
  for (const f of ['L', 'R']) { const a = feet[f].p, hx = (f === 'L' ? 1 : -1) * B.hipX, dx = a.x - hx; cons.push(a.y + Math.sqrt(Math.max(.01, Rl * Rl - a.z * a.z - dx * dx))); }
  let hipY = -.012 * Math.log(cons.reduce((m, c) => m + Math.exp(-c / .012), 0));
  if (run) hipY = Math.min(hipY, B.stand - .05 * clamp(o.speedNow ?? 1, 0, 1));
  const spd = o.speedNow ?? 1, lean = G.lean * clamp(spd, 0, 1);
  P.hips.p.set(0, hipY, 0); P.hips.q = qE(0, -G.twist * clamp(dz / (2 * plan.st / sc), -1, 1) * .5, 0);
  const sw = clamp(dz / (1.2 * plan.st / sc), -1, 1);   // + = left foot ahead
  P.spine = qE(lean, G.twist * sw, 0); P.neck = qE(-lean * .4, 0, 0); P.head = qE(-lean * .4 + .02 * Math.sin(TAU * (t / 5 + k)), -G.twist * sw * .8, 0);
  const el = G.elbow * clamp(spd, .3, 1);
  armFK(P, 'L', -G.arm * sw * clamp(spd, 0, 1), .07, 0, el + G.elbowSwing * Math.max(0, -sw)); armFK(P, 'R', G.arm * sw * clamp(spd, 0, 1), .07, 0, el + G.elbowSwing * Math.max(0, sw));
  return P;
}
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
// heel-off: the foot pitched by `pitch` about its toe tip; plant = the ankle when flat
function heelPivot(plant, pitch, yaw) {
  if (!pitch) return plant.clone();
  const toe = V(...B.toe).applyAxisAngle(V(0, 1, 0), yaw), r = V(...B.toe).applyAxisAngle(V(1, 0, 0), pitch).applyAxisAngle(V(0, 1, 0), yaw);
  return plant.clone().add(toe).sub(r);
}

// ---------- paths ----------
const v3 = p => p.isVector3 ? p.clone() : V(p[0], p.length > 2 ? p[1] : 0, p.length > 2 ? p[2] : p[1]);
const CURVES = new Map();
// a Catmull-Rom path through points ([x, z] or [x, y, z]), arc-length parametrised: at(dist) -> { p, h (heading) }
export function pathOf(points) {
  const key = JSON.stringify(points.map(p => p.isVector3 ? p.toArray() : p)); if (CURVES.has(key)) return CURVES.get(key);
  const pts = points.map(v3), curve = pts.length === 2 ? new THREE.LineCurve3(pts[0], pts[1]) : new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const len = curve.getLength(), dir0 = pts[1].clone().sub(pts[0]);
  const at = d => { const u = clamp(d / Math.max(1e-6, len)), p = curve.getPointAt(u), tg = curve.getTangentAt(u); let h = Math.atan2(tg.x, tg.z); if (!isFinite(h)) h = Math.atan2(dir0.x, dir0.z); return { p, h }; };
  const P = { curve, len, at, pts }; if (CURVES.size > 400) CURVES.clear(); CURVES.set(key, P); return P;
}
// distance travelled at time t on a trapezoid speed profile (accelerate ramp s, cruise, decelerate): starts and ends at rest
function cruise(t, t0, t1, D, ramp) { const T = Math.max(1e-6, t1 - t0), a = Math.min(ramp, T / 2), v = D / (T - a), x = clamp(t - t0, 0, T);
  if (x < a) return { d: v * x * x / (2 * a), v: v * x / a }; if (x > T - a) { const y = T - x; return { d: D - v * y * y / (2 * a), v: v * y / a }; } return { d: v * a / 2 + v * (x - a), v }; }
const EASES = { inout: smootherstep, linear: u => u, in: u => clamp(u) ** 2, out: u => 1 - (1 - clamp(u)) ** 2, smooth: ss };
function register(obj, key, m) {   // obj.userData.motionAt(t) -> { p: [x, y, z], heading } across all its motions (camera follow)
  const ms = obj.userData.motions ??= new Map(); ms.set(key, m);
  obj.userData.motionAt = t => { const L = [...ms.values()].sort((a, b) => a.t0 - b.t0); let c = L[0]; for (const x of L) if (t >= x.t0) c = x; return c.at(t); };
  return m;
}

/**
 * walkPath(rig, points, t0, t1, opts) / walkTo(rig, from, to, t0, t1, opts): the person walks the path from t0 to t1
 * (idle before at the start, idle after at the end, facing the way they walked; opts.before / opts.after: other clips).
 * opts.gait 'walk' | 'run', opts.first 'L' | 'R', opts.t (time; default NOW), opts.ramp (s to reach speed).
 */
export function walkPath(rig, points, t0, t1, o = {}) {
  const t = nowT(o), sc = rig.userData.s ?? 1, path = pathOf(points), D = path.len, T = Math.max(.1, t1 - t0), vAvg = D / T;
  const gait = o.gait ?? (vAvg > 2.4 * sc ? 'run' : 'walk'), G = GAITS[gait], key = `${JSON.stringify(path.pts.map(p => p.toArray()))}|${t0}|${t1}|${gait}|${o.first ?? 'L'}|${sc}`;
  const ramp = o.ramp ?? Math.min(gait === 'run' ? .9 : .6, T / 2.5);
  const mot = register(rig, key, { t0, t1, at: tt => { const c = cruise(tt, t0, t1, D, ramp), R = path.at(c.d); return { p: R.p.toArray(), heading: R.h, d: c.d, v: c.v }; } });
  let st = rig.userData._plans?.get(key);
  if (!st) { const vCruise = D / Math.max(.1, T - ramp); (rig.userData._plans ??= new Map()).set(key, st = { plan: planSteps(D, gait, G.step(vCruise / sc) * sc, o.first ?? 'L'), path, vCruise }); }
  const M = mot.at(t), R = path.at(M.d);
  rig.position.copy(R.p); rig.rotation.set(0, R.h, 0);
  let P;
  if (t <= t0 || t >= t1 || D < .05) P = (CLIPS[t <= t0 ? (o.before ?? 'idle') : (o.after ?? 'idle')] ?? idle)(t, o, rig);
  else {
    P = gaitPose(rig, st, M.d, t, { speedNow: M.v / Math.max(.1, st.vCruise) });
    const bl = Math.min(.25, T / 4), w = smootherstep(seg(t, t0, t0 + bl)) * (1 - smootherstep(seg(t, t1 - bl, t1)));
    // blend the body in / out of the gait; the feet stay the gait's (planted) so nothing slides during the blend
    if (w < 1) { const Wp = P; P = mixPose((CLIPS[t < (t0 + t1) / 2 ? (o.before ?? 'idle') : (o.after ?? 'idle')] ?? idle)(t, o, rig), Wp, w); P.footL = Wp.footL; P.footR = Wp.footR; }
  }
  applyPose(rig, P); return mot;
}
export function walkTo(rig, from, to, t0, t1, o = {}) { return walkPath(rig, [from, to], t0, t1, o); }

/**
 * followPath(obj, points, t0, t1, { ease, face, forward, t, ramp, bank }): moves obj along a Catmull-Rom path (eased:
 * 'inout' default | 'cruise' | 'linear' | 'in' | 'out' | fn), facing the direction of travel (face: true). forward: the
 * object's front axis 'z' (default) | 'x' | '-x' | '-z' (models.car() faces +X), or obj.userData.front = [x, z].
 */
export function followPath(obj, points, t0, t1, o = {}) {
  const t = nowT(o), path = pathOf(points), T = Math.max(1e-3, t1 - t0), ease = typeof o.ease === 'function' ? o.ease : EASES[o.ease ?? 'inout'];
  const fwd = o.forward ?? obj.userData.front ?? 'z', off = Array.isArray(fwd) ? Math.atan2(fwd[0], fwd[1]) : { z: 0, x: Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 }[fwd] ?? 0;
  const distAt = tt => o.ease === 'cruise' ? cruise(tt, t0, t1, path.len, o.ramp ?? Math.min(1.2, T / 3)).d : path.len * ease(clamp((tt - t0) / T));
  const key = `${JSON.stringify(path.pts.map(p => p.toArray()))}|${t0}|${t1}`;
  const m = register(obj, key, { t0, t1, at: tt => { const d = distAt(tt), R = path.at(d); return { p: R.p.toArray(), heading: R.h, d }; } });
  const M = m.at(t); obj.position.set(...M.p);
  if (o.face !== false) { obj.rotation.y = M.heading - off;
    if (o.bank) { const a = path.at(Math.max(0, M.d - .5)).h, b = path.at(Math.min(path.len, M.d + .5)).h; obj.rotation.z = clamp(angDiff(b, a) * o.bank, -.3, .3); } }
  m.dist = M.d; return m;
}
/** driveCar(car, points, t0, t1, opts): followPath with a cruise profile (accelerate, cruise, brake) + spinning wheels
 *  (meshes / groups named 'wheel', or userData.name 'wheel'); opts.forward as followPath (default: userData.front or 'z'). */
export function driveCar(car, points, t0, t1, o = {}) {
  const m = followPath(car, points, t0, t1, { ease: 'cruise', ...o }), fwd = o.forward ?? car.userData.front ?? 'z';
  const alongX = fwd === 'x' || fwd === '-x' || (Array.isArray(fwd) && Math.abs(fwd[0]) > Math.abs(fwd[1])), sgn = (fwd === '-x' || fwd === '-z') ? -1 : 1;
  const wheels = car.userData._wheels ??= (() => { const w = []; car.traverse(x => { if (x !== car && (x.name === 'wheel' || x.userData?.name === 'wheel')) w.push(x); }); return w; })();
  for (const w of wheels) { const r = o.wheelR ?? w.userData.radius ?? (() => { const b = new THREE.Box3().setFromObject(w), z = b.getSize(V()); return Math.max(.05, Math.max(z.x, z.y, z.z) / 2); })();
    w.userData.radius = r; w.userData.rot0 ??= w.rotation.clone();
    const a = sgn * m.dist / r; if (alongX) w.rotation.z = w.userData.rot0.z - a; else w.rotation.x = w.userData.rot0.x + a; }
  return m;
}
/** steerOf(obj, t): a steering amount (-1..1, + = left) from the obj's motion: pass it to pose(driver, 'drive', t, { steer }) */
export function steerOf(obj, t, k = 1.2) { const m = obj.userData.motionAt; if (!m) return 0; const a = m(t - .3).heading, b = m(t + .3).heading; return clamp(angDiff(b, a) * k, -1, 1) * .9; }

// ---------- small loops (pure in t) ----------
export function spin(obj, t, rps = .25, axis = 'y') { obj.userData.rot0 ??= obj.rotation.clone(); obj.rotation[axis] = obj.userData.rot0[axis] + TAU * rps * t; return obj; }
export function bob(obj, t, amp = .05, hz = .5, phase = 0) { obj.userData.pos0 ??= obj.position.clone(); obj.position.y = obj.userData.pos0.y + amp * Math.sin(TAU * (hz * t + phase)); return obj; }
export function blink(mesh, t, hz = 1, duty = .5, phase = 0) { mesh.visible = ((t * hz + phase) % 1 + 1) % 1 < duty; return mesh.visible; }

/**
 * flowPackets(path, n, t, { speed, factory, factory2, switchAt, parent, size, ramp, t0, spread }): n data blocks flowing
 * along a path (points or a THREE.Curve); speed in m/s. factory(i) makes a packet (default a small glowing box); with
 * factory2, each packet changes into factory2(i) at switchAt (0..1 of the path): instructions being translated.
 * The group is created once (cached on the path) and returned: add it to the scene (or pass parent). Packets fade
 * in / out at the path ends (scaled), never pop.
 */
// (the group: o.group (what an earlier call returned), else one per parent + path, else one per path array)
const PACKETS = new WeakMap();
export function flowPackets(path, n, t, o = {}) {
  const P = Array.isArray(path) ? pathOf(path) : { curve: path, len: path.getLength(), at: d => ({ p: path.getPointAt(clamp(d / path.getLength())) }) };
  const skey = o.id ?? (Array.isArray(path) ? JSON.stringify(path.map(p => p.isVector3 ? p.toArray() : p)) + '|' + n : null), scoped = o.parent && skey ? (o.parent.userData._packets ??= new Map()) : null;
  let G = o.group ?? scoped?.get(skey) ?? PACKETS.get(path);
  if (!G) { G = new THREE.Group(); G.userData = { name: o.name ?? 'packets', items: [] }; const sz = o.size ?? .12;
    const mk = (f, i, r) => { const m = f ? f(i) : box(sz, sz, sz, r, [0, 0, 0], { unlit: true }); m.userData.s0 = m.scale.clone(); G.add(m); return m; };
    for (let i = 0; i < n; i++) G.userData.items.push({ a: mk(o.factory, i, o.ramp ?? 'neonCyan'), b: o.factory2 || o.ramp2 ? mk(o.factory2, i, o.ramp2 ?? 'neonPink') : null });
    if (scoped) scoped.set(skey, G); else PACKETS.set(path, G); o.parent?.add(G); }
  const L = P.len, sp = o.speed ?? 1, t0 = o.t0 ?? 0, sw = o.switchAt ?? .5, spread = o.spread ?? 1;
  G.userData.items.forEach((it, i) => {
    const lap = (t - t0) * sp / L + i / n * spread, u = (lap % 1 + 1) % 1, p = P.at(u * L).p, sc = Math.min(1, Math.sin(Math.PI * u) * 4), dip = it.b ? 1 - .7 * Math.max(0, 1 - Math.abs(u - sw) / .06) : 1;
    const started = o.prefill === false ? lap >= 1 : true;   // prefill false: the stream starts at the path's start at t0
    for (const [m, on] of [[it.a, !it.b || u < sw], [it.b, it.b && u >= sw]]) { if (!m) continue; m.visible = on && started && sc > .01; m.position.copy(p); m.scale.copy(m.userData.s0).multiplyScalar(Math.max(.001, sc * dip)); }
  });
  return G;
}

/**
 * assemble(parts, t0, dur, { from, stagger, t, hide, order }): each part flies in from an offset and lands (eased) at the
 * place it had when first called. from: [x, y, z] offset | (i, part) => offset (default: up 1.2 + outward 1.5);
 * stagger: s between parts (default spreads them over half the time). Before its start a part is hidden (hide: false keeps it).
 */
export function assemble(parts, t0, dur, o = {}) {
  const t = nowT(o), n = parts.length, stg = o.stagger ?? (n > 1 ? dur * .5 / (n - 1) : 0), d = Math.max(.35, dur - stg * (n - 1));
  const c = new THREE.Vector3(); parts.forEach(p => { p.userData.home ??= p.position.clone(); c.add(p.userData.home); }); c.divideScalar(Math.max(1, n));
  parts.forEach((p, i) => { const h = p.userData.home, a = t0 + i * stg, u = smootherstep(seg(t, a, a + d));
    const off = typeof o.from === 'function' ? v3(o.from(i, p)) : o.from ? v3(o.from) : h.clone().sub(c).setY(0).normalize().multiplyScalar(1.5).add(V(0, 1.2, 0));
    p.position.copy(h).addScaledVector(off, 1 - u); if (o.hide !== false) p.visible = t >= a; });
  return parts;
}
/**
 * explode(parts, t0, dur, { dist, axis, gap, center, back, t }): exploded view. axis 'y' | 'x' | 'z': the parts spread
 * along the axis by `gap` m per step (stacked hardware layers, sorted by their position); no axis: outward from the centre
 * by `dist` (default 1). back: time it collapses again (optional). Eased, starts and ends at rest.
 */
export function explode(parts, t0, dur, o = {}) {
  const t = nowT(o); parts.forEach(p => { p.userData.home ??= p.position.clone(); });
  const c = o.center ? v3(o.center) : parts.reduce((s, p) => s.add(p.userData.home), V()).divideScalar(Math.max(1, parts.length));
  let u = smootherstep(seg(t, t0, t0 + dur)); if (o.back != null) u *= 1 - smootherstep(seg(t, o.back, o.back + dur));
  const ax = o.axis, order = ax ? [...parts].sort((a, b) => a.userData.home[ax] - b.userData.home[ax]) : parts, mid = (order.length - 1) / 2;
  order.forEach((p, i) => { const h = p.userData.home;
    const off = ax ? V().setComponent('xyz'.indexOf(ax), (o.from === 'base' ? i : i - mid) * (o.gap ?? .4)) : h.clone().sub(c).normalize().multiplyScalar(o.dist ?? 1);
    if (!isFinite(off.x)) off.set(0, 0, 0); p.position.copy(h).addScaledVector(off, u); });
  return parts;
}

// ---------- HUD helpers ----------
/** countUp(t0, t1, from, to, { t, ease, decimals }): the number at time t (eased out), for stat() / text() */
export function countUp(t0, t1, from, to, o = {}) { const t = nowT(o), e = typeof o.ease === 'function' ? o.ease : (u => 1 - (1 - clamp(u)) ** 3);
  const v = lerp(from, to, e(seg(t, t0, t1))), d = o.decimals ?? (Math.abs(to - from) < 10 && to % 1 ? 1 : 0); return +v.toFixed(d); }
/** typeOn(text, t0, cps, { t, cursor }): the part of text typed by t at cps characters / s (+ a blinking cursor) */
export function typeOn(str, t0, cps = 18, o = {}) { const t = nowT(o), n = clamp(Math.floor((t - t0) * cps), 0, str.length), s = str.slice(0, n);
  if (!o.cursor) return s; const typing = n < str.length && t >= t0; return s + (typing || (t * 2) % 2 < 1 ? (o.cursor === true ? '_' : o.cursor) : ''); }

/**
 * attach(rig, 'handR' | 'handL' | joint name, obj, { as, offset, rot }): parent obj to the palm (grip) / joint. as 'phone':
 * a phone whose local +Y is its long side and +Z its screen is laid in the palm, screen out. Sets userData.over = true.
 */
export function attach(rig, where, obj, o = {}) {
  const j = rig.joints[{ handR: 'gripR', handL: 'gripL', R: 'gripR', L: 'gripL' }[where] ?? where]; if (!j) throw new Error(`anim attach: no joint "${where}"`);
  j.add(obj);   // (the grip is inside the person's scaled body: the object scales with the person)
  if (o.as === 'phone') { const sz = obj.userData.size ?? [.075, .155, .01]; obj.position.set(0, -.01, (sz[2] ?? .01) / 2 + .004); obj.rotation.set(0, 0, Math.PI); }
  if (o.offset) obj.position.set(...o.offset); if (o.rot) obj.rotation.set(...o.rot);
  obj.userData.over = true; return obj;
}

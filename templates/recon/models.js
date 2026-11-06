// Reconstruction models: the rigged mannequin crowd + airliner, cabin, cockpit, map, props. All procedural matte clay.
// Every asset is QA'd alone, full frame, from several angles in scenes/assets.js before it is used in a shot.
import { THREE, MAT, C, clamp, lerp, E, selectable } from './engine.js';
import { RoundedBoxGeometry } from './vendor/jsm/geometries/RoundedBoxGeometry.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// box(): every call returns its own geometry (scene code may move or bend it), copied from one made per size: making the
// rounded corners was most of the time a shot took to build (a cabin and its crowd ask for the same few sizes thousands
// of times; a busy cabin shot 0.9 s), and the copy is a plain array copy.
const BOXES = new Map();
export const box = (w, h, d, r = .02, s = 3) => {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3), k = `${w}|${h}|${d}|${rr}|${s}`;
  let g = BOXES.get(k); if (!g) { g = new RoundedBoxGeometry(w, h, d, s, rr); BOXES.set(k, g); if (BOXES.size > 5000) BOXES.delete(BOXES.keys().next().value); }
  const c = new THREE.BufferGeometry().copy(g); c.type = g.type; c.parameters = { ...g.parameters }; return c;
};
export function mesh(geo, mat = MAT.clay, p = [0, 0, 0], r = [0, 0, 0], parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r); m.castShadow = m.receiveShadow = true; parent?.add(m); return m;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? .85, metalness: 0, ...o.x });
const M = {
  joint: std(0xeae8e3),                                  // mannequin joint balls: a shade darker than the limbs (multiplied by tint)
  glass: std(0x2a3037, { r: .25 }), frame: std(0xd9d8d3), seam: std(0xbfbdb6), metal: std(0x6c7178, { r: .45 }), black: std(0x1d2024, { r: .5 }),
  sky: new THREE.MeshBasicMaterial({ color: 0xf3f5f7, toneMapped: false }),
  pane: std(0x9fb1c2, { r: .3 }), shade: std(0xeceae5), carpet: std(0x8a8984, { r: 1 }), seatFab: std(0xb9b8b2, { r: .95 }), seatCover: std(0xecebe7),
  ceiling: std(0xf2f1ee, { x: { emissive: 0xffffff, emissiveIntensity: .18 } }), cove: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
};
// place a mesh on a surface: position p, facing along normal n (its local +Z points out of the surface)
function onSurface(m, p, n, parent, up = V3(0, 1, 0)) {
  m.position.copy(p); const q = new THREE.Matrix4().lookAt(V3(), n, up); m.quaternion.setFromRotationMatrix(q); m.rotateY(Math.PI); parent.add(m); return m;
}

// =====================================================================================================================
// THE RIG
// A wooden artist's mannequin: 18 joints (Object3D pivots, metres, character faces +Z, its left is +X).
// Rest pose = standing straight, arms hanging. A joint's rotation is an Euler (x, y, z) in its parent's space:
//   hip/shoulder x < 0 swings the limb FORWARD, knee x > 0 bends the shin back, elbow x < 0 bends the forearm forward,
//   spine/chest/neck/head x > 0 leans forward, shoulder z > 0 lifts the left arm sideways (z < 0 for the right).
// Bodies are drawn as instanced parts (one InstancedMesh per part kind), so a full cabin is ~40 draw calls.
// =====================================================================================================================
const JOINTS = {   // name: [parent, rest offset]
  hips: ['root', [0, .98, 0]], spine: ['hips', [0, .1, 0]], chest: ['spine', [0, .18, 0]], neck: ['chest', [0, .29, 0]], head: ['neck', [0, .08, 0]],
  shL: ['chest', [.19, .22, 0]], elL: ['shL', [0, -.29, 0]], wrL: ['elL', [0, -.26, 0]], fiL: ['wrL', [0, -.088, 0]],
  shR: ['chest', [-.19, .22, 0]], elR: ['shR', [0, -.29, 0]], wrR: ['elR', [0, -.26, 0]], fiR: ['wrR', [0, -.088, 0]],
  hipL: ['hips', [.095, -.05, 0]], knL: ['hipL', [0, -.44, 0]], anL: ['knL', [0, -.435, 0]],
  hipR: ['hips', [-.095, -.05, 0]], knR: ['hipR', [0, -.44, 0]], anR: ['knR', [0, -.435, 0]],
};
const sph = new THREE.SphereGeometry(1, 32, 20);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 8, 20);
// tapered shapes from a unit sphere: f(t) scales x/z by height t (0 bottom .. 1 top)
function shaped(fx, fz = fx) {
  const g = new THREE.SphereGeometry(1, 36, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 1) / 2; p.setX(i, p.getX(i) * fx(t)); p.setZ(i, p.getZ(i) * fz(t)); }
  g.computeVertexNormals(); return g;
}
const sstep = t => t * t * (3 - 2 * t);
const chestGeo = (() => { const g = shaped(t => .72 + .3 * sstep(Math.min(1, t * 1.15)), t => .8 + .12 * Math.sin(t * Math.PI)); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > .55) p.setY(i, .55 + (y - .55) * .45); } g.computeVertexNormals(); return g; })();   // ribcage: square shoulders, narrow waist
const pelvisGeo = shaped(t => .82 + .18 * t, t => .9);
const thighGeo = (() => { const g = cap(.066, .3), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 - .18 * clamp((-p.getY(i) + .15) / .3); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
const shinGeo = (() => { const g = cap(.05, .31), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 - .25 * clamp((-p.getY(i) + .15) / .3); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
const footGeo = box(.085, .06, .225, .028);
const handGeo = box(1, 1, 1, .32);                                                    // mitten: a soft block, palm flat
// part kinds: [joint, geometry, offset, scale, material]
const PARTS = [
  ['hips', pelvisGeo, [0, -.015, 0], [.158, .11, .1]],
  ['spine', shaped(t => .78 + .22 * Math.abs(t - .5) * 2), [0, .07, -.004], [.098, .12, .074]],   // waist: a slim tapered connector, narrowest in the middle
  ['chest', chestGeo, [0, .13, -.004], [.19, .235, .11]],
  ['neck', cap(.037, .07), [0, .03, 0], [1, 1, 1], 'joint'],
  ['head', sph, [0, .1, .012], [.087, .112, .098]],
  ...['L', 'R'].flatMap(s => [
    ['sh' + s, sph, [0, 0, 0], [.054, .054, .054], 'joint'],
    ['sh' + s, cap(.045, .19), [0, -.145, 0], [1, 1, 1]],
    ['el' + s, sph, [0, 0, 0], [.04, .04, .04], 'joint'],
    ['el' + s, cap(.037, .17), [0, -.13, 0], [1, 1, 1]],
    ['wr' + s, sph, [0, 0, 0], [.03, .03, .03], 'joint'],
    ['wr' + s, handGeo, [0, -.046, 0], [.03, .088, .074]],                          // palm
    ['fi' + s, handGeo, [0, -.034, 0], [.025, .072, .07]],                          // the four fingers as one curling block
    ['wr' + s, cap(.0125, .03), [s === 'L' ? -.01 : .01, -.04, .04], [1, 1, 1], null, [.5, 0, s === 'L' ? .35 : -.35]],  // thumb
    ['hip' + s, sph, [0, 0, 0], [.066, .066, .066], 'joint'],
    ['hip' + s, thighGeo, [0, -.22, 0], [1, 1, 1]],
    ['kn' + s, sph, [0, 0, 0], [.052, .052, .052], 'joint'],
    ['kn' + s, shinGeo, [0, -.215, 0], [1, 1, 1]],
    ['an' + s, sph, [0, 0, 0], [.036, .036, .036], 'joint'],
    ['an' + s, footGeo, [0, -.04, .052], [1, 1, 1]],
  ]),
];
const PART_M = PARTS.map(([, , p, s, , r]) => new THREE.Matrix4().compose(V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(r || [0, 0, 0]))), V3(...s)));

// ---------- poses ----------
const d = Math.PI / 180;
export const POSE = {
  stand: { shL: [2 * d, 0, 7 * d], shR: [2 * d, 0, -7 * d], elL: [-10 * d, 0, 0], elR: [-10 * d, 0, 0], hipL: [0, 0, 1.5 * d], hipR: [0, 0, -1.5 * d] },
  // seated: thighs level, shins down, forearms resting on the thighs
  sit: { dy: -.47, spine: [-4 * d, 0, 0], chest: [-4 * d, 0, 0], neck: [6 * d, 0, 0],
    hipL: [-86 * d, 0, 3 * d], hipR: [-86 * d, 0, -3 * d], knL: [84 * d, 0, 0], knR: [84 * d, 0, 0], anL: [-4 * d, 0, 0], anR: [-4 * d, 0, 0],
    shL: [-4 * d, 0, 5 * d], shR: [-4 * d, 0, -5 * d], elL: [-74 * d, 0, -10 * d], elR: [-74 * d, 0, 10 * d] },
  // brace position: bent forward over the knees, head down, hands clasped over the head
  brace: { dy: -.47, spine: [13 * d, 0, 0], chest: [10 * d, 0, 0], neck: [24 * d, 0, 0], head: [10 * d, 0, 0],
    hipL: [-84 * d, 0, 6 * d], hipR: [-84 * d, 0, -6 * d], knL: [76 * d, 0, 0], knR: [76 * d, 0, 0],
    shL: [-112 * d, 0, 8 * d], shR: [-112 * d, 0, -8 * d], elL: [-58 * d, 0, -12 * d], elR: [-58 * d, 0, 12 * d] },
  // standing on a wing: knees soft, arms out for balance
  balance: { dy: -.025, spine: [4 * d, 0, 0], hipL: [-8 * d, 0, 7 * d], hipR: [-5 * d, 0, -7 * d], knL: [14 * d, 0, 0], knR: [11 * d, 0, 0],
    anL: [-6 * d, 0, 0], anR: [-6 * d, 0, 0], shL: [-8 * d, 0, 58 * d], shR: [-8 * d, 0, -58 * d], elL: [-22 * d, 0, 0], elR: [-22 * d, 0, 0] },
  wave: { shL: [2 * d, 0, 7 * d], shR: [-18 * d, 0, -148 * d], elL: [-10 * d, 0, 0], elR: [-28 * d, 0, 0], neck: [-8 * d, 0, 0] },
  lookUp: { neck: [-14 * d, 0, 0], head: [-18 * d, 0, 0] },
  huddle: { dy: -.02, spine: [8 * d, 0, 0], neck: [10 * d, 0, 0], shL: [-22 * d, -62 * d, -4 * d], shR: [-24 * d, 62 * d, 4 * d], elL: [-118 * d, 0, 0], elR: [-112 * d, 0, 0],
    hipL: [-4 * d, 0, 3 * d], hipR: [-4 * d, 0, -3 * d], knL: [8 * d, 0, 0], knR: [8 * d, 0, 0] },
};
export function mix(a, b, k) {
  const o = {}, keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const j of keys) {
    if (j === 'dy') { o.dy = lerp(a.dy ?? 0, b.dy ?? 0, k); continue; }
    const A = a[j] || [0, 0, 0], B = b[j] || [0, 0, 0]; o[j] = [lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k)];
  }
  return o;
}
export const add = (a, b) => { const o = { ...a }; for (const j in b) { if (j === 'dy') o.dy = (a.dy ?? 0) + b.dy; else { const A = a[j] || [0, 0, 0]; o[j] = [A[0] + b[j][0], A[1] + b[j][1], A[2] + b[j][2]]; } } return o; };
// walk(phase): a procedural gait (phase in cycles; 1 cycle = 2 steps). Root bob in dy.
// walk(phase): a gait cycle (phase in cycles; 1 cycle = 2 steps, left leg forward at phase .25).
// Hip angle h = -sin(a) * 24 deg (negative = thigh forward). A leg SWINGS while its hip angle moves forward
// (d/da of -sin = -cos < 0 -> cos > 0 for the left leg): only then does its knee bend and the foot leave the floor.
// In stance the knee is nearly straight and the ankle cancels hip + knee so the sole stays flat on the floor.
// Pelvis is highest when the legs pass each other (sin = 0), lowest at double support (|sin| = 1).
// Move a walker with walkAt(), never by a free speed: its feet are planted only at WALK.stride metres per cycle.
export function walk(ph, amt = 1) {
  const a = ph * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
  const leg = (sgn) => {                                            // sgn: +1 left, -1 right
    const hip = -sgn * s * 24, sw = Math.max(0, sgn * c), swing = Math.pow(sw, 1.4);   // swing weight 0..1
    const knee = 5 + 58 * swing, ankle = -(hip + knee) * (1 - swing) - 6 * swing;
    return { hip: hip * d * amt, knee: knee * d * amt, ankle: ankle * d * amt };
  };
  const L = leg(1), R = leg(-1);
  return { dy: -.034 * s * s * amt, spine: [4 * d, -s * 4 * d * amt, 0], chest: [0, s * 6 * d * amt, 0], neck: [-3 * d, -s * 3 * d * amt, 0],
    hipL: [L.hip, 0, 1.5 * d], hipR: [R.hip, 0, -1.5 * d], knL: [L.knee, 0, 0], knR: [R.knee, 0, 0], anL: [L.ankle, 0, 0], anR: [R.ankle, 0, 0],
    // arms swing opposite to their leg, elbows a little more bent on the forward swing
    shL: [s * 18 * d * amt, 0, 6 * d], shR: [-s * 18 * d * amt, 0, -6 * d], elL: [(-12 - Math.max(0, s) * 16) * d, 0, 0], elR: [(-12 - Math.max(0, -s) * 16) * d, 0, 0] };
}
// WALK.stride: metres travelled per cycle with planted feet, measured from the rig itself (stance foot travel x 2)
export const WALK = { stride: 1.2 };
// walkAt(person, from, dir, distance, o): place + pose a walker `distance` metres along `dir` from `from` (world, y = floor);
// the gait phase is derived from the distance, so feet stay planted whatever the speed curve. o.look: [yaw, pitch] for the head
export function walkAt(person, from, dir, dist, o = {}) {
  const D = dir.clone().setY(0).normalize(), P = from.clone().addScaledVector(D, dist);
  person.place(P.x, P.y, P.z, Math.atan2(D.x, D.z));
  const cyc = Math.floor(dist / WALK.stride), rem = dist - cyc * WALK.stride, T = WALK.table; let lo = 0, hi = T.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= rem) lo = m; else hi = m; }
  const ph = (lo + (rem - T[lo]) / Math.max(1e-9, T[hi] - T[lo])) / (T.length - 1);
  const pose = walk(cyc + ph + (o.phase0 ?? 0), o.amt ?? 1);
  let P2 = o.blend ? mix(pose, o.blendTo ?? POSE.stand, o.blend) : pose;                 // blend toward a standing pose when stopping
  if (o.look) { P2 = { ...P2, neck: [(P2.neck?.[0] ?? 0) + o.look[1] * .4, o.look[0] * .45, 0], head: [o.look[1] * .6, o.look[0] * .55, 0] }; }
  return person.apply(P2);
}
// a small per-person variation (head turn, lean) so a crowd never looks copy-pasted; arms stay inside the seat
export function jitter(seed, amt = 1) {
  let s = seed * 9301 + 49297; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647 - .5);
  return { neck: [r() * 12 * d * amt, r() * 26 * d * amt, r() * 6 * d * amt], head: [r() * 8 * d * amt, r() * 14 * d * amt, 0],
    spine: [r() * 5 * d * amt, r() * 5 * d * amt, r() * 3 * d * amt], elL: [r() * 10 * d * amt, 0, 0], elR: [r() * 10 * d * amt, 0, 0] };
}

const _e = new THREE.Euler(), _m = new THREE.Matrix4();
class Person {
  constructor(cast, i, o) {
    this.cast = cast; this.i = i; this.name = o.name ?? null; this.root = new THREE.Object3D(); this.j = { root: this.root }; this.rest = {};
    for (const [n, [p, off]] of Object.entries(JOINTS)) { const o3 = new THREE.Object3D(); o3.position.set(...off); this.j[p].add(o3); this.j[n] = o3; this.rest[n] = V3(...off); }
    this.scale = o.scale ?? 1; this.root.scale.setScalar(this.scale); this.color = new THREE.Color(o.color ?? C.clay); this.visible = true;
    this.place(o.x ?? 0, o.y ?? 0, o.z ?? 0, o.ry ?? 0); this.apply(o.pose || POSE.stand);
  }
  place(x, y, z, ry) { this.root.position.set(x, y, z); if (ry != null) this.root.rotation.y = ry; return this; }
  apply(p) {
    this.lastPose = p;
    for (const n in JOINTS) { const r = p[n]; if (r) { _e.set(r[0], r[1], r[2]); this.j[n].quaternion.setFromEuler(_e); } else this.j[n].quaternion.identity(); }
    this.j.hips.position.y = this.rest.hips.y + (p.dy ?? 0);
    if (!p.fiL) this.curl('L', .35); if (!p.fiR) this.curl('R', .35);           // relaxed hands: fingers slightly bent
    return this;
  }
  // curl(side, a): bend the fingers toward the palm (0 = straight, ~.4 relaxed, ~1.4 a closed grip)
  curl(side, a) { this.j['fi' + side].quaternion.setFromEuler(new THREE.Euler(0, 0, side === 'L' ? -a : a)); return this; }
  // orientHand(side, palmN, fingerDir, curl): turn the hand in WORLD space so its palm faces palmN and its (straight)
  // fingers point along fingerDir. Every contact uses this: lap, seat back, sidestick, book, head.
  orientHand(side, palmN, fingerDir, curl) {
    const wr = this.j['wr' + side]; this.root.updateMatrixWorld(true);
    const X = palmN.clone().normalize().multiplyScalar(side === 'L' ? -1 : 1);                  // local +x in world
    const Y = fingerDir.clone().normalize().multiplyScalar(-1); Y.sub(X.clone().multiplyScalar(Y.dot(X))).normalize();   // local +y = against the fingers
    const Z = new THREE.Vector3().crossVectors(X, Y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    wr.quaternion.copy(wr.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
    if (curl != null) this.curl(side, curl); return this;
  }
  // place a hand so the middle of its palm sits at `point`, resting against a surface whose outward normal is
  // -palmN (the palm faces palmN): IK to the wrist, then orientation. pole = where the elbow should point (world).
  handTo(side, point, palmN, fingerDir, curl, pole) {
    const f = fingerDir.clone().normalize(), n = palmN.clone().normalize();
    const wrist = point.clone().addScaledVector(f, -.046 * this.scale).addScaledVector(n, -.016 * this.scale);
    this.reach(side, wrist, pole); return this.orientHand(side, n, f, curl);
  }
  fwd() { this.root.updateMatrixWorld(true); return V3(0, 0, 1).transformDirection(this.root.matrixWorld); }        // the way the figure faces
  tint(hex) { this.color.set(hex); return this; }
  // settle(): a seated figure rests its hands on its thighs (two-bone IK to a point on each thigh, elbows out and back,
  // palms turned down). Call after apply(); does nothing when standing.
  settle(o = {}) {
    if ((this.lastPose?.dy ?? 0) > -.3) return this;
    this.root.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? 1 : -1, hip = this.j['hip' + side].getWorldPosition(V3()), kn = this.j['kn' + side].getWorldPosition(V3());
      const t = hip.clone().lerp(kn, o.along ?? .62).add(V3(0, .072 * this.scale, 0)).add(this.root.localToWorld(V3(-s * .015, 0, 0)).sub(this.root.getWorldPosition(V3())));
      const along = kn.clone().sub(hip).setY(0).normalize();
      this.handTo(side, t, V3(0, -1, 0), along, .3, this.root.localToWorld(V3(s * .3, .55, -.6)));
    }
    return this;
  }
  // world(name): joint position in the CAST's space (= the space of the parent passed to cast(); what handTo/reach expect).
  // scenePos(name): the same joint in true world space (for overlays/cameras when the cast rides a moved parent, e.g. a deck).
  world(name) { this.root.parent?.updateMatrixWorld(true); this.root.updateMatrixWorld(true); return this.j[name].getWorldPosition(V3()); }
  scenePos(name) { const g = this.cast.group; g.updateMatrixWorld(true); return this.world(name).applyMatrix4(g.matrixWorld); }
  // box(): the figure's bounds in true world space (the editor's selection box when it is clicked)
  box() {
    const g = this.cast.group, b = new THREE.Box3(); g.updateMatrixWorld(true); this.root.parent?.updateMatrixWorld(true); this.root.updateMatrixWorld(true);
    for (const n in this.j) b.expandByPoint(this.j[n].getWorldPosition(V3()).applyMatrix4(g.matrixWorld));
    b.expandByPoint(this.j.head.localToWorld(V3(0, .22, 0)).applyMatrix4(g.matrixWorld));
    return b.expandByScalar(.12 * this.scale);
  }
  // brace(k): hands move from the lap (k = 0) to the seat back ahead (k = 1, local z = back), palms flat against it.
  // Call after apply(mix(sit, brace, k)).
  brace(k, back = .5) {
    this.root.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? 1 : -1, hip = this.j['hip' + side].getWorldPosition(V3()), kn = this.j['kn' + side].getWorldPosition(V3());
      const lap = hip.clone().lerp(kn, .62).add(V3(0, .072 * this.scale, 0)), F = this.fwd(), along = kn.clone().sub(hip).setY(0).normalize();
      // a seat ahead: palms flat on its back. No seat ahead (front row): hands over the back of the bowed head.
      const seat = this.frontRow ? this.j.head.localToWorld(V3(s * .045, .12, -.03)) : this.root.localToWorld(V3(s * .12, .9, back - .02));
      const pole = this.frontRow ? this.root.localToWorld(V3(s * .6, .9, .3)) : this.root.localToWorld(V3(s * lerp(.3, .32, k), lerp(.55, .4, k), lerp(-.6, .65, k)));
      const palm = this.frontRow ? V3(0, -1, 0) : F, fing = this.frontRow ? F.clone() : V3(0, 1, 0).addScaledVector(F, -.15);
      const n = V3(0, -1, 0).lerp(palm, k).normalize(), f = along.clone().lerp(fing, k).normalize();
      this.handTo(side, lap.lerp(seat, k), n, f, lerp(.3, this.frontRow ? .9 : .15, k), pole);
    }
    return this;
  }
  // grip(side): after reach(), turn the hand so the palm wraps a vertical grip (fingers forward, thumb up)
  grip(side, point, inboard, pole) {                     // inboard: unit vector from the hand toward the grip (horizontal)
    const F = this.fwd(); return this.handTo(side, point.clone().addScaledVector(inboard, -.03 * this.scale), inboard, F.clone().add(V3(0, -.25, 0)), 1.35, pole);
  }
  // Two-bone IK: put the left/right wrist on `target` (rig space), elbow pointing toward `pole` (rig space).
  reach(side, target, pole) {
    const sh = this.j['sh' + side], el = this.j['el' + side], wr = this.j['wr' + side];
    this.root.updateMatrixWorld(true);
    const S = sh.getWorldPosition(V3()), L1 = this.rest['el' + side].length() * this.scale, L2 = this.rest['wr' + side].length() * this.scale;
    const dir = target.clone().sub(S); const dist = clamp(dir.length(), .05, (L1 + L2) * .999); dir.normalize();
    const cosE = clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1), bend = Math.PI - Math.acos(cosE);
    el.quaternion.setFromAxisAngle(V3(1, 0, 0), -bend);
    const wl = V3(0, -L1, 0).add(V3(0, -L2, 0).applyAxisAngle(V3(1, 0, 0), -bend)).normalize();
    const qAim = new THREE.Quaternion().setFromUnitVectors(wl, dir);
    const elbowDirL = V3(0, -1, 0).applyQuaternion(qAim);
    const P = (pole || S.clone().add(V3(0, -1, -.4))).clone().sub(S);
    const proj = v => v.clone().sub(dir.clone().multiplyScalar(v.dot(dir))).normalize();
    const a = proj(elbowDirL), b = proj(P); let ang = Math.acos(clamp(a.dot(b), -1, 1)); if (a.clone().cross(b).dot(dir) < 0) ang = -ang;
    const qWorld = new THREE.Quaternion().setFromAxisAngle(dir, ang).multiply(qAim);
    sh.quaternion.copy(sh.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(qWorld));
    wr.quaternion.identity();
    return this;
  }
}
// cast(parent, max): the crowd. cast.add({ x, y, z, ry, pose, color, scale, name }) -> Person; call cast.sync() every frame
// after posing. name: what the editor calls the figure when it is clicked ('Captain Sullenberger'); a click selects one person.
export function cast(parent, max = 200) {
  const group = new THREE.Group(), rig = new THREE.Group(); group.name = 'cast'; parent.add(group);
  const mats = { body: MAT.white, joint: M.joint };
  const meshes = PARTS.map(([, geo, , , mk]) => { const m = new THREE.InstancedMesh(geo, mats[mk || 'body'], max); m.count = 0; m.castShadow = m.receiveShadow = true; m.frustumCulled = false; group.add(m); return m; });
  const people = [];
  const api = {
    group, people, drawn: [],
    add(o = {}) { const p = new Person(api, people.length, o); rig.add(p.root); people.push(p); return p; },
    sync() {
      rig.updateMatrixWorld(true); let n = 0; api.drawn.length = 0;
      for (const p of people) {
        if (!p.visible) continue; api.drawn.push(p);
        PARTS.forEach(([j], k) => { _m.multiplyMatrices(p.j[j].matrixWorld, PART_M[k]); meshes[k].setMatrixAt(n, _m); meshes[k].setColorAt(n, p.color); });
        n++;
      }
      for (const m of meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.boundingSphere = m.boundingBox = null; }   // raycasts test the moved bodies
    },
  };
  for (const m of meshes) m.userData.castOf = api;
  return api;
}

// ---------- instancing helper for static props ----------
export function inst(parent, parts, mats) {
  return parts.map(pt => {
    const local = new THREE.Matrix4().compose(V3(...(pt.p || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(pt.r || [0, 0, 0]))), V3(...(pt.s || [1, 1, 1])));
    const m = new THREE.InstancedMesh(pt.geo, pt.mat || MAT.clay, mats.length);
    mats.forEach((Mx, i) => m.setMatrixAt(i, _m.multiplyMatrices(Mx, local)));
    m.castShadow = pt.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
  });
}
const at = (x, y, z, ry = 0, s = 1) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V3(s, s, s));

// =====================================================================================================================
// CABIN: single aisle, rows along -Z (front = -Z), 3 + 3 seats. Returns { group, seats: [{ x, z, row, col }], frontZ, len, zc }
// Interior shots need light from inside: S.studio({ interior: true }).
// =====================================================================================================================
export const CAB = { pitch: .8, seatW: .5, aisle: .56, R: 2.02, cy: .72 };
function seatParts() {
  return [
    { geo: box(.46, .13, .48, .05), mat: M.seatFab, p: [0, .44, -.02] },                       // cushion
    { geo: box(.46, .76, .1, .045), mat: M.seatFab, p: [0, .86, .245], r: [-.15, 0, 0] },        // back
    { geo: box(.4, .2, .04, .02), mat: M.seatCover, p: [0, 1.12, .195], r: [-.15, 0, 0], cast: false },  // headrest cover (front)
    { geo: box(.4, .2, .03, .015), mat: M.seatCover, p: [0, 1.12, .305], r: [-.15, 0, 0], cast: false }, // headrest cover (back)
    { geo: box(.34, .26, .015, .01), mat: M.frame, p: [0, .86, .305], r: [-.15, 0, 0], cast: false },   // tray table on the back
    { geo: box(.06, .02, .02, .005), mat: M.seam, p: [0, 1.0, .325], r: [-.15, 0, 0], cast: false },    // tray latch
    { geo: box(.36, .16, .02, .01), mat: M.seam, p: [0, .58, .275], r: [-.06, 0, 0], cast: false },    // seat pocket
    { geo: box(.05, .05, .42, .02), mat: M.frame, p: [-.25, .64, .02] },                         // armrest
    { geo: box(.03, .26, .03, .01), mat: M.metal, p: [-.25, .5, .2] },                           // armrest post
    { geo: box(.04, .38, .04, .01), mat: M.metal, p: [-.17, .19, -.12], r: [.12, 0, 0] },        // legs
    { geo: box(.04, .38, .04, .01), mat: M.metal, p: [.17, .19, -.12], r: [.12, 0, 0] },
    { geo: box(.04, .04, .5, .01), mat: M.metal, p: [0, .02, 0], s: [9, 1, 1] },                 // floor track
  ];
}
export function cabin(parent, o = {}) {
  const g = selectable(new THREE.Group(), 'cabin', 'interior'); parent.add(g);
  const rows = o.rows ?? 26, z0 = o.z0 ?? 0, len = rows * CAB.pitch + 3.4, zc = z0 - len / 2 + 1.4, R = CAB.R, cy = CAB.cy, cut = o.cutaway;
  const seatMats = [], seats = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < 6; c++) {
    const x = (c < 3 ? -1 : 1) * (CAB.aisle / 2 + CAB.seatW * ([2, 1, 0, 0, 1, 2][c] + .5)), z = z0 - r * CAB.pitch;
    seatMats.push(at(x, 0, z)); seats.push({ x, z, row: r, col: c });
  }
  inst(g, seatParts(), seatMats);
  // aisle-side armrest of each block
  const aisleArms = []; for (let r = 0; r < rows; r++) for (const s of [-1, 1]) aisleArms.push(at(s * (CAB.aisle / 2 + .02), 0, z0 - r * CAB.pitch));
  inst(g, [{ geo: box(.05, .05, .42, .02), mat: M.frame, p: [0, .64, .02] }, { geo: box(.03, .26, .03, .01), mat: M.metal, p: [0, .5, .2] }], aisleArms);
  // shell: theta 0 = bottom, + toward +x (after the rotation that lays it along z)
  const wallMat = std(0xebeae6, { x: { side: THREE.DoubleSide } });
  const arcs = cut ? [[.62, 1.5], [-2.12, 1.5]] : [[.62, Math.PI * 2 - 1.24]];
  for (const [a0, al] of arcs) for (const rr of cut ? [R, R + .14] : [R]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, len, 96, 1, true, a0, al), wallMat);
    tube.rotation.x = Math.PI / 2; tube.position.set(0, cy, zc); tube.receiveShadow = true; tube.castShadow = !!cut; g.add(tube);
  }
  if (cut) for (const s of [-1, 1]) {                                           // the cut edge: a solid rim along the wall top
    const a = s > 0 ? .62 + 1.5 : -.62 - 1.5 + 0, x = Math.sin(Math.abs(a)) * (R + .07) * s, y = cy - Math.cos(Math.abs(a)) * (R + .07);
    mesh(box(.16, .05, len, .02), M.frame, [x, y, zc], [0, 0, 0], g);
  }
  // ONE floor surface: carpet, aisle runner and seat tracks are painted into its texture (never stacked planes)
  const fc = document.createElement('canvas'); fc.width = 256; fc.height = 2048; { const x = fc.getContext('2d'), k = 256 / 3.7;
    x.fillStyle = '#8a8984'; x.fillRect(0, 0, 256, 2048); x.fillStyle = '#b3b1aa'; x.fillRect(128 - (CAB.aisle - .04) / 2 * k, 0, (CAB.aisle - .04) * k, 2048);
    x.fillStyle = '#7a7974'; for (const sx of [-1.3, -.8, .8, 1.3]) x.fillRect(128 + sx * k - 1.5, 0, 3, 2048); }
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace; ft.anisotropy = 8;
  const floor = mesh(new THREE.PlaneGeometry(3.7, len), new THREE.MeshStandardMaterial({ map: ft, roughness: 1 }), [0, 0, zc], [-Math.PI / 2, 0, 0], g); floor.castShadow = false; floor.name = 'cabin floor';
  // windows: recessed pane + rounded frame + a shade (some pulled half down), one per row each side
  const wy = 1.12, dy = wy - cy, wx = Math.sqrt(R * R - dy * dy);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < rows; r++) for (const s of [-1, 1]) {
    const z = z0 - r * CAB.pitch + .06, n = V3(-s * wx, -dy, 0).normalize(), p = V3(s * wx, wy, z);
    onSurface(mesh(box(.36, .5, .03, .14), M.frame), p.clone().add(n.clone().multiplyScalar(.012)), n, g, V3(0, 1, 0));
    onSurface(mesh(box(.24, .36, .02, .1), M.pane), p.clone().add(n.clone().multiplyScalar(.02)), n, g);
    const k = rnd(); if (k < .45) { const h = .36 * (k < .2 ? 1 : .5); const sh = mesh(box(.245, h, .012, .02), M.shade); onSurface(sh, p.clone().add(n.clone().multiplyScalar(.032)).add(V3(0, (.36 - h) / 2, 0)), n, g); }
  }
  if (!cut) {
    // ceiling (softly lit), cove lights, overhead bins with door seams, passenger service units with reading lights
    const ceil = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, len - .4, 48, 1, true, Math.PI - .38, .76), std(0xf2f1ee, { x: { side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: .22 } }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, -.1, zc); g.add(ceil);
    const binShape = new THREE.Shape([[0, 0], [.62, .04], [.78, .2], [.74, .46], [.5, .56], [0, .5]].map(([a, b]) => new THREE.Vector2(a, b)));
    const binGeo = new THREE.ExtrudeGeometry(binShape, { depth: len - .8, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2 });
    for (const s of [-1, 1]) {
      const b = mesh(binGeo, std(0xf3f2ef), [s * 1.86, 1.66, zc - (len - .8) / 2 + .4], [0, 0, 0], g); b.scale.x = -s; b.castShadow = false;
      mesh(box(.03, .03, len - .8, .01), M.cove, [s * 1.08, 2.24, zc + .4], [0, 0, 0], g).castShadow = false;          // cove light
      const seams = [], psu = [];
      for (let r = 0; r < rows; r += 2) seams.push(at(s * 1.115, 1.76, z0 - r * CAB.pitch - .4));
      for (let r = 0; r < rows; r++) psu.push(at(s * 1.42, 1.655, z0 - r * CAB.pitch - .1));
      inst(g, [{ geo: box(.012, .012, .1, .004), mat: M.black, cast: false }], seams);
      inst(g, [{ geo: box(.5, .012, .36, .006), mat: M.frame, cast: false },
        { geo: new THREE.CylinderGeometry(.025, .025, .012, 16), mat: M.black, p: [-.12, -.012, 0], cast: false },
        { geo: new THREE.CylinderGeometry(.025, .025, .012, 16), mat: M.black, p: [0, -.012, 0], cast: false },
        { geo: new THREE.CylinderGeometry(.025, .025, .012, 16), mat: M.black, p: [.12, -.012, 0], cast: false }], psu);
    }
  }
  // front bulkhead with the cockpit door
  const fz = z0 - (rows - 1) * CAB.pitch - 1.2;
  if (!cut) {
    const bh = new THREE.Mesh(new THREE.CircleGeometry(R + .05, 64), std(0xe9e8e4)); bh.position.set(0, cy, fz); g.add(bh); bh.receiveShadow = true;
    mesh(box(.9, 1.98, .06, .03), std(0xdcdbd6), [0, 1.0, fz + .03], [0, 0, 0], g);
    mesh(box(.14, .03, .04, .012), M.metal, [.3, 1.0, fz + .08], [0, 0, 0], g);
    mesh(new THREE.CylinderGeometry(.035, .035, .02, 20), M.black, [0, 1.6, fz + .07], [Math.PI / 2, 0, 0], g);
    mesh(box(.34, .12, .04, .015), M.black, [0, 2.12, fz + .04], [0, 0, 0], g);                           // EXIT sign housing
  }
  return { group: g, seats, frontZ: fz, len, zc };
}
export function fill(crowd, seats, o = {}) {
  const out = [];
  seats.forEach((s, i) => {
    if (o.skip?.(s, i)) return;
    const shade = [0xf3f2ef, 0xeeede9, 0xf6f5f2, 0xe9e8e4][(i * 7) % 4];
    const p = crowd.add({ x: s.x, y: .02, z: s.z - .04, ry: Math.PI, pose: POSE.sit, color: shade, scale: .94 + ((i * 37) % 9) / 100 });
    p.seat = s; p.seed = i; p.frontRow = s.row === (o.rows ?? Math.max(...seats.map(x => x.row))); out.push(p);
  });
  return out;
}

// =====================================================================================================================
// AIRLINER (A320-like), metres, nose toward -Z, wings along X, fuselage axis at y = 0. s = distance from the nose.
// =====================================================================================================================
export const AC = { L: 37.6, R: 1.98 };
const NOSE = 6.2, TAIL0 = 27.4;
export function fusR(s) {
  const { L, R } = AC;
  if (s < NOSE) return R * Math.pow(1 - Math.pow(1 - s / NOSE, 2.3), 1 / 2.3);
  if (s < TAIL0) return R;
  return lerp(R, .34, Math.pow((s - TAIL0) / (L - TAIL0), 1.25));
}
export function fusY(s) {                        // centreline height: nose sits low, tail cone sweeps up
  if (s < NOSE) return -.42 * Math.pow(1 - s / NOSE, 2);
  if (s > TAIL0) return 1.3 * Math.pow((s - TAIL0) / (AC.L - TAIL0), 1.5);
  return 0;
}
const zOf = s => s - AC.L / 2;
// a point on the skin: s along, phi around (0 = top, +90 deg = starboard +x side), plus outward normal
function skin(s, phi, inset = 0) {
  const r = fusR(s) - inset, y = fusY(s), ds = .05, dr = (fusR(s + ds) - fusR(s - ds)) / (2 * ds), dyc = (fusY(s + ds) - fusY(s - ds)) / (2 * ds);
  const p = V3(Math.sin(phi) * r, y + Math.cos(phi) * r, zOf(s));
  const n = V3(Math.sin(phi), Math.cos(phi), -(dr + Math.cos(phi) * dyc)).normalize();
  return { p, n };
}
// the wing: planform in (span x, chord c from the root leading edge), thickness tapers to the tip, 5 deg dihedral
export const WING = { s0: 12.6, y0: -1.25, span: 17.0, sweep: 7.0, rootC: 6.6, tipC: 1.5, dih: .087 };
export function wingAt(x) {                       // |x| -> { y: top surface, zLE, zTE } in airliner space
  const ax = Math.abs(x), k = ax / WING.span, le = WING.s0 + WING.sweep * k, c = lerp(WING.rootC, WING.tipC, k);
  return { y: WING.y0 + ax * WING.dih + .27 * (1 - .6 * k), zLE: zOf(le), zTE: zOf(le + c) };
}
export const ENG = { x: 5.75, y: -2.3, s: 11.6 };
export function airliner(parent, o = {}) {
  const g = selectable(new THREE.Group(), 'airliner', 'vehicle'); parent?.add(g);
  const { L } = AC, mat = o.mat || std(0xf3f2ef, { r: .7 });
  // fuselage: rings along s (lathe), then each ring shifted to its centreline height; closed nose and tail
  const prof = [];
  for (let i = 0; i <= 120; i++) { const s = (i / 120) * L; prof.push(new THREE.Vector2(Math.max(.001, fusR(s)), s)); }
  prof.push(new THREE.Vector2(.001, L + .01));
  const fg = new THREE.LatheGeometry(prof, 72); fg.rotateX(Math.PI / 2);
  const pos = fg.attributes.position;
  for (let i = 0; i < pos.count; i++) { const s = pos.getZ(i); pos.setY(i, pos.getY(i) + fusY(s)); pos.setZ(i, zOf(s)); }
  fg.computeVertexNormals();
  mesh(fg, mat, [0, 0, 0], [0, 0, 0], g);
  // belly fairing under the wing box
  mesh(sph, mat, [0, -1.55, zOf(15.4)], [0, 0, 0], g).scale.set(1.55, .7, 6.4);
  // cabin windows on the skin, overwing exits, doors (flush plates, a seam shade darker)
  const wm = [];
  for (let s = 7.2; s < 28.6; s += .53) { if (s > 15.0 && s < 16.9) continue; for (const side of [-1, 1]) { const { p, n } = skin(s, side * 1.36, -.004); const m4 = new THREE.Matrix4().lookAt(V3(), n, V3(0, 1, 0)); const q = new THREE.Quaternion().setFromRotationMatrix(m4); wm.push(new THREE.Matrix4().compose(p, q, V3(1, 1, 1))); } }
  inst(g, [{ geo: box(.23, .31, .03, .1), mat: M.glass, cast: false }], wm);
  for (const side of [-1, 1]) {
    for (const [s, w, h, ph] of [[5.9, .82, 1.85, 1.62], [27.0, .78, 1.8, 1.62], [15.35, .5, .92, 1.42], [16.45, .5, .92, 1.42]]) {
      const { p, n } = skin(s, side * ph, -.006); onSurface(mesh(box(w, h, .02, .1), M.seam), p, n, g);
      const { p: p2, n: n2 } = skin(s, side * ph, -.012); onSurface(mesh(box(w - .06, h - .06, .02, .08), mat), p2, n2, g);
    }
    // cockpit windows: windshield + two side windows
    // cockpit glazing on one line: two windshield panes meeting at the centre post, then two side windows
    // each pane placed by height above the axis (not by angle), so the glazing reads as one band
    for (const [s, yt, w, h] of [[2.0, .78, .6, .4], [2.72, .72, .62, .42], [3.42, .68, .6, .4], [4.08, .66, .44, .38]]) {
      const ph = Math.acos(clamp((yt - fusY(s)) / fusR(s), -1, 1)); const { p, n } = skin(s, side * ph, -.008); onSurface(mesh(box(w, h, .03, .07), M.glass), p, n, g);
    }
  }
  // wings (one geometry, mirrored by scale -1), thickness tapered toward the tip, dihedral baked in
  const ws = new THREE.Shape([[0, 0], [WING.span, WING.sweep], [WING.span, WING.sweep + WING.tipC], [6.2, 6.9], [0, WING.rootC]].map(([a, b]) => new THREE.Vector2(a, b)));
  const wgeo = new THREE.ExtrudeGeometry(ws, { depth: .34, bevelEnabled: true, bevelThickness: .1, bevelSize: .1, bevelSegments: 4, curveSegments: 1 });
  wgeo.rotateX(Math.PI / 2);                               // shape y (chord) -> +z, extrude depth -> -y
  { const p = wgeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), k = x / WING.span; p.setY(i, (p.getY(i) + .17) * (1 - .6 * k) + x * WING.dih); } wgeo.computeVertexNormals(); }
  // sharklet: an upswept fin on the tip (top surface, aft), canted out
  const sk = new THREE.Shape([[0, 0], [1.25, 0], [.85, 2.3], [.45, 2.3]].map(([a, b]) => new THREE.Vector2(a, b)));
  const skgeo = new THREE.ExtrudeGeometry(sk, { depth: .08, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 2 }); skgeo.rotateY(-Math.PI / 2);
  for (const side of [-1, 1]) {
    const w = mesh(wgeo, mat, [0, WING.y0, zOf(WING.s0)], [0, 0, 0], g); w.scale.x = side;
    const tip = wingAt(WING.span - .05);
    const s2 = mesh(skgeo, mat, [side * (WING.span - .02), tip.y - .08, tip.zLE + .1], [0, 0, -side * .25], g);
    // engine on its pylon, under and ahead of the wing
    const eg = new THREE.Group(); eg.position.set(side * ENG.x, ENG.y, zOf(ENG.s)); g.add(eg);
    const nac = new THREE.LatheGeometry([[.80, -2.22], [.9, -2.32], [1.0, -2.26], [1.07, -1.9], [1.08, -.6], [1.0, .7], [.82, 1.7], [.6, 2.15]].map(([r, z]) => new THREE.Vector2(r, z)), 64);
    nac.rotateX(Math.PI / 2);
    const nm = mesh(nac, o.mat ? Object.assign(o.mat.clone(), { side: THREE.DoubleSide }) : std(0xf3f2ef, { r: .7, x: { side: THREE.DoubleSide } }), [0, 0, 0], [0, 0, 0], eg);
    mesh(new THREE.CircleGeometry(.8, 48), M.black, [0, 0, -1.7], [Math.PI, 0, 0], eg).castShadow = false;
    const fan = new THREE.Group(); fan.position.z = -1.78; eg.add(fan);
    mesh(new THREE.ConeGeometry(.24, .5, 32), o.mat ?? std(0xf3f2ef), [0, 0, -.2], [-Math.PI / 2, 0, 0], fan);
    const bladeGeo = box(.085, .56, .015, .006); bladeGeo.translate(0, .5, 0);
    for (let b = 0; b < 30; b++) { const bl = mesh(bladeGeo, M.metal, [0, 0, 0], [0, 0, 0], fan); bl.rotation.set(0, 0, (b / 30) * Math.PI * 2); bl.rotateY(.62); bl.castShadow = false; }
    mesh(new THREE.ConeGeometry(.5, 1.0, 40), std(0x8d9198, { r: .5 }), [0, 0, 2.6], [Math.PI / 2, 0, 0], eg);   // exhaust plug
    // pylon: a slim swept fairing from the nacelle top up into the wing (side profile extruded across x)
    const top = wingAt(ENG.x).y - .2 - ENG.y, pyl = new THREE.Shape([[-1.4, .95], [2.6, .95], [3.6, top], [.9, top]].map(([a, b]) => new THREE.Vector2(a, b)));
    const pg = new THREE.ExtrudeGeometry(pyl, { depth: .2, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 3 }); pg.translate(0, 0, -.1); pg.rotateY(-Math.PI / 2);
    mesh(pg, mat, [0, 0, 0], [0, 0, 0], eg);
    g.userData['fan' + (side < 0 ? 'R' : 'L')] = fan;
  }
  // tail: vertical fin (thick at the root, thin at the top) + horizontal stabilisers with dihedral
  const fin = new THREE.Shape([[0, 0], [4.9, 0], [7.9, 6.2], [5.9, 6.3]].map(([a, b]) => new THREE.Vector2(a, b)));
  const fgeo2 = new THREE.ExtrudeGeometry(fin, { depth: .3, bevelEnabled: true, bevelThickness: .1, bevelSize: .1, bevelSegments: 3 });
  fgeo2.translate(0, 0, -.15); fgeo2.rotateY(-Math.PI / 2);
  { const p = fgeo2.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 - .55 * clamp(p.getY(i) / 6.3))); fgeo2.computeVertexNormals(); }
  const finS = 28.6; mesh(fgeo2, mat, [0, fusY(finS + 2) + fusR(finS + 2) - .45, zOf(finS)], [0, 0, 0], g);
  const hs = new THREE.Shape([[0, 0], [6.2, 3.1], [6.2, 4.3], [0, 3.9]].map(([a, b]) => new THREE.Vector2(a, b)));
  const hgeo = new THREE.ExtrudeGeometry(hs, { depth: .18, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 2 }); hgeo.rotateX(Math.PI / 2);
  { const p = hgeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, (p.getY(i) + .09) * (1 - .5 * p.getX(i) / 6.2) + p.getX(i) * .1); hgeo.computeVertexNormals(); }
  const hsS = 31.4; for (const side of [-1, 1]) { const h = mesh(hgeo, mat, [0, fusY(hsS + 1.5) + .05, zOf(hsS)], [0, 0, 0], g); h.scale.x = side; }
  mesh(new THREE.CircleGeometry(.2, 24), M.black, [0, fusY(L) , zOf(L) + .02], [0, 0, 0], g).castShadow = false;   // APU exhaust
  return g;
}

// ---------- props ----------
export function plinth(parent, r = 2.2, h = .5) {
  const g = selectable(new THREE.Group(), 'plinth', 'prop'); parent.add(g);
  mesh(new THREE.CylinderGeometry(r, r * 1.02, h, 128), std(0xf0efec), [0, h / 2, 0], [0, 0, 0], g);
  mesh(new THREE.TorusGeometry(r - .02, .02, 8, 128), M.seam, [0, h, 0], [Math.PI / 2, 0, 0], g);
  return g;
}
// display stand for a model on a plinth: a slim post
export function stand(parent, h, y0 = 0) { return mesh(new THREE.CylinderGeometry(.05, .08, h, 24), M.frame, [0, y0 + h / 2, 0], [0, 0, 0], parent); }

// Canada goose: grey-brown body, black neck and head, white chin strap; wings hinge at the shoulders. flap(t)
export function goose(parent) {
  const g = selectable(new THREE.Group(), 'goose', 'animal'); parent.add(g);
  const bodyM = std(0x8f877b), darkM = std(0x222326), whiteM = std(0xeeeae2), wingM = std(0x7d766b);
  const bodyCurve = new THREE.SplineCurve([[.001, -.52], [.09, -.47], [.17, -.34], [.215, -.12], [.22, .08], [.19, .3], [.12, .46], [.05, .56], [.001, .6]].map(([r, z]) => new THREE.Vector2(r, z)));
  const body = new THREE.LatheGeometry(bodyCurve.getPoints(48), 40);
  body.rotateX(Math.PI / 2); mesh(body, bodyM, [0, 0, 0], [0, 0, 0], g).scale.set(1, .85, 1);
  mesh(sph, whiteM, [0, -.08, .18], [0, 0, 0], g).scale.set(.15, .1, .3);                            // pale belly
  const neck = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, .05, -.45), V3(0, .2, -.62), V3(0, .4, -.7), V3(0, .5, -.78)]), 20, .055, 12);
  mesh(neck, darkM, [0, 0, 0], [0, 0, 0], g);
  mesh(sph, darkM, [0, .52, -.84], [0, 0, 0], g).scale.set(.065, .065, .1);
  mesh(sph, whiteM, [0, .49, -.8], [0, 0, 0], g).scale.set(.068, .04, .06);                            // chin strap
  mesh(new THREE.ConeGeometry(.03, .1, 12), darkM, [0, .5, -.96], [-Math.PI / 2, 0, 0], g);
  mesh(sph, darkM, [0, .04, .6], [0, 0, 0], g).scale.set(.08, .04, .12);                              // short dark tail
  mesh(sph, whiteM, [0, -.02, .5], [0, 0, 0], g).scale.set(.09, .05, .08);                           // white rump
  // wings in two hinged parts (arm + hand with the long primaries), so a downstroke bends like a real wingbeat
  const armShape = new THREE.Shape(new THREE.SplineCurve([[0, 0], [.25, -.02], [.46, 0], [.46, .3], [.25, .33], [0, .34]].map(([a, b]) => new THREE.Vector2(a, b))).getPoints(30));
  const handShape = new THREE.Shape(new THREE.SplineCurve([[0, 0], [.22, .0], [.45, .06], [.56, .17], [.4, .24], [.18, .29], [0, .3]].map(([a, b]) => new THREE.Vector2(a, b))).getPoints(30));
  const ext = sh => { const g2 = new THREE.ExtrudeGeometry(sh, { depth: .02, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 1 }); g2.rotateX(Math.PI / 2); g2.translate(0, 0, -.22); return g2; };
  const armGeo = ext(armShape), handGeo2 = ext(handShape);
  const wings = [-1, 1].map(s => { const arm = new THREE.Group(); arm.position.set(s * .14, .1, 0); g.add(arm); const a = mesh(armGeo, wingM, [0, 0, 0], [0, 0, 0], arm); a.scale.x = s;
    const hand = new THREE.Group(); hand.position.set(s * .45, 0, .01); arm.add(hand); const h = mesh(handGeo2, darkM.clone(), [0, 0, 0], [0, 0, 0], hand); h.material.color.set(0x5f5a52); h.scale.x = s; return { arm, hand, s }; });
  // flap(t, k): wingbeat at ~3 Hz (Canada goose), the hand lags the arm. k = 0..1 flare (wings raised and spread: startle)
  g.userData.flap = (t, flare = 0) => wings.forEach(({ arm, hand, s }) => { const ph = t * 2 * Math.PI * 3 + g.id;
    const beat = Math.sin(ph) * .55 + .05, lag = Math.sin(ph - .8) * .45;
    arm.rotation.z = s * -(beat * (1 - flare) + flare * .9); hand.rotation.z = s * -(lag * (1 - flare) + flare * -.2); arm.rotation.y = s * flare * .3; });
  g.userData.flap(0);
  return g;
}
// particles(parent, n, { color, size, opacity, map }) -> soft round sprites with per-particle size and alpha.
// update with p.userData.set(i, x, y, z, size, alpha) then p.userData.commit(). World-size (metres) sizes, attenuated.
export function particles(parent, n, o = {}) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), sz = new Float32Array(n), al = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('size', new THREE.BufferAttribute(sz, 1)); geo.setAttribute('alpha', new THREE.BufferAttribute(al, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { color: { value: new THREE.Color(o.color ?? 0xffffff) }, opacity: { value: o.opacity ?? 1 }, scale: { value: 1080 * (o.ss ?? 2) / 2 } },
    vertexShader: `attribute float size; attribute float alpha; varying float vA; uniform float scale;
      void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * scale / max(.001, -mv.z) * projectionMatrix[1][1]; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying float vA;
      void main(){ vec2 d = gl_PointCoord - .5; float r = length(d) * 2.; float a = smoothstep(1., .35, r) * vA * opacity; if (a < .003) discard; gl_FragColor = vec4(color, a); }` });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; parent.add(pts);
  pts.userData.set = (i, x, y, z, s2, a) => { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; sz[i] = s2; al[i] = a; };
  pts.userData.commit = () => { geo.attributes.position.needsUpdate = geo.attributes.size.needsUpdate = geo.attributes.alpha.needsUpdate = true; };
  return pts;
}
export const hash = (i, n) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
// NY Waterway-style passenger ferry: dark lower hull, white upper hull, two glazed decks, wheelhouse, rails
export function ferry(parent) {
  const g = selectable(new THREE.Group(), 'ferry', 'vehicle'); parent.add(g);
  const plan = (L, W, bow) => new THREE.Shape([[-L / 2, -W / 2], [L / 2 - bow, -W / 2], [L / 2, 0], [L / 2 - bow, W / 2], [-L / 2, W / 2]].map(([a, b]) => new THREE.Vector2(a, b)));
  const slab = (shape, h, m, y) => { const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: .15, bevelThickness: .15, bevelSegments: 2 }); geo.rotateX(-Math.PI / 2); return mesh(geo, m, [0, y, 0], [0, 0, 0], g); };
  slab(plan(24, 8, 4), 1.4, std(0x4c5258), -1.2);
  slab(plan(24, 8, 4), 1.1, std(0xf3f2ef), .2);
  slab(plan(18, 6.6, 2.6), 2.4, std(0xf0efeb), 1.4);
  slab(plan(12, 5.6, 1.6), 2.2, std(0xf0efeb), 3.95);
  mesh(box(4, 1.6, 4, .3), std(0xf0efeb), [1.5, 6.95, 0], [0, 0, 0], g);
  // window bands with mullions
  for (const s of [-1, 1]) {
    mesh(box(15.4, 1.1, .05, .05), M.glass, [-.6, 2.75, s * 3.47], [0, 0, 0], g); mesh(box(9.6, 1.0, .05, .05), M.glass, [-.6, 5.15, s * 2.97], [0, 0, 0], g);
    const mm = []; for (let x = -8; x <= 6.8; x += 1.2) mm.push(at(x, 2.75, s * 3.5)); inst(g, [{ geo: box(.1, 1.12, .06, .02), mat: std(0xf0efeb), cast: false }], mm);
    const m2 = []; for (let x = -5.2; x <= 4.2; x += 1.2) m2.push(at(x, 5.15, s * 3.0)); inst(g, [{ geo: box(.1, 1.02, .06, .02), mat: std(0xf0efeb), cast: false }], m2);
    // deck rail
    const posts = []; for (let x = -11.5; x <= 8; x += .8) posts.push(at(x, 1.85, s * 3.85)); inst(g, [{ geo: box(.05, .7, .05, .01), mat: M.frame }], posts);
    mesh(box(19.6, .05, .05, .01), M.frame, [-1.7, 2.2, s * 3.85], [0, 0, 0], g);
  }
  mesh(box(.05, 1.2, 3.6, .05), M.glass, [3.52, 7.0, 0], [0, 0, 0], g);                         // wheelhouse windscreen
  for (const s of [-1, 1]) mesh(box(2.6, .9, .05, .05), M.glass, [1.5, 7.05, s * 2.02], [0, 0, 0], g);
  mesh(new THREE.CylinderGeometry(.07, .07, 2, 12), M.frame, [.5, 8.6, 0], [0, 0, 0], g);       // mast
  return g;
}
// slide-raft: a tube ring with a floor. raft.userData.seat(k, n) -> { x, y, z, ry } for passenger k of n (in raft space)
export function raft(parent) {
  const g = selectable(new THREE.Group(), 'raft', 'vehicle'); parent.add(g);
  const tubeM = std(0xf0dfae, { r: .7 }), RX = 2.3, RZ = 1.5, tube = .32;
  const ring = []; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; ring.push(V3(Math.cos(a) * RX, 0, Math.sin(a) * RZ)); }
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 128, tube, 20, true), tubeM, [0, 0, 0], [0, 0, 0], g);
  const fl = mesh(new THREE.CylinderGeometry(1, 1, .06, 64), std(0xe2d3a4), [0, -.22, 0], [0, 0, 0], g); fl.scale.set(RX - .1, 1, RZ - .1);
  g.userData.top = tube;                                                                           // tube top height
  g.userData.seat = (k, n) => { const a = (k / n) * Math.PI * 2 + .4; const x = Math.cos(a) * RX * .97, z = Math.sin(a) * RZ * .97; return { x, y: tube - .5 + .02, z, ry: Math.atan2(-x, -z) }; };
  return g;
}
export function water(parent, size = 600, color = C.water, amp = .12) {
  const geo = new THREE.PlaneGeometry(size, size, 160, 160); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: .55 })); m.receiveShadow = true; m.name = 'water'; m.userData.ground = true; parent.add(m);
  const p = geo.attributes.position, base = Float32Array.from(p.array);
  m.userData.tick = t => { for (let i = 0; i < p.count; i++) { const x = base[i * 3], z = base[i * 3 + 2]; p.array[i * 3 + 1] = (Math.sin(x * .09 + t * .9) + Math.sin(z * .13 - t * .7) * .8) * amp; } p.needsUpdate = true; geo.computeVertexNormals(); };
  return m;
}

// =====================================================================================================================
// COCKPIT (A320-style flight deck). Front = -Z, floor y = 0. Captain left (x < 0), F/O right. Windows glow (sky).
// =====================================================================================================================
function screenTex(kind) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#101215'; x.fillRect(0, 0, 512, 512);
  if (kind === 'pfd') {
    x.save(); x.beginPath(); x.rect(120, 70, 270, 370); x.clip(); x.fillStyle = '#3d7fd0'; x.fillRect(120, 70, 270, 190); x.fillStyle = '#8a5a2b'; x.fillRect(120, 260, 270, 190);
    x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(120, 260); x.lineTo(390, 260); x.stroke();
    for (const y of [200, 230, 290, 320]) { x.beginPath(); x.moveTo(225, y); x.lineTo(285, y); x.stroke(); } x.restore();
    x.fillStyle = '#f2c94c'; x.fillRect(190, 256, 50, 8); x.fillRect(270, 256, 50, 8);
    x.fillStyle = '#2b2f36'; x.fillRect(30, 70, 70, 370); x.fillRect(410, 70, 80, 370); x.fillStyle = '#fff'; x.font = '22px monospace';
    for (let i = 0; i < 6; i++) { x.fillText(String(220 - i * 10), 36, 100 + i * 64); x.fillText(String(3000 - i * 100), 414, 100 + i * 64); }
  } else if (kind === 'nd') {
    x.strokeStyle = '#e6e6e6'; x.lineWidth = 3; x.beginPath(); x.arc(256, 420, 280, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
    x.beginPath(); x.arc(256, 420, 150, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
    x.strokeStyle = '#4ad66d'; x.beginPath(); x.moveTo(256, 420); x.lineTo(256, 120); x.stroke();
    x.fillStyle = '#4ad66d'; x.font = '24px monospace'; x.fillText('GS 182', 20, 40); x.fillText('TAS 190', 20, 70);
  } else if (kind === 'mcdu') {
    x.fillStyle = '#4ad66d'; x.font = '30px monospace'; ['  INIT', 'CO RTE   ALTN', 'FROM/TO', 'KLGA/KCLT', 'FLT NBR', 'AWE1549'].forEach((l, i) => x.fillText(l, 30, 70 + i * 66));
  } else {
    x.fillStyle = '#ff9f1a'; x.font = 'bold 30px monospace'; x.fillText('ENG DUAL FAILURE', 40, 80);
    x.fillStyle = '#fff'; x.font = '24px monospace'; ['-ENG MODE SEL....IGN', '-THR LEVERS......IDLE', '-OPT RELIGHT SPD.300KT', '-APU..............START'].forEach((l, i) => x.fillText(l, 40, 140 + i * 44));
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function cockpit(parent) {
  const g = selectable(new THREE.Group(), 'cockpit', 'interior'); parent.add(g);
  const shellM = std(0xeceae6, { x: { side: THREE.DoubleSide } }), panelM = std(0xdedcd6), darkPanel = std(0x8c9096, { r: .7 });
  // shell: a lathe around the z axis, squashed to a real flight-deck height (~2.25 m), narrowing into the nose.
  // Its windows are emissive sky panes on the shell with a frame behind them.
  const cy = .95, K = .66, shellR = z => (z > -.9 ? 1.95 : lerp(1.95, 1.0, Math.pow((-.9 - z) / 1.9, 1.3)));
  const prof = []; for (let i = 0; i <= 40; i++) { const z = lerp(1.8, -2.8, i / 40); prof.push(new THREE.Vector2(shellR(z), z)); }
  prof.push(new THREE.Vector2(.6, -3.05), new THREE.Vector2(.001, -3.15));
  const sg = new THREE.LatheGeometry(prof, 64, .62, Math.PI * 2 - 1.24); sg.rotateX(Math.PI / 2); sg.scale(1, K, 1); sg.translate(0, cy, 0);
  mesh(sg, shellM, [0, 0, 0], [0, 0, 0], g).castShadow = false;
  const pane = (z, phi, w, h) => { const r = shellR(z) - .03, p = V3(Math.sin(phi) * r, cy + Math.cos(phi) * r * K, z), n = V3(-Math.sin(phi), -Math.cos(phi) / K, .45).normalize();
    onSurface(mesh(box(w, h, .02, .08), M.sky), p, n, g); onSurface(mesh(box(w + .12, h + .12, .02, .1), panelM), p.clone().add(n.clone().multiplyScalar(-.014)), n, g); };
  for (const s of [-1, 1]) { pane(-1.95, s * .5, .78, .5); pane(-1.25, s * .95, .72, .5); pane(-.45, s * 1.08, .56, .44); }
  mesh(box(.1, .62, .1, .03), panelM, [0, cy + Math.cos(.15) * shellR(-1.95) * K - .05, -1.98], [-.6, 0, 0], g);   // windshield centre post
  const cf = mesh(new THREE.PlaneGeometry(3.3, 4.6), std(0xa5a39c, { r: 1 }), [0, 0, -.4], [-Math.PI / 2, 0, 0], g); cf.castShadow = false; cf.name = 'cockpit floor';
  // rear bulkhead (closes the shell behind the seats) with the cockpit door
  { const bh = new THREE.Mesh(new THREE.CircleGeometry(1.95, 64), shellM); bh.scale.y = K; bh.position.set(0, cy, 1.78); bh.rotation.y = Math.PI; g.add(bh);
    mesh(box(.8, 1.9, .05, .03), std(0xdcdbd6), [.55, .95, 1.74], [0, 0, 0], g); mesh(box(.04, .14, .04, .01), M.metal, [.25, 1.0, 1.7], [0, 0, 0], g); }
  // glareshield with the flight control unit, main instrument panel with six bezelled screens
  mesh(box(2.7, .16, .55, .07), panelM, [0, 1.3, -1.52], [0, 0, 0], g);
  mesh(box(1.5, .14, .06, .02), darkPanel, [0, 1.29, -1.24], [0, 0, 0], g);
  for (let i = 0; i < 8; i++) mesh(new THREE.CylinderGeometry(.022, .022, .03, 16), M.black, [-.6 + i * .17, 1.29, -1.2], [Math.PI / 2, 0, 0], g).castShadow = false;
  const panel = mesh(box(2.7, .72, .14, .04), panelM, [0, .86, -1.66], [-.1, 0, 0], g);
  const kinds = ['pfd', 'nd', 'ecam', 'ecam', 'nd', 'pfd'], xs = [-1.04, -.65, -.2, .2, .65, 1.04];
  // the two ECAM screens stack in the centre: each is shorter so they never overlap (overlapping coplanar quads z-fight)
  const screens = kinds.map((k, i) => { const e = k === 'ecam', y = e ? (i === 2 ? .135 : -.135) : 0, xx = e ? 0 : xs[i], bh = e ? .25 : .4, sh = e ? .22 : .34;
    mesh(box(.4, bh, .03, .02), M.black, [xx, y, .07], [0, 0, 0], panel).castShadow = false;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.34, sh), new THREE.MeshBasicMaterial({ map: screenTex(k), toneMapped: false })); m.position.set(xx, y, .095); panel.add(m); return m; });   // 1 cm proud of the bezel: never closer (z-fight)
  // pedestal: thrust levers, engine masters, two MCDUs
  mesh(box(.56, .78, 1.3, .05), panelM, [0, .39, -.85], [0, 0, 0], g);
  const ped = mesh(box(.52, .06, 1.1, .03), darkPanel, [0, .8, -.85], [0, 0, 0], g);
  for (const s of [-1, 1]) {
    const lv = mesh(box(.04, .26, .04, .01), M.metal, [s * .09, .92, -1.05], [-.35, 0, 0], g); mesh(box(.11, .05, .06, .02), M.black, [s * .09, 1.04, -1.1], [-.35, 0, 0], g);
    const mc = new THREE.Mesh(new THREE.PlaneGeometry(.17, .13), new THREE.MeshBasicMaterial({ map: screenTex('mcdu'), toneMapped: false })); mc.position.set(s * .13, .835, -.55); mc.rotation.x = -Math.PI / 2 + .3; g.add(mc);
    mesh(new THREE.CylinderGeometry(.025, .025, .04, 16), M.black, [s * .06, .84, -.8], [0, 0, 0], g);
  }
  // side consoles, sidesticks, tables
  for (const s of [-1, 1]) {
    mesh(box(.42, .72, 1.7, .05), panelM, [s * 1.2, .36, -.2], [0, 0, 0], g);
    mesh(box(.42, .04, 1.7, .02), darkPanel, [s * 1.2, .73, -.2], [0, 0, 0], g);
    mesh(new THREE.CylinderGeometry(.022, .03, .14, 16), M.black, [s * 1.06, .8, -.07], [.12, 0, 0], g);
    mesh(cap(.026, .08), M.black, [s * 1.06, .9, -.08], [.1, 0, 0], g);                                // grip
    mesh(box(.5, .03, .4, .02), panelM, [s * .82, .78, -1.15], [0, 0, 0], g);
  }
  // overhead panel: switch rows on a sloped board
  const ovh = mesh(box(1.15, .07, 1.2, .04), panelM, [0, 2.12, -.75], [.38, 0, 0], g);
  const sw = []; for (let i = 0; i < 10; i++) for (let k = 0; k < 6; k++) sw.push(new THREE.Matrix4().makeTranslation(-.48 + i * .107, -.045, -.48 + k * .19));
  inst(ovh, [{ geo: box(.05, .03, .07, .01), mat: darkPanel, cast: false }], sw);
  // pilot seats: column, pan, back, headrest, armrests, harness straps
  const seatM = std(0xd0cec8, { r: .95 });
  for (const x of [-.62, .62]) {
    const s = new THREE.Group(); s.position.set(x, 0, 0); g.add(s);
    mesh(new THREE.CylinderGeometry(.09, .14, .4, 20), M.metal, [0, .2, 0], [0, 0, 0], s);
    mesh(box(.54, .14, .54, .06), seatM, [0, .47, 0], [0, 0, 0], s);
    mesh(box(.54, .64, .14, .07), seatM, [0, .88, .3], [-.1, 0, 0], s);
    mesh(box(.32, .2, .12, .06), seatM, [0, 1.3, .35], [-.1, 0, 0], s);
    for (const k of [-1, 1]) { mesh(box(.06, .06, .42, .02), M.metal, [k * .31, .74, .04], [0, 0, 0], s); mesh(box(.05, .6, .015, .01), M.black, [k * .12, .92, .23], [-.1, 0, 0], s).castShadow = false; }
  }
  return { group: g, screens };
}

// =====================================================================================================================
// MAP: grey New York from real coordinates (lat/lon -> km: x east, y north, origin 40.78 N 73.95 W)
// =====================================================================================================================
export const ll = (lat, lon) => [(lon + 73.95) * 84.2, (lat - 40.78) * 111];
export const NYC = {
  LGA: ll(40.7769, -73.874), TEB: ll(40.850, -74.061), DITCH: ll(40.769, -74.005), GWB: ll(40.851, -73.952),
  route: [ll(40.7769, -73.874), ll(40.789, -73.862), ll(40.806, -73.853), ll(40.822, -73.862), ll(40.832, -73.884), ll(40.844, -73.909),
    ll(40.856, -73.937), ll(40.858, -73.958), ll(40.846, -73.969), ll(40.826, -73.978), ll(40.806, -73.990), ll(40.786, -73.999), ll(40.769, -74.005)],
};
const POLY = {
  manhattan: [[40.7006, -74.0153], [40.7128, -74.0164], [40.7263, -74.0118], [40.7420, -74.0094], [40.7580, -74.0040], [40.7735, -73.9946], [40.7900, -73.9830],
    [40.8050, -73.9720], [40.8200, -73.9612], [40.8350, -73.9500], [40.8510, -73.9470], [40.8650, -73.9330], [40.8740, -73.9260], [40.8783, -73.9220],
    [40.8740, -73.9110], [40.8620, -73.9150], [40.8450, -73.9300], [40.8300, -73.9360], [40.8150, -73.9340], [40.8040, -73.9310], [40.7960, -73.9300],
    [40.7850, -73.9420], [40.7770, -73.9440], [40.7650, -73.9540], [40.7520, -73.9670], [40.7420, -73.9730], [40.7290, -73.9730], [40.7110, -73.9780],
    [40.7070, -73.9990]],
  nj: [[40.62, -74.06], [40.66, -74.07], [40.6900, -74.0440], [40.7170, -74.0350], [40.7350, -74.0290], [40.7600, -74.0230], [40.7850, -74.0080],
    [40.8050, -73.9940], [40.8300, -73.9760], [40.8530, -73.9630], [40.8800, -73.9410], [40.9100, -73.9230], [41.2, -73.88], [41.2, -74.6], [40.4, -74.6], [40.4, -74.08]],
  bronx: [[40.8800, -73.9150], [40.8740, -73.9060], [40.8620, -73.9100], [40.8450, -73.9250], [40.8300, -73.9310], [40.8150, -73.9290], [40.8050, -73.9260],
    [40.8000, -73.9150], [40.8030, -73.8950], [40.8080, -73.8700], [40.8050, -73.8500], [40.8120, -73.8300], [40.8060, -73.8100], [40.8000, -73.7930],
    [40.8150, -73.7750], [40.8350, -73.7600], [40.8500, -73.7300], [40.8700, -73.7000], [40.8900, -73.6600], [41.2, -73.5], [41.2, -73.9]],
  queens: [[40.7920, -73.9220], [40.7820, -73.9330], [40.7700, -73.9380], [40.7550, -73.9490], [40.7450, -73.9590], [40.7380, -73.9630], [40.7250, -73.9630],
    [40.7120, -73.9700], [40.7040, -73.9830], [40.7010, -73.9940], [40.6960, -74.0020], [40.6850, -74.0120], [40.6720, -74.0190], [40.6500, -74.0260],
    [40.6300, -74.0410], [40.4, -74.04], [40.4, -73.4], [40.82, -73.4], [40.8200, -73.6500], [40.8000, -73.7100], [40.7950, -73.7500], [40.7950, -73.7800], [40.7920, -73.8100], [40.7850, -73.8400], [40.7650, -73.8450],
    [40.7580, -73.8550], [40.7700, -73.8580], [40.7820, -73.8600], [40.7870, -73.8750], [40.7830, -73.8880], [40.7720, -73.8920], [40.7770, -73.9050], [40.7840, -73.9180]],
  park: [[40.7681, -73.9819], [40.7644, -73.9730], [40.7968, -73.9496], [40.8003, -73.9580]],
};
export function nycMap(parent) {
  const S = 44, N = 4096, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  const cx = -1, cy = 2, px = ([X, Y]) => [(X - cx + S / 2) / S * N, (S / 2 - (Y - cy)) / S * N];
  const path = pts => { x.beginPath(); pts.forEach((q, i) => { const [a, b] = px(ll(...q)); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); };
  x.fillStyle = '#b3c0cb'; x.fillRect(0, 0, N, N);                                                // water
  for (const k of ['nj', 'bronx', 'queens', 'manhattan']) { path(POLY[k]); x.fillStyle = '#e4e3df'; x.fill(); x.strokeStyle = '#fbfbf9'; x.lineWidth = 5; x.stroke(); }
  // Hackensack river through the Meadowlands, next to Teterboro
  x.strokeStyle = '#b3c0cb'; x.lineWidth = 22; x.lineJoin = x.lineCap = 'round'; x.beginPath();
  for (let i = 0; i <= 120; i++) { const k = i / 120, lat = 40.70 + k * .21, lon = -74.11 + k * .075 + Math.sin(k * 38) * .006 + Math.sin(k * 11) * .004; const [a, b] = px(ll(lat, lon)); i ? x.lineTo(a, b) : x.moveTo(a, b); } x.stroke();
  path(POLY.park); x.fillStyle = '#d6d6d1'; x.fill();
  // Manhattan street grid (29 deg off north), clipped to the island
  x.save(); path(POLY.manhattan); x.clip(); x.strokeStyle = 'rgba(0,0,0,.07)'; x.lineWidth = 3;
  const ang = 29 * Math.PI / 180, ux = Math.sin(ang), uy = -Math.cos(ang);
  for (let i = -60; i <= 60; i++) { const [a, b] = px([-3 + i * .08 * Math.cos(ang), 1 + i * .08 * Math.sin(ang)]); x.beginPath(); x.moveTo(a - ux * 3000, b - uy * 3000); x.lineTo(a + ux * 3000, b + uy * 3000); x.stroke(); }
  for (let i = -12; i <= 12; i++) { const [a, b] = px([-3 - i * .9 * Math.sin(ang) * -1, 1 + i * .9 * Math.cos(ang)]); x.beginPath(); x.moveTo(a - uy * 3000, b + ux * 3000); x.lineTo(a + uy * 3000, b - ux * 3000); x.stroke(); }
  x.restore();
  // runways: LaGuardia 4/22 + 13/31, Teterboro 1/19 + 6/24 (true headings), on a darker apron
  const rw = (c0, len, hdg, w = .075) => { const [a, b] = px(c0); const r = hdg * Math.PI / 180; x.save(); x.translate(a, b); x.rotate(r); x.fillStyle = '#7f817c'; x.fillRect(-w / S * N, -len / 2 / S * N, 2 * w / S * N, len / S * N); x.restore(); };
  const apron = (c0, rx, ry) => { const [a, b] = px(c0); x.fillStyle = '#d2d1cc'; x.beginPath(); x.ellipse(a, b, rx / S * N, ry / S * N, 0, 0, 7); x.fill(); };
  apron(ll(40.7765, -73.874), 1.45, .95); apron(ll(40.851, -74.061), 1.0, 1.15);
  rw(ll(40.7765, -73.8765), 2.13, 44); rw(ll(40.7775, -73.8705), 2.13, 134); rw(ll(40.851, -74.0605), 2.1, 6); rw(ll(40.852, -74.058), 1.9, 60);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.set(cx, 0, -cy); m.receiveShadow = true; m.name = 'NYC map'; m.userData.ground = true; parent.add(m);
  return m;
}
export const mp = ([X, Y], h = 0) => V3(X, h, -Y);

// wingCrowd(crowd, wingY): passengers standing on both wings, spaced so no two can touch (>= 1.05 m apart, two staggered
// rows along the chord), poses mixed so arms never reach a neighbour: arms out only at the ends of a row.
export function wingCrowd(crowd, o = {}) {
  const out = []; let i = 0;
  for (const side of [-1, 1]) {
    const spans = [2.9, 4.0, 5.2, 8.0, 9.2, 10.4];                     // gap around the engine pylon (x 5.75)
    spans.forEach((ax, k) => { for (const row of [0, 1]) {
      if (row && (k === 2 || k === 5)) continue;
      const w = wingAt(ax + row * .5), z = w.zLE + (w.zTE - w.zLE) * (row ? .62 : .3), end = k === 0 || k === 5;
      const pose = end && !row ? POSE.balance : (i % 5 === 2 ? POSE.wave : i % 3 === 0 ? POSE.huddle : POSE.stand);
      const p = crowd.add({ x: side * (ax + row * .5), y: w.y - .02, z, ry: side * (1.2 + (i % 4) * .35), color: [0xf3f2ef, 0xeceae6, 0xf6f5f2][i % 3] });
      p.spot = [p.root.position.x, p.root.position.y, z]; p.base = pose; p.seed = i++; p.apply(add(pose, jitter(p.seed, .4))); out.push(p);
    } });
  }
  return out;
}

// where the pilots' hands go: the sidestick grip (outboard) and the inboard armrest
export const STICK = { x: 1.06, y: .9, z: -.08 };      // grip centre: where an Airbus pilot's hand rests, forearm on the armrest
export const ARMREST_IN = { x: .31, y: .8, z: .02 };   // inboard armrest of a pilot seat, x relative to the seat centre

// measure the gait from the rig: for every phase, how far the body must have moved so the STANCE foot stays put
// (cumulative backward travel of whichever foot is on the floor). walkAt inverts this table: distance -> phase.
{ const p = new Person(null, 0, {}), N = 400, zs = [];
  for (let i = 0; i <= N; i++) { p.apply(walk(i / N)); p.root.updateMatrixWorld(true); zs.push([p.j.anL.getWorldPosition(V3()).z, p.j.anR.getWorldPosition(V3()).z]); }
  const cum = [0];
  for (let i = 1; i <= N; i++) { const c = Math.cos(((i - .5) / N) * Math.PI * 2), k = c <= 0 ? 0 : 1;      // left foot stands when cos <= 0
    cum.push(cum[i - 1] + Math.max(0, zs[i - 1][k] - zs[i][k])); }
  WALK.stride = cum[N]; WALK.table = cum; }

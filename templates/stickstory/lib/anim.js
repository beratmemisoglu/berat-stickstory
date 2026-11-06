// Stick stories ANIMATION: the Actor (placement, timelines, walks, sits, holds, gestures, faces, interactions, crowds).
// It drives the rig's Figure through ONE interface (ENGINE.md "The character contract"): fig.setPose(pose) every frame,
// fig.setFace(face), fig.setRim(color, dir), fig.joint(name), fig.attach(obj, side). It never draws.
//
// How it works: every call (a.walk, a.sit, a.hold, a.wave, a.hug ...) is SCHEDULED at build time on absolute video time;
// update(t) evaluates the pose as a pure function of t (snapped to the 24 fps frame, the references animate on 1s):
//   body   = the posture / locomotion segment at t (stand, walk with planted feet, sit down, stand up, kneel, lie ...)
//          + body clips (lean, bob, sway) + the idle (frozen / sway / breathing, per character)
//   arms   = the body's base arms, then arm clips in time order (holds, gestures, reaches, interactions), each blended in
//            and out with the measured timing; targets are solved with 2-bone IK from the shoulder
//   head   = head clips (look, nod, tilt, phone nod); face = expression keys + blinks + lip-sync + eye look
// Timings and angles are the study's (analysis/motion, hands, characters NOTES.md): see lib/anim/tables.js.
//
// Builder API (all chainable; `at` = absolute seconds, a narration word (S.at), or omitted = right after this actor's
// previous body action): see the README block at the end of this file.
import { THREE, FPS, E, DEG, clamp, lerp, seg as segK, easeFn, rnd, strHash, stepT, Z, SETTINGS, mixHex } from './core.js';
import * as RIG from './rig.js';
import * as PROPS from './props.js';
import * as CAST from './cast.js';
import { WALKS, GRIPS, gripOf, DEFAULT_GRIP, POSES, GESTURES, gestureOf, STANDUP_Y, STANDUP_LEAN, SIP_UP, BLINK, TALK, PHONE_NOD, IDLE, MOVES } from './anim/tables.js';
export { WALKS, GRIPS, POSES, GESTURES };

const F = 1 / FPS, PI = Math.PI, HALF = PI / 2;
const fr = n => n * F;
const FACE_BLEND = 3;          // frames: a mid-shot expression change crossfades (Actor.face)
const CUT_HOLD = 6;            // frames: a gesture whose release would start this close to the cut holds through it (Actor._clip)
const HEAD_RIM = .12;          // two heads in contact (hug, catch) overlap by at most this share of the smaller head's width
const rad = d => d * DEG;
const ease = (name, k) => easeFn(name)(clamp(k));
const tbl = (arr, x) => { if (x <= 0) return arr[0]; const n = arr.length - 1; if (x >= n) return arr[n]; const i = Math.floor(x); return lerp(arr[i], arr[i + 1], x - i); };
const angDir = a => ({ x: Math.sin(a), y: -Math.cos(a) });          // an angle from hanging straight down, + = toward +x
const angOf = (dx, dy) => Math.atan2(dx, -dy);
const wrapPI = a => { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; };
const SIDES = ['L', 'R'];
let AID = 0, EPOCH = 0;          // EPOCH: any schedule change anywhere drops every actor's pose cache (actors read each other)

// ---------------------------------------------------------------------------------------------------------------------
// views ('right', 'left', '3q-right', '3q-left', 'front', 'back', '3q-back-right', '3q-back-left' or { facing, turn, back })
const VIEWS = {
  right: { facing: 1, turn: 1 }, left: { facing: -1, turn: 1 }, 'profile-right': { facing: 1, turn: 1 }, 'profile-left': { facing: -1, turn: 1 },
  '3q-right': { facing: 1, turn: .5 }, '3q-left': { facing: -1, turn: .5 }, '3q': { facing: 1, turn: .5 },
  front: { facing: 1, turn: 0 }, back: { facing: 1, turn: 0, back: true },
  '3q-back-right': { facing: 1, turn: .5, back: true }, '3q-back-left': { facing: -1, turn: .5, back: true },
};
export function viewOf(v, cur = { facing: 1, turn: .5 }) {
  if (v == null) return { ...cur };
  if (typeof v === 'number') return { facing: v < 0 ? -1 : 1, turn: cur.turn ?? .5, back: false };
  if (typeof v === 'object') return { facing: v.facing ?? cur.facing ?? 1, turn: v.turn ?? cur.turn ?? .5, back: !!v.back };
  const s = String(v).toLowerCase().replace(/[ _]/g, '-');
  return { back: false, ...(VIEWS[s] || VIEWS[s.replace('three-quarter', '3q')] || cur) };
}

// ---------------------------------------------------------------------------------------------------------------------
// the rig's measures and conventions (probed once per figure: works with any rig that keeps the contract)
function dimsOf(fig) {
  const d = fig.dims || {};
  const H = d.height ?? fig.height ?? 1.7, D = d.headD ?? (d.headR ?? fig.headR ?? H / 10.8) * 2;
  return { height: H, headD: D, headR: D / 2, neck: d.neck ?? .2 * D, torso: d.torso ?? 2 * D, upperArm: d.upperArm ?? 1.05 * D, foreArm: d.foreArm ?? D,
    thigh: d.thigh ?? .95 * D, shin: d.shin ?? .9 * D, foot: d.foot ?? .58 * D, limbW: d.limbW ?? .25 * D, shoulderW: d.shoulderW ?? .52 * D, hipW: d.hipW ?? .36 * D,
    ankle: d.ankle ?? 0, hipY: d.hipY ?? null, footH: d.footH ?? .2 * D, seatH: d.seatH ?? null };
}
const P0 = () => RIG.POSE0 || { facing: 1, turn: 0, back: false, hip: [0, 0], lean: 0, head: { tilt: 0, nod: 0, turn: 0 }, armL: { sh: 0, el: 0 }, armR: { sh: 0, el: 0 }, legL: { hip: 0, knee: 0, foot: 0 }, legR: { hip: 0, knee: 0, foot: 0 }, handL: 'nub', handR: 'nub', near: 'R' };
const mkPose = o => { const b = P0(); if (RIG.pose) return RIG.pose(o); const r = { ...b, ...o }; for (const k of ['head', 'armL', 'armR', 'legL', 'legR']) r[k] = { ...b[k], ...(o[k] || {}) }; return r; };
const jv = j => j == null ? null : Array.isArray(j) ? { x: j[0], y: j[1] } : { x: j.x, y: j.y };
function calibrate(fig, d) {
  const hy = d.hipY ?? d.thigh + d.shin + (d.ankle ?? 0);
  const C = { ok: false, rel: true, legRel: false, mirrorOut: true, k1: false, armZ: false, hipY: hy, ankleY: d.ankle ?? 0, grip: 0,
    sh: { front: { L: [-d.shoulderW * .32, d.torso - .32 * d.headD], R: [d.shoulderW * .32, d.torso - .32 * d.headD] }, side: { L: [0, d.torso - .32 * d.headD], R: [0, d.torso - .32 * d.headD] } },
    hipJ: { front: { L: [-d.hipW * .3, 0], R: [d.hipW * .3, 0] }, side: { L: [0, 0], R: [0, 0] } },
    head: { front: [0, d.torso + d.neck + d.headR], side: [0, d.torso + d.neck + d.headR] }, neck: [0, d.torso] };
  if (typeof fig.setPose !== 'function' || typeof fig.joint !== 'function') return C;
  try {
    const J = n => jv(fig.joint(n));
    for (const [view, turn] of [['front', 0], ['side', 1]]) {
      fig.setPose(mkPose({ facing: 1, turn, hip: [0, hy], lean: 0 }));
      const hip = J('hip') || { x: 0, y: hy };
      for (const s of SIDES) { const p = J('shoulder' + s); if (p) C.sh[view][s] = [p.x - hip.x, p.y - hip.y]; const q = J('hip' + s); if (q) C.hipJ[view][s] = [q.x - hip.x, q.y - hip.y]; }
      const h = J('head'); if (h) C.head[view] = [h.x - hip.x, h.y - hip.y];
      if (view === 'side') { const n = J('neck'); if (n) C.neck = [n.x - hip.x, n.y - hip.y]; const f = J('ankleR') || J('footR'); if (f) C.ankleY = f.y;
        const w = J('wristR'), g = J('handR'); if (w && g) C.grip = Math.hypot(g.x - w.x, g.y - w.y); }
    }
    fig.setPose(mkPose({ facing: 1, turn: 1, hip: [0, hy], headScale: 1.3 }));
    { const h = J('head'), hp = J('hip'); if (h && hp) C.head13 = [h.x - hp.x, h.y - hp.y]; }
    fig.setPose(mkPose({ facing: 1, turn: 1, hip: [0, hy], lean: .5, armR: { sh: 0, el: 0 } }));
    let s = J('shoulderR'), e = J('elbowR');
    if (s && e) { const a = angOf(e.x - s.x, e.y - s.y); C.rel = Math.abs(a + .5) < Math.abs(a); }
    const hp = J('hipR'), kn = J('kneeR'); if (hp && kn) { const a = angOf(kn.x - hp.x, kn.y - hp.y); C.legRel = Math.abs(a + .5) < Math.abs(a); }
    fig.setPose(mkPose({ facing: -1, turn: 1, hip: [0, hy], lean: .5 }));
    const n2 = J('neck'), h2 = J('hip'); if (n2 && h2) C.mirrorOut = (n2.x - h2.x) < 0;
    fig.setPose(mkPose({ facing: 1, turn: 0, hip: [0, hy], legR: { hip: 0, knee: 0, foot: 0, k1: .4 } }));
    const hq = J('hipR'), kq = J('kneeR'); if (hq && kq) C.k1 = Math.abs(hq.y - kq.y) < d.thigh * .7;
    // does the rig honour an arm depth offset (pose.armR.z)? (hugs draw the hugging arm over the partner)
    fig.setPose(mkPose({ facing: 1, turn: 1, hip: [0, hy], armR: { sh: 0, el: 0, z: .1 } }));
    const z1 = fig.arms?.R?.g?.position?.z; fig.setPose(mkPose({ facing: 1, turn: 1, hip: [0, hy], armR: { sh: 0, el: 0, z: 0 } })); const z0 = fig.arms?.R?.g?.position?.z;
    C.armZ = z1 != null && z0 != null && Math.abs(z1 - z0 - .1) < 1e-3;
    C.ok = true;
  } catch (err) { console.warn('anim: rig probe failed: ' + err.message); }
  try { fig.setPose(mkPose({ facing: 1, turn: .5, hip: [0, hy] })); } catch { /* */ }
  return C;
}

// 2-bone IK in the facing-right plane. Angles from hanging straight down, + = toward +x.
// arm (bend = +1): the forearm folds forward / up (elbow down / back); leg: the shin folds back (knee forward).
function ik2(px, py, tx, ty, a, b, bend = 1) {
  let dx = tx - px, dy = ty - py, d = Math.hypot(dx, dy);
  const dMax = (a + b) * .9995, dMin = Math.abs(a - b) + 1e-4;
  if (d < 1e-6) { dx = 0; dy = -1e-3; d = 1e-3; }
  const dc = clamp(d, dMin, dMax), th = angOf(dx, dy);
  const al = Math.acos(clamp((a * a + dc * dc - b * b) / (2 * a * dc), -1, 1)), be = Math.acos(clamp((a * a + b * b - dc * dc) / (2 * a * b), -1, 1));
  return { a1: th - bend * al, bend: bend * (PI - be), reach: d <= dMax };
}

// ---------------------------------------------------------------------------------------------------------------------
// spots / seats / targets
function spotOf(S, v) {
  if (v == null) return null;
  if (typeof v === 'string') { const s = S.spots?.[v] ?? S.spot?.(v); if (!s) { console.warn(`anim: no spot "${v}"`); return null; } return { ...s, name: v }; }
  if (Array.isArray(v)) return v.length >= 3 ? { x: v[0], y: v[1], z: v[2] } : { x: v[0], z: v[1] ?? 0, y: 0 };
  if (v.isActor) return { actor: v };
  if (v.isObject3D) { v.updateMatrixWorld?.(true); const p = v.getWorldPosition(new THREE.Vector3()); return { x: p.x, y: p.y, z: p.z, obj: v, ...(v.userData?.spot || {}) }; }
  if (v.isVector3) return { x: v.x, y: v.y, z: v.z };
  return v;
}
const faceSign = f => f == null || f === 0 ? null : typeof f === 'number' ? (f < 0 ? -1 : 1) : /left/.test(f) ? -1 : /right/.test(f) ? 1 : null;
function seatOf(S, v) {
  const s = spotOf(S, v); if (!s) return null;
  let seatY = s.seatY ?? s.seat ?? null, x = s.x, z = s.z ?? 0, floorY = s.floorY ?? 0, facing = faceSign(s.facing);
  // a stool (no back: the sitter's own facing wins) and its foot rung (world y), from the prop / the spot (lessons 02-handshake)
  let rung = Number.isFinite(s.rung) ? s.rung : null, stool = !!s.stool;
  const o = s.obj;
  if (o && o.userData) {
    const u = o.userData.seat; const sc = o.getWorldScale?.(new THREE.Vector3())?.y ?? 1;
    if (typeof u === 'number') seatY = s.y + u * sc;
    else if (u && typeof u === 'object') { seatY = s.y + (u.y ?? u.h ?? .45) * sc; if (u.x != null) x = s.x + u.x * sc; facing = faceSign(u.facing) ?? facing;
      if (Number.isFinite(u.rung)) rung = s.y + u.rung * sc; if (u.stool) stool = true; }
    floorY = s.y; if (o.userData.facing != null) facing = faceSign(o.userData.facing) ?? facing;
  }
  if (seatY == null) seatY = (s.kind === 'bed' ? s.topY : null) ?? (s.y ?? 0) + .46;
  // the table in front of a seat: a spot name (places: chairN.table = 'table'), a height, or none
  let table = s.table ?? s.tableY ?? null;
  if (typeof table === 'string') { const tp = S.spots?.[table]; table = tp ? (tp.topY ?? tp.y ?? null) : null; }
  else if (table && typeof table === 'object') table = table.topY ?? table.y ?? null;
  return { x, z, floorY: s.floorY ?? (o ? floorY : 0), seatY, facing, front: s.facing === 'front' || s.facing === 0 || s.view === 'front', table: Number.isFinite(table) ? table : null, name: s.name, rung, stool };
}

// ---------------------------------------------------------------------------------------------------------------------
// prop custody: where a prop is at time t (a hand, the world, falling, jumping between two hands). Pure function of t.
function custodyOf(obj) { return (obj.userData.custody ??= []); }
function firstTouch(obj) {
  const c = custodyOf(obj);
  if (c.length) return;
  if (obj.parent) { obj.updateMatrixWorld(true); c.push({ t0: -Infinity, mode: 'world', parent: obj.parent, pos: obj.position.clone(), quat: obj.quaternion.clone(), scale: obj.scale.clone(), vis: obj.visible }); }
  else c.push({ t0: -Infinity, mode: 'hidden' });
  obj.userData._s0 ??= Math.abs(obj.scale.y) || 1;
  if (!obj.userData.grips) obj.userData.grips = {};
}
function addCustody(obj, e) { firstTouch(obj); const c = custodyOf(obj); c.push(e); c.sort((a, b) => a.t0 - b.t0); }
function custodyAt(obj, t) {
  const c = custodyOf(obj); let e = null;
  for (const x of c) { if (x.t0 <= t) e = x; else break; }
  if (e && e.t1 != null && t >= e.t1) return { mode: 'hidden' };
  return e || { mode: 'hidden' };
}
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function gripPoint(obj, name) {
  const g = obj.userData.grips || {};
  const p = g[name] ?? g[String(name).split('-')[0]] ?? g.hand ?? g.main ?? g.grip ?? Object.values(g)[0];
  if (p) return Array.isArray(p) ? p : [p.x ?? 0, p.y ?? 0];
  if (!obj.userData._autoGrip) { const b = localBox(obj); obj.userData._autoGrip = b.isEmpty() ? [0, 0] : [(b.min.x + b.max.x) / 2, b.min.y + (b.max.y - b.min.y) * .3]; }
  return obj.userData._autoGrip;
}
/** a prop's bounding box in its own space (no side effects on the scene graph) */
function localBox(obj) {
  const box = new THREE.Box3(), inv = new THREE.Matrix4(), m = new THREE.Matrix4();
  obj.updateMatrixWorld(true); inv.copy(obj.matrixWorld).invert();
  obj.traverse(c => { if (!c.isMesh || !c.geometry) return; if (!c.geometry.boundingBox) c.geometry.computeBoundingBox(); const b = c.geometry.boundingBox.clone(); m.multiplyMatrices(inv, c.matrixWorld); box.union(b.applyMatrix4(m)); });
  return box;
}
// place `obj` so its grip point sits on (wx, wy, wz) turned by `ang` (rad, world), mirrored when `mir`; keeps the local z
// the rig gave it (layering) when keepZ
function placeWorld(obj, wx, wy, wz, ang, mir, grip, keepZ) {
  const s0 = obj.userData._s0 || 1, sx = (mir ? -1 : 1) * s0, c = Math.cos(ang), s = Math.sin(ang);
  const gx = grip[0] * sx, gy = grip[1] * s0;
  _v.set(wx - (c * gx - s * gy), wy - (s * gx + c * gy), wz);
  _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang); _s.set(sx, s0, s0);
  _m.compose(_v, _q, _s);
  const par = obj.parent;
  if (par && !par.isScene) { par.updateMatrixWorld(true); _m2.copy(par.matrixWorld).invert(); _m.premultiply(_m2); }
  const z = obj.position.z;
  _m.decompose(obj.position, obj.quaternion, obj.scale);
  if (keepZ) obj.position.z = z;
}

// =====================================================================================================================
export class Actor {
  constructor(S, look = {}, o = {}) {
    this.S = S; this.isActor = true; this.o = o; this.id = ++AID;
    if (o.extra) look = { ...look, extra: true };
    if (o.look) look = { ...look, ...o.look };
    // a plaster cast / a sling for this shot: S.char('abe', { cast: 'L', sling: true }) (rig.js _cast draws them on the arm)
    if (o.cast != null || o.sling != null) look = { ...look, ...(o.cast != null ? { cast: o.cast } : {}), ...(o.sling != null ? { sling: o.sling } : {}) };
    // the arm in a sling rests across the chest all shot; holds and one-handed gestures use the other hand (poseAt, _hand)
    { const cs = look.cast === true ? 'L' : look.cast; this.castSide = cs === 'L' || cs === 'R' ? cs : null; this.sling = look.sling && this.castSide && !look.extra ? cs : null; }
    this.lookDef = look; this.name = o.name || look.name || look.id || 'someone';
    this.age = look.age === 'child' ? 'kid' : look.age === 'toddler' ? 'small' : look.age || 'adult';
    // deterministic: seeded from the name, the shot and the order of creation INSIDE the shot (never a global counter,
    // so a frame renders the same whatever was rendered before it)
    const nth = S ? (S._actorN = (S._actorN || 0) + 1) : 1;
    this.seed = o.seed ?? (strHash(this.name + '|' + (S?.t0 ?? 0) + '|' + nth) % 100000) + nth * 7;
    this.free = !!o.free;                      // keeps moving while the world is frozen (S.freeze / fx 'freeze')
    // a figure is ~64 layers (Z.step) deep: two figures at the same z would put parts at EXACTLY the same depth (z-fighting
    // decided by draw order = by what was rendered before). A fraction of a step per actor keeps every depth distinct.
    this.zBias = (((nth * 3) % 8) + 1) * Z.step / 9;
    this.headScale = o.headScale ?? null;
    this.rand = rnd(this.seed);
    this.fig = new RIG.Figure(look);
    this.d = dimsOf(this.fig); this.k = o.scale ?? 1;
    this.C = calibrate(this.fig, this.d);
    this.hStand = this.C.hipY; this.d.fa = this.d.foreArm + this.C.grip;   // IK forearm = wrist + the hand's grip point
    this.height = this.d.height * this.k; this.headR = this.d.headR * this.k;
    this.near = 'R'; this.far = 'L';
    this.root = new THREE.Group(); this.root.name = 'actor:' + this.name; this.root.userData.actor = this; this.root.userData.pickRoot = true;
    this.spin = new THREE.Group(); this.root.add(this.spin);
    this.scaleG = new THREE.Group(); this.scaleG.scale.setScalar(this.k); this.spin.add(this.scaleG);
    this.scaleG.add(this.fig.root);
    this.holds = []; this.seats = []; this.moves = []; this.touches = []; this.touched = new Set();
    this.segs = []; this.viewKeys = []; this.clips = {}; this.faceKeys = []; this.talks = []; this.lookKeys = []; this.visKeys = []; this._cid = 0;
    this.floorY = 0;
    this.extra = !!look.extra;
    // where and how it starts
    const t0 = S?.t0 ?? 0; this.t0 = t0; this.cur = t0;
    const sp = spotOf(S, o.at) || { x: 0, z: 0 };
    const v0 = viewOf(o.facing ?? sp.facing ?? (o.sit ? null : '3q-right'), { facing: 1, turn: .5 });
    this.view0 = v0;
    this.state0 = { posture: 'stand', x: sp.x ?? 0, z: sp.z ?? 0, y: sp.y ?? 0, stance: { L: -.02 * this.d.height, R: .02 * this.d.height } };
    this.floorY = this.state0.y;
    this.P = { ...this.state0, view: v0 };
    if (o.sit) { const seat = seatOf(S, o.sit); if (seat) this._setSeated(seat, o, true); }
    if (o.lie) this._setLying(o.lie, o, true);
    // start kneeling: kneel: true (upright, shins flat) | 'low' (sitting back on the heels) | 'one' (on one knee)
    if (o.kneel && !o.sit && !o.lie) { const pst = o.kneel === 'low' ? 'kneelLow' : o.kneel === 'one' ? 'kneel1' : 'kneel'; this.state0.posture = pst; this.P.posture = pst; }
    this.idle = o.idle ?? (this.extra ? 'still' : 'auto');
    if (this.idle === 'auto') this.idle = this.rand() < IDLE.autoSway ? 'sway' : 'still';
    this.idlePer = lerp(...(this.state0.posture === 'sit' ? IDLE.seatPeriod : IDLE.swayPeriod), this.rand()) * F; this.idlePh = this.rand() * PI * 2;
    this.face0 = o.face || look.face || 'neutral';
    if (o.pose) this.pose(o.pose, t0, { instant: true });
    // the rim light of the place (S.rim / S.rimDir) unless the shot gives one
    const rim = o.rim !== undefined ? o.rim : S?.rim;
    if (rim !== undefined && this.fig.setRim) { const c = rim && typeof rim === 'object' && !Array.isArray(rim) ? rim.color : rim; const dir = (rim && rim.dir) || S?.rimDir || [0, 1]; try { this.fig.setRim(c ?? null, dir); } catch { /* */ } }
    this._cache = new Map();
    this.update(t0);
  }

  // ------------------------------------------------------------------------------------------------- time helpers
  _t(at) {
    if (at == null) return this.cur;
    if (typeof at === 'number') return at;
    if (typeof at === 'string') return this.S?.at ? this.S.at(at) : this.cur;
    if (typeof at === 'object' && at.word) return this.S.at(at.word, at);
    return +at || this.cur;
  }
  _args(at, o) { if (at && typeof at === 'object' && !Array.isArray(at) && !at.word) { o = { ...at, ...(o || {}) }; at = o.at; } return [this._t(at ?? o?.at), o || {}]; }
  /** move this actor's cursor (the default start of its next action) by `sec` */
  wait(sec = .5) { this.cur += sec; return this; }
  /** set this actor's cursor to an absolute time (or a word) */
  then(at) { this.cur = this._t(at); return this; }
  _dirty() { EPOCH++; this._cache?.clear(); this._ut = null; this._blinkList = null; }
  _fresh() { const cu = !!this.S?._closeUp; if (this._ep !== EPOCH || this._cu !== cu) { this._cache.clear(); this._ut = null; this._ep = EPOCH; this._cu = cu; } }

  // ------------------------------------------------------------------------------------------------- views
  _viewAt(t) { let v = this.view0; for (const k of this.viewKeys) { if (k.t <= t) v = k.v; else break; } return v; }
  _addView(t, v) { this.viewKeys.push({ t, v }); this.viewKeys.sort((a, b) => a.t - b.t); this._dirty(); this.P.view = v; }
  /** turn to a view at `at`: 'left' | 'right' | '3q-left' | '3q-right' | 'front' | 'back' | an actor / point to face.
   *  The references swap views in ONE frame (no in-betweens); { via: '3q' } adds a 2-frame 3/4 in-between. */
  turn(dir, at, o) {
    [at, o] = this._args(at, o);
    let v;
    if (dir && (dir.isActor || Array.isArray(dir) || dir.isVector3 || dir.isObject3D)) { const tx = dir.isActor ? dir._posAt(at).x : spotOf(this.S, dir).x; const x = this._posAt(at).x; v = { ...this._viewAt(at), facing: tx < x ? -1 : 1 }; if (v.turn < .5) v.turn = .5; }
    else v = viewOf(dir, this._viewAt(at));
    if (o.via) this._addView(at - fr(2), viewOf(o.via, { ...v, turn: .5 }));
    this._addView(at, v);
    return this;
  }
  /** face another actor (both turn to each other when `both`) */
  faceEachOther(b, at, o = {}) { [at, o] = this._args(at, o); const xa = this._posAt(at).x, xb = b._posAt(at).x, tn = o.turn ?? Math.max(.5, this._viewAt(at).turn);
    this._addView(at, { facing: xb >= xa ? 1 : -1, turn: tn, back: false }); if (o.both !== false) b._addView(at, { facing: xb >= xa ? -1 : 1, turn: o.turn ?? Math.max(.5, b._viewAt(at).turn), back: false }); return this; }
  facePartner(b, at) { return this.faceEachOther(b, at); }

  // ------------------------------------------------------------------------------------------------- visibility
  _visAt(t) { let v = true; for (const k of this.visKeys) { if (k.t <= t) v = k.v; else break; } return v; }
  show(at) { this.visKeys.push({ t: this._t(at), v: true }); this.visKeys.sort((a, b) => a.t - b.t); return this; }
  hide(at) { this.visKeys.push({ t: this._t(at), v: false }); this.visKeys.sort((a, b) => a.t - b.t); return this; }

  // ------------------------------------------------------------------------------------------------- body segments
  _seg(s) { this.segs.push(s); this.segs.sort((a, b) => a.t0 - b.t0); this._dirty(); this.cur = Math.max(this.cur, isFinite(s.t1) ? s.t1 : s.t0); return s; }
  _posAt(t) { const B = this._bodyRaw(t); return { x: B.x, z: B.z, y: B.y }; }
  get D() { return this.d.headD; }
  /** the figure's own depth (its layer stack, metres): a partner put this far in front is drawn wholly over it */
  _depth() { return (this.fig.dims?.depth ?? .1) * this.k; }
  get H() { return this.d.height; }
  _hipJ(view, s) { const a = this.C.hipJ.front[s], b = this.C.hipJ.side[s], k = clamp(view.turn ?? 1); return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k) }; }
  _shOff(turn, s) { const a = this.C.sh.front[s], b = this.C.sh.side[s], k = clamp(turn ?? 1); return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]; }
  _legIK(B, s, ax, ay, o = {}) {
    const hj = this._hipJ(B, s), d = this.d;
    const r = ik2(hj.x, B.hipY + hj.y, ax, ay, d.thigh * (o.k1 ?? 1), d.shin, -1);
    // the shin folds back: knee = -(bend) in the leg convention (+ = shin folds back)
    const hip = r.a1, knee = -r.bend;
    return { hip, knee, foot: o.foot ?? (knee - hip) + (o.toe ?? 0), k1: o.k1 };
  }
  /** where a seated leg's ankle goes ([x, y] body space, facing right, y from the floor). feet: 'auto' (default) | 'floor' |
   *  'rung' | 'tuck' | 'dangle' | 'stool'. Auto: a seat at the figure's level-thigh height (dims.seatH: adult .456) puts the
   *  feet flat on the floor; a HIGHER seat (kitchen / lab stool .62, bar stool .76) puts them on the stool's rung (or lets
   *  them hang when there is none) instead of stretching straight legs to the floor; a stool at the right height keeps the
   *  near foot forward on the floor and tucks the far one back onto the rung / under the seat. (Video 02: Grandpa on the
   *  clock-shop stool read "perched": legs straight down from the stool's front edge, an empty lap, an upright trunk.) */
  _seatFoot(B, seat, s, front, feet) {
    const d = this.d, k = this.k, hj = this._hipJ(B, s), hipY = B.hipY + hj.y, floor = this.C.ankleY;
    const high = (seat.seatY - seat.floorY) / k - (d.seatH ?? d.ankle + d.shin - d.limbW / 2);   // > 0: higher than the level-thigh seat
    const rung = Number.isFinite(seat.rung) && seat.rung > seat.floorY + .05 ? (seat.rung - seat.floorY) / k + floor : null;
    const far = s !== this.near, thigh = front ? d.thigh * .18 : d.thigh;
    const hang = Math.max(floor, hipY - thigh * .2 - d.shin * .985);                    // a shin hanging straight down
    let m = feet && feet !== 'auto' ? feet : high > .045 ? (rung != null ? 'rung' : 'dangle') : seat.stool ? 'stool' : 'floor';
    if (m === 'stool') m = far ? (rung != null && rung < hipY - d.shin * .45 ? 'rung' : 'tuck') : 'floor';
    if (m === 'rung' && rung == null) m = high > .045 ? 'dangle' : 'tuck';
    if (m === 'dangle' && hang <= floor + 1e-3) m = 'floor';
    const st = (s === 'L' ? -.02 : .02) * d.height;
    if (front) { const x = hj.x * 1.2; return [x, m === 'rung' ? rung : m === 'dangle' ? hang : floor]; }
    // the rung runs across the stool under the seat: the ball of the foot on it a little ahead of the seat's centre
    const ahead = ((seat.x - (seat.hipX ?? seat.x)) * (seat.facing || 1)) / k;
    if (m === 'rung') return [ahead + d.headD * (far ? .18 : .32), rung];
    if (m === 'dangle') return [d.thigh * 1.03 + st, hang];
    if (m === 'tuck') return [d.thigh * .42 + st, floor];
    return [d.thigh * (seat.stool ? 1.12 : 1.0) + st, floor];
  }
  _standHip(B, feet) {          // the highest hip that still reaches both planted ankles
    let h = this.hStand; const L = (this.d.thigh + this.d.shin) * .998;
    for (const s of SIDES) { const f = feet[s]; if (!f || f.air) continue; const hj = this._hipJ(B, s), dx = f.x - hj.x; h = Math.min(h, Math.sqrt(Math.max(0, L * L - dx * dx)) + f.y - hj.y); }
    return h;
  }
  _armsFromPose(name, B, ctx) {
    const P = typeof name === 'string' ? POSES[name] : name; if (!P) return null;
    const front = (B.turn ?? 1) < .5, def = front ? (P.front || P.side) : (P.side || P.front);
    const out = {};
    for (const s of SIDES) { let a = def?.[s]; if (!a) continue; if (front && P.front) a = this._frontArm(a, s); out[s] = this._resolveArm(a, ctx, s); }
    return out;
  }
  // POSES' front views are written with the R arm on screen-right (+x); a rig that draws R on the other side gets them mirrored
  _frontArm(a, s) {
    if (!(this.C.sh.front.R[0] < this.C.sh.front.L[0])) return a;
    return a.to ? { ...a, to: [a.to[0], -a.to[1], a.to[2]], bend: -(a.bend ?? 1) } : { ...a, sh: -a.sh, el: -(a.el ?? 0) };
  }
  _postureBody(st, view, t) {
    const d = this.d, D = d.headD, k = this.k;
    const B = { x: st.x, y: st.y ?? 0, z: st.z ?? 0, facing: view.facing, turn: view.turn, back: !!view.back, spin: 0, pivotY: 0, hipY: this.hStand, lean: 0,
      legs: {}, arms: {}, head: { tilt: 0, nod: 0, turn: 0 }, hand: { L: 'nub', R: 'nub' }, posture: st.posture, table: null, lying: false, still: true };
    const p = st.posture;
    if (p === 'sit') {
      const seat = st.seat; B.x = seat.hipX; B.y = seat.floorY; B.z = seat.z;
      if (seat.front || view.turn < .25) { B.turn = this.C.k1 ? 0 : .5; }
      if (seat.facing && B.turn > 0) B.facing = seat.facing;
      B.hipY = (seat.seatY - seat.floorY) / k + d.limbW / 2;
      B.table = seat.table != null ? { y: (seat.table - seat.floorY) / k } : { y: B.hipY + d.torso * .42 };
      const front = B.turn < .25;
      for (const s of SIDES) {
        const [fx, fy] = this._seatFoot(B, seat, s, front, st.feet);
        if (front) B.legs[s] = { ...this._legIK(B, s, fx, fy, { k1: .18 }) };
        else B.legs[s] = this._legIK(B, s, fx, fy);
      }
      B.seated = st.seatPose && POSES[st.seatPose] ? st.seatPose : 'upright';
      const SP = POSES[B.seated];
      // a stool has no back: its sitter carries the weight forward over the seat (the references' side sitters lean ~10 deg,
      // iq500 f2209); upright on a backless stool read as perched (video 02, Grandpa at the bench)
      B.lean = rad(st.lean ?? SP.lean ?? (seat.stool ? 7 : 2)) * (B.turn < .3 ? .15 : 1);   // a front sitter can't lean sideways
      if (SP.head) B.head = { tilt: rad(SP.head.tilt || 0), nod: SP.head.nod || 0, turn: SP.head.turn || 0 };
    } else if (p === 'lie') {
      const bed = st.bed, hd = bed.headDir;
      B.facing = bed.prone ? hd : -hd; B.turn = 1; B.back = false; B.spin = -hd * HALF; B.lying = true;
      B.hipY = this.hStand; B.pivotY = this.hStand;
      B.x = bed.hipX; B.z = bed.z; B.y = bed.topY + .2 * D * k - this.hStand * k;
      for (const s of SIDES) B.legs[s] = { hip: s === 'L' ? rad(-2) : rad(2), knee: 0, foot: 0 };
      B.lean = 0;
      B.armsFixed = { L: { sh: rad(-4), el: rad(4) }, R: { sh: rad(4), el: rad(4) } };
    } else if (p === 'kneel' || p === 'kneel1') {
      B.turn = Math.max(.5, view.turn);
      if (p === 'kneel') { B.hipY = d.thigh + d.limbW / 2; for (const s of SIDES) B.legs[s] = { hip: rad(s === 'R' ? 2 : -2), knee: rad(90), foot: rad(-90) }; }
      else { B.hipY = d.thigh * .98 + d.limbW / 2; B.legs.R = this._legIK(B, 'R', d.thigh * .95, this.C.ankleY); B.legs.L = { hip: rad(-6), knee: rad(96), foot: rad(-90) }; }
    } else if (p === 'sitBed') {
      // sitting up IN bed, legs straight along it under the blanket (timeloop s16: the kid wakes and sits up in the cot)
      const bed = st.bed; B.facing = -bed.headDir; B.turn = 1; B.back = false; B.lying = true;
      B.x = bed.hipX; B.z = bed.z; B.y = bed.topY - d.limbW * .25 * k; B.hipY = d.limbW / 2; B.lean = rad(-3);
      for (const s of SIDES) B.legs[s] = { hip: HALF + (s === 'R' ? rad(2) : rad(-2)), knee: rad(3), foot: rad(-8) };
    } else if (p === 'kneelLow') {
      // sitting back on the heels (sister s264: the hero kneeling to hug his sister): knees on the floor ahead of the hips,
      // thighs ~68 deg forward, shins flat behind, the torso leaning in a little; ~0.6 H tall
      // in 3/4 views the legs point partly into the picture: their horizontal reach shrinks (rig foreshortening k1 / k2)
      B.turn = Math.max(.5, view.turn);
      const A = rad(68), fsh = lerp(.35, 1, clamp((B.turn - .5) * 2)); B.hipY = d.thigh * Math.cos(A) + d.limbW / 2; B.lean = rad(6);
      for (const s of SIDES) { const a = A + (s === 'R' ? rad(3) : rad(-3)), tx = Math.sin(a) * fsh, ty = Math.cos(a), a2 = Math.atan2(tx, ty);
        // the rig's shin is ~1.7x its thigh: laid flat it would stick out far behind the seat, so it is drawn only to just
        // behind the hips (the references hide the lower legs under the body), toes tucked (foot up)
        const shinVis = clamp((Math.sin(a) * d.thigh * fsh + .3 * D) / d.shin, .15, fsh);
        B.legs[s] = { hip: a2, knee: a2 + HALF, foot: 0, k1: Math.hypot(tx, ty), k2: shinVis }; }
    } else if (p === 'crouch') {
      B.hipY = this.hStand * .52; B.lean = rad(24);
      for (const s of SIDES) B.legs[s] = this._legIK(B, s, (s === 'R' ? .12 : -.06) * D + d.thigh * .25, this.C.ankleY);
    } else if (p === 'floor') {
      B.turn = Math.max(.5, view.turn); B.hipY = d.limbW / 2 + .01; B.lean = rad(-4);
      for (const s of SIDES) B.legs[s] = this._legIK(B, s, d.thigh * .8 + d.shin * .35 + (s === 'L' ? -.05 * D : 0), this.C.ankleY);
    } else {
      // standing (also 'bend': the hips flex, the legs stay)
      const feet = {};
      for (const s of SIDES) feet[s] = { x: this._hipJ(B, s).x + (st.stance?.[s] ?? 0) * clamp(view.turn * 1.4), y: this.C.ankleY };
      B.feet = feet; B.hipY = this._standHip(B, feet);
      if (p === 'bend') B.lean = rad(st.bendAngle ?? 70);
      for (const s of SIDES) B.legs[s] = this._legIK(B, s, feet[s].x, feet[s].y);
    }
    return B;
  }
  // the idle on top of a static posture: frozen, a slow sway (60-80 f) or breathing (36-40 f)
  _idle(B, t, since) {
    const kind = this._idleKind(t); if (kind === 'still' || B.lying) return B;
    const ramp = clamp((t - since - .4) / 1.2); if (ramp <= 0) return B;
    const g = this._gestureFreeze(t), amp = ramp * (1 - g);
    if (amp <= 0) return B;
    if (kind === 'breathe') { const per = this.idlePer * .5; B.lean += rad(1) * Math.sin(2 * PI * t / per + this.idlePh) * amp; return B; }
    const s = Math.sin(2 * PI * t / this.idlePer + this.idlePh);
    if (B.posture === 'sit') { B.lean += rad(1.6) * s * amp; return B; }
    if (B.posture === 'stand' && B.feet) {
      const dx = IDLE.swayAmp * this.d.height * s * amp;
      B.x += dx * B.facing * this.k;
      for (const side of SIDES) B.feet[side] = { ...B.feet[side], x: B.feet[side].x - dx };
      B.hipY = this._standHip(B, B.feet); B.lean += rad(.6) * s * amp;
      for (const side of SIDES) B.legs[side] = this._legIK(B, side, B.feet[side].x, B.feet[side].y);
    }
    return B;
  }
  _idleKind(t) { let k = this.idle; for (const c of this.clips.idle || []) if (c.t0 <= t && (c.t1 == null || t < c.t1)) k = c.kind; return k; }
  /** change the idle at `at`: 'still' | 'sway' | 'breathe' */
  idleAs(kind, at) { (this.clips.idle ||= []).push({ t0: this._t(at), kind }); this.clips.idle.sort((a, b) => a.t0 - b.t0); this._dirty(); return this; }
  // the head's roll at t from the head clips that need no context (marked pure: hug / group hug / tilt), for _headsApart
  // (evaluating a look clip there could read the partner's body and come back here)
  _pureTilt(t, base = 0) { let tl = base; for (const c of this.clips.head || []) { if (!c.pure) continue; const w = this._w(c, t); if (w <= 0) continue; const v = c.fn(t) || {};
    if (v.tilt != null) tl = c.add ? tl + v.tilt * w : lerp(tl, v.tilt, w); } return tl; }
  _gestureFreeze(t) { let w = 0; for (const s of SIDES) for (const c of this.clips['arm' + s] || []) if (c.gesture) w = Math.max(w, this._w(c, t)); return w; }

  // noSep: the body without the heads-apart clips (_headsApart reads both partners' heads through it: no recursion)
  _bodyRaw(t, noSep) {
    this._fresh();
    const key = (noSep ? 'n' : 'b') + t; if (this._cache.has(key)) return this._cache.get(key);
    let seg = null; for (const s of this.segs) { if (s.t0 <= t) seg = s; else break; }
    const view = this._viewAt(t);
    let B;
    if (!seg) B = this._idle(this._postureBody(this.state0, view, t), t, -1e9);
    else if (t < seg.t1) { B = seg.ev(t, view); B.still = false; }
    else B = this._idle(this._postureBody(seg.to, view, t), t, seg.t1);
    // body clips: lean / hip / x / z offsets (hug sway, laugh bob, phone nod, push ...)
    // a lean is a rotation in the picture plane: in a FRONT view it tips the body sideways (review 01-pause S6: Poppy's bow
    // floated tilted 35 deg sideways), so front views keep only a trace of it (big leans swap to a 3/4 view: _poseClips)
    const lk = B.turn < .3 && !B.lying && !B.spin ? .15 : 1;
    for (const c of this.clips.body || []) { if (noSep && c.sep) continue; const w = this._w(c, t); if (w <= 0) continue; const v = c.fn(t, B) || {};
      if (v.lean) B.lean += v.lean * w * lk; if (v.hipY) B.hipY += v.hipY * w; if (v.dx) B.x += v.dx * w; if (v.dz) B.z += v.dz * w; if (v.dy) B.y += v.dy * w; if (v.spin) B.spin += v.spin * w; }
    if (this._cache.size > 400) this._cache.clear();
    this._cache.set(key, B);
    return B;
  }
  // anchors in the facing-right figure space (origin = the root on the floor under the hip)
  _ctx(B) {
    const d = this.d, D = d.headD, lean = B.lean, c = Math.cos(lean), s = Math.sin(lean);
    const rot = (x, y) => ({ x: x * c + y * s, y: -x * s + y * c + B.hipY });
    const sh = {}; for (const side of SIDES) { const o = this._shOff(B.turn, side); sh[side] = rot(o[0], o[1]); }
    const kH = B.headScale ?? 1, h0 = this.C.head[(B.turn ?? 1) >= .5 ? 'side' : 'front'], h1 = this.C.head13 || h0, kk = (kH - 1) / .3;
    const ho = [lerp(h0[0], h1[0], kk), lerp(h0[1], h1[1], kk)];
    const knee = {}; for (const side of SIDES) { const L = B.legs[side]; if (!L) continue; const hj = this._hipJ(B, side), dd = angDir(L.hip + (this.C.legRel ? -lean : 0)); knee[side] = { x: hj.x + dd.x * d.thigh * (L.k1 ?? 1), y: B.hipY + hj.y + dd.y * d.thigh * (L.k1 ?? 1) }; }
    return { B, D, d, sh, kH, hip: { x: 0, y: B.hipY }, chest: rot(0, d.torso * .62), head: rot(ho[0], ho[1]), neck: rot(0, d.torso), shoulder: sh[this.near], knee: knee.R || { x: d.thigh, y: B.hipY },
      table: B.table ? { x: 0, y: B.table.y } : { x: 0, y: B.hipY + d.torso * .45 } };
  }
  // world <-> the facing-right figure space of body B
  _toWorld(B, p, z = 0) {
    let x = p.x * B.facing * this.k, y = p.y * this.k;
    if (B.spin) { const py = B.pivotY * this.k, c = Math.cos(B.spin), s = Math.sin(B.spin), yy = y - py; const nx = x * c - yy * s, ny = x * s + yy * c + py; x = nx; y = ny; }
    return new THREE.Vector3(B.x + x, B.y + y, B.z + z);
  }
  _toLocal(B, w) {
    let x = w.x - B.x, y = w.y - B.y;
    if (B.spin) { const py = B.pivotY * this.k, c = Math.cos(-B.spin), s = Math.sin(-B.spin), yy = y - py; const nx = x * c - yy * s, ny = x * s + yy * c + py; x = nx; y = ny; }
    return { x: x / this.k * B.facing, y: y / this.k };
  }
  _anchor(ctx, name) { return name && typeof name === 'object' ? name : ctx[name] || ctx.chest; }
  // an arm value -> { sh, el } (world angles); IK targets in D from an anchor, or world points
  _resolveArm(a, ctx, side) {
    if (a == null) return null;
    if (a.sh != null && a.to == null && a.target == null && a.world == null) return { sh: a.deg === false ? a.sh : rad(a.sh), el: a.deg === false ? a.el : rad(a.el ?? 0), hand: a.hand, z: a.z, tilt: a.tilt };
    let tgt = a.target;
    if (a.to) { const an = this._anchor(ctx, a.to[0]); tgt = { x: an.x + a.to[1] * ctx.D, y: an.y + a.to[2] * ctx.D }; }
    if (a.world) tgt = this._toLocal(ctx.B, a.world);
    if (!tgt) return null;
    const S0 = ctx.sh[side], d = this.d;
    const r = ik2(S0.x, S0.y, tgt.x, tgt.y, d.upperArm, d.fa, a.bend ?? 1);
    return { sh: r.a1, el: r.bend, hand: a.hand, z: a.z, tilt: a.tilt, reach: r.reach };
  }
  _w(c, t) {
    if (t < c.t0) return 0; if (c.t1 != null && t >= c.t1) return 0;
    let w = 1;
    if (c.fin > 0 && t < c.t0 + c.fin) w = ease(c.ein || 'inOutQuad', (t - c.t0) / c.fin);
    if (c.t1 != null && c.fout > 0 && t > c.t1 - c.fout) w = Math.min(w, 1 - ease(c.eout || 'inOutQuad', (t - (c.t1 - c.fout)) / c.fout));
    return w;
  }
  _clip(ch, c) {
    // an action that starts AT the cut is already there at the cut (review 01-pause S8: a phone hold from S.t0 reached up over
    // the first 6 frames, a visible flail on every cut); `fromCut: true` keeps the move in
    if (c.fin > 0 && !c.fromCut && c.t0 <= this.t0 + 1e-3 && ch !== 'idle') c.fin = 0;
    // and a release that would start in the last CUT_HOLD frames of the shot holds through the cut instead (video 01 0:52.6:
    // a seated cheer's arms swept down through a T-pose 4 frames before the cut; 3:43.3: raised arms flapped out 2 frames
    // before it). A prop hold (c.hold) keeps its release; `toCut: false` keeps any other
    const end = this.S?.t1;
    if (c.t1 != null && c.fout > 0 && !c.hold && c.toCut !== false && ch !== 'idle' && end != null && isFinite(end)) {
      const r = c.t1 - c.fout; if (r < end - 1e-6 && r >= end - fr(CUT_HOLD) - 1e-6) c.t1 = end + c.fout + F; }
    c.id = ++this._cid; (this.clips[ch] ||= []).push(c); this.clips[ch].sort((a, b) => a.t0 - b.t0 || a.id - b.id); this._dirty(); return c; }

  // ------------------------------------------------------------------------------------------------- the full pose at t
  poseAt(t) {
    t = this._step(t); this._fresh();
    const key = 'p' + t; if (this._cache.has(key)) return this._cache.get(key);
    const B = { ...this._bodyRaw(t) }; B.legs = { ...B.legs }; B.head = { ...B.head }; B.hand = { ...B.hand };
    // close-ups draw the head ~1.3x, sunk into the collar (the references; camera.js sets S._closeUp)
    B.headScale = this.headScale ?? (this.S?._closeUp ? 1.3 : null);
    const ctx = this._ctx(B);
    // base arms: walking / posture arms, or the posture's resting arms
    const arms = {}, z = { L: 0, R: 0 }, tilt = { L: null, R: null };
    const restName = B.posture === 'sit' ? (B.seated || 'upright') : 'stand';
    const rest = B.armsFixed || this._armsFromPose(POSES[restName] ? restName : 'stand', B, ctx);
    for (const s of SIDES) arms[s] = B.arms?.[s] ? { ...B.arms[s] } : { ...(rest?.[s] || { sh: 0, el: 0 }) };
    for (const s of SIDES) for (const c of this.clips['arm' + s] || []) {
      const w = this._w(c, t); if (w <= 0) continue;
      const v = this._resolveArm(c.fn(t, ctx, s, c), ctx, s); if (!v) continue;
      // the short way round (an IK answer of -200 deg is +160 deg: the arm must not swing through the back)
      arms[s].sh = lerp(arms[s].sh, arms[s].sh + wrapPI(v.sh - arms[s].sh), w); arms[s].el = lerp(arms[s].el, wrapPI(v.el), w);
      if (v.hand && w >= .5) B.hand[s] = v.hand;
      if (v.z != null) z[s] = lerp(z[s], v.z, w);
      if (v.tilt != null) tilt[s] = tilt[s] == null ? v.tilt : lerp(tilt[s], v.tilt, w);
    }
    // the arm in a sling wins over every other move of that arm (it is strapped to the chest)
    if (this.sling && !B.lying) { const s = this.sling, v = this._resolveArm(this._slingArm(B, s), ctx, s);
      if (v) { arms[s].sh = arms[s].sh + wrapPI(v.sh - arms[s].sh); arms[s].el = wrapPI(v.el); B.hand[s] = 'mitten'; z[s] = v.z ?? z[s]; } }
    // lying, the cast arm rests on top of the body (the far arm would be hidden behind it, plaster and all)
    if (this.castSide && B.lying) z[this.castSide] = Math.max(z[this.castSide], .08);
    for (const c of this.clips.head || []) { const w = this._w(c, t); if (w <= 0) continue; const v = c.fn(t, ctx) || {};
      for (const k of ['tilt', 'nod', 'turn']) if (v[k] != null) B.head[k] = c.add ? B.head[k] + v[k] * w : lerp(B.head[k], v[k], w); }
    const face = this._faceAt(t);
    if (!this.extra && t > this.t0) B.hair = this._hairAt(t);
    const P = { t, B, ctx, arms, z, tilt, face };
    if (this._cache.size > 400) this._cache.clear();
    this._cache.set(key, P);
    return P;
  }
  // ponytail / strand follow-through (motion NOTES: lags 2 f, swings up, settles in 6 f): a damped spring driven by the
  // head's acceleration in the facing frame, re-simulated over the last 14 frames (a pure function of t)
  _hairAt(t) {
    const key = 'h' + t; if (this._cache.has(key)) return this._cache.get(key);
    const d = this.d, L = d.torso + d.neck;
    const hx = tt => { const B = this._bodyRaw(stepT(tt)); return B.x / this.k + B.facing * Math.sin(B.lean) * L; };
    const hy = tt => { const B = this._bodyRaw(stepT(tt)); return B.y / this.k + B.hipY + Math.cos(B.lean) * L; };
    const f = this._bodyRaw(t).facing, w = 2 * PI / 8, z = .35, N = 14; let th = 0, v = 0;
    let x0 = hx(t - N * F), x1 = hx(t - (N - 1) * F), y0 = hy(t - N * F), y1 = hy(t - (N - 1) * F);
    for (let i = N - 2; i >= 0; i--) {
      const x2 = hx(t - i * F), y2 = hy(t - i * F), ax = x2 - 2 * x1 + x0, ay = y2 - 2 * y1 + y0;
      const a = -w * w * th - 2 * z * w * v - (ax * f * 26 + Math.abs(ay) * 8) / d.headD;
      v += a; th += v; x0 = x1; x1 = x2; y0 = y1; y1 = y2;
    }
    const r = clamp(th, -1.2, 1.2);
    this._cache.set(key, r);
    return r;
  }
  _rigPose(P) {
    const B = P.B, C = this.C, lean = B.lean;
    const arm = s => ({ sh: P.arms[s].sh + (C.rel ? lean : 0), el: P.arms[s].el, z: P.z[s] || 0 });
    const leg = s => { const L = B.legs[s] || { hip: 0, knee: 0, foot: 0 }; return { hip: L.hip + (C.legRel ? lean : 0), knee: L.knee, foot: L.foot ?? 0, ...(L.k1 != null ? { k1: L.k1 } : {}), ...(L.k2 != null ? { k2: L.k2 } : {}) }; };
    return mkPose({ facing: B.facing, turn: B.turn, back: B.back, hip: [0, B.hipY], lean, head: B.head, armL: arm('L'), armR: arm('R'), legL: leg('L'), legR: leg('R'), handL: B.hand.L, handR: B.hand.R, near: this.near, hair: B.hair, ...(B.headScale ? { headScale: B.headScale } : {}) });
  }
  /** the clock this actor lives on: the world's (held while S.freeze pauses time) unless it is `free` */
  _clock(t) { if (this.free) return t; const fz = this.S?._fxFreeze; const v = fz?.time?.(t); let c = typeof v === 'number' && isFinite(v) ? v : t;
    // carried / dragged by someone (a free hero moving frozen people): on the mover's clock during the ride, then held where left
    if (this._rides) for (const r of this._rides) if (t >= r.t0) c = Math.max(c, Math.min(t, r.t1 + F));
    return c; }
  /** the animation clock on ones (24 fps), never before the shot's first frame: 134 of video 01's 231 shots start off the
   *  24 fps grid, so the floor of the cut's time was the frame BEFORE the shot and its first frame showed the pose / face /
   *  prop before everything scheduled at S.t0 (Kit standing for one frame, then kneeling; a mug popping in on frame 2) */
  _step(t) { const s = stepT(t); return s < this.t0 && t >= this.t0 - 1e-6 ? this.t0 : s; }
  update(tRaw) {
    const t = this._step(this._clock(tRaw)); this._fresh(); this._raw = tRaw;
    if (this._ut === t || this._busy) return;
    this._busy = true;
    try {
      const P = this.poseAt(t), B = P.B;
      this.root.position.set(B.x, B.y, B.z + this.zBias);
      this.spin.rotation.z = B.spin || 0;
      if (B.spin) { const py = B.pivotY * this.k, c = Math.cos(B.spin), s = Math.sin(B.spin); this.spin.position.set(py * s, py - py * c, 0); } else this.spin.position.set(0, 0, 0);
      this.root.visible = this._visAt(t);
      // props in this actor's hands at t: attached with the rig's own attach (it places them on every setPose)
      for (const obj of this.touched) { const e = custodyAt(obj, t); if (e.mode === 'hand' && e.actor === this) this._attachHeld(obj, e, P); }
      this.fig.setPose(this._rigPose(P));
      // contact shadow: the references show none indoors (the place says so), a soft ellipse outdoors
      if (this.fig.shadow && this.S?.placeInfo && this.S.placeInfo.shadows === false) this.fig.shadow.visible = false;
      if (this.fig.setFace && !this.extra) this.fig.setFace({ ...P.face, t });
      this.root.updateMatrixWorld(true);
      this._ut = t; this._P = P;
      for (const obj of this.touched) this._applyCustody(obj, t);
    } finally { this._busy = false; }
  }
  _attachHeld(obj, e, P) {
    const g = gripOf(e.grip), key = this.id + e.side + e.grip;
    const opts = obj.userData._opts ?? (obj.userData._opts = {});
    opts.grip = gripPoint(obj, e.grip); opts.front = !!g.front; opts.upright = !g.follow; opts.keep = obj.userData.noKeep ? false : true;
    opts.rot = rad(P.tilt[e.side] ?? g.tilt ?? 0) + (g.follow ? rad(90) : 0);
    if (obj.userData._key !== key) {
      const prev = obj.userData._fig; if (prev && prev !== this.fig) { try { prev.detach(obj); } catch { /* */ } }
      obj.visible = true; obj.position.z = 0;          // the slot gives the depth (a prop picked off a table keeps no old z)
      try { this.fig.attach(obj, e.side, opts); } catch (err) { console.warn('anim: attach failed: ' + err.message); }
      obj.userData._fig = this.fig; obj.userData._key = key;
    }
  }

  // ------------------------------------------------------------------------------------------------- the contract
  _jointWorld(name) {
    if (this.fig.joint && this.C.ok) {
      const j = this.fig.joint(name); const v = j.isVector3 ? j.clone() : new THREE.Vector3(j[0] ?? j.x, j[1] ?? j.y, 0);
      // the figure is a stack of layers ~0.1 m deep: a hand (and what it holds) sits at its arm's layer, not at z = 0
      if (name.startsWith('hand') && v.z === 0) { const node = this.fig.arms?.[name.slice(-1)]?.slot; if (node) { node.updateMatrixWorld(true); const w = node.getWorldPosition(new THREE.Vector3()); this.fig.root.updateMatrixWorld(true); const r = this.fig.root.localToWorld(v); r.z = w.z; return r; } else v.z = (this.fig.dims?.depth ?? 0) * .8; }
      this.fig.root.updateMatrixWorld(true); return this.fig.root.localToWorld(v);
    }
    const P = this._P; if (!P) return this.root.position.clone();
    if (name === 'head') return this._toWorld(P.B, P.ctx.head);
    if (name.startsWith('hand')) return this._toWorld(P.B, this._handFK(P, name.slice(-1)));
    return this._toWorld(P.B, P.ctx.hip);
  }
  _handFK(P, s) { const sh = P.ctx.sh[s], d = this.d, a = P.arms[s]; const u = angDir(a.sh), f = angDir(a.sh + a.el); return { x: sh.x + u.x * d.upperArm + f.x * d.fa, y: sh.y + u.y * d.upperArm + f.y * d.fa }; }
  head() { return this._jointWorld('head'); }
  handPos(side = 'R') { return this._jointWorld('hand' + (side === 'L' ? 'L' : 'R')); }
  box() { this.root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(this.root); }
  feetY(t) { if (t != null) this.update(t); let y = Infinity; for (const s of SIDES) { const p = this._jointWorld('foot' + s); y = Math.min(y, p.y); } return (isFinite(y) ? y : 0) - this.C.ankleY * this.k; }
  lying(t) { const B = this._bodyRaw(t == null ? (this._ut ?? 0) : stepT(this._clock(t))); return !!B.lying || Math.abs(B.spin || 0) > .5; }
  touching(other, t) { return this.touches.some(x => x.other === other && t >= x.t0 && t <= x.t1); }
  /** where this actor stands at time t (world), for builders: { x, z } */
  at(t) { return this._posAt(this._t(t)); }

  // ================================================================================================= locomotion
  _planWalk(to, t0, o, style) {
    const W = { ...(WALKS[style] || WALKS.normal), ...(o.gait || {}) }, d = this.d, k = this.k, H = d.height;
    const from = this._posAt(t0 - 1e-4);
    const dx = to.x - from.x, dz = (to.z ?? from.z) - from.z, Dw = Math.hypot(dx, dz), Dl = Dw / k;
    const per = W.frames * F * (o.tempo ?? 1) * (1 + (this.rand() - .5) * .1);
    const stride = W.stride * H * (o.strideK ?? 1);
    let ta = W.accel * F, td = W.decel * F, T;
    if (o.until != null) T = Math.max(per * 1.5, this._t(o.until) - t0);
    else if (o.speed) T = Dl / (o.speed / k) + (ta + td) / 2;
    else T = Dl / (stride / per) + (ta + td) / 2;
    if (ta + td > T * .8) { const s = T * .8 / (ta + td); ta *= s; td *= s; }
    const v = Dl / Math.max(1e-3, T - (ta + td) / 2);
    const sOf = tau => { if (tau <= 0) return 0; if (tau >= T) return Dl;
      if (tau < ta) return v * (tau / 2 - ta / (2 * PI) * Math.sin(PI * tau / ta));
      if (tau <= T - td) return v * (ta / 2 + (tau - ta));
      const u = tau - (T - td); return v * (ta / 2 + (T - td - ta) + u / 2 + td / (2 * PI) * Math.sin(PI * u / td)); };
    const ramp = tau => tau <= 0 || tau >= T ? 0 : tau < ta ? (1 - Math.cos(PI * tau / ta)) / 2 : tau > T - td ? (1 + Math.cos(PI * (tau - (T - td)) / td)) / 2 : 1;
    const cx = Dw > 1e-6 ? Math.abs(dx) / Dw : 1, depth = Dw > 1e-6 && cx < .35;
    // a walk timed by until / speed takes quicker steps rather than lunges: strides stay within 1.15x the style's (iq500 s39)
    let n = Math.max(2, Math.round(T / per)); if (Dl / n > stride * 1.15) n = Math.ceil(Dl / (stride * 1.15));
    const P = T / n;
    const view = depth ? (dz < 0 ? { facing: this.P.view.facing, turn: 0, back: true } : { facing: this.P.view.facing, turn: 0, back: false })
      : o.view ? { ...viewOf(o.view), facing: dx >= 0 ? 1 : -1 } : { facing: dx >= 0 ? 1 : -1, turn: 1, back: false };
    // footprints along the path (fig units from the start hip); the stance of the start pose stays where it is
    const st0 = this.P.posture === 'stand' ? this.P.stance || { L: 0, R: 0 } : { L: 0, R: 0 };
    const flip = (this.P.view?.facing ?? 1) !== view.facing && !depth;
    const start = { L: depth ? 0 : (flip ? -st0.L : st0.L) * cx, R: depth ? 0 : (flip ? -st0.R : st0.R) * cx };
    const lead = o.lead || (start.L < start.R ? 'L' : 'R');
    const other = lead === 'L' ? 'R' : 'L';
    const gap = depth ? 0 : .075 * H * clamp(cx * 1.2);
    const ev = { L: [], R: [] }, last = { ...start };
    // walk: a foot lands where the hip will be half a step later (it passes over it at mid-stance), lifts 0.2 step after
    // the other foot lands; run: the foot lands just ahead of the hip (under it 0.2 step later), stance ~42 % of a step,
    // then a flight phase
    for (let i = 1; i <= n; i++) {
      const f = i % 2 ? lead : other, Ti = i * P, Tp = (i - 1) * P;
      const s1 = i === n ? Dl + gap : Math.min(Dl + gap, Math.max(last[f], sOf(Ti + (W.run ? .21 : .5) * P)));
      const a = i === 1 ? Math.max(fr(2), P * .25) : W.run ? Math.max(i === 2 ? fr(1) : 0, Tp - .58 * P) : Tp + .2 * P;
      ev[f].push({ a: t0 + a, b: t0 + Ti, s0: last[f], s1, lift: W.lift * H * (i === 1 ? .8 : 1) });
      last[f] = s1;
    }
    // the closing step: the rear foot comes up to end ~0.15 H behind the front one
    const fc = n % 2 ? other : lead, Pc = clamp(P * .7, fr(3), fr(6)), tc = t0 + T + fr(.5);
    ev[fc].push({ a: tc, b: tc + Pc, s0: last[fc], s1: Dl - gap, lift: W.lift * H * .6 }); last[fc] = Dl - gap;
    const tEnd = tc + Pc;
    const t1 = tEnd + (W.dip ? fr(5) : fr(3));
    const plan = { kind: 'walk', W, t0, t1, T, P, n, Dl, cx, depth, dir: { x: Dw > 1e-6 ? dx / Dw : 1, z: Dw > 1e-6 ? dz / Dw : 0 }, from, to: { x: to.x, z: to.z ?? from.z }, view, sOf, ramp, ev, tEnd };
    // stance after the walk, in the facing-right frame of the end view (front foot +, rear foot -)
    const endStance = depth ? { L: -.02 * H, R: .02 * H } : { [fc]: -gap, [fc === 'L' ? 'R' : 'L']: gap };
    return { plan, endStance };
  }
  _walkBody(pl, t, view) {
    const W = pl.W, d = this.d, H = d.height, k = this.k, tau = t - pl.t0;
    const s = pl.sOf(tau), r = pl.ramp(tau);
    const x = pl.from.x + pl.dir.x * s * k, z = pl.from.z + pl.dir.z * s * k;
    const B = { x, y: this.floorY, z, facing: view.facing, turn: view.turn, back: !!view.back, spin: 0, pivotY: 0, hipY: this.hStand, lean: 0, legs: {}, arms: {}, head: { tilt: 0, nod: 0, turn: 0 }, hand: { L: 'nub', R: 'nub' }, posture: 'stand', walking: true };
    // feet: planted (locked) or swinging between two footprints
    // contact = inverted V; toe-off = the rear heel lifts the frame before the foot leaves; passing = the swing foot low
    // behind the straight support leg (knee ~50 deg); reach = the swing leg straightens forward; feet flat otherwise
    const feet = {}, fl = d.foot * .8, HEEL = rad(W.run ? 35 : 25);
    for (const side of SIDES) {
      let lift = 0, air = false, toe = 0;
      const list = pl.ev[side];
      let pos = list[0]?.s0 ?? 0;
      for (const e of list) {
        if (t >= e.b) { pos = e.s1; continue; }
        if (t >= e.a) { const u = (t - e.a) / (e.b - e.a); pos = lerp(e.s0, e.s1, E.outQuad(clamp(u / .88))); lift = e.lift * Math.sin(PI * clamp(u / .72)); toe = HEEL * Math.max(0, 1 - u / .4); air = true; break; }
        pos = e.s0; toe = HEEL * clamp((t - (e.a - fr(1.5))) / fr(1.5)); break;
      }
      const lx = pl.depth ? this._hipJ(B, side).x : (pos - s) * pl.cx + this._hipJ(B, side).x;
      feet[side] = { x: lx - (pl.depth ? 0 : fl * (1 - Math.cos(toe))), y: this.C.ankleY + lift + fl * Math.sin(toe), air: air || toe > .05, lift, toe };
    }
    B.feet = feet;
    // hip height: lowest at contact, highest at passing (walk); lowest mid-stance for runs
    const ph = (tau / pl.P) % 1;
    const bobK = W.run ? (1 + Math.cos(2 * PI * (ph - .21))) / 2 : (1 + Math.cos(2 * PI * ph)) / 2;
    const after = t > pl.t0 + pl.T ? clamp((t - (pl.t0 + pl.T)) / fr(4)) : 0;
    let hip = this.hStand - (W.crouch || 0) * H * (1 - after) - W.bob * H * bobK * r;
    if (W.dip && t > pl.tEnd) { const u = (t - pl.tEnd) / fr(5); hip -= W.dip * H * (u < .4 ? E.outQuad(u / .4) : 1 - E.inOutQuad((u - .4) / .6)); }
    B.hipY = Math.min(hip, this._standHip(B, feet));
    for (const side of SIDES) B.legs[side] = this._legIK(B, side, feet[side].x, feet[side].y, { toe: -feet[side].toe });
    // torso: lean with speed, a little more while speeding up, back while stopping
    const acc = tau < pl.T / 2 ? (tau < (W.accel * F) ? Math.sin(PI * tau / (W.accel * F)) : 0) : 0;
    B.lean = rad(W.lean) * r + rad(3) * acc;
    B.head.nod = (W.nod || 0) * r;
    // arms swing against the legs (1 frame behind them); runs pump with bent elbows
    const c = Math.cos(PI * (tau - fr(1)) / pl.P);
    const lead = pl.ev.L[0] && pl.ev.R[0] && pl.ev.L[0].b < pl.ev.R[0].b ? 'L' : 'R';
    for (const side of SIDES) {
      const cs = side === lead ? c : -c;
      const swing = (cs >= 0 ? cs * W.armF : cs * W.armB) * r;
      const base = side === 'R' ? 3 : -3;
      B.arms[side] = { sh: rad(base + swing - (B.lean / DEG) * .4), el: rad((W.run ? W.elbow : W.elbow * r + 6) + (W.elbowF || 0) * Math.max(0, cs) * r) };
      if (pl.depth) { const out = Math.sign(this.C.sh.front[side][0]) || (side === 'R' ? 1 : -1); B.arms[side] = { sh: rad(out * 6 + swing * .25), el: rad(out * (8 + 6 * Math.max(0, cs) * r)) }; }
    }
    return B;
  }
  /** walk to a spot / [x, z] / actor / prop: { at, until | speed, style: 'normal'|'medium'|'brisk'|'slow'|'tired'|'sad'|'sneak'|'kid'|'elderly'|'jog'|'run'|'kidRun', face (view at the end), stop (m short of an actor) } */
  walk(to, at, o) {
    [at, o] = this._args(at, o);
    if (this.P.posture === 'sit') { this.stand(at); at = this.cur; }
    let sp = spotOf(this.S, to); if (!sp) return this;
    if (sp.actor) { const b = sp.actor, p = b._posAt(at), me = this._posAt(at); const gap = o.stop ?? (this.d.headD * this.k * 2.4); sp = { x: p.x - Math.sign(p.x - me.x || 1) * gap, z: p.z }; }
    if (sp.kind === 'seat' || sp.seatY != null || sp.obj?.userData?.seat != null) { const seat = seatOf(this.S, to); if (seat) sp = this._approach(seat); }
    const style = o.style || (this.age === 'kid' || this.age === 'small' ? (o.run ? 'kidRun' : 'kid') : o.run ? 'run' : 'normal');
    const { plan, endStance } = this._planWalk({ x: sp.x, z: sp.z ?? this.P.z }, at, o, style);
    this._addView(at, plan.view);
    const to2 = { posture: 'stand', x: plan.to.x, z: plan.to.z, y: this.floorY, stance: endStance };
    this._seg({ kind: 'walk', t0: at, t1: plan.t1, to: to2, plan, ev: (t, view) => this._walkBody(plan, t, view) });
    this.moves.push({ t0: at, t1: plan.t1, kind: style, air: !!plan.W.run });       // runs have a flight phase
    this.P = { ...this.P, ...to2, view: plan.view };
    if (o.face) this._addView(plan.t1, viewOf(o.face, plan.view));
    return this;
  }
  run(to, at, o) { [at, o] = this._args(at, o); return this.walk(to, at, { style: this.age === 'kid' || this.age === 'small' ? 'kidRun' : 'run', ...o }); }
  /** a small reposition (the presenter's 2-step): to a spot or by dx metres */
  step(to, at, o) { [at, o] = this._args(at, o); const p = this._posAt(at); const tgt = typeof to === 'number' ? { x: p.x + to, z: p.z } : spotOf(this.S, to);
    return this.walk(tgt, at, { gait: { frames: 6, accel: 3, decel: 4, armF: 6, armB: 6, dip: 0 }, ...o, face: o.face ?? this._viewAt(at) }); }
  /** come in through a door spot (or 'left' / 'right' = from off screen) and walk to `to` */
  enter(door, o = {}) {
    const at = this._t(o.at); const tgt = spotOf(this.S, o.to) || { x: this.P.x, z: this.P.z };
    let start;
    if (door === 'left' || door === 'right') start = { x: tgt.x + (door === 'left' ? -1 : 1) * (o.from ?? 4.5), z: tgt.z };
    else start = spotOf(this.S, door) || { x: tgt.x - 3, z: tgt.z };
    this.state0 = { ...this.state0, x: start.x, z: start.z ?? tgt.z }; if (!this.segs.length) this.P = { ...this.P, x: start.x, z: start.z ?? tgt.z };
    if (at > this.t0 + 1e-3) { this.hide(this.t0); this.show(at); }
    return this.walk(tgt, at, o);
  }
  /** leave through a door spot (or 'left' / 'right' = off screen); hidden once there */
  exit(door, o = {}) {
    const at = this._t(o.at), p = this._posAt(at);
    const tgt = door === 'left' || door === 'right' ? { x: p.x + (door === 'left' ? -1 : 1) * (o.dist ?? 5), z: p.z } : spotOf(this.S, door) || { x: p.x + 4, z: p.z };
    this.walk(tgt, at, o); if (door !== 'left' && door !== 'right') this.hide(this.cur); return this;
  }

  // ================================================================================================= postures
  _approach(seat) { const f = seat.facing ?? this.P.view.facing ?? 1; return { x: seat.x - f * .12 * this.D * this.k + f * this.d.thigh * this.k, z: seat.z, facing: f }; }
  _setSeated(seat, o = {}, initial) {
    // a stool has no back: a sitter given a side / 3/4 facing sits that way even when the spot names one (video 02: three
    // "facing: 'left'" shots of Grandpa on the clock-shop stool all faced right)
    const own = seat.stool && o.facing ? viewOf(o.facing) : null;
    const f = (own && own.turn >= .25 ? own.facing : null) ?? seat.facing ?? this.P.view?.facing ?? 1;
    // a bench / sofa seat faces the camera, but a sitter given a side or 3/4 facing sits that way (iq500 s35: profile on a bench)
    const front = seat.front && !(o.facing && viewOf(o.facing).turn >= .25);
    const s2 = { ...seat, front, facing: f, hipX: seat.x - (front ? 0 : f * .12 * this.D * this.k) };
    const st = { posture: 'sit', x: s2.hipX, z: seat.z, y: seat.floorY, seat: s2, lean: o.lean, seatPose: o.posture, feet: o.feet };
    this.seats.push({ seat: s2, t0: initial ? -Infinity : this.cur });
    if (initial) { this.state0 = st; this.P = { ...this.P, ...st }; this.view0 = viewOf(seat.front ? 'front' : null, { facing: f, turn: o.facing ? this.view0.turn : (seat.front ? 0 : .5) }); if (o.facing) this.view0 = { ...viewOf(o.facing), facing: f }; this.P.view = this.view0; }
    return st;
  }
  /** sit on a seat (a 'seat' spot, a chair prop with userData.seat, { x, z, seatY }): walks there first when needed.
   *  { posture: 'upright'|'slumped'|'leanTable'|'headInHands'|'typing'|'eating'|'phoneLap', lean, instant } */
  sit(seatSpot, at, o) {
    [at, o] = this._args(at, o);
    const seat = seatOf(this.S, seatSpot); if (!seat) return this;
    const f = seat.facing ?? this.P.view.facing ?? 1; seat.facing = f;
    if (this.P.posture !== 'stand') { this.stand(at); at = this.cur; }
    const ap = this._approach(seat), p = this._posAt(at);
    // a flop from in front of the seat drops straight in (no walk round to the seat's front)
    const near = o.flop && Math.hypot(p.x - ap.x, (p.z ?? 0) - ap.z) < .9;
    if (!near && (Math.abs(p.x - ap.x) > .03 || Math.abs((p.z ?? 0) - ap.z) > .05)) { this.walk(ap, at, { style: o.style, face: { facing: f, turn: 1 } }); at = this.cur; }
    const frontFlop = near && seat.front && this._viewAt(at).turn < .5;     // a front-view flop onto a sofa stays front
    if (!frontFlop && (this._viewAt(at).facing !== f || this._viewAt(at).turn < .5)) this._addView(at, { facing: f, turn: Math.max(.5, this._viewAt(at).turn), back: false });
    const from = { ...this.P, stance: { L: 0, R: 0 } };
    const to = this._setSeated(seat, o, false);
    if (o.instant) { this._seg({ kind: 'cut', t0: at, t1: at, to, ev: () => null }); this.P = { ...this.P, ...to }; return this; }
    // flop: the clause IS the sit ("she drops onto the sofa"): a 6-frame accelerating drop, a 6-frame bounce in the cushion,
    // slumped (review 01-pause S11: the builder kept her standing because sit-downs "are not in the references")
    const dur = fr(o.frames ?? (o.flop ? 6 : MOVES.sitDown[0]));
    if (frontFlop) {
      // front view: seated legs from the first frame, the body drops from standing height onto the cushion (accelerating)
      const lift = Math.max(0, this.hStand - ((seat.seatY - seat.floorY) / this.k + this.d.limbW / 2));
      this._seg({ kind: 'cut', t0: at, t1: at, to, ev: () => null }); this.P = { ...this.P, ...to };
      this._clip('body', { t0: at, t1: at + dur + fr(7), fin: 0, fout: 0, fn: t => { const u = clamp((t - at) / dur);
        return { hipY: u < 1 ? lift * (1 - u ** 1.6) : -.035 * this.d.height * Math.sin(PI * clamp((t - at - dur) / fr(7))) }; } });
      const pz = o.posture ?? 'slumped'; if (POSES[pz]) this.pose(pz, at + dur * .6, { fin: fr(3) });
      return this;
    }
    this._seg({ kind: 'sitdown', t0: at, t1: at + dur, to, ev: (t, view) => this._sitBody(from, to, o.flop ? clamp((t - at) / dur) ** 1.6 : (t - at) / dur, view, false) });
    this.P = { ...this.P, ...to };
    if (o.flop) this._clip('body', { t0: at + dur, t1: at + dur + fr(7), fin: 0, fout: 0, fn: t => ({ hipY: -.035 * this.d.height * Math.sin(PI * clamp((t - at - dur) / fr(7))) }) });
    const posture = o.posture ?? (o.flop ? 'slumped' : null);
    if (posture && POSES[posture]) this.pose(posture, at + dur * .6, { fin: fr(o.flop ? 3 : 6) });
    return this;
  }
  _sitBody(standSt, sitSt, u, view, up) {
    // feet stay planted where the seated feet go; the hip travels from above the feet to the seat
    const sitB = this._postureBody(sitSt, view), d = this.d;
    const f = sitB.facing;
    const feetX = sitB.x + f * d.thigh * this.k;                    // world x of the ankles
    let px, py, lean;
    if (up) { const fi = u * 10; py = tbl(STANDUP_Y, fi); px = tbl([0, .22, .6, .88, .97, 1, 1, 1, 1, 1, 1], fi); lean = rad(tbl(STANDUP_LEAN, fi)) + sitB.lean * (1 - py); }
    else { const p = E.inOutQuad(u); px = 1 - E.inOutQuad(clamp(u * 1.15)); py = 1 - p; lean = sitB.lean * p + rad(24) * Math.pow(Math.sin(PI * clamp(u * 1.05)), 1.3); }
    const hipX = lerp(sitB.x, feetX, px), hipY = lerp(sitB.hipY, this.hStand - .004 * d.height, py);
    const B = { ...sitB, x: hipX, hipY, lean, legs: {}, posture: py > .9 ? 'stand' : 'sit', feet: null, arms: {} };
    // the feet leave the floor for the seated place (a stool's rung, a tucked foot) over the last half of the sit (and back first when rising)
    const w = clamp((1 - py - .5) * 2);
    for (const s of SIDES) { let ax = (feetX - hipX) / this.k * f + (s === 'L' ? -.02 : .02) * d.height, ay = this.C.ankleY;
      if (w > 0 && sitSt.seat) { const [sx, sy] = this._seatFoot(sitB, sitSt.seat, s, false, sitSt.feet); ax = lerp(ax, sx + (sitB.x - hipX) / this.k * f, w); ay = lerp(ay, sy, w); }
      B.legs[s] = this._legIK(B, s, ax, ay); }
    // arms: from the thighs to hanging, a little forward while the weight moves
    const ctx = this._ctx(B), rest = this._armsFromPose('upright', B, ctx), hang = this._armsFromPose('stand', B, ctx), k2 = up ? clamp(py * 1.3) : 1 - clamp((1 - py) * 1.6);
    for (const s of SIDES) B.arms[s] = { sh: lerp(rest[s].sh, hang[s].sh, k2) + rad(14) * Math.sin(PI * clamp(1 - Math.abs(py - .5) * 2)), el: lerp(rest[s].el, hang[s].el, k2) };
    void standSt;
    return B;
  }
  /** stand up (from a seat: the measured 11-frame rise, iq500 s228; from kneeling / lying / the floor: a clean tween) */
  stand(at, o) {
    [at, o] = this._args(at, o);
    const p = this.P.posture;
    if (p === 'stand') return this;
    if (p === 'lie') { this.getUp(at, o); return this; }
    if (p === 'sit') {
      const from = { ...this.P }, seatB = this._postureBody(from, this._viewAt(at));
      const f = seatB.facing, x = seatB.x + f * this.d.thigh * this.k;
      const to = { posture: 'stand', x, z: from.z, y: this.floorY, stance: { L: -.02 * this.d.height, R: .02 * this.d.height } };
      const dur = fr(11);
      this._seg({ kind: 'standup', t0: at, t1: at + dur, to, ev: (t, view) => this._sitBody(to, from, (t - at) / dur, view, true) });
      this.P = { ...this.P, ...to, seat: null };
      return this;
    }
    return this._tween({ posture: 'stand', x: this.P.x, z: this.P.z, y: this.floorY, stance: { L: -.02 * this.d.height, R: .02 * this.d.height } }, at, o.frames ?? 10, o.ease || 'inOutQuad');
  }
  _tween(to, at, frames, easeName, extra = {}) {
    // a posture change that starts AT the cut is already done at the cut (like _clip): video 01's kneel(S.t0) showed Kit
    // standing on the shot's first frame, then kneeling; `fromCut: true` keeps the move in
    const atCut = at <= this.t0 + 1e-3 && !extra.fromCut;
    const from = { ...this.P }, dur = atCut ? 1e-4 : fr(frames);
    to = { ...from, ...to };
    this._seg({ kind: 'tween', t0: at, t1: at + dur, to, ev: (t, view) => {
      const u = atCut ? 1 : ease(easeName, (t - at) / dur), A = this._postureBody(from, view), Bb = this._postureBody(to, view), k = this.k;
      // interpolate the hip in the world (the lying pose turns about the hip), then put the root under it
      const hy = lerp(A.hipY, Bb.hipY, u), hwy = lerp(A.y + A.hipY * k, Bb.y + Bb.hipY * k, u);
      const B = { ...Bb, x: lerp(A.x, Bb.x, u), y: hwy - hy * k, z: lerp(A.z, Bb.z, u), hipY: hy, lean: lerp(A.lean, Bb.lean, u) + (extra.lean ? extra.lean * Math.sin(PI * u) : 0),
        spin: lerp(A.spin || 0, Bb.spin || 0, u), pivotY: hy, turn: u < .5 ? A.turn : Bb.turn, facing: u < .5 ? A.facing : Bb.facing, back: u < .5 ? A.back : Bb.back, legs: {}, lying: u > .5 ? Bb.lying : A.lying, posture: u < .5 ? A.posture : Bb.posture, feet: null };
      for (const s of SIDES) { const a = A.legs[s] || {}, b = Bb.legs[s] || {}; B.legs[s] = { hip: lerp(a.hip ?? 0, b.hip ?? 0, u), knee: lerp(a.knee ?? 0, b.knee ?? 0, u), foot: lerp(a.foot ?? 0, b.foot ?? 0, u), ...(a.k1 != null || b.k1 != null ? { k1: lerp(a.k1 ?? 1, b.k1 ?? 1, u) } : {}) }; }
      const ctx = this._ctx(B), rest = X => X.armsFixed || this._armsFromPose(X.posture === 'sit' ? (X.seated || 'upright') : 'stand', B, ctx), ra = rest(A), rb = rest(Bb);
      B.armsFixed = null; B.arms = {}; for (const s of SIDES) B.arms[s] = { sh: lerp(ra[s].sh, rb[s].sh, u), el: lerp(ra[s].el, rb[s].el, u) };
      return B; } });
    this.P = { ...this.P, ...to };
    return this;
  }
  /** kneel: { one: true } = on one knee; { low: true } = sitting back on the heels; { slow: true } = the 30-frame emotional kneel (sister s264); default 8 f */
  kneel(at, o) { [at, o] = this._args(at, o); const fr0 = o.frames ?? (o.slow ? MOVES.kneelSlow[0] : MOVES.kneel[0]); return this._tween({ posture: o.one ? 'kneel1' : o.low ? 'kneelLow' : 'kneel' }, at, fr0, o.slow ? MOVES.kneelSlow[1] : MOVES.kneel[1]); }
  /** quick crouch drop: 5 frames quadOut (sister s250) */
  crouch(at, o) { [at, o] = this._args(at, o); return this._tween({ posture: 'crouch' }, at, o.frames ?? MOVES.crouch[0], MOVES.crouch[1]); }
  /** slide down (a wall) to sit on the floor, knees up: 22 frames quadInOut (sister s262) */
  floor(at, o) { [at, o] = this._args(at, o); return this._tween({ posture: 'floor' }, at, o.frames ?? MOVES.floor[0], MOVES.floor[1]); }
  slideDown(at, o) { return this.floor(at, o); }
  /** bend over (to reach low / tuck a blanket): 14 frames quadInOut, hips ~70 deg (sister s209) */
  bend(at, o) { [at, o] = this._args(at, o); return this._tween({ posture: 'bend', bendAngle: o.angle ?? 70 }, at, o.frames ?? MOVES.bend[0], MOVES.bend[1]); }
  _bedOf(v, o = {}) {
    const s = spotOf(this.S, v) || {}; const hd = s.head === 'left' || s.headDir === -1 || faceSign(s.facing) === 1 ? -1 : s.head === 'right' || s.headDir === 1 ? 1 : (o.head === 'right' ? 1 : -1);
    const topY = s.topY ?? s.seatY ?? (s.kind === 'floor' ? (s.y ?? 0) : (s.y ?? 0) + .55);
    const d = this.d, k = this.k;
    const pillowX = s.pillowX ?? (s.x != null && s.w ? s.x + hd * (s.w / 2 - .25) : null);
    const hipX = pillowX != null ? pillowX - hd * (d.torso + d.neck + d.headR * .8) * k : (s.x ?? 0) - hd * .2 * k;
    return { hipX, z: s.z ?? 0, topY, headDir: hd, prone: !!o.prone };
  }
  _setLying(v, o, initial) {
    const bed = this._bedOf(v, o), st = { posture: 'lie', x: bed.hipX, z: bed.z, y: bed.topY, bed };
    if (initial) { this.state0 = st; this.P = { ...this.P, ...st }; this.view0 = { facing: bed.prone ? bed.headDir : -bed.headDir, turn: 1, back: false }; this.P.view = this.view0; }
    return st;
  }
  /** lie down on a bed / sofa / the floor spot (sits on its edge first, then lies back over 18 frames) */
  lieDown(bed, at, o) {
    [at, o] = this._args(at, o);
    const st = this._setLying(bed, o, false), bd = st.bed, f = -bd.headDir;
    if (this.P.posture !== 'sit') this.sit({ x: bd.hipX + f * .12 * this.D * this.k, z: bd.z, seatY: bd.topY, floorY: this.floorY, facing: f }, at, o);
    return this._tween(st, this.cur, o.frames ?? MOVES.lieDown[0], MOVES.lieDown[1]);
  }
  /** get up from lying: sit up on the edge (16 f), then stand (11 f); { sit: true } stops on the edge; { inBed: true } just sits up in the bed */
  getUp(at, o) {
    [at, o] = this._args(at, o);
    if (this.P.posture !== 'lie') return this.stand(at, o);
    const bd = this.P.bed, f = bd.prone ? bd.headDir : -bd.headDir;
    // { inBed: true }: sit up where it lies, legs staying along the bed (16 f)
    if (o.inBed) return this._tween({ posture: 'sitBed', x: bd.hipX, z: bd.z, y: bd.topY, bed: bd }, at, o.frames ?? MOVES.getUp[0], MOVES.getUp[1]);
    const seat = { x: bd.hipX + f * .12 * this.D * this.k, z: bd.z, floorY: this.floorY, seatY: bd.topY, facing: f };
    const sitSt = { posture: 'sit', x: bd.hipX, z: bd.z, y: this.floorY, seat: { ...seat, hipX: bd.hipX } };
    this._tween(sitSt, at, o.frames ?? MOVES.getUp[0], MOVES.getUp[1]);
    this._addView(this.cur, { facing: f, turn: 1, back: false });
    if (o.sit) { this.seats.push({ seat, t0: at }); return this; }   // seated on the edge: feet may dangle (a kid on a cot)
    return this.stand(this.cur + fr(4));
  }
  /** jump (in place or to a spot): 5 f crouch anticipation, lift-off, a ballistic arc, land crouched 2 f, recover 5 f */
  jump(at, o) {
    [at, o] = this._args(at, o);
    const p0 = this._posAt(at), tgt = o.to ? spotOf(this.S, o.to) : p0, H = this.d.height, h = (o.height ?? .22) * H * this.k;
    const g = 9.8 * .9, air = 2 * Math.sqrt(2 * h / g), ta = fr(5), tl = fr(7);
    const t1 = at + ta + air + tl, from = { ...this.P }, to = { ...this.P, x: tgt.x, z: tgt.z ?? p0.z };
    this._seg({ kind: 'jump', t0: at, t1, to, ev: (t, view) => {
      const B = this._postureBody({ ...from, posture: 'stand' }, view); const u = t - at;
      let dip = 0, y = 0, tuck = 0, x = p0.x;
      if (u < ta) dip = .1 * E.inOutQuad(u / ta);
      else if (u < ta + air) { const v = (u - ta) / air; y = h * 4 * v * (1 - v); x = lerp(p0.x, tgt.x, v); tuck = Math.sin(PI * v); dip = .1 * (1 - clamp((u - ta) / fr(2))); }
      else { const v = (u - ta - air) / tl; x = tgt.x; dip = .08 * (v < .3 ? E.outQuad(v / .3) : 1 - E.inOutQuad((v - .3) / .7)); }
      B.x = x; B.z = lerp(p0.z, tgt.z ?? p0.z, clamp((u - ta) / air)); B.y = this.floorY + y;
      const feet = { L: { x: this._hipJ(B, 'L').x - .02 * H, y: this.C.ankleY }, R: { x: this._hipJ(B, 'R').x + .02 * H, y: this.C.ankleY } };
      B.hipY = this.hStand - dip * H - tuck * .03 * H;
      for (const s of SIDES) { if (tuck > 0) B.legs[s] = { hip: rad(35 * tuck), knee: rad(70 * tuck), foot: rad(-35 * tuck) }; else B.legs[s] = this._legIK(B, s, feet[s].x, feet[s].y); }
      B.lean = rad(18) * (dip / .1) * (u < ta + air ? 1 : .5);
      B.arms = { R: { sh: u < ta ? rad(-30 * dip / .1) : rad(lerp(150, 20, clamp((u - ta) / air))), el: rad(10) }, L: { sh: u < ta ? rad(-34 * dip / .1) : rad(lerp(140, 15, clamp((u - ta) / air))), el: rad(12) } };
      return B; } });
    this.moves.push({ t0: at + ta, t1: at + ta + air, air: true, kind: 'jump' });
    this.P = to; return this;
  }
  /** fall over: { dir: 'back' | 'forward' } topples over ~9 frames (accelerating), lands with a small bounce, lies */
  fall(at, o) {
    [at, o] = this._args(at, o);
    const back = (o.dir || 'back') === 'back', f = this._viewAt(at).facing, p = this._posAt(at), d = this.d;
    const hd = back ? -f : f;
    const bed = { hipX: p.x + hd * this.hStand * this.k * .98, z: p.z, topY: this.floorY, headDir: hd, prone: !back };
    const lie = { posture: 'lie', x: bed.hipX, z: p.z, y: this.floorY, bed };
    const from = { ...this.P }, dur = fr(o.frames ?? 9), tb = fr(4);
    this._seg({ kind: 'fall', t0: at, t1: at + dur + tb, to: lie, ev: (t, view) => {
      const u = clamp((t - at) / dur), A = this._postureBody({ ...from, posture: 'stand' }, view);
      const ang = (back ? f : -f) * HALF * E.inQuad(u);
      A.spin = ang; A.pivotY = 0; A.y = this.floorY + (t > at + dur ? .02 * Math.sin(PI * clamp((t - at - dur) / tb)) : 0) + .2 * d.headD * this.k * Math.abs(Math.sin(ang));
      A.lying = u > .9; A.arms = { R: { sh: rad(back ? 60 * u : 120 * u), el: rad(20) }, L: { sh: rad(back ? 40 * u : 100 * u), el: rad(25) } };
      return A; } });
    this.P = { ...this.P, ...lie, view: { facing: bed.prone ? hd : -hd, turn: 1 } };
    this._addView(at + dur, { facing: bed.prone ? hd : -hd, turn: 1, back: false });
    return this;
  }

  // ================================================================================================= arms: poses & gestures
  _hand(t) { for (const s of [this.near, this.far]) if (s !== this.sling && !this.holds.some(h => h.side === s && t >= h.t0 && t < (h.t1 ?? Infinity))) return s; return this.sling === this.near ? this.far : this.near; }
  /** the forearm in its sling: across the chest, a little below it (side / 3/4: forward of the chest; front: across to the
   *  other side), drawn in front of the torso; the hand a mitten */
  _slingArm(B, s) {
    const front = (B.turn ?? 1) < .3, out = this.C.sh.front[s][0] > 0 ? -1 : 1;
    return front ? { to: ['chest', out * .28, -.3], bend: out, hand: 'mitten', z: .06 } : { to: ['chest', .72, -.26], bend: 1, hand: 'mitten', z: .06 };
  }
  _poseClips(def, t0, t1, o = {}) {
    const P = typeof def === 'string' ? POSES[def] : def; if (!P) { console.warn('anim: unknown pose ' + def); return []; }
    const fin = o.instant ? 0 : fr(o.in ?? 6), fout = t1 == null ? 0 : fr(o.out ?? 6), ein = o.ease || 'inOutQuad', eout = o.easeOut || 'inOutQuad';
    // one-handed: the definition's R arm drives the chosen hand (mirrored to the other side in a front view)
    const pairs = o.side ? [['R', o.side]] : SIDES.map(s => [s, s]), made = [];
    const mirror = a => a.to ? { ...a, to: [a.to[0], -a.to[1], a.to[2]], bend: -(a.bend ?? 1) } : { ...a, sh: -a.sh, el: -(a.el ?? 0) };
    for (const [src, ch] of pairs) {
      if (!(P.side?.[src] || P.front?.[src])) continue;
      made.push(this._clip('arm' + ch, { t0, t1, fin, fout, ein, eout, gesture: !!o.gesture, fn: (t, ctx) => {
        const front = (ctx.B.turn ?? 1) < .5, def2 = front ? (P.front || P.side) : (P.side || P.front); let a = def2?.[src]; if (!a) return null;
        if (front && src !== ch) a = mirror(a);
        if (front && P.front) a = this._frontArm(a, ch);
        const v = { ...a, hand: a.hand || P.hand };
        if (o.loop && t >= t0 + fin) { const ph = 2 * PI * (t - t0 - fin) / fr(o.loop.period), r2 = this._resolveArm(v, ctx, ch);
          if (o.loop.el && (o.side || src === this.near)) return { ...r2, el: r2.el + rad(o.loop.el) * Math.sin(ph), hand: v.hand, deg: false };
          if (o.loop.rub) return { ...r2, sh: r2.sh + rad(4) * Math.sin(ph + (ch === 'L' ? PI : 0)), hand: v.hand, deg: false }; }
        return v; } }));
    }
    if (P.lean || P.hip) this._clip('body', { t0, t1, fin, fout, ein, eout, fn: () => ({ lean: rad(P.lean || 0), hipY: (P.hip || 0) * this.d.height }) });
    // a big lean (a bow, a deep bend) can't read in a front view: swap to 3/4 for the pose, one frame each way (the references' turn)
    if (Math.abs(P.lean || 0) >= 20 && !P.seated && !o.keepView) { const v0 = this._viewAt(t0); if (v0.turn < .3 && !v0.back) { this._addView(t0, { ...v0, turn: .5 }); if (t1 != null) this._addView(t1, v0); } }
    if (P.head) this._clip('head', { t0, t1, fin, fout, ein, eout, fn: () => ({ tilt: rad(P.head.tilt || 0), nod: P.head.nod, turn: P.head.turn }) });
    if (P.look) this.look(P.look, t0, { until: t1 });
    return made;
  }
  /** hold a named pose (POSES) from `at` (until { until }) */
  pose(name, at, o) { [at, o] = this._args(at, o); const t1 = o.until != null ? this._t(o.until) + fr(o.out ?? 6) : null; this._poseClips(name, at, t1, { ...o, in: o.instant ? 0 : o.in ?? (o.fin ? o.fin / F : 6) }); return this; }
  /** a gesture with its measured timing: in (frames) -> hold -> out. { until, hold (s), side: 'L'|'R', target } */
  gesture(name, at, o) {
    [at, o] = this._args(at, o);
    const G = gestureOf(name); if (!G) { console.warn('anim: unknown gesture ' + name); return this; }
    const fin = fr(G.in), fout = fr(G.out), hold = o.until != null ? Math.max(0, this._t(o.until) - at - fin) : o.hold ?? fr(G.hold);
    const t1 = at + fin + hold + fout;
    const one = typeof G.pose === 'string' && ['wave', 'point', 'present', 'explain', 'handUp', 'fist', 'facepalm'].includes(G.pose);
    const side = o.side || (one ? this._hand(at) : null);
    if (G.pre) this._poseClips(G.pre.pose, at - fr(G.pre.frames), at + fr(1), { in: G.pre.frames, out: 1, gesture: true, side, mirror: side === 'L' });
    if (o.target && (name === 'point' || name === 'reach')) return this.point(o.target, at, { ...o, reach: name === 'reach' });
    this._poseClips(G.pose, at, t1, { in: G.in, out: G.out, ease: G.ease, easeOut: G.easeOut, gesture: true, loop: G.loop, side: one ? side : null, mirror: one && side === 'L' });
    if (G.bounce) this._clip('body', { t0: at, t1, fin, fout, fn: t => ({ hipY: -G.bounce.amp * this.d.height * (1 - Math.cos(2 * PI * (t - at) / fr(G.bounce.period))) / 2 }) });
    if (G.clap) { const per = fr(G.clap.period); this._clip('armL', { t0: at, t1, fin, fout, gesture: true, fn: (t, ctx) => { const o2 = Math.abs(Math.sin(PI * (t - at) / per)); return { to: ['chest', .55 - .22 * o2 * (ctx.B.turn >= .5 ? 1 : 0), -.35 + .04 * o2], bend: 1, hand: 'open' }; } });
      this._clip('armR', { t0: at, t1, fin, fout, gesture: true, fn: () => ({ to: ['chest', .58, -.35], bend: 1, hand: 'open' }) }); }
    if (G.laugh) { const L = G.laugh, per = fr(L.period), sg = o.back ? -1 : 1, lean = o.back ? L.lean * .7 : (o.lean ?? L.lean);   // { back: true }: thrown back (iq500 s35, the hero on the bench)
      this._clip('body', { t0: at, t1, fin: fr(3), fout, ein: 'outQuad', fn: t => ({ lean: sg * (rad(lean) + rad(5) * Math.sin(2 * PI * (t - at) / per)) }) });
      this._clip('head', { t0: at, t1, fin: fr(3), fout, add: true, fn: t => ({ nod: sg * (-.15 - .12 * (1 + Math.sin(2 * PI * (t - at) / per)) / 2) }) }); }
    if (o.face) this.face(o.face, at + fin * .5);
    this.cur = Math.max(this.cur, t1);
    return this;
  }
  wave(at, o) { return this.gesture('wave', at, o); }
  shrug(at, o) { return this.gesture('shrug', at, o); }
  cheer(at, o) { return this.gesture('cheer', at, o); }
  celebrate(at, o) { return this.gesture('celebrate', at, o); }
  clap(at, o) { return this.gesture('clap', at, o); }
  facepalm(at, o) { return this.gesture('facepalm', at, o); }
  thinking(at, o) { return this.gesture('thinking', at, o); }
  crossArms(at, o) { return this.gesture('crossArms', at, o); }
  handsOnHips(at, o) { return this.gesture('handsOnHips', at, o); }
  handsOnHead(at, o) { return this.gesture('handsOnHead', at, o); }
  fistPump(at, o) { return this.gesture('fistPump', at, o); }
  cower(at, o) { return this.gesture('cower', at, o); }
  fidget(at, o) { return this.gesture('fidget', at, o); }
  /** laugh: the 30-40 deg bend + 6-frame bob, face ^ ^ + O with the HA! sticker (face 'ha'; { face } to change, { ha: false } = 'laugh' without it) */
  laugh(at, o) { [at, o] = this._args(at, o); if (!o.noFace) this.face(o.face || (o.ha === false ? 'laugh' : 'ha'), at); return this.gesture('laugh', at, o); }
  explain(at, o) { return this.gesture('talk', at, o); }
  /** point at a target (actor / spot / [x, y, z] / prop): arm straight at it, 5 f accelerating in, hard stop, 5 f out */
  point(target, at, o) {
    [at, o] = this._args(at, o);
    const side = o.side || this._hand(at), G = gestureOf(o.reach ? 'reach' : 'point');
    const fin = fr(G.in), fout = fr(G.out), hold = o.until != null ? Math.max(0, this._t(o.until) - at - fin) : o.hold ?? fr(G.hold), t1 = at + fin + hold + fout;
    this._clip('arm' + side, { t0: at, t1, fin, fout, ein: G.ease, eout: G.easeOut, gesture: true, fn: (t, ctx) => {
      const w = this._targetWorld(target, t), p = this._toLocal(ctx.B, w), s0 = ctx.sh[side];
      const reach = (this.d.upperArm + this.d.fa) * .985, dx = p.x - s0.x, dy = p.y - s0.y, dist = Math.hypot(dx, dy) || 1;
      if (o.reach) { const L = Math.min(reach, dist - .3 * this.d.headD) + .004 * this.d.height * clamp((t - at - fin) / Math.max(fr(4), hold)); return { target: { x: s0.x + dx / dist * L, y: s0.y + dy / dist * L }, hand: 'open' }; }
      const a = angOf(dx, dy) - (dx < 0 ? 0 : 0); return { sh: a, el: rad(3), deg: false, hand: 'point' }; } });
    this.cur = Math.max(this.cur, t1);
    return this;
  }
  /** reach toward a target and stop 0.3 D short (no contact): 4 f out, slow creep, 4 f back */
  reach(target, at, o) { [at, o] = this._args(at, o); return this.point(target, at, { ...o, reach: true }); }
  /** press / tap a target (button, screen, bell): reach 5 f ease-out, contact 10 f, leave 5 f ease-in; the hand touches it exactly */
  press(target, at, o) {
    [at, o] = this._args(at, o);
    const side = o.side || this._hand(at), fin = fr(5), hold = fr(o.frames ?? 10), fout = fr(5), t1 = at + fin + hold + fout;
    this._clip('arm' + side, { t0: at, t1, fin, fout, ein: 'outCubic', eout: 'inQuad', gesture: true, fn: (t, ctx) => ({ target: this._toLocal(ctx.B, this._targetWorld(target, t)), hand: 'point', bend: 1 }) });
    this.cur = Math.max(this.cur, t1); return this;
  }
  _targetWorld(target, t) {
    if (target == null) return new THREE.Vector3();
    if (target.isActor) { const B = target._bodyRaw(stepT(t)); return target._toWorld(B, target._ctx(B).head); }
    if (target.isVector3) return target;
    if (Array.isArray(target)) return new THREE.Vector3(target[0], target[1] ?? 1, target[2] ?? 0);
    if (target.isObject3D) { const c = custodyAt(target, t); if (c.mode === 'hand' && c.actor !== this) { c.actor.update(t); } target.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(target); return b.isEmpty() ? target.getWorldPosition(new THREE.Vector3()) : b.getCenter(new THREE.Vector3()); }
    const s = spotOf(this.S, target); return new THREE.Vector3(s?.x ?? 0, s?.topY ?? s?.y ?? 1, s?.z ?? 0);
  }

  // ================================================================================================= head
  /** look at an actor / point / prop / 'camera' / 'down' / 'up' / [eyeX, eyeY] (eyes + a small head turn, 3-5 frames) */
  look(target, at, o) {
    [at, o] = this._args(at, o);
    const t1 = o.until != null ? this._t(o.until) : null, dur = fr(o.frames ?? 4);
    const fn = (t, ctx) => {
      if (Array.isArray(target) && target.length === 2 && typeof target[0] === 'number' && Math.abs(target[0]) <= 1.01) return { eyes: target };
      if (target === 'camera') return { eyes: [0, 0], turn: -(ctx?.B?.turn ?? .5) * .7 };
      if (target === 'down') return { eyes: [0, -.8], nod: -.3 }; if (target === 'up') return { eyes: [0, .8], nod: .3 };
      if (target == null) return { eyes: [0, 0] };
      const w = this._targetWorld(target, t), B = ctx?.B || this._bodyRaw(t), h = this._toLocal(B, w), hd = ctx?.head || this._ctx(B).head;
      const dx = h.x - hd.x, dy = h.y - hd.y, L = Math.hypot(dx, dy) || 1;
      return { eyes: [clamp(dx / L * 1.2, -1, 1), clamp(dy / L * 1.2, -1, 1)], nod: clamp(dy / L, -.6, .6) * .5, turn: dx < 0 ? -.8 : 0 };
    };
    this.lookKeys.push({ t: at, t1, dur, fn }); this.lookKeys.sort((a, b) => a.t - b.t);
    this._clip('head', { t0: at, t1, fin: dur, fout: dur, ein: 'inOutSine', fn: (t, ctx) => { const v = fn(t, ctx); return { nod: v.nod ?? 0, turn: v.turn ?? 0 }; } });
    return this;
  }
  /** nod yes: { n: times } - 4 f down, 4 f up each */
  nod(at, o) { [at, o] = this._args(at, o); const n = o.n ?? 2, per = fr(8); this._clip('head', { t0: at, t1: at + n * per + fr(2), fin: fr(1), fout: fr(2), add: true, fn: t => ({ nod: -.35 * Math.sin(PI * clamp((t - at) / per % 1)) * (t - at < n * per ? 1 : 0) }) }); return this; }
  /** shake the head no: 3 swings of 6 f */
  headShake(at, o) { [at, o] = this._args(at, o); const n = o.n ?? 3, per = fr(6); this._clip('head', { t0: at, t1: at + n * per, fin: fr(2), fout: fr(3), add: true, fn: t => ({ turn: .35 * Math.sin(2 * PI * (t - at) / (per * 2)) }) }); return this; }
  /** tilt the head (degrees, + toward the facing side) over 5 frames and hold ({ until }) - the talking head nudge */
  tilt(deg, at, o) { [at, o] = this._args(at, o); const t1 = o.until != null ? this._t(o.until) + fr(5) : null; this._clip('head', { t0: at, t1, fin: fr(o.frames ?? 5), fout: fr(5), add: true, pure: true, ein: 'inOutSine', fn: () => ({ tilt: rad(deg) }) }); return this; }
  /** a head nudge (2-3 frames, ~0.05 D): the references' close-up acting */
  nudge(at, o) { [at, o] = this._args(at, o); return this.tilt(o.deg ?? (this.rand() < .5 ? -6 : 6), at, { frames: 3, ...o }); }
  /** double take: a glance, look away, then snap back with the shock face (the references play surprise as a face swap) */
  doubleTake(target, at, o) { [at, o] = this._args(at, o); this.look(target, at, { until: at + fr(10), frames: 3 }); this.look(null, at + fr(10), { frames: 3, until: at + fr(16) }); this.look(target, at + fr(18), { frames: 2, until: o.until }); this.face(o.face || 'shock', at + fr(18)); this._clip('body', { t0: at + fr(18), t1: at + fr(26), fin: fr(2), fout: fr(5), fn: () => ({ hipY: .01 * this.d.height, lean: rad(-3) }) }); return this; }

  // ================================================================================================= face
  /** change the expression at `at`: inside a shot a 3-frame crossfade (FACE_BLEND; brows, under-eye arcs and tears fade
   *  with it), at the shot's first frames an instant swap (the cut hides it); { blend: frames } sets it (0 = the
   *  references' hard swap, 3-8 f for slow mood shifts). A hard swap mid-shot read as a glitch to the owner (video 01:
   *  'tired' -> 'bored' at t0 + 1 s, the purple arcs vanished in one frame). */
  face(expr, at, o) { [at, o] = this._args(at, o); if (o.only === false) return this; const bl = o.blend ?? (at > this.t0 + fr(2) ? FACE_BLEND : 0); this.faceKeys.push({ t: at, expr, blend: fr(bl) }); this.faceKeys.sort((a, b) => a.t - b.t); this._dirty(); return this; }
  /** emotional silence: toggle two faces with holds of 16, 12, 10, 4 ... frames and 1-frame blends (sister s121) */
  sob(a, b, t0, t1) { const holds = [16, 12, 10, 4, 10, 12, 10, 4]; let t = this._t(t0), i = 0; const end = this._t(t1); while (t < end) { this.face(i % 2 ? a : b, t, { blend: 1 }); t += fr(holds[i % holds.length]); i++; } return this; }
  /** a blink at `at` (3 closed frames) - blinks also happen by themselves every 3.5-4 s */
  blink(at, o) { [at, o] = this._args(at, o); (this._manualBlinks ||= []).push([at, at + fr(o.frames ?? 3)]); this._dirty(); return this; }
  blinks(on = true) { this._noBlink = !on; this._dirty(); return this; }
  _blinkAt(t) {
    for (const [a, b] of this._manualBlinks || []) if (t >= a && t < b) return 1;
    if (this._noBlink || this.extra) return 0;
    if (!this._blinkList) {
      const r = rnd(this.seed * 31 + 7), L = [], t1 = (this.S?.t1 ?? this.t0 + 30) + 1; let t = this.t0 + BLINK.minFirst + r() * 2.6;
      while (t < t1) { const n = r() < BLINK.closed4 ? 4 : BLINK.closed; let tt = t; for (const k of this.faceKeys) if (Math.abs(k.t - tt) < fr(4)) tt = k.t + fr(6); L.push([tt, tt + fr(n)]); t = tt + BLINK.every + (r() - .5) * 2 * BLINK.jitter; }
      this._blinkList = L;
    }
    for (const [a, b] of this._blinkList) if (t >= a && t < b) return 1;
    return 0;
  }
  /** lip-sync from t0 to t1 (seconds or words): an O ring that peaks once per syllable (every 5-8 frames) */
  talk(t0, t1, o = {}) { const a = this._t(t0), b = this._t(t1); this.talks.push({ t0: a, t1: b, words: o.words || null }); this._dirty(); return this; }
  /** lip-sync a quoted line: say('Next year for my birthday', { from }) finds each word in the narration timeline */
  say(text, o = {}) {
    const from = this._t(o.from ?? o.at), words = String(text).replace(/^\[[^\]]*\]\s*/, '').split(/\s+/).filter(Boolean);
    const W = []; let near = from;
    if (this.S?.at) for (const w of words) { const clean = w.replace(/[^\p{L}\p{N}']/gu, ''); if (!clean) continue; const s = this.S.at(clean, { near: near + .3 }), e = this.S.at(clean, { near: near + .3, which: 'e' }); if (Math.abs(s - near) < 3 && e > s) { W.push([s, e]); near = e; } }
    if (W.length) return this.talk(W[0][0], W[W.length - 1][1], { words: W });
    return this.talk(from, o.to ?? from + words.length * .32);
  }
  _talkAt(t) {
    let v = 0;
    for (const sp of this.talks) {
      if (t < sp.t0 - fr(TALK.lead + 1) || t > sp.t1 + fr(TALK.tail + 4)) continue;
      if (!sp._syl) {        // syllable peaks (seeded): one per 5-8 frames inside each word; words without timings get made up
        const r = rnd(this.seed * 13 + Math.round(sp.t0 * 100)), words = sp.words || (() => { const L = []; let a = sp.t0; while (a < sp.t1 - fr(3)) { const len = fr(8 + r() * 12); L.push([a, Math.min(sp.t1, a + len)]); a += len + fr(2 + r() * 5); } return L; })();
        sp._words = words; sp._syl = [];
        for (const [a, b] of words) { const n = Math.max(1, Math.round((b - a) / fr(TALK.syll[0] + r() * (TALK.syll[1] - TALK.syll[0])))); for (let i = 0; i < n; i++) sp._syl.push({ p: a + (i + .5) * (b - a) / n - fr(.5), amp: .72 + r() * .28 }); }
      }
      let inWord = false;
      const W = sp._words;
      for (let i = 0; i < W.length; i++) { const [a, b] = W[i], nx = W[i + 1]; const keep = nx && (nx[0] - b) < fr(TALK.gapKeep); if (t >= a - fr(TALK.lead) && t <= b + (keep ? nx[0] - b : fr(TALK.tail))) { inWord = true; break; } }
      if (!inWord) continue;
      let m = TALK.thin;
      for (const s of sp._syl) { const dt = t - s.p; if (dt < -fr(2.5) || dt > fr(3.5)) continue; const k = dt < 0 ? E.outQuad(clamp(1 + dt / fr(2.5))) : 1 - E.inQuad(clamp(dt / fr(3.5))); m = Math.max(m, s.amp * k); }
      v = Math.max(v, m);
    }
    return v;
  }
  _lookAt(t) {
    let eyes = [0, 0];
    for (const k of this.lookKeys) { if (t < k.t) break; if (k.t1 != null && t >= k.t1 + k.dur) { continue; }
      let v; try { v = k.fn(t, null); } catch { v = { eyes: [0, 0] }; }
      const u = clamp((t - k.t) / Math.max(F, k.dur)), out = k.t1 != null && t > k.t1 ? 1 - clamp((t - k.t1) / Math.max(F, k.dur)) : 1;
      eyes = [lerp(eyes[0], v.eyes[0], u * out), lerp(eyes[1], v.eyes[1], u * out)]; }
    return eyes;
  }
  _faceAt(t) {
    let expr = this.face0, mix = null;
    const K = this.faceKeys; let i = -1; for (let j = 0; j < K.length; j++) if (K[j].t <= t) i = j;
    if (i >= 0) { const k = K[i], prev = i > 0 ? K[i - 1].expr : this.face0; if (k.blend > 0 && t < k.t + k.blend) { expr = prev; mix = { expr2: k.expr, k: clamp((t - k.t) / k.blend) }; } else expr = k.expr; }
    const f = { expr, blink: this._blinkAt(t), talk: this._talkAt(t), look: this._lookAt(t) };
    if (mix) f.mix = mix;
    return f;
  }

  // ================================================================================================= holding
  _gripArm(g, ctx, side, far) {
    const an = this._anchor(ctx, g.anchor), D = ctx.D * (g.anchor === 'head' ? ctx.kH : 1), tk = ctx.B.turn ?? 1, fk = tk >= .5 ? 1 : lerp(.25, 1, tk * 2);
    let x = g.at[0] * fk, y = g.at[1];
    if (far && g.both) { x += g.both[0] * fk; y += g.both[1]; if (tk < .5) x = -x; }
    if (g.hang) { const s0 = ctx.sh[side]; return { target: { x: s0.x + .1 * D, y: s0.y - (this.d.upperArm + this.d.fa) * .995 }, hand: g.hand, tilt: g.tilt }; }
    return { target: { x: an.x + x * D, y: an.y + y * D }, bend: g.bend ?? 1, hand: g.hand, tilt: g.tilt, z: g.z };
  }
  /** hold a prop (a PROPS name or an object) in a hand from `at` ({ until }): { hand: 'R'|'L'|'both', grip (GRIPS name), at, until, props: {make options} } */
  hold(prop, at, o) {
    [at, o] = this._args(at, o);
    const obj = typeof prop === 'string' ? PROPS.make(prop, o.props || {}) : prop;
    const kind = obj.userData?.kind || (typeof prop === 'string' ? prop : obj.name);
    const gname = o.grip || DEFAULT_GRIP[kind] || DEFAULT_GRIP[String(kind).split(/[-_ ]/)[0]] || 'mug';
    const g = gripOf(gname);
    const side = o.hand === 'both' ? this.near : (o.hand || this._hand(at));
    const t1 = o.until != null ? this._t(o.until) : null;
    if (typeof prop === 'string') { this.S?.scene?.add(obj); firstTouch(obj); custodyOf(obj)[0] = { t0: -Infinity, mode: 'hidden' }; }
    addCustody(obj, { t0: at, t1: o.keep ? null : t1, mode: 'hand', actor: this, side, grip: gname });
    this.touched.add(obj);
    const fin = o.fin != null ? fr(o.fin) : at <= this.t0 + 1e-3 || typeof prop === 'string' ? 0 : fr(5);
    this._clip('arm' + side, { t0: at, t1: t1 != null ? t1 + fr(5) : null, fin, fout: fr(5), ein: 'outQuad', hold: obj, fn: (t, ctx) => this._gripArm(g, ctx, side, false) });
    if (g.both || o.hand === 'both') { const s2 = side === 'R' ? 'L' : 'R'; this._clip('arm' + s2, { t0: at, t1: t1 != null ? t1 + fr(5) : null, fin, fout: fr(5), ein: 'outQuad', fn: (t, ctx) => this._gripArm(g, ctx, s2, true) }); }
    if (g.look || g.nod) this._clip('head', { t0: at, t1, fin: fin || fr(4), fout: fr(4), fn: () => ({ nod: g.nod ?? 0 }) });
    if (g.look) this.look(g.look, at, { until: t1 });
    this.holds.push({ obj, side, t0: at, t1: t1 ?? Infinity, grip: gname });
    this._lastHeld = obj;
    return this;
  }
  _held(t, prop) { const H = this.holds.filter(h => t >= h.t0 && t < h.t1 && (!prop || h.obj === prop || h.obj.userData?.kind === prop)); return H[H.length - 1] || null; }
  _release(obj) { const prev = obj.userData._fig; if (prev) { try { prev.detach(obj); } catch { /* */ } obj.userData._fig = null; obj.userData._key = null; } }
  _applyCustody(obj, t) {
    const e = custodyAt(obj, t);
    if (e.mode === 'hand') { if (e.actor !== this) e.actor.update(this._raw ?? t); return; }        // the holder attached it before its setPose
    this._release(obj);
    if (e.mode === 'hidden') { obj.visible = false; return; }
    if (e.mode === 'world') { obj.visible = e.vis ?? true; const par = e.parent || this.S.scene; if (obj.parent !== par) par.add(obj); obj.position.copy(e.pos); obj.quaternion.copy(e.quat); obj.scale.copy(e.scale); return; }
    obj.visible = true;
    if (e.mode === 'jump' || e.mode === 'fall' || e.mode === 'place') {
      if (obj.parent !== this.S.scene) this.S.scene.add(obj);
      const p = e.pos(t); placeWorld(obj, p.x, p.y, p.z, p.ang ?? 0, p.mir ?? false, p.grip ?? [0, 0], false);
    }
  }
  // where the grip point of a prop held by this actor is at time t (world), without touching the rig (pure)
  _gripWorld(side, t) { const P = this.poseAt(t); return this._toWorld(P.B, this._handFK(P, side), .02); }
  /** sip from the held mug / cup / glass: raise 9 f (the measured iq500 s11 curve), 20 f at the mouth, lower 4 f; eyes ^ ^ */
  sip(at, o) {
    [at, o] = this._args(at, o);
    const h = this._held(at); const side = h?.side || this.near;
    const up = fr(9), hold = fr(o.hold ?? 20), down = fr(4), t1 = at + up + hold + down, g = gripOf('sip');
    this._clip('arm' + side, { t0: at, t1, fin: up, fout: down, ein: 'lin', eout: 'inOutQuad', fn: (t, ctx) => this._gripArm(g, ctx, side, false), wfn: true, curve: SIP_UP });
    const c = this.clips['arm' + side][this.clips['arm' + side].length - 1]; c.ein = k => tbl(SIP_UP, k * 9);
    this._clip('head', { t0: at + fr(5), t1: t1 - fr(1), fin: fr(4), fout: fr(4), add: true, fn: () => ({ nod: .12 }) });
    if (o.face !== false) this.face(o.face || 'happy', at + up);
    this.cur = Math.max(this.cur, t1);
    return this;
  }
  drink(at, o) { return this.sip(at, o); }
  /** drop the held prop at `at`: it falls with constant acceleration (slight spin) to the floor and stays */
  drop(at, o) {
    [at, o] = this._args(at, o);
    const h = this._held(at, o.prop); if (!h) return this;
    const obj = h.obj; h.t1 = at;
    const self = this, g = 9.8 * .7, floor = o.floorY ?? this.floorY, gp = gripPoint(obj, h.grip), s0 = obj.userData._s0 || 1;
    const lb = localBox(obj), lowY = lb.isEmpty() ? 0 : lb.min.y;
    let p0 = null;
    addCustody(obj, { t0: at, mode: 'fall', pos: t => {
      p0 ??= self._gripWorld(h.side, at);
      const u = Math.max(0, t - at), y = Math.max(floor + (gp[1] - lowY) * s0, p0.y - .5 * g * u * u - .3 * u);
      const f = self._bodyRaw(at).facing; return { x: p0.x + .04 * f * Math.min(u, .4), y, z: p0.z, ang: rad(-15) * f * Math.min(1, u / .65), mir: false, grip: gp }; } });
    this.cur = Math.max(this.cur, at + fr(4));
    return this;
  }
  /** put the held prop on a surface (a spot with topY / [x, y, z] / an object): reach 5 f, let go, back 5 f */
  put(obj, surface, at, o) {
    [at, o] = this._args(at, o);
    const h = obj ? this.holds.find(x => x.obj === obj && at >= x.t0 && at < x.t1) || this._held(at) : this._held(at); if (!h) return this;
    const s = spotOf(this.S, surface) || {}, tgt = new THREE.Vector3(s.x ?? 0, s.topY ?? s.y ?? .75, s.z ?? 0);
    if (s.obj) { const b = new THREE.Box3().setFromObject(s.obj); tgt.set(o.x ?? (b.min.x + b.max.x) / 2, b.max.y, s.z); }
    const tc = at + fr(6), side = h.side;
    this._clip('arm' + side, { t0: at, t1: tc + fr(6), fin: fr(6), fout: fr(5), ein: 'inOutQuad', eout: 'outQuad', fn: (t, ctx) => { const w = tgt.clone(); w.y += .06; return { target: this._toLocal(ctx.B, w), hand: 'mitten' }; } });
    h.t1 = tc;
    const o0 = h.obj; firstTouch(o0);
    addCustody(o0, { t0: tc, mode: 'world', parent: this.S.scene, pos: new THREE.Vector3(tgt.x, tgt.y, tgt.z + .01), quat: new THREE.Quaternion(), scale: new THREE.Vector3(o0.userData._s0 || 1, o0.userData._s0 || 1, o0.userData._s0 || 1) });
    this.cur = Math.max(this.cur, tc + fr(6)); return this;
  }
  /** pick a prop up from where it is: reach 5 f, take it, hold it (grip by its kind) */
  pick(obj, at, o) {
    [at, o] = this._args(at, o);
    firstTouch(obj); this.touched.add(obj);
    const side = o.hand || this._hand(at), tc = at + fr(6);
    this._clip('arm' + side, { t0: at, t1: tc + fr(1), fin: fr(6), fout: fr(1), ein: 'inOutQuad', fn: (t, ctx) => { const e = custodyAt(obj, Math.min(t, tc - 1e-4)); obj.updateMatrixWorld(true); const w = e.mode === 'world' && e.pos ? (e.parent?.isScene ? e.pos.clone() : obj.getWorldPosition(new THREE.Vector3())) : obj.getWorldPosition(new THREE.Vector3()); const gp = gripPoint(obj, o.grip || 'hand'); w.x += gp[0] * (obj.userData._s0 || 1); w.y += gp[1] * (obj.userData._s0 || 1); return { target: this._toLocal(ctx.B, w), hand: 'mitten' }; } });
    this.hold(obj, tc, { ...o, hand: side, fin: 6 });
    this.cur = Math.max(this.cur, tc + fr(6));
    return this;
  }
  /** hand the held prop to another actor: both arms reach (5 f), the prop jumps hands in 2 frames at `at`, receiver over prop over giver */
  give(obj, other, at, o) {
    if (obj && obj.isActor) { o = at; at = other; other = obj; obj = null; }
    [at, o] = this._args(at, o);
    const h = obj ? this.holds.find(x => x.obj === obj) : this._held(at); if (!h) { console.warn('anim: give: nothing held'); return this; }
    const prop = h.obj, side = h.side, side2 = o.hand || other._hand(at);
    const gap = (this.d.upperArm + this.d.fa) * .95 * this.k + (other.d.upperArm + other.d.fa) * .95 * other.k;
    this._pair(other, at - fr(6), gap, o);
    const mid = t => { const a = this._toWorld(this._bodyRaw(t), this._ctx(this._bodyRaw(t)).chest), b = other._toWorld(other._bodyRaw(t), other._ctx(other._bodyRaw(t)).chest); return new THREE.Vector3((a.x + b.x) / 2, Math.min(a.y, b.y) - .05, (a.z + b.z) / 2); };
    const ta = at - fr(6), tj = at, tb = at + fr(2), tEnd = at + fr(12);
    this._clip('arm' + side, { t0: ta, t1: tb + fr(6), fin: fr(5), fout: fr(5), ein: 'outQuad', eout: 'outQuad', fn: (t, ctx) => ({ target: this._toLocal(ctx.B, mid(t)), hand: 'mitten' }) });
    other._clip('arm' + side2, { t0: ta + fr(1), t1: tEnd, fin: fr(4), fout: fr(6), ein: 'outQuad', fn: (t, ctx) => ({ target: other._toLocal(ctx.B, mid(t)), hand: 'mitten' }) });
    h.t1 = tj;
    const gname = o.grip || h.grip;
    addCustody(prop, { t0: tj, mode: 'jump', pos: t => { const u = E.inOutQuad(clamp((t - tj) / (tb - tj))); const a = this._gripWorld(side, t), b = other._gripWorld(side2, t); const f = other._bodyRaw(t).facing; return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: Math.max(a.z, b.z) + .015, ang: rad(gripOf(gname).tilt || 0) * f, mir: false, grip: gripPoint(prop, gname) }; } });
    other.touched.add(prop);
    other.hold(prop, tb, { hand: side2, grip: gname, fin: 6, until: o.until });
    // receiver's hand > prop > giver's hand: the receiver stands a whole figure depth in front during the hand-off
    other._clip('body', { t0: ta - fr(2), t1: tEnd + fr(8), fin: fr(1), fout: fr(1), fn: () => ({ dz: this._depth() + Z.step * .5 }) });
    this.touches.push({ other, t0: ta, t1: tEnd }); other.touches.push({ other: this, t0: ta, t1: tEnd });
    this.cur = Math.max(this.cur, tEnd); other.cur = Math.max(other.cur, tEnd);
    return this;
  }
  /** look at the phone, or talk on it: phone(at, until, { ear: true }) - at the ear the head does the 21-frame nod loop */
  phone(at, until, o = {}) {
    const a = this._t(at), b = until != null ? this._t(until) : null;
    let h = this._held(a, 'phone');
    const grip = o.ear ? 'phone-ear' : o.grip || 'phone-look';
    if (!h) { this.hold(o.prop || 'phone', a, { grip, until: b, fin: o.fin ?? 6 }); h = this._held(a + 1e-3); }
    else if (o.ear) { const side = h.side, g = gripOf('phone-ear'); this._clip('arm' + side, { t0: a, t1: b, fin: fr(6), fout: fr(6), fn: (t, ctx) => this._gripArm(g, ctx, side, false), tilt: true });
      addCustody(h.obj, { t0: a, t1: h.t1 === Infinity ? null : h.t1, mode: 'hand', actor: this, side, grip: 'phone-ear' }); }
    if (o.ear) { const N = PHONE_NOD, per = fr(N.up + N.down + N.hold), ph = this.rand() * per;
      this._clip('body', { t0: a + fr(8), t1: b, fin: fr(2), fout: fr(2), fn: t => { const u = ((t - a + ph) % per) / F; const k = u < N.up ? E.inOutSine(u / N.up) : u < N.up + N.down ? 1 - E.inOutSine((u - N.up) / N.down) : 0; return { lean: rad(-1.2) * k }; } });
      this._clip('head', { t0: a + fr(8), t1: b, fin: fr(2), fout: fr(2), add: true, fn: t => { const u = ((t - a + ph) % per) / F; const k = u < N.up ? E.inOutSine(u / N.up) : u < N.up + N.down ? 1 - E.inOutSine((u - N.up) / N.down) : 0; return { nod: .1 * k }; } }); }
    return this;
  }
  /** read the held book / sheet (or a new book): hold it at the face, look down at it */
  read(at, until, o = {}) { const a = this._t(at); if (!this._held(a)) this.hold(o.prop || 'book', a, { grip: o.grip || 'book', until, fin: 6 }); else this.look('down', a, { until }); return this; }
  /** seated typing at a desk: the desk pose, still hands with a 9-frame burst every ~1.5 s (iq500 s37) */
  type(at, until, o = {}) {
    const a = this._t(at), b = until != null ? this._t(until) : null;
    this.pose('typing', a, { until: b != null ? b - fr(6) : undefined });
    const r = rnd(this.seed + 5); const bursts = []; for (let t = a + .6 + r() * .8; t < (b ?? a + 20) - .5; t += 1.2 + r() * 1.2) bursts.push(t);
    for (const s of SIDES) this._clip('arm' + s, { t0: a + fr(6), t1: b, fin: 0, fout: 0, fn: (t, ctx) => { let dx = 0; for (const t0 of bursts) if (t >= t0 && t < t0 + fr(9)) dx = .05 * Math.sin(PI * (t - t0) / fr(9)) * Math.sin(2 * PI * (t - t0) / fr(4.5) + (s === 'L' ? PI : 0)); return { to: ['table', (s === 'R' ? 1.15 : 1.0) + dx, .12], bend: 1, hand: 'nub' }; } });
    return this;
  }
  /** write: at a desk with a pen (seated), or on a board with a marker ({ board: true }, the arm stays still while the text writes itself) */
  write(at, until, o = {}) { const a = this._t(at); if (o.board) return this.hold(o.prop || 'marker', a, { grip: 'marker', until, fin: 6 }); return this.hold(o.prop || 'pen', a, { grip: 'pen', until, fin: 6 }).look('down', a, { until }); }
  /** eat at a table: the near hand goes to the mouth (9 f up, 6 f there, 6 f down) every ~2 s */
  eat(at, until, o = {}) {
    const a = this._t(at), b = this._t(until ?? a + 6), side = o.side || this.near, per = o.every ?? 2;
    this.pose('eating', a, { until: b });
    this._clip('arm' + side, { t0: a, t1: b, fin: fr(6), fout: fr(6), fn: (t, ctx) => { const u = ((t - a) % per) / F; const k = u < 9 ? E.inOutQuad(u / 9) : u < 15 ? 1 : u < 21 ? 1 - E.inOutQuad((u - 15) / 6) : 0; const m = { x: ctx.head.x + .4 * ctx.D, y: ctx.head.y - .3 * ctx.D }, tb = { x: ctx.table.x + .95 * ctx.D, y: ctx.table.y + .1 * ctx.D }; return { target: { x: lerp(tb.x, m.x, k), y: lerp(tb.y, m.y, k) }, hand: 'mitten' }; } });
    return this;
  }

  // ================================================================================================= two characters
  // put `other` at `gap` metres in front of this actor (this one steps there when needed) and face each other at `at`
  _pair(other, at, gap, o = {}) {
    const a = this._posAt(at), b = other._posAt(at), dir = Math.sign(b.x - a.x) || 1;
    const want = b.x - dir * gap;
    if (o.move !== false && Math.abs(want - a.x) > .06) {
      // walk (or run: { style: 'run' }) so as to arrive right at `at`, at the style's own pace
      const W = WALKS[o.style || (this.age === 'kid' || this.age === 'small' ? 'kid' : 'normal')] || WALKS.normal, v = W.stride * this.H * this.k / (W.frames * F);
      const dur = Math.max(.4, Math.abs(want - a.x) / v + (W.accel + W.decel) * F / 2);
      this.walk({ x: want, z: o.z ?? a.z }, Math.max(this.t0, at - dur - fr(2)), { style: o.style, until: at - fr(2) }); }
    this.faceEachOther(other, at - (o.move !== false && Math.abs(want - a.x) > .06 ? fr(2) : 0), { turn: o.turn ?? 1 });
  }
  /** keep this actor's head clear of `other`'s while they touch (hug, group hug, catch), from t0 to t1 (null = for good):
   *  this one steps aside by `share` of what is missing (the other by the rest, through its own call) so the two heads
   *  overlap by at most HEAD_RIM of the smaller head's width - the far head sits beside / behind the near one and both
   *  faces read. Measured every frame on both bodies without these clips (_bodyRaw noSep), at the shot's head size (a
   *  close-up's 1.3x heads need more room). (video 01 7:45: a hug close-up merged two heads into one black blob with four
   *  eyes; 1:30.7: the catcher's head sank into the caught man's) */
  _headsApart(other, t0, t1, o = {}) {
    const share = o.share ?? .5, rim = o.rim ?? HEAD_RIM;
    const kH = A => A.headScale ?? (A.S?._closeUp ? 1.3 : 1);
    // the head centre: the body's (lean, close-up size) turned about the neck by the roll of the context-free head clips
    const head = (A, B, t) => { const k = kH(A), c = A._ctx({ ...B, headScale: k }), tl = A._pureTilt(t, B.head?.tilt || 0); let h = c.head;
      if (tl) { const vx = h.x - c.neck.x, vy = h.y - c.neck.y, co = Math.cos(tl), si = Math.sin(tl); h = { x: c.neck.x + vx * co + vy * si, y: c.neck.y - vx * si + vy * co }; }
      return { p: A._toWorld(B, h), r: A.d.headR * A.k * k * 1.1 }; };          // drawn: the outline + rim add ~10 %
    this._clip('body', { t0, t1, fin: fr(o.fin ?? 3), fout: fr(6), ein: 'inOutSine', sep: true, fn: t => {
      const A = this._bodyRaw(t, true), B = other._bodyRaw(t, true), a = head(this, A, t), b = head(other, B, t);
      const want = a.r + b.r - rim * 2 * Math.min(a.r, b.r), dy = a.p.y - b.p.y;
      if (Math.abs(dy) >= want) return null;
      const dx = a.p.x - b.p.x, need = Math.sqrt(want * want - dy * dy) - Math.abs(dx);
      if (need <= 0) return null;
      const dir = Math.sign(dx) || Math.sign(A.x - B.x) || -(A.facing || 1);
      return { dx: dir * need * share };
    } });
    return this;
  }
  /** hug another actor: arms wrap in 4-5 f, the pair leans in over 16 f, then holds ({ until }); the hugged one is drawn in front,
   *  the hugger's near arm over their back (timeloop s144, sister s124). { mutual: true } = both hug */
  hug(other, at, o) {
    [at, o] = this._args(at, o);
    if (Array.isArray(other)) return other.length > 1 ? this._hugGroup(other, at, o) : this.hug(other[0], at, o);
    const gap = (.3 * this.D * this.k + .3 * other.D * other.k);
    this._pair(other, at, gap, o);
    const t1 = o.until != null ? this._t(o.until) + fr(6) : null, wrap = fr(MOVES.hugWrap);
    // the references: the smaller one in front, the bigger one's arm over their back (needs the rig's arm depth offset);
    // without it the bigger one stands in front so its wrapping arm still reads over the smaller one
    const small = other.height <= this.height ? other : this, big = small === this ? other : this;
    const front = o.front ?? (this.C.armZ ? small : big), back = front === this ? other : this;
    front._clip('body', { t0: at - fr(2), t1, fin: fr(1), fout: fr(1), fn: () => ({ dz: back._depth() + Z.step * .5 }) });
    const wrapArm = (A, B, side, high, over) => A._clip('arm' + side, { t0: at, t1, fin: wrap, fout: fr(6), ein: 'outQuad', fn: (t, ctx) => {
      const Bb = B._bodyRaw(t), bc = B._ctx(Bb); const p = B._toWorld(Bb, { x: -.22 * B.D, y: bc.chest.y + (high ? .25 : -.15) * B.D });
      return { target: A._toLocal(ctx.B, p), z: over ? B._depth() * 1.6 : 0, hand: 'mitten', bend: 1 }; } });
    wrapArm(this, other, this.near, false, back === this);
    wrapArm(this, other, this.far, true, false);
    if (o.mutual !== false) { const d1 = fr(1); other._clip('arm' + other.near, { t0: at + d1, t1, fin: wrap, fout: fr(6), ein: 'outQuad', fn: (t, ctx) => { const Ab = this._bodyRaw(t), ac = this._ctx(Ab); return { target: other._toLocal(ctx.B, this._toWorld(Ab, { x: -.22 * this.D, y: ac.chest.y + .3 * this.D })), z: back === other ? this._depth() * 1.6 : 0, hand: 'mitten' }; } });
      other._clip('arm' + other.far, { t0: at + d1, t1, fin: wrap, fout: fr(6), ein: 'outQuad', fn: (t, ctx) => { const Ab = this._bodyRaw(t), ac = this._ctx(Ab); return { target: other._toLocal(ctx.B, this._toWorld(Ab, { x: -.2 * this.D, y: ac.chest.y + .05 * this.D })), hand: 'mitten' }; } }); }
    // settle: the pair drifts together in ONE screen direction over 16 f (timeloop s146: both heads move the same way),
    // heads tilt toward each other. No lean toward each other: faces that lean in collide (sister s264 keeps the heads
    // side by side, ~0.7 D apart, the front one's head over the other's cheek)
    const set = fr(MOVES.hugSettle), sway = (o.sway ?? .04) * this.d.height * this.k * (this.rand() < .5 ? -1 : 1), swDir = Math.sign(sway) || 1;
    for (const A of [this, other]) { A._clip('body', { t0: at + wrap, t1, fin: set, fout: fr(6), ein: 'inOutSine', fn: t => ({ lean: rad(4) * swDir * (A._viewAt(t).facing || 1), dx: sway }) }); A._clip('head', { t0: at + wrap, t1, fin: set, fout: fr(6), add: true, pure: true, ein: 'inOutSine', fn: () => ({ tilt: rad(-10) }) }); }
    if (o.face) { this.face(o.face, at + wrap); other.face(o.face, at + wrap); }
    // the heads side by side, cheek to cheek at most (both step apart by half of what is missing)
    this._headsApart(other, at - fr(2), t1); other._headsApart(this, at - fr(2), t1);
    const end = Infinity; this.touches.push({ other, t0: at - fr(4), t1: end }); other.touches.push({ other: this, t0: at - fr(4), t1: end });
    this.cur = Math.max(this.cur, t1 ?? at + wrap + set); other.cur = Math.max(other.cur, t1 ?? at + wrap + set);
    return this;
  }
  /** a GROUP HUG: a.hug([b, c], at, { until, face }) - this one turns to the front in the middle, the others step in on
   *  either side (each on the side they stand), turn to them and lean in; this one's arms go round both backs (drawn over
   *  them), theirs round its waist. (review 01-pause S5: "Mum hugs you both" / "a family hug" left the little sister outside) */
  _hugGroup(others, at, o) {
    const t1 = o.until != null ? this._t(o.until) + fr(6) : null, wrap = fr(MOVES.hugWrap), hx = this._posAt(at).x, hz = this._posAt(at).z;
    this._addView(at - fr(2), { facing: this._viewAt(at).facing || 1, turn: 0, back: false });
    const sorted = others.slice(0, 2).sort((a, b) => a._posAt(at).x - b._posAt(at).x), sides = sorted.length === 1 ? [Math.sign(sorted[0]._posAt(at).x - hx) || 1] : [-1, 1];
    const dzOf = B => this._depth() * .7 + Z.step;
    sorted.forEach((B, i) => {
      const s = sides[i], gap = .62 * this.D * this.k + .45 * B.D * B.k, want = hx + s * gap, p = B._posAt(at);   // heads cheek to cheek, not over each other
      if (o.move !== false && Math.abs(p.x - want) > .06) {
        const W = WALKS[B.age === 'kid' || B.age === 'small' ? 'kid' : 'normal'] || WALKS.normal, v = W.stride * B.H * B.k / (W.frames * F);
        B.walk({ x: want, z: hz }, Math.max(B.t0, at - Math.abs(p.x - want) / v - .3), { until: at - fr(2) }); }
      B._addView(at - fr(1), { facing: -s, turn: .5, back: false });
      B._clip('body', { t0: at - fr(2), t1, fin: fr(1), fout: fr(1), fn: () => ({ dz: dzOf(B) }) });
      // their near arm round this one's waist
      B._clip('arm' + B.near, { t0: at + fr(1), t1, fin: wrap, fout: fr(6), ein: 'outQuad', fn: (t, ctx) => { const A = this._bodyRaw(t), ac = this._ctx(A);
        return { target: B._toLocal(ctx.B, this._toWorld(A, { x: 0, y: ac.chest.y - .35 * this.D }).add(new THREE.Vector3(-s * .18 * this.D * this.k, 0, 0))), hand: 'mitten' }; } });
      B._clip('body', { t0: at + wrap, t1, fin: fr(MOVES.hugSettle), fout: fr(6), ein: 'inOutSine', fn: () => ({ lean: rad(6) }) });
      B._clip('head', { t0: at + wrap, t1, fin: fr(MOVES.hugSettle), fout: fr(6), add: true, pure: true, ein: 'inOutSine', fn: () => ({ tilt: rad(-8) }) });
      if (o.face) B.face(o.face, at + wrap);
      B._headsApart(this, at - fr(2), t1, { share: 1 });          // the one in the middle stays; each side steps out
      this.touches.push({ other: B, t0: at - fr(4), t1: Infinity }); B.touches.push({ other: this, t0: at - fr(4), t1: Infinity });
      B.cur = Math.max(B.cur, t1 ?? at + wrap);
    });
    // this one's arms: each round the back of the partner on its own side (picked by where the shoulder is drawn this frame)
    for (const side of SIDES) this._clip('arm' + side, { t0: at, t1, fin: wrap, fout: fr(6), ein: 'outQuad', fn: (t, ctx) => {
      const sx = this._toWorld(ctx.B, ctx.sh[side]).x, P = sorted.reduce((a, b) => Math.abs(b._posAt(t).x - sx) < Math.abs(a._posAt(t).x - sx) ? b : a);
      const Bb = P._bodyRaw(t), bc = P._ctx(Bb), back = P._toWorld(Bb, { x: -.24 * P.D, y: bc.chest.y + .1 * P.D });
      return { target: this._toLocal(ctx.B, back), z: dzOf(P) + P._depth() * 1.3, hand: 'mitten', bend: Math.sign(sx - this._posAt(t).x) || 1 }; } });
    this._clip('head', { t0: at + wrap, t1, fin: fr(MOVES.hugSettle), fout: fr(6), add: true, ein: 'inOutSine', fn: () => ({ nod: -.12 }) });
    if (o.face) this.face(o.face, at + wrap);
    this.cur = Math.max(this.cur, t1 ?? at + wrap);
    return this;
  }
  /** handshake: near hands meet EXACTLY halfway (5 f reach), pump 3 x 8 frames, hold, release 5 f ({ pumps, until }) */
  shake(other, at, o) {
    [at, o] = this._args(at, o);
    const reachA = (this.d.upperArm + this.d.fa) * this.k, reachB = (other.d.upperArm + other.d.fa) * other.k;
    this._pair(other, at, .62 * (reachA + reachB) + .1, o);
    const n = o.pumps ?? 3, per = fr(8), tin = at - fr(5), tp = at + fr(2), t1 = o.until != null ? this._t(o.until) + fr(5) : tp + n * per + fr(6) + fr(5);
    const meet = t => { const A = this._bodyRaw(t), B = other._bodyRaw(t), a = this._toWorld(A, this._ctx(A).sh[this.near]), b = other._toWorld(B, other._ctx(B).sh[other.near]);
      const amp = .1 * Math.min(this.D * this.k, other.D * other.k), u = t - tp, pump = u > 0 && u < n * per ? -amp * Math.sin(2 * PI * u / per) : 0;
      return new THREE.Vector3((a.x + b.x) / 2, Math.min(a.y, b.y) - .42 * this.d.torso * this.k + pump, (a.z + b.z) / 2); };
    for (const A of [this, other]) A._clip('arm' + A.near, { t0: tin, t1, fin: fr(5), fout: fr(5), ein: 'outQuad', eout: 'inOutQuad', fn: (t, ctx) => ({ target: A._toLocal(ctx.B, meet(t)), hand: 'grip' }) });
    this.touches.push({ other, t0: at, t1 }); other.touches.push({ other: this, t0: at, t1 });
    this.cur = Math.max(this.cur, t1); other.cur = Math.max(other.cur, t1);
    return this;
  }
  handshake(other, at, o) { return this.shake(other, at, o); }
  /** high five: both near arms up to a point above the heads between them (4 f accelerating), contact 2 f, back 5 f */
  highFive(other, at, o) {
    [at, o] = this._args(at, o);
    this._pair(other, at, (.95 * (this.d.upperArm + this.d.fa) * this.k + .95 * (other.d.upperArm + other.d.fa) * other.k) * .55, o);
    const tin = at - fr(4), t1 = at + fr(2) + fr(5);
    const meet = t => { const A = this._bodyRaw(t), B = other._bodyRaw(t), a = this._toWorld(A, this._ctx(A).head), b = other._toWorld(B, other._ctx(B).head); return new THREE.Vector3((a.x + b.x) / 2, Math.max(a.y, b.y) + .55 * this.D * this.k, (a.z + b.z) / 2); };
    for (const A of [this, other]) A._clip('arm' + A.near, { t0: tin, t1, fin: fr(4), fout: fr(5), ein: 'inQuad', eout: 'outQuad', fn: (t, ctx) => ({ target: A._toLocal(ctx.B, meet(t)), hand: 'open' }) });
    if (o.face !== false) { this.face(o.face || 'happy', at); other.face(o.face || 'happy', at); }
    this.touches.push({ other, t0: at, t1: at + fr(2) }); other.touches.push({ other: this, t0: at, t1: at + fr(2) });
    this.cur = Math.max(this.cur, t1); other.cur = Math.max(other.cur, t1);
    return this;
  }
  /** hold hands while side by side (same facing; the nearer one's far hand meets this one's near hand) ({ at, until }) */
  holdHands(other, at, o) {
    [at, o] = this._args(at, o);
    const t1 = o.until != null ? this._t(o.until) : null;
    const meet = t => { const A = this._bodyRaw(t), B = other._bodyRaw(t), a = this._toWorld(A, this._ctx(A).hip), b = other._toWorld(B, other._ctx(B).hip); return new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 - .02, (a.z + b.z) / 2); };
    const za = this._posAt(at).z, zb = other._posAt(at).z, nearer = zb >= za ? other : this, farther = nearer === other ? this : other;
    farther._clip('arm' + farther.near, { t0: at, t1, fin: fr(5), fout: fr(5), ein: 'outQuad', fn: (t, ctx) => ({ target: farther._toLocal(ctx.B, meet(t)), hand: 'grip' }) });
    nearer._clip('arm' + nearer.far, { t0: at, t1, fin: fr(5), fout: fr(5), ein: 'outQuad', fn: (t, ctx) => ({ target: nearer._toLocal(ctx.B, meet(t)), hand: 'grip' }) });
    this.touches.push({ other, t0: at, t1: Infinity }); other.touches.push({ other: this, t0: at, t1: Infinity });   // they stay side by side
    return this;
  }
  /** put a hand on the other's shoulder (from beside / behind): reach 5 f, rest, release 5 f ({ until }) */
  handOnShoulder(other, at, o) {
    [at, o] = this._args(at, o);
    const t1 = o.until != null ? this._t(o.until) + fr(5) : at + fr(5) + 1.5;
    const a = this._posAt(at), b = other._posAt(at);
    if (o.move !== false && Math.abs(a.x - b.x) > .7 * this.k) this.walk({ x: b.x - Math.sign(b.x - a.x) * .5 * this.k, z: a.z }, at - 1.2, { until: at - fr(3) });
    this._clip('arm' + this.near, { t0: at, t1, fin: fr(5), fout: fr(5), ein: 'outQuad', fn: (t, ctx) => { const B = other._bodyRaw(t), c = other._ctx(B); const s = c.sh[other.near], top = { x: s.x, y: s.y + .14 * other.D }; return { target: this._toLocal(ctx.B, other._toWorld(B, top)), hand: 'mitten', z: .04 }; } });
    this.touches.push({ other, t0: at, t1 }); other.touches.push({ other: this, t0: at, t1 });
    this.cur = Math.max(this.cur, t1); return this;
  }
  /** push: both hands to the other's chest (4 f), they stagger back 0.25 m over 8 f and recover */
  push(other, at, o) {
    [at, o] = this._args(at, o);
    this._pair(other, at, (this.d.upperArm + this.d.fa) * this.k * .9, o);
    const tc = at, t1 = at + fr(10);
    for (const s of SIDES) this._clip('arm' + s, { t0: at - fr(4), t1, fin: fr(4), fout: fr(6), ein: 'inQuad', fn: (t, ctx) => { const B = other._bodyRaw(Math.min(t, tc)), c = other._ctx(B); return { target: this._toLocal(ctx.B, other._toWorld(B, { x: .2 * other.D, y: c.chest.y + (s === 'R' ? 0 : .2) * other.D })), hand: 'open' }; } });
    const dir = Math.sign(other._posAt(at).x - this._posAt(at).x) || 1, dist = o.dist ?? .3;
    other._clip('body', { t0: tc, t1: tc + fr(22), fin: fr(8), fout: fr(12), ein: 'outQuad', fn: () => ({ dx: dir * dist, lean: rad(-12) }) });
    if (o.face !== false) other.face(o.face || 'shock', tc);
    this.touches.push({ other, t0: tc - fr(1), t1: tc + fr(2) }); other.touches.push({ other: this, t0: tc - fr(1), t1: tc + fr(2) });
    this.cur = Math.max(this.cur, t1); return this;
  }
  /** catch someone falling backward: they tip back ~40 deg over 8 f, this actor's arms take their upper back ({ until }) */
  catch(other, at, o) {
    [at, o] = this._args(at, o);
    const a = this._posAt(at), b = other._posAt(at), dir = Math.sign(a.x - b.x) || -1;
    if (o.move !== false && Math.abs(Math.abs(a.x - b.x) - .55) > .1) this.walk({ x: b.x + dir * .55 * this.k, z: a.z }, at - 1, { until: at - fr(2), style: 'brisk' });
    this._addView(at - fr(2), { facing: -dir, turn: 1 }); other._addView(at - fr(2), { facing: -dir, turn: 1 });
    const t1 = o.until != null ? this._t(o.until) : at + 2.5;
    other._clip('body', { t0: at, t1, fin: fr(8), fout: fr(10), ein: 'inQuad', fn: () => ({ lean: rad(-38) }) });
    for (const s of SIDES) this._clip('arm' + s, { t0: at, t1, fin: fr(7), fout: fr(8), ein: 'outQuad', fn: (t, ctx) => { const B = other._bodyRaw(t), c = other._ctx(B); return { target: this._toLocal(ctx.B, other._toWorld(B, { x: -.25 * other.D, y: c.chest.y + (s === 'R' ? .1 : .4) * other.D })), hand: 'mitten', z: s === this.near ? .04 : 0 }; } });
    this._clip('body', { t0: at + fr(4), t1, fin: fr(6), fout: fr(8), fn: () => ({ lean: rad(10) }) });
    this._headsApart(other, at, t1, { share: 1 });                  // the catcher steps back: the falling head lands beside, not in his
    other.face(o.face || 'shock', at);
    this.touches.push({ other, t0: at, t1 }); other.touches.push({ other: this, t0: at, t1 });
    this.cur = Math.max(this.cur, t1); return this;
  }
  /** carry another actor ({ until, style, sit, to }). style 'shoulder' (default when the carried one is more than ~70 % of the
   *  carrier's height: a fireman's carry, folded over the near shoulder, legs hanging in front, torso down the back) or 'arms'
   *  (a child held at the chest). until = set them down beside (3 f), or sit: a seat spot / seat prop to put them on, to: a
   *  spot / [x, z] to walk to while carrying (arrives at until). A frozen person carried by a free one rides on the carrier's
   *  clock and stays where they are put. (review 01-pause S4: the old chest carry lifted adults above the carrier's head) */
  carry(other, at, o) {
    [at, o] = this._args(at, o);
    const style = o.style ?? (other.height > this.height * .7 ? 'shoulder' : 'arms');
    if (style === 'shoulder') return this._carryShoulder(other, at, o);
    return this._carryArms(other, at, o);
  }
  // the person being moved rides on the mover's clock (a frozen one carried by a free one), then holds where it was left
  _ride(other, t0, t1) { (other._rides ||= []).push({ t0, t1: t1 ?? Infinity }); other._dirty(); }
  // put a carried / dragged actor down at t1: on a seat (o.sit), or standing at its place (beside the carrier)
  _putDown(other, t1, o, x, z, posture = 'stand', facing = null) {
    if (o.sit != null) { const seat = seatOf(this.S, o.sit);
      if (seat) { const to = other._setSeated(seat, {}, false); other._addView(t1, { facing: seat.facing ?? other._viewAt(t1).facing ?? 1, turn: Math.max(.5, other._viewAt(t1).turn), back: false });
        other._seg({ kind: 'cut', t0: t1, t1, to, ev: () => null }); other.P = { ...other.P, ...to }; return; } }
    const p = o.put ?? posture;
    if (facing) other._addView(t1, { facing, turn: 1, back: false });
    other.P = { ...other.P, posture: p, x, z, y: other.floorY, stance: { L: -.02, R: .02 } };
    other._seg({ kind: 'cut', t0: t1, t1, to: { ...other.P }, ev: () => null });
  }
  // walk up beside `other` (on this one's side of them) to arrive just before `at`
  _reach(other, at, gap) {
    const p = this._posAt(at), q = other._posAt(at), side = Math.sign(p.x - q.x) || 1, want = q.x + side * gap;
    if (Math.abs(p.x - want) > .12) this.walk({ x: want, z: p.z }, Math.max(this.t0, at - Math.abs(p.x - want) / 1.4 - .25), { until: at - fr(2), style: 'brisk' });
    this._addView(at - fr(1), { facing: -side, turn: 1, back: false });
  }
  _carryShoulder(other, at, o) {
    const t1 = o.until != null ? this._t(o.until) : null, me = this, lift = fr(o.frames ?? 6);
    if (o.move !== false) this._reach(other, at, .3 * this.k);
    if (o.to != null) { const ap = spotOf(this.S, o.to); if (ap) this.walk(ap, at + lift, { style: o.walk ?? 'slow', until: t1 ?? undefined }); }
    const from = { ...other.P }, B0 = other._postureBody(from, other._viewAt(at), at);
    // the carried body: folded ~150 deg at the hips over the near shoulder (figure space mirrored: front faces down)
    const TH = rad(156), HIP = rad(139);
    other._seg({ kind: 'carried', t0: at, t1: t1 ?? Infinity, to: { ...from }, ev: (t, view) => {
      const A = me._bodyRaw(t), ca = me._ctx(A), F0 = A.facing || 1, u = E.inOutQuad(clamp((t - at) / lift));
      const top = me._toWorld(A, { x: ca.sh[me.near].x + .05 * me.D, y: ca.sh[me.near].y + .2 * me.D });
      const B = other._postureBody({ ...from, posture: 'stand' }, { facing: -F0, turn: 1, back: false }, t);
      B.facing = -F0; B.turn = 1; B.back = false; B.lean = 0; B.lying = true; B.pivotY = B.hipY; B.still = true;
      for (const s of SIDES) B.legs[s] = { hip: HIP + (s === 'L' ? rad(-4) : rad(4)), knee: rad(s === 'L' ? 14 : 8), foot: rad(10) };
      // limp arms dangling from the hanging shoulders, the forearms swung back (hands near the head, not on the floor)
      B.armsFixed = { L: { sh: rad(148), el: rad(52) }, R: { sh: rad(160), el: rad(64) } }; B.arms = B.armsFixed;
      B.head = { tilt: 0, nod: -.4, turn: 0 }; B.spin = F0 * TH;
      const wx = top.x, wy = top.y - B.hipY * other.k;
      // the lift: from where they were (standing / seated) to the shoulder over `lift` frames
      // drawn BEHIND the carrier: the carrier's body stays whole, the legs hang in front, the torso down the back, and the
      // carrier's near arm (in front) wraps the thighs
      B.x = lerp(B0.x, wx, u); B.y = lerp(B0.y, wy, u); B.spin *= E.outQuad(clamp((t - at) / lift));   // he tips over first, then rises onto the shoulder
      B.z = A.z - other._depth() * 1.1;
      // during the lift the legs fold from where they were (seated / standing) into the carry, no flip through the air
      if (u < 1) { B.lying = u > .5; for (const s of SIDES) { const L0 = B0.legs?.[s]; if (L0) B.legs[s] = { hip: lerp(L0.hip, B.legs[s].hip, u), knee: lerp(L0.knee, B.legs[s].knee, u), foot: lerp(L0.foot ?? 0, B.legs[s].foot, u) }; } }
      return B; } });
    // the carrier: a small forward lean, the near arm round the carried one's thighs (in front), the far arm on their back
    this._clip('body', { t0: at, t1, fin: lift, fout: fr(4), fn: () => ({ lean: rad(9) }) });
    const legPt = (t, k) => { const B = other._bodyRaw(t), c = other._ctx(B); return other._toWorld(B, { x: c.knee.x * k, y: c.B.hipY + (c.knee.y - c.B.hipY) * k }); };
    this._clip('arm' + this.near, { t0: at, t1, fin: lift, fout: fr(5), ein: 'outQuad', fn: (t, ctx) => ({ target: this._toLocal(ctx.B, legPt(t, .55)), z: this._depth() * 2.4, hand: 'mitten', bend: 1 }) });
    this._clip('arm' + this.far, { t0: at, t1, fin: lift, fout: fr(5), ein: 'outQuad', fn: (t, ctx) => { const B = other._bodyRaw(t); return { target: this._toLocal(ctx.B, other._toWorld(B, { x: 0, y: B.hipY + .9 * other.D })), hand: 'mitten', bend: 1 }; } });
    this._ride(other, at, t1);
    if (t1 != null) { const p = this._posAt(t1), side = this._viewAt(t1).facing || 1; this._putDown(other, t1, o, p.x + side * .5 * this.k, p.z); }
    this.touches.push({ other, t0: at, t1: t1 ?? Infinity }); other.touches.push({ other: this, t0: at, t1: t1 ?? Infinity });
    other.moves.push({ t0: at, t1: t1 ?? Infinity, air: true, kind: 'carried' });
    return this;
  }
  /** drag another actor along the floor: this one walks to `to` (leaning forward, the near hand back holding their wrist), they
   *  slide behind half-lying, face up, one arm raised to the hand ({ to: spot | [x, z], until (arrival), sit, style }) */
  drag(other, to, at, o) {
    [at, o] = this._args(at, o);
    const t1 = o.until != null ? this._t(o.until) : null, me = this, grab = fr(6);
    const ap = spotOf(this.S, to), p0 = this._posAt(at), q0 = other._posAt(at);
    // start beside them, facing the way out
    const dir = ap ? Math.sign(ap.x - q0.x) || 1 : (this._viewAt(at).facing || 1);
    if (Math.abs(p0.x - (q0.x + dir * .75 * this.k)) > .1) this.walk({ x: q0.x + dir * .75 * this.k, z: p0.z }, Math.max(this.t0, at - .9), { until: at - fr(2), style: 'brisk' });
    this._addView(at, { facing: dir, turn: 1, back: false });
    if (ap) this.walk(ap, at + grab, { style: o.style ?? 'slow', until: t1 ?? undefined, face: { facing: dir, turn: 1 } });
    const from = { ...other.P }, B0 = other._postureBody(from, other._viewAt(at), at);
    const TH = rad(65), gap = .62 * other.height;
    other._seg({ kind: 'dragged', t0: at, t1: t1 ?? Infinity, to: { ...from }, ev: (t, view) => {
      const A = me._bodyRaw(t), u = E.inOutQuad(clamp((t - at) / grab)), F0 = dir;
      const B = other._postureBody({ ...from, posture: 'stand' }, { facing: -F0, turn: 1, back: false }, t);
      B.facing = -F0; B.turn = 1; B.back = false; B.lean = 0; B.lying = true; B.pivotY = B.hipY; B.still = true;
      for (const s of SIDES) B.legs[s] = { hip: rad(22 + (s === 'L' ? -3 : 3)), knee: rad(s === 'L' ? 6 : 14), foot: rad(-5) };
      B.spin = -F0 * TH * u + (1 - u) * 0;
      const wx = A.x - F0 * gap, wy = other.floorY + .1 * other.k - B.hipY * other.k;
      B.x = lerp(B0.x, wx, u); B.y = lerp(B0.y, wy, u); B.z = A.z - Z.step * 2;
      B.head = { tilt: 0, nod: .25, turn: 0 };
      return B; } });
    // both arms meet halfway between the two shoulders: the mover's near hand back and down, the dragged one's arm up
    const meet = t => { const A = me._bodyRaw(t), ca = me._ctx(A), B = other._bodyRaw(t), cb = other._ctx(B);
      const a = me._toWorld(A, ca.sh[me.near]), b = other._toWorld(B, cb.sh[other.near]); return a.clone().lerp(b, .58); };
    this._clip('body', { t0: at, t1, fin: grab, fout: fr(4), fn: () => ({ lean: rad(16) }) });
    this._clip('arm' + this.near, { t0: at, t1, fin: grab, fout: fr(5), ein: 'outQuad', fn: (t, ctx) => ({ target: this._toLocal(ctx.B, meet(t)), hand: 'grip', bend: -1 }) });
    other._clip('arm' + other.near, { t0: at, t1, fin: grab, fout: fr(5), ein: 'outQuad', fn: (t, ctx) => ({ target: other._toLocal(ctx.B, meet(t)), hand: 'grip' }) });
    this._ride(other, at, t1);
    if (t1 != null) { const p = this._posAt(t1); this._putDown(other, t1, o, p.x - dir * gap * .8, p.z, 'floor', -dir); }
    this.touches.push({ other, t0: at, t1: t1 ?? Infinity }); other.touches.push({ other: this, t0: at, t1: t1 ?? Infinity });
    other.moves.push({ t0: at, t1: t1 ?? Infinity, air: true, kind: 'dragged' });
    return this;
  }
  /** carry a child in the arms in front of the chest ({ until } then set them down beside: 3 f) */
  _carryArms(other, at, o) {
    const t1 = o.until != null ? this._t(o.until) : null, me = this;
    const lift = fr(8);
    const from = { ...other.P };
    const carried = { posture: 'stand', x: from.x, z: from.z, y: other.floorY, stance: { L: -.02 * other.d.height, R: .02 * other.d.height } };
    other._seg({ kind: 'carried', t0: at, t1: t1 ?? Infinity, to: carried, ev: (t, view) => {
      const A = me._bodyRaw(t), ca = me._ctx(A), p = me._toWorld(A, { x: ca.chest.x + .55 * me.D, y: ca.chest.y - .55 * me.D });
      const B = other._postureBody({ ...from, posture: 'stand' }, { facing: A.facing, turn: 1, back: false }, t), u = E.inOutQuad(clamp((t - at) / lift));
      const hipW = { x: p.x, y: p.y - other.hStand * other.k * .0 };
      B.x = lerp(from.x, hipW.x, u); B.y = lerp(other.floorY, hipW.y - other.hStand * other.k, u); B.z = A.z + .04;
      for (const s of SIDES) B.legs[s] = { hip: rad(70 * u), knee: rad(85 * u), foot: rad(-10) };
      B.lean = rad(-10 * u); B.arms = { R: { sh: rad(110 * u), el: rad(60 * u) }, L: { sh: rad(100 * u), el: rad(60 * u) } };
      return B; } });
    for (const s of SIDES) this._clip('arm' + s, { t0: at - fr(4), t1, fin: fr(6), fout: fr(5), ein: 'outQuad', fn: (t, ctx) => ({ to: ['chest', .6, s === 'R' ? -.4 : .1], z: s === this.near ? .06 : 0, hand: 'mitten' }) });
    if (t1 != null) { const side = (this._viewAt(t1).facing || 1); other.P = { ...other.P, x: this._posAt(t1).x + side * .55, z: this._posAt(t1).z }; other._tween({ posture: 'stand', x: other.P.x, z: other.P.z, stance: { L: -.02, R: .02 } }, t1, 3, 'outQuad'); }
    this._ride(other, at, t1);
    this.touches.push({ other, t0: at, t1: t1 ?? Infinity }); other.touches.push({ other: this, t0: at, t1: t1 ?? Infinity });
    other.moves.push({ t0: at, t1: t1 ?? Infinity, air: true, kind: 'carried' });
    return this;
  }
}

// =====================================================================================================================
// scene helpers (engine.js turns S_HELPERS into S.<name>(...))
// one-call hand inserts (S.hand): the pose a prop asks for, where the arm comes from (hand angle: 0 = fingers up), held poses
const HAND_POSE_FOR = { phone: 'hold-phone', tablet: 'hold-phone', mug: 'hold-cup', cup: 'hold-cup', glass: 'hold-cup', bottle: 'hold-cup', pen: 'pen', pencil: 'pen', marker: 'pen',
  tweezers: 'pinch', lighter: 'pinch', chip: 'pinch', coins: 'cup', card: 'sheet', paper: 'sheet', envelope: 'sheet', money: 'sheet', notebook: 'sheet', keys: 'dangle', watch: 'dangle' };
const HELD_POSES = new Set(['hold-phone', 'phone', 'phone-pov', 'phone-ear', 'hold-cup', 'mug', 'pinch', 'pen', 'sheet', 'dangle', 'grip', 'clasp', 'cup', 'open-palm']);
const EDGE = { bottom: [0, -1, 0], 'bottom-right': [.75, -.66, .45], 'bottom-left': [-.75, -.66, -.45], right: [1, 0, HALF], left: [-1, 0, -HALF], top: [0, 1, PI], 'top-right': [.75, .66, PI * .78], 'top-left': [-.75, .66, -PI * .78] };
const TOP_VIEW = new Set(['mug', 'cup', 'plate', 'keyboard']);
/** S.hand(null, { shake: 'hal' }) / S.handshake('main', 'hal', o): a handshake close-up in one call (lessons 02-handshake:
 *  builders laid two S.hand cards over each other - a 'flat' and a 'clasp' - and both thumbs stood up in a V). `who`'s hand
 *  comes from the left (its back to the camera, fingers round the other palm, thumb over the other hand's back), `shake`'s
 *  from the right (its palm behind, its fingers wrapped over the near hand); both thumbs lie along the top. from: 'right'
 *  puts `who` on the right. pump: word | time (3 pumps of 8 f, pumps: n), at + enter (both slide in over 4 f), leave,
 *  backdrop / like / mood, size (palm width, .08), frameH, x, y, camera: false. -> { near, far, hands, frameH, rest }
 *  kind: 'hold' | 'bump' | 'pinky' = holding hands / a fist bump / a pinky promise instead (pairInsert below) */
function shakeInsert(S, o) {
  if (o.kind && o.kind !== 'shake') return pairInsert(S, o);          // holding hands / a fist bump / a pinky promise
  if (!S.placeName && o.backdrop !== false) S.place(o.backdrop || 'backdrop', o.backdrop ? { mood: o.mood } : { like: o.like || 'kitchen', mood: o.mood, bokeh: true });
  // the wrists 2 palm widths apart: the near fingers end on the far palm, the far hand's back shows between them and its cuff
  const W = o.size ?? .08, z = o.z ?? 2.6, lift = o.height ?? 1.2, dx = W * 1.0, swap = o.from === 'right';
  const lookOf = who => ({ ...CAST.resolve(who ?? 'main', SETTINGS) });
  const [lw, rw] = swap ? [o.shake, o.who] : [o.who, o.shake];
  const near = RIG.Hand(lookOf(lw), { pose: 'shake', side: 'R', size: W, sleeveLen: o.sleeveLen ?? 2.8, style: o.style });
  const far = RIG.Hand(lookOf(rw), { pose: 'shakeWrap', side: 'L', size: W, sleeveLen: o.sleeveLen ?? 2.8, style: o.style });
  near.setAngle(-HALF); far.setAngle(HALF);
  const rest = [[-dx, lift], [dx, lift]];
  for (const [h, [x, y]] of [[near, rest[0]], [far, rest[1]]]) { h.root.position.set(x, y, z); h.root.userData.kind = 'hand'; S.add(h.root); h.setRim?.(o.rim !== undefined ? o.rim : (S.rim ?? '#f0d8b0'), S.rimDir || [-.6, .8]); }
  const tw = v => typeof v === 'string' ? S.at(v) : v, at = o.at != null ? tw(o.at) : S.t0, enter = !!o.enter, leave = o.leave != null ? tw(o.leave) : null;
  const pump = o.pump != null ? tw(o.pump) : null, n = o.pumps ?? 3, per = 8 * F, frameH = o.frameH ?? W * 3.3, far0 = frameH * 1.4;
  S.tick(t => {
    let k = 0; if (enter) k = 1 - E.outCubic(segK(t, at, at + 4 * F)); if (leave != null) k = Math.max(k, E.inQuad(segK(t, leave, leave + 10 * F)));
    const u = pump != null ? t - pump : -1, dy = u > 0 && u < n * per ? -W * .22 * Math.sin(2 * PI * u / per) : 0;
    near.root.position.set(rest[0][0] - far0 * k, rest[0][1] + dy, z); far.root.position.set(rest[1][0] + far0 * k, rest[1][1] + dy, z);
  });
  if (o.camera !== false) S.camera('static', { on: [0, lift, z], frame: { h: frameH }, x: o.x ?? 0, y: o.y ?? .02 });
  return { near, far, hands: [near, far], frameH, rest: [0, lift, z] };
}

// ---------------------------------------------------------------------------------------------------------------------
// TWO-HAND CLOSE-UPS beyond the handshake: S.handshake(a, b, { kind: 'hold' | 'bump' | 'pinky' }) = S.handhold(a, b) /
// S.fistBump(a, b) / S.pinkyPromise(a, b). Video 01's builders stacked two whole S.hand gloves on one spot for "Mum takes
// your hand", "Poppy's small hand slides into yours" and the pinky promise: one hand with ~10 fingers, two fists bumping
// side by side, two index fingers pointing at each other. One call draws two hands that read as two: two sleeves from
// opposite sides, one set of fingers where they join, the far hand behind in the figures' far-limb tone, a child's hand
// smaller. Every frame is a pure function of t.
const HAND_K = { adult: 1, elder: 1, old: 1, teen: .93, kid: .82, child: .82, small: .74, toddler: .74 };
const FAR_GLOVE = '#2f2333';           // the rig's far-limb tone (COL.far)
const handPose = p => typeof p === 'string' ? (RIG.HAND_POSES[p] || RIG.HAND_POSES.flat) : p;
/** a hand pose part way between two (names or pose objects): fingers and thumb blend, the layer flags switch half way */
function poseMix(a, b, u) {
  const A = handPose(a), B = handPose(b); if (u <= 0) return A; if (u >= 1) return B;
  const L = (x, y) => x.map((v, i) => lerp(v, y?.[i] ?? v, u)), tb = P => P.tb || [-.42, .18, P.t[0]];
  return { ...(u < .5 ? A : B), f: A.f.map((f, i) => L(f, B.f[i])), t: L(A.t, B.t), ...(A.tb || B.tb ? { tb: L(tb(A), tb(B)), tk: lerp(A.tk ?? 1, B.tk ?? 1, u) } : {}) };
}
// a squeeze (timeloop s208: one 9 f squeeze of a held hand): the holder's fingers curl a little tighter
const HOLD_TIGHT = (() => { const P = handPose('shake'); return { ...P, f: P.f.map(([s, b1, b2, b3, fo]) => [s * .8, b1, b2 + 8, b3 + 8, fo + .08]) }; })();
function pairInsert(S, o) {
  const kind = o.kind;
  if (!S.placeName && o.backdrop !== false) S.place(o.backdrop || 'backdrop', o.backdrop ? { mood: o.mood } : { like: o.like || 'kitchen', mood: o.mood, bokeh: true });
  const W0 = o.size ?? .08, z = o.z ?? 2.6, lift = o.height ?? 1.2, mir = o.from === 'right' ? -1 : 1, St = Z.step;
  const lookOf = who => (who?.isActor ? { ...who.lookDef } : { ...CAST.resolve(who ?? 'main', SETTINGS) }), la = lookOf(o.who), lb = lookOf(o.shake);   // a cast id, a look or an Actor
  // a child's hand is smaller (an adult's palm W0)
  const Wa = W0 * (HAND_K[la.age] ?? 1), Wb = W0 * (HAND_K[lb.age] ?? 1);
  // at: the moment they join (the fingers close / the knuckles meet / the little fingers hook). Without it they are joined at
  // the cut (a bump lands 8 f in), with enter: true they come in from the frame edges first
  const tw = v => typeof v === 'string' ? S.at(v) : v, enter = !!o.enter, has = o.at != null || enter;
  const at = o.at != null ? tw(o.at) : S.t0 + (enter ? ({ hold: 18, pinky: 12 }[kind] ?? 10) : kind === 'bump' ? 8 : 0) * F;
  const leave = o.leave != null ? tw(o.leave) : null, pump = o.pump != null ? tw(o.pump) : null, squeeze = o.squeeze != null ? tw(o.squeeze) : null;
  const ease2 = (t, t0, t1, fn = 'inOutQuad') => ease(fn, (t - t0) / Math.max(1e-6, t1 - t0));
  // the far hand (behind) in the figures' far-limb tone: two black gloves on top of each other read as one black blob
  // (iq500 s64 gave the friend a plum glove); farTone: false keeps both black
  const farCol = look => look.handColor || look.glove ? mixHex(look.handColor || look.glove, '#ffffff', .12) : FAR_GLOVE;
  const mkHand = (look, pose, side, W, far) => RIG.Hand(look, { pose, side, size: W, sleeveLen: o.sleeveLen ?? 2.8, style: o.style, ...(far && o.farTone !== false ? { color: farCol(look) } : {}) });
  // the cards, laid out with `who` on the left (from: 'right' mirrors the layout): side, palm width, angle (0 = fingers up),
  // the wrist's rest place, depth (the far hand behind), the pose at t and the slide along the arm (+ = back toward the sleeve)
  let A, B, frameH, cy = lift;
  if (kind === 'hold') {
    // side by side, both arms from above in a V (up: true = both from below: joined hands raised / across a table): who's
    // hand in front, its fingers curled over the other's ('shake'), the other's behind in the far tone, only its thumb over
    // who's knuckles ('shakeWrap') - the handshake's one clasp, no pump. With `at`: the other hand slides in (10 f) and who's
    // fingers close round it (4 f, landing on `at`); squeeze: word | time = one 9 f squeeze (timeloop s208)
    const up = !!o.up, vy = up ? -1 : 1, tc = at - 4 * F, ts = tc - 10 * F;
    const close = t => !has ? 1 : ease2(t, tc, at, 'inOutQuad');
    const sq = t => squeeze == null ? 0 : Math.sin(PI * clamp((t - squeeze) / (9 * F)));
    A = { look: la, side: 'R', W: Wa, ang: rad(up ? -60 : -120), x: -Wa * .85, y: lift + vy * Wa * .5, dz: 0,
      pose: t => { const c = close(t); return c < 1 ? poseMix('holdOpen', 'shake', c) : poseMix('shake', HOLD_TIGHT, sq(t)); },
      slide: t => enter ? (1 - ease2(t, ts - 6 * F, ts, 'outCubic')) * 9 : 0 };
    B = { look: lb, side: 'L', W: Wb, ang: rad(up ? 60 : 120), x: Wb * .85, y: lift + vy * Wb * .5, dz: 0,
      pose: () => 'shakeWrap', slide: t => !has ? 0 : (1 - ease2(t, ts, tc, 'outCubic')) * 9 };
    frameH = o.frameH ?? W0 * 3.6; cy = lift + vy * W0 * .2;
  } else if (kind === 'bump') {
    // two fists, thumbs on top, knuckles meeting at `at` (accelerating in over 6 f, from off the frame with enter: 9 f),
    // a 3 f recoil and a little pop on contact
    const fa = mkHand(la, 'fist', 'R', Wa), reach = h => Math.max(...[0, 1, 2, 3].map(i => h.grip('tip' + i).y)) + h.W * .1;
    const ra = reach(fa), Tin = (enter ? 9 : 6) * F;
    const off = t => { if (t < at) return (1 - ease2(t, at - Tin, at, 'inQuad')) * (enter ? 5 : 1.1); const u = (t - at) / F;
      return u < 3 ? .18 * E.outQuad(u / 3) : u < 9 ? lerp(.18, .03, E.inOutQuad((u - 3) / 6)) : .03; };
    A = { look: la, side: 'R', W: Wa, ang: -HALF, x: -ra, y: lift, dz: 0, pose: () => 'fist', slide: off, card: fa };
    B = { look: lb, side: 'L', W: Wb, ang: HALF, x: ra * Wb / Wa, y: lift, dz: -4 * St, pose: () => 'fist', slide: off };
    frameH = o.frameH ?? W0 * 3.2;
    if (o.pop !== false && S.fx) S.fx('impact', { at, from: [0, lift, z + .04], flash: false, scale: o.popSize ?? .75, rays: 8, sound: false });
    if (o.sound !== false) S.sfx?.('pop', at, { gain: -6 });
  } else {
    // pinky promise, seen from the side like the handshake: two fists from the left and right, thumbs on top, the little
    // fingers out of the bottom of the fists toward each other: they come together over 6 f and hook on `at` (who's curls
    // down over the other's, the other's up under it; default: hooked at the cut); pump: word | time = shaken twice (8 f)
    const th = at - 6 * F, hook = t => !has ? 1 : ease2(t, th, at, 'inOutQuad');
    // the little fingers' roots (the bottom of each knuckle row, 0.74 W ahead of the wrist, 0.35 W below it; the finger 1.6x
    // long, its straight part ~0.58 W, the hook's inside ~0.66 W out, ~0.2 W down): who's hook comes down over the other's
    // straight part 0.52 W out (clear of its fist), the other's comes up over who's, between the two fists
    const pa = [-(Wa * .66 + Wb * .52) / 2, lift - Wa * .1], pb = [pa[0] + Wa * .66 + Wb * .52, pa[1] - (Wa + Wb) * .1];
    A = { look: la, side: 'R', W: Wa, ang: -HALF, x: pa[0] - Wa * .74, y: pa[1] + Wa * .35, dz: 0, pose: t => poseMix('pinky', 'pinkyHook', hook(t)),
      slide: t => enter ? (1 - ease2(t, th - 6 * F, th, 'outCubic')) * 9 : has ? (1 - hook(t)) * .6 : 0 };
    // the other hand behind: who's hook passes in front of its straight part, its hook goes behind who's and the tip shows above
    B = { look: lb, side: 'L', W: Wb, ang: HALF, x: pb[0] + Wb * .74, y: pb[1] + Wb * .35, dz: -12 * St, pose: t => poseMix('pinky', 'pinkyHookUp', hook(t)),
      slide: t => enter ? (1 - ease2(t, th - 6 * F, th, 'outCubic')) * 9 : has ? (1 - hook(t)) * .6 : 0 };
    frameH = o.frameH ?? W0 * 2.8; cy = lift - W0 * .08;
  }
  // layout: { a: { ang (deg), x, y (palm widths from the join) }, b: { ... } } overrides the place of either hand
  for (const [c, L] of [[A, o.layout?.a], [B, o.layout?.b]]) if (L) { if (L.ang != null) c.ang = rad(L.ang); if (L.x != null) c.x = L.x * c.W; if (L.y != null) c.y = lift + L.y * c.W;
    if (L.pose) c.pose = () => L.pose; if (L.dz != null) c.dz = L.dz * St; }
  const cards = [A, B].map((c, i) => {
    const h = c.card || mkHand(c.look, 'flat', c.side, c.W, i === 1);
    if (mir < 0) h.inner.scale.x *= -1;                                            // from: 'right' = the mirror image
    const ang = c.ang * mir, x = c.x * mir, axis = [-Math.sin(ang), Math.cos(ang)];   // the fingers' direction
    h.setAngle(ang); h.root.position.set(x, c.y, z + c.dz); h.root.userData.kind = 'hand'; S.add(h.root);
    h.setRim?.(o.rim !== undefined ? o.rim : (S.rim ?? '#f0d8b0'), S.rimDir || [-.6, .8]);
    return { ...c, h, x, ang, axis, last: null };
  });
  S.tick(t => {
    let kl = 0; if (leave != null) kl = E.inQuad(segK(t, leave, leave + 10 * F));
    const u = pump != null ? t - pump : -1, dy = u > 0 && u < 2 * 8 * F ? -W0 * .16 * Math.sin(2 * PI * u / (8 * F)) : 0;
    for (const c of cards) {
      const P = c.pose(t); if (P !== c.last) { c.h.setPose(P); c.last = P; }
      const back = (c.slide ? c.slide(t) : 0) * c.W + kl * frameH * 1.4;           // slid back along its own arm
      c.h.root.position.set(c.x - c.axis[0] * back, c.y - c.axis[1] * back + dy, c.h.root.position.z);
    }
  });
  if (o.camera !== false) S.camera('static', { on: [0, cy, z], frame: { h: frameH }, x: o.x ?? 0, y: o.y ?? .02 });
  return { near: cards[0].h, far: cards[1].h, hands: cards.map(c => c.h), frameH, rest: [0, cy, z] };
}

export const S_HELPERS = {
  /** ONE-CALL HAND INSERT (hand close-ups are ~1/3 of the references' shots: iq500 s3 / s7 / s64 / s219, sister s20 / s235):
   *   S.hand('phone', { screen: { ui: 'chat', ... } })                  a phone held up, the street / room blurred behind
   *   S.hand('phone', { surface: 'wood', from: 'right', screen })       top-down: the phone lies on the table, the index finger on it
   *   S.hand('tweezers', { top: true, from: 'top-left', enter: true })  top-down, the hand slides in from that edge
   * options: pose (HAND_POSES name; default by prop: phone 'hold-phone' / 'point' top-down, mug 'hold-cup', pen 'pen', tweezers 'pinch'...),
   *   side 'R' | 'L', who ('main' | cast id: the sleeve), from (where the arm comes from: bottom | bottom-right | bottom-left | left | right |
   *   top | top-right | top-left), enter (true | an edge: slides in 4 f ease-out at `at`; default true top-down, false for held props -
   *   the references' held phones are there at the cut), leave (time: out in 10 f ease-in), top: true | surface: 'wood'|'desk'|'tiles'|
   *   'cloth'|'sheet'|'marble' (a top-down tabletop insert), screen (phone / tablet UI), prop: { make options }, size (palm width m, .08),
   *   sleeve, sleeveLen, watch, fill (prop height / picture height: .58 held, .4 top-down), x, y (the prop's place in the picture,
   *   -.5..5), pos: [dx, dy] (m: a second hand / no prop, offset from the centre), height (upright: 1.2 m), upright: false, tilt, z, backdrop
   *   (upright inserts: a place name; default the shot's place, else a blurred kitchen), like, mood, rim, camera: false (frame it yourself)
   *   close: word | time (the hand closes to a fist 1 frame before it), open: word | time (opens), poses: [[word | time, pose], ...]
   *   S.hand(null, { pose: 'flat', close: 'fist' }) = the "close your fist" insert (no prop: the hand fills ~57 % of the picture)
   * -> { hand (RIG.Hand: hand.setPose('point'), hand.root), prop, frameH, rest: [x, y, z] }. Upright holds drift ~1.5 % a second.
   */
  hand(S, what = 'phone', o = {}) {
    if (o.shake != null && !what) return shakeInsert(S, o);           // the handshake close-up (both hands)
    const top = !!(o.top || o.surface), name = typeof what === 'string' ? what : (what?.userData?.kind || 'prop');
    const pose = o.pose ?? (top && (name === 'phone' || name === 'tablet') ? 'point' : HAND_POSE_FOR[name] ?? 'grip'), held = !!what && HELD_POSES.has(pose);
    if (top) { if (S.placeName !== 'tabletop') S.place('tabletop', { surface: o.surface || 'wood', mood: o.mood, light: o.light }); }
    else if (!S.placeName && o.backdrop !== false) S.place(o.backdrop || 'backdrop', o.backdrop ? { mood: o.mood } : { like: o.like || 'kitchen', mood: o.mood, bokeh: true });
    // cast: true | 'L' | 'R' (+ sling) draws the plaster cast on this arm (or the look's own look.cast on its side)
    const look = { ...CAST.resolve(o.who ?? 'main', SETTINGS), ...(o.cast != null ? { cast: o.cast === true ? (o.side || 'R') : o.cast } : {}), ...(o.sling != null ? { sling: o.sling } : {}) };
    const hand = RIG.Hand(look, { pose, side: o.side || 'R', size: o.size ?? .08, sleeve: o.sleeve, sleeveLen: o.sleeveLen ?? 2.6, watch: o.watch, style: o.style });
    const prop = what?.isObject3D ? what : what ? PROPS.make(name, { detail: 'high', ...(o.screen ? { screen: o.screen } : {}), ...(top && TOP_VIEW.has(name) ? { view: 'top' } : {}), ...(o.prop || {}) }) : null;
    const from = typeof o.enter === 'string' ? o.enter : o.from || (top ? 'right' : 'bottom'), E0 = EDGE[from] || EDGE.bottom;
    const z = o.z ?? (top ? .03 : 2.6);
    hand.setAngle(o.angle ?? E0[2]); hand.root.position.set(0, 0, z);
    const box = new THREE.Box3(), cen = new THREE.Vector3();
    if (prop && held) {
      hand.hold(prop);
      // the prop's grip point on the hand's hold slot (a phone sits over the palm, its lower half in the fingers)
      const g = prop.userData.grips?.[o.grip || 'hand'], sz = prop.userData.size;
      if (g) { prop.position.x -= g[0]; prop.position.y -= g[1] + (name === 'phone' && pose === 'hold-phone' ? (sz?.h ?? .144) * .12 : 0); }
      // the held thing stays near upright whatever angle the arm comes in at, leaning a little away from the arm
      // (iq500 f3845: the forearm from the bottom-left, the phone tilted ~7 deg the other way)
      if (o.upright !== false && !top) prop.rotation.z = -hand.root.rotation.z + (o.tilt ?? -.12 * Math.sign(E0[0] || 0));
    } else if (prop) { prop.position.set(0, 0, top ? .012 : z - .02); S.add(prop); }
    S.add(hand.root);
    hand.root.userData.kind ??= 'hand';           // S.freeze keeps hand inserts in full colour (the hero's hand)
    hand.root.updateMatrixWorld(true); if (prop) { prop.updateMatrixWorld(true); box.setFromObject(prop); }
    // no prop (a fist that closes, an open palm): the hand itself ~57 % of the picture (review 01-pause: builders' own
    // fist inserts showed the hand at ~25 %, the references' hand inserts ~55-60 %)
    const handLen = (o.size ?? .08) * 2.3;
    const ph = prop && !box.isEmpty() ? box.max.y - box.min.y : .12, frameH = o.frameH ?? (prop ? ph / (o.fill ?? (top ? .4 : .58)) : handLen / (o.fill ?? .57));
    if (prop && !held) {
      // a lying prop: centred; the hand's index tip comes to rest on it, a little toward the arm's side and below the middle
      box.getCenter(cen); prop.position.x -= cen.x; prop.position.y -= cen.y;
      const tip = hand.grip?.('tip1') || new THREE.Vector3(0, .1, 0), a = hand.root.rotation.z, c = Math.cos(a), s = Math.sin(a);
      // point / press: the index tip on the screen's lower middle (iq500 s3 tap); any other pose rests beside it, the
      // fingertips touching its edge on the arm's side (iq500 f80: the flat left hand by the phone)
      const pw = box.max.x - box.min.x, tap = pose === 'point' || pose === 'press';
      const want = tap ? [E0[0] * ph * .12, -ph * .12] : [E0[0] * (pw / 2 + .018), E0[1] * (ph / 2 + .018)];
      hand.root.position.set(want[0] - (tip.x * c - tip.y * s), want[1] - (tip.x * s + tip.y * c), z);
      cen.set(0, 0, top ? 0 : z);
    } else if (prop) { box.getCenter(cen); hand.root.position.x -= cen.x; hand.root.position.y -= cen.y; cen.set(0, 0, top ? 0 : z); }
    else cen.set(-E0[0] * handLen * .42, -E0[1] * handLen * .42, top ? 0 : z);   // frame the hand, not the wrist
    // upright inserts float at chest height (a hand held near y = 0 would sit on the floor plane, seen edge-on as a band)
    const lift = top ? 0 : (o.height ?? 1.2); hand.root.position.y += lift; cen.y += lift;
    if (o.pos) { hand.root.position.x += o.pos[0]; hand.root.position.y += o.pos[1]; }   // an extra hand: offset from the centre (m)
    const rest = hand.root.position.clone(), at = o.at != null ? (typeof o.at === 'string' ? S.at(o.at) : o.at) : S.t0;
    const enter = o.enter ?? top, leave = o.leave != null ? (typeof o.leave === 'string' ? S.at(o.leave) : o.leave) : null, far = frameH * 1.25;
    // pose changes on words: close: 'fist' word (-> 'fist' 1 frame before it), open: word (-> 'open'), poses: [[time | word, pose], ...]
    const tw = v => typeof v === 'string' ? S.at(v) : v;
    const poseKeys = [...(o.poses || []).map(([tt, p]) => [tw(tt), p]), ...(o.close != null ? [[tw(o.close) - F, 'fist']] : []), ...(o.open != null ? [[tw(o.open) - F, 'open']] : [])].sort((a, b) => a[0] - b[0]);
    S.tick(t => {
      if (poseKeys.length) { let want = pose; for (const [tt, p] of poseKeys) if (t >= tt) want = p; if (hand.poseName !== want) hand.setPose(want); }
      let k = 0;
      if (enter) k = 1 - E.outCubic(segK(t, at, at + 4 * F));
      if (leave != null) k = Math.max(k, E.inQuad(segK(t, leave, leave + 10 * F)));
      const drift = !top && held ? frameH * .015 * Math.sin((t - S.t0) * .9) : 0;
      hand.root.position.set(rest.x + E0[0] * far * k, rest.y + E0[1] * far * k + drift, rest.z);
    });
    hand.setRim?.(o.rim !== undefined ? o.rim : (S.rim ?? '#f0d8b0'), S.rimDir || [-.6, .8]);
    if (o.camera !== false) S.camera('static', { on: [cen.x, cen.y, cen.z], frame: { h: frameH }, x: o.x ?? .03, y: o.y ?? .03 });
    return { hand, prop, frameH, rest: [rest.x, rest.y, rest.z] };
  },
  /** a handshake close-up: S.handshake('main', 'hal', { pump: 'shake', backdrop: 'street' }) = S.hand(null, { who, shake, ... }) */
  handshake(S, who = 'main', other = 'hal', o = {}) { return shakeInsert(S, { ...o, who, shake: other }); },
  /** two hands joined in one call, like S.handshake (video 01: two stacked gloves read as one hand with ~10 fingers):
   *   S.handhold('main', POPPY, { at: 'hand' })   holding hands: who's hand over the other's, fingers closing round it on `at`
   *                                                (the other's hand slides in first), { hang: true } both arms from above
   *                                                (side by side), squeeze: word | time (one 9 f squeeze)
   *   S.fistBump('main', 'hal', { at: 'bump' })   two fists meet knuckle to knuckle on `at`, 3 f recoil + a little pop
   *   S.pinkyPromise(MUM, POPPY, { at: 'promise', pump: 'swear' })   the little fingers hook on `at` (+ shaken twice)
   *  = S.handshake(a, b, { kind: 'hold' | 'bump' | 'pinky', ... }). Options as S.handshake: at, enter, leave, from: 'right',
   *  backdrop, like, mood, size (an adult's palm width; a child's hand is smaller), frameH, x, y, camera: false, rim.
   *  -> { near, far, hands, frameH, rest } */
  handhold(S, who = 'main', other = 'pip', o = {}) { return pairInsert(S, { ...o, who, shake: other, kind: 'hold' }); },
  fistBump(S, who = 'main', other = 'hal', o = {}) { return pairInsert(S, { ...o, who, shake: other, kind: 'bump' }); },
  pinkyPromise(S, who = 'main', other = 'pip', o = {}) { return pairInsert(S, { ...o, who, shake: other, kind: 'pinky' }); },
  /** a crowd of faceless extras: S.crowd({ n: 10, x: [-3, 3], z: [-1.5, -.6], mood: 'still'|'sway'|'cheer'|'laugh'|'clap'|'walk'|'run',
   *  facing: 'front'|'3q-right'|'3q-left'|'right'|'left'|'mixed'|actor, at (start of the reaction), to (walk / run target), looks: [..], seed, scale })
   *  -> Actor[] (nearer ones drawn in front). Foreground bobs 9-12 f with random offsets, group laughs start within 0-1 frame. */
  crowd(S, o = {}) {
    const n = o.n ?? 10, r = rnd(o.seed ?? 77), xr = o.x ?? [-3, 3], zr = o.z ?? [-1.6, -.5], mood = o.mood || 'still';
    const out = [], at = o.at != null ? (typeof o.at === 'string' ? S.at(o.at) : o.at) : S.t0;
    const pts = [];
    for (let i = 0; i < n; i++) { const fx = (i + .5) / n + (r() - .5) * .7 / n; pts.push({ x: lerp(xr[0], xr[1], fx), z: lerp(zr[0], zr[1], r()) }); }
    pts.sort((a, b) => a.z - b.z);
    pts.forEach((p, i) => {
      const look = o.looks ? o.looks[i % o.looks.length] : (o.look || 'extra');
      let facing = o.facing ?? 'front';
      if (facing === 'mixed') facing = ['front', '3q-right', '3q-left'][Math.floor(r() * 3)];
      if (facing?.isActor) facing = facing.root.position.x < p.x ? '3q-left' : '3q-right';
      const a = S.char(look, { at: [p.x, p.z], facing, extra: o.faceless !== false, idle: mood === 'sway' ? 'sway' : 'still', scale: (o.scale ?? 1) * (1 + (r() - .5) * (o.vary ?? .08)), seed: (o.seed ?? 77) * 31 + i, name: `extra ${i + 1}` });
      const off = mood === 'laugh' ? Math.floor(r() * 2) * F : (5 + r() * 6) * F;
      if (mood === 'cheer') { a.pose(r() < .5 ? 'cheer' : 'fist', at + off, { in: 6 }); const per = (9 + r() * 3) * F, amp = (.04 + r() * .05) * a.d.headD, ph = r() * PI * 2; a._clip('body', { t0: at + off, t1: null, fin: fr(4), fout: 0, fn: t => ({ hipY: -amp * (1 + Math.sin(2 * PI * (t - at) / per + ph)) / 2, lean: rad(2) * Math.sin(2 * PI * (t - at) / per * .5 + ph) }) }); }
      else if (mood === 'laugh') { a.laugh(at + off, { hold: o.hold ?? 2 }); if (a.extra && o.ha !== false) (out._ha ??= []).push([a, at + off]); }
      else if (mood === 'clap') a.gesture('clap', at + off, { hold: o.hold ?? 2 });
      else if (mood === 'bob') { const per = (11 + r() * 3) * F, amp = (.03 + r() * .03) * a.d.headD, ph = r() * PI * 2; a._clip('body', { t0: at, t1: null, fin: 0, fout: 0, fn: t => ({ hipY: -amp * (1 + Math.sin(2 * PI * (t - at) / per + ph)) / 2 }) }); }
      else if ((mood === 'walk' || mood === 'run') && o.to) { const tg = spotOf(S, o.to) || { x: p.x + 4, z: p.z }; a.walk({ x: tg.x + (r() - .5) * (o.spread ?? 1.2), z: (tg.z ?? p.z) + (r() - .5) * .4 }, at + r() * .5, { style: mood === 'run' ? 'run' : 'normal', tempo: .92 + r() * .16 }); }
      out.push(a);
    });
    // faceless extras carry no face, so their HA! stickers come from the fx library (one per laugher, same timing)
    if (out._ha && S.fx) for (const [a, t] of out._ha) S.fx('ha', { on: a, at: t + F, until: t + (o.hold ?? 2) + 6 * F, seed: a.seed });
    delete out._ha;
    return out;
  },
};
void GRIPS; void CAST;

/* =====================================================================================================================
ACTOR API (for the skill's engine_api.md). Times: seconds (absolute), a narration word ('coffee' = S.at('coffee')), or
omitted = right after this actor's previous body action (so calls chain). Every method returns the actor.

  const a = S.char('main', { at: 'door' | [x, z], facing: '3q-right', sit: 'chair1', posture: 'typing', lie: 'bed',
                             pose: 'armsCrossed', face: 'happy', idle: 'still'|'sway'|'breathe', scale, rim, extra: true,
                             free: true (moves while S.freeze holds the world), headScale (default 1.3 in close-ups), kneel: true|'low'|'one' (starts kneeling) })
  a.walk('table', { at, until | speed, style: 'normal'|'medium'|'brisk'|'slow'|'tired'|'sad'|'sneak'|'kid'|'elderly'|'jog'|'run', face })
  a.run(spot, o)  a.step(dx | spot)  a.turn('left'|'right'|'front'|'3q-left'|'3q-right'|'back'|actor, at)
  a.enter('door' | 'left' | 'right', { to, at })  a.exit('door' | 'left' | 'right', { at })  a.jump(at, { to, height })
  a.fall(at, { dir: 'back'|'forward' })  a.kneel(at, { one, low (sitting back on the heels), slow })  a.crouch(at)  a.floor(at)  a.bend(at)
  a.sit('chair', { at, posture: 'upright'|'slumped'|'leanTable'|'headInHands'|'typing'|'eating'|'phoneLap' })  a.stand(at)
  a.lieDown('bed', at)  a.getUp(at, { sit: stop on the edge, inBed: sit up in the bed })
  a.hold('mug', { hand, grip, at, until })  a.sip(at)  a.drop(at)  a.put(obj, 'table', at)  a.pick(obj, at)  a.give(obj, b, at)
  a.phone(at, until, { ear })  a.read(at, until)  a.type(at, until)  a.write(at, until, { board })  a.eat(at, until)
  a.reach(target, at)  a.press(target, at)  a.point(target, at)
  a.gesture(name, at, { until, hold, side })  a.pose(name, at, { until })  a.wave / shrug / cheer / celebrate / clap /
  facepalm / thinking / crossArms / handsOnHips / handsOnHead / fistPump / cower / fidget / laugh ({ back: thrown back, ha: false = no HA! sticker }) / explain (at, o); a.gesture('handUp') = hand raised palm out while talking
  a.face('shock', at, { blend })  a.blink(at)  a.blinks(false)  a.talk(t0, t1)  a.say('line', { from })  a.sob(f1, f2, t0, t1)
  a.look(target | 'camera' | 'down' | 'up', at, { until })  a.nod(at, { n })  a.headShake(at)  a.tilt(deg, at)  a.nudge(at)
  a.doubleTake(target, at)
  a.hug(b, at, { until, mutual, face })  a.shake(b, at, { pumps })  a.highFive(b, at)  a.holdHands(b, at, { until })
  a.handOnShoulder(b, at, { until })  a.push(b, at)  a.catch(b, at, { until })  a.carry(b, at, { until })  a.faceEachOther(b, at)
  a.wait(sec)  a.then(at)  a.hide(at)  a.show(at)  a.idleAs('sway', at)  a.at(t) -> { x, z }
  S.crowd({ n, x: [x0, x1], z: [z0, z1], mood: 'still'|'sway'|'bob'|'cheer'|'laugh'|'clap'|'walk'|'run', facing, at, to })
    (mood 'laugh': faceless extras get their HA! stickers from fx 'ha')
  S.hand('phone' | prop name | Object3D | null, { pose, from, enter, leave, surface | top, screen, who, side, pos, fill, x, y, camera })
    -> { hand, prop, frameH, rest }: a whole hand insert in one call (glove hand + prop + blurred backdrop or tabletop + framing)
  S.handshake(a, b, { pump, kind })  S.handhold(a, b, { at, squeeze, up })  S.fistBump(a, b, { at })  S.pinkyPromise(a, b, { at, pump })
    -> { near, far, hands, frameH, rest }: two hands joined in one call (never two S.hand cards on one spot)

Example shot (6 lines):
  shot({ say: 'you finally sit down with your coffee', build(S) {
    S.place('kitchen');
    const you = S.char('main', { at: 'entry', facing: 'right' });
    you.walk('chair1', { at: 'finally' }).sit('chair1').hold('mug').sip(S.at('coffee')).face('content', S.at('coffee'));
    S.camera('auto', { on: you, frame: 'ms' });
    return { you };
  } });
===================================================================================================================== */

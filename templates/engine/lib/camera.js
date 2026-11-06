// Camera move library (pixel engine v10+, lib/camera.js in a project): named moves that FRAME A SUBJECT by shot size +
// angle + side, so a scene never computes camera coordinates by hand. Ported from the 3D reconstruction camera (recon
// lib/camera.js), simplified for the pixel engine (16:9 only, no depth of field, no occlusion search).
//
//   import { camera, CAMERA_MOVES } from '../lib/camera.js';
//   build(S) {
//     const cam = camera(S);                                                   // one per shot
//     cam.move('dollyIn', { subject: hero, from: 'FS', to: 'MS', dur: 4 })    // absolute times: t0 defaults to the shot start
//        .move('arc', { deg: 20 });                                           // chained: starts where the last move ended
//     return { cam, hero };
//   },
//   update(st, t, S) { /* animate people / cars first */ st.cam.update(t); }   // LAST in update: tracking reads the subject now
//
//   cam.frame(subject, { size: 'MS', angle: 'eye', side: 20, lens: 35 }) -> { p, l, fov, roll } (a key: where the camera is)
//   cam.set(key) / cam.hold('MS', { subject })   a locked frame       cam.keyAt(t)  the key at time t (pure)
//   cam.notes()  what the rig changed (moves lengthened to stay under the turn limit, etc.)
//
// subject: an Object3D (a person2() rig, a prop, a car, a set), [x, y, z], a Vector3, a Box3, or an array of them (a
// two-shot). Its FRONT is its local +Z (people face +Z); obj.userData.front = [x, z] (local) or { facing: [x, z] } (world)
// overrides it (models.car() faces +X: give it userData.front = [1, 0]).
// Sizes for people (how much of the body the frame holds): EWS (tiny in a big place) WS (whole body, lots of room) FS
// (full body) MFS (knees up) MS (waist up) MCU (chest up) CU (head + shoulders) ECU (face; { part: 'handR' } a joint).
// Objects: by how much of the frame height their box fills. Angles: eye low high overhead top profile dutch (+ worm).
// side: degrees round the subject from its front (+ = toward its left hand, i.e. the camera swings to the subject's left).
//
// Every move starts and ends at rest (smootherstep), never shakes, and is lengthened when it would turn the picture faster
// than CAMERA_LIMITS.maxDeg deg/s (whipTo: CAMERA_LIMITS.whipDeg). While a rig drives the camera S.push = 0 (the engine's
// own push-in would fight it) and S.fov follows the move. Everything is a pure function of t (scrub / export anywhere).
import { THREE, clamp, lerp, seg } from '../engine.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const CAMERA_LIMITS = { maxDeg: 24, whipDeg: 75, minDur: .8 };
export const smootherstep = k => (k = clamp(k), k * k * k * (k * (k * 6 - 15) + 10));
const sstep = k => (k = clamp(k), k * k * (3 - 2 * k));
const PEAK = 1.875;                         // smootherstep's peak speed / mean speed
const ASPECT = 16 / 9, AF = 1.6;            // frame width / height; usable width when fitting a wide subject
const wrap = a => ((a % 360) + 540) % 360 - 180;
const HEADROOM = .06;                       // FS..CU people: the top of the head stays this far (frame heights) inside the top edge

// ---------- shot sizes, angles, lenses ----------
// person: H = frame height in body heights, k = look centre below the top of the head (body heights)
// object: fill = the box's projected size / frame height; fov = the default lens for the size (vertical fov, 16:9)
export const SIZES = {
  EWS: { H: 12.5, k: -.5, fill: .2, fov: 40, angle: 'high' },
  WS: { H: 2.2, k: .55, fill: .35, fov: 36 },
  FS: { H: 1.25, k: .5, fill: .55, fov: 32 },
  MFS: { H: .86, k: .36, fill: .68, fov: 30 },
  MS: { H: .64, k: .25, fill: .8, fov: 30 },
  MCU: { H: .46, k: .175, fill: .92, fov: 28 },
  CU: { H: .30, k: .115, fill: 1.1, fov: 26 },
  ECU: { H: .14, k: .08, fill: 2.2, fov: 22 },
};
const SIZE_AKA = { full: 'FS', MWS: 'FS', LS: 'WS', wide: 'WS', XWS: 'EWS', ELS: 'EWS', establishing: 'EWS', cowboy: 'MFS',
  medium: 'MS', mid: 'MS', closeup: 'CU', close: 'CU', XCU: 'ECU', BCU: 'ECU', detail: 'ECU' };
const ORDER = ['EWS', 'WS', 'FS', 'MFS', 'MS', 'MCU', 'CU', 'ECU'];
export const sizeOf = s => { const k = SIZE_AKA[s] || (s && String(s).toUpperCase()); if (!SIZES[k]) throw new Error(`camera: unknown size "${s}" (${ORDER.join(' ')})`); return k; };
const stepSize = (s, n) => ORDER[clamp(ORDER.indexOf(sizeOf(s)) + n, 0, ORDER.length - 1)];
// pitch of the camera above the look point (deg, + = looking down). eye = a person's eye line (objects: 8 deg down)
export const ANGLES = { eye: null, low: -18, worm: -38, high: 30, overhead: 60, top: 89.5, topdown: 89.5, birdseye: 89.5, profile: null, dutch: null };
export const lensFov = mm => 2 * Math.atan(12 / mm) * R2D;   // 35 mm equivalent (24 mm frame height)

// ---------- subjects ----------
function boxOf(x) {
  if (!x) return null; if (typeof x === 'function') return boxOf(x());
  if (x.isBox3) return x.isEmpty() ? null : x.clone();
  if (x.isVector3 || (Array.isArray(x) && typeof x[0] === 'number')) { const v = x.isVector3 ? x.clone() : V(...x); return new THREE.Box3(v.clone().subScalar(.15), v.clone().addScalar(.15)); }
  if (x.isObject3D) { x.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(x); return b.isEmpty() ? null : b; }
  return null;
}
const isPerson = x => !!x?.isObject3D && !!(x.userData?.person || x.isRig);
const jointPos = (x, n) => { const j = x?.joints?.[n] ?? x?.joints?.[{ hand_r: 'handR', hand_l: 'handL', face: 'head', eyes: 'head' }[n]]; if (!j) return null; x.updateMatrixWorld(true); return j.getWorldPosition(V()); };
function frontOf(x, o) {
  if (o.facing) { const f = V(o.facing[0], 0, o.facing[1]); if (f.lengthSq() > 1e-8) return f.normalize(); }
  if (x?.isObject3D) { x.updateMatrixWorld(true); const uf = x.userData?.front, q = x.getWorldQuaternion(new THREE.Quaternion());
    const f = (uf ? V(uf[0], 0, uf[1]) : V(0, 0, 1)).applyQuaternion(q).setY(0); if (f.lengthSq() > 1e-6) return f.normalize(); }
  return V(0, 0, 1);
}
// subjectOf(x, o) -> { raw, box, person, h, top, feet, front, root, s, head, headTop, part(name) }: measured NOW
export function subjectOf(x, o = {}) {
  if (x?._camSubj) return x;
  if (Array.isArray(x) && x.length && typeof x[0] !== 'number') {
    const parts = x.map(y => subjectOf(y, {})), box = new THREE.Box3(); parts.forEach(p => box.union(p.box));
    const a = parts[0].box.getCenter(V()), b = parts[parts.length - 1].box.getCenter(V()), L = b.sub(a).setY(0);
    let n = L.lengthSq() > 1e-6 ? V(L.z, 0, -L.x).normalize() : V(0, 0, 1); const sum = parts.reduce((s, p) => s.add(p.front), V());
    if (sum.dot(n) < -1e-3 || (Math.abs(sum.dot(n)) <= 1e-3 && n.z < 0)) n.negate();
    if (o.facing) n = frontOf(null, o);
    const people = parts.every(p => p.person), top = Math.max(...parts.map(p => p.top ?? p.box.max.y));
    const heads = parts.map(p => p.headTop).filter(Boolean), headTop = heads.length ? heads.reduce((a, b) => b.y > a.y ? b : a) : null;
    return { _camSubj: true, raw: x, parts, box, person: people, h: people ? Math.max(...parts.map(p => p.h)) : null, top,
      feet: Math.min(...parts.map(p => p.feet ?? p.box.min.y)), front: n, root: null, group: true, part: () => null, s: 1, headTop };
  }
  const box = boxOf(x); if (!box) throw new Error('camera: the subject has no size (an Object3D, [x, y, z], a Vector3, a Box3 or an array of them)');
  const root = x?.isObject3D ? x : null, person = o.person ?? isPerson(x), s = x?.userData?.s ?? 1;
  const sb = { _camSubj: true, raw: x, box, person, root, s, front: frontOf(root, o), part: n => jointPos(x, n) };
  if (person) {
    const hd = jointPos(x, 'head'), hj = x.joints?.head; sb.h = x.userData.height ?? 1.75 * s; sb.feet = root.getWorldPosition(V()).y;
    const hb = hj ? new THREE.Box3().setFromObject(hj) : null;   // the head as posed now (hair, cap, headphones included)
    sb.top = hb && !hb.isEmpty() ? hb.max.y : sb.feet + sb.h; sb.head = hb && !hb.isEmpty() ? hb.getCenter(V()).setY(0) : null;
    sb.headTop = hd ? V(hd.x, sb.top, hd.z) : V(box.getCenter(V()).x, sb.top, box.getCenter(V()).z);
  }
  return sb;
}
const rootPos = sb => sb.root ? sb.root.getWorldPosition(V()) : sb.box.getCenter(V());

// ---------- framing: params (what the shot is) <-> key (where the camera is) ----------
function params(sb, o = {}, floorY = 0) {
  const size = sizeOf(o.size ?? 'MS'), Z = SIZES[size], angle = o.angle ?? Z.angle ?? 'eye';
  if (!(angle in ANGLES)) throw new Error(`camera: unknown angle "${angle}" (${Object.keys(ANGLES).join(' ')})`);
  const fov = o.fov ?? (o.lens ? lensFov(o.lens) : Z.fov), tf = 2 * Math.tan(fov * D2R / 2);
  const side = (o.side ?? (angle === 'profile' ? 90 : sb.group ? 0 : sb.person ? 20 : 30));
  const az = Math.atan2(sb.front.x, sb.front.z) * R2D + side, a = az * D2R;
  const sz = sb.box.getSize(V()), wx = sz.x * Math.abs(Math.cos(a)) + sz.z * Math.abs(Math.sin(a)), dd = sz.x * Math.abs(Math.sin(a)) + sz.z * Math.abs(Math.cos(a));
  const bc = sb.box.getCenter(V()), partP = o.part ? sb.part(o.part) : null;
  let c, H, pitch = o.pitch ?? ANGLES[angle];
  if (partP) { c = partP.clone(); H = (sb.person ? .24 * sb.s : .3) / (size === 'ECU' ? 1 : size === 'CU' ? .6 : .35); }
  else if (sb.person) { const h = sb.h, head = sb.head && ORDER.indexOf(size) >= ORDER.indexOf('MCU') && !sb.group ? sb.head : bc;
    H = sb.group ? Math.max(Z.H * h, wx / AF * 1.35) : Z.H * h;   // one person: the size crops the body; a group: everyone fits across
    c = V(head.x, sb.top - Z.k * h, head.z); if (sb.group) c.y = sb.top + (Z.H / 2 - Z.k) * h - H / 2; }
  else { c = bc; H = null; }
  if (o.offset) c.add(V(...o.offset));
  const proj = p => { const cp = Math.abs(Math.cos(p * D2R)), sp = Math.abs(Math.sin(p * D2R));
    if (H != null) return H * Math.max(cp, .55);
    return Math.max(sz.y * cp + dd * sp, wx / AF) / Z.fill; };
  if (pitch == null) {   // eye level: a person's eyes (the camera height), objects a slight look down
    if (sb.person && !partP) { const eyeY = o.height ?? (sb.top - .065 * sb.h); pitch = 0; for (let i = 0; i < 3; i++) pitch = Math.atan2(eyeY - c.y, proj(pitch) / tf) * R2D; }
    else pitch = 8;
  }
  if (o.height != null && o.pitch == null) { for (let i = 0; i < 3; i++) pitch = clamp(Math.atan2(o.height - c.y, proj(pitch) / tf) * R2D, -80, 89.5); }
  return { sb, c, Hp: proj(pitch), pitch, az, fov, roll: o.roll ?? (angle === 'dutch' ? 10 : 0), floorY: o.floorY ?? floorY,
    lead: o.lead ?? (sb.person && !sb.group && ORDER.indexOf(size) >= ORDER.indexOf('MS') ? .06 : 0),
    headTop: sb.person && !partP && !['ECU', 'EWS', 'WS'].includes(size) && o.headroom !== false ? sb.headTop : null,
    spec: { size, angle, side, fov, lens: o.lens, part: o.part, height: o.height, pitch: o.pitch, roll: o.roll, facing: o.facing, offset: o.offset, headroom: o.headroom } };
}
function headroom(P, p, l, fov) {   // shift the camera + look up until the top of the head is HEADROOM inside the frame
  const ht = P.headTop; if (!ht) return; const tf = Math.tan(fov * D2R / 2);
  for (let i = 0; i < 3; i++) { const f = l.clone().sub(p).normalize(), r = f.clone().cross(V(0, 1, 0)); if (r.lengthSq() < 1e-6) return; r.normalize(); const u = r.clone().cross(f);
    const v = ht.clone().sub(p), z = v.dot(f); if (z <= .05) return; const y = v.dot(u) / (z * tf), lim = 1 - 2 * HEADROOM; if (y <= lim) return;
    const dy = (y - lim) * z * tf / Math.max(.3, u.y); p.y += dy; l.y += dy; }
}
function boxExit(box, c, dir) {   // distance from c along dir to leave the box (0 when c is outside)
  if (!box.containsPoint(c)) return 0; let t = Infinity;
  for (const k of ['x', 'y', 'z']) { if (Math.abs(dir[k]) < 1e-6) continue; const lim = dir[k] > 0 ? box.max[k] : box.min[k]; t = Math.min(t, (lim - c[k]) / dir[k]); }
  return isFinite(t) ? t : 0;
}
function solve(P) {
  const a = P.az * D2R, dir = V(Math.sin(a) * Math.cos(P.pitch * D2R), Math.sin(P.pitch * D2R), Math.cos(a) * Math.cos(P.pitch * D2R));
  let fov = P.fov, d = P.Hp / (2 * Math.tan(fov * D2R / 2));
  // never inside the subject, never closer than 15 cm to its surface: back off and narrow the lens instead
  const need = P.noGuard ? 0 : boxExit(P.sb.box, P.c, dir) + .15;
  if (d < need) { d = need; fov = clamp(2 * Math.atan(P.Hp / (2 * d)) * R2D, 6, 70); }
  const right = V(Math.cos(a), 0, -Math.sin(a)), q = clamp((P.front ?? P.sb.front).dot(right) / .45, -1, 1), sgn = q * (1.5 - .5 * q * q);   // look room toward where they face
  const l = P.c.clone().addScaledVector(right, sgn * (P.lead || 0) * ASPECT * P.Hp);
  const p = l.clone().addScaledVector(dir, d);
  if (P.floorY != null && p.y < P.floorY + .06) p.y = P.floorY + .06;
  headroom(P, p, l, fov);
  return { p: p.toArray(), l: l.toArray(), fov, roll: (P.roll || 0) * D2R, spec: P.spec };
}
function mixP(A, B, u, raw = false) {
  return { ...B, c: A.c.clone().lerp(B.c, u), Hp: A.Hp * Math.pow(B.Hp / A.Hp, u), pitch: lerp(A.pitch, B.pitch, u), az: raw ? lerp(A.az, B.az, u) : A.az + wrap(B.az - A.az) * u,
    fov: lerp(A.fov, B.fov, u), lead: lerp(A.lead || 0, B.lead || 0, u), roll: lerp(A.roll || 0, B.roll || 0, u) };
}
function inverse(k, sb, spec) {   // a key -> params (the state a chained move starts from)
  const p = V(...k.p), l = V(...k.l), d = Math.max(.01, p.distanceTo(l)), dir = p.clone().sub(l).divideScalar(d);
  return { sb, c: l, Hp: 2 * d * Math.tan(k.fov * D2R / 2), pitch: Math.asin(clamp(dir.y, -1, 1)) * R2D, az: Math.atan2(dir.x, dir.z) * R2D, fov: k.fov, lead: 0, roll: (k.roll || 0) * R2D, floorY: null, noGuard: true, spec: { ...(spec || {}) } };
}
const lerpKey = (A, B, u) => ({ p: V(...A.p).lerp(V(...B.p), u).toArray(), l: V(...A.l).lerp(V(...B.l), u).toArray(), fov: lerp(A.fov, B.fov, u), roll: lerp(A.roll || 0, B.roll || 0, u) });
// degrees of picture change along a path (rotation + parallax + zoom between samples): the speed check of a move
function pathDeg(at, n = 40, turnOnly = false) {
  let tot = 0, a = at(0);
  for (let i = 1; i <= n; i++) { const b = at(i / n), pa = V(...a.p), pb = V(...b.p), la = V(...a.l), lb = V(...b.l), da = la.clone().sub(pa), db = lb.clone().sub(pb);
    tot += Math.max(da.angleTo(db) * R2D, turnOnly ? 0 : Math.atan(pa.distanceTo(pb) / Math.max(.05, da.length())) * R2D) + Math.abs(b.fov - a.fov) + Math.abs((b.roll || 0) - (a.roll || 0)) * R2D; a = b; }
  return tot;
}
export function applyKey(S, k) {
  S.cam.position.set(...k.p); S.cam.up.set(0, 1, 0); S.cam.lookAt(V(...k.l)); if (k.roll) S.cam.rotateZ(k.roll);
  S.fov = k.fov; S.push = 0; if (S.cam.fov !== k.fov) { S.cam.fov = k.fov; S.cam.updateProjectionMatrix(); }
  S.cam.updateMatrixWorld();
}
// the motion a subject was given by lib/anim.js (followPath / driveCar / walkTo): pos + heading at any time
const motionOf = sb => sb?.root?.userData?.motionAt ?? null;

// ---------- the per-shot handle ----------
export function camera(S) {
  const cache = new Map(), floorY = () => S.floorY ?? 0, notes = [];
  const C = { S, moves: [], state: null, tEnd: null, subject: null, lastKey: null };
  C.note = m => { notes.push(m); };
  C.notes = () => notes.slice();
  C.subj = (o = {}) => { const raw = o.subject ?? C.subject; if (raw == null) throw new Error('camera: no subject (pass { subject })');
    if (!cache.has(raw) || o.facing) cache.set(raw, subjectOf(raw, o)); C.subject = raw; return cache.get(raw); };
  C.params = (subject, o = {}) => params(C.subj({ ...o, subject }), o, floorY());
  C.frame = (subject, o = {}) => solve(C.params(subject, o));
  C.match = (key, subject, o = {}) => C.frame(subject, { ...(key?.spec || {}), ...o });
  // start params of a move: the previous move's end (same subject, nothing re-framed), else a fresh framing
  const REFRAME = ['from', 'size', 'angle', 'side', 'lens', 'fov', 'pitch', 'height', 'part', 'offset', 'facing'];
  C.start = (o, defSize, extra = {}) => { const sb = C.subj(o), fresh = !C.state || C.state.sb !== sb || REFRAME.some(k => o[k] != null) || o.fresh;
    return fresh ? params(sb, { ...o, ...extra, size: o.from ?? o.size ?? defSize }, floorY()) : { ...C.state, c: C.state.c.clone() }; };
  C.end = (A, o, toSize, extra = {}) => { const sp = A.spec || {}, newAngle = o.toAngle ?? extra.angle;
    return params(A.sb, { ...sp, offset: o.offset ?? sp.offset, size: toSize ?? sp.size ?? 'MS', side: o.toSide ?? sp.side, fov: o.toFov ?? A.fov, lens: undefined,
      pitch: o.toPitch ?? (newAngle ? undefined : sp.pitch), height: newAngle ? undefined : sp.height, ...extra, angle: newAngle ?? sp.angle }, floorY()); };
  C.rest = (o) => Math.max(.5, (S.t1 ?? (o.t0 ?? S.t0 ?? 0) + 4) - (o.t0 ?? C.tEnd ?? S.t0 ?? 0));   // the rest of the shot
  // reg(o, at, name, opts): one move from at(0) to at(1); returns the move. snap = no speed check (holds); linear = at(u)
  // gets the raw time fraction (tracking moves, which ease themselves); maxDeg = this move's turn limit
  C.reg = (o, at, name, { snap = false, linear = false, dur = 4, end = null, endKey = null, maxDeg = CAMERA_LIMITS.maxDeg, check = true, turnOnly = false } = {}) => {
    const t0 = o.t0 ?? C.tEnd ?? S.t0 ?? 0; let D = Math.max(.05, o.dur ?? dur);
    if (!snap && check) { const deg = pathDeg(at, 40, turnOnly), need = Math.max(deg > .5 ? CAMERA_LIMITS.minDur : 0, (linear ? 1.15 : PEAK) * deg / maxDeg);
      if (D < need - 1e-6) { C.note(`${name} at ${(+t0).toFixed(2)} lengthened ${D.toFixed(2)} -> ${need.toFixed(2)} s (keeps the picture under ${maxDeg} deg/s)`); D = need; } }
    const m = { name, t0, dur: D, at, ease: linear ? (u => u) : (o.ease ?? smootherstep) };
    C.moves.push(m); C.moves.sort((a, b) => a.t0 - b.t0); C.tEnd = t0 + D;
    C.state = end ?? (endKey ? inverse(endKey, C.subj(o), endKey.spec) : null);
    C.lastKey = m.at(1); return m; };
  C.move = (name, o = {}) => { const key = moveName(name), M = MOVES[key]; if (!M) throw new Error(`camera: unknown move "${name}" (CAMERA_MOVES lists them)`);
    if (o.t0 != null && C.tEnd != null && o.t0 < C.tEnd - 1e-3 && !o.cut) C.note(`${key} at ${(+o.t0).toFixed(2)} starts before the previous move ends (${C.tEnd.toFixed(2)}): it takes over there`);
    M.build(C, o); return C; };
  C.hold = (size, o = {}) => C.move('hold', { ...o, size: typeof size === 'string' ? size : o.size });
  C.set = (key, o = {}) => { C.reg(o, () => key, 'set', { snap: true, dur: o.dur ?? C.rest(o) }); C.state = null; C.lastKey = key; return C; };
  C.keyAt = t => { const M = C.moves; if (!M.length) return null; let m = M[0]; for (const x of M) if (t >= x.t0) m = x;
    const u = clamp((t - m.t0) / m.dur); return m.at(m.ease(u), t); };
  C.update = t => { const k = C.keyAt(t); if (k) applyKey(S, k); return k; };
  C.list = () => C.moves.map(m => ({ name: m.name, t0: +m.t0.toFixed(3), t1: +(m.t0 + m.dur).toFixed(3) }));
  return C;
}

// ---------- move builders ----------
const paramMove = (C, o, A, B, name, dur, raw = false) => C.reg(o, u => solve(mixP(A, B, u, raw)), name, { dur, end: B });
const holdKey = (C, o, P, name = 'hold') => { const K = solve(P); return C.reg(o, () => K, name, { snap: true, dur: o.dur ?? C.rest(o), end: P }); };
const prevKey = (C, o) => o.fromKey ?? C.lastKey ?? null;
function turnMove(C, o, name, B, startLook, dur) {   // camera fixed at B's position, the view turns from startLook onto B
  const KB = solve(B), p = V(...KB.p), d1 = V(...KB.l).sub(p), d0 = startLook.clone().sub(p);
  const y0 = Math.atan2(d0.x, d0.z), y1 = y0 + wrap((Math.atan2(d1.x, d1.z) - y0) * R2D) * D2R;
  const p0 = Math.atan2(d0.y, Math.hypot(d0.x, d0.z)), p1 = Math.atan2(d1.y, Math.hypot(d1.x, d1.z)), r0 = d0.length(), r1 = d1.length();
  return C.reg(o, u => { const y = lerp(y0, y1, u), pt = lerp(p0, p1, u), r = lerp(r0, r1, u);
    return { p: KB.p, l: p.clone().add(V(Math.sin(y) * Math.cos(pt), Math.sin(pt), Math.cos(y) * Math.cos(pt)).multiplyScalar(r)).toArray(), fov: KB.fov, roll: KB.roll }; }, name, { dur, end: B });
}
function sizeMove(n, name, dur, defFrom) {   // dolly in/out: same angle, the size changes by n steps (or to / amount)
  return (C, o) => { const A = C.start(o, defFrom), B = C.end(A, o, o.to ?? stepSize(A.spec.size, n), { fov: o.toFov ?? A.fov });
    if (o.amount != null) { B.Hp = A.Hp * (1 - o.amount); B.c = A.c.clone(); }
    return paramMove(C, o, A, B, name, o.dur ?? dur); };
}
function slideMove(axis, sign, name, lockLook = false) {   // truck (sideways) / pedestal (up-down): approach the framing from an offset
  return (C, o) => { const B = C.start(o, 'MS'), KB = solve(B), a = B.az * D2R, right = V(Math.cos(a), 0, -Math.sin(a)), ax = axis === 'x' ? right : V(0, 1, 0);
    const dist = o.dist ?? (lockLook ? .28 * V(...KB.p).distanceTo(V(...KB.l)) : axis === 'x' ? .3 * ASPECT * B.Hp : .25 * B.Hp), off = ax.multiplyScalar(-sign * dist);
    const A = { p: V(...KB.p).add(off).toArray(), l: lockLook ? KB.l : V(...KB.l).add(off).toArray(), fov: KB.fov, roll: KB.roll };
    if (o.floorY !== false && A.p[1] < (C.S.floorY ?? 0) + .06) A.p[1] = (C.S.floorY ?? 0) + .06;
    return C.reg(o, u => lerpKey(A, KB, u), name, { dur: o.dur ?? (lockLook ? 5 : 4), end: B }); };
}
function orbitMove(name, deg0, dur0, extra = {}) {
  return (C, o) => { const A = C.start(o, extra.size ?? 'MS', extra.angle ? { angle: o.angle ?? extra.angle } : {});
    const deg = Math.min(extra.max ?? 1e9, Math.abs(o.deg ?? deg0)) * (o.dir === 'left' ? -1 : 1) * Math.sign((o.deg ?? deg0) || 1);
    const B = { ...A, az: A.az + deg, pitch: o.toPitch ?? A.pitch + (extra.rise ?? 0), c: A.c.clone() };
    return paramMove(C, o, A, B, name, o.dur ?? dur0, true); };
}
// follow a moving subject: the camera keeps its framing relative to the subject's position and (smoothed, rate-limited)
// heading. With lib/anim.js motions (followPath / driveCar / walkTo) it is a pure function of t; otherwise it reads where
// the subject is now (animate it BEFORE cam.update(t)).
function track(C, o, name, sideDef, sizeDef, pitchDef) {
  const S = C.S, sb = C.subj(o), t0 = o.t0 ?? C.tEnd ?? S.t0 ?? 0, dur = o.dur ?? C.rest({ ...o, t0 }), mo0 = motionOf(sb);
  // (the motion is looked up when used: walkTo / driveCar register it on their first call, usually in update after build)
  const has = () => !!motionOf(sb), mo = t => motionOf(sb)(t);
  const P0 = params(sb, { ...o, size: o.size ?? sizeDef, side: o.side ?? sideDef, pitch: o.pitch ?? (o.angle ? undefined : pitchDef), lead: o.lead ?? 0 }, C.S.floorY ?? 0);
  const K0 = solve(P0), base = rootPos(sb), h0 = Math.atan2(sb.front.x, sb.front.z);
  const relP = V(...K0.p).sub(base), relL = V(...K0.l).sub(base), turn = o.turn !== false, maxRate = (o.maxDeg ?? CAMERA_LIMITS.maxDeg) * D2R, tau = o.lag ?? .45;
  const posAt = t => has() ? V(...mo(t).p) : rootPos(sb);
  const rawHead = t => { if (has()) { const a = V(...mo(t - .25).p), b = V(...mo(t + .25).p), d = b.sub(a).setY(0); if (d.lengthSq() > 1e-6) return Math.atan2(d.x, d.z); return mo(t).heading ?? h0; }
    const f = frontOf(sb.root, {}); return Math.atan2(f.x, f.z); };
  // heading: two-stage exponential smoothing + a turn-rate clamp, integrated from t0 on a fixed 1/30 s grid (pure in t)
  const headAt = t => { if (!turn) return h0; if (!has()) return h0 + wrap((rawHead(t) - h0) * R2D) * D2R;
    const dt = 1 / 30, n = Math.max(0, Math.floor((t - t0) / dt)); let r = rawHead(t0), h1 = r, h2 = r, prev = h2, k = 1 - Math.exp(-dt / tau);
    for (let i = 1; i <= n + 1; i++) { const ti = Math.min(t, t0 + i * dt), raw = r + wrap((rawHead(ti) - r) * R2D) * D2R; r = raw; h1 += (raw - h1) * k; const want = h2 + (h1 - h2) * k;
      prev = h2; h2 = h2 + clamp(want - h2, -maxRate * dt, maxRate * dt); if (ti >= t) { const f = (t - (t0 + (i - 1) * dt)) / dt; return lerp(prev, h2, clamp(f)); } }
    return h2; };
  const hd0 = headAt(t0);
  const keyAt = t => { const pos = posAt(t), dh = (turn ? headAt(t) : hd0) - h0, ax = V(0, 1, 0);
    const p = pos.clone().add(relP.clone().applyAxisAngle(ax, dh)), l = pos.clone().add(relL.clone().applyAxisAngle(ax, dh));
    if (p.y < (S.floorY ?? 0) + .06) p.y = (S.floorY ?? 0) + .06; return { p: p.toArray(), l: l.toArray(), fov: K0.fov, roll: K0.roll }; };
  const from = prevKey(C, o), bl = o.blend ?? (from ? .9 : 0);
  void mo0;   // (no motion yet at build: the turn-rate check is skipped; the heading is still smoothed + rate-limited when it has one)
  return C.reg({ ...o, t0, dur }, (u, t) => { t = t ?? t0 + u * dur; const k = keyAt(t); return bl > 0 && from ? lerpKey(from, k, smootherstep(seg(t, t0, t0 + bl))) : k; },
    name, { linear: true, dur, check: !!mo0, endKey: null });
}

const MOVES = {
  hold: { aka: ['static', 'locked', 'lockOff'], desc: 'locked-off frame on the subject (size / angle / side): let the action or the words carry the shot',
    params: 'subject, size, angle, side, lens|fov, part, height, offset, dur (default: rest of shot)',
    build: (C, o) => holdKey(C, o, C.start(o, 'MS')) },
  pushIn: { aka: ['creep', 'slowPush'], desc: 'an almost invisible push toward the subject over a long beat: keeps a still frame alive under narration',
    params: 'amount (fraction closer, default .12), size, angle, side, dur (default: rest of shot, at least 3 s)',
    build: (C, o) => { const A = C.start(o, 'MS'); return paramMove(C, o, A, { ...A, Hp: A.Hp * (1 - (o.amount ?? .12)), c: A.c.clone() }, 'pushIn', o.dur ?? Math.max(3, C.rest(o))); } },
  dollyIn: { aka: ['dolly', 'push'], desc: 'the camera travels toward the subject one shot size tighter (or `to`): importance, "this is the one"',
    params: 'from (default MS), to (default one size tighter) or amount, angle, side, dur (4)', build: sizeMove(1, 'dollyIn', 4, 'MS') },
  dollyOut: { aka: ['pullOut', 'dollyBack'], desc: 'the camera backs away one size wider (or `to`): context arrives around the subject',
    params: 'from (default MCU), to (default one size wider), angle, side, dur (4)', build: sizeMove(-1, 'dollyOut', 4, 'MCU') },
  pullBack: { aka: ['pullBackReveal', 'revealWide'], desc: 'a slow wide pull back two sizes and a little higher: the subject becomes small in its world (end of a section)',
    params: 'from (default MS), to (default two sizes wider), rise (deg of pitch gained, 8), dur (6)',
    build: (C, o) => { const A = C.start(o, 'MS'), B = C.end(A, o, o.to ?? stepSize(A.spec.size, -2)); B.pitch = clamp(A.pitch + (o.rise ?? 8), -80, 85); return paramMove(C, o, A, B, 'pullBack', o.dur ?? 6); } },
  truckLeft: { aka: ['truck', 'crabLeft'], desc: 'the camera slides left (view parallel, no turn) and lands on the framing: glide along a row, a desk, a shelf',
    params: 'dist (m, default .3 frame widths), size, angle, side, dur (4)', build: slideMove('x', -1, 'truckLeft') },
  truckRight: { aka: ['crabRight'], desc: 'the camera slides right (view parallel) and lands on the framing', params: 'as truckLeft', build: slideMove('x', 1, 'truckRight') },
  parallax: { aka: ['slide'], desc: 'slide sideways while the look stays locked on the subject: the foreground slides past, depth; makes a still set feel filmed',
    params: 'dir: right (default) | left, dist (m, default .28 x distance), size, dur (5)', build: (C, o) => slideMove('x', o.dir === 'left' ? -1 : 1, 'parallax', true)(C, o) },
  pedestal: { aka: ['pedestalUp', 'boomUp'], desc: 'the camera rises (dir up, default) or sinks (dir down) straight, the view level: up past a desk edge, settle to eye level',
    params: 'dir: up | down, dist (m, default .25 frame heights), size, dur (4)', build: (C, o) => slideMove('y', o.dir === 'down' ? -1 : 1, 'pedestal')(C, o) },
  arc: { aka: ['arcShot'], desc: 'a short arc round the subject (default 24 deg, max 45): adds depth to a held moment without leaving it',
    params: 'deg (24, max 45), dir: right (default, counter-clockwise from above) | left, size, angle, dur (4.5)', build: orbitMove('arc', 24, 4.5, { max: 45 }) },
  orbit: { aka: ['orbitCW', 'circle', 'turntable', 'hero360'], desc: 'circle the subject (default 90 deg; 360 = a turntable): study a hero object from every side',
    params: 'deg (90; 360 for a full turn), dir: right | left, size, angle, toPitch, rise (deg), dur (7; lengthened to stay under the turn limit)',
    build: (C, o) => orbitMove('orbit', 90, 7, { rise: o.rise ?? 0 })(C, o) },
  craneUp: { aka: ['jibUp', 'crane', 'riseUp'], desc: 'the camera rises and looks down, one size wider: leaving a scene, the bigger picture',
    params: 'from (default MS), to (default one size wider), toAngle (default high), dur (5)',
    build: (C, o) => { const A = C.start(o, 'MS'); return paramMove(C, o, A, C.end(A, o, o.to ?? stepSize(A.spec.size, -1), { angle: o.toAngle ?? 'high' }), 'craneUp', o.dur ?? 5); } },
  craneDown: { aka: ['jibDown', 'descend'], desc: 'the camera comes down from a high wide to the subject\'s eye level: arriving into a scene',
    params: 'from (default WS from high), to (default MS at eye), toAngle (eye), dur (5)',
    build: (C, o) => { const A = C.start({ angle: 'high', ...o }, 'WS'); return paramMove(C, o, A, C.end(A, o, o.to ?? stepSize(A.spec.size, 2), { angle: o.toAngle ?? 'eye' }), 'craneDown', o.dur ?? 5); } },
  tilt: { aka: ['tiltUp', 'tiltDown'], desc: 'the camera stays, the view tilts up from the feet / base (dir up, default) or down from above (dir down) onto the framing: size someone up, arrive in a place',
    params: 'dir: up | down, deg (else from the base when up / 25 deg above when down), size (MS), dur (4)',
    build: (C, o) => { const up = o.dir !== 'down', B = C.start(o, 'MS'), KB = solve(B), sb = B.sb, l = V(...KB.l), p = V(...KB.p), d = l.clone().sub(p), hd = Math.hypot(d.x, d.z), cur = Math.atan2(d.y, hd);
      let y = up ? (o.deg != null ? p.y + Math.tan(cur - o.deg * D2R) * hd : (sb.feet ?? sb.box.min.y) + .05) : p.y + Math.tan(Math.min(1.3, cur + (o.deg ?? 25) * D2R)) * hd;
      return turnMove(C, o, 'tilt', B, V(l.x, y, l.z), o.dur ?? 4); } },
  pan: { aka: ['panLeft', 'panRight', 'panTo'], desc: 'the camera stays, the view turns sideways and lands on the subject (from `deg` away or from another thing `from`): connect two things, follow the eye',
    params: 'deg (default 25), dir: left (default: starts right of the subject, turns left) | right, from (thing / point to start on), size, dur (4)',
    build: (C, o) => { const B = C.start({ ...o, from: typeof o.from === 'string' ? o.from : undefined }, 'MS'), KB = solve(B), p = V(...KB.p), l = V(...KB.l);
      let start = o.from != null && typeof o.from !== 'string' ? boxOf(o.from).getCenter(V()) : null;
      if (!start) { const deg = (o.deg ?? 25) * (o.dir === 'right' ? 1 : -1), d = l.clone().sub(p), c = Math.cos(deg * D2R), s = Math.sin(deg * D2R); start = p.clone().add(V(d.x * c + d.z * s, d.y, -d.x * s + d.z * c)); }
      return turnMove(C, o, 'pan', B, start, o.dur ?? 4); } },
  reveal: { aka: ['revealFrom', 'wipeReveal'], desc: 'start hidden behind a foreground thing (`fg`: a wall, a shelf, a car) and slide past it onto the subject: the reveal',
    params: 'fg (the foreground object / point, required for a true reveal), dir: auto | left | right | up, size (MS), extra (m past the fg edge, .25), dur (4.5)',
    build: (C, o) => { const B = C.start({ ...o, fg: undefined }, 'MS'), KB = solve(B), p1 = V(...KB.p), l = V(...KB.l), fw = l.clone().sub(p1), D = fw.length(); fw.normalize();
      const right = V(-fw.z, 0, fw.x).normalize(), up = right.clone().cross(fw).normalize();   // screen right / up
      let off = null;
      if (o.fg != null) { const fb = boxOf(o.fg), fc = fb.getCenter(V()), rel = fc.clone().sub(p1), depth = rel.dot(fw);
        if (depth > .05 && depth < D - .1) {
          // start: the line of sight from the camera to the (fixed) look point passes through the fg centre, i.e. hidden
          // behind it; the move slides the camera to the end framing (lateral only, vertical only for dir 'up', else both)
          const k = 1 / (1 - depth / D), lat = rel.dot(right) * k, ver = rel.dot(up) * k;
          off = o.dir === 'up' ? up.clone().multiplyScalar(ver) : o.dir === 'left' || o.dir === 'right' ? right.clone().multiplyScalar(lat) : right.clone().multiplyScalar(lat).addScaledVector(up, ver);
          if (off.length() < .15) off.addScaledVector(o.dir === 'up' ? up : right, (o.dir === 'up' ? -1 : o.dir === 'left' ? 1 : -1) * .35); }
        else C.note(`reveal at ${(+(o.t0 ?? C.tEnd ?? 0)).toFixed(2)}: the fg is not between the camera and the subject; slid sideways instead`); }
      if (!off) off = right.clone().multiplyScalar((o.dir === 'left' ? 1 : -1) * (o.dist ?? .35 * D));
      const p0 = p1.clone().add(off);
      if (o.fg != null) { const fb = boxOf(o.fg).expandByScalar(.25);   // never start inside the foreground thing: back off along the view
        for (let i = 0; i < 40 && fb.containsPoint(p0); i++) p0.addScaledVector(fw, -.1); }
      const A = { p: p0.toArray(), l: l.toArray(), fov: KB.fov, roll: KB.roll };
      if (A.p[1] < (C.S.floorY ?? 0) + .06) A.p[1] = (C.S.floorY ?? 0) + .06;
      return C.reg(o, u => lerpKey(A, KB, u), 'reveal', { dur: o.dur ?? 4.5, end: B }); } },
  follow: { aka: ['chase', 'track', 'trackSide', 'lead', 'tracking'], desc: 'track a moving subject (a walking person, a driving car): behind (side 180), beside (90) or in front (0); the heading is smoothed and turn-limited',
    params: 'side (165 = behind its left shoulder; 90 beside; 0 in front), size (FS; a car: by fill), pitch (10), turn (false = keep a fixed world direction), lag (s, .45), blend (s from the previous key, .9), dur (rest of shot)',
    build: (C, o) => track(C, o, 'follow', 165, 'FS', 10) },
  flyover: { aka: ['droneFlyover', 'flyOver', 'overflight'], desc: 'a drone pass over a set at height, looking ahead and down: the place passes beneath (a city block, a factory floor)',
    params: 'height (m, default 2.2 x the set size, >= 4), pitch (deg down, 35), side (direction it comes from, deg round the front), fov (40), dur (7)',
    build: (C, o) => { const sb = C.subj(o), c = sb.box.getCenter(V()), sz = sb.box.getSize(V()), az = (Math.atan2(sb.front.x, sb.front.z) * R2D + (o.side ?? 0)) * D2R;
      const Hg = o.height ?? Math.max(4, 1.1 * Math.max(sz.x, sz.z), 2.2 * sz.y), h = V(Math.sin(az), 0, Math.cos(az)), th = (o.pitch ?? 35) * D2R, top = sb.box.max.y;
      const p0 = c.clone().setY(top).addScaledVector(h, Hg / Math.tan(th)).add(V(0, Hg, 0)), p1 = c.clone().setY(top).addScaledVector(h, -.6 * Hg).add(V(0, Hg * 1.05, 0));
      const look = p => p.clone().addScaledVector(h, -Math.cos(th) * Hg).add(V(0, -Math.sin(th) * Hg, 0)), fov = o.fov ?? 40;
      return C.reg(o, u => { const p = p0.clone().lerp(p1, u); return { p: p.toArray(), l: look(p).toArray(), fov, roll: 0 }; }, 'flyover', { dur: o.dur ?? 7, endKey: { p: p1.toArray(), l: look(p1).toArray(), fov, spec: { size: 'EWS' } } }); } },
  topDown: { aka: ['godsEye', 'birdseye', 'topDownDescend'], desc: "straight down from above, descending with a slow turn: the god's-eye view of a desk, a board, a street",
    params: 'from (default EWS), to (default WS), spin (deg, 20), dur (7)',
    build: (C, o) => { const A = C.start({ ...o, angle: 'top' }, 'EWS'), B = C.end(A, o, o.to ?? 'WS', { angle: 'top' }); B.az = A.az + (o.spin ?? 20); return paramMove(C, o, A, B, 'topDown', o.dur ?? 7, true); } },
  heroLow: { aka: ['hero', 'lowHero', 'powerShot'], desc: 'low angle looking up, pushing in with a slight arc: power, a hero moment (a console unveiled, a person who did it)',
    params: 'from (default FS), to (default MFS), pitch (-20 -> -12), deg (arc, 12), dur (5)',
    build: (C, o) => { const A = C.start({ ...o, pitch: o.pitch ?? -20, side: o.side ?? 28 }, 'FS'), B = C.end(A, o, o.to ?? stepSize(A.spec.size, 1), { pitch: o.toPitch ?? -12 }); B.az = A.az - (o.deg ?? 12); B.headTop = null; A.headTop = null; return paramMove(C, o, A, B, 'heroLow', o.dur ?? 5, true); } },
  establish: { aka: ['aerialOrbit', 'establishing'], desc: 'a high slow orbit round the whole set: the establishing shot of a place',
    params: 'deg (35), size (people: EWS, a set / objects: WS), angle (high), dur (10)',
    build: (C, o) => orbitMove('establish', 35, 10, { size: C.subj(o).person ? 'EWS' : 'WS', angle: 'high' })(C, o) },
  dutch: { aka: ['dutchTilt', 'canted'], desc: 'the horizon rolls to a tilt and holds: unease, the moment things go wrong',
    params: 'roll (deg, 8; - the other way), size, angle, side, dur (roll-in, 3)',
    build: (C, o) => { const A = C.start(o, 'MS'), B = { ...A, roll: o.roll ?? 8, Hp: A.Hp * .95, c: A.c.clone() }; return paramMove(C, o, { ...A, roll: 0 }, B, 'dutch', o.dur ?? 3); } },
  whipTo: { aka: ['whip', 'snapTo'], desc: 'a fast but eased re-frame from where the camera is to a new subject / size (~1 s): a beat change, "and then THIS" (the only move allowed above the normal turn limit)',
    params: 'subject (the new one), size, angle, side, dur (.9; lengthened past CAMERA_LIMITS.whipDeg deg/s)',
    // a whip PAN: the camera (nearly) stays and turns + zooms fast onto the new subject; it never swoops past things
    build: (C, o) => aimMove(C, { drift: .1, ...o }, 'whipTo', .9, { maxDeg: CAMERA_LIMITS.whipDeg, turnOnly: true }) },
  rackTo: { aka: ['rack', 'switchTo', 'refocus'], desc: 'switch attention to another subject: the camera stays (or drifts a little) while the view and the lens re-frame onto it (a pan + zoom, no cut)',
    params: 'subject (the new one), size (MS), drift (0..1 of the way toward the new framing position, .2), dur (2.5)',
    build: (C, o) => aimMove(C, o, 'rackTo', 2.5) },
};
// rackTo / whipTo: from the current key, the view turns (constant angular rate) and the lens zooms (tan space) onto a new
// subject at the size asked, while the camera drifts `drift` of the way toward that subject's own framing position
function aimMove(C, o, name, dur0, reg = {}) {
  { const A = prevKey(C, o), B = C.params(o.subject ?? C.subject, { ...o, size: o.size ?? o.to ?? 'MS' }), KB = solve(B);
      if (!A) return C.reg(o, () => KB, name, { snap: true, dur: o.dur ?? dur0, end: B });
      const pA = V(...A.p), pE = pA.clone().lerp(V(...KB.p), o.drift ?? .2), lE = V(...KB.l), dE = pE.distanceTo(lE), fE = clamp(2 * Math.atan(B.Hp / (2 * dE)) * R2D, 6, 70);
      const E = { p: pE.toArray(), l: lE.toArray(), fov: fE, roll: 0 }, t0f = Math.tan(A.fov * D2R / 2), t1f = Math.tan(fE * D2R / 2);
      // the aim turns at a constant angular rate (spherical), the lens zooms at a constant rate (tan space)
      const dA = V(...A.l).sub(pA), rA = dA.length(), yA = Math.atan2(dA.x, dA.z), ptA = Math.atan2(dA.y, Math.hypot(dA.x, dA.z));
      return C.reg(o, u => { const p = pA.clone().lerp(pE, u), dE2 = lE.clone().sub(p), yE = Math.atan2(dE2.x, dE2.z), ptE = Math.atan2(dE2.y, Math.hypot(dE2.x, dE2.z));
        const y = yA + wrap((yE - yA) * R2D) * D2R * u, pt = lerp(ptA, ptE, u), r = lerp(rA, dE2.length(), u);
        return { p: p.toArray(), l: p.clone().add(V(Math.sin(y) * Math.cos(pt), Math.sin(pt), Math.cos(y) * Math.cos(pt)).multiplyScalar(r)).toArray(),
          fov: 2 * Math.atan(t0f * Math.pow(t1f / t0f, u)) * R2D, roll: (A.roll || 0) * (1 - u) }; }, name, { dur: o.dur ?? dur0, endKey: { ...E, spec: B.spec }, ...reg }); }
}
const ALIAS = {}; for (const [k, m] of Object.entries(MOVES)) { ALIAS[k.toLowerCase()] = k; for (const a of m.aka) ALIAS[a.toLowerCase()] ??= k; }
const moveName = n => ALIAS[String(n).replace(/[\s_-]/g, '').toLowerCase()];
// the registry for the skill: name -> one-line description (listMoves() adds aliases and parameters)
export const CAMERA_MOVES = Object.fromEntries(Object.entries(MOVES).map(([k, m]) => [k, m.desc]));
export const listMoves = () => Object.entries(MOVES).map(([name, m]) => ({ name, aka: m.aka, desc: m.desc, params: m.params }));

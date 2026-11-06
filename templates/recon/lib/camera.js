// Camera move library (recon engine v15+, lib/camera.js in a project): named professional moves that FRAME A SUBJECT
// by shot size + angle + side, so a scene never computes camera coordinates by hand.
//
//   import { camera } from '../lib/camera.js';
//   const C = camera(S);                                                     // per shot, inside build(S)
//   C.frame(subject, { size: 'MS', angle: 'eye', side: 20, lens: 35 })      // -> { p, l, fov, roll } key (S.camera / rig)
//   C.move('dollyIn', { subject, t0, dur: 4, from: 'MS', to: 'MCU' })      // adds a rig move; chainable (returns C)
//   C.hold('MS', { subject, t0, angle, side })                              // a locked-off framing
//   C.match(key, otherSubject)                                              // the same size/angle/side on another subject
//   CAMERA_MOVES / listMoves()                                               // the registry (the skill's camera_moves.md)
//
// subject: an Object3D, a person (figure() / cast()), [x, y, z], a Vector3, a Box3, or an array of them (a two-shot).
// Its FRONT is its local +Z in world space (people face +Z); { facing: [x, z] } overrides it.
// Sizes (people, by how much of the body the frame holds): EWS (person ~8 % of the frame) WS (~45 %) FS (full body ~80 %,
// aka MWS/full) MFS (knees up, cowboy) MS (waist up) MCU (chest up) CU (head + shoulders) ECU (face; { part: 'wrR' } a
// joint). Objects: by how much of the frame their box fills. Angles: eye low worm high overhead top (birdseye) profile
// dutch (+ ots / pov moves). side: degrees round the subject from its front (+ = toward its left hand).
// Moves chain: a move without from/angle/side/lens/fov starts from where the previous C.move ended (same subject), and its
// t0 defaults to that move's end, so C.move('dollyIn', {...}).move('arc') never jumps. Every move starts and ends at rest
// (smootherstep), is lengthened when it would turn the picture faster than CAMERA_LIMITS.maxDeg deg/s (said in the check),
// and is a pure function of the time (tracking moves read the subject's pose after update(): S.late).
import { THREE, THEME, VERT, CAMERA_LIMITS, smootherstep, clamp, lerp, seg } from '../engine.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const AF = VERT ? .78 : 1.6;               // usable frame width / height when fitting a subject (16:9, or the vertical frame)
const FRAME_W = VERT ? .816 : 1.778;       // the frame's width in units of its (16:9) height, for lead room
const sstep = k => k * k * (3 - 2 * k);
const MAX_DEG = Math.min(20, CAMERA_LIMITS.maxDeg);   // peak picture turn, deg/s (no_slop C3: pans and orbits <= 20)
const wrap = a => ((a % 360) + 540) % 360 - 180;
const HEADROOM = .06;                      // FS..CU people: the top of the head stays this far (frame heights) inside the top edge
// ground subjects (a region map, terrain, a subject with { extent }): the size = how much of the region the frame holds
const GSPAN = { EWS: 1.05, WS: .3, FS: .16, MFS: .11, MS: .075, MCU: .05, CU: .033, ECU: .016 };

// ---------- shot sizes, angles, lenses ----------
// person: H = frame height in body heights, k = look centre below the top of the head (body heights)
// object: fill = the box's projected size / frame height; fov = the default lens for the size (16:9 vertical fov)
export const SIZES = {
  EWS: { H: 12.5, k: -.5, fill: .1, fov: 40, angle: 'high' },
  WS: { H: 2.2, k: .55, fill: .35, fov: 34 },
  FS: { H: 1.25, k: .5, fill: .55, fov: 32 },
  MFS: { H: .86, k: .36, fill: .68, fov: 30 },
  MS: { H: .64, k: .25, fill: .8, fov: 30 },
  MCU: { H: .46, k: .175, fill: .92, fov: 28 },
  CU: { H: .30, k: .115, fill: 1.1, fov: 26 },
  ECU: { H: .14, k: .08, fill: 2.2, fov: 22 },
};
const SIZE_AKA = { full: 'FS', MWS: 'FS', fullshot: 'FS', LS: 'WS', wide: 'WS', XWS: 'EWS', ELS: 'EWS', XLS: 'EWS', establishing: 'EWS',
  cowboy: 'MFS', medium: 'MS', mid: 'MS', closeup: 'CU', close: 'CU', XCU: 'ECU', BCU: 'ECU', detail: 'ECU', extreme: 'ECU' };
const ORDER = ['EWS', 'WS', 'FS', 'MFS', 'MS', 'MCU', 'CU', 'ECU'];
export const sizeOf = s => { const k = SIZE_AKA[s] || (s && String(s).toUpperCase()); if (!SIZES[k]) throw new Error(`camera: unknown size "${s}" (${ORDER.join(' ')})`); return k; };
const stepSize = (s, n) => ORDER[clamp(ORDER.indexOf(sizeOf(s)) + n, 0, ORDER.length - 1)];
// pitch of the camera above the look point (deg, + = looking down). eye: a person's eye line (objects: 8 deg)
export const ANGLES = { eye: null, low: -18, worm: -40, high: 30, overhead: 60, top: 89.5, birdseye: 89.5, topdown: 89.5, profile: null, dutch: null };
export const lensFov = mm => 2 * Math.atan(12 / mm) * R2D;   // 35 mm equivalent (24 mm frame height)

// ---------- subjects (mirrors the engine's subjectBox / aimOf) ----------
function boxOf(x) {
  if (!x) return null; if (typeof x === 'function') return boxOf(x());
  if (x.isBox3) return x.isEmpty() ? null : x.clone();
  if (x.isVector3 || (Array.isArray(x) && typeof x[0] === 'number')) { const v = x.isVector3 ? x.clone() : V(...x); return new THREE.Box3(v.clone().subScalar(.15), v.clone().addScalar(.15)); }
  if (x.isObject3D) { x.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(x); return b.isEmpty() ? null : b; }
  if (typeof x.box === 'function') { try { const b = x.box(); if (b?.isBox3 && !b.isEmpty()) return b; } catch { /* next */ } }
  for (const k of ['root', 'group', 'obj', 'g', 'mesh', 'body']) if (x[k]?.isObject3D) return boxOf(x[k]);
  return null;
}
const rootOf = x => x?.isObject3D ? x : ['root', 'group', 'obj', 'g', 'mesh', 'body'].map(k => x?.[k]).find(r => r?.isObject3D) || null;
const isPerson = x => !!x && !x.isObject3D && (typeof x.scenePos === 'function' || x.rig != null || x.cast != null);
const jointOf = (x, n) => { if (typeof x?.scenePos !== 'function') return null; const al = { hand_r: 'wrR', hand_l: 'wrL', handR: 'wrR', handL: 'wrL', head: 'head', eyes: 'head', face: 'head' };
  for (const k of [n, al[n]]) { if (!k) continue; try { const p = x.scenePos(k); if (p?.isVector3 && isFinite(p.x)) return p; } catch { /* next */ } } return null; };
function frontOf(x, root, o) {
  if (o.facing) { const f = V(o.facing[0], 0, o.facing[1]); if (f.lengthSq() > 1e-8) return f.normalize(); }
  if (root) { root.updateMatrixWorld(true); const f = root.getWorldDirection(V()).setY(0); if (f.lengthSq() > 1e-6) return f.normalize(); }
  return V(0, 0, 1);
}
// subjectOf(x, o) -> { raw, box, person, h, top, feet, front, root, part(name) }: measured once (the shot's build pose)
export function subjectOf(x, o = {}) {
  if (x?._camSubj) return x;
  if (Array.isArray(x) && x.length && typeof x[0] !== 'number') {
    const parts = x.map(y => subjectOf(y, {})), box = new THREE.Box3(); parts.forEach(p => box.union(p.box));
    const a = parts[0].box.getCenter(V()), b = parts[parts.length - 1].box.getCenter(V()), L = b.sub(a).setY(0);
    let n = L.lengthSq() > 1e-6 ? V(L.z, 0, -L.x).normalize() : V(0, 0, 1); const sum = parts.reduce((s, p) => s.add(p.front), V());
    if (sum.dot(n) < -1e-3 || (Math.abs(sum.dot(n)) <= 1e-3 && n.z < 0)) n.negate();
    if (o.facing) n = frontOf(null, null, o);
    const people = parts.every(p => p.person), top = Math.max(...parts.map(p => p.top ?? p.box.max.y));
    const heads = parts.map(p => p.headTop).filter(Boolean), headTop = heads.length ? heads.reduce((a, b) => b.y > a.y ? b : a) : null;
    return { _camSubj: true, raw: x, parts, box, person: people, h: people ? Math.max(...parts.map(p => p.h)) : null, top, feet: Math.min(...parts.map(p => p.feet ?? p.box.min.y)), front: n, root: null, group: true, part: () => null, s: 1, headTop };
  }
  const box = boxOf(x); if (!box) throw new Error('camera: the subject has no size (an Object3D, a person, [x, y, z], a Vector3, a Box3 or an array of them)');
  const root = rootOf(x), person = o.person ?? isPerson(x), s = typeof x?.scale === 'number' ? x.scale : 1;
  const sb = { _camSubj: true, raw: x, box, person, root, s, front: frontOf(x, root, o), part: n => jointOf(x, n) };
  if (person) { sb.top = x.j ? box.max.y - .12 * s : box.max.y; sb.h = x.height ?? (x.j ? 1.84 * s : sb.top - box.min.y); sb.feet = x.j ? box.min.y + .12 * s : box.min.y;
    const hd = jointOf(x, 'head'); sb.head = hd ? V(hd.x, 0, hd.z) : null;
    // the top of the head (headroom): the head joint + the skull above it, never below the measured top
    sb.headOff = hd ? Math.max(sb.top - hd.y, .13 * sb.h / 1.84) : 0; sb.headTop = hd ? V(hd.x, hd.y + sb.headOff, hd.z) : V(box.getCenter(V()).x, sb.top, box.getCenter(V()).z); }
  else { const sz = box.getSize(V()), hz = Math.max(sz.x, sz.z), ud = root?.userData || {};
    sb.ground = o.ground ?? !!(o.extent || ud.extent || ud.ground || (hz >= 1000 && sz.y < .3 * hz) || (hz >= 40 && sz.y < .08 * hz));
    if (sb.ground) sb.E = o.extent ?? ud.extent ?? hz; }
  return sb;
}
// the head top of a person now (a walking figure: its head joint at this frame), else the build measure
const headNow = sb => { if (!sb.person || sb.group) return sb.headTop ?? null; const hd = jointOf(sb.raw, 'head'); return hd ? V(hd.x, hd.y + sb.headOff, hd.z) : sb.headTop; };
// what a small object stands on (desk, shelf, table): the box of the first solid under it, not the floor / a map
function supportOf(S, sb) {
  if (sb.person || sb.ground || sb.group || !S?.scene) return null;
  const c = sb.box.getCenter(V()), sz = sb.box.getSize(V()), from = V(c.x, sb.box.min.y + Math.min(.05, sz.y * .25), c.z), ex = new Set();
  sb.root?.traverse?.(m => ex.add(m)); const objs = []; S.scene.traverse(m => { if (m.isMesh && !ex.has(m) && m !== S.floor && !m.userData?.ground) objs.push(m); });
  const h = new THREE.Raycaster(from, V(0, -1, 0), 0, .25 + .5 * sz.y).intersectObjects(objs, false)[0]; if (!h) return null;
  const b = new THREE.Box3().setFromObject(h.object), bs = b.getSize(V()); return Math.max(bs.x, bs.z) > 25 ? null : b;
}
const aimPt = x => { const sb = subjectOf(x); if (!sb.person) return sb.box.getCenter(V()); const c = sb.head ?? sb.box.getCenter(V()); return V(c.x, sb.top - .2 * sb.h, c.z); };
const rootPos = sb => sb.root ? sb.root.getWorldPosition(V()) : sb.box.getCenter(V());

// ---------- framing: params (what the shot is) <-> key (where the camera is) ----------
// P = { sb, c (look centre before lead), Hp (projected frame height, m), pitch, az (deg, world), fov, lead, roll (deg), off, spec }
function params(sb, o = {}, floorY = null, env = null) {
  const size = sizeOf(o.size ?? 'MS'), Z = SIZES[size], angle = o.angle ?? Z.angle ?? 'eye';
  if (!(angle in ANGLES)) throw new Error(`camera: unknown angle "${angle}" (${Object.keys(ANGLES).join(' ')})`);
  const fov = o.fov ?? (o.lens ? lensFov(o.lens) : Z.fov), tf = 2 * Math.tan(fov * D2R / 2);
  const side = (o.side ?? (angle === 'profile' ? 90 : sb.group ? 0 : sb.person ? 20 : 30)) + (o._dSide ?? 0);
  const az = Math.atan2(sb.front.x, sb.front.z) * R2D + side, a = az * D2R;
  const sz = sb.box.getSize(V()), wx = sz.x * Math.abs(Math.cos(a)) + sz.z * Math.abs(Math.sin(a)), dd = sz.x * Math.abs(Math.sin(a)) + sz.z * Math.abs(Math.cos(a));
  const bc = sb.box.getCenter(V()), partP = o.part ? sb.part(o.part) : null;
  let c, H, pitch = o.pitch ?? ANGLES[angle];
  if (partP) { c = partP.clone(); H = (sb.person ? .2 * sb.s : .3) / (size === 'ECU' ? 1 : .5); }
  else if (sb.person) { const h = sb.h, head = sb.head && ORDER.indexOf(size) >= ORDER.indexOf('MCU') && !sb.group ? sb.head : bc;
    H = sb.group ? Math.max(Z.H * h, wx / AF * 1.35) : Z.H * h;   // one person: the size crops the body; a group: everyone fits across
    c = V(head.x, sb.top + (Z.H / 2 - Z.k) * h - H / 2, head.z); }
  else if (sb.ground) { c = o.site != null ? aimPt(o.site) : bc; H = sb.E * GSPAN[size]; }   // a region: the size is a share of it
  else { c = bc; H = null; }
  const proj = p => { const cp = Math.abs(Math.cos(p * D2R)), sp = Math.abs(Math.sin(p * D2R));
    if (sb.ground && H != null) return H;
    if (H != null) return H * Math.max(cp, .55);
    return Math.max(sz.y * cp + dd * sp, wx / AF) / Z.fill; };
  if (pitch == null) {   // eye level: a person's eyes (the camera height), objects a slight look down
    if (sb.person && !partP) { const eyeY = (o.height ?? (sb.top - .065 * sb.h)); pitch = 0; for (let i = 0; i < 3; i++) pitch = Math.atan2(eyeY - c.y, proj(pitch) / tf) * R2D; }
    else pitch = o.height != null ? 0 : 8;
  }
  if (o.height != null && !(pitch == null)) { for (let i = 0; i < 3; i++) pitch = clamp(Math.atan2(o.height - c.y, proj(pitch) / tf) * R2D, -80, 89.5); }
  if (o._dPitch) pitch = clamp(pitch + o._dPitch, -80, 89.5);
  const P = { sb, c, Hp: proj(pitch), pitch, az, fov, lead: o.lead ?? (sb.person && !sb.group && ORDER.indexOf(size) >= ORDER.indexOf('MS') ? .06 : 0),
    roll: o.roll ?? (angle === 'dutch' ? 10 : 0), off: o.offset ? V(...o.offset) : V(), floorY: o.floorY ?? floorY, dmul: o._dMul ?? 1,
    near: env?.near ?? .1, support: env?.support ?? sb.support ?? null,
    headTop: sb.person && !partP && size !== 'ECU' && size !== 'EWS' && size !== 'WS' && o.headroom !== false ? sb.headTop : null,
    spec: { size, angle, side, fov, lens: o.lens, part: o.part, lead: o.lead, height: o.height, pitch: o.pitch, roll: o.roll, facing: o.facing, site: o.site, headroom: o.headroom, _dPitch: o._dPitch, _dMul: o._dMul } };
  return P;
}
// headroom: shift the camera and its look point up until the top of the head is HEADROOM inside the frame (continuous)
function headroom(P, p, l, fov) {
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
  const a = P.az * D2R, dirOf = pt => V(Math.sin(a) * Math.cos(pt * D2R), Math.sin(pt * D2R), Math.cos(a) * Math.cos(pt * D2R));
  let dir = dirOf(P.pitch), fov = P.fov, d = P.Hp / (2 * Math.tan(fov * D2R / 2)) * (P.dmul ?? 1);
  if ((P.dmul ?? 1) !== 1) fov = clamp(2 * Math.atan(P.Hp / (2 * d)) * R2D, 6, 70);   // closer with a wider lens (occlusion search)
  // never inside the subject, never closer than the near plane (+ margin) to its surface: back off, narrow the lens instead
  const need = P.noGuard ? 0 : boxExit(P.sb.box, P.c, dir) + Math.max(.15, (P.near ?? .1) * 1.3 + .04);
  if (d < need) { d = need; fov = clamp(2 * Math.atan(P.Hp / (2 * d)) * R2D, 6, 70); }
  const right = V(Math.cos(a), 0, -Math.sin(a)), front = P.front ?? P.sb.front, q = clamp(front.dot(right) / .45, -1, 1), sgn = q * (1.5 - .5 * q * q);   // look room: eases with the turn (an orbit never jumps)
  const l = P.c.clone().addScaledVector(right, sgn * (P.lead || 0) * FRAME_W * P.Hp);
  let p = l.clone().addScaledVector(dir, d).add(P.off);
  const sup = P.support;   // a small prop on a desk: the camera never under / inside the desk top (eased by the distance off its edge)
  if (sup && !P.noGuard) { const m = Math.max(.03, (P.near ?? .1) + .02), ox = Math.max(0, sup.min.x - m - p.x, p.x - sup.max.x - m), oz = Math.max(0, sup.min.z - m - p.z, p.z - sup.max.z - m);
    const k = 1 - sstep(clamp(Math.hypot(ox, oz) / .25, 0, 1)), top = sup.max.y + m;
    if (k > 0 && p.y < top) { const pmin = Math.asin(clamp((top - l.y - P.off.y) / d, -1, 1)) * R2D; dir = dirOf(lerp(P.pitch, Math.max(P.pitch, pmin), k)); p = l.clone().addScaledVector(dir, d).add(P.off); } }
  if (P.floorY != null && p.y < P.floorY + .06) p.y = P.floorY + .06;
  headroom(P, p, l, fov);
  return { p: p.toArray(), l: l.toArray(), fov, roll: (P.roll || 0) * D2R, spec: P.spec };
}
function mixP(A, B, u, raw = false) {
  return { ...B, c: A.c.clone().lerp(B.c, u), Hp: A.Hp * Math.pow(B.Hp / A.Hp, u), pitch: lerp(A.pitch, B.pitch, u), az: raw ? lerp(A.az, B.az, u) : A.az + wrap(B.az - A.az) * u,
    fov: lerp(A.fov, B.fov, u), lead: lerp(A.lead || 0, B.lead || 0, u), roll: lerp(A.roll || 0, B.roll || 0, u), off: A.off.clone().lerp(B.off, u) };
}
function inverse(k, sb, spec) {   // a key -> params (the state a chained move starts from)
  const p = V(...k.p), l = V(...k.l), d = Math.max(.01, p.distanceTo(l)), dir = p.clone().sub(l).divideScalar(d);
  return { sb, c: l, Hp: 2 * d * Math.tan(k.fov * D2R / 2), pitch: Math.asin(clamp(dir.y, -1, 1)) * R2D, az: Math.atan2(dir.x, dir.z) * R2D, fov: k.fov, lead: 0, roll: (k.roll || 0) * R2D, off: V(), floorY: null, noGuard: true, spec: { ...(spec || {}) } };
}
const lerpKey = (A, B, u) => ({ p: V(...A.p).lerp(V(...B.p), u).toArray(), l: V(...A.l).lerp(V(...B.l), u).toArray(), fov: lerp(A.fov, B.fov, u), roll: lerp(A.roll || 0, B.roll || 0, u) });
// degrees of picture change along a path (rotation + parallax + zoom between samples): the speed check of any move
function pathDeg(at, n = 32) {
  let tot = 0, a = at(0);
  for (let i = 1; i <= n; i++) { const b = at(i / n), pa = V(...a.p), pb = V(...b.p), la = V(...a.l), lb = V(...b.l), da = la.clone().sub(pa), db = lb.clone().sub(pb);
    tot += Math.max(da.angleTo(db) * R2D, Math.atan(pa.distanceTo(pb) / Math.max(.05, da.length())) * R2D) + Math.abs(b.fov - a.fov) + Math.abs((b.roll || 0) - (a.roll || 0)) * R2D; a = b; }
  return tot;
}
const activeMove = (S, t) => { const M = S.moves; if (!M?.length) return null; let m = M[0]; for (const x of M) if (t >= x.t0) m = x; return m; };
function applyKey(S, k) {
  S.cam.position.set(...k.p); S.look.set(...k.l); S.cam.lookAt(S.look); if (k.roll) S.cam.rotateZ(k.roll);
  if (S.cam.fov !== k.fov) { S.cam.fov = k.fov; S.cam.updateProjectionMatrix(); }
}
// smooth deterministic noise of t (sum of sines, seeded): -1..1
const noise = (t, seed, fr) => (Math.sin(t * fr * 6.2832 + seed * 1.7) * .6 + Math.sin(t * fr * 2.13 * 6.2832 + seed * 4.1) * .3 + Math.sin(t * fr * 3.71 * 6.2832 + seed * 2.3) * .1);

// ---------- occlusion (build time): is the camera inside / behind a solid, seen from the subject? ----------
const REFRAME = ['from', 'size', 'angle', 'side', 'lens', 'fov', 'pitch', 'height', 'part', 'offset'];
const NO_AVOID = new Set(['pov', 'pushThrough']);   // the eyes of the subject / a path through an opening on purpose
// tried in order when blocked: other sides, closer with a wider lens, higher; the first clear one wins (deterministic)
const VARIANTS = [{ _dSide: 35 }, { _dSide: -35 }, { _dMul: .6 }, { _dPitch: 18 }, { _dSide: 70 }, { _dSide: -70 }, { _dSide: 35, _dMul: .6 }, { _dSide: -35, _dMul: .6 },
  { _dMul: .4 }, { _dPitch: 35 }, { _dSide: 110 }, { _dSide: -110 }, { _dSide: 180 }];
const solidMat = m => !!m && m.visible !== false && !(m.transparent && (m.opacity ?? 1) < .9) && !(m.transmission > 0) && m.side !== THREE.BackSide && m.colorWrite !== false && !m.isShadowMaterial && !/glass|window|sky|fog/i.test(m.name || '');
function occluders(S, exclude, only, subjBox = null) {   // solid meshes of the shot (not the subject, glass, back-faced domes, hidden things)
  const ex = new Set(); for (const r of exclude) r?.traverse?.(x => ex.add(x)); const out = [], subjSz = subjBox?.getSize(V());
  subjBox = subjBox?.clone().expandByScalar(.05);
  for (const R of only ? only.map(x => rootOf(x) || x).filter(x => x?.isObject3D) : [S.scene]) R.traverse(x => {
    if (!x.isMesh || ex.has(x) || x.userData?.noOcclude || x.userData?.sky || /sky|glass|window|helper/i.test(x.name || '')) return;
    for (let q = x; q; q = q.parent) if (q.visible === false) return;
    if (!(Array.isArray(x.material) ? x.material : [x.material]).some(solidMat)) return;
    const b = new THREE.Box3().setFromObject(x); if (b.isEmpty()) return; const s = b.getSize(V());
    if (subjBox && subjBox.containsPoint(b.getCenter(V())) && s.x <= subjSz.x * 1.2 && s.y <= subjSz.y * 1.2 && s.z <= subjSz.z * 1.2) return;   // its clothes, hair, held things
    out.push({ o: x, size: Math.max(s.x, s.y, s.z), b }); });
  return out;
}
// score of a move: rays from the subject's aim (+ two beside it) to the camera at 5 points along it; 0 = clear
function blocked(S, sb, moves, occ) {
  if (!occ.length || !moves.length) return { score: 0 }; const rc = new THREE.Raycaster(), aim = aimPt(sb), sz = sb.box.getSize(V()), w = Math.min(.6, .35 * Math.max(sz.x, sz.z) / 2 + .02);
  let score = 0, hit = null; const tmpV = V();
  for (const m of moves) for (const u of [0, .25, .5, .75, 1]) { const k = m.at(u), p = k.p.isVector3 ? k.p.clone() : V(...k.p);
    const fw = p.clone().sub(aim).setY(0), rt = fw.lengthSq() > 1e-8 ? V(fw.z, 0, -fw.x).normalize() : V(1, 0, 0);
    for (const [i, s] of [[0, 0], [1, 1], [2, -1]]) { const a = aim.clone().addScaledVector(rt, s * w), dv = p.clone().sub(a), dist = dv.length(); if (dist < 1e-3) continue;
      rc.set(a, dv.divideScalar(dist)); rc.far = dist; const tiny = Math.min(.25, .08 * dist);
      // (a ray can only hit a mesh whose box it crosses within its length: the box test first, the triangles only for those -
      // the same result, ~20x cheaper: the occlusion search was 95 % of a shot's build time, a freeze in playback)
      const cand = []; for (const x of occ) { if (x.size < tiny) continue; const ip = rc.ray.intersectBox(x.b, tmpV); if (ip && ip.distanceTo(a) <= dist) cand.push(x.o); }
      const h = cand.length ? rc.intersectObjects(cand, false)[0] : null; if (h && h.distance < dist - .01) { score += i ? 1 : 2; hit ??= h.object; } } }
  return { score, hit };
}
// the far plane (and a fog that would hide a region) reach the farthest thing the move frames: a km map never clips
function farGuard(S, at, sb, reach, name, t0) {
  if (!S.cam) return; const R = (sb ? sb.box.getSize(V()).length() / 2 : 0) + reach; let mx = 0;
  for (const u of [0, .5, 1]) { const k = at(u); mx = Math.max(mx, V(...(k.p.isVector3 ? k.p.toArray() : k.p)).distanceTo(V(...(k.l.isVector3 ? k.l.toArray() : k.l))) + R); }
  if (mx > S.cam.far * .95) { const f0 = S.cam.far; S.cam.far = Math.ceil(mx * 1.25); S.cam.updateProjectionMatrix();
    (S._camNotes ??= []).push(`${name} at ${(+t0).toFixed(2)}: far plane ${f0} -> ${S.cam.far} (it frames ${mx.toFixed(0)} m away; set S.studio({ near, far }) for km scenes)`); }
  const fog = S.scene?.fog; if (sb?.ground && fog?.far != null && fog.far < mx) { const k = mx * 1.3 / fog.far; fog.near *= k; fog.far *= k; }
}

// ---------- the per-shot handle ----------
export function camera(S) {
  const cache = new Map(), floorY = () => S.floor ? S.floor.position.y : null, env = () => ({ near: S.cam?.near ?? .1 });
  const C = { S, state: null, tEnd: null, subject: null };
  C.subj = (o = {}) => { const raw = o.subject ?? C.subject; if (raw == null) throw new Error('camera: no subject (pass { subject })');
    if (!cache.has(raw) || o.facing || o.extent || o.ground != null) { const sb = subjectOf(raw, o); if (!sb.group && sb.support === undefined) sb.support = supportOf(S, sb); cache.set(raw, sb); }
    C.subject = raw; return cache.get(raw); };
  C.params = (subject, o = {}) => params(C.subj({ ...o, subject }), o, floorY(), env());
  C.frame = (subject, o = {}) => solve(C.params(subject, o));
  C.match = (key, subject, o = {}) => C.frame(subject, { ...(key?.spec || {}), ...o });
  C.last = () => C.state ? solve(C.state) : null;
  // start params of a move: the previous move's end (same subject, nothing re-framed), else a fresh framing
  C.start = (o, defSize, extra = {}) => { const sb = C.subj(o); o = typeof o.from === 'string' ? o : { ...o, from: undefined };
    const fresh = !C.state || C.state.sb !== sb || ['from', 'size', 'angle', 'side', 'lens', 'fov', 'pitch', 'height', 'part', 'offset'].some(k => o[k] != null) || o.fresh;
    return fresh ? params(sb, { ...o, ...extra, size: o.from ?? o.size ?? defSize }, floorY(), env()) : { ...C.state, off: C.state.off.clone(), c: C.state.c.clone() }; };
  // end params: the start's framing with the size (and angle / side) changed
  C.end = (A, o, toSize, extra = {}) => { const sp = A.spec || {}, newAngle = o.toAngle ?? extra.angle;
    return params(A.sb, { ...sp, lead: o.lead ?? sp.lead, offset: o.offset, size: toSize ?? sp.size ?? 'MS', side: o.toSide ?? sp.side, fov: o.toFov ?? A.fov, lens: undefined,
      pitch: o.toPitch ?? (newAngle ? undefined : sp.pitch), height: newAngle ? undefined : sp.height, ...extra, angle: newAngle ?? sp.angle }, floorY(), env()); };
  const defDur = (o, d) => o.dur ?? d;
  // reg(o, at, name, opts): one rig move from at(u) -> key; returns the engine's move (dur after any lengthening)
  C.reg = (o, at, name, { snap = !!o.snap, linear = false, dur = 4, end = null, endKey = null, reach = 0 } = {}) => {
    const t0 = o.t0 ?? C.tEnd ?? S.t0 ?? 0; let D = defDur(o, dur);
    if (!snap && !linear) { const need = Math.max(CAMERA_LIMITS.minPush, 1.875 * pathDeg(at) / MAX_DEG);
      if (D < need - 1e-6) { (S._camNotes ??= []).push(`${name} at ${(+t0).toFixed(2)} lengthened ${D.toFixed(2)} -> ${need.toFixed(2)} s (keeps the picture under ${MAX_DEG} deg/s)`); D = need; } }
    const before = new Set(S.moves || []);   // (the whole path is checked here, so the rig's start/end check is skipped)
    S.cameraRig.path({ t0, dur: D, at, ease: linear ? (u => u) : o.ease, snap: true, name });
    const m = S.moves.find(x => !before.has(x)); m.name = name; C.tEnd = t0 + m.dur;
    C.state = end ?? (endKey ? inverse(endKey, C.subj(o), endKey.spec) : null);
    farGuard(S, at, C.subj(o), reach, name, t0); return m; };
  C.move = (name, o = {}) => { const key = moveName(name), M = CAMERA_MOVES[key]; if (!M) throw new Error(`camera: unknown move "${name}" (listMoves() has them all)`);
    const n0 = (S.moves || []).length, keep = { state: C.state, tEnd: C.tEnd, subject: C.subject, notes: (S._camNotes || []).length, lates: (S.lates || []).length };
    let sb0 = null; try { sb0 = C.subj(o); } catch { /* the move says what it needs */ } C.subject = keep.subject;
    const chained = !!(C.state && sb0 && C.state.sb === sb0 && !REFRAME.some(k => o[k] != null) && !o.fresh);
    M.build(C, o);
    if (o.avoid === false || NO_AVOID.has(key) || !S.scene || !sb0) return C;
    const added = () => (S.moves || []).slice(n0), undo = () => { const a = new Set(added()); for (let i = S.moves.length - 1; i >= 0; i--) if (a.has(S.moves[i])) S.moves.splice(i, 1);
      Object.assign(C, { state: keep.state, tEnd: keep.tEnd, subject: keep.subject }); if (S._camNotes) S._camNotes.length = keep.notes; if (S.lates) S.lates.length = keep.lates; };
    const occ = occluders(S, [sb0.root, ...(sb0.parts || []).map(p => p.root), rootOf(o.over), ...[o.subject].flat().map(rootOf)], Array.isArray(o.avoid) ? o.avoid : null, sb0.ground ? null : sb0.box);
    const t0 = added()[0]?.t0 ?? 0; let best = { ...blocked(S, sb0, added(), occ), v: null }, lastV = null; if (!best.score) return C;
    if (!chained) for (const v of VARIANTS) { undo(); M.build(C, { ...o, ...v }); lastV = v; const r = blocked(S, sb0, added(), occ);
      if (r.score < best.score) best = { ...r, v }; if (!r.score) break; }
    if (best.v !== lastV) { undo(); M.build(C, best.v ? { ...o, ...best.v } : o); }
    const what = `"${best.hit?.name || best.hit?.parent?.name || 'a solid'}"`;
    if (best.score) { const msg = `camera: ${key} at ${(+t0).toFixed(2)}: the camera is inside / behind ${what}${chained ? ' (a chained move keeps its start: re-frame it with side / angle)' : ' from every side, height and distance tried'}; kept the clearest. Move the set piece, give side / angle, or avoid: false`;
      console.warn(msg); (S._camNotes ??= []).push(msg); }
    else if (best.v) (S._camNotes ??= []).push(`${key} at ${(+t0).toFixed(2)} moved off ${what} (${Object.entries(best.v).map(([k, x]) => k.slice(2) + ' ' + x).join(', ')})`);
    return C; };
  C.hold = (size, o = {}) => C.move('static', { ...o, size: typeof size === 'string' ? size : o.size });
  C.rest = (o) => Math.max(.5, (S.t1 ?? (o.t0 ?? S.t0 ?? 0) + 4) - (o.t0 ?? C.tEnd ?? S.t0 ?? 0));   // the rest of the shot
  return C;
}

// ---------- the moves ----------
const paramMove = (C, o, A, B, name, dur, raw = false) => C.reg(o, u => solve(mixP(A, B, u, raw)), name, { dur, end: B });
const holdKey = (C, o, P, name, at) => C.reg(o, at || (() => solve(P)), name, { snap: true, dur: o.dur ?? C.rest(o), end: P });
function turnMove(C, o, name, B, startLook, dur, snap) {   // camera fixed at B's position, the view turns from startLook onto B
  const KB = solve(B), p = V(...KB.p), d1 = V(...KB.l).sub(p), d0 = startLook.clone().sub(p);
  const y0 = Math.atan2(d0.x, d0.z), y1 = y0 + wrap((Math.atan2(d1.x, d1.z) - y0) * R2D) * D2R;
  const p0 = Math.atan2(d0.y, Math.hypot(d0.x, d0.z)), p1 = Math.atan2(d1.y, Math.hypot(d1.x, d1.z)), r0 = d0.length(), r1 = d1.length();
  return C.reg(o, u => { const y = lerp(y0, y1, u), pt = lerp(p0, p1, u), r = lerp(r0, r1, u);
    return { p: KB.p, l: p.clone().add(V(Math.sin(y) * Math.cos(pt), Math.sin(pt), Math.cos(y) * Math.cos(pt)).multiplyScalar(r)).toArray(), fov: KB.fov, roll: KB.roll }; }, name, { dur, snap, end: B });
}
function panMove(sign, name, deg0 = 18, dur0 = 4, snap = false) {
  return (C, o) => { const B = C.start(o, 'MS'), KB = solve(B), p = V(...KB.p), l = V(...KB.l), deg = (o.deg ?? deg0) * sign;
    let start = o.from != null && typeof o.from !== 'string' ? (() => { const b = boxOf(o.from); return b.getCenter(V()); })() : null;
    if (!start) { const d = l.clone().sub(p), c = Math.cos(-deg * D2R), s = Math.sin(-deg * D2R); start = p.clone().add(V(d.x * c + d.z * s, d.y, -d.x * s + d.z * c)); }
    return turnMove(C, o, name, B, start, o.dur ?? dur0, snap); };
}
function tiltMove(dirUp, name, reveal = false) {
  return (C, o) => { const B = C.start(o, reveal ? 'FS' : 'MS', reveal ? { angle: o.angle ?? 'low' } : {}), KB = solve(B), sb = B.sb, l = V(...KB.l), p = V(...KB.p);
    let y; if (o.fromY != null) y = o.fromY; else if (dirUp) y = (sb.feet ?? sb.box.min.y) + .05; else { const deg = o.deg ?? 22, d = l.clone().sub(p), hd = Math.hypot(d.x, d.z), cur = Math.atan2(d.y, hd); y = p.y + Math.tan(cur + deg * D2R) * hd; }
    if (dirUp && o.deg != null) { const d = l.clone().sub(p), hd = Math.hypot(d.x, d.z), cur = Math.atan2(d.y, hd); y = p.y + Math.tan(cur - o.deg * D2R) * hd; }
    return turnMove(C, o, name, B, V(l.x, y, l.z), o.dur ?? (reveal ? 5 : 4)); };
}
function slideMove(axis, sign, name, lockLook = false) {   // truck (sideways) / pedestal (up-down): the end framing, approached from an offset
  return (C, o) => { const B = C.start(o, 'MS'), KB = solve(B), a = B.az * D2R, right = V(Math.cos(a), 0, -Math.sin(a)), ax = axis === 'x' ? right : V(0, 1, 0);
    const dist = o.dist ?? (lockLook ? .28 * V(...KB.p).distanceTo(V(...KB.l)) : axis === 'x' ? .3 * FRAME_W * B.Hp : .2 * B.Hp), off = ax.multiplyScalar(-sign * dist);
    const A = { p: V(...KB.p).add(off).toArray(), l: lockLook ? KB.l : V(...KB.l).add(off).toArray(), fov: KB.fov, roll: KB.roll };
    return C.reg(o, u => lerpKey(A, KB, u), name, { dur: o.dur ?? (lockLook ? 5 : 4), end: B }); };
}
function sizeMove(n, name, dur, keepFov = true) {   // dolly in/out, creep: same angle, the size changes by n steps
  return (C, o) => { const A = C.start(o, n > 0 ? 'MS' : 'MCU'), B = C.end(A, o, o.to ?? stepSize(A.spec.size, n), keepFov ? { fov: o.toFov ?? A.fov } : {});
    if (o.amount != null) { B.Hp = A.Hp * (1 - o.amount); B.c = A.c.clone(); }
    return paramMove(C, o, A, B, name, dur); };
}
function zoomMove(n, name, dur, snap = false) {   // the lens only: the camera stays, the fov changes (tan-space, a constant zoom rate)
  return (C, o) => { const A = C.start(o, n > 0 ? (snap ? 'WS' : 'MS') : 'MCU'), KA = solve(A), p = V(...KA.p);
    let lB, fB; if (o.amount != null) { lB = V(...KA.l); fB = 2 * Math.atan(Math.tan(KA.fov * D2R / 2) * (n > 0 ? 1 - o.amount : 1 + o.amount)) * R2D; }
    else { const B = C.end(A, o, o.to ?? stepSize(A.spec.size, n)), KB = solve(B); lB = V(...KB.l); fB = 2 * Math.atan(B.Hp / (2 * p.distanceTo(lB))) * R2D; }
    fB = clamp(fB, 4, 75); const t0 = Math.tan(KA.fov * D2R / 2), t1 = Math.tan(fB * D2R / 2), KB = { p: KA.p, l: lB.toArray(), fov: fB, roll: KA.roll };
    return C.reg(o, u => ({ p: KA.p, l: V(...KA.l).lerp(lB, u).toArray(), fov: 2 * Math.atan(t0 * Math.pow(t1 / t0, u)) * R2D, roll: KA.roll }), name, { dur: o.dur ?? dur, snap, endKey: { ...KB, spec: A.spec } }); };
}
function orbitMove(sign, name, deg0, dur0, extra = {}) {
  return (C, o) => { const A = C.start(o, extra.size ?? 'MS', extra.angle ? { angle: o.angle ?? extra.angle } : {}), deg = (o.deg ?? deg0) * (o.dir === 'left' ? -1 : o.dir === 'right' ? 1 : sign);
    const B = { ...A, az: A.az + deg, pitch: o.toPitch ?? A.pitch + (extra.rise ?? 0), c: A.c.clone(), off: A.off.clone() };
    return paramMove(C, o, A, B, name, o.dur ?? dur0, true); };
}
function track(C, o, name, side, defSize, pitch0, bob = 0) {   // follow a moving subject: S.late after update(), or o.path(t)
  const S = C.S, sb = C.subj(o), t0 = o.t0 ?? C.tEnd ?? S.t0 ?? 0, dur = o.dur ?? C.rest(o);
  const P0 = params(sb, { ...o, size: o.size ?? defSize, side: o.side ?? side, pitch: o.pitch ?? pitch0, lead: o.lead ?? (side === 90 || side === -90 ? .12 : 0) }, null);
  P0.floorY = sb.feet ?? null;
  const pos0 = o.path ? V(...o.path(t0)) : rootPos(sb), head0 = Math.atan2(sb.front.x, sb.front.z), rel = P0.c.clone().sub(pos0), fixed = o.dir ? Math.atan2(o.dir[0], o.dir[1]) : null;
  const keyAt = (t, pos, front, ht) => { const hd = fixed ?? Math.atan2(front.x, front.z), dh = hd - head0, r = rel.clone().applyAxisAngle(V(0, 1, 0), dh), fr = V(Math.sin(hd), 0, Math.cos(hd));
    const box = sb.box.clone().translate(pos.clone().sub(pos0)), P = { ...P0, sb: { ...sb, box }, front: fr, c: pos.clone().add(r), az: P0.az + dh * R2D, off: P0.off.clone(),
      headTop: P0.headTop ? (ht ?? P0.headTop.clone().add(pos.clone().sub(pos0))) : null };
    if (bob) { const k = sstep(seg(t, t0, t0 + .8)) * (1 - sstep(seg(t, t0 + dur - .8, t0 + dur))); P.off.add(V(0, bob * k * Math.sin((t - t0) * 1.8 * 6.2832), 0)).add(V(Math.cos(P.az * D2R), 0, -Math.sin(P.az * D2R)).multiplyScalar(bob * .6 * k * Math.sin((t - t0) * .9 * 6.2832))); }
    return solve(P); };
  const front = () => sb.root ? frontOf(null, sb.root, {}) : sb.front;
  if (o.path) {   // the subject's position as a function of t: a plain deterministic path, followed through a smoothing window
    const w = o.smooth ?? .5, n = Math.max(1, Math.ceil(w * 30)), taps = [];   // (cos^2 kernel over +-w: a walk that starts / stops dead eases)
    for (let i = -n; i <= n; i++) taps.push([i / n * w, Math.cos(i / (n + 1) * Math.PI / 2) ** 2]); const ws = taps.reduce((s, x) => s + x[1], 0);
    const sp = t => taps.reduce((s, [d, k]) => s.addScaledVector(V(...o.path(t + d)), k / ws), V());
    const dirAt = t => { const d = sp(t + .1).sub(sp(t - .1)).setY(0); return d.lengthSq() > 1e-8 ? d.normalize() : sb.front; };
    return C.reg({ ...o, t0, dur }, u => { const t = t0 + u * dur, p = sp(t); return keyAt(t, p, dirAt(t), P0.headTop ? P0.headTop.clone().add(V(...o.path(t)).sub(pos0)) : null); }, name, { linear: true, dur }); }
  const m = C.reg({ ...o, t0, dur }, () => keyAt(t0, pos0, sb.front), name, { snap: true, dur });
  // soft follow, a pure function of where the subject is now (no frame-to-frame state): the camera follows its displacement
  // D from the build pose through h(x) = x - x e^(-x/b) (h' = 0 at rest, no lag at speed), so a walk that starts at speed,
  // at any time in the move, or a subject built away from its t0 pose never jerks the frame. easeIn (s): an extra time ramp.
  const b = o.soft ?? Math.max(.35, .3 * P0.Hp), ein = o.easeIn ?? .8;   // + a short time ramp: a subject already walking at t0 starts the camera from rest
  S.late(t => { if (activeMove(S, t) !== m) return; const pos = rootPos(sb), D = pos.clone().sub(pos0), x = D.length(), f = front(), r = ein > 0 ? smootherstep(seg(t, t0, t0 + ein)) : 1;
    const k = (x > 1e-6 ? (x - x * Math.exp(-x / b)) / x : 0) * r, kh = sstep(clamp(x / b, 0, 1)) * r, ht = headNow(sb);
    const anchor = pos0.clone().addScaledVector(D, k);
    applyKey(S, keyAt(t, anchor, sb.front.clone().lerp(f, kh).normalize(), ht)); });
  C.state = null; return m;
}

export const CAMERA_MOVES = {
  // ---- static / framing ----
  static: { aka: ['hold', 'lockedOff', 'lockOff', 'locked'], group: 'static', intent: 'locked-off frame: let the action or the words carry the shot; the default for dialogue, evidence, a beat of stillness',
    params: 'size, angle, side, lens|fov, lead, part, height, offset, dur (default: rest of shot)',
    build: (C, o) => holdKey(C, o, C.start(o, 'MS')) },
  dutch: { aka: ['dutchTilt', 'canted', 'dutchAngle'], group: 'static', intent: 'tilted horizon: unease, a mind off balance, the moment things go wrong. Rolls in slowly, then holds',
    params: 'roll (deg, default 10; - tilts the other way), size, angle, side, dur (roll-in, default 4), hold: true = already tilted',
    build: (C, o) => { const A = C.start(o, 'MS'), B = { ...A, roll: o.roll ?? 10, Hp: A.Hp * (o.hold ? 1 : .94) }; if (o.hold) return holdKey(C, o, B); return paramMove(C, o, { ...A, roll: 0 }, B, 'dutch', 4); } },
  handheld: { aka: ['shake', 'handHeld', 'documentary'], group: 'human', intent: 'a held camera: urgency, reportage, a witness in the room. Subtle (0.25 deg, < 1.5 Hz), eased in and out, deterministic',
    params: 'size, angle, side, amount (deg, default .25, max .3), seed, dur (default: rest of shot)',
    build: (C, o) => { const P = C.start(o, 'MS'), K = solve(P), t0 = o.t0 ?? C.tEnd ?? C.S.t0 ?? 0, dur = o.dur ?? C.rest(o), amt = Math.min(.3, o.amount ?? .25), sd = o.seed ?? 1;
      const p0 = V(...K.p), l0 = V(...K.l), D = p0.distanceTo(l0), a = P.az * D2R, right = V(Math.cos(a), 0, -Math.sin(a));
      return C.reg({ ...o, t0, dur }, u => { const t = t0 + u * dur, k = sstep(seg(t, t0, t0 + .8)) * (1 - sstep(seg(t, t0 + dur - .8, t0 + dur)));
        const yaw = noise(t, sd, .55) * amt * k * D2R * D, pit = noise(t, sd + 3, .7) * amt * .75 * k * D2R * D;
        return { p: p0.clone().addScaledVector(right, yaw * .05).toArray(), l: l0.clone().addScaledVector(right, yaw).add(V(0, pit, 0)).toArray(), fov: K.fov, roll: K.roll + noise(t, sd + 7, .4) * amt * .5 * k * D2R }; },
      'handheld', { linear: true, dur, end: P }); } },
  ots: { aka: ['overTheShoulder', 'overShoulder', 'OTS'], group: 'static', intent: 'over the shoulder of `over` onto the subject: a conversation, an interrogation, a confrontation; the listener frames the speaker',
    params: 'over (the near person, required), shoulder: right|left, size (of the subject, default MCU), creep (fraction pushed in over dur, default 0), dur',
    build: (C, o) => { const sb = C.subj(o), ov = subjectOf(o.over ?? (() => { throw new Error('camera ots: pass { over: thePersonInFront }'); })());
      const aimB = params(sb, { size: o.size ?? 'MCU' }).c, hd = ov.part('head') ?? V(ov.box.getCenter(V()).x, (ov.top ?? ov.box.max.y) - .15, ov.box.getCenter(V()).z);
      const dir = aimB.clone().sub(hd).setY(0).normalize(), rt = dir.clone().cross(V(0, 1, 0)).normalize().multiplyScalar(o.shoulder === 'left' ? -1 : 1), s = ov.s || 1;
      const p = hd.clone().add(V(0, .04 * s, 0)).addScaledVector(dir, -(o.back ?? .95) * s).addScaledVector(rt, (o.wide ?? .42) * s), dist = p.distanceTo(aimB);
      const H = (sb.person ? SIZES[sizeOf(o.size ?? 'MCU')].H * sb.h : sb.box.getSize(V()).y / SIZES[sizeOf(o.size ?? 'MCU')].fill), fov = clamp(2 * Math.atan(H / (2 * dist)) * R2D, 12, 50);
      const l = aimB.clone().addScaledVector(rt, -.16 * FRAME_W * H), K = { p: p.toArray(), l: l.toArray(), fov, roll: 0 }, cr = o.creep ?? 0;
      return C.reg(o, u => ({ ...K, p: p.clone().lerp(l, cr * u).toArray() }), 'ots', { snap: !cr, dur: o.dur ?? C.rest(o), endKey: { ...K, spec: { size: o.size ?? 'MCU' } } }); } },
  pov: { aka: ['pointOfView', 'POV', 'firstPerson'], group: 'human', intent: "through the subject's eyes: what they saw (the door, the screen, the drop); cut to it from a CU of the person",
    params: 'subject = the person whose eyes, at (thing/point to look at; default straight ahead, 8 deg down), fov (default 38), push (m forward over dur), bob (m, walking), dur',
    build: (C, o) => { const sb = C.subj(o), s = sb.s || 1, hd = sb.part('head') ?? V(sb.box.getCenter(V()).x, (sb.top ?? sb.box.max.y) - .12, sb.box.getCenter(V()).z), f = sb.front;
      const eye = hd.clone().add(V(0, .1 * s, 0)).addScaledVector(f, .17 * s), at = o.at != null ? aimPt(o.at) : eye.clone().addScaledVector(f, 5).add(V(0, -5 * Math.tan(8 * D2R), 0));
      const fw = at.clone().sub(eye).normalize(), push = o.push ?? 0, bob = o.bob ?? 0, t0 = o.t0 ?? C.tEnd ?? C.S.t0 ?? 0, dur = o.dur ?? C.rest(o), fov = o.fov ?? (o.lens ? lensFov(o.lens) : 38);
      return C.reg({ ...o, t0, dur }, u => { const t = t0 + u * dur, k = sstep(seg(t, t0, t0 + .8)) * (1 - sstep(seg(t, t0 + dur - .8, t0 + dur))), e = eye.clone().addScaledVector(fw, push * smootherstep(u)).add(V(0, bob * k * Math.sin((t - t0) * 1.8 * 6.2832), 0));
        return { p: e.toArray(), l: at.clone().addScaledVector(fw, push * smootherstep(u)).toArray(), fov, roll: 0 }; }, 'pov', { linear: !!(push || bob), snap: !(push || bob), dur }); } },
  twoShot: { aka: ['two', 'twoshot', 'groupShot', '2shot'], group: 'static', intent: 'two (or more) people or things together in one frame: a relationship, a meeting, a comparison; subject = [a, b]',
    params: 'subject: [a, b, ...], size (default MS), side (default 0 = square to the line between them), angle, creep (fraction pushed in, default .04), dur',
    build: (C, o) => { const A = C.start(o, 'MS'), cr = o.creep ?? .04; if (!cr) return holdKey(C, o, A); return paramMove(C, o, A, { ...A, Hp: A.Hp * (1 - cr), c: A.c.clone(), off: A.off.clone() }, 'twoShot', o.dur ?? C.rest(o)); } },
  // ---- pan / tilt (camera stays, the view turns) ----
  panLeft: { aka: ['pan', 'panL'], group: 'pan/tilt', intent: 'the view turns left and lands on the subject: follow the eye across a place, connect two things side by side',
    params: 'deg (default 18), from (thing/point to start on), size, angle, side, dur (4)', build: panMove(1, 'panLeft') },
  panRight: { aka: ['panR'], group: 'pan/tilt', intent: 'the view turns right and lands on the subject', params: 'as panLeft', build: panMove(-1, 'panRight') },
  panReveal: { aka: ['revealPan'], group: 'pan/tilt', intent: 'start on something else (or empty space) and pan onto the subject: the reveal, the answer to "who / what was there"',
    params: 'from (thing/point to start on; default 40 deg away), dir: left|right, size, dur (5)', build: (C, o) => panMove(o.dir === 'right' ? -1 : 1, 'panReveal', 40, 5)(C, o) },
  tiltUp: { aka: ['tilt'], group: 'pan/tilt', intent: 'the view rises from the feet / base to the framing: size someone up, a slow reveal of who they are',
    params: 'deg (else from the feet), fromY, size (default MS), dur (4)', build: tiltMove(true, 'tiltUp') },
  tiltDown: { aka: [], group: 'pan/tilt', intent: 'the view comes down from above (sky, ceiling, sign) onto the subject: arrive in a place', params: 'deg (default 22), size, dur (4)', build: tiltMove(false, 'tiltDown') },
  tiltReveal: { aka: ['revealTilt'], group: 'pan/tilt', intent: 'from the base up a tall subject (tower, ship, statue, a person from a low angle): scale and power',
    params: 'size (default FS), angle (default low), fromY, dur (5)', build: tiltMove(true, 'tiltReveal', true) },
  // ---- zoom / lens (camera stays, the lens changes) ----
  zoomIn: { aka: ['zoom'], group: 'zoom/lens', intent: 'the lens tightens (no parallax): the observer\'s attention narrows; archival, surveillance, a TV-news feel',
    params: 'from, to (default one size tighter) or amount (fraction of fov), dur (3.5)', build: zoomMove(1, 'zoomIn', 3.5) },
  zoomOut: { aka: [], group: 'zoom/lens', intent: 'the lens widens: context arrives, the subject becomes small in its world', params: 'as zoomIn', build: zoomMove(-1, 'zoomOut', 3.5) },
  slowZoom: { aka: ['creepZoom', 'kenBurns'], group: 'zoom/lens', intent: 'a barely noticed zoom over a long beat: tension builds under narration, the subject slowly matters more',
    params: 'amount (default .15 of fov), dur (7)', build: (C, o) => zoomMove(1, 'slowZoom', 7)(C, { amount: .15, ...o }) },
  dollyZoom: { aka: ['vertigo', 'contraZoom', 'zolly', 'hitchcock'], group: 'zoom/lens', intent: 'distance and lens change together, the subject stays the same size while the world stretches: the realisation, dread',
    params: 'dir: out (default: pull back + zoom in) | in, ratio (camera distance factor, default 1.8), size (default MCU), dur (5)',
    build: (C, o) => { const A = C.start(o, 'MCU'), r = Math.max(1.05, o.ratio ?? 1.8), out = o.dir !== 'in', t0 = Math.tan(A.fov * D2R / 2);
      const B = { ...A, fov: 2 * Math.atan(t0 / (out ? r : 1 / r)) * R2D, c: A.c.clone(), off: A.off.clone() }; return C.reg(o, u => { const f = 2 * Math.atan(t0 / Math.pow(out ? r : 1 / r, u)) * R2D; return solve({ ...A, fov: f }); }, 'dollyZoom', { dur: o.dur ?? 5, end: B }); } },
  rackFocus: { aka: ['rack', 'focusPull', 'pullFocus'], group: 'zoom/lens', intent: 'focus moves from one thing to another in a held frame: shift attention (the photo in the foreground, then the man behind)',
    params: 'to (thing/point focused at the end, required), focusFrom (default the subject), size, at (rack start time, default t0 + .8), rackDur (1.4), aperture, frame: [a, b] (frame both; default the subject)',
    build: (C, o) => { const P = C.start({ ...o, subject: o.frame ?? o.subject }, 'MS'), t0 = o.t0 ?? C.tEnd ?? C.S.t0 ?? 0;
      C.S.cameraRig.rack({ t0: o.at ?? t0 + .8, dur: o.rackDur ?? 1.4, from: o.focusFrom ?? o.subject ?? C.subject, to: o.to, aperture: o.aperture ?? .004, maxblur: o.maxblur ?? .012 });
      return holdKey(C, { ...o, t0 }, P); } },
  crashZoom: { aka: ['snapZoom', 'smashZoom'], group: 'special', intent: 'SNAP, stylised: a very fast zoom (0.35 s) for a cut-on-motion punch only; check_layout flags it ABRUPT otherwise',
    params: 'from (default WS), to (default two sizes tighter), dur (.35)', build: (C, o) => zoomMove(1, 'crashZoom', .35, true)(C, o.to ? o : { ...o, to: stepSize(C.start(o, 'WS').spec.size, 2) }) },
  // ---- dolly / truck / pedestal (the camera travels) ----
  dollyIn: { aka: ['pushIn', 'push', 'dolly', 'pushOn'], group: 'dolly/track', intent: 'the camera travels toward the subject: importance, focus, "this is the one"; the workhorse move',
    params: 'from (default MS), to (default one size tighter) or amount (fraction closer), angle, side, dur (4)', build: sizeMove(1, 'dollyIn', 4) },
  dollyOut: { aka: ['pullOut', 'pullBack', 'pull', 'dollyBack'], group: 'dolly/track', intent: 'the camera backs away: isolation, aftermath, context arrives around the subject',
    params: 'from (default MCU), to (default one size wider), angle, side, dur (4)', build: sizeMove(-1, 'dollyOut', 4) },
  creep: { aka: ['slowPush', 'creepIn', 'slowCreep'], group: 'dolly/track', intent: 'an almost invisible push over a long beat: keeps a still image alive under narration',
    params: 'amount (default .08 closer), dur (6)', build: (C, o) => sizeMove(1, 'creep', 6)(C, { amount: .08, ...o }) },
  truckLeft: { aka: ['truck', 'crabLeft', 'crab'], group: 'dolly/track', intent: 'the camera slides left, the view parallel (no turn): reveal a row, glide along a line-up, a desk, a wall of evidence',
    params: 'dist (m, default .3 frame widths), size, side, dur (4)', build: slideMove('x', -1, 'truckLeft') },
  truckRight: { aka: ['crabRight'], group: 'dolly/track', intent: 'the camera slides right, the view parallel', params: 'as truckLeft', build: slideMove('x', 1, 'truckRight') },
  parallax: { aka: ['parallaxSlide', 'slide', 'arcSlide'], group: 'dolly/track', intent: 'slide sideways while the look stays locked on the subject: depth, the foreground sliding past; makes a static scene feel filmed',
    params: 'dir: right (default) | left, dist (m, default .28 x distance), size, dur (5)', build: (C, o) => slideMove('x', o.dir === 'left' ? -1 : 1, 'parallax', true)(C, o) },
  pedestalUp: { aka: ['pedestal', 'pedUp', 'boomUp'], group: 'dolly/track', intent: 'the camera rises straight up, the view level: climb past a counter, up a body, over a table edge',
    params: 'dist (m, default .2 frame heights), size, dur (4)', build: slideMove('y', 1, 'pedestalUp') },
  pedestalDown: { aka: ['pedDown', 'boomDown'], group: 'dolly/track', intent: 'the camera sinks straight down, the view level: settle onto the subject\'s level', params: 'as pedestalUp', build: slideMove('y', -1, 'pedestalDown') },
  pushThrough: { aka: ['flyThrough', 'throughGap', 'throughDoor', 'throughWindow'], group: 'dolly/track', intent: 'the camera flies through an opening (door, window, gap between buildings) onto the subject: enter a new space',
    params: 'through: [x, y, z] (centre of the opening, required), from: [x, y, z] (start; default mirrored beyond the opening), to (size at the end, MS), dur (5)',
    build: (C, o) => { const B = C.start({ ...o, from: undefined, size: o.to ?? o.size }, 'MS'), KB = solve(B), p1 = V(...KB.p), g = V(...(o.through ?? (() => { throw new Error('camera pushThrough: pass { through: [x, y, z] }'); })()));
      const p0 = o.from && typeof o.from !== 'string' ? V(...o.from) : g.clone().multiplyScalar(2).sub(p1), q = g.clone().multiplyScalar(2).sub(p0.clone().add(p1).multiplyScalar(.5));
      return C.reg(o, u => { const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; return { p: p0.clone().multiplyScalar(a).addScaledVector(q, b).addScaledVector(p1, c).toArray(), l: KB.l, fov: KB.fov, roll: 0 }; }, 'pushThrough', { dur: o.dur ?? 5, end: B }); } },
  trackSide: { aka: ['tracking', 'track', 'truckingShot', 'sideTrack', 'dollyTrack'], group: 'dolly/track', intent: 'travel beside a walking / driving subject, side-on: a journey, a procession, the walk to the door',
    params: 'side (90 = their left, -90 = their right), size (default FS), pitch (4), lead (look room ahead, .12), dir: [x, z] (fixed heading), path: t => [x, y, z] (subject position fn; smooth: s window, .5), soft (m, follow softness), easeIn (s, .8), dur (rest of shot). Every move: avoid (false | [objects]), headroom (false)',
    build: (C, o) => track(C, o, 'trackSide', 90, 'FS', 4) },
  follow: { aka: ['trackBehind', 'chase', 'followBehind'], group: 'dolly/track', intent: 'follow behind the subject as they move: we go where they go (into the building, down the corridor)',
    params: 'size (default FS), pitch (10), side (180 = straight behind), dir, path, dur', build: (C, o) => track(C, o, 'follow', 165, 'FS', 10) },
  lead: { aka: ['trackFront', 'leading', 'walkBackwards', 'leadingShot'], group: 'dolly/track', intent: 'in front of the subject, backing away as they come on: determination, confrontation, their face as they walk',
    params: 'size (default MFS), side (0 = straight ahead), pitch, dir, path, dur', build: (C, o) => track(C, o, 'lead', 12, 'MFS', 2) },
  steadicam: { aka: ['walkAndTalk', 'gimbal', 'steadicamWalk'], group: 'human', intent: 'a smooth operated follow with a gentle walking bob: a human presence moving with the subject',
    params: 'side (default 150 = behind their left shoulder), size (default MFS), bob (m, .015), dir, path, dur', build: (C, o) => track(C, o, 'steadicam', 150, 'MFS', 6, o.bob ?? .015) },
  // ---- orbit / arc / crane ----
  orbitCW: { aka: ['orbit', 'circle', 'orbitClockwise'], group: 'orbit/crane', intent: 'circle the subject clockwise (seen from above): study it from every side, a monument, the key object',
    params: 'deg (default 90), size, angle, toPitch, dur (7; lengthened to keep < 25 deg/s)', build: orbitMove(-1, 'orbitCW', 90, 7) },
  orbitCCW: { aka: ['orbitCounter', 'orbitAnticlockwise'], group: 'orbit/crane', intent: 'circle the subject counter-clockwise (seen from above)', params: 'as orbitCW', build: orbitMove(1, 'orbitCCW', 90, 7) },
  arc: { aka: ['arcShot', 'halfOrbit'], group: 'orbit/crane', intent: 'a short arc (<= 30 deg) round the subject: adds depth to a held moment without leaving it',
    params: 'deg (default 24, max 30), dir: right (default, ccw) | left, size, dur (4.5)', build: (C, o) => orbitMove(1, 'arc', Math.min(30, o.deg ?? 24), 4.5)(C, { ...o, deg: Math.min(30, o.deg ?? 24) }) },
  hero360: { aka: ['orbit360', 'turntable', 'heroOrbit', 'fullOrbit'], group: 'orbit/crane', intent: 'a full slow 360 round the subject with a slight rise: the hero object, the reconstructed site, the reveal of the whole',
    params: 'deg (360), size (default FS), rise (deg of pitch gained, 6), dur (28; lengthened to keep < 25 deg/s)', build: (C, o) => orbitMove(1, 'hero360', 360, 28, { size: 'FS', rise: o.rise ?? 6 })(C, o) },
  craneUp: { aka: ['jibUp', 'crane', 'riseUp'], group: 'orbit/crane', intent: 'the camera rises and looks down on the subject: leaving a scene, the bigger picture, the end of a chapter',
    params: 'from (default MS), to (default one size wider), toAngle (default high), dur (5)', build: (C, o) => { const A = C.start(o, 'MS'); return paramMove(C, o, A, C.end(A, o, o.to ?? stepSize(A.spec.size, -1), { angle: o.toAngle ?? 'high' }), 'craneUp', 5); } },
  craneDown: { aka: ['jibDown', 'descend', 'craneIn'], group: 'orbit/crane', intent: 'the camera comes down from high to the subject\'s level: arriving into a scene, joining the people',
    params: 'from (default WS from high), to (default MS at eye), dur (5)', build: (C, o) => { const A = C.start({ angle: 'high', ...o }, 'WS'); return paramMove(C, o, A, C.end(A, o, o.to ?? stepSize(A.spec.size, 2), { angle: o.toAngle ?? 'eye' }), 'craneDown', 5); } },
  craneReveal: { aka: ['jibReveal', 'riseReveal', 'overReveal'], group: 'orbit/crane', intent: 'rise from low (behind a foreground, near the ground) to a high wide frame: reveal the scene, the scale of what happened',
    params: 'to (default WS), low (start look height above the base, .3), dur (6)', build: (C, o) => { const B = C.start({ angle: 'high', ...o, size: o.to ?? o.size }, 'WS'), base = B.sb.feet ?? B.sb.box.min.y;
      const A = { ...B, pitch: -4, c: V(B.c.x, base + (o.low ?? .3), B.c.z), Hp: B.Hp * .8, off: B.off.clone() }; return paramMove(C, o, A, B, 'craneReveal', 6); } },
  boomOver: { aka: ['overTheTop', 'overhead', 'boomTop'], group: 'orbit/crane', intent: 'from the front up and over to look straight down: a map-like summary of a desk, a body, a layout',
    params: 'size, toPitch (default 85), dur (6)', build: (C, o) => { const A = C.start(o, 'FS'); return paramMove(C, o, A, { ...A, pitch: o.toPitch ?? 85, Hp: A.Hp * 1.05, c: A.c.clone(), off: A.off.clone() }, 'boomOver', 6); } },
  // ---- drone / aerial ----
  flyover: { aka: ['droneFlyover', 'flyOver', 'overflight'], group: 'drone/aerial', intent: 'a drone pass over the target at height, looking ahead-down: the site passes beneath; travel, geography, approach',
    params: 'height (m, default 2.5 x subject size, >= 6; a region: .12 x its extent), site (point / thing on a region to pass over), pitch (deg down, 38), side (direction it comes from), fov (40), dur (7)',
    build: (C, o) => { const sb = C.subj(o), c = o.site != null ? aimPt(o.site) : sb.box.getCenter(V()), sz = sb.box.getSize(V()), az = (Math.atan2(sb.front.x, sb.front.z) * R2D + (o.side ?? 0) + (o._dSide ?? 0)) * D2R;
      const Hg = o.height ?? (sb.ground ? .12 * sb.E : Math.max(6, 2.5 * Math.max(sz.x, sz.y, sz.z)));
      const h = V(Math.sin(az), 0, Math.cos(az)), th = (o.pitch ?? 38) * D2R, p0 = c.clone().addScaledVector(h, Hg / Math.tan(th)).add(V(0, Hg, 0)), p1 = c.clone().addScaledVector(h, -.9 * Hg).add(V(0, Hg * 1.05, 0));
      const look = p => p.clone().addScaledVector(h, -Math.cos(th) * Hg).add(V(0, -Math.sin(th) * Hg, 0));
      return C.reg(o, u => { const p = p0.clone().lerp(p1, u); return { p: p.toArray(), l: look(p).toArray(), fov: o.fov ?? 40, roll: 0 }; }, 'flyover', { dur: o.dur ?? 7, endKey: { p: p1.toArray(), l: look(p1).toArray(), fov: o.fov ?? 40, spec: { size: 'EWS' } } }); } },
  droneRise: { aka: ['droneReveal', 'riseAndReveal', 'droneUp'], group: 'drone/aerial', intent: 'the drone rises from head height and tilts down to reveal the site from above: the scale of the place, an establishing reveal',
    params: 'to (default EWS high), height0 (start, m above the base: 1.8; a region: 2 % of its extent), site (a region: the point to rise over), dur (7)', build: (C, o) => { const B = C.start({ angle: 'high', ...o, size: o.to ?? o.size }, 'EWS'), KB = solve(B), base = B.sb.feet ?? B.sb.box.min.y;
      const pB = V(...KB.p), lB = V(...KB.l), hd = Math.hypot(pB.x - lB.x, pB.z - lB.z), y0 = (B.sb.ground ? Math.max(base, B.c.y) : base) + (o.height0 ?? (B.sb.ground ? .02 * B.sb.E : 1.8)), pA = V(pB.x, y0, pB.z), lA = V(lB.x, y0 + hd * Math.tan(3 * D2R), lB.z);
      const A = { p: pA.toArray(), l: lA.toArray(), fov: KB.fov, roll: 0 }; return C.reg(o, u => lerpKey(A, KB, u), 'droneRise', { dur: o.dur ?? 7, end: B }); } },
  topDownDescend: { aka: ['droneDescend', 'godsEye', 'topDown', 'birdseyeDescend'], group: 'drone/aerial', intent: "straight down from above, descending with a slow turn: the god's-eye view of a scene, a body, a crash site",
    params: 'from (default EWS), to (default WS), spin (deg, 25), dur (7)', build: (C, o) => { const A = C.start({ ...o, angle: 'top' }, 'EWS'), B = C.end(A, o, o.to ?? 'WS', { angle: 'top' }); B.az = A.az + (o.spin ?? 25); return paramMove(C, o, A, B, 'topDownDescend', 7, true); } },
  aerialOrbit: { aka: ['establishingOrbit', 'droneOrbit', 'establishing'], group: 'drone/aerial', intent: 'a high slow orbit round the whole site: the establishing shot of a place (a reconstructed town, a bridge, a ship)',
    params: 'deg (45), size (default EWS), angle (high), dur (12)', build: orbitMove(1, 'aerialOrbit', 45, 12, { size: 'EWS', angle: 'high' }) },
  satelliteZoom: { aka: ['mapZoom', 'earthZoom', 'orbitalZoom', 'zoomFromSpace'], group: 'drone/aerial', intent: 'straight down from very high to the site (maps, terrain): where in the world this happened',
    params: 'height0 (start height above the site; default 25 x the end distance, a region: the whole region in frame and >= 6 x; always >= 3 x the end, the far plane follows), site (the point / thing on a region map to land on; default its centre), to (end size, WS = 30 % of a region), spin (deg, 10), dur (6)',
    build: (C, o) => { const map = C.subj(o), onSite = o.site != null && typeof o.site !== 'number' && !(Array.isArray(o.site) && typeof o.site[0] === 'number');   // a site thing: land on it
      const B = C.start(onSite ? { ...o, subject: o.site, site: undefined, angle: 'top', size: o.to ?? o.size } : { ...o, angle: 'top', size: o.to ?? o.size }, 'WS'), sb = onSite ? map : B.sb, dB = B.Hp / (2 * Math.tan(B.fov * D2R / 2)), tf = 2 * Math.tan(B.fov * D2R / 2);
      // ALWAYS descends: a region starts with all of it in frame (and >= 6 x the end), anything else 25 x (capped by the far plane, never below 3 x)
      const whole = sb.ground ? sb.E * 1.15 / tf + (B.c.distanceTo(sb.box.getCenter(V())) * 2) / tf : 0, def = sb.ground ? Math.max(onSite ? Math.min(whole, 12 * dB) : whole, 6 * dB) : Math.max(3 * dB, Math.min(C.S.cam.far * .7, dB * 25));
      const h0 = Math.max(3 * dB, o.height0 ?? def); if (o.height0 != null && o.height0 < 3 * dB) (C.S._camNotes ??= []).push(`satelliteZoom: height0 ${o.height0} is below 3 x the end distance (${(3 * dB).toFixed(0)}): raised so it descends`);
      const A = { ...B, Hp: B.Hp * h0 / dB, az: B.az - (o.spin ?? 10), c: B.c.clone(), off: B.off.clone() }; return C.reg(o, u => solve(mixP(A, B, u, true)), 'satelliteZoom', { dur: o.dur ?? 6, end: B, reach: sb.ground ? sb.E * .75 : 0 }); } },
  // ---- stylised (snap) ----
  whipPan: { aka: ['swishPan', 'whip', 'flickPan'], group: 'special', intent: 'SNAP, stylised: a very fast pan (0.45 s) that blurs between two places, for a cut-on-motion only (end one shot on it, start the next in it); check_layout flags it ABRUPT otherwise',
    params: 'deg (70), dir: left (default) | right, from (thing to whip away from), dur (.45)', build: (C, o) => panMove(o.dir === 'right' ? -1 : 1, 'whipPan', 70, .45, true)(C, o) },
};
const ALIAS = {}; for (const [k, m] of Object.entries(CAMERA_MOVES)) { ALIAS[k.toLowerCase()] = k; for (const a of m.aka) ALIAS[a.toLowerCase()] ??= k; }
const moveName = n => ALIAS[String(n).replace(/[\s_-]/g, '').toLowerCase()] ?? ALIAS[String(n).toLowerCase()];
export const listMoves = () => Object.entries(CAMERA_MOVES).map(([name, m]) => ({ name, aka: m.aka, group: m.group, intent: m.intent, params: m.params }));

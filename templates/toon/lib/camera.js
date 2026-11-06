// The camera: framings named like a storyboard (ecu, cu, mcu, ms, mws, ws, ews, aerial) on a subject, sized as the
// references measured them in 9:16 (the head against the frame WIDTH: CU ~57 %, MS ~27 %) with the face always above the
// captions (70.5 % of the height), and the measured moves of the studied shorts (experiments/toon-style/MOTION.md):
//  creep   the hold never freezes: ~0.2 %/frame dolly-in after a 0.4 s ease-in            S.camera('creep', { on, frame })
//  static  no creep (a deliberate still)
//  push    from one framing to another in log-zoom, sineInOut over the shot              { from: 'ms', to: 'cu', at, dur }
//  pull / reveal  pull out: a few frames of ease-in, speed peak at ~25 % of the move, long decay (48 frames)
//  pan     re-aim from `on` to `toward` in 18 frames, cubicOut                            { on, toward, at, dur }
//  orbit   yaw around the subject (deg over dur), crane (height -> height2), track (sideways with a walker),
//  follow  keep a moving thing in frame (the look point lags), keys (keyframes), fly (camera + look paths)
//  options on every rig: into: true (a cubicIn push whose speed peaks ON the cut, ~3 %/frame), react: t | [{ at, amt }]
//  (1.00 -> 1.30 in 19 frames, 4 % settle), side / yaw / height (deg), zoom, place [x, y], offset [x,y,z], fov, roll,
//  lockAt (the time the subject is framed at; default the shot's start: the camera never chases head bobs), follow: true.
// Every rig is (cam, t) => void and a pure function of t (actors are evaluated at the lock time, then put back).
import { THREE, clamp, lerp, seg, E, easeFn, fbm1 } from './core.js';

const F = 1 / 30;
// Framings, measured on the references by the size of the head against the frame's SHORT side (the width in 9:16):
// CU head = 48-65 % of the width, MS 26 %, office WS 9 %. SPAN = the short side in head diameters; HEADY = where the head's
// centre sits from the top of the frame (0..1): always above the captions (centred at 70.5 % of the height).
const SPAN = { ecu: .78, cu: 1.75, mcu: 2.5, ms: 3.7, mws: 5.2, ws: 9, ews: 26, aerial: 60 };
const HEADY = { ecu: .44, cu: .4, mcu: .36, ms: .32, mws: .33, ws: .4, ews: .46, aerial: .5 };
// non-character subjects: the short side as a multiple of the object's size, centred at 45 %
const OBJSPAN = { ecu: .45, cu: .85, mcu: 1.2, ms: 1.7, mws: 2.4, ws: 4.2, ews: 11, aerial: 26 };
export const FRAMINGS = Object.keys(SPAN);

/** subject -> { c: centre Vector3, h: size (m), yaw: facing } for an actor, an Object3D, a point [x,y,z] or a Vector3 */
export function subjectOf(s, t) {
  if (!s) return { c: new THREE.Vector3(0, .9, 0), h: 1.6, yaw: 0, head: .5 };
  if (s.toon) { s.root.updateMatrixWorld(true); const h = s.toon.height, p = s.root.position, hp = s.toon.headPos();
    return { c: new THREE.Vector3(p.x, p.y, p.z), top: hp.y + s.toon.B.head, h, yaw: s.root.rotation.y, head: s.toon.B.head * 2, actor: s }; }
  if (s.isObject3D) { const b = new THREE.Box3().setFromObject(s), c = b.getCenter(new THREE.Vector3()), z = b.getSize(new THREE.Vector3()); return { c: new THREE.Vector3(c.x, b.min.y, c.z), top: b.max.y, h: Math.max(.05, z.y, Math.max(z.x, z.z) * .8), yaw: s.rotation?.y || 0, head: z.y * .3 }; }
  const v = s.isVector3 ? s : new THREE.Vector3(...s); return { c: new THREE.Vector3(v.x, v.y - .3, v.z), top: v.y + .3, h: .6, yaw: 0, head: .3 };
}
/** a framing -> { p (camera), l (look-at), fov, focus }. o: { on, frame (name | frame height in m), side (deg around the
 *  subject from its facing), yaw (absolute deg), height (deg above), zoom (x distance), place: [x, y] (-1..1 shift of the
 *  subject in the frame), offset: [x, y, z] (m, added to the look-at), fov, roll } */
export function framing(S, o, t) {
  const sub = subjectOf(o.on, t), fr = o.frame || 'ms', fov = o.fov ?? (fr === 'ecu' || fr === 'cu' ? 34 : 40);
  const aspect = S?.aspect || .5625, short = aspect < 1 ? aspect : 1;          // frame height = short side / short
  let hFrame, headY, aim;
  if (typeof fr === 'number' || !isNaN(+fr)) { hFrame = +fr; headY = sub.actor ? .38 : .5; }
  else if (sub.actor) { hFrame = (SPAN[fr] ?? 3.7) * sub.head / short; headY = HEADY[fr] ?? .36; }
  else { hFrame = (OBJSPAN[fr] ?? 1.7) * sub.h / short; headY = .45; }
  const d = (hFrame / 2) / Math.tan(fov * Math.PI / 360) * (o.zoom ?? 1);
  const yaw = (o.yaw != null ? o.yaw * Math.PI / 180 : sub.yaw + (o.side ?? 0) * Math.PI / 180), el = (o.height ?? (fr === 'aerial' ? 70 : fr === 'ews' ? 18 : 6)) * Math.PI / 180;
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el));
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize(), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  // the head (or the object's centre) lands at headY from the top of the frame: the look-at point is shifted along the camera's up
  if (sub.actor) aim = sub.actor.toon.headPos(); else aim = new THREE.Vector3(sub.c.x, sub.c.y + sub.h * .5, sub.c.z);
  const hVis = hFrame * (o.zoom ?? 1);
  const l = aim.clone().addScaledVector(up, -(.5 - headY) * hVis).add(new THREE.Vector3(...(o.offset || [0, 0, 0])));
  const p = dir.clone().multiplyScalar(d).add(l);
  // o.place = [x, y] in -1..1 of the frame moves the subject (x right, y up)
  if (o.place) { const wH = hVis / 2; l.addScaledVector(right, -o.place[0] * wH * aspect).addScaledVector(up, -o.place[1] * wH); p.addScaledVector(right, -o.place[0] * wH * aspect).addScaledVector(up, -o.place[1] * wH); }
  return { p, l, fov, focus: d, roll: o.roll ?? 0 };
}
/** the reveal pull-out: a few frames of ease-in, speed peak at ~27 %, half done at ~32 %, a long expo-like decay (measured:
 *  _sUAX peak at 25-35 %, PL 50 % done at 25 %, 97 % at 65 %) */
export const E_REVEAL = k => (1 - Math.pow(2, -10 * k * k)) / (1 - Math.pow(2, -10));
// evaluate an actor at another time (pure), run fn, put it back where the frame had it
function probe(sub, t, fn) {
  if (!sub?.toon || typeof sub.update !== 'function') return fn();
  const last = sub._lastT; sub.update(t); sub.root.updateMatrixWorld(true);
  const r = fn(); if (last != null) { sub.update(last); sub.root.updateMatrixWorld(true); }
  return r;
}
const lerpF = (a, b, k) => ({ p: a.p.clone().lerp(b.p, k), l: a.l.clone().lerp(b.l, k), fov: lerp(a.fov, b.fov, k), focus: lerp(a.focus, b.focus, k), roll: lerp(a.roll || 0, b.roll || 0, k) });
/** a zoom between two framings in log space (the measured pushes and pull-outs run steady in log-zoom): the look-at moves
 *  linearly, the direction turns, the distance changes geometrically */
function zoomF(a, b, k) {
  const da = a.p.distanceTo(a.l), db = b.p.distanceTo(b.l), d = da * Math.pow(db / da, k);
  const dir = a.p.clone().sub(a.l).normalize().lerp(b.p.clone().sub(b.l).normalize(), k).normalize(), l = a.l.clone().lerp(b.l, k);
  return { p: l.clone().addScaledVector(dir, d), l, fov: lerp(a.fov, b.fov, k), focus: d, roll: lerp(a.roll || 0, b.roll || 0, k) };
}
function dolly(f, k) { const d = f.p.clone().sub(f.l); return { ...f, p: f.l.clone().add(d.multiplyScalar(k)), focus: f.focus * k }; }

/** S.camera(kind, o): returns the rig function. Times inside are shot-relative unless absolute `at` is given. */
export function cameraRig(S, spec) {
  const o = typeof spec === 'string' ? { kind: spec } : spec;
  const kind = o.kind || 'creep';
  const t0 = () => S.t0, t1 = () => S.t1;
  const creep = o.creep ?? .06;                      // fraction of the distance closed per second while "holding"
  const drift = o.drift ?? 1;
  const apply = (cam, f, t) => {
    // handheld-free micro drift: a tiny slow wander so a hold is never a freeze (well under a pixel per frame)
    const n = (t - S.t0) * .35, amp = .004 * drift * f.focus;
    const p = f.p.clone().add(new THREE.Vector3(fbm1(n, 3) * amp, fbm1(n, 7) * amp * .6, 0));
    cam.position.copy(p); cam.up.set(0, 1, 0); cam.lookAt(f.l); if (f.roll) cam.rotateZ(f.roll * Math.PI / 180);
    if (cam.fov !== f.fov) { cam.fov = f.fov; cam.updateProjectionMatrix(); }
    S._focus = f.focus; S._focusAt = f.l;
  };
  const reacts = (o.react ? [].concat(o.react) : []);
  const reactK = t => { let k = 1; for (const r of reacts) { const a = r.at ?? r, amt = r.amt ?? .3, up = (r.frames ?? 19) * F, back = 11 * F;
      // measured (_sUAX): 1.00 -> 1.30 in ~19 frames (peak ~2 %/frame mid-move, a sine), then back 4 % over ~11 frames
      if (t < a) continue; const u = E.inOutSine(seg(t, a, a + up)), v = E.inOutSine(seg(t, a + up, a + up + back)); k *= 1 / (1 + amt * u - amt * .15 * v); } return k; };
  // into: the push that carries the shot into the next transition (cubicIn, speed peaks ON the cut at ~3 %/frame; measured
  // 19-60 frames, 3-5 %/frame on the transition frame)
  const intoK = t => { if (!o.into) return 1; const d = typeof o.into === 'number' ? o.into : clamp((S.t1 - S.t0) * .6, 19 * F, 1.2); const u = seg(t, S.t1 - d, S.t1 + .12); return 1 - (o.intoAmt ?? .42) * u * u * u; };
  if (kind === 'keys') {
    const keys = o.keys.map(k => ({ ...k, p: new THREE.Vector3(...k.p), l: new THREE.Vector3(...k.l), fov: k.fov ?? 40 }));
    const ez = easeFn(o.ease || 'inOutCubic');
    return (cam, t) => {
      let i = 0; while (i + 1 < keys.length && t >= keys[i + 1].t) i++;
      const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], k = b === a ? 0 : ez(seg(t, a.t, b.t));
      const f = { p: a.p.clone().lerp(b.p, k), l: a.l.clone().lerp(b.l, k), fov: lerp(a.fov, b.fov, k), focus: 0, roll: lerp(a.roll || 0, b.roll || 0, k) };
      f.focus = o.focus ?? f.p.distanceTo(f.l); apply(cam, f, t);
    };
  }
  if (kind === 'fly') {   // a smooth path of camera points with a look-at path (fly-throughs, aerial sweeps)
    const P = new THREE.CatmullRomCurve3(o.path.map(p => new THREE.Vector3(...p)), false, 'centripetal'), Lp = o.look?.length > 1 ? new THREE.CatmullRomCurve3(o.look.map(p => new THREE.Vector3(...p)), false, 'centripetal') : null;
    const ez = easeFn(o.ease || 'inOutSine'), a = () => o.from ?? S.t0, b = () => o.to ?? S.t1;
    return (cam, t) => { const k = ez(seg(t, a(), b())); const p = P.getPointAt(k), l = Lp ? Lp.getPointAt(k) : new THREE.Vector3(...(o.look?.[0] || [0, 1, 0]));
      apply(cam, { p, l, fov: o.fov ?? 40, focus: o.focus ?? p.distanceTo(l), roll: o.roll ?? 0 }, t); };
  }
  // the subject is framed where it is at the lock time (default: the shot's start), never re-aimed at every head bob: the
  // studied cameras move on their own curves. o.follow: true re-solves the framing every frame (track / follow always do).
  const memo = new Map();
  const at = (oo, lockT, t) => {
    if (o.follow === true) return framing(S, oo, t);
    const key = JSON.stringify([oo.frame, oo.side, oo.height, oo.yaw, oo.zoom, oo.place, oo.offset, lockT, oo.on === o.on ? 0 : 1]);
    if (!memo.has(key)) memo.set(key, probe(oo.on, lockT, () => framing(S, oo, lockT)));
    const f = memo.get(key), r = { p: f.p.clone(), l: f.l.clone(), fov: f.fov, focus: f.focus, roll: f.roll };
    // a walking / moving subject is kept in frame along its smooth floor path (never its bob, hops or jolts); static stays put
    if (kind !== 'static' && o.follow !== false && oo.on?.toon && typeof oo.on._posAt === 'function') {
      const a = oo.on._posAt(lockT), b = oo.on._posAt(t), d = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z); r.p.add(d); r.l.add(d); }
    return r;
  };
  const lock = o.lockAt ?? S.t0;
  return (cam, t) => {
    const A = kind === 'track' || kind === 'follow' ? framing(S, { ...o, frame: o.from || o.frame || 'ms' }, t) : at({ ...o, frame: o.from || o.frame || 'ms' }, lock, t);
    let f = A;
    if (kind === 'push' || kind === 'pull' || kind === 'reveal' || kind === 'move') {
      const a = o.at ?? S.t0, d = o.dur ?? (kind === 'reveal' || kind === 'pull' ? 1.6 : Math.max(.5, S.t1 - a));
      const B = at({ ...o, ...(o.end || {}), frame: o.to || (kind === 'push' ? 'cu' : 'ws') }, o.lockAt ?? Math.min(S.t1, a + d), t);
      const ez = easeFn(o.ease || (kind === 'reveal' || kind === 'pull' ? E_REVEAL : 'inOutSine'));
      f = zoomF(A, B, ez(seg(t, a, a + d)));
      if (kind === 'reveal' || kind === 'pull') f.l.y += .08 * f.focus * E.outCubic(seg(t, a, a + d)) * (o.tilt ?? 1);
    } else if (kind === 'orbit') {
      const deg = o.deg ?? 30, ez = easeFn(o.ease || 'inOutSine'), k = ez(seg(t, o.at ?? S.t0, (o.at ?? S.t0) + (o.dur ?? S.t1 - S.t0)));
      const B = at({ ...o, frame: o.frame || 'ms' }, lock, t), C = at({ ...o, frame: o.frame || 'ms', side: (o.side ?? 0) + deg }, lock, t);
      const piv = B.l, r0 = B.p.clone().sub(piv), ang = (C.p.clone().sub(piv).angleTo(r0) || deg * Math.PI / 180) * Math.sign(deg) * k;
      f = { ...B, p: r0.applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).add(piv) };
    } else if (kind === 'pan') {      // re-aim: from subject A to subject B (o.toward = actor/object/point) in 16-20 frames, cubicOut
      const a = o.at ?? S.t0 + .4, d = o.dur ?? 18 * F;
      const B = at({ ...o, on: o.toward || o.on2, frame: o.frame2 || o.frame || 'ms' }, o.lockAt ?? a, t);
      f = lerpF(A, B, E.outCubic(seg(t, a, a + d)));
    } else if (kind === 'crane') {
      const k = easeFn(o.ease || 'inOutSine')(seg(t, o.at ?? S.t0, (o.at ?? S.t0) + (o.dur ?? S.t1 - S.t0)));
      const B = at({ ...o, height: o.height2 ?? 40, frame: o.frame2 || o.frame || 'ms' }, lock, t); f = lerpF(A, B, k);
    } else if (kind === 'track') {    // follow an actor sideways as it walks (the framing is re-solved every frame)
      f = framing(S, { ...o, frame: o.frame || 'ms', yaw: o.yaw ?? 90 }, t);
    } else if (kind === 'follow') {   // keep a moving thing in frame: the look point catches up (expoOut feel)
      const lag = o.lag ?? .12, tgt = o.follow || o.on, pos = s => tgt?.toon ? (() => { const p = tgt._posAt(s); return new THREE.Vector3(p.x, p.y, p.z); })() : subjectOf(tgt, s).c;
      const look = pos(t).lerp(pos(t - lag), .35); look.y += (tgt?.toon ? tgt.toon.height * .6 : subjectOf(tgt, t).h * .5);
      f = { ...A, l: A.l.clone().lerp(look, o.mix ?? .85) };
    }
    if (kind !== 'push' && kind !== 'reveal' && kind !== 'pull' && kind !== 'static') f = dolly(f, creepAt(t, S, creep));
    if (kind === 'reveal' || kind === 'pull') { const end = (o.at ?? S.t0) + (o.dur ?? 1.6); if (t > end + .4) f = dolly(f, 1 - creep * .5 * E.inOutSine(seg(t, end + .4, S.t1))); }
    f = dolly(f, reactK(t) * intoK(t));
    apply(cam, f, t);
  };
  void t0; void t1;
}
/** the hold's creep: the distance shrinks ~creep per second, at most 35 %. Linear through t0: the references' shots
 *  ARRIVE moving (the incoming half of a dissolve, before t0, is already creeping in), and a loop shot (times before the
 *  opening's t0) creeps INTO the opening's first framing so the loop point is seamless. */
function creepAt(t, S, creep) {
  const x = t - S.t0;
  return 1 - Math.max(-.35, Math.min(.35, creep * x));
}

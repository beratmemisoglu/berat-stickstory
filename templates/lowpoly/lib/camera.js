// Camera language of the style: it ALWAYS moves. Presets frame a subject (an actor, an object, a point) and move at a
// constant speed through the whole shot (so a loop shot can run the opening move backwards in time):
//   push (slow push-in, the default) | drift (sideways) | orbit | dutch (tilted push) | low (ground level) | high |
//   face (wide-lens close-up) | insert (macro on a prop, dutch) | pov (first person from an actor's eyes) |
//   topdown (straight down, slow turn) | track (alongside a walking actor) | pull (fast 10-frame pull-out from an insert to a wide) |
//   follow (behind) | keys: [{ t, p, l, fov, roll }]
import { THREE, clamp, lerp, seg, E, noise1, SETTINGS, MOODY, VERT, RW, RH } from './core.js';

const v3 = a => a?.isVector3 ? a.clone() : Array.isArray(a) ? new THREE.Vector3(a[0], a[1] ?? 0, a[2] ?? 0) : new THREE.Vector3();
/** the box of what the camera frames, live at time t (actors move) */
export function subjectBox(on) {
  if (!on) return new THREE.Box3(new THREE.Vector3(-.5, 0, -.5), new THREE.Vector3(.5, 1.8, .5));
  if (on.isBox3) return on.clone();
  if (Array.isArray(on) || on.isVector3) { const p = v3(on); return new THREE.Box3(p.clone().sub(new THREE.Vector3(.25, .25, .25)), p.clone().add(new THREE.Vector3(.25, .25, .25))); }
  if (on.box) return on.box();
  if (on.isObject3D) { on.updateMatrixWorld(true); return new THREE.Box3().setFromObject(on); }
  return new THREE.Box3(new THREE.Vector3(-.5, 0, -.5), new THREE.Vector3(.5, 1.8, .5));
}
const headingOf = on => on?.root ? on.root.rotation.y : on?.isObject3D ? on.rotation.y : 0;
const HEAD = on => on?.head ? on.head() : null;

/** Build the per-frame camera function for a shot. def: { kind, on, ...options }. Returns (cam, t) => void */
export function cameraRig(S, spec) {
  if (Array.isArray(spec)) return keysRig(spec);
  const o = typeof spec === 'string' ? { kind: spec } : { ...spec };
  const kind = o.kind || 'push', t0 = S.t0, dur = Math.max(.5, (S.t1 ?? t0 + 2) - t0);
  const push = o.push ?? SETTINGS.camera?.push ?? .05, shake = o.shake ?? SETTINGS.camera?.shake ?? 0;
  const baseFov = o.fov ?? ({ face: MOODY ? 42 : 72, insert: 50, pov: 68, wide: 50, topdown: 50, low: 64 }[kind] ?? (MOODY ? 42 : 56));
  const fill = o.fill ?? (S.def?.split ? .4 : null) ?? ({ face: .74, insert: .62, wide: .45, full: .82, topdown: .6, low: .7 }[kind] ?? .74);   // subject height / frame height
  const side = (o.side ?? (kind === 'face' ? 12 : 26)) * Math.PI / 180;
  const roll0 = (o.dutch ?? (kind === 'dutch' ? 16 : kind === 'insert' ? 14 : 0)) * Math.PI / 180;
  const dist0 = (box, fov) => { const s = box.getSize(new THREE.Vector3()), h = Math.max(s.y, (VERT ? s.x / (RW / RH) : s.x / (RW / RH)) * .9, .12);
    return h / fill / 2 / Math.tan(fov * Math.PI / 360) + s.z * .5; };
  let base = null;                                                         // framing fixed at the shot start (the subject's place then)
  // a face close-up frames the head (it used to frame the whole body: a 'face' shot came out a full figure 3-6 m away)
  const faceBox = a => { const s = a.scale || 1; return new THREE.Box3().setFromCenterAndSize(a.head().sub(new THREE.Vector3(0, .05 * s, 0)), new THREE.Vector3(.26, .34, .26).multiplyScalar(s)); };
  return (cam, t) => {
    const k = (t - t0);                                                    // seconds into the shot (not clamped: moves continue)
    const on = o.on, live = kind === 'face' && on?.head ? faceBox(on) : subjectBox(on), b = base ?? (base = live.clone());
    const c = (kind === 'track' || kind === 'follow' ? live : b).getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
    let look = o.look ? v3(o.look) : c.clone(); if (!o.look && on?.head && (kind === 'face')) look = HEAD(on);
    if (!o.look && on?.root && kind !== 'face' && kind !== 'topdown') look.y = b.min.y + size.y * (fill > .6 ? .56 : .62);
    const yaw0 = (o.yaw != null ? o.yaw * Math.PI / 180 : headingOf(on) + side);
    let fov = baseFov, roll = roll0, pos;
    if (kind === 'topdown') {
      const d = dist0(new THREE.Box3().setFromCenterAndSize(c, new THREE.Vector3(size.x, Math.max(size.x, size.z), size.z)), fov) * (1 - push * k * .8);
      const a = yaw0 + k * (o.turn ?? 6) * Math.PI / 180; pos = c.clone().add(new THREE.Vector3(0, d, 0)); cam.position.copy(pos); cam.up.set(Math.sin(a), 0, Math.cos(a)); cam.lookAt(c);
      cam.up.set(0, 1, 0); finish(cam, fov, 0, t); return;
    }
    if (kind === 'pov') {
      const eye = o.from?.head ? o.from.head().add(new THREE.Vector3(0, -.04, 0)) : v3(o.from || [0, 1.55, 0]);
      const tgt = o.look ? v3(o.look) : c; const dir = tgt.clone().sub(eye).normalize();
      pos = eye.clone().add(dir.clone().multiplyScalar(.1 + push * k * .5)); pos.x += Math.sin(k * .7) * .01; pos.y += Math.sin(k * 1.1) * .006;
      cam.position.copy(pos); cam.lookAt(tgt.clone().add(new THREE.Vector3(Math.sin(k * .5) * .03, 0, 0))); finish(cam, fov, roll0 || .05, t); return;
    }
    let d = o.dist ?? dist0(b, fov), elev = o.height != null ? null : ({ low: -.12, high: .55, face: .02, insert: .45, wide: .18 }[kind] ?? .12);
    if (kind === 'face' && !o.look) look.y -= 2 * d * Math.tan(fov * Math.PI / 360) * (o.headY ?? (VERT ? .12 : .06));   // the face sits above the caption band (a caption on the mouth hid the expression)
    let yaw = yaw0;
    if (kind === 'pull') {                                                 // fast pull-out (10 frames) from an insert to the wide
      const at = o.at ?? t0 + Math.min(.6, dur * .3), q = E.inOutCubic(seg(t, at, at + (o.pullDur ?? 10 / 30)));
      const near = o.from ? subjectBox(o.from) : new THREE.Box3().setFromCenterAndSize(look, size.clone().multiplyScalar(.25));
      const nc = near.getCenter(new THREE.Vector3()), nd = dist0(near, fov) * .9;
      look = nc.clone().lerp(look, q); d = lerp(nd, d * (1 - push * Math.max(0, k - .6)), q); elev = lerp(.25, elev, q); roll = lerp(roll0 || .12, 0, q);
    } else d *= 1 - push * k * (kind === 'drift' || kind === 'orbit' ? .5 : 1);
    if (kind === 'orbit') yaw += k * (o.speed ?? 9) * Math.PI / 180 * (o.dir ?? 1);
    if (kind === 'dutch' || kind === 'insert') roll = roll0 + k * .012 * Math.sign(roll0 || 1);
    const h = o.height ?? (look.y + d * (elev ?? 0));
    pos = new THREE.Vector3(look.x + Math.sin(yaw) * d, h, look.z + Math.cos(yaw) * d);
    if (kind === 'low') pos.y = o.height ?? .22;
    if (kind === 'drift' || kind === 'push' || kind === 'face' || kind === 'dutch' || kind === 'insert' || kind === 'wide' || kind === 'high' || kind === 'low') {
      const lat = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), sp = kind === 'drift' ? (o.speed ?? .14) : (o.drift ?? .035);
      pos.add(lat.multiplyScalar(sp * k * (o.dir ?? 1)));
    }
    if (kind === 'track') { const hd = headingOf(on); const lat = new THREE.Vector3(Math.cos(hd), 0, -Math.sin(hd)); pos = c.clone().add(lat.multiplyScalar((o.dist ?? d) * (o.dir ?? 1))); pos.y = o.height ?? .6; look = c.clone().add(new THREE.Vector3(Math.sin(hd), 0, Math.cos(hd)).multiplyScalar(.15)); look.y = c.y + .1; }
    if (kind === 'follow') { const hd = headingOf(on); pos = c.clone().add(new THREE.Vector3(-Math.sin(hd), 0, -Math.cos(hd)).multiplyScalar(o.dist ?? d)); pos.y = o.height ?? 1.7; look = c.clone().add(new THREE.Vector3(Math.sin(hd), 0, Math.cos(hd)).multiplyScalar(2)); look.y = 1.3; }
    if (o.offset) pos.add(v3(o.offset));
    cam.position.copy(pos); cam.lookAt(look); finish(cam, fov, roll, t);
    function finish(cm, f, r, tt) {
      if (r) cm.rotateZ(r);
      if (shake) { cm.rotateX(noise1(tt * 2.1, 3) * shake * .02); cm.rotateY(noise1(tt * 1.7, 7) * shake * .02); }
      if (cm.fov !== f) { cm.fov = f; cm.updateProjectionMatrix(); }
    }
  };
}
function keysRig(K) {
  K = K.map(k => ({ ...k }));
  return (cam, t) => {
    let a = K[0], b = K[0]; for (let i = 0; i < K.length; i++) if (t >= K[i].t) { a = K[i]; b = K[i + 1] || K[i]; }
    if (t < K[0].t) a = b = K[0];
    const k = b === a ? 0 : (b.ease || E.inOutSine)(seg(t, a.t, b.t)), drift = b === a ? (t - a.t) : 0;
    const p = v3(a.p).lerp(v3(b.p), k), l = v3(a.l).lerp(v3(b.l), k);
    p.add(p.clone().sub(l).normalize().multiplyScalar(-drift * .04));     // the last key keeps creeping in
    cam.position.copy(p); cam.lookAt(l);
    const r = lerp(a.roll ?? 0, b.roll ?? a.roll ?? 0, k); if (r) cam.rotateZ(r * Math.PI / 180);
    const fov = lerp(a.fov ?? 50, b.fov ?? a.fov ?? 50, k); if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  };
}

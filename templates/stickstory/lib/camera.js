// The camera of the cut-out theatre: a long lens looking straight at the layered cards (toward -z), framed on a subject
// by NAMED FRAMINGS measured on the references, moved by the references' moves (experiments/stickstory-style/analysis/
// camera/NOTES.md, BUILD IMPLICATIONS). The picture is letterboxed 2.0:1 (1920 x 960 inside 1080): framings are measured
// against the PICTURE, not the full frame.
//
// What the references do (24 fps): close-ups and inserts never move (static); wides and mediums often get a short
// "nudge" (zoom 1.00 -> 1.03 over 40 frames, 4 frames after the cut, then a full stop); big pushes only on emotion or a
// threat; never a roll, never a shake, never a rack focus; background blur grows with the shot size.
//
//   S.camera('auto', { on, frame })      the default: static for ecu / cu / mcu, a nudge for wider framings
//   S.camera('static' | 'nudge' | 'nudgeOut' | 'push' | 'pushBig' | 'threat' | 'stepPush' | 'punch' | 'crash'
//            | 'pullReveal' | 'pushInto' | 'zoomThrough' | 'truck' | 'pan' | 'linearPan' | 'tilt' | 'keys', { ... })
// Common options: on (actor | prop | [x, y, z]), frame ('ecu' | 'cu' | 'mcu' | 'ms' | 'mls' | 'ls' | 'ws' | 'vws' | 'ews'
// or { h: picture height in metres }), x (subject's horizontal place: -.5 .. .5 of the picture width, 0 = centred),
// y (vertical shift, fraction of the picture height), at (start time), dur (seconds), amount, ease.
import { THREE, SETTINGS, FPS, E, clamp, lerp, seg, easeFn, V3 } from './core.js';

const F = 1 / FPS;
export const PICTURE = 960 / 1080;            // the letterboxed picture's share of the frame height (2.0:1 in 16:9)
// framings: k = picture height in head diameters, top = where the top of the head sits (fraction of the picture from its top)
export const FRAMES = {
  ecu: { k: 1.22, top: .09 }, cu: { k: 2.7, top: .26 }, mcu: { k: 3.6, top: .28 }, ms: { k: 4.76, top: .31 },
  mls: { k: 6.3, top: .34 }, ls: { k: 7.6, top: .36 }, full: { k: 7.6, top: .36 }, ws: { k: 10, top: .3 }, vws: { k: 14, top: .36 }, ews: { k: 22, top: .4 },
};
const CLOSE = new Set(['ecu', 'cu', 'mcu']);
// The lens per framing. The references are 2D: a close-up shows the room behind at about the wide shot's scale (just
// blurred), while a long lens dollied in would magnify the back wall ~2x. A wider field of view on close shots keeps the
// background near its wide-shot size (camera nearer the subject, the wall relatively farther): fov by picture size in heads.
const FOV_KEYS = [[1.22, 52], [2.7, 46], [3.6, 38], [4.76, 31], [6.3, 26], [7.6, 24], [10, 22]];
export function fovFor(heads) {
  if (heads <= FOV_KEYS[0][0]) return FOV_KEYS[0][1];
  for (let i = 1; i < FOV_KEYS.length; i++) if (heads <= FOV_KEYS[i][0]) { const [h0, f0] = FOV_KEYS[i - 1], [h1, f1] = FOV_KEYS[i]; return lerp(f0, f1, Math.log(heads / h0) / Math.log(h1 / h0)); }
  return FOV_KEYS[FOV_KEYS.length - 1][1];
}
const distFor = (fov, frameH) => frameH / 2 / Math.tan(fov * Math.PI / 360);
const ADULT_D = 1.7 / 5.45;                    // an adult's head diameter (characters NOTES: 5.3-5.6 heads tall)

/** where a subject is: { x, y (head centre or object centre), z, d (head diameter or null), top, actor } */
export function subjectOf(on) {
  if (typeof on === 'function') on = on();
  if (!on) return { x: 0, y: 1.2, z: 0, d: ADULT_D, actor: null };
  // the head as DRAWN: close-ups draw it ~1.3x (anim.js headScale), and the framings were measured on the drawn head
  if (on.isActor || (on.head && on.root)) { const h = on.head(); const kH = on.headScale ?? (on.S?._closeUp ? 1.3 : 1); const d = (on.headR ?? ADULT_D / 2) * 2 * kH; return { x: h.x, y: h.y, z: on.root.position.z, d, actor: on }; }
  if (Array.isArray(on)) return { x: on[0], y: on[1] ?? 1, z: on[2] ?? 0, d: null };
  if (on.isVector3) return { x: on.x, y: on.y, z: on.z, d: null };
  if (on.isObject3D) { const b = new THREE.Box3().setFromObject(on), c = b.getCenter(new THREE.Vector3()); return { x: c.x, y: c.y, z: c.z, d: null, h: Math.max(.05, b.max.y - b.min.y), w: Math.max(.05, b.max.x - b.min.x) }; }
  if (typeof on === 'object' && 'x' in on) return { x: on.x, y: on.y ?? 1, z: on.z ?? 0, d: null };
  return { x: 0, y: 1.2, z: 0, d: ADULT_D, actor: null };
}
/** the picture height (metres at the subject's depth) a framing gives for this subject */
export function pictureH(s, frame) {
  if (typeof frame === 'number') return frame;
  if (frame && typeof frame === 'object') return frame.h ?? 1.5;
  const f = FRAMES[frame] ?? FRAMES.ms;
  if (s.d) return f.k * s.d;
  // a thing: fit it (with room) in the picture; named framings on a thing scale from an adult head
  if (s.h) return Math.max(s.h * 1.6, s.w ? s.w * 1.6 / (16 / 9 * PICTURE) : 0, f.k * ADULT_D * .5);
  return f.k * ADULT_D;
}
/**
 * A camera pose for a framing: { pos, look, focus, picH }.
 *   x: the subject's place across the picture (-.5 .. .5), y: extra vertical shift (fraction of the picture, + = subject higher)
 */
export function framing(cam, on, frame = 'ms', o = {}) {
  const s = subjectOf(on), picH = pictureH(s, frame) / (o.zoom ?? 1), frameH = picH / PICTURE;
  const fov = o.fov ?? (SETTINGS.camera?.fixedFov ? cam.fov : fovFor(picH / (s.d || ADULT_D))), d = distFor(fov, frameH);
  const f = typeof frame === 'string' ? FRAMES[frame] : null;
  let cy;
  if (s.d && f) { const headTopY = s.y + s.d / 2; cy = headTopY - (.5 - f.top) * picH; }   // the head top lands at `top`
  else cy = s.y;
  cy -= (o.y ?? 0) * picH;
  const aspect = cam.aspect, cx = s.x - (o.x ?? 0) * picH / PICTURE * aspect;
  const pos = new THREE.Vector3(cx + (o.side ?? 0), cy + (o.height ?? 0), s.z + d), look = new THREE.Vector3(cx, cy, s.z);
  return { pos, look, focus: d, picH, fov };
}
// background blur by shot size (camera NOTES 3.3: sigma @1080 W 0-1.2, M 3, C 5.5; foreground 7-10): the aperture the
// depth of field uses grows as the camera comes closer. Calibrated in lab/dof against reference frames.
export function apertureFor(picH, s) {
  const heads = picH / (s?.d || ADULT_D);
  // (lab/dof against iq500 f784 / f1011 / f4313: ~1 px at a wide, a soft room at a medium, a heavy blur behind a close-up)
  return clamp(1.05 * Math.pow(2.7 / Math.max(1, heads), 1.6), .012, 1.2) * (SETTINGS.post?.dof ?? 1);
}
// the near plane follows the camera's distance to what it looks at (4 %, .05-1.5 m): depth precision grows with near, so
// parts stacked Z.step apart no longer z-fight in far wides (video 02: skylines, clock faces and lit windows strobed at 30-50 m)
const nearFor = P => Math.min(1.5, Math.max(.05, (P.pos && P.look ? P.pos.distanceTo(P.look) : 0) * .04));
const apply = (cam, P, S) => { const nr = nearFor(P), fovCh = P.fov && Math.abs(cam.fov - P.fov) > 1e-4;
  const nearCh = Math.abs(cam.near - nr) > 1e-4; if (fovCh) cam.fov = P.fov; if (nearCh) cam.near = nr; if (fovCh || nearCh) cam.updateProjectionMatrix();
  cam.position.copy(P.pos); cam.lookAt(P.look); if (S) { S._focus = P.focus; S._apAuto = apertureFor(P.picH, S._subj); } };
const lerpP = (A, B, k) => ({ pos: A.pos.clone().lerp(B.pos, k), look: A.look.clone().lerp(B.look, k), focus: lerp(A.focus, B.focus, k), picH: lerp(A.picH, B.picH, k), fov: lerp(A.fov ?? 22, B.fov ?? 22, k) });
// a zoom by z keeps the lens and dollies in (the references' nudges and pushes read as a dolly on the layered sets)
const zoomP = (P, z) => { const q = { pos: P.pos.clone(), look: P.look.clone(), focus: P.focus / z, picH: P.picH / z, fov: P.fov }; q.pos.z = P.look.z + (P.pos.z - P.look.z) / z; return q; };

/** a person as a held camera's subject: the head's height (and its offset from the body) as it was at the shot's first
 *  frame; only the body's travel across and in depth moves the framing. A static camera on someone who bows, nods, kneels
 *  or leans re-aimed at the moving head every frame (video 01 4:08: the whole picture dipped with Poppy's bow). */
function heldSubject(a, t0) {
  let base = null;
  const at0 = () => { if (!base) { const cur = a._raw; a.update(t0); base = { h: a.head().clone(), x: a.root.position.x, z: a.root.position.z }; if (cur != null) a.update(cur); } return base; };
  return { root: { get position() { return { z: a.root.position.z }; } }, get headR() { return a.headR; }, get headScale() { return a.headScale; }, get S() { return a.S; },
    head: () => { const b = at0(), h = b.h.clone(); h.x += a.root.position.x - b.x; return h; } };
}

/** the camera rig of a shot: returns (cam, t) => void */
export function cameraRig(S, spec) {
  let kind = spec.kind || 'auto';
  const on0 = spec.on ?? S.subject ?? S.actors[0], t0 = S.t0, t1 = S.t1 ?? (t0 + 3), dur = Math.max(.2, t1 - t0);
  const frame = spec.frame || 'ms';
  if (kind === 'auto' || kind === 'creep') kind = (typeof frame === 'string' && CLOSE.has(frame)) || dur < 2.2 * .9 ? 'static' : 'nudge';
  const on = on0?.isActor && ['static', 'nudge', 'nudgeOut'].includes(kind) && !spec.follow ? heldSubject(on0, t0) : on0;
  // the framing name, for the characters: close-ups draw the head ~1.3x and sunk into the collar (characters NOTES)
  S._frame = typeof frame === 'string' ? frame : null; S._closeUp = typeof frame === 'string' && CLOSE.has(frame);
  S._subj = subjectOf(on0);                 // (the person itself: a held subject reads its first frame only once built)
  const F0 =(fr = frame, o = {}) => framing(S.cam, o.on ?? on, fr, { x: spec.x, y: spec.y, side: spec.side, height: spec.height, zoom: spec.zoom, ...o });
  const at = spec.at ?? t0, ef = (f, d) => easeFn(f || d);
  // the references' signature nudge: 4 frames after the cut, 1.00 -> 1.03 over 40 frames (quadInOut), then hold; it
  // must end >= 8 frames before the cut (a short shot gets a shorter nudge, >= 24 frames, or none)
  if (kind === 'nudge' || kind === 'nudgeOut') {
    const amt = spec.amount ?? (kind === 'nudgeOut' ? -.025 : .03), a = at + (spec.delay ?? 4 * F);
    const d = Math.min(spec.dur ?? (kind === 'nudgeOut' ? 16 * F : 40 * F), Math.max(0, t1 - 8 * F - a));
    if (d < 24 * F && kind === 'nudge') return (cam, t) => apply(cam, F0(), S);
    return (cam, t) => apply(cam, zoomP(F0(), 1 + amt * ef(spec.ease, kind === 'nudgeOut' ? 'outSine' : 'inOutQuad')(seg(t, a, a + d))), S);
  }
  if (kind === 'static') return (cam, t) => apply(cam, F0(), S);
  if (kind === 'push' || kind === 'pull' || kind === 'pushBig' || kind === 'threat') {
    // push: from one framing to another (from / to); pushBig: +18 % over 3 s (emotion); threat: +42 % over ~3 s
    if (spec.from || spec.to || kind === 'pull') { const A = spec.from ?? (kind === 'pull' ? 'cu' : frame), B = spec.to ?? (kind === 'pull' ? 'ms' : 'cu'), d = spec.dur ?? Math.min(dur, 3);
      return (cam, t) => apply(cam, lerpP(F0(A), F0(B), ef(spec.ease, 'inOutSine')(seg(t, at, at + d))), S); }
    const amt = spec.amount ?? (kind === 'threat' ? .42 : .18), d = spec.dur ?? Math.min(dur, kind === 'threat' ? 3.2 : 3);
    return (cam, t) => apply(cam, zoomP(F0(), 1 + amt * ef(spec.ease, 'inOutSine')(seg(t, at, at + d))), S);
  }
  if (kind === 'stepPush') {               // +4.5 % in 34 frames at each listed time (new dialogue lines), holds between
    const steps = (spec.steps || [at]).slice().sort((a, b) => a - b), amt = spec.amount ?? .045;
    return (cam, t) => { let z = 1; for (const s of steps) z *= 1 + amt * E.inOutSine(seg(t, s, s + 34 * F)); apply(cam, zoomP(F0(), z), S); };
  }
  if (kind === 'punch') {                  // +32 % over 18 frames on a word, then holds
    const amt = spec.amount ?? .32, d = spec.dur ?? 18 * F;
    return (cam, t) => apply(cam, zoomP(F0(), 1 + amt * ef(spec.ease, 'inOutQuart')(seg(t, at, at + d))), S);
  }
  if (kind === 'crash') {                  // from the cut, x1.5 over 10 frames, cubicOut
    const amt = spec.amount ?? .5, d = spec.dur ?? 10 * F;
    return (cam, t) => apply(cam, zoomP(F0(), 1 + amt * E.outCubic(seg(t, at, at + d))), S);
  }
  if (kind === 'pullReveal') {             // hold a detail, then x0.37 over 11 frames (quadOut) to reveal the scene
    const close = spec.from ?? 'cu', wide = spec.to ?? 'ws', d = spec.dur ?? 11 * F;
    return (cam, t) => apply(cam, lerpP(F0(close, { on: spec.detail ?? on }), F0(wide), E.outQuad(seg(t, at, at + d))), S);
  }
  if (kind === 'pushInto' || kind === 'zoomThrough') {   // into a window / eye / screen: x4 over 85 frames (cubicInOut), or x2.7 over 10 frames (quadIn) then cut
    const amt = spec.amount ?? (kind === 'pushInto' ? 4 : 2.7), d = spec.dur ?? (kind === 'pushInto' ? 85 * F : 10 * F), a = spec.at ?? Math.max(t0, t1 - d), tgt = spec.target ?? on;
    return (cam, t) => { const k = (kind === 'pushInto' ? E.inOutCubic : E.inQuad)(seg(t, a, a + d)); const P = F0(frame, { on: tgt }); apply(cam, zoomP(P, lerp(1, amt, k)), S); };
  }
  if (kind === 'truck' || kind === 'follow') {   // keep a walker near the centre; the camera glides (quadInOut catch-up), layers spread by depth
    // (a pure function of t: the camera's x is the walker's x averaged over the last moments with exponential weights,
    // read from the actor's own schedule a.at(t) - never state carried from the frame drawn before)
    const lag = spec.lag ?? .35, who = spec.on ?? S.subject ?? S.actors[0];
    const xAt = tt => who?.at ? who.at(Math.max(t0, tt)).x : subjectOf(who).x;
    return (cam, t) => { const P = F0(spec.frame || 'ls');
      let sw = 0, sx = 0; for (let k = 0; k < 10; k++) { const w = Math.exp(-k * .4); sx += w * xAt(t - k * lag * .4); sw += w; }
      const cur = xAt(t), dx = kind === 'follow' ? sx / sw - cur : 0; P.pos.x += dx; P.look.x += dx; apply(cam, P, S); };
  }
  if (kind === 'pan') {                    // from one subject / point to another (0.5-2.5 s quadInOut), holds at both ends
    const A = spec.from ?? on, B = spec.to ?? on, d = spec.dur ?? 1.2;
    return (cam, t) => apply(cam, lerpP(F0(frame, { on: A }), F0(frame, { on: B }), ef(spec.ease, 'inOutQuad')(seg(t, at, at + d))), S);
  }
  if (kind === 'linearPan') {              // constant drift across the whole shot (2-4 px a frame @960), cut while moving
    const v = (spec.speed ?? 3) / 960;      // fraction of the picture width per frame
    return (cam, t) => { const P = F0(); const dx = v * (t - t0) / F * P.picH / PICTURE * S.cam.aspect * (spec.dir ?? 1); P.pos.x += dx; P.look.x += dx; apply(cam, P, S); };
  }
  if (kind === 'tilt') {                   // tilt reveal: the frame slides up / down by `amount` pictures over 32 frames
    const amt = spec.amount ?? .12, d = spec.dur ?? 32 * F;
    return (cam, t) => { const P = F0(), k = E.inOutQuad(seg(t, at, at + d)), dy = amt * k * P.picH; P.pos.y += dy; P.look.y += dy; apply(cam, P, S); };
  }
  if (kind === 'keys') {                   // keys: [{ t, on, frame, x, y, zoom, ease }]
    const K = (spec.keys || []).slice().sort((a, b) => a.t - b.t);
    return (cam, t) => { if (!K.length) return apply(cam, F0(), S);
      let i = 0; while (i + 1 < K.length && t >= K[i + 1].t) i++;
      const A = K[i], B = K[Math.min(i + 1, K.length - 1)], k = B === A ? 0 : easeFn(B.ease || 'inOutQuad')(seg(t, A.t, B.t));
      apply(cam, lerpP(framing(cam, A.on ?? on, A.frame ?? frame, A), framing(cam, B.on ?? on, B.frame ?? frame, B), k), S); };
  }
  console.warn('unknown camera kind ' + kind + ': using auto');
  return cameraRig(S, { ...spec, kind: 'auto' });
}
void V3;

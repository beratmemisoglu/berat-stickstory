// Motion: every character is a timeline evaluated as a PURE function of time (any frame can be drawn first: seeking,
// stills and the export all agree). Every number below was measured frame by frame on the reference shorts
// (experiments/toon-style/analysis/*/NOTES.md, sections 3, 4 and 8); experiments/toon-style/MOTION.md lists each motion
// with its reference frames and the strip it was verified with.
//  - gestures: 5-6 frame ease-out arcs, NO overshoot, then a dead hold; they land 3-5 frames before the stressed word; the
//    body and head follow through 2-4 frames after the hand stops
//  - holds are dead still: no breathing, no idle sway; life comes from the face, the camera, blinks
//  - expressions swap instantly through 1-2 in-between frames (half lid, closed); shock eyes pop in at 85 % for a frame
//  - walks plant their feet (no sliding): brisk 5-6 frames a step with a rounded bob of ~7 % of the head height, stroll
//    8-9 frames a step with a sink-then-pop bob of ~10 %, scurry 2 frames a step with a +-5 deg rock; starts accelerate
//    over ~9 frames, stops take 7 frames then the body straightens up over 3
//  - a 180 deg turn takes 4 frames; a turn to the camera 6 frames + a 2 frame settle
import { THREE, clamp, lerp, seg, E, easeFn, hash } from './core.js';
import { POSE0, Toon } from './rig.js';

export const FPS = 30, F = 1 / FPS;
/** the gesture ease: an ease-out whose speed peaks in the 2nd frame of 5 (outCubic alone puts half the move in frame 1;
 *  the measured arcs build for a frame, e.g. the stand-up 3,7,10,9,7,6,5,3), no overshoot */
export const EASE_GESTURE = k => E.outCubic(Math.pow(clamp(k), 1.5));
const BODY_CH = ['bob', 'lean', 'roll', 'twist', 'squash', 'px', 'pz', 'nod', 'tilt', 'turn'];
const ARM_CH = ['sh', 'sL', 'sR', 'eL', 'eR', 'wL', 'wR'];
const LEG_CH = ['fyL', 'fyR', 'kL', 'kR'];
const VEC_ARM = ['hL', 'hR', 'pL', 'pR', 'oL', 'oR'], VEC_LEG = ['fL', 'fR'];
const sideOf = s => (s === 'L' || s === 'left') ? 'L' : 'R';
const other = s => s === 'L' ? 'R' : 'L';

// ---------- anchors: body points in arm lengths from the shoulder (x outward), so one pose fits every body ----------
// torso(v, a, out): a point `out` metres off the torso surface at height fraction v, angle a from the front (+ toward this
// arm's side, - across the body). head(a, el, out): off the head sphere, yaw a (+ this arm's side), elevation el (radians).
function anchorsOf(toon) {
  const B = toon.B, T = toon.T, h = B.torso, R = B.head;
  const sh = toon._shoulder('L', POSE0(), 1, 1, new THREE.Vector3()).add(new THREE.Vector3(0, B.leg + h * .45, 0));
  const hc = new THREE.Vector3(0, B.leg + h - .03 + R * .68 + .03, (B.stoop || 0) * .2);
  const A = (x, y, z) => [(x - sh.x) / B.arm, (y - sh.y) / B.arm, (z - sh.z) / B.arm];
  return {
    B, R, h, sh, hc,
    raw: A,
    torso: (v, a, out = .03) => { const y = B.leg + v * h, r = T.R(clamp(v, .02, .98)); return A(Math.sin(a) * (r + out), y, Math.cos(a) * (r * .88 + out)); },
    head: (a, el, out = .05) => { const d = R + out; return A(hc.x + Math.sin(a) * Math.cos(el) * d, hc.y + Math.sin(el) * d, hc.z + Math.cos(a) * Math.cos(el) * d); },
    front: (y, z, x = 0) => A(sh.x + x, sh.y + y, z),             // metres from the shoulder: x outward, y up, z forward
  };
}

// ---------- the pose library: functions of the body's anchors (k), or plain partial poses ----------
// hands: hL/hR [x outward, y up, z forward] in arm lengths; g: grip; p: palm hint; e: elbow out; o: elbow pole [x out, y, z]
const sym = (h, o = {}) => ({ hL: h, hR: h, ...o });
const FULL = new Set(['rest', 'neutral']);         // these reset the whole body (legs, lean, head) when blended to
export const POSES = {
  rest:      k => sym(k.torso(.1, 1.42, .04)),
  neutral:   k => sym(k.torso(.1, 1.42, .04)),
  clasp:     k => sym(k.torso(.28, .12, .05), { gL: 'fist', gR: 'mitt', eL: .35, eR: .35 }),                                // hands clasped at the waist
  behind:    k => sym(k.torso(.32, 2.85, .04), { gL: 'fist', gR: 'mitt', eL: .4, eR: .4, nod: -.03 }),                      // hands clasped behind the back
  hips:      k => sym(k.torso(k.B.waistV + .04, 1.3, .012), { eL: 1.4, eR: 1.4, gL: 'fist', gR: 'fist', pL: [-1, 0, -.2], pR: [-1, 0, -.2] }),
  cross:     k => ({ hL: k.torso(.6, -.72, .11), hR: k.torso(.68, -.8, .07), eL: .35, eR: .35, gL: 'fist', gR: 'fist' }),   // arms crossed
  shrug:     k => sym(k.front(.0, .2, .2), { gL: 'open', gR: 'open', pL: [.3, 1, .2], pR: [.3, 1, .2], oL: [.6, -1, -.1], oR: [.6, -1, -.1], sh: .045, tilt: .08, nod: -.04 }),
  point:     k => ({ hR: k.front(.02, .5, .03), gR: 'point', pR: [0, -1, 0], twist: -.12, lean: .03 }),                         // point forward (right hand)
  pointL:    k => ({ hL: k.front(.02, .5, .03), gL: 'point', pL: [0, -1, 0], twist: .12, lean: .03 }),
  pointUp:   k => ({ hR: k.head(1.05, .62, .2), gR: 'point', pR: [0, 0, 1], oR: [1, -.6, 0], nod: -.12 }),                    // index up beside the head
  pointSide: k => ({ hR: k.front(.06, .1, .5), gR: 'point', pR: [0, -1, 0], turn: -.3, twist: -.08 }),
  pointBack: k => ({ hR: k.front(.12, -.22, .2), gR: 'point', pR: [1, 0, 0], twist: .2, turn: -.45 }),                        // thumb over the shoulder
  wave:      k => ({ hR: k.head(1.35, .25, .17), gR: 'open', pR: [0, 0, 1], oR: [1, -1, 0] }),
  think:     k => ({ hR: k.head(-.12, -.82, .05), gR: 'fist', pR: [0, 0, -1], eR: .6, hL: k.torso(.6, -.55, .09), gL: 'mitt', eL: .2, tilt: .12, nod: .05 }),  // hand to the chin
  head:      k => sym(k.head(1.42, .35, .03), { gL: 'open', gR: 'open', eL: 1, eR: 1, oL: [1, -.3, -.2], oR: [1, -.3, -.2] }),     // both hands on the head (panic)
  facepalm:  k => ({ hR: k.head(-.05, .05, .06), gR: 'open', pR: [0, 0, -1], nod: .2 }),
  scratch:   k => ({ hR: k.head(2.2, .55, .05), gR: 'mitt', pR: [-1, 0, -.4], oR: [1, .3, .3], tilt: -.08 }),                   // scratch the back of the head
  celebrate: k => sym(k.head(1.25, .7, .3), { gL: 'fist', gR: 'fist', nod: -.1, bob: .015 }),
  armsUp:    k => sym(k.head(1.3, .7, .3), { gL: 'open', gR: 'open', pL: [0, 0, 1], pR: [0, 0, 1], nod: -.08 }),
  armsOut:   k => sym(k.front(.02, .1, .9), { gL: 'open', gR: 'open', pL: [0, 0, 1], pR: [0, 0, 1] }),                    // "it was THIS big": arms spread
  cower:     k => sym(k.head(.32, .05, .16), { gL: 'open', gR: 'open', pL: [0, 0, 1], pR: [0, 0, 1], lean: -.08, nod: .18, bob: -.03, eL: .5, eR: .5 }),
  present:   k => ({ hR: k.front(-.12, .3, .3), gR: 'open', pR: [.2, 1, .3], turn: -.15 }),                                    // palm up toward something
  presentL:  k => ({ hL: k.front(-.12, .3, .3), gL: 'open', pL: [.2, 1, .3], turn: .15 }),
  hold:      k => sym(k.torso(.45, .3, .2), { gL: 'hold', gR: 'hold' }),                                                     // both hands forward (a box, a tray)
  carry:     k => sym(k.torso(.35, .62, .14), { gL: 'hold', gR: 'hold', pL: [-.3, 1, 0], pR: [-.3, 1, 0] }),                  // both hands under a box
  holdR:     k => ({ hR: k.torso(.38, .45, .15), gR: 'hold' }),
  holdL:     k => ({ hL: k.torso(.38, .45, .15), gL: 'hold' }),
  holdUp:    k => ({ hR: k.head(1.0, .3, .28), gR: 'hold', nod: -.1 }),                                                      // show something up high
  catch:     k => sym(k.front(.05, .45, .12), { gL: 'open', gR: 'open', pL: [-.4, .3, 1], pR: [-.4, .3, 1] }),
  reach:     k => ({ hR: k.front(.2, .48, .1), gR: 'open', pR: [0, -.3, 1], lean: .08 }),
  reachDown: k => ({ hR: k.front(-.42, .3, .05), gR: 'open', pR: [0, -1, 0], lean: .32, nod: .25, bob: -.05 }),
  clap:      k => sym(k.torso(.62, -.08, .19), { gL: 'open', gR: 'open', pL: [-1, 0, 0], pR: [-1, 0, 0] }),
  rub:       k => sym(k.torso(.5, -.06, .17), { gL: 'open', gR: 'open', nod: .05 }),                                        // rubbing hands (scheming)
  thumbsUp:  k => ({ hR: k.torso(.6, .35, .2), gR: 'thumb', pR: [-1, 0, 0] }),
  stop:      k => ({ hR: k.front(.08, .45, .05), gR: 'flat', pR: [0, 0, 1] }),                                                 // palm out: "stop"
  belly:     k => sym(k.torso(.3, .3, .015), { gL: 'open', gR: 'open', pL: [0, 0, -1], pR: [0, 0, -1], nod: .12, lean: .06 }),
  throat:    k => sym(k.torso(.97, .4, .06), { gL: 'open', gR: 'open', pL: [0, 0, -1], pR: [0, 0, -1], nod: -.05 }),
  mouth:     k => ({ hR: k.head(-.05, -.42, .05), gR: 'open', pR: [0, 0, -1] }),                                             // hand over the mouth
  eat:       k => ({ hR: k.head(.05, -.45, .12), gR: 'hold' }),
  phone:     k => ({ hR: k.head(1.5, -.05, .03), gR: 'hold', tilt: -.12 }),                                                   // phone to the ear
  look:      k => ({ hR: k.head(.15, .42, .08), gR: 'flat', pR: [0, -1, 0], nod: -.05 }),                                     // shading the eyes, looking far
  chin:      k => ({ hR: k.head(-.1, -.85, .04), gR: 'fist', pR: [0, 1, 0], tilt: .1 }),
  fists:     k => sym(k.torso(.6, .3, .14), { gL: 'fist', gR: 'fist', pL: [-1, 0, 0], pR: [-1, 0, 0] }),                     // determined fists
  lean:      k => sym(k.torso(.1, 1.42, .04), { lean: .2, nod: -.1 }),
  slouch:    k => sym(k.torso(.12, 1.3, .05), { lean: .12, nod: .18, bob: -.02 }),
  proud:     k => sym(k.torso(k.B.waistV + .04, 1.3, .012), { eL: 1.4, eR: 1.4, gL: 'fist', gR: 'fist', pL: [-1, 0, -.2], pR: [-1, 0, -.2], lean: -.08, nod: -.15 }),
  sneak:     k => sym(k.front(-.18, .25, .14), { gL: 'open', gR: 'open', pL: [0, -1, 0], pR: [0, -1, 0], lean: .3, bob: -.08, nod: -.2 }),
  crouch:    k => sym(k.front(-.3, .2, .08), { lean: .28, bob: -.17, nod: -.12, fL: [.13, 0, .05], fR: [-.13, 0, -.02], fyL: .35, fyR: -.35, kL: .45, kR: .45 }),
  sit:       k => sym(k.torso(.18, .7, .1), { gL: 'mitt', gR: 'mitt', pL: [0, -1, 0], pR: [0, -1, 0] }),                       // seated: hands on the lap (use with sit())
  sitBack:   k => sym(k.torso(.4, 2.2, .1), { lean: -.15, nod: -.08 }),
  sitHead:   k => sym(k.head(.3, .2, .03), { gL: 'open', gR: 'open', lean: .25, nod: .35 }),
  lounge:    k => sym(k.head(2.4, .3, .02), { gL: 'open', gR: 'open', lean: -.15, eL: 1, eR: 1, oL: [1, .5, 0], oR: [1, .5, 0] }),   // hands behind the head
  limp:      k => sym(k.torso(.05, 1.2, .1), { lean: .12, nod: .35, tilt: .2, bob: -.04 }),                                    // asleep standing / exhausted
  drowsy:    k => sym(k.torso(.1, 1.42, .04), { nod: .3, tilt: .1 }),
};
export const poseNames = () => Object.keys(POSES);
// Gestures: a pose + how long the arc takes (frames, outCubic, no overshoot). Loops add a motion on the hold.
export const GESTURES = {
  shrug: { pose: 'shrug', dur: 5 }, point: { pose: 'point', dur: 5 }, pointUp: { pose: 'pointUp', dur: 6 }, pointSide: { pose: 'pointSide', dur: 6 }, pointBack: { pose: 'pointBack', dur: 6 },
  hips: { pose: 'hips', dur: 4 }, cross: { pose: 'cross', dur: 6 }, think: { pose: 'think', dur: 6 }, head: { pose: 'head', dur: 6 }, chin: { pose: 'chin', dur: 5 },
  facepalm: { pose: 'facepalm', dur: 5 }, scratch: { pose: 'scratch', dur: 6, loop: 'scratch' }, celebrate: { pose: 'celebrate', dur: 5 },
  wave: { pose: 'wave', dur: 6, loop: 'wave' }, cower: { pose: 'cower', dur: 4 }, present: { pose: 'present', dur: 6 }, presentL: { pose: 'presentL', dur: 6 }, stop: { pose: 'stop', dur: 4 },
  clap: { pose: 'clap', dur: 4, loop: 'clap' }, rub: { pose: 'rub', dur: 6, loop: 'rub' }, thumbsUp: { pose: 'thumbsUp', dur: 5 }, reach: { pose: 'reach', dur: 4 },
  belly: { pose: 'belly', dur: 6 }, mouth: { pose: 'mouth', dur: 5 }, look: { pose: 'look', dur: 6 }, armsUp: { pose: 'armsUp', dur: 6 }, armsOut: { pose: 'armsOut', dur: 11 },
  throat: { pose: 'throat', dur: 5 }, fists: { pose: 'fists', dur: 4 }, clasp: { pose: 'clasp', dur: 6 }, behind: { pose: 'behind', dur: 7 }, phone: { pose: 'phone', dur: 6 },
  crouch: { pose: 'crouch', dur: 5, back: 6 }, holdUp: { pose: 'holdUp', dur: 6 }, catch: { pose: 'catch', dur: 4 },
};
// expressions in groups: a change between groups is "big" (in-between frames); faces in POP pop in at 85 % for a frame
// (every id in lib/faces/index.json has a group; unknown names count as group 0)
const GROUP = { neutral: 0, calm: 0, bored: 0, thinking: 0, skeptical: 0, sideglance: 0, confused: 0, whistle: 0, attentive: 0,
  happy: 1, smile: 1, laugh: 1, excited: 1, manic: 1, blissful: 1, smug: 1, scheming: 1, wink: 1, love: 1, starstruck: 1, proud: 1, sly: 1, grin: 1,
  annoyed: 2, angry: 2, furious: 2, determined: 2, pout: 2, sad: 3, crying: 3, worried: 3, nervous: 3, embarrassed: 3,
  scared: 4, terrified: 4, panic: 4, shocked: 4, surprised: 4, gape: 4, pain: 5, effort: 5, sick: 5, disgusted: 5, wince: 5,
  sleepy: 6, asleep: 6, drowsy: 6, dizzy: 7, dead: 7 };
const POP = new Set(['shocked', 'surprised', 'terrified', 'panic', 'scared', 'gape', 'starstruck']);
const NOBLINK = new Set(['shocked', 'terrified', 'panic', 'scared', 'gape', 'asleep', 'dead', 'dizzy', 'sleepy', 'manic', 'starstruck']);

function mergePose(base, part) { const o = { ...base }; if (!part) return o; for (const k in part) o[k] = Array.isArray(part[k]) ? part[k].slice() : part[k]; return o; }
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3] ?? 0, b[3] ?? 0, k)];
/** blend two poses: kb = body channels, ka = arms, kl = legs (gestures give the body a 2-4 frame follow-through) */
function blend(a, b, ka, kb = ka, kl = ka) {
  if (ka <= 0 && kb <= 0 && kl <= 0) return a;
  const o = { ...a };
  for (const n of BODY_CH) if (a[n] !== undefined || b[n] !== undefined) o[n] = lerp(a[n] ?? 0, b[n] ?? 0, kb);
  for (const n of ARM_CH) if (a[n] !== undefined || b[n] !== undefined) o[n] = lerp(a[n] ?? 0, b[n] ?? 0, ka);
  for (const n of LEG_CH) if (a[n] !== undefined || b[n] !== undefined) o[n] = lerp(a[n] ?? 0, b[n] ?? 0, kl);
  for (const v of VEC_ARM) { const x = a[v], y = b[v]; if (x && y) o[v] = lerp3(x, y, ka); else if (y && !x) o[v] = ka > .5 ? y : x; else if (x && !y) o[v] = ka < .5 ? x : y; }
  for (const v of VEC_LEG) { const x = a[v], y = b[v]; if (x && y) o[v] = lerp3(x, y, kl); }
  // hands travel on an arc (the studied gestures sweep, they never slide straight through the body)
  for (const v of ['hL', 'hR']) { const x = a[v], y = b[v]; if (!x || !y || ka <= 0 || ka >= 1) continue; const d = Math.hypot(y[0] - x[0], y[1] - x[1], y[2] - x[2]); const arc = Math.sin(Math.PI * ka) * d * .2; o[v] = [o[v][0] + arc * .55, o[v][1], o[v][2] + arc]; }
  for (const g of ['gL', 'gR']) o[g] = ka < .5 ? a[g] : b[g];
  o.fAbs = b.fAbs ?? a.fAbs;
  return o;
}

// ---------- walking ----------
// fps = frames per step (measured), stride: step length (m, regular body), lift: foot lift (m), bob: peak-to-peak of the
// head in head heights, shape: round | pop (sink, pop up at passing) | flat, roll: side rock (rad), swing: arm swing (arm
// lengths), arms: swing | pump | behind | out, lean, duty: the part of a step the foot is in the air
export const WALKS = {
  walk:   { fps: 5.5, stride: .26, lift: .07, bob: .07, shape: 'round', roll: .04, swing: .2, arms: 'swing', lean: .05, duty: .55 },
  brisk:  { fps: 5.5, stride: .26, lift: .07, bob: .07, shape: 'round', roll: .04, swing: .2, arms: 'swing', lean: .05, duty: .55 },
  stroll: { fps: 8.5, stride: .23, lift: .06, bob: .115, shape: 'pop', roll: .035, swing: .14, arms: 'swing', lean: 0, duty: .5 },
  step:   { fps: 7.5, stride: .24, lift: .08, bob: .06, shape: 'round', roll: .03, swing: .12, arms: 'swing', lean: .02, duty: .5 },
  scurry: { fps: 2, stride: .1, lift: .05, bob: 0, shape: 'flat', roll: .09, swing: .14, arms: 'pump', lean: .06, duty: .92 },
  run:    { fps: 4, stride: .46, lift: .14, bob: .08, shape: 'round', roll: .05, swing: .35, arms: 'pump', lean: .2, duty: .62 },
  sneak:  { fps: 10, stride: .18, lift: .09, bob: .03, shape: 'round', roll: .03, swing: .05, arms: 'out', lean: .28, duty: .55, crouch: .08 },
  march:  { fps: 7, stride: .28, lift: .11, bob: .04, shape: 'round', roll: .02, swing: .32, arms: 'swing', lean: -.02, duty: .5 },
  waddle: { fps: 9.5, stride: .17, lift: .07, bob: .02, shape: 'round', roll: .14, swing: .08, arms: 'out', lean: 0, duty: .5, wide: 1.8 },
  dizzy:  { fps: 7, stride: .2, lift: .05, bob: .04, shape: 'round', roll: .09, swing: .1, arms: 'out', lean: 0, duty: .55, sway: .06 },
};
function pathOf(points) {
  const pts = points.map(p => new THREE.Vector3(p[0], 0, p[1] ?? p[2] ?? 0));
  const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal', .5) : new THREE.LineCurve3(pts[0], pts[1] || pts[0]);
  return { curve, len: Math.max(1e-4, curve.getLength()) };
}
// distance along the walk at time t: quadIn start over ta, cruise at v, a 7-frame linear-speed stop (measured)
function walkDist(t, w) {
  const x = clamp(t - w.t0, 0, w.T), { ta, td, v, T, len } = w;
  if (x < ta) return v * x * x / (2 * ta);
  if (x < T - td) return v * (x - ta / 2);
  const r = T - x; return len - v * r * r / (2 * td);
}
const frac = x => x - Math.floor(x);

// ---------- the actor ----------
export class Actor {
  constructor(S, spec, o = {}) {
    this.S = S; this.toon = spec instanceof Toon ? spec : new Toon(spec, o.look || o);
    this.root = this.toon.root; this.root.userData.actor = this;
    this.name = this.toon.name; this.id = this.toon.id;
    this.k = anchorsOf(this.toon);
    this.home = { x: o.at?.[0] ?? 0, z: o.at?.[1] ?? 0, y: o.y ?? 0, ry: o.ry ?? 0 };
    this.base = this._resolve(o.pose || 'rest');
    this.keys = []; this.walks = []; this.turns = []; this.faces = []; this.looks = []; this.lidKeys = []; this.holds = []; this.extras = [];
    this.heads = []; this.hops = []; this.moves = []; this.loops = []; this.acts = []; this.seats = []; this.reaches = []; this.throws = []; this.catches = [];
    this.blinkCfg = null;
    if (o.face) this.face(o.face, -1e3);
    this._memo = new Map(); this._lastT = null; this._probing = false;
  }
  _resolve(p) { const src = typeof p === 'string' ? POSES[p] : p; if (!src) return null; const part = typeof src === 'function' ? src(this.k) : src; return mergePose(POSE0(), part); }
  _part(p) { const src = typeof p === 'string' ? POSES[p] : p; if (!src) return null; const part = typeof src === 'function' ? src(this.k) : src; return FULL.has(p) ? mergePose(POSE0(), part) : part; }
  _dirty() { this._memo.clear(); this._flight = null; }
  // ----- authoring (call in build(S); times in seconds, usually a word's start: S.at('word')) -----
  /** place the character: x, z on the floor, facing ry radians (0 = toward +z, the camera's default side), y = floor height */
  place(x, z, ry = this.home.ry, y = this.home.y) { Object.assign(this.home, { x, z, ry, y }); this._dirty(); return this; }
  /** the starting pose (no animation): a POSES name or a partial pose */
  stand(name) { const r = this._resolve(name); if (r) this.base = r; this._dirty(); return this; }
  /** blend to a pose (name or partial pose) starting at t. o: { dur (s, default 6 frames), ease, follow (frames the body lags) } */
  pose(p, t, o = {}) {
    const target = this._part(p);
    if (!target) { console.warn('unknown pose ' + p); return this; }
    this.keys.push({ t, target, dur: o.dur ?? 6 * F, ease: easeFn(o.ease || 'outCubic'), follow: (o.follow ?? 0) * F, name: typeof p === 'string' ? p : 'custom' });
    this.keys.sort((a, b) => a.t - b.t); this._dirty(); return this;
  }
  /** a gesture that LANDS `early` frames (default 4) before t (the stressed word's start): 5-6 frame outCubic arc, no
   *  overshoot, the body follows 3 frames later, dead hold. o: { dur (frames), early, until (back to rest), back, backDur (frames) } */
  gesture(name, t, o = {}) {
    const g = GESTURES[name] || { pose: name, dur: 6 };
    const dur = (o.dur ?? g.dur) * F, land = t - (o.early ?? 4) * F;
    this.pose(g.pose, land - dur, { dur, ease: o.ease || EASE_GESTURE, follow: o.follow ?? 3 });
    if (g.loop) this.loops.push({ kind: g.loop, t0: land, t1: o.until ?? land + 1.2 });
    if (o.until != null) this.pose(o.back || 'rest', o.until, { dur: (o.backDur ?? g.back ?? 8) * F, ease: g.back ? 'outCubic' : 'inOutCubic', follow: 2 });
    return this;
  }
  /** expression: the new face is fully on at t (through a half-lid + closed frame when the change is big; shock pops).
   *  o: { inbetween: false (instant), pop, tilt (the head roll change a big swap carries, default ~6 deg; 0 = none) } */
  face(name, t = -1e3, o = {}) { this.faces.push({ t, name, ...o }); this.faces.sort((a, b) => a.t - b.t); return this; }
  /** pupils: x right, y up (-1..1) over 2 frames; or look(target, t) at an actor / object / [x,y,z] (tracked every frame) */
  look(x, y, t, o = {}) {
    if (typeof x !== 'number') { o = t || {}; t = y; if (x?.isObject3D) homePoint(x); this.looks.push({ t, target: x, dur: o.dur ?? 2 * F }); }
    else this.looks.push({ t, x, y, dur: o.dur ?? 2 * F });
    this.looks.sort((a, b) => a.t - b.t); return this;
  }
  /** eyelids 0 open .. 1 shut (e.g. sleepy .45) over 4 frames */
  lids(k, t, o = {}) { this.lidKeys.push({ t, k, dur: o.dur ?? 4 * F }); this.lidKeys.sort((a, b) => a.t - b.t); return this; }
  /** idle blinks for a hero in close shots: 3 frames (half, closed, half) every 1.5-4 s; never on shock or asleep faces.
   *  o: { every: [min, max] s, from, to, seed, nervous (every 8-10 frames) } */
  blinks(o = {}) { this.blinkCfg = { every: o.nervous ? [8 * F, 10 * F] : o.every || [1.5, 4], from: o.from ?? -1e9, to: o.to ?? 1e9, seed: o.seed ?? (this.id.length * 7 + 3) }; return this; }
  /** a single blink at t (3 frames) */
  blink(t) { (this._blinks ??= []).push(t); return this; }
  /** turn the head toward a world point / actor / object, or null (back to straight), over 5 frames (outCubic) */
  headTo(target, t, o = {}) { if (target?.isObject3D) homePoint(target); this.heads.push({ t, target, dur: o.dur ?? 5 * F }); this.heads.sort((a, b) => a.t - b.t); return this; }
  /** a head nod as a button on a line: up 4 % of the head in 1 frame, down 6 % over 4, settle over 4 */
  nod(t, o = {}) { this.acts.push({ kind: 'nod', t0: t, t1: t + 9 * F, amt: o.amt ?? 1 }); return this; }
  /** reaction tilt: the head dips and rolls 15-20 deg in 8 frames (sineOut), holds, returns in 8. o: { hold (s), side: 1|-1 } */
  react(t, o = {}) { const hold = o.hold ?? 10 * F; this.acts.push({ kind: 'react', t0: t, t1: t + 16 * F + hold, hold, side: o.side ?? 1, amt: o.amt ?? 1 }); return this; }
  /** turn the body to yaw ry (radians), toward [x, z], an actor or 'camera'. 180 deg in 4 frames; o: { dur (s), settle (frames) } */
  turn(to, t, o = {}) { this.turns.push({ t, to, dur: o.dur, ease: easeFn(o.ease || 'inOutQuad'), settle: o.settle ?? (to === 'camera' ? 2 : 0) }); this.turns.sort((a, b) => a.t - b.t); this._dirty(); return this; }
  /** walk a path of [x, z] points from where it stands, starting at t0 (it turns toward the path first, ending at t0).
   *  o: { style: walk | brisk | stroll | step | scurry | run | sneak | march | waddle | dizzy, speed (m/s), until (t1),
   *  endYaw (rad) | face ('camera' | [x, z] | actor), arms: swing | pump | behind | out | carry } */
  walk(points, t0, o = {}) {
    const st = { ...(WALKS[o.style || 'walk'] || WALKS.walk), ...(o.arms ? { arms: o.arms } : {}) };
    const start = this._posAt(t0), pts = [[start.x, start.z], ...points];
    const P = pathOf(pts), legK = this.toon.B.leg / .6;
    const stride = (o.stride ?? st.stride) * legK, speed = o.speed ?? stride / (st.fps * F);
    let ta = 9 * F, td = 7 * F, T;
    if (o.until != null) T = Math.max(ta + td, o.until - t0); else T = P.len / speed + (ta + td) / 2;
    let v = P.len / (T - (ta + td) / 2);
    if (P.len < speed * (ta + td) / 2 && o.until == null) { T = Math.max(.35, Math.sqrt(P.len / speed) * .9 + 8 * F); ta = T * .55; td = T * .45; v = P.len / (T - (ta + td) / 2); }
    const n = Math.max(1, Math.round(P.len / stride)), L = P.len / n;
    this.walks.push({ t0, t1: t0 + T, T, ta, td, v, ...P, st, style: o.style || 'walk', n, L, endYaw: o.endYaw, endFace: o.face });
    this.walks.sort((a, b) => a.t0 - b.t0); this._dirty(); return this;
  }
  /** walk straight to x, z (see walk) */
  moveTo(x, z, t0, o = {}) { return this.walk([[x, z]], t0, o); }
  /** a hop / jump: anticipation squat (4 frames), stretch on take-off, ballistic arc up h metres in the air for dur s,
   *  landing squash (3 frames). t = take-off. o: { h, dur, to: [x, z] (jump there), tuck } */
  hop(t, o = {}) { this.hops.push({ t, h: o.h ?? .32, dur: o.dur ?? .36, to: o.to || null, tuck: o.tuck ?? 1 }); this.hops.sort((a, b) => a.t - b.t); this._dirty(); return this; }
  /** slide the whole character without a walk cycle (fly, get pushed, ride, a real-time fall into frame). o: { y, ease, rot: [x,y,z] } */
  move(to, t0, t1, o = {}) { this.moves.push({ t0, t1, to, ease: easeFn(o.ease || 'inOutCubic'), y: o.y, rot: o.rot }); this.moves.sort((a, b) => a.t0 - b.t0); this._dirty(); return this; }
  /** startle / jolt at t: the body pops up in 2 frames (linear; with the torso stretched +24 % the head travels ~0.45 head
   *  heights), the head snaps upright, the eyes open 1 frame after the body (popped); it falls back over 11 frames, the
   *  stretch relaxes in 6. o: { face, h (body lift, head heights), deflate (slump lower after, head heights, until o.until),
   *  sweat: true (a drop 10 frames later, held 35), arms: true (fling up) } */
  jolt(t, o = {}) {
    this.acts.push({ kind: 'jolt', t0: t, t1: o.deflate ? (o.until ?? 1e9) : t + 16 * F, h: o.h ?? .15, deflate: o.deflate ?? 0, arms: o.arms ?? true, until: o.until ?? 1e9 });
    this.pose({ tilt: 0, nod: 0 }, t, { dur: F, ease: 'lin' });
    if (o.face) this.face(o.face, t + 2 * F, { inbetween: false, pop: true });
    if (o.sweat) this.extra('sweat', t + 10 * F, t + 45 * F, { anim: 'fade' });
    this._dirty(); return this;
  }
  /** topple like a plank from the feet: 90 deg * quadIn over dur (default 24 frames, measured), a small bounce on the floor,
   *  the free arms flail up for the first half. t = start. o: { dir: back | forward | left | right, dur (s), rest (deg) } */
  fall(t, o = {}) { this.acts.push({ kind: 'fall', t0: t, t1: 1e9, dur: o.dur ?? 24 * F, dir: o.dir || 'back', rest: o.rest }); this._dirty(); return this; }
  /** sit on a seat: a prop with userData.seat (sits on its front edge facing away from its back) or [x, y, z] (the seat
   *  point) + o.ry. t = the CONTACT frame (the face swap rides it): a 3 frame dip, a 5 frame rise, an 11 frame curved
   *  descent, a 1 frame drop on contact, 2 held, a 3 frame rebound and a 5 frame settle. o: { ry, face, pose (arms), quick } */
  sit(seat, t, o = {}) {
    let p, ry = o.ry ?? this.home.ry;
    if (seat?.isObject3D) { seat.updateMatrixWorld(true); const sy = seat.userData.seat ?? new THREE.Box3().setFromObject(seat).max.y - seat.position.y; p = new THREE.Vector3(0, sy, 0).applyMatrix4(seat.matrixWorld); if (o.ry == null) ry = seat.rotation.y; }
    else p = new THREE.Vector3(...seat);
    // how far in front of the seat point the hips land: a deep seat (armchair, sofa) measures its own front edge (its
    // local +z bounds), so the character never stands inside the cushion; a bare point uses the leg-length default
    let front = null;
    if (seat?.isObject3D && o.back == null) { const inv = seat.matrixWorld.clone().invert(), bb = new THREE.Box3().setFromObject(seat).applyMatrix4(inv), sp = p.clone().applyMatrix4(inv);
      if (isFinite(bb.max.z)) front = clamp((bb.max.z - sp.z) * (seat.scale?.z ?? 1) - .06, .12, .55); }
    const B = this.toon.B, back = o.back ?? front ?? Math.min(.24, B.leg * .4);
    this.place(p.x + Math.sin(ry) * back, p.z + Math.cos(ry) * back, ry);
    this.seats.push({ t, y: p.y, back, out: 1e9, quick: !!o.quick });
    this.seats.sort((a, b) => a.t - b.t);
    if (o.pose !== false) this.pose(o.pose || 'sit', t - (o.quick ? 6 : 12) * F, { dur: 10 * F, ease: 'inOutCubic' });
    if (o.face) { this.face(o.face, t + 2 * F, { inbetween: true }); }
    this._dirty(); return this;
  }
  /** stand up from the seat at t (start): lean forward 4 frames (head 0.12 head heights down and forward), hold 3, rise
   *  in 8 frames with the measured speed profile 3,7,10,9,7,6,5,3 (peak at frame 3). o: { pose } */
  standUp(t, o = {}) { const s = [...this.seats].reverse().find(s => s.t < t); if (s) s.out = t; if (o.pose !== false) this.pose(o.pose || 'rest', t + 4 * F, { dur: 10 * F, ease: 'inOutCubic' }); this._dirty(); return this; }
  /** crouch down (5 frames, knees out) at t and back up (6 frames) at o.until */
  crouch(t, o = {}) { return this.gesture('crouch', t, { early: 0, ...o }); }
  /** reach a hand to a world point / object / actor, arriving at t (4 frames, outCubic, no overshoot); the body leans after
   *  it (follow-through 3 frames), eyes and head look at it. o: { side, until (t back), grip, hold (stay), push (press) } */
  reach(target, t, o = {}) {
    const side = sideOf(o.side || 'R'); if (target?.isObject3D) homePoint(target);
    this.reaches.push({ target, side, t, t0: t - (o.dur ?? 4) * F, t1: o.until ?? (o.stay ? 1e9 : t + (o.hold ?? 10) * F), back: (o.back ?? 7) * F, grip: o.grip || 'open', push: o.push ?? 0, lean: o.lean ?? .1, look: o.look !== false });
    if (o.look !== false) { this.look(target, t - (o.dur ?? 4) * F - 2 * F); this.headTo(target, t - (o.dur ?? 4) * F, { dur: 6 * F }); if (o.until != null || !o.stay) { this.headTo(null, (o.until ?? t + (o.hold ?? 10) * F) + 2 * F, { dur: 6 * F }); this.look(0, 0, (o.until ?? t + (o.hold ?? 10) * F) + 3 * F); } }
    this._dirty(); return this;
  }
  /** press a button (world point / object) at t: the finger reaches in 3 frames, pushes 1 cm for a frame, holds, retracts
   *  in 7. o: { side, hold (frames), grip: point | flat } */
  press(target, t, o = {}) { return this.reach(target, t, { dur: 4, hold: o.hold ?? 6, back: 7, grip: o.grip || 'point', push: .012, lean: .08, ...o }); }
  /** hold a prop (Object3D) in hand 'L' | 'R' | 'both' from t0 to t1. Uses the prop's userData.grip ({ at, rot } in the
   *  prop's own space) when it has one. o: { at: [x,y,z] / rot: offset in the hand's frame, drop: true (falls to the
   *  floor when let go), place: [x,y,z] (where it is left), floor (y), orient: 'upright' (default: stays upright, faces
   *  the character's way) | 'hand' (follows the hand's rotation) } */
  hold(obj, side = 'R', t0 = -1e3, t1 = 1e9, o = {}) {
    obj.updateMatrixWorld(true); homePoint(obj);
    this.holds.push({ obj, side: side === 'both' ? 'both' : sideOf(side), t0, t1, off: o.at || [0, 0, 0], rot: o.rot || [0, 0, 0], home: obj.matrix.clone(), s: obj.scale.clone(), orient: o.orient || 'upright', drop: !!o.drop, place: o.place || null, floor: o.floor ?? 0 });
    this.holds.sort((a, b) => a.t0 - b.t0); return this;
  }
  /** pick a prop up: reach to its grip point (arriving at t) and hold it from t (until o.until) */
  take(obj, t, o = {}) { const side = sideOf(o.side || 'R'); homePoint(obj); this.reach(obj, t, { side, dur: o.dur ?? 4, hold: o.grab ?? 2, back: 7, grip: 'hold', lean: .12 }); this.hold(obj, side, t, o.until ?? 1e9, o); return this; }
  /** throw a held prop at t (it leaves the hand): 7 frame wind-down from t - 9 frames (the hand drops ~0.4 head diameters, ease-out), a 2 frame snap up,
   *  then real ballistics (apex ~1 head diameter above the hand after 11 frames, 15-20 deg/frame spin). o: { side,
   *  to: [x,y,z] | actor (its catch()) , apex (m), spin (deg/frame), g } */
  throw(obj, t, o = {}) {
    const side = sideOf(o.side || 'R');
    const h = this.holds.find(h => h.obj === obj && h.t0 < t); if (h) h.t1 = t; else this.hold(obj, side, -1e3, t);
    this.throws.push({ obj, side, t, to: o.to, apex: o.apex, spin: (o.spin ?? 17) * Math.PI / 180, g: o.g ?? 7.3 });
    this.acts.push({ kind: 'throw', side, t0: t - 9 * F, t1: t + 12 * F });
    this._dirty(); return this;
  }
  /** catch a prop arriving at t (thrown by another actor's throw({ to: this })): hands up 4 frames before, it closes in 1,
   *  pulls in to a carry over 7. o: { side, until } */
  catch(obj, t, o = {}) {
    const side = o.side === 'both' ? 'both' : sideOf(o.side || 'R');
    this.catches.push({ obj, side, t });
    // marked at authoring time, so the thrower stops placing it after the catch whichever actor updates first
    obj.userData.caughtBy = this; obj.userData.caughtAt = t;
    this.reaches.push({ target: { catchOf: obj, t }, side: side === 'both' ? 'R' : side, t, t0: t - 5 * F, t1: t + 2 * F, back: 7 * F, grip: 'hold', push: 0, lean: .05, look: true, catch: true });
    this.hold(obj, side === 'both' ? 'R' : side, t, o.until ?? 1e9);
    this.pose(side === 'L' ? 'holdL' : 'holdR', t + 2 * F, { dur: 7 * F, ease: 'inOutSine' });
    this.look({ catchOf: obj, t }, t - 14 * F);
    this._dirty(); return this;
  }
  /** a face extra (sweat, blush, stress, ...) from t0 to t1; o: { slot 1|2, anim: 'fall' | 'fade' | 'bob', x, y, scale } */
  extra(name, t0, t1, o = {}) { this.extras.push({ name, t0, t1, slot: o.slot || 1, anim: o.anim || 'none', x: o.x ?? 0, y: o.y ?? 0, scale: o.scale ?? 1 }); return this; }

  // ----- evaluation -----
  _posAt(t) {
    let x = this.home.x, z = this.home.z, y = this.home.y;
    for (const w of this.walks) { if (t < w.t0) break; const d = walkDist(t, w), p = w.curve.getPointAt(clamp(d / w.len)); x = p.x; z = p.z; }
    for (const h of this.hops) { if (!h.to || t < h.t) continue; const k = clamp((t - h.t) / h.dur); const from = h._from ??= this._posBefore(h.t, h); x = lerp(from.x, h.to[0], k); z = lerp(from.z, h.to[1], k); }
    for (const m of this.moves) { if (t < m.t0) break; const k = m.ease(seg(t, m.t0, m.t1)); const from = this._moveFrom(m); x = lerp(from.x, m.to[0], k); z = lerp(from.z, m.to[m.to.length > 2 ? 2 : 1], k); if (m.to.length > 2 || m.y != null) y = lerp(from.y, m.to.length > 2 ? m.to[1] : m.y, k); }
    return { x, y, z };
  }
  _posBefore(t, skip) { const save = this.hops; this.hops = this.hops.filter(h => h !== skip && h.t < t); const p = this._posAt(t); this.hops = save; return p; }
  _moveFrom(m) { if (!m._from) { const i = this.moves.indexOf(m); const save = this.moves; this.moves = save.slice(0, i); m._from = this._posAt(m.t0 - 1e-4); this.moves = save; } return m._from; }
  _walkAt(t) { for (let i = this.walks.length - 1; i >= 0; i--) { const w = this.walks[i]; if (t >= w.t0 - 2 * F && t <= w.t1 + 4 * F) return w; } return null; }
  _yawAt(t) {
    let yaw = this.home.ry;
    const evs = [...this.turns.map(k => ({ t: k.t, k })), ...this.walks.map(w => ({ t: w.t0, w }))].sort((a, b) => a.t - b.t);
    for (const ev of evs) {
      if (ev.k) {
        if (t < ev.t) break;
        const to = this._yawTarget(ev.k.to, ev.t, yaw, ev.k), d = wrap(to - yaw), dur = ev.k.dur ?? Math.max(2 * F, (ev.k.to === 'camera' ? 6 : Math.abs(d) / Math.PI * 4) * F);
        yaw = yaw + d * ev.k.ease(seg(t, ev.t, ev.t + dur)); if (t >= ev.t + dur) yaw = to;
      } else {
        const w = ev.w, dir = w.curve.getTangentAt(.001), y0 = Math.atan2(dir.x, dir.z), d0 = wrap(y0 - yaw), turnDur = Math.max(2 * F, Math.abs(d0) / Math.PI * 4 * F);
        if (t < w.t0 - turnDur) break;
        if (t < w.t0) { yaw = yaw + d0 * E.inOutQuad(seg(t, w.t0 - turnDur, w.t0)); break; }
        const d = walkDist(Math.min(t, w.t1), w), u = clamp(d / w.len, 0, .999), tg = w.curve.getTangentAt(u);
        yaw = Math.atan2(tg.x, tg.z);
        const endTo = w.endYaw != null ? w.endYaw : w.endFace != null ? this._yawTarget(w.endFace, w.t1, yaw, w) : null;
        if (endTo != null && t > w.t1) { const de = wrap(endTo - yaw), dd = (w.endFace === 'camera' ? 6 : Math.max(2, Math.abs(de) / Math.PI * 4)) * F; yaw += de * E.inOutQuad(seg(t, w.t1, w.t1 + dd)); }
      }
    }
    return yaw;
  }
  _yawTarget(to, t, cur, ev) {
    if (typeof to === 'number') return cur + wrap(to - cur);
    if (to === 'camera') {   // where the shot's camera is at the turn's time (evaluated once from the camera rig: pure)
      let c = ev?._cam;
      if (!c && this.S?._cam && !Actor._camBusy) { Actor._camBusy = true; try { const cam = new THREE.PerspectiveCamera(); this.S._cam(cam, t); c = cam.position.clone(); if (ev) ev._cam = c; } finally { Actor._camBusy = false; } }
      const p = this._posAt(t); return c ? cur + wrap(Math.atan2(c.x - p.x, c.z - p.z) - cur) : cur + wrap(-cur);
    }
    const p = this._posAt(t), q = to?.isVector3 ? to : to instanceof Actor ? to._posAt(t) : to?.isObject3D ? to.getWorldPosition(new THREE.Vector3()) : { x: to[0], z: to[1] };
    return cur + wrap(Math.atan2(q.x - p.x, q.z - p.z) - cur);
  }
  /** the authored pose at time t (keys blended in order, each from where the previous left off) */
  poseAt(t) {
    let i = -1; for (let k = 0; k < this.keys.length; k++) if (this.keys[k].t <= t) i = k; else break;
    if (i < 0) return this.base;
    return this._evalKey(i, t);
  }
  _startOf(i) { if (i === 0) return this.base; if (!this._memo.has(i)) this._memo.set(i, this._evalKey(i - 1, this.keys[i].t)); return this._memo.get(i); }
  _evalKey(i, t) {
    const k = this.keys[i], s = this._startOf(i), target = mergePose(s, k.target);
    const ka = k.ease(seg(t, k.t, k.t + k.dur)), kb = k.follow ? E.inOutSine(seg(t, k.t + k.dur * .45, k.t + k.dur + k.follow)) : ka;
    return blend(s, target, ka, kb, ka);
  }
  /** a world point for a target, pure in t: [x,y,z] / Vector3; an actor: its head (from its own timeline); an object: its
   *  grip point (or centre) where it was placed, or along its flight while thrown; { catchOf }: a thrown prop (in flight) */
  _point(target, t) {
    if (!target) return null;
    if (target.catchOf) { const th = this._throwOf(target.catchOf); return th ? this._flightPoint(th, Math.min(t, target.t)) : null; }
    if (target.isVector3) return target.clone();
    if (Array.isArray(target)) return new THREE.Vector3(target[0], target[1] ?? 0, target[2] ?? 0);
    if (target instanceof Actor) { const p = target._posAt(t), B = target.toon.B; return new THREE.Vector3(p.x, p.y + B.leg + B.torso + B.head * .7, p.z); }
    if (target.isObject3D) {
      const th = this._throwOf(target); if (th && t >= th.th.t) { const f = th.a._flight?.get(th.th); if (f && t <= th.th.t + f.dur) return this._flightPoint(th, t); }
      return homePoint(target).clone();
    }
    return null;
  }
  /** pose and place the character (and the props it holds or threw) for time t: a pure function of t */
  update(t) {
    if (!this._probing) { this._lastT = t; this._prepare(); }
    const T = this.toon, B = T.B, H = B.head * 2 * .97;        // H = head height
    let P = { ...this.poseAt(t) };
    const pos = this._posAt(t); let yaw = this._yawAt(t);
    let rootY = pos.y, tiltX = 0, tiltZ = 0, lift = 0;
    // turning to the camera: the head rises a little through the turn and settles in 2 frames
    for (const k of this.turns) if (k.settle && t >= k.t && t < k.t + 8 * F) { const u = (t - k.t) / (8 * F); P.nod = (P.nod || 0) - .06 * Math.sin(Math.PI * Math.min(1, u * 1.3)); lift += .01 * Math.sin(Math.PI * u); }
    // seated: pelvis on the seat (back and down), knees bent, feet planted in front
    const seat = this._seatAt(t); if (seat) P = this._sitPose(P, seat, t, H);
    // hops: anticipation squat 4 frames, stretch at take-off, ballistic arc, landing squash 3 frames
    for (const h of this.hops) {
      const a = h.t - 4 * F, b = h.t + h.dur, c = b + 5 * F; if (t < a || t > c) continue;
      if (t < h.t) { const u = E.outCubic(seg(t, a, h.t)); P.bob = (P.bob || 0) - .045 * u; P.squash = (P.squash || 0) + .06 * u; P.nod = (P.nod || 0) + .05 * u; }
      else if (t < b) { const u = (t - h.t) / h.dur; rootY += 4 * h.h * u * (1 - u); const st = 1 - seg(u, 0, .35); P.squash = (P.squash || 0) - .12 * st; P.bob = (P.bob || 0) + .01;
        const tk = Math.sin(Math.PI * u) * h.tuck; P.fL = [P.fL[0], P.fL[1] + .1 * tk, P.fL[2] + .04 * tk, -.3 * tk]; P.fR = [P.fR[0], P.fR[1] + .08 * tk, P.fR[2] - .02 * tk, -.3 * tk];
        for (const s of ['L', 'R']) { const hv = P['h' + s]; if (Math.abs(hv[1] + .9) < .25) P['h' + s] = [hv[0] + .15 * tk, hv[1] + .45 * tk, hv[2] + .1 * tk]; } }
      else { const u = seg(t, b, c), sq = u < .6 ? E.outCubic(u / .6) : 1 - E.inOutSine((u - .6) / .4); P.bob = (P.bob || 0) - .06 * sq; P.squash = (P.squash || 0) + .1 * sq; }
    }
    // the walk cycle on top of the pose
    const w = this._walkAt(t); if (w) P = this._walkPose(P, w, t, pos, yaw, H);
    // actions: jolt, fall, nod, react, throw wind-up
    for (const a of this.acts) {
      if (t < a.t0 || t > a.t1 + 1e-6) continue;
      const x = (t - a.t0) / F;                                // frames since the start
      if (a.kind === 'jolt') {
        const up = x < 2 ? x / 2 : x < 13 ? 1 - E.inOutSine((x - 2) / 11) : 0, st = x < 2 ? x / 2 : 1 - E.inOutSine(clamp((x - 2) / 6));
        const dz = a.deflate * E.outCubic(clamp((x - 13) / 2)) * (1 - E.inOutSine(seg(t, a.until, a.until + 8 * F))); const lift = a.h * H * up;
        if (seat) P.bob = (P.bob || 0) + lift - dz * H; else { rootY += lift; if (dz) { P.bob = (P.bob || 0) - dz * H * .5; P.nod = (P.nod || 0) + dz * 1.2; } }
        P.squash = (P.squash || 0) - .24 * st; P.nod = (P.nod || 0) - .08 * st;
        if (a.arms) for (const s of ['L', 'R']) { const hv = P['h' + s]; P['h' + s] = [hv[0] + .25 * st, hv[1] + .45 * st, hv[2] + .1 * st]; if (st > .3) P['g' + s] = 'open'; }
      } else if (a.kind === 'nod') {
        const k = x < 1 ? x : x < 5 ? 1 - 2.5 * E.outCubic((x - 1) / 4) * .6 : -.5 * (1 - E.inOutSine((x - 5) / 4));
        P.nod = (P.nod || 0) - .16 * k * a.amt; P.bob = (P.bob || 0) + .012 * k * a.amt;
      } else if (a.kind === 'react') {
        const hf = a.hold / F, k = x < 8 ? E.outSine(x / 8) : x < 8 + hf ? 1 : 1 - E.inOutSine((x - 8 - hf) / 8);
        P.tilt = (P.tilt || 0) + .3 * k * a.side * a.amt; P.nod = (P.nod || 0) + .16 * k * a.amt; P.bob = (P.bob || 0) - .03 * k * a.amt; P.roll = (P.roll || 0) + .04 * k * a.side * a.amt;
      } else if (a.kind === 'throw') {
        const s = a.side, hv = P['h' + s];
        if (x < 7) { const u = E.outCubic(x / 7); P['h' + s] = [hv[0] + .05 * u, hv[1] - .4 * u, hv[2] - .25 * u]; P.lean = (P.lean || 0) - .04 * u; }
        else if (x < 9) { const u = (x - 7) / 2; P['h' + s] = [lerp(hv[0] + .05, hv[0] + .05, u), lerp(hv[1] - .4, hv[1] + .65, u), lerp(hv[2] - .25, hv[2] + .55, u)]; P.lean = (P.lean || 0) + lerp(-.04, .08, u); P['g' + s] = 'open'; }
        else { const u = E.inOutSine((x - 9) / 12); P['h' + s] = [hv[0] + .05 * (1 - u), hv[1] + .65 * (1 - u), hv[2] + .55 * (1 - u)]; P.lean = (P.lean || 0) + .08 * (1 - u); P['g' + s] = 'open'; }
      } else if (a.kind === 'fall') {
        const u = clamp((t - a.t0) / a.dur), rest = (a.rest ?? (90 - Math.asin(Math.min(.9, B.head / (B.leg + B.torso + B.head * .68))) * 180 / Math.PI)) * Math.PI / 180;
        let ang = rest * u * u; const after = (t - a.t0 - a.dur) / F; if (after > 0) ang = rest - .1 * Math.sin(Math.min(1, after / 4) * Math.PI) * Math.exp(-after / 6);
        const dir = a.dir; if (dir === 'back') tiltX = -ang; else if (dir === 'forward') tiltX = ang; else if (dir === 'left') tiltZ = -ang; else tiltZ = ang;
        const fl = 1 - seg(u, .45, .9); for (const s of ['L', 'R']) { const hv = P['h' + s]; P['h' + s] = [lerp(hv[0], .4, fl * .8), lerp(hv[1], .55, fl), lerp(hv[2], .2, fl * .6)]; P['g' + s] = 'open'; }
        P.fL = [P.fL[0] * .6, P.fL[1], P.fL[2]]; P.fR = [P.fR[0] * .6, P.fR[1], P.fR[2]]; P.nod = (P.nod || 0) + (dir === 'back' ? -.25 : .1) * Math.min(1, u * 2);
      }
    }
    // loops on holds (wave, scratch, clap, rub): the scratch jiggles every 2 frames (measured)
    for (const l of this.loops) {
      if (t < l.t0 || t > l.t1) continue; const x = t - l.t0, fade = 1 - seg(t, l.t1 - .15, l.t1);
      if (l.kind === 'wave') { const s = Math.sin(x * 2 * Math.PI * 2.2) * fade; P.wR = (P.wR || 0) + s * .35; P.hR = [P.hR[0] + s * .12, P.hR[1] - Math.abs(s) * .03, P.hR[2]]; }
      if (l.kind === 'scratch') { const s = (Math.floor(x / (2 * F)) % 2 ? 1 : -1) * fade; P.hR = [P.hR[0] + s * .04, P.hR[1] + s * .02, P.hR[2]]; }
      if (l.kind === 'clap') { const c = Math.abs(Math.sin(x * Math.PI * 3)) * fade; P.hL = [P.hL[0] + c * .2, P.hL[1], P.hL[2]]; P.hR = [P.hR[0] + c * .2, P.hR[1], P.hR[2]]; }
      if (l.kind === 'rub') { const c = Math.sin(x * 2 * Math.PI * 3) * .06 * fade; P.hL = [P.hL[0], P.hL[1] + c, P.hL[2]]; P.hR = [P.hR[0], P.hR[1] - c, P.hR[2]]; }
    }
    // the head toward a target
    const hk = this.heads.filter(h => h.t <= t).pop();
    if (hk) {
      const prev = this.heads[this.heads.indexOf(hk) - 1];
      const aim = h => { const tp = h && this._point(h.target, t); if (!tp) return [0, 0];
        const hp = new THREE.Vector3(pos.x, rootY + B.leg + B.torso + B.head * .7, pos.z), d = tp.sub(hp); const yw = wrap(Math.atan2(d.x, d.z) - yaw), pt = -Math.atan2(d.y, Math.hypot(d.x, d.z));
        return [clamp(yw, -1.1, 1.1), clamp(pt, -.5, .5)]; };
      const a = aim(prev), b = aim(hk), k = E.outCubic(seg(t, hk.t, hk.t + hk.dur));
      P.turn = (P.turn || 0) + lerp(a[0], b[0], k); P.nod = (P.nod || 0) + lerp(a[1], b[1], k) * .7;
    }
    // expression swaps carry a small head roll change (measured 5-10 deg on the swap frames)
    P.tilt = (P.tilt || 0) + this._swapTilt(t);
    // place the root (falls tip it about the feet)
    this.root.position.set(pos.x, rootY + lift, pos.z);
    _qy.setFromAxisAngle(_Y, yaw); _qt.setFromEuler(_eu.set(tiltX, 0, tiltZ)); this.root.quaternion.copy(_qy).multiply(_qt);
    for (const m of this.moves) if (m.rot && t >= m.t0) { const k = m.ease(seg(t, m.t0, m.t1)); this.root.rotation.set(m.rot[0] * k, yaw + (m.rot[1] || 0) * k, m.rot[2] * k); }
    this.root.updateMatrix();
    // hands on world targets (reach, press, catch)
    this._reachPose(P, t);
    T.apply(P);
    this._face(t);
    if (this._probing) return;
    this.root.updateMatrixWorld(true);
    this._props(t);
  }
  _seatAt(t) { for (let i = this.seats.length - 1; i >= 0; i--) { const s = this.seats[i], a = s.t - (s.quick ? 11 : 19) * F; if (t >= a && t < s.out + 15 * F) return s; } return null; }
  _sitPose(P, s, t, H) {
    const B = this.toon.B, drop = s.y - B.leg + .012, fk = B.leg / .6;
    // the seated target: pelvis back over the seat and down, thighs forward, shins down, feet a little apart
    const seated = { bob: drop, pz: -s.back, kL: .12, kR: .12 };
    const footZ = .02;
    let k = 0, extra = 0, sq = 0;                              // k: 0 standing .. 1 seated; extra: the bounce on top
    const x = (t - s.t) / F;                                   // frames from contact
    if (t < s.out) {
      if (s.quick) { k = x < 0 ? E.inOutSine(clamp((x + 11) / 11)) : 1; }
      else if (x < -11) { const y = x + 19; extra = y < 3 ? -.04 * H * E.outSine(y / 3) : -.04 * H + .08 * H * E.inOutSine((y - 3) / 5); }   // dip 3 frames, rise 5
      else if (x < 0) { const u = (x + 11) / 11; k = E.inOutSine(Math.pow(u, .85)); extra = .04 * H * (1 - k); }                     // 11 frame descent, peak speed at ~40 %
      else { k = 1; if (x < 1) { extra = -.04 * H * x; sq = .035 * x; } else if (x < 3) { extra = -.04 * H; sq = .035; } else if (x < 6) { const u = E.outSine((x - 3) / 3); extra = lerp(-.04 * H, .035 * H, u); sq = .035 * (1 - u); } else if (x < 11) extra = .035 * H * (1 - E.inOutSine((x - 6) / 5)); }
    } else {
      const y = (t - s.out) / F;                               // stand up: lean 4, hold 3, rise 8 (3,7,10,9,7,6,5,3)
      const prof = [0, 3, 10, 20, 29, 36, 42, 47, 50]; const r = y < 7 ? 0 : y >= 15 ? 1 : (() => { const i = Math.floor(y - 7), f = y - 7 - i; return lerp(prof[i], prof[i + 1], f) / 50; })();
      k = 1 - r; const lean = y < 4 ? E.inOutSine(y / 4) : y < 7 ? 1 : 1 - E.inOutSine(clamp((y - 7) / 8));
      P.lean = (P.lean || 0) + .2 * lean; P.nod = (P.nod || 0) + .07 * lean; extra = -.03 * H * lean * (1 - r);
    }
    const out = { ...P };
    out.bob = (P.bob || 0) + lerp(0, seated.bob, k) + extra; out.pz = (P.pz || 0) + lerp(0, seated.pz, k);
    out.squash = (P.squash || 0) + sq;
    const fx = .1, fz = lerp(0, footZ, k) / fk;
    out.fL = [lerp(P.fL[0], fx, k), P.fL[1], lerp(P.fL[2], fz, k), P.fL[3] || 0]; out.fR = [lerp(P.fR[0], -fx, k), P.fR[1], lerp(P.fR[2], fz, k), P.fR[3] || 0];
    out.kL = lerp(P.kL || 0, seated.kL, k); out.kR = lerp(P.kR || 0, seated.kR, k); out.fyL = lerp(P.fyL || 0, .05, k); out.fyR = lerp(P.fyR || 0, -.05, k);
    out.lean = (out.lean || 0) - .05 * k;
    return out;
  }
  _walkPose(P, w, t, pos, yaw, H) {
    const T = this.toon, B = T.B, st = w.st, L = w.L, D = w.len, n = w.n;
    const wIn = E.inOutSine(seg(t, w.t0 - 2 * F, w.t0 + 2 * F)) * (1 - E.inOutSine(seg(t, w.t1, w.t1 + 4 * F)));
    if (wIn <= 0) return P;
    // the body's distance mapped onto the step windows: step k (1..n+1) swings in [k-1.5, k-1.5+duty] steps
    const d = walkDist(t, w), g = -.5 + d / L * (n + 1) / n;
    const spread = .085 * (B.leg / .6) * (st.wide || 1), plants = { L: 0, R: 0 }, sw = { L: null, R: null };
    for (let k = 1; k <= n + 1; k++) {
      const foot = k % 2 ? 'L' : 'R', to = Math.min(D, k * L), a = k - 1.5, b = a + st.duty;
      if (g >= b) plants[foot] = to;
      else if (g > a) { sw[foot] = { from: plants[foot], to, u: (g - a) / st.duty }; break; }
      else break;
    }
    const inv = new THREE.Matrix4().makeRotationY(-yaw), lk = B.leg / .6;
    const footAt = (s, side) => {
      const S = sw[s], u = S ? E.inOutSine(S.u) : 0, dd = S ? lerp(S.from, S.to, u) : plants[s];
      const q = w.curve.getPointAt(clamp(dd / D)), tg = w.curve.getTangentAt(clamp(dd / D, 0, .999)), nx = tg.z, nz = -tg.x;
      const lift = S ? Math.sin(Math.PI * Math.pow(S.u, .85)) * st.lift * lk : 0;
      const v = new THREE.Vector3(q.x + nx * spread * side, lift, q.z + nz * spread * side).sub(new THREE.Vector3(pos.x, 0, pos.z)).applyMatrix4(inv);
      return [v.x, v.y, v.z, S ? .45 * Math.sin(Math.PI * S.u) * (1 - S.u * .6) : 0];
    };
    const fL = footAt('L', 1), fR = footAt('R', -1);
    // the step phase (0 = a swing starts) and the bob: round (low 1-2 frames after contact) or pop (sink, pop at passing)
    const ph = frac(g + .5), stepF = st.fps, cont = st.duty;
    let bob = 0;
    if (st.shape === 'round') bob = -.5 * st.bob * H * (1 + Math.cos(2 * Math.PI * (ph - cont - 1.5 / stepF)));
    else if (st.shape === 'pop') { const pass = cont / 2, popW = .15 / stepF, x = frac(ph - pass); bob = x < 1 - popW ? -st.bob * H * (x / (1 - popW)) : -st.bob * H * (1 - (x - 1 + popW) / popW); }
    const side = Math.floor(g + .5) % 2 ? -1 : 1, rock = Math.sin(Math.PI * ph);
    const walkP = { ...P, fAbs: true, fL, fR, fyL: .04, fyR: -.04, kL: 0, kR: 0 };
    walkP.bob = (P.bob || 0) + bob - (st.crouch || 0) - .006 * lk;
    walkP.roll = (P.roll || 0) + st.roll * rock * side; walkP.twist = (P.twist || 0) - st.roll * .7 * Math.sin(Math.PI * g);
    walkP.lean = (P.lean || 0) + st.lean * E.inOutSine(clamp((t - w.t0) / (6 * F))) * (1 - seg(t, w.t1 - 5 * F, w.t1));
    if (st.sway) walkP.tilt = (P.tilt || 0) + st.sway * Math.sin(Math.PI * g * .5);
    // arms: counter-phase swing (only arms the pose leaves at rest), pump (bent, fists), behind, out (balance)
    const rest = (this._restPose ??= this._resolve('rest')), atRest = s => { const a = P['h' + s], r = rest['h' + s]; return Math.hypot(a[0] - r[0], a[1] - r[1], a[2] - r[2]) < .12 && !this._holding(s, t); };
    const ss = Math.sin(Math.PI * g);
    for (const s of ['L', 'R']) {
      if (!atRest(s)) continue; const sg = s === 'L' ? -1 : 1, r = rest['h' + s];
      if (st.arms === 'swing') { walkP['h' + s] = [r[0], r[1] + .04 * Math.abs(ss), r[2] + st.swing * sg * ss]; walkP['e' + s] = .1; }
      else if (st.arms === 'pump') { walkP['h' + s] = [r[0] + .05, r[1] + .42, r[2] + .22 + st.swing * sg * ss]; walkP['g' + s] = 'fist'; walkP['e' + s] = .45; }
      else if (st.arms === 'behind') { const b = (this._behindPose ??= this._resolve('behind'))['h' + s]; walkP['h' + s] = b; walkP['g' + s] = s === 'L' ? 'fist' : 'mitt'; walkP['e' + s] = .4; }
      else if (st.arms === 'out') { walkP['h' + s] = [r[0] + .35, r[1] + .3 + .05 * sg * ss, r[2] + .1]; walkP['g' + s] = 'open'; walkP['p' + s] = [0, -1, 0]; }
    }
    // the standing feet in metres, so they blend into the walk's planted feet without a slide
    const fk = P.fAbs ? 1 : B.leg / .6;
    const Pm = { ...P, fAbs: true, fL: [P.fL[0] * fk, P.fL[1] * fk, P.fL[2] * fk, P.fL[3] || 0], fR: [P.fR[0] * fk, P.fR[1] * fk, P.fR[2] * fk, P.fR[3] || 0] };
    const out = blend(Pm, walkP, wIn, wIn, wIn); out.fAbs = true;
    for (const g2 of ['gL', 'gR']) out[g2] = wIn > .5 ? walkP[g2] : P[g2];
    return out;
  }
  _holding(s, t) { return this.holds.some(h => (h.side === s || h.side === 'both') && t >= h.t0 && t < h.t1); }
  _reachPose(P, t) {
    for (const r of this.reaches) {
      if (t < r.t0 || t > r.t1 + r.back) continue;
      const wp = this._point(r.target, r.target?.catchOf ? r.t : Math.min(t, r.t)); if (!wp) continue;
      const s = r.side, x = (t - r.t0) / (r.t - r.t0);
      let k = t < r.t ? EASE_GESTURE(x) : t <= r.t1 ? 1 : 1 - E.inOutSine((t - r.t1) / r.back);
      // the hand's grip point goes to the target: aim the wrist a palm-length short of it along the reach
      const loc = wp.clone(); this.root.worldToLocal(loc);
      const push = r.push && t >= r.t && t < r.t + F ? r.push : 0;
      P['h' + s + 'w'] = [loc.x, loc.y, loc.z]; P['h' + s + 'k'] = k; P['h' + s + 'push'] = push;
      if (k > .5) P['g' + s] = r.grip;
      // follow-through: the body leans toward the reach 3 frames after the hand
      const kb = t < r.t ? E.outCubic(clamp((t - r.t0 - F) / (r.t - r.t0 + 2 * F))) : k;
      P.lean = (P.lean || 0) + r.lean * kb * clamp(loc.z / .5, -.5, 1.2); P.twist = (P.twist || 0) + .25 * kb * clamp(loc.x / .6, -1, 1) * (s === 'L' ? 1 : 1);
    }
  }
  // ----- props: held, thrown, dropped -----
  _prepare() {           // flight paths need hand positions at other times: probe once (pure: the same numbers every run)
    if (this._flight || !this.throws.length) return;
    this._flight = new Map();
    for (const th of this.throws) {
      const p0 = this._probeHand(this, th.side, th.t);
      let p1 = null, tEnd = null; const to = th.to;
      if (to instanceof Actor) { const c = to.catches.find(c => c.obj === th.obj); if (c) { tEnd = c.t; p1 = this._probeHand(to, c.side === 'both' ? 'R' : c.side, c.t); } else p1 = to.toon.headPos(); }
      else if (to) p1 = Array.isArray(to) ? new THREE.Vector3(...to) : to.isVector3 ? to.clone() : to.getWorldPosition(new THREE.Vector3());
      else p1 = p0.clone().add(new THREE.Vector3(Math.sin(this.home.ry), 0, Math.cos(this.home.ry)).multiplyScalar(1.5)).setY(0);
      const g = th.g, apex = th.apex ?? Math.max(this.toon.B.head * 2, (p1.y - p0.y) + .3 + p0.distanceTo(p1) * .25);
      let tUp = Math.sqrt(2 * apex / g), vy = g * tUp, dur;
      if (tEnd != null) { dur = tEnd - th.t; vy = (p1.y - p0.y + .5 * g * dur * dur) / dur; }
      else { const tDown = Math.sqrt(Math.max(0, 2 * (apex + p0.y - p1.y) / g)); dur = tUp + tDown; }
      this._flight.set(th, { p0, p1, dur, vy, g, axis: new THREE.Vector3(p1.z - p0.z, 0, -(p1.x - p0.x)).normalize() });
    }
  }
  _probeHand(actor, side, t) {
    const was = actor._probing, last = actor._lastT; actor._probing = true;
    actor.update(t); actor.root.updateMatrixWorld(true); const p = actor.toon.handPos(side);
    actor._probing = was; if (last != null && actor !== this) { actor._probing = true; actor.update(last); actor._probing = was; }
    return p;
  }
  _throwOf(obj) { for (const a of this.S?.actors || [this]) for (const th of a.throws) if (th.obj === obj) { a._prepare(); return { a, th }; } return null; }
  _flightPoint(r, t) { const f = r.a._flight?.get(r.th); if (!f) return null; const x = clamp(t - r.th.t, 0, f.dur); return new THREE.Vector3(lerp(f.p0.x, f.p1.x, x / f.dur), f.p0.y + f.vy * x - .5 * f.g * x * x, lerp(f.p0.z, f.p1.z, x / f.dur)); }
  _props(t) {
    const T = this.toon;
    for (const h of this.holds) {
      const o = h.obj; if (!o.parent) continue;
      if (t >= h.t0 && t < h.t1) { this._attach(o, h); o.userData.heldBy = this; continue; }
      const th = this.throws.find(x => x.obj === o && Math.abs(x.t - h.t1) < 1e-6);
      if (th && t >= h.t1) { const f = this._flight.get(th), x = Math.min(t - th.t, f.dur);
        if (o.userData.caughtBy && t >= th.t + f.dur) continue;
        const p = new THREE.Vector3(lerp(f.p0.x, f.p1.x, x / f.dur), f.p0.y + f.vy * x - .5 * f.g * x * x, lerp(f.p0.z, f.p1.z, x / f.dur));
        const q = new THREE.Quaternion().setFromAxisAngle(f.axis, th.spin * x / F).multiply(h._relQ ??= new THREE.Quaternion());
        this._setWorld(o, p, q); o.userData.heldBy = null; continue; }
      if (t >= h.t1 && o.userData.heldBy === this && h.t1 < 1e8) {
        // let go: it stays where the hand left it (or is placed / drops to the floor with gravity)
        if (!h._rel) { const save = this._lastT; this._probing = true; this.update(h.t1 - 1e-4); this.root.updateMatrixWorld(true); this._attach(o, h); o.updateMatrixWorld(true); h._rel = o.matrixWorld.clone(); this._probing = false; this.update(save); this.root.updateMatrixWorld(true); }
        const m = h._rel.clone(); if (h.place) m.setPosition(...h.place);
        else if (h.drop) { const p = new THREE.Vector3().setFromMatrixPosition(m), x = t - h.t1, y = Math.max(h.floor, p.y - 4.9 * x * x); m.setPosition(p.x, y, p.z); }
        this._setWorldM(o, m); continue;
      }
      if (t < h.t0 && o.userData.heldBy === this && !this.holds.some(k => k !== h && k.obj === o && t >= k.t0 && t < k.t1)) { h.home.decompose(o.position, o.quaternion, o.scale); o.userData.heldBy = null; }
    }
    void T;
  }
  _attach(o, h) {
    const T = this.toon, g = o.userData.grip, yaw = new THREE.Euler().setFromQuaternion(this.root.quaternion, 'YXZ').y;
    // the grip point: in front of the palm (one hand) or between the palms (both); held props stay upright facing the
    // character's way (orient: 'hand' follows the hand's rotation fully, e.g. a pointer, a torch)
    let M;
    if (h.side === 'both') { const pa = new THREE.Vector3().setFromMatrixPosition(T.gripMatrix('L')), pb = new THREE.Vector3().setFromMatrixPosition(T.gripMatrix('R')); M = new THREE.Matrix4().makeRotationY(yaw); M.setPosition(pa.add(pb).multiplyScalar(.5)); }
    else { M = T.gripMatrix(h.side); if (h.orient !== 'hand') { const p = new THREE.Vector3().setFromMatrixPosition(M); M = new THREE.Matrix4().makeRotationY(yaw); M.setPosition(p); } }
    const off = new THREE.Matrix4().compose(new THREE.Vector3(...h.off), new THREE.Quaternion().setFromEuler(new THREE.Euler(...h.rot)), new THREE.Vector3(1, 1, 1));
    M.multiply(off);
    const s = h.s;
    if (g?.at) { const gq = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(g.rot || [0, 0, 0]))), gm = new THREE.Matrix4().compose(new THREE.Vector3(g.at[0] * s.x, g.at[1] * s.y, g.at[2] * s.z), gq, new THREE.Vector3(1, 1, 1)); M.multiply(gm.invert()); }
    M.multiply(new THREE.Matrix4().makeScale(s.x, s.y, s.z));
    this._setWorldM(o, M); h._relQ = new THREE.Quaternion().setFromRotationMatrix(M);
  }
  _setWorldM(o, m) { const inv = o.parent ? o.parent.matrixWorld.clone().invert() : new THREE.Matrix4(); const l = inv.multiply(m); l.decompose(o.position, o.quaternion, o.scale); }
  _setWorld(o, p, q) { const s = new THREE.Vector3(); o.matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), s); this._setWorldM(o, new THREE.Matrix4().compose(p, q, s)); }
  // ----- the face -----
  _swapTilt(t) {
    let tilt = 0, sign = 1;
    for (let i = 1; i < this.faces.length; i++) { const f = this.faces[i], p = this.faces[i - 1]; if (f.t > t) break; const big = (GROUP[f.name] ?? 0) !== (GROUP[p.name] ?? 0); if (!big || f.tilt === 0) continue;
      sign = -sign; const amt = f.tilt ?? .1 * sign; tilt = lerp(tilt, amt, E.outCubic(seg(t, f.t - 2 * F, f.t))); }
    return tilt;
  }
  _face(t) {
    const fm = this.toon.face, eps = 2e-3; let cur = null, ci = -1;
    for (let i = 0; i < this.faces.length; i++) if (this.faces[i].t <= t + eps) { cur = this.faces[i]; ci = i; }
    const next = this.faces[ci + 1];
    let show = cur ? cur.name : 'neutral', lid = 0, pop = 1, swapping = false;
    // in-betweens before a swap (measured: every swap passes through closed eyes): a big change (another group) gets a
    // half-lid frame of the old face, then a closed frame of the new one (the mouth changes on the closed frame); a small
    // change one closed frame; a pop face (shock) 2 squeezed frames, then it pops in at 85 % for a frame. o.inbetween: false = instant
    if (next && cur && t >= next.t - 2 * F - eps && next.inbetween !== false) {
      const big = next.inbetween === true || (GROUP[cur.name] ?? 0) !== (GROUP[next.name] ?? 0), popN = next.pop ?? POP.has(next.name), x = next.t - t;
      if (popN) { swapping = true; lid = 1; }
      else if (x > F + eps) { if (big) { swapping = true; lid = .55; } }
      else { swapping = true; lid = 1; if (fm.hasEyes?.(next.name)) show = next.name; }
    }
    if (cur && (cur.pop ?? POP.has(cur.name)) && t < cur.t + F - eps && t >= cur.t - eps) pop = .85;
    fm.set(show); fm.pop(pop);
    // authored lids
    const lk = this.lidKeys.filter(k => k.t <= t); if (lk.length) { const k = lk[lk.length - 1], prev = lk[lk.length - 2]?.k ?? 0; lid = Math.max(lid, lerp(prev, k.k, E.outCubic(seg(t, k.t, k.t + k.dur)))); }
    // blinks: 3 frames (half, closed, half); idle ones are seeded per character, never during a swap or on shock / sleep faces
    if (!swapping && !NOBLINK.has(show) && (fm.hasEyes?.(show) ?? true)) { const b = this._blinkAt(t); if (b) lid = Math.max(lid, b); }
    fm.lids(lid);
    // pupils (numbers or a tracked target)
    const lks = this.looks.filter(k => k.t <= t); let lx = 0, ly = 0;
    if (lks.length) { const k = lks[lks.length - 1], p = lks[lks.length - 2], u = E.outCubic(seg(t, k.t, k.t + k.dur)); const a = p ? this._lookXY(p, t) : [0, 0], b = this._lookXY(k, t); lx = lerp(a[0], b[0], u); ly = lerp(a[1], b[1], u); }
    fm.lookAt(lx, ly);
    for (const slot of [1, 2]) {
      const x = this.extras.find(e => e.slot === slot && t >= e.t0 && t < e.t1 + (e.anim === 'fall' ? .6 : e.anim === 'fade' ? .14 : 0));
      if (!x) { fm.extra(slot, null, { alpha: 0 }); continue; }
      let y = x.y, alpha = 1, sc = x.scale;
      if (t < x.t0 + F) sc *= .8;                                 // pops in (outline frame, then full)
      if (x.anim === 'fall' && t > x.t1) { const u = t - x.t1; y -= 1.4 * u * u + .15 * u; alpha = 1 - seg(u, .35, .6); }
      if (x.anim === 'fade') { alpha = 1 - seg(t, x.t1, x.t1 + 4 * F); y -= .007 * (t - x.t0) / F * .5; }
      if (x.anim === 'bob') y += Math.sin((t - x.t0) * 6) * .01;
      fm.extra(slot, x.name, { x: x.x, y, scale: sc, alpha });
    }
  }
  _lookXY(k, t) {
    if (k.target === undefined) return [k.x, k.y];
    const p = this._point(k.target, t); if (!p) return [0, 0];
    const hd = this.toon.head; hd.updateWorldMatrix(true, false); const l = hd.worldToLocal(p.clone()).normalize();
    return [clamp(-l.x * 1.8, -1, 1) * -1, clamp(l.y * 1.8, -1, 1)];
  }
  _blinkAt(t) {
    const hits = [];
    for (const b of this._blinks || []) hits.push(b);
    const c = this.blinkCfg;
    if (c && t >= c.from && t <= c.to) {
      // seeded intervals from the start of the window: the same blinks every render
      let x = Math.max(c.from, -10), i = 0; while (x <= t + 1 && i < 4000) { const gap = lerp(c.every[0], c.every[1], hash(i, c.seed)); x += gap; i++; if (x > t - 3 * F && x <= t + F) hits.push(x); }
    }
    let lid = 0; for (const b of hits) { const f = Math.round((t - b) / F); if (f === 0 || f === 2) lid = Math.max(lid, .55); else if (f === 1) lid = 1; }
    return lid;
  }
  /** world bounding box of the character */
  box() { return this.toon.box(); }
  /** world position of the head's centre */
  head() { return this.toon.headPos(); }
}
const _qy = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _eu = new THREE.Euler(), _Y = new THREE.Vector3(0, 1, 0);
// where an object was placed (its grip point or its centre), captured the first time a character refers to it (in build,
// before anything moves it): reaching for a held prop never chases the hand that holds it
function homePoint(o) {
  if (o.userData._homePoint) return o.userData._homePoint;
  o.updateMatrixWorld(true); const g = o.userData.grip;
  const p = g?.at ? new THREE.Vector3(...g.at).applyMatrix4(o.matrixWorld) : new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
  o.userData._homePoint = p; return p;
}
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// The toon character rig. Built like the studied shorts (experiments/toon-style/analysis, section 5 of every NOTES.md):
// a big sphere head sitting ON a bean torso (no neck: the head overlaps the round shoulder dome), the face painted on the
// head sphere as a decal (lib/faces.js), clothes painted on the torso like flat panels (collars, plackets, pockets, ties,
// belts as canvas art) plus a few real shapes where the silhouette needs them (skirts, coat tails, hoods, collars,
// belts), hair and hats as shells hugging the head whose edges tuck under the skin (no gaps, no z-fighting), thin noodle
// limbs solved with 2-bone IK, small mitten hands with a thumb (grips: mitt, fist, open, flat, point, hold, thumb), small
// rounded shoes, ink outlines (world width ~3.5 % of the head's diameter on head and torso, thinner on limbs and details).
// A pose is plain data (POSE0); lib/anim.js blends poses over time and calls char.apply(pose) every frame.
import { THREE, clamp, lerp, shade, SETTINGS } from './core.js';
import { Noodle, limbPath, addOutline } from './geo.js';
import { CAST, OUTFITS, BODY, SKIN } from './cast.js';
import { faceMaterial, whiteSkinMat } from './faces.js';

const OL = '#2a1d17';                    // ink
/** ink widths in metres: head + torso ~3.5 % of the head diameter, limbs thin (they read as sticks), small details finer */
export const LINE = { body: .017, limb: .0045, small: .0055, fine: .0035 };
const MATS = new Map();
/** The toon surface: soft matte (rough .3-.5 glossy plastic, metal .4-.7 metal). o: { rough, metal, map, emissive, ei, transparent, opacity, side } */
export function toonMat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (MATS.has(key) && !o.map) return MATS.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? .82, metalness: o.metal ?? 0, map: o.map || null, emissive: o.emissive || 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
  if (!o.map) MATS.set(key, m);
  return m;
}
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));
const PI = Math.PI;

// ---------- the pose: plain numbers, blended by lib/anim.js ----------
// body: bob (hips height offset), lean (forward +), roll (side), twist (upper body yaw), squash (+ squash / - stretch the
//   torso), px/pz (pelvis shift in root space, metres: sitting back, weight shifts), sh / sL / sR (shoulder raise)
// head: nod (down +), tilt (to the character's left +), turn (to the character's left +)
// hand L/R: target in arm lengths from the shoulder [x outward, y up, z forward]; e: elbow out/back; w: wrist roll
//   (+ turns the palm up); p: palm direction hint [x outward, y, z] or null (palm toward the body)
// foot L/R: [x, y, z, pitch] in metres of a regular body (or root-space metres when fAbs); fy: foot yaw; k: knee bow out
// grip L/R: 'mitt' | 'fist' | 'open' | 'flat' | 'point' | 'hold' | 'thumb'
export const POSE0 = () => ({
  bob: 0, lean: 0, roll: 0, twist: 0, squash: 0, sh: 0, px: 0, pz: 0,
  nod: 0, tilt: 0, turn: 0,
  hL: [.16, -.95, .06], hR: [.16, -.95, .06], eL: 0, eR: 0, wL: 0, wR: 0, pL: null, pR: null,
  fL: [.085, 0, 0], fR: [-.085, 0, 0], fyL: .1, fyR: -.1, kL: 0, kR: 0, fAbs: false,
  gL: 'mitt', gR: 'mitt',
});

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();
/** 2-bone IK: root, target, lengths a/b, pole direction -> joint position (all in one space). Stretches up to 8 %. */
function ik(root, target, a, b, pole, out) {
  const dir = _a.copy(target).sub(root); let d = dir.length();
  const maxD = (a + b) * 1.08; if (d > maxD) { dir.multiplyScalar(maxD / d); target = _b.copy(root).add(dir); d = maxD; }
  const s = d > a + b ? d / (a + b) : 1, A = a * s, B = b * s;
  const x = clamp((A * A - B * B + d * d) / (2 * Math.max(d, 1e-5)), -A, A), h = Math.sqrt(Math.max(0, A * A - x * x));
  const n = dir.normalize();
  const p = _c.copy(pole).sub(_d.copy(n).multiplyScalar(pole.dot(n))); if (p.lengthSq() < 1e-8) p.set(0, 0, 1); p.normalize();
  out.copy(root).addScaledVector(n, x).addScaledVector(p, h);
  return target;
}

// ---------- the torso: a bean (pear when hip > chest, V when chest > hip) with a round shoulder dome ----------
function torsoProfile(B) {
  const h = B.torso, rB = B.hip, rW = B.waist, rC = B.chest;
  const dTop = Math.min(.42, rC * .9 / h), dBot = Math.min(.3, rB * .6 / h), m = .5 * (dBot + 1 - dTop);
  const R = v => {
    if (v <= 0 || v >= 1) return 0;
    if (v <= dBot) { const k = (dBot - v) / dBot; return rB * Math.sqrt(Math.max(0, 1 - k * k)); }
    if (v >= 1 - dTop) { const k = (v - (1 - dTop)) / dTop; return rC * Math.sqrt(Math.max(0, 1 - k * k)); }
    if (v < m) return lerp(rB, rW, sstep(dBot, m, v));
    return lerp(rW, rC, sstep(m, 1 - dTop, v));
  };
  return { R, h, dTop, dBot };
}
function torsoGeo(T) {
  const pts = [], N = 44;
  for (let i = 0; i <= N; i++) { const v = .5 - .5 * Math.cos(PI * i / N); pts.push(new THREE.Vector2(T.R(v), v * T.h)); }
  const g = new THREE.LatheGeometry(pts, 56, PI, PI * 2);           // u = .5 is the front (+z)
  const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setY(i, p.getY(i) / T.h);
  return g;
}
/** a skirt / coat tail / kilt hanging from y top to the hem (torso space); open = half-angle of a front opening (coats) */
function bellGeo(T, o) {
  const h = T.h, gap = .007, rTop = T.R(o.top / h) + gap, rHem = o.r, pts = [];
  if (!o.open) pts.push(new THREE.Vector2(0, o.hem + .005), new THREE.Vector2(rHem * .6, o.hem + .003));
  pts.push(new THREE.Vector2(rHem - .008, o.hem - .001), new THREE.Vector2(rHem, o.hem + .01));
  const N = 16;
  for (let i = 1; i <= N; i++) { const k = i / N, y = lerp(o.hem + .01, o.top, k), flare = lerp(rHem, rTop, Math.pow(k, o.curve ?? .75)), body = y > 0 && y < h ? T.R(y / h) + gap : 0; pts.push(new THREE.Vector2(Math.max(flare, body), y)); }
  pts.push(new THREE.Vector2(rTop - gap * 2.5, o.top + .014));
  const g = o.open ? new THREE.LatheGeometry(pts, 48, o.open, PI * 2 - 2 * o.open) : new THREE.LatheGeometry(pts, 48, PI, PI * 2);
  g.userData.profile = pts; return g;
}
/** a ring hugging the torso at height y (belts, hems, collars): thickness t outward, half-height hh */
function bandGeo(T, y, t = .008, hh = .014) {
  const r = v => T.R(clamp(v / T.h, .001, .999));
  const pts = [[r(y - hh) - .004, y - hh], [r(y - hh) + t * .8, y - hh * .8], [r(y) + t, y], [r(y + hh) + t * .8, y + hh * .8], [r(y + hh) - .004, y + hh]].map(([a, b]) => new THREE.Vector2(a, b));
  return new THREE.LatheGeometry(pts, 48);
}

// ---------- painted clothes: one canvas per character wrapped on the bean (u = .5 front, v = height fraction) ----------
const SLEEVE = { tee: 'short', scrubs: 'short', 'shirt-open': 'short', blouse: 'short', dress: 'short', overalls: 'short', tank: 'none', robe: 'none' };
const BELL = { dress: 1, skirt: 1, labcoat: 1, tunic: 1, robe: 1, chef: 0 };
function paintTorso(look, B, T, skin) {
  const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const top = look.top || {}, bot = look.bottom || {}, ty = top.type || 'tee', main = top.color || '#888', h = B.torso, vW = B.waistV ?? .3, acc = look.acc || [];
  const Y = v => (1 - v) * H, X = a => W / 2 + a / (2 * PI) * W;
  const XM = (m, v) => X(m / Math.max(.035, T.R(clamp(v, .02, .98))));         // metres sideways from the front centre at height v
  const PXm = (m, v) => m / Math.max(.035, T.R(clamp(v, .02, .98))) / (2 * PI) * W, PYm = m => m / h * H;
  const ink = (w = 3.2, c = OL) => { x.strokeStyle = c; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; };
  const path = (pts, close) => { x.beginPath(); pts.forEach(([m, v], i) => i ? x.lineTo(XM(m, v), Y(v)) : x.moveTo(XM(m, v), Y(v))); if (close) x.closePath(); };
  const poly = (pts, fill, w = 3.2) => { path(pts, true); if (fill) { x.fillStyle = fill; x.fill(); } if (w) { ink(w); x.stroke(); } };
  const line = (pts, w = 3.2, c = OL) => { path(pts, false); ink(w, c); x.stroke(); };
  const mirror = (f) => { f(1); f(-1); };
  const dot = (m, v, r, fill, w = 2) => { x.beginPath(); x.ellipse(XM(m, v), Y(v), PXm(r, v), PYm(r), 0, 0, PI * 2); x.fillStyle = fill; x.fill(); if (w) { ink(w); x.stroke(); } };
  const band = (v0, v1, fill, w = 3.2) => { x.fillStyle = fill; x.fillRect(0, Y(v1), W, Y(v0) - Y(v1)); if (w) { ink(w); x.beginPath(); x.moveTo(0, Y(v1)); x.lineTo(W, Y(v1)); x.moveTo(0, Y(v0)); x.lineTo(W, Y(v0)); x.stroke(); } };
  const rib = (v0, v1, fill) => { band(v0, v1, fill, 2.6); ink(1.6, shade(fill, -.3)); for (let i = 0; i < W; i += 9) { x.beginPath(); x.moveTo(i, Y(v1) + 3); x.lineTo(i, Y(v0) - 3); x.stroke(); } };
  const buttons = (m, v0, v1, n, fill = shade(main, -.35), r = .007) => { for (let i = 0; i < n; i++) dot(m, lerp(v0, v1, n > 1 ? i / (n - 1) : 0), r, fill, 1.6); };
  const pocket = (m, v, w, hh, fill = main, flap = true) => { poly([[m - w / 2, v], [m + w / 2, v], [m + w / 2, v - hh / h], [m - w / 2, v - hh / h]], fill, 2.6); if (flap) poly([[m - w / 2 - .003, v + .004], [m + w / 2 + .003, v + .004], [m + w / 2 + .002, v - .022 / h], [m, v - .03 / h], [m - w / 2 - .002, v - .022 / h]], shade(fill, -.06), 2.6); };
  const vee = (w, vTop, vBot, fill) => poly([[-w, vTop + .1], [-w, vTop], [0, vBot], [w, vTop], [w, vTop + .1]], fill, 3.2);
  // 1. the base cloth (with its pattern)
  fillPattern(x, W, H, top.pattern, main, top.color2 || '#ffffff', h);
  // 2. bottoms on the torso: trousers / shorts (the lower part of the bean), with a fly seam
  const pants = ['pants', 'shorts'].includes(bot.type) ? bot.color : ty === 'overalls' ? main : null;
  if (pants && !['labcoat', 'robe', 'dress', 'tunic'].includes(ty)) { band(0, vW, pants, 0); line([[0, vW - .01], [0, vW - .2]], 2.4, shade(pants, -.4)); line([[0, vW - .2], [.02, vW - .26]], 2.4, shade(pants, -.4)); }
  // 3. the top's own details
  const neck = .93;
  switch (ty) {
    case 'tee': rib(vW, vW + .025, shade(main, -.06)); line([[-.1, neck + .01], [-.05, neck - .03], [0, neck - .045], [.05, neck - .03], [.1, neck + .01]], 4, shade(main, -.35)); break;
    case 'tank': mirror(s => { x.beginPath(); x.ellipse(X(s * PI / 2), Y(.98), PXm(.07, .9), PYm(.17), 0, 0, PI * 2); x.fillStyle = skin; x.fill(); ink(3.2, top.trim || shade(main, -.3)); x.stroke(); });
      poly([[-.06, 1.05], [-.06, .92], [0, .84], [.06, .92], [.06, 1.05]], skin, 3.2); line([[-.06, .92], [0, .84], [.06, .92]], 4, top.trim || shade(main, -.3)); rib(vW, vW + .02, top.trim || shade(main, -.1)); break;
    case 'sweater': rib(vW, vW + .06, shade(main, -.1)); rib(neck, 1, shade(main, -.1)); break;
    case 'cardigan': poly([[-.05, 1.1], [-.05, neck], [-.016, .62], [-.016, vW - .05], [.016, vW - .05], [.016, .62], [.05, neck], [.05, 1.1]], top.under || '#f3e9da', 3.2);
      buttons(.032, .62, vW + .04, 4, '#e9dcc0'); mirror(s => pocket(s * .085, vW + .14, .07, .055, main, false)); rib(vW - .02, vW + .03, shade(main, -.1)); break;
    case 'vest': x.fillStyle = top.under || '#f1eee4'; x.fillRect(0, 0, W, Y(vW)); // shirt everywhere, the vest over it
      x.fillStyle = main; x.fillRect(X(-PI * .62), Y(.86), X(PI * .62) - X(-PI * .62), Y(vW - .04) - Y(.86));
      poly([[-.055, .97], [0, .6], [.055, .97]], top.under || '#f1eee4', 3); line([[-.055, .97], [0, .6], [.055, .97]], 3.2);
      poly([[-.17, vW + .02], [-.012, vW + .02], [0, vW - .06], [.012, vW + .02], [.17, vW + .02], [.17, vW - .1], [-.17, vW - .1]], pants || '#6b5a48', 3); buttons(0, .56, vW + .04, 4, '#3a2a1a');
      line([[-.15, .86], [.15, .86]], 2.4, shade(main, -.3)); mirror(s => line([[s * .05, vW + .16], [s * .11, vW + .16]], 3)); break;
    case 'hoodie': rib(vW - .03, vW + .04, shade(main, -.1)); poly([[-.1, vW + .05], [.1, vW + .05], [.075, vW + .24], [-.075, vW + .24]], shade(main, -.05), 3);
      mirror(s => { line([[s * .028, .9], [s * .03, .72]], 3.2, '#f2efe6'); dot(s * .03, .71, .006, '#f2efe6', 1.4); }); break;
    case 'flannel': line([[0, neck], [0, vW - .02]], 3); buttons(.014, .86, vW + .05, 5, '#e9e2d0'); mirror(s => { poly([[0, 1.02], [s * .06, .95], [s * .045, .86], [s * .01, .93]], shade(main, -.12), 3); pocket(s * .07, .76, .06, .06); }); break;
    case 'blouse': mirror(s => poly([[0, .95], [s * .07, .95], [s * .075, .89], [s * .02, .87]], top.collar || shade(main, .55), 3)); buttons(0, .82, .6, 3, shade(main, .5)); rib(vW - .01, vW + .02, shade(main, -.08)); break;
    case 'uniform': line([[0, neck], [0, vW]], 3); buttons(.012, .86, vW + .05, 5, '#d8b450'); mirror(s => pocket(s * .07, .76, .065, .065, shade(main, .02)));
      mirror(s => { x.fillStyle = shade(main, -.15); x.fillRect(X(s * PI / 2) - 12, Y(1), 24, Y(.88) - Y(1)); }); poly([[-.1, .62], [-.05, .62], [-.05, .6], [-.1, .6]], '#e9e4d8', 1.6); break;
    case 'overalls': { const u = top.under || '#f6ecd9'; x.fillStyle = u; x.fillRect(0, 0, W, Y(vW + .02)); band(0, vW + .02, main, 0);
      poly([[-.075, vW], [-.068, .7], [.068, .7], [.075, vW]], main, 3.2); pocket(0, .62, .07, .06, shade(main, -.05), false);
      mirror(s => { line([[s * .055, .7], [s * .06, 1.05]], 13, main); line([[s * .055, .7], [s * .06, 1.05]], 2, shade(main, -.35)); dot(s * .058, .68, .009, '#f2c94c', 1.6);
        x.strokeStyle = main; x.lineWidth = 13; x.beginPath(); x.moveTo(X(s * (PI - .35)), Y(1)); x.lineTo(X(s * (PI - .45)), Y(vW + .02)); x.stroke(); });
      line([[-.4, vW + .02], [.4, vW + .02]], 2.6); break; }
    case 'suit': { vee(.055, .95, .56, top.under || '#f4f4f4'); if (top.tie) { poly([[-.012, .93], [.012, .93], [.014, .88], [-.014, .88]], shade(top.tie, -.1), 2); poly([[-.012, .88], [.012, .88], [.024, .56], [0, .52], [-.024, .56]], top.tie, 2.4); }
      mirror(s => poly([[s * .055, .95], [s * .12, .8], [s * .085, .76], [s * .1, .72], [s * .02, .58], [0, .56]], shade(main, -.1), 3)); line([[-.055, .95], [0, .56], [.055, .95]], 3.2);
      buttons(0, .48, .4, 2, '#1a1a1a'); mirror(s => line([[s * .07, .36], [s * .12, .35]], 3)); poly([[.07, .73], [.11, .73], [.105, .75], [.085, .76]], '#f4f4f4', 2); line([[0, .56], [0, vW - .06]], 2.6); break; }
    case 'puffer': { for (let v = vW - .04; v < 1; v += .07 / h) { const g = x.createLinearGradient(0, Y(v + .07 / h), 0, Y(v)); g.addColorStop(0, shade(main, -.12)); g.addColorStop(.5, shade(main, .08)); g.addColorStop(1, shade(main, -.12)); x.fillStyle = g; x.fillRect(0, Y(v + .07 / h), W, Y(v) - Y(v + .07 / h)); line([[-2, v], [2, v]], 2.2, shade(main, -.35)); }
      line([[0, 1], [0, vW - .04]], 4, shade(main, -.45)); line([[-.4, vW - .04], [.4, vW - .04]], 3); break; }
    case 'scrubs': vee(.045, .95, .74, shade(main, -.28)); line([[-.045, .95], [0, .74], [.045, .95]], 3.2); pocket(.07, .7, .06, .06, main, false); line([[.06, .72], [.06, .68]], 4, '#e2432f'); rib(vW, vW + .02, shade(main, -.08)); break;
    case 'jacket': rib(vW - .03, vW + .05, shade(main, -.15)); rib(.9, 1, shade(main, -.15)); line([[0, .9], [0, vW - .03]], 4, shade(main, -.45)); dot(0, .86, .008, '#c9c9c9', 1.4);
      mirror(s => line([[s * .07, vW + .2], [s * .1, vW + .1]], 4, shade(main, -.4))); poly([[.06, .74], [.1, .74], [.1, .7], [.06, .7]], '#e9b44c', 1.6); break;
    case 'leather': mirror(s => poly([[s * .02, 1.02], [s * .1, .9], [s * .07, .8], [s * .02, .9]], shade(main, .1), 3)); line([[.04, .86], [-.02, vW]], 4, '#9a9a9a'); line([[-.4, vW], [.4, vW]], 3.2);
      mirror(s => line([[s * .12, .7], [s * .14, .6]], 3, shade(main, .25))); break;
    case 'chef': { buttons(-.045, .74, .5, 3, '#d9d9d4', .009); buttons(.045, .74, .5, 3, '#d9d9d4', .009); line([[.075, .95], [.06, .7], [.065, vW - .05]], 3); band(.93, 1, shade(main, -.04), 2.4);
      if (top.collar) poly([[-.06, .96], [.06, .96], [0, .8]], top.collar, 3); line([[-.4, vW - .05], [.4, vW - .05]], 3); break; }
    case 'labcoat': { const g = .3; vee(.05, .95, .56, top.under || '#7da7d9'); if (top.tie) poly([[-.01, .92], [.01, .92], [.02, .6], [0, .57], [-.02, .6]], top.tie, 2.2);
      x.fillStyle = top.under || '#7da7d9'; x.beginPath(); x.moveTo(XM(-g * T.R(.56), .56), Y(.56)); x.lineTo(XM(-g * T.R(.3), .3), Y(.3)); x.lineTo(XM(g * T.R(.3), .3), Y(.3)); x.lineTo(XM(g * T.R(.56), .56), Y(.56)); x.fill();
      if (pants) { x.fillStyle = pants; x.fillRect(XM(-g * T.R(.3), .3), Y(vW), XM(g * T.R(.3), .3) - XM(-g * T.R(.3), .3), H - Y(vW)); }
      mirror(s => poly([[s * .05, .95], [s * .11, .8], [s * .08, .77], [s * .09, .73], [s * .015, .58], [0, .56]], shade(main, -.05), 3));
      mirror(s => line([[0, .56], [s * g * T.R(.4), .4], [s * g * T.R(.2), .2]], 3.2)); pocket(.085, .72, .065, .07, main, false); line([[.075, .74], [.075, .7]], 5, '#2f6fd1'); line([[.09, .745], [.09, .7]], 5, '#e2432f'); break; }
    case 'dress': rib(.4, .43, shade(main, -.15)); if (top.collar) mirror(s => { x.beginPath(); x.ellipse(XM(s * .035, .93), Y(.93), PXm(.045, .93), PYm(.035), 0, 0, PI * 2); x.fillStyle = top.collar; x.fill(); ink(3); x.stroke(); }); break;
    case 'shirt-open': vee(.05, .95, .62, top.under || skin); line([[-.05, .95], [0, .62], [.05, .95]], 3); line([[0, .62], [0, vW - .04]], 3); buttons(.012, .55, vW + .03, 3, '#f6ecd9');
      mirror(s => poly([[s * .05, .97], [s * .12, .9], [s * .09, .82], [s * .04, .9]], shade(main, -.08), 3)); line([[-.4, vW - .04], [.4, vW - .04]], 3); break;
    case 'safari': line([[0, neck], [0, vW]], 3); buttons(.012, .86, vW + .05, 4, '#6b4a2b'); mirror(s => { pocket(s * .072, .74, .07, .075, main); dot(s * .072, .715, .005, '#6b4a2b', 1); poly([[0, 1.02], [s * .065, .95], [s * .05, .86], [s * .01, .93]], shade(main, -.1), 3); }); break;
    case 'tunic': poly([[-.04, 1.05], [-.04, .95], [0, .74], [.04, .95], [.04, 1.05]], skin, 3); for (let i = 0; i < 3; i++) { const v = .9 - i * .055; line([[-.03 + i * .008, v], [.03 - i * .008, v - .04]], 2.2, '#e9dcc0'); line([[.03 - i * .008, v], [-.03 + i * .008, v - .04]], 2.2, '#e9dcc0'); } break;
    case 'armor': { rib(.88, .97, shade(main, -.15)); line([[0, .9], [0, .45]], 3); line([[-.14, .5], [-.07, .44], [0, .42], [.07, .44], [.14, .5]], 3);
      for (let v = .08; v < .42; v += .055) { band(v, v + .045, shade(main, (v * 7 % 1) * .06 - .05), 2.4); for (let a = -2.8; a < 3; a += .7) dot(a * .05, v + .022, .004, shade(main, -.3), 0); } break; }
    case 'robe': { const t2 = top.trim || '#e9b44c'; [['#e9b44c', .97], ['#2f5fb0', .93], [t2, .9], ['#c8442e', .86], ['#e9b44c', .82]].forEach(([c, v]) => band(v - .04, v, c, 2)); band(vW, vW + .05, t2, 2.6); break; }
    case 'flightsuit': line([[0, .95], [0, vW - .1]], 4, shade(main, -.4)); mirror(s => { pocket(s * .075, .75, .07, .07, shade(main, .03), false); line([[s * .045, .74], [s * .1, .7]], 2.4, shade(main, -.4)); });
      poly([[.05, .63], [.11, .63], [.11, .6], [.05, .6]], '#2a2a2a', 1.4); dot(-.12, .82, .022, '#2f5fb0', 2.2); break;
    case 'sailor': { const c2 = top.color2 || '#1d2b4f'; x.fillStyle = c2; x.fillRect(X(PI - .9), Y(1), X(PI) - X(PI - .9) + 1, Y(.68) - Y(1)); x.fillRect(0, Y(1), X(-PI + .9), Y(.68) - Y(1));
      mirror(s => poly([[s * .02, .64], [s * .12, .98], [s * .2, .98], [s * .12, .66]], c2, 3)); if (top.tie) poly([[-.03, .7], [.03, .7], [.018, .58], [0, .62], [-.018, .58]], top.tie, 2.6); break; }
    case 'spacesuit': { line([[0, .9], [0, vW]], 2, '#c9c9c4'); x.beginPath(); x.arc(XM(.085, .74), Y(.74), PXm(.03, .74), 0, PI * 2); x.fillStyle = '#2f5fb0'; x.fill(); ink(2.4); x.stroke();
      x.fillStyle = '#ffffff'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('★', XM(.085, .74), Y(.74) + 1); if (top.trim) band(.82, .85, top.trim, 1.6); break; }
    case 'wetsuit': mirror(s => { x.fillStyle = top.trim || '#f2c200'; x.fillRect(X(s * PI / 2) - 8, 0, 16, H); }); band(.66, .7, top.trim || '#f2c200', 0); line([[0, .95], [0, .75]], 4, '#5a6672'); break;
    case 'hazmat': { line([[0, .95], [0, vW - .05]], 7, shade(main, -.2)); x.beginPath(); const cx = XM(-.07, .72), cy = Y(.72), s = 26; x.moveTo(cx, cy - s); x.lineTo(cx + s * 1.1, cy + s * .85); x.lineTo(cx - s * 1.1, cy + s * .85); x.closePath(); x.fillStyle = '#1e1e1e'; x.fill();
      x.fillStyle = main; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', cx, cy + 6); break; }
  }
  // 4. things worn over the top
  if (top.vest) { // hi-vis vest: front panels + reflective bands around the body
    x.fillStyle = top.vest; x.fillRect(X(-PI * .7), Y(.86), X(PI * .7) - X(-PI * .7), Y(vW - .02) - Y(.86)); x.fillRect(0, Y(.86), X(-PI * .7) - 0, Y(vW - .02) - Y(.86)); x.fillRect(X(PI * .7), Y(.86), W - X(PI * .7), Y(vW - .02) - Y(.86));
    mirror(s => { x.beginPath(); x.ellipse(X(s * PI / 2), Y(.98), PXm(.065, .9), PYm(.16), 0, 0, PI * 2); x.fillStyle = main; x.fill(); });
    for (const v of [.45, .62]) band(v, v + .045, '#d8dde2', 2); line([[0, .86], [0, vW - .02]], 3); line([[-.4, vW - .02], [.4, vW - .02]], 3);
  }
  if (acc.some(a => /backpack|tank/.test(a))) mirror(s => { line([[s * .075, 1.05], [s * .08, .5]], 14, '#4a3624'); line([[s * .075, 1.05], [s * .08, .5]], 2, '#2a1d17'); });
  if (acc.includes('backpack')) line([[-.08, .7], [.08, .7]], 9, '#4a3624');
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping;
  return t;
}
function fillPattern(x, W, H, kind, a, b, h) {
  x.fillStyle = a; x.fillRect(0, 0, W, H);
  const pm = H / h;                                   // pixels per metre (vertical)
  if (kind === 'stripes') { x.fillStyle = b; const p = .06 * pm; for (let y = 0; y < H; y += p) x.fillRect(0, y, W, p * .45); }
  else if (kind === 'plaid') { const p = .085 * pm; x.globalAlpha = .45; x.fillStyle = shade(a, -.45); for (let i = 0; i < W; i += p) x.fillRect(i, 0, p * .34, H); for (let i = 0; i < H; i += p) x.fillRect(0, i, W, p * .34); x.globalAlpha = .4; x.fillStyle = '#f2efe6'; for (let i = p * .6; i < W; i += p) x.fillRect(i, 0, 3, H); for (let i = p * .6; i < H; i += p) x.fillRect(0, i, W, 3); x.globalAlpha = 1; }
  else if (kind === 'flowers') { const r = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7); for (let i = 0; i < 70; i++) { const cx = r() * W, cy = r() * H, s = 10 + r() * 8; x.fillStyle = b; for (let k = 0; k < 5; k++) { const an = k / 5 * PI * 2 + i; x.beginPath(); x.ellipse(cx + Math.cos(an) * s * .7, cy + Math.sin(an) * s * .7, s * .55, s * .38, an, 0, PI * 2); x.fill(); } x.fillStyle = '#f6c945'; x.beginPath(); x.arc(cx, cy, s * .32, 0, PI * 2); x.fill(); x.fillStyle = shade(a, -.25); x.beginPath(); x.ellipse(cx + s * 1.3, cy + s * .4, s * .5, s * .22, .6, 0, PI * 2); x.fill(); } }
  else if (kind === 'dots') { x.fillStyle = b; const p = .05 * pm; for (let y = 0, row = 0; y < H; y += p, row++) for (let i = (row % 2) * p / 2; i < W; i += p) { x.beginPath(); x.arc(i, y, p * .16, 0, PI * 2); x.fill(); } }
}
/** a stripes / plaid texture for sleeves and trouser legs (Noodle uv: x around, y along) */
const LIMBTEX = new Map();
function limbTex(kind, a, b, len) {
  const key = kind + a + b + len.toFixed(2); if (LIMBTEX.has(key)) return LIMBTEX.get(key);
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'); fillPattern(x, 64, 256, kind, a, b, .38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, len / .38);
  LIMBTEX.set(key, t); return t;
}

// ---------- head shells: hair, hats, hoods ----------
/** A shell around the head: polar angle (from the top) from top(phi) to edge(phi), radius R * (k + bump(phi, theta)).
 *  phi = 0 is the face (+z). Open edges roll inward under the skin, so a shell never shows a gap or z-fights. */
function helmet(R, o) {
  const NP = o.np ?? 72, NT = o.nt ?? 22, k = o.k ?? 1.04, edge = o.edge, top = o.top || null, bump = o.bump || (() => 0);
  const pos = [], uv = [], idx = [], rows = [];
  const P = (phi, th, rk) => { const r = R * rk; pos.push(r * Math.sin(th) * Math.sin(phi), r * Math.cos(th), r * Math.sin(th) * Math.cos(phi)); uv.push(phi / (2 * PI) + .5, 1 - th / PI); };
  const row = f => { const s = pos.length / 3; for (let j = 0; j < NP; j++) { const phi = -PI + j / NP * 2 * PI; f(phi); } rows.push(s); };
  let pole = -1;
  if (top) { row(phi => P(phi, Math.max(.001, top(phi) - .045), .955)); row(phi => P(phi, Math.max(.001, top(phi) - .012), k * .99 + bump(phi, top(phi)) * .5)); }
  else { pole = pos.length / 3; P(0, 0, k + bump(0, 0)); }
  for (let i = top ? 0 : 1; i <= NT; i++) row(phi => { const a = top ? top(phi) : 0, th = lerp(a, edge(phi), i / NT); P(phi, th, k + bump(phi, th)); });
  row(phi => P(phi, edge(phi) + .022, k * .992 + bump(phi, edge(phi)) * .6)); row(phi => P(phi, edge(phi) + .05, .955));
  if (pole >= 0) { const r1 = rows[0]; for (let j = 0; j < NP; j++) idx.push(pole, r1 + j, r1 + (j + 1) % NP); }
  for (let i = 0; i + 1 < rows.length; i++) { const a = rows[i], b = rows[i + 1]; for (let j = 0; j < NP; j++) { const j1 = (j + 1) % NP; idx.push(a + j, b + j, a + j1, a + j1, b + j, b + j1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** a hairline: polar angle of the shell's edge around the head: eF over the forehead, eS at the ears, eB at the nape */
const hairline = (eF, eS, eB, wf = .8) => phi => { const a = Math.abs(wrapPi(phi)); return a < PI / 2 ? lerp(eF, eS, sstep(wf, 1.5, a)) : lerp(eS, eB, sstep(1.65, 2.8, a)); };
const gauss = (d, w) => Math.exp(-(d * d) / (w * w));
function mesh(geo, mat, pos, rot, scl, ol = LINE.small) { const x = new THREE.Mesh(geo, mat); if (pos) x.position.set(...pos); if (rot) x.rotation.set(...rot); if (scl) x.scale.set(...scl); if (ol) addOutline(x, OL, ol); return x; }
function hairOf(type, color, R, o = {}) {
  const g = new THREE.Group(); if (!type || type === 'bald') return g;
  const m = toonMat(color, { rough: .6 }), under = o.underHat, add = (geo, pos, rot, scl) => { const x = mesh(geo, m, pos, rot, scl, LINE.small * 1.25); g.add(x); return x; };
  const cap = spec => add(helmet(R, spec));
  const top = (p, t) => .022 * Math.cos(t);                  // a little more volume on top
  switch (type) {
    case 'sweep': cap({ k: 1.045, edge: hairline(.31 * PI, .5 * PI, .6 * PI), bump: (p, t) => top(p, t) + (under ? 0 : .085 * gauss(wrapPi(p - .35), .55) * sstep(.04 * PI, .17 * PI, t) * (1 - sstep(.24 * PI, .32 * PI, t))) }); break;
    case 'short': cap({ k: 1.04, edge: hairline(.3 * PI, .5 * PI, .6 * PI), bump: top }); break;
    case 'buzz': cap({ k: 1.018, edge: hairline(.29 * PI, .47 * PI, .57 * PI), bump: (p, t) => .008 * Math.cos(t) }); break;
    case 'messy': cap({ k: 1.05, edge: p => hairline(.31 * PI, .5 * PI, .6 * PI)(p) + .035 * PI * Math.sin(9 * p) * (under ? 0 : 1), bump: (p, t) => top(p, t) + (under ? 0 : .04 * Math.sin(5 * p + 1) * Math.sin(4 * t)) }); break;
    case 'spiky': cap({ k: 1.04, edge: hairline(.3 * PI, .5 * PI, .6 * PI), bump: top });
      if (!under) for (let i = 0; i < 9; i++) { const a = (i / 8 - .5) * 2.4, b = i % 2 ? .18 : .1; add(new THREE.ConeGeometry(R * .16, R * .42, 10), [Math.sin(a) * R * .62, R * (.88 - Math.abs(a) * .08), -R * b + Math.cos(a) * R * .12], [-.35 - b, 0, -a * .55]); } break;
    case 'slick': { const c = cap({ k: 1.035, edge: hairline(.27 * PI, .48 * PI, .58 * PI), bump: (p, t) => .014 * Math.cos(t) - .014 * gauss(wrapPi(p - .5), .07) * (1 - sstep(.2 * PI, .34 * PI, t)) }); c.material = toonMat(color, { rough: .32 }); break; }
    case 'curly': cap({ k: under ? 1.05 : 1.13, edge: hairline(.3 * PI, .52 * PI, .62 * PI), bump: (p, t) => under ? 0 : .05 * Math.sin(7 * p) * Math.sin(6 * t + 1) + .035 * Math.sin(11 * p + 2) * Math.sin(9 * t) + .03 * Math.cos(t), np: 110, nt: 32 }); break;
    case 'tuft': cap({ k: 1.025, edge: hairline(.3 * PI, .42 * PI, .5 * PI), bump: (p, t) => .012 * Math.cos(t) });
      if (!under) add(new THREE.TorusGeometry(R * .13, R * .045, 8, 20, PI * 1.3), [R * .05, R * 1.06, R * .2], [0, PI / 2, .3]); break;
    case 'horseshoe': { const e = hairline(.5 * PI, .57 * PI, .6 * PI, .9); cap({ k: 1.03, edge: e, top: p => lerp(e(p), .4 * PI, sstep(.95, 1.5, Math.abs(wrapPi(p)))), bump: () => .01 }); break; }
    case 'bob': cap({ k: 1.07, edge: hairline(.33 * PI, .72 * PI, .66 * PI, .62), bump: (p, t) => .02 * Math.cos(t) + .055 * sstep(.38 * PI, .62 * PI, t), nt: 26 }); break;
    case 'long': cap({ k: 1.06, edge: hairline(.31 * PI, .74 * PI, .76 * PI, .64), bump: (p, t) => .02 * Math.cos(t) + .03 * sstep(.4 * PI, .7 * PI, t), nt: 26 });
      add(new THREE.SphereGeometry(R, 32, 20), [0, -R * .72, -R * .42], [.12, 0, 0], [.96, 1.02, .5]); break;
    case 'wavy': cap({ k: 1.08, edge: p => hairline(.32 * PI, .68 * PI, .72 * PI, .62)(p) + .03 * PI * Math.sin(8 * p), bump: (p, t) => .02 * Math.cos(t) + .045 * Math.sin(8 * p + 1) * sstep(.38 * PI, .65 * PI, t) + .03 * sstep(.4 * PI, .7 * PI, t), np: 96, nt: 26 }); break;
    case 'bun': cap({ k: 1.032, edge: hairline(.29 * PI, .5 * PI, .58 * PI, .8), bump: (p, t) => .015 * Math.cos(t) }); if (!under) add(new THREE.SphereGeometry(R * .3, 20, 14), [0, R * .9, -R * .5]); break;
    case 'ponytail': cap({ k: 1.032, edge: hairline(.29 * PI, .5 * PI, .58 * PI, .8), bump: (p, t) => .015 * Math.cos(t) });
      add(new THREE.SphereGeometry(R * .12, 12, 10), [0, R * .38, -R * 1.0]); add(new THREE.CapsuleGeometry(R * .16, R * .75, 6, 14), [0, -R * .1, -R * 1.2], [.32, 0, 0], [1, 1, .85]); break;
    case 'pigtails': cap({ k: 1.032, edge: hairline(.29 * PI, .5 * PI, .58 * PI, .8), bump: (p, t) => .015 * Math.cos(t) });
      for (const s of [-1, 1]) { add(new THREE.SphereGeometry(R * .1, 12, 10), [s * R * .95, R * .15, -R * .25]); add(new THREE.CapsuleGeometry(R * .14, R * .42, 6, 14), [s * R * 1.16, -R * .12, -R * .26], [0, 0, s * .5]); } break;
    case 'puffs': cap({ k: 1.03, edge: hairline(.29 * PI, .5 * PI, .58 * PI, .8), bump: (p, t) => .015 * Math.cos(t) });
      if (!under) for (const s of [-1, 1]) add(new THREE.SphereGeometry(R * .36, 22, 16), [s * R * .68, R * .8, -R * .14]); break;
    default: cap({ k: 1.04, edge: hairline(.3 * PI, .5 * PI, .6 * PI) });
  }
  return g;
}
// glass that reads in a toon frame: clear in the middle, a pale fresnel rim and an ink line at the silhouette
const GLASS = new Map();
function glassMat(tint = '#cdeeff', ink = true) {
  const key = tint + ink; if (GLASS.has(key)) return GLASS.get(key);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { tint: { value: new THREE.Color(tint) }, ink: { value: new THREE.Color(OL) }, inkOn: { value: ink ? 1 : 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 tint, ink; uniform float inkOn; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1. - abs(dot(normalize(vN), normalize(vV))); float fr = pow(f, 2.2);
        vec3 c = mix(tint, vec3(1.), fr * .6); float a = .06 + .55 * fr;
        float spec = smoothstep(.55, .6, dot(normalize(vN), normalize(vec3(-.5, .6, .62)))); c = mix(c, vec3(1.), spec * .85); a = max(a, spec * .75);
        if (inkOn > .5 && f > .93) { c = ink; a = 1.; }
        gl_FragColor = vec4(c, a); }` });
  m.userData.glass = true; GLASS.set(key, m); return m;
}
function hatOf(type, R, color) {
  const g = new THREE.Group(); if (!type) return g;
  const M = (c, o) => toonMat(c, o), add = (geo, mat, pos, rot, scl, ol = LINE.small) => { const x = mesh(geo, mat, pos, rot, scl, ol); g.add(x); return x; };
  switch (type) {
    case 'cap': case 'cap-back': {
      const c = color || '#2f6fb0', back = type === 'cap-back', h = new THREE.Group(); h.rotation.set(back ? -.2 : -.27, back ? PI : 0, 0); g.add(h);
      h.add(mesh(helmet(R, { k: 1.1, edge: () => .39 * PI, bump: (p, t) => .03 * Math.cos(t) }), M(c)));
      h.add(mesh(new THREE.CylinderGeometry(R * .74, R * .7, R * .11, 28, 1, false, -PI / 2, PI), M(shade(c, -.08)), [0, R * .33, R * .76], [.46, 0, 0], [1.02, 1, 1]));
      h.add(mesh(new THREE.SphereGeometry(R * .08, 10, 8), M(shade(c, -.1)), [0, R * 1.13, 0])); break; }
    case 'beanie': { const c = color || '#c8442e', h = new THREE.Group(); h.rotation.x = -.16; g.add(h);
      h.add(mesh(helmet(R, { k: 1.1, edge: () => .4 * PI, bump: (p, t) => .07 * Math.cos(t) * Math.cos(t) }), M(c, { rough: .95 })));
      h.add(mesh(helmet(R, { k: 1.15, top: () => .31 * PI, edge: () => .41 * PI, bump: () => 0 }), M(shade(c, -.12), { rough: .95 })));
      h.add(mesh(new THREE.SphereGeometry(R * .17, 14, 10), M('#f2efe6', { rough: 1 }), [0, R * 1.2, -R * .05])); break; }
    case 'officer': { const c = color || '#1c2a45', h = new THREE.Group(); h.rotation.x = -.1; h.position.y = R * .05; g.add(h);
      const crown = [[R * .86, R * .52], [R * .92, R * .62], [R * 1.0, R * .8], [R * 1.2, R * 1.0], [R * 1.17, R * 1.07], [R * .7, R * 1.1], [0, R * 1.1]].map(([a, b]) => new THREE.Vector2(a, b)).reverse();
      h.add(mesh(new THREE.LatheGeometry(crown.reverse(), 40), M(c)));
      h.add(mesh(new THREE.LatheGeometry([[R * .88, R * .5], [R * .95, R * .52], [R * .98, R * .66], [R * .9, R * .68]].map(([a, b]) => new THREE.Vector2(a, b)), 40), M('#111111', { rough: .4 })));
      h.add(mesh(new THREE.CylinderGeometry(R * .7, R * .7, R * .05, 24, 1, false, -PI / 2, PI), M('#111111', { rough: .3 }), [0, R * .52, R * .45], [.3, 0, 0], [1, 1, 1.05]));
      h.add(mesh(new THREE.SphereGeometry(R * .09, 10, 8), M('#e9b44c', { metal: .5, rough: .35 }), [0, R * .82, R * .98], null, [1, 1.2, .5], LINE.fine)); break; }
    case 'chef': { const c = color || '#fbfbf7';
      add(new THREE.CylinderGeometry(R * .9, R * .86, R * .38, 30, 1, true), M(c, { side: THREE.DoubleSide }), [0, R * .7, -R * .02], [-.08, 0, 0]);
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; add(new THREE.SphereGeometry(R * .42, 18, 14), M(c), [Math.sin(a) * R * .42, R * 1.12, Math.cos(a) * R * .4 - R * .05]); }
      add(new THREE.SphereGeometry(R * .5, 18, 14), M(c), [0, R * 1.28, -R * .05]); break; }
    case 'hardhat': { const c = color || '#f2c200', h = new THREE.Group(); h.rotation.x = -.14; g.add(h);
      h.add(mesh(helmet(R, { k: 1.13, edge: () => .42 * PI, bump: (p, t) => .03 * Math.cos(t) }), M(c, { rough: .4 })));
      h.add(mesh(new THREE.TorusGeometry(R * 1.12, R * .08, 10, 40), M(c, { rough: .4 }), [0, R * .27, R * .05], [PI / 2, 0, 0], [1, 1.12, .45]));
      h.add(mesh(new THREE.BoxGeometry(R * .14, R * .12, R * 1.5), M(shade(c, -.06), { rough: .4 }), [0, R * 1.12, 0], null, null, LINE.fine)); break; }
    case 'pith': { const c = color || '#d8c49a', h = new THREE.Group(); h.rotation.x = -.1; g.add(h);
      h.add(mesh(helmet(R, { k: 1.14, edge: () => .43 * PI, bump: (p, t) => .1 * Math.cos(t) }), M(c)));
      h.add(mesh(new THREE.LatheGeometry([[R * 1.62, R * .02], [R * 1.58, R * .07], [R * 1.25, R * .2], [R * 1.0, R * .3], [R * .96, R * .26]].map(([a, b]) => new THREE.Vector2(a, b)).reverse(), 44), M(c, { side: THREE.DoubleSide })));
      h.add(mesh(bandHat(R * 1.05, R * .26, R * .38), M(shade(c, -.35)), null, null, null, LINE.fine)); break; }
    case 'helmet': { const r = R * 1.34, cy = R * .12, ringY = -R * .86, th = Math.acos((ringY - cy) / r);
      const bub = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32, 0, PI * 2, 0, th), glassMat('#cdeeff')); bub.position.y = cy; bub.userData.noOutline = true; bub.renderOrder = 2; g.add(bub);
      add(new THREE.TorusGeometry(r * Math.sin(th), R * .12, 12, 40), M('#e8e8e4', { rough: .5 }), [0, ringY, 0], [PI / 2, 0, 0]); break; }
    case 'dive-mask': {
      add(new THREE.TorusGeometry(R * .5, R * .07, 10, 32), M('#1f2a33', { rough: .5 }), [0, R * .12, R * .9], [-.1, 0, 0], [1.3, .78, 1]);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(R * .5, 32), glassMat('#bfe8ff', false)); lens.position.set(0, R * .12, R * .93); lens.rotation.x = -.1; lens.scale.set(1.3, .78, 1); lens.userData.noOutline = true; g.add(lens);
      add(new THREE.TorusGeometry(R * 1.02, R * .045, 8, 40), M('#1f2a33'), [0, R * .14, 0], [PI / 2 - .08, 0, 0]);
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[R * .9, R * .25, R * .35], [R * 1.08, R * .7, R * .1], [R * 1.08, R * 1.25, 0]].map(p => new THREE.Vector3(...p))), 16, R * .05, 8), M('#f2c200', { rough: .4 })); break; }
    case 'hazmat-hood': { const c = color || '#f2c94c';
      add(helmet(R, { k: 1.13, edge: hairline(.25 * PI, .86 * PI, .86 * PI, .62), bump: (p, t) => .03 * Math.cos(t) }), M(c));
      add(helmet(R, { k: 1.13, top: p => lerp(.76 * PI, .86 * PI, sstep(.62, 1.2, Math.abs(wrapPi(p)))), edge: () => .86 * PI }), M(c));
      const v = new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 32, 20, -.72, 1.44, .24 * PI, .53 * PI), glassMat('#c8f0ff')); v.userData.noOutline = true; v.renderOrder = 2; g.add(v); break; }
    case 'helm': { const c = color || '#b9c0c8', mm = M(c, { metal: .6, rough: .35 });
      add(helmet(R, { k: 1.12, edge: hairline(.36 * PI, .8 * PI, .8 * PI, .5), bump: (p, t) => .02 * Math.cos(t) }), mm);
      add(helmet(R, { k: 1.12, top: p => lerp(.7 * PI, .8 * PI, sstep(.5, 1.1, Math.abs(wrapPi(p)))), edge: () => .8 * PI }), mm);
      add(new THREE.BoxGeometry(R * .1, R * .5, R * .08), mm, [0, R * .15, R * 1.1], [-.1, 0, 0], null, LINE.fine);
      add(new THREE.SphereGeometry(R * .3, 16, 12), M('#c8442e', { rough: .9 }), [0, R * 1.2, -R * .3], [-.6, 0, 0], [.35, 1, 1.4]); break; }
    case 'nemes': { const tex = stripeTex('#e9b44c', '#2f5fb0', 14), mm = new THREE.MeshStandardMaterial({ map: tex, roughness: .7 });
      add(helmet(R, { k: 1.09, edge: hairline(.31 * PI, .6 * PI, .7 * PI, .7), bump: (p, t) => .03 * Math.cos(t) }), mm);
      for (const s of [-1, 1]) add(new THREE.CapsuleGeometry(R * .22, R * .9, 6, 12), mm, [s * R * .92, -R * .62, R * .08], [.1, 0, s * .12], [1, 1, .38]);
      add(new THREE.SphereGeometry(R * .08, 10, 8), M('#e9b44c', { metal: .5, rough: .3 }), [0, R * .62, R * 1.0], null, [1, 1.4, .6], LINE.fine); break; }
    case 'pilot-cap': { const c = color || '#6b4a2b';
      add(helmet(R, { k: 1.06, edge: hairline(.3 * PI, .72 * PI, .62 * PI, .75), bump: (p, t) => .015 * Math.cos(t) }), M(c, { rough: .55 }));
      add(new THREE.TorusGeometry(R * 1.075, R * .05, 8, 40), M('#3a2a1a'), [0, R * .58, 0], [PI / 2 - .25, 0, 0]);
      for (const s of [-1, 1]) { const ang = s * .32, p = [Math.sin(ang) * R * 1.02, R * .6, Math.cos(ang) * R * .9];
        add(new THREE.TorusGeometry(R * .17, R * .055, 8, 20), M('#8a8f96', { metal: .5, rough: .35 }), p, [-.55, ang, 0]);
        const l = new THREE.Mesh(new THREE.CircleGeometry(R * .17, 20), glassMat('#bfe3f2', false)); l.position.set(...p); l.rotation.set(-.55, ang, 0); l.userData.noOutline = true; g.add(l); } break; }
    case 'sailor': { const h = new THREE.Group(); h.rotation.x = -.18; h.position.set(0, R * .05, -R * .05); g.add(h);
      h.add(mesh(new THREE.LatheGeometry([[0, R * 1.08], [R * .7, R * 1.07], [R * .84, R * 1.0], [R * .86, R * .62], [R * .8, R * .55]].map(([a, b]) => new THREE.Vector2(a, b)).reverse(), 36), M(color || '#fbfbf7')));
      h.add(mesh(new THREE.TorusGeometry(R * .9, R * .085, 10, 36), M(color || '#fbfbf7'), [0, R * .62, 0], [PI / 2, 0, 0]));
      h.add(mesh(new THREE.TorusGeometry(R * .86, R * .03, 6, 36), M('#1d2b4f'), [0, R * .74, 0], [PI / 2, 0, 0], null, 0)); break; }
  }
  return g;
}
function bandHat(r, y0, y1) { return new THREE.LatheGeometry([[r - .005, y0], [r + .004, y0 + .004], [r + .004, y1 - .004], [r - .005, y1]].map(([a, b]) => new THREE.Vector2(a, b)), 40); }
function stripeTex(a, b, n) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * 256 / n, 0, 256 / n + 1, 64); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
// hats that hide all hair / leave the cap only
const FULL_HAT = new Set(['helmet', 'hazmat-hood', 'helm', 'nemes', 'pilot-cap']);

// ---------- face accessories (placed from the face sprite's eye positions) ----------
function accessory(a, R, look) {
  const g = new THREE.Group(); const ink = toonMat('#2a1d17', { rough: .5 });
  const fs = look.face?.scale ?? 1, fy = look.face?.y ?? 0;
  const eye = s => { const x = (s > 0 ? .68 - .5 : .322 - .5) * 2 * fs, y = (.543 - .5) * 2 * fs + fy; return new THREE.Vector3(x, y, Math.sqrt(Math.max(.05, 1 - x * x - y * y))).normalize(); };
  const onFace = (obj, d, r) => { obj.position.copy(d).multiplyScalar(r); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); };
  if (/glasses/.test(a)) {
    const sun = a === 'sunglasses', rr = R * (sun ? .21 : .2);
    for (const s of [-1, 1]) {
      const d = eye(s), ring = mesh(new THREE.TorusGeometry(rr, R * .026, 8, 28), ink, null, null, a === 'glasses' ? [1.12, .86, 1] : null, LINE.fine); onFace(ring, d, R * 1.07); g.add(ring);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(rr, 28), sun ? toonMat('#151518', { rough: .15 }) : glassMat('#e8f6ff', false)); onFace(lens, d, R * 1.065); if (a === 'glasses') lens.scale.set(1.12, .86, 1); lens.userData.noOutline = true; g.add(lens);
      if (sun) { const gl = new THREE.Mesh(new THREE.CircleGeometry(rr * .22, 12), toonMat('#ffffff', { emissive: '#ffffff', ei: .4 })); onFace(gl, d, R * 1.075); gl.position.add(new THREE.Vector3(-rr * .35, rr * .35, 0)); gl.userData.noOutline = true; g.add(gl); }
      // the temple going back along the side of the head
      const d2 = d.clone(); const pts = [new THREE.Vector3(d2.x + s * .2, d2.y, d2.z * .9).normalize().multiplyScalar(R * 1.05), new THREE.Vector3(s * .93, d2.y * .9, .3).normalize().multiplyScalar(R * 1.04), new THREE.Vector3(s * .9, d2.y * .7, -.35).normalize().multiplyScalar(R * 1.02)];
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, R * .018, 6), ink, null, null, null, 0));
    }
    const l = eye(-1), r = eye(1), mid = l.clone().add(r).normalize(); mid.y += .06;
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([l.clone().lerp(r, .3).normalize().multiplyScalar(R * 1.07), mid.clone().normalize().multiplyScalar(R * 1.09), l.clone().lerp(r, .7).normalize().multiplyScalar(R * 1.07)]), 8, R * .02, 6), ink, null, null, null, LINE.fine));
  }
  const hairC = look.hair?.color || '#3b2416';
  if (a === 'mustache') { const m = toonMat(hairC === '#e6e6e6' || hairC === '#dcdcdc' ? '#f2f2f2' : hairC, { rough: .7 });
    for (const s of [-1, 1]) { const d = new THREE.Vector3(s * .17, -.27, .95).normalize(), x = mesh(new THREE.SphereGeometry(R * .2, 16, 12), m, null, null, [1.05, .5, .45], LINE.small); onFace(x, d, R * .99); x.rotateZ(s * -.28); g.add(x); } }
  if (a === 'beard') { const m = toonMat(hairC, { rough: .8 });
    // the cheek line rises from under the mouth to below the cheekbones, never to the eyes (short 03: a beard reaching
    // eye level read as a black mask on a profile)
    g.add(mesh(helmet(R, { k: 1.04, top: p => { const q = Math.abs(wrapPi(p)); return q < 1.3 ? lerp(.755 * PI, .62 * PI, sstep(.45, 1.2, q)) : lerp(.62 * PI, .9 * PI, sstep(1.3, 1.75, q)); }, edge: () => .9 * PI, bump: (p, t) => .05 * sstep(.75 * PI, .88 * PI, t) * Math.max(0, Math.cos(p)) }), m, null, null, null, LINE.small)); }
  return g;
}
function backpack(kind, B, T) {
  const g = new THREE.Group(), h = B.torso, rBack = T.R(.55) * .88;
  if (kind === 'backpack') { g.add(mesh(new THREE.CapsuleGeometry(B.chest * .55, h * .32, 6, 14), toonMat('#7a5a3a'), [0, h * .55, -rBack - B.chest * .28], null, [1.15, 1, .6])); g.add(mesh(new THREE.BoxGeometry(B.chest * .8, h * .14, B.chest * .2), toonMat('#5e4329'), [0, h * .42, -rBack - B.chest * .58], null, null, LINE.fine)); }
  else for (const s of (kind === 'air-tank' ? [0] : [-1, 1])) g.add(mesh(new THREE.CapsuleGeometry(B.chest * .3, h * .42, 6, 14), toonMat(kind === 'air-tank' ? '#f2c200' : '#e8e8e4', { rough: .45 }), [s * B.chest * .34, h * .56, -rBack - B.chest * .25]));
  return g;
}

// ---------- hands and shoes ----------
// a hand's frame: -y = the fingers' direction (along the forearm), +z = the palm's normal, +x * side = the thumb side
function mitten(color, k, sd, mat = null) {
  const g = new THREE.Group(), m = mat || toonMat(color, { rough: .7 }), rp = .025 * k;
  const palm = mesh(new THREE.SphereGeometry(1, 20, 14), m, null, null, null, LINE.fine); g.add(palm);
  const thumb = mesh(new THREE.CapsuleGeometry(rp * .36, rp * .5, 4, 10), m, null, null, null, LINE.fine); g.add(thumb);
  const finger = mesh(new THREE.CapsuleGeometry(rp * .34, rp * 1.05, 4, 10), m, null, null, null, LINE.fine); g.add(finger);
  g.userData = { palm, thumb, finger, rp, sd, grip: null };
  setGrip(g, 'mitt'); return g;
}
const GRIPS = {   // palm scale [x, y, z] and centre y (in palm radii), thumb [x, y, z] position + [rx, rz] rotation, finger on/off
  mitt:  { p: [1, 1.18, .78], py: -.95, t: [.78, -.78, .3], tr: [0, .42] },
  fist:  { p: [.96, .94, .9], py: -.82, t: [.3, -.72, .78], tr: [0, 1.35] },
  hold:  { p: [.96, 1.04, .86], py: -.88, t: [.55, -.55, .72], tr: [-.55, .35] },
  open:  { p: [1.16, 1.3, .58], py: -1.1, t: [1.12, -.55, .1], tr: [0, 1.0] },
  flat:  { p: [1.08, 1.3, .55], py: -1.1, t: [.86, -.82, .12], tr: [0, .25] },
  point: { p: [.96, .94, .9], py: -.82, t: [.35, -.7, .78], tr: [0, 1.3], f: true },
  thumb: { p: [.96, .94, .9], py: -.82, t: [1.05, -.72, .2], tr: [0, PI / 2] },
};
function setGrip(hand, grip) {
  const u = hand.userData; if (u.grip === grip) return; u.grip = grip;
  const G = GRIPS[grip] || GRIPS.mitt, r = u.rp, sd = u.sd;
  u.palm.scale.set(G.p[0] * r, G.p[1] * r, G.p[2] * r); u.palm.position.set(0, G.py * r, 0);
  u.thumb.position.set(sd * G.t[0] * r, G.t[1] * r, G.t[2] * r); u.thumb.rotation.set(G.tr[0], 0, sd * G.tr[1]);
  u.finger.visible = !!G.f; u.finger.position.set(-sd * .1 * r, -1.75 * r, .2 * r);
}
/** where a held prop's grip point goes, in the hand's frame (in front of the palm) */
const gripOffset = (hand) => { const r = hand.userData.rp; return new THREE.Vector3(0, -.9 * r, .55 * r); };
function shoe(color, k, style) {
  const g = new THREE.Group(), m = toonMat(color, { rough: .6 }), L = .056 * k, Wd = .03 * k, Ht = .027 * k;
  if (style === 'fin') { g.add(mesh(new THREE.SphereGeometry(1, 20, 12), m, [0, Ht * .7, L * .2], null, [Wd, Ht * .8, L * .9])); g.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 20, 1, false, -PI / 2, PI), toonMat(shade(color, -.1), { rough: .5 }), [0, .006 * k, L * .7], null, [Wd * 1.7, .01 * k, L * 2.2], LINE.fine)); return g; }
  g.add(mesh(new THREE.SphereGeometry(1, 22, 14), m, [0, Ht * .9, L * .32], null, [Wd, Ht * (style === 'sandal' ? .6 : 1), L], LINE.small));
  g.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 22), toonMat(shade(color, style === 'sandal' ? -.15 : -.4)), [0, .006 * k, L * .3], null, [Wd * 1.03, .012 * k, L * 1.02], 0));
  if (style === 'boot') g.add(mesh(new THREE.CylinderGeometry(Wd * .92, Wd * .98, Ht * 2.2, 18), m, [0, Ht * 1.7, 0], null, null, LINE.small));
  return g;
}

/** make a Noodle's triangles face outward (lib/geo.js builds them inward: the tube then shows its far wall, lit from
 *  behind, and its outline hull covers it). Checked on a test path, so it stays right if geo.js gets fixed. */
function outward(n) {
  n.setPath([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -.1, 0), new THREE.Vector3(0, -.2, 0)], .01);
  const p = n.geometry.attributes.position, nr = n.geometry.attributes.normal, ix = n.geometry.index.array;
  const v = i => new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)), a = v(ix[0]), b = v(ix[1]), c = v(ix[2]);
  const fn = b.sub(a).cross(c.sub(a)), vn = new THREE.Vector3(nr.getX(ix[0]), nr.getY(ix[0]), nr.getZ(ix[0]));
  if (fn.dot(vn) < 0) { for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } n.geometry.index.needsUpdate = true; }
  return n;
}

// ---------- the character ----------
const LONG =['pants', 'overalls', 'spacesuit', 'wetsuit', 'hazmat', 'flightsuit', 'armor'];
export class Toon {
  /** spec: a CAST id or { ...look }, plus overrides { outfit, scale, name, face: { scale, y }, top, bottom, hair, hat, acc } */
  constructor(spec = 'milo', over = {}) {
    const base = typeof spec === 'string' ? (CAST[spec] || CAST.milo) : spec;
    const look = { ...base, ...over };
    if (look.outfit && OUTFITS[look.outfit]) { const O = OUTFITS[look.outfit]; if (O.hat && !O.hatColor) delete look.hatColor;
      Object.assign(look, O, { acc: [...(base.acc || []).filter(a => !(O.hat === 'dive-mask' && /glasses/.test(a))), ...(O.acc || [])] }); }
    this.id = typeof spec === 'string' ? spec : look.id || 'custom'; this.look = look; this.name = look.name || this.id;
    const B = this.B = { ...(BODY[look.body] || BODY.regular) };
    const k = (look.scale ?? 1); for (const key of ['head', 'torso', 'hip', 'waist', 'chest', 'limb', 'leg', 'arm']) B[key] *= k;
    const top = look.top || {}, bot = look.bottom || {}, ty = top.type || 'tee';
    if (['spacesuit', 'hazmat', 'puffer'].includes(ty)) { B.hip *= 1.08; B.waist *= 1.08; B.chest *= 1.1; }
    const T = this.T = torsoProfile(B);
    // the white-face palette (project setting) or one white-headed character; look.palette: 'skin' keeps a character's tone
    const white = look.skin === 'white' || (SETTINGS.characters?.palette === 'white' && look.palette !== 'skin');
    const skin = this.skin = white ? SKIN.white : (SKIN[look.skin] || look.skin || SKIN.light), R = B.head; this.white = white;
    const limbs = look.limbs || (ty === 'puffer' ? { arm: 1.9, leg: 1 } : {});
    B.armR = B.limb * (limbs.arm ?? 1); B.legR = B.limb * 1.08 * (limbs.leg ?? 1);
    this.hk = R / .245;                       // detail scale (hands, shoes) follows the head
    const root = this.root = new THREE.Group(); root.userData.toon = this; root.userData.pickRoot = true; root.name = this.name;
    const body = this.body = new THREE.Group(); root.add(body);
    this.hips = new THREE.Group(); body.add(this.hips);
    // torso (scaled by squash / stretch)
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    const tex = paintTorso(look, B, T, skin);
    const tm = new THREE.MeshStandardMaterial({ map: tex, roughness: ty === 'armor' ? .38 : ty === 'leather' ? .45 : .82, metalness: ty === 'armor' ? .55 : 0 });
    this.torsoMesh = mesh(torsoGeo(T), tm, null, null, null, LINE.body); this.torso.add(this.torsoMesh);
    this._dressTorso(look, B, T, skin);
    // chest (pivot at 45 % of the torso): shoulders, head, things on the back
    this.chest = new THREE.Group(); this.hips.add(this.chest);
    this.neck = new THREE.Group(); this.chest.add(this.neck);
    this.head = new THREE.Group(); this.neck.add(this.head); this.head.position.y = R * .68 + .03;
    this.face = faceMaterial(skin, { R, ...(look.face || {}), acc: look.acc || [], white }); const sm = (c, rough) => white && c === skin ? whiteSkinMat(c, rough ?? .8) : toonMat(c, rough != null ? { rough } : {});
    const headMesh = this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), this.face.material); headMesh.scale.set(1, .97, .98);
    this.head.add(headMesh); addOutline(headMesh, OL, LINE.body);
    const fullHat = FULL_HAT.has(look.hat);
    this.hair = fullHat ? new THREE.Group() : hairOf(look.hair?.type, look.hair?.color || '#3b2416', R, { underHat: !!look.hat && !['dive-mask'].includes(look.hat) }); this.head.add(this.hair);
    this.hat = hatOf(look.hat, R, look.hatColor); this.head.add(this.hat);
    for (const a of look.acc || []) this.head.add(accessory(a, R, look));
    const pack = (look.acc || []).find(a => /back|tank/.test(a)); if (pack) { const bp = backpack(pack, B, T); bp.position.y = -B.torso * .45; this.chest.add(bp); }
    // limbs: noodles in BODY space
    const sl = SLEEVE[ty] ?? 'long', sleeveCol = ty === 'vest' ? (top.under || '#f1eee4') : ty === 'overalls' ? (top.under || '#f6ecd9') : top.color || '#888';
    const pat = top.pattern && ['stripes', 'plaid'].includes(top.pattern) ? limbTex(top.pattern, top.color, top.color2 || '#fff', B.arm) : null;
    const armMat = sl === 'long' ? (pat ? new THREE.MeshStandardMaterial({ map: pat, roughness: .82 }) : toonMat(sleeveCol)) : sm(skin);
    this.arms = { L: outward(new Noodle(armMat, 18, 10, B.armR)), R: outward(new Noodle(armMat, 18, 10, B.armR)) };
    const legCol = LONG.includes(bot.type) ? (bot.color || top.color) : bot.type === 'legs' && bot.color ? bot.color : skin;
    this.legs = { L: outward(new Noodle(sm(legCol), 16, 10, B.legR)), R: outward(new Noodle(sm(legCol), 16, 10, B.legR)) };
    for (const n of [...Object.values(this.arms), ...Object.values(this.legs)]) { body.add(n); addOutline(n, OL, LINE.limb * (n.r > .02 ? 1.4 : 1)); }
    if (sl === 'short') { const m = pat ? new THREE.MeshStandardMaterial({ map: pat, roughness: .82 }) : toonMat(sleeveCol); this.sleeves = { L: outward(new Noodle(m, 8, 12, B.armR * 2.3)), R: outward(new Noodle(m, 8, 12, B.armR * 2.3)) }; for (const n of Object.values(this.sleeves)) { body.add(n); addOutline(n, OL, LINE.small); } }
    if (bot.type === 'shorts') { const m = toonMat(bot.color || '#3d5a80'); this.shorts = { L: outward(new Noodle(m, 8, 12, B.legR * 3)), R: outward(new Noodle(m, 8, 12, B.legR * 3)) }; for (const n of Object.values(this.shorts)) { body.add(n); addOutline(n, OL, LINE.small); } }
    this.hands = { L: mitten(look.gloves || skin, this.hk * (limbs.arm > 1.5 ? 1.25 : 1), 1, look.gloves ? null : sm(skin, .7)), R: mitten(look.gloves || skin, this.hk * (limbs.arm > 1.5 ? 1.25 : 1), -1, look.gloves ? null : sm(skin, .7)) }; body.add(this.hands.L, this.hands.R);
    const sk = this.hk * (limbs.leg > 1.5 ? 1.3 : 1);
    this.ankleH = .045 * sk;
    this.feet = { L: shoe(look.shoes || '#333', sk, look.boots), R: shoe(look.shoes || '#333', sk, look.boots) }; root.add(this.feet.L, this.feet.R);
    if (ty === 'armor') for (const s of [-1, 1]) { const p = mesh(new THREE.SphereGeometry(B.chest * .5, 20, 14, 0, PI * 2, 0, PI * .55), toonMat(top.color, { metal: .55, rough: .35 }), [s * B.chest * .82, B.torso * .4, 0], [0, 0, -s * .5]); this.chest.add(p); }
    this.held = { L: null, R: null };
    this._curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, -1, 0)], false, 'centripetal', .5);
    root.traverse(o => { if (o.isMesh && !o.userData.isOutline) { o.castShadow = !o.material?.userData?.glass; o.receiveShadow = false; } });
    this.pose = POSE0(); this.apply(this.pose);
  }
  _dressTorso(look, B, T, skin) {
    const top = look.top || {}, bot = look.bottom || {}, ty = top.type || 'tee', h = B.torso, vW = B.waistV ?? .3, main = top.color || '#888';
    const add = (geo, mat, ol = LINE.small) => { const x = mesh(geo, mat, null, null, null, ol); this.torso.add(x); return x; };
    // belts
    const belt = ty === 'uniform' ? '#151515' : ty === 'safari' ? '#5a3a20' : ['spacesuit', 'flightsuit'].includes(ty) ? '#5c6066' : ty === 'hazmat' ? '#1e1e1e' : top.belt || (['pants'].includes(bot.type) && ['tee', 'tank', 'scrubs', 'blouse', 'sweater', 'flannel'].includes(ty) && look.body !== 'kid' ? shade(bot.color || '#333', -.45) : null);
    if (belt) { add(bandGeo(T, vW * h + (ty === 'tunic' ? .03 : 0), .007, .013), toonMat(belt, { rough: .5 })); if (['uniform', 'safari', 'tunic', 'flightsuit'].includes(ty) || top.belt) { const b = mesh(new THREE.BoxGeometry(.045, .032, .014), toonMat('#d8b450', { metal: .5, rough: .4 }), [0, vW * h + (ty === 'tunic' ? .03 : 0), T.R(vW) + .01], null, null, LINE.fine); this.torso.add(b); } }
    // skirts, coat tails, kilts
    const kid = look.body === 'kid';
    if (ty === 'dress') add(bellGeo(T, { top: h * .42, hem: -B.leg * (kid ? .28 : .45), r: B.hip * 1.42 }), toonMat(main), LINE.body);
    if (bot.type === 'skirt' && ty !== 'dress') add(bellGeo(T, { top: h * vW, hem: -B.leg * .55, r: B.hip * 1.32, curve: .9 }), toonMat(bot.color), LINE.body);
    if (ty === 'tunic') add(bellGeo(T, { top: h * (vW + .02), hem: -B.leg * .3, r: B.hip * 1.28 }), toonMat(main), LINE.body);
    if (ty === 'robe') add(bellGeo(T, { top: h * vW, hem: -B.leg * .5, r: B.hip * 1.25, curve: 1 }), new THREE.MeshStandardMaterial({ map: pleatTex(main), roughness: .85 }), LINE.body);
    if (ty === 'labcoat') { const g = .3, geo = bellGeo(T, { top: h * .4, hem: -B.leg * .36, r: B.hip * 1.22, open: g, curve: 1.2 }); add(geo, toonMat(main, { side: THREE.DoubleSide }), 0);
      for (const s of [-1, 1]) { const pts = geo.userData.profile.map(p => new THREE.Vector3(Math.sin(s * g) * p.x, p.y, Math.cos(s * g) * p.x)); add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .0055, 6), toonMat(shade(main, -.04)), LINE.small); } }
    // collars, hoods, scarves, chest boxes, badges
    if (ty === 'hoodie') { const t = new THREE.TorusGeometry(B.chest * .82, .045 * (B.chest / .148), 12, 32, PI * 1.25); t.rotateZ(-PI * .125); t.rotateX(-PI / 2); const x = add(t, toonMat(shade(main, -.1))); x.position.set(0, h * .955, -.025); x.rotation.x = .3; }
    if (ty === 'puffer') { const x = add(new THREE.CylinderGeometry(B.chest * .7, B.chest * .82, .07, 28, 1, true), toonMat(shade(main, -.05), { side: THREE.DoubleSide })); x.position.y = h * .975; }
    if ((look.acc || []).includes('scarf')) { const c = '#c8442e'; const x = add(new THREE.TorusGeometry(B.chest * .66, .036, 10, 30), toonMat(c, { rough: .95 })); x.rotation.x = PI / 2 - .12; x.position.set(0, h * .955, .01);
      const tail = add(new THREE.CapsuleGeometry(.03, .14, 4, 10), toonMat(shade(c, -.06), { rough: .95 })); tail.scale.z = .5; tail.position.set(B.chest * .38, h * .82, T.R(.85) + .02); tail.rotation.z = .12; }
    if (ty === 'spacesuit') { const x = add(new THREE.BoxGeometry(.13, .075, .05), toonMat('#d9d9d4', { rough: .5 })); x.position.set(0, h * .6, T.R(.6) + .015);
      ['#e2432f', '#f2c200', '#4caf50'].forEach((c, i) => { const b = mesh(new THREE.SphereGeometry(.009, 8, 6), toonMat(c, { emissive: c, ei: .4 }), [-.035 + i * .035, h * .6, T.R(.6) + .041], null, [1, 1, .5], 0); this.torso.add(b); }); }
    if (top.badge) { const b = mesh(new THREE.CylinderGeometry(.022, .022, .008, 6), toonMat('#e9b44c', { metal: .55, rough: .35 }), null, [PI / 2, 0, 0], null, LINE.fine); const v = .74, a = .55; b.position.set(Math.sin(a) * (T.R(v) + .003), v * h, Math.cos(a) * (T.R(v) + .003)); b.rotation.set(PI / 2, a, 0, 'YXZ'); this.torso.add(b); }
  }
  /** total height to the top of the head (m, without hair) */
  get height() { return this.B.leg + this.B.torso + this.B.head * (.68 + .97) + .03; }
  /** shoulder of side 'L' | 'R' in the chest's frame */
  _shoulder(s, P, sy, sx, out) {
    const B = this.B, T = this.T, sd = s === 'L' ? 1 : -1;
    if (this.vS == null) {       // as high on the dome as it can be while staying clear of the head (kids have big heads)
      const hcY = B.torso + B.head * .68; let v = 1 - T.dTop * .58;
      while (v > .55 && Math.hypot(T.R(v) * .84, hcY - v * B.torso) < B.head * 1.1) v -= .01;
      this.vS = v;
    }
    const vS = this.vS;
    const raise = (P['s' + s] ?? P.sh ?? 0) * B.torso;
    return out.set(sd * T.R(vS) * .84 * sx, (vS - .45) * B.torso * sy + raise, 0);
  }
  /** apply a pose (all fields of POSE0) */
  apply(P) {
    const B = this.B, T = this.T, h = B.torso; this.pose = P;
    const sq = P.squash || 0, sy = 1 - sq, sx = sq > 0 ? 1 + sq * .45 : 1 - sq * .12;
    this.hips.position.set(P.px || 0, B.leg + (P.bob || 0), P.pz || 0);
    this.hips.rotation.set((P.lean || 0) * .7, (P.twist || 0) * .4, -(P.roll || 0), 'YXZ');
    this.torso.scale.set(sx, sy, sx * .88);
    this.chest.position.set(0, h * .45 * sy, 0);
    this.chest.rotation.set((P.lean || 0) * .3 + (B.stoop || 0), (P.twist || 0) * .6, -(P.roll || 0) * .3, 'YXZ');
    this.neck.position.set(0, h * .55 * sy - .03, (B.stoop || 0) * .1);
    this.head.rotation.set(P.nod || 0, P.turn || 0, -(P.tilt || 0), 'YXZ');
    this.hips.updateMatrix(); this.chest.updateMatrix();
    const toChest = _m.multiplyMatrices(this.hips.matrix, this.chest.matrix);
    // limbs never go through the head or the torso: points inside are pushed out to the surface (arms hug what they touch)
    this.torso.updateMatrix(); const torsoM = _mt.multiplyMatrices(this.hips.matrix, this.torso.matrix), torsoInv = _mti.copy(torsoM).invert();
    const R = B.head, headC = _hc.set(0, h * .55 * sy - .03 + R * .68 + .03, (B.stoop || 0) * .1).applyMatrix4(toChest);
    const keepOut = (p, r, vMax = .995) => {
      const d = p.distanceTo(headC), rr = R + r + .004;
      if (d < rr) p.sub(headC).multiplyScalar(rr / Math.max(d, 1e-4)).add(headC);
      const q = _tq.copy(p).applyMatrix4(torsoInv), v = q.y / h;
      if (v > .02 && v < vMax) { const rad = Math.hypot(q.x, q.z), lim = T.R(v) + (r + .004) / sx; if (rad < lim) { if (rad < 1e-4) { q.z = lim; } else { q.x *= lim / rad; q.z *= lim / rad; } p.copy(q.applyMatrix4(torsoM)); } }
      return p;
    };
    // the arms' frame: the chest's yaw, half its pitch (hanging arms keep hanging when the body leans)
    _e.set((P.lean || 0) * .5 + (B.stoop || 0) * .5, P.twist || 0, 0, 'YXZ'); _q.setFromEuler(_e);
    for (const s of ['L', 'R']) {
      const sd = s === 'L' ? 1 : -1;
      const sh = this._shoulder(s, P, sy, sx, new THREE.Vector3()).applyMatrix4(toChest);
      const hv = P['h' + s], tgt = new THREE.Vector3(sd * hv[0] * B.arm, hv[1] * B.arm, hv[2] * B.arm).applyQuaternion(_q).add(sh);
      // a world target (reach / press / catch, root-space metres) pulls the hand by weight k; the grip point lands on it
      const hw = P['h' + s + 'w'], hk = P['h' + s + 'k'] || 0;
      if (hw && hk > 0) {
        const goal = new THREE.Vector3(...hw), dir = goal.clone().sub(sh), dl = dir.length(); dir.normalize();
        goal.addScaledVector(dir, -(this.hands[s].userData.rp * .9) + (P['h' + s + 'push'] || 0));
        const bulge = Math.sin(Math.PI * hk) * tgt.distanceTo(goal) * .18;
        tgt.lerp(goal, hk).add(new THREE.Vector3(sd * bulge * .5, bulge * .3, bulge * .6).applyQuaternion(_q)); void dl;
      }
      const e = P['e' + s] || 0, ov = P['o' + s];
      const pole = (ov ? new THREE.Vector3(sd * ov[0], ov[1], ov[2]) : new THREE.Vector3(sd * (.55 + e), -.25, -.9 + e * .3)).applyQuaternion(_q).normalize();
      const el = new THREE.Vector3(), t2 = ik(sh, tgt, B.arm * .5, B.arm * .5, pole, el).clone();
      const rp = this.hands[s].userData.rp; keepOut(t2, rp * .9); keepOut(el, B.armR);
      const p5 = limbPath(sh, el, t2); keepOut(p5[1], B.armR); for (let i = 2; i < p5.length - 1; i++) keepOut(p5[i], B.armR);
      const path = [p5[0]]; for (let i = 1; i < p5.length; i++) { const m = p5[i - 1].clone().lerp(p5[i], .5); if (i > 1) keepOut(m, B.armR); else keepOut(m, B.armR, this.vS - .06); path.push(m, p5[i]); }
      this.arms[s].setPath(path, B.armR);
      if (this.sleeves) this.sleeves[s].setPath(this._sub(path, .36), u => B.armR * (2.15 + .35 * u));
      // the hand: fingers along the forearm, palm toward the body (or the pose's palm hint), wrist roll
      const hand = this.hands[s]; hand.position.copy(t2);
      const f = _a.copy(t2).sub(el).normalize(), ph = P['p' + s];
      const n = ph ? _b.set(sd * ph[0], ph[1], ph[2]).applyQuaternion(_q) : _b.set(-sd, 0, .15).applyQuaternion(_q);
      n.addScaledVector(f, -n.dot(f)); if (n.lengthSq() < .02) { n.set(0, 0, 1).addScaledVector(f, -f.z); if (n.lengthSq() < .02) n.set(-sd, 0, 0).addScaledVector(f, -f.x * -sd); } n.normalize();
      const w = P['w' + s] || 0; if (w) n.applyAxisAngle(f, -sd * w);
      const X = _c.crossVectors(n, f).normalize(), Yv = _d.copy(f).negate();
      hand.quaternion.setFromRotationMatrix(_m2.makeBasis(X, Yv, n));
      setGrip(hand, P['g' + s] || 'mitt');
    }
    // legs: hip joint (follows the hips) -> ankle target (root space), knees forward (+ bowed out by k)
    const fk = P.fAbs ? 1 : B.leg / .6;
    for (const s of ['L', 'R']) {
      const sd = s === 'L' ? 1 : -1;
      const hj = _a.set(sd * B.hip * .42 * sx, .06 * sy, 0).applyMatrix4(this.hips.matrix).clone();
      const fv = P['f' + s], ankle = new THREE.Vector3(fv[0] * fk, fv[1] * fk + this.ankleH, fv[2] * fk);
      const fy = P['fy' + s] || 0, kk = P['k' + s] || 0;
      const pole = new THREE.Vector3(Math.sin(fy) + sd * (.1 + kk * 1.6), .05, Math.cos(fy)).normalize();
      const kn = new THREE.Vector3(), a2 = ik(hj, ankle, (B.leg + .06 - this.ankleH) * .5, (B.leg + .06 - this.ankleH) * .5, pole, kn).clone();
      const path = limbPath(hj, kn, a2, .45);
      this.legs[s].setPath(path, B.legR);
      if (this.shorts) this.shorts[s].setPath(this._sub(path, .4), u => B.legR * (2.7 + .4 * u));
      const foot = this.feet[s]; foot.position.set(a2.x, Math.max(0, a2.y - this.ankleH), a2.z); foot.rotation.set(fv[3] || 0, fy, 0, 'YXZ');
    }
    return this;
  }
  _sub(path, end) { const c = this._curve; c.points = path.map(p => p.clone()); c.updateArcLengths(); const out = []; for (let i = 0; i <= 4; i++) out.push(c.getPointAt(end * i / 4)); return out; }
  /** world position of the head centre / a hand (palm centre) */
  headPos(out = new THREE.Vector3()) { return this.headMesh.getWorldPosition(out); }
  handPos(s = 'R', out = new THREE.Vector3()) { const hd = this.hands[s]; hd.updateWorldMatrix(true, false); return out.copy(gripOffset(hd)).applyMatrix4(hd.matrixWorld); }
  /** the matrix (world) a held prop's grip point sits on: in front of the palm, oriented like the hand */
  gripMatrix(s = 'R', out = new THREE.Matrix4()) { const hd = this.hands[s]; hd.updateWorldMatrix(true, false); return out.copy(hd.matrixWorld).multiply(_m3.makeTranslation(gripOffset(hd))); }
  box() { return new THREE.Box3().setFromObject(this.root); }
}
const _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _mt = new THREE.Matrix4(), _mti = new THREE.Matrix4(), _hc = new THREE.Vector3(), _tq = new THREE.Vector3();
const PLEAT = new Map();
function pleatTex(c) { if (PLEAT.has(c)) return PLEAT.get(c); const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 512, 64); x.fillStyle = shade(c, -.12); for (let i = 0; i < 512; i += 16) x.fillRect(i, 0, 3, 64); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; PLEAT.set(c, t); return t; }

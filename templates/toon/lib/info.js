// In-world information props for the 3D toon shorts. The studied shorts never put a fact in a 2D overlay: a number is an
// LED counter on a pole sign that rolls to the spoken figure on its word, a list is a column of buttons that light one by
// one, a place is a map on a table with pins, a distribution is a skyline of giant digits, a run of results is a board of
// coins lighting in a row. Everything here is such an object, built in the toon look (rounded chunky shapes, 2-3 tones,
// ink outline, emissive only on real light sources so bloom picks them up) with its text drawn by canvasTex in Inter
// 800/600 (>= 1024 px on the long side for boards and screens) so it stays sharp in a 9:16 close-up.
//
// S.info(kind, o) BUILDS the object, PLACES it and ADDS it to the shot itself (S.add: the editor can pick it, the default
// camera can frame it) and returns the THREE.Group. o.add === false: not added (parent it yourself); o.parent: put it
// under that Object3D instead of the scene.
//
// Common options (every kind):
//   at: [x, z] (on the floor, or at the kind's usual height for wall things) | [x, y, z];  y;  on: a prop with
//   userData.top (stands on it);  rx / ry / rz radians (order YXZ: rx tilts it, ry turns it);  scale;
//   in: t (pops in, ~90 % size ON that frame);  out: t (pops away);  outline: false;  ink: '#hex';  lw: outline metres
// Origins: standing things (posts, poles, scoreboard, map table, bars, digits, globe on its stand, tv on its foot) at
// their base on the floor; wall things (poster, notice, board, clock, calendar, gauge, wall screens) at their centre with
// the back on z = 0 and the front facing +z; small held things (phone, tag) at their centre / hanging point.
// CUES. Every time you pass is shot time, normally S.at('word'), and it is the frame the EVENT shows:
//   * counters (led, price, screen count), gauge, thermometer, clock, calendar, timer LAND EXACTLY on their target at t1
//     and never show it before;
//   * lights (grid tokens, scoreboard scores, neon lightAt, screen states, label/bubble/pop `in`) are on / nearly full
//     size ON their cue frame (pops start 2 frames before);
//   * marks drawn by hand (checklist ticks, highlights, board writing, circles) START on their cue (1 frame before) and
//     finish 3-6 frames later; board items start on their `t`;
//   * things that travel (map pins, stacked bars, route dots) TOUCH DOWN on their cue: a bar's LAST item lands on its cue,
//     a route's last dot appears at t1.
// group.userData: kind, info: true, update(t, S) (a pure function of t), face: { mesh, tex, w, h } on paper-like kinds
// (the magnifier reads it), screen: the canvasTex of a display a scene may redraw.
// No verdict stamps / plaques ('DENIED', 'CLOSED' ...): show facts as real objects (a document with a highlight, a sign,
// a screen). Invented names only (no real brands, papers, banks or shows).
import { THREE, C, E, VERT, clamp, lerp, seg, rnd, hash, canvasTex, redraw, shade, mixHex, fmt, easeFn, textOn } from './core.js';
import { outlineMat, lathe } from './geo.js';
import { toonMat } from './rig.js';
import { mergeVertices } from '../vendor/jsm/utils/BufferGeometryUtils.js';
import * as ENG from '../engine.js';

const F = 1 / 30, PI = Math.PI, TAU = PI * 2, INK = C.ink;
const CE = 2e-3;          // cue tolerance (s): a frame time within 2 ms of a cue counts as the cue frame
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion();
export const KINDS = {};
export const DOCS = {};      // kind -> its options in one line (the skill's engine_api.md lists these)

// =====================================================================================================================
// canvas helpers
// =====================================================================================================================
const FAM = 'Inter, Arial, sans-serif';
const MC = document.createElement('canvas').getContext('2d');      // measuring
function font(x, px, w = 800, it = '') { x.font = `${it}${w} ${Math.max(1, Math.round(px))}px ${FAM}`; }
/** text at X, Y: size px, weight, color, align, base, maxW (shrinks to fit), ls (letter spacing, fraction of size),
 *  stroke / strokeW, shadow (colour), glow (colour), italic */
function txt(x, s, X, Y, o = {}) {
  s = String(s ?? ''); if (!s) return 0; let px = o.size ?? 48; const w = o.weight ?? 800, it = o.italic ? 'italic ' : '';
  x.save(); font(x, px, w, it); x.letterSpacing = (o.ls ?? 0) * px + 'px';
  if (o.maxW) { const m = x.measureText(s).width; if (m > o.maxW) { px *= o.maxW / m; font(x, px, w, it); x.letterSpacing = (o.ls ?? 0) * px + 'px'; } }
  x.textAlign = o.align || 'center'; x.textBaseline = o.base || 'middle'; x.lineJoin = 'round';
  if (o.shadow) { x.fillStyle = o.shadow; x.fillText(s, X + px * .035, Y + px * .055); }
  if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = px * (o.glowR ?? .3); }
  if (o.stroke) { x.strokeStyle = o.stroke; x.lineWidth = o.strokeW ?? px * .14; x.strokeText(s, X, Y); }
  x.fillStyle = o.color || INK; x.fillText(s, X, Y); x.restore(); return px;
}
function wrap(x, s, maxW) {
  const out = [];
  for (const para of String(s ?? '').split('\n')) { const words = para.split(/\s+/).filter(Boolean); let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && x.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t; }
    out.push(cur); }
  return out;
}
/** wrap + shrink until the block fits maxW x maxH: { px, lines } */
function fitBlock(x, s, maxW, maxH, px, w = 800, lh = 1.15) {
  for (let i = 0; i < 40; i++) { font(x, px, w); const L = wrap(x, s, maxW); const wide = Math.max(0, ...L.map(l => x.measureText(l).width));
    if (L.length * px * lh <= maxH && wide <= maxW) return { px, lines: L }; px *= .93; }
  font(x, px, w); return { px, lines: wrap(x, s, maxW) };
}
/** a block of wrapped text centred on cy (align 'left': cx is the left edge) */
function block(x, s, cx, cy, maxW, maxH, o = {}) {
  const lh = o.lh ?? 1.15, { px, lines } = fitBlock(x, s, maxW, maxH, o.size ?? maxH, o.weight ?? 800, lh);
  const y0 = cy - (lines.length - 1) * px * lh / 2;
  lines.forEach((l, i) => txt(x, l, cx, y0 + i * px * lh, { ...o, size: px }));
  return { px, lines, y0, lh: px * lh };
}
function grain(x, W, H, seed = 1, a = .05, n = 1400, col = '#000') {
  const R = rnd(seed); x.save(); x.fillStyle = col;
  for (let i = 0; i < n; i++) { x.globalAlpha = a * R(); const s = 1 + R() * 2.5 * (W / 1024); x.fillRect(R() * W, R() * H, s, s); }
  x.restore();
}
function rrPath(x, X, Y, w, h, r) { x.beginPath(); x.roundRect(X, Y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
/** a canvas texture sized for a w x h (m) surface: long side between min and max px */
function texFor(w, h, draw, o = {}) {
  const L = clamp(Math.max(w, h) * (o.ppm ?? 1400), o.min ?? 1024, o.max ?? 2048), k = L / Math.max(w, h);
  return canvasTex(Math.max(8, Math.round(w * k)), Math.max(8, Math.round(h * k)), draw, o);
}
/** re-draws a texture only when key(t) changes */
function keyed(tex, key, draw) { return t => { const k = key(t); if (k === tex.userData.key) return; tex.userData.key = k; redraw(tex, (x, W, H) => draw(x, W, H, t)); }; }

// images of the project: an IMG key (project.json "images"), a THREE.Texture, an <img> / <canvas>
function getImg(k) {
  if (!k) return null; if (k.isTexture) return k.image || null;
  if (typeof HTMLImageElement !== 'undefined' && (k instanceof HTMLImageElement || k instanceof HTMLCanvasElement)) return k;
  try { return ENG.IMG?.[k] || null; } catch { return null; }
}
function drawImg(x, im, X, Y, W, H, mode = 'cover') {
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height; if (!iw || !ih) return;
  const s = mode === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih), dw = iw * s, dh = ih * s;
  x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip(); x.drawImage(im, X + (W - dw) / 2, Y + (H - dh) / 2, dw, dh); x.restore();
}
/** a picture in a box: o.image (key) | o.draw ('tree' | ... | fn(x, X, Y, W, H)) */
function picture(x, o, X, Y, W, H, mode = 'contain') {
  const im = getImg(o.image);
  if (im) { drawImg(x, im, X, Y, W, H, mode); return true; }
  if (typeof o.draw === 'function') { x.save(); o.draw(x, X, Y, W, H); x.restore(); return true; }
  if (o.draw && PICS[o.draw]) { x.save(); PICS[o.draw](x, X + W / 2, Y + H / 2, Math.min(W, H), o); x.restore(); return true; }
  if (o.image) { x.save(); x.strokeStyle = 'rgba(0,0,0,.35)'; x.setLineDash([12, 8]); x.lineWidth = 4; x.strokeRect(X + 4, Y + 4, W - 8, H - 8); txt(x, String(o.image), X + W / 2, Y + H / 2, { size: H * .1, maxW: W * .8, color: 'rgba(0,0,0,.45)' }); x.restore(); }
  return false;
}

// numbers in the narration's language: money ('$' | '€' | true), pre, suf, decimals, group, compact
function num(v, o = {}) {
  const d = o.decimals ?? 0, pre = o.pre ?? (o.money ? (typeof o.money === 'string' ? o.money : '$') : '');
  const s = o.compact ? fmt(Math.abs(v), { notation: 'compact', maximumFractionDigits: 1 }) : fmt(Math.abs(v), { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: o.group !== false });
  return (v < 0 ? '-' : '') + pre + s + (o.suf ?? '');
}
// ---------- the counter roll: per-frame steps, slightly accelerating, occasional 1-frame holds (the studied LED sign) ----
const EASE = { counter: k => .55 * k + .45 * k * k };
const ez = f => typeof f === 'function' ? f : EASE[f] || easeFn(f);
const ROLL = new Map();
function rollCum(n, ease, jitter, seed) {
  const key = typeof ease === 'function' ? null : `${n}|${ease}|${jitter}|${seed}`; if (key && ROLL.has(key)) return ROLL.get(key);
  const f = ez(ease), w = []; let prev = 0;
  for (let i = 1; i <= n; i++) { const e = f(i / n); let d = Math.max(0, e - prev); prev = e;
    if (jitter) { d *= 1 + (hash(i, seed) - .5) * 1.2 * jitter; if (i > 1 && i < n - 1 && hash(i, seed + 9) < .12 * jitter) d = 0; } w.push(d); }
  const tot = w.reduce((a, b) => a + b, 0) || 1, cum = []; let s = 0; for (const d of w) { s += d; cum.push(s / tot); } cum[n - 1] = 1;
  if (key) ROLL.set(key, cum); return cum;
}
/** the value a counter shows at t: a before t0, b from t1 on (exactly), steps per frame between; never b early */
function rollAt(t, a, b, t0, t1, o = {}) {
  if (t0 == null || t1 == null) return b; if (t < t0 + CE) return a; if (t >= t1 - CE) return b;
  const n = Math.max(2, Math.round((t1 - t0) * 30)), f = Math.min(n - 1, Math.floor((t - t0) / (t1 - t0) * n + .02));   // + .02: times rounded to 1e-4 s still hit their frame
  if (f <= 0) return a;
  const k = rollCum(n, o.ease ?? 'counter', o.jitter ?? .5, o.seed ?? 7)[f - 1];
  const unit = 10 ** -(o.decimals ?? 0); let v = Math.round((a + (b - a) * k) / unit) * unit;
  if (Math.abs(v - b) < unit / 2 && a !== b) v = b - Math.sign(b - a) * unit;
  return +v.toFixed(o.decimals ?? 0);
}
const countAt = (t, c) => rollAt(t, c.from ?? 0, c.to ?? c.value ?? 0, ...span(c.t0, c.t1, .7), c);
/** a value easing from a to b between t0 and t1 (gauges, levels, clocks): exactly b from t1 on */
function easeAt(t, a, b, t0, t1, ease = 'inOutCubic') { if (t0 == null || t1 == null) return b; if (t >= t1 - CE) return b; if (t <= t0) return a; return a + (b - a) * ez(ease)(seg(t, t0, t1)); }
// pop-ins: start 2 frames before the cue, ~0.86 on the cue, overshoot, settle by +6 frames
function popK(t, at, d = 8 * F) { const s = at - 2 * F; return t < s ? 0 : t >= s + d ? 1 : E.outBack((t - s) / d, 2); }
function outK(t, at) { return t < at ? 1 : t >= at + 6 * F ? 0 : clamp(1 - E.inBack((t - at) / (6 * F), 1.4), 0, 1.2); }
const sfx = (S, o, t, type = 'pop', gain = -8) => { if (o.sfx && t != null) S.sfx?.(typeof o.sfx === 'string' ? o.sfx : type, t, { gain }); };
/** the shot's camera at time t (billboards orient to it; the rig is a pure function of t) */
function camAt(S, t) { if (!S._cam) return S.cam; const c = S._infoCam || (S._infoCam = S.cam.clone()); S._cam(c, t); c.updateMatrixWorld(true); return c; }
const _q2 = new THREE.Quaternion(), YAX = new THREE.Vector3(0, 1, 0);
/** turn obj to the camera (upright: about the vertical only), whatever its parent */
function faceCam(obj, S, t, upright = false) {
  const c = camAt(S, t), par = obj.parent;
  if (upright) { const p = obj.getWorldPosition(_v1); _q2.setFromAxisAngle(YAX, Math.atan2(c.position.x - p.x, c.position.z - p.z)); } else _q2.copy(c.quaternion);
  if (par && !par.isScene) { par.getWorldQuaternion(_q1); obj.quaternion.copy(_q1.invert()).multiply(_q2); } else obj.quaternion.copy(_q2);
  return c;
}
/** [t0, t1] of a move: either end may be given alone (the other is `d` seconds away) */
function span(t0, t1, d) { if (t0 == null && t1 == null) return [null, null]; if (t0 == null) return [t1 - d, t1]; if (t1 == null) return [t0, t0 + d]; return [t0, t1]; }
const V3 = p => p?.isVector3 ? p.clone() : new THREE.Vector3(p?.[0] ?? 0, p?.[1] ?? 0, p?.[2] ?? 0);

// =====================================================================================================================
// geometry + materials
// =====================================================================================================================
const GEO = new Map();
const shared = (key, make) => { let g = GEO.get(key); if (!g) { g = make(); g.userData.shared = true; GEO.set(key, g); } return g; };
const f4 = v => (+v).toFixed(4);
/** a rounded box with smooth normals everywhere (the outline hull stays closed): w x h x d, corner radius r */
function rboxGeo(w, h, d, r = .02, seg = 3) {
  r = Math.max(.0004, Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5));
  return shared(`rb${f4(w)}|${f4(h)}|${f4(d)}|${f4(r)}|${seg}`, () => {
    const n = seg * 2 + 1, g = new THREE.BoxGeometry(1, 1, 1, n, n, n), P = g.attributes.position, N = g.attributes.normal;
    const half = [w / 2 - r, h / 2 - r, d / 2 - r], v = new THREE.Vector3(), o = [0, 0, 0], c = [0, 0, 0];
    for (let i = 0; i < P.count; i++) {
      for (let a = 0; a < 3; a++) { const k = Math.round((P.getComponent(i, a) + .5) * n);
        if (k <= seg) { o[a] = -(1 - k / seg); c[a] = -half[a]; } else { o[a] = (k - seg - 1) / seg; c[a] = half[a]; } }
      v.set(o[0], o[1], o[2]); if (v.lengthSq() < 1e-9) v.set(N.getX(i), N.getY(i), N.getZ(i)); v.normalize();
      P.setXYZ(i, c[0] + v.x * r, c[1] + v.y * r, c[2] + v.z * r); N.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  });
}
/** a disc / coin / button body with a rounded rim (axis = y): radius r, height h, rim round b */
function discGeo(r, h, b) {
  b = Math.min(b ?? Math.min(r, h / 2) * .7, h / 2 - 1e-5, r - 1e-5);
  return shared(`disc${f4(r)}|${f4(h)}|${f4(b)}`, () => {
    const P = [new THREE.Vector2(0, -h / 2)];
    const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= 6; i++) { const a = a0 + (a1 - a0) * i / 6; P.push(new THREE.Vector2(cx + Math.cos(a) * b, cy + Math.sin(a) * b)); } };
    arc(r - b, -h / 2 + b, -PI / 2, 0); arc(r - b, h / 2 - b, 0, PI / 2); P.push(new THREE.Vector2(0, h / 2));
    return new THREE.LatheGeometry(P, 40);
  });
}
const sphereGeo = (r, ws = 24, hs = 16) => shared(`sph${f4(r)}|${ws}`, () => new THREE.SphereGeometry(r, ws, hs));
const torusGeo = (R, r, arc = TAU) => shared(`tor${f4(R)}|${f4(r)}|${f4(arc)}`, () => new THREE.TorusGeometry(R, r, 12, 48, arc));
const capsGeo = (r, L) => shared(`cap${f4(r)}|${f4(L)}`, () => new THREE.CapsuleGeometry(r, Math.max(1e-3, L), 4, 12));
const cylGeo = shared('cyl1', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1));
function rrShape(w, h, r, cx = 0, cy = 0) {
  r = Math.max(1e-4, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4)); const s = new THREE.Shape(), x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -PI / 2, 0); s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, PI / 2);
  s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, PI / 2, PI); s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, PI, PI * 1.5); return s;
}
/** a polygon with filleted corners (r: number or per-corner array) */
function roundPoly(pts, r) {
  const s = new THREE.Shape(), n = pts.length;
  for (let i = 0; i < n; i++) { const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], rr = Array.isArray(r) ? r[i] : r;
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]), k = Math.min(rr, da * .45, db * .45);
    const p1 = [p[0] + (a[0] - p[0]) / da * k, p[1] + (a[1] - p[1]) / da * k], p2 = [p[0] + (b[0] - p[0]) / db * k, p[1] + (b[1] - p[1]) / db * k];
    if (i === 0) s.moveTo(p1[0], p1[1]); else s.lineTo(p1[0], p1[1]); s.quadraticCurveTo(p[0], p[1], p2[0], p2[1]); }
  s.closePath(); return s;
}
const circlePath = (cx, cy, r, P = new THREE.Path()) => { P.absarc(cx, cy, r, 0, TAU, true); return P; };
/** extrude a shape to a total thickness `thick` (centred on z = 0, front cap at +thick/2) with a rounded bevel */
function extrude(shape, thick, bevel = thick * .3, segs = 3, curveSegs = 10) {
  bevel = Math.min(bevel, thick * .45);
  const depth = Math.max(1e-4, thick - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: curveSegs, steps: 1 });
  g.translate(0, 0, -depth / 2); g.userData.hard = true; return g;
}
/** split the caps of an extrusion: materials [front, sides, back] */
function splitCaps(geo) {
  const g0 = geo.groups.find(g => g.materialIndex === 0); if (!g0) return geo; const half = g0.count / 2;
  geo.groups = geo.groups.filter(g => g !== g0); geo.addGroup(g0.start, half, 2); geo.addGroup(g0.start + half, half, 0); return geo;
}
// ---------- the ink outline (smooth hull: hard-edged geometry gets a merged-normal copy so the line never cracks) ------
const OLG = new WeakMap();
function olGeo(geo) {
  if (!geo.userData.hard) return geo; let g = OLG.get(geo);
  if (!g) { const b = new THREE.BufferGeometry(); b.setAttribute('position', geo.attributes.position.clone()); if (geo.index) b.setIndex(geo.index.clone());
    g = mergeVertices(b, 1e-4); g.computeVertexNormals(); if (geo.userData.shared) g.userData.shared = true; OLG.set(geo, g); geo.addEventListener('dispose', () => g.dispose()); }
  return g;
}
function inkMesh(m, color, w, px = 1.2) {
  if (!m.isMesh || m.userData.olMesh || m.userData.noOutline) return;
  const o = new THREE.Mesh(olGeo(m.geometry), outlineMat(color, w, px));
  o.userData.isOutline = true; o.userData.noPick = true; o.castShadow = false; o.receiveShadow = false; o.renderOrder = m.renderOrder;
  m.add(o); m.userData.olMesh = o;
}
function inkAll(g, color, w, px) {
  const L = []; g.traverse(m => { if (m.isMesh && !m.userData.isOutline && !m.userData.noOutline) L.push(m); });
  for (const m of L) { const mt = Array.isArray(m.material) ? m.material[0] : m.material; if (mt?.transparent && (mt.opacity ?? 1) < .99) continue; inkMesh(m, color, m.userData.lw ?? w, px); }
}
// ---------- materials ----------
const mat = (color, o = {}) => toonMat(color, o);
const fresh = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? .82, metalness: o.metal ?? 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, map: o.map ?? null, transparent: !!o.transparent, opacity: o.opacity ?? 1 });
/** a display surface: unlit, k > 1 glows into the bloom */
function glowMat(tex, k = 1.1, o = {}) { const m = new THREE.MeshBasicMaterial({ map: tex, transparent: !!o.transparent, alphaTest: o.alphaTest ?? 0, depthWrite: o.depthWrite ?? !o.transparent, side: o.side ?? THREE.FrontSide, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false }); m.color.setScalar(k); return m; }
/** printed paper / painted face: lit by the scene */
/** printed paper / painted face: lit by the scene, with a little self-light (o.lift) so white paper stays white indoors */
function paperMat(tex, o = {}) { return new THREE.MeshStandardMaterial({ map: tex, roughness: o.rough ?? .9, metalness: o.metal ?? 0, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: o.lift ?? .22, transparent: !!o.transparent, alphaTest: o.alphaTest ?? 0, depthWrite: o.depthWrite ?? true, side: o.side ?? THREE.FrontSide, polygonOffset: !!o.po, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }); }
function mesh(geo, m, o = {}) {
  const x = new THREE.Mesh(geo, typeof m === 'string' ? mat(m, o.m) : m); x.castShadow = o.shadow !== false; x.receiveShadow = true;
  if (o.noOutline) x.userData.noOutline = true; if (o.lw) x.userData.lw = o.lw; if (o.p) x.position.set(o.p[0], o.p[1], o.p[2]); if (o.r) x.rotation.set(o.r[0], o.r[1], o.r[2]);
  return x;
}
const box = (w, h, d, r, m, o = {}) => mesh(rboxGeo(w, h, d, r ?? Math.min(w, h, d) * .3), m, o);
function plane(w, h, m, o = {}) { const x = new THREE.Mesh(new THREE.PlaneGeometry(w, h, o.sx || 1, o.sy || 1), m); x.castShadow = false; x.receiveShadow = !o.unlit; x.userData.noOutline = true; if (o.p) x.position.set(o.p[0], o.p[1], o.p[2]); return x; }
/** a capsule rod from a to b (poles, sticks, strings, antennae) */
function rod(a, b, r, m, o = {}) {
  const A = V3(a), B = V3(b), L = A.distanceTo(B), x = mesh(capsGeo(r, L), m, o);
  x.position.copy(A).add(B).multiplyScalar(.5); x.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); return x;
}
const ball = (r, m, o = {}) => mesh(sphereGeo(r), m, o);
/** a disc facing +z (coins, knobs, clock backs) */
function discZ(r, h, m, o = {}) { const x = mesh(discGeo(r, h, o.b), m, o); x.rotation.x = PI / 2; return x; }
/** a push pin (head + needle), the needle tip at the origin, head toward +z */
function pushPin(color = C.red, s = 1) {
  const p = new THREE.Group(), head = mesh(discGeo(.016 * s, .012 * s, .005 * s), mat(color, { rough: .35 }), { lw: .0025 }); head.rotation.x = PI / 2; head.position.z = .016 * s;
  const neck = mesh(shared('pinneck', () => new THREE.CylinderGeometry(.006, .009, .012, 12)), mat(shade(color, -.15)), { noOutline: true }); neck.rotation.x = PI / 2; neck.position.z = .007 * s; neck.scale.setScalar(s);
  p.add(head, neck); return p;
}

// =====================================================================================================================
// finishing: outline, placement, pop in/out, the update hook, adding to the shot
// =====================================================================================================================
function finish(S, g, kind, o, upd) {
  const U = g.userData; g.name = o.name || kind; U.kind = kind; U.info = true; U.pickRoot = true; U.solid = o.solid ?? U.solid ?? false;
  if (o.outline !== false) inkAll(g, o.ink || INK, o.lw ?? U.lw ?? .008, o.px ?? 1.2);
  if (o.shadow === false) g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  g.rotation.order = 'YXZ';
  if (!U.ownPlace) {
    const at = o.at || [0, 0]; let y = o.y ?? U.y0 ?? 0;
    if (o.on) { o.on.updateMatrixWorld(true); let top = o.on.userData.top ?? (new THREE.Box3().setFromObject(o.on).max.y - o.on.position.y); if (!isFinite(top)) top = 0; y = o.on.position.y + top * (o.on.scale?.y ?? 1) + (U.base ?? 0) + (o.y ?? 0); }
    if (at.length === 3) g.position.set(at[0], at[1], at[2]); else g.position.set(at[0], y, at[1]);
    g.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    if (o.scale) g.scale.multiplyScalar(o.scale);
  }
  const S0 = g.scale.clone(), tin = U.ownIn ? null : o.in, tout = U.ownIn ? null : o.out;
  U.update = (t, S2) => {
    let k = 1; if (tin != null) k = popK(t, tin); if (tout != null) k *= outK(t, tout);
    g.visible = k > 1e-3; if (!g.visible) return;
    if (tin != null || tout != null) g.scale.copy(S0).multiplyScalar(Math.max(1e-3, k));
    upd?.(t, S2 || S);
  };
  if (o.add !== false) { if (o.parent) o.parent.add(g); else S.add(g); }
  return g;
}

// =====================================================================================================================
// pictures for posters, notices, screens, bubbles (filled, outlined, in a box of size s centred on cx, cy)
// =====================================================================================================================
const lw = s => Math.max(2, s * .022);
function inkPath(x, fill, s, k = 1) { x.lineJoin = 'round'; x.lineCap = 'round'; x.strokeStyle = INK; x.lineWidth = lw(s) * 2 * k; x.stroke(); x.fillStyle = fill; x.fill(); }
function circles(x, cx, cy, s, B) { x.beginPath(); for (const [dx, dy, r] of B) { x.moveTo(cx + (dx + r) * s, cy + dy * s); x.arc(cx + dx * s, cy + dy * s, r * s, 0, TAU); } }
export const PICS = {
  tree(x, cx, cy, s, o) {
    x.beginPath(); x.moveTo(cx - s * .06, cy + s * .46); x.quadraticCurveTo(cx - s * .03, cy + s * .12, cx - s * .025, cy - s * .05); x.lineTo(cx + s * .025, cy - s * .05); x.quadraticCurveTo(cx + s * .03, cy + s * .12, cx + s * .06, cy + s * .46); x.closePath(); inkPath(x, '#8a5a32', s);
    const B = [[0, -.2, .24], [-.22, -.08, .17], [.22, -.08, .17], [-.13, -.33, .15], [.14, -.32, .15], [0, -.02, .16]];
    circles(x, cx, cy, s, B); inkPath(x, o.color ?? '#5fae4a', s);
    x.save(); circles(x, cx, cy, s, B); x.clip(); x.fillStyle = 'rgba(20,60,20,.28)'; circles(x, cx + s * .05, cy + s * .07, s, B.map(([a, b, r]) => [a, b, r * .8])); x.fill(); x.restore();
  },
  leaf(x, cx, cy, s, o) {
    x.save(); x.translate(cx, cy); x.rotate(-.6); x.beginPath(); x.moveTo(-s * .42, 0); x.quadraticCurveTo(-s * .05, -s * .3, s * .42, 0); x.quadraticCurveTo(-s * .05, s * .3, -s * .42, 0); inkPath(x, o.color ?? '#59b14a', s);
    x.strokeStyle = shade(o.color ?? '#59b14a', -.35); x.lineWidth = lw(s); x.beginPath(); x.moveTo(-s * .5, 0); x.lineTo(s * .36, 0); for (let i = -2; i <= 2; i++) { if (!i) continue; } for (let k = 0; k < 4; k++) { const px = -s * .25 + k * s * .14; x.moveTo(px, 0); x.lineTo(px + s * .07, -s * .1); x.moveTo(px, 0); x.lineTo(px + s * .07, s * .1); } x.stroke(); x.restore();
  },
  fruit(x, cx, cy, s, o) {
    x.beginPath(); x.arc(cx, cy + s * .05, s * .3, 0, TAU); inkPath(x, o.color ?? '#d6d24a', s);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(cx - s * .11, cy - s * .07, s * .07, s * .04, -.6, 0, TAU); x.fill();
    x.strokeStyle = INK; x.lineWidth = lw(s) * 1.6; x.beginPath(); x.moveTo(cx, cy - s * .24); x.quadraticCurveTo(cx + s * .02, cy - s * .36, cx + s * .06, cy - s * .4); x.stroke();
    x.save(); x.translate(cx + s * .14, cy - s * .33); x.rotate(-.3); x.beginPath(); x.ellipse(0, 0, s * .1, s * .045, 0, 0, TAU); inkPath(x, '#5fae4a', s * .6); x.restore();
  },
  coin(x, cx, cy, s, o) {
    x.beginPath(); x.arc(cx, cy, s * .4, 0, TAU); inkPath(x, o.color ?? '#e9b44c', s); x.beginPath(); x.arc(cx, cy, s * .31, 0, TAU); x.strokeStyle = shade(o.color ?? '#e9b44c', -.3); x.lineWidth = lw(s) * 1.2; x.stroke();
    txt(x, o.symbol ?? '$', cx, cy + s * .02, { size: s * .38, color: shade(o.color ?? '#e9b44c', -.42) });
  },
  money(x, cx, cy, s) {
    x.save(); x.translate(cx, cy); x.rotate(-.12); rrPath(x, -s * .45, -s * .22, s * .9, s * .44, s * .04); inkPath(x, '#9fcf86', s); x.beginPath(); x.arc(0, 0, s * .13, 0, TAU); x.fillStyle = '#7bb062'; x.fill(); txt(x, '$', 0, s * .01, { size: s * .2, color: '#2f5a28' }); x.restore();
  },
  house(x, cx, cy, s, o) {
    x.beginPath(); x.rect(cx - s * .3, cy - s * .05, s * .6, s * .4); inkPath(x, o.color ?? '#f2d9a6', s);
    x.beginPath(); x.moveTo(cx - s * .4, cy - s * .02); x.lineTo(cx, cy - s * .38); x.lineTo(cx + s * .4, cy - s * .02); x.closePath(); inkPath(x, '#d6402f', s);
    x.beginPath(); x.rect(cx - s * .07, cy + s * .14, s * .14, s * .21); inkPath(x, '#8a5a32', s * .7); x.beginPath(); x.rect(cx + s * .12, cy + s * .04, s * .12, s * .1); inkPath(x, '#bfe3f2', s * .7);
  },
  bolt(x, cx, cy, s, o) { x.beginPath(); const P = [[.05, -.45], [-.22, .05], [-.02, .05], [-.1, .45], [.24, -.08], [.03, -.08], [.14, -.45]]; P.forEach(([a, b], i) => i ? x.lineTo(cx + a * s, cy + b * s) : x.moveTo(cx + a * s, cy + b * s)); x.closePath(); inkPath(x, o.color ?? '#f6c945', s); },
  warning(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy - s * .4); x.lineTo(cx + s * .44, cy + s * .36); x.lineTo(cx - s * .44, cy + s * .36); x.closePath(); x.lineJoin = 'round'; inkPath(x, '#f6c945', s, 1.4); txt(x, '!', cx, cy + s * .08, { size: s * .44 }); },
  heart(x, cx, cy, s, o) { x.beginPath(); x.moveTo(cx, cy + s * .36); x.bezierCurveTo(cx - s * .55, cy, cx - s * .32, cy - s * .44, cx, cy - s * .16); x.bezierCurveTo(cx + s * .32, cy - s * .44, cx + s * .55, cy, cx, cy + s * .36); inkPath(x, o.color ?? '#e2432f', s); },
  globe(x, cx, cy, s) {
    x.beginPath(); x.arc(cx, cy, s * .4, 0, TAU); inkPath(x, '#3f8fd8', s); x.save(); x.beginPath(); x.arc(cx, cy, s * .4, 0, TAU); x.clip();
    x.fillStyle = '#6cbf4c'; circles(x, cx, cy, s, [[-.15, -.12, .14], [-.05, .02, .1], [.2, .12, .12], [.12, -.25, .07]]); x.fill(); x.restore();
    x.strokeStyle = 'rgba(42,29,23,.5)'; x.lineWidth = lw(s); x.beginPath(); x.ellipse(cx, cy, s * .16, s * .4, 0, 0, TAU); x.moveTo(cx - s * .4, cy); x.lineTo(cx + s * .4, cy); x.stroke();
  },
  bars(x, cx, cy, s, o) { const V = o.values ?? [.35, .6, .45, .9], cols = o.colors ?? ['#3f6fd1', '#5fae4a', '#f08a2a', '#e2432f'];
    V.forEach((v, i) => { const bw = s * .8 / V.length, X = cx - s * .4 + i * bw + bw * .12, h = v * s * .7; x.beginPath(); x.rect(X, cy + s * .35 - h, bw * .76, h); inkPath(x, cols[i % cols.length], s * .8); });
    x.strokeStyle = INK; x.lineWidth = lw(s) * 1.5; x.beginPath(); x.moveTo(cx - s * .44, cy - s * .4); x.lineTo(cx - s * .44, cy + s * .36); x.lineTo(cx + s * .44, cy + s * .36); x.stroke(); },
  line(x, cx, cy, s, o) { const V = o.values ?? [.2, .35, .3, .55, .5, .85]; x.strokeStyle = INK; x.lineWidth = lw(s) * 1.5; x.beginPath(); x.moveTo(cx - s * .44, cy - s * .4); x.lineTo(cx - s * .44, cy + s * .36); x.lineTo(cx + s * .44, cy + s * .36); x.stroke();
    x.strokeStyle = o.color ?? '#2f9c95'; x.lineWidth = lw(s) * 3; x.beginPath(); V.forEach((v, i) => { const X = cx - s * .36 + i * s * .72 / (V.length - 1), Y = cy + s * .3 - v * s * .62; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke(); },
  pie(x, cx, cy, s, o) { const V = o.values ?? [.5, .3, .2], cols = o.colors ?? ['#3f6fd1', '#f6c945', '#e2432f']; let a = -PI / 2;
    V.forEach((v, i) => { x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, s * .4, a, a + v * TAU); x.closePath(); inkPath(x, cols[i % cols.length], s * .8); a += v * TAU; }); },
  person(x, cx, cy, s, o) { x.beginPath(); x.ellipse(cx, cy + s * .22, s * .16, s * .2, 0, 0, TAU); inkPath(x, o.color ?? '#3f6fd1', s); x.beginPath(); x.arc(cx, cy - s * .16, s * .17, 0, TAU); inkPath(x, '#f1d3b3', s); },
  drop(x, cx, cy, s, o) { x.beginPath(); x.moveTo(cx, cy - s * .42); x.bezierCurveTo(cx + s * .1, cy - s * .2, cx + s * .3, cy, cx + s * .3, cy + s * .14); x.arc(cx, cy + s * .14, s * .3, 0, PI); x.bezierCurveTo(cx - s * .3, cy, cx - s * .1, cy - s * .2, cx, cy - s * .42); inkPath(x, o.color ?? '#55b8ef', s); },
  flame(x, cx, cy, s) { const f = (k, c) => { x.beginPath(); x.moveTo(cx, cy - s * .44 * k); x.bezierCurveTo(cx + s * .34 * k, cy - s * .05 * k, cx + s * .3 * k, cy + s * .38 * k, cx, cy + s * .4 * k); x.bezierCurveTo(cx - s * .3 * k, cy + s * .38 * k, cx - s * .34 * k, cy - s * .05 * k, cx, cy - s * .44 * k); inkPath(x, c, s * k); }; f(1, '#f08a2a'); f(.55, '#f6c945'); },
  star(x, cx, cy, s, o) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = (i % 2 ? .18 : .42) * s; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); inkPath(x, o.color ?? '#f6c945', s); },
  check(x, cx, cy, s) { x.beginPath(); x.arc(cx, cy, s * .4, 0, TAU); inkPath(x, '#5fae4a', s); x.strokeStyle = '#fff'; x.lineWidth = s * .08; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(cx - s * .17, cy); x.lineTo(cx - s * .04, cy + s * .14); x.lineTo(cx + s * .2, cy - s * .14); x.stroke(); },
  cross(x, cx, cy, s) { x.beginPath(); x.arc(cx, cy, s * .4, 0, TAU); inkPath(x, '#e2432f', s); x.strokeStyle = '#fff'; x.lineWidth = s * .08; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - s * .14, cy - s * .14); x.lineTo(cx + s * .14, cy + s * .14); x.moveTo(cx + s * .14, cy - s * .14); x.lineTo(cx - s * .14, cy + s * .14); x.stroke(); },
  clock(x, cx, cy, s) { x.beginPath(); x.arc(cx, cy, s * .4, 0, TAU); inkPath(x, '#fbf4e4', s); x.strokeStyle = INK; x.lineWidth = s * .04; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, cy - s * .27); x.moveTo(cx, cy); x.lineTo(cx + s * .18, cy + s * .06); x.stroke(); },
  up(x, cx, cy, s, o) { x.beginPath(); const P = [[0, -.42], [.34, -.02], [.13, -.02], [.13, .4], [-.13, .4], [-.13, -.02], [-.34, -.02]]; P.forEach(([a, b], i) => i ? x.lineTo(cx + a * s, cy + b * s) : x.moveTo(cx + a * s, cy + b * s)); x.closePath(); inkPath(x, o.color ?? '#5fae4a', s); },
  down(x, cx, cy, s, o) { x.save(); x.translate(cx, cy); x.rotate(PI); PICS.up(x, 0, 0, s, { color: o.color ?? '#e2432f' }); x.restore(); },
};

// =====================================================================================================================
// hand-drawn strokes (boards, circles round things, ticks): unit coords [-1, 1], y down
// =====================================================================================================================
function ellArc(cx, cy, rx, ry, a0 = -1.95, sweep = TAU * 1.07, n = 56) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + sweep * i / n, w = 1 + .035 * Math.sin(a * 3 + 1) + .02 * (i / n); p.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]); } return p; }
export const STROKES = {
  circle: () => [ellArc(0, 0, 1, 1)],
  ellipse: () => [ellArc(0, 0, 1, .55)],
  underline: () => [[[-1, 0], [-.3, .05], [.4, -.02], [1, .06]]],
  arrow: () => [[[-1, .12], [-.2, .02], [1, -.04]], [[.58, -.42], [1, -.04], [.62, .36]]],
  box: () => [[[-1, -1], [1, -1.02], [1.01, 1], [-1, 1], [-1, -1.06]]],
  check: () => [[[-1, .02], [-.38, .68], [1, -.86]]],
  cross: () => [[[-.9, -.9], [.9, .9]], [[.9, -.9], [-.9, .9]]],
  plus: () => [[[-.9, 0], [.9, 0]], [[0, -.9], [0, .9]]],
  minus: () => [[[-.9, 0], [.9, 0]]],
  equals: () => [[[-.85, -.3], [.85, -.3]], [[-.85, .3], [.85, .3]]],
  chart: () => [[[-1, -1], [-1, 1], [1, 1]], [[-.8, .6], [-.4, .15], [-.05, .38], [.35, -.25], [.85, -.8]], [[.52, -.76], [.85, -.8], [.8, -.47]]],
  down: () => [[[-1, -1], [-1, 1], [1, 1]], [[-.8, -.7], [-.4, -.2], [-.05, -.4], [.35, .25], [.85, .7]], [[.55, .7], [.85, .7], [.8, .4]]],
  bars: () => [[[-1, -1], [-1, 1], [1, 1]], [[-.72, 1], [-.72, .35], [-.42, .35], [-.42, 1]], [[-.15, 1], [-.15, -.2], [.15, -.2], [.15, 1]], [[.42, 1], [.42, -.7], [.72, -.7], [.72, 1]]],
  star: () => { const p = []; for (let i = 0; i <= 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? .42 : 1; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return [p]; },
  heart: () => { const p = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, X = 16 * Math.sin(a) ** 3, Y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); p.push([X / 17, -Y / 17]); } return [p]; },
  house: () => [[[-.8, 1], [-.8, -.1], [0, -.9], [.8, -.1], [.8, 1], [-.8, 1]], [[-.2, 1], [-.2, .4], [.2, .4], [.2, 1]]],
  person: () => [ellArc(0, -.7, .26, .26, -1.6, TAU * 1.03, 30), [[0, -.44], [0, .3]], [[-.55, -.12], [0, -.26], [.55, -.12]], [[-.42, 1], [0, .3], [.42, 1]]],
  sun: () => { const s = [ellArc(0, 0, .45, .45, -1.6, TAU * 1.03, 36)]; for (let i = 0; i < 8; i++) { const a = i * PI / 4; s.push([[Math.cos(a) * .62, Math.sin(a) * .62], [Math.cos(a) * .95, Math.sin(a) * .95]]); } return s; },
  wave: () => { const p = []; for (let i = 0; i <= 40; i++) { const u = i / 40; p.push([-1 + 2 * u, Math.sin(u * TAU * 2) * .35]); } return [p]; },
  dollar: () => [[[.55, -.55], [.2, -.72], [-.3, -.7], [-.55, -.45], [-.4, -.12], [.4, .12], [.58, .45], [.3, .72], [-.25, .72], [-.6, .55]], [[0, -1], [0, 1]]],
};
function resample(stroke, step = .04) {
  const out = [stroke[0]];
  for (let i = 1; i < stroke.length; i++) { const [ax, ay] = stroke[i - 1], [bx, by] = stroke[i], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / step)); for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); }
  return out;
}
/** draw strokes (unit coords) into a box: cx, cy, sx, sy (half sizes, px); k = 0..1 progress along the total length */
function drawStrokes(x, strokes, cx, cy, sx, sy, k, o = {}) {
  const seed = o.seed ?? 1, wob = o.wobble ?? .008, S2 = strokes.map(s => resample(s, .035));
  const lens = S2.map(s => { let L = 0; for (let i = 1; i < s.length; i++) L += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); return L; });
  let left = k * lens.reduce((a, b) => a + b, 0);
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = o.color ?? INK; x.lineWidth = o.width ?? Math.max(2, Math.min(sx, sy) * .09);
  S2.forEach((s, j) => {
    if (left <= 0) return; x.beginPath();
    const P = (i) => { const [u, v] = s[i]; const n1 = Math.sin(i * .21 + seed * 3.1 + j) * wob + Math.sin(i * .07 + seed) * wob * 1.5; return [cx + (u + n1) * sx, cy + (v - n1 * .7) * sy]; };
    let p = P(0); x.moveTo(p[0], p[1]);
    for (let i = 1; i < s.length; i++) { const seglen = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); if (left <= 0) break;
      if (seglen > left) { const q = P(i), f = left / seglen; x.lineTo(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f); left = 0; break; }
      left -= seglen; p = P(i); x.lineTo(p[0], p[1]); }
    x.stroke();
  });
  x.restore();
}

// =====================================================================================================================
// dot-matrix (5 x 7) and 7-segment displays
// =====================================================================================================================
const F57 = {};
for (const [k, v] of Object.entries({
  '0': '01110 10001 10011 10101 11001 10001 01110', '1': '00100 01100 00100 00100 00100 00100 01110', '2': '01110 10001 00001 00010 00100 01000 11111',
  '3': '11111 00010 00100 00010 00001 10001 01110', '4': '00010 00110 01010 10010 11111 00010 00010', '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000 01000', '8': '01110 10001 10001 01110 10001 10001 01110',
  '9': '01110 10001 10001 01111 00001 00010 01100', '$': '00100 01111 10100 01110 00101 11110 00100', '€': '00111 01000 11110 01000 11110 01000 00111',
  '£': '00110 01001 01000 11100 01000 01000 11111', ',': '00000 00000 00000 00000 00110 00100 01000', '.': '00000 00000 00000 00000 00000 01100 01100',
  ':': '00000 01100 01100 00000 01100 01100 00000', '-': '00000 00000 00000 11111 00000 00000 00000', '+': '00000 00100 00100 11111 00100 00100 00000',
  '%': '11000 11001 00010 00100 01000 10011 00011', '°': '01100 10010 10010 01100 00000 00000 00000', '/': '00000 00001 00010 00100 01000 10000 00000',
  '!': '00100 00100 00100 00100 00100 00000 00100', '?': '01110 10001 00001 00010 00100 00000 00100', "'": '01100 00100 01000 00000 00000 00000 00000',
  '#': '01010 01010 11111 01010 11111 01010 01010', 'x': '00000 00000 10001 01010 00100 01010 10001', '×': '00000 00000 10001 01010 00100 01010 10001',
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11100 10010 10001 10001 10001 10010 11100', E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001', I: '01110 00100 00100 00100 00100 00100 01110',
  J: '00111 00010 00010 00010 00010 10010 01100', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000', Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100', W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 10001 01010 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
})) F57[k] = v.split(' ');
const NARROW = ".,:;!'";
function cols57(s) {
  const out = [];
  for (const ch of String(s)) {
    if (ch === ' ') { out.push(0, 0, 0); continue; }
    const g = F57[ch] ?? F57[ch.toUpperCase()]; if (!g) { out.push(0, 0, 0, 0, 0, 0); continue; }
    let a = 0, b = 4; if (NARROW.includes(ch)) { a = 5; b = -1; for (const r of g) for (let c = 0; c < 5; c++) if (r[c] === '1') { a = Math.min(a, c); b = Math.max(b, c); } if (b < 0) { a = 0; b = 1; } }
    for (let c = a; c <= b; c++) { let m = 0; for (let r = 0; r < 7; r++) if (g[r][c] === '1') m |= 1 << r; out.push(m); }
    out.push(0);
  }
  if (out.length) out.pop(); return out;
}
const SPR = new Map();
function dotSprite(q, col, on) {
  const key = q + col + on; if (SPR.has(key)) return SPR.get(key);
  const c = document.createElement('canvas'); c.width = c.height = Math.ceil(q * 2); const x = c.getContext('2d'), m = q;
  if (on) { const g = x.createRadialGradient(m, m, 0, m, m, q); g.addColorStop(0, col); g.addColorStop(.38, col); g.addColorStop(.5, mixHex(col, '#000000', .4) + '88'); g.addColorStop(1, '#00000000'); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = mixHex(col, '#ffffff', .55); x.beginPath(); x.arc(m - q * .08, m - q * .08, q * .14, 0, TAU); x.fill(); }
  else { x.fillStyle = col; x.beginPath(); x.arc(m, m, q * .36, 0, TAU); x.fill(); }
  SPR.set(key, c); return c;
}
function drawDots(x, W, H, s, p) {
  x.fillStyle = p.bg; x.fillRect(0, 0, W, H);
  const q = W / p.cols, C7 = cols57(s), n = C7.length, start = p.align === 'right' ? p.cols - 1 - n : p.align === 'left' ? 1 : Math.floor((p.cols - n) / 2), r0 = Math.floor((p.rows - 7) / 2);
  const L = dotSprite(q, p.lit, true), O = dotSprite(q, p.off, false);
  for (let c = 0; c < p.cols; c++) { const m = c - start >= 0 && c - start < n ? C7[c - start] : 0;
    for (let r = 0; r < p.rows; r++) { const on = r >= r0 && r < r0 + 7 && (m >> (r - r0)) & 1; x.drawImage(on ? L : O, c * q + q / 2 - (on ? L : O).width / 2, r * q + q / 2 - (on ? L : O).height / 2); } }
}
const SEG = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '', '_': 'd',
  A: 'abcefg', b: 'cdefg', B: 'cdefg', C: 'adef', c: 'deg', d: 'bcdeg', D: 'bcdeg', E: 'adefg', F: 'aefg', G: 'acdef', H: 'bcefg', h: 'cefg', I: 'ef', J: 'bcde', L: 'def', n: 'ceg', N: 'ceg', O: 'abcdef', o: 'cdeg', P: 'abefg', r: 'eg', R: 'eg', S: 'acdfg', t: 'defg', T: 'defg', U: 'bcdef', u: 'cde', y: 'bcdfg', Y: 'bcdfg' };
function hexBar(x, x1, y1, x2, y2, t) {
  x.beginPath();
  if (Math.abs(y2 - y1) < 1e-6) { x.moveTo(x1, y1); x.lineTo(x1 + t / 2, y1 - t / 2); x.lineTo(x2 - t / 2, y1 - t / 2); x.lineTo(x2, y1); x.lineTo(x2 - t / 2, y1 + t / 2); x.lineTo(x1 + t / 2, y1 + t / 2); }
  else { x.moveTo(x1, y1); x.lineTo(x1 + t / 2, y1 + t / 2); x.lineTo(x1 + t / 2, y2 - t / 2); x.lineTo(x1, y2); x.lineTo(x1 - t / 2, y2 - t / 2); x.lineTo(x1 - t / 2, y1 + t / 2); }
  x.closePath();
}
function seg7(x, ch, X, Y, w, h, on, off, skew = .08) {
  const t = w * .19, g = t * .14, l = X + t / 2, r = X + w - t / 2, T = Y + t / 2, M = Y + h / 2, B = Y + h - t / 2;
  const S7 = { a: [l + g, T, r - g, T], g: [l + g, M, r - g, M], d: [l + g, B, r - g, B], f: [l, T + g, l, M - g], b: [r, T + g, r, M - g], e: [l, M + g, l, B - g], c: [r, M + g, r, B - g] };
  const lit = SEG[ch] ?? SEG[String(ch).toUpperCase()] ?? '';
  x.save(); x.translate(X + w / 2, M); x.transform(1, 0, -skew, 1, 0, 0); x.translate(-(X + w / 2), -M);
  for (const k of 'abcdefg') { const isOn = lit.includes(k); if (!isOn && !off) continue; const [a, b, c2, d] = S7[k]; hexBar(x, a, b, c2, d, t);
    if (isOn) { x.shadowColor = on; x.shadowBlur = t * 1.1; x.fillStyle = on; } else { x.shadowBlur = 0; x.fillStyle = off; } x.fill(); }
  x.restore();
}
const segAdv = (ch, cw) => ch === '.' || ch === ',' ? cw * .32 : ch === ':' ? cw * .4 : cw * 1.24;
function segWidth(s, cw) { let w = 0; for (const c of String(s)) w += segAdv(c, cw); return w; }
function segText(x, s, X, Y, cw, ch, on, off) {
  let cx = X;
  for (const c of String(s)) {
    if (c === '.' || c === ',') { x.save(); x.fillStyle = on; x.shadowColor = on; x.shadowBlur = cw * .2; x.beginPath(); x.arc(cx + cw * .12, Y + ch - cw * .12, cw * .1, 0, TAU); x.fill(); if (c === ',') { x.fillRect(cx + cw * .08, Y + ch - cw * .1, cw * .07, cw * .2); } x.restore(); }
    else if (c === ':') { x.save(); x.fillStyle = on; x.shadowColor = on; x.shadowBlur = cw * .2; for (const yy of [.32, .7]) { x.beginPath(); x.arc(cx + cw * .17, Y + ch * yy, cw * .1, 0, TAU); x.fill(); } x.restore(); }
    else if (SEG[c] != null || SEG[c.toUpperCase()] != null) seg7(x, c, cx, Y, cw, ch, on, off);
    else txt(x, c, cx + cw * .55, Y + ch / 2, { size: ch * .92, color: on, glow: on, glowR: .12 });
    cx += segAdv(c, cw);
  }
  return cx - X;
}

// =====================================================================================================================
// glyph tracing: any letter in Inter 800 as a THREE.Shape (for giant extruded digits / letters)
// =====================================================================================================================
const GLYPHS = new Map();
function rdp(pts, eps) {
  if (pts.length < 4) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy); let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = L < 1e-9 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}
const area = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
function inPoly(p, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
/** a character traced to { shapes: THREE.Shape[], adv } in units of the cap height (a digit is ~1 tall), baseline y = 0 */
function glyph(ch, weight = 800) {
  const key = ch + '|' + weight; if (GLYPHS.has(key)) return GLYPHS.get(key);
  const PX = 260, pad = 6, c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
  font(x, PX, weight); const m = x.measureText(ch), U = PX * .727;
  const L = Math.ceil(m.actualBoundingBoxLeft), Rr = Math.ceil(m.actualBoundingBoxRight), A = Math.ceil(m.actualBoundingBoxAscent), D = Math.ceil(m.actualBoundingBoxDescent);
  const W = Math.max(4, L + Rr + pad * 2), H = Math.max(4, A + D + pad * 2); c.width = W; c.height = H;
  font(x, PX, weight); x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillStyle = '#fff'; x.fillText(ch, pad + L, pad + A);
  const d = x.getImageData(0, 0, W, H).data, ins = (X, Y) => X >= 0 && Y >= 0 && X < W && Y < H && d[(Y * W + X) * 4 + 3] > 127;
  const EG = [], out = new Map(); const add = (a, b, c2, e) => { const k = b * (W + 1) + a; let l = out.get(k); if (!l) out.set(k, l = []); l.push(EG.length); EG.push([a, b, c2, e]); };
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) { if (!ins(X, Y)) continue;
    if (!ins(X, Y - 1)) add(X, Y, X + 1, Y); if (!ins(X + 1, Y)) add(X + 1, Y, X + 1, Y + 1); if (!ins(X, Y + 1)) add(X + 1, Y + 1, X, Y + 1); if (!ins(X - 1, Y)) add(X, Y + 1, X, Y); }
  const used = new Uint8Array(EG.length), loops = [];
  for (let s = 0; s < EG.length; s++) { if (used[s]) continue; const loop = []; let e = s;
    while (e != null && !used[e]) { used[e] = 1; const [a, b, c2, dd] = EG[e]; loop.push([(a + c2) / 2, (b + dd) / 2]);
      const cand = out.get(dd * (W + 1) + c2) || []; let best = null, bc = -9; for (const n of cand) { if (used[n]) continue; const [a2, b2, c3, d3] = EG[n]; const cr = (c2 - a) * (d3 - b2) - (dd - b) * (c3 - a2); if (cr > bc) { bc = cr; best = n; } } e = best; }
    if (loop.length > 8) loops.push(loop); }
  // smooth (two closed [1 2 1] passes) and simplify
  const polys = loops.map(P => { for (let p = 0; p < 2; p++) P = P.map((q, i) => { const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length]; return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4]; });
    const Q = rdp([...P, P[0]], .45); Q.pop(); return Q.map(([X, Y]) => [(X - pad - L) / U, (pad + A - Y) / U]); }).filter(P => P.length >= 3);
  const big = polys.reduce((a, P) => Math.abs(area(P)) > Math.abs(a ? area(a) : 0) ? P : a, null), sgn = big ? Math.sign(area(big)) : 1;
  const outers = polys.filter(P => Math.sign(area(P)) === sgn), holes = polys.filter(P => Math.sign(area(P)) !== sgn);
  const shapes = outers.map(P => ({ P, s: new THREE.Shape(P.map(([a, b]) => new THREE.Vector2(a, b))) }));
  for (const h of holes) { const owner = shapes.filter(o => inPoly(h[0], o.P)).sort((a, b) => Math.abs(area(a.P)) - Math.abs(area(b.P)))[0]; if (owner) owner.s.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b)))); }
  const res = { shapes: shapes.map(o => o.s), adv: m.width / U, left: -L / U, right: Rr / U };
  GLYPHS.set(key, res); return res;
}

// =====================================================================================================================
// noise for maps and globes
// =====================================================================================================================
function h3(x, y, z, s) { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453; return n - Math.floor(n); }
function vn3(x, y, z, s) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = x - X, fy = y - Y, fz = z - Z, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  return lerp(lerp(lerp(h3(X, Y, Z, s), h3(X + 1, Y, Z, s), u), lerp(h3(X, Y + 1, Z, s), h3(X + 1, Y + 1, Z, s), u), v), lerp(lerp(h3(X, Y, Z + 1, s), h3(X + 1, Y, Z + 1, s), u), lerp(h3(X, Y + 1, Z + 1, s), h3(X + 1, Y + 1, Z + 1, s), u), v), w);
}
const fbm3 = (x, y, z, s) => vn3(x, y, z, s) * .5 + vn3(x * 2.03, y * 2.03, z * 2.03, s + 1) * .26 + vn3(x * 4.1, y * 4.1, z * 4.1, s + 2) * .15 + vn3(x * 8.3, y * 8.3, z * 8.3, s + 3) * .09;
const fbm2 = (x, y, s) => fbm3(x, y, .5, s);
const smoothstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
/** seeded blob outlines for islands / continents (periodic radius noise): centre, radius, aspect */
function blob(seed, cx, cy, r, ax = 1, ay = 1, n = 72) {
  const R = rnd(seed), H = [2, 3, 4, 5, 7].map(k => [k, (R() - .5) * .5 / k ** .7, R() * TAU]), P = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU; let k = 1; for (const [f, am, ph] of H) k += am * Math.sin(f * a + ph); P.push([cx + Math.cos(a) * r * ax * k, cy + Math.sin(a) * r * ay * k]); }
  return P;
}

// =====================================================================================================================
// paper: a thin sheet with a printed face (posters, notices, documents, newspapers, checklists)
// =====================================================================================================================
function sheet(w, h, draw, o = {}) {
  const g = new THREE.Group(), d = o.thick ?? .004, col = o.paper ?? '#f4ecda';
  const body = box(w, h, d, Math.min(d * .45, .003), mat(col, { rough: .95 }), { lw: o.lw ?? .003 }); body.position.z = d / 2;
  const tex = texFor(w, h, draw, { ppm: o.ppm ?? 1700, min: o.min ?? 1024 });
  const face = plane(w - .002, h - .002, paperMat(tex)); face.position.z = d + .0007;
  g.add(body, face);
  const fix = o.fix ?? 'pins';
  if (fix === 'pins' || fix === 'pin') { const n = fix === 'pin' ? 1 : 2; for (let k = 0; k < n; k++) { const p = pushPin(o.pinColor ?? C.red, Math.max(.7, Math.min(1.4, w / .4))); p.position.set(n === 1 ? 0 : (k ? 1 : -1) * (w / 2 - w * .09), h / 2 - Math.min(h, w) * .07, d); g.add(p); } }
  else if (fix === 'tape') { for (const s of [-1, 1]) { const tp = box(w * .24, Math.min(w, h) * .075, .0016, .0006, mat(o.tape ?? '#efe1b5', { rough: .7 }), { lw: .0018 }); tp.position.set(s * (w / 2 - w * .06), h / 2 - Math.min(w, h) * .02, d + .0012); tp.rotation.z = -s * .62; g.add(tp); } }
  else if (fix === 'magnet') { const mg = discZ(.02, .012, mat(o.pinColor ?? C.blue, { rough: .4 })); mg.position.set(0, h / 2 - .04, d + .006); g.add(mg); }
  g.userData.face = { mesh: face, tex, w: w - .002, h: h - .002 };
  return { g, face, tex, body, d };
}
/** a marker highlight swipe across a line box [x, y, w, h] (canvas px), progress k */
function highlight(x, b, k, color = '#ffe14a') {
  if (k <= 0) return; x.save(); x.globalAlpha = .55; x.fillStyle = color; const w = b[2] * k, R = rnd(7);
  x.beginPath(); x.moveTo(b[0] - 6, b[1] + b[3] * .12); x.lineTo(b[0] + w, b[1] + b[3] * .06 + R() * 3); x.lineTo(b[0] + w + 4, b[1] + b[3] * .92); x.lineTo(b[0] - 4, b[1] + b[3] * .98); x.closePath(); x.fill(); x.restore();
}
// marks drawn by hand: start 1 frame before the cue, `dur` long
const markK = (t, at, dur = 5 * F) => at == null ? 1 : seg(t, at - F, at - F + dur);

// =====================================================================================================================
// KINDS
// =====================================================================================================================

// ---------- sign ----------
DOCS.sign = "text ('\\n' = new line), sub, style 'wood'|'metal'|'street'|'neon'|'hang', arrow 'left'|'right'|'up'|'down' (wood/hang: the board is an arrow), mount 'posts'|'pole'|'hang'|'wall', height (board bottom / hanging point, m), w, h, d, color, textColor, glow (neon colour), frame (neon border colour), lightAt (neon flickers on: on, off 1 frame, on), buzz (a dead frame now and then), light: false (no coloured spill)";
function woodPlanks(x, W, H, base, seed = 3, n) {
  const R = rnd(seed); n = n ?? Math.max(2, Math.round(H / W * 5)); x.fillStyle = base; x.fillRect(0, 0, W, H); const ph = H / n;
  for (let i = 0; i < n; i++) { x.fillStyle = shade(base, (R() - .5) * .14); x.fillRect(0, i * ph, W, ph);
    x.globalAlpha = .28; for (let k = 0; k < 7; k++) { x.strokeStyle = shade(base, -.25 - R() * .1); x.lineWidth = 1 + R() * 2.5; const y = i * ph + R() * ph; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(W * .3, y + (R() - .5) * ph * .2, W * .6, y + (R() - .5) * ph * .2, W, y + (R() - .5) * ph * .15); x.stroke(); }
    x.globalAlpha = 1; if (i) { x.fillStyle = shade(base, -.42); x.fillRect(0, i * ph - H * .006, W, H * .012); } }
}
function arrowGlyph(x, cx, cy, s, dir, col) {
  x.save(); x.translate(cx, cy); x.rotate({ right: 0, down: PI / 2, left: PI, up: -PI / 2 }[dir] ?? 0); x.fillStyle = col; x.beginPath();
  x.moveTo(s * .5, 0); x.lineTo(s * .02, -s * .42); x.lineTo(s * .02, -s * .17); x.lineTo(-s * .5, -s * .17); x.lineTo(-s * .5, s * .17); x.lineTo(s * .02, s * .17); x.lineTo(s * .02, s * .42); x.closePath(); x.lineJoin = 'round'; x.strokeStyle = col; x.lineWidth = s * .08; x.stroke(); x.fill(); x.restore();
}
function paintSign(x, W, H, p) {
  const st = p.style;
  if (st === 'wood' || st === 'hang') woodPlanks(x, W, H, p.base, p.seed);
  else if (st === 'neon') { x.fillStyle = p.base; x.fillRect(0, 0, W, H); grain(x, W, H, 4, .08, 900, '#000'); }
  else { x.fillStyle = p.base; x.fillRect(0, 0, W, H); const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.12)'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.strokeStyle = p.fg; x.lineWidth = H * (st === 'street' ? .045 : .035); const m = H * (st === 'street' ? .08 : .1); rrPath(x, m, m, W - 2 * m, H - 2 * m, H * .1); x.stroke(); }
  if (st === 'neon') return;
  let cx = W / 2, avail = W * .84;
  if (p.arrow) { const aw = H * .56, left = p.arrow === 'left' || p.arrow === 'up'; const ax = left ? H * .2 + aw / 2 : W - H * .2 - aw / 2; arrowGlyph(x, ax, H / 2, aw, p.arrow, p.fg); cx += (left ? 1 : -1) * aw * .62; avail -= aw * 1.3; }
  if (p.arrowShape) { cx += (p.arrowShape === 'right' ? -1 : 1) * H * .2; avail -= H * .45; }
  const nl = p.lines.length + (p.sub ? .62 : 0), lh = H * .74 / nl; let y = H / 2 - (nl * lh) / 2 + lh / 2;
  const painted = st === 'wood' || st === 'hang';
  for (const l of p.lines) { txt(x, l, cx, y + lh * .04, { size: lh * .8, maxW: avail, color: p.fg, stroke: painted ? shade(p.base, -.5) : null, strokeW: lh * .1, shadow: painted ? 'rgba(30,15,5,.35)' : null }); y += lh; }
  if (p.sub) txt(x, p.sub, cx, y - lh * .14, { size: lh * .4, weight: 600, maxW: avail, color: p.fg, ls: .04 });
}
function paintNeon(x, W, H, p, on) {
  x.clearRect(0, 0, W, H);
  const tube = (draw, col, px) => { x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
    if (on) { x.shadowColor = col; x.shadowBlur = px * .45; x.strokeStyle = col; x.lineWidth = px * .15; draw(); x.shadowBlur = px * .15; x.strokeStyle = mixHex(col, '#ffffff', .78); x.lineWidth = px * .05; draw(); }
    else { x.strokeStyle = mixHex(col, '#4a4050', .72); x.lineWidth = px * .13; draw(); x.strokeStyle = mixHex(col, '#9a90a0', .6); x.lineWidth = px * .035; draw(); }
    x.restore(); };
  const m = H * .07, fcol = p.frame ?? C.neonBlue; if (p.frame !== false) tube(() => { rrPath(x, m, m, W - 2 * m, H - 2 * m, H * .14); x.stroke(); }, fcol, H * .2);
  const nl = p.lines.length + (p.sub ? .55 : 0), lh = H * .74 / nl; let y = H / 2 - nl * lh / 2 + lh / 2;
  for (const l of p.lines) { let px = lh * .98; font(x, px); const mw = x.measureText(l).width; if (mw > W * .8) px *= W * .8 / mw; font(x, px); x.textAlign = 'center'; x.textBaseline = 'middle'; tube(() => x.strokeText(l, W / 2, y + px * .04), p.fg, px); y += lh; }
  if (p.sub) { let px = lh * .42; font(x, px, 800); const mw = x.measureText(p.sub).width; if (mw > W * .7) px *= W * .7 / mw; font(x, px, 800); x.letterSpacing = px * .12 + 'px'; x.textAlign = 'center'; x.textBaseline = 'middle'; tube(() => x.strokeText(p.sub, W / 2, y - lh * .18), p.frame || fcol, px); x.letterSpacing = '0px'; }
}
KINDS.sign = (S, o) => {
  const style = o.style || 'wood', g = new THREE.Group(), U = g.userData;
  const lines = String(o.text ?? 'OPEN').split('\n'), sub = o.sub, arrow = o.arrow;
  const shaped = (arrow === 'left' || arrow === 'right') && (style === 'wood' || style === 'hang');
  const longest = Math.max(...lines.map(l => l.length), sub ? sub.length * .5 : 0);
  const w = o.w ?? clamp(longest * .13 + .42 + (arrow && !shaped ? .32 : 0) + (shaped ? .2 : 0), .7, 3.4);
  const h = o.h ?? (style === 'street' ? .26 : .22 + lines.length * .16 + (sub ? .11 : 0));
  const d = o.d ?? ({ street: .035, neon: .06, metal: .035 }[style] ?? .07);
  const base = o.color ?? { wood: '#b77a40', metal: '#2f6fb0', street: '#1e7a4c', neon: '#1d1730', hang: '#b77a40' }[style] ?? '#b77a40';
  const fg = o.textColor ?? (style === 'neon' ? (o.glow ?? C.neonPink) : style === 'wood' || style === 'hang' ? '#fbf1dc' : '#ffffff');
  const bev = Math.min(.02, d * .3), sw = w - 2 * bev, sh = h - 2 * bev;
  let shape;
  if (shaped) { const tip = sh * .5; let P = [[-sw / 2, -sh / 2], [sw / 2 - tip, -sh / 2], [sw / 2, 0], [sw / 2 - tip, sh / 2], [-sw / 2, sh / 2]]; if (arrow === 'left') P = P.map(([a, b]) => [-a, b]).reverse(); shape = roundPoly(P, sh * .1); }
  else shape = rrShape(sw, sh, style === 'street' ? sh * .18 : Math.min(sh, sw) * .14);
  const p = { style, lines, sub, base, fg, arrow: shaped ? null : arrow, arrowShape: shaped ? arrow : null, seed: o.seed ?? 3, frame: o.frame };
  const tex = texFor(sw, sh, (x, W, H) => paintSign(x, W, H, p), { ppm: 1100 }); tex.repeat.set(1 / sw, 1 / sh); tex.offset.set(.5, .5);
  const metal = style === 'metal' || style === 'street';
  const board = mesh(splitCaps(extrude(shape, d, bev)), [new THREE.MeshStandardMaterial({ map: tex, roughness: metal ? .45 : .85, metalness: metal ? .1 : 0 }), mat(shade(base, -.28)), mat(shade(base, -.1))]);
  g.add(board);
  const mount = o.mount ?? { wood: 'posts', metal: 'pole', street: 'pole', neon: 'wall', hang: 'hang' }[style] ?? 'wall';
  let cy;
  if (mount === 'posts') { const hb = o.height ?? .85; cy = hb + h / 2; const pc = o.postColor ?? shade(style === 'wood' ? base : '#8a5a32', -.18), px = shaped ? (arrow === 'right' ? -1 : 1) * sw * .12 : 0;
    for (const s of [-1, 1]) { const post = box(.075, hb + h * .92, .075, .02, pc); post.position.set(px + s * Math.min(sw * .33, .55), (hb + h * .92) / 2, -d / 2 - .04); g.add(post); }
    board.position.y = cy; U.solid = true; }
  else if (mount === 'pole') { const hb = o.height ?? 2.0; cy = hb + h / 2; const top = cy + h / 2 + .04; g.add(rod([0, 0, -d / 2 - .035], [0, top, -d / 2 - .035], .032, mat(o.postColor ?? '#8d969e', { metal: .4, rough: .45 })));
    g.add(ball(.045, mat(o.postColor ?? '#8d969e', { metal: .4, rough: .45 }), { p: [0, top + .03, -d / 2 - .035] }));
    if (metal) for (const sy of [-1, 1]) g.add(box(.08, .03, .03, .008, mat('#6d757d', { metal: .5, rough: .4 }), { p: [0, cy + sy * h * .3, -d / 2 - .012] }));
    board.position.y = cy; U.solid = true; }
  else if (mount === 'hang') { const L = o.chain ?? .22; cy = -L - h / 2; U.y0 = o.height ?? 2.7; U.base = L + h;
    const arm = rod([-sw * .6, 0, 0], [sw * .6, 0, 0], .022, mat('#3a3a40', { metal: .6, rough: .35 })); g.add(arm);
    for (const s of [-1, 1]) g.add(rod([s * sw * .36, -.01, 0], [s * sw * .36, -L + .01, 0], .006, mat('#4a4a52', { metal: .6, rough: .35 }), { lw: .002 }));
    board.position.y = cy; }
  else { cy = 0; board.position.z = d / 2; U.y0 = o.height ?? (style === 'neon' ? 2.3 : 1.7); U.base = h / 2; }
  if (style === 'metal') for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(ball(Math.min(h, w) * .035, mat('#c9d0d8', { metal: .6, rough: .3 }), { p: [sx * (sw / 2 - h * .06), board.position.y + sy * (sh / 2 - h * .06), board.position.z + d / 2], lw: .002 }));
  // neon: glowing tubes on a transparent plane, coloured spill light
  let upd = null;
  if (style === 'neon') {
    const TW = Math.round(clamp(sw * 1100, 1024, 2048)), TH = Math.round(TW * sh / sw);
    const onT = canvasTex(TW, TH, (x, W, H) => paintNeon(x, W, H, p, true)), offT = canvasTex(TW, TH, (x, W, H) => paintNeon(x, W, H, p, false));
    const gm = glowMat(onT, o.glowK ?? 2.2, { transparent: true }); const gp = plane(sw, sh, gm, { unlit: true }); gp.position.set(0, board.position.y, board.position.z + d / 2 + .012); g.add(gp);
    let L = null; if (o.light !== false) { L = new THREE.PointLight(fg, 0, o.lightRange ?? 4, 1.6); L.position.set(0, board.position.y, board.position.z + .5); g.add(L); }
    const stateAt = t => { if (o.lightAt != null) { const f = Math.floor((t - o.lightAt) * 30 + .02); if (f < 0 || f === 1) return false; } if (o.buzz && hash(Math.floor(t * 30 + .02), 5) < .04) return false; return true; };
    upd = t => { const on = stateAt(t); gm.map = on ? onT : offT; gm.color.setScalar(on ? (o.glowK ?? 2.2) : .9); if (L) L.intensity = on ? (o.lightK ?? 2.5) : 0; };
    U.screen = onT;
  }
  U.lw = o.lw ?? .009; return finish(S, g, 'sign', o, upd);
};

// ---------- poster ----------
DOCS.poster = "title, sub, kicker (small caps line on top), plate (e.g. 'PLATE XIII'), draw ('tree'|'leaf'|'fruit'|'coin'|'money'|'house'|'bolt'|'warning'|'heart'|'globe'|'bars'|'line'|'pie'|'person'|'drop'|'flame'|'star'|'check'|'cross'|'clock'|'up'|'down' or fn(x, X, Y, W, H)), image (IMG key), figs: [{ draw|image, label }], footer, style 'plate'|'bold'|'photo', color (bold background), paper, w, h, fix 'tape'|'pins'|'pin'|'none', frame (wood frame), rip: t (tears off up-left over 12 frames)";
function drawPoster(x, W, H, o, paper) {
  const style = o.style || 'plate', u = W / 100;
  if (style === 'bold') {
    const bg = o.color ?? C.red, fg = textOn(bg); x.fillStyle = bg; x.fillRect(0, 0, W, H); grain(x, W, H, 3, .06);
    x.strokeStyle = fg; x.lineWidth = u * 1.2; x.strokeRect(u * 4, u * 4, W - u * 8, H - u * 8);
    if (o.kicker) txt(x, o.kicker.toUpperCase(), W / 2, H * .09, { size: u * 4.2, color: fg, ls: .12, weight: 600, maxW: W * .8 });
    picture(x, o, W * .18, H * .15, W * .64, H * .42);
    block(x, (o.title ?? 'TITLE').toUpperCase(), W / 2, H * .7, W * .84, H * .2, { color: fg, size: u * 16, lh: 1 });
    if (o.sub) block(x, o.sub, W / 2, H * .86, W * .8, H * .08, { color: fg, size: u * 5, weight: 600 });
    return;
  }
  x.fillStyle = paper; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W / 2, H / 2, W * .3, W / 2, H / 2, W * .85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,60,20,.18)'); x.fillStyle = vg; x.fillRect(0, 0, W, H); grain(x, W, H, 5, .05);
  if (style === 'photo') {
    if (!picture(x, o, 0, 0, W, H * .76, 'cover')) { x.fillStyle = '#9db8c9'; x.fillRect(0, 0, W, H * .76); }
    x.fillStyle = paper; x.fillRect(0, H * .76, W, H * .24);
    block(x, o.title ?? '', W / 2, H * .84, W * .88, H * .1, { size: u * 9 }); if (o.sub) txt(x, o.sub, W / 2, H * .93, { size: u * 4, weight: 600, maxW: W * .85, color: '#5a4636' });
    return;
  }
  const ink = o.inkColor ?? '#3a2a1c';
  x.strokeStyle = ink; x.lineWidth = u * .35; x.strokeRect(u * 4, u * 4, W - u * 8, H - u * 8); x.lineWidth = u * .15; x.strokeRect(u * 5.2, u * 5.2, W - u * 10.4, H - u * 10.4);
  let y = H * .065;
  if (o.kicker) { txt(x, o.kicker.toUpperCase(), W / 2, y + u * 2, { size: u * 3, weight: 600, color: ink, ls: .14, maxW: W * .8 }); y += u * 5; }
  if (o.plate) { txt(x, o.plate.toUpperCase(), W / 2, y + u * 1.5, { size: u * 3.2, color: ink, ls: .08 }); y += u * 4; }
  if (o.kicker || o.plate) { x.fillStyle = ink; x.fillRect(W * .3, y, W * .4, u * .25); y += u * 2; }
  const figs = o.figs || [], picBot = H * (figs.length ? .58 : .66);
  picture(x, o, W * .12, y + u * 2, W * .76, picBot - y - u * 4);
  block(x, (o.title ?? 'TITLE').toUpperCase(), W / 2, picBot + H * .06, W * .82, H * .09, { size: u * 11, color: ink, ls: .03 });
  let yy = picBot + H * .125;
  if (o.sub) { txt(x, o.sub, W / 2, yy, { size: u * 4.4, weight: 600, italic: true, color: '#5a4636', maxW: W * .8 }); yy += H * .04; }
  if (figs.length) { const n = figs.length, fw = W * .76 / n; figs.forEach((f, i) => { const X = W * .12 + i * fw; picture(x, f, X + fw * .15, yy + u, fw * .7, H * .13); if (f.label) txt(x, f.label, X + fw / 2, yy + H * .16, { size: u * 2.8, weight: 600, italic: true, color: ink, maxW: fw * .9 }); }); }
  if (o.footer) txt(x, o.footer, W / 2, H - u * 7.5, { size: u * 2.4, weight: 600, italic: true, color: '#6a5646', maxW: W * .8 });
}
KINDS.poster = (S, o) => {
  const w = o.w ?? .62, h = o.h ?? .88, paper = o.paper ?? '#efe6cf';
  const sh = sheet(w, h, (x, W, H) => drawPoster(x, W, H, o, paper), { paper, fix: o.frame ? 'none' : (o.fix ?? 'tape'), thick: .005 });
  const g = new THREE.Group(), pivot = new THREE.Group(); pivot.add(sh.g); g.add(pivot);
  if (o.frame) { const fw = .045, fd = .03, fc = o.frameColor ?? '#6e4325';
    for (const [x0, y0, ww, hh] of [[0, h / 2 + fw / 2, w + 2 * fw, fw], [0, -h / 2 - fw / 2, w + 2 * fw, fw], [-w / 2 - fw / 2, 0, fw, h], [w / 2 + fw / 2, 0, fw, h]]) g.add(box(ww, hh, fd, .008, fc, { p: [x0, y0, fd / 2] }));
    sh.g.position.z = .006; }
  g.userData.face = sh.g.userData.face; g.userData.y0 = 1.55; g.userData.base = h / 2; g.userData.lw = .004;
  let upd = null;
  if (o.rip != null) { const P0 = pivot.position.clone(); upd = t => { const k = E.inQuad(seg(t, o.rip, o.rip + 12 * F)); pivot.visible = k < 1; pivot.position.set(P0.x - k * w * 1.6, P0.y + k * h * 1.1 + Math.sin(k * PI) * h * .2, P0.z + k * .25); pivot.rotation.set(-k * .5, k * .4, k * .9); }; }
  return finish(S, g, 'poster', o, upd);
};

// ---------- notice / document ----------
DOCS.notice = "title, text (wrapped body), lines: [...] (one per row), textSize (% of the width), draw / image, tabs: 'text' (tear-off tabs), style 'paper'|'sticky'|'document'|'card', w, h, paper, org (document letterhead, invented), fix 'pin'|'pins'|'tape'|'magnet'|'none', tilt (rad), highlight: { line: index | match: 'text', t, color } (a marker swipe across that row ON its cue; an array for several), signature (document)";
DOCS.document = 'notice with style "document" (white A4 report: heading, rows, highlight on cue)';
function drawNotice(x, W, H, o, k, hl) {
  const st = o.style || 'paper', u = W / 100, paper = o.paper ?? { sticky: '#ffe169', document: '#fbfaf5', card: '#ffffff' }[st] ?? '#f6efdd';
  x.fillStyle = paper; x.fillRect(0, 0, W, H); grain(x, W, H, 9, st === 'document' ? .02 : .04);
  if (st === 'sticky') { const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,.06)'); gr.addColorStop(.12, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
  const ink = o.inkColor ?? (st === 'sticky' ? '#2a2a6a' : INK), boxes = []; let y = H * (st === 'document' ? .08 : .1);
  if (st === 'document') { x.fillStyle = o.accent ?? C.navy; x.fillRect(u * 7, y - u * 2, u * 3, u * 3); txt(x, (o.org ?? 'NORTHWIND RECORDS OFFICE').toUpperCase(), u * 12, y - u * .5, { size: u * 2.6, align: 'left', weight: 600, color: '#5a5a66', ls: .1, maxW: W * .7 }); y += u * 5; x.fillStyle = '#c9c9d2'; x.fillRect(u * 7, y, W - u * 14, u * .3); y += u * 5; }
  if (o.title) { const r = block(x, o.title, st === 'document' ? u * 7 : W / 2, y + u * 4.5, W * .86, u * 11, { size: u * (st === 'sticky' ? 11 : 8.5), color: ink, align: st === 'document' ? 'left' : 'center' }); y = r.y0 + (r.lines.length - 1) * r.lh + r.px * .6 + u * 4; }
  const left = u * 7, maxW = W - u * 14;
  let rows = o.lines ? o.lines.map(String) : null; let px = u * (o.textSize ?? (st === 'sticky' ? 15 : st === 'document' ? 6.6 : 6.4));
  if (!rows && o.text) { font(x, px, 600); rows = wrap(x, o.text, maxW); }
  const picH = (o.draw || o.image) ? H * .26 : 0, bottom = H - (o.tabs ? H * .2 : u * 8) - picH - (o.signature ? u * 10 : 0);
  if (rows) { const lh = Math.min(px * 1.4, (bottom - y) / Math.max(1, rows.length)); px = Math.min(px, lh / 1.3);
    rows.forEach((r, i) => { const yy = y + lh * (i + .5); font(x, px, 600); const tw = Math.min(maxW, x.measureText(r).width); boxes.push([st === 'sticky' ? W / 2 - tw / 2 : left, yy - lh * .45, tw, lh * .9]); });
    for (const H2 of hl) { const i = H2.line ?? rows.findIndex(r => H2.match && r.toLowerCase().includes(String(H2.match).toLowerCase())); if (i >= 0 && boxes[i]) highlight(x, boxes[i], H2.k, H2.color); }
    rows.forEach((r, i) => txt(x, r, st === 'sticky' ? W / 2 : left, y + lh * (i + .5), { size: px, weight: 600, color: ink, align: st === 'sticky' ? 'center' : 'left', maxW }));
    y += lh * rows.length; }
  else if (st === 'document') { const R = rnd(o.seed ?? 4); const lh = u * 5.2; for (let i = 0; y + lh < bottom; i++) { const wv = (i % 5 === 4 ? .45 : .7 + R() * .28) * maxW; boxes.push([left, y, wv, lh * .8]); y += lh; }
    for (const H2 of hl) { const b = boxes[H2.line ?? 0]; if (b) highlight(x, b, H2.k, H2.color); }
    x.fillStyle = '#b9b9c4'; for (const b of boxes) rrPath(x, b[0], b[1] + b[3] * .3, b[2], b[3] * .38, b[3] * .19), x.fill(); }
  if (picH) picture(x, o, W * .15, (rows ? Math.min(y + u * 3, bottom) : bottom) + u * 2, W * .7, picH - u * 4);
  if (o.signature) { x.strokeStyle = '#2a3a8a'; x.lineWidth = u * .6; x.lineCap = 'round'; x.beginPath(); const sy = H - (o.tabs ? H * .2 : u * 6) - u * 4; x.moveTo(W * .58, sy); for (let i = 1; i <= 12; i++) x.lineTo(W * .58 + i * W * .025, sy - Math.sin(i * 1.7) * u * 2.2 - (i < 4 ? i : 4) * u * .3); x.stroke(); x.fillStyle = '#9a9aa6'; x.fillRect(W * .55, sy + u * 2, W * .38, u * .25); txt(x, o.signature, W * .74, sy + u * 4.5, { size: u * 2.4, weight: 600, color: '#6a6a76' }); }
  if (o.tabs) { const n = 7, tw = W / n, ty = H * .8; x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = Math.max(1, u * .25); x.setLineDash([u, u * .8]); x.beginPath(); x.moveTo(0, ty); x.lineTo(W, ty); x.stroke(); x.setLineDash([]);
    for (let i = 1; i < n; i++) { x.beginPath(); x.moveTo(i * tw, ty); x.lineTo(i * tw, H); x.stroke(); }
    for (let i = 0; i < n; i++) { x.save(); x.translate(i * tw + tw / 2, ty + (H - ty) / 2); x.rotate(-PI / 2); txt(x, o.tabs, 0, 0, { size: tw * .34, weight: 600, maxW: (H - ty) * .9, color: ink }); x.restore(); } }
  void k;
}
KINDS.notice = (S, o) => {
  const st = o.style || 'paper', w = o.w ?? { sticky: .2, document: .5, card: .32 }[st] ?? .42, h = o.h ?? { sticky: .2, document: .7, card: .22 }[st] ?? .56;
  const HL = [].concat(o.highlight || []).map(h2 => ({ ...h2 }));
  const hlAt = t => HL.map(h2 => ({ ...h2, k: E.outCubic(markK(t, h2.t, 7 * F)) }));
  const fix = o.fix ?? (st === 'sticky' ? 'none' : st === 'document' ? 'none' : 'pin');
  const sh = sheet(w, h, (x, W, H) => drawNotice(x, W, H, o, 1, hlAt(-1e9)), { paper: o.paper ?? { sticky: '#ffe169', document: '#fbfaf5', card: '#ffffff' }[st] ?? '#f6efdd', fix, thick: st === 'card' ? .006 : .003 });
  const g = sh.g; g.rotation.z = o.tilt ?? (st === 'document' ? 0 : (rnd(o.seed ?? 2)() - .5) * .09);
  const wrapG = new THREE.Group(); wrapG.add(g); wrapG.userData.face = g.userData.face; wrapG.userData.y0 = 1.45; wrapG.userData.base = h / 2; wrapG.userData.lw = .003;
  const upd = HL.length ? keyed(sh.tex, t => hlAt(t).map(h2 => Math.round(h2.k * 30)).join(','), (x, W, H, t) => drawNotice(x, W, H, o, 1, hlAt(t))) : null;
  return finish(S, wrapG, st === 'document' ? 'document' : 'notice', o, upd);
};
KINDS.document = (S, o) => KINDS.notice(S, { ...o, style: 'document' });

// ---------- screen ----------
DOCS.screen = "device 'tv'|'retro'|'monitor'|'phone'|'tablet'|'wall', w (screen width m), aspect, color (housing), glow (brightness, 1.05), mount 'stand'|'wall' (tv), powerOn: t (dark until then, opens like a CRT on its cue); content (or states: [{ t, ...content }] switching ON each cue): bg, fg, accent, title, live, ui 'news'|'stock'|'chat'|'bank'|'call'|'error'|'app', big (text), count: { from, to, t0, t1, money, decimals, pre, suf }, lines: [...], type: [t0, t1] (lines typed), chart: { type 'line'|'bars'|'pie', values, colors, t0, t1 (draws on) }, image (IMG key) / draw, messages: [{ text, me, t }], ticker (scrolling text), name (call)";
function drawChart(x, X, Y, W, H, c, k) {
  const V = c.values ?? [3, 5, 4, 7, 6, 9], max = c.max ?? Math.max(...V) * 1.1, min = c.min ?? 0, col = c.color ?? '#35d07f', cols = c.colors ?? ['#3f8fe0', '#f6c945', '#e2432f', '#35d07f', '#a052ff'];
  const type = c.type ?? 'line';
  if (type === 'pie') { const tot = V.reduce((a, b) => a + b, 0) || 1, R = Math.min(W, H) * .45; let a = -PI / 2, left = k * TAU;
    V.forEach((v, i) => { const sw = Math.min(left, v / tot * TAU); if (sw <= 0) return; x.beginPath(); x.moveTo(X + W / 2, Y + H / 2); x.arc(X + W / 2, Y + H / 2, R, a, a + sw); x.closePath(); x.fillStyle = cols[i % cols.length]; x.fill(); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = R * .02; x.stroke(); a += sw; left -= sw; }); return; }
  x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = Math.max(1, H * .006); for (let i = 0; i <= 4; i++) { const yy = Y + H * i / 4; x.beginPath(); x.moveTo(X, yy); x.lineTo(X + W, yy); x.stroke(); }
  const py = v => Y + H - (v - min) / (max - min) * H;
  if (type === 'bars') { const bw = W / V.length; V.forEach((v, i) => { const kk = clamp(k * V.length - i * .6); const hh = (py(min) - py(v)) * E.outCubic(kk); x.fillStyle = cols[i % cols.length]; rrPath(x, X + i * bw + bw * .15, py(min) - hh, bw * .7, hh, bw * .08); x.fill(); }); return; }
  const n = V.length, px = i => X + W * i / (n - 1), upto = k * (n - 1), last = Math.floor(upto), f = upto - last;
  const pts = []; for (let i = 0; i <= last && i < n; i++) pts.push([px(i), py(V[i])]); if (last < n - 1 && f > 0) pts.push([lerp(px(last), px(last + 1), f), lerp(py(V[last]), py(V[last + 1]), f)]);
  if (pts.length < 2) return;
  const gr = x.createLinearGradient(0, Y, 0, Y + H); gr.addColorStop(0, col + '66'); gr.addColorStop(1, col + '00'); x.fillStyle = gr; x.beginPath(); x.moveTo(pts[0][0], Y + H); for (const p of pts) x.lineTo(p[0], p[1]); x.lineTo(pts[pts.length - 1][0], Y + H); x.closePath(); x.fill();
  x.strokeStyle = col; x.lineWidth = Math.max(3, H * .025); x.lineJoin = 'round'; x.lineCap = 'round'; x.shadowColor = col; x.shadowBlur = H * .03; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); x.shadowBlur = 0;
  const e = pts[pts.length - 1]; x.fillStyle = '#ffffff'; x.beginPath(); x.arc(e[0], e[1], H * .028, 0, TAU); x.fill();
}
function drawScreen(x, W, H, s, t, o, onK = 1) {
  const ui = s.ui, bg = s.bg ?? { news: '#0f1d3a', stock: '#0b1420', error: '#2a0d12', chat: '#eef1f5', call: '#14202e', bank: '#0f2a26' }[ui] ?? '#13284a';
  const fg = s.fg ?? (ui === 'chat' ? '#1b2330' : '#ffffff'), acc = s.accent ?? { news: '#e2432f', stock: '#35d07f', error: '#ff4a3d', chat: '#3f6fd1', bank: '#2ec4a0', call: '#35d07f' }[ui] ?? C.brand;
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, shade(bg, .1)); gr.addColorStop(1, shade(bg, -.18)); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  const phone = o.device === 'phone' || o.device === 'tablet', u = Math.min(W, H) / (o.device === 'phone' ? 6.5 : o.device === 'tablet' ? 8 : 10), P = u * .6;
  let top = phone ? u * 1.1 : P, bottom = H - P;
  if (phone) { txt(x, s.clock ?? '12:30', P, u * .55, { size: u * .42, align: 'left', color: fg }); x.fillStyle = fg; rrPath(x, W - P - u * .7, u * .4, u * .62, u * .3, u * .06); x.fill(); }
  if (s.title || ui === 'news' || ui === 'stock' || ui === 'bank') {
    const hh = u * 1.3, title = s.title ?? { news: 'BREAKING NEWS', stock: 'MARKETS', bank: 'MY ACCOUNT' }[ui];
    x.fillStyle = acc; x.fillRect(0, top - P * .2, W, hh); txt(x, title, P, top - P * .2 + hh / 2, { size: hh * .52, align: 'left', color: textOn(acc), maxW: W * .7 });
    if (s.live || ui === 'news') { const lw2 = u * 1.5; x.fillStyle = '#ffffff'; rrPath(x, W - P - lw2, top - P * .2 + hh * .22, lw2, hh * .56, hh * .12); x.fill(); txt(x, 'LIVE', W - P - lw2 / 2, top - P * .2 + hh / 2, { size: hh * .36, color: acc }); }
    top += hh + P * .5;
  }
  if (s.ticker || ui === 'news') { const th = u * .95, msg = (s.ticker ?? '') + '   •   '; x.fillStyle = '#ffffff'; x.fillRect(0, H - th, W, th); font(x, th * .5, 800); const mw = Math.max(W * .5, x.measureText(msg).width);
    const off = ((t - (s.t ?? 0)) * W * .18) % mw; x.save(); x.beginPath(); x.rect(0, H - th, W, th); x.clip(); for (let X = -off; X < W; X += mw) txt(x, msg, X, H - th / 2, { size: th * .5, align: 'left', color: '#14202e' }); x.restore(); bottom = H - th - P * .4; }
  if (ui === 'chat') {
    let y = top + P * .3; for (const m of s.messages || []) { if (m.t != null && t < m.t - CE) continue; font(x, u * .55, 600); const L = wrap(x, m.text, W * .62), bw = Math.max(...L.map(l => x.measureText(l).width)) + u * .9, bh = L.length * u * .7 + u * .5;
      const X = m.me ? W - P - bw : P; x.fillStyle = m.me ? acc : '#ffffff'; rrPath(x, X, y, bw, bh, u * .35); x.fill(); L.forEach((l, i) => txt(x, l, X + u * .45, y + u * .6 + i * u * .7, { size: u * .55, weight: 600, align: 'left', color: m.me ? '#ffffff' : '#1b2330' })); y += bh + u * .35; }
    return;
  }
  if (ui === 'call') { const cy = H * .36; x.fillStyle = acc; x.beginPath(); x.arc(W / 2, cy, u * 1.6, 0, TAU); x.fill(); txt(x, (s.name ?? 'Unknown')[0], W / 2, cy, { size: u * 1.6, color: '#fff' }); txt(x, s.name ?? 'Unknown', W / 2, cy + u * 2.4, { size: u * .8, color: fg, maxW: W * .86 }); txt(x, s.sub ?? 'calling...', W / 2, cy + u * 3.3, { size: u * .45, weight: 600, color: shade(fg, -.3) });
    for (const [dx, c] of [[-1, '#e2432f'], [1, '#35d07f']]) { x.fillStyle = c; x.beginPath(); x.arc(W / 2 + dx * W * .22, H * .82, u * .8, 0, TAU); x.fill(); } return; }
  if (ui === 'error') { const cy = (top + bottom) * .42; x.fillStyle = acc; x.beginPath(); x.arc(W / 2, cy, u * 1.7, 0, TAU); x.fill(); txt(x, '!', W / 2, cy + u * .1, { size: u * 2.4, color: '#fff' }); block(x, s.big ?? 'ERROR', W / 2, cy + u * 2.7, W * .84, u * 1.4, { color: fg, size: u * 1.3 });
    if (s.lines) s.lines.forEach((l, i) => txt(x, l, W / 2, cy + u * 4 + i * u * .8, { size: u * .55, weight: 600, color: shade(fg, -.25), maxW: W * .86 })); return; }
  if (s.image || s.draw) { const ph = (bottom - top) * (s.big || s.lines || s.chart ? .5 : 1); picture(x, s, P, top, W - 2 * P, ph, s.fit ?? 'cover'); top += ph + P * .4; }
  let big = s.big; if (s.count) big = num(countAt(t, s.count), s.count);
  if (ui === 'bank' && big == null) big = '$0';
  if (big != null) { const bh = (bottom - top) * (s.chart || s.lines ? .38 : .8); if (ui === 'bank' || ui === 'stock') txt(x, ui === 'bank' ? 'BALANCE' : (s.label ?? 'TODAY'), W / 2, top + u * .3, { size: u * .45, weight: 600, color: shade(fg, -.3), ls: .12 });
    txt(x, big, W / 2, top + bh / 2 + (ui ? u * .35 : 0), { size: Math.min(bh * .78, u * 3.2), maxW: W - 2 * P, color: s.bigColor ?? (ui === 'stock' ? acc : fg), glow: s.bigColor ?? (ui === 'stock' ? acc : null), glowR: .15 }); top += bh; }
  if (s.chart) { const c = s.chart, k = c.t0 != null ? E.inOutSine(seg(t, c.t0, c.t1 ?? c.t0 + .8)) : 1; const ch = (bottom - top) * (s.lines ? .62 : 1); drawChart(x, P * 1.2, top + P * .2, W - P * 2.4, ch - P * .6, { color: acc, ...c }, k); top += ch; }
  if (s.lines) { const L = s.lines.map(String); let chars = Infinity; if (s.type) { const tot = L.reduce((a, l) => a + l.length, 0); chars = Math.floor(tot * seg(t, s.type[0], s.type[1])); }
    const lh = Math.min(u * .9, (bottom - top) / Math.max(1, L.length)); L.forEach((l, i) => { const sh2 = l.slice(0, Math.max(0, chars)); chars -= l.length; if (!sh2) return;
      txt(x, sh2, P, top + lh * (i + .5), { size: lh * .62, weight: i === 0 && !s.title && !big ? 800 : 600, align: 'left', color: fg, maxW: W - 2 * P }); }); }
  if (onK < 1) { /* CRT opening: everything outside a growing band is black */ const bh = H * E.outCubic(clamp((onK - .25) / .75)), lh = Math.max(2, H * .012); x.fillStyle = '#000'; x.fillRect(0, 0, W, (H - Math.max(bh, lh)) / 2); x.fillRect(0, (H + Math.max(bh, lh)) / 2, W, H); if (onK < .3) { x.fillStyle = '#ffffff'; x.fillRect(W * (.5 - onK * 1.6), H / 2 - lh / 2, W * onK * 3.2, lh); } }
}
function glare(w, h) { const t = canvasTex(256, 256, (x, W, H) => { x.clearRect(0, 0, W, H); const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.38, 'rgba(255,255,255,0)'); g.addColorStop(.42, 'rgba(255,255,255,.06)'); g.addColorStop(.55, 'rgba(255,255,255,.025)'); g.addColorStop(.6, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); });
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }); const p = plane(w, h, m, { unlit: true }); p.userData.noPick = true; return p; }
KINDS.screen = (S, o) => {
  const dev = o.device || 'tv', g = new THREE.Group(), U = g.userData;
  const AS = { tv: 16 / 9, retro: 4 / 3, monitor: 16 / 9, phone: 9 / 19.5, tablet: 3 / 4, wall: 16 / 9 }[dev] ?? 16 / 9;
  const sw = o.w ?? { tv: 1.15, retro: .5, monitor: .58, phone: .068, tablet: .19, wall: 1.6 }[dev] ?? 1, sh = o.h ?? sw / (o.aspect ?? AS);
  const L = dev === 'tv' || dev === 'wall' ? 1600 : 1152, W = Math.round(sw / Math.max(sw, sh) * L), H = Math.round(sh / Math.max(sw, sh) * L);
  const states = (o.states || [o]).map(s => ({ ...s }));
  const stAt = t => { let i = 0; states.forEach((s, k) => { if (s.t == null || t >= s.t - CE) i = k; }); return i; };
  const onKAt = t => o.powerOn == null ? 1 : t < o.powerOn - 2 * F ? 0 : clamp((t - (o.powerOn - 2 * F)) / (6 * F));
  const paint = (x, w2, h2, t) => { const k = onKAt(t); if (k <= 0) { x.fillStyle = '#05070a'; x.fillRect(0, 0, w2, h2); return; } const s = states[stAt(t)]; drawScreen(x, w2, h2, s, t, o, k);
    if (dev === 'retro') { x.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < h2; y += 4) x.fillRect(0, y, w2, 2); const v = x.createRadialGradient(w2 / 2, h2 / 2, h2 * .3, w2 / 2, h2 / 2, w2 * .7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = v; x.fillRect(0, 0, w2, h2); }
    if (dev === 'phone' || dev === 'tablet') { x.save(); x.globalCompositeOperation = 'destination-in'; rrPath(x, 0, 0, w2, h2, w2 * .12); x.fill(); x.restore(); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#0a0b0e'; x.fillRect(0, 0, w2, h2); x.globalCompositeOperation = 'source-over'; if (dev === 'phone') { x.fillStyle = '#0a0b0e'; x.beginPath(); x.arc(w2 / 2, w2 * .055, w2 * .028, 0, TAU); x.fill(); } } };
  const t0 = S.t0 ?? 0, tex = canvasTex(W, H, (x, w2, h2) => paint(x, w2, h2, t0), { mip: true });
  const sm = glowMat(tex, o.glow ?? 1.05), scr = plane(sw, sh, sm, { unlit: true });
  const dark = '#202228', hc = o.color;
  let front = 0;
  if (dev === 'tv' || dev === 'wall' || dev === 'monitor') {
    const b = dev === 'monitor' ? .018 : .03, dd = dev === 'monitor' ? .03 : .045; g.add(box(sw + 2 * b, sh + 2 * b, dd, b * .6, hc ?? dark, { m: { rough: .45 } })); front = dd / 2;
    const stand = dev === 'monitor' || (dev === 'tv' && (o.mount ?? 'stand') === 'stand');
    if (stand) { const neckH = dev === 'monitor' ? .16 : .1, footW = dev === 'monitor' ? .22 : sw * .38, by = -(sh / 2 + b) - neckH;
      g.add(box(.06, neckH + .02, .035, .012, hc ?? '#2c2f36', { p: [0, -(sh / 2 + b) - neckH / 2, -dd * .2] }), box(footW, .022, dev === 'monitor' ? .16 : .2, .01, hc ?? '#2c2f36', { p: [0, by - .011, 0] }));
      g.children.forEach(c => c.position.y -= by - .022); U.base = 0; U.y0 = 0; U.solid = dev === 'tv'; }
    else { U.y0 = dev === 'wall' ? 1.7 : 1.5; U.base = sh / 2 + b; g.children.forEach(c => c.position.z += dd / 2); front += dd / 2; }
  } else if (dev === 'retro') {
    const bw = sw + .3, bh = sh + .16, bd = .4, col = hc ?? '#a8693b';
    const body = box(bw, bh, bd, .06, col); body.position.set(.05, 0, -bd / 2 + .02); g.add(body);
    g.add(box(sw + .07, sh + .07, .03, .03, '#e8dcc4', { p: [0, 0, .02] })); front = .036;
    for (const [yy, c] of [[.08, '#e8dcc4'], [-.05, '#e8dcc4']]) { const k = discZ(.028, .03, mat(c, { rough: .5 })); k.position.set(sw / 2 + .11, yy, .03); g.add(k); }
    g.add(box(.09, .07, .012, .01, '#3a2a20', { p: [sw / 2 + .11, -.15, .025] }));
    for (const s of [-1, 1]) { const a = [s * .04 + .05, bh / 2 - .02, -bd / 2], b2 = [s * .2 + .05, bh / 2 + .34, -bd / 2 - .04]; g.add(rod(a, b2, .006, mat('#c9d0d8', { metal: .6, rough: .3 }), { lw: .002 }), ball(.016, mat('#c9d0d8', { metal: .6, rough: .3 }), { p: b2, lw: .002 })); }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(rod([.05 + sx * (bw / 2 - .07), -bh / 2 + .02, -bd / 2 + .02 + sz * (bd / 2 - .07)], [.05 + sx * (bw / 2 - .05), -bh / 2 - .11, -bd / 2 + .02 + sz * (bd / 2 - .05)], .014, mat(shade(col, -.35))));
    g.children.forEach(c => c.position.y += bh / 2 + .12); scr.position.y = bh / 2 + .12; U.base = 0; U.y0 = 0; U.solid = true;
  } else {   // phone, tablet
    const b = dev === 'phone' ? .004 : .01, dd = dev === 'phone' ? .0085 : .008;
    g.add(box(sw + 2 * b, sh + 2 * b * 1.4, dd, dev === 'phone' ? .011 : .016, hc ?? '#23262e', { m: { rough: .35 }, lw: .0015 })); front = dd / 2; U.y0 = 1.15; U.base = sh / 2;
    const btn = box(.0025, .022, .003, .001, hc ?? '#23262e', { lw: .001 }); btn.position.set(sw / 2 + b + .0008, sh * .2, 0); g.add(btn);
  }
  scr.position.z = front + .0007; if (dev !== 'retro') scr.position.y = g.children[0].position.y; g.add(scr);
  const gl = glare(sw, sh); gl.position.copy(scr.position); gl.position.z += .0008; g.add(gl);
  U.screen = tex; U.face = { mesh: scr, tex, w: sw, h: sh }; U.lw = dev === 'phone' ? .0015 : dev === 'tablet' ? .002 : .006;
  const anim = states.some(s => s.count || s.chart?.t0 != null || s.type || s.ticker || s.ui === 'news' || s.messages?.some(m => m.t != null) || s.t != null) || o.powerOn != null;
  const upd = anim ? keyed(tex, t => { const i = stAt(t), s = states[i]; return [i, Math.round(onKAt(t) * 12), s.count ? countAt(t, s.count) : 0,
    s.chart?.t0 != null ? Math.round(seg(t, s.chart.t0, s.chart.t1 ?? s.chart.t0 + .8) * 60) : 0, s.type ? Math.round(seg(t, s.type[0], s.type[1]) * 400) : 0, (s.ticker || s.ui === 'news') ? Math.floor(t * 30) : 0, (s.messages || []).filter(m => m.t == null || t >= m.t - CE).length].join('|'); }, paint) : null;
  return finish(S, g, 'screen', o, upd);
};

// ---------- led (counter / message sign) ----------
DOCS.led = "from, to (or value), t0, t1 (rolls from `from` to `to`, LANDS EXACTLY on `to` at t1; t1 alone = 0.7 s roll), ease ('counter' default: per-frame steps, slightly accelerating, 1-frame holds), jitter, money ('$'|'€'|true), pre, suf, decimals, compact, before (text shown before t0, e.g. '10:42  108°F'), text (static) | texts: [[t, 'text'], ...] (switch ON each cue), style 'dots'|'seg', color, align, pitch (dot pitch m), cells (character width), mount 'pole'|'wall'|'desk'|'none', height (display bottom on a pole), header (a painted board above), headerColor, headerText, postColor, glow, sfx";
KINDS.led = (S, o) => {
  const g = new THREE.Group(), U = g.userData, style = o.style || 'dots';
  const from = o.from ?? 0, to = o.to ?? o.value ?? from; let t0 = o.t0, t1 = o.t1; if (t0 != null && t1 == null) t1 = t0 + .7; if (t1 != null && t0 == null) t0 = t1 - .7;
  const fv = v => num(v, o);
  const strAt = t => { if (o.texts) { let s = o.texts[0][1]; for (const [tt, ss] of o.texts) if (t >= tt - CE) s = ss; return String(s); } if (o.text != null) return String(o.text); if (o.before != null && t0 != null && t < t0) return String(o.before); return fv(rollAt(t, from, to, t0, t1, o)); };
  const cands = o.texts ? o.texts.map(x => String(x[1])) : o.text != null ? [String(o.text)] : [fv(from), fv(to), fv(Math.max(Math.abs(from), Math.abs(to)) * (from < 0 || to < 0 ? -1 : 1)), ...(o.before != null ? [String(o.before)] : [])];
  const lit = o.color ?? (style === 'seg' ? '#ff3b2f' : '#ffb238'), off = o.offColor ?? (style === 'seg' ? '#2a0e0c' : '#2a1a10'), bgc = o.bg ?? '#0e0a08';
  let DW, DH, tex, draw;
  if (style === 'dots') {
    const cols = o.cells ?? Math.max(...cands.map(s => cols57(s).length)) + 4, rows = 9, pitch = o.pitch ?? .032; DW = cols * pitch; DH = rows * pitch;
    const q = clamp(Math.floor(2048 / cols), 12, 40), p = { cols, rows, lit, off, bg: bgc, align: o.align };
    draw = (x, W, H, t) => drawDots(x, W, H, strAt(t), p); tex = canvasTex(cols * q, rows * q, (x, W, H) => draw(x, W, H, S.t0 ?? 0));
  } else {
    const ch = o.ch ?? .22, cw = ch * .56, wmax = Math.max(...cands.map(s => segWidth(s, cw))); DW = o.cellsW ?? wmax + cw * 1.2; DH = ch * 1.45;
    const k = clamp(2048 / DW, 200, 2400), Wp = Math.round(DW * k), Hp = Math.round(DH * k);
    draw = (x, W, H, t) => { x.fillStyle = bgc; x.fillRect(0, 0, W, H); const s = strAt(t), cwp = cw * k, chp = ch * k, sw2 = segWidth(s, cwp), X0 = o.align === 'left' ? cwp * .6 : o.align === 'center' ? (W - sw2) / 2 : W - cwp * .5 - sw2;
      const ghost = s.replace(/[0-9]/g, '8'); segText(x, ghost, X0, (H - chp) / 2, cwp, chp, off, null); segText(x, s, X0, (H - chp) / 2, cwp, chp, lit, null); };
    tex = canvasTex(Wp, Hp, (x, W, H) => draw(x, W, H, S.t0 ?? 0));
  }
  const disp = plane(DW, DH, glowMat(tex, o.glow ?? 1.7), { unlit: true });
  const fr = .06, dd = .1; const housing = box(DW + 2 * fr, DH + 2 * fr, dd, .03, o.housing ?? '#1d1f24', { m: { rough: .5 } });
  const panel = new THREE.Group(); panel.add(housing, disp); disp.position.z = dd / 2 + .001; g.add(panel);
  const mount = o.mount ?? 'pole';
  if (o.header) { const hh = o.headerH ?? Math.max(.4, DH * 1.1), hw = DW + 2 * fr + .06, hc = o.headerColor ?? '#f1e4c6';
    const ht = texFor(hw - .04, hh - .04, (x, W, H) => { x.fillStyle = hc; x.fillRect(0, 0, W, H); grain(x, W, H, 2, .05); x.fillStyle = o.headerAccent ?? '#c8452f'; x.fillRect(0, H * .84, W, H * .08); x.fillRect(0, H * .06, W, H * .03);
      txt(x, o.header, W / 2, H * (o.headerSub ? .42 : .5), { size: H * .46, maxW: W * .9, color: o.headerText ?? '#c8452f', shadow: 'rgba(80,30,20,.25)' }); if (o.headerSub) txt(x, o.headerSub, W / 2, H * .7, { size: H * .14, weight: 800, ls: .3, color: '#6a4a3a', maxW: W * .8 }); }, { ppm: 1000 });
    const hb = box(hw, hh, .09, .025, shade(hc, -.25)); hb.position.y = DH / 2 + fr + hh / 2 + .03; const hf = plane(hw - .04, hh - .04, paperMat(ht)); hf.position.set(0, hb.position.y, .046); panel.add(hb, hf); }
  const topY = () => new THREE.Box3().setFromObject(panel).max.y;
  if (mount === 'pole') { const hb = o.height ?? 2.4; panel.position.y = hb + DH / 2 + fr; const pc = o.postColor ?? '#3d7f8f', px = Math.min(DW * .32, .9), top = topY() - .05;
    for (const s of [-1, 1]) g.add(rod([s * px, 0, -dd / 2 - .055], [s * px, top, -dd / 2 - .055], .05, mat(pc, { rough: .5 })));
    g.add(box(px * 2 + .16, .06, .06, .015, shade(pc, -.2), { p: [0, panel.position.y - DH / 2 - fr - .05, -dd / 2 - .055] })); U.solid = true; }
  else if (mount === 'desk') { panel.position.y = DH / 2 + fr + .04; for (const s of [-1, 1]) g.add(box(.05, .05, dd * 1.6, .015, '#2a2c32', { p: [s * DW * .38, .025, 0] })); }
  else { U.y0 = o.height ?? 2; U.base = DH / 2 + fr; panel.position.z = dd / 2; }
  U.screen = tex; U.lw = o.lw ?? .008;
  if (t1 != null) sfx(S, o, t1, 'ding', -6);
  return finish(S, g, 'led', o, keyed(tex, strAt, draw));
};

// ---------- scoreboard ----------
DOCS.scoreboard = "teams: [{ name, color, score: n | [[t, n], ...] (changes ON each cue, the digits flash 8 frames) }], title, clock: { from: seconds, t0, t1?, to? } (counts down), period, w, h, color (lit digits), mount 'legs'|'wall'|'hang', height";
KINDS.scoreboard = (S, o) => {
  const g = new THREE.Group(), U = g.userData, w = o.w ?? 2.2, h = o.h ?? 1.25, teams = o.teams ?? [{ name: 'HOME', color: '#3f6fd1', score: 0 }, { name: 'AWAY', color: '#e2432f', score: 0 }];
  const sc = (tm, t) => { if (!Array.isArray(tm.score)) return { v: tm.score ?? 0, at: -1e9 }; let v = 0, at = -1e9; for (const [tt, vv] of tm.score) if (t >= tt - CE) { v = vv; at = tt; } return { v, at }; };
  const clockAt = t => { const c = o.clock; if (!c) return null; const rate = c.t1 != null ? ((c.from ?? 0) - (c.to ?? 0)) / (c.t1 - c.t0) : 1; const r = Math.max(c.to ?? 0, (c.from ?? 0) - Math.max(0, t - (c.t0 ?? 1e9)) * rate); const s = c.t1 != null && t >= c.t1 ? (c.to ?? 0) : r; return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
  const lit = o.color ?? '#ffb238';
  const draw = (x, W, H, t) => {
    x.fillStyle = '#10131c'; x.fillRect(0, 0, W, H); const u = W / 100;
    x.fillStyle = o.accent ?? '#e2432f'; x.fillRect(0, 0, W, H * .16); txt(x, (o.title ?? 'SCOREBOARD').toUpperCase(), W / 2, H * .085, { size: H * .09, color: '#fff', ls: .08, maxW: W * .6 });
    const n = teams.length, cw = W / n;
    teams.forEach((tm, i) => { const X = i * cw, s = sc(tm, t), fl = t - s.at < 8 * F && s.at > -1e8;
      x.fillStyle = tm.color ?? '#3f6fd1'; rrPath(x, X + cw * .1, H * .22, cw * .8, H * .14, H * .03); x.fill(); txt(x, String(tm.name ?? 'TEAM').toUpperCase(), X + cw / 2, H * .29, { size: H * .085, color: textOn(tm.color ?? '#3f6fd1'), maxW: cw * .72 });
      if (fl) { x.fillStyle = 'rgba(255,190,80,.22)'; rrPath(x, X + cw * .12, H * .41, cw * .76, H * .5, H * .03); x.fill(); }
      const str = String(s.v), chp = H * .42, cwp = chp * .56, sw2 = segWidth(str, cwp); segText(x, str.replace(/[0-9]/g, '8'), X + cw / 2 - sw2 / 2, H * .45, cwp, chp, '#2a1a10', null); segText(x, str, X + cw / 2 - sw2 / 2, H * .45, cwp, chp, fl ? '#fff2c0' : lit, null); });
    if (n === 2) { x.fillStyle = '#2a2e3a'; x.fillRect(W / 2 - u * .3, H * .22, u * .6, H * .7); }
    const ck = clockAt(t); if (ck) { const chp = H * .1, cwp = chp * .56, sw2 = segWidth(ck, cwp); x.fillStyle = '#05070b'; rrPath(x, W / 2 - sw2 / 2 - u, H * .9 - chp * .7, sw2 + 2 * u, chp * 1.3, u); x.fill(); segText(x, ck, W / 2 - sw2 / 2, H * .9 - chp / 2 - u * .2, cwp, chp, '#ff4a3d', null); }
    if (o.period) txt(x, o.period, W * .92, H * .085, { size: H * .06, color: '#fff', weight: 600 });
  };
  const tex = canvasTex(1600, Math.round(1600 * h / w), (x, W, H) => draw(x, W, H, S.t0 ?? 0));
  const panel = new THREE.Group(), fr = .07; panel.add(box(w + 2 * fr, h + 2 * fr, .14, .04, o.housing ?? '#262a35'), plane(w, h, glowMat(tex, o.glow ?? 1.25), { unlit: true, p: [0, 0, .071] })); g.add(panel);
  const mount = o.mount ?? 'legs';
  if (mount === 'legs') { const hb = o.height ?? 1.3; panel.position.y = hb + h / 2 + fr; for (const s of [-1, 1]) g.add(box(.1, hb + h * .6, .1, .02, '#3a3e4a', { p: [s * w * .36, (hb + h * .6) / 2, -.12] })); U.solid = true; }
  else if (mount === 'hang') { U.y0 = o.height ?? 3.2; panel.position.y = -h / 2 - fr - .3; for (const s of [-1, 1]) g.add(rod([s * w * .35, 0, 0], [s * w * .35, -.3, 0], .012, mat('#4a4e5a', { metal: .5 }))); U.base = h + .3; }
  else { U.y0 = o.height ?? 2.2; U.base = h / 2 + fr; panel.position.z = .07; }
  U.screen = tex; U.lw = .008;
  return finish(S, g, 'scoreboard', o, keyed(tex, t => teams.map(tm => { const s = sc(tm, t); return s.v + (t - s.at < 8 * F ? '*' : ''); }).join('|') + (clockAt(t) ?? ''), draw));
};

// ---------- board (chalkboard / whiteboard) ----------
DOCS.board = "style 'chalk'|'white', w, h, mount 'wall'|'easel', title (written at the top from the start), items: [{ text | draw ('circle'|'ellipse'|'underline'|'arrow'|'box'|'check'|'cross'|'plus'|'minus'|'equals'|'chart'|'down'|'bars'|'star'|'heart'|'house'|'person'|'sun'|'wave'|'dollar') | strokes: [[[x, y], ...], ...] (unit coords), pos: [u, v] (0..1 from the top-left: the item's centre; text: left edge with align 'left'), size (fraction of the board height), color, t (writing STARTS on this cue), dur (default text .06 s a letter, drawings .4 s), align, angle, weight }]";
function boardBase(st, W, H, seed) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), R = rnd(seed);
  if (st === 'white') { x.fillStyle = '#f7f8f6'; x.fillRect(0, 0, W, H); x.globalAlpha = .05; for (let i = 0; i < 18; i++) { x.strokeStyle = '#6a7a90'; x.lineWidth = 6 + R() * 30; x.beginPath(); const y = R() * H; x.moveTo(R() * W * .3, y); x.bezierCurveTo(W * .4, y + (R() - .5) * 80, W * .6, y + (R() - .5) * 80, W * (.7 + R() * .3), y); x.stroke(); } x.globalAlpha = 1;
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.45, 'rgba(255,255,255,.35)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  else { x.fillStyle = '#2f4b3c'; x.fillRect(0, 0, W, H); x.lineCap = 'round'; for (let i = 0; i < 26; i++) { x.globalAlpha = .018 + R() * .022; x.strokeStyle = '#dfe9df'; x.lineWidth = 40 + R() * 90; x.beginPath(); const y = R() * H, x0 = R() * W * .8; x.moveTo(x0, y); x.bezierCurveTo(x0 + W * .1, y - 30, x0 + W * .2, y + 30, x0 + W * (.15 + .25 * R()), y + (R() - .5) * 50); x.stroke(); } x.globalAlpha = 1; grain(x, W, H, seed, .06, 3000, '#0a1a12'); }
  return c;
}
function chalkGrain(x, X, Y, w, h, seed, col) { const R = rnd(seed), n = Math.round(w * h / 38); x.save(); x.fillStyle = col; for (let i = 0; i < n; i++) { x.globalAlpha = .55 * R(); const s = 1.5 + R() * 2.5; x.fillRect(X + R() * w, Y + R() * h, s, s); } x.restore(); }
function handText(x, s, X, Y, px, k, o) {
  const st = o.style, col = o.color, R = rnd(o.seed ?? 11); font(x, px, o.weight ?? (st === 'white' ? 800 : 600)); x.textBaseline = 'middle'; x.textAlign = 'left';
  const chars = [...String(s)], adv = chars.map(c => x.measureText(c).width), total = adv.reduce((a, b) => a + b, 0);
  let cx = o.align === 'left' ? X : o.align === 'right' ? X - total : X - total / 2, shown = k * chars.length;
  const jit = st === 'chalk' ? 1.6 : 1;
  for (let i = 0; i < chars.length; i++) { const f = clamp(shown - i); const dy = (R() - .5) * px * .07 * jit, rot = (R() - .5) * .09 * jit, sc = 1 + (R() - .5) * .07 * jit; if (f <= 0) break;
    x.save(); x.translate(cx + adv[i] / 2, Y + dy); x.rotate(rot); x.scale(sc, sc); if (f < 1) { x.beginPath(); x.rect(-adv[i] / 2 - 2, -px, adv[i] * f + 2, px * 2); x.clip(); }
    x.fillStyle = col; x.globalAlpha = st === 'chalk' ? .92 : 1; x.fillText(chars[i], -adv[i] / 2, 0); x.restore(); cx += adv[i]; }
  if (st === 'chalk') { const sx = o.align === 'left' ? X : o.align === 'right' ? X - total : X - total / 2; chalkGrain(x, sx, Y - px * .6, total * k, px * 1.2, o.seed ?? 3, '#2f4b3c'); }
}
KINDS.board = (S, o) => {
  const st = o.style || 'chalk', w = o.w ?? 1.6, h = o.h ?? 1.0, g = new THREE.Group(), U = g.userData;
  const items = (o.items || []).map((it, i) => ({ ...it, seed: 5 + i * 7, dur: it.dur ?? (it.text != null ? .06 * String(it.text).length + .1 : .4) }));
  if (o.title) items.unshift({ text: o.title, pos: [.5, .12], size: .12, t: null, seed: 1 });
  const PW = 2048, PH = Math.round(PW * h / w), base = boardBase(st, PW, PH, o.seed ?? 3);
  const kAt = (it, t) => it.t == null ? 1 : clamp((t - it.t + F) / it.dur);
  const draw = (x, W, H, t) => { x.drawImage(base, 0, 0, W, H);
    for (const it of items) { const k = kAt(it, t); if (k <= 0) continue; const col = it.color ?? (st === 'white' ? (it.draw ? '#d6402f' : '#1f3fae') : '#f4f1e6'), X = (it.pos?.[0] ?? .5) * W, Y = (it.pos?.[1] ?? .5) * H, sz = (it.size ?? (it.text != null ? .1 : .2)) * H;
      if (it.text != null) handText(x, it.text, X, Y, sz, k, { style: st, color: col, align: it.align, seed: it.seed, weight: it.weight });
      else { const strokes = it.strokes ?? (STROKES[it.draw] ?? STROKES.circle)(); const sx = sz / 2 * (it.aspect ?? 1), sy = sz / 2; x.save(); if (it.angle) { x.translate(X, Y); x.rotate(it.angle); x.translate(-X, -Y); } drawStrokes(x, strokes, X, Y, sx, sy, E.inOutSine(k), { color: col, seed: it.seed, width: it.width ?? Math.max(H * .008, sz * .045), wobble: it.wobble }); x.restore();
        if (st === 'chalk') chalkGrain(x, X - sx * 1.1, Y - sy * 1.1, sx * 2.2, sy * 2.2, it.seed, '#2f4b3c'); } } };
  const tex = canvasTex(PW, PH, (x, W, H) => draw(x, W, H, -1e9));
  const fc = o.frameColor ?? (st === 'white' ? '#c9d0d8' : '#9a6a3c'), fw = .05, fd = .045;
  const back = box(w + .02, h + .02, .025, .008, st === 'white' ? '#e9ecef' : '#243a2e'); back.position.z = .0125; g.add(back);
  const face = plane(w, h, paperMat(tex, { rough: st === 'white' ? .35 : .95 })); face.position.z = .026; g.add(face);
  for (const [x0, y0, ww, hh] of [[0, h / 2 + fw / 2, w + 2 * fw, fw], [0, -h / 2 - fw / 2, w + 2 * fw, fw], [-w / 2 - fw / 2, 0, fw, h], [w / 2 + fw / 2, 0, fw, h]]) g.add(box(ww, hh, fd, .012, mat(fc, { metal: st === 'white' ? .5 : 0, rough: st === 'white' ? .35 : .8 }), { p: [x0, y0, fd / 2] }));
  const tray = box(w * .7, .025, .08, .01, mat(fc, { metal: st === 'white' ? .5 : 0, rough: .6 })); tray.position.set(0, -h / 2 - fw - .01, .05); g.add(tray);
  if (st === 'white') ['#1f3fae', '#d6402f', '#2a2a2a'].forEach((c, i) => { const m = rod([-w * .2 + i * .14, -h / 2 - fw + .012, .06], [-w * .2 + i * .14 + .11, -h / 2 - fw + .012, .06], .011, mat(c, { rough: .4 }), { lw: .002 }); g.add(m); });
  else for (let i = 0; i < 3; i++) g.add(rod([-w * .18 + i * .1, -h / 2 - fw + .008, .06], [-w * .18 + i * .1 + .06, -h / 2 - fw + .008, .065], .007, mat('#f4f1e6'), { lw: .0015 }));
  if ((o.mount ?? 'wall') === 'easel') { const top = h + .95; g.children.forEach(c => { c.position.y += .6 + h / 2; c.position.z += .05; });
    for (const s of [-1, 1]) g.add(rod([s * w * .42, 0, .25], [s * w * .2, top, .02], .025, mat('#8a5a32')));
    g.add(rod([0, 0, -.45], [0, top - .05, -.02], .022, mat('#8a5a32'))); U.solid = true; }
  else { U.y0 = o.height ?? 1.45; U.base = h / 2 + fw; }
  U.face = { mesh: face, tex, w, h }; U.screen = tex; U.lw = .007;
  const anim = items.some(it => it.t != null);
  return finish(S, g, 'board', o, anim ? keyed(tex, t => items.map(it => Math.round(kAt(it, t) * 60)).join(','), draw) : null);
};

// ---------- tag + price ----------
DOCS.tag = "text, sub, color (card), textColor, w, h, string: false (no string: a stuck label), length (string, m), tilt (rad), swing (amplitude rad), in (pops + swings from that cue)";
DOCS.price = "value (number) | text, money ('$' default), decimals (2), from + t0 + t1 (the price rolls, lands on value at t1), was (old price) + change: t (the old price is struck and the new one pops ON the cue), label ('SALE'), color, textColor, plus every tag option";
function tagShape(w, h, pointed) {
  const c = h * (pointed ? .5 : .28); const P = pointed ? [[-w / 2, 0], [-w / 2 + c, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2 + c, h / 2]] : [[-w / 2, -h / 2 + c], [-w / 2 + c, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2 + c, h / 2], [-w / 2, h / 2 - c]];
  const s = roundPoly(P, h * .07); const hx = -w / 2 + c * (pointed ? .78 : .75); s.holes.push(circlePath(hx, 0, h * .085)); return { s, hx };
}
function tagCommon(S, o, kind, drawFace, pointed) {
  const w = o.w ?? (kind === 'price' ? .26 : .24), h = o.h ?? (kind === 'price' ? .13 : .12), d = .006, g = new THREE.Group(), U = g.userData;
  const col = o.color ?? (kind === 'price' ? '#f6c945' : '#f2deb0'), bev = .0018;
  const { s, hx } = tagShape(w - 2 * bev, h - 2 * bev, pointed);
  const tex = canvasTex(1024, Math.round(1024 * h / w), (x, W, H) => drawFace(x, W, H, -1e9, col)); tex.repeat.set(1 / (w - 2 * bev), 1 / (h - 2 * bev)); tex.offset.set(.5, .5);
  const card = mesh(splitCaps(extrude(s, d, bev)), [new THREE.MeshStandardMaterial({ map: tex, roughness: .8 }), mat(shade(col, -.2)), mat(shade(col, -.06))], { lw: .0022 });
  const ring = mesh(torusGeo(h * .11, h * .022), mat(shade(col, -.3), { rough: .5 }), { lw: .0012 }); ring.position.set(hx, 0, d / 2); card.add(ring);
  const pivot = new THREE.Group(); g.add(pivot); const tilt = o.tilt ?? -.42, L = o.length ?? .14;
  if (o.string !== false) { const hang = new THREE.Group(); hang.position.set(0, -L, 0); hang.rotation.z = tilt; card.position.set(-hx, 0, 0); hang.add(card); pivot.add(hang);
    pivot.add(rod([0, 0, 0], [0, -L + h * .075, 0], .0022, mat(o.stringColor ?? '#c8b48a'), { lw: .0012 })); U.y0 = 1.4; }
  else { pivot.add(card); U.y0 = 1.2; U.base = h / 2; }
  const t0 = o.in ?? S.t0 ?? 0, amp = o.swing ?? (o.in != null ? .35 : .05);
  const swing = t => { if (o.string === false) return; const a = Math.max(0, t - t0); pivot.rotation.z = amp * Math.exp(-a * 1.8) * Math.sin(a * TAU * 1.3) + .03 * Math.sin(t * 1.7 + 1); };
  U.screen = tex; U.lw = .003;
  return { g, tex, swing, col, w, h };
}
KINDS.tag = (S, o) => {
  const drawFace = (x, W, H, t, col) => { x.fillStyle = col; x.fillRect(0, 0, W, H); grain(x, W, H, 6, .05); const ink = o.textColor ?? INK, X0 = W * .3;
    block(x, o.text ?? 'LABEL', (X0 + W * .97) / 2, H * (o.sub ? .4 : .5), W * .6, H * (o.sub ? .44 : .62), { color: ink, size: H * .5 }); if (o.sub) txt(x, o.sub, (X0 + W * .97) / 2, H * .76, { size: H * .16, weight: 600, color: ink, maxW: W * .6 }); };
  const T = tagCommon(S, o, 'tag', drawFace, false);
  return finish(S, T.g, 'tag', o, T.swing);
};
KINDS.price = (S, o) => {
  const dec = o.decimals ?? 2, nf = v => num(v, { money: o.money ?? '$', decimals: dec, ...o.fmt });
  const bigAt = t => o.text != null ? String(o.text) : o.was != null && o.change != null && t < o.change - CE ? nf(o.was) : nf(rollAt(t, o.from ?? o.value ?? 0, o.value ?? 0, ...span(o.t0, o.t1, .7), { decimals: dec }));
  const drawFace = (x, W, H, t, col) => { x.fillStyle = col; x.fillRect(0, 0, W, H); grain(x, W, H, 6, .05); const ink = o.textColor ?? (o.color ? textOn(o.color) : '#b8261b'), X0 = W * .3, cx = (X0 + W * .96) / 2;
    const struck = o.was != null && (o.change == null || t >= o.change - F);
    if (o.label) txt(x, o.label.toUpperCase(), cx, H * .2, { size: H * .16, color: ink, ls: .1, maxW: W * .6 });
    if (struck) { const k = o.change == null ? 1 : markK(t, o.change, 4 * F); txt(x, nf(o.was), cx, H * (o.label ? .4 : .28), { size: H * .18, weight: 600, color: shade(ink, .2), maxW: W * .5 }); font(x, H * .18, 600); const ww = x.measureText(nf(o.was)).width; x.strokeStyle = '#d6402f'; x.lineWidth = H * .03; x.beginPath(); x.moveTo(cx - ww / 2 - 6, H * (o.label ? .43 : .31)); x.lineTo(cx - ww / 2 - 6 + (ww + 12) * k, H * (o.label ? .37 : .25)); x.stroke(); }
    const pk = o.change != null && t >= o.change - 2 * F ? popK(t, o.change) : 1;
    x.save(); const by = H * (struck || o.label ? .66 : .52); x.translate(cx, by); x.scale(pk, pk); txt(x, bigAt(t), 0, 0, { size: H * .44, color: ink, maxW: W * .64 }); x.restore(); };
  const T = tagCommon(S, o, 'price', drawFace, true);
  const anim = o.t0 != null || o.t1 != null || o.change != null;
  const red = anim ? keyed(T.tex, t => bigAt(t) + '|' + (o.change != null ? Math.round(markK(t, o.change, 4 * F) * 8) + ',' + Math.round(popK(t, o.change) * 20) : ''), (x, W, H, t) => drawFace(x, W, H, t, T.col)) : null;
  return finish(S, T.g, 'price', o, t => { T.swing(t); red?.(t); });
};

// ---------- mapTable ----------
DOCS.mapTable = "w, d (map size m), seed, lands: [[[u, v], ...], ...] (polygons in -1..1, v = north/away) or count (seeded islands), sea, land, beach, dress (trees + mountains), table: false (map board only, origin at its bottom), height (table top), pins: [{ at: [u, v], t (lands ON the cue), color, label }], route: { pts: [[u, v], ...], t0, t1 (dots appear, the last at t1), color, arc (m), dots, marker }, labels: [{ text, at: [u, v], t }], compass";
KINDS.mapTable = (S, o) => {
  const g = new THREE.Group(), U = g.userData, w = o.w ?? (VERT ? 1.4 : 2), d = o.d ?? (VERT ? 1.75 : 1.4), R = rnd(o.seed ?? 9), sc = Math.min(w, d) / 1.4;
  const topY = o.table === false ? .05 : (o.height ?? .82), seaY = topY + .012, hL = .035 * sc;
  // lands (map units: x right, y north, metres)
  let lands = o.lands ? o.lands.map(P => P.map(([u, v]) => [u * w / 2, v * d / 2])) : null;
  if (!lands) { lands = []; const n = o.count ?? 3; for (let i = 0; i < n; i++) { const r = (i ? .16 + R() * .1 : .3) * Math.min(w, d) * .9; const cx = (R() - .5) * (w - 2.4 * r), cy = (R() - .5) * (d - 2.4 * r); lands.push(blob((o.seed ?? 9) * 31 + i, cx, cy, r, 1.25 + R() * .4, .8)); } }
  lands = lands.map(P => P.map(([x, y]) => [clamp(x, -w / 2 + .05, w / 2 - .05), clamp(y, -d / 2 + .05, d / 2 - .05)]));
  const onLand = (x, y) => lands.some(P => inPoly([x, y], P));
  const surf = (x, y) => onLand(x, y) ? seaY + hL : seaY + .002;
  // sea with shallow halos round the coasts
  const seaC = o.sea ?? '#4f9be0', seaT = texFor(w, d, (x, W, H) => { const k = W / w, tx = X => (X + w / 2) * k, ty = Y => (d / 2 - Y) * k;
    x.fillStyle = seaC; x.fillRect(0, 0, W, H); x.save(); x.filter = `blur(${Math.round(W * .02)}px)`; x.fillStyle = mixHex(seaC, '#bfe8ff', .45); for (const P of lands) { x.beginPath(); P.forEach(([a, b], i) => i ? x.lineTo(tx(a), ty(b)) : x.moveTo(tx(a), ty(b))); x.closePath(); x.lineWidth = W * .05; x.strokeStyle = x.fillStyle; x.stroke(); x.fill(); } x.restore();
    x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = Math.max(1, W * .0015); for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(i * W / 8, 0); x.lineTo(i * W / 8, H); x.stroke(); } for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(0, i * H / 6); x.lineTo(W, i * H / 6); x.stroke(); }
    const RR = rnd(4); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = Math.max(2, W * .003); x.lineCap = 'round'; for (let i = 0; i < 60; i++) { const X = RR() * W, Y = RR() * H; if (onLand(X / k - w / 2, d / 2 - Y / k)) continue; x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + W * .012, Y - W * .008, X + W * .024, Y); x.stroke(); }
    if (o.compass !== false) { const cx = W * .9, cy = H * .17, r = H * .09; x.save(); x.translate(cx, cy); x.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 4; i++) { x.rotate(PI / 2); x.beginPath(); x.moveTo(0, -r); x.lineTo(r * .18, 0); x.lineTo(-r * .18, 0); x.closePath(); x.fill(); } x.restore(); txt(x, 'N', cx, cy - r * 1.35, { size: r * .45, color: '#fff' }); }
  }, { ppm: 1000 });
  const sea = plane(w, d, paperMat(seaT, { rough: .5 })); sea.rotation.x = -PI / 2; sea.position.y = seaY; g.add(sea);
  const landC = o.land ?? '#8cc152', beach = o.beach ?? '#ecd59b';
  for (const P of lands) { const shp = new THREE.Shape(P.map(([a, b]) => new THREE.Vector2(a, b)));
    const m = mesh(splitCaps(extrude(shp, hL, hL * .4, 2, 4)), [mat(landC), mat(beach), mat(beach)], { lw: .003 }); m.rotation.x = -PI / 2; m.position.y = seaY + hL / 2 - .001; g.add(m); }
  // dressing: mountains + trees on the land
  if (o.dress !== false) { const mtnG = lathe([[.05, 0], [.036, .03], [.013, .066], [0, .08]], 18, 3), snowG = lathe([[.018, .055], [.009, .072], [0, .083]], 18, 2), treeG = lathe([[.02, 0], [.014, .022], [.005, .045], [0, .05]], 12, 2);
    const placed = [];
    for (const P of lands) { const xs = P.map(p => p[0]), ys = P.map(p => p[1]), bx = [Math.min(...xs), Math.max(...xs)], by = [Math.min(...ys), Math.max(...ys)], n = Math.round(Math.abs(area(P)) * 34 / sc ** 2 * (o.density ?? 1));
      for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) { const x = lerp(bx[0], bx[1], R()), y = lerp(by[0], by[1], R()), e = .045 * sc; if (!inPoly([x, y], P) || !inPoly([x + e, y], P) || !inPoly([x - e, y], P) || !inPoly([x, y + e], P) || !inPoly([x, y - e], P)) continue;
        if (placed.some(([a, b]) => Math.hypot(a - x, b - y) < .07 * sc)) continue; if ((o.pins || []).some(pp => Math.hypot(pp.at[0] * w / 2 - x, pp.at[1] * d / 2 - y) < .1 * sc)) continue; placed.push([x, y]); i++;
        const mtn = R() < .3, s = sc * (.75 + R() * .5), grp = new THREE.Group(); grp.position.set(x, seaY + hL, -y); grp.scale.setScalar(s);
        if (mtn) { grp.add(mesh(mtnG, mat('#a08a6a'), { lw: .003 })); grp.add(mesh(snowG, mat('#f6f8fa'), { noOutline: true })); }
        else { grp.add(mesh(treeG, mat(R() < .5 ? '#3f9a3a' : '#4fae46'), { lw: .0025 })); }
        g.add(grp); } } }
  // table
  if (o.table !== false) { const tw = w + .2, td = d + .2, wood = o.wood ?? '#8a5a32';
    g.add(box(tw, .06, td, .02, wood, { p: [0, topY - .03, 0] }));
    for (const [x0, z0, ww, dd2] of [[0, -d / 2 - .045, tw, .09], [0, d / 2 + .045, tw, .09], [-w / 2 - .045, 0, .09, d], [w / 2 + .045, 0, .09, d]]) g.add(box(ww, .05, dd2, .015, shade(wood, -.18), { p: [x0, topY + .02, z0] }));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(.08, topY - .06, .08, .02, shade(wood, -.25), { p: [sx * (tw / 2 - .1), (topY - .06) / 2, sz * (td / 2 - .1)] }));
    U.solid = true; U.top = topY + .07; }
  else g.add(box(w + .06, .05, d + .06, .015, o.wood ?? '#8a5a32', { p: [0, .025, 0] }));
  const W2 = ([u, v]) => [u * w / 2, v * d / 2];
  // pins: drop ON the cue
  const pinG = lathe([[0, 0], [.008, .03], [.022, .07], [.03, .095], [.026, .115], [.014, .127], [0, .13]], 20, 3);
  const pins = (o.pins || []).map((p, i) => { const [x, y] = W2(p.at), gp = new THREE.Group(); gp.add(mesh(pinG, mat(p.color ?? C.red, { rough: .35 }), { lw: .003 }), ball(.012, mat('#ffffff'), { p: [0, .108, .022], noOutline: true }));
    gp.position.set(x, surf(x, y), -y); gp.scale.setScalar(sc * (p.size ?? 1)); g.add(gp);
    let lab = null; if (p.label) { lab = mapLabel(p.label, sc); lab.position.set(x, surf(x, y) + .16 * sc, -y); g.add(lab); }
    sfx(S, o, p.t, 'pop', -10); return { p, gp, lab, y0: gp.position.y, s: gp.scale.x, i }; });
  const labels = (o.labels || []).map(l => { const [x, y] = W2(l.at), m = mapLabel(l.text, sc, true); m.position.set(x, surf(x, y), -y); g.add(m); return { l, m }; });
  // route: dots appear along a curve, the last at t1; a marker rides the head
  let route = null;
  if (o.route) { const r = o.route, pts = r.pts.map(W2), lift = .012 * sc, arc = r.arc ?? 0;
    const P3 = pts.map(([x, y]) => new THREE.Vector3(x, surf(x, y) + lift, -y)); const curve = new THREE.CatmullRomCurve3(P3, false, 'centripetal');
    const len = curve.getLength(), n = r.dots ?? Math.max(6, Math.round(len / (.045 * sc))), dots = [];
    for (let i = 0; i < n; i++) { const u = i / (n - 1), p = curve.getPointAt(u); p.y = Math.max(p.y, surf(p.x, -p.z) + lift) + arc * Math.sin(PI * u); const m = mesh(sphereGeo(.011), mat(r.color ?? '#ffffff', { rough: .4 }), { lw: .0018 }); m.position.copy(p); m.scale.set(sc, sc * .6, sc); g.add(m); dots.push({ m, u }); }
    const mk = r.marker === false ? null : ball(.022, mat(r.color ?? C.red, { emissive: r.color ?? C.red, ei: .25 }), { lw: .002 }); if (mk) { mk.scale.setScalar(sc); g.add(mk); }
    route = { r, dots, mk, curve, n }; }
  U.lw = .006;
  const upd = t => {
    for (const P of pins) { const T = P.p.t; if (T == null) { P.gp.visible = true; if (P.lab) P.lab.visible = true; continue; } const a = T - 6 * F; P.gp.visible = t >= a; if (P.lab) { P.lab.visible = t >= T; P.lab.scale.setScalar(popK(t, T + 2 * F)); }
      if (!P.gp.visible) continue; const fall = E.inQuad(seg(t, a, T)), sq = t < T ? 1 : 1 - .28 * Math.sin(PI * seg(t, T, T + 5 * F)); P.gp.position.y = P.y0 + (1 - fall) * .35 * sc; P.gp.scale.set(P.s * (2 - sq), P.s * sq, P.s * (2 - sq)); }
    for (const L of labels) { L.m.visible = L.l.t == null || t >= L.l.t - 2 * F; if (L.l.t != null) L.m.scale.setScalar(popK(t, L.l.t)); }
    if (route) { const { r, dots, mk, curve } = route; if (r.t0 == null) return; const t1 = r.t1 ?? r.t0 + 1.5;
      for (const D of dots) { const T = r.t0 + (t1 - r.t0) * D.u; D.m.visible = t >= T - F; const k = clamp((t - T + F) / (3 * F)); D.m.scale.set(sc * k, sc * .6 * k, sc * k); }
      if (mk) { mk.visible = t >= r.t0 && (r.keepMarker || t < t1 + 4 * F); const k = seg(t, r.t0, t1), p = curve.getPointAt(k); mk.position.copy(p); mk.position.y += .025 * sc + (r.arc ?? 0) * Math.sin(PI * k); } }
  };
  return finish(S, g, 'mapTable', o, upd);
};
function mapLabel(text, sc = 1, stick = false) {
  font(MC, 100); const tw = MC.measureText(text).width, W = Math.round(tw + 70), H = 150;
  const tex = canvasTex(W, H, (x) => { x.fillStyle = '#fffaf0'; rrPath(x, 4, 4, W - 8, H - 8, 26); x.fill(); x.lineWidth = 8; x.strokeStyle = INK; x.stroke(); txt(x, text, W / 2, H / 2 + 4, { size: 100, color: INK }); }, { mip: true });
  const g = new THREE.Group(), ch = .06 * sc, cw = ch * W / H; const card = plane(cw, ch, paperMat(tex, { transparent: true, alphaTest: .3 })); card.position.y = stick ? .09 * sc : 0; g.add(card);
  if (stick) g.add(rod([0, 0, 0], [0, .06 * sc, 0], .003 * sc, mat('#6e4325'), { lw: .0015 }));
  return g;
}

// ---------- globe ----------
DOCS.globe = "r, seed, spin (deg/s), stand: false (floating planet, origin at its centre), tilt (deg), pin: { lat, lon, t (pops ON the cue), color, label }, face: { lat, lon, t0, t1 } (turns so that place faces front, LANDS at t1; defaults to the pin), clouds, colors: { sea, land, high, ice }";
const GLOBES = new Map();
function globeTex(seed, col = {}) {
  const key = seed + JSON.stringify(col); if (GLOBES.has(key)) return GLOBES.get(key);
  const W = 1024, H = 512, sea = new THREE.Color(col.sea ?? '#2f74c0'), shallow = new THREE.Color(col.shallow ?? '#58a6e6'), land = new THREE.Color(col.land ?? '#8cc152'), land2 = new THREE.Color(col.land2 ?? '#6aa84f'), high = new THREE.Color(col.high ?? '#c9b27a'), ice = new THREE.Color(col.ice ?? '#f2f6fa');
  const t = canvasTex(W, H, (x) => { const img = x.createImageData(W, H), D = img.data, hgt = new Float32Array(W * H);
    for (let j = 0; j < H; j++) { const lat = PI / 2 - (j + .5) / H * PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (let i = 0; i < W; i++) { const lon = (i + .5) / W * TAU; hgt[j * W + i] = fbm3(Math.cos(lon) * cl * 1.6 + 5, sl * 1.6 + 5, Math.sin(lon) * cl * 1.6 + 5, seed); } }
    const th = .52;
    for (let j = 0; j < H; j++) { const lat = 90 - (j + .5) / H * 180; for (let i = 0; i < W; i++) { const k = j * W + i, h = hgt[k]; let c;
      const iceK = Math.abs(lat) + (h - .5) * 30 > 74;
      if (iceK) c = ice; else if (h < th) c = h > th - .035 ? shallow : sea; else c = h > th + .12 ? high : h > th + .05 ? land2 : land;
      let r = c.r, g2 = c.g, b = c.b;
      if (!iceK) { const n = h >= th, nb = [k - 1, k + 1, k - W, k + W].some(q => q >= 0 && q < W * H && (hgt[q] >= th) !== n); if (nb) { r *= .35; g2 *= .35; b *= .35; } }
      D[k * 4] = Math.round(Math.pow(r, 1 / 2.2) * 255); D[k * 4 + 1] = Math.round(Math.pow(g2, 1 / 2.2) * 255); D[k * 4 + 2] = Math.round(Math.pow(b, 1 / 2.2) * 255); D[k * 4 + 3] = 255; } }
    x.putImageData(img, 0, 0); x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1.5; for (let i = 1; i < 12; i++) { x.beginPath(); x.moveTo(i * W / 12, 0); x.lineTo(i * W / 12, H); x.stroke(); } for (let j = 1; j < 6; j++) { x.beginPath(); x.moveTo(0, j * H / 6); x.lineTo(W, j * H / 6); x.stroke(); } });
  GLOBES.set(key, t); return t;
}
const latLon = (lat, lon, r) => { const ph = (lon + 180) / 360 * TAU, th = (90 - lat) / 180 * PI; return new THREE.Vector3(-r * Math.cos(ph) * Math.sin(th), r * Math.cos(th), r * Math.sin(ph) * Math.sin(th)); };
KINDS.globe = (S, o) => {
  const g = new THREE.Group(), U = g.userData, stand = o.stand !== false, r = o.r ?? (stand ? .17 : .3);
  const tilt = new THREE.Group(), spin = new THREE.Group(); tilt.add(spin); g.add(tilt);
  const sph = mesh(shared(`gsph${f4(r)}`, () => new THREE.SphereGeometry(r, 64, 48)), new THREE.MeshStandardMaterial({ map: globeTex(o.seed ?? 3, o.colors), roughness: .55 }), { lw: .005 }); spin.add(sph);
  if (o.clouds) { const ct = canvasTex(512, 256, (x, W, H) => { x.clearRect(0, 0, W, H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i += 2) { const lat = PI / 2 - j / H * PI, lon = i / W * TAU, n = fbm3(Math.cos(lon) * Math.cos(lat) * 2.5, Math.sin(lat) * 2.5, Math.sin(lon) * Math.cos(lat) * 2.5, (o.seed ?? 3) + 50); const a = smoothstep(.55, .7, n); if (a > 0) { x.fillStyle = `rgba(255,255,255,${a * .85})`; x.fillRect(i, j, 2, 1); } } });
    spin.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.025, 48, 32), new THREE.MeshStandardMaterial({ map: ct, transparent: true, depthWrite: false, roughness: 1 }))); }
  let pin = null; if (o.pin) { const p = o.pin, gp = new THREE.Group(), pos = latLon(p.lat ?? 0, p.lon ?? 0, r); gp.position.copy(pos); gp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
    gp.add(rod([0, 0, 0], [0, r * .28, 0], r * .018, mat('#d9d9d9', { metal: .4 }), { lw: .002 }), ball(r * .09, mat(p.color ?? C.red, { rough: .35, emissive: p.color ?? C.red, ei: .2 }), { p: [0, r * .34, 0], lw: .003 })); spin.add(gp);
    let lab = null; if (p.label) { lab = mapLabel(p.label, r / .26 * 1.4); g.add(lab); } pin = { p, gp, lab, pos }; }
  const tiltDeg = o.tilt ?? 23.5; tilt.rotation.z = -tiltDeg * PI / 180;
  if (stand) { const H0 = r * 1.35; tilt.position.y = H0 + r; const brass = mat(o.metal ?? '#d9a441', { metal: .6, rough: .35 });
    g.add(mesh(discGeo(r * .62, r * .14, r * .05), mat(o.wood ?? '#7a4a2a'), { p: [0, r * .07, 0] }));
    g.add(rod([0, r * .12, 0], [0, H0 - r * .12, 0], r * .05, brass));
    const ring = mesh(torusGeo(r * 1.09, r * .028, PI * 1.25), brass, { lw: .003 }); ring.rotation.z = PI - PI * .625; tilt.add(ring);
    for (const s of [-1, 1]) tilt.add(ball(r * .045, brass, { p: [0, s * r * 1.09, 0], lw: .002 }));
    U.solid = true; }
  else { U.y0 = 1.2; U.base = r; }
  const rate = (o.spin ?? 20) * PI / 180, ph0 = o.phase ?? 0, T0 = S.t0 ?? 0;
  const fc = o.face ?? (o.pin && o.pin.t1 != null ? { lat: o.pin.lat, lon: o.pin.lon, t0: o.pin.t0 ?? o.pin.t1 - 1, t1: o.pin.t1 } : null);
  const angAt = t => { const a0 = ph0 + rate * (t - T0); if (!fc) return a0; const ph = ((fc.lon ?? 0) + 180) / 360 * TAU, tgt0 = -Math.atan2(-Math.cos(ph), Math.sin(ph)), A0 = ph0 + rate * (fc.t0 - T0);
    let tgt = tgt0 + TAU * Math.ceil((A0 - tgt0) / TAU); if (tgt - A0 < PI * .4) tgt += TAU; if (t <= fc.t0) return a0; if (t >= fc.t1) return tgt; return A0 + (tgt - A0) * E.outCubic(seg(t, fc.t0, fc.t1)); };
  U.lw = .005;
  const upd = t => { spin.rotation.y = angAt(t); if (pin) { const T = pin.p.t; const k = T == null ? 1 : popK(t, T); pin.gp.scale.setScalar(Math.max(1e-3, k)); pin.gp.visible = k > 1e-3;
      if (pin.lab) { g.updateMatrixWorld(true); const wp = pin.gp.localToWorld(new THREE.Vector3(0, r * .34, 0)); g.worldToLocal(wp); wp.y += r * .34; pin.lab.position.copy(wp); pin.lab.visible = k > .5; faceCam(pin.lab, S, t); } } };
  return finish(S, g, 'globe', o, upd);
};

// ---------- satellite ----------
DOCS.satellite = "w, d (plane size m; 9:16 by default), upright (stands facing +z like a giant screen, origin at its centre; default: lies flat on the ground), y, seed, day (day colours; default night), islands: [[u, v, rx, ry], ...], source ('SATELLITE · LIVE'), label (string | [[t, text], ...]), you: [u, v] | false (u, v in -1..1, v = up the frame), youText, rings, sweep (deg/s or false), clouds (drift), alert: { text, t (pops ON the cue), color }, storm: { at: [u, v], r, t }, coords (bottom line). Flat: view it from above with a slight tilt, p: [x, h, z + h * .3], l: [x, 0, z] (a camera straight down rolls with the drift); upright: frame it like a wall";
function islandField(seed, Wl, Hl, aspect, isl) {
  const hgt = new Float32Array(Wl * Hl);
  for (let j = 0; j < Hl; j++) for (let i = 0; i < Wl; i++) { const u = i / Wl * 2 - 1, v = 1 - j / Hl * 2; let fall = 0;
    for (const [cx, cy, rx, ry] of isl) { const dd = Math.hypot((u - cx) / rx, (v - cy) * aspect / ry); fall = Math.max(fall, 1 - dd); }
    hgt[j * Wl + i] = fbm2(u * 3.2 + 7, v * aspect * 3.2 + 3, seed) * .55 + fall * .8; }
  return hgt;
}
KINDS.satellite = (S, o) => {
  const g = new THREE.Group(), U = g.userData, w = o.w ?? 3, d = o.d ?? w * 16 / 9, seed = o.seed ?? 5, day = !!o.day, aspect = d / w;
  const PW = 1024, PH = Math.round(PW * aspect), Wl = 256, Hl = Math.round(Wl * aspect), R = rnd(seed);
  const isl = o.islands ?? [[(R() - .5) * .2, -.04, 1.15, .36], [(R() - .5) * 1.2, .55 + R() * .2, .3, .14]];
  const hgt = islandField(seed, Wl, Hl, aspect, isl), th = .64;
  const pal = day ? { sea: '#1d5fae', deep: '#164a8e', shallow: '#48a6dc', land: '#5f8f4a', forest: '#2f6a34', coast: '#e3cf92' } : { sea: '#0d2f78', deep: '#0a2260', shallow: '#2a68b5', land: '#4a6474', forest: '#1d4030', coast: '#6aaed0' };
  const baseT = canvasTex(PW, PH, (x, W, H) => {
    // the height field is coarse (noise is costly); it is sampled bilinearly at full size so coasts stay smooth
    const fr = new Float32Array(Wl * Hl); for (let k = 0; k < Wl * Hl; k++) fr[k] = fbm2((k % Wl) / Wl * 7, Math.floor(k / Wl) / Hl * 7 * aspect, seed + 4);
    const bil = (A, X, Y) => { const i = clamp(Math.floor(X), 0, Wl - 2), j = clamp(Math.floor(Y), 0, Hl - 2), fx = clamp(X - i, 0, 1), fy = clamp(Y - j, 0, 1), k = j * Wl + i; return lerp(lerp(A[k], A[k + 1], fx), lerp(A[k + Wl], A[k + Wl + 1], fx), fy); };
    const img = x.createImageData(W, H), D = img.data, srgb = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b].map(v => Math.round(Math.pow(v, 1 / 2.2) * 255)); };
    const P = Object.fromEntries(Object.keys(pal).map(k => [k, srgb(pal[k])])), mixc = (a, b, k) => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * k);
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) { const gx = X / W * Wl, gy = Y / H * Hl, h = bil(hgt, gx, gy); let col;
      if (h < th - .1) col = mixc(P.deep, P.sea, clamp((h - .3) / .4)); else if (h < th) col = mixc(P.sea, P.shallow, (h - th + .1) / .1); else if (h < th + .018) col = P.coast; else col = bil(fr, gx, gy) > .46 ? P.forest : P.land;
      const k = (Y * W + X) * 4; D[k] = col[0]; D[k + 1] = col[1]; D[k + 2] = col[2]; D[k + 3] = 255; }
    x.putImageData(img, 0, 0);
    grain(x, W, H, seed, .08, 9000, '#000'); grain(x, W, H, seed + 1, .05, 5000, '#fff');
    const v = x.createRadialGradient(W / 2, H / 2, W * .35, W / 2, H / 2, H * .7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,10,.45)'); x.fillStyle = v; x.fillRect(0, 0, W, H); });
  const layer = (tex, y, k = 1, o2 = {}) => { const p = plane(w, d, glowMat(tex, k, { transparent: o2.transparent, add: o2.add }), { unlit: true }); p.rotation.x = -PI / 2; p.position.y = y; p.renderOrder = o2.order ?? 0; g.add(p); return p; };
  layer(baseT, 0, day ? 1 : .95);
  const toPx = ([u, v]) => [(u + 1) / 2 * PW, (1 - v) / 2 * PH], toW = ([u, v], y) => new THREE.Vector3(u * w / 2, y, -v * d / 2);
  const you = o.you === false ? null : (o.you ?? [-.15, .02]);
  // storm radar
  let storm = null; if (o.storm) { const st = o.storm, [sx0, sy0] = toPx(st.at ?? [.3, -.35]), rr = (st.r ?? .5) * PW;
    const tex = canvasTex(PW, PH, (x, W, H) => { x.clearRect(0, 0, W, H); const sm = document.createElement('canvas'), q = 4; sm.width = W / q; sm.height = H / q; const sx = sm.getContext('2d'), img = sx.createImageData(sm.width, sm.height), D = img.data;
      const ramp = ['#2fd04a', '#9be33a', '#f6e04a', '#f6a23a', '#e8452f', '#d23ad0'].map(h => new THREE.Color(h));
      for (let j = 0; j < sm.height; j++) for (let i = 0; i < sm.width; i++) { const X = i * q, Y = j * q, dd = Math.hypot(X - sx0, (Y - sy0) * .8) / rr, n = fbm2(X / W * 5, Y / H * 5, seed + 9) - dd * .55; if (n < .25) continue; const kk = clamp((n - .25) / .45), c2 = ramp[Math.min(5, Math.floor(kk * 6))], idx = (j * sm.width + i) * 4;
        D[idx] = Math.round(Math.pow(c2.r, 1 / 2.2) * 255); D[idx + 1] = Math.round(Math.pow(c2.g, 1 / 2.2) * 255); D[idx + 2] = Math.round(Math.pow(c2.b, 1 / 2.2) * 255); D[idx + 3] = Math.round(170 + kk * 70); }
      sx.putImageData(img, 0, 0); x.filter = 'blur(3px)'; x.drawImage(sm, 0, 0, W, H); x.filter = 'none'; });
    const p = layer(tex, .004 * w, 1.1, { transparent: true, order: 1 }); storm = { p, st }; }
  // HUD: brackets, source, label, rings round YOU, scale bar, coords
  const labAt = t => Array.isArray(o.label) ? (() => { let s = o.label[0][1]; for (const [tt, ss] of o.label) if (t >= tt - CE) s = ss; return s; })() : (o.label ?? 'NIGHT 1 · 9:42 PM');
  const drawHud = (x, W, H, t) => { x.clearRect(0, 0, W, H); const u = W / 100; x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = u * .45; x.lineCap = 'round';
    for (const [cx, cy, sx, sy] of [[u * 4, u * 4, 1, 1], [W - u * 4, u * 4, -1, 1], [u * 4, H - u * 4, 1, -1], [W - u * 4, H - u * 4, -1, -1]]) { x.beginPath(); x.moveTo(cx, cy + sy * u * 7); x.lineTo(cx, cy); x.lineTo(cx + sx * u * 7, cy); x.stroke(); }
    txt(x, o.source ?? 'SATELLITE · LIVE', W / 2, H * .045, { size: u * 3.6, color: '#5fe0c8', ls: .08, weight: 800 });
    txt(x, labAt(t), W / 2, H * .085, { size: u * 7, color: '#ffffff', maxW: W * .86, shadow: 'rgba(0,0,0,.45)' });
    x.fillStyle = 'rgba(255,255,255,.8)'; x.fillRect(u * 7, H - u * 9, u * 14, u * .5); txt(x, o.scale ?? '10 km', u * 14, H - u * 11, { size: u * 2.6, color: '#fff', weight: 600 });
    txt(x, o.coords ?? '18.21° N   66.37° W', W - u * 7, H - u * 9.5, { size: u * 2.6, color: 'rgba(255,255,255,.85)', align: 'right', weight: 600 }); };
  // the HUD text floats above the clouds; the range rings stay on the map round YOU
  const hudT = canvasTex(PW, PH, (x, W, H) => drawHud(x, W, H, S.t0 ?? 0)); layer(hudT, .065 * w, 1.25, { transparent: true, order: 8 });
  if (you && o.rings !== false) { const rt = canvasTex(PW, PH, (x, W, H) => { x.clearRect(0, 0, W, H); const [X, Y] = toPx(you); x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = Math.max(1.5, W * .002); for (let i = 1; i <= 5; i++) { x.beginPath(); x.arc(X, Y, i * W * .12, 0, TAU); x.stroke(); } }); layer(rt, .008 * w, 1.2, { transparent: true, order: 2 }); }
  // sweep
  let sweep = null; if (you && o.sweep !== false) { const Rs = Math.min(w, d) * .5, st = canvasTex(512, 512, (x, W, H) => { x.clearRect(0, 0, W, H); x.save(); x.beginPath(); x.arc(W / 2, H / 2, W / 2, 0, TAU); x.clip(); const cg = x.createConicGradient(0, W / 2, H / 2); cg.addColorStop(0, 'rgba(120,255,220,.28)'); cg.addColorStop(.02, 'rgba(120,255,220,.09)'); cg.addColorStop(.12, 'rgba(120,255,220,0)'); cg.addColorStop(1, 'rgba(120,255,220,0)'); x.fillStyle = cg; x.fillRect(0, 0, W, H);
      const rg = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(.85, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = rg; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; x.restore();
      const lg = x.createLinearGradient(W / 2, 0, W, 0); lg.addColorStop(0, 'rgba(220,255,245,.9)'); lg.addColorStop(1, 'rgba(220,255,245,0)'); x.strokeStyle = lg; x.lineWidth = 2.5; x.beginPath(); x.moveTo(W / 2, H / 2); x.lineTo(W, H / 2); x.stroke(); });
    const sp = plane(Rs * 2, Rs * 2, glowMat(st, 1.2, { transparent: true, add: true }), { unlit: true }); sp.rotation.x = -PI / 2; sp.renderOrder = 3; const sg = new THREE.Group(); sg.add(sp); sg.position.copy(toW(you, .012 * w)); g.add(sg); sweep = sg; }
  // YOU pin
  let pin = null; if (you) { const pg = new THREE.Group(), pr = w * .012; pg.position.copy(toW(you, .016 * w));
    const lift = w * .0015, flat = (geo, m2, k = 0, ro = 4) => { const m = new THREE.Mesh(geo, m2); m.rotation.x = -PI / 2; m.position.y = k * lift; m.userData.noOutline = true; m.renderOrder = ro; return m; };
    pg.add(flat(new THREE.RingGeometry(pr * 1.35, pr * 1.9, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, depthWrite: false, toneMapped: false }), 0, 4), flat(new THREE.CircleGeometry(pr * 1.35, 40), new THREE.MeshBasicMaterial({ color: '#1b2a4a', toneMapped: false }), 1, 4));
    const dot = flat(new THREE.CircleGeometry(pr, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b3b').multiplyScalar(1.6), toneMapped: false }), 2, 5); pg.add(dot);
    const pulse = flat(new THREE.RingGeometry(pr * 1.8, pr * 2.2, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, toneMapped: false }), 3, 6); pg.add(pulse);
    font(MC, 100); const ytxt = o.youText ?? 'YOU', tw = MC.measureText(ytxt).width; const yt = canvasTex(Math.round(tw + 40), 140, (x, W, H) => { x.clearRect(0, 0, W, H); txt(x, ytxt, W / 2, H / 2, { size: 100, color: '#fff', shadow: 'rgba(0,0,0,.6)' }); });
    const lp = flat(new THREE.PlaneGeometry(pr * 3 * (tw + 40) / 140, pr * 3), glowMat(yt, 1.3, { transparent: true })); lp.position.set(pr * 2.6 + pr * 1.5 * (tw + 40) / 140, lift * 3, -pr * 1.7); lp.renderOrder = 6; pg.add(lp); g.add(pg); pin = { pulse }; }
  // alert pill
  let alert = null; if (o.alert) { const a = o.alert, txt2 = a.text ?? 'SEVERE STORM'; font(MC, 100); const tw = MC.measureText(txt2).width, AW = Math.round(tw + 300), AH = 190;
    const at = canvasTex(AW, AH, (x, W, H) => { x.clearRect(0, 0, W, H); x.fillStyle = a.color ?? '#e8253a'; rrPath(x, 6, 6, W - 12, H - 12, (H - 12) / 2); x.fill(); x.fillStyle = '#ffd23a'; x.beginPath(); x.moveTo(110, 48); x.lineTo(150, 142); x.lineTo(70, 142); x.closePath(); x.lineJoin = 'round'; x.strokeStyle = '#ffd23a'; x.lineWidth = 10; x.stroke(); x.fill(); txt(x, '!', 110, 112, { size: 64, color: '#7a1010' }); txt(x, txt2, 190 + tw / 2, H / 2 + 3, { size: 100, color: '#ffffff' }); });
    const ww = w * .74, hh = ww * AH / AW, ap = plane(ww, hh, glowMat(at, 1.15, { transparent: true }), { unlit: true }); ap.rotation.x = -PI / 2; ap.renderOrder = 9; const ag = new THREE.Group(); ag.add(ap); ag.position.copy(toW(a.at ?? [0, -.62], .07 * w)); g.add(ag); alert = { ag, a }; }
  // clouds drifting above
  // clouds: noise sampled round a cylinder so the layer tiles left-right and can drift forever
  let clouds = null; if (o.clouds !== false) { const ct = canvasTex(384, Math.round(384 * aspect), (x, W, H) => { x.clearRect(0, 0, W, H); const img = x.createImageData(W, H), D = img.data, R1 = 4 / TAU;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const a = i / W * TAU, n = fbm3(Math.cos(a) * R1 + 11, Math.sin(a) * R1 + 3, j / H * 4 * aspect + 2, seed + 21), al = smoothstep(.56, .78, n); if (al <= 0) continue; const k = (j * W + i) * 4, sh2 = 200 + 55 * smoothstep(.6, .85, n); D[k] = sh2; D[k + 1] = sh2; D[k + 2] = Math.min(255, sh2 + 12); D[k + 3] = Math.round(al * 230); }
      x.putImageData(img, 0, 0); });
    ct.wrapS = THREE.RepeatWrapping; ct.wrapT = THREE.ClampToEdgeWrapping; const cp = layer(ct, .05 * w, day ? 1 : .8, { transparent: true, order: 6 }); clouds = { cp, ct }; }
  const root = new THREE.Group(); root.add(g);
  if (o.upright) { g.rotation.x = PI / 2; root.userData.y0 = d / 2 + .02; root.userData.base = d / 2; } else { root.userData.y0 = .01; root.userData.top = .03 * w; }
  root.userData.lw = .002; void U;
  const sweepRate = (typeof o.sweep === 'number' ? o.sweep : 160) * PI / 180, drift = o.drift ?? .012;
  const hudUp = Array.isArray(o.label) ? keyed(hudT, labAt, drawHud) : null;
  const upd = t => { hudUp?.(t);
    if (sweep) sweep.rotation.y = -sweepRate * t;
    if (pin) { const ph = ((t * 1.0) % 1.2) / 1.2; pin.pulse.scale.setScalar(1 + ph * 2.2); pin.pulse.material.opacity = .8 * (1 - ph); }
    if (alert) { const k = alert.a.t == null ? 1 : popK(t, alert.a.t); alert.ag.visible = k > 1e-3; alert.ag.scale.setScalar(Math.max(1e-3, k)); }
    if (storm) { const k = storm.st.t == null ? 1 : seg(t, storm.st.t - 2 * F, storm.st.t + 10 * F); storm.p.visible = k > 0; storm.p.material.opacity = k; storm.p.material.color.setScalar(1.1); }
    if (clouds) clouds.ct.offset.set(drift * (t - (S.t0 ?? 0)), 0); };
  return finish(S, root, 'satellite', o, upd);
};

// ---------- bars ----------
DOCS.bars = "values: [n, ...] (items per bar, or a value with per), per (value per item), labels: [...], item 'block'|'coin'|'check'|'cash'|'book'|'box'|'solid', colors, cues: [t, ...] (each bar's LAST item lands ON its cue) | t0 + stagger, step (frames between items, 2), mode 'drop'|'pop'|'grow' (solid bars rise and land at the cue), unit (item height), gap, ledge: false, labelColor, showValues, valueFmt (num options), highlight: { bar, t } (that bar glows ON the cue)";
function itemOf(type, col, i, R) {
  const g = new THREE.Group();
  if (type === 'coin') g.add(mesh(discGeo(.05, .018, .006), mat(col ?? '#e9b44c', { metal: .35, rough: .35 }), { lw: .002 }));
  else if (type === 'check') { g.add(box(.2, .026, .09, .004, col ?? '#e6f0dc', { lw: .0018 })); for (const yy of [-.006, .006]) g.add(box(.201, .0015, .091, .0006, '#b9cdb0', { p: [0, yy, 0], noOutline: true })); }
  else if (type === 'cash') { g.add(box(.17, .022, .08, .004, col ?? '#8fc47a', { lw: .002 })); g.add(box(.04, .024, .082, .003, '#f2e6c4', { noOutline: true })); }
  else if (type === 'book') g.add(box(.18, .05, .13, .006, col ?? ['#d6402f', '#3f6fd1', '#5fae4a', '#f6c945'][i % 4], { lw: .002 }));
  else if (type === 'box') g.add(box(.18, .14, .16, .01, col ?? '#c99a5e', { lw: .003 }));
  else g.add(box(.16, .1, .16, .018, col ?? '#3f6fd1', { lw: .003 }));
  if (type !== 'block' && type !== 'box') g.rotation.y = (R() - .5) * .25;
  return g;
}
const ITEM_H = { coin: .018, check: .026, cash: .022, book: .05, box: .14, block: .1 };
KINDS.bars = (S, o) => {
  const g = new THREE.Group(), U = g.userData, R = rnd(o.seed ?? 4), type = o.item ?? 'block', mode = o.mode ?? (type === 'solid' ? 'grow' : 'drop');
  const vals = (o.values ?? [3, 5, 8, 6]).map(v => o.per ? Math.max(0, Math.round(v / o.per)) : v), n = vals.length;
  const iw = { coin: .1, check: .2, cash: .17, book: .18, box: .18, block: .16, solid: .16 }[type] ?? .16, gap = o.gap ?? iw * .45, pitch = iw + gap, W = n * pitch;
  const unit = o.unit ?? ITEM_H[type] ?? .1, ledgeH = o.ledge === false ? 0 : .09;
  const cues = o.cues ?? (o.t0 != null ? vals.map((_, i) => o.t0 + i * (o.stagger ?? .5)) : null), step = (o.step ?? 2) * F, cols = o.colors;
  if (o.ledge !== false) { const lc = o.ledgeColor ?? '#e7cfa3', lt = texFor(W + .1, ledgeH * .8, (x, Wp, Hp) => { x.fillStyle = lc; x.fillRect(0, 0, Wp, Hp); grain(x, Wp, Hp, 3, .06);
      (o.labels ?? vals.map((_, i) => String(i + 1))).forEach((l, i) => txt(x, l, (.05 + (i + .5) * pitch) / (W + .1) * Wp, Hp / 2, { size: Hp * .7, color: o.labelColor ?? '#c8261b', maxW: pitch / (W + .1) * Wp * .9 })); }, { min: 1024 });
    const lg = box(W + .1, ledgeH, iw + .14, .02, shade(lc, -.15)); lg.position.y = ledgeH / 2; g.add(lg); const lf = plane(W + .1 - .02, ledgeH * .8, paperMat(lt)); lf.position.set(0, ledgeH / 2, (iw + .14) / 2 + .0008); g.add(lf); }
  const bars = vals.map((v, i) => {
    const x = -W / 2 + (i + .5) * pitch, col = cols ? cols[i % cols.length] : null, items = [];
    if (mode === 'grow') { const h = Math.max(.02, v * unit), b = box(iw, h, iw, Math.min(.02, h / 2.2), mat(col ?? ['#3f6fd1', '#5fae4a', '#f08a2a', '#e2432f', '#7a4fc4'][i % 5]), { lw: .003 }); const piv = new THREE.Group(); piv.position.set(x, ledgeH, 0); b.position.y = h / 2; piv.add(b); g.add(piv); items.push({ m: piv, y: 0, j: 0 }); }
    else for (let j = 0; j < v; j++) { const m = itemOf(type, col, i, R), y = ledgeH + (j + .5) * unit; m.position.set(x + (type === 'block' || type === 'box' ? 0 : (R() - .5) * .012), y, (R() - .5) * .01); g.add(m); items.push({ m, y, j }); }
    let val = null; if (o.showValues) { val = mapLabel(num(o.per ? (o.values[i]) : v, o.valueFmt ?? {}), 1.5); val.position.set(x, ledgeH + v * unit + .1, 0); g.add(val); }
    return { i, v, x, items, val, cue: cues?.[i] ?? null };
  });
  let hiMats = null; if (o.highlight) { const bb = bars[o.highlight.bar ?? 0]; if (bb) { hiMats = []; bb.items.forEach(it => it.m.traverse(m => { if (m.isMesh && !m.userData.isOutline) { m.material = m.material.clone(); hiMats.push(m.material); } })); } }
  U.solid = false; U.lw = .003;
  const upd = t => {
    for (const B of bars) { const c = B.cue;
      if (mode === 'grow') { const it = B.items[0]; if (c == null) { it.m.scale.y = 1; } else { const k = E.outBack(seg(t, c - 10 * F, c), 1.2); it.m.visible = t >= c - 10 * F; it.m.scale.y = Math.max(1e-3, k); } }
      else for (const it of B.items) { if (c == null) { it.m.visible = true; continue; } const land = c - (B.v - 1 - it.j) * step, fall = 5 * F; it.m.visible = t >= land - fall;
        if (!it.m.visible) continue; const k = E.inQuad(seg(t, land - fall, land)); const sq = mode === 'pop' ? popK(t, land) : 1; it.m.position.y = it.y + (mode === 'pop' ? 0 : (1 - k) * (.35 + unit * 4)); it.m.scale.setScalar(Math.max(1e-3, sq)); }
      if (B.val) { const k = c == null ? 1 : popK(t, c + 2 * F); B.val.visible = k > 1e-3; B.val.scale.setScalar(Math.max(1e-3, k)); faceCam(B.val, S, t, true); } }
    if (hiMats) { const k = seg(t, o.highlight.t - F, o.highlight.t + 3 * F); for (const m of hiMats) { m.emissive?.set(o.highlight.color ?? '#ffd25a'); if (m.emissive) m.emissiveIntensity = k * (t - o.highlight.t < 3 * F ? 1.4 : .8); } }
  };
  return finish(S, g, 'bars', o, upd);
};

// ---------- digits (giant 3D letters / numbers) ----------
DOCS.digits = "text, h (cap height m), depth, colors (one or per char), side (side colour), gap, windows (building windows on the faces), skyline: true | { shrink, back } (each next char smaller and farther: a skyline), cues: [t, ...] | t0 + stagger (each char rises from the ground, ~full ON its cue), align 'center'|'left', weight";
const WINT = new Map();
function windowsTex(col) {
  if (WINT.has(col)) return WINT.get(col);
  const t = canvasTex(256, 256, (x, W, H) => { x.fillStyle = col; x.fillRect(0, 0, W, H); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const X = i * 64 + 14, Y = j * 64 + 12; x.fillStyle = shade(col, -.22); x.fillRect(X - 3, Y - 3, 42, 46); const g = x.createLinearGradient(X, Y, X + 36, Y + 40); g.addColorStop(0, '#d6f3f6'); g.addColorStop(1, '#8fcad6'); x.fillStyle = g; x.fillRect(X, Y, 36, 40); x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(X + 4, Y + 4, 7, 26); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.25, 1.25); WINT.set(col, t); return t;
}
KINDS.digits = (S, o) => {
  const g = new THREE.Group(), U = g.userData, text = String(o.text ?? '123'), h = o.h ?? 1.2, wt = o.weight ?? 800, chars = [...text];
  const sk = o.skyline === true ? { shrink: .84, back: .55 } : o.skyline || null, depthU = (o.depth ?? h * .32) / h, bev = .045;
  const pal = [].concat(o.colors ?? ['#e2432f', '#3f9ad6', '#f6c945', '#5fae4a', '#7a4fc4', '#f08a2a', '#2f9c95', '#ee7fa6', '#3f6fd1']);
  let x = 0; const items = [];
  chars.forEach((ch, i) => { const s = sk ? Math.pow(sk.shrink, i) : 1, gl = glyph(ch, wt);
    if (!gl.shapes.length) { x += gl.adv * h * s + (o.gap ?? h * .06); return; }
    const geo = shared(`dg${ch}|${wt}|${f4(depthU)}`, () => { const ge = new THREE.ExtrudeGeometry(gl.shapes, { depth: Math.max(.01, depthU - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * .8, bevelSegments: 2, curveSegments: 4, steps: 1 }); ge.translate(0, 0, -(depthU - 2 * bev) / 2); ge.userData.hard = true; return ge; });
    const col = pal[i % pal.length], front = o.windows ? new THREE.MeshStandardMaterial({ map: windowsTex(col), roughness: .6 }) : mat(col), side = mat(o.side ?? shade(col, -.3));
    const m = mesh(geo, [front, side], { lw: .01 / h }); const piv = new THREE.Group(); m.scale.setScalar(h * s); piv.add(m);
    piv.position.set(x, 0, sk ? -sk.back * h * i : 0); g.add(piv);
    items.push({ piv, i }); x += (gl.adv + .02) * h * s + (o.gap ?? h * .06); });
  const total = x - (o.gap ?? h * .06); if ((o.align ?? 'center') === 'center') for (const it of items) it.piv.position.x -= total / 2;
  const cues = o.cues ?? (o.t0 != null ? chars.map((_, i) => o.t0 + i * (o.stagger ?? 3.5 * F)) : null);
  U.solid = true; U.lw = .012;
  const upd = cues ? t => { for (const it of items) { const c = cues[it.i]; if (c == null) continue; const s0 = c - 2 * F, k = t < s0 ? 0 : E.outBack(clamp((t - s0) / (9 * F)), 1.3); it.piv.visible = k > 1e-3; it.piv.scale.set(.7 + .3 * Math.min(1, k), Math.max(1e-3, k), .7 + .3 * Math.min(1, k)); } } : null;
  return finish(S, g, 'digits', o, upd);
};

// ---------- grid (a board of tokens that light on cue) ----------
DOCS.grid = "rows, cols, token 'coin'|'button'|'bulb'|'dot', values (heads/tails: array or 'HTTH..' string; seeded when absent), labels: true | [...] (numbers on buttons), colors: [heads, tails] | per-cell fn(i, r, c), lit (glow colour), upright (stands facing +z; default lies flat facing up), pitch, board ('felt' | 'brass' | false), frame colour, light: [{ cells: [i, ...] | 'all', t | t0 + step, color }], run: { row, from, len, t0, step (frames, 2.2) | times: [...], heads: false } (a run lighting cell by cell, each ON its cue; with seeded values the run is made heads), dim: { t } (the unlit ones darken over 6 frames), circle: { cells, t, color } (a red marker ring drawn round them)";
const EMBL = new Map();
function emblemTex(kind, col) {
  const key = kind + col; if (EMBL.has(key)) return EMBL.get(key);
  const t = canvasTex(256, 256, (x, W) => { x.fillStyle = col; x.fillRect(0, 0, W, W); const dk = shade(col, -.32), lt = shade(col, .3); x.strokeStyle = dk; x.lineWidth = 10; x.beginPath(); x.arc(W / 2, W / 2, W * .4, 0, TAU); x.stroke();
    if (kind === 'H') { x.fillStyle = dk; x.beginPath(); for (let i = 0; i < 16; i++) { const a = i * PI / 8, r = i % 2 ? W * .14 : W * .28; x.lineTo(W / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r); } x.closePath(); x.fill(); x.fillStyle = lt; x.beginPath(); x.arc(W / 2, W / 2, W * .1, 0, TAU); x.fill(); }
    else { x.strokeStyle = dk; x.lineWidth = 12; x.beginPath(); x.arc(W / 2, W / 2, W * .2, PI * .2, PI * 1.8); x.stroke(); x.fillStyle = dk; x.beginPath(); x.arc(W / 2, W / 2, W * .06, 0, TAU); x.fill(); } });
  EMBL.set(key, t); return t;
}
function buttonTex(label, col, on) {
  const key = label + col + on; if (EMBL.has(key)) return EMBL.get(key);
  const t = canvasTex(256, 256, (x, W) => { x.fillStyle = on ? col : '#f3ead8'; x.fillRect(0, 0, W, W); if (on) { const g = x.createRadialGradient(W / 2, W / 2, W * .2, W / 2, W / 2, W / 2); g.addColorStop(0, mixHex(col, '#ffffff', .35)); g.addColorStop(1, col); x.fillStyle = g; x.fillRect(0, 0, W, W); }
    txt(x, label, W / 2, W / 2 + 6, { size: W * (String(label).length > 2 ? .38 : .5), color: on ? '#ffffff' : '#3a2a1c', stroke: on ? shade(col, -.55) : null, strokeW: 16 }); });
  EMBL.set(key, t); return t;
}
KINDS.grid = (S, o) => {
  const g = new THREE.Group(), U = g.userData, rows = o.rows ?? 10, cols = o.cols ?? 10, N = rows * cols, tok = o.token ?? 'coin', R = rnd(o.seed ?? 6);
  const p = o.pitch ?? { coin: .105, button: .1, bulb: .08, dot: .06 }[tok] ?? .1, TR = p * .42, m = p * .7;
  const BW = cols * p + 2 * m, BH = rows * p + 2 * m, panel = new THREE.Group(); g.add(panel);
  let vals = o.values; if (typeof vals === 'string') vals = [...vals].map(c => /[h1x]/i.test(c) ? 1 : 0); if (!vals) vals = Array.from({ length: N }, () => R() < .5 ? 1 : 0); else vals = [...vals];
  if (o.run && o.run.heads !== false && !o.values) for (let k = 0; k < (o.run.len ?? 6); k++) vals[(o.run.row ?? 0) * cols + (o.run.from ?? 0) + k] = 1;   // a streak is a streak of heads
  const board = o.board ?? (tok === 'button' ? 'brass' : 'felt'), frameC = o.frame ?? (board === 'brass' ? '#b0773f' : '#d9822b');
  if (board) { const felt = board === 'brass' ? '#c98a4a' : '#2f6b4f'; panel.add(box(BW - m * .9, BH - m * .9, .03, .01, felt, { p: [0, 0, .015] }));
    for (const [x0, y0, ww, hh] of [[0, BH / 2 - m * .25, BW, m * .5], [0, -BH / 2 + m * .25, BW, m * .5], [-BW / 2 + m * .25, 0, m * .5, BH - m], [BW / 2 - m * .25, 0, m * .5, BH - m]]) panel.add(box(ww, hh, .06, .015, frameC, { p: [x0, y0, .03] })); }
  const z0 = .031, toks = [];
  const lab = i => o.labels === true ? String(i + 1) : Array.isArray(o.labels) ? String(o.labels[i] ?? '') : null;
  const colOf = (i, r, c) => typeof o.colors === 'function' ? o.colors(i, r, c) : o.colors ? o.colors[vals[i] ? 0 : 1] ?? o.colors[0] : tok === 'coin' ? (vals[i] ? '#e9b44c' : '#9c6a3a') : tok === 'button' ? '#d9a441' : tok === 'bulb' ? '#f3e7c6' : '#5a5a66';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c, X = (c - (cols - 1) / 2) * p, Y = ((rows - 1) / 2 - r) * p, col = colOf(i, r, c), tg = new THREE.Group(); tg.position.set(X, Y, z0); const mats = [];
    if (tok === 'coin') { const th = TR * .3, bm = fresh(col, { rough: .35, metal: .35 }), body = discZ(TR, th, bm, { lw: .002 }); body.position.z = th / 2; const em = fresh('#ffffff', { map: emblemTex(vals[i] ? 'H' : 'T', col), rough: .35, metal: .25 }); em.emissiveMap = em.map; const ef = new THREE.Mesh(new THREE.CircleGeometry(TR * .86, 40), em); ef.position.z = th + .0006; ef.userData.noOutline = true; ef.castShadow = false; ef.receiveShadow = true; tg.add(body, ef); mats.push(bm, em); }
    else if (tok === 'button') { const ring = mesh(torusGeo(TR * .86, TR * .13), mat('#e0b25a', { metal: .55, rough: .3 }), { lw: .0015 }); ring.position.z = TR * .1; const L = lab(i) ?? '', fm = new THREE.MeshBasicMaterial({ map: buttonTex(L, o.lit ?? col, false), toneMapped: false }), face = discZ(TR * .74, TR * .2, mat('#efe2c4'), { lw: .0015 }); face.position.z = TR * .1;
      const fp = new THREE.Mesh(new THREE.CircleGeometry(TR * .62, 40), fm); fp.position.z = TR * .2 + .0008; fp.userData.noOutline = true; tg.add(ring, face, fp); tg.userData.btn = { fm, L, col: o.lit ?? (typeof o.colors === 'function' ? col : '#ffb238') }; mats.push(fm); }
    else { const bm = fresh(col, { rough: .35 }), b = tok === 'bulb' ? ball(TR * .8, bm, { lw: .0015 }) : discZ(TR * .8, TR * .2, bm, { lw: .0015 }); b.position.z = tok === 'bulb' ? TR * .5 : TR * .1; tg.add(b); mats.push(bm); }
    panel.add(tg); toks.push({ i, tg, mats, col: new THREE.Color(col), litAt: Infinity, litCol: null }); }
  // schedule
  const allIdx = () => toks.map(t => t.i);
  const sched = (cells, times, color) => cells.forEach((ci, k) => { const T = Array.isArray(times) ? times[k] : times; const tk = toks[ci]; if (!tk || T == null) return; if (T < tk.litAt) { tk.litAt = T; tk.litCol = color ?? o.lit ?? null; } });
  for (const L of [].concat(o.light || [])) { const cells = L.cells === 'all' ? allIdx() : L.cells ?? []; const times = L.times ?? (L.t != null && L.step == null ? L.t : cells.map((_, k) => (L.t0 ?? L.t) + k * (L.step ?? 2.2) * F)); sched(cells, times, L.color); }
  if (o.run) { const r = o.run, len = r.len ?? 6, cells = Array.from({ length: len }, (_, k) => (r.row ?? 0) * cols + (r.from ?? 0) + k); const times = r.times ?? cells.map((_, k) => r.t0 + k * (r.step ?? 2.2) * F); sched(cells, times, r.color); }
  // the hand-drawn ring round some cells
  let ring = null; if (o.circle) { const cl = o.circle.cells ?? (o.run ? Array.from({ length: o.run.len ?? 6 }, (_, k) => (o.run.row ?? 0) * cols + (o.run.from ?? 0) + k) : [0]);
    const xs = cl.map(i => (i % cols - (cols - 1) / 2) * p), ys = cl.map(i => ((rows - 1) / 2 - Math.floor(i / cols)) * p), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, rw = (Math.max(...xs) - Math.min(...xs)) / 2 + p * .75, rh = (Math.max(...ys) - Math.min(...ys)) / 2 + p * .7;
    const cw = rw * 2.3, chh = rh * 2.5, rt = canvasTex(1024, Math.round(1024 * chh / cw), (x) => x.clearRect(0, 0, 1, 1)); const draw = (x, W, H, k) => { x.clearRect(0, 0, W, H); drawStrokes(x, [ellArc(0, 0, 1, 1)], W / 2, H / 2, W / 2 / 1.15, H / 2 / 1.25, k, { color: o.circle.color ?? '#e8352a', width: H * .045, seed: 3 }); };
    const rp = plane(cw, chh, new THREE.MeshStandardMaterial({ map: rt, transparent: true, depthWrite: false, roughness: .6, emissive: '#ff3a2a', emissiveMap: rt, emissiveIntensity: .35 })); rp.position.set(cx, cy, z0 + TR * .45 + .004); rp.renderOrder = 2; panel.add(rp); ring = keyed(rt, t => Math.round(markK(t, o.circle.t, 7 * F) * 40), (x, W, H, t) => draw(x, W, H, E.inOutSine(markK(t, o.circle.t, 7 * F)))); ring(-1e9); rt.userData.key = null; }
  if (o.upright) { U.y0 = o.height ?? 1.35; U.base = BH / 2; } else { panel.rotation.x = -PI / 2; U.top = .06; }
  U.lw = .004;
  const dim = o.dim, litC = new THREE.Color(o.lit ?? '#ffcf4a');
  const upd = t => {
    const dk = dim ? seg(t, dim.t, dim.t + 6 * F) : 0;
    for (const tk of toks) { const on = t >= tk.litAt - CE, a = t - tk.litAt, I = on ? (a < 2 * F ? 2.4 : 1.25) : 0, lc = tk.litCol ? new THREE.Color(tk.litCol) : litC;
      if (tk.tg.userData.btn) { const b = tk.tg.userData.btn; const want = on ? 'on' : 'off'; if (b.state !== want) { b.state = want; b.fm.map = buttonTex(b.L, tk.litCol ?? b.col, on); b.fm.needsUpdate = true; } b.fm.color.setScalar(on ? (a < 2 * F ? 1.8 : 1.25) : 1 - dk * .55); continue; }
      for (const m of tk.mats) { m.userData.base ??= m.color.clone(); if (m.emissive) { m.emissive.copy(lc); m.emissiveIntensity = I * (m.emissiveMap ? .9 : .7); } m.color.copy(m.userData.base).multiplyScalar(on ? 1 : 1 - dk * .6); } }
    ring?.(t);
  };
  sfx(S, o, o.run?.t0, 'click', -12);
  return finish(S, g, 'grid', o, upd);
};

// ---------- calendar ----------
DOCS.calendar = "from, to: day numbers or ISO dates ('2025-03-10'); pages: [...] (labels instead); t0, t1 (the pages flip, the target page is showing EXACTLY from t1), month (header when no dates), note (small line), mark: { t, color } (a marker ring round the final date drawn ON the cue), desk: true (a desk stand), w, h, color (header)";
KINDS.calendar = (S, o) => {
  const g = new THREE.Group(), U = g.userData, w = o.w ?? .38, h = o.h ?? .5, hh = h * .2, lang = globalThis.__CZ_LANG || 'en';
  const isDate = v => typeof v === 'string' && /^\d{4}-\d\d-\d\d/.test(v);
  let pages;
  if (o.pages) pages = o.pages.map(p => typeof p === 'object' ? p : { big: String(p) });
  else if (isDate(o.from) || isDate(o.to)) { const a = new Date((o.from ?? o.to) + 'T12:00:00Z'), b = new Date((o.to ?? o.from) + 'T12:00:00Z'); pages = []; const dir = b >= a ? 1 : -1; for (let d = new Date(a), k = 0; k < 400; k++) { pages.push({ big: String(d.getUTCDate()), small: new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(d), month: new Intl.DateTimeFormat(lang, { month: 'long', timeZone: 'UTC' }).format(d).toUpperCase(), year: String(d.getUTCFullYear()), sun: d.getUTCDay() === 0 }); if (d.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)) break; d.setUTCDate(d.getUTCDate() + dir); } }
  else { const a = o.from ?? 1, b = o.to ?? a, dir = b >= a ? 1 : -1; pages = []; for (let v = a, k = 0; k < 400; v += dir, k++) { pages.push({ big: String(v), small: o.label ?? '' }); if (v === b) break; } }
  const n = pages.length - 1, [t0, t1] = span(o.t0, o.t1, Math.min(2, .12 * n + .3));
  const flipEnd = k => t0 + (t1 - t0) * (k + 1) / n, fd = n ? Math.min(7 * F, (t1 - t0) / n * .95) : 0;
  const state = t => { if (!n || t0 == null || t >= t1 - CE) return { base: n, flip: -1, k: 0 }; if (t < t0) return { base: 0, flip: -1, k: 0 };
    for (let k = 0; k < n; k++) { const e = flipEnd(k); if (t < e - CE) { const s = e - fd; return t < s ? { base: k, flip: -1, k: 0 } : { base: k + 1, flip: k, k: (t - s) / fd }; } } return { base: n, flip: -1, k: 0 }; };
  const red = o.color ?? '#d6402f', pw = w * .94, ph = h - hh - .03;
  const drawPage = (x, W, H, i, mk = 0) => { const p = pages[clamp(i, 0, n)]; x.fillStyle = '#fdfaf2'; x.fillRect(0, 0, W, H); grain(x, W, H, 3, .03); x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(0, 0, W, H * .03);
    if (p.small) txt(x, p.small.toUpperCase(), W / 2, H * .14, { size: H * .085, color: p.sun ? red : '#3a3a46', ls: .06, maxW: W * .86 });
    txt(x, p.big, W / 2, H * .53, { size: H * .55, color: p.sun ? red : '#22222c', maxW: W * .9 });
    txt(x, o.note ?? (p.month ? `${p.month} ${p.year ?? ''}` : ''), W / 2, H * .88, { size: H * .06, weight: 600, color: '#6a6a76', maxW: W * .86 });
    if (mk > 0) drawStrokes(x, [ellArc(0, 0, 1, 1)], W / 2, H * .53, W * .4, H * .33, mk, { color: o.mark?.color ?? '#e8352a', width: H * .025, seed: 4 }); };
  const PWp = 768, PHp = Math.round(PWp * ph / pw);
  const markAt = t => o.mark ? E.inOutSine(markK(t, o.mark.t, 8 * F)) : 0;
  const baseT = canvasTex(PWp, PHp, (x, W, H) => drawPage(x, W, H, state(S.t0 ?? 0).base)), flipT = canvasTex(PWp, PHp, (x, W, H) => drawPage(x, W, H, 0));
  const monthAt = i => (pages[clamp(i, 0, n)].month ?? o.month ?? '').toUpperCase(), yearAt = i => pages[clamp(i, 0, n)].year ?? o.year ?? '';
  const headT = canvasTex(768, Math.round(768 * hh / w), (x, W, H) => { x.fillStyle = red; x.fillRect(0, 0, W, H); txt(x, monthAt(state(S.t0 ?? 0).base) || 'CALENDAR', W / 2, H * .55, { size: H * .45, color: '#fff', ls: .08, maxW: W * .86 }); });
  g.add(box(w + .02, h + .02, .012, .006, '#e9dcc0', { p: [0, 0, .006] }));
  g.add(box(w, hh, .02, .008, shade(red, -.15), { p: [0, h / 2 - hh / 2, .02] })); g.add(plane(w - .01, hh - .01, paperMat(headT), { p: [0, h / 2 - hh / 2, .0305] }));
  const pTop = h / 2 - hh - .01; g.add(box(pw, ph, .014, .004, '#f4efe2', { p: [0, pTop - ph / 2, .019] }));
  const base = plane(pw - .004, ph - .004, paperMat(baseT)); base.position.set(0, pTop - ph / 2, .0262); g.add(base);
  const piv = new THREE.Group(); piv.position.set(0, pTop, .027); const pg = new THREE.PlaneGeometry(pw - .004, ph - .004);
  for (const m2 of [paperMat(flipT, { lift: .35 }), fresh('#efe9da', { rough: .95, emissive: '#efe9da', ei: .35 })]) { const fp = new THREE.Mesh(pg, m2); if (!m2.map) m2.side = THREE.BackSide; fp.position.y = -ph / 2; fp.userData.noOutline = true; piv.add(fp); }
  g.add(piv);
  for (const s of [-1, 1]) { const r = mesh(torusGeo(.018, .0035), mat('#c9d0d8', { metal: .7, rough: .3 }), { lw: .0012 }); r.rotation.y = PI / 2; r.position.set(s * w * .28, pTop + .004, .028); g.add(r); }
  if (o.desk) { g.rotation.x = -.22; const stand = new THREE.Group(); stand.add(g); stand.add(box(w * .9, .025, h * .5, .01, '#3a3a46', { p: [0, .0125 - h / 2 - .01, -h * .12] })); U.base = h / 2 + .03; }
  const root = o.desk ? g.parent : g; root.userData.face = { mesh: base, tex: baseT, w: pw, h: ph }; root.userData.y0 = 1.5; root.userData.base ??= h / 2; root.userData.lw = .004;
  const upB = keyed(baseT, t => state(t).base + '|' + Math.round(markAt(t) * 30), (x, W, H, t) => drawPage(x, W, H, state(t).base, state(t).base === n ? markAt(t) : 0));
  const upF = keyed(flipT, t => state(t).flip, (x, W, H, t) => drawPage(x, W, H, Math.max(0, state(t).flip)));
  const upH = keyed(headT, t => monthAt(state(t).base) + yearAt(state(t).base), (x, W, H, t) => { x.fillStyle = red; x.fillRect(0, 0, W, H); txt(x, monthAt(state(t).base) || 'CALENDAR', W / 2, H * .55, { size: H * .45, color: '#fff', ls: .08, maxW: W * .86 }); });
  const upd = t => { upB(t); upF(t); upH(t); const s = state(t); piv.visible = s.flip >= 0; if (s.flip >= 0) piv.rotation.x = -E.inOutSine(s.k) * PI * 1.05; if (o.sfx && t0 != null) void 0; };
  if (o.sfx && t0 != null) for (let k = 0; k < n; k++) sfx(S, o, flipEnd(k) - fd, 'swish', -14);
  return finish(S, root, 'calendar', o, upd);
};

// ---------- clock ----------
DOCS.clock = "time ('10:10') | from + to + t0 + t1 (the hands sweep forward, landing EXACTLY on `to` at t1), ease, seconds: true (a ticking second hand, real time), style 'wall'|'alarm', ring: { t0, t1 } (alarm shakes), r, color (rim), face, numbers: 'all'|'quarters'|false";
const minsOf = v => typeof v === 'number' ? v : (() => { const [hh, mm] = String(v).split(':').map(Number); return (hh || 0) * 60 + (mm || 0); })();
KINDS.clock = (S, o) => {
  const g = new THREE.Group(), U = g.userData, r = o.r ?? .2, style = o.style ?? 'wall', rimC = o.color ?? (style === 'alarm' ? '#e2432f' : '#2a2a32');
  const body = new THREE.Group(); g.add(body);
  body.add(discZ(r * .98, r * .16, mat(style === 'alarm' ? rimC : '#f2ebdd'), { p: [0, 0, r * .08] }));
  const rim = mesh(torusGeo(r, r * .085), mat(rimC, { rough: .4, metal: style === 'alarm' ? 0 : .3 }), { lw: .004 }); rim.position.z = r * .17; body.add(rim);
  const ft = canvasTex(1024, 1024, (x, W) => { x.fillStyle = o.face ?? '#fbf6ea'; x.beginPath(); x.arc(W / 2, W / 2, W / 2, 0, TAU); x.fill(); const c = W / 2;
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, big = i % 5 === 0, r1 = W * .46, r2 = W * (big ? .4 : .43); x.strokeStyle = INK; x.lineWidth = big ? 12 : 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1); x.lineTo(c + Math.sin(a) * r2, c - Math.cos(a) * r2); x.stroke(); }
    const nm = o.numbers ?? 'all'; if (nm) for (let i = 1; i <= 12; i++) { if (nm === 'quarters' && i % 3) continue; const a = i / 12 * TAU; txt(x, String(i), c + Math.sin(a) * W * .32, c - Math.cos(a) * W * .32 + 6, { size: W * .11, color: INK }); }
    if (o.brand) txt(x, o.brand, c, c + W * .17, { size: W * .04, weight: 600, color: '#8a7a6a', ls: .2 }); });
  const face = new THREE.Mesh(new THREE.CircleGeometry(r * .92, 64), paperMat(ft, { rough: .6 })); face.position.z = r * .161; face.userData.noOutline = true; body.add(face);
  const hand = (len, wd, col, z) => { const p = new THREE.Group(); const m = box(wd, len, .006, Math.min(wd / 2.2, .004), col, { lw: .0015 }); m.position.y = len / 2 - len * .14; p.add(m); p.position.z = z; body.add(p); return p; };
  const hH = hand(r * .52, r * .085, INK, r * .17), mH = hand(r * .76, r * .06, INK, r * .18), sH = o.seconds ? hand(r * .8, r * .02, '#e2432f', r * .19) : null;
  body.add(ball(r * .055, mat('#d9a441', { metal: .6, rough: .3 }), { p: [0, 0, r * .2], lw: .0015 }));
  if (style === 'alarm') { for (const s of [-1, 1]) { const bell = mesh(lathe([[r * .32, 0], [r * .3, r * .12], [r * .18, r * .25], [0, r * .28]], 24, 2), mat('#d9a441', { metal: .6, rough: .3 }), { lw: .003 }); bell.position.set(s * r * .55, r * .82, 0); bell.rotation.z = -s * .55; body.add(bell); }
    body.add(rod([0, r * 1.02, 0], [0, r * 1.18, 0], r * .03, mat('#d9a441', { metal: .6 }))); for (const s of [-1, 1]) body.add(rod([s * r * .5, -r * .75, 0], [s * r * .7, -r * 1.12, 0], r * .05, mat(shade(rimC, -.3))));
    body.position.y = r * 1.15; U.base = 0; U.y0 = 0; }
  else { U.y0 = o.height ?? 2.05; U.base = r; }
  const m0 = minsOf(o.from ?? o.time ?? '10:10'), m1raw = minsOf(o.to ?? o.time ?? o.from ?? '10:10'), m1 = o.to != null && m1raw < m0 ? m1raw + 720 : m1raw;
  U.lw = .004;
  const [ct0, ct1] = span(o.t0, o.t1, 1.2);
  const upd = t => { const mm = easeAt(t, m0, m1, ct0, ct1, o.ease ?? 'inOutCubic'); mH.rotation.z = -(mm % 60) / 60 * TAU; hH.rotation.z = -((mm / 60) % 12) / 12 * TAU;
    if (sH) sH.rotation.z = -Math.floor(t) / 60 * TAU;
    if (o.ring) { const on = t >= o.ring.t0 && t < (o.ring.t1 ?? o.ring.t0 + 1); body.rotation.z = on ? .07 * Math.sin(t * TAU * 14) : 0; } };
  return finish(S, g, 'clock', o, upd);
};

// ---------- gauge ----------
DOCS.gauge = "min, max, from, value (or to), t0, t1 (the needle swings with a small overshoot and LANDS EXACTLY on value at t1), ease ('outBack'), zones: [[from, to, colour], ...], ticks (major count), unit, title, readout (a digital value under the hub), decimals, r, color (housing)";
KINDS.gauge = (S, o) => {
  const g = new THREE.Group(), U = g.userData, r = o.r ?? .22, min = o.min ?? 0, max = o.max ?? 100, A0 = 210, A1 = -30;
  const angOf = v => A0 + (clamp(v, min - (max - min) * .05, max + (max - min) * .05) - min) / (max - min) * (A1 - A0);
  g.add(discZ(r * 1.05, r * .22, mat(o.color ?? '#3a3e48', { rough: .45 }), { p: [0, 0, r * .11] }));
  const rim = mesh(torusGeo(r * 1.02, r * .07), mat(o.rim ?? '#c9d0d8', { metal: .7, rough: .3 }), { lw: .003 }); rim.position.z = r * .22; g.add(rim);
  const zones = o.zones ?? [[min, min + (max - min) * .6, '#5fae4a'], [min + (max - min) * .6, min + (max - min) * .85, '#f6c945'], [min + (max - min) * .85, max, '#e2432f']];
  const [gt0, gt1] = span(o.t0, o.t1, .8), valAt = t => easeAt(t, o.from ?? min, o.value ?? o.to ?? min, gt0, gt1, o.ease ?? (k => E.outBack(k, 1.25)));
  const drawFace = (x, W, H, t) => { const c = W / 2, R2 = W * .42; x.fillStyle = o.face ?? '#f8f4ea'; x.beginPath(); x.arc(c, c, W / 2, 0, TAU); x.fill();
    for (const [a, b, col] of zones) { x.strokeStyle = col; x.lineWidth = W * .055; x.beginPath(); x.arc(c, c, R2 - W * .03, -angOf(a) * PI / 180, -angOf(b) * PI / 180); x.stroke(); }
    const nt = o.ticks ?? 5; for (let i = 0; i <= nt * 5; i++) { const v = min + (max - min) * i / (nt * 5), a = -angOf(v) * PI / 180, big = i % 5 === 0; x.strokeStyle = INK; x.lineWidth = big ? 9 : 4; x.beginPath(); x.moveTo(c + Math.cos(a) * R2 * (big ? .78 : .84), c + Math.sin(a) * R2 * (big ? .78 : .84)); x.lineTo(c + Math.cos(a) * R2 * .92, c + Math.sin(a) * R2 * .92); x.stroke();
      if (big) txt(x, num(v, { decimals: o.tickDecimals ?? 0 }), c + Math.cos(a) * R2 * .62, c + Math.sin(a) * R2 * .62, { size: W * .065, color: INK }); }
    if (o.title) txt(x, o.title, c, c + W * .2, { size: W * .055, weight: 600, color: '#5a5a66', maxW: W * .5 }); if (o.unit) txt(x, o.unit, c, c - W * .17, { size: W * .06, color: '#5a5a66' });
    if (o.readout) { const s = num(valAt(t), { decimals: o.decimals ?? 0 }) + (o.unitSuffix ?? ''); x.fillStyle = '#1b1e26'; rrPath(x, c - W * .14, c + W * .27, W * .28, W * .1, W * .02); x.fill(); txt(x, s, c, c + W * .32, { size: W * .065, color: '#7dffb0', maxW: W * .25 }); } };
  const ft = canvasTex(1024, 1024, (x, W, H) => drawFace(x, W, H, S.t0 ?? 0));
  const face = new THREE.Mesh(new THREE.CircleGeometry(r * .95, 64), paperMat(ft, { rough: .55 })); face.position.z = r * .221; face.userData.noOutline = true; g.add(face);
  const nd = new THREE.Group(); nd.position.z = r * .235; const sh = roundPoly([[-r * .045, -r * .16], [r * .045, -r * .16], [r * .012, r * .8], [-r * .012, r * .8]], r * .01);
  nd.add(mesh(extrude(sh, r * .03, r * .008, 2), mat(o.needle ?? '#e2432f', { rough: .4 }), { lw: .0015 })); g.add(nd);
  g.add(ball(r * .08, mat('#3a3e48', { metal: .5, rough: .3 }), { p: [0, 0, r * .25], lw: .0015 }));
  U.y0 = o.height ?? 1.6; U.base = r; U.lw = .003;
  const fu = o.readout ? keyed(ft, t => num(valAt(t), { decimals: o.decimals ?? 0 }), drawFace) : null;
  return finish(S, g, 'gauge', o, t => { nd.rotation.z = (angOf(valAt(t)) - 90) * PI / 180; fu?.(t); });
};

// ---------- thermometer ----------
DOCS.thermometer = "min, max, from, value (or to), t0, t1 (the red rises / falls, LANDS EXACTLY at t1), ease, unit ('°C'), step (labelled ticks), h (board height), color (board), hot (the liquid glows above this value)";
KINDS.thermometer = (S, o) => {
  const g = new THREE.Group(), U = g.userData, h = o.h ?? .62, w = h * .28, min = o.min ?? -10, max = o.max ?? 50, tubeR = w * .085, bulbR = w * .17;
  const yB = -h / 2 + w * .3, yT = h / 2 - w * .3, lvl = v => yB + bulbR * .8 + (clamp(v, min, max) - min) / (max - min) * (yT - yB - bulbR * .8), tx = -w * .2;
  const bt = texFor(w, h, (x, W, H) => { x.fillStyle = o.color ?? '#f4ecd8'; x.fillRect(0, 0, W, H); grain(x, W, H, 4, .04); const k = H / h, Y = v => H / 2 - lvl(v) * k, X0 = (tx / w + .5) * W + tubeR / w * W * 1.6, step = o.step ?? Math.max(1, Math.round((max - min) / 6 / 5) * 5);
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-6; v += step / 2) { const big = Math.abs(v / step - Math.round(v / step)) < 1e-6; x.fillStyle = INK; x.fillRect(X0, Y(v) - (big ? 4 : 2.5), W * (big ? .14 : .08), big ? 8 : 5); if (big) txt(x, String(v), X0 + W * .19, Y(v), { size: W * .15, align: 'left', color: INK, maxW: W * .36 }); }
    txt(x, o.unit ?? '°C', W * .5, H * .045, { size: W * .15, color: '#5a5a66' }); }, { min: 1024 });
  g.add(box(w, h, .03, .012, o.color ?? '#f4ecd8', { p: [0, 0, .015] })); g.add(plane(w - .006, h - .006, paperMat(bt), { p: [0, 0, .0302] }));
  g.add(rod([tx, yB, .045], [tx, yT, .045], tubeR, mat('#eef6fa', { rough: .25 }), { lw: .002 }));
  const liq = o.liquid ?? '#e2432f', lm = fresh(liq, { rough: .35, emissive: liq, ei: 0 });
  const bulb = ball(bulbR, lm, { p: [tx, yB, .045], lw: .002 }); g.add(bulb);
  const col = mesh(shared('thermcyl', () => new THREE.CylinderGeometry(1, 1, 1, 16, 1)), lm, { noOutline: true }); col.scale.set(tubeR * 1.07, 1, tubeR * 1.07); col.position.set(tx, 0, .045); g.add(col);
  U.y0 = o.height ?? 1.5; U.base = h / 2; U.lw = .003;
  const [mt0, mt1] = span(o.t0, o.t1, 1), valAt = t => easeAt(t, o.from ?? min, o.value ?? o.to ?? min, mt0, mt1, o.ease ?? 'inOutCubic');
  return finish(S, g, 'thermometer', o, t => { const v = valAt(t), top = lvl(v), bot = yB; col.scale.set(tubeR * 1.07, Math.max(.001, top - bot), tubeR * 1.07); col.position.y = (top + bot) / 2; lm.emissiveIntensity = o.hot != null && v > o.hot ? .6 * clamp((v - o.hot) / ((max - o.hot) || 1)) : 0; });
};

// ---------- timer ----------
DOCS.timer = "from (seconds), to (0), t0 (starts), t1 (optional: reaches `to` EXACTLY at t1, else real time), up: true (counts up), format 'mm:ss'|'ss'|'ss.cc'|'hh:mm:ss', blink (seconds of blinking at the end, 1.5), style 'box'|'bomb', color (digits)";
KINDS.timer = (S, o) => {
  const g = new THREE.Group(), U = g.userData, from = o.from ?? 10, to = o.to ?? (o.up ? from + 60 : 0), fmtS = o.format ?? (Math.max(from, to) >= 3600 ? 'hh:mm:ss' : Math.max(from, to) >= 60 ? 'mm:ss' : 'ss.cc');
  const valAt = t => { if (o.t0 == null || t < o.t0) return from; if (o.t1 != null) return t >= o.t1 ? to : lerp(from, to, (t - o.t0) / (o.t1 - o.t0)); const v = o.up ? from + (t - o.t0) : from - (t - o.t0); return o.up ? Math.min(to, v) : Math.max(to, v); };
  const fmtV = v => { const p2 = n => String(Math.floor(n)).padStart(2, '0'); v = Math.max(0, v); if (fmtS === 'ss') return p2(o.up ? v : Math.ceil(v - 1e-6)); if (fmtS === 'ss.cc') return p2(v) + '.' + p2((v % 1) * 100); if (fmtS === 'hh:mm:ss') return `${p2(v / 3600)}:${p2(v / 60 % 60)}:${p2(v % 60)}`; return `${p2(v / 60)}:${p2(Math.floor(v) % 60)}`; };
  const endT = o.t1 ?? (o.t0 != null ? o.t0 + Math.abs(to - from) : null);
  const blinkOff = t => endT != null && t >= endT && t < endT + (o.blink ?? 1.5) && Math.floor((t - endT) * 30 / 8) % 2 === 1;
  const ch = .09, cw = ch * .56, sample = fmtV(from).replace(/[0-9]/g, '8'), DW = segWidth(sample, cw) + cw * .8, DH = ch * 1.5, lit = o.color ?? '#ff3b2f';
  const draw = (x, W, H, t) => { x.fillStyle = '#0b0606'; x.fillRect(0, 0, W, H); const k = W / DW, cwp = cw * k, chp = ch * k, s = fmtV(valAt(t)), sw2 = segWidth(s, cwp), X0 = (W - sw2) / 2; segText(x, s.replace(/[0-9]/g, '8'), X0, (H - chp) / 2, cwp, chp, '#2a0c0a', null); if (!blinkOff(t)) segText(x, s, X0, (H - chp) / 2, cwp, chp, lit, null); };
  const tex = canvasTex(1024, Math.round(1024 * DH / DW), (x, W, H) => draw(x, W, H, S.t0 ?? 0));
  const bw = DW + .07, bh = DH + .08, bd = .09; g.add(box(bw, bh, bd, .02, o.housing ?? '#3a3e48', { p: [0, bh / 2, 0] })); g.add(box(DW + .016, DH + .016, .01, .004, '#111', { p: [0, bh / 2, bd / 2] }));
  const disp = plane(DW, DH, glowMat(tex, 1.8), { unlit: true, p: [0, bh / 2, bd / 2 + .0055] }); g.add(disp);
  if ((o.style ?? 'box') === 'bomb') { for (let i = 0; i < 3; i++) g.add(rod([-bw * .45, .03 + i * .045, -bd / 2 - .03], [bw * .45, .03 + i * .045, -bd / 2 - .03], .022, mat('#c8352a', { rough: .6 }), { lw: .002 }));
    for (const s of [-1, 1]) g.add(box(.025, .16, .07, .006, '#2a2a2a', { p: [s * bw * .3, .08, -bd / 2 - .03] }));
    ['#e2432f', '#3f6fd1', '#f6c945'].forEach((c, i) => { const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(-bw * .3 + i * .03, bh, 0), new THREE.Vector3(-bw * .2 + i * .05, bh + .07, .01), new THREE.Vector3(bw * .1 + i * .04, bh + .04, -.02), new THREE.Vector3(bw * .3, .12, -bd / 2 - .02)]);
      g.add(mesh(new THREE.TubeGeometry(cv, 24, .006, 8), mat(c, { rough: .5 }), { lw: .0015 })); }); }
  else for (let i = 0; i < 3; i++) g.add(box(.03, .015, .03, .006, ['#e2432f', '#5fae4a', '#f6c945'][i], { p: [-.04 + i * .04, bh + .007, 0], lw: .0015 }));
  U.screen = tex; U.lw = .003; U.top = bh;
  sfx(S, o, endT, 'ding', -6);
  return finish(S, g, 'timer', o, keyed(tex, t => fmtV(valAt(t)) + (blinkOff(t) ? '_' : ''), draw));
};

// ---------- speech + thought bubbles ----------
DOCS.speech = "text, to: an actor (or Object3D / [x, y, z]) whose head it floats beside (follows it), side 1|-1 (body to the right / left of the tail), offset: [right, up] (m, camera space), size (text height m, .085), w (max width), color, textColor, in (pops from the tail ON the cue), out, type: true (letters appear over typeDur), billboard: false (keep its own rotation), keepOnScreen: false (never switch sides at the frame edge)";
DOCS.thought = "text | draw (a picture name) | image, to, side, offset, size, w (max text width), cw / ch (cloud size m), color, in (the small puffs pop first, the cloud ON the cue), out, keepOnScreen: false";
/** bubbles stay paper-white in any light (a little self-light) */
const bubMat = o => mat(o.color ?? '#ffffff', { rough: .6, emissive: o.color ?? '#ffffff', ei: o.lift ?? .3 });
function bubbleText(text, sizeM, maxW) {
  const px = 100; font(MC, px, 800); const lines = wrap(MC, text, maxW / sizeM * px * .72); const tw = Math.max(...lines.map(l => MC.measureText(l).width)) / px * sizeM / .72;
  return { lines, tw, th: lines.length * sizeM * 1.5 };
}
function speechShape(w, h, tail, side) {
  const s = new THREE.Shape(), r = Math.min(h * .45, w * .3), x0 = side > 0 ? -w * .22 : -w * .78, x1 = x0 + w, y0 = tail, y1 = tail + h;
  let ta, tb; if (side > 0) { ta = x0 + Math.max(r + w * .02, w * .14); tb = Math.min(ta + w * .17, x1 - r - .001); } else { tb = x1 - Math.max(r + w * .02, w * .14); ta = Math.max(tb - w * .17, x0 + r + .001); }
  s.moveTo(x0 + r, y0); s.lineTo(ta, y0);
  if (side > 0) { s.quadraticCurveTo(ta - w * .01, y0 * .45, 0, 0); s.quadraticCurveTo(tb - w * .05, y0 * .35, tb, y0); } else { s.quadraticCurveTo(ta + w * .05, y0 * .35, 0, 0); s.quadraticCurveTo(tb + w * .01, y0 * .45, tb, y0); }
  s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -PI / 2, 0); s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, PI / 2); s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, PI / 2, PI); s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, PI, PI * 1.5);
  return { shape: s, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
function cloudShape(w, h, n = 9, seed = 1) {
  const R = rnd(seed), s = new THREE.Shape(), pts = [];
  for (let i = 0; i < n; i++) { const a = -PI / 2 + i / n * TAU + (R() - .5) * .18; pts.push([Math.cos(a) * w / 2, Math.sin(a) * h / 2]); }
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, L = Math.hypot(mx / (w / 2), my / (h / 2)) || 1, nx = mx / (w / 2) / L, ny = my / (h / 2) / L, bul = (.36 + R() * .14) * Math.hypot(q[0] - p[0], q[1] - p[1]); s.quadraticCurveTo(mx + nx * bul, my + ny * bul, q[0], q[1]); }
  return s;
}
/** place a bubble by its speaker's head (following it), facing the camera; returns the side used: o.side, or the other
 *  one when the bubble (extent ext = [x0, x1, yMid] for side +1) would leave the frame (keepOnScreen: false keeps it) */
function bubbleFollow(S, g, o, t, base, ext) {
  const c = camAt(S, t), to = o.to, s0 = o.side ?? 1, right = _v1.set(1, 0, 0).applyQuaternion(c.quaternion).clone(), up = _v2.set(0, 1, 0).applyQuaternion(c.quaternion).clone();
  let p = null, R = .2;
  if (to) { if (to.toon) { R = to.toon.B.head; p = to.head().add(new THREE.Vector3(0, R * .2, 0)); } else if (to.isObject3D) p = new THREE.Box3().setFromObject(to).getCenter(new THREE.Vector3()); else p = V3(to); }
  const posFor = s => { if (!p) return base.clone(); const off = o.offset ? [Math.abs(o.offset[0]) * s, o.offset[1]] : [R * .3 * s, R * 1.45]; return p.clone().addScaledVector(right, off[0]).addScaledVector(up, off[1]); };
  let side = s0;
  if (o.keepOnScreen !== false && ext) { const fits = s => { const P = posFor(s); return [ext[0], ext[1]].every(X => Math.abs(P.clone().addScaledVector(right, X * s).addScaledVector(up, ext[2]).project(c).x) < .97); }; if (!fits(s0) && fits(-s0)) side = -s0; }
  g.position.copy(posFor(side));
  if (o.billboard !== false) g.quaternion.copy(c.quaternion);
  return side;
}
KINDS.speech = (S, o) => {
  const g = new THREE.Group(), U = g.userData, size = o.size ?? .085, text = String(o.text ?? '...');
  const { lines, tw, th } = bubbleText(text, size, o.w ?? 1.0), w = Math.max(size * 3, tw + size * 1.6), h = th + size * 1.1, tail = o.tail ?? size * 1.6, thick = Math.max(.02, size * .38);
  const { shape, cx, cy } = speechShape(w, h, tail, 1);     // built for side +1; side -1 mirrors the body
  const body = new THREE.Group(), bub = mesh(extrude(shape, thick, thick * .35, 3, 12), bubMat(o), { lw: o.lw ?? Math.max(.006, size * .11) }); bub.castShadow = false; body.add(bub); g.add(body);
  const PX = 1024, PH = Math.round(PX * h / w), tc = o.textColor ?? INK;
  const drawT = (x, W, H, n = Infinity) => { x.clearRect(0, 0, W, H); let left = n; const lh = H / (h / (size * 1.5)) ; const y0 = H / 2 - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => { const s = l.slice(0, Math.max(0, left)); left -= l.length + 1; if (s) { font(x, lh * .84); const full = x.measureText(l).width; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = tc; x.fillText(s, W / 2 - full / 2, y0 + i * lh); } }); };
  const tt = canvasTex(PX, PH, (x, W, H) => drawT(x, W, H)); const tp = plane(w, h, new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, toneMapped: false }), { unlit: true }); tp.position.set(cx, cy, thick / 2 + .0015); tp.renderOrder = 2; g.add(tp);
  U.ownPlace = !!o.to; U.lw = o.lw ?? Math.max(.006, size * .11); U.y0 = 1.9;
  const typeDur = o.typeDur ?? text.length * .035, tIn = o.in ?? null;
  const ty = o.type ? keyed(tt, t => Math.floor(seg(t, tIn ?? S.t0, (tIn ?? S.t0) + typeDur) * text.length), (x, W, H, t) => drawT(x, W, H, Math.floor(seg(t, tIn ?? S.t0, (tIn ?? S.t0) + typeDur) * text.length))) : null;
  let base = null; const ext = [-w * .22, w * .78, tail + h / 2];
  const upd = t => { if (!base) base = g.position.clone(); const s = bubbleFollow(S, g, o, t, base, ext); body.scale.x = s; tp.position.x = s * cx; ty?.(t); };
  return finish(S, g, 'speech', o, upd);
};
KINDS.thought = (S, o) => {
  const g = new THREE.Group(), U = g.userData, size = o.size ?? .085, hasPic = o.draw || o.image;
  const { lines, tw, th } = bubbleText(String(o.text ?? ''), size, o.w ?? .9), w = o.cw ?? Math.max(hasPic ? .5 : size * 4, tw + size * 2.2), h = o.ch ?? Math.max(hasPic ? .42 : 0, th + size * 1.6), thick = Math.max(.02, size * .4);
  const cloud = new THREE.Group(), cxo = w * .38, cyo = size * 2.6 + h / 2; cloud.position.set(cxo, cyo, 0); g.add(cloud);
  cloud.add(mesh(extrude(cloudShape(w, h, Math.max(7, Math.round(w / h * 6)), o.seed ?? 2), thick, thick * .35, 3, 10), bubMat(o), { lw: Math.max(.006, size * .11) }));
  const puffs = [[.35, .5, .16], [.65, 1.25, .26]].map(([fx, fy, r]) => { const p = mesh(extrude(circlePath(0, 0, size * r * 2.2, new THREE.Shape()), thick * .8, thick * .3, 2, 16), bubMat(o), { lw: Math.max(.005, size * .09) }); p.position.set(fx * cxo * .55, size * fy, 0); g.add(p); return p; });
  const PX = 1024, PH = Math.round(PX * h / w), tt = canvasTex(PX, PH, (x, W, H) => { x.clearRect(0, 0, W, H); if (hasPic) picture(x, o, W * .2, H * .12, W * .6, H * (lines[0] ? .5 : .76)); if (lines[0]) { const lh = (hasPic ? H * .22 : H * .8) / lines.length; lines.forEach((l, i) => txt(x, l, W / 2, (hasPic ? H * .76 : H / 2 - (lines.length - 1) * lh / 2) + i * lh, { size: Math.min(lh * .66, H * .3), color: o.textColor ?? INK, maxW: W * .72 })); } });
  const tp = plane(w, h, new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, toneMapped: false }), { unlit: true }); tp.position.z = thick / 2 + .0015; tp.renderOrder = 2; cloud.add(tp);
  U.ownPlace = !!o.to; U.ownIn = true; U.lw = Math.max(.006, size * .11); U.y0 = 1.9;
  let base = null; const ext = [cxo - w / 2 - size * .3, cxo + w / 2 + size * .3, cyo];
  const upd = t => { if (!base) base = g.position.clone(); const s = bubbleFollow(S, g, o, t, base, ext); cloud.position.x = s * cxo; puffs.forEach((p, i) => { p.position.x = s * [.35, .65][i] * cxo * .55; });
    if (o.in != null) { const ks = [popK(t, o.in - 4 * F), popK(t, o.in - 2 * F), popK(t, o.in)]; puffs[0].scale.setScalar(Math.max(1e-3, ks[0])); puffs[1].scale.setScalar(Math.max(1e-3, ks[1])); cloud.scale.setScalar(Math.max(1e-3, ks[2])); g.visible = ks[0] > 1e-3; }
    if (o.out != null) { const k = outK(t, o.out); g.scale.setScalar(Math.max(1e-3, k)); if (k <= 1e-3) g.visible = false; } };
  return finish(S, g, 'thought', o, upd);
};

// ---------- checklist ----------
DOCS.checklist = "items: ['text', ...] | [{ text, mark 'tick'|'cross', t, done (ticked from the start) }], times: [t, ...] (each mark is drawn ON its cue: 1 frame before to 4 after), title, strike (cross out the crossed items), w, h, board colour, paper";
KINDS.checklist = (S, o) => {
  const w = o.w ?? .34, h = o.h ?? .46, g = new THREE.Group(), U = g.userData;
  const items = (o.items ?? ['Item one', 'Item two', 'Item three']).map((it, i) => typeof it === 'object' ? { mark: 'tick', ...it, t: it.t ?? o.times?.[i] } : { text: String(it), mark: 'tick', t: o.times?.[i] });
  const pw = w * .9, ph = h * .82;
  const draw = (x, W, H, t) => { x.fillStyle = o.paper ?? '#fdfbf4'; x.fillRect(0, 0, W, H); grain(x, W, H, 8, .025); const u = W / 100;
    x.strokeStyle = 'rgba(80,120,200,.25)'; x.lineWidth = u * .2; for (let y = H * .2; y < H; y += H * .07) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } x.strokeStyle = 'rgba(220,80,80,.35)'; x.beginPath(); x.moveTo(u * 14, 0); x.lineTo(u * 14, H); x.stroke();
    let y = H * .1; if (o.title) { txt(x, o.title, W / 2, y, { size: u * 8, color: INK, maxW: W * .86 }); y += H * .08; }
    const rowH = Math.min(H * .135, (H * .94 - y) / items.length);
    items.forEach((it, i) => { const cy = y + rowH * (i + .5), bx = u * 17, bs = rowH * .56; x.strokeStyle = INK; x.lineWidth = u * .7; rrPath(x, bx, cy - bs / 2, bs, bs, bs * .15); x.stroke();
      txt(x, it.text, bx + bs + u * 4, cy, { size: rowH * .5, weight: 600, align: 'left', color: INK, maxW: W - bx - bs - u * 8 });
      const k = it.t == null ? (it.done ? 1 : 0) : markK(t, it.t, 5 * F);
      if (k > 0) { const cross = it.mark === 'cross'; drawStrokes(x, (cross ? STROKES.cross : STROKES.check)(), bx + bs / 2 + (cross ? 0 : bs * .1), cy - (cross ? 0 : bs * .12), bs * (cross ? .55 : .75), bs * (cross ? .55 : .75), E.outCubic(k), { color: cross ? '#d6402f' : '#2e9b46', width: u * 1.6, seed: i + 2, wobble: .03 });
        if (cross && o.strike) { font(x, rowH * .5, 600); const tw = Math.min(W - bx - bs - u * 8, x.measureText(it.text).width); x.strokeStyle = '#d6402f'; x.lineWidth = u * .6; x.beginPath(); x.moveTo(bx + bs + u * 3, cy); x.lineTo(bx + bs + u * 3 + (tw + u * 2) * E.outCubic(k), cy - u * .5); x.stroke(); } } }); };
  const sh = sheet(pw, ph, (x, W, H) => draw(x, W, H, -1e9), { fix: 'none', thick: .003 }); sh.g.position.set(0, -h * .04, .012); g.add(sh.g);
  g.add(box(w, h, .012, .01, o.board ?? '#b07a45', { p: [0, 0, .006] }));
  const clip = new THREE.Group(); clip.position.set(0, h / 2 - .02, .018); clip.add(box(w * .38, .055, .016, .006, mat('#c9d0d8', { metal: .7, rough: .3 })), rod([-w * .12, .015, .01], [w * .12, .015, .01], .006, mat('#aeb6be', { metal: .7, rough: .3 }), { lw: .0015 })); g.add(clip);
  U.face = sh.g.userData.face; U.y0 = 1.25; U.base = h / 2; U.lw = .003;
  const anim = items.some(it => it.t != null);
  for (const it of items) if (it.t != null) sfx(S, o, it.t, 'click', -10);
  return finish(S, g, 'checklist', o, anim ? keyed(sh.tex, t => items.map(it => it.t == null ? 1 : Math.round(markK(t, it.t, 5 * F) * 10)).join(','), draw) : null);
};

// ---------- newspaper ----------
DOCS.newspaper = "name (masthead, invented), date, headline, sub, image | draw (the photo box), body (columns of grey lines), price, w, h, paper, highlight: { line: 'headline'|'sub', t } (a marker swipe ON the cue), spin: t (the classic spin-in, landing ON the cue)";
KINDS.newspaper = (S, o) => {
  const w = o.w ?? .55, h = o.h ?? .75, paper = o.paper ?? '#efeadf', HL = [].concat(o.highlight || []);
  const draw = (x, W, H, t) => { x.fillStyle = paper; x.fillRect(0, 0, W, H); grain(x, W, H, 12, .04); const u = W / 100, ink = '#1d1b1a';
    txt(x, (o.name ?? 'THE DAILY LANTERN').toUpperCase(), W / 2, H * .065, { size: u * 9.5, color: ink, maxW: W * .9, ls: .02 });
    x.fillStyle = ink; x.fillRect(u * 4, H * .11, W - u * 8, u * .5); x.fillRect(u * 4, H * .14, W - u * 8, u * .25);
    txt(x, o.date ?? 'MORNING EDITION', u * 5, H * .125, { size: u * 2.3, weight: 600, align: 'left', color: ink }); txt(x, o.price ?? '50¢', W - u * 5, H * .125, { size: u * 2.3, weight: 600, align: 'right', color: ink });
    const hb = block(x, (o.headline ?? 'BIG NEWS TODAY').toUpperCase(), W / 2, H * .225, W * .9, H * .14, { size: u * 11, color: ink, lh: 1.02 });
    const hbox = [u * 4, H * .225 - (hb.lines.length * hb.lh) / 2, W - u * 8, hb.lines.length * hb.lh];
    let y = H * .31; if (o.sub) { const sb = block(x, o.sub, W / 2, y + u * 2.5, W * .86, u * 6, { size: u * 3.6, weight: 600, color: '#3a3836' }); var sbox = [u * 6, y, W - u * 12, u * 5.5]; y += u * 7; void sb; }
    for (const H2 of HL) { const k = E.outCubic(markK(t, H2.t, 7 * F)); if (k > 0) { x.save(); x.globalCompositeOperation = 'multiply'; highlight(x, H2.line === 'sub' && sbox ? sbox : hbox, k, H2.color ?? '#ffe14a'); x.restore(); } }
    const ph = H * .3; x.fillStyle = '#c9c4b8'; x.fillRect(u * 4, y, W * .58, ph); if (!picture(x, o, u * 4, y, W * .58, ph, 'cover')) PICS.globe(x, u * 4 + W * .29, y + ph / 2, ph * .8, {}); x.strokeStyle = ink; x.lineWidth = u * .3; x.strokeRect(u * 4, y, W * .58, ph);
    const R = rnd(o.seed ?? 3), line = (X, Y, ww) => { x.fillStyle = '#8f8a82'; x.fillRect(X, Y, ww, u * .9); };
    for (let yy = y; yy < y + ph; yy += u * 2.2) line(W * .64, yy, (W * .32) * (.6 + R() * .4));
    const cols = 3, cw = (W - u * 8 - u * 4) / cols; for (let c = 0; c < cols; c++) { const X = u * 4 + c * (cw + u * 2); let yy = y + ph + u * 3; x.fillStyle = ink; x.fillRect(X, yy, cw * .7, u * 1.6); yy += u * 3.5; for (; yy < H - u * 4; yy += u * 2.2) line(X, yy, cw * (.7 + R() * .3)); } };
  const sh = sheet(w, h, (x, W, H) => draw(x, W, H, -1e9), { paper, fix: 'none', thick: .01, ppm: 1900 });
  const g = new THREE.Group(), pivot = new THREE.Group(); pivot.add(sh.g); g.add(pivot);
  g.userData.face = sh.g.userData.face; g.userData.y0 = 1.4; g.userData.base = h / 2; g.userData.lw = .004;
  const hu = HL.length ? keyed(sh.tex, t => HL.map(H2 => Math.round(markK(t, H2.t, 7 * F) * 20)).join(','), draw) : null;
  const upd = t => { hu?.(t); if (o.spin != null) { const k = E.outCubic(seg(t, o.spin - 18 * F, o.spin)); pivot.visible = t >= o.spin - 18 * F; pivot.rotation.z = (1 - k) * TAU * 2; pivot.scale.setScalar(Math.max(1e-3, .05 + .95 * k)); } };
  return finish(S, g, 'newspaper', o, upd);
};

// ---------- book ----------
DOCS.book = "left / right: { title, text, draw, image } (the open spread), turn: { t, left, right } (a page turns and the next spread shows; the page lands ON the cue), w (open width), d (page height), color (cover); lies open facing up (rx tilts it)";
KINDS.book = (S, o) => {
  const g = new THREE.Group(), U = g.userData, W = o.w ?? .5, D = o.d ?? .34, hw = W / 2, pb = .028, cov = .012, col = o.color ?? '#8a2f2f';
  const curve = s => pb * (.35 + .65 * (1 - (1 - s) ** 2.4));
  const drawPage = (x, Wp, Hp, c, left) => { x.fillStyle = '#fbf6e8'; x.fillRect(0, 0, Wp, Hp); const sg = x.createLinearGradient(left ? Wp : 0, 0, left ? Wp * .8 : Wp * .2, 0); sg.addColorStop(0, 'rgba(90,60,20,.25)'); sg.addColorStop(1, 'rgba(90,60,20,0)'); x.fillStyle = sg; x.fillRect(0, 0, Wp, Hp);
    if (!c) return; const u = Wp / 100; let y = Hp * .1; if (c.title) { const b = block(x, c.title, Wp / 2, y + u * 5, Wp * .8, u * 14, { size: u * 9, color: '#2a1d17' }); y += b.lines.length * b.lh + u * 6; }
    if (c.draw || c.image) { const ph = c.text ? Hp * .35 : Hp * .6; picture(x, c, Wp * .14, y, Wp * .72, ph); y += ph + u * 4; }
    if (c.text) { font(x, u * 6.4, 600); const L = wrap(x, c.text, Wp * .78); L.forEach((l, i) => { if (y + i * u * 8.8 < Hp * .93) txt(x, l, Wp * .11, y + i * u * 8.8, { size: u * 6.4, weight: 600, align: 'left', color: '#3a2a1c' }); }); }
    else { const R = rnd(left ? 3 : 5); x.fillStyle = '#b7aa94'; for (let yy = y; yy < Hp * .9; yy += u * 5) x.fillRect(Wp * .11, yy, Wp * .78 * (.7 + R() * .3), u * 1.3); }
    txt(x, String(left ? (o.page ?? 42) : (o.page ?? 42) + 1), Wp / 2, Hp * .96, { size: u * 3, weight: 600, color: '#8a7a6a' }); };
  const PXw = 1024, PXh = Math.round(PXw * D / (hw * .96));
  const turn = o.turn, cur = { left: o.left, right: o.right }, nxt = turn ? { left: turn.left, right: turn.right } : null;
  const tex = side => canvasTex(PXw, PXh, (x, Wp, Hp) => drawPage(x, Wp, Hp, cur[side], side === 'left'));
  const texL = tex('left'), texR = tex('right');
  const pageGeo = (left) => { const gg = new THREE.PlaneGeometry(hw * .96, D * .96, 24, 1); const P = gg.attributes.position; for (let i = 0; i < P.count; i++) { const u = (P.getX(i) + hw * .48) / (hw * .96), s = left ? 1 - u : u; P.setXYZ(i, left ? -hw * .96 * (1 - u) : hw * .96 * u, curve(s) + .0012, -P.getY(i)); } gg.computeVertexNormals(); return gg; };
  // the page blocks: an extruded side profile with the curved top
  for (const sgn of [-1, 1]) { const bv = .004, prof = new THREE.Shape(); prof.moveTo(sgn * .002, .001); for (let i = 0; i <= 16; i++) { const s = i / 16; prof.lineTo(sgn * Math.max(.002, s * hw * .96 - bv), Math.max(.002, curve(s) - bv)); } prof.lineTo(sgn * (hw * .96 - bv), .001); prof.closePath();
    const blk = mesh(extrude(prof, D * .96 - 2 * bv, bv, 2, 4), mat('#f3ecd8'), { lw: .002 }); g.add(blk);
    const cv = box(hw, cov, D, .005, col); cv.position.set(sgn * hw / 2, -cov / 2, 0); g.add(cv); }
  g.add(rod([0, -cov * .6, -D / 2 + cov], [0, -cov * .6, D / 2 - cov], cov * .7, mat(shade(col, -.2))));
  const pL = new THREE.Mesh(pageGeo(true), paperMat(texL, { side: THREE.DoubleSide })), pR = new THREE.Mesh(pageGeo(false), paperMat(texR, { side: THREE.DoubleSide })); pL.userData.noOutline = pR.userData.noOutline = true; g.add(pL, pR);
  // the turning page: a strip of points bent as it swings over the spine
  let flip = null;
  if (turn) { const fT = canvasTex(PXw, PXh, (x, Wp, Hp) => drawPage(x, Wp, Hp, cur.right, false)), bT = canvasTex(PXw, PXh, (x, Wp, Hp) => { x.translate(Wp, 0); x.scale(-1, 1); drawPage(x, Wp, Hp, nxt.left, true); });
    const gg = new THREE.PlaneGeometry(hw * .96, D * .96, 24, 1); const front = new THREE.Mesh(gg, paperMat(fT)), back = new THREE.Mesh(gg, paperMat(bT, { side: THREE.BackSide })); front.userData.noOutline = back.userData.noOutline = true; g.add(front, back);
    const base = gg.attributes.position.array.slice();
    const setAngle = a => { const P = gg.attributes.position; for (let i = 0; i < P.count; i++) { const xx = base[i * 3] + hw * .48, s = xx / (hw * .96), zz = -base[i * 3 + 1]; const ang = a - .55 * Math.sin(a) * s, r = xx; P.setXYZ(i, Math.cos(ang) * r, curve(s) * (1 - Math.sin(a)) + Math.sin(ang) * r + .002, zz); } P.needsUpdate = true; gg.computeVertexNormals(); gg.computeBoundingSphere(); };
    flip = { front, back, setAngle, nxtR: () => redraw(texR, (x, Wp, Hp) => drawPage(x, Wp, Hp, nxt.right, false)), curR: () => redraw(texR, (x, Wp, Hp) => drawPage(x, Wp, Hp, cur.right, false)), nxtL: () => redraw(texL, (x, Wp, Hp) => drawPage(x, Wp, Hp, nxt.left, true)), curL: () => redraw(texL, (x, Wp, Hp) => drawPage(x, Wp, Hp, cur.left, true)), st: '' }; }
  U.face = { mesh: pR, tex: texR, w: hw * .96, h: D * .96 }; U.lw = .003; U.y0 = 0; U.base = cov;
  const upd = flip ? t => { const a0 = turn.t - 12 * F, k = seg(t, a0, turn.t), st = t < a0 ? 'before' : t >= turn.t ? 'after' : 'during';
    if (st !== flip.st) { flip.st = st; if (st === 'before') { flip.curR(); flip.curL(); } else if (st === 'during') { flip.nxtR(); flip.curL(); } else { flip.nxtR(); flip.nxtL(); } }
    flip.front.visible = flip.back.visible = st === 'during'; if (st === 'during') flip.setAngle(E.inOutSine(k) * PI); } : null;
  return finish(S, g, 'book', o, upd);
};

// ---------- magnifier ----------
DOCS.magnifier = "target: an info object with userData.face (poster, notice, document, newspaper, checklist, board, screen, calendar, book) | { mesh, tex, w, h }; zoom (2), r (lens radius m), path: [{ t, uv: [u, v] }, ...] (u, v 0..1 across the face; the lens lifts on an arc between keys and arrives ON each t) | from, to, t0, t1; hover (m), handle (angle rad); without a target: a standalone glass at `at` showing tex / text / draw";
KINDS.magnifier = (S, o) => {
  const g = new THREE.Group(), U = g.userData, r = o.r ?? .09, zoom = o.zoom ?? 2, tgt = o.target?.userData?.face ?? (o.target?.mesh ? o.target : null);
  const rim = mesh(torusGeo(r, r * .1), mat(o.rim ?? '#d9a441', { metal: .6, rough: .3 }), { lw: .0025 }); g.add(rim);
  const ha = o.handle ?? -PI * .28, hd = new THREE.Vector3(Math.cos(ha), Math.sin(ha), 0), p0 = hd.clone().multiplyScalar(r * 1.08), p1 = hd.clone().multiplyScalar(r * 1.45), p2 = hd.clone().multiplyScalar(r * 3.4);
  g.add(rod(p0, p1, r * .07, mat('#d9a441', { metal: .6, rough: .3 }), { lw: .002 }), rod(p1, p2, r * .12, mat(o.grip ?? '#2a1d17', { rough: .5 }), { lw: .002 }));
  let tc = null, lensMat;
  if (tgt) { tc = tgt.tex.clone(); tc.needsUpdate = true; tc.wrapS = tc.wrapT = THREE.ClampToEdgeWrapping; const tm = tgt.mesh.material;
    if (tm?.isMeshBasicMaterial) { lensMat = new THREE.MeshBasicMaterial({ map: tc, toneMapped: false }); lensMat.color.copy(tm.color); } else lensMat = new THREE.MeshStandardMaterial({ map: tc, roughness: .45 }); }
  else { const cont = o.tex ?? canvasTex(512, 512, (x, W) => { x.fillStyle = o.bg ?? '#f4ecda'; x.fillRect(0, 0, W, W); if (o.text) txt(x, o.text, W / 2, W / 2, { size: W * .3, maxW: W * .7 }); else picture(x, o, W * .15, W * .15, W * .7, W * .7); }); lensMat = new THREE.MeshStandardMaterial({ map: cont, roughness: .45 }); }
  const lens = new THREE.Mesh(new THREE.CircleGeometry(r * .97, 48), lensMat); lens.userData.noOutline = true; g.add(lens);
  const sheen = canvasTex(256, 256, (x, W) => { x.clearRect(0, 0, W, W); const gr = x.createRadialGradient(W / 2, W / 2, W * .3, W / 2, W / 2, W / 2); gr.addColorStop(0, 'rgba(180,220,255,0)'); gr.addColorStop(1, 'rgba(180,220,255,.35)'); x.fillStyle = gr; x.beginPath(); x.arc(W / 2, W / 2, W / 2, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.arc(W / 2, W / 2, W * .36, PI * 1.08, PI * 1.38); x.stroke(); });
  const sp = new THREE.Mesh(new THREE.CircleGeometry(r * .97, 48), new THREE.MeshBasicMaterial({ map: sheen, transparent: true, depthWrite: false, toneMapped: false })); sp.position.z = .0015; sp.userData.noOutline = true; sp.renderOrder = 3; g.add(sp);
  U.lw = .0025;
  const keys = o.path ? o.path.map(k => ({ t: k.t, uv: k.uv })) : o.from ? [{ t: o.t0 ?? S.t0, uv: o.from }, { t: o.t1 ?? (o.t0 ?? S.t0) + 14 * F, uv: o.to ?? o.from }] : [{ t: -1e9, uv: o.uv ?? [.5, .5] }];
  const hover = o.hover ?? .03;
  const uvAt = t => { let i = 0; while (i + 1 < keys.length && t >= keys[i + 1].t) i++; const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)]; if (a === b || t <= a.t) return { uv: a.uv, lift: 0 };
    const dur = Math.min(b.t - a.t, 14 * F), s = b.t - dur, k = E.inOutSine(seg(t, s, b.t)); return { uv: [lerp(a.uv[0], b.uv[0], k), lerp(a.uv[1], b.uv[1], k)], lift: Math.sin(PI * k) * r * .8 }; };
  let lastV = -1;
  const upd = t => { if (!tgt) return; const { uv, lift } = uvAt(t); g.position.set((uv[0] - .5) * tgt.w, (uv[1] - .5) * tgt.h, hover + lift);
    const du = 2 * r * .97 / (tgt.w * zoom), dv = 2 * r * .97 / (tgt.h * zoom); tc.repeat.set(du, dv); tc.offset.set(uv[0] - du / 2, uv[1] - dv / 2); if (tgt.tex.version !== lastV) { lastV = tgt.tex.version; tc.needsUpdate = true; } };
  if (tgt) { U.ownPlace = true; const gg = finish(S, g, 'magnifier', { ...o, add: false }, upd); tgt.mesh.add(gg); return gg; }
  return finish(S, g, 'magnifier', o, null);
};

// ---------- label3d ----------
DOCS.label3d = "text, point: an actor (its head) | Object3D | [x, y, z] (followed every frame), anchor: [x, y, z] offset added to the point, offset: [right, up] (m, camera space; default [.28, .3]; keepOnScreen: false stops it flipping sides at the frame edge), size (text height m, .1), color (card), textColor, in (dot pops, the leader draws out, the card pops ON the cue), out, onTop (drawn over everything)";
KINDS.label3d = (S, o) => {
  const g = new THREE.Group(), U = g.userData, text = String(o.text ?? 'LABEL'), size = o.size ?? .1;
  font(MC, 100); const tw = MC.measureText(text).width, PW = Math.round(tw + 110), PH = 170, bg = o.color ?? '#ffffff', fg = o.textColor ?? textOn(bg);
  const tex = canvasTex(PW, PH, (x, W, H) => { x.clearRect(0, 0, W, H); x.fillStyle = bg; rrPath(x, 8, 8, W - 16, H - 16, (H - 16) * .32); x.fill(); x.lineWidth = 11; x.strokeStyle = INK; x.stroke(); txt(x, text, W / 2, H / 2 + 5, { size: 100, color: fg }); });
  const ch = size * PH / 100 * .78, cw = ch * PW / PH, top = !!o.onTop;
  const cm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .2, toneMapped: false, depthTest: !top }); cm.color.setScalar(o.glow ?? 1);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), cm); card.userData.noOutline = true; card.renderOrder = top ? 20 : 2;
  const lm = new THREE.MeshBasicMaterial({ color: INK, depthTest: !top }); const lead = new THREE.Mesh(cylGeo, lm); lead.userData.noOutline = true; lead.renderOrder = top ? 19 : 1;
  const dm = new THREE.MeshBasicMaterial({ color: o.dot ?? '#ffffff', depthTest: !top }); const dot = new THREE.Mesh(sphereGeo(size * .12), dm); dot.userData.noOutline = true; dot.renderOrder = top ? 21 : 2;
  const ring = new THREE.Mesh(sphereGeo(size * .17), new THREE.MeshBasicMaterial({ color: INK, depthTest: !top, side: THREE.BackSide })); ring.renderOrder = top ? 20 : 1; ring.userData.noOutline = true; dot.add(ring); dot.renderOrder = 22;
  g.add(card, lead, dot); U.ownIn = true; U.ownPlace = true; U.lw = .002;
  const off = o.offset ?? [.28, .3], up = new THREE.Vector3(0, 1, 0);
  // the point: an actor's head (on its surface, toward the card and the camera), an object's box centre (or top), a point
  const pt = (c, R2, U2, sx) => { const P = o.point ?? o.to ?? [0, 1, 0]; let v;
    if (P.toon) { const R = P.toon.B.head; v = P.head(); const toCam = c.position.clone().sub(v).normalize(); v.addScaledVector(R2.clone().multiplyScalar(Math.sign(sx) * .55).addScaledVector(U2, .6).addScaledVector(toCam, .55).normalize(), R * 1.02); }
    else if (P.isObject3D) { const b = new THREE.Box3().setFromObject(P); v = b.getCenter(new THREE.Vector3()); if (o.top !== false) v.y = lerp(v.y, b.max.y, .7); }
    else v = V3(P); if (o.anchor) v.add(V3(o.anchor)); return v; };
  // keepOnScreen: when the card would leave the frame it goes to the other side of the point
  const sideX = (c, R2, U2) => { if (o.keepOnScreen === false) return off[0]; const P = pt(c, R2, U2, off[0]);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion), dist = Math.max(.1, P.clone().sub(c.position).dot(fwd)), half = dist * Math.tan(c.fov * PI / 360) * c.aspect, px = P.clone().project(c).x;
    const edges = ox => [px + (ox - cw * .55) / half, px + (ox + cw * .55) / half], fits = ox => { const [l, r] = edges(ox); return l >= -.95 && r <= .95; };
    let ox = off[0]; if (!fits(ox) && fits(-ox)) return -ox;                 // the other side fits: go there
    const [l, r] = edges(ox); if (l < -.95) ox += (-.95 - l) * half; else if (r > .95) ox -= (r - .95) * half;   // else slide it in
    return ox; };
  const upd = t => { const c = camAt(S, t), R2 = _v1.set(1, 0, 0).applyQuaternion(c.quaternion).clone(), U2 = _v2.set(0, 1, 0).applyQuaternion(c.quaternion).clone(); const ox = sideX(c, R2, U2), P = pt(c, R2, U2, ox); g.position.copy(P);
    const kd = o.in == null ? 1 : popK(t, o.in - 3 * F), kl = o.in == null ? 1 : E.outCubic(seg(t, o.in - 3 * F, o.in + F)), kc = o.in == null ? 1 : popK(t, o.in), ko = o.out == null ? 1 : outK(t, o.out);
    const cpos = new THREE.Vector3().addScaledVector(R2, ox).addScaledVector(U2, off[1]); card.position.copy(cpos); card.quaternion.copy(c.quaternion); card.scale.setScalar(Math.max(1e-3, kc * ko)); card.visible = kc * ko > 1e-3;
    const edge = Math.abs(ox) > cw * .3 ? cpos.clone().addScaledVector(R2, -Math.sign(ox) * cw / 2 * kc * ko) : cpos.clone().addScaledVector(U2, -Math.sign(off[1] || 1) * ch / 2 * kc * ko);
    const end = edge.multiplyScalar(kl * ko), L = end.length(); lead.visible = L > 1e-4; if (lead.visible) { lead.position.copy(end).multiplyScalar(.5); lead.quaternion.setFromUnitVectors(up, end.clone().normalize()); lead.scale.set(size * .035, L, size * .035); }
    dot.scale.setScalar(Math.max(1e-3, kd * ko)); dot.visible = kd * ko > 1e-3; g.visible = dot.visible || card.visible; };
  return finish(S, g, 'label3d', o, upd);
};

export function make(S, kind, o = {}) {
  const k = KINDS[kind];
  if (!k) { console.warn(`unknown info prop "${kind}" (lib/info.js: ${Object.keys(KINDS).join(', ')})`); return null; }
  return k(S, o);
}
export const infoKinds = () => Object.keys(KINDS).sort();

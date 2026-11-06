// The kit the world graphics are built from (lib/info.js and its helpers): a BOARD (a full-screen graphic laid out in
// design pixels of a 1920 x 1080 frame, 1 px = 5 mm in the world, so a static camera framing it 4.8 m tall shows it pixel
// for pixel and any camera move - push, tour, zoom-through - just works), GLOW LINES that draw on along their length
// (one ribbon mesh, one small shader: core + soft glow + reveal + dashes), PAINTED CARDS (a canvas painter -> a texture
// on a plane, repainted only when its text changes), TEXT CARDS, and per-object animations (pop, fade, stamp...) that
// are pure functions of the absolute time.
import { THREE, FPS, clamp, lerp, seg, E, canvasTex, easeFn } from '../core.js';
import * as P from './paint.js';

export const U = .005;                 // metres per design pixel on a board
const F = 1 / FPS;

// ---------- materials (own = freed with the shot) ----------
export function fmat(color = '#ffffff', o = {}) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: o.opaque ? false : true, opacity: o.opacity ?? 1, depthWrite: !!o.depth || !!o.opaque,
    depthTest: o.depthTest ?? true, side: THREE.DoubleSide, toneMapped: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, map: o.map || null, alphaTest: o.alphaTest ?? 0 });
  m.userData.own = true; m.userData.op0 = o.opacity ?? 1; return m;
}

// ---------- painted cards ----------
/** a plane wpx x hpx (design px; `unit` metres per px) showing paint(x, w, h, k) drawn on a canvas at `res` x. mesh.userData.repaint(fn?) */
export function paintCard(wpx, hpx, paint, o = {}) {
  const res = o.res ?? 1.5, cw = Math.max(2, Math.ceil(wpx * res)), ch = Math.max(2, Math.ceil(hpx * res)), unit = o.unit ?? U;
  let fn = paint;
  const draw = x => { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, ch); x.setTransform(res, 0, 0, res, 0, 0); fn(x, wpx, hpx, res); };
  const tex = canvasTex(cw, ch, draw, { mip: o.mip ?? true }); tex.userData.alpha = true;
  const geo = new THREE.PlaneGeometry(wpx * unit, hpx * unit);
  if (o.anchor === 'left') geo.translate(wpx * unit / 2, 0, 0); else if (o.anchor === 'right') geo.translate(-wpx * unit / 2, 0, 0);
  else if (o.anchor === 'top-left') geo.translate(wpx * unit / 2, -hpx * unit / 2, 0);
  const m = new THREE.Mesh(geo, o.opaque ? fmat('#ffffff', { map: tex, opaque: true }) : fmat('#ffffff', { map: tex, depth: o.depth, alphaTest: o.alphaTest }));
  m.userData.noPick = !!o.noPick; m.userData.px = [wpx, hpx];
  m.userData.repaint = f2 => { if (f2) fn = f2; draw(tex.userData.canvas.getContext('2d')); tex.needsUpdate = true; };
  return m;
}
const scratch = (() => { let c = null; return () => (c ??= document.createElement('canvas').getContext('2d')); })();
/** text as a card: st = paint.js text style ({ cap, w, fam, track, color, outline, glow, halo, shadow }); anchor 'center' | 'left' | 'right'
 *  (the cap's middle sits on the origin). o.text(newString) repaints (counters). */
export function textCard(str, st, o = {}) {
  const x0 = scratch(), maxStr = o.maxText ?? str, cap = st.cap ?? 30;
  const pad = Math.ceil(Math.max(st.glow ? st.glow[0] * 1.6 : 0, st.halo ? st.halo[0] * 2 : 0, st.outline ? st.outline[0] * 1.5 : 0, st.shadow ? st.shadow[2] * 1.5 + Math.abs(st.shadow[1]) : 0) + 4 + cap * .1);
  const w = Math.ceil(P.measure(x0, maxStr, st) + 2 * pad + (o.extraW ?? 0)), h = Math.ceil(cap * 1.75 + 2 * pad), base = pad + cap * 1.3;
  const al = st.align ?? o.anchor ?? 'center';
  let cur = String(str);
  const paint = (x, W) => P.drawText(x, cur, al === 'left' ? pad : al === 'right' ? W - pad : W / 2, base, { ...st, align: al === 'left' ? 'left' : al === 'right' ? 'right' : 'center' }, o.res ?? 1.5);
  const m = paintCard(w, h, paint, { ...o, anchor: al === 'left' ? 'left' : al === 'right' ? 'right' : 'center' });
  // put the cap middle on the origin (and the anchored edge at x = 0)
  const unit = o.unit ?? U; m.geometry.translate(al === 'left' ? -pad * unit : al === 'right' ? pad * unit : 0, (base - cap / 2 - h / 2) * unit, 0);
  m.userData.text = cur; m.userData.kind = 'text'; m.userData.size = [w, h];
  m.userData.setText = s => { s = String(s); if (s === cur) return; cur = s; m.userData.text = s; m.userData.repaint(); };
  return m;
}

// ---------- glow lines that draw on ----------
const LINE_VS = `attribute float aD; attribute float aS; varying float vD; varying float vS;
  void main(){ vD = aD; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const LINE_FS = `uniform vec3 uC, uG; uniform float uP, uP0, uTot, uHW, uHalo, uOp, uGlow, uDash, uGap, uDashOff; varying float vD; varying float vS;
  void main(){
    float d = vD; if (d > uP * uTot + .01 || d < uP0 * uTot - .01) discard;
    if (uDash > 0. && mod(d + uDashOff, uDash + uGap) > uDash) discard;
    float r = abs(vS) * (uHW + uHalo); float aa = max(fwidth(r), .35);
    float core = 1. - smoothstep(uHW - aa, uHW + aa, r);
    float g = uHalo > 0. ? uGlow * exp(-pow(max(r - uHW * .6, 0.) / (uHalo * .42), 2.)) : 0.;
    float a = max(core, g); if (a < .003) discard;
    gl_FragColor = vec4(mix(uG, uC, core / max(a, .001)), a * uOp); }`;
/** a stroke through pts ([[x, y], ...] design px) of width w px with a soft glow (halo px, glow 0..1), drawn up to
 *  userData.k (0..1). o: { color, glowColor, halo, glow, dash: [on, off], closed, unit, from }. Smooth joins (mitre capped). */
export function gline(pts, w = 3, o = {}) {
  if (o.closed) pts = [...pts, pts[0]];
  const unit = o.unit ?? U, hw = w / 2, halo = o.halo ?? 0, R = hw + halo, n = pts.length;
  const pos = [], aD = [], aS = [], idx = []; let tot = 0;
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; };
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (i) tot += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const n1 = i > 0 ? nrm(pts[i - 1], p) : nrm(p, pts[Math.min(n - 1, i + 1)]), n2 = i < n - 1 ? nrm(p, pts[i + 1]) : n1;
    let mx = n1[0] + n2[0], my = n1[1] + n2[1]; const ml = Math.hypot(mx, my);
    if (ml < 1e-4) { mx = n1[0]; my = n1[1]; } else { mx /= ml; my /= ml; }
    const len = R / Math.max(.5, mx * n1[0] + my * n1[1]);
    const nx = mx * len, ny = my * len;
    pos.push((p[0] + nx) * unit, -(p[1] + ny) * unit, 0, (p[0] - nx) * unit, -(p[1] - ny) * unit, 0);
    aD.push(tot, tot); aS.push(1, -1);
    if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  // round-ish caps: extend both ends by half a width
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aD', new THREE.Float32BufferAttribute(aD, 1)); g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1)); g.setIndex(idx);
  const col = new THREE.Color(o.color ?? '#e0b060'), gc = new THREE.Color(o.glowColor ?? o.color ?? '#e0b060');
  const m = new THREE.ShaderMaterial({ vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uC: { value: new THREE.Vector3(col.r, col.g, col.b) }, uG: { value: new THREE.Vector3(gc.r, gc.g, gc.b) }, uP: { value: o.k ?? 1 }, uP0: { value: 0 }, uTot: { value: tot }, uHW: { value: hw }, uHalo: { value: halo },
      uOp: { value: o.opacity ?? 1 }, uGlow: { value: o.glow ?? (halo ? .55 : 0) }, uDash: { value: o.dash ? o.dash[0] : 0 }, uGap: { value: o.dash ? o.dash[1] : 0 }, uDashOff: { value: 0 } } });
  m.userData.own = true; m.userData.op0 = o.opacity ?? 1;
  const mesh = new THREE.Mesh(g, m); mesh.userData.line = true; mesh.userData.length = tot; mesh.userData.noPick = true;
  mesh.userData.setK = (k, k0 = 0) => { m.uniforms.uP.value = k; m.uniforms.uP0.value = k0; };
  return mesh;
}
/** points of a circle / ellipse (design px), starting at angle a0 (radians, 0 = right, clockwise on screen) */
export const circlePts = (cx, cy, rx, ry = rx, n = 64, a0 = -Math.PI / 2, span = Math.PI * 2) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + span * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
/** a quadratic arc between two points bulging by `bend` (fraction of the length; + = up on screen) */
export function arcPts(a, b, bend = .25, n = 32) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const [nx, ny] = dx > 0 ? [dy / L, -dx / L] : [-dy / L, dx / L], cx = mx + nx * L * bend, cy = my + ny * L * bend;
  return Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]; });
}

// ---------- animation (pure functions of the absolute time) ----------
/** add an animation step to an object: fn(t, S, obj) runs every frame */
export function anim(obj, fn) { (obj.userData._an ??= []).push(fn); obj.userData.update = (t, S) => { for (const f of obj.userData._an) f(t, S, obj); }; return obj; }
/** opacity of every mesh under obj (line materials through their uniform); a <= 0 hides */
export function setAlpha(obj, a) {
  obj.visible = a > .002;
  obj.traverse(m => { if (!m.isMesh) return; const mt = m.material; if (!mt) return; const op0 = mt.userData.op0 ?? 1;
    if (mt.uniforms?.uOp) mt.uniforms.uOp.value = op0 * a; else { mt.opacity = op0 * a; if (a < 1 && !mt.transparent) { mt.transparent = true; mt.needsUpdate = true; } } });
}
const s0 = obj => (obj.userData.s0 ??= obj.scale.x);
/** pop in on a frame table (paint.js POP / POPBIG / SWAP / STAMP) at t0; until = hard cut (or fade out over o.out frames) */
export function popIn(obj, t0, table = P.POP, o = {}) {
  const b = s0(obj);
  return anim(obj, t => { let a, s; if (t0 < -1e8) { a = 1; s = 1; } else [a, s] = P.popAt(table, t, t0);
    if (o.until != null) { if (o.out) a *= P.fadeOut(t, o.until, o.out); else if (t >= o.until) a = 0; }
    setAlpha(obj, a); obj.scale.setScalar(b * Math.max(.001, s)); });
}
/** fade in over n frames (frame 0 = 1/n) */
export function fadeIn(obj, t0, n = 4, o = {}) {
  return anim(obj, t => { let a = t0 < -1e8 ? 1 : P.fadeIn(t, t0, n); if (o.until != null) a *= o.out ? P.fadeOut(t, o.until, o.out) : (t >= o.until ? 0 : 1); setAlpha(obj, a * (o.max ?? 1)); });
}
/** scale + fade from `from` scale over n frames (the title's 1.1 -> 1, a list item's .85 -> 1) */
export function growIn(obj, t0, n = 4, from = 1.1, ease = E.outCubic) {
  const b = s0(obj);
  return anim(obj, t => { const k = t0 < -1e8 ? 1 : clamp(((t - t0) * FPS + 1) / n); const e = ease(k); setAlpha(obj, k <= 0 ? 0 : Math.min(1, e * 1.05)); obj.scale.setScalar(b * lerp(from, 1, e)); });
}
/** draw a glow line on from t0 over `frames` (ease), optionally erase it from the start later (eraseAt) */
export function drawOn(line, t0, frames = 12, ease = 'inOutQuad', o = {}) {
  const ez = easeFn(ease);
  return anim(line, t => { const k = t0 < -1e8 ? 1 : ez(clamp((t - t0) * FPS / frames)); const k0 = o.eraseAt != null ? ez(clamp((t - o.eraseAt) * FPS / (o.eraseFrames ?? frames))) : 0;
    line.visible = k > 0 && k0 < 1; line.userData.setK(k, k0); if (o.fade) { const a = P.fadeIn(t, t0, o.fade); line.material.uniforms.uOp.value = (line.material.userData.op0 ?? 1) * a; } });
}
/** move an object from one board point to another between t0 and t0 + frames (ease) */
export function moveOn(obj, from, to, t0, frames, ease = 'inOutQuad') {
  const ez = easeFn(ease);
  return anim(obj, t => { const k = ez(clamp((t - t0) * FPS / frames)); obj.position.x = lerp(from[0], to[0], k); obj.position.y = lerp(from[1], to[1], k); });
}

// ---------- the board: a full-screen graphic in design pixels ----------
/**
 * makeBoard(S, { bg: [inner, outer] | '#hex' | null, pos: [x, y, z], floor: design-px y that sits on world y = 0, camera: true })
 *   -> B: { g, xy(x, y) local metres, put(obj, x, y) (adds in paint order), world(x, y) -> [x, y, z], view(x, y, h) -> camera spec,
 *          px(m) metres -> px }. The board centre (960, 540) is at g.position. A static camera frames it unless the shot has one.
 */
export function makeBoard(S, o = {}) {
  const g = new THREE.Group(); g.name = o.name || 'graphic'; g.userData.kind = o.kind || 'graphic'; g.userData.pickRoot = true;
  const pos = o.pos ?? [0, o.floor != null ? (o.floor - 540) * U : 0, 0]; g.position.set(pos[0], pos[1], pos[2] ?? 0);
  let order = o.order ?? 10, n = 0;
  const B = { g, S, U,
    xy: (x, y) => [(x - 960) * U, (540 - y) * U],
    world: (x, y, z = 0) => [g.position.x + (x - 960) * U, g.position.y + (540 - y) * U, g.position.z + z],
    view: (x = 960, y = 540, h = 960) => ({ on: B.world(x, y), frame: { h: h * U } }),
    put(obj, x = 960, y = 540, o2 = {}) { const [X, Y] = B.xy(x, y); obj.position.x += X; obj.position.y += Y; obj.position.z += (o2.z ?? 0) + (++n) * .0004;
      const ord = o2.order ?? order++; obj.traverse(m => { if (m.isMesh) m.renderOrder = ord; }); (o2.parent ?? g).add(obj); return obj; },
    /** add a glow line / anything whose geometry is already in absolute board px (gline points) */
    line(obj, o2 = {}) { return B.put(obj, 0, 0, o2); },
    order: () => order++,
  };
  if (o.bg !== null && o.bg !== false) {
    const [inner, outer] = Array.isArray(o.bg) ? o.bg : [o.bg ?? '#19264a', o.bgEdge ?? o.bg ?? '#0e152d'];
    const bw = o.bgW ?? 1920 * 1.6, bh = o.bgH ?? 1080 * 1.6;
    const bg = paintCard(bw / 4, bh / 4, (x, w, h) => { P.paintBackdrop(x, w, h, inner, outer, { r: o.bgR ?? .42 }); if (o.bgPaint) o.bgPaint(x, w, h); }, { res: 1, unit: U * 4, opaque: true, mip: false, noPick: true });
    bg.userData.ground = true; bg.position.z = -.002; bg.renderOrder = 0; g.add(bg); S.bg(outer); B.bg = bg;
  }
  if (!S._cam && o.camera !== false) S.camera('static', B.view(960, 540, o.frameH ?? 960));
  return B;
}
/** a camera tour over a board: keys [{ at: time | word, x, y, h (design px framed tall), ease }] -> S.camera('keys') */
export function tour(S, B, keys) {
  const K = keys.map(k => ({ t: P.when(S, k.at ?? k.word ?? S.t0, 0), ...B.view(k.x ?? 960, k.y ?? 540, k.h ?? 960), ease: k.ease ?? 'inOutCubic' }));
  return S.camera('keys', { keys: K, on: K[0]?.on });
}
void seg;

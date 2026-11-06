// Toon Studio engine - Flat explainer. Flat-vector explainer animation in Three.js (9:16 shorts or 16:9 videos):
// orthographic, unlit, exact flat colours, one light source (top-left) for all shading, rounded primitives, word-timed
// motion, dissolve transitions, word-highlight captions in a reserved band, film finish (grain + vignette).
// Coordinates: pixels, origin at the frame centre, y up. The frame is 1080 x 1920 (vertical) or 1920 x 1080 (landscape,
// project.json settings.format): use W, H, GY, BAND, ZONE and TITLE instead of numbers so scenes fit their format.
// Read the skill (.claude/skills/flat-explainer-video) before writing scenes: QUALITY_STANDARD and STYLE_GUIDE are law.
import * as THREE from 'three';
export { THREE };
export const VERT = globalThis.__CZ_SETTINGS?.format !== 'landscape';
export const W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080;
const hx = c => typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;   // '#rrggbb' or 0xrrggbb
// ---------- easing (measured against the source at 60 fps, see NOTES.md) ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const E = {
  lin: k => k,
  outCubic: k => 1 - Math.pow(1 - k, 3),
  inCubic: k => k * k * k,
  inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outQuint: k => 1 - Math.pow(1 - k, 5),
  inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2,
  outBack: (k, s = 1.9) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),
};
// pop-in: dot -> full size with one overshoot. Source: ~9 frames (0.15 s) to peak, settles by ~0.25 s.
// colour tint: k > 0 mixes toward white, k < 0 multiplies toward black (keeps hue; never mixes warm into cool)
export function tint(hex, k) {
  hex = hx(hex); const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const f = v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return (f(r) << 16) | (f(g) << 8) | f(b);
}
export const pop = (t, t0, d = 0.26) => (t < t0 ? 0 : E.outBack(seg(t, t0, t0 + d), 2.2));
// pop-out: fast ease-in shrink, source head->brain swap took 5 frames.
export const popOut = (t, t0, d = 0.09) => 1 - E.inCubic(seg(t, t0, t0 + d));
export const ease = (t, a, b, f = E.outCubic) => f(seg(t, a, b));

// ---------- palette (colour = meaning; see NOTES.md) ----------
// colour = meaning (dopamine/energy yellow, positive mint, warning pink...). '#hex' strings; every function accepts them.
export const C = {
  night: '#1c0f33', plum: '#2a0f52', violet: '#4a0a6e', purple: '#7b2cc7', lilac: '#a25cf0',
  pink: '#ff4fa3', magenta: '#e21ee8', mint: '#1ee8a0', teal: '#14b8b0', sky: '#2aa8ff', skyTop: '#2c5bff',
  yellow: '#ffcd1a', orange: '#ff8a1c', white: '#ffffff', ink: '#1b1238', cream: '#fff3c4',
  skin: '#f6b48c', skinShade: '#e8986f', hair: '#26306e', hairHi: '#3a46a0', shirt: '#ffb51f', pants: '#1f6f8b',
};

// ---------- primitives ----------
let order = 0;
function mat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: opts.opacity ?? 1, depthTest: false, depthWrite: false,
    side: THREE.DoubleSide, map: opts.map || null, clippingPlanes: opts.clip || null,
  });
}
// ---- element QA roles (see QUALITY_STANDARD.md). Every mesh records what it is:
//   'form'      builds the element's silhouette (default)
//   'detail'    shading, highlights, features: MUST lie inside the union of the element's form layers
//   'thickness' intentional depth below a sticker/card: allowed outside the form
//   'text'      glyph quads (ignored by the containment check)
let ROLE = 'form';
export function withRole(r, fn) { const prev = ROLE; ROLE = r; try { return fn(); } finally { ROLE = prev; } }
function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, mat(color, opts));
  m.renderOrder = order++;
  m.userData.role = ROLE;
  return m;
}
export function group(parent, x = 0, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  (parent || CUR_ROOT)?.add(g);
  return g;
}
const at = (parent, m, x, y) => { m.position.set(x || 0, y || 0, 0); (parent || CUR_ROOT).add(m); return m; };

export const circle = (p, r, color, x, y, o) => at(p, mesh(new THREE.CircleGeometry(r, Math.max(48, r | 0)), color, o), x, y);
export const ring = (p, r, w, color, x, y, o) => at(p, mesh(new THREE.RingGeometry(r - w / 2, r + w / 2, Math.max(64, r | 0)), color, o), x, y);
export const arc = (p, r, w, a0, a1, color, x, y, o) =>
  at(p, mesh(new THREE.RingGeometry(r - w / 2, r + w / 2, 48, 1, a0, a1 - a0), color, o), x, y);

export function rrShape(w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// outline helpers (moved from kit.js in V4.2): shading must be cut from these, never laid loose on top
// capsule outline (rounded rect with r = h/2 possible), centre (cx, cy), CCW
export function capsulePts(w, h, r, cx = 0, cy = 0, n = 16) {
  const pts = [], hw = w / 2 - r, hh = h / 2 - r;
  [[hw, hh, 0], [-hw, hh, Math.PI / 2], [-hw, -hh, Math.PI], [hw, -hh, Math.PI * 1.5]].forEach(([x, y, a0]) => {
    for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; pts.push([cx + x + Math.cos(a) * r, cy + y + Math.sin(a) * r]); } });
  return pts;
}
// clip a convex polygon by half-planes [a, b, c]: keeps a*x + b*y + c >= 0 (Sutherland-Hodgman)
export function clipPts(pts, ...planes) {
  for (const [a, b, c] of planes) {
    const out = [], f = ([x, y]) => a * x + b * y + c;
    pts.forEach((P, i) => { const Q = pts[(i + 1) % pts.length], fp = f(P), fq = f(Q);
      if (fp >= 0) out.push(P);
      if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); } });
    pts = out;
  }
  return pts;
}


export function circlePts(r, cx = 0, cy = 0, n = 48) { const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; }
export const shiftPts = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
export const rotPts = (pts, a, cx = 0, cy = 0) => pts.map(([x, y]) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
// convex CCW polygon -> half-planes [a, b, c] (inside: a*x + b*y + c >= 0)
export function planesOf(pts) { return pts.map((P, i) => { const Q = pts[(i + 1) % pts.length], a = -(Q[1] - P[1]), b = Q[0] - P[0]; return [a, b, -(a * P[0] + b * P[1])]; }); }
// THE shading primitive (QUALITY_STANDARD.md §2). A form = union of convex CCW pieces.
//   shade = the whole form in a darker tint            (role 'form': defines the silhouette)
//   lit   = form ∩ (form shifted s px toward top-left)  (role 'detail': provably inside the form)
// computed as the union over pieces of  A_i ∩ shift(A_j).  Every procedural element shades with this, so the light
// direction, the band width and the containment are identical everywhere.
export function shaded(p, pieces, color, { s = 6, k = -0.2, x = 0, y = 0 } = {}) {
  if (typeof pieces[0][0] === 'number') pieces = [pieces];
  const g = group(p, x, y);
  pieces.forEach(pc => poly(g, pc, tint(color, k)));
  withRole('detail', () => pieces.forEach(a => pieces.forEach(b => { const c = clipPts(a, ...planesOf(shiftPts(b, -s, s))); if (c.length > 2) poly(g, c, color); })));
  return g;
}
export function starPieces(R = 50, r = 22) {
  const P = (rad, deg) => [Math.cos(deg * Math.PI / 180) * rad, Math.sin(deg * Math.PI / 180) * rad];
  const inner = [0, 1, 2, 3, 4].map(k => P(r, 126 + 72 * k));
  return [inner, ...[0, 1, 2, 3, 4].map(k => [P(r, 54 + 72 * k), P(R, 90 + 72 * k), P(r, 126 + 72 * k)])];
}

export const rrect = (p, w, h, r, color, x, y, o) => at(p, mesh(new THREE.ShapeGeometry(rrShape(w, h, r), 24), color, o), x, y);
// rounded-rect outline (border) = outer minus inner
export function rrOutline(p, w, h, r, bw, color, x, y, o) {
  const s = rrShape(w + bw, h + bw, r + bw / 2);
  s.holes.push(rrShape(w - bw, h - bw, Math.max(0, r - bw / 2)));
  return at(p, mesh(new THREE.ShapeGeometry(s, 24), color, o), x, y);
}
// capsule between two points (thick round-capped line); origin at a
export function stick(p, x1, y1, x2, y2, w, color, o) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const g = group(p, x1, y1);
  g.rotation.z = Math.atan2(y2 - y1, x2 - x1);
  const m = rrect(g, len + w, w, w / 2, color, len / 2, 0, o);
  g.userData.bar = m; g.userData.len = len; g.userData.w = w;
  return g;
}
// grow a stick from its start: k in 0..1
export function stickGrow(st, k) {
  const { bar, len, w } = st.userData;
  const L = Math.max(0.0001, len * k);
  bar.scale.x = (L + w) / (len + w);
  bar.position.x = L / 2;
  st.visible = k > 0.001;
}
export function poly(p, pts, color, x, y, o) {
  const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  return at(p, mesh(new THREE.ShapeGeometry(s), color, o), x, y);
}
// smooth closed blob through points (Catmull-Rom) - for organic shapes (neurons, hair)
export function blob(p, pts, color, x, y, o) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([a, b]) => new THREE.Vector3(a, b, 0)), true, 'centripetal');
  const s = new THREE.Shape(curve.getPoints(pts.length * 16).map(v => new THREE.Vector2(v.x, v.y)));
  return at(p, mesh(new THREE.ShapeGeometry(s), color, o), x, y);
}
export function gradientBg(p, top, bottom, w = W, h = H) {
  const geo = new THREE.PlaneGeometry(w, h);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { a: { value: new THREE.Color(top) }, b: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 a; uniform vec3 b; varying vec2 v; void main(){ gl_FragColor=vec4(mix(b,a,smoothstep(0.,1.,v.y)),1.); }',
    depthTest: false, depthWrite: false,
  }));
  m.renderOrder = order++;
  (p || CUR_ROOT).add(m);
  return m;
}

// ---------- stencil masks (zoom-inset bubbles) ----------
// maskCircle writes `ref` into the stencil (invisible); useMask makes everything already inside `g` draw only there.
export function maskCircle(p, r, ref = 1, x = 0, y = 0) {
  const m = circle(p, r, 0xffffff, x, y);
  Object.assign(m.material, { colorWrite: false, stencilWrite: true, stencilRef: ref,
    stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
  m.userData.isMask = true;
  return m;
}
export function useMask(g, ref = 1) {
  g.traverse(o => {
    if (!o.material || o.userData.isMask) return;
    Object.assign(o.material, { stencilWrite: true, stencilRef: ref, stencilFunc: THREE.EqualStencilFunc,
      stencilZPass: THREE.KeepStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp });
  });
}

// ---------- text (canvas texture; 2x supersampled so it stays crisp) ----------
export const FONT = 'Inter';
export const FONT_FILES = [['Inter', 'fonts/inter-800.woff2', '800', 'normal'], ['Inter', 'fonts/inter-600.woff2', '600', 'normal']];
export function text(p, str, { size = 48, weight = 800, color = '#ffffff', stroke = null, strokeW = 0, align = 'center',
  lineH = 1.12, x = 0, y = 0, tracking = 0, clip } = {}) {
  const SS = 2, lines = String(str).split('\n'); if (typeof color === 'number') color = '#' + color.toString(16).padStart(6, '0'); if (typeof stroke === 'number') stroke = '#' + stroke.toString(16).padStart(6, '0');
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `${weight} ${size * SS}px ${FONT}`;
  g.font = font;
  if (tracking) g.letterSpacing = `${tracking * SS}px`;
  const pad = (strokeW + 6) * SS;
  const tw = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width))) + pad * 2;
  const th = Math.ceil(lines.length * size * lineH * SS) + pad * 2;
  c.width = tw; c.height = th;
  g.font = font; if (tracking) g.letterSpacing = `${tracking * SS}px`;
  g.textBaseline = 'middle'; g.textAlign = align; g.lineJoin = 'round';
  const ax = align === 'center' ? tw / 2 : align === 'left' ? pad : tw - pad;
  lines.forEach((l, i) => {
    const ly = pad + (i + 0.5) * size * lineH * SS + size * 0.04 * SS;
    if (stroke && strokeW) { g.strokeStyle = stroke; g.lineWidth = strokeW * 2 * SS; g.strokeText(l, ax, ly); }
    g.fillStyle = color; g.fillText(l, ax, ly);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const m = mesh(new THREE.PlaneGeometry(tw / SS, th / SS), 0xffffff, { map: tex, clip });
  const off = align === 'center' ? 0 : align === 'left' ? tw / SS / 2 - pad / SS : -(tw / SS / 2 - pad / SS);
  m.position.set(x + off, y, 0);
  (p || CUR_ROOT).add(m);
  m.userData.w = tw / SS - (pad * 2) / SS; m.userData.role = 'text'; m.userData.size = size;
  return m;
}

// pill tag (label) with left/right wipe reveal via a clipping plane
export function tag(p, str, { fill = BRAND.on ? BRAND.color : C.yellow, color = BRAND.on && fill === BRAND.color ? BRAND.ink : '#1b1238', size = 30, x = 0, y = 0, padX = 22, padY = 10, r } = {}) {
  const g = group(p, x, y);
  const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e5);
  const t = text(g, str, { size, color, clip: [plane] });
  const lines = String(str).split('\n').length;
  const w = t.userData.w + padX * 2, h = size * 1.12 * lines + padY * 2;
  const rr = r ?? Math.min(h / 2, 30);
  // V3: solid "thickness" under every tag (a darker tint of its own fill, 6 px down) = reads as a physical sticker
  withRole('thickness', () => rrect(g, w, h, rr, tint(fill, -0.32), 0, -Math.max(5, size * 0.12), { clip: [plane] }));
  const bg = rrect(g, w, h, rr, fill, 0, 0, { clip: [plane] });
  t.renderOrder = order++;
  g.userData = { plane, w, h };
  return g;
}
// k: 0..1 reveal from `from` side ('left' reveals left->right)
export function wipe(tg, k, from = 'left') {
  const { plane, w } = tg.userData;
  tg.updateMatrixWorld(true);
  const wp = new THREE.Vector3(); tg.getWorldPosition(wp);
  const s = tg.getWorldScale(new THREE.Vector3()).x;
  if (from === 'left') { plane.normal.set(-1, 0, 0); plane.constant = wp.x - w * s / 2 + w * s * k; }
  else { plane.normal.set(1, 0, 0); plane.constant = -(wp.x + w * s / 2 - w * s * k); }
  tg.visible = k > 0.001;
}

// ---------- particles: radial dotted rays (the "dopamine burst") ----------
// rays of dots that travel outward and fade; deterministic from seed
export function burst(p, { rays = 14, dots = 4, r0 = 150, r1 = 330, color = C.yellow, size = 7, seed = 1 } = {}) {
  const g = group(p);
  const items = [];
  let s = seed * 9301;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + rnd() * 0.25;
    const off = rnd() * 0.3;
    for (let j = 0; j < dots; j++) {
      const d = circle(g, size * (1 - j * 0.12), j % 3 === 2 ? C.orange : color);
      items.push({ d, a, j, off });
    }
  }
  g.userData.items = items; g.userData.r0 = r0; g.userData.r1 = r1;
  return g;
}
// k: 0..1 life of the burst
export function burstAt(b, k) {
  const { items, r0, r1 } = b.userData;
  b.visible = k > 0 && k < 1;
  for (const it of items) {
    const kk = clamp(k * 1.15 - it.off * 0.3);
    const r = lerp(r0, r1, E.outCubic(kk)) + it.j * 26 * (0.6 + 0.4 * kk);
    it.d.position.set(Math.cos(it.a) * r, Math.sin(it.a) * r, 0);
    it.d.material.opacity = clamp(1 - Math.pow(kk, 3)) * clamp(kk * 6);
  }
}

// ---------- captions ----------
// chunks of 1-3 words, broken at pauses > 0.22 s or punctuation (source shows ~2-3 words per card). Words written without
// spaces (Japanese, Chinese, Thai: "ns" in the timeline) sit together, up to 6 on a card; a Chinese or Japanese character
// counts as two letters of width (v6)
const wideLen = s => [...s].reduce((n, c) => n + (/[ᄀ-ᇿ⺀-鿿가-퟿豈-﫿＀-￯]/u.test(c) ? 2 : 1), 0);
const joinWords = ws => ws.map((x, i) => x.word + (x.ns || i === ws.length - 1 ? '' : ' ')).join('');
export function chunkWords(words, maxLen = VERT ? 24 : 34) {
  const out = []; let cur = null;
  words.forEach((w, i) => {
    const gap = cur ? w.start - cur.end : 0;
    const prev = cur && cur.words[cur.words.length - 1];
    const len = cur ? wideLen(joinWords(cur.words)) + (prev.ns ? 0 : 1) + wideLen(w.word) : 0;
    const brk = !cur || cur.words.length >= (prev.ns ? 6 : 3) || len > maxLen || gap > 0.22 || /[.,?!、。，！？]$/.test(prev.word); // 24 chars ~ 900 px at 56 px
    if (brk) { cur = { start: w.start, end: w.end, words: [w] }; out.push(cur); }
    else { cur.words.push(w); cur.end = w.end; }
  });
  out.forEach((c, i) => { c.text = joinWords(c.words); c.until = out[i + 1] ? out[i + 1].start : c.end + 0.6; });
  return out;
}

// =====================================================================================================================
// finishing systems (one light top-left, shaded balls, landing lines, depth, grain, captions)
// =====================================================================================================================

// ---- crescent: the part of circle(0,0,r) NOT covered by the same circle shifted by (-d, +d) (toward the light)
export function crescentShape(r, d) {
  const N = 64, pts = [];
  const D = d * Math.SQRT2, h = Math.sqrt(Math.max(0, r * r - (D / 2) ** 2));
  const mx = -d / 2, my = d / 2, vx = Math.SQRT1_2, vy = Math.SQRT1_2;
  const P1 = [mx + h * vx, my + h * vy], P2 = [mx - h * vx, my - h * vy];
  const ang = (p, c) => Math.atan2(p[1] - c[1], p[0] - c[0]);
  const arc = (c, a0, a1, through) => { // walk from a0 to a1 in the direction that passes `through`
    const norm = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const ccw = norm(a1 - a0), passes = norm(through - a0) < ccw;
    const span = passes ? ccw : -(2 * Math.PI - ccw);
    for (let i = 0; i <= N; i++) { const a = a0 + span * (i / N); pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
  };
  const A = [0, 0], B = [-d, d], dark = -Math.PI / 4;
  arc(A, ang(P1, A), ang(P2, A), dark);       // outer edge, through bottom-right
  arc(B, ang(P2, B), ang(P1, B), dark);       // inner edge (the lit circle's rim), back
  return pts;
}
export function crescent(p, r, d, color, x = 0, y = 0) { const m = withRole('detail', () => poly(p, crescentShape(r, d), color)); m.position.set(x, y, 0); return m; }

// shaded ball: base, bottom-right crescent shade, top-left specular dot
export function ball(p, r, color, { x = 0, y = 0, shade = -0.22, d = 0.24, spec = true } = {}) {
  const g = group(p, x, y);
  circle(g, r, color);
  crescent(g, r, r * d, tint(color, shade));
  if (spec) withRole('detail', () => { const s = circle(g, r * 0.2, tint(color, 0.6), -r * 0.38, r * 0.4); s.scale.y = 0.75; s.rotation.z = 0.6; });
  return g;
}
// dopamine: the film's recurring actor. Shaded yellow ball (V2 had a flat dot with an orange core).
export function dopa(p, r = 18) { return ball(p, r, C.yellow, { shade: -0.18, d: 0.26 }); }

// slab: a rounded card with thickness below and a 1-px-feel top highlight band
export function slab(p, w, h, r, color, { x = 0, y = 0, depth = 14, hi = true } = {}) {
  const g = group(p, x, y);
  withRole('thickness', () => rrect(g, w, h, r, tint(color, -0.28), 0, -depth));
  rrect(g, w, h, r, color);
  if (hi) withRole('detail', () => rrect(g, w - r * 1.2, 6, 3, tint(color, 0.35), 0, h / 2 - 12));
  return g;
}

// ---- lines that LAND: grow with ease-out, then the end cap pops (1.35x -> 1) and three ticks flick out
export function line(p, x1, y1, x2, y2, w, color, { cap = true, ticks = true } = {}) {
  const g = group(p);
  const st = stick(g, x1, y1, x2, y2, w, color);
  const c = cap ? circle(g, w * 0.95, color, x2, y2) : null;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const tk = ticks ? [-0.9, 0, 0.9].map(o => { const s = group(g, x2, y2); s.rotation.z = a + o; rrect(s, 14, 5, 2.5, tint(color, 0.3), 0, 0); return s; }) : [];
  // k: grow progress 0..1 (caller eases); tl: seconds since landing (negative = not yet)
  g.userData.set = (k, tl) => {
    stickGrow(st, k);
    if (c) { c.visible = tl >= 0; const s = tl >= 0 ? 1 + 0.35 * Math.max(0, 1 - tl / 0.18) * Math.sin(Math.min(1, tl / 0.18) * Math.PI) : 0; c.scale.setScalar(Math.max(0.001, s)); }
    tk.forEach(s => { const q = clamp(tl / 0.22); s.visible = tl >= 0 && q < 1; const r = w * 1.2 + 26 * E.outCubic(q); s.children[0].position.x = r; s.children[0].scale.x = 1 - q; });
  };
  return g;
}

// ---- depth: big soft "bokeh" discs in a slightly lighter tone of the LOCAL background colour, with parallax
export function bokeh(p, top, bottom, { n = 7, seed = 5, k = 0.07 } = {}) {
  let s = seed * 7919; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const mix = (a, b, f) => { const c1 = new THREE.Color(a), c2 = new THREE.Color(b); return c1.lerp(c2, f).getHex(); };
  const items = [];
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * W * 1.1, y = (r() - 0.5) * H * 0.95, rad = 60 + r() * 110; // V3 r2: smaller
    const local = mix(bottom, top, (y / H) + 0.5);
    items.push({ m: circle(p, rad, tint(local, k), x, y), x, y, ph: r() * 6, sp: 0.15 + r() * 0.25 });
  }
  return t => items.forEach(it => it.m.position.set(it.x + Math.sin(t * it.sp + it.ph) * 18, it.y + Math.cos(t * it.sp * 0.8 + it.ph) * 14, 0));
}

// ---- film finish: vignette (black alpha, neutral) + monochrome grain (white/black alpha), deterministic per frame
export function finish(root) {
  const mk = frag => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({
      uniforms: { seed: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: frag,
    }));
    m.renderOrder = 1e6; root.add(m); return m;
  };
  const vig = mk(`varying vec2 v; void main(){ vec2 q=(v-.5)*vec2(${VERT ? '1.,1.6' : '1.6,1.'}); float d=length(q); gl_FragColor=vec4(0.,0.,0.,smoothstep(.55,1.1,d)*${(+(SETTINGS.post?.vignette ?? .16)).toFixed(3)}); }`);   // V3 r2: .32 turned orange corners brown
  const grain = mk(`uniform float seed; varying vec2 v;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed*0.731) * 43758.5453); }
    void main(){ float n = h(floor(v*vec2(${W}.,${H}.))) - .5; gl_FragColor = vec4(vec3(step(0., n)), abs(n)*${(+(SETTINGS.post?.grain ?? .07)).toFixed(3)}); }`);
  grain.renderOrder = 1e6 + 1;
  vig.visible = (SETTINGS.post?.vignette ?? .16) > 0; grain.visible = (SETTINGS.post?.grain ?? .07) > 0;
  return t => { grain.material.uniforms.seed.value = Math.floor(t * 60) % 997; };
}

// squash-and-stretch pop: returns [sx, sy]. Stretch on the way up, squash on the overshoot, settle.
export function popSq(t, t0, d = 0.3) {
  if (t < t0) return [0.0001, 0.0001];
  const k = seg(t, t0, t0 + d), s = E.outBack(k, 2.2);
  const wob = Math.sin(k * Math.PI * 2) * (1 - k) * 0.14;
  return [Math.max(0.0001, s * (1 - wob)), Math.max(0.0001, s * (1 + wob))];
}
export const applySq = (o, [sx, sy], base = 1) => o.scale.set(sx * base, sy * base, 1);

// ---- captions with the active word highlighted (the word being spoken turns yellow and lifts 4 px)
export function captions(root, chunks, { y = -610, size = 56 } = {}) {
  const layer = group(root);
  const space = size * 0.27;
  const built = chunks.map(c => {
    const g = group(layer, 0, y); g.visible = false;
    const words = c.words.map(w => ({ w, white: text(g, w.word, { size, color: '#ffffff', stroke: '#1b1238', strokeW: 7 }),
      yel: text(g, w.word, { size, color: BRAND.caption, stroke: '#1b1238', strokeW: 7 }) }));   // (v7: the brand colour when set)
    // (no space after a word written without spaces: Japanese, Chinese, Thai)
    const total = words.reduce((a, o, i) => a + o.white.userData.w + (i < words.length - 1 && !o.w.ns ? space : 0), 0);
    let x = -total / 2;
    words.forEach(o => { const cx = x + o.white.userData.w / 2; o.white.position.x = cx; o.yel.position.x = cx; o.cx = cx; x += o.white.userData.w + (o.w.ns ? 0 : space); });
    // a card wider than the frame's safe width is drawn smaller: one long word ("Kraftfahrzeughaftpflichtversicherung", 36
    // letters in a German 9:16 video) ran off both edges, and the card breaks only between words
    const fit = Math.min(1, (W - 2 * (VERT ? 90 : 160)) / total);
    return { ...c, g, words, fit };
  });
  return t => built.forEach(c => {
    const on = t >= c.start - 0.03 && t < c.until - 0.04; c.g.visible = on; if (!on) return;
    const k = seg(t, c.start - 0.03, c.start + 0.15);
    c.g.scale.setScalar((0.9 + 0.1 * E.outBack(k, 2)) * c.fit); c.g.position.y = y - 14 * (1 - E.outCubic(k));
    c.words.forEach((o, i) => {
      const next = c.words[i + 1]?.w.start ?? c.until;
      const act = t >= o.w.start - 0.02 && t < next - 0.02;
      const ak = act ? E.outCubic(seg(t, o.w.start - 0.02, o.w.start + 0.1)) : 0;
      // V4: no colour snap. White stays; the yellow copy fades in over 5 frames and out over 5 frames.
      const a = clamp((t - (o.w.start - 0.02)) / 0.08) * (1 - clamp((t - (next - 0.02)) / 0.08));
      o.white.visible = true; o.yel.visible = a > 0.001; o.yel.material.opacity = a;
      o.yel.position.y = 4 * E.outCubic(a); o.yel.scale.setScalar(1 + 0.06 * E.outCubic(a));
    });
  });
}

// =====================================================================================================================
// Toon Studio app layer: shots, motion, camera, transitions, captions, finish, export, sound events, layout check
// =====================================================================================================================
export const ENGINE_KIND = 'flat';
export const ENGINE_VERSION = 7;                // bump when the Suite ships engine changes (projects get an Update button)
// the Suite's live preview on a slow computer (host.js sets __CZ_PREVIEW_SCALE, never for exports or stills): the frame
// is drawn at this scale and the page enlarges it. FW/FH/W/H do not change.
export const PREVIEW_SCALE = Math.min(1, Math.max(.25, +globalThis.__CZ_PREVIEW_SCALE || 1));
export const DEFAULTS = {
  format: 'vertical',                            // 'vertical' 1080 x 1920 | 'landscape' 1920 x 1080 (set when the project is created)
  captions: { on: true, size: 56 },              // word-highlight captions in the reserved band (BAND)
  post: { grain: .07, vignette: .16 },           // film finish: faint monochrome grain, soft neutral vignette (<= .16!)
  transitions: { duration: .42 },                // seconds, centred on every cut (dissolve with drift)
  camera: { push: .05, punch: .03 },             // slow push-in over each shot; extra zoom that eases out at the cut
};
const merge = (a, b) => { const o = { ...a }; for (const k in b || {}) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; };
export const SETTINGS = merge(DEFAULTS, globalThis.__CZ_SETTINGS || {});
// ---------- brand colour (v7) ----------
// settings.brand.color ('#rrggbb', the Suite's "Brand colour" look setting); unset = the style's own accents. Set: the
// spoken caption word (BRAND.caption, readable against the caption outline) and tag()'s default fill (text BRAND.ink)
// use it, and C.brand is there for title / chapter cards, highlights, lower thirds and the end card. Unset, C.brand is
// C.yellow (the style's accent). contrast / legibleOn / textOn: WCAG helpers for scenes.
const _rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const _lum = h => { const [r, g, b] = _rgb(h).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const _mix = (a, b, k) => '#' + _rgb(a).map((c, i) => Math.round((c + (_rgb(b)[i] - c) * k) * 255).toString(16).padStart(2, '0')).join('');
export const contrast = (a, b) => { const x = _lum(a), y = _lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
export const legibleOn = (c, bg, min = 3) => { const to = contrast('#ffffff', bg) > contrast('#000000', bg) ? '#ffffff' : '#000000';
  for (let k = 0; k <= 1.001; k += .05) { const o = k ? _mix(c, to, Math.min(1, k)) : c; if (contrast(o, bg) >= min) return o; } return to; };
export const textOn = c => contrast('#ffffff', c) >= contrast('#1b1238', c) ? '#ffffff' : '#1b1238';
const _brand = typeof SETTINGS.brand?.color === 'string' && /^#[0-9a-f]{6}$/i.test(SETTINGS.brand.color) ? SETTINGS.brand.color.toLowerCase() : null;
export const BRAND = { on: !!_brand, color: _brand ?? C.yellow, ink: textOn(_brand ?? C.yellow), caption: _brand ? legibleOn(_brand, '#1b1238', 3) : '#ffd23d' };
C.brand = BRAND.color; C.brandInk = BRAND.ink;
export const FW = W, FH = H, AW = FW, AH = FH;
// layout per format. Vertical: tall content zone above a caption band raised clear of the phone UI.
// Landscape: a wide stage; the band sits just above the player controls, the ground line lower in the frame.
export const GY = VERT ? -420 : -300;                              // ground line: feet stand here
export const BAND = VERT ? { y0: -700, y1: -520 } : { y0: -490, y1: -380 };   // caption band: nothing important may sit here
export const ZONE = VERT ? { x0: -540, x1: 540, y0: -420, y1: 880 } : { x0: -960, x1: 960, y0: -300, y1: 480 };   // where the content goes
export const TITLE = VERT ? { y: 640, maxW: 920, top: 120 } : { y: 400, maxW: 1500, top: 80 };                  // title() defaults
const FOCUS = VERT ? [0, 150] : [0, 90];                            // default camera push target
export const SUITE = { module: null, pick: null, base: '' };
function caller() {
  const st = (new Error().stack || '').split('\n');
  for (const l of st) {
    if (l.includes('/engine.js') || l.includes('/models.js')) continue;
    const m = l.match(/((?:scenes\/)?[\w.-]+\.js):(\d+):\d+/);
    if (m && !m[1].startsWith('host')) return { file: m[1], line: +m[2] };
  }
  return null;
}
export const PICKABLE = o => o.isMesh && !o.userData.noPick && o.userData.role !== 'text-bg';

// ---------- timeline / cue ----------
let PHRASES = [], WORDS = [];
// any alphabet, without case or accents: cue('transcripcion') finds "Transcripción," in a Spanish narration (v4)
const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
export async function loadTimeline(url) {
  PHRASES = await (await fetch(url)).json();
  WORDS = PHRASES.flatMap((p, pi) => p.words.map(w => ({ ...w, n: norm(w.w), pi })));
  CAPS = null;
}
// time the spoken word(s) start (which='e': end), searching the occurrence nearest to `near` seconds
export function cue(word, near, which = 's') {
  const parts = word.split(' ').map(norm);                      // ("flash / RAM": the "/" matches the timeline's "/")
  if (!parts.some(Boolean)) { console.warn('cue miss', word, near); return near; }   // ("—" alone matched every word)
  let best = null, bd = 1e9;
  for (let i = 0; i < WORDS.length; i++) {
    if (!parts.every((p, k) => WORDS[i + k] && WORDS[i + k].n.startsWith(p))) continue;
    const d = Math.abs(WORDS[i].s - near);
    if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[i + parts.length - 1].e; }
  }
  // a cue in a language written without spaces (Japanese, Chinese, Thai) may span several timed words ("東京タワー" is timed
  // as "東京" + "タワー"): the words' letters are joined until they hold it (v6)
  if (best === null && parts.length === 1 && parts[0]) for (let i = 0; i < WORDS.length; i++) {
    let s = '', k = i; while (k < WORDS.length && s.length < parts[0].length) s += WORDS[k++].n;
    if (!s.startsWith(parts[0])) continue;
    const d = Math.abs(WORDS[i].s - near); if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[k - 1].e; }
  }
  if (best === null || bd > 12) { console.warn('cue miss', word, near); return near; }
  return best;
}
export const IMG = {};
export async function loadImages(map) {
  await Promise.all(Object.entries(map).map(([k, src]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = src; })));
}

// ---------- renderer ----------
THREE.ColorManagement.enabled = false;                            // hex in = hex out (flat colours stay exact)
export const glCanvas = document.createElement('canvas');
export const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, stencil: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(Math.round(FW * PREVIEW_SCALE), Math.round(FH * PREVIEW_SCALE), false);
renderer.localClippingEnabled = true;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;           // no output encoding (SRGB here washes every colour out)
export const outCanvas = glCanvas;
const mkRT = () => new THREE.WebGLRenderTarget(Math.round(FW * PREVIEW_SCALE), Math.round(FH * PREVIEW_SCALE), { samples: 4, stencilBuffer: true });
const rtA = mkRT(), rtB = mkRT();

// ---------- backgrounds ----------
export const BG = {
  night: [0x0d0626, 0x4c0a70], sky: [0x2c5bff, 0x2aa8ff], sunset: [0xffb35c, 0xff7a3d], lemon: [0xfff0a8, 0xffdf7a],
  indigo: [0x5b2bff, 0x3b10c9], violet: [0x5a2fd6, 0x3a1aa8], ink: [0x0a0820, 0x1a1440], cell: [0x1a0b35, 0x22104a],
  mint: [0x8ff0cf, 0x2fd3a0], rose: [0xffb1d0, 0xff6fa8],
};
const DARK = new Set(['night', 'ink', 'cell', 'violet', 'indigo']);
function dust(g, n, seed) {
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const items = [];
  for (let i = 0; i < n; i++) items.push({ d: circle(g, 2 + r() * 3, i % 4 ? 0xa25cf0 : 0xffcd1a, (r() - .5) * W, (r() - .5) * H, { opacity: .4 }), ph: r() * 6 });
  items.forEach(it => (it.y0 = it.d.position.y));
  return t => items.forEach(it => { it.d.material.opacity = .2 + .35 * (.5 + .5 * Math.sin(t * 1.3 + it.ph)); it.d.position.y = it.y0 + Math.sin(t * .35 + it.ph) * 28; });
}

// ---------- titles ----------
// title(p, 'Why does coffee' + NL + 'wake you up?', { y, size, color, colors: [line1, line2] })   (NL = a newline)
// Centred, every line the same size, shrunk to fit TITLE.maxW (920 px vertical, 1500 landscape), top line kept
// TITLE.top px below the frame top.
export function title(p, str, { y = TITLE.y, size = 104, color = '#ffffff', stroke = '#1b1238', strokeW = 8, lineH = 1.08, colors } = {}) {
  const g = group(p, 0, 0), lines = String(str).split(/\n/);
  let sz = size; const probe = text(g, lines.reduce((a, b) => (a.length >= b.length ? a : b)), { size: sz, color, stroke, strokeW });
  if (probe.userData.w > TITLE.maxW) sz = Math.floor(sz * TITLE.maxW / probe.userData.w); probe.removeFromParent(); probe.geometry.dispose(); probe.material.map?.dispose(); probe.material.dispose();
  const top = Math.min(y + (lines.length - 1) * sz * lineH / 2, H / 2 - TITLE.top - sz / 2);
  lines.forEach((l, i) => text(g, l, { size: sz, color: colors?.[i] ?? color, stroke, strokeW, y: top - i * sz * lineH }));
  g.userData.kind = 'title'; return g;
}

// ---------- shots ----------
// shot({ t0, name, trans, captions, focus, build(S) -> st, update(st, t, S) })
//   trans: how this shot comes in: 'dissolve' (default) | 'cut' | 'slide-left' | 'slide-right' | 'slide-up'
//   captions: false hides captions during this shot (title cards whose words ARE the caption)
//   focus: [x, y] the point the camera pushes toward (default [0, 150] vertical, [0, 90] landscape)
export const SHOTS = [];
export const EVENTS = [];
let COLLECT = false;
export function sfx(type, t, o = {}) { if (COLLECT) EVENTS.push({ t: +(+t).toFixed(3), type, pan: o.pan ?? .5, gain: o.gain ?? 0, dur: o.dur ?? 0 }); }
export function shot(def) { const src = caller(); def._file = SUITE.module || src?.file || null; def._line = src?.line ?? null; SHOTS.push(def); }
const SFX_IN = { pop: 'pop', grow: 'pop', rise: 'pop', wipe: 'click', fade: null, none: null, slide: 'swish', drop: 'thud' };
export function live(def) {
  if (def._st) return def;
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -10, 10);
  const back = new THREE.Group(), root = new THREE.Group(); scene.add(back); scene.add(root);
  const S = { scene, cam, back, root, t0: def.t0, t1: def.t1, anims: [], ticks: [], GY, BAND, C, focus: def.focus || FOCUS, VERT, ZONE, TITLE };
  // S.bg('night') or S.bg(topHex, bottomHex): gradient + barely-visible depth discs (+ drifting dust on dark grounds)
  S.bg = (a, b) => {
    const [top, bot] = typeof a === 'string' && BG[a] ? BG[a] : [hx(a), hx(b ?? a)];
    gradientBg(back, top, bot); S.ticks.push(bokeh(back, top, bot, { seed: (def._line || 3) % 17 + 2, k: DARK.has(a) ? .025 : .04, n: 5 }));
    if (DARK.has(a)) S.ticks.push(dust(back, 22, (def._line || 7) % 23 + 3));
  };
  // S.ground(fill, edge): floor below the ground line (the caption band sits on it: fine)
  S.ground = (fill, edge) => { rrect(back, W + 40, 560, 0, fill, 0, GY - 270); rrect(back, W + 40, 14, 0, edge ?? tint(fill, .25), 0, GY + 4); };
  S.shadow = (w, x = 0, y = GY) => { const s = circle(root, w / 2, 0x000000, x, y, { opacity: .18 }); s.scale.y = .16; s.userData.noPick = true; s.userData.shadow = true; return s; };
  // S.add(obj, { at, in, dur, from, dist, out, outAt, outDur, sfx }): entrance/exit animation + its sound
  S.add = (obj, o = {}) => {
    const a = { obj, at: o.at ?? 0, in: o.in ?? 'pop', dur: o.dur ?? (o.in === 'wipe' ? .22 : o.in?.startsWith('slide') ? .45 : .3), out: o.out, outAt: o.outAt, outDur: o.outDur ?? .14,
      pos: obj.position.clone(), scl: obj.scale.clone(), dist: o.dist ?? 900 };
    S.anims.push(a);
    const kind = String(a.in).split('-')[0], snd = o.sfx === false ? null : o.sfx ?? SFX_IN[kind];
    if (snd && a.at > S.t0 - .05) sfx(snd, a.at, { pan: .5 + clamp(obj.position.x / W, -.4, .4), gain: o.gain ?? (kind === 'pop' ? -4 : -2) });
    if (a.out && a.outAt != null && o.sfx !== false) sfx(a.out === 'pop' ? 'pop' : 'swish', a.outAt, { gain: -8 });
    return obj;
  };
  // S.line(x1, y1, x2, y2, w, color, { at, dur, ticks, cap }): grows, then lands (cap pop + ticks); returns the line
  S.line = (x1, y1, x2, y2, w, color, o = {}) => {
    const l = line(root, x1, y1, x2, y2, w, color, o), at = o.at ?? 0, dur = o.dur ?? .22;
    S.ticks.push(t => l.userData.set(E.outCubic(seg(t, at, at + dur)), t - (at + dur)));
    if (o.sfx !== false) sfx('click', at + dur, { gain: -6 });
    return l;
  };
  // S.burst(x, y, { at, dur, rays, r0, r1, color }): radial dotted rays (celebration, emphasis)
  S.burst = (x, y, o = {}) => { const b = burst(root, o); b.position.set(x, y, 0); const at = o.at ?? 0, d = o.dur ?? 1;
    S.ticks.push(t => burstAt(b, seg(t, at, at + d))); if (o.sfx !== false) sfx('grow', at, { gain: -6 }); return b; };
  S.sfx = sfx;
  CUR_ROOT = root;
  try { def._S = S; def._st = def.build(S) || {}; } finally { CUR_ROOT = null; }
  return def;
}
let CUR_ROOT = null;
function setOpacity(obj, k) { obj.traverse(o => { if (!o.material) return; if (o.userData.op0 == null) o.userData.op0 = o.material.opacity; o.material.opacity = o.userData.op0 * k; }); }
function animate(a, t) {
  const { obj } = a; const kind = String(a.in).split('-')[0], dir = String(a.in).split('-')[1];
  obj.position.copy(a.pos); let sx = a.scl.x, sy = a.scl.y, op = null;
  if (t < a.at) { obj.visible = false; return; }
  obj.visible = true;
  const k = seg(t, a.at, a.at + a.dur);
  if (kind === 'pop') { const [qx, qy] = popSq(t, a.at, a.dur); sx *= qx; sy *= qy; }
  else if (kind === 'grow') { const g = E.outBack(k, 1.4); sx *= Math.max(1e-4, g); sy *= Math.max(1e-4, g); }
  else if (kind === 'rise') { obj.position.y -= 70 * (1 - E.outBack(k, 1.5)); const g = .85 + .15 * E.outCubic(k); sx *= g; sy *= g; if (k < 1) op = E.outCubic(k / .5); }
  else if (kind === 'slide') { const v = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] }[dir] || [1, 0], e = 1 - E.outBack(k, 1.25);
    obj.position.x += v[0] * a.dist * e; obj.position.y += v[1] * a.dist * e; }
  else if (kind === 'fade') op = E.inOutSine(k);
  else if (kind === 'wipe') { if (obj.userData.plane) wipe(obj, E.outCubic(k)); }
  if (a.out && a.outAt != null && t >= a.outAt) {
    const q = seg(t, a.outAt, a.outAt + a.outDur), ok = String(a.out).split('-')[0], od = String(a.out).split('-')[1];
    if (q >= 1) { obj.visible = false; return; }
    if (ok === 'pop') { const s = 1 - E.inCubic(q); sx *= s; sy *= s; }
    else if (ok === 'fade') op = (op ?? 1) * (1 - q);
    else if (ok === 'slide') { const v = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] }[od] || [-1, 0]; obj.position.x += v[0] * a.dist * E.inCubic(q); obj.position.y += v[1] * a.dist * E.inCubic(q); }
  }
  obj.scale.set(Math.max(1e-4, sx), Math.max(1e-4, sy), a.scl.z);
  if (op != null || obj.userData._faded) { setOpacity(obj, op ?? 1); obj.userData._faded = op != null && op < 1; }
}
function dispose(def) {
  if (!def._st) return;
  def._S.scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) { (Array.isArray(m) ? m : [m]).forEach(mm => { mm.map?.dispose?.(); mm.dispose(); }); } });
  def._st = null; def._S = null; def._checked = null;
}
export function finalizeShots(end) { SHOTS.sort((a, b) => a.t0 - b.t0); SHOTS.forEach((s, i) => (s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : end)); END = end; }
let END = 0;
export function activeIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t0) i++; return i; }
export const transOf = (s, i = SHOTS.indexOf(s)) => s.trans ?? (i <= 0 ? 'cut' : 'dissolve');
const durOf = s => s.transDur ?? SETTINGS.transitions.duration;
function step(def, t) {
  live(def); const S = def._S;
  for (const a of S.anims) animate(a, t);
  for (const f of S.ticks) f(t);
  def.update?.(def._st, t, S);
  // camera: slow push toward the focus + a punch-in that eases out right after the cut
  const k = seg(t, def.t0, def.t1 ?? def.t0 + 4), z = (1 + SETTINGS.camera.push * E.inOutSine(k)) * (1 + SETTINGS.camera.punch * (1 - E.outCubic(seg(t, def.t0, def.t0 + .4))));
  if (S.noCamera) { S.root.scale.setScalar(1); S.root.position.set(0, 0, 0); }
  else { S.root.scale.setScalar(z); S.root.position.set(S.focus[0] * (1 - z), S.focus[1] * (1 - z), 0); }
  return S;
}

// ---------- transitions: both shots render into their own buffer, a shader blends them ----------
const comp = new THREE.Scene(), compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const compMat = new THREE.ShaderMaterial({
  uniforms: { a: { value: rtA.texture }, b: { value: rtB.texture }, k: { value: 0 }, mode: { value: 0 }, dir: { value: new THREE.Vector2(1, 0) } },
  vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `uniform sampler2D a, b; uniform float k, mode; uniform vec2 dir; varying vec2 v;
    void main(){
      float e = k * k * (3. - 2. * k);
      if (mode < .5) {                                    // dissolve: drift + soft diagonal sweep from the light (top-left)
        vec2 ua = (v - .5) / (1. + .04 * e) + .5 + vec2(0., -.012 * e);
        vec2 ub = (v - .5) / (.96 + .04 * e) + .5;
        float sweep = (1. - v.x) * .35 + v.y * .65;
        float m = smoothstep(sweep - .35, sweep + .05, e * 1.4 - .2);
        gl_FragColor = mix(texture2D(a, ua), texture2D(b, ub), m);
      } else {                                            // slide: both move together, the seam eases (cut the curve)
        vec2 o = dir * e;
        vec2 ua = v + o, ub = v + o - dir;
        gl_FragColor = (dot(ub, dir) >= 0. && ub.x >= 0. && ub.x <= 1. && ub.y >= 0. && ub.y <= 1.) ? texture2D(b, ub) : texture2D(a, ua);
      }
    }`, depthTest: false, depthWrite: false });
comp.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat));
function transitionAt(t) {
  for (let j = 1; j < SHOTS.length; j++) { const s = SHOTS[j], ty = transOf(s, j), D = durOf(s); if (ty === 'cut') continue;
    if (t >= s.t0 - D / 2 && t < s.t0 + D / 2) return { A: SHOTS[j - 1], B: s, k: (t - (s.t0 - D / 2)) / D, type: ty }; }
  return null;
}

// ---------- overlay: captions (word highlight) + film finish, never part of a transition ----------
const ovScene = new THREE.Scene(), ovCam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -10, 10);
const ovRoot = new THREE.Group(); ovScene.add(ovRoot);
let CAPS = null, FIN = null;
function overlay(t) {
  if (!FIN) { CUR_ROOT = ovRoot; FIN = finish(ovRoot); CUR_ROOT = null; }
  if (!CAPS && SETTINGS.captions.on !== false && WORDS.length) {
    const words = WORDS.map(w => ({ word: w.w, start: w.s, end: w.e, ns: !!w.ns })).filter(w => !SHOTS.some(s => s.captions === false && w.start >= s.t0 && w.start < (s.t1 ?? 1e9)));
    CUR_ROOT = ovRoot; CAPS = captions(ovRoot, chunkWords(words), { y: (BAND.y0 + BAND.y1) / 2, size: SETTINGS.captions.size }); CUR_ROOT = null;
  }
  CAPS?.(t); FIN(t);
}
export function captionAt(t) { return SETTINGS.captions.on !== false && WORDS.some(w => t >= w.s - .03 && t < w.e + .5) && !SHOTS.some(s => s.captions === false && t >= s.t0 && t < (s.t1 ?? 1e9)); }

// ---------- frame ----------
export function compose(t) {
  const i = activeIndex(t);
  SHOTS.forEach((s, k) => { if (Math.abs(k - i) > 1) dispose(s); });
  renderer.setClearColor(0x000000, 1);
  if (!SHOTS.length) { renderer.setRenderTarget(null); renderer.clear(); return outCanvas; }
  const tr = transitionAt(t);
  if (tr) {
    const SA = step(tr.A, t); renderer.setRenderTarget(rtA); renderer.clear(); renderer.render(SA.scene, SA.cam);
    const SB = step(tr.B, t); renderer.setRenderTarget(rtB); renderer.clear(); renderer.render(SB.scene, SB.cam);
    compMat.uniforms.k.value = tr.k; compMat.uniforms.mode.value = tr.type === 'dissolve' ? 0 : 1;
    const d = String(tr.type).split('-')[1]; compMat.uniforms.dir.value.set(d === 'left' ? 1 : d === 'right' ? -1 : 0, d === 'up' ? -1 : d === 'down' ? 1 : 0);
    renderer.setRenderTarget(null); renderer.clear(); renderer.render(comp, compCam);
  } else {
    const S = step(SHOTS[i], t); renderer.setRenderTarget(null); renderer.clear(); renderer.render(S.scene, S.cam);
  }
  overlay(t);
  renderer.autoClear = false; renderer.render(ovScene, ovCam); renderer.autoClear = true;
  return outCanvas;
}

// ---------- export (WebCodecs H.264, streamed to /append/<name>) ----------
export async function exportVideo({ name = 'video', fps = 30, from = 0, to, bitrate = 16e6, onProgress } = {}) {
  const chunks = []; let bytes = 0, first = true, err = null;
  const enc = new VideoEncoder({ output: c => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunks.push(b); bytes += b.length; }, error: e => err = e });
  let cfg = { codec: 'avc1.640032', width: FW, height: FH, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'annexb' } };
  for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) { const c = { ...cfg, hardwareAcceleration: hw }; if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; break; } }
  enc.configure(cfg);
  const flush = async force => { if (!chunks.length || (!force && bytes < 8e6)) return; const blob = new Blob(chunks); chunks.length = 0; bytes = 0;
    await fetch(`${SUITE.base}/append/${name}${first ? '?reset=1' : ''}`, { method: 'POST', body: blob }); first = false; };
  const n = Math.round((to - from) * fps), t0 = performance.now();
  for (let f = 0; f < n; f++) {
    if (err) throw err;
    compose(from + f / fps);
    const vf = new VideoFrame(outCanvas, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
    while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 1));
    if (f % 30 === 0) { await flush(false); onProgress?.(f, n, (performance.now() - t0) / 1000); }
  }
  await enc.flush(); await flush(true); enc.close();
  const secs = (performance.now() - t0) / 1000;
  return { frames: n, seconds: +secs.toFixed(1), fps: +(n / secs).toFixed(1), realtime: +((to - from) / secs).toFixed(2) };
}

// ---------- sound events: build every shot once and collect what it scheduled ----------
export async function collectEvents(end) {
  SHOTS.forEach(dispose); EVENTS.length = 0; COLLECT = true;
  try { for (const s of SHOTS) { live(s); dispose(s); await new Promise(r => setTimeout(r, 0)); } } finally { COLLECT = false; }
  const shots = SHOTS.map((s, i) => ({ t0: +s.t0.toFixed(3), trans: transOf(s, i), cut: transOf(s, i) === 'cut', chapter: false, name: s.name || '' }));
  shots.slice(1).forEach(s => { if (!s.cut) EVENTS.push({ t: +(s.t0 - .2).toFixed(3), type: s.trans === 'dissolve' ? 'swish' : 'whoosh', pan: .5, gain: -8, dur: 0 }); });
  const seen = new Set(), list = [];
  for (const e of EVENTS.slice().sort((a, b) => a.t - b.t)) { const key = e.type + Math.round(e.t * 20); if (seen.has(key)) continue; seen.add(key); list.push(e); }
  return { shots, hits: [], cards: [], sfx: list.filter(s => s.t >= 0 && s.t <= end + 1), style: 'flat' };
}

// ---------- layout check (the check_layout tool) ----------
// Steady frames: middle and end of every shot + just after each element lands. For each named element on `st`:
// cut by the frame edge, inside the caption band, overlapping another element (bounding boxes), text too small,
// and (once per element) shading/detail drawn outside the element's own form (QUALITY_STANDARD: shading is cut from
// the outline, never laid on top).
export function checkTimes() {
  const ts = [];
  SHOTS.forEach((s, i) => { const a = s.t0 + durOf(s) / 2 + .05, b = (s.t1 ?? END) - durOf(s) / 2 - .05; if (b > a) ts.push(a, (a + b) / 2, b);
    live(s); for (const an of s._S.anims) if (an.at > s.t0) ts.push(an.at + an.dur + .1); });
  const seen = new Set(); return ts.filter(t => t >= 0 && t <= END && !transitionAt(t)).map(t => +t.toFixed(2)).sort((a, b) => a - b)
    .filter(t => { const k = Math.round(t * 4); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 90);
}
const isObj = v => v instanceof THREE.Object3D;
function visibleDeep(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
function boxOf(o) { o.updateWorldMatrix(true, true); const b = new THREE.Box3(); o.traverse(m => { if (m.isMesh && visibleDeep(m) && !m.userData.shadow) b.expandByObject(m); }); return b.isEmpty() ? null : b; }
let rtMask = null;
function maskCount(S, root) {   // detail pixels outside the dilated form, rendered at 1/2 res
  rtMask ??= new THREE.WebGLRenderTarget(FW / 2, FH / 2);
  const all = []; S.scene.traverse(o => o.isMesh && all.push(o));
  const save = all.map(m => ({ m, v: m.visible, c: m.material.color?.getHex?.(), map: m.material.map, o: m.material.opacity }));
  const inside = new Set(); root.traverse(o => o.isMesh && inside.add(o));
  const draw = roles => { save.forEach(({ m, v }) => { m.visible = v && inside.has(m) && roles.includes(m.userData.role ?? 'form'); if (m.material.color) m.material.color.setHex(0xffffff); m.material.map = null; m.material.opacity = 1; m.material.needsUpdate = true; });
    renderer.setRenderTarget(rtMask); renderer.setClearColor(0, 1); renderer.clear(); renderer.render(S.scene, S.cam);
    const px = new Uint8Array(FW / 2 * FH / 2 * 4); renderer.readRenderTargetPixels(rtMask, 0, 0, FW / 2, FH / 2, px); return px; };
  const F = draw(['form', 'thickness']), D = draw(['detail']);
  save.forEach(({ m, v, c, map, o }) => { m.visible = v; if (c != null) m.material.color.setHex(c); m.material.map = map; m.material.opacity = o; m.material.needsUpdate = true; });
  renderer.setRenderTarget(null);
  const w = FW / 2, h = FH / 2; let bad = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = (y * w + x) * 4; if (D[k] < 128) continue;
    let near = false; for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (F[((y + dy) * w + x + dx) * 4] > 127) { near = true; break; }
    if (!near) bad++; }
  return bad;
}
export function layoutIssues(t) {
  if (transitionAt(t)) return [];
  const i = activeIndex(t), def = SHOTS[i], S = step(def, t), st = def._st || {}, out = [];
  const where = `(${def._file}:${def._line})`;
  const items = Object.entries(st).filter(([, v]) => isObj(v) && visibleDeep(v)).map(([k, v]) => ({ k, v, b: boxOf(v) })).filter(e => e.b);
  const cap = captionAt(t);
  for (const e of items) {
    const { min, max } = e.b, ud = e.v.userData, w = max.x - min.x, h = max.y - min.y;
    if (w < 2 || h < 2) continue;
    const m = 36, cut = [min.x < -W / 2 + m && 'left', max.x > W / 2 - m && 'right', max.y > H / 2 - m && 'top', min.y < -H / 2 + m && 'bottom'].filter(Boolean);
    const fully = max.x < -W / 2 || min.x > W / 2 || min.y > H / 2 || max.y < -H / 2;
    if (cut.length && !fully && !ud.bleed) out.push({ t, type: 'cut', what: `st.${e.k} ${where}`, detail: `is within 36 px of / crosses the frame edge (${cut.join(', ')}); keep 40 px of air or set userData.bleed = true if the crop is intended` });
    if (cap && !ud.over && !ud.band && min.y < BAND.y1 && max.y > BAND.y0 && !ud.ground) out.push({ t, type: 'caption', what: `st.${e.k} ${where}`, detail: `reaches into the caption band (y ${BAND.y0}..${BAND.y1}) while a caption is on screen: move it up (content zone y ${ZONE.y0}..${ZONE.y1})` });
    let tmin = 1e9; e.v.traverse(o => { if (o.userData.role === 'text' && visibleDeep(o)) { o.updateWorldMatrix(true, false); const s = new THREE.Vector3(); o.getWorldScale(s); tmin = Math.min(tmin, (o.userData.size || 40) * s.y); } });
    if (tmin < 40) out.push({ t, type: 'small', what: `st.${e.k} ${where}`, detail: `text is ${Math.round(tmin)} px tall on screen: labels 44 px minimum, titles 90+` });
    def._checked ??= new Set();
    if (!def._checked.has(e.k)) { def._checked.add(e.k); const bad = maskCount(S, e.v); if (bad > 6) out.push({ t, type: 'shading', what: `st.${e.k} ${where}`, detail: `${bad} px of shading/highlight/detail drawn OUTSIDE the element's own form: cut shading from the outline (shaded(), clipPts) instead of laying shapes on top` }); }
  }
  { const cw = (ZONE.x1 - ZONE.x0) / 20, chh = (ZONE.y1 - ZONE.y0) / 20, grid = new Uint8Array(20 * 20);   // 20 x 20 cells over the content zone
    for (const e of items) { if (e.v.userData.ground) continue; const { min, max } = e.b;
      for (let gy = 0; gy < 20; gy++) for (let gx = 0; gx < 20; gx++) { const x0 = ZONE.x0 + gx * cw, y0 = ZONE.y0 + gy * chh;
        if (max.x > x0 && min.x < x0 + cw && max.y > y0 && min.y < y0 + chh) grid[gy * 20 + gx] = 1; } }
    const used = grid.reduce((a, b) => a + b, 0) / 400;
    const landed = S.anims.filter(x => x.at > def.t0 + .05).map(x => x.at + x.dur), first = landed.length ? Math.min(...landed) : def.t0;
    if (used < .12 && !S.sparse && t >= first) out.push({ t, type: 'empty', what: `shot ${i + 1} ${where}`, detail: `only ${Math.round(used * 100)}% of the content zone (y ${ZONE.y0}..${ZONE.y1}) holds anything: the frame reads as empty. Make the subject bigger, add the supporting element the narration names, or set S.sparse = true if the emptiness IS the idea (e.g. silence)` }); }
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const A = items[a], B = items[b], ua = A.v.userData, ub = B.v.userData;
    if (ua.over === true || ub.over === true || ua.ground || ub.ground || (Array.isArray(ua.over) && ua.over.includes(B.v)) || (Array.isArray(ub.over) && ub.over.includes(A.v))) continue;
    if (A.v.parent !== B.v.parent && (isAncestor(A.v, B.v) || isAncestor(B.v, A.v))) continue;
    const ix = Math.min(A.b.max.x, B.b.max.x) - Math.max(A.b.min.x, B.b.min.x), iy = Math.min(A.b.max.y, B.b.max.y) - Math.max(A.b.min.y, B.b.min.y);
    if (ix <= 0 || iy <= 0) continue;
    const area = b => (b.max.x - b.min.x) * (b.max.y - b.min.y), frac = ix * iy / Math.min(area(A.b), area(B.b));
    if (frac > .12) out.push({ t, type: 'overlap', what: `st.${A.k}`, other: `st.${B.k} ${where}`, detail: `${Math.round(frac * 100)}% of the smaller one is covered: separate them, or mark the intent with userData.over = [other] (e.g. a label on its object)` });
  }
  return out;
}
const isAncestor = (a, b) => { let o = b.parent; while (o) { if (o === a) return true; o = o.parent; } return false; };

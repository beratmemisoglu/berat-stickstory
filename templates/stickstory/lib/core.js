// Stick stories - shared core: settings, format, colours, easing, seeded random, noise, and the FLAT-VECTOR SHAPE KIT every
// library draws with. No imports from engine.js (every lib module may import this one).
//
// The world is a 2.5D cut-out theatre: flat vector shapes on vertical cards (the XY plane) standing at depths z, seen by a
// long-lens perspective camera, so layers get real parallax and real depth of field. Units: metres. +y up, the floor is
// y = 0, the camera looks toward -z (bigger z = nearer the camera). A grown-up figure is 1.70 m to the top of the head.
// Inside one card (a character, a cupboard) parts are stacked with tiny z steps (Z.step) so they never z-fight.
import * as THREE from '../vendor/three.module.js';
export { THREE };

const merge = (a, b) => { const o = { ...a }; for (const k in b || {}) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; };
const RAW = globalThis.__CZ_SETTINGS || {};
export const LOOK = RAW.look === 'clean' ? 'clean' : 'story';
// Per-look defaults. A look in the Suite writes all of these into project.json "settings".
const LOOKS = {
  story: {             // the studied look: soft depth of field, warm practical glows, film grain, vignette
    post: { bloom: .18, threshold: .9, dof: 1, vignette: .36, grain: .035, ca: 0, sharpen: .05 },
    captions: { on: false, size: 1, y: .86, words: 4 },
    camera: { drift: 1 }, transitions: { duration: .25 },
  },
  clean: {             // flatter: less depth of field, no grain
    post: { bloom: .1, threshold: .92, dof: .5, vignette: .18, grain: 0, ca: 0, sharpen: .05 },
    captions: { on: false, size: 1, y: .86, words: 4 },
    camera: { drift: .6 }, transitions: { duration: .25 },
  },
};
export const DEFAULTS = merge({ format: 'landscape', look: LOOK, quality: 1, fps: 24, brand: {}, hud: {} }, LOOKS[LOOK]);
export const SETTINGS = merge(DEFAULTS, RAW);
export const VERT = SETTINGS.format === 'vertical';
export const FW = VERT ? 1080 : 1920, FH = VERT ? 1920 : 1080, W = FW, H = FH, AW = FW, AH = FH;
const Q = Math.max(.5, Math.min(1, +SETTINGS.quality || 1));
export const RW = Math.round(FW * Q / 2) * 2, RH = Math.round(FH * Q / 2) * 2;
export const ASPECT = FW / FH;
export const FPS = 24;

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / ((b - a) || 1e-6));
export const smooth = k => k * k * (3 - 2 * k);
const PI = Math.PI;
export const DEG = PI / 180;
export const E = {
  lin: k => k,
  inOut: k => k * k * (3 - 2 * k),
  inSine: k => 1 - Math.cos(k * PI / 2), outSine: k => Math.sin(k * PI / 2), inOutSine: k => -(Math.cos(PI * k) - 1) / 2,
  inQuad: k => k * k, outQuad: k => 1 - (1 - k) * (1 - k), inOutQuad: k => k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2,
  inCubic: k => k ** 3, outCubic: k => 1 - (1 - k) ** 3, inOutCubic: k => k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2,
  inQuart: k => k ** 4, outQuart: k => 1 - (1 - k) ** 4, inOutQuart: k => k < .5 ? 8 * k ** 4 : 1 - (-2 * k + 2) ** 4 / 2,
  inQuint: k => k ** 5, outQuint: k => 1 - (1 - k) ** 5, inOutQuint: k => k < .5 ? 16 * k ** 5 : 1 - (-2 * k + 2) ** 5 / 2,
  inExpo: k => k <= 0 ? 0 : 2 ** (10 * k - 10), outExpo: k => k >= 1 ? 1 : 1 - 2 ** (-10 * k),
  inOutExpo: k => k <= 0 ? 0 : k >= 1 ? 1 : k < .5 ? 2 ** (20 * k - 10) / 2 : (2 - 2 ** (-20 * k + 10)) / 2,
  inBack: (k, s = 1.70158) => (s + 1) * k ** 3 - s * k * k,
  outBack: (k, s = 1.70158) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2,
  inOutBack: (k, s = 1.70158 * 1.525) => k < .5 ? ((2 * k) ** 2 * ((s + 1) * 2 * k - s)) / 2 : ((2 * k - 2) ** 2 * ((s + 1) * (k * 2 - 2) + s) + 2) / 2,
  outElastic: k => k <= 0 ? 0 : k >= 1 ? 1 : 2 ** (-10 * k) * Math.sin((k * 10 - .75) * (2 * PI / 3)) + 1,
  outBounce: k => { const n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + .75; if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + .9375; return n * (k -= 2.625 / d) * k + .984375; },
};
E.linear = E.lin; E.sine = E.inOutSine; E.cubic = E.inOutCubic; E.quint = E.inOutQuint; E.expo = E.inOutExpo; E.back = E.outBack;
export const easeFn = f => typeof f === 'function' ? f : E[f] || E.inOutCubic;
export const ease = (t, a, b, f = E.inOutCubic) => easeFn(f)(seg(t, a, b));
/** A damped spring's step response at time x (seconds after the change): 0 -> 1 with overshoot. freq Hz, damp 0..1. */
export function springStep(x, freq = 3, damp = .45) {
  if (x <= 0) return 0;
  const w = 2 * PI * freq, z = Math.min(.999, damp), wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
}
/** Snap a time to the animation's step (references animate on 1s at 24 fps; `on2s` holds every pose 2 frames). */
export const stepT = (t, every = 1) => Math.floor(t * FPS / every + 1e-6) * every / FPS;
export const V3 = (x = 0, y = 0, z = 0) => Array.isArray(x) ? new THREE.Vector3(x[0], x[1] ?? 0, x[2] ?? 0) : x?.isVector3 ? x.clone() : new THREE.Vector3(x, y, z);
export function rnd(seed = 1) { let a = (seed * 2654435761) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const hash = (n, seed = 0) => { const s = Math.sin((n + seed * 57.3) * 127.1) * 43758.5453; return s - Math.floor(s); };
export function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1; }
export const fbm1 = (x, seed = 0) => noise1(x, seed) * .6 + noise1(x * 2.13, seed + 7) * .28 + noise1(x * 4.7, seed + 13) * .12;
export const strHash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------- colours ----------
// The palette is filled in from the study (analysis/sets + characters NOTES.md); libraries add their own named colours.
export const C = {
  ink: '#0b0b0f', black: '#0b0b0f', white: '#f4f1ea', paper: '#efe8da', cream: '#e9dfc9',
  rimWarm: '#f0a050', rimCool: '#5a9cf0', rimPink: '#e07aa0',
  hoodie: '#2f6fd8', hoodieDark: '#1f4ea8', red: '#d8433b', orange: '#e98a3a', yellow: '#f2c24a', green: '#5f9e6a', teal: '#3a9c96',
  blue: '#3b6fd0', navy: '#1b2340', purple: '#6b4fb0', pink: '#e783a8', grey: '#8a8d93', wood: '#9a6b44', woodDark: '#6a4428',
  night: '#141a2e', lamp: '#ffd38a', screen: '#cfe8ff', hud: '#f4f1ea', hudGold: '#f2c24a', hudLine: '#e9b44c',
};
const _rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const _lum = h => { const [r, g, b] = _rgb(h).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const _mix = (a, b, k) => '#' + _rgb(a).map((c, i) => Math.round(clamp(c + (_rgb(b)[i] - c) * k) * 255).toString(16).padStart(2, '0')).join('');
export const contrast = (a, b) => { const x = _lum(a), y = _lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
export const textOn = c => contrast('#ffffff', c) >= contrast('#101014', c) ? '#ffffff' : '#101014';
export const mixHex = _mix;
/** k < 0 darkens toward black, k > 0 lightens toward white (hue kept) */
export const shade = (hexc, k) => _mix(css(hexc), k < 0 ? '#000000' : '#ffffff', Math.abs(k));
export const hex = c => typeof c === 'number' ? c : typeof c === 'string' ? new THREE.Color(c).getHex() : c?.isColor ? c.getHex() : 0xffffff;
export const css = c => typeof c === 'string' ? c : '#' + new THREE.Color(c).getHexString();
const _brand = typeof SETTINGS.brand?.color === 'string' && /^#[0-9a-f]{6}$/i.test(SETTINGS.brand.color) ? SETTINGS.brand.color.toLowerCase() : null;
export const BRAND = { on: !!_brand, color: _brand ?? C.hudGold, ink: textOn(_brand ?? C.hudGold) };
C.brand = BRAND.color; C.brandInk = BRAND.ink;

// ---------- canvas textures ----------
export function canvasTex(w, h, fn, { nearest = false, mip = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); fn(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.generateMipmaps = mip && !nearest; t.minFilter = nearest ? THREE.NearestFilter : mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.userData.canvas = c; t.userData.draw = fn;
  return t;
}
export function redraw(t, fn) { const c = t.userData.canvas, x = c.getContext('2d'); (fn || t.userData.draw)(x, c.width, c.height); t.needsUpdate = true; }
export function fmt(n, o = {}) { try { return new Intl.NumberFormat(globalThis.__CZ_LANG || 'en', o).format(n); } catch { return String(n); } }

// =====================================================================================================================
// THE SHAPE KIT. Every function returns a THREE.Mesh (or Group) lying in its own XY plane, centred at the origin unless
// `anchor` says otherwise. Colours are '#hex'. Opaque shapes write depth (so depth of field sees them); transparent
// ones (glows, shadows, gradients with alpha) do not. Geometry is cached by its parameters and shared (never dispose a
// shared geometry: userData.shared marks it).
// =====================================================================================================================
export const Z = { step: .0015 };   // depth between stacked parts of one card (m): enough for the depth buffer, invisible
const MATS = new Map(), GEOS = new Map();
/** a flat material: mat('#hex', { opacity, add, map, depth }) - cached and shared */
export function mat(color = '#ffffff', o = {}) {
  const op = o.opacity ?? 1, tr = op < 1 || !!o.map?.userData?.alpha || !!o.transparent || !!o.add;
  const key = `${css(color)}|${op}|${!!o.add}|${o.map?.uuid || ''}|${o.depth ?? ''}|${o.side ?? ''}|${tr}`;
  if (!o.unique && MATS.has(key)) return MATS.get(key);
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(css(color)), transparent: tr, opacity: op, map: o.map || null, side: o.side ?? THREE.DoubleSide,
    depthWrite: o.depth ?? !tr, depthTest: true, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false });
  if (!o.unique) MATS.set(key, m);
  return m;
}
const geo = (key, make) => { let g = GEOS.get(key); if (!g) { g = make(); g.userData.shared = true; GEOS.set(key, g); } return g; };
const mesh = (g, color, o = {}) => { const m = new THREE.Mesh(g, o.material || mat(color, o)); if (o.name) m.name = o.name; if (o.z) m.position.z = o.z; if (o.order != null) m.renderOrder = o.order; m.userData.color = css(color); return m; };
const ANCH = { center: [0, 0], bottom: [0, .5], top: [0, -.5], left: [.5, 0], right: [-.5, 0], 'bottom-left': [.5, .5], 'top-left': [.5, -.5], 'bottom-right': [-.5, .5], 'top-right': [-.5, -.5] };
const anchored = (m, w, h, anchor) => { const a = ANCH[anchor || 'center'] || ANCH.center; m.geometry = m.geometry; m.position.x += a[0] * w; m.position.y += a[1] * h; return m; };
const wrapAt = (m, o) => { if (o.at) { m.position.x += o.at[0]; m.position.y += o.at[1]; if (o.at[2] != null) m.position.z += o.at[2]; } if (o.rot) m.rotation.z = o.rot; return m; };

/** rounded rectangle w x h with corner radius r (or [tl, tr, br, bl]) */
export function rrect(w, h, r = 0, color = '#888', o = {}) {
  const rr = Array.isArray(r) ? r.map(v => Math.min(v, w / 2, h / 2)) : Array(4).fill(Math.min(r, w / 2, h / 2));
  const g = geo(`rr|${w.toFixed(4)}|${h.toFixed(4)}|${rr.map(v => v.toFixed(4))}`, () => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2, [tl, tr, br, bl] = rr;
    s.moveTo(x + bl, y); s.lineTo(x + w - br, y); if (br) s.quadraticCurveTo(x + w, y, x + w, y + br); s.lineTo(x + w, y + h - tr); if (tr) s.quadraticCurveTo(x + w, y + h, x + w - tr, y + h);
    s.lineTo(x + tl, y + h); if (tl) s.quadraticCurveTo(x, y + h, x, y + h - tl); s.lineTo(x, y + bl); if (bl) s.quadraticCurveTo(x, y, x + bl, y);
    return new THREE.ShapeGeometry(s, 10);
  });
  return wrapAt(anchored(mesh(g, color, o), w, h, o.anchor), o);
}
export const rect = (w, h, color, o = {}) => rrect(w, h, 0, color, o);
/** circle / ellipse; `arc` = [a0, a1] radians for a pie / half disc */
export function ellipse(rx, ry, color = '#888', o = {}) {
  const segs = o.segs ?? Math.max(24, Math.min(96, Math.round(Math.max(rx, ry) * 160)));
  const [a0, a1] = o.arc || [0, PI * 2];
  const g = geo(`el|${rx.toFixed(4)}|${ry.toFixed(4)}|${segs}|${a0.toFixed(3)}|${a1.toFixed(3)}`, () => {
    const s = new THREE.Shape(); const full = Math.abs(a1 - a0) >= PI * 2 - 1e-6; if (!full) s.moveTo(0, 0);
    for (let i = 0; i <= segs; i++) { const a = a0 + (a1 - a0) * i / segs, p = [Math.cos(a) * rx, Math.sin(a) * ry]; if (i === 0 && full) s.moveTo(...p); else s.lineTo(...p); }
    return new THREE.ShapeGeometry(s);
  });
  return wrapAt(anchored(mesh(g, color, o), rx * 2, ry * 2, o.anchor), o);
}
export const circle = (r, color, o = {}) => ellipse(r, r, color, o);
/** a ring (annulus), optional arc */
export function ring(r0, r1, color = '#888', o = {}) {
  const [a0, a1] = o.arc || [0, PI * 2];
  const g = geo(`ring|${r0.toFixed(4)}|${r1.toFixed(4)}|${a0.toFixed(3)}|${a1.toFixed(3)}`, () => new THREE.RingGeometry(r0, r1, 64, 1, a0, a1 - a0));
  return wrapAt(mesh(g, color, o), o);
}
/** a limb segment: a capsule from (0,0) down to (0,-len), width w, round caps (pivot at the top joint) */
export function capsule(len, w, color = '#000', o = {}) {
  const g = geo(`cap|${len.toFixed(4)}|${w.toFixed(4)}`, () => {
    const r = w / 2, s = new THREE.Shape(), n = 12;
    s.moveTo(-r, 0); s.lineTo(-r, -len);
    for (let i = 0; i <= n; i++) { const a = PI + PI * i / n; s.lineTo(Math.cos(a) * r, -len + Math.sin(a) * r); }
    s.lineTo(r, 0);
    for (let i = 0; i <= n; i++) { const a = PI * i / n; s.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    return new THREE.ShapeGeometry(s);
  });
  return wrapAt(mesh(g, color, o), o);
}
/** a filled polygon from points [[x,y], ...] (not cached unless o.key) */
export function poly(pts, color = '#888', o = {}) {
  const make = () => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); return new THREE.ShapeGeometry(s); };
  const g = o.key ? geo('poly|' + o.key, make) : make();
  return wrapAt(mesh(g, color, o), o);
}
/** a thick polyline (static): stroke([[x,y],...], width, color, { closed, cap: 'round'|'butt' }) - round joins */
export function stroke(pts, w, color = '#000', o = {}) {
  const make = () => {
    const pos = [], idx = [], r = w / 2, P = o.closed ? [...pts, pts[0]] : pts;
    const quad = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9, nx = -dy / L * r, ny = dx / L * r, k = pos.length / 3;
      pos.push(a[0] + nx, a[1] + ny, 0, a[0] - nx, a[1] - ny, 0, b[0] + nx, b[1] + ny, 0, b[0] - nx, b[1] - ny, 0); idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); };
    const disc = c => { const k = pos.length / 3, n = 14; pos.push(c[0], c[1], 0); for (let i = 0; i <= n; i++) { const a = PI * 2 * i / n; pos.push(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, 0); if (i) idx.push(k, k + i, k + i + 1); } };
    for (let i = 0; i + 1 < P.length; i++) quad(P[i], P[i + 1]);
    for (let i = (o.cap === 'butt' && !o.closed ? 1 : 0); i < P.length - (o.cap === 'butt' && !o.closed ? 1 : 0); i++) disc(P[i]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  };
  const g = o.key ? geo('stroke|' + o.key, make) : make();
  return wrapAt(mesh(g, color, o), o);
}
/** points along a quadratic / cubic bezier (for strokes and shapes): bez([p0, c, p1], n) or bez([p0, c0, c1, p1], n) */
export function bez(P, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t;
    if (P.length === 3) out.push([u * u * P[0][0] + 2 * u * t * P[1][0] + t * t * P[2][0], u * u * P[0][1] + 2 * u * t * P[1][1] + t * t * P[2][1]]);
    else out.push([u ** 3 * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t ** 3 * P[3][0], u ** 3 * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t ** 3 * P[3][1]]); }
  return out;
}
/**
 * A shape from an SVG-style path string (absolute commands M L H V Q C Z, several subpaths = holes or extra pieces).
 * Coordinates are in the units you choose; `scale` multiplies them; SVG's y-down is flipped (o.svg = true) or not.
 *   path('M0 0 L1 0 L1 1 Z', '#fff', { scale: .5 })
 */
export function path(d, color = '#888', o = {}) {
  const k = o.scale ?? 1, fy = o.svg ? -1 : 1;
  const make = () => {
    const toks = String(d).match(/[MLHVQCZmlhvqcz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    const shapes = []; let s = null, cx = 0, cy = 0, i = 0, cmd = '';
    const num = () => parseFloat(toks[i++]);
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
      const rel = cmd === cmd.toLowerCase() && cmd !== 'z' && cmd !== 'Z', C0 = cmd.toUpperCase();
      const P = () => { const x = num(), y = num(); return rel ? [cx + x, cy + y] : [x, y]; };
      if (C0 === 'M') { const p = P(); s = new THREE.Shape(); shapes.push(s); s.moveTo(p[0] * k, p[1] * k * fy); cx = p[0]; cy = p[1]; cmd = rel ? 'l' : 'L'; }
      else if (C0 === 'L') { const p = P(); s.lineTo(p[0] * k, p[1] * k * fy); cx = p[0]; cy = p[1]; }
      else if (C0 === 'H') { const x = num(); cx = rel ? cx + x : x; s.lineTo(cx * k, cy * k * fy); }
      else if (C0 === 'V') { const y = num(); cy = rel ? cy + y : y; s.lineTo(cx * k, cy * k * fy); }
      else if (C0 === 'Q') { const c = P(), p = P(); s.quadraticCurveTo(c[0] * k, c[1] * k * fy, p[0] * k, p[1] * k * fy); cx = p[0]; cy = p[1]; }
      else if (C0 === 'C') { const c1 = P(), c2 = P(), p = P(); s.bezierCurveTo(c1[0] * k, c1[1] * k * fy, c2[0] * k, c2[1] * k * fy, p[0] * k, p[1] * k * fy); cx = p[0]; cy = p[1]; }
      else if (C0 === 'Z') { if (s) s.closePath(); }
      else i++;
    }
    return new THREE.ShapeGeometry(shapes, o.curveSegs ?? 12);
  };
  const g = o.nocache ? make() : geo(`path|${k}|${fy}|${d}`, make);
  return wrapAt(mesh(g, color, o), o);
}
// ---- gradients and glows (canvas textures, cached) ----
const TEXS = new Map();
const texOnce = (key, w, h, fn) => { let t = TEXS.get(key); if (!t) { t = canvasTex(w, h, fn); t.userData.alpha = true; TEXS.set(key, t); } return t; };
/** a w x h quad filled with a gradient: stops [[0, '#hex', alpha?], [1, '#hex']]; dir 'v' (bottom->top) | 'h' (left->right) | 'radial' */
export function gradient(w, h, stops, o = {}) {
  const dir = o.dir || 'v', key = `grad|${dir}|${JSON.stringify(stops)}`;
  const t = texOnce(key, dir === 'h' ? 256 : 4, dir === 'v' ? 256 : dir === 'h' ? 4 : 256, (x, cw, ch) => {
    const g = dir === 'radial' ? x.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, cw / 2) : dir === 'h' ? x.createLinearGradient(0, 0, cw, 0) : x.createLinearGradient(0, ch, 0, 0);
    for (const [p, c, a] of stops) { const [r, gg, b] = _rgb(css(c)); g.addColorStop(p, `rgba(${r * 255 | 0},${gg * 255 | 0},${b * 255 | 0},${a ?? 1})`); }
    x.fillStyle = g; x.fillRect(0, 0, cw, ch);
  });
  const g = geo(`plane|${w.toFixed(4)}|${h.toFixed(4)}`, () => new THREE.PlaneGeometry(w, h));
  const m = new THREE.Mesh(g, mat('#ffffff', { map: t, transparent: true, depth: false, add: o.add, opacity: o.opacity ?? 1 }));
  if (o.order != null) m.renderOrder = o.order;
  return wrapAt(anchored(m, w, h, o.anchor), o);
}
/** a soft round glow (lamp halo, screen light): additive by default */
export function glow(r, color = C.lamp, o = {}) {
  const fall = o.falloff ?? 2;
  const t = texOnce(`glow|${fall}`, 128, 128, (x, w, h) => { const im = x.createImageData(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const d = Math.hypot(i - w / 2 + .5, j - h / 2 + .5) / (w / 2); const a = Math.max(0, 1 - d) ** fall; const k = (j * w + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = Math.round(a * 255); } x.putImageData(im, 0, 0); });
  const g = geo(`plane|${(r * 2 * (o.sx ?? 1)).toFixed(4)}|${(r * 2 * (o.sy ?? 1)).toFixed(4)}`, () => new THREE.PlaneGeometry(r * 2 * (o.sx ?? 1), r * 2 * (o.sy ?? 1)));
  const m = new THREE.Mesh(g, mat(color, { map: t, transparent: true, depth: false, add: o.add !== false, opacity: o.opacity ?? .5 }));
  m.userData.noPick = true; m.renderOrder = o.order ?? 5;
  return wrapAt(m, o);
}
/** a soft contact shadow ellipse on the floor plane or a wall (multiplied dark) */
export function softShadow(rx, ry, o = {}) {
  const t = texOnce('shadow', 128, 64, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.55, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.setTransform(1, 0, 0, h / w, 0, 0); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const g = geo(`plane|${(rx * 2).toFixed(4)}|${(ry * 2).toFixed(4)}`, () => new THREE.PlaneGeometry(rx * 2, ry * 2));
  const m = new THREE.Mesh(g, mat(o.color || '#000000', { map: t, transparent: true, depth: false, opacity: o.opacity ?? .28 }));
  m.userData.noPick = true; m.renderOrder = o.order ?? 1;
  return wrapAt(m, o);
}
// ---- text on a card ----
/** text('LEO', { size: .2 (m cap height-ish), font: 'Oswald', weight: 700, color, align: 'center'|'left'|'right', spacing (em), bg, pad, radius, maxWidth (m) })
 *  -> a Mesh whose geometry is the text's box (userData.w / h in metres). Sharp at any zoom up to o.px (pixels per metre, default 900). */
export function text(str, o = {}) {
  // the references' one font: Open Sans ExtraBold (graphics NOTES); "Open Sans Ext" carries the accented letters
  const size = o.size ?? .2, ppm = o.px ?? 900, font = o.font || 'Open Sans", "Open Sans Ext', weight = o.weight ?? 800, sp = o.spacing ?? 0;
  const px = Math.max(8, Math.round(size * ppm)), lines = String(str).split('\n');
  const meas = document.createElement('canvas').getContext('2d'); meas.font = `${weight} ${px}px "${font}", Arial, sans-serif`;
  const lw = l => meas.measureText(l).width + Math.max(0, l.length - 1) * sp * px;
  const pad = (o.pad ?? (o.bg ? .35 : .08)) * px, tw = Math.max(...lines.map(lw)), lh = px * (o.lineHeight ?? 1.18);
  const cw = Math.ceil(tw + pad * 2), ch = Math.ceil(lh * lines.length + pad * 2 - (lh - px) * .4);
  const t = canvasTex(cw, ch, x => {
    x.clearRect(0, 0, cw, ch);
    if (o.bg) { const r = (o.radius ?? .5) * Math.min(ch, px * 1.6); x.fillStyle = css(o.bg); x.beginPath(); x.roundRect(o.border ? 2 : 0, o.border ? 2 : 0, cw - (o.border ? 4 : 0), ch - (o.border ? 4 : 0), r); x.fill(); if (o.border) { x.lineWidth = Math.max(2, px * .08); x.strokeStyle = css(o.border); x.stroke(); } }
    x.font = `${weight} ${px}px "${font}", Arial, sans-serif`; x.textBaseline = 'middle'; x.fillStyle = css(o.color || '#ffffff');
    if (o.shadow) { x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = px * .15; x.shadowOffsetY = px * .05; }
    lines.forEach((l, i) => { const w = lw(l), y = pad + lh * (i + .5) - (lh - px) * .2;
      let xx = o.align === 'left' ? pad : o.align === 'right' ? cw - pad - w : (cw - w) / 2;
      if (!sp) x.fillText(l, xx, y); else for (const chh of l) { x.fillText(chh, xx, y); xx += x.measureText(chh).width + sp * px; } });
  }, { mip: true });
  t.userData.alpha = true;
  const w = cw / ppm, h = ch / ppm;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat('#ffffff', { map: t, transparent: true, depth: false, unique: true }));
  m.material.userData.own = true;                       // freed with its shot (engine.js dispose)
  m.userData.w = w; m.userData.h = h; m.userData.text = String(str); m.userData.kind = m.userData.kind || 'text'; m.renderOrder = o.order ?? 8;
  const a = ANCH[o.anchor || (o.align === 'left' ? 'left' : o.align === 'right' ? 'right' : 'center')] || ANCH.center; m.position.x += a[0] * w; m.position.y += a[1] * h;
  return wrapAt(m, o);
}
// ---- grouping ----
/** group(...children) with children stacked front-to-back in the order given (each next one Z.step nearer) */
export function stack(...kids) { const g = new THREE.Group(); kids.flat().filter(Boolean).forEach((k, i) => { k.position.z += i * Z.step; g.add(k); }); return g; }
export function group(...kids) { const g = new THREE.Group(); kids.flat().filter(Boolean).forEach(k => g.add(k)); return g; }
/** recolour every mesh of a group whose userData.color matches `from` (e.g. a night version of a set) */
export function recolor(obj, map) { obj.traverse(o => { if (o.isMesh && o.userData.color && map[o.userData.color]) o.material = mat(map[o.userData.color], { opacity: o.material.opacity }); }); return obj; }
/** a card's bounding box in its own plane (metres) */
export function box2(obj) { const b = new THREE.Box3().setFromObject(obj); return { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, w: b.max.x - b.min.x, h: b.max.y - b.min.y }; }

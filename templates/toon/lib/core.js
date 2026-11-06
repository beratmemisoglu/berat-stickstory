// 3D toon shorts - shared core: settings, format, looks, colours, the easing library, seeded random, noise, canvas textures.
// No imports from engine.js (every lib module may import this one).
import * as THREE from '../vendor/three.module.js';
export { THREE };

const merge = (a, b) => { const o = { ...a }; for (const k in b || {}) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; };
const RAW = globalThis.__CZ_SETTINGS || {};
export const LOOK = RAW.look === 'clean' ? 'clean' : 'cinema';
// Per-look defaults. A look in the Suite writes all of these into project.json "settings".
const LOOKS = {
  cinema: {            // the studied look: soft key + rim light, depth of field on every shot, warm bloom on practicals, light vignette + grain
    post: { bloom: .32, threshold: .82, dof: 1, vignette: .28, grain: .006, ca: 0, sharpen: .12 },
    light: { shadows: true, ao: 1 },
    captions: { on: true, size: 1, y: .705, words: 2 },
    camera: { drift: 1 }, transitions: { duration: .4 },
  },
  clean: {             // brighter, flatter: less depth of field, no grain (explainers that live on diagrams and maps)
    post: { bloom: .2, threshold: .88, dof: .45, vignette: .12, grain: 0, ca: 0, sharpen: .1 },
    light: { shadows: true, ao: .6 },
    captions: { on: true, size: 1, y: .705, words: 2 },
    camera: { drift: .6 }, transitions: { duration: .4 },
  },
};
export const DEFAULTS = merge({ format: 'vertical', look: LOOK, quality: 1, brand: {} }, LOOKS[LOOK]);
export const SETTINGS = merge(DEFAULTS, RAW);
export const VERT = SETTINGS.format !== 'landscape';
export const FW = VERT ? 1080 : 1920, FH = VERT ? 1920 : 1080, W = FW, H = FH, AW = FW, AH = FH;
// internal 3D render size: full frame (the toon look needs crisp outlines); quality < 1 draws smaller and scales up
const Q = Math.max(.5, Math.min(1, +SETTINGS.quality || 1));
export const RW = Math.round(FW * Q / 2) * 2, RH = Math.round(FH * Q / 2) * 2;
export const ASPECT = FW / FH;

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / ((b - a) || 1e-6));
export const smooth = k => k * k * (3 - 2 * k);
const PI = Math.PI;
// The easing library. Names follow easings.net; motion.md says which one each kind of move uses (measured on the references).
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
// aliases scenes may write
E.linear = E.lin; E.inOutCubic ??= E.inOutCubic; E.sine = E.inOutSine; E.cubic = E.inOutCubic; E.quint = E.inOutQuint; E.expo = E.inOutExpo; E.back = E.outBack;
export const easeFn = f => typeof f === 'function' ? f : E[f] || E.inOutCubic;
export const ease = (t, a, b, f = E.inOutCubic) => easeFn(f)(seg(t, a, b));
/** A damped spring's step response at time x (seconds after the change): 0 -> 1 with overshoot. freq Hz, damp 0..1 (1 = no overshoot). */
export function springStep(x, freq = 3, damp = .45) {
  if (x <= 0) return 0;
  const w = 2 * PI * freq, z = Math.min(.999, damp), wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
}
export const V3 = (x = 0, y = 0, z = 0) => Array.isArray(x) ? new THREE.Vector3(x[0], x[1] ?? 0, x[2] ?? 0) : x?.isVector3 ? x.clone() : new THREE.Vector3(x, y, z);
// seeded random (mulberry32): rnd(seed) -> () => [0, 1)
export function rnd(seed = 1) { let a = (seed * 2654435761) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const hash = (n, seed = 0) => { const s = Math.sin((n + seed * 57.3) * 127.1) * 43758.5453; return s - Math.floor(s); };
// smooth deterministic noise 1D (sway, drift, flicker)
export function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1; }
export const fbm1 = (x, seed = 0) => noise1(x, seed) * .6 + noise1(x * 2.13, seed + 7) * .28 + noise1(x * 4.7, seed + 13) * .12;

// ---------- colours ----------
export const C = {
  ink: '#2a1d17', outline: '#2a1d17', white: '#ffffff', cream: '#f6ecd9', paper: '#efe3c8',
  skin: '#f1d3b3', skinTan: '#d9a77c', skinBrown: '#9c6a45', skinDeep: '#5f3d29', skinPale: '#f7e0cb',
  red: '#e2432f', orange: '#f08a2a', yellow: '#f6c945', green: '#5fae4a', teal: '#2f9c95', blue: '#3f6fd1', navy: '#1d2b4f', purple: '#7a4fc4', pink: '#ee7fa6',
  wood: '#a46a3c', woodDark: '#6e4325', metal: '#9aa3ad', steel: '#c9d0d8', gold: '#e9b44c', glass: '#bfe3f2',
  night: '#0d1020', neonPink: '#ff3fa4', neonBlue: '#33c7ff', neonPurple: '#a052ff', lamp: '#ffd28a', fire: '#ff8a2a',
  sky: '#7ec4ef', skyTop: '#4a9be0', sea: '#1f8ccf', seaDeep: '#0b4f8a', sand: '#efd19a', grass: '#79b64a', leaf: '#3f9a3a',
  caption: '#ffffff', captionStroke: '#000000', mark: '#e21f26',
};
const _rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const _lum = h => { const [r, g, b] = _rgb(h).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const _mix = (a, b, k) => '#' + _rgb(a).map((c, i) => Math.round((c + (_rgb(b)[i] - c) * k) * 255).toString(16).padStart(2, '0')).join('');
export const contrast = (a, b) => { const x = _lum(a), y = _lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
export const textOn = c => contrast('#ffffff', c) >= contrast('#101014', c) ? '#ffffff' : '#101014';
export const mixHex = _mix;
export const shade = (hexc, k) => _mix(hexc, k < 0 ? '#000000' : '#ffffff', Math.abs(k));
const _brand = typeof SETTINGS.brand?.color === 'string' && /^#[0-9a-f]{6}$/i.test(SETTINGS.brand.color) ? SETTINGS.brand.color.toLowerCase() : null;
export const BRAND = { on: !!_brand, color: _brand ?? '#f6c945', ink: textOn(_brand ?? '#f6c945') };
C.brand = BRAND.color; C.brandInk = BRAND.ink;
export const hex = c => typeof c === 'number' ? c : typeof c === 'string' ? new THREE.Color(c).getHex() : c?.isColor ? c.getHex() : 0xffffff;
export const css = c => typeof c === 'string' ? c : '#' + new THREE.Color(c).getHexString();

// ---------- canvas textures ----------
/** A canvas drawn by fn(ctx, w, h) as a texture (smooth by default; nearest for pixel screens). */
export function canvasTex(w, h, fn, { nearest = false, mip = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); fn(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.generateMipmaps = mip && !nearest; t.minFilter = nearest ? THREE.NearestFilter : mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.userData.canvas = c; t.userData.draw = fn;
  return t;
}
/** Re-draw a canvasTex (counters, screens that change). */
export function redraw(t, fn) { const c = t.userData.canvas, x = c.getContext('2d'); (fn || t.userData.draw)(x, c.width, c.height); t.needsUpdate = true; }

// ---------- number formatting in the narration's language ----------
export function fmt(n, o = {}) { try { return new Intl.NumberFormat(globalThis.__CZ_LANG || 'en', o).format(n); } catch { return String(n); } }

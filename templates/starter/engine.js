// Toon Studio engine - STARTER. The plain base every Style Studio style can grow from: 2D or 3D, 9:16 or 16:9,
// word-timed shots, word-highlight captions, cut / dissolve / push transitions, a light film finish, and the checks
// behind check_layout. No look of its own beyond a neutral palette: a style reshapes it through the extension points.
//
//   2D (settings.dim '2d'): orthographic, pixels, origin at the frame centre, y up. Everything is an unlit flat shape.
//   3D (settings.dim '3d'): metres, y up, the ground at y = 0, a perspective camera, key + hemisphere light, soft shadows,
//       supersampling. 2D elements (text, labels, cards ...) go on the shot's HUD layer, in pixels, over the 3D picture.
//
// EXTENSION POINTS (the only places a style changes the engine; never rename or remove an export):
//   THEMES            palettes (THEMES.base is the default; settings.theme picks one)
//   registerElement   new elements:  registerElement('pin', (p, o) => group)  ->  EL.pin(p, o)
//   LAYOUT_CHECKS     extra checks:  LAYOUT_CHECKS.push((S, t, def) => [{ type, detail }])
//   TRANSITIONS       GLSL bodies:   TRANSITIONS.iris = 'return ...;'  (shot({ trans: 'iris' }))
//   POST_UNIFORMS / POST_GLSL        extra finishing passes on the final picture
// RULES: scenes are pure functions of time. No Math.random (use rng(seed)), no Date.now / performance.now, no DOM, no
// network, no timers. Fonts: Inter + JetBrains Mono (SIL Open Font License).
import * as THREE from 'three';
export { THREE };

export const ENGINE_KIND = 'starter';
export const ENGINE_VERSION = 1;                 // bump when the engine changes (projects get an Update engine button)

// ---------- settings (project.json "settings", merged over DEFAULTS) ----------
export const DEFAULTS = {
  format: 'landscape',                           // 'landscape' 1920 x 1080 | 'vertical' 1080 x 1920 (set when the project is made)
  dim: '2d',                                     // '2d' | '3d' (set when the project is made)
  theme: 'base',                                 // a key of THEMES
  captions: { on: true, size: 56 },              // word-highlight captions in the reserved band (BAND)
  post: { grain: .035, vignette: .12, contrast: 1, desat: 0, warmth: 0 },
  camera: { push: .04, punch: .02, fov: 40 },    // slow push-in per shot; a small zoom that eases out after the cut; 3D field of view
  transitions: { duration: .4 },                 // seconds, centred on each shot start
  quality: { ss: null, shadows: true },          // ss: supersampling (null = 2 in 3D, 1 in 2D); shadows: 3D soft shadows
};
const merge = (a, b) => { const o = { ...a }; for (const k in b || {}) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; };
export const SETTINGS = merge(DEFAULTS, globalThis.__CZ_SETTINGS || {});
export const VERT = SETTINGS.format === 'vertical';
export const DIM = SETTINGS.dim === '3d' ? '3d' : '2d';
export const W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080;
export const FW = W, FH = H, AW = W, AH = H;
// the live preview on a slow computer (host.js sets __CZ_PREVIEW_SCALE, never for exports or stills)
export const PREVIEW_SCALE = Math.min(1, Math.max(.25, +globalThis.__CZ_PREVIEW_SCALE || 1));
export const SS = Math.max(1, Math.min(2, +(SETTINGS.quality?.ss ?? (DIM === '3d' ? 2 : 1)) || 1));
const LANG = globalThis.__CZ_LANG || 'en';

// ---------- layout per format (pixels, origin at the centre, y up) ----------
// SAFE: what the phone / player UI never covers. BAND: the caption band (nothing important there). ZONE: where content
// goes. TITLE: title() defaults. GY: the 2D ground line.
export const SAFE = VERT ? { x0: -480, x1: 480, y0: -540, y1: 760 } : { x0: -900, x1: 900, y0: -480, y1: 480 };
export const BAND = VERT ? { y0: -700, y1: -520 } : { y0: -470, y1: -370 };
export const ZONE = VERT ? { x0: -540, x1: 540, y0: -480, y1: 860 } : { x0: -960, x1: 960, y0: -330, y1: 480 };
export const TITLE = VERT ? { y: 640, maxW: 920, top: 120 } : { y: 380, maxW: 1500, top: 80 };
export const GY = VERT ? -420 : -300;

// ---------- maths, easing, seeded randomness ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a || 1e-6));
export const E = {
  lin: k => k,
  outCubic: k => 1 - Math.pow(1 - k, 3),
  inCubic: k => k * k * k,
  inOutCubic: k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outQuint: k => 1 - Math.pow(1 - k, 5),
  inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2,
  outBack: (k, s = 1.7) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),
  outBounce: k => { const n = 7.5625, d = 2.75; return k < 1 / d ? n * k * k : k < 2 / d ? n * (k -= 1.5 / d) * k + .75 : k < 2.5 / d ? n * (k -= 2.25 / d) * k + .9375 : n * (k -= 2.625 / d) * k + .984375; },
};
export const ease = (t, a, b, f = E.outCubic) => f(seg(t, a, b));
export const pop = (t, t0, d = .28) => (t < t0 ? 0 : E.outBack(seg(t, t0, t0 + d), 2));
export const bump = (t, a, b) => Math.sin(Math.PI * seg(t, a, b));
/** A seeded random generator (mulberry32): const r = rng(7); r() -> 0..1. The only randomness scenes may use. */
export function rng(seed = 1) {
  let a = (Math.imul(seed | 0, 2654435761) >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
/** A number written the narration language's way (1,234.5 / 1.234,5). */
export const fmt = (v, d = 0) => { try { return Number(v).toLocaleString(LANG, { minimumFractionDigits: d, maximumFractionDigits: d }); } catch { return Number(v).toFixed(d); } };

// ---------- colour ----------
const hx = c => typeof c === 'number' ? c : typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : new THREE.Color(c).getHex();
export const css = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : '#' + hx(c).toString(16).padStart(6, '0');
/** k > 0 mixes toward white, k < 0 toward black (keeps the hue). Returns '#rrggbb'. */
export function tint(c, k) {
  const h = hx(c), f = v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return css((f((h >> 16) & 255) << 16) | (f((h >> 8) & 255) << 8) | f(h & 255));
}
const _rgb = h => [1, 3, 5].map(i => parseInt(css(h).slice(i, i + 2), 16) / 255);
const _lum = h => { const [r, g, b] = _rgb(h).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const _mix = (a, b, k) => '#' + _rgb(a).map((c, i) => Math.round((c + (_rgb(b)[i] - c) * k) * 255).toString(16).padStart(2, '0')).join('');
/** WCAG contrast ratio of two colours (1..21). Text needs >= 3 (big) / 4.5 (small). */
export const contrast = (a, b) => { const x = _lum(a), y = _lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
/** c moved toward white or black until it reads on bg. */
export const legibleOn = (c, bg, min = 3) => { const to = contrast('#ffffff', bg) > contrast('#000000', bg) ? '#ffffff' : '#000000';
  for (let k = 0; k <= 1.001; k += .05) { const o = k ? _mix(c, to, Math.min(1, k)) : css(c); if (contrast(o, bg) >= min) return o; } return to; };
/** The text colour that reads on a fill: white or near-black. */
export const textOn = c => contrast('#ffffff', c) >= contrast('#111111', c) ? '#ffffff' : '#111111';

// ---------- THEMES (extension point) ----------
// A theme is the style's palette. Keys every theme must have (C.<key> in scenes): bg bg2 surface ink muted accent accent2
// good bad line ground sky floor, plus dark (true for dark grounds) and light { key, hemi } (3D light intensities).
export const THEMES = {
  base: { bg: '#f3f1ec', bg2: '#e4e0d7', surface: '#ffffff', ink: '#1c1c1e', muted: '#66666c', accent: '#2f6df6', accent2: '#f0643c',
    good: '#1f9d6a', bad: '#d93f45', line: '#c7c1b5', ground: '#cfc9bd', sky: '#ffffff', floor: '#8c867b', dark: false, light: { key: 2.2, hemi: 1.4 } },
  dark: { bg: '#16171b', bg2: '#24262d', surface: '#2b2e36', ink: '#f2f2f4', muted: '#a0a2ab', accent: '#6b95ff', accent2: '#ff875c',
    good: '#3cc58c', bad: '#ff5d63', line: '#3d4049', ground: '#3a3c44', sky: '#c9d4ff', floor: '#202126', dark: true, light: { key: 2.4, hemi: .8 } },
};
// (light: three.js physical units - a white surface square to a key of intensity PI reads white; key + hemi ~ PI keeps the
// lit faces just below clipping)
export const THEME = THEMES[SETTINGS.theme] ?? THEMES.base;
export const C = Object.fromEntries(Object.entries(THEME).filter(([, v]) => typeof v === 'string'));
// ---------- brand colour (settings.brand.color '#rrggbb'; unset = the theme's accent) ----------
const _brand = typeof SETTINGS.brand?.color === 'string' && /^#[0-9a-f]{6}$/i.test(SETTINGS.brand.color) ? SETTINGS.brand.color.toLowerCase() : null;
export const BRAND = { on: !!_brand, color: _brand ?? C.accent, ink: textOn(_brand ?? C.accent), caption: _brand ? legibleOn(_brand, '#111111', 3) : '#ffd23d' };
C.brand = BRAND.color; C.brandInk = BRAND.ink;

// ---------- the app's hooks (host.js) ----------
export const SUITE = { module: null, pick: null, at: null, base: '' };
function caller() {
  for (const l of (new Error().stack || '').split('\n')) {
    if (l.includes('/engine.js') || l.includes('/models.js') || l.includes('/lib/')) continue;
    const m = l.match(/((?:scenes\/)?[\w.-]+\.js):(\d+):\d+/);
    if (m && !m[1].startsWith('host')) return { file: m[1], line: +m[2] };
  }
  return null;
}
export const PICKABLE = o => o.isMesh && !o.userData.noPick;

// ---------- timeline / cue ----------
let WORDS = [];
const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
export async function loadTimeline(url) {
  const phrases = await (await fetch(url)).json();
  WORDS = phrases.flatMap((p, pi) => (p.words || []).map(w => ({ ...w, n: norm(w.w), pi })));
  CAPS = null;
}
/** Time the spoken word(s) start (which = 'e': end), the occurrence nearest `near` seconds. Always time events with it. */
export function cue(word, near, which = 's') {
  const parts = String(word).split(' ').map(norm);
  if (!parts.some(Boolean)) { console.warn('cue miss', word, near); return near; }
  let best = null, bd = 1e9;
  for (let i = 0; i < WORDS.length; i++) {
    if (!parts.every((p, k) => WORDS[i + k] && WORDS[i + k].n.startsWith(p))) continue;
    const d = Math.abs(WORDS[i].s - near); if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[i + parts.length - 1].e; }
  }
  if (best === null && parts.length === 1 && parts[0]) for (let i = 0; i < WORDS.length; i++) {   // no-space languages
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
THREE.ColorManagement.enabled = false;                            // hex in = hex out
export const glCanvas = document.createElement('canvas');
export const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, stencil: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(Math.round(FW * PREVIEW_SCALE), Math.round(FH * PREVIEW_SCALE), false);
renderer.localClippingEnabled = true;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const SHADOWS = DIM === '3d' && SETTINGS.quality?.shadows !== false;
renderer.shadowMap.enabled = SHADOWS; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
export const outCanvas = glCanvas;
const RW = Math.round(FW * PREVIEW_SCALE * SS), RH = Math.round(FH * PREVIEW_SCALE * SS);
const mkRT = () => new THREE.WebGLRenderTarget(RW, RH, { samples: SS > 1 ? 0 : 4, stencilBuffer: true });
const rtA = mkRT(), rtB = mkRT();
const hudCam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -1000, 1000);

// =====================================================================================================================
// ELEMENTS. Every element is tagged in userData: el (true), kind ('rect', 'box', ...), role ('form' | 'text' | 'solid' |
// 'thickness' | 'detail' | 'ground'), plus size (text px / 3D [w, h, d]) - the checks read these tags.
// p = parent group; null/undefined inside build(S) = the shot's default layer (2D: S.root, in 3D: S.hud for 2D elements
// and S.root for 3D elements).
// =====================================================================================================================
const CUR = { S: null, root: null, hud: null, flat: null };
let ORDER = 0, ROLE = 'form';
/** Builds meshes inside fn with a QA role: 'detail' (must lie inside the element's form) | 'thickness' (depth below it). */
export function withRole(r, fn) { const prev = ROLE; ROLE = r; try { return fn(); } finally { ROLE = prev; } }
const p2 = (p, what) => {
  const g = p || CUR.flat; if (!g) throw new Error(`${what}(): no parent - call it inside a shot's build(S), or pass a group as the first argument`);
  if (DIM === '3d' && CUR.root && underG(g, CUR.root)) throw new Error(`${what}() is a 2D element (pixels): in a 3D project it goes on the HUD (no parent, S.hud or a group in it), never into the 3D world (S.root)`);
  return g;
};
const p3 = (p, what) => {
  if (DIM !== '3d') throw new Error(`${what}() is a 3D element and this project is 2D (settings.dim '2d'): use rect / rrect / circle / card`);
  const g = p || CUR.root; if (!g) throw new Error(`${what}(): no parent - call it inside a shot's build(S), or pass a group`);
  if (CUR.hud && underG(g, CUR.hud)) throw new Error(`${what}() is a 3D element (metres): it goes into the 3D world (no parent, S.root or a group in it), never onto the HUD`);
  return g;
};
/** For registered elements: the parent a 2D (pixels) / 3D (metres) element goes into (p, or the shot's default layer). */
export const in2d = (p, what = 'element') => p2(p, what), in3d = (p, what = 'element') => p3(p, what);
const tagEl = (o, kind, role = 'form', extra = {}) => { Object.assign(o.userData, { el: true, kind, role, ...extra }); return o; };
function mat2(color, o = {}) {
  return new THREE.MeshBasicMaterial({ color: hx(color), transparent: true, opacity: o.opacity ?? 1, depthTest: false, depthWrite: false, side: THREE.DoubleSide, map: o.map || null });
}
function mesh2(geo, color, o) { const m = new THREE.Mesh(geo, mat2(color, o)); m.renderOrder = ORDER++; m.userData.role = ROLE; return m; }
const at = (p, m, x = 0, y = 0) => { m.position.set(x || 0, y || 0, 0); p.add(m); return m; };
export function rrShape(w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ---------- 2D (pixels) ----------
/** A group to build composites in. No parent inside build(S): S.root (in 3D that is the world; a 2D group on a 3D
 *  shot's HUD is group(S.hud)). */
export function group(p, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); (p || CUR.root)?.add(g); return g; }
export const rect = (p, w, h, color, x, y, o) => tagEl(at(p2(p, 'rect'), mesh2(new THREE.PlaneGeometry(w, h), color, o), x, y), 'rect');
export const rrect = (p, w, h, r, color, x, y, o) => tagEl(at(p2(p, 'rrect'), mesh2(new THREE.ShapeGeometry(rrShape(w, h, r), 16), color, o), x, y), 'rrect');
export const circle = (p, r, color, x, y, o) => tagEl(at(p2(p, 'circle'), mesh2(new THREE.CircleGeometry(r, Math.max(32, Math.min(128, r | 0))), color, o), x, y), 'circle');
export const poly = (p, pts, color, x, y, o) => tagEl(at(p2(p, 'poly'), mesh2(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)))), color, o), x, y), 'poly');
/** A round-capped stroke from (x1, y1) to (x2, y2). g.userData.set(k) grows it 0..1 (S.line does that on a cue). */
export function line(p, x1, y1, x2, y2, w = 8, color = C.ink, o = {}) {
  const g = group(p2(p, 'line'), x1, y1), len = Math.hypot(x2 - x1, y2 - y1);
  g.rotation.z = Math.atan2(y2 - y1, x2 - x1);
  const bar = at(g, mesh2(new THREE.ShapeGeometry(rrShape(len + w, w, w / 2), 8), color, o), len / 2, 0);
  g.userData.set = k => { const L = Math.max(1e-4, len * k); bar.scale.x = (L + w) / (len + w); bar.position.x = L / 2; g.visible = k > .001; };
  return tagEl(g, 'line', 'form', { len });
}
/** A stroke with an arrow head at (x2, y2). g.userData.set(k) grows it. */
export function arrow(p, x1, y1, x2, y2, w = 10, color = C.ink, o = {}) {
  const g = group(p2(p, 'arrow'), x1, y1), len = Math.hypot(x2 - x1, y2 - y1), hd = o.head ?? w * 3.4;
  g.rotation.z = Math.atan2(y2 - y1, x2 - x1);
  const bar = at(g, mesh2(new THREE.ShapeGeometry(rrShape(len, w, w / 2), 8), color, o), len / 2, 0);
  const head = group(g, len, 0); at(head, mesh2(new THREE.ShapeGeometry(new THREE.Shape([[0, 0], [-hd, hd * .58], [-hd, -hd * .58]].map(([a, b]) => new THREE.Vector2(a, b)))), color, o));
  const set = k => { const tip = len * k, L = Math.max(1e-4, tip - hd * .7); bar.scale.x = L / len; bar.position.x = L / 2; head.position.x = tip; g.visible = k > .001; };
  set(1); g.userData.set = set;
  return tagEl(g, 'arrow', 'form', { len });
}

// ---------- text (canvas texture, 2x supersampled) ----------
export const FONT = 'Inter', MONO = 'JetBrains Mono';
export const FONT_FILES = [['Inter', 'fonts/inter-800.woff2', '800', 'normal'], ['Inter', 'fonts/inter-600.woff2', '600', 'normal'],
  ['JetBrains Mono', 'fonts/JetBrainsMono-400.woff2', '400', 'normal'], ['JetBrains Mono', 'fonts/JetBrainsMono-700.woff2', '700', 'normal']];
const _mc = document.createElement('canvas').getContext('2d');
function wrapLines(str, font, maxW) {
  _mc.font = font; const out = [];
  for (const para of String(str).split('\n')) {
    let cur = '';
    for (const w of para.split(' ')) { const nx = cur ? cur + ' ' + w : w; if (cur && _mc.measureText(nx).width > maxW) { out.push(cur); cur = w; } else cur = nx; }
    out.push(cur);
  }
  return out;
}
/** text(p, 'Hello', { size = 48, weight = 800, color, font, align = 'center' | 'left' | 'right', x, y, lineH, stroke, strokeW,
 *  wrap: px width to wrap at, maxW: px width to shrink to }) -> mesh (userData.w / h = drawn size, size = font px). */
export function text(p, str, { size = 48, weight = 800, color = C.ink, font = FONT, align = 'center', x = 0, y = 0, lineH = 1.15, stroke = null, strokeW = 0, tracking = 0, wrap = 0, maxW = 0, opacity } = {}) {
  const SSX = 2; color = css(color); if (stroke != null) stroke = css(stroke);
  const fam = font === MONO || font === 'mono' ? `"${MONO}", monospace` : `"${font}", Inter, sans-serif`;
  if (maxW) { _mc.font = `${weight} ${size}px ${fam}`; const wMax = Math.max(...String(str).split('\n').map(l => _mc.measureText(l).width)); if (wMax > maxW) size = Math.floor(size * maxW / wMax); }
  const fnt = `${weight} ${size * SSX}px ${fam}`;
  const lines = wrap ? wrapLines(str, `${weight} ${size}px ${fam}`, wrap) : String(str).split('\n');
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = fnt; if (tracking) g.letterSpacing = `${tracking * SSX}px`;
  const pad = (strokeW + 6) * SSX;
  const tw = Math.ceil(Math.max(1, ...lines.map(l => g.measureText(l).width))) + pad * 2, th = Math.ceil(lines.length * size * lineH * SSX) + pad * 2;
  c.width = tw; c.height = th;
  g.font = fnt; if (tracking) g.letterSpacing = `${tracking * SSX}px`;
  g.textBaseline = 'middle'; g.textAlign = align; g.lineJoin = 'round';
  const ax = align === 'center' ? tw / 2 : align === 'left' ? pad : tw - pad;
  lines.forEach((l, i) => {
    const ly = pad + (i + .5) * size * lineH * SSX + size * .04 * SSX;
    if (stroke && strokeW) { g.strokeStyle = stroke; g.lineWidth = strokeW * 2 * SSX; g.strokeText(l, ax, ly); }
    g.fillStyle = color; g.fillText(l, ax, ly);
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const m = withRole('text', () => mesh2(new THREE.PlaneGeometry(tw / SSX, th / SSX), 0xffffff, { map: tex, opacity }));
  const off = align === 'center' ? 0 : align === 'left' ? tw / SSX / 2 - pad / SSX : -(tw / SSX / 2 - pad / SSX);
  m.position.set(x + off, y, 0); p2(p, 'text').add(m);
  return tagEl(m, 'text', 'text', { size, color, text: String(str), w: tw / SSX - pad * 2 / SSX, h: lines.length * size * lineH });
}
/** A title: centred, every line the same size, shrunk to TITLE.maxW, kept TITLE.top below the frame top. */
export function title(p, str, { y = TITLE.y, size = 104, color = C.ink, weight = 800, lineH = 1.08, colors, stroke = null, strokeW = 0 } = {}) {
  const g = group(p2(p, 'title')), lines = String(str).split('\n');
  _mc.font = `${weight} ${size}px "${FONT}", Inter, sans-serif`;
  const wMax = Math.max(...lines.map(l => _mc.measureText(l).width)); const sz = wMax > TITLE.maxW ? Math.floor(size * TITLE.maxW / wMax) : size;
  const top = Math.min(y + (lines.length - 1) * sz * lineH / 2, H / 2 - TITLE.top - sz / 2);
  lines.forEach((l, i) => text(g, l, { size: sz, weight, color: colors?.[i] ?? color, stroke, strokeW, y: top - i * sz * lineH }));
  return tagEl(g, 'title', 'form', { text: String(str) });
}
/** A text on its own rounded plate (readable on anything). userData.bg = the plate colour. */
export function label(p, str, { x = 0, y = 0, size = 40, color, fill = C.surface, padX = 26, padY = 14, r = 16, weight = 700, font = FONT } = {}) {
  const g = group(p2(p, 'label'), x, y); color = color ?? textOn(fill);
  const t = text(g, str, { size, color, weight, font });
  const w = t.userData.w + padX * 2, h = t.userData.h + padY * 2;
  const bg = rrect(g, w, h, r, fill); bg.renderOrder = t.renderOrder - .5;
  return tagEl(g, 'label', 'form', { bg: css(fill), w, h, text: String(str) });
}
/** A pill tag (brand colour by default). */
export function tag(p, str, { x = 0, y = 0, size = 40, fill = BRAND.color, color, padX = 24, padY = 10 } = {}) {
  const g = label(p, str, { x, y, size, fill, color: color ?? textOn(fill), padX, padY, r: 999, weight: 800 });
  return tagEl(g, 'tag');
}
/** A panel with a title and body text (body wraps inside the card). userData.bg = its fill. */
export function card(p, { w = 560, h = 320, r = 22, fill = C.surface, x = 0, y = 0, title: tt = '', body = '', titleSize = 52, bodySize = 40, color, pad = 36, depth = 8 } = {}) {
  const g = group(p2(p, 'card'), x, y); color = color ?? textOn(fill);
  if (depth) withRole('thickness', () => rrect(g, w, h, r, tint(fill, THEME.dark ? -.45 : -.16), 0, -depth));
  rrect(g, w, h, r, fill);
  let yy = h / 2 - pad;
  if (tt) { const t = text(g, tt, { size: titleSize, color, align: 'left', x: -w / 2 + pad, wrap: w - pad * 2 }); t.position.y = yy - t.userData.h / 2; yy -= t.userData.h + titleSize * .35; }
  if (body) { const b = text(g, body, { size: bodySize, weight: 600, color: tint(color, THEME.dark ? -.15 : .25), align: 'left', x: -w / 2 + pad, wrap: w - pad * 2 }); b.position.y = yy - b.userData.h / 2; }
  return tagEl(g, 'card', 'form', { bg: css(fill), w, h });
}
/** A number that counts from `from` to `to` over [at, at + dur] (inside build: animates by itself). */
export function counter(p, { from = 0, to = 100, at: t0 = 0, dur = 1.2, decimals = 0, prefix = '', suffix = '', size = 120, color = C.ink, weight = 800, x = 0, y = 0, font = FONT } = {}) {
  const g = group(p2(p, 'counter'), x, y); let cur = null, shown = null;
  const set = t => { const v = lerp(from, to, E.outCubic(seg(t, t0, t0 + dur))), s = prefix + fmt(v, decimals) + suffix;
    if (s === shown) return; shown = s;
    if (cur) { g.remove(cur); cur.geometry.dispose(); cur.material.map?.dispose(); cur.material.dispose(); }
    cur = text(g, s, { size, color, weight, font }); };
  set(t0 + dur); g.userData.set = set;
  CUR.S?.ticks.push(set);
  return tagEl(g, 'counter', 'form', { size });
}
/** A picture from project.json "images" (IMG[key]); w and/or h in px (the other follows the picture's aspect). */
export function image(p, key, { w, h, x = 0, y = 0, opacity } = {}) {
  const im = IMG[key];
  if (!im) { console.warn(`image missing: "${key}" (project.json "images")`); const ph = rect(p, w || 400, h || 300, C.bg2, x, y); return tagEl(ph, 'image', 'form', { missing: key }); }
  const ar = im.naturalWidth / Math.max(1, im.naturalHeight); if (!w && !h) w = 600; if (!h) h = w / ar; if (!w) w = h * ar;
  const tex = new THREE.Texture(im); tex.needsUpdate = true; tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tagEl(at(p2(p, 'image'), mesh2(new THREE.PlaneGeometry(w, h), 0xffffff, { map: tex, opacity }), x, y), 'image', 'form', { key });
}

// ---------- 3D (metres; every solid's origin is the middle of its BOTTOM, so y = 0 stands it on the ground) ----------
function mat3(color, o = {}) { return new THREE.MeshStandardMaterial({ color: hx(color), roughness: o.rough ?? .78, metalness: o.metal ?? 0, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1 }); }
function solid(p, what, geo, color, o, size, yOff) {
  const g = new THREE.Group(), m = new THREE.Mesh(geo, mat3(color, o));
  m.position.y = yOff; m.castShadow = m.receiveShadow = true; g.add(m);
  g.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0); g.rotation.y = o.ry ?? 0;
  p3(p, what).add(g);
  return tagEl(g, what, 'solid', { solid: true, size });
}
export const box = (p, w = 1, h = 1, d = 1, color = C.surface, o = {}) => solid(p, 'box', new THREE.BoxGeometry(w, h, d), color, o, [w, h, d], h / 2);
export const sphere = (p, r = .5, color = C.surface, o = {}) => solid(p, 'sphere', new THREE.SphereGeometry(r, 48, 32), color, o, [r * 2, r * 2, r * 2], r);
export const cyl = (p, r = .5, h = 1, color = C.surface, o = {}) => solid(p, 'cyl', new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg ?? 48), color, o, [r * 2, h, r * 2], h / 2);
/** The floor: a plane at y (0) that takes shadows. Never checked for floating / overlap. */
export function ground(p, { size = 400, color = C.ground, y = 0 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat3(color, { rough: .95 }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; p3(p, 'ground').add(m);
  return tagEl(m, 'ground', 'ground', { ground: true });
}

// ---------- registerElement (extension point) ----------
/** Every element by name: the built-ins and the ones a style registers. */
export const EL = { rect, rrect, circle, poly, line, arrow, text, title, label, tag, card, counter, image, box, sphere, cyl, ground, group };
const BUILTIN_EL = new Set(Object.keys(EL));
/** registerElement('pin', (p, o) => { const g = group(p); ...; return g; }) -> EL.pin. A built-in is never replaced. */
export function registerElement(name, fn) {
  if (!/^[a-z][A-Za-z0-9]{1,40}$/.test(name)) throw new Error(`registerElement: "${name}" is not a valid name (camelCase letters and digits)`);
  if (BUILTIN_EL.has(name)) throw new Error(`registerElement: "${name}" is a built-in element; pick another name (built-ins are never replaced)`);
  if (typeof fn !== 'function') throw new Error(`registerElement: "${name}" needs a function (p, opts) => Object3D`);
  EL[name] = (...a) => { const o = fn(...a); if (!o?.isObject3D) throw new Error(`element "${name}" must return an Object3D (a group or a mesh)`);
    o.userData.el = true; o.userData.kind = name; o.userData.role ??= 'form'; return o; };
  return EL[name];
}

// =====================================================================================================================
// SHOTS
// shot({ t0, name, trans, transDur, captions, focus, post, build(S) -> st, update(st, t, S) })
//   trans: how this shot comes in: 'dissolve' (default) | 'cut' | 'push-left' | 'push-right' | 'push-up' | 'push-down' |
//          any TRANSITIONS key. captions: false hides captions during this shot. focus: [x, y] 2D push target.
//   post: per-shot finish overrides ({ contrast: 1.1 }). Return st: every element to click, check or animate.
// =====================================================================================================================
export const SHOTS = [];
export const EVENTS = [];
let COLLECT = false, END = 0, KEEP = 1, NEARMUL = 1, OVERLAY = true;   // (OVERLAY false: the picture without captions, for the checks)
export function sfx(type, t, o = {}) { if (COLLECT) EVENTS.push({ t: +(+t).toFixed(3), type, pan: o.pan ?? .5, gain: o.gain ?? 0, dur: o.dur ?? 0 }); }
export function shot(def) {
  if (typeof def?.build !== 'function') throw new Error('shot(): needs build(S) { ...; return st; }');
  if (typeof def.t0 !== 'number' || !isFinite(def.t0)) throw new Error('shot(): t0 must be a number of seconds (use cue())');
  const src = caller(); def._file = SUITE.module || src?.file || null; def._line = src?.line ?? null; SHOTS.push(def); return def;
}
const SFX_IN = { pop: 'pop', grow: 'pop', rise: 'pop', drop: 'thud', slide: 'swish', fade: null, none: null };
const V3 = a => a?.isVector3 ? a.clone() : new THREE.Vector3(...a);
const underG = (o, g) => { while (o) { if (o === g) return true; o = o.parent; } return false; };
function bgTexture(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, css(top)); gr.addColorStop(1, css(bottom)); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}
function live(def) {
  if (def._st) return def;
  const scene = new THREE.Scene(), hudScene = new THREE.Scene(), back = new THREE.Group(), root = new THREE.Group(), hud = new THREE.Group();
  scene.add(back); scene.add(root); hudScene.add(hud);
  const cam = DIM === '3d' ? new THREE.PerspectiveCamera(SETTINGS.camera.fov, W / H, .05, 400) : new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -1000, 1000);
  const S = { def, scene, hudScene, cam, back, root, hud, t0: def.t0, t1: def.t1, anims: [], ticks: [], W, H, VERT, DIM, GY, BAND, ZONE, SAFE, TITLE, C,
    focus: def.focus || [0, VERT ? 150 : 90], post: def.post || {}, sparse: false, noCamera: false, kit: false, near: .05, visibility: undefined };
  S.rng = rng(((def._line || 1) * 7919 + Math.round(def.t0 * 100)) | 0);
  // background: S.bg() = the theme's, S.bg(top, bottom) a gradient, S.bg(color) flat. A C key works too: S.bg('bg2').
  S.bg = (a, b) => {
    const col = v => typeof v === 'string' && C[v] ? C[v] : v;
    const top = col(a ?? C.bg), bot = col(b ?? (a == null ? C.bg2 : a)); S._bg = css(top); S._bgTop = top; S._bgBot = bot;
    if (DIM === '3d') { scene.background = css(top) === css(bot) ? new THREE.Color(hx(top)) : bgTexture(top, bot); return; }
    if (S._bgMesh) { back.remove(S._bgMesh); S._bgMesh.geometry.dispose(); S._bgMesh.material.dispose(); }
    const m = S._bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.2, H * 1.2), new THREE.ShaderMaterial({
      uniforms: { a: { value: new THREE.Color(hx(top)) }, b: { value: new THREE.Color(hx(bot)) } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 a; uniform vec3 b; varying vec2 v; void main(){ gl_FragColor=vec4(mix(b,a,smoothstep(0.,1.,v.y)),1.); }' }));
    m.renderOrder = -1e6; m.userData = { noPick: true, ground: true, role: 'ground', kind: 'background' }; back.add(m);
  };
  // the floor: 2D a band below GY; 3D the ground plane at y = 0
  S.ground = (color = C.ground) => {
    if (DIM === '3d') return ground(root, { color });
    const g = group(back); const m = rect(g, W * 1.2, (H / 2 + GY) + H * .1, color, 0, (GY - H / 2 - H * .1) / 2 + 0); m.renderOrder = -1e6 + 1;
    return tagEl(g, 'ground', 'ground', { ground: true });
  };
  // S.add(obj, { at, in, dur, dist, out, outAt, outDur, sfx, gain }): entrance (+ exit) and its sound. Position the object first.
  S.add = (obj, o = {}) => {
    if (!obj?.isObject3D) throw new Error('S.add(obj): obj must be an element (Object3D)');
    const world = DIM === '3d' && underG(obj, root);
    const a = { obj, at: o.at ?? -1, in: o.in ?? 'pop', dur: o.dur ?? (String(o.in).startsWith('slide') ? .45 : .3), out: o.out, outAt: o.outAt, outDur: o.outDur ?? .16,
      pos: obj.position.clone(), scl: obj.scale.clone(), dist: o.dist ?? (world ? 6 : 900), u: world ? 1 / 140 : 1 };
    S.anims.push(a);
    const kind = String(a.in).split('-')[0], snd = o.sfx === false ? null : o.sfx ?? SFX_IN[kind];
    if (snd && a.at > S.t0 - .05) sfx(snd, a.at, { pan: .5 + clamp((world ? 0 : obj.position.x) / W, -.4, .4), gain: o.gain ?? (kind === 'pop' ? -4 : -2) });
    if (a.out && a.outAt != null && o.sfx !== false) sfx(a.out === 'pop' ? 'pop' : 'swish', a.outAt, { gain: -8 });
    return obj;
  };
  // S.line / S.arrow (x1, y1, x2, y2, w, color, { at, dur }): draws on at `at`, then lands
  const grow = (l, o) => { const t0 = o.at ?? S.t0, d = o.dur ?? .3; S.ticks.push(t => l.userData.set(E.outCubic(seg(t, t0, t0 + d)))); if (o.sfx !== false) sfx('click', t0 + d, { gain: -6 }); return l; };
  S.line = (x1, y1, x2, y2, w, color, o = {}) => grow(line(null, x1, y1, x2, y2, w, color, o), o);
  S.arrow = (x1, y1, x2, y2, w, color, o = {}) => grow(arrow(null, x1, y1, x2, y2, w, color, o), o);
  S.tick = f => S.ticks.push(f);
  S.sfx = sfx;
  // 3D camera and light
  S.view = (pos, look = [0, .8, 0], fov = SETTINGS.camera.fov) => { S._view = { pos: V3(pos), look: V3(look), fov }; };
  S.move = keys => { S._keys = keys.map(k => ({ t: k.t, pos: V3(k.pos), look: V3(k.look ?? [0, .8, 0]), fov: k.fov ?? SETTINGS.camera.fov })).sort((x, y) => x.t - y.t); };
  if (DIM === '3d') {
    S.view([0, 2.2, VERT ? 10 : 7.5], [0, 1, 0]);
    const L = THEME.light || { key: 2.2, hemi: 1.4 };
    const hemi = new THREE.HemisphereLight(hx(C.sky ?? '#ffffff'), hx(C.floor ?? '#888888'), L.hemi);
    const key = new THREE.DirectionalLight(0xffffff, L.key); key.position.set(4, 8, 5); key.castShadow = SHADOWS;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .02;
    const sc = key.shadow.camera; sc.left = sc.bottom = -10; sc.right = sc.top = 10; sc.near = .5; sc.far = 40;
    scene.add(hemi, key, key.target); S.lights = { hemi, key };
    // S.light({ key: [x, y, z], intensity, hemi, color, area, shadows })
    S.light = (o = {}) => { if (o.key) key.position.copy(V3(o.key)); if (o.intensity != null) key.intensity = o.intensity; if (o.hemi != null) hemi.intensity = o.hemi;
      if (o.color) key.color.setHex(hx(o.color)); if (o.area) { sc.left = sc.bottom = -o.area; sc.right = sc.top = o.area; sc.updateProjectionMatrix(); } if (o.shadows === false) key.castShadow = false; };
    S.fog = (near, far, color) => { scene.fog = new THREE.Fog(hx(color ?? S._bg ?? C.bg), near, far); };
    // S.toScreen([x, y, z], t?) -> [px, py]: where a 3D point is on screen (HUD pixels) at time t (default: early in the
    // shot) - to place a HUD label or leader line next to a 3D thing. Call it after S.view / S.move.
    S.toScreen = (p, t = def.t0 + .5) => { camera(S, def, t); const v = V3(p).project(cam); return [v.x * W / 2, v.y * H / 2]; };
  }
  CUR.S = S; CUR.root = root; CUR.hud = hud; CUR.flat = DIM === '3d' ? hud : root;
  try { def._S = S; def._st = def.build(S) || {}; } finally { CUR.S = CUR.root = CUR.hud = CUR.flat = null; }
  if (!S._bg) S.bg();
  // 3D: the far ground fades into the background (no hard horizon edge) unless the shot set its own fog
  if (DIM === '3d' && !scene.fog) S.fog(25, 160, _mix(css(S._bgTop ?? C.bg), css(S._bgBot ?? C.bg2), .5));
  return def;
}
function setOpacity(obj, k) {
  obj.traverse(o => { const ms = !o.material ? [] : Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) { if (m.userData.op0 == null) { m.userData.op0 = m.opacity; m.userData.tr0 = m.transparent; }
      const tr = m.userData.tr0 || k < .999; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = m.userData.op0 * k; } });
}
function animate(a, t) {
  const { obj } = a, kind = String(a.in).split('-')[0], dir = String(a.in).split('-')[1];
  obj.position.copy(a.pos); let sx = a.scl.x, sy = a.scl.y, sz = a.scl.z, op = null;
  if (t < a.at) { obj.visible = false; return; }
  obj.visible = true;
  const k = seg(t, a.at, a.at + a.dur);
  if (kind === 'pop') { const s = Math.max(1e-4, E.outBack(k, 2.2)); sx *= s; sy *= s; sz *= s; }
  else if (kind === 'grow') { const s = Math.max(1e-4, E.outBack(k, 1.3)); sx *= s; sy *= s; sz *= s; }
  else if (kind === 'rise') { obj.position.y -= 70 * a.u * (1 - E.outBack(k, 1.5)); if (k < 1) op = E.outCubic(Math.min(1, k / .5)); }
  else if (kind === 'drop') { obj.position.y += 300 * a.u * (1 - E.outBounce(k)); }
  else if (kind === 'slide') { const v = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] }[dir] || [1, 0], e = 1 - E.outBack(k, 1.2);
    obj.position.x += v[0] * a.dist * e; obj.position.y += v[1] * a.dist * e; }
  else if (kind === 'fade') op = E.inOutSine(k);
  if (a.out && a.outAt != null && t >= a.outAt) {
    const q = seg(t, a.outAt, a.outAt + a.outDur), ok = String(a.out).split('-')[0], od = String(a.out).split('-')[1];
    if (q >= 1) { obj.visible = false; return; }
    if (ok === 'pop') { const s = Math.max(1e-4, 1 - E.inCubic(q)); sx *= s; sy *= s; sz *= s; }
    else if (ok === 'fade') op = (op ?? 1) * (1 - q);
    else if (ok === 'slide') { const v = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] }[od] || [-1, 0]; obj.position.x += v[0] * a.dist * E.inCubic(q); obj.position.y += v[1] * a.dist * E.inCubic(q); }
  }
  obj.scale.set(Math.max(1e-4, sx), Math.max(1e-4, sy), Math.max(1e-4, sz));
  if (op != null || obj.userData._faded) { setOpacity(obj, op ?? 1); obj.userData._faded = op != null && op < .999; }
}
function dispose(def) {
  if (!def._st) return;
  for (const sc of [def._S.scene, def._S.hudScene]) sc.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(mm => { mm.map?.dispose?.(); mm.dispose(); }); });
  if (def._S.scene.background?.isTexture) def._S.scene.background.dispose();
  def._st = null; def._S = null; def._checked = null;
}
export const setKeep = n => { KEEP = Math.max(1, Math.min(6, n | 0)); };
export function finalizeShots(end) { SHOTS.sort((a, b) => a.t0 - b.t0); SHOTS.forEach((s, i) => (s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : end)); END = end; }
export function activeIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t0) i++; return i; }
export const transOf = (s, i = SHOTS.indexOf(s)) => s.trans ?? (i <= 0 ? 'cut' : 'dissolve');
const durOf = s => s.transDur ?? SETTINGS.transitions.duration;
function transitionAt(t) {
  for (let j = 1; j < SHOTS.length; j++) { const s = SHOTS[j], ty = transOf(s, j), D = durOf(s); if (ty === 'cut' || !(D > 0)) continue;
    if (t >= s.t0 - D / 2 && t < s.t0 + D / 2) return { A: SHOTS[j - 1], B: s, k: (t - (s.t0 - D / 2)) / D, type: ty }; }
  return null;
}
// the camera of a shot at t: 2D = the content group pushed toward S.focus; 3D = the view (S.view / S.move) dollied toward its look point
function camera(S, def, t) {
  const k = seg(t, def.t0, def.t1 ?? def.t0 + 4), push = S.noCamera ? 0 : SETTINGS.camera.push * E.inOutSine(k);
  const punch = S.noCamera ? 0 : SETTINGS.camera.punch * (1 - E.outCubic(seg(t, def.t0, def.t0 + .4)));
  if (DIM !== '3d') { const z = (1 + push) * (1 + punch); S.root.scale.setScalar(z); S.root.position.set(S.focus[0] * (1 - z), S.focus[1] * (1 - z), 0); return; }
  let v = S._view;
  if (S._keys?.length) { const ks = S._keys; let j = 0; while (j + 1 < ks.length && t >= ks[j + 1].t) j++; const a = ks[j], b = ks[Math.min(j + 1, ks.length - 1)];
    const q = b === a ? 0 : E.inOutSine(seg(t, a.t, b.t)); v = { pos: a.pos.clone().lerp(b.pos, q), look: a.look.clone().lerp(b.look, q), fov: lerp(a.fov, b.fov, q) }; }
  const f = Math.max(.2, 1 - push - punch);
  S.cam.position.copy(v.look).addScaledVector(v.pos.clone().sub(v.look), f);
  const near = S.near * NEARMUL; if (S.cam.fov !== v.fov || S.cam.near !== near) { S.cam.fov = v.fov; S.cam.near = near; S.cam.updateProjectionMatrix(); }
  S.cam.lookAt(v.look); S.cam.updateMatrixWorld(true); S._look = v.look;
}
function step(def, t) {
  live(def); const S = def._S;
  for (const a of S.anims) animate(a, t);
  for (const f of S.ticks) f(t);
  def.update?.(def._st, t, S);
  camera(S, def, t);
  return S;
}
function renderShot(S, rt) {
  renderer.setRenderTarget(rt); renderer.setClearColor(hx(S._bg ?? C.bg), 1); renderer.clear();
  renderer.render(S.scene, S.cam);
  renderer.autoClear = false; renderer.render(S.hudScene, hudCam); renderer.autoClear = true;
}

// ---------- TRANSITIONS + finish (extension points) ----------
// A transition is a GLSL body returning the blended colour: A(uv) / B(uv) sample the outgoing / incoming shot, v = uv,
// e = eased progress 0..1, dir = the push direction ('push-left' -> (1, 0)). 'cut' is not a shader.
export const TRANSITIONS = {
  dissolve: 'return mix(A(v), B(v), e);',
  push: 'vec2 ua = v + dir * e, ub = v + dir * e - dir; return (ub.x >= 0. && ub.x <= 1. && ub.y >= 0. && ub.y <= 1.) ? B(ub) : A(ua);',
};
// The final picture's finish: SETTINGS.post (+ a shot's post) feeds grain, vignette, contrast, desat, warmth. A style adds
// passes with POST_UNIFORMS (name -> { value }) and POST_GLSL (statements on vec3 c, with v = uv), e.g.
//   POST_UNIFORMS.tintAmt = { value: .2 }; POST_GLSL.push('c = mix(c, vec3(1., .9, .7) * c, tintAmt);');
export const POST_UNIFORMS = {};
export const POST_GLSL = [];
let comp = null, compMat = null, TNAMES = [];
const compScene = new THREE.Scene(), compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function ensureComp() {
  if (comp) return;
  TNAMES = Object.keys(TRANSITIONS);
  const fns = TNAMES.map((n, i) => `vec4 tr${i}(vec2 v, float e, vec2 dir) { ${TRANSITIONS[n]} }`).join('\n');
  const pick = TNAMES.map((n, i) => `${i ? 'else ' : ''}if (mode < ${i}.5) col = tr${i}(v, e, dir);`).join(' ');
  const extra = Object.keys(POST_UNIFORMS).map(k => `uniform float ${k};`).join(' ');
  compMat = new THREE.ShaderMaterial({
    uniforms: { ta: { value: rtA.texture }, tb: { value: rtB.texture }, k: { value: 0 }, mode: { value: -1 }, dir: { value: new THREE.Vector2(1, 0) },
      seed: { value: 0 }, grain: { value: 0 }, vignette: { value: 0 }, contrast: { value: 1 }, desat: { value: 0 }, warmth: { value: 0 }, res: { value: new THREE.Vector2(FW, FH) }, ...POST_UNIFORMS },
    vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform sampler2D ta, tb; uniform float k, mode, seed, grain, vignette, contrast, desat, warmth; uniform vec2 dir, res; ${extra} varying vec2 v;
      vec4 A(vec2 u) { return texture2D(ta, u); } vec4 B(vec2 u) { return texture2D(tb, u); }
      ${fns}
      void main() {
        float e = k * k * (3. - 2. * k); vec4 col = A(v);
        if (mode > -.5) { ${pick} }
        vec3 c = col.rgb;
        c = (c - .5) * contrast + .5;
        c = mix(c, vec3(dot(c, vec3(.299, .587, .114))), desat);
        c += warmth * vec3(.05, .015, -.05);
        ${POST_GLSL.join('\n        ')}
        vec2 q = (v - .5) * (res.x > res.y ? vec2(1.6, 1.) : vec2(1., 1.6)); c *= 1. - smoothstep(.55, 1.15, length(q)) * vignette;
        float n = fract(sin(dot(floor(v * res), vec2(12.9898, 78.233)) + seed * .731) * 43758.5453) - .5; c += n * grain;
        gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
      }`, depthTest: false, depthWrite: false });
  comp = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat); compScene.add(comp);
}

// ---------- captions (word highlight, in BAND) ----------
const wideLen = s => [...s].reduce((n, c) => n + (/[ᄀ-ᇿ⺀-鿿가-퟿豈-﫿＀-￯]/u.test(c) ? 2 : 1), 0);
const joinWords = ws => ws.map((x, i) => x.word + (x.ns || i === ws.length - 1 ? '' : ' ')).join('');
export function chunkWords(words, maxLen = VERT ? 24 : 34) {
  const out = []; let cur = null;
  words.forEach(w => {
    const gap = cur ? w.start - cur.end : 0, prev = cur && cur.words[cur.words.length - 1];
    const len = cur ? wideLen(joinWords(cur.words)) + (prev.ns ? 0 : 1) + wideLen(w.word) : 0;
    const brk = !cur || cur.words.length >= (prev.ns ? 6 : 3) || len > maxLen || gap > .22 || /[.,?!、。，！？]$/.test(prev.word);
    if (brk) { cur = { start: w.start, end: w.end, words: [w] }; out.push(cur); } else { cur.words.push(w); cur.end = w.end; }
  });
  out.forEach((c, i) => { c.text = joinWords(c.words); c.until = out[i + 1] ? out[i + 1].start : c.end + .6; });
  return out;
}
const ovScene = new THREE.Scene(), ovCam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -10, 10), ovRoot = new THREE.Group(); ovScene.add(ovRoot);
let CAPS = null;
function captions(chunks, { y, size }) {
  const layer = group(ovRoot), space = size * .27;
  const built = chunks.map(c => {
    const g = group(layer, 0, y); g.visible = false;
    const words = c.words.map(w => ({ w, white: text(g, w.word, { size, color: '#ffffff', stroke: '#111111', strokeW: 7 }), hi: text(g, w.word, { size, color: BRAND.caption, stroke: '#111111', strokeW: 7 }) }));
    const total = words.reduce((a, o, i) => a + o.white.userData.w + (i < words.length - 1 && !o.w.ns ? space : 0), 0);
    let x = -total / 2;
    words.forEach(o => { const cx = x + o.white.userData.w / 2; o.white.position.x = cx; o.hi.position.x = cx; x += o.white.userData.w + (o.w.ns ? 0 : space); });
    return { ...c, g, words, fit: Math.min(1, (SAFE.x1 - SAFE.x0) / Math.max(1, total)) };
  });
  return t => built.forEach(c => {
    const on = t >= c.start - .03 && t < c.until - .04; c.g.visible = on; if (!on) return;
    const k = seg(t, c.start - .03, c.start + .15);
    c.g.scale.setScalar((.92 + .08 * E.outBack(k, 2)) * c.fit); c.g.position.y = y - 12 * (1 - E.outCubic(k));
    c.words.forEach((o, i) => { const next = c.words[i + 1]?.w.start ?? c.until;
      const a = clamp((t - (o.w.start - .02)) / .08) * (1 - clamp((t - (next - .02)) / .08));
      o.hi.visible = a > .001; o.hi.material.opacity = a; o.hi.position.y = 4 * E.outCubic(a); });
  });
}
function overlay(t) {
  if (!CAPS && SETTINGS.captions.on !== false && WORDS.length) {
    const words = WORDS.map(w => ({ word: w.w, start: w.s, end: w.e, ns: !!w.ns })).filter(w => !SHOTS.some(s => s.captions === false && w.start >= s.t0 && w.start < (s.t1 ?? 1e9)));
    CAPS = captions(chunkWords(words), { y: (BAND.y0 + BAND.y1) / 2, size: SETTINGS.captions.size });
  }
  CAPS?.(t);
}
export function captionAt(t) { return SETTINGS.captions.on !== false && WORDS.some(w => t >= w.s - .03 && t < w.e + .5) && !SHOTS.some(s => s.captions === false && t >= s.t0 && t < (s.t1 ?? 1e9)); }

// ---------- frame ----------
export function compose(t) {
  ensureComp();
  const i = activeIndex(t);
  SHOTS.forEach((s, k) => { if (Math.abs(k - i) > KEEP) dispose(s); });
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1);
  if (!SHOTS.length) { renderer.clear(); return outCanvas; }
  const tr = transitionAt(t), U = compMat.uniforms; let post;
  if (tr) {
    renderShot(step(tr.A, t), rtA); const SB = step(tr.B, t); renderShot(SB, rtB);
    const [base, d] = String(tr.type).split('-'); let m = TNAMES.indexOf(base);
    if (m < 0) { m = TNAMES.indexOf('dissolve'); if (!tr.B._warned) { tr.B._warned = true; console.warn(`unknown transition "${tr.type}" (shot at ${tr.B.t0}s): dissolve used. Known: cut, ${TNAMES.join(', ')}`); } }
    U.mode.value = m; U.k.value = tr.k; U.dir.value.set(d === 'left' || (base === 'push' && !d) ? 1 : d === 'right' ? -1 : 0, d === 'up' ? -1 : d === 'down' ? 1 : 0);
    post = { ...SETTINGS.post, ...(SB.post || {}) };
  } else { const S = step(SHOTS[i], t); renderShot(S, rtA); U.mode.value = -1; post = { ...SETTINGS.post, ...(S.post || {}) }; }
  U.grain.value = +post.grain || 0; U.vignette.value = +post.vignette || 0; U.contrast.value = post.contrast ?? 1; U.desat.value = +post.desat || 0; U.warmth.value = +post.warmth || 0;
  U.seed.value = Math.floor(t * 30) % 997;
  renderer.setRenderTarget(null); renderer.clear(); renderer.render(compScene, compCam);
  if (OVERLAY) { overlay(t); renderer.autoClear = false; renderer.render(ovScene, ovCam); renderer.autoClear = true; }
  if (Array.isArray(SUITE.pick) && !tr) hudPicks(SHOTS[i]);
  return outCanvas;
}
// HUD elements (2D on a 3D shot, or S.hud in 2D) for the editor's click: top-level st entries on the HUD layer
function hudPicks(def) {
  const S = def._S, st = def._st || {}; if (!S) return;
  for (const [k, v] of Object.entries(st)) { if (!(v instanceof THREE.Object3D) || !underG(v, S.hud) || !visibleDeep(v)) continue;
    const b = worldBox(v); if (!b) continue;
    SUITE.pick.push({ x: b.min.x + W / 2, y: H / 2 - b.max.y, w: b.max.x - b.min.x, h: b.max.y - b.min.y, alpha: 1, kind: v.userData.kind || 'group', text: v.userData.text ?? null, key: `st.${k}`, size: v.userData.size ?? null, src: `${def._file}:${def._line}` }); }
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
  to ??= END;
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
  return { shots, hits: [], cards: [], sfx: list.filter(s => s.t >= 0 && s.t <= end + 1), style: 'starter' };
}

// =====================================================================================================================
// CHECKS (the check_layout tool). Findings: { t, type, what, other?, detail } - the same words the tool prints.
//   cut       an element within CHECK.edge px of the frame edge (and not fully outside)    userData.bleed = true: intended
//   caption   an element in the caption band while a caption shows                           userData.band = true: intended
//   overlap   two 2D elements' boxes overlap more than CHECK.overlap of the smaller one      userData.over = true | [other]
//   small     text drawn smaller than CHECK.minText px
//   contrast  text that doesn't read on what is behind it (WCAG < CHECK.contrast)
//   empty     less than CHECK.empty of the content zone holds anything                       S.sparse = true: intended
//   kit       a kitShot element that is not fully and comfortably in frame
//   DARK / CRUSHED   the picture is too dark / crushed black (VISIBILITY)                     S.visibility = false | {...}
//   ABRUPT    the camera starts, stops or jumps too hard (CAMERA_LIMITS)
//   3D: floating (a solid resting on nothing; userData.airborne = true: intended), through (two solids pass through each
//       other), coplanar + flicker (surfaces at the same depth z-fight)
// LAYOUT_CHECKS (extension point): fn(S, t, def) -> [{ type, detail }], each said once per shot.
// =====================================================================================================================
export const CHECK = { edge: 36, overlap: .12, minText: 40, contrast: 3, empty: .12, gap: .02, through: .03, coplanar: .01 };
export const VISIBILITY = { dark: .10, darkPx: .06, darkFrac: .85, crushPx: .03, crushFrac: .60, bright: .35 };
export const CAMERA_LIMITS = { accel: 2.4, shortDur: .8, shortCover: .15, peakDeg: 60 };
export const LAYOUT_CHECKS = [];
/** Steady frames: after the transition in, the middle, before the transition out, and just after each element lands. */
export function checkTimes() {
  const ts = [];
  SHOTS.forEach(s => { const a = s.t0 + (transOf(s) === 'cut' ? 0 : durOf(s) / 2) + .05, nx = SHOTS[SHOTS.indexOf(s) + 1], b = (s.t1 ?? END) - (nx && transOf(nx) !== 'cut' ? durOf(nx) / 2 : 0) - .05;
    if (b > a) ts.push(a, (a + b) / 2, b);
    live(s); for (const an of s._S.anims) if (an.at > s.t0) ts.push(an.at + an.dur + .1); });
  const seen = new Set(); return ts.filter(t => t >= 0 && t <= END && !transitionAt(t)).map(t => +t.toFixed(2)).sort((a, b) => a - b)
    .filter(t => { const k = Math.round(t * 4); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 90);
}
function visibleDeep(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
const opacityOf = m => { const mm = Array.isArray(m.material) ? m.material[0] : m.material; return mm ? (mm.opacity ?? 1) : 1; };
function worldBox(o) {
  o.updateWorldMatrix(true, true); const b = new THREE.Box3();
  o.traverse(m => { if (m.isMesh && visibleDeep(m) && !m.userData.noBox && m.material?.colorWrite !== false && opacityOf(m) > .05) b.expandByObject(m); });
  return b.isEmpty() ? null : b;
}
// an element's box on screen, in pixels (centre origin, y up)
function screenBox(o, S) {
  const b = worldBox(o); if (!b) return null;
  if (!(DIM === '3d' && underG(o, S.root))) return { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, b, world: false };
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, front = 0; const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let k = 0; k < 8; k++) { v.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z);
    c.copy(v).applyMatrix4(S.cam.matrixWorldInverse); if (c.z > -S.cam.near) continue; front++;
    v.project(S.cam); const px = v.x * W / 2, py = v.y * H / 2; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  return front ? { x0, x1, y0, y1, b, world: true } : null;
}
const rtProbe = new THREE.WebGLRenderTarget(Math.round(W / 4), Math.round(H / 4));
const zc = document.createElement('canvas'); zc.width = Math.round(W / 8); zc.height = Math.round(H / 8); const zx = zc.getContext('2d', { willReadFrequently: true });
function frameLuma() {   // the frame just composed, 0..255 per pixel
  zx.drawImage(glCanvas, 0, 0, zc.width, zc.height); const d = zx.getImageData(0, 0, zc.width, zc.height).data, L = new Uint8Array(zc.width * zc.height);
  for (let i = 0; i < L.length; i++) L[i] = d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114; return L;
}
let lastCheck = -1e9;
export function layoutIssues(t) {
  // a new check run (calls of one run come back to back): what was said once per shot may be said again
  const now = performance.now(); if (now - lastCheck > 1500) SHOTS.forEach(s => { s._seen = null; s._camChecked = false; s._audited = false; }); lastCheck = now;
  try { return layoutAt(t); } finally { lastCheck = performance.now(); }
}
function layoutAt(t) {
  if (!SHOTS.length || transitionAt(t)) return [];
  const i = activeIndex(t), def = SHOTS[i], S = step(def, t), st = def._st || {}, out = [];
  const where = `(${def._file}:${def._line})`, shotWhere = `shot ${i + 1} ${where}`, seen = def._seen ??= new Set();
  const once = (key, issue) => { if (seen.has(key)) return; seen.add(key); out.push({ t, ...issue }); };
  S.scene.updateMatrixWorld(true); S.hudScene.updateMatrixWorld(true);
  // the named elements (top-level st entries, arrays too)
  const items = [];
  for (const [k, v] of Object.entries(st)) {
    const add = (key, o) => { if (!(o instanceof THREE.Object3D) || !visibleDeep(o)) return; const sb = screenBox(o, S); if (sb) items.push({ k: key, v: o, ud: o.userData, sb }); };
    if (Array.isArray(v)) v.forEach((x, j) => add(`${k}[${j}]`, x)); else add(k, v);
  }
  const nameOf = o => { for (const it of items) if (underG(o, it.v)) return `st.${it.k}`; return o.userData.kind ? `a ${o.userData.kind}` : 'an object'; };
  // an element still entering or leaving (S.add) is not judged yet: it is not where it will rest
  const moving = o => S.anims.some(a => (underG(o, a.obj) || underG(a.obj, o)) && ((t >= a.at - .02 && t < a.at + a.dur + .05) || (a.out && a.outAt != null && t >= a.outAt - .02)));
  const cap = captionAt(t), bare = [];
  for (const e of items) {
    const { x0, x1, y0, y1 } = e.sb, ud = e.ud, w = x1 - x0, h = y1 - y0, what = `st.${e.k} ${where}`;
    if (ud.ground || w < 2 || h < 2 || moving(e.v)) continue;
    const m = CHECK.edge, cut = [x0 < -W / 2 + m && 'left', x1 > W / 2 - m && 'right', y1 > H / 2 - m && 'top', y0 < -H / 2 + m && 'bottom'].filter(Boolean);
    const fully = x1 < -W / 2 || x0 > W / 2 || y0 > H / 2 || y1 < -H / 2;
    if (cut.length && !fully && !ud.bleed) out.push({ t, type: 'cut', what, detail: `is within ${m} px of / crosses the frame edge (${cut.join(', ')}): keep it inside SAFE (x ${SAFE.x0}..${SAFE.x1}, y ${SAFE.y0}..${SAFE.y1}), or set userData.bleed = true if the crop is intended` });
    if (cap && !ud.over && !ud.band && y0 < BAND.y1 && y1 > BAND.y0 && x1 > -W / 2 && x0 < W / 2) out.push({ t, type: 'caption', what, detail: `reaches into the caption band (y ${BAND.y0}..${BAND.y1}) while a caption is on screen: move it into the content zone (y ${ZONE.y0}..${ZONE.y1})` });
    let tmin = 1e9;
    e.v.traverse(o => { if (o.userData.role !== 'text' || !visibleDeep(o)) return; const s = new THREE.Vector3(); o.getWorldScale(s); tmin = Math.min(tmin, (o.userData.size || 40) * s.y);
      let bg = null; for (let a = o.parent; a && a !== e.v.parent; a = a.parent) if (a.userData.bg) { bg = a.userData.bg; break; }
      if (bg) { const r = contrast(o.userData.color || '#000000', bg); if (r < CHECK.contrast) out.push({ t, type: 'contrast', what, detail: `text ${o.userData.color} on its own ${bg} plate has contrast ${r.toFixed(1)} (needs ${CHECK.contrast}): use textOn(fill) or legibleOn(color, fill)` }); }
      else bare.push({ o, what }); });
    if (tmin < CHECK.minText) out.push({ t, type: 'small', what, detail: `text is ${Math.round(tmin)} px tall on screen: ${CHECK.minText} px minimum for labels, 90+ for titles` });
    if (S.kit && e.k === 'el') {
      const mx = W * .06, my = H * .06, big = Math.max(w / W, h / H);
      if (x0 < -W / 2 + mx || x1 > W / 2 - mx || y0 < -H / 2 + my || y1 > H / 2 - my || big < .12)
        once('kit', { type: 'kit', what, detail: `the element is not fully and comfortably in frame (box ${Math.round(w)} x ${Math.round(h)} px${big < .12 ? ', too small to judge' : ''}): a kit element must show whole, 6 % from every edge, at least 12 % of the frame` });
    }
  }
  // text on what is behind it: the shot drawn small without its text, the mean colour under each text
  if (bare.length) {
    const texts = []; for (const sc of [S.scene, S.hudScene]) sc.traverse(o => { if (o.userData.role === 'text' && o.visible) texts.push(o); });
    texts.forEach(o => (o.visible = false)); renderShot(S, rtProbe); texts.forEach(o => (o.visible = true));
    const pw = rtProbe.width, ph = rtProbe.height, px = new Uint8Array(pw * ph * 4); renderer.readRenderTargetPixels(rtProbe, 0, 0, pw, ph, px); renderer.setRenderTarget(null);
    for (const { o, what } of bare) {
      const b = worldBox(o); if (!b) continue; let r = 0, g = 0, bl = 0, n = 0;
      const X0 = Math.max(0, Math.floor((b.min.x + W / 2) / W * pw)), X1 = Math.min(pw - 1, Math.ceil((b.max.x + W / 2) / W * pw)), Y0 = Math.max(0, Math.floor((b.min.y + H / 2) / H * ph)), Y1 = Math.min(ph - 1, Math.ceil((b.max.y + H / 2) / H * ph));
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { const q = (y * pw + x) * 4; r += px[q]; g += px[q + 1]; bl += px[q + 2]; n++; }
      if (!n) continue;
      const bg = css((Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(bl / n)), cr = contrast(o.userData.color || '#000000', bg);
      if (cr < CHECK.contrast) out.push({ t, type: 'contrast', what, detail: `text ${o.userData.color} on ${bg} behind it has contrast ${cr.toFixed(1)} (needs ${CHECK.contrast}): change its colour (legibleOn(color, bg)) or put it on a plate (label(), card())` });
    }
  }
  // 2D overlaps (labels, cards, shapes): boxes on screen; 3D solids are judged by 'through' instead
  const flats = items.filter(e => !e.sb.world && !e.ud.ground && !moving(e.v));
  for (let a = 0; a < flats.length; a++) for (let b = a + 1; b < flats.length; b++) {
    const A = flats[a], B = flats[b], ua = A.ud, ub = B.ud;
    if (ua.over === true || ub.over === true || (Array.isArray(ua.over) && ua.over.includes(B.v)) || (Array.isArray(ub.over) && ub.over.includes(A.v))) continue;
    if (underG(A.v, B.v) || underG(B.v, A.v)) continue;
    const ix = Math.min(A.sb.x1, B.sb.x1) - Math.max(A.sb.x0, B.sb.x0), iy = Math.min(A.sb.y1, B.sb.y1) - Math.max(A.sb.y0, B.sb.y0);
    if (ix <= 0 || iy <= 0) continue;
    const area = s => (s.x1 - s.x0) * (s.y1 - s.y0), frac = ix * iy / Math.max(1, Math.min(area(A.sb), area(B.sb)));
    if (frac > CHECK.overlap) out.push({ t, type: 'overlap', what: `st.${A.k}`, other: `st.${B.k} ${where}`, detail: `${Math.round(frac * 100)}% of the smaller one is covered: separate them, or mark the intent with userData.over = [other] (a label on its object)` });
  }
  // 3D: a HUD element (text, card, label) over a 3D element hides it
  if (DIM === '3d') for (const A of flats) for (const B of items.filter(e => e.sb.world && !e.ud.ground && !moving(e.v))) {
    if (A.ud.over === true || (Array.isArray(A.ud.over) && A.ud.over.includes(B.v)) || B.ud.over === true || (Array.isArray(B.ud.over) && B.ud.over.includes(A.v))) continue;
    const ix = Math.min(A.sb.x1, B.sb.x1) - Math.max(A.sb.x0, B.sb.x0), iy = Math.min(A.sb.y1, B.sb.y1) - Math.max(A.sb.y0, B.sb.y0);
    if (ix <= 0 || iy <= 0) continue;
    const frac = ix * iy / Math.max(1, (B.sb.x1 - B.sb.x0) * (B.sb.y1 - B.sb.y0));
    if (frac > CHECK.overlap) out.push({ t, type: 'overlap', what: `st.${A.k}`, other: `st.${B.k} ${where}`, detail: `this HUD element covers ${Math.round(frac * 100)}% of the 3D ${B.ud.kind || 'element'}: move it into empty space (S.toScreen gives where the 3D thing is), or userData.over = [other] if it is meant to sit on it` });
  }
  // empty frame: a 20 x 20 grid over the content zone
  { const cw = (ZONE.x1 - ZONE.x0) / 20, chh = (ZONE.y1 - ZONE.y0) / 20, grid = new Uint8Array(400);
    for (const e of items) { if (e.ud.ground) continue; const s = e.sb;
      for (let gy = 0; gy < 20; gy++) for (let gx = 0; gx < 20; gx++) { const x0 = ZONE.x0 + gx * cw, y0 = ZONE.y0 + gy * chh; if (s.x1 > x0 && s.x0 < x0 + cw && s.y1 > y0 && s.y0 < y0 + chh) grid[gy * 20 + gx] = 1; } }
    // judged once everything of the shot has landed (a shot may build up from an empty frame)
    const used = grid.reduce((a, b) => a + b, 0) / 400, landed = S.anims.filter(x => x.at > def.t0 + .05).map(x => x.at + x.dur), last = landed.length ? Math.max(...landed) : def.t0;
    if (used < CHECK.empty && !S.sparse && !S.kit && t >= last) once('empty', { type: 'empty', what: shotWhere, detail: `only ${Math.round(used * 100)}% of the content zone (y ${ZONE.y0}..${ZONE.y1}) holds anything: make the subject bigger, add what the narration names, or set S.sparse = true if the emptiness IS the idea` }); }
  if (DIM === '3d') out.push(...solidIssues(def, S, t, where, nameOf, once, moving));
  // the picture: too dark / crushed (the frame as exported). A dark ground is a design choice; a frame is DARK when it is
  // dark AND nothing in it is bright enough to read (its brightest 2 % below VISIBILITY.bright)
  if (S.visibility !== false) {
    OVERLAY = false; try { compose(t); } finally { OVERLAY = true; }   // the picture itself (captions don't make it readable)
    const L = frameLuma(), o = { ...VISIBILITY, ...(S.visibility || {}) }; let s = 0, nd = 0, nc = 0; const hist = new Uint32Array(256);
    for (const v of L) { s += v; hist[v]++; if (v < o.darkPx * 255) nd++; if (v < o.crushPx * 255) nc++; }
    let p98 = 255; for (let k = 255, n = 0; k >= 0; k--) { n += hist[k]; if (n >= L.length * .02) { p98 = k; break; } }
    const mean = s / L.length / 255, dark = nd / L.length, crush = nc / L.length, pct = v => Math.round(v * 100), dim = p98 / 255 < o.bright;
    if (mean >= .008) {
      if ((mean < o.dark || dark > o.darkFrac) && dim) once('DARK', { type: 'DARK', what: shotWhere, detail: `the picture is too dark to read (mean ${mean.toFixed(3)} < ${o.dark}, ${pct(dark)} % of it below ${o.darkPx}): ${DIM === '3d' ? 'light the subject (S.light({ intensity, hemi })), lighten the ground and background' : 'use a lighter background or brighter elements'}; a deliberate dark shot: S.visibility = false` });
      if (DIM === '3d' && crush > o.crushFrac) once('CRUSHED', { type: 'CRUSHED', what: shotWhere, detail: `${pct(crush)} % of the picture is crushed black (below ${o.crushPx}): lift the background and the shadows (hemi light, a lighter ground)` });
    }
    step(def, t);
  }
  if (!def._camChecked) { def._camChecked = true; out.push(...cameraIssues(def, i, shotWhere)); step(def, t); }
  for (const fn of LAYOUT_CHECKS) { let r = []; try { r = fn(def._S ?? S, t, def) || []; } catch (e) { console.warn('layout check: ' + e.message); }
    for (const q of r) once(q.type + '|' + q.detail, { what: shotWhere, ...q }); }
  return out;
}
// 3D: solids resting on nothing, solids through solids, coplanar surfaces and z-fight flicker
function solidIssues(def, S, t, where, nameOf, once, moving) {
  const out = [], solids = [];
  const walk = o => { for (const c of o.children) { if (c.userData.solid) { if (visibleDeep(c)) solids.push({ o: c, b: worldBox(c) }); } else walk(c); } };
  walk(S.root);
  const air = o => { for (let a = o; a; a = a.parent) if (a.userData.airborne) return true; return false; };
  const list = solids.filter(s => s.b);
  for (const s of list) {
    if (air(s.o) || moving(s.o)) continue;
    const bottom = s.b.min.y; if (bottom <= CHECK.gap) continue;
    const held = list.some(u => u !== s && Math.abs(u.b.max.y - bottom) <= CHECK.gap && u.b.max.x > s.b.min.x && u.b.min.x < s.b.max.x && u.b.max.z > s.b.min.z && u.b.min.z < s.b.max.z);
    if (!held) { const n = nameOf(s.o); once(`float|${n}|${bottom.toFixed(2)}`, { type: 'floating', what: `${n} ${where}`, detail: `its bottom is ${bottom.toFixed(2)} m above the ground with nothing under it: rest it (y = 0, or y = the top of what holds it), or mark it userData.airborne = true if it really flies or falls` }); }
  }
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const A = list[a], B = list[b];
    if (underG(A.o, B.o) || underG(B.o, A.o) || moving(A.o) || moving(B.o)) continue;
    const ov = o => o.userData.over === true || (Array.isArray(o.userData.over) && (o.userData.over.includes(A.o) || o.userData.over.includes(B.o)));
    if (ov(A.o) || ov(B.o)) continue;
    const ix = Math.min(A.b.max.x, B.b.max.x) - Math.max(A.b.min.x, B.b.min.x), iy = Math.min(A.b.max.y, B.b.max.y) - Math.max(A.b.min.y, B.b.min.y), iz = Math.min(A.b.max.z, B.b.max.z) - Math.max(A.b.min.z, B.b.min.z);
    if (ix > CHECK.through && iy > CHECK.through && iz > CHECK.through) { const na = nameOf(A.o), nb = nameOf(B.o);
      once(`through|${na}|${nb}`, { type: 'through', what: `${na}`, other: `${nb} ${where}`, detail: `they pass through each other (${ix.toFixed(2)} x ${iy.toFixed(2)} x ${iz.toFixed(2)} m): move one so they touch without passing through, or set userData.over = [other] if one really sits inside the other` }); }
  }
  if (!def._audited) { def._audited = true;   // coplanar: flat horizontal surfaces at the same height that overlap in plan
    const flats = []; S.root.traverse(m => { if (!m.isMesh || !visibleDeep(m) || m.material?.transparent) return; const b = new THREE.Box3().setFromObject(m); if (b.isEmpty()) return;
      const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z; if (sy > .02 * Math.max(sx, sz) || Math.max(sx, sz) < .2) return; flats.push({ m, b }); });
    for (let a = 0; a < flats.length; a++) for (let b = a + 1; b < flats.length; b++) { const A = flats[a], B = flats[b];
      if (Math.abs(A.b.max.y - B.b.max.y) >= CHECK.coplanar) continue;
      if (A.b.max.x <= B.b.min.x || B.b.max.x <= A.b.min.x || A.b.max.z <= B.b.min.z || B.b.max.z <= A.b.min.z) continue;
      out.push({ t, type: 'coplanar', what: `${nameOf(A.m)} / ${nameOf(B.m)} ${where}`, detail: `two surfaces ${Math.abs(A.b.max.y - B.b.max.y).toFixed(3)} m apart (y ${A.b.max.y.toFixed(3)}) will flicker (z-fight): lift the top one at least ${CHECK.coplanar} m, or make it one surface` }); } }
  // z-fight probe: the frame again with only the depth precision changed; pixels that change are ambiguous depth tests
  { compose(t); const f0 = frameLuma(), hit = new Uint8Array(f0.length);
    for (const nm of [1.6, .6]) { NEARMUL = nm; compose(t); const f1 = frameLuma(); for (let p = 0; p < f0.length; p++) if (Math.abs(f1[p] - f0[p]) > 40) hit[p] = 1; }
    NEARMUL = 1; compose(t); const n = hit.reduce((a, b) => a + b, 0) * 64;
    if (n > 600) once('flicker', { type: 'flicker', what: `shot ${SHOTS.indexOf(def) + 1} ${where}`, detail: `${n} px change when only the depth precision changes: z-fighting (stacked or coplanar surfaces): separate them by a few cm` }); }
  return out;
}
// the camera sampled at 30 fps over the settled part of the shot: how far the picture moves (probe points, in frame
// widths), its acceleration and (3D) how fast the view turns
export function cameraTrace(def) {
  const S = def._S, i = SHOTS.indexOf(def), nx = SHOTS[i + 1], tin = transOf(def, i) === 'cut' ? 0 : durOf(def) / 2, tout = nx && transOf(nx, i + 1) !== 'cut' ? durOf(nx) / 2 : 0;
  const t0 = def.t0 + tin, t1 = (def.t1 ?? def.t0 + 4) - tout, dt = 1 / 30, fr = [];
  const probes = [[0, 0], [.3, 0], [-.3, 0], [0, .3], [0, -.3]];
  for (let t = t0; t <= t1 + 1e-6; t += dt) {
    step(def, t);
    if (DIM === '3d') {   // probe points on the plane of the look point (what the viewer watches), spread over the frame
      const fwd = S.cam.getWorldDirection(new THREE.Vector3()), D = Math.max(.05, S.cam.position.distanceTo(S._look ?? new THREE.Vector3())), h = Math.tan(S.cam.fov * Math.PI / 360) * D, w = h * W / H;
      const r = new THREE.Vector3().setFromMatrixColumn(S.cam.matrixWorld, 0), u = new THREE.Vector3().setFromMatrixColumn(S.cam.matrixWorld, 1), c = S.cam.position.clone().addScaledVector(fwd, D);
      fr.push({ t, m: S.cam.matrixWorld.clone(), pm: S.cam.projectionMatrix.clone(), fwd, pts: probes.map(([x, y]) => c.clone().addScaledVector(r, x * 2 * w).addScaledVector(u, y * 2 * h)) });
    } else fr.push({ t, z: S.root.scale.x, ox: S.root.position.x, oy: S.root.position.y });
  }
  const cam = DIM === '3d' ? S.cam.clone() : null, tr = [];
  for (let k = 1; k < fr.length; k++) { const a = fr[k - 1], b = fr[k]; let d, deg = 0;
    if (DIM === '3d') {
      const proj = (f, P) => { cam.matrixWorld.copy(f.m); cam.matrixWorldInverse.copy(f.m).invert(); cam.projectionMatrix.copy(f.pm); const q = P.clone().project(cam); return [q.x / 2, q.y / 2 * H / W]; };
      d = a.pts.map(P => { const A = proj(a, P), B = proj(b, P); return [B[0] - A[0], B[1] - A[1]]; }); deg = a.fwd.angleTo(b.fwd) * 180 / Math.PI / dt;
    } else d = probes.map(([x, y]) => { const px = x * W, py = y * H; return [((px * b.z + b.ox) - (px * a.z + a.ox)) / W, ((py * b.z + b.oy) - (py * a.z + a.oy)) / W]; });
    tr.push({ t: b.t, d, v: d.reduce((s, q) => s + Math.hypot(q[0], q[1]), 0) / d.length / dt, deg }); }
  for (let k = 1; k < tr.length; k++) tr[k].a = tr[k].d.reduce((s, q, j) => s + Math.hypot(q[0] - tr[k - 1].d[j][0], q[1] - tr[k - 1].d[j][1]), 0) / tr[k].d.length / dt / dt;
  return tr;
}
function cameraIssues(def, i, where) {
  if (!def._S) return [];
  const tr = cameraTrace(def), L = CAMERA_LIMITS, out = [];
  let pa = 0, pt = 0, pd = 0, dt0 = 0; for (const f of tr) { if ((f.a ?? 0) > pa) { pa = f.a; pt = f.t; } if (f.deg > pd) { pd = f.deg; dt0 = f.t; } }
  const moves = []; let cur = null; for (const f of tr) { if (f.v > .02) { cur ??= { t0: f.t, cover: 0, n: 0 }; cur.cover += f.v / 30; cur.n++; cur.t1 = f.t; } else if (cur) { moves.push(cur); cur = null; } } if (cur) moves.push(cur);
  const short = moves.find(m => m.n / 30 < L.shortDur && m.cover > L.shortCover);
  const why = [];
  if (pa > L.accel) why.push(`the picture accelerates ${pa.toFixed(1)} frame/s^2 at ${pt.toFixed(2)} s (limit ${L.accel}: a move that starts or stops hard)`);
  if (short) why.push(`a ${(short.n / 30).toFixed(2)} s move at ${short.t0.toFixed(2)} s sweeps ${Math.round(short.cover * 100)} % of the frame (limit ${Math.round(L.shortCover * 100)} % under ${L.shortDur} s)`);
  if (pd > L.peakDeg) why.push(`the view turns ${pd.toFixed(0)} deg/s at ${dt0.toFixed(2)} s (limit ${L.peakDeg})`);
  if (why.length) out.push({ t: +(pt || def.t0).toFixed(2), type: 'ABRUPT', what: where, detail: `camera: ${why.join('; ')}. Ease camera moves from rest to rest over >= 1.5 s (S.move keys far enough apart), or cut instead of whipping` });
  return out;
}

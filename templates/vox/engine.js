// Toon Studio engine - Vox-style editorial collage (v1). Everything is procedural Three.js: layered paper,
// cut-outs, printed "photos" (3D subjects rendered to halftone/duotone prints), tactile props, marker annotations,
// Vox text animators, a camera that never stops moving, cut-the-curve / rack-focus / zoom-through transitions,
// depth of field, grain, halftone and paper texture in post, and a sound-design event pass (paper, pins, marker,
// typing, ticks, whooshes). Same contract as the pixel engine: shot(), cue(), compose(), exportVideo(), SUITE hooks.
// Settings: the Suite host sets globalThis.__CZ_SETTINGS (project.json "settings") before importing this module.
import * as THREE from 'three';
export { THREE };

export const ENGINE_KIND = 'vox';
export const ENGINE_VERSION = 2;                 // bump when the Suite ships engine changes (projects get an Update button)
export const DEFAULTS = {
  format: 'vertical',                            // 'vertical' 1080x1920 | 'landscape' 1920x1080
  theme: 'editorial',                            // editorial | archive | newsroom | tabletop (see THEMES)
  palette: null,                                 // optional colour overrides { accent: '#..', ... }
  post: { grain: .045, halftone: .14, paper: .3, vignette: .3, aberration: 0, lift: .06, warmth: 0 },
  camera: { fov: 28, drift: .045 },              // drift: how much every shot creeps in (Vox never holds still)
  transitions: { duration: .42 },
  light: { shadows: true, softness: 1, mapSize: 2048 },
};
const merge = (a, b) => { const o = { ...a }; for (const k in b || {}) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; };
export const SETTINGS = merge(DEFAULTS, globalThis.__CZ_SETTINGS || {});
const VERT = SETTINGS.format !== 'landscape';
export const FW = VERT ? 1080 : 1920, FH = VERT ? 1920 : 1080;   // output pixels
export const K = 2, W = FW / K, H = FH / K;                         // HUD units: 540x960 (vertical) or 960x540
export const AW = FW, AH = FH;
// World units: the board plane z = 0 fills exactly FRAME.w x FRAME.h at zoom 1 (9 x 16 vertical, 16 x 9 landscape).
export const FRAME = { w: VERT ? 9 : 16, h: VERT ? 16 : 9 };
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

// ---------- themes ----------
// paper/paper2: sheets, ink: type, accent: the one highlight colour (Vox yellow, newsroom red), accent2: second
// colour used sparingly, muted: captions and secondary lines, dark: dark cards, light: white stickers/borders,
// line: grid lines, bg: the board behind everything.
export const THEMES = {
  editorial: { paper: '#efe8d8', paper2: '#e3d8c1', ink: '#1f1d1a', accent: '#f5c518', accent2: '#e2462c', muted: '#8d8472', dark: '#242220', light: '#fbf7ee', line: '#b8c4c8', bg: '#e6dcc6' },
  archive: { paper: '#e9d7b1', paper2: '#d7bd8c', ink: '#2a1c10', accent: '#b3322a', accent2: '#c89b3c', muted: '#8a6f4d', dark: '#261a10', light: '#f3e7ca', line: '#a88b62', bg: '#5e4027' },
  newsroom: { paper: '#fbfaf6', paper2: '#efede7', ink: '#141414', accent: '#e10f1c', accent2: '#1c1c1c', muted: '#97948e', dark: '#161616', light: '#ffffff', line: '#d6d3cb', bg: '#f5f3ee' },
  tabletop: { paper: '#f2ede1', paper2: '#e2d9c6', ink: '#161616', accent: '#ffcf24', accent2: '#e5322d', muted: '#6d6a63', dark: '#1b1b1b', light: '#ffffff', line: '#c9d2bf', bg: '#2f6b40' },
};
export const C = { white: '#ffffff', black: '#0d0d0d', ...(THEMES[SETTINGS.theme] || THEMES.editorial), ...(SETTINGS.palette || {}) };

// ---------- fonts (the host loads FONT_FILES before any scene is imported) ----------
export const FONT_FILES = [
  ['Playfair Display', 'fonts/playfair-400.woff2', '400', 'normal'], ['Playfair Display', 'fonts/playfair-700.woff2', '700', 'normal'],
  ['Playfair Display', 'fonts/playfair-900.woff2', '900', 'normal'], ['Playfair Display', 'fonts/playfair-400i.woff2', '400', 'italic'],
  ['Playfair Display', 'fonts/playfair-700i.woff2', '700', 'italic'],
  ['EB Garamond', 'fonts/garamond-400.woff2', '400', 'normal'], ['EB Garamond', 'fonts/garamond-400i.woff2', '400', 'italic'], ['EB Garamond', 'fonts/garamond-700.woff2', '700', 'normal'],
  ['League Gothic', 'fonts/leaguegothic-400.woff2', '400', 'normal'],
  ['Oswald', 'fonts/oswald-500.woff2', '500', 'normal'], ['Oswald', 'fonts/oswald-700.woff2', '700', 'normal'],
  ['Archivo Black', 'fonts/archivoblack-400.woff2', '400', 'normal'],
  ['Space Mono', 'fonts/spacemono-400.woff2', '400', 'normal'], ['Space Mono', 'fonts/spacemono-700.woff2', '700', 'normal'],
  ['Inter', 'fonts/inter-400.woff2', '400', 'normal'], ['Inter', 'fonts/inter-600.woff2', '600', 'normal'], ['Inter', 'fonts/inter-800.woff2', '800', 'normal'],
];
// serif: editorial headlines (Playfair) · garamond: book/archive text · gothic: tall condensed display (League Gothic)
// condensed: Oswald · black: heavy poster sans (Archivo Black) · mono: numbers and typewriter (Space Mono) · sans: labels (Inter)
export const FONTS = { serif: "'Playfair Display'", garamond: "'EB Garamond'", gothic: "'League Gothic'", condensed: "'Oswald'",
  black: "'Archivo Black'", mono: "'Space Mono'", sans: "'Inter'" };
const fontStr = (font, weight, px, italic) => `${italic ? 'italic ' : ''}${weight} ${px}px ${FONTS[font] || font}`;

// ---------- math / timing ----------
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ease = x => (x = clamp(x), x * x * (3 - 2 * x));
export const easeIn = x => Math.pow(clamp(x), 3);
export const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOut = x => (x = clamp(x), x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutBack = (x, s = 1.4) => { x = clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export function settle(x, k = .12) { x = clamp(x); return 1 - Math.exp(-6 * x) * Math.cos(9 * x) * (1 - x) * (1 + k); }   // damped overshoot 0 -> 1
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export function rng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }
export const hashf = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const LOCALE = (() => { try { return new Intl.NumberFormat(globalThis.__CZ_LANG || 'en-US').resolvedOptions().locale; } catch { return 'en-US'; } })();   // the narration's language (the host sets it)
export function fmt(n, dec = 0) { return n.toLocaleString(LOCALE, { minimumFractionDigits: dec, maximumFractionDigits: dec }); }

// ---------- words / cues ----------
export let PHRASES = [], WORDS = [];
// any alphabet, without case or accents: cue('transcripcion') finds "Transcripción," in a Spanish narration (v2)
const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}.,%$]/gu, '').replace(/[.,]$/g, '');
export async function loadTimeline(url) {
  PHRASES = await (await fetch(url)).json();
  WORDS = PHRASES.flatMap((p, pi) => p.words.map(w => ({ ...w, n: norm(w.w), pi })));
}
// time the spoken word `word` starts (or ends with which='e'), searching the occurrence nearest to `near` seconds
export function cue(word, near, which = 's') {
  const parts = word.split(' ').map(norm);                      // ("flash / RAM": the "/" matches the timeline's "/")
  if (!parts.some(Boolean)) { console.warn('cue miss', word, near); return near; }   // ("—" alone matched every word)
  let best = null, bd = 1e9;
  for (let i = 0; i < WORDS.length; i++) {
    if (!parts.every((p, k) => WORDS[i + k] && WORDS[i + k].n.startsWith(p))) continue;
    const d = Math.abs(WORDS[i].s - near);
    if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[i + parts.length - 1].e; }
  }
  if (best === null || bd > 12) { console.warn('cue miss', word, near); return near; }
  return best;
}

// ---------- renderer ----------
export const glCanvas = document.createElement('canvas');
export const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(1); renderer.setSize(FW, FH, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;          // the post shader encodes sRGB itself (no colorspace chunk)
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = SETTINGS.light.shadows !== false;
renderer.shadowMap.type = THREE.VSMShadowMap;               // soft, blurry drop shadows between paper layers
const MAXANISO = renderer.capabilities.getMaxAnisotropy();
// studio environment for reflections (metal pins, coins, keys): a warm gradient room with two soft boxes, prefiltered once
let ENV = null;
function studioEnv() {
  if (ENV) return ENV;
  const sc = new THREE.Scene(), c = document.createElement('canvas'); c.width = 16; c.height = 256; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#fff8ec'); g.addColorStop(.45, '#b9ad98'); g.addColorStop(.55, '#6d6352'); g.addColorStop(1, '#2a241c');
  x.fillStyle = g; x.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
  for (const [px, py, pz, s2, col] of [[-18, 22, 18, 16, '#ffffff'], [24, 10, 12, 10, '#ffe7c4'], [0, -6, 30, 22, '#f6efe4']]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s2, s2 * .7), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(px, py, pz); m.lookAt(0, 0, 0); sc.add(m);
  }
  const pm = new THREE.PMREMGenerator(renderer); ENV = pm.fromScene(sc, .04).texture; pm.dispose();
  return ENV;
}

// ---------- canvas + procedural textures ----------
export function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
export function canvasTex(c, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAXANISO;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// tileable value noise (fbm), values 0..1
function tileNoise(size, cells, octaves, seed, gain = .5) {
  const out = new Float32Array(size * size); let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const n = cells << o, r = rng(seed * 31 + o * 7 + 1), g = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) g[i] = r();
    const s = n / size;
    for (let y = 0; y < size; y++) {
      const fy = y * s, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), r0 = (y0 % n) * n, r1 = ((y0 + 1) % n) * n;
      for (let x = 0; x < size; x++) {
        const fx = x * s, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), c0 = x0 % n, c1 = (x0 + 1) % n;
        const a = g[r0 + c0] + (g[r0 + c1] - g[r0 + c0]) * sx, b = g[r1 + c0] + (g[r1 + c1] - g[r1 + c0]) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    tot += amp; amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function hexBytes(h) { const s = h.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
const texCache = new Map();
function cached(key, fn) { if (!texCache.has(key)) texCache.set(key, fn()); return texCache.get(key); }
// paper: base colour + fine grain + soft blotches + fibres + specks. Tileable 1024 px.
export function paperCanvas(color = C.paper, { grain = 1, fibers = 1, seed = 3 } = {}) {
  return cached(`paper${color}${grain}${fibers}${seed}`, () => {
    const S = 1024, c = mkCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
    const fine = tileNoise(S, 256, 2, seed), mid = tileNoise(S, 24, 3, seed + 5), blot = tileNoise(S, 4, 3, seed + 9);
    const [r, g, b] = hexBytes(color);
    for (let i = 0; i < S * S; i++) {
      const v = (fine[i] - .5) * 16 * grain + (mid[i] - .5) * 14 * grain + (blot[i] - .5) * 22 * grain;
      d[i * 4] = r + v; d[i * 4 + 1] = g + v * .96; d[i * 4 + 2] = b + v * .88; d[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const rr = rng(seed + 17);
    for (let k = 0; k < 900 * fibers; k++) {                       // fibres: short curved hairs, light and dark
      const px = rr() * S, py = rr() * S, len = 6 + rr() * 26, a = rr() * Math.PI * 2, bend = (rr() - .5) * .6;
      x.strokeStyle = rr() < .5 ? `rgba(255,255,250,${.06 + rr() * .1})` : `rgba(60,45,30,${.04 + rr() * .07})`; x.lineWidth = .6 + rr() * .7;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + bend) * len / 2, py + Math.sin(a + bend) * len / 2, px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke();
    }
    for (let k = 0; k < 260 * grain; k++) { x.fillStyle = `rgba(40,30,20,${.05 + rr() * .12})`; x.fillRect(rr() * S, rr() * S, 1 + rr() * 1.5, 1 + rr() * 1.5); }
    return c;
  });
}
// greyscale grain for bump maps (catches the key light like real paper)
export function grainCanvas(seed = 2) {
  return cached('grain' + seed, () => {
    const S = 512, c = mkCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
    const f = tileNoise(S, 128, 3, seed, .55), m = tileNoise(S, 16, 2, seed + 3);
    for (let i = 0; i < S * S; i++) { const v = 128 + (f[i] - .5) * 150 + (m[i] - .5) * 60; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0); return c;
  });
}
const grainTex = () => cached('grainTex', () => { const t = canvasTex(grainCanvas(), { srgb: false, repeat: [1, 1] }); return t; });

// torn / deckled edge: a closed path around (0,0)-(w,h) with the chosen edges roughened
function tornPath(x, w, h, { amount = 1, seed = 1, edges = 'tblr', inset = 0 } = {}) {
  const r = rng(seed * 13 + 5), step = 5, j = (e) => edges.includes(e) ? amount : 0;
  const pts = [];
  const edge = (x0, y0, x1, y1, amp, nx, ny) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.floor(len / step)); let drift = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n; drift = drift * .7 + (r() - .5) * 2.2;
      const off = amp ? (Math.abs(drift) * 3.2 + r() * 2.2 + (r() < .04 ? r() * 9 : 0)) * amp : 0;
      pts.push([x0 + (x1 - x0) * k + nx * (off + inset), y0 + (y1 - y0) * k + ny * (off + inset)]);
    }
  };
  edge(0, 0, w, 0, j('t'), 0, 1); edge(w, 0, w, h, j('r'), -1, 0); edge(w, h, 0, h, j('b'), 0, -1); edge(0, h, 0, 0, j('l'), 1, 0);
  x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath();
}
// rounded rect path
export function rrect(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }

// white sticker border (and optional soft inner shadow) around whatever is drawn on `src` (transparent background)
export function stickerize(src, border = 14, col = C.light) {
  if (border <= 0) return src;
  const out = mkCanvas(src.width + border * 2, src.height + border * 2), x = out.getContext('2d');
  const sil = mkCanvas(out.width, out.height), s = sil.getContext('2d');
  s.drawImage(src, border, border); s.globalCompositeOperation = 'source-in'; s.fillStyle = col; s.fillRect(0, 0, out.width, out.height);
  for (let a = 0; a < 24; a++) { const ang = a / 24 * Math.PI * 2; x.drawImage(sil, Math.cos(ang) * border, Math.sin(ang) * border); }
  x.drawImage(sil, 0, 0);
  x.drawImage(src, border, border);
  return out;
}

// ---------- printed photo treatments (CPU, on canvases) ----------
// halftone: ink dots on a 45-degree screen, dot size from darkness; keeps the source alpha.
export function halftone(src, { cell = 7, ink = C.ink, paper = null, angle = .785, gamma = 1, contrast = 1.15 } = {}) {
  const w = src.width, h = src.height, sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = mkCanvas(w, h), x = out.getContext('2d');
  if (paper) { x.fillStyle = paper; x.fillRect(0, 0, w, h); }
  x.fillStyle = ink;
  const ca = Math.cos(angle), sa = Math.sin(angle), R = Math.hypot(w, h);
  for (let v = -R; v < R; v += cell) for (let u = -R; u < R; u += cell) {
    const px = w / 2 + u * ca - v * sa, py = h / 2 + u * sa + v * ca;
    if (px < -cell || py < -cell || px > w + cell || py > h + cell) continue;
    const ix = clamp(Math.round(px), 0, w - 1), iy = clamp(Math.round(py), 0, h - 1), i = (iy * w + ix) * 4;
    if (sd[i + 3] < 30) continue;
    let lum = (sd[i] * .299 + sd[i + 1] * .587 + sd[i + 2] * .114) / 255;
    lum = clamp((lum - .5) * contrast + .5); lum = Math.pow(lum, gamma);
    const r = cell * .72 * Math.sqrt(1 - lum); if (r < .35) continue;
    x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  }
  // keep the silhouette: paper-coloured fill where the source is opaque, dots on top
  if (!paper) { const bg = mkCanvas(w, h), b = bg.getContext('2d'); b.drawImage(src, 0, 0); b.globalCompositeOperation = 'source-in'; b.fillStyle = C.light; b.fillRect(0, 0, w, h); b.globalCompositeOperation = 'source-over'; b.drawImage(out, 0, 0); b.globalCompositeOperation = 'destination-in'; b.drawImage(src, 0, 0); return bg; }
  return out;
}
// duotone: luminance mapped from `dark` to `light` (the Vox "tinted archival photo")
export function duotone(src, { dark = C.ink, light = C.paper, contrast = 1.1, mid } = {}) {
  const w = src.width, h = src.height, x = src.getContext('2d'), im = x.getImageData(0, 0, w, h), d = im.data;
  const A = hexBytes(dark), B = hexBytes(light), M = mid ? hexBytes(mid) : null;
  for (let i = 0; i < d.length; i += 4) {
    let l = (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) / 255; l = clamp((l - .5) * contrast + .5);
    for (let c = 0; c < 3; c++) d[i + c] = M ? (l < .5 ? A[c] + (M[c] - A[c]) * l * 2 : M[c] + (B[c] - M[c]) * (l - .5) * 2) : A[c] + (B[c] - A[c]) * l;
  }
  const out = mkCanvas(w, h); out.getContext('2d').putImageData(im, 0, 0); return out;
}
// film/print grain multiplied onto a canvas (keeps alpha)
export function roughen(src, amount = .5, seed = 4) {
  const out = mkCanvas(src.width, src.height), x = out.getContext('2d'); x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.globalAlpha = amount * .5;
  const p = x.createPattern(paperCanvas('#808080', { seed }), 'repeat'); x.fillStyle = p; x.globalCompositeOperation = 'overlay'; x.fillRect(0, 0, out.width, out.height);
  x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0);
  return out;
}

// render a small 3D sub-scene to a canvas (for printed photos of procedural subjects).
// build(sub) receives { scene, cam, THREE } and returns nothing; the camera frames the subject.
const _prevRT = { rt: null };
export function renderToCanvas(build, w = 640, h = 640, { bg = null, frame, pad = 1.15 } = {}) {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, w / h, .05, 200);
  cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b6457', 1.6)); scene.environment = studioEnv();
  const key = new THREE.DirectionalLight('#fff6ea', 2.6); key.position.set(-3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#dfe8ff', 1.2); rim.position.set(4, 2, -3); scene.add(rim);
  build({ scene, cam, THREE, key, rim });
  if (frame) frameObject(cam, frame === true ? scene : frame, w / h, pad);
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const prevShadow = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
  _prevRT.rt = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.setClearColor(bg ?? '#000000', bg ? 1 : 0); renderer.clear(); renderer.render(scene, cam);
  const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
  renderer.setRenderTarget(_prevRT.rt); renderer.shadowMap.enabled = prevShadow;
  rt.dispose(); scene.traverse(o => { o.geometry?.dispose?.(); });
  const c = mkCanvas(w, h), x = c.getContext('2d'), im = x.createImageData(w, h);
  for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);   // flip: GL rows are bottom-up
  x.putImageData(im, 0, 0);
  return c;
}
export function frameObject(cam, obj, aspect, pad = 1.15) {
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const fov = cam.fov * Math.PI / 180, fitH = size.y / 2 / Math.tan(fov / 2), fitW = size.x / 2 / Math.tan(fov / 2) / aspect;
  const d = Math.max(fitH, fitW) * pad + size.z / 2, dir = cam.position.clone().sub(cam.userData.target || new THREE.Vector3()).normalize();
  if (!isFinite(d)) return;
  cam.position.copy(ctr).addScaledVector(dir.lengthSq() ? dir : new THREE.Vector3(0, 0, 1), d); cam.lookAt(ctr);
}

// ---------- materials ----------
// paper-like PBR material: matte, with the grain as a bump map so raking light shows the fibres
export function paperMat(map, { rough = .92, bump = .35, alpha = false, color } = {}) {
  const m = new THREE.MeshStandardMaterial({ map, color: color ?? '#ffffff', roughness: rough, metalness: 0, bumpMap: grainTex(), bumpScale: bump,
    alphaTest: alpha ? .5 : 0, alphaToCoverage: alpha, side: THREE.DoubleSide });
  m.envMapIntensity = .05;                                       // paper: lit by the key + fill; the room only adds a touch
  m.userData.vox = true;
  return m;
}
function depthFor(mesh) {                                        // shadows follow the cut shape
  const m = mesh.material; if (!m.alphaTest) return;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: m.map, alphaTest: .5 });
}
export function solidMat(color, { rough = .6, metal = 0, emissive, emissiveIntensity = 1, env = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...(emissive ? { emissive, emissiveIntensity } : {}) });
  m.envMapIntensity = env; m.userData.vox = true; return m;
}

// ---------- building blocks ----------
const PX = 190;                                                 // canvas pixels per world unit for cards and text
function sizeFor(w, h, res) { const r = Math.min(res, 2048 / w, 2048 / h); return [Math.max(4, Math.round(w * r)), Math.max(4, Math.round(h * r)), r]; }
function planeMesh(w, h, mat, curl = 0) {
  const g = new THREE.PlaneGeometry(w, h, curl ? 12 : 1, curl ? 12 : 1);
  if (curl) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w, v = p.getY(i) / h; p.setZ(i, curl * (u * u + v * v * .5) * Math.min(w, h)); } g.computeVertexNormals(); }
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}

// card: a sheet of paper (or card stock) with anything drawn on it.
//   card({ w, h, color, draw(ctx, cw, ch, t), dynamic, torn, edges, radius, border, curl, rough, print })
//   draw works in canvas pixels (cw x ch = w*res x h*res). dynamic: redraw every frame (animated content).
export function card(o = {}) {
  const { w = 4, h = 3, color = C.paper, draw, dynamic = false, torn = 0, edges = 'tblr', radius = 0, border = 0, curl = 0, rough = .92, seed = 1,
    res = PX, bg = true, grain = 1, shadowInk = false } = o;
  const [cw, ch, r] = sizeFor(w, h, res), cv = mkCanvas(cw, ch), x = cv.getContext('2d');
  const alpha = torn > 0 || radius > 0 || !bg;
  const paint = (t) => {
    x.save(); x.clearRect(0, 0, cw, ch);
    if (torn > 0) { tornPath(x, cw, ch, { amount: torn * r / PX * 1.6, seed, edges }); x.clip(); }
    else if (radius > 0) { rrect(x, 0, 0, cw, ch, radius * r); x.clip(); }
    if (bg) { x.fillStyle = x.createPattern(paperCanvas(color, { grain }), 'repeat'); x.fillRect(0, 0, cw, ch); }
    if (border > 0) { x.strokeStyle = C.light; x.lineWidth = border * r * 2; x.strokeRect(0, 0, cw, ch); }
    if (draw) { x.save(); draw(x, cw, ch, t ?? 0, r); x.restore(); }
    if (shadowInk) { x.globalCompositeOperation = 'multiply'; x.globalAlpha = .18; x.fillStyle = x.createPattern(paperCanvas('#9a9690'), 'repeat'); x.fillRect(0, 0, cw, ch); }
    x.restore();
  };
  paint(0);
  const tex = canvasTex(cv), mesh = planeMesh(w, h, paperMat(tex, { rough, alpha }), curl);
  depthFor(mesh);
  mesh.userData.kind = o.kind || 'card'; mesh.userData.size = [w, h];
  let last = -1;
  if (dynamic) mesh.userData.redraw = (t) => { const f = Math.round(t * 30); if (f === last) return; last = f; paint(t); tex.needsUpdate = true; };
  mesh.userData.canvas = cv; mesh.userData.repaint = (t) => { paint(t); tex.needsUpdate = true; };
  return mesh;
}

// cutout: an illustration drawn on a transparent canvas, cut out with a white sticker border (the collage staple).
//   cutout({ w, h, draw(ctx, cw, ch, t, pxPerUnit), border (units), grain, treat: c => c (halftone/duotone...) })
export function cutout(o = {}) {
  const { w = 3, h = 3, draw, border = .09, res = PX, treat, grain = .5, dynamic = false, seed = 2, canvas } = o;
  const [cw, ch, r] = sizeFor(w, h, res);
  const make = (t) => {
    let c = canvas || mkCanvas(cw, ch);
    if (!canvas) { const x = c.getContext('2d'); draw?.(x, cw, ch, t ?? 0, r); }
    if (treat) c = treat(c);
    if (grain > 0) c = roughen(c, grain, seed);
    return stickerize(c, Math.round(border * r));
  };
  let cv = make(0);
  const bw = w + border * 2, bh = h + border * 2;
  const tex = canvasTex(cv), mesh = planeMesh(bw, bh, paperMat(tex, { alpha: true, rough: .85 }));
  depthFor(mesh); mesh.userData.kind = o.kind || 'cutout'; mesh.userData.size = [bw, bh];
  if (dynamic) { let last = -1; mesh.userData.redraw = (t) => { const f = Math.round(t * 30); if (f === last) return; last = f; cv = make(t); tex.image = cv; tex.needsUpdate = true; }; }
  return mesh;
}

// photo: a procedural 3D subject rendered and printed. build(sub) sets up sub.scene (see renderToCanvas).
//   photo({ w, h, build, style: 'halftone'|'duotone'|'color'|'bw', ink, light, cut: true (sticker cut-out) | false (rect print), torn })
export function photo(o = {}) {
  const { w = 4, h = 4, build, style = 'duotone', ink = C.ink, light = C.paper, mid, cut = true, cell = 6, torn = .8, bg = null, frame } = o;
  const [cw, ch] = sizeFor(w, h, o.res ?? 150);
  let c = renderToCanvas(build, cw, ch, { bg: cut ? null : (bg ?? '#d9d4ca'), frame, pad: o.pad ?? 1.15 });
  let W0 = w, H0 = h;
  if (cut) {                                                     // crop to the subject so the print fills its box
    const d = c.getContext('2d').getImageData(0, 0, cw, ch).data; let x0 = cw, y0 = ch, x1 = 0, y1 = 0;
    for (let y = 0; y < ch; y += 2) for (let x = 0; x < cw; x += 2) if (d[(y * cw + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 > x0 && y1 > y0) { const bw = x1 - x0 + 2, bh = y1 - y0 + 2, k = Math.min(w / bw, h / bh), cc = mkCanvas(bw, bh); cc.getContext('2d').drawImage(c, x0, y0, bw, bh, 0, 0, bw, bh); c = cc; W0 = bw * k; H0 = bh * k; }
  }
  if (style === 'duotone') c = duotone(c, { dark: ink, light, mid, contrast: o.contrast ?? 1.15 });
  else if (style === 'bw') c = duotone(c, { dark: '#161514', light: '#f1ede4', contrast: o.contrast ?? 1.25 });
  if (style === 'halftone') c = halftone(c, { cell, ink, paper: cut ? null : light });
  if (cut) return cutout({ w: W0, h: H0, canvas: c, border: o.border ?? .1, grain: o.grain ?? .5, kind: o.kind || 'photo' });
  return card({ w, h, color: light, torn, kind: o.kind || 'photo', draw: (x, W2, H2) => { x.drawImage(c, 0, 0, W2, H2); } });
}

// ---------- text ----------
// Layout text into lines with per-character x positions (canvas px). spacing in em.
function layout(x, str, fontCss, px, maxW, spacing) {
  x.font = fontCss; x.letterSpacing = '0px';
  const words = String(str).split(/(\s+)/), lines = []; let cur = '';
  const width = s => { let w = 0; for (const ch of s) w += x.measureText(ch).width + spacing * px; return w - (s.length ? spacing * px : 0); };
  for (const wd of words) {
    if (wd === '\n') { lines.push(cur); cur = ''; continue; }
    const test = cur + wd;
    if (maxW && cur.trim() && width(test.trimEnd()) > maxW && !/^\s+$/.test(wd)) { lines.push(cur.trimEnd()); cur = wd.trimStart(); }
    else cur = test;
  }
  if (cur.trim() || !lines.length) lines.push(cur.trimEnd());
  return lines.map(l => { const xs = []; let p = 0; for (const ch of l) { xs.push(p); p += x.measureText(ch).width + spacing * px; } return { text: l, xs, w: p - (l.length ? spacing * px : 0) }; });
}
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%#&';
// words: a text element (transparent background unless `plate`). Sizes in world units; `size` = font size.
//   anim: 'none' | 'fill' (sweep in accent, settle to colour) | 'type' (typewriter) | 'random' (letters appear at random)
//         | 'odometer' (slot-machine roll) | 'rise' (word by word) | 'decode' (scramble) ; at / dur: when
//   highlight: { from, to (char indices or a substring via 'match'), color, at, dur }  marker swipe behind letters
//   text may be a function of t (counters): words({ text: t => '$' + fmt(v(t)), font: 'mono' })
export function words(str, o = {}) {
  if (typeof str === 'object' && str && !Array.isArray(str) && !(str instanceof String)) { o = str; str = o.text; }
  const { size = .8, font = 'serif', weight = 700, italic = false, color = C.ink, align = 'center', width, lineHeight = 1.08, spacing = 0,
    anim = 'none', at = 0, dur, accent = C.accent, plate = null, pad = .25, upper = false, highlight = null, underline = null, stroke = null, res = 210, seed = 7 } = o;
  const fn = typeof str === 'function' ? str : null, base = fn ? fn(1e9) : String(str);
  const text0 = t => { const s = fn ? String(fn(t)) : base; return upper ? s.toUpperCase() : s; };
  const probe = mkCanvas(8, 8).getContext('2d'), fpx = size * res, fcss = fontStr(font, weight, fpx, italic);
  const maxW = width ? width * res : 0;
  const measure = s => layout(probe, s, fcss, fpx, maxW, spacing);
  let L = measure(text0(1e9)); if (fn) { const L2 = measure(text0(0)); if (Math.max(...L2.map(l => l.w)) > Math.max(...L.map(l => l.w))) L = L2; }
  const lh = fpx * lineHeight, padPx = plate ? pad * res : fpx * .18;
  const tw = Math.max(...L.map(l => l.w), 1) * (fn ? 1.12 : 1), th = lh * L.length;
  const nw = width ? Math.max(maxW, tw) + padPx * 2 : tw + padPx * 2, nh = th + padPx * 2 + fpx * .2;   // natural size (px at res)
  const sc = Math.min(1, 2048 / nw, 2048 / nh);
  const cw = nw, ch = nh;                                           // layout space; the canvas itself is scaled by sc
  const cv = mkCanvas(nw * sc, nh * sc), x = cv.getContext('2d');
  const D = dur ?? ({ none: 0, fill: .7, type: Math.max(.4, base.length * .045), random: .8, odometer: .9, rise: .6, decode: .7 }[anim] ?? .6);
  const hl = highlight ? { color: accent, at, dur: .45, ...highlight } : null;
  if (hl?.match) { const i = base.indexOf(hl.match); hl.from = i; hl.to = i + hl.match.length; }
  const ul = underline ? { color: accent, at, dur: .45, ...underline } : null;
  const r = rng(seed), randT = Array.from({ length: 400 }, () => r());
  const paint = (t) => {
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.scale(sc, sc);
    const Ls = fn ? measure(text0(t)) : L;
    if (plate) { x.fillStyle = x.createPattern(paperCanvas(plate), 'repeat'); rrect(x, 0, 0, cw, ch, (o.radius ?? .08) * res); x.fill(); }
    x.font = fcss; x.textBaseline = 'alphabetic';
    const p = D ? clamp((t - at) / D) : (t >= at ? 1 : 0);
    let ci = 0;
    Ls.forEach((ln, li) => {
      const ox = align === 'center' ? (cw - ln.w) / 2 : align === 'right' ? cw - padPx - ln.w : padPx;
      const oy = padPx + li * lh + fpx * .86;
      // marker highlight behind a character range
      if (hl && hl.from != null) {
        const a0 = Math.max(hl.from - ci, 0), a1 = Math.min(hl.to - ci, ln.text.length);
        if (a1 > a0) {
          const hp = easeOut((t - hl.at) / hl.dur); const x0 = ox + ln.xs[a0] - fpx * .08, x1 = ox + (a1 < ln.text.length ? ln.xs[a1] : ln.w) + fpx * .08;
          if (hp > 0) markerRect(x, x0, oy - fpx * .78, x0 + (x1 - x0) * hp, oy + fpx * .2, hl.color, seed + li);
        }
      }
      for (let k = 0; k < ln.text.length; k++, ci++) {
        const chr = ln.text[k]; if (chr === ' ') continue;
        let a = 1, dy = 0, col = color, glyph = chr;
        if (anim === 'type') { a = ci < Math.floor(p * base.length + .001) ? 1 : 0; }
        else if (anim === 'random') { const tt = at + randT[ci % 400] * D * .8; a = clamp((t - tt) / .12); }
        else if (anim === 'rise') { const wi = ln.text.slice(0, k).split(' ').length - 1 + li * 3; const tt = at + wi * .09; const q = clamp((t - tt) / .35); a = q; dy = (1 - easeOut(q)) * fpx * .35; }
        else if (anim === 'decode') { const n = Math.floor(p * base.length * 1.2); if (ci >= n) glyph = GLYPHS[Math.floor(hashf(ci + Math.floor(t * 20)) * GLYPHS.length)]; a = p > 0 ? 1 : 0; }
        else if (anim === 'fill') { const cx = (ox + ln.xs[k]) / cw; const sweep = clamp((p * 1.25 - cx) * 6); a = sweep > 0 ? 1 : 0; const settleK = clamp((t - at - D - .35) / .45); col = mixHex(accent, color, settleK); }
        else if (anim === 'odometer') { const tt = at + (ci / Math.max(1, base.length)) * D * .5, q = clamp((t - tt) / (D * .6));
          if (q <= 0) { a = 0; } else if (q < 1) { const rolls = 6, pos = easeOut(q) * rolls; dy = (pos - Math.floor(pos)) * lh * .9; glyph = Math.floor(pos) < rolls - 1 ? (/\d/.test(chr) ? String(Math.floor(hashf(ci * 7 + Math.floor(pos)) * 10)) : chr) : chr; x.save(); x.beginPath(); x.rect(ox + ln.xs[k] - fpx * .1, oy - fpx * .95, fpx, fpx * 1.2); x.clip(); } }
        if (a <= 0) continue;
        x.globalAlpha = a; x.fillStyle = col;
        if (stroke) { x.lineJoin = 'round'; x.lineWidth = stroke.width * res; x.strokeStyle = stroke.color; x.strokeText(glyph, ox + ln.xs[k], oy - dy); }
        x.fillText(glyph, ox + ln.xs[k], oy - dy);
        if (anim === 'odometer') { const tt = at + (ci / Math.max(1, base.length)) * D * .5, q = clamp((t - tt) / (D * .6)); if (q > 0 && q < 1) x.restore(); }
      }
      if (ul) { const up = easeOut((t - ul.at) / ul.dur); if (up > 0) markerLine(x, ox - fpx * .05, oy + fpx * .16, ox + (ln.w + fpx * .1) * up, oy + fpx * .12, ul.color, fpx * .09, seed + li); }
      ci++;
    });
    if (anim === 'type' && p < 1 && p > 0 && Math.floor(t * 3) % 2 === 0) {   // blinking caret
      const ln = Ls[Ls.length - 1]; x.globalAlpha = 1; x.fillStyle = color; x.fillRect((align === 'center' ? (cw - ln.w) / 2 : padPx) + ln.w * p + 4, padPx + (Ls.length - 1) * lh + fpx * .1, fpx * .06, fpx * .8);
    }
    x.globalAlpha = 1;
  };
  const tex = canvasTex(cv);
  const mesh = planeMesh(cw / res, ch / res, paperMat(tex, { alpha: true, rough: .8, bump: plate ? .3 : .05 }));
  depthFor(mesh);
  mesh.castShadow = o.shadow ?? !!plate; mesh.userData.kind = o.kind || 'text'; mesh.userData.text = base; mesh.userData.size = [cw / res, ch / res];
  paint(0);
  let last = -2;
  const animEnd = at + D + (anim === 'fill' ? .9 : 0) + Math.max(hl ? hl.at + hl.dur - at : 0, ul ? ul.at + ul.dur - at : 0);
  mesh.userData.redraw = (t) => {
    const live = fn || (t >= at - .05 && t <= animEnd + .1) || last === -2;
    const f = live ? Math.round(t * 30) : (t < at ? -3 : -4);
    if (f === last) return false; last = f; paint(t); tex.needsUpdate = true; return true;
  };
  mesh.userData.start = at;
  // tactile sound for the animation: typewriter clacks, odometer ticks, a marker swipe for highlights
  const sounds = [];
  if (anim === 'type') sounds.push({ type: 'type', t: at, dur: D });
  if (anim === 'odometer' || anim === 'random') sounds.push({ type: 'tick', t: at, dur: D * (anim === 'random' ? .8 : 1), gain: anim === 'random' ? -4 : 0 });
  if (anim === 'fill') sounds.push({ type: 'pop', t: at, gain: -3 });
  if (hl) sounds.push({ type: 'marker', t: hl.at, dur: hl.dur });
  if (ul) sounds.push({ type: 'marker', t: ul.at, dur: ul.dur });
  if (sounds.length) mesh.userData.sfx = sounds;
  return mesh;
}
export function mixHex(a, b, k) { const A = hexBytes(a), B = hexBytes(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * clamp(k))).join(',')})`; }
// marker rectangle with rough ends (the Vox highlighter)
export function markerRect(x, x0, y0, x1, y1, col, seed = 1) {
  const r = rng(seed * 7 + 3); x.save(); x.globalAlpha = .92; x.fillStyle = col; x.beginPath();
  const h = y1 - y0; x.moveTo(x0 + r() * h * .15, y0 + r() * h * .1);
  for (let k = 1; k <= 8; k++) x.lineTo(x0 + (x1 - x0) * k / 8, y0 + (r() - .5) * h * .08);
  x.lineTo(x1 + r() * h * .1, y1 - r() * h * .12);
  for (let k = 7; k >= 0; k--) x.lineTo(x0 + (x1 - x0) * k / 8, y1 + (r() - .5) * h * .08);
  x.closePath(); x.fill(); x.restore();
}
export function markerLine(x, x0, y0, x1, y1, col, w, seed = 1) {
  const r = rng(seed); x.save(); x.strokeStyle = col; x.lineCap = 'round'; x.lineWidth = w; x.globalAlpha = .95; x.beginPath(); x.moveTo(x0, y0);
  const n = 6; for (let k = 1; k <= n; k++) x.lineTo(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n + (r() - .5) * w * .5); x.stroke(); x.restore();
}

// tag: a label on a strip of paper / plaque / sticker / masking tape.
//   tag(str, { style: 'paper'|'plaque'|'sticker'|'tape'|'dark', size, font, color, rot })
export function tag(str, o = {}) {
  const { style = 'paper', size = .5, font = style === 'plaque' ? 'garamond' : style === 'sticker' ? 'black' : style === 'tape' ? 'mono' : 'serif', weight = style === 'sticker' ? 400 : 700 } = o;
  const plate = { paper: C.paper, plaque: C.dark, sticker: C.light, tape: '#e9dfb9', dark: C.dark }[style];
  const color = o.color ?? { paper: C.ink, plaque: C.accent2 === C.ink ? C.paper : '#e8c77a', sticker: C.ink, tape: C.ink, dark: C.light }[style];
  const m = words(str, { size, font, weight, color, plate: o.plate ?? plate, pad: o.pad ?? size * .45, radius: style === 'sticker' ? size * .25 : .02, shadow: true, ...o, kind: 'tag' });
  if (style === 'paper' || style === 'tape') {                  // torn ends: re-cut the plate
    const cv = m.material.map.image, x = cv.getContext('2d'), redraw0 = m.userData.redraw;
    m.userData.redraw = (t) => { if (!redraw0(t)) return false; x.save(); x.globalCompositeOperation = 'destination-in'; tornPath(x, cv.width, cv.height, { amount: 1.4, seed: str.length, edges: 'lr', inset: 0 }); x.fill(); x.restore(); m.material.map.needsUpdate = true; return true; };
  }
  if (style === 'plaque') {                                      // thin gold keyline
    const cv = m.material.map.image, x = cv.getContext('2d'), redraw0 = m.userData.redraw;
    m.userData.redraw = (t) => { if (!redraw0(t)) return false; x.save(); x.strokeStyle = '#c9a45a'; x.lineWidth = Math.max(2, cv.height * .035); rrect(x, cv.height * .09, cv.height * .09, cv.width - cv.height * .18, cv.height * .82, cv.height * .06); x.stroke(); x.restore(); m.material.map.needsUpdate = true; return true; };
  }
  return m;
}

// scribble: hand-drawn marker annotation that draws on. kind: 'circle' | 'underline' | 'arrow' | 'cross' | 'check' | 'box' | 'bracket' | 'path'
//   scribble('circle', { w, h, color, width (units), at, dur, pts: [[x,y],...] for 'path' in 0..1 space, bend })
export function scribble(kind, o = {}) {
  const { w = 3, h = 1.5, color = C.accent2, width = .07, at = 0, dur = .5, seed = 5, bend = .25, head = true } = o;
  const res = 150, [cw, ch, r] = sizeFor(w + width * 4, h + width * 4, res), pad = width * 2 * r, R = rng(seed);
  const W2 = cw - pad * 2, H2 = ch - pad * 2; let pts = [];
  const jit = s => (R() - .5) * s;
  if (kind === 'circle') { const n = 64, turns = 1.12, a0 = -1.9 + jit(.4); for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI * 2 * turns, rr = 1 + Math.sin(i * .21 + seed) * .035 + (i / n) * .04; pts.push([pad + W2 / 2 + Math.cos(a) * W2 / 2 * rr, pad + H2 / 2 + Math.sin(a) * H2 / 2 * rr]); } }
  else if (kind === 'underline') { const n = 16; for (let i = 0; i <= n; i++) pts.push([pad + W2 * i / n, pad + H2 / 2 + Math.sin(i * .9 + seed) * H2 * .12]); }
  else if (kind === 'arrow' || kind === 'path') {
    const P = o.pts || [[0, 1], [.5, .5 - bend], [1, 0]];
    const n = 40; const B = (a, b, c, k) => (1 - k) * (1 - k) * a + 2 * (1 - k) * k * b + k * k * c;
    if (P.length === 3) for (let i = 0; i <= n; i++) { const k = i / n; pts.push([pad + W2 * B(P[0][0], P[1][0], P[2][0], k), pad + H2 * B(P[0][1], P[1][1], P[2][1], k)]); }
    else pts = P.map(([a, b]) => [pad + W2 * a, pad + H2 * b]);
  }
  else if (kind === 'cross') pts = [[pad, pad], [pad + W2, pad + H2], null, [pad + W2, pad], [pad, pad + H2]];
  else if (kind === 'check') pts = [[pad, pad + H2 * .55], [pad + W2 * .35, pad + H2], [pad + W2, pad]];
  else if (kind === 'box') { const j = () => jit(W2 * .02); pts = [[pad + j(), pad + j()], [pad + W2 + j(), pad + j()], [pad + W2 + j(), pad + H2 + j()], [pad + j(), pad + H2 + j()], [pad + j(), pad + j() + H2 * .1]]; }
  else if (kind === 'bracket') pts = [[pad + W2 * .3, pad], [pad, pad + H2 * .08], [pad, pad + H2 * .92], [pad + W2 * .3, pad + H2]];
  const segs = [[]]; pts.forEach(p => p ? segs[segs.length - 1].push(p) : segs.push([]));
  const lens = segs.map(s => s.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - s[i][0], p[1] - s[i][1]), 0)), total = lens.reduce((a, b) => a + b, 0);
  const cv = mkCanvas(cw, ch), x = cv.getContext('2d');
  const paint = (t) => {
    x.clearRect(0, 0, cw, ch); const p = easeInOut((t - at) / dur); if (p <= 0) return;
    let budget = p * total;
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const pass of [[1, 1], [.55, .4]]) {                     // two passes: body + a lighter dry-brush edge
      let b = budget; x.strokeStyle = color; x.globalAlpha = pass[0] * .95; x.lineWidth = width * r * pass[1] * (pass[1] < 1 ? 1.5 : 1);
      for (let si = 0; si < segs.length; si++) {
        const s = segs[si]; if (s.length < 2 || b <= 0) continue;
        x.beginPath(); x.moveTo(s[0][0] + (pass[1] < 1 ? 1.5 : 0), s[0][1]); let last = s[0];
        for (let i = 1; i < s.length && b > 0; i++) { const d = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); const k = Math.min(1, b / d); last = [s[i - 1][0] + (s[i][0] - s[i - 1][0]) * k, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * k]; x.lineTo(last[0], last[1]); b -= d; }
        x.stroke();
        if (kind === 'arrow' && head && si === segs.length - 1 && b > -1e-6 && p > .98) {   // arrow head once the line arrives
          const e = s[s.length - 1], q = s[s.length - 3] || s[0], ang = Math.atan2(e[1] - q[1], e[0] - q[0]), hl = width * r * 4.2;
          x.beginPath(); x.moveTo(e[0] - Math.cos(ang - .5) * hl, e[1] - Math.sin(ang - .5) * hl); x.lineTo(e[0], e[1]); x.lineTo(e[0] - Math.cos(ang + .5) * hl, e[1] - Math.sin(ang + .5) * hl); x.stroke();
        }
      }
    }
    x.globalAlpha = 1;
  };
  const tex = canvasTex(cv), mesh = planeMesh(cw / r, ch / r, paperMat(tex, { alpha: true, rough: .5, bump: 0 }));
  mesh.castShadow = false; mesh.userData.kind = 'scribble';
  let last = -2; mesh.userData.redraw = (t) => { const f = t < at ? -3 : t > at + dur ? -4 : Math.round(t * 30); if (f === last) return; last = f; paint(t); tex.needsUpdate = true; };
  mesh.userData.start = at; mesh.userData.sfx = { type: 'marker', t: at, dur };
  return mesh;
}

// ---------- boards (backgrounds) ----------
// board(kind, { color, tint, scale, seed }): a big plane behind everything, sized to survive camera moves.
// kinds: paper | grid | dots | wood | felt | plaster | cork | chalk | newsprint | swirl | stripes
export function boardCanvas(kind, o = {}) {
  const { color, seed = 3, line = C.line } = o;
  return cached(`board${kind}${color}${seed}${line}${o.tint}${o.color2}`, () => {
    const S = 1024;
    if (kind === 'paper') return paperCanvas(color || C.bg, { seed });
    if (kind === 'grid' || kind === 'dots') {
      const c = mkCanvas(S, S), x = c.getContext('2d'); x.drawImage(paperCanvas(color || C.paper, { seed, fibers: .5 }), 0, 0);
      x.strokeStyle = line; x.fillStyle = line;
      if (kind === 'grid') { for (let i = 0; i <= S; i += 32) { x.globalAlpha = i % 128 === 0 ? .75 : .38; x.lineWidth = i % 128 === 0 ? 2.2 : 1.2; x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); } }
      else { x.globalAlpha = .8; for (let i = 16; i < S; i += 64) for (let j = 16; j < S; j += 64) { x.beginPath(); x.arc(i, j, 2.6, 0, Math.PI * 2); x.fill(); } }
      x.globalAlpha = 1; return c;
    }
    if (kind === 'wood') {
      const c = mkCanvas(S, S), x = c.getContext('2d'), base = hexBytes(color || '#6b4526'), n = tileNoise(S, 8, 3, seed), r = rng(seed);
      const img = x.createImageData(S, S), d = img.data;
      for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
        const plank = Math.floor(xx / 256), pr = hashf(plank + seed) - .5, u = (xx % 256) / 256;
        const warp = n[y * S + xx] * 10, g = Math.sin((xx + warp * 1.4 + plank * 37) * .42 + Math.sin(y * .006 + plank * 2) * 1.6) * .5 + .5;
        const fine = Math.sin((xx + warp) * 1.9 + y * .01) * .5 + .5;
        const ring = Math.pow(g, 7) * 30 + fine * 6, edge = (u < .01 || u > .99) ? -60 : 0, v = (pr * 30) - ring + edge + (n[y * S + xx] - .5) * 22;
        const i = (y * S + xx) * 4; d[i] = base[0] + v; d[i + 1] = base[1] + v * .8; d[i + 2] = base[2] + v * .6; d[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      for (let k = 0; k < 3; k++) { const kx = r() * S, ky = r() * S; const gr = x.createRadialGradient(kx, ky, 2, kx, ky, 26); gr.addColorStop(0, 'rgba(40,20,8,.55)'); gr.addColorStop(1, 'rgba(40,20,8,0)'); x.fillStyle = gr; x.fillRect(kx - 30, ky - 30, 60, 60); }
      return c;
    }
    if (kind === 'felt' || kind === 'cork' || kind === 'plaster' || kind === 'chalk') {
      const col = color || { felt: '#2c5aa0', cork: '#b98a55', plaster: '#b89a74', chalk: '#2e3431' }[kind];
      const c = mkCanvas(S, S), x = c.getContext('2d'), base = hexBytes(col), img = x.createImageData(S, S), d = img.data;
      const f = tileNoise(S, kind === 'cork' ? 160 : 256, 2, seed), m = tileNoise(S, kind === 'plaster' ? 10 : 20, 4, seed + 2);
      for (let i = 0; i < S * S; i++) {
        const v = kind === 'cork' ? (f[i] - .5) * 90 + (m[i] - .5) * 30 : kind === 'plaster' ? (f[i] - .5) * 18 + (m[i] - .5) * 60 : kind === 'chalk' ? (f[i] - .5) * 14 + (m[i] - .5) * 26 : (f[i] - .5) * 34 + (m[i] - .5) * 18;
        d[i * 4] = base[0] + v; d[i * 4 + 1] = base[1] + v; d[i * 4 + 2] = base[2] + v; d[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      if (kind === 'plaster') { const r = rng(seed); x.strokeStyle = 'rgba(60,40,25,.25)'; for (let k = 0; k < 6; k++) { let px = r() * S, py = r() * S; x.lineWidth = 1 + r(); x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 30; s++) { px += (r() - .5) * 22; py += (r() - .3) * 18; x.lineTo(px, py); } x.stroke(); } }
      if (kind === 'chalk') { const r = rng(seed); for (let k = 0; k < 20; k++) { x.fillStyle = `rgba(255,255,255,${.015 + r() * .03})`; x.beginPath(); x.ellipse(r() * S, r() * S, 60 + r() * 160, 20 + r() * 60, r() * 3, 0, Math.PI * 2); x.fill(); } }
      if (kind === 'felt') { const r = rng(seed); for (let k = 0; k < 2500; k++) { x.strokeStyle = `rgba(255,255,255,${r() * .06})`; x.beginPath(); const px = r() * S, py = r() * S, a = r() * 6.3; x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 5, py + Math.sin(a) * 5); x.stroke(); } }
      return c;
    }
    if (kind === 'newsprint') {                                  // layered tinted newspaper scan: headline, columns, photo boxes
      const c = mkCanvas(S * 2, S * 2), x = c.getContext('2d'), r = rng(seed);
      x.drawImage(paperCanvas(o.paper || '#e9e4d8', { seed }), 0, 0, S * 2, S * 2);
      x.fillStyle = '#1b1b1b'; x.font = `900 ${150}px ${FONTS.serif}`; x.textAlign = 'center'; x.fillText(o.masthead || 'The Daily Record', S, 170);
      x.fillRect(60, 210, S * 2 - 120, 6); x.fillRect(60, 226, S * 2 - 120, 2);
      x.font = `700 ${92}px ${FONTS.serif}`; const heads = o.headlines || ['MARKETS RALLY AS', 'RATES HOLD STEADY'];
      heads.forEach((hd, i) => x.fillText(hd, S, 350 + i * 100));
      x.textAlign = 'left'; x.font = `400 ${22}px ${FONTS.garamond}`;
      const lorem = 'the of and to in a is that for it as was with be by on not he this are or his from at which but have an they you were her all she there would their we him been has when who will more no if out so said what up its about into than them can only other new some could time these two may then do first any my now such like our over man me even most made after also did many before must through back years where much your way well down should because each just those people how too little state good very make world still own see men work long get here between both life being under never day same another know while last might us great old year off come since against go came right used take three';
      const LW = lorem.split(' ');
      for (let col = 0; col < 4; col++) {
        const cx = 70 + col * ((S * 2 - 140) / 4), cwid = (S * 2 - 140) / 4 - 30;
        let y = 560; if (col === 1 || col === 3) { x.fillStyle = '#6c6a66'; x.fillRect(cx, y, cwid, 300 + r() * 160); x.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 900; k++) x.fillRect(cx + r() * cwid, y + r() * 300, 3, 3); y += 480; x.fillStyle = '#1b1b1b'; }
        x.fillStyle = '#2b2a28';
        while (y < S * 2 - 60) { let line = '', wi = Math.floor(r() * LW.length); while (x.measureText(line + LW[wi % LW.length]).width < cwid) { line += LW[wi % LW.length] + ' '; wi++; } x.fillText(line, cx, y); y += 27; if (r() < .05) y += 20; }
      }
      if (o.tint) { const t2 = duotone(c, { dark: o.tint[0], light: o.tint[1], contrast: .9 }); return t2; }
      return c;
    }
    if (kind === 'swirl' || kind === 'stripes') {                 // concentric wavy cut-paper rings (poster energy)
      const c = mkCanvas(S * 2, S * 2), x = c.getContext('2d'), a = color || C.accent2, b = o.color2 || C.light, r = rng(seed);
      const N = 11, ph = Array.from({ length: 6 }, () => r() * 6.28);
      for (let i = N; i >= 1; i--) {
        const rad = i / N * S * 1.45; x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 18; x.shadowOffsetY = 6;
        x.fillStyle = x.createPattern(paperCanvas(i % 2 ? a : b, { seed: i }), 'repeat'); x.beginPath();
        for (let k = 0; k <= 120; k++) { const ang = k / 120 * Math.PI * 2, w = 1 + .07 * Math.sin(ang * 3 + ph[0] + i * .5) + .05 * Math.sin(ang * 5 + ph[1] - i * .3) + .03 * Math.sin(ang * 9 + ph[2]);
          const px = S + Math.cos(ang) * rad * w * (kind === 'stripes' ? 1.4 : 1), py = S * 1.05 + Math.sin(ang) * rad * w * 1.25; k ? x.lineTo(px, py) : x.moveTo(px, py); }
        x.closePath(); x.fill(); x.restore();
      }
      return c;
    }
    return paperCanvas(color || C.bg, { seed });
  });
}
const TILED = new Set(['paper', 'grid', 'dots', 'wood', 'felt', 'cork', 'plaster', 'chalk']);
export function board(kind = 'paper', o = {}) {
  const w = o.w ?? FRAME.w * 3.2, h = o.h ?? FRAME.h * 3.2, cv = boardCanvas(kind, o);
  const tileU = o.scale ?? (kind === 'grid' || kind === 'dots' ? 4 : kind === 'wood' ? 7 : 4.5);   // world units per texture tile
  const tex = TILED.has(kind) ? canvasTex(cv, { repeat: [w / tileU, h / tileU] }) : canvasTex(cv);
  if (!TILED.has(kind)) { const s = o.fit ?? 1; tex.repeat.set(1 / s, 1 / s); tex.offset.set((1 - 1 / s) / 2, (1 - 1 / s) / 2); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), paperMat(tex, { rough: kind === 'felt' ? 1 : .93, bump: kind === 'wood' ? .6 : kind === 'felt' ? .8 : .35 }));
  m.material.side = THREE.FrontSide; m.receiveShadow = true; m.castShadow = false; m.position.z = o.z ?? 0; m.userData.kind = 'board:' + kind;
  if (o.darken) m.material.color.setScalar(1 - o.darken);
  return m;
}

// ---------- the collage stage: add + animate ----------
// S.add(obj, { at, in, from, dur, out, outAt, outDur, sfx })
//   in:  'drop' (falls onto the board, shadow tightens) | 'slide' (from 'left'|'right'|'top'|'bottom') | 'pop' | 'flip'
//        | 'rise' | 'fade' | 'grow' (scale up from its base) | 'none' (there from the start)
//   out: 'lift' | 'slide' | 'fade' | 'drop' ; outAt: when. Objects never idle-wobble: the camera carries the motion.
const ENTER_DUR = { drop: .42, slide: .5, pop: .38, flip: .45, rise: .5, fade: .4, grow: .6, none: 0, spin: .6 };
const SFX_FOR = { drop: 'paper', slide: 'slide', pop: 'pop', flip: 'flip', rise: null, fade: null, grow: 'grow', spin: 'slide' };
function addTo(S, obj, o = {}) {
  S.scene.add(obj);
  const a = { at: o.at ?? 0, in: o.in ?? 'drop', from: o.from ?? 'bottom', dur: o.dur ?? ENTER_DUR[o.in ?? 'drop'] ?? .45, out: o.out, outAt: o.outAt, outDur: o.outDur ?? .4, seed: S.anims.length + 1,
    p: obj.position.clone(), r: obj.rotation.clone(), s: obj.scale.clone(), to: o.to };
  obj.userData.anim = a; S.anims.push(obj);
  const sfxType = o.sfx === false ? null : typeof o.sfx === 'string' ? o.sfx : SFX_FOR[a.in];
  if (sfxType && a.in !== 'none') sfx(sfxType, a.at + (a.in === 'drop' ? a.dur * .82 : a.in === 'slide' ? 0 : a.dur * .2), { pan: panOf(obj) });
  if (a.out && a.outAt != null && o.sfx !== false) sfx(a.out === 'lift' ? 'lift' : 'slide', a.outAt, { pan: panOf(obj) });
  obj.traverse(ch => { const list = ch.userData.sfx; if (list) for (const e of Array.isArray(list) ? list : [list]) sfx(e.type, e.t, { dur: e.dur, pan: panOf(obj), gain: e.gain }); });
  obj.traverse(ch => { if (ch.userData.redraw) S.dyn.push(ch); });
  return obj;
}
const panOf = obj => clamp(.5 + obj.position.x / FRAME.w * .7, .1, .9);
function animate(obj, t) {
  const a = obj.userData.anim; if (!a) return;
  const k = a.in === 'none' ? 1 : (t - a.at) / Math.max(.001, a.dur);
  obj.position.copy(a.p); obj.rotation.copy(a.r); obj.scale.copy(a.s);
  if (k <= 0 && a.in !== 'none') { obj.visible = false; return; }
  obj.visible = true;
  const e = clamp(k), r1 = (hashf(a.seed) - .5), r2 = (hashf(a.seed + 9) - .5);
  const dirs = { left: [-1, 0], right: [1, 0], top: [0, 1], bottom: [0, -1] }, d = dirs[a.from] || dirs.bottom;
  switch (a.in) {
    case 'drop': { const f = 1 - easeOut(e); obj.position.z += f * 3.2; obj.position.x += f * r1 * .6; obj.position.y += f * r2 * .6; obj.rotation.z += (1 - settle(e, .25)) * r1 * .5; obj.scale.multiplyScalar(1 + f * .06); break; }
    case 'slide': { const f = 1 - easeOut(e); obj.position.x += d[0] * f * FRAME.w * 1.1; obj.position.y += d[1] * f * FRAME.h * .75; obj.position.z += f * .6; obj.rotation.z += (1 - settle(e, .2)) * r1 * .35; break; }
    case 'pop': { const s = easeOutBack(e, 1.7); obj.scale.multiplyScalar(Math.max(.001, s)); obj.rotation.z += (1 - e) * r1 * .3; break; }
    case 'flip': { obj.rotation.y += (1 - easeOut(e)) * Math.PI * .5 * (r1 > 0 ? 1 : -1); break; }
    case 'rise': { obj.position.y -= (1 - easeOut(e)) * .5; setAlpha(obj, e); break; }
    case 'fade': { setAlpha(obj, e); break; }
    case 'grow': { obj.scale.multiplyScalar(Math.max(.001, easeOut(e))); break; }
    case 'spin': { obj.rotation.y += (1 - easeOut(e)) * Math.PI * 2; break; }
  }
  if (a.in !== 'rise' && a.in !== 'fade' && e >= 1) setAlpha(obj, 1);
  if (a.out && a.outAt != null && t > a.outAt) {
    const q = clamp((t - a.outAt) / a.outDur);
    if (a.out === 'lift') { obj.position.z += easeIn(q) * 6; obj.position.y += easeIn(q) * 1.5; obj.rotation.z += easeIn(q) * r1 * .6; }
    else if (a.out === 'slide') { obj.position.x += easeIn(q) * FRAME.w * 1.2 * (d[0] || 1); }
    else if (a.out === 'drop') { obj.position.y -= easeIn(q) * FRAME.h; }
    else if (a.out === 'fade') setAlpha(obj, 1 - q);
    if (q >= 1) obj.visible = false;
  }
}
function setAlpha(obj, a) {
  obj.traverse(o => { if (!o.material) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
    if (m.userData.baseOpacity === undefined && a >= 1) continue;
    if (m.userData.baseOpacity === undefined) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; }
    m.opacity = m.userData.baseOpacity * a; m.transparent = a < 1 || m.userData.baseTransparent; m.depthWrite = a >= 1; } });
}

// ---------- sound events ----------
export const EVENTS = [];
// sfx(type, t, { pan, gain, dur }): paper | slide | lift | pop | flip | pin | tape | marker | type | tick | stamp | coin | whoosh | swish | snap | click | grow | thud
export function sfx(type, t, o = {}) { EVENTS.push(['sfx', +(+t).toFixed(3), type, +(o.pan ?? .5).toFixed(2), o.gain ?? 0, +(o.dur ?? 0).toFixed(3)]); }

// ---------- camera ----------
// Every shot: S.cam is posed from S.view (x, y, zoom, rot, tilt) + the drift + transitions.
//   S.moves([[at, { x, y, zoom, rot, tilt }, dur?], ...])  eased moves (cut-the-curve friendly: easeInOut)
//   S.drift = { zoom: .045, x: 0, y: 0 } across the shot (default from settings)
const D0 = (FRAME.h / 2) / Math.tan(SETTINGS.camera.fov * Math.PI / 360);
function viewAt(S, t) {
  const v = { x: 0, y: 0, zoom: 1, rot: 0, tilt: 0, ...(S.view || {}) };
  for (const [at, pose, dur = .9, e = easeInOut] of S._moves || []) {
    const k = e((t - at) / dur); if (k <= 0) continue;
    for (const key in pose) v[key] = lerp(v[key], pose[key], k);
  }
  const prog = clamp((t - S.t0) / Math.max(1, S.t1 - S.t0)), dr = { zoom: SETTINGS.camera.drift, x: 0, y: 0, rot: 0, ...(S.drift || {}) };
  v.zoom *= 1 + dr.zoom * prog; v.x += dr.x * prog; v.y += dr.y * prog; v.rot += dr.rot * prog;
  return v;
}
function poseCamera(S, v, off = { x: 0, y: 0, z: 1 }) {
  const cam = S.cam, dist = D0 / (v.zoom * off.z);
  cam.position.set(v.x + off.x, v.y + off.y - Math.sin(v.tilt) * dist, Math.cos(v.tilt) * dist + (S.focusZ ?? 0));
  cam.up.set(Math.sin(-v.rot), Math.cos(v.rot), 0); cam.lookAt(v.x + off.x, v.y + off.y, S.focusZ ?? 0);
  cam.updateMatrixWorld(); return dist;
}

// ---------- lights ----------
// S.light: 'desk' (warm key upper-left, soft shadows) | 'studio' (neutral) | 'spot' (pool of light, dark edges: archive)
//          | 'flat' (bright, faint shadows: diagrams) | 'window' (cool daylight from the right)
function lightRig(S) {
  const kind = S.light || 'desk', g = new THREE.Group(); g.userData.rig = true;
  const cfg = { desk: ['#fff0da', 2.1, '#fffaf2', '#c9bda6', 1.05, [-.5, .62, 1]], studio: ['#ffffff', 1.95, '#ffffff', '#cfcbc3', 1.02, [-.3, .55, 1]],
    spot: ['#ffd29a', 1.75, '#ffe4c0', '#2e2016', .38, [-.3, .45, 1]], flat: ['#ffffff', 1.3, '#ffffff', '#dcd8d0', 1.6, [-.25, .5, 1]],
    window: ['#eaf2ff', 2.05, '#f4f8ff', '#b8b2a6', 1.0, [.6, .38, 1]] }[kind] || [];
  const [kc, ki, sc, gc, hi, dir] = cfg;
  const hemi = new THREE.HemisphereLight(sc, gc, hi); hemi.position.set(0, 1, 1); g.add(hemi);
  const key = kind === 'spot' ? new THREE.SpotLight(kc, ki * 60, 0, .3, .95, 1.2) : new THREE.DirectionalLight(kc, ki);
  const d = new THREE.Vector3(...(S.lightDir || dir)).normalize();
  key.position.copy(d).multiplyScalar(30); key.target.position.set(0, 0, 0); g.add(key); g.add(key.target);
  key.castShadow = SETTINGS.light.shadows !== false && S.shadows !== false;
  key.shadow.mapSize.set(SETTINGS.light.mapSize, SETTINGS.light.mapSize);
  key.shadow.radius = 6 * (SETTINGS.light.softness ?? 1) * (S.shadowSoft ?? 1); key.shadow.blurSamples = 16; key.shadow.bias = -.0004;
  if (!key.isSpotLight) { const sc2 = key.shadow.camera; sc2.left = -FRAME.w * .9; sc2.right = FRAME.w * .9; sc2.top = FRAME.h * .8; sc2.bottom = -FRAME.h * .8; sc2.near = 1; sc2.far = 80; }
  else { key.shadow.camera.near = 5; key.shadow.camera.far = 90; key.penumbra = .9; }
  g.userData.key = key; g.userData.dir = d; return g;
}
function trackLight(S, v) {                                     // keep the shadow frustum centred on what the camera sees
  const rig = S._rig; if (!rig) return; const key = rig.userData.key, d = rig.userData.dir, span = 1 / Math.max(.35, v.zoom);
  key.target.position.set(v.x, v.y, 0); key.position.set(v.x, v.y, 0).addScaledVector(d, 30); key.target.updateMatrixWorld();
  if (!key.isSpotLight) { const c = key.shadow.camera; c.left = -FRAME.w * .9 * span; c.right = FRAME.w * .9 * span; c.top = FRAME.h * .8 * span; c.bottom = -FRAME.h * .8 * span; c.updateProjectionMatrix(); }
}

// ---------- post ----------
const rtScene = new THREE.WebGLRenderTarget(FW, FH, { samples: 4, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(FW, FH) });
rtScene.depthTexture.type = THREE.FloatType;
const mkHalf = (s) => new THREE.WebGLRenderTarget(Math.round(FW / s), Math.round(FH / s), { type: THREE.HalfFloatType });
const rtH1 = mkHalf(2), rtH2 = mkHalf(2), rtQ1 = mkHalf(4), rtQ2 = mkHalf(4);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qScene = new THREE.Scene(), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); qScene.add(quad);
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.); }`;
const blurMat = new THREE.ShaderMaterial({ uniforms: { src: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: VS,
  fragmentShader: `uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;
    void main(){ vec4 c = texture2D(src, vUv) * .2270; vec2 o1 = dir * 1.3846, o2 = dir * 3.2308;
      c += (texture2D(src, vUv + o1) + texture2D(src, vUv - o1)) * .3162; c += (texture2D(src, vUv + o2) + texture2D(src, vUv - o2)) * .0703; gl_FragColor = c; }` });
const copyMat = new THREE.ShaderMaterial({ uniforms: { src: { value: null } }, vertexShader: VS, fragmentShader: `uniform sampler2D src; varying vec2 vUv; void main(){ gl_FragColor = texture2D(src, vUv); }` });
function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, qCam); }
function blurChain() {
  copyMat.uniforms.src.value = rtScene.texture; pass(copyMat, rtH1);
  for (let i = 0; i < 2; i++) {
    blurMat.uniforms.src.value = rtH1.texture; blurMat.uniforms.dir.value.set(1.6 / rtH1.width, 0); pass(blurMat, rtH2);
    blurMat.uniforms.src.value = rtH2.texture; blurMat.uniforms.dir.value.set(0, 1.6 / rtH1.height); pass(blurMat, rtH1);
  }
  copyMat.uniforms.src.value = rtH1.texture; pass(copyMat, rtQ1);
  for (let i = 0; i < 3; i++) {
    blurMat.uniforms.src.value = rtQ1.texture; blurMat.uniforms.dir.value.set(2.2 / rtQ1.width, 0); pass(blurMat, rtQ2);
    blurMat.uniforms.src.value = rtQ2.texture; blurMat.uniforms.dir.value.set(0, 2.2 / rtQ1.height); pass(blurMat, rtQ1);
  }
}
const paperOverlay = canvasTex(paperCanvas('#808080', { seed: 11, grain: 1.2 }), { srgb: false, repeat: [1, 1] });
const P = SETTINGS.post;
const postMat = new THREE.ShaderMaterial({
  uniforms: { tSharp: { value: rtScene.texture }, tHalf: { value: rtH1.texture }, tQuarter: { value: rtQ1.texture }, tDepth: { value: rtScene.depthTexture }, tPaper: { value: paperOverlay },
    blur: { value: 0 }, dof: { value: 0 }, focus: { value: D0 }, vel: { value: new THREE.Vector2() }, time: { value: 0 }, res: { value: new THREE.Vector2(FW, FH) },
    grain: { value: P.grain }, halftone: { value: P.halftone }, paper: { value: P.paper }, vignette: { value: P.vignette }, aberr: { value: P.aberration }, lift: { value: P.lift }, warmth: { value: P.warmth },
    tint: { value: new THREE.Vector3(1, 1, 1) }, camOff: { value: new THREE.Vector2() }, useBlur: { value: 0 } },
  vertexShader: VS,
  fragmentShader: `uniform sampler2D tSharp, tHalf, tQuarter, tDepth, tPaper; uniform float blur, dof, focus, time, grain, halftone, paper, vignette, aberr, lift, warmth, useBlur;
    uniform vec2 vel, res, camOff; uniform vec3 tint; varying vec2 vUv;
    float lin(float z){ float n = .5, f = 400.; return n * f / (f - z * (f - n)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 toSRGB(vec3 c){ c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
    vec3 sharp(vec2 uv){ vec2 d = (uv - .5) * aberr * .012; vec3 c = texture2D(tSharp, uv).rgb; if (aberr > 0.) c = vec3(texture2D(tSharp, uv + d).r, c.g, texture2D(tSharp, uv - d).b); return c; }
    void main(){
      vec2 uv = vUv;
      vec3 c = sharp(uv);
      if (length(vel) > .0005) {                                     // motion blur along the camera's velocity (cut the curve)
        vec3 acc = vec3(0.); for (int i = 0; i < 16; i++) { float k = float(i) / 15. - .5; acc += texture2D(tSharp, uv + vel * k).rgb; } c = acc / 16.;
      }
      if (useBlur > .5) {
        float d = lin(texture2D(tDepth, uv).r);
        float coc = clamp(blur + dof * abs(d - focus) / focus * 3., 0., 1.);
        vec3 h = texture2D(tHalf, uv).rgb, q = texture2D(tQuarter, uv).rgb;
        c = mix(c, h, smoothstep(0., .45, coc)); c = mix(c, q, smoothstep(.4, 1., coc));
      }
      c *= tint * vec3(1. + warmth * .06, 1., 1. - warmth * .08);
      c = mix(c, .82 + (1. - exp(-(c - .82) * 5.5)) * .18, step(.82, c));   // soft shoulder: bright paper rolls off instead of clipping
      vec3 s = toSRGB(c);
      // grade in display space: lifted blacks (dark grey, never pure black) and softened whites: the editorial print range
      s = lift * vec3(1., .96, .9) + s * (1. - lift - .02);
      // paper texture over everything (overlay-like, luminance adjusted, not opacity: keeps colours clean)
      float pv = texture2D(tPaper, uv * res / 1024. * .75 + camOff).r - .5;
      s += pv * paper * .22 * (1. - abs(s - .5) * 1.2);
      // fine halftone screen: printed feel + a subtle moire as the camera moves under it
      vec2 g = mat2(.7071, -.7071, .7071, .7071) * (gl_FragCoord.xy / 5.2);
      float dotv = length(fract(g) - .5), lum = dot(s, vec3(.299, .587, .114));
      float ht = smoothstep(.0, .06, sqrt(1. - lum) * .62 - dotv);
      s = mix(s, s * (1. - ht * .55), halftone * .6);
      // grain + vignette
      float n = hash(gl_FragCoord.xy + fract(time * 7.13) * 91.) - .5; s += n * grain;
      vec2 q2 = uv - .5; float v = smoothstep(.35, .95, length(q2 * vec2(res.x / res.y, 1.) * (res.x < res.y ? 1.15 : .85)));
      s *= 1. - v * vignette;
      gl_FragColor = vec4(s, 1.);
    }` });

// ---------- HUD (2D overlay, HUD units W x H) ----------
export const hudCanvas = document.createElement('canvas'); hudCanvas.width = FW; hudCanvas.height = FH;
export const hud = hudCanvas.getContext('2d');
export let NOW = 0;
export function text(str, x, y, o = {}) {
  const { size = 16, col = C.ink, font = 'sans', weight = 600, align = 'center', alpha = 1, base = 'middle', italic = false } = o;
  if (alpha <= 0) return 0;
  hud.font = fontStr(font, weight, size, italic);
  if (SUITE.pick) { const tw = hud.measureText(String(str)).width, x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    SUITE.pick.push({ kind: 'text', text: String(str), x: x0, y: y - size * .6, w: tw, h: size * 1.2, font, size, col, alpha, src: caller() }); }
  hud.globalAlpha = alpha; hud.textAlign = align; hud.textBaseline = base; hud.fillStyle = col; hud.fillText(str, x, y);
  const w = hud.measureText(str).width; hud.globalAlpha = 1; return w;
}
export function rect(x, y, w, h, col, alpha = 1) { if (SUITE.pick && alpha > .05) SUITE.pick.push({ kind: 'box', x, y, w, h, col, alpha, src: caller() }); hud.globalAlpha = alpha; hud.fillStyle = col; hud.fillRect(x, y, w, h); hud.globalAlpha = 1; }
export function line(x0, y0, x1, y1, col, alpha = 1, lw = 1) { hud.globalAlpha = alpha; hud.strokeStyle = col; hud.lineWidth = lw; hud.beginPath(); hud.moveTo(x0, y0); hud.lineTo(x1, y1); hud.stroke(); hud.globalAlpha = 1; }
export function project(v, cam) { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H, p.z]; }

// ---------- real images (for later: AI assets and footage stills drop in as cards/cutouts) ----------
export const IMG = {};
export async function loadImages(map) {
  await Promise.all(Object.entries(map).map(([k, src]) => new Promise(res => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => { console.warn('image failed', src); res(); }; im.src = src;
  })));
}
// image(key, { w, cut, border, treat }) -> a printed image card (cut: sticker cut-out of an image with transparency)
export function image(key, o = {}) {
  const im = IMG[key]; if (!im) { console.warn('missing image', key); return card({ w: o.w ?? 3, h: o.h ?? 2, color: C.paper2 }); }
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, w = o.w ?? 3, h = o.h ?? w * ih / iw;
  const [cw, ch] = sizeFor(w, h, o.res ?? 160); let c = mkCanvas(cw, ch); c.getContext('2d').drawImage(im, 0, 0, cw, ch);
  if (o.treat) c = o.treat(c);
  if (o.cut) return cutout({ w, h, canvas: c, border: o.border ?? .1, kind: 'image' });
  return card({ w, h, torn: o.torn ?? 0, border: o.border ?? .08, kind: 'image', draw: (x, W2, H2) => x.drawImage(c, 0, 0, W2, H2) });
}

// ---------- shots ----------
// shot({ t0, build(S) -> st, update(st, t, S), draw(st, t, S), trans, transDur, name })
//   trans (how this shot comes in): 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' (cut the curve)
//     | 'whip-left' | 'whip-right' | 'blur' (rack focus) | 'push' (zoom through) | 'paper' (sheet wipe) | 'cut'
//   S: { scene, cam, t0, t1, add(obj, anim), board(kind, o), moves([...]), view, drift, light, lightDir, dof, focusZ, bg }
export const SHOTS = [];
export function shot(def) {
  const src = caller(); def._file = SUITE.module || src?.file || null; def._line = src?.line ?? null;
  SHOTS.push(def);
}
export function live(def) {
  if (!def._st) {
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(SETTINGS.camera.fov, FW / FH, .5, 400);
    const S = { scene, cam, t0: def.t0, t1: def.t1, anims: [], dyn: [], FRAME, C };
    S.add = (obj, o) => addTo(S, obj, o);
    S.board = (kind, o = {}) => { const b = board(kind, o); scene.add(b); return b; };
    S.moves = (list) => { S._moves = list; };
    def._S = S; def._st = def.build(S) || {};
    scene.background = new THREE.Color(S.bg ?? C.bg);
    scene.environment = studioEnv(); scene.environmentIntensity = S.envIntensity ?? 1;
    S._rig = lightRig(S); scene.add(S._rig);
    if (def._st.hits) EVENTS.push(['hits', def.t0, def._st.hits.map(h => +h.toFixed(3))]);
  }
  return def;
}
function dispose(def) {
  if (!def._st) return;
  def._S.scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) { (Array.isArray(m) ? m : [m]).forEach(mm => { if (mm.map && !mm.map.userData?.shared) mm.map.dispose(); mm.dispose(); }); } });
  def._st = null; def._S = null;
}
export function finalizeShots(end) {
  SHOTS.sort((a, b) => a.t0 - b.t0);
  SHOTS.forEach((s, i) => s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : end);
}
export function activeIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t0) i++; return i; }
const CYCLE = ['slide-left', 'slide-up', 'blur', 'slide-right', 'push', 'slide-down'];
export const transOf = (s, i = SHOTS.indexOf(s)) => s.trans ?? (i <= 0 ? 'cut' : CYCLE[(i - 1) % CYCLE.length]);
const durOf = s => s.transDur ?? (String(transOf(s)).startsWith('whip') ? .3 : SETTINGS.transitions.duration);

// transition modifiers for the shot being rendered: camera offset, extra zoom, blur, motion vector (uv/frame)
function transFx(type, side, p, D, v) {
  const fx = { x: 0, y: 0, z: 1, blur: 0, vel: [0, 0], paper: null };
  const [kind, dir] = String(type).split('-');
  const dv = { left: [1, 0], right: [-1, 0], up: [0, -1], down: [0, 1] }[dir] || [1, 0];   // camera direction (content moves the named way)
  if (kind === 'slide' || kind === 'whip') {
    const L = (kind === 'whip' ? 1.7 : 1.15) * FRAME.w / v.zoom, half = D / 2;
    const off = side === 'out' ? L * easeIn(p) : -L * (1 - easeOut(p));
    const spd = side === 'out' ? 3 * L * p * p / half : 3 * L * (1 - p) * (1 - p) / half;       // matched at the cut
    fx.x = dv[0] * off; fx.y = dv[1] * off;
    const perFrame = spd / 30 * .9 * v.zoom;                                                     // shutter ~ 0.9 of a frame
    fx.vel = [-dv[0] * perFrame / FRAME.w, -dv[1] * perFrame / FRAME.h];
    if (kind === 'whip') fx.blur = .25 * (side === 'out' ? p * p : (1 - p) * (1 - p));
  } else if (kind === 'blur') {
    fx.blur = side === 'out' ? easeIn(p) : 1 - easeOut(p); fx.z = side === 'out' ? 1 + .05 * easeIn(p) : 1.05 - .05 * easeOut(p);
  } else if (kind === 'push') {
    fx.z = side === 'out' ? 1 + 1.6 * easeIn(p) : .62 + .38 * easeOut(p); fx.blur = .55 * (side === 'out' ? p * p : (1 - p) * (1 - p));
  } else if (kind === 'paper') {
    fx.paper = side === 'out' ? easeIn(p) * .5 : .5 + easeOut(p) * .5;
  }
  return fx;
}

const _focusPt = new THREE.Vector3();
function renderShot(def, t, tr) {
  live(def);
  const S = def._S; NOW = t;
  for (const o of S.anims) animate(o, t);
  for (const o of S.dyn) o.userData.redraw(t);
  def.update?.(def._st, t, S);
  const v = viewAt(S, t);
  const fx = tr ? transFx(tr.type, tr.side, tr.p, tr.D, v) : { x: 0, y: 0, z: 1, blur: 0, vel: [0, 0], paper: null };
  poseCamera(S, v, fx);
  trackLight(S, { ...v, x: v.x + fx.x, y: v.y + fx.y });
  renderer.setRenderTarget(rtScene); renderer.setClearColor(S.scene.background, 1); renderer.clear(); renderer.render(S.scene, S.cam);
  const blur = clamp(fx.blur + (S.blur ?? 0)), dof = S.dof ?? 0;
  const U = postMat.uniforms;
  U.useBlur.value = blur > .001 || dof > .001 ? 1 : 0;
  if (U.useBlur.value) blurChain();
  U.blur.value = blur; U.dof.value = dof; U.focus.value = S.cam.position.distanceTo(_focusPt.set(v.x + fx.x, v.y + fx.y, S.focusZ ?? 0));
  U.vel.value.set(fx.vel[0], fx.vel[1]); U.time.value = t;
  U.camOff.value.set((v.x + fx.x) * .004, (v.y + fx.y) * .004);
  U.aberr.value = S.aberration ?? P.aberration;
  pass(postMat, null);
  return fx;
}

// ---------- frame ----------
const paperSheet = () => cached('sheetWipe', () => { const c = mkCanvas(FW, FH + 160), x = c.getContext('2d'); x.fillStyle = x.createPattern(paperCanvas(C.paper, { seed: 21 }), 'repeat');
  tornPath(x, FW, FH + 160, { amount: 5, seed: 9, edges: 'tb' }); x.fill(); return c; });
let lastFx = null;
export function drawFrame(t) {
  const i = activeIndex(t), cur = SHOTS[i];
  SHOTS.forEach((s, k) => { if (Math.abs(k - i) > 1) dispose(s); });
  const prev = i > 0 ? SHOTS[i - 1] : null, nxt = SHOTS[i + 1];
  let tr = null;
  if (nxt && transOf(nxt, i + 1) !== 'cut' && t > nxt.t0 - durOf(nxt) / 2) tr = { type: transOf(nxt, i + 1), side: 'out', D: durOf(nxt), p: (t - (nxt.t0 - durOf(nxt) / 2)) / (durOf(nxt) / 2) };
  else if (prev && transOf(cur, i) !== 'cut' && t < cur.t0 + durOf(cur) / 2) tr = { type: transOf(cur, i), side: 'in', D: durOf(cur), p: (t - cur.t0) / (durOf(cur) / 2) };
  lastFx = renderShot(cur, t, tr);
  hud.setTransform(1, 0, 0, 1, 0, 0); hud.clearRect(0, 0, FW, FH); hud.setTransform(K, 0, 0, K, 0, 0);
  if (cur.draw) { hud.save(); cur.draw(cur._st, t, cur._S); hud.restore(); }
}

// ---------- output ----------
export const outCanvas = document.createElement('canvas'); outCanvas.width = FW; outCanvas.height = FH;
const oc = outCanvas.getContext('2d');
export function compose(t) {
  drawFrame(t); oc.drawImage(glCanvas, 0, 0); oc.drawImage(hudCanvas, 0, 0);
  if (lastFx?.paper != null) {                                   // paper sheet wipe: rises from below, covers, keeps going
    const y = FH + 80 - lastFx.paper * (FH * 2 + 320);
    oc.save(); oc.shadowColor = 'rgba(0,0,0,.35)'; oc.shadowBlur = 40; oc.shadowOffsetY = -12; oc.drawImage(paperSheet(), 0, y); oc.restore();
  }
  return outCanvas;
}
export function PICKABLE(o) { const m = Array.isArray(o.material) ? o.material[0] : o.material; return o.isMesh && !o.userData.noPick && !!m?.userData?.vox; }

export async function checkFrames(times, name = 'check', scale = .5) {
  const c = document.createElement('canvas'); c.width = FW * scale; c.height = FH * scale; const x = c.getContext('2d');
  for (const t of times) { compose(t); x.drawImage(outCanvas, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r)); await fetch(`${SUITE.base}/frame/${name}/${Math.round(t * 100)}`, { method: 'POST', body: b }); }
  return times.length;
}

// WebCodecs H.264 export (hardware). Streams annex-b to /append/<name>.
export async function exportVideo({ name = 'video', fps = 30, from = 0, to, bitrate = 16e6, onProgress } = {}) {
  const chunks = []; let bytes = 0, first = true, err = null;
  const enc = new VideoEncoder({ output: c => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunks.push(b); bytes += b.length; }, error: e => err = e });
  let cfg = { codec: 'avc1.640032', width: FW, height: FH, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'annexb' } };
  for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) {
    const c = { ...cfg, hardwareAcceleration: hw };
    if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; break; }
  }
  enc.configure(cfg);
  const flush = async (force) => {
    if (!chunks.length || (!force && bytes < 8e6)) return;
    const blob = new Blob(chunks); chunks.length = 0; bytes = 0;
    await fetch(`${SUITE.base}/append/${name}${first ? '?reset=1' : ''}`, { method: 'POST', body: blob }); first = false;
  };
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

// Event pass for sound design: builds every shot once and collects shot boundaries (with transition), the tactile
// sound events every element scheduled (sfx), image entrances and accents.
export async function collectEvents(end, fps = 30) {
  SHOTS.forEach(dispose); EVENTS.length = 0;
  for (const s of SHOTS) { live(s); dispose(s); await new Promise(r => setTimeout(r, 0)); }
  const shots = SHOTS.map((s, i) => ({ t0: +s.t0.toFixed(3), trans: transOf(s, i), cut: transOf(s, i) === 'cut', chapter: false, name: s.name || '' }));
  const trSfx = { slide: 'whoosh', whip: 'whoosh', blur: 'snap', push: 'whoosh', paper: 'swish', cut: null };
  shots.slice(1).forEach(s => { const k = trSfx[String(s.trans).split('-')[0]]; if (k) EVENTS.push(['sfx', +(s.t0 - (k === 'whoosh' ? .22 : k === 'swish' ? .3 : .02)).toFixed(3), k, .5, 0, 0]); });
  const seen = new Set(), list = [];
  for (const e of EVENTS.filter(e => e[0] === 'sfx').sort((a, b) => a[1] - b[1])) { const key = e[2] + Math.round(e[1] * 20); if (seen.has(key)) continue; seen.add(key); list.push({ t: e[1], type: e[2], pan: e[3], gain: e[4], dur: e[5] }); }
  const hits = [...new Set(EVENTS.filter(e => e[0] === 'hits').flatMap(e => e[2]))].sort((a, b) => a - b);
  void fps;
  return { shots, hits, cards: [], sfx: list.filter(s => s.t >= 0 && s.t <= end + 1), style: 'vox' };
}

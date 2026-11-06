// Toon Studio engine - Vox collage (v1): newspaper cut-out, mixed-media collage explainers.
// The whole video is ONE broadsheet page. Each chapter is a panel on it; the camera whip-pans from panel to panel
// (real motion blur), and the finale pulls back to the full front page (masthead, every panel in its final state), then
// pushes back into the first panel so the last frame IS the first frame: the video loops, never a hard cut.
// On the panels: cut-out images (Higgsfield stills with real transparency, given a hand-cut white sticker border and a
// soft shadow here), torn paper, ransom-note letters, handwriting that writes itself, typewriter labels, rubber stamps,
// marker circles and arrows, counters, pins, tape, newspaper pages - all real objects in the scene (click-to-edit works),
// all text drawn by the engine (never inside the images). Same Suite contract as the other engines: shot(), cue(),
// compose(), exportVideo(), collectEvents(). Settings: globalThis.__CZ_SETTINGS (project.json "settings").
import * as THREE from 'three';
export { THREE };

export const ENGINE_KIND = 'collage';
export const ENGINE_VERSION = 8;              // bump when the Suite ships engine changes (projects get an Update button)
// the Suite's live preview on a slow computer (host.js sets __CZ_PREVIEW_SCALE, never for exports or stills): the frame
// is drawn at this scale and the page enlarges it. FW/FH/W/H do not change.
export const PREVIEW_SCALE = Math.min(1, Math.max(.25, +globalThis.__CZ_PREVIEW_SCALE || 1));
export const DEFAULTS = {
  format: 'landscape',                           // 'landscape' 1920x1080 | 'vertical' 1080x1920
  theme: 'press',                                // press | sepia | broadsheet (see THEMES)
  palette: null,                                 // optional colour overrides { red: '#..', ... }
  post: { grain: .035, paper: .4, halftone: .07, vignette: .16, warmth: .15, tone: 0 },   // tone: sepia print tone 0..1
  camera: { fov: 16, drift: .035 },              // drift: how much every shot creeps in across its length
  transitions: { duration: .62 },                // whip-pan length (the fast middle carries the motion blur)
  sheet: { cols: 4, gap: 1.1 },                  // panels per row on the front page, gap between panels (world units)
  shadow: { opacity: .32, softness: 1 },
  border: 1,                                     // sticker border width multiplier for cut-outs (0 = no sticker border)
  // v5: the newspaper chrome, switchable (a custom style sets these in its own engine's DEFAULTS):
  // torn: ragged edges on panels, photos, paper pieces, labels, stamp chips, cards, tape (false = clean straight edges)
  // texture: blotches, fibres, specks, newsprint columns on every paper (false = flat colour fills, no paper post texture)
  // masthead: the finale's front-page title + rules (false = the finale pulls back to the panels only); titleFont: its font
  look: { torn: true, texture: true, masthead: true, titleFont: 'blackletter', textFont: 'serif', labelFont: 'typewriter', enter: 'drop', between: 'whip' },
  // v5: mode 'front-page' (Vox: every chapter a paper panel on one broadsheet, whip-pans across it, the front-page finale)
  // | 'scenes' (the neutral base of custom styles: every chapter a full-frame scene, consecutive scenes side by side so the
  // camera slides from one to the next, no sheet, no masthead, no front-page finale; finale() is ignored)
  mode: 'front-page',
};
const merge = (a, b) => { const o = { ...a }; for (const k in b || {}) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; };
export const SETTINGS = merge(DEFAULTS, globalThis.__CZ_SETTINGS || {});
const VERT = SETTINGS.format === 'vertical';
export const SCENES = SETTINGS.mode === 'scenes';
const LOOK = SETTINGS.look || {};
export const FW = VERT ? 1080 : 1920, FH = VERT ? 1920 : 1080;   // output pixels
export const K = 2, W = FW / K, H = FH / K;
export const AW = FW, AH = FH;
// World units: a panel is exactly FRAME.w x FRAME.h (16 x 9, or 9 x 16 vertical) and fills the frame at zoom 1.
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
// paper: panel sheets · paper2: second paper · kraft: brown paper · sheet: the front page under the panels ·
// ink: type · red: stamps, dates, marker (the one loud colour) · blue: rare second accent · muted: captions ·
// light: sticker borders and label strips · tape: masking tape · bg: outside the page
export const THEMES = {
  press: { paper: '#ede5d2', paper2: '#e3d6bb', kraft: '#c49a68', parchment: '#e3cfa3', sheet: '#e7e2d6', ink: '#1b1815', red: '#ad2118', blue: '#1f55a3', muted: '#6c6456', light: '#fbf9f2', tape: '#e8dcbc', bg: '#d9d3c5', age: 1 },
  sepia: { paper: '#e0cca2', paper2: '#d3bb8a', kraft: '#b08350', parchment: '#d6b983', sheet: '#d9c69f', ink: '#3b2614', red: '#8c2815', blue: '#2d4f7a', muted: '#7d6a4f', light: '#f1e4c4', tape: '#dcc89a', bg: '#c2ae88', age: 1.35 },
  broadsheet: { paper: '#fbfaf7', paper2: '#f3f2ee', kraft: '#cfae82', parchment: '#efe3c6', sheet: '#f5f4f0', ink: '#0d0d0d', red: '#d11f17', blue: '#1b4fb0', muted: '#77736b', light: '#ffffff', tape: '#efe8d2', bg: '#e6e4de', age: .3 },
};
export const C = { white: '#ffffff', black: '#111111', ...(THEMES[SETTINGS.theme] || THEMES.press), ...(SETTINGS.palette || {}) };
// ---------- brand colour (v8) ----------
// settings.brand.color ('#rrggbb', the Suite's "Brand colour" look setting); unset = the theme's own red. Set, it becomes
// the one loud colour: C.red (stamps, dates, marker, tags, headlines) is the brand colour moved just enough to read on the
// paper; C.brand is the exact colour (fills behind ink: highlighter swipes, sticker backings) and C.brandInk the text on it.
const _rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const _lum = h => { const [r, g, b] = _rgb(h).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const _mix = (a, b, k) => '#' + _rgb(a).map((c, i) => Math.round((c + (_rgb(b)[i] - c) * k) * 255).toString(16).padStart(2, '0')).join('');
export const contrast = (a, b) => { const x = _lum(a), y = _lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
export const legibleOn = (c, bg, min = 3) => { const to = contrast('#ffffff', bg) > contrast('#000000', bg) ? '#ffffff' : '#000000';
  for (let k = 0; k <= 1.001; k += .05) { const o = k ? _mix(c, to, Math.min(1, k)) : c; if (contrast(o, bg) >= min) return o; } return to; };
export const textOn = c => contrast('#ffffff', c) >= contrast('#111111', c) ? '#ffffff' : '#111111';
const _brand = typeof SETTINGS.brand?.color === 'string' && /^#[0-9a-f]{6}$/i.test(SETTINGS.brand.color) ? SETTINGS.brand.color.toLowerCase() : null;
if (_brand && !SETTINGS.palette?.red) C.red = legibleOn(_brand, C.paper, 3);
C.brand = _brand ?? C.red; C.brandInk = textOn(C.brand);
export const BRAND = { on: !!_brand, color: C.brand, ink: C.brandInk, accent: C.red };

// ---------- fonts (the host loads FONT_FILES before any scene is imported) ----------
export const FONT_FILES = [
  ['UnifrakturMaguntia', 'fonts/blackletter-400.woff2', '400', 'normal'], ['Special Elite', 'fonts/typewriter-400.woff2', '400', 'normal'],
  ['Pinyon Script', 'fonts/script-400.woff2', '400', 'normal'], ['Courier Prime', 'fonts/courier-700.woff2', '700', 'normal'],
  ['Anton', 'fonts/anton-400.woff2', '400', 'normal'], ['Abril Fatface', 'fonts/abril-400.woff2', '400', 'normal'],
  ['Playfair Display', 'fonts/playfair-700.woff2', '700', 'normal'], ['Playfair Display', 'fonts/playfair-900.woff2', '900', 'normal'],
  ['Playfair Display', 'fonts/playfair-400i.woff2', '400', 'italic'], ['Oswald', 'fonts/oswald-700.woff2', '700', 'normal'],
  ['Archivo Black', 'fonts/archivoblack-400.woff2', '400', 'normal'], ['League Gothic', 'fonts/leaguegothic-400.woff2', '400', 'normal'],
  ['Space Mono', 'fonts/spacemono-400.woff2', '400', 'normal'], ['Space Mono', 'fonts/spacemono-700.woff2', '700', 'normal'],
  ['Inter', 'fonts/inter-600.woff2', '600', 'normal'],
];
// blackletter: mastheads, "Mainz, c.1440" · typewriter: labels and captions · script: handwriting · courier: bold typewriter
// anton: stamps, big condensed numbers · abril: fat display serif · serif: Playfair headlines · condensed: Oswald caps
// heavy: Archivo Black posters · gothic: tall condensed · mono: data · sans: small print
export const FONTS = { blackletter: "'UnifrakturMaguntia'", typewriter: "'Special Elite'", script: "'Pinyon Script'", courier: "'Courier Prime'",
  anton: "'Anton'", abril: "'Abril Fatface'", serif: "'Playfair Display'", condensed: "'Oswald'", heavy: "'Archivo Black'", gothic: "'League Gothic'",
  mono: "'Space Mono'", sans: "'Inter'" };
const WEIGHT = { courier: 700, serif: 900, condensed: 700, sans: 600 };
const fontStr = (font, px, italic, weight) => `${italic ? 'italic ' : ''}${weight ?? WEIGHT[font] ?? 400} ${Math.round(px)}px ${FONTS[font] || font}`;

// ---------- math / timing ----------
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ease = x => (x = clamp(x), x * x * (3 - 2 * x));
export const easeIn = x => Math.pow(clamp(x), 3);
export const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOut = x => (x = clamp(x), x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeInOut4 = x => (x = clamp(x), x < .5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2);   // whip: slow-FAST-slow
export const easeOutBack = (x, s = 1.5) => { x = clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export function settle(x, k = .12) { x = clamp(x); return 1 - Math.exp(-6 * x) * Math.cos(9 * x) * (1 - x) * (1 + k); }
export function rng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }
export const hashf = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hashStr = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 100000; };
const LOCALE = (() => { try { return new Intl.NumberFormat(globalThis.__CZ_LANG || 'en-US').resolvedOptions().locale; } catch { return 'en-US'; } })();   // the narration's language (the host sets it)
export function fmt(n, dec = 0) { return n.toLocaleString(LOCALE, { minimumFractionDigits: dec, maximumFractionDigits: dec }); }

// ---------- words / cues ----------
export let PHRASES = [], WORDS = [];
// any alphabet, without case or accents: cue('transcripcion') finds "Transcripción," in a Spanish narration (v4)
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
  // a cue in a language written without spaces (Japanese, Chinese, Thai) may span several timed words ("東京タワー" is timed
  // as "東京" + "タワー"): the words' letters are joined until they hold it (v7)
  if (best === null && parts.length === 1 && parts[0]) for (let i = 0; i < WORDS.length; i++) {
    let s = '', k = i; while (k < WORDS.length && s.length < parts[0].length) s += WORDS[k++].n;
    if (!s.startsWith(parts[0])) continue;
    const d = Math.abs(WORDS[i].s - near); if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[k - 1].e; }
  }
  if (best === null || bd > 12) { console.warn('cue miss', word, near); return near; }
  return best;
}

// ---------- renderer ----------
export const glCanvas = document.createElement('canvas');
export const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: false });
const DW = Math.round(FW * PREVIEW_SCALE), DH = Math.round(FH * PREVIEW_SCALE);   // drawn size (FW x FH except a smaller preview)
renderer.setPixelRatio(1); renderer.setSize(DW, DH, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const MAXANISO = renderer.capabilities.getMaxAnisotropy();

// ---------- canvas helpers ----------
export function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
export function canvasTex(c, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = MAXANISO; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const CACHE = new Map();
export const cached = (key, make) => { if (!CACHE.has(key)) CACHE.set(key, make()); return CACHE.get(key); };
const hexRgb = h => { const s = h.replace('#', ''); const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export function mixHex(a, b, k) { const A = hexRgb(a), B = hexRgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * clamp(k))).join(',')})`; }

// procedural papers: base colour, soft blotches, fibres, specks (and stains/edges for parchment, columns for newsprint)
export function paperCanvas(kind = 'paper', { w = 1024, h = 576, seed = 3, color } = {}) {
  const base = color || { paper: C.paper, paper2: C.paper2, kraft: C.kraft, parchment: C.parchment, newsprint: C.paper2, white: C.light, sheet: C.sheet }[kind] || kind;
  const c = mkCanvas(w, h), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  if (SETTINGS.look?.texture === false) return c;                   // a style without paper: a plain colour
  for (let i = 0; i < 26; i++) {                                    // soft uneven tone
    const px = r() * w, py = r() * h, rr = (.1 + r() * .35) * Math.max(w, h), g = x.createRadialGradient(px, py, 0, px, py, rr);
    const dark = r() < .6, ag = C.age ?? 1; g.addColorStop(0, dark ? `rgba(120,85,40,${(.10 * ag).toFixed(3)})` : 'rgba(255,250,235,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  if (kind === 'parchment' || kind === 'kraft') {                  // darker edges + a few stains
    const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(70,40,10,.28)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) { x.strokeStyle = 'rgba(110,70,30,.10)'; x.lineWidth = 2 + r() * 4; x.beginPath(); x.arc(r() * w, r() * h, 20 + r() * 70, 0, Math.PI * 2); x.stroke(); }
  }
  x.globalAlpha = .5 * Math.min(1, C.age ?? 1);                     // fibres
  for (let i = 0; i < w * h / 900; i++) { const px = r() * w, py = r() * h, a = r() * Math.PI, l = 3 + r() * 12; x.strokeStyle = r() < .5 ? 'rgba(80,60,30,.14)' : 'rgba(255,255,255,.22)'; x.lineWidth = .6; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  x.globalAlpha = 1;
  for (let i = 0; i < w * h / 1500 * Math.min(1, C.age ?? 1); i++) { x.fillStyle = `rgba(40,30,20,${.05 + r() * .12})`; x.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5); }
  if (kind === 'newsprint') { x.fillStyle = 'rgba(30,30,30,.10)'; for (let col = 0; col < 6; col++) for (let y = 30; y < h - 20; y += 9) if (r() > .08) x.fillRect(20 + col * (w - 40) / 6, y, (w - 40) / 6 - 18 - r() * 30 * (r() < .1), 3); }
  return c;
}
// ragged torn outline (a closed path) around a w x h rectangle; amount = tear depth in px
export function tornPath(x, w, h, { amount = 6, seed = 1, edges = 'tblr', inset = 0 } = {}) {
  if (SETTINGS.look?.torn === false) amount = 0;                    // a style without paper: clean straight edges
  const r = rng(seed), pts = [], step = 7;
  const j = on => on ? (r() - .5) * amount + (r() < .08 ? (r() - .5) * amount * 2.5 : 0) : 0;
  const i0 = inset + amount / 2;
  for (let px = i0; px <= w - i0; px += step) pts.push([px, i0 + j(edges.includes('t'))]);
  for (let py = i0; py <= h - i0; py += step) pts.push([w - i0 + j(edges.includes('r')), py]);
  for (let px = w - i0; px >= i0; px -= step) pts.push([px, h - i0 + j(edges.includes('b'))]);
  for (let py = h - i0; py >= i0; py -= step) pts.push([i0 + j(edges.includes('l')), py]);
  x.beginPath(); pts.forEach(([a, b], k) => k ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath();
}
// hand-cut sticker: the image's silhouette grown by `border` px (unevenly, like scissors), filled white, image on top
function stickerCanvas(img, { border = 10, color = C.light, seed = 1, maxSide = 1024 } = {}) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(1, maxSide / Math.max(iw, ih));
  const w = Math.round(iw * k), h = Math.round(ih * k), pad = Math.ceil(border * 1.6) + 2;
  const c = mkCanvas(w + pad * 2, h + pad * 2), x = c.getContext('2d');
  if (border > 0) {
    const sil = mkCanvas(c.width, c.height), sx = sil.getContext('2d');
    const r = rng(seed), n = 28;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = border * (.8 + r() * .45); sx.drawImage(img, pad + Math.cos(a) * rr, pad + Math.sin(a) * rr, w, h); }
    sx.drawImage(img, pad, pad, w, h);
    sx.globalCompositeOperation = 'source-in'; sx.fillStyle = color; sx.fillRect(0, 0, c.width, c.height);
    x.drawImage(sil, 0, 0);
  }
  x.drawImage(img, pad, pad, w, h);
  return { canvas: c, pad, w, h };
}
// soft drop shadow from any canvas with alpha (black silhouette, blurred)
function shadowCanvas(src, blur = 14) {
  const pad = blur * 2, c = mkCanvas(src.width + pad * 2, src.height + pad * 2), x = c.getContext('2d');
  x.filter = `blur(${blur}px)`; x.drawImage(src, pad, pad);
  x.filter = 'none'; x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  return { canvas: c, pad };
}

// ---------- world + layers ----------
export const SHEET = new THREE.Scene();
SHEET.background = new THREE.Color(C.bg);
const PPU = 150;                                                    // text/texture pixels per world unit (crisp at 1.3x zoom-in)
let ORDER = 0;
const nextOrder = (layer = 0) => layer * 100000 + (++ORDER);
const faceMat = (tex, { opacity = 1 } = {}) => new THREE.ShaderMaterial({
  uniforms: { map: { value: tex }, opacity: { value: opacity }, reveal: { value: 2 }, feather: { value: .04 }, revealY: { value: 0 }, ink: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform sampler2D map; uniform float opacity, reveal, feather, revealY, ink; varying vec2 vUv;
    float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(map, vUv);
      float u = revealY > .5 ? 1. - vUv.y : vUv.x;
      float m = 1. - smoothstep(reveal - feather, reveal, u);
      if (ink < 1.) { float n = h2(floor(vUv * vec2(70., 28.))) * .55 + h2(floor(vUv * vec2(360., 150.))) * .45; m *= smoothstep(n - .14, n, ink * 1.16 - .02); }
      gl_FragColor = vec4(c.rgb, c.a * opacity * m); if (gl_FragColor.a < .003) discard; }`,
  transparent: true, depthWrite: false, depthTest: false,
});
function plane(tex, w, h, order, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), faceMat(tex, o)); m.renderOrder = order; m.material.userData.collage = true; return m;
}

// ---------- panels ----------
export const PANELS = [];
// panel(slot, { bg, title, tilt, torn, color }) -> P. slot: its place on the front page (0 = top-left, left to right,
// then the next row). bg: 'paper' | 'paper2' | 'kraft' | 'parchment' | 'newsprint' | 'white' | an IMG key (full-bleed image).
export function panel(slot, o = {}) {
  const P = { slot, o, group: new THREE.Group(), elems: [], src: caller(), title: o.title || '' };
  P.group.name = `panel ${slot + 1}${o.title ? ` "${o.title}"` : ''}`; P.group.userData.kind = 'panel';
  const seed = 17 + slot * 31, bw = FRAME.w, bh = FRAME.h;
  const c = typeof o.bg === 'string' && IMG[o.bg] ? (() => { const cc = mkCanvas(1280, 1280 * bh / bw), xx = cc.getContext('2d'); coverDraw(xx, IMG[o.bg], cc.width, cc.height); return cc; })()
    : paperCanvas(o.bg || 'paper', { w: 1280, h: Math.round(1280 * bh / bw), seed, color: o.color });
  const torn = mkCanvas(c.width + 24, c.height + 24), tx = torn.getContext('2d');
  if ((o.torn ?? SETTINGS.look?.torn) !== false) { tornPath(tx, torn.width, torn.height, { amount: 7, seed, inset: 3 }); tx.save(); tx.clip(); tx.drawImage(c, 12, 12); tx.restore();
    tx.strokeStyle = 'rgba(255,255,255,.55)'; tx.lineWidth = 2; tornPath(tx, torn.width, torn.height, { amount: 7, seed, inset: 3 }); tx.stroke(); }
  else tx.drawImage(c, 12, 12);
  const sw = bw * torn.width / c.width, sh = bh * torn.height / c.height;
  const sh2 = shadowCanvas(torn, 18);
  const shadow = plane(canvasTex(sh2.canvas), sw * sh2.canvas.width / torn.width, sh * sh2.canvas.height / torn.height, nextOrder(-2), { opacity: SETTINGS.shadow.opacity * .8 });
  shadow.position.set(.08, -.12, 0); shadow.userData.noPick = true;
  const face = plane(canvasTex(torn), sw, sh, nextOrder(-1)); face.userData.noPick = true;
  if (SCENES) { P.group.add(face); P.group.rotation.z = (o.tilt ?? 0) * Math.PI / 180; }   // a full-frame scene: no sheet shadow, level
  else { P.group.add(shadow, face); P.group.rotation.z = (o.tilt ?? (hashf(seed) - .5) * .012); }
  SHEET.add(P.group); PANELS.push(P);
  // (no section card on the panel: announcing sections is off-style. `title` names the panel for the editor only.)
  // shortcuts: P.cutout(key, o) === cutout(P, key, o) ...
  for (const [k, f] of Object.entries({ cutout, photo, paperPiece, ransom, headline, script, label, stamp, counter, mark, tape, dots, scatter, newspaper, drawn })) P[k] = (...a) => f(P, ...a);
  return P;
}
function coverDraw(x, img, w, h) { const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.max(w / iw, h / ih); x.drawImage(img, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k); }
function layoutPanels() {
  if (SCENES) {                                                       // scenes in the order they are first shown, side by side
    const first = P => { const s = SHOTS.find(s => s.panel === P); return s ? s.t0 : 1e9 + P.slot; };
    const order = [...PANELS].sort((a, b) => first(a) - first(b));
    order.forEach((P, i) => { P.x = VERT ? 0 : i * FRAME.w; P.y = VERT ? -i * FRAME.h : 0; P.group.position.set(P.x, P.y, 0); });
    const n = Math.max(1, order.length);
    return { cols: VERT ? 1 : n, rows: VERT ? n : 1, w: VERT ? FRAME.w : n * FRAME.w, h: VERT ? n * FRAME.h : FRAME.h, cx: VERT ? 0 : (n - 1) * FRAME.w / 2, cy: VERT ? -(n - 1) * FRAME.h / 2 : 0 };
  }
  const cols = Math.max(1, Math.min(SETTINGS.sheet.cols, PANELS.length || 1)), gap = SETTINGS.sheet.gap;
  for (const P of PANELS) { const col = P.slot % cols, row = Math.floor(P.slot / cols); P.x = (col - (cols - 1) / 2) * (FRAME.w + gap); P.y = -row * (FRAME.h + gap); P.group.position.set(P.x, P.y, 0); }
  const rows = Math.max(1, ...PANELS.map(P => Math.floor(P.slot / cols) + 1));
  return { cols, rows, w: cols * FRAME.w + (cols - 1) * gap, h: rows * FRAME.h + (rows - 1) * gap, cx: 0, cy: -(rows - 1) * (FRAME.h + gap) / 2 };
}

// ---------- elements ----------
// Every element: a group placed on a panel at (x, y) (panel units, origin = panel centre, y up), with a face and an
// optional shadow. Timing: at (s) + in (entrance) + dur; optional out/outAt. Before `at` it is not there; after it
// stays in its final state (so the front-page finale shows every panel finished).
export const ELEMS = [];
export const EVENTS = [];
// sfx(type, t, { pan, gain, dur }): paper | slide | lift | pop | flip | pin | tape | marker | type | tick | stamp | whoosh | swish | snap | click | thud
export function sfx(type, t, o = {}) { if (t == null || !isFinite(t)) return; EVENTS.push(['sfx', +(+t).toFixed(3), type, +(o.pan ?? .5).toFixed(2), o.gain ?? 0, +(o.dur ?? 0).toFixed(3)]); }
const IN_SFX = { drop: 'paper', slide: 'slide', pop: 'pop', ink: 'stamp', print: null, peel: 'flip', fade: null, wipe: 'slide', none: null, rise: null, grow: 'pop' };
// 'slam' (slapped on) is not part of this style: stamps ink in, everything else prints in
const inAlias = (kind, v) => v === 'slam' ? (kind === 'stamp' ? 'ink' : 'print') : v;
function element(P, kind, label, o, build) {
  const src = caller(), g = new THREE.Group();
  const e = { P, kind, label, g, o, src, at: o.at ?? 0, dur: o.dur ?? .5, in: inAlias(kind, o.in ?? LOOK.enter ?? 'drop'), out: o.out ?? null, outAt: o.outAt ?? null, outDur: o.outDur ?? .45,
    x: o.x ?? 0, y: o.y ?? 0, rot: (o.rot ?? 0) * Math.PI / 180, s: o.scale ?? 1, z: o.z ?? .02, seed: hashStr(label + (o.x ?? 0) + (o.y ?? 0) + kind), shadow: null, faces: [], redraw: null, spin: o.spin ?? 0 };
  g.name = `${kind}${label ? ` "${String(label).slice(0, 40)}"` : ''}${src ? ` (${src.file}:${src.line})` : ''}`; g.userData.kind = kind;
  build(e);
  // the editor's hover/select resolves to the outermost object sharing this key: the element, not its panel
  e.key = `${kind}:${String(label).slice(0, 32)}${src ? `@${src.file}:${src.line}` : ''}`;
  g.traverse(ob => { ob.userData._st = e.key; ob.userData._stDepth = 0; });
  (P ? P.group : SHEET).add(g); (P ? P.elems : []).push(e); ELEMS.push(e);
  const k = String(e.in).split('-')[0];
  if (o.sfx !== false && e.at > 0 && (o.sfx || IN_SFX[k])) sfx(o.sfx || IN_SFX[k], e.at + (k === 'ink' ? .06 : k === 'drop' ? e.dur * .55 : 0), { pan: clamp(.5 + e.x / FRAME.w) });
  if (e.out && e.outAt != null && o.sfx !== false) sfx('lift', e.outAt, { pan: clamp(.5 + e.x / FRAME.w) });
  return e;
}
function addFace(e, tex, w, h, { shadow = true, blur = 12, srcCanvas, opacity = 1, layer = e.o.layer ?? 0, offset = [0, 0] } = {}) {
  if (shadow && srcCanvas && SETTINGS.shadow.opacity > 0) {
    const sc = shadowCanvas(srcCanvas, blur * SETTINGS.shadow.softness);
    const s = plane(canvasTex(sc.canvas), w * sc.canvas.width / srcCanvas.width, h * sc.canvas.height / srcCanvas.height, nextOrder(layer), { opacity: SETTINGS.shadow.opacity });
    s.userData.noPick = true; s.userData.shadow = true; s.userData.off = offset; s.position.set(offset[0], offset[1], 0); e.g.add(s); e.shadow = s;
  }
  const f = plane(tex, w, h, nextOrder(layer), { opacity }); f.position.set(offset[0], offset[1], .001); f.userData.pick = true; e.g.add(f); e.faces.push(f);
  return f;
}
const unitsFor = (canvas, h) => [h * canvas.width / canvas.height, h];

// cutout(P, key, { x, y, h | w, rot, border, at, in, dur, out, outAt, spin, flip }): an image with transparency, hand-cut
// with a white sticker border and a soft shadow. in: 'drop' (placed on the paper) | 'slide-left|right|up|down' | 'pop' | 'peel' | 'fade'
export function cutout(P, key, o = {}) {
  return element(P, 'cutout', key, o, e => {
    const img = IMG[key];
    if (!img) { console.warn(`missing image "${key}" (make it with make_image first)`); const c = mkCanvas(200, 200), x = c.getContext('2d'); x.fillStyle = C.paper2; x.fillRect(0, 0, 200, 200); x.strokeStyle = C.red; x.lineWidth = 6; x.strokeRect(3, 3, 194, 194); x.fillStyle = C.red; x.font = '600 22px Inter'; x.textAlign = 'center'; x.fillText(key, 100, 106); addFace(e, canvasTex(c), o.h ?? 3, o.h ?? 3, { srcCanvas: c }); return; }
    const st = stickerCanvas(img, { border: (o.border ?? 10) * SETTINGS.border, seed: e.seed });
    const c = o.flip ? (() => { const f = mkCanvas(st.canvas.width, st.canvas.height), fx = f.getContext('2d'); fx.translate(f.width, 0); fx.scale(-1, 1); fx.drawImage(st.canvas, 0, 0); return f; })() : st.canvas;
    const h = o.h ?? (o.w ? o.w * c.height / c.width : 3), w = h * c.width / c.height;
    addFace(e, canvasTex(c), w, h, { srcCanvas: c, blur: 10 });
    e.size = [w, h]; e.canvas = c;
  });
}
// photo(P, key, { x, y, w | h, torn, border }): a rectangular image printed on paper (maps, pages, textures) with torn edges
export function photo(P, key, o = {}) {
  return element(P, 'photo', key, o, e => {
    const img = IMG[key]; const iw = img ? img.naturalWidth : 400, ih = img ? img.naturalHeight : 300;
    const w = o.w ?? (o.h ? o.h * iw / ih : 5), h = o.h ?? w * ih / iw, pxw = Math.min(1600, Math.round(w * PPU * .8)), pxh = Math.round(pxw * h / w);
    const bpx = Math.round((o.border ?? 0) * PPU * .8), c = mkCanvas(pxw + bpx * 2 + 16, pxh + bpx * 2 + 16), x = c.getContext('2d');
    tornPath(x, c.width, c.height, { amount: o.torn === false ? 0 : 8, seed: e.seed, inset: 2 }); x.save(); x.clip();
    x.fillStyle = C.light; x.fillRect(0, 0, c.width, c.height);
    if (img) { x.save(); x.beginPath(); x.rect(bpx + 8, bpx + 8, pxw, pxh); x.clip(); coverDraw2(x, img, bpx + 8, bpx + 8, pxw, pxh); x.restore(); } else { x.fillStyle = C.paper2; x.fillRect(bpx + 8, bpx + 8, pxw, pxh); }
    x.restore();
    addFace(e, canvasTex(c), w * c.width / pxw, h * c.height / pxh, { srcCanvas: c, blur: 12 });
    e.size = [w, h];
  });
}
function coverDraw2(x, img, px, py, w, h) { const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.max(w / iw, h / ih); x.drawImage(img, px + (w - iw * k) / 2, py + (h - ih * k) / 2, iw * k, ih * k); }
// paperPiece(P, { x, y, w, h, color: 'paper'|'kraft'|'newsprint'|'white'|'#hex', torn }): a torn sheet to compose on
export function paperPiece(P, o = {}) {
  return element(P, 'paper', o.color || 'paper', { in: 'drop', ...o }, e => {
    const w = o.w ?? 5, h = o.h ?? 3, pxw = Math.round(Math.min(1400, w * 90)), pxh = Math.round(pxw * h / w);
    const base = paperCanvas(o.color || 'paper', { w: pxw, h: pxh, seed: e.seed }), c = mkCanvas(pxw + 20, pxh + 20), x = c.getContext('2d');
    tornPath(x, c.width, c.height, { amount: o.torn === false ? 0 : 9, seed: e.seed, inset: 2 }); x.save(); x.clip(); x.drawImage(base, 10, 10); x.restore();
    addFace(e, canvasTex(c), w * c.width / pxw, h * c.height / pxh, { srcCanvas: c });
    e.size = [w, h];
  });
}

// ---------- typography (all drawn here, never inside the images) ----------
function textCanvas(str, { font = 'serif', size = 1, color = C.ink, italic = false, weight, pad = .12, bg = null, spacing = 0 } = {}) {
  const px = Math.min(420, size * PPU), m = mkCanvas(8, 8).getContext('2d'); m.font = fontStr(font, px, italic, weight);
  if (spacing) m.letterSpacing = `${spacing * px}px`;
  const tw = Math.ceil(m.measureText(str).width), p = Math.ceil(pad * px), c = mkCanvas(tw + p * 2, px * 1.35 + p * 2), x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); }
  x.font = m.font; if (spacing) x.letterSpacing = `${spacing * px}px`; x.fillStyle = color; x.textBaseline = 'middle'; x.fillText(str, p, c.height / 2 + px * .04);
  return { canvas: c, px, tw };
}
// ransom(P, 'EVERY BOOK', { x, y, size, at, per, anchor }): ransom-note letters cut from different papers, each one
// dropped in on its own (per = seconds between letters). Spaces separate words.
export function ransom(P, str, o = {}) {
  const size = o.size ?? 1.1, r = rng(hashStr(str) + 7), per = o.per ?? .07, at = o.at ?? 0;
  const styles = [['abril', C.ink, C.light], ['anton', C.light, C.ink], ['serif', C.ink, C.paper2], ['blackletter', C.ink, C.light], ['heavy', C.red, C.light],
    ['courier', C.ink, C.tape], ['anton', C.ink, C.kraft], ['abril', C.light, C.red], ['serif', C.ink, C.light], ['heavy', C.ink, '#d9c9a3']];
  const chips = [...str].map((ch, i) => {
    if (ch === ' ') return null;
    const [font, fg, bgc] = styles[Math.floor(r() * styles.length)];
    const s = size * (.82 + r() * .36), t = textCanvas(ch, { font, size: s, color: fg, pad: .14 });
    const c = mkCanvas(t.canvas.width + 12, t.canvas.height + 6), x = c.getContext('2d');
    tornPath(x, c.width, c.height, { amount: 4, seed: i + 3, inset: 1 }); x.fillStyle = bgc; x.fill(); x.drawImage(t.canvas, 6, 3);
    return { c, w: size * .9 * c.width / c.height * (s / size) * 1.02, h: s * 1.02, rot: (r() - .5) * .22, dy: (r() - .5) * size * .14 };
  });
  const total = chips.reduce((a, ch) => a + (ch ? ch.w * .92 : size * .45), 0);
  let cx = (o.anchor === 'left' ? 0 : o.anchor === 'right' ? -total : -total / 2) + (o.x ?? 0);
  const out = [];
  chips.forEach((ch, i) => {
    if (!ch) { cx += size * .45; return; }
    const x = cx + ch.w * .46; cx += ch.w * .92;
    out.push(element(P, 'letter', str[i], { ...o, x, y: (o.y ?? 0) + ch.dy, rot: ch.rot * 180 / Math.PI, at: at + i * per, dur: .28, in: o.in ?? 'drop', sfx: i % 2 ? false : 'paper', layer: o.layer ?? 1 }, e => {
      addFace(e, canvasTex(ch.c), ch.w, ch.h, { srcCanvas: ch.c, blur: 5 });
    }));
  });
  return out;
}
// headline(P, text, { x, y, size, font, color, anim: 'type'|'slam'|'rise'|'fade'|'wipe'|'drop', at, dur, anchor, italic, bg })
export function headline(P, str, o = {}) {
  const anim = o.anim === 'slam' ? 'print' : (o.anim ?? 'rise');
  return element(P, 'headline', str, { ...o, in: anim === 'type' ? 'none' : anim, dur: o.dur ?? (anim === 'type' ? str.length * .045 : .5), layer: o.layer ?? 1, sfx: anim === 'type' ? false : o.sfx }, e => {
    const t = textCanvas(str, { font: o.font ?? LOOK.textFont ?? 'serif', size: o.size ?? 1, color: o.color ?? C.ink, italic: o.italic, bg: o.bg, spacing: o.spacing });
    const [w, h] = unitsFor(t.canvas, (o.size ?? 1) * t.canvas.height / t.px);
    const off = [o.anchor === 'left' ? w / 2 : o.anchor === 'right' ? -w / 2 : 0, 0];
    if (anim === 'type') {                                                  // typed letter by letter (redrawn)
      const c = mkCanvas(t.canvas.width, t.canvas.height), tex = canvasTex(c); addFace(e, tex, w, h, { shadow: false, offset: off });
      let shown = -1;
      e.redraw = time => { const n = Math.round(clamp((time - e.at) / e.dur) * str.length); if (n === shown) return; shown = n;
        const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); const sub = textCanvas(str.slice(0, n), { font: o.font ?? LOOK.textFont ?? 'serif', size: o.size ?? 1, color: o.color ?? C.ink, italic: o.italic, bg: null, spacing: o.spacing }); if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, c.width, c.height); } x.drawImage(sub.canvas, 0, 0); tex.needsUpdate = true; };
      sfx('type', e.at, { dur: e.dur });
    } else addFace(e, canvasTex(t.canvas), w, h, { shadow: !!o.bg, srcCanvas: t.canvas, blur: 6, offset: off });
    e.size = [w, h]; e.textColor = o.color ?? C.ink; e.ownBg = !!o.bg;
    e.text = { str, font: o.font ?? LOOK.textFont ?? 'serif', px: t.px, pad: Math.ceil(.12 * t.px), W: t.canvas.width, offX: off[0], italic: o.italic, spacing: o.spacing };
  });
}
// script(P, 'copied by hand', { x, y, size, color, at, dur, pen }): handwriting that writes itself left to right.
// pen: an IMG key (a quill or pen cut-out) that rides the writing edge.
export function script(P, str, o = {}) {
  const e = element(P, 'script', str, { ...o, in: 'none', dur: o.dur ?? Math.max(.6, str.length * .07), layer: o.layer ?? 1, sfx: false }, e => {
    const t = textCanvas(str, { font: o.font ?? 'script', size: o.size ?? 1, color: o.color ?? C.ink, pad: .3 });
    const [w, h] = unitsFor(t.canvas, (o.size ?? 1) * t.canvas.height / t.px);
    const off = [o.anchor === 'left' ? w / 2 : o.anchor === 'right' ? -w / 2 : 0, 0];
    const f = addFace(e, canvasTex(t.canvas), w, h, { shadow: false, offset: off }); f.material.uniforms.feather.value = .012;
    e.revealFace = f; e.size = [w, h]; e.textColor = o.color ?? C.ink;
    e.text = { str, font: o.font ?? 'script', px: t.px, pad: Math.ceil(.3 * t.px), W: t.canvas.width, offX: off[0] };
    // where the ink is: first/last inked column and, per column, the vertical centre of the ink (the pen rides it)
    const W = t.canvas.width, H = t.canvas.height, a = t.canvas.getContext('2d').getImageData(0, 0, W, H).data, cy = new Float32Array(W);
    let c0 = -1, c1 = -1;
    for (let cx = 0; cx < W; cx++) { let sum = 0, n = 0; for (let y = 0; y < H; y++) { const al = a[(y * W + cx) * 4 + 3]; if (al > 90) { sum += y * al; n += al; } }
      cy[cx] = n ? sum / n : -1; if (n) { if (c0 < 0) c0 = cx; c1 = cx; } }
    const rad = Math.max(2, Math.round(t.px * .06)), sm = new Float32Array(W);   // smooth, filling gaps between letters
    for (let cx = 0; cx < W; cx++) { let s2 = 0, n = 0; for (let k = -rad; k <= rad; k++) { const v = cy[cx + k]; if (v >= 0) { s2 += v; n++; } } sm[cx] = n ? s2 / n : (cx ? sm[cx - 1] : H / 2); }
    e.ink = { c0: Math.max(0, c0), c1: Math.max(c0, c1), W, H, cy: sm, x0: off[0] - w / 2 };
    e.revealAt = time => { const k = clamp((time - e.at) / e.dur), kk = k * k * (3 - 2 * k) * .35 + k * .65; return (e.ink.c0 + (e.ink.c1 - e.ink.c0) * kk) / W; };   // near-even writing speed
  });
  sfx('marker', e.at, { dur: e.dur, gain: -6 });
  if (o.pen) {
    const pen = cutout(P, o.pen, { h: o.penH ?? (o.size ?? 1) * 2, border: 6, at: e.at - .3, in: 'fade', dur: .25, out: 'lift', outAt: e.at + e.dur + .08, outDur: .35, layer: 6, sfx: false });
    // the nib: the opaque pixel furthest down-left in the pen image (a quill held for writing points that way)
    const pc = pen.canvas, pd = pc.getContext('2d').getImageData(0, 0, pc.width, pc.height).data; let best = -1e9, tx = 0, ty = pc.height;
    for (let y = 0; y < pc.height; y += 2) for (let x = 0; x < pc.width; x += 2) if (pd[(y * pc.width + x) * 4 + 3] > 200) { const sc = y - x; if (sc > best) { best = sc; tx = x; ty = y; } }
    const tipLocal = o.penTip ? [(o.penTip[0] - .5) * pen.size[0], (.5 - o.penTip[1]) * pen.size[1]] : [(tx / pc.width - .5) * pen.size[0], (.5 - ty / pc.height) * pen.size[1]];
    pen.follow = time => {
      const u = e.revealAt(Math.max(time, e.at)), I = e.ink, cx = Math.min(I.W - 1, Math.max(0, Math.round(u * I.W))), [w, h] = e.size;
      const px = e.x + I.x0 + u * w, py = e.y + (.5 - I.cy[cx] / I.H) * h;
      return [px - tipLocal[0], py - tipLocal[1]];
    };
    e.pen = pen;
  }
  return e;
}
// label(P, text, { x, y, style, size, at, anchor, color }): small print on the collage.
//   style: 'typewriter' (typed onto a cream paper strip) | 'strip' (instant strip) | 'black' (white caps on black tape)
//        | 'kicker' (section tag, typewriter caps on a strip) | 'tag' (red outlined box) | 'plain' (typewriter text, no strip)
export function label(P, str, o = {}) {
  const style = o.style ?? (SCENES ? 'plain' : 'typewriter'), size = o.size ?? .32, typed = style === 'typewriter' || style === 'kicker';
  // tape and strips are laid down left to right; plain text rises in; typed styles type
  const e = element(P, 'label', str, { ...o, in: typed ? 'none' : (o.in ?? (style === 'plain' ? 'rise' : 'wipe')), dur: o.dur ?? (typed ? Math.max(.3, str.length * .035) : .45), layer: o.layer ?? 2, sfx: typed ? false : o.sfx }, e => {
    const font = style === 'black' ? 'condensed' : style === 'tag' ? 'anton' : (LOOK.labelFont ?? 'typewriter'), text = style === 'kicker' || style === 'black' ? str.toUpperCase() : str;
    const fg = style === 'black' ? C.light : style === 'tag' ? C.red : (o.color ?? C.ink), bg = style === 'black' ? C.ink : style === 'plain' || style === 'tag' ? null : C.light;
    const full = textCanvas(text, { font, size, color: fg, pad: .4, spacing: style === 'kicker' || style === 'black' ? .08 : 0 });
    const c = mkCanvas(full.canvas.width, full.canvas.height), tex = canvasTex(c);
    const paint = n => { const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
      if (bg) { tornPath(x, c.width, c.height, { amount: 3, seed: e.seed, inset: 1, edges: 'lr' }); x.fillStyle = bg; x.fill(); }
      if (style === 'tag') { x.strokeStyle = C.red; x.lineWidth = Math.max(2, full.px * .09); x.strokeRect(full.px * .18, full.px * .22, c.width - full.px * .36, c.height - full.px * .44); }
      x.drawImage(n >= text.length ? full.canvas : textCanvas(text.slice(0, n), { font, size, color: fg, pad: .4, spacing: style === 'kicker' || style === 'black' ? .08 : 0 }).canvas, 0, 0); tex.needsUpdate = true; };
    paint(typed ? 0 : text.length);
    const [w, h] = unitsFor(c, size * c.height / full.px);
    const off = [o.anchor === 'left' ? w / 2 : o.anchor === 'right' ? -w / 2 : 0, 0];
    addFace(e, tex, w, h, { shadow: !!bg, srcCanvas: c, blur: 4, offset: off }); e.textColor = fg; e.ownBg = !!bg;
    if (typed) { let shown = typed && e.at <= 0 ? text.length : 0; if (e.at <= 0) paint(text.length);
      e.redraw = time => { const n = e.at <= 0 ? text.length : Math.round(clamp((time - e.at) / e.dur) * text.length); if (n !== shown) { shown = n; paint(n); } }; }
    e.size = [w, h];
  });
  if (typed && e.at > 0) sfx('type', e.at, { dur: e.dur, gain: -3 });
  return e;
}
// stamp(P, '1814', { x, y, size, rot, color, at, box }): a rubber stamp slammed on (grungy ink, optional box)
export function stamp(P, str, o = {}) {
  return element(P, 'stamp', str, { rot: o.rot ?? -1.5, ...o, in: o.in ?? 'ink', dur: o.dur ?? .55, layer: o.layer ?? 3 }, e => {
    const size = o.size ?? .8, col = o.color ?? C.red, t = textCanvas(String(str).toUpperCase(), { font: o.font ?? 'anton', size, color: col, pad: o.backing ? .32 : .45, spacing: .04 });
    const c = mkCanvas(t.canvas.width, t.canvas.height), x = c.getContext('2d');
    if (o.backing) { tornPath(x, c.width, c.height, { amount: 4, seed: e.seed, inset: 1 }); x.fillStyle = o.backing === true ? C.light : o.backing; x.fill(); }   // a paper chip under the ink (busy backgrounds)
    x.drawImage(t.canvas, 0, 0);
    if (o.box !== false) { x.strokeStyle = col; x.lineWidth = t.px * .1; const b = t.px * .2; x.strokeRect(b, b * 1.1, c.width - b * 2, c.height - b * 2.2); }
    x.globalCompositeOperation = o.backing ? 'source-atop' : 'destination-out'; if (o.backing) x.fillStyle = o.backing === true ? C.light : o.backing; const r = rng(e.seed);                   // worn ink
    if (LOOK.texture !== false) for (let i = 0; i < c.width * c.height / 150; i++) { x.globalAlpha = r() * .55; x.fillRect(r() * c.width, r() * c.height, 1 + r() * 3, 1 + r() * 2); }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    const [w, h] = unitsFor(c, size * c.height / t.px);
    const f = addFace(e, canvasTex(c), w, h, { shadow: !!o.backing, srcCanvas: c, blur: 4 }); f.material.uniforms.opacity.value = 1;
    e.size = [w, h]; e.textColor = col; e.ownBg = !!o.backing;
  });
}
// counter(P, { from, to, x, y, size, at, dur, prefix, suffix, dec, card, color }): a big number that counts up (odometer ticks)
export function counter(P, o = {}) {
  const e = element(P, 'counter', `${o.prefix ?? ''}${o.to}${o.suffix ?? ''}`, { ...o, in: o.in ?? 'rise', dur: .4, layer: o.layer ?? 2 }, e => {
    const size = o.size ?? 1, font = o.font ?? 'anton', final = `${o.prefix ?? ''}${fmt(o.to, o.dec ?? 0)}${o.suffix ?? ''}`;
    const full = textCanvas(final, { font, size, color: o.color ?? C.ink, pad: .3 }), c = mkCanvas(full.canvas.width * 1.06, full.canvas.height), tex = canvasTex(c);
    let shown = null; const cd = o.countDur ?? 1.6;
    e.redraw = time => { const k = easeOut(clamp((time - e.at - .15) / cd)), v = lerp(o.from ?? 0, o.to, k), s = `${o.prefix ?? ''}${fmt(v, o.dec ?? 0)}${k >= 1 && o.suffixEnd ? o.suffixEnd : o.suffix ?? ''}`;
      if (s === shown) return; shown = s; const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
      if (o.card !== false) { tornPath(x, c.width, c.height, { amount: 5, seed: e.seed, inset: 2 }); x.fillStyle = C.light; x.fill(); }
      const sub = textCanvas(s, { font, size, color: o.color ?? C.ink, pad: .3 }); x.drawImage(sub.canvas, (c.width - sub.canvas.width) / 2, 0); tex.needsUpdate = true; };
    const [w, h] = unitsFor(c, size * c.height / full.px);
    addFace(e, tex, w, h, { shadow: o.card !== false, srcCanvas: c, blur: 8 }); e.textColor = o.color ?? C.ink; e.ownBg = o.card !== false;
    e.size = [w, h];
  });
  sfx('tick', e.at + .15, { dur: o.countDur ?? 1.6 });
  return e;
}
// wordBox(el, 'hand') -> { x, y, w, h }: exactly where a word of a script/headline sits (panel units), from the font's metrics
export function wordBox(el, word) {
  const T = el.text; if (!T) throw new Error(`wordBox: ${el.kind} has no text layout`);
  const i = T.str.indexOf(word); if (i < 0) throw new Error(`wordBox: "${word}" is not in "${T.str}"`);
  const m = mkCanvas(8, 8).getContext('2d'); m.font = fontStr(T.font, T.px, T.italic); if (T.spacing) m.letterSpacing = `${T.spacing * T.px}px`;
  const x0 = T.pad + m.measureText(T.str.slice(0, i)).width, ww = m.measureText(word).width, k = el.size[0] / T.W;
  const left = el.x + T.offX - el.size[0] / 2;
  return { x: left + (x0 + ww / 2) * k, y: el.y + T.px * .02 * k, w: ww * k, h: T.px * .78 * k };
}
// mark(P, { type, x, y, w, h, at, dur, color, width, around, word, target }): marker annotation drawn on.
//   around + word: circle/underline exactly that word of a script/headline (target is set to it automatically)
//   type: 'circle' (loose ellipse around x,y,w,h) | 'underline' | 'arrow' (from x,y to x2,y2) | 'cross' | 'strike' | 'box'
export function mark(P, o = {}) {
  if (o.around && o.word) { const b = wordBox(o.around, o.word), padX = o.type === 'underline' ? 1.02 : 1.28, padY = o.type === 'underline' ? 1 : 1.55;
    o = { ...o, x: b.x, y: o.type === 'underline' ? b.y - b.h * .62 : b.y, w: b.w * padX, h: o.type === 'underline' ? .3 : b.h * padY, target: o.around.label }; }
  const type = o.type ?? 'circle';
  const e = element(P, 'mark', type, { ...o, in: 'none', dur: o.dur ?? .6, layer: o.layer ?? 3, sfx: false }, e => {
    const x0 = o.type === 'arrow' ? Math.min(o.x, o.x2) : o.x - (o.w ?? 2) / 2, y0 = o.type === 'arrow' ? Math.min(o.y, o.y2) : o.y - (o.h ?? 1) / 2;
    const bw = o.type === 'arrow' ? Math.abs(o.x2 - o.x) + .6 : (o.w ?? 2) + .6, bh = o.type === 'arrow' ? Math.abs(o.y2 - o.y) + .6 : (o.h ?? 1) + .6, sc = 110;
    const c = mkCanvas(bw * sc, bh * sc), tex = canvasTex(c), r = rng(e.seed), col = o.color ?? C.red, lw = (o.width ?? .07) * sc;
    const P2 = (px, py) => [(px - x0 + .3) * sc, (bh - (py - y0 + .3)) * sc];
    let path;
    if (type === 'circle') { const n = 64, turns = 1.12, cx = o.x, cy = o.y, rx = (o.w ?? 2) / 2, ry = (o.h ?? 1) / 2, a0 = r() * 6;
      path = Array.from({ length: n + 1 }, (_, i) => { const a = a0 + i / n * Math.PI * 2 * turns, wob = 1 + (r() - .5) * .05 + i / n * .06; return P2(cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob); }); }
    else if (type === 'underline' || type === 'strike') { const yy = type === 'strike' ? o.y : o.y - (o.h ?? .4) / 2; path = Array.from({ length: 13 }, (_, i) => P2(o.x - (o.w ?? 2) / 2 + i / 12 * (o.w ?? 2), yy + Math.sin(i * .9 + r()) * .03)); }
    else if (type === 'arrow') { path = Array.from({ length: 17 }, (_, i) => { const k = i / 16, bend = Math.sin(k * Math.PI) * .18 * (o.bend ?? 1); return P2(lerp(o.x, o.x2, k) - (o.y2 - o.y) * bend * .3, lerp(o.y, o.y2, k) + (o.x2 - o.x) * bend * .3); }); }
    else if (type === 'cross') { const rx = (o.w ?? 1) / 2, ry = (o.h ?? 1) / 2; path = [P2(o.x - rx, o.y + ry), P2(o.x + rx, o.y - ry), null, P2(o.x + rx, o.y + ry), P2(o.x - rx, o.y - ry)]; }
    else { const rx = (o.w ?? 2) / 2, ry = (o.h ?? 1) / 2; path = [P2(o.x - rx, o.y + ry), P2(o.x + rx, o.y + ry + .03), P2(o.x + rx - .02, o.y - ry), P2(o.x - rx, o.y - ry + .02), P2(o.x - rx + .03, o.y + ry + .06)]; }
    let shown = -1;
    e.redraw = time => { const k = Math.round(easeOut(clamp((time - e.at) / e.dur)) * 60) / 60; if (k === shown) return; shown = k;
      const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.strokeStyle = col; x.lineWidth = lw; x.lineCap = 'round'; x.lineJoin = 'round'; x.globalAlpha = .9;
      const pts = path, n = Math.max(1, Math.floor((pts.length - 1) * k)); x.beginPath(); let pen = false;
      for (let i = 0; i <= n; i++) { const p = pts[i]; if (!p) { pen = false; continue; } if (!pen) { x.moveTo(p[0], p[1]); pen = true; } else x.lineTo(p[0], p[1]); }
      x.stroke();
      if (type === 'arrow' && k >= 1) { const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 3], an = Math.atan2(ay - by, ax - bx), L = lw * 4;
        x.beginPath(); x.moveTo(ax - Math.cos(an - .5) * L, ay - Math.sin(an - .5) * L); x.lineTo(ax, ay); x.lineTo(ax - Math.cos(an + .5) * L, ay - Math.sin(an + .5) * L); x.stroke(); }
      tex.needsUpdate = true; };
    e.x = x0 - .3 + bw / 2; e.y = y0 - .3 + bh / 2;
    addFace(e, tex, bw, bh, { shadow: false });
  });
  sfx('marker', e.at, { dur: e.dur });
  return e;
}
// tape(P, { x, y, w, rot, at }): a strip of masking tape
export function tape(P, o = {}) {
  return element(P, 'tape', '', { rot: o.rot ?? -12, ...o, in: o.in ?? 'fade', dur: .15, layer: o.layer ?? 4, sfx: 'tape' }, e => {
    const w = o.w ?? 1.4, h = o.h ?? .38, c = mkCanvas(w * 90, h * 90), x = c.getContext('2d');
    tornPath(x, c.width, c.height, { amount: 5, seed: e.seed, edges: 'lr', inset: 1 }); x.fillStyle = C.tape; x.globalAlpha = .82; x.fill();
    x.globalAlpha = .08; for (let i = 0; i < 40; i++) { x.fillStyle = i % 2 ? '#fff' : '#000'; x.fillRect(0, Math.random() * c.height, c.width, 1); }
    addFace(e, canvasTex(c), w, h, { shadow: false });
  });
}
// dots(P, [[x,y], ...], { at, stagger, color, r, ring }): map pins that pop in one after another (spread, cities, events)
export function dots(P, pts, o = {}) {
  return pts.map(([x, y], i) => element(P, 'dot', `${i}`, { x, y, at: (o.at ?? 0) + i * (o.stagger ?? .06), in: 'pop', dur: .25, layer: o.layer ?? 3, sfx: i % 3 ? false : 'pop' }, e => {
    const r = o.r ?? .14, c = mkCanvas(64, 64), g = c.getContext('2d'); g.fillStyle = o.color ?? C.red; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fill();
    if (o.ring !== false) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 5; g.stroke(); }
    addFace(e, canvasTex(c), r * 2, r * 2, { srcCanvas: c, blur: 3 });
  }));
}
// scatter(P, key, { n, at, dur, from, to, h, spin }): copies of a cut-out flying across (leaflets, pages, coins)
export function scatter(P, key, o = {}) {
  const n = o.n ?? 8, r = rng(hashStr(key) + n), out = [];
  for (let i = 0; i < n; i++) {
    const e = cutout(P, key, { h: (o.h ?? 1) * (.7 + r() * .5), border: 5, at: (o.at ?? 0) + r() * (o.spread ?? .8), in: 'fade', dur: .1, layer: o.layer ?? 4, sfx: i ? false : 'swish', rot: r() * 360 });
    const fx = o.from ?? [-FRAME.w * .7, (r() - .5) * FRAME.h], tx = o.to ?? [FRAME.w * .7, (r() - .5) * FRAME.h], d = (o.dur ?? 1.6) * (.8 + r() * .4), sp = (r() - .5) * (o.spin ?? 6), a0 = e.at, wob = r() * 6;
    const ox = (r() - .5) * 2, oy = (r() - .5) * FRAME.h * .7;
    e.path = time => { const k = clamp((time - a0) / d); return k >= 1 && !o.stay ? null : [lerp(fx[0], tx[0], k) + ox, lerp(fx[1], tx[1], k) + oy + Math.sin(k * 6 + wob) * .3, sp * k]; };
    out.push(e);
  }
  return out;
}
// newspaper(P, { x, y, w, name, date, headline, sub, at, in }): a whole newspaper page (masthead, rules, columns of print)
export function newspaper(P, o = {}) {
  return element(P, 'newspaper', o.name || 'newspaper', { in: 'drop', ...o, layer: o.layer ?? 0 }, e => {
    const w = o.w ?? 10, h = o.h ?? w * .62, pw = 1500, ph = Math.round(pw * h / w), c = mkCanvas(pw + 20, ph + 20), x = c.getContext('2d'), r = rng(e.seed);
    tornPath(x, c.width, c.height, { amount: 6, seed: e.seed, inset: 2 }); x.save(); x.clip(); x.drawImage(paperCanvas('newsprint', { w: c.width, h: c.height, seed: e.seed, color: '#e9e3d4' }), 0, 0);
    const L = 40, R = c.width - 40; x.fillStyle = C.ink; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = fontStr('blackletter', 70); x.fillText(o.name || 'The Daily Press', c.width / 2, 100);
    x.fillRect(L, 118, R - L, 3); x.fillRect(L, 124, R - L, 1); x.font = fontStr('typewriter', 17); x.fillText(o.date || '', c.width / 2, 146); x.fillRect(L, 158, R - L, 1);
    let y = 170;
    if (o.headline) { x.font = fontStr('abril', 150); const ht = o.headline; let fs = 150; while (x.measureText(ht).width > R - L - 20 && fs > 40) { fs -= 6; x.font = fontStr('abril', fs); } x.fillText(ht, c.width / 2, y + fs * .92); y += fs * 1.05; }
    if (o.sub) { x.font = fontStr('courier', 26); x.fillText(o.sub.toUpperCase(), c.width / 2, y + 22); y += 44; x.fillRect(L, y, R - L, 1); y += 12; }
    x.fillStyle = 'rgba(25,22,18,.55)'; const cols = 5, cw = (R - L) / cols;
    for (let k = 0; k < cols; k++) { if (k) x.fillRect(L + k * cw - 6, y, 1, c.height - y - 30); for (let yy = y + 8; yy < c.height - 30; yy += 11) if (r() > .04) x.fillRect(L + k * cw + 4, yy, cw - 18 - (r() < .12 ? r() * cw * .5 : 0), 4); }
    x.restore();
    addFace(e, canvasTex(c), w * c.width / pw, h * c.height / ph, { srcCanvas: c, blur: 14 });
    e.size = [w, h];
  });
}
// drawn(P, { w, h, draw(ctx, k, time, W, H), at, dur, in, key(time) }): anything else, drawn on a canvas (gauges, charts,
// diagrams). draw() is called whenever key(time) changes (default: 60 steps of progress k across dur).
export function drawn(P, o = {}) {
  return element(P, 'drawn', o.name || 'drawing', { in: 'drop', ...o, layer: o.layer ?? 2 }, e => {
    const w = o.w ?? 3, h = o.h ?? 3, c = mkCanvas(Math.min(2048, w * PPU * .8), Math.min(2048, h * PPU * .8)), tex = canvasTex(c);
    let shown = null; const d = o.animDur ?? o.dur ?? 1;
    e.redraw = time => { const k = clamp((time - e.at) / d), key = o.key ? o.key(time) : Math.round(k * 60); if (key === shown) return; shown = key;
      const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); o.draw(x, k, time, c.width, c.height); tex.needsUpdate = true; };
    e.redraw(1e9); shown = null;
    addFace(e, tex, w, h, { shadow: o.shadow !== false, srcCanvas: c, blur: 10 });
    e.size = [w, h];
  });
}

// ---------- element animation ----------
function setOpacity(e, a) { for (const m of e.g.children) if (m.material?.uniforms) m.material.uniforms.opacity.value = (m.userData.shadow ? SETTINGS.shadow.opacity : m.userData.baseOp ?? (m.userData.baseOp = m.material.uniforms.opacity.value)) * a; }
function animate(e, t) {
  const g = e.g;
  if (t < e.at - 1e-4 && e.at > 0) { g.visible = false; return; }
  g.visible = true;
  e.redraw?.(t);
  const p = e.at <= 0 ? 1 : clamp((t - e.at) / Math.max(.001, e.dur)), [kind, dir] = String(e.in).split('-');   // at <= 0: there from the first frame
  let x = e.x, y = e.y, rot = e.rot + e.spin * Math.max(0, t - e.at), s = e.s, op = 1, lift = 0;
  const r1 = hashf(e.seed) - .5, r2 = hashf(e.seed + 9) - .5;
  const dv = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] }[dir] || [r1 < 0 ? -1 : 1, 0];   // where it comes FROM
  if (p < 1) switch (kind) {
    case 'drop': { const k = easeOut(p); lift = .6 * (1 - k); s *= 1 + .05 * (1 - k); rot += r1 * .1 * (1 - k); y += .12 * (1 - k); op = clamp(p * 4); break; }
    case 'ink': { const k = easeOut(p); s *= 1 + .035 * (1 - k); for (const f of e.faces) f.material.uniforms.ink.value = clamp(p * 1.05); break; }
    case 'print': { const k = easeInOut(p); y -= .1 * (1 - easeOut(p)); for (const f of e.faces) f.material.uniforms.reveal.value = k * 1.06; op = clamp(p * 3); break; }
    case 'slide': { const k = easeOutBack(p, .9), L = Math.max(FRAME.w, FRAME.h) * .75; x += dv[0] * L * (1 - k); y += dv[1] * L * (1 - k); rot += r1 * .3 * (1 - k); lift = .5 * (1 - p); break; }
    case 'pop': { s *= Math.max(.001, easeOutBack(p, 2)); break; }
    case 'grow': { s *= Math.max(.001, easeOut(p)); break; }
    case 'slam': { const k = p < .45 ? easeIn(p / .45) : 1; s *= p < .45 ? lerp(1.9, 1, k) : 1 + .04 * Math.sin((p - .45) * 18) * (1 - p); op = clamp(p * 6); lift = 1 - k; break; }
    case 'peel': { g.scale.set(1, 1, 1); s *= 1; op = clamp(p * 4); y += .15 * (1 - easeOut(p)); rot += r1 * .4 * (1 - easeOut(p)); break; }
    case 'rise': { const k = easeOut(p); y -= .5 * (1 - k); op = clamp(p * 2.5); break; }
    case 'fade': op = p; break;
    case 'wipe': for (const f of e.faces) f.material.uniforms.reveal.value = easeInOut(p) * 1.06; break;
  }
  if ((kind === 'wipe' || kind === 'print') && p >= 1) for (const f of e.faces) f.material.uniforms.reveal.value = 2;
  if (kind === 'ink' && p >= 1) for (const f of e.faces) f.material.uniforms.ink.value = 1;
  if (e.revealFace) e.revealFace.material.uniforms.reveal.value = t < e.at ? 0 : t >= e.at + e.dur ? 2 : e.revealAt(t) + .012;
  if (e.follow) { const [fx, fy] = e.follow(t); x = fx; y = fy; }
  if (e.path) { const pp = e.path(t); if (!pp) { g.visible = false; return; } x = pp[0]; y = pp[1]; rot = e.rot + pp[2]; }
  if (e.out && e.outAt != null && t > e.outAt) {
    const q = clamp((t - e.outAt) / e.outDur);
    if (e.out === 'lift') { y += easeIn(q) * 1.2; s *= 1 + easeIn(q) * .15; lift = Math.max(lift, q); op *= 1 - easeIn(q); rot += r1 * easeIn(q) * .4; }
    else if (e.out.startsWith('slide')) { const d2 = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] }[e.out.split('-')[1]] || [1, 0]; x += d2[0] * easeIn(q) * FRAME.w; y += d2[1] * easeIn(q) * FRAME.h; }
    else if (e.out === 'drop') { y -= easeIn(q) * FRAME.h; rot += r1 * q; }
    else op *= 1 - q;
    if (q >= 1) { g.visible = false; return; }
  }
  if (e.bob) y += Math.sin((t - e.at) * (e.bob.speed ?? 2)) * (e.bob.amount ?? .05);
  g.position.set(x, y, e.z + lift * .4); g.rotation.z = rot; g.scale.setScalar(s);
  if (e.shadow) { const k = 1 + lift * 2.2, off = e.shadow.userData.off || [0, 0]; e.shadow.position.set(off[0] + .07 * k, off[1] - .1 * k, 0); e.shadow.scale.setScalar(1 + lift * .08); }
  setOpacity(e, op);
  if (e.shadow) e.shadow.material.uniforms.opacity.value = SETTINGS.shadow.opacity * op * (1 - lift * .45);
}

// ---------- masthead + finale (the front page) ----------
let FINALE = null;
// finale({ at, title, kicker, tag, edition, footer, loop, loopDur, dur }): at `at` the camera pulls back to the whole
// front page and the masthead prints; with loop (default) the last loopDur seconds push back into the first panel,
// ending exactly on the opening frame (elements of panel 1 that arrived later lift off during the push).
export function finale(o = {}) {
  if (SCENES) return null;                                           // scenes mode: no front-page finale (the video ends on its last scene)
  const src = caller();
  FINALE = { at: o.at, dur: o.dur ?? 1.8, loop: o.loop !== false, loopDur: o.loopDur ?? 1.6, o };
  SHOTS.push({ t0: o.at, name: o.name || 'Front page', _file: SUITE.module || src?.file || null, _line: src?.line ?? null, _finale: true, trans: 'pull' });
  return FINALE;
}
function buildMasthead(L) {
  if (!FINALE || FINALE._built) return; FINALE._built = true;
  const o = FINALE.o, top = L.cy + L.h / 2 + 2.6, at = FINALE.at + FINALE.dur * .55, Mh = { group: SHEET };
  const mk = (fn, ...a) => { const e = fn(null, ...a); return e; };
  const W2 = L.w;
  if ((o.masthead ?? SETTINGS.look?.masthead) === false) return;     // a style without the front-page masthead
  mk(headline, o.title || 'The Daily Collage', { x: 0, y: top, size: Math.max(2.2, W2 * .045), font: o.font || SETTINGS.look?.titleFont || 'blackletter', anim: 'fade', at, dur: .8, layer: 6, sfx: false });
  mk(drawn, { name: 'masthead rules', x: 0, y: top - Math.max(2.2, W2 * .045) * .62 - .25, w: W2, h: .25, at: at - .2, in: 'fade', dur: .6, shadow: false, layer: 6, draw: (x, k, t, w, h) => { x.fillStyle = C.ink; x.fillRect(0, h * .2, w * clamp(k * 1.4), h * .18); x.fillRect(0, h * .62, w * clamp(k * 1.4), h * .08); } });
  if (o.kicker) mk(label, o.kicker, { x: 0, y: top - Math.max(2.2, W2 * .045) * .62 - .75, size: Math.max(.34, W2 * .0075), style: 'plain', at: at + .3, layer: 6 });
  if (o.edition) mk(label, o.edition, { x: -W2 / 2 + 1.4, y: top, size: Math.max(.3, W2 * .006), style: 'plain', at: at + .1, layer: 6 });
  if (o.issue) mk(label, o.issue, { x: W2 / 2 - 1.4, y: top, size: Math.max(.3, W2 * .006), style: 'plain', at: at + .1, layer: 6 });
  if (o.tag) mk(stamp, o.tag, { x: Math.max(2.2, W2 * .045) * 3.2, y: top + .2, size: Math.max(.7, W2 * .014), at: at + 1.1, layer: 7 });
  if (o.footer) mk(label, o.footer, { x: 0, y: L.cy - L.h / 2 - 1, size: Math.max(.3, W2 * .006), style: 'plain', at: at + .5, layer: 6 });
  void Mh;
}

// ---------- shots + camera ----------
// shot({ at, panel, x, y, zoom, rot, trans, dur, drift, name }): where the camera looks from `at` on.
//   panel: the panel (from panel()); x, y: offset inside it (panel units); zoom: 1 = the panel fills the frame.
//   trans (how the camera gets here): 'whip' (default between panels: fast pan with motion blur) | 'slide' (calmer pan)
//     | 'move' (default inside the same panel: eased reframe) | 'push' (zoom through into the new framing) | 'cut'
export const SHOTS = [];
export function shot(def) {
  const src = caller();
  const s = { ...def, t0: def.t0 ?? def.at ?? 0, _file: SUITE.module || src?.file || null, _line: src?.line ?? null };
  SHOTS.push(s); return s;
}
let LAYOUT = null, SHEETFIT = null;
export function finalizeShots(end) {
  SHOTS.sort((a, b) => a.t0 - b.t0);
  SHOTS.forEach((s, i) => { s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : end; s._st = s._st || {}; });
  END = end;
  LAYOUT = layoutPanels();
  sheetBackdrop(LAYOUT);
  buildMasthead(LAYOUT);
  const fitW = LAYOUT.w + 2.5, fitH = LAYOUT.h + (FINALE ? 7 : 2.5), zoom = Math.min(FRAME.w / fitW, FRAME.h / fitH);
  SHEETFIT = { x: 0, y: LAYOUT.cy + (FINALE ? 1.6 : 0), zoom, rot: 0 };
  if (FINALE?.loop) {                                                 // panel 1's late arrivals leave as the camera pushes back in
    const first = SHOTS.find(s => !s._finale && s.panel), loopAt = end - FINALE.loopDur;
    if (first) for (const e of first.panel.elems) if (e.at > first.t0 + .05 && e.out == null) { e.out = 'lift'; e.outAt = loopAt + FINALE.loopDur * .15; e.outDur = FINALE.loopDur * .5; }
  }
}
let END = 0, BACKDROP = false;
function sheetBackdrop(L) {
  if (BACKDROP || SCENES) return; BACKDROP = true;
  const w = L.w + 6, h = L.h + (FINALE ? 11 : 6), c = paperCanvas('sheet', { w: 2048, h: Math.round(2048 * h / w), seed: 5 });
  const m = plane(canvasTex(c), w, h, nextOrder(-5)); m.position.set(0, L.cy + (FINALE ? 1.8 : 0), -.01); m.userData.noPick = true; SHEET.add(m);
}
export function activeIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t0) i++; return i; }
export const transOf = (s, i = SHOTS.indexOf(s)) => {
  if (s._finale) return 'pull';
  if (s.trans) return s.trans;
  const prev = SHOTS[i - 1]; if (!prev) return 'cut';
  return prev.panel === s.panel ? 'move' : (LOOK.between ?? 'whip');
};
const TRANS_DUR = { whip: .85, slide: 1.3, move: 1.6, push: 1.3, pull: 2.6, cut: 0 };
const durOf = (s, i) => s.dur ?? (s._finale ? (FINALE?.dur ?? 2.6) : TRANS_DUR[transOf(s, i)] ?? .85);
function poseOf(s) {
  if (s._finale) return { ...SHEETFIT };
  const P = s.panel || PANELS[0]; if (!P) return { x: 0, y: 0, zoom: 1, rot: 0 };
  return { x: P.x + (s.x ?? 0), y: P.y + (s.y ?? 0), zoom: s.zoom ?? 1, rot: (s.rot ?? 0) * Math.PI / 180 };
}
function driftPose(s, i, t) {                                         // the shot's pose with its slow creep-in
  const p = poseOf(s), prog = clamp((t - s.t0) / Math.max(1, s.t1 - s.t0), -.4, 1.4), d = s.drift ?? (s._finale ? .02 : SETTINGS.camera.drift);
  const dd = typeof d === 'number' ? { zoom: d, x: 0, y: 0 } : { zoom: 0, x: 0, y: 0, ...d };
  return { x: p.x + dd.x * prog, y: p.y + dd.y * prog, zoom: p.zoom * (1 + dd.zoom * prog), rot: p.rot };
}
const lerpPose = (a, b, k, logZoom = true) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), zoom: logZoom ? Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), k)) : lerp(a.zoom, b.zoom, k), rot: lerp(a.rot, b.rot, k) });
const erf = x => { const sg = Math.sign(x); x = Math.abs(x); const q = 1 / (1 + .3275911 * x); return sg * (1 - (((((1.061405429 * q - 1.453152027) * q) + 1.421413741) * q - .284496736) * q + .254829592) * q * Math.exp(-x * x)); };
const Phi = z => .5 * (1 + erf(z / Math.SQRT2));
const smoother = x => (x = clamp(x), x * x * x * (x * (x * 6 - 15) + 10));
// a transition is a smooth ramp centred on the shot's `at` (the finale's pull starts at its `at`): 99% of it happens
// within its duration, with no jump in speed at either end
const centreOf = (s, i) => s._finale ? s.t0 + durOf(s, i) * .45 : s.t0;
function edge(k, t) { const s = SHOTS[k], D = durOf(s, k), c = centreOf(s, k); return D <= .001 ? (t >= c ? 1 : 0) : Phi((t - c) / (D / 5)); }
let SHAKES = [];
export function shake(at, amount = .08, dur = .25) { SHAKES.push([at, amount, dur]); }
export function camAt(t) {
  if (!SHOTS.length) return { x: 0, y: 0, zoom: 1, rot: 0 };
  const n = SHOTS.length, ws = new Array(n); let sum = 0;
  for (let i = 0; i < n; i++) { ws[i] = Math.max(0, (i === 0 ? 1 : edge(i, t)) - (i + 1 < n ? edge(i + 1, t) : 0)); sum += ws[i]; }
  let x = 0, y = 0, lz = 0, rot = 0;
  for (let i = 0; i < n; i++) { const w = ws[i] / (sum || 1); if (w < 1e-6) continue; const p = driftPose(SHOTS[i], i, t); x += p.x * w; y += p.y * w; lz += Math.log(p.zoom) * w; rot += p.rot * w; }
  let pose = { x, y, zoom: Math.exp(lz), rot };
  for (let k = 1; k < n; k++) {                                      // long pans pull out a little mid-travel
    const a = ws[k - 1] / (sum || 1), b = ws[k] / (sum || 1); if (a * b < 1e-4 || transOf(SHOTS[k], k) !== 'whip') continue;
    const d = Math.hypot(poseOf(SHOTS[k]).x - poseOf(SHOTS[k - 1]).x, poseOf(SHOTS[k]).y - poseOf(SHOTS[k - 1]).y);
    if (d > FRAME.w * .8) pose.zoom *= 1 - Math.min(.16, .05 * d / FRAME.w) * 4 * a * b;
  }
  if (FINALE?.loop && t > END - FINALE.loopDur && SHOTS[0]) {           // back into the opening frame, landing exactly on it
    pose = lerpPose(pose, driftPose(SHOTS[0], 0, SHOTS[0].t0), smoother((t - (END - FINALE.loopDur)) / (FINALE.loopDur - .12)));
  }
  for (const [at, amt, dur] of SHAKES) { if (t < at || t > at + dur) continue; const k = 1 - (t - at) / dur; pose.x += Math.sin(t * 90) * amt * k / pose.zoom; pose.y += Math.cos(t * 77) * amt * k / pose.zoom; }
  return pose;
}
const CAM = new THREE.PerspectiveCamera(SETTINGS.camera.fov, FW / FH, .5, 5000);
const D0 = (FRAME.h / 2) / Math.tan(SETTINGS.camera.fov * Math.PI / 360);
function poseCamera(v) {
  const dist = D0 / v.zoom; CAM.position.set(v.x, v.y, dist); CAM.up.set(Math.sin(-v.rot), Math.cos(v.rot), 0); CAM.lookAt(v.x, v.y, 0); CAM.updateMatrixWorld(); CAM.updateProjectionMatrix();
}

// ---------- post (motion blur along the camera's travel, paper, halftone, grain, vignette) ----------
const rtScene = new THREE.WebGLRenderTarget(DW, DH, { samples: 4, type: THREE.HalfFloatType });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qScene = new THREE.Scene(), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); qScene.add(quad);
const paperOverlay = canvasTex(paperCanvas('#808080', { w: 1024, h: 1024, seed: 11 }), { srgb: false, repeat: [1, 1] });
const P0 = SETTINGS.post;
const postMat = new THREE.ShaderMaterial({
  uniforms: { tSharp: { value: rtScene.texture }, tPaper: { value: paperOverlay }, vel: { value: new THREE.Vector2() }, time: { value: 0 }, res: { value: new THREE.Vector2(FW, FH) },
    grain: { value: P0.grain }, halftone: { value: P0.halftone }, paper: { value: P0.paper }, vignette: { value: P0.vignette }, warmth: { value: P0.warmth }, tone: { value: P0.tone ?? 0 }, camOff: { value: new THREE.Vector2() } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.); }`,
  fragmentShader: `uniform sampler2D tSharp, tPaper; uniform float time, grain, halftone, paper, vignette, warmth, tone; uniform vec2 vel, res, camOff; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 toSRGB(vec3 c){ c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
    void main(){
      vec2 uv = vUv; vec3 c;
      if (length(vel) > .0004) { vec3 acc = vec3(0.); for (int i = 0; i < 24; i++) { float k = float(i) / 23. - .5; acc += texture2D(tSharp, uv + vel * k).rgb; } c = acc / 24.; }
      else c = texture2D(tSharp, uv).rgb;
      c *= vec3(1. + warmth * .05, 1., 1. - warmth * .07);
      vec3 s = toSRGB(c);
      if (tone > 0.) { float l = dot(s, vec3(.299, .587, .114)); s = mix(s, vec3(l) * vec3(1.08, .94, .72) + vec3(.02, .01, 0.), tone); }   // sepia print
      float pv = texture2D(tPaper, uv * res / 1024. * .8 + camOff).r - .5;
      s += pv * paper * .2 * (1. - abs(s - .5) * 1.1);
      vec2 g = mat2(.7071, -.7071, .7071, .7071) * (gl_FragCoord.xy / ${(4.6 * PREVIEW_SCALE).toFixed(3)});
      float dotv = length(fract(g) - .5), lum = dot(s, vec3(.299, .587, .114));
      float ht = smoothstep(0., .06, sqrt(1. - lum) * .6 - dotv);
      s = mix(s, s * (1. - ht * .5), halftone);
      s += (hash(gl_FragCoord.xy + fract(time * 7.13) * 91.) - .5) * grain;
      vec2 q2 = uv - .5; float v = smoothstep(.4, 1., length(q2 * vec2(res.x / res.y, 1.) * (res.x < res.y ? 1.15 : .82)));
      s *= 1. - v * vignette;
      gl_FragColor = vec4(s, 1.);
    }` });
function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, qCam); }

// ---------- frame ----------
export let NOW = 0;
export function drawFrame(t) {
  NOW = t;
  if (!LAYOUT) finalizeShots(END || t + 1);
  for (const e of ELEMS) animate(e, t);
  for (const s of SHOTS) if (s.update && t >= s.t0 && t < s.t1 + 1) s.update(s._st, t, s);
  const v = camAt(t), vp = camAt(t - .5 / 30);                        // 180-degree shutter
  poseCamera(v);
  renderer.setRenderTarget(rtScene); renderer.setClearColor(SHEET.background, 1); renderer.clear(); renderer.render(SHEET, CAM);
  const vx = -(v.x - vp.x) * v.zoom / FRAME.w, vy = -(v.y - vp.y) * v.zoom / FRAME.h, zoomVel = Math.abs(Math.log(v.zoom / vp.zoom));
  const U = postMat.uniforms, len = Math.hypot(vx, vy), cap = .09, k = len > cap ? cap / len : 1;
  U.vel.value.set(Math.abs(vx) > .0006 || Math.abs(vy) > .0006 ? vx * k : 0, Math.abs(vx) > .0006 || Math.abs(vy) > .0006 ? vy * k : 0);
  U.time.value = t; U.camOff.value.set(v.x * .003 * v.zoom, v.y * .003 * v.zoom);
  void zoomVel;
  pass(postMat, null);
}

// ---------- layout check (the second look: what a person would call sloppy) ----------
// layoutIssues(t): at a steady frame, every finished element is measured on screen:
//   cut   - partly outside the frame (o.bleed: true when that is the intent)
//   overlap - two elements really overlap (measured on their shapes, not boxes); o.over: true / [labels] when intended
//   mark  - a marker line/circle crosses anything but its o.target
//   small - text shorter than 18 px on a 1080 p frame
//   contrast - text without its own paper, too close in brightness to what is behind it (WCAG ratio < 2.8)
const TEXT = new Set(['label', 'headline', 'stamp', 'letter', 'script', 'counter']), SURFACE = new Set(['paper', 'newspaper', 'photo']);
const _rc = new THREE.Raycaster(), _v2 = new THREE.Vector2(), _box = new THREE.Box3(), _v3 = new THREE.Vector3();
const visibleUp = o => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
// the element's visible ink on screen (its transparent padding does not count)
function rectOf(e, cache) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const f of e.faces) {
    const m = maskOf(f, cache), b = m.bbox; if (!b) continue; const gp = f.geometry.parameters;
    for (const [u, v] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) {
      _v3.set((u - .5) * gp.width, (v - .5) * gp.height, 0).applyMatrix4(f.matrixWorld).project(CAM);
      const sx = (_v3.x + 1) / 2, sy = (1 - _v3.y) / 2; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
  }
  return { x0, y0, x1, y1, w: Math.max(1e-6, x1 - x0), h: Math.max(1e-6, y1 - y0) };
}
function maskOf(f, cache) {
  if (cache.has(f)) return cache.get(f);
  const img = f.material.uniforms.map.value.image, c = mkCanvas(64, 64), x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
  const d = x.getImageData(0, 0, 64, 64).data, m = new Uint8Array(4096); let c0 = 64, r0 = 64, c1 = -1, r1 = -1;
  for (let i = 0; i < 4096; i++) { m[i] = d[i * 4 + 3]; if (m[i] > 60) { const cx = i % 64, cy = i >> 6; if (cx < c0) c0 = cx; if (cx > c1) c1 = cx; if (cy < r0) r0 = cy; if (cy > r1) r1 = cy; } }
  m.bbox = c1 < 0 ? null : [c0 / 64, 1 - (r1 + 1) / 64, (c1 + 1) / 64, 1 - r0 / 64];   // uv: u0, v0, u1, v1
  cache.set(f, m); return m;
}
function alphaAt(e, sx, sy, cache) {                                   // the element's opacity at a screen point (0-255)
  _rc.setFromCamera(_v2.set(sx * 2 - 1, -(sy * 2 - 1)), CAM);
  for (const f of e.faces) { const hit = _rc.intersectObject(f, false)[0]; if (!hit?.uv) continue;
    const m = maskOf(f, cache), a = m[Math.min(63, Math.floor((1 - hit.uv.y) * 64)) * 64 + Math.min(63, Math.floor(hit.uv.x * 64))]; if (a > 60) return a; }
  return 0;
}
const lum = hex => { const [r, g, b] = hexRgb(String(hex).startsWith('#') ? hex : '#000000').map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const describe = e => `${e.kind}${e.label ? ` "${String(e.label).slice(0, 40)}"` : ''}${e.src ? ` (${e.src.file}:${e.src.line})` : ''}`;
let _read = null;
export function layoutIssues(t) {
  drawFrame(t);
  const out = [], cache = new Map(), live = ELEMS.filter(e => e.faces.length && visibleUp(e.g) && !e.follow && !e.path && (e.at <= 0 || t >= e.at + e.dur + .05) && !(e.out && e.outAt != null && t >= e.outAt));
  const R = new Map(live.map(e => [e, rectOf(e, cache)]));
  // the frame itself: in a held shot the camera must not show past the edge of its panel
  const si = activeIndex(t), sh = SHOTS[si];
  if (sh && sh.panel && !(FINALE && t >= FINALE.at)) {
    const v = camAt(t), hw = FRAME.w / 2 / v.zoom, hh = FRAME.h / 2 / v.zoom, P = sh.panel, m = .02, sides = [];
    if (v.x - hw < P.x - FRAME.w / 2 - m) sides.push('left'); if (v.x + hw > P.x + FRAME.w / 2 + m) sides.push('right');
    if (v.y - hh < P.y - FRAME.h / 2 - m) sides.push('bottom'); if (v.y + hh > P.y + FRAME.h / 2 + m) sides.push('top');
    if (sides.length) out.push({ t, type: 'frame', what: `shot ${si + 1} (${sh._file}:${sh._line})`, detail: `the frame shows past the panel's edge (${sides.join(', ')}): move x/y or zoom in (drift included)` });
  }
  for (const e of live) {
    const r = R.get(e); if (r.x1 < 0 || r.x0 > 1 || r.y1 < 0 || r.y0 > 1) continue;      // not in this frame at all: fine
    const cutX = Math.max(0, -r.x0) + Math.max(0, r.x1 - 1), cutY = Math.max(0, -r.y0) + Math.max(0, r.y1 - 1);
    if (!e.o.bleed && e.kind !== 'dot' && (cutX / r.w > .03 || cutY / r.h > .03)) out.push({ t, type: 'cut', what: describe(e), detail: `${Math.round(Math.max(cutX / r.w, cutY / r.h) * 100)}% outside the frame (${[r.x0 < 0 && 'left', r.x1 > 1 && 'right', r.y0 < 0 && 'top', r.y1 > 1 && 'bottom'].filter(Boolean).join(', ')})` });
    if (TEXT.has(e.kind) && r.h * FH < 18 && e.kind !== 'letter' && !(FINALE && t >= FINALE.at)) out.push({ t, type: 'small', what: describe(e), detail: `${Math.round(r.h * FH)} px tall on screen: too small to read` });
  }
  const intended = (a, b) => { const ov = a.o.over; return ov === true || (Array.isArray(ov) && ov.some(l => l === b.label || l === b)) || (typeof ov === 'string' && ov === b.label); };
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j]; if (a.P !== b.P) continue;
    if (a.kind === 'tape' || b.kind === 'tape' || intended(a, b) || intended(b, a)) continue;
    if ((a.kind === 'letter' && b.kind === 'letter') || (a.kind === 'dot' && b.kind === 'dot')) continue;   // ransom chips and pin clusters touch on purpose
    const ra = R.get(a), rb = R.get(b), ix0 = Math.max(ra.x0, rb.x0), iy0 = Math.max(ra.y0, rb.y0), ix1 = Math.min(ra.x1, rb.x1), iy1 = Math.min(ra.y1, rb.y1);
    if (ix1 <= ix0 || iy1 <= iy0) continue;
    const isMark = a.kind === 'mark' || b.kind === 'mark', mk = a.kind === 'mark' ? a : b, other = mk === a ? b : a;
    if (isMark && (mk.o.target === other.label || mk.o.target === other || (Array.isArray(mk.o.target) && mk.o.target.includes(other.label)))) continue;
    const surf = SURFACE.has(a.kind) ? a : SURFACE.has(b.kind) ? b : null;
    if (surf && !isMark) { const top = surf === a ? b : a, rt = R.get(top), rs = R.get(surf); const inside = (Math.min(rt.x1, rs.x1) - Math.max(rt.x0, rs.x0)) * (Math.min(rt.y1, rs.y1) - Math.max(rt.y0, rs.y0)) / (rt.w * rt.h);
      if (inside > .9 && top.faces[0].renderOrder > surf.faces[0].renderOrder) continue; }   // composed ON a sheet: fine
    let both = 0, na = 0, nb = 0; const N = 14;
    for (let yi = 0; yi < N; yi++) for (let xi = 0; xi < N; xi++) { const sx = ix0 + (xi + .5) / N * (ix1 - ix0), sy = iy0 + (yi + .5) / N * (iy1 - iy0); const A = alphaAt(a, sx, sy, cache) > 0, B = alphaAt(b, sx, sy, cache) > 0; if (A && B) both++; }
    for (let yi = 0; yi < 8; yi++) for (let xi = 0; xi < 8; xi++) { if (alphaAt(a, ra.x0 + (xi + .5) / 8 * ra.w, ra.y0 + (yi + .5) / 8 * ra.h, cache)) na++; if (alphaAt(b, rb.x0 + (xi + .5) / 8 * rb.w, rb.y0 + (yi + .5) / 8 * rb.h, cache)) nb++; }
    const inter = (ix1 - ix0) * (iy1 - iy0), areaA = ra.w * ra.h * na / 64, areaB = rb.w * rb.h * nb / 64, frac = both / (N * N) * inter / Math.max(1e-6, Math.min(areaA, areaB));
    if (isMark ? frac > .01 : frac > .04) out.push({ t, type: isMark ? 'mark' : 'overlap', what: describe(isMark ? mk : a), other: describe(isMark ? other : b), detail: `${Math.round(frac * 100)}% of the smaller one is covered` });
  }
  // contrast: sample the frame around text that has no paper of its own
  const texts = FINALE && t >= FINALE.at ? [] : live.filter(e => TEXT.has(e.kind) && !e.ownBg && e.textColor); if (texts.length) {
    _read = _read || mkCanvas(FW / 4, FH / 4); const rx = _read.getContext('2d', { willReadFrequently: true }); rx.drawImage(glCanvas, 0, 0, _read.width, _read.height);
    const d = rx.getImageData(0, 0, _read.width, _read.height).data, px = (sx, sy) => { const X = Math.min(_read.width - 1, Math.max(0, Math.round(sx * _read.width))), Y = Math.min(_read.height - 1, Math.max(0, Math.round(sy * _read.height))), o = (Y * _read.width + X) * 4; return [d[o], d[o + 1], d[o + 2]]; };
    for (const e of texts) { const r = R.get(e); if (r.x1 < 0 || r.x0 > 1 || r.y1 < 0 || r.y0 > 1) continue;
      // what is directly behind the text: sample around it, skipping points covered by other elements (their own contrast is theirs)
      let L = 0, n = 0; for (let k = 0; k < 32; k++) { const a2 = k / 32 * Math.PI * 2, rr = 1.06 + (k % 3) * .08, sx = (r.x0 + r.x1) / 2 + Math.cos(a2) * (r.w / 2 * rr + .004), sy = (r.y0 + r.y1) / 2 + Math.sin(a2) * (r.h / 2 * rr + .006);
        if (alphaAt(e, sx, sy, cache) > 0 || live.some(o => o !== e && o.P === e.P && alphaAt(o, sx, sy, cache) > 0)) continue; const [cr, cg, cb] = px(sx, sy); L += lum('#' + [cr, cg, cb].map(v => v.toString(16).padStart(2, '0')).join('')); n++; }
      if (n < 4) continue;
      // the ink as it came out on screen, read at full resolution (thin strokes): the pixels furthest from the paper's tone
      const bgL = L / n, X0 = Math.max(0, Math.floor(r.x0 * FW)), Y0 = Math.max(0, Math.floor(r.y0 * FH)), X1 = Math.min(FW, Math.ceil(r.x1 * FW)), Y1 = Math.min(FH, Math.ceil(r.y1 * FH));
      let tl = lum(e.textColor);
      if (X1 - X0 > 2 && Y1 - Y0 > 2) {
        const fc = mkCanvas(X1 - X0, Y1 - Y0), fx = fc.getContext('2d', { willReadFrequently: true }); fx.drawImage(glCanvas, X0, Y0, X1 - X0, Y1 - Y0, 0, 0, X1 - X0, Y1 - Y0);
        const fd = fx.getImageData(0, 0, fc.width, fc.height).data, Ls = [];
        for (let i = 0; i < fd.length; i += 4 * 3) { const v = [fd[i], fd[i + 1], fd[i + 2]].map(c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }); Ls.push(.2126 * v[0] + .7152 * v[1] + .0722 * v[2]); }
        Ls.sort((p1, p2) => p1 - p2); tl = tl < bgL ? Ls[Math.floor(Ls.length * .06)] : Ls[Math.floor(Ls.length * .94)];
      }
      const ratio = (Math.max(bgL, tl) + .05) / (Math.min(bgL, tl) + .05);
      if (ratio < 2.8) out.push({ t, type: 'contrast', what: describe(e), detail: `contrast ${ratio.toFixed(1)}:1 against what is behind it: hard to read (give it a paper backing, move it, or drop it)` }); }
  }
  return out;
}
// steady moments worth checking: just after every element settles, and the start/middle/end of every shot, never mid-transition
export function checkTimes() {
  const ts = [];
  for (const e of ELEMS) if (e.at > 0 && !e.path && !e.follow) ts.push(e.at + e.dur + .12);
  SHOTS.forEach((s, i) => { const a = centreOf(s, i) + durOf(s, i) * .62 + .02, nx = SHOTS[i + 1], b = nx ? centreOf(nx, i + 1) - durOf(nx, i + 1) * .62 - .02 : END - (FINALE?.loop ? FINALE.loopDur : 0) - .05; if (b > a) ts.push(a, (a + b) / 2, b); });
  const inTrans = t => SHOTS.some((s, i) => i > 0 && Math.abs(t - centreOf(s, i)) < durOf(s, i) * .62) || (FINALE?.loop && t > END - FINALE.loopDur);
  const seen = new Set(); return ts.filter(t => t >= 0 && t <= END && !inTrans(t)).map(t => +t.toFixed(2)).sort((a, b) => a - b).filter(t => { const k = Math.round(t * 4); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 90);
}

// ---------- output ----------
export const outCanvas = document.createElement('canvas'); outCanvas.width = DW; outCanvas.height = DH;
const oc = outCanvas.getContext('2d');
export function compose(t) { drawFrame(t); oc.drawImage(glCanvas, 0, 0); return outCanvas; }
export function PICKABLE(o) { return o.isMesh && !!o.userData.pick && !o.userData.noPick; }
// the host's shot picking raycasts S.scene with S.cam: every shot shares the one sheet and camera
const _shotScene = { scene: SHEET, cam: CAM };
const origPush = SHOTS.push.bind(SHOTS);
SHOTS.push = (...a) => { for (const s of a) s._S = _shotScene; return origPush(...a); };

// ---------- real images (Higgsfield stills with transparency, made with make_image) ----------
export const IMG = {};
export async function loadImages(map) {
  await Promise.all(Object.entries(map).map(([k, src]) => new Promise(res => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => { console.warn('image failed', src); res(); }; im.src = src;
  })));
}

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

// Event pass for sound design: shot boundaries (with transition) and every tactile sound the elements scheduled.
export async function collectEvents(end) {
  if (!LAYOUT) finalizeShots(end);
  const shots = SHOTS.map((s, i) => ({ t0: +s.t0.toFixed(3), trans: transOf(s, i), cut: transOf(s, i) === 'cut', chapter: !!s.panel && SHOTS[i - 1]?.panel !== s.panel, name: s.name || '' }));
  const tr = [];
  SHOTS.forEach((s, i) => { const ty = transOf(s, i); if (ty === 'whip') tr.push(['sfx', +(s.t0 - .12).toFixed(3), 'whoosh', .5, 0, 0]); else if (ty === 'pull' || ty === 'push') tr.push(['sfx', +(s.t0 - .05).toFixed(3), 'swish', .5, -4, 0]); });
  if (FINALE?.loop) tr.push(['sfx', +(end - FINALE.loopDur + .1).toFixed(3), 'swish', .5, -4, 0]);
  const seen = new Set(), list = [];
  for (const e of [...EVENTS, ...tr].filter(e => e[0] === 'sfx').sort((a, b) => a[1] - b[1])) { const key = e[2] + Math.round(e[1] * 20); if (seen.has(key)) continue; seen.add(key); list.push({ t: e[1], type: e[2], pan: e[3], gain: e[4], dur: e[5] }); }
  return { shots, hits: [], cards: [], sfx: list.filter(s => s.t >= 0 && s.t <= end + 1), style: 'collage' };
}

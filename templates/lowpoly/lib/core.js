// Low poly shorts - shared core: settings, format, looks, colours, easing, seeded random, the 5x7 pixel font.
// No imports from engine.js (every lib module may import this one).
import * as THREE from '../vendor/three.module.js';
export { THREE };

const merge = (a, b) => { const o = { ...a }; for (const k in b || {}) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; };
const RAW = globalThis.__CZ_SETTINGS || {};
export const LOOK = RAW.look === 'moody' ? 'moody' : 'bright';
// Per-look defaults (the two analysed channels). A look in the Suite writes all of these into project.json "settings".
const LOOKS = {
  bright: {            // Low Poly Shorts: bright, flat-ish lighting, soft upscale, little post, small yellow lowercase captions at 0.675H
    render: { short: 320 }, post: { sharpen: .28, ca: .35, bloom: .18, threshold: .88, vignette: 0, grain: 0 },
    light: { shadows: false, ambient: 1 }, fog: .6,
    captions: { on: true, style: 'bright', size: 1, y: .675, case: 'lower' },
    camera: { push: .06, shake: 0 }, transitions: { duration: .36, set: 'bright' },
  },
  moody: {             // Loaded Dice: dark saturated interiors, real-time soft shadows, strong bloom, heavy sharpen + CA, vignette
    render: { short: 270 }, post: { sharpen: .75, ca: 1, bloom: .4, threshold: .82, vignette: .5, grain: 0 },
    light: { shadows: true, ambient: 1 }, fog: 1,
    captions: { on: true, style: 'moody', size: 1, y: .75, case: 'asis' },
    camera: { push: .05, shake: 0 }, transitions: { duration: .36, set: 'moody' },
  },
};
export const DEFAULTS = merge({ format: 'vertical', look: LOOK, ps1: { snap: false, affine: false, dither: false }, brand: {} }, LOOKS[LOOK]);
export const SETTINGS = merge(DEFAULTS, RAW);
export const MOODY = LOOK === 'moody';
export const VERT = SETTINGS.format !== 'landscape';
export const FW = VERT ? 1080 : 1920, FH = VERT ? 1920 : 1080, W = FW, H = FH, AW = FW, AH = FH;
// internal render size: the short side from the look (270 / 320 ...), the long side 16:9 of it, even numbers
const SHORT = Math.max(160, Math.min(720, +SETTINGS.render?.short || (MOODY ? 270 : 320)));
const LONG = Math.round(SHORT * 16 / 9 / 2) * 2;
export const RW = VERT ? SHORT : LONG, RH = VERT ? LONG : SHORT;
export const ASPECT = FW / FH;

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / ((b - a) || 1e-6));
export const E = {
  lin: k => k, inOut: k => k * k * (3 - 2 * k), inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2,
  outCubic: k => 1 - Math.pow(1 - k, 3), inCubic: k => k * k * k, outQuart: k => 1 - Math.pow(1 - k, 4), outQuint: k => 1 - Math.pow(1 - k, 5),
  inOutCubic: k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outBack: (k, s = 1.7) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),
};
export const ease = (t, a, b, f = E.inOutCubic) => f(seg(t, a, b));
export const V3 = (x = 0, y = 0, z = 0) => Array.isArray(x) ? new THREE.Vector3(x[0], x[1] ?? 0, x[2] ?? 0) : x?.isVector3 ? x.clone() : new THREE.Vector3(x, y, z);
// seeded random (mulberry32): rnd(seed) -> () => [0, 1)
export function rnd(seed = 1) { let a = (seed * 2654435761) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// smooth deterministic noise 1D (for shake / sway)
export function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, h = n => { const s = Math.sin((n + seed * 57.3) * 127.1) * 43758.5453; return s - Math.floor(s); }; const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u) * 2 - 1; }

// ---------- colours ----------
export const C = {
  // Loaded Dice accents
  felt: '#0f5a2a', feltDark: '#024a1c', dealerRed: '#ab3a27', red: '#e8231d', chipBlue: '#536b9d', gold: '#c69c73', lamp: '#ffcf86',
  money: '#36e24a', loss: '#e8231d', night: '#070408', navy: '#0a192f', ink: '#101014', white: '#ffffff', cream: '#efe6d2',
  // Low Poly Shorts accents
  caption: '#f0f000', sky: '#659dda', skyHaze: '#dcebf9', grass: '#808851', voidPurple: '#4e0170', voidRed: '#440201', teal: '#34808d',
  hazard: '#f2c200', radio: '#3cff3c', skin: '#e0ac8a',
};
const _rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const _lum = h => { const [r, g, b] = _rgb(h).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const _mix = (a, b, k) => '#' + _rgb(a).map((c, i) => Math.round((c + (_rgb(b)[i] - c) * k) * 255).toString(16).padStart(2, '0')).join('');
export const contrast = (a, b) => { const x = _lum(a), y = _lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
export const legibleOn = (c, bg, min = 3) => { const to = contrast('#ffffff', bg) > contrast('#000000', bg) ? '#ffffff' : '#000000';
  for (let k = 0; k <= 1.001; k += .05) { const o = k ? _mix(c, to, Math.min(1, k)) : c; if (contrast(o, bg) >= min) return o; } return to; };
export const textOn = c => contrast('#ffffff', c) >= contrast('#101014', c) ? '#ffffff' : '#101014';
export const mixHex = _mix;
// brand colour (settings.brand.color): callout banners, the brand sting, UI panel frames; unset = the style's own
const _brand = typeof SETTINGS.brand?.color === 'string' && /^#[0-9a-f]{6}$/i.test(SETTINGS.brand.color) ? SETTINGS.brand.color.toLowerCase() : null;
export const BRAND = { on: !!_brand, color: _brand ?? (MOODY ? '#e8231d' : '#f0c000'), ink: textOn(_brand ?? (MOODY ? '#e8231d' : '#f0c000')) };
C.brand = BRAND.color; C.brandInk = BRAND.ink;
export const hex = c => typeof c === 'number' ? c : typeof c === 'string' ? new THREE.Color(c).getHex() : c?.isColor ? c.getHex() : 0xffffff;
export const css = c => typeof c === 'string' ? c : '#' + new THREE.Color(c).getHexString();

// ---------- the 5x7 pixel font (8-bit banners, pixel labels, LED / UI text). Original glyphs. ----------
const G = {
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'], B: ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
  C: [' ### ', '#   #', '#    ', '#    ', '#    ', '#   #', ' ### '], D: ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'], F: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
  G: [' ### ', '#   #', '#    ', '# ###', '#   #', '#   #', ' ####'], H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  I: [' ### ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', ' ### '], J: ['  ###', '   # ', '   # ', '   # ', '   # ', '#  # ', ' ##  '],
  K: ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'], L: ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'], N: ['#   #', '#   #', '##  #', '# # #', '#  ##', '#   #', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '], P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
  Q: [' ### ', '#   #', '#   #', '#   #', '# # #', '#  # ', ' ## #'], R: ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'],
  S: [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '], T: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '], V: ['#   #', '#   #', '#   #', '#   #', '#   #', ' # # ', '  #  '],
  W: ['#   #', '#   #', '#   #', '# # #', '# # #', '# # #', ' # # '], X: ['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #'],
  Y: ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '], Z: ['#####', '    #', '   # ', '  #  ', ' #   ', '#    ', '#####'],
  0: [' ### ', '#   #', '#  ##', '# # #', '##  #', '#   #', ' ### '], 1: ['  #  ', ' ##  ', '  #  ', '  #  ', '  #  ', '  #  ', ' ### '],
  2: [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'], 3: ['#####', '   # ', '  #  ', '   # ', '    #', '#   #', ' ### '],
  4: ['   # ', '  ## ', ' # # ', '#  # ', '#####', '   # ', '   # '], 5: ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
  6: ['  ## ', ' #   ', '#    ', '#### ', '#   #', '#   #', ' ### '], 7: ['#####', '    #', '   # ', '  #  ', ' #   ', ' #   ', ' #   '],
  8: [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '], 9: [' ### ', '#   #', '#   #', ' ####', '    #', '   # ', ' ##  '],
  '.': ['     ', '     ', '     ', '     ', '     ', ' ##  ', ' ##  '], ',': ['     ', '     ', '     ', '     ', ' ##  ', '  #  ', ' #   '],
  ':': ['     ', ' ##  ', ' ##  ', '     ', ' ##  ', ' ##  ', '     '], '!': ['  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '     ', '  #  '],
  '?': [' ### ', '#   #', '    #', '   # ', '  #  ', '     ', '  #  '], '-': ['     ', '     ', '     ', '#####', '     ', '     ', '     '],
  '+': ['     ', '  #  ', '  #  ', '#####', '  #  ', '  #  ', '     '], '=': ['     ', '     ', '#####', '     ', '#####', '     ', '     '],
  '/': ['    #', '    #', '   # ', '  #  ', ' #   ', '#    ', '#    '], '%': ['##   ', '##  #', '   # ', '  #  ', ' #   ', '#  ##', '   ##'],
  "'": ['  #  ', '  #  ', ' #   ', '     ', '     ', '     ', '     '], '"': [' # # ', ' # # ', '     ', '     ', '     ', '     ', '     '],
  '(': ['   # ', '  #  ', ' #   ', ' #   ', ' #   ', '  #  ', '   # '], ')': [' #   ', '  #  ', '   # ', '   # ', '   # ', '  #  ', ' #   '],
  '$': ['  #  ', ' ####', '# #  ', ' ### ', '  # #', '#### ', '  #  '], '#': [' # # ', ' # # ', '#####', ' # # ', '#####', ' # # ', ' # # '],
  '*': ['     ', '# # #', ' ### ', '#####', ' ### ', '# # #', '     '], 'x': ['     ', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '     '],
  '<': ['   # ', '  #  ', ' #   ', '#    ', ' #   ', '  #  ', '   # '], '>': [' #   ', '  #  ', '   # ', '    #', '   # ', '  #  ', ' #   '],
  '€': ['  ###', ' #   ', '#### ', ' #   ', '#### ', ' #   ', '  ###'], '£': ['  ## ', ' #  #', ' #   ', '#### ', ' #   ', ' #   ', '#####'],
  ' ': ['     ', '     ', '     ', '     ', '     ', '     ', '     '],
  // Russian (engine v9): the Cyrillic capitals that are not Latin ones (А В Е К М Н О Р С Т Х are, below; Ё is Е)
  Б: ['#####', '#    ', '#    ', '#### ', '#   #', '#   #', '#### '], Г: ['#####', '#    ', '#    ', '#    ', '#    ', '#    ', '#    '],
  Д: ['  ## ', ' #  #', ' #  #', ' #  #', ' #  #', '#####', '#   #'], Ж: ['# # #', '# # #', ' ### ', '  #  ', ' ### ', '# # #', '# # #'],
  З: [' ### ', '#   #', '    #', '  ## ', '    #', '#   #', ' ### '], И: ['#   #', '#   #', '#  ##', '# # #', '##  #', '#   #', '#   #'],
  Й: [' # # ', '#   #', '#   #', '#  ##', '# # #', '##  #', '#   #'], Л: ['  ###', ' #  #', ' #  #', ' #  #', ' #  #', ' #  #', '#   #'],
  П: ['#####', '#   #', '#   #', '#   #', '#   #', '#   #', '#   #'], У: ['#   #', '#   #', '#   #', ' ####', '    #', '#   #', ' ### '],
  Ф: ['  #  ', ' ### ', '# # #', '# # #', '# # #', ' ### ', '  #  '], Ц: ['#  # ', '#  # ', '#  # ', '#  # ', '#  # ', '#####', '    #'],
  Ч: ['#   #', '#   #', '#   #', ' ####', '    #', '    #', '    #'], Ш: ['# # #', '# # #', '# # #', '# # #', '# # #', '# # #', '#####'],
  Щ: ['# # #', '# # #', '# # #', '# # #', '# # #', '#####', '    #'], Ъ: ['##   ', ' #   ', ' #   ', ' ### ', ' #  #', ' #  #', ' ### '],
  Ы: ['#   #', '#   #', '#   #', '##  #', '# # #', '# # #', '##  #'], Ь: ['#    ', '#    ', '#    ', '#### ', '#   #', '#   #', '#### '],
  Э: [' ### ', '#   #', '    #', ' ####', '    #', '#   #', ' ### '], Ю: ['#  # ', '# # #', '# # #', '### #', '# # #', '# # #', '#  # '],
  Я: [' ####', '#   #', '#   #', ' ####', ' #  #', '#   #', '#   #'],
};
// letters drawn like another: the Cyrillic capitals shaped like Latin ones, and typographic dashes and quotes
for (const [c, as] of Object.entries({ А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', І: 'I', Ј: 'J', Ѕ: 'S', '—': '-', '–': '-', '«': '<', '»': '>' })) G[c] = G[as];
/** Glyph rows of a character in the pixel font (unknown letters: their unaccented form, else '?'). */
export function glyph(ch) {
  if (G[ch]) return G[ch];
  const up = ch.toUpperCase(); if (G[up]) return G[up];
  const base = up.normalize('NFKD').replace(/\p{M}/gu, ''); return G[base] || G['?'];
}
/** Draw text in the pixel font on a 2D context. px = size of one font pixel. Returns the width drawn. */
export function pixelText(x, str, X, Y, px, color = '#fff', { outline = null, shadow = null, align = 'left' } = {}) {
  const chars = [...String(str)], w = (chars.length * 6 - 1) * px;
  let x0 = align === 'center' ? X - w / 2 : align === 'right' ? X - w : X;
  const plot = (col, dx, dy) => { x.fillStyle = col; chars.forEach((ch, ci) => { const g = glyph(ch); for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '#') x.fillRect(Math.round(x0 + (ci * 6 + c) * px + dx), Math.round(Y + r * px + dy), Math.ceil(px), Math.ceil(px)); }); };
  if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) plot(outline, dx * px, dy * px);
  if (shadow) plot(shadow, px, px);
  plot(color, 0, 0);
  return w;
}
export const pixelWidth = (str, px) => ([...String(str)].length * 6 - 1) * px;

// ---------- canvas textures ----------
/** A canvas drawn by fn(ctx, w, h) as a texture. nearest: chunky texels (default for low-res UI on screens). */
export function canvasTex(w, h, fn, { nearest = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); fn(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
  t.minFilter = t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter; t.userData.canvas = c; t.userData.draw = fn;
  return t;
}
/** Re-draw a canvasTex (counters, screens that change). */
export function redraw(t, fn) { const c = t.userData.canvas, x = c.getContext('2d'); (fn || t.userData.draw)(x, c.width, c.height); t.needsUpdate = true; }

// ---------- number formatting in the narration's language ----------
export function fmt(n, o = {}) { try { return new Intl.NumberFormat(globalThis.__CZ_LANG || 'en', o).format(n); } catch { return String(n); } }

// Reconstruction engine: matte clay 3D in a seamless grey studio (Three.js, soft shadows, room-light ambient) under a crisp
// 2D "news desk" overlay (cards, tags, charts, map labels) drawn with canvas text, so type stays sharp at any size.
// Contract with the host: SHOTS, finalizeShots, compose(t) -> outCanvas, cue, loadTimeline, loadImages, exportVideo.
import * as THREE from './vendor/three.module.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from './vendor/jsm/postprocessing/GTAOPass.js';
import { BokehPass } from './vendor/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from './vendor/jsm/postprocessing/ShaderPass.js';
export { THREE };

export const ENGINE_KIND = 'recon';
export const ENGINE_VERSION = 22;
// v22: live preview speed (docs/PREVIEW_PERF.md): figures the shot camera can't see keep their last pose, small figures
//   skip the arm correction (unclip), big pictures are scaled once at load, the 3D image is enlarged with plain filtering;
//   shots build 3-4x faster (per body caches in lib/figures.js, box() copies a made geometry). Exports draw the same.
// v21: your own characters keep their OWN proportions (lib/customchar.js: the figure's skeleton takes the character's
//   joints; clips retargeted rest-relative, the hips by its legs; proportionCheck) - before, the mesh was stretched onto
//   the mannequin's skeleton (long necks, sheared shirts)
// v20: settings.badge (default off): the "RECONSTRUCTION" corner tag is drawn only when it is true
// v16: THEMES[id].outdoor (maps and exteriors: the region map's palette and light, the sky and sun per time of day) for
//   lib/maps.js (regionMap, marker, strikeArc) and lib/exterior.js (horizon, apron, terminal, restOnGround, vehicles)
// v9: applyGraphics / getGraphics (the editor's Graphics panel, settings.graphics; see GRAPHICS below)
// settings: project.json "settings" inside the Suite (the look), or the defaults standalone
// theme (v7): 'studio' (default: matte clay in the bright grey studio) | 'investigation' (dark true-crime documentary:
// near-black rooms, one cool key, glossy porcelain mannequins, shallow focus, desaturated grade with capped highlights)
export const DEFAULTS = { quality: { ss: 2 }, post: { grain: .014, vignette: .07, ao: true } };
const merge = (a, b) => { const o = { ...a }; for (const k in b || {}) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; };
export const SETTINGS = merge(DEFAULTS, globalThis.__CZ_SETTINGS || {});

// ---------- themes (v7) ----------
// THEMES[id]: everything a look changes in the 3D and the frame. Studio holds exactly the values the engine always had
// (a Studio project renders pixel-identical to v6). Scenes read THEME (the active one); lib code may read any key.
//   pal: palette overrides (C keys) | bg, fog, floor: the room | hemi [sky, ground, intensity], key [colour, intensity],
//   rim [colour, intensity] | null (a cool back light for the specular streak on glossy heads) | env: environment
//   reflections | exposure: tone-mapping exposure | fov: default camera fov | post: per-shot S.post defaults (ao, dof, bloom)
//   grade: the finishing pass (null = the Studio pass): contrast, pivot, desat, cap (highlight ceiling 0-1), knee, crush
//   (shadow crush 0-1), lift (faded blacks), tint [r,g,b] in the shadows, vig [inner, outer, roundness], ca (colour fringe)
//   figure: the mannequin material { color, joint, rough, coat } (null = matte clay) | prop: MAT.clay / clay2 / clay3 colours
//   tag: the corner badge { text, style: 'card' | 'small' | null }, drawn only with settings.badge === true (v20) | ov: text colours of overlays drawn straight on the 3D
export const THEMES = {
  studio: {
    pal: {}, bg: 0xdadad6, env: .3, exposure: 1, fov: 32, rim: null,
    hemi: [0xffffff, 0xb4b3ad, 1], hemiInterior: [0xffffff, 0xe4e2dc, .8], key: [0xfffcf6, 1], lamp: 0xfff8ee,
    floor: { color: null, rough: 1 }, post: { ao: .5, dof: null, bloom: 0 }, grade: null, figure: null, prop: null,
    tag: { text: 'RECONSTRUCTION', style: 'card' },
    // v16 outdoor: map = the region map (tex 'light' | 'dark', bg, sun [colour, intensity, elevation deg], hemi [sky, ground,
    // intensity], roof / wall of standing buildings, accent of markers and arcs); sky[time] = [top, horizon, ground];
    // sun[time] = [colour, intensity, elevation deg]; haze[time] = the far horizon's colour (fog and far silhouettes)
    outdoor: { map: { tex: 'light', bg: 0xdadad6, sun: [0xfff4e6, 2.6, 24], hemi: [0xffffff, 0xb4b3ad, .9], roof: 0xeceae4, wall: 0x9aa4ad, accent: 0xd0342c },
      sky: { day: ['#a3bfd8', '#e4e8ea', '#cfcdc6'], afternoon: ['#b2c1cd', '#e9dfcd', '#cdc5b6'], dusk: ['#5a6d8a', '#e2b58f', '#8a7c6e'], night: ['#0c1321', '#28324a', '#17191f'] },
      sun: { day: [0xfffaf0, 2.8, 55], afternoon: [0xffe4c0, 2.6, 26], dusk: [0xffae78, 1.9, 7], night: [0x9fb4e0, .55, 40] },
      haze: { day: '#dfe3e5', afternoon: '#e2d8c6', dusk: '#c9a184', night: '#202838' } },
    ov: { text: '#16181b', sub: '#2f3438', src: '#3d4247', headSub: '#4f5459', chapterSub: '#5b6066', label: '#55595e',
      shadow: { color: '0,0,0', a: .3, blur: 10, y: 2, contact: .18, strong: { a: .4, blur: 14, y: 3 } } },
    broll: { lift: .045, cap: .80, desat: .15, grain: .02, vignette: .25, contrast: .95 },
  },
  investigation: {
    pal: { bg: '#07080a', bgHex: 0x07080a, clay: 0xe8ebee, clay2: 0x5d6166, clay3: 0x3a3d42, dark: 0x0d0e10, glass: 0x1a1f26, blue: 0x3c5a86, water: 0x2a3540,
      ink: '#0e1013', grey: '#4f5457', card: '#c8cbcb', accent: '#d30007', red: '#c00014', line: '#3a3d40' },
    bg: 0x07080a, env: .12, exposure: 1, fov: 30, rim: [0xa9c0e0, 1.5],
    hemi: [0x8496ac, 0x050506, .3], hemiInterior: [0x8496ac, 0x101114, .26], key: [0xe6edf5, .62], lamp: 0xffe2bd,
    floor: { color: 0x24272b, rough: .5 }, post: { ao: .5, dof: { focus: 'look', aperture: .0045, maxblur: .012 }, bloom: .14 }, bloomAt: .86,
    grade: { contrast: 1.18, pivot: .32, desat: .55, cap: .9, knee: .72, crush: .035, lift: 0, tint: [-.004, .001, .009], vig: [.06, .62, 1.25], ca: .0035 },
    figure: { color: 0xe8ebee, joint: 0xb9bdc2, rough: .3, coat: 1 },
    prop: [0x6a6e74, 0x4b4f55, 0x2e3136],
    tag: { text: 'RECONSTRUCTION', style: 'small' },
    // v16 outdoor: a dark mood that still reads: the dark map (light roads and runways), a low warm raking sun on the relief,
    // skies a few stops under the Studio's but never black at the horizon (silhouettes need a lighter band behind them)
    outdoor: { map: { tex: 'dark', bg: 0x07080a, sun: [0xffdcb4, 4.4, 22], hemi: [0x8496ac, 0x1a1c20, 1.2], roof: 0xaeb2b7, wall: 0x2c3138, accent: 0xd30007 },
      sky: { day: ['#2a3746', '#8a949b', '#34373a'], afternoon: ['#262f3a', '#a08f7b', '#3a3732'], dusk: ['#101826', '#7a5c47', '#221f1c'], night: ['#04060a', '#182030', '#0b0c0e'] },
      sun: { day: [0xe6edf5, 1.9, 50], afternoon: [0xffd6a8, 2.1, 24], dusk: [0xff9e68, 1.6, 7], night: [0x8fa6d6, .5, 40] },
      haze: { day: '#6f777d', afternoon: '#7d7163', dusk: '#5a4536', night: '#151b26' } },
    ov: { text: '#e1e7e7', sub: '#a7aeb1', src: '#a7aeb1', headSub: '#b9c0c2', chapterSub: '#b9c0c2', label: '#4a4e52',
      shadow: { color: '0,0,0', a: .5, blur: 10, y: 2, contact: .3, strong: { a: .6, blur: 14, y: 3 } } },
    broll: { lift: .055, cap: .775, desat: .25, grain: .035, vignette: .38, contrast: .92 },
  },
};
export const THEME_ID = SETTINGS.theme === 'investigation' ? 'investigation' : 'studio';
export const THEME = THEMES[THEME_ID];
// ROOT: prefix for project files fetched by code (maps, models, textures). The Suite's host page is <project>/host/host.html.
export const ROOT = /\/host\.html$/.test(globalThis.location?.pathname || '') ? '../' : '';
// FORMAT (v14): settings.format 'vertical' = 1080x1920 (shorts), anything else = 1920x1080 (every project before v14).
export const VERT = SETTINGS.format === 'vertical';
export const FW = VERT ? 1080 : 1920, FH = VERT ? 1920 : 1080, W = FW, H = FH, AW = FW, AH = FH;
// Scenes give fov as the vertical FOV of a 16:9 frame. In 9:16 the lens is widened so the portrait frame is that 16:9
// frame turned on its side: its height spans what the 16:9 width did and its width what the 16:9 height did, so the
// centre square of a horizontal framing is always in the picture (plus more above and below). cam.fov keeps the
// scene's value; only the projection uses the wider lens.
// PORTRAIT_ZOOM: the full side-on turn (16/9) left big empty bands of floor and ceiling and small subjects in the first
// real vertical build; 1.45 keeps ~82% of that centre square across and shows subjects ~23% larger.
const PORTRAIT_ZOOM = 1.45;
// OV_SAFE (v14): the margins overlays keep. Vertical shorts are watched under the platform's own buttons and captions (top
// ~10%, bottom ~20%, a column on the right), so the default overlay places sit inside that; 16:9 keeps its old places.
export const OV_SAFE = VERT ? { t: 190, b: 400, l: 60, r: 60 } : { t: 40, b: 40, l: 40, r: 40 };
export const portraitFov = f => VERT ? 2 * Math.atan(Math.tan(f * Math.PI / 360) * PORTRAIT_ZOOM) * 180 / Math.PI : f;
const fitLens = cam => { if (!VERT) return cam; const up = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
  cam.updateProjectionMatrix = function () { const f = this.fov; this.fov = portraitFov(f); up.call(this); this.fov = f; }; cam.updateProjectionMatrix(); return cam; };
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const E = {
  lin: k => k, inOut: k => k * k * (3 - 2 * k), inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2,
  outCubic: k => 1 - Math.pow(1 - k, 3), inCubic: k => k * k * k, outQuart: k => 1 - Math.pow(1 - k, 4),
  inOutCubic: k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outBack: (k, s = 1.4) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),
};
export const ease = (t, a, b, f = E.inOutCubic) => f(seg(t, a, b));
// ---------- text shadow (the one shadow every overlay text gets) ----------
// Text never gets a coloured glow: a soft neutral drop shadow (THEME.ov.shadow: dark, ~0.5 alpha, 10-14 px blur, 2-3 px
// down) plus a tight contact shadow for legibility on bright footage. textShadow(ctx, s, X, Y, { level: 'soft' | 'strong' })
// draws only the shadow passes with the context's current font/align (the glyphs go far off-canvas, only their shadow lands,
// so a translucent fill never doubles); drawText(ctx, s, X, Y, { font, align, base, ls, color, level, shadow: false }) =
// shadow + the clean text. Both respect globalAlpha and the context transform.
const SHADOW_OFF = 20000;
export function textShadow(x, s, X, Y, o = {}) {
  const T = THEME.ov.shadow, L = o.level === 'strong' ? { ...T, ...T.strong } : T, col = o.color ?? T.color, m = x.getTransform();
  x.save(); x.fillStyle = '#000';
  for (const [a, b, dy] of [[T.contact, 2, 1], [L.a, L.blur, L.y]]) { if (!(a > 0)) continue;
    x.shadowColor = `rgba(${col},${a})`; x.shadowBlur = b; x.shadowOffsetX = m.a * SHADOW_OFF; x.shadowOffsetY = m.b * SHADOW_OFF + dy; x.fillText(s, X - SHADOW_OFF, Y); }
  x.restore();
}
export function drawText(x, s, X, Y, o = {}) {
  x.save(); if (o.font) x.font = o.font; if (o.ls != null) x.letterSpacing = o.ls; if (o.align) x.textAlign = o.align; if (o.base) x.textBaseline = o.base;
  if (o.shadow !== false) textShadow(x, s, X, Y, o);
  x.shadowBlur = 0; x.shadowColor = 'transparent'; x.fillStyle = o.color ?? THEME.ov.text; x.fillText(s, X, Y); x.restore();
}

// ---------- palette ----------
export const C = {
  bg: '#dadad6', bgHex: 0xdadad6, clay: 0xf2f1ee, clay2: 0xdcdbd6, clay3: 0xbdbcb6, dark: 0x25282c, glass: 0x3a4048,
  blue: 0x7fa6e6, water: 0xa9b8c4,
  ink: '#16181b', grey: '#5d636a', card: '#f8f8f6', accent: '#2f6fd6', red: '#d23b3b', line: '#c9c9c5',
  // v7 (both themes have them): text on the dark, paper greys, highlighters, crimson accents of the Investigation kit
  text: '#e1e7e7', paper: '#c8cbcb', paper2: '#8e9090', type: '#2b2b2b', hl: '#e6d63a', hl2: '#d6e21a',
  crimson: '#d30007', wave: '#e0306e', dot: '#c00014', glow: '#26000a',
};
Object.assign(C, THEME.pal);
// ---------- brand colour (v6) ----------
// settings.brand.color ('#rrggbb', the Suite's "Brand colour" look setting); unset = the style's blue. Set, C.accent (chapter
// kickers, the timecard bar, callouts, route lines, place dots, quote marks) is the brand colour moved just enough to read
// on the white cards; BRAND.onDark is the same for dark cards, BRAND.ink the text on an accent fill, BRAND.soft the
// quote highlight. contrast / legibleOn / textOn: WCAG helpers for scenes.
const _rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const _lum = h => { const [r, g, b] = _rgb(h).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const _mix = (a, b, k) => '#' + _rgb(a).map((c, i) => Math.round((c + (_rgb(b)[i] - c) * k) * 255).toString(16).padStart(2, '0')).join('');
export const contrast = (a, b) => { const x = _lum(a), y = _lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
export const legibleOn = (c, bg, min = 3) => { const to = contrast('#ffffff', bg) > contrast('#000000', bg) ? '#ffffff' : '#000000';
  for (let k = 0; k <= 1.001; k += .05) { const o = k ? _mix(c, to, Math.min(1, k)) : c; if (contrast(o, bg) >= min) return o; } return to; };
export const textOn = c => contrast('#ffffff', c) >= contrast('#16181b', c) ? '#ffffff' : '#16181b';
const _brand = typeof SETTINGS.brand?.color === 'string' && /^#[0-9a-f]{6}$/i.test(SETTINGS.brand.color) ? SETTINGS.brand.color.toLowerCase() : null;
if (_brand) C.accent = legibleOn(_brand, C.card, 3);
const _inv = THEME_ID === 'investigation';   // unbranded Investigation: crimson on dark, highlighter yellow behind quoted words
export const BRAND = { on: !!_brand, color: _brand ?? C.accent, accent: C.accent, ink: _brand ? textOn(C.accent) : '#fff', onDark: _brand ? legibleOn(_brand, C.ink, 3) : _inv ? '#ff4b52' : '#7fa7ec',
  soft: _brand ? `rgba(${_rgb(C.accent).map(c => Math.round(c * 255)).join(',')},.22)` : _inv ? 'rgba(230,214,58,.62)' : 'rgba(47,111,214,.22)' };
export const MAT = {
  clay: new THREE.MeshStandardMaterial({ color: C.clay, roughness: .88 }),
  clay2: new THREE.MeshStandardMaterial({ color: C.clay2, roughness: .9 }),
  clay3: new THREE.MeshStandardMaterial({ color: C.clay3, roughness: .9 }),
  dark: new THREE.MeshStandardMaterial({ color: C.dark, roughness: .45 }),
  glass: new THREE.MeshStandardMaterial({ color: C.glass, roughness: .2, metalness: .1 }),
  blue: new THREE.MeshStandardMaterial({ color: C.blue, roughness: .85 }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .88 }),     // instanced crowds tint per instance
  shadow: new THREE.ShadowMaterial({ opacity: .16 }),
};
// v7 theme materials: props take the theme's clay greys; the mannequin (MAT.white, tinted per person) becomes glossy
// porcelain with a clear coat, its joint balls MAT.joint (swapped in for models.js' own joint material when a shot is built,
// so projects keep their models.js on "Update engine")
if (THEME.prop) [MAT.clay, MAT.clay2, MAT.clay3].forEach((m, i) => { m.color.setHex(THEME.prop[i]); m.roughness = .72; });
if (THEME.figure) {
  const f = THEME.figure;
  MAT.white = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: f.rough, clearcoat: f.coat, clearcoatRoughness: .12, metalness: 0 });
  MAT.joint = new THREE.MeshPhysicalMaterial({ color: f.joint, roughness: f.rough + .08, clearcoat: f.coat * .7, clearcoatRoughness: .2, metalness: 0 });
}

// ---------- timeline / cue ----------
let WORDS = [];
const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
export async function loadTimeline(url) {
  const P = await (await fetch(url)).json();
  WORDS = P.flatMap(p => p.words.map(w => ({ ...w, n: norm(w.w) })));
}
export function cue(word, near, which = 's') {
  const parts = word.split(' ').map(norm); let best = null, bd = 1e9;
  for (let i = 0; i < WORDS.length; i++) {
    if (!parts.every((p, k) => WORDS[i + k] && WORDS[i + k].n.startsWith(p))) continue;
    const d = Math.abs(WORDS[i].s - near); if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[i + parts.length - 1].e; }
  }
  if (best === null && parts.length === 1 && parts[0]) best = cueAcross(parts[0], near, which, (b, d) => { bd = d; return b; });
  if (best === null || bd > 12) { console.warn('cue miss', word, near); return near; }
  return best;
}
// a cue in a language written without spaces (Japanese, Chinese, Thai) may span several timed words ("東京タワー" is timed as
// "東京" + "タワー"): the words' letters are joined until they hold it (v5)
function cueAcross(p, near, which, set) {
  let best = null, bd = 1e9;
  for (let i = 0; i < WORDS.length; i++) {
    let s = '', k = i; while (k < WORDS.length && s.length < p.length) s += WORDS[k++].n;
    if (!s.startsWith(p)) continue;
    const d = Math.abs(WORDS[i].s - near); if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[k - 1].e; }
  }
  return best === null ? null : set(best, bd);
}
export const IMG = {};
// Live preview: a picture far bigger than the frame (real maps and photos often come 4000-8000 px wide) is scaled down
// ONCE here, to at most PREVIEW_IMG px on its long side. Drawn from full size, every frame of its shot re-scaled millions
// of pixels: on the processor (Safe display, Software graphics, many laptops) a map shot alone took 60-110 ms a frame.
// Exports, stills and Claude's frames keep the original. (A canvas works wherever the picture did: drawImage, textures.)
const PREVIEW_IMG = 2560;
function previewSized(im) {
  if (globalThis.__CZ_MODE !== 'preview' || Math.max(im.width, im.height) <= PREVIEW_IMG) return im;
  const k = PREVIEW_IMG / Math.max(im.width, im.height), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
  const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, c.width, c.height);
  return c;
}
export async function loadImages(map) {
  await Promise.all(Object.entries(map).map(([k, src]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = previewSized(im); res(); }; im.onerror = () => res(); im.src = src; })));
}

// ---------- renderer ----------
export const glCanvas = document.createElement('canvas');
export const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
// supersampling: the 3D image renders at SS x the output size and is averaged down (kills sub-pixel shimmer on dense
// geometry like a city seen from the air; MSAA alone does not). The 2D overlay is drawn at output size.
// (v9: Graphics > Export quality's supersampling wins outside the live preview; the preview gets its scale from the host)
export const SS = +(new URLSearchParams(globalThis.location?.search || '').get('ss') || (globalThis.__CZ_MODE !== 'preview' && SETTINGS.graphics?.exportSs) || SETTINGS.quality?.ss || 2);
let RW = FW * SS, RH = FH * SS;   // (v9: Graphics > Render scale resizes the preview's 3D image live)
renderer.setPixelRatio(1); renderer.setSize(RW, RH, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = THEME.exposure;
export const outCanvas = document.createElement('canvas'); outCanvas.width = FW; outCanvas.height = FH;
const out = outCanvas.getContext('2d');
const ovCanvas = document.createElement('canvas'); ovCanvas.width = FW; ovCanvas.height = FH;
const ov = ovCanvas.getContext('2d');
const ENV = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;

// ---------- post: ambient occlusion -> depth of field -> bloom -> tone map -> grade (one chain, each shot plugs in) ----------
// S.post = { ao: radius in scene units (0 = off), dof: { focus: number | fn(t, S) | 'look', aperture, maxblur } | null, bloom }
const GRADE = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: SETTINGS.post?.grain ?? .014 }, vig: { value: SETTINGS.post?.vignette ?? .07 }, ca: { value: 0 }, res: { value: new THREE.Vector2(RW, RH) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, grain, vig, ca; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - .5; float r2 = dot(d, d);
      // lens: a touch of radial chromatic aberration toward the corners
      vec3 c = vec3(texture2D(tDiffuse, vUv - d * ca * r2 * 4.).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d * ca * r2 * 4.).b);
      // grade: cool shadows, warm highlights, gentle filmic S-curve, slightly richer colour
      float l = dot(c, vec3(.299, .587, .114));
      // high key: a whisper of cool in the shadows, nothing else (the reference look is clean and neutral)
      c += vec3(-.004, -.001, .006) * (1. - smoothstep(.2, .7, l));
      // vignette (soft, darker corners) and luminance-aware film grain
      c *= 1. - vig * smoothstep(.12, .62, r2 * 1.6);
      float g = h(vUv * res + fract(time * 13.7) * 91.) - .5; c += g * grain * (1. - .6 * l);
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
    }` };
// v7: a theme with a `grade` gets the documentary finish instead (the Studio shader above stays byte-identical):
// colour fringe -> desaturate -> contrast around a low pivot -> shadow crush + cool tint -> soft highlight cap -> oval
// vignette -> grain. The cap keeps whites milky (~198/255), the crush gives true blacks.
if (THEME.grade) {
  // the look's settings.post may tune it: contrast (1 = none), desat (0-1), cap (highlight ceiling 0-1), ca (colour fringe)
  const P = SETTINGS.post || {}, num = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? clamp(v, a, b) : d);
  const g = { ...THEME.grade, contrast: num(P.contrast, .8, 1.5, THEME.grade.contrast), desat: num(P.desat, 0, 1, THEME.grade.desat), cap: num(P.cap, .6, 1, THEME.grade.cap), ca: num(P.ca, 0, .02, THEME.grade.ca) };
  g.knee = Math.min(g.knee, g.cap - .05);
  GRADE.uniforms.ca.value = g.ca ?? 0;
  Object.assign(GRADE.uniforms, { contrast: { value: g.contrast }, pivot: { value: g.pivot }, desat: { value: g.desat }, cap: { value: g.cap }, knee: { value: g.knee },
    crush: { value: g.crush }, lift: { value: g.lift ?? 0 }, tint: { value: new THREE.Vector3(...g.tint) }, vshape: { value: new THREE.Vector3(...g.vig) } });
  GRADE.fragmentShader = `uniform sampler2D tDiffuse; uniform float time, grain, vig, ca, contrast, pivot, desat, cap, knee, crush, lift; uniform vec3 tint, vshape; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float soft(float x){ return x < knee ? x : knee + (cap - knee) * (1. - exp(-(x - knee) / max(cap - knee, 1e-3))); }
    void main(){
      vec2 d = vUv - .5; float r2 = dot(d, d);
      vec3 c = vec3(texture2D(tDiffuse, vUv - d * ca * r2 * 4.).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d * ca * r2 * 4.).b);
      float l = dot(c, vec3(.299, .587, .114));
      c = mix(c, vec3(l), desat);
      c = max((c - pivot) * contrast + pivot, 0.);
      c = max(c - crush, 0.) / (1. - crush);
      l = dot(c, vec3(.299, .587, .114));
      c += tint * (1. - smoothstep(.05, .55, l));
      c = vec3(soft(c.r), soft(c.g), soft(c.b));
      c = lift + c * (1. - lift);
      vec2 e = d * vec2(vshape.z, 1.); float v = smoothstep(vshape.x, vshape.y, dot(e, e) * 2.2);
      c *= 1. - vig * v;
      float n = h(vUv * res + fract(time * 13.7) * 91.) - .5; c += n * grain * (1. - .5 * l);
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
    }`;
}
const POST = (() => {
  const rt = new THREE.WebGLRenderTarget(RW, RH, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(RW, RH);
  const dummyS = new THREE.Scene(), dummyC = new THREE.PerspectiveCamera();
  const rp = new RenderPass(dummyS, dummyC), ao = new GTAOPass(dummyS, dummyC, RW, RH), dof = new BokehPass(dummyS, dummyC, { focus: 10, aperture: .002, maxblur: .008 });
  const bloom = new UnrealBloomPass(new THREE.Vector2(RW, RH), .18, .55, .86), out = new OutputPass(), grade = new ShaderPass(GRADE);
  ao.blendIntensity = 1.0;
  for (const p of [rp, ao, dof, bloom, out, grade]) composer.addPass(p);
  if (THEME.bloomAt != null) bloom.threshold = THEME.bloomAt;
  return { composer, rp, ao, dof, bloom, grade };
})();
let POST_ON = true;
export const setPost = on => { POST_ON = on; };
let AO_ON = SETTINGS.post?.ao !== false; export const setAO = on => { AO_ON = on; };
export const setShadows = on => { renderer.shadowMap.enabled = on; };

// ---------- v9 GRAPHICS: the editor's Graphics panel (project.json settings.graphics, applied live) ----------
// applyGraphics(partial) / getGraphics(): switches over the whole engine (render scale, shadows, AO, depth of field, bloom,
// anti-aliasing, tone mapping, exposure, lens, fog, room light, grain / vignette / colour fringe, sharpen, colour grade,
// export supersampling / bitrate / motion blur). An absent key = what the look and the scenes say; null in a partial
// removes the key. Scenes must not set or fight these (the user's choice wins). Preview-only keys (scale, lite) are
// ignored outside the live preview, so everything else renders the same in the preview and in an export.
export const PREVIEW = globalThis.__CZ_MODE === 'preview';
const GFX_NUM = { scale: [.25, 2, 1], exposure: [-2, 2, 0], fovScale: [.6, 1.5, 1], aoStrength: [0, 2, 1], aoRadius: [.25, 3, 1], fog: [0, 3, 1], env: [0, 3, 1],
  dofStrength: [0, 3, 1], dofFocus: [-5, 5, 0], bloomStrength: [0, 1.5, null], bloomThreshold: [0, 1, null], grain: [0, .15, null], vignette: [0, .8, null], ca: [0, .02, null],
  sharpen: [0, 1, 0], contrast: [.5, 1.6, 1], saturation: [0, 2, 1], cap: [.6, 1, 1], lift: [-.1, .2, 0], gamma: [.5, 2, 1], gain: [.5, 1.6, 1], warmth: [-1, 1, 0], tint: [-1, 1, 0] };
const GFX_SEL = { toneMap: ['neutral', 'aces', 'agx', 'none'], aa: ['msaa', 'msaa8', 'fxaa', 'msaa-fxaa', 'off'], dof: ['look', 'on', 'off'], bloom: ['look', 'on', 'off'],
  shadowSize: [512, 1024, 2048, 4096], exportSs: [1, 1.5, 2, 3], exportBitrate: ['standard', 'high', 'max'], exportSamples: [1, 2, 4, 8] };
const GFX_DEF = { toneMap: 'neutral', aa: 'msaa', dof: 'look', bloom: 'look', shadowSize: null, exportSs: null, exportBitrate: 'standard', exportSamples: 1, lite: false, shadows: true, shadowSoft: true, ao: true };
const GFX_BOOL = ['lite', 'shadows', 'shadowSoft', 'ao'];
export const GRAPHICS_KEYS = [...Object.keys(GFX_NUM), ...Object.keys(GFX_SEL), ...GFX_BOOL];
function gfxClean(g) {
  const o = {};
  for (const [k, v] of Object.entries(g && typeof g === 'object' ? g : {})) {
    if (v === null || v === undefined) continue;
    if (GFX_NUM[k]) { if (typeof v === 'number' && isFinite(v)) o[k] = clamp(v, GFX_NUM[k][0], GFX_NUM[k][1]); }
    else if (GFX_SEL[k]) { if (GFX_SEL[k].includes(v)) o[k] = v; }
    else if (GFX_BOOL.includes(k) && typeof v === 'boolean') o[k] = v;
  }
  return o;
}
let GFX = gfxClean(SETTINGS.graphics), GSTAMP = Object.keys(GFX).length ? 1 : 0;   // 0: no graphics at all (v8 frames, byte for byte)
const gv = k => GFX[k] ?? (k in GFX_DEF ? GFX_DEF[k] : GFX_NUM[k]?.[2] ?? null);
const LITE = () => PREVIEW && gv('lite');
const G0 = { exposure: THEME.exposure, bloomAt: POST.bloom.threshold, grain: POST.grade.uniforms.grain.value, vig: POST.grade.uniforms.vig.value, ca: POST.grade.uniforms.ca.value };
// FINISH: FXAA -> sharpen -> gain / lift / gamma -> saturation -> contrast -> temperature / tint -> soft highlight cap, before
// the look's own grade (its grain and vignette stay on top). Off (not even run) while every one of them is neutral.
const FINISH = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, px: { value: new THREE.Vector2(1 / RW, 1 / RH) }, fxaa: { value: 0 }, sharpen: { value: 0 }, contrast: { value: 1 }, sat: { value: 1 },
    cap: { value: 1 }, lift: { value: 0 }, gamma: { value: 1 }, gain: { value: 1 }, warmth: { value: 0 }, tintg: { value: 0 } },
  vertexShader: GRADE.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 px; uniform float fxaa, sharpen, contrast, sat, cap, lift, gamma, gain, warmth, tintg; varying vec2 vUv;
    vec3 tx(vec2 o){ return texture2D(tDiffuse, vUv + o * px).rgb; }
    float lu(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
    void main(){
      vec3 c = tx(vec2(0.));
      if (fxaa > .5) {
        vec3 a = tx(vec2(-1., -1.)), b = tx(vec2(1., -1.)), d = tx(vec2(-1., 1.)), e = tx(vec2(1., 1.));
        float la = lu(a), lb = lu(b), ld = lu(d), le = lu(e), lm = lu(c);
        float mn = min(lm, min(min(la, lb), min(ld, le))), mx = max(lm, max(max(la, lb), max(ld, le)));
        vec2 dir = vec2(-((la + lb) - (ld + le)), (la + ld) - (lb + le));
        float rd = max((la + lb + ld + le) * .03125, .0078125), rc = 1. / (min(abs(dir.x), abs(dir.y)) + rd);
        dir = clamp(dir * rc, -8., 8.);
        vec3 r1 = .5 * (tx(dir * (1. / 3. - .5)) + tx(dir * (2. / 3. - .5)));
        vec3 r2 = r1 * .5 + .25 * (tx(dir * -.5) + tx(dir * .5));
        float l2 = lu(r2); c = (l2 < mn || l2 > mx) ? r1 : r2;
      }
      if (sharpen > 0.) { vec3 bl = (tx(vec2(1., 0.)) + tx(vec2(-1., 0.)) + tx(vec2(0., 1.)) + tx(vec2(0., -1.))) * .25; c = max(c + (c - bl) * sharpen * 2., 0.); }
      c *= gain;
      c = lift + c * (1. - lift);
      c = pow(max(c, 0.), vec3(1. / gamma));
      c = mix(vec3(lu(c)), c, sat);
      c = max((c - .5) * contrast + .5, 0.);
      c += vec3(.07, .01, -.08) * warmth + vec3(-.02, .05, -.02) * tintg;
      if (cap < .999) { float k = cap - .15; vec3 s = k + (cap - k) * (1. - exp(-(c - k) / (cap - k))); c = mix(c, s, step(k, c)); }
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
    }` });
FINISH.enabled = false; POST.composer.insertPass(FINISH, POST.composer.passes.indexOf(POST.grade)); POST.finish = FINISH;
// the renderer, the passes and the grade from GFX (called once at start when the project has graphics, and on every change)
let SHADOW_SIG = `${renderer.shadowMap.enabled}:${renderer.shadowMap.type}`, SHADOW_N = 0;
function gfxRenderer() {
  const lite = LITE(), k = PREVIEW ? gv('scale') : 1, w = Math.max(320, Math.round(FW * SS * k)), h = Math.max(180, Math.round(FH * SS * k));
  if (w !== RW || h !== RH) { RW = w; RH = h; renderer.setSize(RW, RH, false); POST.composer.setSize(RW, RH); POST.grade.uniforms.res.value.set(RW, RH); }
  const aa = lite ? 'off' : gv('aa'), samples = aa === 'msaa8' ? 8 : aa === 'msaa' || aa === 'msaa-fxaa' ? 4 : 0;
  for (const rt of [POST.composer.renderTarget1, POST.composer.renderTarget2]) if (rt.samples !== samples) { rt.samples = samples; rt.dispose(); }
  renderer.shadowMap.enabled = gv('shadows');
  const st = gv('shadowSoft') && !lite ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; if (renderer.shadowMap.type !== st) { renderer.shadowMap.type = st; renderer.shadowMap.needsUpdate = true; }
  const sig = `${renderer.shadowMap.enabled}:${renderer.shadowMap.type}`; if (sig !== SHADOW_SIG) { SHADOW_SIG = sig; SHADOW_N++; }   // materials recompile (gfxStep)
  renderer.toneMapping = { neutral: THREE.NeutralToneMapping, aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, none: THREE.NoToneMapping }[gv('toneMap')];
  renderer.toneMappingExposure = G0.exposure * Math.pow(2, gv('exposure'));
  POST.ao.blendIntensity = gv('aoStrength');
  POST.bloom.threshold = gv('bloomThreshold') ?? G0.bloomAt;
  const U = POST.grade.uniforms; U.grain.value = gv('grain') ?? G0.grain; U.vig.value = gv('vignette') ?? G0.vig; U.ca.value = gv('ca') ?? G0.ca;
  const F = FINISH.uniforms; F.px.value.set(1 / RW, 1 / RH); F.fxaa.value = aa === 'fxaa' || aa === 'msaa-fxaa' ? 1 : 0;
  for (const [u, key] of [['sharpen', 'sharpen'], ['contrast', 'contrast'], ['sat', 'saturation'], ['cap', 'cap'], ['lift', 'lift'], ['gamma', 'gamma'], ['gain', 'gain'], ['warmth', 'warmth'], ['tintg', 'tint']]) F[u].value = gv(key);
  FINISH.enabled = F.fxaa.value > 0 || ['sharpen', 'contrast', 'saturation', 'cap', 'lift', 'gamma', 'gain', 'warmth', 'tint'].some(key => gv(key) !== GFX_NUM[key][2]);
}
if (GSTAMP) gfxRenderer();
// a shot's S.post as the graphics change it (render3d)
function gfxPost(o) {
  if (!GSTAMP) return o;
  const lite = LITE(), r = { ...o };
  r.ao = !gv('ao') || lite ? 0 : (o.ao || 0) * gv('aoRadius');
  const dm = gv('dof'); let d = dm === 'off' || lite ? null : dm === 'on' ? (o.dof || { focus: 'look', aperture: .003, maxblur: .01 }) : o.dof;
  if (d) {
    const k = gv('dofStrength'), off = gv('dofFocus'), f = d.focus;
    d = { ...d, aperture: (d.aperture ?? .0015) * k, maxblur: (d.maxblur ?? .006) * clamp(k, .5, 2) };
    if (off) d.focus = (t, S) => Math.max(.05, (typeof f === 'function' ? f(t, S) : typeof f === 'number' ? f : S.cam.position.distanceTo(S.look)) + off);
    if (!(d.aperture > 0)) d = null;
  }
  r.dof = d;
  const bm = gv('bloom'), bs = gv('bloomStrength');
  r.bloom = bm === 'off' || lite ? 0 : bm === 'on' ? (bs ?? (o.bloom > 0 ? o.bloom : .25)) : o.bloom > 0 && bs != null ? bs : o.bloom;
  return r;
}
// per shot (step): the lens every frame, the scene once per change (room light, fog, shadow map size)
// v10 live preview speed: shadow maps capped per shot (key 2048, spot 1024, point 512 - a point light renders 6 maps), soft
// shadow blur halved. Preview only: stills, checks and exports keep the full sizes. Graphics > Shadow detail still wins.
function previewCaps(S) {
  if (!PREVIEW || S._pvCap || gv('shadowSize') != null) return; S._pvCap = 1;
  S.scene.traverse(o => { if (!o.isLight || !o.castShadow || !o.shadow) return;
    const n = Math.min(o.shadow.mapSize.x, o.isPointLight ? 512 : o.isSpotLight ? 1024 : 2048);
    if (o.shadow.mapSize.x !== n) { o.userData.map0 ??= o.shadow.mapSize.x; o.shadow.mapSize.set(n, n); o.shadow.map?.dispose(); o.shadow.map = null; }
    if (o.shadow.blurSamples > 8) o.shadow.blurSamples = 8; });
}
function gfxStep(S) {
  previewCaps(S);
  const c = S.cam, u = c.userData, k = gv('fovScale');
  if (k !== 1 || u.gk) { if (c.fov !== u.gfov) u.gb = c.fov; const f = u.gb * k; if (c.fov !== f) { c.fov = f; c.updateProjectionMatrix(); } u.gfov = f; u.gk = k !== 1; }
  if ((S._gs ?? 0) === GSTAMP) return; S._gs = GSTAMP;
  const sc = S.scene, d = sc.userData;
  // shadows switched on / off or soft / hard: three.js keeps compiled shaders until a material says it changed
  if ((S._gsh ?? 0) !== SHADOW_N) { S._gsh = SHADOW_N; sc.traverse(o => { const m = o.material; if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true; }); }
  d.env0 ??= sc.environmentIntensity; sc.environmentIntensity = d.env0 * gv('env');
  if (sc.fog) { const f = sc.fog, m = gv('fog'); if (d.fog0?.f !== f) d.fog0 = { f, n: f.near, fa: f.far, de: f.density };
    if (f.isFogExp2) f.density = d.fog0.de * m; else if (m <= 0) { f.near = 1e7; f.far = 2e7; } else { f.near = d.fog0.n / m; f.far = d.fog0.fa / m; } }
  const sz = gv('shadowSize'), lite = LITE();
  sc.traverse(o => { if (!o.isLight || !o.castShadow || !o.shadow) return; const ud = o.userData; ud.map0 ??= o.shadow.mapSize.x;
    const n = Math.min(lite ? 1024 : 8192, sz ?? ud.map0); if (o.shadow.mapSize.x !== n) { o.shadow.mapSize.set(n, n); o.shadow.map?.dispose(); o.shadow.map = null; } });
}
export function applyGraphics(partial = {}, replace = false) {
  GFX = gfxClean(replace ? partial : { ...GFX, ...partial }); GSTAMP++;
  gfxRenderer();
  return getGraphics();
}
export function getGraphics() {
  return { version: 1, supported: GRAPHICS_KEYS, values: { ...GFX }, preview: PREVIEW, drawn: [RW, RH],
    // what an absent key means in this project (the look's own values)
    look: { grain: G0.grain, vignette: G0.vig, ca: G0.ca, bloomThreshold: G0.bloomAt, bloomStrength: THEME.post.bloom || .25, shadowSize: 4096, exportSs: SETTINGS.quality?.ss ?? 2 } };
}
// an exported frame: Graphics > Export quality > Motion blur averages n moments of a 180-degree shutter (never across a cut)
let ACC = null;
function gfxFrame(t, fps) {
  const n = PREVIEW ? 1 : gv('exportSamples'); if (n <= 1) return compose(t);
  ACC ||= Object.assign(document.createElement('canvas'), { width: FW, height: FH }); const ax = ACC.getContext('2d'), i = activeIndex(t);
  for (let k = 0; k < n; k++) { let tt = t + ((k + .5) / n - .5) * .5 / fps; if (tt < 0 || activeIndex(tt) !== i) tt = t;
    compose(tt); ax.globalAlpha = 1 / (k + 1); ax.drawImage(outCanvas, 0, 0); }
  ax.globalAlpha = 1; out.drawImage(ACC, 0, 0); return outCanvas;
}

// ---------- fonts ----------
export const FONT_FILES = [['Inter', 'fonts/inter-800.woff2', '800', 'normal'], ['Inter', 'fonts/inter-600.woff2', '600', 'normal'],
  ['JBM', 'fonts/JetBrainsMono-400.woff2', '400', 'normal'], ['JBM', 'fonts/JetBrainsMono-700.woff2', '700', 'normal']];
const F = { h: (s, w = 800) => `${w} ${s}px Inter`, m: (s, w = 400) => `${w} ${s}px JBM` };

// ---------- shots ----------
// shot({ t0, name, trans: 'cut' | 'dissolve', build(S) -> st, update(st, t, S) })
export const SHOTS = [];
export const SUITE = { module: null, pick: null, base: '' };
function caller() {
  for (const l of (new Error().stack || '').split('\n')) {
    if (l.includes('/engine.js') || l.includes('/models.js')) continue;
    const m = l.match(/((?:scenes\/)?[\w.-]+\.js):(\d+):\d+/); if (m && !m[1].startsWith('host')) return { file: m[1], line: +m[2] };
  }
  return null;
}
export function shot(def) { const s = caller(); def._file = SUITE.module || s?.file || null; def._line = s?.line ?? null; SHOTS.push(def); }
let END = 0;
export function finalizeShots(end) { SHOTS.sort((a, b) => a.t0 - b.t0); SHOTS.forEach((s, i) => (s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : end)); END = end; }
export function activeIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t0) i++; return i; }
const TRANS = .6;

function live(def) {
  if (def._st) return def;
  const scene = new THREE.Scene(), cam = fitLens(new THREE.PerspectiveCamera(THEME.fov, FW / FH, .1, 800));   // near/far per scene: S.studio({ near, far })
  scene.background = new THREE.Color(C.bgHex); scene.environment = ENV; scene.environmentIntensity = THEME.env;
  const S = { scene, cam, t0: def.t0, t1: def.t1, ov: [], ticks: [], keys: null, recon: true, look: new THREE.Vector3(), post: { ...THEME.post, dof: THEME.post.dof && { ...THEME.post.dof } },
    flat: !!(def.flat || def.skip3d) };
  // S.flat = true (or shot({ flat: true })): the shot is fully covered by 2D (a full-screen broll(), a card): the 3D scene
  // is not rendered at all (faster, and nothing of it can show through). S.skip3d is the same flag.
  // S.studio({ fog: [near, far], key: [x, y, z], target, area, floor, floorY }): the seamless grey room
  //   (Investigation: the same room in near-black, a cool hemisphere, a dimmer cool key, a rim light from behind for the
  //   specular streak on porcelain heads; o.rim: false turns it off, o.rim: [x, y, z] moves it)
  S.studio = (o = {}) => {
    const [n0, f0] = o.fog || [30, 120], n = n0 * 1.8, f = f0 * 2.2; scene.fog = new THREE.Fog(o.fogColor ?? C.bgHex, n, f);
    if (o.near || o.far) { cam.near = o.near ?? cam.near; cam.far = o.far ?? cam.far; cam.updateProjectionMatrix(); }
    const Hm = THEME.hemi, Hi = THEME.hemiInterior;
    scene.add(o.interior ? new THREE.HemisphereLight(Hi[0], Hi[1], Hi[2]) : new THREE.HemisphereLight(Hm[0], Hm[1], (o.hemi ?? 1.1) * .6 * Hm[2]));
    for (const L of o.lamps || []) { const pl = new THREE.PointLight(THEME.lamp, L[3] ?? 1.4, 9, 1.2); pl.position.set(L[0], L[1], L[2]); scene.add(pl); }
    if (THEME.rim && o.rim !== false) { const rl = new THREE.DirectionalLight(THEME.rim[0], (o.rimI ?? 1) * THEME.rim[1]); rl.position.set(...(Array.isArray(o.rim) ? o.rim : [-(o.key?.[0] ?? 6), 7, -(o.key?.[2] ?? 8)]));
      rl.target.position.set(...(o.target || [0, 0, 0])); scene.add(rl, rl.target); S.rim = rl; }
    const key = new THREE.DirectionalLight(THEME.key[0], (o.keyI ?? 1.7) * 1.3 * THEME.key[1]); key.position.set(...(o.key || [6, 14, 8]));
    key.target.position.set(...(o.target || [0, 0, 0])); scene.add(key, key.target);
    key.castShadow = true; const a = o.area ?? 12; Object.assign(key.shadow.camera, { left: -a, right: a, top: a, bottom: -a, near: .5, far: o.shadowFar ?? 80 });
    key.shadow.mapSize.set(4096, 4096); key.shadow.radius = o.soft ?? 6; key.shadow.blurSamples = 16; key.shadow.bias = -.0004; key.shadow.normalBias = .02;
    S.key = key;
    // S.followKey(pos): move the key light (and its shadow box) with a moving subject, snapped to whole shadow-map
    // texels so the shadows never swim/shimmer as the subject travels
    S.followKey = pos => { const off = V(o.key || [6, 14, 8]), d = off.clone().normalize(), up = Math.abs(d.y) > .99 ? V([1, 0, 0]) : V([0, 1, 0]);
      const r = new THREE.Vector3().crossVectors(up, d).normalize(), u = new THREE.Vector3().crossVectors(d, r), tx = (2 * a) / key.shadow.mapSize.x;
      const pr = Math.round(pos.dot(r) / tx) * tx, pu = Math.round(pos.dot(u) / tx) * tx, pd = pos.dot(d), snapped = r.multiplyScalar(pr).add(u.multiplyScalar(pu)).add(d.multiplyScalar(pd));
      key.target.position.copy(snapped); key.position.copy(snapped).add(off); };
    if (o.floor !== false && !o.interior) {
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: o.floorColor ?? THEME.floor.color ?? C.bgHex, roughness: THEME.floor.rough }));
      fl.rotation.x = -Math.PI / 2; fl.position.y = o.floorY ?? 0; fl.receiveShadow = true; fl.name = 'studio floor'; fl.userData.ground = true; scene.add(fl); S.floor = fl;
    }
    return key;
  };
  // S.sky(top, horizon, ground?): a vertical gradient behind everything (screen space), fog takes the horizon colour
  S.sky = (top, hor, gnd) => { const c = document.createElement('canvas'); c.width = 4; c.height = 512; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, top); g.addColorStop(.55, hor); g.addColorStop(1, gnd ?? hor); x.fillStyle = g; x.fillRect(0, 0, 4, 512);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; scene.background = tx; if (scene.fog) scene.fog.color.set(hor); };
  // S.camera([{ t, p: [x,y,z], l: [x,y,z], fov }]): eased moves between keys (inOutSine); times are absolute seconds
  // v8: S.camera(keys, { smooth: true }): ONE C2-continuous move through all the keys (a natural cubic spline driven by a
  // smootherstep clock over the whole span: starts and ends at rest, never stops at an inner key, no velocity or
  // acceleration jumps). Without smooth: each pair of keys eased on its own (as before).
  S.camera = (keys, o = {}) => { S.keys = keys.map(k => ({ ...k })); S.keys.smooth = !!o.smooth; S.moves = null; };
  // v8: S.cameraRig: controlled professional moves (push, drift, arc, crane, rack); see CAMERA RIG below
  S.cameraRig = cameraRig(S);
  // v8: S.lighting(preset, { subject, ... }): a professional light rig aimed at the subject (see LIGHTING RIG below);
  // S.subject: what the shot is about (Object3D | person | [x, y, z] | Vector3 | Box3): the visibility gate measures it;
  // S.visibility = { ...thresholds } | false: per-shot override of the visibility gate (a deliberate silhouette)
  S.subject = null; S.visibility = null;
  S.lighting = (preset = 'threePoint', o = {}) => lightingRig(S, preset, o);
  S.add =(...a) => { a.forEach(o => scene.add(o)); return a[0]; };
  S.over = item => { item.src ??= caller() || { file: def._file, line: def._line }; S.ov.push(item);   // src: the scene line (editor clicks)
    if (COLLECT && item && item.t0 != null && isFinite(item.t0)) OVERLAYS.push({ t: +(+item.t0).toFixed(3), t1: item.t1 != null ? +(+item.t1).toFixed(3) : null, what: item.what || 'overlay', text: item.text ?? null, shot: def.name || '' });
    return item; };
  S.proj = v => { const w = v.isVector3 ? v.clone() : new THREE.Vector3(...v), inFront = w.clone().applyMatrix4(cam.matrixWorldInverse).z < -cam.near, p = w.project(cam); return [(p.x + 1) / 2 * FW, (1 - p.y) / 2 * FH, inFront && p.z < 1]; };   // ok = in front of the camera
  S.tick = f => S.ticks.push(f);
  // v15: S.late(fn(t)): runs after the shot's update() on every frame (a camera that tracks a subject the update just
  // moved: lib/camera.js follow / track moves)
  S.lates = []; S.late = f => S.lates.push(f);
  // S.audit(): HARD RULE check. Two surfaces facing the same way at (almost) the same height and overlapping in plan
  // z-fight (flicker) at distance. Every flat, horizontal mesh (planes and thin slabs) is compared with every other; any
  // pair closer than `tol` metres is printed as COPLANAR (render.mjs fails the shot on it). Runs on every shot build.
  S.audit = (tol = .01) => {
    scene.updateMatrixWorld(true); const flats = [], found = [];
    scene.traverse(m => { if (!m.isMesh || m.isInstancedMesh || !m.visible || m.material?.transparent) return; const b = new THREE.Box3().setFromObject(m); if (b.isEmpty()) return;
      const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z; if (sy > .02 * Math.max(sx, sz) || Math.max(sx, sz) < .3) return; flats.push({ m, b }); });
    for (let i = 0; i < flats.length; i++) for (let j = i + 1; j < flats.length; j++) { const A = flats[i], B = flats[j];
      if (Math.abs(A.b.max.y - B.b.max.y) >= tol) continue;
      if (A.b.max.x <= B.b.min.x || B.b.max.x <= A.b.min.x || A.b.max.z <= B.b.min.z || B.b.max.z <= A.b.min.z) continue;
      const msg = `"${A.m.name || A.m.geometry.type}" y=${A.b.max.y.toFixed(4)} vs "${B.m.name || B.m.geometry.type}" y=${B.b.max.y.toFixed(4)}`;
      found.push(msg); console.warn(`COPLANAR ${def.name || def._line}: ${msg}`); }
    return found; };
  def._S = S; BUILDING++; try { def._st = def.build(S) || {}; } finally { BUILDING--; }
  if (THEME.figure) S.scene.traverse(m => { if (m.userData.castOf && m.material !== MAT.white && m.material !== MAT.joint) m.material = MAT.joint; });   // porcelain joints (v7)
  if (globalThis.__AUDIT) S.audit();
  return def;
}
// Built shots kept alive. An export walks forward and needs only the neighbours (the default); the editor's preview keeps
// more (setKeep), so scrubbing back and forth or stepping through shots doesn't rebuild every scene (~100 ms each), and
// builds the next ones while it is idle (prewarm), compiling their materials so the first frame of a shot doesn't stall.
let KEEP = 3;
export const setKeep = n => { KEEP = Math.max(3, n | 0); };
export function prewarm(t, ahead = 3) {
  const i = activeIndex(t);
  for (let k = i + 1; k <= i + ahead && k < SHOTS.length; k++) if (!SHOTS[k]._st && !SHOTS[k]._warmFail) {
    try { live(SHOTS[k]); } catch { SHOTS[k]._warmFail = true; continue; }   // a shot that throws shows its error when it is reached
    // (for the target the frame really draws into - post on: the composer's - a shader's variant depends on it; compiled for
    // the screen, the real one compiled on the shot's first frame, the stall when playing into it)
    const prev = renderer.getRenderTarget(); renderer.setRenderTarget(POST_ON ? POST.composer.renderTarget1 : null);
    try { renderer.compile(SHOTS[k]._S.scene, SHOTS[k]._S.cam); } catch { /* compiled on first draw */ } finally { renderer.setRenderTarget(prev); }
    trim(i); return true;
  }
  return false;
}
function trim(i) {
  const built = []; SHOTS.forEach((s, k) => { if (s._st) built.push(k); });
  built.sort((a, b) => Math.abs(b - i) - Math.abs(a - i));
  for (let n = built.length, j = 0; n > KEEP && j < built.length; j++) if (Math.abs(built[j] - i) > 1) { dispose(SHOTS[built[j]]); n--; }
}
function dispose(def) {
  if (!def._st) return;
  def._S.scene.traverse(o => { if (o.userData.shared) return; o.geometry?.dispose?.(); const m = o.material; if (m && !Object.values(MAT).includes(m)) (Array.isArray(m) ? m : [m]).forEach(mm => { mm.map?.dispose?.(); mm.dispose?.(); }); });
  def._S.scene.traverse(o => o.shadow?.map?.dispose?.());
  def._st = null; def._S = null;
}
const V = (a) => new THREE.Vector3(...a);
function camAt(S, t) {
  if (S.moves && S.moves.length) return rigAt(S, t);
  const K = S.keys; if (!K || !K.length) return;
  if (K.smooth && K.length > 1) return smoothAt(S, K, t);
  let a = K[0], b = K[0];
  for (let i = 0; i < K.length; i++) { if (t >= K[i].t) { a = K[i]; b = K[i + 1] || K[i]; } }
  if (t < K[0].t) { a = b = K[0]; }
  const k = b === a ? 0 : (b.ease || E.inOutSine)(seg(t, a.t, b.t));
  S.cam.position.copy(V(a.p).lerp(V(b.p), k));
  S.look.copy(V(a.l).lerp(V(b.l), k)); S.cam.lookAt(S.look);
  if (a.roll != null || b.roll != null) S.cam.rotateZ(lerp(a.roll ?? 0, b.roll ?? 0, k));
  const fov = lerp(a.fov ?? THEME.fov, b.fov ?? a.fov ?? THEME.fov, k); if (S.cam.fov !== fov) { S.cam.fov = fov; S.cam.updateProjectionMatrix(); }
}
function step(def, t) {
  live(def); const S = def._S;
  if (S._rig && !S._rig.placed) placeRig(S, def);
  camAt(S, t);
  // live preview: the shot camera's view while its frame code runs, so figures it can't see skip posing (lib/figures.js);
  // not while the editor picks (a click must find a figure posed as drawn)
  const vw = PREVIEW && !SUITE.pick ? (globalThis.__czView ??= { on: false, frustum: new THREE.Frustum(), m: new THREE.Matrix4() }) : null;
  // (Graphics > Field of view first: gfxStep is the same again after the ticks)
  if (vw) { gfxStep(S); S.cam.updateMatrixWorld(); vw.cam = S.cam; vw.frustum.setFromProjectionMatrix(vw.m.multiplyMatrices(S.cam.projectionMatrix, S.cam.matrixWorldInverse)); vw.on = true; }
  try {
    for (const f of S.ticks) f(t);
    def.update?.(def._st, t, S);
    for (const f of S.lates) f(t);
  } finally { if (vw) vw.on = false; }
  if (S._rig?.o.follow) followRig(S);
  // z-fight probe (render.mjs zfight): scale the near plane only. Screen positions are untouched, only depth precision
  // changes, so any pixel that differs is an ambiguous depth test = z-fighting.
  S.near0 ??= S.cam.near; const nm = globalThis.__NEARMUL || 1; if (S.cam.near !== S.near0 * nm) { S.cam.near = S.near0 * nm; S.cam.updateProjectionMatrix(); }
  gfxStep(S);   // v9 Graphics: lens, room light, fog, shadow detail
  S.cam.updateMatrixWorld();
  return S;
}

// ---------- v8 LIGHTING RIG ----------
// S.lighting(preset, o): professional, motivated light aimed at the subject, placed relative to the shot's camera (at the
// shot's first frame, so preview == render). Every preset is: a soft KEY spot (penumbra, the only shadow caster) at an
// azimuth from the camera axis and an elevation, a FILL from the other side at a key:fill ratio, a RIM/back light that
// separates the subject from the background, a WALL WASH (a soft pool on the background found behind the subject, so the
// room reads) and an ambient FLOOR (blacks deep, not crushed). The studio's own flat key drops to o.studioKey (.25).
//   presets: 'threePoint' (key 45 deg, fill 1:3, rim) | 'lowKey' (noir but readable: strong key, 1:6 fill, strong rim) |
//   'window' (low wide cool key from the side + warm bounce fill) | 'practical' (warm low key as if from the lamp/monitor,
//   invisible fill so faces and hands read) | 'topDown' (overhead spot for tables and boards) | 'void' (steep spot pool,
//   faint ambient, strong rim; no wash)
//   o: subject (Object3D | person | [x, y, z] | Vector3 | Box3 | fn) | side: 1 (key camera-left) / -1 | az, el (deg) |
//   dist (m) | key, fill, rim, wash, amb (multipliers, 0 = off) | keyColor | wall: [x, y, z] (where the wash lands; default:
//   the first surface behind the subject seen from the camera) | practicals: [{ at, color, i, range, bulb }] (visible
//   lamps: a point light + a glowing bulb) | follow: true (the rig moves with a moving subject) | studioKey (default .25)
// Returns the rig { key, fill, rim, wash, hemi, practicals } (lights exist at once, so lightsOut() dims them too).
export const LIGHTING = {
  threePoint: { key: [45, 35, 3.0, 0xf4efe6], fill: [-50, 12, 1 / 3, 0xc8d4e4], rim: [155, 40, 2.4, 0xbcd0ec], wash: 2.2, amb: 3.2 },
  lowKey: { key: [55, 38, 4.0, 0xe8eef6], fill: [-45, 8, 1 / 6, 0xb8c6da], rim: [-150, 42, 3.4, 0xa9c0e0], wash: 2.4, amb: 3.4 },
  window: { key: [78, 20, 3.2, 0xdbe6f4], fill: [-70, -4, 1 / 3, 0xd6c8b4], rim: [160, 30, 1.6, 0xbcd0ec], wash: 2.2, amb: 2.8 },
  practical: { key: [32, 14, 2.6, 0xffd6a8], fill: [-40, 16, 1 / 2.5, 0xa9bde0], rim: [165, 36, 2.4, 0xa9c0e0], wash: 2.0, amb: 2.8 },
  topDown: { key: [8, 78, 3.4, 0xf1f0ec], fill: [-20, 22, 1 / 4, 0xc8d4e4], rim: [180, 50, 1.4, 0xbcd0ec], wash: 1.6, amb: 2.6 },
  void: { key: [20, 66, 3.8, 0xf2f4f8], fill: [-40, 14, 1 / 5, 0xb8c6da], rim: [170, 34, 3.4, 0xa9c0e0], wash: 0, amb: 1.4 },
};
function subjectBox(x) {
  if (!x) return null; if (typeof x === 'function') return subjectBox(x());
  if (x.isBox3) return x.isEmpty() ? null : x.clone();
  if (x.isVector3 || (Array.isArray(x) && typeof x[0] === 'number')) { const v = x.isVector3 ? x.clone() : V(x); return new THREE.Box3(v.clone().subScalar(.15), v.clone().addScalar(.15)); }
  if (x.isObject3D) { x.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(x); return b.isEmpty() ? null : b; }
  if (typeof x.box === 'function') { try { const b = x.box(); if (b?.isBox3 && !b.isEmpty()) return b; } catch { /* next */ } }
  for (const k of ['root', 'group', 'obj', 'g', 'mesh', 'body']) if (x[k]?.isObject3D) return subjectBox(x[k]);
  return null;
}
const aimOf = b => { const c = b.getCenter(new THREE.Vector3()), h = b.max.y - b.min.y; if (h > 1) c.y = b.min.y + h * .78; return c; };   // a person: the face/chest
function lightingRig(S, preset, o = {}) {
  const P = LIGHTING[preset] || LIGHTING.threePoint, sc = S.scene;
  if (o.subject != null) S.subject ??= o.subject;
  const spot = (col, shadow) => { const l = new THREE.SpotLight(col, 0, 0, .6, .85, 2); l.castShadow = !!shadow; sc.add(l, l.target);
    if (shadow) { l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -.0003; l.shadow.normalBias = .02; l.shadow.radius = 4; } return l; };
  const R = { preset, P, o, placed: false, key: spot(o.keyColor ?? P.key[3], o.shadow !== false), fill: spot(P.fill[3]), rim: spot(P.rim[3]), wash: spot(o.washColor ?? 0xb4c0d0),
    hemi: new THREE.HemisphereLight(0x8a9bb2, 0x1b1d22, 0), practicals: [] };
  sc.add(R.hemi);
  for (const p of o.practicals || []) { const pl = new THREE.PointLight(p.color ?? THEME.lamp, (p.i ?? 1.2) * (THEME_ID === 'investigation' ? 1.4 : 1), p.range ?? 0, 2); pl.position.set(...p.at); sc.add(pl); R.practicals.push(pl);
    if (p.bulb !== false) { const b = new THREE.Mesh(new THREE.SphereGeometry(p.r ?? .035, 14, 10), new THREE.MeshBasicMaterial({ color: p.color ?? THEME.lamp, toneMapped: false })); b.position.set(...p.at); b.castShadow = false; b.userData.noPick = true; b.userData.airborne = true; b.userData.noContact = true; b.name = 'practical bulb'; sc.add(b); } }
  // intensities now (lightsOut() captures them at build time); positions on the first frame (they need the camera)
  const box = subjectBox(o.subject ?? S.subject ?? o.fallback), size = box ? box.getSize(new THREE.Vector3()).length() : 1.2;
  const k = { key: o.key ?? 1, fill: o.fill ?? 1, rim: o.rim ?? 1, wash: o.wash ?? 1, amb: o.amb ?? 1 }, dist = o.dist ?? Math.max(2.4, size * 1.5), keyE = P.key[2] * k.key;
  Object.assign(R, { size, dist, k });
  R.key.intensity = keyE * dist * dist; R.fill.intensity = keyE * P.fill[2] * k.fill * (dist * 1.15) ** 2; R.rim.intensity = P.rim[2] * k.rim * (dist * .9) ** 2;
  R.wash.intensity = P.wash * k.wash * 2 * 3.2 * 3.2; R.hemi.intensity = P.amb * k.amb * (THEME_ID === 'investigation' ? 1 : .6);
  if (S.key) S.key.intensity *= o.studioKey ?? .25; if (S.rim) S.rim.intensity *= .4;   // the studio's flat light steps back: the rig is the light now
  S._rig = R; return R;
}
function placeRig(S, def) {
  const R = S._rig, o = R.o, P = R.P; R.placed = true;
  // the camera at the shot's first frame (keys, rig moves, or a camera a tick drives)
  camAt(S, def.t0 + .01); for (const f of S.ticks) { try { f(def.t0 + .01); } catch { /* reported by the frame */ } } S.cam.updateMatrixWorld();
  const box = subjectBox(o.subject ?? S.subject ?? o.fallback) || (() => { const c = S.look.clone(); return new THREE.Box3(c.clone().subScalar(.3), c.clone().addScalar(.3)); })();
  const c = aimOf(box), size = R.size, camP = S.cam.position.clone();
  const fwd = c.clone().sub(camP); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
  const side = o.side ?? 1, k = R.k, dist = R.dist;
  const dirAt = (az, el) => { const a = az * Math.PI / 180 * side, e = el * Math.PI / 180, back = fwd.clone().negate();
    const h = new THREE.Vector3(back.x * Math.cos(a) - back.z * Math.sin(a), 0, back.x * Math.sin(a) + back.z * Math.cos(a)); return h.multiplyScalar(Math.cos(e)).setY(Math.sin(e)).normalize(); };
  const coneFor = d => clamp(Math.atan((size * .75 + .35) / d), .22, .95);
  const put = (l, az, el, d, cone) => { l.position.copy(c).addScaledVector(dirAt(az, el), d); l.target.position.copy(c); l.angle = cone ?? coneFor(d); l.penumbra = .9;
    if (l.castShadow) { Object.assign(l.shadow.camera, { near: Math.max(.05, d - size * 2), far: d + size * 3 }); l.shadow.camera.updateProjectionMatrix(); } };
  put(R.key, o.az ?? P.key[0], o.el ?? P.key[1], dist);
  put(R.fill, P.fill[0], P.fill[1], dist * 1.15, clamp(coneFor(dist * 1.15) * 1.6, .4, 1.1));
  put(R.rim, P.rim[0], P.rim[1], dist * .9);
  // the wall wash: the first surface behind the subject on the camera's line through it
  let w = o.wall ? V(o.wall) : null, n = null;
  if (!w && P.wash * k.wash > 0) { S.scene.updateMatrixWorld(true);
    const rc = new THREE.Raycaster(c.clone(), c.clone().sub(camP).normalize(), size * .5 + .2, 40); const subj = o.subject ?? S.subject;
    const bx = box.clone().expandByScalar(.25), hit = rc.intersectObjects(S.scene.children, true).find(h => h.object.isMesh && !h.object.isInstancedMesh && !h.object.isSkinnedMesh && !h.object.userData.ground && !h.object.userData.castOf && h.face && !bx.containsPoint(h.point) && !(subj?.isObject3D && within(h.object, subj)) && !(h.object.material?.transparent));
    if (hit) { w = hit.point.clone(); n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); }
  }
  if (w && P.wash * k.wash > 0) { n ??= camP.clone().sub(w).setY(0).normalize(); const wd = 3.2;
    R.wash.position.copy(w).addScaledVector(n, wd * .7).add(new THREE.Vector3(0, wd * .7, 0)); R.wash.target.position.copy(w).add(new THREE.Vector3(0, .25, 0));
    R.wash.angle = .78; R.wash.penumbra = 1; } else R.wash.visible = false;
  R.c0 = c.clone(); R.box = box;
  for (const l of [R.key, R.fill, R.rim, R.wash]) { l.position0 = l.position.clone(); l.target0 = l.target.position.clone(); }
}
function followRig(S) {
  const R = S._rig; if (!R?.placed || !R.o.follow) return; const b = subjectBox(R.o.subject ?? S.subject); if (!b) return;
  const d = aimOf(b).sub(R.c0); for (const l of [R.key, R.fill, R.rim]) { l.position.copy(l.position0).add(d); l.target.position.copy(l.target0).add(d); }
}

// ---------- v8 CAMERA RIG ----------
// Professional moves: every move starts and ends at rest on a smootherstep (C2: no velocity or acceleration jumps), peak
// angular speed is kept under CAMERA_LIMITS.maxDeg (a move asked to be faster is lengthened, said in the check), a push
// lasts at least CAMERA_LIMITS.minPush s unless snap: true. Moves chain: between two moves the camera holds.
//   S.cameraRig.push({ t0, dur = 3, from: { p, l, fov }, to: { p, l, fov }, snap })   dolly / zoom in or out
//   S.cameraRig.drift({ t0, dur, at: { p, l, fov }, by: [dx, dy, dz] })               a slow, barely-there float (default: 3 % of the
//                                                                                      look distance sideways over the move)
//   S.cameraRig.arc({ t0, dur, center: [x, y, z], radius, y, from: -15, to: 15, fov }) orbit round the subject (deg)
//   S.cameraRig.crane({ t0, dur, x, z, y0, y1, l: [x, y, z], fov })                   rise or descend, looking at l
//   S.cameraRig.rack({ t0, dur = 1.2, from, to, aperture })                           focus pull: from/to = a distance, a point or a thing
//   S.cameraRig.hold({ t0, p, l, fov })                                               a locked-off frame
export const CAMERA_LIMITS = { maxDeg: 25, minPush: 2.5, accel: 2.4, shortDur: .8, shortCover: .15, peakDeg: 60 };
const smoother = k => k * k * k * (k * (k * 6 - 15) + 10);
export { smoother as smootherstep };
const ptOf = x => x == null ? null : Array.isArray(x) ? V(x) : x.isVector3 ? x.clone() : (() => { const b = subjectBox(x); return b ? aimOf(b) : null; })();
const shotOf = (k, fb) => ({ p: V(k?.p ?? fb.p), l: V(k?.l ?? fb.l), fov: k?.fov ?? fb.fov ?? THEME.fov });
function moveAngle(a, b) {   // degrees of picture change: rotation + parallax of the translation at the look distance + zoom
  const da = a.l.clone().sub(a.p), db = b.l.clone().sub(b.p), rot = da.angleTo(db) * 180 / Math.PI;
  const par = Math.atan(a.p.distanceTo(b.p) / Math.max(.05, da.length())) * 180 / Math.PI; return rot + par + Math.abs((b.fov ?? 30) - (a.fov ?? 30)); }
function cameraRig(S) {
  const R = {}, notes = S._camNotes = [];
  const add = (m) => { (S.moves ??= []).push(m); S.moves.sort((x, y) => x.t0 - y.t0); return R; };
  const limit = (a, b, dur, snap, name) => { if (snap) return dur; const need = Math.max(CAMERA_LIMITS.minPush, 1.875 * moveAngle(a, b) / CAMERA_LIMITS.maxDeg);
    if (dur < need - 1e-6) { notes.push(`${name} at ${a.t0 ?? ''} lengthened ${dur.toFixed(2)} -> ${need.toFixed(2)} s`); return need; } return dur; };
  R.push = ({ t0, dur = 3, from, to, snap = false, ease }) => { const a = shotOf(from, from), b = shotOf(to, from);
    return add({ t0, dur: limit(a, b, dur, snap, 'push'), at: u => ({ p: a.p.clone().lerp(b.p, u), l: a.l.clone().lerp(b.l, u), fov: lerp(a.fov, b.fov, u) }), f: ease ?? smoother }); };
  R.drift = ({ t0, dur = 4, at, by, fov }) => { const a = shotOf(at, at); let d = by ? V(by) : null;
    if (!d) { const f = a.l.clone().sub(a.p), r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize(); d = r.multiplyScalar(f.length() * .03); }
    const b = { p: a.p.clone().add(d), l: a.l.clone().add(d.clone().multiplyScalar(.5)), fov: fov ?? a.fov };
    return add({ t0, dur, at: u => ({ p: a.p.clone().lerp(b.p, u), l: a.l.clone().lerp(b.l, u), fov: lerp(a.fov, b.fov, u) }), f: E.inOutSine }); };
  R.arc = ({ t0, dur = 4, center, radius = 3, y = 1.5, from = -15, to = 15, fov, lookY, snap = false }) => { const c = V(center), ly = lookY ?? c.y;
    const pa = a => new THREE.Vector3(c.x + Math.sin(a * Math.PI / 180) * radius, y, c.z + Math.cos(a * Math.PI / 180) * radius);
    const A = { p: pa(from), l: new THREE.Vector3(c.x, ly, c.z), fov: fov ?? THEME.fov }, B = { p: pa(to), l: A.l, fov: A.fov };
    return add({ t0, dur: limit(A, B, dur, snap, 'arc'), at: u => ({ p: pa(lerp(from, to, u)), l: A.l.clone(), fov: A.fov }), f: smoother }); };
  R.crane = ({ t0, dur = 4, x = 0, z = 4, y0 = .8, y1 = 2.4, l = [0, 1, 0], fov, snap = false }) => { const A = { p: V([x, y0, z]), l: V(l), fov: fov ?? THEME.fov }, B = { p: V([x, y1, z]), l: A.l, fov: A.fov };
    return add({ t0, dur: limit(A, B, dur, snap, 'crane'), at: u => ({ p: A.p.clone().lerp(B.p, u), l: A.l.clone(), fov: A.fov }), f: smoother }); };
  // v15: R.path({ t0, dur, at: u => ({ p, l, fov, roll }), ease, snap, name }): any move as a function of u (0..1); the
  // limit check compares the start and end frames (a dolly zoom, a pedestal, a reveal: lib/camera.js builds on it)
  R.path = ({ t0, dur = 3, at, ease, snap = false, name = 'path' }) => { const a = shotOf(at(0), at(0)), b = shotOf(at(1), at(1));
    return add({ t0, dur: limit({ ...a, t0 }, b, dur, snap, name), at: u => { const c = at(u); return { p: V(c.p), l: V(c.l), fov: c.fov ?? THEME.fov, roll: c.roll }; }, f: ease ?? smoother }); };
  R.hold = ({ t0, p, l, fov }) => { const a = shotOf({ p, l, fov }, { p, l, fov }); return add({ t0, dur: 0, at: () => ({ p: a.p.clone(), l: a.l.clone(), fov: a.fov }), f: smoother }); };
  R.rack = ({ t0, dur = 1.2, from, to, aperture, maxblur }) => { const d0 = S.post.dof || THEME.post.dof || { aperture: .003, maxblur: .01 };
    const dist = x => typeof x === 'number' ? x : (ptOf(x) || S.look).distanceTo(S.cam.position);
    S.post.dof = { ...d0, aperture: aperture ?? d0.aperture ?? .003, maxblur: maxblur ?? d0.maxblur ?? .01, focus: t => lerp(dist(from), dist(to), smoother(seg(t, t0, t0 + Math.max(.6, dur)))) }; return R; };
  return R;
}
function applyCam(S, c, roll) {
  S.cam.position.copy(c.p); S.look.copy(c.l); S.cam.lookAt(S.look); if (roll) S.cam.rotateZ(roll);
  const fov = c.fov ?? THEME.fov; if (S.cam.fov !== fov) { S.cam.fov = fov; S.cam.updateProjectionMatrix(); }
}
function rigAt(S, t) {
  const M = S.moves; let m = M[0];
  for (const x of M) if (t >= x.t0) m = x;
  const u = m.dur > 0 ? clamp((t - m.t0) / m.dur) : 1;
  const c = m.at(t < m.t0 ? 0 : m.f(u)); applyCam(S, c, c.roll);
}
// natural cubic spline (C2) through (xs, ys); returns f(x)
function spline(xs, ys) {
  const n = xs.length, M = new Float64Array(n); if (n > 2) { const a = new Float64Array(n), b = new Float64Array(n), c = new Float64Array(n), d = new Float64Array(n);
    for (let i = 1; i < n - 1; i++) { const h0 = Math.max(1e-6, xs[i] - xs[i - 1]), h1 = Math.max(1e-6, xs[i + 1] - xs[i]); a[i] = h0 / 6; b[i] = (h0 + h1) / 3; c[i] = h1 / 6; d[i] = (ys[i + 1] - ys[i]) / h1 - (ys[i] - ys[i - 1]) / h0; }
    for (let i = 2; i < n - 1; i++) { const w = a[i] / b[i - 1]; b[i] -= w * c[i - 1]; d[i] -= w * d[i - 1]; }
    for (let i = n - 2; i >= 1; i--) M[i] = (d[i] - c[i] * M[i + 1]) / b[i]; }
  return x => { let i = 0; while (i < n - 2 && x > xs[i + 1]) i++; const h = Math.max(1e-6, xs[i + 1] - xs[i]), A = xs[i + 1] - x, B = x - xs[i];
    return M[i] * A * A * A / (6 * h) + M[i + 1] * B * B * B / (6 * h) + (ys[i] / h - M[i] * h / 6) * A + (ys[i + 1] / h - M[i + 1] * h / 6) * B; };
}
function smoothAt(S, K, t) {
  if (!K._f) { const T0 = K[0].t, T = Math.max(1e-3, K[K.length - 1].t - T0), xs = K.map(k => smoother(clamp((k.t - T0) / T)));
    const comp = g => spline(xs, K.map(g)), fs = [0, 1, 2].map(j => comp(k => k.p[j])).concat([0, 1, 2].map(j => comp(k => k.l[j])), [comp(k => k.fov ?? THEME.fov), comp(k => k.roll ?? 0)]);
    K._f = x => fs.map(f => f(x)); K._T0 = T0; K._T = T; }
  const v = K._f(smoother(clamp((t - K._T0) / K._T)));
  applyCam(S, { p: new THREE.Vector3(v[0], v[1], v[2]), l: new THREE.Vector3(v[3], v[4], v[5]), fov: v[6] }, v[7]);
}

// ---------- overlay ----------
// Every overlay item: { t0, t1?, draw(ctx, t, a) } with a = its fade (in .3 s, out .25 s)
// it.fout (v7): fade-out length (default .25 s; a broll() that should cut away uses ~0)
const fadeOf = (it, t) => (it.fin === 0 ? (t >= it.t0 ? 1 : 0) : seg(t, it.t0, it.t0 + (it.fin ?? .3))) *(it.t1 != null ? 1 - (it.fout === 0 ? (t > it.t1 ? 1 : 0) : seg(t, it.t1, it.t1 + (it.fout ?? .25))) : 1);
const outOf = it => it.t1 != null ? it.t1 + (it.fout ?? .25) : Infinity;
function drawOverlay(S, t, alpha) {
  if (S.recon && !S._covered) reconTag(ov, alpha);
  for (const it of S.ov) {
    if (t < it.t0) continue; if (t > outOf(it)) continue;
    const a = fadeOf(it, t);
    ov.save(); ov.globalAlpha = alpha * E.outCubic(a); it.draw(ov, t, E.outCubic(a), S); ov.restore();
  }
}
// v20: the corner tag is OFF unless settings.badge === true (Look > Corner tag; members removed it by hand every video)
function reconTag(x, alpha) {
  const T = THEME.tag; if (!T?.style || SETTINGS.badge !== true) return;
  if (T.style === 'small') {                                       // Investigation: a quiet mono label with a crimson dot, no box
    x.save(); x.globalAlpha = alpha * .8; x.font = F.m(16); x.letterSpacing = '4px'; x.textBaseline = 'middle';
    const w = x.measureText(T.text).width, X = FW - 48 - w, Y = VERT ? OV_SAFE.t - 40 : 52;
    x.fillStyle = C.crimson; x.beginPath(); x.arc(X - 16, Y, 4.5, 0, 7); x.fill();
    x.fillStyle = 'rgba(225,231,231,.82)'; x.fillText(T.text, X, Y + 1); x.restore(); return;
  }
  x.save(); x.globalAlpha = alpha * .95; x.font = F.m(19); x.letterSpacing = '3px';
  const s = T.text, w = x.measureText(s).width + 30, X = FW - 44 - w, Y = VERT ? OV_SAFE.t - 60 : 40;
  x.fillStyle = 'rgba(246,246,244,.92)'; rr(x, X, Y, w, 40, 3); x.fill(); x.strokeStyle = '#8f938f'; x.lineWidth = 1.5; x.stroke();
  x.fillStyle = '#2f3438'; x.textBaseline = 'middle'; x.fillText(s, X + 15, Y + 21); x.restore();
}
export function rr(x, X, Y, w, h, r) { x.beginPath(); x.roundRect(X, Y, w, h, r); }
export function wrap(x, text, maxW) {
  if (SOLID.test(text)) return wrapSolid(x, String(text), maxW);
  const words = String(text).split(' '), lines = []; let cur = '';
  for (const w of words) { const n = cur ? cur + ' ' + w : w; if (x.measureText(n).width > maxW && cur) { lines.push(cur); cur = w; } else cur = n; }
  if (cur) lines.push(cur); return lines;
}
// Japanese, Chinese and Thai have no spaces to break at: lines break between the words the system's word breaker finds
// (Intl.Segmenter), never before a closing mark (、。」) (v5)
const SOLID = /[฀-๿⺀-鿿豈-﫿＀-￯]/u;
function wrapSolid(x, text, maxW) {
  const pieces = [...new Intl.Segmenter(globalThis.__CZ_LANG || undefined, { granularity: 'word' }).segment(text)].map(s => s.segment), lines = []; let cur = '';
  for (const p of pieces) {
    const n = cur + p;
    if (x.measureText(n).width > maxW && cur.trim() && !/^[\s、。，．！？：；」』）)\]】〉》ๆ]/u.test(p)) { lines.push(cur.trim()); cur = p.trimStart(); } else cur = n;
  }
  if (cur.trim()) lines.push(cur.trim()); return lines;
}
const rise = (a, d = 18) => (1 - a) * d;

// tag(at, title, sub, { t0, t1, dx, dy, anchor }) black name tag; `at` = [x,y] px or fn(S) -> [x,y]
// tag(at, title, sub, { t0, t1, dx, dy, anchor, line }) black name tag; `at` = [x,y] px or fn(S) -> [x,y]
//   line: true draws a leader from the anchor point (a small dot) to the box; the box is always kept 40 px inside the frame
export function tag(at, title, sub, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'name tag', text: sub ? `${title} / ${sub}` : title, draw(x, t, a, S) {
    const [AX, AY] = typeof at === 'function' ? at(S, t) : at; let X = AX + (o.dx ?? 0), Y = AY + (o.dy ?? 0);
    x.font = F.h(o.size ?? 24); x.letterSpacing = '.5px'; const tw = x.measureText(title.toUpperCase()).width;
    x.font = F.m(17); x.letterSpacing = '1.5px'; const sw = sub ? x.measureText(sub.toUpperCase()).width : 0;
    const w = Math.max(tw, sw) + 28, h = sub ? 64 : 42, k = E.outQuart(a);
    if (o.anchor === 'center') X -= w / 2;
    X = clamp(X, 40, FW - w - 40); Y = VERT ? clamp(Y, OV_SAFE.t, FH - h - OV_SAFE.b) : clamp(Y, 130, FH - h - 40);
    if (o.line) {                                                   // leader: anchor dot -> nearest point on the box
      const cx = clamp(AX, X, X + w), cy = clamp(AY, Y, Y + h);
      x.save(); x.globalAlpha *= k; x.strokeStyle = THEME.ov.text; x.lineWidth = 2; x.beginPath(); x.moveTo(AX, AY); x.lineTo(cx, cy); x.stroke();
      x.fillStyle = C.ink; x.beginPath(); x.arc(AX, AY, 5, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(); x.restore();
    }
    x.save(); x.beginPath(); x.rect(X - 2, Y - 2, (w + 4) * k, h + 4); x.clip();
    x.fillStyle = o.fill ?? C.ink; rr(x, X, Y, w, h, 3); x.fill();
    x.fillStyle = '#fff'; x.textBaseline = 'alphabetic'; x.font = F.h(o.size ?? 24); x.letterSpacing = '.5px'; x.fillText(title.toUpperCase(), X + 14, Y + 28);
    if (sub) { x.fillStyle = o.subColor ?? '#c3c8cd'; x.font = F.m(17); x.letterSpacing = '1.5px'; x.fillText(sub.toUpperCase(), X + 14, Y + 52); }
    x.restore();
  } };
}
// quote(text, who, src, { x, y, w, t0, t1, size, mark, center, hi: 'phrase to highlight', hiAt })
export function quote(text, who, src, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'quote', text: who ? `${text} - ${who}` : text, draw(x, t, a) {
    const w = Math.min(o.w ?? (VERT ? FW - 140 : 760), FW - 80), size = o.size ?? (VERT ? 36 : 30), pad = 34, lh = size * 1.3;
    x.font = F.h(size, 600); x.letterSpacing = '0px'; const lines = wrap(x, o.mark ? text : `“${text}”`, w - pad * 2);   // a big blue mark replaces the typed opening quote
    const h = pad * 2 + lines.length * lh + (who ? 40 : 0) + (src ? 24 : 0) + (o.mark ? 30 : 0);
    let X = o.x ?? (FW - w) / 2, Y = (o.y ?? FH - h - (VERT ? OV_SAFE.b : 70)) + rise(a);
    if (o.center) Y = (FH - h) / 2 + rise(a);
    x.save(); x.shadowColor = 'rgba(0,0,0,.10)'; x.shadowBlur = 40; x.shadowOffsetY = 10; x.fillStyle = C.card; rr(x, X, Y, w, h, 6); x.fill(); x.restore();
    let y = Y + pad + (o.mark ? 30 : 0);
    if (o.mark) { x.fillStyle = C.accent; x.font = F.h(72); x.fillText('“', X + pad - 6, Y + pad + 44); }
    x.font = F.h(size, 600); x.fillStyle = C.ink; x.textBaseline = 'alphabetic';
    const hk = o.hi ? ease(t, o.hiAt ?? (o.t0 ?? 0) + .5, (o.hiAt ?? (o.t0 ?? 0) + .5) + .45, E.outCubic) : 0;
    for (const l of lines) {
      if (o.hi && l.includes(o.hi)) {
        const pre = x.measureText(l.slice(0, l.indexOf(o.hi))).width, hw = x.measureText(o.hi).width;
        x.fillStyle = BRAND.soft; x.fillRect(X + pad + pre - 3, y + lh * .12, (hw + 6) * hk, lh * .98); x.fillStyle = C.ink;
      }
      y += lh; x.fillText(l, X + pad, y - lh * .22);
    }
    if (who) { x.font = F.h(20); x.fillText(who, X + pad, y + 30); y += 40; }
    if (src) { x.font = F.m(17); x.fillStyle = C.grey; x.letterSpacing = '.5px'; x.fillText(src, X + pad, y + 18); }
  } };
}
// big(value | fn(t), label, { x, y, t0, t1, color, w, card }) - a big mono number on a card
export function big(value, label, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'number card', text: typeof value === 'function' ? label : `${value} ${label}`, draw(x, t, a) {
    const v = typeof value === 'function' ? value(t) : value; let size = o.size ?? 170;
    if (VERT && o.size == null) { x.font = F.m(size, 700); x.letterSpacing = '0px'; size = Math.max(90, Math.min(size, size * (FW - 200) / Math.max(1, x.measureText(v).width))); }   // a long number fits the narrow frame
    x.font = F.m(size, 700); x.letterSpacing = '0px'; const vw = x.measureText(v).width;
    x.font = F.m(28); x.letterSpacing = '6px'; const lw = x.measureText(label).width;
    const w = o.w ?? Math.min(Math.max(vw, lw) + 120, FW - 80), h = size + 130, X = clamp((o.x ?? FW / 2) - w / 2, 40, Math.max(40, FW - w - 40)), Y = (o.y ?? FH / 2) - h / 2 + rise(a);
    if (o.card !== false) { x.save(); x.shadowColor = 'rgba(0,0,0,.12)'; x.shadowBlur = 50; x.shadowOffsetY = 12; x.fillStyle = 'rgba(248,248,246,.94)'; rr(x, X, Y, w, h, 8); x.fill(); x.restore(); }
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillStyle = o.color ?? C.ink; x.font = F.m(size, 700); x.letterSpacing = '0px'; x.fillText(v, X + w / 2, Y + 40 + size * .8);
    x.fillStyle = o.labelColor ?? '#55595e'; x.font = F.m(28); x.letterSpacing = '6px'; x.fillText(label, X + w / 2 + 3, Y + h - 44);
    x.textAlign = 'left';
  } };
}
// timecard(title, sub, { t0, t1 }) bottom-left: blue bar + bold time + mono sub
export function timecard(title, sub, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'time card', text: `${title} / ${sub}`, draw(x, t, a) {
    const X = VERT ? OV_SAFE.l : 64, Y = FH - (VERT ? OV_SAFE.b + 92 : 132) + rise(a, 10);
    x.fillStyle = C.accent; x.fillRect(X, Y, 5, 66 * E.outQuart(a));
    x.fillStyle = THEME.ov.text; x.font = F.h(38); x.letterSpacing = '.5px'; x.fillText(title.toUpperCase(), X + 22, Y + 34);
    x.fillStyle = THEME.ov.sub; x.font = F.m(19); x.letterSpacing = '2px'; x.fillText(sub.toUpperCase(), X + 24, Y + 64);
  } };
}
// chapter(kicker, title, { t0, t1, center }) top-left (or centred title card)
export function chapter(kicker, title, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'chapter title', text: `${kicker}: ${String(title).replace(/\n/g, ' ')}`, draw(x, t, a) {
    const c = o.center, X = c ? FW / 2 : VERT ? OV_SAFE.l : 70, Y = (c ? FH / 2 - 40 : VERT ? OV_SAFE.t + 40 : 84) + rise(a, 12); x.textAlign = c ? 'center' : 'left';
    x.fillStyle = C.accent; x.font = F.m(c ? 22 : 16); x.letterSpacing = c ? '8px' : '4px'; x.fillText(kicker.toUpperCase(), X, Y);
    x.fillStyle = THEME.ov.text; x.font = F.h(c ? (o.size ?? 76) : 40); x.letterSpacing = '0px';
    // vertical: a line wider than the frame wraps (16:9 keeps the scene's own line breaks only)
    const lines = VERT ? String(title).split('\n').flatMap(l => wrap(x, l, FW - 2 * OV_SAFE.l)) : String(title).split('\n'); lines.forEach((l, i) => x.fillText(l, X, Y + (c ? 30 : 16) + (c ? (o.size ?? 76) : 40) * (1 + i * 1.08)));
    if (o.sub) { x.fillStyle = THEME.ov.chapterSub; x.font = F.h(24, 600); x.fillText(o.sub, X, Y + 50 + (o.size ?? 76) * (1 + lines.length * 1.08)); }
    x.textAlign = 'left';
  } };
}
// list(items, { x, y, w, t0, kicker }) stacked cards; item: { title, sub, at, num, dark } (mark / markAt: ignored, banned)
export function list(items, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'list', text: o.kicker || items.map(it => it.title).join(', '), draw(x, t) {
    const X = o.x ?? (VERT ? OV_SAFE.l + 10 : 70), w = o.w ?? (VERT ? FW - 2 * OV_SAFE.l - 20 : 640); let Y = o.y ?? (VERT ? OV_SAFE.t + 160 : 260);
    if (o.kicker) { x.fillStyle = THEME.ov.sub; x.font = F.m(19); x.letterSpacing = '4px'; x.fillText(o.kicker.toUpperCase(), X, Y - 22); }
    for (const it of items) {
      const a = E.outCubic(seg(t, it.at, it.at + .35)); if (a <= 0) { Y += 96; continue; }
      const dark = it.dark && t >= (it.darkAt ?? it.at), h = 84, y = Y + rise(a, 14);
      x.save(); x.globalAlpha *= a;
      x.save(); x.shadowColor = 'rgba(0,0,0,.08)'; x.shadowBlur = 24; x.shadowOffsetY = 6; x.fillStyle = dark ? C.ink : C.card; rr(x, X, y, w, h, 5); x.fill(); x.restore();
      let tx = X + 26;
      if (it.num != null) { x.fillStyle = dark ? BRAND.onDark : C.accent; x.font = F.h(40); x.fillText(String(it.num), X + 22, y + 56); tx = X + 74; }
      x.fillStyle = dark ? '#fff' : C.ink; x.font = F.h(28, 800); x.letterSpacing = '0px'; x.fillText(it.title, tx, y + 38);
      if (it.sub) { x.fillStyle = dark ? '#c3c8cd' : '#4a5056'; x.font = F.m(17); x.letterSpacing = '1px'; x.fillText(it.sub, tx, y + 64); }
      // it.mark / it.markAt (the red verdict stamp) are a no-op: red stamps are banned in every style (no_slop.md B1)
      x.restore(); Y += 96;
    }
  } };
}
// title(text, { kicker, sub, t0, t1, y, size }) centred headline (no card)
export function headline(text, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'headline', text, draw(x, t, a) {
    const size = o.size ?? 64; x.textAlign = 'center'; let Y = (o.y ?? FH / 2) + rise(a, 14);
    if (o.kicker) { x.fillStyle = C.accent; x.font = F.m(18); x.letterSpacing = '9px'; x.fillText(o.kicker.toUpperCase(), FW / 2 + 4, Y - size - 10); }
    x.fillStyle = o.color ?? THEME.ov.text; x.font = F.h(size); x.letterSpacing = '0px';
    const lines = wrap(x, text, Math.min(o.w ?? 1300, FW - 120)); lines.forEach((l, i) => x.fillText(l, FW / 2, Y + i * size * 1.12));
    if (o.sub) { x.fillStyle = THEME.ov.headSub; x.font = F.h(22, 600); x.fillText(o.sub, FW / 2, Y + lines.length * size * 1.12 + 12); }
    x.textAlign = 'left';
  } };
}
// callout(at, text, { t0, t1, fill }) small blue label box (charts, diagrams)
export function callout(at, text, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'callout', text, draw(x, t, a, S) {
    const [X, Y] = typeof at === 'function' ? at(S, t) : at; x.font = F.m(o.size ?? 18, 400); x.letterSpacing = '1px';
    const w = x.measureText(text).width + 22, h = (o.size ?? 18) + 18, k = E.outQuart(a);
    x.save(); x.beginPath(); x.rect(X - 2, Y - 2, w * k + 4, h + 4); x.clip();
    x.fillStyle = o.fill ?? C.accent; rr(x, X, Y, w, h, 3); x.fill(); x.fillStyle = o.color ?? (o.fill ? '#fff' : BRAND.ink); x.fillText(text, X + 11, Y + h - 12); x.restore();
  } };
}
// pathline(points3d, { t0, dur, color, width, dash }) a route drawn on through the camera (map paths)
export function pathline(pts, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, fin: .01, what: 'route line', text: o.label ?? null, draw(x, t, a, S) {
    const k = ease(t, o.t0 ?? 0, (o.t0 ?? 0) + (o.dur ?? 2), o.ease ?? E.inOutSine), P = pts.map(p => S.proj(p));
    const L = []; let tot = 0; for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(d); tot += d; }
    let rem = tot * k; x.strokeStyle = o.color ?? C.accent; x.lineWidth = o.width ?? 5; x.lineCap = 'round'; x.lineJoin = 'round'; if (o.dash) x.setLineDash(o.dash);
    x.beginPath(); x.moveTo(P[0][0], P[0][1]); let end = P[0];
    for (let i = 1; i < P.length && rem > 0; i++) { const f = Math.min(1, rem / L[i - 1]); end = [lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f)]; x.lineTo(end[0], end[1]); rem -= L[i - 1]; }
    x.stroke(); x.setLineDash([]);
    if (o.head && k > 0 && k < 1) { x.fillStyle = o.color ?? C.accent; x.beginPath(); x.arc(end[0], end[1], 7, 0, 7); x.fill(); }
  } };
}
// place(at3d, title, { t0, t1, dot, sub }) a black city/airport tag pinned to a 3D point
export function place(p3, title, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'place label', text: title, draw(x, t, a, S) {
    const [X, Y, ok] = S.proj(p3); if (!ok) return;
    x.fillStyle = o.color ?? C.accent; x.beginPath(); x.arc(X, Y, 6 * a, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
    x.font = F.h(o.size ?? 20); x.letterSpacing = '1px'; const w = x.measureText(title).width + 20, h = 32, bx = X + (o.dx ?? -w / 2), by = Y + (o.dy ?? -50);
    x.save(); x.globalAlpha *= a; x.fillStyle = o.fill ?? C.ink; rr(x, bx, by, w, h, 2); x.fill(); x.fillStyle = '#fff'; x.fillText(title, bx + 10, by + 23); x.restore();
    if (o.sub) { x.fillStyle = THEME.ov.sub; x.font = F.m(16); x.letterSpacing = '1.5px'; x.fillText(o.sub, bx, by + h + 18); }
  } };
}
// source(text, { t0 }) small mono source line bottom-left
export function source(text, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'source line', text, draw(x) { x.fillStyle = THEME.ov.src; x.font = F.m(17); x.letterSpacing = '.5px'; x.fillText(text, o.x ?? (VERT ? OV_SAFE.l : 64), o.y ?? FH - (VERT ? OV_SAFE.b - 20 : 34)); } };
}
// photo(key, { x, y, w, h, t0, t1, caption, credit, focus: [fx, fy], zoom }) a real photograph in a white print frame with a
// mono caption + credit under it; slow push-in (Ken Burns) toward focus. `key` = an IMG key (project.json images).
export function photo(key, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'photo', text: o.caption ? `${o.caption} (image ${key})` : `image ${key}`, draw(x, t, a) {
    const im = IMG[key]; if (!im) return;
    // vertical: a centred print in the upper half (the 3D stays visible below it), as wide as the column allows
    const w = Math.min(o.w ?? (VERT ? 780 : 520), FW - 2 * OV_SAFE.l - 28), h = o.h ?? Math.round(w * im.height / im.width), pad = 14, cap = o.caption ? 58 : 0;
    const X = o.x ?? (VERT ? (FW - w) / 2 : FW - w - 90), Y = (o.y ?? (VERT ? OV_SAFE.t + 60 : 170)) + rise(a, 22);
    x.font = F.h(19, 800); x.letterSpacing = '.5px'; const cw1 = x.measureText((o.caption ?? '').toUpperCase()).width; x.font = F.m(14); const cw = Math.max(w, cw1, o.credit ? x.measureText(o.credit).width : 0);
    x.save(); x.shadowColor = 'rgba(0,0,0,.16)'; x.shadowBlur = 40; x.shadowOffsetY = 14; x.fillStyle = '#fbfbfa'; rr(x, X - pad, Y - pad, cw + pad * 2, h + pad * 2 + cap, 3); x.fill(); x.restore();
    // crop to the frame, slow zoom toward the focus point
    const k = seg(t, o.t0 ?? 0, (o.t1 ?? (o.t0 ?? 0) + 6) + .3), z = 1 + (o.zoom ?? .06) * k, [fx, fy] = o.focus ?? [.5, .45];
    const ar = w / h, ia = im.width / im.height; let sw = im.width, sh = im.height; if (ia > ar) sw = sh * ar; else sh = sw / ar;
    sw /= z; sh /= z; const sx = clamp(fx * im.width - sw / 2, 0, im.width - sw), sy = clamp(fy * im.height - sh / 2, 0, im.height - sh);
    x.drawImage(im, sx, sy, sw, sh, X, Y, w, h);
    if (o.caption) { x.fillStyle = C.ink; x.font = F.h(19, 800); x.letterSpacing = '.5px'; x.fillText(o.caption.toUpperCase(), X, Y + h + 30); }
    if (o.credit) { x.fillStyle = '#5d636a'; x.font = F.m(14); x.letterSpacing = '.5px'; x.fillText(o.credit, X, Y + h + (o.caption ? 52 : 28)); }
  } };
}
// footage(prefix, n, { fps, x, y, w, t0, t1, from, label, credit }) real video as an image sequence (IMG[prefix + i]),
// in the same print frame with a REC-style label; plays in sync with the timeline (deterministic for export)
export function footage(prefix, n, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, what: 'footage', text: o.caption ? `${o.caption} (footage ${prefix})` : `footage ${prefix}`, draw(x, t, a) {
    const f = clamp(Math.floor((t - (o.t0 ?? 0)) * (o.fps ?? 15)) + (o.from ?? 0), 0, n - 1), im = IMG[prefix + f]; if (!im) return;
    const w = Math.min(o.w ?? (VERT ? 860 : 640), FW - 2 * OV_SAFE.l - 28), h = Math.round(w * im.height / im.width), pad = 14, X = o.x ?? (VERT ? (FW - w) / 2 : FW - w - 90), Y = (o.y ?? (VERT ? OV_SAFE.t + 60 : 170)) + rise(a, 22);
    // the card is as wide as its widest line (picture, caption or credit), never narrower than its text
    x.font = F.h(19, 800); x.letterSpacing = '.5px'; const cw1 = x.measureText((o.caption ?? '').toUpperCase()).width; x.font = F.m(14); const cw2 = o.credit ? x.measureText(o.credit).width : 0;
    const cw = Math.max(w, cw1, cw2);
    x.save(); x.shadowColor = 'rgba(0,0,0,.16)'; x.shadowBlur = 40; x.shadowOffsetY = 14; x.fillStyle = '#fbfbfa'; rr(x, X - pad, Y - pad, cw + pad * 2, h + pad * 2 + 58, 3); x.fill(); x.restore();
    x.drawImage(im, X, Y, w, h);
    x.fillStyle = C.red; x.beginPath(); x.arc(X + 22, Y + 24, 7, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = F.m(16, 700); x.letterSpacing = '2px'; x.fillText(o.label ?? 'FOOTAGE', X + 38, Y + 30);
    x.fillStyle = C.ink; x.font = F.h(19, 800); x.letterSpacing = '.5px'; x.fillText((o.caption ?? '').toUpperCase(), X, Y + h + 30);
    if (o.credit) { x.fillStyle = '#5d636a'; x.font = F.m(14); x.letterSpacing = '.5px'; x.fillText(o.credit, X, Y + h + 52); }
  } };
}
// ---------- v7: full-screen b-roll, source credits ----------
// sources('Outlet - Title (Year)', ...): register the film's sources once at the top of a scene file, in the order they
// should be numbered; sourceNo(text) -> its [n] (a source not registered is added at the end, the first time it is drawn).
export const SOURCES = [];
export function sources(...list) { for (const s of list.flat()) if (s && !SOURCES.includes(s)) SOURCES.push(s); return SOURCES; }
export function sourceNo(text) { if (!text) return null; let i = SOURCES.indexOf(text); if (i < 0) { SOURCES.push(text); i = SOURCES.length - 1; } return i + 1; }
// the credit box: bottom-left, tiny white mono on a translucent dark box: "[n] ; Outlet - Title (Year)"
function drawCredit(x, text, n, o = {}) {
  const s = n != null ? `[${n}] ; ${text}` : text;
  x.save(); x.font = F.m(o.size ?? 16); x.letterSpacing = '.3px'; x.textBaseline = 'middle';
  const w = x.measureText(s).width + 16, h = (o.size ?? 16) + 12, X = o.x ?? (VERT ? OV_SAFE.l : 28), Y = (o.y ?? FH - (VERT ? OV_SAFE.b - 40 : 26)) - h;
  x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(X, Y, w, h); x.fillStyle = 'rgba(255,255,255,.92)'; x.fillText(s, X + 8, Y + h / 2 + 1); x.restore();
}
// cite(text, { n, t0, t1, x, y }): the same credit on any shot (3D reconstructions carry footnotes too). n: number, or
// omitted = sourceNo(text); n: false = no number.
export function cite(text, o = {}) {
  return { t0: o.t0 ?? 0, t1: o.t1, fin: o.fin ?? .2, what: 'source credit', text, draw(x) { drawCredit(x, text, o.n === false ? null : o.n ?? sourceNo(text), o); } };
}
// deterministic noise tiles for b-roll grain (seeded, so preview == render)
const NOISE = (() => { let s = 1234567; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  return [0, 1, 2, 3].map(() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), d = x.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.round(rnd() * 255); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; }); })();
const BC = document.createElement('canvas'); BC.width = FW; BC.height = FH; const bcx = BC.getContext('2d');
const CZ = document.createElement('canvas'); const czx = CZ.getContext('2d');
// broll(keyOrPrefix, { t0, t1, n, fps, from, loop, zoom, focus: [fx, fy], pan: [dx, dy], fit: 'cover' | 'contain', grade,
//   censor: [{ x, y, w, h, t0, t1, block }], credit, num, fin, fout, cover })
// Real footage or a photo EDGE TO EDGE (the documentary's archival / stock / news cutaway), no print frame:
//   key: an IMG key (one picture) or, with n, a numbered frame sequence IMG[prefix + i] played at fps (like footage()).
//   cover crop to 1920x1080 (fit: 'contain' letterboxes on black); Ken Burns: zoom (default .05 over the item) toward
//   focus, pan [dx, dy] in fractions of the frame over the item.
//   grade (default on; false = the raw picture; or { lift, cap, desat, contrast, grain, vignette }): faded blacks, milky capped
//   highlights, a little desaturation, deterministic grain and a soft vignette (THEME.broll has the defaults).
//   censor: pixel-block rects (x, y, w, h as 0-1 fractions of the frame, or pixels when > 1) between their t0/t1.
//   credit: 'Outlet - Title (Year)' drawn bottom-left as "[n] ; ..." (num: the number, default sourceNo(credit); false = none).
//   Defaults: fin 0 and fout 0 (it cuts in and out like a shot). While it covers the frame fully (no fade, fit cover)
//   the shot's 3D is not rendered at all (cover: false keeps rendering it, e.g. for a picture that is only part-covering).
// v9.1 fit: 'print' (a source too small to fill the frame sharply): the picture whole, centred, never magnified more than
//   PRINT_MAG (incl. the Ken Burns zoom), over a blurred dark copy of itself. brollRect(o, im, t) -> { dx, dy, dw, dh, s }:
//   where the picture lands at t (scenes that draw on a picture map points with it).
export const PRINT_MAG = 1.4;
export function brollRect(o, im, t) {
  const t0 = o.t0 ?? 0, end = o.t1 ?? (t0 + 6), k = seg(t, t0, end), z = 1 + (o.zoom ?? .05) * E.inOutSine(k), [fx, fy] = o.focus ?? [.5, .5], [px, py] = o.pan ?? [0, 0];
  const fit = o.fit === 'print' ? Math.min(FW / im.width, FH / im.height, PRINT_MAG / (1 + Math.max(0, o.zoom ?? .05))) : o.fit === 'contain' ? Math.min(FW / im.width, FH / im.height) : Math.max(FW / im.width, FH / im.height);
  const s = fit * z, dw = im.width * s, dh = im.height * s, inside = o.fit === 'contain' || o.fit === 'print';
  let dx = FW / 2 - fx * dw, dy = FH / 2 - fy * dh;
  if (!inside) { dx = clamp(dx, FW - dw, 0); dy = clamp(dy, FH - dh, 0); } else { dx = (FW - dw) / 2; dy = (FH - dh) / 2; }
  dx += px * FW * E.inOutSine(k); dy += py * FH * E.inOutSine(k);
  if (!inside) { dx = clamp(dx, FW - dw, 0); dy = clamp(dy, FH - dh, 0); }
  return { dx, dy, dw, dh, s };
}
export function broll(key, o = {}) {
  const G = o.grade === false ? null : { ...THEME.broll, ...(typeof o.grade === 'object' ? o.grade : {}) };
  const t0 = o.t0 ?? 0, num = o.num === false ? null : o.num, it = { t0, t1: o.t1, fin: o.fin ?? 0, fout: o.fout ?? 0, what: 'broll',
    text: o.credit ? `${o.credit} (${o.n ? 'footage' : 'image'} ${key})` : `${o.n ? 'footage' : 'image'} ${key}`, cover: o.cover !== false && o.fit !== 'contain', key, o };
  it.frame = t => { if (!o.n) return IMG[key];
    let f = Math.floor((t - t0) * (o.fps ?? 24) + 1e-6) + (o.from ?? 0); f = o.loop ? ((f % o.n) + o.n) % o.n : clamp(f, 0, o.n - 1); return IMG[key + f]; };
  it.draw = (x, t, a) => {
    const im = it.frame(t);
    bcx.setTransform(1, 0, 0, 1, 0, 0); bcx.globalCompositeOperation = 'source-over'; bcx.globalAlpha = 1; bcx.filter = 'none'; bcx.fillStyle = '#000'; bcx.fillRect(0, 0, FW, FH);
    if (im && im.width) {
      const { dx, dy, dw, dh } = brollRect(o, im, t);
      bcx.imageSmoothingEnabled = true; bcx.imageSmoothingQuality = 'high';
      if (o.fit === 'print') {   // the soft backdrop: the same picture cover-scaled, heavily blurred and darkened (no detail to pixelate)
        const sb = Math.max(FW / im.width, FH / im.height) * 1.08; bcx.filter = 'blur(36px) brightness(.42) saturate(.6)';
        bcx.drawImage(im, (FW - im.width * sb) / 2, (FH - im.height * sb) / 2, im.width * sb, im.height * sb); bcx.filter = 'none';
        bcx.save(); bcx.shadowColor = 'rgba(0,0,0,.6)'; bcx.shadowBlur = 40; bcx.fillStyle = '#000'; bcx.fillRect(dx, dy, dw, dh); bcx.restore(); }
      if (G) bcx.filter = `saturate(${(1 - G.desat).toFixed(3)}) contrast(${G.contrast.toFixed(3)})`;
      bcx.drawImage(im, dx, dy, dw, dh); bcx.filter = 'none';
      for (const c of o.censor || []) {                              // pixel-block censor (deterministic: pure downscale)
        if (t < (c.t0 ?? -1e9) || t > (c.t1 ?? 1e9)) continue;
        const px2 = v => v <= 1 ? v : null, X = Math.round(px2(c.x) != null ? c.x * FW : c.x), Y = Math.round(px2(c.y) != null ? c.y * FH : c.y),
          Wd = Math.max(2, Math.round(px2(c.w) != null ? c.w * FW : c.w)), Ht = Math.max(2, Math.round(px2(c.h) != null ? c.h * FH : c.h)), b = c.block ?? 28;
        CZ.width = Math.max(1, Math.ceil(Wd / b)); CZ.height = Math.max(1, Math.ceil(Ht / b));
        czx.imageSmoothingEnabled = true; czx.drawImage(BC, X, Y, Wd, Ht, 0, 0, CZ.width, CZ.height);
        bcx.imageSmoothingEnabled = false; bcx.drawImage(CZ, 0, 0, CZ.width, CZ.height, X, Y, Wd, Ht); bcx.imageSmoothingEnabled = true;
      }
      if (G) {
        // capped highlights + faded blacks: c * (cap - lift) + lift
        bcx.globalCompositeOperation = 'multiply'; const m = Math.round(clamp(G.cap - G.lift) * 255); bcx.fillStyle = `rgb(${m},${m},${m})`; bcx.fillRect(0, 0, FW, FH);
        bcx.globalCompositeOperation = 'lighter'; const l = Math.round(G.lift * 255); bcx.fillStyle = `rgb(${l},${l},${l + 1})`; bcx.fillRect(0, 0, FW, FH);
        bcx.globalCompositeOperation = 'source-over';
        if (G.vignette > 0) { const g = bcx.createRadialGradient(FW / 2, FH / 2, FH * .35, FW / 2, FH / 2, FW * .62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${G.vignette})`); bcx.fillStyle = g; bcx.fillRect(0, 0, FW, FH); }
        if (G.grain > 0) { const f = Math.floor(t * 24 + 1e-6), tile = NOISE[((f % 4) + 4) % 4], ox = (f * 97) % 256, oy = (f * 61) % 256;
          bcx.globalCompositeOperation = 'overlay'; bcx.globalAlpha = clamp(G.grain * 4); bcx.fillStyle = bcx.createPattern(tile, 'repeat');
          bcx.translate(-ox, -oy); bcx.fillRect(ox, oy, FW, FH); bcx.setTransform(1, 0, 0, 1, 0, 0); bcx.globalAlpha = 1; bcx.globalCompositeOperation = 'source-over'; }
      }
    }
    x.drawImage(BC, 0, 0, FW, FH);
    if (o.credit) drawCredit(x, o.credit, num === null ? null : num ?? sourceNo(o.credit));
  };
  return it;
}
// cutAt(word, near, { lead = .04, fps = 30 }): where a cut for `word` goes: one frame BEFORE the word starts (cue(word,
// near) - lead), snapped to the frame grid, so the new picture is on screen when the word is heard
export function cutAt(word, near, o = {}) { const fps = o.fps ?? 30, s = cue(word, near) - (o.lead ?? .04); return Math.max(0, Math.round(s * fps) / fps); }
// custom(fn(x, t, a, S), { t0, t1 })
export const custom =(fn, o = {}) => ({ t0: o.t0 ?? 0, t1: o.t1, fin: o.fin, what: o.what ?? 'overlay', text: o.text ?? null, draw: fn });
export const FONT = F;

// ---------- frame ----------
const vig = (() => { const c = document.createElement('canvas'); c.width = FW; c.height = FH; const x = c.getContext('2d');
  const g = x.createRadialGradient(FW / 2, FH / 2, FH * .45, FW / 2, FH / 2, FW * .62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,40,36,.10)');
  x.fillStyle = g; x.fillRect(0, 0, FW, FH); return c; })();
function render3d(S, alpha, t = 0) {
  if (!POST_ON) { renderer.setRenderTarget(null); renderer.render(S.scene, S.cam); }
  else {
    const P = POST, o = gfxPost(S.post);
    for (const p of [P.rp, P.ao, P.dof]) { p.scene = S.scene; p.camera = S.cam; }
    P.ao.enabled = AO_ON && o.ao > 0;
    if (P.ao.enabled && P.ao._r !== o.ao) { P.ao.updateGtaoMaterial({ radius: o.ao, distanceExponent: 1.4, thickness: o.ao * 2, scale: 1, samples: PREVIEW ? 12 : 32, distanceFallOff: 1 }); P.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 12, rings: PREVIEW ? 2 : 3, samples: PREVIEW ? 8 : 24 }); P.ao._r = o.ao; }
    if (P.ao.enabled) { P.ao.gtaoMaterial.uniforms.cameraNear.value = S.cam.near; P.ao.gtaoMaterial.uniforms.cameraFar.value = S.cam.far; P.ao.depthRenderMaterial.uniforms.cameraNear.value = S.cam.near; P.ao.depthRenderMaterial.uniforms.cameraFar.value = S.cam.far; }
    P.dof.enabled = !!o.dof;
    if (o.dof) { const f = o.dof.focus; const u = P.dof.uniforms;
      u.focus.value = typeof f === 'function' ? f(t, S) : typeof f === 'number' ? f : S.cam.position.distanceTo(S.look);
      u.aperture.value = o.dof.aperture ?? .0015; u.maxblur.value = o.dof.maxblur ?? .006; u.nearClip.value = S.cam.near; u.farClip.value = S.cam.far; u.aspect.value = FW / FH; }
    P.bloom.enabled = o.bloom > 0; P.bloom.strength = o.bloom;
    P.grade.uniforms.time.value = t;
    renderer.setRenderTarget(null); P.composer.render();
  }
  // high-quality filtering only to shrink a supersampled image (exports: 2x); the preview's 3D image is the frame's size or
  // smaller, and high-quality ENLARGING of it on the processor (Safe display, Software) made Quarter preview slower than Full
  out.globalAlpha = alpha; out.imageSmoothingEnabled = true; out.imageSmoothingQuality = RW > FW ? 'high' : 'low'; out.drawImage(glCanvas, 0, 0, RW, RH, 0, 0, FW, FH); out.globalAlpha = 1;
}
export function compose(t) {
  const i = activeIndex(t);
  trim(i);
  if (!SUITE.pick) { out.fillStyle = C.bg; out.fillRect(0, 0, FW, FH); ov.clearRect(0, 0, FW, FH); }   // a pick leaves the frame on screen as it is
  if (!SHOTS.length) return outCanvas;
  const cur = SHOTS[i], nxt = SHOTS[i + 1];
  // dissolve: centred on the cut, both shots live
  let A = cur, B = null, k = 0;
  // v7 effect transitions are hard cuts at t0 with a frame effect around them; they never take part in the dip below
  const fxIn = i > 0 && FX.has(cur.trans) && t < cur.t0 + transSpan(cur)[1] ? cur : null;
  const fxOut = !fxIn && nxt && FX.has(nxt.trans) && t >= nxt.t0 - transSpan(nxt)[0] ? nxt : null;
  const into = !FX.has(cur.trans) && cur.trans !== 'cut' && i > 0 && t < cur.t0 + TRANS / 2, outof = nxt && !FX.has(nxt.trans) && nxt.trans !== 'cut' && t >= nxt.t0 - TRANS / 2;
  if (into) { A = SHOTS[i - 1]; B = cur; k = (t - (cur.t0 - TRANS / 2)) / TRANS; }
  else if (outof) { A = cur; B = nxt; k = (t - (nxt.t0 - TRANS / 2)) / TRANS; }
  // a dip through the studio grey, never a cross-dissolve: two 3D scenes are never on screen at once (no double exposure)
  k = clamp(k);
  const showB = B && k >= .5, S0 = step(showB ? B : A, t), fade = !B ? 1 : E.inOut(showB ? (k - .5) * 2 : 1 - k * 2);
  if (SUITE.pick) { pickOverlay(S0, t, fade); return outCanvas; }   // the editor asking what is under the cursor: no render needed
  // a shot that is all 2D (S.flat / S.skip3d) or fully covered by a broll() right now: no 3D render (v7)
  S0._covered = !!(S0.flat || S0.skip3d) || S0.ov.some(it => it.cover && t >= it.t0 && t <= outOf(it) && fadeOf(it, t) >= 1);
  if (!S0._covered) render3d(S0, fade, t);
  if (!POST_ON) out.drawImage(vig, 0, 0);   // the grade pass has its own vignette
  drawOverlay(S0, t, fade);
  out.drawImage(ovCanvas, 0, 0);
  const fx = fxIn || fxOut; if (fx) transFx(fx, t - fx.t0, SHOTS.indexOf(fx));
  return outCanvas;
}

// ---------- v7 transitions ----------
// shot({ trans }) kinds: 'cut' | 'dip' ('dissolve' and any older value: the dip through the room colour, .6 s centred on
// the cut, never a double exposure) | 'flash': 3 frames blooming to white, the cut on the white frame, 4 frames back
// (transDur .233) | 'glitch': 2 frames of colour tear on the outgoing shot, 3 frames of pixel mosaic on the incoming one
// (transDur .167, one composite of one shot at a time) | 'black': fade to black, hold `hold` s (default 0) at the start of
// the new shot, fade in (transDur .6 = both fades) | 'iris': the outgoing picture closes to a small rectangle
// (shot.iris = { x, y, w, h }: centre and size as 0-1 fractions of the frame, default centred 24% x 32%), holds it `hold` s
// (default .25), then cuts (transDur .5 = the close). All are pure functions of the time: preview == render.
export const TRANS_KINDS = ['cut', 'dip', 'dissolve', 'flash', 'glitch', 'black', 'iris'];
const FX = new Set(['flash', 'glitch', 'black', 'iris']);
export const transKind = s => s.trans === 'cut' ? 'cut' : FX.has(s.trans) ? s.trans : 'dip';
// [seconds before the cut, seconds after it] that a shot's transition takes
export function transSpan(s) {
  const d = s.transDur;
  if (s.trans === 'flash') { const D = d ?? 7 / 30; return [D * 3 / 7, D * 4 / 7]; }
  if (s.trans === 'glitch') { const D = d ?? 5 / 30; return [D * 2 / 5, D * 3 / 5]; }
  if (s.trans === 'black') { const D = d ?? .6; return [D / 2, (s.hold ?? 0) + D / 2]; }
  if (s.trans === 'iris') { const D = d ?? .5; return [D + (s.hold ?? .25), 0]; }
  if (s.trans === 'cut') return [0, 0];
  return [TRANS / 2, TRANS / 2];
}
const mkc = () => { const c = document.createElement('canvas'); c.width = FW; c.height = FH; return [c, c.getContext('2d')]; };
let GL3 = null;   // scratch canvases for the glitch, made on first use
const rng = seed => { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
function transFx(def, u, idx) {
  const [pre, post] = transSpan(def), kind = def.trans;
  out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.globalAlpha = 1; out.globalCompositeOperation = 'source-over';
  if (kind === 'flash') {
    // the bright parts bloom first ('lighter' adds), then the frame washes to white; the cut lands on the white frame
    const k = u < 0 ? E.inCubic(clamp(1 + u / pre)) : E.inOutSine(clamp(1 - u / post));
    out.globalCompositeOperation = 'lighter'; out.globalAlpha = k * .6; out.drawImage(outCanvas, 0, 0); out.globalAlpha = 1;
    out.globalCompositeOperation = 'source-over'; out.fillStyle = `rgba(255,255,255,${k.toFixed(4)})`; out.fillRect(0, 0, FW, FH);
  } else if (kind === 'black') {
    const D = def.transDur ?? .6, hold = def.hold ?? 0;
    const k = u < 0 ? E.inOut(clamp(1 + u / pre)) : u < hold ? 1 : E.inOut(clamp(1 - (u - hold) / (D / 2)));
    out.fillStyle = `rgba(0,0,0,${k.toFixed(4)})`; out.fillRect(0, 0, FW, FH);
  } else if (kind === 'iris') {
    const D = def.transDur ?? .5, hold = def.hold ?? .25, k = E.inOutCubic(clamp((u + D + hold) / D));
    const r = def.iris || {}, cx = (r.x ?? .5) * FW, cy = (r.y ?? .5) * FH, w = lerp(FW, (r.w ?? .24) * FW, k), h = lerp(FH, (r.h ?? .32) * FH, k);
    const X = lerp(0, cx - (r.w ?? .24) * FW / 2, k), Y = lerp(0, cy - (r.h ?? .32) * FH / 2, k);
    out.fillStyle = '#000'; out.beginPath(); out.rect(0, 0, FW, FH); out.rect(X, Y, w, h); out.fill('evenodd');
  } else if (kind === 'glitch') {
    GL3 ??= { a: mkc(), r: mkc(), c: mkc(), s: (() => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; })() };
    const [A, ax] = GL3.a, [R, rx] = GL3.r, [Cc, cx] = GL3.c, f = Math.round(u * 30), rnd = rng(idx * 7919 + (f + 50) * 104729);
    if (u < 0) {                                                       // colour tear: channel split + torn horizontal bands
      const amt = f <= -2 ? .6 : 1, sh = Math.round(6 + 14 * amt);
      ax.globalCompositeOperation = 'source-over'; ax.drawImage(outCanvas, 0, 0);
      for (const [x, col] of [[rx, '#ff0000'], [cx, '#00ffff']]) { x.globalCompositeOperation = 'source-over'; x.drawImage(A, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, FW, FH); x.globalCompositeOperation = 'source-over'; }
      ax.fillStyle = '#000'; ax.fillRect(0, 0, FW, FH); ax.globalCompositeOperation = 'lighter'; ax.drawImage(Cc, -sh, 0); ax.drawImage(R, sh, 0); ax.globalCompositeOperation = 'source-over';
      out.drawImage(A, 0, 0);
      for (let n = 0; n < 9 + Math.round(8 * amt); n++) { const y = Math.floor(rnd() * FH), hh = 4 + Math.floor(rnd() * 70), dx = Math.round((rnd() - .5) * 260 * amt); out.drawImage(A, 0, y, FW, hh, dx, y, FW, hh); }
      for (let n = 0; n < 5; n++) { out.fillStyle = ['#ff0040', '#00e5ff', '#ffffff', '#000000'][Math.floor(rnd() * 4)]; out.globalAlpha = .55 + .4 * rnd(); out.fillRect(Math.floor(rnd() * FW), Math.floor(rnd() * FH), 40 + rnd() * 300, 3 + rnd() * 18); }
      out.globalAlpha = 1;
    } else {                                                           // pixel mosaic, getting finer frame by frame
      const block = [44, 26, 12][clamp(f, 0, 2)], [Sc, sx] = GL3.s; Sc.width = Math.ceil(FW / block); Sc.height = Math.ceil(FH / block);
      sx.imageSmoothingEnabled = true; sx.drawImage(outCanvas, 0, 0, Sc.width, Sc.height);
      out.imageSmoothingEnabled = false; out.drawImage(Sc, 0, 0, Sc.width, Sc.height, 0, 0, Sc.width * block, Sc.height * block);
      for (let n = 0; n < 6; n++) { const y = Math.floor(rnd() * Sc.height), hh = 1 + Math.floor(rnd() * 3), dx = Math.round((rnd() - .5) * 8) * block;
        out.drawImage(Sc, 0, y, Sc.width, hh, dx, y * block, Sc.width * block, hh * block); }
      out.imageSmoothingEnabled = true;
    }
  }
  out.restore();
}

// ---------- click to select (the Suite's editor; host.js pick) ----------
// Overlays first (they sit on top): each visible item is drawn alone into a small scratch canvas; it is a hit only where it
// really has pixels under the cursor (SUITE.at, set by the host), and its box is the box of its pixels.
const PQ = .25, pkc = document.createElement('canvas'); pkc.width = FW * PQ; pkc.height = FH * PQ;
const pkx = pkc.getContext('2d', { willReadFrequently: true });
function pickOverlay(S, t, alpha) {
  const at = SUITE.at, W2 = pkc.width, H2 = pkc.height;
  for (const it of S.ov) {
    if (t < it.t0) continue; if (t > outOf(it)) continue;
    const a = E.outCubic(fadeOf(it, t)); if (alpha * a < .2) continue;
    pkx.setTransform(1, 0, 0, 1, 0, 0); pkx.clearRect(0, 0, W2, H2); pkx.save(); pkx.setTransform(PQ, 0, 0, PQ, 0, 0); pkx.globalAlpha = 1;
    try { it.draw(pkx, t, a, S); } catch { /* drawn (and reported) by the frame itself */ } pkx.restore();
    const d = pkx.getImageData(0, 0, W2, H2).data, on = (x, y) => x >= 0 && y >= 0 && x < W2 && y < H2 && d[(y * W2 + x) * 4 + 3] > 40;
    if (at) { const cx = Math.round(at[0] * PQ), cy = Math.round(at[1] * PQ); let hit = false;
      for (let dy = -2; dy <= 2 && !hit; dy++) for (let dx = -2; dx <= 2 && !hit; dx++) hit = on(cx + dx, cy + dy);
      if (!hit) continue; }
    let x0 = W2, y0 = H2, x1 = -1, y1 = -1;
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (d[(y * W2 + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) continue;
    SUITE.pick.push({ kind: it.what || 'overlay', text: it.text ?? null, key: null, x: x0 / PQ, y: y0 / PQ, w: (x1 - x0 + 1) / PQ, h: (y1 - y0 + 1) / PQ, alpha: alpha * a, src: it.src || null });
  }
}
// 3D: what a click can select. Not the floor, ground, map, terrain or water (userData.ground), nor see-through things
// (light beams, flow lines), nor anything marked userData.noPick.
export function PICKABLE(o) {
  if (!o.isMesh || o.userData.noPick || o.userData.ground) return false;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  return !(m?.transparent && (m.opacity ?? 1) < .6);
}
// selectable(obj, name, kind): mark a group as ONE thing for the editor's click-to-select (a click on any of its meshes
// selects the whole group), with a readable name. model(), actor() and the built-in builders (airliner, car1936, ...) do it.
export function selectable(o, name, kind) { if (name && !o.name) o.name = name; o.userData.pickRoot = true; if (kind) o.userData.kind = kind; return o; }
const isObj = v => v && typeof v === 'object' && !(v instanceof THREE.Object3D);
// where a thing lives in the shot's state (what build() returned): st.pilot, st.crowd.people[3], st.items[2].plane
function findKey(st, x) {
  if (!st || !x) return null;
  for (const [k, v] of Object.entries(st)) {
    if (v === x) return `st.${k}`;
    if (Array.isArray(v)) { const i = v.indexOf(x); if (i >= 0) return `st.${k}[${i}]`;
      for (let j = 0; j < v.length; j++) if (isObj(v[j])) for (const [k2, v2] of Object.entries(v[j])) if (v2 === x) return `st.${k}[${j}].${k2}`; }
    else if (isObj(v)) for (const [k2, v2] of Object.entries(v)) { if (v2 === x) return `st.${k}.${k2}`; if (Array.isArray(v2)) { const i = v2.indexOf(x); if (i >= 0) return `st.${k}.${k2}[${i}]`; } }
  }
  return null;
}
const within = (a, b) => { for (let o = a; o; o = o.parent) if (o === b) return true; return false; };   // a inside b (or b itself)
// pickTarget(hit, S, st) -> { key, kind, name, box, colors }: the thing a click on `hit` selects. host.js uses it when the
// engine has it (recon v4+); older engines fall back to the host's own rule (the outermost object sharing the st key).
export function pickTarget(hit, S, st) {
  const o = hit.object;
  // a person of a cast(): all people share one instanced mesh per body part; the instance says which person
  const api = o.userData.castOf;
  if (api && hit.instanceId != null) {
    const p = api.drawn?.[hit.instanceId];
    if (p) return { key: findKey(st, p), kind: 'person', name: p.name || `person ${p.i + 1} of the cast`, box: p.box(), colors: ['#' + p.color.getHexString()] };
  }
  let root = null; for (let a = o; a && !a.isScene; a = a.parent) if (a.userData.pickRoot) { root = a; break; }
  const key0 = o.userData._st || null;
  let kr = null; if (key0) { kr = o; while (kr.parent && !kr.parent.isScene && kr.parent.userData._st === key0) kr = kr.parent; }
  let top = o; while (top.parent && !top.parent.isScene) top = top.parent;
  // a model / builder group wins over a bigger st group around it (st.world holding the airliner selects the airliner);
  // an st thing inside it wins over it (st.door inside the model selects the door), an actor() selects as the whole actor
  let pick, key;
  if (root && root.userData.api) { pick = root; key = findKey(st, root.userData.api) ?? root.userData._st ?? key0; }
  else if (kr && (!root || within(kr, root))) { pick = kr; key = key0; }
  else if (root) { pick = root; key = root.userData._st ?? findKey(st, root) ?? (key0 ? `${key0} > ${root.name || 'object'}` : null); }
  else { pick = top; key = top.userData._st ?? null; }
  let named = null; for (let a = o; a && !a.isScene; a = a.parent) { if (a.name) { named = a.name; break; } if (a === pick) break; }
  const name = pick.name && named && named !== pick.name ? `${pick.name} > ${named}` : pick.name || named || null;
  let kind = null; for (let a = o; a && !a.isScene; a = a.parent) { if (a.userData.kind) { kind = a.userData.kind; break; } if (a === pick) break; }
  pick.updateMatrixWorld(true);
  return { object: pick, key, kind: kind ?? pick.userData.kind ?? null, name, box: new THREE.Box3().setFromObject(pick) };
}
// ---------- sound: scenes schedule sounds on the moments they show (the style's sound_design.py makes them) ----------
// sfx(type, t, { gain dB, pan -1..1, dur }) types: whoosh impact thud splash rumble creak tick beep alarm bubbles
// pan: -1 (left) .. 0 (centre) .. 1 (right), as sound_design.py reads it (the lowpoly engine's 0..1 is a different scale).
// v7: sfx() inside build(S) is collected by the event pass, which builds EVERY shot once (not only the ones the preview
// happened to build); sfx() at the top of a scene file (outside any build) is kept as before.
export const EVENTS = [];
export const OVERLAYS = [];   // the event pass: every S.over item { t, t1, what, text, shot } (sound for cards, b-roll, credits)
let COLLECT = false, BUILDING = 0;
export function sfx(type, t, o = {}) { if (t == null || !isFinite(t)) return; if (BUILDING && !COLLECT) return;   // shot sounds come from the event pass only
  EVENTS.push({ t: +(+t).toFixed(3), type, gain: o.gain ?? 0, pan: o.pan ?? 0, dur: o.dur ?? null, ...(BUILDING ? { shot: true } : {}) }); }
// collectEvents(end) -> { shots: [{ t0, trans, cut, name, dur, hold }], sfx: [...], overlays: [...], style: 'recon' }
//   shots[].trans: 'cut' | 'dip' | 'flash' | 'glitch' | 'black' | 'iris'; cut: true for the hard-cut kinds (cut, flash, glitch,
//   black, iris: no automatic whoosh in sound_design.py), false for the dip. The effect transitions add their own events
//   (marked auto: true): flash -> 'impact', glitch -> 'glitch', black -> 'riser' (into the black, dur = the fade), iris -> 'whoosh'.
export async function collectEvents(end) {
  if (end != null && SHOTS.length && SHOTS[SHOTS.length - 1].t1 == null) finalizeShots(end);
  for (let i = EVENTS.length - 1; i >= 0; i--) if (EVENTS[i].shot || EVENTS[i].auto) EVENTS.splice(i, 1);
  OVERLAYS.length = 0;
  SHOTS.forEach(dispose); COLLECT = true;   // (the preview rebuilds what it needs afterwards)
  try {
    for (const s of SHOTS) { try { live(s); } catch (e) { console.warn(`sound events: ${s._file}:${s._line}: ${e.message}`); } dispose(s); await new Promise(r => setTimeout(r, 0)); }
  } finally { COLLECT = false; }
  const shots = SHOTS.map(s => { const k = transKind(s); return { t0: +s.t0.toFixed(3), trans: k, cut: k !== 'dip', name: s.name || '', ...(FX.has(k) ? { dur: +transSpan(s).reduce((a, b) => a + b, 0).toFixed(3), hold: s.hold ?? null } : {}) }; });
  for (const s of SHOTS.slice(1)) {
    const k = transKind(s), [pre] = transSpan(s), at = v => +(+v).toFixed(3);
    if (k === 'flash') EVENTS.push({ t: at(s.t0 - pre * .5), type: 'impact', gain: -4, pan: 0, dur: null, auto: true, trans: k });
    else if (k === 'glitch') EVENTS.push({ t: at(s.t0 - pre), type: 'glitch', gain: -6, pan: 0, dur: +transSpan(s).reduce((a, b) => a + b, 0).toFixed(3), auto: true, trans: k });
    else if (k === 'black') EVENTS.push({ t: at(s.t0 - pre), type: 'riser', gain: -10, pan: 0, dur: +pre.toFixed(3), auto: true, trans: k });
    else if (k === 'iris') EVENTS.push({ t: at(s.t0 - pre), type: 'whoosh', gain: -10, pan: 0, dur: null, auto: true, trans: k });
  }
  const seen = new Set(), list = [];
  for (const e of [...EVENTS].sort((a, b) => a.t - b.t)) { const k = e.type + Math.round(e.t * 20); if (seen.has(k)) continue; seen.add(k); const { shot: _s, ...r } = e; void _s; list.push(r); }
  return { shots, hits: [], cards: [], sfx: list.filter(e => e.t >= 0 && (end == null || e.t <= end + 1)), overlays: OVERLAYS.slice().sort((a, b) => a.t - b.t), style: 'recon' };
}

// ---------- export (inside the Suite): WebCodecs H.264, streamed to the app's /append endpoint ----------
export async function exportVideo({ name = 'video', fps = 30, from = 0, to, bitrate = 16e6, onProgress } = {}) {
  const chunks = []; let bytes = 0, first = true, err = null;
  bitrate = { high: 28e6, max: 45e6 }[gv('exportBitrate')] ?? bitrate;   // v9 Graphics > Export quality > Encode quality
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
    gfxFrame(from + f / fps, fps);
    const vf = new VideoFrame(outCanvas, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
    while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 1));
    if (f % 30 === 0) { await flush(false); onProgress?.(f, n, (performance.now() - t0) / 1000); }
  }
  await enc.flush(); await flush(true); enc.close();
  const secs = (performance.now() - t0) / 1000;
  return { frames: n, seconds: +secs.toFixed(1), fps: +(n / secs).toFixed(1), realtime: +((to - from) / secs).toFixed(2) };
}

// ---------- the sign-off checks behind the Suite's check_layout tool (SIGNOFF.md; standalone: render.mjs) ----------
// checkTimes(): every 0.1 s of the film. layoutIssues(t): at every time the interpenetration check (shots that declare
// S.collide), once per shot the coplanar audit, and every 0.5 s the z-fight probe (the frame re-rendered with only the
// near plane scaled: any pixel that changes is an ambiguous depth test).
export const LAYOUT_CHECKS = [];   // kit modules push fn(S, t, def) -> [{ type, detail }] (run by layoutIssues)
export function checkTimes() { const end = SHOTS.length ? SHOTS[SHOTS.length - 1].t1 ?? SHOTS[SHOTS.length - 1].t0 + 4 : 0, ts = []; for (let t = 0; t <= end + 1e-6; t += .1) ts.push(+t.toFixed(2)); return ts; }
const zc = document.createElement('canvas'); zc.width = 480; zc.height = 270; const zx = zc.getContext('2d', { willReadFrequently: true });
const lum = () => { zx.drawImage(glCanvas, 0, 0, zc.width, zc.height); const d = zx.getImageData(0, 0, zc.width, zc.height).data, L = new Uint8Array(zc.width * zc.height); for (let i = 0; i < L.length; i++) L[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11; return L; };
export function layoutIssues(t) {
  const out = [], i = activeIndex(t), def = SHOTS[i]; if (!def) return out;
  const S = step(def, t), where = `${def.name || 'shot ' + (i + 1)} (${def._file || ''}:${def._line || 0})`;
  if (!def._audited) { def._audited = true; for (const m of S.audit()) out.push({ t, type: 'coplanar', what: where, detail: `two surfaces less than 1 cm apart will flicker (z-fight): ${m}. One surface per surface: paint the detail into one, or lift the top one at least 1 cm.` }); }
  // spatial consistency (contact.js): props that float or pass through each other. At the first time asked in a shot and then
  // every 2.5 s of it;
  // each problem said once per shot
  if (CONTACT && (def._contactT == null || Math.abs(t - def._contactT) >= 2.5)) { def._contactT = t; def._contactSeen ??= new Set();
    for (const c of CONTACT(S.scene, { camera: S.cam, height: FH, width: FW, later: () => step(def, t + .1), back: () => step(def, t) })) { const k = `${c.type}|${c.name}|${c.at.map(v => Math.round(v * 2)).join(',')}`; if (def._contactSeen.has(k)) continue; def._contactSeen.add(k);
      out.push({ t, type: c.type, what: where, detail: c.type === 'floating'
        ? `${c.detail}: rest it on the surface (its bottom on the surface y: hitAlong / a ray down), make the parts that belong together meet (a rail reaches its posts, a sign touches its pole), or mark it userData.airborne = true if it really flies, falls or is thrown.`
        : `${c.detail}: move, resize or re-pose one of them so they touch without passing through (a real opening only if the story has one).` }); } }
  if (S.collide && COLLIDE) for (const m of COLLIDE(S.collide)) out.push({ t, type: 'overlap', what: where, detail: `${m}: a body passes through ${/ inside /.test(m) ? 'a solid object' : 'another body'}. Move or re-pose it, or make the opening a real hole (SIGNOFF.md).` });
  if (Math.abs(t * 2 - Math.round(t * 2)) < .01) {           // z-fight every 0.5 s
    const mir = globalThis.__NOMIRROR; globalThis.__NOMIRROR = 1;
    compose(t); const f0 = lum(); let hit = 0; const seen = new Uint8Array(f0.length);
    for (const nm of [1.005, 1.013, .993]) { globalThis.__NEARMUL = nm; compose(t); globalThis.__NEARMUL = 1; const f1 = lum(); for (let p = 0; p < f0.length; p++) if (!seen[p] && Math.abs(f1[p] - f0[p]) > 40) { seen[p] = 1; hit++; } }
    globalThis.__NOMIRROR = mir; compose(t);
    if (hit * 4 > 150) out.push({ t, type: 'flicker', what: where, detail: `${hit * 4} px change when only the depth precision changes: z-fighting (stacked or coplanar surfaces, or a near plane too small for the scene: S.studio({ near, far })).` });
  }
  // v8: camera motion (once per shot) and visibility (a settled frame per shot, then every 1 s)
  if (!def._camChecked) { def._camChecked = true; out.push(...cameraIssues(def, i, where)); step(def, t); }
  // v9.1: kit checks (crime.js STRINGEND, crimeover.js TEXTPLACE / PIXELATED): fn(S, t, def) -> [{ type, detail }], each
  // type + detail said once per shot
  { const seen = def._kitSeen ??= new Set(); for (const fn of LAYOUT_CHECKS) { let r = []; try { r = fn(def._S ?? S, t, def) || []; } catch (e) { console.warn('layout check: ' + e.message); }
    for (const q of r) { const k = q.type + '|' + q.detail; if (seen.has(k)) continue; seen.add(k); out.push({ t, what: where, ...q }); } } }
  const [, tin] = transSpan(def), nx = SHOTS[i + 1], tout = nx ? transSpan(nx)[0] : 0;
  const settled = t >= def.t0 + tin + .25 && t <= (def.t1 ?? Infinity) - tout - .05;
  if (settled && (def._visT == null || Math.abs(t - Math.round(t)) < .01) && def._visT !== t) { def._visT = t; out.push(...visibilityIssues(def, t, where)); }
  return out;
}

// ---------- v8 VISIBILITY GATE ----------
// The 3D picture (after the grade, before the 2D overlay) at 480 x 270, display values 0-1:
//   DARK: mean < dark, or more than darkFrac of the pixels below darkPx | CRUSHED: more than crushFrac below crushPx |
//   SUBJECT: S.subject (or the lighting rig's subject) projected to a box: its mean < subject, or its contrast to the ring
//   around it < contrast | BLUR: the subject sits where the depth of field blurs it (its depth vs the focus distance times
//   the aperture) more than blur. A frame that is all black (mean < .008: a deliberate black) is not judged.
// Per shot: S.visibility = { dark, darkPx, darkFrac, crushPx, crushFrac, subject, contrast, blur } overrides (a deliberate
// silhouette: S.visibility = { subject: 0, contrast: 0 }), S.visibility = false turns the gate off for the shot.
export const VISIBILITY = { dark: .10, darkPx: .06, darkFrac: .85, crushPx: .03, crushFrac: .60, subject: .18, contrast: .04, blur: .0075 };
export function frameStats(S) {   // (the frame just composed) -> { mean, dark, crush, subj: { mean, ring, contrast, box } | null }
  const L = lum(), Wz = zc.width, Hz = zc.height, o = { ...VISIBILITY, ...(S.visibility || {}) }; let s = 0, nd = 0, nc = 0;
  const dk = o.darkPx * 255, ck = o.crushPx * 255; for (let p = 0; p < L.length; p++) { const v = L[p]; s += v; if (v < dk) nd++; if (v < ck) nc++; }
  const r = { mean: s / L.length / 255, dark: nd / L.length, crush: nc / L.length, subj: null };
  const b = subjectBox(S.subject ?? S._rig?.o.subject);
  if (b) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, front = false;
    for (let k = 0; k < 8; k++) { const [x, y, ok] = S.proj(new THREE.Vector3(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z)); if (ok) front = true; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const f = Wz / FW, X0 = Math.max(0, Math.floor(x0 * f)), Y0 = Math.max(0, Math.floor(y0 * f)), X1 = Math.min(Wz - 1, Math.ceil(x1 * f)), Y1 = Math.min(Hz - 1, Math.ceil(y1 * f));
    if (front && X1 - X0 > 4 && Y1 - Y0 > 4 && (X1 - X0) * (Y1 - Y0) > Wz * Hz * .004) {
      const mx = Math.round((X1 - X0) * .5), my = Math.round((Y1 - Y0) * .5); let si = 0, ni = 0, so = 0, no = 0;
      for (let y = Math.max(0, Y0 - my); y <= Math.min(Hz - 1, Y1 + my); y++) for (let x = Math.max(0, X0 - mx); x <= Math.min(Wz - 1, X1 + mx); x++) { const v = L[y * Wz + x];
        if (x >= X0 && x <= X1 && y >= Y0 && y <= Y1) { si += v; ni++; } else { so += v; no++; } }
      const m = si / Math.max(1, ni) / 255, ring = no ? so / no / 255 : m;
      // depth of field: how much the subject is blurred (BokehPass: |depth - focus| x aperture, capped at maxblur)
      let blur = 0; const d = S.post?.dof; if (POST_ON && d) { const ft = d.focus, fd = typeof ft === 'function' ? ft(S._tNow ?? 0, S) : typeof ft === 'number' ? ft : S.cam.position.distanceTo(S.look);
        const c = b.getCenter(new THREE.Vector3()).applyMatrix4(S.cam.matrixWorldInverse); blur = Math.min(Math.abs(-c.z - fd) * (d.aperture ?? .0015), d.maxblur ?? .006); }
      r.subj = { mean: m, ring, contrast: Math.abs(m - ring), blur, box: [X0 / f, Y0 / f, (X1 - X0) / f, (Y1 - Y0) / f].map(Math.round) };
    }
  }
  return r;
}
function visibilityIssues(def, t, where) {
  const S0 = def._S; if (!S0 || S0.visibility === false || S0.flat || S0.skip3d) return [];
  S0._tNow = t; compose(t); const S = def._S; if (!S || S._covered) return [];
  const o = { ...VISIBILITY, ...(S.visibility || {}) }, st = frameStats(S), out = [], seen = def._visSeen ??= new Set(), pct = v => Math.round(v * 100);
  if (st.mean < .008) return out;   // a deliberate full black
  const say = (type, detail) => { if (seen.has(type)) return; seen.add(type); out.push({ t, type, what: where, detail }); };
  if (st.mean < o.dark || st.dark > o.darkFrac) say('DARK', `the picture is too dark to read (mean ${st.mean.toFixed(3)} < ${o.dark}, ${pct(st.dark)} % of it below ${o.darkPx}): light it like a film set: S.lighting('lowKey', { subject }) (or 'threePoint' / 'window' / 'practical' / 'topDown' / 'void'): a soft key on the subject, fill, a rim and a wash on the wall behind.`);
  if (st.crush > o.crushFrac) say('CRUSHED', `${pct(st.crush)} % of the picture is crushed black (below ${o.crushPx}): light what matters instead: a key and a rim on the subject and a wash on the wall right behind it (S.lighting(...)); raise { amb } only a little - lifting ambient light flattens and greys the whole frame.`);
  if (st.subj && o.subject > 0 && (st.subj.mean < o.subject || st.subj.contrast < o.contrast)) say('SUBJECT', `the subject does not read (box ${st.subj.box.join(',')}: mean ${st.subj.mean.toFixed(3)}${st.subj.mean < o.subject ? ' < ' + o.subject : ''}, contrast to its surroundings ${st.subj.contrast.toFixed(3)}${st.subj.contrast < o.contrast ? ' < ' + o.contrast : ''}): aim the key at it (S.lighting(preset, { subject })) and separate it with the rim / a brighter wall wash.`);
  if (st.subj && o.blur > 0 && st.subj.blur > o.blur) say('BLUR', `the subject is out of focus (depth-of-field blur ${st.subj.blur.toFixed(4)} > ${o.blur}): focus on it (S.post.dof.focus = its distance, or S.cameraRig.rack) or narrow the aperture.`);
  return out;
}

// ---------- v8 camera motion check ----------
// The shot's camera sampled at 30 fps (the shot's own update/ticks run, so cameras driven by code count). Per frame: how far
// the picture moves (probe points round the look point re-projected with the next frame's camera, in frame widths),
// its acceleration and the view's angular speed. ABRUPT: peak acceleration > CAMERA_LIMITS.accel frame/s^2 (a move that
// starts or stops hard, a velocity jump at a key), a move under shortDur s that covers more than shortCover of the frame,
// or the view turning faster than peakDeg deg/s. A cut into a moving camera is fine (the first frame is not judged).
export function cameraTrace(def) {
  const S = def._S, [, tin] = transSpan(def), i = SHOTS.indexOf(def), nx = SHOTS[i + 1], t0 = def.t0 + tin, t1 = (def.t1 ?? def.t0 + 4) - (nx ? transSpan(nx)[0] : 0), dt = 1 / 30, fr = [];
  for (let t = t0; t <= t1 + 1e-6; t += dt) { step(def, t); fr.push({ t, m: S.cam.matrixWorld.clone(), pm: S.cam.projectionMatrix.clone(), p: S.cam.position.clone(), l: S.look.clone(), fov: S.cam.fov, fwd: S.cam.getWorldDirection(new THREE.Vector3()) }); }
  const cam = S.cam.clone(), tr = [];
  for (let k = 1; k < fr.length; k++) { const a = fr[k - 1], b = fr[k], D = Math.max(.05, a.p.distanceTo(a.l)), h = Math.tan(portraitFov(a.fov) * Math.PI / 360) * D, w = h * FW / FH;
    const r = new THREE.Vector3().setFromMatrixColumn(a.m, 0), u = new THREE.Vector3().setFromMatrixColumn(a.m, 1), c = a.p.clone().addScaledVector(a.fwd, D);
    const pts = [[0, 0], [.6, 0], [-.6, 0], [0, .6], [0, -.6]].map(([x, y]) => c.clone().addScaledVector(r, x * w).addScaledVector(u, y * h));
    const proj = (f, P) => { cam.matrixWorld.copy(f.m); cam.matrixWorldInverse.copy(f.m).invert(); cam.projectionMatrix.copy(f.pm); const q = P.clone().project(cam); return [q.x / 2, q.y / 2 * FH / FW]; };
    const d = pts.map(P => { const A = proj(a, P), B = proj(b, P); return [B[0] - A[0], B[1] - A[1]]; });
    tr.push({ t: b.t, d, v: d.reduce((s, q) => s + Math.hypot(q[0], q[1]), 0) / d.length / dt, deg: a.fwd.angleTo(b.fwd) * 180 / Math.PI / dt }); }
  for (let k = 1; k < tr.length; k++) tr[k].a = tr[k].d.reduce((s, q, j) => s + Math.hypot(q[0] - tr[k - 1].d[j][0], q[1] - tr[k - 1].d[j][1]), 0) / tr[k].d.length / dt / dt;
  return tr;
}
function cameraIssues(def, i, where) {
  if (!def._S || def._S.flat || def._S.skip3d) return [];
  const tr = cameraTrace(def), L = CAMERA_LIMITS, out = [];
  let pa = 0, pt = 0, pd = 0, dt0 = 0; for (const f of tr) { if ((f.a ?? 0) > pa) { pa = f.a; pt = f.t; } if (f.deg > pd) { pd = f.deg; dt0 = f.t; } }
  // moves: runs of frames with motion; a short one that covers a lot of the frame is a jump, not a camera move
  const moves = []; let cur = null; for (const f of tr) { if (f.v > .02) { cur ??= { t0: f.t, cover: 0, n: 0 }; cur.cover += f.v / 30; cur.n++; cur.t1 = f.t; } else if (cur) { moves.push(cur); cur = null; } } if (cur) moves.push(cur);
  const short = moves.find(m => m.n / 30 < L.shortDur && m.cover > L.shortCover && !(m.t0 <= tr[0]?.t + .001 && m.t1 >= tr[tr.length - 1].t - .001));
  def._camStats = { peakAccel: +pa.toFixed(3), at: +pt.toFixed(2), peakDeg: +pd.toFixed(1), moves: moves.map(m => ({ t0: +m.t0.toFixed(2), dur: +(m.n / 30).toFixed(2), cover: +m.cover.toFixed(3) })) };
  const why = [];
  if (pa > L.accel) why.push(`the picture accelerates ${pa.toFixed(1)} frame/s^2 at ${pt.toFixed(2)} s (limit ${L.accel}: a move that starts or stops hard, or jumps speed at a key)`);
  if (short) why.push(`a ${(short.n / 30).toFixed(2)} s move at ${short.t0.toFixed(2)} s sweeps ${Math.round(short.cover * 100)} % of the frame (limit ${Math.round(L.shortCover * 100)} % under ${L.shortDur} s)`);
  if (pd > L.peakDeg) why.push(`the view turns ${pd.toFixed(0)} deg/s at ${dt0.toFixed(2)} s (limit ${L.peakDeg})`);
  if (why.length) out.push({ t: +(pt || def.t0).toFixed(2), type: 'ABRUPT', what: where, detail: `camera: ${why.join('; ')}. Use S.cameraRig.push / drift / arc / crane (eased from rest to rest, >= ${L.minPush} s) or S.camera(keys, { smooth: true }); cut instead of whipping.` });
  return out;
}
let COLLIDE = null; import('./lib/collide.js').then(m => { COLLIDE = m.check; }).catch(() => {});
let CONTACT = null; import('./lib/contact.js').then(m => { CONTACT = m.contacts; }).catch(() => {});   // (projects from before v3 have no contact.js: skipped)   // standalone and Suite layouts both have it beside the engine

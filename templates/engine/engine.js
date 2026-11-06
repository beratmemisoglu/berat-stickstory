// Toon Studio engine (pixel-explainer v2): pixel-art 3D (configurable art resolution, HUD in 320x180 units,
// 16-colour palette, faceted ramps, cast shadows, depth + object-ID outlines, rim light, dithered skies/fog) +
// a 1080p HUD in retro fonts, a shot system with 5 dithered transition styles, word-synced cues, real-image
// cards, an event pass for sound design, WebCodecs H.264 export, and picking hooks for the Suite editor.
// Settings: the Suite host sets globalThis.__CZ_SETTINGS (project.json "settings") before importing this
// module; every value has a default, so the engine also runs standalone.
import * as THREE from 'three';
export { THREE };

THREE.ColorManagement.enabled = false;           // every color is a literal sRGB palette value
export const DEFAULTS = {
  art: { width: 480, height: 270 },                                  // 3D render resolution (1920 must divide by width)
  outline: { depth: true, objectId: true, rim: true, fogFade: true, color: '#1a1c2c' },
  shadows: { enabled: true, mapSize: 4096 },
  post: { vignette: .35, dither: .05 },
  transitions: { duration: .42, chapterDuration: .5, pixelateMax: 12 },
  camera: { fov: 40, push: .04 },
  palette: null,                                                     // optional { bg: '#..', plum: '#..', ... } override
  // engine v10 "Hi-Bit": palette 'hibit' = ~100 colours (99) in 5-step ramps (deep, shadow, mid, lit, top) instead of the 16-colour
  // set; bands 5 = five lighting steps per surface (0 = 5 for hibit, 3 otherwise). The legacy look is unchanged.
  color: { palette: 'sweetie16', bands: 0 },
};
const merge = (a, b) => { const o = { ...a }; for (const k in b || {}) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; };
export const SETTINGS = merge(DEFAULTS, globalThis.__CZ_SETTINGS || {});
export const ENGINE_VERSION = 10;                                 // bump when the Suite ships engine changes (projects get an Update button)
export const HIBIT = SETTINGS.color?.palette === 'hibit';
export const BANDS = HIBIT ? (SETTINGS.color.bands === 3 ? 3 : 5) : 3;
export const W = 320, H = 180, K = 6, FW = W * K, FH = H * K;   // HUD space (art px) and output size
export const AW = SETTINGS.art.width, AH = SETTINGS.art.height, AK = FW / AW;   // 3D art resolution
// the Suite's live preview on a slow computer (host.js sets __CZ_PREVIEW_SCALE, never for exports or stills): the frame is
// drawn smaller, still a whole number of screen pixels per art pixel so the pixels stay crisp. FW/FH/W/H do not change.
const PM = (+globalThis.__CZ_PREVIEW_SCALE || 1) >= 1 ? AK : Math.max(1, Math.round(AK * globalThis.__CZ_PREVIEW_SCALE));
const OW = AW * PM, OH = AH * PM;                                    // the size the frame is drawn at (FW x FH unless previewing smaller)
export const PREVIEW_SCALE = OW / FW;
// Suite hooks: `module` = scene file being imported (set by the host), `pick` = array collecting HUD boxes
// while the host runs a pick pass, `base` = URL prefix for the frame/append sinks.
export const SUITE = { module: null, pick: null, base: '' };
function caller() {                        // { file, line } of the project code that called into the engine
  const st = (new Error().stack || '').split('\n');
  for (const l of st) {
    if (l.includes('/engine.js')) continue;
    const m = l.match(/((?:scenes\/)?[\w.-]+\.js):(\d+):\d+/);
    if (m && !m[1].startsWith('host')) return { file: m[1], line: +m[2] };
  }
  return null;
}
export const C = {bg:"#1a1c2c", plum:"#5d275d", red:"#b13e53", orange:"#ef7d57", yellow:"#ffcd75", lime:"#a7f070",
  green:"#38b764", teal:"#257179", navy:"#29366f", blue:"#3b5dc9", sky:"#41a6f6", cyan:"#73eff7", white:"#f4f4f4",
  silver:"#94b0c2", slate:"#566c86", dark:"#333c57", ...(SETTINGS.palette || {})};
// faceted shading ramps: [shadow side, lit side, top]
export const RAMP = {
  white: [C.slate, C.silver, C.white], grey: [C.dark, C.slate, C.silver], black: [C.bg, C.dark, C.slate],
  blue: [C.navy, C.blue, C.sky], cyan: [C.blue, C.sky, C.cyan], red: [C.plum, C.red, C.orange],
  orange: [C.red, C.orange, C.yellow], yellow: [C.orange, C.yellow, C.white], green: [C.teal, C.green, C.lime],
  lime: [C.green, C.lime, C.white], plum: [C.bg, C.plum, C.red], teal: [C.navy, C.teal, C.green],
  navy: [C.bg, C.navy, C.blue], sky: [C.blue, C.sky, C.cyan], dark: [C.bg, C.dark, C.dark], sand: [C.red, C.orange, C.yellow], stone: [C.dark, C.slate, C.silver],
  // 'Flat' variants keep the named colour on top faces (yellow/lime/white tops otherwise go one step lighter)
  yellowFlat: [C.orange, C.yellow, C.yellow], limeFlat: [C.green, C.lime, C.lime], orangeFlat: [C.red, C.orange, C.orange], cyanFlat: [C.sky, C.cyan, C.cyan],
};
// ---------- Hi-Bit (v10) ----------
// More materials by name in BOTH looks (the legacy look approximates them with its 16 colours), so scenes and libs written
// for Hi-Bit still draw in old projects. In Hi-Bit every RAMP is 5 steps [deep, shadow, mid, lit, top] and the frame is
// quantized to every colour the ramps use (PALETTE, 99) instead of 16.
Object.assign(RAMP, {
  skin: [C.red, C.orange, C.yellow], skinDark: [C.plum, C.red, C.orange], hair: [C.bg, C.dark, C.slate], brown: [C.plum, C.red, C.orange],
  wood: [C.plum, C.red, C.orange], asphalt: [C.bg, C.dark, C.dark], concrete: [C.dark, C.slate, C.silver], glass: [C.navy, C.blue, C.sky],
  gold: [C.orange, C.yellow, C.white], purple: [C.bg, C.plum, C.red], pink: [C.plum, C.red, C.orange], denim: [C.navy, C.blue, C.sky],
  olive: [C.teal, C.green, C.lime], neonPink: [C.plum, C.red, C.orange], neonCyan: [C.teal, C.sky, C.cyan], paper: [C.slate, C.silver, C.white],
  rubber: [C.bg, C.dark, C.dark], metal: [C.dark, C.slate, C.silver], carbon: [C.bg, C.bg, C.dark],
});
const HB = {   // 5-step ramps: deep, shadow, mid, lit, top
  white: ['#566c86', '#94b0c2', '#c3d2dd', '#e6edf2', '#ffffff'], grey: ['#1a1c2c', '#333c57', '#566c86', '#94b0c2', '#c3d2dd'],
  black: ['#0d0f1a', '#1a1c2c', '#262b40', '#333c57', '#566c86'], blue: ['#141d4a', '#29366f', '#3b5dc9', '#5b8ff0', '#8ec5ff'],
  cyan: ['#1e4f63', '#257179', '#2fa3b0', '#73eff7', '#c8fbff'], sky: ['#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#c8fbff'],
  red: ['#2a1028', '#5d275d', '#b13e53', '#e05a5a', '#ff8a7a'], orange: ['#5d275d', '#b13e53', '#ef7d57', '#ff9e6b', '#ffcd75'],
  yellow: ['#8a4a22', '#d9822b', '#ffcd75', '#ffe7a8', '#fff6dc'], green: ['#12303a', '#1d5e44', '#38b764', '#6fd36a', '#a7f070'],
  lime: ['#1d5e44', '#38b764', '#a7f070', '#d4f7a0', '#f4ffd8'], plum: ['#1a1c2c', '#3a1a3f', '#5d275d', '#8a3f7a', '#b85fa0'],
  teal: ['#12303a', '#1e4f63', '#257179', '#2e9a7f', '#4fc78d'], navy: ['#0d0f1a', '#141d4a', '#29366f', '#3b5dc9', '#5b8ff0'],
  dark: ['#0d0f1a', '#1a1c2c', '#262b40', '#333c57', '#333c57'], sand: ['#6e4128', '#b0703c', '#d9a066', '#eec691', '#fff0c8'],
  stone: ['#262b40', '#3a3d47', '#5b5f6b', '#80848f', '#a9adb5'],
  skin: ['#4a2c1e', '#8a5235', '#c47f5a', '#e8a87c', '#f8d0ac'], skinDark: ['#2a1a14', '#4a2c1e', '#6e4128', '#9a5f38', '#c47f5a'],
  hair: ['#0d0f1a', '#1a1c2c', '#2a1a14', '#4a2c1e', '#6e4128'], brown: ['#2a1a14', '#4a2c1e', '#6e4128', '#9a5f38', '#c4864f'],
  wood: ['#2a1a14', '#4a2c1e', '#6e4128', '#9a5f38', '#c4864f'], asphalt: ['#0d0f1a', '#14161f', '#22252f', '#30343f', '#454a57'],
  concrete: ['#3a3d47', '#5b5f6b', '#80848f', '#a9adb5', '#d0d3d8'], glass: ['#141d4a', '#1e4f63', '#2fa3b0', '#73eff7', '#c8fbff'],
  gold: ['#5a3a12', '#9a6a1c', '#d9a62a', '#f5d25a', '#fff2b0'], purple: ['#1f1a3f', '#3d2a6f', '#6447a8', '#8f6fd8', '#c2a8ff'],
  pink: ['#5d275d', '#a3407a', '#e06aa8', '#ff9ed0', '#ffd6ec'], denim: ['#141d4a', '#1f2f5e', '#2f4a8a', '#4a6fb5', '#7a9ad8'],
  olive: ['#2a2a1a', '#4b4a26', '#6e6f33', '#9a9a4a', '#c4c66a'], neonPink: ['#5d275d', '#b02a8a', '#ff3ea5', '#ff8fd0', '#ffe0f2'],
  neonCyan: ['#0e3a4a', '#0f7a8c', '#19d3e8', '#8ff6ff', '#e6ffff'], paper: ['#80848f', '#c3d2dd', '#e6edf2', '#f4f4f4', '#ffffff'],
  rubber: ['#0d0f1a', '#14161f', '#1a1c2c', '#262b40', '#333c57'], metal: ['#262b40', '#454a57', '#80848f', '#c3d2dd', '#e6edf2'],
  carbon: ['#0d0f1a', '#0d0f1a', '#14161f', '#22252f', '#30343f'],
};
HB.yellowFlat = [...HB.yellow.slice(0, 3), '#ffcd75', '#ffcd75']; HB.limeFlat = [...HB.lime.slice(0, 3), '#a7f070', '#a7f070'];
HB.orangeFlat = [...HB.orange.slice(0, 3), '#ef7d57', '#ef7d57']; HB.cyanFlat = [...HB.cyan.slice(0, 3), '#73eff7', '#73eff7'];
if (HIBIT) {
  Object.assign(C, { ink: '#0d0f1a', steel: '#c3d2dd', snow: '#ffffff', royal: '#5b8ff0', ice: '#c8fbff', aqua: '#2fa3b0', mint: '#4fc78d',
    leaf: '#6fd36a', olive: '#6e6f33', cream: '#fff6dc', peach: '#ff9e6b', coral: '#e05a5a', rose: '#ff8a7a', violet: '#6447a8',
    lavender: '#8f6fd8', magenta: '#ff3ea5', pink: '#e06aa8', brown: '#6e4128', tan: '#d9a066', skin: '#e8a87c', gold: '#d9a62a',
    asphalt: '#30343f', concrete: '#80848f', neon: '#19d3e8' });
  for (const k in HB) RAMP[k] = HB[k];
}
// the colours a frame is quantized to: the 16 (legacy), or every colour of the C set and the 5-step ramps (Hi-Bit)
export const PALETTE = HIBIT ? [...new Set([...Object.values(C), ...Object.values(HB).flat()].map(h => h.toLowerCase()))] : Object.values(C);
// ramp of any length -> the length this look shades with (3 legacy: [shadow, lit, top]; 5 Hi-Bit: [deep, shadow, mid, lit, top])
export function ramp5(r) {
  r = typeof r === 'string' ? (RAMP[r] || RAMP.grey) : r;
  if (BANDS === 3) return r.length >= 5 ? [r[1], r[3], r[4]] : r;
  if (r.length >= 5) return r;
  const nearest = h => { const a = _rgb(h); let best = PALETTE[0], bd = 1e9; for (const p of PALETTE) { const b = _rgb(p), d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; if (d < bd) { bd = d; best = p; } } return best; };
  let deep = nearest(_mix(r[0], '#0d0f1a', .45)); if (deep === r[0].toLowerCase()) deep = '#0d0f1a';
  return [deep, r[0], r[1], nearest(_mix(r[1], r[2], .5)), r[2]];
}

// ---------- brand colour (v8) ----------
// settings.brand.color ('#rrggbb', the Suite's "Brand colour" look setting); unset = the style's own accents (yellow).
// BRAND.hud: HUD accents (chapter slam bars + number, chapter tag, stat units), moved just enough to read on the dark HUD;
// BRAND.ink: text on a BRAND.color fill; BRAND.slot / RAMP.brand: the nearest palette ramp, for 3D objects in the brand
// colour (the 3D art stays on the 16-colour palette). contrast / legibleOn / textOn: WCAG helpers for scenes.
const _rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const _lum = h => { const [r, g, b] = _rgb(h).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const _mix = (a, b, k) => '#' + _rgb(a).map((c, i) => Math.round((c + (_rgb(b)[i] - c) * k) * 255).toString(16).padStart(2, '0')).join('');
export const contrast = (a, b) => { const x = _lum(a), y = _lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
export const legibleOn = (c, bg, min = 3) => { const to = contrast('#ffffff', bg) > contrast('#000000', bg) ? '#ffffff' : '#000000';
  for (let k = 0; k <= 1.001; k += .05) { const o = k ? _mix(c, to, Math.min(1, k)) : c; if (contrast(o, bg) >= min) return o; } return to; };
export const textOn = c => contrast('#ffffff', c) >= contrast('#111111', c) ? '#ffffff' : '#111111';
const _brand = typeof SETTINGS.brand?.color === 'string' && /^#[0-9a-f]{6}$/i.test(SETTINGS.brand.color) ? SETTINGS.brand.color.toLowerCase() : null;
const _slot = h => { let best = 'yellow', bd = 1e9; for (const k of ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'navy', 'blue', 'sky', 'cyan', 'plum', 'white', 'grey', 'black']) {
  const a = _rgb(h), b = _rgb(RAMP[k][1]), d = .3 * (a[0] - b[0]) ** 2 + .59 * (a[1] - b[1]) ** 2 + .11 * (a[2] - b[2]) ** 2; if (d < bd) { bd = d; best = k; } } return best; };
export const BRAND = { on: !!_brand, color: _brand ?? C.yellow, hud: _brand ? legibleOn(_brand, C.bg, 3) : C.yellow, ink: textOn(_brand ?? C.yellow), slot: _brand ? _slot(_brand) : 'yellow' };
RAMP.brand = RAMP[BRAND.slot];

// ---------- math / timing ----------
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = x => (x = clamp(x), x * x * (3 - 2 * x));
export const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
export const easeIn = x => Math.pow(clamp(x), 3);
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const lerp = (a, b, k) => a + (b - a) * k;
export const pop = (t, t0, d = .35) => {           // overshoot pop-in 0 -> 1
  const x = clamp((t - t0) / d); if (x <= 0) return 0;
  return 1 + Math.sin(x * Math.PI) * .18 * (1 - x) - Math.pow(1 - x, 3);
};
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
// scale an object by k (0..1+) relative to its ORIGINAL scale. box() stores its size in .scale, so never set
// obj.scale.setScalar(pop(...)) on a box directly - use popScale(box, pop(t, t0)) or wrap it in a Group.
export function popScale(obj, k) {
  if (!obj.userData.s0) obj.userData.s0 = obj.scale.clone();
  obj.visible = k > 0; obj.scale.copy(obj.userData.s0).multiplyScalar(Math.max(k, .001)); return obj;
}
export function rng(seed) { return () => (seed = seed * 16807 % 2147483647) / 2147483647; }

// ---------- words / cues ----------
export let PHRASES = [], WORDS = [];
// any alphabet, without case or accents: cue('transcripcion') finds "Transcripción," in a Spanish narration (v3)
const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}.,]/gu, '').replace(/[.,]$/g, '');
export async function loadTimeline(url) {
  PHRASES = await (await fetch(url)).json();
  WORDS = PHRASES.flatMap((p, pi) => p.words.map(w => ({...w, n: norm(w.w), pi})));
}
// time the spoken word `word` starts, searching the nearest occurrence to `near` seconds
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

// ---------- materials ----------
export const FOG = { color: { value: new THREE.Color(C.bg) }, near: { value: 30 }, far: { value: 80 } };
export const SHADOW = { map: { value: null }, matrix: { value: new THREE.Matrix4() }, on: { value: 0 } };
export const LIGHTDIR = { value: new THREE.Vector3(-.5, 1, .7).normalize() };   // per-shot key light (S.light)
const facetVS = `
  varying vec3 vN; varying float vDepth; varying vec3 vW;
  #include <common>
  #include <skinning_pars_vertex>
  void main(){
    #include <beginnormal_vertex>
    #include <begin_vertex>
    vec4 wp = modelMatrix * vec4(transformed, 1.);
    #ifdef USE_INSTANCING
      wp = modelMatrix * instanceMatrix * vec4(transformed, 1.);
      objectNormal = mat3(instanceMatrix) * objectNormal;
    #endif
    vN = normalize(mat3(modelMatrix) * objectNormal); vW = wp.xyz;
    vec4 mv = viewMatrix * wp; vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const facetFS = BANDS === 5 ? `
  uniform vec3 c0, c1, c2, c3, c4, cd, fogColor, lightDir; uniform float fogNear, fogFar, opacity, shadowOn, patchy, unlit;
  uniform sampler2D shadowMap; uniform mat4 shadowMatrix;
  varying vec3 vN; varying float vDepth; varying vec3 vW;
  float bayer(vec2 p){ int x = int(mod(p.x,4.)), y = int(mod(p.y,4.));
    int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return float(m[y*4+x])/16.; }
  void main(){
    vec3 n = normalize(vN);
    float d = dot(n, lightDir);
    // Hi-Bit: five lighting steps; the step edges are dithered over a narrow band so curved-ish surfaces grade smoothly
    float e = d + (bayer(gl_FragCoord.xy + 7.) - .5) * .08;
    int band = e > .72 ? 4 : e > .32 ? 3 : e > -.05 ? 2 : e > -.45 ? 1 : 0;
    if (unlit > .5) band = 3;                          // emissive: the ramp's saturated lit step (the top step reads as white)
    else if (shadowOn > .5 && band > 0) {             // cast shadow: 4-tap PCF, dithered penumbra, two steps darker
      vec4 sp = shadowMatrix * vec4(vW, 1.); vec3 q = sp.xyz / sp.w * .5 + .5;
      if (q.x > 0. && q.x < 1. && q.y > 0. && q.y < 1. && q.z < 1.) {
        float sh = 0., o = 1. / 2048.;
        for (int i = 0; i < 4; i++) { vec2 k = vec2(float(i / 2) - .5, float(i - (i / 2) * 2) - .5) * 1.5 * o;
          sh += q.z - .0015 > texture2D(shadowMap, q.xy + k).r ? 1. : 0.; }
        if (sh * .25 > bayer(gl_FragCoord.xy + 3.) * .98 + .01) band = max(band - 2, 0);
      }
    }
    vec3 c = band == 4 ? c4 : band == 3 ? c3 : band == 2 ? c2 : band == 1 ? c1 : c0;
    if (patchy > 0. && band >= 3 && n.y > .93) {
      float pn = sin(vW.x * .19 + 1.3) * sin(vW.z * .16 - .7) + .55 * sin(vW.x * .47 + vW.z * .39) + .3 * sin(vW.z * .9 - vW.x * .3);
      if (pn * patchy < bayer(gl_FragCoord.xy + 5.) * .5 + .35) c = c2;
    }
    float f = smoothstep(fogNear, fogFar, vDepth);
    if (f > bayer(gl_FragCoord.xy) * .999 + .0005) c = fogColor;
    if (opacity < 1. && opacity <= bayer(gl_FragCoord.xy + 1.)) discard;
    gl_FragColor = vec4(c, 1.);
  }` : `
  uniform vec3 c0, c1, c2, cd, fogColor, lightDir; uniform float fogNear, fogFar, opacity, shadowOn, patchy, unlit;
  uniform sampler2D shadowMap; uniform mat4 shadowMatrix;
  varying vec3 vN; varying float vDepth; varying vec3 vW;
  float bayer(vec2 p){ int x = int(mod(p.x,4.)), y = int(mod(p.y,4.));
    int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return float(m[y*4+x])/16.; }
  void main(){
    float d = dot(normalize(vN), lightDir);
    int band = d > .6 ? 2 : d > -.1 ? 1 : 0;
    if (unlit > .5) band = 2;
    else if (shadowOn > .5 && band > 0) {              // cast shadow: 4-tap PCF, dithered penumbra, one ramp step darker
      vec4 sp = shadowMatrix * vec4(vW, 1.); vec3 q = sp.xyz / sp.w * .5 + .5;
      if (q.x > 0. && q.x < 1. && q.y > 0. && q.y < 1. && q.z < 1.) {
        float sh = 0., o = 1. / 2048.;
        for (int i = 0; i < 4; i++) { vec2 k = vec2(float(i / 2) - .5, float(i - (i / 2) * 2) - .5) * 1.5 * o;
          sh += q.z - .0015 > texture2D(shadowMap, q.xy + k).r ? 1. : 0.; }
        if (sh * .25 > bayer(gl_FragCoord.xy + 3.) * .98 + .01) band -= 1;
      }
    }
    vec3 c = band == 2 ? c2 : band == 1 ? c1 : c0;
    if (patchy > 0. && band == 2 && normalize(vN).y > .93) {                   // meadow patches: large soft blobs of the lit-side colour on top faces
      float n = sin(vW.x * .19 + 1.3) * sin(vW.z * .16 - .7) + .55 * sin(vW.x * .47 + vW.z * .39) + .3 * sin(vW.z * .9 - vW.x * .3);
      if (n * patchy < bayer(gl_FragCoord.xy + 5.) * .5 + .35) c = c1;
    }
    float f = smoothstep(fogNear, fogFar, vDepth);
    if (f > bayer(gl_FragCoord.xy) * .999 + .0005) c = fogColor;     // dithered fog: pure palette
    if (opacity < 1. && opacity <= bayer(gl_FragCoord.xy + 1.)) discard; // dithered transparency
    gl_FragColor = vec4(c, 1.);
  }`;
const matCache = new Map();
export function facet(ramp, opts = {}) {
  const r = ramp5(typeof ramp === 'string' ? (RAMP[ramp] || RAMP.grey) : ramp);   // (v10: 3 or 5 colours, an unknown name = grey)
  const key = r.join() + (opts.opacity ?? '') + (opts.side ?? '') + (opts.patch ?? '') + (opts.unlit ? 'U' : '');
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const cols = r.map(h => ({ value: new THREE.Color(h) }));
  const m = new THREE.ShaderMaterial({
    uniforms: { c0: cols[0], c1: cols[1], c2: cols[2], ...(BANDS === 5 ? { c3: cols[3], c4: cols[4] } : {}), cd: { value: new THREE.Color(C.bg) },
      fogColor: FOG.color, fogNear: FOG.near, fogFar: FOG.far, opacity: { value: opts.opacity ?? 1 }, patchy: { value: opts.patch ?? 0 },
      unlit: { value: opts.unlit ? 1 : 0 }, shadowMap: SHADOW.map, shadowMatrix: SHADOW.matrix, shadowOn: SHADOW.on, lightDir: LIGHTDIR },
    vertexShader: facetVS, fragmentShader: facetFS, side: opts.side ?? THREE.FrontSide,
  });
  m.userData.facet = true;
  if (!opts.unique) matCache.set(key, m);
  return m;
}
// v10: a material that shows a loaded image (IMG[key]): phone / TV / monitor screens, posters, billboards. Drawn as is in
// the 3D pass, so the frame's palette quantizes it like everything else. Missing image: a dark unlit screen.
const texCache = new Map();
export function imageTexture(key) {
  const im = IMG[key]; if (!im) return null;
  if (!texCache.has(key)) { const t = new THREE.Texture(im); t.needsUpdate = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; texCache.set(key, t); }
  return texCache.get(key);
}
export function imageMat(key, opts = {}) {
  const tex = imageTexture(key); if (!tex) return facet('black', { unlit: true });
  const m = new THREE.MeshBasicMaterial({ map: tex, side: opts.side ?? THREE.FrontSide, transparent: false, fog: false });
  m.userData.image = key; return m;
}
// ---------- coplanar flicker (z-fighting) ----------
// Two surfaces in the same plane (a rug on a floor, a poster flush on a wall, a stripe box sharing a face with its base)
// flicker frame to frame. decal(mesh, level) draws a mesh in front of whatever it lies on (a depth bias, no visible move);
// live() also finds such pairs in every shot after build() and biases the smaller one (S.autoDecal = false turns it off).
const decalCache = new Map();
function decalMat(m, level) {
  const key = m.uuid + ':' + level;
  if (!decalCache.has(key)) {
    const d = m.clone(); if (m.uniforms) d.uniforms = m.uniforms;   // keep the shared fog/shadow/opacity uniforms
    d.userData = m.userData; d.polygonOffset = true; d.polygonOffsetFactor = -1 * level; d.polygonOffsetUnits = -4 * level;
    decalCache.set(key, d);
  }
  return decalCache.get(key);
}
export function decal(obj, level = 1) {
  obj.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.side !== THREE.BackSide) o.material = decalMat(o.userData._baseMat || (o.userData._baseMat = o.material), level); });
  return obj;
}
const _bb = new THREE.Box3();
// world-aligned facet meshes whose same-facing faces lie in one plane and overlap; returns [[a, b], ...]
export function coplanarPairs(scene, eps = 1e-3) {
  scene.updateMatrixWorld(true);
  const items = [];
  scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible || !o.material?.userData?.facet || !o.geometry) return;
    const e = o.matrixWorld.elements;                                // axis-aligned only (rotated meshes: AABB too loose)
    for (const c of [0, 4, 8]) { const v = [Math.abs(e[c]), Math.abs(e[c + 1]), Math.abs(e[c + 2])].sort((a, b) => b - a); if (v[1] > 1e-4 * v[0]) return; }
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = _bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld), s = b.getSize(new THREE.Vector3());
    items.push({ o, min: b.min.toArray(), max: b.max.toArray(), area: Math.max(s.x * s.y, s.y * s.z, s.x * s.z) });
  });
  if (items.length > 3000) return [];                                // huge voxel scenes: skip (cost)
  const out = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const A = items[i], B = items[j];
    for (let a = 0; a < 3; a++) {
      const same = Math.abs(A.max[a] - B.max[a]) < eps || Math.abs(A.min[a] - B.min[a]) < eps;
      if (!same) continue;
      let ok = true;
      for (let k = 0; k < 3 && ok; k++) if (k !== a && Math.min(A.max[k], B.max[k]) - Math.max(A.min[k], B.min[k]) <= eps) ok = false;
      // a thin plate inside a thicker box: same face only counts when the faces really coincide on that axis
      if (ok) { out.push([A, B]); break; }
    }
  }
  return out;
}
export function fixCoplanar(scene) {
  const pairs = coplanarPairs(scene); if (!pairs.length) return 0;
  const level = new Map();                                           // smaller surface goes on top; stacks get rising levels
  pairs.sort((p, q) => Math.max(q[0].area, q[1].area) - Math.max(p[0].area, p[1].area));
  for (const [A, B] of pairs) {
    const [big, small] = A.area >= B.area ? [A, B] : [B, A];
    level.set(small.o, Math.max(level.get(small.o) || 0, (level.get(big.o) || 0) + 1));
  }
  for (const [o, l] of level) decal(o, Math.min(l, 8));
  return level.size;
}
export const flat = (col, opts = {}) => facet([col, col, col], opts);
export const setOpacity = (mesh, o) => mesh.traverse(m => { if (m.material?.uniforms?.opacity) m.material.uniforms.opacity.value = o; });
export function lineMat(col) { return new THREE.LineBasicMaterial({ color: col }); }

// ---------- geometry helpers ----------
export const GEO = { box: new THREE.BoxGeometry(1, 1, 1) };
export function box(w, h, d, ramp, pos = [0, 0, 0], opts = {}) {
  const m = new THREE.Mesh(GEO.box, facet(ramp, opts));
  m.scale.set(w, h, d); m.position.set(...pos); return m;
}
export function outline(mesh, col = C.bg, s = 1.08) {       // inverted hull outline
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: col, side: THREE.BackSide }));
  o.scale.setScalar(s); mesh.add(o); return mesh;
}
// voxel model from rows (front view, top row first); map: char -> ramp. depth: layers of same rows
export function vox(rows, map, { size = .1, depth = 1, center = true } = {}) {
  const g = new THREE.Group(), per = {};
  const layers = Array.isArray(rows[0]) ? rows : Array.from({ length: depth }, () => rows);
  const Hn = layers[0].length, Wn = Math.max(...layers[0].map(r => r.length)), Dn = layers.length;
  layers.forEach((L, z) => L.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || ch === ' ' || !map[ch]) return;
    (per[ch] ||= []).push([x, Hn - 1 - y, z]);
  })));
  const M = new THREE.Matrix4();
  for (const ch in per) {
    const im = new THREE.InstancedMesh(GEO.box, facet(map[ch]), per[ch].length);
    per[ch].forEach(([x, y, z], i) => im.setMatrixAt(i, M.makeScale(size, size, size).setPosition(
      (x - (center ? (Wn - 1) / 2 : 0)) * size, y * size, (z - (center ? (Dn - 1) / 2 : 0)) * size)));
    g.add(im);
  }
  g.userData.size = [Wn * size, Hn * size, Dn * size];
  return g;
}

// ---------- renderer / post ----------
export const glCanvas = document.createElement('canvas');
export const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(1); renderer.setSize(OW, OH, false);
const mkRT = () => { const d = new THREE.DepthTexture(AW, AH); d.type = THREE.FloatType;
  return new THREE.WebGLRenderTarget(AW, AH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, depthTexture: d }); };
const SHR = SETTINGS.shadows.mapSize;
const shadowRT = new THREE.WebGLRenderTarget(SHR, SHR, { depthBuffer: true, depthTexture: new THREE.DepthTexture(SHR, SHR) });
shadowRT.depthTexture.type = THREE.FloatType;
SHADOW.map.value = shadowRT.depthTexture;
const lightCam = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 300);
const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _hidden = [];
function shadowPass(S) {
  if (S.shadows === false || !SETTINGS.shadows.enabled) { SHADOW.on.value = 0; return; }
  // shadow box centred where the camera looks (ray hit on the ground plane), sized to the view distance
  S.cam.getWorldDirection(_d);
  let dist = _d.y < -.05 ? -S.cam.position.y / _d.y : 20; dist = Math.min(dist, 80);
  const c = S.shadowCenter ?? _v.copy(S.cam.position).addScaledVector(_d, dist);
  const size = S.shadowSize ?? Math.max(8, dist * 1.1);
  const texel = size * 2 / SHR;                                        // snap to texels: no shimmering
  const cx = Math.round(c.x / texel) * texel, cz = Math.round(c.z / texel) * texel;
  lightCam.left = lightCam.bottom = -size; lightCam.right = lightCam.top = size;
  lightCam.position.set(cx, c.y ?? 0, cz).addScaledVector(LIGHTDIR.value, 120); lightCam.lookAt(cx, c.y ?? 0, cz);
  lightCam.near = 1; lightCam.far = 260; lightCam.updateProjectionMatrix(); lightCam.updateMatrixWorld();
  _hidden.length = 0;
  S.scene.traverse(o => { if (o.visible && (o.isLine || o.isPoints || (o.material && !o.material.userData?.facet && !o.isMesh) || o.userData.noShadow || (o.isMesh && !o.material.userData?.facet))) { o.visible = false; _hidden.push(o); } });
  const bg = S.scene.background; S.scene.background = null; S.scene.overrideMaterial = depthOnly;
  renderer.setRenderTarget(shadowRT); renderer.clear(); renderer.render(S.scene, lightCam);
  S.scene.overrideMaterial = null; S.scene.background = bg; _hidden.forEach(o => o.visible = true);
  SHADOW.matrix.value.multiplyMatrices(lightCam.projectionMatrix, lightCam.matrixWorldInverse);
  SHADOW.on.value = 1;
}
// ---- object-ID pass: every top-level object (or anything with userData.oid = true, or each child of a group
// with userData.oidEach) gets its own ID, so touching objects at similar depth still get a separating contour.
const mkIdRT = () => new THREE.WebGLRenderTarget(AW, AH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
const idA = mkIdRT(), idB = mkIdRT();
const idMat = new THREE.ShaderMaterial({ uniforms: { oid: { value: new THREE.Vector3() } },
  vertexShader: `#include <common>
    void main(){ vec4 wp = modelMatrix * vec4(position, 1.);
      #ifdef USE_INSTANCING
        wp = modelMatrix * instanceMatrix * vec4(position, 1.);
      #endif
      gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `uniform vec3 oid; void main(){ gl_FragColor = vec4(oid, 1.); }` });
const noopBR = THREE.Object3D.prototype.onBeforeRender;
function idHook(r, s, c, g, m) { const v = this.userData._idv; m.uniforms.oid.value.set(v[0], v[1], 1); m.uniformsNeedUpdate = true; }
function idPass(S, rt) {
  if (S.outline === false || !(SETTINGS.outline.objectId || SETTINGS.outline.rim)) return;
  let n = 0; const hid = [], hooked = [];
  const walk = (o, id) => {
    if (!o.visible) return;
    if (o.userData.oid === true) id = ++n;
    if (o.isMesh) {
      const m = o.material;
      if (!m?.userData?.facet || m.uniforms.opacity.value < .5 || o.userData.noOutline) { o.visible = false; hid.push(o); }
      else { o.userData._idv = [(id % 256) / 255, Math.floor(id / 256) / 255]; o.onBeforeRender = idHook; hooked.push(o); }
    } else if (o.isLine || o.isPoints || o.isSprite) { o.visible = false; hid.push(o); }
    const each = o.userData.oidEach;
    for (const ch of o.children) walk(ch, each ? ++n : id);
  };
  for (const ch of S.scene.children) walk(ch, ++n);
  const bg = S.scene.background; S.scene.background = null; S.scene.overrideMaterial = idMat;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(S.scene, S.cam);
  S.scene.overrideMaterial = null; S.scene.background = bg;
  hid.forEach(o => o.visible = true); hooked.forEach(o => o.onBeforeRender = noopBR);
}
const rtA = mkRT(), rtB = mkRT();
const vec = h => { const c = new THREE.Color(h); return new THREE.Vector3(c.r, c.g, c.b); };
const PAL = HIBIT ? PALETTE.map(vec) : Object.values(C).map(vec);
// one step lighter for each palette entry (rim highlight), same order as C
const LIGHTER = { bg: 'dark', plum: 'red', red: 'orange', orange: 'yellow', yellow: 'white', lime: 'white', green: 'lime', teal: 'green',
  navy: 'blue', blue: 'sky', sky: 'cyan', cyan: 'white', white: 'white', silver: 'white', slate: 'silver', dark: 'slate' };
// Hi-Bit: the next step up of the ramp a colour belongs to (its first ramp), else itself
const HB_UP = (() => { const up = {}; for (const r of Object.values(HB)) r.forEach((h, i) => { const k = h.toLowerCase(); if (!(k in up)) up[k] = r[Math.min(i + 1, r.length - 1)]; }); return up; })();
const PALL = HIBIT ? PALETTE.map(h => vec(HB_UP[h] || h)) : Object.keys(C).map(k => vec(C[LIGHTER[k]]));
const NP = PAL.length;
const postMat = new THREE.ShaderMaterial({
  uniforms: { a: { value: rtA.texture }, b: { value: rtB.texture }, da: { value: rtA.depthTexture }, db: { value: rtB.depthTexture },
    ia: { value: idA.texture }, ib: { value: idB.texture },
    skyA: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] }, skyB: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] },
    outA: { value: new THREE.Vector4(1, 1, 30, 80) }, outB: { value: new THREE.Vector4(1, 1, 30, 80) }, mixv: { value: 0 }, mode: { value: 0 },
    pal: { value: PAL }, palL: { value: PALL }, flash: { value: 0 }, vig: { value: SETTINGS.post.vignette }, dith: { value: SETTINGS.post.dither },
    outCfg: { value: new THREE.Vector4(+SETTINGS.outline.depth, +SETTINGS.outline.objectId, +SETTINGS.outline.rim, +SETTINGS.outline.fogFade) },
    outCol: { value: new THREE.Color(SETTINGS.outline.color) }, pixMax: { value: SETTINGS.transitions.pixelateMax } },
  vertexShader: `varying vec2 uv0; void main(){ uv0 = uv; gl_Position = vec4(position, 1.); }`,
  fragmentShader: `uniform sampler2D a, b, da, db, ia, ib; uniform vec3 skyA[4], skyB[4]; uniform vec4 outA, outB, outCfg; uniform vec3 outCol; uniform float mixv, mode, flash, vig, dith, pixMax;
    uniform vec3 pal[${NP}], palL[${NP}]; varying vec2 uv0;
    float lin(float z){ float n = .1, f = 400.; return n * f / (f - z * (f - n)); }
    float bayer(vec2 p){ int x = int(mod(p.x,4.)), y = int(mod(p.y,4.));
      int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return float(m[y*4+x])/16.; }
    float hash(float n){ return fract(sin(n) * 43758.5453); }
    vec3 lighter(vec3 c){ int bi = 0; float bd = 1e9;
      for (int i = 0; i < ${NP}; i++) { vec3 d = c - pal[i]; float dd = dot(d, d); if (dd < bd) { bd = dd; bi = i; } } return palL[bi]; }
    bool diff(vec3 x, vec3 y){ return any(greaterThan(abs(x - y), vec3(.001))); }
    // colour of one shot at art pixel p: sky where nothing was drawn; dark contour where depth jumps or where a
    // nearer object with a different ID borders this pixel; a one-step-lighter rim on edges facing the light.
    // o = (outline on, rim on, fogNear, fogFar): contours dissolve with the fog so distance reads.
    vec3 shade(sampler2D t, sampler2D dt, sampler2D it, vec3 s0, vec3 s1, vec3 s2, vec3 s3, vec4 o, vec2 p, vec2 R){
      vec2 uv = (p + .5) / R;
      float z = texture2D(dt, uv).r;
      vec3 c = texture2D(t, uv).rgb;
      bool sky = z >= .99999;
      if (sky) {
        ${HIBIT ? `// Hi-Bit: four stops from the top of the frame (s0) down to the horizon (s3), dithered between neighbours
        float k = clamp((1. - p.y / R.y) / .6, 0., 1.) * 3.; float fk = fract(k); int ik = int(floor(k));
        vec3 lo = ik == 0 ? s0 : ik == 1 ? s1 : ik == 2 ? s2 : s3, hi = ik == 0 ? s1 : ik == 1 ? s2 : s3;
        c = fk > bayer(p) ? hi : lo;` : `float g = clamp((p.y / R.y - .42) / .22, 0., 1.);
        c = g > bayer(p) ? s0 : s1;`}
      }
      if (o.x > .5) {
        float d = lin(z), dmin = 1e9; vec3 id = texture2D(it, uv).rgb; bool edge = false;
        for (int k = 0; k < 4; k++) {
          vec2 off = k == 0 ? vec2(1., 0.) : k == 1 ? vec2(-1., 0.) : k == 2 ? vec2(0., 1.) : vec2(0., -1.);
          vec2 u2 = uv + off / R; float dn = lin(texture2D(dt, u2).r);
          if (outCfg.x > .5 && d - dn > max(.35, dn * .12)) edge = true;
          if (outCfg.y > .5 && dn < d - .02 && diff(texture2D(it, u2).rgb, id)) edge = true;
          dmin = min(dmin, dn);
        }
        if (edge) { if (outCfg.w < .5 || smoothstep(o.z, o.w, dmin) <= bayer(p) * .999 + .0005) c = outCol; }
        else if (o.y > .5 && outCfg.z > .5 && !sky) {
          vec2 u2 = uv + vec2(-1., 1.) / R; float dn = lin(texture2D(dt, u2).r);
          if (dn > d + .02 && (diff(texture2D(it, u2).rgb, id) || dn - d > max(.35, d * .12)) && smoothstep(o.z, o.w, d) < .35) c = lighter(c);
        }
      }
      return c;
    }
    void main(){
      vec2 R = vec2(${AW}., ${AH}.);
      vec2 px = floor(gl_FragCoord.xy / ${PM}.);
      vec2 p = px; float m = mixv, sel;
      if (mode > 3.5) {                                   // 4: pixelate out, swap, pixelate in
        float blk = 1. + floor(pixMax * sin(clamp(m, 0., 1.) * 3.14159));
        p = floor(px / blk) * blk + floor(blk * .5); sel = step(.5, m);
      } else if (mode > 2.5) {                            // 3: glitch slices
        float band = floor(px.y / 7.), k = floor(m * 14.);
        float r = hash(band * 91.7 + k * 13.1);
        p.x += (r - .5) * 180. * sin(clamp(m, 0., 1.) * 3.14159) * step(.55, hash(band + k));
        sel = step(.5 + (hash(band * 3.1 + k) - .5) * .3, m);
      } else if (mode > 1.5) {                            // 2: iris
        float d = length((px - R * .5) / R.y);
        sel = step(d + bayer(px) * .06, m * 1.05);
      } else if (mode > .5) {                             // 1: diagonal dithered wipe
        float e = px.x / R.x * .75 + (1. - px.y / R.y) * .25;
        sel = step(e + (bayer(px) - .5) * .14, m * 1.3 - .15);
      } else sel = step(bayer(px) + .0001, m);           // 0: dither dissolve
      vec3 c = sel > .5 ? shade(b, db, ib, skyB[0], skyB[1], skyB[2], skyB[3], outB, p, R) : shade(a, da, ia, skyA[0], skyA[1], skyA[2], skyA[3], outA, p, R);
      vec2 q = px / R - .5; float v = smoothstep(.5, .85, length(q * vec2(1., .82)));
      c *= 1. - v * vig;
      c += (bayer(px + 2.) - .5) * dith * step(.001, v + flash);                   // dither so gradients/vignette band cleanly
      vec3 best = pal[0]; float bd = 1e9;
      for (int i = 0; i < ${NP}; i++) { vec3 d = c - pal[i]; float dd = dot(d, d); if (dd < bd) { bd = dd; best = pal[i]; } }
      gl_FragColor = vec4(best, 1.);
    }`,
});
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

// ---------- HUD ----------
export const hudCanvas = document.createElement('canvas'); hudCanvas.width = OW; hudCanvas.height = OH;
export const hud = hudCanvas.getContext('2d');
export const FONT = { head: 'Orbitron', body: "'Share Tech Mono'" };
// engine v5: the host awaits these before the first frame and says so when one fails (older engines: it loads the pair
// only when a HEAD check finds them, silently skipping one that is missing)
export const FONT_FILES = [['Orbitron', 'fonts/orbitron.woff2', '500 900', 'normal'], ['Share Tech Mono', 'fonts/share-tech-mono.woff2', '400', 'normal']];
export let NOW = 0;
const GLYPHS = '#%&@$*+=<>/\\01XZ';
function scramble(str, k, seed) {           // reveal left-to-right; unrevealed chars flicker through glyphs
  const n = Math.floor(str.length * Math.min(1, k * 1.25));
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (i < n || ch === ' ') out += ch;
    else { const h = Math.abs(Math.sin((i + 1) * 12.9898 + seed * 78.233)) * 43758.5453; out += GLYPHS[Math.floor((h % 1) * GLYPHS.length)]; }
  }
  return out;
}
export function text(str, x, y, o = {}) {
  const { size = 7, col = C.white, font = 'body', weight = font === 'head' ? 700 : 400, align = 'center',
          alpha = 1, outline = true, base = 'middle', spacing = 0, maxW } = o;
  if (alpha <= 0) return 0;
  if (SUITE.pick) {
    hud.font = `${weight} ${size}px ${FONT[font] || font}`; hud.letterSpacing = spacing + 'px';
    const tw = Math.min(maxW ?? 1e9, hud.measureText(String(str)).width), x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    SUITE.pick.push({ kind: 'text', text: String(str), x: x0, y: y - size * .6, w: tw, h: size * 1.2, font, size, col, alpha, src: caller() });
  }
  if (font === 'head' && alpha < 1 && !o.noKinetic) {  // headlines decode in and rise into place
    str = scramble(String(str), alpha, Math.floor(NOW * 24)); y += (1 - alpha) * 4;
  }
  hud.globalAlpha = alpha; hud.font = `${weight} ${size}px ${FONT[font] || font}`;
  hud.textAlign = align; hud.textBaseline = base; hud.letterSpacing = spacing + 'px';
  if (outline) { hud.lineJoin = 'round'; hud.lineWidth = Math.max(1, size * .3); hud.strokeStyle = C.bg; hud.strokeText(str, x, y, maxW); }
  hud.fillStyle = col; hud.fillText(str, x, y, maxW);
  const w = hud.measureText(str).width; hud.globalAlpha = 1; hud.letterSpacing = '0px'; return w;
}
export function rect(x, y, w, h, col, alpha = 1) { if (SUITE.pick && alpha > .05) SUITE.pick.push({ kind: 'box', x, y, w, h, col, alpha, src: caller() }); hud.globalAlpha = alpha; hud.fillStyle = col; hud.fillRect(x, y, w, h); hud.globalAlpha = 1; }
export function frame(x, y, w, h, col, alpha = 1, lw = .5) { hud.globalAlpha = alpha; hud.strokeStyle = col; hud.lineWidth = lw; hud.strokeRect(x, y, w, h); hud.globalAlpha = 1; }
export function line(x0, y0, x1, y1, col, alpha = 1, lw = .5) {
  hud.globalAlpha = alpha; hud.strokeStyle = col; hud.lineWidth = lw; hud.beginPath(); hud.moveTo(x0, y0); hud.lineTo(x1, y1); hud.stroke(); hud.globalAlpha = 1;
}
export function project(v, cam) { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H, p.z]; }
// label anchored to a 3D point with a leader line
export function tag(cam, pos, str, o = {}) {
  const { dx = 0, dy = -14, alpha = 1, col = C.white, size = 7, lineCol = C.silver, font = 'body', sub, subCol = C.silver } = o;
  if (alpha <= 0) return;
  const [x, y, z] = project(pos, cam); if (z > 1) return;
  const lx = x + dx, ly = y + dy;
  line(x, y, lx, ly + (dy < 0 ? 4 : -4), lineCol, alpha * .8);
  rect(x - .75, y - .75, 1.5, 1.5, lineCol, alpha);
  text(str, lx, ly, { size, col, alpha, font });
  if (sub) text(sub, lx, ly + size * .95, { size: size * .78, col: subCol, alpha });
}
const LOCALE = (() => { try { return new Intl.NumberFormat(globalThis.__CZ_LANG || 'en-US').resolvedOptions().locale; } catch { return 'en-US'; } })();   // the narration's language (the host sets it)
export function fmt(n, dec = 0) { return n.toLocaleString(LOCALE, { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
// big stat: value + unit, centered
export function stat(x, y, value, unit, o = {}) {
  const { size = 22, col = C.white, unitCol = BRAND.hud, alpha = 1, align = 'center', label, labelCol = C.silver } = o;
  hud.font = `900 ${size}px ${FONT.head}`; const vw = hud.measureText(value).width;
  hud.font = `400 ${size * .45}px ${FONT.body}`; const uw = unit ? hud.measureText(' ' + unit).width : 0;
  const x0 = align === 'center' ? x - (vw + uw) / 2 : align === 'right' ? x - vw - uw : x;
  text(value, x0, y, { size, font: 'head', weight: 900, col, align: 'left', alpha });
  if (unit) text(' ' + unit, x0 + vw, y + size * .12, { size: size * .45, col: unitCol, align: 'left', alpha });
  if (label) text(label, x0 + (vw + uw) / 2, y + size * .78, { size: 6.5, col: labelCol, alpha });
}

// ---------- real-world image cards (drawn on the 1080p layer, not palette-quantized) ----------
export const IMG = {};
export const EVENTS = [];                      // sound-design events recorded during an event pass
export async function loadImages(map) {
  await Promise.all(Object.entries(map).map(([k, src]) => new Promise(res => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => { console.warn('image failed', src); res(); }; im.src = src;
  })));
}
// card(key, x, y, w, t, { t0, t1, label, sub, align, bg, rot, h }) — shows between t0..t1 with a pop in / fade out.
// x,y is the top-left (align 'right' => x is the right edge). Returns the card height (art px).
export function card(key, x, y, w, t, o = {}) {
  const im = IMG[key]; if (!im) return 0;
  const { t0 = -1e9, t1 = 1e9, label, sub, align = 'left', bg, rot = 0, pad = bg ? 3 : 0 } = o;
  const a = ease((t - t0) / .3) * (1 - ease((t - t1 + .25) / .25));
  if (t >= t0 && t - t0 < 1 / 30) EVENTS.push(['card', +t0.toFixed(3), key]);
  if (a <= 0) return 0;
  const iw = im.naturalWidth || im.width || 1, ih = im.naturalHeight || im.height || iw;   // SVGs without a size report 0: pass o.h for them
  const h = o.h ?? w * ih / iw, bw = w + pad * 2, bh = h + pad * 2;
  const x0 = align === 'right' ? x - bw : align === 'center' ? x - bw / 2 : x;
  const s = .9 + .1 * easeOut((t - t0) / .35), lh = label ? (sub ? 15 : 9) : 0;
  if (SUITE.pick) SUITE.pick.push({ kind: 'card', key, text: label || key, x: x0, y, w: bw, h: bh + lh, alpha: a, src: caller() });
  hud.save();
  hud.globalAlpha = a;
  hud.translate(x0 + bw / 2, y + bh / 2); hud.rotate(rot); hud.scale(s, s); hud.translate(-bw / 2, -bh / 2);
  hud.fillStyle = 'rgba(10,10,20,.55)'; hud.fillRect(2.5, 2.5, bw, bh + lh);          // drop shadow
  if (bg) { hud.fillStyle = bg; hud.fillRect(0, 0, bw, bh); }
  hud.imageSmoothingEnabled = true; hud.imageSmoothingQuality = 'high';
  if (o.h) {                                                                            // cover-crop into a fixed box
    const r = Math.max(w / iw, h / ih), sw = w / r, sh = h / r;
    hud.drawImage(im, (iw - sw) / 2, (ih - sh) * (o.cropY ?? .5), sw, sh, pad, pad, w, h);
  } else hud.drawImage(im, pad, pad, w, h);
  if (label) { hud.fillStyle = C.bg; hud.fillRect(0, bh, bw, lh);
    text(label, 3, bh + 4.8, { size: 5.5, align: 'left', outline: false, col: C.white });
    if (sub) text(sub, 3, bh + 10.8, { size: 4.6, align: 'left', outline: false, col: C.silver }); }
  hud.strokeStyle = C.bg; hud.lineWidth = 1.2; hud.strokeRect(-.6, -.6, bw + 1.2, bh + lh + 1.2);
  hud.strokeStyle = C.silver; hud.lineWidth = .4; hud.strokeRect(.2, .2, bw - .4, bh + lh - .4);
  hud.restore();
  return bh + lh;
}

// ---------- full-screen b-roll (v10) ----------
// The real thing the narration names (a game, a phone, a person, a chip), FULL SCREEN, cover-cropped, with a slow Ken Burns
// move. Treatments: 'crt' (default: the real image, fine scanlines and a soft vignette), 'clean' (the image as is), 'pixel'
// (re-drawn at the art resolution in the frame's palette with ordered dither, so it matches the 3D shots).
// broll(key, t, o) draws one on the HUD from a shot's draw(); brollShot({...}) makes a whole shot of b-roll.
// o: t0, t1 (when it shows; fades .25 s at each end unless noFade), from / to = { x, y, z } (focus 0..1 and zoom >= 1, eased
// over t0..t1), treatment, label (lower third, e.g. "GTA V on a Snapdragon phone"), credit (small source line).
const coverRect = (iw, ih, f, w = W, h = H) => {
  const z = Math.max(1, f.z ?? 1), r = Math.max(w / iw, h / ih) * z, sw = w / r, sh = h / r;
  return [clamp((f.x ?? .5) * iw - sw / 2, 0, iw - sw), clamp((f.y ?? .5) * ih - sh / 2, 0, ih - sh), sw, sh];
};
const kbAt = (o, k) => ({ x: lerp(o.from?.x ?? .5, o.to?.x ?? .5, k), y: lerp(o.from?.y ?? .5, o.to?.y ?? .5, k), z: lerp(o.from?.z ?? 1, o.to?.z ?? 1.12, k) });
let _scan = null, _pix = null;
function scanPattern() {
  if (_scan) return _scan;
  const c = document.createElement('canvas'); c.width = 1; c.height = 3; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.20)'; x.fillRect(0, 2, 1, 1); _scan = hud.createPattern(c, 'repeat'); return _scan;
}
function lowerThird(label, credit, a) {
  if (!label && !credit) return;
  hud.font = `700 7px ${FONT.head}`; const lw = label ? hud.measureText(String(label)).width : 0;
  hud.font = `400 4.8px ${FONT.body}`; const cw = credit ? hud.measureText(String(credit)).width : 0;
  const bw = Math.min(W - 24, Math.max(lw, cw) + 12), bh = label && credit ? 19 : 13, y0 = H - 14 - bh;
  rect(10, y0, bw, bh, C.bg, .8 * a); rect(10, y0, 1.6, bh, BRAND.hud, a);
  if (label) text(String(label), 16, y0 + 7, { size: 7, font: 'head', weight: 700, align: 'left', outline: false, alpha: a, maxW: bw - 10 });
  if (credit) text(String(credit), 16, y0 + (label ? 14.5 : 7), { size: 4.8, col: C.silver, align: 'left', outline: false, alpha: a, maxW: bw - 10 });
}
// A picture smaller than ~900 px wide never fills the frame smoothly upscaled (blurry): it is drawn as pixel art ('pixel').
// A portrait or square picture (box art, a phone screenshot, a poster) is never cover-cropped to 16:9: it becomes a 'poster' -
// the whole picture standing in the frame over a dark, pixelated copy of itself (o.side -1..1 moves it left / right).
// o.treatment 'clean' / 'crt' / 'pixel' / 'poster' always wins when given with o.force.
export function brollLayout(key, o = {}) {
  const im = IMG[key]; if (!im) return null;
  const iw = im.naturalWidth || im.width || 1, ih = im.naturalHeight || im.height || 1;
  let tr = o.treatment ?? 'crt';
  if (!o.force) { if (iw / ih < 1.3) tr = 'poster'; else if (iw < 900 && tr !== 'pixel') tr = 'pixel'; }
  return { im, iw, ih, treatment: tr, low: iw < 900 };
}
export function broll(key, t, o = {}) {
  const L = brollLayout(key, o); if (!L) return 0;
  const { im, iw, ih, treatment } = L;
  const t0 = o.t0 ?? -1e9, t1 = o.t1 ?? 1e9, fade = o.fade ?? .25;
  if (t < t0 || t > t1) return 0;
  const a = (o.alpha ?? 1) * (o.noFade ? 1 : ease((t - t0) / fade) * (1 - ease((t - t1 + fade) / fade)));
  if (t >= t0 && t - t0 < 1 / 30) EVENTS.push(['card', +t0.toFixed(3), key]);
  if (a <= 0) return 0;
  const k = o.k ?? (isFinite(t0) && isFinite(t1) ? ease(seg(t, t0, t1)) : 0);
  const [sx, sy, sw, sh] = coverRect(iw, ih, kbAt(o, k));
  if (SUITE.pick && !o.noPick) SUITE.pick.push({ kind: 'broll', key, text: o.label || key, x: 0, y: 0, w: W, h: H, alpha: a, src: caller() });
  const base = hud.globalAlpha; hud.save(); hud.globalAlpha = base * a;           // (dips with the HUD through a transition)
  if (treatment === 'poster') {
    _pix ??= document.createElement('canvas'); const bw = Math.max(8, AW >> 3), bh = Math.max(5, AH >> 3);
    if (_pix.width !== bw) { _pix.width = bw; _pix.height = bh; }
    const px = _pix.getContext('2d'); px.imageSmoothingEnabled = true; px.drawImage(im, sx, sy, sw, sh, 0, 0, bw, bh);
    hud.imageSmoothingEnabled = false; hud.drawImage(_pix, 0, 0, W, H);                       // the backdrop: chunky pixels of itself
    hud.fillStyle = C.bg; hud.globalAlpha = base * a * .62; hud.fillRect(0, 0, W, H); hud.globalAlpha = base * a;
    const s = 1 + .045 * k; let fh = H * .8 * s, fw = fh * iw / ih;
    if (fw > W * .62 * s) { fw = W * .62 * s; fh = fw * ih / iw; }
    const fx = W / 2 - fw / 2 + clamp(o.side ?? 0, -1, 1) * W * .2, fy = H / 2 - fh / 2 - 2;
    hud.fillStyle = 'rgba(5,5,12,.6)'; hud.fillRect(fx + 3, fy + 3, fw, fh);                 // drop shadow
    hud.imageSmoothingEnabled = !L.low; hud.imageSmoothingQuality = 'high'; hud.drawImage(im, fx, fy, fw, fh);
    hud.strokeStyle = C.bg; hud.lineWidth = 1.2; hud.strokeRect(fx - .6, fy - .6, fw + 1.2, fh + 1.2);
    hud.strokeStyle = C.silver; hud.lineWidth = .4; hud.strokeRect(fx + .2, fy + .2, fw - .4, fh - .4);
  } else if (treatment === 'pixel') {                                     // art-resolution pixels (not palette-quantized on the HUD)
    _pix ??= document.createElement('canvas'); if (_pix.width !== AW) { _pix.width = AW; _pix.height = AH; }
    const px = _pix.getContext('2d'); px.imageSmoothingEnabled = true; px.imageSmoothingQuality = 'high'; px.drawImage(im, sx, sy, sw, sh, 0, 0, AW, AH);
    hud.imageSmoothingEnabled = false; hud.drawImage(_pix, 0, 0, W, H);
  } else {
    hud.imageSmoothingEnabled = true; hud.imageSmoothingQuality = 'high'; hud.drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
    if (treatment === 'crt') {
      const g = hud.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, W * .62);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(8,8,16,.45)'); hud.fillStyle = g; hud.fillRect(0, 0, W, H);
      hud.setTransform(1, 0, 0, 1, 0, 0); hud.fillStyle = scanPattern(); hud.fillRect(0, 0, OW, OH);
    }
  }
  hud.restore();
  if (!o.noLabel) lowerThird(o.label, o.credit, a * ease((t - t0 - .35) / .3));
  return 1;
}
// a camera-facing quad that shows a (Ken Burns cropped) image in the 3D pass; mix + map2 = a dithered dissolve to the next
const brollVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy * 2., .5, 1.); }`;
const brollFS = `uniform sampler2D map, map2; uniform vec4 r1, r2; uniform float mixv, dith; varying vec2 vUv;
  float bayer(vec2 p){ int x = int(mod(p.x,4.)), y = int(mod(p.y,4.));
    int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return float(m[y*4+x])/16.; }
  void main(){ float b = bayer(gl_FragCoord.xy); vec3 c = texture2D(map, r1.xy + vUv * r1.zw).rgb;
    if (mixv > b) c = texture2D(map2, r2.xy + vUv * r2.zw).rgb;
    gl_FragColor = vec4(c + (bayer(gl_FragCoord.xy + 2.) - .5) * dith, 1.); }`;
const uvRect = (key, f) => { const im = IMG[key]; if (!im) return new THREE.Vector4(0, 0, 1, 1);
  const iw = im.naturalWidth || im.width || 1, ih = im.naturalHeight || im.height || 1, [sx, sy, sw, sh] = coverRect(iw, ih, f, AW, AH);
  return new THREE.Vector4(sx / iw, 1 - (sy + sh) / ih, sw / iw, sh / ih); };
// brollShot({ t0 | cue, keys: ['a', 'b'] | key, treatment, from, to, label | labels: [...], credit | credits: [...], chapter,
//   chapterFirst, trans, cut, draw(st, t, S) }) - one shot of full-screen b-roll; several keys = a montage (equal slots, a
// pixel dissolve between them, alternating Ken Burns directions). draw() runs on top (e.g. a stat over the picture).
export function brollShot(def) {
  const keys = (def.keys || (def.key ? [def.key] : [])).filter(Boolean), treatment = def.treatment ?? 'crt';
  const kb = i => def.kb?.[i] ?? (def.from || def.to ? { from: def.from, to: def.to } : i % 2
    ? { from: { x: .62, y: .5, z: 1.14 }, to: { x: .42, y: .48, z: 1.04 } } : { from: { x: .4, y: .5, z: 1.03 }, to: { x: .58, y: .46, z: 1.15 } });
  const slot = (S, t) => { const n = Math.max(1, keys.length), d = Math.max(.01, (S.t1 - S.t0) / n), x = clamp((t - S.t0) / d, 0, n - 1e-6), i = Math.floor(x);
    return { i, k: (x - i), d, n }; };
  const userDraw = def.draw, userBuild = def.build, userUpdate = def.update;
  shot({ ...def, broll: keys, name: def.name || def.label || (keys[0] ? 'b-roll ' + keys[0] : 'b-roll'),
    build(S) {
      S.outline = false; S.rim = false; S.shadows = false; S.push = 0; S.autoDecal = false;
      const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: imageTexture(keys[0]) }, map2: { value: imageTexture(keys[0]) },
        r1: { value: new THREE.Vector4(0, 0, 1, 1) }, r2: { value: new THREE.Vector4(0, 0, 1, 1) }, mixv: { value: 0 }, dith: { value: treatment === 'pixel' ? .09 : .05 } },
        vertexShader: brollVS, fragmentShader: brollFS, depthWrite: true });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); quad.frustumCulled = false; quad.userData.noShadow = true; quad.userData.noOutline = true;
      S.scene.add(quad); S.cam.position.set(0, 0, 5); S.cam.lookAt(0, 0, 0);
      return { ...(userBuild?.(S) || {}), _quad: quad };
    },
    update(st, t, S) {
      const { i, k, n } = slot(S, t), U = st._quad.material.uniforms, key = keys[i], nxt = keys[Math.min(i + 1, n - 1)];
      U.map.value = imageTexture(key); U.r1.value.copy(uvRect(key, kbAt(kb(i), ease(k))));
      const dz = n > 1 && i < n - 1 ? seg(k, .88, 1) : 0;                    // the last 12 % of a slot dissolves into the next key
      U.mixv.value = dz; if (dz > 0) { U.map2.value = imageTexture(nxt); U.r2.value.copy(uvRect(nxt, kbAt(kb(i + 1), 0))); }
      userUpdate?.(st, t, S);
    },
    draw(st, t, S) {
      if (treatment !== 'pixel' || keys.some(k => brollLayout(k, def)?.treatment === 'poster')) {   // (a poster is a HUD layout even in a 'pixel' shot)
        const { i, k, n } = slot(S, t), dz = n > 1 && i < n - 1 ? seg(k, .88, 1) : 0;
        broll(keys[i], t, { k: ease(k), ...kb(i), treatment, noFade: true, noLabel: true });
        if (dz > 0) broll(keys[i + 1], t, { k: 0, ...kb(i + 1), treatment, noFade: true, noLabel: true, alpha: ease(dz), noPick: true });
      }
      const { i } = slot(S, t), lab = def.labels?.[i] ?? (i === 0 ? def.label : null), cr = def.credits?.[i] ?? (i === 0 ? def.credit : null);
      const st0 = S.t0 + i * slot(S, t).d;
      lowerThird(lab, cr, ease((t - st0 - .35) / .3) * (1 - ease((t - (st0 + slot(S, t).d) + .5) / .3)));
      userDraw?.(st, t, S);
    } });
}

// ---------- shots ----------
// shot: { t0, t1 (set automatically), chapter, build(S) -> st, update(st, t, S), draw(st, t, S) }
export const SHOTS = [];
export function shot(def) {
  const src = caller(); def._file = SUITE.module || src?.file || null; def._line = src?.line ?? null;
  SHOTS.push(def);
}
export function live(def) {
  if (!def._st) {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(C.bg);
    const cam = new THREE.PerspectiveCamera(SETTINGS.camera.fov, AW / AH, .1, 400);
    const S = { scene, cam, t0: def.t0, t1: def.t1 };
    def._S = S; def._st = def.build(S) || {};
    if (S.autoDecal !== false) S.decals = fixCoplanar(scene);       // stop coplanar surfaces flickering (engine v9)
    // st.hits = key reveal moments; used ONLY for soft sound accents (never for camera shake)
    if (def._st.hits) EVENTS.push(['hits', def.t0, def._st.hits.map(h => +h.toFixed(3))]);
  }
  return def;
}
function dispose(def) {
  if (!def._st) return;
  def._S.scene.traverse(o => { if (o.geometry && o.geometry !== GEO.box) o.geometry.dispose(); });
  def._st = null; def._S = null;
}
function renderShot(def, t, rt, idrt) {
  live(def);
  const S = def._S; FOG.near.value = S.fogNear ?? 30; FOG.far.value = S.fogFar ?? 80;
  S.scene.background.set(S.bg ?? C.bg); FOG.color.value.set(S.sky ? S.sky[HIBIT ? S.sky.length - 1 : 1] : (S.bg ?? C.bg));
  def.update?.(def._st, t, S);
  LIGHTDIR.value.set(...(S.light ?? [-.5, 1, .7])).normalize();
  // gentle push-in across the shot (S.push, default 4%)
  const prog = clamp((t - def.t0) / Math.max(1, def.t1 - def.t0));
  S.cam.fov = (S.fov ?? SETTINGS.camera.fov) * (1 - (S.push ?? SETTINGS.camera.push) * ease(prog));
  S.cam.updateProjectionMatrix(); S.cam.updateMatrixWorld();
  shadowPass(S);
  renderer.setRenderTarget(rt); renderer.render(S.scene, S.cam);
  idPass(S, idrt);
}
export function finalizeShots(end) {
  SHOTS.sort((a, b) => a.t0 - b.t0);
  SHOTS.forEach((s, i) => s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : end);
}
export function activeIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t0) i++; return i; }

function chapterSlam(def, t) {
  if (!def.chapterFirst) return;
  const lt = t - def.t0; if (lt < 0 || lt > 2.4) return;
  const [num, name] = def.chapter;
  const bar = ease(lt / .3) * (1 - ease((lt - 1.9) / .4));
  rect(0, 0, W, 22 * bar, C.bg); rect(0, H - 22 * bar, W, 22 * bar, C.bg);                // letterbox
  const out = ease((lt - 1.6) / .5), inn = pop(lt, .1, .4);
  if (inn <= 0 || out >= 1) return;
  const sw = W * easeOut(lt / .35) * (1 - out);
  // engine v5: number, title and subtitle each centred on the frame (stacked), so the card sits on the same centre
  // line as its band whatever the lengths (v4 centred the number+title block, a short title sat right of centre)
  const [ttl, sub = ''] = String(name ?? '').split('  ·  '), hasNum = num != null && String(num) !== '';
  const bh = hasNum ? (sub ? 22 : 18) : 16;                                                // half height of the band
  const L = hasNum ? (sub ? { num: -9, ttl: 6, sub: 14 } : { num: -5, ttl: 10 }) : (sub ? { ttl: -3, sub: 6 } : { ttl: 0 });
  rect(W / 2 - sw / 2, H / 2 - bh, sw, bh * 2, C.bg, .85);
  rect(W / 2 - sw / 2, H / 2 - bh, sw, 1.2, BRAND.hud); rect(W / 2 - sw / 2, H / 2 + bh - 1.2, sw, 1.2, BRAND.hud);   // (v8: the brand colour)
  hud.save(); hud.translate(W / 2, H / 2); const sc = inn * (1 + out * .4); hud.scale(sc, sc);
  const mw = W - 24;                                                                       // very long titles squeeze instead of overflowing
  if (hasNum) text(String(num), 0, L.num, { size: 20, font: 'head', weight: 900, col: BRAND.hud, alpha: 1 - out, noKinetic: true, maxW: mw });
  text(ttl, 0, L.ttl, { size: 9, font: 'head', weight: 900, alpha: (1 - out) * ease((lt - .25) / .4), maxW: mw });
  if (sub) text(sub, 0, L.sub, { size: 6, col: C.silver, alpha: (1 - out) * ease((lt - .45) / .3), maxW: mw });
  hud.restore();
}
function chapterTag(def, t) {
  if (!def.chapter) return;
  if (def.noTag) return;
  if (HIBIT) {                                // v10 Hi-Bit: the title only (not the slam's subtitle), on a soft plate so it reads over light scenes
    const [num, name] = def.chapter, ttl = String(name ?? '').split('  ·  ')[0];
    const a = (def.chapterFirst ? ease((t - def.t0 - 1.8) / .5) : 1) * (def.broll ? .85 : 1);
    if (a <= 0) return;
    hud.font = `700 6px ${FONT.head}`; const tw = Math.min(150, hud.measureText(ttl).width);
    rect(6, 6, tw + 16, 16, C.bg, .55 * a); rect(6, 6, 1.6, 16, BRAND.hud, a);
    text(String(num ?? ''), 11, 10.5, { size: 4.6, col: BRAND.hud, align: 'left', alpha: a, outline: false });
    text(ttl, 11, 17, { size: 6, font: 'head', weight: 700, col: C.white, align: 'left', alpha: a, outline: false, maxW: 150 });
    return;
  }
  const [num, name] = def.chapter;
  const a = def.chapterFirst ? ease((t - def.t0 - 1.8) / .5) : 1;
  rect(8, 8, 2, 11, BRAND.hud, a);
  text(num, 14, 11, { size: 5.5, col: BRAND.hud, align: 'left', alpha: a, outline: false });
  text(name, 14, 17.5, { size: 6.5, font: 'head', weight: 700, col: C.white, align: 'left', alpha: a, outline: false });
}

// ---------- frame ----------
export function drawFrame(t) {
  const i = activeIndex(t), cur = SHOTS[i];
  // keep only the shots needed now built
  SHOTS.forEach((s, k) => { if (Math.abs(k - i) > 1) dispose(s); });
  NOW = t;
  const prev = i > 0 ? SHOTS[i - 1] : null, nxt = SHOTS[i + 1];
  let mixv = 0, a = cur, b = null, inc = null;
  const D = s => s.chapterFirst ? SETTINGS.transitions.chapterDuration : SETTINGS.transitions.duration;
  if (prev && t < cur.t0 + D(cur) / 2 && !cur.cut) { a = prev; b = cur; inc = cur; mixv = (t - (cur.t0 - D(cur) / 2)) / D(cur); }
  else if (nxt && t > nxt.t0 - D(nxt) / 2 && !nxt.cut) { a = cur; b = nxt; inc = nxt; mixv = (t - (nxt.t0 - D(nxt) / 2)) / D(nxt); }
  renderShot(a, t, rtA, idA);
  if (b) renderShot(b, t, rtB, idB);
  postMat.uniforms.mixv.value = b ? clamp(mixv) : 0;
  if (inc) postMat.uniforms.mode.value = inc.trans ?? (inc.chapterFirst ? 3 : [0, 1, 2, 4, 1, 0][SHOTS.indexOf(inc) % 6]);
  const U = postMat.uniforms;
  for (const [def, sky, out] of [[a, U.skyA, U.outA], [b || a, U.skyB, U.outB]]) {
    const S = def._S, bgc = S?.bg ?? C.bg, sk = S?.sky || [bgc, { [C.bg]: C.navy, [C.navy]: C.blue }[bgc] ?? bgc];
    if (HIBIT) { const n = Math.max(1, sk.length); for (let k = 0; k < 4; k++) sky.value[k].set(sk[Math.min(n - 1, Math.round(k * (n - 1) / 3))]); }   // 2-4 colours, top -> horizon
    else { sky.value[0].set(sk[0]); sky.value[1].set(sk[1]); }
    out.value.set(S?.outline === false ? 0 : 1, S?.rim === false ? 0 : 1, S?.fogNear ?? 30, S?.fogFar ?? 80);
  }
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  hud.setTransform(1, 0, 0, 1, 0, 0); hud.clearRect(0, 0, OW, OH); hud.setTransform(K * PREVIEW_SCALE, 0, 0, K * PREVIEW_SCALE, 0, 0);
  const hudShot = b && mixv > .5 ? b : a;
  const ha = b ? Math.abs(mixv - .5) * 2 : 1;               // HUD dips through the dissolve
  hud.globalAlpha = 1;
  if (hudShot.draw) { hud.save(); hud.globalAlpha = ha; hudShot.draw(hudShot._st, t, hudShot._S); hud.restore(); }
  chapterSlam(hudShot, t);
  chapterTag(hudShot, t);
}

// ---------- output ----------
export const outCanvas = document.createElement('canvas'); outCanvas.width = OW; outCanvas.height = OH;
const oc = outCanvas.getContext('2d');
export function compose(t) { drawFrame(t); oc.drawImage(glCanvas, 0, 0); oc.drawImage(hudCanvas, 0, 0); return outCanvas; }

export async function checkFrames(times, name = 'check', scale = .5) {
  const c = document.createElement('canvas'); c.width = FW * scale; c.height = FH * scale; const x = c.getContext('2d');
  for (const t of times) { compose(t); x.drawImage(outCanvas, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r)); await fetch(`${SUITE.base}/frame/${name}/${Math.round(t * 100)}`, { method: 'POST', body: b }); }
  return times.length;
}

// WebCodecs H.264 export (hardware). Streams annex-b to /append/<name>.
export async function exportVideo({ name = 'video', fps = 30, from = 0, to, bitrate = 10e6, onProgress } = {}) {
  const chunks = []; let bytes = 0, first = true, err = null;
  const enc = new VideoEncoder({ output: c => { const b = new Uint8Array(c.byteLength); c.copyTo(b); chunks.push(b); bytes += b.length; },
    error: e => err = e });
  let cfg = { codec: 'avc1.640028', width: FW, height: FH, bitrate, framerate: fps, hardwareAcceleration: 'prefer-hardware',
    latencyMode: 'quality', avc: { format: 'annexb' } };
  for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) {       // fall back if no HW encoder
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

// Event pass for sound design: steps through the whole timeline once (no encoding) and collects
// shot boundaries (with transition mode), image-card entrances and key-reveal moments.
export async function collectEvents(end, fps = 30) {
  SHOTS.forEach(dispose); EVENTS.length = 0;                 // rebuild every shot so its accents get recorded
  for (let f = 0; f < end * fps; f++) { drawFrame(f / fps); if (f % 300 === 0) await new Promise(r => setTimeout(r, 0)); }
  const shots = SHOTS.map((s, i) => ({ t0: +s.t0.toFixed(3), chapter: !!s.chapterFirst, cut: !!s.cut,
    mode: s.trans ?? (s.chapterFirst ? 3 : [0, 1, 2, 4, 1, 0][i % 6]), name: s.name || '' }));
  const hits = [...new Set(EVENTS.filter(e => e[0] === 'hits').flatMap(e => e[2]))].sort((a, b) => a - b);
  const cards = [...new Map(EVENTS.filter(e => e[0] === 'card').map(e => [e[1] + e[2], { t: e[1], key: e[2] }])).values()].sort((a, b) => a.t - b.t);
  return { shots, hits, cards };
}

// ---------- layout check (v10): the app's check_layout, the Quality check and a crew's sign-off ----------
// At steady moments of every shot (checkTimes) it reports { t, type, what, other?, detail }:
//   overlap   two solid things (userData.solid) pass through each other (userData.over = true / [obj] marks it as meant)
//   float     a thing that should rest (userData.rest) hangs above every support
//   camera    the camera is inside a solid thing
//   cut       a subject of the shot (an object returned from build) is cut by the frame edge (userData.bleed = true: meant)
//   hud       two HUD texts / cards cover each other, or one covers the chapter tag
//   edge      HUD text or a card runs off the frame or into its outer 4 % margin
//   small     HUD text below 4.4 units (26 px in the 1080p output): unreadable on a phone
//   blank     the frame as seen (3D + HUD) is almost one flat colour (>= 97 %): nothing is shown (the subject is off-frame,
//             hidden or behind the camera). It wins over dark and empty; a near-black one with S.dark = true is meant.
//   dark      the 3D picture, or the frame as seen (a black HUD wash), is almost all near-black (S.dark = true: meant)
//   empty     the 3D picture is almost only two colours - a bare floor and wall (S.sparse = true: meant)
const _lb = new THREE.Box3(), _lb2 = new THREE.Box3(), _lv = new THREE.Vector3();
let _dk = null;
const visibleDeep = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
function worldBox(o) {
  const b = new THREE.Box3(); o.updateWorldMatrix(true, true);
  o.traverse(m => {
    if (!m.visible || !(m.isMesh || m.isInstancedMesh) || !m.geometry || m.userData.noBox || m.material?.userData?.image === undefined && !m.material?.userData?.facet && !m.material?.isMeshBasicMaterial) return;
    if (m.isInstancedMesh) { m.computeBoundingBox(); _lb2.copy(m.boundingBox).applyMatrix4(m.matrixWorld); }
    else { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); _lb2.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); }
    b.union(_lb2);
  });
  return b.isEmpty() ? null : b;
}
const isAnc = (a, b) => { for (let p = b.parent; p; p = p.parent) if (p === a) return true; return false; };
const nameOf = (o, k) => o.userData.name || o.name || k || 'object';
function transitionAt(t) {
  const i = activeIndex(t), cur = SHOTS[i], prev = SHOTS[i - 1], nxt = SHOTS[i + 1];
  const D = s => s.chapterFirst ? SETTINGS.transitions.chapterDuration : SETTINGS.transitions.duration;
  return !!((prev && !cur.cut && t < cur.t0 + D(cur) / 2 + .05) || (nxt && !nxt.cut && t > nxt.t0 - D(nxt) / 2 - .05));
}
export function checkTimes() {
  const out = [];
  for (const s of SHOTS) { const d = (s.t1 ?? s.t0) - s.t0; if (d <= .4) continue; for (const f of d > 5 ? [.3, .75] : [.6]) out.push(+(s.t0 + d * f).toFixed(2)); }
  return out;
}
export function layoutIssues(t) {
  if (!SHOTS.length || transitionAt(t)) return [];
  const i = activeIndex(t), def = SHOTS[i], where = `(${def._file || 'scene'}:${def._line ?? '?'})`, out = [];
  SUITE.pick = []; try { drawFrame(t); } finally { var picks = SUITE.pick; SUITE.pick = null; }
  const S = def._S, st = def._st || {};
  if (S && !def.broll) {
    // solids: the outermost objects marked userData.solid
    const solids = [];
    S.scene.traverse(o => { if (o.userData?.solid && visibleDeep(o) && !solids.some(s => isAnc(s, o))) { const b = worldBox(o); if (b) solids.push({ o, b }); } });
    const supports = [];
    S.scene.traverse(o => { if ((o.userData?.ground || o.userData?.solid) && visibleDeep(o)) { const b = worldBox(o); if (b) supports.push({ o, b }); } });
    const vol = b => { b.getSize(_lv); return Math.max(1e-6, _lv.x * _lv.y * _lv.z); };
    for (let a = 0; a < solids.length; a++) for (let c = a + 1; c < solids.length; c++) {
      const A = solids[a], B = solids[c], ua = A.o.userData, ub = B.o.userData;
      if (ua.over === true || ub.over === true || (Array.isArray(ua.over) && ua.over.includes(B.o)) || (Array.isArray(ub.over) && ub.over.includes(A.o))) continue;
      if (isAnc(A.o, B.o) || isAnc(B.o, A.o) || !A.b.intersectsBox(B.b)) continue;
      const I = _lb.copy(A.b).intersect(B.b), frac = vol(I) / Math.min(vol(A.b), vol(B.b));
      if (frac > .15) out.push({ t, type: 'overlap', what: nameOf(A.o), other: `${nameOf(B.o)} ${where}`, detail: `${Math.round(frac * 100)}% of the smaller one is inside the other: move them apart (place() / arrange()), or mark a meant contact with userData.over = [other]` });
    }
    for (const A of solids) {
      if (!A.o.userData.rest) continue;
      const bottom = A.b.min.y; if (bottom < .03) continue;
      const held = supports.some(s => s.o !== A.o && !isAnc(A.o, s.o) && s.b.max.y <= bottom + .03 && s.b.max.y >= bottom - .06 &&
        s.b.min.x < A.b.max.x && s.b.max.x > A.b.min.x && s.b.min.z < A.b.max.z && s.b.max.z > A.b.min.z);
      if (!held) out.push({ t, type: 'float', what: `${nameOf(A.o)} ${where}`, detail: `its bottom is ${bottom.toFixed(2)} m up with nothing under it: put it on the floor / its support (place(obj, x, z, { on }))` });
    }
    const cp = S.cam.position;
    for (const A of solids) { _lb.copy(A.b).expandByScalar(-.02); if (_lb.containsPoint(cp)) out.push({ t, type: 'camera', what: `${nameOf(A.o)} ${where}`, detail: 'the camera is inside it: move the camera out or hide the object for this shot' }); }
    // the picture, at 96 x 54: blank / dark / empty, at most one of them (in that order).
    //   blank: the frame as seen (3D + HUD) is almost one flat colour: nothing is shown (the subject is off-frame, hidden or
    //          behind the camera). A near-black one with S.dark = true is meant ("the screen goes black").
    //   dark:  the 3D picture, or the frame as seen (a black HUD wash over it), is almost all near-black: an unlit frame
    //          (S.dark = true: meant, e.g. "the screen goes dark")
    //   empty: the 3D picture is almost only two colours: a bare floor and wall (S.sparse = true: meant)
    {
      _dk ??= Object.assign(document.createElement('canvas'), { width: 96, height: 54 });
      const x = _dk.getContext('2d', { willReadFrequently: true });
      const measure = withHud => {
        x.drawImage(glCanvas, 0, 0, 96, 54); if (withHud) x.drawImage(hudCanvas, 0, 0, 96, 54);
        const px = x.getImageData(0, 0, 96, 54).data; let dark = 0; const hist = new Map();
        for (let k = 0; k < px.length; k += 4) { if (.2126 * px[k] + .7152 * px[k + 1] + .0722 * px[k + 2] < 34) dark++;
          const q = (px[k] >> 5) << 6 | (px[k + 1] >> 5) << 3 | (px[k + 2] >> 5); hist.set(q, (hist.get(q) || 0) + 1); }
        const n = px.length / 4, top = [...hist.values()].sort((a, b) => b - a);
        return { dark: dark / n, top1: (top[0] || 0) / n, top2: ((top[0] || 0) + (top[1] || 0)) / n };
      };
      const P3 = measure(false), PF = measure(true), f = Math.max(P3.dark, PF.dark);
      if (PF.top1 >= .97 && !(S.dark && PF.dark > .8)) out.push({ t, type: 'blank', what: `shot ${i + 1} ${where}`, detail: `${Math.round(PF.top1 * 100)}% of the frame is one flat colour, nothing is shown: put the subject in front of the camera, inside the frame and visible (camera.js frame() on it), and build the set and its light` });
      else if (S.dark) { /* meant */ }
      else if (f > .8) out.push({ t, type: 'dark', what: `shot ${i + 1} ${where}`, detail: `${Math.round(f * 100)}% of the picture is near-black${PF.dark > P3.dark + .1 ? ' (a dark HUD wash or plate over it)' : ''}: light the subject (lightPreset 'studio' / 'neon' / 'interior'), use a lighter set or sky, or fill the frame with the subject; darken the mood with colour, never with a black wash (S.dark = true if the words call for darkness)` });
      else if (P3.top2 > .86 && !S.sparse && !(def.chapterFirst && t - def.t0 < 2.4)) out.push({ t, type: 'empty', what: `shot ${i + 1} ${where}`, detail: `${Math.round(P3.top2 * 100)}% of the picture is just two colours (a bare floor and wall): bring the subject closer (camera.js frame 'MS' / 'CU'), add the set's props or people, or show the real thing as b-roll (S.sparse = true if a bare frame is meant)` });
    }
    // subjects (objects the shot's build returned) cut by the frame edge
    for (const [k, v] of Object.entries(st)) {
      if (!v?.isObject3D || !visibleDeep(v) || v.userData.ground || v.userData.bleed) continue;
      const b = worldBox(v); if (!b) continue;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = false;
      for (let n = 0; n < 8; n++) { _lv.set(n & 1 ? b.max.x : b.min.x, n & 2 ? b.max.y : b.min.y, n & 4 ? b.max.z : b.min.z);
        const [x, y, z] = project(_lv, S.cam); if (z > 1) { behind = true; break; } x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      if (behind) continue;
      const area = (x1 - x0) * (y1 - y0), fully = x1 < 0 || x0 > W || y1 < 0 || y0 > H;
      if (fully || area < W * H * .02 || area > W * H * 1.6) continue;
      const vis = (Math.min(x1, W) - Math.max(x0, 0)) * (Math.min(y1, H) - Math.max(y0, 0)) / area;
      if (vis < .8) out.push({ t, type: 'cut', what: `st.${k} (${nameOf(v, k)}) ${where}`, detail: `only ${Math.round(vis * 100)}% of it is in the frame: reframe (camera.js frame()) or set userData.bleed = true if meant` });
    }
  }
  // HUD: texts / cards from the scene (src) against each other and against the engine's own chrome (chapter tag)
  const P = (picks || []).filter(p => p.alpha > .5 && p.w > 0 && p.h > 0 && p.kind !== 'broll');
  const scene = P.filter(p => p.src && p.kind !== 'box'), chrome = P.filter(p => !p.src && p.kind === 'text' && p.x < 120 && p.y < 26);   // (boxes are backgrounds; chrome = the chapter tag)
  const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const label = p => `${p.kind} "${String(p.text ?? p.key ?? '').slice(0, 30)}" (${p.src ? p.src.file + ':' + p.src.line : 'engine'})`;
  for (let a = 0; a < scene.length; a++) {
    const A = scene[a];
    for (let c = a + 1; c < scene.length; c++) {
      const B = scene[c]; if (A.src.file === B.src.file && A.src.line === B.src.line) continue;     // one call (a card and its own label)
      if ((A.kind === 'card') !== (B.kind === 'card') && inter(A, B) / Math.min(A.w * A.h, B.w * B.h) > .9) continue;   // text deliberately ON a card
      const f = inter(A, B) / Math.min(A.w * A.h, B.w * B.h);
      if (f > .2) out.push({ t, type: 'hud', what: label(A), other: label(B), detail: `${Math.round(f * 100)}% of the smaller one is covered: move one, or show them at different times` });
    }
    for (const B of chrome) { const f = inter(A, B) / Math.min(A.w * A.h, B.w * B.h); if (f > .15) out.push({ t, type: 'hud', what: label(A), other: 'the chapter tag (top left)', detail: 'covers the chapter tag: keep HUD items out of x < 110, y < 24' }); }
    if (A.w < W * .9 && (A.x < W * .04 || A.y < H * .04 || A.x + A.w > W * .96 || A.y + A.h > H * .96)) out.push({ t, type: 'edge', what: label(A), detail: `runs into the outer 4% of the frame (x ${A.x.toFixed(0)}..${(A.x + A.w).toFixed(0)} of ${W}, y ${A.y.toFixed(0)}..${(A.y + A.h).toFixed(0)} of ${H})` });
    if (A.kind === 'text' && A.size < 4.4) out.push({ t, type: 'small', what: label(A), detail: `text size ${A.size} (under 4.4 = ${Math.round(4.4 * K)} px at 1080p): too small to read on a phone` });
  }
  return out;
}

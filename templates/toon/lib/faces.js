// Faces: expression sprites (made with Google Flow, keyed to "features only" by experiments/toon-style/tools/faces.py)
// projected onto the front of the head sphere like a decal: they turn with the head and wrap around it in 3/4 view.
// The shader also draws, for sprites with eye whites: eyelids (closing for the one in-between frame of an expression
// change, or half-lidded), pupils that look around (the sprite's own pupil is replaced by a drawn one at the same size),
// a second sprite to cross-fade, a 'pop' scale (shock eyes pop in at 85 % for a frame) and up to two extras (sweat drop,
// blush, stress lines) that can slide (stress dashes fall off the head).
// Library: lib/faces/index.json { families: { <fam>: { <expr>: { file, line, eyes: [{ c:[u,v], r:[ru,rv], ro:[u,v,ru,rv], pupil:[u,v,r] }] } } }, extras: {...} }
// (c, r = the eye white; ro = the whole drawn eye incl. a half-lid's skin and the outline; line = the sprite's line width, all in uv)
import { THREE } from './core.js';

let LIB = { families: {}, extras: {} };
const TEX = new Map();
const loader = new THREE.TextureLoader();
const BASE = new URL('./faces/', import.meta.url).href;
function tex(file) {
  if (!file) return null;
  if (TEX.has(file)) return TEX.get(file);
  const t = loader.load(BASE + file); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  TEX.set(file, t); return t;
}
/** load the expression index and every sprite (before the first frame) */
export async function loadFaces() {
  try { LIB = await (await fetch(BASE + 'index.json')).json(); } catch { LIB = { families: {}, extras: {} }; console.warn('faces: lib/faces/index.json missing'); return; }
  const files = new Set();
  for (const fam of Object.values(LIB.families || {})) for (const e of Object.values(fam)) if (e.file) files.add(e.file);
  for (const e of Object.values(LIB.extras || {})) if (e.file) files.add(e.file);
  await Promise.all([...files].map(f => new Promise(res => { const t = loader.load(BASE + f, () => res(), undefined, () => { console.warn('face sprite missing: ' + f); res(); }); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; TEX.set(f, t); })));
}
export const families = () => Object.keys(LIB.families || {});
export const expressions = (fam = 'classic') => Object.keys(LIB.families?.[fam] || {});
export const extrasList = () => Object.keys(LIB.extras || {});
const ALIAS = { idle: 'neutral', calm: 'neutral', joy: 'happy', glad: 'happy', grin: 'happy', sad: 'sad', fear: 'scared', afraid: 'scared', terrified: 'terrified', shock: 'shocked', surprise: 'surprised', mad: 'angry', annoyed: 'annoyed', sly: 'smug', proud: 'smug', ill: 'sick', pain: 'pain', hurt: 'pain', disgust: 'disgusted', think: 'thinking', bored: 'bored', tired: 'sleepy', asleep: 'asleep', dead: 'dead' };
export function exprOf(fam, name) {
  const F = LIB.families?.[fam] || LIB.families?.classic || {};
  const n = String(name || 'neutral').toLowerCase();
  return F[n] || F[ALIAS[n]] || F.neutral || Object.values(F)[0] || null;
}

// The white-face palette: a white head under scene light lands mid-grey, so white skin gets a lift curve AFTER lighting:
// the shade side rises a lot (to a soft cool grey), the lit side a little and rolls off below the bloom threshold (.82),
// so the head reads bright white yet stays round. Face lines are never lifted (they keep their ink). Hands, bare arms and
// legs use whiteSkinMat() with the same curve.
const LIFT = `vec3 czLift(vec3 x){ x = sqrt(max(x, vec3(0.)));
    vec3 k = vec3(.7), m = vec3(.82); x = mix(x, k + (m - k) * (1. - exp(-(x - k) / (m - k))), step(k, x));
    float l = dot(x, vec3(.3333)); return x * mix(vec3(.86, .9, .98), vec3(1.), smoothstep(.3, .66, l)); }`;
const MATS = new Map();
/** a toon skin material for white-palette bare skin (hands, arms, legs): the same lift curve as the white heads */
export function whiteSkinMat(color = '#f4f3ef', rough = .8) {
  const key = color + rough; if (MATS.has(key)) return MATS.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough });
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + LIFT).replace('#include <opaque_fragment>', 'outgoingLight = czLift(outgoingLight);\n#include <opaque_fragment>'); };
  m.customProgramCacheKey = () => 'whiteskin'; MATS.set(key, m); return m;
}
const MAXE = 2;
// pupil vec4: u, v, r, w = 0 no pupil | 1 pupil | 3 pupil + the eye needs the squarer shut cover (flat lid bars, `sq`)
const eyeVec = e => e ? [new THREE.Vector4(e.c[0], e.c[1], e.r[0], e.r[1]), new THREE.Vector4(...(e.pupil ? [e.pupil[0], e.pupil[1], e.pupil[2], e.sq ? 3 : 1] : [0, 0, 0, 0]))] : [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)];
// the whole drawn eye (white + the lid skin above a half-lid + the outline): what a shut eye hides. `ro` from faces.py, else white + line
const outVec = (e, lw) => e ? (e.ro ? new THREE.Vector4(...e.ro) : new THREE.Vector4(e.c[0], e.c[1], e.r[0] + lw, e.r[1] + lw)) : new THREE.Vector4(0, 0, 0, 0);

/** The head material with the face. opts: { R, scale (1 = sprite circle on the silhouette), y (shift, in R), gap, family, acc } */
export function faceMaterial(skin, opts = {}) {
  const R = opts.R || .245;
  const fam = opts.family || 'classic';
  const m = new THREE.MeshStandardMaterial({ color: skin, roughness: .78 });
  const U = {
    fA: { value: null }, fB: { value: null }, fMix: { value: 0 }, fHasA: { value: 0 }, fHasB: { value: 0 },
    eA: { value: [new THREE.Vector4(), new THREE.Vector4()] }, pA: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    eB: { value: [new THREE.Vector4(), new THREE.Vector4()] }, pB: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    oA: { value: [new THREE.Vector4(), new THREE.Vector4()] }, oB: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    lid: { value: 0 }, look: { value: new THREE.Vector2() }, popA: { value: 1 }, lwA: { value: .02 }, lwB: { value: .02 },
    fR: { value: R }, fScale: { value: opts.scale ?? 1 }, fY: { value: opts.y ?? 0 },
    x1: { value: null }, x1On: { value: 0 }, x1Off: { value: new THREE.Vector2() }, x1S: { value: 1 },
    x2: { value: null }, x2On: { value: 0 }, x2Off: { value: new THREE.Vector2() }, x2S: { value: 1 },
    skinC: { value: new THREE.Color(skin) }, inkC: { value: new THREE.Color('#2a1d17') },
    stubble: { value: (opts.acc || []).includes('stubble') ? 1 : 0 }, freckles: { value: (opts.acc || []).includes('freckles') ? 1 : 0 },
    liftOn: { value: opts.white ? 1 : 0 },
  };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vObj;
      uniform sampler2D fA, fB, x1, x2; uniform float fMix, fHasA, fHasB, lid, popA, fR, fScale, fY, x1On, x1S, x2On, x2S, stubble, freckles, lwA, lwB;
      uniform vec4 eA[2], pA[2], eB[2], pB[2], oA[2], oB[2]; uniform vec2 look, x1Off, x2Off; uniform vec3 skinC, inkC; uniform float liftOn;
      ${LIFT}
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // one sprite with its eyes: lids close from the top, pupils are redrawn where the look points; shut (lid > .93):
      // the whole eye (white + its outline, lw = the sprite's line width) goes and one closed-lid stroke is drawn
      vec4 faceOf(sampler2D T, vec2 uv, vec4 E[2], vec4 Pp[2], vec4 O[2], float pop, float lw){
        vec2 q = (uv - .5) / pop + .5;
        vec4 c = texture2D(T, q);
        float qw = .7 * (fwidth(q.x) + fwidth(q.y));                 // one screen pixel in sprite units (crisp drawn pupils)
        for (int i = 0; i < 2; i++) {
          vec4 e = E[i]; if (e.z <= 0.) continue;
          vec2 d = (q - e.xy) / (e.zw * 1.06); float r = length(d);
          if (r < 1.) {
            vec4 P = Pp[i];
            if (P.w > .5 && r < .86) {                             // inside the white: white, then the drawn pupil
              vec2 pc = P.xy + look * max(e.zw - P.z, e.zw * .25); float pd = length((q - pc) / vec2(P.z));   // look 1 = pupil against the rim
              float aw = clamp(qw / P.z, .01, .2);
              vec3 col = vec3(1.); float pa = 1. - smoothstep(1. - aw, 1. + aw, pd); col = mix(col, inkC * .9, pa);
              float hl = 1. - smoothstep(.26 - aw, .26 + aw, length((q - pc - vec2(-.36, .36) * P.z) / P.z)); col = mix(col, vec3(1.), hl * pa);
              c = vec4(mix(c.rgb, col, smoothstep(.86, .80, r)), max(c.a, smoothstep(.9, .8, r)));
            }
            float yl = 1. - 2.2 * lid;                              // lid edge: +1 = open .. -1 = over the whole white
            if (lid > .001 && lid <= .93 && d.y > yl - .02) {
              float edge = smoothstep(.06, .0, abs(d.y - yl));
              vec4 L = vec4(skinC, 1.); if (d.y < yl + .12) L = vec4(mix(skinC, inkC, edge), 1.);
              c = mix(c, L, smoothstep(1.02, .94, r));
            }
          }
          if (lid > .93) {
            vec4 o = O[i]; vec2 ro = o.zw; vec2 dq = abs((q - o.xy) / ro);
            float rn = Pp[i].w > 2. ? pow(dq.x * dq.x * dq.x + dq.y * dq.y * dq.y, 1. / 3.) : length(dq);   // squircle for flat lid bars
            float cover = smoothstep(1.08, 1.0, rn);
            vec2 s = q - o.xy; float xs = s.x / ro.x;
            s.y += ro.y * .1 - ro.y * .16 * xs * xs;                // a soft closed curve, ends up, just below the middle
            float dist = length(vec2(max(abs(s.x) - max(ro.x * .86 - lw * .5, 0.), 0.), s.y));
            float ink = 1. - smoothstep(lw * .5 - .0012, lw * .5 + .0012, dist);
            float a2 = c.a * (1. - cover), oa = ink + a2 * (1. - ink);
            c = vec4((inkC * ink + c.rgb * a2 * (1. - ink)) / max(oa, 1e-4), oa);
          }
        }
        return c;
      }`)
      .replace('#include <opaque_fragment>', `if (liftOn > .5) outgoingLight = mix(czLift(outgoingLight), outgoingLight, czInk);
      #include <opaque_fragment>`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      float czInk = 0.;
      {
        vec3 p = vObj / fR;
        float front = smoothstep(.02, .3, p.z);
        vec2 uv = vec2(.5 + p.x / (2. * fScale), .5 + (p.y - fY) / (2. * fScale));
        vec3 base = diffuseColor.rgb;
        if (stubble > .5) { float s = smoothstep(-.05, -.42, p.y) * smoothstep(.1, .5, p.z) * (.55 + .45 * hsh(floor(uv * 260.))); base = mix(base, base * .78, s * .55); }
        if (freckles > .5) { vec2 g = floor(uv * 90.); float h = hsh(g); vec2 f = fract(uv * 90.) - .5; float cheek = smoothstep(.16, .08, abs(abs(p.x) - .38) + abs(p.y + .1) * .8); base = mix(base, base * .62, step(.86, h) * smoothstep(.32, .2, length(f)) * cheek * front); }
        vec4 f = vec4(0.);
        if (fHasA > .5) f = faceOf(fA, uv, eA, pA, oA, popA, lwA);
        if (fHasB > .5 && fMix > .001) f = mix(f, faceOf(fB, uv, eB, pB, oB, 1., lwB), fMix);
        if (x1On > .001) { vec4 x = texture2D(x1, (uv - .5 - x1Off) / x1S + .5); f = mix(f, vec4(x.rgb, 1.), x.a * x1On); }
        if (x2On > .001) { vec4 x = texture2D(x2, (uv - .5 - x2Off) / x2S + .5); f = mix(f, vec4(x.rgb, 1.), x.a * x2On); }
        diffuseColor.rgb = mix(base, f.rgb, clamp(f.a, 0., 1.) * front);
        czInk = clamp(f.a, 0., 1.) * front * (1. - smoothstep(.55, .8, dot(f.rgb, vec3(.3333))));   // dark lines keep their ink
      }`);
  };
  m.customProgramCacheKey = () => 'toonface';
  const api = {
    material: m, family: fam, uniforms: U, cur: null,
    /** show expression `name` (and optionally cross-fade to `nameB` by k) */
    set(name, nameB = null, k = 0) {
      const a = exprOf(fam, name);
      if (a) { U.fA.value = tex(a.file); U.fHasA.value = U.fA.value ? 1 : 0; U.lwA.value = a.line || .02; const e = a.eyes || []; for (let i = 0; i < MAXE; i++) { const [ev, pv] = eyeVec(e[i]); U.eA.value[i].copy(ev); U.pA.value[i].copy(pv); U.oA.value[i].copy(outVec(e[i], U.lwA.value)); } }
      else U.fHasA.value = 0;
      if (nameB && k > 0) { const b = exprOf(fam, nameB); if (b) { U.fB.value = tex(b.file); U.fHasB.value = 1; U.lwB.value = b.line || .02; const e = b.eyes || []; for (let i = 0; i < MAXE; i++) { const [ev, pv] = eyeVec(e[i]); U.eB.value[i].copy(ev); U.pB.value[i].copy(pv); U.oB.value[i].copy(outVec(e[i], U.lwB.value)); } } U.fMix.value = k; }
      else { U.fHasB.value = 0; U.fMix.value = 0; }
      api.cur = name; return api;
    },
    lids(k) { U.lid.value = Math.max(0, Math.min(1, k)); return api; },
    /** true when expression `name` has drawable eyes (lids, blinks and pupils work on it) */
    hasEyes(name) { const e = exprOf(fam, name); return !!(e && (e.eyes || []).some(x => x.r && x.r[0] > 0)); },
    lookAt(x, y) { U.look.value.set(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))); return api; },
    pop(s) { U.popA.value = s; return api; },
    extra(slot, name, o = {}) {
      const X = LIB.extras?.[name]; const k = slot === 2 ? 'x2' : 'x1';
      if (!X || o.alpha === 0) { U[k + 'On'].value = 0; return api; }
      U[k].value = tex(X.file); U[k + 'On'].value = o.alpha ?? 1; U[k + 'Off'].value.set(o.x ?? 0, o.y ?? 0); U[k + 'S'].value = o.scale ?? 1; return api;
    },
  };
  api.set('neutral');
  return api;
}

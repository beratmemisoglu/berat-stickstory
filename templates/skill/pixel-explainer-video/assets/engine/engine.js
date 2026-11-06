// Pixel-explainer engine: pixel-art 3D (320x180, Sweetie-16 palette, faceted ramps, cast shadows, depth outlines,
// dithered skies/fog) + a 1080p HUD in retro fonts, a shot system with 5 dithered transition styles,
// word-synced cues, real-image cards, an event pass for sound design, and WebCodecs H.264 export.
// See references/engine_api.md in the skill for the full API.
import * as THREE from 'three';
export { THREE };

THREE.ColorManagement.enabled = false;           // every color is a literal sRGB palette value
export const W = 320, H = 180, K = 6, FW = W * K, FH = H * K;
export const C = {bg:"#1a1c2c", plum:"#5d275d", red:"#b13e53", orange:"#ef7d57", yellow:"#ffcd75", lime:"#a7f070",
  green:"#38b764", teal:"#257179", navy:"#29366f", blue:"#3b5dc9", sky:"#41a6f6", cyan:"#73eff7", white:"#f4f4f4",
  silver:"#94b0c2", slate:"#566c86", dark:"#333c57"};
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
const norm = s => s.toLowerCase().replace(/[^a-z0-9.,]/g, '').replace(/[.,]$/g, '');
export async function loadTimeline(url) {
  PHRASES = await (await fetch(url)).json();
  WORDS = PHRASES.flatMap((p, pi) => p.words.map(w => ({...w, n: norm(w.w), pi})));
}
// time the spoken word `word` starts, searching the nearest occurrence to `near` seconds
export function cue(word, near, which = 's') {
  const parts = word.split(' ').map(norm);
  let best = null, bd = 1e9;
  for (let i = 0; i < WORDS.length; i++) {
    if (!parts.every((p, k) => WORDS[i + k] && WORDS[i + k].n.startsWith(p))) continue;
    const d = Math.abs(WORDS[i].s - near);
    if (d < bd) { bd = d; best = which === 's' ? WORDS[i].s : WORDS[i + parts.length - 1].e; }
  }
  if (best === null || bd > 12) { console.warn('cue miss', word, near); return near; }
  return best;
}

// ---------- materials ----------
export const FOG = { color: { value: new THREE.Color(C.bg) }, near: { value: 30 }, far: { value: 80 } };
export const SHADOW = { map: { value: null }, matrix: { value: new THREE.Matrix4() }, on: { value: 0 } };
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
const facetFS = `
  uniform vec3 c0, c1, c2, cd, fogColor; uniform float fogNear, fogFar, opacity, shadowOn;
  uniform sampler2D shadowMap; uniform mat4 shadowMatrix;
  varying vec3 vN; varying float vDepth; varying vec3 vW;
  float bayer(vec2 p){ int x = int(mod(p.x,4.)), y = int(mod(p.y,4.));
    int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return float(m[y*4+x])/16.; }
  void main(){
    float d = dot(normalize(vN), normalize(vec3(-.5, 1., .7)));
    int band = d > .6 ? 2 : d > -.1 ? 1 : 0;
    if (shadowOn > .5 && band > 0) {                   // cast shadow: 4-tap PCF, dithered penumbra, one ramp step darker
      vec4 sp = shadowMatrix * vec4(vW, 1.); vec3 q = sp.xyz / sp.w * .5 + .5;
      if (q.x > 0. && q.x < 1. && q.y > 0. && q.y < 1. && q.z < 1.) {
        float sh = 0., o = 1. / 2048.;
        for (int i = 0; i < 4; i++) { vec2 k = vec2(float(i / 2) - .5, float(i - (i / 2) * 2) - .5) * 1.5 * o;
          sh += q.z - .0015 > texture2D(shadowMap, q.xy + k).r ? 1. : 0.; }
        if (sh * .25 > bayer(gl_FragCoord.xy + 3.) * .98 + .01) band -= 1;
      }
    }
    vec3 c = band == 2 ? c2 : band == 1 ? c1 : c0;
    float f = smoothstep(fogNear, fogFar, vDepth);
    if (f > bayer(gl_FragCoord.xy) * .999 + .0005) c = fogColor;     // dithered fog: pure palette
    if (opacity < 1. && opacity <= bayer(gl_FragCoord.xy + 1.)) discard; // dithered transparency
    gl_FragColor = vec4(c, 1.);
  }`;
const matCache = new Map();
export function facet(ramp, opts = {}) {
  const r = typeof ramp === 'string' ? RAMP[ramp] : ramp;
  const key = r.join() + (opts.opacity ?? '') + (opts.side ?? '');
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: { c0: { value: new THREE.Color(r[0]) }, c1: { value: new THREE.Color(r[1]) }, c2: { value: new THREE.Color(r[2]) }, cd: { value: new THREE.Color(C.bg) },
      fogColor: FOG.color, fogNear: FOG.near, fogFar: FOG.far, opacity: { value: opts.opacity ?? 1 },
      shadowMap: SHADOW.map, shadowMatrix: SHADOW.matrix, shadowOn: SHADOW.on },
    vertexShader: facetVS, fragmentShader: facetFS, side: opts.side ?? THREE.FrontSide,
  });
  m.userData.facet = true;
  if (!opts.unique) matCache.set(key, m);
  return m;
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
renderer.setPixelRatio(1); renderer.setSize(FW, FH, false);
const mkRT = () => { const d = new THREE.DepthTexture(W, H); d.type = THREE.FloatType;
  return new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, depthTexture: d }); };
const shadowRT = new THREE.WebGLRenderTarget(2048, 2048, { depthBuffer: true, depthTexture: new THREE.DepthTexture(2048, 2048) });
shadowRT.depthTexture.type = THREE.FloatType;
SHADOW.map.value = shadowRT.depthTexture;
const lightCam = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 300);
const LIGHT = new THREE.Vector3(-.5, 1, .7).normalize();
const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _hidden = [];
function shadowPass(S) {
  if (S.shadows === false) { SHADOW.on.value = 0; return; }
  // shadow box centred where the camera looks (ray hit on the ground plane), sized to the view distance
  S.cam.getWorldDirection(_d);
  let dist = _d.y < -.05 ? -S.cam.position.y / _d.y : 20; dist = Math.min(dist, 80);
  const c = S.shadowCenter ?? _v.copy(S.cam.position).addScaledVector(_d, dist);
  const size = S.shadowSize ?? Math.max(8, dist * 1.1);
  const texel = size * 2 / 2048;                                       // snap to texels: no shimmering
  const cx = Math.round(c.x / texel) * texel, cz = Math.round(c.z / texel) * texel;
  lightCam.left = lightCam.bottom = -size; lightCam.right = lightCam.top = size;
  lightCam.position.set(cx, c.y ?? 0, cz).addScaledVector(LIGHT, 120); lightCam.lookAt(cx, c.y ?? 0, cz);
  lightCam.near = 1; lightCam.far = 260; lightCam.updateProjectionMatrix(); lightCam.updateMatrixWorld();
  _hidden.length = 0;
  S.scene.traverse(o => { if (o.visible && (o.isLine || o.isPoints || (o.material && !o.material.userData?.facet && !o.isMesh) || o.userData.noShadow || (o.isMesh && !o.material.userData?.facet))) { o.visible = false; _hidden.push(o); } });
  const bg = S.scene.background; S.scene.background = null; S.scene.overrideMaterial = depthOnly;
  renderer.setRenderTarget(shadowRT); renderer.clear(); renderer.render(S.scene, lightCam);
  S.scene.overrideMaterial = null; S.scene.background = bg; _hidden.forEach(o => o.visible = true);
  SHADOW.matrix.value.multiplyMatrices(lightCam.projectionMatrix, lightCam.matrixWorldInverse);
  SHADOW.on.value = 1;
}
const rtA = mkRT(), rtB = mkRT();
const PAL = Object.values(C).map(h => { const c = new THREE.Color(h); return new THREE.Vector3(c.r, c.g, c.b); });
const postMat = new THREE.ShaderMaterial({
  uniforms: { a: { value: rtA.texture }, b: { value: rtB.texture }, da: { value: rtA.depthTexture }, db: { value: rtB.depthTexture },
    skyA: { value: [new THREE.Color(), new THREE.Color()] }, skyB: { value: [new THREE.Color(), new THREE.Color()] },
    outA: { value: 1 }, outB: { value: 1 }, mixv: { value: 0 }, mode: { value: 0 }, pal: { value: PAL },
    shake: { value: new THREE.Vector2() }, flash: { value: 0 }, aberr: { value: 0 }, vig: { value: .35 } },
  vertexShader: `varying vec2 uv0; void main(){ uv0 = uv; gl_Position = vec4(position, 1.); }`,
  fragmentShader: `uniform sampler2D a, b, da, db; uniform vec3 skyA[2], skyB[2]; uniform float outA, outB; uniform float mixv, mode, flash, aberr, vig;
    float lin(float z){ float n = .1, f = 400.; return n * f / (f - z * (f - n)); }
    // colour of one shot at art pixel p: sky where nothing was drawn, dark contour where depth jumps
    vec3 shade(sampler2D t, sampler2D dt, vec3 s0, vec3 s1, float outl, vec2 p, vec2 R){
      vec2 uv = (p + .5) / R;
      float z = texture2D(dt, uv).r;
      vec3 c = texture2D(t, uv).rgb;
      if (z >= .99999) {
        float g = clamp((p.y / R.y - .42) / .22, 0., 1.);
        int x = int(mod(p.x,4.)), y = int(mod(p.y,4.)); int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
        c = g > float(m[y*4+x]) / 16. ? s0 : s1;
      }
      if (outl > .5) {
        float d = lin(z), dn = 1e9;
        dn = min(dn, lin(texture2D(dt, uv + vec2(1., 0.) / R).r)); dn = min(dn, lin(texture2D(dt, uv - vec2(1., 0.) / R).r));
        dn = min(dn, lin(texture2D(dt, uv + vec2(0., 1.) / R).r)); dn = min(dn, lin(texture2D(dt, uv - vec2(0., 1.) / R).r));
        if (d - dn > max(.35, dn * .12)) c = vec3(.102, .110, .173);
      }
      return c;
    } uniform vec3 pal[16]; uniform vec2 shake; varying vec2 uv0;
    float bayer(vec2 p){ int x = int(mod(p.x,4.)), y = int(mod(p.y,4.));
      int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return float(m[y*4+x])/16.; }
    float hash(float n){ return fract(sin(n) * 43758.5453); }
    void main(){
      vec2 R = vec2(${W}., ${H}.);
      vec2 px = floor(gl_FragCoord.xy / ${K}.);
      vec2 p = px; float m = mixv, sel;
      if (mode > 3.5) {                                   // 4: pixelate out, swap, pixelate in
        float blk = 1. + floor(15. * sin(clamp(m, 0., 1.) * 3.14159));
        p = floor(px / blk) * blk + floor(blk * .5); sel = step(.5, m);
      } else if (mode > 2.5) {                            // 3: glitch slices
        float band = floor(px.y / 5.), k = floor(m * 14.);
        float r = hash(band * 91.7 + k * 13.1);
        p.x += (r - .5) * 120. * sin(clamp(m, 0., 1.) * 3.14159) * step(.55, hash(band + k));
        sel = step(.5 + (hash(band * 3.1 + k) - .5) * .3, m);
      } else if (mode > 1.5) {                            // 2: iris
        float d = length((px - R * .5) / R.y);
        sel = step(d + bayer(px) * .06, m * 1.05);
      } else if (mode > .5) {                             // 1: diagonal dithered wipe
        float e = px.x / R.x * .75 + (1. - px.y / R.y) * .25;
        sel = step(e + (bayer(px) - .5) * .14, m * 1.3 - .15);
      } else sel = step(bayer(px) + .0001, m);           // 0: dither dissolve
      vec3 c = sel > .5 ? shade(b, db, skyB[0], skyB[1], outB, p, R) : shade(a, da, skyA[0], skyA[1], outA, p, R);
      vec2 q = px / R - .5; float v = smoothstep(.5, .85, length(q * vec2(1., .82)));
      c *= 1. - v * vig;
      c += (bayer(px + 2.) - .5) * .05 * step(.001, v + flash);                   // dither so gradients/vignette band cleanly
      vec3 best = pal[0]; float bd = 1e9;
      for (int i = 0; i < 16; i++) { vec3 d = c - pal[i]; float dd = dot(d, d); if (dd < bd) { bd = dd; best = pal[i]; } }
      gl_FragColor = vec4(best, 1.);
    }`,
});
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

// ---------- HUD ----------
export const hudCanvas = document.createElement('canvas'); hudCanvas.width = FW; hudCanvas.height = FH;
export const hud = hudCanvas.getContext('2d');
export const FONT = { head: 'Orbitron', body: "'Share Tech Mono'" };
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
  if (font === 'head' && alpha < 1 && !o.noKinetic) {  // headlines decode in and rise into place
    str = scramble(String(str), alpha, Math.floor(NOW * 24)); y += (1 - alpha) * 4;
  }
  hud.globalAlpha = alpha; hud.font = `${weight} ${size}px ${FONT[font] || font}`;
  hud.textAlign = align; hud.textBaseline = base; hud.letterSpacing = spacing + 'px';
  if (outline) { hud.lineJoin = 'round'; hud.lineWidth = Math.max(1, size * .3); hud.strokeStyle = C.bg; hud.strokeText(str, x, y, maxW); }
  hud.fillStyle = col; hud.fillText(str, x, y, maxW);
  const w = hud.measureText(str).width; hud.globalAlpha = 1; hud.letterSpacing = '0px'; return w;
}
export function rect(x, y, w, h, col, alpha = 1) { hud.globalAlpha = alpha; hud.fillStyle = col; hud.fillRect(x, y, w, h); hud.globalAlpha = 1; }
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
export function fmt(n, dec = 0) { return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
// big stat: value + unit, centered
export function stat(x, y, value, unit, o = {}) {
  const { size = 22, col = C.white, unitCol = C.yellow, alpha = 1, align = 'center', label, labelCol = C.silver } = o;
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

// ---------- shots ----------
// shot: { t0, t1 (set automatically), chapter, build(S) -> st, update(st, t, S), draw(st, t, S) }
export const SHOTS = [];
export function shot(def) { SHOTS.push(def); }
function live(def) {
  if (!def._st) {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(C.bg);
    const cam = new THREE.PerspectiveCamera(40, W / H, .1, 400);
    const S = { scene, cam, t0: def.t0, t1: def.t1 };
    def._S = S; def._st = def.build(S) || {};
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
function renderShot(def, t, rt) {
  live(def);
  const S = def._S; FOG.near.value = S.fogNear ?? 30; FOG.far.value = S.fogFar ?? 80;
  S.scene.background.set(S.bg ?? C.bg); FOG.color.value.set(S.sky ? S.sky[1] : (S.bg ?? C.bg));
  def.update?.(def._st, t, S);
  // gentle push-in across the shot (S.push, default 4%)
  const prog = clamp((t - def.t0) / Math.max(1, def.t1 - def.t0));
  S.cam.fov = (S.fov ?? 40) * (1 - (S.push ?? .04) * ease(prog));
  S.cam.updateProjectionMatrix(); S.cam.updateMatrixWorld();
  shadowPass(S);
  renderer.setRenderTarget(rt); renderer.render(S.scene, S.cam);
}
export function finalizeShots(end) {
  SHOTS.sort((a, b) => a.t0 - b.t0);
  SHOTS.forEach((s, i) => s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : end);
}
function activeIndex(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t0) i++; return i; }

function chapterSlam(def, t) {
  if (!def.chapterFirst) return;
  const lt = t - def.t0; if (lt < 0 || lt > 2.4) return;
  const [num, name] = def.chapter;
  const bar = ease(lt / .3) * (1 - ease((lt - 1.9) / .4));
  rect(0, 0, W, 22 * bar, C.bg); rect(0, H - 22 * bar, W, 22 * bar, C.bg);                // letterbox
  const out = ease((lt - 1.6) / .5), inn = pop(lt, .1, .4);
  if (inn <= 0 || out >= 1) return;
  const sw = W * easeOut(lt / .35) * (1 - out);
  rect(W / 2 - sw / 2, H / 2 - 16, sw, 32, C.bg, .85);
  rect(W / 2 - sw / 2, H / 2 - 16, sw, 1.2, C.yellow); rect(W / 2 - sw / 2, H / 2 + 15, sw, 1.2, C.yellow);
  hud.save(); hud.translate(W / 2, H / 2); const sc = inn * (1 + out * .4); hud.scale(sc, sc);
  text(num, -2, -2, { size: 26, font: 'head', weight: 900, col: C.yellow, align: 'right', alpha: 1 - out, noKinetic: true });
  text(name.split('  ·  ')[0], 4, -5, { size: 9, font: 'head', weight: 900, align: 'left', alpha: (1 - out) * ease((lt - .25) / .4) });
  text(name.split('  ·  ')[1] || '', 4, 6, { size: 6, col: C.silver, align: 'left', alpha: (1 - out) * ease((lt - .45) / .3) });
  hud.restore();
}
function chapterTag(def, t) {
  if (!def.chapter) return;
  const [num, name] = def.chapter;
  const a = def.chapterFirst ? ease((t - def.t0 - 1.8) / .5) : 1;
  rect(8, 8, 2, 11, C.yellow, a);
  text(num, 14, 11, { size: 5.5, col: C.yellow, align: 'left', alpha: a, outline: false });
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
  const D = s => s.chapterFirst ? .5 : .42;
  if (prev && t < cur.t0 + D(cur) / 2 && !cur.cut) { a = prev; b = cur; inc = cur; mixv = (t - (cur.t0 - D(cur) / 2)) / D(cur); }
  else if (nxt && t > nxt.t0 - D(nxt) / 2 && !nxt.cut) { a = cur; b = nxt; inc = nxt; mixv = (t - (nxt.t0 - D(nxt) / 2)) / D(nxt); }
  renderShot(a, t, rtA);
  if (b) renderShot(b, t, rtB);
  postMat.uniforms.mixv.value = b ? clamp(mixv) : 0;
  if (inc) postMat.uniforms.mode.value = inc.trans ?? (inc.chapterFirst ? 3 : [0, 1, 2, 4, 1, 0][SHOTS.indexOf(inc) % 6]);
  const U = postMat.uniforms;
  for (const [def, sky, out] of [[a, U.skyA, U.outA], [b || a, U.skyB, U.outB]]) {
    const S = def._S, bgc = S?.bg ?? C.bg, sk = S?.sky || [bgc, { [C.bg]: C.navy, [C.navy]: C.blue }[bgc] ?? bgc];
    sky.value[0].set(sk[0]); sky.value[1].set(sk[1]); out.value = S?.outline === false ? 0 : 1;
  }
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  hud.setTransform(1, 0, 0, 1, 0, 0); hud.clearRect(0, 0, FW, FH); hud.setTransform(K, 0, 0, K, 0, 0);
  const hudShot = b && mixv > .5 ? b : a;
  const ha = b ? Math.abs(mixv - .5) * 2 : 1;               // HUD dips through the dissolve
  hud.globalAlpha = 1;
  if (hudShot.draw) { hud.save(); hud.globalAlpha = ha; hudShot.draw(hudShot._st, t, hudShot._S); hud.restore(); }
  chapterSlam(hudShot, t);
  chapterTag(hudShot, t);
}

// ---------- output ----------
export const outCanvas = document.createElement('canvas'); outCanvas.width = FW; outCanvas.height = FH;
const oc = outCanvas.getContext('2d');
export function compose(t) { drawFrame(t); oc.drawImage(glCanvas, 0, 0); oc.drawImage(hudCanvas, 0, 0); return outCanvas; }

export async function checkFrames(times, name = 'check', scale = .5) {
  const c = document.createElement('canvas'); c.width = FW * scale; c.height = FH * scale; const x = c.getContext('2d');
  for (const t of times) { compose(t); x.drawImage(outCanvas, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r)); await fetch(`/frame/${name}/${Math.round(t * 100)}`, { method: 'POST', body: b }); }
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
    await fetch(`/append/${name}${first ? '?reset=1' : ''}`, { method: 'POST', body: blob }); first = false;
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

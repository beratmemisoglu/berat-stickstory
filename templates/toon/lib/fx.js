// Effects of the toon look: particles, weather, light shafts, water, fire, smoke, x-ray. S.fx(kind, options) -> a THREE.Group
// added to the shot's scene. Every effect is a PURE FUNCTION OF TIME (userData.update(t) recomputes everything from t and
// seeded hashes: any frame can be drawn first, the same time always draws the same picture). Particles are instanced
// camera-facing sprites drawn in a shader (soft, chunky, toon-shaded: dots, discs, bubbles, 4-point stars, puffs, flame
// tongues, streaks), solids are instanced toon meshes with ink outlines. Lamps / fire / sparks are emissive (> 1) so bloom
// picks them up; flames write depth (alpha to coverage) so depth of field treats them like the set.
//
// Common options: at [x, y, z] (or an object: its centre), area [w, h, d] (falling weather: `at` is the ground centre and the
// box rises h above it; floating things: `at` is the box centre), count, size, color, seed, intensity, wind [x, y, z],
// t0 / t1 (absolute seconds: emitters start / stop, weather fades in / out), t (when a one-shot fires: explosion, splash,
// sparks, sparkle, lightning; defaults to the shot start + .5 s), sfx: false (no automatic sound event).
//
//  dust        motes drifting in light, twinkling as they turn         { at, area, count 70, size .016, color, wind, lit(x,y,z,t) }
//  rain        slanted streaks + splash rings on the ground            { at, area [10,7,10], count 700, speed 9, wind, length, splashes }
//  snow        chunky drifting flakes                                  { at, area [10,6,10], count 380, speed .75, size .04, sway }
//  leaves      falling tumbling leaves that settle on the ground      { at, area [6,4,6], count 40, size .11, palette | color, rest 2.5 }
//  petals      the same, pink petals, lighter and slower              { ...leaves }
//  confetti    burst (when o.t is given) or falling                    { at, t, count 90, dir, speed, palette, area (falling) }
//  smoke       soft toon puffs rising and growing                      { at, color 'grey'|'white'|'black'|hex, rate 7, life 2.8, size .3, grow 3.2, rise .6 }
//  steam       curling wisps from a mug / kettle (style 'puffs': puffs) { at, count 3, height .35, width .035 }
//  fire        flickering flame tongues + flickering point light       { at, size .5 (flame height), count 7, light (x), t0 (ignite), t1 (die) }
//  campfire    fire + logs + stones + embers + smoke                   { at, size .55, logs, stones, smoke, embers }
//  embers      glowing specks rising and dying                         { at, count 24, area .25 (radius), rise 1, life 1.6 }
//  sparks      a burst of hot streaks at o.t (o.every repeats)         { at, t, count 26, dir, spread 75, speed 4, gravity 1, life .6, light }
//  explosion   flash light + fireball shell + debris + smoke ring      { at, t, size 1, ground, debris 14, ring, sparks }
//  splash      water jet + droplets + ripple rings at o.t              { at (surface point), t, size 1, color }
//  bubbles     rising wobbling bubbles                                 { at, area [.8,1.6,.8], count 18, rise .45, size .045 }
//  sparkle     4-point star glints, 10 frames (pop 2 f, fade by 10 f) { at | on: object, t | times | every, count 1, size .16 }
//  stars       twinkling stars on the sky dome                         { at, count 420, radius 120 }
//  lightCone   hanging bulb + visible cone + floor pool + spot light   { at (bulb), length (to floor), radius, color, swing (deg), period 2.7, dust, shade }
//  godrays     window light shafts                                     { at (window centre), size [w,h], dir, length 5, count 4, dust }
//  glow        billboard halo on a light source                        { at | on: object, size .5, color, flicker, pulse, streak }
//  water       stylised ocean / pool surface: waves + foam lines       { at, size [40,40], waves .06, color, shallow, foam }
//  underwater  caustics on the floor (+ projected on everything) + motes + bubbles + rays + blue fog { at, area [12,12], depth 6 }
//  clouds      puffy toon cloud groups drifting                        { at, area [140,12,50], count 7, size 7, speed .5, tone 'day'|'dusk'|'night'|'storm'|'pink' }
//  fog         low ground mist layers                                  { at, size 16, height .7, layers 6, color, opacity .5 }
//  lightning   jagged bolt + sky flash at o.t (times / every)          { at (strike point), t, height 14, flash (screen) }
//  tornado     stylised swirling funnel + orbiting debris + base dust  { at, height 6, radius 2, speed 1.4 }
//  lava        glowing cracked crust, bubbles that pop, embers, light  { at, size [6,6] }
//  trail       glowing / ghost copies along a moving object's path     { of: object | character, path(t), t0, t1, style 'ghost'|'glow', copies, gap (frames) }
//  speedLines  streaks streaming past a falling / fast object          { of | at, dir [0,-1,0], count 28, radius [.45,1.3], speed 16 }
//  xrayScan    a cyan scan line sweeping across in 10 frames; turns `of` into an x-ray on the swept side { of, inside, t, dur, back, dir 'down'|'up' }
import { THREE, RH, C, E, clamp, lerp, seg, rnd, noise1, hash } from './core.js';
import { toonMat } from './rig.js';
import { addOutline, lathe } from './geo.js';

const TAU = Math.PI * 2, F = 1 / 30;
export const KINDS = {};
export function make(S, kind, o = {}) {
  const k = KINDS[kind]; if (!k) { console.warn('unknown fx ' + kind + ' (lib/fx.js has: ' + Object.keys(KINDS).join(', ') + ')'); return null; }
  const g = k(S, o || {});
  if (!g) return null;
  g.userData.fx = kind; g.traverse(m => { m.userData.noPick = true; });
  if (!g.parent) S.scene.add(g);
  return g;
}

// ---------- small helpers ----------
const wrap = (x, w) => ((x % w) + w) % w;
const edge = (u, e = .1) => clamp(u / e) * clamp((1 - u) / e);
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const frac = x => x - Math.floor(x);
const V = a => Array.isArray(a) ? new THREE.Vector3(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0) : a?.isVector3 ? a.clone() : new THREE.Vector3();
const cl = (c, k = 1) => new THREE.Color(c ?? '#ffffff').multiplyScalar(k);          // linear (hex is sRGB)
const rgb = (c, k = 1) => { const x = cl(c, k); return [x.r, x.g, x.b]; };
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
function ramp(stops, u) { if (u <= stops[0][0]) return stops[0][1]; for (let i = 1; i < stops.length; i++) if (u <= stops[i][0]) return lerp3(stops[i - 1][1], stops[i][1], (u - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return stops[stops.length - 1][1]; }
function box(o, d) { const a = o.area ?? o.box; if (Array.isArray(a)) return [a[0], a[1] ?? a[0], a[2] ?? a[0]]; if (typeof a === 'number') return [a, a, a]; return d; }
function size2(o, d) { const s = o.size; if (Array.isArray(s)) return [s[0], s[1] ?? s[0]]; if (typeof s === 'number') return [s, s]; return d; }
const rootOf = x => x?.root?.isObject3D ? x.root : x?.isObject3D ? x : null;
function posOf(o, d) {
  const a = o.at ?? o.pos ?? o.on; if (Array.isArray(a)) return V(a); if (a?.isVector3) return a.clone();
  const r = rootOf(a); if (r) { r.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(r).getCenter(new THREE.Vector3()); }
  return V(d);
}
function timeOf(o, S, d = .5) { for (const k of ['t', 'time', 'when']) if (typeof o[k] === 'number') return o[k]; if (typeof o.at === 'number') return o.at; if (typeof o.t0 === 'number') return o.t0; return (S.t0 ?? 0) + d; }
function timesOf(o, S, cap = 64) {
  if (Array.isArray(o.times)) return o.times.slice(0, cap);
  const T = timeOf(o, S); if (!o.every) return [T];
  const out = [], until = o.t1 ?? S.t1 ?? T + 10; for (let b = T; b <= until + 1e-6 && out.length < cap; b += o.every) out.push(b); return out;
}
// how much of a continuous effect is on at t: fades in after t0, out after t1
function env(o, t, fi = .35, fo = .6) { const a = o.t0 ?? -1e9, b = o.t1 ?? 1e9; return clamp((t - a) / (o.fadeIn ?? fi)) * clamp((b - t) / (o.fadeOut ?? fo)); }
function group(kind, ...kids) { const g = new THREE.Group(); g.name = 'fx:' + kind; for (const k of kids) if (k) g.add(k.mesh ?? k); return g; }
function basis(d) { const a = Math.abs(d.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0); const e1 = new THREE.Vector3().crossVectors(d, a).normalize(); return [e1, new THREE.Vector3().crossVectors(d, e1).normalize()]; }
const sfx = (S, o, type, t, gain = 0) => { if (o.sfx !== false && S.sfx) S.sfx(type, t, { gain }); };
// how bright the shot's light rig is, as an rgb multiplier: unlit puffs follow it (grey smoke is dark at night, white in
// the sun). o.light (a number) overrides.
function ambient(S, o) {
  if (typeof o.light === 'number') return [o.light, o.light, o.light];
  const r = S.rig; if (!r) return [1, 1, 1];
  const k = clamp(r.hemi.intensity * .9 + r.key.intensity * .2 + r.fill.intensity * .15, .18, 1.15), c = r.hemi.color;
  return [k * lerp(1, c.r, .25), k * lerp(1, c.g, .25), k * lerp(1, c.b, .25)];
}
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m4 = new THREE.Matrix4(), _s = new THREE.Vector3(), _c = new THREE.Color();
const PAL = {
  confetti: ['#ff4f6d', '#ffc93c', '#3fc1ff', '#6bdc6b', '#b77bff', '#ff8a3d', '#ffffff', '#ff7ab8'],
  autumn: ['#e8892e', '#d9562b', '#f2c14e', '#b8642c', '#c9a13a'], green: ['#5fae4a', '#3f9a3a', '#86c25a', '#4c8f3a'],
  petals: ['#f7a8c4', '#ffc4d8', '#f48fb1', '#fff0f5'],
};
const palette = (o, d) => (o.palette ? (Array.isArray(o.palette) ? o.palette : PAL[o.palette]) : null) ?? (o.color ? [o.color] : PAL[d]);

// ---------- GLSL ----------
const NOISE = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), u.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), u.x), u.y); }
float fbm(vec2 p){ return vnoise(p) * .55 + vnoise(p * 2.03 + 7.1) * .3 + vnoise(p * 4.1 + 3.3) * .15; }
`;
const FOG_F = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
  float fogF = 1. - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
  float fogF = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  #if ADD == 1
  c *= 1. - fogF;
  #else
  c = mix(c, fogColor, fogF);
  #endif
#endif
`;
// ---------- sprites: instanced quads, shape drawn in the shader ----------
// ORIENT 0: faces the camera (rotation iRot, never smaller than uMinPx: tiny far specks grow and fade instead of
// shimmering); 1: stretched along the world axis iAxis, turned to the camera around it (streaks, flames, scan line);
// 2: lying flat on the ground (ripples, pools of light).
const SVS = `
#include <common>
#include <fog_pars_vertex>
attribute vec3 iPos; attribute vec2 iSize; attribute float iRot; attribute vec4 iCol; attribute vec3 iAxis; attribute float iSeed;
uniform float uMinPx, uRes;
varying vec2 vUv; varying vec4 vCol; varying float vSeed;
void main(){
  vUv = position.xy * 2.; vCol = iCol; vSeed = iSeed;
  vec4 wp = modelMatrix * vec4(iPos, 1.);
  vec2 sz = iSize; float cr = cos(iRot), sr = sin(iRot);
  vec4 mvPosition;
#if ORIENT == 1
  vec3 ax = mat3(modelMatrix) * iAxis; ax = length(ax) > 1e-6 ? normalize(ax) : vec3(0., 1., 0.);
  vec3 toCam = normalize(cameraPosition - wp.xyz);
  vec3 sd = cross(ax, toCam); float sl = length(sd); sd = sl > 1e-4 ? sd / sl : vec3(1., 0., 0.);
  mvPosition = viewMatrix * vec4(wp.xyz + ax * (position.y * sz.y) + sd * (position.x * sz.x), 1.);
#elif ORIENT == 2
  vec2 q = vec2(position.x * sz.x, position.y * sz.y); q = vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y);
  mvPosition = viewMatrix * vec4(wp.xyz + vec3(q.x, 0., q.y), 1.);
#else
  mvPosition = viewMatrix * wp;
  float ppu = projectionMatrix[1][1] * uRes * .5 / max(.001, -mvPosition.z);
  float k = max(1., uMinPx / max(1e-5, sz.x * ppu));
  sz *= k; vCol.a /= k * k;
  vec2 q = vec2(position.x * sz.x, position.y * sz.y); q = vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y);
  mvPosition.xy += q;
#endif
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const SFS = `
#include <common>
#include <fog_pars_fragment>
uniform float uTime, uShade, uHL, uSoft, uThick;
uniform vec3 uC1, uC2, uC3;
varying vec2 vUv; varying vec4 vCol; varying float vSeed;
${NOISE}
float aa(float d){ return clamp(d / max(fwidth(d), 1e-5) + .5, 0., 1.); }
float prof(float y){ if (y <= 0. || y >= 1.) return 0.; return y < .3 ? sqrt(max(0., 1. - pow((.3 - y) / .3, 2.))) : pow(1. - (y - .3) / .7, 1.25); }
void main(){
  vec2 p = vUv; float r = length(p);
  vec3 c = vCol.rgb; float a = vCol.a;
#if SHAPE == 0
  float g = max(0., 1. - r);
  a *= g * g * .8 + (1. - smoothstep(.08, .42, r)) * .45;
#elif SHAPE == 1
  a *= aa(1. - r);
  float sh = smoothstep(-.06, .1, length(p - vec2(-.3, .32)) - .88);
  c *= mix(1., uShade, sh);
  float hl = aa(.2 - length((p - vec2(-.36, .4)) * vec2(1., 1.3)));
  c = mix(c, c * .35 + .85, hl * uHL);
#elif SHAPE == 2
  float ring = aa(uThick - abs(r - (1. - uThick)));
  float fill = aa(1. - r) * .14;
  float hl = aa(.16 - length((p - vec2(-.42, .42)) * vec2(1., 1.8)));
  c = mix(c, vec3(1.25), hl);
  a *= max(max(ring, fill), hl);
#elif SHAPE == 3
  vec2 q = abs(p) + 1e-4;
  float st = aa(1. - (pow(q.x, .55) + pow(q.y, .55)));
  float gl = max(0., 1. - r); gl = gl * gl * .4;
  c *= st + gl;
#elif SHAPE == 4
  float an = atan(p.y, p.x);
  float R = .8 + .075 * sin(an * 5. + vSeed * 6.283) + .05 * sin(an * 9. - vSeed * 13.7);
  a *= smoothstep(R, R - uSoft, r);
  vec2 np = p / R; vec3 n = vec3(np, sqrt(max(0., 1. - dot(np, np))));
  float l = dot(n, normalize(vec3(-.45, .6, .66)));
  c *= mix(uShade, 1.06, smoothstep(.18, .4, l));
#elif SHAPE == 5
  float y = clamp(p.y * .5 + .5, 0., 1.), tt = uTime * 2. + vSeed * 17.3;
  float sway = (vnoise(vec2(y * 2.2 - tt * 1.6, vSeed * 9.1)) - .5) * .75 * pow(y, 1.4);
  float x = p.x - sway, ax = abs(x);
  float top = .82 + .18 * vnoise(vec2(tt * 2.7, vSeed * 4.7));
  float yy = y / top;
  float wO = prof(yy) * .95, wM = prof(yy / .78) * .64, wC = prof((yy + .04) / .52) * .38;
  float inM = aa(wM - ax - .01), inC = aa(wC - ax - .01);
  c = mix(uC1, uC2, inM); c = mix(c, uC3, inC); c *= vCol.rgb;
  a *= aa(wO - ax - .012);
#elif SHAPE == 6
  float k = p.y * .5 + .5;
  a *= (1. - smoothstep(.2, 1., abs(p.x))) * smoothstep(0., .85, k) * (1. - smoothstep(.94, 1., k));
#elif SHAPE == 7
  a *= 1. - smoothstep(0., uThick, abs(r - (1. - uThick)));
#elif SHAPE == 8
  a *= (1. - smoothstep(.2, 1., abs(p.x))) * (1. - smoothstep(.45, 1., abs(p.y)));
#elif SHAPE == 9
  float ay = abs(p.y);
  float core = 1. - smoothstep(.06, .16, ay), glow = pow(max(0., 1. - ay), 2.6);
  c = (uC1 * core + uC2 * glow * .8) * (1. - smoothstep(.72, 1., abs(p.x)));
#elif SHAPE == 10
  a *= (1. - smoothstep(.7, 1., abs(p.x))) * (1. - smoothstep(.55, 1., abs(p.y)));
#endif
  if (a < .004) discard;
  ${FOG_F}
  gl_FragColor = vec4(c, a);
}`;
const SHAPES = { dot: 0, disc: 1, bubble: 2, star: 3, puff: 4, flame: 5, streak: 6, ripple: 7, line: 8, scan: 9, rect: 10 };
class Sprites {
  constructor(n, o = {}) {
    this.n = Math.max(1, n | 0); this.k = 0;
    const q = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.setIndex(q.index); g.setAttribute('position', q.attributes.position);
    const A = (name, sz) => { const at = new THREE.InstancedBufferAttribute(new Float32Array(this.n * sz), sz); at.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, at); return at.array; };
    this.P = A('iPos', 3); this.Z = A('iSize', 2); this.R = A('iRot', 1); this.Cc = A('iCol', 4); this.X = A('iAxis', 3); this.D = A('iSeed', 1);
    g.instanceCount = 0; this.geo = g;
    const blend = o.blend || 'add', solid = blend === 'solid';
    this.u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uMinPx: { value: o.minPx ?? 1.2 }, uRes: { value: RH },
      uShade: { value: o.shade ?? .8 }, uHL: { value: o.hl ?? 0 }, uSoft: { value: o.soft ?? .3 }, uThick: { value: o.thick ?? .12 },
      uC1: { value: o.c1 ?? cl('#ff4d1a', 2.4) }, uC2: { value: o.c2 ?? cl('#ff9a2a', 2.8) }, uC3: { value: o.c3 ?? cl('#ffe27a', 3.6) } }]);
    const m = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: SVS, fragmentShader: SFS,
      defines: { SHAPE: SHAPES[o.shape ?? 'dot'], ORIENT: o.orient ?? 0, ADD: blend === 'add' ? 1 : 0 },
      transparent: !solid, depthWrite: solid, blending: blend === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
      alphaToCoverage: solid, fog: o.fog !== false, side: THREE.DoubleSide });
    m.forceSinglePass = true;
    this.mat = m; this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = o.order ?? 0; this.mesh.userData.noPick = true;
  }
  reset() { this.k = 0; return this; }
  add(x, y, z, w, h, rot, r, g, b, a, ax = 0, ay = 0, az = 0, seed = 0) {
    if (this.k >= this.n || !(a > .002) || !(w > 0) || !(h > 0)) return;
    const i = this.k++, i3 = i * 3, i4 = i * 4, i2 = i * 2;
    this.P[i3] = x; this.P[i3 + 1] = y; this.P[i3 + 2] = z; this.Z[i2] = w; this.Z[i2 + 1] = h; this.R[i] = rot || 0;
    this.Cc[i4] = r; this.Cc[i4 + 1] = g; this.Cc[i4 + 2] = b; this.Cc[i4 + 3] = a;
    this.X[i3] = ax; this.X[i3 + 1] = ay; this.X[i3 + 2] = az; this.D[i] = seed;
  }
  done(t = 0) {
    const g = this.geo; g.instanceCount = this.k;
    for (const nm of ['iPos', 'iSize', 'iRot', 'iCol', 'iAxis', 'iSeed']) g.attributes[nm].needsUpdate = true;
    this.u.uTime.value = t;
  }
}
// ---------- ribbons: camera-facing strips along a polyline (steam wisps, lightning bolts) ----------
const RVS = `
#include <common>
#include <fog_pars_vertex>
attribute vec3 aT; attribute float aS, aW, aA, aV;
varying float vS, vA, vV;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.);
  vec3 tg = mat3(modelMatrix) * aT; tg = length(tg) > 1e-6 ? normalize(tg) : vec3(0., 1., 0.);
  vec3 toCam = normalize(cameraPosition - wp.xyz);
  vec3 sd = cross(tg, toCam); float sl = length(sd); sd = sl > 1e-4 ? sd / sl : vec3(1., 0., 0.);
  wp.xyz += sd * aS * aW * .5;
  vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
  vS = aS; vA = aA; vV = aV;
  #include <fog_vertex>
}`;
const RFS = `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uCol, uCore;
varying float vS, vA, vV;
void main(){
  float x = min(abs(vS), 1.); vec3 c; float a = vA;
#if RMODE == 1
  float core = 1. - smoothstep(.12, .3, x), glow = (1. - x) * (1. - x);
  c = uCore * core + uCol * glow;
#else
  c = uCol; a *= 1. - smoothstep(.25, 1., x);
#endif
  if (a < .003) discard;
  ${FOG_F}
  gl_FragColor = vec4(c, a);
}`;
class Ribbons {
  constructor(nr, m, o = {}) {
    this.nr = nr; this.m = m;
    const nv = nr * m * 2, g = new THREE.BufferGeometry();
    const A = (name, sz, dyn = true) => { const at = new THREE.BufferAttribute(new Float32Array(nv * sz), sz); if (dyn) at.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, at); return at; };
    this.aC = A('position', 3); this.aT = A('aT', 3); this.aW = A('aW', 1); this.aA = A('aA', 1);
    const aS = A('aS', 1, false), aV = A('aV', 1, false), idx = [];
    for (let r = 0; r < nr; r++) for (let j = 0; j < m; j++) { const v = (r * m + j) * 2; aS.array[v] = -1; aS.array[v + 1] = 1; aV.array[v] = aV.array[v + 1] = j / (m - 1); if (j < m - 1) idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
    g.setIndex(idx);
    const add = o.blend === 'add';
    this.u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCol: { value: o.color ?? cl('#ffffff') }, uCore: { value: o.core ?? cl('#ffffff') } }]);
    this.mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: RVS, fragmentShader: RFS, defines: { RMODE: o.mode ?? 0, ADD: add ? 1 : 0 },
      transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: o.fog !== false });
    this.mat.forceSinglePass = true;
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.userData.noPick = true; this.mesh.renderOrder = o.order ?? 0;
  }
  clear() { this.aA.array.fill(0); }
  /** ribbon r through points P ([x,y,z] list, up to m), width w(v) and alpha a(v) (v = 0..1 along) */
  line(r, P, w, a) {
    const n = Math.min(P.length, this.m), C3 = this.aC.array, T3 = this.aT.array, W = this.aW.array, A1 = this.aA.array;
    for (let j = 0; j < this.m; j++) {
      const jj = Math.min(j, n - 1), p = P[jj], pa = P[Math.max(0, jj - 1)], pb = P[Math.min(n - 1, jj + 1)], v = jj / Math.max(1, n - 1);
      for (let s = 0; s < 2; s++) { const k = (r * this.m + j) * 2 + s; C3[k * 3] = p[0]; C3[k * 3 + 1] = p[1]; C3[k * 3 + 2] = p[2]; T3[k * 3] = pb[0] - pa[0]; T3[k * 3 + 1] = pb[1] - pa[1]; T3[k * 3 + 2] = pb[2] - pa[2]; W[k] = typeof w === 'function' ? w(v) : w; A1[k] = j < n ? (typeof a === 'function' ? a(v) : a) : 0; }
    }
  }
  done() { for (const at of [this.aC, this.aT, this.aW, this.aA]) at.needsUpdate = true; }
}
// ---------- solids: instanced toon meshes (+ an instanced ink outline) ----------
const INK = new Map();
function inkMat(w, px = 1.2, color = C.ink) {
  const key = w + '|' + px + '|' + color; if (INK.has(key)) return INK.get(key);
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uCol: { value: new THREE.Color(color) }, uW: { value: w }, uPx: { value: px * RH / 1920 }, uH: { value: RH } },
    vertexShader: `uniform float uW, uPx, uH;
void main(){
  mat4 im = mat4(1.);
#ifdef USE_INSTANCING
  im = instanceMatrix;
#endif
  vec4 mv = modelViewMatrix * im * vec4(position, 1.);
  vec3 n = normalize(mat3(modelViewMatrix) * mat3(im) * normal);
  float px2w = 2. * max(-mv.z, .01) / (projectionMatrix[1][1] * uH);
  float wl = max(uW, uPx * px2w);
  mv.xyz += n * wl; mv.z -= wl * .6;
  gl_Position = projectionMatrix * mv;
}`, fragmentShader: 'uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 1.); }' });
  INK.set(key, m); return m;
}
class Solids {
  constructor(geo, mat, n, o = {}) {
    this.n = Math.max(1, n | 0); this.k = 0;
    const m = new THREE.InstancedMesh(geo, mat, this.n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0;
    m.castShadow = !!o.shadow; m.receiveShadow = !!o.receive; m.userData.noPick = true;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.n * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh = m;
    if (o.outline) { const ol = new THREE.InstancedMesh(geo, inkMat(o.outline, o.outlinePx ?? 1.2), this.n); ol.instanceMatrix = m.instanceMatrix; ol.frustumCulled = false; ol.count = 0; ol.userData.noPick = true; ol.userData.isOutline = true; m.add(ol); this.ol = ol; }
  }
  reset() { this.k = 0; return this; }
  add(x, y, z, q, sx, sy = sx, sz = sx, color = null) {
    if (this.k >= this.n || !(Math.abs(sx * sy * sz) > 1e-12)) return;
    const i = this.k++; _m4.compose(_v.set(x, y, z), q, _s.set(sx, sy, sz)); this.mesh.setMatrixAt(i, _m4); if (color) this.mesh.setColorAt(i, color);
  }
  done() { this.mesh.count = this.k; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; if (this.ol) this.ol.count = this.k; }
}
const solidMat = (o = {}) => {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: o.rough ?? .7, metalness: 0, side: o.side ?? THREE.FrontSide, map: o.map ?? null, alphaTest: o.map ? .5 : 0, alphaToCoverage: !!o.map, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1 });
  if (o.self) { const k = (+o.self).toFixed(3);       // a little self-light in its own (instance) colour: confetti and leaves stay bright in a dim set
    m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * ' + k + ';'); };
    m.customProgramCacheKey = () => 'czfx-self' + k; }
  return m;
};
const lightOf = (Ctor, ...a) => { const l = new Ctor(...a); l.userData.noPick = true; return l; };

// ====================================================================================================================
// AIR: dust, rain, snow, leaves, petals, confetti, bubbles
// ====================================================================================================================
KINDS.dust = (S, o) => {
  const c = posOf(o, [0, 1.3, 0]), [W, H, D] = box(o, [3, 2.2, 3]), n = Math.round(o.count ?? 70), R = rnd(o.seed ?? 11);
  const sp = new Sprites(n, { shape: 'dot', blend: 'add', minPx: 2 });
  const col = rgb(o.color ?? '#fff0cf', (o.intensity ?? 1) * 1.15), size = o.size ?? .016, wind = V(o.wind ?? [.02, .012, .006]), lit = o.lit;
  const P = []; for (let i = 0; i < n; i++) P.push([R() * W, R() * H, R() * D, .55 + R() * .9, R() * 100, .6 + R() * .8]);
  const g = group('dust', sp);
  g.userData.update = t => {
    sp.reset(); const e = env(o, t);
    if (e > 0) for (let i = 0; i < n; i++) {
      const p = P[i], ft = t * .16 * p[5];
      const lx = wrap(p[0] + wind.x * t + noise1(ft + p[4], 1) * .3, W), ly = wrap(p[1] + wind.y * t + noise1(ft + p[4], 2) * .22, H), lz = wrap(p[2] + wind.z * t + noise1(ft + p[4], 3) * .3, D);
      const x = c.x - W / 2 + lx, y = c.y - H / 2 + ly, z = c.z - D / 2 + lz;
      let a = e * edge(lx / W) * edge(ly / H) * edge(lz / D);
      const tw = noise1(t * .7 * p[5] + p[4], 5) * .5 + .5; a *= .25 + .75 * tw * tw;      // a mote catches the light as it turns
      if (lit && a > .002) a *= lit(x, y, z, t);
      const s = size * p[3]; sp.add(x, y, z, s, s, 0, col[0], col[1], col[2], a);
    }
    sp.done(t);
  };
  return g;
};

KINDS.rain = (S, o) => {
  const c = posOf(o, [0, 0, 0]), [W, H, D] = box(o, [10, 7, 10]), n = Math.round(o.count ?? 700), seed = o.seed ?? 21;
  const gy = o.ground ?? c.y, speed = o.speed ?? 9, wind = V(o.wind ?? [1.4, 0, .3]), len = o.length ?? .45, wid = o.width ?? .011;
  const vel = new THREE.Vector3(wind.x, -speed, wind.z), ax = vel.clone().normalize();
  const T = H / speed, col = rgb(o.color ?? '#dbe7ff', 1.05), op = o.opacity ?? .5, nr = Math.min(n, Math.round(o.splashes ?? n * .45)), ringLife = .32;
  const streaks = new Sprites(n, { shape: 'streak', blend: 'normal', orient: 1 });
  const rings = new Sprites(nr, { shape: 'ripple', blend: 'normal', orient: 2, thick: .22 });
  const ph = Array.from({ length: n }, (_, i) => hash(i * 1.37, seed));
  const g = group('rain', streaks, rings);
  g.userData.update = t => {
    streaks.reset(); rings.reset(); const e = env(o, t);
    if (e > 0) for (let i = 0; i < n; i++) {
      const u = t / T + ph[i], cyc = Math.floor(u), f = u - cyc, rem = (1 - f) * T;
      const ix = c.x + (hash(i * 7.13 + cyc * 1.71, seed + 1) - .5) * W, iz = c.z + (hash(i * 3.71 + cyc * 2.39, seed + 2) - .5) * D;
      const x = ix - vel.x * rem, y = gy + speed * rem, z = iz - vel.z * rem;
      streaks.add(x - ax.x * len / 2, y - ax.y * len / 2, z - ax.z * len / 2, wid, len, 0, col[0], col[1], col[2], op * e * sstep(0, .06, f), ax.x, ax.y, ax.z);
      if (i < nr) { const age = f * T; if (age < ringLife) {
        const px = c.x + (hash(i * 7.13 + (cyc - 1) * 1.71, seed + 1) - .5) * W, pz = c.z + (hash(i * 3.71 + (cyc - 1) * 2.39, seed + 2) - .5) * D, k = age / ringLife, s = .05 + .26 * E.outCubic(k);
        rings.add(px, gy + .012, pz, s, s * .9, 0, col[0], col[1], col[2], op * 1.3 * e * Math.pow(1 - k, 1.3)); } }
    }
    streaks.done(t); rings.done(t);
  };
  return g;
};

KINDS.snow = (S, o) => {
  const c = posOf(o, [0, 0, 0]), [W, H, D] = box(o, [10, 6, 10]), n = Math.round(o.count ?? 380), seed = o.seed ?? 23, R = rnd(seed);
  const gy = o.ground ?? c.y, speed = o.speed ?? .75, size = o.size ?? .04, sway = o.sway ?? .3, wind = V(o.wind ?? [.25, 0, .05]), col = rgb(o.color ?? '#ffffff', 1.02), op = o.opacity ?? .95;
  const sp = new Sprites(n, { shape: 'disc', blend: 'normal', shade: .8, minPx: 1.5 });
  const P = []; for (let i = 0; i < n; i++) P.push([R(), R(), R(), .6 + R() * .8, R() * TAU, .7 + R() * .6, .6 + R() * .8]);
  const g = group('snow', sp);
  g.userData.update = t => {
    sp.reset(); const e = env(o, t), A = ambient(S, o);
    if (e > 0) for (let i = 0; i < n; i++) {
      const p = P[i], f = frac(t * speed * p[5] / H + p[2]);
      const xr = wrap(p[0] * W + wind.x * t + sway * Math.sin(t * .9 * p[6] + p[4]), W) / W, zr = wrap(p[1] * D + wind.z * t + sway * .7 * Math.cos(t * .7 * p[6] + p[4] * 1.3), D) / D;
      const s = size * p[3];
      sp.add(c.x + (xr - .5) * W, gy + H * (1 - f), c.z + (zr - .5) * D, s, s, 0, col[0] * A[0], col[1] * A[1], col[2] * A[2], op * e * edge(xr, .06) * edge(zr, .06) * sstep(0, .04, f) * (1 - sstep(.97, 1, f)));
    }
    sp.done(t);
  };
  return g;
};

// leaf / petal cards: white shapes with the ink line drawn in (tinted per instance)
const CARDS = {};
function cardTex(kind) {
  if (CARDS[kind]) return CARDS[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.lineJoin = 'round'; x.lineCap = 'round';
  const path = () => { x.beginPath();
    if (kind === 'petal') { x.moveTo(64, 122); x.bezierCurveTo(8, 92, 12, 22, 46, 10); x.quadraticCurveTo(64, 30, 82, 10); x.bezierCurveTo(116, 22, 120, 92, 64, 122); }
    else { x.moveTo(64, 5); x.bezierCurveTo(114, 34, 110, 94, 64, 123); x.bezierCurveTo(18, 94, 14, 34, 64, 5); }
    x.closePath(); };
  path(); x.fillStyle = '#ffffff'; x.fill();
  x.save(); path(); x.clip();
  x.fillStyle = 'rgba(0,0,0,.17)'; x.beginPath(); x.ellipse(98, 82, 52, 70, -.3, 0, TAU); x.fill();                          // shade side
  if (kind === 'petal') { x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(48, 46, 12, 20, -.4, 0, TAU); x.fill(); x.strokeStyle = 'rgba(42,29,23,.25)'; x.lineWidth = 3; x.beginPath(); x.moveTo(64, 110); x.lineTo(64, 70); x.stroke(); }
  else { x.strokeStyle = 'rgba(42,29,23,.55)'; x.lineWidth = 4; x.beginPath(); x.moveTo(64, 16); x.quadraticCurveTo(58, 70, 64, 120); x.stroke(); x.lineWidth = 3;
    for (const [y, s] of [[44, 1], [62, -1], [78, 1], [94, -1], [54, -1], [86, 1]]) { x.beginPath(); x.moveTo(62, y); x.quadraticCurveTo(62 + s * 18, y - 6, 62 + s * 30, y - 14); x.stroke(); } }
  x.restore();
  path(); x.strokeStyle = '#2a1d17'; x.lineWidth = 7; x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; CARDS[kind] = t; return t;
}
function cardGeo(curl = .12) { const g = new THREE.PlaneGeometry(1, 1, 3, 5), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, curl * (4 * y * y - .5) + curl * .6 * (4 * x * x - .5)); } g.computeVertexNormals(); return g; }
function fallers(kind, S, o, d) {
  const c = posOf(o, [0, 0, 0]), [W, H, D] = box(o, d.area), n = Math.round(o.count ?? d.count), seed = o.seed ?? d.seed, R = rnd(seed);
  const gy = o.ground ?? c.y, speed = o.speed ?? d.speed, size = o.size ?? d.size, sway = o.sway ?? d.sway, wind = V(o.wind ?? [.15, 0, .05]), rest = o.rest ?? 2.5;
  const pal = palette(o, d.pal).map(h => new THREE.Color(h));
  const so = new Solids(d.card ? cardGeo(d.curl) : new THREE.PlaneGeometry(1, 1.6), solidMat({ map: d.card ? cardTex(d.card) : null, side: THREE.DoubleSide, rough: .75, self: d.self }), n, { shadow: o.shadows });
  const P = []; for (let i = 0; i < n; i++) P.push({ x: R(), z: R(), ph: R(), s: .75 + R() * .5, w1: 1.2 + R() * 1.6, w2: .8 + R() * 1.4, w3: 2 + R() * 3, a: R() * TAU, b: R() * TAU, cc: Math.floor(R() * pal.length), sk: .75 + R() * .5, yaw: R() * TAU });
  const qAt = (p, t) => _e.set(1.1 * Math.sin(t * p.w1 + p.a) + t * p.w3 * d.spin, t * p.w2 * .6 + p.b, .9 * Math.sin(t * p.w2 * 1.3 + p.a * 2), 'XYZ');
  const g = group(kind, so);
  g.userData.update = t => {
    so.reset(); const e = env(o, t, .01, .01);
    for (let i = 0; i < n && e > 0; i++) {
      const p = P[i], fall = H / (speed * p.sk), cycL = fall + rest, u = (t + p.ph * cycL) / cycL, cyc = Math.floor(u), lt = (u - cyc) * cycL;
      const hx = hash(i * 3.3 + cyc * 7.1, seed), hz = hash(i * 5.7 + cyc * 3.9, seed + 1);
      const tl = Math.min(lt, fall), tb = t - lt;                                           // time falling so far, when this fall began
      const sx = sway * Math.sin((tb + tl) * p.w1 * .8 + p.a), sz = sway * .6 * Math.cos((tb + tl) * p.w2 * .7 + p.b);
      const xr = wrap(hx * W + wind.x * (tb + tl) + sx, W) / W, zr = wrap(hz * D + wind.z * (tb + tl) + sz, D) / D;
      const x = c.x + (xr - .5) * W, z = c.z + (zr - .5) * D;
      let y, sc = size * p.s * sstep(0, .25, lt) * edge(xr, .05) * edge(zr, .05);
      if (lt < fall) { y = gy + H * (1 - lt / fall) + .01; _q.setFromEuler(qAt(p, t)); }
      else { y = gy + .006 + i * 1e-5; _q.setFromEuler(qAt(p, tb + fall)); _q2.setFromEuler(_e.set(-Math.PI / 2, 0, p.yaw, 'XYZ')); _q.slerp(_q2, E.outCubic(seg(lt - fall, 0, .22))); sc *= 1 - sstep(rest - .35, rest, lt - fall); }
      so.add(x, y, z, _q, sc, sc, sc, pal[p.cc]);
    }
    so.done();
  };
  return g;
}
KINDS.leaves = (S, o) => fallers('leaves', S, o, { area: [6, 4, 6], count: 40, seed: 31, speed: .55, size: .16, sway: .35, pal: o.green ? 'green' : 'autumn', card: 'leaf', curl: .12, spin: .25, self: .2 });
KINDS.petals = (S, o) => fallers('petals', S, o, { area: [6, 4, 6], count: 50, seed: 37, speed: .4, size: .1, sway: .45, pal: 'petals', card: 'petal', curl: .1, spin: .3, self: .25 });

KINDS.confetti = (S, o) => {
  const burst = ['t', 'time', 'when'].some(k => typeof o[k] === 'number') || typeof o.at === 'number' || o.mode === 'burst';
  if (!burst) return fallers('confetti', S, o, { area: [6, 5, 4], count: 90, seed: 41, speed: .7, size: .035, sway: .25, pal: 'confetti', card: null, spin: 2.2, self: .45 });
  const c = posOf(o, [0, 1, 0]), T = timeOf(o, S), n = Math.round(o.count ?? 90), seed = o.seed ?? 43, R = rnd(seed), gy = o.ground ?? 0;
  const dir = V(o.dir ?? [0, 1, 0]).normalize(), [e1, e2] = basis(dir), spread = (o.spread ?? 32) * Math.PI / 180, v0 = o.speed ?? 5.5, k = 2.4, size = o.size ?? .035;
  const vt = new THREE.Vector3(o.wind?.[0] ?? .1, -(o.fall ?? .75), o.wind?.[2] ?? 0), pal = palette(o, 'confetti').map(h => new THREE.Color(h));
  const so = new Solids(new THREE.PlaneGeometry(1, 1.6), solidMat({ side: THREE.DoubleSide, rough: .55, self: .45 }), n, {});
  const pos = (p, tau, out) => { const ek = (1 - Math.exp(-k * tau)) / k; out.set(c.x + (p.v.x - vt.x) * ek + vt.x * tau, c.y + (p.v.y - vt.y) * ek + vt.y * tau, c.z + (p.v.z - vt.z) * ek + vt.z * tau);
    const fl = (1 - Math.exp(-tau * 1.2)) * .18; out.x += fl * Math.sin(tau * p.w + p.a); out.z += fl * Math.cos(tau * p.w * .8 + p.a); return out; };
  const P = [];
  for (let i = 0; i < n; i++) {
    const ct = 1 - R() * (1 - Math.cos(spread)), st = Math.sqrt(1 - ct * ct), ph = R() * TAU, sp = v0 * (.55 + R() * .6);
    const p = { v: dir.clone().multiplyScalar(ct).addScaledVector(e1, st * Math.cos(ph)).addScaledVector(e2, st * Math.sin(ph)).multiplyScalar(sp), w: 3 + R() * 4, a: R() * TAU, s1: 4 + R() * 8, s2: 2 + R() * 5, b: R() * TAU, col: pal[Math.floor(R() * pal.length)], sk: .8 + R() * .5, yaw: R() * TAU, land: 1e9 };
    let lo = .05, hi = 30; if (pos(p, hi, _v).y < gy) { for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; if (pos(p, mid, _v).y > gy) lo = mid; else hi = mid; } p.land = hi; }   // when it lands (once, at build)
    P.push(p);
  }
  const g = group('confetti', so);
  g.userData.update = t => {
    so.reset(); const tau = t - T;
    if (tau >= 0) for (let i = 0; i < n; i++) { const p = P[i], tl = Math.min(tau, p.land); pos(p, tl, _v);
      _q.setFromEuler(_e.set(tl * p.s1 + p.a, tl * p.s2 + p.b, Math.sin(tl * 3 + p.a) * .6, 'XYZ'));
      if (tau > p.land) { _v.y = gy + .004 + i * 2e-5; _q2.setFromEuler(_e.set(-Math.PI / 2, 0, p.yaw, 'XYZ')); _q.slerp(_q2, E.outCubic(seg(tau - p.land, 0, .15))); }
      const s = size * p.sk * sstep(0, .05, tau); so.add(_v.x, _v.y, _v.z, _q, s, s, s, p.col); }
    so.done();
  };
  sfx(S, o, 'pop', T, -4);
  return g;
};

KINDS.bubbles = (S, o) => {
  const c = posOf(o, [0, .8, 0]), [W, H, D] = box(o, [.8, 1.6, .8]), n = Math.round(o.count ?? 18), seed = o.seed ?? 51, R = rnd(seed);
  const rise = o.rise ?? .45, size = o.size ?? .045, wob = o.wobble ?? .03, col = rgb(o.color ?? '#e6f8ff', 1.05), op = o.opacity ?? .9;
  const sp = new Sprites(n, { shape: 'bubble', blend: 'normal', thick: .13, minPx: 2 });
  const P = []; for (let i = 0; i < n; i++) P.push([R(), .7 + R() * .6, .6 + R() * .8, R() * TAU, 3 + R() * 4]);
  const g = group('bubbles', sp);
  g.userData.update = t => {
    sp.reset(); const e = env(o, t);
    for (let i = 0; i < n && e > 0; i++) {
      const p = P[i], L = H / (rise * p[1]), u = t / L + p[0], cyc = Math.floor(u), f = u - cyc;
      const x = c.x + (hash(i * 3.1 + cyc * 5.3, seed) - .5) * W + wob * Math.sin(t * p[4] + p[3]), z = c.z + (hash(i * 4.7 + cyc * 2.9, seed + 1) - .5) * D + wob * Math.cos(t * p[4] * .8 + p[3]);
      const pop = f > .94 ? 1 + (f - .94) / .06 * .4 : 1, s = size * p[2] * pop * sstep(0, .05, f);
      sp.add(x, c.y - H / 2 + f * H, z, s, s * (1 - .06 * Math.sin(t * p[4] * 1.3 + p[3])), 0, col[0], col[1], col[2], op * e * (1 - sstep(.95, 1, f)));
    }
    sp.done(t);
  };
  return g;
};

// ====================================================================================================================
// SMOKE, STEAM, FIRE
// ====================================================================================================================
const SMOKE = { white: '#f3f0ea', grey: '#9d9a9b', gray: '#9d9a9b', black: '#353032', dark: '#353032', steam: '#ffffff' };
KINDS.smoke = (S, o) => {
  const c = posOf(o, [0, .2, 0]), rate = o.rate ?? 7, life = o.life ?? 2.8, seed = o.seed ?? 61;
  const base = rgb(SMOKE[o.color] ?? o.color ?? SMOKE.grey, 1), s0 = o.size ?? .3, grow = o.grow ?? 3.2, rise = o.rise ?? .6, spread = o.spread ?? .1;
  const wind = V(o.wind ?? [.18, 0, 0]), op = o.opacity ?? (o.color === 'black' || o.color === 'dark' ? .92 : .82);
  const T0 = o.t0, T1 = o.t1 ?? 1e9, N = Math.ceil(rate * life) + 2;
  const sp = new Sprites(N, { shape: 'puff', blend: 'normal', shade: o.shade ?? .74, soft: o.soft ?? .32 });
  const g = group('smoke', sp);
  g.userData.update = t => {
    sp.reset(); const t0 = T0 ?? 0, A = ambient(S, o);
    const kLo = Math.ceil((t - life - t0) * rate), kHi = Math.floor((Math.min(t, T1) - t0) * rate);
    for (let k = T0 == null ? kLo : Math.max(0, kLo); k <= kHi; k++) {
      const age = t - (t0 + k / rate); if (age < 0 || age > life) continue;
      const u = age / life, h1 = hash(k * 1.31, seed), h2 = hash(k * 2.17, seed + 1), h3 = hash(k * 3.07, seed + 2);
      const s = s0 * (1 + (grow - 1) * E.outCubic(u)) * (.8 + .4 * h3), turb = s0 * grow * .35 * u;
      const x = c.x + (h1 - .5) * spread * 2 + wind.x * age * (.6 + .4 * u) + noise1(k * .73 + age * .9, seed + 3) * turb;
      const y = c.y + rise * age * (1 - .3 * u) + wind.y * age;
      const z = c.z + (h2 - .5) * spread * 2 + wind.z * age * (.6 + .4 * u) + noise1(k * .51 + age * .8, seed + 4) * turb;
      const a = op * sstep(0, .08, u) * (1 - sstep(.45, 1, u)), lk = 1 + .1 * u;
      sp.add(x, y, z, s, s, (h2 - .5) + age * (h1 - .5) * .6, base[0] * lk * A[0], base[1] * lk * A[1], base[2] * lk * A[2], a, 0, 0, 0, h1);
    }
    sp.done(t);
  };
  return g;
};

KINDS.steam = (S, o) => {
  const c = posOf(o, [0, .8, 0]);
  if (o.style === 'puffs') return KINDS.smoke(S, { color: 'white', size: .05, grow: 3, rise: .38, life: 1.3, rate: 6, spread: .03, opacity: .62, wind: [.05, 0, 0], ...o, at: [c.x, c.y, c.z] });
  const n = o.count ?? 3, m = 24, H = o.height ?? .35, w0 = o.width ?? .03, seed = o.seed ?? 71, op = o.opacity ?? .3, wind = V(o.wind ?? [.05, 0, 0]);
  const base = cl(o.color ?? '#ffffff', 1.05), rb = new Ribbons(n, m, { blend: 'normal', color: base.clone() });
  const P = Array.from({ length: m }, () => [0, 0, 0]);
  const g = group('steam', rb);
  g.userData.update = t => {
    rb.clear(); const e = env(o, t), A = ambient(S, o); rb.u.uCol.value.setRGB(base.r * A[0], base.g * A[1], base.b * A[2]);
    if (e > 0) for (let r = 0; r < n; r++) {
      const ph = hash(r, seed) * TAU, ox = (hash(r * 3.1, seed) - .5) * .06, oz = (hash(r * 5.3, seed) - .5) * .05, hk = .8 + .4 * hash(r * 7.7, seed), amp0 = .05 * (1 + .5 * hash(r * 9.1, seed));
      for (let j = 0; j < m; j++) { const v = j / (m - 1), amp = amp0 * Math.pow(v, .8);
        P[j][0] = c.x + ox + amp * Math.sin(v * 7 - t * 2.4 + ph) + wind.x * v * H; P[j][1] = c.y + v * H * hk; P[j][2] = c.z + oz + amp * .7 * Math.cos(v * 5.5 - t * 2.1 + ph * 1.3) + wind.z * v * H; }
      rb.line(r, P, v => w0 * (1 + 2.2 * v), v => op * e * sstep(0, .15, v) * (1 - sstep(.45, 1, v)) * Math.max(0, .3 + .7 * Math.sin(v * 8 - t * 3.2 + ph)));
    }
    rb.done();
  };
  return g;
};

const FIRE = { fire: ['#ff4d1a', '#ff9a2a', '#ffe27a'], blue: ['#2a6bff', '#45b6ff', '#d8f6ff'], green: ['#2fbf3a', '#8cff4a', '#eaffb0'], purple: ['#8a2bff', '#d05cff', '#ffd6ff'] };
KINDS.fire = (S, o) => {
  const c = posOf(o, [0, 0, 0]), h = o.size ?? o.height ?? .5, n = Math.max(1, o.count ?? 6), seed = o.seed ?? 81, R = rnd(seed), I = o.intensity ?? 1;
  const pal = Array.isArray(o.palette) ? o.palette : FIRE[o.palette] ?? (o.color ? [o.color, FIRE.fire[1], FIRE.fire[2]] : FIRE.fire);
  const fl = new Sprites(n, { shape: 'flame', blend: 'solid', orient: 1, c1: cl(pal[0], 2.3), c2: cl(pal[1], 2.8), c3: cl(pal[2], 3.6) });
  const halo = new Sprites(2, { shape: 'dot', blend: 'add', minPx: 4 }), pool = new Sprites(1, { shape: 'dot', blend: 'add', orient: 2 });
  const warm = rgb(o.glowColor ?? pal[1], 1), wind = V(o.wind ?? [0, 0, 0]);
  // one big central tongue (round belly, pointed tip) + smaller tongues tucked around it, leaning out a little
  const T = []; for (let i = 0; i < n; i++) { const a = i / Math.max(1, n - 1) * TAU + R() * .6, r = i === 0 ? 0 : h * .11 * (.6 + .4 * R());
    T.push({ ox: Math.cos(a) * r, oz: Math.sin(a) * r, hh: i === 0 ? 1 : .4 + R() * .3, ww: i === 0 ? .8 : .44 + R() * .12, tilt: i === 0 ? 0 : .16 + R() * .1, dx: Math.cos(a), dz: Math.sin(a), sd: R() }); }
  const light = o.light === false ? null : lightOf(THREE.PointLight, o.lightColor ?? '#ff9a45', 0, o.distance ?? h * 18, 2);
  if (light) { light.position.set(c.x, c.y + h * .5, c.z); if (o.shadows) { light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.bias = -.002; } }
  const g = group('fire', fl, halo, pool, light);
  g.userData.light = light;
  g.userData.update = t => {
    fl.reset(); halo.reset(); pool.reset();
    const s = (o.t0 != null ? Math.max(0, E.outBack(seg(t, o.t0, o.t0 + .4))) : 1) * (o.t1 != null ? 1 - E.inQuad(seg(t, o.t1, o.t1 + .5)) : 1);
    const flick = .82 + .18 * (noise1(t * 14, seed) * .6 + noise1(t * 31, seed + 4) * .4);
    if (s > .005) {
      for (let i = 0; i < n; i++) { const p = T[i];
        const hh = p.hh * h * s * (1 + .1 * noise1(t * 6 + i * 3.3, seed) + .05 * noise1(t * 15 + i, seed + 1)), ww = p.ww * h * s * (1 + .07 * noise1(t * 8 + i * 1.7, seed + 2));
        _v.set(p.dx * p.tilt + wind.x * .3 + .08 * noise1(t * 2 + i, seed + 5), 1, p.dz * p.tilt + wind.z * .3 + .06 * noise1(t * 2.3 + i, seed + 6)).normalize();
        const bx = c.x + p.ox * s, bz = c.z + p.oz * s, by = c.y - .05 * hh;
        fl.add(bx + _v.x * hh / 2, by + _v.y * hh / 2, bz + _v.z * hh / 2, ww, hh, 0, I, I, I, 1, _v.x, _v.y, _v.z, p.sd + i * .37); }
      halo.add(c.x, c.y + h * .45 * s, c.z, h * 2.6 * s, h * 2.6 * s, 0, warm[0] * .18 * I * flick, warm[1] * .18 * I * flick, warm[2] * .18 * I * flick, 1);
      pool.add(c.x, c.y + .015, c.z, h * 4.5 * s, h * 4.5 * s, 0, warm[0] * .13 * I * flick, warm[1] * .13 * I * flick, warm[2] * .13 * I * flick, 1);
    }
    if (light) light.intensity = 5 * I * (o.lightK ?? 1) * (h / .5) * (h / .5) * s * flick;
    fl.done(t); halo.done(t); pool.done(t);
  };
  return g;
};

KINDS.embers = (S, o) => {
  const c = posOf(o, [0, .3, 0]), n = Math.round(o.count ?? 24), seed = o.seed ?? 91, rad = typeof o.area === 'number' ? o.area : o.radius ?? .25;
  const rise = o.rise ?? 1, lifeB = o.life ?? 1.6, size = o.size ?? .018, wind = V(o.wind ?? [.15, 0, 0]);
  const hot = rgb(o.color ?? '#ffe9a0', 3.2), mid = rgb('#ff8a2a', 2.4), cool = rgb('#ff3a10', 1.1);
  const sp = new Sprites(n, { shape: 'dot', blend: 'add', minPx: 1.8 });
  const g = group('embers', sp);
  g.userData.update = t => {
    sp.reset();
    for (let i = 0; i < n; i++) {
      const L = lifeB * (.6 + .8 * hash(i, seed)), ph = hash(i * 1.7, seed + 1), u = t / L + ph, cyc = Math.floor(u), f = u - cyc, b = t - f * L;
      if ((o.t0 != null && b < o.t0) || (o.t1 != null && b > o.t1)) continue;
      const h1 = hash(i * 3.1 + cyc * 7.7, seed + 2), h2 = hash(i * 5.3 + cyc * 3.3, seed + 3), r = rad * Math.sqrt(h1), an = h2 * TAU, age = f * L;
      const x = c.x + Math.cos(an) * r + wind.x * age + .12 * Math.sin(age * 4 + i) * f, y = c.y + rise * age * (1 - .25 * f), z = c.z + Math.sin(an) * r + wind.z * age + .1 * Math.cos(age * 3.3 + i) * f;
      const col = f < .5 ? lerp3(hot, mid, f / .5) : lerp3(mid, cool, (f - .5) / .5), fk = .6 + .4 * (noise1(t * 12 + i * 3.7, seed) * .5 + .5);
      const s = size * (1 - .5 * f) * (.7 + .6 * hash(i * 9.1 + cyc, seed + 4));
      sp.add(x, y, z, s, s, 0, col[0], col[1], col[2], sstep(0, .08, f) * (1 - sstep(.6, 1, f)) * fk);
    }
    sp.done(t);
  };
  return g;
};

KINDS.campfire = (S, o) => {
  const c = posOf(o, [0, 0, 0]), h = o.size ?? .55, k = h / .55, seed = o.seed ?? 101, R = rnd(seed), g = group('campfire');
  if (o.logs !== false) {
    const bark = toonMat(o.logColor ?? '#6e4325'), cut = toonMat('#d9a46a'), geo = new THREE.CylinderGeometry(.05 * k, .056 * k, .6 * k, 14);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + .3, m = new THREE.Mesh(geo, [bark, cut, cut]);
      m.position.set(c.x + Math.cos(a) * .17 * k, c.y + .07 * k, c.z + Math.sin(a) * .17 * k); m.rotation.set(0, -a, 0); m.rotateZ(Math.PI / 2 - .32); m.castShadow = true; addOutline(m, C.ink, .006 * k, 1.2); g.add(m); }
    const coal = new THREE.MeshBasicMaterial({ color: cl('#ff5a1a', 1.6) }), ash = toonMat('#3a2a24'), cg = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 9; i++) { const a = R() * TAU, r = R() * .13 * k, m = new THREE.Mesh(cg, i % 3 ? coal : ash); m.scale.set(.045 * k, .025 * k, .04 * k); m.position.set(c.x + Math.cos(a) * r, c.y + .015 * k, c.z + Math.sin(a) * r); g.add(m); }
  }
  if (o.stones !== false) { const sm = toonMat(o.stoneColor ?? '#8d8a86'), sg = new THREE.SphereGeometry(1, 16, 12);
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + R() * .2, m = new THREE.Mesh(sg, sm); m.scale.set((.08 + R() * .03) * k, (.05 + R() * .02) * k, (.07 + R() * .02) * k); m.position.set(c.x + Math.cos(a) * .43 * k, c.y + .03 * k, c.z + Math.sin(a) * .43 * k); m.rotation.y = -a; m.castShadow = true; addOutline(m, C.ink, .005 * k, 1.2); g.add(m); } }
  g.add(KINDS.fire(S, { ...o, at: [c.x, c.y + .06 * k, c.z], size: h, seed }));
  if (o.embers !== false) g.add(KINDS.embers(S, { at: [c.x, c.y + h * .45, c.z], count: typeof o.embers === 'number' ? o.embers : 18, radius: .18 * k, rise: 1.1, t0: o.t0, t1: o.t1, wind: o.wind, seed: seed + 1 }));
  if (o.smoke !== false) g.add(KINDS.smoke(S, { at: [c.x, c.y + h * 1.1, c.z], color: o.smokeColor ?? 'grey', size: .14 * k, grow: 4, rise: .7, rate: 4, life: 2.6, opacity: .4, wind: o.wind ?? [.12, 0, 0], t0: o.t0, t1: o.t1 != null ? o.t1 + .3 : undefined, seed: seed + 2 }));
  return g;
};

// ====================================================================================================================
// BURSTS: sparks, explosion, splash, sparkle
// ====================================================================================================================
KINDS.sparks = (S, o) => {
  const c = posOf(o, [0, 1, 0]), times = timesOf(o, S), n = Math.round(o.count ?? 26), seed = o.seed ?? 111;
  const dir = V(o.dir ?? [0, 1, 0]).normalize(), [e1, e2] = basis(dir), cs = Math.cos((o.spread ?? 75) * Math.PI / 180), sp0 = o.speed ?? 4, grav = 9.8 * (o.gravity ?? 1), life = o.life ?? .6, gy = o.ground ?? -1e9, wid = .012 * (o.size ?? 1), dragK = 1.5;
  const hot = rgb(o.color ?? '#fff3c0', 3.4), mid = rgb('#ffb347', 2.6), end = rgb('#ff5a1a', 1.4);
  const st = new Sprites(n * 3, { shape: 'streak', blend: 'add', orient: 1 }), fl = new Sprites(3, { shape: 'star', blend: 'add', minPx: 3 });
  const light = o.light === false ? null : lightOf(THREE.PointLight, '#ffb060', 0, 6, 2); if (light) light.position.copy(c);
  const g = group('sparks', st, fl, light);
  g.userData.update = t => {
    st.reset(); fl.reset(); let li = 0;
    for (let j = 0; j < times.length; j++) { const tau = t - times[j]; if (tau < 0 || tau > life * 1.4) continue;
      li = Math.max(li, Math.exp(-tau / .08));
      if (tau < 4 * F) { const k = 1 - tau / (4 * F), s = .22 * (o.size ?? 1) * (.6 + .4 * k); fl.add(c.x, c.y, c.z, s, s, j, hot[0] * k, hot[1] * k, hot[2] * k, 1); }
      for (let i = 0; i < n; i++) {
        const hs = i * 1.3 + j * 17.1, L = life * (.5 + .7 * hash(hs, seed + 4)); if (tau > L) continue;
        const ct = 1 - hash(hs, seed) * (1 - cs), stt = Math.sqrt(Math.max(0, 1 - ct * ct)), ph = hash(hs, seed + 1) * TAU, v0 = sp0 * (.5 + .8 * hash(hs, seed + 2));
        _v2.copy(dir).multiplyScalar(ct).addScaledVector(e1, stt * Math.cos(ph)).addScaledVector(e2, stt * Math.sin(ph));
        const ek = (1 - Math.exp(-dragK * tau)) / dragK, de = Math.exp(-dragK * tau);
        const x = c.x + _v2.x * v0 * ek, y = c.y + _v2.y * v0 * ek - .5 * grav * tau * tau, z = c.z + _v2.z * v0 * ek; if (y < gy) continue;
        _v.set(_v2.x * v0 * de, _v2.y * v0 * de - grav * tau, _v2.z * v0 * de); const sv = _v.length(); if (sv < 1e-4) continue; _v.divideScalar(sv);
        const u = tau / L, len = clamp(sv * F * 2.2, .02, .35) * (o.size ?? 1), col = u < .4 ? lerp3(hot, mid, u / .4) : lerp3(mid, end, (u - .4) / .6);
        st.add(x - _v.x * len / 2, y - _v.y * len / 2, z - _v.z * len / 2, wid, len, 0, col[0], col[1], col[2], 1 - sstep(.6, 1, u), _v.x, _v.y, _v.z);
      }
    }
    if (light) light.intensity = 3 * (o.intensity ?? 1) * li;
    st.done(t); fl.done(t);
  };
  return g;
};

KINDS.explosion = (S, o) => {
  const c = posOf(o, [0, .3, 0]), T = timeOf(o, S), k = o.size ?? 1, seed = o.seed ?? 121, R = rnd(seed), gy = o.ground ?? 0, I = o.intensity ?? 1;
  const nb = o.puffs ?? 16, ball = new Sprites(nb + 6, { shape: 'puff', blend: 'normal', shade: .78, soft: .26, order: 2 });
  const nr = o.ring === false ? 0 : 14, ring = new Sprites(Math.max(1, nr), { shape: 'puff', blend: 'normal', shade: .75, soft: .3, order: 1 });
  const flash = new Sprites(2, { shape: 'star', blend: 'add', minPx: 4, order: 3 }), glow = new Sprites(1, { shape: 'dot', blend: 'add', order: 3 });
  const B = []; for (let i = 0; i < nb + 6; i++) { const u = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - u * u); B.push({ d: new THREE.Vector3(Math.cos(a) * s, Math.abs(u) * .9 + .15, Math.sin(a) * s).normalize(), r: .6 + R() * .5, s: .8 + R() * .45, h: R(), core: i >= nb }); }
  const cols = [[0, rgb('#fff6d0', 4)], [.1, rgb('#ffd060', 3.2)], [.3, rgb('#ff7a1a', 2.6)], [.6, rgb('#c2361a', 1)], [1, rgb('#3a2c28', .55)], [1.8, rgb('#5a5250', .7)]];
  const nd = o.debris ?? 14, deb = nd ? new Solids(new THREE.IcosahedronGeometry(1, 1), solidMat({ rough: .85 }), nd, { outline: .006 * k, shadow: true }) : null;
  const dcols = ['#4a3f3a', '#6b5a4c', '#8a7360', '#3b3532'].map(h => new THREE.Color(h));
  const D = []; for (let i = 0; i < nd; i++) { const a = R() * TAU, out = (1.5 + R() * 2.5) * Math.sqrt(k), vy = (3 + R() * 4.5) * Math.sqrt(k); const y0 = c.y + .1, g9 = 9.8;
    D.push({ vx: Math.cos(a) * out, vz: Math.sin(a) * out, vy, land: (vy + Math.sqrt(vy * vy + 2 * g9 * Math.max(0, y0 - gy))) / g9, s: (.05 + R() * .06) * k, sx: .8 + R() * .5, sy: .6 + R() * .5, wx: (R() - .5) * 14, wy: (R() - .5) * 12, col: dcols[Math.floor(R() * dcols.length)], y0 }); }
  const light = lightOf(THREE.PointLight, '#ffb060', 0, 14 * k, 2); light.position.set(c.x, c.y + .6 * k, c.z);
  const kids = [ball, ring, flash, glow, deb, light];
  if (o.sparks !== false) kids.push(KINDS.sparks(S, { at: [c.x, c.y + .2 * k, c.z], t: T, count: 30, speed: 7 * Math.sqrt(k), spread: 85, life: .8, size: k, light: false, seed: seed + 3, ground: gy, sfx: false }));
  const g = group('explosion', ...kids);
  g.userData.update = t => {
    ball.reset(); ring.reset(); flash.reset(); glow.reset(); deb?.reset();
    const tau = t - T;
    if (tau >= 0) {
      const rr = k * (.25 + .9 * E.outExpo(seg(tau, 0, .45))), rise = Math.max(0, tau - .3) * .65 * k, fade = 1 - sstep(1.7, 3, tau);
      for (const p of B) { if (p.core && tau > .45) continue;
        const u = tau * (p.core ? 2 : 1) + p.h * .08, col = ramp(cols, u), s = k * p.s * (p.core ? .55 : 1) * (.55 + .9 * E.outCubic(seg(tau, 0, .6)) + .35 * seg(tau, .6, 3));
        const r = rr * p.r * (p.core ? .35 : 1);
        ball.add(c.x + p.d.x * r, c.y + p.d.y * r * .8 + rise * (.6 + .4 * p.r), c.z + p.d.z * r, s, s, p.h * 6 + tau * .3, col[0], col[1], col[2], fade * (p.core ? 1 - seg(tau, .25, .45) : 1), 0, 0, 0, p.h); }
      if (nr) { const rk = E.outCubic(seg(tau, 0, 1.2)), rc = rgb('#8a7f78', .9);
        for (let i = 0; i < nr; i++) { const a = i / nr * TAU + hash(i, seed) * .4, r = k * (.3 + 2.3 * rk);
          ring.add(c.x + Math.cos(a) * r, gy + .18 * k + .1 * k * rk, c.z + Math.sin(a) * r, k * (.45 + .55 * rk), k * (.4 + .45 * rk), i, rc[0], rc[1], rc[2], .85 * sstep(0, .06, tau) * (1 - sstep(.8, 2.4, tau)), 0, 0, 0, hash(i, seed + 9)); } }
      if (tau < 4 * F) { const q = 1 - tau / (4 * F); flash.add(c.x, c.y + .4 * k, c.z, 3.2 * k, 3.2 * k, .3, 4 * q, 3.6 * q, 2.6 * q, 1); }
      const gl = Math.exp(-tau / .3); glow.add(c.x, c.y + .5 * k, c.z, 5 * k, 5 * k, 0, 1.2 * gl, .65 * gl, .25 * gl, 1);
      light.intensity = I * 80 * k * k * (Math.exp(-tau / .12) + .25 * Math.exp(-tau / .6));
      if (deb) for (const p of D) { const tl = Math.min(tau, p.land), y = Math.max(gy + p.s * .5, p.y0 + p.vy * tl - 4.9 * tl * tl);
        _q.setFromEuler(_e.set(tl * p.wx, tl * p.wy, 0)); deb.add(c.x + p.vx * tl, y, c.z + p.vz * tl, _q, p.s * p.sx, p.s * p.sy, p.s, p.col); }
    } else light.intensity = 0;
    ball.done(t); ring.done(t); flash.done(t); glow.done(t); deb?.done();
  };
  sfx(S, o, 'impact', T, 0);
  return g;
};

KINDS.splash = (S, o) => {
  const c = posOf(o, [0, 0, 0]), T = timeOf(o, S), k = o.size ?? 1, seed = o.seed ?? 131, R = rnd(seed), hexc = o.color ?? '#8fd8ff';
  const lift = o.lift ?? .02;   // rings + foam sit this far above the surface point (above small waves)
  const wcol = new THREE.Color(hexc), light = rgb(hexc, 1.15), white = rgb('#ffffff', 1.05);
  const jetM = new THREE.MeshStandardMaterial({ color: wcol.clone().lerp(new THREE.Color('#ffffff'), .25), roughness: .3, emissive: wcol, emissiveIntensity: .25 });
  const jet = new THREE.Mesh(lathe([[.075, 0], [.06, .25], [.04, .55], [.045, .72], [.05, .82], [.035, .95], [0, 1]], 24, 4), jetM); jet.position.copy(c); addOutline(jet, C.ink, .005 * k, 1.2); jet.visible = false;
  const nd = o.drops ?? 20, drops = new Solids(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .3, emissive: wcol, emissiveIntensity: .2 }), nd, { outline: .004 * k });
  const dc = wcol.clone().lerp(new THREE.Color('#ffffff'), .35);
  const P = []; for (let i = 0; i < nd; i++) { const a = R() * TAU, out = (.5 + R() * 1.6) * Math.sqrt(k); P.push({ vx: Math.cos(a) * out, vz: Math.sin(a) * out, vy: (2 + R() * 2.6) * Math.sqrt(k), s: (.025 + R() * .025) * k, d: R() * 2 * F }); }
  const rings = new Sprites(4, { shape: 'ripple', blend: 'normal', orient: 2, thick: .12 }), foam = new Sprites(10, { shape: 'disc', blend: 'normal', orient: 2, shade: .9 });
  const FO = []; for (let i = 0; i < 10; i++) FO.push({ a: R() * TAU, r: (.15 + R() * .35) * k, s: (.04 + R() * .05) * k, e: .5 + R() * .4, v: (.05 + R() * .08) * k });
  const g = group('splash', jet, drops, rings, foam);
  g.userData.update = t => {
    drops.reset(); rings.reset(); foam.reset(); const tau = t - T;
    jet.visible = tau >= 0 && tau < 15 * F;
    if (jet.visible) { const up = tau < 4 * F ? E.outCubic(tau / (4 * F)) : tau < 7 * F ? 1 : 1 - E.inQuad(seg(tau, 7 * F, 15 * F)); jet.scale.set(k * (.8 + .4 * (1 - up)), Math.max(1e-3, .75 * k * up), k * (.8 + .4 * (1 - up))); }
    if (tau >= 0) {
      for (const p of P) { const tl = tau - p.d; if (tl < 0) continue; const y = c.y + p.vy * tl - 4.9 * tl * tl; if (y < c.y - .02 || tl > 1.2) continue;
        const s = p.s * (1 - .55 * seg(tl, 0, .8)); drops.add(c.x + p.vx * tl, y, c.z + p.vz * tl, _q.identity(), s, s * (1 + .4 * Math.min(1, Math.abs(p.vy - 9.8 * tl) / 6)), s, dc); }
      for (let i = 0; i < 3; i++) { const tl = tau - i * .13; if (tl < 0) continue; const u = seg(tl, 0, 1.5), s = k * (.3 + 1.7 * E.outCubic(u));
        rings.add(c.x, c.y + lift + i * .001, c.z, s, s * .92, 0, light[0], light[1], light[2], .8 * (1 - sstep(.15, 1, u))); }
      for (const f of FO) { const u = seg(tau, .05, 2.2), r = f.r + f.v * tau; foam.add(c.x + Math.cos(f.a) * r, c.y + lift + .004, c.z + Math.sin(f.a) * r, f.s * 1.4, f.s * f.e, f.a, white[0], white[1], white[2], .9 * sstep(0, .1, u) * (1 - sstep(.5, 1, u))); }
    }
    drops.done(); rings.done(t); foam.done(t);
  };
  sfx(S, o, 'splash', T, -2);
  return g;
};

KINDS.sparkle = (S, o) => {
  const c = posOf(o, [0, 1.5, 0]), times = timesOf(o, S), n = o.count ?? 1, size = o.size ?? .16, col = rgb(o.color ?? '#ffffff', o.intensity ?? 2.4), spread = o.spread ?? size * 1.4, seed = o.seed ?? 141;
  const sp = new Sprites(Math.min(64, times.length * n), { shape: 'star', blend: 'add', minPx: 3, order: 4 });
  const g = group('sparkle', sp);
  g.userData.update = t => {
    sp.reset();
    for (let j = 0; j < times.length; j++) for (let i = 0; i < n; i++) {
      const tau = t - (times[j] + i * 2 * F); if (tau < 0 || tau > 10 * F) continue;
      const hs = j * 13.7 + i * 3.1, pop = tau < 2 * F ? E.outBack(tau / (2 * F)) : 1 - .25 * seg(tau, 6 * F, 10 * F), s = size * (i ? .55 + .35 * hash(hs, seed) : 1) * pop;
      const ox = i ? (hash(hs, seed + 1) - .5) * 2 * spread : 0, oy = i ? (hash(hs, seed + 2) - .5) * 2 * spread : 0, oz = i ? (hash(hs, seed + 3) - .5) * spread : 0;
      sp.add(c.x + ox, c.y + oy, c.z + oz, s, s, (hash(hs, seed + 4) - .5) * .5 + tau * 1.5, col[0], col[1], col[2], 1 - sstep(6 * F, 10 * F, tau));
    }
    sp.done(t);
  };
  if (o.sfx === true) for (const T of times) S.sfx?.('ding', T, { gain: -10 });
  return g;
};

KINDS.stars = (S, o) => {
  const c = posOf(o, [0, 0, 0]), n = Math.round(o.count ?? 420), r = o.radius ?? 120, seed = o.seed ?? 151, R = rnd(seed), nb = Math.round(n * .08);
  const dots = new Sprites(n, { shape: 'dot', blend: 'add', minPx: 2.2, fog: false, order: -5 }), big = new Sprites(nb, { shape: 'star', blend: 'add', minPx: 5, fog: false, order: -5 });
  const tints = [rgb('#ffffff'), rgb('#fff1c8'), rgb('#d6e6ff')], area = o.area ? box(o, [10, 10, 10]) : null;
  const P = []; for (let i = 0; i < n + nb; i++) { let x, y, z;
    if (area) { x = c.x + (R() - .5) * area[0]; y = c.y + (R() - .5) * area[1]; z = c.z + (R() - .5) * area[2]; }
    else { const el = Math.asin(.04 + R() * .94), az = R() * TAU; x = c.x + Math.cos(az) * Math.cos(el) * r; y = c.y + Math.sin(el) * r; z = c.z + Math.sin(az) * Math.cos(el) * r; }
    P.push({ x, y, z, s: (i < n ? .0017 : .0065) * (area ? 12 : r) * (.6 + R() * .8), tw: 1 + R() * 2.5, ph: R() * 50, col: tints[Math.floor(R() * 3)], k: i < n ? 1.3 + R() * .9 : 2.8 }); }
  const g = group('stars', dots, big);
  g.userData.update = t => {
    dots.reset(); big.reset(); const e = env(o, t) * (o.intensity ?? 1);
    for (let i = 0; i < P.length; i++) { const p = P[i], a = e * (.5 + .5 * (noise1(t * p.tw + p.ph, seed) * .5 + .5) ** 1.5), sp = i < n ? dots : big;
      sp.add(p.x, p.y, p.z, p.s, p.s, i < n ? 0 : (hash(i, seed) - .5) * .4, p.col[0] * p.k, p.col[1] * p.k, p.col[2] * p.k, a); }
    dots.done(t); big.done(t);
  };
  return g;
};

// ====================================================================================================================
// LIGHT: lightCone, godrays, glow
// ====================================================================================================================
const BEAM_VS = `
#include <common>
#include <fog_pars_vertex>
uniform float uL;
varying vec3 vN, vV; varying float vH;
void main(){
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
  vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz);
#if BEAM == 1
  vH = clamp(position.z, 0., 1.);
#else
  vH = clamp(-position.y / uL, 0., 1.);
#endif
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const BEAM_FS = `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uCol; uniform float uI;
varying vec3 vN, vV; varying float vH;
void main(){
  float f = clamp(abs(dot(normalize(vN), normalize(vV))), 0., 1.), h = clamp(vH, 0., 1.);   // interpolation can overshoot 1: pow(<0) = NaN
  float a = pow(f, 1.6) * pow(1. - h, 1.1) * smoothstep(0., .07, h) * (1. - smoothstep(.82, 1., h));
  vec3 c = uCol * a * uI;
  ${FOG_F}
  gl_FragColor = vec4(c, 1.);
}`;
function beamMat(col, I, L, kind = 0) {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCol: { value: col }, uI: { value: I }, uL: { value: L } }]);
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, defines: { BEAM: kind, ADD: 1 }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  return m;
}
KINDS.lightCone = (S, o) => {
  const b = posOf(o, [0, 2.3, 0]), gy = o.ground ?? 0, L = o.length ?? Math.max(.5, b.y - gy), Rb = o.radius ?? L * .42, I = o.intensity ?? 1, seed = o.seed ?? 161;
  const colHex = o.color ?? '#ffd28a', cord = o.cord ?? .7, swing = (o.swing ?? 0) * Math.PI / 180, period = o.period ?? 2.7, ph = o.phase ?? 0, axis = o.swingAxis === 'x' ? 'x' : 'z';
  const g = group('lightCone'), pivot = new THREE.Group(); pivot.position.set(b.x, b.y + cord, b.z); g.add(pivot);
  const arm = new THREE.Group(); arm.position.y = -cord; pivot.add(arm);
  if (o.bulb !== false) {
    const dark = toonMat('#3a3330', { rough: .5 });
    const cordM = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, cord + (o.ceiling ?? 0), 6), dark); cordM.position.y = -(cord - (o.ceiling ?? 0)) / 2; pivot.add(cordM);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(.028, .032, .07, 16), dark); sock.position.y = .05; arm.add(sock); addOutline(sock, C.ink, .003, 1.2);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.058, 24, 16), new THREE.MeshBasicMaterial({ color: cl(colHex, 5 * I) })); bulb.scale.y = 1.15; arm.add(bulb);
    if (o.shade) { const sh = new THREE.Mesh(new THREE.CylinderGeometry(.07, .24, .2, 32, 1, true), toonMat(typeof o.shade === 'string' ? o.shade : '#3f7a5a', { rough: .5 })); sh.material = sh.material.clone(); sh.material.side = THREE.DoubleSide; sh.position.y = .02; arm.add(sh); addOutline(sh, C.ink, .004, 1.2);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(.066, .232, .19, 32, 1, true), new THREE.MeshBasicMaterial({ color: cl(colHex, 1.6), side: THREE.BackSide })); inner.position.y = .02; arm.add(inner); }
  }
  const cg = new THREE.CylinderGeometry(.05, Rb, L, 48, 6, true); cg.translate(0, -L / 2, 0);
  const cone = new THREE.Mesh(cg, beamMat(cl(colHex, 1), .3 * I * (o.cone ?? 1), L)); cone.renderOrder = 3; arm.add(cone);
  const pool = new Sprites(1, { shape: 'dot', blend: 'add', orient: 2 }); g.add(pool.mesh);
  const spot = o.light === false ? null : lightOf(THREE.SpotLight, colHex, 0, L * 3, Math.min(1.3, Math.atan(Rb / L) * 1.3), .55, 2);
  if (spot) { spot.position.set(0, -.05, 0); spot.target.position.set(0, -L, 0); arm.add(spot, spot.target);
    if (o.shadows !== false) { spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.0005; spot.shadow.normalBias = .02; spot.shadow.camera.near = .1; spot.shadow.camera.far = L * 3; } }
  const pc = rgb(colHex, .32 * I), Bw = new THREE.Vector3(), Aw = new THREE.Vector3();
  const pose = t => { const th = swing * Math.sin(TAU * t / period + ph); pivot.rotation.set(axis === 'x' ? th : 0, 0, axis === 'z' ? th : 0); pivot.updateMatrixWorld(true);
    arm.getWorldPosition(Bw); Aw.set(0, -1, 0).applyQuaternion(arm.getWorldQuaternion(_q2)); };
  const inCone = (x, y, z) => { _v2.set(x - Bw.x, y - Bw.y, z - Bw.z); const al = _v2.dot(Aw); if (al <= 0 || al > L) return 0; const rad = _v2.addScaledVector(Aw, -al).length(), rr = .05 + (Rb - .05) * al / L; return (1 - sstep(.55, 1.05, rad / rr)) * (1 - .5 * al / L); };
  if (o.dust) g.add(KINDS.dust(S, { at: [b.x, gy + L * .5, b.z], area: [Rb * 2.4 + Math.abs(Math.sin(swing)) * cord * 2, L * .95, Rb * 2.4], count: typeof o.dust === 'number' ? o.dust : 70, intensity: 1.4 * I, seed: seed + 1, lit: (x, y, z) => inCone(x, y, z) }));
  g.userData.spot = spot;
  g.userData.update = t => {
    pose(t); pool.reset();
    const s = (gy - Bw.y) / Math.min(-.05, Aw.y);
    const st = 1 / Math.max(.4, -Aw.y);
    pool.add(Bw.x + Aw.x * s, gy + .012, Bw.z + Aw.z * s, Rb * 2.6 * (axis === 'z' ? st : 1), Rb * 2.6 * (axis === 'x' ? st : 1), 0, pc[0], pc[1], pc[2], 1);
    if (spot) spot.intensity = I * (o.lightK ?? 1) * 14 * (L / 2) * (L / 2);
    pool.done(t);
  };
  return g;
};

KINDS.godrays = (S, o) => {
  const c = posOf(o, [0, 2, -2]), [ww, wh] = size2(o, [1.2, 1.4]), dir = V(o.dir ?? [.35, -.5, 1]).normalize(), L = o.length ?? 5, n = Math.max(1, o.count ?? 4), I = o.intensity ?? 1, seed = o.seed ?? 171;
  const nH = new THREE.Vector3(dir.x, 0, dir.z); if (nH.lengthSq() < 1e-6) nH.set(0, 0, 1); nH.normalize();
  const right = o.right ? V(o.right).normalize() : new THREE.Vector3(nH.z, 0, -nH.x), up = o.up ? V(o.up).normalize() : new THREE.Vector3(0, 1, 0);
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0, .5);
  const g = group('godrays'), mats = [], inv = [], gy = o.ground ?? 0, PT = [];
  const patches = new Sprites(n, { shape: 'rect', blend: 'add', orient: 2, order: 2 }), pcol = rgb(o.color ?? '#ffe7b8', .5 * I); g.add(patches.mesh);
  for (let i = 0; i < n; i++) {
    const w = ww / n * (o.fill ?? .72) * (.85 + .3 * hash(i, seed)), h = wh * (.92 + .08 * hash(i * 2.1, seed)), off = -ww / 2 + (i + .5) * ww / n;
    const m = new THREE.Mesh(geo, beamMat(cl(o.color ?? '#ffe7b8', 1), .26 * I, 1, 1)); m.matrixAutoUpdate = false; m.renderOrder = 3;
    const o0 = c.clone().addScaledVector(right, off);
    m.matrix.makeBasis(right.clone().multiplyScalar(w), up.clone().multiplyScalar(h), dir.clone().multiplyScalar(L)).setPosition(o0);
    g.add(m); mats.push(m.material); inv.push(m.matrix.clone().invert());
    // where the shaft lands on the floor: a soft bright patch (the window's slice of sunlight)
    const s = dir.y < -.05 ? (gy - o0.y) / (dir.y * L) : -1;
    if (o.patches !== false && s > 0 && s < 1) PT.push({ p: o0.clone().addScaledVector(dir, s * L), w: w * 1.1, l: h * Math.hypot(dir.x, dir.z) / -dir.y * 1.1, k: 1 - s * .55 });
  }
  const rot = Math.atan2(right.z, right.x);
  if (o.dust) g.add(KINDS.dust(S, { at: c.clone().addScaledVector(dir, L * .45).toArray(), area: [Math.max(ww, L * .9), wh + L * Math.abs(dir.y) * .9, Math.max(ww, L * .9)], count: typeof o.dust === 'number' ? o.dust : 90, intensity: 1.4 * I, seed: seed + 1,
    lit: (x, y, z) => { let best = 0; for (const M of inv) { _v2.set(x, y, z).applyMatrix4(M); if (_v2.z > 0 && _v2.z < 1) best = Math.max(best, edge(_v2.x + .5, .2) * edge(_v2.y + .5, .15) * (1 - _v2.z * .6)); } return best; } }));
  g.userData.update = t => { const e = env(o, t); patches.reset();
    for (let i = 0; i < n; i++) mats[i].uniforms.uI.value = .26 * I * (.78 + .22 * (noise1(t * .6 + i * 3.1, seed) * .5 + .5)) * e;
    for (const q of PT) patches.add(q.p.x, gy + .01, q.p.z, q.w, q.l, rot, pcol[0] * q.k * e, pcol[1] * q.k * e, pcol[2] * q.k * e, 1);
    patches.done(t); };
  return g;
};

KINDS.glow = (S, o) => {
  const target = rootOf(o.on ?? o.of), c = posOf(target ? {} : o, [0, 2, 0]), size = o.size ?? .5, col = rgb(o.color ?? '#ffd28a', 1), I = o.intensity ?? 1, seed = o.seed ?? 181, off = V(o.offset ?? [0, 0, 0]);
  const sp = new Sprites(3, { shape: 'dot', blend: 'add', minPx: 2, fog: o.fog !== false, order: 4 });
  sp.mesh.onBeforeRender = () => { if (target) { target.localToWorld(_v.copy(off)); sp.mesh.matrixWorld.makeTranslation(_v.x, _v.y, _v.z); } else sp.mesh.matrixWorld.makeTranslation(c.x, c.y, c.z); };
  const g = group('glow', sp);
  g.userData.update = t => {
    sp.reset(); const e = env(o, t) * I * (o.flicker ? 1 - o.flicker * .5 * (noise1(t * 14, seed) * .5 + .5) : 1) * (o.pulse ? 1 + o.pulse * Math.sin(t * TAU / (o.period ?? 1.2)) : 1);
    if (e > 0) { sp.add(0, 0, 0, size, size, 0, col[0] * .55 * e, col[1] * .55 * e, col[2] * .55 * e, 1); sp.add(0, 0, 0, size * .32, size * .32, 0, col[0] * 1.6 * e, col[1] * 1.6 * e, col[2] * 1.6 * e, 1);
      if (o.streak) sp.add(0, 0, 0, size * 2.6, size * .16, 0, col[0] * .35 * e, col[1] * .35 * e, col[2] * .35 * e, 1); }
    sp.done(t);
  };
  return g;
};

// ====================================================================================================================
// WATER: water, underwater
// ====================================================================================================================
const WAVE = `
uniform float uTime, uAmp, uScale;
float waveH(vec2 p){ p *= uScale; float t = uTime;
  return uAmp * (.55 * sin(dot(p, vec2(.8, .6)) * 1.1 + t * 1.3) + .3 * sin(dot(p, vec2(-.4, .9)) * 1.9 + t * 1.9 + 1.3)
    + .2 * sin(dot(p, vec2(.95, -.3)) * 3.1 + t * 2.6 + 2.1) + .1 * sin(dot(p, vec2(-.7, -.7)) * 5.3 + t * 3.4 + .7)); }
vec3 waveN(vec2 p){ float e = .05; float hx = waveH(p + vec2(e, 0.)) - waveH(p - vec2(e, 0.)), hz = waveH(p + vec2(0., e)) - waveH(p - vec2(0., e)); return normalize(vec3(-hx, 2. * e, -hz)); }
`;
KINDS.water = (S, o) => {
  const c = posOf(o, [0, 0, 0]), [w, d] = size2(o, [40, 40]), amp = o.waves ?? .06, mx = Math.max(w, d), sg = Math.min(220, Math.max(16, Math.round(mx * 4)));
  const geo = new THREE.PlaneGeometry(w, d, Math.max(4, Math.round(sg * w / mx)), Math.max(4, Math.round(sg * d / mx))); geo.rotateX(-Math.PI / 2);
  const U = { uTime: { value: 0 }, uAmp: { value: amp }, uScale: { value: o.scale ?? 1 }, uDeep: { value: cl(o.color ?? '#1f8ccf') }, uShallow: { value: cl(o.shallow ?? '#5cc9ec') }, uFoam: { value: cl(o.foamColor ?? '#ffffff') }, uFoamAmt: { value: o.foam ?? 1 } };
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: o.rough ?? .3, metalness: 0 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + WAVE + '\nvarying vec3 vWP; varying float vWave;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = waveN(position.xz);')
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position); vWave = waveH(position.xz); transformed.y += vWave; vWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime, uAmp, uScale, uFoamAmt; uniform vec3 uDeep, uShallow, uFoam; varying vec3 vWP; varying float vWave;
${NOISE}
float foamAt(vec2 p){ p *= uScale;
  float n = fbm(p * .55 + vec2(uTime * .06, uTime * .03)), n2 = fbm(p * .93 - vec2(uTime * .04, -uTime * .05) + 9.);
  float w1 = .03 + fwidth(n), w2 = .025 + fwidth(n2);
  float l1 = 1. - smoothstep(w1 * .5, w1, abs(n - .52)), l2 = 1. - smoothstep(w2 * .5, w2, abs(n2 - .5));
  float mask = smoothstep(.4, .6, vnoise(p * .18 + 4.3 + uTime * .02));
  float caps = smoothstep(.72, .95, vWave / max(uAmp, 1e-4)) * .8;
  return clamp(max(l1, l2 * .7) * mask + caps, 0., 1.); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float crest = smoothstep(-.3, 1., vWave / max(uAmp, 1e-4)); float fm = foamAt(vWP.xz) * uFoamAmt;
  diffuseColor.rgb = mix(mix(uDeep, uShallow, crest * .8), uFoam, fm);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uFoam * fm * .2 + uDeep * .12;');
  };
  mat.customProgramCacheKey = () => 'czfx-water';
  const m = new THREE.Mesh(geo, mat); m.position.copy(c); m.receiveShadow = true; m.userData.ground = true;
  const g = group('water', m);
  g.userData.update = t => { U.uTime.value = t; };
  return g;
};

const CAUSTIC = `
float caustic(vec2 uv, float time){
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.; vec2 i = p; float c = 1.; float inten = .005;
  for (int n = 0; n < 4; n++) { float t = time * (1. - 3.5 / float(n + 1));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1. / max(1e-4, length(vec2(p.x / (sin(i.x + t) / inten + 1e-5), p.y / (cos(i.y + t) / inten + 1e-5)))); }
  c /= 4.; c = 1.17 - pow(max(c, 0.), 1.4); return min(pow(abs(c), 8.), 4.); }
`;
function causticJS(u, v, time) {
  const px = (u * TAU) % TAU - 250, py = (v * TAU) % TAU - 250; let ix = px, iy = py, c = 1;
  for (let n = 0; n < 4; n++) { const t = time * (1 - 3.5 / (n + 1)), nx = px + Math.cos(t - ix) + Math.sin(t + iy), ny = py + Math.sin(t - iy) + Math.cos(t + ix); ix = nx; iy = ny;
    c += 1 / Math.hypot(px / (Math.sin(ix + t) / .005), py / (Math.cos(iy + t) / .005)); }
  c /= 4; c = 1.17 - Math.pow(c, 1.4); return Math.pow(Math.abs(c), 8);
}
KINDS.underwater = (S, o) => {
  const c = posOf(o, [0, 0, 0]), [W, D] = Array.isArray(o.area) ? [o.area[0], o.area[2] ?? o.area[1] ?? o.area[0]] : size2(o, [12, 12]), gy = o.ground ?? c.y, depth = o.depth ?? 6, I = o.intensity ?? 1, seed = o.seed ?? 191;
  const colHex = o.color ?? '#9ff0ff', fogHex = o.fogColor ?? '#1d6f9c', speed = o.speed ?? .5, scale = o.scale ?? .35, g = group('underwater');
  if (o.fog !== false) { S.scene.fog = new THREE.Fog(new THREE.Color(fogHex), o.near ?? 3, o.far ?? 24); S.scene.background = new THREE.Color(fogHex); }
  // caustic lines on the floor (GPU, crisp at any size)
  const fu = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uCol: { value: cl(colHex, .9 * I) }, uScale: { value: scale }, uC: { value: new THREE.Vector2(c.x, c.z) }, uR: { value: Math.min(W, D) / 2 } }]);
  const floorM = new THREE.ShaderMaterial({ uniforms: fu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, defines: { ADD: 1 },
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: `#include <common>
#include <fog_pars_vertex>
varying vec3 vWP;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform float uTime, uScale, uR; uniform vec3 uCol; uniform vec2 uC; varying vec3 vWP;
${CAUSTIC}
void main(){ float k = caustic(vWP.xz * uScale * .5, uTime); k = smoothstep(.1, .45, k);
  float a = k * (1. - smoothstep(.75, 1., length(vWP.xz - uC) / uR));
  vec3 c = uCol * a;
  ${FOG_F}
  gl_FragColor = vec4(c, 1.); }` });
  const fg = new THREE.PlaneGeometry(W, D); fg.rotateX(-Math.PI / 2);
  const fm = new THREE.Mesh(fg, floorM); fm.position.set(c.x, gy + .006, c.z); fm.renderOrder = 1; g.add(fm);
  // the same pattern projected by a spot light onto everything (characters too)
  let cv = null, ctx = null, img = null, tex = null; const N = o.mapRes ?? 96, tile = o.tile ?? 3;
  if (o.project !== false) {
    cv = document.createElement('canvas'); cv.width = cv.height = N; ctx = cv.getContext('2d'); img = ctx.createImageData(N, N);
    tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    const sp = lightOf(THREE.SpotLight, colHex, 30 * I, depth * 3, Math.min(1.2, Math.atan(Math.max(W, D) * .5 / depth)), .4, 1);
    sp.position.set(c.x, gy + depth, c.z); sp.target.position.set(c.x, gy, c.z); sp.map = tex; g.add(sp, sp.target); g.userData.caustics = sp;
  }
  g.add(KINDS.dust(S, { at: [c.x, gy + 1.5, c.z], area: [Math.min(W, 8), 3, Math.min(D, 6)], count: o.count ?? 110, color: '#d9f6ff', size: .022, wind: [.05, .025, .01], intensity: .55, seed: seed + 1 }));
  if (o.bubbles !== false) g.add(KINDS.bubbles(S, { at: [c.x + (o.bubbleAt?.[0] ?? .6), gy + 1.6, c.z + (o.bubbleAt?.[1] ?? -.4)], area: [Math.min(W, 3), 3.2, 1.2], count: typeof o.bubbles === 'number' ? o.bubbles : 14, seed: seed + 2 }));
  if (o.rays !== false) { const nr = typeof o.rays === 'number' ? o.rays : 5, geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0, .5); const rm = [];
    for (let i = 0; i < nr; i++) { const m = new THREE.Mesh(geo, beamMat(cl(colHex, 1), .25 * I, 1, 1)); m.matrixAutoUpdate = false; m.renderOrder = 3;
      const x = c.x + (hash(i, seed) - .5) * Math.min(W, 10), z = c.z + (hash(i * 2.3, seed) - .5) * Math.min(D, 5) - 1.5, w = .35 + hash(i * 3.7, seed) * .5;
      m.matrix.makeBasis(new THREE.Vector3(w, 0, 0), new THREE.Vector3(0, 0, w * .6), new THREE.Vector3(.18 + (hash(i * 5.1, seed) - .5) * .2, -depth, .12)).setPosition(x, gy + depth, z); g.add(m); rm.push(m.material); }
    g.userData.rays = rm; }
  g.userData.update = t => {
    fu.uTime.value = t * speed;
    if (g.userData.rays) g.userData.rays.forEach((m, i) => { m.uniforms.uI.value = .25 * I * (.55 + .45 * (noise1(t * .5 + i * 2.7, seed) * .5 + .5)); });
    if (tex) { const d = img.data; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let k = causticJS(i / N * tile * .5, j / N * tile * .5, t * speed); k = sstep(.1, .45, k); const q = (j * N + i) * 4, v = Math.round(255 * k); d[q] = d[q + 1] = d[q + 2] = v; d[q + 3] = 255; }
      ctx.putImageData(img, 0, 0); tex.needsUpdate = true; }
  };
  return g;
};

// ====================================================================================================================
// SKY / ATMOSPHERE: clouds, fog, lightning, tornado
// ====================================================================================================================
const TONES = { day: ['#ffffff', '#b9c6e6'], dusk: ['#ffd9c2', '#a07aa8'], night: ['#56608f', '#262c52'], storm: ['#8d95a5', '#4b5262'], pink: ['#ffe0ea', '#d99bb8'] };
KINDS.clouds = (S, o) => {
  const c = posOf(o, [0, 14, -45]), [W, H, D] = box(o, [60, 10, 30]), n = Math.round(o.count ?? 8), size = o.size ?? 6, speed = o.speed ?? .5, seed = o.seed ?? 201, R = rnd(seed);
  const [top, shd] = o.colors ?? TONES[o.tone] ?? (o.color ? [o.color, o.shade ?? '#9aa6c6'] : TONES.day);
  const P = [], CL = [];
  for (let j = 0; j < n; j++) { const sj = size * (.7 + R() * .6), m = 5 + Math.floor(R() * 5); CL.push({ x: R() * W, y: R() * H, z: R() * D, v: .8 + R() * .4 });
    for (let k = 0; k < m; k++) { const u = k / (m - 1) - .5, mid = 1 - Math.abs(u) * 1.6; P.push({ j, x: u * 1.7 * sj + (R() - .5) * .3 * sj, y: Math.max(0, mid) * .35 * sj + R() * .12 * sj, z: (R() - .5) * .6 * sj, r: sj * (.3 + .28 * Math.max(0, mid) + R() * .1) }); } }
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTop: { value: cl(top, 1) }, uShade: { value: cl(shd, 1) } }]);
  const mat = new THREE.ShaderMaterial({ uniforms: u, fog: true, defines: { ADD: 0 },
    vertexShader: `#include <common>
#include <fog_pars_vertex>
varying vec3 vN;
void main(){ mat4 im = mat4(1.);
#ifdef USE_INSTANCING
  im = instanceMatrix;
#endif
  vec4 wp = modelMatrix * im * vec4(position, 1.); vN = normalize(mat3(modelMatrix) * mat3(im) * normal);
  vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform vec3 uTop, uShade; varying vec3 vN;
void main(){ vec3 n = normalize(vN); float k = n.y * .8 + n.x * .25 + n.z * .1;
  vec3 c = mix(uShade, uTop, smoothstep(-.12, .22, k)); c = mix(c, uTop * 1.04, smoothstep(.75, .95, k) * .5);
  ${FOG_F}
  gl_FragColor = vec4(c, 1.); }` });
  const so = new Solids(new THREE.IcosahedronGeometry(1, 3), mat, P.length, {});
  const g = group('clouds', so);
  g.userData.update = t => {
    so.reset();
    for (const p of P) { const cj = CL[p.j], xr = wrap(cj.x + speed * cj.v * t, W) / W, e = edge(xr, .08);
      so.add(c.x + (xr - .5) * W + p.x, c.y - H / 2 + cj.y + p.y, c.z - D / 2 + cj.z + p.z, _q.identity(), p.r * e, p.r * .8 * e, p.r * e); }
    so.done();
  };
  return g;
};

KINDS.fog = (S, o) => {
  const c = posOf(o, [0, 0, 0]), r = o.radius ?? (Array.isArray(o.size) ? Math.max(...o.size) : o.size ?? 16) / 2, h = o.height ?? .7, nl = Math.max(1, o.layers ?? 6), op = o.opacity ?? .5, seed = o.seed ?? 211;
  const wind = V(o.wind ?? [.12, 0, .04]), colr = cl(o.color ?? '#e3ebf2', 1), g = group('fog'), mats = [];
  const geo = new THREE.PlaneGeometry(2 * r, 2 * r); geo.rotateX(-Math.PI / 2);
  for (let i = 0; i < nl; i++) {
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uCol: { value: colr }, uOp: { value: 0 }, uR: { value: r }, uC: { value: new THREE.Vector2(c.x, c.z) }, uW: { value: new THREE.Vector2(wind.x, wind.z) }, uSeed: { value: i * 3.7 + seed } }]);
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true, defines: { ADD: 0 },
      vertexShader: `#include <common>
#include <fog_pars_vertex>
varying vec3 vWP;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform float uTime, uOp, uR, uSeed; uniform vec3 uCol; uniform vec2 uC, uW; varying vec3 vWP;
${NOISE}
void main(){ vec2 p = vWP.xz;
  float n = fbm(p * .32 + uW * uTime * .5 + uSeed * 1.7), n2 = fbm(p * .85 - uW * uTime * .9 + uSeed * 3.1);
  float d = length(p - uC) / uR + (n2 - .5) * .35;            // ragged, wide fade: seen edge-on a narrow fade reads as a hard line
  float a = smoothstep(.32, .72, n * .7 + n2 * .3) * uOp * pow(1. - smoothstep(.15, 1., d), 1.5);
  vec3 c = uCol * (.93 + .1 * n2);
  ${FOG_F}
  gl_FragColor = vec4(c, a); }` });
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(c.x, c.y + .03 + Math.pow(i / Math.max(1, nl - 1), 1.3) * h, c.z); mesh.renderOrder = 2; g.add(mesh); mats.push(m);
  }
  const np = o.puffs ?? 10, puffs = new Sprites(np, { shape: 'puff', blend: 'normal', shade: .92, soft: .75, order: 2 }); g.add(puffs.mesh);
  const PP = []; const R = rnd(seed); for (let i = 0; i < np; i++) PP.push({ a: R() * TAU, r: Math.sqrt(R()) * r * .75, s: (1.6 + R() * 1.6) * h * 2.2, ph: R() * 10 });
  g.userData.update = t => {
    const e = env(o, t);
    mats.forEach((m, i) => { m.uniforms.uTime.value = t; m.uniforms.uOp.value = op * e * .5 * Math.pow(1 - i / nl, 1.1); });
    puffs.reset();
    for (const p of PP) { const x = c.x + Math.cos(p.a) * p.r + wind.x * t * .6 + Math.sin(t * .2 + p.ph) * .2, z = c.z + Math.sin(p.a) * p.r + wind.z * t * .6;
      const rr = Math.hypot(x - c.x, z - c.z) / r; puffs.add(x, c.y + h * .35, z, p.s, p.s * .45, 0, colr.r, colr.g, colr.b, op * .32 * e * (1 - sstep(.6, .95, rr)), 0, 0, 0, p.ph); }
    puffs.done(t);
  };
  return g;
};

KINDS.lightning = (S, o) => {
  const c = posOf(o, [0, 0, -12]), H = o.height ?? 14, I = o.intensity ?? 1, seed = o.seed ?? 221, times = timesOf(o, S, 16), m = 65;
  const bolts = times.map((T, s) => { const R = rnd(seed + s * 31), top = [c.x + (R() - .5) * H * .35, c.y + H, c.z + (R() - .5) * H * .15];
    const mainP = jag(top, [c.x, c.y, c.z], 6, .2, R); const br = [];
    for (let b = 0; b < 2; b++) { const at = mainP[Math.floor(mainP.length * (.25 + R() * .35))], len = H * (.18 + R() * .2), a = R() * TAU;
      br.push(jag(at, [at[0] + Math.cos(a) * len * .6, at[1] - len, at[2] + Math.sin(a) * len * .3], 5, .25, R)); }
    return { main: mainP, br }; });
  function jag(a, b, lv, amp, R) { let P = [a, b]; for (let l = 0; l < lv; l++) { const Q = [P[0]]; for (let i = 1; i < P.length; i++) { const p = P[i - 1], q = P[i], d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * amp;
      Q.push([(p[0] + q[0]) / 2 + (R() - .5) * d * 2, (p[1] + q[1]) / 2 + (R() - .5) * d * .5, (p[2] + q[2]) / 2 + (R() - .5) * d], q); } P = Q; } return P; }
  const rb = new Ribbons(3, m, { blend: 'add', mode: 1, color: cl(o.color ?? '#9a8cff', 1.6), core: cl('#f2f6ff', 4), order: 4 });
  const sky = new Sprites(1, { shape: 'dot', blend: 'add', fog: false, order: -4 });
  const hemi = lightOf(THREE.HemisphereLight, '#dfe6ff', '#6a6f9a', 0), dl = lightOf(THREE.DirectionalLight, '#e6ecff', 0); dl.position.set(c.x, c.y + H, c.z + 4); dl.target.position.copy(c);
  const PAT = [1, .25, 1, .7, .35, .15];
  const g = group('lightning', rb, sky, hemi, dl, dl.target);
  g.userData.update = t => {
    rb.clear(); sky.reset(); let lit = 0, act = -1;
    for (let s = 0; s < times.length; s++) { const tau = t - times[s]; if (tau >= 0 && tau < PAT.length * F) { act = s; lit = PAT[Math.floor(tau / F)]; } }
    if (act >= 0) { const B = bolts[act];
      rb.line(0, B.main, v => (.1 - .04 * v) * (o.width ?? 1) * H / 14, lit);
      B.br.forEach((P, i) => rb.line(i + 1, P, v => (.055 - .03 * v) * (o.width ?? 1) * H / 14, lit * .8));
      const top = B.main[0]; sky.add(top[0], top[1] - H * .15, top[2] - 2, H * 1.6, H * 1.6, 0, .55 * lit, .6 * lit, 1 * lit, 1); }
    hemi.intensity = 2.5 * I * lit; dl.intensity = 3 * I * lit;
    rb.done(); sky.done(t);
  };
  if (o.flash) for (const T of times) S.flash?.(T, .1);
  for (const T of times) sfx(S, o, 'impact', T + (o.thunderDelay ?? .35), -6);
  return g;
};

KINDS.tornado = (S, o) => {
  const c = posOf(o, [0, 0, 0]), H = o.height ?? 6, r0 = o.radius0 ?? H * .045, r1 = o.radius ?? H * .33, spin = o.speed ?? 1.4, seed = o.seed ?? 231, R = rnd(seed);
  const dark = cl(o.color ?? '#5d6370', 1), lightc = cl(o.color2 ?? '#9aa0ab', 1);
  const U = { uTime: { value: 0 }, uH: { value: H }, uR0: { value: r0 }, uR1: { value: r1 }, uSpin: { value: spin }, uDark: { value: dark }, uLight: { value: lightc }, uSway: { value: o.sway ?? H * .06 } };
  const vs = `#include <common>
#include <fog_pars_vertex>
uniform float uTime, uH, uR0, uR1, uSway; varying vec3 vLP; varying vec3 vN, vV;
void main(){ float y = position.y, k = y / uH; float r = uR0 + (uR1 - uR0) * pow(clamp(k, 0., 1.), 1.7);
  vec3 p = vec3(position.x * r, y, position.z * r); p.x += uSway * sin(k * 2.4 - uTime * 1.1) * k; p.z += uSway * .6 * cos(k * 2. - uTime * .9) * k;
  vLP = vec3(position.x, k, position.z);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.); vN = normalize(normalMatrix * vec3(position.x, -.3, position.z)); vV = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
  const fs = side => `#include <common>
#include <fog_pars_fragment>
uniform float uTime, uSpin; uniform vec3 uDark, uLight; varying vec3 vLP; varying vec3 vN, vV;
void main(){ float ang = atan(vLP.z, vLP.x) / 6.28318; float u = ang * 5. + vLP.y * 2.2 - uTime * uSpin * ${side ? '.55' : '.4'};
  float band = smoothstep(.35, .5, abs(fract(u) - .5) * 2.); vec3 c = mix(uDark, uLight, band) * mix(.7, 1., vLP.y) * ${side ? '1.' : '.8'};
  float f = 1. - abs(dot(normalize(vN), normalize(vV)));
  float a = mix(.74, .97, f) * smoothstep(0., .05, vLP.y) * (1. - smoothstep(.9, 1., vLP.y));
  ${FOG_F}
  gl_FragColor = vec4(c, a); }`;
  const geo = new THREE.CylinderGeometry(1, 1, H, 48, 32, true); geo.translate(0, H / 2, 0);
  const mk = side => { const m = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, U]), vertexShader: vs, fragmentShader: fs(side), transparent: true, depthWrite: false, side: side ? THREE.FrontSide : THREE.BackSide, fog: true, defines: { ADD: 0 } }); return m; };
  const back = new THREE.Mesh(geo, mk(0)), front = new THREE.Mesh(geo, mk(1)); back.position.copy(c); front.position.copy(c); back.renderOrder = 2; front.renderOrder = 3;
  const nd = o.debris ?? 24, deb = new Solids(new THREE.BoxGeometry(1, 1, 1), solidMat({ rough: .8 }), nd, { outline: .006 });
  const dcol = ['#6b5a4c', '#8a7360', '#4a6a3a', '#a08060'].map(h => new THREE.Color(h));
  const D = []; for (let i = 0; i < nd; i++) D.push({ ph: R(), a: R() * TAU, s: .06 + R() * .1, w: 1 + R() * .8, col: dcol[Math.floor(R() * 4)], rx: R() * 9, ry: R() * 7 });
  const nb = 12, dust = new Sprites(nb, { shape: 'puff', blend: 'normal', shade: .75, soft: .35, order: 1 }), dc = rgb(o.dustColor ?? '#a0927e', 1);
  const ncap = o.cap === false ? 0 : 14, cap = new Sprites(Math.max(1, ncap), { shape: 'puff', blend: 'normal', shade: .7, soft: .3, order: 4 }), capc = rgb(o.capColor ?? '#5a5f6b', 1);
  const g = group('tornado', back, front, deb, dust, cap);
  g.userData.update = t => {
    for (const m of [back.material, front.material]) m.uniforms.uTime.value = t;
    deb.reset(); dust.reset(); const sw = U.uSway.value;
    for (const p of D) { const k = frac(t * .12 * p.w + p.ph), y = k * H * .9, r = (r0 + (r1 - r0) * Math.pow(k, 1.7)) * 1.25, an = p.a + t * spin * 1.6 * p.w;
      const ox = sw * Math.sin(k * 2.4 - t * 1.1) * k, oz = sw * .6 * Math.cos(k * 2 - t * .9) * k;
      _q.setFromEuler(_e.set(t * p.rx, t * p.ry, 0)); const s = p.s * edge(k, .1); deb.add(c.x + Math.cos(an) * r + ox, c.y + y, c.z + Math.sin(an) * r + oz, _q, s, s * .6, s * .9, p.col); }
    for (let i = 0; i < nb; i++) { const an = i / nb * TAU + t * spin * .8, rr = r0 * 4 + .25 * Math.sin(t * 1.3 + i), s = H * (.12 + .05 * hash(i, seed));
      dust.add(c.x + Math.cos(an) * rr, c.y + s * .35, c.z + Math.sin(an) * rr, s, s * .7, an, dc[0], dc[1], dc[2], .75, 0, 0, 0, hash(i * 2.1, seed)); }
    cap.reset();      // the dark storm cloud the funnel hangs from
    for (let i = 0; i < ncap; i++) { const an = i / ncap * TAU + t * spin * .25, rr = r1 * (.5 + .7 * hash(i * 1.7, seed)), s = H * (.32 + .14 * hash(i * 3.3, seed)), ox = sw * Math.sin(2.4 - t * 1.1), oz = sw * .6 * Math.cos(2 - t * .9);
      cap.add(c.x + Math.cos(an) * rr + ox, c.y + H * (1.02 + .06 * hash(i * 5.9, seed)), c.z + Math.sin(an) * rr * .6 + oz, s, s * .6, an * .3, capc[0], capc[1], capc[2], .95, 0, 0, 0, hash(i * 7.3, seed)); }
    deb.done(); dust.done(t); cap.done(t);
  };
  return g;
};

// ====================================================================================================================
// LAVA
// ====================================================================================================================
KINDS.lava = (S, o) => {
  const c = posOf(o, [0, 0, 0]), [w, d] = size2(o, [6, 6]), I = o.intensity ?? 1, seed = o.seed ?? 241, R = rnd(seed);
  const U = { uTime: { value: 0 }, uScale: { value: o.scale ?? 1.4 }, uHot: { value: cl(o.color ?? '#ff6a1a', 2.6 * I) }, uHot2: { value: cl('#ffd04a', 3.4 * I) }, uCrust: { value: cl(o.crust ?? '#2b1612') }, uCrust2: { value: cl('#5a2a1a') },
    uC: { value: new THREE.Vector2(c.x, c.z) }, uHalf: { value: new THREE.Vector2(w / 2, d / 2) }, uRound: { value: o.shape === 'rect' ? 0 : 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, U]), fog: true, defines: { ADD: 0 },
    vertexShader: `#include <common>
#include <fog_pars_vertex>
varying vec3 vWP;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `#include <common>
#include <fog_pars_fragment>
uniform float uTime, uScale, uRound; uniform vec3 uHot, uHot2, uCrust, uCrust2; uniform vec2 uC, uHalf; varying vec3 vWP;
${NOISE}
vec2 vor(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); float h = h21(i + g);
    vec2 o = .5 + .38 * sin(uTime * .35 + 6.2831 * vec2(h, h21(i + g + 17.3))); float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return vec2(d1, d2); }
void main(){ vec2 p = vWP.xz * uScale + vec2(uTime * .05, uTime * .02); p += (vec2(fbm(p * .7 + uTime * .05), fbm(p * .7 + 5.2 - uTime * .04)) - .5) * .8;
  vec2 v = vor(p); float edge = v.y - v.x;
  float crack = 1. - smoothstep(.02, .12 + .05 * sin(uTime * 1.3 + p.x), edge);
  float pulse = .5 + .5 * sin(uTime * 1.7 + fbm(p * .5) * 6.);
  vec3 crust = mix(uCrust, uCrust2, smoothstep(.2, .9, fbm(p * 1.3)) * (1. - v.x));
  vec3 hot = mix(uHot, uHot2, crack * crack * (.6 + .4 * pulse));
  float glow = clamp(crack + pow(max(0., .35 - v.x) / .35, 3.) * .3, 0., 1.);
  if (uRound > .5) { vec2 q = (vWP.xz - uC) / uHalf; float an = atan(q.y, q.x); float rr = length(q) * (1. + .06 * sin(an * 5. + 1.3) + .04 * sin(an * 9.));
    if (rr > 1.) discard;
    float rim = smoothstep(.78, .97, rr); glow *= 1. - rim; crust = mix(crust, uCrust * .55, smoothstep(.93, 1., rr)); }
  vec3 c = mix(crust, hot, glow);
  ${FOG_F}
  gl_FragColor = vec4(c, 1.); }` });
  const geo = new THREE.PlaneGeometry(w, d); geo.rotateX(-Math.PI / 2);
  const plane = new THREE.Mesh(geo, mat); plane.position.copy(c); plane.userData.ground = true;
  const nb = o.bubbles ?? 9, bub = new Solids(new THREE.SphereGeometry(1, 20, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7a2a10', emissive: cl('#ff7a20'), emissiveIntensity: 2.2 * I, roughness: .4 }), nb, { outline: .006 });
  const B = []; for (let i = 0; i < nb; i++) B.push({ L: 1.4 + R() * 1.2, ph: R(), s: .08 + R() * .1 });
  const pops = new Sprites(nb * 6, { shape: 'dot', blend: 'add', minPx: 2 }), hotc = rgb('#ffb040', 3);
  const light = lightOf(THREE.PointLight, '#ff7a30', 0, Math.max(w, d) * 1.6, 2); light.position.set(c.x, c.y + 1, c.z);
  const g = group('lava', plane, bub, pops, light);
  if (o.embers !== false) g.add(KINDS.embers(S, { at: [c.x, c.y + .05, c.z], radius: Math.min(w, d) * .4, count: 16, rise: .8, life: 2, seed: seed + 1 }));
  g.userData.update = t => {
    U.uTime.value = t; mat.uniforms.uTime.value = t; bub.reset(); pops.reset();
    for (let i = 0; i < nb; i++) { const b = B[i], u = t / b.L + b.ph, cyc = Math.floor(u), f = u - cyc;
      const ba = hash(i * 3.3 + cyc * 7.7, seed) * TAU, br = Math.sqrt(hash(i * 5.1 + cyc * 2.3, seed + 1)) * .72, x = c.x + Math.cos(ba) * br * w / 2, z = c.z + Math.sin(ba) * br * d / 2;
      if (f < .9) { const s = b.s * E.outCubic(f / .9); bub.add(x, c.y - .01, z, _q.identity(), s, s * .8, s); }
      else { const k = (f - .9) / .1; for (let j = 0; j < 6; j++) { const a = j / 6 * TAU + i, r = b.s * (1 + 2.5 * k); pops.add(x + Math.cos(a) * r, c.y + .04 + b.s * 2 * k * (1 - k) * 2, z + Math.sin(a) * r, .03, .03, 0, hotc[0], hotc[1], hotc[2], 1 - k); } } }
    light.intensity = 10 * I * (1 + .12 * noise1(t * 3, seed));
    bub.done(); pops.done(t);
  };
  return g;
};

// ====================================================================================================================
// MOTION: trail, speedLines
// ====================================================================================================================
// past poses of an object: re-run what moves it (characters, the shot's ticks + update, its own update functions) at an
// earlier time, read it, then put everything back at the current time. Legal because every scene is a pure function of t.
function sampler(S, root) {
  const chain = []; for (let x = root; x; x = x.parent) chain.unshift(x);
  const below = []; root.traverse(x => { if (x !== root) below.push(x); });
  return tt => {
    for (const a of S.actors || []) a.update(tt);
    for (const f of S.ticks || []) f(tt, S);
    S.def?.update?.(S.def._st, tt, S);
    for (const x of chain) if (x.userData.update && !x.userData.fx) x.userData.update(tt, S);
    for (const x of below) if (x.userData.update && !x.userData.fx) x.userData.update(tt, S);
    root.updateWorldMatrix(true, true);
  };
}
const worldVisible = m => { for (let x = m; x; x = x.parent) if (!x.visible) return false; return true; };
KINDS.trail = (S, o) => {
  const root = rootOf(o.of), path = typeof o.path === 'function' ? o.path : null;
  if (!root && !path) { console.warn('fx trail: give o.of (an object or character) or o.path(t)'); return group('trail'); }
  const style = o.style ?? (o.color ? 'glow' : 'ghost'), copies = o.copies ?? (style === 'glow' ? 5 : 3), gap = (o.gap ?? (style === 'glow' ? 2 : 1.5)) * F;
  const t0 = o.t0 ?? -1e9, t1 = o.t1 ?? 1e9, glowCol = cl(o.color ?? '#ffe9a0', o.intensity ?? 1.4), g = group('trail');
  const opac = k => style === 'glow' ? .8 * (1 - (k - 1) / copies) : (Array.isArray(o.opacity) ? o.opacity[k - 1] : null) ?? [.5, .25, .14, .08, .05][k - 1] ?? .05;
  if (!root) {    // a path only: glowing balls along it
    const sp = new Sprites(copies + 1, { shape: 'dot', blend: 'add', minPx: 3 }), sz = o.size ?? .12; g.add(sp.mesh);
    g.userData.update = t => { sp.reset(); for (let k = 1; k <= copies; k++) { const tt = t - k * gap; if (tt < t0 || tt > t1) continue; const p = V(path(tt)); sp.add(p.x, p.y, p.z, sz, sz, 0, glowCol.r, glowCol.g, glowCol.b, opac(k)); } sp.done(t); };
    return g;
  }
  const src = []; root.traverse(m => { if (m.isMesh && !m.userData.isOutline && !m.userData.fxGhost && !m.userData.fxXray) src.push(m); });
  const ghostMat = (mm, op) => { if (style === 'glow') return new THREE.MeshBasicMaterial({ color: glowCol, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
    const x = mm.clone(); x.transparent = true; x.opacity = (mm.opacity ?? 1) * op; x.depthWrite = false; return x; };
  const ghosts = [];
  for (let k = 1; k <= copies; k++) ghosts.push(src.map(m => { const mats = [].concat(m.material).map(mm => ghostMat(mm, opac(k)));
    const gm = new THREE.Mesh(m.geometry, Array.isArray(m.material) ? mats : mats[0]); gm.matrixAutoUpdate = false; gm.userData.fxGhost = true; gm.renderOrder = 6 - k; gm.visible = false; g.add(gm); return gm; }));
  const sample = path ? null : sampler(S, root), rel = src.map(() => new THREE.Matrix4()), invRoot = new THREE.Matrix4(), last = new THREE.Vector3(), cur = new THREE.Vector3();
  g.userData.update = t => {
    const on = []; for (let k = 1; k <= copies; k++) { const tt = t - k * gap; on.push(tt >= t0 && tt <= t1); }
    ghosts.forEach((list, i) => { if (!on[i]) for (const m of list) m.visible = false; });
    if (!on.some(Boolean)) return;
    if (path) { root.updateWorldMatrix(true, true); invRoot.copy(root.matrixWorld).invert(); src.forEach((m, i) => rel[i].multiplyMatrices(invRoot, m.matrixWorld)); }
    root.getWorldPosition(last);
    for (let k = 1; k <= copies; k++) { if (!on[k - 1]) continue; const tt = t - k * gap, list = ghosts[k - 1];
      if (path) { const p = V(path(tt)); _m4.copy(root.matrixWorld).setPosition(p); src.forEach((m, i) => { list[i].matrix.multiplyMatrices(_m4, rel[i]); list[i].visible = worldVisible(m); }); }
      else { sample(tt); src.forEach((m, i) => { list[i].matrix.copy(m.matrixWorld); list[i].visible = worldVisible(m); });
        if (o.minSpeed) { root.getWorldPosition(cur); if (cur.distanceTo(last) / gap < o.minSpeed) for (const m of list) m.visible = false; last.copy(cur); } }
    }
    if (sample) sample(t);
  };
  return g;
};

KINDS.speedLines = (S, o) => {
  const target = rootOf(o.of), isActor = !!o.of?.toon, dir = V(o.dir ?? [0, -1, 0]).normalize(), [e1, e2] = basis(dir), n = Math.round(o.count ?? 28), seed = o.seed ?? 251;
  const r0 = Array.isArray(o.radius) ? o.radius[0] : o.inner ?? .45, r1 = Array.isArray(o.radius) ? o.radius[1] : o.radius ?? 1.3, L = o.length ?? 4, speed = o.speed ?? 16, ll = o.lineLength ?? .9;
  const col = rgb(o.color ?? '#ffffff', 1.1), op = o.opacity ?? .75, wid = o.width ?? .016, fixed = posOf(target ? {} : o, [0, 1, 0]), off = V(o.offset ?? (isActor ? [0, (o.of.toon.height ?? 1.6) * .5, 0] : [0, 0, 0]));
  const sp = new Sprites(n, { shape: 'line', blend: 'normal', orient: 1, order: 4 });
  sp.mesh.onBeforeRender = () => { if (target) { target.getWorldPosition(_v).add(off); sp.mesh.matrixWorld.makeTranslation(_v.x, _v.y, _v.z); } else sp.mesh.matrixWorld.makeTranslation(fixed.x, fixed.y, fixed.z); };
  const g = group('speedLines', sp);
  g.userData.update = t => {
    sp.reset(); const e = env(o, t, .15, .2);
    if (e > 0) for (let i = 0; i < n; i++) {
      const a = hash(i, seed) * TAU, r = r0 + (r1 - r0) * hash(i * 2.3, seed), v = speed * (.7 + .6 * hash(i * 3.7, seed)), l = ll * (.4 + .6 * hash(i * 5.1, seed));
      const s = wrap(hash(i * 7.9, seed) * L - t * v, L) - L / 2, on = hash(Math.floor(t * 15) + i * 13.1, seed + 1) > .2 ? 1 : 0;
      const x = dir.x * s + (e1.x * Math.cos(a) + e2.x * Math.sin(a)) * r, y = dir.y * s + (e1.y * Math.cos(a) + e2.y * Math.sin(a)) * r, z = dir.z * s + (e1.z * Math.cos(a) + e2.z * Math.sin(a)) * r;
      sp.add(x, y, z, wid * (.7 + .6 * hash(i * 9.3, seed)), l, 0, col[0], col[1], col[2], op * e * on * edge(s / L + .5, .25), dir.x, dir.y, dir.z);
    }
    sp.done(t);
  };
  return g;
};

// ====================================================================================================================
// X-RAY SCAN
// ====================================================================================================================
// The scan line crosses the frame in 10 frames (sineInOut); above it (the swept side) the objects in `of` turn into a
// translucent blue body with a cyan rim, and the objects in `inside` (a skeleton, a brain, organs...) appear. o.back:
// the time the line sweeps back, restoring the normal render. Every material keeps working (faces included): it is the
// same material with a discard on the far side of the line, swapped in only while the scan is active.
function clipMat(mat, U, keep) {
  const m = mat.clone(), prev = mat.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uScanY = U.uScanY; sh.uniforms.uScanS = U.uScanS;
    sh.vertexShader = 'varying vec3 vXW;\n' + sh.vertexShader.replace(/}\s*$/, `
#ifdef USE_INSTANCING
  vXW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
#else
  vXW = (modelMatrix * vec4(position, 1.0)).xyz;
#endif
}`);
    sh.fragmentShader = 'uniform float uScanY; uniform float uScanS; varying vec3 vXW;\n' + sh.fragmentShader.replace(/void\s+main\s*\(\s*\)\s*\{/, s => s + `\n  if ((vXW.y - uScanY) * uScanS * ${keep.toFixed(1)} > 0.) discard;`);
  };
  const k0 = mat.customProgramCacheKey ? mat.customProgramCacheKey() : ''; m.customProgramCacheKey = () => k0 + '|czscan' + keep;
  return m;
}
KINDS.xrayScan = (S, o) => {
  const T = timeOf(o, S), dur = o.dur ?? 10 * F, back = o.back, up = o.dir === 'up', targets = [].concat(o.of ?? []).map(rootOf).filter(Boolean), inside = [].concat(o.inside ?? []).map(rootOf).filter(Boolean);
  const bb = new THREE.Box3(); for (const r of [...targets, ...inside]) { r.updateWorldMatrix(true, true); bb.union(new THREE.Box3().setFromObject(r)); }
  if (bb.isEmpty()) bb.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));
  const yTop = o.from ?? bb.max.y + .08, yBot = o.to ?? bb.min.y - .05, ctr = bb.getCenter(new THREE.Vector3()), width = o.width ?? Math.max(3, (bb.max.x - bb.min.x) * 3);
  const U = { uScanY: { value: 1e4 }, uScanS: { value: up ? -1 : 1 } };
  const xr = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uScanY: U.uScanY, uScanS: U.uScanS, uFill: { value: cl(o.xColor ?? '#3f9fd8') }, uRim: { value: cl(o.rimColor ?? '#aef6ff', 2.2) }, uA: { value: o.xOpacity ?? .6 } },
    vertexShader: `varying vec3 vXW; varying vec3 vN; varying vec3 vV;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vXW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uScanY, uScanS, uA; uniform vec3 uFill, uRim; varying vec3 vXW; varying vec3 vN; varying vec3 vV;
void main(){ float d = (vXW.y - uScanY) * uScanS; if (d < 0.) discard;
  float f = 1. - abs(dot(normalize(vN), normalize(vV))), rim = smoothstep(.45, .85, f), band = 1. - smoothstep(0., .035, d);
  vec3 c = mix(uFill, uRim, max(rim, band)); gl_FragColor = vec4(c + uRim * band * .6, mix(uA, 1., max(rim * .8, band))); }` });
  const cache = new Map(), clips = new Set(), clipOf = (mm, keep) => { const key = mm.uuid + keep; if (!cache.has(key)) { const c = clipMat(mm, U, keep); cache.set(key, c); clips.add(c); } return cache.get(key); };
  const swaps = [], shells = [], seen = new Set();
  const collect = (r, keep) => { const ms = []; r.traverse(m => { if (m.isMesh && !m.userData.fxXray && !m.userData.fxGhost && !seen.has(m)) ms.push(m); });
    for (const m of ms) { seen.add(m); swaps.push({ m, keep, orig: m.material }); if (keep > 0 && !m.userData.isOutline && !m.isInstancedMesh) { const x = new THREE.Mesh(m.geometry, xr); x.userData.fxXray = true; x.userData.noPick = true; x.renderOrder = 8; x.visible = false; m.add(x); shells.push(x); } } };
  for (const r of inside) collect(r, -1); for (const r of targets) collect(r, 1);
  const line = new Sprites(1, { shape: 'scan', blend: 'add', orient: 1, c1: cl(o.color ?? '#e6ffff', 3.2), c2: cl(o.glowColor ?? '#38d6ff', 2), order: 9 });
  const g = group('xrayScan', line);
  const yAt = t => { if (t < T) return null; const a = yTop, b = yBot; let y = lerp(up ? b : a, up ? a : b, E.inOutSine(seg(t, T, T + dur)));
    if (back != null && t >= back) y = lerp(up ? a : b, up ? b : a, E.inOutSine(seg(t, back, back + dur))); return y; };
  g.userData.update = t => {
    const y = yAt(t), active = y != null && !(back != null && t > back + dur + F);
    U.uScanY.value = active ? y : (up ? -1e4 : 1e4);
    for (const r of targets) r.userData.xray = active;                        // check_layout: an x-rayed face isn't drawn
    for (const s of swaps) {
      if (active) { const cur = s.m.material;
        if (!clips.has(Array.isArray(cur) ? cur[0] : cur)) s.orig = cur;      // the rig swapped the material itself: follow it
        s.m.material = Array.isArray(s.orig) ? s.orig.map(mm => clipOf(mm, s.keep)) : clipOf(s.orig, s.keep); }
      else if (s.m.material !== s.orig) s.m.material = s.orig;
    }
    for (const x of shells) x.visible = active;
    for (const r of inside) r.visible = active;
    line.reset();
    const moving = y != null && ((t >= T && t <= T + dur) || (back != null && t >= back && t <= back + dur));
    if (moving) line.add(ctr.x, y, ctr.z, width, o.thickness ?? .09, 0, 1, 1, 1, 1, 0, 1, 0);
    line.done(t);
  };
  for (const r of inside) r.visible = false;
  return g;
};

// ---------- aliases ----------
Object.assign(KINDS, { godRays: KINDS.godrays, rays: KINDS.godrays, cone: KINDS.lightCone, lightcone: KINDS.lightCone, bulb: KINDS.lightCone, mist: KINDS.fog, ocean: KINDS.water, sea: KINDS.water,
  glint: KINDS.sparkle, smear: (S, o) => KINDS.trail(S, { style: 'ghost', ...o }), ghost: (S, o) => KINDS.trail(S, { style: 'ghost', ...o }), xray: KINDS.xrayScan, scan: KINDS.xrayScan, speedlines: KINDS.speedLines, caustics: KINDS.underwater });

// Stick stories effects - the GPU side: instanced flat particles, ribbons (steam) and light beams. One shared quad per
// layer, per-instance state written from t on the CPU (pure functions of t and seeded tables: lib/fx.js), the SHAPE
// drawn in the fragment shader (soft disc, disc, rect, streak, sliver triangle, ring, 4-point star, puff, glow dot).
//
// Two placement modes:
//   field  instance xy are in RECT units (0..1, wrapped with fract): the rect is either a fixed world area or the
//          camera's view at the layer depth (+ margin), measured at render from the camera that draws the frame, and
//          shifted so the particles stay put in the world when the camera pans ("world-anchored wrap").
//   world  instance xy are offsets from an origin, in metres or in frame heights ('screen' units = the height of the
//          view at the layer depth, so reference pixel sizes stay true: 9 px at 1080 = 9 / 1080 of a frame height).
// Sizes are in frame heights ('screen') or metres ('m').
import { THREE } from '../core.js';

export const SHAPE = { soft: 0, disc: 1, rect: 2, streak: 3, tri: 4, ring: 5, star: 6, puff: 7, dot: 8 };

const VS = /* glsl */`
attribute vec4 aP;   // x, y, rotation, alpha
attribute vec4 aS;   // width, height, shape param, z offset (m)
attribute vec3 aC;   // colour (linear)
attribute vec2 aO;   // offset from the position, in size units (a highlight beside its drop, a trail above it)
uniform vec4 uRect;  // field: centre x, y, width, height | world: origin x, y
uniform vec2 uShift;
uniform float uMode, uZ, uPosUnit, uSizeUnit;
varying vec2 vUv; varying vec4 vC; varying float vK;
void main(){
  if (aP.w <= 0.002) { gl_Position = vec4(2., 2., 2., 1.); vUv = vec2(0.); vC = vec4(0.); vK = 0.; return; }
  vec2 c;
  if (uMode < .5) { vec2 u = fract(aP.xy + uShift); c = uRect.xy + (u - .5) * uRect.zw; }
  else c = uRect.xy + aP.xy * uPosUnit;
  vec2 s = aS.xy * uSizeUnit;
  c += aO * uSizeUnit;
  float cr = cos(aP.z), sr = sin(aP.z);
  vec2 q = position.xy * s; q = vec2(q.x * cr - q.y * sr, q.x * sr + q.y * cr);
  vUv = position.xy + .5; vC = vec4(aC, aP.w); vK = aS.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(c + q, uZ + aS.w, 1.);
}`;
const FS = /* glsl */`
uniform float uShape, uOpacity;
varying vec2 vUv; varying vec4 vC; varying float vK;
float edge(float d){ float w = fwidth(d); return clamp(.5 - d / max(w, 1e-5), 0., 1.); }
void main(){
  vec2 p = vUv - .5; float a = 0.; int sh = int(uShape + .5); float r = length(p);
  if (sh == 0) { float d = r * 2.; a = pow(clamp(1. - d * d, 0., 1.), 2.); }
  else if (sh == 1) { a = edge(r - .5); if (vK > 0.) a *= smoothstep(.5, .5 - vK, r) ; }
  else if (sh == 2) { vec2 q = abs(p) - .5; a = edge(max(q.x, q.y)); if (vK > 0.) a *= smoothstep(0., vK, .5 - abs(p.x)) * smoothstep(0., vK, .5 - abs(p.y)); }
  else if (sh == 3) { float hw = .5 * mix(.35, 1., smoothstep(0., .9, vUv.x)); a = edge(abs(p.y) - hw) * pow(clamp(vUv.x, 0., 1.), 1.4) * smoothstep(1., .93, vUv.x) ; a = max(a, edge(length(vec2((vUv.x - .97) * 6., p.y)) - .5) * step(.9, vUv.x)); }
  else if (sh == 4) { a = edge(abs(p.y) - .5 * (1. - vUv.x)); }
  else if (sh == 5) { float th = max(vK, .02); a = edge(abs(r * 2. - (1. - th)) - th) ; }
  else if (sh == 6) { float r1 = clamp(1. - abs(p.x) * 2., 0., 1.) * clamp(1. - abs(p.y) * 16., 0., 1.); float r2 = clamp(1. - abs(p.y) * 2., 0., 1.) * clamp(1. - abs(p.x) * 16., 0., 1.);
    float core = pow(clamp(1. - r * 6., 0., 1.), 1.2); float halo = pow(clamp(1. - r * 2., 0., 1.), 3.) * .45; a = clamp(max(max(r1 * r1, r2 * r2), core) + halo, 0., 1.); }
  else if (sh == 7) { a = smoothstep(.5, .3, r); }
  else { float core = edge(r - max(vK, .1)); float halo = pow(clamp(1. - r * 2., 0., 1.), 2.2) * .5; a = max(core, halo); }
  a *= vC.a * uOpacity;
  if (a < .002) discard;
  gl_FragColor = vec4(vC.rgb, a);
}`;

const _v = new THREE.Vector3(), _d = new THREE.Vector3();
/** the view of a camera on the plane z: { cx, cy, w, h, dist } (camera looks roughly toward -z) */
export function viewAt(cam, z) {
  cam.getWorldPosition(_v); cam.getWorldDirection(_d);
  const dist = _v.z - z, k = Math.abs(_d.z) > 1e-3 ? dist / -_d.z : dist;
  const h = 2 * Math.max(1e-3, dist) * Math.tan(cam.fov * Math.PI / 360) / (cam.zoom || 1);
  return { cx: _v.x + _d.x * k, cy: _v.y + _d.y * k, w: h * cam.aspect, h, dist };
}
const lin = new THREE.Color();
/** '#hex' -> [r, g, b] linear (for the colour attribute) */
export const rgb = hex => { lin.set(hex); return [lin.r, lin.g, lin.b]; };

/**
 * An instanced particle layer. new Layer(S, n, { shape, blend: 'add'|'normal', mode: 'field'|'world', z, depth (view
 * fields: z from the camera: zCam - (zCam - base) * depth), base, area: [x0, y0, x1, y1], margin, pos: 'screen'|'m',
 * size: 'screen'|'m', order })
 * set(i, x, y, rot, alpha, w, h, k, rgb, dz) then commit() once per frame.
 */
export class Layer {
  constructor(S, n, o = {}) {
    this.S = S; this.n = n; this.o = o;
    const g = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1);
    g.index = q.index; g.setAttribute('position', q.getAttribute('position'));
    this.P = new Float32Array(n * 4); this.Z = new Float32Array(n * 4); this.C = new Float32Array(n * 3).fill(1);
    this.aP = new THREE.InstancedBufferAttribute(this.P, 4).setUsage(THREE.DynamicDrawUsage);
    this.aS = new THREE.InstancedBufferAttribute(this.Z, 4).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.InstancedBufferAttribute(this.C, 3).setUsage(THREE.DynamicDrawUsage);
    this.O = new Float32Array(n * 2); this.aO = new THREE.InstancedBufferAttribute(this.O, 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aP', this.aP); g.setAttribute('aS', this.aS); g.setAttribute('aC', this.aC); g.setAttribute('aO', this.aO); g.instanceCount = n;
    this.u = { uRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uShift: { value: new THREE.Vector2() }, uMode: { value: o.mode === 'world' ? 1 : 0 },
      uZ: { value: 0 }, uPosUnit: { value: 1 }, uSizeUnit: { value: 1 }, uShape: { value: SHAPE[o.shape] ?? o.shape ?? 0 }, uOpacity: { value: 1 } };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, depthTest: o.depthTest !== false,
      blending: o.blend === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.mat.userData.own = true;
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = o.order ?? 30;
    this.mesh.userData.noPick = true; this.mesh.userData.fxLayer = this;
    this.mesh.onBeforeRender = (r, sc, cam) => this.frame(cam);
    this.origin = [0, 0]; this.z = o.z ?? 0; this.area = o.area || null; this.anchor = null; this.view = null;
  }
  /** at render: depth, units and the wrap rect from the camera that draws this frame */
  frame(cam) {
    const o = this.o, u = this.u;
    let z = typeof this.z === 'function' ? this.z(cam) : this.z;
    if (o.depth != null) { cam.getWorldPosition(_v); const base = o.base ?? this.S._subj?.z ?? 0; z = _v.z - (_v.z - base) * o.depth; }
    const V = viewAt(cam, z); this.view = V;
    u.uZ.value = z;
    if (V.dist < .05) { u.uOpacity.value = 0; return; }
    u.uOpacity.value = this.opacity ?? 1;
    const unit = s => s === 'm' ? 1 : V.h;
    u.uSizeUnit.value = unit(o.size); u.uPosUnit.value = unit(o.pos);
    if (o.mode === 'world') {
      // originView: the origin is the view centre at this depth (+ viewOffset in frame heights): screen-placed bursts
      if (this.originView) u.uRect.value.set(V.cx + (this.viewOffset?.[0] ?? 0) * V.h, V.cy + (this.viewOffset?.[1] ?? 0) * V.h, 0, 0);
      else u.uRect.value.set(this.origin[0], this.origin[1], 0, 0);
      return;
    }
    if (this.area) { const [x0, y0, x1, y1] = this.area; u.uRect.value.set((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0)); u.uShift.value.set(0, 0); return; }
    const m = o.margin ?? 1.12, w = V.w * m, h = V.h * m;
    if (!this.anchor) { const s = this.S._subj; this.anchor = s ? [s.x, s.y] : [0, 1]; }
    u.uRect.value.set(V.cx, V.cy, w, h); u.uShift.value.set(-(V.cx - this.anchor[0]) / w, -(V.cy - this.anchor[1]) / h);
  }
  /** aspect (width / height) of the rect the field wraps in (for round things in rect units) */
  get aspect() { if (this.area) { const [x0, y0, x1, y1] = this.area; return Math.abs(x1 - x0) / Math.max(1e-6, Math.abs(y1 - y0)); } return this.S.cam?.aspect ?? 16 / 9; }
  set(i, x, y, rot, a, w, h, k = 0, c = null, dz = 0, ox = 0, oy = 0) {
    const P = this.P, Z = this.Z, j = i * 4; P[j] = x; P[j + 1] = y; P[j + 2] = rot; P[j + 3] = a; Z[j] = w; Z[j + 1] = h; Z[j + 2] = k; Z[j + 3] = dz;
    this.O[i * 2] = ox; this.O[i * 2 + 1] = oy;
    if (c) { const C = this.C, m = i * 3; C[m] = c[0]; C[m + 1] = c[1]; C[m + 2] = c[2]; }
  }
  hide(i) { this.P[i * 4 + 3] = 0; }
  hideAll() { for (let i = 0; i < this.n; i++) this.P[i * 4 + 3] = 0; }
  commit() { this.aP.needsUpdate = true; this.aS.needsUpdate = true; this.aC.needsUpdate = true; this.aO.needsUpdate = true; }
}

/**
 * Ribbons (steam): `count` strips of `pts` points; set(i, k, x, y, halfWidth, alpha) per point (world metres, local to
 * the group), commit(). Vertex colours carry the alpha; one draw call.
 */
export class Ribbons {
  constructor(count, pts, color = '#ffffff', o = {}) {
    this.count = count; this.pts = pts;
    const nv = count * pts * 2, pos = new Float32Array(nv * 3), col = new Float32Array(nv * 4), idx = [];
    const c = rgb(color);
    for (let v = 0; v < nv; v++) { col[v * 4] = c[0]; col[v * 4 + 1] = c[1]; col[v * 4 + 2] = c[2]; col[v * 4 + 3] = 0; }
    for (let r = 0; r < count; r++) for (let k = 0; k + 1 < pts; k++) { const a = (r * pts + k) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage); this.aCol = new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('color', this.aCol); g.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mat.userData.own = true;
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = o.order ?? 25; this.mesh.userData.noPick = true;
    this.pos = pos; this.col = col; this.tmp = [];
  }
  /** a whole ribbon from a centre line [[x, y, halfWidth, alpha], ...] (pts long) */
  line(r, L) {
    const P = this.pos, A = this.col, n = this.pts;
    for (let k = 0; k < n; k++) {
      const p = L[k], q = L[Math.min(n - 1, k + 1)], b = L[Math.max(0, k - 1)];
      let tx = q[0] - b[0], ty = q[1] - b[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const nx = -ty * p[2], ny = tx * p[2], v = (r * n + k) * 2;
      P[v * 3] = p[0] + nx; P[v * 3 + 1] = p[1] + ny; P[v * 3 + 2] = 0; P[v * 3 + 3] = p[0] - nx; P[v * 3 + 4] = p[1] - ny; P[v * 3 + 5] = 0;
      A[v * 4 + 3] = p[3]; A[v * 4 + 7] = p[3];
    }
  }
  commit() { this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; }
}

const BVS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const BFS = /* glsl */`
uniform vec3 uColor; uniform float uAlpha, uTaper, uSoft, uFade, uStart, uBands, uGap;
varying vec2 vUv;
void main(){
  float hw = .5 * mix(uTaper, 1., vUv.y), x = vUv.x - .5;
  float side = smoothstep(hw, hw - uSoft * hw * 2., abs(x));
  float along = pow(1. - vUv.y, uFade) * smoothstep(0., uStart, vUv.y);
  float bands = 1.;
  if (uBands > .5) { float f = fract((x / max(hw, 1e-4) * .5 + .5) * uBands); bands = mix(1., smoothstep(0., .18, f) * smoothstep(1., .82, f), uGap); }
  float a = side * along * bands * uAlpha;
  if (a < .002) discard;
  gl_FragColor = vec4(uColor, a);
}`;
/**
 * A soft light beam: a trapezoid from its source (y = 0) along +y, `len` long, `w` wide at the far end and w * taper
 * at the source, soft sides (soft 0..0.5 of the width), fading along its length (fade power), optional bands (god rays).
 */
export function beam(len, w, color, o = {}) {
  const g = new THREE.PlaneGeometry(w, len); g.translate(0, len / 2, 0);
  const u = { uColor: { value: new THREE.Color(color) }, uAlpha: { value: o.alpha ?? .2 }, uTaper: { value: o.taper ?? 1 }, uSoft: { value: o.soft ?? .25 },
    uFade: { value: o.fade ?? 1.2 }, uStart: { value: o.start ?? .04 }, uBands: { value: o.bands ?? 0 }, uGap: { value: o.gap ?? .65 } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: BVS, fragmentShader: BFS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending });
  m.userData.own = true;
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = o.order ?? 12; mesh.userData.noPick = true; mesh.userData.u = u;
  return mesh;
}

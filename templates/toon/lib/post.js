// The toon look's post: the 3D drawn at full size with 4x MSAA and a depth texture, depth of field (a circle-of-confusion
// gather at half size, focus pulled per shot), bloom on lamps / neon / fire, then one final pass: light sharpen, a touch of
// colour fringe at the edges, the grade, vignette, film grain and the 2D overlay (captions, inserts, UI) on top.
// Transitions mix two full shots (cut, dissolve, whip, zoom-through, push, flash, through black).
import { THREE, SETTINGS, RW, RH, FW, FH } from './core.js';

const quad = new THREE.PlaneGeometry(2, 2);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
export function makeRT(w, h, o = {}) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: o.depth !== false, samples: o.samples || 0, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  if (o.depthTex) { rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.UnsignedIntType; }
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace; return rt;
}
function pass(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: frag, depthTest: false, depthWrite: false });
  const s = new THREE.Scene(); s.add(new THREE.Mesh(quad, m)); return { m, s };
}
const CAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export function createPost(renderer) {
  const scene = () => makeRT(RW, RH, { samples: 4, depthTex: true });
  const rtA = scene(), rtB = scene();                                     // shot A / shot B (transitions) with depth
  const rtDA = makeRT(RW, RH, { depth: false }), rtDB = makeRT(RW, RH, { depth: false });   // after depth of field
  const rtMix = makeRT(RW, RH, { depth: false });
  const hw = RW >> 1, hh = RH >> 1;
  const rtHalf = makeRT(hw, hh, { depth: false }), rtHalfB = makeRT(hw, hh, { depth: false });
  const bw = Math.max(32, RW >> 2), bh = Math.max(32, RH >> 2);
  const rtBr = makeRT(bw, bh, { depth: false }), rtBl1 = makeRT(bw, bh, { depth: false }), rtBl2 = makeRT(bw, bh, { depth: false });
  const bw2 = Math.max(16, bw >> 1), bh2 = Math.max(16, bh >> 1);
  const rtBl3 = makeRT(bw2, bh2, { depth: false }), rtBl4 = makeRT(bw2, bh2, { depth: false });

  // --- depth of field: 1) colour + circle of confusion at half size, 2) a 40-tap golden-angle gather, 3) composite
  // a NaN / Inf pixel (a broken normal, a zero-size geometry) must never reach the blurs: bloom and depth of field would
  // spread it into a black square. Every read of a drawn shot goes through nn().
  // (tested on the float's bits: Windows' shader compiler assumes values are never NaN and drops isnan() / isinf())
  const NN = `bool bad(float x){ return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
    vec3 nn(vec3 c){ return (bad(c.x) || bad(c.y) || bad(c.z)) ? vec3(0.) : c; }`;
  const DEPTH = `${NN} uniform sampler2D tD; uniform float near, far;
    float linZ(vec2 uv){ float d = texture2D(tD, uv).x; float z = d * 2. - 1.; return (2. * near * far) / (far + near - z * (far - near)); }`;
  const cocP = pass(`${DEPTH} uniform sampler2D tC; uniform float focus, aperture, maxCoc; varying vec2 vUv;
    void main(){ float z = linZ(vUv); float c = clamp(aperture * abs(z - focus) / max(z, .001), 0., maxCoc);
      gl_FragColor = vec4(nn(texture2D(tC, vUv).rgb), c); }`,
  { tC: { value: null }, tD: { value: null }, near: { value: .05 }, far: { value: 400 }, focus: { value: 3 }, aperture: { value: .1 }, maxCoc: { value: 1 } });
  const gather = pass(`uniform sampler2D t; uniform vec2 px; uniform float radius; varying vec2 vUv;
    void main(){ vec4 c0 = texture2D(t, vUv); float r0 = c0.a * radius; vec3 acc = c0.rgb; float wsum = 1.;
      for (int i = 1; i < 40; i++) { float fi = float(i); float r = sqrt(fi / 40.) * radius; float a = fi * 2.39996323;
        vec2 o = vec2(cos(a), sin(a)) * r * px; vec4 s = texture2D(t, vUv + o);
        float sr = s.a * radius; float w = smoothstep(r - 1.5, r + .5, max(sr, min(r0, sr * 2.)));   // a sample spreads as far as its own blur
        acc += s.rgb * w; wsum += w; }
      gl_FragColor = vec4(acc / wsum, c0.a); }`, { t: { value: null }, px: { value: new THREE.Vector2(1 / hw, 1 / hh) }, radius: { value: 14 } });
  const dofMix = pass(`${DEPTH} uniform sampler2D tC, tB; uniform float focus, aperture, maxCoc, on; varying vec2 vUv;
    void main(){ vec3 sharp = nn(texture2D(tC, vUv).rgb); if (on < .5) { gl_FragColor = vec4(sharp, 1.); return; }
      vec4 b = texture2D(tB, vUv); float z = linZ(vUv); float c = clamp(aperture * abs(z - focus) / max(z, .001), 0., maxCoc);
      float k = smoothstep(.06, .32, max(c, b.a * .9));
      gl_FragColor = vec4(mix(sharp, b.rgb, k), 1.); }`,
  { tC: { value: null }, tB: { value: null }, tD: { value: null }, near: { value: .05 }, far: { value: 400 }, focus: { value: 3 }, aperture: { value: .1 }, maxCoc: { value: 1 }, on: { value: 1 } });

  // --- transitions between two shots
  const mix = pass(`uniform sampler2D a, b; uniform float k, mode; uniform vec2 dir, res; varying vec2 vUv;
    vec3 smear(sampler2D s, vec2 uv, vec2 d, float amt){ vec3 c = vec3(0.); for (int i = 0; i < 12; i++) { c += texture2D(s, uv + d * amt * (float(i) / 11. - .5)).rgb; } return c / 12.; }
    void main(){
      vec2 uv = vUv;
      if (mode < .5) { gl_FragColor = texture2D(a, uv); return; }                                            // copy
      if (mode < 1.5) { gl_FragColor = mix(texture2D(a, uv), texture2D(b, uv), k * k * (3. - 2. * k)); return; }   // dissolve
      if (mode < 2.5) {                                                                                       // whip: both shots slide with a motion smear
        float e = k < .5 ? 4. * k * k * k : 1. - pow(-2. * k + 2., 3.) / 2.; float v = sin(k * 3.14159);
        vec2 ua = uv + dir * e, ub = uv + dir * (e - 1.);
        bool inB = ub.x >= 0. && ub.x <= 1. && ub.y >= 0. && ub.y <= 1.;
        gl_FragColor = vec4(inB ? smear(b, ub, dir, v * .35) : smear(a, ua, dir, v * .35), 1.); return; }
      if (mode < 3.5) {                                                                                       // zoom-through: A rushes past the lens, B lands from slightly big
        float e = k * k * (3. - 2. * k); vec2 c = uv - .5;
        vec3 A = vec3(0.), B = vec3(0.);
        for (int i = 0; i < 10; i++) { float f = float(i) / 9.;
          A += texture2D(a, .5 + c / (1. + e * 2.2 * (1. + f * .25))).rgb; B += texture2D(b, .5 + c / (1.18 - e * .18 + (1. - e) * f * .08)).rgb; }
        A /= 10.; B /= 10.; gl_FragColor = vec4(mix(A, B, smoothstep(.35, .65, k)), 1.); return; }
      if (mode < 4.5) {                                                                                       // push: the new shot pushes the old one out
        float e = k < .5 ? 4. * k * k * k : 1. - pow(-2. * k + 2., 3.) / 2.; vec2 ua = uv + dir * e, ub = uv + dir * (e - 1.);
        bool inB = ub.x >= 0. && ub.x <= 1. && ub.y >= 0. && ub.y <= 1.; gl_FragColor = inB ? texture2D(b, ub) : texture2D(a, ua); return; }
      if (mode < 5.5) { gl_FragColor = k < .5 ? texture2D(a, uv) : texture2D(b, uv); return; }               // flash (white comes from the final pass)
      float f = k < .5 ? 1. - k * 2. : (k - .5) * 2.; gl_FragColor = vec4((k < .5 ? texture2D(a, uv) : texture2D(b, uv)).rgb * f * f, 1.);   // through black
    }`, { a: { value: null }, b: { value: null }, k: { value: 0 }, mode: { value: 0 }, dir: { value: new THREE.Vector2(1, 0) }, res: { value: new THREE.Vector2(RW, RH) } });

  // --- bloom
  const bright = pass(`uniform sampler2D t; uniform float th; varying vec2 vUv;
    ${NN} void main(){ vec3 c = nn(texture2D(t, vUv).rgb); float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th + .3, l), 1.); }`, { t: { value: null }, th: { value: .8 } });
  const blur = pass(`uniform sampler2D t; uniform vec2 d; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb * .2270; c += (texture2D(t, vUv + d * 1.3846).rgb + texture2D(t, vUv - d * 1.3846).rgb) * .3162; c += (texture2D(t, vUv + d * 3.2308).rgb + texture2D(t, vUv - d * 3.2308).rgb) * .0703; gl_FragColor = vec4(c, 1.); }`,
  { t: { value: null }, d: { value: new THREE.Vector2() } });
  const copy = pass(`${NN} uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(nn(texture2D(t, vUv).rgb), 1.); }`, { t: { value: null } });

  const P = SETTINGS.post || {};
  const final = pass(`uniform sampler2D tS, tBl, tBl2, tO; uniform vec2 tx; uniform float sharpen, ca, bloom, vig, flash, sat, bright, contrast, grain, time, hasO, aspect, grey, fade; uniform vec3 tint, lift, vigColor;
    varying vec2 vUv;
    ${NN}
    vec3 sceneAt(vec2 uv){
      vec3 c = nn(texture2D(tS, uv).rgb);
      vec3 b = (nn(texture2D(tS, uv + vec2(tx.x, 0.)).rgb) + nn(texture2D(tS, uv - vec2(tx.x, 0.)).rgb) + nn(texture2D(tS, uv + vec2(0., tx.y)).rgb) + nn(texture2D(tS, uv - vec2(0., tx.y)).rgb)) * .25;
      c = max(c + sharpen * 1.5 * (c - b), 0.);
      return c + (texture2D(tBl, uv).rgb * .65 + texture2D(tBl2, uv).rgb * .55) * bloom;
    }
    vec3 toSRGB(vec3 c){ c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
    void main(){
      vec2 d = vUv - .5; vec2 dd = d * vec2(aspect, 1.); float r2 = dot(dd, dd);
      vec2 off = d * ca * tx.x * (4. * r2);
      vec3 c = ca > 0. ? vec3(sceneAt(vUv - off).r, sceneAt(vUv).g, sceneAt(vUv + off).b) : sceneAt(vUv);
      c = c / (1. + max(c - .8, 0.) * .85);                                               // soft shoulder for lamps and bloom
      float l = dot(c, vec3(.2126, .7152, .0722));
      c = mix(vec3(l), c, sat); c = mix(c, vec3(l), grey); c *= tint * bright; c = (c - .5) * contrast + .5 + lift;
      c = mix(c, c * vigColor, vig * smoothstep(.1, .78, r2 * 1.7));
      vec3 s = toSRGB(c);
      if (grain > 0.) { float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + time * 13.7) * 43758.5453) - .5; s += n * grain * (1. - l * .5); }
      if (hasO > .5) { vec4 o = texture2D(tO, vUv); s = mix(s, o.rgb, o.a); }
      s = mix(s, vec3(1.), flash); s *= 1. - fade;
      gl_FragColor = vec4(s, 1.);
    }`, { tS: { value: null }, tBl: { value: null }, tBl2: { value: null }, tO: { value: null }, tx: { value: new THREE.Vector2(1 / RW, 1 / RH) }, sharpen: { value: +(P.sharpen ?? .12) }, ca: { value: +(P.ca ?? .25) },
    bloom: { value: +(P.bloom ?? .3) }, vig: { value: +(P.vignette ?? .25) }, flash: { value: 0 }, sat: { value: 1 }, bright: { value: 1 }, contrast: { value: 1 }, fade: { value: 0 },
    grain: { value: +(P.grain ?? 0) }, time: { value: 0 }, hasO: { value: 0 }, aspect: { value: FW / FH }, grey: { value: 0 }, tint: { value: new THREE.Vector3(1, 1, 1) }, lift: { value: new THREE.Vector3(0, 0, 0) }, vigColor: { value: new THREE.Vector3(.18, .12, .16) } });
  const th = +(P.threshold ?? .82);
  const run = (p, to) => { renderer.setRenderTarget(to); renderer.render(p.s, CAM); };

  return {
    rtA, rtB, rtDA, rtDB, rtMix, final,
    /** depth of field of a drawn shot (rt with depth) into `to`. dof: { focus (m), aperture, on } */
    dof(rt, cam, dof, to) {
      const amt = +(SETTINGS.post?.dof ?? 1) * (dof?.amount ?? 1);
      if (!dof || dof.on === false || amt <= .001) { copy.m.uniforms.t.value = rt.texture; run(copy, to); return; }
      for (const p of [cocP, dofMix]) { const u = p.m.uniforms; u.tD.value = rt.depthTexture; u.near.value = cam.near; u.far.value = cam.far; u.focus.value = dof.focus; u.aperture.value = (dof.aperture ?? .12) * amt; u.maxCoc.value = 1; }
      cocP.m.uniforms.tC.value = rt.texture; run(cocP, rtHalf);
      gather.m.uniforms.t.value = rtHalf.texture; gather.m.uniforms.radius.value = (dof.radius ?? 16) * Math.min(1.4, amt) * (RH / 1920) * 2; run(gather, rtHalfB);
      dofMix.m.uniforms.tC.value = rt.texture; dofMix.m.uniforms.tB.value = rtHalfB.texture; dofMix.m.uniforms.on.value = 1; run(dofMix, to);
    },
    /** mix of two finished shots into `to` (mode: 0 copy, 1 dissolve, 2 whip, 3 zoom-through, 4 push, 5 flash-cut, 6 black) */
    mix(a, b, k, mode, to, dir = [1, 0]) {
      const u = mix.m.uniforms; u.a.value = a.texture; u.b.value = (b || a).texture; u.k.value = k; u.mode.value = mode; u.dir.value.set(dir[0], dir[1]);
      run(mix, to);
    },
    /** bloom + the full-size pass to the screen */
    finish(src, grade, overlayTex, t) {
      const bl = +(grade.bloom ?? SETTINGS.post?.bloom ?? .3);
      if (bl > 0) {
        bright.m.uniforms.t.value = src.texture; bright.m.uniforms.th.value = grade.threshold ?? th; run(bright, rtBr);
        let from = rtBr; for (const [d, to] of [[[1, 0], rtBl1], [[0, 1], rtBl2], [[2, 0], rtBl1], [[0, 2], rtBl2]]) { blur.m.uniforms.t.value = from.texture; blur.m.uniforms.d.value.set(d[0] / bw, d[1] / bh); run(blur, to); from = to; }
        from = rtBl2; for (const [d, to] of [[[1.5, 0], rtBl3], [[0, 1.5], rtBl4], [[3, 0], rtBl3], [[0, 3], rtBl4]]) { blur.m.uniforms.t.value = from.texture; blur.m.uniforms.d.value.set(d[0] / bw2, d[1] / bh2); run(blur, to); from = to; }
      }
      const u = final.m.uniforms;
      u.tS.value = src.texture; u.tBl.value = rtBl2.texture; u.tBl2.value = rtBl4.texture; u.bloom.value = bl; u.time.value = t;
      u.flash.value = grade.flash || 0; u.sat.value = grade.sat ?? 1; u.bright.value = grade.bright ?? 1; u.contrast.value = grade.contrast ?? 1; u.grey.value = grade.grey ?? 0; u.fade.value = grade.fade ?? 0;
      u.tint.value.set(...(grade.tint || [1, 1, 1])); u.lift.value.set(...(grade.lift || [0, 0, 0])); u.vig.value = grade.vignette ?? +(SETTINGS.post?.vignette ?? .25);
      u.tO.value = overlayTex; u.hasO.value = overlayTex ? 1 : 0;
      renderer.setRenderTarget(null); run(final, null);
    },
  };
}

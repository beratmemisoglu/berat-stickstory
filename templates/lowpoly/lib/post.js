// The look: 3D drawn at a low internal resolution (270 x 480 / 320 x 568 ...), bloom, then one full-size pass that scales it
// up bilinear, unsharp-sharpens it (the halos of the analysed channels), adds chromatic aberration, vignette, the grade,
// optional PS1 dither, and lays the 2D overlay (captions, callouts, UI) on top. Transitions and split screens mix at the
// low resolution, as a game capture would.
import { THREE, SETTINGS, RW, RH, FW, FH, MOODY } from './core.js';

const quad = new THREE.PlaneGeometry(2, 2);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
export function makeRT(w, h, o = {}) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: o.depth !== false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace; return rt;
}
function pass(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: frag, depthTest: false, depthWrite: false });
  const s = new THREE.Scene(); s.add(new THREE.Mesh(quad, m)); return { m, s };
}
const CAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export function createPost(renderer, outW, outH) {
  const rtA = makeRT(RW, RH), rtB = makeRT(RW, RH), rtP1 = makeRT(RW, RH), rtP2 = makeRT(RW, RH), rtMix = makeRT(RW, RH);
  const bw = Math.max(32, RW >> 1), bh = Math.max(32, RH >> 1), rtBr = makeRT(bw, bh, { depth: false }), rtBl1 = makeRT(bw, bh, { depth: false }), rtBl2 = makeRT(bw, bh, { depth: false });
  // transitions / split / copy at the low resolution
  const mix = pass(`uniform sampler2D a, b; uniform float k, mode, seed; uniform vec2 dir, res; varying vec2 vUv;
    float h(float x){ return fract(sin(x * 91.17 + seed) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec4 A, B;
      if (mode < .5) { gl_FragColor = texture2D(a, uv); return; }                                   // copy
      if (mode < 1.5) {                                                                              // push: the new shot pushes the old one out (hard edge)
        float e = k * k * (3. - 2. * k); vec2 o = dir * e;
        vec2 ua = uv + o, ub = uv + o - dir;
        bool inB = ub.x >= 0. && ub.x <= 1. && ub.y >= 0. && ub.y <= 1.;
        gl_FragColor = inB ? texture2D(b, ub) : texture2D(a, ua); return; }
      if (mode < 2.5) {                                                                              // blinds: strips of the new shot rise at different speeds
        float n = 7., i = floor(uv.x * n), d = .45 * h(i), e = clamp((k - d) / (1. - d), 0., 1.); e = 1. - pow(1. - e, 3.);
        gl_FragColor = (1. - uv.y) < e ? texture2D(b, vec2(uv.x, uv.y + (1. - e))) : texture2D(a, uv); return; }
      if (mode < 3.5) { gl_FragColor = k < .5 ? texture2D(a, uv) : texture2D(b, uv); return; }       // flash: a cut (the white comes from the final pass)
      if (mode < 4.5) {                                                                              // mosaic dissolve: blocks grow, the picture changes, blocks shrink
        float s = 1. + 22. * sin(k * 3.14159); vec2 q = (floor(uv * res / s) + .5) * s / res;
        gl_FragColor = k < .5 ? texture2D(a, q) : texture2D(b, q); return; }
      if (mode < 5.5) { float f = k < .5 ? 1. - k * 2. : (k - .5) * 2.; gl_FragColor = vec4((k < .5 ? texture2D(a, uv) : texture2D(b, uv)).rgb * f * f, 1.); return; }   // through black
      if (mode < 6.5) { gl_FragColor = mix(texture2D(a, uv), texture2D(b, uv), k * k * (3. - 2. * k)); return; }   // dissolve / double exposure
      // split screens: 7 horizontal halves (a on top), 8 vertical halves (a left), 9 diagonal with a white line
      if (mode < 7.5) { gl_FragColor = uv.y > .5 ? texture2D(a, vec2(uv.x, uv.y - .25)) : texture2D(b, vec2(uv.x, uv.y + .25)); if (abs(uv.y - .5) < 1.5 / res.y) gl_FragColor = vec4(1.); return; }
      if (mode < 8.5) { gl_FragColor = uv.x < .5 ? texture2D(a, vec2(uv.x + .25, uv.y)) : texture2D(b, vec2(uv.x - .25, uv.y)); if (abs(uv.x - .5) < 1.5 / res.x) gl_FragColor = vec4(1.); return; }
      float s = (uv.x - .5) * res.x / res.y * .55 + (uv.y - .5); bool top = s > 0.;
      gl_FragColor = top ? texture2D(a, uv + vec2(0., .22)) : texture2D(b, uv - vec2(0., .22)); if (abs(s) < 2. / res.y) gl_FragColor = vec4(1.);
    }`, { a: { value: null }, b: { value: null }, k: { value: 0 }, mode: { value: 0 }, dir: { value: new THREE.Vector2(0, 1) }, res: { value: new THREE.Vector2(RW, RH) }, seed: { value: 1 } });
  const bright = pass(`uniform sampler2D t; uniform float th; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th + .25, l), 1.); }`, { t: { value: null }, th: { value: .8 } });
  const blur = pass(`uniform sampler2D t; uniform vec2 d; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb * .2270; c += (texture2D(t, vUv + d * 1.3846).rgb + texture2D(t, vUv - d * 1.3846).rgb) * .3162; c += (texture2D(t, vUv + d * 3.2308).rgb + texture2D(t, vUv - d * 3.2308).rgb) * .0703; gl_FragColor = vec4(c, 1.); }`,
    { t: { value: null }, d: { value: new THREE.Vector2() } });
  const P = SETTINGS.post || {};
  const final = pass(`uniform sampler2D tS, tBl, tO; uniform vec2 tx; uniform float sharpen, ca, bloom, vig, flash, sat, bright, contrast, dither, grain, time, hasO, aspect, grey; uniform vec3 tint, lift;
    varying vec2 vUv;
    vec3 sceneAt(vec2 uv){
      vec3 c = texture2D(tS, uv).rgb;
      vec3 b = (texture2D(tS, uv + vec2(tx.x, 0.)).rgb + texture2D(tS, uv - vec2(tx.x, 0.)).rgb + texture2D(tS, uv + vec2(0., tx.y)).rgb + texture2D(tS, uv - vec2(0., tx.y)).rgb) * .25;
      c = max(c + sharpen * 1.7 * (c - b), 0.);
      return c + texture2D(tBl, uv).rgb * bloom;
    }
    vec3 toSRGB(vec3 c){ c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
    float bayer(vec2 p){ vec2 q = mod(floor(p), 4.); float i = q.x + q.y * 4.;
      return mod(i * 7. + floor(i / 4.) * 3., 16.) / 16.; }
    void main(){
      vec2 d = vUv - .5; vec2 dd = d * vec2(aspect, 1.); float r2 = dot(dd, dd);
      vec2 off = d * ca * tx.x * (1.2 + 6. * r2);
      vec3 c = vec3(sceneAt(vUv - off).r, sceneAt(vUv).g, sceneAt(vUv + off).b);
      c = c / (1. + max(c - .85, 0.) * .9);                                              // soft shoulder for lamps and bloom
      float l = dot(c, vec3(.299, .587, .114));
      c = mix(vec3(l), c, sat); c = mix(c, vec3(l), grey); c *= tint * bright; c = (c - .5) * contrast + .5 + lift;
      c *= 1. - vig * smoothstep(.12, .72, r2 * 1.9);
      vec3 s = toSRGB(c);
      if (dither > .5) { float b = bayer(gl_FragCoord.xy / max(1., floor(${(FW / 1080).toFixed(3)} * 4.))) - .5; s = floor(s * 31. + .5 + b) / 31.; }
      if (grain > 0.) { float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + time * 13.7) * 43758.5453) - .5; s += n * grain; }
      if (hasO > .5) {                                                                   // the overlay, with a lighter fringe
        vec2 o2 = off * .55; vec4 og = texture2D(tO, vUv); float ar = texture2D(tO, vUv - o2).a, ab = texture2D(tO, vUv + o2).a;
        vec3 orr = vec3(texture2D(tO, vUv - o2).r, og.g, texture2D(tO, vUv + o2).b);
        s = mix(s, orr, vec3(ar, og.a, ab));
      }
      s = mix(s, vec3(1.), flash);
      gl_FragColor = vec4(s, 1.);
    }`, { tS: { value: null }, tBl: { value: null }, tO: { value: null }, tx: { value: new THREE.Vector2(1 / RW, 1 / RH) }, sharpen: { value: +(P.sharpen ?? .3) }, ca: { value: +(P.ca ?? .3) },
    bloom: { value: +(P.bloom ?? .2) }, vig: { value: +(P.vignette ?? 0) }, flash: { value: 0 }, sat: { value: 1 }, bright: { value: 1 }, contrast: { value: 1 }, dither: { value: SETTINGS.ps1?.dither ? 1 : 0 },
    grain: { value: +(P.grain ?? 0) }, time: { value: 0 }, hasO: { value: 0 }, aspect: { value: FW / FH }, grey: { value: 0 }, tint: { value: new THREE.Vector3(1, 1, 1) }, lift: { value: new THREE.Vector3(0, 0, 0) } });
  const th = +(P.threshold ?? (MOODY ? .72 : .88));
  return {
    rtA, rtB, rtP1, rtP2, rtMix, final,
    /** low-res mix of two images into `to` (mode: 0 copy, 1 push, 2 blinds, 3 flash-cut, 4 mosaic, 5 black, 6 dissolve, 7/8/9 split) */
    mix(a, b, k, mode, to, dir = [0, 1]) {
      mix.m.uniforms.a.value = a.texture; mix.m.uniforms.b.value = (b || a).texture; mix.m.uniforms.k.value = k; mix.m.uniforms.mode.value = mode; mix.m.uniforms.dir.value.set(dir[0], dir[1]);
      renderer.setRenderTarget(to); renderer.render(mix.s, CAM);
    },
    /** bloom + the full-size pass to the screen */
    finish(src, grade, overlayTex, t) {
      const bl = +(SETTINGS.post?.bloom ?? .2);
      if (bl > 0) {
        bright.m.uniforms.t.value = src.texture; bright.m.uniforms.th.value = th; renderer.setRenderTarget(rtBr); renderer.render(bright.s, CAM);
        let from = rtBr; for (const [d, to] of [[[1, 0], rtBl1], [[0, 1], rtBl2], [[2, 0], rtBl1], [[0, 2], rtBl2]]) { blur.m.uniforms.t.value = from.texture; blur.m.uniforms.d.value.set(d[0] / bw, d[1] / bh); renderer.setRenderTarget(to); renderer.render(blur.s, CAM); from = to; }
      }
      const u = final.m.uniforms;
      u.tS.value = src.texture; u.tBl.value = rtBl2.texture; u.bloom.value = bl; u.time.value = t;
      u.flash.value = grade.flash || 0; u.sat.value = grade.sat ?? 1; u.bright.value = grade.bright ?? 1; u.contrast.value = grade.contrast ?? 1; u.grey.value = grade.grey ?? 0;
      u.tint.value.set(...(grade.tint || [1, 1, 1])); u.lift.value.set(...(grade.lift || [0, 0, 0])); u.vig.value = grade.vignette ?? +(SETTINGS.post?.vignette ?? 0);
      u.tO.value = overlayTex; u.hasO.value = overlayTex ? 1 : 0;
      renderer.setRenderTarget(null); renderer.render(final.s, CAM);
    },
  };
}

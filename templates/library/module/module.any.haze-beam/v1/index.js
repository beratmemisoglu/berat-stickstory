// module.any.haze-beam v1 - a soft cone of hazy light under a lamp (the café pendants): additive, no depth write, fading
// where the cone turns edge-on to the camera and towards its foot. Cheap stand-in for volumetric light.
// Contract: imports only THREE from the project's engine.js.
import { THREE } from '../../engine.js';

let BEAM = null;   // alpha along the cone's height: bright under the lamp, gone by the bottom (shared, drawn once)
function beamTex() {
  if (BEAM) return BEAM;
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#fff'); g.addColorStop(.35, '#777'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  BEAM = new THREE.CanvasTexture(c); return BEAM;
}

// hazeMaterial(color, k): k = strength (.1-.2 reads as haze in a dark room; more turns into a solid cone)
export function hazeMaterial(color = 0xffc890, k = .15) {
  const m = new THREE.ShaderMaterial({ uniforms: { col: { value: new THREE.Color(color) }, k: { value: k }, amap: { value: beamTex() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 col; uniform float k; uniform sampler2D amap; varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = k * pow(f, 2.2) * texture2D(amap, vUv).g; gl_FragColor = vec4(col * a, a); }' });
  return m;
}

// hazeCone(top, toY, o): an open cone from a lamp at `top` ([x, y, z]) down to height toY; o.r lamp radius (.2),
// o.spread (.52: bottom radius per metre of height), o.color, o.k. Marked noContact (it is light, not a thing).
export function hazeCone(top, toY = .8, o = {}) {
  const h = top[1] - toY, r = o.r ?? .2, cone = new THREE.Mesh(new THREE.ConeGeometry(h * (o.spread ?? .52) + r, h, 40, 1, true), hazeMaterial(o.color ?? 0xffc890, o.k ?? .15));
  cone.position.set(top[0], top[1] - h / 2, top[2]); cone.name = 'light haze'; cone.castShadow = cone.receiveShadow = false;
  cone.userData.noContact = true; cone.userData.noPick = true; return cone;
}

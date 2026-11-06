// Set basics: light rigs, sky domes, floors, rooms, fog. The studied look: soft toon shading with a warm key, a cool fill,
// a rim from behind, soft shadows, bloom on every practical lamp, vignette; interiors pool light under a lamp, nights are
// blue with neon. Dressing (props) comes from lib/props.js; whole places from lib/places.js.
import { THREE, C, hex, shade, canvasTex, rnd } from './core.js';
import { toonMat } from './rig.js';
import { addOutline } from './geo.js';

export const RIGS = {
  //           key colour, key int, key dir [x,y,z], fill colour, fill int, rim colour, rim int, hemi sky, hemi ground, hemi int, exposure
  studio:   { key: '#fff1dc', ki: 2.4, kd: [3, 6, 4], fill: '#bcd2ff', fi: .55, rim: '#ffffff', ri: 1.1, sky: '#dfe9ff', gnd: '#8a7a6a', hi: .55 },
  interior: { key: '#ffd9a8', ki: 2.2, kd: [2.5, 5, 3], fill: '#9fb4e8', fi: .5, rim: '#ffe6c0', ri: 1.2, sky: '#d9d2c4', gnd: '#5a4636', hi: .5 },
  day:      { key: '#fff4e0', ki: 2.9, kd: [6, 9, 5], fill: '#a9cfff', fi: .6, rim: '#ffffff', ri: .9, sky: '#bfe3ff', gnd: '#c9b48a', hi: .75 },
  sunset:   { key: '#ffb46b', ki: 2.6, kd: [-6, 3, 4], fill: '#7f8fe0', fi: .55, rim: '#ffd0a0', ri: 1.4, sky: '#ffcf9e', gnd: '#5a3c4a', hi: .45 },
  night:    { key: '#a8c4ff', ki: 1.1, kd: [-3, 6, 4], fill: '#3c4f9a', fi: .45, rim: '#9fd8ff', ri: 1.3, sky: '#28356b', gnd: '#141020', hi: .35 },
  bulb:     { key: '#ffc985', ki: 0, kd: [0, 6, 0], fill: '#3a4670', fi: .18, rim: '#ffd7a0', ri: .6, sky: '#3a3530', gnd: '#141010', hi: .16 },
  neon:     { key: '#c9b6ff', ki: .6, kd: [2, 6, 4], fill: '#3a2a7a', fi: .4, rim: '#ff5fc0', ri: 1.6, sky: '#3b2a6a', gnd: '#0c0818', hi: .3 },
  underwater:{ key: '#c8f2ff', ki: 1.6, kd: [0, 8, 2], fill: '#7fb4d8', fi: .9, rim: '#6fd8ff', ri: 1, sky: '#5fb0dc', gnd: '#2a6080', hi: .95 },   // warm colours must stay readable (a yellow sub reads yellow)
  space:    { key: '#fff6e8', ki: 3, kd: [-5, 3, 4], fill: '#2a3a6a', fi: .25, rim: '#9fc8ff', ri: 1.6, sky: '#141a33', gnd: '#000000', hi: .12 },
  alarm:    { key: '#ff5a4a', ki: 2.2, kd: [2, 6, 3], fill: '#6a1a2a', fi: .5, rim: '#ff8a7a', ri: 1.2, sky: '#5a1a22', gnd: '#200808', hi: .4 },
};
/** S.light('interior' | 'day' | ..., { shadows, target, key: '#hex', ki, at: [x,z] }) */
export function light(S, kind = 'studio', o = {}) {
  const R = { ...(RIGS[kind] || RIGS.studio), ...o };
  const g = new THREE.Group(); g.name = 'light:' + kind;
  const hemi = new THREE.HemisphereLight(R.sky, R.gnd, R.hi); g.add(hemi);
  const key = new THREE.DirectionalLight(R.key, R.ki);
  const c = new THREE.Vector3(...(o.at ? [o.at[0], 0, o.at[1]] : [0, 0, 0]));
  key.position.copy(c).add(new THREE.Vector3(...R.kd)); key.target.position.copy(c); g.add(key, key.target);
  if (o.shadows !== false && R.ki > 0) {
    key.castShadow = true; const s = key.shadow; s.mapSize.set(2048, 2048); s.bias = -.0004; s.normalBias = .02; s.radius = 6;
    const ext = o.shadowSize ?? 6; s.camera.left = -ext; s.camera.right = ext; s.camera.top = ext; s.camera.bottom = -ext; s.camera.near = .5; s.camera.far = 40;
  }
  const fill = new THREE.DirectionalLight(R.fill, R.fi); fill.position.copy(c).add(new THREE.Vector3(-R.kd[0] * .8, R.kd[1] * .4, R.kd[2] * 1.2)); g.add(fill);
  const rim = new THREE.DirectionalLight(R.rim, R.ri); rim.position.copy(c).add(new THREE.Vector3(-R.kd[0] * .3, R.kd[1] * .6, -8)); g.add(rim);
  S.scene.add(g); (S._lights ??= []).push(g); S.rig = { kind, key, fill, rim, hemi };
  return S.rig;
}
/** a sky dome: two colours (top, horizon) or a preset; o.tex: an image (equirect/panorama) */
const SKIES = { day: ['#4a9be0', '#cfeaff'], dusk: ['#2c3a78', '#ff9e6b'], night: ['#060a1c', '#1d2b58'], interior: ['#2a2622', '#3a342e'], storm: ['#3b4250', '#7d8794'], space: ['#02030a', '#0b1030'], underwater: ['#0a3a66', '#2f9bd0'], dawn: ['#6b7fd0', '#ffd2a0'], neon: ['#120a2a', '#3a1a5a'] };
export function sky(S, kind = 'day', o = {}) {
  const [top, hor] = Array.isArray(kind) ? kind : SKIES[kind] || SKIES.day;
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(hor) }, sun: { value: new THREE.Vector3(...(o.sun || [.4, .35, -.85])).normalize() }, sunOn: { value: o.sunGlow ?? (kind === 'day' || kind === 'dusk' || kind === 'dawn' ? 1 : 0) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 top, hor, sun; uniform float sunOn; varying vec3 vD;
      void main(){ float h = clamp(vD.y, -.2, 1.); vec3 c = mix(hor, top, pow(smoothstep(-.05, .85, h), .8));
        float s = max(dot(normalize(vD), sun), 0.); c += sunOn * (pow(s, 40.) * .8 + pow(s, 6.) * .18) * vec3(1., .9, .7);
        gl_FragColor = vec4(c, 1.); }` });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(o.r ?? 180, 32, 16), m); dome.userData.noPick = true; dome.userData.ground = true; dome.renderOrder = -10;
  S.scene.add(dome); S.scene.background = new THREE.Color(hor);
  if (kind === 'night' || kind === 'space' || o.stars) S.scene.add(stars(o.starCount ?? (kind === 'space' ? 1800 : 600)));
  return dome;
}
export function stars(n = 600, r = 150, seed = 3) {
  const R = rnd(seed), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * s * r, Math.abs(u) * r * .9 + 5, Math.sin(a) * s * r], i * 3); const w = .6 + R() * .4; col.set([w, w, w * (.9 + R() * .1)], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .9, depthWrite: false }));
  p.userData.noPick = true; return p;
}
/** fog: colour + near/far in metres (or a preset) */
export function fog(S, color = '#cfe3f2', near = 12, far = 60) { S.scene.fog = new THREE.Fog(hex(color), near, far); return S.scene.fog; }

// ---------- surfaces: painted procedural textures (wood planks, tiles, carpet, concrete, grass, sand, wallpaper) ----------
const SURF = new Map();
export function surface(kind, o = {}) {
  const key = kind + JSON.stringify(o); if (SURF.has(key)) return SURF.get(key);
  const R = rnd(o.seed ?? 7), N = 512;
  const t = canvasTex(N, N, (x, w, h) => {
    const base = o.color || { wood: C.wood, tiles: '#e9e4d8', carpet: '#7a3a3a', concrete: '#9a9a96', grass: C.grass, sand: C.sand, wallpaper: '#d9c9a8', plaster: '#e6dccb', asphalt: '#3a3a40', checker: '#e9e4d8', metal: '#8f98a3', water: C.sea }[kind] || '#cccccc';
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    if (kind === 'wood') { for (let i = 0; i < 6; i++) { x.fillStyle = shade(base, (R() - .5) * .12); x.fillRect(0, i * h / 6, w, h / 6 - 3); x.fillStyle = shade(base, -.35); x.fillRect(0, i * h / 6 + h / 6 - 3, w, 3); for (let k = 0; k < 9; k++) { x.strokeStyle = shade(base, -.1 - R() * .1); x.globalAlpha = .35; x.lineWidth = 1 + R() * 2; const y = i * h / 6 + R() * h / 6; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * .3, y + (R() - .5) * 8, w * .6, y + (R() - .5) * 8, w, y + (R() - .5) * 6); x.stroke(); } x.globalAlpha = 1; x.fillStyle = shade(base, -.35); x.fillRect(((i * 197) % 5) / 5 * w, i * h / 6, 3, h / 6); } }
    else if (kind === 'tiles' || kind === 'checker') { const n = o.n ?? 4, c2 = o.color2 || shade(base, kind === 'checker' ? -.55 : -.06); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = kind === 'checker' ? ((i + j) % 2 ? c2 : base) : shade(base, (R() - .5) * .06); x.fillRect(i * w / n, j * h / n, w / n, h / n); } if (kind === 'tiles') { x.strokeStyle = shade(base, -.25); x.lineWidth = 4; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * w / n, 0); x.lineTo(i * w / n, h); x.stroke(); x.beginPath(); x.moveTo(0, i * h / n); x.lineTo(w, i * h / n); x.stroke(); } } }
    else if (kind === 'grass' || kind === 'sand' || kind === 'concrete' || kind === 'carpet' || kind === 'asphalt' || kind === 'plaster') { const n = kind === 'grass' ? 2600 : 1600; for (let i = 0; i < n; i++) { x.fillStyle = shade(base, (R() - .5) * (kind === 'sand' ? .1 : .18)); x.globalAlpha = .5; const s = kind === 'grass' ? 2 + R() * 3 : 1 + R() * 3; x.fillRect(R() * w, R() * h, s, kind === 'grass' ? s * 2.5 : s); } x.globalAlpha = 1; }
    else if (kind === 'wallpaper') { x.fillStyle = shade(base, -.08); for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 22, h); x.fillStyle = shade(base, .06); for (let i = 32; i < w; i += 64) for (let j = 16; j < h; j += 48) { x.beginPath(); x.arc(i + 11, j, 5, 0, Math.PI * 2); x.fill(); } }
    else if (kind === 'metal') { for (let i = 0; i < 400; i++) { x.strokeStyle = shade(base, (R() - .5) * .15); x.globalAlpha = .4; x.beginPath(); const y = R() * h; x.moveTo(0, y); x.lineTo(w, y + (R() - .5) * 4); x.stroke(); } x.globalAlpha = 1; }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...(o.repeat || [4, 4]));
  SURF.set(key, t); return t;
}
/** a floor: { size: [w, d] | r (disc), kind: 'wood' | 'tiles' | ..., color, repeat, at: [x, z] } */
export function floor(S, o = {}) {
  const geo = o.r ? new THREE.CircleGeometry(o.r, 64) : new THREE.PlaneGeometry(...(o.size || [30, 30]));
  const mat = toonMat(o.color || '#cdbb9a', { map: o.kind ? surface(o.kind, { color: o.color, repeat: o.repeat || [(o.size?.[0] ?? 30) / 2, (o.size?.[1] ?? 30) / 2] }) : null, rough: o.rough ?? .9 });
  if (o.kind) mat.color.set('#ffffff');
  const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(o.at?.[0] ?? 0, o.y ?? 0, o.at?.[1] ?? 0); m.receiveShadow = true; m.userData.ground = true; m.userData.noPick = true;
  S.scene.add(m); return m;
}
/** a room: floor + back walls (corner or three sides) + skirting; { w, d, h, wall, wallKind, floorKind, floor, open: 'front' } */
export function room(S, o = {}) {
  const w = o.w ?? 7, d = o.d ?? 6, h = o.h ?? 3, g = new THREE.Group(); g.name = 'room';
  // the floor, the side walls and a ceiling run `ext` metres past the front so a pulled-back 9:16 camera never sees
  // the void above or around the room (a wide reveal in a tall frame shows a lot of ceiling and floor)
  const ext = o.ext ?? 6, front = o.front ?? 2;
  floor(S, { size: [w, d + ext], kind: o.floorKind || 'wood', color: o.floor, at: [0, -d / 2 + front + ext / 2] });
  S.scene.background = new THREE.Color(shade(o.wall || '#7d8f8a', -.55));
  const wallMat = toonMat(o.wall || '#7d8f8a', { map: o.wallKind ? surface(o.wallKind, { color: o.wall, repeat: [w / 2, h / 2] }) : null, rough: .95 }); if (o.wallKind) wallMat.color.set('#ffffff');
  const z0 = -d + (o.front ?? 2);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); back.position.set(0, h / 2, z0); back.receiveShadow = true; g.add(back);
  for (const s of (o.sides ?? [-1, 1])) { const side = new THREE.Mesh(new THREE.PlaneGeometry(d + ext, h), wallMat); side.position.set(s * w / 2, h / 2, z0 + (d + ext) / 2); side.rotation.y = -s * Math.PI / 2; side.receiveShadow = true; g.add(side); }
  if (o.ceiling !== false) { const cm = toonMat(o.ceilingColor || shade(o.wall || '#7d8f8a', -.25), { rough: 1 }); const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d + ext), cm); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, h, z0 + (d + ext) / 2); g.add(ceil); }
  const skirt = toonMat(o.skirt || shade(o.wall || '#7d8f8a', -.35));
  const sk = new THREE.Mesh(new THREE.BoxGeometry(w, .12, .03), skirt); sk.position.set(0, .06, z0 + .015); g.add(sk); addOutline(sk, C.outline, .004);
  if (o.dado) { const dd = new THREE.Mesh(new THREE.BoxGeometry(w, .05, .03), skirt); dd.position.set(0, h * .38, z0 + .015); g.add(dd); }
  for (const c of g.children) c.userData.noPick = true;
  S.scene.add(g); S.bounds = { x0: -w / 2, x1: w / 2, z0, z1: z0 + d + ext, h };
  return g;
}
export const SKIN_TONES = ['pale', 'light', 'warm', 'tan', 'brown', 'deep'];

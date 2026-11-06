// PROP KIT + PLACEMENT (3D reconstruction): well-made, pre-verified procedural props, each ONE solid connected piece with a
// known front and known support surfaces, and a placement API that computes where a thing goes (on what holds it, facing
// what it should face, never overlapping), with a PLACEMENT check at check_layout. Docs: the skill's references/props.md.
//   import { prop, place, arrange, PROP_KINDS, propInfo } from '../lib/props.js';
//   const desk = place(S, prop('desk'), { at: [0, -2], face: 'camera' | [x, z] | object | degrees });
//   arrange.desk(S, desk, { sitter: chair, items: ['monitor', 'keyboard', 'mouse', 'desk lamp', 'mug', 'papers'] });
// PROP CONTRACT (kit props and every prop a designer agent makes): one THREE.Group, origin at the centre of its footprint
// at floor level (lowest point exactly y = 0), FRONT = local +Z, metres, parts overlapping >= 2 mm, no coplanar faces,
// theme materials (engine MAT tiers + the palette below), named parts, and
//   g.userData.prop = { kind, size: [w, h, d], front: [0, 0, 1], tops: [{ name, y, x0, x1, z0, z1, clear?, overhang? }],
//                       seat?: { y, z }, solids?: [{ x0, x1, y0, y1, z0, z1 }], mount: 'floor' | 'surface' | 'wall' | 'ceiling' }
import { THREE, MAT, THEME_ID, IMG, selectable } from '../engine.js';
import * as ENG from '../engine.js';
import { RoundedBoxGeometry } from '../vendor/jsm/geometries/RoundedBoxGeometry.js';
import { rest as handsRest } from './hands.js';   // (sitOn: seated at a table, the hands rest on it; hands.js does not import props.js)

const INV = THEME_ID === 'investigation';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const hh = (i, n = 0) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
const r4 = v => Math.round(v * 1e4) / 1e4;

// ---------- shared geometry + materials (hundreds of instances share them) ----------
const GEO = new Map();
const cache = (k, f) => { let g = GEO.get(k); if (!g) { g = f(); GEO.set(k, g); } return g; };
const rb = (w, h, d, r = .004, s = 2) => cache(`b${r4(w)},${r4(h)},${r4(d)},${r4(r)},${s}`, () => new RoundedBoxGeometry(w, h, d, s, Math.max(1e-4, Math.min(r, w / 2 - 5e-4, h / 2 - 5e-4, d / 2 - 5e-4))));
const sb = (w, h, d) => cache(`s${r4(w)},${r4(h)},${r4(d)}`, () => new THREE.BoxGeometry(w, h, d));       // sharp box: 6 material groups (+x -x +y -y +z -z)
const cyl = (rt, rbm, h, seg = 20) => cache(`c${r4(rt)},${r4(rbm)},${r4(h)},${seg}`, () => new THREE.CylinderGeometry(rt, rbm, h, seg));
const sph = (r, ws = 16, hs = 10) => cache(`o${r4(r)},${ws}`, () => new THREE.SphereGeometry(r, ws, hs));
const tor = (R, r, arc = Math.PI * 2, ts = 24) => cache(`t${r4(R)},${r4(r)},${r4(arc)}`, () => new THREE.TorusGeometry(R, r, 8, ts, arc));
const ico = (r, d = 1) => cache(`i${r4(r)},${d}`, () => new THREE.IcosahedronGeometry(r, d));
// a closed lathe: the profile [[r, y], ...] starts and ends on the axis (r = 0)
const lathe = (key, pts, seg = 28) => cache(`L${key},${seg}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));
const MATS = new Map();
export const mat = (hex, rough = .8, metal = 0) => { const k = `${hex}|${rough}|${metal}`; let m = MATS.get(k); if (!m) { m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }); MATS.set(k, m); } return m; };
const hexOf = c => c == null ? null : typeof c === 'number' ? c : new THREE.Color(c).getHex();
// the palette: Studio = matte light clay with soft material hints; Investigation = the dark porcelain/clay greys
const PAL = INV
  ? { wood: 0x6b5847, woodDark: 0x4a3d33, metal: 0x80858b, black: 0x16171a, fabric: 0x3e444c, fabric2: 0x34404e, paper: 0xc6c9cc, leaf: 0x48604c, soil: 0x231e1a,
      red: 0x8a1d1f, card: 0x6d5a45, tape: 0x8a7658, glass: 0x5f6d78, ceramic: 0xb5b8bb, chrome: 0x9aa0a6, cork: 0x7a6247, white: 0xc9ccd0,
      books: [0x3c4f6b, 0x6b3a36, 0x4c5a3e, 0x6b5c3a, 0x4a4560, 0x5d5a55, 0x34393f, 0x7a6a52] }
  : { wood: 0xd8c6ad, woodDark: 0xb59e82, metal: 0xc4c7ca, black: 0x2a2d31, fabric: 0xb3b8be, fabric2: 0x8f9aa8, paper: 0xf4f2ec, leaf: 0xa3b897, soil: 0x6e6152,
      red: 0xc8463e, card: 0xcdb08a, tape: 0xe2cfa6, glass: 0xd2dee5, ceramic: 0xf6f5f2, chrome: 0xd9dcdf, cork: 0xc9a77f, white: 0xfbfbf9,
      books: [0x8fa7c9, 0xc98f86, 0xb8c49a, 0xd9c08a, 0x9d93b8, 0xcfcac0, 0x7f8c95, 0xb79a7c] };
const M = {
  body: () => MAT.clay, body2: () => MAT.clay2, body3: () => MAT.clay3, dark: () => MAT.dark,
  wood: () => mat(PAL.wood, .75), woodDark: () => mat(PAL.woodDark, .75), metal: () => mat(PAL.metal, .35, .45), black: () => mat(PAL.black, .45),
  fabric: () => mat(PAL.fabric, .95), fabric2: () => mat(PAL.fabric2, .95), paper: () => mat(PAL.paper, .95), leaf: () => mat(PAL.leaf, .85), soil: () => mat(PAL.soil, 1),
  red: () => mat(PAL.red, .45), card: () => mat(PAL.card, .9), tape: () => mat(PAL.tape, .5), glass: () => mat(PAL.glass, .08, .1), ceramic: () => mat(PAL.ceramic, .35),
  chrome: () => mat(PAL.chrome, .22, .75), cork: () => mat(PAL.cork, 1), white: () => mat(PAL.white, .6),
};
// o.color / o.tint: the prop's main material (any CSS colour or hex); else the kind's default
const main = (o, def, rough = .8) => { const c = hexOf(o.color ?? o.tint); return c != null ? mat(c, rough) : def(); };

// ---------- canvas textures (drawn once, cached) ----------
const TEX = new Map();
function ctex(key, w, h, draw) {
  let t = TEX.get(key); if (t) return t;
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; TEX.set(key, t); return t;
}
// a cached textured material (one per texture key)
const tmat = (key, w, h, draw, rough = .6) => { const k = 'tm:' + key; let m = MATS.get(k); if (!m) { m = new THREE.MeshStandardMaterial({ map: ctex(key, w, h, draw), roughness: rough }); MATS.set(k, m); } return m; };
const SCREENS = {
  desktop: (x, W, H) => { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#5b7fa8'); g.addColorStop(1, '#2c4560'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e9edf1'; x.fillRect(W * .12, H * .14, W * .5, H * .52); x.fillStyle = '#c7d0d9'; x.fillRect(W * .12, H * .14, W * .5, H * .06);
    x.fillStyle = '#f6f7f8'; x.fillRect(W * .45, H * .34, W * .42, H * .44); x.fillStyle = '#d5dbe1'; x.fillRect(W * .45, H * .34, W * .42, H * .06); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, H * .93, W, H * .07); },
  code: (x, W, H) => { x.fillStyle = '#14181e'; x.fillRect(0, 0, W, H); const cs = ['#7fb4e6', '#e6c07f', '#9fd49a', '#d48fb0', '#c9ced6'];
    for (let i = 0; i < 22; i++) { const ind = (hh(i, 3) * 4 | 0) * 18; x.fillStyle = cs[(hh(i, 1) * cs.length) | 0]; x.fillRect(20 + ind, 16 + i * (H - 30) / 22, 40 + hh(i, 2) * (W * .55), 6); } },
  browser: (x, W, H) => { x.fillStyle = '#f4f5f6'; x.fillRect(0, 0, W, H); x.fillStyle = '#d9dde1'; x.fillRect(0, 0, W, H * .09); x.fillStyle = '#ffffff'; x.fillRect(W * .2, H * .025, W * .6, H * .045);
    x.fillStyle = '#9fb1c4'; x.fillRect(W * .08, H * .16, W * .5, H * .3); x.fillStyle = '#3b4148'; x.fillRect(W * .08, H * .52, W * .55, 10);
    for (let i = 0; i < 6; i++) { x.fillStyle = '#aab0b6'; x.fillRect(W * .08, H * .6 + i * H * .055, W * (.5 + hh(i, 4) * .3), 6); }
    x.fillStyle = '#e1e5e9'; x.fillRect(W * .66, H * .16, W * .26, H * .7); },
  cctv: (x, W, H) => { x.fillStyle = '#0b0c0d'; x.fillRect(0, 0, W, H);
    for (let k = 0; k < 4; k++) { const X = (k % 2) * W / 2 + 3, Y = (k / 2 | 0) * H / 2 + 3, w = W / 2 - 6, h = H / 2 - 6, g = x.createLinearGradient(X, Y, X, Y + h);
      g.addColorStop(0, '#5d6266'); g.addColorStop(1, '#2e3134'); x.fillStyle = g; x.fillRect(X, Y, w, h); x.fillStyle = '#3c4044'; x.fillRect(X + w * .1, Y + h * (.45 + hh(k) * .2), w * .8, h * .08);
      x.fillStyle = '#e8e8e8'; x.font = `${Math.round(H / 22)}px monospace`; x.fillText(`CAM 0${k + 1}`, X + 8, Y + H / 20 + 4); } },
  chart: (x, W, H) => { x.fillStyle = '#f7f8f9'; x.fillRect(0, 0, W, H); for (let i = 0; i < 7; i++) { const h = H * (.2 + hh(i, 7) * .55); x.fillStyle = i === 5 ? '#d23b3b' : '#6f8fb5'; x.fillRect(W * (.1 + i * .115), H * .88 - h, W * .08, h); }
    x.fillStyle = '#3b4148'; x.fillRect(W * .08, H * .88, W * .84, 3); },
  red: (x, W, H) => { x.fillStyle = '#5a0a0e'; x.fillRect(0, 0, W, H); x.fillStyle = '#ff3b3b'; x.fillRect(W * .2, H * .4, W * .6, H * .2); },
};
// o.screen: 'off' (default) | 'desktop' | 'code' | 'browser' | 'cctv' | 'chart' | 'red' | fn(ctx, w, h) | canvas | THREE.Texture | IMG key
function screenMat(o, aspect = 16 / 9) {
  const s = o.screen; if (!s || s === 'off') return mat(0x0d0f12, .18, .2);
  let map = null;
  if (s.isTexture) map = s;
  else if (typeof s === 'string' && SCREENS[s]) map = ctex('scr:' + s + aspect.toFixed(2), 512, Math.round(512 / aspect), SCREENS[s]);
  else if (typeof s === 'string' && IMG[s]) { map = new THREE.Texture(IMG[s]); map.needsUpdate = true; map.colorSpace = THREE.SRGBColorSpace; }
  else if (typeof s === 'function') { const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 / aspect); s(c.getContext('2d'), c.width, c.height); map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; }
  else if (s instanceof HTMLCanvasElement) { map = new THREE.CanvasTexture(s); map.colorSpace = THREE.SRGBColorSpace; }
  else map = ctex('scr:desktop' + aspect.toFixed(2), 512, Math.round(512 / aspect), SCREENS.desktop);
  return new THREE.MeshBasicMaterial({ map, color: INV ? 0xd4d4d4 : 0xf2f2f2 });   // a lit screen: unlit, the grade keeps it in range
}

// ---------- part helpers (positions are part CENTRES unless the name says bottom) ----------
function P(g, geo, m, x, y, z, name, rot) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
  o.castShadow = o.receiveShadow = true; o.name = name; o.userData.shared = true; g.add(o); return o;
}
// a rounded box standing on y0 (its bottom), centred on x, z
const Bx = (g, w, h, d, m, x, y0, z, name, r = .004, rot) => P(g, rb(w, h, d, r), m, x, y0 + h / 2, z, name, rot);
// a cylinder from point a to point b
function rod(g, a, b, r, m, name, seg = 12) {
  const A = V(...a), B = V(...b), d = B.clone().sub(A), L = d.length();
  const o = P(g, cyl(r, r, L, seg), m, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, name); o.quaternion.setFromUnitVectors(UP, d.normalize()); return o;
}

// ---------- finish: recentre, measure, write the contract ----------
function finish(g, kind, o, meta = {}) {
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g, true), cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, cy = b.min.y;
  for (const c of g.children) { c.position.x -= cx; c.position.y -= cy; c.position.z -= cz; }
  const sh = r => ({ ...r, y: r4(r.y - cy), x0: r4(r.x0 - cx), x1: r4(r.x1 - cx), z0: r4(r.z0 - cz), z1: r4(r.z1 - cz) });
  const W = b.max.x - b.min.x, H = b.max.y - b.min.y, D = b.max.z - b.min.z;
  g.userData.prop = {
    kind, size: [r4(W), r4(H), r4(D)], front: [0, 0, 1], mount: meta.mount ?? 'floor', box: [-W / 2, W / 2, -D / 2, D / 2],
    tops: (meta.tops || []).map(sh), seat: meta.seat ? { y: r4(meta.seat.y - cy), z: r4(meta.seat.z - cz) } : undefined,
    solids: meta.solids ? meta.solids.map(s => ({ x0: s.x0 - cx, x1: s.x1 - cx, y0: s.y0 - cy, y1: s.y1 - cy, z0: s.z0 - cz, z1: s.z1 - cz })) : undefined,
    holds: meta.holds, ...(meta.extra || {}),
  };
  if (meta.grips) g.userData.prop.grips = shiftGrips(meta.grips, cx, cy, cz);
  if (meta.foot) g.userData.prop.foot = [meta.foot[0] - cx, meta.foot[1] - cx, meta.foot[2] - cz, meta.foot[3] - cz];   // what touches the surface (a lamp's base, not its head)
  if (meta.head) g.userData.prop.head = { at: [meta.head.at[0] - cx, meta.head.at[1] - cy, meta.head.at[2] - cz], dir: meta.head.dir };
  if (meta.noContact) g.userData.noContact = true;
  g.name = o.name ?? kind; selectable(g, g.name, 'prop'); return g;
}
const top = (name, y, x0, x1, z0, z1, x = {}) => ({ name, y, x0, x1, z0, z1, ...x });
// GRIPS (lib/hands.js hold(), references/hands.md): where a hand holds the prop. grip(pos, fingers, palm, o): pos = where the
// palm centre goes (prop-local, built coordinates), fingers = the open fingers' direction, palm = from the palm INTO the
// object; o: { hand 'R'|'L'|'any', pose (hands.js POSES), use (hands.js USES), mirror 'x'|'y'|'z' (the other hand's grip
// is this one mirrored across that axis), second: grip(...) for the other hand of a two-hand hold, clips: the clips it was
// made for }. userData.prop.grips[name] = { ...o, pos, fingers, palm, quat } (finish() moves them with the recentring).
const grip = (pos, fingers, palm, o = {}) => ({ hand: 'any', mirror: 'x', ...o, pos, fingers, palm });
function shiftGrips(grips, cx, cy, cz) {
  const one = gr => { if (!gr) return gr; const F = V(...gr.fingers).normalize(), N = V(...gr.palm); N.addScaledVector(F, -N.dot(F)).normalize(); const X = V().crossVectors(F, N);
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, F, N)).toArray().map(r4);
    return { ...gr, pos: [r4(gr.pos[0] - cx), r4(gr.pos[1] - cy), r4(gr.pos[2] - cz)], fingers: F.toArray().map(r4), palm: N.toArray().map(r4), quat, second: gr.second ? one(gr.second) : undefined }; };
  return Object.fromEntries(Object.entries(grips).map(([k, gr]) => [k, one(gr)]));
}

// =====================================================================================================================
// THE KIT. Each builder: (g, o) -> meta. Typical real dimensions in the comment; o overrides (w, h, d, color, ...).
// =====================================================================================================================
const K = {};
const kit = (kind, size, mount, note, fn) => { K[kind] = { size, mount, note, fn }; };

// desk: front (+Z) = the sitter's side (knee space). o.variant 'office' (metal legs, modesty panel) | 'wooden' (drawer
// pedestal on the right). 140 x 75 x 70 cm.
kit('desk', [1.4, .75, .7], 'floor', 'front = sitter side; o.variant office|wooden', (g, o) => {
  const w = o.w ?? 1.4, h = o.h ?? .75, d = o.d ?? .7, wood = o.variant === 'wooden', tm = main(o, wood ? M.wood : M.body2, .7), t = .03;
  Bx(g, w, t, d, tm, 0, h - t, 0, 'desk top', .006);
  const solids = [{ x0: -w / 2, x1: w / 2, y0: h - t, y1: h, z0: -d / 2, z1: d / 2 }];
  if (!wood) {
    const lm = M.metal();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * (w / 2 - .06), z = sz * (d / 2 - .06); Bx(g, .04, h - t + .004, .04, lm, x, 0, z, 'desk leg', .006); solids.push({ x0: x - .02, x1: x + .02, y0: 0, y1: h, z0: z - .02, z1: z + .02 }); }
    for (const sx of [-1, 1]) Bx(g, .03, .03, d - .12 + .006, lm, sx * (w / 2 - .06), h - t - .03 + .003, 0, 'desk rail', .004);
    Bx(g, w - .152, .34, .015, M.body3(), 0, h - t - .34 + .002, -(d / 2 - .06), 'desk modesty panel', .003);
  } else {
    const pw = .42, px = w / 2 - pw / 2 - .01;
    Bx(g, pw, h - t + .003, d - .02, tm, px, 0, 0, 'desk pedestal', .004); solids.push({ x0: px - pw / 2, x1: px + pw / 2, y0: 0, y1: h, z0: -d / 2, z1: d / 2 });
    for (let i = 0; i < 3; i++) { const dh = (h - t - .06) / 3, y0 = .03 + i * dh;
      Bx(g, pw - .03, dh - .012, .02, M.woodDark(), px, y0 + .006, (d - .02) / 2 + .006, 'desk drawer', .004);
      Bx(g, .12, .016, .02, M.metal(), px, y0 + dh / 2 - .002, (d - .02) / 2 + .02, 'desk handle', .006); }
    Bx(g, .03, h - t + .003, d - .02, tm, -(w / 2 - .025), 0, 0, 'desk side panel', .004); solids.push({ x0: -w / 2, x1: -w / 2 + .04, y0: 0, y1: h, z0: -d / 2, z1: d / 2 });
    Bx(g, w - pw - .05 + .008, .32, .018, tm, .015 - pw / 2, h - t - .32 + .002, -(d / 2 - .04), 'desk modesty panel', .003);
  }
  return { tops: [top('desktop', h, -w / 2, w / 2, -d / 2, d / 2)], solids };
});

// office chair: 5-star base on castors, gas lift, seat, tilted back, armrests. front (+Z) = where the knees point. seat 46 cm.
kit('office chair', [.64, 1.02, .64], 'floor', 'front = seat opening; seat 0.46 m', (g, o) => {
  const sy = o.seat ?? .46, fm = main(o, INV ? M.fabric : M.fabric2, .9), pm = M.black(), mm = M.metal(), R = .3;
  P(g, cyl(.045, .05, .06), pm, 0, .085, 0, 'chair hub');
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + Math.PI / 5, ca = Math.cos(a), sa = Math.sin(a);
    P(g, rb(.3, .035, .045, .01), pm, sa * .15, .08, ca * .15, 'chair leg', [0, a + Math.PI / 2, 0]);
    P(g, cyl(.012, .012, .03, 8), pm, sa * (R - .02), .052, ca * (R - .02), 'chair castor stem');
    P(g, sph(.028, 12, 8), pm, sa * (R - .02), .028, ca * (R - .02), 'chair castor'); }
  P(g, cyl(.024, .024, sy - .15), mm, 0, .1 + (sy - .15) / 2, 0, 'chair gas lift');
  Bx(g, .2, .05, .2, pm, 0, sy - .1, 0, 'chair mechanism', .01);
  Bx(g, .5, .08, .48, fm, 0, sy - .08, .01, 'chair seat', .035, null);
  rod(g, [0, sy - .07, -.08], [0, sy + .13, -.27], .02, pm, 'chair back post');
  P(g, rb(.46, .56, .07, .03), fm, 0, sy + .38, -.29, 'chair back', [-.12, 0, 0]);
  // (arms at +-0.255: at +-0.22 the posts went 11 mm into a seated male mannequin's thighs - charstress office / deskcall)
  for (const sx of [-1, 1]) { P(g, rb(.03, .22, .05, .01), pm, sx * .255, sy + .07, -.02, 'chair arm post');
    Bx(g, .07, .03, .26, pm, sx * .255, sy + .175, .0, 'chair armrest', .012); }
  return { seat: { y: sy, z: .02 }, tops: [top('seat', sy, -.2, .2, -.18, .22, { overhang: true })],
    solids: [{ x0: -R - .01, x1: R + .01, y0: 0, y1: sy + .21, z0: -R - .01, z1: R + .01 }, { x0: -.24, x1: .24, y0: sy, y1: sy + .7, z0: -.36, z1: -.22 }] };
});

// monitor: one piece (base + neck + back housing + panel), screen faces +Z. 24": panel 54 x 32 cm, 45 cm tall.
kit('monitor', [.54, .45, .2], 'surface', 'screen faces +Z; o.screen content', (g, o) => {
  const w = o.w ?? .54, h = o.h ?? .32, bm = main(o, INV ? M.black : M.dark, .45), pz = -.027, py = .1 + h / 2;
  Bx(g, .22, .012, .18, bm, 0, 0, -.03, 'monitor base', .005);
  Bx(g, .05, .3, .025, bm, 0, .008, -.05, 'monitor neck', .008);
  P(g, rb(.3, .2, .04, .012), bm, 0, py, pz - .0125 - .02 + .003, 'monitor back');
  P(g, rb(w, h, .025, .006), bm, 0, py, pz, 'monitor panel');
  const s = P(g, cache(`pl${w}${h}`, () => new THREE.PlaneGeometry(w - .018, h - .018)), screenMat(o, (w - .018) / (h - .018)), 0, py + .001, pz + .0125 + .0012, 'monitor screen'); s.castShadow = false;
  return { mount: 'surface' };
});

// laptop: base + lid on a hinge, screen faces +Z (the user's side). o.open = hinge angle in degrees (0 = closed, default 105).
kit('laptop', [.32, .22, .23], 'surface', 'o.open deg (0 closed); screen faces +Z', (g, o) => {
  const w = .32, d = .22, bt = .018, a = (o.open ?? 105) * D2R, bm = main(o, M.body3, .5);
  Bx(g, w, bt, d, bm, 0, 0, 0, 'laptop base', .006);
  P(g, sb(.28, .002, .1), M.black(), 0, bt - .0005, -.025, 'laptop keyboard');
  P(g, sb(.1, .002, .06), M.body2(), 0, bt - .0005, .065, 'laptop trackpad');
  const piv = new THREE.Group(); piv.position.set(0, a ? bt : bt - .001, -d / 2 + .003); piv.rotation.x = -a; g.add(piv);
  P(piv, rb(w, .008, d, .004), bm, 0, .004, d / 2 - .003, 'laptop lid');
  if (a > .3) { const sc = P(piv, cache('lscr', () => new THREE.PlaneGeometry(w - .03, d - .035)), screenMat(o, (w - .03) / (d - .035)), 0, -.0012, d / 2 - .003, 'laptop screen', [Math.PI / 2, 0, 0]); sc.castShadow = false; }
  P(g, cyl(.006, .006, .26, 10), M.black(), 0, bt, -d / 2 + .003, 'laptop hinge', [0, 0, Math.PI / 2]);
  // carry (closed): pinched on the front edge, hanging upright (its back edge up)
  const g0 = a ? {} : { grips: { carry: grip([0, .013, -d / 2 - .03], [0, 0, 1], [0, -1, 0], { pose: 'edge', use: 'hang', up: [0, 0, -1], contact: ['index', 'thumb'] }) } };
  return { mount: 'surface', tops: a ? [] : [top('lid', bt + .008, -w / 2, w / 2, -d / 2, d / 2, { overhang: true })], ...g0 };
});

// keyboard: front (+Z) = the typist's edge. 44 x 2.5 x 14 cm.
kit('keyboard', [.44, .026, .14], 'surface', 'front = typist edge', (g, o) => {
  const km = main(o, INV ? M.black : M.body, .5);
  Bx(g, .44, .018, .14, km, 0, 0, 0, 'keyboard body', .006);
  const kt = tmat('keys' + THEME_ID, 512, 160, (x, W, H) => { x.fillStyle = INV ? '#121315' : '#c9cbcd'; x.fillRect(0, 0, W, H); x.fillStyle = INV ? '#2b2e33' : '#fbfbfa';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 17; c++) { if (r === 4 && c > 4 && c < 11) continue; x.fillRect(6 + c * 29.6, 6 + r * 30, 25, 25); }
    x.fillRect(6 + 5 * 29.6, 126, 6 * 29.6 - 4, 25); }, .5);
  P(g, sb(.42, .009, .125), [km, km, kt, km, km, km], 0, .018, -.002, 'keyboard keys');
  return { mount: 'surface' };
});

// mouse: front (+Z) = the buttons. 6 x 3.5 x 11 cm.
kit('mouse', [.062, .036, .11], 'surface', 'buttons toward +Z', (g, o) => {
  const mm = main(o, INV ? M.black : M.body, .45);
  Bx(g, .062, .032, .11, mm, 0, 0, 0, 'mouse body', .016);
  P(g, cyl(.008, .008, .006, 12), M.black(), 0, .028, .028, 'mouse wheel', [0, 0, Math.PI / 2]);
  return { mount: 'surface' };
});

// desk lamp: articulated, ONE connected piece: base, joints, twin-rod arms, a shade whose glowing opening points +Z and
// down. o.light = intensity (a SpotLight from the bulb along the head). About 45 cm tall, reach 30 cm.
kit('desk lamp', [.17, .46, .36], 'surface', 'head points +Z and down; o.light', (g, o) => {
  const lm = main(o, INV ? M.black : M.body3, .5), jm = M.metal(), p0 = [0, .036, 0], p1 = [0, .036 + .33 * Math.cos(.26), -.33 * Math.sin(.26)];
  const up = .3, p2 = [0, p1[1] + up * Math.sin(.17), p1[2] + up * Math.cos(.17)], dir = V(0, -Math.sin(50 * D2R), Math.cos(50 * D2R));
  P(g, lathe('lampbase', [[0, 0], [.075, 0], [.077, .006], [.072, .02], [.03, .026], [0, .026]]), lm, 0, 0, 0, 'lamp base');
  for (const [a, b] of [[p0, p1], [p1, p2]]) for (const sx of [-1, 1]) rod(g, [sx * .011, a[1], a[2]], [sx * .011, b[1], b[2]], .006, lm, 'lamp arm');
  for (const [p, r] of [[p0, .017], [p1, .015], [p2, .014]]) P(g, cyl(r, r, .04, 16), jm, p[0], p[1], p[2], 'lamp joint', [0, 0, Math.PI / 2]);
  P(g, cyl(.022, .022, .018, 16), lm, 0, .032, 0, 'lamp pivot block');
  const sc = V(...p2).addScaledVector(dir, .05), bulb = new THREE.MeshBasicMaterial({ color: o.light === false ? 0x777777 : 0xfff3dc });
  const shade = P(g, cyl(.024, .068, .12, 24), [lm, lm, bulb], sc.x, sc.y, sc.z, 'lamp shade'); shade.quaternion.setFromUnitVectors(UP, dir.clone().negate());
  if (o.light) { const L = new THREE.SpotLight(0xfff1d8, o.light === true ? 3 : o.light, 3, .7, .6, 1.5), at = sc.clone().addScaledVector(dir, .07); L.position.copy(at); L.target.position.copy(at.clone().addScaledVector(dir, 1)); g.add(L, L.target); g.userData.light = L; }
  return { mount: 'surface', head: { at: [sc.x, sc.y, sc.z], dir: dir.toArray() }, foot: [-.078, .078, -.078, .078] };
});

// desk phone: body with a keypad, handset in its cradle. front (+Z) = keypad side. 20 x 9 x 21 cm.
kit('desk phone', [.2, .09, .21], 'surface', 'keypad faces +Z', (g, o) => {
  const pm = main(o, INV ? M.black : M.body2, .45);
  Bx(g, .2, .05, .21, pm, 0, 0, 0, 'phone body', .012);
  const kt = tmat('phonekeys' + THEME_ID, 128, 160, (x, W, H) => { x.fillStyle = INV ? '#1b1d20' : '#d9dad8'; x.fillRect(0, 0, W, H); x.fillStyle = INV ? '#4a4e54' : '#fbfbfa';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) x.fillRect(14 + c * 36, 14 + r * 36, 28, 26); }, .5);
  P(g, sb(.09, .006, .1), [pm, pm, kt, pm, pm, pm], .035, .052, .045, 'phone keypad', [.12, 0, 0]);
  Bx(g, .19, .03, .05, pm, 0, .046, -.06, 'phone cradle', .01);
  // o.handset false: the cradle alone, with a top 'cradle' for the separate handset a person picks up:
  //   const hs = place(S, prop('phone handset'), { on: deskPhone, top: 'cradle', yaw: 90 }); hold(f, hs, 'ear', { t0, t1 })
  if (o.handset !== false) { Bx(g, .2, .028, .048, pm, 0, .072, -.06, 'phone handset', .012);
    for (const sx of [-1, 1]) Bx(g, .055, .03, .058, pm, sx * .07, .064, -.06, 'phone handset cup', .012); return { mount: 'surface' }; }
  return { mount: 'surface', tops: [top('cradle', .076, -.095, .095, -.085, -.035, { overhang: true })] };   // (Bx y = the bottom: the cradle's top is .046 + .03)
});

// smartphone lying face up; front (+Z) = its bottom edge (text reads from the front). 7.2 x 0.8 x 14.8 cm.
kit('smartphone', [.072, .008, .148], 'surface', 'lying face up, bottom edge +Z', (g, o) => {
  Bx(g, .072, .008, .148, main(o, M.dark, .4), 0, 0, 0, 'phone case', .005);
  const s = P(g, cache('spscr', () => new THREE.PlaneGeometry(.066, .14)), screenMat({ screen: o.screen ?? 'off' }, .066 / .14), 0, .0085, 0, 'phone screen', [-Math.PI / 2, 0, 0]); s.castShadow = false;
  // grips: the palm on the back, the fingers round the far long edge, the thumb up the near edge (screen +Y, top -Z)
  // pick: how a hand takes it off a table (fingers across the screen, curling over the far long edge, thumb on the near one;
  // hold(f, phone, 'ear', { t0 }) uses it at rest and turns the phone into the use grip on the way up)
  const ph = use => grip([.054, 0, .022], [-1, 0, 0], [0, 1, 0], { pose: 'phone', use, pick: 'pick' });
  return { mount: 'surface', grips: { look: ph('look'), ear: { ...ph('ear'), clips: ['Idle_TalkingPhone_Loop'] }, film: ph('film'),
    pick: grip([.012, .03, .01], [-1, 0, 0], [0, -1, 0], { pose: 'pinch', use: 'clip', palmTouch: false, pickOnly: true, contact: ['index', 'thumb'] }) } };
});

// mug: handle on +X. 8 x 9.5 cm.  o.full = coffee in it (default true)
kit('mug', [.12, .095, .082], 'surface', 'handle +X', (g, o) => {
  const mm = main(o, M.ceramic, .35);
  P(g, lathe('mug', [[0, 0], [.037, 0], [.041, .004], [.041, .095], [.0365, .095], [.0365, .008], [0, .008]]), mm, 0, 0, 0, 'mug body');
  P(g, tor(.025, .0065, Math.PI), mm, .036, .05, 0, 'mug handle', [0, 0, -Math.PI / 2]);
  if (o.full !== false) P(g, cyl(.0368, .0368, .004, 24), mat(INV ? 0x1a120d : 0x5a4130, .3), 0, .075, 0, 'mug coffee');
  // grip: wrap = the body in the palm, the handle away from the fingers (no handle grip: its 13 mm hole is narrower than a
  // mannequin finger - a finger "through the handle" would pass through the mug: handtest, references/hands.md)
  // (palm centre at mid height, 4.7 cm: at 3.6 cm the pinky reached 4 mm under the mug's bottom - into the table at a pick-up)
  return { mount: 'surface', grips: { wrap: grip([0, .047, -.041], [-1, 0, 0], [0, 0, 1], { pose: 'wrap', use: 'hold', mirror: 'z', contact: ['index', 'middle', 'thumb'] }) } };
});

// papers: a stack of A4 sheets (21 x 29.7 cm), printed top sheet, the top two slightly askew. front (+Z) = text bottom.
kit('papers', [.215, .008, .3], 'surface', 'A4 stack; o.n sheets', (g, o) => {
  // (never rotate a sheet: anything flat >= 30 cm within 1 cm of the desk is a COPLANAR fail; the stack stays >= 8 mm thick)
  // (one block >= 7.5 mm thick with the printed top: thinner parts count as "flat" and a turned A4 is > 30 cm wide)
  const n = o.n ?? 40, h = Math.max(.0075, n * .00019), pm = M.paper();
  const tm = tmat('print' + THEME_ID, 256, 362, (x, W, H) => { x.fillStyle = INV ? '#c6c9cc' : '#f7f6f2'; x.fillRect(0, 0, W, H); x.fillStyle = INV ? '#6d7276' : '#8d9196';
    x.fillRect(24, 26, 120, 9); for (let i = 0; i < 24; i++) x.fillRect(24, 56 + i * 12, (W - 48) * (i % 6 === 5 ? .5 : .92), 4); }, .95);
  P(g, sb(.21, h, .297), [pm, pm, tm, pm, pm, pm], 0, h / 2, 0, 'papers stack');
  // grips: read = both side edges pinched: the palm beside the edge facing it, the thumb ON the printed face, index and
  // middle behind (charstress: the old palm-under-the-sheet grip left both thumbs in the air beside the edge, the check
  // counting the thumb on the 7 mm edge as contact); printed side +Y to the reader; carry = one edge at the side
  const edge = sx => grip([sx * .125, -.01, .03], [-sx * .3, 0, -1], [-sx, 0, 0], { pose: 'edge', contact: ['middle', 'thumb'] });   // (the female index stops 4 mm short: middle + thumb pinch)
  return { mount: 'surface', tops: [top('top', h, -.1, .1, -.14, .14, { overhang: true })],
    grips: { read: { ...edge(1), hand: 'R', use: 'read', second: edge(-1) }, carry: grip([0, h / 2, -.185], [0, 0, 1], [0, -1, 0], { pose: 'edge', use: 'hang', up: [0, 0, -1], contact: ['index', 'thumb'] }) } };
});

// folder: closed manila folder with papers peeking out on +X, a tab at the back. 24 x 1.4 x 31 cm.
kit('folder', [.25, .014, .32], 'surface', 'tab at -Z', (g, o) => {
  const fm = main(o, M.card, .9);
  Bx(g, .235, .012, .31, fm, 0, 0, 0, 'folder cover', .002);
  Bx(g, .08, .004, .03, fm, -.05, .004, -.165, 'folder tab', .0015);
  Bx(g, .21, .008, .29, M.paper(), .012, .002, .004, 'folder papers', .001);
  Bx(g, .09, .0015, .03, M.white(), -.04, .0115, -.1, 'folder label', .0005);
  const edge = sx => grip([sx * .1375, -.01, .03], [-sx * .3, 0, -1], [-sx, 0, 0], { pose: 'edge', contact: ['middle', 'thumb'] });   // (read: palm beside the edge, thumb on the front - papers)
  return { mount: 'surface', tops: [top('top', .012, -.11, .11, -.15, .15, { overhang: true })],
    grips: { read: { ...edge(1), hand: 'R', use: 'read', second: edge(-1) }, carry: grip([0, .006, -.185], [0, 0, 1], [0, -1, 0], { pose: 'edge', use: 'hang', up: [0, 0, -1], contact: ['index', 'thumb'] }) } };
});

// book: lying flat (default: cover up, spine -X, bottom edge +Z) or o.standing (upright, spine faces +Z).
// 15.5 x 2.8 x 23 cm. o.w / o.t (thickness) / o.d, o.color, o.seed.
// (book parts are built lying, centred on 0: cover up (+Y), spine at -X, bottom edge +Z)
function bookParts(g, w, t, d, cm, name = 'book') {
  Bx(g, w, t, d, cm, 0, -t / 2, 0, name + ' cover', .0025);
  Bx(g, w - .007, t - .005, d - .008, M.paper(), .0045, -t / 2 + .0025, 0, name + ' pages', .001);
  Bx(g, .006, t + .0016, .012, M.white(), -w / 2 + .0015, -t / 2 - .0008, -d * .3, name + ' spine band', .001);
}
const STAND = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, -1), V(1, 0, 0), V(0, -1, 0)));   // lying -> upright, spine +Z
const bookColor = (o, i = 0) => hexOf(o.color) ?? PAL.books[Math.floor(hh((o.seed ?? 1) + i * 7.3, 5) * PAL.books.length)];
kit('book', [.155, .028, .23], 'surface', 'lying cover up (spine -X) | o.standing (spine +Z)', (g, o) => {
  const w = o.w ?? .155, t = o.t ?? .028, d = o.d ?? .23, cm = mat(bookColor(o), .8), inner = new THREE.Group(); g.add(inner);
  bookParts(inner, w, t, d, cm);
  if (o.standing) { inner.quaternion.copy(STAND); inner.position.y = d / 2; return { mount: 'surface' }; }
  inner.position.y = t / 2;
  return { mount: 'surface', tops: [top('cover', t, -w / 2, w / 2, -d / 2, d / 2, { overhang: true })],
    grips: { carry: grip([0, t / 2, -d / 2 - .03], [0, 0, 1], [0, -1, 0], { pose: 'edge', use: 'hang', up: [0, 0, -1], contact: ['index', 'thumb'] }) } };
});
// book row: o.n books (or enough to fill o.w) standing side by side, spines +Z, varied, deterministic by o.seed;
// o.lean = the last one leans on its neighbour.
kit('book row', [.3, .25, .17], 'surface', 'o.n | o.w, o.seed, o.lean; spines +Z', (g, o) => {
  const seed = o.seed ?? 3, books = []; let x = 0;
  for (let i = 0; i < 60; i++) { const t = .018 + hh(seed + i, 1) * .03, hgt = (o.h ?? .24) * (.82 + hh(seed + i, 2) * .2), d = .13 + hh(seed + i, 3) * .04;
    if (o.n ? i >= o.n : x + t > (o.w ?? .3) + 1e-6) break; books.push({ t, hgt, d, x: x + t / 2 }); x += t - .001; }
  books.forEach((b, i) => { const bg = new THREE.Group(); g.add(bg); bookParts(bg, b.d, b.t, b.hgt, mat(bookColor({ seed: seed + i * 3 }, i), .8));
    bg.quaternion.copy(STAND); bg.position.set(b.x, b.hgt / 2, -b.d / 2);   // spines flush at z = 0 (the front)
    if (o.lean && i === books.length - 1 && i > 0) { const a = 14 * D2R, L = books[i - 1]; bg.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), a));
      bg.position.set(L.x + L.t / 2 + b.t / 2 * Math.cos(a) + b.hgt / 2 * Math.sin(a) - .001, b.hgt / 2 * Math.cos(a) + b.t / 2 * Math.sin(a), -b.d / 2); } });
  return { mount: 'surface' };
});

// bookshelf: sides, top, plinth, back panel, o.shelves boards (default 5 levels). tops 'shelf 1' (bottom) .. 'shelf n',
// each with its clear height, and 'top'. front (+Z) = open side. 80 x 180 x 30 cm.
kit('bookshelf', [.8, 1.8, .3], 'floor', "tops 'shelf 1'..'shelf n' + 'top'", (g, o) => {
  const w = o.w ?? .8, h = o.h ?? 1.8, d = o.d ?? .3, n = o.shelves ?? 5, t = .018, wm = main(o, M.wood, .75), tops = [];
  for (const sx of [-1, 1]) Bx(g, t, h, d, wm, sx * (w / 2 - t / 2), 0, 0, 'shelf side', .003);
  Bx(g, w, t, d, wm, 0, h - t, 0, 'shelf top board', .003);
  Bx(g, w - 2 * t + .006, .07, .018, wm, 0, 0, d / 2 - .03, 'shelf plinth', .002);
  Bx(g, w - 2 * t + .006, h - t + .003, .006, M.woodDark(), 0, 0, -d / 2 + .004, 'shelf back', .001);
  const y0 = .068, span = (h - t - y0) / n;
  for (let i = 0; i < n; i++) { const y = y0 + i * span; Bx(g, w - 2 * t + .006, t, d - .006, wm, 0, y, .001, 'shelf board', .002);
    tops.push(top(`shelf ${i + 1}`, y + t, -w / 2 + t, w / 2 - t, -d / 2 + .007, d / 2 - .002, { clear: r4(span - t) })); }
  tops.push(top('top', h, -w / 2, w / 2, -d / 2, d / 2));
  return { tops };
});

// filing cabinet: 4 drawers with handles and label holders on +Z. 47 x 132 x 62 cm.
kit('filing cabinet', [.47, 1.32, .63], 'floor', 'drawers face +Z', (g, o) => {
  const w = .47, h = o.h ?? 1.32, d = .62, n = o.drawers ?? 4, cm = main(o, M.body2, .5);
  Bx(g, w, h, d, cm, 0, 0, 0, 'cabinet body', .008);
  const dh = (h - .04) / n;
  for (let i = 0; i < n; i++) { const y0 = .02 + i * dh;
    Bx(g, w - .03, dh - .012, .016, cm, 0, y0 + .006, d / 2 + .005, 'cabinet drawer', .004);
    Bx(g, .16, .022, .03, M.metal(), 0, y0 + dh * .55, d / 2 + .018, 'cabinet handle', .008);
    Bx(g, .07, .025, .006, M.white(), 0, y0 + dh * .78, d / 2 + .014, 'cabinet label', .001); }
  return { tops: [top('top', h, -w / 2, w / 2, -d / 2, d / 2)] };
});

// table (dining / meeting): 4 legs + apron. 160 x 75 x 90 cm. tops 'table'.
function tableParts(g, o, w, h, d, lt = .05) {
  const tm = main(o, M.wood, .7), t = .035, solids = [{ x0: -w / 2, x1: w / 2, y0: h - t, y1: h, z0: -d / 2, z1: d / 2 }];
  Bx(g, w, t, d, tm, 0, h - t, 0, 'table top', .008);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * (w / 2 - .07), z = sz * (d / 2 - .07); Bx(g, lt, h - t + .004, lt, tm, x, 0, z, 'table leg', .006); solids.push({ x0: x - lt / 2, x1: x + lt / 2, y0: 0, y1: h, z0: z - lt / 2, z1: z + lt / 2 }); }
  for (const sx of [-1, 1]) Bx(g, .02, .08, d - .14, tm, sx * (w / 2 - .07), h - t - .08 + .003, 0, 'table apron', .003);
  for (const sz of [-1, 1]) Bx(g, w - .14, .08, .02, tm, 0, h - t - .08 + .003, sz * (d / 2 - .07), 'table apron', .003);
  return { tops: [top('table', h, -w / 2, w / 2, -d / 2, d / 2)], solids };
}
kit('table', [1.6, .75, .9], 'floor', "top 'table'", (g, o) => tableParts(g, o, o.w ?? 1.6, o.h ?? .75, o.d ?? .9, .06));
kit('coffee table', [1.1, .42, .6], 'floor', "top 'table'", (g, o) => tableParts(g, o, o.w ?? 1.1, o.h ?? .42, o.d ?? .6, .05));

// dining chair: 4 legs, seat at 46 cm, back posts continue the back legs. front (+Z) = the seat opening.
kit('dining chair', [.44, .9, .47], 'floor', 'front = seat opening; seat 0.46', (g, o) => {
  const sy = .46, cm = main(o, M.wood, .7), l = .035;
  Bx(g, .44, .035, .42, cm, 0, sy - .035, .02, 'chair seat', .008);
  for (const sx of [-1, 1]) { Bx(g, l, sy - .035 + .003, l, cm, sx * .19, 0, .2, 'chair leg', .005);
    Bx(g, l, .9, l, cm, sx * .19, 0, -.18, 'chair back leg', .005); }
  for (const yy of [.62, .78]) Bx(g, .38 + .006, yy > .7 ? .09 : .05, .022, cm, 0, yy, -.18, 'chair back rail', .005);
  for (const zz of [.2, -.18]) Bx(g, .38 + .006, .03, .02, cm, 0, .18, zz, 'chair stretcher', .004);
  return { seat: { y: sy, z: .03 }, tops: [top('seat', sy, -.2, .2, -.17, .22, { overhang: true })] };
});

// sofa / armchair: feet, base, seat cushions, back cushions, armrests. front (+Z) = the seat. sofa 200 x 85 x 90 cm.
function seating(g, o, w, n) {
  const d = .9, fm = main(o, M.fabric, .95), sy = .44, aw = .16;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(g, cyl(.02, .016, .05, 10), M.woodDark(), sx * (w / 2 - .08), .025, sz * (d / 2 - .08), 'sofa foot');
  Bx(g, w - 2 * aw + .02, .24, d, fm, 0, .046, 0, 'sofa base', .03);   // between the arms (1 cm into each)
  Bx(g, w - .01, .52, .22, fm, 0, .27, -d / 2 + .11, 'sofa back frame', .05);
  for (const sx of [-1, 1]) Bx(g, aw, .604, d + .004, fm, sx * (w / 2 - aw / 2), .046, 0, 'sofa arm', .06);   // full-height sides on the feet
  const cw = (w - 2 * aw) / n;
  for (let i = 0; i < n; i++) { const x = -w / 2 + aw + cw * (i + .5);
    Bx(g, cw + .004, .16, d - .23, fm, x, .283, .095, 'sofa seat cushion', .05);
    P(g, rb(cw + .004, .42, .16, .06), fm, x, sy + .195, -d / 2 + .27, 'sofa back cushion', [-.16, 0, 0]); }
  return { seat: { y: .443, z: .12 }, tops: [top('seat', .443, -w / 2 + aw, w / 2 - aw, -.1, d / 2 - .02, { overhang: true })] };
}
kit('sofa', [2.0, .85, .9], 'floor', 'front = seat; seat 0.44', (g, o) => seating(g, o, o.w ?? 2.0, o.seats ?? 3));
kit('armchair', [.9, .85, .9], 'floor', 'front = seat; seat 0.44', (g, o) => seating(g, o, .9, 1));

// bed: frame, mattress, duvet over the foot two-thirds, two pillows, headboard at -Z. front (+Z) = foot end.
// double 160 x 205 cm, mattress top 52 cm.
kit('bed', [1.66, 1.0, 2.1], 'floor', 'front = foot end; headboard -Z', (g, o) => {
  const w = o.w ?? 1.6, l = 2.05, fm = main(o, M.woodDark, .7);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) Bx(g, .06, .1, .06, fm, sx * (w / 2 - .04), 0, sz * (l / 2 - .04), 'bed foot', .006);
  Bx(g, w, .2, l, fm, 0, .097, 0, 'bed frame', .015);
  Bx(g, w, 1.0, .06, fm, 0, 0, -l / 2 - .027, 'bed headboard', .015);
  Bx(g, w - .04, .23, l - .04, M.white(), 0, .294, 0, 'bed mattress', .05);
  const dm = mat(hexOf(o.duvet) ?? (INV ? 0x3c4654 : 0xc3cbd6), .95);
  Bx(g, w + .03, .26, l * .64, dm, 0, .29, l / 2 - l * .32 + .012, 'bed duvet', .05);   // draped down to the frame (7 mm into it)
  for (const sx of [-1, 1]) Bx(g, w * .4, .12, .38, M.white(), sx * w * .22, .51, -l / 2 + .25, 'bed pillow', .05);
  return { tops: [top('duvet', .55, -w / 2 + .02, w / 2 - .02, l / 2 - l * .64 + .05, l / 2 - .02, { overhang: true })], solids: [{ x0: -w / 2 - .02, x1: w / 2 + .02, y0: 0, y1: .55, z0: -l / 2 - .06, z1: l / 2 + .02 }, { x0: -w / 2, x1: w / 2, y0: 0, y1: 1, z0: -l / 2 - .06, z1: -l / 2 }] };
});

// nightstand: 4 short legs, body, one drawer with a knob on +Z. 45 x 55 x 40 cm.
kit('nightstand', [.45, .55, .41], 'floor', "drawer +Z; top 'top'", (g, o) => {
  const w = .45, h = .55, d = .4, cm = main(o, M.wood, .7);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) Bx(g, .035, .1, .035, cm, sx * (w / 2 - .04), 0, sz * (d / 2 - .04), 'nightstand leg', .005);
  Bx(g, w, h - .097, d, cm, 0, .097, 0, 'nightstand body', .008);
  Bx(g, w - .04, .14, .016, cm, 0, h - .2, d / 2 + .005, 'nightstand drawer', .004);
  P(g, sph(.015), M.metal(), 0, h - .13, d / 2 + .02, 'nightstand knob');
  return { tops: [top('top', h, -w / 2, w / 2, -d / 2, d / 2)] };
});

// tv: flat 55" panel on a pedestal foot, screen +Z. 123 x 77 x 26 cm.  tv console: low cabinet 160 x 50 x 40 cm.
kit('tv', [1.23, .78, .26], 'surface', 'screen faces +Z; o.screen', (g, o) => {
  const w = o.w ?? 1.23, h = w * .58, bm = M.black(), py = .07 + h / 2;
  Bx(g, .42, .014, .26, bm, 0, 0, -.03, 'tv foot', .006); Bx(g, .08, py - .01, .04, bm, 0, .01, -.05, 'tv neck', .01);
  P(g, rb(w * .5, h * .5, .05, .02), bm, 0, py, -.05, 'tv back');
  P(g, rb(w, h, .03, .006), bm, 0, py, -.017, 'tv panel');
  const s = P(g, cache(`tvs${w}`, () => new THREE.PlaneGeometry(w - .02, h - .02)), screenMat(o, (w - .02) / (h - .02)), 0, py + .001, -.017 + .0162, 'tv screen'); s.castShadow = false;
  return { mount: 'surface' };
});
kit('tv console', [1.6, .5, .4], 'floor', "doors +Z; top 'top'", (g, o) => {
  const w = o.w ?? 1.6, h = .5, d = .4, cm = main(o, M.body2, .6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) Bx(g, .04, .08, .04, M.black(), sx * (w / 2 - .06), 0, sz * (d / 2 - .06), 'console foot', .006);
  Bx(g, w, h - .077, d, cm, 0, .077, 0, 'console body', .008);
  for (let i = 0; i < 3; i++) { const x = -w / 2 + w / 6 + i * w / 3; Bx(g, w / 3 - .016, h - .077 - .04, .014, cm, x, .097, d / 2 + .004, 'console door', .004);
    Bx(g, .1, .014, .02, M.metal(), x, h - .09, d / 2 + .014, 'console handle', .006); }
  return { tops: [top('top', h, -w / 2, w / 2, -d / 2, d / 2)] };
});

// floor lamp: weighted base, pole, drum shade glowing underneath. o.light = intensity (PointLight under the shade). 160 cm.
kit('floor lamp', [.44, 1.62, .44], 'floor', 'o.light', (g, o) => {
  const lm = main(o, M.black, .45), H = o.h ?? 1.62;
  P(g, lathe('flbase', [[0, 0], [.14, 0], [.145, .008], [.13, .028], [.03, .036], [0, .036]]), lm, 0, 0, 0, 'lamp base');
  P(g, cyl(.012, .012, H - .3), lm, 0, .03 + (H - .3) / 2, 0, 'lamp pole');
  P(g, cyl(.19, .22, .3, 32), [M.white(), M.white(), new THREE.MeshBasicMaterial({ color: o.light === false ? 0x888888 : 0xfff2dc })], 0, H - .15, 0, 'lamp shade');
  if (o.light) { const L = new THREE.PointLight(0xfff0d6, o.light === true ? 2 : o.light, 6, 1.4); L.position.set(0, H - .35, 0); g.add(L); g.userData.light = L; }
  return {};
});
// table lamp (bedside / side table): ceramic base, drum shade. 50 cm.
kit('table lamp', [.3, .5, .3], 'surface', 'o.light', (g, o) => {
  const cm = main(o, M.ceramic, .35);
  P(g, lathe('tlbase', [[0, 0], [.06, 0], [.085, .08], [.08, .2], [.03, .28], [.012, .3], [0, .3]]), cm, 0, 0, 0, 'lamp base');
  P(g, cyl(.006, .006, .06), M.metal(), 0, .32, 0, 'lamp stem');
  P(g, cyl(.12, .15, .19, 32), [M.white(), M.white(), new THREE.MeshBasicMaterial({ color: 0xfff2dc })], 0, .345 + .09, 0, 'lamp shade');
  if (o.light) { const L = new THREE.PointLight(0xfff0d6, o.light === true ? 1.2 : o.light, 4, 1.4); L.position.set(0, .3, 0); g.add(L); g.userData.light = L; }
  return { mount: 'surface' };
});

// potted plant: tapered pot with rim, soil, stems and leafy clumps. o.h total height (default .7; desk plant .3), o.seed.
kit('potted plant', [.45, .7, .45], 'floor', 'o.h, o.seed (desk plant: o.h .3)', (g, o) => {
  const H = o.h ?? .7, s = H / .7, ph = .24 * Math.min(1, s * 1.2), pr = .13 * Math.min(1, s * 1.15), seed = o.seed ?? 2, lf = M.leaf();
  P(g, lathe('pot' + r4(pr) + r4(ph), [[0, 0], [pr * .72, 0], [pr * .95, ph * .92], [pr, ph * .92], [pr, ph], [pr * .9, ph], [pr * .88, ph * .9], [0, ph * .9]]), main(o, M.ceramic, .5), 0, 0, 0, 'plant pot');
  P(g, cyl(pr * .885, pr * .885, .006, 20), M.soil(), 0, ph * .9 + .002, 0, 'plant soil');
  const n = 5, top = H - ph;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + hh(seed, i) * .8, rr = (.25 + hh(seed + i, 2) * .35) * pr * 1.6, y = ph * .86 + top * (.45 + hh(seed + i, 3) * .3);
    const tip = [Math.cos(a) * rr, y, Math.sin(a) * rr]; rod(g, [0, ph * .8, 0], tip, .007 * Math.max(.6, s), lf, 'plant stem', 6);
    const L = P(g, ico(top * (.2 + hh(seed + i, 4) * .07), 1), lf, tip[0], tip[1], tip[2], 'plant leaves'); L.scale.set(1.1, .8, 1.1); }
  const c = P(g, ico(top * .26, 1), lf, 0, H - top * .26 * .8, 0, 'plant leaves'); c.scale.set(1, .8, 1);
  rod(g, [0, ph * .8, 0], [0, H - top * .26 * .8, 0], .008 * Math.max(.6, s), lf, 'plant stem', 6);
  return {};
});

// trash bin: tapered open bin (closed mesh: wall + inner bottom). 28 x 32 cm.
kit('trash bin', [.29, .32, .29], 'floor', 'open top', (g, o) => {
  P(g, lathe('bin', [[0, 0], [.115, 0], [.14, .31], [.145, .32], [.134, .32], [.11, .02], [0, .02]], 32), main(o, M.body3, .6), 0, 0, 0, 'bin');
  if (o.paper !== false) P(g, ico(.045, 1), M.paper(), .02, .062, 0, 'bin paper ball');
  return {};
});

// whiteboard on a mobile stand (o.cork: a cork board): writing face +Z. 120 x 185 x 55 cm.
kit('whiteboard', [1.28, 1.85, .55], 'floor', 'face +Z; o.cork; o.draw(ctx, w, h)', (g, o) => {
  const bw = 1.2, bh = .9, by = .85, fm = M.metal();
  let face = o.cork ? M.cork() : M.white();
  if (o.draw) { const c = document.createElement('canvas'); c.width = 768; c.height = 576; const x = c.getContext('2d'); x.fillStyle = o.cork ? '#c9a77f' : '#fbfbf9'; x.fillRect(0, 0, 768, 576); o.draw(x, 768, 576);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; face = new THREE.MeshStandardMaterial({ map: t, roughness: .5 }); }
  P(g, sb(bw, bh, .02), [fm, fm, fm, fm, face, fm], 0, by + bh / 2, 0, 'board face');
  for (const sy of [-1, 1]) Bx(g, bw + .03, .025, .032, fm, 0, by + bh / 2 + sy * (bh / 2) - .0125, .002, 'board frame', .006);
  for (const sx of [-1, 1]) Bx(g, .025, bh + .03, .032, fm, sx * (bw / 2), by - .015, .002, 'board frame', .006);
  Bx(g, bw * .6, .02, .06, fm, 0, by - .01, .03, 'board tray', .004);
  for (const sx of [-1, 1]) { const x = sx * (bw / 2 + .03); Bx(g, .03, 1.82, .03, fm, x, .05, 0, 'stand post', .006); Bx(g, .05, .03, .55, fm, x, .045, 0, 'stand foot', .008);
    for (const sz of [-1, 1]) P(g, sph(.025, 10, 8), M.black(), x, .025, sz * .24, 'stand castor'); }
  for (const sx of [-1, 1]) Bx(g, .045, .03, .03, fm, sx * (bw / 2 + .015), by + bh * .3, 0, 'board clamp', .006);
  return {};
});

// door: frame (jambs + head) and a panelled leaf on hinges at -X, lever handles both sides. o.open degrees (opens toward
// +Z). opening 90 x 210 cm; frame 104 x 215 x 14 cm.
kit('door', [1.04, 2.15, .14], 'floor', 'opens toward +Z; o.open deg; hinges -X', (g, o) => {
  const W = .9, H = 2.1, jt = .07, fd = .14, fm = main(o, M.white, .6), lm = o.leaf != null ? mat(hexOf(o.leaf), .7) : M.wood();
  for (const sx of [-1, 1]) Bx(g, jt, H + jt, fd, fm, sx * (W / 2 + jt / 2), 0, 0, 'door jamb', .004);
  Bx(g, W + 2 * jt, jt, fd, fm, 0, H - .003, 0, 'door head', .004);
  const piv = new THREE.Group(); piv.position.set(-W / 2 + .001, 0, .03); piv.rotation.y = -(o.open ?? 0) * D2R; g.add(piv);
  Bx(piv, W - .006, H - .012, .04, lm, W / 2, .008, 0, 'door leaf', .004);
  for (const yy of [.25, 1.15]) for (const sz of [-1, 1]) Bx(piv, W - .2, yy > 1 ? .8 : .7, .006, lm, W / 2, yy, sz * .021, 'door panel', .003);
  for (const sz of [-1, 1]) { P(piv, cyl(.025, .025, .012, 16), M.chrome(), W - .08, 1.0, sz * .024, 'door rose', [Math.PI / 2, 0, 0]);
    Bx(piv, .13, .018, .02, M.chrome(), W - .13, .991, sz * .04, 'door handle', .008); P(piv, cyl(.009, .009, .03, 8), M.chrome(), W - .08, 1.0, sz * .033, 'door handle neck', [Math.PI / 2, 0, 0]); }
  for (const yy of [.2, 1.0, 1.85]) P(g, cyl(.008, .008, .1, 10), M.chrome(), -W / 2 + .002, yy, .03, 'door hinge');
  return {};
});

// window (wall mount): outer frame, sill on +Z, two sashes with a cross mullion, panes (o.light 'day' bright | 'night' | 'glass').
// 120 x 140 cm. Its back (-Z) goes against the wall; place({ on: 'wall', at: [x, y, z], face }).
kit('window', [1.2, 1.45, .2], 'wall', 'wall mount; o.light day|night|glass', (g, o) => {
  const w = o.w ?? 1.2, h = o.h ?? 1.4, fm = main(o, M.white, .6), t = .06, d = .1;
  const pane = o.light === 'glass' ? M.glass() : new THREE.MeshBasicMaterial({ color: o.light === 'night' ? (INV ? 0x1b2533 : 0x34445a) : (INV ? 0x6f8aa8 : 0xe2edf7) });
  P(g, sb(w - 2 * t + .004, h - 2 * t + .004, .01), pane, 0, h / 2 + .03, 0, 'window pane');
  for (const sy of [-1, 1]) Bx(g, w, t, d, fm, 0, h / 2 + .03 + sy * (h / 2 - t / 2) - t / 2, 0, 'window frame', .004);
  for (const sx of [-1, 1]) Bx(g, t, h, d, fm, sx * (w / 2 - t / 2), .03, 0, 'window frame', .004);
  Bx(g, .04, h - 2 * t + .006, .05, fm, 0, .03 + t - .003, .01, 'window mullion', .003);
  Bx(g, w - 2 * t + .006, .04, .05, fm, 0, .03 + h * .55, .01, 'window transom', .003);
  Bx(g, w + .1, .03, d + .1, fm, 0, .003, .05, 'window sill', .004);
  return { mount: 'wall' };
});

// picture frame: wall (default; back -Z) or o.stand (desk frame on a strut). o.image = IMG key | fn(ctx, w, h) | canvas.
// wall 50 x 40 x 3 cm, desk 18 x 23 cm.
kit('picture frame', [.5, .4, .03], 'wall', 'wall | o.stand desk frame; o.image', (g, o) => {
  const w = o.w ?? (o.stand ? .18 : .5), h = o.h ?? (o.stand ? .23 : .4), fm = main(o, M.woodDark, .7), b = w * .08;
  let pic;
  if (typeof o.image === 'string' && IMG[o.image]) { const t = new THREE.Texture(IMG[o.image]); t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; pic = new THREE.MeshStandardMaterial({ map: t, roughness: .6 }); }
  else { const draw = typeof o.image === 'function' ? o.image : (x, W, H) => { const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, INV ? '#4a5868' : '#a9c1d9'); gr.addColorStop(1, INV ? '#2a2f36' : '#e8e1d2'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
      x.fillStyle = INV ? '#39433b' : '#8fa486'; x.beginPath(); x.moveTo(0, H * .75); x.lineTo(W * .3, H * .45); x.lineTo(W * .55, H * .68); x.lineTo(W * .78, H * .38); x.lineTo(W, H * .7); x.lineTo(W, H); x.lineTo(0, H); x.fill(); };
    pic = new THREE.MeshStandardMaterial({ map: typeof o.image === 'function' ? (() => { const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w); draw(c.getContext('2d'), c.width, c.height); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() : ctex('pic' + THEME_ID + r4(h / w), 256, Math.round(256 * h / w), draw), roughness: .6 }); }
  const root = new THREE.Group(); g.add(root);
  P(root, sb(w - 2 * b + .004, h - 2 * b + .004, .006), [M.white(), M.white(), M.white(), M.white(), pic, M.white()], 0, h / 2, -.002, 'frame picture');
  for (const sy of [-1, 1]) Bx(root, w, b, .022, fm, 0, h / 2 + sy * (h / 2 - b / 2) - b / 2, 0, 'frame', .003);
  for (const sx of [-1, 1]) Bx(root, b, h, .022, fm, sx * (w / 2 - b / 2), 0, 0, 'frame', .003);
  Bx(root, w - .01, h - .01, .006, fm, 0, .005, -.012, 'frame back', .002);
  if (o.stand) { root.rotation.x = -.26; root.updateMatrixWorld(true); const a = root.localToWorld(V(0, h * .6, -.012)); rod(g, [0, .004, a.z - h * .42], [0, a.y, a.z], .005, fm, 'frame strut', 8); return { mount: 'surface' }; }
  return { mount: 'wall' };
});

// wall clock: round, face +Z, o.time 'h:mm' (default 10:10). 30 cm.
kit('wall clock', [.3, .3, .05], 'wall', 'face +Z; o.time', (g, o) => {
  const tm = o.time ?? '10:10', [hr, mi] = tm.split(':').map(Number), R = .15, rm = main(o, M.black, .45);
  const ft = ctex('clock' + THEME_ID, 256, 256, (x, W) => { x.fillStyle = INV ? '#c9ccd0' : '#fbfbf9'; x.fillRect(0, 0, W, W); x.fillStyle = '#25282c';
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, l = i % 5 ? 6 : 18, wd = i % 5 ? 2 : 6; x.save(); x.translate(W / 2, W / 2); x.rotate(a); x.fillRect(-wd / 2, -W / 2 + 10, wd, l); x.restore(); } });
  const fmz = new THREE.MeshStandardMaterial({ map: ft, roughness: .5 });
  P(g, cyl(R, R, .045, 40), [rm, fmz, rm], 0, R, 0, 'clock body', [Math.PI / 2, 0, 0]);
  const hand = (len, wd, ang, z, nm) => { const m = P(g, sb(wd, len, .002), M.black(), 0, 0, 0, nm); m.position.set(Math.sin(ang) * len * .4, R + Math.cos(ang) * len * .4, z); m.rotation.z = -ang; };
  hand(.075, .008, ((hr % 12) + mi / 60) / 12 * Math.PI * 2, .0245, 'clock hour hand'); hand(.11, .005, mi / 60 * Math.PI * 2, .0265, 'clock minute hand');
  P(g, cyl(.007, .007, .008, 12), M.black(), 0, R, .025, 'clock pin', [Math.PI / 2, 0, 0]);
  return { mount: 'wall' };
});

// ceiling lamp (pendant): canopy, cord (o.drop, default .6 m), dome shade glowing underneath. o.light. Hangs: lowest point
// y = 0, canopy top = its height; place({ on: 'ceiling', at: [x, z] }).
kit('ceiling lamp', [.4, .82, .4], 'ceiling', 'hangs; o.drop, o.light', (g, o) => {
  const drop = o.drop ?? .6, lm = main(o, M.black, .45), sh = .2;
  P(g, lathe('dome', [[0, sh], [.03, sh], [.12, sh * .7], [.19, sh * .15], [.2, 0], [.19, 0], [.18, sh * .13], [.11, sh * .62], [0, sh * .64]], 36), lm, 0, 0, 0, 'lamp shade');
  P(g, sph(.06, 16, 10), new THREE.MeshBasicMaterial({ color: o.light === false ? 0x888888 : 0xfff2dc }), 0, sh * .58, 0, 'lamp bulb');
  P(g, cyl(.004, .004, drop + .01, 6), M.black(), 0, sh + drop / 2, 0, 'lamp cord');
  P(g, cyl(.06, .06, .025, 24), lm, 0, sh + drop + .0125 - .003, 0, 'lamp canopy');
  if (o.light) { const L = new THREE.PointLight(0xfff0d6, o.light === true ? 2.5 : o.light, 7, 1.3); L.position.set(0, sh * .3, 0); g.add(L); g.userData.light = L; }
  return { mount: 'ceiling', noContact: true };
});

// server rack: open 42U cabinet, servers with drive bays and status LEDs on +Z. 60 x 200 x 100 cm.
kit('server rack', [.6, 2.0, 1.0], 'floor', 'servers face +Z', (g, o) => {
  const w = .6, h = 2.0, d = 1.0, cm = main(o, M.black, .5), t = .03;
  for (const sx of [-1, 1]) Bx(g, t, h, d, cm, sx * (w / 2 - t / 2), 0, 0, 'rack side', .004);
  Bx(g, w, t, d, cm, 0, h - t, 0, 'rack roof', .004); Bx(g, w, .08, d, cm, 0, 0, 0, 'rack plinth', .004);
  Bx(g, w - 2 * t + .006, h - .08 - t + .006, .02, cm, 0, .077, -d / 2 + .01, 'rack back', .002);
  const tex = k => ctex('srv' + k + THEME_ID, 512, 64, (x, W, H) => { x.fillStyle = '#1a1c1f'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < (k ? 12 : 8); i++) { x.fillStyle = '#2c3035'; x.fillRect(16 + i * (k ? 38 : 56), 10, k ? 32 : 48, H - 20); x.fillStyle = hh(i, k) > .25 ? '#38e06a' : '#f0b13a'; x.fillRect(18 + i * (k ? 38 : 56), 13, 5, 5); }
    x.fillStyle = '#4a90e8'; x.fillRect(W - 30, H / 2 - 4, 8, 8); });
  const fmOf = k => { const key = 'srvm' + k + THEME_ID; let m = MATS.get(key); if (!m) { const tx = tex(k); m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: INV ? .9 : .5, map: tx }); MATS.set(key, m); } return m; };
  let y = .1;
  for (let i = 0; y < h - .2; i++) { const u = [2, 1, 1, 2, 4, 1, 2][i % 7], hh2 = u * .0445 - .003;
    P(g, sb(w - 2 * t + .006, hh2, d * .8), [cm, cm, cm, cm, fmOf(u > 1 ? 0 : 1), cm], 0, y + hh2 / 2, d * .1 - .03, 'rack server'); y += hh2 + .003; }
  return { tops: [top('top', h, -w / 2, w / 2, -d / 2, d / 2)] };
});

// CCTV camera (wall mount): wall plate at -Z, arm, housing with sunshield, lens pointing +Z and 20 deg down, red LED.
kit('cctv camera', [.1, .16, .34], 'wall', 'lens +Z (tilted down); hangs from its plate', (g, o) => {
  const cm = main(o, M.white, .5), tilt = (o.tilt ?? 20) * D2R;
  Bx(g, .09, .14, .015, cm, 0, 0, -.16, 'cctv plate', .004);
  rod(g, [0, .07, -.16], [0, .09, -.06], .014, cm, 'cctv arm', 10);
  const hd = new THREE.Group(); hd.position.set(0, .1, -.04); hd.rotation.x = tilt; g.add(hd);
  P(hd, sph(.022, 12, 8), cm, 0, -.01, -.02, 'cctv joint');
  Bx(hd, .085, .075, .2, cm, 0, -.035, .05, 'cctv housing', .02);
  Bx(hd, .1, .012, .22, cm, 0, .038, .055, 'cctv sunshield', .004);
  P(hd, cyl(.028, .028, .012, 20), [M.black(), M.glass(), M.black()], 0, .002, .152, 'cctv lens', [Math.PI / 2, 0, 0]);
  P(hd, sph(.005, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a20 }), .028, .022, .151, 'cctv led');
  return { mount: 'wall', noContact: true };
});

// fire extinguisher: red cylinder with domed top, valve, lever, gauge on +Z, hose to a clipped nozzle. 55 cm.
kit('fire extinguisher', [.2, .6, .18], 'floor', 'gauge + label face +Z', (g, o) => {
  const rm = main(o, M.red, .4);
  P(g, lathe('ext', [[0, 0], [.07, 0], [.075, .01], [.075, .44], [.06, .49], [.025, .51], [0, .512]], 28), rm, 0, 0, 0, 'extinguisher body');
  P(g, cyl(.0765, .0765, .14, 28), M.white(), 0, .26, 0, 'extinguisher label');
  P(g, cyl(.018, .02, .05, 12), M.black(), 0, .53, 0, 'extinguisher valve');
  Bx(g, .03, .02, .13, M.black(), 0, .545, .02, 'extinguisher handle', .006); P(g, rb(.025, .015, .12, .005), M.black(), 0, .568, .03, 'extinguisher lever', [-.2, 0, 0]);
  P(g, cyl(.016, .016, .012, 16), [M.chrome(), M.white(), M.chrome()], 0, .535, .02, 'extinguisher gauge', [Math.PI / 2, 0, 0]);
  const hose = new THREE.CatmullRomCurve3([V(0, .54, -.02), V(-.05, .52, -.06), V(-.08, .42, -.06), V(-.082, .2, -.03), V(-.074, .12, -.0)]);
  P(g, cache('exthose', () => new THREE.TubeGeometry(hose, 24, .009, 8)), M.black(), 0, 0, 0, 'extinguisher hose');
  P(g, cyl(.012, .016, .06, 10), M.black(), -.074, .1, 0, 'extinguisher nozzle');
  return {};
});

// reception counter: visitor side +Z (tall front panel + transaction ledge at 110 cm), staff worktop at 75 cm behind.
// 240 x 110 x 80 cm. tops 'ledge' and 'worktop' (the staff side: arrange.desk(S, counter, { top: 'worktop', sitter })).
kit('reception counter', [2.4, 1.12, .82], 'floor', "visitor side +Z; tops 'ledge', 'worktop'", (g, o) => {
  const w = o.w ?? 2.4, d = .8, cm = main(o, M.body2, .6);
  Bx(g, w, 1.08, .04, cm, 0, 0, d / 2 - .02, 'counter front', .006);
  Bx(g, w + .02, .03, .32, M.wood(), 0, 1.08 - .003, d / 2 - .12, 'counter ledge', .006);
  for (const sx of [-1, 1]) Bx(g, .04, 1.08, d - .04 + .003, cm, sx * (w / 2 - .02), 0, -.0185, 'counter end', .006);
  Bx(g, w - .08 + .006, .03, d - .04 + .003, M.wood(), 0, .72, -.0185, 'counter worktop', .004);
  // (the worktop surface ends 1 cm short of the ledge above it: nothing tall goes under the ledge)
  return { tops: [top('ledge', 1.107, -w / 2, w / 2, d / 2 - .28, d / 2 + .04), top('worktop', .75, -w / 2 + .04, w / 2 - .04, -d / 2, d / 2 - .29)],
    solids: [{ x0: -w / 2, x1: w / 2, y0: 0, y1: 1.11, z0: d / 2 - .28, z1: d / 2 + .04 }, { x0: -w / 2, x1: w / 2, y0: .72, y1: .75, z0: -d / 2, z1: d / 2 }, { x0: -w / 2, x1: -w / 2 + .04, y0: 0, y1: 1.1, z0: -d / 2, z1: d / 2 }, { x0: w / 2 - .04, x1: w / 2, y0: 0, y1: 1.1, z0: -d / 2, z1: d / 2 }] };
});

// crate: wooden slatted crate with corner posts. 60 x 45 x 45 cm. top 'top' (stackable).
kit('crate', [.62, .46, .47], 'floor', "stackable; top 'top'", (g, o) => {
  const w = .6, h = .45, d = .45, cm = main(o, M.wood, .85), dk = M.woodDark();
  Bx(g, w - .02, h - .02, d - .02, dk, 0, .01, 0, 'crate core', .004);
  for (let i = 0; i < 3; i++) { const y0 = .01 + i * (h - .02) / 3 + .008;
    for (const sz of [-1, 1]) Bx(g, w - .02, (h - .02) / 3 - .02, .02, cm, 0, y0, sz * (d / 2 - .007), 'crate slat', .003);
    for (const sx of [-1, 1]) Bx(g, .02, (h - .02) / 3 - .02, d - .02, cm, sx * (w / 2 - .007), y0, 0, 'crate slat', .003); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) Bx(g, .045, h, .045, cm, sx * (w / 2 - .022 + .004), 0, sz * (d / 2 - .022 + .004), 'crate post', .004);
  for (let i = 0; i < 4; i++) Bx(g, w - .02, .018, (d - .02) / 4 - .012, cm, 0, h - .018, -d / 2 + .01 + (i + .5) * (d - .02) / 4, 'crate lid slat', .003);
  const side = sx => grip([sx * (w / 2 + .004), .14, -d / 2 + .09], [0, -.35, .94], [-sx, 0, 0], { pose: 'flat', contact: ['index', 'middle'] });
  return { tops: [top('top', h, -w / 2 + .02, w / 2 - .02, -d / 2 + .02, d / 2 - .02, { overhang: true })], grips: { carry: { ...side(-1), hand: 'R', use: 'carry', second: side(1), clips: ['Walk_Carry_Loop'] } } };
});
// cardboard box: taped flaps, a shipping label on +Z. 40 x 30 x 30 cm (o.w/h/d). top 'top' (stackable).
kit('cardboard box', [.4, .302, .3], 'floor', "stackable; label +Z", (g, o) => {
  const w = o.w ?? .4, h = o.h ?? .3, d = o.d ?? .3, cm = main(o, M.card, .9), tp = M.tape();
  Bx(g, w, h, d, cm, 0, 0, 0, 'box', .004);
  Bx(g, .055, .0015, d + .003, tp, 0, h - .0003, 0, 'box tape', .0005);
  for (const sz of [-1, 1]) Bx(g, .055, .07, .0015, tp, 0, h - .07, sz * (d / 2 + .0006), 'box tape', .0005);
  Bx(g, w * .35, h * .3, .0012, M.white(), .0375 + w * .175, h * .25, d / 2 + .0005, 'box label', .0004);
  // carry: both flat hands on the side faces, low (fingers forward and down under the box's weight)
  const side = sx => grip([sx * (w / 2), .12, -d / 2 + .08], [0, -.35, .94], [-sx, 0, 0], { pose: 'flat', contact: ['index', 'middle'] });   // flat on the sides, near the back: the forearms come from behind
  return { tops: [top('top', h + .0012, -w / 2, w / 2, -d / 2, d / 2, { overhang: true })], grips: { carry: { ...side(-1), hand: 'R', use: 'carry', second: side(1), clips: ['Walk_Carry_Loop'] } } };
});

// suitcase (hard shell, standing on 4 spinner wheels): front shell +Z, telescopic handle retracted. 45 x 72 x 27 cm.
kit('suitcase', [.45, .73, .27], 'floor', 'front shell +Z', (g, o) => {
  const w = .44, h = .66, d = .26, cm = main(o, INV ? M.body3 : M.fabric2, .4), bk = M.black();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { Bx(g, .05, .03, .05, bk, sx * (w / 2 - .04), .035, sz * (d / 2 - .04), 'suitcase wheel housing', .008); P(g, cyl(.025, .025, .018, 14), bk, sx * (w / 2 - .04), .025, sz * (d / 2 - .04), 'suitcase wheel', [0, 0, Math.PI / 2]); }
  Bx(g, w, h, d, cm, 0, .06, 0, 'suitcase shell', .035);
  P(g, rb(w + .004, h + .004, .016, .036), bk, 0, .06 + h / 2, 0, 'suitcase zip band');
  for (const sx of [-.12, 0, .12]) Bx(g, .018, h - .1, .006, cm, sx, .11, d / 2 - .001, 'suitcase rib', .003);
  for (const sx of [-1, 1]) Bx(g, .015, .045, .015, bk, sx * .1, .06 + h - .005, -d / 2 + .04, 'suitcase handle rod', .004);
  Bx(g, .23, .022, .03, bk, 0, .06 + h + .02, -d / 2 + .04, 'suitcase handle', .01);
  Bx(g, .03, .025, .12, bk, w / 2 + .01, .06 + h * .55, 0, 'suitcase side handle', .01);
  // (no carry grip: 73 cm hanging from a hand at the side reaches the calf and the floor - a suitcase rolls)
  return { tops: [top('top', .06 + h, -w / 2 + .03, w / 2 - .03, -d / 2 + .08, d / 2 - .03, { overhang: true })] };
});
// backpack (standing upright): front pocket +Z, straps on the back (-Z), top grab handle. 30 x 45 x 20 cm.
kit('backpack', [.3, .46, .24], 'floor', 'pocket +Z, straps -Z', (g, o) => {
  const cm = main(o, M.fabric2, .95), bk = M.black();
  Bx(g, .3, .44, .18, cm, 0, 0, 0, 'backpack body', .07);
  Bx(g, .24, .2, .06, cm, 0, .03, .09 - .008, 'backpack pocket', .03);
  Bx(g, .16, .006, .006, bk, 0, .2, .113, 'backpack zip', .002);
  P(g, tor(.035, .008, Math.PI, 12), bk, 0, .425, -.02, 'backpack handle', [0, Math.PI / 2, 0]);
  for (const sx of [-1, 1]) { const c = new THREE.CatmullRomCurve3([V(sx * .08, .4, -.085), V(sx * .09, .3, -.12), V(sx * .1, .15, -.12), V(sx * .11, .06, -.085)]);
    P(g, cache('bpstrap' + sx, () => new THREE.TubeGeometry(c, 16, .014, 6)), bk, 0, 0, 0, 'backpack strap'); }
  // the top grab loop in a hook grip (the loop runs along X at y .425 + .035)
  // (no carry grip: the top loop clears the bag by ~1.5 cm, less than one mannequin finger - a hook through it would pass
  // through the bag; carried, a backpack hangs from a shoulder strap - references/hands.md)
  return {};
});

// water bottle (+ cap), drinking glass (o.full), plate: lathe-turned, closed meshes.
kit('water bottle', [.068, .25, .068], 'surface', 'o.color', (g, o) => {
  P(g, lathe('bottle', [[0, 0], [.03, 0], [.034, .006], [.034, .17], [.026, .2], [.015, .222], [.015, .232], [0, .232]]), main(o, M.glass, .1), 0, 0, 0, 'bottle body');
  P(g, cyl(.035, .035, .06, 24), M.white(), 0, .1, 0, 'bottle label');
  P(g, cyl(.017, .017, .022, 16), M.black(), 0, .238, 0, 'bottle cap');
  return { mount: 'surface', grips: { wrap: grip([0, .11, -.035], [-1, 0, 0], [0, 0, 1], { pose: 'wrap', use: 'hold', contact: ['index', 'middle', 'ring', 'thumb'] }) } };
});
kit('glass', [.072, .11, .072], 'surface', 'o.full', (g, o) => {
  P(g, lathe('glass', [[0, 0], [.031, 0], [.036, .11], [.033, .11], [.029, .012], [0, .012]]), M.glass(), 0, 0, 0, 'glass');
  if (o.full) P(g, cyl(.0335, .0305, .06, 20), mat(INV ? 0x3b4a56 : 0xbcd2e0, .1), 0, .045, 0, 'glass water');
  return { mount: 'surface', grips: { wrap: grip([0, .05, -.0335], [-1, 0, 0], [0, 0, 1], { pose: 'wrap', use: 'hold', contact: ['index', 'middle', 'thumb'] }) } };
});
kit('plate', [.26, .022, .26], 'surface', 'top plate', (g, o) => {
  P(g, lathe('plate', [[0, 0], [.07, 0], [.075, .006], [.085, .006], [.13, .018], [.13, .022], [.125, .022], [.085, .011], [0, .011]], 36), main(o, M.ceramic, .3), 0, 0, 0, 'plate');
  return { mount: 'surface', tops: [top('plate', .011, -.08, .08, -.08, .08, { overhang: true })] };
});


// ---------- HOLDABLES: things people carry (each with grips for lib/hands.js hold(); references/hands.md) ----------
// can (33 cl): lathe-turned, pull tab on top. 6.6 x 12.2 cm.
kit('can', [.066, .122, .066], 'surface', 'o.color', (g, o) => {
  P(g, lathe('can', [[0, 0], [.029, 0], [.033, .007], [.033, .112], [.027, .121], [.025, .122], [0, .122]]), main(o, M.red, .3), 0, 0, 0, 'can body');
  Bx(g, .014, .0015, .02, M.metal(), 0, .1215, .006, 'can tab', .0006);
  return { mount: 'surface', grips: { wrap: grip([0, .052, -.033], [-1, 0, 0], [0, 0, 1], { pose: 'wrap', use: 'hold', contact: ['index', 'middle', 'thumb'] }) } };
});
// tablet lying face up (screen +Y, top edge -Z). 17 x 0.7 x 24.5 cm. o.screen
kit('tablet', [.17, .007, .245], 'surface', 'screen +Y, top -Z; o.screen', (g, o) => {
  Bx(g, .17, .007, .245, main(o, M.dark, .4), 0, 0, 0, 'tablet case', .006);
  const s = P(g, cache('tabscr', () => new THREE.PlaneGeometry(.156, .228)), screenMat({ screen: o.screen ?? 'off' }, .156 / .228), 0, .0075, 0, 'tablet screen', [-Math.PI / 2, 0, 0]); s.castShadow = false;
  const edge = sx => grip([sx * .105, -.01, .04], [-sx * .3, 0, -1], [-sx, 0, 0], { pose: 'edge', contact: ['middle', 'thumb'] });   // (read: palm beside the edge, thumb on the front - papers)
  return { mount: 'surface', grips: { read: { ...edge(1), hand: 'R', use: 'read', second: edge(-1) }, look: grip([.105, -.002, .05], [-1, 0, 0], [0, 1, 0], { pose: 'edge', use: 'look' }) } };
});
// open book (a shallow V: two page blocks on the covers, the spine along Z at x 0), read held from below. 32 x 3 x 23 cm.
kit('open book', [.32, .035, .23], 'surface', 'pages +Y, top -Z', (g, o) => {
  const cm = mat(bookColor(o), .8), a = 7 * D2R;
  for (const sx of [-1, 1]) { const half = new THREE.Group(); half.rotation.z = sx * a; g.add(half);
    Bx(half, .157, .004, .232, cm, sx * .0785, 0, 0, 'book cover', .0015); Bx(half, .15, .013, .222, M.paper(), sx * .078, .0035, 0, 'book pages', .002); }
  const edge = sx => grip([sx * .175, -.006, .04], [-sx, 0, 0], [0, 1, 0], { pose: 'edge' });
  return { mount: 'surface', grips: { read: { ...edge(1), hand: 'R', use: 'read', second: edge(-1) } } };
});
// newspaper (tabloid, folded once): printed sheet stack lying, print +Y, top -Z. 29 x 0.5 x 40 cm.
kit('newspaper', [.29, .005, .4], 'surface', 'print +Y, top -Z', (g, o) => {
  const pm = M.paper(), tm = tmat('news' + THEME_ID, 256, 352, (x, W, H) => { x.fillStyle = INV ? '#bfc2c5' : '#efede6'; x.fillRect(0, 0, W, H); x.fillStyle = INV ? '#3c4044' : '#2a2c2f';
    x.fillRect(14, 14, W - 28, 30); x.fillStyle = INV ? '#7a7f84' : '#8f9398'; x.fillRect(14, 54, W * .55, 90); for (let c = 0; c < 3; c++) for (let i = 0; i < 26; i++) x.fillRect(14 + c * (W - 28) / 3, 156 + i * 7, (W - 40) / 3 - 6, 3); }, .95);
  P(g, sb(.29, .005, .4), [pm, pm, tm, pm, pm, pm], 0, .0025, 0, 'newspaper');
  const edge = sx => grip([sx * .165, -.01, -.02], [-sx * .3, 0, -1], [-sx, 0, 0], { pose: 'edge', contact: ['middle', 'thumb'] });   // (read: palm beside the edge, thumb on the front - papers)
  return { mount: 'surface', grips: { read: { ...edge(1), hand: 'R', use: 'read', second: edge(-1) }, carry: grip([0, .0025, -.225], [0, 0, 1], [0, -1, 0], { pose: 'edge', use: 'hang', up: [0, 0, -1], contact: ['index', 'thumb'] }) } };
});
// briefcase standing (handle on top along X, front +Z). 44 x 39 x 10 cm. The handle bar (2 x 1.8 cm) stands 5 cm clear of
// the case: a mannequin finger is 2.5 cm thick and its middle phalanx 3 cm long - at 2.2 cm clear / 2.6 cm deep the hook
// could not pass under and round it, and the fingers lay on the case's face
kit('briefcase', [.44, .39, .1], 'floor', 'handle on top', (g, o) => {
  const cm = main(o, INV ? M.black : M.woodDark, .5), mt = M.metal();
  Bx(g, .44, .32, .1, cm, 0, 0, 0, 'briefcase body', .012);
  for (const sx of [-1, 1]) { Bx(g, .02, .065, .016, mt, sx * .065, .315, 0, 'briefcase handle post', .004); Bx(g, .03, .012, .012, mt, sx * .1, .2, .0505, 'briefcase latch', .002); }
  Bx(g, .155, .02, .018, cm, 0, .37, 0, 'briefcase handle', .008);
  // hook: the palm above the bar, the bar across the middle phalanges, the fingers round it (bar = its centre line for the HOLD wrap test)
  // (contact: the middle finger carries; the index of the female left hand rides 5 mm over the bar - the wrap test covers the chain)
  return { grips: { handle: grip([0, .38 + .062, -.005], [0, -1, 0], [0, 0, -1], { pose: 'hook', use: 'hang', mirror: 'z', contact: ['middle'], bar: [[-.055, .38, 0], [.055, .38, 0], .01] }) } };
});
// shopping bag (paper): body + two rope handles meeting over the top (along X). 30 x 46 x 14 cm.
kit('shopping bag', [.3, .46, .14], 'floor', 'handles on top', (g, o) => {
  const cm = main(o, M.card, .9);
  Bx(g, .3, .34, .14, cm, 0, 0, 0, 'bag body', .004);
  // (the two ropes side by side at the top, 2 cm together: 3.4 cm apart the hook's 3 cm middle phalanx could not get round them;
  // the arch 1 cm lower so the bag hangs no lower under the hand than before the hook fix)
  for (const sz of [-1, 1]) P(g, tor(.07, .005, Math.PI, 16), M.black(), 0, .325, sz * .005, 'bag handle');
  return { grips: { handle: grip([0, .393 + .077, .001], [0, -1, 0], [0, 0, -1], { pose: 'hook', use: 'hang', mirror: 'z', contact: ['middle'], bar: [[-.035, .393, 0], [.035, .393, 0], .01] }) } };
});
// walking cane: shaft, rubber tip, a T handle along Z on top. 83 cm.
kit('cane', [.03, .86, .13], 'floor', 'T handle along Z', (g, o) => {
  const cm = main(o, M.woodDark, .6);
  rod(g, [0, .03, 0], [0, .84, 0], .011, cm, 'cane shaft');
  P(g, cyl(.014, .014, .032, 14), M.black(), 0, .016, 0, 'cane tip');
  rod(g, [0, .845, -.05], [0, .845, .075], .0135, cm, 'cane handle', 14);
  return { grips: { handle: grip([.035, .845 + .0135 + .004, .01], [-1, 0, 0], [0, -1, 0], { pose: 'grip', use: 'hang', mirror: 'x', contact: ['index', 'middle', 'ring'] }) } };
});
// staff / pole: a straight wooden pole with a ferrule. o.h (default 1.7 m).
kit('staff', [.034, 1.7, .034], 'floor', 'o.h', (g, o) => {
  const h = o.h ?? 1.7, cm = main(o, M.wood, .7);
  rod(g, [0, .02, 0], [0, h, 0], .016, cm, 'staff', 14); P(g, cyl(.018, .018, .03, 14), M.metal(), 0, .015, 0, 'staff ferrule');
  const w = (y, sx) => grip([-sx * .03, y, -.016], [sx, 0, 0], [0, 0, 1], { pose: 'grip', contact: ['index', 'middle', 'ring'] });
  return { grips: { two: { ...w(.78, -1), hand: 'R', use: 'pole', second: w(1.06, 1) } } };
});
// broom: handle + head with bristles (bristles at -Y). 1.4 m.
kit('broom', [.3, 1.4, .06], 'floor', 'bristles down', (g, o) => {
  const cm = main(o, M.wood, .7);
  Bx(g, .3, .09, .055, M.fabric(), 0, 0, 0, 'broom bristles', .01); Bx(g, .3, .05, .06, M.woodDark(), 0, .085, 0, 'broom head', .008);
  rod(g, [0, .13, 0], [0, 1.4, 0], .013, cm, 'broom handle', 14);
  const w = (y, sx) => grip([-sx * .03, y, -.013], [sx, 0, 0], [0, 0, 1], { pose: 'grip', contact: ['index', 'middle', 'ring'] });
  return { grips: { two: { ...w(.78, -1), hand: 'R', use: 'pole', second: w(1.06, 1) } } };
});
// baseball bat (knob at the bottom, barrel up). 84 cm.
kit('baseball bat', [.066, .84, .066], 'floor', 'knob down', (g, o) => {
  P(g, lathe('bat', [[0, 0], [.02, 0], [.022, .008], [.015, .016], [.0135, .03], [.0135, .33], [.02, .5], [.03, .68], [.033, .79], [.031, .832], [0, .84]], 20), main(o, M.wood, .55), 0, 0, 0, 'bat');
  const w = (y, sx) => grip([-sx * .03, y, -.0135], [sx, 0, 0], [0, 0, 1], { pose: 'grip', contact: ['index', 'middle', 'ring'] });
  return { grips: { two: { ...w(.2, -1), hand: 'R', use: 'pole', second: w(.1, 1) }, carry: { ...w(.065, -1), use: 'hang', up: [0, -1, 0], hand: 'any', mirror: 'x' } } };
});
// umbrella (open): a J handle at the bottom, shaft, a domed canopy. 95 cm, canopy 1 m across.
kit('umbrella', [1.0, .95, 1.0], 'floor', 'open, handle down', (g, o) => {
  const cm = main(o, M.black, .6);
  P(g, cyl(.014, .014, .12, 16), M.black(), 0, .09, 0, 'umbrella grip'); rod(g, [0, .15, 0], [0, .93, 0], .006, M.metal(), 'umbrella shaft');
  P(g, tor(.03, .011, Math.PI, 12), M.black(), .03, .03, 0, 'umbrella crook', [0, 0, Math.PI]);
  const dome = P(g, cache('umbdome', () => new THREE.SphereGeometry(.62, 28, 10, 0, Math.PI * 2, 0, .9)), cm, 0, .38, 0, 'umbrella canopy'); dome.material = cm;
  P(g, cache('umbunder', () => new THREE.SphereGeometry(.615, 28, 10, 0, Math.PI * 2, 0, .9)), cm, 0, .38, 0, 'umbrella canopy inside').scale.set(1, .985, 1);
  P(g, cyl(.008, .004, .03, 8), M.metal(), 0, 1.0 + .0, 0, 'umbrella ferrule');
  return { grips: { handle: grip([0, .1, -.014], [-1, 0, 0], [0, 0, 1], { pose: 'grip', use: 'umbrella', contact: ['index', 'middle', 'ring'] }) } };
});
// flashlight (torch) lying, beam +Z: body, a wider head, the lens. 21 cm.
kit('flashlight', [.05, .05, .21], 'surface', 'beam +Z', (g, o) => {
  const cm = main(o, M.black, .45), y = .025;
  rod(g, [0, y, -.12], [0, y, .045], .016, cm, 'torch body', 16);
  const hd = P(g, lathe('torchhead', [[0, 0], [.016, 0], [.025, .03], [.025, .05], [0, .05]], 20), cm, 0, y, .04, 'torch head'); hd.rotation.x = Math.PI / 2;
  P(g, cyl(.021, .021, .003, 20), new THREE.MeshBasicMaterial({ color: 0xfff6e0 }), 0, y, .0915, 'torch lens', [Math.PI / 2, 0, 0]);
  return { mount: 'surface', grips: { aim: grip([-.016, y, -.06], [0, 0, 1], [1, 0, 0], { pose: 'wrap', use: 'aim', contact: ['index', 'middle', 'thumb'], clips: ['Idle_Torch_Loop'] }) } };
});
// pen lying, tip +Z. 14 cm.
kit('pen', [.009, .009, .14], 'surface', 'tip +Z', (g, o) => {
  const cm = main(o, M.black, .4); rod(g, [0, .0045, -.07], [0, .0045, .055], .0045, cm, 'pen body', 12);
  const tip = P(g, cyl(.0045, .0008, .015, 12), M.metal(), 0, .0045, .0625, 'pen tip'); tip.rotation.x = Math.PI / 2;
  Bx(g, .002, .006, .035, M.metal(), 0, .006, -.045, 'pen clip', .0008);
  return { mount: 'surface' };   // (no grip yet: the tripod pinch put the index tip through the 9 mm pen - references/hands.md)
});
// handheld microphone: tapered handle, a ball grille on top (+Y). 23 cm.
kit('microphone', [.06, .23, .06], 'surface', 'grille +Y', (g, o) => {
  P(g, lathe('mic', [[0, 0], [.014, 0], [.017, .02], [.021, .17], [0, .17]], 18), main(o, M.black, .4), 0, 0, 0, 'mic handle');
  P(g, sph(.029, 18, 12), M.metal(), 0, .195, 0, 'mic grille');
  return { mount: 'surface', grips: { hold: grip([.03, .08, -.0195], [-1, 0, 0], [0, 0, 1], { pose: 'grip', use: 'mic', tip: [0, .2, 0], contact: ['index', 'middle', 'ring'] }) } };
});
// hammer (the neutral tool): handle along Y, steel head on top. 30 cm.
kit('hammer', [.11, .32, .032], 'surface', 'head on top', (g, o) => {
  rod(g, [0, 0, 0], [0, .3, 0], .014, main(o, M.wood, .6), 'hammer handle', 14);
  Bx(g, .11, .032, .03, M.metal(), .015, .29, 0, 'hammer head', .006);
  return { mount: 'surface', grips: { handle: grip([.03, .08, -.014], [-1, 0, 0], [0, 0, 1], { pose: 'grip', use: 'hang', up: [0, -1, 0], contact: ['index', 'middle', 'ring'] }) } };
});
// tray with a raised rim. 46 x 3 x 34 cm.
kit('tray', [.46, .03, .34], 'surface', "top 'tray'", (g, o) => {
  const cm = main(o, M.woodDark, .6);
  Bx(g, .46, .01, .34, cm, 0, 0, 0, 'tray base', .004);
  for (const sx of [-1, 1]) Bx(g, .012, .03, .34, cm, sx * .224, 0, 0, 'tray rim', .004);
  for (const sz of [-1, 1]) Bx(g, .436, .03, .012, cm, 0, 0, sz * .164, 'tray rim', .004);
  const und = sx => grip([sx * .185, 0, -.13], [0, 0, 1], [0, 1, 0], { pose: 'flat' });   // flat under the back corners, fingers forward: the forearms stay behind the tray
  return { mount: 'surface', tops: [top('tray', .01, -.21, .21, -.15, .15)], grips: { two: { ...und(-1), hand: 'R', use: 'tray', second: und(1) } } };
});
// steering wheel on a column (rim faces +Z, the driver's side). Wheel 38 cm across, centre at 0.72 m.
kit('steering wheel', [.4, .92, .45], 'floor', 'driver at +Z', (g, o) => {
  const cm = main(o, M.black, .5), c = V(0, .72, 0), tilt = 22 * D2R, wg = new THREE.Group(); wg.position.copy(c); wg.rotation.x = -tilt; g.add(wg);
  P(wg, tor(.19, .015, Math.PI * 2, 40), cm, 0, 0, 0, 'wheel rim'); P(wg, cyl(.05, .05, .05, 20), cm, 0, 0, -.01, 'wheel hub', [Math.PI / 2, 0, 0]);
  for (const a of [Math.PI / 2 + Math.PI / 2, 0, Math.PI]) rod(wg, [0, 0, -.005], [Math.cos(a - Math.PI / 2) * .18, Math.sin(a - Math.PI / 2) * .18, -.005], .012, cm, 'wheel spoke');
  rod(g, [0, .72, -.03], [0, .3, -.2], .03, cm, 'wheel column'); Bx(g, .2, .3, .2, M.body2(), 0, 0, -.25, 'wheel pedestal', .02);
  const rim = (deg, hand) => { const a = deg * D2R, rd = V(Math.cos(a), Math.sin(a), 0), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-tilt, 0, 0));
    const p = rd.clone().multiplyScalar(.19 - .045).add(V(0, 0, .015)).applyQuaternion(q).add(c), F = rd.clone().applyQuaternion(q), N = V(0, 0, -1).applyQuaternion(q);
    return grip(p.toArray(), F.toArray(), N.toArray(), { pose: 'wrap', hand, palmTouch: false, contact: ['index', 'middle', 'ring'] }); };
  return { grips: { drive: { ...rim(30, 'R'), use: 'wheel', second: rim(150, 'L'), clips: ['Driving_Loop'] } } };
});
// placard: a board (face +Z) on a stick. Board 60 x 40 cm, 1.45 m tall. o.draw(ctx, w, h) paints the face.
kit('placard', [.6, 1.45, .04], 'floor', 'face +Z; o.draw', (g, o) => {
  const bm = o.draw ? new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 342; o.draw(c.getContext('2d'), 512, 342); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), roughness: .9 }) : M.card();
  rod(g, [0, 0, -.02], [0, 1.2, -.02], .014, M.wood(), 'placard stick', 12);
  P(g, sb(.6, .4, .012), [M.card(), M.card(), M.card(), M.card(), bm, M.card()], 0, 1.24, 0, 'placard board');
  const w = (y, sx) => grip([-sx * .03, y, -.034], [sx, 0, 0], [0, 0, 1], { pose: 'grip', contact: ['index', 'middle', 'ring'] });
  return { grips: { two: { ...w(.64, -1), hand: 'R', use: 'sign', second: w(.84, 1) } } };
});
// key: a bow (head) and a blade, lying. 6.5 cm.
kit('key', [.028, .003, .066], 'surface', 'blade +Z', (g, o) => {
  Bx(g, .028, .003, .026, main(o, M.metal, .35), 0, 0, -.02, 'key bow', .0012); Bx(g, .009, .0026, .042, M.metal(), 0, .0002, .013, 'key blade', .0009);
  return { mount: 'surface', grips: { pinch: grip([-.065, .0, -.03], [1, 0, 0], [0, 1, 0], { pose: 'pinch', use: 'show', palmTouch: false }) } };
});
// ID card / badge standing (face +Z). 5.4 x 8.6 cm.
kit('id card', [.054, .086, .0016], 'surface', 'face +Z', (g, o) => {
  const tm = tmat('idcard' + THEME_ID, 128, 204, (x, W, H) => { x.fillStyle = '#f2f3f5'; x.fillRect(0, 0, W, H); x.fillStyle = '#3d6fb5'; x.fillRect(0, 0, W, 34); x.fillStyle = '#9aa3ad'; x.fillRect(30, 52, 68, 80); x.fillStyle = '#5c636b'; x.fillRect(16, 146, 96, 10); x.fillRect(16, 166, 70, 8); }, .5);
  P(g, sb(.054, .086, .0016), [M.white(), M.white(), M.white(), M.white(), tm, M.white()], 0, .043, 0, 'id card');
  return { mount: 'surface', grips: { show: grip([0, -.045, -.03], [0, 1, 0], [0, 0, 1], { pose: 'pinch', use: 'show', palmTouch: false }) } };
});
// phone handset (from a desk phone) lying: ear cup at -Z (top), mouth cup at +Z, cups open +Y. 21 cm.
kit('phone handset', [.05, .036, .21], 'surface', 'cups +Y, ear -Z', (g, o) => {
  const pm = main(o, INV ? M.black : M.body2, .45);
  Bx(g, .042, .026, .14, pm, 0, 0, 0, 'handset grip', .011);
  for (const sz of [-1, 1]) Bx(g, .05, .034, .058, pm, 0, .002, sz * .075, 'handset cup', .014);
  // pick: from above (the palm on the grip bar, fingers round it) - how a hand takes it off the cradle; ear uses it at a pick-up
  return { mount: 'surface', grips: { ear: grip([.042, 0, 0], [-1, 0, 0], [0, 1, 0], { pose: 'wrap', use: 'ear', tip: [0, .036, -.075], contact: ['index', 'middle'], pick: 'pick' }),
    pick: grip([0, .03, 0], [-1, 0, 0], [0, -1, 0], { pose: 'wrap', use: 'clip', pickOnly: true, contact: ['index', 'middle', 'thumb'] }) } };
});

// ---------- prop(kind, o) ----------
/** prop(kind, o): one kit prop (a THREE.Group, not yet in the scene; place() puts it somewhere). */
export function prop(kind, o = {}) {
  const k = K[kind]; if (!k) throw new Error(`prop: unknown kind "${kind}". Kinds: ${Object.keys(K).join(', ')}`);
  if (k.build) { const g = k.build(o); if (!g?.userData?.prop) propInfo(g); return g; }
  const g = new THREE.Group(); const meta = k.fn(g, o) || {}; meta.mount ??= k.mount;
  return finish(g, kind, o, meta);
}
/** PROP_KINDS: { kind: { size: [w, h, d] (default, metres), mount, note } } */
export const PROP_KINDS = Object.fromEntries(Object.entries(K).map(([k, v]) => [k, { size: v.size, mount: v.mount, note: v.note }]));
/** defineProp(kind, build(o) -> Group following the contract, { size, mount, note }): a project's own verified prop
 *  (lib/props/<name>.js) joins prop(kind) and arrange presets. */
export function defineProp(kind, build, info = {}) {
  K[kind] = { size: info.size, mount: info.mount ?? 'floor', note: info.note ?? '', build };
  PROP_KINDS[kind] = { size: info.size, mount: info.mount ?? 'floor', note: info.note ?? '' };
}
/** propGroup(kind, o, build(g) -> meta): for a designer agent - build parts into g (y up from 0, front +Z) and get the
 *  contract (recentred, measured, named, selectable) exactly like the kit's own props. meta: { tops, seat, solids, mount } */
export const propGroup = (kind, o, build) => { const g = new THREE.Group(); const meta = build(g) || {}; return finish(g, kind, o || {}, meta); };
export { P as part, Bx as boxPart, rod as rodPart, rb as roundedBox, cyl as cylinder, lathe as latheGeo, M as PMAT, PAL as PALETTE, screenMat };

// =====================================================================================================================
// PLACEMENT
// =====================================================================================================================
const REST = .0008, INSET = .01;
const objOf = x => x == null ? null : x.isObject3D ? x : (x.group ?? x.g ?? x.root ?? x.mesh ?? null);
/** propInfo(obj): the prop contract of any object (kit props carry it; anything else is measured once: its box in its own frame) */
export function propInfo(obj) {
  obj = objOf(obj); if (obj.userData.prop) return obj.userData.prop;
  obj.updateMatrixWorld(true); const inv = obj.matrixWorld.clone().invert(), b = new THREE.Box3(), tmp = new THREE.Box3();
  obj.traverse(m => { if (!m.isMesh || !m.geometry) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); tmp.copy(m.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); b.union(tmp); });
  if (b.isEmpty()) b.set(V(-.05, 0, -.05), V(.05, .1, .05));
  const p = { kind: obj.name || obj.userData.kind || 'object', size: [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map(r4), front: [0, 0, 1], mount: 'floor', unknown: true,
    box: [b.min.x, b.max.x, b.min.z, b.max.z], bottom: b.min.y, tops: [top('top', b.max.y, b.min.x, b.max.x, b.min.z, b.max.z, { raycast: true, overhang: true })] };
  obj.userData.prop = p; return p;
}
const nameOf = o => (o?.name || o?.userData?.prop?.kind || 'object');
const yawOf = m4 => Math.atan2(m4.elements[8], m4.elements[10]);
function targetPoint(S, f) {
  if (f == null || typeof f === 'number') return null;
  if (f === 'camera') { const k = S.keys?.[0]; if (k?.p) return V(...k.p); throw new Error("place: face 'camera' needs S.camera([...]) called before place() (its first key is used) - better: face a person, a chair or a point [x, z]"); }
  if (Array.isArray(f)) return f.length === 2 ? V(f[0], 0, f[1]) : V(...f);
  if (f.isVector3) return f.clone();
  const o = objOf(f); if (!o) return null; o.updateMatrixWorld(true);
  const p = o.userData.prop; if (p?.seat) return o.localToWorld(V(0, p.seat.y, p.seat.z));
  return o.getWorldPosition(V());
}
// the world yaw that turns an object's +Z toward the target (or the given degrees, or null = keep)
function faceYaw(S, f, from, sup) {
  if (f == null) return null;
  if (typeof f === 'number') return f * D2R;
  if (f === 'support-front' || f === 'support-back') { if (!sup) return null; sup.updateMatrixWorld(true); return yawOf(sup.matrixWorld) + (f === 'support-back' ? Math.PI : 0); }
  const q = targetPoint(S, f); if (!q) return null; const dx = q.x - from.x, dz = q.z - from.z; if (Math.hypot(dx, dz) < 1e-4) return null; return Math.atan2(dx, dz);
}
// footprint rectangles: { cx, cz, hw, hd, c, s } in some frame (axes: local x -> (c, -s), local z -> (s, c))
const rectOf = (P, x, z, yaw, box = P.foot ?? P.box, pad = 0) => { const c = Math.cos(yaw), s = Math.sin(yaw), ox = (box[0] + box[1]) / 2, oz = (box[2] + box[3]) / 2;
  return { cx: x + ox * c + oz * s, cz: z - ox * s + oz * c, hw: (box[1] - box[0]) / 2 + pad, hd: (box[3] - box[2]) / 2 + pad, c, s }; };
const extent = r => [Math.abs(r.c) * r.hw + Math.abs(r.s) * r.hd, Math.abs(r.s) * r.hw + Math.abs(r.c) * r.hd];
function overlap2(A, B, tol = .002) {
  for (const [nx, nz] of [[A.c, -A.s], [A.s, A.c], [B.c, -B.s], [B.s, B.c]]) {
    const ra = A.hw * Math.abs(A.c * nx - A.s * nz) + A.hd * Math.abs(A.s * nx + A.c * nz), rb2 = B.hw * Math.abs(B.c * nx - B.s * nz) + B.hd * Math.abs(B.s * nx + B.c * nz);
    if (Math.abs((B.cx - A.cx) * nx + (B.cz - A.cz) * nz) >= ra + rb2 - tol) return false; }
  return true;
}
function topOf(P, name) {
  const T = P.tops || []; if (!T.length) return null;
  if (name == null) return T[0]; if (typeof name === 'number') return T[name] ?? null;
  return T.find(t => t.name === name) ?? null;
}
const SLOTS = { 'back-left': [0, 1], 'back-center': [.5, 1], 'back-right': [1, 1], left: [0, .5], center: [.5, .5], right: [1, .5], 'front-left': [0, .08], 'front-center': [.5, .08], 'front-right': [1, .08] };
const grounds = S => { const g = []; S.scene.traverse(o => { if (o.isMesh && o.userData.ground && o.visible !== false) g.push(o); }); if (S.floor && !g.includes(S.floor)) g.push(S.floor); return g; };
const RC = new THREE.Raycaster();
function groundY(S, pts, skip) {
  const G = grounds(S).filter(o => !skip || !isInside(o, skip)); let best = -Infinity;
  for (const p of pts) { RC.set(V(p[0], 200, p[1]), V(0, -1, 0)); RC.far = 400; const h = RC.intersectObjects(G, false)[0]; if (h) best = Math.max(best, h.point.y); }
  return isFinite(best) ? best : (S.floor?.position.y ?? 0);
}
const isInside = (a, b) => { for (let o = a; o; o = o.parent) if (o === b) return true; return false; };
const corners = r => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [r.cx + a * r.hw * r.c + b * r.hd * r.s, r.cz - a * r.hw * r.s + b * r.hd * r.c]);
const reg = S => (S._placed ??= []);

/** place(S, item, o) -> item. See references/props.md. o: { on: 'floor' | support | 'wall' | 'ceiling', at, slot, uv,
 *  local: [x, z] (support frame), top (support surface name), face, yaw (deg, extra turn), nudge (m), parent } */
export function place(S, item, o = {}) {
  item = objOf(item); const P = propInfo(item), on = o.on ?? (P.mount === 'wall' ? 'wall' : P.mount === 'ceiling' ? 'ceiling' : 'floor');
  if (on === 'floor' || on === 'ground') return placeFloor(S, item, P, o);
  if (on === 'wall') return placeWall(S, item, P, o);
  if (on === 'ceiling') return placeCeiling(S, item, P, o);
  return placeOn(S, item, P, objOf(on), o);
}
const bottomOf = P => P.bottom ?? 0;
function setYaw(item, yaw) { item.rotation.set(0, yaw, 0); }

function placeFloor(S, item, P, o) {
  const at = o.at ?? [0, 0], x = at[0], z = at.length === 3 ? at[2] : at[1], parent = objOf(o.parent) ?? S.scene;
  let yaw = faceYaw(S, o.face, V(x, 0, z), null); yaw = (yaw ?? 0) + (o.yaw ?? 0) * D2R;
  const L = reg(S), mine = L.filter(r => r.kind === 'floor' && r.parent === parent);
  const fits = (px, pz) => { const A = solidsAt(P, px, pz, yaw); for (const r of mine) { r.item.updateMatrixWorld(true); const B = solidsOfItem(r.item); for (const a of A) for (const b of B) if (a.y1 > b.y0 + .002 && b.y1 > a.y0 + .002 && overlap2(a.r, b.r)) return r; } return null; };
  let px = x, pz = z, hit = fits(px, pz);
  if (hit) { const lim = o.nudge ?? .25, cand = []; for (let r = .01; r <= lim + 1e-6; r += .01) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; cand.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); }
    const free = cand.find(([cx, cz]) => !fits(cx, cz)); if (!free) throw new Error(`place: "${nameOf(item)}" at [${x.toFixed(2)}, ${z.toFixed(2)}] overlaps "${nameOf(hit.item)}" on the floor and no free spot within ${lim} m: move one of them (or pass nudge: metres)`);
    [px, pz] = free; }
  const rect = rectOf(P, px, pz, yaw), gy = groundY(S, [[px, pz], ...corners(rect)], item);
  parent.add(item); setYaw(item, yaw); item.position.set(px, gy - bottomOf(P), pz);
  if (parent !== S.scene) { parent.updateMatrixWorld(true); const w = item.position.clone(); item.position.copy(parent.worldToLocal(w)); item.rotation.y = yaw - yawOf(parent.matrixWorld); }
  L.push({ kind: 'floor', item, parent, gy, at: [px, pz], face: o.face != null && typeof o.face !== 'number' && !String(o.face).startsWith('support') ? o.face : null, yawOff: (o.yaw ?? 0) * D2R });
  return item;
}
// solids of a prop at (x, z, yaw) in world plan: [{ r: rect, y0, y1 }]
function solidsAt(P, x, z, yaw, y = 0) {
  const ss = P.solids ?? [{ x0: P.box[0], x1: P.box[1], z0: P.box[2], z1: P.box[3], y0: 0, y1: P.size[1] }];
  return ss.map(s => ({ r: rectOf(P, x, z, yaw, [s.x0, s.x1, s.z0, s.z1]), y0: y + s.y0, y1: y + s.y1 }));
}
function solidsOfItem(item) { const P = propInfo(item), m = item.matrixWorld, p = V().setFromMatrixPosition(m); return solidsAt(P, p.x, p.z, yawOf(m), p.y + bottomOf(P)); }

function placeWall(S, item, P, o) {
  const at = o.at ?? [0, 1, 0], parent = objOf(o.parent) ?? S.scene, base = V(at[0], at[1], at[2]);
  let yaw = faceYaw(S, o.face, base, null); if (yaw == null) yaw = 0; yaw += (o.yaw ?? 0) * D2R;
  const f = V(Math.sin(yaw), 0, Math.cos(yaw));
  // snap the back onto a wall within 40 cm behind `at`
  const objs = []; S.scene.traverse(m => { if (m.isMesh && !isInside(m, item) && m.visible !== false) objs.push(m); });
  RC.set(base.clone().addScaledVector(f, .4), f.clone().negate()); RC.far = .8; const h = RC.intersectObjects(objs, false)[0];
  const back = h ? h.point.clone() : base; back.y = at[1];
  parent.add(item); setYaw(item, yaw); item.position.copy(back.addScaledVector(f, (P.box[3] - P.box[2]) / 2 + REST)); item.position.y = at[1] - bottomOf(P);
  reg(S).push({ kind: 'wall', item, face: null });
  return item;
}
function placeCeiling(S, item, P, o) {
  const at = o.at ?? [0, 0], x = at[0], z = at.length === 3 ? at[2] : at[1], parent = objOf(o.parent) ?? S.scene;
  let cy = o.y;
  if (cy == null) { const objs = []; S.scene.traverse(m => { if (m.isMesh && !isInside(m, item) && m.visible !== false) objs.push(m); }); RC.set(V(x, .3, z), V(0, 1, 0)); RC.far = 30; const h = RC.intersectObjects(objs, false)[0];
    if (!h) throw new Error(`place: no ceiling above [${x}, ${z}] for "${nameOf(item)}": pass y (the ceiling height)`); cy = h.point.y; }
  parent.add(item); setYaw(item, (faceYaw(S, o.face, V(x, 0, z), null) ?? 0) + (o.yaw ?? 0) * D2R); item.position.set(x, cy - P.size[1] + REST, z); item.userData.noContact = true;
  reg(S).push({ kind: 'ceiling', item, face: null });
  return item;
}

function placeOn(S, item, P, sup, o) {
  if (!sup) throw new Error(`place: "${nameOf(item)}": on must be 'floor', 'wall', 'ceiling' or an object`);
  const SP = propInfo(sup), T = topOf(SP, o.top);
  if (!T) throw new Error(`place: "${nameOf(sup)}" has no support surface${o.top != null ? ` named "${o.top}"` : ''} (tops: ${(SP.tops || []).map(t => t.name).join(', ') || 'none'})`);
  sup.updateMatrixWorld(true);
  const W = T.x1 - T.x0, D = T.z1 - T.z0, sy = yawOf(sup.matrixWorld);
  // where: local [x, z] | world at | uv | slot (u: 0 = left .. 1 = right seen from the support's front, v: 0 = front .. 1 = back)
  let lx, lz;
  if (o.local) [lx, lz] = o.local;
  else if (o.at) { const w = o.at.length === 3 ? V(...o.at) : V(o.at[0], 0, o.at[1]); const q = sup.worldToLocal(w); lx = q.x; lz = q.z; }
  else { const uv = o.uv ?? SLOTS[o.slot ?? 'center']; if (!uv) throw new Error(`place: unknown slot "${o.slot}" (slots: ${Object.keys(SLOTS).join(', ')}, or uv: [u, v])`); lx = T.x0 + uv[0] * W; lz = T.z1 - uv[1] * D; }
  // facing: local yaw relative to the support
  const wpos = sup.localToWorld(V(lx, T.y, lz)), fy = faceYaw(S, o.face, wpos, sup);
  const yaw = (fy == null ? 0 : fy - sy) + (o.yaw ?? 0) * D2R;
  const hgt = P.size[1];
  if (T.clear != null && hgt > T.clear + 1e-4) throw new Error(`place: "${nameOf(item)}" is ${(hgt * 100).toFixed(0)} cm tall but "${nameOf(sup)}" ${T.name} has ${(T.clear * 100).toFixed(0)} cm of room above it`);
  // keep the footprint inside the surface (1 cm in) - or, on a stack (overhang), the centre over the surface
  const clampIn = (x, z) => { const r = rectOf(P, x, z, yaw), [ex, ez] = extent(r), ox = r.cx - x, oz = r.cz - z;
    if (T.overhang) return [clamp(x, T.x0 + INSET - ox, T.x1 - INSET - ox), clamp(z, T.z0 + INSET - oz, T.z1 - INSET - oz)];
    if (2 * ex > W - 2 * INSET + 1e-6 || 2 * ez > D - 2 * INSET + 1e-6) return null;
    return [clamp(r.cx, T.x0 + INSET + ex, T.x1 - INSET - ex) - ox, clamp(r.cz, T.z0 + INSET + ez, T.z1 - INSET - ez) - oz]; };
  const want = clampIn(lx, lz);
  if (!want) throw new Error(`place: "${nameOf(item)}" (${P.size.map(v => (v * 100).toFixed(0)).join(' x ')} cm) does not fit on "${nameOf(sup)}" ${T.name} (${(W * 100).toFixed(0)} x ${(D * 100).toFixed(0)} cm): pick a bigger support or turn it (yaw)`);
  const L = reg(S), mine = L.filter(r => r.kind === 'on' && r.sup === sup && r.top === T.name);
  const hitAt = (x, z) => { const A = rectOf(P, x, z, yaw); for (const r of mine) { const B = curRect(r); if (B && overlap2(A, B)) return r; } return null; };
  let [px, pz] = want, hit = hitAt(px, pz);
  if (hit) { const lim = o.nudge ?? .12, step = .01, cand = [];
    for (let x = T.x0; x <= T.x1 + 1e-6; x += step) for (let z = T.z0; z <= T.z1 + 1e-6; z += step) { const c = clampIn(x, z); if (c) cand.push(c); }
    cand.sort((a, b) => Math.hypot(a[0] - want[0], a[1] - want[1]) - Math.hypot(b[0] - want[0], b[1] - want[1]));
    const free = cand.filter(c => !hitAt(c[0], c[1])), near = free.find(c => Math.hypot(c[0] - want[0], c[1] - want[1]) <= lim);
    if (!near) { const uvs = free.length ? `free spots that fit it exist elsewhere, e.g. uv [${((free[0][0] - T.x0) / W).toFixed(2)}, ${((T.z1 - free[0][1]) / D).toFixed(2)}]` : `no spot on the whole ${T.name} fits it (items there: ${mine.map(r => nameOf(r.item)).join(', ')})`;
      throw new Error(`place: "${nameOf(item)}" would overlap "${nameOf(hit.item)}" on "${nameOf(sup)}" ${T.name} and there is no free spot within ${(lim * 100).toFixed(0)} cm of the one asked for: ${uvs}. Choose another slot/uv, a smaller item, or leave it out.`); }
    [px, pz] = near; }
  // rest: on the surface (raycast for unknown supports), 0.8 mm above it
  let y = T.y;
  if (T.raycast) { const r = rectOf(P, px, pz, yaw), pts = [[px, pz], ...corners(r).map(([a, b]) => [px + (a - px) * .9, pz + (b - pz) * .9])]; let best = -Infinity; const meshes = []; sup.traverse(m => { if (m.isMesh) meshes.push(m); });
    for (const [a, b] of pts) { const w0 = sup.localToWorld(V(a, T.y + .5, b)); RC.set(w0, V(0, -1, 0)); RC.far = 2; const h = RC.intersectObjects(meshes, false)[0]; if (h) best = Math.max(best, sup.worldToLocal(h.point.clone()).y); }
    if (isFinite(best)) y = best; }
  sup.add(item); setYaw(item, yaw); item.position.set(px, y + REST - bottomOf(P), pz);
  L.push({ kind: 'on', item, sup, top: T.name, T, face: o.face != null && typeof o.face !== 'number' && !String(o.face).startsWith('support') ? o.face : null, yawOff: (o.yaw ?? 0) * D2R });
  return item;
}
// a registered item's footprint now, in its support's frame (it may have been moved after place())
function curRect(r) {
  const P = propInfo(r.item); if (r.item.parent === r.sup) return rectOf(P, r.item.position.x, r.item.position.z, r.item.rotation.y);
  if (!r.item.parent) return null; r.sup.updateMatrixWorld(true); r.item.updateMatrixWorld(true);
  const m = new THREE.Matrix4().multiplyMatrices(r.sup.matrixWorld.clone().invert(), r.item.matrixWorld), p = V().setFromMatrixPosition(m); return rectOf(P, p.x, p.z, yawOf(m));
}

// ---------- PLACEMENT check (check_layout) ----------
/** placementIssues(S) -> [{ type: 'PLACEMENT', detail }]: items no longer on their support, outside it, overlapping, or
 *  turned away (> 70 deg) from what they face. Cheap: only registered items. */
export function placementIssues(S) {
  const L = S?._placed; if (!L?.length) return [];
  const out = [], say = d => out.push({ type: 'PLACEMENT', detail: d });
  for (const r of L) {
    const it = r.item; if (!it.parent || !isInside(it, S.scene)) continue; let hidden = false; for (let p = it; p; p = p.parent) if (p.visible === false) hidden = true; if (hidden) continue;
    if (it.userData.heldNow || it.parent?.isBone) continue;   // in a hand right now (lib/hands.js hold(): picked up, put back later) - the HOLD check judges it

    const P = propInfo(it), nm = nameOf(it);
    it.updateMatrixWorld(true);
    if (r.kind === 'on') { const sn = nameOf(r.sup), R = curRect(r); if (!R) continue;
      const m = new THREE.Matrix4().multiplyMatrices(r.sup.matrixWorld.clone().invert(), it.matrixWorld), ly = new THREE.Vector3().setFromMatrixPosition(m).y + bottomOf(P);
      const gap = ly - r.T.y - REST; if (Math.abs(gap) > .01) say(`"${nm}" no longer rests on "${sn}" ${r.T.name}: its bottom is ${Math.abs(gap * 100).toFixed(1)} cm ${gap > 0 ? 'above' : 'below'} it (moved after place()? place it again, or animate the support instead)`);
      const cs = r.T.overhang ? [[R.cx, R.cz]] : corners(R), T = r.T, out5 = cs.some(([x, z]) => x < T.x0 - .005 || x > T.x1 + .005 || z < T.z0 - .005 || z > T.z1 + .005);
      if (out5) say(`"${nm}" sticks out past the edge of "${sn}" ${T.name}: move it inward (slot/uv) or use a bigger support`); }
    if (r.kind === 'floor') { const p = V().setFromMatrixPosition(it.matrixWorld), moved = Math.hypot(p.x - r.at[0], p.z - r.at[1]) > .01, gy = moved ? groundY(S, [[p.x, p.z]], it) : r.gy, gap = p.y + bottomOf(P) - gy;
      if (Math.abs(gap) > .01) say(`"${nm}" is ${Math.abs(gap * 100).toFixed(1)} cm ${gap > 0 ? 'above' : 'below'} the floor under it: place() it again where it stands`); }
    if (r.face != null) { let q = null; try { q = targetPoint(S, r.face); } catch { q = null; }
      if (q) { const p = V().setFromMatrixPosition(it.matrixWorld), f = V(0, 0, 1).transformDirection(it.matrixWorld), dx = q.x - p.x, dz = q.z - p.z, dl = Math.hypot(dx, dz), fl = Math.hypot(f.x, f.z);
        if (dl > .05 && fl > .1) { const a = Math.acos(clamp((f.x * dx + f.z * dz) / (dl * fl), -1, 1)) - Math.abs(r.yawOff); if (a > 70 * D2R) say(`"${nm}" faces ${(a / D2R).toFixed(0)} deg away from what it should face ("${typeof r.face === 'object' && !Array.isArray(r.face) ? nameOf(objOf(r.face) ?? r.face) : r.face}"): turn it (place(..., { face }))`); } } }
  }
  // overlaps between items on the same surface / on the floor
  const groups = new Map(); for (const r of L) if (r.kind === 'on' && r.item.parent) { const k = r.sup.uuid + '|' + r.top; (groups.get(k) ?? groups.set(k, []).get(k)).push(r); }
  for (const rs of groups.values()) for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const A = curRect(rs[i]), B = curRect(rs[j]); if (A && B && overlap2(A, B, .004)) say(`"${nameOf(rs[i].item)}" and "${nameOf(rs[j].item)}" overlap on "${nameOf(rs[i].sup)}" ${rs[i].top}: they pass through each other (place them again: place() finds free room)`); }
  const fl = L.filter(r => r.kind === 'floor' && r.item.parent && isInside(r.item, S.scene));
  for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { const A = solidsOfItem(fl[i].item), B = solidsOfItem(fl[j].item);
    if (A.some(a => B.some(b => a.y1 > b.y0 + .004 && b.y1 > a.y0 + .004 && overlap2(a.r, b.r, .004)))) say(`"${nameOf(fl[i].item)}" and "${nameOf(fl[j].item)}" pass through each other on the floor: move one (place() keeps floor things apart)`); }
  return out;
}
ENG.LAYOUT_CHECKS?.push(S => placementIssues(S));

// =====================================================================================================================
// ARRANGE: sensible, intentional layouts (everything goes through place(), so every rule holds)
// =====================================================================================================================
const spec = it => typeof it === 'string' ? { kind: it } : it;
const short = { lamp: 'desk lamp', phone: 'desk phone', books: 'book stack', plant: 'desk plant' };
export const arrange = {
  /** arrange.desk(S, desk, { sitter, items, hand: 'right' | 'left', top }) -> { [kind]: object }: a work desk seen from the
   *  sitter: monitor at the back facing them, keyboard in front of it ~10 cm from the edge, mouse on the dominant side,
   *  lamp at the back corner on the other side aimed at the work area, mug/phone to the dominant side, papers to the other. */
  desk(S, desk, o = {}) {
    desk = objOf(desk); const P = propInfo(desk), T = topOf(P, o.top); if (!T) throw new Error(`arrange.desk: "${nameOf(desk)}" has no top`);
    desk.updateMatrixWorld(true);
    const W = T.x1 - T.x0, D = T.z1 - T.z0, items = (o.items ?? ['monitor', 'keyboard', 'mouse', 'desk lamp', 'mug', 'papers']).map(spec);
    let flip = false, cx = (T.x0 + T.x1) / 2;
    if (o.sitter) { const q = desk.worldToLocal(targetPoint(S, o.sitter)); flip = q.z < (T.z0 + T.z1) / 2; cx = clamp(q.x, T.x0 + .3, T.x1 - .3); }
    const hand = (o.hand ?? 'right') === 'right' ? 1 : -1, sgn = flip ? -1 : 1;
    // local point: ux = metres to the sitter's right of the work centre, dz = metres in from the sitter's edge
    const at = (ux, dz) => [cx + sgn * ux, flip ? T.z0 + dz : T.z1 - dz];
    const faceS = o.sitter ?? (flip ? 'support-back' : 'support-front'), along = flip ? 'support-back' : 'support-front';
    const res = {}, put = (key, it, local, face, extra = {}) => { const ob = place(S, it, { on: desk, top: T.name, local, face, nudge: .15, ...extra }); (res[key] ? (res[key] = [].concat(res[key], ob)) : res[key] = ob); return ob; };
    const has = k => items.some(i => (short[i.kind] ?? i.kind) === k);
    const kb = prop('keyboard'), kw = kb.userData.prop.size[0], kd = kb.userData.prop.size[2];
    for (const it of items) { const kind = short[it.kind] ?? it.kind, op = { ...it }; delete op.kind;
      switch (kind) {
        case 'monitor': { const m = prop('monitor', op), md = m.userData.prop.size[2]; put('monitor', m, at(0, D - md / 2 - .03), faceS); break; }
        case 'laptop': { const m = prop('laptop', op); put('laptop', m, has('monitor') ? at(-hand * (W * .3), .32) : at(0, .3), faceS); break; }
        case 'keyboard': put('keyboard', kb, at(0, .1 + kd / 2), along); break;
        case 'mouse': put('mouse', prop('mouse', op), at(hand * (kw / 2 + .11), .1 + kd / 2), along); break;
        case 'desk lamp': { const l = prop('desk lamp', op), w0 = at(0, .3), aim = desk.localToWorld(V(w0[0], T.y, w0[1]));   // base in the back corner, head aimed at the work area
          put('desk lamp', l, at(-hand * (W / 2 - .12), D - .12), aim); break; }
        case 'mug': put('mug', prop('mug', op), at(hand * (kw / 2 + .26), .36), along); break;
        case 'papers': put('papers', prop('papers', op), at(-hand * (kw / 2 + .2), .24), along, { yaw: 7 * -hand }); break;
        case 'folder': put('folder', prop('folder', op), at(-hand * (kw / 2 + .22), .3), along, { yaw: -4 * hand }); break;
        // (within a seated reach on the free hand's side: in the back corner the handset was 45 cm out of reach - charstress)
        case 'desk phone': put('desk phone', prop('desk phone', op), at(-hand * (kw / 2 + .2), .27), faceS); break;
        case 'smartphone': put('smartphone', prop('smartphone', op), at(hand * (kw / 2 + .12), .3), along, { yaw: -10 * hand }); break;
        case 'book stack': { const n = op.n ?? 2; let below = put('books', prop('book', { seed: 11 }), at(-hand * (W / 2 - .14), .45), along, { yaw: 3 });
          for (let i = 1; i < n; i++) below = place(S, prop('book', { seed: 11 + i * 5, w: .15 - i * .01, d: .22 - i * .015 }), { on: below, yaw: (i % 2 ? -5 : 4) }); break; }
        case 'desk plant': put('plant', prop('potted plant', { h: .3, seed: 4, ...op }), at(hand * (W / 2 - .14), D - .14), along); break;
        default: put(kind, prop(kind, op), at(0, D * .5), faceS);
      } }
    return res;
  },
  /** arrange.shelf(S, shelf, { seed, fill: .75, items: [[kinds for shelf 1], ...] }): book rows (left or right aligned,
   *  alternating) with a small object or a lying stack beside them on some shelves. */
  shelf(S, shelf, o = {}) {
    shelf = objOf(shelf); const P = propInfo(shelf), seed = o.seed ?? 5, res = [];
    for (const [i, T] of (P.tops || []).filter(t => /^shelf/.test(t.name)).entries()) {
      const W = T.x1 - T.x0, D = T.z1 - T.z0, left = (i + seed) % 2 === 0, h = Math.min(.26, (T.clear ?? .3) - .02), list = o.items?.[i];
      if (list) { for (const k of list.map(spec)) { const op = { ...k }; delete op.kind; res.push(place(S, prop(k.kind, op), { on: shelf, top: T.name, slot: 'center', nudge: W, face: 'support-front' })); } continue; }
      const rw = W * (o.fill ?? (.5 + hh(seed + i, 9) * .35)), row = prop('book row', { w: rw, h, seed: seed * 7 + i * 13, lean: hh(seed + i, 4) > .5 });
      const rs = row.userData.prop.size; res.push(place(S, row, { on: shelf, top: T.name, local: [left ? T.x0 + INSET + rs[0] / 2 : T.x1 - INSET - rs[0] / 2, T.z1 - INSET - rs[2] / 2], face: 'support-front' }));
      const free = W - rs[0] - 2 * INSET, pick = hh(seed + i, 6);
      if (free > .2) { const x = left ? T.x1 - INSET - free / 2 : T.x0 + INSET + free / 2;
        const thing = pick < .35 ? prop('potted plant', { h: Math.min(.28, h), seed: seed + i }) : pick < .7 ? prop('book', { seed: seed + i * 3 }) : prop('cardboard box', { w: Math.min(.3, free - .04), h: Math.min(.18, h), d: Math.min(.24, D - .04) });
        const ob = place(S, thing, { on: shelf, top: T.name, local: [x, (T.z0 + T.z1) / 2], face: 'support-front', nudge: .2 }); res.push(ob);
        if (thing.userData.prop.kind === 'book') res.push(place(S, prop('book', { seed: seed + i * 3 + 1, w: .14, d: .2 }), { on: ob, yaw: 6 })); }
    }
    return res;
  },
  /** arrange.table(S, table, { seats: 4, settings: true, chair: 'dining chair' }) -> { chairs, plates, glasses } */
  table(S, table, o = {}) {
    table = objOf(table); const P = propInfo(table), T = topOf(P, o.top), n = o.seats ?? 4, res = { chairs: [], plates: [], glasses: [] }; table.updateMatrixWorld(true);
    const W = T.x1 - T.x0, D = T.z1 - T.z0, spots = [];
    const perSide = Math.max(1, Math.round(n / 2));
    for (const side of [1, -1]) for (let k = 0; k < perSide && spots.length < n; k++) spots.push({ x: T.x0 + W * (k + .5) / perSide, z: side * (D / 2), side });
    for (const s of spots) { const cw = table.localToWorld(V(s.x, 0, s.z + s.side * .3)), tw = table.localToWorld(V(s.x, 0, 0));
      res.chairs.push(place(S, prop(o.chair ?? 'dining chair'), { at: [cw.x, cw.z], face: [tw.x, tw.z] }));
      if (o.settings !== false) { const pz = s.z - s.side * .18; res.plates.push(place(S, prop('plate'), { on: table, top: T.name, local: [s.x, pz], face: 'support-front' }));
        res.glasses.push(place(S, prop('glass', { full: true }), { on: table, top: T.name, local: [s.x - s.side * .17, pz - s.side * .12], face: 'support-front' })); } }   // top right of the plate, seen by the diner
    return res;
  },
  /** arrange.nightstand(S, ns, { items: ['table lamp', 'book', 'glass'] }) */
  nightstand(S, ns, o = {}) {
    ns = objOf(ns); const res = {}, items = (o.items ?? ['table lamp', 'book', 'glass']).map(spec), slots = { 'table lamp': 'back-center', book: 'front-left', glass: 'front-right', smartphone: 'front-left', 'wall clock': 'center', mug: 'front-right' };
    for (const it of items) { const op = { ...it }; delete op.kind; res[it.kind] = place(S, prop(it.kind, op), { on: ns, slot: slots[it.kind] ?? 'center', face: 'support-front', nudge: .3, yaw: it.kind === 'book' ? 8 : 0 }); }
    return res;
  },
  /** arrange.workstation(S, { at: [x, z], face, desk: { variant }, chair: 'office chair', items, hand, pull: .3 }) ->
   *  { desk, chair, items }: a desk standing at `at` with its front toward `face`, its chair pulled out in front facing it,
   *  and arrange.desk() on it. */
  workstation(S, o = {}) {
    const desk = place(S, prop('desk', o.desk ?? {}), { at: o.at ?? [0, 0], face: o.face ?? 0, parent: o.parent });
    const P = desk.userData.prop, cl = desk.localToWorld(V(0, 0, P.size[2] / 2 + (o.pull ?? .3))), dl = desk.localToWorld(V(0, 0, 0));
    const chair = place(S, prop(o.chair ?? 'office chair'), { at: [cl.x, cl.z], face: [dl.x, dl.z], parent: o.parent });
    const items = arrange.desk(S, desk, { sitter: chair, items: o.items, hand: o.hand });
    return { desk, chair, items };
  },
};

// =====================================================================================================================
// SEATING: sitOn(S, person, seat, o) puts a figure (lib/figures.js, any rig) on a seat by MEASURING its posed body: no rig's
// numbers are hard-coded (each rig's sit pose puts the pelvis somewhere else relative to its origin)
// =====================================================================================================================
const _sv = V(), _sm = new THREE.Matrix4(), _rc = new THREE.Raycaster();
// every drawn vertex of a figure in world space (skinned, instanced and CPU-skinned clothes alike): fn(x, y, z)
function bodyPoints(f, fn) {
  (f.group ?? f.root).traverseVisible(m => {
    if (!m.isMesh || !m.geometry?.attributes?.position || !(m.layers.mask & 1) || m.userData.noContact) return;
    const n = m.geometry.attributes.position.count, st = Math.max(1, Math.ceil(n / 40000)), N = m.isInstancedMesh ? m.count : 1;
    for (let k = 0; k < N; k++) { if (m.isInstancedMesh) { m.getMatrixAt(k, _sm); _sm.premultiply(m.matrixWorld); } else _sm.copy(m.matrixWorld);
      for (let i = 0; i < n; i += st) { m.getVertexPosition(i, _sv).applyMatrix4(_sm); fn(_sv.x, _sv.y, _sv.z); } }
  });
}
// the seat: { p (world point of the seat top under the pelvis), yaw (world, the way the sitter faces), mode, obj }
function seatOf(S, seat, o) {
  const obj = seat?.at ? null : objOf(seat);
  if (!obj) { if (!seat?.at || seat.at.length !== 3) throw new Error('sitOn: seat must be a kit seat (chair, sofa, bed...) or { at: [x, y, z] (seat top), face }');
    const p = V(...seat.at); return { p, yaw: faceYaw(S, seat.face ?? 0, p, null) ?? 0, mode: seat.edge ? 'edge' : 'at' }; }
  obj.updateMatrixWorld(true); const P = propInfo(obj), yaw = yawOf(obj.matrixWorld), x = o.x ?? 0;
  if (P.seat) return { p: obj.localToWorld(V(x, P.seat.y, P.seat.z)), yaw, mode: 'back', obj };
  // no seat (bed, bench, table, crate): on an edge of its top, facing out of it (o.side: front +Z | back | left -X | right +X)
  const T = topOf(P, o.top); if (!T) throw new Error(`sitOn: "${nameOf(obj)}" has no seat and no top to sit on`);
  const sd = o.side ?? 'front', E = { front: [x, T.z1, 0], back: [-x, T.z0, Math.PI], right: [T.x1, -x, Math.PI / 2], left: [T.x0, x, -Math.PI / 2] }[sd];
  if (!E) throw new Error(`sitOn: side "${sd}" (front | back | left | right)`);
  return { p: obj.localToWorld(V(E[0], T.y, E[1])), yaw: yaw + E[2], mode: 'edge', obj };
}
/** beside(S, item, person, { side: 'left' | 'right' | 'front' | 'back', gap: .07, along: 0, face, yaw }) -> item: a floor
 *  item (a bag, a suitcase, a crate) on the floor NEXT TO a person in the pose it has NOW (pose it first: sitOn / act):
 *  just outside the body's footprint on that side (+ gap; the legs, feet and hanging hands up to the item's height), never
 *  under the legs, through place() (floor registry, nudged off other floor items, the PLACEMENT check). along: metres
 *  along the side (+ = toward the person's front / left). face: default the person's facing. (charstress: bags placed
 *  "at the feet" by coordinates went through the seated passengers' calves) */
export function beside(S, item, person, o = {}) {
  const f = person?.root ? person : person?.userData?.api; if (!f?.root) throw new Error('beside: person must be a figure() from lib/figures.js');
  item = objOf(item); const P = propInfo(item), g = f.group ?? f.root; g.updateMatrixWorld(true);
  const fw = V(0, 0, 1).transformDirection(g.matrixWorld).setY(0).normalize(), lf = V().crossVectors(UP, fw).normalize();
  const side = o.side ?? 'right', d = { left: lf, right: lf.clone().negate(), front: fw, back: fw.clone().negate() }[side]; if (!d) throw new Error(`beside: side "${side}" (left | right | front | back)`);
  const hMax = (P.size?.[1] ?? .5) + .12, root = g.getWorldPosition(V());
  let ext = -Infinity;
  bodyPoints(f, (x, y, z) => { if (y > root.y + hMax) return; const a = (x - root.x) * d.x + (z - root.z) * d.z; if (a > ext) ext = a; });
  if (!isFinite(ext)) ext = .2;
  const yaw = faceYaw(S, o.face ?? null, root, null) ?? Math.atan2(fw.x, fw.z), lx = V(Math.cos(yaw), 0, -Math.sin(yaw)), lz = V(Math.sin(yaw), 0, Math.cos(yaw));
  const box = P.foot ?? P.box ?? [-(P.size?.[0] ?? .3) / 2, (P.size?.[0] ?? .3) / 2, -(P.size?.[2] ?? .3) / 2, (P.size?.[2] ?? .3) / 2];
  const half = Math.abs(d.dot(lx)) * (box[1] - box[0]) / 2 + Math.abs(d.dot(lz)) * (box[3] - box[2]) / 2;
  const sgnAlong = side === 'left' || side === 'right' ? fw : lf, at = root.clone().addScaledVector(d, ext + (o.gap ?? .07) + half).addScaledVector(sgnAlong, o.along ?? 0);
  return place(S, item, { at: [at.x, at.z], face: o.face ?? undefined, yaw: o.face == null ? (yaw * 180 / Math.PI) + (o.yaw ?? 0) : o.yaw, nudge: o.nudge ?? .2, parent: o.parent });
}
/** sitOn(S, person, seat, o) -> { gap, back, feet, seat, yaw }: the person (a figure() of any rig) posed with o.act (default 'sit',
 *  at o.t) and its root moved so the underside of its thighs / buttocks rests on the seat top (o.gap, 3 mm), facing the seat's
 *  front, its back 1.2 cm off the backrest (found by rays; o.slide m forward), centred on the seat (o.x m along a sofa).
 *  seat: a kit prop with a seat (chairs, sofa, armchair), any prop with a top (sits on its o.side edge, knees past it), or
 *  { at: [x, y, z] (seat top under the pelvis), face, edge? }. o.lean: degrees back (+) / forward (-). Works rotated / parented.
 *  Animate afterwards with person.act(act, { t }) WITHOUT seat: (that would move the root again). Result: gap = thigh-seat
 *  (m), back = back-backrest (m, null = none), feet = lowest foot point above the floor (m, < 0 = through it). */
export function sitOn(S, person, seat, o = {}) {
  const f = person?.root ? person : person?.userData?.api, root = f?.root;
  if (!root || !f.scenePos) throw new Error('sitOn: person must be a figure() from lib/figures.js');
  const st = seatOf(S, seat, o), Pw = st.p, fw = V(Math.sin(st.yaw), 0, Math.cos(st.yaw)), rt = V(fw.z, 0, -fw.x);
  const frame = f.cast?.group ?? root.parent, act = o.act ?? 'sit', ao = { t: o.t ?? 0, ...(o.opts || {}) };
  const refresh = () => { frame?.updateMatrixWorld(true); if (f.cast) { root.parent?.updateMatrixWorld(true); root.updateMatrixWorld(true); } f.sync?.(true); (f.group ?? root).updateMatrixWorld(true); };
  const toLocal = w => frame ? frame.worldToLocal(w.clone()) : w.clone(), toWorld = l => frame ? frame.localToWorld(l.clone()) : l.clone();
  frame?.updateMatrixWorld(true);
  root.rotation.y = st.yaw - (frame ? yawOf(frame.matrixWorld) : 0);
  if (o.lean) { root.rotation.order = 'YXZ'; root.rotation.x = -o.lean * D2R; }
  root.position.copy(toLocal(Pw)); f.act(act, ao); refresh();
  // the backrest: rays from above the seat backwards (only the seat's own meshes), the nearest surface per height
  const bands = [];
  if (st.mode === 'back') for (const h of [.05, .1, .15, .2, .25, .3, .36, .42, .5]) { let vb = -Infinity;
    for (const dx of [-.12, 0, .12]) { _rc.set(Pw.clone().addScaledVector(rt, dx).addScaledVector(fw, .05).add(V(0, h, 0)), fw.clone().negate()); _rc.far = 1.2;
      const hit = _rc.intersectObject(st.obj, true).find(i => i.object.isMesh && i.object.visible); if (hit) vb = Math.max(vb, hit.point.clone().sub(Pw).dot(fw)); }
    if (isFinite(vb)) bands.push({ y: Pw.y + h, vb }); }
  // (v18) the backrest where the ARMS are (its posts / sides, 21 cm out): the lean back stops before an elbow goes into a post
  // (a female in KK_Sit_Chair_Idle_Loop leaned 29 deg and put her upper arm 6-9 mm into a dining chair's back leg)
  const abands = [];
  if (st.mode === 'back') for (const h of [.1, .15, .2, .25, .3, .36, .42, .5]) for (const dx of [-.23, -.2, -.17, .17, .2, .23]) {
    _rc.set(Pw.clone().addScaledVector(rt, dx).addScaledVector(fw, .05).add(V(0, h, 0)), fw.clone().negate()); _rc.far = 1.2;
    const hit = _rc.intersectObject(st.obj, true).find(i => i.object.isMesh && i.object.visible); if (hit) abands.push({ y: Pw.y + h, vb: hit.point.clone().sub(Pw).dot(fw), u: dx }); }
  // the seat's front below its top (a sofa base, a seat cushion's edge): the shins must stay in front of it
  const fronts = [];
  if (st.mode === 'back') for (const h of [-.06, -.14, -.22, -.3]) { let vf = -Infinity;
    for (const dx of [-.12, 0, .12]) { _rc.set(Pw.clone().addScaledVector(rt, dx).addScaledVector(fw, 1.5).add(V(0, h, 0)), fw.clone().negate()); _rc.far = 1.5;
      const hit = _rc.intersectObject(st.obj, true).find(i => i.object.isMesh && i.object.visible); if (hit) vf = Math.max(vf, hit.point.clone().sub(Pw).dot(fw)); }
    if (isFinite(vf)) fronts.push({ y: Pw.y + h, vf }); }
  const shins = (m, dy) => { let need = -Infinity; for (const b of fronts) { let vmin = Infinity;   // forward shift the legs need (<= 0: clear)
      for (let i = 0; i < m.pts.length; i += 2) if (Math.abs(m.pts[i] + dy - b.y) < .03 && m.pts[i + 1] > m.vh + .3 * m.th && m.pts[i + 1] < vmin) vmin = m.pts[i + 1];
      if (isFinite(vmin)) need = Math.max(need, b.vf + .01 - vmin); } return need; };
  const measure = () => {
    const hip = f.scenePos('hips'), kn = f.scenePos('knL').add(f.scenePos('knR')).multiplyScalar(.5), hw = Math.abs(f.scenePos('hipL').sub(f.scenePos('hipR')).dot(rt)) / 2;
    const L = d => [d.clone().sub(Pw).dot(rt), d.clone().sub(Pw).dot(fw)], [uh, vh] = L(hip), vk = L(kn)[1], th = Math.max(.15, Math.abs(vk - vh));
    const pts = []; let low = Infinity, feet = Infinity;
    bodyPoints(f, (x, y, z) => { const dx = x - Pw.x, dz = z - Pw.z, u = dx * rt.x + dz * rt.z, v = dx * fw.x + dz * fw.z; if (y < feet) feet = y;
      if (Math.abs(u - uh) > hw + .3 * th) return; pts.push(y, v);
      if (v > vh - .55 * th && v < vh + .6 * th && y < hip.y + .1 && Math.abs(u - uh) < hw + .2 * th && y < low) low = y; });
    return { hip, uh, vh, vk, th, low, feet, pts };
  };
  // (the seat contact is the thighs' first 60 % from the hip: at 80 % the calf behind a bent knee counted and the female
  // mannequin hovered 11 cm over the seat, feet 15 cm off the floor)
  // clearance between the body's rearmost point and the backrest, per band height (> 0 = in front of it)
  const rear = (m, dy) => { let back = Infinity; for (const b of bands) { let vmin = Infinity;
      for (let i = 0; i < m.pts.length; i += 2) if (Math.abs(m.pts[i] + dy - b.y) < .03 && m.pts[i + 1] < vmin) vmin = m.pts[i + 1];
      if (isFinite(vmin)) back = Math.min(back, vmin - b.vb); } return back; };
  const move = (du, dv, dy) => { const w = toWorld(root.position).addScaledVector(rt, du).addScaledVector(fw, dv); w.y += dy; root.position.copy(toLocal(w)); f.act(act, ao); refresh(); return measure(); };
  // (v17 figures: the seated soles go onto this floor and the spine leans to this backrest in every act() from now on)
  if ('seatFloor' in f || f.rig === 'human') { f.seatFloor = groundY(S, [[Pw.x, Pw.z]], st.obj ?? null); f.seatBack = bands.length ? { p: Pw.clone(), fw: fw.clone(), bands: bands.slice(), abands } : null; f.act(act, ao); refresh(); }
  let m = measure(); if (!isFinite(m.low)) throw new Error(`sitOn: no thigh points measured on ${f.name ?? 'the person'} (is it posed '${act}'?)`);
  for (let it = 0; it < 4; it++) {   // measure -> move, until it holds (a rig whose pose lags one apply converges on the next pass)
    const dy = Pw.y + (o.gap ?? .003) - m.low, back = rear(m, dy), dv = st.mode === 'edge' ? .16 * m.th - m.vk : Math.max(isFinite(back) ? .012 - back : -m.vh, shins(m, dy));
    if (it && Math.abs(dy) < 5e-4 && Math.abs(dv) < 5e-4 && Math.abs(m.uh) < 5e-4) break;
    m = move(-m.uh, dv, dy); }
  if (o.slide) m = move(0, o.slide, 0);
  const fl = groundY(S, [[m.hip.x, m.hip.z]], st.obj ?? null), b2 = rear(m, 0);
  // (v18) sitting down / standing up (f.sitDown / f.standUp / f.standSpot, lib/figures.js): the seated root, the STANDING SPOT
  // in front of the seat (the root moved forward along the seat's facing until nothing of the standing body - the stand clip
  // and the sit-down clip's first frame - is behind the seat's front edge + 3 cm between 7 cm under the seat top and 20 cm
  // over it: Sitting_Enter played at the seated root started standing INSIDE the chair) and how far forward the sit-down
  // clip's last frame must be for its shins to clear the seat front (its feet are 8 cm further back than the seated clip's:
  // shins 17-39 mm in the seat). Only for figures.js humans on a seat with a back (chairs, sofas, armchairs).
  if (f.rig === 'human' && typeof f.standSpot === 'function' && st.mode === 'back') {
    // the seat's front: its own drawn points at the seat top's height (an open-legged chair's front face is not hit by rays)
    let frontV = fronts.length ? Math.max(...fronts.map(b => b.vf)) : -Infinity;
    if (st.obj) bodyPoints({ group: st.obj }, (x, y, z) => { if (y < Pw.y - .08 || y > Pw.y + .01) return; const dx = x - Pw.x, dz = z - Pw.z, u = dx * rt.x + dz * rt.z - m.uh, v = dx * fw.x + dz * fw.z; if (Math.abs(u) < .3 && v < 1 && v > frontV) frontV = v; });
    if (!isFinite(frontV)) frontV = null;
    const seatRoot = root.position.clone(), floorL = toLocal(V(Pw.x, fl, Pw.z)).y;
    let need = 0, endNeed = 0;
    // (the seat's floor parts - an office chair's star base, chair legs: the standing feet must be in front of them too)
    const base = []; if (st.obj) bodyPoints({ group: st.obj }, (x, y, z) => { if (y > fl + .12) return; const dx = x - Pw.x, dz = z - Pw.z; base.push(dx * rt.x + dz * rt.z, dx * fw.x + dz * fw.z); });
    if (frontV != null) {
      for (const nm of ['stand', 'sitDown']) { root.position.set(seatRoot.x, floorL, seatRoot.z); f.act(nm, { t: 0 }); refresh();
        bodyPoints(f, (x, y, z) => { const dx = x - Pw.x, dz = z - Pw.z, u = dx * rt.x + dz * rt.z, v = dx * fw.x + dz * fw.z;
          if (y < fl + .12) { for (let i = 0; i < base.length; i += 2) if (Math.abs(base[i] - u) < .04 && base[i + 1] + .02 - v > need && base[i + 1] > v - .06) need = base[i + 1] + .02 - v; return; }
          if (y < Pw.y - .07 || y > Pw.y + .2 || Math.abs(u - m.uh) > .32) return; if (frontV + .03 - v > need) need = frontV + .03 - v; }); }
      root.position.copy(seatRoot); f.act('sitDown', { t: 99 }); refresh(); endNeed = Math.max(0, shins(measure(), 0)); }
    // (the seated calves stay in front of the seat's front edge when the knee sets the soles on the floor: figures.js legs())
    f.seatFront = frontV != null ? { p: Pw.clone(), fw: fw.clone(), v: frontV, top: Pw.y } : null;
    root.position.copy(seatRoot); f.act(act, ao); refresh();
    const sw = toWorld(seatRoot).addScaledVector(fw, need), sl = toLocal(sw), ew = toLocal(toWorld(seatRoot).addScaledVector(fw, endNeed));
    (f._seats ??= new Map()).set(st.obj ?? seat, { seat: { x: seatRoot.x, y: seatRoot.y, z: seatRoot.z }, ry: root.rotation.y, act,
      stand: { x: sl.x, y: floorL, z: sl.z, ry: root.rotation.y, dist: r4(need) }, end: { x: ew.x, y: seatRoot.y, z: ew.z, dist: r4(endNeed) } });
  }
  // (v18) SEATED AT A TABLE OR DESK: the seated clip's hands rest ON its top (Sitting_Idle_Loop's hands came 17 mm INTO a
  // table top): lib/hands.js rest(f, top) every frame - the hands come down onto it (or out of it onto it), never into it; a
  // later hold() of a hand takes that hand from there. o.rest: false = no rest, or the surface to rest on (a keyboard ...)
  // (only as much as RESTING seated clips play - sit, sitChair, typing: a talking / gesturing clip pulled down onto the table
  // pushed its forearm 8 mm into the top; the arm pose blends between the clip's and the rested one by that weight, so a
  // crossfade into a talking clip lifts the hands off smoothly)
  let table = null;
  if (o.rest !== false && f.rig === 'human' && typeof f.onApply === 'function') {
    table = o.rest?.isObject3D ? o.rest : tableInFront(S, Pw, fw, rt, st.obj, m.uh);
    // (the hands land on the FLAT things lying on the top too - a keyboard, papers, a plate, < 5 cm high: rest's `on`, never
    // through them; a glass or a mug is not a place to rest a hand on)
    const onTop = [table]; if (table) { table.updateMatrixWorld(true); const tb = new THREE.Box3().setFromObject(table), ty = tableTopY(table) ?? tb.max.y;
      S.scene.traverse(ob => { if (ob === table || !ob.userData?.prop || !ob.visible || onTop.includes(ob)) return; for (let p = ob.parent; p; p = p.parent) if (onTop.includes(p)) return;
        const b = new THREE.Box3().setFromObject(ob), c = b.getCenter(V()); if (b.max.y - b.min.y < .05 && b.min.y > ty - .02 && b.min.y < ty + .03 && c.x > tb.min.x - .02 && c.x < tb.max.x + .02 && c.z > tb.min.z - .02 && c.z < tb.max.z + .02) onTop.push(ob); }); }
    if (table) { f.seatTable = table; const r = handsRest(f, table, { on: onTop }), up = r.update, ARM = ['l', 'r'].flatMap(s => ['upperarm', 'lowerarm', 'hand'].map(b => f.bone(`${b}_${s}`))).filter(Boolean);
      const RESTING = /^(Sitting_Idle_Loop|KK_Sit_Chair_Idle_Loop|G_Typing_Seated_Loop)$/;
      r.update = (t, R) => { const k = typeof f.mixWeight === 'function' ? f.mixWeight(RESTING) : 1; if (k <= 1e-3) { r.w = 0; return; }
        if (k >= .999) return up(t, R); const q0 = ARM.map(b => b.quaternion.clone()); up(t, R); ARM.forEach((b, i) => b.quaternion.copy(q0[i].slerp(b.quaternion, k))); f.root.updateMatrixWorld(true); r.w = Math.min(r.w ?? 1, k); }; }
  }
  // (v18) FOOT RESTS: the seated soles go onto whatever is right under each foot - the floor, a pedestal table's foot bar, a
  // footrest (once the soles were set on the floor, a booth sitter's foot went "inside table foot": a 3.5 cm X base under it)
  if (f.rig === 'human' && typeof f.onApply === 'function') { const side = {}, targets = [];
    S.scene.traverse(ob => { if (!ob.isMesh || !ob.visible || ob.userData?.noContact) return; for (let p = ob; p; p = p.parent) if (p.userData?.kind === 'person' || p === st.obj) return; targets.push(ob); });
    for (const s of ['l', 'r']) { const a = f.bone('foot_' + s)?.getWorldPosition(V()), b = f.bone('ball_' + s)?.getWorldPosition(V()) ?? a; if (!a) continue; let top = -Infinity;
      for (const p of [a, b, a.clone().lerp(b, .5)]) { _rc.set(V(p.x, fl + .25, p.z), V(0, -1, 0)); _rc.far = .3; const h = _rc.intersectObjects(targets, false)[0]; if (h && h.point.y > top) top = h.point.y; }
      if (top > fl + .004 && top < fl + .2) side[s] = top; }
    f.seatFloorSide = Object.keys(side).length ? side : null; if (f.seatFloorSide) { f.act(act, ao); refresh(); } }
  return { gap: r4(m.low - Pw.y), back: isFinite(b2) ? r4(b2) : null, feet: r4(m.feet - fl), seat: Pw, yaw: st.yaw, person: f, table };
}
const tableTopY = o => { const P = o.userData?.prop, T = P?.tops?.[0]; if (!T) return null; o.updateMatrixWorld(true); return o.localToWorld(V(0, T.y, 0)).y; };
// the table / desk top in front of a seat (sitOn's hands rest): a kit prop's top 15-50 cm above the seat whose footprint
// starts within 55 cm in front of the seat point and overlaps the sitter's width; the nearest
function tableInFront(S, Pw, fw, rt, skip, uh = 0) {
  let best = null, bv = Infinity;
  S.scene.traverse(o => { const P = o.userData?.prop; if (!P?.tops?.length || o === skip || !o.visible) return; o.updateMatrixWorld(true);
    for (const T of P.tops) { const c = [[T.x0, T.z0], [T.x1, T.z0], [T.x0, T.z1], [T.x1, T.z1]].map(([x, z]) => o.localToWorld(V(x, T.y, z)));
      const y = c[0].y; if (y < Pw.y + .15 || y > Pw.y + .5) continue;
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity; for (const p of c) { const d = p.clone().sub(Pw), u = d.dot(rt) - uh, v = d.dot(fw); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      if (v0 > .55 || v1 < .1 || u1 < -.35 || u0 > .35) continue; if (v0 < bv) { bv = v0; best = o; } } });
  return best;
}

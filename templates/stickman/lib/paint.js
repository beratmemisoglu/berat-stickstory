// MS Paint drawing kit on three.js: every primitive is a flat mesh drawn in creation order (painter's algorithm),
// no anti-aliasing, hand-wobbled outlines, pixel-crisp (thresholded) text. Frame = 960x540 units, y up.
import * as THREE from '../vendor/three.module.js';
export { THREE };

export const W = 960, H = 540;
export const D = Math.PI / 180;
// classic Paint palette + a few skin/earth tones Paint users mix by hand
export const P = { black: '#000000', white: '#ffffff', gray: '#808080', dgray: '#404040', silver: '#c0c0c0', lgray: '#e0e0e0',
  red: '#ff0000', maroon: '#800000', yellow: '#ffff00', lyellow: '#ffff80', gold: '#ffc000', orange: '#ff8040', dorange: '#ff6000',
  brown: '#804000', lbrown: '#c08040', tan: '#e0b070', dgreen: '#004040', green: '#008000', lime: '#00c000', lgreen: '#80ff80',
  olive: '#808000', cyan: '#80ffff', aqua: '#00ffff', teal: '#008080', lblue: '#8080ff', blue: '#0080ff', dblue: '#004080', navy: '#000080',
  purple: '#800080', magenta: '#ff00ff', pink: '#ff8080', lpink: '#ffc0c0', sky: '#a0e0ff', sea: '#0060c0', deep: '#003070',
  skin: '#ffd8b0', skin2: '#e0a070', skin3: '#a06030', skin4: '#603818',
  accent: '#ff0000', brand: '#ff0000' };   // accent: labels, date and number cards (the brand colour when the look sets one, engine v5)
export const col = c => (c && P[c]) || c || P.black;

let cur = null, ord = 0, seed = 1;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export function reset(root, s = 7) { cur = root; ord = 0; seed = s; }
export const parent = () => cur;
export function group(x, y, sx, sy, rot, fn) {
  const g = new THREE.Group(); g.position.set(x, y, 0); g.scale.set(sx, sy, 1); g.rotation.z = (rot || 0) * D; cur.add(g);
  const prev = cur; cur = g; try { fn && fn(g); } finally { cur = prev; } return g;
}
export function inGroup(g, fn) { const prev = cur; cur = g; try { fn(); } finally { cur = prev; } }

const mats = {};
const mat = c => mats[c] ??= new THREE.MeshBasicMaterial({ color: col(c), depthTest: false, depthWrite: false, side: THREE.DoubleSide });
const add = (geo, c, p = cur) => { const m = new THREE.Mesh(geo, mat(c)); m.renderOrder = ord++; p.add(m); return m; };
export function fill(pts, c, p = cur) { return add(new THREE.ShapeGeometry(new THREE.Shape(pts.map(q => new THREE.Vector2(q[0], q[1])))), c, p); }
export function dot(x, y, r, c, p = cur) { const m = add(new THREE.CircleGeometry(r, Math.max(10, Math.min(56, r * 2.2 | 0))), c, p); m.position.set(x, y, 0); return m; }
export function rect(x, y, w, h, c, p = cur) { const m = add(new THREE.PlaneGeometry(w, h), c, p); m.position.set(x + w / 2, y + h / 2, 0); return m; }
export function seg(a, b, w, c, p = cur, caps = true) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  if (len > 0.01) { const m = add(new THREE.PlaneGeometry(len, w), c, p); m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0); m.rotation.z = Math.atan2(dy, dx); }
  if (caps) { dot(a[0], a[1], w / 2, c, p); dot(b[0], b[1], w / 2, c, p); }
}
export function stroke(pts, w, c = 'black', closed = false, p = cur) { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) seg(pts[i], pts[(i + 1) % pts.length], w, c, p); }
// mouse-drawn wobble: subdivide and jitter
export function wob(pts, amt = 1.4, step = 14, closed = true) {
  const out = [], n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], k = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k + (rnd() - .5) * 2 * amt, a[1] + (b[1] - a[1]) * j / k + (rnd() - .5) * 2 * amt]);
  }
  if (!closed) out.push(pts[pts.length - 1]); return out;
}
export const circ = (cx, cy, rx, ry = rx, n = 40, a0 = 0, a1 = 360) => Array.from({ length: n }, (_, i) => { const t = (a0 + (a1 - a0) * i / (a1 - a0 === 360 ? n : n - 1)) * D; return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]; });
// filled shape with a black outline (the Paint "fill + outline" look)
export function shape(pts, c, line = 3, amt = 1.2) { const q = amt ? wob(pts, amt) : pts; fill(q, c); if (line) stroke(q, line, 'black', true); return q; }
export function oval(cx, cy, rx, ry, c, line = 3, amt = .8) { return shape(circ(cx, cy, rx, ry, Math.max(18, Math.min(64, (rx + ry) / 2.5 | 0))), c, line, amt); }
export function box(x, y, w, h, c, line = 3, amt = 1) { return shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], c, line, amt); }
export function line(pts, w = 3, c = 'black', amt = 1) { stroke(amt ? wob(pts, amt, 12, false) : pts, w, c); }
// thick tube with a black outline (trunks, tails, branches, rods)
export function tube(pts, w, c, lw = 3) { const q = wob(pts, .5, 10, false); stroke(q, w + lw * 2, 'black'); stroke(q, w, c); }
// airbrush
export function spray(cx, cy, r, n, c) { for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, d = Math.sqrt(rnd()) * r; rect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 2, 2, c); } }
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// ---- images (sprites from the library): bottom-centre at (x, y), w x h frame pixels, flip mirrors, rot degrees ----
const imats = new Map();
export function image(tex, x, y, w, h, flip = false, rot = 0) {
  let m = imats.get(tex.uuid); if (!m) { m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .5, depthTest: false, depthWrite: false, side: THREE.DoubleSide }); imats.set(tex.uuid, m); }
  const g = new THREE.Group(); g.position.set(x, y, 0); g.rotation.z = rot * D; cur.add(g);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.position.set(0, h / 2, 0); mesh.scale.x = flip ? -1 : 1; mesh.renderOrder = ord++; g.add(mesh);
  return g;
}

// ---- text: canvas text, alpha thresholded so it is aliased like Paint's text tool ----
// ("CZ Script": the app's bundled font for Japanese, Korean, Chinese, Thai and Hindi letters, which Comic Sans lacks)
const FONT = '"Comic Sans MS", "Comic Neue", "Chalkboard SE", "CZ Script", cursive';
export function text(str, x, y, o = {}) {
  // drawn at 2x and thresholded there: the frame renders at 1920 wide, so 1x text came out as fat 2-pixel blobs.
  // Regular weight with a thin outline by default (bold + thick outline merged letters into one shape).
  const K = 2, size = o.size || 32, bold = o.bold === true, outline = o.outline === undefined ? (o.color && col(o.color) !== P.black ? 'black' : null) : (o.outline && col(o.outline) === col(o.color || 'black') ? null : o.outline);
  const ow = outline ? Math.max(1.5, size / 14) : 0, lines = String(str).split('\\n');
  const cv = document.createElement('canvas'), g = cv.getContext('2d'), font = `${bold ? 'bold ' : ''}${size * K}px ${o.font || FONT}`;
  g.font = font; const wMax = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width)) / K + ow * 2 + 8), lh = Math.round(size * 1.15);
  const cw = wMax, ch = lh * lines.length + Math.ceil(ow * 2) + 8; cv.width = cw * K; cv.height = ch * K;
  g.font = font; g.textBaseline = 'middle'; g.textAlign = 'center'; g.lineJoin = 'round';
  lines.forEach((l, i) => {
    const ty = (ow + 4 + lh * (i + .5)) * K;
    if (outline) { g.strokeStyle = col(outline); g.lineWidth = ow * 2 * K; g.strokeText(l, cv.width / 2, ty); }
    g.fillStyle = col(o.color || 'black'); g.fillText(l, cv.width / 2, ty);
  });
  const im = g.getImageData(0, 0, cv.width, cv.height), d = im.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
  g.putImageData(im, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .5, depthTest: false, depthWrite: false }));
  m.renderOrder = ord++; m.rotation.z = (o.rot || 0) * D;
  const ax = o.align === 'left' ? cw / 2 : o.align === 'right' ? -cw / 2 : 0;
  m.position.set(Math.round(x + ax), Math.round(y), 0); cur.add(m);
  return { w: cw, h: ch };
}

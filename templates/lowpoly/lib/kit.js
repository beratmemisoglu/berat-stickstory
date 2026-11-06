// The procedural kit: what the library lacks and the analysed channels use all the time. Money, casino pieces, screens
// with drawn UIs (screen-door grid), LED digits, scoreboards, calendars, charts, organs, signs, ground markers, the 3D
// brand sting, crowds. Everything is low-poly, sized in metres, origin at the bottom centre, front +z.
import { THREE, MOODY, C, BRAND, rnd, canvasTex, redraw, clamp, lerp, seg, E, pixelText, pixelWidth, glyph, fmt } from './core.js';
import { mat as M, glow, box, cyl } from './sets.js';
import { person, randomOutfit } from './actor.js';

const grp = (name, kind) => { const g = new THREE.Group(); g.name = name; g.userData.kind = kind || name; g.userData.pickRoot = true; return g; };
const shadowAll = g => { g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return g; };

// ---------- screens: a canvas UI with a visible LCD grid (screen-door) ----------
/** screenMaterial(tex, { grid, glow }): unlit, bright, with the pixel grid of a real screen */
export function screenMaterial(tex, o = {}) {
  const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); const px = o.grid ?? 96, k = o.glow ?? (MOODY ? 1.25 : 1.05);
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    { vec2 g = fract(vMapUv * vec2(${px.toFixed(1)}, ${(px * 1.6).toFixed(1)})); float d = smoothstep(.0, .18, g.x) * smoothstep(1., .82, g.x) * smoothstep(.0, .2, g.y) * smoothstep(1., .8, g.y);
      diffuseColor.rgb *= (.72 + .28 * d) * ${k.toFixed(2)}; }`); };
  m.customProgramCacheKey = () => 'lpscreen' + px + k; return m;
}
export const UI = {
  /** a bank app: balance big, a few lines */
  bank: (x, w, h, d = {}) => { x.fillStyle = '#f4f6fa'; x.fillRect(0, 0, w, h); x.fillStyle = d.color || '#1a6b3a'; x.fillRect(0, 0, w, h * .28);
    x.fillStyle = '#fff'; x.font = `700 ${h * .05}px Inter, Arial`; x.textAlign = 'center'; x.fillText(d.title || 'MY BANK', w / 2, h * .08);
    x.font = `800 ${h * .1}px Inter, Arial`; x.fillText(d.balance ?? '$1,250', w / 2, h * .2);
    (d.lines || ['Rent  -$900', 'Coffee  -$4', 'Salary  +$2,100']).forEach((l, i) => { x.fillStyle = '#e3e7ee'; x.fillRect(w * .06, h * (.34 + i * .12), w * .88, h * .1); x.fillStyle = /\+/.test(l) ? '#1a8a3a' : '#c0281c'; x.font = `700 ${h * .045}px Inter, Arial`; x.textAlign = 'left'; x.fillText(l, w * .1, h * (.405 + i * .12)); }); },
  /** a betting app: odds tiles + a big BET button */
  bet: (x, w, h, d = {}) => { x.fillStyle = '#0b1220'; x.fillRect(0, 0, w, h); x.fillStyle = '#1fce5a'; x.font = `800 ${h * .06}px Inter, Arial`; x.textAlign = 'center'; x.fillText(d.title || 'BET NOW', w / 2, h * .09);
    (d.odds || ['2.10', '3.40', '1.85']).forEach((o, i) => { x.fillStyle = '#1b2840'; x.fillRect(w * .08, h * (.16 + i * .15), w * .84, h * .12); x.fillStyle = '#fff'; x.font = `700 ${h * .05}px Inter, Arial`; x.fillText(o, w / 2, h * (.24 + i * .15)); });
    x.fillStyle = '#1fce5a'; x.fillRect(w * .1, h * .72, w * .8, h * .14); x.fillStyle = '#05210f'; x.font = `800 ${h * .07}px Inter, Arial`; x.fillText(d.button || 'BET', w / 2, h * .82); },
  /** a camera app: a viewfinder with corners and a red record button */
  camera: (x, w, h, d = {}) => { x.fillStyle = d.bg || '#304050'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = Math.max(2, w * .012); const m = w * .08, L = w * .12;
    for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h * .8, 1, -1], [w - m, h * .8, -1, -1]]) { x.beginPath(); x.moveTo(cx, cy + sy * L); x.lineTo(cx, cy); x.lineTo(cx + sx * L, cy); x.stroke(); }
    x.fillStyle = '#e8231d'; x.beginPath(); x.arc(w / 2, h * .9, w * .08, 0, 7); x.fill(); },
  /** CCTV feed: grey noise, timestamp */
  cctv: (x, w, h, d = {}) => { const r = rnd(d.seed ?? 3); x.fillStyle = '#2a2f33'; x.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(200,210,215,${r() * .25})`; x.fillRect(r() * w, r() * h, 2, 1); }
    pixelText(x, d.cam || 'CAM 04', 4, 4, Math.max(1, w / 120), '#fff'); pixelText(x, d.time || '22:09:17', w - 4, 4, Math.max(1, w / 120), '#fff', { align: 'right' }); },
  /** chat bubbles */
  chat: (x, w, h, d = {}) => { x.fillStyle = '#ecebe6'; x.fillRect(0, 0, w, h); (d.lines || ['hey', 'did you see this??', 'no way']).forEach((l, i) => { const me = i % 2; x.fillStyle = me ? '#3b8cf7' : '#fff'; const bw = w * .6, X = me ? w * .34 : w * .06, Y = h * (.08 + i * .14);
    x.fillRect(X, Y, bw, h * .1); x.fillStyle = me ? '#fff' : '#222'; x.font = `600 ${h * .045}px Inter, Arial`; x.textAlign = 'left'; x.fillText(l, X + w * .04, Y + h * .065); }); },
  /** a green CRT terminal */
  terminal: (x, w, h, d = {}) => { x.fillStyle = '#010700'; x.fillRect(0, 0, w, h); const px = Math.max(1, Math.floor(w / 110)); (d.lines || ['> RUN ODDS.EXE', '> 51,766 GAMES', '> WIN RATE 0.79']).forEach((l, i) => pixelText(x, l, w * .05, h * .08 + i * px * 10, px, '#7dff7a')); },
  /** a plain message / title screen */
  text: (x, w, h, d = {}) => { x.fillStyle = d.bg || '#1b2a6b'; x.fillRect(0, 0, w, h); x.fillStyle = d.color || '#fff'; x.font = `800 ${h * (d.size ?? .18)}px Inter, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; String(d.text ?? 'YOU WON').split('\n').forEach((l, i, a) => x.fillText(l, w / 2, h / 2 + (i - (a.length - 1) / 2) * h * (d.size ?? .18) * 1.15)); },
  /** "YOU WON" with radial rays */
  win: (x, w, h, d = {}) => { x.fillStyle = '#ffb000'; x.fillRect(0, 0, w, h); x.save(); x.translate(w / 2, h / 2); for (let i = 0; i < 16; i++) { x.rotate(Math.PI / 8); x.fillStyle = i % 2 ? '#ffd84a' : '#ff9a00'; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, -w * .2); x.lineTo(w, w * .2); x.fill(); } x.restore();
    x.fillStyle = '#fff'; x.strokeStyle = '#7a2a00'; x.lineWidth = h * .02; x.font = `800 ${h * .2}px Inter, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.strokeText(d.text || 'YOU WON', w / 2, h / 2); x.fillText(d.text || 'YOU WON', w / 2, h / 2); },
};
/** a flat screen showing a UI: screen(kind | fn(x, w, h), data, { w, h, res }) - a plane (front +z) */
export function screen(ui = 'text', data = {}, o = {}) {
  const w = o.w ?? .6, h = o.h ?? .4, res = o.res ?? 128, draw = typeof ui === 'function' ? ui : UI[ui] || UI.text;
  const tex = canvasTex(Math.round(res * (w / h)), res, (x, cw, ch) => draw(x, cw, ch, data), { nearest: !MOODY });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMaterial(tex, { grid: o.grid ?? Math.round(res * w / h / 2) })); m.name = 'screen'; m.userData.kind = 'screen';
  m.userData.redraw = d => redraw(tex, (x, cw, ch) => draw(x, cw, ch, { ...data, ...d })); return m;
}
/** a smartphone (held or lying): phone({ ui, data }) 0.075 x 0.155 m */
export function phone(ui = 'bank', data = {}, o = {}) {
  const g = grp('phone'); box(.075, .155, .009, M(0x111318, { roughness: .4 }), 0, .0775, 0, g);
  const s = screen(ui, data, { w: .066, h: .138, res: 96 }); s.position.set(0, .0775, .0047); g.add(s); g.userData.screen = s; return shadowAll(g);
}
export function laptop(ui = 'text', data = {}, o = {}) {
  const g = grp('laptop'); box(.34, .02, .24, M(0x9aa0a8), 0, .01, 0, g);
  const lid = new THREE.Group(); lid.position.set(0, .02, -.12); lid.rotation.x = -.25; g.add(lid); box(.34, .23, .012, M(0x9aa0a8), 0, .115, 0, lid);
  const s = screen(ui, data, { w: .31, h: .2, res: 128 }); s.position.set(0, .115, .007); lid.add(s); g.userData.screen = s; return shadowAll(g);
}
/** an old beige CRT monitor with a curved-looking screen */
export function crt(ui = 'terminal', data = {}, o = {}) {
  const g = grp('CRT monitor'); const beige = M(o.color ?? 0xd8cfb4);
  box(.42, .36, .4, beige, 0, .2, -.06, g); box(.3, .26, .1, beige, 0, .2, -.32, g); box(.2, .04, .2, beige, 0, .02, -.1, g);
  const s = screen(ui, data, { w: .34, h: .26, res: 128 }); s.position.set(0, .21, .142); g.add(s); g.userData.screen = s; return shadowAll(g);
}
export function monitor(ui = 'text', data = {}, o = {}) {
  const g = grp('monitor'); box(.62, .38, .03, M(0x15171b), 0, .43, 0, g); box(.04, .22, .04, M(0x2a2d33), 0, .14, -.03, g); box(.22, .02, .16, M(0x2a2d33), 0, .01, -.03, g);
  const s = screen(ui, data, { w: .58, h: .34, res: 128 }); s.position.set(0, .43, .016); g.add(s); g.userData.screen = s; return shadowAll(g);
}
/** a wall of screens (CCTV room, TV wall): screenWall(cols, rows, uiFn(i) -> [ui, data]) */
export function screenWall(cols = 3, rows = 2, pick = i => ['cctv', { cam: 'CAM ' + String(i + 1).padStart(2, '0'), seed: i + 2 }]) {
  const g = grp('screen wall'); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const [ui, d] = pick(r * cols + c); const m = monitor(ui, d); m.position.set((c - (cols - 1) / 2) * .66, r * .42, 0); g.add(m); } return g;
}
// ---------- money ----------
const BILL = () => canvasTex(128, 56, (x, w, h) => { x.fillStyle = '#c8dcb0'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3f6a3a'; x.lineWidth = 3; x.strokeRect(3, 3, w - 6, h - 6); x.fillStyle = '#3f6a3a';
  x.beginPath(); x.ellipse(w / 2, h / 2, 13, 17, 0, 0, 7); x.fill(); x.fillStyle = '#c8dcb0'; x.font = '800 16px Inter, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', w / 2, h / 2 + 1);
  x.fillStyle = '#2a4d28'; x.font = '800 13px Inter, Arial'; x.fillText('100', 16, 13); x.fillText('100', w - 16, h - 12); x.fillRect(22, h / 2 - 1, 20, 2); x.fillRect(w - 42, h / 2 - 1, 20, 2); }, { nearest: !MOODY });
let billTex = null; const bt = () => billTex ??= BILL();
/** one banknote (0.156 x 0.066 m) */
export function bill() { const m = new THREE.Mesh(new THREE.PlaneGeometry(.156, .066), new THREE.MeshStandardMaterial({ map: bt(), side: THREE.DoubleSide, roughness: .9 })); m.name = 'banknote'; m.userData.kind = 'money'; return m; }
/** a strapped stack of bills (n stacks side by side x rows x layers) */
export function cash(o = {}) {
  const g = grp('cash', 'money'), cols = o.cols ?? 1, rows = o.rows ?? 1, layers = o.layers ?? 1, side = M(0xe8ead8), strap = M(0xd0a020);
  const top = new THREE.MeshStandardMaterial({ map: bt(), roughness: .9 }), mats = [side, side, top, side, side, side];
  for (let l = 0; l < layers; l++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.156, .03, .066), mats); b.position.set((c - (cols - 1) / 2) * .16, .015 + l * .031, (r - (rows - 1) / 2) * .07); g.add(b);
    const s = new THREE.Mesh(new THREE.BoxGeometry(.03, .032, .068), strap); s.position.copy(b.position); g.add(s); }
  return shadowAll(g);
}
/** a cube of cash (money cube): size in metres */
export function moneyCube(size = .6) { const n = Math.max(1, Math.round(size / .16)); const g = cash({ cols: n, rows: Math.max(1, Math.round(size / .07)), layers: Math.max(1, Math.round(size / .031)) }); g.name = 'money cube'; return g; }
/** flying bills: bills(S, { from: [x,y,z], at, dur, count, spread, up }) - deterministic paths, instanced */
export function bills(S, o = {}) {
  const n = o.count ?? 40, r = rnd(o.seed ?? 9), from = new THREE.Vector3(...(o.from || [0, 1.2, 0])), at = o.at ?? S.t0, dur = o.dur ?? 2.5, spread = o.spread ?? 2.5;
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(.156, .066), new THREE.MeshStandardMaterial({ map: bt(), side: THREE.DoubleSide, roughness: .9 }), n); im.name = 'flying bills'; im.userData.airborne = true; im.userData.noCheck = true;
  const P = Array.from({ length: n }, () => ({ v: new THREE.Vector3((r() - .5) * spread, (o.up ?? 2.4) * (.5 + r()), (r() - .5) * spread), spin: new THREE.Vector3(r() * 9, r() * 9, r() * 9), d: r() * .4 }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  S.tick(t => { for (let i = 0; i < n; i++) { const k = Math.max(0, t - at - P[i].d); p.copy(from).addScaledVector(P[i].v, k).add(new THREE.Vector3(Math.sin(k * 3 + i) * .15, -1.1 * k * k * .35, 0)); if (k <= 0) p.y = -50;
    e.set(P[i].spin.x * k, P[i].spin.y * k, P[i].spin.z * k); q.setFromEuler(e); m.compose(p, q, one); im.setMatrixAt(i, m); } im.instanceMatrix.needsUpdate = true; im.visible = t >= at && t < at + dur + 1; });
  (S.scene || S).add(im); return im;
}
// ---------- casino ----------
const CHIP_COL = { red: 0xc8261c, blue: 0x2c4fa8, green: 0x1a8a3a, black: 0x15151a, white: 0xeeeeee, purple: 0x6a2a9a, gold: 0xd0a020 };
let chipTex = null;
/** chip stack: chips(n, color) - instanced, 4 cm chips, 3.3 mm each */
export function chips(n = 10, color = 'red', o = {}) {
  chipTex ??= canvasTex(64, 8, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.0)'; for (let i = 0; i < 8; i++) { x.fillStyle = '#ffffff'; x.fillRect(i * 8, 0, 4, h); x.fillStyle = 'rgba(0,0,0,0)'; } });
  const c = CHIP_COL[color] ?? color, g = grp('chips', 'chips');
  const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(.02, .02, .0033, 14), [M(0xf4f4f4), M(c), M(c)], n);
  const edge = new THREE.InstancedMesh(new THREE.CylinderGeometry(.0202, .0202, .0024, 14, 1, true), M(0xffffff), n);
  const mm = new THREE.Matrix4(), r = rnd(o.seed ?? n);
  for (let i = 0; i < n; i++) { mm.makeTranslation((r() - .5) * .002, .00165 + i * .0034, (r() - .5) * .002); im.setMatrixAt(i, mm); edge.setMatrixAt(i, mm); }
  im.material[0] = M(c); g.add(im); const stripes = new THREE.InstancedMesh(new THREE.CylinderGeometry(.0203, .0203, .0016, 6, 1, true), M(0xf2f2f2), n); for (let i = 0; i < n; i++) { mm.makeTranslation(0, .00165 + i * .0034, 0); stripes.setMatrixAt(i, mm); } g.add(stripes);
  g.userData.count = n; g.userData.setCount = k => { im.count = stripes.count = Math.max(0, Math.min(n, Math.round(k))); };
  return shadowAll(g);
}
/** a playing card (0.063 x 0.088 m): card('A', 'spades', { back }) - original simple card faces */
const SUIT = { spades: ['♠', '#111'], hearts: ['♥', '#c8261c'], diamonds: ['♦', '#c8261c'], clubs: ['♣', '#111'] };
export function card(rank = 'A', suit = 'spades', o = {}) {
  const [sym, colr] = SUIT[suit] || SUIT.spades;
  const face = canvasTex(64, 90, (x, w, h) => { x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, w, h); x.fillStyle = colr; x.font = '800 16px Inter, Arial'; x.textAlign = 'left'; x.fillText(rank, 5, 17); x.font = '14px serif'; x.fillText(sym, 6, 31);
    x.font = '40px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(sym, w / 2, h / 2 + 3); x.strokeStyle = '#d9d4c4'; x.strokeRect(1, 1, w - 2, h - 2); }, { nearest: false });
  const back = canvasTex(32, 45, (x, w, h) => { x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, w, h); x.fillStyle = o.back || '#a3241c'; x.fillRect(3, 3, w - 6, h - 6); x.strokeStyle = 'rgba(255,255,255,.4)'; for (let i = -h; i < w; i += 5) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); } });
  const g = new THREE.Mesh(new THREE.BoxGeometry(.063, .088, .0006), [M(0xfbfaf5), M(0xfbfaf5), M(0xfbfaf5), M(0xfbfaf5), new THREE.MeshStandardMaterial({ map: face, roughness: .6 }), new THREE.MeshStandardMaterial({ map: back, roughness: .6 })]);
  g.name = `card ${rank} of ${suit}`; g.userData.kind = 'card'; g.castShadow = true; return g;
}
/** roulette table with wheel and ball: roulette({ spin: [t0, t1] }) - wheel.userData.result(t) */
export function roulette(o = {}) {
  const g = grp('roulette table', 'roulette'), felt = new THREE.MeshStandardMaterial({ color: 0x0f6a2e, roughness: 1 });
  const layout = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#0f6a2e'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f2f2f2'; x.lineWidth = 1.5;
    const reds = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]); const cw = (w - 40) / 12, ch = (h - 40) / 3;
    for (let n = 1; n <= 36; n++) { const c = Math.floor((n - 1) / 3), r = 2 - (n - 1) % 3, X = 30 + c * cw, Y = 8 + r * ch; x.fillStyle = reds.has(n) ? '#b81c1c' : '#121212'; x.fillRect(X + 2, Y + 2, cw - 4, ch - 4); x.fillStyle = '#fff'; x.font = '700 10px Inter, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n, X + cw / 2, Y + ch / 2); x.strokeRect(X, Y, cw, ch); }
    x.fillStyle = '#1a8a3a'; x.fillRect(4, 10, 24, h - 52); x.fillStyle = '#fff'; x.fillText('0', 16, h / 2 - 12);
    for (let i = 0; i < 3; i++) { x.strokeRect(30 + i * cw * 4, h - 30, cw * 4, 24); x.fillStyle = '#fff'; x.fillText(['1st 12', '2nd 12', '3rd 12'][i], 30 + i * cw * 4 + cw * 2, h - 18); } }, { nearest: !MOODY });
  box(2.6, .78, 1.3, M(0x3a1d10), 0, .39, 0, g);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, .04, 1.2), [M(0x5a2a12), M(0x5a2a12), new THREE.MeshStandardMaterial({ map: layout, roughness: 1 }), M(0x5a2a12), M(0x5a2a12), M(0x5a2a12)]); top.position.set(.25, .8, 0); g.add(top);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.7, .06, 1.4), M(0x5a2a12)); rail.position.y = .77; g.add(rail);
  const wheel = new THREE.Group(); wheel.position.set(-1.05, .82, 0); g.add(wheel); wheel.name = 'roulette wheel';
  cyl(.42, .45, .1, M(0x4a2410), 0, .05, 0, wheel, 24);
  const seg = canvasTex(256, 16, (x, w, h) => { for (let i = 0; i < 37; i++) { x.fillStyle = i === 0 ? '#1a8a3a' : i % 2 ? '#b81c1c' : '#121212'; x.fillRect(i * w / 37, 0, w / 37 + 1, h); } }, { nearest: false });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.34, .3, .04, 37, 1, true), new THREE.MeshStandardMaterial({ map: seg, side: THREE.DoubleSide, roughness: .7 })); bowl.position.y = .1; wheel.add(bowl);
  const inner = cyl(.3, .3, .03, M(0x8a5a2a), 0, .1, 0, wheel, 37); const spin = new THREE.Group(); spin.add(bowl, inner); wheel.add(spin);
  cyl(.03, .05, .12, M(0xc8a040, { metalness: .4 }), 0, .16, 0, spin, 8);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), M(0xf6f6f6, { roughness: .3 })); ball.position.y = .135; wheel.add(ball); ball.name = 'ball';
  const [s0, s1] = o.spin || [-1e9, -1e9];
  g.userData.update = t => { const k = clamp((t - s0) / Math.max(.1, s1 - s0)); const sp = t < s0 ? t * .3 : t < s1 ? s0 * .3 + (t - s0) * 3 * (1 - k * .6) : s0 * .3 + (s1 - s0) * 2.1 + (t - s1) * .3;
    spin.rotation.y = sp; const br = t < s0 || t > s1 ? .27 : lerp(.4, .27, E.outCubic(k)); const ba = t < s0 ? 0 : -(t - s0) * 7 * (1 - E.outCubic(k) * .9) + sp; ball.position.set(Math.cos(ba) * br, .135 + (t > s0 && t < s1 ? .02 * (1 - k) : 0), Math.sin(ba) * br); };
  g.userData.wheel = wheel; return shadowAll(g);
}
/** a slot machine with spinning reels: slot({ spin: [t0, t1], result: [0, 0, 1], stops: [t, t, t], title, neon, color,
 *  upright, meter, flash }) - procedural cabinet with neon edges and a red payline. Symbols (result index): 0 '7', 1 'BAR',
 *  2 '$', 3 '♦', 4 '★', 5 'X'; result [0, 0, 1] is a near miss (the third 7 stops one row above the line).
 *  upright: true = a standing player's cabinet (deck at 1.0 m, reels at 1.42 m, a bill acceptor on the right: userData.billSlot, local).
 *  meter: t => ({ credit, bet, win }) a credit / win LED meter under the reels. flash: [t0, t1] the lights blink (a win).
 *  settle: [s, s, s] seconds each reel slows down before it stops (default .4; over .6 = a slow crawl, e.g. a near miss). */
export function slot(o = {}) {
  const g = grp('slot machine', 'slot'), body = M(o.color ?? 0x23304f), up = !!o.upright;
  const deckY = up ? 1.0 : .72, reelY = up ? 1.42 : 1.12, topY = up ? 1.86 : 1.6, bodyH = up ? 1.76 : 1.5;
  box(.8, bodyH, .62, body, 0, bodyH / 2, 0, g); box(.8, .2, .66, M(0x0f1426), 0, topY, .02, g);
  const sym = ['7', 'BAR', '$', '♦', '★', 'X'];
  const tex = canvasTex(192, 96, (x, w, h, d = {}) => { x.fillStyle = '#f4f2ea'; x.fillRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let r = 0; r < 3; r++) { const off = (d.off?.[r] ?? 0), fl = Math.floor(off), fr = off - fl; for (let k = -1; k <= 2; k++) { const s = sym[((fl + k) % sym.length + sym.length) % sym.length]; const y = h / 2 + (k - fr) * h / 2.6;
      x.fillStyle = s === '7' ? '#d01818' : s === '$' ? '#1a8a3a' : '#1f3d8a'; x.font = `800 ${s.length > 1 ? 20 : 30}px Inter, Arial`; x.fillText(s, (r + .5) * w / 3, y); } x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect((r + 1) * w / 3 - 1, 0, 2, h); }
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
    if (o.payline !== false) { x.fillStyle = 'rgba(220,20,20,.85)'; x.fillRect(0, h / 2 - 1, 6, 3); x.fillRect(w - 6, h / 2 - 1, 6, 3); x.fillStyle = 'rgba(220,20,20,.35)'; x.fillRect(6, h / 2 - .5, w - 12, 1.5); } }, { nearest: !MOODY });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(.62, .31), screenMaterial(tex, { grid: 96 })); s.position.set(0, reelY, .311); g.add(s); s.name = 'reels';
  const banner = screen('text', { text: o.title || 'JACKPOT', bg: '#7a0d1a', color: '#ffd84a', size: .5 }, { w: .7, h: .16, res: 64 }); banner.position.set(0, topY, .345); g.add(banner);
  const neons = [-.41, .41].map(x => { const n = box(.03, bodyH, .03, glow(o.neon ?? 0xff2f7a, 2.4), x, bodyH / 2, .3, g); n.userData.noCheck = true; return n; });
  box(.66, .06, .2, M(0x101010), 0, deckY, .38, g); const btns = [0, 1, 2].map(i => cyl(.04, .04, .03, glow([0xff3030, 0x30d050, 0x3070ff][i], 1.2), -.2 + i * .2, deckY + .05, .4, g, 6));
  const lever = new THREE.Group(); lever.position.set(.45, deckY + .28, 0); g.add(lever); cyl(.015, .015, .5, M(0xc0c0c0, { metalness: .5 }), 0, .25, 0, lever, 6); const knob = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), M(0xd01818)); knob.position.y = .5; lever.add(knob);
  if (up) { box(.14, .09, .06, M(0x0b0b0e, { roughness: .4 }), .3, deckY + .2, .33, g); const lip = box(.1, .008, .01, glow(0x30d050, 1.5), .3, deckY + .2, .362, g); lip.userData.noCheck = true;
    g.userData.billSlot = new THREE.Vector3(.3, deckY + .2, .365); }   // (on the player's right: KK_Interact's right hand reaches it from 0.89 m in front, 0.07 m left of the centre)
  let meter = null, mk = '';
  if (o.meter) { meter = screen((x, w, h, d) => { x.fillStyle = '#080808'; x.fillRect(0, 0, w, h); const lp = Math.max(1, Math.floor(h / 24)), vp = Math.max(1, Math.floor(h / 16)), cell = w / 3;   // (label + a 5-character value fit a third)
      [['CREDIT', d.credit], ['BET', d.bet], ['WIN', d.win]].forEach(([l, v], i) => { pixelText(x, l, cell * (i + .5), h * .08, lp, '#ffb000', { align: 'center' });
        pixelText(x, v == null ? '' : typeof v === 'number' ? v.toFixed(2) : String(v), cell * (i + .5), h * .08 + lp * 9, vp, i === 2 && d.hot ? '#ffffff' : '#ff3a1a', { align: 'center' }); }); }, o.meter(-1e9) || {}, { w: .62, h: .1, res: 48 });
    meter.position.set(0, reelY - .22, .312); g.add(meter); meter.name = 'credit meter'; }
  const [s0, s1] = o.spin || [-1e9, -1e9], res = o.result ?? [0, 0, 0], stops = o.stops || [s1, s1 + .25, s1 + .5], [f0, f1] = o.flash || [1e9, -1e9];
  let lastKey = '';
  g.userData.update = t => { const off = [0, 1, 2].map(r => { const stop = stops[r]; if (t < s0 || t > stop) return res[r]; const st = o.settle?.[r] ?? .4; return res[r] - (stop - t) * 14 * (1 - E.outCubic(seg(t, stop - st, stop)) * (st > .6 ? .94 : .8)); });
    const key = off.map(v => v.toFixed(3)).join(); if (key !== lastKey) { lastKey = key; redraw(tex, (x, w, h) => tex.userData.draw(x, w, h, { off })); }
    lever.rotation.x = t > s0 && t < s0 + .4 ? Math.sin(seg(t, s0, s0 + .4) * Math.PI) * .9 : 0;
    const on = t >= f0 && t < f1, blink = on ? (Math.floor((t - f0) * 8) % 2 ? .4 : 4.5) : 2.4;
    for (const n of neons) n.material.emissiveIntensity = blink; for (const b of btns) b.material.emissiveIntensity = on ? blink * .6 : 1.2;
    if (meter) { const d = o.meter(t) || {}, k = JSON.stringify(d) + (on && Math.floor((t - f0) * 4) % 2); if (k !== mk) { mk = k; meter.userData.redraw({ ...d, hot: on && Math.floor((t - f0) * 4) % 2 }); } } };
  g.userData.update(0); return shadowAll(g);
}
// ---------- numbers ----------
/** 7-segment / LED digits: led('12:45', { color, h }) - a glowing plane with a dark backing */
export function led(text, o = {}) {
  const str = String(text), segs = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
  const draw = (x, w, h, s = str) => { x.fillStyle = '#060606'; x.fillRect(0, 0, w, h); const cw = w / Math.max(1, s.replace(/[:.]/g, '').length + s.replace(/[^:.]/g, '').length * .4), col = o.color || '#ff2a1a'; let X = 0;
    for (const ch of s) { if (ch === ':' || ch === '.') { x.fillStyle = col; x.fillRect(X + cw * .12, h * (ch === ':' ? .3 : .8), cw * .14, cw * .14); if (ch === ':') x.fillRect(X + cw * .12, h * .62, cw * .14, cw * .14); X += cw * .4; continue; }
      const on = segs[ch] ?? '', t = cw * .14, L = cw * .62, x0 = X + cw * .14, y0 = h * .12, H = h * .76;
      const S2 = { a: [x0, y0, L, t], b: [x0 + L - t, y0, t, H / 2], c: [x0 + L - t, y0 + H / 2, t, H / 2], d: [x0, y0 + H - t, L, t], e: [x0, y0 + H / 2, t, H / 2], f: [x0, y0, t, H / 2], g: [x0, y0 + H / 2 - t / 2, L, t] };
      for (const k of 'abcdefg') { x.fillStyle = on.includes(k) ? col : 'rgba(255,255,255,.05)'; x.fillRect(...S2[k]); } X += cw; } };
  const hgt = o.h ?? .3, n = str.length, tex = canvasTex(Math.max(32, n * 40), 64, draw, { nearest: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(hgt * Math.max(32, n * 40) / 64, hgt), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.name = 'LED ' + str; m.userData.kind = 'led';
  m.userData.set = s => redraw(tex, (x, w, h) => draw(x, w, h, String(s).padStart(n, ' ').slice(-n))); return m;
}
/** a stadium / horse-race scoreboard: scoreboard({ home, away, score: [2, 1], clock }) */
export function scoreboard(o = {}) {
  const g = grp('scoreboard'); box(6, 3, .4, M(0x16181c), 0, 6.5, 0, g); cyl(.15, .2, 5, M(0x555), -2, 2.5, 0, g); cyl(.15, .2, 5, M(0x555), 2, 2.5, 0, g);
  const s = screen((x, w, h, d) => { x.fillStyle = '#05060a'; x.fillRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffd21a'; x.font = `800 ${h * .16}px Inter, Arial`;
    x.fillText(d.home || 'HOME', w * .25, h * .22); x.fillText(d.away || 'AWAY', w * .75, h * .22); x.fillStyle = '#ff3a1a'; x.font = `800 ${h * .42}px Inter, Arial`; x.fillText(String(d.score?.[0] ?? 0), w * .25, h * .62); x.fillText(String(d.score?.[1] ?? 0), w * .75, h * .62);
    x.fillStyle = '#fff'; x.font = `700 ${h * .14}px Inter, Arial`; x.fillText(d.clock || '90:00', w / 2, h * .62); }, o, { w: 5.6, h: 2.6, res: 96 });
  s.position.set(0, 6.5, .21); g.add(s); g.userData.screen = s; return shadowAll(g);
}
/** a desk calendar showing a date: calendar({ month: 'MAR', day: 14, year: 1997 }) - set({ ... }) to flip it */
export function calendar(o = {}) {
  const g = grp('calendar'); const draw = (x, w, h, d) => { x.fillStyle = '#f7f5ef'; x.fillRect(0, 0, w, h); x.fillStyle = '#c8261c'; x.fillRect(0, 0, w, h * .28); x.fillStyle = '#fff'; x.font = `800 ${h * .18}px Inter, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(d.month ?? 'JAN').toUpperCase() + (d.year ? ' ' + d.year : ''), w / 2, h * .14); x.fillStyle = '#111'; x.font = `800 ${h * .5}px Inter, Arial`; x.fillText(String(d.day ?? 1), w / 2, h * .64); };
  const tex = canvasTex(96, 96, (x, w, h) => draw(x, w, h, o), { nearest: !MOODY });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .3, 3), M(0x2a2a2a)); stand.rotation.z = Math.PI / 2;   // (axis along x: turned along z it poked through the page as a black triangle) stand.position.y = .1; g.add(stand);
  const page = new THREE.Mesh(new THREE.PlaneGeometry(.28, .28), new THREE.MeshStandardMaterial({ map: tex, roughness: .9 })); page.position.set(0, .17, .13); page.rotation.x = -.42; g.add(page);   // (in front of the stand: at z .065 the prism's front edge covered the page from the front)
  g.userData.set = d => redraw(tex, (x, w, h) => draw(x, w, h, { ...o, ...d })); return shadowAll(g);
}
// ---------- charts ----------
/** 3D bar chart: bars(values, { colors, w, h, labels, at, dur }) - grows over dur from at */
export function bars(values, o = {}) {
  const g = grp('bar chart', 'chart'), max = Math.max(...values.map(Math.abs), 1e-6), H = o.h ?? 2, gap = o.gap ?? .2, bw = o.w ?? .5, cols = o.colors || ['#36e24a', '#e8231d', '#3aa0ff', '#ffd21a'];
  const items = values.map((v, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, 1, bw), M(cols[i % cols.length], { emissive: cols[i % cols.length], emissiveIntensity: MOODY ? .35 : .1 })); m.position.x = (i - (values.length - 1) / 2) * (bw + gap); g.add(m); return { m, h: Math.abs(v) / max * H }; });
  const at = o.at ?? -1e9, dur = o.dur ?? .8;
  g.userData.update = t => items.forEach((it, i) => { const k = E.outBack(seg(t, at + i * .08, at + i * .08 + dur), 1.2); const hh = Math.max(.001, it.h * k); it.m.scale.y = hh; it.m.position.y = hh / 2; });
  g.userData.update(1e9); return shadowAll(g);
}
/** neon line chart: line(points [[x, y]...] in metres, { color, at, dur }) - draws on */
export function lineChart(pts, o = {}) {
  const g = grp('line chart', 'chart'), curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], 0)));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, o.r ?? .035, 6), glow(o.color ?? 0x3aff7a, 2.2)); g.add(tube);
  const at = o.at ?? -1e9, dur = o.dur ?? 1.2, idx = tube.geometry.index.count;
  g.userData.update = t => { const k = seg(t, at, at + dur); tube.geometry.setDrawRange(0, Math.floor(idx * k / 6) * 6); }; g.userData.update(1e9); return g;
}
// ---------- body ----------
const flesh = c => M(c, { roughness: .6 });
export function heart(o = {}) { const g = grp('heart', 'organ'), m = flesh(o.color ?? 0xb3202a);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.055, 1), m); b.position.set(s * .04, .1, 0); g.add(b); }
  const c = new THREE.Mesh(new THREE.ConeGeometry(.085, .12, 7), m); c.rotation.z = Math.PI; c.position.y = .05; g.add(c);
  cyl(.02, .025, .08, flesh(0xc8485a), .02, .16, -.01, g, 6); cyl(.015, .02, .06, flesh(0x4a5ab8), -.04, .15, 0, g, 6);
  g.userData.beat = t => { const s = 1 + .07 * Math.max(0, Math.sin(t * 7.5)) ** 4; g.scale.setScalar(s); }; return shadowAll(g); }
export function lungs(o = {}) { const g = grp('lungs', 'organ'), m = flesh(o.color ?? 0xd98a96);
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(.08, 1), m); l.scale.set(.75, 1.4, .7); l.position.set(s * .075, .12, 0); g.add(l); }
  cyl(.012, .012, .1, flesh(0xe8c8c0), 0, .27, 0, g, 6); g.userData.breathe = t => { const s = 1 + .05 * Math.sin(t * 1.6); g.children.forEach(c => c.geometry.type === 'IcosahedronGeometry' && c.scale.set(.75 * s, 1.4 * s, .7 * s)); }; return shadowAll(g); }
export function stomach(o = {}) { const g = grp('stomach', 'organ'); const c = new THREE.CatmullRomCurve3([[-.08, .16, 0], [-.02, .1, 0], [.05, .06, 0], [.08, .1, 0], [.06, .16, 0]].map(p => new THREE.Vector3(...p)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, .045, 7), flesh(o.color ?? 0xd9707a))); return shadowAll(g); }
/** a simple procedural skeleton figure (for x-ray shots; the library also has prop.pp.skeleton_dm4q) */
export function skeleton(o = {}) { const g = grp('skeleton', 'skeleton'), b = M(o.color ?? 0xeee8d8);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.1, 1), b); head.position.y = 1.62; g.add(head); cyl(.015, .015, .5, b, 0, 1.25, 0, g, 6);
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(.11 - i * .006, .008, 4, 12, Math.PI * 1.6), b); r.rotation.x = Math.PI / 2; r.rotation.z = Math.PI * .7; r.position.y = 1.4 - i * .05; g.add(r); }
  box(.26, .08, .1, b, 0, .95, 0, g); for (const s of [-1, 1]) { cyl(.02, .02, .42, b, s * .09, .7, 0, g, 6); cyl(.018, .018, .42, b, s * .09, .26, 0, g, 6); cyl(.016, .016, .3, b, s * .2, 1.3, 0, g, 6).rotation.z = s * .2; cyl(.014, .014, .27, b, s * .24, 1.02, 0, g, 6); }
  return shadowAll(g); }
// ---------- signs, markers, labels in 3D ----------
/** a lit sign / board with a word: sign('BLACK!', { w, h, bg, color, glow }) */
export function sign(text, o = {}) {
  const w = o.w ?? 1.6, h = o.h ?? .6, s = screen('text', { text, bg: o.bg ?? '#0f5a2a', color: o.color ?? '#ffffff', size: o.size ?? .5 }, { w, h, res: 96, grid: o.grid ?? 120 });
  const g = grp('sign: ' + text, 'sign'); box(w + .08, h + .08, .06, M(o.frame ?? 0x111111), 0, 0, -.035, g); g.add(s); return g;
}
/** a white ring on the ground around something (highlight): ring(radius) */
export function ring(r = .6, o = {}) { const m = new THREE.Mesh(new THREE.RingGeometry(r * .86, r, 32), new THREE.MeshBasicMaterial({ color: o.color ?? 0xffffff, transparent: true, opacity: .9, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .015; m.name = 'ground ring'; m.userData.noCheck = true; m.userData.ground = true; return m; }
/** the brand sting: chunky 3D block letters (two colours, voxel pixel font) that fly in, hold, spin edge-on and out.
 *  sting(S, 'MY CHANNEL', { at, hold, color, side, dist }) - placed in front of the camera of the shot */
export function sting(S, text, o = {}) {
  const lines = String(text).toUpperCase().split('\n'), px = o.px ?? .06, g = grp('brand sting', 'sting'), front = glow(o.color ?? BRAND.color, MOODY ? .6 : .35), side = M(o.side ?? '#b85a00');
  const geo = new THREE.BoxGeometry(px, px, px * 2.2), list = [];
  lines.forEach((ln, li) => { const chars = [...ln], w = (chars.length * 6 - 1) * px; chars.forEach((ch, ci) => { const gl = glyph(ch); for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gl[r][c] === '#') list.push([-w / 2 + (ci * 6 + c) * px, (lines.length * 8 * px) / 2 - (li * 8 + r) * px]); }); });
  const im = new THREE.InstancedMesh(geo, [side, side, side, side, front, side], list.length); const mm = new THREE.Matrix4(); list.forEach(([x, y], i) => { mm.makeTranslation(x, y, 0); im.setMatrixAt(i, mm); }); g.add(im);
  const at = o.at ?? S.t0, hold = o.hold ?? 1.2, dist = o.dist ?? 3.2;
  g.userData.noCheck = true; g.userData.airborne = true; g.userData.overlay = true;
  S.tick(t => { const cam = S.cam, k = seg(t, at, at + .3), out = seg(t, at + .3 + hold, at + .6 + hold); g.visible = t >= at && out < 1;
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir); g.position.copy(cam.position).addScaledVector(dir, dist * (1 + (1 - E.outBack(k, 1.4)) * 2)); g.quaternion.copy(cam.quaternion);
    g.rotateY((1 - E.outCubic(k)) * -1.2 + E.inCubic(out) * Math.PI / 2 + Math.sin((t - at) * 2) * .06); g.scale.setScalar(Math.max(.001, (1 - out * .3))); });
  S.scene.add(g); return g;
}
// ---------- crowds ----------
/** crowd(S, { n, area: [x0, z0, x1, z1], face: [x, z] | actor, clips, bodies, seed, gap }) - library people with random
 *  clothes, spaced so nobody overlaps, each with its own idle phase; returns the actors */
export function crowd(S, o = {}) {
  const n = o.n ?? 10, r = rnd(o.seed ?? 21), [x0, z0, x1, z1] = o.area || [-4, -3, 4, 1], gap = o.gap ?? .62, pts = [];
  for (let tries = 0; pts.length < n && tries < n * 60; tries++) { const p = [lerp(x0, x1, r()), lerp(z0, z1, r())]; if (pts.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap)) pts.push(p); }
  const clips = o.clips || ['Idle_Loop', 'Idle_Talking_Loop', 'Idle_Loop'], bodies = o.bodies || ['m', 'f'], hairs = ['simpleparted', 'buzzed', 'long', 'buns', 'bald'];
  return pts.map((p, i) => { const f = bodies[i % bodies.length], a = person({ body: f, outfit: randomOutfit((o.seed ?? 21) * 7 + i), skin: ['light', 'medium', 'tan', 'brown', 'pale', 'dark'][Math.floor(r() * 6)],
    hair: f === 'f' ? hairs[2 + Math.floor(r() * 2)] : hairs[Math.floor(r() * 2) + (r() < .3 ? 3 : 0)].replace('buns', 'buzzed'), hairColor: ['#2a1e16', '#5a3a1e', '#c9a24a', '#1a1a1a', '#8a8a8a'][Math.floor(r() * 5)], clip: clips[i % clips.length], phase: r(), name: `extra ${i + 1}` });
    a.at(p[0], 0, p[1]); if (o.face) a.face(o.face?.root ? o.face.root.position : [o.face[0], 0, o.face[1]]); a.place.ry += (r() - .5) * .5; S.add(a); return a; });
}

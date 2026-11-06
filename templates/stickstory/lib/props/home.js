// Stick stories props - HOME, OFFICE, SCHOOL, MEDICAL and STAGE things that stand in a room or hang on its walls:
// appliances (fridge, stove, washing machine, fan, water cooler), wall things (clock, calendar, picture frames, mirror,
// whiteboard, blackboard, coat rack, bunting, string lights), plants, doors, lockers, filing cabinet, podium, lectern,
// heart monitor, AED, IV stand, bins. Owned by the prop agent.
// WALL THINGS have their ORIGIN AT THEIR CENTRE (userData.anchor = 'center'): place them at [x, y, wallZ + .01] with y =
// the centre height (sets NOTES 4.3: pictures centred at 0.86 C = 1.46 m, clocks ~1.6-1.9 m). Their hard drop shadow
// (wall x 0.83, offset down-right) is drawn with them (shadow: false to drop it).
import { B, PAL, face, edge, hi, soft, arcPts, rrPts, onUpdate, screenOn } from './kit.js';
import { clockHands } from './handheld.js';
import { rnd, canvasTex } from '../core.js';

const pick = (o, k, d) => o[k] ?? d;
const wallShadow = (b, x0, y0, x1, y1, o, r = 0) => { if (o.shadow === false) return; const dx = .022, dy = -.03; b.box(x0 + dx, y0 + dy, x1 + dx, y1 + dy, '#000000', { op: o.shadowOp ?? .17, r }); };

// ================================================= appliances =================================================
/** a fridge (iq500 kitchen: #bcbcb3 front, #9d9e94 side strip, two doors, magnets); open: door swung, lit inside; note */
function fridge(o = {}) {
  const b = B(o), c = pick(o, 'color', PAL.fridge), W = o.w ?? .72, H = o.h ?? 1.8, side = .07, split = H * .66;
  b.box(W / 2 - side, 0, W / 2, H, o.sideColor || PAL.fridgeSide, { r: [0, .02, 0, 0] });
  if (o.open) {
    b.box(-W / 2, .02, W / 2 - side, H - .02, '#fff7e2', { lit: true }); b.glow(0, H * .5, W * 1.2, '#fff1cf', { opacity: .3 });
    const sh = []; for (const y of [.35, .7, 1.05, 1.4]) sh.push([-W / 2 + .03, y, W / 2 - side - .03, y + .012]); b.rects(sh, '#d9d4c6', { lit: true });
    const R = rnd(o.seed ?? 4), it = []; for (let i = 0; i < 9; i++) { const y = [.362, .712, 1.062][i % 3], x = -W / 2 + .06 + (i / 3 | 0) * .17 + R() * .04; it.push([x, y, x + .05 + R() * .05, y + .08 + R() * .1, ['#d8392f', '#5f9e4a', '#f0c24a', '#3d7bf0', '#f4f1ea'][i % 5]]); }
    for (const [x0, y0, x1, y1, cc] of it) b.box(x0, y0, x1, y1, cc, { lit: true, r: .01 });
    const d = b.sub('door', b.depth() + .06); d.box(-W / 2 - .3, .02, -W / 2, H - .02, face(c, .05)); d.box(-W / 2 - .3, .02, -W / 2 - .27, H - .02, face(c, .2)); d.rects([[-W / 2 - .26, .4, -W / 2 - .04, .42], [-W / 2 - .26, .9, -W / 2 - .04, .92]], '#e8e2d4');
    return b.done({ size: { w: W + .3, h: H }, grips: { door: [-W / 2 - .28, H * .5] }, light: { x: 0, y: H * .5, color: '#fff1cf' } });
  }
  b.grad(-W / 2, 0, W / 2 - side, H, [[0, face(c, .07)], [1, c]], 'v');
  b.line(-W / 2, split, W / 2 - side, split, .01, edge(c));
  b.box(-W / 2, 0, W / 2 - side, .05, face(c, .25));
  b.rects([[-W / 2 + .06, split + .06, -W / 2 + .085, split + .3], [-W / 2 + .06, split - .45, -W / 2 + .085, split - .08]], hi(c, .25));
  const mg = o.magnets ?? 2; const MC = ['#d8392f', '#3d7bf0', '#f0c24a', '#5f9e4a']; for (let i = 0; i < mg; i++) b.box(.05 + i * .1, split + .25 + (i % 2) * .08, .1 + i * .1, split + .3 + (i % 2) * .08, MC[i % 4], { r: .008 });
  if (o.note) { b.box(.02, split - .45, .2, split - .2, '#f6df6a', { rot: .05 }); if (typeof o.note === 'string') b.text(o.note, .11, split - .32, { size: .028, font: 'Kalam', weight: 700, color: '#2a2a32', rot: .05 }); }
  if (o.drawing) { b.box(-.22, split - .62, .02, split - .3, '#f4f1ea', { rot: -.06 }); b.circ(-.12, split - .45, .05, '#f0c24a'); b.box(-.18, split - .58, -.06, split - .52, '#5f9e4a'); }
  return b.done({ size: { w: W, h: H }, grips: { door: [-W / 2 + .07, split - .25], freezer: [-W / 2 + .07, split + .18] }, top: { y: H, x0: -W / 2, x1: W / 2, z: b.depth(), front: H, back: H } });
}
/** a free-standing cooker: oven with a window, knobs, burners on the top band; lit: burners glowing; color */
function stove(o = {}) {
  const b = B(o), c = pick(o, 'color', '#d9dadb'), W = o.w ?? .6, H = .9;
  b.box(-W / 2, 0, W / 2, H, face(c, .05)); b.box(-W / 2, 0, W / 2, .06, face(c, .3));
  b.box(-W / 2 + .04, .1, W / 2 - .04, .62, PAL.oven, { r: .01 }); b.box(-W / 2 + .08, .16, W / 2 - .08, .5, '#2f3340', { r: .01 });
  if (o.lit) b.box(-W / 2 + .1, .18, W / 2 - .1, .48, '#c26a2a', { op: .55, lit: true });
  b.box(-W / 2 + .06, .56, W / 2 - .06, .58, PAL.chrome, { r: .006 });
  b.box(-W / 2, .66, W / 2, .82, c); b.dots([[-W * .3, .74, .022], [-W * .1, .74, .022], [W * .1, .74, .022], [W * .3, .74, .022]], '#2a2b30');
  b.poly([[-W / 2, .82], [W / 2, .82], [W / 2 - .03, .92], [-W / 2 + .03, .92]], '#2c2e33');
  for (const x of [-W * .22, W * .22]) { b.ell(x, .87, .09, .028, '#16171b'); if (o.lit) { b.ring(x, .87, .05, .06, '#ff7a2a', { lit: true }); } }
  if (o.lit) b.glow(0, .9, .5, '#ff9a4a', { opacity: .25 });
  return b.done({ size: { w: W, h: .92 }, top: { y: .87, x0: -W / 2 + .05, x1: W / 2 - .05, z: b.depth(), front: .82, back: .92 }, grips: { oven: [0, .57] } });
}
/** a washing machine (front loader; spin: the drum turns) */
function washer(o = {}) {
  const b = B(o), c = pick(o, 'color', '#eceae4'), W = .6, H = .85;
  b.box(-W / 2, 0, W / 2, H, c, { r: .015 }); b.box(-W / 2, 0, -W / 2 + .05, H, face(c, .1)); b.box(-W / 2, H - .14, W / 2, H - .135, face(c, .2));
  b.box(-W / 2 + .05, H - .11, -W / 2 + .2, H - .05, '#c9ccd2', { r: .01 }); b.circ(W / 2 - .1, H - .08, .028, face(c, .25)); b.box(W / 2 - .3, H - .1, W / 2 - .17, H - .06, '#1d2a3a', { r: .005 }); b.text('0:42', W / 2 - .235, H - .08, { size: .022, color: '#46e08a', lit: true });
  b.circ(0, .36, .21, '#b9bdc4'); b.circ(0, .36, .17, '#3a4a6a');
  const d = b.sub('drum', b.depth(), { at: [0, .36] }); d.ell(-.04, -.04, .1, .06, o.clothes || '#d8392f', { rot: .4 }); d.ell(.06, .03, .08, .05, '#3d7bf0', { rot: -.3 }); d.ell(.02, -.08, .06, .04, '#f0c24a');
  b.ell(-.06, .43, .08, .04, '#ffffff', { op: .2, lit: true, rot: .6 });
  if (o.spin) onUpdate(b.g, t => { d.g.rotation.z = -t * (o.spin === true ? 6 : o.spin); });
  return b.done({ size: { w: W, h: H }, top: { y: H, x0: -W / 2, x1: W / 2, z: b.depth(), front: H, back: H }, grips: { door: [.2, .36] } });
}
/** a fan: desk (default) | standing; on: blades turn (speed) */
function fan(o = {}) {
  const b = B(o), c = pick(o, 'color', '#e9e8e2'), stand = o.variant === 'standing', H = stand ? 1.25 : .38, R = stand ? .24 : .16;
  b.ell(0, .015, stand ? .2 : .13, .03, face(c, .15)); b.box(-.018, .02, .018, H - R * .8, face(c, .1));
  b.circ(0, H, R, '#d6d6d0', { op: .35 });
  const bl = b.sub('blades', b.depth(), { at: [0, H] }); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, s = bl.sub('blade' + i, 0); s.ell(0, R * .48, R * .2, R * .45, o.blade || '#8fb3d0'); s.g.rotation.z = a; }
  bl.circ(0, 0, R * .16, face(c, .2));
  const cg = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cg.push([0, H, Math.cos(a) * R, H + Math.sin(a) * R]); } b.lines(cg, .004, face(c, .25)); b.ring(0, H, R - .005, R + .005, face(c, .2));
  if (o.on !== false) onUpdate(b.g, t => { bl.g.rotation.z = -t * (o.speed ?? 14); });
  return b.done({ size: { w: R * 2, h: H + R }, grips: { hand: [0, H * .5] } });
}
/** a water cooler (blue bottle upside down on a white stand, red / blue taps, cup holder) */
function waterCooler(o = {}) {
  const b = B(o), c = pick(o, 'color', '#e9e8e2'), H = .95;
  b.box(-.17, 0, .17, H, c, { r: .02 }); b.box(-.17, 0, -.12, H, face(c, .1)); b.box(-.1, .45, .1, .62, face(c, .12), { r: .01 });
  b.box(-.07, .56, -.03, .6, '#3d7bf0'); b.box(.03, .56, .07, .6, '#d8392f'); b.box(-.13, .35, .13, .37, face(c, .25));
  b.box(.18, .3, .22, .7, '#c9ccd2', { op: .8 }); b.box(.185, .62, .215, .69, '#f4f1ea');
  b.poly([[-.15, H + .02], [.15, H + .02], [.15, H + .38], [.06, H + .44], [-.06, H + .44], [-.15, H + .38]], '#8fc3e8', { op: .75 });
  b.box(-.15, H + .12, .15, H + .14, '#6ea9d6', { op: .6 }); b.box(-.15, H + .26, .15, H + .28, '#6ea9d6', { op: .6 }); b.box(-.05, H, .05, H + .03, '#5a96c8');
  b.line(-.11, H + .06, -.11, H + .34, .012, '#ffffff', { op: .5, lit: true });
  return b.done({ size: { w: .44, h: H + .44 }, grips: { tap: [-.05, .58] }, points: { cup: [.2, .66] } });
}

// ================================================= wall things =================================================
/** a wall clock (iq500 kitchen: white face, black ring, red second hand). time 'HH:MM' | hours, run (speed; 1 = real time), d (diameter). ORIGIN = CENTRE */
function clock(o = {}) {
  const b = B(o), D = o.d ?? .3, R = D / 2, ring = pick(o, 'color', '#1d1e22');
  if (o.shadow !== false) b.circ(.02, -.026, R, '#000000', { op: .17 });
  b.circ(0, 0, R, ring); b.circ(0, 0, R * .86, o.face || '#f4f1ea');
  if (o.detail !== 'low') { const tk = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, l = i % 3 ? .1 : .18; tk.push([Math.sin(a) * R * .76, Math.cos(a) * R * .76, Math.sin(a) * R * (.76 - l), Math.cos(a) * R * (.76 - l)]); } b.lines(tk, R * .045, '#2a2a32'); }
  clockHands(b, 0, 0, R * .78, o, '#1d1e22', o.red || '#d8392f');
  return b.done({ size: { w: D, h: D }, anchor: 'center', wall: true });
}
/** a desk / alarm clock on two legs (iq500 macro: thick black ring, white face, red second hand). time, run, wedge [h0, h1] (a grey elapsed-time wedge), bells, d */
function alarmClock(o = {}) {
  const b = B(o), D = o.d ?? .2, R = D / 2, cy = R + R * .22, ring = pick(o, 'color', '#2a2b30');
  b.box(-R * .44, 0, -R * .28, cy - R * .8, ring, { r: R * .05 }); b.box(R * .28, 0, R * .44, cy - R * .8, ring, { r: R * .05 });
  b.circ(0, cy, R * 1.04, '#8a8d93');
  if (o.bells) { b.circ(-R * .6, cy + R * .95, R * .3, ring); b.circ(R * .6, cy + R * .95, R * .3, ring); b.box(-.006, cy + R, .006, cy + R * 1.25, ring); }
  b.circ(0, cy, R, ring); b.circ(0, cy, R * .8, o.face || '#f4f1ea');
  if (o.wedge) { const [h0, h1] = o.wedge, a0 = Math.PI / 2 - h0 / 12 * Math.PI * 2, a1 = Math.PI / 2 - h1 / 12 * Math.PI * 2; b.ell(0, cy, R * .78, R * .78, '#a9a9a6', { arc: [Math.min(a0, a1), Math.max(a0, a1)], op: .6 }); }
  const tk = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, l = i % 3 ? .1 : .18; tk.push([Math.sin(a) * R * .72, cy + Math.cos(a) * R * .72, Math.sin(a) * R * (.72 - l), cy + Math.cos(a) * R * (.72 - l)]); } b.lines(tk, R * .05, '#2a2a32');
  clockHands(b, 0, cy, R * .72, o, '#1d1e22', '#d8392f');
  return b.done({ size: { w: D * 1.05, h: cy + R * (o.bells ? 1.3 : 1) }, grips: { hand: [R * .9, cy] } });
}
/** a wall calendar (iq500: red header, grid of grey squares). month (text), day (circled in red), crossed (n first days X-ed), cols x rows. ORIGIN = CENTRE */
function calendar(o = {}) {
  const b = B(o), W = o.w ?? .3, H = o.h ?? W * 1.12, hd = pick(o, 'color', '#a85148'), cols = 7, rows = 5;
  wallShadow(b, -W / 2, -H / 2, W / 2, H / 2, o);
  b.box(-W / 2, -H / 2, W / 2, H / 2, '#f2efe8'); b.box(-W / 2, H / 2 - H * .22, W / 2, H / 2, hd);
  if (o.month) b.text(String(o.month).toUpperCase(), 0, H / 2 - H * .11, { size: H * .085, color: '#ffffff', weight: 800 });
  b.dots([[-W * .3, H / 2 + .004, .006], [W * .3, H / 2 + .004, .006]], '#3a3b40');
  const cw = (W - .04) / cols, ch = (H * .78 - .04) / rows, cells = [], X = [], C = [];
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const i = r * cols + k, x0 = -W / 2 + .02 + k * cw, y1 = H / 2 - H * .22 - .02 - r * ch; cells.push([x0 + cw * .12, y1 - ch * .88, x0 + cw * .88, y1 - ch * .12]); if (o.crossed && i < o.crossed) X.push([x0 + cw * .2, y1 - ch * .8, x0 + cw * .8, y1 - ch * .2], [x0 + cw * .2, y1 - ch * .2, x0 + cw * .8, y1 - ch * .8]); if (o.day === i + 1) C.push([x0 + cw / 2, y1 - ch / 2]); }
  b.rects(cells, o.cell || '#9b9a96'); if (X.length) b.lines(X, cw * .1, '#d8392f');
  for (const [x, y] of C) b.ring(x, y, Math.min(cw, ch) * .45, Math.min(cw, ch) * .58, '#d8392f');
  return b.done({ size: { w: W, h: H }, anchor: 'center', wall: true });
}
/** a picture frame: picture family | landscape | blueprint | portrait | drawing | abstract | cert | text; frame colour; standing (on a table, origin bottom) | wall (default, ORIGIN = CENTRE) */
function pictureFrame(o = {}) {
  const b = B(o), pic = o.picture || 'family', W = o.w ?? (pic === 'blueprint' ? .45 : pic === 'portrait' ? .26 : .4), H = o.h ?? (pic === 'portrait' ? .34 : pic === 'blueprint' ? .28 : .3);
  const fr = pick(o, 'color', pic === 'blueprint' ? '#3a5a8a' : '#4a3a2e'), th = o.frame === false ? 0 : (o.frameW ?? Math.min(W, H) * .07), st = !!o.standing, y0 = st ? 0 : -H / 2;
  if (st) b.poly([[W * .05, .0], [W * .25, 0], [0, H * .6]], face(fr, .3)); else wallShadow(b, -W / 2, y0, W / 2, y0 + H, o);
  if (th) { b.box(-W / 2, y0, W / 2, y0 + H, fr); b.box(-W / 2 + th, y0 + th, W / 2 - th, y0 + H - th, pic === 'blueprint' ? '#476490' : o.mat || '#e9e4d8'); }
  if (o.pin) b.sub('pin', .05).circ(0, y0 + H - .02, .012, o.pinColor || '#d8392f');
  const x0 = -W / 2 + th * 1.6, x1 = W / 2 - th * 1.6, p0 = y0 + th * 1.6, p1 = y0 + H - th * 1.6, w = x1 - x0, h = p1 - p0, cx = (x0 + x1) / 2, cy = (p0 + p1) / 2;
  if (pic === 'blueprint') { b.ring(cx, cy, h * .22, h * .22 + .004, '#e8eef6'); b.line(x0 + w * .05, p0 + h * .15, x1 - w * .05, p1 - h * .15, .004, '#e8eef6'); }
  else if (pic === 'family' || pic === 'portrait') {
    b.box(x0, p0, x1, p1, '#bcd3de'); b.box(x0, p0, x1, p0 + h * .3, '#7fa86a');
    const ppl = pic === 'portrait' ? [[0, 1, '#3d6fd0']] : (o.people || [[-.28, 1, '#7a6a7a'], [0, .92, '#3d6fd0'], [.26, .66, '#5fb0a0']]);
    for (const [dx, s, cc] of ppl) { const px = cx + dx * w, hh = h * .62 * s; b.box(px - w * .09 * s, p0, px + w * .09 * s, p0 + hh * .55, cc, { r: [w * .05 * s, w * .05 * s, 0, 0] }); b.circ(px, p0 + hh * .72, hh * .17, '#1b1b22'); }
  }
  else if (pic === 'landscape') { b.box(x0, p0, x1, p1, '#9fc0d8'); b.circ(cx + w * .25, p1 - h * .25, h * .12, '#f6e3a0'); b.poly([[x0, p0], [x0, p0 + h * .45], [cx - w * .1, p0 + h * .6], [cx + w * .2, p0 + h * .35], [x1, p0 + h * .5], [x1, p0]], '#6e9a5a'); b.poly([[x0, p0], [cx, p0 + h * .25], [x1, p0 + h * .1], [x1, p0]], '#4f7a45'); }
  else if (pic === 'drawing') { b.box(x0, p0, x1, p1, '#f8f4ea'); b.circ(x1 - w * .2, p1 - h * .2, h * .1, '#f0c24a'); b.box(cx - w * .2, p0 + h * .1, cx + w * .1, p0 + h * .45, o.drawColor || '#85bce8'); b.poly([[cx - w * .26, p0 + h * .45], [cx + w * .16, p0 + h * .45], [cx - w * .05, p0 + h * .7]], '#e14636'); b.path([[x0 + w * .05, p0 + h * .08], [x1 - w * .05, p0 + h * .1]], .006, '#5f9e4a'); }
  else if (pic === 'cert') { b.box(x0, p0, x1, p1, '#f8f4ea'); b.box(cx - w * .3, p1 - h * .25, cx + w * .3, p1 - h * .18, '#2a3a6a'); b.lines([[cx - w * .35, cy, cx + w * .35, cy], [cx - w * .3, cy - h * .12, cx + w * .3, cy - h * .12]], .004, '#9aa3b2'); b.circ(cx + w * .3, p0 + h * .2, h * .1, '#d9b65a'); }
  else if (pic === 'text') { b.box(x0, p0, x1, p1, o.bg || '#f8f4ea'); b.text(o.text || 'HOME', cx, cy, { size: Math.min(h * .3, w * 1.4 / Math.max(3, String(o.text || 'HOME').length)), color: o.ink || '#2a2a32', font: 'Kalam', weight: 700 }); }
  else { b.box(x0, p0, x1, p1, '#e8dcc4'); b.box(x0, p0, cx, cy, '#c65c46'); b.box(cx, cy, x1, p1, '#3d6fd0'); b.circ(cx + w * .2, p0 + h * .25, h * .15, '#f0c24a'); }
  return b.done({ size: { w: W, h: H }, anchor: st ? 'bottom' : 'center', wall: !st, grips: { hand: [W * .45, (st ? H / 2 : 0)] } });
}
/** a mirror (oval | rect) with reflection streaks. ORIGIN = CENTRE */
function mirror(o = {}) { const b = B(o), W = o.w ?? .5, H = o.h ?? .7, fr = pick(o, 'color', '#b49a5c'), gl = o.glass || '#c7d6dd'; if (o.variant === 'rect') { wallShadow(b, -W / 2, -H / 2, W / 2, H / 2, o); b.box(-W / 2, -H / 2, W / 2, H / 2, fr, { r: .01 }); b.box(-W / 2 + .03, -H / 2 + .03, W / 2 - .03, H / 2 - .03, gl); } else { b.ell(.02, -.026, W / 2, H / 2, '#000000', { op: .17 }); b.ell(0, 0, W / 2, H / 2, fr); b.ell(0, 0, W / 2 - .03, H / 2 - .03, gl); }
  b.lines([[-W * .25, -H * .05, -W * .05, H * .25], [-W * .2, -H * .2, W * .05, H * .15]], .02, '#ffffff', { op: .35, lit: true }); return b.done({ size: { w: W, h: H }, anchor: 'center', wall: true }); }
/** a whiteboard (sister lab / office): wall (ORIGIN = CENTRE) or stand: true (mobile, on legs); title (+ type: { t0, fps } types it on letter by letter), lines (blue scribbles), text */
function whiteboard(o = {}) {
  const b = B(o), W = o.w ?? 1.6, H = o.h ?? 1.0, fr = pick(o, 'color', '#84827e'), stand = !!o.stand, y0 = stand ? .75 : -H / 2;
  if (stand) { b.line(-W * .42, 0, -W * .42, y0 + H, .03, '#5f646b'); b.line(W * .42, 0, W * .42, y0 + H, .03, '#5f646b'); b.box(-W * .48, .04, -W * .36, .07, '#5f646b'); b.box(W * .36, .04, W * .48, .07, '#5f646b'); b.dots([[-W * .47, .025, .025], [-W * .37, .025, .025], [W * .37, .025, .025], [W * .47, .025, .025]], '#1d1e22'); }
  else wallShadow(b, -W / 2, y0, W / 2, y0 + H, o);
  b.box(-W / 2, y0, W / 2, y0 + H, fr); b.box(-W / 2 + .025, y0 + .025, W / 2 - .025, y0 + H - .025, '#f2f4f4');
  b.box(-W * .3, y0 - .025, W * .3, y0 + .01, face(fr, .1)); b.box(-W * .2, y0 + .01, -W * .12, y0 + .025, '#2a6ad8'); b.box(-W * .1, y0 + .01, -W * .02, y0 + .025, '#d8392f');
  const ink = o.ink || '#2a5ab8';
  const ls = o.lines ?? 4, segs = []; const R = rnd(o.seed ?? 9);
  for (let i = 0; i < ls; i++) { const y = y0 + H * (.62 - i * .12), x = -W / 2 + .1; let px = x; const pts = [[px, y]]; while (px < x + W * (.45 + R() * .3)) { px += .04; pts.push([px, y + (R() - .5) * .03]); } for (let k = 1; k < pts.length; k++) segs.push([...pts[k - 1], ...pts[k]]); }
  b.lines(segs, .007, ink);
  if (o.title) {
    const title = String(o.title), fs = o.titleSize ?? Math.min(.12, W * 1.3 / Math.max(6, title.length));
    if (o.type) { const tw = W - .2, th = fs * 1.6, tex = canvasTex(Math.round(tw * 600), Math.round(th * 600), () => {}); const drawN = n => { const c = tex.userData.canvas, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.font = `700 ${Math.round(fs * 600 * 1.1)}px "Kalam", sans-serif`; x.fillStyle = ink; x.textBaseline = 'middle'; x.fillText(title.slice(0, n), 10, c.height / 2); tex.needsUpdate = true; };
      b.tex(-W / 2 + .1, y0 + H * .8 - th / 2, -W / 2 + .1 + tw, y0 + H * .8 + th / 2, tex, { transparent: true, order: 3 }); let last = -1; const tp = o.type === true ? {} : o.type;
      const upd = t => { const n = Math.max(0, Math.min(title.length, Math.floor((t - (tp.t0 ?? 0)) * (tp.cps ?? 24 / 2.6)))); if (n !== last) { last = n; drawN(n); } }; upd(-1e9); onUpdate(b.g, upd); b.g.userData.reveal = { chars: title.length, cps: tp.cps ?? 24 / 2.6 }; }
    else b.text(title, -W / 2 + .1, y0 + H * .8, { size: fs, font: 'Kalam', weight: 700, color: ink, align: 'left' });
  }
  if (o.text) b.text(o.text, 0, y0 + H * .4, { size: o.textSize ?? .05, font: 'Kalam', weight: 700, color: ink, lineHeight: 1.3 });
  return b.done({ size: { w: W, h: stand ? y0 + H : H }, anchor: stand ? 'bottom' : 'center', wall: !stand, points: { write: [-W / 2 + .12, y0 + H * .8], board: [0, y0 + H / 2] } });
}
/** a chalkboard (school, timeloop #2f372e): text in chalk, wooden frame, tray. ORIGIN = CENTRE */
function blackboard(o = {}) {
  const b = B(o), W = o.w ?? 2.0, H = o.h ?? 1.05, fr = pick(o, 'color', '#7a5636'), bd = o.board || '#2f372e';
  wallShadow(b, -W / 2, -H / 2, W / 2, H / 2, o); b.box(-W / 2, -H / 2, W / 2, H / 2, fr); b.box(-W / 2 + .04, -H / 2 + .04, W / 2 - .04, H / 2 - .04, bd);
  b.ell(-W * .2, H * .1, W * .2, H * .25, '#ffffff', { op: .02, lit: true }); b.box(-W / 2 + .02, -H / 2 - .03, W / 2 - .02, -H / 2 + .01, face(fr, .15)); b.box(-W * .3, -H / 2 + .01, -W * .25, -H / 2 + .025, '#f4f1ea');
  if (o.text) b.text(o.text, 0, H * .1, { size: o.textSize ?? Math.min(.13, W * 1.1 / Math.max(8, String(o.text).split('\n')[0].length)), font: 'Kalam', weight: 700, color: '#eeeee6', lineHeight: 1.3 });
  if (o.math) b.text(o.math === true ? '2 + 2 = 4\nx = 7' : o.math, -W * .25, -H * .15, { size: .07, font: 'Kalam', weight: 400, color: '#e6e6de' });
  return b.done({ size: { w: W, h: H }, anchor: 'center', wall: true, points: { write: [-W * .3, H * .2] } });
}
/** a coat rack on the wall with coats hanging (iq500 hallway). coats: n | [colours]. ORIGIN = THE BAR CENTRE */
function coatRack(o = {}) {
  const b = B(o), W = o.w ?? .8, cs = Array.isArray(o.coats) ? o.coats : ['#74757a', '#7a5638', '#3a4a6a'].slice(0, o.coats ?? 2);
  b.box(-W / 2, -.01, W / 2, .03, pick(o, 'color', '#5a4434'));
  cs.forEach((c, i) => { const x = -W / 2 + W * (i + .6) / (cs.length + .3); b.box(x - .02, -.04, x + .02, 0, '#2a2b30'); b.poly([[x - .06, -.03], [x + .06, -.03], [x + .13, -.62], [x - .13, -.62]], c); b.poly([[x - .02, -.03], [x + .02, -.03], [x, -.25]], face(c, .25)); b.line(x, -.25, x, -.6, .006, face(c, .2)); });
  return b.done({ size: { w: W, h: .66 }, anchor: 'top', wall: true });
}
/** party bunting: triangles in 5 colours on a sagging string; w; ORIGIN = LEFT ATTACH POINT */
function bunting(o = {}) { const b = B(o), W = o.w ?? 2.4, sag = o.sag ?? .15, n = Math.round(W / .16), C = o.colors || ['#d8392f', '#f0c24a', '#3d7bf0', '#5f9e4a', '#e783a8']; const y = x => -sag * 4 * (x / W) * (1 - x / W);
  const pts = []; for (let i = 0; i <= 20; i++) pts.push([i / 20 * W, y(i / 20 * W)]); b.path(pts, .006, '#e8e2d2');
  for (let i = 0; i < n; i++) { const x0 = (i + .1) / n * W, x1 = (i + .9) / n * W; b.poly([[x0, y(x0)], [x1, y(x1)], [(x0 + x1) / 2, y((x0 + x1) / 2) - .12]], C[i % C.length]); }
  return b.done({ size: { w: W, h: sag + .12 }, anchor: 'left' }); }
/** string lights (NYE): a sagging wire with glowing bulbs; w; ORIGIN = LEFT ATTACH POINT */
function stringLights(o = {}) { const b = B(o), W = o.w ?? 2.4, sag = o.sag ?? .18, n = Math.round(W / .18), y = x => -sag * 4 * (x / W) * (1 - x / W); const pts = []; for (let i = 0; i <= 20; i++) pts.push([i / 20 * W, y(i / 20 * W)]); b.path(pts, .006, '#2a2b30');
  const C = o.colors || ['#ffd27a']; const ds = C.map(() => []); for (let i = 0; i < n; i++) { const x = (i + .5) / n * W; ds[i % C.length].push([x, y(x) - .025, .014]); b.glow(x, y(x) - .025, .12, C[i % C.length], { opacity: .4 }); } ds.forEach((d, i) => b.dots(d, C[i], { lit: true }));
  return b.done({ size: { w: W, h: sag + .05 }, anchor: 'left' }); }

// ================================================= plants =================================================
/** a plant in a pot: small (table, iq500 window plant) | tall (floor) | cactus | flower | hanging (ORIGIN = hook) */
function plant(o = {}) {
  const v = o.variant || 'small', b = B(o), pot = o.pot || PAL.pot, g1 = pick(o, 'color', '#5f9e4a'), g2 = face(g1, .14), R = rnd(o.seed ?? 6);
  const s = v === 'tall' ? 2.6 : 1, pw = .12 * s, ph = .1 * s;
  if (v === 'hanging') { b.line(0, 0, -.1, -.3, .004, '#3a3b40'); b.line(0, 0, .1, -.3, .004, '#3a3b40'); b.poly([[-.12, -.3], [.12, -.3], [.08, -.45], [-.08, -.45]], pot); for (let i = 0; i < 6; i++) { const x = -.12 + i * .05; b.path([[x, -.3], [x + (R() - .5) * .05, -.5 - R() * .2]], .03, i % 2 ? g1 : g2); } return b.done({ size: { w: .3, h: .7 }, anchor: 'top' }); }
  if (v === 'cactus') { b.box(-.03, ph, .03, ph + .2, g1, { r: .03 }); b.box(-.08, ph + .07, -.03, ph + .14, g1, { r: .025 }); b.box(.03, ph + .1, .07, ph + .16, g2, { r: .02 }); }
  else if (v === 'flower') { const cols = o.flowers || ['#e14636', '#f0c24a', '#e783a8']; for (let i = 0; i < 3; i++) { const x = (i - 1) * .05, top = ph + .18 + R() * .08; b.line(x * .5, ph, x, top, .006, g2); b.ell(x - .02, top - .06, .025, .012, g1, { rot: .5 }); b.circ(x, top, .025, cols[i % cols.length]); b.circ(x, top, .009, '#f6df6a'); } }
  else { const n = v === 'tall' ? 9 : 6; for (let i = 0; i < n; i++) { const a = -1.2 + i / (n - 1) * 2.4 + (R() - .5) * .3, L = (v === 'tall' ? .5 : .1) + R() * (v === 'tall' ? .4 : .06), x = Math.sin(a) * L * .6, y = ph + Math.cos(a) * L * .8 + .02;
      if (v === 'tall') b.line(0, ph, x * .8, y - .06, .008, g2); b.ell(x, y, (v === 'tall' ? .09 : .035), (v === 'tall' ? .045 : .02), i % 2 ? g1 : g2, { rot: a + Math.PI / 2 }); } }
  b.poly([[-pw * .38, 0], [pw * .38, 0], [pw * .5, ph * .85], [-pw * .5, ph * .85]], pot); b.box(-pw * .55, ph * .82, pw * .55, ph, hi(pot, .08)); b.poly([[-pw * .38, 0], [-pw * .2, 0], [-pw * .28, ph * .85], [-pw * .5, ph * .85]], face(pot, .1));
  return b.done({ size: { w: v === 'tall' ? 1.0 : .2, h: v === 'tall' ? 1.25 : ph + .2 }, grips: { hand: [pw * .45, ph * .5] } });
}

// ================================================= doors, storage, office, school =================================================
/** a door in its frame: panel (default) | flush | glass | steel; open 0..1 (the leaf swings toward the camera, the doorway behind shows dark or lit); lit (a warm doorway), handle 'lever' | 'bar' (PUSH). Origin = the bottom centre of the opening */
function door(o = {}) {
  const b = B(o), v = o.variant || 'panel', W = o.w ?? .75, H = o.h ?? 1.85, fr = o.frame || '#b6b4ac', leaf = pick(o, 'color', v === 'steel' ? '#7d8288' : v === 'flush' ? '#8a6a4a' : '#453b32'), op = Math.max(0, Math.min(1, o.open ?? 0));
  const ft = .045;
  b.box(-W / 2 - ft, 0, W / 2 + ft, H + ft, fr);
  b.box(-W / 2, 0, W / 2, H, o.lit ? (typeof o.lit === 'string' ? o.lit : '#eccb9c') : (o.inside || '#1e1914'), { lit: !!o.lit });
  if (o.lit) b.glow(0, H * .45, H * .8, typeof o.lit === 'string' ? o.lit : '#ffdcae', { opacity: .18 });
  const lw = W * (1 - op * .92), lx0 = -W / 2, lx1 = lx0 + lw, L = b.sub('leaf', b.depth() + (op > 0 ? .03 : 0));
  L.box(lx0, 0, lx1, H, leaf);
  if (v === 'panel' && lw > W * .3) { const pi = lw * .14; L.box(lx0 + pi, H * .55, lx1 - pi, H - pi, face(leaf, .12)); L.box(lx0 + pi, pi, lx1 - pi, H * .5, face(leaf, .12)); }
  if (v === 'glass') { L.box(lx0 + lw * .15, H * .35, lx1 - lw * .15, H * .9, '#9fb8c8', { op: .8 }); }
  if (v === 'steel') { L.box(lx0 + lw * .3, H * .7, lx1 - lw * .3, H * .82, '#3a3e44'); }
  if (op > 0) L.box(lx1 - .02, 0, lx1, H, face(leaf, .3));
  const hx = op > .5 ? lx0 + lw * .15 : lx1 - .07;
  if (o.handle === 'bar') { L.box(hx - .015, H * .38, hx + .015, H * .62, '#c9ccd2', { r: .01 }); if (o.sign !== false) L.text(o.sign || 'PUSH', (lx0 + lx1) / 2, H * .72, { size: .045, color: '#f4f1ea' }); }
  else { L.circ(hx, H * .5, .022, '#c9ccd2'); L.box(hx - .07 * (op > .5 ? -1 : 1), H * .5 - .01, hx, H * .5 + .01, '#c9ccd2'); }
  if (o.gap) b.box(-W / 2, 0, W / 2, .012, '#ffd9a0', { lit: true });
  return b.done({ size: { w: W + ft * 2, h: H + ft }, grips: { handle: [hx, H * .5], hand: [hx, H * .5] }, points: { doorway: [0, 0] }, open: op });
}
/** a filing cabinet: grey, 4 drawers with handles and label slots; open (index of a drawer pulled out) */
function filingCabinet(o = {}) {
  const b = B(o), c = pick(o, 'color', '#8d949b'), W = .48, n = o.drawers ?? 4, H = n * .33 + .04;
  b.box(-W / 2, 0, W / 2, H, face(c, .1)); b.box(-W / 2, H - .02, W / 2, H, hi(c, .1));
  for (let i = 0; i < n; i++) { const y0 = .03 + i * .33, out = o.open === i ? .06 : 0, d = out ? b.sub('drawer' + i, b.depth() + .05) : b;
    d.box(-W / 2 + .015 - out, y0, W / 2 - .015 + out, y0 + .31, c); d.box(-.06, y0 + .2, .06, y0 + .23, '#c9ccd2', { r: .006 }); d.box(-.05, y0 + .245, .05, y0 + .28, '#f4f1ea'); if (out) d.box(-W / 2 + .03 - out, y0 + .31, W / 2 - .03 + out, y0 + .36, '#efe6d2'); }
  return b.done({ size: { w: W, h: H }, top: { y: H, x0: -W / 2 + .03, x1: W / 2 - .03, z: b.depth(), front: H, back: H }, grips: { drawer: [0, .03 + (o.open ?? 1) * .33 + .21] } });
}
/** lockers (timeloop gym, alternating rust / green): n doors */
function lockers(o = {}) {
  const b = B(o), n = o.n ?? 4, w = .4, H = o.h ?? 1.8, C = o.colors || ['#ad4e30', '#3c7965'], W = n * w;
  b.box(-W / 2, 0, W / 2, .08, '#2a2b30');
  for (let i = 0; i < n; i++) { const x0 = -W / 2 + i * w, c = C[i % C.length]; b.box(x0 + .005, .08, x0 + w - .005, H, c); b.rects([[x0 + .08, H - .25, x0 + w - .08, H - .235], [x0 + .08, H - .21, x0 + w - .08, H - .195], [x0 + .08, H - .17, x0 + w - .08, H - .155]], face(c, .3)); b.box(x0 + w - .08, H * .5, x0 + w - .06, H * .6, '#c9ccd2'); b.box(x0 + .08, H - .1, x0 + .2, H - .06, '#f4f1ea'); }
  return b.done({ size: { w: W, h: H }, top: { y: H, x0: -W / 2, x1: W / 2, z: b.depth(), front: H, back: H } });
}
/** a podium with a seal (timeloop inauguration: #41291f, gold seal) | lectern (slanted top, microphone) */
function podium(o = {}) {
  const v = o.variant || 'podium', b = B(o), c = pick(o, 'color', '#41291f'), W = v === 'lectern' ? .6 : .8, H = 1.1;
  b.poly([[-W / 2, 0], [W / 2, 0], [W * .44, H], [-W * .44, H]], c); b.poly([[-W / 2, 0], [-W * .3, 0], [-W * .26, H], [-W * .44, H]], face(c, .12));
  b.box(-W * .5, H - .02, W * .5, H + .05, hi(c, .08)); b.box(-W / 2 - .02, 0, W / 2 + .02, .05, face(c, .25));
  if (o.seal !== false) { b.circ(0, H * .6, .12, '#d9b65a'); b.circ(0, H * .6, .09, face('#d9b65a', .15)); b.circ(0, H * .6, .04, '#d9b65a'); }
  if (o.mic !== false) { b.path([[W * .25, H + .05], [W * .25, H + .15], [W * .1, H + .3]], .012, '#2a2b30'); b.ell(W * .09, H + .32, .02, .03, '#2a2b30', { rot: .8 }); }
  if (o.text) b.text(o.text, 0, H * .3, { size: .05, color: '#d9b65a' });
  return b.done({ size: { w: W + .04, h: H + .35 }, top: { y: H + .04, x0: -W * .4, x1: W * .4, z: b.depth(), front: H, back: H + .05 }, grips: { left: [-W * .45, H + .03], right: [W * .45, H + .03] }, points: { mic: [W * .09, H + .32] } });
}
/** a globe on a stand (school) */
function globe(o = {}) { const b = B(o), R = .14, c = pick(o, 'color', '#4a86c8'); b.ell(0, .015, .1, .02, '#5a4434'); b.box(-.015, .02, .015, .1, '#5a4434'); b.ring(0, .1 + R + .02, R + .015, R + .03, '#b49a5c', { arc: [-Math.PI * .8, Math.PI * .8] }); b.circ(0, .1 + R + .02, R, c); const g = '#6ea85a', cy = .1 + R + .02; b.ell(-.05, cy + .05, .05, .04, g, { rot: .4 }); b.ell(.05, cy - .03, .04, .06, g, { rot: -.3 }); b.ell(-.02, cy - .08, .03, .02, g); b.ell(-.06, cy + .03, .05, .1, '#ffffff', { op: .12, lit: true }); return b.done({ size: { w: .34, h: .1 + R * 2 + .04 }, grips: { hand: [0, .06] } }); }
/** a bin: office (dark mesh) | kitchen (steel pedal bin) | recycling (blue); full (papers sticking out) */
function trashCan(o = {}) { const v = o.variant || 'office', b = B(o), c = pick(o, 'color', v === 'kitchen' ? '#b8bcc2' : v === 'recycling' ? '#2f6ac0' : '#3a3d44'), W = v === 'kitchen' ? .3 : .28, H = v === 'kitchen' ? .48 : .34;
  if (o.full) { b.circ(-.05, H, .05, '#f4f1ea'); b.circ(.04, H + .01, .045, '#efe6d2'); b.box(-.01, H - .02, .07, H + .06, '#f4f1ea', { rot: .3 }); }
  b.poly([[-W * .42, 0], [W * .42, 0], [W / 2, H], [-W / 2, H]], c); b.poly([[-W * .42, 0], [-W * .3, 0], [-W * .36, H], [-W / 2, H]], face(c, .12)); b.box(-W / 2 - .005, H - .02, W / 2 + .005, H, hi(c, .15));
  if (v === 'kitchen') { b.box(-W / 2 - .01, H, W / 2 + .01, H + .03, face(c, -.05), { r: .01 }); b.box(-.05, 0, .05, .03, '#2a2b30'); }
  if (v === 'recycling') b.ring(0, H * .5, .035, .05, '#ffffff');
  return b.done({ size: { w: W, h: H + .03 }, points: { inside: [0, H * .8] } }); }

// ================================================= medical =================================================
/** a heart monitor on a pole (or on a shelf: stand false): animated ECG screen; flat (flatline), bpm, spo2 */
function heartMonitor(o = {}) {
  const b = B(o), c = pick(o, 'color', '#d6d9dd'), stand = o.stand !== false, y0 = stand ? 1.15 : 0, W = .42, H = .32;
  if (stand) { b.line(0, .05, 0, y0, .03, '#9ea4aa'); b.line(-.22, 0, 0, .06, .02, '#9ea4aa'); b.line(.22, 0, 0, .06, .02, '#9ea4aa'); b.dots([[-.22, .02, .02], [.22, .02, .02]], '#2a2b30'); }
  b.box(-W / 2, y0, W / 2, y0 + H, c, { r: .02 }); b.box(-W / 2, y0, W / 2, y0 + .04, face(c, .15), { r: [0, 0, .02, .02] });
  screenOn(b, -W / 2 + .025, y0 + .05, W / 2 - .025, y0 + H - .025, { ui: 'ecg', bpm: o.bpm ?? 72, spo2: o.spo2 ?? 98, flat: !!o.flat }, 'ecg', 480, 300, { fps: 12, t: o.t, glow: o.glow ?? .2, glowColor: '#46e08a', glowR: 1.1 });
  return b.done({ size: { w: W, h: y0 + H }, points: { screen: [0, y0 + H / 2] } });
}
/** an AED (green box, white heart with a lightning bolt) */
function aed(o = {}) { const b = B(o), c = pick(o, 'color', '#2f9a5a'), W = .28, H = .3; b.path([[-W * .25, H], [-W * .25, H + .05], [W * .25, H + .05], [W * .25, H]], .02, face(c, .2)); b.box(-W / 2, 0, W / 2, H, c, { r: .03 }); b.box(-W / 2, 0, -W / 2 + .04, H, face(c, .12), { r: [0, 0, 0, .03] });
  const cx = 0, cy = H * .58; b.circ(cx - .028, cy + .01, .032, '#ffffff'); b.circ(cx + .028, cy + .01, .032, '#ffffff'); b.poly([[cx - .058, cy], [cx + .058, cy], [cx, cy - .07]], '#ffffff'); b.poly([[cx + .008, cy + .035], [cx - .02, cy - .005], [cx, cy - .005], [cx - .01, cy - .045], [cx + .02, cy - .002], [cx, cy - .002]], c);
  b.text(o.label || 'AED', 0, H * .2, { size: .045, color: '#ffffff' }); return b.done({ size: { w: W, h: H + .06 }, grips: { hand: [0, H + .05] } }); }
/** an IV stand with a bag and a tube */
function ivStand(o = {}) { const b = B(o), H = 1.9; b.line(-.2, 0, 0, .06, .02, '#9ea4aa'); b.line(.2, 0, 0, .06, .02, '#9ea4aa'); b.dots([[-.2, .02, .02], [.2, .02, .02]], '#2a2b30'); b.line(0, .05, 0, H, .018, '#b8bcc2'); b.path([[-.12, H - .05], [0, H], [.12, H - .05]], .012, '#b8bcc2');
  b.box(-.17, H - .38, -.05, H - .1, '#e3eef2', { op: .8, r: .02 }); b.box(-.16, H - .36, -.06, H - .22, o.liquid || '#f3e3a0', { op: .7, r: .015 }); b.path([[-.11, H - .38], [-.11, H - .6], [-.05, H - 1.0], [.1, H - 1.2]], .005, '#d8e6ec', { op: .8 });
  return b.done({ size: { w: .4, h: H }, grips: { hand: [0, 1.0] } }); }

// ================================================= kitchen wall pieces =================================================
/** upper (wall) cabinets (iq500 kitchen: green #697869 doors, darker panel lines, small light handle pairs at the bottom). n doors; ORIGIN = BOTTOM CENTRE (hang at ~1.33 m) */
function wallCabinet(o = {}) {
  const b = B(o), c = pick(o, 'color', PAL.cabinet), n = o.n ?? 4, dw = o.doorW ?? .37, W = n * dw, H = o.h ?? .54;
  wallShadow(b, -W / 2, 0, W / 2, H, o);
  b.box(-W / 2, 0, W / 2, H, c); b.box(-W / 2, 0, W / 2, .025, face(c, .18));
  const seg = []; for (let i = 1; i < n; i++) seg.push([-W / 2 + i * dw, .02, -W / 2 + i * dw, H]); b.lines(seg, .01, PAL.cabLine);
  const hs = []; for (let i = 0; i < n; i += 2) { const x = -W / 2 + (i + 1) * dw; if (i + 1 < n) hs.push([x - .07, .06, x - .055, .14], [x + .055, .06, x + .07, .14]); else hs.push([x - .07, .06, x - .055, .14]); } b.rects(hs, '#d9dccf');
  return b.done({ size: { w: W, h: H }, anchor: 'bottom', wall: true });
}
/** a cooker hood: chimney up to the ceiling + a grey trapezoid canopy (iq500 #b4b6b6). chimney (m). ORIGIN = BOTTOM CENTRE of the canopy */
function hood(o = {}) {
  const b = B(o), c = pick(o, 'color', '#b4b6b6'), W = o.w ?? .62, ch = o.chimney ?? .75;
  b.box(-.11, .16, .11, .16 + ch, face(c, .05)); b.box(-.11, .16, -.07, .16 + ch, face(c, .14));
  b.poly([[-W / 2, .03], [W / 2, .03], [.14, .19], [-.14, .19]], c); b.box(-W / 2 - .01, 0, W / 2 + .01, .035, face(c, .2));
  return b.done({ size: { w: W + .02, h: .16 + ch }, anchor: 'bottom', wall: true });
}
/** a wall shelf with spice jars (iq500: orange, green, beige, red). jars [colours]; ORIGIN = THE BOARD (bottom centre) */
function spiceRack(o = {}) {
  const b = B(o), J = o.jars || ['#c8753a', '#6e8a4a', '#d9c08a', '#a8423a'], W = o.w ?? Math.max(.45, J.length * .13 + .1);
  J.forEach((c, i) => { const x = -W / 2 + .1 + i * (W - .2) / Math.max(1, J.length - 1); b.box(x - .035, .025, x + .035, .13, c, { r: .006 }); b.box(x - .035, .025, x - .02, .13, face(c, .12)); b.box(x - .038, .13, x + .038, .155, '#e8e2d2', { r: .004 }); });
  b.box(-W / 2, 0, W / 2, .025, pick(o, 'color', '#8a6a48'));
  return b.done({ size: { w: W, h: .155 }, anchor: 'bottom', wall: true, top: { y: .025, x0: -W / 2 + .03, x1: W / 2 - .03, z: b.depth(), front: .025, back: .025 } });
}
/** a dish rack on the counter with plates on edge */
function dishRack(o = {}) { const b = B(o), c = o.color || '#c9ccd2', W = .36; const pl = []; for (let i = 0; i < 5; i++) pl.push([-W * .35 + i * .055, .03, -W * .35 + i * .055 + .012, .2]); b.rects(pl, '#f1f0ea'); b.lines([[-W / 2, .02, W / 2, .02], [-W / 2, .1, W / 2, .1], [-W / 2, .02, -W / 2, .12], [W / 2, .02, W / 2, .12]], .008, c); b.box(-W / 2, 0, W / 2, .02, face(c, .2)); return b.done({ size: { w: W, h: .2 } }); }
/** a tile backsplash panel (iq500: #b7b8ac tiles, grout #a8a79e); w, h, tile; ORIGIN = BOTTOM CENTRE */
function tiles(o = {}) { const b = B(o), W = o.w ?? 1.8, H = o.h ?? .6, t = o.tile ?? .1, c = pick(o, 'color', PAL.tile), g = o.grout || '#a8a79e'; b.box(-W / 2, 0, W / 2, H, c); const s = []; for (let x = -W / 2 + t; x < W / 2 - .01; x += t) s.push([x, 0, x, H]); for (let y = t; y < H - .01; y += t) s.push([-W / 2, y, W / 2, y]); b.lines(s, .008, g); return b.done({ size: { w: W, h: H }, anchor: 'bottom', wall: true }); }
/** a light switch plate. ORIGIN = CENTRE */
function lightSwitch(o = {}) { const b = B(o), c = o.color || '#e9e8e2'; b.box(-.04, -.06, .04, .06, c, { r: .008 }); b.box(-.015, -.03, .015, .03, face(c, .12), { r: .004 }); return b.done({ size: { w: .08, h: .12 }, anchor: 'center', wall: true, grips: { hand: [0, 0] } }); }
/** curtains on a rod (iq500 kitchen: yellow #d6b77a with darker vertical folds): w (rod), h; open 0..1 (how far they are drawn aside); ORIGIN = THE ROD CENTRE (anchor top) */
function curtains(o = {}) {
  const b = B(o), c = pick(o, 'color', '#d6b77a'), W = o.w ?? 1.6, H = o.h ?? 1.3, op = o.open ?? 1, pw = W / 2 * (1 - op * .72);
  b.box(-W / 2 - .06, -.02, W / 2 + .06, .02, '#6a5a48', { r: .01 });
  for (const s of [-1, 1]) { const x0 = s < 0 ? -W / 2 : W / 2 - pw, x1 = x0 + pw; b.poly([[x0, -.02], [x1, -.02], [x1 + s * .02, -H], [x0 - s * .02, -H]], c); const f = []; const n = Math.max(2, Math.round(pw / .07)); for (let i = 1; i < n; i++) { const x = x0 + pw * i / n; f.push([x, -.03, x + s * .01, -H + .02]); } b.lines(f, .008, face(c, .18)); b.box(x0, -H * .62, x1, -H * .58, face(c, .1)); }
  return b.done({ size: { w: W + .12, h: H }, anchor: 'top', wall: true });
}

// ================================================= more rooms: bathroom, lab, kindergarten, stage, heist =================================================
/** a sink: pedestal (timeloop bathroom: white basin on a column, tap) | vanity (basin on a small cabinet) */
function sink(o = {}) {
  const b = B(o), c = pick(o, 'color', '#eef0ee'), v = o.variant || 'pedestal';
  if (v === 'vanity') { b.box(-.3, 0, .3, .78, o.cabinet || '#9a8a74'); b.box(-.27, .05, -.015, .72, face(o.cabinet || '#9a8a74', .08)); b.box(.015, .05, .27, .72, face(o.cabinet || '#9a8a74', .08)); }
  else { b.poly([[-.07, 0], [.07, 0], [.05, .62], [-.05, .62]], face(c, .06)); b.box(-.12, 0, .12, .03, face(c, .12)); }
  b.poly([[-.3, .78], [.3, .78], [.25, .64], [-.25, .64]], c); b.box(-.31, .78, .31, .84, hi(c, .05), { r: .015 }); b.ell(0, .82, .22, .025, face(c, .14));
  b.path([[0, .84], [0, .95], [.08, .96], [.1, .92]], .022, PAL.chrome); b.box(-.03, .84, .03, .86, face(PAL.chrome, .1));
  return b.done({ size: { w: .62, h: .96 }, points: { tap: [.1, .92], basin: [0, .82] }, top: { y: .82, x0: -.25, x1: .25, z: b.depth(), front: .8, back: .84 } });
}
/** an LED clock / counter box (sister office + lobby: red digits on black with a faint red glow). text, or time 'HH:MM' + run (counts on), countdown { from (s), t0 }; ORIGIN = CENTRE */
function ledClock(o = {}) {
  const b = B(o), W = o.w ?? .5, H = W * .36, red = o.color || '#ff3a2a';
  b.box(-W / 2, -H / 2, W / 2, H / 2, '#0d0d10', { r: .01 }); b.glow(0, 0, W * .9, red, { opacity: .18, sy: .5 });
  const tex = canvasTex(256, 92, () => {}), fmt = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const base = typeof o.time === 'string' ? o.time.split(':').map(Number) : null, h0 = base ? base[0] * 60 + base[1] : 0;
  const textAt = t => o.text ? String(o.text) : o.countdown ? fmt(o.countdown.from - (t - (o.countdown.t0 ?? 0))) : base ? (() => { const m = Math.floor(h0 + (o.run ? (t - (o.t0 ?? 0)) * o.run / 60 : 0)); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); })() : '00:00';
  let last = null; const draw = t => { const s = textAt(t); if (s === last) return; last = s; const c = tex.userData.canvas, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.font = '700 70px "JetBrains Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,58,42,.15)'; x.fillText('88:88', 128, 48); x.fillStyle = red; x.fillText(s, 128, 48); tex.needsUpdate = true; };
  draw(o.t0 ?? 0); b.tex(-W * .44, -H * .4, W * .44, H * .4, tex, { transparent: true, order: 3 });
  if (o.run || o.countdown) onUpdate(b.g, draw);
  return b.done({ size: { w: W, h: H }, anchor: 'center', wall: true });
}
/** a bicycle wheel (sister home office shelf): rim + spokes */
function wheel(o = {}) { const b = B(o), R = o.r ?? .34; b.ring(0, R, R - .025, R, '#1d1e22'); b.ring(0, R, R - .035, R - .025, '#7e8288'); const s = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; s.push([0, R, Math.cos(a) * (R - .03), R + Math.sin(a) * (R - .03)]); } b.lines(s, .004, '#3a3d44'); b.circ(0, R, .025, '#5f646b'); return b.done({ size: { w: R * 2, h: R * 2 } }); }
/** a flag on a pole (timeloop inauguration: green flags): color, emblem (a circle), wave (cloth sways), h */
function flag(o = {}) {
  const b = B(o), H = o.h ?? 2.6, c = pick(o, 'color', '#247265'), fw = o.w ?? .9, fh = fw * .62;
  b.box(-.02, 0, .02, H, '#c9ccd2'); b.circ(0, H + .03, .04, '#d9b65a');
  const F = b.sub('cloth', b.depth(), { at: [.02, H - .02] });
  const n = 8, pts = []; for (let i = 0; i <= n; i++) pts.push([fw * i / n, 0]); for (let i = n; i >= 0; i--) pts.push([fw * i / n, -fh]);
  F.poly(pts, c); F.box(0, -fh, fw * .08, 0, face(c, .15)); if (o.emblem !== false) F.circ(fw * .5, -fh * .5, fh * .2, o.emblem || '#f4f1ea');
  if (o.wave !== false) onUpdate(b.g, t => { F.g.scale.y = 1 + .04 * Math.sin(t * 2.2); F.g.rotation.z = -.03 * Math.sin(t * 1.7) * b.fx; F.g.scale.x = 1 - .03 * Math.sin(t * 2.2 + 1); });
  return b.done({ size: { w: fw + .1, h: H + .07 }, grips: { pole: [0, 1.0] } });
}
/** a microscope (lab) */
function microscope(o = {}) { const b = B(o), c = pick(o, 'color', '#e9e8e2'), d = '#2a2b30'; b.box(-.1, 0, .1, .03, d, { r: .006 }); b.path([[.05, .03], [.07, .18], [.02, .3]], .04, c); b.box(-.06, .12, .06, .14, d); b.box(-.03, .14, .0, .24, d, { rot: -.3 }); b.box(-.06, .22, -.01, .36, c, { r: .01, rot: -.3 }); b.box(-.08, .34, -.04, .4, d, { r: .006, rot: -.3 }); b.circ(.07, .17, .02, face(c, .2)); return b.done({ size: { w: .22, h: .4 } }); }
/** a test-tube rack with coloured liquids (lab: 8 colours) */
function testTubes(o = {}) { const b = B(o), n = o.n ?? 8, W = n * .035 + .04, C = o.colors || ['#d8392f', '#f0c24a', '#5f9e4a', '#3d7bf0', '#8a63c9', '#e98a3a', '#3a9c96', '#e783a8']; for (let i = 0; i < n; i++) { const x = -W / 2 + .035 + i * .035; b.box(x - .009, .03, x + .009, .17, '#e3eef2', { op: .6, r: .009 }); b.box(x - .008, .032, x + .008, .06 + (i * 37 % 7) / 100, C[i % C.length], { r: .008 }); } b.box(-W / 2, 0, W / 2, .03, '#b8bcc2'); b.box(-W / 2, .11, W / 2, .125, '#b8bcc2'); return b.done({ size: { w: W, h: .17 } }); }
/** a kindergarten cot (timeloop: near-black frame, coloured blanket, white pillow) */
function cot(o = {}) { const b = B(o), fr = o.frame || '#1d0a0c', bl = pick(o, 'color', '#94a273'), L = o.w ?? 1.3, T = .32; b.box(-L / 2, 0, -L / 2 + .04, T + .18, fr); b.box(L / 2 - .04, 0, L / 2, T + .12, fr); b.box(-L / 2, T - .04, L / 2, T, fr); b.box(-L / 2 + .04, T, L / 2 - .04, T + .05, '#f4ead8'); b.ell(-L / 2 + .2, T + .09, .14, .06, '#f8f4ea'); const lieZ = b.depth() + .05; const f = b.sub('blanket', lieZ + .05); f.box(-L / 2 + .34, T - .06, L / 2 - .03, T + .1, bl, { r: [.04, .04, 0, 0] }); f.box(-L / 2 + .34, T + .06, L / 2 - .03, T + .1, hi(bl, .15), { r: [.04, .04, 0, 0] });
  return b.done({ size: { w: L, h: T + .18 }, lie: { x0: -L / 2 + .15, x1: L / 2 - .05, y: T + .05, z: lieZ, head: 'left' }, seat: { x: 0, y: T + .05, z: lieZ + .12, depth: .3 }, front: f.g }); }
/** a grand piano, side view (timeloop stage: black, open lid), bench; keys toward the right; seat for the pianist */
function piano(o = {}) { const b = B(o), c = pick(o, 'color', '#141416'), L = 1.9;
  b.line(-L / 2 + .15, 0, -L / 2 + .15, .62, .06, c); b.line(L / 2 - .2, 0, L / 2 - .2, .62, .06, c); b.box(L / 2 - .25, .3, L / 2 - .15, .34, '#c9a24a');
  b.poly([[-L / 2, .62], [L / 2, .62], [L / 2, .95], [L * .1, .95], [-L / 2 + .15, .82]], c); b.poly([[L * .1, .95], [L / 2 - .1, .95], [-L / 2 + .3, 1.55]], face(c, -.25)); b.line(-L * .1, .95, -L * .05, 1.35, .015, '#3a3d44');
  b.box(L / 2 - .02, .78, L / 2 + .06, .86, '#f4f1ea'); b.box(L / 2 - .02, .84, L / 2 + .06, .86, '#141416'); b.line(L / 2 - .05, .95, L / 2 - .02, 1.12, .012, '#f4f1ea');
  b.box(L / 2 + .35, .44, L / 2 + .8, .5, c); b.line(L / 2 + .4, 0, L / 2 + .4, .44, .04, c); b.line(L / 2 + .75, 0, L / 2 + .75, .44, .04, c);
  return b.done({ size: { w: L + .8, h: 1.55 }, seat: { x: L / 2 + .57, y: .5, z: b.depth() + .05, depth: .35, facing: -1 }, points: { keys: [L / 2 + .02, .86] } }); }

export const REG = {
  sink: { tags: ['home', 'bathroom'], desc: 'sink. variant pedestal (timeloop bathroom) | vanity (basin on a cabinet); points tap, basin', make: sink },
  ledClock: { tags: ['wall', 'office', 'tech'], desc: "LED box with red digits (sister office / lobby), ORIGIN = CENTRE. text | time 'HH:MM' + run (speed) | countdown { from (s), t0 }; w, color", make: ledClock },
  wheel: { tags: ['home', 'office'], desc: 'bicycle wheel (sister home office shelf); r', make: wheel },
  flag: { tags: ['stage', 'street'], desc: 'flag on a pole (timeloop green flags); color, emblem (colour | false), wave (default: the cloth sways), w, h', make: flag },
  microscope: { tags: ['lab', 'school'], desc: 'microscope (lab)', make: microscope },
  testTubes: { tags: ['lab', 'school'], desc: 'test-tube rack with coloured liquids; n, colors', make: testTubes },
  cot: { tags: ['furniture', 'school', 'kindergarten'], desc: 'kindergarten cot (timeloop: near-black frame, coloured blanket, white pillow); color (blanket), w; lie + front (blanket)', make: cot },
  piano: { tags: ['stage', 'music', 'furniture'], desc: 'grand piano side view (black, open lid) with its bench; seat (pianist, facing left toward the keys); points keys', make: piano },
  wallCabinet: { tags: ['kitchen', 'wall'], desc: 'upper kitchen cabinets (iq500 green doors, handle pairs), ORIGIN = BOTTOM CENTRE (hang ~1.33 m). n doors, doorW, h, color', make: wallCabinet },
  hood: { tags: ['kitchen', 'wall'], desc: 'cooker hood: grey canopy + chimney (chimney m), ORIGIN = canopy bottom centre (~1.5 m over the hob)', make: hood },
  spiceRack: { tags: ['kitchen', 'wall'], desc: 'wall shelf with spice jars, ORIGIN = the board; jars [colours], w', make: spiceRack },
  dishRack: { tags: ['kitchen'], desc: 'dish rack with plates on edge (stands on the counter)', make: dishRack },
  tiles: { tags: ['kitchen', 'wall'], desc: 'tile backsplash panel (iq500 #b7b8ac, grout lines), ORIGIN = BOTTOM CENTRE; w, h, tile, color, grout', make: tiles },
  lightSwitch: { tags: ['wall', 'home'], desc: 'light switch plate, ORIGIN = CENTRE (~1.1 m)', make: lightSwitch },
  curtains: { tags: ['wall', 'home'], desc: 'curtains on a rod (iq500 yellow, fold lines), ORIGIN = THE ROD (anchor top); w, h, open 0..1, color', make: curtains },
  fridge: { tags: ['kitchen', 'home', 'appliance'], desc: 'fridge (iq500: #bcbcb3, side strip, two doors, magnets). open (lit inside, items, door swung), note (sticky note text), drawing, magnets n, w, h; grips door', make: fridge },
  stove: { tags: ['kitchen', 'appliance'], desc: 'free-standing cooker: oven window, knobs, burners on top; lit (burners + oven glow); top', make: stove },
  washer: { tags: ['home', 'appliance'], desc: 'washing machine (front loader); spin (true | speed: the clothes turn), clothes colour', make: washer },
  fan: { tags: ['home', 'office', 'appliance'], desc: 'electric fan. variant desk | standing; on (default: blades turn), speed', make: fan },
  waterCooler: { tags: ['office'], desc: 'office water cooler: blue bottle, white stand, taps, cups', make: waterCooler },
  clock: { tags: ['wall', 'home', 'office', 'school'], desc: "wall clock, ORIGIN = CENTRE (iq500: white face, black ring, red second hand). time 'HH:MM' | hours, run (speed, 1 = real time; 60 = a minute per second), t0, d, color (ring), seconds: false", make: clock },
  alarmClock: { tags: ['home', 'handheld'], desc: "desk / alarm clock on legs (iq500 macro). time 'HH:MM', run, t0, wedge [h0, h1] (grey elapsed wedge), bells, d, color", make: alarmClock },
  calendar: { tags: ['wall', 'home', 'office'], desc: 'wall calendar, ORIGIN = CENTRE (red header, grey squares). month, day (red circle), crossed (n days X-ed), w', make: calendar },
  pictureFrame: { tags: ['wall', 'home'], desc: 'framed picture, ORIGIN = CENTRE (standing: true = on a table, origin bottom). picture family | landscape | blueprint | portrait | drawing | abstract | cert | text (text); people [[dx, scale, colour]], frame: false (bare paper, e.g. kids drawings), pin (red pin), w, h, color (frame)', make: pictureFrame },
  mirror: { tags: ['wall', 'home'], desc: 'mirror, ORIGIN = CENTRE. variant oval | rect; w, h', make: mirror },
  whiteboard: { tags: ['wall', 'office', 'school'], desc: "whiteboard, ORIGIN = CENTRE (stand: true = mobile on legs, origin bottom). title (Kalam), type: true | { t0, cps } (types the title on, ~2.6 frames a letter), lines n (blue scribbles), text, ink, w, h; points write", make: whiteboard },
  blackboard: { tags: ['wall', 'school'], desc: 'chalkboard, ORIGIN = CENTRE (#2f372e, wood frame, chalk tray). text (chalk), math (true | text), w, h', make: blackboard },
  coatRack: { tags: ['wall', 'home'], desc: 'wall coat rack with coats, ORIGIN = THE BAR (anchor top). coats n | [colours], w', make: coatRack },
  bunting: { tags: ['wall', 'party'], desc: 'party bunting, ORIGIN = LEFT ATTACH POINT. w, sag, colors', make: bunting },
  stringLights: { tags: ['wall', 'party', 'light'], desc: 'string lights with glowing bulbs, ORIGIN = LEFT ATTACH POINT. w, sag, colors', make: stringLights },
  plant: { tags: ['home', 'office'], desc: 'plant in a terracotta pot. variant small (table / sill) | tall (floor) | cactus | flower (flowers) | hanging (origin = hook); color (leaves), pot, seed', make: plant },
  door: { tags: ['home', 'office', 'school'], desc: "door in its frame, origin = bottom centre of the opening (1.85 m). variant panel | flush | glass | steel; open 0..1 (leaf swings toward the camera), lit (warm doorway, or a colour), gap (lit gap under a closed door), handle 'bar' (+ sign PUSH), color, frame, w, h; grips handle", make: door },
  filingCabinet: { tags: ['office'], desc: 'grey filing cabinet, drawers n (4); open (index of a pulled-out drawer)', make: filingCabinet },
  lockers: { tags: ['school', 'sports'], desc: 'row of lockers (timeloop gym, rust / green); n, h, colors', make: lockers },
  podium: { tags: ['stage', 'office'], desc: 'podium with a gold seal and a microphone (timeloop). variant podium | lectern; seal, mic, text, color', make: podium },
  lectern: { tags: ['stage', 'school'], desc: 'lectern (= podium variant lectern)', make: o => podium({ ...o, variant: 'lectern' }) },
  globe: { tags: ['school', 'office'], desc: 'globe on a stand', make: globe },
  trashCan: { tags: ['office', 'home', 'kitchen'], desc: 'bin. variant office | kitchen (pedal bin) | recycling; full (papers on top)', make: trashCan },
  heartMonitor: { tags: ['medical'], desc: 'heart monitor on a wheeled pole (stand: false = the box only) with an animated ECG screen; bpm, spo2, flat (flatline), glow', make: heartMonitor },
  aed: { tags: ['medical'], desc: 'AED box (green, white heart + bolt, label)', make: aed },
  ivStand: { tags: ['medical'], desc: 'IV stand with a bag and a tube; liquid', make: ivStand },
};

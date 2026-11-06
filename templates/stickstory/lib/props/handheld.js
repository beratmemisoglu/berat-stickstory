// Stick stories props - HANDHELD things and FOOD (everything a character holds or uses). Owned by the prop agent.
// Sizes from the hands study (analysis/hands/NOTES.md 1.2, D = head diameter .31 m): phone .40 D, mug .31 D tall,
// jar .18 D, book .7 D, briefcase 1.3 x .9 D, gift box .9 x .4 D, stun gun .95 D. Each prop stands on y = 0 (origin
// bottom centre); long tools stand upright with the grip at the bottom (o.lying: true lays them down, top to the right).
// userData.grips = where a hand nub goes (the nub is drawn OVER the gripped part), userData.points = other anchors
// (rim for a sip, tip of a pen, spout...). The mug matches the references across framings: dark body, lighter rim,
// orange label, two steam wisps.
import { THREE } from '../core.js';
import { B, PAL, face, edge, hi, soft, arcPts, rrPts, onUpdate } from './kit.js';
import { rnd } from '../core.js';

const pick = (o, k, d) => o[k] ?? d;
/** two (or n) steam wisps rising from (x, y): white strokes that sway (pure function of time) */
function steam(b, x, y, o = {}) {
  const n = o.n ?? 2, H = o.h ?? .14, wisps = [];
  for (let i = 0; i < n; i++) {
    const pts = []; for (let k = 0; k <= 14; k++) { const t = k / 14; pts.push([Math.sin(t * Math.PI * 1.15 + i * 1.3) * .009 * (.3 + t), t * H * (1 - i * .18)]); }
    const sg = b.sub('steam' + i, .03 + i * .002, { at: [x + (i - (n - 1) / 2) * .022, y + .01] });
    sg.path(pts, o.w ?? .009, '#ffffff', { op: o.opacity ?? .4, lit: true, taper: true });
    wisps.push(sg.g);
  }
  onUpdate(b.g, t => wisps.forEach((g, i) => { g.scale.x = 1 + .35 * Math.sin(t * 1.4 + i * 2.1); g.rotation.z = .06 * Math.sin(t * .9 + i); g.scale.y = 1 + .06 * Math.sin(t * 1.1 + i); }));
}

// ================================================= drinks =================================================
/** the mug (iq500): dark body, lighter rim with coffee, orange label, handle away from the body (facing), 2 steam wisps */
function mug(o = {}) {
  const b = B(o), c = pick(o, 'color', '#34363c'), w = .078, h = .097, hiD = o.detail === 'high';
  if (o.view === 'top') {   // seen from above (top-down inserts): dark ring, coffee, handle; ORIGIN = CENTRE
    b.shadow(.008, -.008, w * .62, w * .62, { opacity: .35 }); b.box(w * .4, -.009, w * .82, .009, c, { r: .008 }); b.circ(0, 0, w / 2, c); b.ring(0, 0, w * .4, w / 2, hi(c, .18)); b.circ(0, 0, w * .4, o.drink || '#5a3420'); b.ell(-w * .1, w * .1, w * .18, w * .1, '#ffffff', { op: .12, lit: true, rot: .6 });
    if (o.steam) steam(b, 0, 0, { h: .1 });
    return b.done({ size: { w: w + .03, h: w }, centered: true, grips: { handle: [w * .7, 0], hand: [0, -w * .45] } });
  }
  b.ring(w / 2 + .006, h * .52, .016, .026, face(c, -.05), { arc: [-Math.PI / 2, Math.PI / 2] });      // handle (right; facing -1: left)
  b.box(-w / 2, 0, w / 2, h, c, { r: [0, 0, .008, .008] });
  b.box(-w / 2, 0, -w / 2 + w * .26, h, face(c, .12), { r: [0, 0, 0, .008] });                          // shaded side
  if (hiD) b.box(w / 2 - w * .16, h * .1, w / 2 - w * .09, h * .85, hi(c, .12));
  b.ell(0, h, w / 2, w * .13, hi(c, .3)); b.ell(0, h - .001, w / 2 - .006, w * .1, o.drink || '#141110');
  if (o.label !== false) {
    if (typeof o.label === 'string') { b.box(-w * .42, h * .3, w * .42, h * .56, face(c, .35), { r: h * .06 }); b.text(o.label, 0, h * .43, { size: h * .18, color: o.labelColor || '#e9b04a', weight: 800 }); }
    else { b.box(-w * .32, h * .36, w * .32, h * .5, o.labelColor || '#e9b04a', { r: .004 }); }
  }
  if (o.steam !== false && o.steam !== undefined || o.hot) steam(b, 0, h, { h: .12 });
  return b.done({ size: { w: w + .03, h }, grips: { hand: [-w * .05, h * .45], handle: [w / 2 + .022, h * .52], two: [-w * .4, h * .4] }, points: { rim: [0, h], drink: [0, h] } });
}
/** a takeaway coffee cup with a lid and a sleeve (brand: an invented name or none) */
function cup(o = {}) {
  const b = B(o), c = pick(o, 'color', '#efe8da'), sl = o.sleeve || '#9a6b44', h = .12;
  b.poly([[-.03, 0], [.03, 0], [.04, h], [-.04, h]], c); b.poly([[-.03, 0], [-.015, 0], [-.022, h], [-.04, h]], face(c, .08));
  b.poly([[-.035, h * .3], [.035, h * .3], [.038, h * .65], [-.038, h * .65]], sl);
  if (o.brand) b.text(o.brand, 0, h * .47, { size: .016, color: '#f3ead9', weight: 800 });
  b.box(-.044, h, .044, h + .012, o.lid || '#f6f4ee', { r: .004 }); b.box(-.034, h + .01, .034, h + .022, face(o.lid || '#f6f4ee', .06), { r: .004 });
  if (o.steam) steam(b, 0, h + .02, { h: .1 });
  return b.done({ size: { w: .088, h: h + .022 }, grips: { hand: [0, h * .45] }, points: { rim: [0, h + .02] } });
}
/** a glass: water (default) | juice | wine | flute (champagne) | whisky; fill 0..1 */
function glass(o = {}) {
  const v = o.variant || 'water', b = B(o), gl = '#cfe1ea', fill = o.fill ?? (v === 'water' ? .7 : .6);
  const liq = o.drink || { water: '#a9cbe0', juice: '#f0a13a', wine: '#7a1f2c', flute: '#f1d27a', whisky: '#c27a2a' }[v];
  if (v === 'wine' || v === 'flute') {
    const fl = v === 'flute', bw = fl ? .024 : .04, bh = fl ? .12 : .08, st = fl ? .09 : .08;
    b.ell(0, .004, .03, .006, gl, { op: .8 }); b.line(0, .004, 0, st, .005, gl, { op: .8 });
    const bowl = [[0, st], ...arcPts(0, st + bh * .5, bw, bh * .5, -Math.PI / 2, 0, 6), [bw, st + bh], [-bw, st + bh], ...arcPts(0, st + bh * .5, bw, bh * .5, Math.PI, Math.PI * 1.5, 6)];
    b.poly(bowl, gl, { op: .45 });
    const ly = st + bh * fill, cy = st + bh * .5;
    b.ell(0, cy, bw * .9, bh * .46, liq, { arc: [Math.PI, Math.PI * 2], op: .85 });
    if (ly > cy) b.box(-bw * .9, cy - .0005, bw * .9, ly, liq, { op: .85 });
    b.line(-bw * .55, st + bh * .35, -bw * .5, st + bh * .85, .004, '#ffffff', { op: .6, lit: true });
    if (fl) b.dots([[.004, st + bh * .4, .0018], [-.006, st + bh * .55, .0015], [.008, st + bh * .7, .0012]], '#fff8d8', { op: .8 });
    return b.done({ size: { w: bw * 2, h: st + bh }, grips: { hand: [0, st * .55] }, points: { rim: [0, st + bh] } });
  }
  const W = v === 'whisky' ? .075 : .065, H = v === 'whisky' ? .07 : .11;
  b.poly([[-W * .42, 0], [W * .42, 0], [W / 2, H], [-W / 2, H]], gl, { op: .42 });
  b.poly([[-W * .4, .006], [W * .4, .006], [W * .42 + W * .08 * fill, H * fill], [-W * .42 - W * .08 * fill, H * fill]], liq, { op: .8 });
  if (v === 'whisky') b.box(-.014, H * .4, .014, H * .62, '#e8f4f8', { op: .7, r: .004 });
  b.box(-W * .42, 0, W * .42, .006, hi(gl, .1), { op: .8 }); b.ell(0, H, W / 2, .006, hi(gl, .2), { op: .6 });
  b.line(-W * .32, H * .15, -W * .36, H * .85, .004, '#ffffff', { op: .55, lit: true });
  return b.done({ size: { w: W, h: H }, grips: { hand: [0, H * .45] }, points: { rim: [0, H] } });
}
/** a bottle: water | wine | soda | beer | milk | sauce; label text optional */
function bottle(o = {}) {
  const v = o.variant || 'water', b = B(o);
  const S = { water: ['#b9d8ea', .26, .035, '#3d7bf0', .55], wine: ['#2e4a2e', .3, .038, '#efe6d0', 1], soda: ['#7a2a24', .24, .032, '#d8392f', 1], beer: ['#6a4a1c', .23, .03, '#e9d8a6', 1], milk: ['#f2f1ec', .22, .042, '#3d7bf0', 1], sauce: ['#a8281f', .19, .03, '#f2f1ec', 1] }[v] || ['#b9d8ea', .26, .035, '#3d7bf0', .55];
  const [c, H, r, lab, op] = [pick(o, 'color', S[0]), S[1], S[2], o.labelColor || S[3], S[4]];
  const neck = v === 'milk' ? .03 : v === 'wine' ? .09 : .07, shoulder = H - neck;
  b.poly([[-r, 0], [r, 0], [r, shoulder - r * .9], [r * .38, shoulder + .01], [r * .38, H - .012], [-r * .38, H - .012], [-r * .38, shoulder + .01], [-r, shoulder - r * .9]], c, { op });
  b.box(-r, 0, -r * .45, shoulder - r * .9, face(c, .1), { op });
  b.box(-r, shoulder * .3, r, shoulder * .68, lab);
  if (o.label) b.text(o.label, 0, shoulder * .49, { size: shoulder * .1, color: o.labelText || (v === 'wine' ? '#3b2a1a' : '#ffffff'), weight: 800 });
  b.box(-r * .45, H - .016, r * .45, H, o.cap || (v === 'wine' ? '#5a1c22' : v === 'water' ? '#3d7bf0' : '#d6d0c4'), { r: .003 });
  b.line(r * .55, shoulder * .1, r * .55, shoulder * .25, .004, '#ffffff', { op: .5, lit: true });
  return b.done({ size: { w: r * 2, h: H }, grips: { hand: [0, shoulder * .45], neck: [0, H - neck * .5] }, points: { mouth: [0, H] } });
}
/** a small jar (iq500 hand-off): glass body, lid, label */
function jar(o = {}) {
  const b = B(o), c = pick(o, 'color', '#b04a3a'), w = .06, h = .07;
  b.box(-w / 2, 0, w / 2, h, c, { r: .008 }); b.box(-w / 2, 0, -w / 2 + .012, h, face(c, .12), { r: [0, 0, 0, .008] });
  b.box(-w / 2 + .004, h * .3, w / 2 - .004, h * .65, o.labelColor || '#efe6d0');
  b.box(-w / 2 - .002, h, w / 2 + .002, h + .016, o.lid || '#c9a24a', { r: .003 });
  return b.done({ size: { w: w + .004, h: h + .016 }, grips: { hand: [0, h * .4] } });
}

// ================================================= tableware + food =================================================
/** a plate (front: a flat ellipse seen from slightly above; view 'top' = round, for top-down inserts) with optional food */
function plate(o = {}) {
  const b = B(o), c = pick(o, 'color', '#ecebe6'), R = o.r ?? .125, top = o.view === 'top';
  if (top) { b.shadow(.006, -.004, R * 1.06, R * 1.06, { opacity: .3 }); b.circ(0, 0, R, c); b.circ(0, 0, R * .7, face(c, .06)); b.ring(0, 0, R * .7, R * .72, face(c, .12)); if (o.food) foodOn(b, o.food, 0, 0, R, true, o);
    return b.done({ size: { w: R * 2, h: R * 2 }, centered: true, grips: { hand: [R * .9, 0] }, points: { food: [0, 0] } }); }
  const ry = R * .24;
  b.box(-R * .75, 0, R * .75, .012, face(c, .18), { r: [0, 0, .006, .006] });
  b.ell(0, .012, R, ry, c, { segs: 40 }); b.ell(0, .012, R * .68, ry * .62, face(c, .07), { segs: 40 });
  if (o.food) foodOn(b, o.food, 0, .012, R, false, o);
  return b.done({ size: { w: R * 2, h: .012 + ry }, grips: { hand: [R * .9, .01], left: [-R * .9, .01], right: [R * .9, .01] }, top: { y: .014, x0: -R * .6, x1: R * .6, z: b.depth(), front: .01, back: .02 }, points: { food: [0, .012] } });
}
function foodOn(b, food, x, y, R, top, o) {
  const f = typeof food === 'string' ? food : food.kind;
  if (f === 'toast') { if (top) { b.box(x - R * .4, y - R * .35, x + R * .4, y + R * .4, '#b8803e', { r: R * .15 }); b.box(x - R * .32, y - R * .28, x + R * .32, y + R * .3, '#e8c27a', { r: R * .1 }); } else { b.box(x - R * .45, y, x + R * .2, y + R * .1, '#b8803e', { r: .006 }); b.box(x - R * .38, y + R * .03, x + R * .13, y + R * .08, '#e2b46c'); b.box(x - R * .1, y + R * .06, x + R * .55, y + R * .16, '#b8803e', { r: .006, rot: .1 }); } return; }
  if (f === 'eggs') { const pts = top ? [[x - R * .3, y], [x + R * .3, y + R * .05]] : [[x - R * .3, y + .006], [x + R * .3, y + .006]]; for (const [px, py] of pts) { b.ell(px, py, R * .28, top ? R * .24 : R * .07, '#f7f5ee'); b.ell(px, py + (top ? 0 : .004), R * .1, top ? R * .1 : R * .035, '#f2b12e'); } return; }
  if (f === 'cake') { if (top) { b.circ(x, y, R * .55, '#f3ece4'); b.dots([[x + R * .3, y, R * .05], [x - R * .2, y + R * .25, R * .05], [x - R * .15, y - R * .28, R * .05], [x + R * .1, y + R * .35, R * .05]], '#d23a3a'); } else { b.poly([[x - R * .4, y], [x + R * .45, y], [x + R * .45, y + R * .4], [x - R * .4, y + R * .2]], '#e9c48e'); b.box(x - R * .4, y + R * .12, x + R * .45, y + R * .16, '#d76a8a'); b.poly([[x - R * .4, y + R * .2], [x + R * .45, y + R * .4], [x + R * .45, y + R * .46], [x - R * .4, y + R * .26]], '#f6efe6'); b.circ(x + R * .3, y + R * .47, R * .05, '#d23a3a'); } return; }
  if (f === 'steak') { b.ell(x, y + (top ? 0 : R * .05), R * .5, top ? R * .35 : R * .09, '#7a3a22'); b.lines(top ? [[x - R * .3, y - R * .1, x + R * .3, y - R * .1], [x - R * .3, y + R * .1, x + R * .3, y + R * .1]] : [[x - R * .3, y + R * .06, x + R * .3, y + R * .06]], .004, '#4a2212'); b.ell(x + R * .45, y + (top ? R * .2 : R * .06), R * .14, top ? R * .1 : R * .04, '#5f9e4a'); return; }
  if (f === 'pasta') { b.ell(x, y + (top ? 0 : R * .06), R * .5, top ? R * .45 : R * .12, '#e8c46a'); b.ell(x, y + (top ? 0 : R * .12), R * .22, top ? R * .2 : R * .06, '#c2412e'); return; }
  if (f === 'salad') { const R2 = rnd(4); for (let i = 0; i < 9; i++) b.circ(x + (R2() - .5) * R * .8, y + (top ? (R2() - .5) * R * .8 : R * (.05 + R2() * .12)), R * (.12 + R2() * .08), ['#5f9e4a', '#7fb85a', '#d2453a', '#f0c24a'][i % 4]); return; }
  if (f === 'cookies') { for (const dx of [-.4, 0, .4]) { b.circ(x + dx * R, y + (top ? 0 : R * .1), R * .26, '#c8914e'); b.dots([[x + dx * R - R * .08, y + (top ? R * .05 : R * .13), R * .035], [x + dx * R + R * .07, y + (top ? -R * .06 : R * .08), R * .035]], '#4a2a18'); } return; }
  if (f === 'pizza') { b.poly(top ? [[x - R * .1, y - R * .5], [x + R * .5, y + R * .4], [x - R * .55, y + R * .3]] : [[x - R * .5, y], [x + R * .5, y], [x, y + R * .16]], '#f0c24a'); if (top) b.dots([[x - R * .05, y + R * .05, R * .07], [x - R * .2, y + R * .25, R * .07], [x + R * .2, y + R * .25, R * .07]], '#b83a2a'); return; }
}
/** a bowl (front view) with contents: soup | cereal | salad | rice | empty */
function bowl(o = {}) {
  const b = B(o), c = pick(o, 'color', '#e9e5dc'), R = o.r ?? .08, H = R * .7, f = o.food ?? 'soup';
  b.box(-R * .45, 0, R * .45, .008, face(c, .2));
  b.poly([[-R, H], ...arcPts(0, H, R, H - .008, Math.PI, Math.PI * 2, 14), [R, H]], c); b.poly([[-R, H], ...arcPts(0, H, R, H - .008, Math.PI, Math.PI * 1.35, 6), [-R * .45, H]], face(c, .1));
  b.ell(0, H, R, R * .22, hi(c, .2)); b.ell(0, H, R * .9, R * .17, f === 'soup' ? '#d9822b' : f === 'cereal' ? '#efe6cf' : f === 'rice' ? '#f4f1e8' : f === 'salad' ? '#5f9e4a' : face(c, .15));
  if (f === 'cereal') b.dots([[-.02, H + .004, .007], [.015, H + .006, .006], [.03, H, .006], [-.04, H - .002, .006]], '#d9a24a');
  if (o.steam) steam(b, 0, H + .01, { h: .1 });
  return b.done({ size: { w: R * 2, h: H + R * .2 }, grips: { hand: [R * .8, H * .5], left: [-R * .85, H * .5], right: [R * .85, H * .5] }, points: { rim: [0, H] } });
}
/** food: toast | sandwich | pizza (slice) | apple | banana | cake (whole: candles n, view 'top') | cakeSlice | donut | burger | croissant | cookie | egg */
function food(o = {}) {
  const k = o.kind || o.variant || 'apple', b = B(o);
  if (k === 'apple') { b.circ(0, .04, .04, pick(o, 'color', '#c8342c')); b.circ(-.018, .052, .012, hi(pick(o, 'color', '#c8342c'), .3)); b.line(0, .075, .004, .092, .005, '#5a3a22'); b.ell(.015, .088, .012, .006, '#5f9e4a', { rot: .4 });
    return b.done({ size: { w: .08, h: .09 }, grips: { hand: [0, .035] } }); }
  if (k === 'banana') { b.path(arcPts(0, .12, .1, .1, -Math.PI * .8, -Math.PI * .25, 10), .03, '#f2cf4a'); b.line(-.08, .055, -.088, .05, .012, '#5a3a22'); return b.done({ size: { w: .18, h: .06 }, grips: { hand: [-.06, .04] } }); }
  if (k === 'toast') { b.box(-.055, 0, .055, .1, '#b8803e', { r: [.03, .03, .006, .006] }); b.box(-.045, .008, .045, .088, '#e8c27a', { r: [.024, .024, .004, .004] }); if (o.butter) b.box(-.015, .04, .02, .06, '#f6e39a', { r: .004 });
    return b.done({ size: { w: .11, h: .1 }, grips: { hand: [-.04, .03] } }); }
  if (k === 'sandwich') { b.poly([[-.07, 0], [.07, 0], [-.07, .1]], '#e8c27a'); b.poly([[-.07, .012], [.058, .012], [-.07, .08]], '#5f9e4a'); b.poly([[-.07, .02], [.045, .02], [-.07, .07]], '#d2453a'); b.poly([[-.07, .028], [.035, .028], [-.07, .062]], '#f0c24a'); b.path([[-.07, 0], [.07, 0], [-.07, .1]], .006, '#b8803e', { closed: true });
    return b.done({ size: { w: .14, h: .1 }, grips: { hand: [-.05, .03] } }); }
  if (k === 'pizza') { b.poly([[-.04, 0], [.04, 0], [0, .19]], '#f0c24a'); b.box(-.045, 0, .045, .018, '#c8914e', { r: .008 }); b.dots([[0, .06, .011], [-.012, .1, .009], [.006, .135, .007]], '#b83a2a');
    return b.done({ size: { w: .09, h: .19 }, grips: { hand: [0, .01] }, points: { tip: [0, .19] } }); }
  if (k === 'donut') { b.ring(0, .045, .015, .045, '#d9a05a'); b.ring(0, .047, .016, .042, '#e783a8', { arc: [-.2, Math.PI + .2] }); b.dots([[-.02, .07, .003], [.015, .075, .003], [.03, .055, .003], [-.032, .05, .003]], '#f6f4ee'); return b.done({ size: { w: .09, h: .09 }, grips: { hand: [.04, .03] } }); }
  if (k === 'burger') { b.ell(0, .085, .06, .03, '#c8853e', { arc: [0, Math.PI] }); b.box(-.06, .06, .06, .085, '#c8853e', { r: .006 }); b.box(-.064, .055, .064, .062, '#5f9e4a'); b.box(-.06, .036, .06, .056, '#5a2e1c', { r: .006 }); b.box(-.062, .032, .062, .04, '#f0c24a'); b.box(-.058, 0, .058, .032, '#c8853e', { r: .01 });
    return b.done({ size: { w: .13, h: .115 }, grips: { left: [-.06, .04], right: [.06, .04] } }); }
  if (k === 'croissant') { b.path(arcPts(0, 0, .07, .05, Math.PI * .05, Math.PI * .95, 10), .04, '#d9a05a'); b.lines([[-.03, .02, -.022, .05], [0, .03, 0, .06], [.03, .02, .022, .05]], .004, '#b8803e'); return b.done({ size: { w: .15, h: .07 }, grips: { hand: [-.05, .02] } }); }
  if (k === 'cookie') { b.circ(0, .035, .035, '#c8914e'); b.dots([[-.01, .045, .005], [.012, .03, .005], [-.005, .02, .004], [.015, .05, .004]], '#4a2a18'); return b.done({ size: { w: .07, h: .07 }, grips: { hand: [0, .02] } }); }
  if (k === 'egg') { b.ell(0, .028, .021, .028, '#f4efe4'); b.ell(-.007, .036, .006, .008, '#ffffff'); return b.done({ size: { w: .042, h: .056 }, grips: { hand: [0, .02] } }); }
  if (k === 'cakeSlice') { b.poly([[-.06, 0], [.06, 0], [.06, .06], [-.06, .03]], '#e9c48e'); b.box(-.06, .012, .06, .018, '#d76a8a'); b.poly([[-.06, .03], [.06, .06], [.06, .072], [-.06, .042]], '#f6efe6'); b.circ(.045, .078, .01, '#d23a3a');
    return b.done({ size: { w: .12, h: .088 }, grips: { hand: [0, .02] } }); }
  // whole cake on a stand / plate; candles: n; view 'top' = round from above (iq500 f8120)
  const R = o.r ?? .12, c = pick(o, 'color', '#f3ece4'), n = o.candles ?? 0;
  if (o.view === 'top') { b.circ(0, 0, R * 1.25, '#e8e6e0'); b.circ(0, 0, R, c); b.ring(0, 0, R * .82, R * .86, face(c, .06));
    const R2 = rnd(o.seed ?? 3); const ds = []; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + R2() * .3; ds.push([Math.cos(a) * R * .62, Math.sin(a) * R * .62, R * .065]); } b.dots(ds, '#d23a3a');
    for (let i = 0; i < n; i++) { const a = i / Math.max(1, n) * Math.PI * 2, rr = n > 1 ? R * .25 : 0; b.circ(Math.cos(a) * rr, Math.sin(a) * rr, R * .045, '#7ab8e0'); if (o.lit) { b.circ(Math.cos(a) * rr, Math.sin(a) * rr, R * .03, '#ffd66b', { lit: true }); b.glow(Math.cos(a) * rr, Math.sin(a) * rr, R * 2.5, '#ffb070', { opacity: .4 }); } }
    return b.done({ size: { w: R * 2.5, h: R * 2.5 }, centered: true, grips: { left: [-R * 1.2, 0], right: [R * 1.2, 0] } });
  }
  const H = R * .7;
  b.box(-R * 1.15, 0, R * 1.15, .012, '#d9d7d0', { r: .004 }); b.ell(0, .012, R * 1.15, R * .2, '#ecebe6');
  b.box(-R, .012, R, .012 + H, c); b.box(-R, .012, -R * .6, .012 + H, face(c, .07));
  b.box(-R, .012 + H * .45, R, .012 + H * .52, o.fill || '#d76a8a');
  const drip = [[-R, .012 + H], [R, .012 + H]]; for (let x = R - R * .1; x > -R; x -= R * .2) drip.push(...arcPts(x, .012 + H * .82, R * .1, H * .12, 0, -Math.PI, 4)); b.poly(drip, o.icing || '#fbf6ee');
  b.ell(0, .012 + H, R, R * .24, o.icing || '#fbf6ee');
  b.dots([[-R * .6, .012 + H + R * .05, R * .07], [0, .012 + H + R * .12, R * .07], [R * .6, .012 + H + R * .05, R * .07]], '#d23a3a');
  for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * R * .3, y0 = .012 + H + R * .08; b.box(x - .004, y0, x + .004, y0 + .05, ['#7ab8e0', '#e783a8', '#f0c24a'][i % 3]);
    if (o.lit !== false) { b.ell(x, y0 + .062, .006, .012, '#ffd66b', { lit: true }); b.glow(x, y0 + .06, o.glowR ?? .32, '#ffb070', { opacity: .22 }); } }
  return b.done({ size: { w: R * 2.3, h: .012 + H + (n ? .08 : .03) }, grips: { left: [-R * 1.1, .006], right: [R * 1.1, .006] }, points: { candles: [0, .012 + H + .1] }, light: n && o.lit !== false ? { x: 0, y: .012 + H + .1, color: '#ffb070' } : null });
}

// ================================================= paper things =================================================
/** a book: closed (cover to the camera; title), open (two pages), spine (on a shelf); color */
function book(o = {}) {
  const b = B(o), c = pick(o, 'color', '#3c5885'), v = o.open ? 'open' : o.view || 'closed', W = o.w ?? .16, H = o.h ?? .23;
  if (v === 'spine') { b.box(-.018, 0, .018, H, c); b.box(-.018, H * .7, .018, H * .78, hi(c, .45)); b.box(-.018, H * .15, .018, H * .18, face(c, .25)); return b.done({ size: { w: .036, h: H }, grips: { hand: [0, H * .5] } }); }
  if (v === 'open') {
    b.poly([[-W - .008, 0], [W + .008, 0], [W + .008, H], [0, H - .01], [-W - .008, H]], face(c, .1));
    b.poly([[-W, .008], [-.004, .002], [-.004, H - .012], [-W, H - .004]], o.page || '#f4ecdc'); b.poly([[.004, .002], [W, .008], [W, H - .004], [.004, H - .012]], o.page || '#f4ecdc');
    b.box(-.012, .002, .012, H - .012, face(o.page || '#f4ecdc', .1));
    const ls = []; for (let i = 0; i < 9; i++) { const y = H * (.18 + i * .08); ls.push([-W + .02, y, -.02, y], [.02, y, W - .02 - (i === 8 ? W * .4 : 0), y]); } b.lines(ls, .004, '#b9b2a2');
    if (o.picture) { b.box(.025, H * .55, W - .025, H * .9, '#9fb8d0'); b.circ(W * .55, H * .78, .015, '#f0c24a'); }
    return b.done({ size: { w: W * 2 + .016, h: H }, grips: { left: [-W * .85, H * .2], right: [W * .85, H * .2], hand: [W * .85, H * .2] } });
  }
  b.box(-W / 2 + .006, -.004, W / 2 + .006, H - .004, o.page || '#efe6d2');
  b.box(-W / 2, 0, W / 2, H, c); b.box(-W / 2, 0, -W / 2 + W * .1, H, face(c, .18));
  b.box(-W / 2 + W * .22, H * .62, W / 2 - W * .12, H * .8, o.labelColor || hi(c, .55));
  if (o.title) b.text(o.title, W * .05, H * .71, { size: Math.min(H * .07, W * .6 / Math.max(3, o.title.length) * 1.6), color: o.titleColor || face(c, .3), weight: 800 });
  return b.done({ size: { w: W + .006, h: H }, grips: { hand: [W * .35, H * .3], left: [-W * .42, H * .15], right: [W * .42, H * .15] } });
}
/** a notebook: spiral (rings on top) | school (stitched); open: lined pages; color */
function notebook(o = {}) {
  const b = B(o), c = pick(o, 'color', '#c65c46'), W = .15, H = .21;
  if (o.open) { b.box(-W, 0, W, H, '#f6f2e6'); b.box(-.006, 0, .006, H, face('#f6f2e6', .1)); const ls = []; for (let i = 0; i < 11; i++) { const y = H * (.1 + i * .075); ls.push([-W + .015, y, -.015, y], [.015, y, W - .015, y]); } b.lines(ls, .003, '#9fb8d0'); b.line(-W + .03, 0, -W + .03, H, .003, '#e08a8a');
    if (o.text) b.text(o.text, -W / 2, H * .7, { size: .016, font: 'Kalam', weight: 700, color: '#2a3a6a' });
    return b.done({ size: { w: W * 2, h: H }, grips: { left: [-W * .85, H * .2], right: [W * .85, H * .2] } }); }
  b.box(-W / 2, 0, W / 2, H, c, { r: .006 }); b.box(-W / 2 + .02, H * .55, W / 2 - .02, H * .7, '#f6f2e6', { r: .003 });
  if (o.title) b.text(o.title, 0, H * .625, { size: .018, font: 'Kalam', weight: 700, color: '#2a2a32' });
  if ((o.variant || 'spiral') === 'spiral') { const ds = []; for (let i = 0; i < 9; i++) ds.push([-W / 2 + .015 + i * (W - .03) / 8, H - .004, .0045]); b.dots(ds, '#c9ccd2'); }
  return b.done({ size: { w: W, h: H }, grips: { hand: [W * .4, H * .3], left: [-W * .42, H * .15], right: [W * .42, H * .15] } });
}
/** a sheet of paper (A4): title, text (handwritten note, Kalam), lines (grey writing lines), check (green tick), signature, pin (red pin + wall shadow), color */
function paper(o = {}) {
  const b = B(o), c = pick(o, 'color', '#f4f1ea'), W = o.w ?? .21, H = o.h ?? .297, hand = o.font === 'hand' || (o.text && o.font !== 'print');
  if (o.pin || o.wall) b.box(-W / 2 + .022, -.03, W / 2 + .022, H - .03, '#000000', { op: .17 });
  b.box(-W / 2, 0, W / 2, H, c); if (o.detail === 'high') b.box(-W / 2, 0, W / 2, .004, face(c, .1));
  let y = H - .035;
  if (o.title) { b.text(o.title, 0, y - .008, { size: Math.min(.03, W * 1.1 / Math.max(4, String(o.title).length)), color: o.titleColor || '#1d2330', weight: 800, font: hand ? 'Kalam' : 'Open Sans' }); y -= .045; }
  if (o.text) { b.text(o.text, 0, y - .03, { size: o.textSize ?? .019, color: o.ink || '#2a3a6a', font: hand ? 'Kalam' : 'Open Sans', weight: hand ? 700 : 600, lineHeight: 1.5 }); y -= .07 * String(o.text).split('\n').length; }
  const n = o.lines ?? (o.text || o.title ? 3 : 6), ls = [];
  for (let i = 0; i < n && y > .03; i++, y -= .03) ls.push([-W / 2 + .025, y, W / 2 - .025 - (i % 3 === 2 ? W * .3 : (i * 7 % 3) * .015), y]);
  b.lines(ls, .0045, o.lineColor || '#b9bcc2');
  if (o.check) { b.path([[W * .12, .055], [W * .2, .035], [W * .36, .085]], .012, '#35b86b', { cap: 'round' }); }
  if (o.signature) b.path([[-W * .3, .04], [-W * .22, .06], [-W * .16, .035], [-W * .08, .058], [0, .04], [.02, .05]], .004, '#2a3a6a');
  if (o.stamp) { b.box(W * .02, .03, W * .44, .075, o.stampColor || '#d8392f', { op: .85 }); b.text(o.stamp, W * .23, .0525, { size: .02, color: '#ffffff', weight: 800 }); }
  if (o.pin) { b.circ(0, H - .015, .009, o.pinColor || '#d8392f'); b.circ(-.003, H - .012, .003, '#f6b0a8'); }
  return b.done({ size: { w: W, h: H }, grips: { left: [-W * .42, H * .08], right: [W * .42, H * .08], hand: [W * .4, H * .1] } });
}
/** a sticky note (yellow square) with a handwritten line */
function stickyNote(o = {}) { const b = B(o), c = pick(o, 'color', '#f6df6a'), s = .076; b.box(-s / 2 + .003, -.003, s / 2 + .003, s - .003, '#000', { op: .15 }); b.box(-s / 2, 0, s / 2, s, c); b.box(-s / 2, s * .8, s / 2, s, face(c, .06)); if (o.text) b.text(o.text, 0, s * .45, { size: .012, font: 'Kalam', weight: 700, color: '#2a2a32' }); return b.done({ size: { w: s, h: s }, grips: { hand: [s * .4, s * .1] } }); }
/** an envelope: front (address lines, stamp) | back (flap); heart: a red seal */
function envelope(o = {}) {
  const b = B(o), c = pick(o, 'color', '#efe6d2'), W = .22, H = .11;
  b.box(-W / 2, 0, W / 2, H, c);
  if (o.view === 'back' || o.heart) { b.poly([[-W / 2, H], [W / 2, H], [0, H * .38]], face(c, .07)); b.path([[-W / 2, 0], [-W * .08, H * .45]], .003, face(c, .12)); b.path([[W / 2, 0], [W * .08, H * .45]], .003, face(c, .12));
    if (o.heart) { b.circ(-.008, H * .42, .009, '#d23a3a'); b.circ(.008, H * .42, .009, '#d23a3a'); b.poly([[-.017, H * .4], [.017, H * .4], [0, H * .2]], '#d23a3a'); } }
  else { b.box(W / 2 - .04, H - .045, W / 2 - .01, H - .01, o.stamp || '#d8392f'); b.lines([[-W * .2, H * .45, W * .15, H * .45], [-W * .2, H * .33, W * .1, H * .33], [-W * .2, H * .21, W * .12, H * .21]], .004, '#7a7f8a'); }
  return b.done({ size: { w: W, h: H }, grips: { hand: [W * .4, H * .3], left: [-W * .4, H * .2], right: [W * .4, H * .2] } });
}
/** a pen / pencil / marker / crayon, upright, tip down at y = 0 (lying: true lays it on a table) */
function pen(o = {}) {
  const v = o.variant || 'pen', b = B(o), c = pick(o, 'color', { pen: '#2a4a8a', pencil: '#f2c24a', marker: '#1d1e22', crayon: '#d8392f', chalk: '#f4f1ea' }[v]);
  const L = { pen: .14, pencil: .17, marker: .13, crayon: .09, chalk: .07 }[v], r = { pen: .0055, pencil: .0055, marker: .009, crayon: .006, chalk: .005 }[v];
  if (v === 'pencil') { b.poly([[0, 0], [r, .018], [-r, .018]], '#e8c69a'); b.poly([[0, 0], [r * .35, .006], [-r * .35, .006]], '#3a3a3a'); b.box(-r, .018, r, L - .018, c); b.box(-r, .018, -r * .3, L - .018, face(c, .12)); b.box(-r, L - .018, r, L - .012, '#b8bcc2'); b.box(-r, L - .012, r, L, '#e8949a', { r: [.003, .003, 0, 0] }); }
  else if (v === 'crayon' || v === 'chalk') { b.poly([[-r * .5, 0], [r * .5, 0], [r, .01], [-r, .01]], c); b.box(-r, .01, r, L, c, { r: [.002, .002, 0, 0] }); if (v === 'crayon') b.box(-r, L * .3, r, L * .75, face(c, .2)); }
  else { b.poly([[0, 0], [r * .6, .012], [-r * .6, .012]], v === 'marker' ? (o.ink || '#2a6ad8') : '#c9ccd2'); b.box(-r, .012, r, L, c, { r: [.004, .004, .001, .001] }); b.box(-r, .012, -r * .35, L, hi(c, .15)); b.box(r * .3, L * .62, r * 1.5, L * .93, v === 'marker' ? (o.ink || '#2a6ad8') : '#c9ccd2', { r: .0015 }); if (v === 'marker') b.box(-r, L * .55, r, L, o.ink || '#2a6ad8', { r: [.004, .004, 0, 0] }); }
  return b.done({ size: { w: r * 2, h: L }, grips: { hand: [0, L * .25], pinch: [0, L * .18] }, points: { tip: [0, 0] } });
}

// ================================================= personal things =================================================
/** a key ring with 2-3 keys and a fob (hangs from the ring at the top) */
function keys(o = {}) {
  const b = B(o), c = o.color || '#c9ccd2', n = o.n ?? 3;
  b.ring(0, .075, .011, .015, face(c, .1));
  for (let i = 0; i < n; i++) { const a = -.35 + i * .35, x = Math.sin(a) * .03, rot = a;
    const k = b.sub('key' + i, .001 * i, { at: [x * .3, .062] }); k.circ(0, -.012, .011, i === 1 ? '#c9a24a' : c); k.box(-.004, -.055, .004, -.015, i === 1 ? '#c9a24a' : c); k.box(.004, -.05, .009, -.045, i === 1 ? '#c9a24a' : c); k.box(.004, -.04, .008, -.036, i === 1 ? '#c9a24a' : c); k.g.rotation.z = rot * b.fx; }
  if (o.fob !== false) { const f = b.sub('fob', .006, { at: [.012, .07] }); f.box(-.012, -.05, .012, 0, o.fobColor || '#1d1e22', { r: .008 }); f.circ(0, -.018, .005, '#d8392f'); f.g.rotation.z = -.5 * b.fx; }
  return b.done({ size: { w: .1, h: .09 }, grips: { hand: [0, .075], ring: [0, .075] } });
}
/** a wallet: folded leather with stitching and a card peeking out */
function wallet(o = {}) { const b = B(o), c = pick(o, 'color', '#6a4428'), W = .11, H = .085; if (o.card !== false) b.box(-W * .3, H * .6, W * .25, H + .015, '#3d7bf0', { r: .004 }); b.box(-W / 2, 0, W / 2, H, c, { r: .008 }); b.box(-W / 2, 0, W / 2, H * .25, face(c, .1), { r: [0, 0, .008, .008] }); b.path(rrPts(-W / 2 + .006, .006, W / 2 - .006, H - .006, .005, 2), .0015, hi(c, .3), { closed: true }); return b.done({ size: { w: W, h: H + .015 }, grips: { hand: [W * .3, H * .4] } }); }
/** a credit / ID card (invented bank) */
function card(o = {}) { const b = B(o), c = pick(o, 'color', '#1f3b73'), W = .086, H = .054; b.box(-W / 2, 0, W / 2, H, c, { r: .004 }); b.box(-W / 2 + .008, H * .42, -W / 2 + .022, H * .66, '#d9b65a', { r: .002 }); b.box(-W / 2 + .008, H * .18, W / 2 - .02, H * .24, hi(c, .4)); b.circ(W / 2 - .014, H * .78, .006, '#e0453a'); b.circ(W / 2 - .008, H * .78, .006, '#f0b43a', { op: .9 }); if (o.text) b.text(o.text, -W / 2 + .008, H * .85, { size: .007, align: 'left', color: '#ffffff' }); return b.done({ size: { w: W, h: H }, grips: { hand: [W * .35, H * .3] } }); }
/** money: banknotes (fan of n notes, invented design) | stack (bundle with a band) | coins (a few gold/silver coins) */
function money(o = {}) {
  const v = o.variant || 'notes', b = B(o), c = pick(o, 'color', '#9fbf8a'), W = .156, H = .066;
  if (v === 'coins') { const R2 = rnd(o.seed ?? 2), n = o.n ?? 3; for (let i = 0; i < n; i++) { const g = i % 2 ? '#c9ccd2' : '#d9b65a', x = (i - (n - 1) / 2) * .03 + (R2() - .5) * .01; b.circ(x, .013 + (i % 2) * .006, .012, g); b.circ(x, .013 + (i % 2) * .006, .008, face(g, .12)); b.text(['10', '5', '1'][i % 3], x, .013 + (i % 2) * .006, { size: .007, color: hi(g, .3) }); } return b.done({ size: { w: n * .03, h: .03 }, grips: { hand: [0, .01] } }); }
  if (v === 'stack') { for (let i = 0; i < 4; i++) b.box(-W / 2, i * .006, W / 2, i * .006 + .006, i % 2 ? c : face(c, .08)); b.poly([[-W / 2, .024], [W / 2, .024], [W / 2 - .01, .036], [-W / 2 + .01, .036]], hi(c, .1)); b.box(-.02, 0, .02, .036, '#efe6d2'); return b.done({ size: { w: W, h: .036 }, grips: { hand: [0, .02] } }); }
  const n = o.n ?? 3;
  for (let i = 0; i < n; i++) { const s = b.sub('note' + i, i * .002, { at: [0, 0] }); s.box(-W / 2, 0, W / 2, H, i === n - 1 ? c : face(c, .06 * (n - i))); s.box(-W / 2 + .006, .006, W / 2 - .006, H - .006, face(c, .1)); s.box(-W / 2 + .008, .008, W / 2 - .008, H - .008, i === n - 1 ? c : face(c, .06 * (n - i)));
    if (i === n - 1) { s.ell(0, H / 2, .018, .022, face(c, .15)); s.text(o.value || '100', -W / 2 + .022, H - .016, { size: .011, color: face(c, .45) }); s.text(o.value || '100', W / 2 - .022, .016, { size: .011, color: face(c, .45) }); }
    s.g.rotation.z = (i - (n - 1)) * .12 * b.fx; s.g.position.x += (i - (n - 1)) * .012 * b.fx; }
  return b.done({ size: { w: W + .03, h: H + .02 }, grips: { hand: [-W * .35, H * .3] } });
}
/** a wrist watch (hero-B's silver watch; close-ups / inserts): time 'HH:MM' | hours number, run (hands move with t), smart (a screen) */
function watch(o = {}) {
  const b = B(o), c = o.color || '#c9ccd2', strap = o.strap || '#2a2b30', R = .022;
  b.box(-.011, -.03, .011, .07, strap, { r: .006 });
  b.circ(0, .02, R, face(c, .1)); b.circ(0, .02, R * .86, c);
  if (o.smart) { b.box(-R * .7, .02 - R * .7, R * .7, .02 + R * .7, '#0b0c10', { r: .006 }); b.text(typeof o.time === 'string' ? o.time : '7:42', 0, .02, { size: .009, color: '#ffffff', lit: true }); return b.done({ size: { w: .05, h: .1 }, grips: { wrist: [0, .02] } }); }
  b.circ(0, .02, R * .74, o.face || '#f4f1ea');
  const tk = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; tk.push([Math.sin(a) * R * .6, .02 + Math.cos(a) * R * .6, Math.sin(a) * R * .68, .02 + Math.cos(a) * R * .68]); } b.lines(tk, .0012, '#2a2a32');
  clockHands(b, 0, .02, R * .65, o, '#1d1e22', '#d8392f');
  return b.done({ size: { w: .05, h: .1 }, grips: { wrist: [0, .02], hand: [0, -.02] } });
}
/** hour / minute (/ second) hands on a builder; o.time 'HH:MM' or hours; o.run = speed (1 = real time) from o.t0 */
export function clockHands(b, x, y, R, o, ink, red) {
  const hm = typeof o.time === 'string' ? o.time.split(':').map(Number) : null, h0 = hm ? hm[0] + hm[1] / 60 : o.time ?? 10.15;
  const hand = (len, w, c, z) => { const s = b.sub('hand', b.depth() + z, { at: [x, y] }); s.box(-w / 2, -len * .15, w / 2, len, c, { r: w / 2 }); return s.g; };
  const hH = hand(R * .55, R * .1, ink, .001), mH = hand(R * .82, R * .07, ink, .002), sH = o.seconds !== false ? hand(R * .9, R * .025, red, .003) : null;
  b.sub('cap', b.depth() + .004, { at: [x, y] }).circ(0, 0, R * .07, ink);
  const set = t => { const hrs = h0 + (o.run ? (t - (o.t0 ?? 0)) * o.run / 3600 : 0); hH.rotation.z = -hrs / 12 * Math.PI * 2 * b.fx; mH.rotation.z = -(hrs % 1) * Math.PI * 2 * b.fx; if (sH) sH.rotation.z = -((hrs * 3600) % 60) / 60 * Math.PI * 2 * b.fx; };
  set(o.t0 ?? 0); if (o.run) onUpdate(b.g, set);
}
/** glasses (held / on a table): round | square lenses, frame colour */
function glasses(o = {}) {
  const b = B(o), c = o.color || '#2a2b30', sq = o.variant === 'square', r = .024;
  for (const x of [-.034, .034]) { if (sq) { b.box(x - r, .01, x + r, .01 + r * 1.6, c, { r: .008 }); b.box(x - r + .004, .014, x + r - .004, .006 + r * 1.6, '#cfe1ea', { r: .006, op: .6 }); } else { b.circ(x, .03, r, c); b.circ(x, .03, r - .004, '#cfe1ea', { op: .6 }); } b.line(x - r * .4, .036, x - r * .1, .044, .002, '#ffffff', { op: .7, lit: true }); }
  b.path([[-.012, .036], [0, .041], [.012, .036]], .004, c); b.line(-.058, .036, -.07, .03, .004, c); b.line(.058, .036, .07, .03, .004, c);
  return b.done({ size: { w: .14, h: .056 }, grips: { hand: [.06, .033] } });
}
/** a bag: handbag | backpack | shopping (paper bag) | duffel | school (backpack, brighter) */
function bag(o = {}) {
  const v = o.variant || 'handbag', b = B(o);
  if (v === 'backpack' || v === 'school') { const c = pick(o, 'color', v === 'school' ? '#d8392f' : '#3a4a6a'), W = .3, H = .42;
    b.path([[-W * .3, H * .9], [-W * .3, H * 1.05], [W * .3, H * 1.05], [W * .3, H * .9]], .025, face(c, .2));
    b.box(-W / 2, 0, W / 2, H, c, { r: [.08, .08, .03, .03] }); b.box(-W / 2, 0, -W / 2 + .05, H, face(c, .12), { r: [.08, 0, 0, .03] });
    b.box(-W * .36, .04, W * .36, H * .45, face(c, .1), { r: .03 }); b.line(-W * .3, H * .38, W * .3, H * .38, .006, hi(c, .3)); b.box(W * .1, H * .34, W * .18, H * .4, '#c9ccd2', { r: .003 });
    return b.done({ size: { w: W, h: H * 1.06 }, grips: { hand: [0, H * 1.03], strap: [-W * .3, H * .8], back: [0, H * .6] } }); }
  if (v === 'shopping') { const c = pick(o, 'color', '#c69a64'), W = .3, H = .36; b.path([[-W * .22, H * .9], ...arcPts(0, H * .92, W * .22, H * .25, Math.PI, 0, 8)], .01, face(c, .3)); b.poly([[-W / 2, 0], [W / 2, 0], [W / 2 - .01, H], [-W / 2 + .01, H]], c); b.poly([[-W / 2 + .01, H], [W / 2 - .01, H], [W / 2 - .03, H - .03], [-W / 2 + .03, H - .03]], face(c, .2)); if (o.label) b.text(o.label, 0, H * .5, { size: .035, color: face(c, .5) });
    if (o.items !== false) { b.box(-W * .3, H - .01, -W * .05, H + .1, '#5f9e4a', { r: .02 }); b.box(W * .05, H - .01, W * .22, H + .06, '#e8c27a', { r: .01 }); }
    return b.done({ size: { w: W, h: H + .1 }, grips: { hand: [0, H * 1.12] } }); }
  if (v === 'duffel') { const c = pick(o, 'color', '#2a3a5a'), W = .55, H = .28; b.path(arcPts(0, H * .9, W * .2, H * .45, Math.PI, 0, 8), .018, face(c, .25)); b.box(-W / 2, 0, W / 2, H, c, { r: .11 }); b.line(-W * .4, H * .82, W * .4, H * .82, .008, face(c, .25)); b.box(-W * .45, .02, -W * .38, H - .02, hi(c, .15), { r: .02 });
    return b.done({ size: { w: W, h: H * 1.35 }, grips: { hand: [0, H * 1.33] } }); }
  const c = pick(o, 'color', '#8a3a2e'), W = .3, H = .22;
  b.path(arcPts(0, H * .85, W * .26, H * .62, Math.PI, 0, 10), .014, face(c, .2));
  b.poly([[-W / 2, 0], [W / 2, 0], [W * .42, H], [-W * .42, H]], c); b.poly([[-W * .44, H * .75], [W * .44, H * .75], [W * .42, H], [-W * .42, H]], face(c, .1)); b.box(-.015, H * .62, .015, H * .78, '#d9b65a', { r: .004 });
  return b.done({ size: { w: W, h: H * 1.47 }, grips: { hand: [0, H * 1.45] } });
}
/** a suitcase (rolling: handle up option) | briefcase (iq500: handle bar on top, clasps) */
function suitcase(o = {}) {
  const v = o.variant || 'rolling', b = B(o);
  if (v === 'briefcase') { const c = pick(o, 'color', '#5a3a24'), W = .42, H = .3;
    b.path([[-W * .14, H], [-W * .14, H + .05], [W * .14, H + .05], [W * .14, H]], .016, face(c, .2));
    b.box(-W / 2, 0, W / 2, H, c, { r: .02 }); b.box(-W / 2, H * .72, W / 2, H * .76, face(c, .2)); b.box(-W * .3, H * .66, -W * .22, H * .8, '#d9b65a', { r: .003 }); b.box(W * .22, H * .66, W * .3, H * .8, '#d9b65a', { r: .003 });
    return b.done({ size: { w: W, h: H + .06 }, grips: { hand: [0, H + .05] } }); }
  const c = pick(o, 'color', '#2f5d8a'), W = .42, H = .62, up = o.handle ? .4 : 0;
  if (up) { b.line(-W * .2, H, -W * .2, H + up, .016, '#7a7f8a'); b.line(W * .2, H, W * .2, H + up, .016, '#7a7f8a'); b.box(-W * .24, H + up - .02, W * .24, H + up + .015, '#2a2b30', { r: .01 }); }
  b.box(-W * .15, H - .01, W * .15, H + .025, '#2a2b30', { r: .01 });
  b.circ(-W * .36, .025, .025, '#1d1e22'); b.circ(W * .36, .025, .025, '#1d1e22');
  b.box(-W / 2, .03, W / 2, H, c, { r: .04 }); b.box(-W / 2, .03, -W / 2 + .05, H, face(c, .12), { r: [.04, 0, 0, .04] });
  b.lines([[-W * .2, .07, -W * .2, H - .04], [0, .07, 0, H - .04], [W * .2, .07, W * .2, H - .04]], .008, face(c, .14));
  if (o.sticker !== false) b.circ(W * .25, H * .7, .035, '#f0c24a');
  return b.done({ size: { w: W, h: H + up + .03 }, grips: { hand: up ? [0, H + up] : [0, H + .015], side: [W * .5, H * .6] } });
}
/** a box: cardboard (tape) | gift (ribbon + bow) | shoe | pizza (flat) | crate (wood); open: flaps up; w, h */
function box(o = {}) {
  const v = o.variant || 'cardboard', b = B(o);
  if (v === 'gift') { const c = pick(o, 'color', '#d8392f'), rb = o.ribbon || '#f0c24a', W = o.w ?? .26, H = o.h ?? .2;
    b.box(-W / 2, 0, W / 2, H * .82, c); b.box(-W / 2 - .01, H * .82, W / 2 + .01, H, hi(c, .08)); b.box(-W / 2, 0, -W / 2 + W * .12, H * .82, face(c, .12));
    b.box(-.015, 0, .015, H, rb); b.box(-W / 2 - .01, H * .86, W / 2 + .01, H * .93, rb);
    b.ell(-.03, H + .022, .032, .02, rb, { rot: .4 }); b.ell(.03, H + .022, .032, .02, rb, { rot: -.4 }); b.circ(0, H + .01, .012, face(rb, .15));
    return b.done({ size: { w: W + .02, h: H + .045 }, grips: { hand: [W * .45, H * .8], left: [-W * .45, H * .4], right: [W * .45, H * .4] }, top: { y: H, x0: -W / 2, x1: W / 2, z: b.depth(), front: H, back: H } }); }
  if (v === 'pizza') { const c = pick(o, 'color', '#e8dcc2'), W = o.w ?? .36; b.box(-W / 2, 0, W / 2, .045, face(c, .08)); b.poly([[-W / 2, .045], [W / 2, .045], [W / 2 - .03, .07], [-W / 2 + .03, .07]], c); b.circ(0, .025, .012, '#d8392f'); return b.done({ size: { w: W, h: .07 }, grips: { left: [-W * .45, .03], right: [W * .45, .03] }, top: { y: .06, x0: -W / 2, x1: W / 2, z: b.depth(), front: .045, back: .07 } }); }
  const c = pick(o, 'color', v === 'crate' ? '#a8835a' : v === 'shoe' ? '#e8e6e0' : '#b08250'), W = o.w ?? (v === 'shoe' ? .32 : .4), H = o.h ?? (v === 'shoe' ? .12 : .3);
  if (o.open) { b.poly([[-W / 2, H], [-W / 2 - .06, H + .14], [-W * .1, H + .1], [-W * .05, H]], face(c, .12)); b.poly([[W / 2, H], [W / 2 + .06, H + .14], [W * .1, H + .1], [W * .05, H]], face(c, .06)); b.box(-W / 2 + .02, H - .01, W / 2 - .02, H + .02, face(c, .4)); }
  b.box(-W / 2, 0, W / 2, H, c);
  if (v === 'crate') { b.lines([[-W / 2, H * .33, W / 2, H * .33], [-W / 2, H * .66, W / 2, H * .66]], .008, face(c, .25)); b.lines([[-W / 2 + .03, 0, -W / 2 + .03, H], [W / 2 - .03, 0, W / 2 - .03, H]], .02, face(c, .12)); }
  else if (v === 'shoe') { b.box(-W / 2 - .008, H * .72, W / 2 + .008, H, hi(c, .05)); b.text(o.label || 'STRIDE', 0, H * .4, { size: .025, color: '#d8392f' }); }
  else { if (!o.open) b.box(-.025, H * .55, .025, H, o.tape || '#d9c08a'); b.box(-W / 2, 0, -W / 2 + W * .1, H, face(c, .1)); if (o.label) b.text(o.label, 0, H * .35, { size: Math.min(.045, W * .12), color: face(c, .55), font: 'Kalam', weight: 700 }); else b.box(W * .15, H * .2, W * .38, H * .38, '#efe6d2'); }
  return b.done({ size: { w: W, h: H }, grips: { hand: [W * .45, H * .85], left: [-W * .45, H * .45], right: [W * .45, H * .45] }, top: { y: H, x0: -W / 2 + .02, x1: W / 2 - .02, z: b.depth(), front: H, back: H }, points: { inside: [0, H * .7] } });
}
/** an umbrella: open (canopy, scalloped edge) | closed (furled, upright); color */
function umbrella(o = {}) {
  const b = B(o), c = pick(o, 'color', '#2a3a5a');
  if (o.closed) { b.path([[0, .02], [0, -.02], [.03, -.04], [.045, -.02]], .012, '#4a3a2a'); b.line(0, .02, 0, .9, .01, '#2a2b30'); b.poly([[-.03, .2], [.03, .2], [.006, .82], [-.006, .82]], c); b.line(-.02, .5, .02, .55, .01, face(c, .2));
    return b.done({ size: { w: .08, h: .92 }, grips: { hand: [0, .9], handle: [.02, -.02] } }); }
  const R = o.r ?? .5, H = .95;
  b.line(0, 0, 0, H, .012, '#2a2b30'); b.path([[0, .05], [0, -.02], [.035, -.045], [.055, -.015]], .016, o.handle || '#4a3a2a');
  const pts = [...arcPts(0, H - .2, R, .3, 0, Math.PI, 16)], n = 6; for (let i = 0; i < n; i++) pts.push(...arcPts(-R + R * 2 * (i + .5) / n, H - .2, R / n, .05, Math.PI, Math.PI * 2, 5).slice(1));
  b.poly(pts, c); for (let i = 1; i < n; i++) b.line(-R + R * 2 * i / n, H - .22, 0, H + .1, .006, face(c, .15));
  b.line(0, H + .1, 0, H + .15, .012, '#2a2b30');
  return b.done({ size: { w: R * 2, h: H + .15 }, grips: { hand: [0, .3], handle: [.02, -.02] } });
}

// ================================================= toys, sport, music =================================================
/** a teddy bear (sitting) */
function teddy(o = {}) { const b = B(o), c = pick(o, 'color', '#a8784a'), m = hi(c, .3); b.circ(-.07, .04, .045, c); b.circ(.07, .04, .045, c); b.ell(0, .11, .085, .1, c); b.ell(0, .1, .05, .06, m); b.circ(-.09, .14, .035, c); b.circ(.09, .14, .035, c); b.circ(-.06, .3, .03, c); b.circ(.06, .3, .03, c); b.circ(0, .25, .075, c); b.ell(0, .225, .035, .025, m); b.circ(0, .235, .009, '#1d1e22'); b.dots([[-.025, .265, .007], [.025, .265, .007]], '#1d1e22'); if (o.bow !== false) { b.ell(-.025, .18, .022, .012, '#d8392f', { rot: .3 }); b.ell(.025, .18, .022, .012, '#d8392f', { rot: -.3 }); } return b.done({ size: { w: .23, h: .33 }, grips: { hand: [.09, .14], arm: [-.09, .14] } }); }
/** a toy: car (small) | blocks | robot | duck */
function toy(o = {}) {
  const v = o.variant || 'teddy'; if (v === 'teddy') return teddy(o);
  const b = B(o);
  if (v === 'car') { const c = pick(o, 'color', '#d8392f'); b.box(-.08, .02, .08, .05, c, { r: .012 }); b.poly([[-.04, .05], [.04, .05], [.025, .075], [-.03, .075]], c); b.poly([[-.03, .052], [.02, .052], [.012, .068], [-.024, .068]], '#bfe0f0'); b.circ(-.05, .02, .016, '#1d1e22'); b.circ(.05, .02, .016, '#1d1e22'); return b.done({ size: { w: .16, h: .075 }, grips: { hand: [0, .06] } }); }
  if (v === 'blocks') { const C = ['#d8392f', '#3d7bf0', '#f0c24a', '#5f9e4a']; b.box(-.08, 0, -.02, .06, C[0]); b.box(-.015, 0, .045, .06, C[1]); b.box(-.05, .06, .01, .12, C[2]); b.text('A', -.05, .03, { size: .03, color: '#ffffff' }); b.text('B', .015, .03, { size: .03, color: '#ffffff' }); return b.done({ size: { w: .13, h: .12 }, grips: { hand: [-.02, .09] } }); }
  if (v === 'robot') { const c = pick(o, 'color', '#9ea4aa'); b.box(-.03, 0, -.01, .04, face(c, .2)); b.box(.01, 0, .03, .04, face(c, .2)); b.box(-.04, .04, .04, .11, c, { r: .008 }); b.box(-.03, .115, .03, .16, c, { r: .008 }); b.dots([[-.012, .14, .006], [.012, .14, .006]], '#46c0f0', { lit: true }); b.line(0, .16, 0, .18, .004, face(c, .3)); b.circ(0, .182, .006, '#d8392f'); return b.done({ size: { w: .1, h: .19 }, grips: { hand: [0, .08] } }); }
  const c = pick(o, 'color', '#f2cf4a'); b.ell(0, .035, .05, .035, c); b.circ(.035, .075, .028, c); b.poly([[.06, .08], [.085, .074], [.06, .068]], '#f08a3a'); b.circ(.04, .082, .005, '#1d1e22'); return b.done({ size: { w: .12, h: .1 }, grips: { hand: [0, .05] } });
}
/** a ball: football (soccer) | basketball | tennis | baseball | beach; r */
function ball(o = {}) {
  const v = o.variant || 'football', b = B(o), R = o.r ?? { football: .11, basketball: .12, tennis: .034, baseball: .037, beach: .2 }[v] ?? .11;
  if (v === 'basketball') { const c = pick(o, 'color', '#d9722e'); b.circ(0, R, R, c); b.lines([[-R, R, R, R], [0, 0, 0, 2 * R]], R * .05, '#3a1e10'); b.path(arcPts(-R * 1.3, R, R * .75, R * .95, -.95, .95, 10), R * .05, '#3a1e10'); b.path(arcPts(R * 1.3, R, R * .75, R * .95, Math.PI - .95, Math.PI + .95, 10), R * .05, '#3a1e10'); }
  else if (v === 'tennis') { const c = pick(o, 'color', '#d4e04a'); b.circ(0, R, R, c); b.path(arcPts(-R * 1.1, R, R * .7, R * .8, -.9, .9, 8), R * .1, '#f6f4ee'); b.path(arcPts(R * 1.1, R, R * .7, R * .8, Math.PI - .9, Math.PI + .9, 8), R * .1, '#f6f4ee'); }
  else if (v === 'baseball') { b.circ(0, R, R, '#f4f1ea'); b.path(arcPts(-R * 1.1, R, R * .7, R * .8, -.9, .9, 8), R * .07, '#d8392f'); b.path(arcPts(R * 1.1, R, R * .7, R * .8, Math.PI - .9, Math.PI + .9, 8), R * .07, '#d8392f'); }
  else if (v === 'beach') { const C = ['#d8392f', '#f4f1ea', '#3d7bf0', '#f0c24a', '#f4f1ea', '#5f9e4a']; C.forEach((c, i) => b.ell(0, R, R, R, c, { arc: [i / 6 * Math.PI * 2, (i + 1) / 6 * Math.PI * 2] })); b.circ(0, R, R * .15, '#f4f1ea'); }
  else { b.circ(0, R, R, '#f4f1ea'); const ps = [[0, R, R * .3], [R * .62, R * 1.42, R * .2], [-R * .62, R * 1.42, R * .2], [R * .72, R * .62, R * .2], [-R * .72, R * .62, R * .2], [0, R * .1, R * .16]]; b.dots(ps, '#1d1e22', { n: 5 }); }
  b.ell(-R * .35, R * 1.4, R * .25, R * .15, '#ffffff', { op: .25, lit: true });
  return b.done({ size: { w: R * 2, h: R * 2 }, grips: { hand: [R * .9, R], left: [-R * .95, R], right: [R * .95, R] } });
}
/** an acoustic guitar (upright, neck up; lying: true for playing pose) */
function guitar(o = {}) {
  const b = B(o), c = pick(o, 'color', '#c48a4a'), dk = face(c, .3);
  b.box(-.022, .42, .022, .92, '#3a2416'); b.box(-.032, .9, .032, 1.0, '#2a1a10', { r: .01 });
  const dots = []; for (let i = 0; i < 3; i++) dots.push([-.03, .93 + i * .025, .006], [.03, .93 + i * .025, .006]); b.dots(dots, '#c9ccd2');
  b.circ(0, .15, .17, c); b.circ(0, .36, .125, c); b.ell(0, .25, .12, .1, c); b.ring(0, .3, .045, .058, dk); b.circ(0, .3, .045, '#1d140e');
  b.box(-.055, .1, .055, .125, dk, { r: .006 }); b.lines([[-.009, .11, -.009, .92], [-.003, .11, -.003, .92], [.003, .11, .003, .92], [.009, .11, .009, .92]], .0015, '#e8e2d2', { lit: true });
  return b.done({ size: { w: .34, h: 1.0 }, grips: { neck: [0, .75], hand: [0, .75], body: [.08, .2], strum: [.05, .3] } });
}
/** sports: trophy | medal | stopwatch (run) | whistle | racket | bat */
function trophy(o = {}) { const b = B(o), c = pick(o, 'color', '#d9b65a'); b.box(-.08, 0, .08, .06, '#3a2a1e'); b.box(-.06, .06, .06, .075, face(c, .2)); b.box(-.015, .075, .015, .14, c); b.ell(0, .145, .04, .012, face(c, .15)); b.poly([[-.085, .3], [.085, .3], [.05, .17], [0, .145], [-.05, .17]], c); b.ell(0, .3, .085, .02, hi(c, .2)); b.ring(-.09, .25, .025, .035, c, { arc: [Math.PI / 2, Math.PI * 1.5] }); b.ring(.09, .25, .025, .035, c, { arc: [-Math.PI / 2, Math.PI / 2] }); b.box(-.03, .015, .03, .045, '#d9b65a'); b.line(-.04, .2, -.03, .27, .008, '#ffffff', { op: .5, lit: true });
  return b.done({ size: { w: .24, h: .32 }, grips: { hand: [0, .11], left: [-.09, .25], right: [.09, .25] } }); }
function medal(o = {}) { const b = B(o), c = pick(o, 'color', '#d9b65a'), rb = o.ribbon || '#3d7bf0'; b.poly([[-.05, .3], [-.02, .3], [.01, .07], [-.02, .07]], rb); b.poly([[.05, .3], [.02, .3], [-.01, .07], [.02, .07]], face(rb, .15)); b.circ(0, .045, .045, c); b.circ(0, .045, .034, face(c, .1)); b.text(o.text || '1', 0, .045, { size: .03, color: hi(c, .3) }); return b.done({ size: { w: .1, h: .3 }, grips: { hand: [0, .27], neck: [0, .3] } }); }
function stopwatch(o = {}) { const b = B(o), c = o.color || '#c9ccd2', R = .03; b.box(-.008, 2 * R, .008, 2 * R + .012, face(c, .2)); b.box(-.012, 2 * R + .01, .012, 2 * R + .018, c); b.circ(0, R, R, face(c, .15)); b.circ(0, R, R * .82, '#f4f1ea'); clockHands(b, 0, R, R * .75, { time: 0, seconds: true, run: o.run ? (o.speed ?? 60) : 0, t0: o.t0 }, '#1d1e22', '#d8392f'); return b.done({ size: { w: R * 2, h: 2 * R + .02 }, grips: { hand: [0, R * .5] } }); }
function whistle(o = {}) { const b = B(o), c = pick(o, 'color', '#c9ccd2'); b.path([[0, .02], [0, .16]], .004, o.cord || '#d8392f'); b.circ(.01, .015, .015, c); b.box(-.025, .012, .012, .03, c, { r: .004 }); b.circ(.01, .015, .005, face(c, .3)); return b.done({ size: { w: .05, h: .16 }, grips: { hand: [0, .02], mouth: [-.025, .02] } }); }
function racket(o = {}) { const b = B(o), c = pick(o, 'color', '#3d7bf0'); b.box(-.012, 0, .012, .2, '#2a2b30', { r: .006 }); b.ring(0, .38, .1, .112, c); b.ell(0, .38, .1, .1, '#e8e6e0', { op: .25 }); const ls = []; for (let i = -4; i <= 4; i++) ls.push([i * .02, .3, i * .02, .46], [-.09, .38 + i * .018, .09, .38 + i * .018]); b.lines(ls, .002, '#e8e6e0'); b.line(-.03, .2, 0, .27, .012, c); b.line(.03, .2, 0, .27, .012, c); return b.done({ size: { w: .23, h: .5 }, grips: { hand: [0, .08] } }); }

// ================================================= tools =================================================
function flashlight(o = {}) {
  const b = B(o), c = o.color || '#2a2b30', on = o.lit ?? o.on ?? true;
  if (on && o.beam !== false) { const s = b.sub('beam', -.01, { at: [0, .2] }); s.poly([[-.03, 0], [.03, 0], [o.beamW ?? .6, o.beamL ?? 1.8], [-(o.beamW ?? .6), o.beamL ?? 1.8]], '#fff4d2', { op: .16, lit: true, add: true, order: 6 }); }
  b.box(-.016, 0, .016, .15, c, { r: .006 }); b.poly([[-.016, .15], [.016, .15], [.026, .2], [-.026, .2]], face(c, -.15)); b.box(-.026, .195, .026, .205, on ? '#fff6d8' : '#8a8f98', { lit: on });
  b.box(-.016, .06, .016, .09, '#3a3d44'); b.box(.006, .1, .016, .118, '#d8392f');
  if (on) b.glow(0, .21, .15, '#fff4d2', { opacity: .5 });
  return b.done({ size: { w: .052, h: .205 }, grips: { hand: [0, .07] }, points: { lens: [0, .205] }, light: on ? { x: 0, y: .21, color: '#fff4d2' } : null });
}
function wrench(o = {}) { const b = B(o), c = o.color || '#9ea4aa'; b.box(-.009, 0, .009, .17, c, { r: .008 }); b.ell(0, .19, .028, .03, c); b.poly([[-.012, .2], [.012, .2], [.01, .23], [-.01, .23]], face(c, -.3)); b.box(-.004, .02, .004, .15, hi(c, .2)); return b.done({ size: { w: .06, h: .22 }, grips: { hand: [0, .05] }, points: { tip: [0, .2] } }); }
function screwdriver(o = {}) { const b = B(o), c = pick(o, 'color', '#d8392f'); b.box(-.016, 0, .016, .09, c, { r: .01 }); b.lines([[-.006, .01, -.006, .08], [.006, .01, .006, .08]], .003, face(c, .2)); b.box(-.004, .09, .004, .2, '#c9ccd2'); b.poly([[-.004, .2], [.004, .2], [.002, .21], [-.002, .21]], '#9ea4aa'); return b.done({ size: { w: .032, h: .21 }, grips: { hand: [0, .045] }, points: { tip: [0, .21] } }); }
function hammer(o = {}) { const b = B(o), c = pick(o, 'color', '#8a5a34'); b.box(-.012, 0, .012, .28, c, { r: .008 }); b.box(-.012, 0, .012, .09, '#2a2b30', { r: .008 }); b.box(-.06, .26, .045, .31, '#5f646b', { r: .004 }); b.poly([[.045, .26], [.075, .3], [.045, .31]], '#5f646b'); b.box(-.06, .3, .045, .31, hi('#5f646b', .2)); return b.done({ size: { w: .14, h: .31 }, grips: { hand: [0, .05] }, points: { head: [-.06, .285] } }); }
function tweezers(o = {}) { const b = B(o), c = o.color || '#c9ccd2'; b.poly([[-.006, .12], [.006, .12], [.004, 0], [.0015, 0], [.002, .11], [-.002, .11], [-.0015, 0], [-.004, 0]], c); b.line(-.004, .02, -.006, .1, .002, hi(c, .3)); return b.done({ size: { w: .012, h: .12 }, grips: { hand: [0, .07], pinch: [0, .06] }, points: { tip: [0, 0] } }); }
function toolbox(o = {}) { const b = B(o), c = pick(o, 'color', '#c8342c'), W = .46, H = .22; b.path([[-W * .2, H], [-W * .2, H + .06], [W * .2, H + .06], [W * .2, H]], .018, '#2a2b30'); b.box(-W / 2, 0, W / 2, H, c, { r: .012 }); b.box(-W / 2, H * .62, W / 2, H * .68, face(c, .25)); b.box(-W / 2, 0, -W / 2 + .04, H, face(c, .12)); b.box(-.03, H * .5, .03, H * .62, '#c9ccd2', { r: .003 }); if (o.open) { b.box(-W / 2 + .03, H, -W * .1, H + .06, '#9ea4aa'); b.box(W * .05, H, W * .15, H + .09, '#f0c24a'); }
  return b.done({ size: { w: W, h: H + .07 }, grips: { hand: [0, H + .06] }, top: { y: H, x0: -W / 2, x1: W / 2, z: b.depth(), front: H, back: H } }); }
function lighter(o = {}) { const b = B(o), c = pick(o, 'color', '#d8392f'), on = !!(o.lit ?? o.on); b.box(-.012, 0, .012, .055, c, { r: .004 }); b.box(-.012, .055, .012, .07, '#c9ccd2'); b.box(.004, .058, .012, .072, '#5f646b'); if (on) { b.ell(-.002, .088, .006, .015, '#ffd66b', { lit: true }); b.ell(-.002, .084, .003, .008, '#ffffff', { lit: true }); b.glow(-.002, .09, .35, '#ffb070', { opacity: .35 }); } return b.done({ size: { w: .024, h: on ? .1 : .072 }, grips: { hand: [0, .025], thumb: [.008, .07] }, points: { flame: [-.002, .09] } }); }
function candle(o = {}) { const b = B(o), c = pick(o, 'color', '#efe6d2'), H = o.h ?? .12, on = o.lit ?? o.on ?? true; if (o.holder !== false) { b.ell(0, .008, .05, .012, '#c9a24a'); b.box(-.05, 0, .05, .008, face('#c9a24a', .2)); } b.box(-.016, .008, .016, H, c); b.box(-.016, .008, -.006, H, face(c, .1)); b.ell(0, H, .016, .005, hi(c, .1)); b.line(0, H, 0, H + .012, .002, '#2a2a2a');
  if (on) { b.glow(0, H + .02, o.glowR ?? 1.2, '#ffb070', { opacity: o.glow ?? .45 }); b.ell(0, H + .026, .007, .017, '#ffb84a', { lit: true }); b.ell(0, H + .022, .0035, .009, '#fff4d2', { lit: true }); }
  return b.done({ size: { w: .1, h: H + .045 }, grips: { hand: [0, H * .5] }, points: { flame: [0, H + .025] }, light: on ? { x: 0, y: H + .025, color: '#ffb070' } : null }); }
/** non-lethal security gear (sister guards): stunGun | baton */
function stunGun(o = {}) { const b = B(o), c = o.color || '#2a2b30', a = o.accent || '#f0c24a'; b.poly([[-.03, 0], [.005, 0], [.025, .07], [-.01, .07]], c); b.box(-.04, .065, .15, .11, c, { r: .012 }); b.box(.1, .07, .15, .105, a, { r: .006 }); b.dots([[.155, .078, .004], [.155, .098, .004]], '#c9ccd2'); b.path([[.01, .065], [.02, .045], [.04, .045], [.045, .065]], .006, c); return b.done({ size: { w: .19, h: .11 }, grips: { hand: [-.012, .04] }, points: { tip: [.155, .088] } }); }
function baton(o = {}) { const b = B(o), c = o.color || '#1d1e22'; b.box(-.014, 0, .014, .14, face(c, -.1), { r: .007 }); b.box(-.012, .14, .012, .55, c, { r: .008 }); b.line(.014, .14, .05, .16, .016, c); return b.done({ size: { w: .07, h: .55 }, grips: { hand: [0, .07], far: [0, .4] } }); }

// ================================================= medical =================================================
function stethoscope(o = {}) { const b = B(o), c = o.color || '#2a2b30'; b.path([[-.06, .3], ...arcPts(0, .2, .06, .14, Math.PI, Math.PI * 2, 10), [.06, .3]], .008, c); b.dots([[-.06, .305, .007], [.06, .305, .007]], '#c9ccd2'); b.path([[0, .06], [.01, .02], [.05, -.05], [.09, -.04]], .008, c); b.circ(.1, -.045, .022, '#c9ccd2'); b.circ(.1, -.045, .014, face('#c9ccd2', .2)); return b.done({ size: { w: .2, h: .36 }, grips: { hand: [.1, -.045], neck: [0, .2] }, points: { chest: [.1, -.045] } }); }
function syringe(o = {}) { const b = B(o), c = o.liquid || '#7ab8e0'; b.line(0, 0, 0, .025, .002, '#c9ccd2'); b.box(-.01, .025, .01, .1, '#e8f0f4', { op: .7 }); b.box(-.008, .028, .008, .07, c, { op: .8 }); b.lines([[-.01, .045, -.004, .045], [-.01, .06, -.004, .06], [-.01, .075, -.004, .075]], .0015, '#5f646b'); b.box(-.018, .1, .018, .106, '#c9ccd2'); b.box(-.003, .1, .003, .14, '#c9ccd2'); b.box(-.012, .14, .012, .146, '#c9ccd2'); return b.done({ size: { w: .036, h: .146 }, grips: { hand: [0, .1], thumb: [0, .145] }, points: { tip: [0, 0] } }); }
function pillBottle(o = {}) { const b = B(o), c = pick(o, 'color', '#e08a2a'); b.box(-.024, 0, .024, .07, c, { op: .85, r: .004 }); b.box(-.024, 0, -.012, .07, face(c, .15), { op: .85 }); b.box(-.024, .018, .024, .05, '#f4f1ea'); b.lines([[-.016, .042, .014, .042], [-.016, .034, .01, .034], [-.016, .026, .012, .026]], .002, '#9aa3b2'); b.box(-.027, .07, .027, .09, o.cap || '#f4f1ea', { r: .004 }); b.lines([[-.022, .075, -.022, .087], [-.012, .075, -.012, .087], [0, .075, 0, .087], [.012, .075, .012, .087], [.022, .075, .022, .087]], .0015, '#d6d0c4');
  if (o.pills) b.dots([[.04, .006, .006], [.055, .006, .006], [.048, .016, .006]], '#f4f1ea'); return b.done({ size: { w: .054, h: .09 }, grips: { hand: [0, .035] } }); }

// ================================================= kitchen tools =================================================
function pot(o = {}) { const b = B(o), c = pick(o, 'color', '#9ea4aa'), W = .24, H = .15; b.box(-W / 2 - .04, H * .7, -W / 2, H * .8, '#2a2b30', { r: .006 }); b.box(W / 2, H * .7, W / 2 + .04, H * .8, '#2a2b30', { r: .006 }); b.box(-W / 2, 0, W / 2, H, c, { r: [0, 0, .01, .01] }); b.box(-W / 2, 0, -W / 2 + .04, H, face(c, .12)); b.box(W / 2 - .03, .02, W / 2 - .02, H - .02, hi(c, .25));
  if (o.lid !== false) { b.ell(0, H, W / 2 + .005, .022, face(c, -.05)); b.box(-.02, H + .015, .02, H + .035, '#2a2b30', { r: .008 }); } else { b.ell(0, H, W / 2, .02, hi(c, .2)); b.ell(0, H, W / 2 - .01, .015, o.food || '#c2412e'); }
  if (o.steam) steam(b, 0, H + .02, { h: .14, n: 3 }); return b.done({ size: { w: W + .08, h: H + .035 }, grips: { left: [-W / 2 - .025, H * .75], right: [W / 2 + .025, H * .75], hand: [W / 2 + .025, H * .75] }, points: { rim: [0, H] } }); }
function pan(o = {}) { const b = B(o), c = o.color || '#2a2b30', R = .13; b.box(R - .01, .03, R + .22, .045, '#1d1e22', { r: .008 }); b.poly([[-R, .05], [R, .05], [R * .85, 0], [-R * .85, 0]], c); b.ell(0, .05, R, .024, face(c, -.15)); b.ell(0, .05, R * .9, .018, face(c, -.05)); if (o.food) foodOn(b, o.food, 0, .05, R * .8, false, o);
  if (o.steam) steam(b, 0, .07, { h: .12, n: 2 }); return b.done({ size: { w: R * 2 + .22, h: .075 }, grips: { hand: [R + .16, .038] }, points: { center: [0, .05] }, top: { y: .052, x0: -R * .7, x1: R * .7, z: b.depth(), front: .04, back: .06 } }); }
/** a kettle: stove (steel + black handle, iq500 kitchen) | electric (white on a base); steam */
function kettle(o = {}) { const b = B(o), v = o.variant || 'stove', c = pick(o, 'color', v === 'electric' ? '#e9e8e2' : PAL.kettle);
  if (v === 'electric') { b.box(-.08, 0, .08, .02, '#2a2b30', { r: .006 }); b.path([[.06, .05], [.11, .07], [.11, .16], [.06, .19]], .018, face(c, .15)); b.poly([[-.075, .02], [.065, .02], [.06, .2], [-.06, .2]], c); b.poly([[-.075, .02], [-.05, .02], [-.045, .2], [-.06, .2]], face(c, .1)); b.poly([[-.06, .17], [-.11, .19], [-.105, .2], [-.06, .195]], c); b.box(-.06, .2, .06, .215, face(c, .1), { r: .006 }); b.box(.02, .07, .05, .14, '#2a6ad8', { op: .6, r: .006 });
    if (o.steam) steam(b, -.1, .2, { h: .12 }); return b.done({ size: { w: .23, h: .215 }, grips: { hand: [.11, .12] }, points: { spout: [-.108, .2] } }); }
  b.poly([[-.1, 0], [.1, 0], [.085, .1], [.05, .135], [-.05, .135], [-.085, .1]], c); b.poly([[-.1, 0], [-.06, 0], [-.05, .135], [-.085, .1]], face(c, .1)); b.box(-.1, 0, .1, .012, face(c, .2));
  b.poly([[-.08, .05], [-.16, .12], [-.15, .13], [-.075, .085]], c); b.box(-.015, .135, .015, .15, '#1d1e22', { r: .005 }); b.path([[-.06, .13], ...arcPts(0, .14, .06, .07, Math.PI, 0, 10), [.06, .13]], .014, '#1d1e22');
  b.line(.05, .02, .06, .09, .006, hi(c, .3)); if (o.steam) steam(b, -.155, .13, { h: .12 });
  return b.done({ size: { w: .26, h: .21 }, grips: { hand: [0, .2] }, points: { spout: [-.155, .13] } }); }
function knife(o = {}) { const b = B(o); b.box(-.012, 0, .012, .1, o.handle || '#2a2b30', { r: .006 }); b.dots([[0, .03, .003], [0, .07, .003]], '#c9ccd2'); b.poly([[-.012, .1], [.014, .1], [.014, .2], [-.012, .25]], '#d6dadf'); b.line(.008, .105, .01, .21, .003, hi('#d6dadf', .3)); return b.done({ size: { w: .028, h: .25 }, grips: { hand: [0, .05] }, points: { tip: [-.012, .25] } }); }
function spoon(o = {}) { const b = B(o), c = o.color || '#c9ccd2'; b.box(-.005, 0, .005, .12, c, { r: .005 }); b.ell(0, .145, .02, .03, c); b.ell(.004, .15, .012, .02, face(c, .15)); return b.done({ size: { w: .04, h: .175 }, grips: { hand: [0, .04] }, points: { tip: [0, .16] } }); }
function fork(o = {}) { const b = B(o), c = o.color || '#c9ccd2'; b.box(-.005, 0, .005, .12, c, { r: .005 }); b.poly([[-.006, .12], [.006, .12], [.016, .14], [-.016, .14]], c); for (const x of [-.0135, -.0045, .0045, .0135]) b.box(x - .002, .14, x + .002, .18, c); return b.done({ size: { w: .034, h: .18 }, grips: { hand: [0, .04] }, points: { tip: [0, .18] } }); }
function rollingPin(o = {}) { const b = B(o), c = pick(o, 'color', '#d9b07a'); b.box(-.16, 0, .16, .06, c, { r: .03 }); b.box(-.16, .035, .16, .045, hi(c, .2)); b.box(-.24, .02, -.16, .04, face(c, .15), { r: .01 }); b.box(.16, .02, .24, .04, face(c, .15), { r: .01 }); return b.done({ size: { w: .48, h: .06 }, grips: { left: [-.2, .03], right: [.2, .03] } }); }
function cuttingBoard(o = {}) { const b = B(o), c = pick(o, 'color', '#c8955a'); b.box(-.2, 0, .2, .02, face(c, .15), { r: .004 }); b.poly([[-.2, .02], [.2, .02], [.18, .05], [-.18, .05]], c); return b.done({ size: { w: .4, h: .05 }, top: { y: .035, x0: -.15, x1: .15, z: b.depth(), front: .02, back: .05 }, grips: { hand: [.18, .02] } }); }

// ================================================= cleaning =================================================
function bucket(o = {}) { const b = B(o), c = pick(o, 'color', '#3d8ad8'), W = .26, H = .26; b.path([[-W * .48, H * .9], ...arcPts(0, H * .92, W * .48, H * .5, Math.PI, 0, 10), [W * .48, H * .9]], .008, '#9ea4aa'); b.poly([[-W * .42, 0], [W * .42, 0], [W / 2, H], [-W / 2, H]], c); b.poly([[-W * .42, 0], [-W * .3, 0], [-W * .36, H], [-W / 2, H]], face(c, .12)); b.box(-W / 2 - .005, H - .02, W / 2 + .005, H, hi(c, .15)); if (o.water) b.ell(0, H, W * .45, .02, '#a9cbe0');
  return b.done({ size: { w: W, h: H * 1.4 }, grips: { hand: [0, H * 1.4] }, points: { inside: [0, H * .8] } }); }
function mop(o = {}) { const b = B(o), c = o.color || '#d6d0c4', v = o.variant || 'mop'; b.line(0, .06, 0, 1.3, .022, o.stick || '#3d8ad8');
  if (v === 'broom') { b.box(-.03, .1, .03, .16, '#d8392f', { r: .008 }); b.poly([[-.035, .1], [.035, .1], [.09, 0], [-.09, 0]], '#d9b65a'); b.lines([[-.06, .01, -.025, .09], [0, .01, 0, .09], [.06, .01, .025, .09]], .004, face('#d9b65a', .2)); }
  else { b.box(-.04, .05, .04, .08, '#9ea4aa'); const ls = []; for (let i = 0; i < 9; i++) { const x = -.06 + i * .015; ls.push([x * .6, .06, x, 0]); } b.lines(ls, .012, c); }
  return b.done({ size: { w: .18, h: 1.3 }, grips: { hand: [0, 1.0], low: [0, .7] } }); }

export const REG = {
  mug: { tags: ['handheld', 'kitchen', 'food'], desc: 'mug (.078 x .097; iq500: dark body, light rim, orange label). color, label (text, or false), labelColor, steam / hot (two swaying wisps), drink, detail; grips hand, handle, two; points rim', make: mug },
  cup: { tags: ['handheld', 'food'], desc: 'takeaway coffee cup with lid + sleeve; brand (invented text), steam', make: cup },
  glass: { tags: ['handheld', 'kitchen', 'food'], desc: 'drinking glass. variant water | juice | wine | flute (champagne) | whisky; fill 0..1, drink colour', make: glass },
  bottle: { tags: ['handheld', 'kitchen', 'food'], desc: 'bottle. variant water | wine | soda | beer | milk | sauce; label (text), color; grips hand, neck', make: bottle },
  jar: { tags: ['handheld', 'kitchen'], desc: 'small jar with lid and label (hand-off prop)', make: jar },
  plate: { tags: ['kitchen', 'food'], desc: "plate (front ellipse; view 'top' = round for top-down inserts). food toast | eggs | cake | steak | pasta | salad | cookies | pizza; r", make: plate },
  bowl: { tags: ['kitchen', 'food'], desc: 'bowl. food soup | cereal | salad | rice | empty, steam', make: bowl },
  food: { tags: ['food', 'handheld'], desc: "food. kind apple | banana | toast (butter) | sandwich | pizza (slice) | donut | burger | croissant | cookie | egg | cakeSlice | cake (whole: candles n, lit, view 'top')", make: food },
  cake: { tags: ['food'], desc: "birthday cake (= food kind cake): candles n, lit (flames + glow), view 'top', color, icing, fill", make: o => food({ ...o, kind: 'cake' }) },
  book: { tags: ['handheld', 'school', 'home'], desc: "book. closed (cover; title) | open: true (pages, picture) | view 'spine'; color, w, h; grips hand, left, right", make: book },
  notebook: { tags: ['handheld', 'school', 'office'], desc: 'notebook. variant spiral | school; open (lined pages, text handwritten); title, color', make: notebook },
  paper: { tags: ['handheld', 'office', 'school'], desc: "sheet of paper (A4). title, text (handwritten Kalam unless font 'print'), lines n, check, signature, stamp (text on a red box), pin (red pin + wall shadow), wall (shadow only), color; grips left, right", make: paper },
  stickyNote: { tags: ['office', 'handheld'], desc: 'yellow sticky note with a handwritten line (text), color', make: stickyNote },
  envelope: { tags: ['handheld', 'office'], desc: "envelope. view front (address, stamp) | back (flap); heart (red seal)", make: envelope },
  pen: { tags: ['handheld', 'office', 'school'], desc: 'pen, upright, tip down at y 0. variant pen | pencil | marker (ink) | crayon | chalk; lying; grips hand, pinch; points tip', make: pen },
  pencil: { tags: ['handheld', 'school'], desc: 'yellow pencil (= pen variant pencil)', make: o => pen({ ...o, variant: 'pencil' }) },
  marker: { tags: ['handheld', 'office', 'school'], desc: 'whiteboard marker (= pen variant marker); ink colour', make: o => pen({ ...o, variant: 'marker' }) },
  keys: { tags: ['handheld'], desc: 'key ring with n keys (2-3) and a fob; grips hand (the ring)', make: keys },
  wallet: { tags: ['handheld'], desc: 'leather wallet with a card peeking out; card: false', make: wallet },
  card: { tags: ['handheld'], desc: 'credit / ID card (invented); color, text', make: card },
  money: { tags: ['handheld'], desc: 'money. variant notes (fan of n banknotes, value) | stack (banded bundle) | coins (n)', make: money },
  coins: { tags: ['handheld'], desc: 'a few coins (= money variant coins); n, seed', make: o => money({ ...o, variant: 'coins' }) },
  watch: { tags: ['handheld'], desc: "wrist watch (close-up size). time 'HH:MM', run (speed, hands move from t0), seconds, smart (screen), color, strap; grips wrist", make: watch },
  glasses: { tags: ['handheld'], desc: 'glasses (held or on a table). variant round | square; color', make: glasses },
  bag: { tags: ['handheld'], desc: 'bag. variant handbag | backpack | school (red backpack) | shopping (paper bag, items, label) | duffel; color; grips hand (+ strap, back)', make: bag },
  backpack: { tags: ['handheld', 'school'], desc: 'backpack (= bag variant backpack)', make: o => bag({ ...o, variant: o.variant || 'backpack' }) },
  suitcase: { tags: ['handheld'], desc: 'suitcase. variant rolling (handle: true pulls the handle up) | briefcase (iq500); color', make: suitcase },
  briefcase: { tags: ['handheld', 'office'], desc: 'briefcase (= suitcase variant briefcase); grips hand (handle bar)', make: o => suitcase({ ...o, variant: 'briefcase' }) },
  box: { tags: ['handheld', 'generic'], desc: 'box. variant cardboard (tape, label handwritten) | gift (ribbon, bow) | shoe | pizza | crate; open (flaps up), w, h, color; top', make: box },
  giftBox: { tags: ['handheld'], desc: 'gift box (= box variant gift); color, ribbon', make: o => box({ ...o, variant: 'gift' }) },
  umbrella: { tags: ['handheld', 'street'], desc: 'umbrella. open (default; r) | closed; color; grips hand', make: umbrella },
  toy: { tags: ['handheld', 'toy'], desc: 'toy. variant teddy | car | blocks | robot | duck; color', make: toy },
  teddy: { tags: ['handheld', 'toy'], desc: 'teddy bear (sitting); color, bow', make: teddy },
  ball: { tags: ['handheld', 'sports', 'toy'], desc: 'ball. variant football | basketball | tennis | baseball | beach; r', make: ball },
  guitar: { tags: ['handheld', 'music'], desc: 'acoustic guitar, upright (lying: true for a playing pose); grips neck, body, strum', make: guitar },
  trophy: { tags: ['sports', 'handheld'], desc: 'gold trophy cup on a base; color', make: trophy },
  medal: { tags: ['sports', 'handheld'], desc: 'medal on a ribbon; text, color, ribbon', make: medal },
  stopwatch: { tags: ['sports', 'handheld'], desc: 'stopwatch; run (hands move), speed, t0', make: stopwatch },
  whistle: { tags: ['sports', 'handheld'], desc: 'whistle on a cord', make: whistle },
  racket: { tags: ['sports', 'handheld'], desc: 'tennis racket', make: racket },
  flashlight: { tags: ['handheld', 'tools'], desc: 'flashlight, lens up; lit (default true: lens glow + additive beam cone), beam: false, beamL, beamW', make: flashlight },
  wrench: { tags: ['tools', 'handheld'], desc: 'wrench (upright, jaw on top)', make: wrench },
  screwdriver: { tags: ['tools', 'handheld'], desc: 'screwdriver (handle down); color', make: screwdriver },
  hammer: { tags: ['tools', 'handheld'], desc: 'hammer (handle down)', make: hammer },
  tweezers: { tags: ['tools', 'handheld'], desc: 'tweezers (tips down); grips pinch; points tip', make: tweezers },
  toolbox: { tags: ['tools'], desc: 'red toolbox with a handle; open (tools stick out)', make: toolbox },
  lighter: { tags: ['handheld'], desc: 'lighter; lit (flame + glow); points flame', make: lighter },
  candle: { tags: ['home', 'light'], desc: 'candle in a holder; lit (default: flame + warm glow), h, holder: false', make: candle },
  stunGun: { tags: ['handheld', 'security'], desc: 'stun gun (sister guards; non-lethal), yellow tip; grips hand', make: stunGun },
  baton: { tags: ['handheld', 'security'], desc: 'security baton (tonfa style); grips hand, far', make: baton },
  stethoscope: { tags: ['medical', 'handheld'], desc: 'stethoscope (ear tubes up, chest piece at the end); grips hand (chest piece), neck', make: stethoscope },
  syringe: { tags: ['medical', 'handheld'], desc: 'syringe, needle down; liquid colour', make: syringe },
  pillBottle: { tags: ['medical', 'handheld'], desc: 'orange pill bottle with a white cap and label; pills (a few on the table)', make: pillBottle },
  pot: { tags: ['kitchen'], desc: 'cooking pot with two handles; lid: false shows food; steam', make: pot },
  pan: { tags: ['kitchen', 'handheld'], desc: 'frying pan with a long handle; food (eggs, steak...), steam', make: pan },
  kettle: { tags: ['kitchen'], desc: 'kettle. variant stove (steel, black handle, iq500) | electric; steam; points spout', make: kettle },
  knife: { tags: ['kitchen', 'handheld'], desc: 'kitchen knife (handle down)', make: knife },
  spoon: { tags: ['kitchen', 'handheld'], desc: 'spoon (handle down)', make: spoon },
  fork: { tags: ['kitchen', 'handheld'], desc: 'fork (handle down)', make: fork },
  rollingPin: { tags: ['kitchen', 'handheld'], desc: 'rolling pin; grips left, right', make: rollingPin },
  cuttingBoard: { tags: ['kitchen'], desc: 'wooden cutting board (top band to put food on)', make: cuttingBoard },
  bucket: { tags: ['cleaning', 'handheld'], desc: 'plastic bucket with a handle (blue, iq500 kitchen); water; grips hand', make: bucket },
  mop: { tags: ['cleaning', 'handheld'], desc: 'mop (variant broom); grips hand, low', make: mop },
  broom: { tags: ['cleaning', 'handheld'], desc: 'broom (= mop variant broom)', make: o => mop({ ...o, variant: 'broom' }) },
};

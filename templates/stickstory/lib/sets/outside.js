// Stick stories sets: EXTERIORS (street, park, bus stop, rooftop + skyline, stadium, field, garage, house, school yard).
// Every outdoor place shows its horizon at eye level (a sky + a far layer: hills, trees, a skyline); a single vertical card
// filling the background reads as a wall in mediums and close-ups (lessons 02-handshake, PITFALLS "Sets and props").
// Owned by the set agent. analysis/sets/NOTES.md 1.5 (street iq500 f3991, night exteriors sister f386), 3.1 (street lamps,
// moon, headlights, lit windows), 3.2 (exteriors: soft ellipse under the feet -> result.shadows = true, vehicles: a flat dark
// band), 3.4 (rain: streaks 1-2 px x 30-60 px at 10-15 deg, puddles with a warm reflection stripe), 6 (vehicles, buildings,
// skies, nature). Every sign is our own generic word.
import { THREE, rnd } from '../core.js';
import { setCtx, finish, light, glowAt, dropShadow, prop, FALLBACK, seatOf, topOf, mul, mix, Painter, XY, XZ, ROOM, sign, cone, camWide, camFull, camOn,
  motes, digits, ledBox, skyOf, cityLayer, floor, strHash, grade, lin, shell, door } from './kit.js';

const D = ROOM.D;

// ---------------------------------------------------------------------------------------------------------------------
// shared exterior pieces
// ---------------------------------------------------------------------------------------------------------------------
/** the sky card far behind: gradient for the mood (or kind), stars at night, optional sun / moon disc with halo */
export function sky(ctx, o = {}) {
  const z = o.z ?? -40, P = new Painter(ctx, { map: XY(z), key: ctx.key + '|bigsky', lit: false }), [b, t] = skyOf(ctx, o.kind), w = o.w ?? 80;
  P.gradV(-w / 2, o.y0 ?? -6, w / 2, o.y1 ?? 26, '!' + b, '!' + t);
  if (ctx.M.sky === 'night' && o.stars !== false) { const R = rnd(21); for (let i = 0; i < 90; i++) P.circle(-w / 2 + R() * w, 6 + R() * 18, .05 + R() * .07, '!#c8d0e0', 1, 1, 6); }
  ctx.objs.push(P.mesh());
  if (o.moon || (o.moon !== false && ctx.M.sky === 'night' && o.autoMoon)) { const [mx, my] = o.moonAt || [12, 16]; const M = new Painter(ctx, { map: XY(z + .5), lit: false }); M.circle(mx, my, 1.4, '!#e1e1ed', 0, 1, 48); ctx.objs.push(M.mesh()); glowAt(ctx, mx, my, z + 1, { r: 9, color: '#b8c4e8', peak: .2 }); }
  if (o.sun) { const [sx, sy] = o.sunAt || [-10, 8]; const M = new Painter(ctx, { map: XY(z + .5), lit: false }); M.circle(sx, sy, 1.6, ctx.M.sky === 'dusk' ? '!#fde0b0' : '!#f2e6a8', 0, 1, 48); ctx.objs.push(M.mesh()); glowAt(ctx, sx, sy, z + 1, { r: 10, color: '#fff0c8', peak: .25 }); }
}
/** a street lamp: pole, arm, head; at night a warm glow + a cone of light + a pool on the ground */
export function streetLamp(ctx, x, z, o = {}) {
  const P = ctx.at(z), h = o.h ?? 3.6, on = o.on ?? (ctx.M.sky !== 'day' && ctx.M.sky !== 'grey'), f = o.facing ?? 1, c = o.color || '#2a2c30';
  P.rect(x - .05, 0, x + .05, h, c, 0); P.rect(x - .09, 0, x + .09, .3, c, 0); P.seg(x, h, x + f * .5, h + .12, .05, c, 0); P.poly([[x + f * .32, h + .14], [x + f * .72, h + .14], [x + f * .66, h + .02], [x + f * .38, h + .02]], c, 1);
  P.rect(x + f * .4, h, x + f * .64, h + .03, on ? '!#fff0d0' : '#8a8c90', 2);
  if (on) { glowAt(ctx, x + f * .52, h - .05, z + .05, { r: 1.2, color: '#ffd9a0', peak: .3, core: 1 }); cone(ctx, x + f * .52, h - .02, z + .02, { h: h - .02, half: .32, w0: .25, k: .07, soft: .45, color: '#ffe2b0', poolK: 2 }); }
  return P;
}
/** a side-view car (sedan / hatch / van / taxi / police) on painter P at x (wheels on y = 0); flat dark ground band under it */
export function car(ctx, P, x, o = {}) {
  const c = ctx.c(o.color || '#697359'), l = o.l ?? 0, f = o.facing ?? 1, kind = o.kind || 'sedan', L = kind === 'van' ? 4.6 : 4.1, H = kind === 'van' ? 1.9 : 1.32, win = o.glass || '#262c34';
  const X = u => x + f * u;   // u along the car, + toward the front
  if (kind === 'van') { P.rrect(x - L / 2, .25, x + L / 2, H, .12, c, l); P.poly([[X(L / 2 - .9), H - .05], [X(L / 2), 1.0], [X(L / 2), H - .4]], c, l); P.rect(Math.min(X(L / 2 - .85), X(L / 2 - .1)), 1.05, Math.max(X(L / 2 - .85), X(L / 2 - .1)), 1.6, win, l + 1); P.rect(Math.min(X(-L / 2 + .3), X(.6)), .4, Math.max(X(-L / 2 + .3), X(.6)), 1.7, mul(c, .92), l + 1); }
  else { P.rrect(x - L / 2, .28, x + L / 2, .85, .14, c, l); P.poly([[X(-L / 2 + .55), .84], [X(-1.0), H], [X(.75), H], [X(1.35), .84]], c, l);
    P.poly([[X(-L / 2 + .75), .86], [X(-.9), H - .07], [X(-.12), H - .07], [X(-.12), .86]], win, l + 1); P.poly([[X(.0), .86], [X(.0), H - .07], [X(.68), H - .07], [X(1.12), .86]], win, l + 1);
    P.rect(x - L / 2, .52, x + L / 2, .56, mul(c, .8), l + 1); P.rect(Math.min(X(L / 2 - .12), X(L / 2)), .6, Math.max(X(L / 2 - .12), X(L / 2)), .72, o.lights ? '!#fff6d8' : '#e8e4d8', l + 2); P.rect(Math.min(X(-L / 2), X(-L / 2 + .1)), .6, Math.max(X(-L / 2), X(-L / 2 + .1)), .72, '#c8423a', l + 2); }
  if (kind === 'police') { P.rect(x - L / 2, .45, x + L / 2, .6, '#3b6fd0', l + 2); P.rrect(x - .35, H, x + .35, H + .12, .04, '#1c1d22', l + 2); P.rrect(x - .3, H + .02, x - .02, H + .1, .03, '!#6aa1fe', l + 3); P.rrect(x + .02, H + .02, x + .3, H + .1, .03, '!#c66c78', l + 3); }
  if (kind === 'taxi') { P.rrect(x - .25, H, x + .25, H + .12, .03, '#f2c24a', l + 2); }
  for (const u of [-L / 2 + .75, L / 2 - .8]) { P.circle(X(u), .32, .32, '#141414', l + 3, 1, 32); P.circle(X(u), .32, .15, '#7e8080', l + 4, 1, 24); }
  if (o.lights) glowAt(ctx, X(L / 2 + .05), .66, (o.z ?? 0) + .1, { r: .7, color: '#fff6d8', peak: .35, core: 1 });
}
/** the flat dark ground band under a vehicle (multiply 0.67, sharp) on the floor */
function carShadow(ctx, x, z, L) { const S2 = new Painter(ctx, { kind: 'alpha', map: (u, v) => [u, .006, v], order: 1, lit: false }); S2.rect(x - L / 2, z - .5, x + L / 2, z + .55, '!#000000', 0, .33); ctx.glows.push(S2); }
/** a building facade block on painter P: x0..x1, height h, colour, a window grid (lit at night), optional ground floor shop */
export function facade(ctx, P, x0, x1, h, o = {}) {
  const c = ctx.c(o.color || '#8a7d70'), l = o.l ?? 0, night = ctx.M.sky === 'night' || ctx.M.sky === 'dusk', R = rnd(strHash(ctx.name + x0));
  P.rect(x0, 0, x1, h, c, l); P.rect(x0, h - .12, x1, h, mul(c, 1.1), l + 1); P.rect(x0 - .05, h, x1 + .05, h + .1, mul(c, .8), l + 1);
  if (o.bricks) for (let y = .2; y < h - .2; y += .17) P.rect(x0, y, x1, y + .012, mul(c, .9), l + 1);
  const g0 = o.shop ? 3.1 : .9, cw = o.cell?.[0] ?? 1.0, ch = o.cell?.[1] ?? 1.15, ww = o.winW ?? .55, wh = o.winH ?? .72;
  for (let y = g0; y + wh < h - .3; y += ch) for (let x = x0 + (cw - ww) / 2 + .15; x + ww < x1 - .1; x += cw) {
    const lit = night && R() < (o.lit ?? .45);
    P.rect(x - .04, y - .06, x + ww + .04, y, mul(c, .78), l + 1);
    P.rect(x, y, x + ww, y + wh, lit ? (R() < .75 ? '!#d8b070' : '!#a8b8d0') : (o.glass || '#4a5260'), l + 2);
    if (!lit && !night) P.rect(x + .05, y + wh * .5, x + ww * .45, y + wh - .05, mul(o.glass || '#4a5260', 1.25), l + 3);
    if (o.bars) for (let k = 1; k < 4; k++) P.rect(x + ww * k / 4 - .01, y, x + ww * k / 4 + .01, y + wh, '#2a2a2e', l + 3);
  }
}
/** a shop front on the ground floor of a facade: glass window (lit at night), door, sign board, optional awning */
export function shopFront(ctx, P, x0, x1, o = {}) {
  const l = o.l ?? 3, night = ctx.M.sky !== 'day' && ctx.M.sky !== 'grey', w = x1 - x0, R = rnd(strHash(o.name || 'shop'));
  P.rect(x0, 0, x1, 2.9, o.frame || '#3a3d44', l);
  const gx0 = x0 + .15, gx1 = x1 - (o.door === false ? .15 : 1.15);
  P.rect(gx0, .45, gx1, 2.3, night ? '!#e8c890' : '#7c8c94', l + 1); P.rect(gx0, .45, gx1, .55, mul(o.frame || '#3a3d44', 1.2), l + 2);
  if (!night) P.poly([[gx0 + .2, 2.2], [gx0 + .6, 2.2], [gx0 + .2, 1.6]], '#9aaab2', l + 2);
  // what's in the window: shelves of goods / TVs with charts / cakes
  const kind = o.goods || 'shelves';
  if (kind === 'tvs') for (let i = 0; i < 3; i++) { const tx = gx0 + .3 + i * (gx1 - gx0 - .4) / 3; P.rect(tx, 1.2, tx + .6, 1.65, '#18191d', l + 2); P.rect(tx + .04, 1.24, tx + .56, 1.61, '!#2c4060', l + 3); P.pline([[tx + .08, 1.3], [tx + .2, 1.42], [tx + .32, 1.35], [tx + .5, 1.55]], .02, '!#7fe0a0', l + 4); }
  else if (kind === 'cakes') for (let i = 0; i < 4; i++) { const tx = gx0 + .35 + i * (gx1 - gx0 - .5) / 4; P.rect(tx - .18, .9, tx + .18, 1.08, '#e8d0b0', l + 2); P.rect(tx - .18, 1.06, tx + .18, 1.12, '#c8504a', l + 3); }
  else for (const y of [.95, 1.5]) { P.rect(gx0 + .1, y, gx1 - .1, y + .04, '#5a4a3c', l + 2); for (let x = gx0 + .2; x < gx1 - .2; x += .18) P.rect(x, y + .04, x + .12, y + .2 + R() * .12, ['#c8783f', '#5b8fd0', '#7cb36b', '#d8c070', '#b44a3c'][Math.floor(R() * 5)], l + 3); }
  if (o.door !== false) { P.rect(x1 - 1.0, 0, x1 - .15, 2.25, night ? '!#d8b880' : '#4a4e56', l + 1); P.rect(x1 - .3, 1.0, x1 - .26, 1.3, '#c9c4b8', l + 2); }
  P.rect(x0, 2.42, x1, 2.88, o.board || '#2a2d34', l + 2);
  if (o.name) sign(ctx, o.name, (x0 + x1) / 2, 2.65, (o.z ?? ctx.z) + .02, { size: .2, color: o.ink || '#f1ede4', pad: .02, spacing: .15 });
  if (o.awning) { const a = o.awning; for (let x = x0, k = 0; x < x1; x += .3, k++) P.poly([[x, 2.4], [Math.min(x1, x + .3), 2.4], [Math.min(x1, x + .3), 2.05], [x, 2.05]], k % 2 ? '#f0ece2' : a, l + 4); for (let x = x0; x < x1; x += .3) P.ellipse(x + .15, 2.05, .15, .06, '#f0ece2', l + 4, 1, 10, Math.PI, Math.PI * 2); }
  if (night) glowAt(ctx, (gx0 + gx1) / 2, 1.4, (o.z ?? ctx.z) + .1, { r: w * .7, color: '#ffd8a0', peak: .07, sy: .6 });
}
/** rain: streaks over the whole frame region (+ optional puddles with warm reflection stripes) */
export function rain(ctx, o = {}) {
  const R = rnd(41), A = new Painter(ctx, { kind: 'alpha', map: XY(o.z ?? 1.5), order: 9, lit: false }), n = o.n ?? 380;
  for (let i = 0; i < n; i++) { const x = -8 + R() * 16, y = -1 + R() * 7, L = .25 + R() * .3; A.seg(x, y, x - L * .22, y - L, .012, '!#dfe6f0', 0, .3 + R() * .2); }
  const m = A.mesh(); if (m) { m.userData.update = t => { m.position.y = -((t * 7) % 1.4); }; ctx.objs.push(m); }
  const A2 = new Painter(ctx, { kind: 'alpha', map: XY((o.z ?? 1.5) - 2.6), order: 9, lit: false }); for (let i = 0; i < n * .7; i++) { const x = -10 + R() * 20, y = -1 + R() * 8, L = .3 + R() * .3; A2.seg(x, y, x - L * .22, y - L, .018, '!#dfe6f0', 0, .22); }
  const m2 = A2.mesh(); if (m2) { m2.userData.update = t => { m2.position.y = -((t * 6) % 1.6); }; ctx.objs.push(m2); }
  if (o.puddles !== false) { const F = new Painter(ctx, { map: (u, v, l) => [u, .006 + l * .002, v], lit: false }); for (const [x, z, w] of o.puddles || [[-2.6, .9, 1.4], [1.8, 1.6, 1.8], [4.6, .4, 1.1]]) { F.ellipse(x, z, w / 2, w * .12, '!#1c1f2a', 0, 1, 24); F.rect(x - w * .3, z - .02, x + w * .3, z + .02, '!#8a6a3a', 1); } ctx.objs.push(F.mesh()); }
}
/** a round tree: 2-4 overlapping circles in two greens on a trunk */
export function tree(ctx, P, x, s = 1, o = {}) { const g = o.leaf || '#5e7849', l = o.l ?? 0; P.rect(x - .09 * s, 0, x + .09 * s, 1.6 * s, o.trunk || '#5b4a3a', l); P.circle(x, 2.1 * s, .9 * s, g, l + 1, 1, 32); P.circle(x - .6 * s, 1.75 * s, .6 * s, mul(g, .9), l + 1, 1, 28); P.circle(x + .6 * s, 1.8 * s, .65 * s, mul(g, 1.08), l + 2, 1, 28); }
/** the ground of an exterior: pavement up to a kerb, then the road (or grass) */
function ground(ctx, o = {}) {
  const kerb = o.kerb ?? 1.4;
  floor(ctx, { kind: o.kind || 'paving', color: o.color || 'pavement', s: .7, x0: -14, x1: 14, z1: kerb, front: .05 });
  const F = new Painter(ctx, { map: XZ(0), key: ctx.key + '|road' });
  F.rect(-14, kerb, 14, kerb + .18, mul(ctx.c(o.color || 'pavement'), 1.12), 1); F.rect(-14, kerb + .18, 14, 14, o.road || 'road', 0);
  if (o.lines !== false) for (let x = -14; x < 14; x += 3) F.rect(x, kerb + 3.2, x + 1.6, kerb + 3.32, '#d8d4c8', 1);
  ctx.objs.push(F.mesh());
}

// ---------------------------------------------------------------------------------------------------------------------
// STREET (iq500 f3991 / f3765, sister f5406): shop fronts with our own names, a bank, upper floors, street lamps, pavement
// ---------------------------------------------------------------------------------------------------------------------
export const street = {
  desc: 'a city street (iq500): a row of facades with shop fronts (cafe with a striped awning, electronics, bakery, books) and a stone bank with pilasters, steps, a lit ATM and a billboard; upper floors with windows; street lamps; pavement, kerb and road',
  opts: "mood: day | dusk | night | memory; rain: true (streaks + puddles); billboard: 'TEXT' (our own) | false; cars: true (parked cars); names: { cafe, shop, bank, books } override the signs",
  moods: ['day', 'dusk', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'street', o, { x0: -10, x1: 10, H: null, mood: 'day', D: 3.0,
      pal: { pavement: '#8a8680', road: '#3e3f44', stone: '#8a857c', pilaster: '#b8b2a6', floor: '#8a8680' },
      moods: { night: { pavement: '#3a3c48', road: '#1c1e26', stone: '#2c2c36', pilaster: '#4a4a54' } },
      rim: { day: '#f0d8b0', night: '#f0ba84', dusk: '#f0a070' }, rimDir: { all: [-1, .4] }, shadows: true, bg: '#0b0c12' });
    const P = ctx.wall, n = o.names || {}, night = ctx.M.sky !== 'day' && ctx.M.sky !== 'grey';
    sky(ctx, { sun: ctx.M.sky === 'dusk', sunAt: [-14, 4], autoMoon: true });
    const FAR = new Painter(ctx, { map: XY(-14), lit: false }); cityLayer(ctx, FAR, { x0: -24, x1: 24, y0: 0, hMin: 6, hMax: 13, color: night ? '!#151b2c' : ctx.M.sky === 'dusk' ? '!#6a5a68' : '!#a8b0b8', night, lit: .3, win: night, cell: [.5, .6], seed: 2, gap: .2 }); ctx.objs.push(FAR.mesh());
    // buildings left -> right
    facade(ctx, P, -10, -6.6, 6.2, { color: '#8e7a68', shop: true }); shopFront(ctx, P, -9.8, -6.8, { name: n.cafe ?? 'CAFE', awning: '#c8504a', goods: 'cakes', board: '#3a2a22' });
    facade(ctx, P, -6.6, -3.0, 7.4, { color: '#6e7480', shop: true }); shopFront(ctx, P, -6.4, -3.2, { name: n.shop ?? 'ELECTRONICS', goods: 'tvs', board: '#20242c' });
    // the bank: stone, 4 pilasters, 3 tall barred windows, double door, 3 steps, gold letters, ATM, billboard
    const bx0 = -3.0, bx1 = 2.6; P.rect(bx0, 0, bx1, 6.0, 'stone', 0); P.rect(bx0 - .1, 6.0, bx1 + .1, 6.25, 'pilaster', 1);
    for (const x of [-2.7, -1.0, .9, 2.3]) P.rect(x - .14, .4, x + .14, 5.4, 'pilaster', 1);
    for (const x of [-1.85, 1.6]) { P.rect(x - .45, 1.3, x + .45, 4.6, '#2a2c34', 2); for (let k = 1; k < 5; k++) P.rect(x - .45 + k * .18 - .012, 1.3, x - .45 + k * .18 + .012, 4.6, '#6a6a70', night ? 4 : 3); if (night) P.rect(x - .4, 1.35, x + .4, 4.55, '!#3a4258', 3); }   // whole layers (a 2.5 pane z-fought in far night wides, video 02 f8892)
    P.rect(-.65, .4, .55, 2.6, '#987e5f', 2); P.rect(-.06, .4, -.04, 2.6, '#6a5640', 3); P.rect(-.3, 1.4, -.22, 1.5, '#d8c890', 3); P.rect(.14, 1.4, .22, 1.5, '#d8c890', 3);
    for (let k = 0; k < 3; k++) { const SPt = ctx.at(ctx.z + .12 + k * .14); SPt.rect(-1.2 - k * .12, k * .13, .9 + k * .12, (k + 1) * .13, mul(ctx.c('pilaster'), 1 - k * .06), 0); }
    sign(ctx, n.bank ?? 'BANK', -.05, 3.2, ctx.z + .02, { size: .26, color: '!#d8b860', pad: .02, spacing: .35, font: 'Oswald' });
    P.rect(1.95, 1.0, 2.45, 1.8, '#c9c7c0', 4); P.rect(2.02, 1.38, 2.38, 1.66, '!#9fc6ed', 5); P.rect(2.05, 1.12, 2.35, 1.2, '#2a2c34', 5); if (night) glowAt(ctx, 2.2, 1.5, ctx.z + .05, { r: .5, color: '#9fc6ed', peak: .12 });
    ctx.spot('atm', { x: 2.2, z: ctx.z + .5, back: true }); ctx.spot('bankDoor', { x: -.05, z: ctx.z + .5, kind: 'door', back: true });
    if (o.billboard !== false) { const B = ctx.at(ctx.z + .05); B.rect(-2.2, 4.3, 1.8, 5.7, '#232d4d', 3); B.rect(-2.25, 4.25, 1.85, 4.3, '#1a1f30', 3); sign(ctx, o.billboard || 'SAFE AS HOUSES', -.2, 5.0, ctx.z + .07, { size: .22, color: '!#f2efe6', pad: .02 });
      if (night || ctx.mood === 'dusk') { cone(ctx, -1.4, 4.0, ctx.z + .1, { h: -1.6, half: .3, w0: .1, k: .06, pool: false }); cone(ctx, 1.0, 4.0, ctx.z + .1, { h: -1.6, half: .3, w0: .1, k: .06, pool: false }); } }
    facade(ctx, P, 2.6, 6.2, 6.8, { color: '#9a8470', shop: true, bricks: true }); shopFront(ctx, P, 2.8, 6.0, { name: n.bakery ?? 'BAKERY', awning: '#3a6a8a', goods: 'cakes' });
    facade(ctx, P, 6.2, 10, 5.6, { color: '#7a6a5c', shop: true }); shopFront(ctx, P, 6.4, 9.8, { name: n.books ?? 'BOOKS', board: '#2e3a2a' });
    streetLamp(ctx, -4.8, .9, { facing: 1 }); streetLamp(ctx, 5.0, .9, { facing: -1 });
    if (o.cars) { const CZ = ctx.at(3.2); car(ctx, CZ, -4.0, { color: '#8a3a32', z: 3.2 }); car(ctx, CZ, 3.0, { color: '#d8d6d0', facing: -1, z: 3.2 }); carShadow(ctx, -4.0, 3.2, 4.1); carShadow(ctx, 3.0, 3.2, 4.1); }
    if (o.rain) rain(ctx, {});
    ground(ctx, {});
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 }); ctx.spot('cafe', { x: -8.3, z: ctx.z + .6, back: true }); ctx.spot('shop', { x: -4.8, z: ctx.z + .6, back: true });
    ctx.spot('kerb', { x: 0, z: 1.2 });
    return finish(ctx, { cam: { wide: camWide(0, { h: 6.4, camH: 2.6 }), close: camWide(0, { h: 3.6, camH: 1.35 }), full: camFull(0, { h: 8, camH: 3.4 }), bank: camWide(-.2, { h: 4.6, camH: 1.9 }) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// PARK (iq500 f2071 night; benches, lamps, trees): row houses behind a hedge, lit windows at night, a bench, lamp posts, trees
// ---------------------------------------------------------------------------------------------------------------------
export const park = {
  desc: 'a park / square (iq500): row houses with lit windows behind a dark hedge, round trees, a park bench, lamp posts, a paved path',
  opts: "mood: night (default) | day | dusk; bench: true; rain: true",
  moods: ['night', 'day', 'dusk'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'park', o, { x0: -10, x1: 10, H: null, mood: 'night', D: 4.5,
      pal: { pavement: '#8a8478', road: '#4e6a3e', floor: '#8a8478', house: '#7a6a62', hedge: '#2f4a32' },
      moods: { night: { pavement: '#4a4a56', road: '#1f2829', house: '#3a3a4c', hedge: '#1f2829' } },
      rim: { night: '#f0c890', day: '#f0d8b0' }, rimDir: { all: [1, .4] }, shadows: true, bg: '#0b0c12' });
    sky(ctx, { autoMoon: true, moonAt: [10, 14] });
    const P = ctx.wall, night = ctx.M.sky === 'night', R = rnd(12);
    // row houses
    for (let x = -11; x < 11; x += 3.6) { P.rect(x, 0, x + 3.5, 5.2, 'house', 0); P.poly([[x - .1, 5.2], [x + 3.6, 5.2], [x + 1.75, 6.4]], mul(ctx.c('house'), .8), 1);
      for (const wx of [x + .6, x + 2.2]) for (const wy of [1.2, 3.3]) { const lit = night ? R() < .55 : false; P.rect(wx, wy, wx + .75, wy + 1.0, lit ? '!#fad094' : night ? '#22263a' : '#5a6878', 2); P.rect(wx + .36, wy, wx + .39, wy + 1.0, mul(ctx.c('house'), .7), 3); } }
    const HZ = ctx.at(ctx.z + 1.4); for (let x = -11; x < 11; x += 2.1) HZ.rrect(x, 0, x + 2.0, 1.1, .4, 'hedge', 0);
    const TZ = ctx.at(ctx.z + 2.0); tree(ctx, TZ, -6.5, 1.3, { leaf: night ? '#1c2a22' : '#5e7849' }); tree(ctx, TZ, 6.0, 1.5, { leaf: night ? '#1c2a22' : '#587045' });
    const b = prop(ctx, 'bench', { x: .8, z: -1.0, variant: 'park', w: 1.8 }, FALLBACK.bench); ctx.spot('bench', seatOf(b, { facing: 0 })); if (b.userData.seats) b.userData.seats.forEach((_, i) => ctx.spot(`bench${i + 1}`, seatOf(b, { i, facing: 0 })));
    streetLamp(ctx, -3.2, -1.2, { facing: 1 }); streetLamp(ctx, 4.4, -1.2, { facing: -1 });
    if (o.rain) rain(ctx, {});
    floor(ctx, { kind: 'paving', color: 'pavement', s: .9, x0: -14, x1: 14, front: .05 });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 });
    return finish(ctx, { cam: { wide: camWide(0, { h: 3.6, camH: 1.4 }), full: camFull(0, { h: 5.4, camH: 2.0 }), bench: camOn(.8, 1.0, -1.0, 2.2) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// BUS STOP (iq500 f6334 rain): glass shelter with a roof and a BUS sign, timetable, a bus pulling in (lit windows, LED
// route sign), street lamp, rain + puddles
// ---------------------------------------------------------------------------------------------------------------------
export const busstop = {
  desc: 'a bus stop at night in the rain (iq500): a glass shelter with a roof and a BUS sign, a timetable panel, a bench inside, a city bus with lit windows and an LED route number, a street lamp, rain and puddles',
  opts: "mood: night (default) | day | dusk; rain: true (default at night); bus: true | false; route: '12'",
  moods: ['night', 'day'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'busstop', o, { x0: -10, x1: 10, H: null, mood: 'night', D: 3.0,
      pal: { pavement: '#6a6a70', road: '#2a2c32', floor: '#6a6a70', building: '#4a4a52' }, moods: { night: { pavement: '#2c2e38', road: '#16171d', building: '#1e1f28' } },
      rim: { night: '#9fb4d8' }, rimDir: { all: [-1, .3] }, shadows: true, bg: '#0b0c12' });
    sky(ctx, {});
    const P = ctx.wall, night = ctx.M.sky === 'night';
    facade(ctx, P, -12, -3, 7, { color: 'building', lit: .5 }); facade(ctx, P, -3, 4, 8, { color: mul(ctx.c('building'), 1.1), lit: .4 }); facade(ctx, P, 4, 12, 6.5, { color: 'building', lit: .5 });
    // shelter (in front of the facades)
    const SZ = ctx.at(-1.1), G = ctx.at(-1.05, { kind: 'alpha', order: 3 }); const x0 = .8, x1 = 3.6;
    SZ.rect(x0 - .05, 0, x0 + .03, 2.4, '#8a8e96', 0); SZ.rect(x1 - .03, 0, x1 + .05, 2.4, '#8a8e96', 0); SZ.rect(x0 - .2, 2.4, x1 + .2, 2.55, '#b9bcc2', 0);
    G.rect(x0, .1, x1, 2.4, '!#c8d8e8', 0, .16); SZ.rect(x1 - .7, .5, x1 - .1, 1.9, '#e8e4dc', 1); for (let k = 0; k < 7; k++) SZ.rect(x1 - .62, 1.75 - k * .17, x1 - .2, 1.77 - k * .17, '#8a8680', 2);
    SZ.rect(x0 + .3, 1.95, x0 + .32, 2.4, '#8a8e96', 1); SZ.circle(x0 + .31, 2.75, .22, '!#3b6fd0', 1); sign(ctx, 'BUS', x0 + .31, 2.75, -1.04, { size: .1, color: '!#ffffff', pad: .01 });
    const b = prop(ctx, 'bench', { x: 2.0, z: -1.3, variant: 'bus', w: 1.4 }, FALLBACK.bench); ctx.spot('bench', seatOf(b, { facing: 0 }));
    // the bus (left, pulling in): long body, lit windows with passenger silhouettes, LED route sign, headlight
    if (o.bus !== false) { const BZ = ctx.at(-.2), bx0 = -7.6, bx1 = -1.2; BZ.rrect(bx0, .25, bx1, 3.0, .2, '#d8dad8', 0); BZ.rect(bx0, .25, bx1, .55, '#3a3d44', 1); BZ.rect(bx0, 1.0, bx1, 1.08, '!#3b6fd0', 1);
      for (let x = bx0 + .3; x < bx1 - .8; x += 1.05) { BZ.rect(x, 1.35, x + .9, 2.55, night ? '!#e8c890' : '#4a5260', 1); if (night) { BZ.circle(x + .45, 2.1, .14, '#2a2a30', 2); BZ.rrect(x + .25, 1.35, x + .65, 1.95, .1, '#2a2a30', 2); } }
      BZ.rect(bx1 - .75, .6, bx1 - .1, 2.55, night ? '!#d8b880' : '#4a5260', 1); BZ.rect(bx1 - 1.6, 2.62, bx1 - .4, 2.92, '#141416', 2); digits(BZ, o.route ?? '12', bx1 - 1.4, 2.66, .22, '!#ffb347', 3);
      for (const x of [bx0 + 1.0, bx1 - 1.2]) { BZ.circle(x, .32, .34, '#141414', 3, 1, 28); BZ.circle(x, .32, .16, '#7e8080', 4, 1, 24); }
      if (night) { glowAt(ctx, bx1 + .05, .75, 0, { r: 1.0, color: '#fff6d8', peak: .4, core: 1 }); const HB = new Painter(ctx, { kind: 'add', map: XY(-.15), order: 6, lit: false }); HB.quad([bx1, .9], [bx1 + 3.5, 1.4], [bx1 + 3.5, .1], [bx1, .6], null, 0, 1, [[.3, .28, .22, 1], [0, 0, 0, 1], [0, 0, 0, 1], [.3, .28, .22, 1]]); ctx.glows.push(HB); }
      carShadow(ctx, (bx0 + bx1) / 2, -.2, bx1 - bx0); }
    streetLamp(ctx, 5.4, -1.4, { facing: -1 });
    if (o.rain ?? night) rain(ctx, { puddles: [[-2.2, .8, 1.6], [1.5, 1.4, 1.2], [4.4, .5, 1.8]] });
    ground(ctx, { kerb: .6 });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('stop', { x: 2.2, z: -.5 }); ctx.spot('busDoor', { x: -1.6, z: .35 }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 });
    return finish(ctx, { cam: { wide: camWide(0, { h: 3.8, camH: 1.4 }), full: camFull(0, { h: 5.4, camH: 1.9 }) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// ROOFTOP / SKYLINE (sister f386, f5890, f3447): navy night sky with moon and stars, mountain silhouettes, a tower with a
// window grid, far city rectangles with lit dots; a rooftop ledge to stand on (rooftop) or just the view (skyline)
// ---------------------------------------------------------------------------------------------------------------------
function skylineBits(ctx, o = {}) {
  const night = ctx.M.sky === 'night', dusk = ctx.M.sky === 'dusk';
  sky(ctx, { moon: night && o.moon !== false, moonAt: o.moonAt || [9, 12], z: -60 });
  const MT = new Painter(ctx, { map: XY(-50), lit: false }); const mc = night ? '!#0d1324' : dusk ? '!#5a4a5c' : '!#9aa4b4';
  MT.poly([[-60, -2], [-40, 4], [-30, 1.5], [-18, 6.5], [-12, 3], [-4, 5], [6, 2], [16, 7], [24, 3], [40, 5], [60, -2]], mc, 0); ctx.objs.push(MT.mesh());
  const FAR = new Painter(ctx, { map: XY(-30), lit: false }); cityLayer(ctx, FAR, { x0: -40, x1: 40, y0: -2, hMin: 2, hMax: 7, color: night ? '!#121a2e' : dusk ? '!#4e4458' : '!#a4aebb', night: night || dusk, lit: .25, win: night || dusk, cell: [.35, .45], seed: 9, gap: .1, litColors: night ? ['!#c9ac81', '!#8fa4c6', '!#e3c487'] : ['!#dbb88c'] }); ctx.objs.push(FAR.mesh());
  // the hero tower with a 13 x 28 window grid
  const T = new Painter(ctx, { map: XY(-16), lit: false }), tx = o.towerX ?? -2.5, R = rnd(4);
  T.rect(tx - 3.2, -3, tx + 3.2, 13, night ? '!#24314b' : dusk ? '!#4e4a5e' : '!#7d8aa0', 0);
  for (let i = 0; i < 13; i++) for (let j = 0; j < 28; j++) { const x = tx - 3.0 + i * .47, y = -2.6 + j * .55, lit = (night || dusk) && R() < .5; T.rect(x, y, x + .38, y + .38, lit ? (R() < .6 ? '!#bda37b' : R() < .6 ? '!#8fa4c6' : '!#8d7e6c') : night ? '!#1a2238' : dusk ? '!#3e3b4a' : '!#a8b6c8', 1); }
  T.rect(tx + 3.2, -3, tx + 4.4, 12, night ? '!#141c30' : '!#5d6a80', 0);
  ctx.objs.push(T.mesh());
}
export const rooftop = {
  desc: 'a city rooftop at night (sister heist): a concrete ledge and roof to stand on, vents and an antenna, the skyline behind (a tower with a lit window grid, far city dots, mountains, moon and stars)',
  opts: "mood: night (default) | dusk | day; moon: false",
  moods: ['night', 'dusk', 'day'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'rooftop', o, { x0: -10, x1: 10, H: null, mood: 'night', D: 2.0, pal: { roof: '#3a3d48', ledge: '#4a4d58', floor: '#3a3d48' }, moods: { night: { roof: '#1e212c', ledge: '#2a2d38', floor: '#1e212c' } },
      rim: { night: '#9fb4d8', dusk: '#f0a070' }, rimDir: { all: [1, .5] }, shadows: true, bg: '#050a1b' });
    skylineBits(ctx, o);
    const LZ = ctx.at(-1.8); LZ.rect(-12, 0, 12, .7, 'ledge', 0); LZ.rect(-12, .7, 12, .78, mul(ctx.c('ledge'), 1.2), 1);
    const VZ = ctx.at(-1.0); VZ.rect(3.2, 0, 4.2, 1.1, '#5a5e6a', 0); VZ.rect(3.1, 1.1, 4.3, 1.2, '#6a6e7a', 1); for (let k = 0; k < 4; k++) VZ.rect(3.3, .25 + k * .2, 4.1, .3 + k * .2, '#3a3e48', 1);
    VZ.rect(-4.6, 0, -4.55, 3.4, '#2a2c34', 0); VZ.rect(-4.9, 3.0, -4.25, 3.04, '#2a2c34', 0); VZ.circle(-4.575, 3.45, .05, '!#ff4a3a', 1);
    floor(ctx, { kind: 'concrete', color: 'roof', x0: -14, x1: 14, front: .05 });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('ledge', { x: 0, z: -1.4, back: true }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 });
    return finish(ctx, { cam: { wide: camWide(0, { h: 3.8, camH: 1.5 }), full: camFull(0, { h: 6, camH: 2.4 }) } });
  },
};
export const skyline = {
  desc: 'a night skyline establishing view (sister): navy sky, moon with a halo, stars, mountains, a tower with a 13 x 28 window grid, far city dots (no ground: an establishing shot)',
  opts: "mood: night (default) | dusk | day; moon: false; towerX: metres",
  moods: ['night', 'dusk', 'day'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'skyline', o, { x0: -10, x1: 10, H: null, mood: 'night', D: 2.0, pal: { floor: '#0d1324' }, rim: { all: '#9fb4d8' }, rimDir: { all: [1, .5] }, shadows: true, bg: '#050a1b' });
    skylineBits(ctx, { towerX: o.towerX ?? 0, moon: o.moon, moonAt: [7, 10] });
    ctx.spot('center', { x: 0, z: 0 });
    return finish(ctx, { cam: { wide: { on: [0, 4, -16], frame: { h: 14 } }, tower: { on: [0, 6, -16], frame: { h: 9 } } } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// STADIUM / SPORTS FIELD (timeloop f9097): plum stands with a banner, a red running track with white lanes, mowed grass
// stripes, a bench, the finish flag; motes. The field is a painted backdrop card (the reference's high view), feet stand on it.
// ---------------------------------------------------------------------------------------------------------------------
export const stadium = {
  desc: 'a school sports day seen from HIGH up (timeloop): plum stands with a banner, a red running track with white lane lines, mowed grass - all one painted backdrop card, no sky, a bench and the finish flag; dust motes. Wides only: a medium or close-up at eye level in front of it is a flat green wall - use the place field (a real horizon) for those',
  opts: "mood: day (default) | dusk; banner: 'SPORTS DAY' (our own text); flag: true",
  moods: ['day', 'dusk'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'stadium', o, { family: 'stage', x0: -10, x1: 10, H: null, mood: 'day', D: 1.2,
      pal: { stands: '#3b2735', track: '#9d472b', grass: '#689f4a', grass2: '#5d943f', grassDark: '#476730', floor: '#5d943f' }, rim: { all: '#fff0c8' }, rimDir: { all: [-1, .5] }, shadows: true, bg: '#1a1416' });
    const z = -1.2, B = new Painter(ctx, { map: XY(z), key: ctx.key + '|field' });
    // grass card from below the frame up to the track (slanted mowed stripes), track with lanes, stands
    B.gradV(-14, -4, 14, 2.0, 'grassDark', 'grass', 0);
    for (let x = -16, k = 0; x < 16; x += 1.4, k++) if (k % 2) B.poly([[x, -4], [x + 1.4, -4], [x + 1.4 + 1.1, 2.0], [x + 1.1, 2.0]], 'grass2', 1);
    B.rect(-14, 2.0, 14, 2.75, 'track', 2); for (const y of [2.15, 2.3, 2.45, 2.6]) B.rect(-14, y, 14, y + .02, '#f2ede4', 3);
    B.rect(-14, 2.75, 14, 2.85, '#e8e2d6', 3);
    for (let y = 2.85, k = 0; y < 7; y += .3, k++) B.rect(-14, y, 14, y + .3, k % 2 ? 'stands' : mul(ctx.c('stands'), 1.15), 2);
    B.rect(-2.2, 3.0, 2.2, 3.32, '#f5ebd5', 4); sign(ctx, o.banner || 'SPORTS DAY', 0, 3.16, z + .02, { size: .17, color: '#c23b33', pad: .01, spacing: .12 });
    if (o.flag !== false) { B.rect(4.4, 2.2, 4.46, 3.7, '#e8e4dc', 4); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) B.rect(4.46 + i * .12, 3.34 + j * .12, 4.58 + i * .12, 3.46 + j * .12, '#141414', 5); B.rect(4.46, 3.34, 4.94, 3.7, '#f2f2f2', 4.5); }
    ctx.objs.push(B.mesh());
    const b = prop(ctx, 'bench', { x: 3.0, y: 2.2, z: z + .1, variant: 'stadium', w: 1.6, scale: .8 }, FALLBACK.bench); void b;
    motes(ctx, { n: 50 });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 }); ctx.spot('start', { x: -5, z: 0 }); ctx.spot('finish', { x: 4.5, z: 0 });
    return finish(ctx, { cam: { wide: { on: [0, 1.45, 0], frame: { h: 3.7 } }, full: { on: [0, 2.0, 0], frame: { h: 5.4 } } } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// FIELD / PITCH (lessons 02-handshake: video 02's town field was the 'stadium' backdrop card - at eye level a medium or a
// close-up in front of it is a flat green wall - and a project-only 'townfield' was hand-made in two edits). A real ground
// plane running back to a horizon: mowed grass with white pitch lines, ad boards, a red running track, a small covered stand
// with spectators and a banner, floodlight masts, a tree line, far hills, the sky. Every framing shows the horizon (sky +
// trees + stand), close-ups blurred. view 'side' looks across the pitch (the far touchline, the halfway line and the centre
// circle round the people), view 'goal' looks at a goal (net, six-yard box, penalty box, the spot, the arc).
// ---------------------------------------------------------------------------------------------------------------------
/** white pitch lines on the ground (painter on the floor plane, u = x, v = z) */
function pitchLines(ctx, o) {
  const G = new Painter(ctx, { map: XZ(.004), key: ctx.key + '|lines' }), W = '#eef0e6', w = .1, zt = -5.55, gx = o.gx;
  G.rect(-40, zt, 40, zt + w, W, 0);                                                    // the far touchline / goal line
  const ring = (cx, cz, r, a0 = 0, a1 = Math.PI * 2, n = 72) => { for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n;
    G.quad([cx + Math.cos(t0) * r, cz + Math.sin(t0) * r], [cx + Math.cos(t0) * (r + w), cz + Math.sin(t0) * (r + w)], [cx + Math.cos(t1) * (r + w), cz + Math.sin(t1) * (r + w)], [cx + Math.cos(t1) * r, cz + Math.sin(t1) * r], W, 0); } };
  if (o.view === 'goal') {
    // stylised half-size markings so the boxes sit in the picture: six-yard box, penalty box, spot, the arc
    const six = [gx - 6.4, gx + 6.4, zt + 2.75], box = [gx - 11.7, gx + 11.7, zt + 8];
    for (const [x0, x1, z1] of [six, box]) { G.rect(x0, zt, x0 + w, z1, W, 0); G.rect(x1 - w, zt, x1, z1, W, 0); G.rect(x0, z1 - w, x1, z1, W, 0); }
    G.ellipse(gx, zt + 5.5, .14, .14, W, 0, 1, 16);
    ring(gx, zt + 5.5, 4.6, Math.asin((box[2] - zt - 5.5) / 4.65), Math.PI - Math.asin((box[2] - zt - 5.5) / 4.65), 40);
    for (const x of [-26, 26]) G.rect(x, zt, x + w, 30, W, 0);                         // the touchlines at the frame's far sides
  } else {
    G.rect(-w / 2, zt, w / 2, 30, W, 0);                                                 // the halfway line toward the camera
    ring(0, 3.5, 6.1); G.ellipse(0, 3.5, .14, .14, W, 0, 1, 16);                         // the centre circle round the people + the spot
    ring(-26, zt, .9, 0, Math.PI / 2, 12);                                               // a corner arc far left
  }
  ctx.objs.push(G.mesh());
}
export const field = {
  desc: 'a football pitch / town sports field at eye level with a real horizon: mowed grass with white pitch lines (centre circle and halfway line, or a goal with its boxes), ad boards, a red running track, a small covered stand with spectators and a banner, floodlight masts, a tree line, far hills and the sky',
  opts: "mood: day (default) | dusk | night (floodlights on); view: 'side' (default: across the pitch, the centre circle round the people) | 'goal' (facing a goal: net, boxes, penalty spot); banner: 'TOWN CUP' (our own text) | false; crowd: true (spectators in the stand) | false; track: true | false; lights: true | false (floodlight masts); goalX: metres (view 'goal', default 0); standX: metres (default 0)",
  moods: ['day', 'dusk', 'night'],
  build(S, o = {}) {
    // under floodlights a night pitch stays green and readable (graded like a lit evening; the sky stays night)
    const ctx = setCtx(S, 'field', o, { x0: -12, x1: 12, H: null, mood: 'day', D: 15, gradeAs: o.lights !== false ? { night: { k: .6, sat: .62, tint: [.94, 1, 1.1] } } : {},
      pal: { grass: '#6aa04a', floor: '#6aa04a', track: '#a4492c', stands: '#3b2735', roof: '#e8e2d6', hill: '#86a272', hill2: '#668a58', mast: '#5c6068', board: '#2d3a5c', board2: '#c8423a' },
      rim: { day: '#fff0c8', dusk: '#f5a85f', night: '#e2ecf8' }, rimDir: { day: [-1, .5], dusk: [-1, .35], night: [0, 1] }, shadows: true, bg: '#1a1416' });
    const sk = ctx.M.sky, night = sk === 'night', lit = o.lights !== false && (night || sk === 'dusk'), view = o.view === 'goal' ? 'goal' : 'side';
    const gx = view === 'goal' ? (o.goalX ?? 0) : 0, sx = o.standX ?? (view === 'goal' ? gx : 0), R = rnd(strHash('field' + (o.seed ?? 1)));
    // 1. the sky (a clear blue by day, with a few flat clouds), the sun at dusk, the moon and stars at night
    sky(ctx, { kind: sk === 'day' ? 'clear' : sk === 'dusk' ? 'sunset' : null, sun: sk === 'dusk', sunAt: [-14, 5], autoMoon: true, moonAt: [14, 13] });
    if (sk === 'day') { const CL = new Painter(ctx, { map: XY(-39.5), lit: false, key: ctx.key + '|clouds' });
      for (const [cx, cy, s] of [[-22, 11, 1.3], [-6, 14, 1], [9, 10.5, 1.5], [24, 13.5, 1.1]]) { CL.rrect(cx - 3.2 * s, cy - .5 * s, cx + 3.2 * s, cy + .4 * s, .4 * s, '#f2f5f8', 0); CL.circle(cx - 1.1 * s, cy + .4 * s, 1.1 * s, '#f2f5f8', 0, 1, 24); CL.circle(cx + .9 * s, cy + .3 * s, .85 * s, '#f2f5f8', 0, 1, 24); }
      ctx.objs.push(CL.mesh()); }
    // 2. far hills, then the tree line along the back of the ground (two rows, uneven; low so the sky shows in long-lens shots)
    const HZ = new Painter(ctx, { map: XY(-26), lit: false, key: ctx.key + '|hills' });
    HZ.poly([[-60, -2], [-60, 1.3], [-36, 1.8], [-18, 1.4], [0, 1.9], [16, 1.5], [38, 2.0], [60, 1.4], [60, -2]], 'hill', 0);
    HZ.poly([[-60, -2], [-60, 1.0], [-28, 1.3], [-8, 1.1], [12, 1.4], [34, 1.05], [60, 1.25], [60, -2]], 'hill2', 1); ctx.objs.push(HZ.mesh());
    const T1 = ctx.at(-14.4), T2 = ctx.at(-13.6);
    for (let x = -34, k = 0; x < 34; x += 1.3, k++) tree(ctx, T1, x + (k % 3) * .25, .42 + (k % 4) * .07, { leaf: k % 2 ? '#587045' : '#4e6a3e' });
    for (let x = -33, k = 0; x < 33; x += 1.9, k++) tree(ctx, T2, x, .34 + (k % 3) * .06, { leaf: k % 2 ? '#64804e' : '#5e7849' });
    // 3. floodlight masts beside the stand (lamp banks lit at dusk / night; their light reaches the pitch)
    // (inside the wide's picture at that depth: x +-6.4, the lamp banks at 4.5-5.3 m under the wide's top letterbox bar)
    if (o.lights !== false) for (const mx of [sx - 6.4, sx + 6.4]) { const M = ctx.at(-12.2), ly = 4.5;
      M.rect(mx - .08, 0, mx + .08, ly, 'mast', 0); M.poly([[mx - .9, ly - .1], [mx + .9, ly - .1], [mx + .8, ly + .85], [mx - .8, ly + .85]], mul(ctx.c('mast'), .8), 1);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) M.rect(mx - .72 + i * .38, ly + j * .4, mx - .42 + i * .38, ly + .3 + j * .4, lit ? '!#fffbe8' : '#c9ccd2', 2);
      if (lit) { glowAt(ctx, mx, ly + .4, -12.0, { r: 2.4, color: '#fff4d8', peak: .45, core: 1.2 }); light(ctx, { p: [mx * .8, 6.5, -3], color: '#f4f2e8', gain: .5, rh: 7, rc: 22, glow: false }); } }
    // 4. the stand behind the track: stepped plum rows, spectators, posts, a roof, the banner
    const sz = -10.2, SP = ctx.at(sz), x0 = sx - 2.8, x1 = sx + 2.8, rh = .22;
    for (let r = 0; r < 5; r++) SP.rect(x0, r * rh, x1, r * rh + rh, r % 2 ? 'stands' : mul(ctx.c('stands'), 1.18), 0);
    if (o.crowd !== false) for (let r = 0; r < 4; r++) for (let x = x0 + .15; x < x1 - .1; x += .17) if (R() < .55) {
      const y = r * rh + .26, c = ['#e0a040', '#3a6ad8', '#d84a3a', '#f2efe6', '#5ab06a', '#8a5ac8'][Math.floor(R() * 6)];
      SP.rect(x - .045, y, x + .045, y + .11, c, 1); SP.circle(x, y + .155, .045, '#1a1416', 2, 1, 12); }
    for (const x of [x0 + .05, sx, x1 - .05]) SP.rect(x - .035, 0, x + .035, 1.55, '#2a2026', 3);
    SP.poly([[x0 - .2, 1.5], [x1 + .2, 1.5], [x1 + .08, 1.72], [x0 - .08, 1.72]], 'roof', 4);
    if (o.banner !== false) { SP.rect(sx - 1.2, 1.18, sx + 1.2, 1.42, '#f5ebd5', 5); sign(ctx, o.banner || 'TOWN CUP', sx, 1.3, sz + .03, { size: .14, color: '#c23b33', pad: .01, spacing: .12 }); }
    // 5. the running track (lanes) and a row of ad boards along the pitch
    if (o.track !== false) { const TR = new Painter(ctx, { map: XZ(.003), key: ctx.key + '|track' });
      TR.rect(-40, -9.2, 40, -6.7, 'track', 0); for (const z of [-8.6, -8.0, -7.4]) TR.rect(-40, z, 40, z + .05, '#f2ede4', 1); TR.rect(-40, -6.75, 40, -6.62, '#e8e2d6', 1); ctx.objs.push(TR.mesh()); }
    const AB = ctx.at(-6.3); for (let x = -30, k = 0; x < 30; x += 2.4, k++) { AB.rect(x, 0, x + 2.3, .42, k % 3 === 1 ? 'board2' : 'board', 0); AB.rect(x + .2, .16, x + 1.2 + (k % 2) * .6, .26, k % 3 === 1 ? '#f5ebd5' : '#e9b44c', 1); }
    // 6. the goal (view 'goal'): white frame on the goal line, the net behind
    if (view === 'goal') { const GW = 3.66, GH = 2.44, F2 = ctx.at(-5.5), NT = ctx.at(-7.2, { kind: 'alpha', order: 3 });
      NT.rect(gx - GW, 0, gx + GW, GH * .82, '!#f4f4f0', 0, .18); for (let x = gx - GW + .25; x < gx + GW; x += .25) NT.rect(x, 0, x + .018, GH * .82, '#e8ebe4', 1, .55); for (let y = .25; y < GH * .82; y += .25) NT.rect(gx - GW, y, gx + GW, y + .018, '#e8ebe4', 1, .55);
      F2.rect(gx - GW - .12, 0, gx - GW, GH, '#f6f6f2', 0); F2.rect(gx + GW, 0, gx + GW + .12, GH, '#f6f6f2', 0); F2.rect(gx - GW - .12, GH - .12, gx + GW + .12, GH, '#f6f6f2', 0); }
    // 7. the pitch: the grass from the camera back to the boards (mowed stripes), the white lines
    floor(ctx, { kind: 'grass', color: 'grass', x0: -40, x1: 40, z1: 8, front: .12 });
    pitchLines(ctx, { view, gx });
    for (const [cx] of view === 'goal' ? [[-26], [26]] : [[-26]]) { const CF = ctx.at(-5.5); CF.rect(cx - .02, 0, cx + .02, 1.5, '#f2f2ee', 0); CF.poly([[cx, 1.5], [cx + .45 * Math.sign(-cx || 1), 1.36], [cx, 1.2]], '#e8c440', 1); }
    if (sk !== 'night') motes(ctx, { n: 30, k: .7 });
    // 8. the team bench beside the pitch (a seat spot), spots, cameras
    const b = prop(ctx, 'bench', { x: sx + 5.6, z: -4.6, variant: 'stadium', w: 1.6 }, FALLBACK.bench);
    if (b) ctx.spot('bench', seatOf(b, { facing: 0 }));
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 });
    ctx.spot('touchline', { x: 0, z: -4.7 }); ctx.spot('track', { x: 0, z: -7.9 }); ctx.spot('trackStart', { x: -5, z: -7.9 }); ctx.spot('trackFinish', { x: 5, z: -7.9 });
    if (view === 'goal') { ctx.spot('goal', { x: gx, z: -5.0 }); ctx.spot('penalty', { x: gx, z: -.05 }); ctx.spot('box', { x: gx - 3.2, z: -1.6 }); }
    else ctx.spot('halfway', { x: 0, z: 1.2 });
    return finish(ctx, { cam: { wide: { on: [0, 1.45, 0], frame: { h: 3.7 } }, full: { on: [0, 2.3, 0], frame: { h: 6.2 } }, low: { on: [0, 1.0, 1.0], frame: { h: 2.7 } },
      stand: { on: [sx, 1.0, sz], frame: { h: 3.2 } }, ...(view === 'goal' ? { goal: { on: [gx, 1.35, -5.5], frame: { h: 4.2 } } } : {}) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// PARKING GARAGE (iq500 f255): concrete, a yellow level band with LEVEL signs, pillars with hazard stripes, fluorescent tubes,
// parking bay lines, parked cars
// ---------------------------------------------------------------------------------------------------------------------
export const garage = {
  desc: 'an underground parking garage (iq500): concrete walls and pillars, a yellow level band with LEVEL -3 signs and bay numbers, hazard stripes, fluorescent tubes, parking lines on the floor, parked cars',
  opts: "mood: day (lit, default) | night | alarm; level: '-3'; cars: true",
  moods: ['day', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'garage', o, { x0: -10, x1: 10, H: 2.9, mood: 'day', D: 4.0, gradeAs: {},
      pal: { wall: '#66706b', ceiling: '#535958', cornice: '#6e7369', skirting: '#4a4443', side: '#4a4f4e', floor: '#5a5f5e', line: '#c8ae4f', band: '#c8ae4f', pillar: '#7a807c' },
      rim: { all: '#d0e0d8' }, rimDir: { all: [0, 1] } });
    const P = ctx.wall, lvl = o.level ?? '-3', H = ctx.H;
    P.rect(-12, 1.75, 12, 2.1, 'band', 3);
    for (let x = -8; x <= 8; x += 4) { sign(ctx, `LEVEL ${lvl}`, x - .9, 1.93, ctx.z + .02, { size: .12, color: '#2a2a2e', pad: .01, spacing: .1 }); sign(ctx, `B${30 + (x + 8) / 4 | 0}`, x + .8, 1.93, ctx.z + .02, { size: .08, color: '#2a2a2e', pad: .01 }); }
    for (let x = -10; x <= 10; x += 4) { const PZ = ctx.at(-1.5); PZ.rect(x - .25, 0, x + .25, H, 'pillar', 0); for (let k = 0; k < 4; k++) PZ.poly([[x - .25, .1 + k * .2], [x + .25, .2 + k * .2], [x + .25, .3 + k * .2], [x - .25, .2 + k * .2]], k % 2 ? '#141414' : '#e8c440', 1);
      PZ.rect(x - .25, 1.75, x + .25, 2.1, 'band', 1); sign(ctx, lvl, x, 1.93, -1.48, { size: .13, color: '#2a2a2e', pad: .01 }); }
    for (let x = -8; x <= 8; x += 4) { const T = ctx.at(-.5); T.rect(x - .7, H - .1, x + .7, H - .05, '!#bac5c0', 0); glowAt(ctx, x, H - .2, -.48, { r: 1.3, color: '#d8f0e8', peak: .08, sy: .5 }); }
    light(ctx, { p: [0, H - .2, ctx.z + .8], color: '#e8f4ee', gain: .25, rh: 2.4, rc: 8, glow: false });
    if (o.cars !== false) { const CZ = ctx.at(ctx.z + 1.4); car(ctx, CZ, -6.0, { color: '#b03a32', facing: 1, z: ctx.z + 1.4 }); car(ctx, CZ, 2.0, { color: '#e8e6e0', facing: -1, z: ctx.z + 1.4 }); car(ctx, CZ, 7.2, { color: '#3a3e48', facing: 1, z: ctx.z + 1.4 }); }
    const lines = Pf => { for (let x = -10; x <= 10; x += 2.6) Pf.seg(x, ctx.z, x, -1.5, .08, 'line', 1); };
    shell(ctx, { side: 'none', cornice: false, floor: { kind: 'concrete', items: [lines] } });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 }); ctx.spot('car', { x: 2.0, z: ctx.z + 2.4 });
    return finish(ctx, { cam: { wide: camWide(0, { h: 3.4, camH: 1.25 }), full: camFull(0) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// HOUSE (iq500 f11245 sunset, timeloop porch f5482): a detached house with a gabled roof, door, window, lawn, fence, a tree,
// hills and a sunset sky
// ---------------------------------------------------------------------------------------------------------------------
export const house = {
  desc: 'a family house outside (iq500 / timeloop): a cream house with a gabled red roof, a door with a porch light, a lit window, a lawn, a wooden fence, a round tree, rolling hills, a sunset sky',
  opts: "mood: dusk (sunset, default) | day | night; door: 'closed'|'open'",
  moods: ['dusk', 'day', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'house', o, { x0: -10, x1: 10, H: null, mood: 'dusk', D: 3.0, gradeAs: { dusk: { k: .82, sat: .85, tint: [1.05, .95, .95] } },
      pal: { house: '#ece0c8', roof: '#b4553a', grass: '#7a9a52', floor: '#7a9a52', hill: '#767951', hill2: '#525b3c', fence: '#a07850', door: '#6e4a32' },
      rim: { dusk: '#f0a070', day: '#f0d8b0', night: '#f0c890' }, rimDir: { dusk: [-1, .3], all: [-1, .4] }, shadows: true });
    sky(ctx, { kind: ctx.M.sky === 'dusk' ? 'sunset' : null, sun: ctx.M.sky === 'dusk', sunAt: [-12, 5], autoMoon: true });
    const HZ = new Painter(ctx, { map: XY(-20), lit: false }); HZ.poly([[-40, -3], [-40, 3], [-25, 4.5], [-12, 3.2], [0, 4.6], [14, 3.0], [30, 4.2], [40, 3], [40, -3]], 'hill', 0); HZ.poly([[-40, -3], [-40, 1.6], [-20, 2.8], [-6, 1.8], [8, 3.0], [24, 1.6], [40, 2.4], [40, -3]], 'hill2', 1); ctx.objs.push(HZ.mesh());
    const P = ctx.wall, hx = -.8, night = ctx.M.sky === 'night';
    P.rect(hx - 2.6, 0, hx + 2.6, 3.0, 'house', 0); P.poly([[hx - 3.0, 3.0], [hx + 3.0, 3.0], [hx, 4.7]], 'roof', 1); P.rect(hx - 3.0, 2.95, hx + 3.0, 3.05, mul(ctx.c('roof'), .8), 2);
    P.rect(hx + .9, 0, hx + 1.8, 2.1, o.door === 'open' ? '!#f2d8a0' : 'door', 2); P.rect(hx + 1.6, 1.0, hx + 1.66, 1.1, '#d8c890', 3);
    P.rect(hx - 2.0, 1.1, hx - .4, 2.3, ctx.M.lamps || night ? '!#f2d090' : '#6a7a8a', 2); P.rect(hx - 1.22, 1.1, hx - 1.18, 2.3, mul(ctx.c('house'), .8), 3); P.rect(hx - 2.0, 1.68, hx - .4, 1.72, mul(ctx.c('house'), .8), 3); P.rect(hx - 2.1, 1.05, hx - .3, 1.1, mul(ctx.c('house'), .85), 3);
    ctx.spot('door', { x: hx + 1.35, z: ctx.z + .4, kind: 'door', back: true });
    if (ctx.M.lamps || night) { glowAt(ctx, hx + 1.35, 2.3, ctx.z + .05, { r: .6, color: '#ffd9a0', peak: .25 }); light(ctx, { p: [hx + 1.35, 1.2, ctx.z + .6], color: '#ffd9a0', gain: .8, rh: .9, rc: 3, glow: false }); }
    const TZ = ctx.at(ctx.z + .8); tree(ctx, TZ, 3.6, 1.2, { leaf: '#5e7849' });
    const FZ = ctx.at(-1.2); for (let x = -9; x < 9; x += .3) FZ.rect(x, 0, x + .16, .75, 'fence', 0); FZ.rect(-9, .5, 9, .56, mul(ctx.c('fence'), .85), 1); FZ.rect(-9, .2, 9, .26, mul(ctx.c('fence'), .85), 1);
    floor(ctx, { kind: 'grass', color: 'grass', x0: -14, x1: 14, front: .1 });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 });
    return finish(ctx, { cam: { wide: camWide(0, { h: 4.6, camH: 1.6 }), full: camFull(0, { h: 6.2, camH: 2.2 }) } });
  },
};

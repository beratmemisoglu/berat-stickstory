// Stick stories sets: STORYBOOK STAGES (the timeloop family). Owned by the set agent.
// analysis/sets/NOTES.md 1.4 + 4.2: pure side elevation, no ceiling / side walls, one strong hue per set with a soft
// radial light on the wall, a wainscot band (0.88x) + rail + baseboard, the floor a flat band with a lighter elliptical
// sheen under the action, furniture as near-black silhouettes (#140d0d-#1d0a0c) or with 3-6 px near-black outlines,
// window light shafts, dust motes. Floor line 68-73 %.
import { THREE, rnd } from '../core.js';
import { setCtx, shell, finish, door, win, clock, frame, paper, shelf, pendant, light, glowAt, dropShadow, prop, FALLBACK, seatOf, topOf,
  mul, Painter, XY, XZ, ROOM, sign, cone, camWide, camFull, camOn, motes, shaft, plant, digits, floor } from './kit.js';

const D = ROOM.D, Zw = -D, INK = '#160d0e';

// one hue per set: wall, lower wall (wainscot), floor (centre), baseboard, light colour
export const HUES = {
  orange: { wall: '#e1915f', lower: '#cd704a', floor: '#b56038', base: '#7a3a22', light: '#ffd8a8' },
  yellow: { wall: '#d8c99f', lower: '#bead83', floor: '#a3795c', base: '#715e47', light: '#fff0c8' },
  blue:   { wall: '#afc0c8', lower: '#9aacb4', floor: '#815138', base: '#5d3a2c', light: '#f2f8ff' },
  green:  { wall: '#9fb88f', lower: '#86a077', floor: '#7d5a3e', base: '#4e3a2a', light: '#f4ffe8' },
  pink:   { wall: '#e3a7a0', lower: '#cf8f88', floor: '#9b5a48', base: '#6a3a2e', light: '#ffe2d8' },
  mint:   { wall: '#b9d9cb', lower: '#a3c6b6', floor: '#b8b2a6', base: '#7a8a82', light: '#f2fff8' },
  cream:  { wall: '#efe0c4', lower: '#e0ceae', floor: '#8a5a3c', base: '#6a4a32', light: '#fff6e0' },
  red:    { wall: '#8c2a2a', lower: '#73201f', floor: '#4a1c16', base: '#2a0d0c', light: '#ffc8a0' },
  violet: { wall: '#4a3c6e', lower: '#3c305c', floor: '#2a2340', base: '#1a1428', light: '#d8c8ff' },
  navy:   { wall: '#2e3b5e', lower: '#26314f', floor: '#1d2236', base: '#121626', light: '#c8d8ff' },
  teal:   { wall: '#5e9c98', lower: '#4f8783', floor: '#6a4a36', base: '#3a2a20', light: '#e8fff8' },
  grey:   { wall: '#c9c7c3', lower: '#b9b7b3', floor: '#8f8c86', base: '#6a6864', light: '#ffffff' },
};
/** the stage family palette for a hue (+ explicit overrides) */
export function huePal(h, extra = {}) { const H = HUES[h] || HUES[h?.hue] || HUES.orange; return { wall: H.wall, lower: H.lower, floor: H.floor, base: H.base, side: mul(H.wall, .7), ...extra }; }

/** the storybook room: wall with a big soft light, wainscot, baseboard, floor band with a sheen, shafts, motes */
export function stageShell(ctx, s = {}) {
  const lightC = s.light || '#fff0d8';
  light(ctx, { p: [s.lx ?? 0, s.ly ?? 2.2, ctx.z + .6], color: lightC, gain: s.gain ?? .55, rh: s.rh ?? 2.6, rc: s.rc ?? 9, glow: false });
  if (s.shafts !== false && (ctx.M.sun || s.shafts)) shaft(ctx, s.sx ?? -3.2, s.sy0 ?? 1.2, s.sy1 ?? 4.6, s.sw ?? 2.2, { dir: s.sdir ?? 1, k: s.sk ?? .07, angle: .85, dz: 1.2, color: lightC });
  if (s.motes !== false) motes(ctx, { n: s.moteN ?? 45, x0: -6, x1: 6, k: s.moteK ?? 1, color: '#fff4e0' });
  shell(ctx, { side: 'none', cornice: false, wainscot: s.wainscot === false ? null : { h: s.wainH ?? .95, color: 'lower', line: mul(ctx.c('lower'), .85) },
    skirting: 'base', skirtH: s.baseH ?? .06, floor: { kind: 'flat', color: 'floor', front: .3, sheen: { x: s.shx ?? 0, z: s.shz ?? -.4, rx: s.shrx ?? 4.2, rz: s.shrz ?? 2.4, k: s.shk ?? .16 } }, wallTop: 7, wallTex: s.wallTex });
}
// near-black silhouette furniture (timeloop)
export function silDesk(P, x, w, h, o = {}) { const c = o.color || INK, t = o.t ?? .045, l = o.l ?? 0; P.rect(x - w / 2, h - t, x + w / 2, h, c, l); P.rect(x - w / 2 + .03, 0, x - w / 2 + .03 + t * .8, h, c, l); P.rect(x + w / 2 - .03 - t * .8, 0, x + w / 2 - .03, h, c, l); if (o.bar) P.rect(x - w / 2 + .03, h * .55, x + w / 2 - .03, h * .55 + t * .6, c, l);
  if (o.drawer) { P.rect(x + w / 2 - .6, h - .26, x + w / 2 - .03, h - t, c, l); P.rect(x + w / 2 - .57, h - .24, x + w / 2 - .07, h - t - .02, o.drawer, l + 1); P.rect(x + w / 2 - .38, h - .16, x + w / 2 - .26, h - .145, '#e8c050', l + 2); } }
export function silChair(P, x, o = {}) { const c = o.color || INK, f = o.facing ?? 1, s = o.s ?? 1, t = .04 * s, l = o.l ?? 0; P.rect(x - .2 * s, .44 * s, x + .2 * s, .44 * s + t, c, l); P.rect(x - .18 * s, 0, x - .18 * s + t, .44 * s, c, l); P.rect(x + .18 * s - t, 0, x + .18 * s, .44 * s, c, l); P.rect(x - f * .2 * s - t / 2, .44 * s, x - f * .2 * s + t / 2, .9 * s, c, l); }
/** a book stack with near-black outlines and lighter labels (timeloop f2034) */
export function books(P, x, y, n, R, o = {}) { const cols = o.colors || ['#3c5885', '#b3822f', '#b23a32', '#4e8a52', '#7a4a9a', '#d8c070', '#2e6e8e']; let yy = y;
  for (let i = 0; i < n; i++) { const w = .32 + R() * .14, h = .045 + R() * .02, dx = (R() - .5) * .05, c = cols[Math.floor(R() * cols.length)]; P.rect(x - w / 2 + dx - .008, yy, x + w / 2 + dx + .008, yy + h, INK, o.l ?? 0); P.rect(x - w / 2 + dx, yy + .006, x + w / 2 + dx, yy + h - .006, c, (o.l ?? 0) + 1); P.rect(x - w / 2 + dx + .03, yy + h * .35, x - w / 2 + dx + .09, yy + h * .65, mul(c, 1.4), (o.l ?? 0) + 2); yy += h; } return yy; }
/** a background "pawn" (round head + rounded body), seated or standing: timeloop crowds / pupils (set dressing) */
export function pawn(P, x, y, s = 1, c = '#140d0d', l = 0) { P.circle(x, y + .62 * s, .13 * s, c, l, 1, 20); P.rrect(x - .17 * s, y, x + .17 * s, y + .48 * s, .12 * s, c, l); }

// ---------------------------------------------------------------------------------------------------------------------
export const stage = {
  desc: 'the storybook stage room template (timeloop): one strong hue, wall with a soft light, wainscot, flat floor band with a sheen, window shafts, dust motes; add your own props',
  opts: "hue: orange | yellow | blue | green | pink | mint | cream | red | violet | navy | teal | grey (or colors: { wall, lower, floor, base }); mood: day | dusk | night | dim | memory; window: 'left'|'right'|false; clock: true; frames: n (kids' drawings / pictures); shelf: true; motes: false",
  moods: ['day', 'dusk', 'night', 'dim'],
  build(S, o = {}) {
    const hue = o.hue || 'orange', H = HUES[hue] || HUES.orange;
    const ctx = setCtx(S, 'stage', o, { family: 'stage', H: null, x0: -7, x1: 7, mood: 'day', pal: huePal(hue), rim: { all: H.light }, rimDir: { all: [-1, .4] } });
    const P = ctx.wall, R = rnd(5 + (o.seed ?? 0));
    if (o.window !== false) stageWindow(ctx, o.window === 'right' ? 3.6 : -4.3, { sky: o.sky });
    if (o.clock !== false) stageClock(ctx, o.window === 'right' ? -2.6 : 2.9, 2.35);
    for (let i = 0; i < (o.frames ?? 0); i++) drawing(ctx, -1.4 + i * 1.05, 2.25 + (i % 2) * .1, i, R);
    if (o.door) { const dx = o.door === 'left' ? -5.2 : 5.2; door(ctx, dx, { w: 1.0, h: 2.2, frame: INK, frameW: .1, color: o.doorColor || mul(HUES[hue].wall, .6), state: o.doorState ?? 'closed', handle: '#e8c050' }); ctx.spot('entry', { x: dx, z: ctx.z + 1.2 }); }
    if (o.shelf) { const SP = ctx.wall; SP.rect(-1.6, 2.7, 1.2, 2.76, INK, 4); let x = -1.5; for (const c of ['#e98a3a', '#e8b84c', '#6fb0e0', '#9ad06a', '#c08ae0', '#f0a050']) { SP.rect(x, 2.76, x + .2, 3.06, c, 4); x += .23; } }
    stageShell(ctx, { light: H.light, sx: o.window === 'right' ? 3.6 : -4.3, sdir: o.window === 'right' ? -1 : 1, motes: o.motes });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -2.4, z: 0 }); ctx.spot('right', { x: 2.4, z: 0 }); ctx.spot('back', { x: 0, z: ctx.z + .8, back: true });
    return finish(ctx);
  },
};
function stageWindow(ctx, x, o = {}) {
  const w = o.w ?? 2.0, h = o.h ?? 1.6, y0 = o.sill ?? 1.15;
  const r = win(ctx, x, { w, h, sill: y0, panes: [1, 2], frame: INK, frameW: .1, view: o.view ?? 'none', sillLedge: false, shaft: false, haze: .02 });
  // the sunset glass (horizontal bands) drawn behind the frame
  const G = ctx.at(ctx.z - .05, { lit: false }), sky = o.sky || (ctx.M.sky === 'night' ? ['#1c2240', '#2a3358'] : ctx.M.sky === 'dusk' ? ['#f0a070', '#c86a6a'] : ['#f6c896', '#e89a78']);
  G.gradV(x - w / 2 - .2, y0 - .2, x + w / 2 + .2, y0 + h + .2, '!' + sky[1], '!' + sky[0]);
  for (let k = 0; k < 3; k++) G.rect(x - w / 2, y0 + .12 + k * .09, x + w / 2, y0 + .16 + k * .09, '!' + mul(sky[1], .85), 1);
  return r;
}
function stageClock(ctx, x, y, o = {}) { clock(ctx, x, y, { r: o.r ?? .2, ring: INK, face: '#f1ece2', seconds: false, time: o.time || [3, 50] }); }
function drawing(ctx, x, y, i, R) {
  const P = ctx.wall, w = .62, h = .46, rot = (R() - .5) * .08, pairs = [['#85bce8', '#85bce8'], ['#fbd064', '#fbd064'], ['#9ad06a', '#9ad06a'], ['#f195b7', '#f195b7']], [c1, c2] = pairs[i % 4];
  paper(ctx, x, y, { w, h, rot, color: '#f5e9d3', lines: 0, pin: false });
  P.circle(x - .12, y + .04, .08, c1, 6); P.rect(x + .02, y - .14, x + .2, y + .0, c2, 6); P.poly([[x, y], [x + .22, y], [x + .11, y + .1]], '#e14636', 7);
}

// ---------------------------------------------------------------------------------------------------------------------
export const kindergarten = {
  desc: 'the kindergarten nap room (timeloop): orange wall, window with sunset light shafts, four kids\' drawings, a wall clock, a row of cots with coloured blankets and pillows, a toy table',
  opts: "mood: day (orange, default) | dim (the desaturated end) | dusk | night; cots: 3-7; kids: true (small sleeping heads on the pillows)",
  moods: ['day', 'dim', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'kindergarten', o, { family: 'stage', H: null, x0: -7, x1: 7, mood: 'day',
      pal: huePal('orange', { floor: '#b56038', lower: '#cd704a', wall: '#e1915f' }), moods: { dim: { wall: '#ddb59b', lower: '#cfa58c', floor: '#a8775c', base: '#7a5442' } },
      rim: { all: '#ffd8a8' }, rimDir: { all: [-1, .4] } });
    const R = rnd(3);
    stageWindow(ctx, -4.6, { w: 2.1, h: 1.7 });
    for (let i = 0; i < 4; i++) drawing(ctx, -2.0 + i * 1.15, 2.55 + (i % 2 ? -.08 : 0), i, R);
    stageClock(ctx, 3.6, 2.7, { r: .22, time: [3, 10] });
    // cots: black frames, coloured blankets, white pillows (+ sleeping kids' heads)
    const blankets = ['#85bce8', '#94a273', '#f5d791', '#f1c282', '#94a273', '#85bce8', '#f5d791'], n = o.cots ?? 5, cz = ctx.z + .7, CP = ctx.at(cz);
    for (let i = 0; i < n; i++) { const x = -4.0 + i * (8.4 / Math.max(1, n - 1)) * (n > 1 ? 1 : 0), w = 1.25, h = .42;
      CP.rect(x - w / 2, h - .05, x + w / 2, h, INK, 0); CP.rect(x - w / 2, 0, x - w / 2 + .05, h, INK, 0); CP.rect(x + w / 2 - .05, 0, x + w / 2, h, INK, 0);
      CP.ellipse(x - w / 2 + .2, h + .05, .17, .06, '#f2ede4', 1); CP.rrect(x - w / 2 + .3, h - .01, x + w / 2, h + .09, .04, blankets[i % blankets.length], 1); CP.rect(x - w / 2 + .3, h - .01, x + w / 2, h + .015, mul(blankets[i % blankets.length], .85), 2);
      if (o.kids !== false && i !== 2) CP.circle(x - w / 2 + .22, h + .14, .09, '#3a2420', 2);
      ctx.spot(`cot${i + 1}`, { x, z: cz + .05, kind: 'bed', lieY: h + .05, topY: h + .05, x0: x - w / 2 + .1, x1: x + w / 2, head: 'left' });
    }
    stageShell(ctx, { light: '#ffd8a8', sx: -4.6, sdir: 1, sk: ctx.mood === 'dim' ? .03 : .075, gain: .45 });
    ctx.spot('center', { x: 0, z: .3 }); ctx.spot('left', { x: -2.5, z: .3 }); ctx.spot('right', { x: 2.5, z: .3 }); ctx.spot('window', { x: -4.6, z: ctx.z + 1.4, back: true });
    return finish(ctx, { cam: { cot: camOn(-.3, .8, cz, 1.6) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
export const classroom = {
  desc: 'a school classroom (timeloop): beige wall, alphabet strip over a green chalkboard, a wall clock, a big window (right), rows of school desks and chairs as near-black silhouettes; pupils optional',
  opts: "mood: day | dusk | dim | memory; board: 'A B C' (chalk text) ; pupils: true (seated pawn silhouettes behind the desks); desks: 4-6",
  moods: ['day', 'dusk', 'dim'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'classroom', o, { family: 'stage', H: null, x0: -7, x1: 7, mood: 'day', pal: huePal('yellow', { board: '#2f372e', boardFrame: '#6a4a2e' }), rim: { all: '#fff0c8' }, rimDir: { all: [1, .4] } });
    const P = ctx.wall, R = rnd(4);
    // alphabet strip + chalkboard
    P.rect(-6.0, 2.62, -1.7, 2.84, '#f4efe4', 4); const letters = 'DEFGHIJ', lc = ['#c23b33', '#3a6fc0', '#3e9a4a', '#c23b33', '#3a6fc0', '#3e9a4a', '#c23b33'];
    [...letters].forEach((ch, i) => sign(ctx, ch, -5.6 + i * .6, 2.73, ctx.z + .02, { size: .1, color: lc[i], pad: .01, spacing: 0, weight: 800 }));
    P.rect(-6.1, 1.3, -1.6, 2.55, 'boardFrame', 4); P.rect(-6.0, 1.38, -1.7, 2.47, 'board', 5); P.rect(-6.1, 1.24, -1.6, 1.3, mul(ctx.c('boardFrame'), .8), 5);
    sign(ctx, o.board ?? 'A  B  C', -4.6, 1.92, ctx.z + .02, { size: .3, color: '#e8e6e0', pad: .02, weight: 800, spacing: .05 });
    stageClock(ctx, -.25, 2.45, { r: .22 });
    // big window right with a sky view
    const wx = 3.5; ctx.holes.push({ x0: wx - 1.6, y0: 1.2, x1: wx + 1.6, y1: 2.6 }); ctx.views.push({ x0: wx - 1.6, x1: wx + 1.6, y0: 1.2, y1: 2.6, view: 'sky', sky: 'clear' });
    P.rect(wx - 1.7, 1.12, wx + 1.7, 1.2, INK, 5); P.rect(wx - 1.7, 2.6, wx + 1.7, 2.68, INK, 5); P.rect(wx - 1.7, 1.12, wx - 1.6, 2.68, INK, 5); P.rect(wx + 1.6, 1.12, wx + 1.7, 2.68, INK, 5); P.rect(wx + .2, 1.2, wx + .26, 2.6, INK, 5);
    // desks + chairs (silhouettes) and pupils
    const n = o.desks ?? 4, DP = ctx.at(ctx.z + 1.0), CPb = ctx.at(ctx.z + .8);
    for (let i = 0; i < n; i++) { const x = -5 + i * (10 / Math.max(1, n - 1)); silDesk(DP, x + .15, 1.0, .62, { t: .04, bar: true }); silChair(DP, x - .45, { s: .95 });
      ctx.spot(`desk${i + 1}`, { x: x - .45, z: ctx.z + 1.05, kind: 'seat', seatY: .43, facing: 1, desk: { topY: .62 } }); }
    if (o.pupils) for (let i = -6; i <= 6; i += 1.3) pawn(CPb, i + R() * .3, .3, .9, '#140d0d', 0);
    stageShell(ctx, { light: '#fff0c8', sx: wx, sdir: -1, sy0: 1.2, sy1: 2.6, sw: 2.8, sk: .06 });
    ctx.spot('center', { x: 0, z: .2 }); ctx.spot('board', { x: -3.8, z: ctx.z + 1.6, back: true }); ctx.spot('window', { x: wx, z: ctx.z + 1.6, back: true }); ctx.spot('left', { x: -2.4, z: .2 }); ctx.spot('right', { x: 2.4, z: .2 });
    return finish(ctx, { cam: { board: camOn(-3.8, 1.6, ctx.z + 1.4, 2.6) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
export const study = {
  desc: 'a child\'s study / reading room (timeloop): cool blue wall, a shelf of coloured books high up, a long dark desk with a drawer, a floor lamp silhouette, book stacks with dark outlines, a strong floor sheen',
  opts: "hue: blue (default) | any stage hue; mood: day | dusk | night",
  moods: ['day', 'night', 'dusk'],
  build(S, o = {}) {
    const hue = o.hue || 'blue';
    const ctx = setCtx(S, 'study', o, { family: 'stage', H: null, x0: -7, x1: 7, mood: 'day', pal: huePal(hue, { floor: '#815138' }), rim: { all: '#f2f8ff' }, rimDir: { all: [-1, .5] } });
    const P = ctx.wall, R = rnd(8), dz = ctx.z + .9, DP = ctx.at(dz);
    let x = -2.0; P.rect(-2.2, 3.05, .8, 3.12, INK, 4); for (const c of ['#e98a3a', '#e8b84c', '#6fb0e0', '#9ad06a', '#c08ae0', '#f0a050']) { P.rect(x, 3.12, x + .32, 3.62, c, 4); P.rect(x + .32, 3.12, x + .36, 3.62, INK, 4); x += .4; }
    silDesk(DP, 1.0, 4.4, .82, { t: .08, drawer: '#a8784a' });
    // floor lamp silhouette
    DP.rect(-1.95, 0, -1.85, 1.95, INK, 1); DP.poly([[-2.2, 1.95], [-1.6, 1.95], [-1.75, 2.2], [-2.05, 2.2]], INK, 1);
    books(ctx.at(dz + .1), 3.7, 0, 14, R); books(ctx.at(dz + .5), -2.7, 0, 5, R);
    ctx.spot('desk', { x: 1.0, y: .82, z: dz, kind: 'table', topY: .82, x0: -1.2, x1: 3.2 }); ctx.spot('floor', { x: .3, z: dz + .35, kind: 'seat', seatY: .02, facing: 1 });
    stageShell(ctx, { light: '#f2f8ff', sx: -4.5, sdir: 1, sk: .05, shk: .22, shrx: 3.6, shrz: 2.0, shz: -.6 });
    ctx.spot('center', { x: 0, z: .2 }); ctx.spot('left', { x: -2.4, z: .2 }); ctx.spot('right', { x: 2.4, z: .2 });
    return finish(ctx, { cam: { wide: camWide(.5, { h: 2.6, camH: 1.0 }), full: camFull(.5) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
export const gym = {
  desc: 'a school changing room / gym corridor (timeloop): warm yellow wall, a row of lockers in alternating rust and green, a notice board with papers, a bench',
  opts: "mood: day | dusk | dim; lockers: 8-14",
  moods: ['day', 'dusk'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'gym', o, { family: 'stage', H: null, x0: -7, x1: 7, mood: 'day', pal: huePal('yellow', { wall: '#e8d49a', lower: '#d8c286', floor: '#b0784a' }), rim: { all: '#fff0c8' }, rimDir: { all: [1, .4] } });
    const P = ctx.wall, LZ = ctx.at(ctx.z + .3), n = o.lockers ?? 11, lw = .5;
    for (let i = 0; i < n; i++) { const x = -4.6 + i * lw, c = i < 5 ? '#ad4e30' : '#3c7965'; LZ.rect(x, 0, x + lw - .02, 2.1, c, 0); LZ.rect(x + lw - .02, 0, x + lw, 2.1, INK, 0);
      for (let k = 0; k < 4; k++) LZ.rect(x + .1, 1.75 + k * .07, x + lw - .12, 1.78 + k * .07, mul(c, .75), 1); LZ.rect(x + lw - .12, 1.0, x + lw - .09, 1.14, '#e0d8c8', 1); }
    LZ.rect(-4.62, 0, -4.6, 2.1, INK, 0); LZ.rect(-4.62, 2.1, -4.6 + n * lw, 2.16, INK, 1);
    // notice board
    P.rect(1.9, 1.3, 3.7, 2.3, '#8a5a36', 4); P.rect(1.96, 1.36, 3.64, 2.24, '#b8854f', 5); dropShadow(ctx, 1.9, 1.3, 3.7, 2.3);
    paper(ctx, 2.3, 1.9, { w: .4, h: .5, lines: 4, rot: .05, l: 6 }); paper(ctx, 2.95, 1.78, { w: .36, h: .42, color: '#f0d870', lines: 3, rot: -.06, l: 6 }); paper(ctx, 3.4, 1.95, { w: .3, h: .36, lines: 3, rot: .02, l: 6 });
    const b = prop(ctx, 'bench', { x: -2.0, z: -.6, variant: 'locker', w: 2.2, style: 'silhouette' }, FALLBACK.bench); ctx.spot('bench', seatOf(b, { facing: 0 }));
    stageShell(ctx, { light: '#fff0c8', shafts: false });
    ctx.spot('center', { x: 0, z: .2 }); ctx.spot('lockers', { x: -2.0, z: ctx.z + .9, back: true }); ctx.spot('left', { x: -2.4, z: .2 }); ctx.spot('right', { x: 2.4, z: .2 });
    return finish(ctx);
  },
};

// ---------------------------------------------------------------------------------------------------------------------
export const bakery = {
  desc: 'a bakery (timeloop): cream tiled wall, two shelves of loaves, a brick oven with a fire glow, a pendant lamp, a long wooden counter for kneading',
  opts: "mood: day | dusk | night; fire: false",
  moods: ['day', 'dusk', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'bakery', o, { family: 'stage', H: null, x0: -7, x1: 7, mood: 'day', pal: huePal('cream', { floor: '#8a5a3c', lower: '#e9d9b8' }), rim: { all: '#ffc890' }, rimDir: { all: [1, .3] } });
    const P = ctx.wall;
    for (const y of [1.65, 2.25]) { P.rect(-4.6, y - .04, -1.6, y, '#6a4a2e', 4); for (let x = -4.4; x < -1.7; x += .48) { P.ellipse(x, y + .07, .2, .075, '#c8813e', 5, 1, 20); P.ellipse(x, y + .085, .16, .045, '#e0a35a', 6, 1, 16); for (const d of [-.07, 0, .07]) P.rect(x + d - .008, y + .06, x + d + .008, y + .12, '#a86a32', 7); } }
    // brick oven with a fire
    const ox = 2.6; P.rect(ox - 1.2, 0, ox + 1.2, 2.5, '#b4553a', 4); for (let y = .16; y < 2.5; y += .16) P.rect(ox - 1.2, y - .01, ox + 1.2, y + .01, '#8e3e2a', 5);
    P.ellipse(ox, 1.05, .8, .85, '#2a1410', 6, 1, 32, 0, Math.PI); P.rect(ox - .8, .25, ox + .8, 1.05, '#2a1410', 6);
    if (o.fire !== false) { for (let i = 0; i < 4; i++) P.poly([[ox - .5 + i * .3, .3], [ox - .38 + i * .3, .3], [ox - .44 + i * .3, .55 + (i % 2) * .1]], '!#f0a030', 7); P.rect(ox - .62, .25, ox + .62, .32, '!#ffd060', 7);
      light(ctx, { p: [ox, .5, ctx.z + .5], color: '#ffb060', gain: 1.4, rh: .9, rc: 3.5, peak: .18, gr: 1.3, moods: true }); }
    pendant(ctx, -.4, 2.6, -1.0, { kind: 'cone', shade: '#2e2a28', on: true, moods: true, cone: false, gain: .6 });
    const CZ = ctx.at(-.6); CZ.rect(-2.4, .82, 1.4, .9, '#6e4a2c', 0); CZ.rect(-2.4, .74, 1.4, .82, '#5a3c24', 0); CZ.rect(-2.3, 0, -2.2, .74, INK, 0); CZ.rect(1.2, 0, 1.3, .74, INK, 0);
    CZ.ellipse(-.4, .93, .4, .05, '#f2e6d0', 1);
    ctx.spot('counter', { x: -.4, y: .9, z: -.6, kind: 'counter', topY: .9 }); ctx.spot('baker', { x: -.4, z: -1.1, back: true }); ctx.spot('oven', { x: ox, z: ctx.z + .9, back: true });
    stageShell(ctx, { light: '#fff0d0', shafts: false, wallTex: { kind: 'tiles', s: .2, k: .95, y1: 7 } });
    ctx.spot('center', { x: 0, z: .3 }); ctx.spot('left', { x: -2.4, z: .3 }); ctx.spot('right', { x: 2.4, z: .3 });
    return finish(ctx);
  },
};

// ---------------------------------------------------------------------------------------------------------------------
export const bathroom = {
  desc: 'a school / public bathroom (timeloop): mint tiled wall, three white sinks with mirrors above, a tiled floor',
  opts: "mood: day | night | dim; sinks: 2-4",
  moods: ['day', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'bathroom', o, { family: 'stage', H: null, x0: -7, x1: 7, mood: 'day', pal: huePal('mint', { floor: '#c9c3b6', lower: '#b9d9cb' }), rim: { all: '#f2fff8' }, rimDir: { all: [0, 1] } });
    const P = ctx.wall, n = o.sinks ?? 3, SZ = ctx.at(ctx.z + .35);
    for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 2.0;
      P.rect(x - .5, 1.6, x + .5, 2.45, '#2a2a2e', 4); P.gradV(x - .45, 1.65, x + .45, 2.4, '#c8d8d8', '#e8f0f0', 5); P.seg(x - .3, 1.8, x - .1, 2.2, .04, '#ffffff', 6);
      SZ.rect(x - .12, 0, x + .12, .82, '#f2f1ec', 0); SZ.rect(x - .12, 0, x - .1, .82, '#d8d6d0', 1); SZ.rrect(x - .55, .82, x + .55, 1.02, .06, '#f2f1ec', 1); SZ.rect(x - .55, .99, x + .55, 1.02, '#d8d6d0', 2); SZ.ellipse(x, 1.0, .38, .03, '#c8c8c4', 2);
      SZ.pline([[x, 1.02], [x, 1.18], [x + .12, 1.18], [x + .12, 1.12]], .03, '#b8bcc0', 3); ctx.spot(`sink${i + 1}`, { x, z: ctx.z + .75, kind: 'counter', topY: 1.0, back: true }); }
    stageShell(ctx, { light: '#ffffff', shafts: false, wainscot: false, wallTex: { kind: 'tiles', s: .24, k: .9, y1: 7 } });
    ctx.spot('center', { x: 0, z: .2 }); ctx.spot('left', { x: -2.4, z: .2 }); ctx.spot('right', { x: 2.4, z: .2 });
    return finish(ctx);
  },
};

// ---------------------------------------------------------------------------------------------------------------------
export const whiteroom = {
  desc: 'a bare white room with a heavy vignette (timeloop f10847): grey-white wall, an empty frame, a simple table (hospital / afterlife / dream)',
  opts: "mood: day | memory | night; table: true; frame: true",
  moods: ['day', 'memory'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'whiteroom', o, { family: 'stage', H: null, x0: -7, x1: 7, mood: 'day', pal: huePal('grey', { wall: '#d8d6d2', lower: '#cfcdc8', floor: '#b4b1ab', base: '#a8a6a2' }), rim: { all: '#ffffff' }, rimDir: { all: [0, 1] } });
    const P = ctx.wall;
    if (o.frame !== false) { P.rect(.4, 1.7, 2.0, 2.9, '#a9a6a0', 4); P.rect(.46, 1.76, 1.94, 2.84, '#dcdad6', 5); dropShadow(ctx, .4, 1.7, 2.0, 2.9); }
    if (o.table !== false) { const T = ctx.at(-1.2); T.rect(-1.0, .62, 1.0, .72, '#f4f3f0', 1); T.rect(-1.0, .6, 1.0, .62, '#c8c6c2', 1); T.rect(-.9, 0, -.8, .6, '#1c1a1a', 0); T.rect(.8, 0, .9, .6, '#1c1a1a', 0);
      ctx.spot('table', { x: 0, y: .72, z: -1.2, kind: 'bed', topY: .72, lieY: .72, x0: -.9, x1: .9, head: 'right' }); }
    stageShell(ctx, { light: '#ffffff', shafts: false, wainscot: false, gain: .9, rh: 1.8, lx: .5, ly: 2.0, motes: false, shk: .25 });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -2.2, z: 0 }); ctx.spot('right', { x: 2.2, z: 0 });
    return finish(ctx, { vignette: 2 });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// THEATRE (timeloop piano stage f2507 / graduation; sister stage curtain f13221): red curtains framing a raised stage,
// a spotlight cone + floor pool, rows of audience pawns in the dark foreground
// ---------------------------------------------------------------------------------------------------------------------
export const theatre = {
  desc: 'a theatre stage (timeloop / sister): red velvet curtains framing a raised stage, a gold proscenium line, a spotlight cone with a floor pool, rows of dark audience heads in the foreground',
  opts: "mood: night (default) | day; audience: true (pawn heads foreground); spot: x of the spotlight (default 0); curtain: '#hex'",
  moods: ['night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'theatre', o, { family: 'stage', H: null, x0: -7, x1: 7, mood: 'night', gradeAs: { night: 'day' },
      pal: { wall: '#2b0709', lower: '#2b0709', floor: '#481112', base: '#170306', curtain: '#8c1d22', stage: '#5a2a1c' }, rim: { all: '#ffe8c0' }, rimDir: { all: [0, 1] } });
    const P = ctx.wall, cc = o.curtain || 'curtain', sx = o.spot ?? 0;
    // back curtain (vertical folds) + side curtains + valance + gold frame line
    for (let x = -7; x < 7; x += .28) { P.rect(x, 0, x + .14, 7, mul(ctx.c(cc), .62), 1); P.rect(x + .14, 0, x + .28, 7, mul(ctx.c(cc), .52), 1); }
    const F = ctx.at(ctx.z + 1.6); for (const s of [-1, 1]) { for (let k = 0; k < 6; k++) { const x0 = s < 0 ? -6.2 + k * .26 : 4.64 + k * .26; F.rect(x0, .8, x0 + .13, 6, cc, 0); F.rect(x0 + .13, .8, x0 + .26, 6, mul(ctx.c(cc), .82), 0); } }
    F.rect(-6.2, 3.55, 6.2, 4.3, cc, 1); for (let x = -6.2; x < 6.2; x += .52) F.ellipse(x + .26, 3.55, .26, .1, mul(ctx.c(cc), .82), 2, 1, 16, Math.PI, Math.PI * 2);
    F.rect(-4.66, .8, -4.6, 3.55, '!#c8a050', 3); F.rect(4.6, .8, 4.66, 3.55, '!#c8a050', 3); F.rect(-4.66, 3.5, 4.66, 3.56, '!#c8a050', 3);
    // the dark house wall around the proscenium (with a few balcony heads)
    const HW = ctx.at(ctx.z + 1.64); HW.rect(-9, 0, -4.66, 8, '#1f0507', 0); HW.rect(4.66, 0, 9, 8, '#1f0507', 0); HW.rect(-4.66, 3.56, 4.66, 8, '#1f0507', 0);
    { const R3 = rnd(4); for (let x = -8.5; x < -4.9; x += .45) pawn(HW, x, 1.9, .8, '#3a1418', 1); for (let x = 5.0; x < 8.6; x += .45) pawn(HW, x, 1.9, .8, '#3a1418', 1); HW.rect(-9, 1.85, -4.7, 1.95, '#4a1a1c', 2); HW.rect(4.7, 1.85, 9, 1.95, '#4a1a1c', 2); void R3; }
    // the raised stage front
    const SF = ctx.at(ctx.z + 1.62); SF.rect(-6.4, 0, 6.4, .8, '#3a1410', 0); SF.rect(-6.4, .76, 6.4, .8, '!#c8a050', 1);
    // spotlight cone + pool on the stage
    cone(ctx, sx, 7, ctx.z + 1.0, { h: 6.25, half: .2, w0: .3, k: .14, soft: .3, color: '#ffe8c0', pool: false });
    const pool = new Painter(ctx, { kind: 'add', map: (u, v) => [u, .802, v], order: 4, lit: false }); pool.radial(sx, ctx.z + 1.0, [[0, [.25, .2, .14, 1]], [1.2, [.18, .14, .1, 1]], [2.0, [0, 0, 0, 1]]], 0, 40, .45); ctx.glows.push(pool);
    if (o.audience !== false) { const A1 = ctx.at(.9), A2 = ctx.at(1.6), R = rnd(2); for (let x = -7; x < 7; x += .62) pawn(A1, x + R() * .1, -.05, 1.05, '#1a0a0c', 0); for (let x = -7.3; x < 7.3; x += .66) pawn(A2, x + R() * .1, -.25, 1.2, '#0e0506', 0); const A3 = ctx.at(2.6); for (let x = -7.6; x < 7.6; x += .78) pawn(A3, x + R() * .12, -.55, 1.45, '#080304', 0); }
    shell(ctx, { side: 'none', cornice: false, skirting: false, wall: 'wall', floor: { kind: 'flat', color: 'floor', front: .4 }, wallTop: 7 });
    ctx.spot('stage', { x: sx, y: .8, z: ctx.z + 1.0, kind: 'stand', floorY: .8 }); ctx.spot('stageLeft', { x: sx - 2, y: .8, z: ctx.z + 1.0, floorY: .8 }); ctx.spot('stageRight', { x: sx + 2, y: .8, z: ctx.z + 1.0, floorY: .8 });
    ctx.spot('center', { x: 0, z: .2 }); ctx.spot('left', { x: -3, z: .2 }); ctx.spot('right', { x: 3, z: .2 });
    return finish(ctx, { cam: { wide: { on: [0, 1.9, 0], frame: { h: 5.6 } }, stage: camOn(sx, 1.7, ctx.z + 1.0, 2.6), close: { on: [0, 1.7, 0], frame: { h: 4.2 } } } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// TV STUDIO (timeloop talk show f3560 / debate f4220): deep blue-violet set, a big screen / city backdrop, a host desk
// with a logo disc, a guest sofa, stage lights, dark audience heads
// ---------------------------------------------------------------------------------------------------------------------
export const studio = {
  desc: 'a TV studio (timeloop talk show / debate): deep blue-violet set, a night-city backdrop with a big show screen, the host desk with a logo disc, a guest sofa (or two debate lecterns), audience heads',
  opts: "mood: night (default); show: 'talk' | 'debate'; title: 'THE BIG TALK' (screen text, our own); names: ['MAX', 'SEN. VOSS'] (debate lectern plates)",
  moods: ['night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'studio', o, { family: 'stage', H: null, x0: -7, x1: 7, mood: 'night', gradeAs: { night: 'day' },
      pal: { wall: '#151238', lower: '#231a56', floor: '#0b091b', base: '#2e2877', desk: '#2e2877', sofa: '#4a2a8a' }, rim: { all: '#9ab0ff' }, rimDir: { all: [0, 1] } });
    const P = ctx.wall, debate = o.show === 'debate';
    // night city backdrop (drawn on the wall) + the big screen
    const R = rnd(6); for (let x = -7; x < 7; x += .5 + R() * .6) { const h = 1.2 + R() * 2.4; P.rect(x, .9, x + .45 + R() * .3, .9 + h, '#1d1a4a', 1); for (let wx = x + .06; wx < x + .4; wx += .12) for (let wy = 1.0; wy < .9 + h - .1; wy += .16) if (R() < .35) P.rect(wx, wy, wx + .05, wy + .07, '!#f0d890', 2); }
    const scrX = debate ? 0 : 2.6, sw = debate ? 4.2 : 2.6; P.rect(scrX - sw / 2 - .08, 1.55, scrX + sw / 2 + .08, 3.35, '#0e0c24', 3); P.gradV(scrX - sw / 2, 1.62, scrX + sw / 2, 3.28, '!#3a2a9a', '!#5a46c8', 4);
    sign(ctx, o.title || (debate ? 'THE DEBATE' : 'THE BIG TALK'), scrX, 2.55, ctx.z + .03, { size: debate ? .32 : .26, color: '!#f2e6c8', pad: .02, weight: 800 });
    glowAt(ctx, scrX, 2.45, ctx.z + .05, { r: sw * .9, color: '#6a5ae0', peak: .12 });
    if (debate) { const LZ = ctx.at(-.8), names = o.names || ['MAX', 'SEN. VOSS']; [-2.2, 2.2].forEach((x, i) => { LZ.poly([[x - .55, 0], [x + .55, 0], [x + .5, 1.1], [x - .5, 1.1]], 'desk', 0); LZ.rect(x - .62, 1.1, x + .62, 1.18, '!#45b0a8', 1); LZ.rect(x - .4, .5, x + .4, .74, '#e8e4dc', 1); sign(ctx, names[i] || '', x, .62, -.78, { size: .1, color: '#1a1a2a', pad: .01 }); ctx.spot(i ? 'lecternR' : 'lecternL', { x, z: -1.2, kind: 'counter', topY: 1.1, back: true }); }); }
    else { const DZ = ctx.at(-.7); DZ.rect(1.4, 0, 3.6, .95, 'desk', 0); DZ.rect(1.3, .95, 3.7, 1.03, '!#45b0a8', 1); DZ.circle(2.5, .5, .24, '#f2e6c8', 1); DZ.circle(2.5, .5, .2, 'desk', 2); sign(ctx, 'BT', 2.5, .5, -.68, { size: .12, color: '#f2e6c8', pad: .01 });
      ctx.spot('host', { x: 2.5, z: -1.1, kind: 'seat', seatY: .5, facing: -1, back: true, desk: { topY: 1.0 } });
      const SO = ctx.at(-.9); SO.rrect(-3.0, .1, -1.0, .78, .08, 'sofa', 0); SO.rrect(-2.9, .38, -1.1, .52, .05, mul(ctx.c('sofa'), 1.15), 1); SO.rect(-2.9, 0, -2.8, .1, INK, 0); SO.rect(-1.2, 0, -1.1, .1, INK, 0);
      ctx.spot('guest', { x: -2.0, z: -.75, kind: 'seat', seatY: .48, facing: 1 }); }
    const A1 = ctx.at(1.4), R2 = rnd(3); for (let x = -7.2; x < 7.2; x += .6) pawn(A1, x + R2() * .1, -.3, 1.1, '#0a0818', 0);
    shell(ctx, { side: 'none', cornice: false, skirting: false, floor: { kind: 'flat', color: 'floor', front: .3, sheen: { x: 0, z: -1, rx: 4, rz: 1.6, k: .4 } }, wallTop: 7 });
    ctx.spot('center', { x: 0, z: -.4 }); ctx.spot('left', { x: -2.4, z: -.4 }); ctx.spot('right', { x: 2.4, z: -.4 });
    return finish(ctx, { cam: { wide: { on: [0, 1.5, 0], frame: { h: 3.8 } }, full: camFull(0) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// APARTMENT at night (timeloop NYE f1251 / f1318, sunset f3493): a dark blue city flat, a wall-wide window onto the skyline
// (fireworks on New Year's Eve), a long low sofa, a wall shelf, a coffee table
// ---------------------------------------------------------------------------------------------------------------------
export const apartment = {
  desc: 'a city apartment (timeloop): a dark blue room with a wall-wide window onto the night skyline (fireworks option), a long low sofa, a wall shelf with a few things, a coffee table',
  opts: "mood: night (default) | dusk (sunset window) | day; fireworks: true (bursts in the sky); hue: navy (default) | violet | any stage hue",
  moods: ['night', 'dusk', 'day'],
  build(S, o = {}) {
    const hue = o.hue || 'navy';
    const ctx = setCtx(S, 'apartment', o, { family: 'stage', H: null, x0: -7, x1: 7, mood: 'night', gradeAs: { night: { k: .85, sat: .9, tint: [1, 1, 1.05] } },
      pal: huePal(hue, { wall: '#30374f', lower: '#28293b', floor: '#181a2c', sofa: '#1e1a2a' }), moods: { dusk: { wall: '!#4a2626', lower: '!#3a1e1e', floor: '!#2a1416', sofa: '!#1a0e10', base: '!#1a0c0c' } }, rim: { all: '#c8d0ff', dusk: '#f0a070' }, rimDir: { all: [1, .4] } });
    const P = ctx.wall, wx0 = -.6, wx1 = 5.8, wy0 = .9, wy1 = 2.75;
    ctx.holes.push({ x0: wx0, y0: wy0, x1: wx1, y1: wy1 }); ctx.views.push({ x0: wx0, x1: wx1, y0: wy0, y1: wy1, view: 'skyline', sky: { dusk: 'lake' } });
    P.rect(wx0 - .08, wy0 - .08, wx1 + .08, wy0, INK, 5); P.rect(wx0 - .08, wy1, wx1 + .08, wy1 + .08, INK, 5); for (const x of [wx0 - .08, (wx0 + wx1) / 2 - .04, wx1]) P.rect(x, wy0, x + .08, wy1, INK, 5);
    if (o.fireworks ?? true) { const R = rnd(31), F = new Painter(ctx, { kind: 'add', map: XY(ctx.z - 12), order: 4, lit: false }); for (let i = 0; i < 3; i++) { const fx = 1 + i * 3.2 + R(), fy = 4.2 + R() * 1.6, col = [[.9, .3, .5], [.4, .7, 1], [1, .8, .3]][i];
      for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283, r = .5 + R() * .4; F.seg(fx + Math.cos(a) * .15, fy + Math.sin(a) * .15, fx + Math.cos(a) * r, fy + Math.sin(a) * r, .035, [col[0] * .8, col[1] * .8, col[2] * .8, 1], 0); } F.radial(fx, fy, [[0, [col[0] * .5, col[1] * .5, col[2] * .5, 1]], [1.1, [0, 0, 0, 1]]], 0, 24); } ctx.glows.push(F); }
    const SP = ctx.at(ctx.z + .02); SP.rect(-4.6, 2.0, -2.2, 2.06, '#3c4260', 0); SP.rect(-4.3, 2.06, -4.0, 2.3, '#4a5070', 1); SP.rect(-3.0, 2.06, -2.85, 2.2, '#4a5070', 1);
    const SO = ctx.at(-1.2); SO.rrect(-.2, .12, 4.2, .62, .06, 'sofa', 0); SO.rrect(-.1, .5, 4.1, .82, .08, mul(ctx.c('sofa'), 1.12), 0); SO.rect(0, 0, .1, .12, INK, 0); SO.rect(4.0, 0, 4.1, .12, INK, 0);
    const T = ctx.at(-.3); T.rect(-2.4, .32, -.6, .38, mul(ctx.c('sofa'), 1.3), 0); T.rect(-2.3, 0, -2.25, .32, INK, 0); T.rect(-.75, 0, -.7, .32, INK, 0);
    for (let i = 0; i < 3; i++) ctx.spot(`sofa${i + 1}`, { x: .6 + i * 1.3, z: -1.0, kind: 'seat', seatY: .5, facing: 0 });
    ctx.spot('window', { x: 2.6, z: ctx.z + .8, back: true }); ctx.spot('table', { x: -1.5, y: .38, z: -.3, kind: 'table', topY: .38 });
    stageShell(ctx, { light: '#c8d0ff', shafts: false, motes: false, gain: .3, wainH: .6 });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 });
    return finish(ctx, { cam: { wide: camWide(.6, { h: 4.2, camH: 1.3 }) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// INAUGURATION / SPEECH (timeloop f27 / f520): a pale sky with falling confetti, a white capitol facade with 8 columns and a
// pediment, two green flags, a podium with a gold seal, a crowd of pawn silhouettes in rows darkening toward the camera
// (phones lit)
// ---------------------------------------------------------------------------------------------------------------------
export const inauguration = {
  desc: 'a public speech / inauguration (timeloop): a pale blue sky with falling confetti, a white columned capitol with a pediment and flags, a podium with a gold seal on a platform, a big crowd of pawn silhouettes in rows (darker toward the camera) holding up lit phones',
  opts: "mood: day (default) | dusk; confetti: false; crowd: false; flags: '#hex' (flag colour)",
  moods: ['day', 'dusk'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'inauguration', o, { family: 'stage', H: null, x0: -12, x1: 12, D: 9, mood: 'day',
      pal: { stone: '#f0e3c9', pediment: '#d6c29e', floor: '#cab48e', podium: '#41291f', flag: o.flags || '#247265' }, rim: { all: '#fff0d0' }, rimDir: { all: [0, 1] } });
    const z0 = ctx.z, P = ctx.wall;
    const SK = new Painter(ctx, { map: XY(z0 - 20), lit: false }); SK.gradV(-40, -5, 40, 30, ctx.M.sky === 'dusk' ? '!#c49c74' : '!#647d93', ctx.M.sky === 'dusk' ? '!#654760' : '!#4a6781'); ctx.objs.push(SK.mesh());
    // capitol: steps, columns, entablature, pediment, flagpole on top
    P.rect(-6, 0, 6, .8, mul(ctx.c('stone'), .9), 0); for (let k = 0; k < 4; k++) P.rect(-6 + k * .3, k * .2, 6 - k * .3, (k + 1) * .2, mul(ctx.c('stone'), .92 + k * .02), 1);
    P.rect(-5.4, .8, 5.4, 5.0, mul(ctx.c('stone'), .86), 0); for (let i = 0; i < 8; i++) { const x = -4.9 + i * 1.4; P.rect(x - .25, .8, x + .25, 4.6, 'stone', 2); P.rect(x - .3, 4.5, x + .3, 4.65, mul(ctx.c('stone'), 1.05), 3); }
    P.rect(-5.8, 4.65, 5.8, 5.25, 'stone', 3); P.poly([[-5.9, 5.25], [5.9, 5.25], [0, 6.6]], 'pediment', 3); P.poly([[-5.3, 5.35], [5.3, 5.35], [0, 6.35]], mul(ctx.c('pediment'), 1.08), 4);
    P.rect(-.03, 6.6, .03, 8.0, '#d8d8d8', 4); P.rect(.03, 7.4, 1.0, 7.95, 'flag', 4); P.rect(.03, 7.62, 1.0, 7.72, '!#f2f2f2', 5);
    for (const fx of [-8.5, 8.5]) { P.rect(fx - .04, 0, fx + .04, 5.5, '#c8c8c8', 4); P.rect(fx + .04, 4.6, fx + 1.4, 5.4, 'flag', 4); P.rect(fx + .04, 4.95, fx + 1.4, 5.05, '!#f2f2f2', 5); }
    // platform + podium with the seal
    const PL = ctx.at(z0 + 2.2); PL.rect(-3, 0, 3, .9, mul(ctx.c('stone'), .8), 0); PL.rect(-3, .86, 3, .9, mul(ctx.c('stone'), 1.05), 1);
    PL.poly([[-.45, .9], [.45, .9], [.4, 2.05], [-.4, 2.05]], 'podium', 2); PL.rect(-.5, 2.0, .5, 2.08, mul(ctx.c('podium'), 1.3), 3); PL.circle(0, 1.5, .17, '!#d8b860', 3); PL.circle(0, 1.5, .12, 'podium', 4); PL.circle(0, 1.5, .05, '!#7ac87a', 5);
    ctx.spot('podium', { x: 0, y: .9, z: z0 + 1.85, kind: 'counter', topY: 2.05, floorY: .9, back: true }); ctx.spot('platform', { x: 1.6, y: .9, z: z0 + 2.0, floorY: .9 });
    floor(ctx, { kind: 'flat', color: 'floor', x0: -20, x1: 20, front: .2 });
    // the crowd: rows of pawns getting darker toward the camera, some phones up with a small glow
    if (o.crowd !== false) { const R = rnd(8), cols = ['#564c5b', '#43394a', '#30263a', '#1e131b'];
      for (let r = 0; r < 4; r++) { const z = -2.6 + r * 1.3, CP = ctx.at(z), s = 1 + r * .1; for (let x = -9; x < 9; x += .55 * s) { const px = x + (R() - .5) * .2; pawn(CP, px, -.2, s * 1.05, cols[r], 0);
          if (R() < .12) { const hx = px + .15 * s, hy = 1.0 * s; CP.seg(px + .1 * s, .5 * s, hx, hy, .06 * s, cols[r], 1); CP.rrect(hx - .04, hy, hx + .04, hy + .14, .015, '!#afc1cf', 2); } } } }
    if (o.confetti !== false) { const R = rnd(4), C = new Painter(ctx, { map: XY(-1), lit: false }), cc = ['#e64a4a', '#f2c24a', '#4ab0e6', '#7ac87a', '#f2f2f2', '#e68ac0'];
      for (let i = 0; i < 140; i++) { const x = -8 + R() * 16, y = R() * 9, a = R() * 3, w = .05, h = .09; C.quad([x + Math.cos(a) * w, y + Math.sin(a) * w], [x - Math.sin(a) * h, y + Math.cos(a) * h], [x - Math.cos(a) * w, y - Math.sin(a) * w], [x + Math.sin(a) * h, y - Math.cos(a) * h], '!' + cc[i % cc.length], 0); }
      const m = C.mesh(); if (m) { m.userData.update = t => { m.position.y = -((t * .5) % 4.5) + 2.2; }; ctx.objs.push(m); } }
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 }); ctx.spot('crowd', { x: 0, z: -1.3 });
    return finish(ctx, { cam: { wide: { on: [0, 2.6, 0], frame: { h: 7.5 } }, podium: camOn(0, 2.4, z0 + 1.85, 2.6), full: { on: [0, 3.6, 0], frame: { h: 10 } } } });
  },
};

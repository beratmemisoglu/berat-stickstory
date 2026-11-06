// Stick stories sets: CORRIDORS, PUBLIC ROOMS, VEHICLES, CLOSE-UP SURFACES (corridor 1-point, hospital, library, police,
// interrogation, cafe / shop, elevator, cell, lobby, stairwell, school yard, car interior, tabletop, backdrop).
// Owned by the set agent. analysis/sets/NOTES.md 1.5 one-offs + 3.2 (top-down: thickness copy + contact shadow) + 5 (DOF).
import { THREE, rnd } from '../core.js';
import { setCtx, shell, finish, door, win, clock, calendar, frame, paper, cabinets, plant, shelf, pendant, light, glowAt, dropShadow,
  prop, FALLBACK, seatOf, topOf, lieOf, mul, mix, Painter, XY, XZ, SIDE, ROOM, sign, cone, camWide, camFull, camOn, monitor, deskLamp, mug,
  digits, ledBox, floorRug, motes, views, skyOf, cityLayer, floor, strHash, lin, soft } from './kit.js';
import { sky, tree, car, facade, streetLamp } from './outside.js';

const D = ROOM.D;

// ---------------------------------------------------------------------------------------------------------------------
// CORRIDOR, one-point (iq500 f3372 school, f4044 vault; hospital / office variants): side walls receding to a far end, doors
// along both walls, ceiling lights, a tiled floor; the VP sits at the centre of the frame
// ---------------------------------------------------------------------------------------------------------------------
const CORR = {
  school:   { wall: '#c9c4b8', door: '#8a6a4a', floor: '#a8a296', ceiling: '#d8d4cc', trim: '#6a8a9a', light: '#f4f6f8' },
  hospital: { wall: '#c8d8d0', door: '#9ab0b8', floor: '#b8c0bc', ceiling: '#e0e6e4', trim: '#7a9a92', light: '#f4fffa' },
  office:   { wall: '#a9abae', door: '#6d7077', floor: '#5d6372', ceiling: '#c4c6c9', trim: '#4a4c52', light: '#eef2f8' },
  vault:    { wall: '#1e2a44', door: '#2a3a5c', floor: '#141a2c', ceiling: '#18223a', trim: '#8aa0c8', light: '#9fb4e8' },
  prison:   { wall: '#8a8a84', door: '#4a4c50', floor: '#6a6a66', ceiling: '#7a7a74', trim: '#3a3c40', light: '#e8ecd8' },
};
export const corridor = {
  desc: 'a long one-point corridor (iq500 school memory / vault, hospital, office, prison): doors along both side walls, ceiling lights, a tiled floor; walk toward or away from the camera',
  opts: "kind: school | hospital | office | vault | prison; mood: day | night | memory (grey flashback, the iq500 look) | blue | alarm; length: 18 (m); width: 3.2; doors: 3 per side",
  moods: ['day', 'memory', 'night', 'alarm'],
  build(S, o = {}) {
    const kind = CORR[o.kind] ? o.kind : 'school', K = CORR[kind], L = o.length ?? 18, W = o.width ?? 3.2, H = 2.9, x0 = -W / 2, x1 = W / 2;
    const ctx = setCtx(S, 'corridor', o, { x0, x1, H, D: L, mood: kind === 'vault' ? 'blue' : 'day', gradeAs: { blue: kind === 'vault' ? 'day' : undefined }, pal: { ...K, cornice: K.wall, skirting: mul(K.wall, .8), side: K.wall },
      rim: { all: '#d0cfc9', blue: '#8aa0c8' }, rimDir: { all: [0, 1] } });
    const z0 = -L;
    // side walls with doors (drawn on the side painters: u = metres from the far end)
    for (const [x, dir] of [[x0, 1], [x1, -1]]) {
      const SW = new Painter(ctx, { map: SIDE(x, z0, dir, 0), key: ctx.key + '|cw' + dir }), len = L + ROOM.front;
      SW.grid(0, 0, len, H, 'wall', { cell: 1.0 });
      if (kind === 'vault') { // lockers all the way: tall panels with thin light edges and a lock each (iq500 f4044)
        for (let u = .2; u < len; u += 1.25) { SW.rect(u, .05, u + 1.2, H - .1, 'door', 1); SW.rect(u, .05, u + .015, H - .1, 'trim', 2); SW.rect(u, H - .115, u + 1.2, H - .1, 'trim', 2); SW.rect(u + .55, 1.3, u + .65, 1.42, 'trim', 3); SW.rect(u + .57, 1.42, u + .63, 1.48, 'trim', 3); }
        SW.rect(0, 0, len, .02, 'trim', 2); ctx.objs.push(SW.mesh()); continue; }
      SW.rect(0, 0, len, .12, mul(ctx.c('wall'), .8), 1); SW.rect(0, 1.0, len, 1.05, 'trim', 1);
      const n = o.doors ?? 3; for (let i = 0; i < n; i++) { const u = 3 + i * (L - 4) / n + (dir < 0 ? 1.2 : 0);
        SW.rect(u - .06, 0, u + 1.06, 2.2, mul(ctx.c('door'), .75), 2); SW.rect(u, 0, u + 1.0, 2.14, 'door', 3); SW.rect(u + .3, 1.5, u + .7, 1.9, kind === 'prison' ? '#2a2c30' : '#d8e0e4', 4); SW.rect(u + .82, .95, u + .88, 1.05, '#d8d0c0', 4);
        ctx.spot(`door${dir > 0 ? 'L' : 'R'}${i + 1}`, { x: x + dir * .45, z: z0 + u + .5, kind: 'door', facing: dir }); }
      ctx.objs.push(SW.mesh());
    }
    // far end wall + ceiling lights + floor tiles
    const P = ctx.wall; P.rect(x0 - 1, 0, x1 + 1, H + 1, mul(ctx.c('wall'), 1.05), 0); P.rect(-.5, 0, .5, 2.1, mul(ctx.c('door'), .9), 1);
    const lights = C => { if (kind === 'vault') { C.rect(x0, z0, x0 + .025, ROOM.front, 'trim', 1); C.rect(x1 - .025, z0, x1, ROOM.front, 'trim', 1); return; } for (let z = z0 + 1.5; z < 6; z += 3) C.rect(-.35, z - .6, .35, z + .6, '!' + K.light, 1); };
    for (let z = z0 + 1.5; z < 4; z += 3) light(ctx, { p: [0, H - .3, z], color: K.light, gain: .25, rh: 1.6, rc: 4, glow: false });
    const C = new Painter(ctx, { map: XZ(H, -.0015), key: ctx.key + '|cceil' }); C.grid(x0, z0, x1, ROOM.front, 'ceiling', { cell: 1.0 }); lights(C); ctx.objs.push(C.mesh());
    floor(ctx, { kind: 'tiles', color: 'floor', s: .6, x0, x1 });
    ctx.spot('far', { x: 0, z: z0 + 2 }); ctx.spot('mid', { x: 0, z: z0 / 2 }); ctx.spot('near', { x: 0, z: 0 }); ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -.8, z: 0 }); ctx.spot('right', { x: .8, z: 0 });
    return finish(ctx, { cam: { wide: { on: [0, 1.45, 0], frame: { h: 3.0 } }, full: { on: [0, 1.5, 0], frame: { h: 3.6 } } } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// HOSPITAL ROOM (sister treatment room; hospital one-offs): pale walls, a window, hospital bed, heart monitor, IV stand,
// curtain rail with a curtain, a visitor chair, a door
// ---------------------------------------------------------------------------------------------------------------------
export const hospital = {
  desc: 'a hospital room: pale green-grey walls, a window, a hospital bed with rails, a heart monitor with a green trace, an IV stand, a privacy curtain on a rail, a visitor chair, a door with a small window',
  opts: "mood: day | night | evening; patient: true (a sleeping head on the pillow is NOT drawn: put a character on spot 'bed'); monitor: true",
  moods: ['day', 'night', 'evening'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'hospital', o, { x0: -4.4, x1: 4.4, mood: 'day',
      pal: { wall: '#c3cfc7', ceiling: '#b5c0b9', floor: '#a9b0aa', line: '#9aa19b', door: '#9aaab0', doorFrame: '#d8dedb', winFrame: '#e8ece9', curtain: '#8fb2b8' },
      rim: { all: '#e8f0f0', night: '#91caf6' }, rimDir: { all: [1, .3] } });
    const P = ctx.wall, m = ctx.mood;
    light(ctx, { p: [0, 2.4, ctx.z + .6], color: '#f4fffa', gain: .25, rh: 2.4, rc: 7, glow: false });
    win(ctx, -2.8, { w: 1.5, h: 1.2, sill: 1.0, view: 'city', blinds: .3 });
    door(ctx, 3.4, { glass: '#c8d8e0', state: o.door ?? 'closed' });
    // curtain rail + gathered curtain
    const CZ = ctx.at(-1.6); CZ.rect(-1.6, 2.45, 2.0, 2.48, '#b9c0c4', 0); for (let x = 1.2, k = 0; x < 2.0; x += .12, k++) CZ.rect(x, .4, x + .12, 2.44, k % 2 ? 'curtain' : mul(ctx.c('curtain'), .88), 1);
    const bed = prop(ctx, 'bed', { x: -.2, z: -1.3, variant: 'hospital', duvetColor: '#dfe6ea' }, (c, oo) => FALLBACK.bed(c, { ...oo, duvet: '#dfe6ea', frame: '#9aa0a4' }));
    ctx.spot('bed', lieOf(bed)); ctx.spot('bedside', seatOf(bed, { facing: 0 }));
    // heart monitor on a pole + IV stand
    const MZ = ctx.at(-1.7); MZ.rect(-1.62, 0, -1.58, 1.4, '#7a8084', 0); MZ.rrect(-1.95, 1.4, -1.25, 1.85, .03, '#2a2d33', 1); MZ.rect(-1.9, 1.45, -1.3, 1.8, '!#0e1a14', 2);
    MZ.pline([[-1.88, 1.6], [-1.75, 1.6], [-1.7, 1.72], [-1.65, 1.5], [-1.6, 1.62], [-1.32, 1.62]], .012, '!#5cf08a', 3); if (m !== 'day') glowAt(ctx, -1.6, 1.62, -1.65, { r: .5, color: '#5cf08a', peak: .1 });
    MZ.rect(1.0, 0, 1.03, 1.95, '#9aa0a4', 0); MZ.rect(.85, 1.92, 1.2, 1.95, '#9aa0a4', 0); MZ.rrect(.86, 1.55, 1.0, 1.9, .03, '!#e8f4f8', 1);
    const ch = prop(ctx, 'chair', { x: 1.9, z: -.6, facing: -1 }, FALLBACK.chair); ctx.spot('chair', seatOf(ch, { facing: -1 }));
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -2.4, z: 0 }); ctx.spot('right', { x: 2.4, z: 0 }); ctx.spot('window', { x: -2.8, z: ctx.z + .8, back: true });
    shell(ctx, { side: 'both', floor: { kind: 'tiles', s: .6 } });
    return finish(ctx, { cam: { wide: camWide(0), full: camFull(0), bed: camOn(-.2, 1.0, -1.0, 2.2) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// LIBRARY (iq500 school library f3210): tall bookshelves of coloured spines, a reading table with lamps, a door with PUSH
// ---------------------------------------------------------------------------------------------------------------------
export const library = {
  desc: 'a school / public library: tall bookshelves full of coloured spines, a reading table with two green lamps and chairs, a door with a PUSH sign, a clock',
  opts: "mood: day | evening | memory; table: true",
  moods: ['day', 'evening', 'memory'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'library', o, { x0: -5.4, x1: 5.4, mood: 'day',
      pal: { wall: '#b9ad98', ceiling: '#a39884', floor: '#7c5d40', shelf: '#6e5038', door: '#9a8a76' }, rim: { all: '#f0d8b0' }, rimDir: { all: [1, .3] }, propMood: { evening: 'dusk' } });
    const P = ctx.wall;
    light(ctx, { p: [0, 2.5, ctx.z + .6], color: '#fff2d8', gain: .25, rh: 2.4, rc: 7, glow: false });
    door(ctx, -4.2, { state: o.door ?? 'closed', glass: '#c8d0d0' }); sign(ctx, 'PUSH', -4.2, 1.5, ctx.z + .03, { size: .09, color: '#c23b33', bg: '#f4f1ea', pad: .3 });
    clock(ctx, -2.6, 2.3, { r: .15 });
    const SZ = ctx.at(ctx.z + .3), R = rnd(14);
    for (const [sx0, sx1] of [[-2.1, -.1], [.2, 2.2], [2.5, 4.5]]) { SZ.rect(sx0, 0, sx1, 2.45, 'shelf', 0); for (let y = .08; y < 2.3; y += .46) { SZ.rect(sx0 + .05, y, sx1 - .05, y + .4, mul(ctx.c('shelf'), .62), 1); let x = sx0 + .08; while (x < sx1 - .1) { const w = .04 + R() * .04, h = .26 + R() * .1; SZ.rect(x, y + .02, x + w, y + .02 + h, ['#3c5885', '#b3822f', '#b23a32', '#4e8a52', '#7a4a9a', '#d8c070', '#2e6e8e', '#c86a3a'][Math.floor(R() * 8)], 2); x += w + .006; } SZ.rect(sx0, y + .4, sx1, y + .46, 'shelf', 3); } }
    if (o.table !== false) { const tz = -.9, T = ctx.at(tz); T.rect(-1.8, .72, 1.8, .78, '#8a6444', 1); T.rect(-1.8, .7, 1.8, .72, '#6a4a30', 1); T.rect(-1.7, 0, -1.62, .7, '#6a4a30', 0); T.rect(1.62, 0, 1.7, .7, '#6a4a30', 0);
      for (const x of [-1.0, 1.0]) { T.rect(x - .02, .78, x + .02, 1.05, '#c8a050', 2); T.ellipse(x, 1.07, .17, .08, '#2e6a4a', 3, 1, 20, 0, Math.PI); if (ctx.M.lamps) light(ctx, { p: [x, 1.0, tz + .1], color: '#ffe2b0', gain: .8, rh: .5, rc: 2, peak: .12, gr: .7 }); }
      ctx.spot('table', { x: 0, y: .78, z: tz, kind: 'table', topY: .78, x0: -1.8, x1: 1.8 });
      [-1.1, 1.1].forEach((x, i) => { const c = prop(ctx, 'chair', { x: x + (i ? .35 : -.35), z: tz + .45, facing: i ? -1 : 1 }, FALLBACK.chair); ctx.spot(`chair${i + 1}`, seatOf(c, { facing: i ? -1 : 1 })); }); }
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('shelves', { x: 1.2, z: ctx.z + .9, back: true }); ctx.spot('left', { x: -2.6, z: 0 }); ctx.spot('right', { x: 2.6, z: 0 });
    shell(ctx, { side: 'both' });
    return finish(ctx);
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// POLICE STATION front room + INTERROGATION room
// ---------------------------------------------------------------------------------------------------------------------
export const police = {
  desc: 'a police station front room: blue-grey walls, a long front desk with a computer, a notice board with wanted posters, a wall clock, a waiting bench, a barred door to the cells',
  opts: "mood: day | night | evening",
  moods: ['day', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'police', o, { x0: -5.2, x1: 5.2, mood: 'day', pal: { wall: '#8a98a8', ceiling: '#7a8696', floor: '#5a5e66', desk: '#3a4458', door: '#4a5060' }, rim: { all: '#d0d8e8' }, rimDir: { all: [1, .3] } });
    const P = ctx.wall;
    light(ctx, { p: [0, 2.5, ctx.z + .6], color: '#eef4ff', gain: .25, rh: 2.4, rc: 7, glow: false });
    door(ctx, 4.1, { color: '#3a3e48', handle: '#c9ccd2' }); for (let k = 0; k < 5; k++) P.rect(4.1 - .4 + k * .2, 1.5, 4.1 - .38 + k * .2, 2.0, '#202228', 6);
    P.rect(-3.6, 1.2, -1.6, 2.3, '#8a6440', 4); P.rect(-3.55, 1.25, -1.65, 2.25, '#b8925e', 5); dropShadow(ctx, -3.6, 1.2, -1.6, 2.3);
    for (const [x, y] of [[-3.2, 1.95], [-2.6, 1.9], [-2.0, 1.97], [-3.0, 1.5], [-2.2, 1.5]]) { paper(ctx, x, y, { w: .32, h: .38, lines: 2, l: 6, pin: '#c23b33' }); P.circle(x, y + .05, .07, '#2a2a2e', 8); P.rrect(x - .08, y - .12, x + .08, y - .02, .03, '#2a2a2e', 8); }
    sign(ctx, 'WANTED', -2.6, 2.4, ctx.z + .02, { size: .1, color: '#2a2a2e', pad: .02 });
    clock(ctx, .2, 2.3, { r: .16 });
    const DZ = ctx.at(-1.6); DZ.rect(-.8, 0, 2.6, 1.05, 'desk', 0); DZ.rect(-.85, 1.05, 2.65, 1.12, mul(ctx.c('desk'), 1.35), 1); DZ.rect(-.8, .95, 2.6, .98, mul(ctx.c('desk'), .8), 1);
    sign(ctx, 'POLICE', .9, .62, -1.58, { size: .16, color: '#e8eef6', pad: .02, spacing: .2 }); DZ.circle(.9, .32, .12, '!#d8b860', 1);
    const DP2 = ctx.at(-2.0); monitor(ctx, DP2, 1.8, 1.05, { w: .5, h: .32, ui: 'text', z: -2.0 });
    ctx.spot('desk', { x: .9, y: 1.12, z: -1.6, kind: 'counter', topY: 1.12 }); ctx.spot('officer', { x: 1.6, z: -2.1, back: true }); ctx.spot('front', { x: .6, z: -1.0 });
    const b = prop(ctx, 'bench', { x: -3.4, z: -.6, variant: 'bus', w: 1.6 }, FALLBACK.bench); ctx.spot('bench', seatOf(b, { facing: 0 }));
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -2.4, z: 0 }); ctx.spot('right', { x: 2.6, z: 0 });
    shell(ctx, { side: 'both', floor: { kind: 'tiles', s: .6 } });
    return finish(ctx);
  },
};
export const interrogation = {
  desc: 'an interrogation room: dark grey concrete walls, a one-way mirror, a single hanging lamp with a hard light cone over a metal table with two chairs facing each other',
  opts: "mood: night (default) | day | blue",
  moods: ['night', 'blue'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'interrogation', o, { x0: -4, x1: 4, mood: 'night', gradeAs: { night: { k: .62, sat: .6, tint: [1, 1, 1.05] } }, pal: { wall: '#6a6c70', ceiling: '#4a4c50', floor: '#4a4a4e', table: '#8a8e94' },
      rim: { all: '#f0e2c0' }, rimDir: { all: [0, 1] }, propMood: { night: 'dusk' } });
    const P = ctx.wall;
    P.rect(-2.6, 1.0, .6, 2.2, '#1a1d24', 4); P.rect(-2.66, .94, .66, 1.0, '#3a3c42', 4); P.rect(-2.66, 2.2, .66, 2.26, '#3a3c42', 4); P.poly([[-2.4, 2.1], [-2.0, 2.1], [-2.5, 1.5]], '#2a2e38', 5);
    door(ctx, 2.6, { color: '#4a4c52', handle: '#c9ccd2' });
    const tz = -.8; pendant(ctx, 0, 2.1, tz, { kind: 'dome', shade: '#2a2a2e', on: true, moods: true, gain: 2.0, rh: .9, rc: 4, half: .45, coneK: .1, s: .9 });
    const T = ctx.at(tz); T.rect(-.9, .74, .9, .78, 'table', 1); T.rect(-.9, .72, .9, .74, mul(ctx.c('table'), .7), 1); T.rect(-.85, 0, -.8, .72, '#3a3c40', 0); T.rect(.8, 0, .85, .72, '#3a3c40', 0);
    ctx.spot('table', { x: 0, y: .78, z: tz, kind: 'table', topY: .78, x0: -.9, x1: .9 });
    [-1, 1].forEach((s, i) => { const c = prop(ctx, 'chair', { x: s * 1.15, z: tz + .05, facing: -s, color: '#5a5c62' }, FALLBACK.chair); ctx.spot(i ? 'chair2' : 'chair1', seatOf(c, { facing: -s })); });
    ctx.spot('center', { x: 0, z: .2 }); ctx.spot('left', { x: -2.2, z: .2 }); ctx.spot('right', { x: 2.2, z: .2 }); ctx.spot('mirror', { x: -1.0, z: ctx.z + .7, back: true });
    shell(ctx, { side: 'both', wallTex: { kind: 'concrete', s: 1.4 }, floor: { kind: 'concrete' } });
    return finish(ctx, { cam: { wide: camWide(0, { h: 3.0 }), table: camOn(0, 1.05, tz, 2.0) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// CAFE / SHOP counter: a counter with a till, a menu board, shelves of cups, a cake display, pendant lamps, stools
// ---------------------------------------------------------------------------------------------------------------------
export const cafe = {
  desc: 'a cafe / corner shop interior: a long counter with a till and a cake display, a chalk menu board, shelves of cups and jars, pendant lamps, bar stools, a window to the street',
  opts: "mood: day | evening | night; kind: 'cafe' | 'shop' (shelves of goods instead of the menu); name: 'CORNER CAFE' (sign)",
  moods: ['day', 'evening', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'cafe', o, { x0: -5.2, x1: 5.2, mood: 'day', pal: { wall: '#c8b494', ceiling: '#a8967a', floor: '#6e5440', counter: '#5a3c2a', top: '#d8cbb6' }, rim: { all: '#f0c890' }, rimDir: { all: [-1, .3] }, propMood: { evening: 'dusk' } });
    const P = ctx.wall, shop = o.kind === 'shop';
    light(ctx, { p: [0, 2.4, ctx.z + .6], color: '#fff0d0', gain: .25, rh: 2.4, rc: 7, glow: false });
    win(ctx, -3.7, { w: 1.8, h: 1.4, sill: .9, view: 'city', panes: [2, 1] });
    if (!shop) { P.rect(-1.6, 1.55, .9, 2.45, '#2f372e', 4); P.rect(-1.65, 1.5, .95, 1.55, '#6a4a2e', 5); P.rect(-1.65, 2.45, .95, 2.5, '#6a4a2e', 5); for (let k = 0; k < 6; k++) P.rect(-1.4, 2.25 - k * .12, -.2 - (k % 3) * .2, 2.27 - k * .12, '#e8e6e0', 5); sign(ctx, 'MENU', -.35, 2.32, ctx.z + .02, { size: .08, color: '#e8e6e0', pad: .01 }); }
    shelf(ctx, P, 1.3, 3.6, 1.7, { items: shop ? 'boxes' : 'jars', n: 6, l: 4 }); shelf(ctx, P, 1.3, 3.6, 2.15, { items: shop ? 'boxes' : 'jars', n: 6, colors: ['#e8e6e0', '#d8d0c0', '#c8b8a0', '#e0dcd4'], l: 4 });
    if (shop) { shelf(ctx, P, -1.6, .9, 1.55, { items: 'boxes', n: 5, l: 4 }); shelf(ctx, P, -1.6, .9, 2.05, { items: 'boxes', n: 5, l: 4, colors: ['#5b8fd0', '#d8c070', '#b44a3c', '#7cb36b'] }); }
    sign(ctx, o.name || (shop ? 'CORNER SHOP' : 'CORNER CAFE'), 2.45, 2.65, ctx.z + .02, { size: .14, color: '#3a2a22', pad: .02, spacing: .12 });
    const cz = -1.9, C2 = ctx.at(cz); C2.rect(-1.8, 0, 3.8, 1.0, 'counter', 0); C2.rect(-1.85, 1.0, 3.85, 1.08, 'top', 1); C2.rect(-1.8, .96, 3.8, 1.0, mul(ctx.c('counter'), .75), 1);
    for (let x = -1.6; x < 3.6; x += .6) C2.rect(x, .15, x + .5, .85, mul(ctx.c('counter'), 1.12), 1);
    C2.rect(2.6, 1.08, 3.2, 1.35, '#2a2c32', 2); C2.rect(2.66, 1.2, 3.14, 1.32, '!#7fd0a0', 3); C2.rect(2.7, 1.08, 3.1, 1.14, '#5a5c62', 3);
    if (!shop) { C2.rect(-1.5, 1.08, .3, 1.5, '!#e8eef0', 2); for (let i = 0; i < 4; i++) { const x = -1.3 + i * .42; C2.rect(x - .14, 1.12, x + .14, 1.26, '#e8d0b0', 3); C2.rect(x - .14, 1.24, x + .14, 1.3, ['#c8504a', '#6a3a2a', '#e8c070', '#c86a9a'][i], 4); } C2.rect(-1.5, 1.48, .3, 1.5, '#9aa0a4', 3); }
    ctx.spot('counter', { x: 1.0, y: 1.08, z: cz, kind: 'counter', topY: 1.08 }); ctx.spot('barista', { x: 1.0, z: cz - .5, back: true }); ctx.spot('customer', { x: 1.0, z: cz + .5 }); ctx.spot('till', { x: 2.9, z: cz + .5 });
    for (const x of [-.6, 1.4]) pendant(ctx, x, 2.2, cz + .2, { kind: 'dome', shade: '#2e4a3a', moods: 'lamps', on: ctx.M.lamps, gain: .9, cone: false });
    [-.6, .4, 1.4].forEach((x, i) => { const st = prop(ctx, 'stool', { x, z: cz + .6, variant: 'bar' }, FALLBACK.stool); ctx.spot(`stool${i + 1}`, seatOf(st, { facing: 0 })); });
    ctx.spot('center', { x: 0, z: .2 }); ctx.spot('left', { x: -2.6, z: .2 }); ctx.spot('right', { x: 2.6, z: .2 }); ctx.spot('window', { x: -3.7, z: ctx.z + .8, back: true });
    shell(ctx, { side: 'both', floor: { kind: 'tiles', s: .45 } });
    return finish(ctx);
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// ELEVATOR (iq500 f195): brushed steel cabin seen through its open doors from the landing: handrail, lit ceiling, floor
// indicator above, door panels slid aside
// ---------------------------------------------------------------------------------------------------------------------
export const elevator = {
  desc: 'an elevator (iq500): the brushed-steel cabin seen through its open doors from the landing, a handrail, a lit ceiling, the floor indicator above, the door panels slid aside, a call button panel',
  opts: "mood: day | night | alarm; floor: 'L' | '12' (indicator); doors: 'open' | 'closed'",
  moods: ['day', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'elevator', o, { x0: -1.05, x1: 1.05, H: 2.45, D: 1.5, mood: 'day', pal: { wall: '#8a8478', ceiling: '#d8d4c8', floor: '#5a5650', side: '#787266', landing: '#d6cfbd', frame: '#a8a294' }, rim: { all: '#f0e8d8' }, rimDir: { all: [0, 1] } });
    const P = ctx.wall;
    for (let x = -1.0; x < 1.0; x += .08) P.rect(x, 0, x + .004, 2.45, mul(ctx.c('wall'), .92), 1);
    P.rect(-1.05, .95, 1.05, 1.0, '#c8c4bc', 3);
    light(ctx, { p: [0, 2.3, -.8], color: '#fff6e0', gain: .5, rh: 1.4, rc: 4, glow: false });
    shell(ctx, { side: 'both', cornice: false, ceilItems: [C => C.rect(-.7, -1.3, .7, .2, '!#fff6e0', 1)], floor: { kind: 'flat' } });
    // the landing wall in front with the door opening, the slid door panels, the indicator, the call panel
    const zf = .45, F = new Painter(ctx, { map: XY(zf), key: ctx.key + '|landing' }); F.grid(-6, -.2, 6, 5, 'landing', { holes: [{ x0: -.85, y0: -.2, x1: .85, y1: 2.25 }], cell: .8 });
    F.rect(-.95, 0, -.85, 2.35, 'frame', 1); F.rect(.85, 0, .95, 2.35, 'frame', 1); F.rect(-.95, 2.25, .95, 2.35, 'frame', 1);
    const closed = o.doors === 'closed';
    if (closed) { F.rect(-.85, 0, 0, 2.25, '#a8a294', 2); F.rect(0, 0, .85, 2.25, '#a49e90', 2); F.rect(-.005, 0, .005, 2.25, '#7a7468', 3); }
    F.rect(-.3, 2.42, .3, 2.66, '#141416', 2); F.poly([[-.2, 2.6], [-.08, 2.6], [-.14, 2.48]], '!#ff4a3a', 3); digits(F, o.floor ?? 'L', -.02, 2.46, .16, '!#ff4a3a', 3);
    F.rect(1.15, 1.05, 1.3, 1.45, '#b8b2a6', 2); F.circle(1.225, 1.32, .035, '!#ffd080', 3); F.circle(1.225, 1.18, .035, '#e8e4dc', 3);
    for (let x = -5.9; x < 6; x += .6) if (Math.abs(x) > 1.0) F.rect(x, -.2, x + .008, 5, mul(ctx.c('landing'), .9), 1);
    ctx.objs.push(F.mesh());
    if (!closed) { const DZ = ctx.at(zf - .06); DZ.rect(-1.75, 0, -.9, 2.25, '#a8a294', 0); DZ.rect(.9, 0, 1.75, 2.25, '#a49e90', 0); }
    ctx.spot('center', { x: 0, z: -.7 }); ctx.spot('left', { x: -.5, z: -.9 }); ctx.spot('right', { x: .5, z: -.9 }); ctx.spot('back', { x: 0, z: -1.2 }); ctx.spot('landing', { x: 0, z: 1.2 }); ctx.spot('door', { x: 0, z: .3, kind: 'door' });
    return finish(ctx, { bounds: { x0: -1.0, x1: 1.0, z0: -1.5, z1: .4, wallZ: -1.5, floorY: 0, ceilY: 2.45 }, cam: { wide: { on: [0, 1.3, .4], frame: { h: 3.0 } }, full: { on: [0, 1.5, .4], frame: { h: 4.0 } } } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// CELL (sister f63): concrete walls, a steel door, a barred window throwing a warm light patch with bar shadows, a bunk, a bulb
// ---------------------------------------------------------------------------------------------------------------------
export const cell = {
  desc: 'a prison / holding cell (sister): concrete block walls, a steel door with a hatch, a high barred window throwing a warm light patch with bar shadows onto the wall, a bunk, a hanging bulb',
  opts: "mood: day (default) | night | blue",
  moods: ['day', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'cell', o, { x0: -3.2, x1: 3.2, mood: 'day', gradeAs: { day: { k: .9, sat: .8, tint: [1, 1, 1] } }, pal: { wall: '#90877e', ceiling: '#6e6760', floor: '#6a645e', door: '#7a7e78' }, rim: { all: '#e8c890' }, rimDir: { all: [1, .4] } });
    const P = ctx.wall, sun = ctx.mood === 'day';
    door(ctx, -1.6, { color: 'door', handle: '#3a3c40' }); P.rect(-1.6 - .2, 1.3, -1.6 + .2, 1.42, '#3a3c40', 6);
    win(ctx, 1.4, { w: .9, h: .5, sill: 2.0, view: 'sky', frame: '#3a3c40', panes: [1, 1], sillLedge: false, shaft: false }); for (let k = 1; k < 5; k++) P.rect(1.4 - .45 + k * .18 - .015, 2.0, 1.4 - .45 + k * .18 + .015, 2.5, '#2a2c30', 6);
    if (sun) { const A = ctx.at(ctx.z + .01, { kind: 'add', order: 3, lit: false }); A.poly([[-.2, 1.85], [1.0, 1.85], [1.3, 1.05], [.1, 1.05]], '!#6a5030', 0); const B = ctx.at(ctx.z + .012, { kind: 'alpha', order: 3, lit: false }); for (let k = 1; k < 5; k++) { const t = k / 5; B.poly([[-.2 + 1.2 * t - .03, 1.85], [-.2 + 1.2 * t + .03, 1.85], [.1 + 1.2 * t + .03, 1.05], [.1 + 1.2 * t - .03, 1.05]], '!#000000', 0, .28); } }
    pendant(ctx, 0, 2.2, -1.2, { kind: 'bulb', on: !sun, moods: sun ? [] : true, cone: false });
    const BZ = ctx.at(ctx.z + .4); BZ.rect(-.2, .35, 2.6, .45, '#5a5650', 0); BZ.rect(-.15, .45, 2.55, .55, '#8a8a7a', 1); BZ.rect(-.2, 0, -.12, .45, '#3a3a38', 0); BZ.rect(2.52, 0, 2.6, .45, '#3a3a38', 0);
    ctx.spot('bunk', { x: 1.2, z: ctx.z + .6, kind: 'seat', seatY: .5, facing: 0 }); ctx.spot('bunkLie', { x: 1.2, z: ctx.z + .5, kind: 'bed', lieY: .55, x0: -.1, x1: 2.5, head: 'left' });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -1.6, z: 0 }); ctx.spot('right', { x: 1.6, z: 0 });
    shell(ctx, { side: 'both', wallTex: { kind: 'blocks', bw: .8, bh: .32, k: .94 }, floor: { kind: 'concrete' } });
    return finish(ctx, { cam: { wide: camWide(0, { h: 3.0 }), full: camFull(0, { h: 3.8 }) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// LOBBY at night (sister f10014 / f11496): glass curtain wall onto the night street, a reception desk, a bench, an LED clock
// ---------------------------------------------------------------------------------------------------------------------
export const lobby = {
  desc: 'an office building lobby at night (sister heist): a glass curtain wall onto the dark street, a reception desk, a bench, an LED clock box, a dark polished floor; police lights optional',
  opts: "mood: night (default) | day | blue; police: true (blinking red / blue light bars outside); led: '00:00'",
  moods: ['night', 'day'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'lobby', o, { x0: -7, x1: 7, H: 3.6, mood: 'night', gradeAs: { night: { k: .5, sat: .5, tint: [.92, .96, 1.18] } }, pal: { wall: '#555255', ceiling: '#2a2e3b', floor: '#171a26', glass: '#0e101d', desk: '#393b45', side: '#222431' }, rim: { all: '#9fb4d8' }, rimDir: { all: [1, .3] } });
    const P = ctx.wall;
    const gx0 = -6.6, gx1 = 1.8; ctx.holes.push({ x0: gx0, y0: .05, x1: gx1, y1: 3.4 }); ctx.views.push({ x0: gx0, x1: gx1, y0: .05, y1: 3.4, view: 'skyline' });
    for (let x = gx0; x <= gx1 + .01; x += 1.4) P.rect(x - .04, 0, x + .04, 3.45, '#2a2c34', 4); P.rect(gx0, 3.4, gx1, 3.48, '#2a2c34', 4); P.rect(gx0, 1.0, gx1, 1.04, '#2a2c34', 4);
    if (o.police) { // police light bars outside the glass: red / blue swap every 4 frames (sister f11496), each with a strong glow
      for (const [x, cols] of [[-4.2, ['#6aa1fe', '#c66c78']], [-1.2, ['#c66c78', '#6aa1fe']]]) cols.forEach((c, i) => {
        const G = new Painter(ctx, { kind: 'add', map: XY(ctx.z - 2.0), order: 6, lit: false }), lc = lin(c);
        G.radial(x, .95, [[0, [lc[0] * .9, lc[1] * .9, lc[2] * .9, 1]], [.12, [lc[0] * .5, lc[1] * .5, lc[2] * .5, 1]], [.5, [lc[0] * .18, lc[1] * .18, lc[2] * .18, 1]], [1.4, [0, 0, 0, 1]]], 0, 32);
        G.rrect(x - .3, .9, x + .3, 1.0, .04, [lc[0], lc[1], lc[2], 1], 1);
        const m = G.mesh(); m.userData.update = t => { m.visible = (Math.floor(t * 24 / 4) % 2) === i; }; ctx.objs.push(m); }); }
    ledBox(ctx, P, 4.2, 2.6, o.led || '00:00', { h: .13 });
    const DZ = ctx.at(-1.8); DZ.rect(2.8, 0, 5.6, 1.05, 'desk', 0); DZ.rect(2.75, 1.05, 5.65, 1.12, mul(ctx.c('desk'), 1.3), 1); ctx.spot('desk', { x: 4.2, y: 1.12, z: -1.8, kind: 'counter', topY: 1.12 }); ctx.spot('guard', { x: 4.2, z: -2.4, back: true });
    const b = prop(ctx, 'bench', { x: -2.5, z: -1.4, variant: 'bus', w: 2.0 }, FALLBACK.bench); ctx.spot('bench', seatOf(b, { facing: 0 }));
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 }); ctx.spot('glass', { x: -2.4, z: ctx.z + .7, back: true });
    shell(ctx, { side: 'both', floor: { kind: 'flat', front: .2 } });
    return finish(ctx, { cam: { wide: camWide(0, { h: 3.8, camH: 1.35 }), full: camFull(0, { h: 5.2, camH: 1.7 }) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// STAIRWELL (sister f6432 dark / f9238 green): concrete stairs rising across the frame, a railing, a big painted floor
// number, a wall lamp
// ---------------------------------------------------------------------------------------------------------------------
export const stairwell = {
  desc: 'a concrete stairwell (sister heist): a flight of stairs rising across the frame with a railing, a landing, a big painted floor number, a caged wall lamp, a fire door',
  opts: "mood: night (dark, default) | day (green-grey) | alarm; level: '11'",
  moods: ['night', 'day', 'alarm'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'stairwell', o, { x0: -5, x1: 5, H: 3.4, mood: 'night', gradeAs: { night: { k: .62, sat: .6, tint: [.95, .96, 1.05] } }, pal: { wall: '#5a5f57', ceiling: '#4a4e48', floor: '#4a4e48', stair: '#6a6e66', rail: '#2a2c2e' }, rim: { all: '#e8e0c8' }, rimDir: { all: [1, .4] } });
    const P = ctx.wall;
    sign(ctx, o.level ?? '11', 2.6, 2.1, ctx.z + .02, { size: .7, color: mul(ctx.c('wall'), 1.35), pad: .01, weight: 800 });
    door(ctx, -3.6, { color: '#7a3a32', handle: '#c9ccd2' });
    P.rect(1.15, 2.3, 1.45, 2.5, '#2a2a2e', 5); P.ellipse(1.3, 2.4, .1, .07, ctx.M.lamps || ctx.mood === 'night' ? '!#fff0c8' : '#d8d4c8', 6); light(ctx, { p: [1.3, 2.3, ctx.z + .2], color: '#fff0c8', gain: 1.0, rh: 1.1, rc: 4, peak: .2, gr: .9, moods: ['night', 'alarm', 'dusk', 'blue'] });
    // the flight: steps rising to the right (side view), stringer, railing
    const SZ = ctx.at(-1.6), n = 12, sw = .3, sh = .18;
    for (let i = 0; i < n; i++) { const x = -2.2 + i * sw, y = i * sh; SZ.rect(x, 0, x + sw, y + sh, 'stair', 0); SZ.rect(x, y + sh - .025, x + sw, y + sh, mul(ctx.c('stair'), 1.18), 1); }
    SZ.poly([[-2.2, 0], [-2.2 + n * sw, n * sh], [-2.2 + n * sw, n * sh - .2], [-2.2, -.2]], mul(ctx.c('stair'), .8), 2);
    SZ.seg(-2.2, .95, -2.2 + n * sw, n * sh + .95, .04, 'rail', 3); for (let i = 0; i <= n; i += 2) SZ.rect(-2.2 + i * sw - .015, i * sh + .1, -2.2 + i * sw + .015, i * sh + .95, 'rail', 3);
    SZ.rect(-2.2 + n * sw, n * sh - .1, 5, n * sh, 'stair', 0);
    ctx.spot('bottom', { x: -2.6, z: -1.6 }); ctx.spot('top', { x: -2.2 + n * sw + .4, y: n * sh, z: -1.6, floorY: n * sh }); ctx.spot('stairs', { x: -2.2 + n * sw / 2, y: n * sh / 2, z: -1.6, kind: 'stairs', x0: -2.2, x1: -2.2 + n * sw, y0: 0, y1: n * sh });
    ctx.spot('center', { x: 0, z: .2 }); ctx.spot('left', { x: -3, z: .2 }); ctx.spot('right', { x: 3, z: .2 });
    shell(ctx, { side: 'both', wallTex: { kind: 'blocks', bw: .9, bh: .34, k: .95 }, floor: { kind: 'concrete' } });
    return finish(ctx);
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// SCHOOL YARD (timeloop f8224 / school porch): a brick school building with windows, a door on steps, a flag, a fence with a
// banner, round hazy trees, a pale sun; sandy ground
// ---------------------------------------------------------------------------------------------------------------------
export const schoolyard = {
  desc: 'outside a school (timeloop): a red-brick school building with white-framed windows, a door on steps with a porch light, a flag, an iron fence with a banner, round hazy trees, a pale sun, sandy ground',
  opts: "mood: day (default) | dusk | night; banner: 'SPORTS DAY' (our own text) | false",
  moods: ['day', 'dusk', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'schoolyard', o, { family: 'stage', x0: -10, x1: 10, H: null, mood: 'day', D: 3.5, pal: { brick: '#b4553a', sand: '#d8b88a', floor: '#d8b88a', fence: '#3a2a2a' }, rim: { all: '#fff0c8' }, rimDir: { all: [-1, .4] }, shadows: true });
    sky(ctx, { kind: ctx.M.sky === 'day' ? 'clear' : null, sun: ctx.M.sky !== 'night', sunAt: [8, 9], autoMoon: true });
    const TZ = ctx.at(-8); for (const [x, s] of [[-7, 1.6], [6, 1.8], [10, 1.5]]) tree(ctx, TZ, x, s, { leaf: '#9cbdbd', trunk: '#8a9a9a' });
    const P = ctx.wall, bx0 = -6.5, bx1 = .8;
    P.rect(bx0, 0, bx1, 5.2, 'brick', 0); for (let y = .2; y < 5.2; y += .2) P.rect(bx0, y, bx1, y + .015, mul(ctx.c('brick'), .85), 1); P.rect(bx0 - .1, 5.2, bx1 + .1, 5.45, mul(ctx.c('brick'), .7), 1);
    for (const x of [-5.6, -4.0, -.6]) for (const y of [1.3, 3.3]) { P.rect(x - .55, y, x + .55, y + 1.2, '#f2efe6', 2); P.rect(x - .47, y + .08, x + .47, y + 1.12, ctx.M.sky === 'night' ? '!#d8b070' : '#5a7a9a', 3); P.rect(x - .02, y + .08, x + .02, y + 1.12, '#f2efe6', 4); }
    P.rect(-2.75, .45, -1.45, 2.6, '#f2efe6', 2); P.rect(-2.65, .45, -1.55, 2.5, '#e8d8a8', 3); P.rect(-2.2, 1.4, -2.15, 1.55, '#8a6a3a', 4);
    for (let k = 0; k < 3; k++) { const SZ = ctx.at(ctx.z + .1 + k * .14); SZ.rect(-3.1 - k * .12, k * .15, -1.1 + k * .12, (k + 1) * .15, mix('#c8c0b0', '#a8a090', k / 3), 0); }
    P.rect(.3, 5.45, .35, 7.0, '#d8d8d8', 2); P.rect(.35, 6.4, 1.5, 6.95, '#2e8a6a', 2); P.rect(.35, 6.55, 1.5, 6.62, '#f2f2f2', 3);
    const FZ = ctx.at(-1.0); for (let x = .2; x < 10; x += .18) FZ.rect(x, 0, x + .04, 1.2, 'fence', 0); FZ.rect(.2, 1.1, 10, 1.15, 'fence', 1); FZ.rect(.2, .2, 10, .24, 'fence', 1);
    if (o.banner !== false) { FZ.rect(2.6, .45, 6.6, 1.05, '#f2efe6', 2); sign(ctx, o.banner || 'SPORTS DAY', 4.6, .75, -.98, { size: .2, color: '#c23b33', pad: .01, spacing: .1 }); }
    floor(ctx, { kind: 'flat', color: 'sand', x0: -14, x1: 14, front: .15 });
    ctx.spot('door', { x: -2.1, y: .45, z: ctx.z + .5, kind: 'door', floorY: .45 }); ctx.spot('steps', { x: -2.1, z: ctx.z + .9, kind: 'seat', seatY: .3, facing: 0 });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -3, z: 0 }); ctx.spot('right', { x: 3, z: 0 });
    return finish(ctx, { cam: { wide: camWide(-1, { h: 5.0, camH: 1.8 }), full: camFull(-1, { h: 7, camH: 2.6 }) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// CAR INTERIOR, side view (iq500 f1663): the far door with its windows onto the street, the roof line, seats in profile,
// the dashboard and the steering wheel; spots driver / passenger / back seats. view: 'side' | 'front' (through the windscreen)
// ---------------------------------------------------------------------------------------------------------------------
export const carInterior = {
  desc: 'inside a car, side view (iq500): the far door with windows onto a passing street (blurred), the roof line, front and back seats in profile, the dashboard and steering wheel; or view front: the driver behind the wheel seen through the windscreen',
  opts: "mood: day | dusk | night; view: 'side' (default) | 'front'; color: '#hex' (the car's interior); outside: 'street' | 'trees' | 'city'",
  moods: ['day', 'dusk', 'night'],
  build(S, o = {}) {
    const front = o.view === 'front';
    const ctx = setCtx(S, 'carInterior', o, { x0: -6, x1: 6, H: null, mood: 'day', D: 1.0, pal: { trim: o.color || '#3a3c42', seat: '#2a2c32', dash: '#5a6a4a', floor: '#2a2c32' }, rim: { all: '#f0d8b0', night: '#9fb4d8' }, rimDir: { all: [front ? 0 : 1, .5] } });
    sky(ctx, { z: -30 });
    // the outside: houses / trees / city on cards (they blur with distance)
    const OZ = ctx.at(-8, { lit: false }), night = ctx.M.sky === 'night';
    if ((o.outside || 'street') === 'trees') for (let x = -12; x < 12; x += 2.4) tree(ctx, OZ, x, 1.4, { leaf: night ? '#1c2a22' : '#6f8f5a' });
    else { for (let x = -14; x < 14; x += 3.4) facade(ctx, OZ, x, x + 3.2, 4.5 + (x % 2), { color: night ? '#2a2e3c' : '#b8ae9c', lit: .5 }); }
    const GZ = ctx.at(-4, { lit: false }); GZ.rect(-14, -2, 14, .2, night ? '#1a1c22' : '#8a8a84', 0); ctx.objs.push();
    if (!front) {
      // seen through the open near window: the near door (car body colour) along the bottom, the window frame and roof,
      // the far door's inside with its windows onto the street, seats in profile, the dashboard + steering wheel (right)
      const body = o.body || '#6a8a5a', F = ctx.at(-1.0), t = 'trim';
      F.rect(-3.6, 0, 3.6, .95, t, 0); F.rect(-3.6, .95, 3.6, 1.0, mul(ctx.c(t), 1.25), 1); F.rect(-3.6, 1.82, 3.6, 4, mul(ctx.c(t), .8), 0);
      for (const x of [-3.6, -1.05, 1.25]) F.rect(x, .95, x + .16, 1.85, t, 0); F.poly([[1.41, 1.82], [3.6, 1.0], [3.6, 1.82]], t, 0);
      F.rect(-2.6, .45, -2.1, .5, mul(ctx.c(t), .7), 1); F.rect(.2, .45, .7, .5, mul(ctx.c(t), .7), 1);
      const SZ = ctx.at(-.35), sc = o.seat || '#7a6e64';
      for (const [x, name] of [[0, 'driver'], [-2.1, 'back']]) { SZ.rrect(x - .5, .32, x + .12, .52, .06, sc, 0); SZ.poly([[x - .55, .45], [x - .32, .45], [x - .18, 1.25], [x - .42, 1.3]], sc, 1); SZ.rrect(x - .46, 1.26, x - .2, 1.46, .07, mul(ctx.c(sc), .92), 2); SZ.rect(x - .5, .32, x + .12, .35, mul(ctx.c(sc), .8), 2);
        ctx.spot(name, { x: x - .12, z: -.3, kind: 'seat', seatY: .5, facing: 1 }); }
      ctx.spot('passenger', { x: -.12, z: -.75, kind: 'seat', seatY: .5, facing: 1, back: true });
      const DZ = ctx.at(-.45); DZ.poly([[.85, .5], [3.6, .5], [3.6, 1.02], [1.05, 1.05]], 'dash', 0); DZ.rect(1.05, .98, 3.6, 1.05, mul(ctx.c('dash'), 1.2), 1); DZ.rect(1.4, .8, 1.75, .92, '!' + (night ? '#8ae0ff' : '#2a3a3a'), 2);
      DZ.seg(.95, .8, .7, 1.12, .05, '#1a1b1f', 2); DZ.ring(.62, 1.15, .2, .24, '#1a1b1f', 3, 1, 32);   // steering column + wheel (a little turned to us)
      if (night) glowAt(ctx, 1.57, .86, -.4, { r: .4, color: '#8ae0ff', peak: .08 });
      ctx.spot('wheel', { x: .62, y: 1.15, z: -.4, kind: 'grip' }); ctx.spot('center', { x: -.12, z: -.3, kind: 'seat', seatY: .5, facing: 1 }); ctx.spot('outside', { x: -1.0, z: 1.4 });
      // the near door in the foreground: body colour below the window line, the window frame + roof (cut by the frame)
      const N = ctx.at(.75); N.rect(-3.6, -1, 3.6, .92, body, 0); N.rect(-3.6, .88, 3.6, .95, mul(body, 1.18), 1); N.rect(-3.6, .3, 3.6, .33, mul(body, .82), 1); N.rect(1.6, .6, 1.85, .66, mul(body, .7), 1);
      N.rect(-3.6, 1.88, 3.6, 2.15, mul(body, .9), 0); N.rect(-1.3, .92, -1.12, 1.9, mul(body, .9), 0);
      return finish(ctx, { cam: { wide: { on: [-.4, 1.2, 0], frame: { h: 2.0 } }, driver: camOn(-.1, 1.3, -.3, 1.4), full: { on: [-.8, 1.3, 0], frame: { h: 3.0 } } } });
    }
    // through the windscreen: dashboard + wheel arc in the foreground, the driver seat behind, the rear window
    const W2 = ctx.at(-1.4); W2.rect(-3, 0, 3, 3, '#202226', 0); W2.rect(-1.2, 1.2, 1.2, 1.9, '#4a5260', 1); W2.rrect(-.5, .4, .5, 1.6, .1, 'seat', 2); W2.rrect(-.42, 1.5, .42, 1.8, .08, 'seat', 3);
    const FZ2 = ctx.at(.9); FZ2.rect(-3, 0, 3, .62, 'dash', 0); FZ2.rect(-3, .58, 3, .66, mul(ctx.c('dash'), 1.2), 1); FZ2.ring(0, .75, .36, .42, '#141518', 2, 1, 48); FZ2.rect(-.04, .3, .04, .75, '#141518', 2);
    FZ2.rect(-3, 2.6, 3, 3.2, '#141518', 0); FZ2.rect(-3, 0, -2.4, 3.2, '#141518', 0); FZ2.rect(2.4, 0, 3, 3.2, '#141518', 0);
    ctx.spot('driver', { x: 0, z: -.4, kind: 'seat', seatY: .5, facing: 0 }); ctx.spot('wheel', { x: 0, y: .75, z: .9, kind: 'grip' });
    return finish(ctx, { cam: { wide: { on: [0, 1.25, -.4], frame: { h: 2.1 } } } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// TABLETOP: top-down close-up surfaces (the 34 macro inserts: phone, mug, plate, hands): wood planks, kitchen tiles, a desk,
// a bed sheet, a check tablecloth. The surface is a card facing the camera; things lie on it at z > 0.
// ---------------------------------------------------------------------------------------------------------------------
export const tabletop = {
  desc: 'a top-down close-up surface for insert shots (all three references): wood planks (#866444), kitchen tiles, a dark desk, a bed sheet, a check tablecloth; the surface faces the camera, lay props on it (S.prop(..., { at: \'center\' }))',
  opts: "surface: wood | tiles | desk | sheet | cloth | marble | concrete; mood: day | dusk | night | candle; light: 'left' | 'right' | 'top' (a soft light pool)",
  moods: ['day', 'night', 'dusk', 'candle'],
  build(S, o = {}) {
    const surf = o.surface || 'wood', COL = { wood: '#866444', tiles: '#d8d6cc', desk: '#5a4332', sheet: '#d9d6d0', cloth: '#d8d1c4', marble: '#e6e4e0', concrete: '#8a8884' }[surf] || '#866444';
    const ctx = setCtx(S, 'tabletop', o, { x0: -3, x1: 3, H: null, D: .02, mood: 'day', pal: { top: COL }, rim: { all: '#f0d8b0', night: '#91caf6' }, rimDir: { all: [-1, .6] } });
    const P = new Painter(ctx, { map: XY(0), key: ctx.key + '|top' }), R = rnd(strHash(surf) + (o.seed ?? 0)), base = ctx.c('top');
    const lx = o.light === 'right' ? 1.2 : o.light === 'top' ? 0 : -1.2;
    light(ctx, { p: [lx, .5, .9], color: ctx.M.sky === 'night' ? '#9fb0d8' : '#fff2d8', gain: ctx.mood === 'candle' ? 2.5 : .45, rh: 1.0, rc: 4, glow: false });
    const X = 4.5, Y = 3;   // the surface covers any framing up to ~2 m tall
    P.grid(-X, -Y, X, Y, base, { cell: .3 });
    // wood: narrow planks (the references' table: ~22 boards a frame), staggered joints, faint grain
    // wood planks .05 m: iq500 f80 shows ~8-9 boards in a frame where a real-size phone is a third of the height (h ~.45 m)
    if (surf === 'wood' || surf === 'desk') { const pw = surf === 'desk' ? .1 : .05; for (let y = -Y; y < Y; y += pw) { P.rect(-X, y - .003, X, y + .003, mul(base, .8), 1); let x = -X + R() * 1.2; while (x < X) { P.rect(x - .003, y, x + .003, y + pw, mul(base, .8), 1); x += .9 + R() * 1.1; } if (R() < .6) { const gy = y + pw * (.3 + R() * .4), gx = -X + R() * 8; P.seg(gx, gy, gx + .4 + R() * .6, gy, .0025, mul(base, .9), 1); } } }
    else if (surf === 'tiles' || surf === 'marble') { for (let x = -X; x < X; x += .3) P.rect(x - .006, -Y, x + .006, Y, mul(base, .86), 1); for (let y = -Y; y < Y; y += .3) P.rect(-X, y - .006, X, y + .006, mul(base, .86), 1); }
    else if (surf === 'cloth') { for (let x = -X; x < X; x += .12) P.rect(x - .006, -Y, x + .006, Y, mul(base, .86), 1); for (let y = -Y; y < Y; y += .12) P.rect(-X, y - .006, X, y + .006, mul(base, .86), 1); }
    else if (surf === 'sheet') { for (let k = 0; k < 10; k++) { const x = -4 + k * .8 + R() * .2; P.seg(x, -Y, x + .6 + R() * .5, Y, .05, mul(base, .93), 1); } }
    ctx.objs.push(P.mesh());
    for (const [nm, x, y] of [['center', 0, 0], ['left', -.45, 0], ['right', .45, 0], ['top', 0, .3], ['bottom', 0, -.3], ['topLeft', -.4, .28], ['topRight', .4, .28], ['bottomLeft', -.4, -.28], ['bottomRight', .4, -.28]]) ctx.spot(nm, { x, y, z: .01, kind: 'surface', top: true });
    return finish(ctx, { top: true, bounds: { x0: -4.5, x1: 4.5, y0: -3, y1: 3, z0: 0, z1: 1 }, cam: { wide: { on: [0, 0, 0], frame: { h: 1.2 } }, top: { on: [0, 0, 0], frame: { h: 1.2 } }, close: { on: [0, 0, 0], frame: { h: .7 } }, full: { on: [0, 0, 0], frame: { h: 2.0 } } } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// BACKDROP: plain close-up backgrounds (the references' CUs are the set blurred: in a set, just frame 'cu' and the depth of
// field does it; this is for a CU with no set): a soft gradient wall + optional blurred practicals (bokeh) / window patch
// ---------------------------------------------------------------------------------------------------------------------
export const backdrop = {
  desc: 'a plain close-up background: a soft gradient wall in a colour (or a set\'s wall colour for its mood), optional blurred lamp bokeh or a window light patch; for close-ups with no set (inside a set, frame cu and the depth of field blurs the set)',
  opts: "color: '#hex' | like: 'kitchen' | 'bedroom' | 'office' | ... (that set's wall for the mood); mood; bokeh: true | n; window: true; dark: true",
  moods: ['day', 'dusk', 'night', 'candle', 'evening'],
  build(S, o = {}) {
    const LIKE = { kitchen: '#a08f7b', bedroom: '#a8957f', livingroom: '#9a8670', homeoffice: '#7e8390', office: '#7a7b7e', lab: '#cbc9c3', hallway: '#c7b9a3', workshop: '#8b7e70', kindergarten: '#e1915f', classroom: '#d8c99f', study: '#afc0c8', street: '#8a7d70', hospital: '#c3cfc7' };
    const ctx = setCtx(S, 'backdrop', o, { x0: -8, x1: 8, H: null, D: 3, mood: 'day', pal: { wall: o.color || LIKE[o.like] || '#a08f7b' }, rim: { all: '#f0d8b0' }, rimDir: { all: [-1, .4] } });
    const P = new Painter(ctx, { map: XY(-3), key: ctx.key + '|bd' }), w = ctx.c('wall');
    P.grid(-8, -3, 8, 6, w, { cell: .8, colFn: (u, v) => mul(w, 1 + .1 * Math.exp(-((u + 1) ** 2 + (v - 1.6) ** 2) / 8) - (o.dark ? .25 : 0) * Math.min(1, Math.hypot(u, v - 1.2) / 6)) });
    ctx.objs.push(P.mesh());
    // the out-of-focus room the references show behind close-ups, already soft (feathered shapes), so it reads blurred
    // whatever the depth of field: a floor band, a frame, a doorway, a window patch, a lamp glow (o.room: false = plain)
    const A = ctx.at(-2.97, { kind: 'alpha', order: 2, lit: false }), dk = mul(w, .55), lt = mul(w, 1.35);
    if (o.room !== false) {
      soft(A, -8, -3, 8, .55, dk, .55, .25); soft(A, -2.9, 1.25, -1.9, 2.0, mul(w, .7), .6, .12); soft(A, 2.3, -1, 3.4, 2.15, dk, .45, .15);
      if (o.like === 'kitchen' || o.like === 'lab' || o.like === 'office') soft(A, -1.4, .9, 1.4, 1.2, mul(w, .8), .5, .12);
    }
    if (o.window ?? (o.room !== false && !ctx.M.lamps)) soft(A, .6, 1.2, 2.0, 2.6, ctx.M.sky === 'night' ? '!#20283c' : lt, .7, .2);
    if (ctx.M.lamps && o.room !== false) glowAt(ctx, -3.6, 1.6, -2.9, { r: 1.6, color: '#ffd9a8', peak: .2, core: .5 });
    const n = o.bokeh === true ? 5 : (o.bokeh || 0), R = rnd(7); for (let i = 0; i < n; i++) glowAt(ctx, -3 + R() * 6, .9 + R() * 1.6, -2.9, { r: .3 + R() * .3, color: ['#ffd9a8', '#ffe2b0', '#9fb4e8'][i % 3], peak: .35, core: .5 });
    ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -.8, z: 0 }); ctx.spot('right', { x: .8, z: 0 });
    return finish(ctx, { cam: { wide: { on: [0, 1.45, 0], frame: 'cu' } } });
  },
};

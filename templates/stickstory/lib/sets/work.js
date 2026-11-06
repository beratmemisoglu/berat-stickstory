// Stick stories sets: WORK (office floor, call center, lab, workshop). Owned by the set agent.
// analysis/sets/NOTES.md 1.5 (office floor night sister f7566, call center iq500 f10194, lab sister f12714 / f12893,
// workshop sister f4851) and 3.1 (the lights: ceiling panels, tubes, monitors, EXIT, LED boxes, pendant cone).
import { THREE, rnd } from '../core.js';
import { setCtx, shell, finish, door, win, clock, calendar, frame, paper, cabinets, plant, shelf, pendant, light, glowAt, dropShadow,
  prop, FALLBACK, seatOf, topOf, mul, Painter, XY, XZ, ROOM, sign, cone, camWide, camFull, camOn, monitor, deskLamp, mug, digits, ledBox, floorRug } from './kit.js';

const D = ROOM.D;

// ---------------------------------------------------------------------------------------------------------------------
// OFFICE FLOOR (sister f7566 / f9321): perspective ceiling light panels, back wall with 3 tall night windows between
// columns, EXIT door + green sign, LED clock box, 3 elevators with floor digits, 4 desk islands x 4 monitors
// ---------------------------------------------------------------------------------------------------------------------
export const office = {
  desc: 'an open-plan office floor at night (sister heist): ceiling light panels, tall windows on the night city between columns, EXIT door with a green sign, LED clock box, three elevators with floor digits, four desk islands with monitors, keyboards and chairs',
  opts: "mood: night (neutral lit office, default) | alarm (red) | violet | blue | day; islands: 1-5 (default 4); led: '00:00' (the LED box text) | false; floor: '1' (elevator digits); elevators: true",
  moods: ['night', 'alarm', 'violet', 'blue', 'day'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'office', o, {
      x0: -7.6, x1: 7.6, mood: 'night', H: 3.05,
      gradeAs: { night: 'day' },
      pal: { wall: '#6a6b6f', ceiling: '#53585f', panel: '!#a0a6ad', cornice: '#5c5f66', skirting: '#3e4046', side: '#4c4e54', floor: '#2d323f', line: '#272b37',
        column: '#7a7c80', door: '#51555d', doorFrame: '#62656c', winFrame: '#4d4f53', desk: '#8e9196', elevator: '#7d8085' },
      moods: { day: { wall: '#b0b2b5', ceiling: '#8e939c', cornice: '#a2a5ab', floor: '#5d6372', line: '#535867', side: '#8a8c92', column: '#c4c6c9', door: '#8a8e95', desk: '#d6d8db', elevator: '#b8bbc0' } },
      rim: { night: '#9fb0c8', alarm: '#ff8f86', violet: '#c4a6ff', blue: '#91caf6', day: '#d0cfc9' }, rimDir: { all: [-1, .3] },
      propMood: { night: 'day', day: 'day' },
    });
    const m = ctx.mood, P = ctx.wall, H = ctx.H;
    // the ceiling panels light the room evenly; a soft band of light near the ceiling line
    for (let x = -6; x <= 6; x += 4) light(ctx, { p: [x, H - .2, -1.2], color: '#e8eef6', gain: .12, rh: 2.0, rc: 5, glow: false });
    // windows between columns (floor-to-ceiling night city)
    const wins = [[-3.9, 2.2], [-.85, 2.5], [2.1, 2.2]];
    for (const [x, w] of wins) { win(ctx, x, { w, h: 1.9, sill: .28, panes: [3, 1], frameW: .03, frame: '#3a3d44', view: 'skyline', sillLedge: false, shaft: false, haze: .04 }); P.rect(x - w / 2 - .14, 0, x - w / 2 - .02, H, 'column', 5); P.rect(x + w / 2 + .02, 0, x + w / 2 + .14, H, 'column', 5); }
    // EXIT door + sign
    door(ctx, -6.1, { w: .9, h: 2.1, state: o.door ?? 'closed', color: 'door', handle: '#c9ccd2', name: 'door' });
    P.rect(-6.1 + .25, .95, -6.1 + .28, 1.45, '#c9ccd2', 7);
    P.rect(-6.3, 2.42, -5.9, 2.58, '!#87b396', 6); sign(ctx, 'EXIT', -6.1, 2.5, ctx.z + .012, { size: .085, color: '!#f2fff6', pad: .05, spacing: .1 });
    glowAt(ctx, -6.1, 2.5, ctx.z + .03, { r: .45, color: '#87d3a0', peak: .1 });
    // LED box above the first elevator
    if (o.led !== false) ledBox(ctx, P, 3.95, 2.45, o.led || '00:00', { h: .11 });
    // three elevators with digit boxes
    if (o.elevators !== false) for (let i = 0; i < 3; i++) { const ex = 4.6 + i * 1.05 - .6 + .6, w = .85; P.rect(ex - w / 2 - .04, 0, ex + w / 2 + .04, 2.18, mul(ctx.c('elevator'), .82), 4); P.gradV(ex - w / 2, 0, ex + w / 2, 2.12, mul(ctx.c('elevator'), .94), 'elevator', 5); P.rect(ex - .006, 0, ex + .006, 2.12, mul(ctx.c('elevator'), .7), 6);
      P.rect(ex - .1, 2.36, ex + .1, 2.56, '#0e0e10', 5); digits(P, o.floor ?? '1', ex - .035, 2.4, .12, '!#ffb347', 6); ctx.spot(`elevator${i + 1}`, { x: ex, z: ctx.z + .35, kind: 'door', back: true }); }
    // desk islands: two staggered rows of monitors on long desks (back row higher on screen), keyboards, chairs
    const n = o.islands ?? 4, xs = [...Array(n)].map((_, i) => -4.8 + i * 2.55 - (n - 4) * 1.27);
    xs.forEach((ix, i) => {
      for (const [z, off, rowName] of [[-1.55, -.45, 'b'], [-.95, .2, 'f']]) {
        const DP = ctx.at(z), y = .76;
        DP.rect(ix - 1.1, y - .03, ix + 1.1, y, 'desk', 0); DP.rect(ix - 1.1, y - .045, ix + 1.1, y - .03, mul(ctx.c('desk'), .72), 0);
        for (const lx of [ix - 1.02, ix + 1.0]) DP.rect(lx, 0, lx + .03, y - .045, '#3a3d44', 0);
        for (const dx of [-.5, .5]) { monitor(ctx, DP, ix + dx + off * .3, y, { w: .5, h: .32, ui: 'text', screen: '#7189a6', z, l: 2, bloom: .05, glow: m !== 'day' }); DP.rect(ix + dx + off * .3 - .17, y, ix + dx + off * .3 + .17, y + .018, '#16171b', 6); }
        if (rowName === 'f') for (const dx of [-.5, .5]) { const c = ctx.at(z + .45); c.rect(ix + dx - .18, .42, ix + dx + .18, .47, '#26282e', 0); c.rrect(ix + dx - .15, .5, ix + dx + .15, .8, .04, '#2c2e35', 0); c.rect(ix + dx - .02, .1, ix + dx + .02, .42, '#1c1d22', 0); c.rect(ix + dx - .2, .06, ix + dx + .2, .1, '#1c1d22', 0);
          ctx.spot(`desk${i + 1}${dx < 0 ? 'a' : 'b'}`, { x: ix + dx, z: z + .45, kind: 'seat', seatY: .47, facing: 0, back: true, desk: { topY: y } }); }
      }
      ctx.spot(`island${i + 1}`, { x: ix, y: .76, z: -.95, kind: 'table', topY: .76 });
    });
    ctx.spot('center', { x: 0, z: .4 }); ctx.spot('left', { x: -3.4, z: .4 }); ctx.spot('right', { x: 3.4, z: .4 }); ctx.spot('windows', { x: -.85, z: ctx.z + .6, back: true });
    ctx.spot('elevators', { x: 5.65, z: ctx.z + .9 }); ctx.spot('entry', { x: -6.1, z: -2.2 });
    // perspective ceiling light panels (flat, no glow: sister f7566)
    const panels = C => { for (let x = -6.3; x <= 6.3; x += 4.2) for (const z of [-1.4, 1.2]) C.rect(x - .95, z - .55, x + .95, z + .55, 'panel', 1); };
    shell(ctx, { side: 'both', ceilItems: [panels], floor: { kind: 'flat', front: .1 } });
    return finish(ctx, { cam: { wide: camWide(0, { h: 4.4, camH: 1.3 }), full: camFull(0, { h: 5.6, camH: 1.45 }), close: camWide(0), elevators: camWide(4.6), desks: camOn(-1.2, 1.1, -.9, 2.4) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// CALL CENTER (iq500 f10194 wide, f9418 desk): dark room, high violet strip windows, fluorescent tubes with haze, rows of
// desks receding (each row higher on screen), blue monitors, worker silhouettes with headsets
// ---------------------------------------------------------------------------------------------------------------------
export const callcenter = {
  desc: 'a dark call center / scam office (iq500): high violet strip windows, fluorescent tubes with haze, 4 rows of desks with blue monitors and seated worker silhouettes with headsets; a wall board of scribbles',
  opts: "mood: night (default) | blue | alarm; rows: 2-5; workers: true|false (seated silhouettes); board: true (the boss's scribble board on the back wall)",
  moods: ['night', 'blue', 'alarm'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'callcenter', o, {
      x0: -8, x1: 8, mood: 'night', H: 3.6, D: 8.5, gradeAs: { night: 'day' },
      pal: { wall: '#33323b', ceiling: '#26252d', cornice: '#3a3943', skirting: '#24232a', side: '#2a2930', floor: '#1d1d26', line: '#18181f', glass: '!#765863', tube: '!#c6cbd2', desk: '#2a2c38', screen: '#223553' },
      rim: { all: '#91caf6' }, rimDir: { all: [0, 1] }, propMood: { night: 'night' },
    });
    const P = ctx.wall, H = ctx.H, R = rnd(77);
    // high strip windows (violet glass) + fluorescent tubes with a hazy band under them
    for (let x = -6; x <= 6; x += 4) { P.rect(x - 1.2, 2.6, x + 1.2, 3.1, 'glass', 2); for (let k = 1; k < 5; k++) P.rect(x - 1.2 + k * .48 - .02, 2.6, x - 1.2 + k * .48 + .02, 3.1, '#2a2930', 3); P.rect(x - 1.25, 2.56, x + 1.25, 2.6, '#45434d', 3); }
    for (let x = -6; x <= 6; x += 3) for (const z of [-6.5, -3.5, -.8]) { const T = ctx.at(z); T.rect(x - .8, H - .3, x + .8, H - .24, 'tube', 0); T.rect(x - .02, H - .24, x + .02, H, '#1a1a1f', 0); glowAt(ctx, x, H - .36, z + .01, { r: 1.4, color: '#b9c3d8', peak: .06, sy: .45 }); }
    if (o.board) { const B = ctx.at(ctx.z + .02); B.rect(-2.6, 2.0, 2.6, 3.2, '#e6e4dc', 4); dropShadow(ctx, -2.6, 2.0, 2.6, 3.2); for (let i = 0; i < 30; i++) { const x = -2.45 + (i % 6) * .82, y = 3.05 - Math.floor(i / 6) * .2; B.rect(x, y - .014, x + .4 + R() * .25, y, i % 3 ? '#b3302a' : '#2a2a2e', 5); } }
    clock(ctx, 4.2, 2.3, { r: .18, time: [11, 50] });
    // rows of desks receding (each row higher on screen): the monitor screens (drawn facing us, the references' 2D cheat),
    // the worker silhouette in front of it (head over the screen's lower half, grey headset), the chair back in front
    // the rows sit on a raked floor (each row further back is raised: the references' rows step up ~30-35 px each)
    const rows = o.rows ?? 5, workers = o.workers !== false, rake = o.rake ?? .36;
    for (let r = 0; r < rows; r++) {
      const z = -5.6 + r * 1.2, dy = (rows - 1 - r) * rake, DP = ctx.at(z), y = .74 + dy, off = (r % 2) * .6;
      DP.rect(-8, y - .04, 8, y, 'desk', 0); DP.rect(-8, dy - 1.2, 8, y - .04, mul(ctx.c('desk'), .7), 0);
      for (let x = -7.4 + off; x < 7.6; x += 1.2) {
        monitor(ctx, DP, x, y + .06, { w: .5, h: .32, ui: 'code', screen: '#223553', z, l: 2, bloom: .04, glow: r >= rows - 3 });
        const W = ctx.at(z + .3), wx = x + .03;
        if (workers && R() < .85) { W.circle(wx, 1.02 + dy, .12, '#0d0a14', 2); W.ring(wx, 1.03 + dy, .125, .145, '#5a5d66', 3, 1, 20); W.rrect(wx - .19, .5 + dy, wx + .19, .92 + dy, .08, '#0d0a14', 2); }
        W.rect(wx - .21, .42 + dy, wx + .21, .74 + dy, '#212431', 4); W.rect(wx - .02, dy - .3, wx + .02, .42 + dy, '#16171d', 4);
      }
      ctx.spot(`row${r + 1}`, { x: -.3 + off, y: dy, z: z + .3, floorY: dy, kind: 'seat', seatY: .47, facing: 0, back: true });
    }
    ctx.spot('center', { x: 0, z: 1.6 }); ctx.spot('left', { x: -3, z: 1.6 }); ctx.spot('right', { x: 3, z: 1.6 }); ctx.spot('aisle', { x: 7.0, z: -2 });
    door(ctx, 6.4, { w: .95, state: o.door ?? 'closed', color: '#4a4d56', handle: '#a9adb6' });
    shell(ctx, { side: 'both', floor: { kind: 'flat' } });
    return finish(ctx, { cam: { wide: { on: [0, 1.85, 0], frame: { h: 3.4 } }, full: { on: [0, 2.1, 0], frame: { h: 4.6 } }, desk: camOn(-.3, 1.0, -.5, 1.8) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// LAB (sister f12714 white, f16530 evening, f12893 night): window, wide whiteboard, shelf with 16 coloured binders,
// counter with microscope + test-tube rack + device, right side wall
// ---------------------------------------------------------------------------------------------------------------------
export const lab = {
  desc: 'a research lab (sister): window, a wide two-panel whiteboard with blue scribbles, a shelf of 16 coloured binders, a long lab counter with a microscope, a test-tube rack and a device, a stool',
  opts: "mood: day (white, default) | evening | night; board: 'scribble' | 'clean' | 'diagram'; title: 'PROJECT: ...' (text on the whiteboard)",
  moods: ['day', 'evening', 'night'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'lab', o, {
      x0: -4.6, x1: 4.6, mood: 'day',
      pal: { wall: '#cbc9c3', ceiling: '#b0aea6', cornice: '#d6d4ce', skirting: '#a7a59f', side: '#8d8b85', floor: '#908e86', line: '#85837b', winFrame: '#4e5256', board: '#f2f4f4', boardFrame: '#84827e', counter: '#c2c0bc', counterFront: '#b1b3b3' },
      moods: { evening: { wall: '#605650', ceiling: '#4e4642', cornice: '#6a605a', floor: '#4a443f', line: '#403a36', side: '#3e3834', skirting: '#4a423d', board: '!#e4e6e6' }, night: { wall: '#574d45', ceiling: '#463e38', cornice: '#5e544c', floor: '#3f3733', line: '#36302c', side: '#3a332f', skirting: '#463e38', board: '!#d8dbdb' } },
      rim: { day: '#efc49a', evening: '#efc49a', night: '#f0ba84' }, rimDir: { all: [1, .3] }, propMood: { evening: 'dusk' },
    });
    const m = ctx.mood, P = ctx.wall;
    light(ctx, { p: [0, 2.4, ctx.z + .6], color: '#ffffff', gain: .18, rh: 2.4, rc: 7, glow: false, moods: ['day'] });
    win(ctx, -3.3, { w: 1.3, h: 1.15, sill: 1.05, panes: [2, 1], view: m === 'day' ? 'city' : 'skyline', frameW: .035, sillLedge: false, shaftDir: 1, shaft: false });
    // whiteboard: two panels with a grey frame, blue scribble lines
    const bx = -.75, by0 = 1.0, by1 = 1.95;
    dropShadow(ctx, bx - 1.25, by0, bx + 1.25, by1); P.rect(bx - 1.25, by0, bx + 1.25, by1, 'boardFrame', 4); P.rect(bx - 1.22, by0 + .03, bx - .015, by1 - .03, 'board', 5); P.rect(bx + .015, by0 + .03, bx + 1.22, by1 - .03, 'board', 5);
    P.rect(bx - 1.2, by0 - .05, bx + 1.2, by0, mul(ctx.c('boardFrame'), .8), 5);
    if ((o.board ?? 'scribble') !== 'clean') { const R = rnd(5); for (let k = 0; k < 6; k++) { const y = by1 - .22 - k * .1; P.pline([[bx - 1.1, y], [bx - .9, y + .015], [bx - .6, y - .01], [bx - .35 - R() * .2, y + .01]], .008, '#3a5fae', 6); }
      if (o.board === 'diagram') { P.ring(bx + .6, 1.5, .18, .2, '#3a5fae', 6); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; P.seg(bx + .6, 1.5, bx + .6 + Math.cos(a) * .32, 1.5 + Math.sin(a) * .3, .008, '#c2493c', 6); } } }
    if (o.title) sign(ctx, o.title, bx - .65, by1 - .1, ctx.z + .02, { size: .06, color: '#3a5fae', pad: .02, weight: 600, spacing: .04 });
    // binder shelf
    shelf(ctx, P, 1.25, 3.85, 1.72, { items: 'binders', colors: ['#425a8c', '#914235', '#507450', '#bb9e4e'], l: 4 });
    // long lab counter (built in): top + dark 4 px line + front gradient
    const cz = ctx.z + .65, C2 = ctx.at(cz), cx0 = .35, cx1 = 4.3, ty = .95;
    C2.gradV(cx0, 0, cx1, ty - .06, mul(ctx.c('counterFront'), .78), 'counterFront', 0); C2.rect(cx0, ty - .06, cx1, ty - .045, '#3c3b3e', 1); C2.rect(cx0 - .02, ty - .045, cx1 + .02, ty, 'counter', 1);
    for (let x = cx0 + .98; x < cx1; x += .98) C2.rect(x - .005, .05, x + .005, ty - .07, mul(ctx.c('counterFront'), .75), 1);
    // microscope, test-tube rack, small device on the counter
    const L2 = ctx.at(cz - .15); L2.rect(1.0, ty, 1.22, ty + .04, '#2c2e33', 0); L2.seg(1.18, ty + .04, 1.14, ty + .32, .045, '#2c2e33', 0); L2.seg(1.13, ty + .3, 1.02, ty + .2, .05, '#3a3d44', 1); L2.rect(1.0, ty + .1, 1.14, ty + .12, '#2c2e33', 1);
    ['#d9534f', '#f0c24b', '#5bb0d8', '#7cc576', '#e68ac0', '#9b6fd0', '#f08a4b', '#46b3a6'].forEach((c, i) => { L2.rrect(1.6 + i * .055, ty + .04, 1.635 + i * .055, ty + .24, .015, '#dfe6ea', 1); L2.rect(1.605 + i * .055, ty + .04, 1.63 + i * .055, ty + .12, c, 2); });
    L2.rect(1.55, ty, 2.08, ty + .05, '#8a8c90', 3);
    L2.rrect(2.6, ty, 3.05, ty + .2, .02, '#d6d8da', 1); L2.rect(2.68, ty + .08, 2.86, ty + .16, '!#59d08c', 2); L2.circle(2.95, ty + .1, .025, '#3a3d44', 2);
    if (m !== 'day') deskLamp(ctx, L2, 3.6, ty, { facing: -1, on: true, z: cz - .1 });
    ctx.spot('counter', { x: 2.0, z: cz + .3, kind: 'counter', topY: ty, back: true }); ctx.spot('board', { x: bx, z: ctx.z + .7, back: true });
    ctx.spot('window', { x: -3.3, z: ctx.z + .8, back: true }); ctx.spot('center', { x: 0, z: 0 }); ctx.spot('left', { x: -2.3, z: 0 }); ctx.spot('right', { x: 2.4, z: .2 });
    const st = prop(ctx, 'stool', { x: 3.0, z: cz + .5, variant: 'lab' }, FALLBACK.stool); ctx.spot('stool', seatOf(st, { facing: 0 }));
    shell(ctx, { side: 'right', floor: { kind: 'flat', front: .1 } });
    return finish(ctx, { cam: { wide: camWide(0, { h: 3.7, camH: 1.25 }), close: camWide(0), full: camFull(0), board: camOn(bx, 1.35, ctx.z + 1.2, 2.2) } });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// WORKSHOP / HIDEOUT (sister f4851, f510): cinder-block wall, dark slats on the right, papers pinned with red pins,
// a pendant cone lamp throwing a big light cone on the wall, a long table with a laptop, a trash can, a coat on a hook
// ---------------------------------------------------------------------------------------------------------------------
export const workshop = {
  desc: 'a hideout / workshop (sister heist): cinder-block wall, dark wooden slats, papers and charts pinned with red pins, a pendant cone lamp with a big light cone on the wall, a long table with a laptop, a trash can, a coat',
  opts: "mood: night (lamp, default) | day | blue; lamp: false; papers: n (3-8); led: '2:15:00' (a red LED timer box) | false",
  moods: ['night', 'day', 'blue'],
  build(S, o = {}) {
    const ctx = setCtx(S, 'workshop', o, {
      x0: -4.4, x1: 4.6, mood: 'night', H: 3.1,
      pal: { wall: '#8b7e70', ceiling: '#4f4843', cornice: '#6a6058', skirting: '#4a4440', side: '#3e3a37', floor: '#463f3c', line: '#3c3532', slat: '#393939', table: '#705d48', tableFront: '#624f3c' },
      moods: { night: { wall: '#4b4641', ceiling: '#252220', cornice: '#3a3532', floor: '#2a2524', line: '#221e1d', side: '#262220', slat: '#2b2b2c' } },
      rim: { night: '#f0ba84' }, rimDir: { night: [0, 1] }, propMood: { night: 'dusk' },
    });
    const m = ctx.mood, P = ctx.wall, lampOn = o.lamp !== false && m !== 'day';
    // slats on the right part of the wall
    const SL = ctx.at(ctx.z + .03); for (let y = 0; y < ctx.H; y += .16) { SL.rect(2.6, y, 4.6, y + .14, 'slat', 0); SL.rect(2.6, y + .14, 4.6, y + .16, mul(ctx.c('slat'), .7), 0); }
    // papers pinned (drop shadows): charts, lists, a target
    const R = rnd(9), n = o.papers ?? 5;
    [[-2.6, 2.0, .34, .44, 0], [-1.6, 1.85, .48, .34, 1], [-.3, 2.05, .4, .3, 0], [.9, 1.9, .3, .4, 0], [1.75, 2.1, .36, .3, 1], [-3.4, 1.6, .3, .38, 0], [.3, 1.55, .34, .26, 1], [1.5, 1.45, .3, .24, 0]].slice(0, n).forEach(([x, y, w, h, chart], i) => paper(ctx, x, y, { w: w * 1.35, h: h * 1.35, chart: !!chart, lines: chart ? 2 : 5, rot: (R() - .5) * .08 }));
    if (o.led !== false) ledBox(ctx, P, 2.2, 2.62, o.led || '2:15:00', { h: .1 });
    // pendant cone lamp + its big cone of light down the wall
    const lx = -.6;
    pendant(ctx, lx, 2.45, -1.6, { kind: 'cone', shade: '#2e2e30', on: lampOn, moods: lampOn ? true : [], gain: 1.1, rh: 1.0, rc: 4, half: .55, coneK: .07 });
    if (lampOn) { cone(ctx, lx, 2.5, ctx.z + .05, { h: 2.5, half: .5, w0: .4, k: .1, soft: .5, pool: false }); light(ctx, { p: [lx, 1.6, ctx.z + .2], color: '#ffe2b0', gain: 1.2, rh: .9, rc: 3.2, glow: false, cone: .55 }); }
    // long table + laptop + mug; trash can; a coat on a hook at the left edge
    const tz = -.9, T2 = ctx.at(tz), ty = .8; T2.rect(-2.6, ty - .05, 1.6, ty + .14, 'table', 1); T2.rect(-2.6, ty - .08, 1.6, ty - .05, 'tableFront', 1); T2.rect(-2.6, ty - .09, 1.6, ty - .08, mul(ctx.c('table'), .6), 1); T2.rect(-2.5, 0, -2.42, ty - .08, 'tableFront', 0); T2.rect(1.42, 0, 1.5, ty - .08, 'tableFront', 0); T2.rect(-2.5, .3, 1.5, .34, mul(ctx.c('tableFront'), .85), 0);
    T2.poly([[-.25, ty], [.25, ty], [.2, ty + .3], [-.2, ty + .3]], '#3c4150', 3); T2.rect(-.3, ty, .3, ty + .02, '#2a2d36', 4); T2.rect(-.17, ty + .05, .17, ty + .26, '!#5e667e', 4);
    mug(ctx, T2, .7, ty, { color: '#b33a32', label: '#e6e4dc' });
    ctx.spot('table', { x: -.5, y: ty, z: tz, kind: 'table', topY: ty, x0: -2.6, x1: 1.6 });
    const TC = ctx.at(ctx.z + .5); TC.poly([[2.0, 0], [2.36, 0], [2.4, .5], [1.96, .5]], '#2e4a33', 0); TC.rect(1.94, .48, 2.42, .54, '#3a5c40', 1);
    const CO = ctx.at(ctx.z + .6); CO.rect(-4.3, 1.9, -4.0, 1.93, '#2a2622', 0); CO.poly([[-4.32, 1.9], [-3.98, 1.9], [-3.9, .75], [-4.4, .75]], '#c9c1b2', 1); CO.rect(-4.16, .75, -4.14, 1.88, '#a8a092', 2);
    ctx.spot('center', { x: -.5, z: .2 }); ctx.spot('left', { x: -2.4, z: .2 }); ctx.spot('right', { x: 1.8, z: .2 }); ctx.spot('wall', { x: -1.0, z: ctx.z + .7, back: true });
    shell(ctx, { side: 'left', wallTex: { kind: 'blocks', bw: .88, bh: .36, k: .94, y1: ctx.H }, floor: { kind: 'concrete' } });
    return finish(ctx, { cam: { wide: { on: [-.4, 1.05, 0], frame: { h: 2.8 } }, full: camFull(0), table: camOn(-.5, 1.1, tz, 2.0) } });
  },
};
